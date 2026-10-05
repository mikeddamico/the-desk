// A5.2 provider-call commands: reservation, outcome, reconciliation and a bounded execute helper over the EXISTING provider_calls /
// provider_call_events tables and runtime privileges (no migration, no lease table, no new dependency).
//
// SAFETY CONTRACT (supervisory correction to the A5 r2 plan, section 4.5)
// - ONLY the worker whose own COMMITTED reservation command returned `created` may call `adapter.perform`. A reservation that
//   `converged` (same authored id, whatever the stored outcome) or is `held_by_other` NEVER grants execution: two recoverers can both
//   observe "no outcome", and a shared reservation is not an execution lease.
// - There is NO automatic takeover, TTL/lease, implicit retryable failure or new try from an unfinished call. An unfinished call stays
//   unfinished until a DURABLE outcome is recorded explicitly. This is an intentional AVAILABILITY LIMITATION: if the creating worker
//   dies before recording an outcome, the logical slot is stuck until an operator-governed decision (outside this tranche) resolves it.
// - A `perform` that throws or times out is AMBIGUOUS (the provider may have acted). It is never converted into a retryable failure;
//   only an outcome the adapter RETURNS as governed evidence may be recorded, by the caller's `finish`.
// - Reconciliation never performs. `performed` requires adapter evidence bound to THIS reservation (logical key, request fingerprint,
//   provider call id); it may enable an explicit `recordProviderOutcome` of that existing outcome. No lookup, a failed lookup, `unknown`
//   or `not_performed` leave the reservation safely unfinished.
// - The reservation commits BEFORE any side effect (separate command / transaction).
// Costs are exact decimal TEXT (never a JS number). Equality follows the column: `actual_cost` is `numeric`, so "1.5" and "1.50" are
// the SAME value (PostgreSQL numeric equality) while the stored scale is whatever the first writer's text had; a converged retry returns
// the STORED text. Lexical forms the grammar does not admit (exponent, sign, leading zeros) are rejected, never normalized.
import type { Pool } from "pg";

import {
  assertJson,
  emitPreflight,
  faultPoint,
  isUnique,
  Rejection,
  requireTimestamp,
  requireUuid,
  rethrow,
  runCommand,
  utcText,
  type DbError,
  type Json,
  type Outcome,
  type Row,
  type Tx,
} from "./command.js";
import {
  peek,
  KNOWN_OUTCOME_CODES,
  readContext,
  readAttemptRun,
  safeEmit,
  stageContext,
  type AttemptRun,
  type CommandContext,
  type CommandTrace,
  type CommandEvent,
  type Durability,
  type ObserverContext,
  type RawEvent,
} from "./observe.js";

const uuidOrNull = (v: unknown, what: string): string | null =>
  v === null ? null : requireUuid(v, what);

export interface AuthoredReservation {
  provider_call_id: string;
  attempt_id: string;
  provider: string;
  operation: string;
  model_identifier: string;
  request_fingerprint: string;
  logical_request_key: string;
  operational_try_number: number;
  intentional_take_index: number | null;
  retry_of_provider_call_id: string | null;
  reroll_of_provider_call_id: string | null;
  reroll_trigger_id: string | null;
  /** RFC 3339, 0-6 fractional digits; inserted and compared exactly as authored. */
  started_at: string;
}

export type StoredReservation = AuthoredReservation;

export type OutcomeType =
  | "succeeded"
  | "retryable_failure"
  | "terminal_failure";

export interface AuthoredOutcome {
  provider_call_id: string;
  event_type: OutcomeType;
  ended_at: string;
  usage: Json;
  /** Exact decimal text, e.g. "0.0123"; null together with `currency`. */
  actual_cost: string | null;
  currency: string | null;
  response_artifact_id: string | null;
  response_reference: string | null;
}

export type StoredOutcome = AuthoredOutcome;

export interface ReservationRecord {
  reservation: StoredReservation;
  /** The durable outcome of the call, if any. */
  outcome: StoredOutcome | null;
}

const RESERVATION_COLUMNS = `c.provider_call_id::text AS provider_call_id, c.attempt_id::text AS attempt_id, c.provider, c.operation,
  c.model_identifier, c.request_fingerprint, c.logical_request_key, c.operational_try_number, c.intentional_take_index,
  c.retry_of_provider_call_id::text AS retry_of_provider_call_id, c.reroll_of_provider_call_id::text AS reroll_of_provider_call_id,
  c.reroll_trigger_id::text AS reroll_trigger_id, ${utcText("c.started_at")} AS started_at`;
const OUTCOME_COLUMNS = `e.provider_call_id::text AS provider_call_id, e.event_type, ${utcText("e.ended_at")} AS ended_at, e.usage,
  e.actual_cost::text AS actual_cost, e.currency, e.response_artifact_id::text AS response_artifact_id, e.response_reference`;

const toReservation = (r: Row): StoredReservation => ({
  provider_call_id: r.provider_call_id as string,
  attempt_id: r.attempt_id as string,
  provider: r.provider as string,
  operation: r.operation as string,
  model_identifier: r.model_identifier as string,
  request_fingerprint: r.request_fingerprint as string,
  logical_request_key: r.logical_request_key as string,
  operational_try_number: r.operational_try_number as number,
  intentional_take_index: r.intentional_take_index as number | null,
  retry_of_provider_call_id: r.retry_of_provider_call_id as string | null,
  reroll_of_provider_call_id: r.reroll_of_provider_call_id as string | null,
  reroll_trigger_id: r.reroll_trigger_id as string | null,
  started_at: r.started_at as string,
});
const toOutcome = (r: Row): StoredOutcome => ({
  provider_call_id: r.provider_call_id as string,
  event_type: r.event_type as OutcomeType,
  ended_at: r.ended_at as string,
  usage: r.usage as Json,
  actual_cost: r.actual_cost as string | null,
  currency: r.currency as string | null,
  response_artifact_id: r.response_artifact_id as string | null,
  response_reference: r.response_reference as string | null,
});

