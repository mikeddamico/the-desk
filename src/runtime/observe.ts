// A5 G3-prep: command-level observability. A closed, value-validated, FLAT event projected from what a command actually did, and the
// single safe emission path. G3 itself stays OPEN: nothing here creates a logger, a process entry or a correlation origin; a real
// runner path that emits configured logs does not exist yet (Handoff Deliver l.187 / Standards 20 remain unmet end to end).
//
// Privacy by construction: `projectEvent` PICKS keys (it never spreads or serializes an input) and validates every VALUE against a closed
// set, a canonical UUID, a 64-hex hash or a safe integer. A value that does not validate is OMITTED (with a `*_known:false` marker where
// a closed set applies), never passed through. No message, SQL text, payload, usage, cost, response reference or error name can reach
// an event; errors are reduced to a closed class.
//
// Noninterference (bounded, and exactly this): emission happens after the command result/error and its cleanup are established; an
// observer exception, a rejected promise returned by an observer, or a failing reporter never changes that result, that error, or the
// cleanup errors. It does NOT bound how long an observer runs, and it does not guarantee delivery to any sink.
import type { Pool } from "pg";

export const COMMANDS = [
  "evidence_unit.persist",
  "claim_event.append",
  "evidence_package.persist",
  "package.bind",
  "provider_call.reserve",
  "provider_outcome.record",
  "program_run.create",
  "program_attempt.create",
] as const;
export type CommandName = (typeof COMMANDS)[number];
export const WORKFLOWS = [
  "evidence_slice.run",
  "provider_call.execute",
  "provider_call.reconcile",
] as const;
export type WorkflowName = (typeof WORKFLOWS)[number];
export const STAGES = [
  "standalone",
  "S1_evidence_unit",
  "S2_evidence_package",
  "S3_binding",
  "reserve",
  "perform",
  "record",
  "reconcile",
  // fixed WORKFLOW-level stages (the label of a workflow.completed event); child command events keep their own actual stages
  "evidence_slice",
  "provider_execute",
  "provider_reconcile",
] as const;
export type Stage = (typeof STAGES)[number];
export const OUTCOMES = [
  "created",
  "converged",
  "held_by_other",
  "conflict",
  "rejected",
  "error",
] as const;
export type EventOutcome = (typeof OUTCOMES)[number];
export const RUN_ID_STATUSES = [
  "derived",
  "attempt_not_found",
  "lookup_failed",
] as const;
export type RunIdStatus = (typeof RUN_ID_STATUSES)[number];
export const DURABILITIES = ["committed", "not_committed", "unknown"] as const;
export type Durability = (typeof DURABILITIES)[number];
export const ERROR_CLASSES = [
  "CommandConnectionError",
  "Rejection",
  "ClaimStateError",
  "unclassified",
] as const;
export type ErrorClass = (typeof ERROR_CLASSES)[number];
export const PROVIDER_OUTCOME_TYPES = [
  "succeeded",
  "retryable_failure",
  "terminal_failure",
] as const;
/** Providers and operations of the supported contract (Fixture v0.4.6 provider ledger; P&R v0.1.4 `fixture_tts`). Anything else is omitted. */
export const KNOWN_PROVIDERS = ["fixture_stub", "fixture_tts"] as const;
export const KNOWN_OPERATIONS = [
  "craft_critic",
  "showrunner_planner",
  "speech_texture",
  "tts",
  "writer",
  "writer_revision",
] as const;
/** Workflow facts (not transaction durability): fixed vocabularies. */
export const WORKFLOW_STATUSES = [
  "complete",
  "stopped",
  "performed",
  "completed",
  "unfinished",
  "ambiguous",
  "conflict",
  "rejected",
  "recorded",
  "not_performed",
  "unknown",
  "error",
] as const;
export const PERFORM_STATES = [
  "performed",
  "not_attempted",
  "ambiguous",
] as const;
export const OUTCOME_RECORD_STATES = [
  "created",
  "converged",
  "conflict",
  "rejected",
  "not_attempted",
  "absent",
  /** the record command was attempted but threw: its result is not known */
  "unknown",
] as const;
export const RECONCILE_REASONS = [
  "reservation_not_found",
  "adapter_has_no_lookup",
  "lookup_failed",
  "evidence_not_bound_to_reservation",
  "provider_sim_receipt_invalid",
  "provider_sim_receipt_unattributed",
  "provider_sim_receipt_binding_invalid",
] as const;
export const SLICE_STEPS = [
  "S1_evidence_unit",
  "S2_evidence_package",
  "S2_snapshot_verification",
  "S3_binding",
] as const;

