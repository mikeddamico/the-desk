// Integration tests of the fixed Craft Critic seam against disposable PostgreSQL 17 databases (the existing TestCluster), on the actual
// `desk_runtime` pool. Every case starts from a fresh migrated database with the pinned fixture loaded and the strict Q0 checkpoint passed
// once, then records Pass-1 through the unchanged `runWriterPass1` (except where stated), and records the per-table counts, the 398
// historical rows and the 41 Pass-1 rows at that moment. Every case ends by checking its exact row delta and that those rows are
// unchanged. Component tests (I10, I12, I14, I16) enter the component that owns the boundary with valid prerequisites; what the public
// orchestrator does on the SAME contaminated database is asserted separately. Nothing here is a model or quality result. The uncounted
// `afterAll` teardown asserts independently that every database and login role this file may have created is gone, even when setup
// failed part-way.
import { randomUUID } from "node:crypto";

import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { CRITIC_SPECIMEN } from "../../src/fixture/craft-critic-specimen.js";
import { allTables, families } from "../../src/fixture/families.js";
import { openFixturePack } from "../../src/fixture/pack.js";
import {
  reenterCompletePinnedFixture,
  verifyCompletePinnedFixture,
} from "../../src/fixture/persist.js";
import {
  turnAnchorMap,
  writingCraftReviewHash,
} from "../../src/identity/artifacts.js";
import {
  CRITIC_GATES_NOT_RUN,
  CRITIC_NOT_PROVEN,
  CRITIC_PIN,
  classifyCriticSnapshot,
  executeCriticCall,
  planCraftCritic,
  readCriticSnapshot,
  recordCriticLineage,
  runCraftCritic,
  scanCriticSurfaces,
  stageCriticInputs,
  type CriticPlan,
  type CriticRecorded,
  type CriticStopped,
} from "../../src/runtime/craft-critic.js";
import {
  projectEvent,
  type CommandEvent,
  type ObserverContext,
} from "../../src/runtime/observe.js";
import {
  executeWriterPass1Call,
  runWriterPass1,
  stageWriterPass1Inputs,
  type Pass1Recorded,
  type Pass1Stopped,
} from "../../src/runtime/writer-pass1.js";
import { nonNetworkControls } from "../support/a5-provider.js";
import { TestCluster, type DbEnv } from "../support/db-env.js";

