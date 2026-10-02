// Shared helpers for the A4 row-derived fixture checks (ledger, assembly, bindings, obligations). Same conventions as derive.ts:
// pure over `Tables`, typed failures, no database or filesystem access. Every check here verifies FIXTURE v0.4.6 content against
// its owners and is labeled fixture-scoped where it states a fixture fact rather than a product rule.
import { canonicalJson } from "../identity/canonical-json.js";
import { DerivationError } from "./derive.js";
import type { Row, Tables } from "./rows.js";

export type Obj = Record<string, unknown>;
export const str = (v: unknown): string => String(v);
export const rowsOf = (tables: Tables, name: string): readonly Row[] =>
  tables[name] ?? [];
export function fail(code: string, detail = ""): never {
  throw new DerivationError(code, detail);
}
export function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null)
    return fail("missing_reference", what);
  return value;
}
/** Canonical-value equality (jsonb-safe); throws `code` on difference. */
export function same(
  code: string,
  actual: unknown,
  expected: unknown,
  detail = "",
): void {
  if (canonicalJson(actual) !== canonicalJson(expected)) fail(code, detail);
}
export function indexBy(rows: readonly Row[], key: string): Map<string, Row> {
  const map = new Map<string, Row>();
  for (const row of rows) {
    const id = str(row[key]);
    if (map.has(id)) fail("duplicate_row_key", `${key}=${id}`);
    map.set(id, row);
  }
  return map;
}
export const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);
export const obj = (v: unknown, what: string): Obj => {
  if (!isObj(v)) return fail("not_an_object", what);
  return v;
};
export const list = (v: unknown, what: string): unknown[] => {
  if (!Array.isArray(v)) return fail("not_an_array", what);
  return v as unknown[];
};
/** Instant of a persisted/shipped timestamp (Date or RFC 3339 text). */
export function instant(value: unknown, what: string): number {
  const ms = value instanceof Date ? value.getTime() : Date.parse(str(value));
  if (Number.isNaN(ms)) return fail("invalid_timestamp", what);
  return ms;
}
/** A copy of `value` without the named keys. */
export const without = (value: Obj, keys: readonly string[]): Obj =>
  Object.fromEntries(Object.entries(value).filter(([k]) => !keys.includes(k)));
