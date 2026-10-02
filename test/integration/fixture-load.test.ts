import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";

import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrate } from "../../src/db/migrations.js";
import { allTables, families } from "../../src/fixture/families.js";
import { FIXTURE_V046_PINS } from "../../src/fixture/pins.js";
import {
  FixtureReadBackError,
  FixtureTargetNotEmptyError,
  persistFixture,
} from "../../src/fixture/persist.js";
import { FixtureVerificationError } from "../../src/fixture/verify.js";
import {
  scriptHash,
  showrunnerBriefHash,
  writerViewHash,
} from "../../src/identity/artifacts.js";
import { showConfigVersionHash } from "../../src/identity/show-config.js";
import { TestCluster, type DbEnv } from "../support/db-env.js";
import {
  consistentPack,
  editRows,
  must,
  obj,
  rowOf,
} from "../support/fixture-pack.js";

// Loader/persistence acceptance proofs on disposable PostgreSQL 17 databases (TEST_DATABASE_URL, superuser bootstrap only).
const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const cluster = databaseUrl ? new TestCluster(databaseUrl) : undefined;
let only001 = "";

const count = async (db: pg.Pool, table: string): Promise<number> =>
  Number(
    (await db.query<{ n: string }>(`SELECT count(*) AS n FROM "${table}"`))
      .rows[0]?.n,
  );
const counts = async (db: pg.Pool): Promise<Record<string, number>> =>
  Object.fromEntries(
    await Promise.all(
      allTables.map(async (t) => [t, await count(db, t)] as const),
    ),
  );
const total = (c: Record<string, number>): number =>
  Object.values(c).reduce((a, b) => a + b, 0);
