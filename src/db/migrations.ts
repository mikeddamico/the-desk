import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Pool, PoolClient } from "pg";

const migrationName = /^\d{3}_[a-z0-9_]+\.sql$/;

export interface Migration {
  name: string;
  checksum: string;
  sql: string;
}

export async function readMigrations(
  directory = resolve("migrations"),
): Promise<Migration[]> {
  const names = (await readdir(directory))
    .filter((name) => migrationName.test(name))
    .sort();
  return Promise.all(
    names.map(async (name) => {
      const bytes = await readFile(resolve(directory, name));
      return {
        name,
        sql: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        checksum: createHash("sha256").update(bytes).digest("hex"),
      };
    }),
  );
}

async function appliedMigrations(client: PoolClient) {
  return client.query<{ migration_name: string; checksum: string }>(
    "SELECT migration_name, checksum FROM desk_internal.schema_migrations ORDER BY migration_name",
  );
}

export async function migrate(pool: Pool, directory?: string): Promise<void> {
  const migrations = await readMigrations(directory);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // One transaction, one connection, including ledger creation/checks. Released on crash/rollback.
    await client.query("SELECT pg_advisory_xact_lock(182736451, 1)");
    const identity = await client.query<{ current_user: string }>(
      "SELECT current_user",
    );
    if (identity.rows[0]?.current_user !== "desk_migrator")
      throw new Error("Migrations require effective desk_migrator role");
    await client.query(`CREATE TABLE IF NOT EXISTS desk_internal.schema_migrations (
      migration_name text PRIMARY KEY,
      checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const expected = new Map(
      migrations.map((migration) => [migration.name, migration.checksum]),
    );
    const applied = await appliedMigrations(client);
    for (const row of applied.rows) {
      if (expected.get(row.migration_name) !== row.checksum)
        throw new Error(
          `Applied migration checksum mismatch or unknown migration: ${row.migration_name}`,
        );
    }
    const present = new Set(applied.rows.map((row) => row.migration_name));
    for (const migration of migrations) {
      if (present.has(migration.name)) continue;
      await client.query(migration.sql);
      await client.query(
        "INSERT INTO desk_internal.schema_migrations(migration_name, checksum) VALUES ($1, $2)",
        [migration.name, migration.checksum],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyMigrationIntegrity(
  pool: Pool,
  directory?: string,
): Promise<void> {
  const expected = new Map(
    (await readMigrations(directory)).map((migration) => [
      migration.name,
      migration.checksum,
    ]),
  );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(182736451, 1)");
    const applied = await appliedMigrations(client);
    for (const row of applied.rows) {
      if (expected.get(row.migration_name) !== row.checksum)
        throw new Error(`Migration integrity failure: ${row.migration_name}`);
      expected.delete(row.migration_name);
    }
    if (expected.size > 0)
      throw new Error(`Pending migrations: ${[...expected.keys()].join(", ")}`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
