// Writing Build 1-2 Fixture-Profile Addendum binding (Hashing v0.1.5 4.4.2, 12.5; addendum D). The addendum is bound in
// the complete prompt manifest and typed row of every role that receives the writer view; the planner does not bind it.
// A policy-map entry alone is insufficient. Pure: the caller supplies the addendum's exact bytes.
import { promptManifestArtifactHash } from "./prompt-manifest.js";
import { rawBytesHash } from "./domains.js";
import { ADDENDUM_COMPONENT, ADDENDUM_VERSION_ID } from "./artifacts.js";
import { ProfileRejected } from "./profile-errors.js";
import { asRecord, type JsonObject } from "./select.js";

export const addendumGovernedRoles = [
  "writer",
  "craft_critic",
  "writer_revision",
  "speech_texture",
] as const;

export interface BoundManifest {
  role: string;
  /** Typed `prompt_manifests` row (component_versions, policy_source_hashes). */
  row: unknown;
  /** Complete payload (`artifacts.canonical_payload`). */
  payload: unknown;
}

/** Returns each role's complete-manifest hash after verifying the addendum binding of the row AND the payload. */
export function verifyAddendumBindings(
  manifests: readonly BoundManifest[],
  policyMap: unknown,
  addendumBytes: Uint8Array,
): Record<string, string> {
  const policies = asRecord(
    asRecord(policyMap, "policy map").policies,
    "policies",
  );
  const entry = policies[ADDENDUM_COMPONENT];
  if (entry === undefined)
    throw new ProfileRejected("addendum_policy_not_in_map");
  const sourceSha = rawBytesHash(addendumBytes);
  const mapped = asRecord(entry, "addendum policy entry");
  if (
    mapped.source_sha256 !== sourceSha ||
    mapped.version_id !== ADDENDUM_VERSION_ID
  )
    throw new ProfileRejected("addendum_source_hash_mismatch");
  const hashes: Record<string, string> = {};
  for (const manifest of manifests) {
    const governed = (addendumGovernedRoles as readonly string[]).includes(
      manifest.role,
    );
    for (const part of [manifest.row, manifest.payload]) {
      const record = asRecord(part, "manifest");
      const versions = asRecord(
        record.component_versions,
        "component_versions",
      );
      const sources = asRecord(
        record.policy_source_hashes,
        "policy_source_hashes",
      );
      const bound =
        Object.hasOwn(versions, ADDENDUM_COMPONENT) ||
        Object.hasOwn(sources, ADDENDUM_COMPONENT);
      if (governed) {
        if (
          !Object.hasOwn(versions, ADDENDUM_COMPONENT) ||
          !Object.hasOwn(sources, ADDENDUM_COMPONENT)
        )
          throw new ProfileRejected("addendum_component_missing");
        if (
          versions[ADDENDUM_COMPONENT] !== ADDENDUM_VERSION_ID ||
          sources[ADDENDUM_COMPONENT] !== sourceSha
        )
          throw new ProfileRejected("addendum_source_hash_mismatch");
      } else if (bound)
        throw new ProfileRejected("addendum_bound_to_ungoverned_role");
    }
    hashes[manifest.role] = promptManifestArtifactHash(manifest.payload);
  }
  return hashes;
}

export type { JsonObject };
