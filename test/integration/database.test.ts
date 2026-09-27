import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrate, verifyMigrationIntegrity } from "../../src/db/migrations.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const pool = databaseUrl
  ? new pg.Pool({ connectionString: databaseUrl })
  : undefined;

suite("fresh PostgreSQL foundation", () => {
  beforeAll(async () => {
    await pool!.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await migrate(pool!);
  });

  afterAll(async () => pool?.end());

  it("replays from zero and verifies migration checksums idempotently", async () => {
    await expect(verifyMigrationIntegrity(pool!)).resolves.toBeUndefined();
    await expect(migrate(pool!)).resolves.toBeUndefined();
  });

  it("database triggers reject forbidden immutable UPDATE and DELETE", async () => {
    const inserted = await pool!.query<{ artifact_id: string }>(
      "INSERT INTO artifacts(artifact_type, schema_version, content_hash, canonical_payload) VALUES ('test', 'v1', $1, '{}') RETURNING artifact_id",
      ["a".repeat(64)],
    );
    const id = inserted.rows[0]!.artifact_id;
    await expect(
      pool!.query(
        "UPDATE artifacts SET schema_version = 'v2' WHERE artifact_id = $1",
        [id],
      ),
    ).rejects.toThrow(/immutable relation/);
    await expect(
      pool!.query("DELETE FROM artifacts WHERE artifact_id = $1", [id]),
    ).rejects.toThrow(/immutable relation/);
  });

  it("prevents duplicate paid work with its authoritative idempotency key", async () => {
    const account = await pool!.query<{ account_id: string }>(
      "INSERT INTO accounts(display_name, actor_kind) VALUES ('test', 'service') RETURNING account_id",
    );
    const show = await pool!.query<{ show_id: string }>(
      "INSERT INTO shows(slug, title) VALUES ('fixture', 'Fixture') RETURNING show_id",
    );
    const config = await pool!.query<{ show_config_version_id: string }>(
      "INSERT INTO show_config_versions(show_id, version_number, config_hash, schema_version, canonical_payload, pre_publish_review_required) VALUES ($1, 1, $2, 'v1', '{}', true) RETURNING show_config_version_id",
      [show.rows[0]!.show_id, "b".repeat(64)],
    );
    const run = await pool!.query<{ program_run_id: string }>(
      "INSERT INTO program_runs(show_id, purpose, state) VALUES ($1, 'evaluation', 'created') RETURNING program_run_id",
      [show.rows[0]!.show_id],
    );
    const attempt = await pool!.query<{ attempt_id: string }>(
      "INSERT INTO program_run_attempts(program_run_id, show_config_version_id, state) VALUES ($1, $2, 'created') RETURNING attempt_id",
      [run.rows[0]!.program_run_id, config.rows[0]!.show_config_version_id],
    );
    const values = [
      attempt.rows[0]!.attempt_id,
      "fixture",
      "tts",
      "c".repeat(64),
      "paid-once",
      "started",
      new Date().toISOString(),
    ];
    const statement =
      "INSERT INTO provider_calls(attempt_id, provider, operation, request_fingerprint, idempotency_key, status, started_at) VALUES ($1,$2,$3,$4,$5,$6,$7)";
    const outcomes = await Promise.allSettled([
      pool!.query(statement, values),
      pool!.query(statement, values),
    ]);
    expect(
      outcomes.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(
      1,
    );
    expect(account.rowCount).toBe(1);
  });
});
