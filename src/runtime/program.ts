// Program run / attempt creation (Handoff Build 2 path: "persist a program attempt"; Foundation 001 `program_runs`, `program_run_attempts`).
// Identity is the AUTHORED program_run_id / attempt_id. Same UUID + identical immutable request converges; same UUID with any changed
// immutable datum conflicts. Existing schema, roles and guards only: no UPDATE, no new privilege, no migration.
//
// Governed immutable request projection (compared IN SQL: UUIDs by `::uuid`, the instant by `timestamptz` equality, so microsecond
// differences are visible and nothing goes through a JS Date or Number):
//   run:     program_run_id, show_id, purpose, created_at
//   attempt: attempt_id, program_run_id, show_config_version_id, created_at, plus "no parent", "no repair plan", publication disabled
// Mutable-by-existing-mechanisms fields are RETURNED truthfully and never compared, so a retry after the first attempt bound the run,
// after a package was bound or after the lifecycle advanced still converges: run.state / run.show_config_version_id /
// run.publication_enabled, attempt.state / attempt.evidence_package_id.
//
// Strict API: the initial command cannot carry state, an Evidence Package binding, publication enablement or repair lineage. Every key
// outside the allowed set is rejected (`unsupported_field`); `parent_attempt_id` / `repair_plan_id` may be absent or null (the same
// request); `publication_enabled` may be absent or exactly false (an explicit null is refused). A run is created WITHOUT a config binding: the first attempt's database guard
// establishes `show_config_version_id` / `publication_enabled` atomically in the same transaction as the attempt insert.
//
// Prerequisites are owned elsewhere: the show and the show-config version must already exist (the tranche creates neither).
import type { Pool } from "pg";

import {
  emitPreflight,
  faultPoint,
  isUnique,
  Rejection,
  requireTimestamp,
  requireUuid,
  rethrow,
  runCommand,
  utcText,
  type Outcome,
  type Row,
  type Tx,
} from "./command.js";
import { peek, type CommandContext, type CommandTrace } from "./observe.js";

/** Advisory-lock namespace for initial-attempt creation of one run (distinct from the claim-event class 182736452). */
export const PROGRAM_ATTEMPT_LOCK_CLASS = 182736461;

export type RunPurpose = "evaluation" | "production";

export interface AuthoredProgramRun {
  program_run_id: string;
  show_id: string;
  purpose: RunPurpose;
  /** RFC 3339, 0-6 fractional digits; inserted and compared exactly as authored. */
  created_at: string;
}
export interface StoredProgramRun {
  program_run_id: string;
  show_id: string;
  purpose: RunPurpose;
  /** UTC with six fractional digits. */
  created_at: string;
  /** Mutable by existing mechanisms; reported, never compared. */
  state: string;
  show_config_version_id: string | null;
  publication_enabled: boolean | null;
}

export interface AuthoredProgramAttempt {
  attempt_id: string;
  program_run_id: string;
  show_config_version_id: string;
  created_at: string;
  /** Absent or null only (repair attempts are the operator path, not this command). */
  parent_attempt_id?: null;
  repair_plan_id?: null;
  /** Absent or false only (publication enablement is privileged setup). */
  publication_enabled?: false;
}
export interface StoredProgramAttempt {
  attempt_id: string;
  program_run_id: string;
  show_config_version_id: string;
  created_at: string;
  parent_attempt_id: string | null;
  repair_plan_id: string | null;
  publication_enabled: boolean;
  /** Mutable by existing mechanisms; reported, never compared. */
  state: string;
  evidence_package_id: string | null;
  /** The run's own binding as read in the same transaction (truthful, not part of the compared request). */
  run: {
    state: string;
    show_config_version_id: string | null;
    publication_enabled: boolean | null;
  };
}

const RUN_KEYS = ["program_run_id", "show_id", "purpose", "created_at"];
const ATTEMPT_KEYS = [
  "attempt_id",
  "program_run_id",
  "show_config_version_id",
  "created_at",
  "parent_attempt_id",
  "repair_plan_id",
  "publication_enabled",
];

function ownKeys(input: unknown, allowed: string[], what: string): void {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    throw new Rejection("invalid_json", what);
  for (const k of Object.keys(input))
    if (!allowed.includes(k)) throw new Rejection("unsupported_field", k);
}

function validateRun(input: AuthoredProgramRun): AuthoredProgramRun {
  ownKeys(input, RUN_KEYS, "program run");
  const purpose: unknown = input.purpose;
  if (purpose !== "evaluation" && purpose !== "production")
    throw new Rejection("purpose_invalid");
  return {
    program_run_id: requireUuid(input.program_run_id, "program_run_id"),
    show_id: requireUuid(input.show_id, "show_id"),
    purpose,
    created_at: requireTimestamp(input.created_at, "created_at"),
  };
}

