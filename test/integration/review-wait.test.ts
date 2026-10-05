// Structural Foundation READY capability seeds, NOT Build2 production/validated-master execution.
// Cooperative advisory admission is tested; raw operator SQL is not authenticated or universally arbitrated.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { allTables } from "../../src/fixture/families.js";
import { reenterCompletePinnedFixture } from "../../src/fixture/persist.js";
import {
  loadFingerprintVectors,
  loadFoundationRows,
} from "../../src/fixture/loader.js";
import { fingerprint } from "../../src/identity/fingerprints.js";
import { showConfigVersionHash } from "../../src/identity/show-config.js";
import {
  resumeReviewWait,
  submitReviewDecision,
  type Candidate,
  type Submission,
} from "../../src/runtime/review-wait.js";
import { TestCluster, type DbEnv } from "../support/db-env.js";
import { waitForBlocked, within } from "../support/pg-wait.js";
import {
  launchReview,
  reviewEnv,
  runReview,
  type ChildResult,
  type WaitChild,
} from "../support/review-wait-process.js";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
const cluster = url ? new TestCluster(url) : undefined;
const operatorLogin = `rw_${randomBytes(5).toString("hex")}_operator`;
const operatorPassword = randomBytes(24).toString("hex");
const dbs: DbEnv[] = [];
const operators: pg.Pool[] = [];
const children: WaitChild[] = [];
interface Seed {
  db: DbEnv;
  candidate: Candidate;
  operatorUrl: string;
  operator: pg.Pool;
  actor: string;
}
async function fresh(): Promise<DbEnv> {
  if (!cluster) throw new Error("PG required");
  const db = await cluster.create({ migrate: true });
  dbs.push(db);
  await reenterCompletePinnedFixture(db.migrator, { DESK_ENV: "test" });
  return db;
}
async function seed(db: DbEnv, timeout = 3600): Promise<Seed> {
  const tables = loadFoundationRows().tables;
  const source = tables.show_config_versions?.at(-1);
  if (!source) throw new Error("fixture config missing");
  const payload = {
    ...(source.canonical_payload as Record<string, unknown>),
    pre_publish_review_timeout_seconds: timeout,
  };
  const config = { ...source, canonical_payload: payload };
  const configHash = showConfigVersionHash(config);
  const existing = (
    await db.owner.query<{ id: string }>(
      "SELECT show_config_version_id AS id FROM show_config_versions WHERE config_hash=$1",
      [configHash],
    )
  ).rows[0];
  const configId = existing?.id ?? randomUUID();
  if (!existing) {
    const version = (
      await db.owner.query<{ n: number }>(
        "SELECT max(version_number)+1 AS n FROM show_config_versions",
      )
    ).rows[0]?.n;
    await db.migrator.query<Record<string, unknown>>(
      `INSERT INTO show_config_versions(show_config_version_id,show_id,version_number,config_hash,schema_version,canonical_payload,pre_publish_review_required)
      VALUES ($1,$2,$3,$4,'show-config/1',$5,true)`,
      [configId, source.show_id, version, configHash, payload],
    );
  }
  const run = `a${randomUUID().slice(1)}`,
    attempt = randomUUID();
  await db.runtime.query<Record<string, unknown>>(
    "INSERT INTO program_runs(program_run_id,show_id,purpose) VALUES ($1,$2,'production')",
    [run, source.show_id],
  );
  await db.runtime.query<Record<string, unknown>>(
    `INSERT INTO program_run_attempts(attempt_id,program_run_id,show_config_version_id,evidence_package_id)
    VALUES ($1,$2,$3,$4)`,
    [
      attempt,
      run,
      configId,
      tables.evidence_packages?.[0]?.evidence_package_id,
    ],
  );
  // Ordinal transitions below deliberately arrange structural state; they are NOT evidence of stage effects.
  const stages = [
    "PENDING",
    "EVIDENCE_READY",
    "PACKAGED",
    "PLANNED",
    "SCRIPTED",
    "PERFORMANCE_DIRECTED",
    "AUDITED",
    "RENDER_PLANNED",
    "SYNTHESIZED",
    "ASSEMBLED",
    "VALIDATED",
  ];
  for (let i = 1; i < stages.length; i++)
    await db.runtime.query<Record<string, unknown>>(
      "SELECT transition_attempt($1,$2,$3)",
      [attempt, stages[i - 1], stages[i]],
    );
  const base = loadFingerprintVectors().ready_candidate;
  if (!base) throw new Error("fixture projection missing");
  const fp = fingerprint("ready_candidate", {
    ...base.input_projection,
    program_run_id: run,
    attempt_id: attempt,
    show_config_version_hash: configHash,
  });
  await db.runtime.query<Record<string, unknown>>(
    "SELECT transition_attempt($1,'VALIDATED','READY',$2,$3)",
    [attempt, fp, base.input_projection.master_artifact_id],
  );
  const id = (
    await db.owner.query<{ id: string }>(
      "SELECT episode_version_id AS id FROM episode_versions WHERE attempt_id=$1",
      [attempt],
    )
  ).rows[0]?.id;
  if (!id) throw new Error("seed missing");
  const actor = (
    await db.runtime.query<{ id: string }>(
      "INSERT INTO accounts(display_name,actor_kind) VALUES ('WAIT_PRIVATE_ACTOR','human') RETURNING account_id AS id",
    )
  ).rows[0]?.id;
  if (!actor) throw new Error("actor missing");
  const op = new URL(db.runtimeUrl);
  op.username = operatorLogin;
  op.password = operatorPassword;
  const operator = new pg.Pool({
    connectionString: op.toString(),
    options: "-c role=desk_operator",
    max: 2,
  });
  operators.push(operator);
  return {
    db,
    candidate: {
      run_id: run,
      attempt_id: attempt,
      episode_version_id: id,
      ready_candidate_fingerprint: fp,
    },
    operatorUrl: op.toString(),
    operator,
    actor,
  };
}
function event(
  s: Seed,
  decision: Submission["decision"] = "approve",
): Submission {
  return {
    ...s.candidate,
    review_decision_id: randomUUID(),
    actor_id: s.actor,
    decision,
  };
}
const env = (s: Seed) => reviewEnv(s.db.runtimeUrl, s.operatorUrl);
const hold = (
  s: Seed,
  mode: string,
  input: unknown,
  point: string,
): WaitChild => {
  const c = launchReview(mode, input, env(s), { hold: point });
  children.push(c);
  return c;
};
async function digest(db: DbEnv, protectedOnly = false): Promise<string> {
  const hash = createHash("sha256");
  for (const t of allTables) {
    if (
      protectedOnly &&
      (t === "program_run_attempts" || t === "review_decisions")
    )
      continue;
    const rows = (
      await db.owner.query<Record<string, unknown>>(
        `SELECT to_jsonb(x)::text AS value,x.xmin::text,x.ctid::text FROM "${t}" x ORDER BY 1`,
      )
    ).rows;
    hash.update(JSON.stringify(rows));
  }
  return hash.digest("hex");
}
async function state(s: Seed): Promise<string> {
  return String(
    (
      await s.db.owner.query<Record<string, unknown>>(
        "SELECT state FROM program_run_attempts WHERE attempt_id=$1",
        [s.candidate.attempt_id],
      )
    ).rows[0]?.state,
  );
}
// Independent committed receipt observer: SQL preserves server-owned microseconds, unlike JS Date.
async function committedReceipt(
  s: Seed,
  e: Submission,
): Promise<Record<string, unknown>> {
  const rows = (
    await s.db.owner.query<Record<string, unknown>>(
      `SELECT d.review_decision_id, d.episode_version_id, d.ready_candidate_fingerprint,
      d.actor_id, d.decision, a.program_run_id AS run_id, v.attempt_id,
      to_char(d.decided_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS decided_at
      FROM review_decisions d JOIN episode_versions v USING(episode_version_id)
      JOIN program_run_attempts a USING(attempt_id) WHERE d.episode_version_id=$1`,
      [s.candidate.episode_version_id],
    )
  ).rows;
  expect(rows).toHaveLength(1);
  const row = rows[0];
  if (!row) throw new Error("committed receipt missing");
  expect(row).toMatchObject(e);
  expect(row.decided_at).toMatch(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/,
  );
  return row;
}
interface AttemptSnapshot {
  attempt_id: string;
  value: Record<string, unknown>;
  xmin: string;
  ctid: string;
}
async function attemptSnapshot(s: Seed): Promise<AttemptSnapshot[]> {
  return (
    await s.db.owner.query<AttemptSnapshot>(
      "SELECT attempt_id,to_jsonb(a) AS value,a.xmin::text,a.ctid::text FROM program_run_attempts a ORDER BY attempt_id",
    )
  ).rows;
}
function exactTargetHalt(
  before: AttemptSnapshot[],
  after: AttemptSnapshot[],
  s: Seed,
): void {
  expect(before.length).toBeGreaterThan(1);
  expect(after).toHaveLength(before.length);
  expect(
    after
      .filter((r, i) => JSON.stringify(r) !== JSON.stringify(before[i]))
      .map((r) => r.attempt_id),
  ).toEqual([s.candidate.attempt_id]);
  const prior = before.find((r) => r.attempt_id === s.candidate.attempt_id);
  const halted = after.find((r) => r.attempt_id === s.candidate.attempt_id);
  if (!prior || !halted) throw new Error("target attempt snapshot missing");
  expect(prior.value.state).toBe("READY");
  expect(halted.value).toEqual({ ...prior.value, state: "HALTED" });
  expect(halted.xmin).not.toBe(prior.xmin);
  expect(halted.ctid).not.toBe(prior.ctid);
  expect(after.filter((r) => r.attempt_id !== s.candidate.attempt_id)).toEqual(
    before.filter((r) => r.attempt_id !== s.candidate.attempt_id),
  );
}
async function apiReceipt(
  s: Seed,
  decision: "approve" | "request_repair",
  deadline: string,
  receipt: Record<string, unknown>,
): Promise<void> {
  const result = await resumeReviewWait(s.db.runtime, s.candidate, {
    DESK_ENV: "test",
  });
  expect(result).toEqual({
    kind: "converged",
    record: { ...s.candidate, status: decision, deadline, receipt },
  });
}
async function committedDeadline(s: Seed): Promise<string> {
  const row = (
    await s.db.owner.query<{ deadline: string }>(
      `SELECT to_char((v.created_at+(c.canonical_payload->>'pre_publish_review_timeout_seconds')::integer*interval '1 second')
      AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS deadline
      FROM episode_versions v JOIN program_run_attempts a USING(attempt_id)
      JOIN show_config_versions c USING(show_config_version_id) WHERE v.episode_version_id=$1`,
      [s.candidate.episode_version_id],
    )
  ).rows[0];
  if (!row) throw new Error("committed deadline missing");
  return row.deadline;
}
async function mutate(
  db: DbEnv,
  sql: string,
  values: unknown[] = [],
): Promise<void> {
  const c = await db.owner.connect();
  try {
    await c.query<Record<string, unknown>>("BEGIN");
    await c.query<Record<string, unknown>>(
      "SET LOCAL session_replication_role=replica",
    );
    await c.query<Record<string, unknown>>(sql, values);
    await c.query<Record<string, unknown>>("COMMIT");
  } catch (e) {
    await c.query<Record<string, unknown>>("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
// Test-only structural timestamp setup. No production mutation or mutable deadline mechanism is introduced.
async function opened(s: Seed, value: string): Promise<void> {
  await mutate(
    s.db,
    "UPDATE episode_versions SET created_at=$2::timestamptz WHERE episode_version_id=$1",
    [s.candidate.episode_version_id, value],
  );
}
async function expired(s: Seed): Promise<void> {
  await opened(s, "2020-01-01T00:00:00.123456Z");
}
async function waitDeadline(s: Seed): Promise<void> {
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    const q = await s.db.owner.query<{ expired: boolean }>(
      `SELECT clock_timestamp()>=v.created_at+(c.canonical_payload->>'pre_publish_review_timeout_seconds')::integer*interval '1 second' AS expired
    FROM episode_versions v JOIN program_run_attempts a USING(attempt_id) JOIN show_config_versions c USING(show_config_version_id) WHERE v.episode_version_id=$1`,
      [s.candidate.episode_version_id],
    );
    if (q.rows[0]?.expired) return;
    await sleep(20);
  }
  throw new Error("deadline not reached");
}
function lines(r: ChildResult): Record<string, unknown>[] {
  return r.stdout
    .split("\n")
    .filter(Boolean)
    .map((s) => JSON.parse(s) as Record<string, unknown>);
}
function success(r: ChildResult): Record<string, unknown> {
  expect(r.code, r.stderr + r.stdout).toBe(0);
  expect(r.signal).toBe(null);
  return lines(r).find((x) => x.event === "review.wait") ?? {};
}
async function refuse(
  s: Seed,
  mode: string,
  input: unknown,
  expectedCode: string,
  expectedExit = 2,
): Promise<void> {
  const before = await digest(s.db);
  for (let i = 0; i < 2; i++) {
    const r = await runReview(mode, input, env(s));
    expect(r.code).toBe(expectedExit);
    const emitted = [
      ...lines(r),
      ...r.stderr
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
    ];
    expect(emitted.filter((x) => x.event === "review.wait").at(-1)?.code).toBe(
      expectedCode,
    );
    expect(await digest(s.db)).toBe(before);
  }
}

suite(
  "Foundation review wait: structural READY seeds, cooperative ingress only",
  () => {
    beforeAll(async () => {
      await cluster?.bootstrap();
      await cluster?.admin.query<Record<string, unknown>>(
        `CREATE ROLE ${operatorLogin} LOGIN NOINHERIT PASSWORD '${operatorPassword}'`,
      );
      await cluster?.admin.query<Record<string, unknown>>(
        `GRANT desk_operator TO ${operatorLogin}`,
      );
    }, 60000);
    afterEach(async () => {
      for (const c of children.splice(0)) await c.kill();
      for (const p of operators.splice(0)) await p.end();
      for (const db of dbs.splice(0)) await db.close();
    }, 60000);
    afterAll(async () => {
      await cluster?.admin.query<Record<string, unknown>>(
        `DROP ROLE IF EXISTS ${operatorLogin}`,
      );
      await cluster?.shutdown();
    }, 60000);

    it("pending survives waiter death; operator commits with no waiter; new child resumes exact decision without any downstream/value writes", async () => {
      const s = await seed(await fresh());
      const protectedBefore = await digest(s.db, true);
      const before = await digest(s.db);
      const first = hold(s, "wait", s.candidate, "after_commit_before_return");
      await first.held;
      expect(await state(s)).toBe("READY");
      const killed = await first.kill();
      expect(killed.signal).toBe("SIGKILL");
      expect(killed.code).toBeNull();
      expect(await digest(s.db)).toBe(before);
      const pending = success(await runReview("wait", s.candidate, env(s)));
      expect(pending.status).toBe("pending");
      const e = event(s);
      success(await runReview("submit", e, env(s)));
      const a = success(await runReview("wait", s.candidate, env(s)));
      expect(a.status).toBe("approve");
      expect(a.review_decision_id).toBe(e.review_decision_id);
      expect(a.deadline).toBe(pending.deadline);
      expect(await state(s)).toBe("READY");
      expect(await digest(s.db, true)).toBe(protectedBefore);
      expect(success(await runReview("wait", s.candidate, env(s))).status).toBe(
        "approve",
      );
    }, 30000);

    for (const decision of ["approve", "request_repair"] as const) {
      it(`duplicate runtime waiters observe PG blocking then both recover exact committed ${decision} receipt without writes`, async () => {
        const s = await seed(await fresh());
        const e = event(s, decision);
        success(await runReview("submit", e, env(s)));
        const receipt = await committedReceipt(s, e);
        const deadline = await committedDeadline(s);
        const before = await digest(s.db);
        const protectedBefore = await digest(s.db, true);
        const winner = hold(s, "wait", s.candidate, "review_after_lock");
        await winner.held;
        const waiter = launchReview("wait", s.candidate, env(s));
        children.push(waiter);
        const blocked = await waitForBlocked(s.db.owner, s.db.name, (ws) =>
          ws.some(
            (w) =>
              w.application_name === "the-desk-runtime" &&
              w.locktype === "advisory" &&
              w.blockers.length > 0,
          ),
        );
        expect(
          blocked.some(
            (w) =>
              w.application_name === "the-desk-runtime" &&
              w.blockers.some((pid) => pid !== w.pid),
          ),
        ).toBe(true);
        expect(await digest(s.db)).toBe(before);
        winner.release();
        for (const result of [
          await within(winner.exited, 10000, "runtime winner"),
          await within(waiter.exited, 10000, "runtime waiter"),
        ]) {
          expect(success(result)).toMatchObject({
            status: decision,
            review_decision_id: e.review_decision_id,
            run_id: s.candidate.run_id,
            attempt_id: s.candidate.attempt_id,
            episode_version_id: s.candidate.episode_version_id,
            deadline,
          });
        }
        expect(await committedReceipt(s, e)).toEqual(receipt);
        await apiReceipt(s, decision, deadline, receipt);
        expect(await state(s)).toBe("READY");
        expect(await digest(s.db)).toBe(before);
        expect(await digest(s.db, true)).toBe(protectedBefore);
      }, 30000);

      it(`runtime waiter SIGKILL after COMMIT observing committed ${decision} recovers original event/time/candidate/deadline with no writes`, async () => {
        const s = await seed(await fresh());
        const e = event(s, decision);
        success(await runReview("submit", e, env(s)));
        const receipt = await committedReceipt(s, e);
        const deadline = await committedDeadline(s);
        const before = await digest(s.db);
        const protectedBefore = await digest(s.db, true);
        const waiter = hold(
          s,
          "wait",
          s.candidate,
          "after_commit_before_return",
        );
        await waiter.held;
        // This existing seam runs after the runtime has read the receipt and COMMIT returned.
        expect(await committedReceipt(s, e)).toEqual(receipt);
        await apiReceipt(s, decision, deadline, receipt);
        expect(await state(s)).toBe("READY");
        expect(await digest(s.db)).toBe(before);
        const killed = await waiter.kill();
        expect(killed.signal).toBe("SIGKILL");
        expect(killed.code).toBeNull();
        expect(
          success(await runReview("wait", s.candidate, env(s))),
        ).toMatchObject({
          status: decision,
          review_decision_id: e.review_decision_id,
          run_id: s.candidate.run_id,
          attempt_id: s.candidate.attempt_id,
          episode_version_id: s.candidate.episode_version_id,
          deadline,
        });
        expect(await committedReceipt(s, e)).toEqual(receipt);
        expect(await committedDeadline(s)).toBe(deadline);
        await apiReceipt(s, decision, deadline, receipt);
        expect(await state(s)).toBe("READY");
        expect(await digest(s.db)).toBe(before);
        expect(await digest(s.db, true)).toBe(protectedBefore);
      }, 30000);
    }

    for (const rollback of [false, true]) {
      it(`duplicate runtime expiry waiters observe PG blocking; winner ${rollback ? "rolls back" : "commits"}; one durable HALTED and no downstream writes`, async () => {
        const s = await seed(await fresh());
        await expired(s);
        const attemptsBefore = await attemptSnapshot(s);
        const before = await digest(s.db);
        const protectedBefore = await digest(s.db, true);
        const winner = hold(
          s,
          "wait",
          s.candidate,
          "review_after_halt_before_commit",
        );
        await winner.held;
        const waiter = launchReview("wait", s.candidate, env(s));
        children.push(waiter);
        await waitForBlocked(s.db.owner, s.db.name, (ws) =>
          ws.some(
            (w) =>
              w.application_name === "the-desk-runtime" &&
              w.locktype === "advisory" &&
              w.blockers.length > 0,
          ),
        );
        // The winner's uncommitted HALTED is invisible to this independent snapshot.
        expect(await state(s)).toBe("READY");
        expect(await digest(s.db)).toBe(before);
        if (rollback) {
          const killed = await winner.kill();
          expect(killed.signal).toBe("SIGKILL");
          expect(killed.code).toBeNull();
        } else {
          winner.release();
          expect(
            success(await within(winner.exited, 10000, "expiry winner")),
          ).toMatchObject({ status: "halted", halt_cause: "observed_expiry" });
        }
        expect(
          success(await within(waiter.exited, 10000, "expiry waiter")),
        ).toMatchObject({
          status: "halted",
          halt_cause: rollback ? "observed_expiry" : "unknown",
        });
        expect(await state(s)).toBe("HALTED");
        const attemptsAfter = await attemptSnapshot(s);
        exactTargetHalt(attemptsBefore, attemptsAfter, s);
        expect(
          (
            await s.db.owner.query<{ n: string }>(
              "SELECT count(*) AS n FROM review_decisions",
            )
          ).rows[0]?.n,
        ).toBe("0");
        expect(await digest(s.db, true)).toBe(protectedBefore);
        const committed = await digest(s.db);
        expect(
          success(await runReview("wait", s.candidate, env(s))),
        ).toMatchObject({ status: "halted", halt_cause: "unknown" });
        expect(await digest(s.db)).toBe(committed);
        expect(await attemptSnapshot(s)).toEqual(attemptsAfter);
      }, 30000);
    }

    it("two independently parked candidates isolate exact version/fingerprint/run/attempt", async () => {
      const db = await fresh();
      const a = await seed(db),
        b = await seed(db);
      success(await runReview("submit", event(a), env(a)));
      expect(success(await runReview("wait", a.candidate, env(a))).status).toBe(
        "approve",
      );
      expect(success(await runReview("wait", b.candidate, env(b))).status).toBe(
        "pending",
      );
      await refuse(
        a,
        "wait",
        {
          ...a.candidate,
          attempt_id: b.candidate.attempt_id,
        },
        "review_candidate_binding",
      );
      await refuse(
        a,
        "wait",
        {
          ...a.candidate,
          ready_candidate_fingerprint: b.candidate.ready_candidate_fingerprint,
        },
        "review_candidate_binding",
      );
    }, 30000);

    it("SQL deadline preserves six fractional digits and never resets across separate invocations", async () => {
      const s = await seed(await fresh());
      await opened(s, "2099-01-01T00:00:00.123456Z");
      const a = success(await runReview("wait", s.candidate, env(s))),
        b = success(await runReview("wait", s.candidate, env(s)));
      expect(a.deadline).toBe("2099-01-01T01:00:00.123456Z");
      expect(b.deadline).toBe(a.deadline);
      await opened(s, "2099-01-01T00:00:00.123457Z");
      expect(
        success(await runReview("wait", s.candidate, env(s))).deadline,
      ).toBe("2099-01-01T01:00:00.123457Z");
      const stored = (
        await s.db.owner.query<Record<string, unknown>>(
          "SELECT to_char(created_at AT TIME ZONE 'UTC','US') AS us FROM episode_versions WHERE episode_version_id=$1",
          [s.candidate.episode_version_id],
        )
      ).rows[0];
      expect(stored?.us).toBe("123457");
    }, 30000);

    for (const [clock, outcome] of [
      ["2099-01-01T00:00:01.123455Z", "pending"],
      ["2099-01-01T00:00:01.123456Z", "halted"],
      ["2099-01-01T00:00:01.123457Z", "halted"],
    ] as const) {
      it(`PostgreSQL microsecond comparison at ${clock}: ${outcome} (fixed SQL clock control, real expiry separately proved)`, async () => {
        const s = await seed(await fresh(), 1);
        await opened(s, "2099-01-01T00:00:00.123456Z");
        const r = await runReview("wait", s.candidate, env(s), { clock });
        expect(success(r).status).toBe(outcome);
        expect(lines(r).some((x) => x.sql_clock_control === true)).toBe(true);
        expect(await state(s)).toBe(outcome === "pending" ? "READY" : "HALTED");
      }, 30000);
    }

    it("server-owned original receipt timestamp falls within independent PostgreSQL observation window", async () => {
      const s = await seed(await fresh());
      const before = (
        await s.db.owner.query<{ t: string }>(
          "SELECT clock_timestamp()::text AS t",
        )
      ).rows[0]?.t;
      const e = event(s);
      const output = success(await runReview("submit", e, env(s)));
      const after = (
        await s.db.owner.query<{ t: string }>(
          "SELECT clock_timestamp()::text AS t",
        )
      ).rows[0]?.t;
      const proof = await s.db.owner.query<{ bounded: boolean }>(
        "SELECT decided_at BETWEEN $2::timestamptz AND $3::timestamptz AS bounded FROM review_decisions WHERE review_decision_id=$1",
        [e.review_decision_id, before, after],
      );
      expect(proof.rows[0]?.bounded).toBe(true);
      expect(output.decided_at).toMatch(/\.\d{6}Z$/);
    }, 30000);

    it("request_repair remains READY routing only; a committed decision retains priority on restart after deadline", async () => {
      const s = await seed(await fresh());
      const e = event(s, "request_repair");
      const before = await digest(s.db, true);
      success(await runReview("submit", e, env(s)));
      await expired(s);
      const protectedAfterSetup = await digest(s.db, true);
      const r = success(await runReview("wait", s.candidate, env(s)));
      expect(r.status).toBe("request_repair");
      expect(await state(s)).toBe("READY");
      expect(await digest(s.db, true)).toBe(protectedAfterSetup);
      expect(before).not.toBe(protectedAfterSetup); // only explicit test timestamp arrangement changed
      expect(
        Number(
          (
            await s.db.owner.query<Record<string, unknown>>(
              "SELECT count(*) AS n FROM repair_requests",
            )
          ).rows[0]?.n,
        ),
      ).toBe(0);
    }, 30000);

    it("explicit operator halt atomically inserts receipt and HALTED attempt; run stays unchanged; identical receipt replays", async () => {
      const s = await seed(await fresh());
      const e = event(s, "halt"),
        before = await digest(s.db, true);
      const submitted = success(await runReview("submit", e, env(s)));
      expect(await state(s)).toBe("HALTED");
      expect(submitted.outcome).toBe("created");
      const halted = success(await runReview("wait", s.candidate, env(s)));
      expect(halted.status).toBe("halted");
      expect(halted.halt_cause).toBe("unknown");
      const repeated = success(await runReview("submit", e, env(s)));
      expect(repeated.outcome).toBe("converged");
      expect(repeated.decided_at).toBe(submitted.decided_at);
      expect(await digest(s.db, true)).toBe(before);
    }, 30000);

    it("undecided expiry durably halts; restart reports unknown cause, never invents a human decision", async () => {
      const s = await seed(await fresh());
      await expired(s);
      const before = await digest(s.db, true);
      const first = success(await runReview("wait", s.candidate, env(s)));
      expect(first.status).toBe("halted");
      expect(first.halt_cause).toBe("observed_expiry");
      expect(await state(s)).toBe("HALTED");
      const repeated = success(await runReview("wait", s.candidate, env(s)));
      expect(repeated.halt_cause).toBe("unknown");
      expect(
        Number(
          (
            await s.db.owner.query<Record<string, unknown>>(
              "SELECT count(*) AS n FROM review_decisions",
            )
          ).rows[0]?.n,
        ),
      ).toBe(0);
      expect(await digest(s.db, true)).toBe(before);
      await refuse(s, "submit", event(s), "review_candidate_advanced");
    }, 30000);

    it("HALTED recovery bypasses current new-work policy; recovered approve receipt is not execution permission", async () => {
      const s = await seed(await fresh());
      const e = event(s);
      success(await runReview("submit", e, env(s)));
      await s.db.runtime.query(
        "SELECT transition_attempt($1,'READY','HALTED')",
        [s.candidate.attempt_id],
      ); // structural external halt arrangement
      await mutate(
        s.db,
        "UPDATE show_config_versions SET canonical_payload='{}' WHERE show_config_version_id=(SELECT show_config_version_id FROM program_run_attempts WHERE attempt_id=$1)",
        [s.candidate.attempt_id],
      );
      const before = await digest(s.db);
      expect(success(await runReview("submit", e, env(s))).outcome).toBe(
        "converged",
      );
      const resumed = success(await runReview("wait", s.candidate, env(s)));
      expect(resumed.status).toBe("halted");
      expect(resumed.halt_cause).toBe("unknown");
      expect(await digest(s.db)).toBe(before);
    }, 30000);

    it("late privileged raw insert after HALTED is rejected by existing trigger; terminal state still prevents resume even with a backdated bypass", async () => {
      const s = await seed(await fresh());
      await expired(s);
      success(await runReview("wait", s.candidate, env(s)));
      const e = event(s);
      await expect(
        s.operator.query<Record<string, unknown>>(
          `INSERT INTO review_decisions(review_decision_id,episode_version_id,ready_candidate_fingerprint,actor_id,decision)
      VALUES ($1,$2,$3,$4,'approve')`,
          [
            e.review_decision_id,
            e.episode_version_id,
            e.ready_candidate_fingerprint,
            e.actor_id,
          ],
        ),
      ).rejects.toThrow(/READY/);
      // Adversarial owner bypass proves terminal recovery, NOT universal ingress arbitration or actor authentication.
      await mutate(
        s.db,
        `INSERT INTO review_decisions(review_decision_id,episode_version_id,ready_candidate_fingerprint,actor_id,decision,decided_at)
      VALUES ($1,$2,$3,$4,'approve','2020-01-01Z')`,
        [
          e.review_decision_id,
          e.episode_version_id,
          e.ready_candidate_fingerprint,
          e.actor_id,
        ],
      );
      expect(success(await runReview("wait", s.candidate, env(s))).status).toBe(
        "halted",
      );
    }, 30000);

    it("raw operator INSERT can pass the READY snapshot and commit after cooperative expiry; HALTED still never resumes (not universal ingress arbitration)", async () => {
      const s = await seed(await fresh());
      await expired(s);
      const before = await digest(s.db, true);
      const e = event(s);
      const raw = await s.operator.connect();
      let open = false;
      try {
        await raw.query("BEGIN ISOLATION LEVEL READ COMMITTED");
        open = true;
        await raw.query(
          `INSERT INTO review_decisions(review_decision_id,episode_version_id,ready_candidate_fingerprint,actor_id,decision,decided_at)
          VALUES ($1,$2,$3,$4,'approve',clock_timestamp())`,
          [
            e.review_decision_id,
            e.episode_version_id,
            e.ready_candidate_fingerprint,
            e.actor_id,
          ],
        );
        expect(
          Number(
            (
              await s.db.owner.query<{ n: string }>(
                "SELECT count(*) AS n FROM review_decisions",
              )
            ).rows[0]?.n,
          ),
        ).toBe(0);
        // Existing trigger saw READY and took no participating advisory lock; expiry cannot see the uncommitted decision.
        expect(
          success(await runReview("wait", s.candidate, env(s))).halt_cause,
        ).toBe("observed_expiry");
        expect(await state(s)).toBe("HALTED");
        await raw.query("COMMIT");
        open = false;
        expect(
          Number(
            (
              await s.db.owner.query<{ n: string }>(
                "SELECT count(*) AS n FROM review_decisions",
              )
            ).rows[0]?.n,
          ),
        ).toBe(1);
        const after = success(await runReview("wait", s.candidate, env(s)));
        expect(after.status).toBe("halted");
        expect(after.halt_cause).toBe("unknown");
        expect(await digest(s.db, true)).toBe(before);
      } finally {
        if (open) await raw.query("ROLLBACK");
        raw.release();
      }
    }, 30000);

    it("identical receipt recovery after state advancement/policy invalidation skips new-work admission; conflicting event payload refuses", async () => {
      const s = await seed(await fresh());
      const e = event(s);
      const a = success(await runReview("submit", e, env(s)));
      await s.db.runtime.query<Record<string, unknown>>(
        "SELECT transition_attempt($1,'READY','REVALIDATED')",
        [s.candidate.attempt_id],
      ); // structural test setup, not revalidation effects
      await mutate(
        s.db,
        "UPDATE show_config_versions SET canonical_payload='{}' WHERE show_config_version_id=(SELECT show_config_version_id FROM program_run_attempts WHERE attempt_id=$1)",
        [s.candidate.attempt_id],
      );
      await mutate(
        s.db,
        "UPDATE accounts SET actor_kind='policy' WHERE account_id=$1",
        [s.actor],
      );
      const before = await digest(s.db);
      const b = success(await runReview("submit", e, env(s)));
      expect(b.outcome).toBe("converged");
      expect(b.decided_at).toBe(a.decided_at);
      expect(await digest(s.db)).toBe(before);
      await refuse(
        s,
        "submit",
        { ...e, decision: "halt" },
        "review_event_conflict",
      );
      await refuse(s, "wait", s.candidate, "review_candidate_advanced");
    }, 30000);

    for (const point of [
      "review_after_insert_before_commit",
      "review_after_halt_before_commit",
    ]) {
      it(`SIGKILL ${point} rolls back both halves; repeated new child performs one atomic halt`, async () => {
        const s = await seed(await fresh());
        const e = event(s, "halt"),
          before = await digest(s.db);
        const child = hold(s, "submit", e, point);
        await child.held;
        expect(await state(s)).toBe("READY");
        expect(
          Number(
            (
              await s.db.owner.query<Record<string, unknown>>(
                "SELECT count(*) AS n FROM review_decisions",
              )
            ).rows[0]?.n,
          ),
        ).toBe(0);
        const killed = await child.kill();
        expect(killed.signal).toBe("SIGKILL");
        expect(killed.code).toBeNull();
        expect(await digest(s.db)).toBe(before);
        success(await runReview("submit", e, env(s)));
        success(await runReview("submit", e, env(s)));
        expect(await state(s)).toBe("HALTED");
      }, 30000);
    }

    it("observed decision COMMIT then lost command acknowledgment/SIGKILL recovers immutable receipt (not network-packet-loss proof)", async () => {
      const s = await seed(await fresh());
      const e = event(s);
      const child = hold(s, "submit", e, "commit_ack");
      await child.held;
      const stored = (
        await s.db.owner.query<Record<string, unknown>>(
          "SELECT review_decision_id FROM review_decisions",
        )
      ).rows[0];
      expect(stored?.review_decision_id).toBe(e.review_decision_id);
      const killed = await child.kill();
      expect(killed.signal).toBe("SIGKILL");
      expect(killed.code).toBeNull();
      const before = await digest(s.db);
      const r = success(await runReview("submit", e, env(s)));
      expect(r.outcome).toBe("converged");
      expect(await digest(s.db)).toBe(before);
    }, 30000);

    it("observed expiry COMMIT/lost acknowledgment recovers HALTED with unknown cause", async () => {
      const s = await seed(await fresh());
      await expired(s);
      const child = hold(s, "wait", s.candidate, "commit_ack");
      await child.held;
      expect(await state(s)).toBe("HALTED");
      const killed = await child.kill();
      expect(killed.signal).toBe("SIGKILL");
      expect(killed.code).toBeNull();
      const before = await digest(s.db);
      expect(
        success(await runReview("wait", s.candidate, env(s))).halt_cause,
      ).toBe("unknown");
      expect(await digest(s.db)).toBe(before);
    }, 30000);

    for (const rollback of [false, true]) {
      it(`decision versus expiry: observed PG blocking, winner ${rollback ? "rolls back; waiter halts" : "commits after deadline; waiter resumes"}; default RR connections`, async () => {
        const s = await seed(await fresh(), 2);
        const e = event(s);
        // New child connections default RR. runCommand must explicitly select RC BEFORE the advisory lock's first SELECT snapshot.
        const runtimeLogin = new URL(s.db.runtimeUrl).username;
        await s.db.owner.query<Record<string, unknown>>(
          `ALTER ROLE ${operatorLogin} IN DATABASE ${s.db.name} SET default_transaction_isolation='repeatable read'`,
        );
        await s.db.owner.query<Record<string, unknown>>(
          `ALTER ROLE ${runtimeLogin} IN DATABASE ${s.db.name} SET default_transaction_isolation='repeatable read'`,
        );
        const winner = hold(s, "submit", e, "review_after_admission");
        await winner.held;
        await waitDeadline(s);
        const waiter = launchReview("wait", s.candidate, env(s));
        children.push(waiter);
        const blocked = await waitForBlocked(s.db.owner, s.db.name, (ws) =>
          ws.some(
            (w) =>
              w.locktype === "advisory" &&
              w.application_name === "the-desk-runtime" &&
              w.blockers.length > 0,
          ),
        );
        expect(blocked.some((w) => w.locktype === "advisory")).toBe(true);
        if (rollback) {
          const killed = await winner.kill();
          expect(killed.signal).toBe("SIGKILL");
          expect(killed.code).toBeNull();
        } else {
          winner.release();
          success(await within(winner.exited, 10000, "winner"));
        }
        const result = success(await within(waiter.exited, 10000, "waiter"));
        expect(result.status).toBe(rollback ? "halted" : "approve");
        expect(await state(s)).toBe(rollback ? "HALTED" : "READY");
        expect(
          Number(
            (
              await s.db.owner.query<Record<string, unknown>>(
                "SELECT count(*) AS n FROM review_decisions",
              )
            ).rows[0]?.n,
          ),
        ).toBe(rollback ? 0 : 1);
        if (!rollback) {
          const q = await s.db.owner.query<{ late: boolean }>(
            `SELECT d.decided_at>v.created_at+interval '2 seconds' AS late FROM review_decisions d JOIN episode_versions v USING(episode_version_id)`,
          );
          expect(q.rows[0]?.late).toBe(true);
        }
      }, 30000);
    }

    it("expiry winner holds PG lock; cooperative new decision waits then refuses without inserting", async () => {
      const s = await seed(await fresh());
      await expired(s);
      const winner = hold(
        s,
        "wait",
        s.candidate,
        "review_after_halt_before_commit",
      );
      await winner.held;
      const waiter = launchReview("submit", event(s), env(s));
      children.push(waiter);
      await waitForBlocked(s.db.owner, s.db.name, (ws) =>
        ws.some(
          (w) =>
            w.application_name === "the-desk-review-operator" &&
            w.locktype === "advisory",
        ),
      );
      winner.release();
      success(await winner.exited);
      const refused = await waiter.exited;
      expect(refused.code).toBe(2);
      expect(lines(refused).find((x) => x.event === "review.wait")?.code).toBe(
        "review_candidate_advanced",
      );
      expect(await state(s)).toBe("HALTED");
      expect(
        Number(
          (
            await s.db.owner.query<Record<string, unknown>>(
              "SELECT count(*) AS n FROM review_decisions",
            )
          ).rows[0]?.n,
        ),
      ).toBe(0);
    }, 30000);

    it("competing operator processes commit one immutable terminal event; loser refuses; no run/artifact/provider writes", async () => {
      const s = await seed(await fresh());
      const before = await digest(s.db, true);
      const winningEvent = event(s);
      const losingEvent = event(s, "request_repair");
      const a = hold(
        s,
        "submit",
        winningEvent,
        "review_after_insert_before_commit",
      );
      await a.held;
      const b = launchReview("submit", losingEvent, env(s));
      children.push(b);
      await waitForBlocked(s.db.owner, s.db.name, (ws) =>
        ws.some(
          (w) =>
            w.application_name === "the-desk-review-operator" &&
            w.locktype === "advisory",
        ),
      );
      a.release();
      expect(success(await a.exited).review_decision_id).toBe(
        winningEvent.review_decision_id,
      );
      const refused = await b.exited;
      expect(refused.code).toBe(2);
      expect(lines(refused).find((x) => x.event === "review.wait")?.code).toBe(
        "review_candidate_decided",
      );
      const receipts = await s.db.owner.query<Record<string, unknown>>(
        "SELECT review_decision_id, episode_version_id, ready_candidate_fingerprint, actor_id, decision FROM review_decisions",
      );
      expect(receipts.rows).toEqual([
        {
          review_decision_id: winningEvent.review_decision_id,
          episode_version_id: winningEvent.episode_version_id,
          ready_candidate_fingerprint: winningEvent.ready_candidate_fingerprint,
          actor_id: winningEvent.actor_id,
          decision: winningEvent.decision,
        },
      ]);
      expect(
        receipts.rows.some(
          (r) =>
            r.review_decision_id === losingEvent.review_decision_id ||
            r.decision === losingEvent.decision,
        ),
      ).toBe(false);
      expect(await digest(s.db, true)).toBe(before);
    }, 30000);

    it("wrong/unsupported/advanced candidate, invalid actor and late submission fail twice without mutations", async () => {
      const s = await seed(await fresh());
      await refuse(
        s,
        "wait",
        {
          ...s.candidate,
          episode_version_id: randomUUID(),
        },
        "review_candidate_missing",
      );
      await refuse(
        s,
        "wait",
        { ...s.candidate, run_id: randomUUID() },
        "review_candidate_binding",
      );
      await refuse(
        s,
        "submit",
        { ...event(s), actor_id: randomUUID() },
        "review_actor_invalid",
      );
      const policyActor = loadFoundationRows().tables.accounts?.find(
        (a) => a.actor_kind === "policy",
      )?.account_id;
      await refuse(
        s,
        "submit",
        { ...event(s), actor_id: policyActor },
        "review_actor_invalid",
      );
      await refuse(
        s,
        "submit",
        { ...event(s), decided_at: "2020-01-01Z" },
        "review_request_invalid",
        1,
      );
      await mutate(
        s.db,
        "UPDATE show_config_versions SET canonical_payload='{}' WHERE show_config_version_id=(SELECT show_config_version_id FROM program_run_attempts WHERE attempt_id=$1)",
        [s.candidate.attempt_id],
      );
      await refuse(s, "wait", s.candidate, "review_policy_invalid");
    }, 30000);

    it("late cooperative new submission refuses before any write", async () => {
      const s = await seed(await fresh());
      await expired(s);
      await refuse(s, "submit", event(s), "review_deadline_elapsed");
      expect(await state(s)).toBe("READY");
    }, 30000);

    it("runtime cannot INSERT review or SELECT FOR UPDATE; operator privileges stay separate; migrator/wrong-role command refuses", async () => {
      const s = await seed(await fresh());
      const e = event(s);
      await expect(
        s.db.runtime.query<Record<string, unknown>>(
          "SELECT * FROM episode_versions FOR UPDATE",
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        s.operator.query<Record<string, unknown>>(
          "SELECT * FROM episode_versions FOR UPDATE",
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        s.db.runtime.query<Record<string, unknown>>(
          `INSERT INTO review_decisions(episode_version_id,ready_candidate_fingerprint,actor_id,decision) VALUES ($1,$2,$3,'approve')`,
          [e.episode_version_id, e.ready_candidate_fingerprint, e.actor_id],
        ),
      ).rejects.toThrow(/permission denied/);
      const before = await digest(s.db);
      expect(
        await submitReviewDecision(s.db.runtime, e, { DESK_ENV: "test" }),
      ).toMatchObject({ kind: "rejected", code: "review_role_denied" });
      expect(
        await resumeReviewWait(s.db.migrator, s.candidate, {
          DESK_ENV: "test",
        }),
      ).toMatchObject({ kind: "rejected", code: "review_role_denied" });
      expect(await digest(s.db)).toBe(before);
    }, 30000);

    it("actual stored protected prompt canary never reaches configured output; one correlation and truthful canonical ids per invocation", async () => {
      const s = await seed(await fresh());
      const canary = `WAIT_PROMPT_${randomUUID()}`;
      await mutate(
        s.db,
        "UPDATE prompt_manifests SET component_versions=jsonb_set(component_versions,'{protected_prompt_canary}',to_jsonb($1::text))",
        [canary],
      );
      expect(
        (
          await s.db.owner.query<Record<string, unknown>>(
            "SELECT component_versions->>'protected_prompt_canary' AS c FROM prompt_manifests LIMIT 1",
          )
        ).rows[0]?.c,
      ).toBe(canary);
      const a = await runReview("wait", s.candidate, env(s)),
        b = await runReview("wait", s.candidate, env(s));
      const x = success(a),
        y = success(b);
      expect(x.correlation_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(y.correlation_id).not.toBe(x.correlation_id);
      expect(x.run_id).toBe(s.candidate.run_id);
      expect(x.attempt_id).toBe(s.candidate.attempt_id);
      expect(x.stage).toBe("review_resume");
      expect(x.service).toBe("the-desk");
      expect(x.environment).toBe("test");
      expect(a.stdout + a.stderr + b.stdout + b.stderr).not.toContain(canary);
      const quiet = await runReview("wait", s.candidate, {
        ...env(s),
        LOG_LEVEL: "silent",
      });
      expect(quiet.code).toBe(0);
      expect(quiet.stdout + quiet.stderr).toBe("");
    }, 30000);

    it("consumed config JSON canary refuses with fixed code and no mutation or emitted protected values", async () => {
      const s = await seed(await fresh());
      const canary = `CONSUMED_PROMPT_${randomUUID()}`;
      await mutate(
        s.db,
        "UPDATE show_config_versions SET canonical_payload=jsonb_set(canonical_payload,'{raw_prompt}',to_jsonb($2::text)) WHERE show_config_version_id=(SELECT show_config_version_id FROM program_run_attempts WHERE attempt_id=$1)",
        [s.candidate.attempt_id, canary],
      );
      const witness = await s.db.owner.query<{ c: string }>(
        "SELECT canonical_payload->>'raw_prompt' AS c FROM show_config_versions WHERE show_config_version_id=(SELECT show_config_version_id FROM program_run_attempts WHERE attempt_id=$1)",
        [s.candidate.attempt_id],
      );
      expect(witness.rows[0]?.c).toBe(canary);
      const before = await digest(s.db);
      const r = await runReview("wait", s.candidate, env(s));
      expect(r.code).toBe(2);
      expect(lines(r).at(-1)?.code).toBe("review_policy_invalid");
      expect(r.stdout + r.stderr).not.toContain(canary);
      expect(await digest(s.db)).toBe(before);
    }, 30000);

    it("preflight production/staging, malformed and same-login/wrong-target credentials cause zero DB connections and never leak input", async () => {
      const listener = createServer();
      let connections = 0;
      listener.on("connection", (socket) => {
        connections++;
        socket.destroy();
      });
      await new Promise<void>((resolve) =>
        listener.listen(0, "127.0.0.1", resolve),
      );
      const address = listener.address();
      if (!address || typeof address === "string") throw new Error("listener");
      const fake = `postgresql://runtime:URL_SECRET_CANARY@127.0.0.1:${String(address.port)}/test`;
      const base = reviewEnv(fake, fake.replace("runtime:", "operator:"));
      const input = {
        run_id: randomUUID(),
        attempt_id: randomUUID(),
        episode_version_id: randomUUID(),
        ready_candidate_fingerprint: "a".repeat(64),
      };
      try {
        for (const environment of [
          { ...base, DESK_ENV: "production" },
          { ...base, DESK_ENV: "staging" },
          { ...base, OPERATOR_DATABASE_URL: fake },
          {
            ...base,
            OPERATOR_DATABASE_URL: fake.replace("runtime:", "%72untime:"),
          },
          {
            ...base,
            OPERATOR_DATABASE_URL:
              fake.replace("runtime:", "operator:") + "?options=SECRET",
          },
        ]) {
          const r = await runReview(
            "submit",
            {
              ...input,
              review_decision_id: randomUUID(),
              actor_id: randomUUID(),
              decision: "approve",
            },
            environment,
          );
          expect(r.code).toBe(1);
          expect(r.stdout + r.stderr).not.toContain("SECRET");
        }
        const r = await runReview(
          "wait",
          { ...input, extra: "INPUT_SECRET_CANARY" },
          base,
        );
        expect(r.code).toBe(1);
        expect(r.stdout + r.stderr).not.toContain("INPUT_SECRET_CANARY");
        expect(connections).toBe(0);
      } finally {
        await new Promise<void>((resolve, reject) =>
          listener.close((e) => {
            if (e) reject(e);
            else resolve();
          }),
        );
      }
    }, 30000);

    it("uppercase UUID refuses before DB/lock access while a canonical candidate invocation proceeds", async () => {
      const s = await seed(await fresh());
      const before = await digest(s.db);
      const listener = createServer();
      let connections = 0;
      listener.on("connection", (socket) => {
        connections++;
        socket.destroy();
      });
      await new Promise<void>((resolve) =>
        listener.listen(0, "127.0.0.1", resolve),
      );
      const address = listener.address();
      if (!address || typeof address === "string")
        throw new Error("listener missing");
      const mixed = {
        ...s.candidate,
        run_id: s.candidate.run_id.toUpperCase(),
      };
      expect(mixed.run_id).not.toBe(s.candidate.run_id);
      try {
        const canonical = launchReview("wait", s.candidate, env(s));
        children.push(canonical);
        const denied = await runReview(
          "wait",
          mixed,
          reviewEnv(
            `postgresql://runtime:CANARY@127.0.0.1:${String(address.port)}/test`,
          ),
        );
        expect(denied.code).toBe(1);
        const rejected = denied.stderr
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as Record<string, unknown>)
          .at(-1);
        expect(rejected?.code).toBe("review_request_invalid");
        expect(rejected?.stage).toBe("preflight");
        expect(connections).toBe(0);
        expect(success(await canonical.exited).status).toBe("pending");
        expect(await digest(s.db)).toBe(before);
      } finally {
        await new Promise<void>((resolve, reject) =>
          listener.close((e) => {
            if (e) reject(e);
            else resolve();
          }),
        );
      }
    }, 30000);

    it("first cleanup Rejection code overrides returned candidate_missing outcome during successful flush", async () => {
      const s = await seed(await fresh());
      const before = await digest(s.db);
      const r = await runReview(
        "wait",
        { ...s.candidate, episode_version_id: randomUUID() },
        env(s),
        { patch: "flush_window_first_error" },
      );
      expect(r.code).toBe(1);
      expect(r.signal).toBeNull();
      expect(r.ms).toBeLessThan(5000);
      const output = lines(r);
      const refusal = output.find((x) => x.event === "review.wait");
      expect(refusal).toMatchObject({
        outcome: "rejected",
        code: "review_candidate_missing",
        stage: "review_resume",
      });
      expect(output.some((x) => x.pool_end_completed === true)).toBe(true);
      expect(
        output.some(
          (x) =>
            x.first_error_during_flush === true && x.flush_resolved === true,
        ),
      ).toBe(true);
      expect(output.some((x) => x.first_error_retained === true)).toBe(true);
      const diagnostics = r.stderr
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        event: "review.wait",
        outcome: "error",
        code: "review_role_denied",
        error_class: "Rejection",
        stage: "cleanup",
        correlation_id: refusal?.correlation_id,
        run_id: null,
        attempt_id: null,
        episode_version_id: null,
      });
      expect(refusal?.correlation_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(r.stdout + r.stderr).not.toContain("SECRET_CANARY");
      for (const field of ["err", "message", "stack", "cause", "rawError"])
        expect(diagnostics[0]).not.toHaveProperty(field);
      expect(await digest(s.db)).toBe(before);
    }, 30000);

    it("first pool error during SUCCESSFUL end and delayed SUCCESSFUL flush emits original safe diagnostic after flush", async () => {
      const s = await seed(await fresh());
      const before = await digest(s.db);
      const r = await runReview("wait", s.candidate, env(s), {
        patch: "flush_window_first_error",
      });
      expect(r.code).toBe(1);
      expect(r.ms).toBeLessThan(5000);
      const output = lines(r);
      expect(output.some((x) => x.pool_end_completed === true)).toBe(true);
      expect(
        output.some(
          (x) =>
            x.first_error_during_flush === true && x.flush_resolved === true,
        ),
      ).toBe(true);
      expect(output.some((x) => x.first_error_retained === true)).toBe(true);
      const successEvent = output.find((x) => x.event === "review.wait");
      expect(successEvent?.outcome).toBe("converged");
      const diagnostic = r.stderr
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      expect(diagnostic).toHaveLength(1);
      expect(diagnostic[0]).toMatchObject({
        event: "review.wait",
        outcome: "error",
        stage: "cleanup",
        code: "review_role_denied",
        error_class: "Rejection",
        correlation_id: successEvent?.correlation_id,
        run_id: s.candidate.run_id,
        attempt_id: s.candidate.attempt_id,
      });
      expect(r.stdout + r.stderr).not.toContain("SECRET_CANARY");
      expect(await digest(s.db)).toBe(before);
    }, 30000);

    for (const level of ["silent", "fatal"] as const) {
      it(`standalone first release failure remains diagnostic at LOG_LEVEL ${level}, without an earlier fault`, async () => {
        const s = await seed(await fresh());
        const before = await digest(s.db);
        const r = await runReview(
          "wait",
          s.candidate,
          { ...env(s), LOG_LEVEL: level },
          { patch: "release_fail" },
        );
        expect(r.code).toBe(1);
        expect(r.signal).toBeNull();
        expect(r.ms).toBeLessThan(5000);
        expect(lines(r).some((x) => x.first_error_retained === true)).toBe(
          true,
        );
        const diagnostics = r.stderr
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as Record<string, unknown>);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]).toMatchObject({
          event: "review.wait",
          command: "foundation_review_wait",
          outcome: "error",
          stage: "review_resume",
          error_class: "unclassified",
          run_id: null,
          attempt_id: null,
          episode_version_id: null,
        });
        expect(diagnostics[0]?.correlation_id).toMatch(/^[0-9a-f-]{36}$/);
        expect(diagnostics[0]?.code).toBeUndefined();
        expect(lines(r).filter((x) => x.event === "review.wait")).toHaveLength(
          0,
        );
        // No result returned from the failed release: do not pretend candidate ids were established by a returned record.
        expect(r.stdout + r.stderr).not.toContain("SECRET_CANARY");
        for (const field of ["err", "message", "stack", "cause", "rawError"])
          expect(diagnostics[0]).not.toHaveProperty(field);
        expect(await digest(s.db)).toBe(before);
      }, 30000);
    }

    for (const patch of [
      "end_fail",
      "end_hang",
      "flush_fail",
      "flush_hang",
      "release_fail",
      "late_pool_error",
    ] as const) {
      it(`first diagnostic and bounded cleanup: ${patch}, protected errors never emitted`, async () => {
        const s = await seed(await fresh());
        const before = await digest(s.db);
        const r = await runReview("wait", s.candidate, env(s), {
          throwAt: "review_after_lock",
          patch,
        });
        expect(r.code).toBe(1);
        expect(r.ms).toBeLessThan(15000);
        expect(lines(r).some((x) => x.first_error_retained === true)).toBe(
          true,
        );
        expect(r.stdout + r.stderr).not.toContain("SECRET_CANARY");
        expect(
          lines(r)
            .filter((x) => x.event === "review.wait")
            .at(-1)?.stage,
        ).toBe("review_resume");
        if (patch === "late_pool_error")
          expect(lines(r).some((x) => x.late_pool_error_emitted === true)).toBe(
            true,
          );
        expect(await digest(s.db)).toBe(before);
      }, 30000);
    }
  },
);
