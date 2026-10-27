// Native source proposal: never a mock admission or an expected receipt installer.
// The connected host exports below are completed with the reviewed atomic owner path.
// This file is held with that implementation; it has not been imported or executed.
import pg from "pg";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import {
  closeSync,
  constants,
  fsyncSync,
  openSync,
  writeFileSync,
  readFileSync,
  renameSync,
  mkdirSync,
  rmdirSync,
  unlinkSync,
  symlinkSync,
  existsSync,
} from "node:fs";
import * as claimsOwner from "../../src/runtime/claims-writing-gate.js";
import { readFile } from "node:fs/promises";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { migrate } from "../../src/db/migrations.js";
import { canonicalJson, sha256 } from "../../src/identity/canonical-json.js";
import {
  persistEvidencePackage,
  persistConnectedFixture105Package,
  type AuthoredPackage,
} from "../../src/runtime/package.js";
import * as packageOwner from "../../src/runtime/package.js";
import { admissionOf } from "../../src/runtime/performance-direction.js";
import { connectedFixture151ArtifactHash as connectedFixture105ArtifactHash } from "../../src/identity/artifacts.js";
import {
  CommandConnectionError,
  faultPoint,
  type Json,
} from "../../src/runtime/command.js";
import {
  connectedFixture105Data,
  validateConnectedFixture105ExecutionRoot,
  connectedFixture105SuiteEvidence,
  connectedFixture105CleanupDiagnostics,
  takeConnectedFixture105PackageBorrow,
  ConnectedFixture105ClaimsFailure,
  runConnectedFixture105 as runObservedConnectedFixture105,
  reconcileConnectedFixture105,
} from "../../src/runtime/connected-fixture105.js";
import type { DbEnv } from "../support/db-env.js";
import { createMigrationPool, createRuntimePool } from "../../src/db/pool.js";

const bootstrapUrl = process.env.TEST_DATABASE_URL;
const suite = bootstrapUrl === undefined ? describe.skip : describe;
const LIMIT = 120000;
const HOOK = Symbol.for("the-desk.a5.test-fault-hook");
const environmentKeys = [
  "DESK_ENV",
  "DATABASE_URL",
  "PROVIDERS_ENABLED",
  "DEPLOYED_COMMIT",
  "DESK_TEST_FAULTS",
] as const;
const saved = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]]),
);
type Obj = Record<string, unknown>;
const cleanupFailures = new WeakMap<object, readonly unknown[]>();
function retainTestCleanup(primary: unknown, cleanup: unknown): unknown {
  if (typeof primary === "object" && primary !== null) {
    cleanupFailures.set(primary, [
      ...(cleanupFailures.get(primary) ?? []),
      cleanup,
    ]);
    return primary;
  }
  return new AggregateError(
    [primary, cleanup],
    "test primary and cleanup failed",
  );
}
async function withTestCleanup<T>(
  work: () => Promise<T>,
  cleanup: () => Promise<void>,
): Promise<T> {
  let outcome: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    outcome = { ok: true, value: await work() };
  } catch (error) {
    outcome = { ok: false, error };
  }
  try {
    await cleanup();
  } catch (error) {
    if (!outcome.ok) throw retainTestCleanup(outcome.error, error);
    throw error;
  }
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}
// Capture the installed driver's own descriptor before a prototype fault wrapper.
// These witnesses use the text/values promise overload only; receiver stays explicit.
function requireClaimsFailure(
  value: unknown,
): ConnectedFixture105ClaimsFailure {
  if (!(value instanceof ConnectedFixture105ClaimsFailure))
    throw new Error("actual failure not reached");
  return value;
}
function driverQuery(
  descriptor: PropertyDescriptor,
): (
  this: pg.Client,
  text: string,
  values?: unknown[],
) => Promise<pg.QueryResult<Obj>> {
  const value: unknown = descriptor.value;
  if (typeof value !== "function") throw new Error("driver method unavailable");
  return value as (
    this: pg.Client,
    text: string,
    values?: unknown[],
  ) => Promise<pg.QueryResult<Obj>>;
}

// pg-pool attaches release when a Client is checked out; prototype hooks also see plain Clients.
function isCheckedOutClient(
  client: pg.Client,
): client is pg.Client & Pick<pg.PoolClient, "release"> {
  return "release" in client && typeof client.release === "function";
}

type ExpectedInvocation =
  | "completed"
  | "expected_refusal"
  | "expected_construction_unknown"
  | "expected_later_phase_unknown"
  | "pre_target_failure";
const CASE_EXPECTATIONS: readonly {
  case_id: string;
  expected: readonly ExpectedInvocation[];
}[] = [
  {
    case_id:
      "records actual18+7 results, one direction and a labelled audit with retained semantic gaps",
    expected: ["completed"],
  },
  {
    case_id:
      "keeps actual fixture output outside genuine admission and rejects render audit promotion",
    expected: ["completed"],
  },
  {
    case_id: "converges by exact readback without producing a second direction",
    expected: ["completed"],
  },
  {
    case_id:
      "refuses a preseeded source population without constructing an observation",
    expected: [
      "expected_refusal",
      "expected_refusal",
      "expected_refusal",
      "expected_refusal",
    ],
  },
  {
    case_id: "rolls back the package when the later observation insert fails",
    expected: ["expected_refusal"],
  },
  {
    case_id: "refuses context change between settled acquisition and consumer",
    expected: ["expected_refusal"],
  },
  {
    case_id:
      "rolls back every Performance row after a late gate insert failure",
    expected: ["expected_refusal"],
  },
  {
    case_id:
      "retains durable direction if the separate audit transaction fails",
    expected: ["expected_refusal"],
  },
  {
    case_id: "refuses an extra governed intent during re-entry",
    expected: ["completed"],
  },
  {
    case_id:
      "preserves package preflight refusal without a connection checkout",
    expected: [],
  },
  {
    case_id:
      "preserves the old package creation and governed-hash reuse outcomes",
    expected: [],
  },
  {
    case_id:
      "preserves orphan completion as distinguishable from genuinely fresh creation",
    expected: [],
  },
  {
    case_id:
      "refuses unregistered structural objects including a caller transaction at the package borrower",
    expected: [],
  },
  {
    case_id:
      "associates a genuine package capability only with its owner transaction",
    expected: ["expected_refusal"],
  },
  {
    case_id:
      "refuses an appended event between settled acquisition and consumption",
    expected: ["expected_refusal"],
  },
  {
    case_id: "refuses production context before a database checkout",
    expected: ["pre_target_failure"],
  },
  {
    case_id:
      "rejects a second live borrow, a clone, and a stale genuine capability",
    expected: ["expected_refusal"],
  },
  {
    case_id:
      "rejects live capability consumption after originating context changes",
    expected: ["expected_refusal", "expected_refusal", "expected_refusal"],
  },
  {
    case_id:
      "holds a lost direction COMMIT acknowledgement and reconciles without replay",
    expected: ["expected_later_phase_unknown"],
  },
  {
    case_id:
      "rolls back package creation when a foreign observation identity wins late",
    expected: ["expected_refusal"],
  },
  {
    case_id:
      "refuses a stale extra gate fingerprint without changing durable rows",
    expected: ["completed"],
  },
  {
    case_id:
      "holds unknown construction commit without inventing its missing settlement receipt",
    expected: [
      "expected_construction_unknown",
      "expected_construction_unknown",
      "expected_construction_unknown",
      "expected_later_phase_unknown",
    ],
  },
  {
    case_id:
      "retains event-first reader identity across distinct query and rollback errors",
    expected: ["pre_target_failure"],
  },
  {
    case_id:
      "retains query-first reader identity across distinct later client and rollback errors",
    expected: ["pre_target_failure"],
  },
  {
    case_id:
      "retains reader listener when release throws before driver handoff without retry",
    expected: ["pre_target_failure"],
  },
  {
    case_id:
      "closes continuation when the acquisition-cut await throws before consumption",
    expected: ["expected_refusal", "pre_target_failure"],
  },
  {
    case_id:
      "tracks and cleans a database allocation that fails before create returns",
    expected: [],
  },
  {
    case_id: "tracks a setup pool before roles SQL or migration can fail",
    expected: [],
  },
  {
    case_id: "tracks bootstrap role allocation before bootstrap returns",
    expected: [],
  },
  {
    case_id:
      "retains full actual failed Claims coverage and findings in a private failure receipt",
    expected: ["expected_refusal"],
  },
  {
    case_id: "memoizes a first setup pool-end failure without another end call",
    expected: [],
  },
  {
    case_id:
      "preserves the old package four-round reconciliation bound under named-conflict delivery",
    expected: [],
  },
  {
    case_id:
      "preserves an unrelated package failure object and releases its transaction",
    expected: [],
  },
];
interface HarnessCase {
  case_id: string;
  expected: readonly ExpectedInvocation[];
  completed: boolean;
  calls: HarnessCall[];
}
interface HarnessCall {
  ordinal: number;
  expected: ExpectedInvocation;
  completed: boolean;
  returned: boolean;
  target_hash: string | null;
  pre_target_index: number | null;
}
const harnessCases: HarnessCase[] = [];
let activeCase: HarnessCase | undefined;
let harnessCleanupFailed = false;
function caseBody(
  name: string,
  body: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    const declared = CASE_EXPECTATIONS.find((row) => row.case_id === name);
    if (
      declared === undefined ||
      activeCase !== undefined ||
      harnessCases.some((row) => row.case_id === name)
    )
      throw new Error("fixture harness case identity");
    const row: HarnessCase = {
      case_id: name,
      expected: declared.expected,
      completed: false,
      calls: [],
    };
    harnessCases.push(row);
    activeCase = row;
    try {
      await body();
      expect(row.calls.length).toBe(row.expected.length);
      expect(row.calls.every((call) => call.completed)).toBe(true);
      row.completed = true;
    } finally {
      activeCase = undefined;
    }
  };
}
function observedLists(): { targets: Obj[]; pre_target_failures: unknown[] } {
  const data = connectedFixture105SuiteEvidence();
  if (!Array.isArray(data.targets) || !Array.isArray(data.pre_target_failures))
    throw new Error("fixture observed shape");
  return {
    targets: data.targets as Obj[],
    pre_target_failures: data.pre_target_failures,
  };
}
async function runConnectedFixture105(): ReturnType<
  typeof runObservedConnectedFixture105
