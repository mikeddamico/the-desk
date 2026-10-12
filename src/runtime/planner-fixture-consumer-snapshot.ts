// PC1/05: unwired, supplied-snapshot inspection. No execution/current-use authority.
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { canonicalJson, domainHash } from "../identity/canonical-json.js";
import { evidenceBodyHash } from "../identity/domains.js";
import {
  claimContentHash,
  claimFrozenStateHash,
  derivationOutputHash,
  fixtureSupportObjectHash,
} from "../identity/knowledge.js";
import { isJsonObject, Rejection, type Json } from "./command.js";
import { parsePayload } from "./package-profile.js";

export const PROFILE = "planner-fixture-consumer-snapshot/1";

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
type ParserCode = (typeof parserCodes)[number];
export type PlannerFixtureConsumerError =
  | "input_type_invalid"
  | "input_text_empty"
  | "input_resource_limit"
  | "input_unicode_invalid"
  | "input_json_invalid"
  | "input_semantic_json_invalid"
  | "input_text_noncanonical"
  | "input_envelope_invalid"
  | "parser_rejected"
  | "profile_shape_invalid"
  | "profile_value_invalid"
  | "profile_version_unsupported"
  | "profile_resource_limit"
  | "profile_duplicate"
  | "profile_material_set_mismatch"
  | "profile_binding_mismatch"
  | "profile_usage_unsupported"
  | "profile_exposure_unsupported"
  | "profile_support_unsupported"
  | "profile_support_unresolved"
  | "profile_support_hash_mismatch"
  | "profile_quote_mismatch"
  | "profile_calculation_mismatch";
export interface PlannerFixtureConsumerRejection {
  readonly kind: "rejected";
  readonly profile: typeof PROFILE;
  readonly code: PlannerFixtureConsumerError;
  readonly field: string;
  readonly parser_code: ParserCode | null;
}

// Complete 82-record accepted grammar, mechanically transcribed from the three pinned record parts.
// s/u/h/i/b/n = bounded NFC string/UUID/SHA256/nonnegative safe integer/boolean/null.
// Brackets are <=256 arrays; | preserves the declared alternative order.
const shapes: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  R053276b9de0c: {
    claim_id: "u",
    context_id: "s",
    functions: "[s]",
    reason: "s",
  },
  R060aaa535f89: {
    acquisition_permission: "b",
    attribution: "R2f9123d4b9a1",
    consumer_exposure_ceiling: "R0b9bb25115de",
    covered_source_identities: "[s]",
    grant_identity: "s",
    grantor: "s",
    paraphrase_permission: "b",
    provider_exposure: "R38a8f11c41ea",
    quotation_permission: "b",
    retention: "Rb15b8faf4bb9",
    synthetic_grant: "b",
  },
  R0b9bb25115de: {
    auditor: "[s]",
    planner: "[s]",
    writer: "[s]",
  },
  R0eae16aca4ec: {
    acquisition_ref: "s",
    as_of: "s",
    competition_identity: "s",
    consumer_exposure: "R67d7dcf9ddc3",
    content_hash: "h",
    entity_identity: "s",
    event_identity: "s",
    evidence_type: "s",
    evidence_unit_id: "u",
    language: "s",
    locator: "R283a0c91d671",
    modality: "s",
    origin: "s",
    paraphrase_permission: "b",
    quote_permission: "b",
    retention_class: "s",
    retention_declaration: "Rb15b8faf4bb9",
    rights_policy_version: "u",
    rights_version_id: "u",
    source_identity: "s",
    source_item_identity: "s",
    source_modality: "s",
    source_role: "s",
    speaker_identity: "n",
  },
  R10cc5d6a9fa2: {
    evidence_unit_id: "u",
    member: "s",
  },
  R1966ac6c1517: {
    northbridge_goals: "i",
    southbank_goals: "i",
  },
  R1b22b8919a93: {
    asserted_at: "s",
    claim_id: "u",
    claim_kind: "s",
    content_hash: "h",
    created_at: "s",
    initial_status: "s",
    initial_usage_class: "s",
    origin: "s",
    predicate: "s",
    subject: "Rc7b482f32a13",
    subject_domain: "s",
    supersedes_claim_id: "n",
    value: "R69b43b64997e",
  },
  R1ba095706d4c: {
    availability: "R6429e700b661",
    beats: "[Rc6af9486bddb]",
    claims:
      "[R3a1073f7e11c|R5681a0133ba0|R60541b5f0a90|R66a7cbc03bde|R734ba770849b|Raba0677f9ff8|Rb0847f121459|Rc1826cfae0eb]",
    context_candidates: "[R053276b9de0c]",
    continuity: "[R4c322a66fb56]",
    coverage_conditions: "[Rf089e3c10e94]",
    evidence:
      "[R0eae16aca4ec|R60958cf6e219|R6a46faa77fff|R72719a477070|R8bbd99f04000|R9b2474a6db6f]",
    schema: "s",
    scope: "R206018f919aa",
    selection_provenance: "Rd10605cda18a",
    sensitivities: "[Rd5da2454ca3a]",
    signals: "[R9456ebf86aca|R94f48bcd9c6a]",
    silent_inputs: "[R3f4585139a10]",
    source_attribution: "[R37cfb3bbb0e1]",
    version_refs: "Rc4725114b6be",
  },
  R206018f919aa: {
    competition_ids: "[s]",
    entity_ids: "[s]",
    event_ids: "[s]",
    locale: "s",
    scheduled_default_mode: "s",
    scope_type: "s",
    show_id: "u",
    target_publication_slot_ref: "s",
  },
  R23d1d2b989bb: {
    competition_identity: "s",
    completed_at: "s",
    completion_status: "s",
    event_identity: "s",
    participant_entities: "[s]",
  },
  R242901e4d295: {
    interpretation: "s",
  },
  R283a0c91d671: {
    body_codepoint_end: "i",
    body_codepoint_start: "i",
    evidence_unit_id: "u",
    kind: "s",
    member: "s",
  },
  R2e6e421cc770: {
    claim_support_id: "u",
    derivation_run_id: "n",
    evidence_unit_id: "n",
    external_support_identity: "s",
    support_hash: "h",
    support_kind: "s",
    support_role: "s",
  },
  R2f9123d4b9a1: {
    exact_source_credit_refs: "[s]",
    required_for_spoken_reporting: "b",
    supporter_identity_minimization: "b",
  },
  R37cfb3bbb0e1: {
    display_name: "s",
    source_id: "s",
    source_role: "s",
  },
  R38a8f11c41ea: {
    external_providers: "b",
    fixture_stub: "s",
    fixture_tts: "s",
  },
  R3a1073f7e11c: {
    approved_representation: "s",
    attribution_requirement: "Rb03973092230",
    claim_content_hash: "h",
    claim_id: "u",
    effective_usage_class: "s",
    frozen_state: "s",
    frozen_state_hash: "h",
    initial_status: "s",
    initial_usage_class: "s",
    kind: "s",
    origin: "s",
    predicate: "s",
    reduced_usage_class: "s",
    state_event_cursor: "n",
    subject_domain: "s",
    subject_ref: "s",
    support_refs: "[Rb1ccb8b4ed76]",
    value: "R69b43b64997e",
    value_type: "s",
  },
  R3eeacc0d6cd4: {
    content_hash: "h",
    evidence_unit_id: "u",
    observation_order: "i",
    scoped_description_ref: "R10cc5d6a9fa2",
    source_identity: "s",
  },
  R3f4585139a10: {
    allowed_consumers: "[s]",
    claim_id: "u",
    effective_usage_class: "s",
    purpose: "s",
    support_refs: "[u]",
  },
  R42db71461a0c: {
    asserted_at: "s",
    claim_id: "u",
    claim_kind: "s",
    content_hash: "h",
    created_at: "s",
    initial_status: "s",
    initial_usage_class: "s",
    origin: "s",
    predicate: "s",
    subject: "Rc7b482f32a13",
    subject_domain: "s",
    supersedes_claim_id: "n",
    value: "R242901e4d295",
  },
  R435d39d517e9: {
    asserted_at: "s",
    claim_id: "u",
    claim_kind: "s",
    content_hash: "h",
    created_at: "s",
    initial_status: "s",
    initial_usage_class: "s",
    origin: "s",
    predicate: "s",
    subject: "Rc7b482f32a13",
    subject_domain: "s",
    supersedes_claim_id: "n",
    value: "R92467132df28",
  },
  R4868ccbf28d0: {
    reason: "s",
    state: "s",
  },
  R4a4ba0b3f5de: {
    acquisition_ref: "s",
    as_of: "s",
    competition_identity: "s",
    consumer_exposure: "R67d7dcf9ddc3",
    entity_identity: "s",
    event_completed_at: "s",
    event_identity: "s",
    evidence_unit_id: "u",
    language: "s",
    locator: "R283a0c91d671",
    origin: "s",
    paraphrase_permission: "b",
    quote_permission: "b",
    retention_declaration: "Rb15b8faf4bb9",
    rights_version_id: "u",
    source_identity: "s",
    source_item_identity: "s",
    source_modality: "s",
    source_role: "s",
    speaker_identity: "n",
    window_identity: "s",
    window_order: "i",
  },
  R4c322a66fb56: {
    continuity_id: "s",
    published_only: "b",
    topic_thread_id: "s",
    withdrawn: "b",
  },
  R4c3416b0dd51: {
    external_episode_ref: "s",
    external_script_ref: "s",
    external_script_version_ref: "s",
    on_air_occurrence: "R5f14a49fd8cc",
    publication_attestation: "Reedafc223948",
    topic_thread_id: "s",
    withdrawn: "b",
  },
  R4f8644d7587d: {
    created_at: "s",
    policy: "R060aaa535f89",
    rights_version_id: "u",
    source_identity: "s",
  },
  R55f3f837f469: {
    created_at: "s",
    derivation_run_id: "u",
    exact_input_refs: "[Rf784bbef4d86]",
    output: "Rb4673061bcc2",
    output_hash: "h",
    parameters: "R87af505cc600",
    rule_version: "s",
  },
  R5681a0133ba0: {
    approved_representation: "s",
    attribution_requirement: "Rb03973092230",
    claim_content_hash: "h",
    claim_id: "u",
    effective_usage_class: "s",
    frozen_state: "s",
    frozen_state_hash: "h",
    initial_status: "s",
    initial_usage_class: "s",
    kind: "s",
    origin: "s",
    predicate: "s",
    reduced_usage_class: "s",
    state_event_cursor: "n",
    subject_domain: "s",
    subject_ref: "s",
    support_refs: "[R5dd0ea19335c]",
    value: "Rb4673061bcc2",
    value_type: "s",
  },
  R5cd4d31a89e9: {
    as_of: "s",
    authored_synthetic_interpretation: "Ra4dfe1c5b6f2",
    entity_identity: "s",
    event_identity: "s",
    method_version: "s",
    observation_count: "i",
    observation_set_identity: "s",
    observations: "[R3eeacc0d6cd4]",
  },
  R5dd0ea19335c: {
    claim_support_id: "u",
    derivation_run_id: "u",
    evidence_unit_id: "n",
    external_support_identity: "n",
    support_hash: "h",
    support_kind: "s",
    support_role: "s",
  },
  R5f14a49fd8cc: {
    exact_text: "s",
    occurrence_identity: "s",
    occurrence_time: "s",
    participant_identity: "s",
    position: "s",
    semantic_turn_ref: "s",
  },
  R60541b5f0a90: {
    approved_representation: "s",
    attribution_requirement: "R98cfe7ceb25f",
    claim_content_hash: "h",
    claim_id: "u",
    effective_usage_class: "s",
    frozen_state: "s",
    frozen_state_hash: "h",
    initial_status: "s",
    initial_usage_class: "s",
    kind: "s",
    origin: "s",
    predicate: "s",
    reduced_usage_class: "s",
    state_event_cursor: "n",
    subject_domain: "s",
    subject_ref: "s",
    support_refs: "[Rb1ccb8b4ed76]",
    value: "R242901e4d295",
    value_type: "s",
  },
  R60958cf6e219: {
    acquisition_ref: "s",
    as_of: "s",
    competition_identity: "s",
    consumer_exposure: "R67d7dcf9ddc3",
    content_hash: "h",
    entity_identity: "s",
    event_identity: "s",
    evidence_type: "s",
    evidence_unit_id: "u",
    language: "s",
    locator: "R283a0c91d671",
    market_event_identity: "s",
    modality: "s",
    origin: "s",
    paraphrase_permission: "b",
    quote_permission: "b",
    reasoning_only: "b",
    retention_class: "s",
    retention_declaration: "Rb15b8faf4bb9",
    rights_policy_version: "u",
    rights_version_id: "u",
    source_identity: "s",
    source_item_identity: "s",
    source_modality: "s",
    source_role: "s",
    speaker_identity: "n",
  },
  R62a0dd14586d: {
    asserted_at: "s",
    claim_id: "u",
    claim_kind: "s",
    content_hash: "h",
    created_at: "s",
    initial_status: "s",
    initial_usage_class: "s",
    origin: "s",
    predicate: "s",
    subject: "Rc7b482f32a13",
    subject_domain: "s",
    supersedes_claim_id: "n",
    value: "Rb4673061bcc2",
  },
  R6429e700b661: {
    continuity: "Re6c9b43f6c26",
    historical_context: "Re6c9b43f6c26",
    independent_analysis: "Re6c9b43f6c26",
    licensed_tracking_data: "R4868ccbf28d0",
    serious_incident: "R4868ccbf28d0",
    structured_stats: "Re6c9b43f6c26",
    supporter_evidence: "Rd09405114801",
    verified_result: "Re6c9b43f6c26",
  },
  R66a7cbc03bde: {
    approved_representation: "s",
    attribution_requirement: "Rb03973092230",
    claim_content_hash: "h",
    claim_id: "u",
    effective_usage_class: "s",
    frozen_state: "s",
    frozen_state_hash: "h",
    initial_status: "s",
    initial_usage_class: "s",
    kind: "s",
    origin: "s",
    predicate: "s",
    reduced_usage_class: "s",
    state_event_cursor: "n",
    subject_domain: "s",
    subject_ref: "s",
    support_refs: "[Rb1ccb8b4ed76]",
    value: "R1966ac6c1517",
    value_type: "s",
  },
  R67b77ce34115: {
    as_of: "s",
    competition_identity: "s",
    complete_prior_schedule_assertion: "b",
    current_event: "R23d1d2b989bb",
    current_event_identity: "s",
    entity_identity: "s",
    ordered_prior_schedule: "[R83198eba586a]",
    schedule_scope: "s",
    selected_event_identities: "[s]",
    selection_rule: "s",
    source_identity: "s",
    source_record_ref: "s",
    synthetic: "b",
    window_identity: "s",
  },
  R67d7dcf9ddc3: {
    auditor: "s",
    planner: "s",
    writer: "s",
  },
  R69b43b64997e: {
    attested_since_year: "i",
    phrase: "s",
  },
  R6a0484d0f3bf: {
    position: "s",
    topic_thread_id: "s",
  },
  R6a46faa77fff: {
    acquisition_ref: "s",
    as_of: "s",
    competition_identity: "s",
    consumer_exposure: "R67d7dcf9ddc3",
    content_hash: "h",
    entity_identity: "s",
    event_identity: "s",
    evidence_type: "s",
    evidence_unit_id: "u",
    language: "s",
    locator: "R283a0c91d671",
    modality: "s",
    observation_order: "i",
    observation_set_identity: "s",
    observation_window: "R807fa2a79e60",
    origin: "s",
    paraphrase_permission: "b",
    quote_permission: "b",
    retention_class: "s",
    retention_declaration: "Rb15b8faf4bb9",
    rights_policy_version: "u",
    rights_version_id: "u",
    source_identity: "s",
    source_item_identity: "s",
    source_modality: "s",
    source_role: "s",
    speaker_identity: "s",
  },
  R71f7d491bb0f: {
    asserted_at: "s",
    claim_id: "u",
    claim_kind: "s",
    content_hash: "h",
    created_at: "s",
    initial_status: "s",
    initial_usage_class: "s",
    origin: "s",
    predicate: "s",
    subject: "Rc7b482f32a13",
    subject_domain: "s",
    supersedes_claim_id: "n",
    value: "Rbe6aeda32bea",
  },
  R72719a477070: {
    acquisition_ref: "s",
    as_of: "s",
    competition_identity: "s",
    consumer_exposure: "R67d7dcf9ddc3",
    content_hash: "h",
    entity_identity: "s",
    event_identity: "s",
    evidence_type: "s",
    evidence_unit_id: "u",
    language: "s",
    locator: "R283a0c91d671",
    modality: "s",
    origin: "s",
    paraphrase_permission: "b",
    quote_permission: "b",
    retention_class: "s",
    retention_declaration: "Rb15b8faf4bb9",
    rights_policy_version: "u",
    rights_version_id: "u",
    source_identity: "s",
    source_item_identity: "s",
    source_modality: "s",
    source_role: "s",
    speaker_identity: "n",
    untrusted_injection_specimen: "b",
  },
  R734ba770849b: {
    approved_representation: "s",
    attribution_requirement: "R98cfe7ceb25f",
    claim_content_hash: "h",
    claim_id: "u",
    effective_usage_class: "s",
    frozen_state: "s",
    frozen_state_hash: "h",
    initial_status: "s",
    initial_usage_class: "s",
    kind: "s",
    origin: "s",
    predicate: "s",
    reduced_usage_class: "s",
    state_event_cursor: "n",
    subject_domain: "s",
    subject_ref: "s",
    support_refs: "[Rb1ccb8b4ed76]",
    value: "R92467132df28",
    value_type: "s",
  },
  R754b11949ab8: {
    direction: "s",
    observation_count: "i",
  },
  R7e1db3802b7c: {
    canonical_content: "s",
    content_hash: "h",
    created_at: "s",
    evidence_type: "s",
    evidence_unit_id: "u",
    rights_version_id: "u",
    supersedes_evidence_unit_id: "n",
    usage_class: "s",
  },
  R807fa2a79e60: {
    end: "s",
    start: "s",
  },
  R83198eba586a: {
    competition_identity: "s",
    completed_at: "s",
    completion_status: "s",
    entity_identity: "s",
    event_identity: "s",
    rank_before_current_event: "i",
  },
  R87af505cc600: {
    after_minute: "i",
    window_matches: "i",
  },
  R8bbd99f04000: {
    acquisition_ref: "s",
    as_of: "s",
    competition_identity: "s",
    consumer_exposure: "R67d7dcf9ddc3",
    content_hash: "h",
    entity_identity: "s",
    event_identity: "n",
    evidence_type: "s",
    evidence_unit_id: "u",
    language: "s",
    locator: "R283a0c91d671",
    modality: "s",
    origin: "s",
    paraphrase_permission: "b",
    permitted_quote: "Racdfb63b5f43",
    quote_permission: "b",
    retention_class: "s",
    retention_declaration: "Rb15b8faf4bb9",
    rights_policy_version: "u",
    rights_version_id: "u",
    source_document_date: "s",
    source_document_identity: "s",
    source_identity: "s",
    source_item_identity: "s",
    source_modality: "s",
    source_role: "s",
    speaker_identity: "n",
  },
  R8f02f43ad4cc: {
    asserted_at: "s",
    claim_id: "u",
    claim_kind: "s",
    content_hash: "h",
    created_at: "s",
    initial_status: "s",
    initial_usage_class: "s",
    origin: "s",
    predicate: "s",
    subject: "Rc7b482f32a13",
    subject_domain: "s",
    supersedes_claim_id: "n",
    value: "R754b11949ab8",
  },
  R900da5ff32aa: {
    projection: "R5cd4d31a89e9",
    support_kind: "s",
  },
  R92467132df28: {
    context: "s",
    formation: "s",
  },
  R9456ebf86aca: {
    ref: "s",
    signal_id: "s",
    type: "s",
  },
  R94f48bcd9c6a: {
    ref: "u",
    signal_id: "s",
    type: "s",
  },
  R98cfe7ceb25f: {
    approved_prefix: "s",
    required: "b",
    source_id: "s",
  },
  R9b2474a6db6f: {
    acquisition_ref: "s",
    as_of: "s",
    competition_identity: "s",
    consumer_exposure: "R67d7dcf9ddc3",
    content_hash: "h",
    entity_identity: "s",
    event_completed_at: "s",
    event_identity: "s",
    evidence_type: "s",
    evidence_unit_id: "u",
    language: "s",
    locator: "R283a0c91d671",
    modality: "s",
    origin: "s",
    paraphrase_permission: "b",
    quote_permission: "b",
    retention_class: "s",
    retention_declaration: "Rb15b8faf4bb9",
    rights_policy_version: "u",
    rights_version_id: "u",
    source_identity: "s",
    source_item_identity: "s",
    source_modality: "s",
    source_role: "s",
    speaker_identity: "n",
    window_identity: "s",
    window_order: "i",
  },
  Ra4dfe1c5b6f2: {
    confidence: "s",
    direction: "s",
    intensity: "s",
  },
  Raba0677f9ff8: {
    approved_representation: "s",
    attribution_requirement: "R98cfe7ceb25f",
    claim_content_hash: "h",
    claim_id: "u",
    effective_usage_class: "s",
    frozen_state: "s",
    frozen_state_hash: "h",
    initial_status: "s",
    initial_usage_class: "s",
    kind: "s",
    origin: "s",
    predicate: "s",
    reduced_usage_class: "s",
    state_event_cursor: "n",
    subject_domain: "s",
    subject_ref: "s",
    support_refs: "[R2e6e421cc770]",
    value: "R754b11949ab8",
    value_type: "s",
  },
  Racdfb63b5f43: {
    span_end: "i",
    span_start: "i",
    text: "s",
  },
  Rb03973092230: {
    required: "b",
  },
  Rb0847f121459: {
    approved_representation: "s",
    attribution_requirement: "Rb03973092230",
    claim_content_hash: "h",
    claim_id: "u",
    effective_usage_class: "s",
    frozen_state: "s",
    frozen_state_hash: "h",
    initial_status: "s",
    initial_usage_class: "s",
    kind: "s",
    origin: "s",
    predicate: "s",
    reduced_usage_class: "s",
    state_event_cursor: "n",
    subject_domain: "s",
    subject_ref: "s",
    support_refs: "[R2e6e421cc770]",
    value: "R6a0484d0f3bf",
    value_type: "s",
  },
  Rb15b8faf4bb9: {
    canonical_source_bytes: "s",
    policy_version: "s",
    purge_behavior: "s",
  },
  Rb1ccb8b4ed76: {
    claim_support_id: "u",
    derivation_run_id: "n",
    evidence_unit_id: "u",
    external_support_identity: "n",
    support_hash: "h",
    support_kind: "s",
    support_role: "s",
  },
  Rb4673061bcc2: {
    after_minute: "i",
    count: "i",
    sample_size: "i",
  },
  Rb6a9be381785: {
    artifact_id: "u",
    canonical_payload: "Rf8e61e000e06",
    content_hash: "h",
  },
  Rbe6aeda32bea: {
    scalar: "s",
    unit: "s",
  },
  Rc1826cfae0eb: {
    approved_representation: "s",
    attribution_requirement: "Rb03973092230",
    claim_content_hash: "h",
    claim_id: "u",
    effective_usage_class: "s",
    frozen_state: "s",
    frozen_state_hash: "h",
    initial_status: "s",
    initial_usage_class: "s",
    kind: "s",
    origin: "s",
    predicate: "s",
    reduced_usage_class: "s",
    state_event_cursor: "n",
    subject_domain: "s",
    subject_ref: "s",
    support_refs: "[Rb1ccb8b4ed76]",
    value: "Rbe6aeda32bea",
    value_type: "s",
  },
  Rc387fb6412d7: {
    asserted_at: "s",
    claim_id: "u",
    claim_kind: "s",
    content_hash: "h",
    created_at: "s",
    initial_status: "s",
    initial_usage_class: "s",
    origin: "s",
    predicate: "s",
    subject: "Rc7b482f32a13",
    subject_domain: "s",
    supersedes_claim_id: "n",
    value: "R1966ac6c1517",
  },
  Rc4725114b6be: {
    claims_policy: "s",
    evidence_package_spec: "s",
    lens_definition: "s",
    rights_registry: "s",
    show_version: "s",
  },
  Rc6af9486bddb: {
    beat_id: "s",
    candidate_selection_score: "s",
    label: "s",
    member_claim_refs: "[u]",
  },
  Rc7b482f32a13: {
    entity_ref: "s",
  },
  Rc88243c7ff7e: {
    artifact_id: "u",
    canonical_payload: "R900da5ff32aa",
    content_hash: "h",
  },
  Rd0447c091be2: {
    asserted_at: "s",
    claim_id: "u",
    claim_kind: "s",
    content_hash: "h",
    created_at: "s",
    initial_status: "s",
    initial_usage_class: "s",
    origin: "s",
    predicate: "s",
    subject: "Rc7b482f32a13",
    subject_domain: "s",
    supersedes_claim_id: "n",
    value: "R6a0484d0f3bf",
  },
  Rd09405114801: {
    observation_count: "i",
    state: "s",
  },
  Rd10605cda18a: {
    context_retrieval_version: "s",
    live_search: "b",
    match_window_proof: "R67b77ce34115",
    operator: "s",
    selector_version: "s",
  },
  Rd5da2454ca3a: {
    applies_to: "s",
    note: "s",
    sensitivity_id: "s",
    state: "s",
  },
  Re6c9b43f6c26: {
    state: "s",
  },
  Reedafc223948: {
    attestation_identity: "s",
    attested_by: "s",
    published_at: "s",
    state: "s",
    synthetic: "b",
  },
  Rf089e3c10e94: {
    condition: "s",
    state: "s",
  },
  Rf784bbef4d86: {
    content_hash: "h",
    evidence_unit_id: "u",
    selected_provenance: "R4a4ba0b3f5de",
    window_proof: "R67b77ce34115",
  },
  Rf8e61e000e06: {
    projection: "R4c3416b0dd51",
    support_kind: "s",
  },
};
const roots = {
  package_profile: "R1ba095706d4c",
  claim_bases:
    "[R1b22b8919a93|R42db71461a0c|R435d39d517e9|R62a0dd14586d|R71f7d491bb0f|R8f02f43ad4cc|Rc387fb6412d7|Rd0447c091be2]",
  rights_versions: "[R4f8644d7587d]",
  evidence_bodies: "[R7e1db3802b7c]",
  support_carriers: "[Rb6a9be381785|Rc88243c7ff7e]",
  derivations: "[R55f3f837f469]",
} as const;

