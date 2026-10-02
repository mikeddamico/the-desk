import { describe, expect, it } from "vitest";

import {
  assemblyRecipeHash,
  evidencePackageHash,
  masterAssemblyMapHash,
  performanceDirectionHash,
  renderManifestHash,
  scriptHash,
  semanticAuditResultHash,
  serializedWriterInputHash,
  showrunnerBriefHash,
  turnAnchorMap,
  writerContextManifestHash,
  writerViewHash,
  writingCraftReviewHash,
} from "../src/identity/artifacts.js";
import { evidenceBodyHash, rawBytesHash } from "../src/identity/domains.js";
import { fingerprint } from "../src/identity/fingerprints.js";
import {
  claimContentHash,
  claimFrozenStateHash,
  derivationOutputHash,
  fixtureSupportObjectHash,
  supportHashFor,
} from "../src/identity/knowledge.js";
import {
  performanceDirectionCorrectionInputFingerprint,
  renderContextHash,
} from "../src/identity/layer-b.js";
import {
  assertCompletePromptManifestPayload,
  modelSemanticInputHash,
  promptManifestArtifactHash,
} from "../src/identity/prompt-manifest.js";
import { requestBaseHash } from "../src/identity/request.js";

import { verifyAddendumBindings } from "../src/identity/addendum-binding.js";
import { showConfigVersionHash } from "../src/identity/show-config.js";

import {
  fixtureBytes,
  fixtureJson,
  foundationTables,
  must,
  type Row,
} from "./support/fixture-v046.js";

// Independent dependency-chain proof. Every upstream CONTENT HASH is recomputed from its source objects and substituted
// into the downstream projection; the shipped expected hashes are used ONLY as assertion targets. Inputs that are not
// hashes (UUID identifiers, policy/gate version strings, literal fixture fields) come from the fixture objects.
// Documented incompleteness: see the two labelled limits in the final describe block.

type Obj = Record<string, unknown>;
const tables = foundationTables();
const artifactRows = tables.artifacts ?? [];
const byType = (type: string): Row =>
  must(
    artifactRows.find((a) => a.artifact_type === type),
    type,
  );
const payload = (row: Row): Obj =>
  structuredClone(row.canonical_payload as Obj);
const rows = <T>(value: unknown): T[] => value as T[];

interface ChainOptions {
  // Upstream controls used by the propagation/classification tests; there are no rule selectors.
  evidenceBodySuffix?: string; // change one evidence body
  audioMutation?: boolean; // flip one audio byte
  predictionTextSuffix?: string; // change one authored prediction text
  configNameSuffix?: string; // change the show-config `name` of the bound configuration
  addendumBytes?: Uint8Array; // different addendum source bytes (policy map and bindings updated consistently)
}

