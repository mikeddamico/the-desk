import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  assemblyRecipeFields,
  assemblyRecipeHash,
  evidencePackageHash,
  masterAssemblyMapFields,
  masterAssemblyMapHash,
  masterAssemblyOffsetFields,
  masterAssemblySegmentFields,
  mechanicalValidationResultFields,
  mechanicalValidationResultHash,
  performanceDirectionHash,
  renderBlockPlanFields,
  renderManifestFields,
  renderManifestHash,
  revalidationResultFields,
  revalidationResultHash,
  revalidationSnapshotFields,
  revalidationSnapshotHash,
  scriptHash,
  scriptProjection,
  semanticAuditResultFields,
  semanticAuditResultHash,
  serializedWriterInputHash,
  ADDENDUM_VERSION_ID,
  predictionCandidateEmittedFields,
  predictionCandidateSourceFields,
  requiredPolicyRefs,
  showrunnerBriefExcludedFields,
  showrunnerBriefFields,
  showrunnerBriefHash,
  writerViewClaimKeys,
  writerViewContextKeys,
  writerViewEvidenceKeys,
  writerViewSupportRefKeys,
  turnAnchorMap,
  writerContextManifestFields,
  writerContextManifestHash,
  writerViewHash,
  writerViewKeys,
  writingCraftReviewHash,
  writingCraftReviewProjection,
} from "../src/identity/artifacts.js";
import { governedDomainHash } from "../src/identity/domains.js";
import {
  showConfigPayloadKeys,
  showConfigRuntimeKeys,
} from "../src/identity/show-config.js";
import {
  foundationTables,
  must,
  onlyArtifact,
  payloadOf,
  type Row,
} from "./support/fixture-v046.js";

// Hashing v0.1.5 4.1.1: a script with prediction candidates is projected against its bound Brief (the single active rule).
const BRIEF_OPTIONS = { brief: payloadOf(onlyArtifact("showrunner_brief")) };
const candidateScriptHash = (
  script: unknown,
  extra: Record<string, unknown> = {},
): string => scriptHash(script, { ...BRIEF_OPTIONS, ...extra });

function currentDirection(): Row {
  const rows = (foundationTables().artifacts ?? []).filter(
    (row) => row.artifact_type === "performance_direction",
  );
  return must(
    rows.find((row) => !(row.artifact_id as string).endsWith("012")),
    "current direction",
  );
}

const read = (path: string): string => readFileSync(path, "utf8");
const hashingSpec = read(
  "Lock/04_IMPLEMENTATION/The_Desk_Hashing_Fingerprints_and_Text_Spans_v0.1.5.md",
);
const writingSpec = read(
  "Lock/02_ACTIVE_SPECS/The_Desk_Writing_Spec_v0.2.3.md",
);
const showrunnerSpec = read(
  "Lock/02_ACTIVE_SPECS/The_Desk_Showrunner_Planning_v0.1.3.md",
);
const ticks = (text: string): string[] =>
  [...text.matchAll(/`([a-z0-9_]+)`/g)].map((m) => m[1] ?? "");
const section = (text: string, start: string, end: string): string =>
  text.slice(text.indexOf(start), text.indexOf(end, text.indexOf(start) + 1));

