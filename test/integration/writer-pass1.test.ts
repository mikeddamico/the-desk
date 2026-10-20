// Integration tests of the fixed writer Pass-1 seam against disposable PostgreSQL 17 databases (the existing TestCluster), on the actual
// `desk_runtime` pool. Every case starts from a fresh migrated database with the pinned fixture loaded and the strict Q0 checkpoint passed
// once before the first seam call, and records the per-table counts and the 398 historical rows at that moment; every case ends by
// checking its exact row delta and that the historical rows are unchanged. Component tests (I15-I17, I20, I21) enter the component that
// owns the boundary with valid prerequisites; what the public orchestrator does on the SAME contaminated database is asserted separately.
// Nothing here is a model or quality result. The uncounted `afterAll` teardown asserts independently that every database and login role
// this file may have created is gone, even when setup failed part-way.
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { allTables, families } from "../../src/fixture/families.js";
import { openFixturePack } from "../../src/fixture/pack.js";
import {
  FixtureReadBackError,
  databaseBindingChecks,
  reenterCompletePinnedFixture,
  verifyCompletePinnedFixture,
} from "../../src/fixture/persist.js";
import { PASS1_SPECIMEN } from "../../src/fixture/writer-pass1-specimen.js";
import {
  scriptHash,
  showrunnerBriefHash,
} from "../../src/identity/artifacts.js";
import { domainHash } from "../../src/identity/canonical-json.js";
import { promptManifestArtifactHash } from "../../src/identity/prompt-manifest.js";
import {
  GATES_NOT_RUN,
  PASS1_PIN,
  classifyPass1Snapshot,
  executeWriterPass1Call,
  planWriterPass1,
  readPass1Snapshot,
  reconcileScriptRows,
  recordWriterPass1Lineage,
  renderWriterPass1Request,
  runWriterPass1,
  stageWriterPass1Inputs,
  type Pass1Plan,
  type Pass1Recorded,
  type Pass1Stopped,
} from "../../src/runtime/writer-pass1.js";
import { nonNetworkControls } from "../support/a5-provider.js";
import { TestCluster, type DbEnv } from "../support/db-env.js";

type Obj = Record<string, unknown>;
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
const INV = {
  attempt_id: "e5aaee76-ec19-4917-b293-24a0435b3a92",
  started_at: "2026-10-20T00:00:00Z",
  ended_at: "2026-10-20T00:00:01Z",
  created_at: "2026-10-20T00:00:02Z",
};
// the same two instants and the creation time written with offsets and six fractional digits (I01 runs the whole seam on this form)
const INV_OFFSET = {
  attempt_id: INV.attempt_id,
  started_at: "2026-10-20T02:00:00.500000+02:00",
  ended_at: "2026-10-19T19:00:01.250000-05:00",
  created_at: "2026-10-20T00:00:02.000001+00:00",
};
const SECOND_ATTEMPT = "6fc595be-d052-4281-a805-bce4154cb386";
const FOREIGN = "00000000-0000-4000-8000-0000000000f1";
const HOOK = Symbol.for("the-desk.a5.test-fault-hook");
const T = 300000;
const ADDED: Readonly<Record<string, number>> = {
  artifacts: 4,
  prompt_manifests: 1,
  provider_calls: 1,
  provider_call_events: 1,
  model_runs: 1,
  script_versions: 1,
  turns: 17,
  turn_claim_uses: 12,
  turn_evidence_uses: 3,
};
const AFTER_T1: Readonly<Record<string, number>> = { artifacts: 3, prompt_manifests: 1 };
const AFTER_RESERVATION: Readonly<Record<string, number>> = { ...AFTER_T1, provider_calls: 1 };
const AFTER_EVENT: Readonly<Record<string, number>> = { ...AFTER_RESERVATION, provider_call_events: 1 };
const EMPTY_EXTRA = [
  "episodes",
  "episode_versions",
  "review_decisions",
  "repair_requests",
  "repair_plans",
  "repair_plan_decisions",
];
const COUNTED = [...allTables, ...EMPTY_EXTRA];

// ---- ownership is recorded BEFORE the first fallible resource creation, so the independent absence check can never be skipped ------------
const cluster = url ? new TestCluster(url) : undefined;
const runId = cluster ? (cluster as unknown as { run?: unknown }).run : undefined;
const ownedPrefix =
  typeof runId === "string" && /^[0-9a-f]{8}$/.test(runId) ? `fl_${runId}_` : undefined;
const ownedDatabases = new Set<string>();
const ownedRoles = new Set<string>(
  ownedPrefix === undefined ? [] : [`${ownedPrefix}migrator`, `${ownedPrefix}runtime`],
);
const opened: Env[] = [];
const teardownFailures: unknown[] = [];
let plan: Pass1Plan;

type Env = DbEnv & {
  /** per-table counts and the 398 historical rows, recorded after Q0 and before the first seam call */
  baseline: Record<string, number>;
  history: Map<string, string>;
};
const tableCounts = async (pool: pg.Pool): Promise<Record<string, number>> => {
  const out: Record<string, number> = {};
  for (const table of COUNTED)
    out[table] = Number(
      (await pool.query<{ n: string }>(`SELECT count(*) AS n FROM "${table}"`))
        .rows[0]?.n,
    );
  return out;
};
/** Every historical row, keyed by table and primary key, as PostgreSQL renders it. */
const historical = async (pool: pg.Pool): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  for (const family of families) {
    const key = family.primaryKey.map((c) => `${c}::text`).join(" || '|' || ");
    const result = await pool.query<{ k: string; v: string }>(
      `SELECT ${key} AS k, to_jsonb(x)::text AS v FROM "${family.table}" x`,
    );
    for (const row of result.rows) out.set(`${family.table}|${row.k}`, row.v);
  }
  return out;
};
const fresh = async (): Promise<Env> => {
  if (!cluster) throw new Error("test database required");
  const created = await cluster.create({ migrate: true });
  ownedDatabases.add(created.name);
  ownedRoles.add(new URL(created.migratorUrl).username);
  ownedRoles.add(new URL(created.runtimeUrl).username);
  const db: Env = Object.assign(created, {
    baseline: {} as Record<string, number>,
    history: new Map<string, string>(),
  });
  opened.push(db);
  await reenterCompletePinnedFixture(db.migrator, { DESK_ENV: "test" });
  await verifyCompletePinnedFixture(db.runtime); // Q0: once, before the first seam call
  db.baseline = await tableCounts(db.owner);
  db.history = await historical(db.owner);
  expect(db.history.size).toBe(398);
  return db;
};
/** The one historical row a test deliberately changed through the existing transition function: only `field` may differ, to `to`. */
interface HistoricalChange {
  readonly key: string;
  readonly field: string;
  readonly from: string;
  readonly to: string;
}
/** The exact row delta against the preamble baseline, and every historical row byte-identical (except the one declared change). */
const verify = async (
  db: Env,
  expected: Readonly<Record<string, number>>,
  since: Record<string, number> = db.baseline,
  change?: HistoricalChange,
): Promise<void> => {
  const after = await tableCounts(db.owner);
  for (const table of COUNTED)
    expect((after[table] ?? 0) - (since[table] ?? 0), `rows added to ${table}`).toBe(expected[table] ?? 0);
  const rows = await historical(db.owner);
  for (const [key, value] of db.history) {
    if (change && key === change.key) {
      const was = JSON.parse(value) as Obj;
      expect(was[change.field], `${key} before`).toBe(change.from);
      expect(JSON.parse(rows.get(key) ?? "null") as unknown, `${key} after`).toEqual({ ...was, [change.field]: change.to });
    } else expect(rows.get(key), key).toBe(value);
  }
  if (change) expect(db.history.has(change.key), `${change.key} is a recorded historical row`).toBe(true);
};
const attemptState = (from: string, to: string): HistoricalChange => ({
  key: `program_run_attempts|${INV.attempt_id}`,
  field: "state",
  from,
  to,
});
const closeEnv = async (db: Env): Promise<void> => {
  const at = opened.indexOf(db);
  if (at >= 0) opened.splice(at, 1);
  try {
    await db.close();
  } catch (error) {
    teardownFailures.push(error);
  }
};