> {
  const owner = activeCase;
  if (owner === undefined)
    throw new Error("fixture invocation outside registered case");
  const expected = owner.expected[owner.calls.length];
  if (expected === undefined) throw new Error("fixture unexpected invocation");
  const before = observedLists();
  const call: HarnessCall = {
    ordinal: owner.calls.length,
    expected,
    completed: false,
    returned: false,
    target_hash: null,
    pre_target_index: null,
  };
  owner.calls.push(call); // Before host opening or any allocation; expectation is never inferred from the error.
  return withTestCleanup(
    async () => {
      const value = await runObservedConnectedFixture105();
      call.returned = true;
      return value;
    },
    () => {
      const after = observedLists();
      const targets = after.targets.slice(before.targets.length);
      const failures =
        after.pre_target_failures.length - before.pre_target_failures.length;
      expect(targets.length + failures).toBe(1);
      if (targets.length === 1) {
        const target = targets[0];
        if (target === undefined || typeof target.target_hash !== "string")
          throw new Error("fixture target identity");
        call.target_hash = target.target_hash;
        const observed =
          target.later_outcome === "completed"
            ? "completed"
            : target.later_outcome === "refused"
              ? "expected_refusal"
              : target.construction_state === "construction_unknown"
                ? "expected_construction_unknown"
                : "expected_later_phase_unknown";
        expect(observed).toBe(expected);
        const root = validateConnectedFixture105ExecutionRoot();
        const intentPath = join(
          root,
          "expectations",
          target.target_hash + ".intent.json",
        );
        const terminalPath = join(
          root,
          "expectations",
          target.target_hash + ".terminal.json",
        );
        expect(existsSync(intentPath)).toBe(true);
        if (expected === "expected_construction_unknown") {
          expect(existsSync(terminalPath)).toBe(false);
          expect(existsSync(join(root, "receipts", target.target_hash))).toBe(
            false,
          );
        } else {
          const terminal = JSON.parse(
            readFileSync(terminalPath, "utf8"),
          ) as Obj;
          expect(terminal.state).toBe(target.construction_state);
          expect(terminal.intent_sha256).toBe(sha256(readFileSync(intentPath)));
          if (expected === "expected_later_phase_unknown")
            expect(terminal.state).toBe("construction_recorded");
        }
      } else {
        call.pre_target_index = before.pre_target_failures.length;
        expect(expected).toBe("pre_target_failure");
      }
      expect(call.returned).toBe(expected === "completed");
      call.completed = true;
      return Promise.resolve();
    },
  );
}

interface FixtureAllocation {
  name: string;
  pools: pg.Pool[];
  allocated: boolean;
  settle?: Promise<void>;
  close?: Promise<void>;
}

// Suite-local allocation ledger: register intent BEFORE every allocation/await.
// Shared TestCluster and production pool owners remain unchanged.
class TrackedFixtureCluster {
  readonly admin: pg.Pool;
  readonly names: string[] = [];
  readonly logins: string[] = [];
  private readonly roleAllocations: { name: string; allocated: boolean }[] = [];
  private readonly token = randomBytes(4).toString("hex");
  private readonly password = randomBytes(24).toString("hex");
  private readonly allocations: FixtureAllocation[] = [];
  private readonly ending = new Map<pg.Pool, Promise<void>>();
  private shutdownResult: Promise<void> | undefined;
  constructor(private readonly url: string) {
    this.admin = new pg.Pool({
      connectionString: url,
      max: 2,
      connectionTimeoutMillis: 10000,
      query_timeout: 20000,
    });
  }
  private end(pool: pg.Pool): Promise<void> {
    const prior = this.ending.get(pool);
    if (prior !== undefined) return prior;
    // Store the promise before calling end; synchronous and async failures persist.
    const result = Promise.resolve().then(() => pool.end());
    this.ending.set(pool, result);
    return result;
  }
  private async retainFailures(
    actions: readonly Promise<unknown>[],
  ): Promise<void> {
    const results = await Promise.allSettled(actions);
    const errors = results.flatMap((result) =>
      result.status === "rejected" ? [result.reason as unknown] : [],
    );
    if (errors.length !== 0)
      throw new AggregateError(errors, "fixture allocation cleanup failed");
  }
  private urlFor(name: string, login?: string): string {
    const url = new URL(this.url);
    url.pathname = `/${name}`;
    if (login !== undefined) {
      url.username = login;
      url.password = this.password;
    }
    return url.toString();
  }
  async bootstrap(): Promise<void> {
    const boot = await this.create({ migrate: false });
    for (const role of ["migrator", "runtime"] as const) {
      const login = `fl_${this.token}_${role}`;
      this.logins.push(login);
      const owned = { name: login, allocated: false };
      this.roleAllocations.push(owned);
      if (
        (
          await this.admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [
            login,
          ])
        ).rows.length !== 0
      )
        throw new Error("owned role collision");
      owned.allocated = true;
      await this.admin.query(
        `CREATE ROLE ${login} LOGIN NOINHERIT PASSWORD '${this.password}'`,
      );
      await faultPoint("fixture105_test_after_role_create");
      await this.admin.query(`GRANT desk_${role} TO ${login}`);
    }
    await boot.close();
  }
  async create(_options: { migrate: boolean }): Promise<DbEnv> {
    if (_options.migrate) throw new Error("fixed fixture setup only");
    const name = `fl_${this.token}_${String(this.allocations.length + 1)}`;
    const row: FixtureAllocation = { name, pools: [], allocated: false };
    this.allocations.push(row);
    this.names.push(name);
    if (
      (
        await this.admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [
          name,
        ])
      ).rows.length !== 0
    )
      throw new Error("owned database collision");
    row.allocated = true; // A possibly committed CREATE is reconciled by this exact owned name.
    await this.admin.query(`CREATE DATABASE "${name}" TEMPLATE template0`);
    await faultPoint("fixture105_test_after_database_create");
    const owner = new pg.Pool({
      connectionString: this.urlFor(name),
      max: 2,
      connectionTimeoutMillis: 10000,
      query_timeout: 20000,
    });
    row.pools.push(owner);
    await faultPoint("fixture105_test_after_setup_pool");
    await owner.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await owner.query(await readFile("migrations/roles.sql", "utf8"));
    const migratorUrl = this.urlFor(
      name,
      this.logins.find((login) => login.endsWith("_migrator")),
    );
    const runtimeUrl = this.urlFor(
      name,
      this.logins.find((login) => login.endsWith("_runtime")),
    );
    const migrator = createMigrationPool({
      MIGRATION_DATABASE_URL: migratorUrl,
    });
    row.pools.push(migrator);
    const runtime = createRuntimePool({ DATABASE_URL: runtimeUrl });
    row.pools.push(runtime);
    return {
      name,
      migratorUrl,
      runtimeUrl,
      owner,
      migrator,
      runtime,
      close: () => this.closeAllocation(row),
    };
  }
  async settle(name: string): Promise<void> {
    const row = this.allocations.find((entry) => entry.name === name);
    if (row === undefined) throw new Error("unowned allocation");
    row.settle ??= this.retainFailures(row.pools.map((pool) => this.end(pool)));
    return row.settle;
  }
  private closeAllocation(row: FixtureAllocation): Promise<void> {
    row.close ??= (async () => {
      const errors: unknown[] = [];
      try {
        await this.settle(row.name);
      } catch (error) {
        errors.push(error);
      }
      if (row.allocated) {
        try {
          const found = await this.admin.query<{ owned: boolean }>(
            "SELECT pg_get_userbyid(datdba)=current_user AS owned FROM pg_database WHERE datname=$1",
            [row.name],
          );
          if (found.rows.length !== 0) {
            if (found.rows.length !== 1 || found.rows[0]?.owned !== true)
              throw new Error("database ownership changed");
            await this.admin.query(`DROP DATABASE "${row.name}"`);
          }
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length !== 0)
        throw new AggregateError(errors, "fixture allocation close failed");
    })();
    return row.close;
  }
  async closePending(): Promise<void> {
    await this.retainFailures(
      this.allocations.map((row) => this.closeAllocation(row)),
    );
  }
  shutdown(): Promise<void> {
    this.shutdownResult ??= (async () => {
      const errors: unknown[] = [];
      try {
        await this.closePending();
      } catch (error) {
        errors.push(error);
      }
      for (const role of this.roleAllocations.filter((row) => row.allocated)) {
        try {
          await this.admin.query(`DROP ROLE IF EXISTS ${role.name}`);
        } catch (error) {
          errors.push(error);
        }
      }
      try {
        await this.end(this.admin);
      } catch (error) {
        errors.push(error);
      }
      if (errors.length !== 0)
        throw new AggregateError(errors, "fixture cluster shutdown failed");
    })();
    return this.shutdownResult;
  }
}

