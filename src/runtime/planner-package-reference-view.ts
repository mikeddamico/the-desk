// G1-V0: the accepted, unwired reference-only projection of an actual package payload.
// It proves observation/structural binding, never freeze authenticity, current rights or planner authority.
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import { canonicalJson } from "../identity/canonical-json.js";
import { isJsonObject, Rejection, type Json } from "./command.js";
import {
  parsePayload,
  type ParsedPackage,
  type SupportRef,
} from "./package-profile.js";

export const PROFILE = "planner-package-reference-view/1";

export type PlannerPackageReferenceError =
  | "input_type_invalid"
  | "input_text_empty"
  | "input_resource_limit"
  | "input_unicode_invalid"
  | "input_json_invalid"
  | "input_semantic_json_invalid"
  | "input_text_noncanonical"
  | "parser_rejected"
  | "profile_array_limit"
  | "profile_reference_limit"
  | "profile_beat_shape"
  | "profile_beat_field"
  | "profile_external_ref_unsupported"
  | "profile_beat_duplicate"
  | "profile_member_duplicate"
  | "profile_support_unresolved"
  | "profile_support_hash_mismatch"
  | "profile_hidden_support";

const parserCodes = [
  "invalid_json",
  "invalid_uuid",
  "invalid_hash",
  "invalid_timestamp",
  "timestamp_precision",
  "package_payload_shape",
  "package_field_missing",
  "package_field_unknown_field",
  "package_field_type",
  "package_schema_unknown",
  "package_manifest_missing",
  "package_manifest_section_missing",
  "package_manifest_section_unknown_field",
  "package_manifest_section_type",
  "package_hash_field_mismatch",
  "package_scope_invalid",
  "package_scope_hash_mismatch",
  "package_evidence_shape",
  "package_evidence_field_missing",
  "package_evidence_field_unknown_field",
  "package_evidence_field_type",
  "package_evidence_exposure_shape",
  "package_evidence_locator_unit",
  "package_evidence_duplicate",
  "package_claim_shape",
  "package_claim_field_missing",
  "package_claim_field_unknown_field",
  "package_claim_field_type",
  "package_claim_cursor_shape",
  "package_support_refs_missing",
  "package_support_ref_missing",
  "package_support_ref_unknown_field",
  "package_support_ref_shape",
  "package_support_ref_duplicate",
  "package_claim_duplicate",
  "package_reference_shape",
  "package_reference_unresolved",
] as const;
export type PlannerPackageParserCode = (typeof parserCodes)[number];
const states = [
  "confirmed",
  "contested",
  "demoted",
  "superseded",
  "expired",
  "tombstoned",
] as const;
const usages = ["assertable", "hedged_only", "silent"] as const;
const kinds = [
  "evidence",
  "derivation",
  "lore",
  "signal",
  "prediction",
  "continuity",
] as const;
const roles = [
  "supports_value",
  "supports_attribution",
  "qualifies",
  "contradicts",
  "context_only",
] as const;
const exposures = ["claim_only", "paraphrase", "exact_excerpt"] as const;

export interface PlannerPackageReferenceCursor {
  readonly claim_state_event_id: string;
  readonly event_sequence: number;
}
export interface PlannerPackageReferenceSupport {
  readonly claim_support_id: string;
  readonly derivation_run_id: string | null;
  readonly evidence_unit_id: string | null;
  readonly external_support_identity: string | null;
  readonly support_hash: string;
  readonly support_kind: (typeof kinds)[number];
  readonly support_role: (typeof roles)[number];
  readonly resolution: "package_evidence" | "external_unverified";
}
export interface PlannerPackageReferenceClaim {
  readonly claim_id: string;
  readonly claim_content_hash: string;
  readonly frozen_state_hash: string;
  readonly frozen_state: (typeof states)[number];
  readonly effective_usage_class: (typeof usages)[number];
  readonly state_event_cursor: PlannerPackageReferenceCursor | null;
  readonly support_refs: readonly PlannerPackageReferenceSupport[];
}
export interface PlannerPackageReferenceEvidence {
  readonly evidence_unit_id: string;
  readonly content_hash: string;
  readonly rights_version_id: string;
  readonly planner_exposure: (typeof exposures)[number];
}
export interface PlannerPackageReferenceBeat {
  readonly beat_id: string;
  readonly member_claim_refs: readonly string[];
}
export interface PlannerPackageReferenceView {
  readonly schema: typeof PROFILE;
  readonly materialization: "reference_only";
  readonly package_hash: string;
  readonly scope_hash: string;
  readonly claims: readonly PlannerPackageReferenceClaim[];
  readonly evidence: readonly PlannerPackageReferenceEvidence[];
  readonly beats: readonly PlannerPackageReferenceBeat[];
}
export interface PlannerPackageReferenceObservation {
  readonly source_text_utf8_bytes: string;
  readonly source_text_sha256: string;
}
export interface PlannerPackageReferenceRejection {
  readonly kind: "rejected";
  readonly profile: typeof PROFILE;
  readonly code: PlannerPackageReferenceError;
  readonly field: string;
  readonly parser_code: PlannerPackageParserCode | null;
}
export type PlannerPackageReferenceResult =
  | PlannerPackageReferenceRejection
  | {
      readonly kind: "projected";
      readonly profile: typeof PROFILE;
      readonly observation: PlannerPackageReferenceObservation;
      readonly view: PlannerPackageReferenceView;
      readonly canonical_json: string;
      readonly view_sha256: string;
    };

