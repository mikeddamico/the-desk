// Integration tests of the fixed Claims/Writing gate seam against disposable PostgreSQL 17 databases (the existing TestCluster), on the actual
// `desk_runtime` pool. Eight databases are prepared (each: migrate, pinned fixture, the strict Q0 checkpoint, then Pass 1, Critic and Revision
// through the unchanged runners; texture to T4 through the exported components except where a case needs a lower state). Immutable seeded
// states cannot be undone, so each distinct terminal state has its own database; monotone cases share one. Every case asserts its entry state
// and its exact row delta, and that the 398 historical rows and every upstream and texture row are byte-identical afterwards. Expected values
// are authored from the design record (never read from the implementation). Nothing here is a model or quality result. The uncounted `afterAll`
// teardown asserts independently that every database and login role this file may have created is gone, even when setup failed part-way.
// The serialization exercised is among participating gate callers sharing the per-fingerprint advisory lock; no test claims universal exclusion.
import { randomUUID } from "node:crypto";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GATE_SET_VERSION } from "../../src/fixture/derive.js";
import { allTables, families } from "../../src/fixture/families.js";
import { openFixturePack } from "../../src/fixture/pack.js";
import {
  reenterCompletePinnedFixture,
  verifyCompletePinnedFixture,
} from "../../src/fixture/persist.js";
import {
  evidencePackageHash,
  scriptHash,
  showrunnerBriefHash,
} from "../../src/identity/artifacts.js";
import { fingerprint } from "../../src/identity/fingerprints.js";
import {
  planClaimsWritingGate,
  runClaimsWritingGate,
  type GatePlan,
  type GateRecorded,
  type GateStopped,
} from "../../src/runtime/claims-writing-gate.js";
import { runCraftCritic } from "../../src/runtime/craft-critic.js";
import { runCraftRevision } from "../../src/runtime/craft-revision.js";
import type { ObserverContext } from "../../src/runtime/observe.js";
import {
  classifyTextureSnapshot,
  executeTextureCall,
  planSpeechTexture,
  readTextureSnapshot,
  recordTextureLineage,
  runSpeechTexture,
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
const FINGERPRINT =
  "1be8aaa9d5ac8a5086542065d55275e018eefba78cc0a934c22171d32f76a5ba";
const PARENT_BOUND_FINGERPRINT =
  "7e4a9e495ee27aedbbc7c9b376c014a558d7b0b713d55c6c5ca5de0d10dcc2d2";
const CHILD_VERSION = "063cbf1b-c4fa-4254-a63b-343dfd494787";
const HOOK = Symbol.for("the-desk.a5.test-fault-hook");
const FOREIGN = "00000000-0000-4000-8000-0000000000f1";
const FOREIGN2 = "00000000-0000-4000-8000-0000000000f2";
const FOREIGN3 = "00000000-0000-4000-8000-0000000000f3";
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
const U3 = { pass1: "unknown", critic: "unknown", revision: "unknown" };
const P3 = { pass1: "present", critic: "present", revision: "present" };
const CLEAN0 = { attached_errors: 0, complete: true };

// ---- the independently authored expectation of the pinned chain (derived from the design record; not an observation) ---------------------------
const RESULT_IDS: readonly string[] = [
  "23e61246-eb48-45d1-b74d-85d105a71d85",
  "5925b4fe-b355-4dc5-bdb3-148f1b59997c",
  "679628bd-c726-41a6-8761-eb56ad4fb97a",
  "17131999-49bb-428c-b366-96aed2ba8035",
  "243ebc65-9250-4202-ad12-b482b2187a55",
  "11098677-1d2b-4030-834a-4629baeb9de0",
  "c2621bac-07db-4407-8b47-a4935c1372b7",
  "7374b8ae-f7ab-446e-adb1-59e900431ac9",
  "a4df5a40-9af6-4d1c-8b1f-ed41abadd674",
  "68f6ae95-7a08-4d86-b763-23c7a456376a",
  "3d007d27-b039-4c35-9760-e88700c703c6",
  "4ac1eaa5-c46d-4610-9b15-8551ba16e6b0",
  "bf4800ae-b302-433f-a48f-2f6aa50411cb",
  "dad655ea-5019-4db4-a597-fad134e43412",
  "c6f4bb19-6a2b-4079-821e-2ee5efa59f15",
  "ffc018b0-5ca1-485c-a26c-4d130fdaf4a2",
  "d222a3d3-219e-40d6-9662-a53ea1616fde",
  "6dbbc938-42e4-41db-ab7c-48eeda0867ba",
];
const KEYS: readonly string[] = [
  "claims.presence",
  "claims.use_permission",
  "claims.silent_non_leak",
  "claims.value_support",
  "claims.quote_permission",
  "claims.paraphrase_permission",
  "claims.speaker_attribution",
  "claims.claim_state",
  "claims.program_history",
  "claims.desk_derivation",
  "claims.incident_status",
  "claims.span_integrity",
  "writing.participant_validity",
  "writing.planned_block_membership",
  "writing.required_blocks",
  "writing.provider_markup_lint",
  "writing.diff_lock",
  "writing.context_complete",
];
const FACTS: readonly Obj[] = [
  {
    examined: 15,
    expected_examined: 15,
    claim_uses: 12,
    evidence_uses: 3,
    package_claims: 9,
    package_evidence: 16,
  },
  {
    examined: 15,
    expected_examined: 15,
    asserted: 9,
    hedged: 1,
    attributed: 2,
    relied_on_silent: 0,
    quoted: 1,
    paraphrased: 2,
  },
  {
    examined: 3,
    expected_examined: 3,
    silent_claims: 1,
    silent_claim_uses: 0,
    silent_evidence_units: 2,
    silent_evidence_uses: 0,
    turns_scanned: 17,
    silent_value_matches: 0,
    withheld_run_matches: 0,
  },
  {
    examined: 18,
    expected_examined: 18,
    supported: 13,
    no_finding_context: 3,
    violations: 1,
    proof_gaps: 1,
  },
  {
    examined: 1,
    expected_examined: 1,
    quoted_uses: 1,
    metalinguistic_mentions: 1,
    quote_pairs_seen: 2,
  },
  {
    examined: 2,
    expected_examined: 2,
    paraphrased_uses: 2,
    overlap_matches: 0,
    guard_run_cp: 24,
  },
  {
    examined: 3,
    expected_examined: 3,
    prefix_matches: 3,
    quoted_speaker_fields_available: 0,
  },
  { examined: 8, expected_examined: 8, confirmed: 8 },
  { examined: 1, expected_examined: 1 },
  {
    examined: 1,
    expected_examined: 1,
    input_refs: 5,
    window_matches: 5,
    desk_derived_uses: 2,
    metadata_checks_passed: 1,
  },
  { examined: 2, expected_examined: 2, incident_claims: 0 },
  { examined: 15, expected_examined: 15, shifted_spans: 2 },
  {
    examined: 17,
    expected_examined: 17,
    roster_members: 3,
    profile_versions_bound: 3,
  },
  { examined: 17, expected_examined: 17, brief_blocks: 9 },
  {
    examined: 9,
    expected_examined: 9,
    template_required_slots: 9,
    optional_slots_omitted: 1,
    blocks_with_turns: 9,
  },
  {
    examined: 17,
    expected_examined: 17,
    character_classes_seen: 7,
    forbidden_matches: 0,
    respelling_matches: 0,
  },
  {
    examined: 17,
    expected_examined: 17,
    changed_turns: 8,
    rewrite_rows: 9,
    uses: 15,
    net_cp_delta: -5,
  },
  {
    examined: 1,
    expected_examined: 1,
    missing_refs: 0,
    forbidden_refs_serialized: 0,
    budget_within_limit: 1,
    serialized_hash_bound: 1,
    silent_claim_excluded: 1,
  },
];
const FINDINGS: Readonly<Record<number, readonly Obj[]>> = {
  3: [
    {
      anchor: "t04",
      class: "violation",
      code: "precise_duration_unsupported",
      span: [136, 139],
    },
    {
      anchor: "t08",
      class: "proof_gap",
      code: "duration_context_unresolved",
      span: [127, 130],
    },
  ],
  9: [
    {
      class: "proof_gap",
      code: "required_proof_not_established",
      ref: "derivation_count_reexecution",
    },
  ],
};
const definitionId = (index: number): string =>
  `d1250019-0000-4000-8000-0000000000${String(index + 1).padStart(2, "0")}`;
/** The authored stored row of definition `index` (0-based) on the pinned chain. */
const expectedRow = (index: number): Obj => ({
  gate_result_id: RESULT_IDS[index],
  gate_definition_id: definitionId(index),
  attempt_id: ATTEMPT,
  input_fingerprint: FINGERPRINT,
  outcome: index === 3 || index === 9 ? "fail" : "pass",
  result: {
    actor_id: "d1250001-0000-4000-8000-000000000002",
    actor_kind: "policy",
    check: KEYS[index],
    facts: FACTS[index],
    findings: FINDINGS[index] ?? [],
    fingerprint_stage: "claims_writing",
    schema: "claims-writing-gate-result/1",
    subject_refs: [CHILD_VERSION],
  },
  created_at: CREATED_AT,
});

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
let PACK: ReturnType<typeof openFixturePack>;
let TABLES: Record<string, Obj[]>;
type Env = DbEnv & {
  baseline: Record<string, number>;
  history: Map<string, string>;
  layers: Map<string, string>;
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
const prepared = async (state: "upstream" | "t4"): Promise<Env> => {
  const db = await fresh();
  if (state === "t4") await toT4(db);
  await mark(db);
  expect(db.baseline.gate_results).toBe(62);
  return db;
};
/** The exact row delta against `since`, every historical row byte-identical, and every layer row present at the last mark byte-identical. */
const verify = async (
  db: Env,
  expected: Readonly<Record<string, number>>,
  since: Record<string, number> = db.baseline,
): Promise<void> => {
  const after = await tableCounts(db.owner);
  for (const table of COUNTED)
    expect(
      (after[table] ?? 0) - (since[table] ?? 0),
      `rows added to ${table}`,
    ).toBe(expected[table] ?? 0);
  const rows = await historical(db.owner);
  for (const [key, value] of db.history) expect(rows.get(key), key).toBe(value);
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

// ---- running the gate with a counted, instrumented pool ------------------------------------------------------------------------------------------
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
/** Forwards every driver call (pool and checked-out clients) and records its text in order; nothing is altered. */
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
const runG = async (
  real: pg.Pool,
  expectedCalls: number,
): Promise<GateRecorded | GateStopped> => {
  const wrapped = counted(real);
  LEDGER.runs += 1;
  const result = await runClaimsWritingGate(wrapped.pool, GATE_INV, {
    texturePlan: TPLAN,
    pack: PACK,
  });
  expect(wrapped.calls(), "gate driver calls").toBe(expectedCalls);
  LEDGER.queries += wrapped.calls();
  return result;
};
const recordedOf = (result: GateRecorded | GateStopped): GateRecorded => {
  if (result.kind !== "recorded")
    throw new Error(`expected recorded, got ${result.code}`);
  return result;
};
const stoppedOf = (result: GateRecorded | GateStopped): GateStopped => {
  if (result.kind !== "stopped") throw new Error("expected a stop");
  return result;
};
/** The independently authored complete stop of a preflight classification (nothing written, nothing known). */
const preflightStop = (code: string, extra: Obj = {}): Obj => ({
  kind: "stopped",
  stage: "preconditions",
  code,
  writes_attempted: false,
  upstream: U3,
  durable: { gate: "unknown", texture: "unknown" },
  reconciled: false,
  cleanup: CLEAN0,
  ...extra,
});
interface Faults {
  points: string[];
}
const withFaults = async <S>(
  hook: ((point: string, faults: Faults) => unknown) | undefined,
  fn: (faults: Faults) => Promise<S>,
): Promise<S> => {
  const faults: Faults = { points: [] };
  const previous = Object.getOwnPropertyDescriptor(globalThis, HOOK);
  const flag = process.env.DESK_TEST_FAULTS;
  process.env.DESK_TEST_FAULTS = "1";
  Object.defineProperty(globalThis, HOOK, {
    configurable: true,
    value: async (point: string): Promise<void> => {
      faults.points.push(point);
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
 * The WRITING-command COMMIT-outcome fault source: the COMMIT of the `nth` READ COMMITTED transaction is lost with SQLSTATE 57P01, the one code
 * the accepted command code classifies as a lost session. `applied`: the COMMIT is really sent and acknowledged and then replaced by the loss
 * (the rows ARE durable); `unapplied`: the COMMIT is not sent, the loss is reported and the connection destroyed (the rows are absent). The
 * reported symptom is identical; only the database tells them apart. Read-only snapshots are never counted.
 */
const commitLoss = (
  real: pg.Pool,
  nth: number,
  mode: "applied" | "unapplied",
): { pool: pg.Pool; lost: () => number } => {
  let writers = 0;
  let lost = 0;
  const pool = {
    connect: async () => {
      const client = await real.connect();
      let ordinal = 0;
      const original = client.query.bind(client) as (
        ...a: unknown[]
      ) => Promise<unknown>;
      const release = client.release.bind(client);
      const patched = client as unknown as { query: unknown; release: unknown };
      patched.query = async (...args: unknown[]): Promise<unknown> => {
        const text = textOf(args[0]);
        if (text.startsWith("BEGIN ISOLATION LEVEL READ COMMITTED")) {
          writers += 1;
          ordinal = writers;
        }
        if (ordinal === nth && text === "COMMIT") {
          if (mode === "applied") await original(...args);
          lost += 1;
          throw Object.assign(
            new Error("terminating connection due to administrator command"),
            { code: "57P01" },
          );
        }
        return original(...args);
      };
      patched.release = (arg?: unknown): void => {
        delete (client as unknown as { query?: unknown }).query;
        delete (client as unknown as { release?: unknown }).release;
        release(arg as boolean | undefined);
      };
      return client;
    },
    query: (...args: unknown[]): unknown =>
      (real.query as (...a: unknown[]) => unknown)(...args),
  } as unknown as pg.Pool;
  return { pool, lost: () => lost };
};
interface Chaos {
  connect?: boolean;
  begin?: boolean;
  /** fail the k-th SELECT of the first snapshot (0-based) */
  read?: number;
  commit?: boolean;
}
/** Failure injection for the FIRST read-only snapshot (the clients that open `REPEATABLE READ READ ONLY`); other clients are untouched. */
const chaosPool = (
  real: pg.Pool,
  chaos: Chaos,
): { pool: pg.Pool; log: { statements: string[]; releases: unknown[] } } => {
  const log = { statements: [] as string[], releases: [] as unknown[] };
  let snapshots = 0;
  const pool = {
    connect: async () => {
      if (snapshots === 0 && chaos.connect === true) {
        snapshots += 1;
        throw new Error("injected connect failure");
      }
      const client = await real.connect();
      let ours = false;
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
          snapshots += 1;
          ours = snapshots === 1;
        }
        if (ours) {
          log.statements.push(text);
          if (text.startsWith("BEGIN") && chaos.begin === true)
            throw new Error("injected BEGIN failure");
          if (text.startsWith("SELECT")) {
            reads += 1;
            if (chaos.read !== undefined && reads === chaos.read + 1)
              throw new Error("injected read failure");
          }
          if (text === "COMMIT" && chaos.commit === true)
            throw new Error("injected COMMIT failure");
        }
        return original(...args);
      };
      patched.release = (arg?: unknown): void => {
        if (ours) log.releases.push(arg);
        delete (client as unknown as { query?: unknown }).query;
        delete (client as unknown as { release?: unknown }).release;
        release(arg as boolean | undefined);
      };
      return client;
    },
    query: (...args: unknown[]): unknown =>
      (real.query as (...a: unknown[]) => unknown)(...args),
  } as unknown as pg.Pool;
  return { pool, log };
};
// ---- direct inserts through the database owner (contamination for the negatives) -------------------------------------------------------------
const insertGate = (db: DbEnv, row: Obj) =>
  db.owner.query(
    `INSERT INTO gate_results (gate_result_id, gate_definition_id, attempt_id, input_fingerprint, outcome, result, created_at)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::jsonb, $7::timestamptz)`,
    [
      row.gate_result_id,
      row.gate_definition_id,
      row.attempt_id,
      row.input_fingerprint,
      row.outcome,
      JSON.stringify(row.result),
      row.created_at,
    ],
  );
/** How many of the `rows` exist in `gate_results` with EVERY column natively equal (jsonb and timestamptz by the database). */
const matching = async (db: DbEnv, rows: readonly Obj[]): Promise<number> => {
  const result = await db.owner.query<{ n: string }>(
    `SELECT count(*) AS n FROM unnest($1::uuid[], $2::uuid[], $3::uuid[], $4::text[], $5::text[], $6::text[], $7::text[]) AS e(id, def, attempt, fp, outcome, result, created)
     JOIN gate_results g ON g.gate_result_id = e.id AND g.gate_definition_id = e.def AND g.attempt_id = e.attempt AND g.input_fingerprint::text = e.fp
       AND g.outcome = e.outcome AND g.result IS NOT DISTINCT FROM e.result::jsonb AND g.created_at = e.created::timestamptz`,
    [
      rows.map((r) => r.gate_result_id),
      rows.map((r) => r.gate_definition_id),
      rows.map((r) => r.attempt_id),
      rows.map((r) => r.input_fingerprint),
      rows.map((r) => r.outcome),
      rows.map((r) => JSON.stringify(r.result)),
      rows.map((r) => r.created_at),
    ],
  );
  return Number(result.rows[0]?.n);
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

const SHARED = new Map<string, Env>();
/** Databases A, B and E are shared by the monotone cases that name them; every other database is private to one case. */
const database = async (
  name: string,
  state: "upstream" | "t4",
): Promise<Env> => {
  const known = SHARED.get(name);
  if (known) return known;
  const db = await prepared(state);
  SHARED.set(name, db);
  return db;
};
let AFTER_GATE: Record<string, number> = {};
const EXPECTED_ROWS: readonly Obj[] = RESULT_IDS.map((_, index) =>
  expectedRow(index),
);
const CONNECTION_STOP = (phase: string): Obj => ({
  kind: "stopped",
  stage: "record",
  code: "gate_command_connection",
  writes_attempted: true,
  upstream: P3,
  durable: { gate: "unknown", texture: "present" },
  reconciled: false,
  cleanup: CLEAN0,
  connection: { phase, commit_outcome: "unknown" },
});
const FOREIGN_ROW = (id: string, over: Obj = {}): Obj => ({
  gate_result_id: id,
  gate_definition_id: definitionId(0),
  attempt_id: ATTEMPT,
  input_fingerprint: FINGERPRINT,
  outcome: "pass",
  result: {},
  created_at: CREATED_AT,
  ...over,
});

suite(
  "claims/writing gate fixed fixture seam (disposable PostgreSQL 17, runtime role)",
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
      expect(GPLAN.fingerprint).toBe(FINGERPRINT);
      TABLES = (
        PACK.json("foundation_rows_398.json") as {
          tables: Record<string, Obj[]>;
        }
      ).tables;
      await cluster?.bootstrap();
    }, T);
    // databases A, B and E live across cases by design; every open database is closed (and its absence asserted) in afterAll
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
      "GI01 happy path on the actual runtime role through all four layers: exactly +18 gate_results and nothing else, stored vector 16 pass / 2 fail by native equality, host still PENDING, aggregate failed",
      async () => {
        const a = await database("A", "t4");
        expect(a.baseline.gate_results).toBe(62);
        expect(await states(a)).toEqual(PENDING);
        const result = recordedOf(await runG(a.runtime, 361));
        expect(result.convergence).toBe("created");
        expect(result.aggregate).toBe("failed");
        expect(result.counts).toEqual({
          rows_recorded: 18,
          definitions_passed: 16,
          definitions_failed: 2,
        });
        expect(
          result.rows.map((row) => [row.key, row.gate_result_id, row.outcome]),
        ).toEqual(
          RESULT_IDS.map((id, index) => [
            KEYS[index],
            id,
            index === 3 || index === 9 ? "fail" : "pass",
          ]),
        );
        expect(result.identities).toEqual({
          fingerprint: FINGERPRINT,
          script_hash:
            "776eefadaa96ae3ef0030e48d15184ac1aa49032695d6e84f03b2ce9f6084fe0",
          parent_script_hash:
            "4a927ad9cd612aa0f2f57ed52273061abcfe8f1ba8d8f864ca2a25907c517b00",
          script_version_id: CHILD_VERSION,
          attempt_id: ATTEMPT,
        });
        expect(result.durable).toEqual({ gate: "present", texture: "present" });
        expect(result.reconciled).toBe(true);
        await verify(a, { gate_results: 18 });
        expect(await matching(a, EXPECTED_ROWS)).toBe(18); // every column of every stored row equals the authored expectation
        expect(await states(a)).toEqual(PENDING);
        AFTER_GATE = await tableCounts(a.owner);
      },
      T,
    );

    it(
      "GI02 repeated entry: two sequential re-entries converge on the 18 rows with zero delta",
      async () => {
        const a = await database("A", "t4");
        expect(await matching(a, EXPECTED_ROWS)).toBe(18); // entry state: G18
        for (let i = 0; i < 2; i += 1) {
          const again = recordedOf(await runG(a.runtime, 148));
          expect(again.convergence).toBe("converged");
          expect(again.aggregate).toBe("failed");
          expect(again.reconciled).toBe(true);
        }
        await verify(a, {}, AFTER_GATE);
      },
      T,
    );

    it(
      "GI03 texture T0, T1, T3 and a stranded T2 stop with zero gate writes and zero perform; completing the texture then permits the gate",
      async () => {
        const b = await database("B", "upstream");
        const incomplete = (state: number): Obj =>
          preflightStop("gate_texture_incomplete", { texture_state: state });
        expect(stoppedOf(await runG(b.runtime, 148))).toEqual(incomplete(0)); // T0: upstream complete, no texture row
        await verify(b, {});
        must(await stageTextureInputs(b.runtime, TPLAN), "T1t");
        await mark(b);
        expect(stoppedOf(await runG(b.runtime, 148))).toEqual(incomplete(1));
        await verify(b, {});
        must(
          await executeTextureCall(
            b.runtime,
            TPLAN,
            observer(),
            nonNetworkControls(),
          ),
          "E",
        );
        await mark(b);
        expect(stoppedOf(await runG(b.runtime, 148))).toEqual(incomplete(3));
        await verify(b, {});
        must(await recordTextureLineage(b.runtime, TPLAN), "T3t"); // T4: database B is now ready for the concurrent case
        await mark(b);
        expect(b.baseline.gate_results).toBe(62);
        // C: the reservation committed and the return was lost: T2, stranded, never resumed, never performed by the gate
        const c = await prepared("upstream");
        must(await stageTextureInputs(c.runtime, TPLAN), "T1t");
        await withFaults(
          (point) => {
            if (point === "after_reservation_commit")
              throw new Error("injected lost return after the reservation");
          },
          async () => {
            await executeTextureCall(
              c.runtime,
              TPLAN,
              observer(),
              nonNetworkControls(),
            );
          },
        );
        await mark(c);
        await withFaults(undefined, async (faults) => {
          expect(stoppedOf(await runG(c.runtime, 148))).toEqual(incomplete(2));
          expect(faults.points.includes("speech_texture_perform")).toBe(false);
        });
        await verify(c, {});
        await closeEnv(c);
      },
      T,
    );

    it(
      "GI04 seeded rows refuse in strict priority with zero writes: owned partial, foreign, stale, owned conflict (history and definitions cannot be seeded: immutable)",
      async () => {
        const d = await prepared("t4");
        await insertGate(d, expectedRow(0)); // one exact owned row
        expect(stoppedOf(await runG(d.runtime, 148))).toEqual(
          preflightStop("gate_unexpected_state", {
            conflict: { row: "gate_results", kind: "owned_partial" },
          }),
        );
        await verify(d, { gate_results: 1 });
        await insertGate(d, FOREIGN_ROW(FOREIGN)); // an unknown id at the fingerprint
        expect(stoppedOf(await runG(d.runtime, 148))).toEqual(
          preflightStop("gate_result_foreign", {
            conflict: { row: "gate_results", kind: "foreign_row" },
          }),
        );
        await verify(d, { gate_results: 2 });
        await insertGate(
          d,
          FOREIGN_ROW(FOREIGN2, {
            input_fingerprint: PARENT_BOUND_FINGERPRINT,
          }),
        ); // a claims/writing row at the parent-bound fingerprint
        expect(stoppedOf(await runG(d.runtime, 148))).toEqual(
          preflightStop("gate_result_stale", {
            conflict: { row: "gate_results", kind: "stale_fingerprint" },
          }),
        );
        await verify(d, { gate_results: 3 });
        await insertGate(d, { ...expectedRow(1), outcome: "fail" }); // a planned id with different content
        expect(stoppedOf(await runG(d.runtime, 148))).toEqual(
          preflightStop("gate_result_conflict", {
            conflict: {
              row: "gate_results",
              kind: "same_id_different_content",
            },
          }),
        );
        await verify(d, { gate_results: 4 });
        await closeEnv(d);
      },
      T,
    );

    it(
      "GI05 two simultaneous callers released by a barrier after both preflights: one creates, one converges; the 18 rows exist once",
      async () => {
        const b = await database("B", "upstream");
        expect(b.baseline.gate_results).toBe(62); // entry state: T4, G0
        let arrived = 0;
        let release: () => void = () => undefined;
        const barrier = new Promise<void>((resolve) => {
          release = resolve;
        });
        const calls: number[] = [];
        const results = await withFaults(
          async (point) => {
            if (point !== "claims_writing_gate_after_preflight") return;
            arrived += 1;
            if (arrived === 2) release();
            await barrier;
          },
          () =>
            Promise.all(
              [0, 1].map(async () => {
                const wrapped = counted(b.runtime);
                LEDGER.runs += 1;
                const result = await runClaimsWritingGate(
                  wrapped.pool,
                  GATE_INV,
                  { texturePlan: TPLAN, pack: PACK },
                );
                calls.push(wrapped.calls());
                return result;
              }),
            ),
        );
        expect(arrived).toBe(2);
        expect([...calls].sort((x, y) => x - y)).toEqual([305, 361]);
        LEDGER.queries += 666;
        expect(
          results.map((result) => recordedOf(result).convergence).sort(),
        ).toEqual(["converged", "created"]);
        await verify(b, { gate_results: 18 });
        expect(await matching(b, EXPECTED_ROWS)).toBe(18);
      },
      T,
    );

    it(
      "GI06 failures at the lock, after the fifth insert and after the reconcile: the injected error propagates unchanged, the transaction rolls back, zero rows",
      async () => {
        const e = await database("E", "t4");
        expect(e.baseline.gate_results).toBe(62);
        const points: [string, number][] = [
          ["claims_writing_gate_after_lock", 152],
          ["claims_writing_gate_after_insert_5", 172],
          ["claims_writing_gate_after_reconcile", 213],
        ];
        for (const [point, expectedCalls] of points) {
          const injected = new Error(`injected failure at ${point}`);
          await withFaults(
            (current) => {
              if (current === point) throw injected;
            },
            async (faults) => {
              const wrapped = counted(e.runtime);
              LEDGER.runs += 1;
              await expect(
                runClaimsWritingGate(wrapped.pool, GATE_INV, {
                  texturePlan: TPLAN,
                  pack: PACK,
                }),
              ).rejects.toBe(injected);
              expect(wrapped.calls(), point).toBe(expectedCalls);
              LEDGER.queries += wrapped.calls();
              expect(faults.points.includes(point)).toBe(true);
            },
          );
          await verify(e, {}); // rolled back: no partial rows
        }
      },
      T,
    );

    it(
      "GI07 COMMIT outcome uncertainty: the same stop for an unapplied and an applied lost acknowledgment; only the database tells them apart and the next entry reconciles",
      async () => {
        const e = await database("E", "t4");
        const unapplied = commitLoss(e.runtime, 1, "unapplied");
        const wrappedU = counted(unapplied.pool);
        LEDGER.runs += 1;
        expect(
          stoppedOf(
            await runClaimsWritingGate(wrappedU.pool, GATE_INV, {
              texturePlan: TPLAN,
              pack: PACK,
            }),
          ),
        ).toEqual(CONNECTION_STOP("commit"));
        expect(wrappedU.calls()).toBe(213);
        LEDGER.queries += 213;
        expect(unapplied.lost()).toBe(1);
        await verify(e, {}); // entry state of the next call: G0 (the rows are absent)
        expect(recordedOf(await runG(e.runtime, 361)).convergence).toBe(
          "created",
        );
        await verify(e, { gate_results: 18 });
        const f = await prepared("t4");
        const applied = commitLoss(f.runtime, 1, "applied");
        const wrappedA = counted(applied.pool);
        LEDGER.runs += 1;
        expect(
          stoppedOf(
            await runClaimsWritingGate(wrappedA.pool, GATE_INV, {
              texturePlan: TPLAN,
              pack: PACK,
            }),
          ),
        ).toEqual(CONNECTION_STOP("commit"));
        expect(wrappedA.calls()).toBe(213);
        LEDGER.queries += 213;
        expect(applied.lost()).toBe(1);
        await verify(f, { gate_results: 18 }); // identical symptom; here the rows ARE durable
        expect(await matching(f, EXPECTED_ROWS)).toBe(18);
        expect(recordedOf(await runG(f.runtime, 148)).convergence).toBe(
          "converged",
        );
        await verify(f, { gate_results: 18 });
        await closeEnv(f);
      },
      T,
    );

    it(
      "GI08 preflight snapshot failures (connect, BEGIN, the 70th driver call, COMMIT): gate_snapshot_failed with owned cleanup and zero writes",
      async () => {
        const a = await database("A", "t4");
        const stop = preflightStop("gate_snapshot_failed");
        const cases: [string, Chaos, number][] = [
          ["connect rejection", { connect: true }, 0],
          ["BEGIN failure and its cleanup ROLLBACK", { begin: true }, 2],
          ["the 70th driver call and its cleanup ROLLBACK", { read: 68 }, 71],
          [
            "COMMIT (the 148th driver call) and its cleanup ROLLBACK",
            { commit: true },
            149,
          ],
        ];
        for (const [label, chaos, expectedCalls] of cases) {
          const injected = chaosPool(a.runtime, chaos);
          expect(
            stoppedOf(await runG(injected.pool, expectedCalls)),
            label,
          ).toEqual(stop);
          await verify(a, {}, AFTER_GATE);
          if (chaos.connect !== true)
            expect(injected.log.releases, label).toEqual([true]);
        }
      },
      T,
    );

    it(
      "GI09 interleaving: a foreign row visible to the final snapshot is detected with the acknowledged create retained; a row committed after the preflight snapshot began is invisible to it and caught by the writer's re-partition under the lock",
      async () => {
        // G: the foreign row commits BEFORE the final snapshot starts, so the final REPEATABLE READ snapshot sees it
        const g = await prepared("t4");
        await withFaults(
          async (point) => {
            if (point === "claims_writing_gate_before_final_check")
              await insertGate(g, FOREIGN_ROW(FOREIGN3));
          },
          async () => {
            expect(stoppedOf(await runG(g.runtime, 361))).toEqual({
              kind: "stopped",
              stage: "final_check",
              code: "gate_result_foreign",
              writes_attempted: true,
              upstream: P3,
              durable: { gate: "present", texture: "present" },
              reconciled: false,
              cleanup: CLEAN0,
              conflict: { row: "gate_results", kind: "foreign_row" },
            });
          },
        );
        await verify(g, { gate_results: 19 }); // the 18 acknowledged rows plus the foreign one
        expect(await matching(g, EXPECTED_ROWS)).toBe(18);
        await closeEnv(g);
        // H: the foreign row commits AFTER the preflight snapshot's first read: invisible to that snapshot (REPEATABLE READ), seen by the
        // writer's own re-partition under the lock: no row is inserted
        const h = await prepared("t4");
        let injectedOnce = false;
        await withFaults(
          async (point) => {
            if (
              point === "claims_writing_gate_preflight_after_first_read" &&
              !injectedOnce
            ) {
              injectedOnce = true;
              await insertGate(h, FOREIGN_ROW(FOREIGN3));
            }
          },
          async () => {
            expect(stoppedOf(await runG(h.runtime, 157))).toEqual({
              kind: "stopped",
              stage: "record",
              code: "gate_result_foreign",
              writes_attempted: true,
              upstream: P3,
              durable: { gate: "none_observed", texture: "present" },
              reconciled: false,
              cleanup: CLEAN0,
              conflict: { row: "gate_results", kind: "foreign_row" },
            });
          },
        );
        expect(injectedOnce).toBe(true);
        await verify(h, { gate_results: 1 }); // only the foreign row: zero gate rows inserted
        expect(await matching(h, EXPECTED_ROWS)).toBe(0);
        await closeEnv(h);
      },
      T,
    );

    it(
      "GI10 the count projection is local: after the gate the unchanged texture runner stops texture_unexpected_state with zero writes, and the unprojected snapshot is refused too",
      async () => {
        const a = await database("A", "t4");
        const result = await runSpeechTexture(
          a.runtime,
          INV,
          observer(),
          nonNetworkControls(),
        );
        if (result.kind !== "stopped")
          throw new Error("the unchanged texture runner must stop");
        expect(result.code).toBe("texture_unexpected_state");
        expect(result.writes_attempted).toBe(false);
        const read = await readTextureSnapshot(a.runtime, TPLAN);
        if (!read.ok) throw new Error("the texture snapshot must read");
        const unprojected = classifyTextureSnapshot(
          read.raw,
          TPLAN,
          "preflight",
        );
        expect(unprojected.kind).toBe("stop");
        expect(unprojected.kind === "stop" ? unprojected.row.code : "").toBe(
          "texture_unexpected_state",
        );
        expect(read.raw.counts.find((row) => row.t === "gate_results")?.n).toBe(
          80,
        );
        await verify(a, {}, AFTER_GATE);
      },
      T,
    );

    it(
      "GI11 no takeover: the unchanged Pass-1, Critic and Revision runners refuse the downstream state with zero writes",
      async () => {
        const a = await database("A", "t4");
        const results: [string, Obj][] = [
          [
            "Pass 1",
            (await runWriterPass1(
              a.runtime,
              INV_P1,
              observer(),
              nonNetworkControls(),
            )) as unknown as Obj,
          ],
          [
            "Critic",
            (await runCraftCritic(
              a.runtime,
              INV_C,
              observer(),
              nonNetworkControls(),
            )) as unknown as Obj,
          ],
          [
            "Revision",
            (await runCraftRevision(
              a.runtime,
              INV_R,
              observer(),
              nonNetworkControls(),
            )) as unknown as Obj,
          ],
        ];
        for (const [label, result] of results) {
          expect(result.kind, label).toBe("stopped");
          expect(result.writes_attempted, label).toBe(false);
        }
        await verify(a, {}, AFTER_GATE);
      },
      T,
    );

    it(
      "GI12 scope: only gate_results +18 against the pre-gate baseline; no audit run, no script version, no lifecycle change; host and run still PENDING",
      async () => {
        const a = await database("A", "t4");
        await verify(a, { gate_results: 18 }, a.baseline);
        expect(await states(a)).toEqual(PENDING);
        const children = await a.owner.query<{ n: string }>(
          "SELECT count(*) AS n FROM script_versions WHERE revision_parent_id = $1::uuid",
          [CHILD_VERSION],
        );
        expect(Number(children.rows[0]?.n)).toBe(0);
        const audits = await a.owner.query<{ n: string }>(
          "SELECT count(*) AS n FROM audit_runs",
        );
        expect(Number(audits.rows[0]?.n)).toBe(a.baseline.audit_runs);
      },
      T,
    );

    it(
      "GI13 read-back: the 18 stored rows equal the authored expectation on every column by native jsonb and timestamptz equality; no other row carries the fingerprint",
      async () => {
        const a = await database("A", "t4");
        expect(await matching(a, EXPECTED_ROWS)).toBe(18);
        const carrying = await a.owner.query<{ n: string }>(
          "SELECT count(*) AS n FROM gate_results WHERE input_fingerprint = $1",
          [FINGERPRINT],
        );
        expect(Number(carrying.rows[0]?.n)).toBe(18);
      },
      T,
    );

    it(
      "GI14 the 18 definition rows equal the loaded definitions with their full JSON; the fingerprint recomputed from stored values equals the stored one",
      async () => {
        const a = await database("A", "t4");
        const ids = RESULT_IDS.map((_, index) => definitionId(index));
        const definitions = (TABLES.gate_definitions ?? []).filter((row) =>
          ids.includes(String(row.gate_definition_id)),
        );
        expect(definitions).toHaveLength(18);
        const same = await a.owner.query<{ n: string }>(
          `SELECT count(*) AS n FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[]) AS e(id, name, version, definition)
           JOIN gate_definitions d ON d.gate_definition_id = e.id AND d.gate_name = e.name AND d.version = e.version
             AND d.definition IS NOT DISTINCT FROM e.definition::jsonb`,
          [
            definitions.map((row) => row.gate_definition_id),
            definitions.map((row) => row.gate_name),
            definitions.map((row) => row.version),
            definitions.map((row) => JSON.stringify(row.definition)),
          ],
        );
        expect(Number(same.rows[0]?.n)).toBe(18);
        const payload = async (id: string): Promise<Obj> =>
          (
            await a.owner.query<{ canonical_payload: Obj }>(
              "SELECT canonical_payload FROM artifacts WHERE artifact_id = $1::uuid",
              [id],
            )
          ).rows[0]?.canonical_payload ?? {};
        const pkg = await payload("d1250005-0000-4000-8000-000000000011");
        const brief = await payload("595870e7-1b3c-4abc-a794-fc864e0c95b2");
        const child = await payload("e25b9e76-f9ad-4b84-9428-2636e8d32d83");
        const manifest = await payload(TPLAN.ids.prompt_manifest_artifact_id);
        const versions = (manifest.component_versions ?? {}) as Obj;
        const recomputed = fingerprint("claims_writing", {
          package_hash: evidencePackageHash(pkg),
          brief_hash: showrunnerBriefHash(brief),
          script_hash: scriptHash(child, { brief }),
          claims_policy_version: versions.claims_policy,
          writing_policy_version: versions.writing_policy,
          gate_set_version: GATE_SET_VERSION,
        });
        expect(recomputed).toBe(FINGERPRINT);
        const stored = await a.owner.query<{ fp: string }>(
          "SELECT DISTINCT input_fingerprint::text AS fp FROM gate_results WHERE gate_result_id = ANY($1::uuid[])",
          [RESULT_IDS],
        );
        expect(stored.rows.map((row) => row.fp)).toEqual([recomputed]);
      },
      T,
    );

    it(
      "GI15 role and privilege: the actual runtime role inserted the rows (GI01); UPDATE and DELETE of a gate row are refused by the immutability triggers",
      async () => {
        const a = await database("A", "t4");
        const role = await a.runtime.query<{ u: string }>(
          "SELECT current_user AS u",
        );
        expect(role.rows[0]?.u).toBe(new URL(a.runtimeUrl).username);
        await expect(
          a.runtime.query(
            "UPDATE gate_results SET outcome = 'warn' WHERE gate_result_id = $1::uuid",
            [RESULT_IDS[0]],
          ),
        ).rejects.toThrow();
        await expect(
          a.runtime.query(
            "DELETE FROM gate_results WHERE gate_result_id = $1::uuid",
            [RESULT_IDS[0]],
          ),
        ).rejects.toThrow();
        expect(await matching(a, [expectedRow(0)])).toBe(1);
        await verify(a, {}, AFTER_GATE);
      },
      T,
    );

    it(
      "GI16 the 62 loaded gate rows (31 of the host attempt and 31 of the second attempt) still equal the fixture rows by id and every column; the counted doors of the file",
      async () => {
        const a = await database("A", "t4");
        const loaded = (TABLES.gate_results ?? []).map((row) => ({
          gate_result_id: row.gate_result_id,
          gate_definition_id: row.gate_definition_id,
          attempt_id: row.attempt_id,
          input_fingerprint: row.input_fingerprint,
          outcome: row.outcome,
          result: row.result,
          created_at: row.created_at,
        }));
        expect(loaded).toHaveLength(62);
        expect(await matching(a, loaded)).toBe(62);
        // the counted doors, asserted literally (derived arithmetic, not a measurement campaign)
        expect(LEDGER.runs).toBe(26);
        expect(LEDGER.databases).toBe(8);
        expect(LEDGER.queries).toBe(4719);
      },
      T,
    );
  },
);
