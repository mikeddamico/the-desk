// Fixed ORIGINAL seventeen-turn synthetic conformance only. No TTS, DB, lifecycle or genuine clearance.
import {
  acquireFrozenRender046Inputs,
  FrozenInputRejected,
  type AcquisitionCode,
  type AcquiredFrozenRender046,
  type FrozenRender046Sources,
  type SourceIdentity,
} from "./frozen-render046-input.js";
import {
  deriveFrozenFixture046PlanData,
  type FrozenPlanData,
  type FrozenPlanInputs,
  type FrozenPlanSelections,
  type FrozenPlanMechanics,
  type FrozenSubjectIdentities,
  type FrozenAuditProjection,
  type StructuralCode,
} from "./frozen-render046-plan.js";
import {
  evidencePackageHash,
  showrunnerBriefHash,
  scriptHash,
  turnAnchorMap,
  performanceDirectionHash,
  performanceDirectionProjection,
  renderManifestHash,
  renderManifestProjection,
} from "../identity/artifacts.js";
import { canonicalJson } from "../identity/canonical-json.js";
import { fingerprint, baseRequestHash } from "../identity/fingerprints.js";
import { renderContextHash } from "../identity/layer-b.js";
import {
  selectBaseRequestProjection,
  requestBaseHash,
} from "../identity/request.js";
import { checkFixtureRequestOwnership } from "../identity/fixture-render-ownership.js";
import { showConfigVersionHash } from "../identity/show-config.js";
import {
  asArray,
  asRecord,
  asNonBlankString,
  requireExactKeys,
  type JsonObject,
} from "../identity/select.js";

const PROFILE = "frozen-fixture046-render-planning/1" as const;
export interface FrozenRenderPlanningInvocation {
  profile: typeof PROFILE;
  purpose: "fixture_conformance";
  environment: "test";
}
export type FrozenPlanningPhase =
  | "invocation_context"
  | "acquisition_source_identity"
  | "source_shape_references"
  | "audit_subject"
  | "capability"
  | "block_voice_pronunciation_ownership"
  | "projections_hashes";
export type FrozenPlanningCode =
  | AcquisitionCode
  | StructuralCode
  | "invalid_invocation"
  | "unsafe_runtime_configuration"
  | "audit_subject_mismatch"
  | "private_admission_missing"
  | "derived_binding_mismatch";
type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
    : T;
export type FrozenRenderPlanningResult = DeepReadonly<
  | {
      status: "blocked";
      profile: typeof PROFILE;
      code: FrozenPlanningCode;
      phase: FrozenPlanningPhase;
    }
  | (FrozenPlanData & {
      status: "fixture_render_planning_pass";
      profile: typeof PROFILE;
      fixture_stub: true;
      semantic_clearance: false;
      production_clearance: false;
      source_receipt: readonly SourceIdentity[];
      audit_seed: {
        raw_sha256: string;
        bytes: 1006;
        auditor_kind: "fixture_stub_semantic_auditor";
        auditor_version: "semantic-auditor-v1";
        audit_run_id: string;
        artifact_id: string;
      };
      planning_checks: {
        check:
          | "program_block_boundary"
          | "speaker_map_complete"
          | "pronunciation_freshness"
          | "base_hash_projection_valid";
        outcome: "pass";
        scope: "synthetic_fixture_only";
      }[];
    })