// ---- running the seam ------------------------------------------------------------------------------------------------------------
const observer = () => ({ correlationId: randomUUID(), observer: () => undefined });
const runWith = (
  pool: pg.Pool,
  controls: unknown = nonNetworkControls(),
  invocation: unknown = INV,
): Promise<Pass1Recorded | Pass1Stopped> =>
  runWriterPass1(pool, invocation, observer(), controls);
/** The orchestrator with the controls argument passed EXACTLY as given (including an explicit `undefined`). */
const runExplicit = (pool: pg.Pool, controls: unknown): Promise<Pass1Recorded | Pass1Stopped> =>
  runWriterPass1(pool, INV, observer(), controls);
interface StageOk {
  readonly kind: "ok";
}
type Outcomes = Pass1Recorded | Pass1Stopped | StageOk;
const recorded = (result: Outcomes): Pass1Recorded => {
  if (result.kind !== "recorded") throw new Error(`expected recorded, got ${result.kind}`);
  return result;
};
const stopped = (result: Outcomes): Pass1Stopped => {
  if (result.kind !== "stopped") throw new Error(`expected a stop, got ${result.kind}`);
  return result;
};
const staged = <T extends StageOk>(result: T | Pass1Stopped): T => {
  if (result.kind !== "ok") throw new Error(`expected ok, got ${result.kind}`);
  return result;
};
interface Faults {
  performs: number;
  points: string[];
}
/** Installs the inert-by-default fault hook for one scope; `performs` counts every call of the fixed adapter's `perform`. */
const withFaults = async <T>(
  hook: ((point: string, faults: Faults) => unknown) | undefined,
  fn: (faults: Faults) => Promise<T>,
): Promise<T> => {
  const faults: Faults = { performs: 0, points: [] };
  const previous = Object.getOwnPropertyDescriptor(globalThis, HOOK);
  const flag = process.env.DESK_TEST_FAULTS;
  process.env.DESK_TEST_FAULTS = "1";
  Object.defineProperty(globalThis, HOOK, {
    configurable: true,
    value: async (point: string): Promise<void> => {
      faults.points.push(point);
      if (point === "writer_pass1_perform") faults.performs += 1;
      await hook?.(point, faults);
    },
  });
  try {
    return await fn(faults);
  } finally {
    if (previous) Object.defineProperty(globalThis, HOOK, previous);
    else Reflect.deleteProperty(globalThis, HOOK);
    if (flag === undefined) delete process.env.DESK_TEST_FAULTS;
    else process.env.DESK_TEST_FAULTS = flag;
  }
};

/**
 * A test-only instrumented pool in front of the real runtime pool: BOTH `pool.query` and every checked-out client's `query`/`release`
 * are forwarded to the real ones and recorded in order; `when` selects statements to fail (counted in `injected`). Restored on release.
 */
interface Trace {
  readonly events: string[];
  injected: number;
  clients: number;
}
const textOf = (first: unknown): string =>
  typeof first === "string" ? first : String((first as { text?: unknown } | undefined)?.text ?? "");
const tracePool = (
  real: pg.Pool,
  when: (text: string) => boolean = () => false,
): { pool: pg.Pool; trace: Trace } => {
  const trace: Trace = { events: [], injected: 0, clients: 0 };
  const run = (label: string, forward: () => unknown, text: string): unknown => {
    trace.events.push(`${label} ${text}`);
    if (when(text)) {
      trace.injected += 1;
      return Promise.reject(new Error("injected statement failure"));
    }
    return forward();
  };
  const pool = {
    connect: async () => {
      const client = await real.connect();
      trace.clients += 1;
      const label = `client${String(trace.clients)}`;
      const original = client.query.bind(client) as (...a: unknown[]) => unknown;
      const release = client.release.bind(client);
      const patched = client as unknown as { query: unknown; release: unknown };
      patched.query = (...args: unknown[]): unknown =>
        run(`${label} query`, () => original(...args), textOf(args[0]));
      patched.release = (arg?: unknown): void => {
        trace.events.push(`${label} release ${String(arg)}`);
        delete (client as unknown as { query?: unknown }).query;
        delete (client as unknown as { release?: unknown }).release;
        release(arg as boolean | undefined);
      };
      return client;
    },
    query: (...args: unknown[]): unknown =>
      run("pool query", () => (real.query as (...a: unknown[]) => unknown)(...args), textOf(args[0])),
  } as unknown as pg.Pool;
  return { pool, trace };
};
const transition = (db: DbEnv, from: string, to: string): Promise<unknown> =>
  db.runtime.query("SELECT transition_attempt($1,$2,$3)", [INV.attempt_id, from, to]);

