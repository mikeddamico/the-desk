import { domainHash, sha256 } from "./canonical-json.js";
import { normalizeString } from "./canonical-json.js";

/**
 * Hashing, Fingerprints & Text Spans v0.1.4 section 3: the domains used by Build 1-2 artifacts, in table order.
 * This list must equal that table exactly (tested against the Lock document itself).
 */
export const hashingSection3Domains = [
  "evidence-package-v2",
  "showrunner-brief-v1",
  "writer-view-v1",
  "writer-context-manifest-v1",
  "script-v2",
  "writing-craft-review-v1",
  "performance-direction-v1",
  "audit-input-v1",
  "render-manifest-v1",
  "assembly-recipe-v1",
  "master-assembly-map-v1",
  "show-config-v1",
  "claims-writing-gate-input-v1",
  "performance-gate-input-v1",
  "render-gate-input-v1",
  "assembly-gate-input-v1",
  "ready-candidate-v1",
  "claim-content-v1",
  "claim-frozen-state-v1",
  "derivation-output-v1",
  "fixture-support-object-v1",
  "prompt-manifest-artifact-v1",
  "semantic-audit-result-v1",
  "mechanical-validation-result-v1",
  "fixture-revalidation-snapshot-v1",
  "fixture-revalidation-result-v1",
] as const;

/**
 * Governed domains that are NOT rows of the section 3 table:
 * - `model-semantic-input-v1`: Hashing section 11 (retained three-field projection);
 * - the three Layer B domains: Contract Trace v0.5.4 section 9 (bounded additive FIXTURE decisions, not product policy).
 */
export const supplementalGovernedDomains = [
  "model-semantic-input-v1",
  "evidence-package-scope-v1",
  "render-context-v1",
  "performance-direction-correction-input-v1",
] as const;

export type Section3Domain = (typeof hashingSection3Domains)[number];
export type SupplementalDomain = (typeof supplementalGovernedDomains)[number];
export type GovernedDomain = Section3Domain | SupplementalDomain;

const governed: ReadonlySet<string> = new Set<string>([
  ...hashingSection3Domains,
  ...supplementalGovernedDomains,
]);

export function isGovernedDomain(domain: string): domain is GovernedDomain {
  return governed.has(domain);
}

/** `sha256(domain + LF + canonical_json(projection))` for a governed domain; the low-level `domainHash` is unchanged. */
export function governedDomainHash(
  domain: GovernedDomain,
  projection: unknown,
): string {
  if (!isGovernedDomain(domain))
    throw new TypeError(`Unregistered hash domain: ${String(domain)}`);
  return domainHash(domain, projection);
}

/** Raw-byte exception (Hashing section 1, 12.2): evidence body = NFC UTF-8 bytes, no quotes/domain/LF/trim. */
export function evidenceBodyHash(body: string): string {
  return sha256(Buffer.from(normalizeString(body), "utf8"));
}

/** Raw lowercase SHA-256 of exact bytes (rendered request bytes, audio bytes, serialized writer data bytes). */
export function rawBytesHash(bytes: Uint8Array): string {
  return sha256(bytes);
}