>;
interface Admission {
  inputs: FrozenPlanInputs;
  subjects: FrozenSubjectIdentities;
  audit_projection: FrozenAuditProjection;
  audit_fingerprint: string;
  receipt: readonly SourceIdentity[];
}
// Neither this map, its key, a mint function nor a promotion/finalize API is exported.
const ADMITTED = new WeakMap<object, Admission>();
class Refused extends Error {
  constructor(readonly code: FrozenPlanningCode) {
    super(code);
  }
}
function refuse(code: FrozenPlanningCode): never {
  throw new Refused(code);
}
function text(value: unknown): string {
  return asNonBlankString(value, "source reference");
}
function objects(value: unknown): JsonObject[] {
  return asArray(value, "source records").map((v) =>
    asRecord(v, "source record"),
  );
}
function equal(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}
function frozen<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) frozen(child);
    Object.freeze(value);
  }
  return value;
}
function safeRuntimeConfiguration(): boolean {
  // Narrow owned read of the existing src/config.ts setting names, not loadConfig or an injected environment.
  return (
    process.env.DESK_ENV === "test" &&
    process.env.PROVIDERS_ENABLED === "false" &&
    process.env.GENERATION_KILL_SWITCH === "true"
  );
}
function validInvocation(value: unknown): boolean {
  try {
    const input = requireExactKeys(
      value,
      ["profile", "purpose", "environment"],
      "fixture invocation",
    );
    return (
      Reflect.ownKeys(input).length === 3 &&
      input.profile === PROFILE &&
      input.purpose === "fixture_conformance" &&
      input.environment === "test"
    );
  } catch {
    return false;
  }
}
function subjectsFrom(s: FrozenRender046Sources): FrozenSubjectIdentities {
  const anchors = turnAnchorMap(s.script.turns);
  const subjects: FrozenSubjectIdentities = {
    package_hash: evidencePackageHash(s.evidence_package),
    brief_hash: showrunnerBriefHash(s.brief),
    script_hash: scriptHash(s.script, { brief: s.brief }),
    performance_direction_hash: performanceDirectionHash(s.direction, anchors),
    show_config_version_hash: showConfigVersionHash(s.show_config),
    evidence_package_id: text(s.evidence_package.id),
    showrunner_brief_version_id: text(s.brief.showrunner_brief_version_id),
    script_version_id: text(s.script.script_version_id),
    performance_direction_version_id: text(
      s.direction.performance_direction_version_id,
    ),
  };
  if (
    s.brief.evidence_package_id !== subjects.evidence_package_id ||
    s.brief.package_hash !== subjects.package_hash ||
    s.script.evidence_package_id !== subjects.evidence_package_id ||
    s.script.package_hash !== subjects.package_hash ||
    s.script.showrunner_brief_version_id !==
      subjects.showrunner_brief_version_id ||
    s.script.brief_hash !== subjects.brief_hash ||
    s.direction.script_version_id !== subjects.script_version_id ||
    s.direction.script_hash !== subjects.script_hash
  )
    refuse("source_reference_mismatch");
  const blocks = objects(s.brief.program_blocks),
    turns = objects(s.script.turns);
  const order = blocks.map((b) => b.program_block_id);
  if (
    new Set(order).size !== 9 ||
    anchors.size !== 17 ||
    !equal(s.script.program_block_refs, order) ||
    !equal(
      blocks.flatMap((b) =>
        turns.filter((t) => t.program_block_id === b.program_block_id),
      ),
      turns,
    )
  )
    refuse("source_reference_mismatch");
  return subjects;
}
function auditProjection(
  subjects: FrozenSubjectIdentities,
): FrozenAuditProjection {
  return {
    package_hash: subjects.package_hash,
    brief_hash: subjects.brief_hash,
    script_hash: subjects.script_hash,
    performance_direction_hash: subjects.performance_direction_hash,
    claims_policy_version: "claims-0.1.2",
    writing_policy_version: "writing-0.2.3",
    performance_policy_version: "performance-render-0.1.4",
    auditor_contract_version: "semantic-auditor-v1",
  };
}
function exactAudit(
  acquired: AcquiredFrozenRender046,
  subjects: FrozenSubjectIdentities,
): FrozenAuditProjection {
  const seed = acquired.audit_seed;
  const original = {
    package_hash:
      "a8655c0e8bd72094a823b367a0c21cd665d3d99c271341286a92dbdc2ea304ab",
    brief_hash:
      "36fb22d03300206d3181959a100f2911c2b27d9ff72379f21831d32a4bd5c475",
    script_hash:
      "883cbe121635364f72072b29264f00af9b79eb32fd7ebd3d7e8462f829f50677",
    performance_direction_hash:
      "177b9d58cc787b21440170b945aedbe27856c8498097315b0078fed0e4e4ba08",
    show_config_version_hash:
      "d1f022782d543d1b8d9a7fd3d56895b57ca1f2b8381457d84261508e75b36719",
    evidence_package_id: "d1250004-0000-4000-8000-000000000001",
    showrunner_brief_version_id: "c063d0fe-ac04-4c81-8fd6-6724e6139c1a",
    script_version_id: "b9a7be59-70b8-45ae-bb38-190c3b8ab94c",
    performance_direction_version_id: "815f80aa-d9ca-4ddd-9e65-41b46bf5e138",
  };
  const projection = auditProjection(subjects);
  const digest = fingerprint("semantic_audit", projection);
  if (
    !equal(subjects, original) ||
    seed.fixture_stub !== true ||
    seed.auditor_kind !== "fixture_stub_semantic_auditor" ||
    seed.auditor_version !== "semantic-auditor-v1" ||
    seed.result !== "pass" ||
    !equal(seed.findings, []) ||
    seed.audit_run_id !== "20d87118-3576-4b14-8169-61a166bf8ff8" ||
    seed.artifact_id !== "484a47f5-3e57-4c9b-917e-d5babcdc57c2" ||
    digest !==
      "fef4b240055df690424b35577788004039a2d6f9926789545c9f66857e8eeb1a" ||
    seed.input_fingerprint !== digest ||
    !equal(seed.input_projection, projection)
  )
    refuse("audit_subject_mismatch");
  return projection;
}
function mechanics(): FrozenPlanMechanics {
  // Independently authored inputs: base_request_hash_conformance actual_blocks/*/input_record non-row fields ONLY.
  // Capability and show-render labels are explicit contract constants, not a config-content binding.
  return {
    provider: "fixture_tts",
    concrete_model_identity: "fixture-model-1.0",
    adapter_render_contract_version: "fixture-adapter-contract-v2",
    provider_capability_version: "fixture-provider-capability-v1",
    render_policy_version: "performance-render-0.1.4",
    show_render_config_version: "postmatch-fixture-v4",
    resolved_generation_settings: {
      temperature: "0.7",
      format: "wav",
      sample_rate_hz: 48000,
      channels: 1,
    },
    scene_config: {
      scene_version: "fixture-scene-v1",
      description: "studio sports analysis",
    },
    named_text_transform_versions: [
      "literal-text-escape/v1",
      "pronunciation-apply/v1",
    ],
  };
}
function sourceSelections(s: FrozenRender046Sources): FrozenPlanSelections {
  const turns = objects(s.script.turns),
    blocks = objects(s.brief.program_blocks);
  const records = asRecord(s.support.records, "input support"),
    profiles = objects(records.voice_profiles),
    versions = objects(records.voice_profile_versions);
  const voices = profiles.map((profile) => {
    const matches = versions.filter(
      (v) => v.voice_profile_id === profile.voice_profile_id,
    );
    if (matches.length !== 1) refuse("voice_lineage_invalid");
    const version = asRecord(matches[0], "voice version");
    return {
      participant_id: text(profile.participant_identity),
      voice_profile_version_id: text(version.voice_profile_version_id),
    };
  });
  const canonicals = objects(records.pronunciations);
  const latest = canonicals.filter(
    (p) =>
      !canonicals.some(
        (c) => c.supersedes_pronunciation_id === p.pronunciation_id,
      ),
  );
  if (latest.length !== 1) refuse("pronunciation_lineage_ambiguous");
  const current = asRecord(latest[0], "canonical version");
  const renderings = objects(records.pronunciation_renderings);
  // P&R §19 exact authored mentions, resolved to source final-script UUIDs, not oracle request fields.
  const spans = [
    ["t03", 62, 73],
    ["t04", 0, 11],
    ["t05", 49, 60],
    ["t06", 59, 70],
    ["t07", 125, 136],
    ["t14", 151, 162],
  ] as const;
  const mentions = spans.map(([anchor, start, end]) => {
    const turn = asRecord(
      turns.find((t) => t.semantic_turn_id === anchor),
      "mention turn",
    );
    const voice = voices.find((v) => v.participant_id === turn.participant_id);
    const matches = renderings.filter(
      (r) =>
        r.pronunciation_id === current.pronunciation_id &&
        r.voice_profile_version_id === voice?.voice_profile_version_id &&
        r.provider === "fixture_tts",
    );
    if (matches.length !== 1) refuse("pronunciation_reference_invalid");
    return {
      turn_id: text(turn.turn_id),
      start_offset: start,
      end_offset: end,
      pronunciation_id: text(current.pronunciation_id),
      pronunciation_rendering_id: text(
        asRecord(matches[0], "rendering").pronunciation_rendering_id,
      ),
    };
  });
  return {
    voices,
    mentions,
    blocks: blocks.map((block, index) => ({
      program_block_id: text(block.program_block_id),
      turn_ids: turns
        .filter((t) => t.program_block_id === block.program_block_id)
        .map((t) => text(t.turn_id)),
      context_recipe_version: index === 0 ? "C0-v1" : "C2-v1",
      context_turn_ids:
        index === 0
          ? []
          : [
              text(
                turns
                  .filter(
                    (t) =>
                      t.program_block_id ===
                      blocks[index - 1]?.program_block_id,
                  )
                  .at(-1)?.turn_id,
              ),
            ],
    })),
  };
}

