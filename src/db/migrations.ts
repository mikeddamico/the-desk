import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Pool } from "pg";

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
      const sql = await readFile(resolve(directory, name), "utf8");
      return {
        name,
        sql,
        checksum: createHash("sha256").update(sql, "utf8").digest("hex"),
      };
    }),
  );
}

export async function migrate(pool: Pool, directory?: string): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    migration_name text PRIMARY KEY,
    checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  for (const migration of await readMigrations(directory)) {
    const existing = await pool.query<{ checksum: string }>(
      "SELECT checksum FROM schema_migrations WHERE migration_name = $1",
      [migration.name],
    );
    if (existing.rowCount === 1) {
      if (existing.rows[0]?.checksum !== migration.checksum)
        throw new Error(
          `Applied migration checksum mismatch: ${migration.name}`,
        );
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(migration.sql);
      await client.query(
        "INSERT INTO schema_migrations(migration_name, checksum) VALUES ($1, $2)",
        [migration.name, migration.checksum],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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
  const applied = await pool.query<{
    migration_name: string;
    checksum: string;
  }>(
    "SELECT migration_name, checksum FROM schema_migrations ORDER BY migration_name",
  );
  for (const row of applied.rows) {
    if (expected.get(row.migration_name) !== row.checksum)
      throw new Error(`Migration integrity failure: ${row.migration_name}`);
    expected.delete(row.migration_name);
  }
  if (expected.size > 0)
    throw new Error(`Pending migrations: ${[...expected.keys()].join(", ")}`);
}
