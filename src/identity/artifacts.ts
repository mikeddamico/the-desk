import { connectedFixture105DomainHash } from "./domains.js";
// Artifact projections and content hashes (Hashing v0.1.5 sections 3-4, 12.4; Writing v0.2.3 5.1 and 7.1 with the
// Writing Build 1-2 Fixture-Profile Addendum v0.1;
// Showrunner Planning v0.1.3 6.1; Performance & Render v0.1.4 manifest hash; Evidence Package v0.2.2 semantic manifest).
// Each projection SELECTS the governed fields from an authoritative object; none serializes a persistence row.
// Owning authority and status for every selection: docs/identity-projection-authority.md. Pure; no I/O.
import {
  canonicalBytes,
  canonicalTimestamp,
  canonicalJson,
  sha256,
} from "./canonical-json.js";
import { governedDomainHash, rawBytesHash } from "./domains.js";
import {
  asArray,
  asInteger,
  asNonBlankString,
  asRecord,
  asString,
  compareStrings,
  selectKeys,
  semanticLabel,
  type JsonObject,
} from "./select.js";
import { ProfileRejected, requireProfileKeys } from "./profile-errors.js";

// ---- Hashing 4.5 / 4.6 exact key tables (explicit) --------------------------------------------------------------
export const semanticAuditResultFields = [
  "auditor_kind",
  "auditor_version",
  "input_projection",
  "input_fingerprint",
  "result",
  "findings",
  "fixture_stub",
] as const;
export const mechanicalValidationResultFields = [
  "validation_policy_version",
  "base_request_hash",
  "take_index",
  "audio_sha256",
  "result",
  "failure_code",
  "measurements",
] as const;
export const revalidationSnapshotFields = [
  "fixture_stub",
  "live_search",
  "source_package_hash",
  "claim_state_changes",
  "sensitivity_changes",
  "mode_rule_changes",
  "captured_at",
] as const;
export const revalidationResultFields = [
  "adapter",
  "fixture_stub",
  "ready_candidate_fingerprint",
  "snapshot_artifact_id",
  "snapshot_hash",
  "result",
  "expires_at",
  "publication_enabled",
  "next_allowed_state",
  "publishing_transition_allowed",
] as const;
export const assemblyRecipeFields = [
  "assembly_recipe_version",
  "ordered_audio_artifact_hashes",
  "normalization",
  "output_target",
  "trim_policy_version",
  "join_gap_policy_version",
  "fade_policy_version",
  "static_asset_hashes",
  "deterministic_fixture_command",
] as const;
export const masterAssemblyMapFields = [
  "assembly_recipe_id",
  "assembly_recipe_hash",
  "master_audio_artifact_id",
  "master_artifact_id",
  "master_audio_hash",
  "sample_rate_hz",
  "selected_audio_hashes",
  "segments",
  "program_block_offsets",
  "timing_method",
  "timing_confidence",
] as const;
export const writerContextManifestFields = [
  "required_component_refs",
  "required_claim_refs",
  "required_context_selection_refs",
  "required_character_refs",
  "required_policy_refs",
  "required_comprehension_target_refs",
  "serialized_input_hash",
  "estimated_input_tokens",
  "model_context_limit",
  "reserved_output_tokens",
  "completeness_check",
] as const;

function hashSelected(
  domain: Parameters<typeof governedDomainHash>[0],
  source: unknown,
  keys: readonly string[],
  what: string,
): string {
  return governedDomainHash(domain, selectKeys(source, keys, what));
}

/** Hashing v0.1.5 4.6.1: for Builds 1-2 the findings list must be the empty array; any other value is rejected. */
export function assertSupportedAuditFindings(findings: unknown): void {
  if (!Array.isArray(findings) || findings.length !== 0)
    throw new ProfileRejected("audit_findings_unsupported");
}

export const semanticAuditResultHash = (source: unknown): string => {
  assertSupportedAuditFindings(
    asRecord(source, "semantic audit result").findings,
  );
  return hashSelected(
    "semantic-audit-result-v1",
    source,
    semanticAuditResultFields,
    "semantic audit result",
  );
};
export const mechanicalValidationResultHash = (source: unknown): string =>
  hashSelected(
    "mechanical-validation-result-v1",
    source,
    mechanicalValidationResultFields,
    "mechanical validation result",
  );
export const revalidationSnapshotHash = (source: unknown): string => {
  const selected = selectKeys(
    source,
    revalidationSnapshotFields,
    "revalidation snapshot",
  );
  canonicalTimestamp(asString(selected.captured_at, "captured_at"));
  return governedDomainHash("fixture-revalidation-snapshot-v1", selected);
};
export const revalidationResultHash = (source: unknown): string => {
  const selected = selectKeys(
    source,
    revalidationResultFields,
    "revalidation result",
  );
  canonicalTimestamp(asString(selected.expires_at, "expires_at"));
  return governedDomainHash("fixture-revalidation-result-v1", selected);
};
export const assemblyRecipeHash = (source: unknown): string =>
  hashSelected(
    "assembly-recipe-v1",
    source,
    assemblyRecipeFields,
    "assembly recipe",
  );
/** Hashing 4.5: each ordered segment selects exactly these eleven fields (static segments carry explicit nulls). */
export const masterAssemblySegmentFields = [
  "kind",
  "audio_artifact_id",
  "artifact_id",
  "audio_sha256",
  "render_block_id",
  "render_take_id",
  "take_selection_id",
  "program_block_id",
  "start_frame",
  "end_frame",
  "join_metadata",
] as const;
/** Hashing 4.5: program-block offset entries select exactly these three fields, in program-block order. */
export const masterAssemblyOffsetFields = [
  "program_block_id",
  "start_frame",
  "end_frame",
] as const;

/**
 * Hashing 4.5: top-level fields, then the exact nested segment and program-block-offset selections. Redundant derived
 * millisecond/decimal display fields (and any other unselected field) are excluded at every nesting level.
 */