// ---- validation ----------------------------------------------------------------------------------------------------------
const fingerprintRe = /^(v1:)?[0-9a-f]{64}$/;
const intIn = (v: unknown, what: string, min: number): number => {
  if (
    typeof v !== "number" ||
    !Number.isSafeInteger(v) ||
    v < min ||
    v > 2147483647
  )
    throw new Rejection("invalid_integer", what);
  return v;
};
const nonEmpty = (v: unknown, what: string): string => {
  if (typeof v !== "string" || v.length === 0)
    throw new Rejection("invalid_string", what);
  return v;
};

function validateReservation(r: AuthoredReservation): AuthoredReservation {
  const out: AuthoredReservation = {
    provider_call_id: requireUuid(r.provider_call_id, "provider_call_id"),
    attempt_id: requireUuid(r.attempt_id, "attempt_id"),
    provider: nonEmpty(r.provider, "provider"),
    operation: nonEmpty(r.operation, "operation"),
    model_identifier: (() => {
      if (typeof r.model_identifier !== "string")
        throw new Rejection("invalid_string", "model_identifier");
      return r.model_identifier;
    })(),
    request_fingerprint: (() => {
      if (
        typeof r.request_fingerprint !== "string" ||
        !fingerprintRe.test(r.request_fingerprint)
      )
        throw new Rejection("invalid_hash", "request_fingerprint");
      return r.request_fingerprint;
    })(),
    logical_request_key: nonEmpty(r.logical_request_key, "logical_request_key"),
    operational_try_number: intIn(
      r.operational_try_number,
      "operational_try_number",
      1,
    ),
    intentional_take_index:
      r.intentional_take_index === null
        ? null
        : intIn(r.intentional_take_index, "intentional_take_index", 0),
    retry_of_provider_call_id: uuidOrNull(
      r.retry_of_provider_call_id,
      "retry_of_provider_call_id",
    ),
    reroll_of_provider_call_id: uuidOrNull(
      r.reroll_of_provider_call_id,
      "reroll_of_provider_call_id",
    ),
    reroll_trigger_id: uuidOrNull(r.reroll_trigger_id, "reroll_trigger_id"),
    started_at: requireTimestamp(r.started_at, "started_at"),
  };
  return out;
}

/** Exact decimal text: no sign, exponent, leading zeros or surrounding space; at most 64 characters. Never a JS number. */
const costRe = /^(0|[1-9][0-9]*)(\.[0-9]+)?$/;
const currencyRe = /^[A-Z]{3}$/;
function validateOutcome(o: AuthoredOutcome): AuthoredOutcome {
  if (
    !(
      ["succeeded", "retryable_failure", "terminal_failure"] as string[]
    ).includes(o.event_type)
  )
    throw new Rejection("invalid_event_type", "event_type");
  const usage = assertJson(o.usage, "usage");
  if (typeof usage !== "object" || usage === null || Array.isArray(usage))
    throw new Rejection("invalid_json", "usage must be an object");
  if (o.actual_cost !== null) {
    if (
      typeof o.actual_cost !== "string" ||
      o.actual_cost.length > 64 ||
      !costRe.test(o.actual_cost)
    )
      throw new Rejection("invalid_cost", "exact decimal text required");
  }
  if (
    o.currency !== null &&
    (typeof o.currency !== "string" || !currencyRe.test(o.currency))
  )
    throw new Rejection("invalid_currency");
  if ((o.actual_cost === null) !== (o.currency === null))
    throw new Rejection("cost_currency_pairing");
  if (o.response_reference !== null && typeof o.response_reference !== "string")
    throw new Rejection("invalid_string", "response_reference");
  return {
    provider_call_id: requireUuid(o.provider_call_id, "provider_call_id"),
    event_type: o.event_type,
    ended_at: requireTimestamp(o.ended_at, "ended_at"),
    usage,
    actual_cost: o.actual_cost,
    currency: o.currency,
    response_artifact_id: uuidOrNull(
      o.response_artifact_id,
      "response_artifact_id",
    ),
    response_reference: o.response_reference,
  };
}

const guessRejection = (error: DbError): Outcome<never> | undefined => {
  // Guard exceptions (RAISE EXCEPTION = P0001), STRICT lookups (P0002), CHECK (23514) and FK (23503) violations are the DATABASE
  // refusing the request: nothing is written. Anything else is not understood and is rethrown by the caller.
  if (error.code === "P0001")
    return {
      kind: "rejected",
      code: "guard_rejected",
      detail: error.message,
      sqlstate: "P0001",
    };
  if (error.code === "P0002" || error.code === "23503")
    return {
      kind: "rejected",
      code: "reference_not_found",
      detail: error.message,
      sqlstate: error.code,
    };
  if (error.code === "23514")
    return {
      kind: "rejected",
      code: "check_rejected",
      detail: error.message,
      sqlstate: "23514",
    };
  return undefined;
};

// ---- reserveProviderCall -------------------------------------------------------------------------------------------------
async function readOutcome(
  tx: Tx,
  providerCallId: string,
): Promise<StoredOutcome | null> {
  const r = await tx.query(
    `SELECT ${OUTCOME_COLUMNS} FROM provider_call_events e WHERE e.provider_call_id = $1::uuid`,
    [providerCallId],
  );
  const row = r.rows[0];
  return row ? toOutcome(row) : null;
}

