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