/** Independent source/reference tie at the ONLY success-construction site. Not an exported promotion API. */
function tiedData(capability: object, data: FrozenPlanData): Admission {
  const admitted = ADMITTED.get(capability);
  if (!admitted) refuse("private_admission_missing");
  const { sources, selections, mechanics: m } = admitted.inputs;
  if (
    !equal(data.subjects, subjectsFrom(sources)) ||
    !equal(data.subjects, admitted.subjects) ||
    !equal(data.audit_input_projection, admitted.audit_projection) ||
    data.audit_input_fingerprint !== admitted.audit_fingerprint ||
    data.requests.length !== 9 ||
    data.semantic_manifest.render_blocks.length !== 9
  )
    refuse("derived_binding_mismatch");
  const turns = objects(sources.script.turns),
    intents = objects(sources.direction.performance_intents),
    anchors = turnAnchorMap(turns);
  const resolvedIntents = objects(
    performanceDirectionProjection(sources.direction, anchors)
      .performance_intents,
  );
  const records = asRecord(sources.support.records, "support");
  const versions = objects(records.voice_profile_versions),
    canonicals = objects(records.pronunciations),
    renderings = objects(records.pronunciation_renderings);
  const voiceMap: JsonObject = {};
  for (const voice of selections.voices) {
    const version = asRecord(
      versions.find(
        (v) => v.voice_profile_version_id === voice.voice_profile_version_id,
      ),
      "voice",
    );
    voiceMap[voice.participant_id] = {
      ...asRecord(version.render_fields, "voice render fields"),
      version: version.version,
      voice_profile_version_id: version.voice_profile_version_id,
    };
  }
  const order = objects(sources.brief.program_blocks).map(
    (b) => b.program_block_id,
  );
  for (const [index, selection] of selections.blocks.entries()) {
    const generated: JsonObject[] = selection.turn_ids.map((id) => {
      const turn = asRecord(
        turns.find((t) => t.turn_id === id),
        "generated source turn",
      );
      return {
        ...turn,
        voice_profile_version_id: asRecord(
          voiceMap[text(turn.participant_id)],
          "voice",
        ).voice_profile_version_id,
      };
    });
    const selected = new Set(generated.map((t) => t.semantic_turn_id));
    const context = {
      recipe_version: selection.context_recipe_version,
      turns: selection.context_turn_ids.map((id) =>
        asRecord(
          turns.find((t) => t.turn_id === id),
          "context source turn",
        ),
      ),
    };
    const applications = selections.mentions
      .filter((mention) => selection.turn_ids.includes(mention.turn_id))
      .map((mention) => {
        const canonical = asRecord(
          canonicals.find(
            (p) => p.pronunciation_id === mention.pronunciation_id,
          ),
          "canonical",
        );
        const rendering = asRecord(
          renderings.find(
            (r) =>
              r.pronunciation_rendering_id ===
              mention.pronunciation_rendering_id,
          ),
          "rendering",
        );
        return {
          semantic_turn_id: anchors.get(mention.turn_id),
          start_offset: mention.start_offset,
          end_offset: mention.end_offset,
          pronunciation_id: canonical.pronunciation_id,
          canonical_current_pronunciation_id: canonical.pronunciation_id,
          pronunciation_rendering_id: rendering.pronunciation_rendering_id,
          rendering_pronunciation_id: rendering.pronunciation_id,
          voice_profile_version_id: rendering.voice_profile_version_id,
          provider: rendering.provider,
          entity_identity: canonical.entity_identity,
          canonical_text: canonical.canonical_text,
          canonical_version: canonical.canonical_version,
          language: canonical.language,
          ipa: canonical.ipa,
          rendering_version: rendering.version,
          render_text: rendering.rendering,
        };
      });
    const request = {
      schema: "resolved-render-request-record/1",
      concrete_model_identity: m.concrete_model_identity,
      adapter_render_contract_version: m.adapter_render_contract_version,
      voice_versions: voiceMap,
      turns: generated,
      intents: resolvedIntents.filter((i) => selected.has(i.scope_ref)),
      context,
      pronunciation_applications: applications,
      resolved_generation_settings: m.resolved_generation_settings,
      scene_config: m.scene_config,
      named_text_transform_versions: m.named_text_transform_versions,
      take_index: 0,
    };
    checkFixtureRequestOwnership(request, {
      program_block_order: order,
      turns,
    });
    const output = data.requests[index];
    if (
      output?.program_block_id !== selection.program_block_id ||
      !equal(output.projection, selectBaseRequestProjection(request)) ||
      output.base_request_hash !== requestBaseHash(request) ||
      output.base_request_hash !==
        baseRequestHash(asRecord(output.projection, "projection"))
    )
      refuse("derived_binding_mismatch");
    const expectedBlock = {
      program_block_id: selection.program_block_id,
      ordered_turn_ids: selection.turn_ids,
      speaker_map: generated.map((t) => ({
        turn_id: t.turn_id,
        participant_id: t.participant_id,
        voice_profile_version_id: t.voice_profile_version_id,
      })),
      provider: {
        concrete_model_identity: m.concrete_model_identity,
        provider: m.provider,
        settings: { ...m.resolved_generation_settings },
      },
      context_recipe_version: selection.context_recipe_version,
      resolved_context_refs: {
        turn_ids: selection.context_turn_ids,
        context_hash: renderContextHash(context),
      },
      applied_performance_intent_ids: intents
        .filter((i) => selection.turn_ids.includes(text(i.scope_ref)))
        .map((i) => i.performance_intent_id),
      applied_pronunciation_rendering_ids: [
        ...new Set(applications.map((a) => a.pronunciation_rendering_id)),
      ],
      named_text_transform_versions: m.named_text_transform_versions,
      base_request_hash: output.base_request_hash,
    };
    if (!equal(data.semantic_manifest.render_blocks[index], expectedBlock))
      refuse("derived_binding_mismatch");
  }
  const manifest = {
    script_hash: admitted.subjects.script_hash,
    performance_direction_hash: admitted.subjects.performance_direction_hash,
    audit_gate_fingerprint: admitted.audit_fingerprint,
    render_spec_version: m.render_policy_version,
    adapter_contract_version: m.adapter_render_contract_version,
    provider_capability_version: m.provider_capability_version,
    show_render_config_version: m.show_render_config_version,
    render_blocks: data.semantic_manifest.render_blocks,
  };
  const gate = {
    render_manifest_hash: renderManifestHash(manifest),
    audit_input_fingerprint: admitted.audit_fingerprint,
    render_policy_version: m.render_policy_version,
    gate_set_version: "build2-gates-v1",
  };
  if (
    !equal(data.semantic_manifest, renderManifestProjection(manifest)) ||
    data.semantic_manifest_hash !== gate.render_manifest_hash ||
    !equal(data.render_gate_projection, gate) ||
    data.render_gate_fingerprint !== fingerprint("render", gate)
  )
    refuse("derived_binding_mismatch");
  return admitted;
}
function phaseFor(code: StructuralCode): FrozenPlanningPhase {
  if (
    [
      "source_shape_invalid",
      "source_reference_mismatch",
      "duplicate_turn_anchor",
      "turn_topology_invalid",
    ].includes(code)
  )
    return "source_shape_references";
  if (code === "unsupported_capability" || code === "voice_model_incompatible")
    return "capability";
  return code === "projection_invalid"
    ? "projections_hashes"
    : "block_voice_pronunciation_ownership";
}