// ---- direct inserts of foreign / tampered history through the database owner (contamination for the negatives) ---------------------
const insertArtifactJson = (db: DbEnv, id: string, type: string, schema: string, hash: string, json: string) =>
  db.owner.query(
    "INSERT INTO artifacts (artifact_id, artifact_type, schema_version, content_hash, canonical_payload) VALUES ($1::uuid,$2,$3,$4,$5::jsonb)",
    [id, type, schema, hash, json],
  );
const insertArtifact = (db: DbEnv, id: string, type: string, schema: string, hash: string, payload: unknown) =>
  insertArtifactJson(db, id, type, schema, hash, JSON.stringify(payload));
const insertCall = (db: DbEnv, over: Obj = {}) => {
  const v = { ...plan.reservation, ...over };
  return db.owner.query(
    `INSERT INTO provider_calls (provider_call_id, attempt_id, provider, operation, model_identifier, request_fingerprint, logical_request_key,
       operational_try_number, started_at) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,1,$8::timestamptz)`,
    [v.provider_call_id, v.attempt_id, v.provider, v.operation, v.model_identifier, v.request_fingerprint, v.logical_request_key, INV.started_at],
  );
};
const insertEvent = (db: DbEnv, callId: string, reference: string) =>
  db.owner.query(
    `INSERT INTO provider_call_events (provider_call_id, event_type, ended_at, usage, actual_cost, currency, response_reference)
     VALUES ($1::uuid,'succeeded',$2::timestamptz,$3::jsonb,'0.0000','USD',$4)`,
    [callId, INV.ended_at, JSON.stringify({ external_provider_contacted: false, fixture_execution: true }), reference],
  );
const foreignScript = (db: DbEnv) =>
  insertArtifact(db, FOREIGN, "script_pass1", "writer-pass1-script/1", plan.script_hash, { other: true });

