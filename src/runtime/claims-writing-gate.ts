// Fixed fixture deterministic Claims/Writing gate seam and SpeechTexture content-diff lock: dependent contract `claims-writing-gate/1` (docs/g1-claims-writing-gate.md).
// ONE trusted, non-network evaluation of the exact accepted speech-texture child of the exact accepted substantive parent against the
// eighteen frozen claims/writing gate definitions (Claims Policy section 22 fourteen checks, Writing section 24.1 sixteen hard failures,
// section 24.2 twelve soft warnings, and the SpeechTexture diff lock). It is recorded as 18 additive `gate_results` rows and nothing else.
// The result on the pinned chain is TRUTHFUL, not green: a precise past duration is an unsupported numeric claim (violation), a
// conditional duration and the derivation count re-execution are retained proof gaps, and two obligations stay `not_established_required`.
// Nothing here states anything about semantic correctness, speech quality, timing, Claims/Writing acceptance, SCRIPTED, READY or G1-B.
// Ownership: every lexical predicate is a pure function over a `ComponentInputs` value (component boundary). Rows can only be written from an
// `OwnedEvaluation`, which is minted privately from a successful, plan-bound reader acquisition (one REPEATABLE READ READ ONLY transaction:
// 145 static SELECTs, a private non-writable candidate evaluation, one final native expected-row SELECT, COMMIT and release) after complete
// classification. No caller-built raw snapshot, component result, structural clone, wrong-plan object or failed acquisition can mint it.
// No accepted module is edited; the unchanged `classifyTextureSnapshot` is used over a count projection that subtracts only rows proven equal
// to plan rows. An unowned throwable propagates with its identity; only the finite gate stop mapping below is returned as data.
import type { Pool, PoolClient } from "pg";

import { codePointLength } from "../fixture/code-points.js";
import { GATE_SET_VERSION } from "../fixture/derive.js";
import { openFixturePack, type Pack } from "../fixture/pack.js";
import type { TextureSpecimen } from "../fixture/speech-texture-specimen.js";
import {
  evidencePackageHash,
  scriptHash,
  showrunnerBriefHash,
} from "../identity/artifacts.js";
import {
  canonicalBytes,
  canonicalJson,
  sha256,
} from "../identity/canonical-json.js";
import { fingerprint } from "../identity/fingerprints.js";
import { derivationOutputHash, supportHashFor } from "../identity/knowledge.js";
import { ClaimStateError, frozenStateHash } from "../knowledge/claim-state.js";
import { verifyFrozenEntry } from "../knowledge/state-cursor.js";
import {
  CommandConnectionError,
  Rejection,
  commandCleanupErrors,
  faultPoint,
  isUnique,
  requireTimestamp,
  rethrow,
  runCommand,
  type Outcome,
  type Row,
  type Tx,
} from "./command.js";
import { rowsById } from "./craft-critic.js";
import {
  TEXTURE_FIELDS,
  TEXTURE_PIN,
  TEXTURE_REWRITE_TABLE,
  TEXTURE_STATEMENT_COUNT,
  TEXTURE_STOP_CODES,
  TextureRefusal,
  admitTextureAgainst,
  assembleTextureRaw,
  classifyTextureSnapshot,
  isAdmittedTexturePlan,
  planSpeechTexture,
  readTextureInvocation,
  textureSnapshotStatements,
  type TextureField,
  type TexturePlan,
  type TexturePlanInputs,
  type TextureRawSnapshot,
  type TextureRewriteRow,
  type TextureStopCode,
  type TextureUpstream,
} from "./speech-texture.js";
import {
  LOCK_SQL,
  PASS1_PIN,
  hostMatches,
  instantMicros,
  sameJson,
  sharesRun,
  stringLeaves,
  type Cleanup,
  type Fact,
  type Statement,
} from "./writer-pass1.js";

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isArr = (value: unknown): value is unknown[] => Array.isArray(value);
const isStr = (value: unknown): value is string => typeof value === "string";
const isInt = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value);
const records = (value: unknown): Obj[] =>
  isArr(value) ? value.filter(isObj) : [];
const strOf = (value: unknown): string => (isStr(value) ? value : "");
const intOf = (value: unknown): number => (isInt(value) ? value : -1);
const strings = (value: unknown): string[] =>
  isArr(value) ? value.filter(isStr) : [];

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
const cpArray = (text: string): string[] => Array.from(text);
const cpSlice = (text: string, start: number, end: number): string =>
  cpArray(text).slice(start, end).join("");
/** Code-point index of a UTF-16 offset of `text`. */
const cpIndex = (text: string, offset: number): number =>
  codePointLength(text.slice(0, offset));
const compareText = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;
const sortedText = (list: readonly string[]): string[] =>
  [...list].sort(compareText);

// ---- pinned literals (inert arithmetic from the reviewed design; verified at plan time and in every evaluator, never adjusted to fit) ----
export const GATE_PIN = deepFreeze({
  profile: "claims-writing-gate/1",
  result_schema: "claims-writing-gate-result/1",
  id_namespace: "the-desk.claims-writing-gate.id/1",
  actor_id: "d1250001-0000-4000-8000-000000000002",
  actor_kind: "policy",
  fingerprint_stage: "claims_writing",
  fingerprint:
    "1be8aaa9d5ac8a5086542065d55275e018eefba78cc0a934c22171d32f76a5ba",
  claims_policy_version: "claims-0.1.2",
  writing_policy_version: "writing-0.2.3",
  gate_set_version: GATE_SET_VERSION,
  host_attempt_id: PASS1_PIN.host.attempt_id,
  child_script_hash:
    "776eefadaa96ae3ef0030e48d15184ac1aa49032695d6e84f03b2ce9f6084fe0",
  child_script_version_id: TEXTURE_PIN.script_version_id,
  child_script_artifact_id: TEXTURE_PIN.script_artifact_id,
  parent_script_hash:
    "4a927ad9cd612aa0f2f57ed52273061abcfe8f1ba8d8f864ca2a25907c517b00",
  parent_script_version_id: "ee585057-e51a-4dda-9bf9-52ce6c9c683e",
  parent_script_artifact_id: "90620ba1-3e86-4a14-a7b9-68264dad93ba",
  lock_class: 182736491,
  silent_claim_id: "d1250008-0000-4000-8000-000000000008",
  derivation_run_id: "d1250009-0000-4000-8000-000000000001",
  derivation_rule_version: "late-concession-count/v1",
  signal_carrier_id: "d1250005-0000-4000-8000-000000000017",
  continuity_carrier_id: "d1250005-0000-4000-8000-000000000018",
  paraphrase_rights_id: "d1250006-0000-4000-8000-000000000005",
  quote_rights_id: "d1250006-0000-4000-8000-000000000006",
  member_sha256: {
    participant_profiles:
      "86fc33c6c4d9bb6c1226f4774815341716a677d8a04bfacea997658087440b61",
    rundown_template:
      "4c74bc6563680d907233921333a6528463ec5819a2375786ba77efbb15e3a9f6",
    episode_modes:
      "b03b3889cdc1b1facf4be77d76e2212d3d166f7e406c589aae8a9e8bf1d06586",
    block_types:
      "a6db53ee315437200bfadd76c988860512a9a36588e865dd8d78581c32dcfbb7",
    foundation_rows:
      "a27f4381bd6449bfb656c6431b56115a932e05c82791696fc293c701c0a58a7e",
    policy_versions:
      "5d02892aeb53f8236e437a3728e383beb5d0534c85760072ea5c3a32e36c6b18",
    evidence_package:
      "bd9f5ff68156d6c03184c0e6d2f1acccc35bbb0c0223ab4ab611fb9378ba05f9",
  },
});
export const GATE_MEMBERS = deepFreeze({
  participant_profiles: "config/participant_profiles.json",
  rundown_template: "config/rundown_template_post_event_launch_v2.json",
  episode_modes: "config/episode_modes.json",
  block_types: "config/block_types.json",
  foundation_rows: "foundation_rows_398.json",
  policy_versions: "config/policy_versions.json",
  evidence_package: "evidence_package.json",
});
const GUARD_RUN = 24;
const FIRST_DEFINITION = 1;
/** The eighteen frozen claims/writing definition keys in definition order (id suffix = the one-based position, two decimal digits). */
export const GATE_DEFINITION_KEYS = deepFreeze([
  "claims.presence",
  "claims.use_permission",
  "claims.silent_non_leak",
  "claims.value_support",
  "claims.quote_permission",
  "claims.paraphrase_permission",
  "claims.speaker_attribution",
  "claims.claim_state",
  "claims.program_history",
  "claims.desk_derivation",
  "claims.incident_status",
  "claims.span_integrity",
  "writing.participant_validity",
  "writing.planned_block_membership",
  "writing.required_blocks",
  "writing.provider_markup_lint",
  "writing.diff_lock",
  "writing.context_complete",
] as const);
export type GateDefinitionKey = (typeof GATE_DEFINITION_KEYS)[number];
export const gateDefinitionId = (position: number): string =>
  `d1250019-0000-4000-8000-0000000000${String(position).padStart(2, "0")}`;
const DEFINITION_IDS: readonly string[] = GATE_DEFINITION_KEYS.map((_, index) =>
  gateDefinitionId(index + FIRST_DEFINITION),
);
const HISTORICAL_CLAIMS_WRITING_FINGERPRINT_PREFIX = "000b3e1e";

// ---- closed vocabularies -------------------------------------------------------------------------------------------------------------
export const GATE_STOP_CODES = deepFreeze([
  "gate_invocation_invalid",
  "gate_texture_plan_stopped",
  "gate_input_identity_mismatch",
  "gate_static_input_mismatch",
  "gate_attempt_unavailable",
  "gate_snapshot_failed",
  "gate_upstream_stopped",
  "gate_texture_incomplete",
  "gate_definitions_mismatch",
  "gate_history_mismatch",
  "gate_result_conflict",
  "gate_result_stale",
  "gate_result_foreign",
  "gate_unexpected_state",
  "gate_mapping_invariant",
  "gate_precondition_failed",
  "gate_write_rejected",
  "gate_reconcile_failed",
  "gate_command_connection",
  "gate_final_state_mismatch",
] as const);
export type GateStopCode = (typeof GATE_STOP_CODES)[number];
export type GateStopStage =
  | "input"
  | "admission"
  | "preconditions"
  | "evaluation"
  | "record"
  | "final_check";
/** Finding classes: a violation is a predicate that was evaluated and failed; a proof_gap is a required proof that is absent. */
export type FindingClass = "violation" | "proof_gap";
export const VIOLATION_CODES = deepFreeze([
  "denominator_mismatch",
  "claim_unresolved",
  "claim_state_hash_mismatch",
  "evidence_unresolved",
  "rights_version_mismatch",
  "use_turn_unresolved",
  "use_row_payload_mismatch",
  "mode_illegal_for_class",
  "mode_unknown",
  "evidence_mode_unknown",
  "silent_claim_used",
  "silent_evidence_used",
  "silent_value_reproduced",
  "silent_constraint_missing",
  "withheld_run_present",
  "precise_duration_unsupported",
  "numeral_role_order_mismatch",
  "source_credit_cardinality_mismatch",
  "numeral_support_not_authorized",
  "numeral_form_unclassified",
  "duration_context_unclassified",
  "quote_not_permitted",
  "quote_locator_missing",
  "quote_text_not_approved_representation",
  "quote_marks_absent",
  "quote_without_use",
  "paraphrase_not_permitted",
  "quote_marks_on_paraphrase",
  "overlap_run_24",
  "attribution_prefix_missing",
  "attribution_mode_illegal",
  "claim_state_not_assertable",
  "frozen_state_hash_recomputed_mismatch",
  "continuity_unresolved",
  "continuity_withdrawn_or_draft",
  "continuity_topic_mismatch",
  "derivation_missing",
  "derivation_rule_mismatch",
  "derivation_parameters_mismatch",
  "derivation_output_mismatch",
  "derivation_hash_mismatch",
  "derivation_input_ref_mismatch",
  "derivation_window_mismatch",
  "incident_claim_used",
  "span_out_of_range",
  "span_text_changed",
  "use_tuple_changed",
  "span_shift_mismatch",
  "participant_not_in_roster",
  "participant_profile_unbound",
  "turn_block_detached",
  "turn_sequence_invalid",
  "block_unplanned",
  "block_missing",
  "block_order_mismatch",
  "block_without_turn",
  "template_version_mismatch",
  "provider_char_class",
  "provider_known_tag",
  "pronunciation_respelling_present",
  "context_incomplete",
  "context_budget_exceeded",
  "context_hash_mismatch",
  "context_claim_ref_mismatch",
  "child_hash_mismatch",
  "child_hash_unrecomputable",
  "parent_identity_mismatch",
  "relational_parent_mismatch",
  "binding_changed",
  "turn_structure_changed",
  "turn_id_reused",
  "scope_exceeded",
  "rewrite_row_mismatch",
  "claim_use_changed",
  "evidence_use_changed",
  "span_reanchor_mismatch",
  "lexical_numeric_changed",
  "lexical_quote_changed",
  "quote_not_approved_representation",
  "lexical_hedge_changed",
  "lexical_negation_changed",
  "punctuation_class_added",
  "prediction_changed",
  "use_added",
  "permission_changed",
  "rewrite_table_unpinned",
  "row_payload_mismatch",
  "texture_admission_refused",
] as const);
export const PROOF_GAP_CODES = deepFreeze([
  "duration_context_unresolved",
  "incident_witness_missing",
  "required_proof_not_established",
] as const);
export type ViolationCode = (typeof VIOLATION_CODES)[number];
export type ProofGapCode = (typeof PROOF_GAP_CODES)[number];
export type FindingCode = ViolationCode | ProofGapCode;
const PROOF_GAP_SET: ReadonlySet<string> = new Set(PROOF_GAP_CODES);
export const WARNING_CODES = deepFreeze([
  "lexical_access_phrase",
  "lexical_opener_repeat",
  "overlap_run_24_unquoted",
  "lexical_signposting",
] as const);
export type WarningCode = (typeof WARNING_CODES)[number];
export const COVERAGE_IDS = deepFreeze([
  "C13",
  "C14",
  "H01",
  "H04",
  "H13",
  "H14",
  "X01",
  "X02",
  "W01",
  "W02",
  "W03",
  "W04",
  "W05",
  "W06",
  "W07",
  "W08",
  "W09",
  "W10",
  "W11",
  "W12",
] as const);
export type CoverageId = (typeof COVERAGE_IDS)[number];
export const COVERAGE_STATUSES = deepFreeze([
  "established",
  "established_with_limits",
  "inapplicable_witnessed",
  "not_established_required",
  "deferred_semantic",
  "soft_probe_clear",
  "soft_probe_fired",
  "soft_probe_not_established",
] as const);
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];
export const COVERAGE_LIMITS = deepFreeze([
  "historical_visibility_unprovable",
  "frozen_ceiling_unavailable",
  "nonnumeric_unmarked_factual_content",
  "mode_forbidden_rule_set_absent",
  "show_roster_document_absent",
  "no_threshold",
  "no_affinity_data",
  "no_words_per_minute_rule",
  "no_input",
  "semantic",
] as const);
export type CoverageLimit = (typeof COVERAGE_LIMITS)[number];
/** The texture's own not-run list minus the three gates this run performs (diff lock, provider-syntax lint, claims/writing), plus the Performance Direction. */
export const GATE_GATES_NOT_RUN = deepFreeze<readonly string[]>([
  "implied_access_lint",
  "semantic_audit",
  "performance_direction",
  "performance_gate",
  "render_*",
  "assembly_*",
  "ready_*",
]);
export const GATE_NOT_PROVEN = deepFreeze<readonly string[]>([
  "claims_writing_acceptance",
  "fourteen_gate_discharge",
  "semantic_audit_findings",
  "implied_access_assertion_absent",
  "unmarked_nonnumeric_factual_content_absent",
  "derivation_count_reexecution",
  "speech_naturalness",
  "timing_or_budget_fit",
  "scripted",
  "ready",
  "g1_b_certification",
]);
export type GateSurface = "rows" | "warnings" | "coverage" | "stop" | "summary";
export const GATE_SURFACES: readonly GateSurface[] = [
  "rows",
  "warnings",
  "coverage",
  "stop",
  "summary",
];

// ---- findings, warnings, coverage -----------------------------------------------------------------------------------------------------
export interface GateFinding {
  readonly class: FindingClass;
  readonly code: FindingCode;
  readonly anchor?: string;
  readonly span?: readonly [number, number];
  readonly use_index?: number;
  readonly ref?: "derivation_count_reexecution";
  readonly upstream_code?: TextureStopCode;
  readonly field?: TextureField;
}
export interface GateWarning {
  readonly code: WarningCode;
  readonly anchor?: string;
  readonly span?: readonly [number, number];
}
export interface CoverageEntry {
  readonly id: CoverageId;
  readonly status: CoverageStatus;
  readonly limits?: readonly CoverageLimit[];
}
interface Location {
  anchor?: string;
  span?: readonly [number, number];
  use_index?: number;
  ref?: "derivation_count_reexecution";
  upstream_code?: TextureStopCode;
  field?: TextureField;
}
/** Builds a finding whose class is derived from the code (never a caller choice) and which carries only the keys that were supplied. */
function finding(code: FindingCode, where: Location = {}): GateFinding {
  const base = {
    class: PROOF_GAP_SET.has(code)
      ? ("proof_gap" as const)
      : ("violation" as const),
    code,
  };
  return {
    ...base,
    ...(where.anchor !== undefined ? { anchor: where.anchor } : {}),
    ...(where.span !== undefined ? { span: where.span } : {}),
    ...(where.use_index !== undefined ? { use_index: where.use_index } : {}),
    ...(where.ref !== undefined ? { ref: where.ref } : {}),
    ...(where.upstream_code !== undefined
      ? { upstream_code: where.upstream_code }
      : {}),
    ...(where.field !== undefined ? { field: where.field } : {}),
  };
}