describe("selected-field constants equal their owning authority text", () => {
  it("writer data keys equal Writing 5.1 key by key (nineteen)", () => {
    const block =
      /```text\n([\s\S]*?)```/.exec(
        section(
          writingSpec,
          "## 5.1 Exact serialized writer input",
          "The exact serialized writer data input",
        ),
      )?.[1] ?? "";
    const keys = block
      .split("\n")
      .map((k) => k.trim())
      .filter(Boolean);
    expect(keys).toHaveLength(19);
    expect([...writerViewKeys]).toEqual(keys);
  });

  it("Hashing 4.6 result-carrier key tables", () => {
    const rows = new Map(
      [
        ...section(
          hashingSpec,
          "### 4.6 Durable result carriers",
          "## 5.",
        ).matchAll(/\| `([a-z0-9-]+)` \| ([^|]+) \|/g),
      ].map((m) => [m[1] ?? "", ticks(m[2] ?? "")] as const),
    );
    expect(rows.get("semantic-audit-result-v1")).toEqual([
      ...semanticAuditResultFields,
    ]);
    expect(rows.get("mechanical-validation-result-v1")).toEqual([
      ...mechanicalValidationResultFields,
    ]);
    expect(rows.get("fixture-revalidation-snapshot-v1")).toEqual([
      ...revalidationSnapshotFields,
    ]);
    expect(rows.get("fixture-revalidation-result-v1")).toEqual([
      ...revalidationResultFields,
    ]);
  });

  it("Hashing 4.3-4.5 render block, writer context, assembly recipe and map key lists", () => {
    const blockList =
      /```text\n([\s\S]*?)```/.exec(
        section(
          hashingSpec,
          "### 4.3 Render Manifest",
          "The top-level semantic",
        ),
      )?.[1] ?? "";
    expect([...renderBlockPlanFields]).toEqual(
      blockList
        .split("\n")
        .map((k) => k.trim())
        .filter(Boolean),
    );
    const context = section(
      hashingSpec,
      "`writer-context-manifest-v1` selects exactly",
      "Use an empty applicable",
    );
    expect(ticks(context)).toEqual([...writerContextManifestFields]);
    const recipe = section(
      hashingSpec,
      "The fixture `assembly-recipe-v1` selects exactly",
      "Ordered byte hashes",
    );
    expect(ticks(recipe)).toEqual([...assemblyRecipeFields]);
    const map = section(
      hashingSpec,
      "The fixture `master-assembly-map-v1` selects exactly",
      "Each ordered segment",
    );
    expect(ticks(map)).toEqual([...masterAssemblyMapFields]);
    const top = ticks(
      section(
        hashingSpec,
        "The top-level semantic Render Manifest includes",
        "**Configuration identities",
      ),
    );
    expect(top).toEqual([]);
    expect(renderManifestFields).toHaveLength(7);
  });

  it("Hashing v0.1.5 profile key lists (prediction, writer-view nested, show-config, Brief, policy refs) equal their constants", () => {
    const row = (text: string, label: string): string[] =>
      ticks(text.split("\n").find((line) => line.startsWith(label)) ?? "");
    const prediction = row(hashingSpec, "| Source carrier |").slice(0, 6);
    expect(prediction).toEqual([...predictionCandidateSourceFields]);
    expect(row(hashingSpec, "| Emitted |").slice(0, 6)).toEqual([
      ...predictionCandidateEmittedFields,
    ]);
    const nested = (label: string): string[] => row(hashingSpec, label);
    expect(nested("| `selected_claims[]` |")).toEqual([...writerViewClaimKeys]);
    expect(nested("| `selected_claims[].support_refs[]` |")).toEqual([
      ...writerViewSupportRefKeys,
    ]);
    expect(nested("| `selected_evidence[]` |").slice(0, 12)).toEqual([
      ...writerViewEvidenceKeys,
    ]);
    expect(nested("| `context_selections[]` |")).toEqual([
      ...writerViewContextKeys,
    ]);
    const showConfig = section(
      hashingSpec,
      "The `show-config/1` payload has exactly",
      "`show_config_version_hash`",
    );
    expect(ticks(showConfig).slice(0, 14)).toEqual([...showConfigPayloadKeys]);
    expect(ticks(showConfig).slice(15, 18)).toEqual([...showConfigRuntimeKeys]);
    const brief = section(
      hashingSpec,
      "Showrunner v0.1.3 §6/§6.1 owns",
      "`purpose` is excluded deliberately",
    );
    const briefTicks = ticks(brief);
    expect(briefTicks.slice(0, showrunnerBriefFields.length)).toEqual([
      ...showrunnerBriefFields,
    ]);
    for (const key of showrunnerBriefExcludedFields)
      expect(briefTicks, key).toContain(key);
    expect(requiredPolicyRefs).toEqual([
      "writing-0.2.3",
      ADDENDUM_VERSION_ID,
      "writing-craft-0.1",
      "claims-0.1.2",
    ]);
  });

  it("Hashing 4.5 nested segment and offset selections equal the Lock text", () => {
    const paragraph = section(
      hashingSpec,
      "Each ordered segment selects",
      "A static segment has null",
    );
    expect(ticks(paragraph)).toEqual([...masterAssemblySegmentFields]);
    const offsets = section(
      hashingSpec,
      "Program-block offset entries select",
      "Frame bounds are half-open",
    );
    expect(ticks(offsets)).toEqual([...masterAssemblyOffsetFields]);
  });

  it("Showrunner Brief selection is the schema minus the 6.1 exclusions, by name", () => {
    const block = section(
      showrunnerSpec,
      "showrunner_brief_version_id\nprogram_run_id",
      "The canonical brief should be normalizable",
    );
    const schema = block.split("\n").flatMap(
      (line) =>
        (line.split("#")[0] ?? "")
          .split(":")[0]
          ?.split("/")
          .map((token) => token.replaceAll(/[[\]?\s]/g, ""))
          .filter((token) => /^[a-z_]+$/.test(token)) ?? [],
    );
    const selected = new Set<string>([
      ...showrunnerBriefFields,
      "comprehension_targets",
    ]);
    const excluded = [
      "showrunner_brief_version_id",
      "program_run_id",
      "attempt_id",
      "purpose",
      "evidence_package_id",
      "planner_model_run_id",
      "created_at",
      "brief_hash",
      "revision_parent_id",
      "revision_reason",
    ];
    for (const field of selected) expect(schema, field).toContain(field);
    for (const field of excluded) expect(schema, field).toContain(field);
    const covered = new Set<string>([
      ...selected,
      ...excluded,
      "show_id",
      "show_version",
    ]);
    expect(schema.filter((f) => f !== "show_id" && !covered.has(f))).toEqual(
      [],
    );
    const categories = section(
      showrunnerSpec,
      "The semantic projection includes the package hash",
      "It excludes bookkeeping",
    );
    for (const word of [
      "package hash",
      "planning policy versions",
      "selected mode/template",
      "runtime target",
      "central question",
      "orientation job",
      "constraints",
      "selected beats",
      "program blocks",
      "context selections",
      "topic-thread mappings",
      "feature selections",
      "continuity instructions",
      "planning exclusions",
      "known gaps",
      "comprehension targets",
      "revision parent content identity",
    ])
      expect(categories, word).toContain(word);
    expect(showrunnerSpec).toContain(
      "It excludes bookkeeping/operational fields such as database IDs used only for storage, planner model-run ID, worker/request IDs, and `created_at`.",
    );
  });
});

