// TTS base-request projection (Hashing v0.1.5 section 7.1, Performance & Render v0.1.4 sections 23-23.1).
// Pure: selects exactly the eleven render-affecting fields from a resolved request record. Storage PKs, status
// flags, QA/admin labels, measurements, timestamps, redundant hashes, output/cost/reservation identities and
// `take_index` are never read. The record shape `resolved-render-request-record/1` is the fixture's input format
// (shipped in base_request_hash_conformance.json); it is fixture-scoped input, not a product contract.
import { normalizeString } from "./canonical-json.js";
import { baseRequestHash } from "./fingerprints.js";
import {
  asArray,
  asInteger,
  asNonBlankString,
  asRecord,
  asString,
  compareStrings,
  isRecord,
  semanticLabel,
  selectKeys,
  type JsonObject,
} from "./select.js";
import { canonicalJson } from "./canonical-json.js";
import { ProfileRejected } from "./profile-errors.js";

const generationKeys = [
  "temperature",
  "format",
  "sample_rate_hz",
  "channels",
] as const;
const intentFields = [
  "scope_type",
  "scope_ref",
  "intent_type",
  "value",
  "strength",
  "timing_anchor",
] as const;
const voiceFields = [
  "version",
  "provider",
  "provider_voice_id",
  "provider_model_compatibility",
  "render_facing_design",
  "request_side_voice_controls",
] as const;

/** Section 7.1: the six-field voice identity; compatibility is a unique code-point-sorted list. */
export function voiceRenderIdentity(voice: unknown): JsonObject {
  const selected = selectKeys(voice, voiceFields, "voice version");
  // Normalize and validate each string FIRST, then deduplicate and sort by Unicode code point, so equivalent NFC/NFD
  // spellings collapse to one governed entry (Hashing 1: strings are NFC before any identity decision).
  const compatibility = asArray(
    selected.provider_model_compatibility,
    "provider_model_compatibility",
  ).map((model) =>
    normalizeString(asNonBlankString(model, "provider model identity")),
  );
  selected.provider_model_compatibility = Array.from(
    new Set(compatibility),
  ).sort(compareStrings);
  asInteger(selected.version, "voice version");
  return selected;
}

function resolvedSettings(record: JsonObject): JsonObject {
  // P&R 23/24: defaults are resolved BEFORE hashing, so a caller that omits a default and one that supplies it hash alike.
  if (Object.hasOwn(record, "resolved_generation_settings"))
    return selectKeys(
      record.resolved_generation_settings,
      generationKeys,
      "resolved_generation_settings",
    );
  const merged: JsonObject = {
    ...asRecord(record.generation_defaults, "generation_defaults"),
    ...(Object.hasOwn(record, "generation_overrides")
      ? asRecord(record.generation_overrides, "generation_overrides")
      : {}),
  };
  return selectKeys(merged, generationKeys, "resolved generation settings");
}

function turnProjection(turn: unknown, what: string): JsonObject {
  const selected = selectKeys(
    turn,
    ["semantic_turn_id", "participant_id", "spoken_text"],
    what,
  );
  selected.spoken_text = normalizeString(
    asString(selected.spoken_text, `${what}.spoken_text`),
  );
  return selected;
}

/**
 * Voice-reference resolver (Hashing v0.1.5 7.1). The bound voice-version map is keyed by participant and each entry
 * carries its `voice_profile_version_id`; a reference resolves to the one entry whose id equals it. Zero matches and more
 * than one match are rejected; a reference is never resolved by UUID order, position or guessing.
 */
export function resolveVoiceReference(
  voiceVersions: JsonObject,
  reference: unknown,
): string {
  const hits = Object.keys(voiceVersions).filter((participant) => {
    const entry = voiceVersions[participant];
    return isRecord(entry) && entry.voice_profile_version_id === reference;
  });
  if (hits.length === 0)
    throw new ProfileRejected("unresolved_voice_reference", String(reference));
  const [only, ...rest] = hits;
  if (only === undefined || rest.length > 0)
    throw new ProfileRejected("ambiguous_voice_reference", String(reference));
  return only;
}