// ---- identifiers, projection, owners -----------------------------------------------------------------------------------------------------
/** UUID = SHA-256(namespace + LF + label)[0:16], version nibble 4, variant 10 (the texture recipe, the gate's own namespace). */
export function deriveGateId(label: string): string {
  const bytes = Buffer.from(
    sha256(Buffer.from(`${GATE_PIN.id_namespace}\n${label}`, "utf8")).slice(
      0,
      32,
    ),
    "hex",
  );
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export interface GateOwners {
  readonly package_hash: string;
  readonly brief_hash: string;
  readonly script_hash: string;
  readonly claims_policy_version: string;
  readonly writing_policy_version: string;
  readonly gate_set_version: string;
}
const OWNER_KEYS = [
  "package_hash",
  "brief_hash",
  "script_hash",
  "claims_policy_version",
  "writing_policy_version",
  "gate_set_version",
] as const;
/** The exact six-key projection of the `claims_writing` stage; nothing else (no outcome, attempt, finding or timestamp) ever enters it. */
export function buildGateProjection(owners: GateOwners): GateOwners {
  const source = owners as unknown as Obj;
  const keys = Object.keys(source);
  if (
    keys.length !== OWNER_KEYS.length ||
    !OWNER_KEYS.every((key) => Object.hasOwn(source, key) && isStr(source[key]))
  )
    throw new TypeError("a six-field owner projection is required");
  return {
    package_hash: owners.package_hash,
    brief_hash: owners.brief_hash,
    script_hash: owners.script_hash,
    claims_policy_version: owners.claims_policy_version,
    writing_policy_version: owners.writing_policy_version,
    gate_set_version: owners.gate_set_version,
  };
}
export const gateFingerprint = (owners: GateOwners): string =>
  fingerprint("claims_writing", buildGateProjection(owners));
export interface OwnerParts {
  readonly manifest: Obj;
  readonly script_payload: Obj;
  readonly brief: Obj;
  readonly package: Obj;
}
export type OwnerMismatch =
  | "package"
  | "brief"
  | "script"
  | "claims_policy"
  | "writing_policy"
  | "gate_set";
/**
 * The six owner values recomputed from their sources: the package and Brief hashes through the real helpers over the supplied
 * payloads, the script hash through the real helper over the child payload, both policy versions from the prompt-manifest
 * `component_versions` AND the policy-version map (both must agree and equal the pinned literal), and the gate-set version from the
 * imported constant. Each disagreement returns the first mismatching owner by name.
 */
export function deriveGateOwners(
  parts: OwnerParts,
  policyVersions: Obj,
): GateOwners | { readonly mismatch: OwnerMismatch } {
  const payload = parts.script_payload;
  let packageHash: string;
  let briefHash: string;
  let childHash: string;
  try {
    packageHash = evidencePackageHash(parts.package);
    briefHash = showrunnerBriefHash(parts.brief);
    childHash = scriptHash(payload, { brief: parts.brief });
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return { mismatch: "script" };
  }
  if (packageHash !== payload.package_hash) return { mismatch: "package" };
  if (briefHash !== payload.brief_hash) return { mismatch: "brief" };
  if (
    childHash !== payload.script_hash ||
    childHash !== GATE_PIN.child_script_hash
  )
    return { mismatch: "script" };
  const versions = isObj(parts.manifest.component_versions)
    ? parts.manifest.component_versions
    : {};
  const policies = isObj(policyVersions.policies)
    ? policyVersions.policies
    : {};
  const versionOf = (name: string): unknown => {
    const entry = policies[name];
    return isObj(entry) ? entry.version_id : undefined;
  };
  if (
    versions.claims_policy !== GATE_PIN.claims_policy_version ||
    versionOf("claims_policy") !== GATE_PIN.claims_policy_version
  )
    return { mismatch: "claims_policy" };
  if (
    versions.writing_policy !== GATE_PIN.writing_policy_version ||
    versionOf("writing_policy") !== GATE_PIN.writing_policy_version ||
    payload.writing_policy_version !== GATE_PIN.writing_policy_version
  )
    return { mismatch: "writing_policy" };
  if (GATE_SET_VERSION !== GATE_PIN.gate_set_version)
    return { mismatch: "gate_set" };
  return {
    package_hash: packageHash,
    brief_hash: briefHash,
    script_hash: childHash,
    claims_policy_version: GATE_PIN.claims_policy_version,
    writing_policy_version: GATE_PIN.writing_policy_version,
    gate_set_version: GATE_SET_VERSION,
  };
}

// ---- component inputs ---------------------------------------------------------------------------------------------------------------
/** The child's relational carriers exactly as planned (version row, 17 turns, 12 claim uses, 3 evidence uses). */
export interface ChildRows {
  readonly version: Obj;
  readonly turns: readonly Obj[];
  readonly claim_uses: readonly Obj[];
  readonly evidence_uses: readonly Obj[];
}
/** The gate-owned facts as the twelve snapshot statements return them (decoded rows, not interpreted). */
export interface GateFacts {
  readonly claims: readonly Obj[];
  readonly supports: readonly Obj[];
  readonly events: readonly Obj[];
  readonly derivation: Obj | undefined;
  readonly carriers: readonly Obj[];
  readonly rights: readonly Obj[];
  readonly evidence: readonly Obj[];
  readonly pronunciations: readonly Obj[];
  readonly renderings: readonly Obj[];
}
/** Static programming configuration, verified against pinned member hashes before it is parsed. */
export interface GateStatics {
  readonly profiles: Obj;
  readonly template: Obj;
  readonly modes: Obj;
  readonly block_types: Obj;
}
/**
 * Everything a predicate reads, as plain data. `C` is the stored child payload, `K` the stored substantive parent payload, `pkg` the frozen
 * package manifest, `brief` the Brief payload, `writer`/`context` the Pass-1 writer view and writer-context manifest. A component
 * evaluation over this value is a pure function; it can never be written (Part: ownership).
 */
export interface ComponentInputs {
  readonly C: Obj;
  readonly K: Obj;
  readonly rows: ChildRows;
  readonly pkg: Obj;
  readonly brief: Obj;
  readonly writer: Obj;
  readonly context: Obj;
  readonly facts: GateFacts;
  readonly statics: GateStatics;
  readonly originals: readonly string[];
  readonly rewrites: readonly TextureRewriteRow[];
  readonly parent_artifact_hash: string;
}
const turnsOf = (payload: Obj): Obj[] => records(payload.turns);
const claimUsesOf = (payload: Obj): Obj[] => records(payload.turn_claim_uses);
const evidenceUsesOf = (payload: Obj): Obj[] =>
  records(payload.turn_evidence_uses);
const turnText = (turn: Obj): string => strOf(turn.spoken_text);
const turnAnchor = (turn: Obj): string => strOf(turn.semantic_turn_id);
/** storage turn id -> semantic anchor of one payload */
const anchorByTurnId = (payload: Obj): Map<string, string> =>
  new Map(
    turnsOf(payload).map((turn) => [strOf(turn.turn_id), turnAnchor(turn)]),
  );
const textByAnchor = (payload: Obj): Map<string, string> =>
  new Map(turnsOf(payload).map((turn) => [turnAnchor(turn), turnText(turn)]));
const packageClaims = (inp: ComponentInputs): Obj[] => records(inp.pkg.claims);
const packageEvidence = (inp: ComponentInputs): Obj[] =>
  records(inp.pkg.evidence);
const claimEntry = (inp: ComponentInputs, id: unknown): Obj | undefined =>
  packageClaims(inp).find((entry) => entry.claim_id === id);
const evidenceEntry = (inp: ComponentInputs, id: unknown): Obj | undefined =>
  packageEvidence(inp).find((entry) => entry.evidence_unit_id === id);
const factEvidence = (inp: ComponentInputs, id: unknown): Obj | undefined =>
  inp.facts.evidence.find((row) => row.evidence_unit_id === id);
const factRights = (inp: ComponentInputs, id: unknown): Obj | undefined =>
  inp.facts.rights.find((row) => row.rights_version_id === id);
const refsOf = (claim: Obj | undefined): Obj[] =>
  claim === undefined ? [] : records(claim.support_refs);
/** Combined use list in the order of the diff-lock helper: the claim uses, then the evidence uses (a finding's `use_index`). */
export type UseKind = "claim" | "evidence";
export interface UseRef {
  readonly index: number;
  readonly kind: UseKind;
  readonly use: Obj;
}
function allUses(payload: Obj): UseRef[] {
  const claims = claimUsesOf(payload);
  return [
    ...claims.map((use, index): UseRef => ({ index, kind: "claim", use })),
    ...evidenceUsesOf(payload).map(
      (use, index): UseRef => ({
        index: claims.length + index,
        kind: "evidence",
        use,
      }),
    ),
  ];
}
const useAnchor = (use: Obj): string => strOf(use.semantic_turn_id);
function useText(payload: Obj, use: Obj): string {
  const text = textByAnchor(payload).get(useAnchor(use)) ?? "";
  return cpSlice(text, intOf(use.span_start), intOf(use.span_end));
}

// ---- support identity (Claims 4.3): the proof both the numeric authorisation and precondition 14 use -------------------------------------
const SUPPORT_ROLES: readonly string[] = [
  "supports_value",
  "supports_attribution",
  "qualifies",
  "contradicts",
  "context_only",
];
const SUPPORT_KINDS: readonly string[] = [
  "evidence",
  "derivation",
  "signal",
  "continuity",
];
/** True iff the support row's kind/column agreement and its kind-specific hash rule hold (never throws for malformed data). */
export function supportProof(inp: ComponentInputs, support: Obj): boolean {
  const kind = strOf(support.support_kind);
  const role = strOf(support.support_role);
  if (!SUPPORT_ROLES.includes(role) || !SUPPORT_KINDS.includes(kind))
    return false;
  const evidenceId = support.evidence_unit_id ?? null;
  const runId = support.derivation_run_id ?? null;
  const external = support.external_support_identity ?? null;
  const hash = support.support_hash;
  try {
    if (kind === "evidence") {
      const unit = factEvidence(inp, evidenceId);
      return (
        runId === null &&
        external === null &&
        unit !== undefined &&
        hash === unit.content_hash &&
        evidenceEntry(inp, evidenceId)?.content_hash === hash
      );
    }
    if (kind === "derivation") {
      const run = inp.facts.derivation;
      return (
        evidenceId === null &&
        external === null &&
        run?.derivation_run_id === runId &&
        hash === derivationOutputHash(run.output) &&
        hash === run.output_hash
      );
    }
    if (evidenceId !== null || runId !== null || !isStr(external)) return false;
    const carrier = inp.facts.carriers.find(
      (row) => `artifact:${strOf(row.artifact_id)}` === external,
    );
    if (carrier === undefined) return false;
    return (
      supportHashFor(kind, { carrier: carrier.canonical_payload }) === hash &&
      carrier.content_hash === hash
    );
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
}
/** A package support entry equals the stored `claim_supports` row with the same id on every column. */
function packageSupportMatches(
  inp: ComponentInputs,
  claimId: unknown,
  ref: Obj,
): boolean {
  const stored = inp.facts.supports.find(
    (row) => row.claim_support_id === ref.claim_support_id,
  );
  return (
    stored !== undefined &&
    stored.claim_id === claimId &&
    [
      "support_kind",
      "support_role",
      "evidence_unit_id",
      "derivation_run_id",
      "external_support_identity",
      "support_hash",
    ].every((key) => (stored[key] ?? null) === (ref[key] ?? null))
  );
}
/** The claim has at least one `supports_value` package support whose identity and hash proof both hold (Claims 4.3: only that role supports a value). */
function valueAuthorized(inp: ComponentInputs, claimId: unknown): boolean {
  return refsOf(claimEntry(inp, claimId)).some(
    (ref) =>
      ref.support_role === "supports_value" &&
      supportProof(inp, ref) &&
      packageSupportMatches(inp, claimId, ref),
  );
}

// ---- the typed value normalizer `fixture-value-forms/1` and context forms `fixture-context-forms/1` ------------------------------------
const WORD_VALUES: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};
const NUMERAL_TOKEN =
  /\d+(?:\.\d+)+|\d+(?:-\d+)+|\d+(?:st|nd|rd|th)?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\b/giu;
export interface NumeralToken {
  readonly text: string;
  /** code-point offsets */
  readonly start: number;
  readonly end: number;
  /** UTF-16 offsets into the same text (for the regular-expression contexts) */
  readonly start16: number;
  readonly end16: number;
}
/** Every token of the closed grammar, in order: decimal, hyphen compound, ordinal/integer, cardinal word one..ten (case-insensitive). */
export function numeralTokens(text: string): NumeralToken[] {
  const re = new RegExp(NUMERAL_TOKEN.source, NUMERAL_TOKEN.flags);
  const out: NumeralToken[] = [];
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    out.push({
      text: m[0],
      start: cpIndex(text, m.index),
      end: cpIndex(text, m.index + m[0].length),
      start16: m.index,
      end16: m.index + m[0].length,
    });
  }
  return out;
}
/** A plain integer or a cardinal word one..ten; every other form (decimal, compound, ordinal) is NaN, never a truncated prefix. */
const plainValueOf = (token: string): number => {
  const word = WORD_VALUES[token.toLowerCase()];
  if (word !== undefined) return word;
  return /^\d+$/u.test(token) ? Number(token) : Number.NaN;
};
/** The declared ordinal after-minute form `80th`; anything else is NaN. */
const ordinalValueOf = (token: string): number => {
  const digits = /^(\d+)(?:st|nd|rd|th)$/iu.exec(token);
  return digits?.[1] === undefined ? Number.NaN : Number(digits[1]);
};
type CountRole = "after_minute" | "count" | "sample_size";
const COUNT_FORM = String.raw`\d+|one|two|three|four|five|six|seven|eight|nine|ten`;
const NOT_NUMBER_EDGE = String.raw`(?![\p{L}\p{N}]|[.-]\p{N})`;
/** The two accepted count-window frames, each with the role of its ordered captures. */
const COUNT_FRAMES: readonly {
  readonly source: string;
  readonly roles: readonly CountRole[];
}[] = [
  {
    source: String.raw`(?<![\p{L}\p{N}.-])after the (\d+(?:st|nd|rd|th)) minute in (${COUNT_FORM}) of their last (${COUNT_FORM}) league matches${NOT_NUMBER_EDGE}`,
    roles: ["after_minute", "count", "sample_size"],
  },
  {
    source: String.raw`(?<![\p{L}\p{N}.-])(${COUNT_FORM}) late concessions in (${COUNT_FORM})${NOT_NUMBER_EDGE}`,
    roles: ["count", "sample_size"],
  },
];
/** The role of `token` iff it is exactly one captured, correctly formed slot of an accepted frame in `text`; undefined fails closed. */
function countRole(text: string, token: NumeralToken): CountRole | undefined {
  for (const frame of COUNT_FRAMES) {
    const re = new RegExp(frame.source, "giud");
    for (let m = re.exec(text); m !== null; m = re.exec(text))
      for (const [slot, role] of frame.roles.entries()) {
        const at = m.indices?.[slot + 1];
        if (at?.[0] === token.start16 && at[1] === token.end16) return role;
      }
  }
  return undefined;
}
export type NumeralClass =
  | "scoreline"
  | "formation"
  | "percent"
  | "after_minute"
  | "count"
  | "sample_size"
  | "observation_count"
  | "attested_since_year"
  | "source_credit_one"
  | "quoted_phrase_member"
  | "deictic_one"
  | "duration_past_event"
  | "duration_prospective_prediction"
  | "duration_conditional_generic"
  | "duration_unclassified"
  | "unclassified_numeral";
export type NumeralOutcome =
  | "supported"
  | "no_finding"
  | "violation"
  | "proof_gap";
export interface NumeralClassification {
  readonly anchor: string;
  readonly token: string;
  readonly start: number;
  readonly end: number;
  readonly klass: NumeralClass;
  readonly outcome: NumeralOutcome;
  readonly code?: ViolationCode | ProofGapCode;
  readonly claim_id?: string;
}
interface Classified {
  readonly klass: NumeralClass;
  readonly outcome: NumeralOutcome;
  readonly code?: ViolationCode | ProofGapCode;
  readonly claim_id?: string;
}
const supported = (klass: NumeralClass, claim_id: string): Classified => ({
  klass,
  outcome: "supported",
  claim_id,
});
const roleOrder = (klass: NumeralClass, claim_id: string): Classified => ({
  klass,
  outcome: "violation",
  code: "numeral_role_order_mismatch",
  claim_id,
});
const verdict = (
  ok: boolean,
  klass: NumeralClass,
  claim_id: string,
): Classified => (ok ? supported(klass, claim_id) : roleOrder(klass, claim_id));
/** A clause is the text between `. `, `? ` and `: ` boundaries (UTF-16 offsets). */
function clauseBounds(text: string, position: number): [number, number] {
  let start = 0;
  for (const mark of [". ", "? ", ": "]) {
    const at = text.lastIndexOf(mark, position - 1);
    if (at !== -1) start = Math.max(start, at + 2);
  }
  let end = text.length;
  for (const mark of [". ", "? ", ": "]) {
    const at = text.indexOf(mark, position);
    if (at !== -1) end = Math.min(end, at);
  }
  return [start, end];
}
/** True iff the token opens a sentence: the text start, or a `.`, `?` or `!` (closing quotes/brackets allowed) and whitespace; a comma or colon never does. */
function sentenceStart(text: string, offset: number): boolean {
  const before = text.slice(0, offset);
  return before.trim() === "" || /[.?!]["')\]]*\s+$/u.test(before);
}
interface PredictionText {
  readonly anchor: string;
  readonly text: string;
}
function predictionsOf(payload: Obj): PredictionText[] {
  const anchors = anchorByTurnId(payload);
  return records(payload.prediction_candidates).map((candidate) => ({
    anchor: anchors.get(strOf(candidate.turn_id)) ?? "",
    text: strOf(candidate.prediction_text),
  }));
}
function classifyToken(
  inp: ComponentInputs,
  text: string,
  anchor: string,
  uses: readonly UseRef[],
  predictions: readonly PredictionText[],
  token: NumeralToken,
): Classified {
  const word = token.text.toLowerCase();
  const covering = uses.filter(
    (ref) =>
      intOf(ref.use.span_start) <= token.start &&
      token.end <= intOf(ref.use.span_end),
  );
  // R1: a digit or word inside an APPROVED evidence quotation carries no numeric role (the mode string alone is not approval)
  for (const ref of covering)
    if (
      ref.kind === "evidence" &&
      ref.use.use_mode === "quoted" &&
      quoteDefects(inp, ref).length === 0
    )
      return { klass: "quoted_phrase_member", outcome: "no_finding" };
  // R2: a deictic `one`
  if (word === "one") {
    const before = text.slice(0, token.start16).split(/\s+/u).filter(Boolean);
    const last = (before[before.length - 1] ?? "")
      .toLowerCase()
      .replace(/^[,.]+|[,.]+$/gu, "");
    if (["this", "that", "which", "the"].includes(last))
      return { klass: "deictic_one", outcome: "no_finding" };
  }
  const after = text.slice(token.end16);
  for (const ref of covering) {
    if (ref.kind !== "claim") continue;
    const claimId = strOf(ref.use.claim_id);
    const entry = claimEntry(inp, claimId);
    if (entry === undefined || !isObj(entry.value))
      return {
        klass: "unclassified_numeral",
        outcome: "violation",
        code: "numeral_support_not_authorized",
        claim_id: claimId,
      };
    const value = entry.value;
    const valueType = strOf(entry.value_type);
    const parts = token.text.split("-");
    if (
      token.text.includes("-") &&
      parts.length === 2 &&
      valueType === "scoreline"
    )
      return verdict(
        Number(parts[0]) === value.northbridge_goals &&
          Number(parts[1]) === value.southbank_goals,
        "scoreline",
        claimId,
      );
    if (
      token.text.includes("-") &&
      parts.length >= 3 &&
      valueType === "structured_text"
    )
      return verdict(token.text === value.formation, "formation", claimId);
    if (
      valueType === "exact_decimal" &&
      /^\d+$/u.test(token.text) &&
      /^\s*percent/u.test(after)
    )
      return verdict(
        value.unit === "percent" && value.scalar === token.text,
        "percent",
        claimId,
      );
    if (valueType === "count_window") {
      const role = countRole(text, token);
      if (role !== undefined)
        return verdict(
          (role === "after_minute"
            ? ordinalValueOf(token.text)
            : plainValueOf(token.text)) === value[role],
          role,
          claimId,
        );
    }
    if (
      valueType === "tenor" &&
      word in WORD_VALUES &&
      /^\s*supporter sources/u.test(after)
    )
      return verdict(
        WORD_VALUES[word] === value.observation_count &&
          tenorCarrierCount(inp, entry) === value.observation_count,
        "observation_count",
        claimId,
      );
    if (
      valueType === "lore_phrase" &&
      /^\d{4}$/u.test(token.text) &&
      text.slice(0, token.start16).trimEnd().endsWith("at least")
    )
      return verdict(
        Number(token.text) === value.attested_since_year,
        "attested_since_year",
        claimId,
      );
    if (
      word === "one" &&
      sentenceStart(text, token.start16) &&
      /^\s*(?:\w+\s+){0,2}(?:source|analysis)\b/u.test(after)
    ) {
      const credits = refsOf(entry).filter(
        (item) =>
          item.support_role === "supports_value" &&
          item.support_kind === "evidence" &&
          evidenceEntry(inp, item.evidence_unit_id) !== undefined,
      );
      return credits.length === 1
        ? supported("source_credit_one", claimId)
        : {
            klass: "source_credit_one",
            outcome: "violation",
            code: "source_credit_cardinality_mismatch",
            claim_id: claimId,
          };
    }
  }
  // durations: a clause context decides; nothing is exempt by its word alone
  if (
    (word in WORD_VALUES || /^\d+$/u.test(token.text)) &&
    /^\s*(?:ordinary\s+)?minutes?\b/u.test(after)
  ) {
    const [from, to] = clauseBounds(text, token.start16);
    const clause = text.slice(from, to);
    const before = text.slice(from, token.start16);
    if (
      predictions.some(
        (item) => item.anchor === anchor && item.text.includes(clause),
      ) &&
      clause.includes("next time") &&
      /\bI want\b/u.test(before)
    )
      return {
        klass: "duration_prospective_prediction",
        outcome: "no_finding",
      };
    if (
      /\bminutes that (?:still )?(?:felt|were|was|lasted)\b/u.test(
        text.slice(Math.max(0, token.end16 - 3), token.end16 + 40),
      )
    )
      return {
        klass: "duration_past_event",
        outcome: "violation",
        code: "precise_duration_unsupported",
      };
    if (/\bwhen\b[^,]*\bthe last\b/u.test(clause) && /\bfeel\b/u.test(clause))
      return {
        klass: "duration_conditional_generic",
        outcome: "proof_gap",
        code: "duration_context_unresolved",
      };
    return {
      klass: "duration_unclassified",
      outcome: "violation",
      code: "duration_context_unclassified",
    };
  }
  return {
    klass: "unclassified_numeral",
    outcome: "violation",
    code: "numeral_form_unclassified",
  };
}
/** The tenor carrier projection's `observation_count` when it equals its ordered observation list length, else -1. */
function tenorCarrierCount(inp: ComponentInputs, entry: Obj): number {
  for (const ref of refsOf(entry)) {
    const carrier = inp.facts.carriers.find(
      (row) =>
        `artifact:${strOf(row.artifact_id)}` === ref.external_support_identity,
    );
    const payload = carrier?.canonical_payload;
    const projection = isObj(payload) ? payload.projection : undefined;
    if (!isObj(projection)) continue;
    const observations = records(projection.observations);
    const count = projection.observation_count;
    return isInt(count) &&
      count === observations.length &&
      observations.every((item, index) => item.observation_order === index + 1)
      ? count
      : -1;
  }
  return -1;
}
/** Classifies every token of every child turn by role and order (never by a bag of numerals); each supported class also needs an authorised value relation. */
export function classifyNumerals(
  inp: ComponentInputs,
): NumeralClassification[] {
  const uses = allUses(inp.C);
  const predictions = predictionsOf(inp.C);
  const out: NumeralClassification[] = [];
  for (const turn of turnsOf(inp.C)) {
    const text = turnText(turn);
    const anchor = turnAnchor(turn);
    const here = uses.filter((ref) => useAnchor(ref.use) === anchor);
    for (const token of numeralTokens(text)) {
      let result = classifyToken(inp, text, anchor, here, predictions, token);
      if (
        result.outcome === "supported" &&
        result.claim_id !== undefined &&
        !valueAuthorized(inp, result.claim_id)
      )
        result = {
          klass: result.klass,
          outcome: "violation",
          code: "numeral_support_not_authorized",
          claim_id: result.claim_id,
        };
      out.push({
        anchor,
        token: token.text,
        start: token.start,
        end: token.end,
        klass: result.klass,
        outcome: result.outcome,
        ...(result.code !== undefined ? { code: result.code } : {}),
        ...(result.claim_id !== undefined ? { claim_id: result.claim_id } : {}),
      });
    }
  }
  return out;
}
/** Single-quoted phrases of one text with their code-point spans (an apostrophe inside a word never opens a quote). */
export interface QuotedPhrase {
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly start16: number;
}
export function quotedPhraseSpans(text: string): QuotedPhrase[] {
  const re = /(?<![\p{L}\p{N}_])'[^']+'(?![\p{L}\p{N}_])/gu;
  const out: QuotedPhrase[] = [];
  for (let m = re.exec(text); m !== null; m = re.exec(text))
    out.push({
      text: m[0],
      start: cpIndex(text, m.index),
      end: cpIndex(text, m.index + m[0].length),
      start16: m.index,
    });
  return out;
}
const METALINGUISTIC_LEAD = /(?:^|\s)the (?:phrase|word|term|expression)\s+$/u;
const ATTRIBUTION_VERB =
  /\b(?:said|says|told|tells|called|calls|wrote)\b|\baccording to\b/u;

// ---- one definition's computed result ---------------------------------------------------------------------------------------------------
export interface DefinitionResult {
  readonly key: GateDefinitionKey;
  readonly facts: Readonly<Record<string, number>>;
  readonly findings: readonly GateFinding[];
}
const anchorRank = (anchor: string | undefined): number =>
  anchor === undefined ? 0 : Number(anchor.slice(1));
/** Findings in a fixed order: turn sequence, span start, use index, code (equal keys keep their input order). */
export function sortFindings(list: readonly GateFinding[]): GateFinding[] {
  return list
    .map((item, order) => ({ item, order }))
    .sort(
      (a, b) =>
        anchorRank(a.item.anchor) - anchorRank(b.item.anchor) ||
        (a.item.span?.[0] ?? -1) - (b.item.span?.[0] ?? -1) ||
        (a.item.use_index ?? -1) - (b.item.use_index ?? -1) ||
        compareText(a.item.code, b.item.code) ||
        a.order - b.order,
    )
    .map((entry) => entry.item);
}
/** P0: `pass` needs a denominator derived independently of the child; a different examined count is a universal violation. */
function defResult(
  key: GateDefinitionKey,
  examined: number,
  expected: number,
  facts: Readonly<Record<string, number>>,
  findings: GateFinding[],
): DefinitionResult {
  if (examined !== expected) findings.push(finding("denominator_mismatch"));
  return {
    key,
    facts: { examined, expected_examined: expected, ...facts },
    findings: sortFindings(findings),
  };
}
const sameFields = (
  row: Obj,
  expected: Obj,
  fields: readonly string[],
): boolean => fields.every((field) => sameJson(row[field], expected[field]));
const usesOfKind = (payload: Obj, kind: UseKind): UseRef[] =>
  allUses(payload).filter((ref) => ref.kind === kind);
