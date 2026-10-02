import { describe, expect, it } from "vitest";

import { canonicalJson } from "../src/identity/canonical-json.js";
import {
  fixturePack,
  loadClaimEventConformance,
  loadFixtureBytes,
} from "../src/fixture/loader.js";
import {
  LexicalJsonError,
  LexicalNumber,
  isStrictInteger,
  parseLexicalJson,
  toNativeJson,
  type LexicalValue,
} from "../src/knowledge/lexical-json.js";
import { parseStateCursor } from "../src/knowledge/state-cursor.js";
import { uuid } from "./support/claim-events.js";

const throwsLexical = (text: string | Uint8Array): boolean => {
  try {
    parseLexicalJson(text);
  } catch (error) {
    return error instanceof LexicalJsonError;
  }
  return false;
};

/** Every LexicalNumber in a parsed document with its path. */
function markers(value: LexicalValue, path = "$"): string[] {
  if (value instanceof LexicalNumber) return [`${path}=${value.lexeme}`];
  if (Array.isArray(value))
    return value.flatMap((v, i) => markers(v, `${path}[${String(i)}]`));
  if (typeof value === "object" && value !== null)
    return Object.entries(value).flatMap(([k, v]) =>
      markers(v, `${path}.${k}`),
    );
  return [];
}

describe("lexical JSON reader: numbers", () => {
  const classify = (lexeme: string): unknown =>
    (parseLexicalJson(`[${lexeme}]`) as unknown[])[0];

  it("keeps integer lexemes as ordinary numbers", () => {
    for (const [lexeme, value] of [
      ["0", 0],
      ["1", 1],
      ["-1", -1],
      ["2147483648", 2147483648],
      ["9007199254740991", 9007199254740991],
    ] as const)
      expect(classify(lexeme)).toBe(value);
    expect(Object.is(classify("-0"), -0)).toBe(true); // same as JSON.parse
  });

  it("marks every non-integer lexeme, including 1.0 and exponent forms", () => {
    for (const lexeme of ["1.0", "1e0", "1E+2", "0.5", "-2.50", "1.5e3"]) {
      const value = classify(lexeme);
      expect(value).toBeInstanceOf(LexicalNumber);
      expect((value as LexicalNumber).lexeme).toBe(lexeme);
      expect((value as LexicalNumber).kind).toBe("non_integer_lexeme");
    }
  });

  it("never rounds an unsafe integer into acceptance", () => {
    for (const lexeme of [
      "9007199254740992",
      "9007199254740993",
      "-9007199254740993",
      "123456789012345678901234567890",
    ]) {
      const value = classify(lexeme);
      expect(value).toBeInstanceOf(LexicalNumber);
      expect((value as LexicalNumber).kind).toBe("unsafe_integer");
    }
    // JSON.parse would have silently rounded the same token
    expect(JSON.parse("9007199254740993")).toBe(9007199254740992);
  });

  it("isStrictInteger accepts only ordinary safe integers", () => {
    expect(isStrictInteger(1)).toBe(true);
    for (const v of [
      1.5,
      -0,
      true,
      "1",
      null,
      new LexicalNumber("1.0", "non_integer_lexeme"),
    ])
      expect(isStrictInteger(v)).toBe(false);
  });

  it("a marker can never be hashed as a number or alter hash inputs", () => {
    const parsed = parseLexicalJson('{"n":1.0}') as { n: unknown };
    expect(() => canonicalJson(parsed)).toThrow(/Class instances/);
    // ordinary documents are unchanged: integers stay numbers and hash exactly as JSON.parse'd values do
    const ordinary = '{"a":[1,2,{"b":"é"}],"c":true,"d":null}';
    expect(canonicalJson(parseLexicalJson(ordinary))).toBe(
      canonicalJson(JSON.parse(ordinary)),
    );
  });
});

describe("lexical JSON reader: grammar", () => {
  it("rejects malformed documents like JSON.parse does", () => {
    for (const bad of [
      "",
      "{",
      "[1,]",
      '{"a":1,}',
      "{'a':1}",
      "01",
      "1.",
      ".5",
      "+1",
      "1e",
      "NaN",
      "[1] x",
      '"\\x"',
      '"a\nb"',
      '{"a":1 "b":2}',
      "﻿{}",
    ])
      expect(throwsLexical(bad), JSON.stringify(bad)).toBe(true);
    expect(throwsLexical(new Uint8Array([0x22, 0xc3, 0x28, 0x22]))).toBe(true);
  });

  it("rejects duplicate keys and excessive nesting", () => {
    expect(throwsLexical('{"a":1,"a":2}')).toBe(true);
    expect(throwsLexical("[".repeat(300) + "]".repeat(300))).toBe(true);
  });

  it("matches JSON.parse on valid documents (strings, escapes, unicode, nesting)", () => {
    const text =
      '{"a":"\\u00e9\\n\\"x\\"","b":[[],{}],"c":{"d":[true,false,null,-3]},"e":"😀"}';
    expect(toNativeJson(parseLexicalJson(text))).toEqual(JSON.parse(text));
  });

  it("keeps __proto__ as an ordinary own key", () => {
    const parsed = parseLexicalJson('{"__proto__":1}') as Record<
      string,
      unknown
    >;
    expect(Object.hasOwn(parsed, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
  });
});

describe("the pinned source bytes (Fixture v0.4.6)", () => {
  it("carries exactly one lexical marker: the CE-G05 step 2 cursor event_sequence 1.0", () => {
    const document = loadClaimEventConformance();
    expect(markers(document)).toEqual([
      "$.vectors[47].steps[2].cursor.event_sequence=1.0",
    ]);
    const vectors = (document as { vectors: { id: string }[] }).vectors;
    expect(vectors[47]?.id).toBe("CE-G05");
  });

  it("production cursor parsing rejects that raw-source value but accepts the JSON.parse'd one: lexeme is lost after JSON.parse", () => {
    const lexical = loadClaimEventConformance() as unknown as {
      vectors: { steps: { cursor: unknown }[] }[];
    };
    const cursor = lexical.vectors[47]?.steps[2]?.cursor;
    expect(() => parseStateCursor(cursor)).toThrow(/cursor_sequence_type/);
    const naive = (
      JSON.parse(
        loadFixtureBytes("claim_event_conformance.json").toString("utf8"),
      ) as {
        vectors: { steps: { cursor: unknown }[] }[];
      }
    ).vectors[47]?.steps[2]?.cursor as Record<string, unknown>;
    expect(naive.event_sequence).toBe(1); // the original lexeme cannot be recovered from a parsed value
    // symbolic vec:* ids are translated only inside the test harness; production requires real UUIDs
    expect(() => parseStateCursor(naive)).toThrow(/cursor_shape/);
    expect(
      parseStateCursor({ ...naive, claim_state_event_id: uuid(1) }),
    ).toEqual({ claim_state_event_id: uuid(1), event_sequence: 1 });
  });

  it("restores JSON.parse semantics for every non-archival JSON member of the pack", () => {
    const pack = fixturePack();
    // Archival roles are hashed but never parsed (pack.member refuses them); only loadable members are compared.
    const members = pack.memberNames.filter((n) => {
      if (!n.endsWith(".json")) return false;
      try {
        pack.member(n);
        return true;
      } catch {
        return false;
      }
    });
    expect(members.length).toBeGreaterThan(40);
    for (const name of members)
      expect(toNativeJson(parseLexicalJson(pack.member(name))), name).toEqual(
        pack.json(name),
      );
  });
});
