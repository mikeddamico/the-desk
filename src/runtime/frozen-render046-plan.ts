// Pure mechanical DATA, never audit admission. Only the two diagnostic/derivation surfaces are exported.
import {
  evidencePackageHash,
  showrunnerBriefHash,
  scriptHash,
  turnAnchorMap,
  performanceDirectionHash,
  performanceDirectionProjection,
  renderManifestProjection,
  renderManifestHash,
} from "../identity/artifacts.js";
import { canonicalJson, normalizeString } from "../identity/canonical-json.js";
import { fingerprint } from "../identity/fingerprints.js";
import { renderContextHash } from "../identity/layer-b.js";
import {
  checkFixtureRequestOwnership,
  RequestRejected,
  type RequestRejectionCode,
} from "../identity/fixture-render-ownership.js";
import {
  requestBaseHash,
  selectBaseRequestProjection,
} from "../identity/request.js";
import { showConfigVersionHash } from "../identity/show-config.js";
import {
  asArray,
  asInteger,
  asNonBlankString,
  asRecord,
  requireExactKeys,
  type JsonObject,
} from "../identity/select.js";
import {
  parseFrozenRender046Sources,
  FrozenInputRejected,
  type FrozenRender046Sources,
} from "./frozen-render046-input.js";

export type StructuralCode =
  | RequestRejectionCode
  | "source_shape_invalid"
  | "source_reference_mismatch"
  | "duplicate_turn_anchor"
  | "turn_topology_invalid"
  | "block_selection_invalid"
  | "voice_lineage_invalid"
  | "pronunciation_lineage_ambiguous"
  | "pronunciation_reference_invalid"
  | "pronunciation_mention_set_invalid"
  | "unsupported_capability"
  | "projection_invalid";
export interface FrozenBlockSelection {
  program_block_id: string;
  turn_ids: string[];
  context_recipe_version: string;
  context_turn_ids: string[];
}
export interface FrozenMentionSelection {
  turn_id: string;
  start_offset: number;
  end_offset: number;
  pronunciation_id: string;
  pronunciation_rendering_id: string;
}
export interface FrozenPlanSelections {
  voices: { participant_id: string; voice_profile_version_id: string }[];
  blocks: FrozenBlockSelection[];
  mentions: FrozenMentionSelection[];
}
export interface FrozenPlanMechanics {
  provider: string;
  concrete_model_identity: string;
  adapter_render_contract_version: string;
  provider_capability_version: string;
  render_policy_version: string;
  show_render_config_version: string;
  resolved_generation_settings: {
    temperature: string;
    format: string;
    sample_rate_hz: number;
    channels: number;
  };
  scene_config: { scene_version: string; description: string };
  named_text_transform_versions: string[];
}
export interface FrozenPlanInputs {
  sources: FrozenRender046Sources;
  selections: FrozenPlanSelections;
  mechanics: FrozenPlanMechanics;
}
export interface FrozenSubjectIdentities {
  package_hash: string;
  brief_hash: string;
  script_hash: string;
  performance_direction_hash: string;
  show_config_version_hash: string;
  evidence_package_id: string;
  showrunner_brief_version_id: string;
  script_version_id: string;
  performance_direction_version_id: string;
}
export interface FrozenAuditProjection {
  package_hash: string;
  brief_hash: string;
  script_hash: string;
  performance_direction_hash: string;
  claims_policy_version: "claims-0.1.2";
  writing_policy_version: "writing-0.2.3";
  performance_policy_version: "performance-render-0.1.4";
  auditor_contract_version: "semantic-auditor-v1";
}
export interface FrozenSemanticBlock {
  program_block_id: string;
  ordered_turn_ids: string[];
  speaker_map: {
    turn_id: string;
    participant_id: string;
    voice_profile_version_id: string;
  }[];
  provider: {
    concrete_model_identity: string;
    provider: string;
    settings: FrozenPlanMechanics["resolved_generation_settings"];
  };
  context_recipe_version: string;
  resolved_context_refs: { turn_ids: string[]; context_hash: string };
  applied_performance_intent_ids: string[];
  applied_pronunciation_rendering_ids: string[];
  named_text_transform_versions: string[];
  base_request_hash: string;
}
export interface FrozenSemanticManifest {
  script_hash: string;
  performance_direction_hash: string;
  audit_gate_fingerprint: string;
  render_spec_version: string;
  adapter_contract_version: string;
  provider_capability_version: string;
  show_render_config_version: string;
  render_blocks: FrozenSemanticBlock[];
}
/** Eleven named fields; values remain plain computation data, never permission tokens. */
export interface FrozenRequestProjection {
  concrete_model_identity: unknown;
  adapter_render_contract_version: unknown;
  immutable_voice_profile_version_render_fields: unknown;
  speaker_map: unknown;
  resolved_generation_settings: unknown;
  canonical_spoken_text: unknown;
  approved_performance_intents: unknown;
  bounded_render_context: unknown;
  render_facing_persona_or_scene_config: unknown;
  applied_pronunciation_rendering_versions: unknown;
  named_text_transform_versions: unknown;
}
export interface FrozenPlanData {
  subjects: FrozenSubjectIdentities;
  audit_input_projection: FrozenAuditProjection;
  audit_input_fingerprint: string;
  semantic_manifest: FrozenSemanticManifest;
  semantic_manifest_hash: string;
  requests: {
    program_block_id: string;
    projection: FrozenRequestProjection;
    base_request_hash: string;
  }[];
  render_gate_projection: {
    render_manifest_hash: string;
    audit_input_fingerprint: string;
    render_policy_version: string;
    gate_set_version: "build2-gates-v1";
  };
  render_gate_fingerprint: string;
}