const FIELD_FLAGS: [string, string][] = [
  ["attempt_id", "c.attempt_id = $2::uuid"],
  ["provider", "c.provider = $3"],
  ["operation", "c.operation = $4"],
  ["model_identifier", "c.model_identifier = $5"],
  ["request_fingerprint", "c.request_fingerprint = $6"],
  ["logical_request_key", "c.logical_request_key = $7"],
  ["operational_try_number", "c.operational_try_number = $8::int"],
  [
    "intentional_take_index",
    "c.intentional_take_index IS NOT DISTINCT FROM $9::int",
  ],
  [
    "retry_of_provider_call_id",
    "c.retry_of_provider_call_id IS NOT DISTINCT FROM $10::uuid",
  ],
  [
    "reroll_of_provider_call_id",
    "c.reroll_of_provider_call_id IS NOT DISTINCT FROM $11::uuid",
  ],
  ["reroll_trigger_id", "c.reroll_trigger_id IS NOT DISTINCT FROM $12::uuid"],
  ["started_at", "c.started_at = $13::timestamptz"],
];

/** Decides what an EXISTING row means for this authored request. Everything is compared IN SQL (microseconds, NULL-safe). */
async function classifyExisting(
  tx: Tx,
  r: AuthoredReservation,
): Promise<Outcome<ReservationRecord> | undefined> {
  const byId = await tx.query(
    `SELECT ${RESERVATION_COLUMNS}, ${FIELD_FLAGS.map(([n, sql]) => `(${sql}) AS same_${n}`).join(", ")}
       FROM provider_calls c WHERE c.provider_call_id = $1::uuid`,
    [
      r.provider_call_id,
      r.attempt_id,
      r.provider,
      r.operation,
      r.model_identifier,
      r.request_fingerprint,
      r.logical_request_key,
      r.operational_try_number,
      r.intentional_take_index,
      r.retry_of_provider_call_id,
      r.reroll_of_provider_call_id,
      r.reroll_trigger_id,
      r.started_at,
    ],
  );
  const row = byId.rows[0];
  if (row) {
    const stored = toReservation(row);
    const differs = FIELD_FLAGS.filter(([n]) => row[`same_${n}`] !== true).map(
      ([n]) => n,
    );
    const record: ReservationRecord = {
      reservation: stored,
      outcome: await readOutcome(tx, stored.provider_call_id),
    };
    if (differs.length === 0) return { kind: "converged", record };
    return {
      kind: "conflict",
      code: "reservation_fields_differ",
      stored: record,
      detail: `differs in ${differs.join(",")}`,
    };
  }
  const bySlot = await tx.query(
    `SELECT ${RESERVATION_COLUMNS} FROM provider_calls c WHERE c.logical_request_key = $1 AND c.operational_try_number = $2::int`,
    [r.logical_request_key, r.operational_try_number],
  );
  const other = bySlot.rows[0];
  if (other) {
    const stored = toReservation(other);
    return {
      kind: "held_by_other",
      record: {
        reservation: stored,
        outcome: await readOutcome(tx, stored.provider_call_id),
      },
    };
  }
  return undefined;
}

const RESERVATION_UNIQUES = [
  "provider_calls_pkey",
  "provider_calls_logical_request_key_operational_try_number_key",
  "provider_calls_retry_of_provider_call_id_key",
];

/**
 * Reserves (logical_request_key, operational_try_number) for one authored provider_call_id. Results:
 *  - `created`: THIS call committed the reservation. This historical ledger API alone never authorizes execution;
 *    executeProviderCall additionally requires its own guarded, acknowledged creating commit and explicit non-network controls.
 *  - `converged`: the same authored reservation already exists (identical in every immutable field); the stored outcome, if any, is
 *    returned. NOT permission to perform.
 *  - `held_by_other`: a different authored id owns the slot. Do not perform.
 *  - `conflict`: the same authored id with changed immutable data.   - `rejected`: invalid or illegal chain; nothing written.
 */
export async function reserveProviderCall(
  pool: Pool,
  authored: AuthoredReservation,
  context?: CommandContext,
): Promise<Outcome<ReservationRecord>> {
  return reserveCore(pool, authored, context);
}

/** Execution-only admission hook. Historical ledger reservations do not grant execution. */
async function reserveCore(
  pool: Pool,
  authored: AuthoredReservation,
  context?: CommandContext,
  beforeInsert?: () => string | undefined,
): Promise<Outcome<ReservationRecord>> {
  const trace: CommandTrace | undefined = context && {
    context,
    command: "provider_call.reserve",
    subject: {
      provider_call_id: peek(() => authored.provider_call_id),
      attempt_id: peek(() => authored.attempt_id),
      provider: peek(() => authored.provider),
      operation: peek(() => authored.operation),
      operational_try_number: peek(() => authored.operational_try_number),
      intentional_take_index: peek(() => authored.intentional_take_index),
      logical_request_key: peek(() => authored.logical_request_key),
    },
  };
  let r: AuthoredReservation;
  try {
    r = validateReservation(authored);
  } catch (error) {
    if (error instanceof Rejection) {
      emitPreflight(trace, error.code);
      return { kind: "rejected", code: error.code, detail: error.message };
    }
    throw error;
  }
  return runCommand(
    pool,
    async (tx) => {
      const existing = await classifyExisting(tx, r);
      if (existing) return existing;
      const refused = beforeInsert?.();
      if (refused) return { kind: "rejected", code: refused };
      const insert = await tx.attempt(
        `INSERT INTO provider_calls AS c (provider_call_id, attempt_id, provider, operation, model_identifier, request_fingerprint,
         logical_request_key, operational_try_number, intentional_take_index, retry_of_provider_call_id, reroll_of_provider_call_id,
         reroll_trigger_id, started_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::int, $9::int, $10::uuid, $11::uuid, $12::uuid, $13::timestamptz)
       RETURNING ${RESERVATION_COLUMNS}`,
        [
          r.provider_call_id,
          r.attempt_id,
          r.provider,
          r.operation,
          r.model_identifier,
          r.request_fingerprint,
          r.logical_request_key,
          r.operational_try_number,
          r.intentional_take_index,
          r.retry_of_provider_call_id,
          r.reroll_of_provider_call_id,
          r.reroll_trigger_id,
          r.started_at,
        ],
      );
      if (insert.ok) {
        const row = insert.rows[0];
        if (!row) throw new Error("insert returned no row");
        await faultPoint("reservation_inserted_uncommitted");
        const canceled = beforeInsert?.();
        if (canceled) return { kind: "rejected", code: canceled };
        return {
          kind: "created",
          record: { reservation: toReservation(row), outcome: null },
        };
      }
      // The savepoint is already rolled back, so a fresh statement sees the winner's COMMITTED row.
      if (isUnique(insert.error, ...RESERVATION_UNIQUES)) {
        const winner = await classifyExisting(tx, r);
        if (winner) return winner;
        // A retry-of unique violation with no row at our (key, try): another call already retries this prior call.
        return {
          kind: "rejected",
          code: "retry_already_reserved",
          sqlstate: "23505",
        };
      }
      return guessRejection(insert.error) ?? rethrow(insert.error);
    },
    trace,
  );
}

