import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  loadFingerprintVectors,
  loadFixtureBytes,
  loadFixtureJson,
  verifyPolicySources,
} from "../src/fixture/loader.js";
import {
  baseRequestHash,
  fingerprint,
  projectBaseRequest,
  stageDomains,
  type StageName,
} from "../src/identity/fingerprints.js";
import { canonicalJson } from "../src/identity/canonical-json.js";
import {
  locateCodePointSpan,
  sliceCodePointSpan,
} from "../src/identity/spans.js";

describe("Frozen Fixture v0.4.3 deterministic conformance", () => {
  it("reproduces all six stage fingerprints from shipped projections", () => {
    const fixture = loadFingerprintVectors();
    expect(Object.keys(fixture.fingerprints)).toHaveLength(6);
    for (const [stage, vector] of Object.entries(fixture.fingerprints)) {
      expect(vector.domain).toBe(stageDomains[stage as StageName]);
      expect(fingerprint(stage as StageName, vector.input_projection)).toBe(
        vector.expected_hash,
      );
    }
  });

  it("reproduces all P&R sensitivity/stability vectors and projection selection", () => {
    const fixture = loadFixtureJson("base_request_hash_conformance.json") as {
      baseline_hash: string;
      baseline_input_record: Record<string, unknown>;
      baseline_projection: Record<string, unknown>;
      vectors: {
        input_record: Record<string, unknown>;
        expected_projection: Record<string, unknown>;
        expected_hash: string;
        expected_relation_to_baseline: string;
      }[];
    };
    expect(projectBaseRequest(fixture.baseline_input_record)).toEqual(
      fixture.baseline_projection,
    );
    expect(baseRequestHash(fixture.baseline_input_record)).toBe(
      fixture.baseline_hash,
    );
    for (const vector of fixture.vectors) {
      expect(projectBaseRequest(vector.input_record)).toEqual(
        vector.expected_projection,
      );
      expect(baseRequestHash(vector.input_record)).toBe(vector.expected_hash);
      expect(
        vector.expected_hash === fixture.baseline_hash ? "same" : "different",
      ).toBe(vector.expected_relation_to_baseline);
    }
  });

  it("reproduces all nine actual render-block baseline hashes", () => {
    const fixture = loadFixtureJson("render_request_projections.json") as {
      projections: {
        projection: Record<string, unknown>;
        base_request_hash: string;
      }[];
    };
    expect(fixture.projections).toHaveLength(9);
    for (const vector of fixture.projections)
      expect(baseRequestHash(vector.projection)).toBe(vector.base_request_hash);
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

  it("binds active policy versions to exact locked source bytes", async () => {
    await expect(verifyPolicySources()).resolves.toBeUndefined();
  });

  it("reproduces fixture audio and clean-master hashes", () => {
    const audio = loadFixtureJson("audio_artifacts.json") as {
      artifacts: { path: string; sha256: string }[];
    };
    for (const artifact of audio.artifacts) {
      expect(
        createHash("sha256")
          .update(loadFixtureBytes(artifact.path))
          .digest("hex"),
      ).toBe(artifact.sha256);
    }
    const master = loadFixtureJson("master_artifact.json") as {
      path: string;
      content_hash: string;
    };
    expect(
      createHash("sha256").update(loadFixtureBytes(master.path)).digest("hex"),
    ).toBe(master.content_hash);
  });

  it("checks READY lineage identity without executing workflow", () => {
    const ready = loadFixtureJson("episode_ready.json") as {
      ready_candidate_fingerprint: string;
      ready_attempt_id: string;
    };
    const review = loadFixtureJson("pre_publish_review.json") as {
      ready_candidate_fingerprint: string;
      attempt_id: string;
    };
    const revalidation = loadFixtureJson("revalidation_result.json") as {
      ready_candidate_fingerprint: string;
    };
    expect(review.ready_candidate_fingerprint).toBe(
      ready.ready_candidate_fingerprint,
    );
    expect(revalidation.ready_candidate_fingerprint).toBe(
      ready.ready_candidate_fingerprint,
    );
    expect(review.attempt_id).toBe(ready.ready_attempt_id);
  });
});