type Inspection =
  | { authority: "none"; status: "structurally_valid" }
  | { authority: "none"; status: "invalid"; code: StructuralCode };
type Derivation =
  | { authority: "none"; status: "derived"; data: FrozenPlanData }
  | { authority: "none"; status: "invalid"; code: StructuralCode };
class InvalidPlan extends Error {
  constructor(readonly code: StructuralCode) {
    super(code);
  }
}
function reject(code: StructuralCode): never {
  throw new InvalidPlan(code);
}
function exact(value: unknown, keys: readonly string[]): JsonObject {
  return requireExactKeys(value, keys, "plan input");
}
function objects(value: unknown): JsonObject[] {
  return asArray(value, "records").map((v) => asRecord(v, "record"));
}
function text(value: unknown): string {
  return asNonBlankString(value, "reference");
}
function texts(value: unknown): string[] {
  return asArray(value, "references").map(text);
}
function same(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}
function unique(values: readonly unknown[], code: StructuralCode): void {
  if (new Set(values).size !== values.length) reject(code);
}
function member<T>(
  items: readonly T[],
  predicate: (item: T) => boolean,
  code: StructuralCode,
): T {
  const hits = items.filter(predicate);
  const first = hits[0];
  if (first === undefined || hits.length !== 1) reject(code);
  return first;
}

function parseSelections(value: unknown): FrozenPlanSelections {
  const selection = exact(value, ["voices", "blocks", "mentions"]);
  const voices = objects(selection.voices).map((row) => {
    exact(row, ["participant_id", "voice_profile_version_id"]);
    return {
      participant_id: text(row.participant_id),
      voice_profile_version_id: text(row.voice_profile_version_id),
    };
  });
  const blocks = objects(selection.blocks).map((row) => {
    exact(row, [
      "program_block_id",
      "turn_ids",
      "context_recipe_version",
      "context_turn_ids",
    ]);
    return {
      program_block_id: text(row.program_block_id),
      turn_ids: texts(row.turn_ids),
      context_recipe_version: text(row.context_recipe_version),
      context_turn_ids: texts(row.context_turn_ids),
    };
  });
  const mentions = objects(selection.mentions).map((row) => {
    exact(row, [
      "turn_id",
      "start_offset",
      "end_offset",
      "pronunciation_id",
      "pronunciation_rendering_id",
    ]);
    return {
      turn_id: text(row.turn_id),
      start_offset: asInteger(row.start_offset, "start"),
      end_offset: asInteger(row.end_offset, "end"),
      pronunciation_id: text(row.pronunciation_id),
      pronunciation_rendering_id: text(row.pronunciation_rendering_id),
    };
  });
  return { voices, blocks, mentions };
}
function parseMechanics(value: unknown): FrozenPlanMechanics {
  const m = exact(value, [
    "provider",
    "concrete_model_identity",
    "adapter_render_contract_version",
    "provider_capability_version",
    "render_policy_version",
    "show_render_config_version",
    "resolved_generation_settings",
    "scene_config",
    "named_text_transform_versions",
  ]);
  const settings = exact(m.resolved_generation_settings, [
    "temperature",
    "format",
    "sample_rate_hz",
    "channels",
  ]);
  const scene = exact(m.scene_config, ["scene_version", "description"]);
  return {
    provider: text(m.provider),
    concrete_model_identity: text(m.concrete_model_identity),
    adapter_render_contract_version: text(m.adapter_render_contract_version),
    provider_capability_version: text(m.provider_capability_version),
    render_policy_version: text(m.render_policy_version),
    show_render_config_version: text(m.show_render_config_version),
    resolved_generation_settings: {
      temperature: text(settings.temperature),
      format: text(settings.format),
      sample_rate_hz: asInteger(settings.sample_rate_hz, "sample rate"),
      channels: asInteger(settings.channels, "channels"),
    },
    scene_config: {
      scene_version: text(scene.scene_version),
      description: text(scene.description),
    },
    named_text_transform_versions: texts(m.named_text_transform_versions),
  };
}

