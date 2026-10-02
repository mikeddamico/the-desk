import { describe, expect, it } from "vitest";

import { canonicalJson } from "../src/identity/canonical-json.js";
import {
  FixtureReadBackError,
  sameValue,
  shapeRows,
  toShape,
} from "../src/fixture/persist.js";

// Exact numeric handling (A4 correction 3): no Number() comparison for numeric or bigint. The "0.0000" requirement is
// FIXTURE-SCOPED (G11 synthetic zero cost, enforced in ledger.ts); nothing here defines a universal product scale rule.
const code = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    return error instanceof FixtureReadBackError ? error.code : "other";
  }
  return "accepted";
};

describe("numeric columns compare as exact decimal text", () => {
  it("keeps scale: 0.0000 is not 0, 0.00 or 0.0", () => {
    expect(sameValue("numeric", "0.0000", "0.0000")).toBe(true);
    for (const other of ["0", "0.0", "0.00", "0.00000", 0])
      expect(sameValue("numeric", "0.0000", other), String(other)).toBe(false);
    expect(sameValue("numeric", "0", "0.0000")).toBe(false);
  });
  it("never goes through floating point: nearly equal decimals are different", () => {
    expect(
      sameValue("numeric", "0.1000000000000000055511151231257827", "0.1"),
    ).toBe(false);
    expect(
      sameValue(
        "numeric",
        "12345678901234567890.123456789",
        "12345678901234567890.123456789",
      ),
    ).toBe(true);
    expect(
      sameValue(
        "numeric",
        "12345678901234567890.123456789",
        "12345678901234567890.123456788",
      ),
    ).toBe(false);
  });
  it("a numeric persisted value must be the driver's text and the fixture value must be text", () => {
    expect(sameValue("numeric", 0, "0")).toBe(false);
    expect(sameValue("numeric", "0", 0)).toBe(false);
  });
  it("decimal strings stay strings in the verifier shape, and the A1 serializer is unchanged", () => {
    const shaped = shapeRows({
      raw: { provider_call_events: [{ actual_cost: "0.0000" }] },
      types: new Map([["provider_call_events.actual_cost", "numeric"]]),
    });
    expect(shaped.provider_call_events?.[0]?.actual_cost).toBe("0.0000");
    expect(canonicalJson({ cost: "0.0000" })).toBe('{"cost":"0.0000"}');
    expect(() => canonicalJson({ cost: 0.5 })).toThrow(/safe integers/);
  });
});

describe("bigint columns compare as exact integer digits", () => {
  it("accepts equal digits and a safe-integer fixture number", () => {
    expect(sameValue("bigint", "10124", 10124)).toBe(true);
    expect(sameValue("bigint", "10124", "10124")).toBe(true);
  });
  it("does not round: an unsafe persisted integer is never equal to its float neighbour", () => {
    expect(sameValue("bigint", "9007199254740993", 9007199254740992)).toBe(
      false,
    );
    expect(
      sameValue("bigint", "9007199254740993", Number("9007199254740993")),
    ).toBe(false); // an unsafe fixture NUMBER is not exact
    expect(sameValue("bigint", "9007199254740993", "9007199254740993")).toBe(
      true,
    );
    expect(sameValue("bigint", "10124", 10124.5)).toBe(false);
    expect(sameValue("bigint", 10124, 10124)).toBe(false); // the driver's text is required
    expect(sameValue("bigint", "-0", 0)).toBe(false);
  });
  it("shapes a bigint for verification only when it is an exact safe integer", () => {
    expect(toShape("bigint", "10124")).toBe(10124);
    expect(code(() => toShape("bigint", "9007199254740993"))).toBe(
      "bigint_not_exact_safe_integer",
    );
    expect(code(() => toShape("bigint", "007"))).toBe(
      "bigint_not_exact_safe_integer",
    );
  });
});

describe("other types are unchanged", () => {
  it("jsonb by canonical value, timestamps by instant, nulls only with nulls", () => {
    expect(sameValue("jsonb", { b: 1, a: 2 }, { a: 2, b: 1 })).toBe(true);
    expect(
      sameValue(
        "timestamp with time zone",
        new Date("2026-09-27T13:00:00Z"),
        "2026-09-27T13:00:00Z",
      ),
    ).toBe(true);
    expect(
      sameValue(
        "timestamp with time zone",
        new Date("2026-09-27T13:00:01Z"),
        "2026-09-27T13:00:00Z",
      ),
    ).toBe(false);
    expect(sameValue("text", null, null)).toBe(true);
    expect(sameValue("text", null, "x")).toBe(false);
    expect(sameValue("integer", 3, 3)).toBe(true);
  });
});
