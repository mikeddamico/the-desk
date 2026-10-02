// A5.1 claim-state event append (Claims 4.4.2; Hashing 13, 14.3; vectors CE-RT01-04, CE-T01).
// Contract (supervisory adjudication): the caller supplies the authored event UUID, fixed actor / occurred_at / payload and an
// EXPLICIT sequence. Retry = resend the identical request. All seven immutable columns are compared IN SQL, so microsecond
// differences are visible (A3's Date-normalized `sameEvent` is a reducer comparison, not a retry-identity comparison).
// A head read does not reserve a sequence: concurrent explicit-sequence appends may reject stale inputs. After an ambiguous
// acknowledgement the caller resends the identical request or looks the UUID up; it never assigns the UUID another sequence.
import type { Pool } from "pg";

import {
  ClaimStateError,
  parseClaimStateEvent,
} from "../knowledge/claim-state.js";
import {
  assertJson,
  faultPoint,
  isUnique,
  Rejection,
  requireTimestamp,
  requireUuid,
  rethrow,
  runCommand,
  utcText,
  type Json,
  type Outcome,
  type Row,
  type Tx,
} from "./command.js";

const CLAIM_LOCK_CLASS = 182736452; // Migration 002 guard_claim_event_order (same re-entrant per-claim advisory lock)

export interface AuthoredClaimEvent {
  claim_state_event_id: string;
  claim_id: string;
  actor_id: string;
  /** RFC 3339, 0-6 fractional digits; inserted and compared exactly as authored. */
  occurred_at: string;
  event_type: string;
  event_sequence: number;
  event_payload: Json;
}

export interface StoredClaimEvent {
  claim_state_event_id: string;
  claim_id: string;
  actor_id: string;
  /** UTC with six fractional digits. */
  occurred_at: string;
  event_type: string;
  event_sequence: number;
  event_payload: Json;
}

const selectStored = `SELECT claim_state_event_id::text, claim_id::text, actor_id::text, event_type, event_sequence,
  ${utcText("occurred_at")} AS occurred_at, event_payload FROM claim_state_events`;

const toStored = (r: Row): StoredClaimEvent => ({
  claim_state_event_id: r.claim_state_event_id as string,
  claim_id: r.claim_id as string,
  actor_id: r.actor_id as string,
  occurred_at: r.occurred_at as string,
  event_type: r.event_type as string,
  event_sequence: r.event_sequence as number,
  event_payload: r.event_payload as Json,
});

/** A3 validation of everything except the instant (A3 keeps only milliseconds); returns the payload A3 normalized. */
function validate(e: AuthoredClaimEvent): {
  event: AuthoredClaimEvent;
  payload: Json;
} {
  const occurred = requireTimestamp(e.occurred_at, "occurred_at");
  requireUuid(e.claim_state_event_id, "claim_state_event_id");
  let parsed;
  try {
    parsed = parseClaimStateEvent({
      ...e,
      occurred_at: new Date(Date.parse(occurred)).toISOString(),
    });
  } catch (error) {
    if (error instanceof ClaimStateError)
      throw Object.assign(new Error(error.message), { claimCode: error.code });
    throw error;
  }
  const payload = assertJson(parsed.event_payload, "event_payload");
  return {
    event: {
      claim_state_event_id: parsed.claim_state_event_id,
      claim_id: parsed.claim_id,
      actor_id: parsed.actor_id,
      occurred_at: occurred,
      event_type: parsed.event_type,
      event_sequence: parsed.event_sequence,
      event_payload: payload,
    },
    payload,
  };
}

async function compareStored(
  tx: Tx,
  e: AuthoredClaimEvent,
): Promise<Outcome<StoredClaimEvent> | undefined> {
  const found = await tx.query(
    `${selectStored.replace(
      "FROM claim_state_events",
      `, (claim_id = $2::uuid) AS same_claim, (actor_id = $3::uuid) AS same_actor,
      (event_type = $4) AS same_type, (event_sequence = $5::int) AS same_sequence,
      (occurred_at = $6::timestamptz) AS same_time, (event_payload = $7::jsonb) AS same_payload FROM claim_state_events`,
    )}
     WHERE claim_state_event_id = $1::uuid`,
    [
      e.claim_state_event_id,
      e.claim_id,
      e.actor_id,
      e.event_type,
      e.event_sequence,
      e.occurred_at,
      JSON.stringify(e.event_payload),
    ],
  );
  const row = found.rows[0];
  if (!row) return undefined;
  const stored = toStored(row);
  const same = (k: string): boolean => row[k] === true;
  if (
    same("same_claim") &&
    same("same_actor") &&
    same("same_type") &&
    same("same_sequence") &&
    same("same_time") &&
    same("same_payload")
  )
    return { kind: "converged", record: stored };
  // Classification follows the conformance model: a different claim, type or payload is an identity conflict; the same
  // content with a different sequence/actor/instant is a duplicate-transition attempt (CE-RT02).
  const identity =
    !same("same_claim") || !same("same_type") || !same("same_payload");
  const differs = [
    !same("same_claim") && "claim_id",
    !same("same_actor") && "actor_id",
    !same("same_type") && "event_type",
    !same("same_sequence") && "event_sequence",
    !same("same_time") && "occurred_at",
    !same("same_payload") && "event_payload",
  ].filter(Boolean);
  return {
    kind: "conflict",
    code: identity
      ? "duplicate_event_identity_conflict"
      : "retry_duplicate_transition",
    stored,
    detail: `differs in ${differs.join(",")}`,
  };
}