interface UsePair {
  readonly child: UseRef | undefined;
  readonly parent: UseRef | undefined;
}
/** Pairs the uses of a child and its parent by position within each kind (the claim uses, then the evidence uses). */
function pairUses(child: Obj, parent: Obj): UsePair[] {
  const out: UsePair[] = [];
  for (const kind of ["claim", "evidence"] as const) {
    const mine = usesOfKind(child, kind);
    const theirs = usesOfKind(parent, kind);
    for (let i = 0; i < Math.max(mine.length, theirs.length); i += 1)
      out.push({ child: mine[i], parent: theirs[i] });
  }
  return out;
}

/**
 * Exact per-kind correspondence of the payload uses and the stored relational rows. Ids must be unique and complete on both sides, and the
 * represented columns (turn id, claim/evidence target, mode, start, end) must be equal. `located` are payload uses whose row mate is missing,
 * duplicated or unequal (or whose own id is duplicated); `extra` counts stored rows with no payload mate.
 */
interface UseRowCorrespondence {
  readonly located: readonly UseRef[];
  readonly extra: number;
}
function useRowCorrespondence(
  inp: ComponentInputs,
  kind: UseKind,
): UseRowCorrespondence {
  const idKey = kind === "claim" ? "turn_claim_use_id" : "turn_evidence_use_id";
  const targetKey = kind === "claim" ? "claim_id" : "evidence_unit_id";
  const fields = ["turn_id", targetKey, "use_mode", "span_start", "span_end"];
  const uses = usesOfKind(inp.C, kind);
  const rows = kind === "claim" ? inp.rows.claim_uses : inp.rows.evidence_uses;
  const located = uses.filter((ref) => {
    const id = ref.use[idKey];
    const mates = rows.filter((row) => row[idKey] === id);
    const twins = uses.filter((other) => other.use[idKey] === id);
    const mate = mates[0];
    return (
      !isStr(id) ||
      mates.length !== 1 ||
      twins.length !== 1 ||
      mate === undefined ||
      !sameFields(mate, ref.use, fields)
    );
  });
  const extra = rows.filter(
    (row) => !uses.some((ref) => ref.use[idKey] === row[idKey]),
  ).length;
  return { located, extra };
}

// ---- Claims 1: presence ------------------------------------------------------------------------------------------------------------------
export function checkPresence(inp: ComponentInputs): DefinitionResult {
  const findings: GateFinding[] = [];
  const anchors = new Set(turnsOf(inp.C).map(turnAnchor));
  for (const ref of allUses(inp.C)) {
    const where = { anchor: useAnchor(ref.use), use_index: ref.index };
    if (!anchors.has(useAnchor(ref.use)))
      findings.push(finding("use_turn_unresolved", where));
    if (ref.kind === "claim") {
      const entry = claimEntry(inp, ref.use.claim_id);
      if (entry === undefined)
        findings.push(finding("claim_unresolved", where));
      else if (ref.use.claim_state_hash !== entry.frozen_state_hash)
        findings.push(finding("claim_state_hash_mismatch", where));
    } else {
      const entry = evidenceEntry(inp, ref.use.evidence_unit_id);
      if (entry === undefined)
        findings.push(finding("evidence_unresolved", where));
      else if (ref.use.rights_policy_version !== entry.rights_version_id)
        findings.push(finding("rights_version_mismatch", where));
    }
  }
  // the relational rows, per kind, independently of every other definition
  for (const kind of ["claim", "evidence"] as const) {
    const match = useRowCorrespondence(inp, kind);
    for (const ref of match.located)
      findings.push(
        finding("use_row_payload_mismatch", {
          anchor: useAnchor(ref.use),
          use_index: ref.index,
        }),
      );
    for (let i = 0; i < match.extra; i += 1)
      findings.push(finding("use_row_payload_mismatch"));
  }
  return defResult(
    "claims.presence",
    allUses(inp.C).length,
    allUses(inp.K).length,
    {
      claim_uses: claimUsesOf(inp.C).length,
      evidence_uses: evidenceUsesOf(inp.C).length,
      package_claims: packageClaims(inp).length,
      package_evidence: packageEvidence(inp).length,
    },
    findings,
  );
}

// ---- Claims 2: use permission ----------------------------------------------------------------------------------------------------------
const CLAIM_MODES: readonly string[] = [
  "asserted",
  "hedged",
  "attributed",
  "relied_on_silent",
];
const ALLOWED_MODES: Readonly<Record<string, readonly string[]>> = {
  assertable: ["asserted", "hedged", "attributed"],
  hedged_only: ["hedged", "attributed"],
  silent: ["relied_on_silent"],
};
const EVIDENCE_MODES: readonly string[] = ["quoted", "paraphrased"];
export function checkUsePermission(inp: ComponentInputs): DefinitionResult {
  const findings: GateFinding[] = [];
  const count = {
    asserted: 0,
    hedged: 0,
    attributed: 0,
    relied_on_silent: 0,
    quoted: 0,
    paraphrased: 0,
  };
  for (const ref of allUses(inp.C)) {
    const where = { anchor: useAnchor(ref.use), use_index: ref.index };
    const mode = strOf(ref.use.use_mode);
    if (ref.kind === "evidence") {
      if (!EVIDENCE_MODES.includes(mode))
        findings.push(finding("evidence_mode_unknown", where));
      else if (mode === "quoted") count.quoted += 1;
      else count.paraphrased += 1;
      continue;
    }
    if (!CLAIM_MODES.includes(mode)) {
      findings.push(finding("mode_unknown", where));
      continue;
    }
    count[mode as "asserted" | "hedged" | "attributed" | "relied_on_silent"] +=
      1;
    const entry = claimEntry(inp, ref.use.claim_id);
    if (entry === undefined) continue;
    const allowed = ALLOWED_MODES[strOf(entry.effective_usage_class)];
    if (!allowed?.includes(mode))
      findings.push(finding("mode_illegal_for_class", where));
  }
  return defResult(
    "claims.use_permission",
    allUses(inp.C).length,
    allUses(inp.K).length,
    count,
    findings,
  );
}

// ---- Claims 3: silent non-leak ------------------------------------------------------------------------------------------------------------
const NUMBER_WORDS: readonly string[] = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS_WORDS: readonly string[] = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];
/** English words of 0..99 (hyphenated above twenty), for the closed silent-value forms. */
export function numberWords(value: number): string | undefined {
  if (!Number.isInteger(value) || value < 0 || value > 99) return undefined;
  if (value < 20) return NUMBER_WORDS[value];
  const tens = TENS_WORDS[Math.floor(value / 10)] ?? "";
  return value % 10 === 0 ? tens : `${tens}-${NUMBER_WORDS[value % 10] ?? ""}`;
}
/** The surface forms of a silent exact-decimal value: the scalar itself, its fractional digits without a leading zero, and those digits as words. */
export function silentValueForms(entry: Obj): string[] {
  const value = isObj(entry.value) ? entry.value : {};
  const scalar = strOf(value.scalar);
  const match = /^0\.(\d{1,2})$/u.exec(scalar);
  if (match === null) return scalar === "" ? [] : [scalar];
  const digits = String(Number(match[1]));
  const words = numberWords(Number(match[1]));
  return [
    scalar,
    digits,
    ...(words !== undefined ? [words, words.replace("-", " ")] : []),
  ];
}
const silentClaimIds = (inp: ComponentInputs): string[] => [
  ...new Set([
    ...records(inp.pkg.silent_inputs).map((item) => strOf(item.claim_id)),
    ...packageClaims(inp)
      .filter((entry) => entry.effective_usage_class === "silent")
      .map((entry) => strOf(entry.claim_id)),
  ]),
];
const silentEvidenceIds = (inp: ComponentInputs): string[] => [
  ...new Set([
    ...records(inp.pkg.silent_inputs).flatMap((item) =>
      strings(item.support_refs),
    ),
    ...inp.facts.evidence
      .filter((row) => row.usage_class === "silent")
      .map((row) => strOf(row.evidence_unit_id)),
  ]),
];
export function checkSilentNonLeak(inp: ComponentInputs): DefinitionResult {
  const findings: GateFinding[] = [];
  const claims = silentClaimIds(inp);
  const evidence = silentEvidenceIds(inp);
  let claimUses = 0;
  let evidenceUses = 0;
  for (const ref of allUses(inp.C)) {
    const where = { anchor: useAnchor(ref.use), use_index: ref.index };
    if (ref.kind === "claim" && claims.includes(strOf(ref.use.claim_id))) {
      claimUses += 1;
      findings.push(finding("silent_claim_used", where));
    }
    if (
      ref.kind === "evidence" &&
      evidence.includes(strOf(ref.use.evidence_unit_id))
    ) {
      evidenceUses += 1;
      findings.push(finding("silent_evidence_used", where));
    }
  }
  let valueMatches = 0;
  let runMatches = 0;
  for (const claimId of claims) {
    const entry = claimEntry(inp, claimId);
    if (entry === undefined) continue;
    const forms = silentValueForms(entry);
    for (const turn of turnsOf(inp.C)) {
      const text = turnText(turn);
      for (const form of forms) {
        const re = new RegExp(
          `(?<![\\p{L}\\p{N}.])${form.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?![\\p{L}\\p{N}])`,
          "giu",
        );
        for (let m = re.exec(text); m !== null; m = re.exec(text)) {
          valueMatches += 1;
          findings.push(
            finding("silent_value_reproduced", {
              anchor: turnAnchor(turn),
              span: [
                cpIndex(text, m.index),
                cpIndex(text, m.index + m[0].length),
              ],
            }),
          );
        }
      }
    }
    const constraints = records(inp.brief.programming_constraints);
    if (
      !constraints.some(
        (item) =>
          item.type === "silent_claim_non_speak" && item.claim_id === claimId,
      )
    )
      findings.push(finding("silent_constraint_missing"));
  }
  for (const turn of turnsOf(inp.C))
    if (
      inp.originals.some((original) =>
        sharesRun(turnText(turn), original, GUARD_RUN),
      )
    ) {
      runMatches += 1;
      findings.push(
        finding("withheld_run_present", { anchor: turnAnchor(turn) }),
      );
    }
  const expected =
    records(inp.pkg.silent_inputs).length +
    inp.facts.evidence.filter((row) => row.usage_class === "silent").length;
  return defResult(
    "claims.silent_non_leak",
    claims.length + evidence.length,
    expected,
    {
      silent_claims: claims.length,
      silent_claim_uses: claimUses,
      silent_evidence_units: evidence.length,
      silent_evidence_uses: evidenceUses,
      turns_scanned: turnsOf(inp.C).length,
      silent_value_matches: valueMatches,
      withheld_run_matches: runMatches,
    },
    findings,
  );
}

// ---- Claims 4: value support ---------------------------------------------------------------------------------------------------------------
export function checkValueSupport(inp: ComponentInputs): DefinitionResult {
  const findings: GateFinding[] = [];
  const classified = classifyNumerals(inp);
  let supportedCount = 0;
  let noFinding = 0;
  for (const item of classified) {
    if (item.outcome === "supported") supportedCount += 1;
    else if (item.outcome === "no_finding") noFinding += 1;
    else if (item.code !== undefined)
      findings.push(
        finding(item.code, {
          anchor: item.anchor,
          span: [item.start, item.end],
        }),
      );
  }
  const expected = turnsOf(inp.K).reduce(
    (sum, turn) => sum + numeralTokens(turnText(turn)).length,
    0,
  );
  return defResult(
    "claims.value_support",
    classified.length,
    expected,
    {
      supported: supportedCount,
      no_finding_context: noFinding,
      violations: findings.filter((item) => item.class === "violation").length,
      proof_gaps: findings.filter((item) => item.class === "proof_gap").length,
    },
    findings,
  );
}

// ---- Claims 5: quote permission -----------------------------------------------------------------------------------------------------------
/**
 * The per-quotation approval predicate shared by check 5 and the numeric context: the closed defect codes of one evidence use with mode
 * `quoted` (package and rights permission flags, locator identity, the approved representation, the quote marks and the span). Empty iff approved.
 */
export function quoteDefects(
  inp: ComponentInputs,
  ref: UseRef,
): ViolationCode[] {
  const defects: ViolationCode[] = [];
  const entry = evidenceEntry(inp, ref.use.evidence_unit_id);
  const rights = factRights(inp, ref.use.rights_policy_version);
  const policy =
    rights !== undefined && isObj(rights.policy) ? rights.policy : {};
  if (entry?.quote_permission !== true || policy.quotation_permission !== true)
    defects.push("quote_not_permitted");
  const locator =
    entry !== undefined && isObj(entry.locator) ? entry.locator : undefined;
  if (
    locator === undefined ||
    locator.evidence_unit_id !== ref.use.evidence_unit_id
  )
    defects.push("quote_locator_missing");
  const approved =
    entry !== undefined && isObj(entry.permitted_quote)
      ? strOf(entry.permitted_quote.text)
      : undefined;
  const spanText = useText(inp.C, ref.use);
  const text = textByAnchor(inp.C).get(useAnchor(ref.use)) ?? "";
  const pairs = quotedPhraseSpans(text).filter(
    (item) =>
      item.start === intOf(ref.use.span_start) &&
      item.end === intOf(ref.use.span_end),
  );
  if (
    !spanText.startsWith("'") ||
    !spanText.endsWith("'") ||
    spanText.length < 3 ||
    pairs.length !== 1
  )
    defects.push("quote_marks_absent");
  else if (
    approved === undefined ||
    cpSlice(spanText, 1, cpArray(spanText).length - 1) !== approved
  )
    defects.push("quote_text_not_approved_representation");
  return defects;
}
export function checkQuotePermission(inp: ComponentInputs): DefinitionResult {
  const findings: GateFinding[] = [];
  const quoted = usesOfKind(inp.C, "evidence").filter(
    (ref) => ref.use.use_mode === "quoted",
  );
  for (const ref of quoted) {
    const where = { anchor: useAnchor(ref.use), use_index: ref.index };
    for (const code of quoteDefects(inp, ref))
      findings.push(finding(code, where));
  }
  // every other single-quoted phrase is an evidence quotation, a metalinguistic mention, or an unlicensed quotation
  const approvedTexts = packageEvidence(inp)
    .map((entry) =>
      isObj(entry.permitted_quote) ? strOf(entry.permitted_quote.text) : "",
    )
    .filter((item) => item !== "");
  let mentions = 0;
  let seen = 0;
  const evidenceUses = usesOfKind(inp.C, "evidence");
  for (const turn of turnsOf(inp.C)) {
    const text = turnText(turn);
    const anchor = turnAnchor(turn);
    for (const phrase of quotedPhraseSpans(text)) {
      seen += 1;
      const covered = evidenceUses.filter(
        (ref) =>
          useAnchor(ref.use) === anchor &&
          intOf(ref.use.span_start) <= phrase.start &&
          phrase.end <= intOf(ref.use.span_end),
      );
      if (covered.some((ref) => ref.use.use_mode === "quoted")) continue;
      const [from, to] = clauseBounds(text, phrase.start16);
      const inner = cpSlice(phrase.text, 1, cpArray(phrase.text).length - 1);
      const mention =
        covered.length === 0 &&
        METALINGUISTIC_LEAD.test(text.slice(from, phrase.start16)) &&
        !ATTRIBUTION_VERB.test(text.slice(from, to)) &&
        !approvedTexts.includes(inner) &&
        !inp.originals.some((original) =>
          sharesRun(phrase.text, original, GUARD_RUN),
        );
      if (mention) mentions += 1;
      else
        findings.push(
          finding("quote_without_use", {
            anchor,
            span: [phrase.start, phrase.end],
          }),
        );
    }
  }
  return defResult(
    "claims.quote_permission",
    quoted.length,
    usesOfKind(inp.K, "evidence").filter((ref) => ref.use.use_mode === "quoted")
      .length,
    {
      quoted_uses: quoted.length,
      metalinguistic_mentions: mentions,
      quote_pairs_seen: seen,
    },
    findings,
  );
}

// ---- Claims 6: paraphrase permission ------------------------------------------------------------------------------------------------------
export function checkParaphrasePermission(
  inp: ComponentInputs,
): DefinitionResult {
  const findings: GateFinding[] = [];
  const paraphrased = usesOfKind(inp.C, "evidence").filter(
    (ref) => ref.use.use_mode === "paraphrased",
  );
  let overlaps = 0;
  for (const ref of paraphrased) {
    const where = { anchor: useAnchor(ref.use), use_index: ref.index };
    const entry = evidenceEntry(inp, ref.use.evidence_unit_id);
    const rights = factRights(inp, ref.use.rights_policy_version);
    const policy =
      rights !== undefined && isObj(rights.policy) ? rights.policy : {};
    if (
      entry?.paraphrase_permission !== true ||
      policy.paraphrase_permission !== true
    )
      findings.push(finding("paraphrase_not_permitted", where));
    const spanText = useText(inp.C, ref.use);
    if (quotedPhraseSpans(spanText).length > 0)
      findings.push(finding("quote_marks_on_paraphrase", where));
    if (
      inp.originals.some((original) => sharesRun(spanText, original, GUARD_RUN))
    ) {
      overlaps += 1;
      findings.push(finding("overlap_run_24", where));
    }
  }
  return defResult(
    "claims.paraphrase_permission",
    paraphrased.length,
    usesOfKind(inp.K, "evidence").filter(
      (ref) => ref.use.use_mode === "paraphrased",
    ).length,
    {
      paraphrased_uses: paraphrased.length,
      overlap_matches: overlaps,
      guard_run_cp: GUARD_RUN,
    },
    findings,
  );
}

// ---- Claims 7: speaker attribution ------------------------------------------------------------------------------------------------------
const requiresAttribution = (entry: Obj | undefined): boolean =>
  entry !== undefined &&
  isObj(entry.attribution_requirement) &&
  entry.attribution_requirement.required === true;
export function checkSpeakerAttribution(
  inp: ComponentInputs,
): DefinitionResult {
  const findings: GateFinding[] = [];
  const required = usesOfKind(inp.C, "claim").filter((ref) =>
    requiresAttribution(claimEntry(inp, ref.use.claim_id)),
  );
  let matches = 0;
  for (const ref of required) {
    const where = { anchor: useAnchor(ref.use), use_index: ref.index };
    const entry = claimEntry(inp, ref.use.claim_id);
    const requirement = isObj(entry?.attribution_requirement)
      ? entry.attribution_requirement
      : {};
    const prefix = strOf(requirement.approved_prefix);
    const text = textByAnchor(inp.C).get(useAnchor(ref.use)) ?? "";
    const start = intOf(ref.use.span_start);
    if (
      prefix !== "" &&
      cpSlice(text, start, start + cpArray(prefix).length) === prefix
    )
      matches += 1;
    else findings.push(finding("attribution_prefix_missing", where));
    if (!["attributed", "hedged"].includes(strOf(ref.use.use_mode)))
      findings.push(finding("attribution_mode_illegal", where));
  }
  const speakers = usesOfKind(inp.C, "evidence").filter((ref) => {
    const speaker = evidenceEntry(
      inp,
      ref.use.evidence_unit_id,
    )?.speaker_identity;
    return (
      ref.use.use_mode === "quoted" && speaker !== undefined && speaker !== null
    );
  }).length;
  return defResult(
    "claims.speaker_attribution",
    required.length,
    usesOfKind(inp.K, "claim").filter((ref) =>
      requiresAttribution(claimEntry(inp, ref.use.claim_id)),
    ).length,
    { prefix_matches: matches, quoted_speaker_fields_available: speakers },
    findings,
  );
}

// ---- Claims 8: claim state ----------------------------------------------------------------------------------------------------------------
const usedClaimIds = (payload: Obj): string[] => [
  ...new Set(claimUsesOf(payload).map((use) => strOf(use.claim_id))),
];
export function checkClaimState(inp: ComponentInputs): DefinitionResult {
  const findings: GateFinding[] = [];
  let confirmed = 0;
  const uses = usesOfKind(inp.C, "claim");
  for (const claimId of usedClaimIds(inp.C)) {
    const entry = claimEntry(inp, claimId);
    const mine = uses.filter((ref) => ref.use.claim_id === claimId);
    const first = mine[0];
    if (entry === undefined || first === undefined) continue;
    const where = { anchor: useAnchor(first.use), use_index: first.index };
    if (entry.frozen_state === "confirmed") confirmed += 1;
    else findings.push(finding("claim_state_not_assertable", where));
    const recomputed = safeFrozenHash(entry);
    for (const ref of mine)
      if (
        recomputed === undefined ||
        recomputed !== entry.frozen_state_hash ||
        recomputed !== ref.use.claim_state_hash
      )
        findings.push(
          finding("frozen_state_hash_recomputed_mismatch", {
            anchor: useAnchor(ref.use),
            use_index: ref.index,
          }),
        );
  }
  return defResult(
    "claims.claim_state",
    usedClaimIds(inp.C).length,
    usedClaimIds(inp.K).length,
    { confirmed },
    findings,
  );
}
function safeFrozenHash(entry: Obj): string | undefined {
  try {
    return frozenStateHash(strOf(entry.claim_content_hash), {
      state: entry.frozen_state as "confirmed",
      reduced_usage_class: entry.reduced_usage_class as "assertable",
      effective_usage_class: entry.effective_usage_class as "assertable",
    });
  } catch (error) {
    if (error instanceof Error) return undefined;
    throw error;
  }
}

// ---- Claims 9: program history ------------------------------------------------------------------------------------------------------------
export function checkProgramHistory(inp: ComponentInputs): DefinitionResult {
  const findings: GateFinding[] = [];
  const isHistory = (id: unknown): boolean =>
    claimEntry(inp, id)?.kind === "program_history";
  const uses = usesOfKind(inp.C, "claim").filter((ref) =>
    isHistory(ref.use.claim_id),
  );
  const mappings = records(inp.brief.topic_thread_mappings);
  const turns = new Map(
    turnsOf(inp.C).map((turn) => [
      turnAnchor(turn),
      strOf(turn.program_block_id),
    ]),
  );
  for (const ref of uses) {
    const where = { anchor: useAnchor(ref.use), use_index: ref.index };
    const entry = claimEntry(inp, ref.use.claim_id);
    const support = refsOf(entry).find(
      (item) => item.support_kind === "continuity",
    );
    const id = isStr(support?.external_support_identity)
      ? support.external_support_identity
      : "";
    const continuity = records(inp.pkg.continuity).find(
      (item) =>
        `artifact:${strOf(item.continuity_id).replace(/^artifact:/u, "")}` ===
          id && id !== "",
    );
    if (
      support === undefined ||
      continuity === undefined ||
      !supportProof(inp, support)
    ) {
      findings.push(finding("continuity_unresolved", where));
      continue;
    }
    if (continuity.published_only !== true || continuity.withdrawn !== false)
      findings.push(finding("continuity_withdrawn_or_draft", where));
    const thread = strOf(continuity.topic_thread_id);
    const block = turns.get(useAnchor(ref.use)) ?? "";
    const claimThread = isObj(entry?.value)
      ? entry.value.topic_thread_id
      : undefined;
    if (
      claimThread !== thread ||
      !mappings.some(
        (item) =>
          item.topic_thread_id === thread &&
          strings(item.block_ids).includes(block),
      )
    )
      findings.push(finding("continuity_topic_mismatch", where));
  }
  return defResult(
    "claims.program_history",
    uses.length,
    usesOfKind(inp.K, "claim").filter((ref) => isHistory(ref.use.claim_id))
      .length,
    {},
    findings,
  );
}

