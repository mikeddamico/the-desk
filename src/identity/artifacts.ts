// Artifact projections and content hashes (Hashing v0.1.5 sections 3-4, 12.4; Writing v0.2.3 5.1 and 7.1 with the
// Writing Build 1-2 Fixture-Profile Addendum v0.1;
// Showrunner Planning v0.1.3 6.1; Performance & Render v0.1.4 manifest hash; Evidence Package v0.2.2 semantic manifest).
// Each projection SELECTS the governed fields from an authoritative object; none serializes a persistence row.
// Owning authority and status for every selection: docs/identity-projection-authority.md. Pure; no I/O.
import { canonicalBytes, canonicalTimestamp } from "./canonical-json.js";
import { governedDomainHash, rawBytesHash } from "./domains.js";
import {
  asArray,
  asInteger,
  asNonBlankString,
  asRecord,
  asString,
  compareStrings,
  selectKeys,
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
    const anchor = asNonBlankString(turn.semantic_turn_id, "semantic_turn_id");
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
  const briefRecord = asRecord(brief, "showrunner brief");
  const threads = new Set(
    asArray(briefRecord.topic_thread_mappings, "topic_thread_mappings").map(
      (mapping) => asRecord(mapping, "topic thread mapping").topic_thread_id,
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
    if (value.participant_id !== turn.participant_id)
      throw new ProfileRejected("prediction_participant_conflict");
    if (!threads.has(value.topic_thread_id))
      throw new ProfileRejected("prediction_topic_thread_unknown");
    if (blockTypes.get(turn.program_block_id) !== "predictions")
      throw new ProfileRejected("prediction_outside_prediction_block");
    if (
      typeof value.prediction_text !== "string" ||
      value.prediction_text.trim().length === 0
    )
      throw new ProfileRejected("prediction_text_invalid");
    const id = asString(
      value.prediction_candidate_id,
      "prediction_candidate_id",
    );
    if (seen.has(id)) throw new ProfileRejected("prediction_duplicate_id");
    seen.add(id);
    return {
      prediction_candidate_id: value.prediction_candidate_id,
      semantic_turn_id: turn.semantic_turn_id,
      participant_id: value.participant_id,
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
      asString(turn.semantic_turn_id, "anchor"),
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
    if (Object.hasOwn(turn, "planning_assignment_ref"))
      selected.planning_assignment_ref = turn.planning_assignment_ref;
    return selected;
  });

  const useOrder = (
    use: JsonObject,
    target: string,
  ): [number, number, number, string, string] => [
    position.get(asString(use.semantic_turn_id, "anchor")) ?? -1,
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
