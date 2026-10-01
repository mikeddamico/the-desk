// Knowledge hashes: claim content/frozen state, derivation output, support hashes and fixture support carriers.
// Pure functions over supplied objects. No claim-event reduction happens here (later reducer tranche): the
// frozen-state hash takes an already reduced status and effective usage.
import { canonicalTimestamp } from "./canonical-json.js";
import { evidenceBodyHash, governedDomainHash } from "./domains.js";
import {
  asNonBlankString,
  asRecord,
  requireExactKeys,
  selectKeys,
  type JsonObject,
} from "./select.js";

/** Claims Policy v0.1.2 section 4.4: exactly these six statuses (usage_changed is not a status). */
export const claimStatuses = [
  "confirmed",
  "contested",
  "demoted",
  "superseded",
  "expired",
  "tombstoned",
] as const;
/** Claims Policy v0.1.2 section 7. */
export const usageClasses = ["assertable", "hedged_only", "silent"] as const;

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  what: string,
): T {
  if (
    typeof value !== "string" ||
    !(allowed as readonly string[]).includes(value)
  )
    throw new TypeError(`${what} must be one of ${allowed.join(", ")}`);
  return value as T;
}

const claimContentFields = [
  "claim_kind",
  "origin",
  "subject_domain",
  "subject",
  "predicate",
  "value",
  "initial_status",
  "initial_usage_class",
  "asserted_at",
] as const;

/** Hashing section 12.1 / Claims section 4.4.3: the immutable claim-content projection (no PK, supports, events). */
export function claimContentProjection(claim: unknown): JsonObject {
  const selected = selectKeys(claim, claimContentFields, "claim");
  oneOf(selected.initial_status, claimStatuses, "initial_status");
  oneOf(selected.initial_usage_class, usageClasses, "initial_usage_class");
  asNonBlankString(selected.claim_kind, "claim_kind");
  asNonBlankString(selected.origin, "origin");
  asNonBlankString(selected.subject_domain, "subject_domain");
  asNonBlankString(selected.predicate, "predicate");
  asRecord(selected.subject, "subject");
  if (selected.asserted_at !== null)
    selected.asserted_at = canonicalTimestamp(
      asNonBlankString(selected.asserted_at, "asserted_at"),
    );
  return selected;
}

export function claimContentHash(claim: unknown): string {
  return governedDomainHash("claim-content-v1", claimContentProjection(claim));
}

/** Hashing section 12.1: exactly `{claim_content_hash, state, effective_usage_class}`; no actor/time/reason/cursor. */
export function claimFrozenStateProjection(input: unknown): JsonObject {
  const selected = selectKeys(
    input,
    ["claim_content_hash", "state", "effective_usage_class"],
    "frozen claim state",
  );
  if (
    typeof selected.claim_content_hash !== "string" ||
    !/^[0-9a-f]{64}$/.test(selected.claim_content_hash)
  )
    throw new TypeError("claim_content_hash must be lowercase SHA-256 hex");
  oneOf(selected.state, claimStatuses, "state");
  oneOf(selected.effective_usage_class, usageClasses, "effective_usage_class");
  return selected;
}

export function claimFrozenStateHash(input: unknown): string {
  return governedDomainHash(
    "claim-frozen-state-v1",
    claimFrozenStateProjection(input),
  );
}

/**
 * Hashing section 12.3 / Claims section 12: the complete validated `derivation_runs.output` JSON value.
 * SQL NULL and JSON null are invalid; object, array, string, number or boolean are allowed.
 */
export function derivationOutputHash(output: unknown): string {
  if (output === null || output === undefined)
    throw new TypeError("Derivation output must not be null");
  return governedDomainHash("derivation-output-v1", output);
}

/** Hashing section 12.4: the carrier payload is exactly `{support_kind, projection}` under fixture-support-object-v1. */
export function fixtureSupportObjectHash(carrier: unknown): string {
  const record = requireExactKeys(
    carrier,
    ["support_kind", "projection"],
    "support carrier",
  );
  oneOf(record.support_kind, ["signal", "continuity"], "support_kind");
  asRecord(record.projection, "support carrier projection");
  return governedDomainHash("fixture-support-object-v1", {
    support_kind: record.support_kind,
    projection: record.projection,
  });
}

export type GovernedSupportKind =
  | "evidence"
  | "derivation"
  | "signal"
  | "continuity";

/**
 * Claims section 4.3 / Hashing section 12.4: evidence support hash = referenced evidence body hash; derivation
 * support hash = derivation output hash; signal/continuity support hash = the carrier artifact content hash.
 * Other support kinds have no governed rule here. Kind-to-target agreement in persistence rows is loader work.
 */
export function supportHashFor(
  kind: string,
  sources: {
    evidenceBody?: string | undefined;
    derivationOutput?: unknown;
    carrier?: unknown;
  },
): string {
  switch (kind) {
    case "evidence":
      if (sources.evidenceBody === undefined)
        throw new TypeError("Evidence support requires the evidence body");
      return evidenceBodyHash(sources.evidenceBody);
    case "derivation":
      return derivationOutputHash(sources.derivationOutput);
    case "signal":
    case "continuity":
      return fixtureSupportObjectHash(sources.carrier);
    default:
      throw new TypeError(`No governed support-hash rule for kind: ${kind}`);
  }
}
