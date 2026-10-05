// Foundation dev/test READY socket, not a Build2 producer or revalidation implementation.
// Cooperative admission only: raw privileged SQL does not take this lock and can bypass deadline admission.
// Existing role model is assumed beyond the explicit capabilities below; actor_kind is not principal authentication.
import type { Pool } from "pg";
import type { Config } from "../config.js";
import { showConfigVersionHash } from "../identity/show-config.js";
import {
  faultPoint,
  Rejection,
  requireHex64,
  requireUuid,
  runCommand,
  type Outcome,
  type Row,
  type Tx,
} from "./command.js";

// Version 1 namespace; a hash collision only serializes unrelated candidates, never aliases their identity.
export const REVIEW_WAIT_LOCK_CLASS = 182736471;
export const REVIEW_WAIT_CODES = [
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
] as const;
export interface Candidate {
  run_id: string;
  attempt_id: string;
  episode_version_id: string;
  ready_candidate_fingerprint: string;
}
export interface Submission extends Candidate {
  review_decision_id: string;
  actor_id: string;
  decision: "approve" | "request_repair" | "halt";
}
export interface Receipt extends Submission {
  decided_at: string;
}
export interface WaitRecord extends Candidate {
  status: "pending" | "approve" | "request_repair" | "halted";
  deadline?: string;
  receipt?: Receipt;
  halt_cause?: "observed_expiry" | "observed_operator_halt" | "unknown";
}

export function validateReviewRequest(
  input: unknown,
  submission = false,
): Candidate | Submission {
  try {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new Error();
    const row = input as Row;
    const keys = [
      "run_id",
      "attempt_id",
      "episode_version_id",
      "ready_candidate_fingerprint",
      ...(submission ? ["review_decision_id", "actor_id", "decision"] : []),
    ];
    if (
      Object.keys(row).length !== keys.length ||
      keys.some((k) => !Object.hasOwn(row, k))
    )
      throw new Error();
    const candidate: Candidate = {
      run_id: requireUuid(row.run_id, "run"),
      attempt_id: requireUuid(row.attempt_id, "attempt"),
      episode_version_id: requireUuid(row.episode_version_id, "candidate"),
      ready_candidate_fingerprint: requireHex64(
        row.ready_candidate_fingerprint,
        "fingerprint",
      ),
    };
    if (!submission) return candidate;
    if (
      row.decision !== "approve" &&
      row.decision !== "request_repair" &&
      row.decision !== "halt"
    )
      throw new Error();
    return {
      ...candidate,
      review_decision_id: requireUuid(row.review_decision_id, "event"),
      actor_id: requireUuid(row.actor_id, "actor"),
      decision: row.decision,
    };
  } catch {
    throw new Rejection("review_request_invalid");
  }
}

