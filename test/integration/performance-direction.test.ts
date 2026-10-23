// Integration tests of the Performance Direction seam, Scope A (refusal only) against ONE disposable PostgreSQL 17 database (the existing TestCluster)
// on the actual `desk_runtime` pool. The cases form one monotone scenario in a fixed order on a single database: migrate, pinned fixture, the strict Q0
// checkpoint, then Pass 1, Critic and Revision through the unchanged runners (PI01 at texture T0); the texture to T4 through the exported components
// (PI02); the unchanged Claims/Writing gate recorded as setup (PI03, the required witness: the current chain is recorded 16 pass / 2 fail, so the
// Performance answer is a refusal); two further reader calls (PI04) and the historical Performance rows (PI05). Every refusal is read-only: the exact
// driver-call count of the reader is asserted (148), no table count changes, the 398 historical rows and every layer row stay byte-identical, and the
// attempt and run stay PENDING. Expected values are authored from the design record (never read from the implementation). Nothing here is a model or
// quality result, a positive admission, a write, a re-entry or convergence (door D is deferred). The uncounted `afterAll` teardown asserts independently
// that every database and login role this file may have created is gone, even when setup failed part-way.
import { randomUUID } from "node:crypto";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { allTables, families } from "../../src/fixture/families.js";
import { openFixturePack } from "../../src/fixture/pack.js";
import {
  reenterCompletePinnedFixture,
  verifyCompletePinnedFixture,
} from "../../src/fixture/persist.js";
import {
  planClaimsWritingGate,
  runClaimsWritingGate,
  type GatePlan,
} from "../../src/runtime/claims-writing-gate.js";
import { runCraftCritic } from "../../src/runtime/craft-critic.js";
import { runCraftRevision } from "../../src/runtime/craft-revision.js";
import type { ObserverContext } from "../../src/runtime/observe.js";
import {
  planPerformanceDirection,
  refusePerformanceDirection,
  type PerformancePlan,
} from "../../src/runtime/performance-direction.js";
import {
  executeTextureCall,
  planSpeechTexture,
  recordTextureLineage,
  stageTextureInputs,
  type TexturePlan,
} from "../../src/runtime/speech-texture.js";
import {
  runWriterPass1,
  type PlannedRow,
} from "../../src/runtime/writer-pass1.js";
import { nonNetworkControls } from "../support/a5-provider.js";
import { TestCluster, type DbEnv } from "../support/db-env.js";

