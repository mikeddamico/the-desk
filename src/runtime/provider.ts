// Provider-call commands over the EXISTING provider_calls / provider_call_events ledger and runtime privileges.
// Legacy callers retain A5.2 execution semantics. This runtime requires additive migration003;
// certified non-network simulation uses original-bound admission/settlement metadata, with no lease table or new dependency.
//
// SAFETY CONTRACT (supervisory correction to the A5 r2 plan, section 4.5)
// - ONLY the worker whose own COMMITTED reservation command returned `created` may call `adapter.perform`. A reservation that
//   `converged` (same authored id, whatever the stored outcome) or is `held_by_other` NEVER grants execution: two recoverers can both
//   observe "no outcome", and a shared reservation is not an execution lease.
// - There is NO automatic takeover, TTL/lease, implicit retryable failure or new try from an unfinished call. An unfinished call stays
//   unfinished until a DURABLE outcome is recorded explicitly. This is an intentional AVAILABILITY LIMITATION: if the creating worker
//   dies before recording an outcome, the logical slot is stuck until an operator-governed decision (outside this tranche) resolves it.
// - A `perform` that throws or times out is AMBIGUOUS (the provider may have acted). It is never converted into a retryable failure;
//   only an outcome the adapter RETURNS as governed evidence may be recorded. Legacy callers use `finish`; certified G1-B
//   projects an original-bound ReceiptPacket directly to truthful scalar outcome/settlement and NEVER invokes generic finish.
// - Reconciliation never performs. `performed` requires adapter evidence bound to THIS reservation (logical key, request fingerprint,
//   provider call id); it may enable an explicit `recordProviderOutcome` of that existing outcome. No lookup, a failed lookup, `unknown`
//   or `not_performed` leave the reservation safely unfinished.
// - The reservation commits BEFORE any side effect (separate command / transaction).
// Costs are exact decimal TEXT (never a JS number). Equality follows the column: `actual_cost` is `numeric`, so "1.5" and "1.50" are
// the SAME value (PostgreSQL numeric equality) while the stored scale is whatever the first writer's text had; a converged retry returns
// the STORED text. Lexical forms the grammar does not admit (exponent, sign, leading zeros) are rejected, never normalized.
import type { Pool } from "pg";
import {
  ADMISSION_CODES,
  AdmissionError,
  admissionBounds,
  buildCertificate,
  certificateHash,
  extractOriginalClaim,
  decimal,
  policyHash,
  projectReceipt,
  readCertificate,
  readInvocation,
  requestHash,
  type AdmissionCode,
  type AdmissionRequest,
  type Certificate,
  type Invocation,
  type OriginalClaim,
  type Settlement,
} from "./provider-admission.js";
import { sha256 } from "../identity/canonical-json.js";

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
  /** Present only on the new certified profile; historical reservation/receipt objects retain their shape. */
  admission?: StoredAdmission;
}
export interface StoredAdmission {
  certificate: Certificate;
  certificate_hash: string;
  admitted_at: string;
}

const RESERVATION_COLUMNS = `c.provider_call_id::text AS provider_call_id, c.attempt_id::text AS attempt_id, c.provider, c.operation,
  c.model_identifier, c.request_fingerprint, c.logical_request_key, c.operational_try_number, c.intentional_take_index,
  c.retry_of_provider_call_id::text AS retry_of_provider_call_id, c.reroll_of_provider_call_id::text AS reroll_of_provider_call_id,
  c.reroll_trigger_id::text AS reroll_trigger_id, ${utcText("c.started_at")} AS started_at`;
const OUTCOME_COLUMNS = `e.provider_call_id::text AS provider_call_id, e.event_type, ${utcText("e.ended_at")} AS ended_at, e.usage,
  e.actual_cost::text AS actual_cost, e.currency, e.response_artifact_id::text AS response_artifact_id, e.response_reference`;
const ADMISSION_COLUMNS = `${utcText("c.admitted_at")} AS admitted_at,c.reserved_cost_upper_bound::text AS reserved_cost_upper_bound,
 c.admission_currency,c.admission_policy_hash,c.admission_certificate,c.admission_certificate_hash,
 (SELECT program_run_id::text FROM program_run_attempts WHERE attempt_id=c.attempt_id) AS certification_run_id`;