describe("artifact content hashes reproduce from the shipped payload objects", () => {
  const artifact = (type: string): Row => onlyArtifact(type);
  const payload = (type: string): Record<string, unknown> =>
    payloadOf(artifact(type));
  const hash = (type: string): unknown => artifact(type).content_hash;

  it("reproduces the simple key-selection artifacts (audit, validation, snapshot, result, recipe, map, context, writer view, package)", () => {
    expect(semanticAuditResultHash(payload("semantic_audit_result"))).toBe(
      hash("semantic_audit_result"),
    );
    expect(
      mechanicalValidationResultHash(payload("mechanical_validation")),
    ).toBe(hash("mechanical_validation"));
    expect(revalidationSnapshotHash(payload("revalidation_snapshot"))).toBe(
      hash("revalidation_snapshot"),
    );
    expect(revalidationResultHash(payload("revalidation_result"))).toBe(
      hash("revalidation_result"),
    );
    expect(assemblyRecipeHash(payload("assembly_recipe"))).toBe(
      hash("assembly_recipe"),
    );
    expect(masterAssemblyMapHash(payload("master_assembly_map"))).toBe(
      hash("master_assembly_map"),
    );
    expect(writerContextManifestHash(payload("writer_context_manifest"))).toBe(
      hash("writer_context_manifest"),
    );
    expect(writerViewHash(payload("writer_view"))).toBe(hash("writer_view"));
    expect(evidencePackageHash(payload("evidence_package"))).toBe(
      hash("evidence_package"),
    );
    expect(showrunnerBriefHash(payload("showrunner_brief"))).toBe(
      hash("showrunner_brief"),
    );
    expect(renderManifestHash(payload("render_manifest"))).toBe(
      hash("render_manifest"),
    );
  });

  it("reproduces the three scripts, the craft review and the CURRENT performance direction", () => {
    for (const type of [
      "script_pass1",
      "script_craft_revision",
      "script_pass2",
    ])
      expect(candidateScriptHash(payload(type)), type).toBe(hash(type));
    const pass1 = turnAnchorMap(payload("script_pass1").turns);
    expect(writingCraftReviewHash(payload("writing_craft_review"), pass1)).toBe(
      hash("writing_craft_review"),
    );
    const pass2 = turnAnchorMap(payload("script_pass2").turns);
    const current = currentDirection();
    expect(performanceDirectionHash(current.canonical_payload, pass2)).toBe(
      current.content_hash,
    );
  });

  it("derives the writer serialized-input hash from the writer data bytes", () => {
    expect(serializedWriterInputHash(payload("writer_view"))).toBe(
      payload("writer_context_manifest").serialized_input_hash,
    );
  });
});

