// Structural validation of an Evidence Package artifact against the ACTIVE governed profile (Evidence Package v0.2.2 5.1, 6, 9, 9.3,
// 10, 10.3, 23; Fixture v0.4.6 evidence_package artifact). The hash is not validation: this module is pure (no database) and rejects
// unknown schema labels, missing/mistyped required fields and malformed arrays instead of defaulting them. Semantic checks against
// persisted rows (units, rights, claims, supports, cursors) live in package.ts. No selection, scoring or eligibility policy is
// implemented or inferred here.
import { evidencePackageHash } from "../identity/artifacts.js";
import { evidencePackageScopeHash } from "../identity/layer-b.js";
import {
  assertJson,
  isJsonObject,
  Rejection,
  requireHex64,
  requireTimestamp,
  requireUuid,
  type Json,
} from "./command.js";

export type Obj = Record<string, Json>;

/** `manifest.schema` and the payload's `schema_version` (Evidence Package 5.1: `evidence-package/2.x`; the active profile uses 2.0). */
export const PACKAGE_SCHEMA_LABELS: readonly string[] = [
  "evidence-package/2.0",
];
/**
 * `artifacts.schema_version` of the evidence_package ROW in the active profile: Fixture v0.4.6 keeps the inherited label
 * `fixture-v0.4.5` on every row carried unchanged (SOURCE_PROVENANCE `schema_version_label_note`); `fixture-v0.4.6` is on exactly six
 * regenerated rows and the evidence package is not one of them. The label is not hashed. It is not inferred from a filename.
 */
export const ARTIFACT_SCHEMA_LABELS: readonly string[] = ["fixture-v0.4.5"];

const PAYLOAD_KEYS = [
  "artifact_id",
  "created_at",
  "frozen_at",
  "id",
  "manifest",
  "package_hash",
  "schema_version",
  "scope_hash",
  "selector_run_id",
];
const MANIFEST_OBJECTS = [
  "scope",
  "availability",
  "selection_provenance",
  "version_refs",
];
const MANIFEST_ARRAYS = [
  "claims",
  "evidence",
  "beats",
  "signals",
  "context_candidates",
  "continuity",
  "silent_inputs",
  "sensitivities",
  "coverage_conditions",
  "source_attribution",
];
const EVIDENCE_TYPES = [
  "fact",
  "quote",
  "observation",
  "analysis",
  "sentiment",
  "texture",
  "rumor",
  "prediction",
  "context",
];
const EXPOSURE_MODES = ["hidden", "claim_only", "paraphrase", "exact_excerpt"];
const CONSUMERS = ["planner", "writer", "auditor"];
const STATUSES = [
  "confirmed",
  "contested",
  "demoted",
  "superseded",
  "expired",
  "tombstoned",
];
const USAGE = ["assertable", "hedged_only", "silent"];
const SUPPORT_KINDS = [
  "evidence",
  "derivation",
  "lore",
  "signal",
  "prediction",
  "continuity",
];
const SUPPORT_ROLES = [
  "supports_value",
  "supports_attribution",
  "qualifies",
  "contradicts",
  "context_only",
];

// Evidence entry fields (Evidence 10 + Fixture v0.4.6): the first list is required on every entry; the second are the profile's
// per-source additions (window/order proof, observation sets, quote carriers); anything else is unknown.
const EVIDENCE_REQUIRED_STRINGS = [
  "acquisition_ref",
  "competition_identity",
  "entity_identity",
  "language",
  "modality",
  "origin",
  "retention_class",
  "rights_policy_version",
  "source_identity",
  "source_item_identity",
  "source_modality",
  "source_role",
];
const EVIDENCE_OPTIONAL = [
  "event_completed_at",
  "market_event_identity",
  "observation_order",
  "observation_set_identity",
  "observation_window",
  "permitted_quote",
  "reasoning_only",
  "source_document_date",
  "source_document_identity",
  "untrusted_injection_specimen",
  "window_identity",
  "window_order",
];
const CLAIM_KEYS = [
  "approved_representation",
  "attribution_requirement",
  "claim_content_hash",
  "claim_id",
  "effective_usage_class",
  "frozen_state",
  "frozen_state_hash",
  "initial_status",
  "initial_usage_class",
  "kind",
  "origin",
  "predicate",
  "reduced_usage_class",
  "state_event_cursor",
  "subject_domain",
  "subject_ref",
  "support_refs",
  "value",
  "value_type",
];
const SUPPORT_REF_KEYS = [
  "claim_support_id",
  "derivation_run_id",
  "evidence_unit_id",
  "external_support_identity",
  "support_hash",
  "support_kind",
  "support_role",
];