interface R053276b9de0c {
  readonly claim_id: string;
  readonly context_id: string;
  readonly functions: readonly string[];
  readonly reason: string;
}
interface R0eae16aca4ec {
  readonly acquisition_ref: string;
  readonly as_of: string;
  readonly competition_identity: string;
  readonly consumer_exposure: R67d7dcf9ddc3;
  readonly content_hash: string;
  readonly entity_identity: string;
  readonly event_identity: string;
  readonly evidence_type: string;
  readonly evidence_unit_id: string;
  readonly language: string;
  readonly locator: R283a0c91d671;
  readonly modality: string;
  readonly origin: string;
  readonly paraphrase_permission: boolean;
  readonly quote_permission: boolean;
  readonly retention_class: string;
  readonly retention_declaration: Rb15b8faf4bb9;
  readonly rights_policy_version: string;
  readonly rights_version_id: string;
  readonly source_identity: string;
  readonly source_item_identity: string;
  readonly source_modality: string;
  readonly source_role: string;
  readonly speaker_identity: null;
}
interface R10cc5d6a9fa2 {
  readonly evidence_unit_id: string;
  readonly member: string;
}
interface R1966ac6c1517 {
  readonly northbridge_goals: number;
  readonly southbank_goals: number;
}
interface R206018f919aa {
  readonly competition_ids: readonly string[];
  readonly entity_ids: readonly string[];
  readonly event_ids: readonly string[];
  readonly locale: string;
  readonly scheduled_default_mode: string;
  readonly scope_type: string;
  readonly show_id: string;
  readonly target_publication_slot_ref: string;
}
interface R23d1d2b989bb {
  readonly competition_identity: string;
  readonly completed_at: string;
  readonly completion_status: string;
  readonly event_identity: string;
  readonly participant_entities: readonly string[];
}
interface R242901e4d295 {
  readonly interpretation: string;
}
interface R283a0c91d671 {
  readonly body_codepoint_end: number;
  readonly body_codepoint_start: number;
  readonly evidence_unit_id: string;
  readonly kind: string;
  readonly member: string;
}
interface R2e6e421cc770 {
  readonly claim_support_id: string;
  readonly derivation_run_id: null;
  readonly evidence_unit_id: null;
  readonly external_support_identity: string;
  readonly support_hash: string;
  readonly support_kind: string;
  readonly support_role: string;
}
interface R37cfb3bbb0e1 {
  readonly display_name: string;
  readonly source_id: string;
  readonly source_role: string;
}
interface R3a1073f7e11c {
  readonly approved_representation: string;
  readonly attribution_requirement: Rb03973092230;
  readonly claim_content_hash: string;
  readonly claim_id: string;
  readonly effective_usage_class: string;
  readonly frozen_state: string;
  readonly frozen_state_hash: string;
  readonly initial_status: string;
  readonly initial_usage_class: string;
  readonly kind: string;
  readonly origin: string;
  readonly predicate: string;
  readonly reduced_usage_class: string;
  readonly state_event_cursor: null;
  readonly subject_domain: string;
  readonly subject_ref: string;
  readonly support_refs: readonly Rb1ccb8b4ed76[];
  readonly value: R69b43b64997e;
  readonly value_type: string;
}
interface R3eeacc0d6cd4 {
  readonly content_hash: string;
  readonly evidence_unit_id: string;
  readonly observation_order: number;
  readonly scoped_description_ref: R10cc5d6a9fa2;
  readonly source_identity: string;
}
interface R3f4585139a10 {
  readonly allowed_consumers: readonly string[];
  readonly claim_id: string;
  readonly effective_usage_class: string;
  readonly purpose: string;
  readonly support_refs: readonly string[];
}
interface R4868ccbf28d0 {
  readonly reason: string;
  readonly state: string;
}
interface R4a4ba0b3f5de {
  readonly acquisition_ref: string;
  readonly as_of: string;
  readonly competition_identity: string;
  readonly consumer_exposure: R67d7dcf9ddc3;
  readonly entity_identity: string;
  readonly event_completed_at: string;
  readonly event_identity: string;
  readonly evidence_unit_id: string;
  readonly language: string;
  readonly locator: R283a0c91d671;
  readonly origin: string;
  readonly paraphrase_permission: boolean;
  readonly quote_permission: boolean;
  readonly retention_declaration: Rb15b8faf4bb9;
  readonly rights_version_id: string;
  readonly source_identity: string;
  readonly source_item_identity: string;
  readonly source_modality: string;
  readonly source_role: string;
  readonly speaker_identity: null;
  readonly window_identity: string;
  readonly window_order: number;
}
interface R4c322a66fb56 {
  readonly continuity_id: string;
  readonly published_only: boolean;
  readonly topic_thread_id: string;
  readonly withdrawn: boolean;
}
interface R4c3416b0dd51 {
  readonly external_episode_ref: string;
  readonly external_script_ref: string;
  readonly external_script_version_ref: string;
  readonly on_air_occurrence: R5f14a49fd8cc;
  readonly publication_attestation: Reedafc223948;
  readonly topic_thread_id: string;
  readonly withdrawn: boolean;
}
interface R55f3f837f469 {
  readonly created_at: string;
  readonly derivation_run_id: string;
  readonly exact_input_refs: readonly Rf784bbef4d86[];
  readonly output: Rb4673061bcc2;
  readonly output_hash: string;
  readonly parameters: R87af505cc600;
  readonly rule_version: string;
}
interface R5681a0133ba0 {
  readonly approved_representation: string;
  readonly attribution_requirement: Rb03973092230;
  readonly claim_content_hash: string;
  readonly claim_id: string;
  readonly effective_usage_class: string;
  readonly frozen_state: string;
  readonly frozen_state_hash: string;
  readonly initial_status: string;
  readonly initial_usage_class: string;
  readonly kind: string;
  readonly origin: string;
  readonly predicate: string;
  readonly reduced_usage_class: string;
  readonly state_event_cursor: null;
  readonly subject_domain: string;
  readonly subject_ref: string;
  readonly support_refs: readonly R5dd0ea19335c[];
  readonly value: Rb4673061bcc2;
  readonly value_type: string;
}
interface R5cd4d31a89e9 {
  readonly as_of: string;
  readonly authored_synthetic_interpretation: Ra4dfe1c5b6f2;
  readonly entity_identity: string;
  readonly event_identity: string;
  readonly method_version: string;
  readonly observation_count: number;
  readonly observation_set_identity: string;
  readonly observations: readonly R3eeacc0d6cd4[];
}
interface R5dd0ea19335c {
  readonly claim_support_id: string;
  readonly derivation_run_id: string;
  readonly evidence_unit_id: null;
  readonly external_support_identity: null;
  readonly support_hash: string;
  readonly support_kind: string;
  readonly support_role: string;
}
interface R5f14a49fd8cc {
  readonly exact_text: string;
  readonly occurrence_identity: string;
  readonly occurrence_time: string;
  readonly participant_identity: string;
  readonly position: string;
  readonly semantic_turn_ref: string;
}
interface R60541b5f0a90 {
  readonly approved_representation: string;
  readonly attribution_requirement: R98cfe7ceb25f;
  readonly claim_content_hash: string;
  readonly claim_id: string;
  readonly effective_usage_class: string;
  readonly frozen_state: string;
  readonly frozen_state_hash: string;
  readonly initial_status: string;
  readonly initial_usage_class: string;
  readonly kind: string;
  readonly origin: string;
  readonly predicate: string;
  readonly reduced_usage_class: string;
  readonly state_event_cursor: null;
  readonly subject_domain: string;
  readonly subject_ref: string;
  readonly support_refs: readonly Rb1ccb8b4ed76[];
  readonly value: R242901e4d295;
  readonly value_type: string;
}
interface R60958cf6e219 {
  readonly acquisition_ref: string;
  readonly as_of: string;
  readonly competition_identity: string;
  readonly consumer_exposure: R67d7dcf9ddc3;
  readonly content_hash: string;
  readonly entity_identity: string;
  readonly event_identity: string;
  readonly evidence_type: string;
  readonly evidence_unit_id: string;
  readonly language: string;
  readonly locator: R283a0c91d671;
  readonly market_event_identity: string;
  readonly modality: string;
  readonly origin: string;
  readonly paraphrase_permission: boolean;
  readonly quote_permission: boolean;
  readonly reasoning_only: boolean;
  readonly retention_class: string;
  readonly retention_declaration: Rb15b8faf4bb9;
  readonly rights_policy_version: string;
  readonly rights_version_id: string;
  readonly source_identity: string;
  readonly source_item_identity: string;
  readonly source_modality: string;
  readonly source_role: string;
  readonly speaker_identity: null;
}
interface R6429e700b661 {
  readonly continuity: Re6c9b43f6c26;
  readonly historical_context: Re6c9b43f6c26;
  readonly independent_analysis: Re6c9b43f6c26;
  readonly licensed_tracking_data: R4868ccbf28d0;
  readonly serious_incident: R4868ccbf28d0;
  readonly structured_stats: Re6c9b43f6c26;
  readonly supporter_evidence: Rd09405114801;
  readonly verified_result: Re6c9b43f6c26;
}
interface R66a7cbc03bde {
  readonly approved_representation: string;
  readonly attribution_requirement: Rb03973092230;
  readonly claim_content_hash: string;
  readonly claim_id: string;
  readonly effective_usage_class: string;
  readonly frozen_state: string;
  readonly frozen_state_hash: string;
  readonly initial_status: string;
  readonly initial_usage_class: string;
  readonly kind: string;
  readonly origin: string;
  readonly predicate: string;
  readonly reduced_usage_class: string;
  readonly state_event_cursor: null;
  readonly subject_domain: string;
  readonly subject_ref: string;
  readonly support_refs: readonly Rb1ccb8b4ed76[];
  readonly value: R1966ac6c1517;
  readonly value_type: string;
}
interface R67b77ce34115 {
  readonly as_of: string;
  readonly competition_identity: string;
  readonly complete_prior_schedule_assertion: boolean;
  readonly current_event: R23d1d2b989bb;
  readonly current_event_identity: string;
  readonly entity_identity: string;
  readonly ordered_prior_schedule: readonly R83198eba586a[];
  readonly schedule_scope: string;
  readonly selected_event_identities: readonly string[];
  readonly selection_rule: string;
  readonly source_identity: string;
  readonly source_record_ref: string;
  readonly synthetic: boolean;
  readonly window_identity: string;
}
interface R67d7dcf9ddc3 {
  readonly auditor: string;
  readonly planner: string;
  readonly writer: string;
}
interface R69b43b64997e {
  readonly attested_since_year: number;
  readonly phrase: string;
}
interface R6a0484d0f3bf {
  readonly position: string;
  readonly topic_thread_id: string;
}
interface R6a46faa77fff {
  readonly acquisition_ref: string;
  readonly as_of: string;
  readonly competition_identity: string;
  readonly consumer_exposure: R67d7dcf9ddc3;
  readonly content_hash: string;
  readonly entity_identity: string;
  readonly event_identity: string;
  readonly evidence_type: string;
  readonly evidence_unit_id: string;
  readonly language: string;
  readonly locator: R283a0c91d671;
  readonly modality: string;
  readonly observation_order: number;
  readonly observation_set_identity: string;
  readonly observation_window: R807fa2a79e60;
  readonly origin: string;
  readonly paraphrase_permission: boolean;
  readonly quote_permission: boolean;
  readonly retention_class: string;
  readonly retention_declaration: Rb15b8faf4bb9;
  readonly rights_policy_version: string;
  readonly rights_version_id: string;
  readonly source_identity: string;
  readonly source_item_identity: string;
  readonly source_modality: string;
  readonly source_role: string;
  readonly speaker_identity: string;
}
interface R72719a477070 {
  readonly acquisition_ref: string;
  readonly as_of: string;
  readonly competition_identity: string;
  readonly consumer_exposure: R67d7dcf9ddc3;
  readonly content_hash: string;
  readonly entity_identity: string;
  readonly event_identity: string;
  readonly evidence_type: string;
  readonly evidence_unit_id: string;
  readonly language: string;
  readonly locator: R283a0c91d671;
  readonly modality: string;
  readonly origin: string;
  readonly paraphrase_permission: boolean;
  readonly quote_permission: boolean;
  readonly retention_class: string;
  readonly retention_declaration: Rb15b8faf4bb9;
  readonly rights_policy_version: string;
  readonly rights_version_id: string;
  readonly source_identity: string;
  readonly source_item_identity: string;
  readonly source_modality: string;
  readonly source_role: string;
  readonly speaker_identity: null;
  readonly untrusted_injection_specimen: boolean;
}
interface R734ba770849b {
  readonly approved_representation: string;
  readonly attribution_requirement: R98cfe7ceb25f;
  readonly claim_content_hash: string;
  readonly claim_id: string;
  readonly effective_usage_class: string;
  readonly frozen_state: string;
  readonly frozen_state_hash: string;
  readonly initial_status: string;
  readonly initial_usage_class: string;
  readonly kind: string;
  readonly origin: string;
  readonly predicate: string;
  readonly reduced_usage_class: string;
  readonly state_event_cursor: null;
  readonly subject_domain: string;
  readonly subject_ref: string;
  readonly support_refs: readonly Rb1ccb8b4ed76[];
  readonly value: R92467132df28;
  readonly value_type: string;
}
interface R754b11949ab8 {
  readonly direction: string;
  readonly observation_count: number;
}
interface R807fa2a79e60 {
  readonly end: string;
  readonly start: string;
}
interface R83198eba586a {
  readonly competition_identity: string;
  readonly completed_at: string;
  readonly completion_status: string;
  readonly entity_identity: string;
  readonly event_identity: string;
  readonly rank_before_current_event: number;
}
interface R87af505cc600 {
  readonly after_minute: number;
  readonly window_matches: number;
}
interface R8bbd99f04000 {
  readonly acquisition_ref: string;
  readonly as_of: string;
  readonly competition_identity: string;
  readonly consumer_exposure: R67d7dcf9ddc3;
  readonly content_hash: string;
  readonly entity_identity: string;
  readonly event_identity: null;
  readonly evidence_type: string;
  readonly evidence_unit_id: string;
  readonly language: string;
  readonly locator: R283a0c91d671;
  readonly modality: string;
  readonly origin: string;
  readonly paraphrase_permission: boolean;
  readonly permitted_quote: Racdfb63b5f43;
  readonly quote_permission: boolean;
  readonly retention_class: string;
  readonly retention_declaration: Rb15b8faf4bb9;
  readonly rights_policy_version: string;
  readonly rights_version_id: string;
  readonly source_document_date: string;
  readonly source_document_identity: string;
  readonly source_identity: string;
  readonly source_item_identity: string;
  readonly source_modality: string;
  readonly source_role: string;
  readonly speaker_identity: null;
}
interface R900da5ff32aa {
  readonly projection: R5cd4d31a89e9;
  readonly support_kind: string;
}
interface R92467132df28 {
  readonly context: string;
  readonly formation: string;
}
interface R9456ebf86aca {
  readonly ref: string;
  readonly signal_id: string;
  readonly type: string;
}
interface R94f48bcd9c6a {
  readonly ref: string;
  readonly signal_id: string;
  readonly type: string;
}
interface R98cfe7ceb25f {
  readonly approved_prefix: string;
  readonly required: boolean;
  readonly source_id: string;
}
interface R9b2474a6db6f {
  readonly acquisition_ref: string;
  readonly as_of: string;
  readonly competition_identity: string;
  readonly consumer_exposure: R67d7dcf9ddc3;
  readonly content_hash: string;
  readonly entity_identity: string;
  readonly event_completed_at: string;
  readonly event_identity: string;
  readonly evidence_type: string;
  readonly evidence_unit_id: string;
  readonly language: string;
  readonly locator: R283a0c91d671;
  readonly modality: string;
  readonly origin: string;
  readonly paraphrase_permission: boolean;
  readonly quote_permission: boolean;
  readonly retention_class: string;
  readonly retention_declaration: Rb15b8faf4bb9;
  readonly rights_policy_version: string;
  readonly rights_version_id: string;
  readonly source_identity: string;
  readonly source_item_identity: string;
  readonly source_modality: string;
  readonly source_role: string;
  readonly speaker_identity: null;
  readonly window_identity: string;
  readonly window_order: number;
}
interface Ra4dfe1c5b6f2 {
  readonly confidence: string;
  readonly direction: string;
  readonly intensity: string;
}
interface Raba0677f9ff8 {
  readonly approved_representation: string;
  readonly attribution_requirement: R98cfe7ceb25f;
  readonly claim_content_hash: string;
  readonly claim_id: string;
  readonly effective_usage_class: string;
  readonly frozen_state: string;
  readonly frozen_state_hash: string;
  readonly initial_status: string;
  readonly initial_usage_class: string;
  readonly kind: string;
  readonly origin: string;
  readonly predicate: string;
  readonly reduced_usage_class: string;
  readonly state_event_cursor: null;
  readonly subject_domain: string;
  readonly subject_ref: string;
  readonly support_refs: readonly R2e6e421cc770[];
  readonly value: R754b11949ab8;
  readonly value_type: string;
}
interface Racdfb63b5f43 {
  readonly span_end: number;
  readonly span_start: number;
  readonly text: string;
}
interface Rb03973092230 {
  readonly required: boolean;
}
interface Rb0847f121459 {
  readonly approved_representation: string;
  readonly attribution_requirement: Rb03973092230;
  readonly claim_content_hash: string;
  readonly claim_id: string;
  readonly effective_usage_class: string;
  readonly frozen_state: string;
  readonly frozen_state_hash: string;
  readonly initial_status: string;
  readonly initial_usage_class: string;
  readonly kind: string;
  readonly origin: string;
  readonly predicate: string;
  readonly reduced_usage_class: string;
  readonly state_event_cursor: null;
  readonly subject_domain: string;
  readonly subject_ref: string;
  readonly support_refs: readonly R2e6e421cc770[];
  readonly value: R6a0484d0f3bf;
  readonly value_type: string;
}
interface Rb15b8faf4bb9 {
  readonly canonical_source_bytes: string;
  readonly policy_version: string;
  readonly purge_behavior: string;
}
interface Rb1ccb8b4ed76 {
  readonly claim_support_id: string;
  readonly derivation_run_id: null;
  readonly evidence_unit_id: string;
  readonly external_support_identity: null;
  readonly support_hash: string;
  readonly support_kind: string;
  readonly support_role: string;
}
interface Rb4673061bcc2 {
  readonly after_minute: number;
  readonly count: number;
  readonly sample_size: number;
}
interface Rb6a9be381785 {
  readonly artifact_id: string;
  readonly canonical_payload: Rf8e61e000e06;
  readonly content_hash: string;
}
interface Rbe6aeda32bea {
  readonly scalar: string;
  readonly unit: string;
}
interface Rc1826cfae0eb {
  readonly approved_representation: string;
  readonly attribution_requirement: Rb03973092230;
  readonly claim_content_hash: string;
  readonly claim_id: string;
  readonly effective_usage_class: string;
  readonly frozen_state: string;
  readonly frozen_state_hash: string;
  readonly initial_status: string;
  readonly initial_usage_class: string;
  readonly kind: string;
  readonly origin: string;
  readonly predicate: string;
  readonly reduced_usage_class: string;
  readonly state_event_cursor: null;
  readonly subject_domain: string;
  readonly subject_ref: string;
  readonly support_refs: readonly Rb1ccb8b4ed76[];
  readonly value: Rbe6aeda32bea;
  readonly value_type: string;
}
interface Rc4725114b6be {
  readonly claims_policy: string;
  readonly evidence_package_spec: string;
  readonly lens_definition: string;
  readonly rights_registry: string;
  readonly show_version: string;
}
interface Rc6af9486bddb {
  readonly beat_id: string;
  readonly candidate_selection_score: string;
  readonly label: string;
  readonly member_claim_refs: readonly string[];
}
interface Rc88243c7ff7e {
  readonly artifact_id: string;
  readonly canonical_payload: R900da5ff32aa;
  readonly content_hash: string;
}
interface Rd09405114801 {
  readonly observation_count: number;
  readonly state: string;
}
interface Rd10605cda18a {
  readonly context_retrieval_version: string;
  readonly live_search: boolean;
  readonly match_window_proof: R67b77ce34115;
  readonly operator: string;
  readonly selector_version: string;
}
interface Rd5da2454ca3a {
  readonly applies_to: string;
  readonly note: string;
  readonly sensitivity_id: string;
  readonly state: string;
}
interface Re6c9b43f6c26 {
  readonly state: string;
}
interface Reedafc223948 {
  readonly attestation_identity: string;
  readonly attested_by: string;
  readonly published_at: string;
  readonly state: string;
  readonly synthetic: boolean;
}
interface Rf089e3c10e94 {
  readonly condition: string;
  readonly state: string;
}
interface Rf784bbef4d86 {
  readonly content_hash: string;
  readonly evidence_unit_id: string;
  readonly selected_provenance: R4a4ba0b3f5de;
  readonly window_proof: R67b77ce34115;
}
interface Rf8e61e000e06 {
  readonly projection: R4c3416b0dd51;
  readonly support_kind: string;
}