function sourceReferences(s: FrozenRender046Sources): {
  subjects: FrozenSubjectIdentities;
  turns: JsonObject[];
  blocks: JsonObject[];
  anchors: Map<string, string>;
} {
  const turns = objects(s.script.turns),
    blocks = objects(s.brief.program_blocks);
  unique(
    turns.map((t) => t.turn_id),
    "duplicate_turn_anchor",
  );
  unique(
    turns.map((t) => normalizeString(text(t.semantic_turn_id))),
    "duplicate_turn_anchor",
  );
  unique(
    blocks.map((b) => b.program_block_id),
    "block_selection_invalid",
  );
  if (
    turns.some(
      (t, i) =>
        t.sequence !== i + 1 ||
        t.semantic_turn_id !== `t${String(i + 1).padStart(2, "0")}`,
    ) ||
    blocks.some((b, i) => b.sequence !== i + 1)
  )
    reject("turn_topology_invalid");
  const blockOrder = blocks.map((b) => b.program_block_id);
  if (!same(s.script.program_block_refs, blockOrder))
    reject("source_reference_mismatch");
  const flattened = blocks.flatMap((b) =>
    turns.filter((t) => t.program_block_id === b.program_block_id),
  );
  if (
    !same(flattened, turns) ||
    blocks.some(
      (b) => !turns.some((t) => t.program_block_id === b.program_block_id),
    )
  )
    reject("turn_topology_invalid");
  const anchors = turnAnchorMap(turns);
  for (const field of ["turn_claim_uses", "turn_evidence_uses"] as const) {
    for (const use of objects(s.script[field]))
      if (anchors.get(text(use.turn_id)) !== use.semantic_turn_id)
        reject("source_reference_mismatch");
  }
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
    s.evidence_package.package_hash !== subjects.package_hash ||
    s.brief.package_hash !== subjects.package_hash ||
    s.brief.evidence_package_id !== subjects.evidence_package_id ||
    s.brief.brief_hash !== subjects.brief_hash ||
    s.script.brief_hash !== subjects.brief_hash ||
    s.script.package_hash !== subjects.package_hash ||
    s.script.evidence_package_id !== subjects.evidence_package_id ||
    s.script.showrunner_brief_version_id !==
      subjects.showrunner_brief_version_id ||
    s.script.script_hash !== subjects.script_hash ||
    s.direction.script_hash !== subjects.script_hash ||
    s.direction.script_version_id !== subjects.script_version_id ||
    s.direction.direction_hash !== subjects.performance_direction_hash ||
    s.show_config.config_hash !== subjects.show_config_version_hash ||
    s.script.writing_policy_version !== "writing-0.2.3" ||
    s.direction.direction_spec_version !== "performance-render-0.1.4"
  )
    reject("source_reference_mismatch");
  return { subjects, turns, blocks, anchors };
}

