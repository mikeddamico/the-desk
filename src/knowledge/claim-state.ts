// Claim state events and the reducer (A3). Owners: Claims Policy v0.1.2 section 4.4 (statuses, reducer table, order and append
// invariant), Hashing v0.1.5 section 12.1 / Claims 4.4.3 (the three-field frozen-state projection, reused from A1) and Evidence
// Package v0.2.2 section 9.3 (prefix freeze, in state-cursor.ts).
//
// Pure: no filesystem, database or environment. Reduction order is `event_sequence` ONLY; UUID order, input array order and
// `occurred_at` never influence a result. The effective usage class is the explicit `ceiling` input combined with the reduced
// usage by the strictest rule; this module maps no status, support, rights, exposure or sensitivity to a restriction and is not
// a permissions engine (authority gap G1: no active owner defines such a mapping).
import { canonicalJson } from "../identity/canonical-json.js";
import {
  claimFrozenStateHash,
  claimStatuses,
  usageClasses,
} from "../identity/knowledge.js";
import { LexicalNumber } from "./lexical-json.js";

export type ClaimStatus = (typeof claimStatuses)[number];
export type UsageClass = (typeof usageClasses)[number];

export const claimEventTypes = [
  "confirm",
  "contest",
  "demote",
  "supersede",
  "expire",
  "tombstone",
  "usage_change",
] as const;
export type ClaimEventType = (typeof claimEventTypes)[number];

/** Claims 4.4.1: the status each non-usage event sets. `usage_change` preserves status. */
const statusFor: Record<
  Exclude<ClaimEventType, "usage_change">,
  ClaimStatus
> = {
  confirm: "confirmed",
  contest: "contested",
  demote: "demoted",
  supersede: "superseded",
  expire: "expired",
  tombstone: "tombstoned",
};

/** The `integer` column maximum; the sequence is a PostgreSQL `integer`. */
export const MAX_EVENT_SEQUENCE = 2147483647;

/** Restrictiveness order: a larger index is stricter. */
const strictness: Record<UsageClass, number> = {
  assertable: 0,
  hedged_only: 1,
  silent: 2,
};

export class ClaimStateError extends Error {
  readonly code: string;
  constructor(code: string, detail = "") {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "ClaimStateError";
    this.code = code;
  }
}

export interface ClaimStateEvent {
  readonly claim_state_event_id: string;
  readonly claim_id: string;
  readonly actor_id: string;
  /** Canonical UTC instant (ISO-8601 `Z`). Provenance only: it never orders, filters or deduplicates anything. */
  readonly occurred_at: string;
  readonly event_type: ClaimEventType;
  readonly event_sequence: number;
  readonly event_payload: Readonly<Record<string, unknown>>;
}

export interface ReducedClaimState {
  readonly state: ClaimStatus;
  readonly reduced_usage_class: UsageClass;
  readonly effective_usage_class: UsageClass;
}

// Claims 4.4.2 / Evidence Package 9.3 require LITERAL UUIDs: the canonical lowercase 8-4-4-4-12 hexadecimal form. No active
// requirement restricts the version or variant (the "canonical v4" statements in the Trace describe Fixture content and the
// predecessor validator, not a rule for events), so none is imposed here.
const canonicalUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isCanonicalUuid = (v: unknown): v is string =>
  typeof v === "string" && canonicalUuid.test(v);
const eventKeys = [
  "claim_state_event_id",
  "claim_id",
  "actor_id",
  "occurred_at",
  "event_type",
  "event_sequence",
  "event_payload",
] as const;
const instant =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" &&
  v !== null &&
  !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype ||
    Object.getPrototypeOf(v) === null);

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export const isUsageClass = (v: unknown): v is UsageClass =>
  typeof v === "string" && (usageClasses as readonly string[]).includes(v);
export const isClaimStatus = (v: unknown): v is ClaimStatus =>
  typeof v === "string" && (claimStatuses as readonly string[]).includes(v);

/** Validates a claim's immutable initial fields (Claims 4.4: six statuses, three usage classes). */
export function assertInitialState(initial: {
  initial_status: unknown;
  initial_usage_class: unknown;
}): { initial_status: ClaimStatus; initial_usage_class: UsageClass } {
  if (!isClaimStatus(initial.initial_status))
    throw new ClaimStateError("invalid_initial_status");
  if (!isUsageClass(initial.initial_usage_class))
    throw new ClaimStateError("invalid_initial_usage_class");
  return {
    initial_status: initial.initial_status,
    initial_usage_class: initial.initial_usage_class,
  };
}