describe("rejections and rule isolation", () => {
  const script = (): Record<string, unknown> =>
    structuredClone(payloadOf(onlyArtifact("script_pass1")));
  const rows = <T>(value: unknown): T[] => value as T[];

  it("rejects missing governed keys by name and keeps live_search false", () => {
    const view = structuredClone(payloadOf(onlyArtifact("writer_view")));
    for (const key of writerViewKeys) {
      const rest = Object.fromEntries(
        Object.entries(view).filter(([field]) => field !== key),
      );
      expect(() => writerViewHash(rest), key).toThrow(
        new RegExp(`missing required field: ${key}`),
      );
    }
    expect(() => writerViewHash({ ...view, live_search: true })).toThrow(
      /live_search/,
    );
    expect(
      writerViewHash({
        ...view,
        script_request_id: "x",
        writer_view_hash: "y",
        artifact_registry: 1,
      }),
    ).toBe(writerViewHash(view));
    expect(() => evidencePackageHash({})).toThrow(/manifest/);
    expect(() => showrunnerBriefHash({})).toThrow(/brief_missing_key/);
    expect(() =>
      renderManifestHash({
        ...payloadOf(onlyArtifact("render_manifest")),
        render_blocks: [{}],
      }),
    ).toThrow(/missing required field/);
  });

  it("selects fields only: storage envelope changes do not move any hash", () => {
    const base = script();
    const hash = candidateScriptHash(base);
    expect(
      candidateScriptHash({
        ...base,
        artifact_id: "x",
        created_at: "y",
        script_version_id: "z",
        writer_model_run_id: "w",
        revision_reason: "r",
        script_phase: "p",
        script_hash: "q",
      }),
    ).toBe(hash);
    const turns = rows<Record<string, unknown>>(base.turns).map((t) => ({
      ...t,
      turn_id: `${String(t.turn_id)}-fresh`,
    }));
    const claimUses = rows<Record<string, unknown>>(base.turn_claim_uses).map(
      (u) => ({ ...u, turn_id: `${String(u.turn_id)}-fresh` }),
    );
    const evidenceUses = rows<Record<string, unknown>>(
      base.turn_evidence_uses,
    ).map((u) => ({ ...u, turn_id: `${String(u.turn_id)}-fresh` }));
    const predictions = rows<Record<string, unknown>>(
      base.prediction_candidates,
    ).map((p) => ({ ...p, turn_id: `${String(p.turn_id)}-fresh` }));
    expect(
      candidateScriptHash({
        ...base,
        turns,
        turn_claim_uses: claimUses,
        turn_evidence_uses: evidenceUses,
        prediction_candidates: predictions,
      }),
    ).toBe(hash);
    const [first, ...others] = rows<Record<string, unknown>>(base.turns);
    expect(
      candidateScriptHash({
        ...base,
        turns: [
          { ...first, spoken_text: `${String(first?.spoken_text)} x` },
          ...others,
        ],
      }),
    ).not.toBe(hash);
  });

  it("rejects duplicate uses, foreign turns and duplicate anchors in a script", () => {
    const base = script();
    const uses = rows<Record<string, unknown>>(base.turn_claim_uses);
    expect(() =>
      candidateScriptHash({ ...base, turn_claim_uses: [...uses, uses[0]] }),
    ).toThrow(/Duplicate identical claim use/);
    expect(() =>
      candidateScriptHash({
        ...base,
        turn_claim_uses: [{ ...uses[0], turn_id: "foreign" }],
      }),
    ).toThrow(/outside this script/);
    const turns = rows<Record<string, unknown>>(base.turns);
    expect(() =>
      candidateScriptHash({
        ...base,
        turns: [...turns, { ...turns[0], turn_id: "dup" }],
      }),
    ).toThrow(/Duplicate turn anchor/);
    expect(() =>
      candidateScriptHash({
        ...base,
        turns: [...turns, { ...turns[0], semantic_turn_id: "t99" }],
      }),
    ).toThrow(/script_turn_id_not_unique/);
    const state = (id: string): string =>
      `${"0".repeat(63)}${id.length > 0 ? "1" : "2"}`;
    expect(
      scriptProjection(base, { ...BRIEF_OPTIONS, claimStateHashFor: state })
        .turn_claim_uses,
    ).not.toEqual(scriptProjection(base, BRIEF_OPTIONS).turn_claim_uses);
  });

  it("a script with prediction candidates is projected against its bound Brief; there is no caller-selectable rule", () => {
    const base = script();
    expect(() => scriptHash(base)).toThrow(/options\.brief/);
    expect(() =>
      scriptHash({ ...base, prediction_candidates: [] }),
    ).not.toThrow();
    expect(candidateScriptHash(base)).toBe(
      onlyArtifact("script_pass1").content_hash,
    );
  });

  it("emits semantic anchors, preserves authored order and is stable under a consistent storage turn UUID relabel", () => {
    const base = script();
    const candidates = rows<Record<string, unknown>>(
      base.prediction_candidates,
    );
    const emitted = scriptProjection(base, BRIEF_OPTIONS)
      .prediction_candidates as Record<string, unknown>[];
    expect(emitted.map((e) => e.prediction_candidate_id)).toEqual(
      candidates.map((c) => c.prediction_candidate_id),
    );
    expect(emitted.every((e) => !Object.hasOwn(e, "turn_id"))).toBe(true);
    expect(emitted.every((e) => typeof e.semantic_turn_id === "string")).toBe(
      true,
    );
    const reversed = candidateScriptHash({
      ...base,
      prediction_candidates: [...candidates].reverse(),
    });
    expect(reversed).not.toBe(onlyArtifact("script_pass1").content_hash);
    const relabel = (id: unknown): string => `fresh-${String(id)}`;
    const fresh = {
      ...base,
      turns: rows<Record<string, unknown>>(base.turns).map((t) => ({
        ...t,
        turn_id: relabel(t.turn_id),
      })),
      turn_claim_uses: rows<Record<string, unknown>>(base.turn_claim_uses).map(
        (u) => ({ ...u, turn_id: relabel(u.turn_id) }),
      ),
      turn_evidence_uses: rows<Record<string, unknown>>(
        base.turn_evidence_uses,
      ).map((u) => ({ ...u, turn_id: relabel(u.turn_id) })),
      prediction_candidates: candidates.map((p) => ({
        ...p,
        turn_id: relabel(p.turn_id),
      })),
    };
    expect(candidateScriptHash(fresh)).toBe(
      onlyArtifact("script_pass1").content_hash,
    );
    expect(governedDomainHash("script-v2", {})).toHaveLength(64);
  });

  it("rejects unknown craft-finding fields and unresolved anchors", () => {
    const review = structuredClone(
      payloadOf(onlyArtifact("writing_craft_review")),
    );
    const anchors = turnAnchorMap(
      payloadOf(onlyArtifact("script_pass1")).turns,
    );
    const findings = rows<Record<string, unknown>>(review.findings);
    expect(() =>
      writingCraftReviewProjection(
        { ...review, findings: [{ ...findings[0], extra_row_field: 1 }] },
        anchors,
      ),
    ).toThrow(/Unknown craft finding fields/);
    expect(() => writingCraftReviewProjection(review, new Map())).toThrow(
      /outside this script/,
    );
    const noId = Object.fromEntries(
      Object.entries(findings[0] ?? {}).filter(
        ([field]) => field !== "finding_id",
      ),
    );
    expect(
      writingCraftReviewProjection(
        { ...review, findings: [{ ...noId }] },
        anchors,
      ),
    ).toEqual(
      writingCraftReviewProjection(
        { ...review, findings: [{ ...noId, finding_id: "zz" }] },
        anchors,
      ),
    );
  });

  it("rejects unresolved or foreign direction anchors", () => {
    const direction = currentDirection().canonical_payload as Record<
      string,
      unknown
    >;
    expect(() => performanceDirectionHash(direction, new Map())).toThrow(
      /outside this script/,
    );
    expect(() =>
      performanceDirectionHash(
        { ...direction, performance_intents: [{ scope_type: "turn" }] },
        new Map(),
      ),
    ).toThrow(/missing required field/);
  });
});

