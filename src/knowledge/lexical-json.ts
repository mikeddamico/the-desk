// Bounded lexical JSON reader (A3). `JSON.parse` collapses `1.0`, `1e0` and unsafe integers into JavaScript numbers, so a
// parsed value can never prove which numeric lexeme the source carried. This reader keeps that distinction for the claim
// state / cursor sources that need it (Fixture v0.4.6 vector CE-G05 step 2 carries a cursor `event_sequence` of `1.0`).
//
// Guarantees (and their limits):
// - It reads RAW SOURCE text/bytes. A value already produced by `JSON.parse` or node-pg has lost its lexeme and cannot be
//   re-validated lexically; `validated object` guarantees (type/range of what is in hand) are weaker than `raw source`
//   guarantees (what the source literally wrote). PostgreSQL jsonb keeps `1.0` in `::text` but normalizes `1e0` to `1`, so an
//   exponent form is distinguishable only in file/byte sources, never after jsonb storage.
// - A number is an INTEGER iff its lexeme matches `-?(0|[1-9][0-9]*)` and the value is a safe integer; it then stays an
//   ordinary JavaScript number. Every other number (fraction, exponent, or an integer beyond the safe range) becomes a
//   frozen `LexicalNumber`; nothing rounds into acceptance. `-0` stays `-0` exactly as `JSON.parse` returns it.
// - `LexicalNumber` is a class instance, which the canonical serializer already rejects, so a marker can never be hashed as a
//   number. `toNativeJson` restores `JSON.parse` semantics for consumers that want ordinary values.
// - No global parser override (no `pg.types.setTypeParser`) is installed anywhere.
const MAX_DEPTH = 256;

export type LexicalNumberKind = "non_integer_lexeme" | "unsafe_integer";

export class LexicalNumber {
  readonly lexeme: string;
  readonly kind: LexicalNumberKind;
  constructor(lexeme: string, kind: LexicalNumberKind) {
    this.lexeme = lexeme;
    this.kind = kind;
    Object.freeze(this);
  }
}

export class LexicalJsonError extends Error {
  readonly offset: number;
  constructor(message: string, offset: number) {
    super(`${message} at offset ${String(offset)}`);
    this.name = "LexicalJsonError";
    this.offset = offset;
  }
}

export type LexicalValue =
  | null
  | boolean
  | number
  | string
  | LexicalNumber
  | LexicalValue[]
  | { [key: string]: LexicalValue };

const numberToken = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
const integerLexeme = /^-?(?:0|[1-9][0-9]*)$/;

class Reader {
  private position = 0;
  constructor(private readonly text: string) {}

  parseDocument(): LexicalValue {
    this.skipWhitespace();
    const value = this.value(0);
    this.skipWhitespace();
    if (this.position !== this.text.length)
      throw new LexicalJsonError("Trailing data", this.position);
    return value;
  }

  private skipWhitespace(): void {
    while (this.position < this.text.length) {
      const c = this.text.charCodeAt(this.position);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d)
        this.position += 1;
      else break;
    }
  }

  private value(depth: number): LexicalValue {
    if (depth > MAX_DEPTH)
      throw new LexicalJsonError("Nesting too deep", this.position);
    const c = this.text[this.position];
    if (c === "{") return this.object(depth);
    if (c === "[") return this.array(depth);
    if (c === '"') return this.string();
    if (c === "-" || (c !== undefined && c >= "0" && c <= "9"))
      return this.number();
    for (const [literal, value] of [
      ["true", true],
      ["false", false],
      ["null", null],
    ] as const)
      if (this.text.startsWith(literal, this.position)) {
        this.position += literal.length;
        return value;
      }
    throw new LexicalJsonError("Unexpected token", this.position);
  }

  private number(): LexicalValue {
    numberToken.lastIndex = this.position;
    const match = numberToken.exec(this.text);
    if (!match) throw new LexicalJsonError("Invalid number", this.position);
    const lexeme = match[0];
    this.position += lexeme.length;
    if (!integerLexeme.test(lexeme))
      return new LexicalNumber(lexeme, "non_integer_lexeme");
    const value = Number(lexeme);
    if (!Number.isSafeInteger(value))
      return new LexicalNumber(lexeme, "unsafe_integer");
    return value;
  }

  private string(): string {
    const start = this.position;
    let index = start + 1;
    for (;;) {
      if (index >= this.text.length)
        throw new LexicalJsonError("Unterminated string", start);
      const c = this.text[index];
      if (c === "\\") index += 2;
      else if (c === '"') break;
      else index += 1;
    }
    this.position = index + 1;
    try {
      // JSON.parse decodes and validates exactly the string-literal grammar (escapes, control characters).
      return JSON.parse(this.text.slice(start, this.position)) as string;
    } catch {
      throw new LexicalJsonError("Invalid string literal", start);
    }
  }

  private array(depth: number): LexicalValue[] {
    this.position += 1;
    const items: LexicalValue[] = [];
    this.skipWhitespace();
    if (this.text[this.position] === "]") {
      this.position += 1;
      return items;
    }
    for (;;) {
      this.skipWhitespace();
      items.push(this.value(depth + 1));
      this.skipWhitespace();
      const c = this.text[this.position];
      this.position += 1;
      if (c === "]") return items;
      if (c !== ",")
        throw new LexicalJsonError("Expected , or ]", this.position - 1);
    }
  }

  private object(depth: number): Record<string, LexicalValue> {
    this.position += 1;
    const result: Record<string, LexicalValue> = {};
    this.skipWhitespace();
    if (this.text[this.position] === "}") {
      this.position += 1;
      return result;
    }
    for (;;) {
      this.skipWhitespace();
      if (this.text[this.position] !== '"')
        throw new LexicalJsonError("Expected object key", this.position);
      const keyOffset = this.position;
      const key = this.string();
      if (Object.hasOwn(result, key))
        throw new LexicalJsonError(`Duplicate key ${key}`, keyOffset);
      this.skipWhitespace();
      if (this.text[this.position] !== ":")
        throw new LexicalJsonError("Expected :", this.position);
      this.position += 1;
      this.skipWhitespace();
      Object.defineProperty(result, key, {
        value: this.value(depth + 1),
        enumerable: true,
        writable: true,
        configurable: true,
      });
      this.skipWhitespace();
      const c = this.text[this.position];
      this.position += 1;
      if (c === "}") return result;
      if (c !== ",")
        throw new LexicalJsonError("Expected , or }", this.position - 1);
    }
  }
}

/** Parses RAW JSON source. Bytes are decoded as strict UTF-8 (a BOM and invalid sequences are rejected, as by JSON.parse). */
export function parseLexicalJson(source: string | Uint8Array): LexicalValue {
  let text: string;
  if (typeof source === "string") text = source;
  else {
    try {
      text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        source,
      );
    } catch {
      throw new LexicalJsonError("Invalid UTF-8", 0);
    }
  }
  if (text.charCodeAt(0) === 0xfeff)
    throw new LexicalJsonError("Byte order mark", 0);
  return new Reader(text).parseDocument();
}

/** A strict integer here is exactly an ordinary JavaScript safe integer (never a LexicalNumber, boolean or string). */
export function isStrictInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    !Object.is(value, -0)
  );
}

/** Restores `JSON.parse` semantics (markers become `Number(lexeme)`), for consumers that want ordinary JSON values. */
export function toNativeJson(value: LexicalValue): unknown {
  if (value instanceof LexicalNumber) return Number(value.lexeme);
  if (Array.isArray(value)) return value.map(toNativeJson);
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, toNativeJson(v)]),
    );
  return value;
}
