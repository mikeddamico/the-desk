// Transactional persistence of the verified Fixture v0.4.6 load (D1: the existing migration pool / setup role).
// One connection, one transaction: migration advisory lock -> migration ledger -> table locks (fixed order) -> emptiness ->
// dependency-ordered inserts -> read-back of the persisted rows -> COMMIT. Any failure rolls everything back.
import type { Pool, PoolClient } from "pg";

import { assertMigrationLedgerCurrent } from "../db/migrations.js";
import { canonicalJson } from "../identity/canonical-json.js";
import { allTables, families, type Family } from "./families.js";
import { openFixturePack, type Pack } from "./pack.js";
import { planInsertion } from "./order.js";
import type { Row } from "./rows.js";
import { VerifiedFixture } from "./snapshot.js";
import { verifyRows } from "./verify.js";

export class FixtureTargetNotEmptyError extends Error {
  readonly tables: string[];
  constructor(tables: string[]) {
    super(`fixture target is not empty: ${tables.join(", ")}`);
    this.name = "FixtureTargetNotEmptyError";
    this.tables = tables;
  }
}
export class FixtureReadBackError extends Error {
  readonly code: string;
  constructor(code: string, detail = "") {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "FixtureReadBackError";
    this.code = code;
  }
}

export interface PersistResult {
  rows: number;
  families: number;
  tables: Record<string, number>;
}

/** The fixed lock order: every table of the migrated schema, alphabetical. SHARE ROW EXCLUSIVE excludes all other writers. */
export const lockStatement = `LOCK TABLE ${allTables.map((t) => `"${t}"`).join(", ")} IN SHARE ROW EXCLUSIVE MODE`;

const insertSql = (family: Family): string =>
  `INSERT INTO "${family.table}" (${family.columns.map((c) => `"${c}"`).join(", ")}) VALUES (${family.columns
    .map((_, i) => `$${String(i + 1)}`)
    .join(", ")})`;

const values = (family: Family, row: Row): unknown[] =>
  family.columns.map((c) =>
    family.jsonb.includes(c) && row[c] !== null && row[c] !== undefined
      ? JSON.stringify(row[c])
      : row[c],
  );

/** Loads column types once so persisted values can be compared to fixture values by type, not by text. */
async function columnTypes(client: PoolClient): Promise<Map<string, string>> {
  const result = await client.query<{
    table_name: string;
    column_name: string;
    data_type: string;
  }>(
    "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public'",
  );
  return new Map(
    result.rows.map((r) => [`${r.table_name}.${r.column_name}`, r.data_type]),
  );
}

/** Semantic equality of one persisted value and its fixture value (jsonb by canonical value, timestamps by instant). */
function sameValue(
  type: string | undefined,
  persisted: unknown,
  shipped: unknown,
): boolean {
  if (persisted === null || persisted === undefined)
    return shipped === null || shipped === undefined;
  if (shipped === null || shipped === undefined) return false;
  if (type === "jsonb")
    return canonicalJson(persisted) === canonicalJson(shipped);
  if (type?.startsWith("timestamp"))
    return (
      persisted instanceof Date &&
      typeof shipped === "string" &&
      persisted.getTime() === Date.parse(shipped)
    );
  if (type === "numeric" || type === "bigint")
    return Number(persisted) === Number(shipped);
  return persisted === shipped;
}

const toShape = (value: unknown): unknown =>
  value instanceof Date ? value.toISOString().replace(/\.000Z$/, "Z") : value;