function validateAttempt(
  input: AuthoredProgramAttempt,
): AuthoredProgramAttempt {
  ownKeys(input, ATTEMPT_KEYS, "program attempt");
  const loose = input as unknown as Record<string, unknown>;
  if (loose.parent_attempt_id != null || loose.repair_plan_id != null)
    throw new Rejection("repair_not_supported");
  if (
    loose.publication_enabled !== undefined &&
    loose.publication_enabled !== false
  )
    throw new Rejection("publication_not_permitted");
  return {
    attempt_id: requireUuid(input.attempt_id, "attempt_id"),
    program_run_id: requireUuid(input.program_run_id, "program_run_id"),
    show_config_version_id: requireUuid(
      input.show_config_version_id,
      "show_config_version_id",
    ),
    created_at: requireTimestamp(input.created_at, "created_at"),
  };
}

const selectRun = `SELECT program_run_id::text, show_id::text, purpose, ${utcText("created_at")} AS created_at, state::text AS state,
  show_config_version_id::text, publication_enabled FROM program_runs`;
const toRun = (r: Row): StoredProgramRun => ({
  program_run_id: r.program_run_id as string,
  show_id: r.show_id as string,
  purpose: r.purpose as RunPurpose,
  created_at: r.created_at as string,
  state: r.state as string,
  show_config_version_id: r.show_config_version_id as string | null,
  publication_enabled: r.publication_enabled as boolean | null,
});

const selectAttempt = `SELECT a.attempt_id::text, a.program_run_id::text, a.show_config_version_id::text, ${utcText("a.created_at")} AS created_at,
  a.parent_attempt_id::text, a.repair_plan_id::text, a.publication_enabled, a.state::text AS state, a.evidence_package_id::text,
  r.state::text AS run_state, r.show_config_version_id::text AS run_show_config_version_id, r.publication_enabled AS run_publication_enabled`;
const toAttempt = (r: Row): StoredProgramAttempt => ({
  attempt_id: r.attempt_id as string,
  program_run_id: r.program_run_id as string,
  show_config_version_id: r.show_config_version_id as string,
  created_at: r.created_at as string,
  parent_attempt_id: r.parent_attempt_id as string | null,
  repair_plan_id: r.repair_plan_id as string | null,
  publication_enabled: r.publication_enabled as boolean,
  state: r.state as string,
  evidence_package_id: r.evidence_package_id as string | null,
  run: {
    state: r.run_state as string,
    show_config_version_id: r.run_show_config_version_id as string | null,
    publication_enabled: r.run_publication_enabled as boolean | null,
  },
});

async function compareRun(
  tx: Tx,
  run: AuthoredProgramRun,
): Promise<Outcome<StoredProgramRun> | undefined> {
  const found = await tx.query(
    `${selectRun.replace(
      "FROM program_runs",
      `, (show_id = $2::uuid) AS same_show, (purpose = $3) AS same_purpose, (created_at = $4::timestamptz) AS same_time FROM program_runs`,
    )} WHERE program_run_id = $1::uuid`,
    [run.program_run_id, run.show_id, run.purpose, run.created_at],
  );
  const row = found.rows[0];
  if (!row) return undefined;
  const stored = toRun(row);
  const same = (k: string): boolean => row[k] === true;
  if (same("same_show") && same("same_purpose") && same("same_time"))
    return { kind: "converged", record: stored };
  const differs = [
    !same("same_show") && "show_id",
    !same("same_purpose") && "purpose",
    !same("same_time") && "created_at",
  ].filter(Boolean);
  return {
    kind: "conflict",
    code: "program_run_identity_conflict",
    stored,
    detail: `differs in ${differs.join(",")}`,
  };
}

