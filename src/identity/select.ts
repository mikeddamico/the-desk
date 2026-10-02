// Strict, side-effect-free selection helpers shared by the identity projections.
// A projection selects named fields from an authoritative object; it never serializes a whole row.
import { normalizeString } from "./canonical-json.js";

export type JsonObject = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

export function asRecord(value: unknown, what: string): JsonObject {
  if (!isRecord(value)) throw new TypeError(`${what} must be an object`);
  return value;
}

export function asArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${what} must be an array`);
  return value as unknown[];
}

export function asString(value: unknown, what: string): string {
  if (typeof value !== "string")
    throw new TypeError(`${what} must be a string`);
  return value;
}

export function asNonBlankString(value: unknown, what: string): string {
  const text = asString(value, what);
  if (text.trim().length === 0)
    throw new TypeError(`${what} must be a nonblank string`);
  return text;
}

export function asInteger(value: unknown, what: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value))
    throw new TypeError(`${what} must be a safe integer`);
  return value;
}

/** Select exactly `keys` from `source`; every key must be an own property (its value may be null). */
export function selectKeys(
  source: unknown,
  keys: readonly string[],
  what: string,
): JsonObject {
  const record = asRecord(source, what);
  const selected: JsonObject = {};
  for (const key of keys) {
    if (!Object.hasOwn(record, key))
      throw new TypeError(`${what} is missing required field: ${key}`);
    selected[key] = record[key];
  }
  return selected;
}

/** Require that `source` has exactly the given own keys (no missing, no extra). */
export function requireExactKeys(
  source: unknown,
  keys: readonly string[],
  what: string,
): JsonObject {
  const record = asRecord(source, what);
  const actual = Object.keys(record);
  if (
    actual.length !== keys.length ||
    keys.some((key) => !Object.hasOwn(record, key))
  )
    throw new TypeError(`${what} requires exactly its governed fields`);
  return record;
}

export function compareStrings(left: string, right: string): number {
  // Unicode code-point order, never UTF-16 code-unit order.
  const a = Array.from(left);
  const b = Array.from(right);
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const x = a[index]?.codePointAt(0) ?? 0;
    const y = b[index]?.codePointAt(0) ?? 0;
    if (x !== y) return x - y;
  }
  return a.length - b.length;
}

/**
 * A validated semantic LABEL (anchor, candidate id, topic thread, participant): nonblank, and NFC-normalized so that
 * every uniqueness, lookup and position decision sees the same identity the canonical serializer will emit. Storage
 * UUIDs are never passed through this helper.
 */
export function semanticLabel(value: unknown, what: string): string {
  return normalizeString(asNonBlankString(value, what));
}
