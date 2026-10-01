import { createHash, randomBytes, randomUUID } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrate, verifyMigrationIntegrity } from "../../src/db/migrations.js";
import { createMigrationPool, createRuntimePool } from "../../src/db/pool.js";

// Migration 002 acceptance proofs. Every database used here is created and dropped by this file on the
// disposable PostgreSQL 17 server named by TEST_DATABASE_URL (superuser/owner bootstrap only).
const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const run = randomBytes(4).toString("hex");
const password = randomBytes(24).toString("hex");
const admin = new pg.Pool({ connectionString: databaseUrl, max: 2 });
const hash = () => randomBytes(32).toString("hex");
const protectedTables = [
  "claim_state_events",
  "claim_supports",
  "claims",
  "derivation_runs",
  "evidence_packages",
  "evidence_units",
  "prompt_manifests",
  "pronunciation_renderings",
  "pronunciations",
  "render_manifests",
  "turn_claim_uses",
  "turn_evidence_uses",
];
const eightTables = [
  "claims",
  "claim_state_events",
  "evidence_units",
  "claim_supports",
  "derivation_runs",
  "pronunciations",
  "pronunciation_renderings",
  "prompt_manifests",
];

interface Env {
  name: string;
  owner: pg.Pool;
  migrator: pg.Pool;
  runtime: pg.Pool;
  runtimeUrl: string;
  close(): Promise<void>;
}

const created: Env[] = [];
let counter = 0;
let only001 = "";
const logins = {
  migrator: `m002_${run}_migrator`,
  runtime: `m002_${run}_runtime`,
};

function urlFor(database: string, user?: string, secret?: string): string {
  const url = new URL(databaseUrl ?? "");
  url.pathname = `/${database}`;
  if (user) url.username = user;
  if (secret) url.password = secret;
  return url.toString();
}

async function rolesSql(owner: pg.Pool): Promise<void> {
  const sql = await readFile("migrations/roles.sql", "utf8");
  // Capability roles are cluster-wide; tolerate a concurrent creator.
  for (let attempt = 0; ; attempt += 1) {
    try {
      await owner.query(sql);
      return;
    } catch (error) {
      if (attempt >= 5) throw error;
      await sleep(100 * (attempt + 1));
    }
  }
}

async function createEnv(
  options: { encoding?: "SQL_ASCII" } = {},
): Promise<Env> {
  counter += 1;
  const name = `m002_${run}_${String(counter)}`;
  await admin.query(
    options.encoding
      ? `CREATE DATABASE ${name} TEMPLATE template0 ENCODING '${options.encoding}' LC_COLLATE 'C' LC_CTYPE 'C'`
      : `CREATE DATABASE ${name} TEMPLATE template0`,
  );
  const owner = new pg.Pool({ connectionString: urlFor(name), max: 2 });
  await owner.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await rolesSql(owner);
  const migrator = createMigrationPool({
    MIGRATION_DATABASE_URL: urlFor(name, logins.migrator, password),
  });
  const runtimeUrl = urlFor(name, logins.runtime, password);
  const runtime = createRuntimePool({ DATABASE_URL: runtimeUrl });
  const env: Env = {
    name,
    owner,
    migrator,
    runtime,
    runtimeUrl,
    async close() {
      await Promise.all([owner.end(), migrator.end(), runtime.end()]);
      for (let attempt = 0; ; attempt += 1) {
        try {
          await admin.query(`DROP DATABASE IF EXISTS ${name}`);
          return;
        } catch (error) {
          // 55006: a just-ended pool connection has not finished closing yet.
          if ((error as { code?: string }).code !== "55006" || attempt >= 50)
            throw error;
          await sleep(100);
        }
      }
    },
  };
  created.push(env);
  return env;
}

async function useEnv<T>(
  fn: (env: Env) => Promise<T>,
  options?: { encoding?: "SQL_ASCII" },
): Promise<T> {
  const env = await createEnv(options);
  try {
    return await fn(env);
  } finally {
    await env.close();
    created.splice(created.indexOf(env), 1);
  }
}

const migrate001 = (env: Env) => migrate(env.migrator, only001);

async function runtimeClient(env: Env, isolation?: string): Promise<pg.Client> {
  const client = new pg.Client({
    connectionString: env.runtimeUrl,
    options: "-c role=desk_runtime",
  });
  await client.connect();
  if (isolation) await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
  return client;
}

async function code(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "OK";
  } catch (error) {
    return (error as { code?: string }).code ?? String(error);
  }
}

async function ledger(env: Env) {
  return (
    await env.owner.query<{
      migration_name: string;
      checksum: string;
      applied_at: Date;
    }>(
      "SELECT migration_name, checksum, applied_at FROM desk_internal.schema_migrations ORDER BY migration_name",
    )
  ).rows;
}

async function ids(sql: string, values: unknown[], db: pg.Pool) {
  const result = await db.query<{ id: string }>(sql, values);
  const id = result.rows[0]?.id;
  if (!id) throw new Error("Expected identity");
  return id;
}

async function account(env: Env) {
  return ids(
    "INSERT INTO accounts(display_name, actor_kind) VALUES ('m002', 'service') RETURNING account_id AS id",
    [],
    env.runtime,
  );
}

const claimSql =
  "INSERT INTO claims(content_hash,claim_kind,origin,subject_domain,subject,predicate,value,initial_usage_class,initial_status) VALUES ($1,'event_fact','data_provider','statistical','{}','result','{}','assertable',$2) RETURNING claim_id AS id";
async function claim(env: Env, status = "confirmed") {
  return ids(claimSql, [hash(), status], env.runtime);
}

const eventSql =
  "INSERT INTO claim_state_events(claim_id,event_type,event_payload,actor_id,occurred_at,event_sequence) VALUES ($1,'confirm','{}',$2,'2026-09-27T12:00:00Z',$3)";