export function masterAssemblyMapProjection(source: unknown): JsonObject {
  const projection = selectKeys(
    source,
    masterAssemblyMapFields,
    "master assembly map",
  );
  projection.segments = asArray(projection.segments, "segments").map(
    (segment) => {
      const selected = selectKeys(
        segment,
        masterAssemblySegmentFields,
        "assembly segment",
      );
      asInteger(selected.start_frame, "start_frame");
      asInteger(selected.end_frame, "end_frame");
      return selected;
    },
  );
  projection.program_block_offsets = asArray(
    projection.program_block_offsets,
    "program_block_offsets",
  ).map((offset) => {
    const selected = selectKeys(
      offset,
      masterAssemblyOffsetFields,
      "program-block offset",
    );
    asInteger(selected.start_frame, "start_frame");
    asInteger(selected.end_frame, "end_frame");
    return selected;
  });
  return projection;
}
export const masterAssemblyMapHash = (source: unknown): string =>
  governedDomainHash(
    "master-assembly-map-v1",
    masterAssemblyMapProjection(source),
  );
/** Hashing v0.1.5 4.4.2 / Writing addendum D.1: the exact required_policy_refs order, addendum included. */
export const ADDENDUM_VERSION_ID = "writing-fixture-profile-addendum-0.1";
export const ADDENDUM_COMPONENT = "writing_fixture_profile_addendum";
export const requiredPolicyRefs = [
  "writing-0.2.3",
  ADDENDUM_VERSION_ID,
  "writing-craft-0.1",
  "claims-0.1.2",
] as const;

export const writerContextManifestHash = (source: unknown): string => {
  const record = asRecord(source, "writer context manifest");
  const refs = asArray(record.required_policy_refs, "required_policy_refs");
  if (!refs.includes(ADDENDUM_VERSION_ID))
    throw new ProfileRejected("addendum_not_in_required_policy_refs");
  if (
    refs.length !== requiredPolicyRefs.length ||
    requiredPolicyRefs.some((ref, index) => refs[index] !== ref)
  )
    throw new ProfileRejected("required_policy_refs_order");
  return hashSelected(
    "writer-context-manifest-v1",
    record,
    writerContextManifestFields,
    "writer context manifest",
  );
};

// ---- Writing 5.1: the nineteen writer-view keys, listed key by key (explicit) ------------------------------------
export const writerViewKeys = [
  "purpose",
  "showrunner_brief_version_id",
  "brief_hash",
  "evidence_package_id",
  "package_hash",
  "show_version",
  "writing_policy_version",
  "writing_craft_policy_version",
  "character_profile_versions",
  "locale",
  "runtime_and_block_budgets",
  "program_block_refs",
  "selected_claims",
  "selected_evidence",
  "context_selections",
  "comprehension_targets",
  "compact_writing_standard",
  "recent_pattern_signals",
  "live_search",
] as const;

/** Writing addendum B / Hashing v0.1.5 4.4.1: the closed nested key lists (writer-view/1). */
export const writerViewClaimKeys = [
  "claim_id",
  "claim_content_hash",
  "frozen_state",
  "frozen_state_hash",
  "kind",
  "subject_domain",
  "subject_ref",
  "predicate",
  "value",
  "value_type",
  "origin",
  "effective_usage_class",
  "attribution_requirement",
  "approved_representation",
  "support_refs",
] as const;
export const writerViewSupportRefKeys = ["ref", "role", "type"] as const;
export const writerViewEvidenceKeys = [
  "evidence_unit_id",
  "content_hash",
  "evidence_type",
  "modality",
  "origin",
  "source_role",
  "locator",
  "authorized_representation",
  "quote_permission",
  "paraphrase_permission",
  "rights_policy_version",
  "consumer_exposure",
] as const;
export const writerViewContextKeys = [
  "context_selection_id",
  "context_id",
  "function",
  "program_block_id",
] as const;

function assertWriterViewNested(selected: JsonObject): void {
  for (const claim of asArray(selected.selected_claims, "selected_claims")) {
    const record = requireProfileKeys(
      claim,
      writerViewClaimKeys,
      "writer_view_claim_keys",
    );
    for (const ref of asArray(record.support_refs, "support_refs"))
      requireProfileKeys(
        ref,
        writerViewSupportRefKeys,
        "writer_view_support_ref_keys",
      );
  }
  for (const evidence of asArray(
    selected.selected_evidence,
    "selected_evidence",
  )) {
    const record = requireProfileKeys(
      evidence,
      writerViewEvidenceKeys,
      "writer_view_evidence_keys",
    );
    // Writer-only exposure: the planner and auditor entries are not writer-facing.
    const exposure = asRecord(record.consumer_exposure, "consumer_exposure");
    if (
      Object.keys(exposure).length !== 1 ||
      !Object.hasOwn(exposure, "writer")
    )
      throw new ProfileRejected("writer_view_non_writer_exposure");
  }
  for (const selection of asArray(
    selected.context_selections,
    "context_selections",
  ))
    requireProfileKeys(
      selection,
      writerViewContextKeys,
      "writer_view_context_keys",
    );
}

export function writerDataObject(view: unknown): JsonObject {
  const selected = selectKeys(view, writerViewKeys, "writer view");
  assertWriterViewNested(selected);
  asArray(selected.comprehension_targets, "comprehension_targets");
  asRecord(selected.recent_pattern_signals, "recent_pattern_signals");
  if (selected.live_search !== false)
    throw new TypeError("live_search must be false in the walking skeleton");
  return selected;
}
export const writerViewHash = (view: unknown): string =>
  governedDomainHash("writer-view-v1", writerDataObject(view));
/** Writing 5.1: raw SHA-256 of UTF8(canonical_json(writer data)); no BOM, whitespace or newline, no domain prefix. */
export const serializedWriterInputHash = (view: unknown): string =>
  rawBytesHash(canonicalBytes(writerDataObject(view)));

// ---- Evidence Package (Evidence 23; Trace 2.A / 9): hash selects `manifest` --------------------------------------
export function evidencePackageHash(artifactPayload: unknown): string {
  return governedDomainHash(
    "evidence-package-v2",
    asRecord(
      asRecord(artifactPayload, "evidence package").manifest,
      "package manifest",
    ),
  );
}

// ---- Showrunner Brief (Showrunner 6 schema + 6.1): selection by name ------------------------------------------------
export const showrunnerBriefFields = [
  "package_hash",
  "show_version",
  "planning_policy_version",
  "selected_mode",
  "rundown_template_version_id",
  "runtime_target",
  "central_question",
  "orientation_job",
  "programming_constraints",
  "selected_beats",
  "program_blocks",
  "context_selections",
  "topic_thread_mappings",
  "feature_selections",
  "continuity_instructions",
  "planning_exclusions",
  "known_gaps",
] as const;

