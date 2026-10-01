// Complete prompt-manifest artifact hash (Hashing section 12.5) and model semantic-input identity (section 11).
import { canonicalJson } from "./canonical-json.js";
import { governedDomainHash } from "./domains.js";
import {
  asRecord,
  requireExactKeys,
  selectKeys,
  type JsonObject,
} from "./select.js";

/** Hashing section 12.5: the sixteen fields of the complete rights-safe manifest payload. */
export const promptManifestFields = [
  "schema_version",
  "purpose",
  "component_versions",
  "template_version",
  "policy_source_hashes",
  "ordered_input_artifacts",
  "ordered_input_evidence",
  "ordered_input_claims",
  "exposure_instructions",
  "non_source_text",
  "provider",
  "model_identifier",
  "settings",
  "rendered_request_hash",
  "rendered_request_ref",
  "retention",
] as const;

/**
 * `sha256("prompt-manifest-artifact-v1" LF canonical_json(canonical_payload))`. EVERY field and nested value of the
 * payload participates (no hidden tail): this is a hash FUNCTION, so it deliberately accepts a payload of any shape.
 * The outer artifact/storage envelope is never an input. Use {@link assertCompletePromptManifestPayload} for acceptance.
 */
export function promptManifestArtifactHash(canonicalPayload: unknown): string {
  return governedDomainHash(
    "prompt-manifest-artifact-v1",
    asRecord(canonicalPayload, "prompt manifest payload"),
  );
}

/** Acceptance check: exactly the sixteen governed fields (rejects missing fields and hidden tails). */
export function assertCompletePromptManifestPayload(payload: unknown): void {
  requireExactKeys(payload, promptManifestFields, "prompt manifest payload");
}

/** Hashing section 11: exactly the three named manifest fields; anything missing makes the identity not computable. */
export function modelSemanticInputProjection(manifest: unknown): JsonObject {
  return selectKeys(
    manifest,
    ["component_versions", "policy_source_hashes", "rendered_request_hash"],
    "prompt manifest",
  );
}

export function modelSemanticInputHash(manifest: unknown): string {
  return governedDomainHash(
    "model-semantic-input-v1",
    modelSemanticInputProjection(manifest),
  );
}

/** Hashing section 12.5: the typed relational fields must equal their payload fields (canonical JSON equality). */
export function reconcileTypedManifestFields(
  typedRow: unknown,
  payload: unknown,
): void {
  const typed = modelSemanticInputProjection(typedRow);
  const complete = modelSemanticInputProjection(payload);
  for (const key of Object.keys(typed))
    if (canonicalJson(typed[key]) !== canonicalJson(complete[key]))
      throw new TypeError(
        `Typed prompt-manifest field differs from payload: ${key}`,
      );
}