type Claim = readonly (
  | R3a1073f7e11c
  | R5681a0133ba0
  | R60541b5f0a90
  | R66a7cbc03bde
  | R734ba770849b
  | Raba0677f9ff8
  | Rb0847f121459
  | Rc1826cfae0eb
)[];
type ClaimRow = Claim[number];
type Evidence = readonly (
  | R0eae16aca4ec
  | R60958cf6e219
  | R6a46faa77fff
  | R72719a477070
  | R8bbd99f04000
  | R9b2474a6db6f
)[];
type EvidenceRow = Evidence[number];
type ClaimSnapshot = Pick<
  ClaimRow,
  | "claim_id"
  | "claim_content_hash"
  | "frozen_state_hash"
  | "frozen_state"
  | "effective_usage_class"
  | "state_event_cursor"
  | "support_refs"
  | "attribution_requirement"
  | "initial_status"
  | "initial_usage_class"
  | "kind"
  | "origin"
  | "predicate"
  | "reduced_usage_class"
  | "subject_domain"
  | "subject_ref"
  | "value_type"
>;
type EvidenceSnapshot = Pick<
  EvidenceRow,
  | "evidence_unit_id"
  | "content_hash"
  | "rights_version_id"
  | "evidence_type"
  | "source_identity"
  | "source_item_identity"
  | "source_role"
  | "modality"
  | "language"
  | "entity_identity"
  | "competition_identity"
  | "event_identity"
  | "as_of"
  | "consumer_exposure"
  | "quote_permission"
  | "paraphrase_permission"
  | "locator"
  | "retention_class"
  | "rights_policy_version"
  | "speaker_identity"
  | "acquisition_ref"
  | "origin"
  | "source_modality"