/** Hashing v0.1.5 4.8: optional selected keys and the explicitly excluded persisted keys (purpose included). */
export const showrunnerBriefOptionalFields = [
  "comprehension_targets",
  "revision_parent_content_identity",
] as const;
export const showrunnerBriefExcludedFields = [
  "artifact_id",
  "showrunner_brief_version_id",
  "program_run_id",
  "attempt_id",
  "purpose",
  "evidence_package_id",
  "planner_model_run_id",
  "created_at",
  "revision_parent_id",
  "revision_reason",
  "brief_hash",
] as const;

export function showrunnerBriefProjection(brief: unknown): JsonObject {
  const record = asRecord(brief, "showrunner brief");
  const known: ReadonlySet<string> = new Set<string>([
    ...showrunnerBriefFields,
    ...showrunnerBriefOptionalFields,
    ...showrunnerBriefExcludedFields,
  ]);
  if (Object.keys(record).some((key) => !known.has(key)))
    throw new ProfileRejected("brief_unknown_key");
  if (showrunnerBriefFields.some((key) => !Object.hasOwn(record, key)))
    throw new ProfileRejected("brief_missing_key");
  const selected = selectKeys(
    record,
    showrunnerBriefFields,
    "showrunner brief",
  );
  // `comprehension_targets[]?` is optional launch-format metadata; the parent's content identity only for a child.
  for (const key of showrunnerBriefOptionalFields)
    if (Object.hasOwn(record, key)) selected[key] = record[key];
  return selected;
}
export const showrunnerBriefHash = (brief: unknown): string =>
  governedDomainHash("showrunner-brief-v1", showrunnerBriefProjection(brief));

// ---- Script (Hashing 4.1; Writing 7.1) -------------------------------------------------------------------------------
export type TurnAnchorMap = ReadonlyMap<string, string>;

/** Storage turn UUID -> semantic anchor, resolved from the turn rows of THE SAME script (never a runtime alias). */
export function turnAnchorMap(turns: unknown): Map<string, string> {
  const map = new Map<string, string>();
  const anchors = new Set<string>();
  for (const value of asArray(turns, "turns")) {
    const turn = asRecord(value, "turn");
    const id = asNonBlankString(turn.turn_id, "turn_id");
    const anchor = semanticLabel(turn.semantic_turn_id, "semantic_turn_id");
    if (map.has(id)) throw new ProfileRejected("script_turn_id_not_unique", id);
    if (anchors.has(anchor))
      throw new TypeError(`Duplicate turn anchor: ${anchor}`);
    map.set(id, anchor);
    anchors.add(anchor);
  }
  return map;
}

function resolveAnchor(
  map: TurnAnchorMap,
  turnId: unknown,
  what: string,
): string {
  const anchor = map.get(asString(turnId, `${what}.turn_id`));
  if (anchor === undefined)
    throw new TypeError(`${what} references a turn outside this script`);
  return anchor;
}

/** Hashing v0.1.5 4.1.1 / Writing addendum A: the stored carrier and the emitted item of `prediction-candidate/1`. */
export const predictionCandidateSourceFields = [
  "prediction_candidate_id",
  "turn_id",
  "participant_id",
  "prediction_text",
  "horizon",
  "topic_thread_id",
] as const;
export const predictionCandidateEmittedFields = [
  "prediction_candidate_id",
  "semantic_turn_id",
  "participant_id",
  "prediction_text",
  "horizon",
  "topic_thread_id",
] as const;

export interface ScriptProjectionOptions {
  /** Substitute an independently recomputed frozen-state hash for a claim use (dependency-chain proofs). */
  claimStateHashFor?: (claimId: string) => string;
  /**
   * The bound Showrunner Brief (topic-thread mappings and program-block types). Required, with no default, whenever the
   * script carries prediction candidates: the Brief decides whether and where predictions occur (Writing 16).
   */
  brief?: unknown;
}

/**
 * Hashing v0.1.5 4.1.1. Authored array order is preserved (never re-sorted). Every rejection is a ProfileRejected code.
 * The anchor is derived from this script's own turn rows; a carrier that already contains `semantic_turn_id` is rejected.
 */
export function predictionCandidateProjection(
  candidates: readonly unknown[],
  turns: readonly JsonObject[],
  brief: unknown,
): JsonObject[] {
  const byTurn = new Map(turns.map((turn) => [turn.turn_id, turn]));
  // Labels are compared in their canonical (NFC) spelling; storage UUIDs (turn_id) are never normalized.
  const label = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim().length > 0
      ? semanticLabel(value, "label")
      : undefined;
  const briefRecord = asRecord(brief, "showrunner brief");
  const threads = new Set(
    asArray(briefRecord.topic_thread_mappings, "topic_thread_mappings").map(
      (mapping) =>
        label(asRecord(mapping, "topic thread mapping").topic_thread_id),
    ),
  );
  const blockTypes = new Map(
    asArray(briefRecord.program_blocks, "program_blocks").map((block) => {
      const record = asRecord(block, "program block");
      return [record.program_block_id, record.block_type];
    }),
  );
  const seen = new Set<string>();
  return candidates.map((value) => {
    if (!isRecordValue(value))
      throw new ProfileRejected("prediction_candidate_not_object");
    if (Object.hasOwn(value, "semantic_turn_id"))
      throw new ProfileRejected("prediction_anchor_supplied");
    const keys = Object.keys(value);
    const allowed: readonly string[] = predictionCandidateSourceFields;
    if (keys.some((key) => !allowed.includes(key)))
      throw new ProfileRejected("prediction_unknown_field");
    if (allowed.some((key) => !Object.hasOwn(value, key)))
      throw new ProfileRejected("prediction_missing_field");
    const turn = byTurn.get(value.turn_id);
    if (turn === undefined)
      throw new ProfileRejected("prediction_turn_unresolved");
    const participant = label(value.participant_id);
    if (participant === undefined || participant !== label(turn.participant_id))
      throw new ProfileRejected("prediction_participant_conflict");
    const thread = label(value.topic_thread_id);
    if (thread === undefined || !threads.has(thread))
      throw new ProfileRejected("prediction_topic_thread_unknown");
    if (blockTypes.get(turn.program_block_id) !== "predictions")
      throw new ProfileRejected("prediction_outside_prediction_block");
    if (
      typeof value.prediction_text !== "string" ||
      value.prediction_text.trim().length === 0
    )
      throw new ProfileRejected("prediction_text_invalid");
    const id = semanticLabel(
      value.prediction_candidate_id,
      "prediction_candidate_id",
    );
    if (seen.has(id)) throw new ProfileRejected("prediction_duplicate_id");
    seen.add(id);
    return {
      prediction_candidate_id: id,
      semantic_turn_id: semanticLabel(
        turn.semantic_turn_id,
        "semantic_turn_id",
      ),
      participant_id: participant,
      prediction_text: value.prediction_text,
      horizon: value.horizon,
      topic_thread_id: value.topic_thread_id,
    };
  });
}