/**
 * Validates one event row (the seven `claim_state_events` columns, exact key set). Accepts a database row (`occurred_at` as a
 * Date) or a JSON object. A `LexicalNumber`, boolean, string or float sequence is rejected as `sequence_not_integer`; a
 * non-positive one as `sequence_not_positive`; one above the `integer` column as `sequence_out_of_range`.
 */
export function parseClaimStateEvent(raw: unknown): ClaimStateEvent {
  if (!isPlain(raw)) throw new ClaimStateError("invalid_event_shape");
  const keys = Object.keys(raw).sort();
  if (
    keys.length !== eventKeys.length ||
    keys.join() !== [...eventKeys].sort().join()
  )
    throw new ClaimStateError("invalid_event_shape", keys.join(","));
  for (const key of ["claim_state_event_id", "claim_id", "actor_id"] as const) {
    const id = raw[key];
    if (!isCanonicalUuid(id))
      throw new ClaimStateError("invalid_event_identity", key);
  }
  const type = raw.event_type;
  if (
    typeof type !== "string" ||
    !(claimEventTypes as readonly string[]).includes(type)
  )
    throw new ClaimStateError("invalid_payload", "unknown event_type");
  const payload = raw.event_payload;
  if (!isPlain(payload))
    throw new ClaimStateError(
      "invalid_payload",
      "event_payload is not an object",
    );
  for (const field of ["reason_code", "reason"] as const) {
    const value = payload[field];
    if (typeof value !== "string" || value.trim().length === 0)
      throw new ClaimStateError("invalid_payload", `${field} missing`);
  }
  if (type === "usage_change" && !isUsageClass(payload.usage_class))
    throw new ClaimStateError(
      "invalid_payload",
      "usage_change without a valid usage_class",
    );
  const normalized = normalizePayloadValue(
    payload,
    "event_payload",
    0,
  ) as Record<string, unknown>;
  const sequence = raw.event_sequence;
  if (
    sequence instanceof LexicalNumber ||
    typeof sequence !== "number" ||
    !Number.isSafeInteger(sequence) ||
    Object.is(sequence, -0)
  )
    throw new ClaimStateError("sequence_not_integer");
  if (sequence <= 0) throw new ClaimStateError("sequence_not_positive");
  if (sequence > MAX_EVENT_SEQUENCE)
    throw new ClaimStateError("sequence_out_of_range");
  const at = raw.occurred_at;
  let occurred: string;
  if (at instanceof Date && !Number.isNaN(at.getTime()))
    occurred = at.toISOString();
  else if (
    typeof at === "string" &&
    instant.test(at) &&
    !Number.isNaN(Date.parse(at))
  )
    occurred = new Date(Date.parse(at)).toISOString();
  else throw new ClaimStateError("invalid_occurred_at");
  return deepFreeze({
    claim_state_event_id: raw.claim_state_event_id as string,
    claim_id: raw.claim_id as string,
    actor_id: raw.actor_id as string,
    occurred_at: occurred,
    event_type: type as ClaimEventType,
    event_sequence: sequence,
    event_payload: normalized,
  });
}

/**
 * The event_payload number boundary (governed JSON policy: semantic numbers are safe integers; exact decimals are strings, as in
 * the A1 canonical serializer). Applied BEFORE the payload is copied, so a lexical marker can never be laundered into an
 * ordinary-looking object:
 * - an integer-valued marker (`1e0`, `1.0`, `-1E1`) becomes the number it denotes, exactly what `JSON.parse` and PostgreSQL
 *   jsonb give for the same source, so lexical-source and native-source events are equal and hash alike;
 * - any other number (`1.5`, an unsafe integer, `-0`, a non-finite value) and any non-JSON value is rejected as invalid_payload.
 * Sequence and cursor values are NOT normalized: they stay strict (see parseClaimStateEvent and parseStateCursor).
 */
function normalizePayloadValue(
  value: unknown,
  path: string,
  depth: number,
): unknown {
  if (depth > 64)
    throw new ClaimStateError("invalid_payload", `${path} nested too deeply`);
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (value instanceof LexicalNumber) {
    const n = Number(value.lexeme);
    if (
      value.kind === "non_integer_lexeme" &&
      Number.isSafeInteger(n) &&
      !Object.is(n, -0)
    )
      return n;
    throw new ClaimStateError(
      "invalid_payload",
      `${path} is a number the governed JSON policy does not accept (${value.lexeme})`,
    );
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0))
      throw new ClaimStateError(
        "invalid_payload",
        `${path} is not a safe integer`,
      );
    return value;
  }
  if (Array.isArray(value))
    return value.map((item, i) =>
      normalizePayloadValue(item, `${path}[${String(i)}]`, depth + 1),
    );
  if (isPlain(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value))
      Object.defineProperty(out, key, {
        value: normalizePayloadValue(child, `${path}.${key}`, depth + 1),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    return out;
  }
  throw new ClaimStateError("invalid_payload", `${path} is not a JSON value`);
}