// Only selected-realm capture, not a hostile-JS sandbox. Imported functions retain their own live dependencies.
const parseJson: (text: string) => unknown = JSON.parse;
const JsonSyntaxError = SyntaxError;
const byteLength = Buffer.byteLength.bind(Buffer);
const MAX_BYTES = 1048576;
const MAX_NODES = 16384;
const MAX_DEPTH = 32;
const beatKeys = [
  "beat_id",
  "candidate_selection_score",
  "label",
  "member_claim_refs",
];
const beatId = /^[A-Za-z0-9_-]+$/;
const externalId =
  /^artifact:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function reject(
  code: PlannerPackageReferenceError,
  field = "input",
  parser_code: PlannerPackageParserCode | null = null,
): PlannerPackageReferenceRejection {
  return Object.freeze({
    kind: "rejected",
    profile: PROFILE,
    code,
    field,
    parser_code,
  });
}
function unpaired(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) return true;
  }
  return false;
}
function lexicalDepthWithinBound(text: string): boolean {
  let quoted = false,
    escaped = false,
    depth = 0;
  for (const c of text) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === "{" || c === "[") {
      if (++depth > MAX_DEPTH) return false;
    } else if (c === "}" || c === "]") depth = Math.max(0, depth - 1);
  }
  return true;
}
function container(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}
function graphWithinBound(value: unknown): boolean {
  let nodes = 0;
  function visit(v: unknown, depth: number): boolean {
    if (++nodes > MAX_NODES) return false;
    if (!container(v)) return true;
    if (depth > MAX_DEPTH) return false;
    if (Array.isArray(v)) {
      for (const child of v)
        if (!visit(child, container(child) ? depth + 1 : depth)) return false;
    } else {
      for (const [, child] of Object.entries(v)) {
        if (
          ++nodes > MAX_NODES ||
          !visit(child, container(child) ? depth + 1 : depth)
        )
          return false;
      }
    }
    return true;
  }
  return visit(value, container(value) ? 1 : 0);
}
// The same code-point ordering as the pinned serializer, applied only to owned JSON keys.
function codePointOrder(a: string, b: string): number {
  const left = Array.from(a),
    right = Array.from(b);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const x = left[i]?.codePointAt(0),
      y = right[i]?.codePointAt(0);
    if (x === undefined || y === undefined)
      throw new TypeError("owned key ordering invariant");
    if (x !== y) return x - y;
  }
  return left.length - right.length;
}
function semanticWithinProfile(value: unknown): boolean {
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number")
    return Number.isSafeInteger(value) && !Object.is(value, -0);
  if (typeof value === "string") return !unpaired(value);
  if (Array.isArray(value)) return value.every(semanticWithinProfile);
  if (!isJsonObject(value)) throw new TypeError("native JSON graph invariant");
  const normalized = new Map<string, unknown>();
  for (const [key, child] of Object.entries(value)) {
    if (unpaired(key)) return false;
    const n = key.normalize("NFC");
    if (normalized.has(n)) return false;
    normalized.set(n, child);
  }
  for (const [, child] of [...normalized.entries()].sort(([a], [b]) =>
    codePointOrder(a, b),
  )) {
    if (!semanticWithinProfile(child)) return false;
  }
  return true;
}
function text(value: Json | undefined): string {
  if (typeof value !== "string") throw new TypeError("parsed string invariant");
  return value;
}
function record(value: Json | undefined): Record<string, Json> {
  if (!isJsonObject(value)) throw new TypeError("parsed object invariant");
  return value;
}
function array(value: Json | undefined): Json[] {
  if (!Array.isArray(value)) throw new TypeError("parsed array invariant");
  return value;
}
function oneOf<T extends readonly string[]>(
  value: Json | undefined,
  values: T,
): T[number] {
  const found = values.find((v) => v === value);
  if (found === undefined) throw new TypeError("parsed enum invariant");
  return found;
}
function frozen<T>(value: T): T {
  if (container(value)) {
    for (const child of Object.values(value)) frozen(child);
    Object.freeze(value);
  }
  return value;
}
function cursor(value: Json | undefined): PlannerPackageReferenceCursor | null {
  if (value === null) return null;
  const c = record(value),
    seq = c.event_sequence;
  if (typeof seq !== "number") throw new TypeError("parsed cursor invariant");
  return {
    claim_state_event_id: text(c.claim_state_event_id),
    event_sequence: seq,
  };
}
function support(r: SupportRef): PlannerPackageReferenceSupport {
  return {
    claim_support_id: r.claim_support_id,
    derivation_run_id: r.derivation_run_id,
    evidence_unit_id: r.evidence_unit_id,
    external_support_identity: r.external_support_identity,
    support_hash: r.support_hash,
    support_kind: oneOf(r.support_kind, kinds),
    support_role: oneOf(r.support_role, roles),
    resolution:
      r.support_kind === "evidence"
        ? "package_evidence"
        : "external_unverified",
  };
}
function profile(
  parsed: ParsedPackage,
): PlannerPackageReferenceRejection | null {
  const beats = array(parsed.manifest.beats);
  for (const [name, items] of [
    ["evidence", parsed.evidence],
    ["claims", parsed.claims],
    ["beats", beats],
  ] as const) {
    if (items.length > 256)
      return reject("profile_array_limit", `package.manifest.${name}`);
  }
  for (const [i, c] of parsed.claims.entries()) {
    if (c.support_refs.length > 256)
      return reject(
        "profile_array_limit",
        `package.manifest.claims[${String(i)}].support_refs`,
      );
  }
  for (const [i, b] of beats.entries()) {
    if (array(record(b).member_claim_refs).length > 256)
      return reject(
        "profile_array_limit",
        `package.manifest.beats[${String(i)}].member_claim_refs`,
      );
  }
  let refs = 0;
  for (const [i, c] of parsed.claims.entries()) {
    refs += c.support_refs.length;
    if (refs > 4096)
      return reject(
        "profile_reference_limit",
        `package.manifest.claims[${String(i)}].support_refs`,
      );
  }
  for (const [i, b] of beats.entries()) {
    refs += array(record(b).member_claim_refs).length;
    if (refs > 4096)
      return reject(
        "profile_reference_limit",
        `package.manifest.beats[${String(i)}].member_claim_refs`,
      );
  }
  for (const [i, b] of beats.entries()) {
    const row = record(b),
      where = `package.manifest.beats[${String(i)}]`;
    if (
      Object.keys(row).length !== 4 ||
      !beatKeys.every((k) => Object.hasOwn(row, k))
    )
      return reject("profile_beat_shape", where);
    const id = row.beat_id;
    if (
      typeof id !== "string" ||
      id.length < 1 ||
      id.length > 64 ||
      !beatId.test(id)
    )
      return reject("profile_beat_field", `${where}.beat_id`);
    for (const [key, max] of [
      ["candidate_selection_score", 64],
      ["label", 256],
    ] as const) {
      const v = row[key];
      if (
        typeof v !== "string" ||
        v.length < 1 ||
        v.length > max ||
        v.normalize("NFC") !== v ||
        v.trim().length === 0
      )
        return reject("profile_beat_field", `${where}.${key}`);
    }
  }
  for (const [i, c] of parsed.claims.entries()) {
    for (const [j, r] of c.support_refs.entries()) {
      if (
        ["lore", "signal", "prediction", "continuity"].includes(
          r.support_kind,
        ) &&
        (r.external_support_identity === null ||
          !externalId.test(r.external_support_identity))
      )
        return reject(
          "profile_external_ref_unsupported",
          `package.manifest.claims[${String(i)}].support_refs[${String(j)}].external_support_identity`,
        );
    }
  }
  const ids = new Set<string>();
  for (const [i, b] of beats.entries()) {
    const row = record(b),
      id = text(row.beat_id);
    if (ids.has(id))
      return reject(
        "profile_beat_duplicate",
        `package.manifest.beats[${String(i)}].beat_id`,
      );
    ids.add(id);
  }
  for (const [i, b] of beats.entries()) {
    const ids = new Set<string>();
    for (const [j, m] of array(record(b).member_claim_refs).entries()) {
      const id = text(m);
      if (ids.has(id))
        return reject(
          "profile_member_duplicate",
          `package.manifest.beats[${String(i)}].member_claim_refs[${String(j)}]`,
        );
      ids.add(id);
    }
  }
  const evidence = new Map(parsed.evidence.map((e) => [e.evidence_unit_id, e]));
  for (const [i, c] of parsed.claims.entries()) {
    for (const [j, r] of c.support_refs.entries()) {
      if (r.support_kind !== "evidence") continue;
      const target =
        r.evidence_unit_id === null
          ? undefined
          : evidence.get(r.evidence_unit_id);
      const where = `package.manifest.claims[${String(i)}].support_refs[${String(j)}]`;
      if (target === undefined)
        return reject(
          "profile_support_unresolved",
          `${where}.evidence_unit_id`,
        );
      if (target.content_hash !== r.support_hash)
        return reject("profile_support_hash_mismatch", `${where}.support_hash`);
      if (target.consumer_exposure.planner === "hidden")
        return reject("profile_hidden_support", `${where}.evidence_unit_id`);
    }
  }
  return null;
}