export async function createProgramRun(
  pool: Pool,
  authored: AuthoredProgramRun,
  context?: CommandContext,
): Promise<Outcome<StoredProgramRun>> {
  const trace: CommandTrace | undefined = context && {
    context,
    command: "program_run.create",
    subject: { program_run_id: peek(() => authored.program_run_id) },
  };
  let run: AuthoredProgramRun;
  try {
    run = validateRun(authored);
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
      const prior = await compareRun(tx, run);
      if (prior) return prior;
      const show = await tx.query(
        "SELECT 1 FROM shows WHERE show_id = $1::uuid",
        [run.show_id],
      );
      if (show.rows.length === 0)
        return { kind: "rejected", code: "show_not_found" };
      const insert = await tx.attempt(
        `INSERT INTO program_runs (program_run_id, show_id, purpose, created_at) VALUES ($1::uuid, $2::uuid, $3, $4::timestamptz)
         RETURNING program_run_id::text, show_id::text, purpose, ${utcText("created_at")} AS created_at, state::text AS state,
         show_config_version_id::text, publication_enabled`,
        [run.program_run_id, run.show_id, run.purpose, run.created_at],
      );
      if (insert.ok) {
        const row = insert.rows[0];
        if (!row) throw new Error("insert returned no row");
        return { kind: "created", record: toRun(row) };
      }
      // Savepoint already rolled back. ONLY the named primary-key race is reconciled: a fresh statement sees the winner, which is looked
      // up by IDENTITY and compared. Any other failure (check, privilege, timeout, a custom trigger...) is rethrown UNCHANGED even if a
      // matching row now exists: a winner must never turn an unrelated error into a domain result.
      if (isUnique(insert.error, "program_runs_pkey")) {
        const winner = await compareRun(tx, run);
        if (winner) return winner;
        return rethrow(insert.error);
      }
      // The one other known case: the show foreign key, and only when the rows themselves explain it (the show is absent).
      if (
        insert.error.code === "23503" &&
        insert.error.constraint === "program_runs_show_id_fkey"
      ) {
        const again = await tx.query(
          "SELECT 1 FROM shows WHERE show_id = $1::uuid",
          [run.show_id],
        );
        if (again.rows.length === 0)
          return {
            kind: "rejected",
            code: "show_not_found",
            sqlstate: "23503",
          };
      }
      return rethrow(insert.error);
    },
    trace,
  );
}

async function readAttempt(
  tx: Tx,
  attemptId: string,
  request?: AuthoredProgramAttempt,
): Promise<Row | undefined> {
  const compare = request
    ? `, (a.program_run_id = $2::uuid) AS same_run, (a.show_config_version_id = $3::uuid) AS same_config,
       (a.created_at = $4::timestamptz) AS same_time, (a.parent_attempt_id IS NULL) AS same_parent,
       (a.repair_plan_id IS NULL) AS same_repair, (a.publication_enabled = false) AS same_publication`
    : "";
  const values = request
    ? [
        attemptId,
        request.program_run_id,
        request.show_config_version_id,
        request.created_at,
      ]
    : [attemptId];
  const found = await tx.query(
    `${selectAttempt}${compare} FROM program_run_attempts a JOIN program_runs r USING (program_run_id)
     WHERE a.attempt_id = $1::uuid`,
    values,
  );
  return found.rows[0];
}

async function compareAttempt(
  tx: Tx,
  attempt: AuthoredProgramAttempt,
): Promise<Outcome<StoredProgramAttempt> | undefined> {
  const row = await readAttempt(tx, attempt.attempt_id, attempt);
  if (!row) return undefined;
  const stored = toAttempt(row);
  const same = (k: string): boolean => row[k] === true;
  const names: [string, string][] = [
    ["same_run", "program_run_id"],
    ["same_config", "show_config_version_id"],
    ["same_time", "created_at"],
    ["same_parent", "parent_attempt_id"],
    ["same_repair", "repair_plan_id"],
    ["same_publication", "publication_enabled"],
  ];
  const differs = names.filter(([k]) => !same(k)).map(([, n]) => n);
  if (differs.length === 0) return { kind: "converged", record: stored };
  return {
    kind: "conflict",
    code: "program_attempt_identity_conflict",
    stored,
    detail: `differs in ${differs.join(",")}`,
  };
}

/** The refusals the ROWS explain (nothing is written for any of them); `undefined` when the rows explain none. */
async function explainRefusal(
  tx: Tx,
  attempt: AuthoredProgramAttempt,
): Promise<Outcome<StoredProgramAttempt> | undefined> {
  const run = await tx.query(`${selectRun} WHERE program_run_id = $1::uuid`, [
    attempt.program_run_id,
  ]);
  const runRow = run.rows[0];
  if (!runRow) return { kind: "rejected", code: "run_not_found" };
  const config = await tx.query(
    "SELECT show_id::text FROM show_config_versions WHERE show_config_version_id = $1::uuid",
    [attempt.show_config_version_id],
  );
  const configRow = config.rows[0];
  if (!configRow) return { kind: "rejected", code: "config_not_found" };
  if (configRow.show_id !== runRow.show_id)
    return { kind: "rejected", code: "config_show_mismatch" };
  const bound = runRow.show_config_version_id as string | null;
  if (bound !== null && bound !== attempt.show_config_version_id)
    return {
      kind: "conflict",
      code: "run_config_binding_mismatch",
      stored: toRun(runRow),
      detail: "the run is already bound to a different show-config version",
    };
  return undefined;
}

