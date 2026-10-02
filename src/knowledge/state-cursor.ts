// Prefix freeze and cursor validation (A3). Owner: Evidence Package v0.2.2 section 9.3 and Claims Policy v0.1.2 section 4.4.2.
//
// Two different questions are kept apart on purpose:
// - INTERNAL FROZEN CONSISTENCY (`verifyFrozenEntry`): does a stored entry agree with the immutable claim and the event prefix
//   its own cursor names? This can be checked at any later time.
// - HISTORICAL VISIBILITY / COMPLETENESS: was every event committed and visible at the freeze instant included? Rows carry no
//   insertion or commit time and a package stores only the cursor, so this CANNOT be proved after the fact from a cursor alone
//   (authority gap G4). `checkCursor` proves it only when the caller supplies the visible set observed at freeze time, which
//   `freezeClaimPrefix` does from the single snapshot it was given.
//
// Permission ceilings are explicit inputs. A frozen entry is verified against an INDEPENDENTLY supplied frozen-time ceiling
// (or an explicit statement that it is unavailable); it is never inferred from the entry's own effective usage class, which
// would be circular. The live reduction uses a separately supplied current ceiling.
import {
  ClaimStateError,
  assertAcceptedLogShape,
  assertInitialState,
  bySequence,
  frozenStateHash,
  isClaimStatus,
  isUsageClass,
  parseClaimStateEvent,
  reduceClaimState,
  sameEvent,
  MAX_EVENT_SEQUENCE,
  type ClaimStateEvent,
  type ClaimStatus,
  type ReducedClaimState,
  type UsageClass,
} from "./claim-state.js";
import { LexicalNumber } from "./lexical-json.js";

export interface StateCursorValue {
  readonly claim_state_event_id: string;
  readonly event_sequence: number;
}
/** `null` binds the empty prefix; otherwise the exact last event of the selected prefix. */
export type StateCursor = StateCursorValue | null;

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" &&
  v !== null &&
  !Array.isArray(v) &&
  !(v instanceof LexicalNumber);

/**
 * Evidence Package 9.3 cursor shape: `null` or exactly `{claim_state_event_id, event_sequence}`. A LexicalNumber (for example a
 * source that wrote `1.0`), boolean or string sequence is `cursor_sequence_type`. NOTE: a value already produced by
 * `JSON.parse` or node-pg has lost its lexeme; only values from `parseLexicalJson` carry the raw-source guarantee.
 */
export function parseStateCursor(raw: unknown): StateCursor {
  if (raw === null) return null;
  if (
    !isPlain(raw) ||
    Object.keys(raw).sort().join() !== "claim_state_event_id,event_sequence"
  )
    throw new ClaimStateError("cursor_shape");
  const sequence = raw.event_sequence;
  if (sequence instanceof LexicalNumber) {
    throw new ClaimStateError(
      sequence.kind === "unsafe_integer"
        ? "cursor_sequence_out_of_range"
        : "cursor_sequence_type",
    );
  }
  if (
    typeof sequence !== "number" ||
    !Number.isSafeInteger(sequence) ||
    Object.is(sequence, -0)
  )
    throw new ClaimStateError("cursor_sequence_type");
  if (sequence < 1) throw new ClaimStateError("cursor_sequence_not_positive");
  if (sequence > MAX_EVENT_SEQUENCE)
    throw new ClaimStateError("cursor_sequence_out_of_range");
  const id = raw.claim_state_event_id;
  if (typeof id !== "string" || !uuidV4.test(id))
    throw new ClaimStateError("cursor_shape", "claim_state_event_id");
  return { claim_state_event_id: id, event_sequence: sequence };
}

export interface CursorCheck {
  readonly claimId: string;
  readonly cursor: unknown;
  /** Every accepted event the caller knows (any claims): used to resolve the cursor's event identity. */
  readonly accepted: readonly ClaimStateEvent[];
  /** The rows visible to the freeze operation for this claim. */
  readonly visible: readonly ClaimStateEvent[];
  /** The rows the snapshot selected as the prefix. */
  readonly prefix: readonly ClaimStateEvent[];
}