function capability(
  m: FrozenPlanMechanics,
  intents: JsonObject[],
  anchors: Map<string, string>,
): void {
  if (m.concrete_model_identity !== "fixture-model-1.0")
    reject("voice_model_incompatible");
  if (
    m.provider !== "fixture_tts" ||
    m.adapter_render_contract_version !== "fixture-adapter-contract-v2" ||
    m.provider_capability_version !== "fixture-provider-capability-v1" ||
    m.render_policy_version !== "performance-render-0.1.4" ||
    m.show_render_config_version !== "postmatch-fixture-v4" ||
    !same(m.resolved_generation_settings, {
      temperature: "0.7",
      format: "wav",
      sample_rate_hz: 48000,
      channels: 1,
    }) ||
    !same(m.scene_config, {
      scene_version: "fixture-scene-v1",
      description: "studio sports analysis",
    }) ||
    !same(m.named_text_transform_versions, [
      "literal-text-escape/v1",
      "pronunciation-apply/v1",
    ])
  )
    reject("unsupported_capability");
  // Explicit adopted synthetic representability, NOT acoustic/provider capability evidence.
  const permitted = [
    ["t01", "energy_intensity", "heightened", "light"],
    ["t02", "delivery_affect", "dry", "standard"],
    ["t04", "delivery_affect", "gently_amused", "light"],
    ["t08", "energy_intensity", "heightened", "standard"],
    ["t13", "delivery_affect", "dry", "standard"],
    ["t14", "pace", "slower", "standard"],
    ["t16", "delivery_affect", "rueful", "standard"],
    ["t17", "delivery_affect", "warm", "standard"],
  ];
  if (
    intents.length !== permitted.length ||
    intents.some(
      (intent, i) =>
        intent.scope_type !== "turn" ||
        intent.timing_anchor !== null ||
        !same(
          [
            anchors.get(text(intent.scope_ref)),
            intent.intent_type,
            intent.value,
            intent.strength,
          ],
          permitted[i],
        ),
    )
  )
    reject("unsupported_capability");
  unique(
    intents.map((intent) => intent.performance_intent_id),
    "unsupported_capability",
  );
}

function voicesFor(
  s: FrozenRender046Sources,
  selection: FrozenPlanSelections,
  m: FrozenPlanMechanics,
): JsonObject {
  const records = asRecord(s.support.records, "support records");
  const profiles = objects(records.voice_profiles),
    versions = objects(records.voice_profile_versions);
  unique(
    profiles.map((p) => p.voice_profile_id),
    "voice_lineage_invalid",
  );
  unique(
    profiles.map((p) => p.participant_identity),
    "voice_lineage_invalid",
  );
  unique(
    versions.map((v) => v.voice_profile_version_id),
    "voice_lineage_invalid",
  );
  unique(
    versions.map((v) => v.voice_profile_id),
    "voice_lineage_invalid",
  );
  unique(
    selection.voices.map((v) => v.participant_id),
    "voice_binding_mismatch",
  );
  unique(
    selection.voices.map((v) => v.voice_profile_version_id),
    "voice_binding_mismatch",
  );
  if (selection.voices.length !== 3) reject("voice_binding_missing");
  const result: JsonObject = {};
  for (const participant of ["tully", "gaz", "simon"]) {
    const profile = member(
      profiles,
      (p) => p.participant_identity === participant,
      "voice_binding_missing",
    );
    const bound = member(
      selection.voices,
      (v) => v.participant_id === participant,
      "voice_binding_missing",
    );
    const version = member(
      versions,
      (v) => v.voice_profile_version_id === bound.voice_profile_version_id,
      "voice_binding_missing",
    );
    if (version.voice_profile_id !== profile.voice_profile_id)
      reject("voice_binding_mismatch");
    const fields = asRecord(version.render_fields, "voice fields");
    if (
      fields.provider !== m.provider ||
      !asArray(
        fields.provider_model_compatibility,
        "model compatibility",
      ).includes(m.concrete_model_identity)
    )
      reject("voice_model_incompatible");
    result[participant] = {
      ...fields,
      version: version.version,
      voice_profile_version_id: version.voice_profile_version_id,
    };
  }
  return result;
}