type Obj = Record<string, unknown>;
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
const ATTEMPT = "e5aaee76-ec19-4917-b293-24a0435b3a92";
// the retained Pass-1 authored record (flat, as `runWriterPass1` takes it) and the Critic's nested form of the same three strings
const P1 = {
  started_at: "2026-10-20T00:00:00Z",
  ended_at: "2026-10-20T00:00:01Z",
  created_at: "2026-10-20T00:00:02Z",
};
const INV_P1 = { attempt_id: ATTEMPT, ...P1 };
const INV = {
  attempt_id: ATTEMPT,
  pass1: P1,
  started_at: "2026-10-20T00:00:03Z",
  ended_at: "2026-10-20T00:00:04Z",
  created_at: "2026-10-20T00:00:05Z",
};
// the same instants written with offsets and six fractional digits (I01 runs both seams on this form)
const P1_OFFSET = {
  started_at: "2026-10-20T02:00:00.500000+02:00",
  ended_at: "2026-10-19T19:00:01.250000-05:00",
  created_at: "2026-10-20T00:00:02.000001+00:00",
};
const INV_P1_OFFSET = { attempt_id: ATTEMPT, ...P1_OFFSET };
const INV_OFFSET = {
  attempt_id: ATTEMPT,
  pass1: P1_OFFSET,
  started_at: "2026-10-20T02:00:03.000001+02:00",
  ended_at: "2026-10-19T19:00:04.000002-05:00",
  created_at: "2026-10-20T00:00:05.000003+00:00",
};
const FOREIGN = "00000000-0000-4000-8000-0000000000f1";
const FOREIGN2 = "00000000-0000-4000-8000-0000000000f2";
const HOOK = Symbol.for("the-desk.a5.test-fault-hook");
const T = 300000;
const X = {
  review_hash:
    "b1129448ccdfd8ed799652b8463f16204f40b004bb5f6600279472eeb80df896",
  specimen_sha:
    "a06de7505cf998e0b6cbc7d23758da8efcfdeb131e8414bcfde898af2a06c93b",
  request_hash:
    "b07a9250898ab5e1d88f9df0aabbc7612fd432706b16a5e118fbdb58fc0ad2d8",
  response_reference:
    "craft-critic-specimen/1:a06de7505cf998e0b6cbc7d23758da8efcfdeb131e8414bcfde898af2a06c93b:b1129448ccdfd8ed799652b8463f16204f40b004bb5f6600279472eeb80df896",
  provider_call_id: "21dc5d4b-88cf-4764-8a95-c441f3814b81",
  model_run_id: "c3710b31-4195-434b-889b-9e2802b2b255",
  prompt_manifest_id: "465f08a3-9356-4d53-aac4-969a230b2258",
  prompt_manifest_artifact_id: "f952371d-2fd6-42df-8bf4-a3198c590d6e",
  review_artifact_id: "4e2807fd-97fa-47ff-98ed-760a025c66b8",
};
// the six additive rows of one complete Critic run, and the intermediate durable states
const ADDED_C: Readonly<Record<string, number>> = {
  artifacts: 2,
  prompt_manifests: 1,
  provider_calls: 1,
  provider_call_events: 1,
  model_runs: 1,
};
const AFTER_T1C: Readonly<Record<string, number>> = {
  artifacts: 1,
  prompt_manifests: 1,
};
const AFTER_RESERVATION: Readonly<Record<string, number>> = {
  ...AFTER_T1C,
  provider_calls: 1,
};
const AFTER_EVENT: Readonly<Record<string, number>> = {
  ...AFTER_RESERVATION,
  provider_call_events: 1,
};
// the Pass-1 recovery writes counted separately from the Critic's six rows (I03)
const PASS1_ADDED: Readonly<Record<string, number>> = {
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
const EMPTY_EXTRA = [
  "episodes",
  "episode_versions",
  "review_decisions",
  "repair_requests",
  "repair_plans",
  "repair_plan_decisions",
];
const COUNTED = [...allTables, ...EMPTY_EXTRA];
const UNKNOWN4 = {
  t1: "unknown",
  reservation: "unknown",
  outcome: "unknown",
  lineage: "unknown",
};
const NONE4 = {
  t1: "none_observed",
  reservation: "none_observed",
  outcome: "none_observed",
  lineage: "none_observed",
};
const PRESENT4 = {
  t1: "present",
  reservation: "present",
  outcome: "present",
  lineage: "present",
};

// ---- ownership is recorded BEFORE the first fallible resource creation, so the independent absence check can never be skipped ------------
const cluster = url ? new TestCluster(url) : undefined;
const runId = cluster
  ? (cluster as unknown as { run?: unknown }).run
  : undefined;
const ownedPrefix =
  typeof runId === "string" && /^[0-9a-f]{8}$/.test(runId)
    ? `fl_${runId}_`
    : undefined;
const ownedDatabases = new Set<string>();
const ownedRoles = new Set<string>(
  ownedPrefix === undefined
    ? []
    : [`${ownedPrefix}migrator`, `${ownedPrefix}runtime`],
);
const opened: Env[] = [];
const teardownFailures: unknown[] = [];
let plan: CriticPlan;
let originals: string[];

type Env = DbEnv & {
  /** per-table counts at the start of the case (after Pass-1 unless the case states otherwise) */
  baseline: Record<string, number>;
  /** the 398 historical rows, recorded after Q0 and before any seam call */
  history: Map<string, string>;
  /** the Pass-1 rows present at the case's current boundary, keyed by table and primary key */
  pass1Rows: Map<string, string>;
  /** true only once Pass-1 is complete: the full 41-row invariant then applies (never fabricated for a stranded state) */
  requireFull41: boolean;
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
/** Whichever of the 41 Pass-1 rows (39 planned rows, the call, the event) exist right now, as PostgreSQL renders them. */
const pass1RowsOf = async (pool: pg.Pool): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  const up = plan.upstream;
  for (const planned of [...up.t1, ...up.t3]) {
    const found = await pool.query<{ v: string }>(
      `SELECT to_jsonb(x)::text AS v FROM "${planned.spec.table}" x WHERE ${planned.spec.id} = $1::uuid`,
      [planned.row[planned.spec.id]],
    );
    const row = found.rows[0];
    if (row)
      out.set(
        `${planned.spec.table}|${String(planned.row[planned.spec.id])}`,
        row.v,
      );
  }
  const call = await pool.query<{ v: string }>(
    "SELECT to_jsonb(x)::text AS v FROM provider_calls x WHERE provider_call_id = $1::uuid",
    [up.ids.provider_call_id],
  );
  if (call.rows[0])
    out.set(`provider_calls|${up.ids.provider_call_id}`, call.rows[0].v);
  const events = await pool.query<{ v: string }>(
    "SELECT to_jsonb(x)::text AS v FROM provider_call_events x WHERE provider_call_id = $1::uuid",
    [up.ids.provider_call_id],
  );
  if (events.rows[0])
    out.set(
      `provider_call_events|${up.ids.provider_call_id}`,
      events.rows[0].v,
    );
  return out;
};
interface FreshOptions {
  /** `none`: only Q0 (the stranded and partial Pass-1 states of I03 and the Pass-1 interleaving of I16 start here) */
  pass1?: "complete" | "none";
  pass1Invocation?: Obj;
}
const fresh = async (options: FreshOptions = {}): Promise<Env> => {
  if (!cluster) throw new Error("test database required");
  const created = await cluster.create({ migrate: true });
  ownedDatabases.add(created.name);
  ownedRoles.add(new URL(created.migratorUrl).username);
  ownedRoles.add(new URL(created.runtimeUrl).username);
  const db: Env = Object.assign(created, {
    baseline: {},
    history: new Map<string, string>(),
    pass1Rows: new Map<string, string>(),
    requireFull41: false,
  });
  opened.push(db);
  await reenterCompletePinnedFixture(db.migrator, { DESK_ENV: "test" });
  await verifyCompletePinnedFixture(db.runtime); // Q0: once, before the first seam call
  db.history = await historical(db.owner);
  expect(db.history.size).toBe(398);
  if ((options.pass1 ?? "complete") === "complete") {
    const done = await runWriterPass1(
      db.runtime,
      options.pass1Invocation ?? INV_P1,
      observer(),
      nonNetworkControls(),
    );
    if (done.kind !== "recorded")
      throw new Error(`Pass-1 did not record: ${done.code}`);
    db.pass1Rows = await pass1RowsOf(db.owner);
    expect(db.pass1Rows.size).toBe(41);
    db.requireFull41 = true;
  }
  db.baseline = await tableCounts(db.owner);
  return db;
};
/** Re-records the Pass-1 boundary (rows present now); the full 41-row invariant applies only after Pass-1 completed. */
const markPass1 = async (db: Env, complete: boolean): Promise<void> => {
  db.pass1Rows = await pass1RowsOf(db.owner);
  db.requireFull41 = complete;
  if (complete) expect(db.pass1Rows.size).toBe(41);
};
/** The one historical row a test deliberately changed through the existing transition function: only `field` may differ, to `to`. */
interface HistoricalChange {
  readonly key: string;
  readonly field: string;
  readonly from: string;
  readonly to: string;
}
/**
 * The exact row delta against the baseline, every historical row byte-identical (except the one declared change), and every Pass-1
 * row already present at this boundary byte-identical (all 41 once Pass-1 is complete): the immutability epilogue of every case.
 */
const verify = async (
  db: Env,
  expected: Readonly<Record<string, number>>,
  since: Record<string, number> = db.baseline,
  change?: HistoricalChange,
): Promise<void> => {
  const after = await tableCounts(db.owner);
  for (const table of COUNTED)
    expect(
      (after[table] ?? 0) - (since[table] ?? 0),
      `rows added to ${table}`,
    ).toBe(expected[table] ?? 0);
  const rows = await historical(db.owner);
  for (const [key, value] of db.history) {
    if (key === change?.key) {
      const was = JSON.parse(value) as Obj;
      expect(was[change.field], `${key} before`).toBe(change.from);
      expect(
        JSON.parse(rows.get(key) ?? "null") as unknown,
        `${key} after`,
      ).toEqual({ ...was, [change.field]: change.to });
    } else expect(rows.get(key), key).toBe(value);
  }
  const pass1 = await pass1RowsOf(db.owner);
  for (const [key, value] of db.pass1Rows)
    expect(pass1.get(key), `Pass-1 row ${key}`).toBe(value);
  if (db.requireFull41) expect(db.pass1Rows.size).toBe(41);
};
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
const observer = (): ObserverContext => ({
  correlationId: randomUUID(),
  observer: () => undefined,
});
const runC = (
  pool: pg.Pool,
  controls: unknown = nonNetworkControls(),
  invocation: unknown = INV,
  context: ObserverContext = observer(),
): Promise<CriticRecorded | CriticStopped> =>
  runCraftCritic(pool, invocation, context, controls);
const runP1 = (
  pool: pg.Pool,
  invocation: unknown = INV_P1,
): Promise<Pass1Recorded | Pass1Stopped> =>
  runWriterPass1(pool, invocation, observer(), nonNetworkControls());
interface StageOk {
  readonly kind: "ok";
}
type Outcomes = CriticRecorded | CriticStopped | StageOk;
const recorded = (result: Outcomes | Pass1Recorded | Pass1Stopped) => {
  if (result.kind !== "recorded")
    throw new Error(`expected recorded, got ${result.kind}`);
  return result as CriticRecorded;
};
const stopped = (result: Outcomes): CriticStopped => {
  if (result.kind !== "stopped")
    throw new Error(`expected a stop, got ${result.kind}`);
  return result;
};
const staged = <S extends StageOk>(
  result: S | { readonly kind: "stopped" },
): S => {
  if (result.kind !== "ok") throw new Error(`expected ok, got ${result.kind}`);
  return result;
};
interface Faults {
  performs: number;
  pass1Performs: number;
  points: string[];
}
/**
 * Installs the inert-by-default fault hook for one scope; `performs` counts every call of the Critic's fixed adapter `perform` and
 * `pass1Performs` every call of the Pass-1 adapter's.
 */
const withFaults = async <S>(
  hook: ((point: string, faults: Faults) => unknown) | undefined,
  fn: (faults: Faults) => Promise<S>,
): Promise<S> => {
  const faults: Faults = { performs: 0, pass1Performs: 0, points: [] };
  const previous = Object.getOwnPropertyDescriptor(globalThis, HOOK);
  const flag = process.env.DESK_TEST_FAULTS;
  process.env.DESK_TEST_FAULTS = "1";
  Object.defineProperty(globalThis, HOOK, {
    configurable: true,
    value: async (point: string): Promise<void> => {
      faults.points.push(point);
      if (point === "craft_critic_perform") faults.performs += 1;
      if (point === "writer_pass1_perform") faults.pass1Performs += 1;
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
 * are forwarded to the real ones and recorded in order; `when` selects statements to fail (counted in `injected`); `before` is awaited
 * ahead of a forwarded statement (to commit a competing row at an exact point). Restored on release.
 */
interface Trace {
  readonly events: string[];
  injected: number;
  clients: number;
}
const textOf = (first: unknown): string => {
  const text =
    typeof first === "string"
      ? first
      : (first as { text?: unknown } | undefined)?.text;
  return typeof text === "string" ? text : "";
};
const tracePool = (
  real: pg.Pool,
  when: (text: string) => boolean = () => false,
  before?: (text: string) => Promise<void>,
): { pool: pg.Pool; trace: Trace } => {
  const trace: Trace = { events: [], injected: 0, clients: 0 };
  const run = async (
    label: string,
    forward: () => unknown,
    text: string,
  ): Promise<unknown> => {
    trace.events.push(`${label} ${text}`);
    await before?.(text);
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
      const original = client.query.bind(client) as (
        ...a: unknown[]
      ) => unknown;
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
      run(
        "pool query",
        () => (real.query as (...a: unknown[]) => unknown)(...args),
        textOf(args[0]),
      ),
  } as unknown as pg.Pool;
  return { pool, trace };
};

/**
 * Failure injection for the two snapshots of the Critic only (the clients that open `REPEATABLE READ READ ONLY`): `snapshot` is the
 * 1-based ordinal of that snapshot (1 initial, 2 final); a failed connect is injected on the FIRST connect after `armConnect()`.
 */
interface Chaos {
  snapshot: 1 | 2;
  /** fail the connect of the snapshot (no client is acquired) */
  connect?: boolean;
  /** fail the BEGIN */
  begin?: boolean;
  /** fail the k-th read (0-based) */
  read?: number;
  /** fail the COMMIT */
  commit?: boolean;
  /** make the ROLLBACK itself throw */
  rollbackThrows?: boolean;
  /** make release(true) throw (after really destroying the client) */
  releaseThrows?: boolean;
}
interface ChaosLog {
  snapshots: number;
  /** per snapshot ordinal: the statements the client received and the release arguments */
  statements: Map<number, string[]>;
  releases: Map<number, unknown[]>;
  connectsFailed: number;
}
const chaosPool = (
  real: pg.Pool,
  chaos: Chaos,
): { pool: pg.Pool; log: ChaosLog; armConnect: () => void } => {
  const log: ChaosLog = {
    snapshots: 0,
    statements: new Map(),
    releases: new Map(),
    connectsFailed: 0,
  };
  // the connect of the next snapshot fails once armed (the final snapshot is armed by the fault hook before it starts)
  let armed = chaos.snapshot === 1;
  const pool = {
    connect: async () => {
      if (armed && chaos.connect === true) {
        armed = false;
        log.connectsFailed += 1;
        log.snapshots += 1;
        throw new Error("injected connect failure");
      }
      const client = await real.connect();
      let ordinal = 0;
      let reads = 0;
      const original = client.query.bind(client) as (
        ...a: unknown[]
      ) => Promise<unknown>;
      const release = client.release.bind(client);
      const patched = client as unknown as { query: unknown; release: unknown };
      patched.query = async (...args: unknown[]): Promise<unknown> => {
        const text = textOf(args[0]);
        if (
          text.startsWith("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
        ) {
          log.snapshots += 1;
          ordinal = log.snapshots;
          log.statements.set(ordinal, []);
          log.releases.set(ordinal, []);
        }
        const ours = ordinal === chaos.snapshot;
        if (ordinal > 0) log.statements.get(ordinal)?.push(text);
        if (ours) {
          if (text.startsWith("BEGIN") && chaos.begin === true)
            throw new Error("injected BEGIN failure");
          const isRead = text.startsWith("SELECT");
          if (isRead) {
            reads += 1;
            if (chaos.read !== undefined && reads === chaos.read + 1)
              throw new Error("injected read failure");
          }
          if (text === "COMMIT" && chaos.commit === true)
            throw new Error("injected COMMIT failure");
          if (text === "ROLLBACK" && chaos.rollbackThrows === true) {
            await original(...args);
            throw new Error("injected ROLLBACK failure");
          }
        }
        return original(...args);
      };
      patched.release = (arg?: unknown): void => {
        if (ordinal > 0) log.releases.get(ordinal)?.push(arg);
        delete (client as unknown as { query?: unknown }).query;
        delete (client as unknown as { release?: unknown }).release;
        release(arg as boolean | undefined);
        if (ordinal === chaos.snapshot && chaos.releaseThrows === true)
          throw new Error("injected release failure");
      };
      return client;
    },
    query: (...args: unknown[]): unknown =>
      (real.query as (...a: unknown[]) => unknown)(...args),
  } as unknown as pg.Pool;
  return {
    pool,
    log,
    armConnect: () => {
      armed = true;
    },
  };
};
// ---- direct inserts of foreign / tampered history through the database owner (contamination for the negatives) ---------------------
const insertArtifactJson = (
  db: DbEnv,
  id: string,
  type: string,
  schema: string,
  hash: string,
  json: string,
) =>
  db.owner.query(
    "INSERT INTO artifacts (artifact_id, artifact_type, schema_version, content_hash, canonical_payload) VALUES ($1::uuid,$2,$3,$4,$5::jsonb)",
    [id, type, schema, hash, json],
  );
const insertArtifact = (
  db: DbEnv,
  id: string,
  type: string,
  schema: string,
  hash: string,
  payload: unknown,
) => insertArtifactJson(db, id, type, schema, hash, JSON.stringify(payload));
const insertCall = (db: DbEnv, over: Obj = {}) => {
  const v = { ...plan.reservation, ...over };
  return db.owner.query(
    `INSERT INTO provider_calls (provider_call_id, attempt_id, provider, operation, model_identifier, request_fingerprint, logical_request_key,
       operational_try_number, started_at) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,1,$8::timestamptz)`,
    [
      v.provider_call_id,
      v.attempt_id,
      v.provider,
      v.operation,
      v.model_identifier,
      v.request_fingerprint,
      v.logical_request_key,
      INV.started_at,
    ],
  );
};
const insertEvent = (db: DbEnv, callId: string, reference: string) =>
  db.owner.query(
    `INSERT INTO provider_call_events (provider_call_id, event_type, ended_at, usage, actual_cost, currency, response_reference)
     VALUES ($1::uuid,'succeeded',$2::timestamptz,$3::jsonb,'0.0000','USD',$4)`,
    [
      callId,
      INV.ended_at,
      JSON.stringify({
        external_provider_contacted: false,
        fixture_execution: true,
      }),
      reference,
    ],
  );
/** A foreign provider call on its own logical key (so it does not occupy the Critic's slot). */
const foreignCall = (db: DbEnv, id: string) =>
  insertCall(db, {
    provider_call_id: id,
    logical_request_key: `fixture_stub:craft_critic:${"1".repeat(64)}`,
  });
const payloadOf = async (db: DbEnv, id: string): Promise<Obj> => {
  const found = await db.owner.query<{ canonical_payload: Obj }>(
    "SELECT canonical_payload FROM artifacts WHERE artifact_id = $1::uuid",
    [id],
  );
  return found.rows[0]?.canonical_payload ?? {};
};
const count = async (
  db: DbEnv,
  sql: string,
  params: unknown[] = [],
): Promise<number> =>
  Number((await db.owner.query<{ n: string }>(sql, params)).rows[0]?.n);

suite(
  "craft critic fixed fixture seam (disposable PostgreSQL 17, runtime role)",
  () => {
    beforeAll(async () => {
      const planned = planCraftCritic(INV);
      if (planned.kind !== "planned")
        throw new Error(`plan stopped: ${planned.code}`);
      plan = planned.plan;
      const tables = (openFixturePack().json("foundation_rows_398.json") as Obj)
        .tables as Obj;
      const claims = tables.claims as Obj[];
      const claim = (id: string): Obj =>
        (claims.find((c) => c.claim_id === id)?.value as Obj | undefined) ?? {};
      originals = [
        String(claim("d1250008-0000-4000-8000-000000000003").context),
        String(claim("d1250008-0000-4000-8000-000000000004").interpretation),
      ];
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
          teardownFailures.push(
            new Error(
              "owned name prefix could not be determined: absence cannot be asserted",
            ),
          );
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
            teardownFailures.push(
              new Error(
                `owned databases remain: ${databases.rows.map((r) => r.datname).join(",")}`,
              ),
            );
          if (roles.rows.length > 0)
            teardownFailures.push(
              new Error(
                `owned login roles remain: ${roles.rows.map((r) => r.rolname).join(",")}`,
              ),
            );
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
        throw new AggregateError(
          teardownFailures,
          "owned database/role teardown was not clean",
        );
    }, T);

    it(
      "I01 happy path on the actual runtime role (offset/microsecond form): exact six-row delta, NULL admission columns, exact event, review rehash from the stored subject",
      async () => {
        const db = await fresh({ pass1Invocation: INV_P1_OFFSET });
        // valid control first: the composed upstream invocation (the shared pinned attempt, nested shape, exact authored strings)
        const control = planCraftCritic(INV_OFFSET);
        if (control.kind !== "planned") throw new Error("offset form refused");
        expect(control.plan.upstream.invocation).toEqual({
          attempt_id: ATTEMPT,
          ...P1_OFFSET,
        });
        const who = await db.runtime.query<{ u: string }>(
          "SELECT current_user AS u",
        );
        expect(who.rows[0]?.u).toBe("desk_runtime");
        for (const table of Object.keys(ADDED_C)) {
          const privilege = await db.runtime.query<{
            update: boolean;
            insert: boolean;
          }>(
            `SELECT has_table_privilege(current_user, $1, 'UPDATE') AS update, has_table_privilege(current_user, $1, 'INSERT') AS insert`,
            [table],
          );
          expect(privilege.rows[0], table).toEqual({
            update: false,
            insert: true,
          });
        }
        const { result, faults } = await withFaults(undefined, async (f) => ({
          result: await runC(db.runtime, nonNetworkControls(), INV_OFFSET),
          faults: f,
        }));
        const done = recorded(result);
        expect(done.convergence).toEqual({
          t1c: "created",
          execute: "performed",
          t3c: "created",
        });
        expect(done.durable).toEqual(PRESENT4);
        expect(done.upstream).toEqual({ pass1: "present" });
        expect(done.identities).toEqual({
          specimen_canonical_sha256: X.specimen_sha,
          review_hash: X.review_hash,
          subject_script_hash:
            "b18d1fcee6ccd784933fd5e19b957ae252a5c892deb3d342ca768d61cea94ae9",
          subject_script_version_id: "b0848965-f388-46bd-8615-221a8c4e6af7",
          rendered_request_hash: X.request_hash,
          prompt_manifest_artifact_hash:
            "464ac653d36dccdb83ced3c0ea5a4e384f2201ff7d30c0ce75b90485cfa2239f",
          model_semantic_input_hash:
            "66394ad0c11fd13236bf7efa09c5dc9da02aa13a557a6fe2b75eec06afc90f68",
          response_reference: X.response_reference,
          provider_call_id: X.provider_call_id,
          model_run_id: X.model_run_id,
          prompt_manifest_id: X.prompt_manifest_id,
          prompt_manifest_artifact_id: X.prompt_manifest_artifact_id,
          review_artifact_id: X.review_artifact_id,
        });
        expect(done.gates_not_run).toEqual(CRITIC_GATES_NOT_RUN);
        expect(done.not_proven).toEqual(CRITIC_NOT_PROVEN);
        expect(faults.performs).toBe(1);
        expect(faults.pass1Performs).toBe(0);
        await verify(db, ADDED_C);
        expect(Object.values(ADDED_C).reduce((a, b) => a + b, 0)).toBe(6);
        const call = await db.owner.query(
          `SELECT provider, operation, model_identifier, request_fingerprint, logical_request_key, operational_try_number,
         (started_at = $2::timestamptz) AS started_exact, (started_at = '2026-10-20T00:00:03.000001Z'::timestamptz) AS started_utc,
         num_nonnulls(admitted_at, reserved_cost_upper_bound, admission_currency, admission_policy_hash, admission_certificate, admission_certificate_hash) AS metadata
       FROM provider_calls WHERE provider_call_id = $1`,
          [X.provider_call_id, INV_OFFSET.started_at],
        );
        expect(call.rows[0]).toEqual({
          provider: "fixture_stub",
          operation: "craft_critic",
          model_identifier: CRITIC_PIN.model_identifier,
          request_fingerprint: X.request_hash,
          logical_request_key: CRITIC_PIN.logical_request_key,
          operational_try_number: 1,
          started_exact: true,
          started_utc: true,
          metadata: 0,
        });
        const event = await db.owner.query(
          `SELECT event_type, usage, actual_cost::text AS actual_cost, currency, response_artifact_id, response_reference,
         (ended_at = '2026-10-20T00:00:04.000002Z'::timestamptz) AS ended_exact,
         num_nonnulls(recorded_at, admission_settlement) AS metadata FROM provider_call_events WHERE provider_call_id = $1`,
          [X.provider_call_id],
        );
        expect(event.rows[0]).toEqual({
          event_type: "succeeded",
          usage: {
            external_provider_contacted: false,
            fixture_execution: true,
          },
          actual_cost: "0.0000",
          currency: "USD",
          response_artifact_id: null,
          response_reference: X.response_reference,
          ended_exact: true,
          metadata: 0,
        });
        // the stored review rehashes to the pinned value using the STORED subject turns
        const review = await payloadOf(db, X.review_artifact_id);
        expect(review.created_at).toBe(INV_OFFSET.created_at); // the authored text is stored as authored
        expect(Object.keys(review).sort()).toEqual([
          "craft_policy_version",
          "created_at",
          "critic_contract_version",
          "critic_model_run_id",
          "findings",
          "outcome",
          "review_hash",
          "subject_script_hash",
          "subject_script_version_id",
          "writing_craft_review_id",
        ]);
        const subject = await payloadOf(
          db,
          plan.upstream.ids.script_artifact_id,
        );
        expect(
          writingCraftReviewHash(
            {
              subject_script_hash: review.subject_script_hash,
              craft_policy_version: review.craft_policy_version,
              critic_contract_version: review.critic_contract_version,
              findings: review.findings,
              outcome: review.outcome,
            },
            turnAnchorMap(subject.turns),
          ),
        ).toBe(X.review_hash);
        const run = await db.owner.query(
          `SELECT model_identifier, semantic_input_hash, output_artifact_id::text AS output, prompt_manifest_id::text AS manifest
           FROM model_runs WHERE model_run_id = $1`,
          [X.model_run_id],
        );
        expect(run.rows[0]).toEqual({
          model_identifier: CRITIC_PIN.model_identifier,
          semantic_input_hash:
            "66394ad0c11fd13236bf7efa09c5dc9da02aa13a557a6fe2b75eec06afc90f68",
          output: X.review_artifact_id,
          manifest: X.prompt_manifest_id,
        });
        const states = await db.owner.query(
          `SELECT a.state::text AS attempt, r.state::text AS run FROM program_run_attempts a JOIN program_runs r USING (program_run_id) WHERE a.attempt_id = $1`,
          [ATTEMPT],
        );
        expect(states.rows[0]).toEqual({ attempt: "PENDING", run: "PENDING" });
      },
      T,
    );

    it(
      "I02 explicit identical re-entry after completion: converged/completed/converged, zero deltas, perform counter stays 1",
      async () => {
        const db = await fresh();
        await withFaults(undefined, async (faults) => {
          recorded(await runC(db.runtime));
          const mid = await tableCounts(db.owner);
          const again = recorded(await runC(db.runtime));
          expect(again.convergence).toEqual({
            t1c: "converged",
            execute: "completed",
            t3c: "converged",
          });
          await verify(db, {}, mid);
          expect(faults.performs).toBe(1);
        });
        await verify(db, ADDED_C);
      },
      T,
    );

    it(
      "I03 Pass-1 states on fresh databases: P0, P1, P3 are incomplete and recoverable by ordinary Pass-1 re-entry; P2 is stranded",
      async () => {
        const setups: [
          string,
          (db: Env) => Promise<void>,
          Record<string, string>,
        ][] = [
          [
            "P0 (nothing written)",
            () => Promise.resolve(),
            { t1: "created", execute: "performed", t3: "created" },
          ],
          [
            "P1 (T1 committed)",
            async (db) => {
              staged(await stageWriterPass1Inputs(db.runtime, plan.upstream));
            },
            { t1: "converged", execute: "performed", t3: "created" },
          ],
          [
            "P3 (outcome committed, T3 missing)",
            async (db) => {
              staged(await stageWriterPass1Inputs(db.runtime, plan.upstream));
              staged(
                await executeWriterPass1Call(
                  db.runtime,
                  plan.upstream,
                  observer(),
                  nonNetworkControls(),
                ),
              );
            },
            { t1: "converged", execute: "completed", t3: "created" },
          ],
        ];
        for (const [label, setup, convergence] of setups) {
          const db = await fresh({ pass1: "none" });
          await setup(db);
          await markPass1(db, false); // the rows present at this boundary are preserved; the 41-row invariant does not yet apply
          const seeded = await tableCounts(db.owner);
          await withFaults(undefined, async (faults) => {
            const stop = stopped(await runC(db.runtime));
            expect(stop, label).toEqual({
              kind: "stopped",
              stage: "preconditions",
              code: "critic_upstream_incomplete",
              writes_attempted: false,
              upstream: { pass1: "unknown" },
              durable: NONE4,
              cleanup: { attached_errors: 0, complete: true },
            });
            expect(faults.performs, label).toBe(0);
          });
          await verify(db, {}, seeded);
          // ordinary Pass-1 re-entry completes (its recovery writes are counted separately) ...
          const completed = await runP1(db.runtime);
          if (completed.kind !== "recorded")
            throw new Error(`${label}: ${completed.code}`);
          expect(completed.convergence, label).toEqual(convergence);
          await verify(db, PASS1_ADDED); // the rows that existed at the partial boundary are still byte-identical (old map retained)
          await markPass1(db, true); // ... and only now the complete 41-row invariant applies
          // ... and the Critic then succeeds
          const afterPass1 = await tableCounts(db.owner);
          const done = recorded(await runC(db.runtime));
          expect(done.convergence, label).toEqual({
            t1c: "created",
            execute: "performed",
            t3c: "created",
          });
          await verify(db, ADDED_C, afterPass1);
          await closeEnv(db);
        }
        // P2: the Pass-1 reservation is committed and there is no outcome (never resumed, the missing 41 rows are never fabricated)
        const stranded = await fresh({ pass1: "none" });
        await withFaults(
          (point) => {
            if (point === "after_reservation_commit")
              throw new Error(
                "injected lost return after the Pass-1 reservation",
              );
          },
          async () => {
            const first = await runP1(stranded.runtime);
            expect(first.kind).toBe("stopped");
          },
        );
        await markPass1(stranded, false);
        expect(stranded.pass1Rows.size).toBe(5); // T1 four and the reservation; no outcome and no T3 row
        const seeded = await tableCounts(stranded.owner);
        await withFaults(undefined, async (faults) => {
          const stop = stopped(await runC(stranded.runtime));
          expect(stop.code).toBe("critic_upstream_incomplete");
          expect(stop.writes_attempted).toBe(false);
          expect(stop.durable).toEqual(NONE4);
          expect(faults.performs).toBe(0);
          const again = await runP1(stranded.runtime);
          if (again.kind !== "stopped")
            throw new Error("expected a Pass-1 stop");
          expect(again.code).toBe("pass1_provider_unfinished");
          expect(faults.pass1Performs).toBe(0); // no extra perform
        });
        await verify(stranded, {}, seeded); // zero new rows
        expect(stranded.requireFull41).toBe(false);
      },
      T,
    );

    it(
      "I04 the hazard pin on fresh databases: after any critic row ordinary Pass-1 re-entry is refused with zero writes, and the critic's own re-entry behaves per state",
      async () => {
        const states: [
          string,
          (db: Env) => Promise<void>,
          (db: Env, faults: Faults) => Promise<void>,
        ][] = [
          [
            "C1",
            async (db) => {
              staged(await stageCriticInputs(db.runtime, plan));
            },
            async (db) => {
              const done = recorded(await runC(db.runtime));
              expect(done.convergence).toEqual({
                t1c: "converged",
                execute: "performed",
                t3c: "created",
              });
              await verify(db, ADDED_C);
            },
          ],
          [
            "C2",
            async (db) => {
              await withFaults(
                (point) => {
                  if (point === "after_reservation_commit")
                    throw new Error(
                      "injected lost return after the reservation",
                    );
                },
                async () => {
                  stopped(await runC(db.runtime));
                },
              );
            },
            async (db, faults) => {
              const again = stopped(await runC(db.runtime));
              expect(again.code).toBe("critic_provider_unfinished");
              expect(again.provider?.reason).toBe("converged_without_outcome");
              expect(again.durable).toEqual({
                t1: "present",
                reservation: "present",
                outcome: "none_observed",
                lineage: "none_observed",
              });
              expect(faults.performs).toBe(0); // no extra perform
              await verify(db, AFTER_RESERVATION);
            },
          ],
          [
            "C3",
            async (db) => {
              await withFaults(
                (point) => {
                  if (point === "after_outcome_commit")
                    throw new Error("injected lost return after the outcome");
                },
                async () => {
                  stopped(await runC(db.runtime));
                },
              );
            },
            async (db) => {
              const done = recorded(await runC(db.runtime));
              expect(done.convergence).toEqual({
                t1c: "converged",
                execute: "completed",
                t3c: "created",
              });
              await verify(db, ADDED_C);
            },
          ],
          [
            "C4",
            async (db) => {
              recorded(await runC(db.runtime));
            },
            async (db) => {
              const done = recorded(await runC(db.runtime));
              expect(done.convergence).toEqual({
                t1c: "converged",
                execute: "completed",
                t3c: "converged",
              });
              await verify(db, ADDED_C);
            },
          ],
        ];
        for (const [label, setup, reenter] of states) {
          const db = await fresh();
          await setup(db);
          const seeded = await tableCounts(db.owner);
          await withFaults(undefined, async (faults) => {
            const refused = await runP1(db.runtime);
            if (refused.kind !== "stopped")
              throw new Error(`${label}: Pass-1 was not refused`);
            expect(refused.code, label).toBe("pass1_unexpected_state");
            expect(refused.writes_attempted, label).toBe(false);
            expect(faults.pass1Performs, label).toBe(0);
          });
          await verify(db, {}, seeded);
          await withFaults(undefined, async (faults) => {
            await reenter(db, faults);
          });
          await closeEnv(db);
        }
      },
      T,
    );

    it(
      "I05 T1c committed with the return lost: identical re-entry converges",
      async () => {
        const db = await fresh();
        await withFaults(
          (point, faults) => {
            if (
              point === "after_commit_before_return" &&
              faults.points.filter((p) => p === point).length === 1
            )
              throw new Error("injected lost return after T1c");
          },
          async () => {
            await expect(runC(db.runtime)).rejects.toThrow(
              "injected lost return after T1c",
            );
          },
        );
        await verify(db, AFTER_T1C);
        const done = recorded(await runC(db.runtime));
        expect(done.convergence.t1c).toBe("converged");
        await verify(db, ADDED_C);
      },
      T,
    );

    it(
      "I06 perform throws: ambiguous, no event, no model run; later entry stops; the perform count stays 1",
      async () => {
        const db = await fresh();
        await withFaults(
          (point) => {
            if (point === "craft_critic_perform")
              throw new Error("injected perform failure");
          },
          async (faults) => {
            const result = stopped(await runC(db.runtime));
            expect(result.code).toBe("critic_provider_ambiguous");
            expect(result.provider).toEqual({
              status: "ambiguous",
              code: "provider_perform_ambiguous",
            });
            expect(result.durable).toEqual({
              t1: "present",
              reservation: "present",
              outcome: "unknown",
              lineage: "none_observed",
            });
            expect(faults.performs).toBe(1);
          },
        );
        await verify(db, AFTER_RESERVATION);
        await withFaults(undefined, async (faults) => {
          const again = stopped(await runC(db.runtime));
          expect(again.code).toBe("critic_provider_unfinished");
          expect(faults.performs).toBe(0); // the counter across both entries stays 1
        });
        await verify(db, AFTER_RESERVATION);
      },
      T,
    );

    it(
      "I07 a reservation without an outcome (reached through the orchestrator): re-entry is unfinished, no takeover",
      async () => {
        const db = await fresh();
        await withFaults(
          (point) => {
            if (point === "after_reservation_commit")
              throw new Error("injected lost return after the reservation");
          },
          async (faults) => {
            const first = stopped(await runC(db.runtime));
            expect(first.code).toBe("critic_provider_error");
            expect(first.provider_error?.reservation_commit_state).toBe(
              "committed",
            );
            expect(first.durable).toEqual({
              t1: "present",
              reservation: "present",
              outcome: "unknown",
              lineage: "none_observed",
            });
            expect(first.writes_attempted).toBe(true);
            expect(first.cleanup).toEqual({
              attached_errors: null,
              complete: false,
            });
            expect(first.upstream).toEqual({ pass1: "present" });
            expect(faults.performs).toBe(0);
          },
        );
        await verify(db, AFTER_RESERVATION);
        await withFaults(undefined, async (faults) => {
          const again = stopped(await runC(db.runtime));
          expect(again.code).toBe("critic_provider_unfinished");
          expect(again.provider?.reason).toBe("converged_without_outcome");
          expect(again.durable).toEqual({
            t1: "present",
            reservation: "present",
            outcome: "none_observed",
            lineage: "none_observed",
          });
          expect(faults.performs).toBe(0);
        });
        await verify(db, AFTER_RESERVATION);
      },
      T,
    );

    it(
      "I08 an outcome without lineage: re-entry gets the exact completed result and completes T3c; no second perform",
      async () => {
        const db = await fresh();
        await withFaults(
          (point) => {
            if (point === "after_outcome_commit")
              throw new Error("injected lost return after the outcome");
          },
          async () => {
            const first = stopped(await runC(db.runtime));
            expect(first.code).toBe("critic_provider_error");
            expect(first.provider_error?.stage).toBe("record");
            expect(first.durable).toEqual({
              t1: "present",
              reservation: "present",
              outcome: "present",
              lineage: "none_observed",
            });
          },
        );
        await verify(db, AFTER_EVENT);
        await withFaults(undefined, async (faults) => {
          const done = recorded(await runC(db.runtime));
          expect(done.convergence).toEqual({
            t1c: "converged",
            execute: "completed",
            t3c: "created",
          });
          expect(faults.performs).toBe(0);
        });
        await verify(db, ADDED_C);
      },
      T,
    );

    it(
      "I09 T3c failed before commit (rows absent, re-entry completes) and T3c committed with the return lost (zero deltas)",
      async () => {
        const db = await fresh();
        const { pool, trace } = tracePool(db.runtime, (text) =>
          text.includes("INSERT INTO model_runs"),
        );
        await expect(runC(pool)).rejects.toThrow("injected statement failure");
        expect(trace.injected).toBe(1); // reached exactly once
        // the post-execute provider fetch went through the forwarded pool.query BEFORE the injection
        const fetched = trace.events.findIndex(
          (e) =>
            e.startsWith("pool query") && e.includes("FROM provider_calls"),
        );
        const injected = trace.events.findIndex((e) =>
          e.includes("INSERT INTO model_runs"),
        );
        expect(fetched).toBeGreaterThanOrEqual(0);
        expect(fetched).toBeLessThan(injected);
        await verify(db, AFTER_EVENT); // the review artifact insert was rolled back with the command
        const done = recorded(await runC(db.runtime));
        expect(done.convergence).toEqual({
          t1c: "converged",
          execute: "completed",
          t3c: "created",
        });
        await verify(db, ADDED_C);
        // the second subcase: the T3c COMMIT is acknowledged, the return is lost
        const second = await fresh();
        await withFaults(
          async (point) => {
            if (point !== "after_commit_before_return") return;
            const n = await count(
              second,
              "SELECT count(*) AS n FROM model_runs",
            );
            if (n === (second.baseline.model_runs ?? 0) + 1)
              throw new Error("injected lost return after T3c");
          },
          async () => {
            await expect(runC(second.runtime)).rejects.toThrow(
              "injected lost return after T3c",
            );
          },
        );
        await verify(second, ADDED_C);
        await withFaults(undefined, async (faults) => {
          const again = recorded(await runC(second.runtime));
          expect(again.convergence).toEqual({
            t1c: "converged",
            execute: "completed",
            t3c: "converged",
          });
          expect(faults.performs).toBe(0);
        });
        await verify(second, ADDED_C);
      },
      T,
    );

    it(
      "I10 component-level conflicts with valid prerequisites: same id different content and same content different id for the manifest artifact, the typed row, the review artifact and the model run",
      async () => {
        const manifestArtifact = (db: DbEnv, id: string, payload: unknown) =>
          insertArtifact(
            db,
            id,
            "prompt_manifest_3",
            "prompt-manifest/1",
            plan.manifest_hash,
            payload,
          );
        const typedRow = (db: DbEnv, id: string, requestHash: string) =>
          db.owner.query(
            "INSERT INTO prompt_manifests (prompt_manifest_id, component_versions, rendered_request_hash, policy_source_hashes, artifact_id) VALUES ($1::uuid,$2::jsonb,$3,$4::jsonb,$5::uuid)",
            [
              id,
              JSON.stringify(plan.manifest.component_versions),
              requestHash,
              JSON.stringify(plan.manifest.policy_source_hashes),
              X.prompt_manifest_artifact_id,
            ],
          );
        const reviewArtifact = (db: DbEnv, id: string, payload: unknown) =>
          insertArtifact(
            db,
            id,
            "writing_craft_review",
            "craft-critic-review/1",
            X.review_hash,
            payload,
          );
        const modelRun = (db: DbEnv, id: string, semantic: string) =>
          db.owner.query(
            `INSERT INTO model_runs (model_run_id, attempt_id, provider_call_id, prompt_manifest_id, model_identifier, semantic_input_hash, output_artifact_id)
             VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7::uuid)`,
            [
              id,
              ATTEMPT,
              X.provider_call_id,
              X.prompt_manifest_id,
              CRITIC_PIN.model_identifier,
              semantic,
              plan.upstream.ids.script_artifact_id,
            ],
          );
        interface Case {
          label: string;
          seed: (db: DbEnv) => Promise<unknown>;
          stage: "t1c" | "t3c";
          row: string;
          kind: string;
        }
        const cases: Case[] = [
          {
            label: "manifest artifact: same id, different content",
            seed: (db) =>
              manifestArtifact(db, X.prompt_manifest_artifact_id, {
                other: true,
              }),
            stage: "t1c",
            row: "artifacts",
            kind: "same_id_different_content",
          },
          {
            label: "manifest artifact: same content, different id",
            seed: (db) => manifestArtifact(db, FOREIGN, plan.manifest),
            stage: "t1c",
            row: "artifacts",
            kind: "different_id_same_content",
          },
          {
            label: "typed prompt row: same id, different content",
            seed: async (db) => {
              await manifestArtifact(
                db,
                X.prompt_manifest_artifact_id,
                plan.manifest,
              );
              await typedRow(db, X.prompt_manifest_id, "8".repeat(64));
            },
            stage: "t1c",
            row: "prompt_manifests",
            kind: "same_id_different_content",
          },
          {
            label: "typed prompt row: same content, different id",
            seed: async (db) => {
              await manifestArtifact(
                db,
                X.prompt_manifest_artifact_id,
                plan.manifest,
              );
              await typedRow(db, FOREIGN, X.request_hash);
            },
            stage: "t1c",
            row: "prompt_manifests",
            kind: "different_id_same_content",
          },
          {
            label: "review artifact: same id, different content",
            seed: (db) =>
              reviewArtifact(db, X.review_artifact_id, { other: true }),
            stage: "t3c",
            row: "artifacts",
            kind: "same_id_different_content",
          },
          {
            label: "review artifact: same content, different id",
            seed: (db) => reviewArtifact(db, FOREIGN, plan.review_payload),
            stage: "t3c",
            row: "artifacts",
            kind: "different_id_same_content",
          },
          {
            label: "model run: same id, different content",
            seed: (db) => modelRun(db, X.model_run_id, "7".repeat(64)),
            stage: "t3c",
            row: "model_runs",
            kind: "same_id_different_content",
          },
          {
            label: "model run: same content, different id (natural key)",
            seed: (db) => modelRun(db, FOREIGN, plan.semantic_input_hash),
            stage: "t3c",
            row: "model_runs",
            kind: "different_id_same_content",
          },
        ];
        for (const c of cases) {
          const db = await fresh();
          if (c.stage === "t3c") {
            staged(await stageCriticInputs(db.runtime, plan));
            staged(
              await executeCriticCall(
                db.runtime,
                plan,
                observer(),
                nonNetworkControls(),
              ),
            );
          }
          await c.seed(db);
          const seeded = await tableCounts(db.owner);
          const result = stopped(
            c.stage === "t1c"
              ? await stageCriticInputs(db.runtime, plan)
              : await recordCriticLineage(db.runtime, plan),
          );
          expect(result.code, c.label).toBe("critic_stage_conflict");
          expect(result.conflict, c.label).toEqual({
            row: c.row,
            kind: c.kind,
          });
          expect(result.stage, c.label).toBe(
            c.stage === "t1c" ? "stage_inputs" : "lineage",
          );
          expect(
            c.stage === "t1c" ? result.durable.t1 : result.durable.lineage,
          ).toBe("unknown");
          await verify(db, {}, seeded); // the whole transaction rolled back; nothing adopted
          await closeEnv(db);
        }
      },
      T,
    );

    it(
      "I11 a foreign additive row in each of artifacts, provider_calls, provider_call_events, model_runs, turns and prompt_manifests: the orchestrator refuses with zero writes",
      async () => {
        const seeds: [string, (db: DbEnv) => Promise<unknown>][] = [
          [
            "artifacts",
            (db) =>
              insertArtifact(
                db,
                FOREIGN,
                "prompt_manifest_9",
                "prompt-manifest/1",
                "9".repeat(64),
                { other: true },
              ),
          ],
          ["provider_calls", (db) => foreignCall(db, FOREIGN)],
          [
            "provider_call_events",
            async (db) => {
              await foreignCall(db, FOREIGN);
              await insertEvent(db, FOREIGN, "craft-critic-specimen/1:foreign");
            },
          ],
          [
            "model_runs",
            async (db) => {
              await foreignCall(db, FOREIGN);
              await db.owner.query(
                `INSERT INTO model_runs (model_run_id, attempt_id, provider_call_id, prompt_manifest_id, model_identifier, semantic_input_hash, output_artifact_id)
                 VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7::uuid)`,
                [
                  FOREIGN2,
                  ATTEMPT,
                  FOREIGN,
                  plan.upstream.ids.prompt_manifest_id,
                  "fixture_stub/other",
                  "0".repeat(64),
                  plan.upstream.ids.script_artifact_id,
                ],
              );
            },
          ],
          [
            "turns",
            async (db) => {
              const turn = plan.upstream.t3.find(
                (p) => p.spec.table === "turns",
              );
              await db.owner.query(
                `INSERT INTO turns (turn_id, script_version_id, program_block_id, sequence, participant_id, spoken_text)
                 VALUES ($1::uuid,$2::uuid,$3::uuid,18,'gaz','x')`,
                [
                  FOREIGN,
                  plan.upstream.ids.script_version_id,
                  turn?.row.program_block_id,
                ],
              );
            },
          ],
          [
            "prompt_manifests",
            async (db) => {
              await insertArtifact(
                db,
                FOREIGN,
                "prompt_manifest_9",
                "prompt-manifest/1",
                "9".repeat(64),
                { other: true },
              );
              await db.owner.query(
                "INSERT INTO prompt_manifests (prompt_manifest_id, component_versions, rendered_request_hash, policy_source_hashes, artifact_id) VALUES ($1::uuid,'{}'::jsonb,$2,'{}'::jsonb,$3::uuid)",
                [FOREIGN2, "0".repeat(64), FOREIGN],
              );
            },
          ],
        ];
        for (const [table, seed] of seeds) {
          const db = await fresh();
          await seed(db);
          const seeded = await tableCounts(db.owner);
          expect(seeded[table], table).toBeGreaterThan(db.baseline[table] ?? 0);
          await withFaults(undefined, async (faults) => {
            const refused = stopped(await runC(db.runtime));
            expect(refused.code, table).toBe("critic_unexpected_state");
            expect(refused.writes_attempted, table).toBe(false);
            expect(refused.durable, table).toEqual(UNKNOWN4);
            expect(refused.upstream, table).toEqual({ pass1: "present" }); // U1-U6 were verified in this snapshot
            expect(faults.performs, table).toBe(0);
          });
          await verify(db, {}, seeded);
          await closeEnv(db);
        }
      },
      T,
    );

    it(
      "I12 three independent reachable subcases, each with its own positive control: execute-conflict, verifier/T3c mismatch, contaminated-state refusal",
      async () => {
        // (a) execute-conflict
        const controlA = await fresh();
        await withFaults(undefined, async (faults) => {
          staged(await stageCriticInputs(controlA.runtime, plan));
          staged(
            await executeCriticCall(
              controlA.runtime,
              plan,
              observer(),
              nonNetworkControls(),
            ),
          );
          expect(faults.performs).toBe(1);
        });
        await verify(controlA, AFTER_EVENT);
        await closeEnv(controlA);
        const dbA = await fresh();
        await insertCall(dbA, { model_identifier: "fixture_stub/other-model" });
        const seededA = await tableCounts(dbA.owner);
        await withFaults(undefined, async (faults) => {
          const result = stopped(
            await executeCriticCall(
              dbA.runtime,
              plan,
              observer(),
              nonNetworkControls(),
            ),
          );
          expect(result.code).toBe("critic_provider_conflict");
          expect(result.provider?.status).toBe("conflict");
          expect(result.mismatch_field).toBeUndefined(); // the later verifier is not reached
          expect(faults.performs).toBe(0);
        });
        await verify(dbA, {}, seededA);
        await closeEnv(dbA);

        // (b) a pre-created call + event with the exact reservation but one differing event field
        const controlB = await fresh();
        staged(await stageCriticInputs(controlB.runtime, plan));
        await insertCall(controlB);
        await insertEvent(controlB, X.provider_call_id, X.response_reference);
        await withFaults(undefined, async (faults) => {
          staged(
            await executeCriticCall(
              controlB.runtime,
              plan,
              observer(),
              nonNetworkControls(),
            ),
          ); // exact: completed
          staged(await recordCriticLineage(controlB.runtime, plan));
          expect(faults.performs).toBe(0);
        });
        await verify(controlB, ADDED_C);
        await closeEnv(controlB);
        const dbB = await fresh();
        staged(await stageCriticInputs(dbB.runtime, plan));
        await insertCall(dbB);
        await insertEvent(dbB, X.provider_call_id, `${X.response_reference}x`);
        const seededB = await tableCounts(dbB.owner);
        await withFaults(undefined, async (faults) => {
          const executed = stopped(
            await executeCriticCall(
              dbB.runtime,
              plan,
              observer(),
              nonNetworkControls(),
            ),
          );
          expect(executed.code).toBe("critic_provider_mismatch");
          expect(executed.mismatch_field).toBe("response_reference");
          const lineage = stopped(await recordCriticLineage(dbB.runtime, plan));
          expect(lineage.code).toBe("critic_provider_mismatch");
          expect(lineage.mismatch_field).toBe("response_reference");
          expect(lineage.stage).toBe("lineage");
          expect(faults.performs).toBe(0);
        });
        await verify(dbB, {}, seededB); // zero lineage rows
        // (c) the orchestrator on that same contaminated database
        await withFaults(undefined, async (faults) => {
          const refused = stopped(await runC(dbB.runtime));
          expect(refused.code).toBe("critic_unexpected_state");
          expect(refused.writes_attempted).toBe(false);
          expect(faults.performs).toBe(0);
        });
        await verify(dbB, {}, seededB);
      },
      T,
    );

    it(
      "I13 a wrong retained Pass-1 record is an upstream mismatch; a different Critic record on re-entry is an unexpected state; zero writes",
      async () => {
        const db = await fresh();
        const wrongPass1 = {
          ...INV,
          pass1: { ...P1, created_at: "2026-10-20T00:00:09Z" },
        };
        const stop = stopped(
          await runC(db.runtime, nonNetworkControls(), wrongPass1),
        );
        expect(stop.code).toBe("critic_upstream_mismatch");
        expect(stop.writes_attempted).toBe(false);
        expect(stop.durable).toEqual(UNKNOWN4);
        expect(stop.upstream).toEqual({ pass1: "unknown" });
        await verify(db, {});
        recorded(await runC(db.runtime)); // the correct record succeeds
        const afterRun = await tableCounts(db.owner);
        const other = stopped(
          await runC(db.runtime, nonNetworkControls(), {
            ...INV,
            started_at: "2026-10-20T00:00:03.500000Z",
          }),
        );
        expect(other.code).toBe("critic_unexpected_state");
        expect(other.writes_attempted).toBe(false);
        expect(other.upstream).toEqual({ pass1: "present" });
        await verify(db, {}, afterRun);
        await verify(db, ADDED_C);
      },
      T,
    );

    it(
      "I14 failed writes: a database error inside T1c and inside T3c after the first insert rolls back; a named unique-violation race re-reads and compares",
      async () => {
        // T1c: the second insert fails, the first is rolled back with the command
        const db = await fresh();
        const first = tracePool(db.runtime, (text) =>
          text.includes("INSERT INTO prompt_manifests"),
        );
        await expect(stageCriticInputs(first.pool, plan)).rejects.toThrow(
          "injected statement failure",
        );
        expect(first.trace.injected).toBe(1);
        await verify(db, {});
        staged(await stageCriticInputs(db.runtime, plan));
        await verify(db, AFTER_T1C);
        // T3c: the model run insert (the second) fails after the review artifact insert
        staged(
          await executeCriticCall(
            db.runtime,
            plan,
            observer(),
            nonNetworkControls(),
          ),
        );
        const seeded = await tableCounts(db.owner);
        const second = tracePool(db.runtime, (text) =>
          text.includes("INSERT INTO model_runs"),
        );
        await expect(recordCriticLineage(second.pool, plan)).rejects.toThrow(
          "injected statement failure",
        );
        expect(second.trace.injected).toBe(1);
        await verify(db, {}, seeded);
        staged(await recordCriticLineage(db.runtime, plan));
        await verify(db, ADDED_C);
        // a named unique-violation race: an identical writer commits the same artifact between the probe and the insert
        const raced = await fresh();
        let competed = false;
        const identical = tracePool(
          raced.runtime,
          () => false,
          async (text) => {
            if (!competed && text.startsWith("INSERT INTO artifacts")) {
              competed = true;
              await insertArtifact(
                raced,
                X.prompt_manifest_artifact_id,
                "prompt_manifest_3",
                "prompt-manifest/1",
                plan.manifest_hash,
                plan.manifest,
              );
            }
          },
        );
        const converged = staged(await stageCriticInputs(identical.pool, plan));
        expect(competed).toBe(true);
        expect(converged.kind).toBe("ok");
        await verify(raced, AFTER_T1C);
        // the competing writer committed DIFFERENT content under the same id: the re-read compares and reports the conflict
        const conflicting = await fresh();
        let competedAgain = false;
        const different = tracePool(
          conflicting.runtime,
          () => false,
          async (text) => {
            if (!competedAgain && text.startsWith("INSERT INTO artifacts")) {
              competedAgain = true;
              await insertArtifact(
                conflicting,
                X.prompt_manifest_artifact_id,
                "prompt_manifest_3",
                "prompt-manifest/1",
                plan.manifest_hash,
                { other: true },
              );
            }
          },
        );
        const seededRace = await count(
          conflicting,
          "SELECT count(*) AS n FROM artifacts",
        );
        const loser = stopped(await stageCriticInputs(different.pool, plan));
        expect(loser.code).toBe("critic_stage_conflict");
        expect(loser.conflict).toEqual({
          row: "artifacts",
          kind: "same_id_different_content",
        });
        expect(
          await count(conflicting, "SELECT count(*) AS n FROM artifacts"),
        ).toBe(seededRace + 1); // only the competitor's committed row was added
        expect(competedAgain).toBe(true);
        await verify(conflicting, { artifacts: 1 }); // the full epilogue: exactly the competitor's row, history and Pass-1 rows untouched
      },
      T,
    );

    it(
      "I15 two simultaneous runCraftCritic callers: exactly one authorized perform and one immutable row set; the unfinished branch behind an explicit barrier",
      async () => {
        const db = await fresh();
        await withFaults(undefined, async (faults) => {
          const results = await Promise.all([
            runC(db.runtime),
            runC(db.runtime),
          ]);
          for (const r of results)
            expect(
              r.kind === "recorded" || r.code === "critic_provider_unfinished",
            ).toBe(true);
          expect(results.some((r) => r.kind === "recorded")).toBe(true);
          expect(faults.performs).toBe(1);
          await verify(db, ADDED_C);
          const mid = await tableCounts(db.owner);
          const again = recorded(await runC(db.runtime)); // explicit identical re-entry
          expect(again.convergence.execute).toBe("completed");
          await verify(db, {}, mid);
        });
        // the unfinished branch, deterministically: the winner is held inside `perform` until the loser has returned
        const barrier = await fresh();
        let release: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        let entered: () => void = () => undefined;
        const inside = new Promise<void>((resolve) => {
          entered = resolve;
        });
        await withFaults(
          async (point) => {
            if (point === "craft_critic_perform") {
              entered();
              await gate;
            }
          },
          async (faults) => {
            const winner = runC(barrier.runtime);
            try {
              // race the barrier against the owned winner so a winner that settles first cannot hang the case; an early rejection propagates as itself
              const reached = await Promise.race([
                inside.then(() => "inside" as const),
                winner.then(() => "settled" as const),
              ]);
              if (reached !== "inside")
                throw new Error("the winner settled before reaching perform");
              // the winner's reservation is committed and it is inside `perform`
              const loser = stopped(await runC(barrier.runtime));
              expect(loser.code).toBe("critic_provider_unfinished");
              expect(loser.provider?.reason).toBe("converged_without_outcome");
              expect(loser.durable).toEqual({
                t1: "present",
                reservation: "present",
                outcome: "none_observed",
                lineage: "none_observed",
              });
              release();
              const done = recorded(await winner);
              expect(done.convergence.execute).toBe("performed");
              expect(faults.performs).toBe(1);
            } finally {
              // on every exit the barrier is released and the owned winner settled before the hook is restored; the original
              // failure (if any) is what propagates
              release();
              await winner.then(
                () => undefined,
                () => undefined,
              );
            }
          },
        );
        await verify(barrier, ADDED_C);
        const barrierMid = await tableCounts(barrier.owner);
        const again = recorded(await runC(barrier.runtime));
        expect(again.convergence).toEqual({
          t1c: "converged",
          execute: "completed",
          t3c: "converged",
        });
        await verify(barrier, {}, barrierMid); // the full epilogue after the final explicit re-entry
      },
      T,
    );

    it(
      "I16 stage and snapshot witnesses: simultaneous components converge; the Pass-1 final-recheck interleaving; snapshot isolation; ordering of the snapshots around the writing commands",
      async () => {
        // two simultaneous T1c components, then two simultaneous T3c recoverers: one row set, one created and one converged
        const db = await fresh();
        const stage = await Promise.all([
          stageCriticInputs(db.runtime, plan),
          stageCriticInputs(db.runtime, plan),
        ]);
        expect(
          stage
            .map((r) => staged<Extract<typeof r, StageOk>>(r).convergence)
            .sort(),
        ).toEqual(["converged", "created"]);
        await verify(db, AFTER_T1C);
        staged(
          await executeCriticCall(
            db.runtime,
            plan,
            observer(),
            nonNetworkControls(),
          ),
        );
        const lineage = await Promise.all([
          recordCriticLineage(db.runtime, plan),
          recordCriticLineage(db.runtime, plan),
        ]);
        expect(
          lineage
            .map((r) => staged<Extract<typeof r, StageOk>>(r).convergence)
            .sort(),
        ).toEqual(["converged", "created"]);
        await verify(db, ADDED_C);

        // the Pass-1 final-recheck interleaving: the Critic runs between a Pass-1 caller's T3 commit and its final recheck
        const pass1 = await fresh({ pass1: "none" });
        let interleaved = false;
        let complete41: Map<string, string> | undefined;
        await withFaults(
          async (point) => {
            if (point === "writer_pass1_before_final_check" && !interleaved) {
              interleaved = true;
              // the completed 41-row map is captured immediately BEFORE the Critic runs, then compared afterward
              complete41 = await pass1RowsOf(pass1.owner);
              expect(complete41.size).toBe(41);
              recorded(await runC(pass1.runtime));
            }
          },
          async () => {
            const stop = await runP1(pass1.runtime);
            if (stop.kind !== "stopped")
              throw new Error("expected a Pass-1 stop");
            expect(stop.code).toBe("pass1_unexpected_state");
            expect(stop.stage).toBe("final_check");
            expect(stop.writes_attempted).toBe(true);
            expect(stop.durable).toEqual(PRESENT4);
          },
        );
        if (complete41 === undefined)
          throw new Error("the 41-row map was not captured");
        pass1.pass1Rows = complete41;
        pass1.requireFull41 = true;
        await verify(pass1, {
          ...PASS1_ADDED,
          artifacts: 6,
          prompt_manifests: 2,
          provider_calls: 2,
          provider_call_events: 2,
          model_runs: 2,
        });

        // snapshot isolation: a competing commit after the first read is invisible to the held snapshot and visible to a fresh one
        const held = await fresh();
        await withFaults(
          async (point, faults) => {
            if (
              point === "craft_critic_preflight_after_first_read" &&
              faults.points.filter((p) => p === point).length === 1
            )
              staged(await stageCriticInputs(held.runtime, plan));
          },
          async () => {
            const during = await readCriticSnapshot(held.runtime, plan);
            if (!during.ok) throw new Error("snapshot failed");
            const seen = classifyCriticSnapshot(during.raw, plan, "preflight");
            expect(seen.kind === "state" ? seen.state : seen.row.code).toBe(0);
            const later = await readCriticSnapshot(held.runtime, plan);
            if (!later.ok) throw new Error("snapshot failed");
            const now = classifyCriticSnapshot(later.raw, plan, "preflight");
            expect(now.kind === "state" ? now.state : now.row.code).toBe(1);
          },
        );
        await verify(held, AFTER_T1C);

        // the full seam over an instrumented pool: the preflight snapshot is committed and released BEFORE the first writing command,
        // and the final recheck is a separate fresh snapshot after the last write; the competing T1c commits mid-snapshot
        const traced = await fresh();
        const { pool, trace } = tracePool(traced.runtime);
        let raced = false;
        await withFaults(
          async (point) => {
            if (point === "craft_critic_preflight_after_first_read" && !raced) {
              raced = true;
              staged(await stageCriticInputs(traced.runtime, plan)); // the untraced pool: not part of the ordering under test
            }
          },
          async () => {
            const done = recorded(await runC(pool));
            expect(done.convergence.t1c).toBe("converged");
          },
        );
        const at = (needle: string, from = 0): number => {
          const i = trace.events.findIndex(
            (e, n) => n >= from && e.includes(needle),
          );
          expect(i, needle).toBeGreaterThanOrEqual(0);
          return i;
        };
        const begin1 = at("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const commit1 = at("query COMMIT", begin1);
        const release1 = at("release", commit1);
        // the first traced writing command is located independently of the release position
        const writeBegin = at("BEGIN ISOLATION LEVEL READ COMMITTED");
        const lock = at(
          "SELECT pg_advisory_xact_lock($1::int, hashtext($2::text))",
        );
        const firstWrite = at("INSERT INTO", lock);
        expect(begin1).toBeLessThan(commit1);
        expect(commit1).toBeLessThan(release1);
        expect(release1).toBeLessThan(writeBegin); // closure before entry into the writing command
        expect(writeBegin).toBeLessThan(lock);
        expect(lock).toBeLessThan(firstWrite);
        const lastWrite = trace.events
          .map((e, n) => (e.includes("INSERT INTO") ? n : -1))
          .reduce((m, n) => Math.max(m, n), -1);
        const begin2 = at(
          "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
          release1 + 1,
        );
        expect(begin2).toBeGreaterThan(lastWrite); // the final recheck is a fresh snapshot after the last write
        expect(
          trace.events.filter((e) => e.includes("REPEATABLE READ READ ONLY")),
        ).toHaveLength(2);
        await verify(traced, ADDED_C);

        // N12: after a successful T3c the host changes before the final recheck (a control run records first)
        const control = await fresh();
        recorded(await runC(control.runtime));
        await verify(control, ADDED_C);
        const moved = await fresh();
        let transitioned = false;
        await withFaults(
          async (point) => {
            if (point === "craft_critic_before_final_check" && !transitioned) {
              transitioned = true;
              await moved.runtime.query(
                "SELECT transition_attempt($1,'PENDING','EVIDENCE_READY')",
                [ATTEMPT],
              );
            }
          },
          async (faults) => {
            expect(await runC(moved.runtime)).toEqual({
              kind: "stopped",
              stage: "final_check",
              code: "critic_host_changed",
              writes_attempted: true,
              upstream: { pass1: "present" },
              durable: PRESENT4,
              cleanup: { attached_errors: 0, complete: true },
            });
            expect(faults.performs).toBe(1);
          },
        );
        expect(transitioned).toBe(true);
        // the six critic rows are committed and immutable; the only historical change is the declared host transition
        const hostChange: HistoricalChange = {
          key: `program_run_attempts|${ATTEMPT}`,
          field: "state",
          from: "PENDING",
          to: "EVIDENCE_READY",
        };
        await verify(moved, ADDED_C, moved.baseline, hostChange);
        const beforeReentry = await tableCounts(moved.owner);
        const reenter = stopped(await runC(moved.runtime)); // the host is no longer the pinned PENDING host: nothing more is written
        expect(reenter.code).toBe("critic_attempt_unavailable");
        expect(reenter.writes_attempted).toBe(false);
        await verify(moved, {}, beforeReentry, hostChange);
      },
      T,
    );

    it(
      "I17 snapshot failures with ownership-based cleanup at the initial and the final snapshot: complete independent expected objects, release-only witnesses, no retry",
      async () => {
        const initial = (attached: number) => ({
          kind: "stopped",
          stage: "preconditions",
          code: "critic_preflight_failed",
          writes_attempted: false,
          upstream: { pass1: "unknown" },
          durable: UNKNOWN4,
          cleanup: { attached_errors: attached, complete: true },
        });
        const final = (attached: number) => ({
          kind: "stopped",
          stage: "final_check",
          code: "critic_preflight_failed",
          writes_attempted: true,
          upstream: { pass1: "present" },
          durable: PRESENT4,
          cleanup: { attached_errors: attached, complete: true },
        });
        const variants: [string, Omit<Chaos, "snapshot">, number][] = [
          ["connect", { connect: true }, 0],
          ["BEGIN", { begin: true }, 0],
          ["a read", { read: 4 }, 0],
          ["COMMIT", { commit: true }, 0],
          [
            "a read, then ROLLBACK throws",
            { read: 4, rollbackThrows: true },
            1,
          ],
          [
            "release only, after a successful COMMIT",
            { releaseThrows: true },
            1,
          ],
          [
            "a read, ROLLBACK throws and release throws",
            { read: 4, rollbackThrows: true, releaseThrows: true },
            2,
          ],
        ];
        for (const [label, chaos, attached] of variants) {
          // ---- the initial snapshot: nothing known, no writes, no perform ----
          const db = await fresh();
          const initialRun = chaosPool(db.runtime, { snapshot: 1, ...chaos });
          await withFaults(undefined, async (faults) => {
            expect(await runC(initialRun.pool), `initial ${label}`).toEqual(
              initial(attached),
            );
            expect(faults.performs).toBe(0);
          });
          await verify(db, {});
          const log = initialRun.log;
          if (chaos.connect === true) {
            expect(log.connectsFailed).toBe(1);
            expect(log.statements.get(1)).toBeUndefined(); // nothing acquired: no ROLLBACK, no release
            expect(log.releases.get(1)).toBeUndefined();
          } else {
            const statements = log.statements.get(1) ?? [];
            const rollbacks = statements.filter((s) => s === "ROLLBACK").length;
            expect(log.releases.get(1), label).toEqual([true]); // exactly one attempted destructive release
            if (chaos.releaseThrows === true && chaos.read === undefined)
              expect(rollbacks, `${label} (release-only)`).toBe(0);
            else expect(rollbacks, label).toBe(1);
            expect(statements.filter((s) => s === "COMMIT")).toHaveLength(
              chaos.commit === true ||
                (chaos.releaseThrows === true && chaos.read === undefined)
                ? 1
                : 0,
            );
          }
          if (label === "connect") {
            const again = recorded(await runC(db.runtime)); // identical re-entry: nothing was written
            expect(again.convergence.t1c).toBe("created");
            await verify(db, ADDED_C);
          }
          await closeEnv(db);

          // ---- the final snapshot: every fact kept, writes attempted, never recorded ----
          const last = await fresh();
          const finalRun = chaosPool(last.runtime, { snapshot: 2, ...chaos });
          await withFaults(
            (point) => {
              if (point === "craft_critic_before_final_check")
                finalRun.armConnect();
            },
            async (faults) => {
              expect(await runC(finalRun.pool), `final ${label}`).toEqual(
                final(attached),
              );
              expect(faults.performs).toBe(1);
            },
          );
          await verify(last, ADDED_C);
          if (chaos.connect !== true)
            expect(finalRun.log.releases.get(2), `final ${label}`).toEqual([
              true,
            ]);
          const re = recorded(await runC(last.runtime)); // identical re-entry: zero deltas
          expect(re.convergence).toEqual({
            t1c: "converged",
            execute: "completed",
            t3c: "converged",
          });
          await verify(last, ADDED_C);
          await closeEnv(last);
        }
      },
      T,
    );

    it(
      "I18 scope: no audit, gate, script, turn or use row; model_runs +1; attempt and run stay PENDING; the gates not run and the limits are reported",
      async () => {
        const db = await fresh();
        const done = recorded(await runC(db.runtime));
        expect(done.gates_not_run).toEqual(CRITIC_GATES_NOT_RUN);
        for (const gate of [
          "writer_revision",
          "speech_texture",
          "claims_writing_gate",
          "semantic_audit",
          "render_*",
          "ready_*",
        ])
          expect(done.gates_not_run).toContain(gate);
        for (const limit of [
          "independent_semantic_judgment",
          "craft_detection_reliability",
          "human_preference",
          "writing_section_28",
          "g1_b_certification",
          "scripted",
          "ready",
        ])
          expect(done.not_proven).toContain(limit);
        const after = await tableCounts(db.owner);
        for (const table of [
          "audit_runs",
          "gate_results",
          "script_versions",
          "turns",
          "turn_claim_uses",
          "turn_evidence_uses",
          "performance_direction_versions",
          "performance_intents",
          "render_manifests",
          "render_blocks",
          "render_takes",
          "take_selections",
          "audio_artifacts",
          "reroll_triggers",
          "claim_state_events",
          ...EMPTY_EXTRA,
        ])
          expect(after[table], table).toBe(db.baseline[table]);
        expect((after.model_runs ?? 0) - (db.baseline.model_runs ?? 0)).toBe(1);
        const states = await db.owner.query<{ attempt: string; run: string }>(
          `SELECT a.state::text AS attempt, r.state::text AS run FROM program_run_attempts a JOIN program_runs r USING (program_run_id) WHERE a.attempt_id = $1`,
          [ATTEMPT],
        );
        expect(states.rows[0]).toEqual({ attempt: "PENDING", run: "PENDING" });
        await verify(db, ADDED_C);
      },
      T,
    );

    it(
      "I19 exposure: the critic scanner over every new row and payload is clean; no C2, evidence, claim value, prompt_manifest_2 or Pass-1 provider id leaks; seeded positives are detected",
      async () => {
        const db = await fresh();
        recorded(await runC(db.runtime));
        const manifest = await payloadOf(db, X.prompt_manifest_artifact_id);
        const review = await payloadOf(db, X.review_artifact_id);
        const surfaces = {
          specimen: CRITIC_SPECIMEN,
          request: plan.request_text,
          manifest,
          review_payload: review,
        };
        expect(scanCriticSurfaces(surfaces, originals)).toBeNull();
        // every new row, as stored, scanned as a manifest-like surface
        const rows: Obj[] = [];
        for (const [table, key, id] of [
          ["provider_calls", "provider_call_id", X.provider_call_id],
          ["provider_call_events", "provider_call_id", X.provider_call_id],
          ["model_runs", "model_run_id", X.model_run_id],
          ["prompt_manifests", "prompt_manifest_id", X.prompt_manifest_id],
          ["artifacts", "artifact_id", X.prompt_manifest_artifact_id],
          ["artifacts", "artifact_id", X.review_artifact_id],
        ] as const) {
          const found = await db.owner.query<{ v: Obj }>(
            `SELECT to_jsonb(x) AS v FROM "${table}" x WHERE ${key} = $1::uuid`,
            [id],
          );
          expect(found.rows, `${table} ${id}`).toHaveLength(1);
          rows.push(found.rows[0]?.v ?? {});
        }
        expect(rows).toHaveLength(6);
        for (const row of rows)
          expect(scanCriticSurfaces({ manifest: row }, originals)).toBeNull();
        // what must be absent from the request, the manifest and the review payload
        const text = JSON.stringify({
          request: plan.request_text,
          manifest,
          review,
        });
        const absent = [
          "730e7ef5-22bf-4bd1-8f34-532ed7fc47af", // the C2 writer-context-manifest artifact id
          "a8e36084-403b-4d60-8468-2ceb7a133f5b", // the Pass-1 prompt_manifest_2 artifact id
          "0fdc9bff-feff-4df6-b860-342c8586c19b", // the Pass-1 provider call id
          "2f3381df-640c-43d1-9f8f-85946e9bf833", // the Pass-1 model run id
          ...plan.upstream.evidence.map((e) => e.evidence_unit_id),
          ...originals.map((o) => o.slice(0, 24)),
        ];
        for (const needle of absent)
          expect(text.includes(needle), needle).toBe(false);
        // the three referenced artifacts are present, in order, and nothing else
        expect(
          (manifest.ordered_input_artifacts as Obj[]).map((r) => r.artifact_id),
        ).toEqual([
          plan.upstream.ids.script_artifact_id,
          "595870e7-1b3c-4abc-a794-fc864e0c95b2",
          "5a290685-a66e-444b-94aa-ce8843b295fe",
        ]);
        expect(manifest.ordered_input_evidence).toEqual([]);
        expect(manifest.ordered_input_claims).toEqual([]);
        // the event usage flags
        const event = await db.owner.query<{ usage: Obj }>(
          "SELECT usage FROM provider_call_events WHERE provider_call_id = $1",
          [X.provider_call_id],
        );
        expect(event.rows[0]?.usage).toEqual({
          external_provider_contacted: false,
          fixture_execution: true,
        });
        // seeded positives are detected on each surface (the same text, with a withheld run added)
        const seed = originals[0]?.slice(0, 24) ?? "";
        expect(
          scanCriticSurfaces(
            { ...surfaces, request: `${plan.request_text} ${seed}` },
            originals,
          ),
        ).toBe("request");
        expect(
          scanCriticSurfaces(
            { ...surfaces, manifest: { ...manifest, note: seed } },
            originals,
          ),
        ).toBe("manifest");
        expect(
          scanCriticSurfaces(
            { ...surfaces, review_payload: { ...review, note: seed } },
            originals,
          ),
        ).toBe("review_payload");
        await verify(db, ADDED_C);
      },
      T,
    );

    it(
      "I20 observer: the pure catalog projection is separate from actual provider observation; no new emission is introduced",
      async () => {
        // ---- the pure projection controls: an independently authored, valid RawEvent with operation craft_critic ----
        const correlation = "33333333-3333-4333-8333-333333333333";
        const raw = (code: string): Obj => ({
          event: "command.completed",
          command: "provider_call.reserve",
          stage: "reserve",
          correlation_id: correlation,
          duration_ms: 3,
          outcome: "rejected",
          provider: "fixture_stub",
          operation: "craft_critic",
          code,
          durability: "not_committed",
        });
        const catalog = [
          "critic_command_connection",
          "critic_preflight_failed",
          "critic_prerequisite_missing",
          "critic_provider_error",
          "critic_provider_mismatch",
          "critic_reconcile_failed",
          "critic_stage_conflict",
        ];
        for (const code of catalog) {
          const event = projectEvent(raw(code));
          expect(event.code, code).toBe(code);
          expect(event.code_known, code).toBe(true);
          expect(event.operation, code).toBe("craft_critic");
          expect(event.operation_known, code).toBe(true);
        }
        const adversarial = projectEvent(
          raw("critic_not_in_the_catalog SELECT 1"),
        );
        expect(adversarial.code).toBeUndefined();
        expect(adversarial.code_known).toBe(false);
        expect(JSON.stringify(adversarial)).not.toContain(
          "critic_not_in_the_catalog",
        );
        expect(adversarial.operation).toBe("craft_critic"); // the rest of the control is retained

        // ---- actual provider observation through the direct component, with a reachable provider failure ----
        const db = await fresh();
        staged(await stageCriticInputs(db.runtime, plan));
        const events: CommandEvent[] = [];
        const context: ObserverContext = {
          correlationId: randomUUID(),
          observer: (event) => {
            events.push(event);
          },
        };
        await withFaults(
          (point) => {
            if (point === "after_reservation_commit")
              throw new Error("injected lost return after the reservation");
          },
          async (faults) => {
            const result = stopped(
              await executeCriticCall(
                db.runtime,
                plan,
                context,
                nonNetworkControls(),
              ),
            );
            // the wrapper's returned stop, separate from the provider's own events
            expect(result.code).toBe("critic_provider_error");
            expect(result.provider_error).toMatchObject({
              stage: "reserve",
              commit_state: "committed",
              reservation_commit_state: "committed",
              error_class: "unclassified",
            });
            expect(result.cleanup).toEqual({
              attached_errors: null,
              complete: false,
            });
            expect(faults.performs).toBe(0);
          },
        );
        // the unchanged provider boundary's actual events: whatever it emitted names this operation and only catalog members
        // F7: the two actual events, asserted independently of the returned stop and of the pure catalog controls (duration varies)
        const commands = events.filter((e) => e.event === "command.completed");
        const workflows = events.filter(
          (e) => e.event === "workflow.completed",
        );
        expect(commands).toHaveLength(1);
        expect(commands[0]).toMatchObject({
          event: "command.completed",
          command: "provider_call.reserve",
          stage: "reserve",
          outcome: "created",
          durability: "committed",
          operation: "craft_critic",
          operation_known: true,
        });
        expect(workflows).toHaveLength(1);
        expect(workflows[0]).toMatchObject({
          event: "workflow.completed",
          workflow: "provider_call.execute",
          stage: "provider_execute",
          outcome: "error",
          code: "provider_execution_failed",
          code_known: true,
          reservation: "created",
          perform: "not_attempted",
          outcome_record: "not_attempted",
        });
        expect(workflows[0]?.operation).toBeUndefined(); // the workflow event does not carry the operation
        const command = commands[0];
        const workflow = workflows[0];
        if (command === undefined || workflow === undefined)
          throw new Error("missing expected provider events");
        expect(events.indexOf(command)).toBeLessThan(events.indexOf(workflow));
        expect(
          events.some((e) => e.command === "provider_outcome.record"),
        ).toBe(false); // no outcome-record command
        for (const event of events) {
          if (event.operation !== undefined) {
            expect(event.operation).toBe("craft_critic");
            expect(event.operation_known).toBe(true);
          }
          if (event.code !== undefined) expect(event.code_known).toBe(true);
          expect(event.correlation_id).toBe(context.correlationId);
        }
        expect(
          events.some(
            (e) =>
              e.command === "provider_call.reserve" && e.outcome === "created",
          ),
        ).toBe(true);
        await verify(db, AFTER_RESERVATION);
        // a direct T1c conflict is a return-value witness only (I10); stages and preflights without an observer path emit nothing:
        // the orchestrator's contaminated-state refusal runs no command and emits no event
        const contaminated = await fresh();
        await foreignCall(contaminated, FOREIGN);
        const seeded = await tableCounts(contaminated.owner);
        const quiet: CommandEvent[] = [];
        const refused = stopped(
          await runC(contaminated.runtime, nonNetworkControls(), INV, {
            correlationId: randomUUID(),
            observer: (event) => {
              quiet.push(event);
            },
          }),
        );
        expect(refused.code).toBe("critic_unexpected_state");
        expect(quiet).toEqual([]);
        await verify(contaminated, {}, seeded);
      },
      T,
    );

    it(
      "I21 immutability epilogue, asserted explicitly: the 398 historical rows, the 41 Pass-1 rows and the historical critic review lineage are byte-equal after success, re-entry and a refusal",
      async () => {
        const db = await fresh();
        const historicalReview = await db.owner.query<{ artifact_id: string }>(
          "SELECT artifact_id::text AS artifact_id FROM artifacts WHERE artifact_type = 'writing_craft_review'",
        );
        expect(historicalReview.rows).toHaveLength(1);
        const reviewId = historicalReview.rows[0]?.artifact_id ?? "";
        expect(reviewId.startsWith("08c7d71a")).toBe(true);
        const lineage = await db.owner.query<{ run: string; manifest: string }>(
          "SELECT model_run_id::text AS run, prompt_manifest_id::text AS manifest FROM model_runs WHERE output_artifact_id = $1::uuid",
          [reviewId],
        );
        expect(lineage.rows).toHaveLength(1);
        const keys = [
          `artifacts|${reviewId}`,
          `model_runs|${lineage.rows[0]?.run ?? ""}`,
          `prompt_manifests|${lineage.rows[0]?.manifest ?? ""}`,
        ];
        for (const key of keys) expect(db.history.has(key), key).toBe(true);
        expect(db.history.size).toBe(398); // the historical control: the 398 rows recorded after Q0
        const before = await historical(db.owner);
        expect(before.size).toBe(439); // every current row of the fixture families: 398 historical + the 41 Pass-1 rows
        expect(db.pass1Rows.size).toBe(41);
        recorded(await runC(db.runtime));
        recorded(await runC(db.runtime)); // identical re-entry
        const refused = stopped(
          await runC(db.runtime, nonNetworkControls(), {
            ...INV,
            attempt_id: randomUUID(),
          }),
        );
        expect(refused.code).toBe("critic_attempt_unavailable");
        expect(refused.writes_attempted).toBe(false);
        const after = await historical(db.owner);
        expect(after.size).toBe(445); // plus exactly the Critic's six rows
        for (const [key, value] of before)
          expect(after.get(key), key).toBe(value);
        for (const key of keys)
          expect(after.get(key), key).toBe(db.history.get(key));
        const pass1 = await pass1RowsOf(db.owner);
        expect(pass1.size).toBe(41);
        for (const [key, value] of db.pass1Rows)
          expect(pass1.get(key), key).toBe(value);
        await verify(db, ADDED_C);
      },
      T,
    );
  },
);
