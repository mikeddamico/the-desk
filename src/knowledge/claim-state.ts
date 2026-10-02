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

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
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
    if (typeof id !== "string" || !uuidV4.test(id))
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
    event_payload: structuredClone(payload),
  });
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