>;
type Inspection =
  | {
      readonly evidence_unit_id: string;
      readonly content_hash: string;
      readonly rights_version_id: string;
      readonly planner_exposure: string;
    }
  | R55f3f837f469
  | Rb6a9be381785
  | Rc88243c7ff7e;
const limits = [
  "authentic_persisted_freeze_not_verified",
  "current_rights_and_current_use_not_verified",
  "evidence_paraphrases_not_materialized",
  "two_free_text_claim_values_withheld",
  "approved_claim_representation_prose_not_emitted",
  "complete_fixture_consumer_adequacy_not_established",
  "support_sufficiency_and_semantic_truth_not_certified",
  "planner_configuration_and_execution_not_included",
] as const;
export interface PlannerFixtureConsumerView {
  readonly schema: typeof PROFILE;
  readonly materialization: "supplied_snapshot_candidate";
  readonly assurance: "snapshot_consistency_only";
  readonly package_id: string;
  readonly package_hash: string;
  readonly scope_hash: string;
  readonly scope: R206018f919aa;
  readonly version_refs: Rc4725114b6be;
  readonly availability: R6429e700b661;
  readonly beats: readonly Rc6af9486bddb[];
  readonly signals: readonly (R9456ebf86aca | R94f48bcd9c6a)[];
  readonly context_candidates: readonly R053276b9de0c[];
  readonly continuity: readonly R4c322a66fb56[];
  readonly silent_inputs: readonly R3f4585139a10[];
  readonly sensitivities: readonly Rd5da2454ca3a[];
  readonly coverage_conditions: readonly Rf089e3c10e94[];
  readonly source_attribution: readonly R37cfb3bbb0e1[];
  readonly selection_provenance: Rd10605cda18a;
  readonly claims: readonly {
    readonly snapshot: ClaimSnapshot;
    readonly value: Exclude<
      ClaimRow["value"],
      R242901e4d295 | R92467132df28
    > | null;
    readonly value_status:
      | "packaged_typed_value"
      | "withheld_pending_representation";
    readonly consumption: "silent_calibration_only" | "ordinary_snapshot";
  }[];
  readonly evidence: readonly {
    readonly snapshot: EvidenceSnapshot;
    readonly representation: {
      readonly kind: "exact_permitted_span";
      readonly text: string;
      readonly span_start: number;
      readonly span_end: number;
    } | null;
    readonly representation_status:
      | "claim_only"
      | "exact_span"
      | "paraphrase_not_materialized";
    readonly claim_representation_refs: readonly string[];
  }[];
  readonly support_summaries: readonly {
    readonly claim_id: string;
    readonly claim_support_id: string;
    readonly support_kind: string;
    readonly support_role: string;
    readonly support_hash: string;
    readonly inspection: Inspection;
  }[];
  readonly limits: typeof limits;
}
interface Observation {
  readonly input_utf8_bytes: string;
  readonly input_sha256: string;
  readonly package_text_utf8_bytes: string;
  readonly package_text_sha256: string;
}
export type PlannerFixtureConsumerResult =
  | PlannerFixtureConsumerRejection
  | {
      readonly kind: "materialized_candidate";
      readonly profile: typeof PROFILE;
      readonly observation: Observation;
      readonly view: PlannerFixtureConsumerView;
      readonly canonical_json: string;
      readonly view_sha256: string;
    };