export function projectPlannerPackageReferenceView(
  input: unknown,
): PlannerPackageReferenceResult {
  if (typeof input !== "string") return reject("input_type_invalid");
  if (input.length === 0) return reject("input_text_empty");
  if (input.length > MAX_BYTES) return reject("input_resource_limit");
  if (unpaired(input)) return reject("input_unicode_invalid");
  const bytes = byteLength(input, "utf8");
  if (bytes > MAX_BYTES || !lexicalDepthWithinBound(input))
    return reject("input_resource_limit");
  let parsed: unknown;
  try {
    parsed = parseJson(input);
  } catch (error) {
    if (error instanceof JsonSyntaxError) return reject("input_json_invalid");
    throw error;
  }
  if (!graphWithinBound(parsed)) return reject("input_resource_limit");
  if (!semanticWithinProfile(parsed))
    return reject("input_semantic_json_invalid");
  if (canonicalJson(parsed) !== input) return reject("input_text_noncanonical");
  let pkg: ParsedPackage;
  try {
    pkg = parsePayload(parsed);
  } catch (error) {
    if (!(error instanceof Rejection)) throw error;
    const code = parserCodes.find((c) => c === error.code);
    if (code === undefined) throw error;
    return reject("parser_rejected", "package", code);
  }
  const refusal = profile(pkg);
  if (refusal !== null) return refusal;
  const view: PlannerPackageReferenceView = {
    schema: PROFILE,
    materialization: "reference_only",
    package_hash: pkg.hash,
    scope_hash: text(pkg.payload.scope_hash),
    claims: pkg.claims.map((c) => ({
      claim_id: c.claim_id,
      claim_content_hash: c.claim_content_hash,
      frozen_state_hash: text(c.raw.frozen_state_hash),
      frozen_state: oneOf(c.raw.frozen_state, states),
      effective_usage_class: oneOf(c.raw.effective_usage_class, usages),
      state_event_cursor: cursor(c.raw.state_event_cursor),
      support_refs: c.support_refs.map(support),
    })),
    evidence: pkg.evidence
      .filter((e) => e.consumer_exposure.planner !== "hidden")
      .map((e) => ({
        evidence_unit_id: e.evidence_unit_id,
        content_hash: e.content_hash,
        rights_version_id: e.rights_version_id,
        planner_exposure: oneOf(e.consumer_exposure.planner, exposures),
      })),
    beats: array(pkg.manifest.beats).map((b) => ({
      beat_id: text(record(b).beat_id),
      member_claim_refs: array(record(b).member_claim_refs).map(text),
    })),
  };
  const canonical_json = canonicalJson(view);
  return frozen({
    kind: "projected",
    profile: PROFILE,
    observation: {
      source_text_utf8_bytes: String(bytes),
      source_text_sha256: createHash("sha256")
        .update(input, "utf8")
        .digest("hex"),
    },
    view,
    canonical_json,
    view_sha256: createHash("sha256")
      .update("planner-package-reference-view-v1\n", "utf8")
      .update(canonical_json, "utf8")
      .digest("hex"),
  });
}
