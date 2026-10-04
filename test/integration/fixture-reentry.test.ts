import { createHash, randomUUID } from "node:crypto";

import type pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createMigrationPool, createRuntimePool } from "../../src/db/pool.js";
import { allTables } from "../../src/fixture/families.js";
import {
  FixtureTargetNotEmptyError,
  persistFixture,
  reenterCompletePinnedFixture,
  verifyCompletePinnedFixture,
} from "../../src/fixture/persist.js";
import { openFixturePack } from "../../src/fixture/pack.js";
import { VerifiedFixture } from "../../src/fixture/snapshot.js";
import { TestCluster, type DbEnv } from "../support/db-env.js";
import { observe } from "../support/a5-crash.js";
import { waitForBlocked } from "../support/pg-wait.js";
import {
  fixtureEnv,
  launchReentry,
  runReentry,
} from "../support/fixture-reentry-process.js";
import { jsonLines } from "../support/p1-entry.js";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
const cluster = url ? new TestCluster(url) : undefined;
const openDbs: DbEnv[] = [];
const fresh = async (): Promise<DbEnv> => {
  if (!cluster) throw new Error("test database required");
  const db = await cluster.create({ migrate: true });
  openDbs.push(db);
  return db;
};
const ensure = (db: DbEnv) =>
  reenterCompletePinnedFixture(db.migrator, { DESK_ENV: "test" });
const counts = async (pool: pg.Pool): Promise<number[]> => {
  const result: number[] = [];
  for (const table of allTables)
    result.push(
      Number(
        (
          await pool.query<{ n: string }>(
            `SELECT count(*) AS n FROM "${table}"`,
          )
        ).rows[0]?.n,
      ),
    );
  return result;
};
// PostgreSQL renders full precision as text; xmin/ctid additionally prove that same-valued UPDATEs were not used for reuse.
const digest = async (pool: pg.Pool): Promise<string> => {
  const hash = createHash("sha256");
  for (const table of allTables)
    hash.update(
      JSON.stringify(
        (
          await pool.query(
            `SELECT to_jsonb(x)::text AS value, x.xmin::text AS xmin, x.ctid::text AS ctid FROM "${table}" x ORDER BY 1`,
          )
        ).rows,
      ),
    );
  return hash.digest("hex");
};
const mutate = async (db: DbEnv, sql: string): Promise<void> => {
  const c = await db.owner.connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL session_replication_role = replica");
    await c.query(sql);
    await c.query("COMMIT");
  } catch (error) {
    await c.query("ROLLBACK");
    throw error;
  } finally {
    c.release();
  }
};
const refuseUnchanged = async (db: DbEnv): Promise<void> => {
  const before = await digest(db.owner);
  await expect(ensure(db)).rejects.toThrow();
  await expect(ensure(db)).rejects.toThrow(); // twice is still refusal, never a partial repair
  await expect(verifyCompletePinnedFixture(db.runtime)).rejects.toThrow();
  expect(await digest(db.owner)).toBe(before);
};