export async function createProgramAttempt(
  pool: Pool,
  authored: AuthoredProgramAttempt,
  context?: CommandContext,
): Promise<Outcome<StoredProgramAttempt>> {
  const trace: CommandTrace | undefined = context && {
    context,
    command: "program_attempt.create",
    subject: {
      attempt_id: peek(() => authored.attempt_id),
      program_run_id: peek(() => authored.program_run_id),
    },
  };
  let attempt: AuthoredProgramAttempt;
  try {
    attempt = validateAttempt(authored);
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
      // Participating creators of ONE run are serialized by one transaction-scoped advisory lock (namespace + hashtext of the run id,
      // the A5.1 claim-event pattern). It is the ONLY lock this command takes, and it is taken FIRST; the guard's run-row update
      // follows inside the INSERT (fixed order: advisory lock, then run row). Under it the identity read, the binding read and the
      // insert are one step per run, so a participating loser sees the committed binding and gets a typed result.
      await tx.query("SELECT pg_advisory_xact_lock($1, hashtext($2::text))", [
        PROGRAM_ATTEMPT_LOCK_CLASS,
        attempt.program_run_id,
      ]);
      const prior = await compareAttempt(tx, attempt);
      if (prior) return prior;
      const refusal = await explainRefusal(tx, attempt);
      if (refusal) return refusal;
      const insert = await tx.attempt(
        `INSERT INTO program_run_attempts (attempt_id, program_run_id, show_config_version_id, created_at)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::timestamptz)`,
        [
          attempt.attempt_id,
          attempt.program_run_id,
          attempt.show_config_version_id,
          attempt.created_at,
        ],
      );
      if (insert.ok) {
        // The attempt guard (and its first-attempt run binding) ran inside the INSERT; a failure from here on rolls both back.
        await faultPoint("after_attempt_insert");
        const row = await readAttempt(tx, attempt.attempt_id);
        if (!row) throw new Error("inserted attempt not readable");
        return { kind: "created", record: toAttempt(row) };
      }
      // Savepoint already rolled back (the incidental run binding with it). Reconciliation is gated to the KNOWN cases BEFORE any reread;
      // everything else is rethrown UNCHANGED, even if a matching winner now exists (a winner never converts an unrelated error).
      // (1) the attempt primary-key race: the winner is looked up by attempt IDENTITY first and compared on the immutable projection.
      if (isUnique(insert.error, "program_run_attempts_pkey")) {
        const winner = await compareAttempt(tx, attempt);
        if (winner) return winner;
        return rethrow(insert.error);
      }
      // (2) the foreign keys of the run and of the config (23503, NAMED constraints), and only when the rows explain them (the run or the
      // config is absent). A same-identity winner is still reported first.
      const fk =
        insert.error.code === "23503" &&
        (insert.error.constraint ===
          "program_run_attempts_program_run_id_fkey" ||
          insert.error.constraint ===
            "program_run_attempts_show_config_version_id_fkey");
      if (fk) {
        const explained = await explainRefusal(tx, attempt);
        if (
          explained?.kind === "rejected" &&
          (explained.code === "run_not_found" ||
            explained.code === "config_not_found")
        )
          return (await compareAttempt(tx, attempt)) ?? explained;
      }
      // EVERYTHING else is rethrown UNCHANGED, including every P0001. The attempt guard's own `RAISE EXCEPTION`s (cross-show binding,
      // "attempt must use the run show-config binding") carry the generic SQLSTATE P0001 and no constraint name, so neither the code
      // nor the rows can prove WHICH trigger raised it (an unrelated trigger can raise P0001 too). Within the protocol they are
      // prevented by the per-run lock above. An OUT-OF-PROTOCOL writer (a privileged first insert that does not take the lock) can
      // make a participating creator lose at the guard: that creator sees the original guard error, and an identical retry then
      // returns the truthful identity / binding outcome from the committed rows.
      return rethrow(insert.error);
    },
    trace,
  );
}

/** The ambiguity protocol: after a lost acknowledgement, look the authored UUID up (or resend the identical request). */
export async function lookupProgramRun(
  pool: Pool,
  id: string,
): Promise<StoredProgramRun | null> {
  requireUuid(id, "program_run_id");
  const r = await pool.query(`${selectRun} WHERE program_run_id = $1::uuid`, [
    id,
  ]);
  const row = r.rows[0] as Row | undefined;
  return row ? toRun(row) : null;
}

export async function lookupProgramAttempt(
  pool: Pool,
  id: string,
): Promise<StoredProgramAttempt | null> {
  requireUuid(id, "attempt_id");
  const r = await pool.query(
    `${selectAttempt} FROM program_run_attempts a JOIN program_runs r USING (program_run_id) WHERE a.attempt_id = $1::uuid`,
    [id],
  );
  const row = r.rows[0] as Row | undefined;
  return row ? toAttempt(row) : null;
}
