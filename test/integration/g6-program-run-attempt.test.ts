// G6 on real PostgreSQL 17 as desk_runtime: createProgramRun / createProgramAttempt (authored identity, convergent, SQL-side immutable
// comparison, first-attempt binding race, rollback of the incidental run binding, retries after real package/state changes).
// Prerequisites (accounts, show, show-config versions, claims) are seeded by the privileged migrator pool, as in production.
import { randomUUID } from "node:crypto";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { families } from "../../src/fixture/families.js";
import { loadFoundationRows } from "../../src/fixture/loader.js";
import {
  createProgramAttempt,
  createProgramRun,
  lookupProgramAttempt,
  lookupProgramRun,
  PROGRAM_ATTEMPT_LOCK_CLASS,
  type AuthoredProgramAttempt,
  type AuthoredProgramRun,
} from "../../src/runtime/program.js";
import { TestCluster, type DbEnv } from "../support/db-env.js";
import {
  attemptIds,
  prepareUnitsAndSupports,
  sliceInput,
} from "../support/a5-fixture.js";
import { capturingContext, runSliceObserved } from "../support/a6-observed.js";
import { observe, withChild } from "../support/a5-crash.js";
import { backendPid, waitForBlocked, within } from "../support/pg-wait.js";

// Every test builds a migrated disposable database; the interleaved ones wait on database-reported locks (bounded in pg-wait.ts).
vi.setConfig({ testTimeout: 120000, hookTimeout: 120000 });

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const cluster = databaseUrl ? new TestCluster(databaseUrl) : undefined;
const must = <T>(v: T | undefined | null): T => {
  if (v === undefined || v === null) throw new Error("missing");
  return v;
};
if (cluster) {
  beforeAll(async () => {
    await cluster.bootstrap();
  }, 120000);
  afterAll(async () => {
    await cluster.shutdown();
  });
}

type Obj = Record<string, unknown>;
const tables = (): Record<string, Obj[]> =>
  loadFoundationRows().tables as unknown as Record<string, Obj[]>;
const SHOW = String(must(tables().shows?.[0]).show_id);
const [CONFIG_A, CONFIG_B] = (tables().show_config_versions ?? []).map((c) =>
  String(c.show_config_version_id),
) as [string, string];
const FIXTURE_RUN = must(tables().program_runs?.[0]);
const FIXTURE_ATTEMPT = must(tables().program_run_attempts?.[0]);
const OTHER_SHOW = "d1250002-0000-4000-8000-0000000000aa";
const OTHER_SHOW_CONFIG = "d1250003-0000-4000-8000-0000000000aa";