function sameRows(
  a: readonly ClaimStateEvent[],
  b: readonly ClaimStateEvent[],
): boolean {
  return (
    a.length === b.length &&
    a.every((row, i) => {
      const other = b[i];
      return other !== undefined && sameEvent(row, other);
    })
  );
}

/**
 * Evidence Package 9.3: a non-null cursor names the SAME claim and the EXACT LAST event of the committed claim-local prefix
 * visible at freeze; `visible` and `prefix` must be exact accepted rows without duplicates; a later live event cannot serve as
 * an old cursor; `visible` must itself contain every accepted earlier event through its maximum. Error precedence mirrors the
 * shipped validator (Fixture v0.4.6 G28), which the 58 vectors pin. Throws {@link ClaimStateError}; returns normally on success.
 */
export function checkCursor(input: CursorCheck): void {
  const { claimId } = input;
  for (const [label, rows] of [
    ["visible", input.visible],
    ["prefix", input.prefix],
  ] as const) {
    for (const row of rows)
      if (row.claim_id !== claimId)
        throw new ClaimStateError(`${label}_row_not_claim_local`);
    if (
      new Set(rows.map((r) => r.claim_state_event_id)).size !== rows.length ||
      new Set(rows.map((r) => r.event_sequence)).size !== rows.length
    )
      throw new ClaimStateError(`duplicate_${label}_row`);
  }
  const visible = [...input.visible].sort(bySequence);
  const accepted = input.accepted
    .filter((e) => e.claim_id === claimId)
    .sort(bySequence);
  const last = visible.at(-1);
  if (last) {
    const want = accepted.filter(
      (e) => e.event_sequence <= last.event_sequence,
    );
    if (!sameRows(visible, want)) {
      const have = new Set(visible.map((e) => e.claim_state_event_id));
      throw new ClaimStateError(
        want.some((e) => !have.has(e.claim_state_event_id))
          ? "visible_omits_accepted_event"
          : "visible_row_not_an_accepted_row",
      );
    }
  }
  if (input.cursor === null) {
    if (visible.length > 0)
      throw new ClaimStateError("null_cursor_with_visible_events");
    if (input.prefix.length > 0)
      throw new ClaimStateError("null_cursor_with_nonempty_prefix");
    return;
  }
  const cursor = parseStateCursor(input.cursor);
  if (cursor === null) return;
  const event = input.accepted.find(
    (e) => e.claim_state_event_id === cursor.claim_state_event_id,
  );
  if (!event) throw new ClaimStateError("cursor_event_unknown");
  if (event.claim_id !== claimId)
    throw new ClaimStateError("cursor_wrong_claim");
  if (event.event_sequence !== cursor.event_sequence)
    throw new ClaimStateError("cursor_sequence_mismatch");
  if (!last) throw new ClaimStateError("cursor_with_empty_visibility");
  if (
    !visible.some((e) => e.claim_state_event_id === event.claim_state_event_id)
  )
    throw new ClaimStateError("cursor_not_in_visible_set");
  if (event.event_sequence !== last.event_sequence)
    throw new ClaimStateError("cursor_older_than_visible_event");
  const prefix = [...input.prefix].sort(bySequence);
  const want = visible.filter((e) => e.event_sequence <= cursor.event_sequence);
  if (!sameRows(prefix, want))
    throw new ClaimStateError(
      prefix.length < want.length &&
      prefix.every((p) => want.some((w) => sameEvent(p, w)))
        ? "omitted_prefix_event"
        : "prefix_row_differs_from_visible",
    );
}

export interface FrozenClaimEntry {
  readonly claim_id: string;
  readonly claim_content_hash: string;
  readonly initial_status: ClaimStatus;
  readonly initial_usage_class: UsageClass;
  readonly state_event_cursor: StateCursor;
  readonly frozen_state: ClaimStatus;
  readonly reduced_usage_class: UsageClass;
  readonly effective_usage_class: UsageClass;
  readonly frozen_state_hash: string;
}