// ---- Claims 10: desk derivation (metadata only; the count re-execution stays a permanent proof gap) -------------------------------------
const DERIVATION_PARAMETERS = deepFreeze({
  after_minute: 80,
  window_matches: 5,
});
const DERIVATION_EVIDENCE_SUFFIX: readonly string[] = [
  "12",
  "13",
  "14",
  "15",
  "16",
];
export function checkDerivationMetadata(inp: ComponentInputs): {
  readonly consistent: boolean;
  readonly findings: readonly GateFinding[];
} {
  const findings: GateFinding[] = [];
  const run = inp.facts.derivation;
  if (run === undefined)
    return { consistent: false, findings: [finding("derivation_missing")] };
  const claim = packageClaims(inp).find(
    (entry) => entry.kind === "desk_derived",
  );
  if (run.rule_version !== GATE_PIN.derivation_rule_version)
    findings.push(finding("derivation_rule_mismatch"));
  if (!sameJson(run.parameters, DERIVATION_PARAMETERS))
    findings.push(finding("derivation_parameters_mismatch"));
  if (claim === undefined || !sameJson(run.output, claim.value))
    findings.push(finding("derivation_output_mismatch"));
  let outputHash: string | undefined;
  try {
    outputHash = derivationOutputHash(run.output);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
  }
  const supportHashes = [
    ...refsOf(claim).filter((item) => item.support_kind === "derivation"),
    ...inp.facts.supports.filter(
      (item) => item.derivation_run_id === run.derivation_run_id,
    ),
  ].map((item) => item.support_hash);
  if (
    outputHash === undefined ||
    run.output_hash !== outputHash ||
    supportHashes.length === 0 ||
    supportHashes.some((item) => item !== outputHash)
  )
    findings.push(finding("derivation_hash_mismatch"));
  const refs = records(run.exact_input_refs);
  const proof = isObj(inp.pkg.selection_provenance)
    ? inp.pkg.selection_provenance.match_window_proof
    : undefined;
  const refsOk =
    refs.length === DERIVATION_EVIDENCE_SUFFIX.length &&
    refs.every((item, index) => {
      const id = strOf(item.evidence_unit_id);
      return (
        id.endsWith(DERIVATION_EVIDENCE_SUFFIX[index] ?? "?") &&
        item.content_hash === factEvidence(inp, id)?.content_hash &&
        item.content_hash === evidenceEntry(inp, id)?.content_hash
      );
    });
  if (!refsOk) findings.push(finding("derivation_input_ref_mismatch"));
  const selected = isObj(proof) ? strings(proof.selected_event_identities) : [];
  const windowOk =
    isObj(proof) &&
    refs.length === DERIVATION_PARAMETERS.window_matches &&
    refs.every((item, index) => {
      const provenance = isObj(item.selected_provenance)
        ? item.selected_provenance
        : {};
      return (
        provenance.window_order === index + 1 &&
        provenance.event_identity === selected[index] &&
        provenance.competition_identity === proof.competition_identity &&
        provenance.entity_identity === proof.entity_identity &&
        provenance.as_of === proof.as_of &&
        provenance.window_identity === proof.window_identity &&
        sameJson(item.window_proof, proof)
      );
    }) &&
    sameJson(
      selected,
      records(proof.ordered_prior_schedule)
        .slice(0, DERIVATION_PARAMETERS.window_matches)
        .map((item) => item.event_identity),
    );
  if (!windowOk) findings.push(finding("derivation_window_mismatch"));
  return { consistent: findings.length === 0, findings };
}
export function checkDeskDerivation(inp: ComponentInputs): DefinitionResult {
  const metadata = checkDerivationMetadata(inp);
  const findings: GateFinding[] = [
    ...metadata.findings,
    finding("required_proof_not_established", {
      ref: "derivation_count_reexecution",
    }),
  ];
  const derived = (payload: Obj): string[] =>
    usedClaimIds(payload).filter(
      (id) => claimEntry(inp, id)?.kind === "desk_derived",
    );
  const run = inp.facts.derivation;
  return defResult(
    "claims.desk_derivation",
    derived(inp.C).length,
    derived(inp.K).length,
    {
      input_refs: run === undefined ? 0 : records(run.exact_input_refs).length,
      window_matches: DERIVATION_PARAMETERS.window_matches,
      desk_derived_uses: claimUsesOf(inp.C).filter(
        (use) => claimEntry(inp, use.claim_id)?.kind === "desk_derived",
      ).length,
      metadata_checks_passed: metadata.consistent ? 1 : 0,
    },
    findings,
  );
}

// ---- Claims 11: incident status -----------------------------------------------------------------------------------------------------------
const INCIDENT_KINDS: readonly string[] = ["incident", "rumor"];
export function checkIncidentStatus(inp: ComponentInputs): DefinitionResult {
  const findings: GateFinding[] = [];
  const uses = usesOfKind(inp.C, "claim").filter((ref) =>
    INCIDENT_KINDS.includes(strOf(claimEntry(inp, ref.use.claim_id)?.kind)),
  );
  for (const ref of uses)
    findings.push(
      finding("incident_claim_used", {
        anchor: useAnchor(ref.use),
        use_index: ref.index,
      }),
    );
  const availability = isObj(inp.pkg.availability) ? inp.pkg.availability : {};
  const incident = isObj(availability.serious_incident)
    ? availability.serious_incident
    : {};
  if (
    incident.state !== "absent" ||
    !records(inp.pkg.sensitivities).some((item) => item.state === "none")
  )
    findings.push(finding("incident_witness_missing"));
  return defResult(
    "claims.incident_status",
    2,
    2,
    { incident_claims: uses.length },
    findings,
  );
}

// ---- Claims 12: span integrity ------------------------------------------------------------------------------------------------------------
/** The code-point shift of a parent position: the net length change of every rewrite row of the anchor that ends at or before it. */
export function rewriteShift(
  parentText: string,
  anchor: string,
  bound: number,
  rewrites: readonly TextureRewriteRow[],
): number {
  let shift = 0;
  for (const row of rewrites) {
    if (row.anchor !== anchor) continue;
    const at = parentText.indexOf(row.old);
    if (at < 0 || parentText.includes(row.old, at + 1)) continue;
    if (cpIndex(parentText, at + row.old.length) <= bound)
      shift += codePointLength(row.new) - codePointLength(row.old);
  }
  return shift;
}
const tupleOf = (ref: UseRef): unknown[] =>
  ref.kind === "claim"
    ? [
        ref.use.semantic_turn_id,
        ref.use.claim_id,
        ref.use.use_mode,
        ref.use.claim_state_hash,
      ]
    : [
        ref.use.semantic_turn_id,
        ref.use.evidence_unit_id,
        ref.use.use_mode,
        ref.use.rights_policy_version,
      ];
export function checkSpanIntegrity(inp: ComponentInputs): DefinitionResult {
  const findings: GateFinding[] = [];
  const childTexts = textByAnchor(inp.C);
  const parentTexts = textByAnchor(inp.K);
  let shifted = 0;
  for (const pair of pairUses(inp.C, inp.K)) {
    const present = pair.child ?? pair.parent;
    if (present === undefined) continue;
    const where = { anchor: useAnchor(present.use), use_index: present.index };
    const mine = pair.child;
    const mate = pair.parent;
    if (mine !== undefined) {
      const start = intOf(mine.use.span_start);
      const end = intOf(mine.use.span_end);
      const length = codePointLength(childTexts.get(useAnchor(mine.use)) ?? "");
      if (start < 0 || end <= start || end > length)
        findings.push(finding("span_out_of_range", where));
    }
    if (mine === undefined || mate === undefined) {
      findings.push(finding("use_tuple_changed", where));
      continue;
    }
    if (!sameJson(tupleOf(mine), tupleOf(mate)))
      findings.push(finding("use_tuple_changed", where));
    const before = parentTexts.get(useAnchor(mate.use)) ?? "";
    if (
      useText(inp.C, mine.use) !==
      cpSlice(before, intOf(mate.use.span_start), intOf(mate.use.span_end))
    )
      findings.push(finding("span_text_changed", where));
    const expectedStart =
      intOf(mate.use.span_start) +
      rewriteShift(
        before,
        useAnchor(mate.use),
        intOf(mate.use.span_start),
        inp.rewrites,
      );
    const expectedEnd =
      intOf(mate.use.span_end) +
      rewriteShift(
        before,
        useAnchor(mate.use),
        intOf(mate.use.span_end),
        inp.rewrites,
      );
    if (
      intOf(mine.use.span_start) !== expectedStart ||
      intOf(mine.use.span_end) !== expectedEnd
    )
      findings.push(finding("span_shift_mismatch", where));
    else if (expectedStart !== intOf(mate.use.span_start)) shifted += 1;
  }
  return defResult(
    "claims.span_integrity",
    allUses(inp.C).length,
    allUses(inp.K).length,
    { shifted_spans: shifted },
    findings,
  );
}

// ---- preconditions 13 and 14 (no durable row; a failure is a stop) ----------------------------------------------------------------------
export type PreconditionResult =
  | {
      readonly ok: true;
      readonly claims13: {
        readonly verified: number;
        readonly events: number;
        readonly limits: readonly CoverageLimit[];
      };
      readonly claims14: { readonly verified: number };
    }
  | { readonly ok: false; readonly check: 13 | 14 };
const LIMIT_CODES: readonly CoverageLimit[] = [
  "historical_visibility_unprovable",
  "frozen_ceiling_unavailable",
];
/** Claims 13 (state reconstruction) and 14 (support identity). Check 13 runs first. */
export function checkPreconditions(inp: ComponentInputs): PreconditionResult {
  const limits = new Set<CoverageLimit>();
  let verified = 0;
  for (const entry of packageClaims(inp)) {
    const identity = inp.facts.claims.find(
      (row) => row.claim_id === entry.claim_id,
    );
    if (identity === undefined) return { ok: false, check: 13 };
    try {
      const result = verifyFrozenEntry({
        entry,
        claim: {
          claim_id: strOf(identity.claim_id),
          content_hash: strOf(identity.content_hash),
          initial_status: identity.initial_status,
          initial_usage_class: identity.initial_usage_class,
        },
        liveEvents: inp.facts.events.filter(
          (row) => row.claim_id === entry.claim_id,
        ),
        frozenCeiling: { unavailable: true },
        currentCeiling: "assertable",
      });
      if (result.materialDifference || result.liveEventsAfterCursor !== 0)
        return { ok: false, check: 13 };
      for (const text of result.limits)
        for (const code of LIMIT_CODES)
          if (text.startsWith(`${code}:`)) limits.add(code);
      verified += 1;
    } catch (error) {
      if (!(error instanceof ClaimStateError)) throw error;
      return { ok: false, check: 13 };
    }
  }
  let supportsVerified = 0;
  for (const entry of packageClaims(inp))
    for (const ref of refsOf(entry)) {
      if (
        !supportProof(inp, ref) ||
        !packageSupportMatches(inp, entry.claim_id, ref)
      )
        return { ok: false, check: 14 };
      supportsVerified += 1;
    }
  return {
    ok: true,
    claims13: {
      verified,
      events: inp.facts.events.length,
      limits: LIMIT_CODES.filter((code) => limits.has(code)),
    },
    claims14: { verified: supportsVerified },
  };
}

// ---- Writing 13 (H1): participant validity ----------------------------------------------------------------------------------------------
export function checkParticipantValidity(
  inp: ComponentInputs,
): DefinitionResult {
  const findings: GateFinding[] = [];
  const profiles = records(inp.statics.profiles.profiles);
  const leads = new Set(
    records(inp.brief.program_blocks).flatMap((block) =>
      records(block.participant_leads).map((lead) =>
        strOf(lead.participant_id),
      ),
    ),
  );
  const versions = isObj(inp.writer.character_profile_versions)
    ? inp.writer.character_profile_versions
    : {};
  for (const turn of turnsOf(inp.C)) {
    const id = strOf(turn.participant_id);
    const profile = profiles.find((item) => item.participant_id === id);
    const where = { anchor: turnAnchor(turn) };
    if (profile === undefined || !leads.has(id))
      findings.push(finding("participant_not_in_roster", where));
    else if (versions[id] !== profile.participant_profile_version_id)
      findings.push(finding("participant_profile_unbound", where));
  }
  return defResult(
    "writing.participant_validity",
    turnsOf(inp.C).length,
    turnsOf(inp.K).length,
    {
      roster_members: profiles.length,
      profile_versions_bound: profiles.filter(
        (item) =>
          versions[strOf(item.participant_id)] ===
          item.participant_profile_version_id,
      ).length,
    },
    findings,
  );
}

// ---- Writing 14 (H2): planned block membership --------------------------------------------------------------------------------------------
const briefBlocks = (inp: ComponentInputs): Obj[] =>
  [...records(inp.brief.program_blocks)].sort(
    (a, b) => intOf(a.sequence) - intOf(b.sequence),
  );
export function checkPlannedBlockMembership(
  inp: ComponentInputs,
): DefinitionResult {
  const findings: GateFinding[] = [];
  const blocks = briefBlocks(inp);
  const rank = new Map(
    blocks.map((block, index) => [strOf(block.program_block_id), index]),
  );
  let previousRank = -1;
  turnsOf(inp.C).forEach((turn, index) => {
    const where = { anchor: turnAnchor(turn) };
    const at = rank.get(strOf(turn.program_block_id));
    if (at === undefined) findings.push(finding("turn_block_detached", where));
    else {
      if (at < previousRank)
        findings.push(finding("turn_sequence_invalid", where));
      previousRank = Math.max(previousRank, at);
    }
    if (intOf(turn.sequence) !== index + 1)
      findings.push(finding("turn_sequence_invalid", where));
  });
  return defResult(
    "writing.planned_block_membership",
    turnsOf(inp.C).length,
    turnsOf(inp.K).length,
    { brief_blocks: blocks.length },
    findings,
  );
}

// ---- Writing 15 (H3): required blocks ------------------------------------------------------------------------------------------------------
export function checkRequiredBlocks(inp: ComponentInputs): DefinitionResult {
  const findings: GateFinding[] = [];
  const blocks = briefBlocks(inp);
  const slots = records(inp.statics.template.slots);
  const required = slots.filter((slot) => slot.required === true);
  const optional = slots.filter((slot) => slot.required !== true);
  const types = blocks.map((block) => strOf(block.block_type));
  const order = required.map((slot) => strOf(slot.block_type));
  if (order.some((type) => !types.includes(type)))
    findings.push(finding("block_missing"));
  else if (
    !sameJson(
      types.filter((type) => order.includes(type)),
      order,
    )
  )
    findings.push(finding("block_order_mismatch"));
  const mode = strOf(inp.statics.template.mode);
  const registry = records(inp.statics.modes.values).map((item) =>
    strOf(item.id),
  );
  if (
    inp.brief.rundown_template_version_id !==
      inp.statics.template.rundown_template_version_id ||
    inp.brief.selected_mode !== mode ||
    !registry.includes(mode)
  )
    findings.push(finding("template_version_mismatch"));
  const registered = records(inp.statics.block_types.values).map((item) =>
    strOf(item.id),
  );
  if (types.some((type) => !registered.includes(type)))
    findings.push(finding("block_unplanned"));
  const refs = strings(inp.C.program_block_refs);
  const planned = blocks.map((block) => strOf(block.program_block_id));
  if (refs.length < planned.length || planned.some((id) => !refs.includes(id)))
    findings.push(finding("block_missing"));
  else if (refs.some((id) => !planned.includes(id)))
    findings.push(finding("block_unplanned"));
  else if (!sameJson(refs, planned))
    findings.push(finding("block_order_mismatch"));
  const used = new Set(
    turnsOf(inp.C).map((turn) => strOf(turn.program_block_id)),
  );
  let withTurns = 0;
  for (const id of planned) {
    if (used.has(id)) withTurns += 1;
    else findings.push(finding("block_without_turn"));
  }
  for (const turn of turnsOf(inp.C))
    if (!planned.includes(strOf(turn.program_block_id)))
      findings.push(finding("block_unplanned", { anchor: turnAnchor(turn) }));
  const ritualCap = isObj(inp.statics.template.feature_rules)
    ? inp.statics.template.feature_rules.character_ritual_max_per_episode
    : undefined;
  if (
    isInt(ritualCap) &&
    records(inp.brief.feature_selections).length > ritualCap
  )
    findings.push(finding("block_unplanned"));
  return defResult(
    "writing.required_blocks",
    required.length,
    strings(inp.K.program_block_refs).length,
    {
      template_required_slots: required.length,
      optional_slots_omitted: optional.filter(
        (slot) => !types.includes(strOf(slot.block_type)),
      ).length,
      blocks_with_turns: withTurns,
    },
    findings,
  );
}

// ---- Writing 16 (H11, H12): provider markup and pronunciation respelling lint ---------------------------------------------------------------
export const MARKUP_CHARS = new Set(Array.from('[]<>{}|="`~^\\_'));
export const KNOWN_TAGS: readonly RegExp[] = [
  /\bstyle=/giu,
  /\[[a-z]+\]/giu,
  /<[a-z]+>/giu,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/giu,
  /\bssml\b|\bvoice(?:_id|-id)?\s*[=:]/giu,
];
export function checkProviderMarkup(inp: ComponentInputs): DefinitionResult {
  const findings: GateFinding[] = [];
  const seen = new Set<string>();
  let forbidden = 0;
  let respelling = 0;
  const canonical = new Map(
    inp.facts.pronunciations.map((item) => [
      strOf(item.pronunciation_id),
      strOf(item.canonical_text),
    ]),
  );
  const respelled = new Set(
    inp.facts.renderings
      .filter(
        (item) =>
          item.rendering !== canonical.get(strOf(item.pronunciation_id)),
      )
      .map((item) => strOf(item.rendering))
      .filter((item) => item !== ""),
  );
  for (const turn of turnsOf(inp.C)) {
    const text = turnText(turn);
    const anchor = turnAnchor(turn);
    let offset = 0;
    for (const char of Array.from(text)) {
      if (!/[\p{L}\p{N}]/u.test(char)) seen.add(char);
      if (MARKUP_CHARS.has(char)) {
        forbidden += 1;
        findings.push(
          finding("provider_char_class", {
            anchor,
            span: [offset, offset + 1],
          }),
        );
      }
      offset += 1;
    }
    for (const tag of KNOWN_TAGS) {
      const re = new RegExp(tag.source, tag.flags);
      for (let m = re.exec(text); m !== null; m = re.exec(text)) {
        forbidden += 1;
        findings.push(
          finding("provider_known_tag", {
            anchor,
            span: [
              cpIndex(text, m.index),
              cpIndex(text, m.index + m[0].length),
            ],
          }),
        );
      }
    }
    for (const rendering of respelled) {
      const re = new RegExp(
        `(?<![\\p{L}\\p{N}-])${rendering.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?![\\p{L}\\p{N}-])`,
        "gu",
      );
      for (let m = re.exec(text); m !== null; m = re.exec(text)) {
        respelling += 1;
        findings.push(
          finding("pronunciation_respelling_present", {
            anchor,
            span: [
              cpIndex(text, m.index),
              cpIndex(text, m.index + m[0].length),
            ],
          }),
        );
      }
    }
  }
  return defResult(
    "writing.provider_markup_lint",
    turnsOf(inp.C).length,
    turnsOf(inp.K).length,
    {
      character_classes_seen: seen.size,
      forbidden_matches: forbidden,
      respelling_matches: respelling,
    },
    findings,
  );
}

// ---- Writing 18 (H16): required writer context complete -------------------------------------------------------------------------------------
export function checkContextComplete(inp: ComponentInputs): DefinitionResult {
  const findings: GateFinding[] = [];
  const context = inp.context;
  const check = isObj(context.completeness_check)
    ? context.completeness_check
    : {};
  const complete =
    Object.keys(check).length === 4 &&
    check.status === "pass" &&
    isArr(check.missing_refs) &&
    check.missing_refs.length === 0 &&
    check.forbidden_refs_serialized_to_writer === false &&
    isInt(check.exclusions_applied_count);
  if (!complete) findings.push(finding("context_incomplete"));
  const within =
    isInt(context.estimated_input_tokens) &&
    isInt(context.reserved_output_tokens) &&
    isInt(context.model_context_limit) &&
    context.estimated_input_tokens + context.reserved_output_tokens <=
      context.model_context_limit;
  if (!within) findings.push(finding("context_budget_exceeded"));
  const writerHash = sha256(canonicalBytes(inp.writer));
  const bound =
    context.serialized_input_hash === writerHash &&
    writerHash === PASS1_PIN.w_raw_sha256;
  if (!bound) findings.push(finding("context_hash_mismatch"));
  const refs = strings(context.required_claim_refs);
  const known = new Set(
    packageClaims(inp).map((entry) => strOf(entry.claim_id)),
  );
  const silent = silentClaimIds(inp);
  const excluded = !refs.some((id) => silent.includes(id));
  if (refs.some((id) => !known.has(id)) || !excluded)
    findings.push(finding("context_claim_ref_mismatch"));
  return defResult(
    "writing.context_complete",
    1,
    1,
    {
      missing_refs: isArr(check.missing_refs) ? check.missing_refs.length : 0,
      forbidden_refs_serialized:
        check.forbidden_refs_serialized_to_writer === true ? 1 : 0,
      budget_within_limit: within ? 1 : 0,
      serialized_hash_bound: bound ? 1 : 0,
      silent_claim_excluded: excluded ? 1 : 0,
    },
    findings,
  );
}

