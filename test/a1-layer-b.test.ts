import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  turnAnchorMap,
  performanceDirectionHash,
} from "../src/identity/artifacts.js";
import { canonicalBytes } from "../src/identity/canonical-json.js";
import { rawBytesHash } from "../src/identity/domains.js";
import {
  assertCurrentInputFingerprint,
  assertHistoricalProducerNull,
  correctionInputFingerprintFromBytes,
  correctionInputProjection,
  evidencePackageScopeHash,
  evidencePackageScopeProjection,
  HISTORICAL_NULL_DISPOSITION,
  performanceDirectionCorrectionInputFingerprint,
  renderContextHash,
  renderContextProjection,
} from "../src/identity/layer-b.js";

import {
  fixtureBytes,
  fixtureJson,
  foundationTables,
  must,
  payloadOf,
  type Row,
} from "./support/fixture-v046.js";

// Layer B decisions are FIXTURE-SCOPED (Trace 9); nothing here is product policy.
const pkg = (): Row =>
  must(
    foundationTables().artifacts?.find(
      (a) => a.artifact_type === "evidence_package",
    ),
    "package",
  );
const pkgPayload = (): {
  scope_hash: string;
  manifest: { scope: Record<string, unknown> };
} =>
  payloadOf(pkg()) as {
    scope_hash: string;
    manifest: { scope: Record<string, unknown> };
  };

describe("evidence-package-scope-v1 (Layer B, fixture-scoped)", () => {
  it("reproduces the captured projection bytes and the shipped scope hash", () => {
    const scope = pkgPayload().manifest.scope;
    expect(canonicalBytes(evidencePackageScopeProjection(scope))).toEqual(
      fixtureBytes("provenance/captured/scope_projection.bytes"),
    );
    expect(evidencePackageScopeHash(scope)).toBe(pkgPayload().scope_hash);
  });

  it("frames exactly one LF after the domain with no trailing LF, BOM or wrapper", () => {
    const scope = pkgPayload().manifest.scope;
    const canonical = canonicalBytes(
      evidencePackageScopeProjection(scope),
    ).toString("utf8");
    const bom = String.fromCharCode(0xfeff);
    const framed = (text: string): string =>
      createHash("sha256").update(text, "utf8").digest("hex");
    const expected = pkgPayload().scope_hash;
    expect(framed(`evidence-package-scope-v1\n${canonical}`)).toBe(expected);
    expect(framed(`evidence-package-scope-v1${canonical}`)).not.toBe(expected);
    expect(framed(`evidence-package-scope-v1\n${canonical}\n`)).not.toBe(
      expected,
    );
    expect(framed(`evidence-package-scope-v1\n${bom}${canonical}`)).not.toBe(
      expected,
    );
    expect(
      framed(`evidence-package-scope-v1\n{"scope":${canonical}}`),
    ).not.toBe(expected);
    expect(framed(`evidence-package-scope-v1\n\n${canonical}`)).not.toBe(
      expected,
    );
  });

  it("rejects by name: other scope type, unrecognized, missing and mistyped fields", () => {
    const scope = pkgPayload().manifest.scope;
    expect(() =>
      evidencePackageScopeHash({ ...scope, scope_type: "season" }),
    ).toThrow(/literal event/);
    expect(() => evidencePackageScopeHash({ ...scope, extra: 1 })).toThrow(
      /exactly/,
    );
    for (const key of Object.keys(scope)) {
      const missing = Object.fromEntries(
        Object.entries(scope).filter(([field]) => field !== key),
      );
      expect(() => evidencePackageScopeHash(missing), key).toThrow(/exactly/);
    }
    expect(() =>
      evidencePackageScopeHash({ ...scope, event_ids: "event_fixture_001" }),
    ).toThrow(/event_ids must be an array/);
    expect(() =>
      evidencePackageScopeHash({ ...scope, event_ids: [" "] }),
    ).toThrow(/nonblank/);
    expect(() =>
      evidencePackageScopeHash({ ...scope, show_id: "not-a-uuid" }),
    ).toThrow(/UUID/);
    const reordered = {
      ...scope,
      event_ids: [...(scope.event_ids as string[]), "event_two"],
    };
    expect(evidencePackageScopeHash(reordered)).not.toBe(
      evidencePackageScopeHash(scope),
    );
  });
});