const insertRow = async (
  client: pg.PoolClient,
  table: string,
  row: Obj,
): Promise<void> => {
  const family = must(families.find((f) => f.table === table));
  await client.query(
    `INSERT INTO "${table}" (${family.columns.map((c) => `"${c}"`).join(",")}) VALUES (${family.columns.map((_, i) => `$${String(i + 1)}`).join(",")})`,
    family.columns.map((c) =>
      family.jsonb.includes(c) && row[c] !== null && row[c] !== undefined
        ? JSON.stringify(row[c])
        : row[c],
    ),
  );
};
/** accounts, the fixture show and its two configs, claims, plus a SECOND show with its own config (cross-show cases). */
async function seedBase(migrator: pg.Pool): Promise<void> {
  const client = await migrator.connect();
  try {
    await client.query("BEGIN");
    const t = tables();
    for (const name of ["accounts", "shows", "show_config_versions"])
      for (const row of t[name] ?? []) await insertRow(client, name, row);
    const show = must(t.shows?.[0]);
    await insertRow(client, "shows", {
      ...show,
      show_id: OTHER_SHOW,
      slug: "other-show",
    });
    await insertRow(client, "show_config_versions", {
      ...must(t.show_config_versions?.[0]),
      show_config_version_id: OTHER_SHOW_CONFIG,
      show_id: OTHER_SHOW,
    });
    for (const row of t.claims ?? []) await insertRow(client, "claims", row);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
const fresh = async (): Promise<DbEnv> => {
  const env = await must(cluster).create({ migrate: true });
  await seedBase(env.migrator);
  return env;
};
const runtimePool = (env: DbEnv, max = 1, application = ""): pg.Pool =>
  new pg.Pool({
    connectionString: env.runtimeUrl,
    options: `-c role=desk_runtime${application ? ` -c application_name=${application}` : ""}`,
    max,
  });
interface Race {
  /** The independent session whose open transaction the test commits itself. */
  holder: pg.PoolClient;
  /** The pool the commands under test use (application_name g6_victim). */
  pool: pg.Pool;
  /** Registers a command promise started by the body so cleanup can settle it (the caller still awaits it for its result). */
  track: <T>(promise: Promise<T>) => Promise<T>;
}
/**
 * Runs `body` against a holder session and a victim pool. EVERY step is bounded with the existing `within` deadline helper, and every
 * cleanup step runs on EVERY path (including a failed or timed-out wait or assertion inside `body`):
 *  (0) connecting the holder and running `body` have deadlines (a body that exceeds its deadline is abandoned, not awaited again);
 *  (1) the holder's transaction is rolled back (bounded) and the holder released FIRST, so a blocked victim can finish; a rollback that
 *      fails or times out destroys the holder connection instead of returning it to the pool;
 *  (2) only THIS test's tracked commands are settled (bounded); if one does not settle, only this database's g6_victim / g6_holder
 *      sessions are terminated by exact application_name through a bounded query (no broad kill) and the commands are awaited once more;
 *  (3) ALL known pools are ended (bounded).
 * Every cleanup failure (rollback, release, termination query, settle, pool end) is CAUGHT and recorded as a diagnostic: none can replace
 * the original failure, which is rethrown with the diagnostics appended and kept as `cause`. If the body succeeded, any diagnostic fails
 * the test. Test-local only: no production framework.
 */
const RACE_BODY_MS = 90000;
const RACE_STEP_MS = 15000;
async function withRace(
  env: DbEnv,
  victimMax: number,
  body: (race: Race) => Promise<void>,
): Promise<void> {
  const pool = runtimePool(env, victimMax, "g6_victim");
  const holderPool = runtimePool(env, 1, "g6_holder");
  const pending: Promise<unknown>[] = [];
  const diagnostics: string[] = [];
  const note = (what: string, error: unknown): void => {
    diagnostics.push(
      `${what}: ${error instanceof Error ? error.message : String(error)}`,
    );
  };
  let failure: unknown;
  let holder: pg.PoolClient | undefined;
  try {
    holder = await within(holderPool.connect(), RACE_STEP_MS, "holder connect");
    await within(
      body({
        holder,
        pool,
        track: (promise) => {
          pending.push(promise.then(settle, settle));
          return promise;
        },
      }),
      RACE_BODY_MS,
      "race body",
    );
  } catch (error) {
    failure = error;
  }
  if (holder) {
    let destroy = false;
    try {
      await within(holder.query("ROLLBACK"), RACE_STEP_MS, "holder rollback"); // a no-op notice when the body already committed
    } catch (error) {
      destroy = true;
      note("holder rollback", error);
    }
    try {
      holder.release(destroy ? true : undefined);
    } catch (error) {
      note("holder release", error);
    }
  }
  const settleAll = (what: string): Promise<unknown> =>
    within(Promise.all(pending), RACE_STEP_MS, what);
  try {
    await settleAll("tracked commands settle");
  } catch (error) {
    note("settle", error);
    try {
      await within(
        env.owner.query(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
           WHERE datname = $1 AND application_name IN ('g6_victim','g6_holder') AND pid <> pg_backend_pid()`,
          [env.name],
        ),
        RACE_STEP_MS,
        "terminate this test's sessions",
      );
      await settleAll("tracked commands settle after termination");
    } catch (fallbackError) {
      note("fallback", fallbackError);
    }
  }
  for (const p of [pool, holderPool])
    try {
      await within(p.end(), RACE_STEP_MS, "pool end");
    } catch (error) {
      note("pool end", error);
    }
  if (failure !== undefined) {
    if (diagnostics.length === 0) throw failure as Error;
    throw new Error(
      `${failure instanceof Error ? failure.message : JSON.stringify(failure)}; cleanup diagnostics: ${diagnostics.join(" | ")}`,
      { cause: failure },
    );
  }
  if (diagnostics.length > 0)
    throw new Error(`cleanup failed: ${diagnostics.join(" | ")}`);
}
const settle = (): undefined => undefined;
const ownerRows = async (
  env: DbEnv,
  sql: string,
  values?: unknown[],
): Promise<Obj[]> => (await env.owner.query<Obj>(sql, values)).rows;
/**
 * Bounded wait (the existing `observe`) until pg_stat_activity shows NO g6_victim / g6_holder session of this database. The zero is
 * strictly required at the deadline; nothing is terminated or hidden to satisfy it.
 */
const sessionsGone = (env: DbEnv, timeoutMs: number): Promise<void> =>
  observe(
    async () =>
      Number(
        (
          await ownerRows(
            env,
            `SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = $1 AND application_name IN ('g6_victim','g6_holder')`,
            [env.name],
          )
        )[0]?.n,
      ) === 0,
    "no g6_victim/g6_holder session remains",
    timeoutMs,
  );
const count = async (env: DbEnv, table: string): Promise<number> =>
  Number((await ownerRows(env, `SELECT count(*) AS n FROM ${table}`))[0]?.n);
const idle = (pool: pg.Pool): boolean =>
  pool.totalCount === pool.idleCount && pool.waitingCount === 0;

const run = (over: Partial<AuthoredProgramRun> = {}): AuthoredProgramRun => ({
  program_run_id: randomUUID(),
  show_id: SHOW,
  purpose: "evaluation",
  created_at: "2026-10-01T10:00:00.123456Z",
  ...over,
});
const attempt = (
  runId: string,
  over: Partial<AuthoredProgramAttempt> = {},
): AuthoredProgramAttempt => ({
  attempt_id: randomUUID(),
  program_run_id: runId,
  show_config_version_id: CONFIG_A,
  created_at: "2026-10-01T10:00:01.000001Z",
  ...over,
});
const keyed = (c: unknown, extra: Obj): AuthoredProgramRun =>
  ({ ...(c as Obj), ...extra }) as unknown as AuthoredProgramRun;

/** Table row-count digest of everything except the two governed tables (the commands must write nowhere else). */
const otherTablesDigest = async (env: DbEnv): Promise<string> => {
  const names = (
    await ownerRows(
      env,
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('program_runs','program_run_attempts') ORDER BY 1`,
    )
  ).map((r) => String(r.tablename));
  const parts: string[] = [];
  for (const n of names) parts.push(`${n}=${String(await count(env, n))}`);
  return parts.join(",");
};

suite("G6 createProgramRun (real PostgreSQL, desk_runtime)", () => {
  it("creates, converges on an identical retry, and reports the stored (microsecond-exact) record", async () => {
    const env = await fresh();
    const pool = runtimePool(env);
    try {
      const r = run();
      const first = await createProgramRun(pool, r);
      expect(first).toMatchObject({
        kind: "created",
        record: {
          program_run_id: r.program_run_id,
          show_id: SHOW,
          purpose: "evaluation",
          created_at: "2026-10-01T10:00:00.123456Z",
          state: "PENDING",
          show_config_version_id: null,
          publication_enabled: null,
        },
      });
      const again = await createProgramRun(pool, r);
      expect(again.kind).toBe("converged");
      expect(again).toMatchObject({
        record: (first as { record: unknown }).record,
      });
      expect(await count(env, "program_runs")).toBe(1);
      expect(await lookupProgramRun(pool, r.program_run_id)).toEqual(
        (first as { record: unknown }).record,
      );
      expect(await lookupProgramRun(pool, randomUUID())).toBeNull();
      expect(idle(pool)).toBe(true);
    } finally {
      await pool.end();
      await env.close();
    }
  });

  it("each immutable field conflicts individually (including a 1-microsecond difference) and writes nothing", async () => {
    const env = await fresh();
    const pool = runtimePool(env);
    try {
      const r = run();
      expect((await createProgramRun(pool, r)).kind).toBe("created");
      const variants: [string, Partial<AuthoredProgramRun>, string][] = [
        ["show", { show_id: OTHER_SHOW }, "show_id"],
        ["purpose", { purpose: "production" }, "purpose"],
        [
          "created_at +1us",
          { created_at: "2026-10-01T10:00:00.123457Z" },
          "created_at",
        ],
        [
          "created_at -1us",
          { created_at: "2026-10-01T10:00:00.123455Z" },
          "created_at",
        ],
        [
          "created_at ms-truncated",
          { created_at: "2026-10-01T10:00:00.123Z" },
          "created_at",
        ],
      ];
      for (const [name, over, field] of variants) {
        const o = await createProgramRun(pool, { ...r, ...over });
        expect(o, name).toMatchObject({
          kind: "conflict",
          code: "program_run_identity_conflict",
        });
        expect((o as { detail: string }).detail).toContain(field);
      }
      // the same instant in another offset is the SAME instant, so it converges (timestamptz equality, not text)
      expect(
        (
          await createProgramRun(pool, {
            ...r,
            created_at: "2026-10-01T12:00:00.123456+02:00",
          })
        ).kind,
      ).toBe("converged");
      expect(await count(env, "program_runs")).toBe(1);
    } finally {
      await pool.end();
      await env.close();
    }
  });

  it("refuses an unknown show, an invalid purpose and any extra field before writing, with typed codes", async () => {
    const env = await fresh();
    const pool = runtimePool(env);
    try {
      const digest = await otherTablesDigest(env);
      expect(
        await createProgramRun(pool, run({ show_id: randomUUID() })),
      ).toMatchObject({ kind: "rejected", code: "show_not_found" });
      expect(
        await createProgramRun(pool, keyed(run(), { purpose: "staging" })),
      ).toMatchObject({ kind: "rejected", code: "purpose_invalid" });
      for (const extra of [
        { state: "VALIDATED" },
        { show_config_version_id: CONFIG_A },
        { publication_enabled: false },
      ])
        expect(await createProgramRun(pool, keyed(run(), extra))).toMatchObject(
          { kind: "rejected", code: "unsupported_field" },
        );
      expect(
        await createProgramRun(pool, run({ program_run_id: "nope" })),
      ).toMatchObject({ kind: "rejected", code: "invalid_uuid" });
      expect(
        await createProgramRun(pool, run({ created_at: "2026-10-01" })),
      ).toMatchObject({ kind: "rejected", code: "invalid_timestamp" });
      expect(
        await createProgramRun(
          pool,
          run({ created_at: "2026-10-01T10:00:00.1234567Z" }),
        ),
      ).toMatchObject({ kind: "rejected", code: "timestamp_precision" });
      expect(await count(env, "program_runs")).toBe(0);
      expect(await otherTablesDigest(env)).toBe(digest);
    } finally {
      await pool.end();
      await env.close();
    }
  });

  it("concurrent identical creates produce one creator; a concurrent different request for the same id conflicts", async () => {
    const env = await fresh();
    const pool = runtimePool(env, 8);
    try {
      const r = run();
      const results = await Promise.all(
        Array.from({ length: 8 }, () => createProgramRun(pool, r)),
      );
      expect(results.filter((o) => o.kind === "created")).toHaveLength(1);
      expect(results.filter((o) => o.kind === "converged")).toHaveLength(7);
      expect(await count(env, "program_runs")).toBe(1);
      const r2 = run();
      const mixed = await Promise.all([
        ...Array.from({ length: 4 }, () => createProgramRun(pool, r2)),
        ...Array.from({ length: 4 }, () =>
          createProgramRun(pool, { ...r2, purpose: "production" }),
        ),
      ]);
      expect(mixed.filter((o) => o.kind === "created")).toHaveLength(1);
      expect(
        mixed.filter((o) => o.kind === "created" || o.kind === "converged")
          .length + mixed.filter((o) => o.kind === "conflict").length,
      ).toBe(8);
      expect(await count(env, "program_runs")).toBe(2);
      expect(idle(pool)).toBe(true);
    } finally {
      await pool.end();
      await env.close();
    }
  });

  it("a same-identity race interleaved on the database: the loser re-reads the winner by identity (converged / conflict)", async () => {
    const env = await fresh();
    try {
      await withRace(env, 4, async ({ holder, pool, track }) => {
        const r = run();
        await holder.query("BEGIN");
        await holder.query(
          "INSERT INTO program_runs (program_run_id, show_id, purpose, created_at) VALUES ($1,$2,$3,$4)",
          [r.program_run_id, r.show_id, r.purpose, r.created_at],
        );
        const holderPid = await backendPid(holder);
        const same = track(createProgramRun(pool, r));
        const different = track(
          createProgramRun(pool, { ...r, purpose: "production" }),
        );
        await waitForBlocked(
          env.owner,
          env.name,
          (w) => w.filter((x) => x.blockers.includes(holderPid)).length >= 2,
        );
        await holder.query("COMMIT");
        expect((await same).kind).toBe("converged");
        expect(await different).toMatchObject({
          kind: "conflict",
          code: "program_run_identity_conflict",
        });
        expect(await count(env, "program_runs")).toBe(1);
      });
    } finally {
      await env.close();
    }
  });
});

suite("G6 createProgramAttempt (real PostgreSQL, desk_runtime)", () => {
  it("creates the first attempt (the guard binds the run atomically), converges on retry, and returns mutable fields truthfully", async () => {
    const env = await fresh();
    const pool = runtimePool(env);
    try {
      const r = run();
      await createProgramRun(pool, r);
      const a = attempt(r.program_run_id);
      const first = await createProgramAttempt(pool, a);
      expect(first).toMatchObject({
        kind: "created",
        record: {
          attempt_id: a.attempt_id,
          program_run_id: r.program_run_id,
          show_config_version_id: CONFIG_A,
          created_at: "2026-10-01T10:00:01.000001Z",
          parent_attempt_id: null,
          repair_plan_id: null,
          publication_enabled: false,
          state: "PENDING",
          evidence_package_id: null,
          run: {
            state: "PENDING",
            show_config_version_id: CONFIG_A,
            publication_enabled: false,
          },
        },
      });
      expect((await createProgramAttempt(pool, a)).kind).toBe("converged");
      // null / explicit false are the SAME request as absent
      expect(
        (
          await createProgramAttempt(pool, {
            ...a,
            parent_attempt_id: null,
            repair_plan_id: null,
            publication_enabled: false,
          })
        ).kind,
      ).toBe("converged");
      expect(await count(env, "program_run_attempts")).toBe(1);
      expect(await lookupProgramAttempt(pool, a.attempt_id)).toEqual(
        (first as { record: unknown }).record,
      );
      // a second attempt of the same run with the same config is a distinct identity
      expect(
        (await createProgramAttempt(pool, attempt(r.program_run_id))).kind,
      ).toBe("created");
      expect(idle(pool)).toBe(true);
    } finally {
      await pool.end();
      await env.close();
    }
  });

  it("each immutable field conflicts individually, with nothing written", async () => {
    const env = await fresh();
    const pool = runtimePool(env);
    try {
      const r = run();
      const r2 = run();
      await createProgramRun(pool, r);
      await createProgramRun(pool, r2);
      const a = attempt(r.program_run_id);
      expect((await createProgramAttempt(pool, a)).kind).toBe("created");
      const variants: [Partial<AuthoredProgramAttempt>, string][] = [
        [{ program_run_id: r2.program_run_id }, "program_run_id"],
        [{ show_config_version_id: CONFIG_B }, "show_config_version_id"],
        [{ created_at: "2026-10-01T10:00:01.000002Z" }, "created_at"],
        [{ created_at: "2026-10-01T10:00:01.000000Z" }, "created_at"],
      ];
      for (const [over, field] of variants) {
        const o = await createProgramAttempt(pool, { ...a, ...over });
        expect(o).toMatchObject({
          kind: "conflict",
          code: "program_attempt_identity_conflict",
        });
        expect((o as { detail: string }).detail).toContain(field);
      }
      expect(await count(env, "program_run_attempts")).toBe(1);
      const stored = await ownerRows(
        env,
        "SELECT show_config_version_id::text AS c FROM program_runs WHERE program_run_id = $1",
        [r2.program_run_id],
      );
      expect(stored[0]?.c).toBeNull(); // the conflicting request did not bind the OTHER run
    } finally {
      await pool.end();
      await env.close();
    }
  });

  // Narrow on purpose: a repair-shaped row needs a READY parent, a confirmed repair plan and operator decisions (outside this tranche);
  // the repair-lineage comparison fields (parent_attempt_id / repair_plan_id) are therefore NOT exercised against a real repair row here.
  it("a stored PUBLICATION-ENABLED attempt row (privileged setup) is a conflict for the same identity, never a convergence", async () => {
    const env = await fresh();
    const pool = runtimePool(env);
    try {
      const r = run();
      await createProgramRun(pool, r);
      const a = attempt(r.program_run_id);
      expect((await createProgramAttempt(pool, a)).kind).toBe("created");
      // the privileged path can enable publication on a PRODUCTION attempt; the runtime command must then report a conflict
      const rp = run({ purpose: "production" });
      await createProgramRun(pool, rp);
      const pa = attempt(rp.program_run_id);
      await env.migrator.query(
        "INSERT INTO program_run_attempts (attempt_id, program_run_id, show_config_version_id, created_at, publication_enabled) VALUES ($1,$2,$3,$4,true)",
        [pa.attempt_id, pa.program_run_id, CONFIG_A, pa.created_at],
      );
      const o = await createProgramAttempt(pool, pa);
      expect(o).toMatchObject({
        kind: "conflict",
        code: "program_attempt_identity_conflict",
      });
      expect((o as { detail: string }).detail).toContain("publication_enabled");
    } finally {
      await pool.end();
      await env.close();
    }
  });

  it("typed refusals write nothing (run/config/show), and strict-API refusals happen before any write", async () => {
    const env = await fresh();
    const pool = runtimePool(env);
    try {
      const r = run();
      await createProgramRun(pool, r);
      const digest = await otherTablesDigest(env);
      expect(
        await createProgramAttempt(pool, attempt(randomUUID())),
      ).toMatchObject({ kind: "rejected", code: "run_not_found" });
      expect(
        await createProgramAttempt(
          pool,
          attempt(r.program_run_id, { show_config_version_id: randomUUID() }),
        ),
      ).toMatchObject({ kind: "rejected", code: "config_not_found" });
      expect(
        await createProgramAttempt(
          pool,
          attempt(r.program_run_id, {
            show_config_version_id: OTHER_SHOW_CONFIG,
          }),
        ),
      ).toMatchObject({ kind: "rejected", code: "config_show_mismatch" });
      const bad = (extra: Obj) =>
        createProgramAttempt(pool, {
          ...attempt(r.program_run_id),
          ...extra,
        });
      expect(await bad({ publication_enabled: true })).toMatchObject({
        kind: "rejected",
        code: "publication_not_permitted",
      });
      // an explicit null is NOT "absent": it is refused before any write (parent/repair null remain the same request as absent)
      expect(await bad({ publication_enabled: null })).toMatchObject({
        kind: "rejected",
        code: "publication_not_permitted",
      });
      expect(await bad({ parent_attempt_id: randomUUID() })).toMatchObject({
        kind: "rejected",
        code: "repair_not_supported",
      });
      expect(await bad({ repair_plan_id: randomUUID() })).toMatchObject({
        kind: "rejected",
        code: "repair_not_supported",
      });
      for (const extra of [
        { state: "EVIDENCE_READY" },
        { evidence_package_id: randomUUID() },
        { program_run_state: "PENDING" },
      ])
        expect(await bad(extra)).toMatchObject({
          kind: "rejected",
          code: "unsupported_field",
        });
      expect(await count(env, "program_run_attempts")).toBe(0);
      const bound = await ownerRows(
        env,
        "SELECT show_config_version_id, publication_enabled FROM program_runs WHERE program_run_id = $1",
        [r.program_run_id],
      );
      expect(bound[0]).toEqual({
        show_config_version_id: null,
        publication_enabled: null,
      });
      expect(await otherTablesDigest(env)).toBe(digest);
    } finally {
      await pool.end();
      await env.close();
    }
  });

  it("a run already bound to one config refuses a different config for a NEW attempt (typed conflict, nothing written)", async () => {
    const env = await fresh();
    const pool = runtimePool(env);
    try {
      const r = run();
      await createProgramRun(pool, r);
      expect(
        (await createProgramAttempt(pool, attempt(r.program_run_id))).kind,
      ).toBe("created");
      const o = await createProgramAttempt(
        pool,
        attempt(r.program_run_id, { show_config_version_id: CONFIG_B }),
      );
      expect(o).toMatchObject({
        kind: "conflict",
        code: "run_config_binding_mismatch",
      });
      expect(await count(env, "program_run_attempts")).toBe(1);
    } finally {
      await pool.end();
      await env.close();
    }
  });

  const insertAttemptSql =
    "INSERT INTO program_run_attempts (attempt_id, program_run_id, show_config_version_id, created_at) VALUES ($1,$2,$3,$4)";
  const insertValues = (a: AuthoredProgramAttempt): string[] => [
    a.attempt_id,
    a.program_run_id,
    a.show_config_version_id,
    a.created_at,
  ];
  const settled = (p: Promise<unknown>): Promise<unknown> =>
    p.then(
      (o) => o,
      (e: unknown) => e,
    );

  it("PARTICIPATING first attempts of one run are serialized by the per-run lock: exactly one binds and the other gets the TYPED conflict, deterministically", async () => {
    const env = await fresh();
    try {
      await withRace(env, 4, async ({ holder, pool, track }) => {
        const r = run();
        await createProgramRun(pool, r);
        // the holder owns the SAME lock the command takes, so both creators are provably queued on it before either proceeds
        await holder.query("BEGIN");
        await holder.query(
          "SELECT pg_advisory_xact_lock($1, hashtext($2::text))",
          [PROGRAM_ATTEMPT_LOCK_CLASS, r.program_run_id],
        );
        const holderPid = await backendPid(holder);
        const a = track(createProgramAttempt(pool, attempt(r.program_run_id)));
        const b = track(
          createProgramAttempt(
            pool,
            attempt(r.program_run_id, { show_config_version_id: CONFIG_B }),
          ),
        );
        await waitForBlocked(
          env.owner,
          env.name,
          (w) =>
            w.filter(
              (x) =>
                x.locktype === "advisory" && x.blockers.includes(holderPid),
            ).length >= 2,
        );
        await holder.query("COMMIT");
        const outcomes = [await a, await b];
        expect(outcomes.filter((o) => o.kind === "created")).toHaveLength(1);
        expect(outcomes.filter((o) => o.kind === "conflict")).toEqual([
          expect.objectContaining({ code: "run_config_binding_mismatch" }),
        ]);
        expect(await count(env, "program_run_attempts")).toBe(1);
      });
    } finally {
      await env.close();
    }
  });

  it("OUT-OF-PROTOCOL first insert (a privileged writer that does not take the lock): the participating loser sees the ORIGINAL guard error, and an identical retry returns the truthful typed result", async () => {
    const env = await fresh();
    try {
      await withRace(env, 4, async ({ holder, pool, track }) => {
        const r = run();
        await createProgramRun(pool, r);
        const winner = attempt(r.program_run_id);
        await holder.query("BEGIN");
        await holder.query(insertAttemptSql, insertValues(winner));
        const holderPid = await backendPid(holder);
        const loserRequest = attempt(r.program_run_id, {
          show_config_version_id: CONFIG_B,
        });
        const loser = settled(track(createProgramAttempt(pool, loserRequest)));
        await waitForBlocked(env.owner, env.name, (w) =>
          w.some((x) => x.blockers.includes(holderPid)),
        );
        await holder.query("COMMIT");
        // the guard's own generic P0001 is NOT reinterpreted from rows: the original error surfaces
        const error = await loser;
        expect(error).toBeInstanceOf(Error);
        expect(error).toMatchObject({ code: "P0001" });
        expect(await count(env, "program_run_attempts")).toBe(1);
        // the identical caller retry now sees committed rows and returns the truthful outcome
        expect(await createProgramAttempt(pool, loserRequest)).toMatchObject({
          kind: "conflict",
          code: "run_config_binding_mismatch",
        });
      });
    } finally {
      await env.close();
    }
  });

  it("an UNRELATED P0001 raised after a concurrent first binding CHANGED the run binding is rethrown unchanged (never a domain conflict)", async () => {
    const env = await fresh();
    try {
      await withRace(env, 4, async ({ holder, pool, track }) => {
        const r = run();
        await createProgramRun(pool, r);
        // fires for the victim session only, BEFORE the guard (name order), once the holder has released advisory lock 777
        await env.owner.query(
          `CREATE FUNCTION g6_unrelated_p0001() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
             IF current_setting('application_name') = 'g6_victim' THEN
               PERFORM pg_advisory_xact_lock(777);
               RAISE EXCEPTION 'g6 unrelated custom guard' USING ERRCODE = 'P0001';
             END IF;
             RETURN NEW; END $$`,
        );
        await env.owner.query(
          "CREATE TRIGGER aa_g6_unrelated BEFORE INSERT ON program_run_attempts FOR EACH ROW EXECUTE FUNCTION g6_unrelated_p0001()",
        );
        await holder.query("BEGIN");
        await holder.query("SELECT pg_advisory_xact_lock(777)");
        await holder.query(
          insertAttemptSql,
          insertValues(attempt(r.program_run_id)),
        );
        const holderPid = await backendPid(holder);
        // the victim reads the run UNBOUND, then the holder's commit binds it to CONFIG_A: rows now "explain" a binding mismatch
        const victim = settled(
          track(
            createProgramAttempt(
              pool,
              attempt(r.program_run_id, { show_config_version_id: CONFIG_B }),
            ),
          ),
        );
        await waitForBlocked(env.owner, env.name, (w) =>
          w.some((x) => x.blockers.includes(holderPid)),
        );
        await holder.query("COMMIT");
        const result = await victim;
        expect(result).toBeInstanceOf(Error);
        expect(result).toMatchObject({ code: "P0001" });
        expect((result as Error).message).toContain(
          "g6 unrelated custom guard",
        );
        expect(await count(env, "program_run_attempts")).toBe(1);
      });
    } finally {
      await env.close();
    }
  });

  it("out-of-protocol same-identity winner: the primary-key loser rereads it BY ATTEMPT IDENTITY (converged for identical, conflict for a different instant); a different config surfaces the guard error, then the identity conflict on retry", async () => {
    const env = await fresh();
    try {
      await withRace(env, 4, async ({ holder, pool, track }) => {
        const r = run();
        await createProgramRun(pool, r);
        const winner = attempt(r.program_run_id);
        await holder.query("BEGIN");
        await holder.query(insertAttemptSql, insertValues(winner));
        const holderPid = await backendPid(holder);
        const same = track(createProgramAttempt(pool, winner));
        const differentTime = track(
          createProgramAttempt(pool, {
            ...winner,
            created_at: "2026-10-01T10:00:01.000002Z",
          }),
        );
        await waitForBlocked(
          env.owner,
          env.name,
          // the participating creators queue (the first on the run row, the rest on the per-run lock)
          (w) =>
            w.some((x) => x.blockers.includes(holderPid)) &&
            new Set(w.map((x) => x.pid)).size >= 2,
        );
        await holder.query("COMMIT");
        expect((await same).kind).toBe("converged");
        expect(await differentTime).toMatchObject({
          kind: "conflict",
          code: "program_attempt_identity_conflict",
        });
        expect(await count(env, "program_run_attempts")).toBe(1);
        // a different CONFIG for the same identity, after the winner is committed: found by identity FIRST, never as a binding conflict
        expect(
          await createProgramAttempt(pool, {
            ...winner,
            show_config_version_id: CONFIG_B,
          }),
        ).toMatchObject({
          kind: "conflict",
          code: "program_attempt_identity_conflict",
        });
      });
    } finally {
      await env.close();
    }
  });

  it("concurrent first attempts: identical id -> one creator; different ids with different configs -> one binds, one typed conflict", async () => {
    const env = await fresh();
    const pool = runtimePool(env, 8);
    try {
      const r = run();
      await createProgramRun(pool, r);
      const a = attempt(r.program_run_id);
      const same = await Promise.all(
        Array.from({ length: 6 }, () => createProgramAttempt(pool, a)),
      );
      expect(same.filter((o) => o.kind === "created")).toHaveLength(1);
      expect(same.filter((o) => o.kind === "converged")).toHaveLength(5);
      const r2 = run();
      await createProgramRun(pool, r2);
      const racers = await Promise.all([
        createProgramAttempt(pool, attempt(r2.program_run_id)),
        createProgramAttempt(
          pool,
          attempt(r2.program_run_id, { show_config_version_id: CONFIG_B }),
        ),
        createProgramAttempt(pool, attempt(r2.program_run_id)),
        createProgramAttempt(
          pool,
          attempt(r2.program_run_id, { show_config_version_id: CONFIG_B }),
        ),
      ]);
      const bound = String(
        (
          await ownerRows(
            env,
            "SELECT show_config_version_id::text AS c FROM program_runs WHERE program_run_id = $1",
            [r2.program_run_id],
          )
        )[0]?.c,
      );
      const winnersForBound = racers.filter(
        (o) =>
          o.kind === "created" && o.record.show_config_version_id === bound,
      );
      expect(winnersForBound.length).toBeGreaterThanOrEqual(1);
      for (const o of racers) {
        if (o.kind === "created")
          expect(o.record.show_config_version_id).toBe(bound);
        else
          expect(o).toMatchObject({
            kind: "conflict",
            code: "run_config_binding_mismatch",
          });
      }
      const rows = await ownerRows(
        env,
        "SELECT count(*)::int AS n FROM program_run_attempts WHERE program_run_id = $1",
        [r2.program_run_id],
      );
      expect(rows[0]?.n).toBe(
        racers.filter((o) => o.kind === "created").length,
      );
      expect(idle(pool)).toBe(true);
    } finally {
      await pool.end();
      await env.close();
    }
  });

  it("a failure AFTER the guard bound the run rolls the incidental run binding back with the attempt (nothing committed)", async () => {
    const env = await fresh();
    const pool = runtimePool(env);
    const KEY = Symbol.for("the-desk.a5.test-fault-hook");
    const globals = globalThis as Record<symbol, unknown>;
    const previous = process.env.DESK_TEST_FAULTS;
    try {
      const r = run();
      await createProgramRun(pool, r);
      const a = attempt(r.program_run_id);
      let reached = 0;
      process.env.DESK_TEST_FAULTS = "1";
      globals[KEY] = (name: string): Promise<void> => {
        if (name !== "after_attempt_insert") return Promise.resolve();
        reached += 1;
        return Promise.reject(new Error("injected failure after the guard"));
      };
      await expect(createProgramAttempt(pool, a)).rejects.toThrow(
        "injected failure after the guard",
      );
      expect(reached).toBe(1);
      expect(await count(env, "program_run_attempts")).toBe(0);
      expect(
        (
          await ownerRows(
            env,
            "SELECT show_config_version_id, publication_enabled FROM program_runs WHERE program_run_id = $1",
            [r.program_run_id],
          )
        )[0],
      ).toEqual({ show_config_version_id: null, publication_enabled: null });
      expect(idle(pool)).toBe(true);
      // the same request, with the seam disarmed, then creates and binds
      globals[KEY] = undefined;
      expect((await createProgramAttempt(pool, a)).kind).toBe("created");
      expect(
        (
          await ownerRows(
            env,
            "SELECT show_config_version_id::text AS c FROM program_runs WHERE program_run_id = $1",
            [r.program_run_id],
          )
        )[0]?.c,
      ).toBe(CONFIG_A);
    } finally {
      globals[KEY] = undefined;
      if (previous === undefined) delete process.env.DESK_TEST_FAULTS;
      else process.env.DESK_TEST_FAULTS = previous;
      await pool.end();
      await env.close();
    }
  });

  it("an unrelated database error is rethrown unchanged, never classified or swallowed", async () => {
    const env = await fresh();
    const pool = runtimePool(env);
    try {
      const r = run();
      await createProgramRun(pool, r);
      // a privileged-only trigger makes the INSERT fail with an error no row explains
      await env.owner.query(
        `CREATE FUNCTION g6_unrelated() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'g6 unrelated failure' USING ERRCODE = 'P0001'; END $$`,
      );
      await env.owner.query(
        "CREATE TRIGGER g6_unrelated BEFORE INSERT ON program_run_attempts FOR EACH ROW EXECUTE FUNCTION g6_unrelated()",
      );
      await expect(
        createProgramAttempt(pool, attempt(r.program_run_id)),
      ).rejects.toThrow("g6 unrelated failure");
      expect(await count(env, "program_run_attempts")).toBe(0);
      expect(idle(pool)).toBe(true);
    } finally {
      await pool.end();
      await env.close();
    }
  });

  for (const code of ["23514", "P0001", "42501"])
    it(`an UNRELATED error (${code}) is rethrown unchanged even though a matching winner now exists (attempt and run)`, async () => {
      const env = await fresh();
      try {
        await withRace(env, 4, async ({ holder, pool, track }) => {
          // fires only for the victim session, AFTER the existing guards, and only once the holder has released the advisory lock
          for (const table of ["program_runs", "program_run_attempts"]) {
            await env.owner.query(
              `CREATE FUNCTION g6_unrelated_${table}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
               IF current_setting('application_name') = 'g6_victim' THEN
                 PERFORM pg_advisory_xact_lock(777);
                 RAISE EXCEPTION 'g6 unrelated ${code}' USING ERRCODE = '${code}';
               END IF;
               RETURN NEW; END $$`,
            );
            await env.owner.query(
              `CREATE TRIGGER zz_g6_unrelated BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION g6_unrelated_${table}()`,
            );
          }
          // ---- run: the winner (identical request) commits between the victim's identity check and its failing INSERT
          const r = run();
          await holder.query("BEGIN");
          await holder.query("SELECT pg_advisory_xact_lock(777)");
          await holder.query(
            "INSERT INTO program_runs (program_run_id, show_id, purpose, created_at) VALUES ($1,$2,$3,$4)",
            [r.program_run_id, r.show_id, r.purpose, r.created_at],
          );
          const holderPid = await backendPid(holder);
          const settledRun = settled(track(createProgramRun(pool, r)));
          await waitForBlocked(env.owner, env.name, (w) =>
            w.some((x) => x.blockers.includes(holderPid)),
          );
          await holder.query("COMMIT");
          expect(await settledRun).toMatchObject({ code });
          expect(await count(env, "program_runs")).toBe(1);
          // ---- attempt: same shape
          const a = attempt(r.program_run_id);
          await holder.query("BEGIN");
          await holder.query("SELECT pg_advisory_xact_lock(777)");
          await holder.query(
            "INSERT INTO program_run_attempts (attempt_id, program_run_id, show_config_version_id, created_at) VALUES ($1,$2,$3,$4)",
            [
              a.attempt_id,
              a.program_run_id,
              a.show_config_version_id,
              a.created_at,
            ],
          );
          const holderPid2 = await backendPid(holder);
          const settledAttempt = settled(track(createProgramAttempt(pool, a)));
          await waitForBlocked(env.owner, env.name, (w) =>
            w.some((x) => x.blockers.includes(holderPid2)),
          );
          await holder.query("COMMIT");
          const result = await settledAttempt;
          // not a domain result: the ORIGINAL database error, even though the identical winner is committed
          expect(result).toBeInstanceOf(Error);
          expect(result).toMatchObject({ code });
          expect((result as Error).message).toContain(`g6 unrelated ${code}`);
          expect(await count(env, "program_run_attempts")).toBe(1);
        });
      } finally {
        await env.close();
      }
    });

  it("cleanup is ordered and complete even when the body fails after a victim is already blocked (no leaked sessions, original failure kept)", async () => {
    const env = await fresh();
    try {
      let victim: Promise<unknown> | undefined;
      await expect(
        withRace(env, 2, async ({ holder, pool, track }) => {
          const r = run();
          await holder.query("BEGIN");
          await holder.query(
            "INSERT INTO program_runs (program_run_id, show_id, purpose, created_at) VALUES ($1,$2,$3,$4)",
            [r.program_run_id, r.show_id, r.purpose, r.created_at],
          );
          const holderPid = await backendPid(holder);
          victim = track(createProgramRun(pool, r));
          await waitForBlocked(env.owner, env.name, (w) =>
            w.some((x) => x.blockers.includes(holderPid)),
          );
          throw new Error("injected failure while a victim is blocked");
        }),
      ).rejects.toThrow("injected failure while a victim is blocked");
      // the holder was rolled back first, so the blocked victim finished (it created the row the holder never committed)
      expect(await victim).toMatchObject({ kind: "created" });
      expect(await count(env, "program_runs")).toBe(1);
      // every g6_victim / g6_holder session of THIS database is gone from pg_stat_activity: a bounded wait on that database fact (the
      // existing `observe`, no fixed sleep); at the deadline the zero is still strictly required
      await sessionsGone(env, 15000);
    } finally {
      await env.close();
    }
  });

  it("control (synthetic): a genuinely RETAINED session still fails the same bounded zero check; ending it lets the check pass", async () => {
    const env = await fresh();
    const retained = new pg.Client({
      connectionString: env.runtimeUrl,
      options: "-c role=desk_runtime",
      application_name: "g6_victim",
    });
    let ended = false;
    try {
      await retained.connect();
      await expect(sessionsGone(env, 1500)).rejects.toThrow(
        "no g6_victim/g6_holder session remains",
      );
      await retained.end();
      ended = true;
      await sessionsGone(env, 15000); // it was the retained session: with it gone the same check passes
    } finally {
      if (!ended) await retained.end();
      await env.close();
    }
  });

  it("retries converge after the REAL package binding and state changes (mutable fields reported, never compared)", async () => {
    const env = await fresh();
    const pool = runtimePool(env);
    try {
      const fixtureRun = {
        program_run_id: String(FIXTURE_RUN.program_run_id),
        show_id: String(FIXTURE_RUN.show_id),
        purpose: FIXTURE_RUN.purpose as "evaluation",
        created_at: String(FIXTURE_RUN.created_at),
      };
      const fixtureAttempt: AuthoredProgramAttempt = {
        attempt_id: String(FIXTURE_ATTEMPT.attempt_id),
        program_run_id: String(FIXTURE_ATTEMPT.program_run_id),
        show_config_version_id: String(FIXTURE_ATTEMPT.show_config_version_id),
        created_at: String(FIXTURE_ATTEMPT.created_at),
      };
      expect(fixtureAttempt.attempt_id).toBe(must(attemptIds()[0]));
      expect((await createProgramRun(pool, fixtureRun)).kind).toBe("created");
      expect((await createProgramAttempt(pool, fixtureAttempt)).kind).toBe(
        "created",
      );
      // real package + binding through the A5.1 slice, then real lifecycle movement through the database function
      await prepareUnitsAndSupports(env.migrator, pool);
      const slice = await runSliceObserved(pool, sliceInput(0));
      expect(slice.complete).toBe(true);
      await pool.query(
        "SELECT transition_attempt($1,'PENDING','EVIDENCE_READY')",
        [fixtureAttempt.attempt_id],
      );
      // the run's own state moves only with an attempt at that state (existing guard); both retries still converge
      await pool.query("SELECT transition_run($1,'PENDING','EVIDENCE_READY')", [
        fixtureRun.program_run_id,
      ]);
      const runRetry = await createProgramRun(pool, fixtureRun);
      expect(runRetry).toMatchObject({
        kind: "converged",
        record: {
          state: "EVIDENCE_READY",
          show_config_version_id: fixtureAttempt.show_config_version_id,
          publication_enabled: false,
        },
      });
      await pool.query(
        "SELECT transition_attempt($1,'EVIDENCE_READY','PACKAGED')",
        [fixtureAttempt.attempt_id],
      );
      const retried = await createProgramAttempt(pool, fixtureAttempt);
      expect(retried.kind).toBe("converged");
      expect(retried).toMatchObject({
        record: { state: "PACKAGED", run: { state: "EVIDENCE_READY" } },
      });
      expect(
        (retried as { record: { evidence_package_id: string | null } }).record
          .evidence_package_id,
      ).not.toBeNull();
      await pool.query("SELECT transition_attempt($1,'PACKAGED','PLANNED')", [
        fixtureAttempt.attempt_id,
      ]);
      expect((await createProgramAttempt(pool, fixtureAttempt)).kind).toBe(
        "converged",
      );
      // equivalence with the loader's governed columns for the same authored values
      const rows = await ownerRows(
        env,
        `SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at, show_id::text, purpose FROM program_runs`,
      );
      expect(rows[0]).toEqual({
        created_at: fixtureRun.created_at,
        show_id: fixtureRun.show_id,
        purpose: fixtureRun.purpose,
      });
    } finally {
      await pool.end();
      await env.close();
    }
  });

  it("a command-created fixture evaluation attempt reaches VALIDATED through the permitted chain (real package binding) and the existing guard refuses READY; runtime SQL publication-enable is refused", async () => {
    const env = await fresh();
    const pool = runtimePool(env);
    try {
      const fixtureRun = {
        program_run_id: String(FIXTURE_RUN.program_run_id),
        show_id: String(FIXTURE_RUN.show_id),
        purpose: FIXTURE_RUN.purpose as "evaluation",
        created_at: String(FIXTURE_RUN.created_at),
      };
      const fixtureAttempt: AuthoredProgramAttempt = {
        attempt_id: String(FIXTURE_ATTEMPT.attempt_id),
        program_run_id: String(FIXTURE_ATTEMPT.program_run_id),
        show_config_version_id: String(FIXTURE_ATTEMPT.show_config_version_id),
        created_at: String(FIXTURE_ATTEMPT.created_at),
      };
      expect((await createProgramRun(pool, fixtureRun)).kind).toBe("created");
      expect((await createProgramAttempt(pool, fixtureAttempt)).kind).toBe(
        "created",
      );
      await prepareUnitsAndSupports(env.migrator, pool);
      expect((await runSliceObserved(pool, sliceInput(0))).complete).toBe(true);
      const chain = [
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
      for (let i = 1; i < chain.length; i += 1)
        await pool.query("SELECT transition_attempt($1,$2,$3)", [
          fixtureAttempt.attempt_id,
          chain[i - 1],
          chain[i],
        ]);
      const atValidated = await createProgramAttempt(pool, fixtureAttempt);
      expect(atValidated).toMatchObject({
        kind: "converged",
        record: { state: "VALIDATED" },
      });
      // the existing database guard, exactly: an evaluation attempt cannot leave VALIDATED for READY (the state is unchanged)
      await expect(
        pool.query("SELECT transition_attempt($1,'VALIDATED','READY',$2,$3)", [
          fixtureAttempt.attempt_id,
          "a".repeat(64),
          randomUUID(),
        ]),
      ).rejects.toThrow(
        "evaluation cannot enable publication or pass VALIDATED",
      );
      expect(
        (await lookupProgramAttempt(pool, fixtureAttempt.attempt_id))?.state,
      ).toBe("VALIDATED");
      // an evaluation attempt cannot enable publication at all (runtime SQL)
      await expect(
        pool.query(
          "INSERT INTO program_run_attempts (attempt_id, program_run_id, show_config_version_id, created_at, publication_enabled) VALUES ($1,$2,$3,now(),true)",
          [randomUUID(), fixtureRun.program_run_id, CONFIG_A],
        ),
      ).rejects.toThrow(
        "evaluation cannot enable publication or pass VALIDATED",
      );
      // production: the guard demands privileged setup (SQLSTATE 42501) for publication enablement by the runtime role
      const p = run({ purpose: "production" });
      await createProgramRun(pool, p);
      await expect(
        pool.query(
          "INSERT INTO program_run_attempts (attempt_id, program_run_id, show_config_version_id, created_at, publication_enabled) VALUES ($1,$2,$3,now(),true)",
          [randomUUID(), p.program_run_id, CONFIG_A],
        ),
      ).rejects.toMatchObject({ code: "42501" });
      // the runtime role has no UPDATE on either table (the command needs none)
      for (const t of ["program_runs", "program_run_attempts"]) {
        const g = await ownerRows(
          env,
          "SELECT has_table_privilege('desk_runtime', $1, 'UPDATE') AS u, has_table_privilege('desk_runtime', $1, 'INSERT') AS i",
          [t],
        );
        expect(g[0]).toEqual({ u: false, i: true });
      }
      // the production-purpose attempt created by the command carries publication disabled
      const pa = await createProgramAttempt(pool, attempt(p.program_run_id));
      expect(pa).toMatchObject({
        kind: "created",
        record: {
          publication_enabled: false,
          run: { publication_enabled: false },
        },
      });
    } finally {
      await pool.end();
      await env.close();
    }
  });

  it("the commands write nowhere but the two governed tables", async () => {
    const env = await fresh();
    const pool = runtimePool(env);
    try {
      const digest = await otherTablesDigest(env);
      const r = run();
      await createProgramRun(pool, r);
      const a = attempt(r.program_run_id);
      await createProgramAttempt(pool, a);
      expect(await otherTablesDigest(env)).toBe(digest);
    } finally {
      await pool.end();
      await env.close();
    }
  });

  // Ambiguity protocol on a REAL process death: the child commits, is held after COMMIT and before returning (the existing fault
  // seam), and is SIGKILLed; the committed row is read back and the identical request converges.
  it("lost acknowledgment, real child SIGKILL after COMMIT before return: createProgramRun reads back and converges", async () => {
    const env = await fresh();
    const pool = runtimePool(env);
    try {
      const r = run();
      const done = await withChild(
        env.owner,
        env.name,
        {
          url: env.runtimeUrl,
          tag: "g6run",
          fault: "after_commit_before_return",
          scenario: "program_run",
          run: r,
        },
        async () => {
          await observe(
            async () =>
              (await lookupProgramRun(pool, r.program_run_id)) !== null,
            "program run committed",
          );
        },
      );
      expect(done.signal).toBe("SIGKILL");
      expect(done.stdout).not.toContain("COMPLETED_WITHOUT_FAULT");
      expect(await lookupProgramRun(pool, r.program_run_id)).toMatchObject({
        program_run_id: r.program_run_id,
        created_at: "2026-10-01T10:00:00.123456Z",
      });
      expect((await createProgramRun(pool, r)).kind).toBe("converged");
      expect(await count(env, "program_runs")).toBe(1);
    } finally {
      await pool.end();
      await env.close();
    }
  });

  it("lost acknowledgment, real child SIGKILL after COMMIT before return: createProgramAttempt reads back (with the run binding) and converges", async () => {
    const env = await fresh();
    const pool = runtimePool(env);
    try {
      const r = run();
      await createProgramRun(pool, r);
      const a = attempt(r.program_run_id);
      const done = await withChild(
        env.owner,
        env.name,
        {
          url: env.runtimeUrl,
          tag: "g6attempt",
          fault: "after_commit_before_return",
          scenario: "program_attempt",
          programAttempt: a,
        },
        async () => {
          await observe(
            async () =>
              (await lookupProgramAttempt(pool, a.attempt_id)) !== null,
            "program attempt committed",
          );
        },
      );
      expect(done.signal).toBe("SIGKILL");
      expect(done.stdout).not.toContain("COMPLETED_WITHOUT_FAULT");
      expect(await lookupProgramAttempt(pool, a.attempt_id)).toMatchObject({
        attempt_id: a.attempt_id,
        show_config_version_id: CONFIG_A,
        run: { show_config_version_id: CONFIG_A, publication_enabled: false },
      });
      expect((await createProgramAttempt(pool, a)).kind).toBe("converged");
      expect(await count(env, "program_run_attempts")).toBe(1);
    } finally {
      await pool.end();
      await env.close();
    }
  });

  it("existing G3 trace behavior: one closed-vocabulary event per command with the authored run and attempt ids", async () => {
    const env = await fresh();
    const pool = runtimePool(env);
    try {
      const { context, events } = capturingContext();
      const ctx = { ...context, stage: "standalone" as const };
      const r = run();
      await createProgramRun(pool, r, ctx);
      const a = attempt(r.program_run_id);
      await createProgramAttempt(pool, a, ctx);
      await createProgramAttempt(pool, a, ctx);
      await createProgramAttempt(
        pool,
        { ...a, created_at: "2026-10-02T00:00:00Z" },
        ctx,
      );
      await createProgramRun(pool, keyed(run(), { state: "READY" }), ctx);
      await createProgramAttempt(pool, attempt(randomUUID()), ctx);
      expect(events.map((e) => [e.command, e.outcome, e.code ?? null])).toEqual(
        [
          ["program_run.create", "created", null],
          ["program_attempt.create", "created", null],
          ["program_attempt.create", "converged", null],
          [
            "program_attempt.create",
            "conflict",
            "program_attempt_identity_conflict",
          ],
          ["program_run.create", "rejected", "unsupported_field"],
          ["program_attempt.create", "rejected", "run_not_found"],
        ],
      );
      expect(events[0]).toMatchObject({
        program_run_id: r.program_run_id,
        durability: "committed",
      });
      expect(events[1]).toMatchObject({
        attempt_id: a.attempt_id,
        program_run_id: r.program_run_id,
        durability: "committed",
      });
      expect(events[3]).toMatchObject({ durability: "not_committed" });
      for (const e of events)
        expect(e.correlation_id).toBe(context.correlationId);
    } finally {
      await pool.end();
      await env.close();
    }
  });
});