export async function appendClaimStateEvent(
  pool: Pool,
  authored: AuthoredClaimEvent,
): Promise<Outcome<StoredClaimEvent>> {
  let event: AuthoredClaimEvent;
  try {
    event = validate(authored).event;
  } catch (error) {
    const code = (error as { claimCode?: string }).claimCode;
    if (code)
      return { kind: "rejected", code, detail: (error as Error).message };
    if (error instanceof Rejection)
      return { kind: "rejected", code: error.code, detail: error.message };
    throw error;
  }
  return runCommand(pool, async (tx) => {
    // The guard's own lock first (re-entrant: the guard takes it again), so the identity lookup, the head read and the insert are
    // one serialized step per claim.
    await tx.query("SELECT pg_advisory_xact_lock($1, hashtext($2::text))", [
      CLAIM_LOCK_CLASS,
      event.claim_id,
    ]);
    await faultPoint("mid_transaction_holding_lock");
    const prior = await compareStored(tx, event);
    if (prior) return prior;
    return insertNew(tx, event);
  });
}

async function insertNew(
  tx: Tx,
  event: AuthoredClaimEvent,
): Promise<Outcome<StoredClaimEvent>> {
  const refs = await tx.query(
    `SELECT EXISTS (SELECT 1 FROM claims WHERE claim_id = $1::uuid) AS claim,
            EXISTS (SELECT 1 FROM accounts WHERE account_id = $2::uuid) AS actor`,
    [event.claim_id, event.actor_id],
  );
  if (refs.rows[0]?.claim !== true)
    return { kind: "rejected", code: "claim_not_found" };
  if (refs.rows[0].actor !== true)
    return { kind: "rejected", code: "actor_not_found" };
  const head = await tx.query(
    "SELECT max(event_sequence) AS head FROM claim_state_events WHERE claim_id = $1::uuid",
    [event.claim_id],
  );
  const max = head.rows[0]?.head as number | null | undefined;
  if (max === null || max === undefined) {
    if (event.event_sequence !== 1)
      return { kind: "rejected", code: "first_sequence_not_one" };
  } else if (event.event_sequence <= max)
    return {
      kind: "rejected",
      code: "sequence_not_above_head",
      detail: `head ${String(max)}`,
    };
  const insert = await tx.attempt(
    `INSERT INTO claim_state_events (claim_state_event_id, claim_id, event_type, event_payload, actor_id, occurred_at, event_sequence)
     VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5::uuid, $6::timestamptz, $7::int)
     RETURNING claim_state_event_id::text, claim_id::text, actor_id::text, event_type, event_sequence, ${utcText("occurred_at")} AS occurred_at, event_payload`,
    [
      event.claim_state_event_id,
      event.claim_id,
      event.event_type,
      JSON.stringify(event.event_payload),
      event.actor_id,
      event.occurred_at,
      event.event_sequence,
    ],
  );
  if (insert.ok) {
    const row = insert.rows[0];
    if (!row) throw new Error("insert returned no row");
    return { kind: "created", record: toStored(row) };
  }
  // Savepoint already rolled back: the transaction is usable and a fresh statement sees the winner.
  if (isUnique(insert.error, "claim_state_events_pkey")) {
    // The UUID was taken between the lookup and the insert (a writer for a DIFFERENT claim holds a different advisory lock).
    const winner = await compareStored(tx, event);
    if (winner) return winner;
  }
  if (isUnique(insert.error, "claim_state_events_claim_id_event_sequence_key"))
    return {
      kind: "rejected",
      code: "sequence_not_above_head",
      sqlstate: "23505",
    };
  if (insert.error.code === "23514")
    return {
      kind: "rejected",
      code: "guard_rejected",
      detail: insert.error.message,
      sqlstate: "23514",
    };
  return rethrow(insert.error);
}

/** The accepted head. NOT a reservation: another writer may append before the caller does. */
export async function readClaimLogHead(
  pool: Pool,
  claimId: string,
): Promise<{ maxSequence: number | null }> {
  requireUuid(claimId, "claim_id");
  const r = await pool.query(
    "SELECT max(event_sequence) AS head FROM claim_state_events WHERE claim_id = $1::uuid",
    [claimId],
  );
  const head = (r.rows[0] as Row | undefined)?.head;
  return { maxSequence: typeof head === "number" ? head : null };
}

/** The ambiguity protocol: after a lost acknowledgement, look the authored UUID up (or resend the identical request). */
export async function lookupClaimEvent(
  pool: Pool,
  id: string,
): Promise<StoredClaimEvent | null> {
  requireUuid(id, "claim_state_event_id");
  const r = await pool.query(
    `${selectStored} WHERE claim_state_event_id = $1::uuid`,
    [id],
  );
  const row = r.rows[0] as Row | undefined;
  return row ? toStored(row) : null;
}