async function readBack(
  client: PoolClient,
  fixture: VerifiedFixture,
): Promise<void> {
  const types = await columnTypes(client);
  const persisted: Record<string, Row[]> = {};
  for (const family of families) {
    const result = await client.query<Row>(
      `SELECT ${family.columns.map((c) => `"${c}"`).join(", ")} FROM "${family.table}" ORDER BY ${family.primaryKey.map((c) => `"${c}"`).join(", ")}`,
    );
    const shipped = fixture.rows.tables[family.table] ?? [];
    if (result.rows.length !== shipped.length)
      throw new FixtureReadBackError(
        "persisted_count_mismatch",
        `${family.table}: ${String(result.rows.length)}`,
      );
    // persistence_expectations.base_run_insert: runs are inserted PENDING with null config/publication and the FIRST attempt
    // binds them atomically (attempt trigger). The expected persisted values are therefore the attempt's, derived from the
    // shipped attempts, and the shipped run values must be null.
    const bound = new Map<string, Row>();
    if (family.table === "program_runs")
      for (const attempt of fixture.rows.tables.program_run_attempts ?? [])
        if (!bound.has(String(attempt.program_run_id)))
          bound.set(String(attempt.program_run_id), attempt);
    const byKey = new Map(
      result.rows.map((r) => [
        JSON.stringify(family.primaryKey.map((k) => r[k])),
        r,
      ]),
    );
    for (const row of shipped) {
      const found = byKey.get(
        JSON.stringify(family.primaryKey.map((k) => row[k])),
      );
      if (!found)
        throw new FixtureReadBackError("persisted_row_missing", family.table);
      for (const column of family.columns) {
        if (
          family.table === "program_runs" &&
          (column === "show_config_version_id" ||
            column === "publication_enabled")
        ) {
          const attempt = bound.get(String(row.program_run_id));
          if (
            row[column] !== null ||
            attempt === undefined ||
            found[column] !== attempt[column]
          )
            throw new FixtureReadBackError(
              "run_binding_mismatch",
              String(row.program_run_id),
            );
          continue;
        }
        if (
          !sameValue(
            types.get(`${family.table}.${column}`),
            found[column],
            row[column],
          )
        )
          throw new FixtureReadBackError(
            "persisted_value_mismatch",
            `${family.table}.${column}`,
          );
      }
    }
    persisted[family.table] = result.rows.map((r) =>
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, toShape(v)])),
    );
  }
  // Recompute every A1 hash and binding over the PERSISTED rows (not the shipped records).
  verifyRows(persisted, fixture.context, fixture.historical);
  // Bindings that exist only in the database.
  const checks: [string, string][] = [
    [
      "attempts_left_pending",
      "SELECT count(*) AS n FROM program_run_attempts WHERE state <> 'PENDING'",
    ],
    [
      "runs_left_pending",
      "SELECT count(*) AS n FROM program_runs WHERE state <> 'PENDING'",
    ],
    [
      "run_config_not_bound_by_attempt",
      "SELECT count(*) AS n FROM program_runs r JOIN program_run_attempts a USING (program_run_id) WHERE r.show_config_version_id IS DISTINCT FROM a.show_config_version_id",
    ],
    [
      "publication_enabled",
      "SELECT count(*) AS n FROM program_run_attempts a JOIN program_runs r USING (program_run_id) WHERE a.publication_enabled IS NOT FALSE OR r.publication_enabled IS NOT FALSE",
    ],
    [
      "reroll_chain_unresolved",
      "SELECT count(*) AS n FROM provider_calls c WHERE c.reroll_trigger_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM reroll_triggers t JOIN provider_calls s ON s.provider_call_id = t.source_provider_call_id WHERE t.reroll_trigger_id = c.reroll_trigger_id AND s.provider_call_id = c.reroll_of_provider_call_id)",
    ],
    [
      "take_without_succeeded_call",
      "SELECT count(*) AS n FROM render_takes t WHERE NOT EXISTS (SELECT 1 FROM provider_call_events e WHERE e.provider_call_id = t.provider_call_id AND e.event_type = 'succeeded' AND e.response_artifact_id = t.audio_artifact_id)",
    ],
  ];
  for (const [code, sql] of checks) {
    const n = Number((await client.query<{ n: string }>(sql)).rows[0]?.n);
    if (n !== 0) throw new FixtureReadBackError(code, String(n));
  }
  for (const table of [
    "claim_state_events",
    "episodes",
    "episode_versions",
    "review_decisions",
    "repair_requests",
    "repair_plans",
    "repair_plan_decisions",
  ]) {
    const n = Number(
      (
        await client.query<{ n: string }>(
          `SELECT count(*) AS n FROM "${table}"`,
        )
      ).rows[0]?.n,
    );
    if (n !== 0) throw new FixtureReadBackError("minted_state_present", table);
  }
}

/**
 * Verifies the pack (inside this call: nothing pre-verified is accepted), then persists exactly the verified, frozen
 * snapshot. `pool` must be the migration/setup pool (role desk_migrator): show_config_versions INSERT is revoked from runtime.
 */
export async function persistFixture(
  pool: Pool,
  pack: Pack = openFixturePack(),
  options: { migrationsDirectory?: string } = {},
): Promise<PersistResult> {
  const fixture = VerifiedFixture.fromPack(pack);
  const plan = planInsertion(fixture.rows.tables);
  const byTable = new Map(families.map((f) => [f.table, f]));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(182736451, 1)");
    const who = await client.query<{ current_user: string }>(
      "SELECT current_user",
    );
    if (who.rows[0]?.current_user !== "desk_migrator")
      throw new Error(
        "Fixture loading requires the effective desk_migrator role",
      );
    await assertMigrationLedgerCurrent(client, options.migrationsDirectory);
    await client.query(lockStatement);
    const occupied: string[] = [];
    for (const table of allTables) {
      const found = await client.query(`SELECT 1 FROM "${table}" LIMIT 1`);
      if (found.rowCount) occupied.push(table);
    }
    if (occupied.length > 0) throw new FixtureTargetNotEmptyError(occupied);
    fixture.assertUnchanged();
    for (const step of plan) {
      const family = byTable.get(step.table);
      if (!family) throw new Error(`internal: unknown family ${step.table}`);
      await client.query(insertSql(family), values(family, step.row));
    }
    await readBack(client, fixture);
    await client.query("COMMIT");
    return {
      rows: plan.length,
      families: families.length,
      tables: Object.fromEntries(
        families.map((f) => [
          f.table,
          fixture.rows.tables[f.table]?.length ?? 0,
        ]),
      ),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
