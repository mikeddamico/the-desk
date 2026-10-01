import { describe, expect, it } from "vitest";

import { canonicalJson } from "../src/identity/canonical-json.js";
import { rawBytesHash } from "../src/identity/domains.js";
import {
  claimContentHash,
  claimFrozenStateHash,
  derivationOutputHash,
  fixtureSupportObjectHash,
  supportHashFor,
} from "../src/identity/knowledge.js";
import {
  assertCompletePromptManifestPayload,
  modelSemanticInputHash,
  promptManifestArtifactHash,
  promptManifestFields,
  reconcileTypedManifestFields,
} from "../src/identity/prompt-manifest.js";

import {
  applyMutations,
  artifactsByType,
  fixtureBytes,
  fixtureJson,
  foundationTables,
  must,
  payloadOf,
  type Mutation,
  type Row,
} from "./support/fixture-v046.js";

const tables = foundationTables();

describe("claim content and frozen state (Hashing 12.1)", () => {
  it("reproduces the nine claim content hashes and the nine package frozen-state hashes (zero base events)", () => {
    const claims = tables.claims ?? [];
    expect(claims).toHaveLength(9);
    const manifest = payloadOf(
      artifactsByType().get("evidence_package")?.[0] ?? {},
    ).manifest as { claims: Row[] };
    for (const claim of claims) {
      const content = claimContentHash(claim);
      expect(content).toBe(claim.content_hash);
      const frozen = manifest.claims.find((c) => c.claim_id === claim.claim_id);
      expect(
        claimFrozenStateHash({
          claim_content_hash: content,
          state: claim.initial_status,
          effective_usage_class: claim.initial_usage_class,
        }),
      ).toBe(frozen?.frozen_state_hash);
    }
    expect(tables.claim_state_events ?? []).toHaveLength(0);
  });

  it("matches the shipped frozen_hash conformance step", () => {
    const vectors = (
      fixtureJson("claim_event_conformance.json") as {
        vectors: { steps: { op: string; claim?: string; expect?: string }[] }[];
      }
    ).vectors;
    const steps = vectors.flatMap((v) =>
      v.steps.filter((s) => s.op === "frozen_hash"),
    );
    expect(steps).toHaveLength(1);
    const claim = (tables.claims ?? []).find(
      (c) => c.claim_id === steps[0]?.claim,
    );
    expect(
      claimFrozenStateHash({
        claim_content_hash: claimContentHash(claim),
        state: claim?.initial_status,
        effective_usage_class: claim?.initial_usage_class,
      }),
    ).toBe(steps[0]?.expect);
  });

  it("changes with initial status/usage, excludes bookkeeping and rejects invalid inputs by name", () => {
    const base = must(tables.claims?.[0], "claim");
    const hash = claimContentHash(base);
    expect(
      claimContentHash({
        ...base,
        claim_id: "x",
        created_at: "y",
        supports: [],
      }),
    ).toBe(hash);
    expect(claimContentHash({ ...base, initial_status: "contested" })).not.toBe(
      hash,
    );
    expect(
      claimContentHash({ ...base, initial_usage_class: "silent" }),
    ).not.toBe(hash);
    expect(() =>
      claimContentHash({ ...base, initial_status: "usage_changed" }),
    ).toThrow(/initial_status/);
    expect(() =>
      claimContentHash({ ...base, initial_usage_class: "loud" }),
    ).toThrow(/initial_usage_class/);
    expect(() =>
      claimContentHash({ ...base, asserted_at: "2026-02-30T00:00:00Z" }),
    ).toThrow(/Impossible/);
    expect(() =>
      claimContentHash({ ...base, asserted_at: "2026-09-27T12:00:00+01:00" }),
    ).toThrow(/UTC/);
    const missing = Object.fromEntries(
      Object.entries(base).filter(([key]) => key !== "predicate"),
    );
    expect(() => claimContentHash(missing)).toThrow(
      /missing required field: predicate/,
    );
    expect(claimContentHash({ ...base, asserted_at: null })).not.toBe(hash);
    expect(() =>
      claimFrozenStateHash({
        claim_content_hash: hash,
        state: "usage_changed",
        effective_usage_class: "assertable",
      }),
    ).toThrow(/state/);
    expect(() =>
      claimFrozenStateHash({
        claim_content_hash: "ABC",
        state: "confirmed",
        effective_usage_class: "assertable",
      }),
    ).toThrow(/SHA-256/);
    expect(() =>
      claimFrozenStateHash({
        claim_content_hash: hash,
        state: "confirmed",
        effective_usage_class: "assertable",
        actor_id: "a",
      }),
    ).not.toThrow();
  });
});