describe("master assembly map applies the exact nested selections of Hashing 4.5 (repair regression)", () => {
  const map = (): Record<string, unknown> =>
    structuredClone(payloadOf(onlyArtifact("master_assembly_map")));
  const base = (): string => masterAssemblyMapHash(map());
  const segments = (m: Record<string, unknown>): Record<string, unknown>[] =>
    m.segments as Record<string, unknown>[];
  const offsets = (m: Record<string, unknown>): Record<string, unknown>[] =>
    m.program_block_offsets as Record<string, unknown>[];

  it("still reproduces the shipped map hash", () => {
    expect(base()).toBe(onlyArtifact("master_assembly_map").content_hash);
  });

  it("leaves the hash stable when redundant display fields are added at any nesting level", () => {
    const hash = base();
    const m = map();
    must(segments(m)[0], "segment").start_ms = 12345;
    must(segments(m)[0], "segment").end_ms = 99999;
    must(segments(m)[2], "static segment").duration_decimal = "0.105";
    must(offsets(m)[0], "offset").start_ms = 1;
    must(offsets(m)[3], "offset").end_seconds = "1.250";
    m.master_duration_ms = 123456;
    m.created_at = "2026-10-01T00:00:00Z";
    m.master_assembly_map_hash = "f".repeat(64);
    expect(masterAssemblyMapHash(m)).toBe(hash);
  });

  it("changes the hash for every governed segment field", () => {
    const hash = base();
    const governed: [string, unknown][] = [
      ["kind", "static"],
      ["audio_artifact_id", "88888888-8888-4888-8888-0000000000ff"],
      ["artifact_id", "66666666-6666-4666-8666-0000000000ff"],
      ["audio_sha256", "0".repeat(64)],
      ["render_block_id", "00000000-0000-4000-8000-000000000001"],
      ["render_take_id", "00000000-0000-4000-8000-000000000002"],
      ["take_selection_id", "00000000-0000-4000-8000-000000000003"],
      ["program_block_id", "00000000-0000-4000-8000-000000000004"],
      ["start_frame", 1],
      ["end_frame", 1],
      ["join_metadata", { gap_frames: 1, method: "pcm-copy-concat" }],
    ];
    for (const [key, value] of governed) {
      const m = map();
      must(segments(m)[0], "segment")[key] = value;
      expect(masterAssemblyMapHash(m), key).not.toBe(hash);
    }
    // A governed segment field may not be removed.
    const m = map();
    const first = must(segments(m)[0], "segment");
    Reflect.deleteProperty(first, "end_frame");
    expect(() => masterAssemblyMapHash(m)).toThrow(
      /missing required field: end_frame/,
    );
  });

  it("changes the hash for every governed program-block offset field and the segment order", () => {
    const hash = base();
    for (const [key, value] of [
      ["program_block_id", "00000000-0000-4000-8000-000000000009"],
      ["start_frame", 7],
      ["end_frame", 7],
    ] as [string, unknown][]) {
      const m = map();
      must(offsets(m)[0], "offset")[key] = value;
      expect(masterAssemblyMapHash(m), key).not.toBe(hash);
    }
    const reordered = map();
    reordered.segments = [...segments(reordered)].reverse();
    expect(masterAssemblyMapHash(reordered)).not.toBe(hash);
  });
});