// ---- recordProviderOutcome -----------------------------------------------------------------------------------------------
async function classifyOutcome(
  tx: Tx,
  o: AuthoredOutcome,
): Promise<Outcome<StoredOutcome> | undefined> {
  const r = await tx.query(
    `SELECT ${OUTCOME_COLUMNS},
       (e.event_type = $2) AS same_event_type, (e.ended_at = $3::timestamptz) AS same_ended_at, (e.usage = $4::jsonb) AS same_usage,
       (e.actual_cost IS NOT DISTINCT FROM $5::numeric) AS same_actual_cost, (e.currency IS NOT DISTINCT FROM $6) AS same_currency,
       (e.response_artifact_id IS NOT DISTINCT FROM $7::uuid) AS same_response_artifact_id,
       (e.response_reference IS NOT DISTINCT FROM $8) AS same_response_reference
     FROM provider_call_events e WHERE e.provider_call_id = $1::uuid`,
    [
      o.provider_call_id,
      o.event_type,
      o.ended_at,
      JSON.stringify(o.usage),
      o.actual_cost,
      o.currency,
      o.response_artifact_id,
      o.response_reference,
    ],
  );
  const row = r.rows[0];
  if (!row) return undefined;
  const stored = toOutcome(row);
  const differs = [
    "event_type",
    "ended_at",
    "usage",
    "actual_cost",
    "currency",
    "response_artifact_id",
    "response_reference",
  ].filter((n) => row[`same_${n}`] !== true);
  if (differs.length === 0) return { kind: "converged", record: stored };
  return {
    kind: "conflict",
    code: "outcome_differs",
    stored,
    detail: `differs in ${differs.join(",")}`,
  };
}

/** Records the ONE final outcome of a call. Identical retry converges; any difference conflicts; nothing is overwritten. */
export async function recordProviderOutcome(
  pool: Pool,
  authored: AuthoredOutcome,
  context?: CommandContext,
): Promise<Outcome<StoredOutcome>> {
  const trace: CommandTrace | undefined = context && {
    context,
    command: "provider_outcome.record",
    subject: {
      provider_call_id: peek(() => authored.provider_call_id),
      // the authored outcome type is a KNOWN code fact (never inferred as a retry policy)
      provider_outcome_type: peek(() => authored.event_type),
    },
  };
  let o: AuthoredOutcome;
  try {
    o = validateOutcome(authored);
  } catch (error) {
    if (error instanceof Rejection) {
      emitPreflight(trace, error.code);
      return { kind: "rejected", code: error.code, detail: error.message };
    }
    throw error;
  }
  return runCommand(
    pool,
    async (tx) => {
      const reserved = await tx.query(
        "SELECT 1 FROM provider_calls WHERE provider_call_id = $1::uuid",
        [o.provider_call_id],
      );
      if (reserved.rows.length === 0)
        return { kind: "rejected", code: "reservation_not_found" };
      const prior = await classifyOutcome(tx, o);
      if (prior) return prior;
      const insert = await tx.attempt(
        `INSERT INTO provider_call_events AS e (provider_call_id, event_type, ended_at, usage, actual_cost, currency, response_artifact_id,
         response_reference)
       VALUES ($1::uuid, $2, $3::timestamptz, $4::jsonb, $5::numeric, $6, $7::uuid, $8)
       RETURNING ${OUTCOME_COLUMNS}`,
        [
          o.provider_call_id,
          o.event_type,
          o.ended_at,
          JSON.stringify(o.usage),
          o.actual_cost,
          o.currency,
          o.response_artifact_id,
          o.response_reference,
        ],
      );
      if (insert.ok) {
        const row = insert.rows[0];
        if (!row) throw new Error("insert returned no row");
        return { kind: "created", record: toOutcome(row) };
      }
      if (isUnique(insert.error, "provider_call_events_provider_call_id_key")) {
        const winner = await classifyOutcome(tx, o);
        if (winner) return winner;
      }
      return guessRejection(insert.error) ?? rethrow(insert.error);
    },
    trace,
  );
}

/** Read-only lookup of a reservation and its durable outcome (the ambiguity protocol: after a lost acknowledgement, look it up). */
export async function lookupProviderCall(
  pool: Pool,
  providerCallId: string,
): Promise<ReservationRecord | null> {
  requireUuid(providerCallId, "provider_call_id");
  const res = await pool.query(
    `SELECT ${RESERVATION_COLUMNS} FROM provider_calls c WHERE c.provider_call_id = $1::uuid`,
    [providerCallId],
  );
  const row = res.rows[0] as Row | undefined;
  if (!row) return null;
  const out = await pool.query(
    `SELECT ${OUTCOME_COLUMNS} FROM provider_call_events e WHERE e.provider_call_id = $1::uuid`,
    [providerCallId],
  );
  const orow = out.rows[0] as Row | undefined;
  return {
    reservation: toReservation(row),
    outcome: orow ? toOutcome(orow) : null,
  };
}

