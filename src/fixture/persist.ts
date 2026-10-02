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

/** A pg Pool, PoolClient or Client. Readers below issue plain SELECTs only (ACCESS SHARE; they never block a writer). */
export interface Queryable {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Row[]; rowCount: number | null }>;
}

/** Loads column types once so persisted values can be compared to fixture values by type, not by text. */
export async function columnTypes(db: Queryable): Promise<Map<string, string>> {
  const result = await db.query(
    "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public'",
  );
  return new Map(
    result.rows.map((r) => [
      `${String(r.table_name)}.${String(r.column_name)}`,
      String(r.data_type),
    ]),
  );
}

/**
 * Exact equality of one persisted value and its fixture value, by column type: jsonb by canonical value, timestamps by instant,
 * numeric by exact decimal TEXT (never through floating point; the fixture carries exact decimals as strings, e.g. "0.0000", and
 * PostgreSQL numeric keeps scale), bigint by exact integer digits.
 */
export function sameValue(
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
  if (type === "numeric")
    return typeof persisted === "string" && persisted === shipped;
  if (type === "bigint") {
    if (typeof persisted !== "string") return false;
    if (typeof shipped === "string")
      return /^-?\d+$/.test(shipped) && persisted === shipped;
    return (
      typeof shipped === "number" &&
      Number.isSafeInteger(shipped) &&
      persisted === String(shipped)
    );
  }
  return persisted === shipped;
}

/**
 * Persisted shape handed to the row verifier: timestamps as semantic UTC text, bigint as a number only when it is an exact safe
 * integer (otherwise the read fails), numeric kept as its exact decimal text. Never rounds.
 */
export function toShape(type: string | undefined, value: unknown): unknown {
  if (value instanceof Date) return value.toISOString().replace(/\.000Z$/, "Z");
  if (type === "bigint" && typeof value === "string") {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || String(n) !== value)
      throw new FixtureReadBackError("bigint_not_exact_safe_integer", value);
    return n;
  }
  return value;
}

export interface RawFixtureRows {
  /** Raw pg-typed rows per family, ordered by primary key. */
  raw: Record<string, Row[]>;
  types: Map<string, string>;
}

/**
 * Reads every family (ordered by primary key). This is the ONE reader used both inside A2's load transaction (the caller's
 * existing transaction: no BEGIN, COMMIT, isolation change or lock here) and by the post-commit verifier. A single consistent
 * snapshot across the 40 statements is the CALLER's responsibility: the loader holds SHARE ROW EXCLUSIVE locks on every table;
 * the post-commit verifier owns a REPEATABLE READ READ ONLY transaction.
 */
export async function readFixtureRows(db: Queryable): Promise<RawFixtureRows> {
  const types = await columnTypes(db);
  const raw: Record<string, Row[]> = {};
  for (const family of families) {
    const result = await db.query(
      `SELECT ${family.columns.map((c) => `"${c}"`).join(", ")} FROM "${family.table}" ORDER BY ${family.primaryKey.map((c) => `"${c}"`).join(", ")}`,
    );
    raw[family.table] = result.rows;
  }
  return { raw, types };
}

export function shapeRows(rows: RawFixtureRows): Record<string, Row[]> {
  return Object.fromEntries(
    Object.entries(rows.raw).map(([table, list]) => [
      table,
      list.map((r) =>
        Object.fromEntries(
          Object.entries(r).map(([k, v]) => [
            k,
            toShape(rows.types.get(`${table}.${k}`), v),
          ]),
        ),
      ),
    ]),
  );
}

/** Bindings that exist only in the database (read-only SELECTs). */
export async function databaseBindingChecks(db: Queryable): Promise<void> {
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
    const n = Number((await db.query(sql)).rows[0]?.n);
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
      (await db.query(`SELECT count(*) AS n FROM "${table}"`)).rows[0]?.n,
    );
    if (n !== 0) throw new FixtureReadBackError("minted_state_present", table);
  }
}