type O = Record<string, Json>;
const parseJson: (text: string) => unknown = JSON.parse;
const JsonSyntaxError = SyntaxError;
const byteLength = Buffer.byteLength.bind(Buffer);
const MAX = 2097152;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const hex = /^[0-9a-f]{64}$/;
const artifact =
  /^artifact:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function obj(v: unknown): O {
  if (!isJsonObject(v)) throw new TypeError("owned record invariant");
  return v;
}
function arr(v: unknown): Json[] {
  if (!Array.isArray(v)) throw new TypeError("owned array invariant");
  return v as Json[];
}
function str(v: unknown): string {
  if (typeof v !== "string") throw new TypeError("owned string invariant");
  return v;
}
function num(v: unknown): number {
  if (typeof v !== "number") throw new TypeError("owned integer invariant");
  return v;
}
function at(path: string, i: number): string {
  return `${path}[${String(i)}]`;
}
function failure(
  code: PlannerFixtureConsumerError,
  field = "input",
  parser_code: ParserCode | null = null,
): PlannerFixtureConsumerRejection {
  return Object.freeze({
    kind: "rejected",
    profile: PROFILE,
    code,
    field,
    parser_code,
  });
}
class Refusal extends Error {
  constructor(readonly result: PlannerFixtureConsumerRejection) {
    super("inspection refusal");
  }
}
function refuse(code: PlannerFixtureConsumerError, field: string): never {
  throw new Refusal(failure(code, field));
}
function check(
  ok: boolean,
  field: string,
  code: PlannerFixtureConsumerError = "profile_binding_mismatch",
): void {
  if (!ok) refuse(code, field);
}
function same(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}
function boundEqual(
  a: unknown,
  b: unknown,
  path: string,
  code: PlannerFixtureConsumerError = "profile_binding_mismatch",
): void {
  check(same(a, b), path, code);
}
function unpaired(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const n = text.charCodeAt(i + 1);
      if (!(n >= 0xdc00 && n <= 0xdfff)) return true;
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) return true;
  }
  return false;
}
function order(a: string, b: string): number {
  const x = Array.from(a),
    y = Array.from(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const l = x[i]?.codePointAt(0),
      r = y[i]?.codePointAt(0);
    if (l === undefined || r === undefined)
      throw new TypeError("key ordering invariant");
    if (l !== r) return l - r;
  }
  return x.length - y.length;
}
function lexical(text: string): boolean {
  let depth = 0,
    quoted = false,
    escaped = false;
  for (const c of text) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === "{" || c === "[") {
      if (++depth > 32) return false;
    } else if (c === "}" || c === "]") depth = Math.max(0, depth - 1);
  }
  return true;
}
function graph(value: unknown): boolean {
  let nodes = 0;
  function visit(v: unknown, depth: number): boolean {
    if (++nodes > 32768) return false;
    if (typeof v !== "object" || v === null) return true;
    if (depth > 32) return false;
    if (Array.isArray(v)) {
      for (const child of v)
        if (
          !visit(
            child,
            typeof child === "object" && child !== null ? depth + 1 : depth,
          )
        )
          return false;
    } else
      for (const child of Object.values(v)) {
        if (
          ++nodes > 32768 ||
          !visit(
            child,
            typeof child === "object" && child !== null ? depth + 1 : depth,
          )
        )
          return false;
      }
    return true;
  }
  return visit(value, typeof value === "object" && value !== null ? 1 : 0);
}
function semantic(v: unknown): boolean {
  if (v === null || typeof v === "boolean") return true;
  if (typeof v === "number")
    return Number.isSafeInteger(v) && !Object.is(v, -0);
  if (typeof v === "string") return !unpaired(v);
  if (Array.isArray(v)) return v.every(semantic);
  const map = new Map<string, unknown>();
  for (const [k, c] of Object.entries(obj(v))) {
    if (unpaired(k)) return false;
    const key = k.normalize("NFC");
    if (map.has(key)) return false;
    map.set(key, c);
  }
  for (const [, c] of [...map.entries()].sort(([a], [b]) => order(a, b)))
    if (!semantic(c)) return false;
  return true;
}
function keyset(v: unknown, keys: readonly string[]): boolean {
  return (
    isJsonObject(v) &&
    Object.keys(v).length === keys.length &&
    keys.every((k) => Object.hasOwn(v, k))
  );
}
// ROOT union-prefix clarification: selection observes structure/primitive types only.
// Brackets retain the distinction between per-item unions and whole-array unions.
function alternatives(d: string): string[] {
  const result: string[] = [];
  let depth = 0,
    start = 0;
  for (let i = 0; i < d.length; i++) {
    if (d[i] === "[") depth++;
    else if (d[i] === "]") depth--;
    else if (d[i] === "|" && depth === 0) {
      result.push(d.slice(start, i));
      start = i + 1;
    }
    if (depth < 0) throw new TypeError("grammar bracket invariant");
  }
  if (depth !== 0) throw new TypeError("grammar bracket invariant");
  result.push(d.slice(start));
  if (result.some((x) => x.length === 0))
    throw new TypeError("grammar alternative invariant");
  return result;
}
interface StructuralNode {
  readonly descriptor: string;
  readonly value: unknown;
  readonly path: string;
}
interface StructuralEvent {
  readonly path: string;
  readonly accepted: boolean;
}
function structuralStep(
  pending: StructuralNode[],
): StructuralEvent | undefined {
  const node = pending.pop();
  if (!node) return undefined;
  const { value: v, path } = node;
  const options = alternatives(node.descriptor);
  const d = options.length > 1 ? choose(options, v, path) : node.descriptor;
  if (d.startsWith("[")) {
    if (!Array.isArray(v)) return { path, accepted: false };
    // Each item gets its own declared inner-union choice. An enclosing candidate
    // keeps its descriptor across every sibling/item; no Cartesian parse copies.
    for (let i = v.length - 1; i >= 0; i--)
      pending.push({
        descriptor: d.slice(1, -1),
        value: v[i],
        path: at(path, i),
      });
    return { path, accepted: true };
  }
  if (d.startsWith("R")) {
    const shape = shapes[d];
    if (!shape) throw new TypeError("grammar reference invariant");
    const fields = Object.entries(shape);
    if (!keyset(v, Object.keys(shape))) return { path, accepted: false };
    const record = obj(v);
    for (let i = fields.length - 1; i >= 0; i--) {
      const field = fields[i];
      if (!field) throw new TypeError("grammar field invariant");
      const [key, descriptor] = field;
      pending.push({ descriptor, value: record[key], path: `${path}.${key}` });
    }
    return { path, accepted: true };
  }
  const accepted =
    d === "n"
      ? v === null
      : d === "b"
        ? typeof v === "boolean"
        : d === "i"
          ? typeof v === "number"
          : typeof v === "string";
  return { path, accepted };
}
function choose(options: readonly string[], v: unknown, path: string): string {
  // One local cursor per declared alternative, containing descriptor/data
  // references only. Filtering preserves declaration order and permanently
  // removes contradicted whole branches, including their sibling correlations.
  let cursors = options.map((descriptor) => ({
    descriptor,
    pending: [{ descriptor, value: v, path }] as StructuralNode[],
  }));
  for (;;) {
    const first = cursors[0];
    if (!first) throw new TypeError("grammar survivor invariant");
    const events = cursors.map((cursor) => ({
      cursor,
      event: structuralStep(cursor.pending),
    }));
    const firstEvent = events[0]?.event;
    if (!firstEvent) {
      if (events.some(({ event }) => event !== undefined))
        throw new TypeError("grammar completion invariant");
      return first.descriptor; // Empty/identical complete prefixes: declared tie.
    }
    if (events.some(({ event }) => event?.path !== firstEvent.path))
      throw new TypeError("grammar preorder invariant");
    const survivors = events
      .filter(({ event }) => event?.accepted)
      .map(({ cursor }) => cursor);
    // All failed at this event: retain the first PRE-event survivor, not the
    // original first alternative. Validation replays its prefix from the start.
    if (survivors.length === 0) return first.descriptor;
    cursors = survivors;
  }
}
const valueKeys: Readonly<Record<string, readonly string[]>> = {
  analysis_text: ["interpretation"],
  structured_text: ["context", "formation"],
  exact_decimal: ["scalar", "unit"],
  scoreline: ["northbridge_goals", "southbank_goals"],
  lore_phrase: ["attested_since_year", "phrase"],
  tenor: ["direction", "observation_count"],
  count_window: ["after_minute", "count", "sample_size"],
  program_history: ["position", "topic_thread_id"],
};
function grammar(d: string, v: unknown, path: string, owner?: O): void {
  const options = alternatives(d);
  if (options.length > 1) {
    // No semantic predicate is evaluated by choose, and none can retry a branch.
    // Replay the selected branch from its beginning: an earlier semantic refusal
    // wins over the structural stopping event, which validation cannot pass.
    grammar(choose(options, v, path), v, path, owner);
    return;
  }
  if (d.startsWith("[")) {
    check(Array.isArray(v) && v.length <= 256, path, "profile_value_invalid");
    for (const [i, c] of arr(v).entries())
      grammar(d.slice(1, -1), c, at(path, i));
    return;
  }
  if (d.startsWith("R")) {
    const shape = shapes[d];
    if (!shape) throw new TypeError("grammar reference invariant");
    check(isJsonObject(v), path, "profile_value_invalid");
    check(keyset(v, Object.keys(shape)), path, "profile_shape_invalid");
    for (const [k, x] of Object.entries(shape))
      grammar(x, obj(v)[k], `${path}.${k}`, obj(v));
    if (Object.hasOwn(shape, "value_type")) {
      const expected = valueKeys[str(obj(v).value_type)];
      if (!expected) throw new TypeError("value type invariant");
      check(
        keyset(obj(v).value, expected),
        path + ".value",
        "profile_value_invalid",
      );
    }
    return;
  }
  if (d === "n") {
    check(v === null, path, "profile_value_invalid");
    return;
  }
  if (d === "b") {
    check(typeof v === "boolean", path, "profile_value_invalid");
    return;
  }
  if (d === "i") {
    check(
      typeof v === "number" &&
        Number.isSafeInteger(v) &&
        !Object.is(v, -0) &&
        v >= 0,
      path,
      "profile_value_invalid",
    );
    scalar(num(v), path, owner);
    return;
  }
  check(typeof v === "string", path, "profile_value_invalid");
  const s = str(v);
  check(
    s.length <= 16384 && s.trim().length > 0 && s.normalize("NFC") === s,
    path,
    "profile_value_invalid",
  );
  if (d === "u") check(uuid.test(s), path, "profile_value_invalid");
  if (d === "h") check(hex.test(s), path, "profile_value_invalid");
  scalar(s, path, owner);
}