// ---- adapter boundary, reconcile, execute ---------------------------------------------------------------------------------
export interface ProviderRequest {
  provider_call_id: string;
  provider: string;
  operation: string;
  model_identifier: string;
  request_fingerprint: string;
  logical_request_key: string;
}

/** A durable record held by the provider/adapter side, bound to the request that produced it. */
export interface AdapterRecord<R> {
  provider_call_id: string;
  logical_request_key: string;
  request_fingerprint: string;
  result: R;
}

export interface LookupAdapter<R> {
  /** Optional: a provider without idempotency/lookup support simply has none (reconciliation then reports `unknown`). */
  lookup?(request: ProviderRequest): Promise<AdapterRecord<R> | undefined>;
}
export interface SideEffectAdapter<R> extends LookupAdapter<R> {
  /**
   * The ONE place a provider side effect happens. A returned value is GOVERNED evidence of what happened (including a governed
   * failure the adapter positively knows); a thrown error or timeout is AMBIGUOUS and never becomes a retryable failure here.
   */
  perform(request: ProviderRequest, signal?: AbortSignal): Promise<R>;
}

const requestOf = (r: StoredReservation): ProviderRequest => ({
  provider_call_id: r.provider_call_id,
  provider: r.provider,
  operation: r.operation,
  model_identifier: r.model_identifier,
  request_fingerprint: r.request_fingerprint,
  logical_request_key: r.logical_request_key,
});

export type ReconcileResult<R> =
  /** A durable outcome already exists; no lookup was made and nothing can be performed. */
  | { status: "recorded"; outcome: StoredOutcome }
  /** Adapter evidence bound to THIS reservation. Nothing was performed; the reservation still has no outcome unless `recorded` is set. */
  | {
      status: "performed";
      evidence: AdapterRecord<R>;
      recorded?: Outcome<StoredOutcome>;
    }
  | { status: "not_performed" }
  | { status: "unknown"; reason: string };

/**
 * Looks for evidence that the side effect already happened. It NEVER calls `perform`. With `finish` and bound `performed` evidence it
 * explicitly records that existing outcome (idempotent); otherwise the reservation stays unfinished.
 */
interface ReconcileArgs<R> {
  providerCallId: string;
  adapter: LookupAdapter<R>;
  finish?: (result: R) => AuthoredOutcome;
}

async function reconcileWith<R>(
  pool: Pool,
  args: ReconcileArgs<R>,
  found: ReservationRecord | null,
  recordContext: CommandContext | undefined,
): Promise<ReconcileResult<R>> {
  if (!found) return { status: "unknown", reason: "reservation_not_found" };
  if (found.outcome) return { status: "recorded", outcome: found.outcome };
  if (!args.adapter.lookup)
    return { status: "unknown", reason: "adapter_has_no_lookup" };
  let evidence: AdapterRecord<R> | undefined;
  try {
    evidence = await args.adapter.lookup(requestOf(found.reservation));
  } catch {
    return { status: "unknown", reason: "lookup_failed" };
  }
  if (evidence === undefined) return { status: "not_performed" };
  const res = found.reservation;
  if (
    evidence.provider_call_id !== res.provider_call_id ||
    evidence.logical_request_key !== res.logical_request_key ||
    evidence.request_fingerprint !== res.request_fingerprint
  )
    return { status: "unknown", reason: "evidence_not_bound_to_reservation" };
  if (!args.finish) return { status: "performed", evidence };
  let authored: AuthoredOutcome;
  try {
    authored = args.finish(evidence.result);
  } catch {
    return { status: "performed", evidence };
  }
  if (authored.provider_call_id !== res.provider_call_id)
    return {
      status: "performed",
      evidence,
      recorded: { kind: "rejected", code: "outcome_binding_mismatch" },
    };
  return {
    status: "performed",
    evidence,
    recorded: await recordProviderOutcome(pool, authored, recordContext),
  };
}

/**
 * Observed workflow entry point (reconciliation). `context` is REQUIRED and validated at runtime: it declares a correlation id and an
 * observer (which may still be a no-op; this proves a declared context, not that logs are produced). One `workflow.completed` event
 * is emitted after the result is established; the recorded outcome (if any) emits its own command event with its own durability.
 */
export async function reconcileProviderCall<R>(
  pool: Pool,
  args: ReconcileArgs<R>,
  context: ObserverContext,
): Promise<ReconcileResult<R>> {
  const rc = readContext(context);
  if (!rc.ok) return { status: "unknown", reason: "observer_context_invalid" };
  const base = rc.context; // a plain snapshot: no property of the caller's object is read again
  const startedAt = performance.now();
  let attemptId: string | undefined;
  let run: AttemptRun | undefined;
  let result: ReconcileResult<R>;
  try {
    const found = await lookupProviderCall(pool, args.providerCallId);
    if (found) {
      attemptId = found.reservation.attempt_id;
      run = await readAttemptRun(pool, attemptId);
    }
    result = await reconcileWith(
      pool,
      args,
      found,
      stageContext(base, "record", attemptId, run),
    );
  } catch (error) {
    emitWorkflow(base, "provider_call.reconcile", attemptId, run, startedAt, {
      outcome: "error",
      error_class: error instanceof Rejection ? "Rejection" : "unclassified",
      provider_call_id: peek(() => args.providerCallId),
    });
    throw error;
  }
  emitWorkflow(base, "provider_call.reconcile", attemptId, run, startedAt, {
    status: result.status,
    provider_call_id: peek(() => args.providerCallId),
    ...(result.status === "unknown" ? { reconcile_reason: result.reason } : {}),
  });
  return result;
}