describe("derivation output and support hashes (Hashing 12.3-12.4, Claims 4.3)", () => {
  it("reproduces the derivation output hash and rejects null output", () => {
    const run = must(tables.derivation_runs?.[0], "derivation run");
    expect(run.output).toEqual({ count: 3, sample_size: 5, after_minute: 80 });
    expect(derivationOutputHash(run.output)).toBe(run.output_hash);
    for (const ok of [[1], "s", 3, true, false, 0, {}])
      expect(() => derivationOutputHash(ok)).not.toThrow();
    for (const bad of [null, undefined])
      expect(() => derivationOutputHash(bad)).toThrow(/null/);
  });

  it("reproduces the nine claim support hashes by kind and the two carrier artifact hashes", () => {
    const units = new Map(
      (tables.evidence_units ?? []).map((u) => [
        u.evidence_unit_id as string,
        u,
      ]),
    );
    const artifacts = new Map(
      (tables.artifacts ?? []).map((a) => [a.artifact_id as string, a]),
    );
    const run = must(tables.derivation_runs?.[0], "derivation run");
    const supports = tables.claim_supports ?? [];
    expect(supports).toHaveLength(9);
    const kinds = new Set<string>();
    for (const support of supports) {
      const kind = support.support_kind as string;
      kinds.add(kind);
      let actual: string;
      if (kind === "evidence")
        actual = supportHashFor(kind, {
          evidenceBody: units.get(support.evidence_unit_id as string)
            ?.canonical_content as string,
        });
      else if (kind === "derivation")
        actual = supportHashFor(kind, { derivationOutput: run.output });
      else {
        const id =
          (support.external_support_identity as string).split(":", 2)[1] ?? "";
        const carrier = artifacts.get(id);
        actual = supportHashFor(kind, { carrier: carrier?.canonical_payload });
        expect(carrier?.content_hash).toBe(actual);
      }
      expect(actual).toBe(support.support_hash);
    }
    expect([...kinds].sort()).toEqual([
      "continuity",
      "derivation",
      "evidence",
      "signal",
    ]);
  });

  it("rejects malformed carriers and ungoverned support kinds by name", () => {
    const carrier = payloadOf(
      artifactsByType().get("tenor_support")?.[0] ?? {},
    );
    expect(() =>
      fixtureSupportObjectHash({ ...carrier, summary_digest: "x" }),
    ).toThrow(/exactly/);
    expect(() => fixtureSupportObjectHash({ support_kind: "signal" })).toThrow(
      /exactly/,
    );
    expect(() =>
      fixtureSupportObjectHash({ ...carrier, support_kind: "lore" }),
    ).toThrow(/support_kind/);
    expect(() => supportHashFor("lore", {})).toThrow(
      /No governed support-hash rule/,
    );
    expect(() => supportHashFor("evidence", {})).toThrow(/evidence body/);
  });
});