/** A2's in-transaction read-back: compare every persisted column, then verify the persisted rows. */
async function readBack(
  client: PoolClient,
  fixture: VerifiedFixture,
): Promise<void> {
  const rows = await readFixtureRows(client);
  for (const family of families) {
    const result = rows.raw[family.table] ?? [];
    const shipped = fixture.rows.tables[family.table] ?? [];
    if (result.length !== shipped.length)
      throw new FixtureReadBackError(
        "persisted_count_mismatch",
        `${family.table}: ${String(result.length)}`,
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
      result.map((r) => [
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
            rows.types.get(`${family.table}.${column}`),
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
  }
  // Recompute every A1 hash and binding over the PERSISTED rows (not the shipped records).
  verifyRows(shapeRows(rows), fixture.context, fixture.historical);
  await databaseBindingChecks(client);
}

export interface PersistedVerification {
  rows: number;
  families: number;
}

async function assertSnapshotClient(
  client: PoolClient,
  role: string,
): Promise<void> {
  const who = (await client.query<{ u: string }>("SELECT current_user AS u"))
    .rows[0]?.u;
  if (who !== role)
    throw new FixtureReadBackError(
      "verifier_role",
      `expected ${role}, effective ${String(who)}`,
    );
  const level = (
    await client.query<{ v: string }>(
      "SELECT current_setting('transaction_isolation') AS v",
    )
  ).rows[0]?.v;
  const readOnly = (
    await client.query<{ v: string }>(
      "SELECT current_setting('transaction_read_only') AS v",
    )
  ).rows[0]?.v;
  if (
    (level !== "repeatable read" && level !== "serializable") ||
    readOnly !== "on"
  )
    throw new FixtureReadBackError(
      "verifier_snapshot_not_pinned",
      `${String(level)} read_only=${String(readOnly)}`,
    );
  // two statements, one transaction: autocommit would give two transaction timestamps
  const a = (
    await client.query<{ t: Date }>("SELECT transaction_timestamp() AS t")
  ).rows[0]?.t;
  const b = (
    await client.query<{ t: Date }>("SELECT transaction_timestamp() AS t")
  ).rows[0]?.t;
  if (a?.getTime() !== b?.getTime() || a === undefined)
    throw new FixtureReadBackError("verifier_not_in_transaction");
}

/**
 * Post-commit verification on an ALREADY-OPEN consistent snapshot (the caller owns the transaction). Requires the effective role,
 * REPEATABLE READ (or SERIALIZABLE) READ ONLY, and an explicit open transaction; it never begins, commits or rolls back.
 */
export async function verifyPersistedFixtureOnSnapshot(
  client: PoolClient,
  pack: Pack = openFixturePack(),
  options: { role?: string } = {},
): Promise<PersistedVerification> {
  await assertSnapshotClient(client, options.role ?? "desk_runtime");
  const fixture = VerifiedFixture.fromPack(pack);
  const rows = await readFixtureRows(client);
  const shaped = shapeRows(rows);
  verifyRows(shaped, fixture.context, fixture.historical);
  await databaseBindingChecks(client);
  return {
    rows: Object.values(shaped).reduce((n, r) => n + r.length, 0),
    families: families.length,
  };
}

/**
 * Post-commit verification with an explicitly owned snapshot: pins ONE connection from `pool`, begins REPEATABLE READ READ ONLY
 * (so all 40 family reads and the SQL binding checks see one snapshot; no write-blocking lock is taken), verifies, and always
 * ends the transaction and releases the connection. The pool should authenticate as desk_runtime. Verifies the LOADED BASE state:
 * claim events appended after the load change the reduced claim state and are reported by the claim comparison (use the A3
 * freeze verifier for live differences).
 */
export async function verifyPersistedFixture(
  pool: Pool,
  pack: Pack = openFixturePack(),
  options: { role?: string } = {},
): Promise<PersistedVerification> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const result = await verifyPersistedFixtureOnSnapshot(
      client,
      pack,
      options,
    );
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
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
    // never let a failing ROLLBACK (for example a dead connection) mask the original failure
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
