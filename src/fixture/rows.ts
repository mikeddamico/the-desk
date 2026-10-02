// Structural validation of the one active load, `foundation_rows_398.json` (Trace v0.5.5 §10, Handoff load profile).
// Only the active-load member is parsed; archive/historical members are never opened here.
import { FixtureIntegrityError, type Pack } from "./pack.js";
import { families } from "./families.js";

export type Row = Record<string, unknown>;
export type Tables = Record<string, readonly Row[]>;
export interface FixtureRows {
  profile: string;
  tables: Tables;
}

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Parses, validates and deep-freezes the active load. The result is the only object ever inserted. */
export function parseFoundationRows(pack: Pack): FixtureRows {
  const pins = pack.pins;
  const doc = pack.json(pins.activeLoadMember) as {
    profile?: unknown;
    tables?: unknown;
  };
  if (!isRow(doc) || typeof doc.profile !== "string" || !isRow(doc.tables))
    throw new FixtureIntegrityError("rows_shape");
  const tables = doc.tables as Record<string, unknown>;
  const names = Object.keys(tables);
  const expected = Object.keys(pins.familyCounts);
  if (
    names.length !== expected.length ||
    names.some((name, i) => name !== expected[i])
  )
    throw new FixtureIntegrityError("family_set_mismatch", names.join(","));
  let total = 0;
  for (const family of families) {
    const rows = tables[family.table];
    if (!Array.isArray(rows) || !rows.every(isRow))
      throw new FixtureIntegrityError("family_not_rows", family.table);
    if (rows.length !== pins.familyCounts[family.table])
      throw new FixtureIntegrityError(
        "family_count_mismatch",
        `${family.table}: ${String(rows.length)}`,
      );
    total += rows.length;
    const columns = new Set(family.columns);
    const seen = new Set<string>();
    for (const row of rows) {
      const keys = Object.keys(row);
      if (keys.length !== columns.size || keys.some((k) => !columns.has(k)))
        throw new FixtureIntegrityError("row_columns_mismatch", family.table);
      for (const key of family.primaryKey) {
        const value = row[key];
        if (typeof value !== "string" || !uuidV4.test(value))
          throw new FixtureIntegrityError(
            "primary_key_not_v4_uuid",
            `${family.table}.${key}`,
          );
      }
      const id = family.primaryKey.map((k) => String(row[k])).join("|");
      if (seen.has(id))
        throw new FixtureIntegrityError(
          "duplicate_primary_key",
          `${family.table} ${id}`,
        );
      seen.add(id);
    }
  }
  if (total !== pins.totalRows)
    throw new FixtureIntegrityError("total_rows_mismatch", String(total));
  if ((tables.claim_state_events as unknown[]).length !== 0)
    throw new FixtureIntegrityError("claim_events_not_zero");
  const artifacts = tables.artifacts as Row[];
  const historical = artifacts.filter(
    (a) => a.artifact_id === pins.historicalDirection.artifactId,
  );
  if (
    artifacts.length !== pins.artifactRows ||
    historical.length !== 1 ||
    artifacts.length - historical.length !== pins.currentArtifactRows
  )
    throw new FixtureIntegrityError("artifact_split_mismatch");
  return deepFreeze({ profile: doc.profile, tables: tables as Tables });
}