async function snapshot(env: Env) {
  const q = async <T extends object>(sql: string) =>
    (await env.owner.query<T>(sql)).rows;
  const columns = await q<{
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
  }>(
    "SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY 1, ordinal_position",
  );
  const constraints = await q<{ tbl: string; conname: string; def: string }>(
    "SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2",
  );
  const indexes = await q<{
    tablename: string;
    indexname: string;
    indexdef: string;
  }>(
    "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1,2",
  );
  const triggers = await q<{ relname: string; tgname: string }>(
    "SELECT c.relname, t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace ORDER BY 1,2",
  );
  const functions = await q<{ proname: string }>(
    "SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace ORDER BY 1",
  );
  const relations = await q<{ relname: string; relkind: string }>(
    "SELECT relname, relkind FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','v','m','S','f','p') ORDER BY 1",
  );
  const privileges = await q<{ relname: string; priv: string }>(
    `SELECT c.relname, concat_ws(',',
       CASE WHEN has_table_privilege('desk_runtime', c.oid, 'SELECT') THEN 's' END,
       CASE WHEN has_table_privilege('desk_runtime', c.oid, 'INSERT') THEN 'i' END,
       CASE WHEN has_table_privilege('desk_runtime', c.oid, 'UPDATE') THEN 'u' END,
       CASE WHEN has_table_privilege('desk_runtime', c.oid, 'DELETE') THEN 'd' END,
       CASE WHEN has_table_privilege('desk_runtime', c.oid, 'TRUNCATE') THEN 't' END,
       CASE WHEN has_table_privilege('desk_operator', c.oid, 'INSERT') THEN 'oi' END) AS priv
     FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' ORDER BY 1`,
  );
  const perTable = (rows: Record<string, unknown>[], key: string) => {
    const out = new Map<string, string[]>();
    for (const row of rows) {
      const table = String(row[key]);
      out.set(table, [...(out.get(table) ?? []), JSON.stringify(row)]);
    }
    return out;
  };
  return {
    columns: perTable(columns, "table_name"),
    constraints: perTable(constraints, "tbl"),
    indexes: perTable(indexes, "tablename"),
    triggers: perTable(triggers, "relname"),
    privileges: perTable(privileges, "relname"),
    functions: functions.map((row) => row.proname),
    relations: relations.map((row) => `${row.relkind}:${row.relname}`),
  };
}

// Minimal rows that satisfy the 001-only NOT NULL/CHECK rules; FK triggers are bypassed (replica role) because
// only presence matters for the emptiness precondition.
const protectedSeeds: Record<string, string> = {
  claim_state_events: `INSERT INTO claim_state_events(claim_id,event_type,event_payload,actor_id,occurred_at) VALUES (gen_random_uuid(),'confirm','{}',gen_random_uuid(),now())`,
  claim_supports: `INSERT INTO claim_supports(claim_id,support_kind,evidence_unit_id,support_hash) VALUES (gen_random_uuid(),'evidence',gen_random_uuid(),repeat('a',64))`,
  claims: `INSERT INTO claims(content_hash,claim_kind,origin,subject_domain,subject,predicate,value,initial_usage_class) VALUES (repeat('b',64),'event_fact','data_provider','statistical','{}','result','{}','assertable')`,
  derivation_runs: `INSERT INTO derivation_runs(rule_version,exact_input_refs,output_hash) VALUES ('v1','[]',repeat('c',64))`,
  evidence_packages: `INSERT INTO evidence_packages(artifact_id,package_hash) VALUES (gen_random_uuid(),repeat('d',64))`,
  evidence_units: `INSERT INTO evidence_units(content_hash,evidence_type,usage_class,canonical_content,rights_version_id) VALUES (repeat('e',64),'fact','assertable','"x"',gen_random_uuid())`,
  prompt_manifests: `INSERT INTO prompt_manifests(component_versions,rendered_request_hash,policy_source_hashes) VALUES ('{}',repeat('f',64),'{}')`,
  pronunciation_renderings: `INSERT INTO pronunciation_renderings(pronunciation_id,provider,rendering,version) VALUES (gen_random_uuid(),'p','r',1)`,
  pronunciations: `INSERT INTO pronunciations(canonical_text) VALUES ('Northbridge')`,
  render_manifests: `INSERT INTO render_manifests(artifact_id,script_version_id,performance_direction_version_id,audit_run_id) VALUES (gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid())`,
  turn_claim_uses: `INSERT INTO turn_claim_uses(turn_id,claim_id,use_mode,span_start,span_end) VALUES (gen_random_uuid(),gen_random_uuid(),'asserted',0,1)`,
  turn_evidence_uses: `INSERT INTO turn_evidence_uses(turn_id,evidence_unit_id,use_mode,span_start,span_end) VALUES (gen_random_uuid(),gen_random_uuid(),'quoted',0,1)`,
};