function deriveChain(options: ChainOptions = {}): Obj {
  const out: Obj = {};
  // --- knowledge layer
  const evidence = new Map<string, string>();
  const bodies = new Map<string, string>();
  (tables.evidence_units ?? []).forEach((unit, index) => {
    let body = unit.canonical_content as string;
    if (options.evidenceBodySuffix && index === 0)
      body += options.evidenceBodySuffix;
    bodies.set(unit.evidence_unit_id as string, body);
    evidence.set(unit.evidence_unit_id as string, evidenceBodyHash(body));
  });
  const derivation = derivationOutputHash(
    must(tables.derivation_runs?.[0], "derivation").output,
  );
  const carriers = new Map<string, string>();
  for (const type of ["tenor_support", "continuity_support"]) {
    const row = byType(type);
    const carrier = payload(row) as { projection: { observations?: Obj[] } };
    for (const observation of carrier.projection.observations ?? [])
      observation.content_hash = must(
        evidence.get(observation.evidence_unit_id as string),
        "observation evidence",
      );
    carriers.set(row.artifact_id as string, fixtureSupportObjectHash(carrier));
  }
  const supports = new Map<string, string>();
  for (const support of tables.claim_supports ?? []) {
    const kind = support.support_kind as string;
    supports.set(
      support.claim_support_id as string,
      kind === "evidence"
        ? supportHashFor(kind, {
            evidenceBody: bodies.get(support.evidence_unit_id as string),
          })
        : kind === "derivation"
          ? derivation
          : must(
              carriers.get(
                (support.external_support_identity as string).split(
                  ":",
                  2,
                )[1] ?? "",
              ),
              "carrier",
            ),
    );
  }
  const claimContent = new Map<string, string>();
  const claimState = new Map<string, string>();
  for (const claim of tables.claims ?? []) {
    const content = claimContentHash(claim);
    claimContent.set(claim.claim_id as string, content);
    claimState.set(
      claim.claim_id as string,
      claimFrozenStateHash({
        claim_content_hash: content,
        state: claim.initial_status,
        effective_usage_class: claim.initial_usage_class,
      }),
    );
  }
  out.evidence = Object.fromEntries(evidence);
  out.claimState = Object.fromEntries(claimState);

  // --- package -> brief -> writer view/context
  const pkgPayload = payload(byType("evidence_package")) as { manifest: Obj };
  const manifest = pkgPayload.manifest as {
    evidence: Obj[];
    claims: (Obj & { support_refs: Obj[] })[];
  };
  for (const e of manifest.evidence)
    e.content_hash = must(
      evidence.get(e.evidence_unit_id as string),
      "evidence",
    );
  for (const c of manifest.claims) {
    c.claim_content_hash = must(
      claimContent.get(c.claim_id as string),
      "claim",
    );
    c.frozen_state_hash = must(claimState.get(c.claim_id as string), "state");
    for (const ref of c.support_refs)
      ref.support_hash = must(
        supports.get(ref.claim_support_id as string),
        "support",
      );
  }
  const packageHash = evidencePackageHash(pkgPayload);
  const brief = payload(byType("showrunner_brief"));
  brief.package_hash = packageHash;
  const briefHash = showrunnerBriefHash(brief);
  const view = payload(byType("writer_view"));
  view.brief_hash = briefHash;
  view.package_hash = packageHash;
  for (const c of rows<Obj>(view.selected_claims)) {
    c.claim_content_hash = claimContent.get(c.claim_id as string);
    c.frozen_state_hash = claimState.get(c.claim_id as string);
  }
  for (const e of rows<Obj>(view.selected_evidence))
    e.content_hash = evidence.get(e.evidence_unit_id as string);
  const writerView = writerViewHash(view);
  const serialized = serializedWriterInputHash(view);
  const context = payload(byType("writer_context_manifest"));
  context.serialized_input_hash = serialized;
  const writerContext = writerContextManifestHash(context);

  // --- scripts -> review -> direction
  const scriptRows = [
    "script_pass1",
    "script_craft_revision",
    "script_pass2",
  ].map((t) => payload(byType(t)));
  const scripts: string[] = [];
  scriptRows.forEach((script, index) => {
    if (options.predictionTextSuffix) {
      const first = rows<Obj>(script.prediction_candidates)[0];
      if (first)
        first.prediction_text = `${String(first.prediction_text)}${options.predictionTextSuffix}`;
    }
    script.brief_hash = briefHash;
    script.package_hash = packageHash;
    if (index > 0) script.revision_parent_content_identity = scripts[index - 1];
    scripts.push(
      scriptHash(script, {
        brief,
        claimStateHashFor: (id) => must(claimState.get(id), "claim state"),
      }),
    );
  });
  const [pass1, , pass2] = scripts as [string, string, string];
  const review = payload(byType("writing_craft_review"));
  review.subject_script_hash = pass1;
  const reviewHash = writingCraftReviewHash(
    review,
    turnAnchorMap(scriptRows[0]?.turns),
  );
  const directionRow = must(
    artifactRows.find(
      (a) =>
        a.artifact_type === "performance_direction" &&
        !(a.artifact_id as string).endsWith("012"),
    ),
    "direction",
  );
  const direction = payload(directionRow);
  direction.script_hash = pass2;
  const directionHash = performanceDirectionHash(
    direction,
    turnAnchorMap(scriptRows[2]?.turns),
  );

  // --- correction input fingerprint (historical source hash is a pinned identity, reproduced in its own test)
  const frozen = JSON.parse(
    fixtureBytes("provenance/frozen/correction_input_projection.json").toString(
      "utf8",
    ),
  ) as Obj & { correction: Obj };
  const t14 = rows<Obj>(scriptRows[2]?.turns).find(
    (t) => t.semantic_turn_id === "t14",
  );
  const correction = performanceDirectionCorrectionInputFingerprint({
    source_direction_hash: frozen.source_direction_hash,
    script_hash: pass2,
    direction_spec_version: frozen.direction_spec_version,
    adjudication_record_sha256: rawBytesHash(
      fixtureBytes("provenance/frozen/technical_resolution_record_v2.md"),
    ),
    correction: { ...frozen.correction, source_scope_ref: t14?.turn_id },
  });

  // --- stage 1-3 fingerprints
  const gates = fixtureJson("gate_fingerprint_inputs.json") as Record<
    string,
    { input_projection: Obj; fingerprint: string }
  >;
  const literal = (stage: string, key: string): unknown =>
    must(gates[stage], stage).input_projection[key];
  const claimsWriting = fingerprint("claims_writing", {
    package_hash: packageHash,
    brief_hash: briefHash,
    script_hash: pass2,
    claims_policy_version: literal("claims_writing", "claims_policy_version"),
    writing_policy_version: literal("claims_writing", "writing_policy_version"),
    gate_set_version: literal("claims_writing", "gate_set_version"),
  });
  const performance = fingerprint("performance", {
    script_hash: pass2,
    performance_direction_hash: directionHash,
    performance_policy_version: literal(
      "performance",
      "performance_policy_version",
    ),
    gate_set_version: literal("performance", "gate_set_version"),
  });
  const auditProjection = {
    package_hash: packageHash,
    brief_hash: briefHash,
    script_hash: pass2,
    performance_direction_hash: directionHash,
    claims_policy_version: literal("semantic_audit", "claims_policy_version"),
    writing_policy_version: literal("semantic_audit", "writing_policy_version"),
    performance_policy_version: literal(
      "semantic_audit",
      "performance_policy_version",
    ),
    auditor_contract_version: literal(
      "semantic_audit",
      "auditor_contract_version",
    ),
  };
  const semanticAudit = fingerprint("semantic_audit", auditProjection);
  const audit = payload(byType("semantic_audit_result"));
  audit.input_projection = auditProjection;
  audit.input_fingerprint = semanticAudit;
  const auditResult = semanticAuditResultHash(audit);

  // --- render: contexts, base request hashes, manifest
  const blocks = (
    fixtureJson("base_request_hash_conformance.json") as {
      actual_blocks: {
        render_block_sequence: number;
        input_record: Obj & { context: Obj };
      }[];
    }
  ).actual_blocks;
  const manifestPayload = payload(byType("render_manifest")) as {
    render_blocks: (Obj & { resolved_context_refs: Obj })[];
  } & Obj;
  const baseHashes: string[] = [];
  const contexts: string[] = [];
  for (const block of manifestPayload.render_blocks) {
    const record = must(
      blocks.find((b) => b.render_block_sequence === block.sequence),
      "block record",
    ).input_record;
    block.base_request_hash = requestBaseHash(record);
    block.resolved_context_refs.context_hash = renderContextHash(
      record.context,
    );
    baseHashes.push(block.base_request_hash as string);
    contexts.push(block.resolved_context_refs.context_hash as string);
  }
  manifestPayload.script_hash = pass2;
  manifestPayload.performance_direction_hash = directionHash;
  manifestPayload.audit_gate_fingerprint = semanticAudit;
  const renderManifest = renderManifestHash(manifestPayload);
  const render = fingerprint("render", {
    render_manifest_hash: renderManifest,
    audit_input_fingerprint: semanticAudit,
    render_policy_version: literal("render", "render_policy_version"),
    gate_set_version: literal("render", "gate_set_version"),
  });

  // --- assembly: audio bytes -> recipe -> map -> stage
  const audio = new Map<string, string>();
  const audioRows = artifactRows.filter((a) =>
    (a.artifact_type as string).startsWith("audio/"),
  );
  let flipped = false;
  for (const row of audioRows) {
    let bytes = Buffer.from(fixtureBytes(row.storage_uri as string));
    if (
      options.audioMutation &&
      !flipped &&
      row.artifact_type === "audio/render_take"
    ) {
      bytes = Buffer.from(bytes);
      bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1;
      flipped = true;
    }
    audio.set(row.artifact_id as string, rawBytesHash(bytes));
  }
  const map = payload(byType("master_assembly_map")) as {
    segments: Obj[];
  } & Obj;
  const ordered = map.segments.map((s) =>
    must(audio.get(s.artifact_id as string), "segment audio"),
  );
  const recipe = payload(byType("assembly_recipe"));
  recipe.ordered_audio_artifact_hashes = ordered;
  recipe.static_asset_hashes = audioRows
    .filter((a) => a.artifact_type === "audio/static_asset")
    .map((a) => must(audio.get(a.artifact_id as string), "static"));
  const recipeHash = assemblyRecipeHash(recipe);
  map.segments.forEach((s) => {
    s.audio_sha256 = audio.get(s.artifact_id as string);
  });
  map.assembly_recipe_hash = recipeHash;
  map.selected_audio_hashes = ordered;
  const master = must(
    audio.get(map.master_artifact_id as string),
    "master audio",
  );
  map.master_audio_hash = master;
  const mapHash = masterAssemblyMapHash(map);
  const takes = new Map(
    (tables.render_takes ?? []).map((t) => [t.render_take_id as string, t]),
  );
  const order = new Map(
    (tables.render_blocks ?? []).map((b) => [
      b.render_block_id as string,
      b.sequence as number,
    ]),
  );
  const lineage = (tables.take_selections ?? [])
    .filter((s) => s.decision === "approved")
    .sort(
      (a, b) =>
        must(order.get(a.render_block_id as string), "order") -
        must(order.get(b.render_block_id as string), "order"),
    )
    .map((s) => {
      const take = must(takes.get(s.render_take_id as string), "take");
      return {
        render_block_id: s.render_block_id,
        take_selection_id: s.take_selection_id,
        render_take_id: s.render_take_id,
        take_index: take.take_index,
        audio_sha256: must(
          audio.get(take.audio_artifact_id as string),
          "take audio",
        ),
      };
    });
  const assembly = fingerprint("assembly", {
    selected_take_lineage: lineage,
    assembly_recipe_hash: recipeHash,
    master_assembly_map_hash: mapHash,
    assembly_policy_version: literal("assembly", "assembly_policy_version"),
    gate_set_version: literal("assembly", "gate_set_version"),
  });

  // --- READY candidate (show-config selection rule is INFERRED: see the limits block)
  const attempt = must(
    (tables.program_run_attempts ?? []).find(
      (a) => a.attempt_id === literal("ready_candidate", "attempt_id"),
    ),
    "attempt",
  );
  const config = must(
    (tables.show_config_versions ?? []).find(
      (c) => c.show_config_version_id === attempt.show_config_version_id,
    ),
    "config",
  );
  const boundConfig = structuredClone(config);
  if (options.configNameSuffix) {
    const configPayload = boundConfig.canonical_payload as Obj;
    configPayload.name = `${String(configPayload.name)}${options.configNameSuffix}`;
  }
  const showConfig = showConfigVersionHash(boundConfig);
  const ready = fingerprint("ready_candidate", {
    master_artifact_id: map.master_artifact_id,
    master_audio_sha256: master,
    assembly_gate_fingerprint: assembly,
    program_run_id: attempt.program_run_id,
    attempt_id: attempt.attempt_id,
    show_config_version_hash: showConfig,
    review_gate_version: literal("ready_candidate", "review_gate_version"),
    gate_set_version: literal("ready_candidate", "gate_set_version"),
  });

  // --- model manifests: recomputed upstream refs, shipped request specimens (limit 2), addendum binding verified
  const policyMap = fixtureJson("config/policy_versions.json") as {
    policies: Record<string, Obj>;
  };
  const addendumEntry = must(
    policyMap.policies.writing_fixture_profile_addendum,
    "addendum policy entry",
  );
  const shippedAddendum = fixtureBytes(String(addendumEntry.shipped_at));
  const addendumBytes = options.addendumBytes ?? shippedAddendum;
  const addendumSha = rawBytesHash(addendumBytes);
  const boundMap = structuredClone(policyMap);
  must(
    boundMap.policies.writing_fixture_profile_addendum,
    "entry",
  ).source_sha256 = addendumSha;
  const upstream = new Map<string, string>([
    [byType("evidence_package").artifact_id as string, packageHash],
    [byType("showrunner_brief").artifact_id as string, briefHash],
    [byType("writer_view").artifact_id as string, writerView],
    [byType("writer_context_manifest").artifact_id as string, writerContext],
    [byType("script_pass1").artifact_id as string, must(scripts[0])],
    [byType("script_craft_revision").artifact_id as string, must(scripts[1])],
    [byType("script_pass2").artifact_id as string, must(scripts[2])],
    [byType("writing_craft_review").artifact_id as string, reviewHash],
  ]);
  const specimenList = (
    fixtureJson("fixture_model_requests.json") as {
      requests: { prompt_manifest_id: string; rendered_request: string }[];
    }
  ).requests;
  const manifestInputs: { role: string; row: Row; payload: Obj }[] = [];
  const semanticByRole: Record<string, string> = {};
  for (const row of tables.prompt_manifests ?? []) {
    const artifact = must(
      artifactRows.find((a) => a.artifact_id === row.artifact_id),
      "manifest artifact",
    );
    const manifest = payload(artifact);
    for (const input of rows<Obj>(manifest.ordered_input_artifacts))
      input.content_hash = must(
        upstream.get(input.artifact_id as string),
        "upstream artifact",
      );
    const specimen = must(
      specimenList.find((x) => x.prompt_manifest_id === row.prompt_manifest_id),
      "specimen",
    );
    manifest.rendered_request_hash = rawBytesHash(
      Buffer.from(specimen.rendered_request, "utf8"),
    );
    const typed = structuredClone(row);
    typed.rendered_request_hash = manifest.rendered_request_hash;
    const role = String(manifest.purpose);
    if (options.addendumBytes && role !== "showrunner_planner") {
      for (const part of [manifest, typed])
        (part.policy_source_hashes as Obj).writing_fixture_profile_addendum =
          addendumSha;
    }
    manifestInputs.push({ role, row: typed, payload: manifest });
    semanticByRole[role] = modelSemanticInputHash(manifest);
  }
  const manifestHashes = verifyAddendumBindings(
    manifestInputs,
    boundMap,
    addendumBytes,
  );

  Object.assign(out, {
    manifestHashes,
    semanticByRole,
    packageHash,
    briefHash,
    writerView,
    serialized,
    writerContext,
    scripts,
    reviewHash,
    directionHash,
    correction,
    auditResult,
    baseHashes,
    contexts,
    renderManifest,
    audio: Object.fromEntries(audio),
    recipeHash,
    mapHash,
    master,
    showConfig,
    stages: {
      claims_writing: claimsWriting,
      performance,
      semantic_audit: semanticAudit,
      render,
      assembly,
      ready_candidate: ready,
    },
    evidenceMap: evidence,
    claimContent,
    supports,
  });
  return out;
}