/**
 * The closed set of outcome/rejection codes the runtime can produce today (collected from the code literals of src/runtime and
 * src/knowledge). An unknown code is omitted and marked `code_known:false`; it is never passed through. A source-scanning test is only a
 * supplementary drift check: behavior/canary tests are the proof.
 */
export const KNOWN_OUTCOME_CODES: ReadonlySet<string> = new Set([
  "actor_not_found",
  "artifact_differs_for_hash",
  "artifact_id_occupied",
  "artifact_type_mismatch",
  "attempt_bound_to_other_package",
  "attempt_not_found",
  "attempt_not_pending",
  "body_hash",
  "body_hash_mismatch",
  "body_not_nfc",
  "ceiling_for_unrequested_claim",
  "ceiling_missing",
  "check_rejected",
  "config_not_found",
  "config_show_mismatch",
  "program_attempt_identity_conflict",
  "program_run_identity_conflict",
  "publication_not_permitted",
  "purpose_invalid",
  "repair_not_supported",
  "run_config_binding_mismatch",
  "run_not_found",
  "show_not_found",
  "unsupported_field",
  "claim_asserted_at_invalid",
  "claim_content_hash_mismatch",
  "claim_not_found",
  "claim_request_invalid",
  "content",
  "cost_currency_pairing",
  "created_at",
  "cursor_event_unknown",
  "cursor_not_in_visible_set",
  "cursor_older_than_visible_event",
  "cursor_sequence_mismatch",
  "cursor_sequence_not_positive",
  "cursor_sequence_out_of_range",
  "cursor_sequence_type",
  "cursor_shape",
  "cursor_with_empty_visibility",
  "cursor_wrong_claim",
  "duplicate_event_identity",
  "duplicate_event_identity_conflict",
  "duplicate_sequence",
  "entry_claim_mismatch",
  "entry_content_hash_mismatch",
  "entry_effective_less_strict_than_reduced",
  "entry_effective_usage_mismatch",
  "entry_initial_fields_mismatch",
  "entry_reduction_mismatch",
  "entry_shape",
  "entry_state_hash_mismatch",
  "entry_state_vocabulary",
  "event_wrong_claim",
  "evidence_package_id_occupied",
  "first_sequence_not_one",
  "guard_rejected",
  "internal_missing",
  "invalid_body",
  "invalid_ceiling",
  "invalid_cost",
  "invalid_currency",
  "invalid_event_identity",
  "invalid_event_shape",
  "invalid_event_type",
  "invalid_evidence_type",
  "invalid_hash",
  "invalid_initial_status",
  "invalid_initial_usage_class",
  "invalid_integer",
  "invalid_json",
  "invalid_occurred_at",
  "invalid_payload",
  "invalid_snapshot",
  "invalid_source_identity",
  "invalid_string",
  "invalid_through",
  "invalid_timestamp",
  "invalid_usage_class",
  "invalid_uuid",
  "isolation_unsupported",
  "log_first_sequence_not_one",
  "manifest_differs",
  "manifest_differs_for_hash",
  "null_cursor_with_nonempty_prefix",
  "null_cursor_with_visible_events",
  "observer_context_invalid",
  "outcome_binding_mismatch",
  "provider_admission_unavailable",
  "provider_admission_original_claim_invalid",
  "provider_admission_original_missing",
  "provider_admission_certificate_conflict",
  "provider_sim_receipt_invalid",
  "provider_sim_receipt_unattributed",
  "provider_sim_receipt_binding_invalid",
  "provider_admission_retry_work_not_ended",
  "provider_admission_policy_invalid",
  "provider_admission_certificate_invalid",
  "provider_admission_policy_conflict",
  "provider_admission_legacy_unaccounted",
  "provider_admission_breach",
  "provider_admission_clock_reversed",
  "provider_admission_attempt_cost",
  "provider_admission_run_cost",
  "provider_admission_day_cost",
  "provider_admission_reservation_limit",
  "provider_admission_retry_limit",
  "provider_admission_reroll_disabled",
  "provider_admission_concurrency_limit",
  "provider_admission_rate_limit",
  "provider_admission_spacing_limit",
  "provider_admission_request_mismatch",
  "provider_admission_local_timeout",
  "provider_controls_invalid",
  "provider_execution_disabled",
  "provider_execution_canceled",
  "provider_not_invoked_canceled",
  "provider_reservation_invalid",
  "provider_perform_ambiguous",
  "provider_finish_ambiguous",
  "provider_observation_timeout",
  "provider_observation_canceled",
  "provider_execution_failed",
  "provider_execution_commit_unknown",
  "outcome_differs",
  "package_artifact_id_mismatch",
  "package_claim_fields",
  "package_claim_not_found",
  "package_claim_subject_mismatch",
  "package_claim_subject_unsupported",
  "package_evidence_ambiguous",
  "package_evidence_body_hash_mismatch",
  "package_evidence_exposure_exceeds_rights",
  "package_evidence_fields",
  "package_evidence_permission_exceeds_rights",
  "package_evidence_unit_not_found",
  "package_hash_field_mismatch",
  "package_id_mismatch",
  "package_not_found",
  "package_scope_hash_mismatch",
  "package_scope_invalid",
  "package_support_hash_mismatch",
  "package_support_kind_unsupported",
  "package_support_ref_shape",
  "package_support_rows_mismatch",
  "package_support_target_not_found",
  "package_support_unit_not_in_package",
  "package_units_mismatch",
  "prefix_row_differs_from_visible",
  "provenance_snapshot",
  "reference_not_found",
  "reservation_fields_differ",
  "reservation_not_found",
  "retry_already_reserved",
  "retry_duplicate_transition",
  "review_request_invalid",
  "review_role_denied",
  "review_candidate_missing",
  "review_candidate_binding",
  "review_candidate_advanced",
  "review_policy_invalid",
  "review_event_conflict",
  "review_candidate_decided",
  "review_deadline_elapsed",
  "review_actor_invalid",
  "rights",
  "rights_policy_malformed",
  "rights_policy_not_object",
  "self_supersession",
  "sequence_not_above_head",
  "sequence_not_integer",
  "sequence_not_positive",
  "sequence_out_of_range",
  "slice_snapshot_package_entry_mismatch",
  "slice_unit_duplicate",
  "slice_unit_package_entry_mismatch",
  "slice_units_package_mismatch",
  "snapshot_required_for_verification",
  "snapshot_source_not_covered_by_rights",
  "snapshot_unit_mismatch",
  "snapshot_unit_not_in_identified_package",
  "stored_hash_mismatch",
  "stored_invalid",
  "stored_package_hash_mismatch",
  "stored_package_invalid",
  "supersedes_unit_not_found",
  "supersession",
  "timestamp_precision",
  "unit_rights_identity_mismatch",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const KEY_RE = /^(v1:)?[0-9a-f]{64}(:[0-9]{1,9})?$/;

const uuid = (v: unknown): string | undefined =>
  typeof v === "string" && UUID_RE.test(v) ? v : undefined;
const hash64 = (v: unknown): string | undefined =>
  typeof v === "string" && HASH_RE.test(v) ? v : undefined;
const safeInt = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : undefined;
const oneOf = <T extends string>(
  set: readonly T[],
  v: unknown,
): T | undefined =>
  typeof v === "string" && (set as readonly string[]).includes(v)
    ? (v as T)
    : undefined;

/** Returns `unknown`: an `async` observer returns a Promise, and the return value is only ever inspected for a rejection. */
/** Reads a request field defensively: a malformed request must never make observability throw. */
export const peek = (read: () => unknown): unknown => {
  try {
    return read();
  } catch {
    return undefined;
  }
};

export type CommandObserver = (event: CommandEvent) => unknown;

/** What a caller declares at a workflow entry point (no stage: a workflow sets its own stages). */
export interface ObserverContext {
  /** A canonical lowercase UUID (no external correlation contract exists in this repository). */
  correlationId: string;
  observer: CommandObserver;
}
/** What a command receives: the declared context plus the stage and the identifiers the workflow derived. */
export interface CommandContext extends ObserverContext {
  stage: Stage;
  attemptId?: string;
  runId?: string;
  runIdStatus?: RunIdStatus;
}

export type ReadContext =
  | { ok: true; context: ObserverContext }
  | { ok: false; problem: string };

/**
 * Validates a declared context at RUNTIME (types alone are not enforcement) and returns a plain SNAPSHOT whose `correlationId` and
 * `observer` were each read exactly once: a malformed object or a throwing getter yields a fixed problem, never an exception, and no
 * property of the caller's object is read again afterwards.
 */
export function readContext(context: unknown): ReadContext {
  try {
    if (typeof context !== "object" || context === null)
      return { ok: false, problem: "context_missing" };
    const c = context as { correlationId?: unknown; observer?: unknown };
    const correlationId = c.correlationId;
    const observer = c.observer;
    const id = uuid(correlationId);
    if (id === undefined)
      return { ok: false, problem: "correlation_id_invalid" };
    if (typeof observer !== "function")
      return { ok: false, problem: "observer_missing" };
    return {
      ok: true,
      context: { correlationId: id, observer: observer as CommandObserver },
    };
  } catch {
    return { ok: false, problem: "context_unreadable" };
  }
}

/** `undefined` when the context is usable, else a fixed reason. */
export function contextProblem(context: unknown): string | undefined {
  const r = readContext(context);
  return r.ok ? undefined : r.problem;
}

export const SUBJECT_KEYS = [
  "program_run_id",
  "evidence_unit_id",
  "rights_version_id",
  "claim_id",
  "claim_state_event_id",
  "artifact_id",
  "evidence_package_id",
  "package_hash",
  "provider_call_id",
  "attempt_id",
  "provider",
  "operation",
  "operational_try_number",
  "intentional_take_index",
  "logical_request_key",
  "provider_outcome_type",
] as const;
export type SubjectKey =
  | "program_run_id"
  | "evidence_unit_id"
  | "rights_version_id"
  | "claim_id"
  | "claim_state_event_id"
  | "artifact_id"
  | "evidence_package_id"
  | "package_hash"
  | "provider_call_id"
  | "attempt_id"
  | "provider"
  | "operation"
  | "operational_try_number"
  | "intentional_take_index"
  | "logical_request_key"
  | "provider_outcome_type";
/** The command's own request fields, UNVALIDATED (they may be garbage); `projectEvent` validates each value. */
export type Subject = Partial<Record<SubjectKey, unknown>>;

export interface CommandTrace {
  context: CommandContext;
  command: CommandName;
  subject: Subject;
}

export interface CommandEvent {
  event: "command.completed" | "workflow.completed";
  command?: CommandName;
  workflow?: WorkflowName;
  stage: Stage;
  correlation_id: string;
  run_id?: string;
  run_id_status?: RunIdStatus;
  attempt_id?: string;
  program_run_id?: string;
  evidence_unit_id?: string;
  rights_version_id?: string;
  claim_id?: string;
  claim_state_event_id?: string;
  artifact_id?: string;
  evidence_package_id?: string;
  package_hash?: string;
  provider_call_id?: string;
  provider?: string;
  provider_known?: boolean;
  operation?: string;
  operation_known?: boolean;
  operational_try_number?: number;
  intentional_take_index?: number;
  logical_request_key?: string;
  provider_outcome_type?: string;
  outcome?: EventOutcome;
  code?: string;
  code_known?: boolean;
  durability?: Durability;
  connection?: {
    phase: "before_commit" | "commit" | "rollback";
    commit_outcome: "not_attempted" | "unknown";
    sqlstate?: "57P01";
  };
  error_class?: ErrorClass;
  cleanup_failures?: number;
  duration_ms: number;
  // workflow-only facts (a workflow is several transactions: there is no single committed flag here)
  status?: string;
  complete?: boolean;
  reservation?: string;
  perform?: string;
  outcome_record?: string;
  reconcile_reason?: string;
  steps_total?: number;
  steps_created?: number;
  steps_converged?: number;
  steps_held_by_other?: number;
  steps_conflict?: number;
  steps_rejected?: number;
  stopped_step?: string;
  stopped_outcome?: string;
  stopped_code?: string;
}

/** Everything a builder may offer; each value is validated by `projectEvent`. */
export type RawEvent = Record<string, unknown>;

const SUBJECT_UUIDS: SubjectKey[] = [
  "program_run_id",
  "evidence_unit_id",
  "rights_version_id",
  "claim_id",
  "claim_state_event_id",
  "artifact_id",
  "evidence_package_id",
  "provider_call_id",
];

/**
 * Picks and validates. Never spreads and never copies an unvalidated value. It does not throw on plain data; an input with a throwing
 * getter or Proxy CAN throw here, and that is contained by `safeEmit` (the event is dropped and the command is unaffected).
 */
export function projectEvent(raw: RawEvent): CommandEvent {
  const e: CommandEvent = {
    event:
      raw.event === "workflow.completed"
        ? "workflow.completed"
        : "command.completed",
    stage: oneOf(STAGES, raw.stage) ?? "standalone",
    correlation_id: uuid(raw.correlation_id) ?? "invalid",
    duration_ms:
      typeof raw.duration_ms === "number"
        ? (safeInt(Math.round(raw.duration_ms)) ?? 0)
        : 0,
  };
  if (e.event === "command.completed")
    e.outcome = oneOf(OUTCOMES, raw.outcome) ?? "error";
  else {
    const wo = oneOf(OUTCOMES, raw.outcome);
    if (wo) e.outcome = wo;
  }
  const command = oneOf(COMMANDS, raw.command);
  if (command) e.command = command;
  const workflow = oneOf(WORKFLOWS, raw.workflow);
  if (workflow) e.workflow = workflow;
  const runId = uuid(raw.run_id);
  if (runId) e.run_id = runId;
  const runStatus = oneOf(RUN_ID_STATUSES, raw.run_id_status);
  if (runStatus) e.run_id_status = runStatus;
  const attempt = uuid(raw.attempt_id);
  if (attempt) e.attempt_id = attempt;
  for (const k of SUBJECT_UUIDS) {
    const v = uuid(raw[k]);
    if (v) (e as unknown as Record<string, unknown>)[k] = v;
  }
  const ph = hash64(raw.package_hash);
  if (ph) e.package_hash = ph;
  // The projection is IDEMPOTENT (the logger adapter re-projects an already projected event): a value omitted by a first pass leaves
  // only its `*_known:false` marker, which a second pass must keep.
  if (raw.provider !== undefined) {
    const p = oneOf(KNOWN_PROVIDERS, raw.provider);
    if (p) e.provider = p;
    e.provider_known = p !== undefined;
  } else if (raw.provider_known === false) e.provider_known = false;
  if (raw.operation !== undefined) {
    const o = oneOf(KNOWN_OPERATIONS, raw.operation);
    if (o) e.operation = o;
    e.operation_known = o !== undefined;
  } else if (raw.operation_known === false) e.operation_known = false;
  const tryN = safeInt(raw.operational_try_number);
  if (tryN !== undefined) e.operational_try_number = tryN;
  const take = safeInt(raw.intentional_take_index);
  if (take !== undefined) e.intentional_take_index = take;
  if (
    typeof raw.logical_request_key === "string" &&
    KEY_RE.test(raw.logical_request_key)
  )
    e.logical_request_key = raw.logical_request_key;
  const pot = oneOf(PROVIDER_OUTCOME_TYPES, raw.provider_outcome_type);
  if (pot) e.provider_outcome_type = pot;
  if (raw.code !== undefined) {
    const known =
      typeof raw.code === "string" && KNOWN_OUTCOME_CODES.has(raw.code);
    if (known) e.code = raw.code as string;
    e.code_known = known;
  } else if (raw.code_known === false) e.code_known = false;
  // TRANSACTION facts (durability, the connection/commit-outcome detail) describe ONE command transaction and exist ONLY on
  // `command.completed`. A workflow spans several transactions, so a `workflow.completed` input carrying them (a malformed event handed
  // to the public logger adapter, for instance) has them dropped: the contract is "no single committed flag" for a workflow.
  const isCommand = e.event === "command.completed";
  const dur = oneOf(DURABILITIES, raw.durability);
  if (isCommand && dur) e.durability = dur;
  const conn = raw.connection as
    | { phase?: unknown; commit_outcome?: unknown; sqlstate?: unknown }
    | null
    | undefined;
  if (isCommand && typeof conn === "object" && conn !== null) {
    const phase = oneOf(
      ["before_commit", "commit", "rollback"] as const,
      conn.phase,
    );
    const co = oneOf(
      ["not_attempted", "unknown"] as const,
      conn.commit_outcome,
    );
    if (phase && co)
      e.connection = {
        phase,
        commit_outcome: co,
        ...(conn.sqlstate === "57P01" ? { sqlstate: "57P01" as const } : {}),
      };
  }
  const ec = oneOf(ERROR_CLASSES, raw.error_class);
  if (ec) e.error_class = ec;
  const cf = safeInt(raw.cleanup_failures);
  if (isCommand && cf !== undefined && cf > 0) e.cleanup_failures = cf;
  // workflow-only
  const status = oneOf(WORKFLOW_STATUSES, raw.status);
  if (status) e.status = status;
  if (typeof raw.complete === "boolean") e.complete = raw.complete;
  const res = oneOf(
    ["created", "converged", "held_by_other", "conflict", "rejected"] as const,
    raw.reservation,
  );
  if (res) e.reservation = res;
  const perf = oneOf(PERFORM_STATES, raw.perform);
  if (perf) e.perform = perf;
  const rec = oneOf(OUTCOME_RECORD_STATES, raw.outcome_record);
  if (rec) e.outcome_record = rec;
  const rr = oneOf(RECONCILE_REASONS, raw.reconcile_reason);
  if (rr) e.reconcile_reason = rr;
  for (const k of [
    "steps_total",
    "steps_created",
    "steps_converged",
    "steps_held_by_other",
    "steps_conflict",
    "steps_rejected",
  ] as const) {
    const v = safeInt(raw[k]);
    if (v !== undefined) e[k] = v;
  }
  const ss = oneOf(SLICE_STEPS, raw.stopped_step);
  if (ss) e.stopped_step = ss;
  const so = oneOf(OUTCOMES, raw.stopped_outcome);
  if (so) e.stopped_outcome = so;
  if (
    typeof raw.stopped_code === "string" &&
    KNOWN_OUTCOME_CODES.has(raw.stopped_code)
  )
    e.stopped_code = raw.stopped_code;
  return e;
}

const reportObserverFailure = (): void => {
  try {
    process.stderr.write("command observer failed; event dropped\n");
  } catch {
    // The reporter itself failed (e.g. a closed stderr). Nothing further can be reported, and the command result is already established.
  }
};

/**
 * The ONLY emission path. EVERYTHING instrumentation-related happens inside the one `try`: resolving the observer, reading the trace,
 * the context and the request fields, computing durability facts, projecting and calling the observer. A synchronous throw (including a
 * throwing getter or Proxy anywhere in the inputs), a Promise rejection returned by an `async` observer, or a failing reporter is
 * contained here and never reaches the command; the primary result/error/cleanup errors are never inside this `try`.
 */
export function safeEmit(
  resolve: () => { observer: CommandObserver; event: RawEvent },
): void {
  try {
    const { observer, event } = resolve();
    const out = observer(projectEvent(event));
    if (
      typeof out === "object" &&
      out !== null &&
      typeof (out as { then?: unknown }).then === "function"
    )
      (out as PromiseLike<unknown>).then(undefined, reportObserverFailure);
  } catch {
    reportObserverFailure();
  }
}

export type AttemptRun =
  | { status: "derived"; runId: string }
  | { status: "attempt_not_found" }
  | { status: "lookup_failed" };

/**
 * Derives the run id of an attempt from the database (one non-transactional read; `desk_runtime` has SELECT). Never throws: a failed
 * lookup is reported as `lookup_failed` and must never change a domain result. Not used when the attempt id is not a canonical UUID.
 */
export async function readAttemptRun(
  pool: Pick<Pool, "query">,
  attemptId: unknown,
): Promise<AttemptRun | undefined> {
  const id = uuid(attemptId);
  if (id === undefined) return undefined;
  try {
    const r = await pool.query(
      "SELECT program_run_id::text AS run_id FROM program_run_attempts WHERE attempt_id = $1::uuid",
      [id],
    );
    const runId = uuid((r.rows[0] as { run_id?: unknown } | undefined)?.run_id);
    return runId
      ? { status: "derived", runId }
      : { status: "attempt_not_found" };
  } catch {
    return { status: "lookup_failed" };
  }
}

/** Child context for one stage of a workflow: carries the derived identifiers into every command event. */
export function stageContext(
  base: ObserverContext,
  stage: Stage,
  attemptId: string | undefined,
  run: AttemptRun | undefined,
): CommandContext {
  return {
    correlationId: base.correlationId,
    observer: base.observer,
    stage,
    ...(attemptId !== undefined ? { attemptId } : {}),
    ...(run?.status === "derived" ? { runId: run.runId } : {}),
    ...(run ? { runIdStatus: run.status } : {}),
  };
}