suite("connected fixture105 native ownership", () => {
  let cluster: TrackedFixtureCluster | undefined;
  let executionRoot: string | undefined;
  function requireCluster(): TrackedFixtureCluster {
    if (cluster === undefined) throw new Error("fixture cluster unavailable");
    return cluster;
  }
  let current: DbEnv | undefined;
  const isolatedClusters: TrackedFixtureCluster[] = [];

  beforeAll(async () => {
    if (bootstrapUrl === undefined)
      throw new Error("TEST_DATABASE_URL required");
    const savedBinding = process.env.DESK_FIXTURE105_BINDING;
    try {
      delete process.env.DESK_FIXTURE105_BINDING;
      expect(() => validateConnectedFixture105ExecutionRoot()).toThrow(
        "fixture_runner_binding_missing",
      );
      process.env.DESK_FIXTURE105_BINDING = JSON.stringify({
        root: process.env.TMPDIR,
        root_sha256: "0".repeat(64),
      });
      expect(() => validateConnectedFixture105ExecutionRoot()).toThrow();
    } finally {
      if (savedBinding === undefined)
        delete process.env.DESK_FIXTURE105_BINDING;
      else process.env.DESK_FIXTURE105_BINDING = savedBinding;
    }
    executionRoot = validateConnectedFixture105ExecutionRoot();
    // Valid-location binding failures must be caught before allocating any cluster.
    const adoptionPath = join(executionRoot, "bindings/ADOPTION.json");
    const adoptionBytes = readFileSync(adoptionPath);
    for (const variant of [
      "malformed",
      "oversize",
      "relation",
      "symlink",
    ] as const) {
      const savedPath = join(dirname(executionRoot), "adoption-witness.json");
      renameSync(adoptionPath, savedPath);
      try {
        if (variant === "symlink") symlinkSync(savedPath, adoptionPath);
        else
          writeFileSync(
            adoptionPath,
            variant === "malformed"
              ? "{"
              : variant === "oversize"
                ? "x".repeat(262145)
                : JSON.stringify({
                    ...(JSON.parse(adoptionBytes.toString("utf8")) as Obj),
                    release_sha256: "0".repeat(64),
                  }),
            { flag: "wx", mode: 0o600 },
          );
        expect(() => validateConnectedFixture105ExecutionRoot()).toThrow();
        expect(cluster).toBeUndefined();
      } finally {
        unlinkSync(adoptionPath);
        renameSync(savedPath, adoptionPath);
      }
    }
    expect(validateConnectedFixture105ExecutionRoot()).toBe(executionRoot);
    cluster = new TrackedFixtureCluster(bootstrapUrl);
    await cluster.bootstrap();
  }, LIMIT);

  type ConfigSeed = "exact" | "missing-config" | "changed-show" | "extra-show";
  async function fresh(seed: ConfigSeed = "exact"): Promise<DbEnv> {
    // Track before migration so setup failure still reaches independent teardown.
    if (cluster === undefined) throw new Error("fixture cluster not allocated");
    const env = await requireCluster().create({ migrate: false });
    current = env;
    await migrate(env.migrator);
    // Configuration belongs to the existing setup role; runtime privileges stay unchanged.
    const fixed = connectedFixture105Data();
    for (const table of ["shows", "show_config_versions"] as const) {
      const spec = fixed.sql.find((value) => value.table === table);
      if (spec === undefined)
        throw new Error("missing fixed configuration SQL map");
      const columns = spec.columns as Obj[];
      let rows = (fixed.tables[table] ?? []).map((row) => structuredClone(row));
      if (table === "show_config_versions" && seed === "missing-config")
        rows = [];
      if (table === "shows" && seed === "changed-show") {
        const first = rows[0];
        if (first === undefined) throw new Error("missing fixed show");
        first.title = "Changed fixture show";
      }
      if (table === "shows" && seed === "extra-show") {
        const first = rows[0];
        if (first === undefined) throw new Error("missing fixed show");
        rows.push({
          ...first,
          show_id: "00000000-0000-4000-8000-000000000001",
          slug: "foreign-fixture-show",
        });
      }
      for (const row of rows) {
        await env.migrator.query(
          `INSERT INTO ${table} (${columns.map((column) => String(column.column)).join(",")}) VALUES (${columns.map((column, index) => `$${String(index + 1)}${column.sql_type === "jsonb" ? "::jsonb" : ""}`).join(",")})`,
          columns.map((column) =>
            column.sql_type === "jsonb"
              ? canonicalJson(row[String(column.column)])
              : row[String(column.column)],
          ),
        );
      }
    }
    await requireCluster().settle(env.name); // One memoized outcome; no second pool.end.
    process.env.DESK_ENV = "test";
    process.env.DATABASE_URL = env.runtimeUrl;
    process.env.PROVIDERS_ENABLED = "false";
    process.env.DEPLOYED_COMMIT = "fixture105-native-source-validation";
    return env;
  }
  async function inspect<T>(
    env: DbEnv,
    work: (pool: pg.Pool) => Promise<T>,
  ): Promise<T> {
    const pool = new pg.Pool({
      connectionString: env.runtimeUrl,
      options: "-c role=desk_runtime",
      max: 1,
    });
    try {
      return await work(pool);
    } finally {
      await pool.end();
    }
  }
  async function counts(env: DbEnv): Promise<Obj> {
    return inspect(env, async (pool) => {
      const result = await pool.query<Obj>(`SELECT
        (SELECT count(*)::integer FROM evidence_packages) AS packages,
        (SELECT count(*)::integer FROM performance_direction_versions) AS directions,
        (SELECT count(*)::integer FROM performance_intents) AS intents,
        (SELECT count(*)::integer FROM gate_results) AS gates,
        (SELECT count(*)::integer FROM audit_runs) AS audits`);
      if (result.rows[0] === undefined) throw new Error("missing count row");
      return result.rows[0];
    });
  }
  async function constructionPopulation(
    env: DbEnv,
  ): Promise<Record<string, number>> {
    return inspect(env, async (pool) => {
      const result: Record<string, number> = {};
      for (const table of [
        "claims",
        "claim_state_events",
        "rights_versions",
        "claim_supports",
        "evidence_units",
        "derivation_runs",
        "evidence_packages",
        "artifacts",
      ])
        result[table] = Number(
          (
            await pool.query<{ n: string }>(
              `SELECT count(*) AS n FROM ${table}`,
            )
          ).rows[0]?.n,
        );
      return result;
    });
  }
  async function expectConstructionRollback(
    env: DbEnv,
    artifacts = 0,
  ): Promise<void> {
    expect(await constructionPopulation(env)).toEqual({
      claims: 0,
      claim_state_events: 0,
      rights_versions: 0,
      claim_supports: 0,
      evidence_units: 0,
      derivation_runs: 0,
      evidence_packages: 0,
      artifacts,
    });
  }
  async function expectNoPerformanceArtifacts(env: DbEnv): Promise<void> {
    await inspect(env, async (pool) => {
      expect(
        (
          await pool.query(
            "SELECT artifact_id FROM artifacts WHERE artifact_type IN ('performance_direction','fixture_operation','fixture_audit')",
          )
        ).rows,
      ).toEqual([]);
    });
  }
  function packageInput(): AuthoredPackage {
    const f = connectedFixture105Data();
    const ids = f.identities.ids as Obj;
    const row = f.tables.artifacts?.find(
      (value) => value.artifact_id === ids["package-artifact"],
    );
    if (row === undefined) throw new Error("missing package artifact");
    return {
      artifact_id: String(row.artifact_id),
      evidence_package_id: String(ids.package),
      schema_version: String(row.schema_version),
      canonical_payload: f.pkg as Json,
      storage_uri: null,
      byte_size: Number(row.byte_size),
      created_at: String(row.created_at),
    };
  }
  async function packagePrerequisites(
    env: DbEnv,
    orphan: boolean,
  ): Promise<void> {
    // Test-only fixed installer for legacy package parity. It does not mint a
    // construction observation, receipt or continuation for the connected host.
    const f = connectedFixture105Data();
    await inspect(env, async (pool) => {
      for (const table of [
        "accounts",
        "rights_versions",
        "evidence_units",
        "claims",
        "claim_state_events",
        "derivation_runs",
        "claim_supports",
      ]) {
        const spec = f.sql.find((value) => value.table === table);
        if (spec === undefined) throw new Error("missing SQL map");
        const columns = spec.columns as Obj[];
        for (const row of f.tables[table] ?? []) {
          await pool.query(
            `INSERT INTO ${table} (${columns.map((column) => String(column.column)).join(",")}) VALUES (${columns.map((column, index) => `$${String(index + 1)}${column.sql_type === "jsonb" ? "::jsonb" : ""}`).join(",")})`,
            columns.map((column) =>
              column.sql_type === "jsonb"
                ? canonicalJson(row[String(column.column)])
                : row[String(column.column)],
            ),
          );
        }
      }
      if (orphan) {
        const input = packageInput();
        await pool.query(
          "INSERT INTO artifacts (artifact_id,artifact_type,schema_version,content_hash,canonical_payload,storage_uri,byte_size,created_at) VALUES ($1,'evidence_package',$2,$3,$4::jsonb,NULL,$5,$6)",
          [
            input.artifact_id,
            input.schema_version,
            f.identities.package_hash,
            canonicalJson(input.canonical_payload),
            input.byte_size,
            input.created_at,
          ],
        );
      }
    });
  }
  async function fault<T>(
    point: string,
    effect: () => void | Promise<void>,
    work: () => Promise<T>,
  ): Promise<T> {
    const old = Object.getOwnPropertyDescriptor(globalThis, HOOK);
    const flag = process.env.DESK_TEST_FAULTS;
    let seen = 0;
    process.env.DESK_TEST_FAULTS = "1";
    Object.defineProperty(globalThis, HOOK, {
      configurable: true,
      value: async (name: string) => {
        if (name === point) {
          seen += 1;
          await effect();
        }
      },
    });
    try {
      return await work();
    } finally {
      if (old === undefined) Reflect.deleteProperty(globalThis, HOOK);
      else Object.defineProperty(globalThis, HOOK, old);
      if (flag === undefined) delete process.env.DESK_TEST_FAULTS;
      else process.env.DESK_TEST_FAULTS = flag;
      expect(seen).toBe(1); // A witness that never reaches its intended cut fails.
    }
  }
  afterEach(async () => {
    const env = current;
    current = undefined;
    try {
      if (env !== undefined) await env.close();
      await cluster?.closePending();
    } catch (error) {
      harnessCleanupFailed = true;
      throw error;
    } finally {
      for (const key of environmentKeys) {
        const value = saved[key];
        if (value === undefined) Reflect.deleteProperty(process.env, key);
        else process.env[key] = value;
      }
    }
  }, LIMIT);
  afterAll(async () => {
    const cleanup: unknown[] = [];
    try {
      await cluster?.shutdown();
    } catch (error) {
      cleanup.push(error);
    }
    if (cluster === undefined) {
      if (cleanup.length)
        throw new AggregateError(cleanup, "fixture cleanup failed");
      return;
    }
    const verifier = new pg.Pool({ connectionString: bootstrapUrl, max: 1 });
    try {
      const result = await verifier.query<Obj>(
        `SELECT
        (SELECT count(*)::integer FROM pg_database WHERE datname = ANY($1::text[])) AS databases,
        (SELECT count(*)::integer FROM pg_roles WHERE rolname = ANY($2::text[])) AS roles`,
        [
          [...cluster.names, ...isolatedClusters.flatMap((item) => item.names)],
          [
            ...cluster.logins,
            ...isolatedClusters.flatMap((item) => item.logins),
          ],
        ],
      );
      expect(result.rows).toEqual([{ databases: 0, roles: 0 }]);
    } catch (error) {
      cleanup.push(error);
    } finally {
      try {
        await verifier.end();
      } catch (error) {
        cleanup.push(error);
      }
    }
    if (executionRoot !== undefined) {
      try {
        expect(validateConnectedFixture105ExecutionRoot()).toBe(executionRoot);
        const evidence = join(dirname(dirname(executionRoot)), "evidence");
        const directory = openSync(
          evidence,
          constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
        );
        try {
          const descriptor = openSync(
            `/proc/self/fd/${String(directory)}/fixture105-suite.json`,
            constants.O_WRONLY |
              constants.O_CREAT |
              constants.O_EXCL |
              constants.O_NOFOLLOW,
            0o600,
          );
          try {
            writeFileSync(
              descriptor,
              canonicalJson({
                ...connectedFixture105SuiteEvidence(),
                cases: harnessCases,
                suite_complete:
                  cleanup.length === 0 &&
                  !harnessCleanupFailed &&
                  harnessCases.length === CASE_EXPECTATIONS.length &&
                  harnessCases.every(
                    (row) =>
                      row.completed &&
                      row.calls.length === row.expected.length &&
                      row.calls.every((call) => call.completed),
                  ),
              }) + "\n",
            );
            fsyncSync(descriptor);
          } finally {
            closeSync(descriptor);
          }
          fsyncSync(directory);
        } finally {
          closeSync(directory);
        }
      } catch (error) {
        cleanup.push(error);
      }
    }
    if (cleanup.length !== 0)
      throw new AggregateError(
        cleanup,
        "fixture cleanup and residual verification failed",
      );
  }, LIMIT);

  it(
    "records actual18+7 results, one direction and a labelled audit with retained semantic gaps",
    caseBody(
      "records actual18+7 results, one direction and a labelled audit with retained semantic gaps",
      async () => {
        const env = await fresh();
        await inspect(env, async (pool) => {
          const privileges = await pool.query(
            "SELECT has_table_privilege(current_user, 'show_config_versions', 'INSERT') AS current_insert, has_table_privilege(session_user, 'show_config_versions', 'INSERT') AS session_insert",
          );
          expect(privileges.rows).toEqual([
            { current_insert: false, session_insert: false },
          ]);
        });
        const result = await runConnectedFixture105();
        expect(result.status).toBe("created");
        expect(result.claims.rows).toHaveLength(18);
        expect(result.claims.aggregate).toBe("incomplete");
        const expectedLimits: unknown = expect.arrayContaining([
          expect.stringContaining("historical_visibility_unprovable"),
        ]);
        expect(result.claims.coverage).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: "H04",
              status: "not_established_required",
            }),
            expect.objectContaining({
              id: "H13",
              status: "not_established_required",
            }),
            expect.objectContaining({ id: "C13", limits: expectedLimits }),
          ]),
        );
        expect(result.performance.rows).toHaveLength(7);
        expect(
          result.performance.rows.every((row) => row.outcome === "pass"),
        ).toBe(true);
        expect(result.audit.kind).toBe("fixture_stub");
        expect(result.audit.semantic_acceptance).toBe("not_established");
        expect(await counts(env)).toEqual({
          packages: 1,
          directions: 1,
          intents: 1,
          gates: 25,
          audits: 1,
        });
        await inspect(env, async (pool) => {
          expect(
            (await pool.query("SELECT model_run_id FROM audit_runs")).rows,
          ).toEqual([{ model_run_id: null }]);
          expect(
            (await pool.query("SELECT state FROM program_run_attempts")).rows,
          ).toEqual([{ state: "PENDING" }]);
        });
      },
    ),
    LIMIT,
  );
  it(
    "keeps actual fixture output outside genuine admission and rejects render audit promotion",
    caseBody(
      "keeps actual fixture output outside genuine admission and rejects render audit promotion",
      async () => {
        const env = await fresh();
        const result = await runConnectedFixture105();
        const before = await counts(env);
        const refusal = admissionOf(
          { kind: "state", gate: 18, texture: 4 },
          result.claims.aggregate,
        );
        expect(refusal).toMatchObject({
          kind: "refused",
          code: "perf_upstream_gate_incomplete",
          writes_attempted: 0,
        });
        expect(() =>
          connectedFixture105ArtifactHash("audit", {
            ...result.audit,
            semantic_acceptance: "accepted",
          }),
        ).toThrow();
        expect(() =>
          connectedFixture105ArtifactHash("audit", {
            ...result.audit,
            render_allowed: true,
          }),
        ).toThrow();
        expect(() =>
          connectedFixture105ArtifactHash("audit", {
            ...result.audit,
            attempt_state: "READY",
          }),
        ).toThrow();
        await inspect(env, async (pool) => {
          expect(
            (
              await pool.query(
                "SELECT render_manifest_id FROM render_manifests",
              )
            ).rows,
          ).toEqual([]);
          expect(
            (await pool.query("SELECT model_run_id FROM model_runs")).rows,
          ).toEqual([]);
          expect(
            (await pool.query("SELECT state FROM program_run_attempts")).rows,
          ).toEqual([{ state: "PENDING" }]);
        });
        expect(await counts(env)).toEqual(before);
        // Schema/admission calls and absence of effects, not a nonexistent Render API.
      },
    ),
    LIMIT,
  );
  it(
    "converges by exact readback without producing a second direction",
    caseBody(
      "converges by exact readback without producing a second direction",
      async () => {
        const env = await fresh();
        const first = await runConnectedFixture105();
        const before = await counts(env);
        const second = await reconcileConnectedFixture105();
        expect(second.status).toBe("reconciled");
        expect(second.operation_id).toBe(first.operation_id);
        expect(second.operation_sha256).toBe(first.operation_sha256);
        expect(await counts(env)).toEqual(before);
      },
    ),
    LIMIT,
  );
  it(
    "refuses a preseeded source population without constructing an observation",
    caseBody(
      "refuses a preseeded source population without constructing an observation",
      async () => {
        for (const variant of [
          "foreign-claim",
          "missing-config",
          "changed-show",
          "extra-show",
        ] as const) {
          const env = await fresh(
            variant === "foreign-claim" ? "exact" : variant,
          );
          try {
            if (variant === "foreign-claim")
              await inspect(env, async (pool) => {
                const row = connectedFixture105Data().tables.claims?.[0];
                if (row === undefined) throw new Error("missing fixed claim");
                await pool.query(
                  "INSERT INTO claims (claim_id,content_hash,claim_kind,origin,subject_domain,subject,predicate,value,initial_status,initial_usage_class,asserted_at,supersedes_claim_id,created_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9,$10,$11,$12,$13)",
                  [
                    row.claim_id,
                    row.content_hash,
                    row.claim_kind,
                    row.origin,
                    row.subject_domain,
                    JSON.stringify(row.subject),
                    row.predicate,
                    JSON.stringify(row.value),
                    row.initial_status,
                    row.initial_usage_class,
                    row.asserted_at,
                    row.supersedes_claim_id,
                    row.created_at,
                  ],
                );
              });
            await expect(runConnectedFixture105()).rejects.toThrow(
              "fixture_initial_population",
            );
            expect(await counts(env)).toEqual({
              packages: 0,
              directions: 0,
              intents: 0,
              gates: 0,
              audits: 0,
            });
          } finally {
            await env.close();
            current = undefined;
          }
        }
      },
    ),
    LIMIT,
  );
  it(
    "rolls back the package when the later observation insert fails",
    caseBody(
      "rolls back the package when the later observation insert fails",
      async () => {
        const env = await fresh();
        await fault(
          "fixture105_after_package_before_observation",
          () => {
            throw new Error("native observation cut");
          },
          async () => {
            await expect(runConnectedFixture105()).rejects.toThrow(
              "native observation cut",
            );
          },
        );
        await expectConstructionRollback(env);
        expect(await counts(env)).toEqual({
          packages: 0,
          directions: 0,
          intents: 0,
          gates: 0,
          audits: 0,
        });
      },
    ),
    LIMIT,
  );
  it(
    "refuses context change between settled acquisition and consumer",
    caseBody(
      "refuses context change between settled acquisition and consumer",
      async () => {
        const env = await fresh();
        await fault(
          "fixture105_after_acquisition",
          () => {
            process.env.DESK_ENV = "staging";
          },
          async () => {
            await expect(runConnectedFixture105()).rejects.toThrow(
              "fixture_context_changed",
            );
          },
        );
        expect((await counts(env)).directions).toBe(0);
      },
    ),
    LIMIT,
  );
  it(
    "rolls back every Performance row after a late gate insert failure",
    caseBody(
      "rolls back every Performance row after a late gate insert failure",
      async () => {
        const env = await fresh();
        await fault(
          "fixture105_after_performance_rows",
          () => {
            throw new Error("native direction cut");
          },
          async () => {
            await expect(runConnectedFixture105()).rejects.toThrow(
              "native direction cut",
            );
          },
        );
        expect(await counts(env)).toEqual({
          packages: 1,
          directions: 0,
          intents: 0,
          gates: 18,
          audits: 0,
        });
        await expectNoPerformanceArtifacts(env);
      },
    ),
    LIMIT,
  );
  it(
    "retains durable direction if the separate audit transaction fails",
    caseBody(
      "retains durable direction if the separate audit transaction fails",
      async () => {
        const env = await fresh();
        await fault(
          "fixture105_before_audit_commit",
          () => {
            throw new Error("native audit cut");
          },
          async () => {
            await expect(runConnectedFixture105()).rejects.toThrow(
              "native audit cut",
            );
          },
        );
        expect(await counts(env)).toEqual({
          packages: 1,
          directions: 1,
          intents: 1,
          gates: 25,
          audits: 0,
        });
        const reconciled = await reconcileConnectedFixture105();
        expect(reconciled.status).toBe("direction_durable_audit_absent");
        expect(reconciled.audit).toBeNull();
        expect(await counts(env)).toEqual({
          packages: 1,
          directions: 1,
          intents: 1,
          gates: 25,
          audits: 0,
        });
      },
    ),
    LIMIT,
  );
  it(
    "refuses an extra governed intent during re-entry",
    caseBody("refuses an extra governed intent during re-entry", async () => {
      const env = await fresh();
      await runConnectedFixture105();
      await inspect(env, async (pool) => {
        await pool.query(
          "INSERT INTO performance_intents (performance_intent_id,performance_direction_version_id,turn_id,intent) SELECT 'ed66aeb2-92b7-437b-b91c-8d01e0a5e71a',performance_direction_version_id,turn_id,intent FROM performance_intents WHERE performance_intent_id = $1",
          [connectedFixture105Data().identities.intent],
        );
      });
      const before = await counts(env);
      await expect(reconcileConnectedFixture105()).rejects.toThrow(
        "fixture_owned_conflict",
      );
      expect(canonicalJson(await counts(env))).toBe(canonicalJson(before));
    }),
    LIMIT,
  );
  it(
    "preserves package preflight refusal without a connection checkout",
    caseBody(
      "preserves package preflight refusal without a connection checkout",
      async () => {
        const env = await fresh();
        await inspect(env, async (pool) => {
          const result = await persistEvidencePackage(pool, {
            ...packageInput(),
            artifact_id: "not-a-uuid",
          });
          expect(result.kind).toBe("rejected");
          expect(pool.totalCount).toBe(0);
        });
      },
    ),
    LIMIT,
  );
  it(
    "preserves the old package creation and governed-hash reuse outcomes",
    caseBody(
      "preserves the old package creation and governed-hash reuse outcomes",
      async () => {
        const env = await fresh();
        await packagePrerequisites(env, false);
        await inspect(env, async (pool) => {
          const input = packageInput();
          const first = await persistEvidencePackage(pool, input);
          expect(first.kind).toBe("created");
          if (first.kind !== "created") throw new Error("creation failed");
          expect(first.record.reused).toBe(false);
          expect(first.record.completed_existing_artifact).toBe(false);
          const repeated = await persistEvidencePackage(pool, input);
          expect(repeated.kind).toBe("converged");
          if (repeated.kind !== "converged") throw new Error("reuse failed");
          expect(repeated.record.reused).toBe(true);
          expect(pool.waitingCount).toBe(0);
          expect(pool.idleCount).toBe(pool.totalCount);
        });
      },
    ),
    LIMIT,
  );
  it(
    "preserves orphan completion as distinguishable from genuinely fresh creation",
    caseBody(
      "preserves orphan completion as distinguishable from genuinely fresh creation",
      async () => {
        const env = await fresh();
        await packagePrerequisites(env, true);
        await inspect(env, async (pool) => {
          const result = await persistEvidencePackage(pool, packageInput());
          expect(result.kind).toBe("created");
          if (result.kind !== "created") throw new Error("completion failed");
          expect(result.record.completed_existing_artifact).toBe(true);
          expect(result.record.reused).toBe(false);
        });
      },
    ),
    LIMIT,
  );
  it(
    "refuses unregistered structural objects including a caller transaction at the package borrower",
    caseBody(
      "refuses unregistered structural objects including a caller transaction at the package borrower",
      async () => {
        const env = await fresh();
        await inspect(env, async (pool) => {
          const client = await pool.connect();
          try {
            await expect(persistConnectedFixture105Package({})).rejects.toThrow(
              "fixture_package_capability",
            );
            await expect(
              persistConnectedFixture105Package({
                tx: client,
                live: true,
                taken: false,
              }),
            ).rejects.toThrow("fixture_package_capability");
          } finally {
            client.release();
          }
        });
        expect(await counts(env)).toEqual({
          packages: 0,
          directions: 0,
          intents: 0,
          gates: 0,
          audits: 0,
        });
      },
    ),
    LIMIT,
  );
  it(
    "associates a genuine package capability only with its owner transaction",
    caseBody(
      "associates a genuine package capability only with its owner transaction",
      async () => {
        const env = await fresh();
        const original = packageOwner.persistConnectedFixture105Package;
        let reached = 0;
        const stop = new Error("association observed; rollback requested");
        const observer = vi
          .spyOn(packageOwner, "persistConnectedFixture105Package")
          .mockImplementation(async (capability) => {
            reached++;
            const borrowed = takeConnectedFixture105PackageBorrow(capability);
            // The public call has one capability argument, no caller-selected Tx slot.
            const arity: Parameters<
              typeof persistConnectedFixture105Package
            >["length"] = 1;
            expect(arity).toBe(1);
            const owned = (
              await borrowed.tx.query(
                "SELECT txid_current()::text AS txid,current_database() AS database",
              )
            ).rows[0];
            if (owned === undefined)
              throw new Error("owner transaction unavailable");
            await inspect(env, async (pool) => {
              const foreign = (
                await pool.query(
                  "SELECT txid_current()::text AS txid,current_database() AS database",
                )
              ).rows[0] as { txid: string; database: string } | undefined;
              if (foreign === undefined)
                throw new Error("foreign transaction unavailable");
              expect(owned.database).toBe(foreign.database);
              expect(owned.txid).not.toBe(foreign.txid);
            });
            expect(borrowed.pkg.evidence_package_id).toBe(
              (connectedFixture105Data().identities.ids as Obj).package,
            );
            await expect(original({ tx: borrowed.tx })).rejects.toThrow(
              "fixture_package_capability",
            );
            throw stop;
          });
        try {
          await expect(runConnectedFixture105()).rejects.toBe(stop);
        } finally {
          observer.mockRestore();
        }
        expect(reached).toBe(1);
        await expectConstructionRollback(env);
      },
    ),
    LIMIT,
  );
  it(
    "refuses an appended event between settled acquisition and consumption",
    caseBody(
      "refuses an appended event between settled acquisition and consumption",
      async () => {
        const env = await fresh();
        await fault(
          "fixture105_after_acquisition",
          async () => {
            const row =
              connectedFixture105Data().tables.claim_state_events?.[0];
            if (row === undefined) throw new Error("missing event");
            await inspect(env, async (pool) => {
              await pool.query(
                "INSERT INTO claim_state_events (claim_state_event_id,claim_id,actor_id,occurred_at,event_type,event_sequence,event_payload) VALUES ('36f7441e-7bdd-49b6-96b2-9152ac67f425',$1,$2,$3,$4,2,$5::jsonb)",
                [
                  row.claim_id,
                  row.actor_id,
                  row.occurred_at,
                  row.event_type,
                  canonicalJson(row.event_payload),
                ],
              );
            });
          },
          async () => {
            await expect(runConnectedFixture105()).rejects.toThrow(
              "fixture_row_population",
            );
          },
        );
        expect((await counts(env)).directions).toBe(0);
      },
    ),
    LIMIT,
  );
  it(
    "refuses production context before a database checkout",
    caseBody(
      "refuses production context before a database checkout",
      async () => {
        const env = await fresh();
        process.env.DESK_ENV = "production";
        await expect(runConnectedFixture105()).rejects.toThrow(
          "fixture_runtime_context",
        );
        expect(await counts(env)).toEqual({
          packages: 0,
          directions: 0,
          intents: 0,
          gates: 0,
          audits: 0,
        });
      },
    ),
    LIMIT,
  );
  it(
    "rejects a second live borrow, a clone, and a stale genuine capability",
    caseBody(
      "rejects a second live borrow, a clone, and a stale genuine capability",
      async () => {
        const env = await fresh();
        const original = packageOwner.persistConnectedFixture105Package;
        let captured: object | undefined;
        let calls = 0;
        const observer = vi
          .spyOn(packageOwner, "persistConnectedFixture105Package")
          .mockImplementation(async (capability) => {
            calls += 1;
            captured = capability;
            const outcome = await original(capability); // Real owner; no substituted result.
            await expect(original(capability)).rejects.toThrow(
              "fixture_package_capability",
            );
            await expect(original(structuredClone(capability))).rejects.toThrow(
              "fixture_package_capability",
            );
            return outcome;
          });
        try {
          await expect(runConnectedFixture105()).rejects.toThrow(
            "fixture_host_closed",
          );
        } finally {
          observer.mockRestore();
        }
        await expectConstructionRollback(env);
        expect(calls).toBe(1);
        if (captured === undefined)
          throw new Error("real borrower not reached");
        await expect(original(captured)).rejects.toThrow(
          "fixture_package_capability",
        );
      },
    ),
    LIMIT,
  );
  it(
    "rejects live capability consumption after originating context changes",
    caseBody(
      "rejects live capability consumption after originating context changes",
      async () => {
        for (const variant of ["context", "marker", "root"] as const) {
          const env = await fresh();
          const original = packageOwner.persistConnectedFixture105Package;
          let reached = false;
          if (executionRoot === undefined) throw new Error("root missing");
          const rootPath = executionRoot;
          const marker = join(rootPath, "ROOT.json");
          const bytes = readFileSync(marker);
          const moved = rootPath + "-witness";
          const observer = vi
            .spyOn(packageOwner, "persistConnectedFixture105Package")
            .mockImplementation(async (capability) => {
              reached = true;
              const pending = original(capability);
              if (variant === "context") {
                const changed = new URL(env.runtimeUrl);
                changed.pathname = "/foreign_fixture_target";
                process.env.DATABASE_URL = changed.toString();
              } else if (variant === "marker")
                writeFileSync(
                  marker,
                  Buffer.concat([bytes, Buffer.from("\n")]),
                );
              else {
                renameSync(rootPath, moved);
                mkdirSync(rootPath, { mode: 0o700 });
              }
              try {
                await expect(pending).rejects.toThrow();
              } finally {
                if (variant === "context")
                  process.env.DATABASE_URL = env.runtimeUrl;
                else if (variant === "marker") writeFileSync(marker, bytes);
                else {
                  rmdirSync(rootPath);
                  renameSync(moved, rootPath);
                }
              }
              expect(validateConnectedFixture105ExecutionRoot()).toBe(rootPath);
              await expect(original(capability)).rejects.toThrow(
                "fixture_package_capability",
              );
              return original(capability); // Restoration cannot revive the recognized token/host.
            });
          try {
            await expect(runConnectedFixture105()).rejects.toThrow(
              "fixture_package_capability",
            );
            expect(reached).toBe(true);
            await expectConstructionRollback(env);
            expect(await counts(env)).toEqual({
              packages: 0,
              directions: 0,
              intents: 0,
              gates: 0,
              audits: 0,
            });
          } finally {
            observer.mockRestore();
            await env.close();
            current = undefined;
          }
        }
      },
    ),
    LIMIT,
  );
  it(
    "holds a lost direction COMMIT acknowledgement and reconciles without replay",
    caseBody(
      "holds a lost direction COMMIT acknowledgement and reconciles without replay",
      async () => {
        const env = await fresh();
        let armed = false;
        let intercepted = 0;
        const descriptor = Object.getOwnPropertyDescriptor(
          pg.Client.prototype,
          "query",
        );
        if (descriptor === undefined)
          throw new Error("driver method unavailable");
        // Real native COMMIT happens first. Only its delivery to runCommand is lost;
        // no success row or command outcome is substituted by this transport witness.
        const original = driverQuery(descriptor);
        Object.defineProperty(pg.Client.prototype, "query", {
          ...descriptor,
          value: async function (
            this: pg.Client,
            text: string,
            values?: unknown[],
          ): Promise<pg.QueryResult> {
            const result = await original.call(this, text, values);
            if (armed && text === "COMMIT") {
              armed = false;
              intercepted += 1;
              const loss = new Error("fixture transport lost acknowledgement");
              this.emit("error", loss);
              throw loss;
            }
            return result;
          },
        });
        try {
          await fault(
            "fixture105_after_performance_rows",
            () => {
              armed = true;
            },
            async () => {
              try {
                await runConnectedFixture105();
                throw new Error("expected unknown commit");
              } catch (error) {
                expect(error).toBeInstanceOf(CommandConnectionError);
                if (!(error instanceof CommandConnectionError)) throw error;
                expect(error.commitOutcome).toBe("unknown");
              }
            },
          );
        } finally {
          Object.defineProperty(pg.Client.prototype, "query", descriptor);
        }
        expect(intercepted).toBe(1);
        const before = await counts(env);
        expect(before).toEqual({
          packages: 1,
          directions: 1,
          intents: 1,
          gates: 25,
          audits: 0,
        });
        expect((await reconcileConnectedFixture105()).status).toBe(
          "direction_durable_audit_absent",
        );
        expect(await counts(env)).toEqual(before);
      },
    ),
    LIMIT,
  );
  it(
    "rolls back package creation when a foreign observation identity wins late",
    caseBody(
      "rolls back package creation when a foreign observation identity wins late",
      async () => {
        const env = await fresh();
        const attempt = (connectedFixture105Data().identities.ids as Obj)
          .attempt;
        const digest = sha256(
          Buffer.from(
            `connected-fixture105-storage/2\n${String(attempt)}\nobservation`,
            "utf8",
          ),
        );
        const observationId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
        expect(observationId).toBe("cfabc9d0-a817-4971-a868-342f3692b5bd");
        await fault(
          "fixture105_after_package_before_observation",
          async () => {
            await inspect(env, async (pool) => {
              await pool.query(
                "INSERT INTO artifacts (artifact_id,artifact_type,schema_version,content_hash,canonical_payload,storage_uri,byte_size,created_at) VALUES ($3::uuid,'fixture105-construction-observation/1','fixture105-construction-observation/1',$1,'{}'::jsonb,NULL,2,$2)",
                [
                  "0".repeat(64),
                  connectedFixture105Data().identities.authored_fiction_time,
                  observationId,
                ],
              );
            });
          },
          async () => {
            try {
              await runConnectedFixture105();
              throw new Error("expected observation collision");
            } catch (error) {
              expect(error).toMatchObject({
                code: "23505",
                constraint: "artifacts_pkey",
              });
            }
          },
        );
        expect(await counts(env)).toEqual({
          packages: 0,
          directions: 0,
          intents: 0,
          gates: 0,
          audits: 0,
        });
        await expectConstructionRollback(env, 1);
        await inspect(env, async (pool) => {
          expect(
            (await pool.query("SELECT artifact_id::text FROM artifacts")).rows,
          ).toEqual([{ artifact_id: observationId }]);
        });
      },
    ),
    LIMIT,
  );
  it(
    "refuses a stale extra gate fingerprint without changing durable rows",
    caseBody(
      "refuses a stale extra gate fingerprint without changing durable rows",
      async () => {
        const env = await fresh();
        await runConnectedFixture105();
        await inspect(env, async (pool) => {
          await pool.query(
            "INSERT INTO gate_results (gate_result_id,gate_definition_id,attempt_id,input_fingerprint,outcome,result,created_at) SELECT '579b5470-4e9c-4c84-bd20-416fdc643fc2',gate_definition_id,attempt_id,$1,outcome,result,created_at FROM gate_results ORDER BY gate_result_id LIMIT 1",
            ["0".repeat(64)],
          );
        });
        const before = await counts(env);
        await expect(reconcileConnectedFixture105()).rejects.toThrow(
          "fixture_owned_conflict",
        );
        expect(await counts(env)).toEqual(before);
      },
    ),
    LIMIT,
  );
  it(
    "holds unknown construction commit without inventing its missing settlement receipt",
    caseBody(
      "holds unknown construction commit without inventing its missing settlement receipt",
      async () => {
        const env = await fresh();
        let armed = false;
        let intercepted = 0;
        const descriptor = Object.getOwnPropertyDescriptor(
          pg.Client.prototype,
          "query",
        );
        if (descriptor === undefined)
          throw new Error("driver method unavailable");
        const original = driverQuery(descriptor);
        Object.defineProperty(pg.Client.prototype, "query", {
          ...descriptor,
          value: async function (
            this: pg.Client,
            text: string,
            values?: unknown[],
          ): Promise<pg.QueryResult> {
            const result = await original.call(this, text, values);
            if (armed && text === "COMMIT") {
              armed = false;
              intercepted += 1;
              const loss = new Error("construction acknowledgement withheld");
              this.emit("error", loss);
              throw loss;
            }
            return result;
          },
        });
        try {
          await fault(
            "fixture105_after_package_before_observation",
            () => {
              armed = true;
            },
            async () => {
              try {
                await runConnectedFixture105();
                throw new Error("expected unknown construction commit");
              } catch (error) {
                expect(error).toBeInstanceOf(CommandConnectionError);
                if (!(error instanceof CommandConnectionError)) throw error;
                expect(error.commitOutcome).toBe("unknown");
              }
            },
          );
        } finally {
          Object.defineProperty(pg.Client.prototype, "query", descriptor);
        }
        expect(intercepted).toBe(1);
        const before = await counts(env);
        expect(before).toEqual({
          packages: 1,
          directions: 0,
          intents: 0,
          gates: 0,
          audits: 0,
        });
        await expect(reconcileConnectedFixture105()).rejects.toThrow(
          "fixture_construction_receipt_unavailable",
        );
        expect(await counts(env)).toEqual(before);
        await env.close();
        current = undefined;
        // Three direct historical-owner transactions, each on a new real database.
        // The actual matching statement arms only its own client; COMMIT reaches the
        // driver first, then this witness withholds that acknowledgement exactly once.
        for (const owner of [
          "program_run",
          "program_attempt",
          "package_binding",
        ] as const) {
          const separate = await fresh();
          const selected: { client?: pg.Client } = {};
          let reached = 0;
          let lost = 0;
          let receiptBefore: Buffer | undefined;
          let terminalBefore: Buffer | undefined;
          let targetKey: string | undefined;
          const queryDescriptor = Object.getOwnPropertyDescriptor(
            pg.Client.prototype,
            "query",
          );
          if (queryDescriptor === undefined)
            throw new Error("driver method unavailable");
          const query = driverQuery(queryDescriptor);
          const statement =
            owner === "program_run"
              ? /^\s*INSERT INTO program_runs\s*\(/u
              : owner === "program_attempt"
                ? /^\s*INSERT INTO program_run_attempts\s*\(/u
                : /^SELECT bind_evidence_package\(/u;
          Object.defineProperty(pg.Client.prototype, "query", {
            ...queryDescriptor,
            value: async function (
              this: pg.Client,
              text: string,
              values?: unknown[],
            ): Promise<pg.QueryResult> {
              const result = await query.call(this, text, values);
              if (statement.test(text)) {
                reached++;
                expect(reached).toBe(1);
                selected.client = this;
                if (owner === "package_binding") {
                  const target = observedLists().targets.at(-1);
                  if (
                    target === undefined ||
                    typeof target.target_hash !== "string" ||
                    executionRoot === undefined
                  )
                    throw new Error("binding witness target missing");
                  targetKey = target.target_hash;
                  receiptBefore = readFileSync(
                    join(
                      executionRoot,
                      "receipts",
                      targetKey,
                      "CONSTRUCTION.json",
                    ),
                  );
                  terminalBefore = readFileSync(
                    join(
                      executionRoot,
                      "expectations",
                      targetKey + ".terminal.json",
                    ),
                  );
                }
              }
              if (this === selected.client && text === "COMMIT") {
                delete selected.client;
                lost++;
                const loss = new Error(
                  "fixed direct-owner acknowledgement withheld",
                );
                this.emit("error", loss);
                throw loss;
              }
              return result;
            },
          });
          try {
            try {
              await runConnectedFixture105();
              throw new Error("expected direct owner unknown COMMIT");
            } catch (error) {
              expect(error).toBeInstanceOf(CommandConnectionError);
              if (!(error instanceof CommandConnectionError)) throw error;
              expect(error.commitOutcome).toBe("unknown");
              expect(error.phase).toBe("commit");
            }
          } finally {
            Object.defineProperty(
              pg.Client.prototype,
              "query",
              queryDescriptor,
            );
          }
          try {
            expect(reached).toBe(1);
            expect(lost).toBe(1);
            const fixed = connectedFixture105Data().identities.ids as Obj;
            await inspect(separate, async (pool) => {
              expect(
                (
                  await pool.query(
                    "SELECT program_run_id::text FROM program_runs",
                  )
                ).rows,
              ).toEqual([{ program_run_id: fixed.run }]);
              const attempts = (
                await pool.query(
                  "SELECT attempt_id::text,evidence_package_id::text FROM program_run_attempts",
                )
              ).rows;
              expect(attempts).toEqual(
                owner === "program_run"
                  ? []
                  : [
                      {
                        attempt_id: fixed.attempt,
                        evidence_package_id:
                          owner === "package_binding" ? fixed.package : null,
                      },
                    ],
              );
            });
            const retained = await counts(separate);
            expect(retained).toEqual({
              packages: owner === "package_binding" ? 1 : 0,
              directions: 0,
              intents: 0,
              gates: 0,
              audits: 0,
            });
            if (owner === "package_binding") {
              if (
                executionRoot === undefined ||
                targetKey === undefined ||
                receiptBefore === undefined ||
                terminalBefore === undefined
              )
                throw new Error("acknowledged earlier receipt missing");
              expect(
                readFileSync(
                  join(
                    executionRoot,
                    "receipts",
                    targetKey,
                    "CONSTRUCTION.json",
                  ),
                ),
              ).toEqual(receiptBefore);
              expect(
                readFileSync(
                  join(
                    executionRoot,
                    "expectations",
                    targetKey + ".terminal.json",
                  ),
                ),
              ).toEqual(terminalBefore);
            }
            await expect(reconcileConnectedFixture105()).rejects.toThrow();
            expect(await counts(separate)).toEqual(retained);
          } finally {
            await separate.close();
            current = undefined;
          }
        }
      },
    ),
    LIMIT,
  );
  async function readerFailureOrder(
    order: "event-first" | "query-first",
  ): Promise<void> {
    const env = await fresh();
    const eventFailure = new Error("distinct client event");
    const queryFailure = new Error("distinct query rejection");
    const rollbackFailure = new Error("distinct rollback rejection");
    expect(eventFailure).not.toBe(queryFailure);
    const descriptor = Object.getOwnPropertyDescriptor(
      pg.Client.prototype,
      "query",
    );
    if (descriptor === undefined) throw new Error("driver method unavailable");
    const original = driverQuery(descriptor);
    let reached = 0;
    let released = 0;
    const selected: { client?: pg.Client } = {};
    Object.defineProperty(pg.Client.prototype, "query", {
      ...descriptor,
      value: async function (
        this: pg.Client,
        text: string,
        values?: unknown[],
      ): Promise<pg.QueryResult> {
        const result = await original.call(this, text, values);
        if (
          text === "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" &&
          reached === 0
        ) {
          reached++;
          selected.client = this;
          expect(this.listenerCount("error")).toBeGreaterThan(0);
          if (!isCheckedOutClient(this))
            throw new Error("expected checked-out client release");
          const release = this.release.bind(this);
          this.release = (error?: Error | boolean) => {
            released++;
            release(error);
          };
          if (order === "event-first") this.emit("error", eventFailure);
          throw queryFailure;
        }
        if (this === selected.client && text === "ROLLBACK") {
          if (order === "query-first") this.emit("error", eventFailure);
          throw rollbackFailure;
        }
        return result;
      },
    });
    try {
      try {
        await runConnectedFixture105();
        throw new Error("reader should fail");
      } catch (error) {
        expect(error).toBe(
          order === "event-first" ? eventFailure : queryFailure,
        );
        expect(
          connectedFixture105CleanupDiagnostics(error).length,
        ).toBeGreaterThanOrEqual(2);
      }
    } finally {
      Object.defineProperty(pg.Client.prototype, "query", descriptor);
    }
    expect(reached).toBe(1);
    expect(released).toBe(1);
    await expectConstructionRollback(env);
  }
  it(
    "retains event-first reader identity across distinct query and rollback errors",
    caseBody(
      "retains event-first reader identity across distinct query and rollback errors",
      async () => {
        await readerFailureOrder("event-first");
      },
    ),
    LIMIT,
  );
  it(
    "retains query-first reader identity across distinct later client and rollback errors",
    caseBody(
      "retains query-first reader identity across distinct later client and rollback errors",
      async () => {
        await readerFailureOrder("query-first");
      },
    ),
    LIMIT,
  );
  it(
    "retains reader listener when release throws before driver handoff without retry",
    caseBody(
      "retains reader listener when release throws before driver handoff without retry",
      async () => {
        const env = await fresh();
        const primary = new Error("reader query failure");
        const releaseFailure = new Error("release before handoff");
        const lateEvent = new Error("client event after release throw");
        const descriptor = Object.getOwnPropertyDescriptor(
          pg.Client.prototype,
          "query",
        );
        if (descriptor === undefined)
          throw new Error("driver method unavailable");
        const original = driverQuery(descriptor);
        let reached = 0;
        let releases = 0;
        let retained = false;
        let handedOff = false;
        Object.defineProperty(pg.Client.prototype, "query", {
          ...descriptor,
          value: async function (
            this: pg.Client,
            text: string,
            values?: unknown[],
          ): Promise<pg.QueryResult> {
            const result = await original.call(this, text, values);
            if (
              text === "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" &&
              reached === 0
            ) {
              reached++;
              if (!isCheckedOutClient(this))
                throw new Error("expected checked-out client release");
              const driverRelease = this.release.bind(this);
              this.release = () => {
                releases++;
                queueMicrotask(() => {
                  retained = this.listenerCount("error") > 0;
                  try {
                    if (retained) this.emit("error", lateEvent);
                  } finally {
                    driverRelease(true);
                    handedOff = true;
                  }
                });
                throw releaseFailure;
              };
              throw primary;
            }
            return result;
          },
        });
        try {
          await expect(runConnectedFixture105()).rejects.toBe(primary);
        } finally {
          Object.defineProperty(pg.Client.prototype, "query", descriptor);
        }
        expect(reached).toBe(1);
        expect(releases).toBe(1);
        expect(retained).toBe(true);
        expect(handedOff).toBe(true);
        expect(
          connectedFixture105CleanupDiagnostics(primary).length,
        ).toBeGreaterThanOrEqual(2);
        await expectConstructionRollback(env);
      },
    ),
    LIMIT,
  );
  it(
    "closes continuation when the acquisition-cut await throws before consumption",
    caseBody(
      "closes continuation when the acquisition-cut await throws before consumption",
      async () => {
        const env = await fresh();
        const primary = new Error("controlled acquisition cut");
        await fault(
          "fixture105_after_acquisition",
          () => {
            throw primary;
          },
          async () => {
            await expect(runConnectedFixture105()).rejects.toBe(primary);
          },
        );
        expect(await counts(env)).toEqual({
          packages: 1,
          directions: 0,
          intents: 0,
          gates: 18,
          audits: 0,
        });
        await expectNoPerformanceArtifacts(env);
        await expect(runConnectedFixture105()).rejects.toThrow(
          "fixture_execution_already_present",
        );
      },
    ),
    LIMIT,
  );
  it(
    "tracks and cleans a database allocation that fails before create returns",
    caseBody(
      "tracks and cleans a database allocation that fails before create returns",
      async () => {
        await fault(
          "fixture105_test_after_database_create",
          () => {
            throw new Error("setup before returned environment");
          },
          async () => {
            await expect(
              requireCluster().create({ migrate: false }),
            ).rejects.toThrow("setup before returned environment");
          },
        );
        await cluster?.closePending();
        expect(
          (
            await requireCluster().admin.query(
              "SELECT datname FROM pg_database WHERE datname=ANY($1::text[])",
              [requireCluster().names],
            )
          ).rows,
        ).toEqual([]);
      },
    ),
    LIMIT,
  );
  it(
    "tracks a setup pool before roles SQL or migration can fail",
    caseBody(
      "tracks a setup pool before roles SQL or migration can fail",
      async () => {
        await fault(
          "fixture105_test_after_setup_pool",
          () => {
            throw new Error("allocated setup pool failure");
          },
          async () => {
            await expect(
              requireCluster().create({ migrate: false }),
            ).rejects.toThrow("allocated setup pool failure");
          },
        );
        await cluster?.closePending();
        expect(
          (
            await requireCluster().admin.query(
              "SELECT datname FROM pg_database WHERE datname=ANY($1::text[])",
              [requireCluster().names],
            )
          ).rows,
        ).toEqual([]);
      },
    ),
    LIMIT,
  );
  it(
    "tracks bootstrap role allocation before bootstrap returns",
    caseBody(
      "tracks bootstrap role allocation before bootstrap returns",
      async () => {
        if (bootstrapUrl === undefined) throw new Error("bootstrap missing");
        const isolated = new TrackedFixtureCluster(bootstrapUrl);
        isolatedClusters.push(isolated);
        await withTestCleanup(
          async () => {
            await fault(
              "fixture105_test_after_role_create",
              () => {
                throw new Error("allocated bootstrap role failure");
              },
              async () => {
                await expect(isolated.bootstrap()).rejects.toThrow(
                  "allocated bootstrap role failure",
                );
              },
            );
          },
          () => isolated.shutdown(),
        );
        expect(
          (
            await requireCluster().admin.query(
              "SELECT rolname FROM pg_roles WHERE rolname=ANY($1::text[])",
              [isolated.logins],
            )
          ).rows,
        ).toEqual([]);
        expect(
          (
            await requireCluster().admin.query(
              "SELECT datname FROM pg_database WHERE datname=ANY($1::text[])",
              [isolated.names],
            )
          ).rows,
        ).toEqual([]);
      },
    ),
    LIMIT,
  );

  it(
    "retains full actual failed Claims coverage and findings in a private failure receipt",
    caseBody(
      "retains full actual failed Claims coverage and findings in a private failure receipt",
      async () => {
        const env = await fresh();
        const evaluate = claimsOwner.evaluateConnectedFixture105Component;
        let actual: ReturnType<typeof evaluate> | undefined;
        // Controlled acquisition-input defect; the real evaluator still produces every row/brand.
        // No fabricated result, admission or pass is injected.
        const observer = vi
          .spyOn(claimsOwner, "evaluateConnectedFixture105Component")
          .mockImplementation((input) => {
            actual = evaluate({
              ...input,
              statics: { ...input.statics, profiles: {} },
            });
            return actual;
          });
        let failure: ConnectedFixture105ClaimsFailure | undefined;
        try {
          try {
            await runConnectedFixture105();
            throw new Error("expected factual continuation refusal");
          } catch (error) {
            expect(error).toBeInstanceOf(ConnectedFixture105ClaimsFailure);
            if (!(error instanceof ConnectedFixture105ClaimsFailure))
              throw error;
            failure = error;
          }
        } finally {
          observer.mockRestore();
        }
        if (actual === undefined) throw new Error("actual failure not reached");
        const receivedFailure = requireClaimsFailure(failure);
        expect(receivedFailure.receipt).toMatchObject({
          rows: actual.rows,
          aggregate: actual.aggregate,
          warnings: actual.warnings,
          coverage: actual.coverage,
          preconditions: actual.preconditions,
          actual_result_sha256:
            claimsOwner.connectedFixture105ClaimsResultHash(actual),
        });
        expect(actual.rows.some((row) => row.findings.length !== 0)).toBe(true);
        await inspect(env, async (pool) => {
          const target = (
            await pool.query(
              "SELECT current_database() AS database,(SELECT oid::text FROM pg_database WHERE datname=current_database()) AS database_oid,session_user AS login,inet_server_addr()::text AS server_address,inet_server_port() AS server_port",
            )
          ).rows[0] as Obj | undefined;
          if (target === undefined) throw new Error("target missing");
          const namespace = sha256(Buffer.from(canonicalJson(target), "utf8"));
          const path = `${validateConnectedFixture105ExecutionRoot()}/receipts/${namespace}/CLAIMS-FAILURE.json`;
          expect(JSON.parse(await readFile(path, "utf8"))).toEqual(
            receivedFailure.receipt,
          );
        });
        expect(await counts(env)).toEqual({
          packages: 1,
          directions: 0,
          intents: 0,
          gates: 18,
          audits: 0,
        });
        await expectNoPerformanceArtifacts(env);
      },
    ),
    LIMIT,
  );
  it(
    "memoizes a first setup pool-end failure without another end call",
    caseBody(
      "memoizes a first setup pool-end failure without another end call",
      async () => {
        if (bootstrapUrl === undefined) throw new Error("bootstrap missing");
        const isolated = new TrackedFixtureCluster(bootstrapUrl);
        isolatedClusters.push(isolated);
        let restore: (() => void) | undefined;
        let expectedShutdown: unknown;
        let calls = 0;
        await withTestCleanup(
          async () => {
            await isolated.bootstrap();
            const env = await isolated.create({ migrate: false });
            const original = env.owner.end.bind(env.owner);
            const endFailure = new Error("controlled end completion failure");
            const endDescriptor = Object.getOwnPropertyDescriptor(
              env.owner,
              "end",
            );
            Object.defineProperty(env.owner, "end", {
              configurable: true,
              value: () => {
                calls++;
                return original().then(() => {
                  throw endFailure;
                });
              },
            });
            restore = () => {
              if (endDescriptor === undefined)
                Reflect.deleteProperty(env.owner, "end");
              else Object.defineProperty(env.owner, "end", endDescriptor);
            };
            let first: unknown;
            try {
              await isolated.settle(env.name);
              throw new Error("expected failed end");
            } catch (error) {
              first = error;
              expect(error).toBeInstanceOf(AggregateError);
            }
            await expect(isolated.settle(env.name)).rejects.toBe(first);
            try {
              await isolated.shutdown();
              throw new Error("expected shutdown failure");
            } catch (error) {
              expect(error).toBeInstanceOf(AggregateError);
              expectedShutdown = error;
            }
            expect(calls).toBe(1);
          },
          async () => {
            restore?.();
            const cleanup: unknown[] = [];
            try {
              await isolated.shutdown();
            } catch (error) {
              if (error !== expectedShutdown) cleanup.push(error);
            }
            try {
              expect(
                (
                  await requireCluster().admin.query(
                    "SELECT datname FROM pg_database WHERE datname=ANY($1::text[])",
                    [isolated.names],
                  )
                ).rows,
              ).toEqual([]);
              expect(
                (
                  await requireCluster().admin.query(
                    "SELECT rolname FROM pg_roles WHERE rolname=ANY($1::text[])",
                    [isolated.logins],
                  )
                ).rows,
              ).toEqual([]);
            } catch (error) {
              cleanup.push(error);
            }
            if (cleanup.length !== 0)
              throw new AggregateError(
                cleanup,
                "isolated shutdown or residual failure",
              );
          },
        );
      },
    ),
    LIMIT,
  );

  it(
    "preserves the old package four-round reconciliation bound under named-conflict delivery",
    caseBody(
      "preserves the old package four-round reconciliation bound under named-conflict delivery",
      async () => {
        const env = await fresh();
        await packagePrerequisites(env, false);
        const descriptor = Object.getOwnPropertyDescriptor(
          pg.Client.prototype,
          "query",
        );
        if (descriptor === undefined) throw new Error("driver unavailable");
        const original = driverQuery(descriptor);
        let inserts = 0;
        let rollbacks = 0;
        // Native reference validation/savepoints/readbacks; deterministic transport
        // delivery of the named race code, not a claim of four real concurrent races.
        Object.defineProperty(pg.Client.prototype, "query", {
          ...descriptor,
          value: async function (
            this: pg.Client,
            text: string,
            values?: unknown[],
          ): Promise<pg.QueryResult> {
            if (text.includes("INSERT INTO artifacts")) {
              inserts++;
              throw Object.assign(new Error("controlled named collision"), {
                code: "23505",
                constraint: "artifacts_pkey",
              });
            }
            if (text === "ROLLBACK") rollbacks++;
            return original.call(this, text, values);
          },
        });
        try {
          await inspect(env, async (pool) => {
            await expect(
              persistEvidencePackage(pool, packageInput()),
            ).rejects.toThrow(
              "package persistence did not settle after re-reads",
            );
            expect(pool.waitingCount).toBe(0);
            expect(pool.idleCount).toBe(pool.totalCount);
          });
        } finally {
          Object.defineProperty(pg.Client.prototype, "query", descriptor);
        }
        expect(inserts).toBe(4);
        expect(rollbacks).toBe(1);
        await inspect(env, async (pool) => {
          expect(
            (await pool.query("SELECT artifact_id FROM artifacts")).rows,
          ).toEqual([]);
          expect(
            (
              await pool.query(
                "SELECT evidence_package_id FROM evidence_packages",
              )
            ).rows,
          ).toEqual([]);
        });
      },
    ),
    LIMIT,
  );
  it(
    "preserves an unrelated package failure object and releases its transaction",
    caseBody(
      "preserves an unrelated package failure object and releases its transaction",
      async () => {
        for (const seam of ["direct", "savepoint"] as const) {
          const env = await fresh();
          await packagePrerequisites(env, false);
          const primary = new Error("controlled unrelated package failure");
          let armed = false;
          let reached = 0;
          let rollbacks = 0;
          let savepointRollbacks = 0;
          let savepointReleases = 0;
          const descriptor = Object.getOwnPropertyDescriptor(
            pg.Client.prototype,
            "query",
          );
          if (descriptor === undefined) throw new Error("driver unavailable");
          const original = driverQuery(descriptor);
          Object.defineProperty(pg.Client.prototype, "query", {
            ...descriptor,
            value: async function (
              this: pg.Client,
              text: string,
              values?: unknown[],
            ): Promise<pg.QueryResult> {
              if (armed) {
                if (text === "ROLLBACK") rollbacks++;
                if (/^ROLLBACK TO SAVEPOINT sp_[0-9]+$/u.test(text))
                  savepointRollbacks++;
                if (/^RELEASE SAVEPOINT sp_[0-9]+$/u.test(text))
                  savepointReleases++;
                const selected =
                  seam === "direct"
                    ? text.startsWith("SELECT a.artifact_id::text,") &&
                      text.endsWith(" WHERE p.package_hash = $1")
                    : text.includes("INSERT INTO artifacts");
                if (selected) {
                  reached++;
                  throw primary;
                }
              }
              return original.call(this, text, values);
            },
          });
          try {
            await inspect(env, async (pool) => {
              armed = true;
              try {
                if (seam === "direct") {
                  await expect(
                    persistEvidencePackage(pool, packageInput()),
                  ).rejects.toBe(primary);
                } else {
                  let caught: unknown;
                  try {
                    await persistEvidencePackage(pool, packageInput());
                  } catch (error) {
                    caught = error;
                  }
                  expect(caught).toBeInstanceOf(Error);
                  expect(caught).not.toBe(primary);
                  if (!(caught instanceof Error))
                    throw new Error("expected normalized package failure");
                  expect(caught.message).toBe(primary.message);
                  expect(Object.hasOwn(caught, "code")).toBe(true);
                  expect(Object.hasOwn(caught, "constraint")).toBe(true);
                  expect(Object.keys(caught).sort()).toEqual([
                    "code",
                    "constraint",
                  ]);
                  expect(
                    (caught as Error & { code?: unknown }).code,
                  ).toBeUndefined();
                  expect(
                    (caught as Error & { constraint?: unknown }).constraint,
                  ).toBeUndefined();
                }
              } finally {
                armed = false;
              }
              expect(pool.waitingCount).toBe(0);
              expect(pool.idleCount).toBe(pool.totalCount);
            });
          } finally {
            Object.defineProperty(pg.Client.prototype, "query", descriptor);
          }
          expect(reached).toBe(1);
          expect(rollbacks).toBe(1);
          expect(savepointRollbacks).toBe(seam === "savepoint" ? 1 : 0);
          expect(savepointReleases).toBe(seam === "savepoint" ? 1 : 0);
          await inspect(env, async (pool) => {
            expect(
              (await pool.query("SELECT artifact_id FROM artifacts")).rows,
            ).toEqual([]);
            expect(
              (
                await pool.query(
                  "SELECT evidence_package_id FROM evidence_packages",
                )
              ).rows,
            ).toEqual([]);
          });
          await env.close();
        }
      },
    ),
    LIMIT,
  );
});