function pronunciationsFor(s: FrozenRender046Sources): {
  canonicals: JsonObject[];
  renderings: JsonObject[];
  current: JsonObject;
} {
  const records = asRecord(s.support.records, "support records");
  const canonicals = objects(records.pronunciations),
    renderings = objects(records.pronunciation_renderings);
  unique(
    canonicals.map((p) => p.pronunciation_id),
    "pronunciation_lineage_ambiguous",
  );
  unique(
    canonicals.map((p) =>
      canonicalJson([p.entity_identity, p.language, p.canonical_version]),
    ),
    "pronunciation_lineage_ambiguous",
  );
  const roots = canonicals.filter(
    (p) => p.supersedes_pronunciation_id === null,
  );
  if (roots.length !== 1 || roots[0]?.canonical_version !== 1)
    reject("pronunciation_lineage_ambiguous");
  for (const p of canonicals) {
    for (const key of ["canonical_text", "entity_identity", "language"])
      if (normalizeString(text(p[key])) !== p[key])
        reject("pronunciation_lineage_ambiguous");
    if (p.ipa !== null && normalizeString(text(p.ipa)) !== p.ipa)
      reject("pronunciation_lineage_ambiguous");
    if (p.supersedes_pronunciation_id === null) continue;
    const previous = member(
      canonicals,
      (c) => c.pronunciation_id === p.supersedes_pronunciation_id,
      "pronunciation_lineage_ambiguous",
    );
    if (
      previous === p ||
      previous.entity_identity !== p.entity_identity ||
      previous.language !== p.language ||
      asInteger(previous.canonical_version, "version") + 1 !==
        p.canonical_version
    )
      reject("pronunciation_lineage_ambiguous");
  }
  const current = member(
    canonicals,
    (p) =>
      !canonicals.some(
        (c) => c.supersedes_pronunciation_id === p.pronunciation_id,
      ),
    "pronunciation_lineage_ambiguous",
  );
  if (
    current.canonical_version !== 2 ||
    current.canonical_text !== "Northbridge" ||
    current.entity_identity !== "entity_northbridge_fc" ||
    current.language !== "en-GB"
  )
    reject("pronunciation_lineage_ambiguous");
  unique(
    renderings.map((r) => r.pronunciation_rendering_id),
    "pronunciation_reference_invalid",
  );
  unique(
    renderings.map((r) =>
      canonicalJson([
        r.pronunciation_id,
        r.provider,
        r.voice_profile_version_id,
        r.version,
      ]),
    ),
    "pronunciation_reference_invalid",
  );
  const voices = objects(records.voice_profile_versions);
  for (const r of renderings) {
    member(
      canonicals,
      (p) => p.pronunciation_id === r.pronunciation_id,
      "pronunciation_reference_invalid",
    );
    member(
      voices,
      (v) => v.voice_profile_version_id === r.voice_profile_version_id,
      "pronunciation_reference_invalid",
    );
  }
  return { canonicals, renderings, current };
}

function requestProjection(record: JsonObject): FrozenRequestProjection {
  // Existing selector is the sole eleven-field/nested selection and grouping implementation.
  const p = selectBaseRequestProjection(record);
  return {
    concrete_model_identity: p.concrete_model_identity,
    adapter_render_contract_version: p.adapter_render_contract_version,
    immutable_voice_profile_version_render_fields:
      p.immutable_voice_profile_version_render_fields,
    speaker_map: p.speaker_map,
    resolved_generation_settings: p.resolved_generation_settings,
    canonical_spoken_text: p.canonical_spoken_text,
    approved_performance_intents: p.approved_performance_intents,
    bounded_render_context: p.bounded_render_context,
    render_facing_persona_or_scene_config:
      p.render_facing_persona_or_scene_config,
    applied_pronunciation_rendering_versions:
      p.applied_pronunciation_rendering_versions,
    named_text_transform_versions: p.named_text_transform_versions,
  };
}