/** One `workflow.completed` event (a workflow spans several transactions: no single committed flag is ever assigned). */
function emitWorkflow(
  base: ObserverContext,
  workflow: "provider_call.execute" | "provider_call.reconcile",
  attemptId: string | undefined,
  run: AttemptRun | undefined,
  startedAt: number,
  facts: RawEvent,
): void {
  safeEmit(() => {
    // The workflow event carries a fixed WORKFLOW-level stage; the child command events keep their own, actual stages.
    const stage =
      workflow === "provider_call.execute"
        ? "provider_execute"
        : "provider_reconcile";
    const c = stageContext(base, stage, attemptId, run);
    return {
      observer: base.observer,
      event: {
        event: "workflow.completed",
        workflow,
        stage,
        correlation_id: c.correlationId,
        run_id: c.runId,
        run_id_status: c.runIdStatus,
        attempt_id: c.attemptId,
        duration_ms: performance.now() - startedAt,
        ...facts,
      },
    };
  });
}

export type ExecuteResult =
  /** This call created the reservation, performed once and attempted to record the outcome (see `outcome`). */
  | {
      status: "performed";
      reservation: StoredReservation;
      outcome: Outcome<StoredOutcome>;
    }
  /** Identical retry of a COMPLETED call: the durable outcome is returned and nothing was performed. */
  | {
      status: "completed";
      reservation: StoredReservation;
      outcome: StoredOutcome;
    }
  /** The reservation exists without an outcome and this caller did not create it: NOT performed, availability limitation applies. */
  | {
      status: "unfinished";
      reason:
        | "converged_without_outcome"
        | "held_by_other"
        | "provider_not_invoked_canceled";
      reservation: StoredReservation;
    }
  /** `perform` (or `finish`) threw: the provider may have acted. Nothing was recorded; use reconcile, never retry blindly. */
  | {
      status: "ambiguous";
      reservation: StoredReservation;
      code:
        | "provider_perform_ambiguous"
        | "provider_finish_ambiguous"
        | "provider_observation_timeout"
        | "provider_observation_canceled";
    }
  | { status: "conflict"; result: Outcome<ReservationRecord> }
  | { status: "rejected"; result: Outcome<ReservationRecord> };

/** Trusted application/test construction, not an authentication token or network sandbox. */
export interface NonNetworkExecutionControls {
  mode: "non_network";
  DESK_ENV: "development" | "test";
  PROVIDERS_ENABLED: false;
  GENERATION_KILL_SWITCH: false;
  PROVIDER_CALL_TIMEOUT_MS: number;
  signal?: AbortSignal;
}

const abortedGetter: unknown = Reflect.get(
  Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted") ?? {},
  "get",
);
function aborted(signal?: unknown): boolean {
  if (signal === undefined) return false;
  if (typeof abortedGetter !== "function")
    throw new Rejection("internal_missing");
  return Reflect.apply(abortedGetter, signal, []) === true;
}

interface Controls {
  value?: NonNetworkExecutionControls;
  refusal?: string;
}
function readControls(input: unknown): Controls {
  if (input === undefined) return { refusal: "provider_admission_unavailable" };
  try {
    if (input === null || typeof input !== "object")
      throw new Rejection("provider_controls_invalid");
    const properties = Object.getOwnPropertyDescriptors(input);
    const names = [
      "mode",
      "DESK_ENV",
      "PROVIDERS_ENABLED",
      "GENERATION_KILL_SWITCH",
      "PROVIDER_CALL_TIMEOUT_MS",
      "signal",
    ];
    if (
      Reflect.ownKeys(properties).some(
        (key) => typeof key !== "string" || !names.includes(key),
      )
    )
      throw new Rejection("provider_controls_invalid");
    const value: Record<string, unknown> = {};
    for (const name of names) {
      const property = properties[name];
      if (property === undefined && name === "signal") continue;
      if (!property || !("value" in property))
        throw new Rejection("provider_controls_invalid");
      value[name] = property.value;
    }
    if (value.mode !== "non_network")
      return { refusal: "provider_admission_unavailable" };
    if (
      typeof value.DESK_ENV !== "string" ||
      !["development", "test", "staging", "production"].includes(
        value.DESK_ENV,
      ) ||
      typeof value.PROVIDERS_ENABLED !== "boolean" ||
      typeof value.GENERATION_KILL_SWITCH !== "boolean" ||
      typeof value.PROVIDER_CALL_TIMEOUT_MS !== "number" ||
      !Number.isInteger(value.PROVIDER_CALL_TIMEOUT_MS) ||
      value.PROVIDER_CALL_TIMEOUT_MS < 1 ||
      value.PROVIDER_CALL_TIMEOUT_MS > 2147483647
    )
      throw new Rejection("provider_controls_invalid");
    if (value.signal !== undefined) aborted(value.signal);
    if (value.DESK_ENV !== "development" && value.DESK_ENV !== "test")
      return { refusal: "provider_execution_disabled" };
    if (value.PROVIDERS_ENABLED || value.GENERATION_KILL_SWITCH)
      return { refusal: "provider_execution_disabled" };
    return {
      value: Object.freeze(value) as unknown as NonNetworkExecutionControls,
    };
  } catch {
    return { refusal: "provider_controls_invalid" };
  }
}

/** No raw cause, message, error attachment or AggregateError children cross the execution boundary. */
export class ProviderExecutionError extends Error {
  readonly code: string;
  readonly correlation_id: string;
  readonly stage: "reserve" | "record";
  readonly commit_state: Durability;
  readonly error_class: string;
  readonly reservation_commit_state: Durability;
  constructor(
    correlationId: string,
    stage: "reserve" | "record",
    event?: CommandEvent,
    fallback: Durability = "unknown",
    primaryCode?: string,
    reservationState: Durability = "unknown",
  ) {
    const code =
      event?.durability === "unknown"
        ? "provider_execution_commit_unknown"
        : (primaryCode ?? "provider_execution_failed");
    super(code);
    this.name = "ProviderExecutionError";
    this.code = code;
    this.correlation_id = correlationId;
    this.stage = stage;
    this.commit_state = event?.durability ?? fallback;
    this.error_class = event?.error_class ?? "unclassified";
    this.reservation_commit_state = reservationState;
  }
}