describe("dependency chain: upstream content hashes recomputed (single active rules of Hashing v0.1.5)", () => {
  const chain = deriveChain();
  const gates = fixtureJson("gate_fingerprint_inputs.json") as Record<
    string,
    { fingerprint: string }
  >;
  const stored = (type: string): unknown => byType(type).content_hash;

  it("recomputes every artifact content hash from source objects and matches the shipped hashes", () => {
    expect(chain.packageHash).toBe(stored("evidence_package"));
    expect(chain.briefHash).toBe(stored("showrunner_brief"));
    expect(chain.writerView).toBe(stored("writer_view"));
    expect(chain.writerContext).toBe(stored("writer_context_manifest"));
    expect(chain.serialized).toBe(
      (byType("writer_context_manifest").canonical_payload as Obj)
        .serialized_input_hash,
    );
    expect(chain.scripts).toEqual(
      ["script_pass1", "script_craft_revision", "script_pass2"].map(stored),
    );
    expect(chain.reviewHash).toBe(stored("writing_craft_review"));
    expect(chain.auditResult).toBe(stored("semantic_audit_result"));
    expect(chain.renderManifest).toBe(stored("render_manifest"));
    expect(chain.recipeHash).toBe(stored("assembly_recipe"));
    expect(chain.mapHash).toBe(stored("master_assembly_map"));
    const direction = artifactRows.find(
      (a) =>
        a.artifact_type === "performance_direction" &&
        !(a.artifact_id as string).endsWith("012"),
    );
    expect(chain.directionHash).toBe(direction?.content_hash);
    expect(chain.correction).toBe(
      (direction?.canonical_payload as Obj).input_fingerprint,
    );
    expect(chain.master).toBe(byType("audio/clean_master").content_hash);
  });

  it("regenerated identities: writer view, context manifest, serialized input and the five manifests (addendum bound) equal the v0.4.6 rows", () => {
    const hashes = chain.manifestHashes as Record<string, string>;
    const semantic = chain.semanticByRole as Record<string, string>;
    const roles = [
      "showrunner_planner",
      "writer",
      "craft_critic",
      "writer_revision",
      "speech_texture",
    ];
    expect(Object.keys(hashes).sort()).toEqual([...roles].sort());
    for (const row of tables.prompt_manifests ?? []) {
      const artifact = must(
        artifactRows.find((a) => a.artifact_id === row.artifact_id),
      );
      const role = String((artifact.canonical_payload as Obj).purpose);
      expect(hashes[role], role).toBe(artifact.content_hash);
      expect(semantic[role], role).toBe(
        (tables.model_runs ?? []).find(
          (r) => r.prompt_manifest_id === row.prompt_manifest_id,
        )?.semantic_input_hash,
      );
      const bound = Object.hasOwn(
        row.component_versions as Obj,
        "writing_fixture_profile_addendum",
      );
      expect(bound, role).toBe(role !== "showrunner_planner");
    }
    // The writer data object is the narrowed v0.4.6 shape and its serialized hash is the raw hash of those bytes.
    const view = byType("writer_view").canonical_payload as Obj;
    expect(
      rows<Obj>(view.selected_evidence).every(
        (e) =>
          !Object.hasOwn(e, "retention_class") &&
          Object.keys(e.consumer_exposure as Obj).join() === "writer",
      ),
    ).toBe(true);
    expect(
      (byType("writer_context_manifest").canonical_payload as Obj)
        .required_policy_refs,
    ).toEqual([
      "writing-0.2.3",
      "writing-fixture-profile-addendum-0.1",
      "writing-craft-0.1",
      "claims-0.1.2",
    ]);
    // provider_calls embed the rendered request hash (fingerprint and logical key).
    for (const call of tables.provider_calls ?? []) {
      const run = (tables.model_runs ?? []).find(
        (r) => r.provider_call_id === call.provider_call_id,
      );
      if (run === undefined) continue; // TTS calls are keyed by base-request hash, not by a prompt manifest
      const manifestRow = (tables.prompt_manifests ?? []).find(
        (m) => m.prompt_manifest_id === run.prompt_manifest_id,
      );
      expect(call.request_fingerprint).toBe(manifestRow?.rendered_request_hash);
      expect(call.logical_request_key).toBe(
        `fixture_stub:${String(call.operation)}:${String(manifestRow?.rendered_request_hash)}`,
      );
    }
  });

  it("recomputes the nine base-request hashes and nine render-context digests from the block records", () => {
    const projections = (
      fixtureJson("render_request_projections.json") as {
        projections: { base_request_hash: string }[];
      }
    ).projections;
    expect(chain.baseHashes).toEqual(
      projections.map((p) => p.base_request_hash),
    );
    const contexts = (
      fixtureJson("provenance/captured/render_context_projections.json") as {
        contexts: { context_hash: string }[];
      }
    ).contexts;
    expect(chain.contexts).toEqual(contexts.map((c) => c.context_hash));
  });

  it("derives the six stage fingerprints from recomputed hashes and matches the shipped vectors", () => {
    const stages = chain.stages as Record<string, string>;
    for (const stage of [
      "claims_writing",
      "performance",
      "semantic_audit",
      "render",
      "assembly",
      "ready_candidate",
    ])
      expect(stages[stage], stage).toBe(gates[stage]?.fingerprint);
    expect(stages.semantic_audit).toBe(
      (byType("semantic_audit_result").canonical_payload as Obj)
        .input_fingerprint,
    );
    expect(chain.showConfig).toBe(
      must(
        (tables.show_config_versions ?? []).find(
          (c) => c.config_hash === chain.showConfig,
        ),
        "config hash source",
      ).config_hash,
    );
  });

  it("reproduces the five prompt manifests with recomputed upstream refs and request specimens that embed them", () => {
    const hashes = new Map<string, string>([
      [
        byType("evidence_package").artifact_id as string,
        chain.packageHash as string,
      ],
      [
        byType("showrunner_brief").artifact_id as string,
        chain.briefHash as string,
      ],
      [byType("writer_view").artifact_id as string, chain.writerView as string],
      [
        byType("writer_context_manifest").artifact_id as string,
        chain.writerContext as string,
      ],
      [
        byType("script_pass1").artifact_id as string,
        must((chain.scripts as string[])[0], "pass1"),
      ],
      [
        byType("script_craft_revision").artifact_id as string,
        must((chain.scripts as string[])[1], "craft"),
      ],
      [
        byType("script_pass2").artifact_id as string,
        must((chain.scripts as string[])[2], "pass2"),
      ],
      [
        byType("writing_craft_review").artifact_id as string,
        chain.reviewHash as string,
      ],
    ]);
    const specimens = (
      fixtureJson("fixture_model_requests.json") as {
        requests: { prompt_manifest_id: string; rendered_request: string }[];
      }
    ).requests;
    const artifacts = new Map(
      artifactRows.map((a) => [a.artifact_id as string, a]),
    );
    let checked = 0;
    for (const row of tables.prompt_manifests ?? []) {
      const artifact = must(
        artifacts.get(row.artifact_id as string),
        "manifest artifact",
      );
      const manifest = payload(artifact);
      assertCompletePromptManifestPayload(manifest);
      const specimen = must(
        specimens.find((s) => s.prompt_manifest_id === row.prompt_manifest_id),
        "specimen",
      );
      for (const input of rows<Obj>(manifest.ordered_input_artifacts)) {
        const computed = must(
          hashes.get(input.artifact_id as string),
          "upstream artifact",
        );
        input.content_hash = computed;
        expect(
          specimen.rendered_request,
          "specimen embeds the recomputed upstream hash",
        ).toContain(computed);
      }
      for (const e of rows<Obj>(manifest.ordered_input_evidence))
        e.content_hash = (chain.evidenceMap as Map<string, string>).get(
          e.evidence_unit_id as string,
        );
      for (const c of rows<Obj>(manifest.ordered_input_claims)) {
        c.claim_content_hash = (chain.claimContent as Map<string, string>).get(
          c.claim_id as string,
        );
        c.frozen_state_hash = must(
          (chain.claimState as Record<string, string>)[c.claim_id as string],
          "recomputed frozen state",
        );
        c.package_hash = chain.packageHash;
      }
      manifest.rendered_request_hash = rawBytesHash(
        Buffer.from(specimen.rendered_request, "utf8"),
      );
      expect(promptManifestArtifactHash(manifest)).toBe(artifact.content_hash);
      expect(modelSemanticInputHash(manifest)).toBe(
        (tables.model_runs ?? []).find(
          (r) => r.prompt_manifest_id === row.prompt_manifest_id,
        )?.semantic_input_hash,
      );
      checked += 1;
    }
    expect(checked).toBe(5);
  });

  it("proves propagation: an upstream evidence change moves every dependent hash, an audio change moves only assembly onward", () => {
    const evidenceChanged = deriveChain({ evidenceBodySuffix: " changed" });
    for (const key of [
      "packageHash",
      "briefHash",
      "writerView",
      "writerContext",
      "reviewHash",
      "directionHash",
      "auditResult",
      "renderManifest",
    ])
      expect(evidenceChanged[key], key).not.toBe(chain[key]);
    expect(evidenceChanged.scripts).not.toEqual(chain.scripts);
    const stages = evidenceChanged.stages as Record<string, string>;
    const base = chain.stages as Record<string, string>;
    for (const stage of [
      "claims_writing",
      "performance",
      "semantic_audit",
      "render",
    ])
      expect(stages[stage], stage).not.toBe(base[stage]);
    expect(stages.assembly).toBe(base.assembly);
    expect(stages.ready_candidate).toBe(base.ready_candidate);

    const audioChanged = deriveChain({ audioMutation: true });
    const changed = audioChanged.stages as Record<string, string>;
    for (const stage of [
      "claims_writing",
      "performance",
      "semantic_audit",
      "render",
    ])
      expect(changed[stage], stage).toBe(base[stage]);
    for (const stage of ["assembly", "ready_candidate"])
      expect(changed[stage], stage).not.toBe(base[stage]);
    expect(audioChanged.recipeHash).not.toBe(chain.recipeHash);
    expect(audioChanged.mapHash).not.toBe(chain.mapHash);
  });
});

