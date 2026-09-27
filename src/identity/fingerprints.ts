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
