// Bounded synthetic fixture profile `show-config/1` (Hashing v0.1.5 4.7; Contract Trace v0.5.5 Layer B item 6).
// This is NOT a product configuration contract: any other `schema_version` is rejected and production configuration
// hashing stays blocked until an owner defines another schema and a new domain version. Pure; no I/O.
import { governedDomainHash } from "./domains.js";
import { ProfileRejected, requireProfileKeys } from "./profile-errors.js";
import { asRecord } from "./select.js";

export const SHOW_CONFIG_SCHEMA = "show-config/1";
export const showConfigPayloadKeys = [
  "autonomous_operation_policy_version",
  "configured_runtime_seconds",
  "default_episode_mode",
  "default_output_language",
  "default_rundown_template_version_id",
  "name",
  "operator_repair_policy_version",
  "pre_publish_review_policy",
  "pre_publish_review_required",
  "pre_publish_review_timeout_seconds",
  "publication_enabled",
  "show_id",
  "show_version",
  "writing_craft_policy_version",
] as const;
export const showConfigRuntimeKeys = [
  "fixture_override",
  "max",
  "min",
] as const;

/**
 * `show-config-v1` over the complete closed payload. `row` is the stored `show_config_versions` row: its
 * `schema_version`, `show_id` and redundant `pre_publish_review_required` columns must agree with the payload; every
 * other column (ids, version number, parent, creation time, `config_hash`) is excluded.
 */
export function showConfigVersionHash(row: unknown): string {
  const record = asRecord(row, "show config version row");
  if (record.schema_version !== SHOW_CONFIG_SCHEMA)
    throw new ProfileRejected("show_config_schema_unsupported");
  const payload = requireProfileKeys(
    record.canonical_payload,
    showConfigPayloadKeys,
    "show_config_keys_not_closed",
  );
  requireProfileKeys(
    payload.configured_runtime_seconds,
    showConfigRuntimeKeys,
    "show_config_runtime_keys_not_closed",
  );
  if (
    record.pre_publish_review_required !== payload.pre_publish_review_required
  )
    throw new ProfileRejected("show_config_column_payload_conflict");
  if (record.show_id !== payload.show_id)
    throw new ProfileRejected("show_config_show_id_conflict");
  return governedDomainHash("show-config-v1", payload);
}