describe("documented incompleteness of the chain proof (not claimed as independently derived)", () => {
  it("show configurations: both rows reproduce their stored hash under the closed show-config/1 profile; version 2 differs only in the runtime band", () => {
    const rowsOfConfig = tables.show_config_versions ?? [];
    expect(rowsOfConfig).toHaveLength(2);
    for (const row of rowsOfConfig)
      expect(showConfigVersionHash(row)).toBe(row.config_hash);
    const [first, second] = rowsOfConfig as [Row, Row];
    const changed = Object.entries(first.canonical_payload as Obj).filter(
      ([k, v]) =>
        JSON.stringify(v) !==
        JSON.stringify((second.canonical_payload as Obj)[k]),
    );
    expect(changed.map(([k]) => k)).toEqual(["configured_runtime_seconds"]);
  });

  it("LIMIT (raw request-specimen derivation): rendered-request specimen bytes are shipped fixture-template data, read as exact bytes, not regenerated by TypeScript", () => {
    // The manifests above are verified against the shipped specimen bytes: each specimen's raw hash is the manifest's
    // rendered_request_hash and each specimen CONTAINS the recomputed upstream hashes. The request TEMPLATE is a fixture
    // construct that Hashing does not govern; the Python fixture validator (G07) rebuilds the specimens, but that is NOT TypeScript
    // coverage and is not claimed here. Consequently an upstream change does not flow into the specimens in this chain.
    const specimens = (
      fixtureJson("fixture_model_requests.json") as {
        requests: { rendered_request: string }[];
      }
    ).requests;
    expect(specimens).toHaveLength(5);
    const chain = deriveChain();
    const embeds = new Map<string, string[]>([
      ["writer_view", [chain.writerView as string]],
      ["writer_context_manifest", [chain.writerContext as string]],
    ]);
    for (const hashes of embeds.values())
      for (const hash of hashes)
        expect(
          specimens.filter((x) => x.rendered_request.includes(hash)).length,
        ).toBeGreaterThanOrEqual(1);
  });

  it("LIMIT: policy/gate version strings and UUID identifiers are literal inputs, cross-checked against the policy map", () => {
    const policies = (
      fixtureJson("config/policy_versions.json") as {
        policies: Record<string, { version_id: string }>;
      }
    ).policies;
    const ids = new Set(Object.values(policies).map((p) => p.version_id));
    const gates = fixtureJson("gate_fingerprint_inputs.json") as Record<
      string,
      { input_projection: Obj }
    >;
    for (const [stage, key] of [
      ["claims_writing", "claims_policy_version"],
      ["claims_writing", "writing_policy_version"],
      ["performance", "performance_policy_version"],
    ] as const)
      expect(ids.has(String(gates[stage]?.input_projection[key]))).toBe(true);
    // Stage fingerprints retain their closed key sets: none names the addendum.
    for (const gate of Object.values(gates))
      expect(JSON.stringify(gate.input_projection)).not.toContain(
        "fixture-profile-addendum",
      );
  });

  it("LIMIT: the lexical JSON 1.0 reducer case (sequence_not_integer) is not representable through JSON.parse and remains unproved here", () => {
    // JSON.parse maps 1.0 and 1 to the same number; the claim reducer and loader are outside A1 (Completion A work).
    expect(JSON.parse("1.0")).toBe(JSON.parse("1"));
  });
});