async function assertRole(tx: Tx, operator: boolean): Promise<void> {
  // Both authenticated-login and effective-role capabilities checked; no runtime migration privilege.
  const result = await tx.query(
    `SELECT current_user = $1 AND NOT r.rolsuper AND NOT r.rolcreaterole AND NOT r.rolcreatedb
    AND NOT pg_has_role(session_user, 'desk_migrator', 'MEMBER')
    AND NOT has_schema_privilege(current_user, 'public', 'CREATE')
    AND NOT has_schema_privilege(session_user, 'public', 'CREATE')
    AND NOT has_table_privilege(current_user, 'show_config_versions', 'INSERT')
    AND NOT has_table_privilege(session_user, 'show_config_versions', 'INSERT')
    AND has_table_privilege(current_user, 'review_decisions', 'INSERT') = $2
    AND pg_has_role(session_user, 'desk_operator', 'MEMBER') = $2 AS allowed
    FROM pg_roles r WHERE r.rolname = session_user`,
    [operator ? "desk_operator" : "desk_runtime", operator],
  );
  if (result.rows[0]?.allowed !== true)
    throw new Rejection("review_role_denied");
}
async function lock(tx: Tx, candidate: Candidate): Promise<void> {
  await tx.query("SELECT pg_advisory_xact_lock($1, hashtext($2::text))", [
    REVIEW_WAIT_LOCK_CLASS,
    candidate.episode_version_id,
  ]);
  await faultPoint("review_after_lock");
}
const stamp = (column: string): string =>
  `to_char((${column}) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
async function candidateRow(tx: Tx, input: Candidate): Promise<Row> {
  const r = (
    await tx.query(
      `SELECT v.*, a.program_run_id, a.show_config_version_id, a.state AS attempt_state,
    a.publication_enabled AS attempt_publication, r.show_id, r.purpose,
    r.show_config_version_id AS run_config_id, r.publication_enabled AS run_publication,
    e.program_run_id AS episode_run_id, aa.artifact_id AS audio_master, aa.audio_sha256,
    art.content_hash AS master_hash, c.show_id AS config_show_id, c.config_hash,
    c.schema_version, c.canonical_payload, c.pre_publish_review_required
    FROM episode_versions v JOIN program_run_attempts a USING (attempt_id)
    JOIN program_runs r USING (program_run_id) JOIN episodes e USING (episode_id)
    JOIN audio_artifacts aa ON aa.artifact_id = v.master_artifact_id
    JOIN artifacts art ON art.artifact_id = aa.artifact_id
    JOIN show_config_versions c ON c.show_config_version_id = a.show_config_version_id
    WHERE v.episode_version_id = $1`,
      [input.episode_version_id],
    )
  ).rows[0];
  if (!r) throw new Rejection("review_candidate_missing");
  if (
    r.program_run_id !== input.run_id ||
    r.attempt_id !== input.attempt_id ||
    r.ready_candidate_fingerprint !== input.ready_candidate_fingerprint ||
    r.episode_run_id !== input.run_id ||
    r.run_config_id !== r.show_config_version_id ||
    r.config_show_id !== r.show_id ||
    r.status !== "READY" ||
    r.audio_master !== r.master_artifact_id ||
    r.audio_sha256 !== r.master_hash
  )
    throw new Rejection("review_candidate_binding");
  return r;
}
function policy(row: Row): number {
  try {
    const payload = row.canonical_payload as Row;
    const timeout = payload.pre_publish_review_timeout_seconds;
    if (
      showConfigVersionHash({ ...row, show_id: row.config_show_id }) !==
        row.config_hash ||
      row.purpose !== "production" ||
      row.attempt_publication !== false ||
      row.run_publication !== false ||
      payload.publication_enabled !== false ||
      row.pre_publish_review_required !== true ||
      payload.pre_publish_review_policy !== "required" ||
      payload.pre_publish_review_required !== true ||
      typeof timeout !== "number" ||
      !Number.isSafeInteger(timeout) ||
      timeout <= 0 ||
      timeout > 2147483647
    )
      throw new Error();
    return timeout;
  } catch {
    throw new Rejection("review_policy_invalid");
  }
}
async function deadline(
  tx: Tx,
  candidate: Candidate,
  seconds: number,
): Promise<{ deadline: string; elapsed: boolean }> {
  // PostgreSQL performs addition and comparison with its full timestamptz precision; never JS Date milliseconds.
  const r = (
    await tx.query(
      `SELECT ${stamp("created_at + $2::integer * interval '1 second'")} AS deadline,
    clock_timestamp() >= created_at + $2::integer * interval '1 second' AS elapsed
    FROM episode_versions WHERE episode_version_id = $1`,
      [candidate.episode_version_id, seconds],
    )
  ).rows[0];
  if (!r || typeof r.deadline !== "string" || typeof r.elapsed !== "boolean")
    throw new Rejection("review_candidate_missing");
  return { deadline: r.deadline, elapsed: r.elapsed };
}
async function receipt(
  tx: Tx,
  clause: "event" | "candidate",
  id: string,
): Promise<Receipt | undefined> {
  const r = (
    await tx.query(
      `SELECT d.review_decision_id, d.episode_version_id, d.actor_id,
    d.ready_candidate_fingerprint, d.decision, ${stamp("d.decided_at")} AS decided_at,
    a.program_run_id AS run_id, v.attempt_id FROM review_decisions d
    JOIN episode_versions v USING (episode_version_id) JOIN program_run_attempts a USING (attempt_id)
    WHERE ${clause === "event" ? "d.review_decision_id" : "d.episode_version_id"} = $1`,
      [id],
    )
  ).rows[0];
  return r as unknown as Receipt | undefined;
}
function sameReceipt(stored: Receipt, input: Submission): boolean {
  return (Object.keys(input) as (keyof Submission)[]).every(
    (k) => stored[k] === input[k],
  );
}
async function halt(tx: Tx, input: Candidate): Promise<void> {
  await tx.query("SELECT transition_attempt($1,'READY','HALTED')", [
    input.attempt_id,
  ]);
  await faultPoint("review_after_halt_before_commit");
}

export async function resumeReviewWait(
  pool: Pool,
  request: unknown,
  config: Pick<Config, "DESK_ENV">,
): Promise<Outcome<WaitRecord>> {
  if (config.DESK_ENV !== "development" && config.DESK_ENV !== "test")
    throw new Rejection("review_request_invalid");
  const input = validateReviewRequest(request);
  return runCommand<WaitRecord>(pool, async (tx) => {
    await assertRole(tx, false);
    await lock(tx, input);
    const row = await candidateRow(tx, input);
    // HALTED never resumes and needs no current policy/deadline authorization. The row carries no durable cause.
    if (row.attempt_state === "HALTED")
      return {
        kind: "converged",
        record: { ...input, status: "halted", halt_cause: "unknown" },
      };
    if (row.attempt_state !== "READY")
      throw new Rejection("review_candidate_advanced");
    const seconds = policy(row);
    const decision = await receipt(tx, "candidate", input.episode_version_id);
    const time = await deadline(tx, input, seconds);
    // A committed exact decision on current READY wins even when this invocation starts after the deadline.
    if (decision) {
      if (decision.decision === "halt") {
        await halt(tx, input);
        return {
          kind: "created",
          record: {
            ...input,
            deadline: time.deadline,
            status: "halted",
            halt_cause: "observed_operator_halt",
            receipt: decision,
          },
        };
      }
      return {
        kind: "converged",
        record: {
          ...input,
          deadline: time.deadline,
          status: decision.decision,
          receipt: decision,
        },
      };
    }
    if (time.elapsed) {
      await halt(tx, input);
      return {
        kind: "created",
        record: {
          ...input,
          deadline: time.deadline,
          status: "halted",
          halt_cause: "observed_expiry",
        },
      };
    }
    return {
      kind: "converged",
      record: { ...input, deadline: time.deadline, status: "pending" },
    };
  });
}

export async function submitReviewDecision(
  pool: Pool,
  request: unknown,
  config: Pick<Config, "DESK_ENV">,
): Promise<Outcome<Receipt>> {
  if (config.DESK_ENV !== "development" && config.DESK_ENV !== "test")
    throw new Rejection("review_request_invalid");
  const input = validateReviewRequest(request, true) as Submission;
  return runCommand<Receipt>(pool, async (tx) => {
    await assertRole(tx, true);
    await lock(tx, input);
    const prior = await receipt(tx, "event", input.review_decision_id);
    // Recover BEFORE new-work state/policy/actor/clock checks. This receipt grants no execution permission.
    if (prior) {
      if (!sameReceipt(prior, input))
        return {
          kind: "conflict",
          code: "review_event_conflict",
          stored: null,
          detail: "",
        };
      return { kind: "converged", record: prior };
    }
    const row = await candidateRow(tx, input);
    if (row.attempt_state !== "READY")
      throw new Rejection("review_candidate_advanced");
    const seconds = policy(row);
    if (await receipt(tx, "candidate", input.episode_version_id))
      throw new Rejection("review_candidate_decided");
    const actor = (
      await tx.query("SELECT actor_kind FROM accounts WHERE account_id = $1", [
        input.actor_id,
      ])
    ).rows[0];
    if (actor?.actor_kind !== "human")
      throw new Rejection("review_actor_invalid");
    if ((await deadline(tx, input, seconds)).elapsed)
      throw new Rejection("review_deadline_elapsed");
    await faultPoint("review_after_admission");
    // Admission-time arbitration: commit may occur after deadline; the candidate lock remains held until transaction end.
    const inserted = await tx.attempt(
      `INSERT INTO review_decisions
      (review_decision_id, episode_version_id, actor_id, ready_candidate_fingerprint, decision, decided_at)
      VALUES ($1,$2,$3,$4,$5,clock_timestamp())`,
      [
        input.review_decision_id,
        input.episode_version_id,
        input.actor_id,
        input.ready_candidate_fingerprint,
        input.decision,
      ],
    );
    if (!inserted.ok) {
      // Different candidates may race for one authored event id. Only the exact immutable receipt can converge.
      if (
        inserted.error.code !== "23505" ||
        inserted.error.constraint !== "review_decisions_pkey"
      )
        throw Object.assign(new Error("review insert failed"), inserted.error);
      const winner = await receipt(tx, "event", input.review_decision_id);
      if (winner && sameReceipt(winner, input))
        return { kind: "converged", record: winner };
      return {
        kind: "conflict",
        code: "review_event_conflict",
        stored: null,
        detail: "",
      };
    }
    await faultPoint("review_after_insert_before_commit");
    if (input.decision === "halt") await halt(tx, input);
    const stored = await receipt(tx, "event", input.review_decision_id);
    if (!stored) throw new Error("missing inserted review receipt");
    return { kind: "created", record: stored };
  });
}