suite("complete pinned fixture re-entry (local G5 candidate only)", () => {
  beforeAll(async () => cluster?.bootstrap(), 60000);
  afterAll(async () => cluster?.shutdown(), 60000);
  afterEach(async () => {
    for (const db of openDbs.splice(0)) await db.close();
  }, 60000);

  it("fresh398; committed runtime snapshot; identical twice means no writes; old empty-only loader remains the negative control", async () => {
    const db = await fresh();
    const result = await ensure(db);
    expect(result).toMatchObject({
      outcome: "loaded",
      rows: 398,
      families: 40,
    });
    expect(allTables).toHaveLength(46);
    expect((await counts(db.owner)).reduce((a, b) => a + b, 0)).toBe(398);
    expect(await verifyCompletePinnedFixture(db.runtime)).toEqual({
      rows: 398,
      families: 40,
    });
    const before = await digest(db.owner);
    for (let i = 0; i < 2; i++)
      expect((await ensure(db)).outcome).toBe("reused");
    await expect(persistFixture(db.migrator)).rejects.toBeInstanceOf(
      FixtureTargetNotEmptyError,
    );
    expect(await digest(db.owner)).toBe(before);
    const empty = await fresh();
    expect(Object.keys(await persistFixture(empty.migrator)).sort()).toEqual([
      "families",
      "rows",
      "tables",
    ]);
  }, 30000);

  it("numeric scale-equivalent rows reuse unchanged; a single timestamp microsecond refuses in setup AND runtime", async () => {
    const db = await fresh();
    await ensure(db);
    expect(
      (
        await db.owner.query<{ type: string }>(
          "SELECT format_type(atttypid,atttypmod) AS type FROM pg_attribute WHERE attrelid='provider_call_events'::regclass AND attname='actual_cost'",
        )
      ).rows[0]?.type,
    ).toBe("numeric"); // unconstrained numeric, no typmod can erase the scale control
    const pinnedCosts = new Map(
      (
        VerifiedFixture.fromPack(openFixturePack()).rows.tables
          .provider_call_events ?? []
      )
        .filter((r) => r.actual_cost !== null)
        .map((r) => [String(r.provider_call_event_id), String(r.actual_cost)]),
    );
    await mutate(
      db,
      "UPDATE provider_call_events SET actual_cost = (actual_cost::text || '00')::numeric WHERE actual_cost IS NOT NULL",
    );
    const costs = (
      await db.owner.query<{ id: string; v: string }>(
        "SELECT provider_call_event_id AS id,actual_cost::text AS v FROM provider_call_events WHERE actual_cost IS NOT NULL",
      )
    ).rows;
    expect(costs.length).toBeGreaterThan(0);
    for (const cost of costs) {
      expect(cost.v).toBe(`${String(pinnedCosts.get(cost.id))}00`);
      expect(cost.v).not.toBe(pinnedCosts.get(cost.id));
    }
    const before = await digest(db.owner);
    expect((await ensure(db)).outcome).toBe("reused");
    await verifyCompletePinnedFixture(db.runtime);
    expect(await digest(db.owner)).toBe(before);
    await mutate(
      db,
      "UPDATE accounts SET created_at = created_at + interval '1 microsecond' WHERE account_id = (SELECT account_id FROM accounts LIMIT 1)",
    );
    await refuseUnchanged(db);
  }, 30000);

  it.each([
    [
      "non-hashed display",
      "UPDATE accounts SET display_name = 'DB_SECRET_CANARY'",
    ],
    ["non-hashed URI", "UPDATE artifacts SET storage_uri = 'DB_SECRET_CANARY'"],
    [
      "bound artifact ID",
      "UPDATE assembly_recipes r SET artifact_id = (SELECT artifact_id FROM artifacts WHERE artifact_id <> r.artifact_id LIMIT 1)",
    ],
    [
      "missing row",
      "DELETE FROM take_selections WHERE take_selection_id = (SELECT take_selection_id FROM take_selections LIMIT 1)",
    ],
    [
      "extra row",
      "INSERT INTO accounts SELECT gen_random_uuid(), 'DB_SECRET_CANARY', display_name, actor_kind, created_at FROM accounts LIMIT 1",
    ],
    ["wrong run binding", "UPDATE program_runs SET publication_enabled = true"],
    [
      "advanced lifecycle",
      "UPDATE program_run_attempts SET state = 'EVIDENCE_READY'",
    ],
  ])(
    "refuses %s twice without mutation and independent full-column verification refuses",
    async (_, sql) => {
      const db = await fresh();
      await ensure(db);
      await mutate(db, sql);
      await refuseUnchanged(db);
    },
    30000,
  );

  it("partial/unrelated targets refuse without completing them", async () => {
    for (const unrelated of [false, true]) {
      const db = await fresh();
      const accounts =
        VerifiedFixture.fromPack(openFixturePack()).rows.tables.accounts ?? [];
      await db.owner.query(
        "INSERT INTO accounts SELECT * FROM jsonb_populate_recordset(NULL::accounts, $1::jsonb)",
        [
          JSON.stringify([
            unrelated
              ? {
                  ...accounts[0],
                  account_id: randomUUID(),
                  external_subject: "DB_SECRET_CANARY",
                }
              : accounts[0],
          ]),
        ],
      );
      await refuseUnchanged(db);
      expect((await counts(db.owner)).reduce((a, b) => a + b, 0)).toBe(1);
    }
  }, 30000);

  const u = "'00000000-0000-4000-8000-000000000099'";
  const h = "'" + "a".repeat(64) + "'";
  it.each([
    [
      "claim_state_events",
      `INSERT INTO claim_state_events (claim_id,event_type,event_payload,actor_id,occurred_at,event_sequence) VALUES (${u},'contest','{}',${u},now(),1)`,
    ],
    [
      "episodes",
      `INSERT INTO episodes(program_run_id,guid,pub_date) VALUES (${u},'canary',now())`,
    ],
    [
      "episode_versions",
      `INSERT INTO episode_versions(episode_id,attempt_id,ready_candidate_fingerprint,master_artifact_id) VALUES (${u},${u},${h},${u})`,
    ],
    [
      "review_decisions",
      `INSERT INTO review_decisions(episode_version_id,actor_id,ready_candidate_fingerprint,decision) VALUES (${u},${u},${h},'halt')`,
    ],
    [
      "repair_requests",
      `INSERT INTO repair_requests(source_attempt_id,source_ready_fingerprint,actor_id,feedback) VALUES (${u},${h},${u},'canary')`,
    ],
    [
      "repair_plans",
      `INSERT INTO repair_plans(repair_request_id,plan_version,typed_plan) VALUES (${u},1,'{"repair_layer":"unknown"}')`,
    ],
    [
      "repair_plan_decisions",
      `INSERT INTO repair_plan_decisions(repair_plan_id,actor_id,decision) VALUES (${u},${u},'reject')`,
    ],
  ])(
    "refuses minted family %s without mutation",
    async (_, sql) => {
      const db = await fresh();
      await ensure(db);
      await mutate(db, sql);
      await refuseUnchanged(db);
    },
    30000,
  );

  it.each(["fixture_halfway", "fixture_before_commit"])(
    "real SIGKILL at %s rolls back every table; retry twice loads then reuses",
    async (point) => {
      const db = await fresh();
      const child = launchReentry(fixtureEnv(db), { hold: point });
      try {
        await child.held;
        expect((await counts(db.owner)).every((n) => n === 0)).toBe(true);
        expect((await child.kill()).signal).toBe("SIGKILL");
        await observe(
          async () =>
            (
              await db.owner.query<{ n: string }>(
                "SELECT count(*) AS n FROM pg_stat_activity WHERE datname=current_database() AND application_name='the-desk-migrator'",
              )
            ).rows[0]?.n === "0",
          "killed setup backend disappears",
        );
        expect((await ensure(db)).outcome).toBe("loaded");
        expect((await ensure(db)).outcome).toBe("reused");
        await verifyCompletePinnedFixture(db.runtime);
      } finally {
        await child.kill();
      }
    },
    60000,
  );

  it("observed commit, lost command acknowledgment, SIGKILL: next real process reuses without writes", async () => {
    const db = await fresh();
    const child = launchReentry(fixtureEnv(db), { hold: "commit_ack" });
    try {
      await child.held;
      expect((await counts(db.owner)).reduce((a, b) => a + b, 0)).toBe(398);
      const before = await digest(db.owner);
      const killed = await child.kill();
      expect(killed.signal).toBe("SIGKILL");
      expect(killed.stdout).not.toContain('"outcome":"loaded"');
      const retry = await runReentry(fixtureEnv(db));
      expect(retry.code).toBe(0);
      expect(
        jsonLines(retry.stdout).filter((e) => e.outcome === "reused"),
      ).toHaveLength(2);
      expect(await digest(db.owner)).toBe(before);
    } finally {
      await child.kill();
    }
  }, 60000);

  it.each([
    ["read committed", false],
    ["read committed", true],
    ["repeatable read", false],
    ["repeatable read", true],
  ] as const)(
    "real overlapping workers with PG-observed blocking; setup default=%s winner rollback=%s",
    async (isolation, rollback) => {
      const db = await fresh();
      await db.owner.query(
        `ALTER DATABASE "${db.name}" SET default_transaction_isolation TO '${isolation}'`,
      ); // This disposable database only; new CLI setup sessions inherit this default.
      const probe = createMigrationPool({
        MIGRATION_DATABASE_URL: db.migratorUrl,
      });
      try {
        expect(
          (await probe.query("SHOW default_transaction_isolation")).rows[0],
        ).toEqual({ default_transaction_isolation: isolation });
      } finally {
        await probe.end();
      }
      const winner = launchReentry(fixtureEnv(db), {
        hold: "fixture_before_commit",
      });
      let waiter: ReturnType<typeof launchReentry> | undefined;
      try {
        await winner.held;
        waiter = launchReentry(fixtureEnv(db));
        const blocked = await waitForBlocked(db.owner, db.name, (rows) =>
          rows.some(
            (r) =>
              r.application_name === "the-desk-migrator" &&
              r.locktype === "advisory" &&
              r.blockers.length === 1,
          ),
        );
        expect(
          blocked.some(
            (r) => r.wait_event_type === "Lock" && r.blockers.length === 1,
          ),
        ).toBe(true);
        if (rollback) await winner.kill();
        else winner.proc.stdin?.end("continue\n");
        const settled = await waiter.exited;
        expect(settled.code).toBe(0);
        expect(
          jsonLines(settled.stdout).filter(
            (e) => e.outcome === (rollback ? "loaded" : "reused"),
          ),
        ).toHaveLength(2);
        if (!rollback) expect((await winner.exited).code).toBe(0);
        await verifyCompletePinnedFixture(db.runtime);
        expect((await counts(db.owner)).reduce((a, b) => a + b, 0)).toBe(398);
      } finally {
        await winner.kill();
        await waiter?.kill();
      }
    },
    60000,
  );

  it("post-setup non-hashed mutation is caught by the independent runtime snapshot", async () => {
    const db = await fresh();
    const child = launchReentry(fixtureEnv(db), { hold: "commit_ack" });
    try {
      await child.held;
      await mutate(db, "UPDATE accounts SET display_name='DB_SECRET_CANARY'");
      const before = await digest(db.owner);
      child.proc.stdin?.end("continue\n");
      const result = await child.exited;
      expect(result.code).toBe(1);
      expect(result.stdout + result.stderr).not.toContain("DB_SECRET_CANARY");
      expect(
        jsonLines(result.stdout).some(
          (e) =>
            e.outcome === "failed" &&
            e.stage === "fixture_verify" &&
            e.setup_commit === "acknowledged",
        ),
      ).toBe(true);
      expect(await digest(db.owner)).toBe(before);
    } finally {
      await child.kill();
    }
  }, 60000);

  it("preflight refuses production/staging, args, same-login and wrong-target before a canary listener sees ANY connection", async () => {
    const db = await fresh();
    const { createServer } = await import("node:net");
    let connections = 0;
    const server = createServer((socket) => {
      connections++;
      socket.destroy();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("listener address missing");
      const runtime = `postgresql://runtime:URL_SECRET_CANARY@127.0.0.1:${String(address.port)}/canary`;
      const setup = runtime.replace("runtime:", "setup:");
      for (const extra of [
        { DESK_ENV: "production" },
        { DESK_ENV: "staging" },
        { MIGRATION_DATABASE_URL: runtime },
        { MIGRATION_DATABASE_URL: setup.replace("/canary", "/other") },
        { DATABASE_URL: `${runtime}?database=other` },
      ]) {
        const result = await runReentry(
          fixtureEnv(db, {
            DATABASE_URL: runtime,
            MIGRATION_DATABASE_URL: setup,
            DEPLOYED_COMMIT: "a".repeat(40),
            ...extra,
          }),
        );
        expect(result.code).toBe(1);
        expect(result.stdout + result.stderr).not.toContain(
          "URL_SECRET_CANARY",
        );
      }
      expect(
        (
          await runReentry(
            fixtureEnv(db, {
              DATABASE_URL: runtime,
              MIGRATION_DATABASE_URL: setup,
            }),
            undefined,
            ["ARG_SECRET_CANARY"],
          )
        ).code,
      ).toBe(1);
      expect(connections).toBe(0);
      expect((await counts(db.owner)).every((n) => n === 0)).toBe(true);
    } finally {
      await new Promise<void>((resolve) =>
        server.close(() => {
          resolve();
        }),
      );
    }
  }, 60000);

  it("real separate roles: runtime cannot migrate/load; migration-capable session masquerading as runtime refuses before setup writes", async () => {
    const db = await fresh();
    await expect(ensure({ ...db, migrator: db.runtime })).rejects.toThrow();
    await expect(
      db.runtime.query("CREATE TABLE unapproved_test_privilege(n integer)"),
    ).rejects.toMatchObject({ code: "42501" });
    const privileged = createRuntimePool({ DATABASE_URL: db.migratorUrl });
    try {
      await expect(verifyCompletePinnedFixture(privileged)).rejects.toThrow();
    } finally {
      await privileged.end();
    }
    // The superuser has a distinct username but can SET ROLE runtime; its underlying migration capability must still refuse.
    const runtime = new URL(db.runtimeUrl);
    const admin = new URL(url ?? "");
    runtime.username = admin.username;
    runtime.password = admin.password;
    const result = await runReentry(
      fixtureEnv(db, {
        DATABASE_URL: runtime
          .toString()
          .replace(/^postgres:\/\//, "postgresql://"),
      }),
    );
    expect(result.code).toBe(1);
    expect(
      jsonLines(result.stdout).some(
        (e) => e.stage === "runtime_preflight" && e.outcome === "failed",
      ),
    ).toBe(true);
    expect((await counts(db.owner)).every((n) => n === 0)).toBe(true);
  }, 60000);

  it.each([
    [
      "public CREATE",
      "CREATE ON SCHEMA public",
      "has_schema_privilege(%s, 'public', 'CREATE')",
    ],
    [
      "config INSERT",
      "INSERT ON TABLE show_config_versions",
      "has_table_privilege(%s, 'show_config_versions', 'INSERT')",
    ],
  ])(
    "authenticated-login direct grant %s refuses at runtime_preflight before ANY setup write",
    async (_, grant, privilege) => {
      const db = await fresh();
      const login = (
        await db.runtime.query<{ login: string }>(
          "SELECT session_user AS login",
        )
      ).rows[0]?.login;
      expect(login).toMatch(/^fl_[0-9a-f]{8}_runtime$/);
      if (!login) throw new Error("missing runtime test login");
      await db.owner.query(`GRANT ${grant} TO "${login}"`); // this disposable database only; tracked grants unchanged
      const probe = (
        await db.runtime.query<{ effective: boolean; authenticated: boolean }>(
          `SELECT ${privilege.replace("%s", "current_user")} AS effective, ${privilege.replace("%s", "session_user")} AS authenticated`,
        )
      ).rows[0];
      expect(probe).toEqual({ effective: false, authenticated: true }); // SET ROLE hides the direct login grant
      const result = await runReentry(fixtureEnv(db));
      expect(result.code).toBe(1);
      const events = jsonLines(result.stdout);
      expect(events).toHaveLength(2);
      for (const event of events)
        expect(event).toMatchObject({
          outcome: "failed",
          stage: "runtime_preflight",
          setup_commit: "not_acknowledged",
        });
      expect((await counts(db.owner)).every((n) => n === 0)).toBe(true);
    },
    60000,
  );

  it("configured logs carry one correlation and the actual two run/attempt bindings with fixed stages; canaries never leak", async () => {
    const db = await fresh();
    const result = await runReentry(
      fixtureEnv(db, {
        DEPLOYED_COMMIT: "g5-test",
      }),
    );
    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    const events = jsonLines(result.stdout);
    expect(events).toHaveLength(4);
    expect(new Set(events.map((e) => e.correlation_id)).size).toBe(1);
    const attempts = (
      await db.owner.query<{ program_run_id: string; attempt_id: string }>(
        "SELECT program_run_id,attempt_id FROM program_run_attempts",
      )
    ).rows;
    for (const event of events) {
      expect(event).toMatchObject({
        service: "the-desk",
        environment: "test",
        deployedCommit: "g5-test",
      });
      expect(event.correlation_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(
        attempts.some(
          (r) =>
            r.program_run_id === event.run_id &&
            r.attempt_id === event.attempt_id,
        ),
      ).toBe(true);
      expect(["fixture_setup", "fixture_verify"]).toContain(event.stage);
    }
    expect(result.stdout).not.toContain("SECRET_CANARY");
    const retry = await runReentry(fixtureEnv(db));
    expect(retry.code).toBe(0);
    const retryEvents = jsonLines(retry.stdout);
    expect(new Set(retryEvents.map((e) => e.correlation_id)).size).toBe(1);
    expect(retryEvents[0]?.correlation_id).not.toBe(events[0]?.correlation_id);
    const silent = await runReentry(fixtureEnv(db, { LOG_LEVEL: "silent" }));
    expect(silent.code).toBe(0);
    expect(silent.stdout).toBe("");
    await mutate(db, "UPDATE accounts SET display_name='DB_SECRET_CANARY'");
    const rejected = await runReentry(fixtureEnv(db));
    expect(rejected.code).toBe(1);
    expect(rejected.stdout + rejected.stderr).not.toContain("DB_SECRET_CANARY");
    const protectedDb = await fresh();
    expect((await runReentry(fixtureEnv(protectedDb))).code).toBe(0);
    const protectedCanary = `PROMPT_SECRET_CANARY_${randomUUID()}`;
    await mutate(
      protectedDb,
      `UPDATE prompt_manifests SET component_versions = jsonb_build_object('protected_prompt', '${protectedCanary}')`,
    );
    const protectedRows = await protectedDb.owner.query<{ canary: string }>(
      "SELECT component_versions->>'protected_prompt' AS canary FROM prompt_manifests",
    );
    expect(protectedRows.rows.length).toBeGreaterThan(0);
    expect(
      protectedRows.rows.every((row) => row.canary === protectedCanary),
    ).toBe(true);
    const beforeProtectedRefusal = await digest(protectedDb.owner);
    await expect(ensure(protectedDb)).rejects.toThrow(/prompt_manifests/);
    const protectedRefusal = await runReentry(fixtureEnv(protectedDb));
    expect(protectedRefusal.code).toBe(1);
    expect(protectedRefusal.stdout + protectedRefusal.stderr).not.toContain(
      protectedCanary,
    );
    expect(await digest(protectedDb.owner)).toBe(beforeProtectedRefusal);
  }, 60000);

  it.each(["release_event", "release_throw"])(
    "%s retains the first diagnostic and reports failure, then exact retry reuses",
    async (patch) => {
      const db = await fresh();
      const result = await runReentry(fixtureEnv(db), { patch });
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('"first_error_retained":true');
      expect(result.stdout + result.stderr).not.toContain("SECRET_CANARY");
      for (const event of jsonLines(result.stdout + result.stderr).filter(
        (e) => e.command === "fixture_reentry",
      )) {
        expect(event.correlation_id).toMatch(/^[0-9a-f-]{36}$/);
        expect(event.run_id).toMatch(/^[0-9a-f-]{36}$/);
        expect(event.attempt_id).toMatch(/^[0-9a-f-]{36}$/);
      }
      expect((await ensure(db)).outcome).toBe("reused");
    },
    60000,
  );

  it.each(["end_hang", "end_fail", "flush_hang", "flush_fail"])(
    "%s cleanup is bounded, nonzero and private after the committed work",
    async (patch) => {
      const db = await fresh();
      const result = await runReentry(fixtureEnv(db), { patch });
      expect(result.code).toBe(1);
      expect(result.ms).toBeLessThan(20000);
      expect(result.signal).toBeNull();
      expect(result.stdout + result.stderr).not.toContain("SECRET_CANARY");
      expect((await ensure(db)).outcome).toBe("reused");
    },
    60000,
  );

  it("late pool error DURING the flush deadline remains handled and cannot replace the first cleanup failure", async () => {
    const db = await fresh();
    const result = await runReentry(fixtureEnv(db), {
      patch: "late_pool_error",
    });
    expect(result.code).toBe(1);
    expect(result.signal).toBeNull();
    expect(result.ms).toBeLessThan(20000);
    expect(result.stdout).toContain('"late_pool_error_emitted":true');
    expect(result.stdout).toContain('"first_error_retained":true');
    expect(result.stdout + result.stderr).not.toContain("SECRET_CANARY");
    expect((await ensure(db)).outcome).toBe("reused");
  }, 60000);
});