function toAdmission(
  row: Row,
  reservation: StoredReservation,
): { admission: StoredAdmission } | Record<string, never> {
  if (row.admission_certificate === null) return {};
  const certificate = readCertificate(
    row.admission_certificate,
    reservation,
    row.certification_run_id as string,
  );
  if (
    certificateHash(certificate) !== row.admission_certificate_hash ||
    policyHash(certificate.policy) !== row.admission_policy_hash ||
    certificate.currency !== row.admission_currency ||
    certificate.reserved_cost_upper_bound !==
      decimal(
        row.reserved_cost_upper_bound,
        "provider_admission_certificate_invalid",
        true,
      ) ||
    typeof row.admitted_at !== "string"
  )
    throw new AdmissionError("provider_admission_certificate_invalid");
  return {
    admission: Object.freeze({
      certificate,
      certificate_hash: row.admission_certificate_hash,
      admitted_at: row.admitted_at,
    }),
  };
}

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
function admissionRejection(
  error: unknown,
  localCertifiedTimeoutInstalled = false,
): Outcome<never> | undefined {
  try {
    if (error === null || typeof error !== "object") return undefined;
    const code: unknown = Object.getOwnPropertyDescriptor(error, "code")?.value;
    const constraint: unknown = Object.getOwnPropertyDescriptor(
      error,
      "constraint",
    )?.value;
    if (
      (code === "23514" || code === "0A000") &&
      typeof constraint === "string" &&
      (ADMISSION_CODES as readonly string[]).includes(constraint)
    )
      return { kind: "rejected", code: constraint, sqlstate: code };
    if (
      localCertifiedTimeoutInstalled &&
      (code === "55P03" || code === "57014")
    )
      return {
        kind: "rejected",
        code: "provider_admission_local_timeout",
        sqlstate: code,
      };
  } catch {
    /* Exotic raw errors remain unknown to this closed classifier. */
  }
  return undefined;
}

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
    `SELECT ${RESERVATION_COLUMNS}, ${ADMISSION_COLUMNS}, ${FIELD_FLAGS.map(([n, sql]) => `(${sql}) AS same_${n}`).join(", ")}
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
      ...toAdmission(row, stored),
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
    `SELECT ${RESERVATION_COLUMNS}, ${ADMISSION_COLUMNS} FROM provider_calls c WHERE c.logical_request_key = $1 AND c.operational_try_number = $2::int`,
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
        ...toAdmission(other, stored),
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
  certification?: {
    claim: OriginalClaim;
    prepare: (tx: Tx) => Promise<Certificate | undefined>;
    bounds?: { lock: number; statement: number };
  },
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
      let localCertifiedTimeoutInstalled = false;
      try {
        if (certification?.bounds) {
          await tx.query(
            "SELECT set_config('lock_timeout',$1,true),set_config('statement_timeout',$2,true)",
            [
              String(certification.bounds.lock),
              String(certification.bounds.statement),
            ],
          );
          localCertifiedTimeoutInstalled = true;
        }
        await tx.query("SELECT pg_advisory_xact_lock(182736456,1)");
      } catch (error) {
        const refused = admissionRejection(
          error,
          localCertifiedTimeoutInstalled,
        );
        if (refused) return refused;
        throw error;
      }
      const existing = await classifyExisting(tx, r);
      if (existing) {
        if (
          existing.kind !== "conflict" &&
          certification?.claim.kind === "hash" &&
          (existing.kind === "converged" ||
            existing.kind === "held_by_other") &&
          existing.record.admission?.certificate_hash !==
            certification.claim.hash
        )
          return {
            kind: "rejected",
            code: "provider_admission_certificate_conflict",
          };
        return existing;
      }
      if (certification?.claim.kind === "hash")
        return {
          kind: "rejected",
          code: "provider_admission_original_missing",
        };
      const refused = beforeInsert?.();
      if (refused) return { kind: "rejected", code: refused };
      let certificate: Certificate | undefined;
      try {
        certificate = await certification?.prepare(tx);
      } catch (error) {
        const code = ownedRejection(error);
        if (code) return { kind: "rejected", code };
        const refused = admissionRejection(
          error,
          localCertifiedTimeoutInstalled,
        );
        if (refused) return refused;
        throw error;
      }
      const insert = await tx.attempt(
        `INSERT INTO provider_calls AS c (provider_call_id, attempt_id, provider, operation, model_identifier, request_fingerprint,
         logical_request_key, operational_try_number, intentional_take_index, retry_of_provider_call_id, reroll_of_provider_call_id,
         reroll_trigger_id, started_at,reserved_cost_upper_bound,admission_currency,admission_policy_hash,admission_certificate,admission_certificate_hash)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::int, $9::int, $10::uuid, $11::uuid, $12::uuid, $13::timestamptz,$14::numeric,$15,$16,$17::jsonb,$18)
       RETURNING ${RESERVATION_COLUMNS}, ${ADMISSION_COLUMNS}`,
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
          certificate?.reserved_cost_upper_bound ?? null,
          certificate?.currency ?? null,
          certificate?.policy_hash ?? null,
          certificate ? JSON.stringify(certificate) : null,
          certificate ? certificateHash(certificate) : null,
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
          record: {
            reservation: toReservation(row),
            outcome: null,
            ...toAdmission(row, toReservation(row)),
          },
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
      return (
        admissionRejection(insert.error, localCertifiedTimeoutInstalled) ??
        guessRejection(insert.error) ??
        rethrow(insert.error)
      );
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
  return recordCore(pool, authored, context);
}
async function recordCore(
  pool: Pool,
  authored: AuthoredOutcome,
  context?: CommandContext,
  settlement?: Settlement,
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
      await tx.query("SELECT pg_advisory_xact_lock(182736456,1)");
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
         response_reference,admission_settlement)
       VALUES ($1::uuid, $2, $3::timestamptz, $4::jsonb, $5::numeric, $6, $7::uuid, $8,$9::jsonb)
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
          settlement ? JSON.stringify(settlement) : null,
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
      return (
        admissionRejection(insert.error) ??
        guessRejection(insert.error) ??
        rethrow(insert.error)
      );
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
    `SELECT ${RESERVATION_COLUMNS},${ADMISSION_COLUMNS} FROM provider_calls c WHERE c.provider_call_id = $1::uuid`,
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
    ...toAdmission(row, toReservation(row)),
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
  /** Trusted simulation only: immutable actual text/cap plus ORIGINAL committed certification. */
  admission?: Readonly<{ request: AdmissionRequest; certificate: Certificate }>;
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
  // Missing final Packet is no negative invocation/completion proof for a certified call.
  if (evidence === undefined)
    return found.admission
      ? { status: "unknown", reason: "provider_sim_receipt_invalid" }
      : { status: "not_performed" };
  const res = found.reservation;
  if (found.admission) {
    let projection: ReturnType<typeof projectReceipt>;
    try {
      const d: Partial<Record<string, PropertyDescriptor>> =
        Object.getOwnPropertyDescriptors(evidence);
      for (const name of [
        "provider_call_id",
        "logical_request_key",
        "request_fingerprint",
        "result",
      ])
        if (!d[name] || !("value" in d[name]))
          throw new AdmissionError("provider_sim_receipt_invalid");
      if (
        d.provider_call_id?.value !== res.provider_call_id ||
        d.logical_request_key?.value !== res.logical_request_key ||
        d.request_fingerprint?.value !== res.request_fingerprint
      )
        return {
          status: "unknown",
          reason: "provider_sim_receipt_unattributed",
        };
      projection = projectReceipt(d.result?.value, found.admission.certificate);
    } catch (error) {
      return {
        status: "unknown",
        reason: ownedRejection(error) ?? "provider_sim_receipt_invalid",
      };
    }
    return {
      status: "performed",
      evidence,
      recorded: await recordCore(
        pool,
        projection.outcome,
        recordContext,
        projection.settlement,
      ),
    };
  }
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
        | "provider_not_invoked_canceled"
        | "provider_admission_request_mismatch";
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
        | "provider_observation_canceled"
        | AdmissionCode;
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
  simulation_admission?: unknown;
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
      "simulation_admission",
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
      if (
        property === undefined &&
        (name === "signal" || name === "simulation_admission")
      )
        continue;
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
    if (error instanceof Rejection || error instanceof AdmissionError) {
      const code: unknown = Object.getOwnPropertyDescriptor(
        error,
        "code",
      )?.value;
      if (
        typeof code === "string" &&
        (KNOWN_OUTCOME_CODES.has(code) ||
          (ADMISSION_CODES as readonly string[]).includes(code))
      )
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
  claim: OriginalClaim,
): Promise<ExecuteResult> {
  const guard = () =>
    controls.refusal ??
    (aborted(controls.value?.signal)
      ? "provider_execution_canceled"
      : undefined);
  let invocation: Invocation | undefined;
  const bounds = admissionBounds(controls.value?.simulation_admission);
  const reserved = await reserveCore(pool, reservation, reserveContext, guard, {
    claim,
    ...(bounds ? { bounds } : {}),
    prepare: async (tx) => {
      if (controls.value?.simulation_admission === undefined) return undefined;
      invocation = readInvocation(controls.value.simulation_admission);
      // Complete immutable NEW snapshot only after original identity/slot classification.
      await tx.query(
        "SELECT set_config('lock_timeout',$1,true),set_config('statement_timeout',$2,true)",
        [
          String(invocation.lock_timeout_ms),
          String(invocation.statement_timeout_ms),
        ],
      );
      const row = (
        await tx.query(
          "SELECT program_run_id::text AS run_id FROM program_run_attempts WHERE attempt_id=$1::uuid",
          [reservation.attempt_id],
        )
      ).rows[0];
      if (!row || typeof row.run_id !== "string")
        throw new AdmissionError("provider_admission_certificate_invalid");
      return buildCertificate(
        reservation,
        row.run_id,
        invocation.policy,
        invocation.request,
      );
    },
  });
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
  let request = requestOf(mine);
  if (reserved.record.admission) {
    const cert = reserved.record.admission.certificate,
      r = invocation?.request;
    if (
      !r ||
      Buffer.byteLength(r.input_text, "utf8") !== cert.input_bytes ||
      sha256(Buffer.from(r.input_text, "utf8")) !== cert.input_text_hash ||
      requestHash(r) !== cert.request_fingerprint ||
      r.max_output_bytes !== cert.max_output_bytes
    )
      return {
        status: "unfinished",
        reason: "provider_admission_request_mismatch",
        reservation: mine,
      };
    request = Object.freeze({
      ...request,
      admission: Object.freeze({ request: r, certificate: cert }),
    });
  }
  if (aborted(controlled.signal))
    return {
      status: "unfinished",
      reason: "provider_not_invoked_canceled",
      reservation: mine,
    };
  const observation = await observePerform(adapter, request, controlled);
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
  let settlement: Settlement | undefined;
  try {
    if (reserved.record.admission) {
      // Certified path NEVER invokes generic finish. This projector is synchronous/pure and original-bound.
      const projection = projectReceipt(
        observation.value,
        reserved.record.admission.certificate,
      );
      authored = projection.outcome;
      settlement = projection.settlement;
    } else {
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
    }
  } catch (error) {
    // `perform` itself was acknowledged (facts.perform stays "performed"); only the outcome could not be produced, so the WORKFLOW
    // status is ambiguous while the perform fact is not rewritten.
    return {
      status: "ambiguous",
      reservation: mine,
      code: reserved.record.admission
        ? ((ownedRejection(error) as AdmissionCode | undefined) ??
          "provider_sim_receipt_invalid")
        : "provider_finish_ambiguous",
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
  const outcome = await recordCore(pool, authored, recordContext, settlement);
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
  const claim = extractOriginalClaim(controls);
  if (claim.kind === "invalid") {
    emitPreflight(
      {
        context: stageContext(base, "reserve", authored.attempt_id, undefined),
        command: "provider_call.reserve",
        subject: {
          provider_call_id: authored.provider_call_id,
          attempt_id: authored.attempt_id,
        },
      },
      "provider_admission_original_claim_invalid",
    );
    return {
      status: "rejected",
      result: {
        kind: "rejected",
        code: "provider_admission_original_claim_invalid",
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
      claim,
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
    ...(result.status === "unfinished" &&
    result.reason === "provider_admission_request_mismatch"
      ? { code: result.reason }
      : {}),
    provider_call_id: authored.provider_call_id,
    reservation: facts.reservation,
    perform: facts.perform,
    outcome_record: facts.outcome_record,
  });
  return result;
}