describe("predecessor stability: unchanged contracts keep their identities", () => {
  it("the existing stage-fingerprint function still reproduces the v0.4.3 vectors, and v0.4.3 constants are not promoted to v0.4.6", async () => {
    const { loadFingerprintVectors } = await import("../src/fixture/loader.js");
    const old = loadFingerprintVectors().fingerprints;
    const current = fixtureJson("gate_fingerprint_inputs.json") as Record<
      string,
      { fingerprint: string }
    >;
    for (const [stage, vector] of Object.entries(old)) {
      expect(
        fingerprint(
          stage as Parameters<typeof fingerprint>[0],
          vector.input_projection,
        ),
      ).toBe(vector.expected_hash);
      expect(current[stage]?.fingerprint, stage).not.toBe(vector.expected_hash);
    }
    expect(Object.keys(old)).toHaveLength(6);
  });
});

describe("dependency classification under the single active rules (hypotheses verified by recomputation)", () => {
  const flatten = (chain: Obj): Record<string, unknown> => {
    const stages = chain.stages as Record<string, string>;
    const scripts = chain.scripts as string[];
    const manifests = chain.manifestHashes as Record<string, string>;
    const semantic = chain.semanticByRole as Record<string, string>;
    return {
      packageHash: chain.packageHash,
      briefHash: chain.briefHash,
      writerView: chain.writerView,
      serialized: chain.serialized,
      writerContext: chain.writerContext,
      script1: scripts[0],
      script2: scripts[1],
      script3: scripts[2],
      reviewHash: chain.reviewHash,
      directionHash: chain.directionHash,
      correction: chain.correction,
      auditResult: chain.auditResult,
      baseHashes: JSON.stringify(chain.baseHashes),
      contexts: JSON.stringify(chain.contexts),
      renderManifest: chain.renderManifest,
      recipeHash: chain.recipeHash,
      mapHash: chain.mapHash,
      master: chain.master,
      showConfig: chain.showConfig,
      stageClaimsWriting: stages.claims_writing,
      stagePerformance: stages.performance,
      stageSemanticAudit: stages.semantic_audit,
      stageRender: stages.render,
      stageAssembly: stages.assembly,
      stageReady: stages.ready_candidate,
      ...Object.fromEntries(
        Object.entries(manifests).map(([r, h]) => [`manifest:${r}`, h]),
      ),
      ...Object.fromEntries(
        Object.entries(semantic).map(([r, h]) => [`semantic:${r}`, h]),
      ),
    };
  };
  const diff = (a: Obj, b: Obj): string[] => {
    const left = flatten(a);
    const right = flatten(b);
    return Object.keys(left)
      .filter((key) => left[key] !== right[key])
      .sort();
  };
  const baseChain = deriveChain();

  it("a changed prediction text moves exactly the script-dependent hashes and four stage fingerprints; knowledge, package, brief, writer chain, manifests, base requests, audio and assembly do not", () => {
    expect(
      diff(baseChain, deriveChain({ predictionTextSuffix: " x" })),
    ).toEqual(
      [
        "auditResult",
        "correction",
        "directionHash",
        // manifests whose ordered inputs name a script/review artifact (complete payload only: the shipped request
        // specimens, and so the semantic-input hashes, are fixed template bytes; see the specimen LIMIT)
        "manifest:craft_critic",
        "manifest:speech_texture",
        "manifest:writer_revision",
        "renderManifest",
        "reviewHash",
        "script1",
        "script2",
        "script3",
        "stageClaimsWriting",
        "stagePerformance",
        "stageRender",
        "stageSemanticAudit",
      ].sort(),
    );
  });

  it("a changed show-config name moves only the show-config hash and the READY candidate", () => {
    expect(diff(baseChain, deriveChain({ configNameSuffix: " x" }))).toEqual([
      "showConfig",
      "stageReady",
    ]);
  });

  it("different addendum bytes move exactly the four writer-view roles' complete and semantic manifest identities; no script, writer view, context, stage fingerprint or planner manifest", () => {
    const other = deriveChain({
      addendumBytes: Buffer.from("a different addendum", "utf8"),
    });
    expect(diff(baseChain, other)).toEqual(
      [
        "manifest:craft_critic",
        "manifest:speech_texture",
        "manifest:writer",
        "manifest:writer_revision",
        "semantic:craft_critic",
        "semantic:speech_texture",
        "semantic:writer",
        "semantic:writer_revision",
      ].sort(),
    );
  });

  it("an upstream evidence change moves every dependent hash including the stage fingerprints it feeds, and an audio change moves only assembly onward", () => {
    const evidence = diff(baseChain, deriveChain({ evidenceBodySuffix: " c" }));
    for (const key of ["packageHash", "briefHash", "writerView", "stageRender"])
      expect(evidence, key).toContain(key);
    expect(evidence).not.toContain("stageAssembly");
    expect(evidence).not.toContain("stageReady");
    expect(diff(baseChain, deriveChain({ audioMutation: true }))).toEqual(
      ["mapHash", "recipeHash", "stageAssembly", "stageReady"].sort(),
    );
  });
});