function isRecordValue(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function scriptProjection(
  scriptInput: unknown,
  options: ScriptProjectionOptions = {},
): JsonObject {
  const script = asRecord(scriptInput, "script");
  const anchors = turnAnchorMap(script.turns);
  const turnRows = asArray(script.turns, "turns").map((t) =>
    asRecord(t, "turn"),
  );
  const position = new Map(
    turnRows.map((turn) => [
      semanticLabel(turn.semantic_turn_id, "anchor"),
      asInteger(turn.sequence, "sequence"),
    ]),
  );
  if (new Set(position.values()).size !== position.size)
    throw new TypeError("Duplicate turn sequence");
  const ordered = [...turnRows].sort(
    (a, b) =>
      asInteger(a.sequence, "sequence") - asInteger(b.sequence, "sequence"),
  );
  const turns = ordered.map((turn) => {
    const selected = selectKeys(
      turn,
      ["semantic_turn_id", "program_block_id", "participant_id", "spoken_text"],
      "turn",
    );
    selected.semantic_turn_id = semanticLabel(
      turn.semantic_turn_id,
      "semantic_turn_id",
    );
    if (Object.hasOwn(turn, "planning_assignment_ref"))
      selected.planning_assignment_ref = turn.planning_assignment_ref;
    return selected;
  });

  const useOrder = (
    use: JsonObject,
    target: string,
  ): [number, number, number, string, string] => [
    position.get(semanticLabel(use.semantic_turn_id, "anchor")) ?? -1,
    asInteger(use.span_start, "span_start"),
    asInteger(use.span_end, "span_end"),
    asString(use.use_mode, "use_mode"),
    asString(use[target], target),
  ];
  const compareUses = (
    a: [number, number, number, string, string],
    b: [number, number, number, string, string],
  ): number =>
    a[0] - b[0] ||
    a[1] - b[1] ||
    a[2] - b[2] ||
    compareStrings(a[3], b[3]) ||
    compareStrings(a[4], b[4]);
  const rejectDuplicates = (uses: JsonObject[], what: string): void => {
    const seen = new Set<string>();
    for (const use of uses) {
      const key = JSON.stringify(use);
      if (seen.has(key)) throw new TypeError(`Duplicate identical ${what} use`);
      seen.add(key);
    }
  };

  const claimUses = asArray(script.turn_claim_uses, "turn_claim_uses").map(
    (value) => {
      const use = asRecord(value, "claim use");
      const claimId = asNonBlankString(use.claim_id, "claim_id");
      return {
        semantic_turn_id: resolveAnchor(anchors, use.turn_id, "claim use"),
        claim_id: claimId,
        use_mode: use.use_mode,
        span_start: use.span_start,
        span_end: use.span_end,
        claim_state_hash:
          options.claimStateHashFor?.(claimId) ?? use.claim_state_hash,
      };
    },
  );
  claimUses.sort((a, b) =>
    compareUses(useOrder(a, "claim_id"), useOrder(b, "claim_id")),
  );
  rejectDuplicates(claimUses, "claim");
  const evidenceUses = asArray(
    script.turn_evidence_uses,
    "turn_evidence_uses",
  ).map((value) => {
    const use = asRecord(value, "evidence use");
    return {
      semantic_turn_id: resolveAnchor(anchors, use.turn_id, "evidence use"),
      evidence_unit_id: use.evidence_unit_id,
      use_mode: use.use_mode,
      span_start: use.span_start,
      span_end: use.span_end,
      rights_policy_version: use.rights_policy_version,
    };
  });
  evidenceUses.sort((a, b) =>
    compareUses(
      useOrder(a, "evidence_unit_id"),
      useOrder(b, "evidence_unit_id"),
    ),
  );
  rejectDuplicates(evidenceUses, "evidence");

  const candidates = asArray(
    script.prediction_candidates,
    "prediction_candidates",
  );
  if (candidates.length > 0 && options.brief === undefined)
    throw new TypeError(
      "A script with prediction candidates is projected against its bound Brief: pass options.brief",
    );
  const predictions =
    candidates.length === 0
      ? []
      : predictionCandidateProjection(candidates, turnRows, options.brief);

  const projection: JsonObject = {
    brief_hash: script.brief_hash,
    package_hash: script.package_hash,
    writing_policy_version: script.writing_policy_version,
    program_block_refs: asArray(
      script.program_block_refs,
      "program_block_refs",
    ),
    turns,
    turn_claim_uses: claimUses,
    turn_evidence_uses: evidenceUses,
    prediction_candidates: predictions,
  };
  if (
    script.revision_parent_content_identity !== undefined &&
    script.revision_parent_content_identity !== null
  )
    projection.revision_parent_content_identity =
      script.revision_parent_content_identity;
  for (const key of ["brief_hash", "package_hash", "writing_policy_version"])
    asNonBlankString(projection[key], key);
  return projection;
}
export const scriptHash = (
  script: unknown,
  options?: ScriptProjectionOptions,
): string => governedDomainHash("script-v2", scriptProjection(script, options));

// ---- Writing Craft review (Hashing 4.2) ---------------------------------------------------------------------------------
const findingFields = [
  "type",
  "severity",
  "span_refs",
  "observation",
  "consequence",
  "revision_instruction",
  "prohibited_shortcut",
] as const;

export function writingCraftReviewProjection(
  reviewInput: unknown,
  subjectAnchors: TurnAnchorMap,
): JsonObject {
  const review = selectKeys(
    reviewInput,
    [
      "subject_script_hash",
      "craft_policy_version",
      "critic_contract_version",
      "findings",
      "outcome",
    ],
    "writing craft review",
  );
  review.findings = asArray(review.findings, "findings").map((value) => {
    const finding = asRecord(value, "finding");
    const unknown = Object.keys(finding).filter(
      (key) =>
        key !== "finding_id" &&
        !(findingFields as readonly string[]).includes(key),
    );
    if (unknown.length > 0)
      throw new TypeError(
        `Unknown craft finding fields: ${unknown.join(", ")}`,
      );
    const selected = selectKeys(finding, findingFields, "finding");
    selected.span_refs = asArray(selected.span_refs, "span_refs").map((ref) => {
      const span = asRecord(ref, "span ref");
      const out: JsonObject = {};
      for (const [key, field] of Object.entries(span))
        if (key !== "turn_id") out[key] = field;
      out.semantic_turn_id = resolveAnchor(
        subjectAnchors,
        span.turn_id,
        "finding span",
      );
      return out;
    });
    return selected;
  });
  return review;
}
export const writingCraftReviewHash = (
  review: unknown,
  subjectAnchors: TurnAnchorMap,
): string =>
  governedDomainHash(
    "writing-craft-review-v1",
    writingCraftReviewProjection(review, subjectAnchors),
  );

// ---- Performance Direction (Hashing 4.2.1) -------------------------------------------------------------------------------
const intentFields = [
  "scope_type",
  "scope_ref",
  "intent_type",
  "value",
  "strength",
  "timing_anchor",
] as const;

export function performanceDirectionProjection(
  directionInput: unknown,
  boundScriptAnchors: TurnAnchorMap,
): JsonObject {
  const direction = selectKeys(
    directionInput,
    ["script_hash", "direction_spec_version", "performance_intents"],
    "performance direction",
  );
  direction.performance_intents = asArray(
    direction.performance_intents,
    "performance_intents",
  ).map((value) => {
    const intent = selectKeys(value, intentFields, "performance intent");
    if (intent.scope_type === "turn")
      intent.scope_ref = resolveAnchor(
        boundScriptAnchors,
        intent.scope_ref,
        "intent scope",
      );
    if (intent.timing_anchor !== null)
      intent.timing_anchor = resolveAnchor(
        boundScriptAnchors,
        intent.timing_anchor,
        "intent timing",
      );
    return intent;
  });
  return direction;
}
export const performanceDirectionHash = (
  direction: unknown,
  anchors: TurnAnchorMap,
): string =>
  governedDomainHash(
    "performance-direction-v1",
    performanceDirectionProjection(direction, anchors),
  );

// ---- Render Manifest (Hashing 4.3) -------------------------------------------------------------------------------------------
export const renderBlockPlanFields = [
  "program_block_id",
  "ordered_turn_ids",
  "speaker_map",
  "provider",
  "context_recipe_version",
  "resolved_context_refs",
  "applied_performance_intent_ids",
  "applied_pronunciation_rendering_ids",
  "named_text_transform_versions",
  "base_request_hash",
] as const;
export const renderManifestFields = [
  "script_hash",
  "performance_direction_hash",
  "audit_gate_fingerprint",
  "render_spec_version",
  "adapter_contract_version",
  "provider_capability_version",
  "show_render_config_version",
] as const;

export function renderManifestProjection(manifest: unknown): JsonObject {
  const record = asRecord(manifest, "render manifest");
  const projection = selectKeys(
    record,
    renderManifestFields,
    "render manifest",
  );
  projection.render_blocks = asArray(record.render_blocks, "render_blocks").map(
    (block) => selectKeys(block, renderBlockPlanFields, "render block plan"),
  );
  return projection;
}
export const renderManifestHash = (manifest: unknown): string =>
  governedDomainHash("render-manifest-v1", renderManifestProjection(manifest));

// Complete fixed schemas for the three evaluation-only artifacts; not a runtime registry.
const FIXTURE105_SCHEMAS: Record<
  "construction" | "operation" | "audit",
  Record<string, unknown>
> = {
  construction: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: [
      "schema",
      "record_kind",
      "subject",
      "release_sha256",
      "observed_rows",
      "observed_rows_sha256",
      "ceilings",
      "phase_order",
      "construction_receipt_id",
      "historical_visibility_limit",
      "claim",
    ],
    properties: {
      schema: {
        const: "fixture105-construction-observation/1",
      },
      record_kind: {
        const: "actual_owner_observation",
      },
      subject: {
        type: "object",
        additionalProperties: false,
        required: [
          "profile",
          "purpose",
          "environment",
          "program_run_id",
          "attempt_id",
          "show_config_hash",
          "package_hash",
          "brief_hash",
          "substantive_script_hash",
          "final_script_hash",
          "gate_set_version",
          "program_run_authored_at",
          "show_id",
          "show_version",
          "show_config_version_id",
          "package_id",
          "brief_version_id",
          "substantive_script_version_id",
          "final_script_version_id",
          "claims_policy_version",
          "writing_policy_version",
          "performance_policy_version",
        ],
        properties: {
          profile: {
            const: "connected-evaluation-fixture105/1",
          },
          purpose: {
            const: "evaluation",
          },
          environment: {
            const: "test",
          },
          program_run_id: {
            const: "23e3766c-7d71-5c0a-801f-e06d50884988",
          },
          attempt_id: {
            const: "9ed84f2d-5081-5869-8800-bd53c75fa71d",
          },
          show_config_hash: {
            const:
              "18eec4ddf5be87cbfd6317bc067f152ec400394eda18454d9bbd9bd22a76ff2d",
          },
          package_hash: {
            const:
              "c60a91ac6383a791011f533d4b4d2dfd428b3dbe9e15b5113f4cd60ea03c539e",
          },
          brief_hash: {
            const:
              "e49eb2ff86990cd5a439c68b236f99ba34f1294be02c568b635091f5b0f11a71",
          },
          substantive_script_hash: {
            const:
              "ced37e3db0c2511d4f1cfb8d913f66e223cd103adf9087ae809b30511de7a116",
          },
          final_script_hash: {
            const:
              "699c4837646679b9470d272ecdd07590449dec21a4c6e708ddfdd792a01dcb6c",
          },
          gate_set_version: {
            const: "build2-connected-fixture105-gates/1",
          },
          program_run_authored_at: {
            const: "2024-06-26T18:00:00Z",
          },
          show_id: {
            const: "7ef80c54-5645-5925-a5f1-d8b5b7ad2a30",
          },
          show_version: {
            const: "estuary-fixture109/1",
          },
          show_config_version_id: {
            const: "9e1252b5-f582-5aab-ad2a-e067fa571b04",
          },
          package_id: {
            const: "cca1c334-d3aa-509d-bbfb-f43f7bb8d645",
          },
          brief_version_id: {
            const: "a4979777-ea0e-5fba-88c2-c9e732acab50",
          },
          substantive_script_version_id: {
            const: "5120be00-4908-5e55-8ea5-d28aab5947bf",
          },
          final_script_version_id: {
            const: "ca1c091b-4ee5-59fb-9547-2b92eb3938ad",
          },
          claims_policy_version: {
            const: "claims-0.1.2",
          },
          writing_policy_version: {
            const: "writing-0.2.3",
          },
          performance_policy_version: {
            const: "performance-render-0.1.4",
          },
        },
      },
      release_sha256: {
        type: "string",
        pattern: "^[0-9a-f]{64}$",
      },
      observed_rows: {
        type: "array",
        minItems: 1,
        maxItems: 128,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["table", "primary_key", "canonical_row", "row_sha256"],
          properties: {
            table: {
              enum: [
                "claims",
                "claim_state_events",
                "rights_versions",
                "claim_supports",
                "evidence_units",
                "derivation_runs",
                "evidence_packages",
                "artifacts",
              ],
            },
            primary_key: {
              type: "string",
              format: "uuid",
            },
            canonical_row: {
              type: "string",
              minLength: 1,
            },
            row_sha256: {
              type: "string",
              pattern: "^[0-9a-f]{64}$",
            },
          },
        },
      },
      observed_rows_sha256: {
        type: "string",
        pattern: "^[0-9a-f]{64}$",
      },
      ceilings: {
        const: [
          {
            claim_id: "a50f7424-47ba-559a-a0de-f011fe3784b1",
            frozen_ceiling: "assertable",
            current_ceiling: "assertable",
            rights_version_id: "0e7f75a6-e7f2-5414-8e6a-b35e9ded3444",
            basis:
              "fixture109 source-specific admitted usage; no inferred general rights-to-status mapping",
          },
          {
            claim_id: "9d40e3c5-e145-5bc1-ad1c-55ce09dd66c7",
            frozen_ceiling: "assertable",
            current_ceiling: "assertable",
            rights_version_id: "0e7f75a6-e7f2-5414-8e6a-b35e9ded3444",
            basis:
              "fixture109 source-specific admitted usage; no inferred general rights-to-status mapping",
          },
          {
            claim_id: "6cd06f82-a9ad-5e46-8e52-b16e7d44b998",
            frozen_ceiling: "hedged_only",
            current_ceiling: "hedged_only",
            rights_version_id: "0e7f75a6-e7f2-5414-8e6a-b35e9ded3444",
            basis:
              "fixture109 source-specific admitted usage; no inferred general rights-to-status mapping",
          },
          {
            claim_id: "acf27cee-53eb-5fbd-a67b-114f94ca795d",
            frozen_ceiling: "assertable",
            current_ceiling: "assertable",
            rights_version_id: "0e7f75a6-e7f2-5414-8e6a-b35e9ded3444",
            basis:
              "fixture109 source-specific admitted usage; no inferred general rights-to-status mapping",
          },
          {
            claim_id: "13280589-4ad9-5109-9f1f-d7d4d6079116",
            frozen_ceiling: "assertable",
            current_ceiling: "assertable",
            rights_version_id: "0e7f75a6-e7f2-5414-8e6a-b35e9ded3444",
            basis:
              "fixture109 source-specific admitted usage; no inferred general rights-to-status mapping",
          },
          {
            claim_id: "0ee3cc88-74c6-5815-8b18-b86772fee142",
            frozen_ceiling: "assertable",
            current_ceiling: "assertable",
            rights_version_id: "0e7f75a6-e7f2-5414-8e6a-b35e9ded3444",
            basis:
              "fixture109 source-specific admitted usage; no inferred general rights-to-status mapping",
          },
          {
            claim_id: "af00a068-d5ba-52e7-83bf-ebb583588b42",
            frozen_ceiling: "assertable",
            current_ceiling: "assertable",
            rights_version_id: "0e7f75a6-e7f2-5414-8e6a-b35e9ded3444",
            basis:
              "fixture109 source-specific admitted usage; no inferred general rights-to-status mapping",
          },
          {
            claim_id: "a5807836-8468-5b76-9467-4785cdf3b6c0",
            frozen_ceiling: "assertable",
            current_ceiling: "assertable",
            rights_version_id: "0e7f75a6-e7f2-5414-8e6a-b35e9ded3444",
            basis:
              "fixture109 source-specific admitted usage; no inferred general rights-to-status mapping",
          },
          {
            claim_id: "46050fc9-ec1b-5e5f-9346-2be287d6a5cc",
            frozen_ceiling: "silent",
            current_ceiling: "silent",
            rights_version_id: "0e7f75a6-e7f2-5414-8e6a-b35e9ded3444",
            basis:
              "fixture109 source-specific admitted usage; no inferred general rights-to-status mapping",
          },
        ],
      },
      phase_order: {
        const: ["absence", "insert", "capture", "freeze", "persist", "compare"],
      },
      construction_receipt_id: {
        type: "string",
        minLength: 1,
      },
      historical_visibility_limit: {
        const: "historical_visibility_unprovable",
      },
      claim: {
        const: "closed_fixture_construction_only",
      },
    },
    $comment:
      "Mandatory semantic validation: INNER-DIGEST-RULES.md, SQL-COLUMN-MAP.json and RESULT-DIGEST-MAP.json. JSON Schema validation alone cannot admit an artifact or prove linked digests.",
  },
  operation: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: [
      "schema",
      "record_kind",
      "subject",
      "release_sha256",
      "construction_observation_sha256",
      "actual_claims_writing_result_sha256",
      "actual_performance_result_sha256",
      "performance_direction_hash",
      "genuine_semantic_admission",
      "required_semantic_status",
      "owned_rows",
      "operation_id",
    ],
    properties: {
      schema: {
        const: "fixture105-operation/1",
      },
      record_kind: {
        const: "actual_owned_operation",
      },
      subject: {
        type: "object",
        additionalProperties: false,
        required: [
          "profile",
          "purpose",
          "environment",
          "program_run_id",
          "attempt_id",
          "show_config_hash",
          "package_hash",
          "brief_hash",
          "substantive_script_hash",
          "final_script_hash",
          "gate_set_version",
          "program_run_authored_at",
          "show_id",
          "show_version",
          "show_config_version_id",
          "package_id",
          "brief_version_id",
          "substantive_script_version_id",
          "final_script_version_id",
          "claims_policy_version",
          "writing_policy_version",
          "performance_policy_version",
        ],
        properties: {
          profile: {
            const: "connected-evaluation-fixture105/1",
          },
          purpose: {
            const: "evaluation",
          },
          environment: {
            const: "test",
          },
          program_run_id: {
            const: "23e3766c-7d71-5c0a-801f-e06d50884988",
          },
          attempt_id: {
            const: "9ed84f2d-5081-5869-8800-bd53c75fa71d",
          },
          show_config_hash: {
            const:
              "18eec4ddf5be87cbfd6317bc067f152ec400394eda18454d9bbd9bd22a76ff2d",
          },
          package_hash: {
            const:
              "c60a91ac6383a791011f533d4b4d2dfd428b3dbe9e15b5113f4cd60ea03c539e",
          },
          brief_hash: {
            const:
              "e49eb2ff86990cd5a439c68b236f99ba34f1294be02c568b635091f5b0f11a71",
          },
          substantive_script_hash: {
            const:
              "ced37e3db0c2511d4f1cfb8d913f66e223cd103adf9087ae809b30511de7a116",
          },
          final_script_hash: {
            const:
              "699c4837646679b9470d272ecdd07590449dec21a4c6e708ddfdd792a01dcb6c",
          },
          gate_set_version: {
            const: "build2-connected-fixture105-gates/1",
          },
          program_run_authored_at: {
            const: "2024-06-26T18:00:00Z",
          },
          show_id: {
            const: "7ef80c54-5645-5925-a5f1-d8b5b7ad2a30",
          },
          show_version: {
            const: "estuary-fixture109/1",
          },
          show_config_version_id: {
            const: "9e1252b5-f582-5aab-ad2a-e067fa571b04",
          },
          package_id: {
            const: "cca1c334-d3aa-509d-bbfb-f43f7bb8d645",
          },
          brief_version_id: {
            const: "a4979777-ea0e-5fba-88c2-c9e732acab50",
          },
          substantive_script_version_id: {
            const: "5120be00-4908-5e55-8ea5-d28aab5947bf",
          },
          final_script_version_id: {
            const: "ca1c091b-4ee5-59fb-9547-2b92eb3938ad",
          },
          claims_policy_version: {
            const: "claims-0.1.2",
          },
          writing_policy_version: {
            const: "writing-0.2.3",
          },
          performance_policy_version: {
            const: "performance-render-0.1.4",
          },
        },
      },
      release_sha256: {
        type: "string",
        pattern: "^[0-9a-f]{64}$",
      },
      construction_observation_sha256: {
        type: "string",
        pattern: "^[0-9a-f]{64}$",
      },
      actual_claims_writing_result_sha256: {
        type: "string",
        pattern: "^[0-9a-f]{64}$",
      },
      actual_performance_result_sha256: {
        type: "string",
        pattern: "^[0-9a-f]{64}$",
      },
      performance_direction_hash: {
        const:
          "edd94e00ec1e07bbe0a2efde4c3ca67f39e5f25835f83aed2b29df09eaa5ee2e",
      },
      genuine_semantic_admission: {
        const: false,
      },
      required_semantic_status: {
        const: {
          H04: "not_established_required",
          H13: "not_established_required",
        },
      },
      owned_rows: {
        type: "array",
        minItems: 1,
        maxItems: 32,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["table", "primary_key", "canonical_row", "row_sha256"],
          properties: {
            table: {
              enum: [
                "artifacts",
                "performance_direction_versions",
                "performance_intents",
                "gate_results",
              ],
            },
            primary_key: {
              type: "string",
              format: "uuid",
            },
            canonical_row: {
              type: "string",
              minLength: 1,
            },
            row_sha256: {
              type: "string",
              pattern: "^[0-9a-f]{64}$",
            },
          },
        },
      },
      operation_id: {
        type: "string",
        pattern: "^[0-9a-f]{64}$",
      },
    },
    $comment:
      "Mandatory semantic validation: INNER-DIGEST-RULES.md, SQL-COLUMN-MAP.json and RESULT-DIGEST-MAP.json. JSON Schema validation alone cannot admit an artifact or prove linked digests.",
  },
  audit: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: [
      "schema",
      "kind",
      "version",
      "input_projection",
      "input_fingerprint",
      "operation_sha256",
      "interface_conformance",
      "semantic_acceptance",
      "model_run_id",
      "render_allowed",
    ],
    properties: {
      schema: {
        const: "connected-fixture105-audit-stub/1",
      },
      kind: {
        const: "fixture_stub",
      },
      version: {
        const: "connected-fixture105-audit-stub/1",
      },
      input_projection: {
        type: "object",
        additionalProperties: false,
        required: [
          "package_hash",
          "brief_hash",
          "script_hash",
          "performance_direction_hash",
          "claims_policy_version",
          "writing_policy_version",
          "performance_policy_version",
          "auditor_contract_version",
        ],
        properties: {
          package_hash: {
            const:
              "c60a91ac6383a791011f533d4b4d2dfd428b3dbe9e15b5113f4cd60ea03c539e",
          },
          brief_hash: {
            const:
              "e49eb2ff86990cd5a439c68b236f99ba34f1294be02c568b635091f5b0f11a71",
          },
          script_hash: {
            const:
              "699c4837646679b9470d272ecdd07590449dec21a4c6e708ddfdd792a01dcb6c",
          },
          performance_direction_hash: {
            const:
              "edd94e00ec1e07bbe0a2efde4c3ca67f39e5f25835f83aed2b29df09eaa5ee2e",
          },
          claims_policy_version: {
            const: "claims-0.1.2",
          },
          writing_policy_version: {
            const: "writing-0.2.3",
          },
          performance_policy_version: {
            const: "performance-render-0.1.4",
          },
          auditor_contract_version: {
            const: "connected-fixture105-audit-stub/1",
          },
        },
      },
      input_fingerprint: {
        type: "string",
        pattern: "^[0-9a-f]{64}$",
      },
      operation_sha256: {
        type: "string",
        pattern: "^[0-9a-f]{64}$",
      },
      interface_conformance: {
        const: "complete",
      },
      semantic_acceptance: {
        const: "not_established",
      },
      model_run_id: {
        type: "null",
      },
      render_allowed: {
        const: false,
      },
    },
    $comment:
      "Mandatory semantic validation: INNER-DIGEST-RULES.md, SQL-COLUMN-MAP.json and RESULT-DIGEST-MAP.json. JSON Schema validation alone cannot admit an artifact or prove linked digests.",
  },
};