suite("writer Pass-1 fixed fixture seam (disposable PostgreSQL 17, runtime role)", () => {
  beforeAll(async () => {
    const planned = planWriterPass1(INV);
    if (planned.kind !== "planned") throw new Error(`plan stopped: ${planned.code}`);
    plan = planned.plan;
    await cluster?.bootstrap();
  }, T);
  afterEach(async () => {
    for (const db of [...opened]) await closeEnv(db);
  }, T);
  afterAll(async () => {
    for (const db of [...opened]) await closeEnv(db);
    try {
      await cluster?.shutdown(); // discards its own drop errors: the assertion below is the evidence
    } catch (error) {
      teardownFailures.push(error);
    }
    if (url) {
      if (ownedPrefix === undefined)
        teardownFailures.push(new Error("owned name prefix could not be determined: absence cannot be asserted"));
      const admin = new pg.Pool({ connectionString: url, max: 1 });
      try {
        const prefix = ownedPrefix ?? "fl_unknown_never_matches_";
        const databases = await admin.query<{ datname: string }>(
          "SELECT datname FROM pg_database WHERE datname = ANY($1::text[]) OR starts_with(datname, $2)",
          [[...ownedDatabases], prefix],
        );
        const roles = await admin.query<{ rolname: string }>(
          "SELECT rolname FROM pg_roles WHERE rolname = ANY($1::text[]) OR starts_with(rolname, $2)",
          [[...ownedRoles], prefix],
        );
        if (databases.rows.length > 0)
          teardownFailures.push(new Error(`owned databases remain: ${databases.rows.map((r) => r.datname).join(",")}`));
        if (roles.rows.length > 0)
          teardownFailures.push(new Error(`owned login roles remain: ${roles.rows.map((r) => r.rolname).join(",")}`));
      } catch (error) {
        teardownFailures.push(error);
      } finally {
        try {
          await admin.end();
        } catch (error) {
          teardownFailures.push(error);
        }
      }
    }
    if (teardownFailures.length > 0)
      throw new AggregateError(teardownFailures, "owned database/role teardown was not clean");
  }, T);

  it("I01 happy path on the actual runtime role (offset-form invocation): exact 41-row delta, NULL admission columns, exact event", async () => {
    const db = await fresh();
    const who = await db.runtime.query<{ u: string }>("SELECT current_user AS u");
    expect(who.rows[0]?.u).toBe("desk_runtime");
    for (const table of Object.keys(ADDED)) {
      const privilege = await db.runtime.query<{ update: boolean; insert: boolean }>(
        `SELECT has_table_privilege(current_user, $1, 'UPDATE') AS update, has_table_privilege(current_user, $1, 'INSERT') AS insert`,
        [table],
      );
      expect(privilege.rows[0]).toEqual({ update: false, insert: true });
    }
    const { result, faults } = await withFaults(undefined, async (f) => ({
      result: await runWith(db.runtime, nonNetworkControls(), INV_OFFSET),
      faults: f,
    }));
    const done = recorded(result);
    expect(done.convergence).toEqual({ t1: "created", execute: "performed", t3: "created" });
    expect(done.durable).toEqual({ t1: "present", reservation: "present", outcome: "present", lineage: "present" });
    expect(done.identities.script_hash).toBe("b18d1fcee6ccd784933fd5e19b957ae252a5c892deb3d342ca768d61cea94ae9");
    expect(faults.performs).toBe(1);
    await verify(db, ADDED);
    expect(Object.values(ADDED).reduce((a, b) => a + b, 0)).toBe(41);
    const call = await db.owner.query(
      `SELECT provider, operation, model_identifier, request_fingerprint, logical_request_key, operational_try_number,
         (started_at = $2::timestamptz) AS started_exact, (started_at = '2026-10-20T00:00:00.500000Z'::timestamptz) AS started_utc,
         num_nonnulls(admitted_at, reserved_cost_upper_bound, admission_currency, admission_policy_hash, admission_certificate, admission_certificate_hash) AS metadata
       FROM provider_calls WHERE provider_call_id = $1`,
      [plan.ids.provider_call_id, INV_OFFSET.started_at],
    );
    expect(call.rows[0]).toEqual({
      provider: "fixture_stub",
      operation: "writer",
      model_identifier: "fixture_stub/writer-pass1-v2",
      request_fingerprint: PASS1_PIN.rendered_request_hash,
      logical_request_key: PASS1_PIN.logical_request_key,
      operational_try_number: 1,
      started_exact: true,
      started_utc: true,
      metadata: 0,
    });
    const event = await db.owner.query(
      `SELECT event_type, usage, actual_cost::text AS actual_cost, currency, response_artifact_id, response_reference,
         (ended_at = '2026-10-20T00:00:01.250000Z'::timestamptz) AS ended_exact,
         num_nonnulls(recorded_at, admission_settlement) AS metadata FROM provider_call_events WHERE provider_call_id = $1`,
      [plan.ids.provider_call_id],
    );
    expect(event.rows[0]).toEqual({
      event_type: "succeeded",
      usage: { external_provider_contacted: false, fixture_execution: true },
      actual_cost: "0.0000",
      currency: "USD",
      response_artifact_id: null,
      response_reference: PASS1_PIN.response_reference,
      ended_exact: true,
      metadata: 0,
    });
    const script = await db.owner.query<{ canonical_payload: Obj }>(
      "SELECT canonical_payload FROM artifacts WHERE artifact_id = $1",
      [PASS1_PIN.script_artifact_id],
    );
    expect(script.rows[0]?.canonical_payload.created_at).toBe(INV_OFFSET.created_at); // the authored text is stored as authored
    const states = await db.owner.query(
      `SELECT a.state::text AS attempt, r.state::text AS run FROM program_run_attempts a JOIN program_runs r USING (program_run_id) WHERE a.attempt_id = $1`,
      [INV.attempt_id],
    );
    expect(states.rows[0]).toEqual({ attempt: "PENDING", run: "PENDING" });
  }, T);

  it("I02 independent read-back: every governed hash recomputes from the stored payloads", async () => {
    const db = await fresh();
    recorded(await runWith(db.runtime));
    const artifact = async (id: string): Promise<Obj> =>
      (await db.owner.query<Obj>("SELECT artifact_type, schema_version, content_hash, canonical_payload FROM artifacts WHERE artifact_id = $1", [id])).rows[0] ?? {};
    const w2 = await artifact(PASS1_PIN.writer_view_v2_artifact_id);
    const c2 = await artifact(PASS1_PIN.writer_context_manifest_v2_artifact_id);
    const manifest = await artifact(PASS1_PIN.prompt_manifest_artifact_id);
    const script = await artifact(PASS1_PIN.script_artifact_id);
    expect(domainHash("writer-view-v2", w2.canonical_payload)).toBe(PASS1_PIN.w_domain_sha256);
    expect(w2.content_hash).toBe(PASS1_PIN.w_domain_sha256);
    expect(domainHash("writer-context-manifest-v2", c2.canonical_payload)).toBe(PASS1_PIN.c_domain_sha256);
    expect(promptManifestArtifactHash(manifest.canonical_payload)).toBe(PASS1_PIN.prompt_manifest_artifact_hash);
    const refs = (manifest.canonical_payload as Obj).ordered_input_artifacts as Obj[];
    const rebuilt = renderWriterPass1Request(
      refs.map((r) => ({ artifact_id: String(r.artifact_id), artifact_type: String(r.artifact_type), content_hash: String(r.content_hash) })),
    );
    expect(rebuilt.hash).toBe(PASS1_PIN.rendered_request_hash);
    expect(rebuilt.text).toBe(plan.request_text);
    const brief = openFixturePack().json("showrunner_brief.json") as Obj;
    expect(showrunnerBriefHash(brief)).toBe(plan.script_payload.brief_hash);
    const payload = script.canonical_payload as Obj;
    expect(scriptHash(payload, { brief })).toBe(PASS1_PIN.response_reference.slice(-64));
    expect(script.content_hash).toBe(payload.script_hash);
    const turns = await db.owner.query<Obj>(
      "SELECT turn_id::text AS turn_id, script_version_id::text AS script_version_id, program_block_id::text AS program_block_id, sequence, participant_id, spoken_text FROM turns WHERE script_version_id = $1 ORDER BY sequence",
      [plan.ids.script_version_id],
    );
    const claims = (await db.owner.query<Obj>("SELECT turn_claim_use_id::text AS turn_claim_use_id, turn_id::text AS turn_id, claim_id::text AS claim_id, use_mode, span_start, span_end FROM turn_claim_uses WHERE turn_id = ANY($1::uuid[])", [plan.ids.turn_ids])).rows;
    const evidence = (await db.owner.query<Obj>("SELECT turn_evidence_use_id::text AS turn_evidence_use_id, turn_id::text AS turn_id, evidence_unit_id::text AS evidence_unit_id, use_mode, span_start, span_end FROM turn_evidence_uses WHERE turn_id = ANY($1::uuid[])", [plan.ids.turn_ids])).rows;
    expect(turns.rows).toHaveLength(17);
    expect(claims).toHaveLength(12);
    expect(evidence).toHaveLength(3);
    const parts = { script_version_id: plan.ids.script_version_id, turns: turns.rows, claim_uses: claims, evidence_uses: evidence };
    expect(reconcileScriptRows(brief, payload, parts, String(script.content_hash))).toBe(true);
    expect(reconcileScriptRows(brief, payload, { ...parts, turns: turns.rows.slice(1) }, String(script.content_hash))).toBe(false);
    expect(payload.turns).toHaveLength(PASS1_SPECIMEN.turns.length);
    await verify(db, ADDED);
  }, T);

  it("I03 post-state: the strict checkpoint refuses with its named code; binding checks pass; history unchanged", async () => {
    const db = await fresh();
    recorded(await runWith(db.runtime));
    await expect(verifyCompletePinnedFixture(db.runtime)).rejects.toBeInstanceOf(FixtureReadBackError);
    await expect(verifyCompletePinnedFixture(db.runtime)).rejects.toMatchObject({ code: "complete_fixture_mismatch" });
    await expect(databaseBindingChecks(db.runtime)).resolves.toBeUndefined();
    await verify(db, ADDED);
  }, T);

  it("I04 identical re-entry after completion: converged, zero deltas, perform counter stays 1", async () => {
    const db = await fresh();
    await withFaults(undefined, async (faults) => {
      recorded(await runWith(db.runtime));
      const mid = await tableCounts(db.owner);
      const again = recorded(await runWith(db.runtime));
      expect(again.convergence).toEqual({ t1: "converged", execute: "completed", t3: "converged" });
      await verify(db, {}, mid);
      expect(faults.performs).toBe(1);
    });
    await verify(db, ADDED);
  }, T);

  it("I05 concurrency and the coherent snapshot: pre-commit state, fresh later state, closure before entry into T1", async () => {
    const db = await fresh();
    await withFaults(undefined, async (faults) => {
      const results = await Promise.all([runWith(db.runtime), runWith(db.runtime)]);
      for (const r of results)
        expect(r.kind === "recorded" || (r.kind === "stopped" && r.code === "pass1_provider_unfinished")).toBe(true);
      expect(results.some((r) => r.kind === "recorded")).toBe(true);
      expect(faults.performs).toBe(1);
      await verify(db, ADDED);
      const mid = await tableCounts(db.owner);
      const loser = recorded(await runWith(db.runtime)); // explicit identical re-entry
      expect(loser.convergence.execute).toBe("completed");
      await verify(db, {}, mid);
    });
    // two concurrent T3 recoverers: one set of 35 rows, one created and one converged, no unhandled unique violation
    const second = await fresh();
    staged(await stageWriterPass1Inputs(second.runtime, plan));
    staged(await executeWriterPass1Call(second.runtime, plan, observer(), nonNetworkControls()));
    const [a, b] = await Promise.all([recordWriterPass1Lineage(second.runtime, plan), recordWriterPass1Lineage(second.runtime, plan)]);
    expect([staged(a).convergence, staged(b).convergence].sort()).toEqual(["converged", "created"]);
    await verify(second, ADDED);
    // C1, direct: a complete T1 committed by a second connection AFTER the snapshot's first read. The snapshot still classifies the
    // pre-commit state (0), is closed, and a fresh read afterwards sees the later state (1).
    const third = await fresh();
    await withFaults(
      async (point, faults) => {
        if (point === "writer_pass1_preflight_after_first_read" && faults.points.filter((p) => p === point).length === 1)
          staged(await stageWriterPass1Inputs(third.runtime, plan));
      },
      async () => {
        const during = await readPass1Snapshot(third.runtime, plan);
        if (!during.ok) throw new Error("snapshot failed");
        const seen = classifyPass1Snapshot(during.raw, plan, "preflight");
        expect(seen.kind === "state" ? seen.state : seen.row.code).toBe(0);
        const later = await readPass1Snapshot(third.runtime, plan);
        if (!later.ok) throw new Error("snapshot failed");
        const now = classifyPass1Snapshot(later.raw, plan, "preflight");
        expect(now.kind === "state" ? now.state : now.row.code).toBe(1);
      },
    );
    await verify(third, AFTER_T1);
    // C1, direct, second competitor: the WHOLE seam completes through a second connection after the first read (state 0 then 4)
    const fourth = await fresh();
    let competed = false;
    await withFaults(
      async (point) => {
        if (point === "writer_pass1_preflight_after_first_read" && !competed) {
          competed = true;
          recorded(await runWith(fourth.runtime));
        }
      },
      async () => {
        const during = await readPass1Snapshot(fourth.runtime, plan);
        if (!during.ok) throw new Error("snapshot failed");
        const seen = classifyPass1Snapshot(during.raw, plan, "preflight");
        expect(seen.kind === "state" ? seen.state : seen.row.code).toBe(0);
        const later = await readPass1Snapshot(fourth.runtime, plan);
        if (!later.ok) throw new Error("snapshot failed");
        const now = classifyPass1Snapshot(later.raw, plan, "preflight");
        expect(now.kind === "state" ? now.state : now.row.code).toBe(4);
      },
    );
    await verify(fourth, ADDED);
    // the full seam over an instrumented pool: the preflight snapshot is committed and released BEFORE entry into the writing T1 command, and the final
    // recheck is a second, fresh read-only snapshot after the last write; the competing T1 commits mid-snapshot
    const fifth = await fresh();
    const { pool, trace } = tracePool(fifth.runtime);
    let raced = false;
    await withFaults(
      async (point) => {
        if (point === "writer_pass1_preflight_after_first_read" && !raced) {
          raced = true;
          staged(await stageWriterPass1Inputs(fifth.runtime, plan)); // the untraced pool: not part of the ordering under test
        }
      },
      async () => {
        const done = recorded(await runWith(pool));
        expect(done.convergence.t1).toBe("converged");
      },
    );
    const at = (needle: string, from = 0): number => {
      const i = trace.events.findIndex((e, n) => n >= from && e.includes(needle));
      expect(i, needle).toBeGreaterThanOrEqual(0);
      return i;
    };
    const begin1 = at("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const commit1 = at("query COMMIT", begin1);
    const release1 = at("release", commit1);
    // Identify the first traced writing command independently of the release position; the competitor uses the untraced pool.
    const t1Begin = at("BEGIN ISOLATION LEVEL READ COMMITTED");
    const t1Lock = at("SELECT pg_advisory_xact_lock($1::int, hashtext($2::text))");
    const firstWrite = at("INSERT INTO", t1Lock);
    expect(begin1).toBeLessThan(commit1);
    expect(commit1).toBeLessThan(release1);
    expect(release1).toBeLessThan(t1Begin); // closure before entry into the writing T1 command, not merely before its first INSERT
    expect(t1Begin).toBeLessThan(t1Lock);
    expect(t1Lock).toBeLessThan(firstWrite);
    const lastWrite = trace.events.map((e, n) => (e.includes("INSERT INTO") ? n : -1)).reduce((m, n) => Math.max(m, n), -1);
    const begin2 = at("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY", release1 + 1);
    expect(begin2).toBeGreaterThan(lastWrite); // the final recheck is a fresh snapshot after the last write
    expect(trace.events.filter((e) => e.includes("REPEATABLE READ READ ONLY"))).toHaveLength(2);
    await verify(fifth, ADDED);
  }, T);

  it("I06 lost return after the acknowledged T1 commit, then identical re-entry (partial-state check, no strict checkpoint)", async () => {
    const db = await fresh();
    await withFaults(
      async (point, faults) => {
        if (point === "after_commit_before_return" && faults.points.filter((p) => p === point).length === 1)
          throw new Error("injected lost return after T1");
      },
      async () => {
        await expect(runWith(db.runtime)).rejects.toThrow("injected lost return after T1");
      },
    );
    await verify(db, AFTER_T1);
    const done = recorded(await runWith(db.runtime));
    expect(done.convergence.t1).toBe("converged");
    await verify(db, ADDED);
  }, T);

  it("I07 lost return after the acknowledged reservation commit: unfinished on re-entry, no takeover", async () => {
    const db = await fresh();
    await withFaults(
      (point) => {
        if (point === "after_reservation_commit") throw new Error("injected lost return after the reservation");
      },
      async (faults) => {
        const first = stopped(await runWith(db.runtime));
        expect(first.code).toBe("pass1_provider_error");
        expect(first.provider_error?.reservation_commit_state).toBe("committed");
        expect(first.durable).toEqual({ t1: "present", reservation: "present", outcome: "unknown", lineage: "none_observed" });
        expect(first.writes_attempted).toBe(true);
        expect(first.cleanup).toEqual({ attached_errors: null, complete: false });
        expect(faults.performs).toBe(0);
      },
    );
    await verify(db, AFTER_RESERVATION);
    await withFaults(undefined, async (faults) => {
      const again = stopped(await runWith(db.runtime));
      expect(again.code).toBe("pass1_provider_unfinished");
      expect(again.provider?.reason).toBe("converged_without_outcome");
      expect(again.durable).toEqual({ t1: "present", reservation: "present", outcome: "none_observed", lineage: "none_observed" });
      expect(faults.performs).toBe(0);
    });
    await verify(db, AFTER_RESERVATION);
  }, T);

  it("I08 lost return after the acknowledged outcome commit: re-entry completes through T3", async () => {
    const db = await fresh();
    await withFaults(
      (point) => {
        if (point === "after_outcome_commit") throw new Error("injected lost return after the outcome");
      },
      async () => {
        const first = stopped(await runWith(db.runtime));
        expect(first.code).toBe("pass1_provider_error");
        expect(first.provider_error?.stage).toBe("record");
        expect(first.durable).toEqual({ t1: "present", reservation: "present", outcome: "present", lineage: "none_observed" });
      },
    );
    await verify(db, AFTER_EVENT);
    const done = recorded(await runWith(db.runtime));
    expect(done.convergence).toEqual({ t1: "converged", execute: "completed", t3: "created" });
    await verify(db, ADDED);
  }, T);

  it("I09 a failure inside T3 before commit: the injected statement is reached once through the pool path; zero T3 rows; re-entry completes", async () => {
    const db = await fresh();
    const { pool, trace } = tracePool(db.runtime, (text) => text.includes("INSERT INTO model_runs"));
    await expect(runWith(pool)).rejects.toThrow("injected statement failure");
    expect(trace.injected).toBe(1); // reached exactly once
    // the post-execute provider fetch went through the forwarded pool.query BEFORE the injection (the earlier defect: it failed here)
    const fetched = trace.events.findIndex((e) => e.startsWith("pool query") && e.includes("FROM provider_calls"));
    const injected = trace.events.findIndex((e) => e.includes("INSERT INTO model_runs"));
    expect(fetched).toBeGreaterThanOrEqual(0);
    expect(fetched).toBeLessThan(injected);
    await verify(db, AFTER_EVENT);
    const done = recorded(await runWith(db.runtime));
    expect(done.convergence).toEqual({ t1: "converged", execute: "completed", t3: "created" });
    await verify(db, ADDED);
  }, T);

  it("I10 lost return after the acknowledged T3 commit: re-entry converges with zero deltas", async () => {
    const db = await fresh();
    await withFaults(
      async (point) => {
        if (point !== "after_commit_before_return") return;
        const n = Number((await db.owner.query<{ n: string }>("SELECT count(*) AS n FROM model_runs")).rows[0]?.n);
        if (n === (db.baseline.model_runs ?? 0) + 1) throw new Error("injected lost return after T3");
      },
      async () => {
        await expect(runWith(db.runtime)).rejects.toThrow("injected lost return after T3");
      },
    );
    await verify(db, ADDED);
    await withFaults(undefined, async (faults) => {
      const done = recorded(await runWith(db.runtime));
      expect(done.convergence).toEqual({ t1: "converged", execute: "completed", t3: "converged" });
      expect(faults.performs).toBe(0);
    });
    await verify(db, ADDED);
  }, T);

  it("I11 provider controls refused (three bad, one explicitly absent): no reservation row, perform 0; the valid controls then succeed", async () => {
    const db = await fresh();
    const variants: [string, unknown][] = [
      ["providers enabled", { ...nonNetworkControls(), PROVIDERS_ENABLED: true }],
      ["kill switch", { ...nonNetworkControls(), GENERATION_KILL_SWITCH: true }],
      ["malformed", { mode: "non_network" }],
      ["absent", undefined],
    ];
    expect(variants.find(([name]) => name === "absent")?.[1]).toBeUndefined();
    await withFaults(undefined, async (faults) => {
      for (const [name, controls] of variants) {
        const result = stopped(await runExplicit(db.runtime, controls)); // the controls argument is passed exactly as listed
        expect(result.code, name).toBe("pass1_provider_rejected");
        expect(result.provider?.status, name).toBe("rejected");
        expect(result.durable.reservation, name).toBe("unknown");
      }
      expect(faults.performs).toBe(0);
    });
    await verify(db, AFTER_T1);
    recorded(await runExplicit(db.runtime, nonNetworkControls())); // repair
    await verify(db, ADDED);
  }, T);

  it("I12 staging and production are refused: no reservation; the valid controls then succeed", async () => {
    const db = await fresh();
    await withFaults(undefined, async (faults) => {
      for (const env of ["staging", "production"]) {
        const result = stopped(await runExplicit(db.runtime, { ...nonNetworkControls(), DESK_ENV: env }));
        expect(result.code, env).toBe("pass1_provider_rejected");
      }
      expect(faults.performs).toBe(0);
    });
    await verify(db, AFTER_T1);
    recorded(await runExplicit(db.runtime, nonNetworkControls())); // repair
    await verify(db, ADDED);
  }, T);

  it("I13 perform throws: ambiguous, no event, no model run, no T3", async () => {
    const db = await fresh();
    await withFaults(
      (point) => {
        if (point === "writer_pass1_perform") throw new Error("injected perform failure");
      },
      async (faults) => {
        const result = stopped(await runWith(db.runtime));
        expect(result.code).toBe("pass1_provider_ambiguous");
        expect(result.provider?.code).toBe("provider_perform_ambiguous");
        expect(result.durable).toEqual({ t1: "present", reservation: "present", outcome: "unknown", lineage: "none_observed" });
        expect(faults.performs).toBe(1);
      },
    );
    await verify(db, AFTER_RESERVATION);
  }, T);

  it("I14 a 1 ms timeout with a delayed perform: one perform, late value settled, zero SQL after the timeout on both pool paths", async () => {
    const db = await fresh();
    const { pool, trace } = tracePool(db.runtime);
    let lateSettled: Promise<void> = Promise.resolve();
    await withFaults(
      (point) => {
        if (point === "writer_pass1_perform")
          lateSettled = sleep(150).then(() => {
            trace.events.push("mark late-perform-settled");
          });
        return lateSettled;
      },
      async (faults) => {
        const result = stopped(await runWith(pool, nonNetworkControls({ PROVIDER_CALL_TIMEOUT_MS: 1 })));
        expect(result.code).toBe("pass1_provider_ambiguous");
        expect(result.provider?.code).toBe("provider_observation_timeout");
        const boundary = trace.events.length; // the SQL log at the moment the call returned (the post-timeout boundary)
        expect(trace.events.some((e) => e.startsWith("mark"))).toBe(false); // the late perform had not settled yet
        await lateSettled; // an explicit witness that the late perform completed
        await sleep(100); // the late value would have been consumed (or not) by now
        expect(trace.events.slice(boundary)).toEqual(["mark late-perform-settled"]); // nothing but the witness: zero SQL after the timeout
        expect(faults.performs).toBe(1);
      },
    );
    await verify(db, AFTER_RESERVATION);
  }, T);

  it("I15 held-by-other reservation at the execute boundary; the orchestrator on the same database refuses at preflight", async () => {
    const db = await fresh();
    staged(await stageWriterPass1Inputs(db.runtime, plan));
    await insertCall(db, { provider_call_id: FOREIGN });
    const seeded = await tableCounts(db.owner);
    await withFaults(undefined, async (faults) => {
      const result = stopped(await executeWriterPass1Call(db.runtime, plan, observer(), nonNetworkControls()));
      expect(result.code).toBe("pass1_provider_unfinished");
      expect(result.provider?.reason).toBe("held_by_other");
      expect(faults.performs).toBe(0);
    });
    await verify(db, {}, seeded);
    // the public orchestrator on the SAME contaminated state (T1 present, foreign reservation held)
    await withFaults(undefined, async (faults) => {
      const refused = stopped(await runWith(db.runtime));
      expect(refused.code).toBe("pass1_unexpected_state");
      expect(refused.writes_attempted).toBe(false);
      expect(faults.performs).toBe(0);
    });
    await verify(db, {}, seeded);
    expect((await tableCounts(db.owner)).provider_calls).toBe((db.baseline.provider_calls ?? 0) + 1);
  }, T);

  it("I16 T1 conflicts at the staging boundary (four databases incl. the precision-loss JSONB witness); the orchestrator refuses the same state", async () => {
    const [w2] = plan.t1;
    if (!w2) throw new Error("no t1 rows");
    const w2Json = JSON.stringify(w2.row.canonical_payload);
    // PostgreSQL jsonb keeps numeric precision: 240 and 240.00000000000000000001 are different values, yet both decode to the JS number 240
    const precise = w2Json.replace('"seconds":240', '"seconds":240.00000000000000000001');
    expect(precise).not.toBe(w2Json);
    expect(JSON.parse(precise)).toEqual(w2.row.canonical_payload); // decoded JavaScript equality cannot tell them apart
    const w2Seed = (db: DbEnv, schema: string, json: string, id = String(w2.row.artifact_id)) =>
      insertArtifactJson(db, id, "writer_view_v2", schema, PASS1_PIN.w_domain_sha256, json);
    const seeds: [string, (db: DbEnv) => Promise<unknown>, string, string][] = [
      [
        "conflicting prompt_manifests row",
        async (db) => {
          await insertArtifact(db, FOREIGN, "prompt_manifest_9", "prompt-manifest/1", "9".repeat(64), { other: true });
          await db.owner.query(
            "INSERT INTO prompt_manifests (prompt_manifest_id, component_versions, rendered_request_hash, policy_source_hashes, artifact_id) VALUES ($1::uuid,$2::jsonb,$3,$4::jsonb,$5::uuid)",
            [plan.ids.prompt_manifest_id, JSON.stringify(plan.manifest.component_versions), "8".repeat(64), JSON.stringify(plan.manifest.policy_source_hashes), FOREIGN],
          );
        },
        "prompt_manifests",
        "same_id_different_content",
      ],
      [
        "same content under a different artifact id",
        (db) => w2Seed(db, "writer-view/2", w2Json, FOREIGN),
        "artifacts",
        "different_id_same_content",
      ],
      ["same id with a different schema_version", (db) => w2Seed(db, "writer-view/1", w2Json), "artifacts", "metadata_mismatch"],
      ["same id, jsonb numerically different by precision only", (db) => w2Seed(db, "writer-view/2", precise), "artifacts", "same_id_different_content"],
    ];
    for (const [label, seed, row, kind] of seeds) {
      const db = await fresh();
      await seed(db);
      const seeded = await tableCounts(db.owner);
      const result = stopped(await stageWriterPass1Inputs(db.runtime, plan));
      expect(result.code, label).toBe("pass1_stage_conflict");
      expect(result.conflict, label).toEqual({ row, kind });
      expect(result.durable.t1, label).toBe("unknown");
      await verify(db, {}, seeded); // the whole transaction rolled back
      await withFaults(undefined, async (faults) => {
        const refused = stopped(await runWith(db.runtime)); // the orchestrator on the same contaminated database
        expect(refused.code, label).toBe("pass1_unexpected_state");
        expect(refused.writes_attempted).toBe(false);
        expect(faults.performs).toBe(0);
      });
      await verify(db, {}, seeded);
      await closeEnv(db);
    }
    // valid control for the witness: the identical row pre-existing is converged and the seam stages the other three rows
    const control = await fresh();
    await w2Seed(control, "writer-view/2", w2Json);
    const base = await tableCounts(control.owner);
    expect(staged(await stageWriterPass1Inputs(control.runtime, plan)).convergence).toBe("created");
    await verify(control, { artifacts: 2, prompt_manifests: 1 }, base);
    recorded(await runWith(control.runtime));
    await closeEnv(control);
  }, T);

  it("I17 a foreign script artifact at T3 (component and interleaving); the orchestrator refuses the same state", async () => {
    const db = await fresh();
    staged(await stageWriterPass1Inputs(db.runtime, plan));
    staged(await executeWriterPass1Call(db.runtime, plan, observer(), nonNetworkControls()));
    await foreignScript(db);
    const seeded = await tableCounts(db.owner);
    const result = stopped(await recordWriterPass1Lineage(db.runtime, plan));
    expect(result.code).toBe("pass1_stage_conflict");
    expect(result.conflict).toEqual({ row: "artifacts", kind: "different_id_same_content" });
    await verify(db, {}, seeded);
    const models = await db.owner.query("SELECT 1 FROM model_runs WHERE provider_call_id = $1", [plan.ids.provider_call_id]);
    expect(models.rowCount).toBe(0);
    const events = await db.owner.query("SELECT 1 FROM provider_call_events WHERE provider_call_id = $1", [plan.ids.provider_call_id]);
    expect(events.rowCount).toBe(1); // the event remains
    // the public orchestrator on the SAME contaminated state (T1, reservation and event present, foreign script artifact)
    await withFaults(undefined, async (faults) => {
      const refused = stopped(await runWith(db.runtime));
      expect(refused.code).toBe("pass1_unexpected_state");
      expect(refused.writes_attempted).toBe(false);
      expect(faults.performs).toBe(0);
    });
    await verify(db, {}, seeded);
    // deterministic interleaving: the foreign row appears AFTER the preflight snapshot closed, so the orchestrator itself reaches T3
    const inter = await fresh();
    await withFaults(
      async (point) => {
        if (point === "writer_pass1_after_preflight") await foreignScript(inter);
      },
      async () => {
        const stop = stopped(await runWith(inter.runtime));
        expect(stop.code).toBe("pass1_stage_conflict");
        expect(stop.stage).toBe("lineage");
        expect(stop.writes_attempted).toBe(true);
        expect(stop.durable).toEqual({ t1: "present", reservation: "present", outcome: "present", lineage: "unknown" });
      },
    );
    await verify(inter, { ...AFTER_EVENT, artifacts: 4 }); // T1, reservation, event and the foreign artifact; no T3 row
    const models2 = await inter.owner.query("SELECT 1 FROM model_runs WHERE provider_call_id = $1", [plan.ids.provider_call_id]);
    expect(models2.rowCount).toBe(0);
  }, T);

  it("I18 the stop boundary: gates not run, stop-boundary tables unchanged, no lifecycle effect", async () => {
    const db = await fresh();
    const done = recorded(await runWith(db.runtime));
    expect(done.gates_not_run).toEqual(GATES_NOT_RUN);
    for (const gate of ["craft_critic", "writer_revision", "claims_writing_gate", "semantic_audit", "render_*", "ready_*"])
      expect(done.gates_not_run).toContain(gate);
    const after = await tableCounts(db.owner);
    for (const table of ["gate_results", "audit_runs", "performance_direction_versions", "performance_intents", "render_manifests", "render_blocks", "render_takes", "take_selections", "audio_artifacts", "reroll_triggers", "claim_state_events", "episodes", "episode_versions", "review_decisions", "repair_requests", "repair_plans", "repair_plan_decisions"])
      expect(after[table]).toBe(db.baseline[table]);
    const states = await db.owner.query<{ state: string }>(
      "SELECT state::text AS state FROM program_run_attempts WHERE attempt_id = $1",
      [INV.attempt_id],
    );
    expect(states.rows[0]?.state).toBe("PENDING");
    await verify(db, ADDED);
  }, T);

  it("I19 unavailable attempts and a lifecycle change between T3 and the final recheck", async () => {
    const db = await fresh();
    const unknown = stopped(await runWith(db.runtime, nonNetworkControls(), { ...INV, attempt_id: randomUUID() }));
    expect(unknown.code).toBe("pass1_attempt_unavailable");
    expect(unknown.writes_attempted).toBe(false);
    expect(unknown.durable).toEqual({ t1: "none_observed", reservation: "none_observed", outcome: "none_observed", lineage: "none_observed" });
    await verify(db, {});
    await transition(db, "PENDING", "EVIDENCE_READY");
    const moved = stopped(await runWith(db.runtime));
    expect(moved.code).toBe("pass1_attempt_unavailable");
    expect(moved.writes_attempted).toBe(false);
    await verify(db, {}, db.baseline, attemptState("PENDING", "EVIDENCE_READY")); // the one declared state delta; every other field and row unchanged
    const second = await fresh();
    await withFaults(
      async (point) => {
        if (point === "writer_pass1_before_final_check") await transition(second, "PENDING", "EVIDENCE_READY");
      },
      async () => {
        const changed = stopped(await runWith(second.runtime));
        expect(changed.code).toBe("pass1_host_changed");
        expect(changed.stage).toBe("final_check");
        expect(changed.durable).toEqual({ t1: "present", reservation: "present", outcome: "present", lineage: "present" });
        expect(changed.writes_attempted).toBe(true);
      },
    );
    await verify(second, ADDED, second.baseline, attemptState("PENDING", "EVIDENCE_READY"));
  }, T);

  it("I20 a completed call of another owner at the execute boundary; the orchestrator refuses the same state", async () => {
    const db = await fresh();
    staged(await stageWriterPass1Inputs(db.runtime, plan));
    await insertCall(db, { provider_call_id: FOREIGN });
    await insertEvent(db, FOREIGN, "writer-pass1-specimen/1:foreign");
    const seeded = await tableCounts(db.owner);
    await withFaults(undefined, async (faults) => {
      const result = stopped(await executeWriterPass1Call(db.runtime, plan, observer(), nonNetworkControls()));
      expect(result.code).toBe("pass1_provider_completed_mismatch");
      expect(result.mismatch_field).toBe("provider_call_id");
      expect(faults.performs).toBe(0);
    });
    await verify(db, {}, seeded);
    const models = await db.owner.query("SELECT 1 FROM model_runs WHERE provider_call_id = $1", [plan.ids.provider_call_id]);
    expect(models.rowCount).toBe(0);
    // the public orchestrator on the SAME contaminated state
    await withFaults(undefined, async (faults) => {
      const refused = stopped(await runWith(db.runtime));
      expect(refused.code).toBe("pass1_unexpected_state");
      expect(refused.writes_attempted).toBe(false);
      expect(faults.performs).toBe(0);
    });
    await verify(db, {}, seeded);
  }, T);

  it("I21 direct T3 binding matrix: a tampered durable field is refused with zero lineage rows", async () => {
    const tampers: [string, Obj, string][] = [
      ["attempt_id", { attempt_id: SECOND_ATTEMPT }, plan.response_reference],
      ["model_identifier", { model_identifier: "fixture_stub/other-model" }, plan.response_reference],
      ["response_reference", {}, `${plan.response_reference}x`],
    ];
    for (const [field, call, reference] of tampers) {
      const db = await fresh();
      staged(await stageWriterPass1Inputs(db.runtime, plan));
      await insertCall(db, { provider_call_id: plan.ids.provider_call_id, ...call });
      await insertEvent(db, plan.ids.provider_call_id, reference);
      const seeded = await tableCounts(db.owner);
      const result = stopped(await recordWriterPass1Lineage(db.runtime, plan));
      expect(result.code, field).toBe("pass1_provider_mismatch");
      expect(result.mismatch_field, field).toBe(field);
      await verify(db, {}, seeded);
      await closeEnv(db);
    }
  }, T);
});