// ---- soft warnings (Writing 24.2): never a finding, never durable -------------------------------------------------------------------------
const ACCESS_PHRASES: readonly string[] = [
  "we're hearing",
  "sources tell us",
  "i was there",
  "we asked",
  "we can confirm",
  "we've confirmed",
];
const SIGNPOST_PHRASES: readonly string[] = [
  "key takeaway",
  "the takeaway",
  "what you need to know",
  "lesson here",
];
function phraseWarnings(
  inp: ComponentInputs,
  phrases: readonly string[],
  code: WarningCode,
): GateWarning[] {
  const out: GateWarning[] = [];
  for (const turn of turnsOf(inp.C)) {
    const text = turnText(turn);
    const lower = text.toLowerCase();
    for (const phrase of phrases) {
      let at = lower.indexOf(phrase);
      while (at !== -1) {
        out.push({
          code,
          anchor: turnAnchor(turn),
          span: [cpIndex(text, at), cpIndex(text, at + phrase.length)],
        });
        at = lower.indexOf(phrase, at + 1);
      }
    }
  }
  return out;
}
/** W1, W4, W6 and W12 in one fixed order. All lexical; none is a semantic verdict. */
export function softWarnings(inp: ComponentInputs): GateWarning[] {
  const out: GateWarning[] = [
    ...phraseWarnings(inp, ACCESS_PHRASES, "lexical_access_phrase"),
  ];
  const turns = turnsOf(inp.C);
  let run = 1;
  turns.forEach((turn, index) => {
    const first = (
      /^[\p{L}\p{N}']+/u.exec(turnText(turn))?.[0] ?? ""
    ).toLowerCase();
    const before = (
      /^[\p{L}\p{N}']+/u.exec(turnText(turns[index - 1] ?? {}))?.[0] ?? ""
    ).toLowerCase();
    run = index > 0 && first !== "" && first === before ? run + 1 : 1;
    if (run === 3)
      out.push({ code: "lexical_opener_repeat", anchor: turnAnchor(turn) });
  });
  const quotedSpans = usesOfKind(inp.C, "evidence").filter(
    (ref) => ref.use.use_mode === "quoted",
  );
  for (const turn of turns) {
    const anchor = turnAnchor(turn);
    const kept = cpArray(turnText(turn));
    for (const ref of quotedSpans)
      if (useAnchor(ref.use) === anchor)
        for (
          let i = intOf(ref.use.span_start);
          i < intOf(ref.use.span_end);
          i += 1
        )
          kept[i] = " ";
    if (
      inp.originals.some((original) =>
        sharesRun(kept.join(""), original, GUARD_RUN),
      )
    )
      out.push({ code: "overlap_run_24_unquoted", anchor });
  }
  out.push(...phraseWarnings(inp, SIGNPOST_PHRASES, "lexical_signposting"));
  return out;
}

// ---- the diff lock (definition 17; Writing 22.2 and 24.1; Claims 21.3) ------------------------------------------------------------------
const HEDGE_CUES =
  /\b(?:could|may|might|suggests|reports|reportedly|apparently|pending)\b|\bnot yet\b/giu;
const NEGATION_EXPANSIONS: readonly (readonly [string, string])[] = [
  ["cannot", "can not"],
  ["can't", "can not"],
  ["doesn't", "does not"],
  ["isn't", "is not"],
  ["don't", "do not"],
  ["won't", "will not"],
];
const hedgeCues = (text: string): string[] =>
  sortedText((text.match(HEDGE_CUES) ?? []).map((cue) => cue.toLowerCase()));
function negationWords(text: string): string[] {
  let expanded = text.toLowerCase();
  for (const [from, to] of NEGATION_EXPANSIONS)
    expanded = expanded.split(from).join(to);
  return sortedText(
    expanded.match(/\b(?:not|no|never|nothing|none)\b/gu) ?? [],
  );
}
/** The parent text with exactly the supplied rewrite rows of `anchor` applied, or `null` when a row's `old` fragment does not occur exactly once. */
function applyRewriteRows(
  text: string,
  anchor: string,
  rewrites: readonly TextureRewriteRow[],
): string | null {
  let result = text;
  for (const row of rewrites) {
    if (row.anchor !== anchor) continue;
    if (result.split(row.old).length !== 2) return null;
    result = result.replace(row.old, () => row.new);
  }
  return result;
}
const numericBag = (text: string): string[] =>
  sortedText(numeralTokens(text).map((token) => token.text.toLowerCase()));
/** Rebuilds a speculative texture specimen from the stored child payload (turn ids mapped back to their semantic anchors). */
function specimenOf(payload: Obj): TextureSpecimen {
  const anchors = anchorByTurnId(payload);
  return {
    schema: "speech-texture-specimen/1",
    script_phase: "speech_texture",
    revision_reason: "speech_texture_pass",
    purpose: "evaluation",
    writing_policy_version: payload.writing_policy_version,
    brief_hash: payload.brief_hash,
    package_hash: payload.package_hash,
    parent_script_hash: payload.revision_parent_content_identity,
    program_block_refs: payload.program_block_refs,
    turns: turnsOf(payload).map((turn) => ({
      semantic_turn_id: turn.semantic_turn_id,
      sequence: turn.sequence,
      program_block_id: turn.program_block_id,
      participant_id: turn.participant_id,
      spoken_text: turn.spoken_text,
    })),
    turn_claim_uses: claimUsesOf(payload).map((use) => ({
      semantic_turn_id: use.semantic_turn_id,
      claim_id: use.claim_id,
      use_mode: use.use_mode,
      span_start: use.span_start,
      span_end: use.span_end,
      claim_state_hash: use.claim_state_hash,
    })),
    turn_evidence_uses: evidenceUsesOf(payload).map((use) => ({
      semantic_turn_id: use.semantic_turn_id,
      evidence_unit_id: use.evidence_unit_id,
      use_mode: use.use_mode,
      span_start: use.span_start,
      span_end: use.span_end,
      rights_policy_version: use.rights_policy_version,
    })),
    prediction_candidates: records(payload.prediction_candidates).map(
      (item) => ({
        prediction_candidate_id: item.prediction_candidate_id,
        semantic_turn_id: anchors.get(strOf(item.turn_id)) ?? "",
        participant_id: item.participant_id,
        prediction_text: item.prediction_text,
        horizon: item.horizon,
        topic_thread_id: item.topic_thread_id,
      }),
    ),
  } as unknown as TextureSpecimen;
}
export function checkDiffLock(inp: ComponentInputs): DefinitionResult {
  const findings: GateFinding[] = [];
  const C = inp.C;
  const K = inp.K;
  const childTurns = turnsOf(C);
  const parentTurns = turnsOf(K);
  const parentText = textByAnchor(K);
  const childText = textByAnchor(C);
  // DL01 lineage and the recomputed child hash
  let recomputed: string | undefined;
  try {
    recomputed = scriptHash(C, { brief: inp.brief });
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    findings.push(finding("child_hash_unrecomputable"));
  }
  if (
    recomputed !== undefined &&
    (recomputed !== C.script_hash || recomputed !== GATE_PIN.child_script_hash)
  )
    findings.push(finding("child_hash_mismatch"));
  if (
    C.revision_parent_content_identity !== K.script_hash ||
    K.script_hash !== GATE_PIN.parent_script_hash
  )
    findings.push(finding("parent_identity_mismatch"));
  // DL02 relational parent
  if (
    inp.rows.version.revision_parent_id !== GATE_PIN.parent_script_version_id ||
    inp.rows.version.revision_parent_content_identity !== K.script_hash ||
    C.revision_parent_id !== GATE_PIN.parent_script_version_id ||
    inp.parent_artifact_hash !== GATE_PIN.parent_script_hash
  )
    findings.push(finding("relational_parent_mismatch"));
  // DL03 bindings
  if (
    C.brief_hash !== K.brief_hash ||
    C.package_hash !== K.package_hash ||
    C.writing_policy_version !== K.writing_policy_version ||
    !sameJson(C.program_block_refs, K.program_block_refs)
  )
    findings.push(finding("binding_changed"));
  // DL04 turn structure
  const parentIds = new Set(parentTurns.map((turn) => strOf(turn.turn_id)));
  if (childTurns.length !== parentTurns.length)
    findings.push(finding("turn_structure_changed"));
  childTurns.forEach((turn, index) => {
    const mate = parentTurns[index];
    const where = { anchor: turnAnchor(turn) };
    if (
      mate !== undefined &&
      !sameFields(turn, mate, [
        "semantic_turn_id",
        "sequence",
        "participant_id",
        "program_block_id",
      ])
    )
      findings.push(
        finding("turn_structure_changed", { anchor: turnAnchor(mate) }),
      );
    if (parentIds.has(strOf(turn.turn_id)))
      findings.push(finding("turn_id_reused", where));
  });
  // DL05 scope and rewrite equality, DL09-DL12 lexical classes, DL13 punctuation, DL16 withheld guard
  const rewriteAnchors = new Set(inp.rewrites.map((row) => row.anchor));
  const allowed = new Set<string>();
  for (const turn of parentTurns)
    for (const char of punctuationOf(turnText(turn))) allowed.add(char);
  let changedTurns = 0;
  let netDelta = 0;
  for (const turn of childTurns) {
    const anchor = turnAnchor(turn);
    const where = { anchor };
    const text = turnText(turn);
    const before = parentText.get(anchor);
    if (before === undefined) continue;
    netDelta += codePointLength(text) - codePointLength(before);
    if (text !== before) changedTurns += 1;
    if (rewriteAnchors.has(anchor)) {
      if (applyRewriteRows(before, anchor, inp.rewrites) !== text)
        findings.push(finding("rewrite_row_mismatch", where));
    } else if (text !== before) findings.push(finding("scope_exceeded", where));
    if (!sameJson(numericBag(before), numericBag(text)))
      findings.push(finding("lexical_numeric_changed", where));
    if (
      !sameJson(
        quotedPhraseSpans(before).map((p) => p.text),
        quotedPhraseSpans(text).map((p) => p.text),
      )
    )
      findings.push(finding("lexical_quote_changed", where));
    if (!sameJson(hedgeCues(before), hedgeCues(text)))
      findings.push(finding("lexical_hedge_changed", where));
    if (!sameJson(negationWords(before), negationWords(text)))
      findings.push(finding("lexical_negation_changed", where));
    let offset = 0;
    for (const char of Array.from(text)) {
      if (!/[\p{L}\p{N}]/u.test(char) && !allowed.has(char))
        findings.push(
          finding("punctuation_class_added", {
            anchor,
            span: [offset, offset + 1],
          }),
        );
      offset += 1;
    }
    if (inp.originals.some((original) => sharesRun(text, original, GUARD_RUN)))
      findings.push(finding("withheld_run_present", where));
  }
  // DL06-DL08, DL15 uses and spans (claim uses and evidence uses are each compared by position within their kind)
  const child = allUses(C);
  if (
    usesOfKind(C, "claim").length > usesOfKind(K, "claim").length ||
    usesOfKind(C, "evidence").length > usesOfKind(K, "evidence").length
  )
    findings.push(finding("use_added"));
  for (const pair of pairUses(C, K)) {
    const present = pair.child ?? pair.parent;
    if (present === undefined) continue;
    const where = { anchor: useAnchor(present.use), use_index: present.index };
    const mine = pair.child;
    const mate = pair.parent;
    if (
      mine === undefined ||
      mate === undefined ||
      !sameJson(tupleOf(mine), tupleOf(mate))
    ) {
      findings.push(
        finding(
          present.kind === "claim"
            ? "claim_use_changed"
            : "evidence_use_changed",
          where,
        ),
      );
      if (
        mine !== undefined &&
        mate !== undefined &&
        tupleOf(mine)[0] === tupleOf(mate)[0] &&
        tupleOf(mine)[1] === tupleOf(mate)[1]
      )
        findings.push(finding("permission_changed", where));
      // only the absence of a required mate prevents the comparisons that need it
      if (mine === undefined || mate === undefined) continue;
    }
    const startNow = intOf(mine.use.span_start);
    const endNow = intOf(mine.use.span_end);
    const length = codePointLength(childText.get(useAnchor(mine.use)) ?? "");
    if (startNow < 0 || endNow <= startNow || endNow > length)
      findings.push(finding("span_out_of_range", where));
    const before = parentText.get(useAnchor(mate.use)) ?? "";
    if (
      useText(C, mine.use) !==
      cpSlice(before, intOf(mate.use.span_start), intOf(mate.use.span_end))
    )
      findings.push(finding("span_text_changed", where));
    const expectedStart =
      intOf(mate.use.span_start) +
      rewriteShift(
        before,
        useAnchor(mate.use),
        intOf(mate.use.span_start),
        inp.rewrites,
      );
    const expectedEnd =
      intOf(mate.use.span_end) +
      rewriteShift(
        before,
        useAnchor(mate.use),
        intOf(mate.use.span_end),
        inp.rewrites,
      );
    if (startNow !== expectedStart || endNow !== expectedEnd)
      findings.push(finding("span_reanchor_mismatch", where));
  }
  // DL10 quoted uses carry the approved representation; DL11 required prefixes still begin their spans
  for (const ref of usesOfKind(C, "evidence").filter(
    (item) => item.use.use_mode === "quoted",
  )) {
    const entry = evidenceEntry(inp, ref.use.evidence_unit_id);
    const approved =
      entry !== undefined && isObj(entry.permitted_quote)
        ? strOf(entry.permitted_quote.text)
        : "";
    const spanText = useText(C, ref.use);
    if (cpSlice(spanText, 1, cpArray(spanText).length - 1) !== approved)
      findings.push(
        finding("quote_not_approved_representation", {
          anchor: useAnchor(ref.use),
          use_index: ref.index,
        }),
      );
  }
  for (const ref of usesOfKind(C, "claim")) {
    const entry = claimEntry(inp, ref.use.claim_id);
    if (!requiresAttribution(entry)) continue;
    const requirement = isObj(entry?.attribution_requirement)
      ? entry.attribution_requirement
      : {};
    const prefix = strOf(requirement.approved_prefix);
    const text = childText.get(useAnchor(ref.use)) ?? "";
    const start = intOf(ref.use.span_start);
    if (
      prefix === "" ||
      cpSlice(text, start, start + cpArray(prefix).length) !== prefix
    )
      findings.push(
        finding("attribution_prefix_missing", {
          anchor: useAnchor(ref.use),
          use_index: ref.index,
        }),
      );
  }
  // DL14 prediction candidates
  const semantic = (payload: Obj): Obj[] => {
    const anchors = anchorByTurnId(payload);
    return records(payload.prediction_candidates).map((item) => ({
      prediction_candidate_id: item.prediction_candidate_id,
      semantic_turn_id: anchors.get(strOf(item.turn_id)),
      participant_id: item.participant_id,
      prediction_text: item.prediction_text,
      horizon: item.horizon,
      topic_thread_id: item.topic_thread_id,
    }));
  };
  const childPredictions = semantic(C);
  if (!sameJson(childPredictions, semantic(K))) {
    for (const item of childPredictions)
      findings.push(
        finding("prediction_changed", { anchor: strOf(item.semantic_turn_id) }),
      );
    if (childPredictions.length === 0)
      findings.push(finding("prediction_changed"));
  }
  for (const item of childPredictions)
    if (item.prediction_text !== childText.get(strOf(item.semantic_turn_id)))
      findings.push(
        finding("prediction_changed", { anchor: strOf(item.semantic_turn_id) }),
      );
  // DL17 the pinned rewrite table, DL18 relational rows, DL19 the first-refusal admission boundary
  if (!sameJson(inp.rewrites, TEXTURE_REWRITE_TABLE))
    findings.push(finding("rewrite_table_unpinned"));
  const rowsMatch =
    inp.rows.turns.length === childTurns.length &&
    childTurns.every((turn) => {
      const row = inp.rows.turns.find((item) => item.turn_id === turn.turn_id);
      return (
        row !== undefined &&
        sameFields(row, turn, [
          "program_block_id",
          "sequence",
          "participant_id",
          "spoken_text",
        ])
      );
    }) &&
    (["claim", "evidence"] as const).every((kind) => {
      const match = useRowCorrespondence(inp, kind);
      return match.located.length === 0 && match.extra === 0;
    });
  if (!rowsMatch) findings.push(finding("row_payload_mismatch"));
  try {
    admitTextureAgainst(specimenOf(C), {
      parent: K,
      parent_hash: strOf(K.script_hash),
      originals: inp.originals,
    });
  } catch (error) {
    if (!(error instanceof TextureRefusal)) throw error;
    findings.push(
      finding("texture_admission_refused", {
        upstream_code: error.code,
        ...(error.detail.field !== undefined
          ? { field: error.detail.field }
          : {}),
      }),
    );
  }
  return defResult(
    "writing.diff_lock",
    childTurns.length,
    parentTurns.length,
    {
      changed_turns: changedTurns,
      rewrite_rows: inp.rewrites.length,
      uses: child.length,
      net_cp_delta: netDelta,
    },
    findings,
  );
}
const punctuationOf = (text: string): string[] =>
  Array.from(text).filter((char) => !/[\p{L}\p{N}]/u.test(char));

// ---- the aggregate algebra and the composed component evaluation -----------------------------------------------------------------------------
export type GateAggregate = "failed" | "incomplete" | "complete_defined_set";
/** (A1) failed iff any violation; (A2) else incomplete iff any proof gap or any required coverage gap; (A3) else complete_defined_set. Disjoint and exhaustive. */
export function aggregateOf(
  findings: readonly GateFinding[],
  coverage: readonly CoverageEntry[],
): GateAggregate {
  if (findings.some((item) => item.class === "violation")) return "failed";
  if (
    findings.some((item) => item.class === "proof_gap") ||
    coverage.some((item) => item.status === "not_established_required")
  )
    return "incomplete";
  return "complete_defined_set";
}
export interface ClaimEvaluation {
  readonly rows: readonly DefinitionResult[];
  readonly warnings: readonly GateWarning[];
  readonly coverage: readonly CoverageEntry[];
}
export interface WritingEvaluation {
  readonly rows: readonly DefinitionResult[];
  readonly warnings: readonly GateWarning[];
  readonly coverage: readonly CoverageEntry[];
}
export interface DiffLockEvaluation {
  readonly rows: readonly DefinitionResult[];
}
export function evaluateClaimChecks(inp: ComponentInputs): ClaimEvaluation {
  return {
    rows: [
      checkPresence(inp),
      checkUsePermission(inp),
      checkSilentNonLeak(inp),
      checkValueSupport(inp),
      checkQuotePermission(inp),
      checkParaphrasePermission(inp),
      checkSpeakerAttribution(inp),
      checkClaimState(inp),
      checkProgramHistory(inp),
      checkDeskDerivation(inp),
      checkIncidentStatus(inp),
      checkSpanIntegrity(inp),
    ],
    warnings: softWarnings(inp).filter(
      (item) =>
        item.code === "lexical_access_phrase" ||
        item.code === "overlap_run_24_unquoted",
    ),
    coverage: [],
  };
}
const SOFT_COVERAGE: readonly (readonly [
  CoverageId,
  WarningCode | undefined,
  CoverageLimit | undefined,
])[] = [
  ["W01", "lexical_access_phrase", undefined],
  ["W02", undefined, "no_threshold"],
  ["W03", undefined, "no_affinity_data"],
  ["W04", "lexical_opener_repeat", undefined],
  ["W05", undefined, "no_threshold"],
  ["W06", "overlap_run_24_unquoted", undefined],
  ["W07", undefined, "no_words_per_minute_rule"],
  ["W08", undefined, "no_input"],
  ["W09", undefined, "semantic"],
  ["W10", undefined, "semantic"],
  ["W11", undefined, "semantic"],
  ["W12", "lexical_signposting", undefined],
];
export function evaluateWritingChecks(inp: ComponentInputs): WritingEvaluation {
  const warnings = softWarnings(inp);
  const types = records(inp.brief.program_blocks).map((block) =>
    strOf(block.block_type),
  );
  const coverage: CoverageEntry[] = [
    {
      id: "H01",
      status: "established_with_limits",
      limits: ["show_roster_document_absent"],
    },
    {
      id: "H04",
      status: "not_established_required",
      limits: ["nonnumeric_unmarked_factual_content"],
    },
    {
      id: "H13",
      status: "not_established_required",
      limits: ["mode_forbidden_rule_set_absent"],
    },
    {
      id: "H14",
      status: types.includes("receipts")
        ? "not_established_required"
        : "inapplicable_witnessed",
    },
    { id: "X01", status: "deferred_semantic", limits: ["semantic"] },
    { id: "X02", status: "deferred_semantic", limits: ["semantic"] },
    ...SOFT_COVERAGE.map(
      ([id, code, limit]): CoverageEntry =>
        limit !== undefined
          ? { id, status: "soft_probe_not_established", limits: [limit] }
          : {
              id,
              status: warnings.some((item) => item.code === code)
                ? "soft_probe_fired"
                : "soft_probe_clear",
            },
    ),
  ];
  return {
    rows: [
      checkParticipantValidity(inp),
      checkPlannedBlockMembership(inp),
      checkRequiredBlocks(inp),
      checkProviderMarkup(inp),
      checkContextComplete(inp),
    ],
    warnings: warnings.filter(
      (item) =>
        item.code === "lexical_opener_repeat" ||
        item.code === "lexical_signposting",
    ),
    coverage,
  };
}
export function evaluateDiffLock(inp: ComponentInputs): DiffLockEvaluation {
  return { rows: [checkDiffLock(inp)] };
}
export interface ComponentEvaluation {
  readonly rows: readonly DefinitionResult[];
  readonly aggregate: GateAggregate;
  readonly warnings: readonly GateWarning[];
  readonly coverage: readonly CoverageEntry[];
  readonly preconditions: PreconditionResult;
}
/** Module-private brand: a component evaluation is never an `OwnedEvaluation` and the writer refuses it. */
const COMPONENT_EVALUATIONS = new WeakSet<object>();
export const isComponentEvaluation = (
  value: unknown,
): value is ComponentEvaluation =>
  typeof value === "object" &&
  value !== null &&
  COMPONENT_EVALUATIONS.has(value);
const COVERAGE_ORDER: readonly CoverageId[] = COVERAGE_IDS;
export function evaluateGateComponent(
  inp: ComponentInputs,
): ComponentEvaluation {
  const preconditions = checkPreconditions(inp);
  const claims = evaluateClaimChecks(inp);
  const writing = evaluateWritingChecks(inp);
  const diff = evaluateDiffLock(inp);
  const byKey = new Map(
    [...claims.rows, ...writing.rows, ...diff.rows].map((item) => [
      item.key,
      item,
    ]),
  );
  const rows = GATE_DEFINITION_KEYS.map((key) => {
    const row = byKey.get(key);
    if (row === undefined)
      throw new TypeError("a definition result is missing");
    return row;
  });
  const coverage = [
    {
      id: "C13" as const,
      ...(preconditions.ok
        ? {
            status: "established_with_limits" as const,
            limits: preconditions.claims13.limits,
          }
        : { status: "not_established_required" as const }),
    },
    {
      id: "C14" as const,
      status: preconditions.ok
        ? ("established" as const)
        : ("not_established_required" as const),
    },
    ...claims.coverage,
    ...writing.coverage,
  ].sort((a, b) => COVERAGE_ORDER.indexOf(a.id) - COVERAGE_ORDER.indexOf(b.id));
  const warnings = [...claims.warnings, ...writing.warnings];
  const evaluation: ComponentEvaluation = deepFreeze({
    rows,
    aggregate: aggregateOf(
      rows.flatMap((row) => row.findings),
      coverage,
    ),
    warnings,
    coverage,
    preconditions,
  });
  COMPONENT_EVALUATIONS.add(evaluation);
  return evaluation;
}

// ---- the shape error of the fact parser (the only throwable the gate maps) ----------------------------------------------------------------
class GateShapeError extends Error {
  constructor() {
    super("gate_shape");
    this.name = "GateShapeError";
  }
}
class GateRefusal extends Error {
  readonly stage: GateStopStage;
  readonly code: GateStopCode;
  readonly detail: GateStopDetail;
  constructor(
    stage: GateStopStage,
    code: GateStopCode,
    detail: GateStopDetail = {},
  ) {
    super(code);
    this.name = "GateRefusal";
    this.stage = stage;
    this.code = code;
    this.detail = detail;
  }
}

// ---- stops and results (closed; no message, cause, SQL, URL, source text or claim value ever appears) -----------------------------------
export type GateConflictKind =
  | "same_id_different_content"
  | "stale_fingerprint"
  | "foreign_row"
  | "owned_partial";
export interface GateStopDetail {
  readonly upstream_code?: TextureStopCode;
  readonly texture_state?: 0 | 1 | 2 | 3;
  readonly check?: 13 | 14;
  readonly conflict?: {
    readonly row: "gate_results";
    readonly kind: GateConflictKind;
  };
  readonly connection?: {
    readonly phase: "before_commit" | "commit" | "rollback";
    readonly commit_outcome: "not_attempted" | "unknown";
  };
  readonly field?: TextureField;
}
export interface GateDurable {
  readonly gate: Fact;
  readonly texture: Fact;
}
export interface GateStopped extends GateStopDetail {
  readonly kind: "stopped";
  readonly stage: GateStopStage;
  readonly code: GateStopCode;
  readonly writes_attempted: boolean;
  readonly upstream: TextureUpstream;
  readonly durable: GateDurable;
  readonly reconciled: false;
  readonly cleanup: Cleanup;
}
const UNKNOWN_UPSTREAM: TextureUpstream = deepFreeze({
  pass1: "unknown",
  critic: "unknown",
  revision: "unknown",
});
const PRESENT_UPSTREAM: TextureUpstream = deepFreeze({
  pass1: "present",
  critic: "present",
  revision: "present",
});
/** Cumulative context of one invocation (monotone: `present` and `writes_attempted` are never downgraded). */
export interface GateContext {
  readonly w: boolean;
  readonly gate: Fact;
  readonly texture: Fact;
  readonly u: TextureUpstream;
}
export const initialGateContext = (): GateContext => ({
  w: false,
  gate: "unknown",
  texture: "unknown",
  u: UNKNOWN_UPSTREAM,
});
const mergeFact = (prior: Fact, next: Fact): Fact => {
  if (prior === "present" || next === "present") return "present";
  if (prior === "unknown" || next === "unknown") return "unknown";
  return "none_observed";
};
export function gateStopOf(
  ctx: GateContext,
  stage: GateStopStage,
  code: GateStopCode,
  detail: GateStopDetail = {},
  cleanup: Cleanup = { attached_errors: 0, complete: true },
  facts: Partial<GateDurable> = {},
): GateStopped {
  return deepFreeze<GateStopped>({
    kind: "stopped",
    stage,
    code,
    writes_attempted: ctx.w,
    upstream: ctx.u,
    durable: {
      gate: mergeFact(ctx.gate, facts.gate ?? ctx.gate),
      texture: mergeFact(ctx.texture, facts.texture ?? ctx.texture),
    },
    reconciled: false,
    cleanup,
    ...detail,
  });
}
const bareStop = (
  stage: GateStopStage,
  code: GateStopCode,
  detail: GateStopDetail = {},
): GateStopped => gateStopOf(initialGateContext(), stage, code, detail);

// ---- the planned owned rows -----------------------------------------------------------------------------------------------------------
export interface HistoricalRow {
  readonly gate_result_id: string;
  readonly gate_definition_id: string;
  readonly attempt_id: string;
  readonly input_fingerprint: string;
  readonly outcome: string;
  readonly result: Obj;
  readonly created_at: string;
}
export interface DefinitionPin {
  readonly gate_definition_id: string;
  readonly gate_name: string;
  readonly version: string;
  readonly definition: Obj;
}
export interface OwnedRow {
  readonly key: GateDefinitionKey;
  readonly gate_result_id: string;
  readonly gate_definition_id: string;
  readonly attempt_id: string;
  readonly input_fingerprint: string;
  readonly outcome: "pass" | "fail";
  readonly result: Obj;
  readonly created_at: string;
}
export interface GatePlan {
  readonly texture: TexturePlan;
  readonly owners: GateOwners;
  readonly fingerprint: string;
  readonly created_at: string;
  readonly definitions: readonly DefinitionPin[];
  readonly historical: readonly HistoricalRow[];
  readonly result_ids: readonly string[];
  readonly statics: GateStatics;
  readonly package_payload: Obj;
  readonly policy_versions: Obj;
}
export type GatePlanResult =
  | { readonly kind: "planned"; readonly plan: GatePlan }
  | GateStopped;
const ADMITTED_PLANS = new WeakSet<object>();
export const isAdmittedGatePlan = (plan: unknown): plan is GatePlan =>
  typeof plan === "object" && plan !== null && ADMITTED_PLANS.has(plan);
export interface GateInvocation {
  readonly texture: unknown;
  readonly created_at: string;
}
export interface GatePlanInputs {
  readonly texturePlan?: TexturePlan;
  readonly textureInputs?: TexturePlanInputs;
  readonly pack?: Pack;
}
function memberJson(pack: Pack, name: keyof typeof GATE_MEMBERS): Obj {
  const bytes = pack.member(GATE_MEMBERS[name]);
  if (sha256(bytes) !== GATE_PIN.member_sha256[name])
    throw new GateRefusal("input", "gate_static_input_mismatch");
  const parsed: unknown = JSON.parse(bytes.toString("utf8"));
  if (!isObj(parsed))
    throw new GateRefusal("input", "gate_static_input_mismatch");
  return parsed;
}
function buildGatePlan(
  invocationRaw: unknown,
  inputs: GatePlanInputs,
): GatePlan {
  if (
    !isObj(invocationRaw) ||
    Object.keys(invocationRaw).length !== 2 ||
    !Object.hasOwn(invocationRaw, "texture") ||
    !Object.hasOwn(invocationRaw, "created_at")
  )
    throw new GateRefusal("input", "gate_invocation_invalid");
  let createdAt: string;
  try {
    createdAt = requireTimestamp(invocationRaw.created_at, "created_at");
  } catch (error) {
    if (error instanceof Rejection)
      throw new GateRefusal("input", "gate_invocation_invalid");
    throw error;
  }
  if (inputs.texturePlan !== undefined && inputs.textureInputs !== undefined)
    throw new TypeError(
      "a texture plan and texture inputs are mutually exclusive",
    );
  let texture: TexturePlan;
  if (inputs.texturePlan !== undefined) {
    if (!isAdmittedTexturePlan(inputs.texturePlan))
      throw new TypeError("an admitted texture plan is required");
    let textureInvocation;
    try {
      textureInvocation = readTextureInvocation(invocationRaw.texture);
    } catch (error) {
      if (error instanceof Rejection)
        throw new GateRefusal("input", "gate_invocation_invalid");
      throw error;
    }
    if (!sameJson(inputs.texturePlan.invocation, textureInvocation))
      throw new GateRefusal("input", "gate_input_identity_mismatch");
    texture = inputs.texturePlan;
  } else {
    const planned = planSpeechTexture(
      invocationRaw.texture,
      inputs.textureInputs ?? {},
    );
    if (planned.kind === "stopped")
      throw new GateRefusal("input", "gate_texture_plan_stopped", {
        upstream_code: planned.code,
        ...(planned.field !== undefined ? { field: planned.field } : {}),
      });
    texture = planned.plan;
  }
  if (texture.invocation.attempt_id !== GATE_PIN.host_attempt_id)
    throw new GateRefusal("input", "gate_attempt_unavailable");
  if (instantMicros(createdAt) < instantMicros(texture.invocation.created_at))
    throw new GateRefusal("input", "gate_invocation_invalid");
  const pack = inputs.pack ?? openFixturePack();
  const statics: GateStatics = {
    profiles: memberJson(pack, "participant_profiles"),
    template: memberJson(pack, "rundown_template"),
    modes: memberJson(pack, "episode_modes"),
    block_types: memberJson(pack, "block_types"),
  };
  const foundation = memberJson(pack, "foundation_rows");
  const policyVersions = memberJson(pack, "policy_versions");
  const packagePayload = memberJson(pack, "evidence_package");
  const upstream = texture.revision.critic.upstream;
  const owners = deriveGateOwners(
    {
      manifest: texture.manifest,
      script_payload: texture.script_payload,
      brief: upstream.brief,
      package: packagePayload,
    },
    policyVersions,
  );
  if ("mismatch" in owners)
    throw new GateRefusal("input", "gate_input_identity_mismatch");
  const fingerprintValue = gateFingerprint(owners);
  if (fingerprintValue !== GATE_PIN.fingerprint)
    throw new GateRefusal("input", "gate_input_identity_mismatch");
  const tables = isObj(foundation.tables) ? foundation.tables : {};
  const definitions: DefinitionPin[] = DEFINITION_IDS.map((id, index) => {
    const row = records(tables.gate_definitions).find(
      (item) => item.gate_definition_id === id,
    );
    if (
      row === undefined ||
      row.gate_name !== GATE_DEFINITION_KEYS[index] ||
      !isStr(row.gate_name) ||
      !isStr(row.version) ||
      !isObj(row.definition)
    )
      throw new GateRefusal("input", "gate_static_input_mismatch");
    return {
      gate_definition_id: id,
      gate_name: row.gate_name,
      version: row.version,
      definition: row.definition,
    };
  });
  const historical: HistoricalRow[] = records(tables.gate_results)
    .filter((row) => row.attempt_id === GATE_PIN.host_attempt_id)
    .map((row) => {
      if (
        !isStr(row.gate_result_id) ||
        !isStr(row.gate_definition_id) ||
        !isStr(row.input_fingerprint) ||
        !isStr(row.outcome) ||
        !isObj(row.result) ||
        !isStr(row.created_at)
      )
        throw new GateRefusal("input", "gate_static_input_mismatch");
      return {
        gate_result_id: row.gate_result_id,
        gate_definition_id: row.gate_definition_id,
        attempt_id: GATE_PIN.host_attempt_id,
        input_fingerprint: row.input_fingerprint,
        outcome: row.outcome,
        result: row.result,
        created_at: row.created_at,
      };
    });
  if (
    historical.length !== 31 ||
    historical.some((row) => row.outcome !== "pass") ||
    historical.filter((row) =>
      row.input_fingerprint.startsWith(
        HISTORICAL_CLAIMS_WRITING_FINGERPRINT_PREFIX,
      ),
    ).length !== 18
  )
    throw new GateRefusal("input", "gate_static_input_mismatch");
  const plan: GatePlan = deepFreeze({
    texture,
    owners,
    fingerprint: fingerprintValue,
    created_at: createdAt,
    definitions,
    historical,
    result_ids: DEFINITION_IDS.map((id) =>
      deriveGateId(`gate_result:${fingerprintValue}:${id}`),
    ),
    statics,
    package_payload: packagePayload,
    policy_versions: policyVersions,
  });
  ADMITTED_PLANS.add(plan);
  return plan;
}
/** Pure planning: texture plan reuse or one real texture planning, owners and fingerprint recomputed, static members re-hashed. Writes nothing. */
export function planClaimsWritingGate(
  invocation: unknown,
  inputs: GatePlanInputs = {},
): GatePlanResult {
  try {
    return { kind: "planned", plan: buildGatePlan(invocation, inputs) };
  } catch (error) {
    if (error instanceof GateRefusal)
      return bareStop(error.stage, error.code, error.detail);
    throw error;
  }
}

// ---- component inputs from a plan and the captured facts -------------------------------------------------------------------------------------
const childRowsOf = (texture: TexturePlan): ChildRows => {
  const planned = (table: string): Obj[] =>
    texture.t3
      .filter((item) => item.spec.table === table)
      .map((item) => ({ ...item.row }));
  const version = planned("script_versions")[0];
  if (version === undefined) throw new GateShapeError();
  return {
    version,
    turns: planned("turns"),
    claim_uses: planned("turn_claim_uses"),
    evidence_uses: planned("turn_evidence_uses"),
  };
};
/** The component inputs of the production boundary: payloads hash-bound by the admitted plan, packages and Brief as the snapshot captured them. */
export function componentInputsOf(
  plan: GatePlan,
  texture: TextureRawSnapshot,
  facts: GateFacts,
  manifest: Obj,
  brief: Obj,
): ComponentInputs {
  const upstream = plan.texture.revision.critic.upstream;
  const writer = upstream.t1[0]?.row.canonical_payload;
  const context = upstream.t1[1]?.row.canonical_payload;
  if (!isObj(writer) || !isObj(context)) throw new GateShapeError();
  const parent = rowsById(
    texture.revision.own.artifacts,
    "artifact_id",
    plan.texture.revision.ids.script_artifact_id,
  )[0];
  return {
    C: plan.texture.script_payload,
    K: plan.texture.revision.script_payload,
    rows: childRowsOf(plan.texture),
    pkg: manifest,
    brief,
    writer,
    context,
    facts,
    statics: plan.statics,
    originals: upstream.originals,
    rewrites: TEXTURE_REWRITE_TABLE,
    parent_artifact_hash: strOf(parent?.content_hash),
  };
}

// ---- owned rows ------------------------------------------------------------------------------------------------------------------------------
const RESULT_KEYS: readonly string[] = [
  "actor_id",
  "actor_kind",
  "check",
  "facts",
  "findings",
  "fingerprint_stage",
  "schema",
  "subject_refs",
];
type LocKeys = readonly string[];
const NONE: LocKeys = [];
const AT: LocKeys = ["anchor"];
const AT_USE: LocKeys = ["anchor", "use_index"];
const AT_SPAN: LocKeys = ["anchor", "span"];
/** The additional integer fact keys of each definition (`examined` and `expected_examined` are always required). */
const FACT_KEYS: Readonly<Record<GateDefinitionKey, readonly string[]>> =
  deepFreeze({
    "claims.presence": [
      "claim_uses",
      "evidence_uses",
      "package_claims",
      "package_evidence",
    ],
    "claims.use_permission": [
      "asserted",
      "hedged",
      "attributed",
      "relied_on_silent",
      "quoted",
      "paraphrased",
    ],
    "claims.silent_non_leak": [
      "silent_claims",
      "silent_claim_uses",
      "silent_evidence_units",
      "silent_evidence_uses",
      "turns_scanned",
      "silent_value_matches",
      "withheld_run_matches",
    ],
    "claims.value_support": [
      "supported",
      "no_finding_context",
      "violations",
      "proof_gaps",
    ],
    "claims.quote_permission": [
      "quoted_uses",
      "metalinguistic_mentions",
      "quote_pairs_seen",
    ],
    "claims.paraphrase_permission": [
      "paraphrased_uses",
      "overlap_matches",
      "guard_run_cp",
    ],
    "claims.speaker_attribution": [
      "prefix_matches",
      "quoted_speaker_fields_available",
    ],
    "claims.claim_state": ["confirmed"],
    "claims.program_history": [],
    "claims.desk_derivation": [
      "input_refs",
      "window_matches",
      "desk_derived_uses",
      "metadata_checks_passed",
    ],
    "claims.incident_status": ["incident_claims"],
    "claims.span_integrity": ["shifted_spans"],
    "writing.participant_validity": [
      "roster_members",
      "profile_versions_bound",
    ],
    "writing.planned_block_membership": ["brief_blocks"],
    "writing.required_blocks": [
      "template_required_slots",
      "optional_slots_omitted",
      "blocks_with_turns",
    ],
    "writing.provider_markup_lint": [
      "character_classes_seen",
      "forbidden_matches",
      "respelling_matches",
    ],
    "writing.diff_lock": [
      "changed_turns",
      "rewrite_rows",
      "uses",
      "net_cp_delta",
    ],
    "writing.context_complete": [
      "missing_refs",
      "forbidden_refs_serialized",
      "budget_within_limit",
      "serialized_hash_bound",
      "silent_claim_excluded",
    ],
  });
type CodeRules = Readonly<Record<string, readonly LocKeys[]>>;
const codeRules = (own: Record<string, readonly LocKeys[]>): CodeRules =>
  deepFreeze({ denominator_mismatch: [NONE], ...own });
const VALUE_SUPPORT_RULES: Record<string, readonly LocKeys[]> =
  Object.fromEntries(
    [
      "precise_duration_unsupported",
      "numeral_role_order_mismatch",
      "source_credit_cardinality_mismatch",
      "numeral_support_not_authorized",
      "numeral_form_unclassified",
      "duration_context_unclassified",
      "duration_context_unresolved",
    ].map((code): [string, readonly LocKeys[]] => [code, [AT_SPAN]]),
  );
/** The finding codes each definition may emit, each with its exact accepted location-key variants (no other combination is closed). */
const FINDING_RULES: Readonly<Record<GateDefinitionKey, CodeRules>> =
  deepFreeze({
    "claims.presence": codeRules({
      use_turn_unresolved: [AT_USE],
      claim_unresolved: [AT_USE],
      claim_state_hash_mismatch: [AT_USE],
      // a use with a missing, duplicated or unequal relational mate is located; an extra relational row with no payload mate has no location
      use_row_payload_mismatch: [AT_USE, NONE],
      evidence_unresolved: [AT_USE],
      rights_version_mismatch: [AT_USE],
    }),
    "claims.use_permission": codeRules({
      evidence_mode_unknown: [AT_USE],
      mode_unknown: [AT_USE],
      mode_illegal_for_class: [AT_USE],
    }),
    "claims.silent_non_leak": codeRules({
      silent_claim_used: [AT_USE],
      silent_evidence_used: [AT_USE],
      silent_value_reproduced: [AT_SPAN],
      silent_constraint_missing: [NONE],
      withheld_run_present: [AT],
    }),
    "claims.value_support": codeRules(VALUE_SUPPORT_RULES),
    "claims.quote_permission": codeRules({
      quote_not_permitted: [AT_USE],
      quote_locator_missing: [AT_USE],
      quote_marks_absent: [AT_USE],
      quote_text_not_approved_representation: [AT_USE],
      quote_without_use: [AT_SPAN],
    }),
    "claims.paraphrase_permission": codeRules({
      paraphrase_not_permitted: [AT_USE],
      quote_marks_on_paraphrase: [AT_USE],
      overlap_run_24: [AT_USE],
    }),
    "claims.speaker_attribution": codeRules({
      attribution_prefix_missing: [AT_USE],
      attribution_mode_illegal: [AT_USE],
    }),
    "claims.claim_state": codeRules({
      claim_state_not_assertable: [AT_USE],
      frozen_state_hash_recomputed_mismatch: [AT_USE],
    }),
    "claims.program_history": codeRules({
      continuity_unresolved: [AT_USE],
      continuity_withdrawn_or_draft: [AT_USE],
      continuity_topic_mismatch: [AT_USE],
    }),
    "claims.desk_derivation": codeRules({
      derivation_missing: [NONE],
      derivation_rule_mismatch: [NONE],
      derivation_parameters_mismatch: [NONE],
      derivation_output_mismatch: [NONE],
      derivation_hash_mismatch: [NONE],
      derivation_input_ref_mismatch: [NONE],
      derivation_window_mismatch: [NONE],
      // the permanent retained proof gap carries exactly its reference
      required_proof_not_established: [["ref"]],
    }),
    "claims.incident_status": codeRules({
      incident_claim_used: [AT_USE],
      incident_witness_missing: [NONE],
    }),
    "claims.span_integrity": codeRules({
      span_out_of_range: [AT_USE],
      use_tuple_changed: [AT_USE],
      span_text_changed: [AT_USE],
      span_shift_mismatch: [AT_USE],
    }),
    "writing.participant_validity": codeRules({
      participant_not_in_roster: [AT],
      participant_profile_unbound: [AT],
    }),
    "writing.planned_block_membership": codeRules({
      turn_block_detached: [AT],
      turn_sequence_invalid: [AT],
    }),
    "writing.required_blocks": codeRules({
      block_missing: [NONE],
      block_order_mismatch: [NONE],
      template_version_mismatch: [NONE],
      block_unplanned: [NONE, AT],
      block_without_turn: [NONE],
    }),
    "writing.provider_markup_lint": codeRules({
      provider_char_class: [AT_SPAN],
      provider_known_tag: [AT_SPAN],
      pronunciation_respelling_present: [AT_SPAN],
    }),
    "writing.diff_lock": codeRules({
      child_hash_unrecomputable: [NONE],
      child_hash_mismatch: [NONE],
      parent_identity_mismatch: [NONE],
      relational_parent_mismatch: [NONE],
      binding_changed: [NONE],
      turn_structure_changed: [NONE, AT],
      turn_id_reused: [AT],
      rewrite_row_mismatch: [AT],
      scope_exceeded: [AT],
      lexical_numeric_changed: [AT],
      lexical_quote_changed: [AT],
      lexical_hedge_changed: [AT],
      lexical_negation_changed: [AT],
      punctuation_class_added: [AT_SPAN],
      withheld_run_present: [AT],
      use_added: [NONE],
      claim_use_changed: [AT_USE],
      evidence_use_changed: [AT_USE],
      permission_changed: [AT_USE],
      span_out_of_range: [AT_USE],
      span_text_changed: [AT_USE],
      span_reanchor_mismatch: [AT_USE],
      quote_not_approved_representation: [AT_USE],
      attribution_prefix_missing: [AT_USE],
      prediction_changed: [AT, NONE],
      rewrite_table_unpinned: [NONE],
      row_payload_mismatch: [NONE],
      texture_admission_refused: [
        ["upstream_code"],
        ["upstream_code", "field"],
      ],
    }),
    "writing.context_complete": codeRules({
      context_incomplete: [NONE],
      context_budget_exceeded: [NONE],
      context_hash_mismatch: [NONE],
      context_claim_ref_mismatch: [NONE],
    }),
  });
const ANCHOR = /^t(?:0[1-9]|1[0-7])$/u;
const sameKeySet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length &&
  [...a].sort().every((key, index) => key === [...b].sort()[index]);
/**
 * True iff one finding is inside the closed schema OF THE NAMED DEFINITION. Everything is read from OWN fields and OWN table entries: the
 * definition must be an own entry of the definition table, `code` and `class` must be own fields of the finding, the code must be an own entry
 * of that definition's rules (an inherited name such as `constructor` or `__proto__` is not a code), the class must equal the one derived from
 * the code, the complete own key set must be `class`, `code` and exactly one accepted location-key variant of that code, and every present
 * location key must have its closed shape. An invalid runtime definition argument returns false.
 */
export function isClosedFinding(
  value: unknown,
  check: GateDefinitionKey,
): boolean {
  const name: unknown = check;
  if (!isStr(name) || !Object.hasOwn(FINDING_RULES, name)) return false;
  if (
    !isObj(value) ||
    !Object.hasOwn(value, "code") ||
    !Object.hasOwn(value, "class")
  )
    return false;
  const code = value.code;
  if (!isStr(code)) return false;
  const rules = FINDING_RULES[check];
  if (!Object.hasOwn(rules, code)) return false;
  const variants = rules[code];
  if (variants === undefined) return false;
  if (value.class !== (PROOF_GAP_SET.has(code) ? "proof_gap" : "violation"))
    return false;
  const location = Object.keys(value).filter(
    (key) => key !== "class" && key !== "code",
  );
  if (!variants.some((variant) => sameKeySet(variant, location))) return false;
  for (const key of location) {
    const item = value[key];
    switch (key) {
      case "anchor":
        if (!(isStr(item) && ANCHOR.test(item))) return false;
        break;
      case "span":
        if (!(isArr(item) && item.length === 2 && item.every(isInt)))
          return false;
        break;
      case "use_index":
        if (!isInt(item)) return false;
        break;
      case "ref":
        if (item !== "derivation_count_reexecution") return false;
        break;
      case "upstream_code":
        if (!(TEXTURE_STOP_CODES as readonly unknown[]).includes(item))
          return false;
        break;
      case "field":
        if (!(TEXTURE_FIELDS as readonly unknown[]).includes(item))
          return false;
        break;
      default:
        return false;
    }
  }
  return true;
}
/** True iff a stored `result` is exactly the closed eight-key object with the definition's exact integer fact keys and its closed findings. */
export function isClosedResult(value: unknown): boolean {
  if (!isObj(value)) return false;
  const keys = Object.keys(value);
  if (
    keys.length !== RESULT_KEYS.length ||
    !RESULT_KEYS.every((key) => keys.includes(key))
  )
    return false;
  const check = value.check;
  if (
    !isStr(check) ||
    !(GATE_DEFINITION_KEYS as readonly string[]).includes(check)
  )
    return false;
  const definition = check as GateDefinitionKey;
  return (
    value.actor_id === GATE_PIN.actor_id &&
    value.actor_kind === GATE_PIN.actor_kind &&
    isObj(value.facts) &&
    sameKeySet(Object.keys(value.facts), [
      "examined",
      "expected_examined",
      ...FACT_KEYS[definition],
    ]) &&
    Object.values(value.facts).every(isInt) &&
    isArr(value.findings) &&
    value.findings.every((item) => isClosedFinding(item, definition)) &&
    value.fingerprint_stage === GATE_PIN.fingerprint_stage &&
    value.schema === GATE_PIN.result_schema &&
    sameJson(value.subject_refs, [GATE_PIN.child_script_version_id])
  );
}
/** The eighteen planned rows of an evaluation (ids derived, `created_at` the caller-retained record, never `now()`). */
export function ownedRowsOf(
  plan: GatePlan,
  rows: readonly DefinitionResult[],
): OwnedRow[] {
  return rows.map((row, index) => {
    const result: Obj = {
      actor_id: GATE_PIN.actor_id,
      actor_kind: GATE_PIN.actor_kind,
      check: row.key,
      facts: { ...row.facts },
      findings: row.findings.map((item) => ({ ...item })),
      fingerprint_stage: GATE_PIN.fingerprint_stage,
      schema: GATE_PIN.result_schema,
      subject_refs: [GATE_PIN.child_script_version_id],
    };
    return {
      key: row.key,
      gate_result_id: plan.result_ids[index] ?? "",
      gate_definition_id: DEFINITION_IDS[index] ?? "",
      attempt_id: GATE_PIN.host_attempt_id,
      input_fingerprint: plan.fingerprint,
      outcome: row.findings.length === 0 ? "pass" : "fail",
      result,
      created_at: plan.created_at,
    };
  });
}

// ---- the coherent read-only snapshot: 145 static SELECTs, one private native expected-row SELECT ------------------------------------------------
export const GATE_STATIC_STATEMENT_COUNT = 145;
export const GATE_SNAPSHOT_STATEMENT_COUNT = 146;
const DEFINITIONS_SQL = `SELECT e.gate_definition_id::text AS gate_definition_id, (d.gate_definition_id IS NOT NULL) AS present,
  (d.gate_name IS NOT DISTINCT FROM e.gate_name) AS eq_gate_name,
  (d.version IS NOT DISTINCT FROM e.version) AS eq_version,
  (d.definition IS NOT DISTINCT FROM e.definition::jsonb) AS eq_definition
  FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[]) AS e(gate_definition_id, gate_name, version, definition)
  LEFT JOIN gate_definitions d ON d.gate_definition_id = e.gate_definition_id ORDER BY e.gate_definition_id`;
const HOST_ROWS_SQL = `SELECT gate_result_id::text AS gate_result_id, gate_definition_id::text AS gate_definition_id,
  input_fingerprint::text AS input_fingerprint FROM gate_results WHERE attempt_id = $1::uuid ORDER BY gate_result_id`;
const RIGHTS_SQL =
  "SELECT rights_version_id::text AS rights_version_id, policy FROM rights_versions WHERE rights_version_id = ANY($1::uuid[]) ORDER BY rights_version_id";
const SUPPORTS_SQL = `SELECT claim_support_id::text AS claim_support_id, claim_id::text AS claim_id, support_kind, support_role,
  evidence_unit_id::text AS evidence_unit_id, derivation_run_id::text AS derivation_run_id, external_support_identity, support_hash
  FROM claim_supports WHERE claim_id = ANY($1::uuid[]) ORDER BY claim_support_id`;
const DERIVATION_SQL = `SELECT derivation_run_id::text AS derivation_run_id, rule_version, parameters, output, exact_input_refs, output_hash
  FROM derivation_runs WHERE derivation_run_id = $1::uuid`;
const CARRIERS_SQL = `SELECT artifact_id::text AS artifact_id, artifact_type, content_hash, canonical_payload
  FROM artifacts WHERE artifact_id = ANY($1::uuid[]) ORDER BY artifact_id`;
const EVENTS_SQL = `SELECT claim_state_event_id::text AS claim_state_event_id, claim_id::text AS claim_id, actor_id::text AS actor_id,
  occurred_at, event_type, event_sequence, event_payload FROM claim_state_events WHERE claim_id = ANY($1::uuid[]) ORDER BY claim_id, event_sequence`;
const CLAIMS_SQL = `SELECT claim_id::text AS claim_id, content_hash, claim_kind, initial_status, initial_usage_class
  FROM claims WHERE claim_id = ANY($1::uuid[]) ORDER BY claim_id`;
const PRONUNCIATIONS_SQL = `SELECT pronunciation_id::text AS pronunciation_id, canonical_text, entity_identity, canonical_version
  FROM pronunciations ORDER BY pronunciation_id`;
const RENDERINGS_SQL = `SELECT pronunciation_rendering_id::text AS pronunciation_rendering_id, pronunciation_id::text AS pronunciation_id,
  provider, rendering, version, voice_profile_version_id::text AS voice_profile_version_id FROM pronunciation_renderings ORDER BY pronunciation_rendering_id`;
const EVIDENCE_SQL = `SELECT evidence_unit_id::text AS evidence_unit_id, content_hash, usage_class, rights_version_id::text AS rights_version_id
  FROM evidence_units WHERE evidence_unit_id = ANY($1::uuid[]) ORDER BY evidence_unit_id`;
const EXPECTED_SQL = `SELECT e.n::int AS n, (g.gate_result_id IS NOT NULL) AS present,
  (g.gate_definition_id IS NOT DISTINCT FROM e.gate_definition_id) AS eq_gate_definition_id,
  (g.attempt_id IS NOT DISTINCT FROM e.attempt_id) AS eq_attempt_id,
  (g.input_fingerprint::text IS NOT DISTINCT FROM e.input_fingerprint) AS eq_input_fingerprint,
  (g.outcome IS NOT DISTINCT FROM e.outcome) AS eq_outcome,
  (g.result IS NOT DISTINCT FROM e.result::jsonb) AS eq_result,
  (g.created_at IS NOT DISTINCT FROM e.created_at::timestamptz) AS eq_created_at
  FROM unnest($1::int[], $2::uuid[], $3::uuid[], $4::uuid[], $5::text[], $6::text[], $7::text[], $8::text[])
    AS e(n, gate_result_id, gate_definition_id, attempt_id, input_fingerprint, outcome, result, created_at)
  LEFT JOIN gate_results g ON g.gate_result_id = e.gate_result_id ORDER BY e.n`;
const GATE_HOST_SQL = `SELECT a.attempt_id::text AS attempt_id, a.program_run_id::text AS program_run_id, a.state::text AS attempt_state,
  a.publication_enabled AS attempt_publication_enabled, a.show_config_version_id::text AS show_config_version_id,
  a.evidence_package_id::text AS evidence_package_id, a.parent_attempt_id::text AS parent_attempt_id,
  a.repair_plan_id::text AS repair_plan_id, r.purpose::text AS purpose, r.state::text AS run_state,
  r.publication_enabled AS run_publication_enabled, r.show_config_version_id::text AS run_show_config_version_id
  FROM program_run_attempts a JOIN program_runs r ON r.program_run_id = a.program_run_id WHERE a.attempt_id = $1::uuid`;
const WITNESS_SQL = `SELECT s.script_version_id::text AS script_version_id, s.artifact_id::text AS artifact_id,
  s.revision_parent_id::text AS revision_parent_id, s.revision_parent_content_identity, c.content_hash AS child_hash,
  p.content_hash AS parent_hash FROM script_versions s JOIN artifacts c ON c.artifact_id = s.artifact_id
  LEFT JOIN artifacts p ON p.artifact_id = $2::uuid WHERE s.script_version_id = $1::uuid`;
const INSERT_SQL = `INSERT INTO gate_results (gate_result_id, gate_definition_id, attempt_id, input_fingerprint, outcome, result, created_at)
  VALUES ($1::uuid, $2::uuid, $3::uuid, $4::sha256_hex, $5::text, $6::jsonb, $7::timestamptz)`;

/** The definitions statement: the 18 expected rows with a native flag on every column, including the whole `definition` jsonb. */
export function definitionsStatement(plan: GatePlan): Statement {
  return {
    text: DEFINITIONS_SQL,
    values: [
      plan.definitions.map((item) => item.gate_definition_id),
      plan.definitions.map((item) => item.gate_name),
      plan.definitions.map((item) => item.version),
      plan.definitions.map((item) => canonicalJson(item.definition)),
    ],
  };
}
/** The gate's own claim universe: every claim of the admitted, member-hash-bound full evidence package (nine), not the writer's selected eight. */
function gateClaimIds(plan: GatePlan): string[] {
  const manifest = plan.package_payload.manifest;
  if (
    !isObj(manifest) ||
    !isArr(manifest.claims) ||
    manifest.claims.length === 0
  )
    throw new GateShapeError();
  return manifest.claims.map((entry) => {
    if (!isObj(entry) || !isStr(entry.claim_id)) throw new GateShapeError();
    return entry.claim_id;
  });
}
/** The gate's own evidence-metadata universe: every evidence unit of the admitted, member-hash-bound full evidence package (sixteen), not the writer's selected three. */
function gateEvidenceIds(plan: GatePlan): string[] {
  const manifest = plan.package_payload.manifest;
  if (
    !isObj(manifest) ||
    !isArr(manifest.evidence) ||
    manifest.evidence.length === 0
  )
    throw new GateShapeError();
  return manifest.evidence.map((entry) => {
    if (!isObj(entry) || !isStr(entry.evidence_unit_id))
      throw new GateShapeError();
    return entry.evidence_unit_id;
  });
}
/** The 145 fixed, ordered statements: the 134 unchanged texture SELECTs, definitions, host ids and the nine factual SELECTs. Pure. */
export function gateSnapshotStatements(plan: GatePlan): Statement[] {
  const claimIds = gateClaimIds(plan);
  return [
    ...textureSnapshotStatements(plan.texture),
    definitionsStatement(plan),
    { text: HOST_ROWS_SQL, values: [GATE_PIN.host_attempt_id] },
    {
      text: RIGHTS_SQL,
      values: [[GATE_PIN.paraphrase_rights_id, GATE_PIN.quote_rights_id]],
    },
    { text: SUPPORTS_SQL, values: [claimIds] },
    { text: DERIVATION_SQL, values: [GATE_PIN.derivation_run_id] },
    {
      text: CARRIERS_SQL,
      values: [[GATE_PIN.signal_carrier_id, GATE_PIN.continuity_carrier_id]],
    },
    { text: EVENTS_SQL, values: [claimIds] },
    { text: CLAIMS_SQL, values: [claimIds] },
    { text: PRONUNCIATIONS_SQL, values: [] },
    { text: RENDERINGS_SQL, values: [] },
    {
      text: EVIDENCE_SQL,
      values: [gateEvidenceIds(plan)],
    },
  ];
}
export interface ExpectedRow {
  readonly gate_result_id: string;
  readonly gate_definition_id: string;
  readonly attempt_id: string;
  readonly input_fingerprint: string;
  readonly outcome: string;
  readonly result: Obj;
  readonly created_at: string;
}
/** The native expected-row comparison: every expected row, every column, jsonb and timestamptz by database equality. */
export function expectedComparisonStatement(
  rows: readonly ExpectedRow[],
): Statement {
  return {
    text: EXPECTED_SQL,
    values: [
      rows.map((_, index) => index + 1),
      rows.map((row) => row.gate_result_id),
      rows.map((row) => row.gate_definition_id),
      rows.map((row) => row.attempt_id),
      rows.map((row) => row.input_fingerprint),
      rows.map((row) => row.outcome),
      rows.map((row) => canonicalJson(row.result)),
      rows.map((row) => row.created_at),
    ],
  };
}
const FACT_STATEMENTS = 9;
function listOf(
  value: readonly Row[] | undefined,
  count: number | undefined,
): Row[] {
  if (value === undefined || (count !== undefined && value.length !== count))
    throw new GateShapeError();
  for (const row of value) if (!isObj(row)) throw new GateShapeError();
  return [...value];
}
/** Interprets the nine factual results (rights, supports, derivation, carriers, events, claims, pronunciations, renderings, evidence). */
export function parseGateFacts(
  results: readonly (readonly Row[])[],
  plan: GatePlan,
): GateFacts {
  if (results.length !== FACT_STATEMENTS) throw new GateShapeError();
  const derivation = listOf(results[2], undefined);
  if (derivation.length > 1) throw new GateShapeError();
  const renderings = listOf(results[7], undefined);
  const pronunciations = listOf(results[6], undefined);
  if (renderings.length === 0 || pronunciations.length === 0)
    throw new GateShapeError();
  return {
    rights: listOf(results[0], 2),
    supports: listOf(results[1], undefined),
    derivation: derivation[0],
    carriers: listOf(results[3], 2),
    events: listOf(results[4], undefined),
    claims: listOf(results[5], gateClaimIds(plan).length),
    pronunciations,
    renderings,
    evidence: listOf(results[8], gateEvidenceIds(plan).length),
  };
}

// ---- the raw snapshot, the private candidate and the reader-owned acquisition ----------------------------------------------------------------------
export interface GateRawSnapshot {
  readonly texture: TextureRawSnapshot;
  readonly definitions: readonly Row[];
  readonly host: readonly Row[];
  readonly facts: GateFacts;
  /** `full`: the 31 historical and the 18 computed owned rows were compared; `history`: only the 31 (no owned values exist). */
  readonly expected: "full" | "history";
  readonly flags: readonly Row[];
}
export type GateCandidate =
  | {
      readonly kind: "ready";
      readonly rows: readonly OwnedRow[];
      readonly evaluation: ComponentEvaluation;
    }
  | {
      readonly kind: "stop";
      readonly code: "gate_mapping_invariant" | "gate_precondition_failed";
      readonly check?: 13 | 14;
    }
  | { readonly kind: "unavailable" };
/** The candidate evaluation of one captured snapshot: private, non-writable, built before any classification and never from a caller value. */
export function candidateOf(
  plan: GatePlan,
  texture: TextureRawSnapshot,
  facts: GateFacts,
): GateCandidate {
  const view = texture.revision.critic.upstream;
  const payload: unknown = view.pkg?.payload;
  const brief: unknown = view.brief?.payload;
  if (!isObj(payload) || !isObj(payload.manifest) || !isObj(brief))
    return { kind: "unavailable" };
  let inputs: ComponentInputs;
  try {
    inputs = componentInputsOf(plan, texture, facts, payload.manifest, brief);
  } catch (error) {
    if (error instanceof GateShapeError)
      return { kind: "stop", code: "gate_mapping_invariant" };
    throw error;
  }
  const pre = checkPreconditions(inputs);
  if (!pre.ok)
    return { kind: "stop", code: "gate_precondition_failed", check: pre.check };
  const evaluation = evaluateGateComponent(inputs);
  const rows = ownedRowsOf(plan, evaluation.rows);
  if (
    rows.length !== GATE_DEFINITION_KEYS.length ||
    !rows.every((row) => isClosedResult(row.result))
  )
    return { kind: "stop", code: "gate_mapping_invariant" };
  // the full stored rows (and the returned warnings and coverage) are scanned before the candidate can become ready or reach any writer
  if (
    scanGateSurfaces(
      { rows, warnings: evaluation.warnings, coverage: evaluation.coverage },
      inputs.originals,
    ) !== null
  )
    throw new TypeError(WITHHELD_REACHED_SURFACE);
  return { kind: "ready", rows, evaluation };
}
const expectedRowsOf = (
  plan: GatePlan,
  candidate: GateCandidate,
): ExpectedRow[] => [
  ...plan.historical,
  ...(candidate.kind === "ready" ? candidate.rows : []),
];
export interface GateStaged {
  readonly texture: TextureRawSnapshot;
  readonly definitions: readonly Row[];
  readonly host: readonly Row[];
  readonly facts: GateFacts | undefined;
  readonly candidate: GateCandidate;
  readonly statement: Statement;
}
/** Everything the reader builds inside its transaction from the 145 captured results (pure; an unowned throwable propagates unchanged). */
export function stageGateSnapshot(
  plan: GatePlan,
  results: readonly (readonly Row[])[],
): GateStaged {
  const texture = assembleTextureRaw(
    plan.texture,
    results.slice(0, TEXTURE_STATEMENT_COUNT),
  );
  const definitions = results[TEXTURE_STATEMENT_COUNT] ?? [];
  const host = results[TEXTURE_STATEMENT_COUNT + 1] ?? [];
  let facts: GateFacts | undefined;
  let candidate: GateCandidate;
  try {
    facts = parseGateFacts(results.slice(TEXTURE_STATEMENT_COUNT + 2), plan);
    candidate = candidateOf(plan, texture, facts);
  } catch (error) {
    if (!(error instanceof GateShapeError)) throw error;
    candidate = { kind: "stop", code: "gate_mapping_invariant" };
  }
  return {
    texture,
    definitions,
    host,
    facts,
    candidate,
    statement: expectedComparisonStatement(expectedRowsOf(plan, candidate)),
  };
}
const EMPTY_FACTS: GateFacts = deepFreeze({
  claims: [],
  supports: [],
  events: [],
  derivation: undefined,
  carriers: [],
  rights: [],
  evidence: [],
  pronunciations: [],
  renderings: [],
});
/** The raw snapshot of one staged read and the native comparison rows it returned. */
export function gateRawOf(
  staged: GateStaged,
  flags: readonly Row[],
): GateRawSnapshot {
  return {
    texture: staged.texture,
    definitions: staged.definitions,
    host: staged.host,
    facts: staged.facts ?? EMPTY_FACTS,
    expected: staged.candidate.kind === "ready" ? "full" : "history",
    flags,
  };
}
/** A successful read: minted only by `readGateSnapshot` after COMMIT and release succeeded, bound to the exact admitted plan. */
export interface GateAcquisition {
  readonly point: "preflight" | "final";
  readonly plan: GatePlan;
  readonly raw: GateRawSnapshot;
  readonly candidate: GateCandidate;
}
const ACQUISITIONS = new WeakSet<object>();
export const isGateAcquisition = (value: unknown): value is GateAcquisition =>
  typeof value === "object" && value !== null && ACQUISITIONS.has(value);
export type GateSnapshotRead =
  | { readonly ok: true; readonly acquisition: GateAcquisition }
  | { readonly ok: false; readonly cleanup: Cleanup };
/**
 * ONE checked-out `REPEATABLE READ READ ONLY` transaction: the 145 static SELECTs, the private candidate evaluation, the one native
 * expected-row SELECT, COMMIT, and release before anything is returned. Ownership-based cleanup is the texture reader's: a failed connect
 * acquired nothing; for an acquired client a failure of BEGIN, a read, the candidate construction or COMMIT triggers at most one ROLLBACK
 * and exactly one attempted `release(true)`; failed attempts are counted, never retried. After a successful COMMIT the release is
 * attempted once; if it throws all snapshot data is discarded and no acquisition exists. A hook throwable or an unowned exception from
 * statement or candidate construction propagates with its original identity after the bounded cleanup.
 */
export async function readGateSnapshot(
  pool: Pool,
  plan: GatePlan,
  point: "preflight" | "final",
): Promise<GateSnapshotRead> {
  if (!isAdmittedGatePlan(plan))
    throw new TypeError("an admitted gate plan is required");
  const statements = gateSnapshotStatements(plan);
  const results: Row[][] = [];
  let failed = false as boolean;
  let thrown = undefined as { readonly error: unknown } | undefined;
  let staged: GateStaged | undefined;
  let flags: Row[] = [];
  let cleanup = 0;
  const onError = (): void => {
    failed = true;
  };
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
  } catch {
    failed = true;
  }
  if (client) {
    client.on("error", onError);
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    } catch {
      failed = true;
    }
    for (let i = 0; i < statements.length && !failed && !thrown; i += 1) {
      const statement = statements[i];
      if (!statement) break;
      try {
        results.push(
          (await client.query<Row>(statement.text, statement.values)).rows,
        );
      } catch {
        failed = true;
      }
      if (i === 0 && !failed) {
        try {
          await faultPoint(
            point === "preflight"
              ? "claims_writing_gate_preflight_after_first_read"
              : "claims_writing_gate_final_after_first_read",
          );
        } catch (error) {
          thrown = { error };
        }
      }
    }
    if (!failed && !thrown) {
      try {
        staged = stageGateSnapshot(plan, results);
      } catch (error) {
        thrown = { error };
      }
    }
    if (!failed && !thrown && staged) {
      try {
        flags = (
          await client.query<Row>(
            staged.statement.text,
            staged.statement.values,
          )
        ).rows;
      } catch {
        failed = true;
      }
    }
    if (!failed && !thrown) {
      try {
        await client.query("COMMIT");
      } catch {
        failed = true;
      }
    }
    if (failed || thrown) {
      try {
        await client.query("ROLLBACK");
      } catch {
        cleanup += 1;
      }
    }
    try {
      client.release(true);
    } catch {
      cleanup += 1;
      failed = true;
    }
    client.removeListener("error", onError);
  }
  if (thrown) throw thrown.error;
  if (failed || !staged)
    return { ok: false, cleanup: { attached_errors: cleanup, complete: true } };
  const acquisition: GateAcquisition = deepFreeze({
    point,
    plan,
    raw: gateRawOf(staged, flags),
    candidate: staged.candidate,
  });
  ACQUISITIONS.add(acquisition);
  return { ok: true, acquisition };
}