type Obj = Record<string, unknown>;
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
const T = 300000;
const ATTEMPT = "e5aaee76-ec19-4917-b293-24a0435b3a92";
const CREATED_AT = "2026-10-21T12:00:10Z";
const P1 = {
  started_at: "2026-10-21T11:59:58Z",
  ended_at: "2026-10-21T11:59:59Z",
  created_at: "2026-10-21T12:00:00Z",
};
const C_REC = {
  started_at: "2026-10-21T12:00:01Z",
  ended_at: "2026-10-21T12:00:02Z",
  created_at: "2026-10-21T12:00:03Z",
};
const R_REC = {
  started_at: "2026-10-21T12:00:04Z",
  ended_at: "2026-10-21T12:00:05Z",
  created_at: "2026-10-21T12:00:06Z",
};
const INV_P1 = { attempt_id: ATTEMPT, ...P1 };
const INV_C = { attempt_id: ATTEMPT, pass1: P1, ...C_REC };
const INV_R = { attempt_id: ATTEMPT, pass1: P1, critic: C_REC, ...R_REC };
const INV = {
  attempt_id: ATTEMPT,
  pass1: P1,
  critic: C_REC,
  revision: R_REC,
  started_at: "2026-10-21T12:00:07Z",
  ended_at: "2026-10-21T12:00:08Z",
  created_at: "2026-10-21T12:00:09Z",
};
const GATE_INV = { texture: INV, created_at: CREATED_AT };
const EMPTY_EXTRA = [
  "episodes",
  "episode_versions",
  "review_decisions",
  "repair_requests",
  "repair_plans",
  "repair_plan_decisions",
];
const COUNTED = [...allTables, ...EMPTY_EXTRA];
const CLEAN0 = { attached_errors: 0, complete: true };
/** The reader's normal path: BEGIN, 145 static SELECTs, the one native expected-row SELECT, COMMIT. */
const READER_CALLS = 148;
/** The existing gate's create path (361 driver calls) used here only as setup. */
const GATE_CREATE_CALLS = 361;
const PERFORMANCE_DEFINITIONS = [19, 20, 21, 22, 23, 24, 25].map(
  (n) => `d1250019-0000-4000-8000-0000000000${String(n)}`,
);

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
const teardownFailures: unknown[] = [];
let TPLAN: TexturePlan;
let GPLAN: GatePlan;
let PPLAN: PerformancePlan;
let PACK: ReturnType<typeof openFixturePack>;
type Env = DbEnv & {
  baseline: Record<string, number>;
  /** The 398 pre-upstream historical identities (key and database-rendered value), captured once before Pass 1. */
  history: Map<string, string>;
  layers: Map<string, string>;
  /** The 18 current Claims/Writing gate_results rows (id to complete database-rendered JSON), captured at PI03 and preserved afterwards. */
  gates: Map<string, string>;
};
const opened: Env[] = [];
const LEDGER = { runs: 0, databases: 0, queries: 0 };

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
const rowsOfLayer = async (
  pool: pg.Pool,
  planned: readonly PlannedRow[],
  callId: string,
): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  for (const p of planned) {
    const found = await pool.query<{ v: string }>(
      `SELECT to_jsonb(x)::text AS v FROM "${p.spec.table}" x WHERE ${p.spec.id} = $1::uuid`,
      [p.row[p.spec.id]],
    );
    const row = found.rows[0];
    if (row) out.set(`${p.spec.table}|${String(p.row[p.spec.id])}`, row.v);
  }
  for (const [table, key] of [
    ["provider_calls", "provider_call_id"],
    ["provider_call_events", "provider_call_id"],
  ] as const) {
    const found = await pool.query<{ v: string }>(
      `SELECT to_jsonb(x)::text AS v FROM ${table} x WHERE ${key} = $1::uuid`,
      [callId],
    );
    if (found.rows[0]) out.set(`${table}|${callId}`, found.rows[0].v);
  }
  return out;
};
/** Whichever Pass-1, Critic, Revision and texture rows (calls and events included) exist right now. */
const layerRows = async (pool: pg.Pool): Promise<Map<string, string>> => {
  const upstream = TPLAN.revision.critic.upstream;
  const out = new Map<string, string>();
  const layers: [readonly PlannedRow[], string][] = [
    [[...upstream.t1, ...upstream.t3], upstream.ids.provider_call_id],
    [
      [...TPLAN.revision.critic.t1, ...TPLAN.revision.critic.t3],
      TPLAN.revision.critic.ids.provider_call_id,
    ],
    [
      [...TPLAN.revision.t1, ...TPLAN.revision.t3],
      TPLAN.revision.ids.provider_call_id,
    ],
    [[...TPLAN.t1, ...TPLAN.t3], TPLAN.ids.provider_call_id],
  ];
  for (const [planned, callId] of layers)
    for (const [key, value] of await rowsOfLayer(pool, planned, callId))
      out.set(key, value);
  return out;
};
const observer = (): ObserverContext => ({
  correlationId: randomUUID(),
  observer: () => undefined,
});
const must = (result: { readonly kind: string }, what: string): void => {
  if (result.kind !== "ok" && result.kind !== "recorded")
    throw new Error(`${what} did not complete: ${result.kind}`);
};
/** A fresh migrated database with the pinned fixture loaded, Q0 passed once, and Pass 1, Critic and Revision recorded. */
const fresh = async (): Promise<Env> => {
  if (!cluster) throw new Error("test database required");
  const created = await cluster.create({ migrate: true });
  ownedDatabases.add(created.name);
  ownedRoles.add(new URL(created.migratorUrl).username);
  ownedRoles.add(new URL(created.runtimeUrl).username);
  const db: Env = Object.assign(created, {
    baseline: {},
    history: new Map<string, string>(),
    layers: new Map<string, string>(),
    gates: new Map<string, string>(),
  });
  opened.push(db);
  LEDGER.databases += 1;
  await reenterCompletePinnedFixture(db.migrator, { DESK_ENV: "test" });
  await verifyCompletePinnedFixture(db.runtime); // Q0: once, before the first call
  db.history = await historical(db.owner);
  expect(db.history.size).toBe(398);
  must(
    await runWriterPass1(db.runtime, INV_P1, observer(), nonNetworkControls()),
    "Pass 1",
  );
  must(
    await runCraftCritic(db.runtime, INV_C, observer(), nonNetworkControls()),
    "Critic",
  );
  must(
    await runCraftRevision(db.runtime, INV_R, observer(), nonNetworkControls()),
    "Revision",
  );
  return db;
};
/** The texture to T4 through the exported components (no pack open: the plan is reused). */
const toT4 = async (db: Env): Promise<void> => {
  must(await stageTextureInputs(db.runtime, TPLAN), "T1t");
  must(
    await executeTextureCall(
      db.runtime,
      TPLAN,
      observer(),
      nonNetworkControls(),
    ),
    "E",
  );
  must(await recordTextureLineage(db.runtime, TPLAN), "T3t");
};
/** Records the layer boundary and the counts at this moment (the entry state a case asserts and later compares to). */
const mark = async (db: Env): Promise<void> => {
  db.layers = await layerRows(db.owner);
  db.baseline = await tableCounts(db.owner);
};
/**
 * No row added anywhere since the last mark, the 398 baseline historical identities byte-identical, the all-current family total exactly `total`
 * (484 after Pass 1/Critic/Revision, 523 after the texture, 541 after the 18 gate rows: the authorized new rows are never relabelled historical),
 * every current Claims/Writing row byte-identical once captured, and every layer row present at the last mark byte-identical.
 */