const FIXTURE105_PK: Readonly<Record<string, string>> = {
  claims: "claim_id",
  claim_state_events: "claim_state_event_id",
  rights_versions: "rights_version_id",
  claim_supports: "claim_support_id",
  evidence_units: "evidence_unit_id",
  derivation_runs: "derivation_run_id",
  evidence_packages: "evidence_package_id",
  artifacts: "artifact_id",
  performance_direction_versions: "performance_direction_version_id",
  performance_intents: "performance_intent_id",
  gate_results: "gate_result_id",
};
function fixture105Invalid(): never {
  throw new TypeError("Fixed fixture artifact invalid");
}
// Private recursion over the three embedded, reviewed closed schemas only. No caller schema.
function fixture105Shape(
  value: unknown,
  schema: Record<string, unknown>,
): void {
  if (Object.hasOwn(schema, "const")) {
    if (canonicalJson(value) !== canonicalJson(schema.const))
      fixture105Invalid();
    return;
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value))
    fixture105Invalid();
  if (schema.type === "null") {
    if (value !== null) fixture105Invalid();
    return;
  }
  if (schema.type === "object") {
    const record = asRecord(value, "fixed fixture");
    const properties = asRecord(schema.properties, "fixed fixture properties");
    const required = asArray(schema.required, "fixed fixture keys");
    if (
      Object.keys(record).length !== required.length ||
      required.some(
        (key) => typeof key !== "string" || !Object.hasOwn(record, key),
      )
    )
      fixture105Invalid();
    for (const [key, item] of Object.entries(record)) {
      if (!Object.hasOwn(properties, key)) fixture105Invalid();
      fixture105Shape(item, asRecord(properties[key], "fixed fixture field"));
    }
    return;
  }
  if (schema.type === "array") {
    const list = asArray(value, "fixed fixture array");
    if (
      (typeof schema.minItems === "number" && list.length < schema.minItems) ||
      (typeof schema.maxItems === "number" && list.length > schema.maxItems)
    )
      fixture105Invalid();
    for (const item of list)
      fixture105Shape(item, asRecord(schema.items, "fixed fixture item"));
    return;
  }
  if (schema.type === "string") {
    if (typeof value !== "string" || value.normalize("NFC") !== value)
      fixture105Invalid();
    if (
      typeof schema.minLength === "number" &&
      Array.from(value).length < schema.minLength
    )
      fixture105Invalid();
    if (
      typeof schema.pattern === "string" &&
      !new RegExp(schema.pattern, "u").test(value)
    )
      fixture105Invalid();
    if (
      schema.format === "uuid" &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(
        value,
      )
    )
      fixture105Invalid();
    return;
  }
  if (schema.type === undefined && Array.isArray(schema.enum)) return;
  fixture105Invalid();
}
function fixture105Rows(value: unknown, order: readonly string[]): void {
  const rows = asArray(value, "fixed fixture rows");
  let previous = -1;
  let previousId = "";
  for (const item of rows) {
    const row = asRecord(item, "fixed fixture row");
    const table = asString(row.table, "table");
    const id = asString(row.primary_key, "primary key");
    const rank = order.indexOf(table);
    if (rank < 0 || rank < previous || (rank === previous && id <= previousId))
      fixture105Invalid();
    previous = rank;
    previousId = id;
    const raw = asString(row.canonical_row, "canonical row");
    let decoded: unknown;
    try {
      decoded = JSON.parse(raw) as unknown;
    } catch {
      fixture105Invalid();
    }
    const data = asRecord(decoded, "decoded row");
    const key = FIXTURE105_PK[table];
    if (
      key === undefined ||
      data[key] !== id ||
      canonicalJson(data) !== raw ||
      sha256(Buffer.from(raw, "utf8")) !== row.row_sha256
    )
      fixture105Invalid();
  }
}
/** Separate semantic operation identity. This is not the full operation artifact hash. */
export function connectedFixture105OperationId(value: unknown): string {
  const operation = asRecord(value, "fixed operation");
  return connectedFixture105DomainHash(
    "fixture105-operation-identity-v1",
    selectKeys(
      operation,
      [
        "subject",
        "release_sha256",
        "construction_observation_sha256",
        "actual_claims_writing_result_sha256",
        "performance_direction_hash",
      ],
      "fixed operation identity",
    ),
  );
}
/** Hashes typed data, not proof of acquisition, SQL population equality or settlement. */
export function connectedFixture105ArtifactHash(
  kind: "construction" | "operation" | "audit",
  value: unknown,
): string {
  const schema = FIXTURE105_SCHEMAS[kind];
  if (!Object.hasOwn(FIXTURE105_SCHEMAS, kind)) fixture105Invalid();
  fixture105Shape(value, schema);
  const record = asRecord(value, "fixed fixture artifact");
  if (kind === "construction") {
    fixture105Rows(record.observed_rows, [
      "claims",
      "claim_state_events",
      "rights_versions",
      "claim_supports",
      "evidence_units",
      "derivation_runs",
      "evidence_packages",
      "artifacts",
    ]);
    if (
      sha256(Buffer.from(canonicalJson(record.observed_rows), "utf8")) !==
      record.observed_rows_sha256
    )
      fixture105Invalid();
    return connectedFixture105DomainHash(
      "fixture105-construction-observation-v1",
      record,
    );
  }
  if (kind === "operation") {
    fixture105Rows(record.owned_rows, [
      "artifacts",
      "performance_direction_versions",
      "performance_intents",
      "gate_results",
    ]);
    if (record.operation_id !== connectedFixture105OperationId(record))
      fixture105Invalid();
    return connectedFixture105DomainHash("fixture105-operation-v1", record);
  }
  if (
    governedDomainHash("audit-input-v1", record.input_projection) !==
    record.input_fingerprint
  )
    fixture105Invalid();
  return connectedFixture105DomainHash(
    "connected-fixture105-audit-stub-v1",
    record,
  );
}