function compute(value: unknown): FrozenPlanData {
  const input = exact(value, ["sources", "selections", "mechanics"]);
  const sources = parseFrozenRender046Sources(input.sources),
    selections = parseSelections(input.selections),
    mechanics = parseMechanics(input.mechanics);
  const { subjects, turns, blocks, anchors } = sourceReferences(sources);
  const intents = objects(sources.direction.performance_intents);
  capability(mechanics, intents, anchors);
  const voiceMap = voicesFor(sources, selections, mechanics);
  const { canonicals, renderings, current } = pronunciationsFor(sources);
  const order = blocks.map((b) => text(b.program_block_id));
  if (
    selections.blocks.length !== 9 ||
    !same(
      selections.blocks.map((b) => b.program_block_id),
      order,
    )
  )
    reject("block_selection_invalid");
  const byId = new Map(turns.map((t) => [text(t.turn_id), t]));
  const resolve = (id: string): JsonObject => {
    const turn = byId.get(id);
    if (!turn) reject("anchor_not_in_bound_script");
    return turn;
  };
  const approvedMentions = [
    ["t03", 62, 73],
    ["t04", 0, 11],
    ["t05", 49, 60],
    ["t06", 59, 70],
    ["t07", 125, 136],
    ["t14", 151, 162],
  ];
  if (selections.mentions.length !== 6)
    reject("pronunciation_mention_set_invalid");
  const applications = selections.mentions.map((mention) => {
    const turn = resolve(mention.turn_id);
    const canonical = member(
      canonicals,
      (p) => p.pronunciation_id === mention.pronunciation_id,
      "pronunciation_reference_invalid",
    );
    const rendering = member(
      renderings,
      (r) =>
        r.pronunciation_rendering_id === mention.pronunciation_rendering_id,
      "pronunciation_reference_invalid",
    );
    return {
      semantic_turn_id: turn.semantic_turn_id,
      start_offset: mention.start_offset,
      end_offset: mention.end_offset,
      pronunciation_id: canonical.pronunciation_id,
      canonical_current_pronunciation_id: current.pronunciation_id,
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
  const projectedIntents = objects(
    performanceDirectionProjection(sources.direction, anchors)
      .performance_intents,
  );
  const semanticBlocks: FrozenSemanticBlock[] = [],
    requests: FrozenPlanData["requests"] = [];
  const allGenerated: string[] = [],
    allIntents: string[] = [];
  for (const selection of selections.blocks) {
    const generated: JsonObject[] = selection.turn_ids.map((id) => {
      const turn = resolve(id),
        participant = text(turn.participant_id);
      const voice = asRecord(voiceMap[participant], "voice binding");
      return {
        ...turn,
        voice_profile_version_id: voice.voice_profile_version_id,
      };
    });
    const participants = new Set(generated.map((t) => t.participant_id));
    if (participants.size < 1 || participants.size > 3)
      reject("unsupported_capability");
    const selectedAnchors = new Set(generated.map((t) => t.semantic_turn_id));
    const includedIntents = intents.filter((intent) =>
      selection.turn_ids.includes(text(intent.scope_ref)),
    );
    const context = {
      recipe_version: selection.context_recipe_version,
      turns: selection.context_turn_ids.map(resolve),
    };
    const applied = applications.filter((app) =>
      selectedAnchors.has(app.semantic_turn_id),
    );
    const record: JsonObject = {
      schema: "resolved-render-request-record/1",
      turns: generated,
      voice_versions: voiceMap,
      intents: projectedIntents.filter((intent) =>
        selectedAnchors.has(intent.scope_ref),
      ),
      context,
      pronunciation_applications: applied,
      concrete_model_identity: mechanics.concrete_model_identity,
      adapter_render_contract_version:
        mechanics.adapter_render_contract_version,
      resolved_generation_settings: mechanics.resolved_generation_settings,
      scene_config: mechanics.scene_config,
      named_text_transform_versions: mechanics.named_text_transform_versions,
      take_index: 0, // Private validator-only value. No take choice leaves this function.
    };
    checkFixtureRequestOwnership(record, { program_block_order: order, turns });
    // Tighten fixture totality to the complete one-block selection (no duplicates, omission or regrouping).
    if (
      generated.some((t) => t.program_block_id !== selection.program_block_id)
    )
      reject("cross_program_block");
    if (
      !same(
        selection.turn_ids,
        turns
          .filter((t) => t.program_block_id === selection.program_block_id)
          .map((t) => t.turn_id),
      )
    )
      reject("block_selection_invalid");
    allGenerated.push(...selection.turn_ids);
    allIntents.push(
      ...includedIntents.map((intent) => text(intent.performance_intent_id)),
    );
    const projection = requestProjection(record),
      base = requestBaseHash(record);
    if (!/^v1:[0-9a-f]{64}$/.test(base)) reject("projection_invalid");
    semanticBlocks.push({
      program_block_id: selection.program_block_id,
      ordered_turn_ids: [...selection.turn_ids],
      speaker_map: generated.map((t) => ({
        turn_id: text(t.turn_id),
        participant_id: text(t.participant_id),
        voice_profile_version_id: text(t.voice_profile_version_id),
      })),
      provider: {
        concrete_model_identity: mechanics.concrete_model_identity,
        provider: mechanics.provider,
        settings: { ...mechanics.resolved_generation_settings },
      },
      context_recipe_version: selection.context_recipe_version,
      resolved_context_refs: {
        turn_ids: [...selection.context_turn_ids],
        context_hash: renderContextHash(context),
      },
      applied_performance_intent_ids: includedIntents.map((intent) =>
        text(intent.performance_intent_id),
      ),
      applied_pronunciation_rendering_ids: [
        ...new Set(applied.map((a) => text(a.pronunciation_rendering_id))),
      ],
      named_text_transform_versions: [
        ...mechanics.named_text_transform_versions,
      ],
      base_request_hash: base,
    });
    requests.push({
      program_block_id: selection.program_block_id,
      projection,
      base_request_hash: base,
    });
  }
  // This check comes after real span/voice/freshness ownership, so malformed applications cannot hide behind a table match.
  if (
    !same(
      applications.map((a) => [
        a.semantic_turn_id,
        a.start_offset,
        a.end_offset,
      ]),
      approvedMentions,
    )
  )
    reject("pronunciation_mention_set_invalid");
  if (
    !same(
      allGenerated,
      turns.map((t) => t.turn_id),
    ) ||
    !same(
      allIntents,
      intents.map((i) => i.performance_intent_id),
    )
  )
    reject("block_selection_invalid");
  const audit: FrozenAuditProjection = {
    package_hash: subjects.package_hash,
    brief_hash: subjects.brief_hash,
    script_hash: subjects.script_hash,
    performance_direction_hash: subjects.performance_direction_hash,
    claims_policy_version: "claims-0.1.2",
    writing_policy_version: "writing-0.2.3",
    performance_policy_version: "performance-render-0.1.4",
    auditor_contract_version: "semantic-auditor-v1",
  };
  const auditFingerprint = fingerprint("semantic_audit", audit);
  const manifest: FrozenSemanticManifest = {
    script_hash: subjects.script_hash,
    performance_direction_hash: subjects.performance_direction_hash,
    audit_gate_fingerprint: auditFingerprint,
    render_spec_version: mechanics.render_policy_version,
    adapter_contract_version: mechanics.adapter_render_contract_version,
    provider_capability_version: mechanics.provider_capability_version,
    show_render_config_version: mechanics.show_render_config_version,
    render_blocks: semanticBlocks,
  };
  if (!same(renderManifestProjection(manifest), manifest))
    reject("projection_invalid");
  const manifestHash = renderManifestHash(manifest);
  const gate = {
    render_manifest_hash: manifestHash,
    audit_input_fingerprint: auditFingerprint,
    render_policy_version: mechanics.render_policy_version,
    gate_set_version: "build2-gates-v1" as const,
  };
  return {
    subjects,
    audit_input_projection: audit,
    audit_input_fingerprint: auditFingerprint,
    semantic_manifest: manifest,
    semantic_manifest_hash: manifestHash,
    requests,
    render_gate_projection: gate,
    render_gate_fingerprint: fingerprint("render", gate),
  };
}
function failure(error: unknown): {
  authority: "none";
  status: "invalid";
  code: StructuralCode;
} {
  const code =
    error instanceof InvalidPlan || error instanceof RequestRejected
      ? error.code
      : error instanceof FrozenInputRejected
        ? "source_shape_invalid"
        : "projection_invalid";
  return { authority: "none", status: "invalid", code };
}
export function inspectFrozenFixture046PlanInputs(value: unknown): Inspection {
  try {
    compute(value);
    return { authority: "none", status: "structurally_valid" };
  } catch (error) {
    return failure(error);
  }
}
export function deriveFrozenFixture046PlanData(value: unknown): Derivation {
  try {
    return { authority: "none", status: "derived", data: compute(value) };
  } catch (error) {
    return failure(error);
  }
}
