import { describe, expect, it } from "vitest";
import { loadFingerprintVectors } from "../src/fixture/loader.js";
import { fingerprint, type StageName } from "../src/identity/fingerprints.js";

describe("exact stage projections", () => {
  it("rejects missing, extra and another stage's fields for all six locked projections", () => {
    for (const [stage, vector] of Object.entries(loadFingerprintVectors())) {
      const input = vector.input_projection;
      expect(fingerprint(stage as StageName, input)).toBe(vector.fingerprint);
      expect(() =>
        fingerprint(stage as StageName, {
          ...input,
          forbidden_semantic_field: "anything",
        }),
      ).toThrow(/exactly/);
      for (const key of Object.keys(input)) {
        const missing = Object.fromEntries(
          Object.entries(input).filter(([field]) => field !== key),
        );
        expect(() => fingerprint(stage as StageName, missing)).toThrow(
          /exactly/,
        );
      }
    }
  });
  it("validates the exact nested assembly lineage and hash types", () => {
    const vector = loadFingerprintVectors().assembly;
    if (!vector) throw new Error("Missing locked assembly vector");
    const input = vector.input_projection;
    const lineage = input.selected_take_lineage;
    if (!Array.isArray(lineage)) throw new Error("Missing lineage");
    const item = lineage[0] as Record<string, unknown>;
    expect(() =>
      fingerprint("assembly", {
        ...input,
        selected_take_lineage: [{ ...item, provider_cost: "1.00" }],
      }),
    ).toThrow(/exactly/);
    expect(() =>
      fingerprint("assembly", {
        ...input,
        selected_take_lineage: [{ ...item, audio_sha256: "bad" }],
      }),
    ).toThrow(/SHA-256/);
    expect(() =>
      fingerprint("assembly", {
        ...input,
        selected_take_lineage: [{ ...item, take_index: -1 }],
      }),
    ).toThrow(/take index/);
  });
});