const digest = async (db: pg.Pool): Promise<string> => {
  const h = createHash("sha256");
  for (const t of allTables)
    h.update(
      JSON.stringify(
        (await db.query(`SELECT to_jsonb(x) AS r FROM "${t}" x ORDER BY 1`))
          .rows,
      ),
    );
  return h.digest("hex");
};
const theCluster = (): TestCluster => must(cluster);
const fresh = (): Promise<DbEnv> => theCluster().create({ migrate: true });
const rejects = async (p: Promise<unknown>): Promise<unknown> => {
  try {
    await p;
  } catch (error) {
    return error;
  }
  throw new Error("expected rejection");
};
suite("Fixture v0.4.6 load (A2)", () => {
  beforeAll(async () => {
    await cluster?.bootstrap();
    only001 = await mkdtemp(join(tmpdir(), "desk-fl-001-"));
    await copyFile(
      "migrations/001_foundation.sql",
      join(only001, "001_foundation.sql"),
    );
  }, 60000);
  afterAll(async () => {
    await cluster?.shutdown();
    await rm(only001, { recursive: true, force: true });
  }, 60000);

  it("loads the verified fixture into an empty migrated database in one transaction and the persisted rows match", async () => {
    const env = await fresh();
    const result = await persistFixture(env.migrator);
    expect(result.rows).toBe(398);
    expect(result.families).toBe(40);
    const stored = await counts(env.owner);
    for (const [table, n] of Object.entries(FIXTURE_V046_PINS.familyCounts))
      expect(stored[table], table).toBe(n);
    expect(total(stored)).toBe(398);
    // Independent checks over actual persisted rows (not the loader's own read-back).
    const artifacts = (
      await env.owner.query(
        "SELECT artifact_id, artifact_type, content_hash, canonical_payload FROM artifacts",
      )
    ).rows as {
      artifact_id: string;
      artifact_type: string;
      content_hash: string;
      canonical_payload: Record<string, unknown>;
    }[];
    expect(artifacts).toHaveLength(36);
    const type = (t: string): (typeof artifacts)[number] =>
      must(artifacts.find((a) => a.artifact_type === t));
    const brief = type("showrunner_brief");
    expect(showrunnerBriefHash(brief.canonical_payload)).toBe(
      brief.content_hash,
    );
    for (const t of ["script_pass1", "script_craft_revision", "script_pass2"])
      expect(
        scriptHash(type(t).canonical_payload, {
          brief: brief.canonical_payload,
        }),
        t,
      ).toBe(type(t).content_hash);
    expect(writerViewHash(type("writer_view").canonical_payload)).toBe(
      type("writer_view").content_hash,
    );
    const configs = (
      await env.owner.query<Record<string, unknown>>(
        "SELECT * FROM show_config_versions ORDER BY version_number",
      )
    ).rows;
    expect(configs.map((c) => showConfigVersionHash(c))).toEqual(
      configs.map((c) => c.config_hash),
    );
    expect(configs[1]?.parent_version_id).toBe(
      configs[0]?.show_config_version_id,
    );
    // Historical disposition survives the jsonb round trip and the row is retained, not current.
    const hist = artifacts.find(
      (a) => a.artifact_id === FIXTURE_V046_PINS.historicalDirection.artifactId,
    );
    expect(hist?.content_hash).toBe(
      FIXTURE_V046_PINS.historicalDirection.contentHash,
    );
    expect(hist?.canonical_payload.input_fingerprint).toBeNull();
    expect(hist?.canonical_payload.input_fingerprint_disposition).toBe(
      "historical_producer_inputs_not_recorded",
    );
    expect(
      artifacts.find(
        (a) =>
          a.artifact_type === "performance_direction" &&
          a.artifact_id !== hist?.artifact_id,
      ),
    ).toBeDefined();
    // Bindings and untouched state.
    expect(
      (await env.owner.query("SELECT DISTINCT state FROM program_run_attempts"))
        .rows,
    ).toEqual([{ state: "PENDING" }]);
    expect(
      (
        await env.owner.query(
          "SELECT count(*) AS n FROM program_runs r JOIN program_run_attempts a USING (program_run_id) WHERE r.show_config_version_id = a.show_config_version_id",
        )
      ).rows[0],
    ).toEqual({ n: "2" });
    for (const t of [
      "claim_state_events",
      "episodes",
      "episode_versions",
      "review_decisions",
      "repair_requests",
      "repair_plans",
      "repair_plan_decisions",
    ])
      expect(await count(env.owner, t), t).toBe(0);
    // Loaded rows are immutable.
    await expect(
      env.migrator.query("UPDATE artifacts SET storage_uri = 'x'"),
    ).rejects.toMatchObject({ code: "55000" });
  }, 120000);

  it("the declared dependency graph equals the live foreign keys, and the declared columns equal the live columns", async () => {
    const env = await fresh();
    const live = (
      await env.owner.query(`
      SELECT c.conrelid::regclass::text AS t, c.confrelid::regclass::text AS rt,
        (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(c.conkey) WITH ORDINALITY k(n, ord) JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.n) AS cols,
        (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(c.confkey) WITH ORDINALITY k(n, ord) JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.n) AS rcols
      FROM pg_constraint c WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace`)
    ).rows as { t: string; rt: string; cols: string[]; rcols: string[] }[];
    const norm = (
      t: string,
      rt: string,
      cols: readonly string[],
      rcols: readonly string[],
    ): string => `${t}|${cols.join(",")}|${rt}|${rcols.join(",")}`;
    const declared = new Set(
      families.flatMap((f) =>
        f.foreignKeys.map((fk) =>
          norm(f.table, fk.refTable, fk.columns, fk.refColumns),
        ),
      ),
    );
    const familyTables = new Set(families.map((f) => f.table));
    const liveSet = new Set(
      live
        .filter((l) => familyTables.has(l.t))
        .map((l) => norm(l.t, l.rt, l.cols, l.rcols)),
    );
    expect([...declared].sort()).toEqual([...liveSet].sort());
    const pks = (
      await env.owner.query(
        `SELECT c.conrelid::regclass::text AS t, (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(c.conkey) WITH ORDINALITY k(n, ord) JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.n) AS cols FROM pg_constraint c WHERE c.contype = 'p' AND c.connamespace = 'public'::regnamespace`,
      )
    ).rows as { t: string; cols: string[] }[];
    expect(pks.map((p) => p.t).sort()).toEqual([...allTables].sort());
    for (const f of families)
      expect(pks.find((p) => p.t === f.table)?.cols, f.table).toEqual([
        ...f.primaryKey,
      ]);
    const cols = (
      await env.owner.query(
        "SELECT table_name, array_agg(column_name::text ORDER BY ordinal_position) AS cols, array_agg(column_name::text) FILTER (WHERE data_type = 'jsonb') AS j FROM information_schema.columns WHERE table_schema = 'public' GROUP BY table_name",
      )
    ).rows as { table_name: string; cols: string[]; j: string[] | null }[];
    for (const f of families) {
      const row = cols.find((c) => c.table_name === f.table);
      expect([...(row?.cols ?? [])].sort(), f.table).toEqual(
        [...f.columns].sort(),
      );
      expect([...(row?.j ?? [])].sort(), `${f.table} jsonb`).toEqual(
        [...f.jsonb].sort(),
      );
    }
  }, 60000);

  it("a repeated load fails atomically and leaves the first load unchanged", async () => {
    const env = await fresh();
    await persistFixture(env.migrator);
    const before = await digest(env.owner);
    const error = await rejects(persistFixture(env.migrator));
    expect(error).toBeInstanceOf(FixtureTargetNotEmptyError);
    expect((error as FixtureTargetNotEmptyError).tables).toContain("artifacts");
    expect(await digest(env.owner)).toBe(before);
    expect(total(await counts(env.owner))).toBe(398);
  }, 120000);

  it("refuses a non-empty target, naming it, and writes nothing", async () => {
    const env = await fresh();
    await env.migrator.query(
      "INSERT INTO accounts(display_name, actor_kind) VALUES ('pre-existing', 'service')",
    );
    const error = await rejects(persistFixture(env.migrator));
    expect(error).toBeInstanceOf(FixtureTargetNotEmptyError);
    expect((error as FixtureTargetNotEmptyError).tables).toEqual(["accounts"]);
    const c = await counts(env.owner);
    expect(total(c)).toBe(1);
  }, 60000);

  it("tampered packs are rejected before any write", async () => {
    const env = await fresh();
    const tampered = consistentPack((m) => {
      editRows(m, (t) => {
        rowOf(t, "claims").content_hash = "0".repeat(64);
      });
    });
    expect(
      await rejects(persistFixture(env.migrator, tampered)),
    ).toBeInstanceOf(FixtureVerificationError);
    expect(total(await counts(env.owner))).toBe(0);
  }, 60000);

  it("a LATE database failure rolls back every earlier insert (all 46 tables empty)", async () => {
    const env = await fresh();
    // Survives all A1 verification, fails only when the last-inserted family reaches its CHECK constraint.
    const late = consistentPack((m) => {
      editRows(m, (t) => {
        rowOf(t, "turn_evidence_uses").use_mode = "not_a_use_mode";
      });
    });
    const error = await rejects(persistFixture(env.migrator, late));
    expect((error as { code?: string }).code).toBe("23514");
    expect((error as Error).message).toContain("turn_evidence_uses");
    expect(total(await counts(env.owner))).toBe(0);
    // The same database then accepts the real fixture: the failed attempt left nothing behind.
    await persistFixture(env.migrator);
    expect(total(await counts(env.owner))).toBe(398);
  }, 120000);

  it("read-back checks the actual persisted rows: a trigger that alters a value is caught and rolled back", async () => {
    const env = await fresh();
    await env.owner.query(
      `CREATE FUNCTION fl_alter() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.display_name := NEW.display_name || '!'; RETURN NEW; END $$`,
    );
    await env.owner.query(
      "CREATE TRIGGER fl_alter BEFORE INSERT ON accounts FOR EACH ROW EXECUTE FUNCTION fl_alter()",
    );
    const error = await rejects(persistFixture(env.migrator));
    expect(error).toBeInstanceOf(FixtureReadBackError);
    expect((error as FixtureReadBackError).code).toBe(
      "persisted_value_mismatch",
    );
    expect(total(await counts(env.owner))).toBe(0);
  }, 120000);

  it("requires the setup role and a current migration ledger", async () => {
    const env = await fresh();
    expect(String(await rejects(persistFixture(env.runtime)))).toMatch(
      /desk_migrator/,
    );
    expect(total(await counts(env.owner))).toBe(0);
    const partial = await theCluster().create({ migrate: false });
    await migrate(partial.migrator, only001);
    expect(String(await rejects(persistFixture(partial.migrator)))).toMatch(
      /Pending migrations: 002_persistence_profile.sql/,
    );
    expect(total(await counts(partial.owner))).toBe(0);
  }, 120000);

  it("concurrent loads: exactly one commits, the other fails as non-empty, 398 rows in total", async () => {
    const env = await fresh();
    const results = await Promise.allSettled([
      persistFixture(env.migrator),
      persistFixture(env.migrator),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected");
    expect(failed?.status).toBe("rejected");
    expect(
      failed?.status === "rejected" ? failed.reason : undefined,
    ).toBeInstanceOf(FixtureTargetNotEmptyError);
    expect(total(await counts(env.owner))).toBe(398);
  }, 180000);

  it("an unrelated writer cannot race the emptiness check: the loader waits for it, then sees its row (or proceeds if it rolls back)", async () => {
    const env = await fresh();
    const writer = await env.migrator.connect();
    await writer.query("BEGIN");
    await writer.query(
      "INSERT INTO accounts(display_name, actor_kind) VALUES ('racing writer', 'service')",
    );
    let settled = false;
    const load = persistFixture(env.migrator).then(
      (v) => {
        settled = true;
        return v;
      },
      (e: unknown) => {
        settled = true;
        throw e;
      },
    );
    await sleep(1500);
    expect(settled).toBe(false); // blocked on the table locks while the writer's transaction is open
    await writer.query("COMMIT");
    writer.release();
    expect(await rejects(load)).toBeInstanceOf(FixtureTargetNotEmptyError);
    expect(total(await counts(env.owner))).toBe(1);

    const env2 = await fresh();
    const writer2 = await env2.migrator.connect();
    await writer2.query("BEGIN");
    await writer2.query(
      "INSERT INTO accounts(display_name, actor_kind) VALUES ('rolled back', 'service')",
    );
    const load2 = persistFixture(env2.migrator);
    await sleep(1500);
    await writer2.query("ROLLBACK");
    writer2.release();
    await load2;
    expect(total(await counts(env2.owner))).toBe(398);
  }, 240000);

  it("the loader coordinates with migrations through the existing migration advisory lock", async () => {
    const env = await fresh();
    const holder = await env.migrator.connect();
    await holder.query("BEGIN");
    await holder.query("SELECT pg_advisory_xact_lock(182736451, 1)");
    let settled = false;
    const load = persistFixture(env.migrator).then(() => {
      settled = true;
    });
    await sleep(1500);
    expect(settled).toBe(false);
    await holder.query("COMMIT");
    holder.release();
    await load;
    expect(total(await counts(env.owner))).toBe(398);
  }, 120000);

  it("the dev/test CLI loads once, refuses a second run and refuses staging/production without writing", async () => {
    const env = await fresh();
    const run = promisify(execFile);
    const environment = (DESK_ENV: string): NodeJS.ProcessEnv => ({
      PATH: process.env.PATH,
      DESK_ENV,
      DATABASE_URL: env.runtimeUrl.replace(/^postgres:/, "postgresql:"),
      MIGRATION_DATABASE_URL: env.migratorUrl.replace(
        /^postgres:/,
        "postgresql:",
      ),
      DEPLOYED_COMMIT: "0123456789abcdef0123456789abcdef01234567",
    });
    const cli = ["tsx", "src/db/cli.ts", "load-fixture"];
    for (const blocked of ["staging", "production"])
      await expect(
        run("npx", cli, { env: environment(blocked) }),
      ).rejects.toMatchObject({ code: 1 });
    expect(total(await counts(env.owner))).toBe(0);
    const ok = await run("npx", cli, { env: environment("test") });
    expect(obj(JSON.parse(ok.stdout.trim()) as unknown).rows).toBe(398);
    await expect(
      run("npx", cli, { env: environment("test") }),
    ).rejects.toMatchObject({ code: 1 });
    expect(total(await counts(env.owner))).toBe(398);
  }, 240000);
});
