import { createHash } from "node:crypto";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

function compareCodePoints(left: string, right: string): number {
  const toCodePoints = (value: string): number[] =>
    Array.from(value, (character) => {
      const codePoint = character.codePointAt(0);
      if (codePoint === undefined) {
        throw new TypeError("Cannot order an empty Unicode character");
      }
      return codePoint;
    });
  const a = toCodePoints(left);
  const b = toCodePoints(right);
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const leftCodePoint = a[index];
    const rightCodePoint = b[index];
    if (
      leftCodePoint !== undefined &&
      rightCodePoint !== undefined &&
      leftCodePoint !== rightCodePoint
    ) {
      return leftCodePoint - rightCodePoint;
    }
  }
  return a.length - b.length;
}

export function normalizeString(value: string): string {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff))
        throw new TypeError("Unpaired high surrogate");
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new TypeError("Unpaired low surrogate");
    }
  }
  return value.normalize("NFC");
}

function serialize(value: unknown, ancestors: Set<object>): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(normalizeString(value));
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError(
        "Semantic JSON numbers must be safe integers; exact decimals are strings",
      );
    }
    return String(value);
  }
  if (typeof value !== "object")
    throw new TypeError(`Non-JSON semantic value: ${typeof value}`);
  if (ancestors.has(value)) throw new TypeError("Cyclic semantic value");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index))
          throw new TypeError("Sparse semantic array");
      }
      return `[${value.map((item) => serialize(item, ancestors)).join(",")}]`;
    }
    if (
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    ) {
      throw new TypeError("Class instances are not semantic JSON objects");
    }
    const normalized = new Map<string, unknown>();
    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = normalizeString(key);
      if (normalized.has(normalizedKey))
        throw new TypeError(
          `Duplicate key after NFC normalization: ${normalizedKey}`,
        );
      normalized.set(normalizedKey, child);
    }
    return `{${[...normalized.entries()]
      .sort(([left], [right]) => compareCodePoints(left, right))
      .map(
        ([key, child]) =>
          `${JSON.stringify(key)}:${serialize(child, ancestors)}`,
      )
      .join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalJson(value: unknown): string {
  return serialize(value, new Set());
}

export function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(canonicalJson(value), "utf8");
}

export function domainHash(domain: string, projection: unknown): string {
  if (!/^[a-z0-9-]+$/.test(domain)) throw new TypeError("Invalid hash domain");
  return createHash("sha256")
    .update(domain)
    .update("\n")
    .update(canonicalBytes(projection))
    .digest("hex");
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function canonicalTimestamp(value: string): string {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/.exec(
      value,
    );
  if (!match) throw new TypeError("Semantic timestamp must be RFC 3339 UTC Z");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > (days[month - 1] ?? 0) ||
    Number(match[4]) > 23 ||
    Number(match[5]) > 59 ||
    Number(match[6]) > 59
  ) {
    throw new TypeError("Impossible semantic UTC timestamp");
  }
  return value;
}