async function seedBare(env: Env, sql: string) {
  const client = await env.owner.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL session_replication_role = replica");
    await client.query(sql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function columnExists(env: Env, table: string, column: string) {
  return (
    (
      await env.owner.query(
        "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2",
        [table, column],
      )
    ).rowCount === 1
  );
}

suite("Migration 002 persistence profile on disposable PostgreSQL 17", () => {
  let ready: Env;
  beforeAll(async () => {
    const version = await admin.query<{ server_version_num: string }>(
      "SHOW server_version_num",
    );
    expect(Number(version.rows[0]?.server_version_num)).toBeGreaterThanOrEqual(
      170000,
    );
    expect(Number(version.rows[0]?.server_version_num)).toBeLessThan(180000);
    only001 = await mkdtemp(join(tmpdir(), "desk-m002-001-"));
    await copyFile(
      "migrations/001_foundation.sql",
      join(only001, "001_foundation.sql"),
    );
    // Bootstrap cluster-wide capability roles and per-run LOGIN wrappers once.
    const boot = await createEnv();
    for (const [capability, login] of Object.entries(logins)) {
      await admin.query(
        `CREATE ROLE ${login} LOGIN NOINHERIT PASSWORD '${password}'`,
      );
      await admin.query(`GRANT desk_${capability} TO ${login}`);
    }
    await boot.close();
    created.splice(created.indexOf(boot), 1);
    ready = await createEnv();
    await migrate(ready.migrator);
  }, 60000);

  afterAll(async () => {
    for (const env of created) await env.close().catch(() => undefined);
    await rm(only001, { recursive: true, force: true });
    for (const login of Object.values(logins))
      await admin.query(`DROP ROLE IF EXISTS ${login}`);
    await admin.end();
  }, 60000);

  describe("runner, ledger and upgrade paths", () => {
    it("migrates a fresh database through 001+002 in one run, records checksums and repeats as a no-op", async () => {
      const rows = await ledger(ready);
      expect(rows.map((row) => row.migration_name)).toEqual([
        "001_foundation.sql",
        "002_persistence_profile.sql",
      ]);
      for (const row of rows)
        expect(row.checksum).toBe(
          createHash("sha256")
            .update(await readFile(join("migrations", row.migration_name)))
            .digest("hex"),
        );
      await expect(migrate(ready.migrator)).resolves.toBeUndefined();
      await expect(
        verifyMigrationIntegrity(ready.migrator),
      ).resolves.toBeUndefined();
      expect(await ledger(ready)).toEqual(rows);
      await expect(migrate(ready.owner)).rejects.toThrow(
        /effective desk_migrator/,
      );
    });

    it("rejects a changed 002 checksum", async () => {
      const dir = await mkdtemp(join(tmpdir(), "desk-m002-tamper-"));
      try {
        await copyFile(
          "migrations/001_foundation.sql",
          join(dir, "001_foundation.sql"),
        );
        await writeFile(
          join(dir, "002_persistence_profile.sql"),
          `${await readFile("migrations/002_persistence_profile.sql", "utf8")}\n-- tampered\n`,
        );
        await expect(migrate(ready.migrator, dir)).rejects.toThrow(
          /checksum mismatch/,
        );
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it("upgrades an empty 001 database, leaving the first ledger row intact", async () => {
      await useEnv(async (env) => {
        await migrate001(env);
        const before = await ledger(env);
        expect(before.map((row) => row.migration_name)).toEqual([
          "001_foundation.sql",
        ]);
        await migrate(env.migrator);
        const after = await ledger(env);
        expect(after).toHaveLength(2);
        expect(after[0]).toEqual(before[0]);
        expect(after[1]?.applied_at.getTime()).toBeGreaterThanOrEqual(
          before[0]?.applied_at.getTime() ?? 0,
        );
        await expect(migrate(env.migrator)).resolves.toBeUndefined();
        expect(await ledger(env)).toEqual(after);
      });
    }, 60000);

    it("changes exactly the eight tables and nothing else (catalog delta)", async () => {
      await useEnv(async (env) => {
        await migrate001(env);
        const before = await snapshot(env);
        await migrate(env.migrator);
        const after = await snapshot(env);
        expect(after.relations).toEqual(before.relations);
        expect(after.privileges).toEqual(before.privileges);
        const tables = new Set(
          before.relations
            .filter((r) => r.startsWith("r:"))
            .map((r) => r.slice(2)),
        );
        for (const kind of [
          "columns",
          "constraints",
          "indexes",
          "triggers",
        ] as const) {
          const changed = [...tables].filter(
            (table) =>
              JSON.stringify(before[kind].get(table) ?? []) !==
              JSON.stringify(after[kind].get(table) ?? []),
          );
          expect(changed.every((table) => eightTables.includes(table))).toBe(
            true,
          );
        }
        const changedTables = [...tables].filter(
          (table) =>
            JSON.stringify(before.columns.get(table)) !==
              JSON.stringify(after.columns.get(table)) ||
            JSON.stringify(before.constraints.get(table)) !==
              JSON.stringify(after.constraints.get(table)) ||
            JSON.stringify(before.indexes.get(table)) !==
              JSON.stringify(after.indexes.get(table)),
        );
        expect(changedTables.sort()).toEqual([...eightTables].sort());
        expect(
          after.functions.filter((f) => !before.functions.includes(f)),
        ).toEqual(["guard_claim_event_order", "guard_pronunciation_lineage"]);
        expect(
          before.functions.filter((f) => !after.functions.includes(f)),
        ).toEqual([]);
        expect(
          [...after.triggers.values()]
            .flat()
            .filter(
              (t) => !new Set([...before.triggers.values()].flat()).has(t),
            )
            .sort(),
        ).toEqual(
          [
            JSON.stringify({
              relname: "claim_state_events",
              tgname: "claim_event_order",
            }),
            JSON.stringify({
              relname: "pronunciations",
              tgname: "pronunciation_lineage",
            }),
          ].sort(),
        );
        // Added columns: exact set, none with a default.
        const added = (table: string) =>
          (after.columns.get(table) ?? [])
            .filter((c) => !(before.columns.get(table) ?? []).includes(c))
            .map(
              (c) =>
                JSON.parse(c) as {
                  column_name: string;
                  data_type: string;
                  is_nullable: string;
                  column_default: string | null;
                },
            )
            .map((c) => `${c.column_name}:${c.data_type}:${c.is_nullable}`);
        expect(added("claims")).toEqual(["initial_status:text:NO"]);
        expect(added("claim_state_events")).toEqual([
          "event_sequence:integer:NO",
        ]);
        expect(added("evidence_units")).toEqual([]);
        expect(added("claim_supports")).toEqual(["support_role:text:NO"]);
        expect(added("derivation_runs")).toEqual([
          "parameters:jsonb:NO",
          "output:jsonb:NO",
        ]);
        expect(added("pronunciations")).toEqual([
          "entity_identity:text:NO",
          "canonical_version:integer:NO",
          "language:text:NO",
          "ipa:text:YES",
          "supersedes_pronunciation_id:uuid:YES",
        ]);
        expect(added("pronunciation_renderings")).toEqual([
          "voice_profile_version_id:uuid:NO",
        ]);
        expect(added("prompt_manifests")).toEqual(["artifact_id:uuid:NO"]);
        for (const table of eightTables)
          for (const c of after.columns.get(table) ?? [])
            if (!(before.columns.get(table) ?? []).includes(c))
              expect(
                (JSON.parse(c) as { column_default: string | null })
                  .column_default,
              ).toBeNull();
        // Removed legacy constraints and the retained non-unique evidence index.
        const names = (snap: typeof after, table: string) =>
          (snap.constraints.get(table) ?? []).map(
            (c) => (JSON.parse(c) as { conname: string }).conname,
          );
        expect(
          names(before, "claim_state_events").filter(
            (n) => !names(after, "claim_state_events").includes(n),
          ),
        ).toEqual(["claim_state_events_claim_id_occurred_at_event_type_key"]);
        expect(
          names(before, "evidence_units").filter(
            (n) => !names(after, "evidence_units").includes(n),
          ),
        ).toEqual(["evidence_units_content_hash_key"]);
        expect(
          names(before, "pronunciations").filter(
            (n) => !names(after, "pronunciations").includes(n),
          ),
        ).toEqual(["pronunciations_canonical_text_key"]);
        expect(
          names(before, "pronunciation_renderings").filter(
            (n) => !names(after, "pronunciation_renderings").includes(n),
          ),
        ).toEqual([
          "pronunciation_renderings_pronunciation_id_provider_version_key",
        ]);
        const index = (after.indexes.get("evidence_units") ?? []).find((i) =>
          i.includes("evidence_units_content_hash_idx"),
        );
        expect(index).toBeDefined();
        expect(index).not.toMatch(/UNIQUE/);
        expect(index).toMatch(/btree \(content_hash\)/);
      });
    }, 60000);
  });

  describe("fixed lock order and protected-table preconditions", () => {
    it("locks the twelve protected tables in the governed order, then checks them in the same order", async () => {
      const sql = await readFile(
        "migrations/002_persistence_profile.sql",
        "utf8",
      );
      const lock = /LOCK TABLE\s+([\s\S]*?)\s+IN ACCESS EXCLUSIVE MODE;/.exec(
        sql,
      );
      expect(lock?.[1]?.trim().split(/\s*,\s*/)).toEqual(protectedTables);
      const array =
        /FOREACH protected_table IN ARRAY ARRAY\[([\s\S]*?)\]\s+LOOP/.exec(sql);
      expect(
        array?.[1]?.split(",").map((s) => s.trim().replaceAll("'", "")),
      ).toEqual(protectedTables);
      expect(sql.indexOf("LOCK TABLE")).toBeLessThan(
        sql.indexOf("FOREACH protected_table"),
      );
      expect(sql.indexOf("FOREACH protected_table")).toBeLessThan(
        sql.indexOf("ALTER TABLE"),
      );
      expect(sql.replace(/--.*$/gm, "")).not.toMatch(
        /\bBEGIN;|\bCOMMIT\b|\bCASCADE\b|\bDEFAULT\b/i,
      );
    });

    it.each(protectedTables)(
      "refuses a populated %s with full rollback",
      async (table) => {
        await useEnv(async (env) => {
          await migrate001(env);
          await seedBare(env, protectedSeeds[table] ?? "");
          const legacy = await snapshot(env);
          await expect(migrate(env.migrator)).rejects.toThrow(
            new RegExp(`requires empty protected table ${table}`),
          );
          expect((await ledger(env)).map((row) => row.migration_name)).toEqual([
            "001_foundation.sql",
          ]);
          for (const [t, c] of [
            ["claims", "initial_status"],
            ["claim_state_events", "event_sequence"],
            ["prompt_manifests", "artifact_id"],
          ] as const)
            expect(await columnExists(env, t, c)).toBe(false);
          const after = await snapshot(env);
          expect(after.functions).toEqual(legacy.functions);
          expect(JSON.stringify([...after.constraints])).toBe(
            JSON.stringify([...legacy.constraints]),
          );
          expect(
            (await env.owner.query(`SELECT 1 FROM ${table}`)).rowCount,
          ).toBe(1);
        });
      },
      60000,
    );

    it("does not let populated setup tables block the migration", async () => {
      await useEnv(async (env) => {
        await migrate001(env);
        await env.owner.query(
          `INSERT INTO accounts(display_name, actor_kind) VALUES ('setup', 'service');
           INSERT INTO shows(slug, title) VALUES ('s', 'S');
           INSERT INTO artifacts(artifact_type, schema_version, content_hash, canonical_payload) VALUES ('t', 'v1', repeat('1',64), '{}');
           INSERT INTO rights_versions(source_identity, policy) VALUES ('src', '{}');
           INSERT INTO voice_profiles(participant_identity) VALUES ('tully')`,
        );
        await env.owner.query(
          "INSERT INTO voice_profile_versions(voice_profile_id, version, render_fields) SELECT voice_profile_id, 1, '{}' FROM voice_profiles",
        );
        await expect(migrate(env.migrator)).resolves.toBeUndefined();
        expect(await ledger(env)).toHaveLength(2);
      });
    }, 60000);

    it("takes the table locks before inspecting: a concurrent uncommitted protected row is seen after the lock wait", async () => {
      await useEnv(async (env) => {
        await migrate001(env);
        const writer = await env.owner.connect();
        try {
          await writer.query("BEGIN");
          await writer.query(protectedSeeds.claims ?? "");
          const pending = migrate(env.migrator).then(
            () => "migrated",
            (error: unknown) => (error as Error).message,
          );
          let waiting = false;
          for (let i = 0; i < 40 && !waiting; i += 1) {
            await sleep(100);
            waiting =
              (
                await admin.query(
                  "SELECT 1 FROM pg_stat_activity WHERE datname=$1 AND application_name='the-desk-migrator' AND wait_event_type='Lock'",
                  [env.name],
                )
              ).rowCount === 1;
          }
          expect(waiting).toBe(true);
          await writer.query("COMMIT");
          expect(await pending).toMatch(
            /requires empty protected table claims/,
          );
        } finally {
          writer.release();
        }
        expect(await ledger(env)).toHaveLength(1);
      });
    }, 60000);

    it("proceeds when the concurrent protected writer rolls back", async () => {
      await useEnv(async (env) => {
        await migrate001(env);
        const writer = await env.owner.connect();
        try {
          await writer.query("BEGIN");
          await writer.query(protectedSeeds.claims ?? "");
          const pending = migrate(env.migrator);
          await sleep(500);
          await writer.query("ROLLBACK");
          await expect(pending).resolves.toBeUndefined();
        } finally {
          writer.release();
        }
        expect(await ledger(env)).toHaveLength(2);
      });
    }, 60000);

    it("fails and rolls back on unexpected schema (missing legacy constraint, pre-existing column)", async () => {
      await useEnv(async (env) => {
        await migrate001(env);
        await env.migrator.query(
          "ALTER TABLE evidence_units DROP CONSTRAINT evidence_units_content_hash_key",
        );
        await expect(migrate(env.migrator)).rejects.toThrow(/does not exist/);
        expect(await ledger(env)).toHaveLength(1);
        expect(await columnExists(env, "claims", "initial_status")).toBe(false);
      });
      await useEnv(async (env) => {
        await migrate001(env);
        await env.migrator.query(
          "ALTER TABLE claims ADD COLUMN initial_status text",
        );
        await expect(migrate(env.migrator)).rejects.toThrow(/already exists/);
        expect(await ledger(env)).toHaveLength(1);
        expect(await columnExists(env, "prompt_manifests", "artifact_id")).toBe(
          false,
        );
      });
    }, 60000);

    it("requires a UTF8 database for the NFC checks", async () => {
      await useEnv(
        async (env) => {
          await migrate001(env);
          await expect(migrate(env.migrator)).rejects.toThrow(/UTF8/);
          expect(await ledger(env)).toHaveLength(1);
        },
        { encoding: "SQL_ASCII" },
      );
    }, 60000);
  });

  describe("privileges and immutability", () => {
    it("keeps runtime at SELECT/INSERT, grants nothing on the new functions and still fires the guards", async () => {
      for (const table of eightTables) {
        const privileges = await ready.owner.query<{ priv: string }>(
          `SELECT concat_ws(',',
             CASE WHEN has_table_privilege('desk_runtime', $1, 'SELECT') THEN 's' END,
             CASE WHEN has_table_privilege('desk_runtime', $1, 'INSERT') THEN 'i' END,
             CASE WHEN has_table_privilege('desk_runtime', $1, 'UPDATE') THEN 'u' END,
             CASE WHEN has_table_privilege('desk_runtime', $1, 'DELETE') THEN 'd' END,
             CASE WHEN has_table_privilege('desk_runtime', $1, 'TRUNCATE') THEN 't' END) AS priv`,
          [table],
        );
        expect(privileges.rows[0]?.priv).toBe("s,i");
      }
      for (const fn of [
        "guard_claim_event_order()",
        "guard_pronunciation_lineage()",
      ])
        expect(
          (
            await ready.owner.query<{ allowed: boolean }>(
              "SELECT has_function_privilege('desk_runtime', $1, 'EXECUTE') AS allowed",
              [fn],
            )
          ).rows[0]?.allowed,
        ).toBe(false);
      await expect(
        ready.runtime.query("ALTER TABLE claims ADD COLUMN x text"),
      ).rejects.toThrow(/must be owner|permission denied/);
      await expect(
        ready.runtime.query("CREATE TABLE m002_probe(id int)"),
      ).rejects.toThrow(/permission denied/);
      // The guard fires for runtime inserts even without EXECUTE on the function.
      const actor = await account(ready);
      const target = await claim(ready);
      await expect(
        code(ready.runtime.query(eventSql, [target, actor, 1])),
      ).resolves.toBe("OK");
      await expect(
        code(ready.runtime.query(eventSql, [target, actor, 1])),
      ).resolves.not.toBe("OK");
    });

    it("keeps every one of the eight tables immutable, including the new columns", async () => {
      for (const table of eightTables) {
        const triggers = await ready.owner.query<{ tgname: string }>(
          "SELECT t.tgname FROM pg_trigger t WHERE t.tgrelid = $1::regclass AND t.tgname IN ('immutable_rows','immutable_truncate')",
          [table],
        );
        expect(triggers.rows.map((r) => r.tgname).sort()).toEqual([
          "immutable_rows",
          "immutable_truncate",
        ]);
        await expect(
          ready.migrator.query(`TRUNCATE ${table} CASCADE`),
        ).rejects.toThrow(/immutable relation/);
      }
      const target = await claim(ready);
      await expect(
        ready.migrator.query(
          "UPDATE claims SET initial_status='expired' WHERE claim_id=$1",
          [target],
        ),
      ).rejects.toThrow(/immutable/);
      await expect(
        ready.migrator.query("DELETE FROM claims WHERE claim_id=$1", [target]),
      ).rejects.toThrow(/immutable/);
    });
  });

  describe("constraint behaviour", () => {
    it("claims: six initial statuses only", async () => {
      for (const status of [
        "confirmed",
        "contested",
        "demoted",
        "superseded",
        "expired",
        "tombstoned",
      ])
        await expect(claim(ready, status)).resolves.toBeTruthy();
      await expect(claim(ready, "usage_changed")).rejects.toThrow(
        /check constraint/,
      );
      await expect(
        ready.runtime.query(claimSql, [hash(), null]),
      ).rejects.toThrow(/not-null/);
    });

    it("evidence_units: equal body hash with different UUIDs is lawful", async () => {
      const rights = await ids(
        "INSERT INTO rights_versions(source_identity, policy) VALUES ('s','{}') RETURNING rights_version_id AS id",
        [],
        ready.runtime,
      );
      const body = hash();
      const sql =
        "INSERT INTO evidence_units(content_hash,evidence_type,usage_class,canonical_content,rights_version_id) VALUES ($1,'fact','assertable','\"x\"',$2) RETURNING evidence_unit_id AS id";
      const a = await ids(sql, [body, rights], ready.runtime);
      const b = await ids(sql, [body, rights], ready.runtime);
      expect(a).not.toBe(b);
      await expect(
        ready.runtime.query(sql, ["not-a-hash", rights]),
      ).rejects.toThrow(/check constraint/);
    });

    it("claim_supports: five closed roles; kind/target agreement is intentionally not a SQL rule", async () => {
      const target = await claim(ready);
      const rights = await ids(
        "INSERT INTO rights_versions(source_identity, policy) VALUES ('s','{}') RETURNING rights_version_id AS id",
        [],
        ready.runtime,
      );
      const unit = await ids(
        "INSERT INTO evidence_units(content_hash,evidence_type,usage_class,canonical_content,rights_version_id) VALUES ($1,'fact','assertable','\"x\"',$2) RETURNING evidence_unit_id AS id",
        [hash(), rights],
        ready.runtime,
      );
      const sql =
        "INSERT INTO claim_supports(claim_id,support_kind,evidence_unit_id,support_hash,support_role) VALUES ($1,'evidence',$2,$3,$4)";
      for (const role of [
        "supports_value",
        "supports_attribution",
        "qualifies",
        "contradicts",
        "context_only",
      ])
        await ready.runtime.query(sql, [target, unit, hash(), role]);
      await expect(
        ready.runtime.query(sql, [target, unit, hash(), "supports"]),
      ).rejects.toThrow(/check constraint/);
      await expect(
        ready.runtime.query(sql, [target, unit, hash(), null]),
      ).rejects.toThrow(/not-null/);
      // One-target CHECK is preserved; a mismatched kind is not rejected by SQL.
      await ready.runtime.query(
        "INSERT INTO claim_supports(claim_id,support_kind,evidence_unit_id,support_hash,support_role) VALUES ($1,'lore',$2,$3,'context_only')",
        [target, unit, hash()],
      );
      await expect(
        ready.runtime.query(
          "INSERT INTO claim_supports(claim_id,support_kind,support_hash,support_role) VALUES ($1,'lore',$2,'context_only')",
          [target, hash()],
        ),
      ).rejects.toThrow(/check constraint/);
    });

    it("derivation_runs: object parameters, non-null JSON output", async () => {
      const sql =
        "INSERT INTO derivation_runs(rule_version,exact_input_refs,output_hash,parameters,output) VALUES ('v1','[]',$1,$2::jsonb,$3::jsonb)";
      await ready.runtime.query(sql, [
        hash(),
        '{"after_minute":80,"window_matches":5}',
        '{"count":3,"sample_size":5,"after_minute":80}',
      ]);
      for (const output of ["[1]", '"s"', "3", "true", "false", "0"])
        await ready.runtime.query(sql, [hash(), "{}", output]);
      for (const output of ["null"])
        await expect(
          ready.runtime.query(sql, [hash(), "{}", output]),
        ).rejects.toThrow(/check constraint/);
      await expect(
        ready.runtime.query(sql, [hash(), "[]", "{}"]),
      ).rejects.toThrow(/check constraint/);
      await expect(
        ready.runtime.query(sql, [hash(), "null", "{}"]),
      ).rejects.toThrow(/check constraint/);
      await expect(
        ready.runtime.query(sql, [hash(), "{}", null]),
      ).rejects.toThrow(/not-null/);
      await expect(
        ready.runtime.query(
          "INSERT INTO derivation_runs(rule_version,exact_input_refs,output_hash) VALUES ('v1','[]',$1)",
          [hash()],
        ),
      ).rejects.toThrow(/not-null/);
    });

    describe("pronunciation lineage", () => {
      const insert =
        "INSERT INTO pronunciations(canonical_text,entity_identity,canonical_version,language,ipa,supersedes_pronunciation_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING pronunciation_id AS id";
      const put = (
        values: [string, string, number, string, string | null, string | null],
      ) => ids(insert, values, ready.runtime);

      it("accepts version 1 then each immediate successor and keeps text non-unique", async () => {
        const entity = `entity_${randomUUID()}`;
        const v1 = await put(["Northbridge", entity, 1, "en-GB", "/n/", null]);
        const v2 = await put(["Northbridge", entity, 2, "en-GB", null, v1]);
        await put(["Northbridge", entity, 3, "en-GB", "/x/", v2]);
        await put([
          "Northbridge",
          `other_${randomUUID()}`,
          1,
          "en-GB",
          null,
          null,
        ]);
        await put(["Northbridge", entity, 1, "fr-FR", null, null]);
      });

      it("rejects every structural lineage violation", async () => {
        const entity = `entity_${randomUUID()}`;
        const v1 = await put(["N", entity, 1, "en-GB", null, null]);
        const v2 = await put(["N", entity, 2, "en-GB", null, v1]);
        const cases: [string, unknown[]][] = [
          ["version 1 with predecessor", ["N", entity, 1, "en-GB", null, v1]],
          [
            "version 2 without predecessor",
            ["N", entity, 2, "de-DE", null, null],
          ],
          ["skipped version", ["N", entity, 3, "en-GB", null, v1]],
          ["duplicate identity", ["N", entity, 2, "en-GB", null, v1]],
          ["wrong entity", ["N", `x_${randomUUID()}`, 3, "en-GB", null, v2]],
          ["wrong language", ["N", entity, 3, "fr-FR", null, v2]],
          [
            "missing predecessor",
            ["N", entity, 4, "en-GB", null, randomUUID()],
          ],
          ["zero version", ["N", entity, 0, "en-GB", null, null]],
          ["blank entity", ["N", "  ", 1, "en-GB", null, null]],
          ["blank language", ["N", entity, 1, " ", null, null]],
          [
            "blank canonical text",
            [" ", `y_${randomUUID()}`, 1, "en-GB", null, null],
          ],
          ["blank ipa", ["N", `z_${randomUUID()}`, 1, "en-GB", " ", null]],
          [
            "non-NFC canonical text",
            ["é", `n_${randomUUID()}`, 1, "en-GB", null, null],
          ],
          ["non-NFC ipa", ["N", `m_${randomUUID()}`, 1, "en-GB", "é", null]],
        ];
        for (const [label, values] of cases)
          expect(
            await code(ready.runtime.query(insert, values)),
            label,
          ).not.toBe("OK");
        const self = randomUUID();
        expect(
          await code(
            ready.runtime.query(
              "INSERT INTO pronunciations(pronunciation_id,canonical_text,entity_identity,canonical_version,language,supersedes_pronunciation_id) VALUES ($1,'N',$2,2,'en-GB',$1)",
              [self, `s_${randomUUID()}`],
            ),
          ),
          "self reference",
        ).not.toBe("OK");
      });

      it("uses immediate NO ACTION foreign keys", async () => {
        const rows = await ready.owner.query<{
          conname: string;
          confupdtype: string;
          confdeltype: string;
          condeferrable: boolean;
        }>(
          "SELECT conname, confupdtype, confdeltype, condeferrable FROM pg_constraint WHERE conname IN ('pronunciations_supersedes_fk','pronunciation_renderings_voice_profile_version_fk','prompt_manifests_artifact_id_fkey')",
        );
        expect(rows.rowCount).toBe(3);
        for (const row of rows.rows)
          expect(row).toMatchObject({
            confupdtype: "a",
            confdeltype: "a",
            condeferrable: false,
          });
      });
    });

    it("pronunciation_renderings: exact voice-version identity; provider compatibility is not SQL", async () => {
      const pronunciation = await ids(
        "INSERT INTO pronunciations(canonical_text,entity_identity,canonical_version,language) VALUES ('T',$1,1,'en-GB') RETURNING pronunciation_id AS id",
        [`r_${randomUUID()}`],
        ready.runtime,
      );
      const voice = await ids(
        "INSERT INTO voice_profiles(participant_identity) VALUES ($1) RETURNING voice_profile_id AS id",
        [`p_${randomUUID()}`],
        ready.runtime,
      );
      const v1 = await ids(
        "INSERT INTO voice_profile_versions(voice_profile_id,version,render_fields) VALUES ($1,1,'{}') RETURNING voice_profile_version_id AS id",
        [voice],
        ready.runtime,
      );
      const v2 = await ids(
        "INSERT INTO voice_profile_versions(voice_profile_id,version,render_fields) VALUES ($1,2,'{}') RETURNING voice_profile_version_id AS id",
        [voice],
        ready.runtime,
      );
      const sql =
        "INSERT INTO pronunciation_renderings(pronunciation_id,provider,rendering,version,voice_profile_version_id) VALUES ($1,$2,$3,$4,$5)";
      await ready.runtime.query(sql, [pronunciation, "tts", "t", 1, v1]);
      await ready.runtime.query(sql, [pronunciation, "tts", "t", 2, v1]);
      await ready.runtime.query(sql, [pronunciation, "tts", "t", 1, v2]);
      await ready.runtime.query(sql, [pronunciation, "other", "t", 1, v1]);
      await expect(
        ready.runtime.query(sql, [pronunciation, "tts", "t2", 1, v1]),
      ).rejects.toThrow(/unique/);
      await expect(
        ready.runtime.query(sql, [pronunciation, "tts", "t", 0, v1]),
      ).rejects.toThrow(/check constraint/);
      await expect(
        ready.runtime.query(sql, [pronunciation, " ", "t", 3, v1]),
      ).rejects.toThrow(/check constraint/);
      await expect(
        ready.runtime.query(sql, [pronunciation, "tts", " ", 3, v1]),
      ).rejects.toThrow(/check constraint/);
      await expect(
        ready.runtime.query(sql, [pronunciation, "tts", "t", 3, null]),
      ).rejects.toThrow(/not-null/);
      await expect(
        ready.runtime.query(sql, [pronunciation, "tts", "t", 3, randomUUID()]),
      ).rejects.toThrow(/foreign key/);
    });

    it("prompt_manifests: one required complete-manifest artifact per manifest", async () => {
      const artifact = await ids(
        "INSERT INTO artifacts(artifact_type,schema_version,content_hash,canonical_payload) VALUES ('prompt_manifest','v1',$1,'{}') RETURNING artifact_id AS id",
        [hash()],
        ready.runtime,
      );
      const sql =
        "INSERT INTO prompt_manifests(component_versions,rendered_request_hash,policy_source_hashes,artifact_id) VALUES ('{}',$1,'{}',$2)";
      await ready.runtime.query(sql, [hash(), artifact]);
      await expect(
        ready.runtime.query(sql, [hash(), artifact]),
      ).rejects.toThrow(/unique/);
      await expect(
        ready.runtime.query(sql, [hash(), randomUUID()]),
      ).rejects.toThrow(/foreign key/);
      await expect(ready.runtime.query(sql, [hash(), null])).rejects.toThrow(
        /not-null/,
      );
    });
  });

  describe("claim-event append order", () => {
    it("accepts sequence 1 first, allows gaps above the maximum, and accepts equal-time/type events with distinct sequences", async () => {
      const actor = await account(ready);
      const target = await claim(ready);
      await ready.runtime.query(eventSql, [target, actor, 1]);
      await ready.runtime.query(eventSql, [target, actor, 2]);
      await ready.runtime.query(eventSql, [target, actor, 9]);
      await ready.runtime.query(eventSql, [target, actor, 10]);
      const rows = await ready.runtime.query<{
        event_sequence: number;
        occurred_at: Date;
        event_type: string;
      }>(
        "SELECT event_sequence, occurred_at, event_type FROM claim_state_events WHERE claim_id=$1 ORDER BY event_sequence",
        [target],
      );
      expect(rows.rows.map((r) => r.event_sequence)).toEqual([1, 2, 9, 10]);
      expect(new Set(rows.rows.map((r) => r.occurred_at.getTime())).size).toBe(
        1,
      );
      expect(new Set(rows.rows.map((r) => r.event_type)).size).toBe(1);
    });

    it("rejects zero, negative, duplicate, non-first, equal, earlier and unused-gap sequences", async () => {
      const actor = await account(ready);
      const target = await claim(ready);
      for (const first of [0, -1, 2, 5])
        expect(
          await code(ready.runtime.query(eventSql, [target, actor, first])),
          `first=${String(first)}`,
        ).not.toBe("OK");
      await ready.runtime.query(eventSql, [target, actor, 1]);
      await ready.runtime.query(eventSql, [target, actor, 5]);
      for (const bad of [0, 1, 3, 4, 5])
        expect(
          await code(ready.runtime.query(eventSql, [target, actor, bad])),
          `bad=${String(bad)}`,
        ).not.toBe("OK");
      expect(
        (
          await ready.runtime.query<{ event_sequence: number }>(
            "SELECT event_sequence FROM claim_state_events WHERE claim_id=$1 ORDER BY event_sequence",
            [target],
          )
        ).rows.map((r) => r.event_sequence),
      ).toEqual([1, 5]);
      // Sequences are claim-local: another claim starts at 1 independently.
      const other = await claim(ready);
      await ready.runtime.query(eventSql, [other, actor, 1]);
    });

    it("applies to multi-row statements in row order and rolls the whole statement back on a violation", async () => {
      const actor = await account(ready);
      const target = await claim(ready);
      const values = (...sequences: number[]) =>
        sequences
          .map(
            (s) =>
              `('${target}','confirm','{}','${actor}','2026-09-27T12:00:00Z',${String(s)})`,
          )
          .join(",");
      const multi = (...sequences: number[]) =>
        ready.runtime.query(
          `INSERT INTO claim_state_events(claim_id,event_type,event_payload,actor_id,occurred_at,event_sequence) VALUES ${values(...sequences)}`,
        );
      expect(await code(multi(2, 1))).not.toBe("OK");
      expect(await code(multi(1, 1))).not.toBe("OK");
      expect(
        (
          await ready.runtime.query(
            "SELECT 1 FROM claim_state_events WHERE claim_id=$1",
            [target],
          )
        ).rowCount,
      ).toBe(0);
      expect(await code(multi(1, 2, 7))).toBe("OK");
    });

    it("serializes competing appenders under READ COMMITTED and preserves strict append order", async () => {
      const actor = await account(ready);
      const target = await claim(ready);
      await ready.runtime.query(eventSql, [target, actor, 1]);
      const sequences = Array.from({ length: 24 }, (_, i) => i + 2).sort(
        () => Math.random() - 0.5,
      );
      const results = await Promise.all(
        sequences.map(async (sequence) => {
          const client = await runtimeClient(ready);
          try {
            await client.query("BEGIN");
            const outcome = await code(
              client.query(eventSql, [target, actor, sequence]),
            );
            if (outcome === "OK") await client.query("COMMIT");
            else await client.query("ROLLBACK");
            return outcome;
          } finally {
            await client.end();
          }
        }),
      );
      expect(results.filter((r) => r === "OK").length).toBeGreaterThan(0);
      for (const result of results) expect(["OK", "23514"]).toContain(result);
      const rows = await ready.owner.query<{ event_sequence: number }>(
        "SELECT event_sequence FROM claim_state_events WHERE claim_id=$1 ORDER BY xmin::text::bigint",
        [target],
      );
      const accepted = rows.rows.map((r) => r.event_sequence);
      expect(accepted).toEqual([...accepted].sort((a, b) => a - b));
      expect(accepted[0]).toBe(1);
      expect(new Set(accepted).size).toBe(accepted.length);
    }, 60000);

    it("blocks a competing appender until the holder finishes, then rejects an earlier sequence or accepts after rollback", async () => {
      const actor = await account(ready);
      const target = await claim(ready);
      const holder = await runtimeClient(ready);
      const rival = await runtimeClient(ready);
      try {
        await holder.query("BEGIN");
        await holder.query(eventSql, [target, actor, 1]);
        await holder.query(eventSql, [target, actor, 5]);
        await rival.query("BEGIN");
        const rivalPid = (
          await rival.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
        ).rows[0]?.pid;
        const pending = code(rival.query(eventSql, [target, actor, 3]));
        let blocked = false;
        for (let i = 0; i < 40 && !blocked; i += 1) {
          await sleep(50);
          blocked =
            (
              await admin.query(
                "SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock' AND wait_event='advisory'",
                [rivalPid],
              )
            ).rowCount === 1;
        }
        expect(blocked).toBe(true);
        await holder.query("COMMIT");
        expect(await pending).toBe("23514");
        await rival.query("ROLLBACK");
        // Rollback of the holder lets a rival take the first slot.
        const other = await claim(ready);
        await holder.query("BEGIN");
        await holder.query(eventSql, [other, actor, 1]);
        await rival.query("BEGIN");
        const waiting = code(rival.query(eventSql, [other, actor, 1]));
        await sleep(200);
        await holder.query("ROLLBACK");
        expect(await waiting).toBe("OK");
        await rival.query("COMMIT");
      } finally {
        await holder.end();
        await rival.end();
      }
    }, 60000);

    it("does not serialize different claims against each other", async () => {
      const actor = await account(ready);
      const a = await claim(ready);
      const b = await claim(ready);
      const holder = await runtimeClient(ready);
      const other = await runtimeClient(ready);
      try {
        await holder.query("BEGIN");
        await holder.query(eventSql, [a, actor, 1]);
        await other.query("SET statement_timeout = 3000");
        await other.query(eventSql, [b, actor, 1]);
        await holder.query("ROLLBACK");
      } finally {
        await holder.end();
        await other.end();
      }
    });

    it.each(["REPEATABLE READ", "SERIALIZABLE"])(
      "%s: a stale snapshot cannot insert below, at or above a concurrently committed maximum (fails safely)",
      async (level) => {
        const actor = await account(ready);
        for (const attempt of [3, 6, 5]) {
          const target = await claim(ready);
          await ready.runtime.query(eventSql, [target, actor, 1]);
          const stale = await runtimeClient(ready, level);
          try {
            await stale.query("SELECT count(*) FROM claim_state_events");
            // A competitor commits sequence 5 after the stale snapshot was taken.
            await ready.runtime.query(eventSql, [target, actor, 5]);
            const outcome = await code(
              stale.query(eventSql, [target, actor, attempt]),
            );
            expect(outcome, `attempt ${String(attempt)}`).toBe("40001");
            await stale.query("ROLLBACK");
          } finally {
            await stale.end();
          }
          expect(
            (
              await ready.runtime.query<{ event_sequence: number }>(
                "SELECT event_sequence FROM claim_state_events WHERE claim_id=$1 ORDER BY event_sequence",
                [target],
              )
            ).rows.map((r) => r.event_sequence),
          ).toEqual([1, 5]);
        }
      },
      60000,
    );

    it("REPEATABLE READ: a snapshot taken while a competitor was in progress fails safely even after it commits", async () => {
      const actor = await account(ready);
      const target = await claim(ready);
      const writer = await runtimeClient(ready);
      const stale = await runtimeClient(ready, "REPEATABLE READ");
      try {
        await writer.query("BEGIN");
        await writer.query(eventSql, [target, actor, 1]);
        await writer.query(eventSql, [target, actor, 7]);
        await stale.query("SELECT count(*) FROM claim_state_events");
        await writer.query("COMMIT");
        expect(await code(stale.query(eventSql, [target, actor, 6]))).toBe(
          "40001",
        );
        await stale.query("ROLLBACK");
      } finally {
        await writer.end();
        await stale.end();
      }
      expect(
        (
          await ready.runtime.query<{ event_sequence: number }>(
            "SELECT event_sequence FROM claim_state_events WHERE claim_id=$1 ORDER BY event_sequence",
            [target],
          )
        ).rows.map((r) => r.event_sequence),
      ).toEqual([1, 7]);
    });

    it.each(["REPEATABLE READ", "SERIALIZABLE"])(
      "%s: a current snapshot appends in order, including several events in one transaction",
      async (level) => {
        const actor = await account(ready);
        const target = await claim(ready);
        const append = async (sequences: number[]) => {
          const client = await runtimeClient(ready, level);
          try {
            for (const sequence of sequences)
              await client.query(eventSql, [target, actor, sequence]);
            await client.query("COMMIT");
          } catch (error) {
            await client.query("ROLLBACK").catch(() => undefined);
            throw error;
          } finally {
            await client.end();
          }
        };
        await append([1, 2]);
        await append([4]);
        await expect(append([3])).rejects.toThrow(/exceed accepted maximum/);
        await expect(append([4])).rejects.toThrow(/exceed accepted maximum/);
        expect(
          (
            await ready.runtime.query<{ event_sequence: number }>(
              "SELECT event_sequence FROM claim_state_events WHERE claim_id=$1 ORDER BY event_sequence",
              [target],
            )
          ).rows.map((r) => r.event_sequence),
        ).toEqual([1, 2, 4]);
      },
      60000,
    );

    it("keeps strict append order under mixed-isolation stress across many rounds", async () => {
      const actor = await account(ready);
      const levels = ["READ COMMITTED", "REPEATABLE READ", "SERIALIZABLE"];
      for (let round = 0; round < 15; round += 1) {
        const target = await claim(ready);
        const clients = await Promise.all(
          Array.from({ length: 12 }, (_, i) =>
            runtimeClient(ready, levels[i % levels.length]),
          ),
        );
        try {
          await Promise.all(
            clients.map((c) =>
              c.query("SELECT count(*) FROM claim_state_events"),
            ),
          );
          const results = await Promise.all(
            clients.map(async (client) => {
              const sequence = 1 + Math.floor(Math.random() * 14);
              const outcome = await code(
                client.query(eventSql, [target, actor, sequence]),
              );
              const ended = await code(
                client.query(outcome === "OK" ? "COMMIT" : "ROLLBACK"),
              );
              return outcome === "OK" ? ended : outcome;
            }),
          );
          for (const result of results)
            expect(["OK", "40001", "23514", "23505"]).toContain(result);
        } finally {
          await Promise.all(clients.map((c) => c.end()));
        }
        const rows = await ready.owner.query<{ event_sequence: number }>(
          "SELECT event_sequence FROM claim_state_events WHERE claim_id=$1 ORDER BY xmin::text::bigint",
          [target],
        );
        const accepted = rows.rows.map((r) => r.event_sequence);
        expect(accepted, `round ${String(round)}`).toEqual(
          [...accepted].sort((a, b) => a - b),
        );
        expect(new Set(accepted).size).toBe(accepted.length);
        if (accepted.length > 0) expect(accepted[0]).toBe(1);
      }
    }, 120000);

    it.each(["REPEATABLE READ", "SERIALIZABLE"])(
      "%s: racing appenders keep strict append order; the losers fail safely",
      async (level) => {
        const actor = await account(ready);
        const target = await claim(ready);
        await ready.runtime.query(eventSql, [target, actor, 1]);
        const clients = await Promise.all(
          Array.from({ length: 10 }, () => runtimeClient(ready, level)),
        );
        try {
          await Promise.all(
            clients.map((c) =>
              c.query("SELECT count(*) FROM claim_state_events"),
            ),
          );
          const results = await Promise.all(
            clients.map(async (client, index) => {
              const outcome = await code(
                client.query(eventSql, [target, actor, index + 2]),
              );
              const ended = await code(
                client.query(outcome === "OK" ? "COMMIT" : "ROLLBACK"),
              );
              return outcome === "OK" ? ended : outcome;
            }),
          );
          expect(
            results.filter((r) => r === "OK").length,
          ).toBeGreaterThanOrEqual(1);
          for (const result of results)
            expect(["OK", "40001", "23514"]).toContain(result);
        } finally {
          await Promise.all(clients.map((c) => c.end()));
        }
        const rows = await ready.owner.query<{ event_sequence: number }>(
          "SELECT event_sequence FROM claim_state_events WHERE claim_id=$1 ORDER BY xmin::text::bigint",
          [target],
        );
        const accepted = rows.rows.map((r) => r.event_sequence);
        expect(accepted).toEqual([...accepted].sort((a, b) => a - b));
        expect(new Set(accepted).size).toBe(accepted.length);
        if (accepted.length > 0) expect(accepted[0]).toBe(1);
      },
      60000,
    );
  });
});