const verifyUnchanged = async (db: Env, total: number): Promise<void> => {
  const after = await tableCounts(db.owner);
  for (const table of COUNTED)
    expect(after[table], `rows in ${table}`).toBe(db.baseline[table]);
  const rows = await historical(db.owner);
  expect(rows.size, "all-current family rows").toBe(total);
  for (const [key, value] of db.history) expect(rows.get(key), key).toBe(value);
  for (const [id, value] of db.gates)
    expect(rows.get(`gate_results|${id}`), `gate row ${id}`).toBe(value);
  const layers = await layerRows(db.owner);
  for (const [key, value] of db.layers)
    expect(layers.get(key), `layer row ${key}`).toBe(value);
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

// ---- a counted, instrumented pool: every driver call (pool and checked-out clients) is recorded in order; nothing is altered -------------------------
const textOf = (first: unknown): string => {
  const text =
    typeof first === "string"
      ? first
      : (first as { text?: unknown } | undefined)?.text;
  return typeof text === "string" ? text : "";
};
interface Counted {
  readonly pool: pg.Pool;
  readonly calls: () => number;
  readonly texts: () => string[];
}
const counted = (real: pg.Pool): Counted => {
  const texts: string[] = [];
  const pool = {
    connect: async () => {
      const client = await real.connect();
      const original = client.query.bind(client) as (
        ...a: unknown[]
      ) => unknown;
      const release = client.release.bind(client);
      const patched = client as unknown as { query: unknown; release: unknown };
      patched.query = (...args: unknown[]): unknown => {
        texts.push(textOf(args[0]));
        return original(...args);
      };
      patched.release = (arg?: unknown): void => {
        delete (client as unknown as { query?: unknown }).query;
        delete (client as unknown as { release?: unknown }).release;
        release(arg as boolean | undefined);
      };
      return client;
    },
    query: (...args: unknown[]): unknown => {
      texts.push(textOf(args[0]));
      return (real.query as (...a: unknown[]) => unknown)(...args);
    },
  } as unknown as pg.Pool;
  return { pool, calls: () => texts.length, texts: () => [...texts] };
};
/** One Performance refusal through the counted pool: exactly the reader's calls, read-only statements only. */
const refuse = async (
  real: pg.Pool,
): Promise<Awaited<ReturnType<typeof refusePerformanceDirection>>> => {
  const wrapped = counted(real);
  LEDGER.runs += 1;
  const refusal = await refusePerformanceDirection(wrapped.pool, PPLAN);
  expect(wrapped.calls(), "reader driver calls").toBe(READER_CALLS);
  LEDGER.queries += wrapped.calls();
  const texts = wrapped.texts();
  expect(texts[0]).toBe("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  expect(texts[READER_CALLS - 1]).toBe("COMMIT");
  for (const text of texts.slice(1, READER_CALLS - 1))
    expect(/^\s*SELECT\b/u.test(text), text.slice(0, 40)).toBe(true);
  expect(texts.includes("ROLLBACK")).toBe(false);
  expect(refusal).toMatchObject({
    kind: "refused",
    stage: "admission",
    writes_attempted: 0,
    durable: { performance: "not_read" },
    cleanup: CLEAN0,
    reconciled: false,
  });
  return refusal;
};
const states = async (db: DbEnv): Promise<Obj> =>
  (
    await db.owner.query<Obj>(
      `SELECT a.state::text AS attempt_state, a.publication_enabled AS attempt_publication, r.state::text AS run_state, r.publication_enabled AS run_publication
       FROM program_run_attempts a JOIN program_runs r ON r.program_run_id = a.program_run_id WHERE a.attempt_id = $1::uuid`,
      [ATTEMPT],
    )
  ).rows[0] ?? {};
const PENDING = {
  attempt_state: "PENDING",
  attempt_publication: false,
  run_state: "PENDING",
  run_publication: false,
};
/** The Performance-owned gate_results rows currently stored (the historical seven; nothing in this scope ever adds one). */
const performanceRows = async (db: DbEnv): Promise<string[]> =>
  (
    await db.owner.query<{ v: string }>(
      `SELECT to_jsonb(x)::text AS v FROM gate_results x WHERE gate_definition_id = ANY($1::uuid[]) ORDER BY gate_result_id`,
      [PERFORMANCE_DEFINITIONS],
    )
  ).rows.map((row) => row.v);
const performanceTables = async (
  db: DbEnv,
): Promise<Record<string, number>> => {
  const out: Record<string, number> = {};
  for (const name of ["performance_direction_versions", "performance_intents"])
    out[name] = Number(
      (
        await db.owner.query<{ n: string }>(
          `SELECT count(*) AS n FROM "${name}"`,
        )
      ).rows[0]?.n,
    );
  return out;
};

let DB: Env | undefined;
const scenario = async (): Promise<Env> => {
  DB ??= await fresh();
  return DB;
};
let HISTORICAL_PERFORMANCE: string[] = [];
let HISTORICAL_TABLES: Record<string, number> = {};

suite(
  "performance direction fixed fixture seam, Scope A refusals (disposable PostgreSQL 17, runtime role)",
  () => {
    beforeAll(async () => {
      PACK = openFixturePack();
      const planned = planSpeechTexture(INV);
      if (planned.kind !== "planned")
        throw new Error(`texture plan stopped: ${planned.code}`);
      TPLAN = planned.plan;
      const gate = planClaimsWritingGate(GATE_INV, {
        texturePlan: TPLAN,
        pack: PACK,
      });
      if (gate.kind !== "planned")
        throw new Error(`gate plan stopped: ${gate.code}`);
      GPLAN = gate.plan;
      PPLAN = planPerformanceDirection({ gatePlan: GPLAN, pack: PACK });
      await cluster?.bootstrap();
    }, T);
    // the one scenario database lives across the ordered cases by design; every open database is closed (and its absence asserted) in afterAll
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
      "PI01 upstream_incomplete_is_refused_with_zero_effects",
      async () => {
        const db = await scenario();
        await mark(db);
        HISTORICAL_PERFORMANCE = await performanceRows(db);
        HISTORICAL_TABLES = await performanceTables(db);
        // the historical Performance rows (the seven already inside the 31 gate_results rows) are the only ones; entry: texture still at T0
        expect(HISTORICAL_PERFORMANCE).toHaveLength(7);
        // an independent oracle: the 31 historical gate_results rows only (Pass 1, Critic, Revision and the texture add none); not 62
        expect(db.baseline.gate_results).toBe(31);
        expect(await states(db)).toEqual(PENDING);
        const refusal = await refuse(db.runtime);
        expect(refusal.code).toBe("perf_upstream_stopped");
        expect(refusal.upstream).toMatchObject({
          class: "stop",
          code: "gate_texture_incomplete",
          stage: "preconditions",
        });
        await verifyUnchanged(db, 484);
        expect(await states(db)).toEqual(PENDING);
        expect(await performanceRows(db)).toEqual(HISTORICAL_PERFORMANCE);
      },
      T,
    );

    it(
      "PI02 gate_absent_is_refused_with_zero_effects",
      async () => {
        const db = await scenario();
        await toT4(db);
        await mark(db); // the texture rows are the entry state of this case
        expect(db.baseline.gate_results).toBe(31);
        const refusal = await refuse(db.runtime);
        expect(refusal.code).toBe("perf_upstream_gate_absent");
        expect(refusal.upstream).toEqual({ class: "state", gate_state: 0 });
        await verifyUnchanged(db, 523);
        expect(await states(db)).toEqual(PENDING);
        expect(await performanceRows(db)).toEqual(HISTORICAL_PERFORMANCE);
      },
      T,
    );

    it(
      "PI03 current_chain_gate_failed_is_refused_with_zero_effects",
      async () => {
        const db = await scenario();
        // setup (not the unit under test): the unchanged gate records its 18 rows once, through its own counted create path
        const wrapped = counted(db.runtime);
        LEDGER.runs += 1;
        const recorded = await runClaimsWritingGate(wrapped.pool, GATE_INV, {
          texturePlan: TPLAN,
          pack: PACK,
        });
        expect(wrapped.calls(), "gate setup driver calls").toBe(
          GATE_CREATE_CALLS,
        );
        LEDGER.queries += wrapped.calls();
        if (recorded.kind !== "recorded")
          throw new Error(`gate setup did not record: ${recorded.code}`);
        const afterGate = await tableCounts(db.owner);
        expect(afterGate.gate_results - db.baseline.gate_results).toBe(18);
        expect(afterGate.gate_results).toBe(49); // 31 historical + the 18 current rows
        await mark(db);
        // one query returns the 18 identities, their complete database-rendered JSON and outcomes (no extra SQL statement)
        const rows = await db.owner.query<{
          id: string;
          outcome: string;
          v: string;
        }>(
          `SELECT gate_result_id::text AS id, outcome::text AS outcome, to_jsonb(x)::text AS v FROM gate_results x WHERE attempt_id = $1::uuid AND input_fingerprint = $2 ORDER BY gate_result_id`,
          [ATTEMPT, GPLAN.fingerprint],
        );
        expect(rows.rows).toHaveLength(18);
        // the current chain's recorded content is 16 pass / 2 fail
        expect(rows.rows.filter((row) => row.outcome === "pass")).toHaveLength(
          16,
        );
        expect(rows.rows.filter((row) => row.outcome === "fail")).toHaveLength(
          2,
        );
        // the current 18 rows are neither historical nor layer rows: preserve them here and compare through PI03, PI04 and PI05
        for (const row of rows.rows) db.gates.set(row.id, row.v);
        expect(db.gates.size).toBe(18);
        // the required witness: the refusal is `perf_upstream_gate_failed` (aggregate failed), with the reader's own cleanup and zero effects
        const refusal = await refuse(db.runtime);
        expect(refusal.code).toBe("perf_upstream_gate_failed");
        expect(refusal.upstream).toEqual({
          class: "state",
          gate_state: 18,
          aggregate: "failed",
        });
        await verifyUnchanged(db, 541);
        expect(await states(db)).toEqual(PENDING);
        expect(await performanceRows(db)).toEqual(HISTORICAL_PERFORMANCE);
      },
      T,
    );

    it(
      "PI04 repeated_refusal_is_idempotent_with_zero_effects",
      async () => {
        const db = await scenario();
        await mark(db);
        const first = await refuse(db.runtime);
        const second = await refuse(db.runtime);
        expect(second).toEqual(first);
        expect(first.code).toBe("perf_upstream_gate_failed");
        await verifyUnchanged(db, 541);
        expect(await states(db)).toEqual(PENDING);
      },
      T,
    );

    it(
      "PI05 historical_performance_rows_retained_and_untouched",
      async () => {
        const db = await scenario();
        // no reader call here: this case only reads the stored rows after everything above
        expect(await performanceRows(db)).toEqual(HISTORICAL_PERFORMANCE);
        expect(HISTORICAL_PERFORMANCE).toHaveLength(7);
        expect(await performanceTables(db)).toEqual(HISTORICAL_TABLES);
        const rows = await historical(db.owner);
        expect(db.history.size).toBe(398);
        expect(rows.size).toBe(541); // 398 historical + 86 (Pass 1, Critic, Revision) + 39 (texture) + 18 current gate rows; none is relabelled historical
        for (const [key, value] of db.history)
          expect(rows.get(key), key).toBe(value);
        expect(db.gates.size).toBe(18);
        for (const [id, value] of db.gates)
          expect(rows.get(`gate_results|${id}`), `gate row ${id}`).toBe(value);
        // the whole scenario: five reader refusals (PI01, PI02, PI03, PI04 twice), nothing added by any of them
        expect(LEDGER.databases).toBe(1);
        expect(LEDGER.queries).toBe(GATE_CREATE_CALLS + 5 * READER_CALLS);
        expect(await states(db)).toEqual(PENDING);
      },
      T,
    );
  },
);