export interface ClaimIdentity {
  readonly claim_id: string;
  readonly content_hash: string;
  readonly initial_status: unknown;
  readonly initial_usage_class: unknown;
}

/**
 * Freezes ONE claim from the visible log supplied (the caller's single snapshot): selects the whole visible log as the prefix,
 * sets the cursor to its last event (or null), reduces under the frozen-time `ceiling` and self-checks with `checkCursor`.
 * Freeze itself creates no claim state event.
 */
export function freezeClaimPrefix(
  claim: ClaimIdentity,
  visibleEvents: readonly unknown[],
  ceiling: UsageClass,
): FrozenClaimEntry {
  const initial = assertInitialState(claim);
  const log = assertAcceptedLogShape(
    claim.claim_id,
    visibleEvents.map(parseClaimStateEvent),
  );
  const tail = log.at(-1);
  const cursor: StateCursor = tail
    ? {
        claim_state_event_id: tail.claim_state_event_id,
        event_sequence: tail.event_sequence,
      }
    : null;
  checkCursor({
    claimId: claim.claim_id,
    cursor,
    accepted: log,
    visible: log,
    prefix: log,
  });
  const reduced = reduceClaimState(claim, log, { ceiling });
  return Object.freeze({
    claim_id: claim.claim_id,
    claim_content_hash: claim.content_hash,
    initial_status: initial.initial_status,
    initial_usage_class: initial.initial_usage_class,
    state_event_cursor: cursor === null ? null : Object.freeze(cursor),
    frozen_state: reduced.state,
    reduced_usage_class: reduced.reduced_usage_class,
    effective_usage_class: reduced.effective_usage_class,
    frozen_state_hash: frozenStateHash(claim.content_hash, reduced),
  });
}

/** The historical permission input: an explicit frozen-time ceiling, or an explicit statement that it is unavailable. */
export type FrozenCeiling = UsageClass | { readonly unavailable: true };

export interface FrozenVerification {
  /** What was independently verified, by name. */
  readonly verified: readonly string[];
  /** What could NOT be verified, with the reason. Always names the historical-visibility limit. */
  readonly limits: readonly string[];
  readonly live: ReducedClaimState & { readonly frozen_state_hash: string };
  /** Live reduction (current ceiling) differs from the frozen entry in status, effective usage or state hash. */
  readonly materialDifference: boolean;
  readonly liveEventsAfterCursor: number;
}

const entryKeys = [
  "claim_id",
  "claim_content_hash",
  "initial_status",
  "initial_usage_class",
  "state_event_cursor",
  "frozen_state",
  "reduced_usage_class",
  "effective_usage_class",
  "frozen_state_hash",
] as const;
const strictness: Record<UsageClass, number> = {
  assertable: 0,
  hedged_only: 1,
  silent: 2,
};

/**
 * Verifies a stored frozen claim entry against the immutable claim and the claim's CURRENT accepted log, then reports the live
 * difference. A later append (including a stricter live permission, supplied as `currentCeiling`) produces a material live
 * difference but never invalidates a historically consistent entry. Extra manifest keys (support refs, wording, ...) are ignored
 * here: they belong to the package builder. Throws {@link ClaimStateError} when the entry is internally inconsistent.
 */
