import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  loadFingerprintVectors,
  loadFixtureBytes,
  loadFixtureJson,
  loadFoundationRows,
  verifyPolicySources,
} from "../src/fixture/loader.js";
import { must } from "./support/fixture-v046.js";
import { canonicalJson } from "../src/identity/canonical-json.js";
import {
  fingerprint,
  stageDomains,
  type StageName,
} from "../src/identity/fingerprints.js";
import {
  locateCodePointSpan,
  sliceCodePointSpan,
} from "../src/identity/spans.js";

// Loader conformance against the active Frozen Fixture v0.4.6 (pinned and verified by the production loader). Hash and
// vector coverage of the identity projections lives in the a1-* suites; this file covers the loader's own contract.
describe("Frozen Fixture v0.4.6 through the production loader", () => {
  it("reproduces all six stage fingerprints from the shipped projections", () => {
    const vectors = loadFingerprintVectors();
    expect(Object.keys(vectors).sort()).toEqual(
      Object.keys(stageDomains).sort(),
    );
    for (const [stage, vector] of Object.entries(vectors)) {
      expect(vector.domain).toBe(stageDomains[stage as StageName]);
      expect(fingerprint(stage as StageName, vector.input_projection)).toBe(
        vector.fingerprint,
      );
    }
  });

  it("validates Unicode serialization and code-point span vectors", () => {
    const fixture = loadFixtureJson("unicode_conformance.json") as {
      spoken_text: string;
      span_vectors: { substring: string; start: number; end: number }[];
      key_order_input: unknown;
      canonical_json_utf8: string;
    };
    expect(canonicalJson(fixture.key_order_input)).toBe(
      fixture.canonical_json_utf8,
    );
    for (const vector of fixture.span_vectors) {
      expect(
        locateCodePointSpan(fixture.spoken_text, vector.substring),
      ).toEqual({ start: vector.start, end: vector.end });
      expect(sliceCodePointSpan(fixture.spoken_text, vector)).toBe(
        vector.substring,
      );
    }
  });

  it("binds the ten active policy sources to the exact locked bytes and the shipped copies", async () => {
    await expect(verifyPolicySources()).resolves.toBeUndefined();
  });

  it("reproduces every audio artifact hash from the shipped WAV members", () => {
    const audio =
      loadFoundationRows().tables.artifacts?.filter((a) =>
        String(a.artifact_type).startsWith("audio/"),
      ) ?? [];
    expect(audio).toHaveLength(12);
    for (const a of audio)
      expect(
        createHash("sha256")
          .update(loadFixtureBytes(String(a.storage_uri)))
          .digest("hex"),
      ).toBe(a.content_hash);
  });

  it("checks READY lineage identity without executing workflow", () => {
    const ready = must(loadFingerprintVectors().ready_candidate);
    const revalidation = loadFixtureJson("revalidation_result.json") as {
      ready_candidate_fingerprint: string;
    };
    expect(revalidation.ready_candidate_fingerprint).toBe(ready.fingerprint);
    const expectations = loadFixtureJson("ready_expectations.json") as {
      attempt_id: string;
    };
    expect(ready.input_projection.attempt_id).toBe(expectations.attempt_id);
  });
});
