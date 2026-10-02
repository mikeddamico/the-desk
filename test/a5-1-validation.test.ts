import { describe, expect, it } from "vitest";

import { Rejection, requireTimestamp } from "../src/runtime/command.js";
import { parsePackage } from "../src/runtime/package.js";
import { fixturePackageArtifact } from "./support/a5-fixture.js";

describe("A5.1 request validation (no database)", () => {
  it("keeps the authored timestamp string and accepts 0-6 fractional digits and numeric offsets", () => {
    for (const ok of [
      "2026-09-27T12:59:00Z",
      "2026-09-27T12:59:00.1Z",
      "2026-09-27T12:59:00.123456Z",
      "2026-09-27T13:59:00.123456+01:00",
    ])
      expect(requireTimestamp(ok, "t")).toBe(ok);
  });
  it("rejects a seventh fractional digit (PostgreSQL would round it) and malformed instants", () => {
    expect(() => requireTimestamp("2026-09-27T12:59:00.1234567Z", "t")).toThrow(
      expect.objectContaining({ code: "timestamp_precision" }) as Rejection,
    );
    for (const bad of [
      "2026-02-30T00:00:00Z",
      "2026-09-27 12:59:00Z",
      "2026-09-27T24:00:00Z",
      "2026-09-27T12:59:60Z",
      "2026-09-27T12:59:00",
      "2026-09-27T12:59:00+24:00",
      12,
    ])
      expect(() => requireTimestamp(bad, "t")).toThrow(Rejection);
  });
  it("the fixture package parses, and package hash fields, ids and shape are validated", () => {
    const pkg = fixturePackageArtifact();
    expect(parsePackage(pkg).evidence).toHaveLength(16);
    const bad = (
      mut: (p: ReturnType<typeof fixturePackageArtifact>) => void,
    ) => {
      const p = fixturePackageArtifact();
      mut(p);
      return () => parsePackage(p);
    };
    expect(bad((p) => (p.schema_version = ""))).toThrow(Rejection);
    expect(bad((p) => (p.artifact_id = "not-a-uuid"))).toThrow(Rejection);
    expect(
      bad((p) => {
        (p.canonical_payload as Record<string, unknown>).package_hash =
          "0".repeat(64);
      }),
    ).toThrow(
      expect.objectContaining({
        code: "package_hash_field_mismatch",
      }) as Rejection,
    );
    expect(
      bad((p) => {
        const payload = p.canonical_payload as Record<string, unknown>;
        delete payload.package_hash; // a changed manifest would otherwise fail the hash-field check first
        const m = payload.manifest as { evidence: unknown[] };
        m.evidence.push(m.evidence[0]);
      }),
    ).toThrow(
      expect.objectContaining({
        code: "package_evidence_duplicate",
      }) as Rejection,
    );
    expect(bad((p) => (p.byte_size = -1))).toThrow(Rejection);
  });
});