export function verifyFrozenEntry(input: {
  entry: unknown;
  claim: ClaimIdentity;
  liveEvents: readonly unknown[];
  frozenCeiling: FrozenCeiling;
  currentCeiling: UsageClass;
}): FrozenVerification {
  const { claim } = input;
  const raw = input.entry;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    throw new ClaimStateError("entry_shape");
  const entry = raw as Record<string, unknown>;
  for (const key of entryKeys)
    if (!Object.hasOwn(entry, key))
      throw new ClaimStateError("entry_shape", key);
  const initial = assertInitialState(claim);
  const verified: string[] = [];
  const limits: string[] = [
    "historical_visibility_unprovable: rows carry no insertion/commit time and the entry stores only its cursor, so inclusion of every event visible at the freeze instant cannot be proved post hoc",
  ];
  if (entry.claim_id !== claim.claim_id)
    throw new ClaimStateError("entry_claim_mismatch");
  if (entry.claim_content_hash !== claim.content_hash)
    throw new ClaimStateError("entry_content_hash_mismatch");
  if (
    entry.initial_status !== initial.initial_status ||
    entry.initial_usage_class !== initial.initial_usage_class
  )
    throw new ClaimStateError("entry_initial_fields_mismatch");
  verified.push("claim identity and immutable initial fields");

  const live = assertAcceptedLogShape(
    claim.claim_id,
    input.liveEvents.map(parseClaimStateEvent),
  );
  const cursor = parseStateCursor(entry.state_event_cursor);
  let prefix: ClaimStateEvent[] = [];
  if (cursor !== null) {
    const named = live.find(
      (e) => e.claim_state_event_id === cursor.claim_state_event_id,
    );
    if (!named) throw new ClaimStateError("cursor_event_unknown");
    if (named.event_sequence !== cursor.event_sequence)
      throw new ClaimStateError("cursor_sequence_mismatch");
    prefix = live.filter((e) => e.event_sequence <= cursor.event_sequence);
    checkCursor({
      claimId: claim.claim_id,
      cursor,
      accepted: live,
      visible: prefix,
      prefix,
    });
    verified.push("cursor resolves to the exact last event of its prefix");
  } else {
    verified.push(
      "null cursor binds the empty prefix (valid regardless of later events)",
    );
  }

  const reduced = reduceClaimState(claim, prefix, { ceiling: "assertable" });
  if (
    entry.frozen_state !== reduced.state ||
    entry.reduced_usage_class !== reduced.reduced_usage_class
  )
    throw new ClaimStateError("entry_reduction_mismatch");
  verified.push(
    "frozen_state and reduced_usage_class equal the prefix reduction",
  );
  if (
    !isClaimStatus(entry.frozen_state) ||
    !isUsageClass(entry.effective_usage_class)
  )
    throw new ClaimStateError("entry_state_vocabulary");
  if (
    strictness[entry.effective_usage_class] <
    strictness[reduced.reduced_usage_class]
  )
    throw new ClaimStateError("entry_effective_less_strict_than_reduced");
  const expectedFrozenHash = frozenStateHash(claim.content_hash, {
    state: entry.frozen_state,
    reduced_usage_class: reduced.reduced_usage_class,
    effective_usage_class: entry.effective_usage_class,
  });
  if (entry.frozen_state_hash !== expectedFrozenHash)
    throw new ClaimStateError("entry_state_hash_mismatch");
  verified.push("frozen_state_hash matches the entry's own three fields");

  if (typeof input.frozenCeiling === "string") {
    const withCeiling = reduceClaimState(claim, prefix, {
      ceiling: input.frozenCeiling,
    });
    if (entry.effective_usage_class !== withCeiling.effective_usage_class)
      throw new ClaimStateError("entry_effective_usage_mismatch");
    verified.push(
      "effective_usage_class equals the reduction under the independently supplied frozen-time ceiling",
    );
  } else {
    limits.push(
      "frozen_ceiling_unavailable: effective_usage_class is only bounded below by the reduced usage; the historical permission input was not supplied, so the effective class (and the hash that depends on it) is not independently reproduced",
    );
  }

  const current = reduceClaimState(claim, live, {
    ceiling: input.currentCeiling,
  });
  const currentHash = frozenStateHash(claim.content_hash, current);
  const materialDifference =
    current.state !== entry.frozen_state ||
    current.effective_usage_class !== entry.effective_usage_class ||
    currentHash !== entry.frozen_state_hash;
  return {
    verified,
    limits,
    live: { ...current, frozen_state_hash: currentHash },
    materialDifference,
    liveEventsAfterCursor: live.filter(
      (e) => e.event_sequence > (cursor?.event_sequence ?? 0),
    ).length,
  };
}