export interface SupportRef {
  claim_support_id: string;
  derivation_run_id: string | null;
  evidence_unit_id: string | null;
  external_support_identity: string | null;
  support_hash: string;
  support_kind: string;
  support_role: string;
}
export interface ClaimEntry {
  raw: Obj;
  claim_id: string;
  claim_content_hash: string;
  support_refs: SupportRef[];
}
export interface EvidenceEntry {
  raw: Obj;
  evidence_unit_id: string;
  content_hash: string;
  evidence_type: string;
  rights_version_id: string;
  source_identity: string;
  quote_permission: boolean;
  paraphrase_permission: boolean;
  consumer_exposure: Record<string, string>;
  locator: Obj;
}
export interface ParsedPackage {
  /** The ONE normalized representation: hashed, compared and stored. */
  payload: Obj;
  hash: string;
  manifest: Obj;
  evidence: EvidenceEntry[];
  claims: ClaimEntry[];
}

const fail = (code: string, detail: string): never => {
  throw new Rejection(code, detail);
};
const str = (o: Obj, key: string, where: string, code: string): string => {
  const v = o[key];
  if (typeof v !== "string" || v === "") fail(code, `${where}.${key}`);
  return v as string;
};
const closedKeys = (
  o: Obj,
  required: readonly string[],
  optional: readonly string[],
  where: string,
  code: string,
): void => {
  for (const key of required)
    if (!Object.hasOwn(o, key)) fail(`${code}_missing`, `${where}.${key}`);
  for (const key of Object.keys(o))
    if (!required.includes(key) && !optional.includes(key))
      fail(`${code}_unknown_field`, `${where}.${key}`);
};
const oneOf = (v: Json | undefined, set: readonly string[]): boolean =>
  typeof v === "string" && set.includes(v);

function parseEvidenceEntry(raw: Json, index: number): EvidenceEntry {
  const where = `manifest.evidence[${String(index)}]`;
  if (!isJsonObject(raw)) return fail("package_evidence_shape", where);
  const e = raw;
  closedKeys(
    e,
    [
      ...EVIDENCE_REQUIRED_STRINGS,
      "as_of",
      "consumer_exposure",
      "content_hash",
      "evidence_type",
      "evidence_unit_id",
      "locator",
      "paraphrase_permission",
      "quote_permission",
      "retention_declaration",
      "rights_version_id",
      "speaker_identity",
      "event_identity",
    ],
    EVIDENCE_OPTIONAL,
    where,
    "package_evidence_field",
  );
  const id = requireUuid(e.evidence_unit_id, `${where}.evidence_unit_id`);
  for (const key of EVIDENCE_REQUIRED_STRINGS)
    str(e, key, where, "package_evidence_field_type");
  requireTimestamp(e.as_of, `${where}.as_of`);
  requireHex64(e.content_hash, `${where}.content_hash`);
  const rights = requireUuid(e.rights_version_id, `${where}.rights_version_id`);
  if (!oneOf(e.evidence_type, EVIDENCE_TYPES))
    fail("package_evidence_field_type", `${where}.evidence_type`);
  for (const key of ["quote_permission", "paraphrase_permission"])
    if (typeof e[key] !== "boolean")
      fail("package_evidence_field_type", `${where}.${key}`);
  // nullable by the profile: the speaker of a non-spoken source, the event of durable (non-event) context
  for (const key of ["speaker_identity", "event_identity"])
    if (e[key] !== null && (typeof e[key] !== "string" || e[key] === ""))
      fail("package_evidence_field_type", `${where}.${key}`);
  if (!isJsonObject(e.retention_declaration))
    fail("package_evidence_field_type", `${where}.retention_declaration`);
  const exposure = e.consumer_exposure;
  if (!isJsonObject(exposure))
    return fail("package_evidence_field_type", `${where}.consumer_exposure`);
  if (
    Object.keys(exposure).sort().join() !== [...CONSUMERS].sort().join() ||
    !Object.values(exposure).every((m) => oneOf(m, EXPOSURE_MODES))
  )
    fail("package_evidence_exposure_shape", where);
  const locator = e.locator;
  if (!isJsonObject(locator) || Object.keys(locator).length === 0)
    return fail("package_evidence_field_type", `${where}.locator`);
  if (locator.evidence_unit_id !== undefined && locator.evidence_unit_id !== id)
    fail("package_evidence_locator_unit", where);
  return {
    raw: e,
    evidence_unit_id: id,
    content_hash: e.content_hash as string,
    evidence_type: e.evidence_type as string,
    rights_version_id: rights,
    source_identity: e.source_identity as string,
    quote_permission: e.quote_permission as boolean,
    paraphrase_permission: e.paraphrase_permission as boolean,
    consumer_exposure: exposure as Record<string, string>,
    locator,
  };
}