const states = [
  "confirmed",
  "contested",
  "demoted",
  "superseded",
  "expired",
  "tombstoned",
];
const usages = ["assertable", "hedged_only", "silent"];
const exposure = ["hidden", "claim_only", "paraphrase", "exact_excerpt"];
const versions: Readonly<Record<string, string>> = {
  "package.manifest.version_refs.claims_policy": "0.1.2",
  "package.manifest.version_refs.evidence_package_spec": "0.2.2",
  "package.manifest.selection_provenance.selector_version": "fixture.manual.v2",
  "package.manifest.selection_provenance.context_retrieval_version":
    "fixture.manual.v1",
  "package.manifest.evidence[].retention_declaration.policy_version":
    "synthetic-fixture-retention-v1",
  "material.rights_versions[].policy.retention.policy_version":
    "synthetic-fixture-retention-v1",
  "material.derivations[].rule_version": "late-concession-count/v1",
  "material.derivations[].exact_input_refs[].selected_provenance.retention_declaration.policy_version":
    "synthetic-fixture-retention-v1",
  "material.support_carriers[].canonical_payload.projection.method_version":
    "bounded-supporter-tenor/v1",
};
const timestampPaths = [
  "package.created_at",
  "package.frozen_at",
  "package.manifest.evidence[].as_of",
  "package.manifest.evidence[].event_completed_at",
  "package.manifest.evidence[].observation_window.start",
  "package.manifest.evidence[].observation_window.end",
  "package.manifest.selection_provenance.match_window_proof.as_of",
  "package.manifest.selection_provenance.match_window_proof.current_event.completed_at",
  "package.manifest.selection_provenance.match_window_proof.ordered_prior_schedule[].completed_at",
  "material.claim_bases[].asserted_at",
  "material.claim_bases[].created_at",
  "material.rights_versions[].created_at",
  "material.evidence_bodies[].created_at",
  "material.derivations[].created_at",
  "material.derivations[].exact_input_refs[].selected_provenance.as_of",
  "material.derivations[].exact_input_refs[].selected_provenance.event_completed_at",
  "material.derivations[].exact_input_refs[].window_proof.as_of",
  "material.derivations[].exact_input_refs[].window_proof.current_event.completed_at",
  "material.derivations[].exact_input_refs[].window_proof.ordered_prior_schedule[].completed_at",
  "material.support_carriers[].canonical_payload.projection.as_of",
  "material.support_carriers[].canonical_payload.projection.on_air_occurrence.occurrence_time",
  "material.support_carriers[].canonical_payload.projection.publication_attestation.published_at",
];
const timestampPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
function calendar(parts: RegExpExecArray): boolean {
  const y = Number(parts[1]),
    m = Number(parts[2]),
    d = Number(parts[3]);
  const days = [
    31,
    y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return m >= 1 && m <= 12 && d >= 1 && d <= (days[m - 1] ?? 0);
}
function timestamp(s: string): boolean {
  const p = timestampPattern.exec(s);
  return (
    p !== null &&
    calendar(p) &&
    Number(p[4]) <= 23 &&
    Number(p[5]) <= 59 &&
    Number(p[6]) <= 59
  );
}
function instant(a: unknown, b: unknown): number {
  const x = timestampPattern.exec(str(a)),
    y = timestampPattern.exec(str(b));
  if (!x || !y) throw new TypeError("timestamp preflight invariant");
  for (let i = 1; i <= 6; i++) {
    const d = Number(x[i]) - Number(y[i]);
    if (d !== 0) return Math.sign(d);
  }
  const l = x[7] ?? "",
    r = y[7] ?? "";
  for (let i = 0; i < Math.max(l.length, r.length); i++) {
    const d = (l.charCodeAt(i) || 48) - (r.charCodeAt(i) || 48);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}
function scalar(v: string | number, path: string, owner?: O): void {
  const p = path.replace(/\[\d+\]/g, "[]"),
    k = p.slice(p.lastIndexOf(".") + 1);
  const version = versions[p];
  if (version !== undefined)
    check(v === version, path, "profile_version_unsupported");
  let set: readonly string[] | undefined;
  if (["initial_status", "frozen_state"].includes(k)) set = states;
  else if (
    [
      "initial_usage_class",
      "reduced_usage_class",
      "effective_usage_class",
      "usage_class",
    ].includes(k)
  )
    set = usages;
  else if (k === "claim_kind" || p.endsWith("package.manifest.claims[].kind"))
    set = [
      "analysis",
      "desk_derived",
      "event_fact",
      "lore",
      "mood",
      "program_history",
      "reported_fact",
    ];
  else if (k === "origin")
    set = [
      "data_provider",
      "desk_derived",
      "external_publisher",
      "official_source",
      "supporter_source",
    ];
  else if (k === "subject_domain")
    set = ["cultural", "historical", "statistical", "tactical"];
  else if (k === "evidence_type")
    set = ["fact", "observation", "analysis", "sentiment", "context"];
  else if (k === "source_role")
    set = [
      "official",
      "reference",
      "journalist",
      "analyst",
      "supporter",
      "market",
    ];
  else if (k === "modality" || k === "source_modality")
    set = ["text", "structured_data", "audio"];
  else if (
    /\.consumer_exposure\.(planner|writer|auditor)$/.test(p) ||
    /\.consumer_exposure_ceiling\.(planner|writer|auditor)\[\]$/.test(p)
  )
    set = exposure;
  else if (k === "retention_class") set = ["fixture_retained"];
  else if (k === "canonical_source_bytes")
    set = ["durable_offline_test_retention"];
  else if (k === "support_kind")
    set = p.startsWith("material.support_carriers")
      ? ["signal", "continuity"]
      : [
          "evidence",
          "derivation",
          "lore",
          "signal",
          "prediction",
          "continuity",
        ];
  else if (k === "support_role")
    set = [
      "supports_value",
      "supports_attribution",
      "qualifies",
      "contradicts",
      "context_only",
    ];
  else if (k === "value_type")
    set = [
      "analysis_text",
      "count_window",
      "exact_decimal",
      "lore_phrase",
      "program_history",
      "scoreline",
      "structured_text",
      "tenor",
    ];
  else if (k === "unit") set = ["percent", "probability"];
  else if (k === "direction") set = ["relief_over_celebration"];
  else if (k === "confidence") set = ["medium"];
  else if (k === "intensity") set = ["moderate"];
  else if (k === "state") {
    if (p.startsWith("package.manifest.availability."))
      set = ["available", "absent", "not_applicable"];
    else if (p.startsWith("package.manifest.coverage_conditions"))
      set = ["satisfied"];
    else if (p.startsWith("package.manifest.sensitivities")) set = ["none"];
    else if (p.endsWith(".publication_attestation.state")) set = ["published"];
  } else if (k === "condition")
    set = [
      "normal_match_analysis",
      "supporter_texture",
      "independent_analysis",
    ];
  else if (p.endsWith(".functions[]"))
    set = [
      "supports",
      "challenges",
      "complicates",
      "rhymes",
      "continuity",
      "meaning",
    ];
  else if (p.startsWith("package.manifest.signals") && k === "type")
    set = ["tenor_reading", "derivation_run"];
  else if (k === "purpose") set = ["calibration_only"];
  else if (p.endsWith(".allowed_consumers[]"))
    set = ["planner", "writer", "auditor"];
  else if (k === "completion_status") set = ["final"];
  else if (k === "kind" && p.includes(".locator."))
    set = ["synthetic_fixture_text"];
  else if (k === "member") set = ["evidence_store.json"];
  if (set)
    check(
      typeof v === "string" && set.includes(v),
      path,
      "profile_value_invalid",
    );
  if (typeof v === "number") {
    if (
      [
        "observation_order",
        "window_order",
        "rank_before_current_event",
      ].includes(k)
    )
      check(v >= 1, path, "profile_value_invalid");
    if (k === "after_minute") check(v <= 1440, path, "profile_value_invalid");
    if (k === "sample_size")
      check(v >= 1 && v <= 256, path, "profile_value_invalid");
    if (k === "count" && owner && typeof owner.sample_size === "number")
      check(v <= owner.sample_size, path, "profile_value_invalid");
    if (k === "attested_since_year")
      check(v <= 9999, path, "profile_value_invalid");
  }
  if (typeof v === "string" && k === "scalar") {
    check(
      /^(?:0|[1-9]\d{0,17})(?:\.\d{0,17}[1-9])?$/.test(v),
      path,
      "profile_value_invalid",
    );
    if (owner?.unit === "percent" || owner?.unit === "probability") {
      const [whole, frac = ""] = v.split("."),
        scale = 10n ** BigInt(frac.length),
        amount = BigInt((whole ?? "") + frac);
      check(
        amount <= BigInt(owner.unit === "percent" ? 100 : 1) * scale,
        path,
        "profile_value_invalid",
      );
    }
  }
  if (timestampPaths.includes(p))
    check(typeof v === "string" && timestamp(v), path, "profile_value_invalid");
  if (p === "package.manifest.evidence[].source_document_date") {
    const d = typeof v === "string" ? datePattern.exec(v) : null;
    check(d !== null && calendar(d), path, "profile_value_invalid");
  }
  if (
    k === "external_support_identity" &&
    (owner?.support_kind === "signal" || owner?.support_kind === "continuity")
  )
    check(
      typeof v === "string" && artifact.test(v),
      path,
      "profile_value_invalid",
    );
  if (
    p.startsWith("material.support_carriers") &&
    [
      "external_episode_ref",
      "external_script_ref",
      "external_script_version_ref",
      "occurrence_identity",
      "attestation_identity",
    ].includes(k)
  )
    check(
      typeof v === "string" &&
        v.startsWith("fixture-external:") &&
        v.length > "fixture-external:".length,
      path,
      "profile_value_invalid",
    );
}
function objects(v: unknown): O[] {
  return arr(v).map(obj);
}
function unique(values: readonly O[], key: string, path: string): void {
  const seen = new Set<string>();
  for (const [i, row] of values.entries()) {
    const value = str(row[key]);
    check(!seen.has(value), `${at(path, i)}.${key}`, "profile_duplicate");
    seen.add(value);
  }
}
function uniqueValues(values: readonly Json[], path: string): void {
  const seen = new Set<string>();
  for (const [i, v] of values.entries()) {
    const s = str(v);
    check(!seen.has(s), at(path, i), "profile_duplicate");
    seen.add(s);
  }
}
function firstIds(values: readonly string[]): string[] {
  return [...new Set(values)];
}
function lookup(rows: readonly O[], key: string, id: unknown, path: string): O {
  const r = rows.find((x) => x[key] === id);
  if (!r) refuse("profile_support_unresolved", path);
  return r;
}
const claimKeys = [
  "claim_id",
  "claim_content_hash",
  "frozen_state_hash",
  "frozen_state",
  "effective_usage_class",
  "state_event_cursor",
  "support_refs",
  "attribution_requirement",
  "initial_status",
  "initial_usage_class",
  "kind",
  "origin",
  "predicate",
  "reduced_usage_class",
  "subject_domain",
  "subject_ref",
  "value_type",
];
const evidenceKeys = [
  "evidence_unit_id",
  "content_hash",
  "rights_version_id",
  "evidence_type",
  "source_identity",
  "source_item_identity",
  "source_role",
  "modality",
  "language",
  "entity_identity",
  "competition_identity",
  "event_identity",
  "as_of",
  "consumer_exposure",
  "quote_permission",
  "paraphrase_permission",
  "locator",
  "retention_class",
  "rights_policy_version",
  "speaker_identity",
  "acquisition_ref",
  "origin",
  "source_modality",
];
interface Context {
  package: O;
  manifest: O;
  material: O;
  claims: O[];
  evidence: O[];
  bases: O[];
  rights: O[];
  bodies: O[];
  carriers: O[];
  derivations: O[];
  beats: O[];
  signals: O[];
  continuity: O[];
}
function context(p: O, m: O): Context {
  const f = obj(p.manifest);
  return {
    package: p,
    manifest: f,
    material: m,
    claims: objects(f.claims),
    evidence: objects(f.evidence),
    bases: objects(m.claim_bases),
    rights: objects(m.rights_versions),
    bodies: objects(m.evidence_bodies),
    carriers: objects(m.support_carriers),
    derivations: objects(m.derivations),
    beats: objects(f.beats),
    signals: objects(f.signals),
    continuity: objects(f.continuity),
  };
}
function carrier(c: Context, ref: unknown, path: string): O {
  const s = str(ref);
  check(artifact.test(s), path, "profile_support_unresolved");
  return lookup(c.carriers, "artifact_id", s.slice(9), path);
}
function visible(e: O, path: string): void {
  check(
    obj(e.consumer_exposure).planner !== "hidden",
    path,
    "profile_exposure_unsupported",
  );
}
function proofChronology(proof: O, path: string): void {
  const current = obj(proof.current_event),
    prior = objects(proof.ordered_prior_schedule);
  check(
    instant(current.completed_at, proof.as_of) <= 0,
    path + ".current_event.completed_at",
  );
  for (const [j, r] of prior.entries()) {
    const field = at(path + ".ordered_prior_schedule", j) + ".completed_at";
    check(instant(r.completed_at, current.completed_at) < 0, field);
    check(instant(r.completed_at, proof.as_of) <= 0, field);
    if (j > 0)
      check(instant(r.completed_at, prior[j - 1]?.completed_at) < 0, field);
  }
}
function consistency(c: Context): void {
  const {
    manifest: f,
    claims,
    evidence,
    bases,
    rights,
    bodies,
    carriers,
    derivations,
    beats,
    signals,
    continuity,
  } = c;
  // 1. Duplicates, in the accepted family and per-array order.
  for (const [name, key] of [
    ["beats", "beat_id"],
    ["context_candidates", "context_id"],
    ["signals", "signal_id"],
    ["sensitivities", "sensitivity_id"],
    ["source_attribution", "source_id"],
    ["continuity", "continuity_id"],
    ["silent_inputs", "claim_id"],
  ] as const)
    unique(objects(f[name]), key, "package.manifest." + name);
  for (const [name, key] of [
    ["claim_bases", "claim_id"],
    ["rights_versions", "rights_version_id"],
    ["evidence_bodies", "evidence_unit_id"],
    ["support_carriers", "artifact_id"],
    ["derivations", "derivation_run_id"],
  ] as const)
    unique(objects(c.material[name]), key, "material." + name);
  for (const [i, b] of beats.entries())
    uniqueValues(
      arr(b.member_claim_refs),
      at("package.manifest.beats", i) + ".member_claim_refs",
    );
  for (const [i, s] of objects(f.silent_inputs).entries())
    uniqueValues(
      arr(s.support_refs),
      at("package.manifest.silent_inputs", i) + ".support_refs",
    );
  for (const [i, r] of carriers.entries()) {
    const payload = obj(r.canonical_payload),
      p = obj(payload.projection);
    if (payload.support_kind === "signal")
      unique(
        objects(p.observations),
        "evidence_unit_id",
        at("material.support_carriers", i) +
          ".canonical_payload.projection.observations",
      );
  }
  for (const [i, r] of derivations.entries())
    unique(
      objects(r.exact_input_refs),
      "evidence_unit_id",
      at("material.derivations", i) + ".exact_input_refs",
    );
  // 2. Exact supplied material order, including hidden rights but only necessary bodies.
  const supports = claims.flatMap((x) => objects(x.support_refs));
  const derIds = firstIds([
    ...supports
      .filter((x) => x.support_kind === "derivation")
      .map((x) => str(x.derivation_run_id)),
    ...signals
      .filter((x) => x.type === "derivation_run")
      .map((x) => str(x.ref)),
  ]);
  const byDerivation = derIds.flatMap((id) =>
    objects(
      derivations.find((x) => x.derivation_run_id === id)?.exact_input_refs ??
        [],
    ).map((x) => str(x.evidence_unit_id)),
  );
  const bodyIds = firstIds([
    ...evidence
      .filter((x) => Object.hasOwn(x, "permitted_quote"))
      .map((x) => str(x.evidence_unit_id)),
    ...byDerivation,
  ]);
  const carrierIds = firstIds([
    ...supports
      .filter(
        (x) => x.support_kind === "signal" || x.support_kind === "continuity",
      )
      .map((x) => str(x.external_support_identity).slice(9)),
    ...signals
      .filter((x) => x.type === "tenor_reading")
      .map((x) => str(x.ref).slice(9)),
    ...continuity.map((x) => str(x.continuity_id).slice(9)),
  ]);
  for (const [name, key, ids] of [
    ["claim_bases", "claim_id", claims.map((x) => str(x.claim_id))],
    [
      "rights_versions",
      "rights_version_id",
      firstIds(evidence.map((x) => str(x.rights_version_id))),
    ],
    ["evidence_bodies", "evidence_unit_id", bodyIds],
    ["support_carriers", "artifact_id", carrierIds],
    ["derivations", "derivation_run_id", derIds],
  ] as const)
    boundEqual(
      objects(c.material[name]).map((x) => x[key]),
      ids,
      "material." + name,
      "profile_material_set_mismatch",
    );
  // 3. Immutable claim/base and fresh-prefix binding.
  for (const [i, cl] of claims.entries()) {
    const base = bases[i];
    if (!base) throw new TypeError("base order invariant");
    const path = at("package.manifest.claims", i),
      bp = at("material.claim_bases", i);
    for (const [pk, bk] of [
      ["kind", "claim_kind"],
      ["origin", "origin"],
      ["subject_domain", "subject_domain"],
      ["predicate", "predicate"],
      ["value", "value"],
      ["initial_status", "initial_status"],
      ["initial_usage_class", "initial_usage_class"],
    ] as const)
      boundEqual(cl[pk], base[bk], bp + "." + bk);
    boundEqual(base.subject, { entity_ref: cl.subject_ref }, bp + ".subject");
    const digest = claimContentHash(base);
    boundEqual(base.content_hash, digest, bp + ".content_hash");
    boundEqual(cl.claim_content_hash, digest, path + ".claim_content_hash");
    boundEqual(
      cl.frozen_state_hash,
      claimFrozenStateHash({
        claim_content_hash: cl.claim_content_hash,
        state: cl.frozen_state,
        effective_usage_class: cl.effective_usage_class,
      }),
      path + ".frozen_state_hash",
    );
    check(
      cl.state_event_cursor === null,
      path + ".state_event_cursor",
      "profile_usage_unsupported",
    );
    boundEqual(
      cl.frozen_state,
      cl.initial_status,
      path + ".frozen_state",
      "profile_usage_unsupported",
    );
    boundEqual(
      cl.reduced_usage_class,
      cl.initial_usage_class,
      path + ".reduced_usage_class",
      "profile_usage_unsupported",
    );
    check(
      usages.indexOf(str(cl.effective_usage_class)) >=
        Math.max(
          usages.indexOf(str(cl.initial_usage_class)),
          usages.indexOf(str(cl.reduced_usage_class)),
        ),
      path + ".effective_usage_class",
      "profile_usage_unsupported",
    );
  }
  // 4. Complete supplied rights consistency; immediate quote cross-mode refusal.
  for (const [i, e] of evidence.entries()) {
    const path = at("package.manifest.evidence", i),
      row = lookup(
        rights,
        "rights_version_id",
        e.rights_version_id,
        path + ".rights_version_id",
      ),
      policy = obj(row.policy),
      ceil = obj(policy.consumer_exposure_ceiling);
    check(
      arr(policy.covered_source_identities).includes(e.source_identity ?? null),
      path + ".source_identity",
    );
    const rp = at("material.rights_versions", rights.indexOf(row)) + ".policy";
    check(
      policy.acquisition_permission === true,
      rp + ".acquisition_permission",
    );
    for (const consumer of ["planner", "writer", "auditor"])
      check(
        arr(ceil[consumer]).includes(
          obj(e.consumer_exposure)[consumer] ?? null,
        ),
        path + ".consumer_exposure." + consumer,
      );
    check(
      e.quote_permission !== true || policy.quotation_permission === true,
      path + ".quote_permission",
    );
    check(
      e.paraphrase_permission !== true || policy.paraphrase_permission === true,
      path + ".paraphrase_permission",
    );
    boundEqual(
      e.retention_declaration,
      policy.retention,
      path + ".retention_declaration",
    );
    check(e.retention_class === "fixture_retained", path + ".retention_class");
    check(
      obj(policy.retention).canonical_source_bytes ===
        "durable_offline_test_retention",
      path + ".retention_declaration.canonical_source_bytes",
    );
    check(policy.synthetic_grant === true, rp + ".synthetic_grant");
    check(
      obj(policy.provider_exposure).external_providers === false,
      rp + ".provider_exposure.external_providers",
    );
    check(
      !Object.hasOwn(e, "permitted_quote") ||
        obj(e.consumer_exposure).planner === "exact_excerpt",
      path + ".permitted_quote",
      "profile_exposure_unsupported",
    );
  }
  // 5. Necessary body bytes and precise permitted codepoint spans, never body emission.
  for (const [i, b] of bodies.entries()) {
    const path = at("material.evidence_bodies", i),
      e = lookup(
        evidence,
        "evidence_unit_id",
        b.evidence_unit_id,
        path + ".evidence_unit_id",
      );
    for (const key of [
      "evidence_unit_id",
      "evidence_type",
      "rights_version_id",
      "content_hash",
    ])
      boundEqual(b[key], e[key], path + "." + key);
    const hash = evidenceBodyHash(str(b.canonical_content));
    boundEqual(b.content_hash, hash, path + ".content_hash");
    boundEqual(
      e.content_hash,
      hash,
      at("package.manifest.evidence", evidence.indexOf(e)) + ".content_hash",
    );
    check(
      b.supersedes_evidence_unit_id === null,
      path + ".supersedes_evidence_unit_id",
    );
    const loc = obj(e.locator),
      lp = at("package.manifest.evidence", evidence.indexOf(e)) + ".locator";
    const expected = {
      body_codepoint_end: Array.from(str(b.canonical_content)).length,
      body_codepoint_start: 0,
      evidence_unit_id: b.evidence_unit_id,
      kind: "synthetic_fixture_text",
      member: "evidence_store.json",
    };
    for (const key of [
      "body_codepoint_end",
      "body_codepoint_start",
      "evidence_unit_id",
      "kind",
      "member",
    ])
      boundEqual(loc[key], obj(expected)[key], lp + "." + key);
  }
  for (const [i, e] of evidence.entries())
    if (obj(e.consumer_exposure).planner === "exact_excerpt") {
      const p = at("package.manifest.evidence", i),
        b = bodies.find((x) => x.evidence_unit_id === e.evidence_unit_id);
      check(
        b !== undefined &&
          isJsonObject(e.permitted_quote) &&
          e.quote_permission === true,
        p + ".consumer_exposure.planner",
        "profile_exposure_unsupported",
      );
      const quote = obj(e.permitted_quote),
        points = Array.from(str(b?.canonical_content)),
        start = num(quote.span_start),
        end = num(quote.span_end);
      check(
        start >= 0 && start <= points.length,
        p + ".permitted_quote.span_start",
        "profile_quote_mismatch",
      );
      check(
        end >= start && end <= points.length,
        p + ".permitted_quote.span_end",
        "profile_quote_mismatch",
      );
      boundEqual(
        quote.text,
        points.slice(start, end).join(""),
        p + ".permitted_quote.text",
        "profile_quote_mismatch",
      );
    }
  // 6. Complete target/hash proofs, then the narrow lore representation rule.
  for (const [i, cl] of claims.entries()) {
    for (const [j, s] of objects(cl.support_refs).entries()) {
      const p = at(at("package.manifest.claims", i) + ".support_refs", j),
        kind = s.support_kind;
      check(
        kind !== "lore" && kind !== "prediction",
        p + ".support_kind",
        "profile_support_unsupported",
      );
      if (kind === "evidence") {
        const e = lookup(
          evidence,
          "evidence_unit_id",
          s.evidence_unit_id,
          p + ".evidence_unit_id",
        );
        boundEqual(
          s.support_hash,
          e.content_hash,
          p + ".support_hash",
          "profile_support_hash_mismatch",
        );
        visible(e, p + ".evidence_unit_id");
      } else if (kind === "derivation") {
        const d = lookup(
            derivations,
            "derivation_run_id",
            s.derivation_run_id,
            p + ".derivation_run_id",
          ),
          hash = derivationOutputHash(d.output);
        boundEqual(
          d.output_hash,
          hash,
          p + ".support_hash",
          "profile_support_hash_mismatch",
        );
        boundEqual(
          s.support_hash,
          hash,
          p + ".support_hash",
          "profile_support_hash_mismatch",
        );
      } else {
        const row = carrier(
            c,
            s.external_support_identity,
            p + ".external_support_identity",
          ),
          payload = obj(row.canonical_payload);
        boundEqual(
          payload.support_kind,
          kind,
          at("material.support_carriers", carriers.indexOf(row)) +
            ".canonical_payload.support_kind",
          "profile_support_unresolved",
        );
        const hash = fixtureSupportObjectHash(payload);
        boundEqual(
          row.content_hash,
          hash,
          p + ".support_hash",
          "profile_support_hash_mismatch",
        );
        boundEqual(
          s.support_hash,
          hash,
          p + ".support_hash",
          "profile_support_hash_mismatch",
        );
      }
    }
  }
  for (const [i, cl] of claims.entries())
    if (cl.value_type === "lore_phrase") {
      const supported = objects(cl.support_refs).some((s) => {
        if (
          s.support_kind !== "evidence" ||
          s.support_role !== "supports_value"
        )
          return false;
        const e = evidence.find(
          (x) => x.evidence_unit_id === s.evidence_unit_id,
        );
        return (
          e !== undefined &&
          obj(e.consumer_exposure).planner === "exact_excerpt" &&
          e.quote_permission === true &&
          isJsonObject(e.permitted_quote) &&
          obj(cl.value).phrase === e.permitted_quote.text
        );
      });
      check(
        supported,
        at("package.manifest.claims", i) + ".value.phrase",
        "profile_exposure_unsupported",
      );
    }
  // 7. Recorded signal consistency: omitted observation body bytes are NOT recomputed.
  for (const [i, row] of carriers.entries())
    if (obj(row.canonical_payload).support_kind === "signal") {
      const p =
          at("material.support_carriers", i) + ".canonical_payload.projection",
        v = obj(obj(row.canonical_payload).projection),
        observations = objects(v.observations);
      boundEqual(
        v.observation_count,
        observations.length,
        p + ".observation_count",
      );
      check(observations.length === 4, p + ".observations");
      const sources = new Set<string>();
      for (const [j, o] of observations.entries()) {
        const op = at(p + ".observations", j);
        boundEqual(o.observation_order, j + 1, op + ".observation_order");
        const source = str(o.source_identity);
        check(!sources.has(source), op + ".source_identity");
        sources.add(source);
        const e = lookup(
          evidence,
          "evidence_unit_id",
          o.evidence_unit_id,
          op + ".evidence_unit_id",
        );
        visible(e, op + ".evidence_unit_id");
        for (const key of [
          "content_hash",
          "source_identity",
          "observation_order",
        ])
          boundEqual(o[key], e[key], op + "." + key);
        for (const key of [
          "observation_set_identity",
          "event_identity",
          "entity_identity",
          "as_of",
        ])
          boundEqual(v[key], e[key], p + "." + key);
        const ref = obj(o.scoped_description_ref);
        boundEqual(
          ref.member,
          "evidence_store.json",
          op + ".scoped_description_ref.member",
        );
        boundEqual(
          ref.evidence_unit_id,
          e.evidence_unit_id,
          op + ".scoped_description_ref.evidence_unit_id",
        );
        const w = obj(e.observation_window),
          ep =
            at("package.manifest.evidence", evidence.indexOf(e)) +
            ".observation_window";
        check(instant(w.start, w.end) <= 0, ep + ".start");
        check(instant(w.end, e.as_of) <= 0, ep + ".end");
      }
      for (const [j, cl] of claims.entries())
        if (
          cl.value_type === "tenor" &&
          objects(cl.support_refs).some(
            (s) =>
              s.support_kind === "signal" &&
              s.support_role === "supports_value" &&
              s.external_support_identity ===
                "artifact:" + str(row.artifact_id),
          )
        ) {
          boundEqual(
            obj(cl.value).direction,
            obj(v.authored_synthetic_interpretation).direction,
            at("package.manifest.claims", j) + ".value.direction",
          );
          boundEqual(
            obj(cl.value).observation_count,
            v.observation_count,
            at("package.manifest.claims", j) + ".value.observation_count",
          );
        }
    }
  for (const [i, s] of signals.entries()) {
    const p = at("package.manifest.signals", i);
    if (s.type === "tenor_reading") {
      const row = carrier(c, s.ref, p + ".ref");
      boundEqual(obj(row.canonical_payload).support_kind, "signal", p + ".ref");
    } else lookup(derivations, "derivation_run_id", s.ref, p + ".ref");
  }
  // 8. Exact calculation/provenance reproduction over the supplied synthetic five-match subset.
  const selectedProof = obj(obj(f.selection_provenance).match_window_proof);
  for (const [i, d] of derivations.entries()) {
    const p = at("material.derivations", i),
      params = obj(d.parameters),
      output = obj(d.output),
      inputs = objects(d.exact_input_refs);
    boundEqual(
      params.after_minute,
      80,
      p + ".parameters.after_minute",
      "profile_calculation_mismatch",
    );
    boundEqual(
      params.window_matches,
      5,
      p + ".parameters.window_matches",
      "profile_calculation_mismatch",
    );
    boundEqual(
      output.after_minute,
      80,
      p + ".output.after_minute",
      "profile_calculation_mismatch",
    );
    check(
      num(output.count) <= 5,
      p + ".output.count",
      "profile_calculation_mismatch",
    );
    boundEqual(
      output.sample_size,
      5,
      p + ".output.sample_size",
      "profile_calculation_mismatch",
    );
    check(inputs.length === 5, p + ".exact_input_refs");
    let count = 0;
    for (const [j, input] of inputs.entries()) {
      const ip = at(p + ".exact_input_refs", j),
        e = lookup(
          evidence,
          "evidence_unit_id",
          input.evidence_unit_id,
          ip + ".evidence_unit_id",
        ),
        body = lookup(
          bodies,
          "evidence_unit_id",
          input.evidence_unit_id,
          ip + ".evidence_unit_id",
        );
      const provenance = obj(input.selected_provenance);
      for (const key of Object.keys(provenance))
        boundEqual(provenance[key], e[key], ip + ".selected_provenance." + key);
      boundEqual(input.content_hash, e.content_hash, ip + ".content_hash");
      boundEqual(input.content_hash, body.content_hash, ip + ".content_hash");
      boundEqual(input.window_proof, selectedProof, ip + ".window_proof");
      const proof = obj(input.window_proof),
        current = obj(proof.current_event),
        prior = objects(proof.ordered_prior_schedule);
      boundEqual(
        proof.entity_identity,
        arr(obj(f.scope).entity_ids)[0],
        ip + ".window_proof.entity_identity",
      );
      boundEqual(
        proof.competition_identity,
        arr(obj(f.scope).competition_ids)[0],
        ip + ".window_proof.competition_identity",
      );
      boundEqual(
        proof.current_event_identity,
        arr(obj(f.scope).event_ids)[0],
        ip + ".window_proof.current_event_identity",
      );
      boundEqual(
        current.event_identity,
        proof.current_event_identity,
        ip + ".window_proof.current_event.event_identity",
      );
      boundEqual(proof.as_of, e.as_of, ip + ".window_proof.as_of");
      boundEqual(
        proof.window_identity,
        e.window_identity,
        ip + ".window_proof.window_identity",
      );
      check(proof.synthetic === true, ip + ".window_proof.synthetic");
      check(
        proof.complete_prior_schedule_assertion === true,
        ip + ".window_proof.complete_prior_schedule_assertion",
      );
      check(prior.length === 6, ip + ".window_proof.ordered_prior_schedule");
      const ids = new Set<string>();
      boundEqual(
        current.competition_identity,
        proof.competition_identity,
        ip + ".window_proof.current_event.competition_identity",
      );
      check(
        arr(current.participant_entities).includes(
          proof.entity_identity ?? null,
        ),
        ip + ".window_proof.current_event.participant_entities",
      );
      for (const [k, r] of prior.entries()) {
        const rp = at(ip + ".window_proof.ordered_prior_schedule", k),
          id = str(r.event_identity);
        check(!ids.has(id), rp + ".event_identity");
        ids.add(id);
        boundEqual(
          r.rank_before_current_event,
          k + 1,
          rp + ".rank_before_current_event",
        );
        boundEqual(
          r.competition_identity,
          proof.competition_identity,
          rp + ".competition_identity",
        );
        boundEqual(
          r.entity_identity,
          proof.entity_identity,
          rp + ".entity_identity",
        );
      }
      boundEqual(
        proof.selected_event_identities,
        prior.slice(0, 5).map((x) => x.event_identity),
        ip + ".window_proof.selected_event_identities",
      );
      boundEqual(
        e.event_identity,
        prior[j]?.event_identity,
        ip + ".selected_provenance.event_identity",
      );
      boundEqual(
        e.event_completed_at,
        prior[j]?.completed_at,
        ip + ".selected_provenance.event_completed_at",
      );
      boundEqual(
        e.window_order,
        j + 1,
        ip + ".selected_provenance.window_order",
      );
      proofChronology(proof, ip + ".window_proof");
      const text = str(body.canonical_content),
        yes =
          /^Previous match ([1-5]): Northbridge conceded in minute ([1-9]\d{0,3})\.$/.exec(
            text,
          ),
        no =
          /^Previous match ([1-5]): Northbridge did not concede after minute 80\.$/.exec(
            text,
          );
      const bp =
        at("material.evidence_bodies", bodies.indexOf(body)) +
        ".canonical_content";
      check(yes !== null || no !== null, bp, "profile_support_unsupported");
      const match = yes ?? no;
      if (!match) throw new TypeError("body parse invariant");
      check(Number(match[1]) === j + 1, bp, "profile_support_unsupported");
      if (yes) {
        const minute = Number(yes[2]);
        check(minute <= 1440, bp, "profile_support_unsupported");
        if (minute > 80) count++;
      }
    }
    boundEqual(
      output.count,
      count,
      p + ".output.count",
      "profile_calculation_mismatch",
    );
    for (const [j, cl] of claims.entries())
      if (
        cl.value_type === "count_window" &&
        objects(cl.support_refs).some(
          (s) =>
            s.support_kind === "derivation" &&
            s.support_role === "supports_value" &&
            s.derivation_run_id === d.derivation_run_id,
        )
      )
        boundEqual(
          cl.value,
          output,
          at("package.manifest.claims", j) + ".value",
        );
  }
  // 9. Complete synthetic continuity proof, with strict temporal admission and both upper bounds.
  for (const [i, row] of carriers.entries())
    if (obj(row.canonical_payload).support_kind === "continuity") {
      const p =
          at("material.support_carriers", i) + ".canonical_payload.projection",
        v = obj(obj(row.canonical_payload).projection),
        publication = obj(v.publication_attestation),
        occurrence = obj(v.on_air_occurrence);
      boundEqual(
        publication.state,
        "published",
        p + ".publication_attestation.state",
      );
      check(
        publication.synthetic === true,
        p + ".publication_attestation.synthetic",
      );
      check(v.withdrawn === false, p + ".withdrawn");
      check(
        instant(occurrence.occurrence_time, publication.published_at) < 0,
        p + ".on_air_occurrence.occurrence_time",
      );
      check(
        instant(publication.published_at, selectedProof.as_of) <= 0,
        p + ".publication_attestation.published_at",
      );
      check(
        instant(publication.published_at, c.package.frozen_at) <= 0,
        p + ".publication_attestation.published_at",
      );
      const section = lookup(
        continuity,
        "continuity_id",
        "artifact:" + str(row.artifact_id),
        p + ".topic_thread_id",
      );
      boundEqual(
        v.topic_thread_id,
        section.topic_thread_id,
        p + ".topic_thread_id",
      );
      check(
        section.published_only === true,
        at("package.manifest.continuity", continuity.indexOf(section)) +
          ".published_only",
      );
      check(
        section.withdrawn === false,
        at("package.manifest.continuity", continuity.indexOf(section)) +
          ".withdrawn",
      );
      for (const [j, cl] of claims.entries())
        if (
          cl.value_type === "program_history" &&
          objects(cl.support_refs).some(
            (s) =>
              s.support_kind === "continuity" &&
              s.support_role === "supports_value" &&
              s.external_support_identity ===
                "artifact:" + str(row.artifact_id),
          )
        ) {
          boundEqual(
            obj(cl.value).topic_thread_id,
            v.topic_thread_id,
            at("package.manifest.claims", j) + ".value.topic_thread_id",
          );
          boundEqual(
            obj(cl.value).position,
            occurrence.position,
            at("package.manifest.claims", j) + ".value.position",
          );
        }
    }
  // 10. Other finite families, silent inverse, attribution and availability.
  for (const [name, key] of [["context_candidates", "claim_id"]] as const)
    for (const [i, r] of objects(f[name]).entries())
      lookup(
        claims,
        "claim_id",
        r[key],
        at("package.manifest." + name, i) + "." + key,
      );
  for (const [i, b] of beats.entries())
    for (const [j, ref] of arr(b.member_claim_refs).entries())
      lookup(
        claims,
        "claim_id",
        ref,
        at(at("package.manifest.beats", i) + ".member_claim_refs", j),
      );
  const silent = objects(f.silent_inputs);
  for (const [i, r] of silent.entries()) {
    const p = at("package.manifest.silent_inputs", i),
      cl = lookup(claims, "claim_id", r.claim_id, p + ".claim_id");
    boundEqual(
      cl.effective_usage_class,
      "silent",
      p + ".effective_usage_class",
    );
    boundEqual(r.effective_usage_class, "silent", p + ".effective_usage_class");
    check(
      arr(r.allowed_consumers).includes("planner"),
      p + ".allowed_consumers",
    );
    boundEqual(r.purpose, "calibration_only", p + ".purpose");
    boundEqual(
      r.support_refs,
      objects(cl.support_refs)
        .filter((s) => s.support_kind === "evidence")
        .map((s) => s.evidence_unit_id),
      p + ".support_refs",
    );
    for (const [j, id] of arr(r.support_refs).entries())
      visible(
        lookup(evidence, "evidence_unit_id", id, at(p + ".support_refs", j)),
        at(p + ".support_refs", j),
      );
  }
  for (const [i, cl] of claims.entries()) {
    const p = at("package.manifest.claims", i);
    check(
      silent.filter((x) => x.claim_id === cl.claim_id).length ===
        (cl.effective_usage_class === "silent" ? 1 : 0),
      p + ".effective_usage_class",
    );
    const attribution = obj(cl.attribution_requirement);
    if (attribution.required === true) {
      check(
        typeof attribution.approved_prefix === "string",
        p + ".attribution_requirement.approved_prefix",
      );
      const source = attribution.source_id;
      check(
        objects(f.source_attribution).some((x) => x.source_id === source) ||
          (source === "supporter_sample" &&
            cl.value_type === "tenor" &&
            objects(cl.support_refs).some(
              (s) =>
                s.support_kind === "signal" &&
                s.support_role === "supports_value",
            )),
        p + ".attribution_requirement.source_id",
        "profile_support_unresolved",
      );
    } else
      check(keyset(attribution, ["required"]), p + ".attribution_requirement");
  }
  for (const [key, v] of Object.entries(obj(f.availability))) {
    const r = obj(v),
      p = "package.manifest.availability." + key;
    check(
      r.state === "available" || typeof r.reason === "string",
      p + ".reason",
    );
    if (key === "supporter_evidence" && r.state === "available") {
      const rows = carriers.filter(
        (x) => obj(x.canonical_payload).support_kind === "signal",
      );
      check(rows.length === 1, p + ".observation_count");
      boundEqual(
        r.observation_count,
        obj(obj(rows[0]?.canonical_payload).projection).observation_count,
        p + ".observation_count",
      );
    }
  }
  for (const [i, r] of objects(f.sensitivities).entries())
    boundEqual(
      r.applies_to,
      arr(obj(f.scope).event_ids)[0],
      at("package.manifest.sensitivities", i) + ".applies_to",
    );
  check(
    obj(f.selection_provenance).live_search === false,
    "package.manifest.selection_provenance.live_search",
  );
}

// A counting visitor and a later copying visitor share the logical selection, not a completed View.
// Counting retains source references only. No carrier/derivation copy, full View, UTF8 buffer,
// canonical View string, observation or View hash exists until every counted occurrence fits.
class Writer {
  count = 0;
  constructor(readonly copying: boolean) {}
  add(n: number): void {
    this.count += n;
    if (this.count > MAX)
      refuse("profile_resource_limit", "view.canonical_json");
  }
  stringCost(s: string): number {
    let n = 2;
    for (const c of s) {
      const p = c.codePointAt(0);
      if (p === undefined) throw new TypeError("codepoint invariant");
      n +=
        c === '"' || c === "\\"
          ? 2
          : p === 8 || p === 9 || p === 10 || p === 12 || p === 13
            ? 2
            : p < 32
              ? 6
              : p < 128
                ? 1
                : p < 2048
                  ? 2
                  : p < 65536
                    ? 3
                    : 4;
    }
    return n;
  }
  value(v: Json): Json | undefined {
    if (this.copying) return copy(v);
    if (v === null) this.add(4);
    else if (typeof v === "boolean") this.add(v ? 4 : 5);
    else if (typeof v === "number") this.add(String(v).length);
    else if (typeof v === "string") this.add(this.stringCost(v));
    else if (Array.isArray(v)) {
      this.add(2);
      for (const [i, c] of v.entries()) {
        if (i > 0) this.add(1);
        this.value(c);
      }
    } else {
      this.add(2);
      for (const [i, [k, c]] of Object.entries(v).entries()) {
        if (i > 0) this.add(1);
        this.add(this.stringCost(k) + 1);
        this.value(c);
      }
    }
    return undefined;
  }
  object(
    fields: readonly (readonly [string, () => Json | undefined])[],
  ): Json | undefined {
    if (!this.copying) this.add(2);
    const out: O | undefined = this.copying ? {} : undefined;
    for (const [i, [key, emit]] of fields.entries()) {
      if (!this.copying) {
        if (i > 0) this.add(1);
        this.add(this.stringCost(key) + 1);
      }
      const v = emit();
      if (out) {
        if (v === undefined) throw new TypeError("copy visitor invariant");
        Object.defineProperty(out, key, {
          value: v,
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
    }
    return out;
  }
  array<T>(
    values: readonly T[],
    emit: (v: T, i: number) => Json | undefined,
  ): Json | undefined {
    if (!this.copying) this.add(2);
    const out: Json[] | undefined = this.copying ? [] : undefined;
    for (const [i, v] of values.entries()) {
      if (!this.copying && i > 0) this.add(1);
      const child = emit(v, i);
      if (out) {
        if (child === undefined) throw new TypeError("copy visitor invariant");
        out.push(child);
      }
    }
    return out;
  }
  fields(o: O, keys: readonly string[]): Json | undefined {
    return this.object(
      keys.map(
        (k) =>
          [
            k,
            () => {
              const v = o[k];
              if (v === undefined)
                throw new TypeError("output field invariant");
              return this.value(v);
            },
          ] as const,
      ),
    );
  }
}
function copy(v: Json): Json {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(copy);
  const r: O = {};
  for (const [k, c] of Object.entries(v))
    Object.defineProperty(r, k, {
      value: copy(c),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  return r;
}
function freeze<T>(v: T): T {
  if (typeof v === "object" && v !== null) {
    for (const child of Object.values(v)) freeze(child);
    Object.freeze(v);
  }
  return v;
}
function emitView(w: Writer, c: Context): Json | undefined {
  const f = c.manifest;
  const fixed = (v: Json) => () => w.value(v);
  const from = (key: string) => () => {
    const v = f[key];
    if (v === undefined) throw new TypeError("family selection invariant");
    return w.value(v);
  };
  const sourceFamilies = [
    "scope",
    "version_refs",
    "availability",
    "beats",
    "signals",
    "context_candidates",
    "continuity",
    "silent_inputs",
    "sensitivities",
    "coverage_conditions",
    "source_attribution",
    "selection_provenance",
  ];
  return w.object([
    ["schema", fixed(PROFILE)],
    ["materialization", fixed("supplied_snapshot_candidate")],
    ["assurance", fixed("snapshot_consistency_only")],
    ["package_id", fixed(str(c.package.id))],
    ["package_hash", fixed(str(c.package.package_hash))],
    ["scope_hash", fixed(str(c.package.scope_hash))],
    ...sourceFamilies.map((k) => [k, from(k)] as const),
    [
      "claims",
      () =>
        w.array(c.claims, (cl) => {
          const withheld =
            cl.value_type === "structured_text" ||
            cl.value_type === "analysis_text";
          return w.object([
            ["snapshot", () => w.fields(cl, claimKeys)],
            ["value", () => w.value(withheld ? null : obj(cl.value))],
            [
              "value_status",
              fixed(
                withheld
                  ? "withheld_pending_representation"
                  : "packaged_typed_value",
              ),
            ],
            [
              "consumption",
              fixed(
                cl.effective_usage_class === "silent"
                  ? "silent_calibration_only"
                  : "ordinary_snapshot",
              ),
            ],
          ]);
        }),
    ],
    [
      "evidence",
      () =>
        w.array(
          c.evidence.filter(
            (e) => obj(e.consumer_exposure).planner !== "hidden",
          ),
          (e) => {
            const mode = obj(e.consumer_exposure).planner;
            return w.object([
              ["snapshot", () => w.fields(e, evidenceKeys)],
              [
                "representation",
                () =>
                  mode === "exact_excerpt"
                    ? w.object([
                        ["kind", fixed("exact_permitted_span")],
                        ...["text", "span_start", "span_end"].map(
                          (k) =>
                            [
                              k,
                              () => {
                                const v = obj(e.permitted_quote)[k];
                                if (v === undefined)
                                  throw new TypeError("quote invariant");
                                return w.value(v);
                              },
                            ] as const,
                        ),
                      ])
                    : w.value(null),
              ],
              [
                "representation_status",
                fixed(
                  mode === "exact_excerpt"
                    ? "exact_span"
                    : mode === "paraphrase"
                      ? "paraphrase_not_materialized"
                      : "claim_only",
                ),
              ],
              [
                "claim_representation_refs",
                () =>
                  w.array(
                    c.claims.filter((cl) =>
                      objects(cl.support_refs).some(
                        (s) =>
                          s.support_kind === "evidence" &&
                          s.evidence_unit_id === e.evidence_unit_id,
                      ),
                    ),
                    (cl) => w.value(str(cl.claim_id)),
                  ),
              ],
            ]);
          },
        ),
    ],
    [
      "support_summaries",
      () => {
        // Small index pairs only: no repeated proof payload construction.
        const positions = c.claims.flatMap((cl) =>
          objects(cl.support_refs).map((s) => ({ cl, s })),
        );
        return w.array(positions, ({ cl, s }) =>
          w.object([
            ["claim_id", fixed(str(cl.claim_id))],
            ...[
              "claim_support_id",
              "support_kind",
              "support_role",
              "support_hash",
            ].map((k) => [k, () => w.value(str(s[k]))] as const),
            [
              "inspection",
              () => {
                if (s.support_kind === "evidence") {
                  const e = lookup(
                    c.evidence,
                    "evidence_unit_id",
                    s.evidence_unit_id,
                    "internal",
                  );
                  return w.object([
                    ["evidence_unit_id", fixed(str(e.evidence_unit_id))],
                    ["content_hash", fixed(str(e.content_hash))],
                    ["rights_version_id", fixed(str(e.rights_version_id))],
                    [
                      "planner_exposure",
                      fixed(str(obj(e.consumer_exposure).planner)),
                    ],
                  ]);
                }
                if (s.support_kind === "derivation")
                  return w.value(
                    lookup(
                      c.derivations,
                      "derivation_run_id",
                      s.derivation_run_id,
                      "internal",
                    ),
                  );
                return w.value(
                  carrier(c, s.external_support_identity, "internal"),
                );
              },
            ],
          ]),
        );
      },
    ],
    ["limits", () => w.array(limits, (v) => w.value(v))],
  ]);
}
function rawHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
function profileGrammar(p: O, m: O): void {
  // Accepted ROOT additive clarification: finish the whole manifest before created_at/frozen_at,
  // then all five material roots and aggregate references. P6 parser priority remains unchanged.
  grammar(roots.package_profile, p.manifest, "package.manifest");
  scalar(str(p.created_at), "package.created_at");
  scalar(str(p.frozen_at), "package.frozen_at");
  for (const name of [
    "claim_bases",
    "rights_versions",
    "evidence_bodies",
    "support_carriers",
    "derivations",
  ] as const)
    grammar(roots[name], m[name], "material." + name);
  let total = 0;
  const f = obj(p.manifest);
  for (const [name, key] of [
    ["claims", "support_refs"],
    ["beats", "member_claim_refs"],
  ] as const)
    for (const [i, row] of objects(f[name]).entries()) {
      total += arr(row[key]).length;
      check(
        total <= 4096,
        at("package.manifest." + name, i) + "." + key,
        "profile_resource_limit",
      );
    }
}
export function materializePlannerFixtureConsumerSnapshot(
  input: unknown,
): PlannerFixtureConsumerResult {
  if (typeof input !== "string") return failure("input_type_invalid");
  if (input.length === 0) return failure("input_text_empty");
  if (input.length > MAX) return failure("input_resource_limit");
  if (unpaired(input)) return failure("input_unicode_invalid");
  if (byteLength(input, "utf8") > MAX) return failure("input_resource_limit");
  if (!lexical(input)) return failure("input_resource_limit");
  let parsed: unknown;
  try {
    parsed = parseJson(input);
  } catch (error) {
    if (error instanceof JsonSyntaxError) return failure("input_json_invalid");
    throw error;
  }
  if (!graph(parsed)) return failure("input_resource_limit");
  if (!semantic(parsed)) return failure("input_semantic_json_invalid");
  if (canonicalJson(parsed) !== input)
    return failure("input_text_noncanonical");
  if (!keyset(parsed, ["schema", "package_payload", "material"]))
    return failure("input_envelope_invalid");
  const envelope = obj(parsed);
  if (envelope.schema !== "planner-fixture-consumer-input/1")
    return failure("input_envelope_invalid", "input.schema");
  if (!isJsonObject(envelope.package_payload))
    return failure("input_envelope_invalid", "input.package_payload");
  if (
    !keyset(envelope.material, [
      "claim_bases",
      "rights_versions",
      "evidence_bodies",
      "support_carriers",
      "derivations",
    ])
  )
    return failure("input_envelope_invalid", "input.material");
  const material = obj(envelope.material);
  if (
    ![
      "claim_bases",
      "rights_versions",
      "evidence_bodies",
      "support_carriers",
      "derivations",
    ].every((k) => Array.isArray(material[k]))
  )
    return failure("input_envelope_invalid", "input.material");
  let payload: O;
  try {
    payload = parsePayload(envelope.package_payload).payload;
  } catch (error) {
    if (error instanceof Rejection && parserCodes.some((c) => c === error.code))
      return failure("parser_rejected", "package", error.code as ParserCode);
    throw error;
  }
  try {
    profileGrammar(payload, material);
    const c = context(payload, material);
    consistency(c);
    const counter = new Writer(false);
    emitView(counter, c);
    // Full View construction/serialization and all success observations happen strictly after admission.
    const made = emitView(new Writer(true), c);
    if (made === undefined) throw new TypeError("View visitor invariant");
    const canonical = canonicalJson(made);
    if (byteLength(canonical, "utf8") !== counter.count)
      throw new TypeError("canonical size invariant");
    const packageText = canonicalJson(payload);
    const view = made as unknown as PlannerFixtureConsumerView;
    return freeze({
      kind: "materialized_candidate" as const,
      profile: PROFILE,
      observation: {
        input_utf8_bytes: String(byteLength(input, "utf8")),
        input_sha256: rawHash(input),
        package_text_utf8_bytes: String(byteLength(packageText, "utf8")),
        package_text_sha256: rawHash(packageText),
      },
      view,
      canonical_json: canonical,
      view_sha256: domainHash("planner-fixture-consumer-snapshot-v1", made),
    });
  } catch (error) {
    if (error instanceof Refusal) return error.result;
    throw error;
  }
}
