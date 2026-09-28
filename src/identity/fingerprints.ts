import { createHash } from "node:crypto";

import { canonicalJson, domainHash } from "./canonical-json.js";

export const stageDomains = {
  claims_writing: "claims-writing-gate-input-v1",
  performance: "performance-gate-input-v1",
  semantic_audit: "audit-input-v1",
  render: "render-gate-input-v1",
  assembly: "assembly-gate-input-v1",
  ready_candidate: "ready-candidate-v1",
} as const;

export type StageName = keyof typeof stageDomains;

const baseRequestFields = [
  "concrete_model_identity",
  "adapter_render_contract_version",
  "immutable_voice_profile_version_render_fields",
  "speaker_map",
  "resolved_generation_settings",
  "canonical_spoken_text",
  "approved_performance_intents",
  "bounded_render_context",
  "render_facing_persona_or_scene_config",
  "applied_pronunciation_rendering_versions",
  "named_text_transform_versions",
] as const;

export function fingerprint(stage: StageName, projection: unknown): string {
  const fields: Record<StageName, readonly string[]> = {
    claims_writing: [
      "package_hash",
      "brief_hash",
      "script_hash",
      "claims_policy_version",
      "writing_policy_version",
      "gate_set_version",
    ],
    performance: [
      "script_hash",
      "performance_direction_hash",
      "performance_policy_version",
      "gate_set_version",
    ],
    semantic_audit: [
      "package_hash",
      "brief_hash",
      "script_hash",
      "performance_direction_hash",
      "claims_policy_version",
      "writing_policy_version",
      "performance_policy_version",
      "auditor_contract_version",
    ],
    render: [
      "render_manifest_hash",
      "audit_input_fingerprint",
      "render_policy_version",
      "gate_set_version",
    ],
    assembly: [
      "selected_take_lineage",
      "assembly_recipe_hash",
      "master_assembly_map_hash",
      "assembly_policy_version",
      "gate_set_version",
    ],
    ready_candidate: [
      "master_artifact_id",
      "master_audio_sha256",
      "assembly_gate_fingerprint",
      "program_run_id",
      "attempt_id",
      "show_config_version_hash",
      "review_gate_version",
      "gate_set_version",
    ],
  };
  if (!Object.hasOwn(fields, stage))
    throw new TypeError("Unknown fingerprint stage");
  const keys = fields[stage];
  exactKeys(projection, keys);
  for (const key of keys) {
    if (key !== "selected_take_lineage") {
      const value = projection[key];
      if (typeof value !== "string" || value.length === 0)
        throw new TypeError(`Invalid projection field: ${key}`);
      if (
        (key.endsWith("_hash") ||
          key.endsWith("_sha256") ||
          key.endsWith("_fingerprint")) &&
        !/^[0-9a-f]{64}$/.test(value)
      )
        throw new TypeError(`Invalid SHA-256: ${key}`);
    }
  }
  if (stage === "assembly") {
    if (!Array.isArray(projection.selected_take_lineage))
      throw new TypeError("Expected selected take lineage array");
    for (const item of projection.selected_take_lineage) {
      exactKeys(item, [
        "render_block_id",
        "take_selection_id",
        "render_take_id",
        "take_index",
        "audio_sha256",
      ]);
      for (const key of [
        "render_block_id",
        "take_selection_id",
        "render_take_id",
      ]) {
        if (typeof item[key] !== "string" || item[key].length === 0)
          throw new TypeError(`Invalid lineage identity: ${key}`);
      }
      if (
        !Number.isSafeInteger(item.take_index) ||
        typeof item.take_index !== "number" ||
        item.take_index < 0
      )
        throw new TypeError("Invalid take index");
      if (
        typeof item.audio_sha256 !== "string" ||
        !/^[0-9a-f]{64}$/.test(item.audio_sha256)
      )
        throw new TypeError("Invalid audio SHA-256");
    }
  }
  return domainHash(stageDomains[stage], projection);
}

export function projectBaseRequest(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    baseRequestFields.map((field) => [field, input[field]]),
  );
}

export function baseRequestHash(input: Record<string, unknown>): string {
  return `v1:${domainlessSha256(canonicalJson(projectBaseRequest(input)))}`;
}

function domainlessSha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function exactKeys(
  value: unknown,
  keys: readonly string[],
): asserts value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new TypeError("Expected projection object");
  const actual = Reflect.ownKeys(value);
  if (
    actual.length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    throw new TypeError("Projection requires exactly its stage-owned keys");
}