/** Row equality for cursor/visibility comparison: every column, jsonb payload by canonical value, time by instant. */
export function sameEvent(a: ClaimStateEvent, b: ClaimStateEvent): boolean {
  return (
    a.claim_state_event_id === b.claim_state_event_id &&
    a.claim_id === b.claim_id &&
    a.actor_id === b.actor_id &&
    a.event_type === b.event_type &&
    a.event_sequence === b.event_sequence &&
    Date.parse(a.occurred_at) === Date.parse(b.occurred_at) &&
    canonicalJson(a.event_payload) === canonicalJson(b.event_payload)
  );
}

export const bySequence = (a: ClaimStateEvent, b: ClaimStateEvent): number =>
  a.event_sequence - b.event_sequence;

/**
 * Claims 4.4.2 as observable from rows: unique, positive sequences, the first being 1, ascending (gaps above the maximum are
 * allowed); one claim only; unique event identities. Commit order is not observable from rows; the database guard owns it.
 * Returns the events in sequence order.
 */
export function assertAcceptedLogShape(
  claimId: string,
  events: readonly ClaimStateEvent[],
): ClaimStateEvent[] {
  const sorted = [...events].sort(bySequence);
  const ids = new Set<string>();
  let previous = 0;
  for (const event of sorted) {
    if (event.claim_id !== claimId)
      throw new ClaimStateError(
        "event_wrong_claim",
        event.claim_state_event_id,
      );
    if (ids.has(event.claim_state_event_id))
      throw new ClaimStateError(
        "duplicate_event_identity",
        event.claim_state_event_id,
      );
    ids.add(event.claim_state_event_id);
    if (event.event_sequence === previous)
      throw new ClaimStateError(
        "duplicate_sequence",
        String(event.event_sequence),
      );
    if (previous === 0 && event.event_sequence !== 1)
      throw new ClaimStateError(
        "log_first_sequence_not_one",
        String(event.event_sequence),
      );
    previous = event.event_sequence;
  }
  return sorted;
}

export interface ReduceOptions {
  /** REQUIRED external usage ceiling (frozen-time or current: the caller decides which). Never inferred from any entry. */
  readonly ceiling: UsageClass;
  /** Reduce only events with `event_sequence <= through`. Never a substitute for cursor validation. */
  readonly through?: number;
}

/**
 * Claims 4.4.1. `events` is the claim's complete accepted log (any input order; every row is re-validated). Status and usage
 * start at the claim's initial fields; events apply in ascending `event_sequence`; the effective class is the stricter of the
 * reduced usage and the explicit ceiling.
 */
export function reduceClaimState(
  claim: {
    claim_id: string;
    initial_status: unknown;
    initial_usage_class: unknown;
  },
  events: readonly unknown[],
  options: ReduceOptions,
): ReducedClaimState {
  const initial = assertInitialState(claim);
  if (!isUsageClass(options.ceiling))
    throw new ClaimStateError("invalid_ceiling");
  if (
    options.through !== undefined &&
    !(Number.isSafeInteger(options.through) && options.through >= 1)
  )
    throw new ClaimStateError("invalid_through");
  const log = assertAcceptedLogShape(
    claim.claim_id,
    events.map(parseClaimStateEvent),
  );
  let state = initial.initial_status;
  let usage = initial.initial_usage_class;
  for (const event of log) {
    if (options.through !== undefined && event.event_sequence > options.through)
      break;
    if (event.event_type === "usage_change")
      usage = event.event_payload.usage_class as UsageClass;
    else state = statusFor[event.event_type];
  }
  const effective =
    strictness[usage] >= strictness[options.ceiling] ? usage : options.ceiling;
  return {
    state,
    reduced_usage_class: usage,
    effective_usage_class: effective,
  };
}

/** `claim-frozen-state-v1` over a reduction (A1 hashing; exactly three fields, no actor/time/reason/cursor). */
export function frozenStateHash(
  claimContentHash: string,
  reduced: ReducedClaimState,
): string {
  return claimFrozenStateHash({
    claim_content_hash: claimContentHash,
    state: reduced.state,
    effective_usage_class: reduced.effective_usage_class,
  });
}
