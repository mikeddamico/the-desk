import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  canonicalTimestamp,
  domainHash,
} from "../src/identity/canonical-json.js";

describe("canonical JSON", () => {
  it("normalizes NFC, emits literal Unicode, and sorts by code point", () => {
    expect(
      canonicalJson({
        "😀": "non-bmp",
        "\ue000": "bmp-private",
        café: "naïve",
      }),
    ).toBe('{"café":"naïve","":"bmp-private","😀":"non-bmp"}');
  });

  it("rejects duplicate normalized keys and unsafe semantic values", () => {
    expect(() => canonicalJson({ é: 1, é: 2 })).toThrow(/Duplicate key/);
    for (const value of [1.1, Number.NaN, Infinity, -0, undefined, new Date()])
      expect(() => canonicalJson(value)).toThrow();
    expect(() => canonicalJson("\ud800")).toThrow(/surrogate/);
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => canonicalJson(cyclic)).toThrow(/Cyclic/);
  });

  it("hashes domain-separated UTF-8 bytes deterministically", () => {
    expect(domainHash("test-v1", { café: "⚽" })).toHaveLength(64);
    expect(domainHash("test-v1", { café: "⚽" })).toBe(
      domainHash("test-v1", { café: "⚽" }),
    );
  });

  it("accepts only explicit UTC semantic timestamps", () => {
    expect(canonicalTimestamp("2026-09-27T12:00:00Z")).toBe(
      "2026-09-27T12:00:00Z",
    );
    expect(() => canonicalTimestamp("2026-09-27T12:00:00+01:00")).toThrow();
  });
});

describe("adversarial semantic boundaries", () => {
  it("rejects sparse arrays at every nesting level", () => {
    const hole = new Array<unknown>(2);
    hole[1] = "present";
    expect(() => canonicalJson(hole)).toThrow(/Sparse/);
    expect(() => canonicalJson({ nested: hole })).toThrow(/Sparse/);
    expect(canonicalJson([null, "present"])).toBe('[null,"present"]');
  });
  it("rejects impossible calendar dates, non-leap days and 24-hour rollover", () => {
    for (const value of [
      "2026-02-29T00:00:00Z",
      "2024-02-30T00:00:00Z",
      "2026-04-31T00:00:00Z",
      "2026-09-27T24:00:00Z",
      "1900-02-29T00:00:00Z",
      "2026-00-01T00:00:00Z",
      "2026-01-00T00:00:00Z",
      "2026-09-27T12:60:00Z",
    ])
      expect(() => canonicalTimestamp(value)).toThrow();
    for (const value of ["2000-02-29T00:00:00Z", "2024-02-29T23:59:59.123456Z"])
      expect(canonicalTimestamp(value)).toBe(value);
  });
});

it("preserves supplied valid RFC 3339 fractional digits without inventing normalization", () => {
  for (const fraction of ["0", "000", "100", "12345678901234567890"]) {
    const value = `2026-09-27T12:00:00.${fraction}Z`;
    expect(canonicalTimestamp(value)).toBe(value);
  }
  expect(() => canonicalTimestamp("2026-09-27T12:00:00.Z")).toThrow();
  expect(() => canonicalTimestamp("2026-09-27T12:00:00.100+00:00")).toThrow();
});