// ---- classification: total precedence over one captured snapshot -----------------------------------------------------------------------------------
export interface GateStopRow {
  readonly stage: GateStopStage;
  readonly code: GateStopCode;
  readonly detail: GateStopDetail;
  readonly verified?: {
    readonly pass1?: boolean;
    readonly critic?: boolean;
    readonly revision?: boolean;
  };
}
export type GateClassified =
  | { readonly kind: "state"; readonly gate: 0 | 18; readonly texture: 4 }
  | { readonly kind: "stop"; readonly row: GateStopRow };
const FLAG_COLUMNS: readonly string[] = [
  "eq_gate_definition_id",
  "eq_attempt_id",
  "eq_input_fingerprint",
  "eq_outcome",
  "eq_result",
  "eq_created_at",
];
const allEqual = (row: Row | undefined): boolean =>
  row?.present === true && FLAG_COLUMNS.every((name) => row[name] === true);
const flagAt = (
  raw: Pick<GateRawSnapshot, "flags">,
  position: number,
): Row | undefined => raw.flags.find((row) => row.n === position);
function definitionsComplete(raw: GateRawSnapshot, plan: GatePlan): boolean {
  return plan.definitions.every((pin) => {
    const row = raw.definitions.find(
      (item) => item.gate_definition_id === pin.gate_definition_id,
    );
    return (
      row?.present === true &&
      row.eq_gate_name === true &&
      row.eq_version === true &&
      row.eq_definition === true
    );
  });
}
type Partition =
  | { readonly kind: "clean"; readonly k: 0 | 18 }
  | {
      readonly kind: "defect";
      readonly code: GateStopCode;
      readonly detail: GateStopDetail;
    };