/** Hashing section 7.1: the eleven fields with their bounded nested shapes. */
export function selectBaseRequestProjection(recordInput: unknown): JsonObject {
  const record = asRecord(recordInput, "resolved request record");
  const turns = asArray(record.turns, "turns").map((t) =>
    asRecord(t, "generated turn"),
  );
  const voiceVersions = asRecord(record.voice_versions, "voice_versions");
  // Participant labels are looked up in their canonical (NFC) spelling; two keys that collapse are ambiguous.
  const voiceByLabel = new Map<string, unknown>();
  for (const [key, entry] of Object.entries(voiceVersions)) {
    const label = normalizeString(key);
    if (voiceByLabel.has(label))
      throw new ProfileRejected("duplicate_voice_participant", label);
    voiceByLabel.set(label, entry);
  }
  const voiceFor = (participant: string): JsonObject => {
    const label = normalizeString(participant);
    if (!voiceByLabel.has(label))
      throw new ProfileRejected("voice_binding_missing", label);
    return asRecord(voiceByLabel.get(label), "voice version");
  };

  const voices: JsonObject = {};
  for (const turn of turns) {
    const participant = semanticLabel(turn.participant_id, "participant_id");
    voices[participant] ??= voiceRenderIdentity(voiceFor(participant));
  }

  // Turn anchors are labels: equivalent spellings are one identity; two different spellings of it are rejected.
  const order = new Map<string, number>();
  const rawAnchors = new Map<string, string>();
  turns.forEach((turn, index) => {
    const raw = String(turn.semantic_turn_id);
    const anchor = normalizeString(raw);
    const seen = rawAnchors.get(anchor);
    if (seen !== undefined && seen !== raw)
      throw new ProfileRejected("duplicate_turn_anchor", anchor);
    rawAnchors.set(anchor, raw);
    order.set(anchor, index);
  });
  const rawApplications = Object.hasOwn(record, "pronunciation_applications")
    ? asArray(record.pronunciation_applications, "pronunciation_applications")
    : [];
  // Structural domain (Hashing v0.1.5 7.1): outside it the function rejects instead of hashing.
  const parsed = rawApplications.map((value) => {
    const application = asRecord(value, "pronunciation application");
    const anchor = semanticLabel(
      application.semantic_turn_id,
      "application turn",
    );
    const position = order.get(anchor);
    if (position === undefined)
      throw new ProfileRejected(
        "pronunciation_application_turn_unresolved",
        anchor,
      );
    const participant = semanticLabel(
      asRecord(turns[position], "turn").participant_id,
      "participant_id",
    );
    // Emitted fields: the applied participant's six-field voice identity.
    const identity: JsonObject = {
      entity_identity: application.entity_identity,
      canonical_text: application.canonical_text,
      canonical_version: application.canonical_version,
      language: application.language,
      ipa: application.ipa ?? null,
      provider: application.provider,
      participant_id: participant,
      voice_render_identity: voices[participant],
      rendering_version: application.rendering_version,
      render_text: application.render_text,
    };
    // Grouping key (never emitted): the emitted fields plus the RENDERING's own resolved voice identity.
    const ownVoice = voiceRenderIdentity(
      voiceVersions[
        resolveVoiceReference(
          voiceVersions,
          application.voice_profile_version_id,
        )
      ],
    );
    return {
      position,
      start: asInteger(application.start_offset, "start_offset"),
      end: asInteger(application.end_offset, "end_offset"),
      anchor,
      identity,
      groupKey: canonicalJson({
        identity,
        rendering_voice_render_identity: ownVoice,
      }),
    };
  });
  const spans = new Set<string>();
  for (const application of parsed) {
    const span = `${String(application.position)}:${String(application.start)}:${String(application.end)}`;
    if (spans.has(span))
      throw new ProfileRejected("duplicate_pronunciation_application", span);
    spans.add(span);
  }
  // Order: generated-turn position, start, end only. Never a UUID and never the input order.
  parsed.sort(
    (a, b) => a.position - b.position || a.start - b.start || a.end - b.end,
  );
  const entries = new Map<
    string,
    JsonObject & { applications: JsonObject[] }
  >();
  const sequence: string[] = [];
  for (const application of parsed) {
    let entry = entries.get(application.groupKey);
    if (!entry) {
      entry = { ...application.identity, applications: [] };
      entries.set(application.groupKey, entry);
      sequence.push(application.groupKey);
    }
    entry.applications.push({
      semantic_turn_id: application.anchor,
      start_offset: application.start,
      end_offset: application.end,
    });
  }

  const context = asRecord(record.context, "context");
  const scene = selectKeys(
    record.scene_config,
    ["scene_version", "description"],
    "scene_config",
  );
  return {
    concrete_model_identity: asNonBlankString(
      record.concrete_model_identity,
      "concrete_model_identity",
    ),
    adapter_render_contract_version: asNonBlankString(
      record.adapter_render_contract_version,
      "adapter_render_contract_version",
    ),
    immutable_voice_profile_version_render_fields: voices,
    speaker_map: turns.map((turn) => ({
      semantic_turn_id: turn.semantic_turn_id,
      participant_id: turn.participant_id,
      voice_version: voiceFor(
        semanticLabel(turn.participant_id, "participant_id"),
      ).version,
    })),
    resolved_generation_settings: resolvedSettings(record),
    canonical_spoken_text: turns.map((turn) =>
      turnProjection(turn, "generated turn"),
    ),
    approved_performance_intents: asArray(record.intents, "intents").map(
      (intent) => selectKeys(intent, intentFields, "performance intent"),
    ),
    bounded_render_context: {
      recipe_version: asNonBlankString(
        context.recipe_version,
        "context recipe_version",
      ),
      turns: asArray(context.turns, "context turns").map((turn) =>
        turnProjection(turn, "context turn"),
      ),
    },
    render_facing_persona_or_scene_config: scene,
    applied_pronunciation_rendering_versions: sequence.map((key) => {
      const entry = entries.get(key);
      if (!entry) throw new TypeError("Missing pronunciation entry");
      return entry;
    }),
    named_text_transform_versions: asArray(
      record.named_text_transform_versions,
      "named_text_transform_versions",
    ).map((version) => asNonBlankString(version, "transform version")),
  };
}

/** `v1:` + raw SHA-256 of the canonical projection, via the existing `baseRequestHash`. */
export function requestBaseHash(record: unknown): string {
  return baseRequestHash(selectBaseRequestProjection(record));
}