type Observation<R> =
  | { kind: "returned"; value: R }
  | {
      kind: "ambiguous";
      code:
        | "provider_perform_ambiguous"
        | "provider_observation_timeout"
        | "provider_observation_canceled";
    };
function observePerform<R>(
  adapter: SideEffectAdapter<R>,
  request: ProviderRequest,
  controls: NonNetworkExecutionControls,
): Promise<Observation<R>> {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const local = new AbortController();
    let settled = false;
    const finish = (result: Observation<R>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (controls.signal)
        EventTarget.prototype.removeEventListener.call(
          controls.signal,
          "abort",
          cancel,
        );
      resolve(result);
    };
    const cancel = () => {
      finish({ kind: "ambiguous", code: "provider_observation_canceled" });
      local.abort();
    };
    const timer = setTimeout(() => {
      finish({ kind: "ambiguous", code: "provider_observation_timeout" });
      local.abort();
    }, controls.PROVIDER_CALL_TIMEOUT_MS);
    if (controls.signal)
      EventTarget.prototype.addEventListener.call(
        controls.signal,
        "abort",
        cancel,
        { once: true },
      );
    if (aborted(controls.signal)) {
      cancel();
      return;
    }
    // A referenced finite timer keeps the waiting caller alive. Late return/rejection is consumed without SQL or finish().
    const complete = (result: Observation<R>) => {
      if (settled) return;
      if (performance.now() - startedAt >= controls.PROVIDER_CALL_TIMEOUT_MS) {
        finish({ kind: "ambiguous", code: "provider_observation_timeout" });
        local.abort();
      } else if (aborted(controls.signal)) cancel();
      else finish(result);
    };
    try {
      Promise.resolve(adapter.perform(request, local.signal)).then(
        (value) => {
          complete({ kind: "returned", value });
        },
        () => {
          complete({ kind: "ambiguous", code: "provider_perform_ambiguous" });
        },
      );
    } catch {
      complete({ kind: "ambiguous", code: "provider_perform_ambiguous" });
    }
  });
}

function safeOutcome<T>(outcome: Outcome<T>): Outcome<T> {
  if (outcome.kind !== "rejected") return outcome;
  return {
    kind: "rejected",
    code: outcome.code,
    ...(outcome.sqlstate ? { sqlstate: outcome.sqlstate } : {}),
  };
}

function ownedRejection(error: unknown): string | undefined {
  try {
    if (error instanceof Rejection) {
      const code: unknown = Object.getOwnPropertyDescriptor(
        error,
        "code",
      )?.value;
      if (typeof code === "string" && KNOWN_OUTCOME_CODES.has(code))
        return code;
    }
  } catch {
    // An exotic thrown object must not escape through instanceof/prototype/getter inspection.
  }
  return undefined;
}

/**
 * reserve -> (ONLY if this call's own commit returned `created`) perform -> record. Never takes over, never retries, never invents an
 * outcome. See the safety contract at the top of this file.
 */
interface ExecuteFacts {
  reservation?: string;
  perform: "performed" | "not_attempted" | "ambiguous";
  outcome_record: string;
  errorStage: "reserve" | "record";
}

async function executeCore<R>(
  pool: Pool,
  reservation: AuthoredReservation,
  adapter: SideEffectAdapter<R>,
  finish: (result: R) => AuthoredOutcome,
  facts: ExecuteFacts,
  reserveContext: CommandContext,
  recordContext: CommandContext,
  controls: Controls,
): Promise<ExecuteResult> {
  const guard = () =>
    controls.refusal ??
    (aborted(controls.value?.signal)
      ? "provider_execution_canceled"
      : undefined);
  const reserved = await reserveCore(pool, reservation, reserveContext, guard);
  facts.reservation = reserved.kind;
  switch (reserved.kind) {
    case "conflict":
      return { status: "conflict", result: reserved };
    case "rejected":
      return { status: "rejected", result: safeOutcome(reserved) };
    case "held_by_other":
      return reserved.record.outcome
        ? {
            status: "completed",
            reservation: reserved.record.reservation,
            outcome: reserved.record.outcome,
          }
        : {
            status: "unfinished",
            reason: "held_by_other",
            reservation: reserved.record.reservation,
          };
    case "converged":
      return reserved.record.outcome
        ? {
            status: "completed",
            reservation: reserved.record.reservation,
            outcome: reserved.record.outcome,
          }
        : {
            status: "unfinished",
            reason: "converged_without_outcome",
            reservation: reserved.record.reservation,
          };
    case "created":
      break;
  }
  const mine = reserved.record.reservation;
  await faultPoint("after_reservation_commit");
  if (aborted(controls.value?.signal))
    return {
      status: "unfinished",
      reason: "provider_not_invoked_canceled",
      reservation: mine,
    };
  // Only a committing created result, after the guarded insert, can reach here.
  const controlled = controls.value;
  if (!controlled) throw new Rejection("provider_admission_unavailable");
  const observation = await observePerform(
    adapter,
    requestOf(mine),
    controlled,
  );
  if (observation.kind === "ambiguous") {
    facts.perform = "ambiguous";
    return {
      status: "ambiguous",
      reservation: mine,
      code: observation.code,
    };
  }
  facts.perform = "performed";
  await faultPoint("after_side_effect");
  if (aborted(controlled.signal))
    return {
      status: "ambiguous",
      reservation: mine,
      code: "provider_observation_canceled",
    };
  let authored: AuthoredOutcome;
  try {
    const properties = Object.getOwnPropertyDescriptors(
      finish(observation.value),
    );
    const data: Record<string, unknown> = {};
    for (const name of [
      "provider_call_id",
      "event_type",
      "ended_at",
      "usage",
      "actual_cost",
      "currency",
      "response_artifact_id",
      "response_reference",
    ]) {
      const property = properties[name];
      if (!property || !("value" in property))
        throw new Rejection("provider_finish_ambiguous");
      data[name] = property.value;
    }
    authored = validateOutcome(data as unknown as AuthoredOutcome);
    authored.usage = JSON.parse(JSON.stringify(authored.usage)) as Json;
    if (authored.provider_call_id !== mine.provider_call_id)
      return {
        status: "performed",
        reservation: mine,
        outcome: { kind: "rejected", code: "outcome_binding_mismatch" },
      };
  } catch {
    // `perform` itself was acknowledged (facts.perform stays "performed"); only the outcome could not be produced, so the WORKFLOW
    // status is ambiguous while the perform fact is not rewritten.
    return {
      status: "ambiguous",
      reservation: mine,
      code: "provider_finish_ambiguous",
    };
  }
  // The record command is attempted from here: if it throws, the fact stays "unknown" (attempted, result not known), not "not_attempted".
  if (aborted(controlled.signal))
    return {
      status: "ambiguous",
      reservation: mine,
      code: "provider_observation_canceled",
    };
  facts.outcome_record = "unknown";
  facts.errorStage = "record";
  const outcome = await recordProviderOutcome(pool, authored, recordContext);
  facts.outcome_record = outcome.kind;
  await faultPoint("after_outcome_commit");
  return {
    status: "performed",
    reservation: mine,
    outcome: safeOutcome(outcome),
  };
}