/** History, owned conflict, stale, foreign and owned-partial, in that priority, over the full expected set (before any count subtraction). */
function partitionOf(
  raw: Pick<GateRawSnapshot, "host" | "flags">,
  plan: GatePlan,
): Partition {
  const owned = plan.result_ids.map((_, index) =>
    flagAt(raw, plan.historical.length + index + 1),
  );
  if (owned.some((row) => row?.present === true && !allEqual(row)))
    return {
      kind: "defect",
      code: "gate_result_conflict",
      detail: {
        conflict: { row: "gate_results", kind: "same_id_different_content" },
      },
    };
  const known = new Set([
    ...plan.historical.map((row) => row.gate_result_id),
    ...plan.result_ids,
  ]);
  const unknown = raw.host.filter(
    (row) => !known.has(strOf(row.gate_result_id)),
  );
  if (
    unknown.some(
      (row) =>
        DEFINITION_IDS.includes(strOf(row.gate_definition_id)) &&
        row.input_fingerprint !== plan.fingerprint,
    )
  )
    return {
      kind: "defect",
      code: "gate_result_stale",
      detail: { conflict: { row: "gate_results", kind: "stale_fingerprint" } },
    };
  if (unknown.length > 0)
    return {
      kind: "defect",
      code: "gate_result_foreign",
      detail: { conflict: { row: "gate_results", kind: "foreign_row" } },
    };
  const k = owned.filter(allEqual).length;
  if (k !== 0 && k !== GATE_DEFINITION_KEYS.length)
    return {
      kind: "defect",
      code: "gate_unexpected_state",
      detail: { conflict: { row: "gate_results", kind: "owned_partial" } },
    };
  return { kind: "clean", k: k === 0 ? 0 : 18 };
}
/** The count projection: subtracts exactly the `k` owned rows proven equal to plan rows from the `gate_results` count and nothing else. */
export function projectGateCounts(
  texture: TextureRawSnapshot,
  k: number,
): TextureRawSnapshot {
  if (k === 0) return texture;
  return {
    ...texture,
    counts: texture.counts.map((row) =>
      row.t === "gate_results" && isInt(row.n) ? { ...row, n: row.n - k } : row,
    ),
  };
}
/**
 * Pure classification of one captured snapshot, first match wins: definitions complete; historical identity; any recorded mapping or
 * precondition stop; owned conflict, stale, foreign, partial; the unchanged texture classifier over the exact-k count projection; the
 * texture state. `final` demands gate 18 + texture 4. A raw snapshot classified here can never mint write authority.
 */