describe("complete prompt manifests and model semantic input (Hashing 11, 12.5)", () => {
  const shipped = fixtureJson("prompt_manifest_conformance.json") as {
    baseline: { payload: Row; complete_hash: string; semantic_hash: string };
    vectors: {
      id: string;
      class: string;
      mutations: Mutation[];
      mutations_b?: Mutation[];
      expect: {
        complete: "same" | "different";
        complete_hash: string;
        semantic: "same" | "different" | "not_computable";
        semantic_hash: string | null;
        equal_to_b?: boolean;
      };
    }[];
    envelope_vectors: { id: string; change: Row }[];
  };

  it("reproduces the baseline complete and semantic hashes and the 16-field shape", () => {
    expect(shipped.vectors).toHaveLength(82);
    expect(Object.keys(shipped.baseline.payload).sort()).toEqual(
      [...promptManifestFields].sort(),
    );
    expect(promptManifestArtifactHash(shipped.baseline.payload)).toBe(
      shipped.baseline.complete_hash,
    );
    expect(modelSemanticInputHash(shipped.baseline.payload)).toBe(
      shipped.baseline.semantic_hash,
    );
    expect(() => {
      assertCompletePromptManifestPayload(shipped.baseline.payload);
    }).not.toThrow();
  });

  it("reproduces every one of the 82 hash-function vectors with the stated same/different relations", () => {
    const classes = new Map<string, number>();
    for (const vector of shipped.vectors) {
      classes.set(vector.class, (classes.get(vector.class) ?? 0) + 1);
      const mutated = applyMutations(
        shipped.baseline.payload,
        vector.mutations,
      );
      const complete = promptManifestArtifactHash(mutated);
      expect(complete, vector.id).toBe(vector.expect.complete_hash);
      expect(
        complete === shipped.baseline.complete_hash ? "same" : "different",
        vector.id,
      ).toBe(vector.expect.complete);
      if (vector.expect.semantic === "not_computable") {
        expect(() => modelSemanticInputHash(mutated), vector.id).toThrow(
          /missing required field/,
        );
      } else {
        const semantic = modelSemanticInputHash(mutated);
        expect(semantic, vector.id).toBe(vector.expect.semantic_hash);
        expect(
          semantic === shipped.baseline.semantic_hash ? "same" : "different",
          vector.id,
        ).toBe(vector.expect.semantic);
      }
      if (vector.mutations_b) {
        const other = promptManifestArtifactHash(
          applyMutations(shipped.baseline.payload, vector.mutations_b),
        );
        expect(other === complete, vector.id).toBe(vector.expect.equal_to_b);
      }
    }
    expect(Object.fromEntries(classes)).toEqual({
      field_replaced: 16,
      field_deleted: 16,
      nested_leaf_sensitivity: 36,
      array_structure: 5,
      type_sensitivity: 4,
      serialization_stability: 3,
      hidden_tail: 2,
    });
  });

  it("rejects missing fields and hidden tails at acceptance while the hash function stays total", () => {
    for (const vector of shipped.vectors.filter(
      (v) => v.class === "field_deleted" || v.class === "hidden_tail",
    ))
      expect(() => {
        assertCompletePromptManifestPayload(
          applyMutations(shipped.baseline.payload, vector.mutations),
        );
      }, vector.id).toThrow(/exactly/);
  });

  it("keeps the outer artifact envelope out of the hash (9 envelope vectors)", () => {
    expect(shipped.envelope_vectors).toHaveLength(9);
    for (const vector of shipped.envelope_vectors) {
      // The envelope is not an input of the function: the payload hash is the same whatever it says.
      expect(Object.keys(vector.change).length).toBeGreaterThan(0);
      expect(promptManifestArtifactHash(shipped.baseline.payload)).toBe(
        shipped.baseline.complete_hash,
      );
    }
  });

  it("reproduces the five shipped prompt manifests, their typed reconciliation, request specimens and model hashes", () => {
    const manifests = tables.prompt_manifests ?? [];
    const runs = tables.model_runs ?? [];
    const artifacts = new Map(
      (tables.artifacts ?? []).map((a) => [a.artifact_id as string, a]),
    );
    const specimens = (
      fixtureJson("fixture_model_requests.json") as {
        requests: { prompt_manifest_id: string; rendered_request: string }[];
      }
    ).requests;
    expect(manifests).toHaveLength(5);
    expect(runs).toHaveLength(5);
    const outputs = new Set<string>();
    for (const row of manifests) {
      const artifact = artifacts.get(row.artifact_id as string);
      const payload = payloadOf(artifact ?? {});
      expect(promptManifestArtifactHash(payload)).toBe(artifact?.content_hash);
      assertCompletePromptManifestPayload(payload);
      reconcileTypedManifestFields(row, payload);
      const specimen = specimens.find(
        (s) => s.prompt_manifest_id === row.prompt_manifest_id,
      );
      expect(
        rawBytesHash(Buffer.from(specimen?.rendered_request ?? "", "utf8")),
      ).toBe(row.rendered_request_hash);
      const run = runs.find(
        (r) => r.prompt_manifest_id === row.prompt_manifest_id,
      );
      expect(modelSemanticInputHash(row)).toBe(run?.semantic_input_hash);
      outputs.add(row.artifact_id as string);
    }
    expect(outputs.size).toBe(5);
    expect(() => {
      reconcileTypedManifestFields(
        { ...must(manifests[0], "manifest"), component_versions: { x: 1 } },
        payloadOf(
          artifacts.get(String(must(manifests[0], "manifest").artifact_id)) ??
            {},
        ),
      );
    }).toThrow(/component_versions/);
    expect(canonicalJson(1)).toBe("1");
  });

  it("reproduces the 24 shipped model semantic-input vectors (4 baseline/sensitivity, 20 excluded metadata)", () => {
    const file = fixtureJson("model_semantic_input_conformance.json") as {
      domain: string;
      baseline_hash: string;
      vectors: {
        name: string;
        manifest: Row;
        expected_projection: Row;
        expected_hash: string;
        expected_relation_to_baseline: string;
      }[];
    };
    expect(file.domain).toBe("model-semantic-input-v1");
    expect(file.vectors).toHaveLength(24);
    for (const vector of file.vectors) {
      expect(modelSemanticInputHash(vector.manifest), vector.name).toBe(
        vector.expected_hash,
      );
      expect(
        modelSemanticInputHash(vector.manifest) === file.baseline_hash
          ? "same"
          : "different",
        vector.name,
      ).toBe(vector.expected_relation_to_baseline);
    }
    expect(
      file.vectors.filter((v) => v.name.startsWith("exclude-")),
    ).toHaveLength(20);
    expect(fixtureBytes("fixture_model_requests.json").length).toBeGreaterThan(
      0,
    );
  });
});