/**
 * Observed workflow entry point (reserve -> perform -> record). `context` is REQUIRED and validated at runtime (a declared correlation
 * id and observer; the observer may still be a no-op). The reservation and the recorded outcome each emit their own command event with
 * their own durability; the single `workflow.completed` event reports the workflow facts separately, so an AMBIGUOUS perform after a
 * committed reservation, or an unfinished durable call, is visible as exactly that.
 */
export async function executeProviderCall<R>(
  pool: Pool,
  reservation: AuthoredReservation,
  adapter: SideEffectAdapter<R>,
  finish: (result: R) => AuthoredOutcome,
  context: ObserverContext,
  controls?: unknown,
): Promise<ExecuteResult> {
  const rc = readContext(context);
  if (!rc.ok)
    return {
      status: "rejected",
      result: { kind: "rejected", code: "observer_context_invalid" },
    };
  const base = rc.context; // a plain snapshot: no property of the caller's object is read again
  const startedAt = performance.now();
  let authored: AuthoredReservation;
  try {
    const properties = Object.getOwnPropertyDescriptors(reservation);
    const data: Record<string, unknown> = {};
    for (const name of [
      "provider_call_id",
      "attempt_id",
      "provider",
      "operation",
      "model_identifier",
      "request_fingerprint",
      "logical_request_key",
      "operational_try_number",
      "intentional_take_index",
      "retry_of_provider_call_id",
      "reroll_of_provider_call_id",
      "reroll_trigger_id",
      "started_at",
    ]) {
      const property = properties[name];
      if (!property || !("value" in property))
        return {
          status: "rejected",
          result: { kind: "rejected", code: "provider_reservation_invalid" },
        };
      data[name] = property.value;
    }
    authored = validateReservation(data as unknown as AuthoredReservation);
  } catch (error) {
    return {
      status: "rejected",
      result: {
        kind: "rejected",
        code: ownedRejection(error) ?? "provider_reservation_invalid",
      },
    };
  }
  const admission = readControls(controls);
  const attemptId = authored.attempt_id;
  let run: AttemptRun | undefined;
  const id = typeof attemptId === "string" ? attemptId : undefined;
  const facts: ExecuteFacts = {
    perform: "not_attempted",
    outcome_record: "not_attempted",
    errorStage: "reserve",
  };
  let reserveEvent: CommandEvent | undefined;
  let recordEvent: CommandEvent | undefined;
  const tracked: ObserverContext = {
    correlationId: base.correlationId,
    observer: (event) => {
      if (event.command === "provider_call.reserve")
        reserveEvent = Object.freeze({ ...event });
      if (event.command === "provider_outcome.record")
        recordEvent = Object.freeze({ ...event });
      return base.observer(event);
    },
  };
  let result: ExecuteResult;
  let workStarted = false;
  try {
    run = await readAttemptRun(pool, attemptId);
    workStarted = true;
    result = await executeCore(
      pool,
      authored,
      adapter,
      finish,
      facts,
      stageContext(tracked, "reserve", id, run),
      stageContext(tracked, "record", id, run),
      admission,
    );
  } catch (raw) {
    const error = new ProviderExecutionError(
      base.correlationId,
      facts.errorStage,
      facts.errorStage === "reserve" ? reserveEvent : recordEvent,
      workStarted ? "unknown" : "not_committed",
      ownedRejection(raw),
      reserveEvent?.durability ?? (workStarted ? "unknown" : "not_committed"),
    );
    emitWorkflow(base, "provider_call.execute", id, run, startedAt, {
      outcome: "error",
      error_class: error.error_class,
      code: error.code,
      provider_call_id: authored.provider_call_id,
      reservation: facts.reservation,
      perform: facts.perform,
      outcome_record: facts.outcome_record,
    });
    throw error;
  }
  emitWorkflow(base, "provider_call.execute", id, run, startedAt, {
    status: result.status,
    ...(result.status === "ambiguous" ? { code: result.code } : {}),
    ...(result.status === "unfinished" &&
    result.reason === "provider_not_invoked_canceled"
      ? { code: "provider_not_invoked_canceled" }
      : {}),
    provider_call_id: authored.provider_call_id,
    reservation: facts.reservation,
    perform: facts.perform,
    outcome_record: facts.outcome_record,
  });
  return result;
}