function parseSupportRef(raw: Json, where: string): SupportRef {
  if (!isJsonObject(raw)) return fail("package_support_ref_shape", where);
  closedKeys(raw, SUPPORT_REF_KEYS, [], where, "package_support_ref");
  requireUuid(raw.claim_support_id, `${where}.claim_support_id`);
  requireHex64(raw.support_hash, `${where}.support_hash`);
  if (!oneOf(raw.support_kind, SUPPORT_KINDS))
    fail("package_support_ref_shape", `${where}.support_kind`);
  if (!oneOf(raw.support_role, SUPPORT_ROLES))
    fail("package_support_ref_shape", `${where}.support_role`);
  for (const key of ["derivation_run_id", "evidence_unit_id"] as const) {
    const v = raw[key];
    if (v !== null) requireUuid(v, `${where}.${key}`);
  }
  const ext = raw.external_support_identity;
  if (ext !== null && (typeof ext !== "string" || ext === ""))
    fail("package_support_ref_shape", `${where}.external_support_identity`);
  const targets = [
    raw.evidence_unit_id,
    raw.derivation_run_id,
    raw.external_support_identity,
  ].filter((t) => t !== null).length;
  if (targets !== 1)
    fail("package_support_ref_shape", `${where}: exactly one target`);
  const kind = raw.support_kind as string;
  const matches =
    kind === "evidence"
      ? raw.evidence_unit_id !== null
      : kind === "derivation"
        ? raw.derivation_run_id !== null
        : raw.external_support_identity !== null;
  if (!matches) fail("package_support_ref_shape", `${where}: kind/target`);
  return raw as unknown as SupportRef;
}

function parseCursor(v: Json | undefined, where: string): void {
  if (v === null) return;
  if (
    !isJsonObject(v) ||
    Object.keys(v).sort().join() !== "claim_state_event_id,event_sequence"
  )
    fail("package_claim_cursor_shape", where);
  const c = v as Obj;
  requireUuid(c.claim_state_event_id, `${where}.claim_state_event_id`);
  const seq = c.event_sequence;
  if (
    typeof seq !== "number" ||
    !Number.isSafeInteger(seq) ||
    seq < 1 ||
    seq > 2147483647
  )
    fail("package_claim_cursor_shape", `${where}.event_sequence`);
}

function parseClaimEntry(raw: Json, index: number): ClaimEntry {
  const where = `manifest.claims[${String(index)}]`;
  if (!isJsonObject(raw)) return fail("package_claim_shape", where);
  const c = raw;
  closedKeys(c, CLAIM_KEYS, [], where, "package_claim_field");
  const id = requireUuid(c.claim_id, `${where}.claim_id`);
  const hash = requireHex64(
    c.claim_content_hash,
    `${where}.claim_content_hash`,
  );
  requireHex64(c.frozen_state_hash, `${where}.frozen_state_hash`);
  for (const key of [
    "approved_representation",
    "kind",
    "origin",
    "predicate",
    "subject_domain",
    "subject_ref",
    "value_type",
  ])
    str(c, key, where, "package_claim_field_type");
  if (!oneOf(c.initial_status, STATUSES) || !oneOf(c.frozen_state, STATUSES))
    fail("package_claim_field_type", `${where} status`);
  for (const key of [
    "initial_usage_class",
    "reduced_usage_class",
    "effective_usage_class",
  ])
    if (!oneOf(c[key], USAGE))
      fail("package_claim_field_type", `${where}.${key}`);
  const attribution = c.attribution_requirement;
  if (!isJsonObject(attribution) || typeof attribution.required !== "boolean")
    fail("package_claim_field_type", `${where}.attribution_requirement`);
  if (
    !isJsonObject(c.value) &&
    !Array.isArray(c.value) &&
    typeof c.value !== "string" &&
    typeof c.value !== "number" &&
    typeof c.value !== "boolean"
  )
    fail("package_claim_field_type", `${where}.value`);
  parseCursor(c.state_event_cursor, `${where}.state_event_cursor`);
  const refs = c.support_refs;
  if (!Array.isArray(refs))
    return fail("package_support_refs_missing", `${where}.support_refs`);
  const support_refs = refs.map((r, i) =>
    parseSupportRef(r, `${where}.support_refs[${String(i)}]`),
  );
  const ids = support_refs.map((r) => r.claim_support_id);
  if (new Set(ids).size !== ids.length)
    fail("package_support_ref_duplicate", where);
  return {
    raw: c,
    claim_id: id,
    claim_content_hash: hash,
    support_refs,
  };
}