export async function planFrozenFixture046Render(
  input: FrozenRenderPlanningInvocation,
): Promise<FrozenRenderPlanningResult> {
  let phase: FrozenPlanningPhase = "invocation_context";
  let capability: object | undefined;
  try {
    if (!validInvocation(input)) refuse("invalid_invocation");
    if (!safeRuntimeConfiguration()) refuse("unsafe_runtime_configuration");
    phase = "acquisition_source_identity";
    const acquired = await acquireFrozenRender046Inputs();
    phase = "source_shape_references";
    const subjects = subjectsFrom(acquired.sources);
    phase = "audit_subject";
    const projection = exactAudit(acquired, subjects);
    phase = "block_voice_pronunciation_ownership";
    const inputs = {
      sources: acquired.sources,
      selections: sourceSelections(acquired.sources),
      mechanics: mechanics(),
    };
    capability = Object.freeze({});
    ADMITTED.set(
      capability,
      frozen({
        inputs,
        subjects,
        audit_projection: projection,
        audit_fingerprint: fingerprint("semantic_audit", projection),
        receipt: acquired.source_receipt,
      }),
    );
    const computed = deriveFrozenFixture046PlanData(inputs);
    if (computed.status !== "derived") {
      phase = phaseFor(computed.code);
      refuse(computed.code);
    }
    phase = "projections_hashes";
    const admitted = tiedData(capability, computed.data);
    // Observe the exact owned safety values again immediately before constructing/releasing success.
    if (!safeRuntimeConfiguration()) {
      phase = "invocation_context";
      refuse("unsafe_runtime_configuration");
    }
    return frozen({
      ...computed.data,
      status: "fixture_render_planning_pass" as const,
      profile: PROFILE,
      fixture_stub: true as const,
      semantic_clearance: false as const,
      production_clearance: false as const,
      source_receipt: admitted.receipt,
      audit_seed: {
        raw_sha256:
          "d956658e95a74f794035e44cee3ad808e1e7086bb104846c809852f96286ede5",
        bytes: 1006 as const,
        auditor_kind: "fixture_stub_semantic_auditor" as const,
        auditor_version: "semantic-auditor-v1" as const,
        audit_run_id: "20d87118-3576-4b14-8169-61a166bf8ff8",
        artifact_id: "484a47f5-3e57-4c9b-917e-d5babcdc57c2",
      },
      planning_checks: (
        [
          "program_block_boundary",
          "speaker_map_complete",
          "pronunciation_freshness",
          "base_hash_projection_valid",
        ] as const
      ).map((check) => ({
        check,
        outcome: "pass" as const,
        scope: "synthetic_fixture_only" as const,
      })),
    });
  } catch (error) {
    const code =
      error instanceof Refused || error instanceof FrozenInputRejected
        ? error.code
        : phase === "source_shape_references"
          ? "source_shape_invalid"
          : "projection_invalid";
    if (code === "source_shape_invalid" || code === "source_binding_invalid")
      phase = "source_shape_references";
    return frozen({
      status: "blocked" as const,
      profile: PROFILE,
      code,
      phase,
    });
  } finally {
    if (capability) ADMITTED.delete(capability);
  }
}