describe("render-context-v1 and the bounded C0/C2 recipe digest (Layer B, fixture-scoped)", () => {
  const file = fixtureJson(
    "provenance/captured/render_context_projections.json",
  ) as {
    domain: string;
    contexts: {
      context_hash: string;
      context_projection: Row;
      render_block_sequence: number;
    }[];
  };

  it("reproduces the nine captured digests", () => {
    expect(file.domain).toBe("render-context-v1");
    expect(file.contexts).toHaveLength(9);
    for (const context of file.contexts) {
      expect(
        renderContextHash(context.context_projection),
        `rb${String(context.render_block_sequence)}`,
      ).toBe(context.context_hash);
    }
    expect(
      file.contexts.map(
        (c) =>
          (c.context_projection as { recipe_version: string }).recipe_version,
      ),
    ).toEqual(["C0-v1", ...Array<string>(8).fill("C2-v1")]);
  });

  it("derives each digest from the actual block records and excludes storage identity", () => {
    const blocks = (
      fixtureJson("base_request_hash_conformance.json") as {
        actual_blocks: {
          render_block_sequence: number;
          input_record: { context: { turns: Row[] } & Row };
        }[];
      }
    ).actual_blocks;
    for (const block of blocks) {
      const context = block.input_record.context;
      const shipped = file.contexts.find(
        (c) => c.render_block_sequence === block.render_block_sequence,
      );
      const turns = context.turns.map((t) => ({
        ...t,
        turn_id: "storage-identity",
        sequence: 99,
      }));
      // Storage identity and sequence are present in the record but never selected.
      expect(
        renderContextHash({ recipe_version: context.recipe_version, turns }),
      ).toBe(shipped?.context_hash);
    }
  });

  it("rejects unsupported recipes and wrong turn counts, and reacts to the actual context text", () => {
    const c2 = file.contexts[1]?.context_projection as {
      recipe_version: string;
      turns: Row[];
    };
    expect(() =>
      renderContextProjection({ recipe_version: "C1-v1", turns: [] }),
    ).toThrow(/Unsupported/);
    expect(() =>
      renderContextProjection({ recipe_version: "C0-v1", turns: c2.turns }),
    ).toThrow(/empty turns/);
    expect(() =>
      renderContextProjection({ recipe_version: "C2-v1", turns: [] }),
    ).toThrow(/exactly one/);
    expect(() =>
      renderContextProjection({
        recipe_version: "C2-v1",
        turns: c2.turns,
        extra: 1,
      }),
    ).toThrow(/exactly/);
    const changed = {
      ...c2,
      turns: [
        {
          ...must(c2.turns[0], "turn"),
          spoken_text: `${String(c2.turns[0]?.spoken_text)} x`,
        },
      ],
    };
    expect(renderContextHash(changed)).not.toBe(renderContextHash(c2));
  });
});

describe("performance-direction-correction-input-v1 (Layer B, fixture-scoped)", () => {
  const bytes = fixtureBytes(
    "provenance/frozen/correction_input_projection.json",
  );
  const projection = JSON.parse(bytes.toString("utf8")) as Record<
    string,
    unknown
  >;
  const current = (): Row =>
    must(
      foundationTables().artifacts?.find(
        (a) =>
          a.artifact_type === "performance_direction" &&
          !(a.artifact_id as string).endsWith("012"),
      ),
      "current direction",
    );

  it("reproduces the frozen five-key projection bytes and the shipped fingerprint", () => {
    expect(Object.keys(projection).sort()).toEqual([
      "adjudication_record_sha256",
      "correction",
      "direction_spec_version",
      "script_hash",
      "source_direction_hash",
    ]);
    expect(canonicalBytes(correctionInputProjection(projection))).toEqual(
      bytes,
    );
    const fingerprint =
      performanceDirectionCorrectionInputFingerprint(projection);
    expect(fingerprint).toBe(payloadOf(current()).input_fingerprint);
    expect(correctionInputFingerprintFromBytes(bytes)).toBe(fingerprint);
  });

  it("binds the raw bytes of the frozen version 2 technical-resolution record", () => {
    const record = fixtureBytes(
      "provenance/frozen/technical_resolution_record_v2.md",
    );
    expect(rawBytesHash(record)).toBe(projection.adjudication_record_sha256);
  });

  it("rejects by name: extra/missing keys, wrong literals, malformed hashes, non-canonical bytes", () => {
    expect(() =>
      correctionInputProjection({ ...projection, extra: 1 }),
    ).toThrow(/exactly/);
    for (const key of Object.keys(projection))
      expect(
        () =>
          correctionInputProjection(
            Object.fromEntries(
              Object.entries(projection).filter(([k]) => k !== key),
            ),
          ),
        key,
      ).toThrow(/exactly/);
    const correction = projection.correction as Record<string, unknown>;
    expect(() =>
      correctionInputProjection({
        ...projection,
        correction: { ...correction, replacement_value: "faster" },
      }),
    ).toThrow(/bounded fixture pace correction/);
    expect(() =>
      correctionInputProjection({
        ...projection,
        correction: { ...correction, expected_value: "slow" },
      }),
    ).toThrow(/bounded fixture pace correction/);
    expect(() =>
      correctionInputProjection({ ...projection, script_hash: "ABC" }),
    ).toThrow(/SHA-256/);
    expect(() =>
      correctionInputProjection({
        ...projection,
        direction_spec_version: "performance-render-0.1.3",
      }),
    ).toThrow(/direction_spec_version/);
    expect(() =>
      correctionInputFingerprintFromBytes(
        Buffer.concat([bytes, Buffer.from("\n")]),
      ),
    ).toThrow(/canonical bytes/);
    expect(() =>
      correctionInputFingerprintFromBytes(
        Buffer.from(JSON.stringify(projection, null, 2)),
      ),
    ).toThrow(/canonical bytes/);
  });
});

