// Read-only claim log boundary (A3). Claims and their events are read in ONE SQL statement so every requested claim and every
// event in the result comes from a single database snapshot (a single statement sees one snapshot even at READ COMMITTED).
// No separate claim-row query exists. Claims with zero events are preserved (LEFT JOIN); a requested claim that does not exist
// is an error; every claim's stored content hash is recomputed from its immutable fields and compared.
//
// Why a single-statement read is a consistent prefix: the Migration 002 guard serializes appenders per claim with an advisory
// lock held to commit and PostgreSQL makes a commit visible before releasing its locks, so per claim commit order equals
// sequence order and any one snapshot sees a sequence-prefix. No lock is taken here and no row is written.
import { claimContentHash } from "../identity/knowledge.js";
import {
  ClaimStateError,
  assertAcceptedLogShape,
  isCanonicalUuid,
  parseClaimStateEvent,
  type ClaimStateEvent,
  type UsageClass,
  isUsageClass,
} from "./claim-state.js";
import { freezeClaimPrefix, type FrozenClaimEntry } from "./state-cursor.js";

/** A pg Pool, PoolClient or Client (any isolation level; reads only). */
export interface Queryable {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface ClaimRecord {
  readonly claim_id: string;
  readonly content_hash: string;
  readonly claim_kind: unknown;
  readonly origin: unknown;
  readonly subject_domain: unknown;
  readonly subject: unknown;
  readonly predicate: unknown;
  readonly value: unknown;
  readonly initial_status: unknown;
  readonly initial_usage_class: unknown;
  readonly asserted_at: string | null;
}

export interface ClaimLog {
  readonly claim: ClaimRecord;
  /** The claim's accepted events in sequence order (possibly empty). */
  readonly events: readonly ClaimStateEvent[];
}

export const claimLogStatement = `SELECT c.claim_id, c.content_hash, c.claim_kind, c.origin, c.subject_domain, c.subject, c.predicate, c.value,
       c.initial_status, c.initial_usage_class, c.asserted_at,
       e.claim_state_event_id, e.claim_id AS event_claim_id, e.actor_id, e.occurred_at, e.event_type, e.event_sequence, e.event_payload
  FROM claims c
  LEFT JOIN claim_state_events e ON e.claim_id = c.claim_id
 WHERE c.claim_id = ANY($1::uuid[])
 ORDER BY c.claim_id, e.event_sequence`;

function semanticInstant(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().replace(/\.000Z$/, "Z");
  if (typeof v === "string") return v;
  throw new ClaimStateError("claim_asserted_at_invalid");
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new ClaimStateError("internal_missing", what);
  return value;
}

/** Reads the requested claims and their events from one snapshot. Returned in the requested order. */
export async function readClaimLogs(
  db: Queryable,
  claimIds: readonly string[],
): Promise<ClaimLog[]> {
  const requested = [...new Set(claimIds)];
  if (requested.length === 0 || requested.length !== claimIds.length)
    throw new ClaimStateError(
      "claim_request_invalid",
      "empty or duplicate claim ids",
    );
  for (const id of requested)
    if (!isCanonicalUuid(id))
      throw new ClaimStateError("claim_request_invalid", id);
  const result = await db.query(claimLogStatement, [requested]);
  const claims = new Map<string, ClaimRecord>();
  const events = new Map<string, ClaimStateEvent[]>();
  for (const row of result.rows) {
    const id = String(row.claim_id);
    if (!claims.has(id)) {
      const claim: ClaimRecord = {
        claim_id: id,
        content_hash: String(row.content_hash),
        claim_kind: row.claim_kind,
        origin: row.origin,
        subject_domain: row.subject_domain,
        subject: row.subject,
        predicate: row.predicate,
        value: row.value,
        initial_status: row.initial_status,
        initial_usage_class: row.initial_usage_class,
        asserted_at: semanticInstant(row.asserted_at),
      };
      if (claimContentHash(claim) !== claim.content_hash)
        throw new ClaimStateError("claim_content_hash_mismatch", id);
      claims.set(id, claim);
      events.set(id, []);
    }
    if (typeof row.claim_state_event_id === "string") {
      if (row.event_claim_id !== row.claim_id)
        throw new ClaimStateError(
          "event_wrong_claim",
          row.claim_state_event_id,
        );
      must(events.get(id), "event list").push(
        parseClaimStateEvent({
          claim_state_event_id: row.claim_state_event_id,
          claim_id: row.event_claim_id,
          actor_id: row.actor_id,
          occurred_at: row.occurred_at,
          event_type: row.event_type,
          event_sequence: row.event_sequence,
          event_payload: row.event_payload,
        }),
      );
    }
  }
  const missing = requested.filter((id) => !claims.has(id));
  if (missing.length > 0)
    throw new ClaimStateError("claim_not_found", missing.join(","));
  return requested.map((id) => {
    const claim = must(claims.get(id), "claim");
    return {
      claim,
      events: assertAcceptedLogShape(id, events.get(id) ?? []),
    };
  });
}

/**
 * Freezes every requested claim from the SAME snapshot. `ceilings` is required for every requested claim (frozen-time
 * external usage ceilings; this module derives none). Read-only: freeze creates no claim state event.
 */
export async function freezeClaims(
  db: Queryable,
  claimIds: readonly string[],
  ceilings: Readonly<Record<string, UsageClass>>,
): Promise<FrozenClaimEntry[]> {
  const extra = Object.keys(ceilings).filter((id) => !claimIds.includes(id));
  if (extra.length > 0)
    throw new ClaimStateError("ceiling_for_unrequested_claim", extra.join(","));
  for (const id of claimIds) {
    const ceiling = ceilings[id];
    if (!isUsageClass(ceiling))
      throw new ClaimStateError("ceiling_missing", id);
  }
  const logs = await readClaimLogs(db, claimIds);
  return logs.map(({ claim, events }) =>
    freezeClaimPrefix(claim, events, must(ceilings[claim.claim_id], "ceiling")),
  );
}
