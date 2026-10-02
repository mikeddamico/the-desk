import { describe, expect, it } from "vitest";

import { canonicalJson } from "../src/identity/canonical-json.js";
import {
  assertJson,
  Rejection,
  requireTimestamp,
} from "../src/runtime/command.js";
import { claimSubjectRef, parsePackage } from "../src/runtime/package.js";
import {
  fixturePackageArtifact,
  rebuildPackage,
} from "./support/a5-fixture.js";

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
    expect(() =>
      parsePackage(
        rebuildPackage((payload) => {
          const m = payload.manifest as { evidence: unknown[] };
          m.evidence.push(m.evidence[0]);
        }),
      ),
    ).toThrow(
      expect.objectContaining({
        code: "package_evidence_duplicate",
      }) as Rejection,
    );
    expect(bad((p) => (p.byte_size = -1))).toThrow(Rejection);
  });
});

describe("A5.1 JSON normalization keeps every own key (controls)", () => {
  const withProto = (): unknown =>
    JSON.parse(
      '{"__proto__":{"changed":true},"x":1,"nested":{"__proto__":[1,{"__proto__":2}]},"list":[{"__proto__":"a","constructor":"b"}]}',
    );
  it("preserves own __proto__/constructor keys at every depth, in objects and inside arrays, without touching prototypes", () => {
    const out = assertJson(withProto(), "v") as Record<string, unknown>;
    expect(Object.keys(out).sort()).toEqual([
      "__proto__",
      "list",
      "nested",
      "x",
    ]);
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).changed).toBeUndefined();
    const list = out.list as Record<string, unknown>[];
    expect(Object.keys(list[0] ?? {}).sort()).toEqual([
      "__proto__",
      "constructor",
    ]);
    const nested = out.nested as Record<string, unknown>;
    expect(
      Array.isArray(
        Object.getOwnPropertyDescriptor(nested, "__proto__")?.value,
      ),
    ).toBe(true);
  });
  it("hashes, compares and serializes ONE representation: the normalized copy equals the source key for key", () => {
    const source = withProto();
    const out = assertJson(source, "v");
    expect(canonicalJson(out)).toBe(canonicalJson(source));
    expect(JSON.stringify(out)).toBe(JSON.stringify(source));
    expect(JSON.stringify(out)).toContain('"__proto__":{"changed":true}');
  });
  it("still rejects non-integers, unsafe integers, -0, undefined and class instances", () => {
    for (const bad of [
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
      -0,
      undefined,
      new Date(),
      new Map(),
    ])
      expect(() => assertJson({ a: [bad] }, "v")).toThrow(Rejection);
  });
});

describe("A5.1 claim subject reconciliation (bounded fixture representation)", () => {
  it("accepts exactly {entity_ref: non-empty string} and refuses every other persisted subject shape", () => {
    expect(claimSubjectRef({ entity_ref: "entity_northbridge_fc" })).toBe(
      "entity_northbridge_fc",
    );
    for (const bad of [
      null,
      "entity_northbridge_fc",
      [],
      {},
      { entity_ref: "" },
      { entity_ref: 5 },
      { entity_ref: "a", extra: "b" },
      { other: "a" },
    ])
      expect(() => claimSubjectRef(bad)).toThrow(
        expect.objectContaining({
          code: "package_claim_subject_unsupported",
        }) as Rejection,
      );
  });
});