/** Pure validation of an artifact payload (manifest-level; no database). Returns the normalized representation. */
export function parsePayload(input: unknown): ParsedPackage {
  const payload = assertJson(input, "canonical_payload");
  if (!isJsonObject(payload)) return fail("package_payload_shape", "payload");
  closedKeys(payload, PAYLOAD_KEYS, [], "payload", "package_field");
  if (!oneOf(payload.schema_version, PACKAGE_SCHEMA_LABELS))
    fail("package_schema_unknown", "payload.schema_version");
  requireUuid(payload.artifact_id, "payload.artifact_id");
  requireUuid(payload.id, "payload.id");
  requireTimestamp(payload.created_at, "payload.created_at");
  requireTimestamp(payload.frozen_at, "payload.frozen_at");
  str(payload, "selector_run_id", "payload", "package_field_type");
  const manifest = payload.manifest;
  if (!isJsonObject(manifest))
    return fail("package_manifest_missing", "manifest");
  closedKeys(
    manifest,
    ["schema", ...MANIFEST_OBJECTS, ...MANIFEST_ARRAYS],
    [],
    "manifest",
    "package_manifest_section",
  );
  if (!oneOf(manifest.schema, PACKAGE_SCHEMA_LABELS))
    fail("package_schema_unknown", "manifest.schema");
  for (const key of MANIFEST_OBJECTS)
    if (!isJsonObject(manifest[key]))
      fail("package_manifest_section_type", `manifest.${key}`);
  for (const key of MANIFEST_ARRAYS)
    if (!Array.isArray(manifest[key]))
      fail("package_manifest_section_type", `manifest.${key}`);
  const hash = evidencePackageHash(payload);
  if (payload.package_hash !== hash)
    fail("package_hash_field_mismatch", "payload.package_hash");
  let scopeHash: string;
  try {
    scopeHash = evidencePackageScopeHash(manifest.scope);
  } catch (error) {
    if (error instanceof TypeError)
      return fail("package_scope_invalid", error.message);
    throw error;
  }
  if (payload.scope_hash !== scopeHash)
    fail("package_scope_hash_mismatch", "payload.scope_hash");
  const evidence = (manifest.evidence as Json[]).map(parseEvidenceEntry);
  const eIds = evidence.map((e) => e.evidence_unit_id);
  if (new Set(eIds).size !== eIds.length)
    fail("package_evidence_duplicate", "manifest.evidence");
  const claims = (manifest.claims as Json[]).map(parseClaimEntry);
  const cIds = claims.map((c) => c.claim_id);
  if (new Set(cIds).size !== cIds.length)
    fail("package_claim_duplicate", "manifest.claims");
  // in-manifest references (no new policy): every referenced claim / unit must be in the package
  const claimSet = new Set(cIds);
  const unitSet = new Set(eIds);
  const claimRef = (v: Json | undefined, where: string): void => {
    if (typeof v !== "string" || !claimSet.has(v))
      fail("package_reference_unresolved", where);
  };
  for (const [i, s] of (manifest.silent_inputs as Json[]).entries()) {
    if (!isJsonObject(s))
      return fail("package_reference_shape", `silent_inputs[${String(i)}]`);
    claimRef(s.claim_id, `silent_inputs[${String(i)}].claim_id`);
    if (!Array.isArray(s.support_refs))
      fail(
        "package_reference_shape",
        `silent_inputs[${String(i)}].support_refs`,
      );
    for (const r of s.support_refs as Json[])
      if (typeof r !== "string" || !unitSet.has(r))
        fail(
          "package_reference_unresolved",
          `silent_inputs[${String(i)}] unit`,
        );
  }
  for (const [i, b] of (manifest.beats as Json[]).entries()) {
    if (!isJsonObject(b) || !Array.isArray(b.member_claim_refs))
      return fail("package_reference_shape", `beats[${String(i)}]`);
    for (const r of b.member_claim_refs)
      claimRef(r, `beats[${String(i)}].member_claim_refs`);
  }
  for (const [i, cc] of (manifest.context_candidates as Json[]).entries()) {
    if (!isJsonObject(cc))
      return fail(
        "package_reference_shape",
        `context_candidates[${String(i)}]`,
      );
    claimRef(cc.claim_id, `context_candidates[${String(i)}].claim_id`);
  }
  return { payload, hash, manifest, evidence, claims };
}

/** The artifact ROW fields that are not part of the hashed manifest. */
export interface PackageArtifactFields {
  artifact_id: string;
  schema_version: string;
  storage_uri: string | null;
  byte_size: number | null;
  created_at: string;
}

export function parseArtifactFields(f: PackageArtifactFields): void {
  requireUuid(f.artifact_id, "artifact_id");
  if (!ARTIFACT_SCHEMA_LABELS.includes(f.schema_version))
    fail("artifact_schema_version_unknown", f.schema_version);
  if (f.storage_uri !== null && typeof f.storage_uri !== "string")
    fail("invalid_storage_uri", "storage_uri");
  if (
    f.byte_size !== null &&
    (!Number.isSafeInteger(f.byte_size) || f.byte_size < 0)
  )
    fail("invalid_byte_size", "byte_size");
  requireTimestamp(f.created_at, "artifact.created_at");
}