describe("CURRENT direction conformance (separate from historical reproduction)", () => {
  it("the current corrected direction carries a computed non-null fingerprint and reproduces from the current script", () => {
    const rows = (foundationTables().artifacts ?? []).filter(
      (a) => a.artifact_type === "performance_direction",
    );
    const current = must(
      rows.find((a) => !(a.artifact_id as string).endsWith("012")),
      "current",
    );
    const script = must(
      foundationTables().artifacts?.find(
        (a) => a.artifact_type === "script_pass2",
      ),
      "script",
    );
    expect(() => {
      assertCurrentInputFingerprint(payloadOf(current));
    }).not.toThrow();
    expect(
      performanceDirectionHash(
        payloadOf(current),
        turnAnchorMap(payloadOf(script).turns),
      ),
    ).toBe(current.content_hash);
    expect(payloadOf(current).script_hash).toBe(script.content_hash);
  });

  it("a historical envelope is NOT accepted as a current conforming direction", () => {
    const historical = payloadOf(
      must(
        (foundationTables().artifacts ?? []).find((a) =>
          (a.artifact_id as string).endsWith("012"),
        ),
        "historical",
      ),
    );
    expect(() => {
      assertCurrentInputFingerprint(historical);
    }).toThrow(/computed non-null/);
  });
});

describe("HISTORICAL IDENTITY REPRODUCTION (archive material, named test-only evidence)", () => {
  // Reads archived accepted-v2 script material ONLY to reproduce the preserved historical identity. Nothing is
  // co-loaded, aliased or reparented, and this is not a current conformance check.
  it("preserves the accepted historical hash, its null disposition and its reconstruction from archived anchors", () => {
    const row = must(
      (foundationTables().artifacts ?? []).find((a) =>
        (a.artifact_id as string).endsWith("012"),
      ),
      "historical row",
    );
    const payload = payloadOf(row);
    expect(row.content_hash).toBe(
      "ea5926e81267dd749cf33ed29564fe88815d3243b68260f1b4ddb96588e2f533",
    );
    expect(payload.input_fingerprint_disposition).toBe(
      HISTORICAL_NULL_DISPOSITION,
    );
    expect(() => {
      assertHistoricalProducerNull(payload);
    }).not.toThrow();
    const archivedScript = fixtureJson(
      "archive/i2a_source/script_pass2.json",
    ) as { turns: unknown };
    expect(
      performanceDirectionHash(payload, turnAnchorMap(archivedScript.turns)),
    ).toBe(row.content_hash);
    const sourceHash = (
      JSON.parse(
        fixtureBytes(
          "provenance/frozen/correction_input_projection.json",
        ).toString("utf8"),
      ) as { source_direction_hash: string }
    ).source_direction_hash;
    expect(sourceHash).toBe(row.content_hash);
  });

  it("allows null only with the exact disposition and never a substituted hash", () => {
    expect(() => {
      assertHistoricalProducerNull({ input_fingerprint: null });
    }).toThrow(/disposition/);
    expect(() => {
      assertHistoricalProducerNull({
        input_fingerprint: "a".repeat(64),
        input_fingerprint_disposition: HISTORICAL_NULL_DISPOSITION,
      });
    }).toThrow(/null/);
    expect(() => {
      assertCurrentInputFingerprint({ input_fingerprint: null });
    }).toThrow(/non-null/);
    expect(() => {
      assertCurrentInputFingerprint({
        input_fingerprint: "a".repeat(64),
        input_fingerprint_disposition: HISTORICAL_NULL_DISPOSITION,
      });
    }).toThrow(/historical null disposition/);
  });
});