export function classifyGateRaw(
  raw: GateRawSnapshot,
  plan: GatePlan,
  candidate: GateCandidate,
  mode: "preflight" | "final",
): GateClassified {
  const stage: GateStopStage =
    mode === "preflight" ? "preconditions" : "final_check";
  const stop = (
    code: GateStopCode,
    detail: GateStopDetail = {},
    at: GateStopStage = stage,
    verified?: GateStopRow["verified"],
  ): GateClassified => ({
    kind: "stop",
    row: {
      stage: at,
      code,
      detail,
      ...(verified !== undefined ? { verified } : {}),
    },
  });
  if (!definitionsComplete(raw, plan)) return stop("gate_definitions_mismatch");
  const history = plan.historical.every((_, index) =>
    allEqual(flagAt(raw, index + 1)),
  );
  if (!history) return stop("gate_history_mismatch");
  if (candidate.kind === "stop")
    return stop(
      candidate.code,
      candidate.check !== undefined ? { check: candidate.check } : {},
      mode === "preflight" ? "evaluation" : "final_check",
    );
  let k: 0 | 18 = 0;
  if (candidate.kind === "ready") {
    if (raw.expected !== "full")
      return stop("gate_mapping_invariant", {}, "evaluation");
    const partition = partitionOf(raw, plan);
    if (partition.kind === "defect")
      return stop(partition.code, partition.detail);
    k = partition.k;
  }
  const texture = classifyTextureSnapshot(
    projectGateCounts(raw.texture, k),
    plan.texture,
    mode,
  );
  if (texture.kind === "stop")
    return stop(
      "gate_upstream_stopped",
      { upstream_code: texture.row.code },
      stage,
      texture.row.verified,
    );
  if (candidate.kind !== "ready")
    return stop("gate_mapping_invariant", {}, "evaluation");
  if (mode === "final") {
    if (k !== 18 || texture.state !== 4)
      return stop("gate_final_state_mismatch");
    return { kind: "state", gate: 18, texture: 4 };
  }
  if (texture.state !== 4)
    return stop("gate_texture_incomplete", { texture_state: texture.state });
  return { kind: "state", gate: k, texture: 4 };
}
/** Classification of a reader-owned acquisition (the only path from a read to a decision). */
export function classifyGateAcquisition(
  acquisition: GateAcquisition,
  mode: "preflight" | "final",
): GateClassified {
  if (!isGateAcquisition(acquisition) || !isAdmittedGatePlan(acquisition.plan))
    throw new TypeError("a successful gate snapshot acquisition is required");
  return classifyGateRaw(
    acquisition.raw,
    acquisition.plan,
    acquisition.candidate,
    mode,
  );
}

// ---- the owned evaluation: minted only here, after complete classification -------------------------------------------------------------------------
export interface OwnedEvaluation {
  readonly plan: GatePlan;
  readonly rows: readonly OwnedRow[];
  readonly aggregate: GateAggregate;
  readonly warnings: readonly GateWarning[];
  readonly coverage: readonly CoverageEntry[];
  readonly preconditions: Extract<PreconditionResult, { ok: true }>;
}
const OWNED_EVALUATIONS = new WeakSet<object>();
export const isOwnedGateEvaluation = (
  value: unknown,
): value is OwnedEvaluation =>
  typeof value === "object" && value !== null && OWNED_EVALUATIONS.has(value);
/** Converts a stop row into the complete stop object under the cumulative context (monotone facts). */
export function stopFromRow(
  ctx: GateContext,
  row: GateStopRow,
  cleanup?: Cleanup,
  facts?: Partial<GateDurable>,
): GateStopped {
  const u: TextureUpstream = {
    pass1:
      ctx.u.pass1 === "present" || row.verified?.pass1 === true
        ? "present"
        : "unknown",
    critic:
      ctx.u.critic === "present" || row.verified?.critic === true
        ? "present"
        : "unknown",
    revision:
      ctx.u.revision === "present" || row.verified?.revision === true
        ? "present"
        : "unknown",
  };
  return gateStopOf(
    { ...ctx, u },
    row.stage,
    row.code,
    row.detail,
    cleanup,
    facts,
  );
}
/**
 * The ONLY mint of `OwnedEvaluation` besides the orchestrator that calls it: requires a reader-owned acquisition of an admitted plan, classifies it
 * completely (definitions, history, mapping/precondition, partition, texture) and only a clean gate state 0 or 18 with a ready candidate yields the
 * deep-frozen token. A plain object, a raw snapshot, a component evaluation, a structural clone or an acquisition of another plan is refused.
 */
export function produceGateEvaluation(
  acquisition: GateAcquisition,
  ctx: GateContext = initialGateContext(),
):
  | {
      readonly kind: "evaluated";
      readonly evaluation: OwnedEvaluation;
      readonly gate: 0 | 18;
    }
  | GateStopped {
  if (!isGateAcquisition(acquisition) || acquisition.point !== "preflight")
    throw new TypeError(
      "a successful preflight gate snapshot acquisition is required",
    );
  const classified = classifyGateAcquisition(acquisition, "preflight");
  if (classified.kind === "stop") return stopFromRow(ctx, classified.row);
  const { candidate, plan } = acquisition;
  if (candidate.kind !== "ready" || !candidate.evaluation.preconditions.ok)
    return stopFromRow(ctx, {
      stage: "evaluation",
      code: "gate_mapping_invariant",
      detail: {},
    });
  const evaluation: OwnedEvaluation = deepFreeze({
    plan,
    rows: candidate.rows,
    aggregate: candidate.evaluation.aggregate,
    warnings: candidate.evaluation.warnings,
    coverage: candidate.evaluation.coverage,
    preconditions: candidate.evaluation.preconditions,
  });
  OWNED_EVALUATIONS.add(evaluation);
  return { kind: "evaluated", evaluation, gate: classified.gate };
}

// ---- the single atomic writer: all 18 rows or none --------------------------------------------------------------------------------------------
export type GateRecordResult =
  | { readonly kind: "created" | "converged" }
  | GateStopped;
const STOP_CODE_SET: ReadonlySet<string> = new Set(GATE_STOP_CODES);
type Convergence = "created" | "converged";
const expectedAll = (evaluation: OwnedEvaluation): ExpectedRow[] => [
  ...evaluation.plan.historical,
  ...evaluation.rows,
];
/**
 * Creates the eighteen rows of an owned evaluation in one READ COMMITTED command under the per-fingerprint advisory lock. The complete
 * read prefix is collected first (host, definitions, host ids, native expected-row flags, texture witness) and classified as a whole; no INSERT
 * is sent before every prefix check passed. A unique race on `gate_results_pkey` is re-probed natively; any other database error is rethrown
 * through the command helper's documented projection. Only `CommandConnectionError` is mapped; every other throwable propagates unchanged.
 */
export async function recordClaimsWritingGate(
  pool: Pool,
  plan: GatePlan,
  evaluation: OwnedEvaluation,
  context: GateContext = initialGateContext(),
): Promise<GateRecordResult> {
  if (
    !isAdmittedGatePlan(plan) ||
    !isOwnedGateEvaluation(evaluation) ||
    evaluation.plan !== plan
  )
    throw new TypeError("an owned evaluation of this plan is required");
  const ctx: GateContext = { ...context, w: true };
  const upstream = plan.texture.revision.critic.upstream;
  const comparison = expectedComparisonStatement(expectedAll(evaluation));
  const definitionsText = definitionsStatement(plan);
  const rejectedAs = (
    code: GateStopCode,
    detail: string,
  ): Outcome<Convergence> => ({
    kind: "rejected",
    code,
    detail,
  });
  let outcome: Outcome<Convergence>;
  try {
    outcome = await runCommand<Convergence>(pool, async (tx: Tx) => {
      await tx.query(LOCK_SQL, [
        GATE_PIN.lock_class,
        `claims_writing_gate:${plan.fingerprint}`,
      ]);
      await faultPoint("claims_writing_gate_after_lock");
      const host = await tx.query(GATE_HOST_SQL, [GATE_PIN.host_attempt_id]);
      const definitions = await tx.query(
        definitionsText.text,
        definitionsText.values,
      );
      const hostRows = await tx.query(HOST_ROWS_SQL, [
        GATE_PIN.host_attempt_id,
      ]);
      const flags = await tx.query(comparison.text, comparison.values);
      const witness = await tx.query(WITNESS_SQL, [
        GATE_PIN.child_script_version_id,
        GATE_PIN.parent_script_artifact_id,
      ]);
      if (!hostMatches(host.rows[0], upstream))
        return rejectedAs("gate_upstream_stopped", "texture_host_changed");
      const raw: Pick<GateRawSnapshot, "host" | "flags" | "definitions"> = {
        host: hostRows.rows,
        flags: flags.rows,
        definitions: definitions.rows,
      };
      if (!definitionsComplete(raw as GateRawSnapshot, plan))
        return rejectedAs("gate_definitions_mismatch", "");
      if (
        !plan.historical.every((_, index) => allEqual(flagAt(raw, index + 1)))
      )
        return rejectedAs("gate_history_mismatch", "");
      const child = witness.rows[0];
      if (
        child?.artifact_id !== GATE_PIN.child_script_artifact_id ||
        child.revision_parent_id !== GATE_PIN.parent_script_version_id ||
        child.revision_parent_content_identity !==
          GATE_PIN.parent_script_hash ||
        child.child_hash !== GATE_PIN.child_script_hash ||
        child.parent_hash !== GATE_PIN.parent_script_hash
      )
        return rejectedAs("gate_texture_incomplete", "");
      const partition = partitionOf(raw, plan);
      if (partition.kind === "defect")
        return {
          kind: "conflict",
          code: partition.code,
          stored: partition.detail,
          detail: "",
        };
      if (partition.k === GATE_DEFINITION_KEYS.length)
        return { kind: "converged", record: "converged" };
      let inserted = 0;
      for (const row of evaluation.rows) {
        const attempt = await tx.attempt(INSERT_SQL, [
          row.gate_result_id,
          row.gate_definition_id,
          row.attempt_id,
          row.input_fingerprint,
          row.outcome,
          canonicalJson(row.result),
          row.created_at,
        ]);
        if (!attempt.ok) {
          if (!isUnique(attempt.error, "gate_results_pkey"))
            rethrow(attempt.error);
          const probe = expectedComparisonStatement([row]);
          const again = await tx.query(probe.text, probe.values);
          if (!allEqual(again.rows[0]))
            return {
              kind: "conflict",
              code: "gate_result_conflict",
              stored: {
                conflict: {
                  row: "gate_results",
                  kind: "same_id_different_content",
                },
              },
              detail: "",
            };
        }
        inserted += 1;
        if (inserted === 5)
          await faultPoint("claims_writing_gate_after_insert_5");
      }
      const finalHost = await tx.query(HOST_ROWS_SQL, [
        GATE_PIN.host_attempt_id,
      ]);
      const finalFlags = await tx.query(comparison.text, comparison.values);
      const reconciled = partitionOf(
        { host: finalHost.rows, flags: finalFlags.rows },
        plan,
      );
      if (
        reconciled.kind !== "clean" ||
        reconciled.k !== GATE_DEFINITION_KEYS.length ||
        !plan.historical.every((_, index) =>
          allEqual(flagAt({ flags: finalFlags.rows }, index + 1)),
        )
      )
        return rejectedAs("gate_reconcile_failed", "");
      await faultPoint("claims_writing_gate_after_reconcile");
      return { kind: "created", record: "created" };
    });
  } catch (error) {
    if (error instanceof CommandConnectionError)
      return gateStopOf(
        ctx,
        "record",
        "gate_command_connection",
        {
          connection: {
            phase: error.phase,
            commit_outcome: error.commitOutcome,
          },
        },
        { attached_errors: commandCleanupErrors(error).length, complete: true },
        { gate: "unknown" },
      );
    throw error;
  }
  if (outcome.kind === "created" || outcome.kind === "converged")
    return { kind: outcome.record };
  if (outcome.kind === "conflict" || outcome.kind === "rejected") {
    const code: GateStopCode = STOP_CODE_SET.has(outcome.code)
      ? (outcome.code as GateStopCode)
      : "gate_write_rejected";
    const stored =
      outcome.kind === "conflict" && isObj(outcome.stored)
        ? outcome.stored
        : {};
    const detail: GateStopDetail = {
      ...(code === "gate_upstream_stopped"
        ? { upstream_code: "texture_host_changed" as const }
        : {}),
      ...(isObj(stored.conflict)
        ? {
            conflict: stored.conflict as unknown as NonNullable<
              GateStopDetail["conflict"]
            >,
          }
        : {}),
    };
    return gateStopOf(ctx, "record", code, detail);
  }
  return gateStopOf(ctx, "record", "gate_write_rejected");
}

// ---- the recorded summary ------------------------------------------------------------------------------------------------------------------------
export interface GateRecorded {
  readonly kind: "recorded";
  readonly identities: {
    readonly fingerprint: string;
    readonly script_hash: string;
    readonly parent_script_hash: string;
    readonly script_version_id: string;
    readonly attempt_id: string;
  };
  readonly convergence: Convergence;
  readonly aggregate: GateAggregate;
  readonly rows: readonly {
    readonly key: GateDefinitionKey;
    readonly gate_result_id: string;
    readonly outcome: "pass" | "fail";
    readonly violations: number;
    readonly proof_gaps: number;
  }[];
  readonly counts: {
    readonly rows_recorded: number;
    readonly definitions_passed: number;
    readonly definitions_failed: number;
  };
  readonly preconditions: {
    readonly claims13: {
      readonly verified: number;
      readonly events: number;
      readonly limits: readonly CoverageLimit[];
    };
    readonly claims14: { readonly verified: number };
  };
  readonly warnings: readonly GateWarning[];
  readonly coverage: readonly CoverageEntry[];
  readonly gates_not_run: readonly string[];
  readonly not_proven: readonly string[];
  readonly durable: GateDurable;
  readonly reconciled: true;
}
const findingCount = (row: OwnedRow, kind: FindingClass): number =>
  records(row.result.findings).filter((item) => item.class === kind).length;
export function recordedOf(
  evaluation: OwnedEvaluation,
  convergence: Convergence,
): GateRecorded {
  const { plan } = evaluation;
  return deepFreeze({
    kind: "recorded" as const,
    identities: {
      fingerprint: plan.fingerprint,
      script_hash: plan.texture.script_hash,
      parent_script_hash: plan.texture.parent_script_hash,
      script_version_id: plan.texture.ids.script_version_id,
      attempt_id: plan.texture.invocation.attempt_id,
    },
    convergence,
    aggregate: evaluation.aggregate,
    rows: evaluation.rows.map((row) => ({
      key: row.key,
      gate_result_id: row.gate_result_id,
      outcome: row.outcome,
      violations: findingCount(row, "violation"),
      proof_gaps: findingCount(row, "proof_gap"),
    })),
    counts: {
      rows_recorded: evaluation.rows.length,
      definitions_passed: evaluation.rows.filter(
        (row) => row.outcome === "pass",
      ).length,
      definitions_failed: evaluation.rows.filter(
        (row) => row.outcome === "fail",
      ).length,
    },
    preconditions: {
      claims13: evaluation.preconditions.claims13,
      claims14: evaluation.preconditions.claims14,
    },
    warnings: evaluation.warnings,
    coverage: evaluation.coverage,
    gates_not_run: GATE_GATES_NOT_RUN,
    not_proven: GATE_NOT_PROVEN,
    durable: { gate: "present" as const, texture: "present" as const },
    reconciled: true as const,
  });
}

// ---- the output-surface scan -------------------------------------------------------------------------------------------------------------------------
const WITHHELD_REACHED_SURFACE = "withheld text reached a gate output surface";
/**
 * The first surface (in the fixed order) with a string leaf, object keys included, that shares a >= 24-code-point run with a withheld original;
 * else `null`. A reviewed adapter over the accepted primitives; the content guarantee is the closed vocabulary, not this scan.
 */
export function scanGateSurfaces(
  surfaces: Partial<Record<GateSurface, unknown>>,
  originals: readonly string[],
): GateSurface | null {
  for (const surface of GATE_SURFACES) {
    if (!(surface in surfaces)) continue;
    for (const leaf of stringLeaves(surfaces[surface]))
      if (originals.some((original) => sharesRun(leaf, original, GUARD_RUN)))
        return surface;
  }
  return null;
}
function guarded<T extends GateStopped | GateRecorded>(
  value: T,
  plan: GatePlan,
): T {
  const originals = plan.texture.revision.critic.upstream.originals;
  const hit =
    value.kind === "recorded"
      ? scanGateSurfaces(
          {
            summary: value,
            warnings: value.warnings,
            coverage: value.coverage,
          },
          originals,
        )
      : scanGateSurfaces({ stop: value }, originals);
  if (hit !== null) throw new TypeError(WITHHELD_REACHED_SURFACE);
  return value;
}

// ---- the orchestrator: the ONLY composition (plan -> snapshot -> evaluation -> single write -> fresh final snapshot) -----------------------------
/**
 * One invocation. Entry gate state 18 converges with no write and no final snapshot (the single preflight snapshot established it);
 * state 0 writes once and re-reads. Unrelated drift is reported by the unchanged texture classifier, never relabelled. Nothing here retries,
 * rolls back after a success, takes over, leases or resumes; an unowned throwable propagates unchanged.
 */
export async function runClaimsWritingGate(
  pool: Pool,
  invocation: unknown,
  inputs: GatePlanInputs = {},
): Promise<GateRecorded | GateStopped> {
  const planned = planClaimsWritingGate(invocation, inputs);
  if (planned.kind === "stopped") return planned;
  const { plan } = planned;
  let ctx = initialGateContext();

  const first = await readGateSnapshot(pool, plan, "preflight");
  if (!first.ok)
    return guarded(
      gateStopOf(
        ctx,
        "preconditions",
        "gate_snapshot_failed",
        {},
        first.cleanup,
      ),
      plan,
    );
  const produced = produceGateEvaluation(first.acquisition, ctx);
  if (produced.kind === "stopped") return guarded(produced, plan);
  ctx = {
    w: false,
    gate: produced.gate === 18 ? "present" : "none_observed",
    texture: "present",
    u: PRESENT_UPSTREAM,
  };
  await faultPoint("claims_writing_gate_after_preflight");
  if (produced.gate === 18)
    return guarded(recordedOf(produced.evaluation, "converged"), plan);

  // the first writing command begins here; never reset
  ctx = { ...ctx, w: true };
  const written = await recordClaimsWritingGate(
    pool,
    plan,
    produced.evaluation,
    ctx,
  );
  if (written.kind === "stopped") return guarded(written, plan);
  ctx = { ...ctx, gate: "present" };

  await faultPoint("claims_writing_gate_before_final_check");
  const last = await readGateSnapshot(pool, plan, "final");
  if (!last.ok)
    return guarded(
      gateStopOf(ctx, "final_check", "gate_snapshot_failed", {}, last.cleanup),
      plan,
    );
  const final = classifyGateAcquisition(last.acquisition, "final");
  if (final.kind === "stop") return guarded(stopFromRow(ctx, final.row), plan);
  return guarded(recordedOf(produced.evaluation, written.kind), plan);
}
