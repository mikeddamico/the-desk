// Accepted ROOT123 contract02, FINAL LOCK v1.2.7. Unwired historical fixture DATA.
import { Buffer } from "node:buffer";
import { types as nativeTypes } from "node:util";
import {
  openSync,
  fstatSync,
  readSync,
  closeSync,
  constants,
  Stats,
} from "node:fs";
import {
  openFixturePack,
  FixtureIntegrityError,
  type Pack,
} from "../fixture/pack.js";
import type { FixturePins } from "../fixture/pins.js";
import { parseFoundationRows } from "../fixture/rows.js";
import {
  canonicalJson,
  canonicalTimestamp,
  normalizeString,
  sha256,
  domainHash,
} from "../identity/canonical-json.js";
import { evidenceBodyHash } from "../identity/domains.js";
import {
  claimContentHash,
  claimFrozenStateHash,
  derivationOutputHash,
  fixtureSupportObjectHash,
} from "../identity/knowledge.js";
import { prepareShowrunnerFixtureInput } from "./planner-fixture-input.js";
import { loadShowrunnerFixtureBrief } from "./planner-fixture-brief.js";
import { parsePayload } from "./package-profile.js";
import { Rejection } from "./command.js";

export const PROFILE = "writer-fixture-input/2";
export type FixtureWriterInputPhase = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type NormalPhase = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type Code =
  | "arguments_refused"
  | "parent_refused"
  | "reader_refused"
  | "pack_binding_refused"
  | "source_resource_limit"
  | "source_utf8_invalid"
  | "source_json_invalid"
  | "source_graph_invalid"
  | "parser_refused"
  | "source_identity_mismatch"
  | "source_shape_invalid"
  | "source_value_invalid"
  | "rights_grant_refused"
  | "source_body_mismatch"
  | "claim_binding_refused"
  | "representation_binding_refused"
  | "selection_refused"
  | "exposure_refused"
  | "completeness_refused"
  | "parent_binding_refused"
  | "input_resource_limit"
  | "budget_refused"
  | "output_resource_limit"
  | "policy_source_unavailable"
  | "policy_source_resource_limit"
  | "policy_source_identity_mismatch";
export type FixtureWriterInputRejection = Readonly<{
  kind: "rejected";
  profile: typeof PROFILE;
  phase: NormalPhase;
  code: Code;
  field: string;
  reader_code: string | null;
  parser_code: string | null;
}>;
export type FixtureWriterInputData = Readonly<{
  assurance: "fixed_historical_fixture_data_only";
  binding: Readonly<{
    brief_identity: Readonly<{ sha256: string; utf8_bytes: string }>;
    budget_profile: string;
    planner_identity: Readonly<{ sha256: string; utf8_bytes: string }>;
    policy_sources: readonly [
      Readonly<{
        path: string;
        sha256: string;
        utf8_bytes: string;
        version: string;
      }>,
      Readonly<{
        path: string;
        sha256: string;
        utf8_bytes: string;
        version: string;
      }>,
      Readonly<{
        path: string;
        sha256: string;
        utf8_bytes: string;
        version: string;
      }>,
      Readonly<{
        path: string;
        sha256: string;
        utf8_bytes: string;
        version: string;
      }>,
      Readonly<{
        path: string;
        sha256: string;
        utf8_bytes: string;
        version: string;
      }>,
    ];
    representation_registry: Readonly<{ sha256: string; utf8_bytes: string }>;
    source_observations: readonly [
      Readonly<{
        member: string;
        role: string;
        sha256: string;
        utf8_bytes: string;
      }>,
      Readonly<{
        member: string;
        role: string;
        sha256: string;
        utf8_bytes: string;
      }>,
      Readonly<{
        member: string;
        role: string;
        sha256: string;
        utf8_bytes: string;
      }>,
      Readonly<{
        member: string;
        role: string;
        sha256: string;
        utf8_bytes: string;
      }>,
      Readonly<{
        member: string;
        role: string;
        sha256: string;
        utf8_bytes: string;
      }>,
      Readonly<{
        member: string;
        role: string;
        sha256: string;
        utf8_bytes: string;
      }>,
      Readonly<{
        member: string;
        role: string;
        sha256: string;
        utf8_bytes: string;
      }>,
      Readonly<{
        member: string;
        role: string;
        sha256: string;
        utf8_bytes: string;
      }>,
      Readonly<{
        member: string;
        role: string;
        sha256: string;
        utf8_bytes: string;
      }>,
      Readonly<{
        member: string;
        role: string;
        sha256: string;
        utf8_bytes: string;
      }>,
      Readonly<{
        member: string;
        role: string;
        sha256: string;
        utf8_bytes: string;
      }>,
    ];
  }>;
  identities: Readonly<{
    writer_context_sha256: string;
    writer_data: Readonly<{ sha256: string; utf8_bytes: string }>;
    writer_view_sha256: string;
  }>;
  limits: readonly [string, string, string, string, string, string, string];
  schema: "writer-fixture-input/2";
  writer_context_manifest: Readonly<{
    completeness_check: Readonly<{
      exclusions_applied_count: number;
      forbidden_refs_serialized_to_writer: boolean;
      missing_refs: readonly [];
      status: "pass";
    }>;
    estimated_input_tokens: number;
    model_context_limit: number;
    required_character_refs: readonly [string, string, string];
    required_claim_refs: readonly [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    required_component_refs: readonly [string, string];
    required_comprehension_target_refs: readonly [string];
    required_context_selection_refs: readonly [string, string, string];
    required_policy_refs: readonly [string, string, string, string];
    reserved_output_tokens: number;
    serialized_input_hash: string;
  }>;
  writer_data: Readonly<{
    brief_hash: string;
    character_profile_versions: Readonly<{
      gaz: string;
      simon: string;
      tully: string;
    }>;
    compact_writing_standard: Readonly<{
      principles: readonly [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ];
      version: string;
    }>;
    comprehension_targets: readonly [
      Readonly<{
        closing_synthesis_candidate: boolean;
        comprehension_target_id: string;
        forward_horizon: string;
        listener_question: string;
        priority: string;
        related_beat_ids: readonly [string, string];
        supporting_claim_refs: readonly [
          string,
          string,
          string,
          string,
          string,
        ];
        useful_treatment_lenses: readonly [string, string, string, string];
      }>,
    ];
    context_selections: readonly [
      Readonly<{
        context_id: string;
        context_selection_id: string;
        function: string;
        program_block_id: string;
      }>,
      Readonly<{
        context_id: string;
        context_selection_id: string;
        function: string;
        program_block_id: string;
      }>,
      Readonly<{
        context_id: string;
        context_selection_id: string;
        function: string;
        program_block_id: string;
      }>,
    ];
    evidence_package_id: string;
    live_search: boolean;
    locale: string;
    package_hash: string;
    program_block_refs: readonly [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    purpose: "evaluation";
    recent_pattern_signals: Readonly<{
      disagreement_shape: readonly [string];
      ending_shape: readonly [string, string];
      feature_usage: readonly [string];
    }>;
    runtime_and_block_budgets: Readonly<{
      purpose: "evaluation_fixture";
      seconds: number;
    }>;
    selected_claims: readonly [
      Readonly<{
        approved_representation: string;
        attribution_requirement: Readonly<{ required: boolean }>;
        claim_content_hash: string;
        claim_id: string;
        effective_usage_class: "assertable";
        frozen_state: "confirmed";
        frozen_state_hash: string;
        kind: string;
        origin: string;
        predicate: string;
        subject_domain: string;
        subject_ref: string;
        support_refs: readonly [
          Readonly<{ ref: string; role: string; type: "evidence_unit" }>,
        ];
        value: Readonly<{ northbridge_goals: number; southbank_goals: number }>;
        value_status: "original";
        value_type: "scoreline";
      }>,
      Readonly<{
        approved_representation: string;
        attribution_requirement: Readonly<{ required: boolean }>;
        claim_content_hash: string;
        claim_id: string;
        effective_usage_class: "assertable";
        frozen_state: "confirmed";
        frozen_state_hash: string;
        kind: string;
        origin: string;
        predicate: string;
        subject_domain: string;
        subject_ref: string;
        support_refs: readonly [
          Readonly<{ ref: string; role: string; type: "evidence_unit" }>,
        ];
        value: Readonly<{ scalar: string; unit: string }>;
        value_status: "original";
        value_type: "exact_decimal";
      }>,
      Readonly<{
        approved_representation: string;
        attribution_requirement: Readonly<{ required: boolean }>;
        claim_content_hash: string;
        claim_id: string;
        effective_usage_class: "assertable";
        frozen_state: "confirmed";
        frozen_state_hash: string;
        kind: string;
        origin: string;
        predicate: string;
        subject_domain: string;
        subject_ref: string;
        support_refs: readonly [
          Readonly<{ ref: string; role: string; type: "derivation_run" }>,
        ];
        value: Readonly<{
          after_minute: number;
          count: number;
          sample_size: number;
        }>;
        value_status: "original";
        value_type: "count_window";
      }>,
      Readonly<{
        approved_representation: string;
        attribution_requirement: Readonly<{
          approved_prefix: string;
          required: boolean;
          source_id: string;
        }>;
        claim_content_hash: string;
        claim_id: string;
        effective_usage_class: "assertable";
        frozen_state: "confirmed";
        frozen_state_hash: string;
        kind: string;
        origin: string;
        predicate: string;
        subject_domain: string;
        subject_ref: string;
        support_refs: readonly [
          Readonly<{ ref: string; role: string; type: "evidence_unit" }>,
        ];
        value: null;
        value_status: "withheld_original_text_value";
        value_type: "structured_text";
      }>,
      Readonly<{
        approved_representation: string;
        attribution_requirement: Readonly<{
          approved_prefix: string;
          required: boolean;
          source_id: string;
        }>;
        claim_content_hash: string;
        claim_id: string;
        effective_usage_class: "hedged_only";
        frozen_state: "confirmed";
        frozen_state_hash: string;
        kind: string;
        origin: string;
        predicate: string;
        subject_domain: string;
        subject_ref: string;
        support_refs: readonly [
          Readonly<{ ref: string; role: string; type: "evidence_unit" }>,
        ];
        value: null;
        value_status: "withheld_original_text_value";
        value_type: "analysis_text";
      }>,
      Readonly<{
        approved_representation: string;
        attribution_requirement: Readonly<{
          approved_prefix: string;
          required: boolean;
          source_id: string;
        }>;
        claim_content_hash: string;
        claim_id: string;
        effective_usage_class: "assertable";
        frozen_state: "confirmed";
        frozen_state_hash: string;
        kind: string;
        origin: string;
        predicate: string;
        subject_domain: string;
        subject_ref: string;
        support_refs: readonly [
          Readonly<{ ref: string; role: string; type: "tenor_reading" }>,
        ];
        value: Readonly<{ direction: string; observation_count: number }>;
        value_status: "original";
        value_type: "tenor";
      }>,
      Readonly<{
        approved_representation: string;
        attribution_requirement: Readonly<{ required: boolean }>;
        claim_content_hash: string;
        claim_id: string;
        effective_usage_class: "assertable";
        frozen_state: "confirmed";
        frozen_state_hash: string;
        kind: string;
        origin: string;
        predicate: string;
        subject_domain: string;
        subject_ref: string;
        support_refs: readonly [
          Readonly<{ ref: string; role: string; type: "evidence_unit" }>,
        ];
        value: Readonly<{ attested_since_year: number; phrase: string }>;
        value_status: "original";
        value_type: "lore_phrase";
      }>,
      Readonly<{
        approved_representation: string;
        attribution_requirement: Readonly<{ required: boolean }>;
        claim_content_hash: string;
        claim_id: string;
        effective_usage_class: "assertable";
        frozen_state: "confirmed";
        frozen_state_hash: string;
        kind: string;
        origin: string;
        predicate: string;
        subject_domain: string;
        subject_ref: string;
        support_refs: readonly [
          Readonly<{ ref: string; role: string; type: "continuity" }>,
        ];
        value: Readonly<{ position: string; topic_thread_id: string }>;
        value_status: "original";
        value_type: "program_history";
      }>,
    ];
    selected_evidence: readonly [
      Readonly<{
        authorized_representation: string;
        consumer_exposure: Readonly<{ writer: string }>;
        content_hash: string;
        evidence_type: string;
        evidence_unit_id: string;
        locator: Readonly<{ ref: string; type: "fixture_record" }>;
        modality: string;
        origin: string;
        paraphrase_permission: boolean;
        quote_permission: boolean;
        rights_policy_version: string;
        source_role: string;
      }>,
      Readonly<{
        authorized_representation: string;
        consumer_exposure: Readonly<{ writer: string }>;
        content_hash: string;
        evidence_type: string;
        evidence_unit_id: string;
        locator: Readonly<{ ref: string; type: "fixture_record" }>;
        modality: string;
        origin: string;
        paraphrase_permission: boolean;
        quote_permission: boolean;
        rights_policy_version: string;
        source_role: string;
      }>,
      Readonly<{
        authorized_representation: string;
        consumer_exposure: Readonly<{ writer: string }>;
        content_hash: string;
        evidence_type: string;
        evidence_unit_id: string;
        locator: Readonly<{ ref: string; type: "fixture_record" }>;
        modality: string;
        origin: string;
        paraphrase_permission: boolean;
        quote_permission: boolean;
        rights_policy_version: string;
        source_role: string;
      }>,
    ];
    show_version: string;
    showrunner_brief_version_id: string;
    writing_craft_policy_version: string;
    writing_policy_version: string;
  }>;
}>;
export type FixtureWriterInputResult =
  | FixtureWriterInputRejection
  | Readonly<{
      kind: "fixture_writer_input";
      profile: typeof PROFILE;
      data: FixtureWriterInputData;
      writer_data_json: string;
      data_json: string;
      identity: Readonly<{ utf8_bytes: string; sha256: string }>;
    }>;
export class FixtureWriterInputFault extends Error {
  declare readonly code: "unexpected_failure";
  declare readonly phase: FixtureWriterInputPhase;
  constructor(phase: FixtureWriterInputPhase) {
    super();
    const p =
      arguments.length === 1 &&
      typeof phase === "number" &&
      Number.isInteger(phase) &&
      phase >= 0 &&
      phase <= 9
        ? phase + 0
        : 9;
    Object.defineProperties(this, {
      name: {
        value: "FixtureWriterInputFault",
        enumerable: false,
        writable: false,
        configurable: false,
      },
      message: {
        value: "Unexpected fixture writer input failure",
        enumerable: false,
        writable: false,
        configurable: false,
      },
      stack: {
        value:
          "FixtureWriterInputFault: Unexpected fixture writer input failure",
        enumerable: false,
        writable: false,
        configurable: false,
      },
      code: {
        value: "unexpected_failure",
        enumerable: true,
        writable: false,
        configurable: false,
      },
      phase: {
        value: p,
        enumerable: true,
        writable: false,
        configurable: false,
      },
    });
    Object.freeze(this);
  }
}
const META = {
  policies: [
    {
      path: "Lock/02_ACTIVE_SPECS/The_Desk_Writing_Spec_v0.2.3.md",
      sha256:
        "62f2a4c5424a39ee445929a47c2ffea070eb3ded40767876ae328fe2dcc42bda",
      utf8_bytes: "64515",
      version: "writing-0.2.3",
    },
    {
      path: "Lock/02_ACTIVE_SPECS/The_Desk_Writing_Build_1-2_Fixture_Profile_Addendum_v0.2.md",
      sha256:
        "14c49df3a0a1328d2ba61c0ff137cf4fdb37867a34811f065073d123814aa75c",
      utf8_bytes: "26145",
      version: "writing-fixture-profile-addendum-0.2",
    },
    {
      path: "Lock/02_ACTIVE_SPECS/The_Desk_Writing_Craft_and_Invisible_Comprehension_v0.1.md",
      sha256:
        "07b9cc27d2e20882c8890aec8c5432044aa9d5b295b7ac166e9e99beec30ad04",
      utf8_bytes: "22315",
      version: "writing-craft-0.1",
    },
    {
      path: "Lock/02_ACTIVE_SPECS/The_Desk_Claims_Policy_v0.1.2.md",
      sha256:
        "d62323da55dea8f0aa0754ead2fb27efd435e744c600215a9de71a712afaa9ed",
      utf8_bytes: "52219",
      version: "claims-0.1.2",
    },
    {
      path: "Lock/04_IMPLEMENTATION/The_Desk_Hashing_Fingerprints_and_Text_Spans_v0.1.6.md",
      sha256:
        "ba5ee5c6aaa7c8233a3bd03a066095600dd9ff3849903aed20b8130f75650ca8",
      utf8_bytes: "83832",
      version: "hashing-0.1.6",
    },
  ],
  sources: [
    {
      member: "foundation_rows_398.json",
      role: "active_load",
      sha256:
        "a27f4381bd6449bfb656c6431b56115a932e05c82791696fc293c701c0a58a7e",
      utf8_bytes: "471514",
    },
    {
      member: "evidence_package.json",
      role: "artifact_payload_member",
      sha256:
        "bd9f5ff68156d6c03184c0e6d2f1acccc35bbb0c0223ab4ab611fb9378ba05f9",
      utf8_bytes: "54034",
    },
    {
      member: "writer_context_manifest.json",
      role: "artifact_payload_member",
      sha256:
        "503b660ab763bd43f9ae7e155a53f2ece9cb747e53f1f9705c0cd9848c4a24a6",
      utf8_bytes: "1313",
    },
    {
      member: "config/policy_versions.json",
      role: "configuration",
      sha256:
        "5d02892aeb53f8236e437a3728e383beb5d0534c85760072ea5c3a32e36c6b18",
      utf8_bytes: "5005",
    },
    {
      member: "config/participant_profiles.json",
      role: "programming_configuration",
      sha256:
        "86fc33c6c4d9bb6c1226f4774815341716a677d8a04bfacea997658087440b61",
      utf8_bytes: "635",
    },
    {
      member: "config/show_config_version.json",
      role: "configuration",
      sha256:
        "2024e994b1fb6d772f04dd604d589fd2155015197591f9505ebd9ab0e646b5a7",
      utf8_bytes: "1188",
    },
    {
      member: "config/rundown_template_post_event_launch_v2.json",
      role: "programming_configuration",
      sha256:
        "4c74bc6563680d907233921333a6528463ec5819a2375786ba77efbb15e3a9f6",
      utf8_bytes: "3591",
    },
    {
      member: "config/episode_modes.json",
      role: "programming_configuration",
      sha256:
        "b03b3889cdc1b1facf4be77d76e2212d3d166f7e406c589aae8a9e8bf1d06586",
      utf8_bytes: "381",
    },
    {
      member: "config/block_types.json",
      role: "programming_configuration",
      sha256:
        "a6db53ee315437200bfadd76c988860512a9a36588e865dd8d78581c32dcfbb7",
      utf8_bytes: "1467",
    },
    {
      member: "config/enum_registries.json",
      role: "configuration_registry",
      sha256:
        "ba2d1ee8602b216d200cd5eec1cf1f20367e5a071f4509552d32afc47c64e4fd",
      utf8_bytes: "962",
    },
    {
      member: "support_payloads.json",
      role: "artifact_payload_container",
      sha256:
        "bb3fd40fc1ccbb182fc00fd42c04d67517163c8aa4f6ee23e774cb0c3da75d58",
      utf8_bytes: "3960",
    },
  ],
  principles: [
    "Write a conversation in which participants affect what comes next.",
    "Prefer consequential insight over recitation.",
    "Let evidence do argumentative work.",
    "Make forward implication matter, but do not manufacture certainty.",
    "Reinforce only the few ideas worth retaining, and reinforce by changing their conversational function.",
    "Make comprehension design invisible.",
    "Let personality create pleasure, not merely perform a functional role.",
    "Allow restraint. Not every turn needs a joke, stat, argument, analogy, or conclusion.",
    "End beats when their value is extracted.",
    "Do not imitate prior surface forms merely because they worked.",
  ],
  patterns: {
    disagreement_shape: ["mixed"],
    ending_shape: ["open_question", "quiet_synthesis"],
    feature_usage: ["none"],
  },
  limits: [
    "unwired_evaluation_fixture_data_only",
    "no_current_rights_or_authenticated_freeze",
    "no_writer_model_provider_request_or_execution",
    "parent_data_delegation_is_not_producer_authorization",
    "synthetic_byte_budget_not_tokenizer_or_hosted_context_proof",
    "reader_subprocess_no_timeout_reopened_archive_selected_realm_limits",
    "no_persistence_lifecycle_14_gate_G3_G1C_or_Build_acceptance",
  ],
  wordings: [
    {
      target_kind: "evidence",
      target_id: "d1250007-0000-4000-8000-000000000003",
      source_evidence_unit_id: "d1250007-0000-4000-8000-000000000003",
      representation_id: "writer-evidence-3/2",
      text: "Reporting by the North Coast Gazette describes Northbridge working in training on a 5-4-1 setup for late-match situations.",
      source_identity: "src_north_coast_gazette",
    },
    {
      target_kind: "evidence",
      target_id: "d1250007-0000-4000-8000-000000000004",
      source_evidence_unit_id: "d1250007-0000-4000-8000-000000000004",
      representation_id: "writer-evidence-4/2",
      text: "Matchboard Analysis describes Southbank's focus on wide areas after the break as a possible intentional answer to Northbridge compressing midfield.",
      source_identity: "src_matchboard_analysis",
    },
    {
      target_kind: "evidence",
      target_id: "d1250007-0000-4000-8000-000000000009",
      source_evidence_unit_id: "d1250007-0000-4000-8000-000000000009",
      representation_id: "writer-evidence-9/2",
      text: "the long ten",
      source_identity: "src_east_bank_review_archive",
    },
    {
      target_kind: "claim",
      target_id: "d1250008-0000-4000-8000-000000000003",
      source_evidence_unit_id: "d1250007-0000-4000-8000-000000000003",
      representation_id: "writer-claim-3/2",
      text: "The North Coast Gazette reports that training included a 5-4-1 option for Northbridge to use when closing out a match.",
      source_identity: "src_north_coast_gazette",
    },
    {
      target_kind: "claim",
      target_id: "d1250008-0000-4000-8000-000000000004",
      source_evidence_unit_id: "d1250007-0000-4000-8000-000000000004",
      representation_id: "writer-claim-4/2",
      text: "One specialist analysis in the package suggests Southbank's focus on the flanks after half-time could have been an intentional answer to Northbridge's narrower midfield.",
      source_identity: "src_matchboard_analysis",
    },
  ],
};
const RIGHTS = [
  {
    created_at: "2026-09-27T12:30:00Z",
    policy: {
      acquisition_permission: true,
      attribution: {
        exact_source_credit_refs: ["src_north_coast_league"],
        required_for_spoken_reporting: false,
        supporter_identity_minimization: true,
      },
      consumer_exposure_ceiling: {
        auditor: ["claim_only"],
        planner: ["claim_only"],
        writer: ["claim_only"],
      },
      covered_source_identities: ["src_north_coast_league"],
      grant_identity: "fixture-official-v1",
      grantor: "The Desk synthetic fixture author",
      paraphrase_permission: true,
      provider_exposure: {
        external_providers: false,
        fixture_stub:
          "rights-safe refs and permitted bounded consumer representations only",
        fixture_tts: "approved final spoken text only",
      },
      quotation_permission: false,
      retention: {
        canonical_source_bytes: "durable_offline_test_retention",
        policy_version: "synthetic-fixture-retention-v1",
        purge_behavior:
          "retain permitted tombstone metadata; no replacement bytes",
      },
      synthetic_grant: true,
    },
    rights_version_id: "d1250006-0000-4000-8000-000000000004",
    source_identity: "fixture-grant:fixture-official-v1",
  },
  {
    created_at: "2026-09-27T12:30:00Z",
    policy: {
      acquisition_permission: true,
      attribution: {
        exact_source_credit_refs: ["src_fixture_data"],
        required_for_spoken_reporting: false,
        supporter_identity_minimization: true,
      },
      consumer_exposure_ceiling: {
        auditor: ["claim_only"],
        planner: ["claim_only"],
        writer: ["claim_only", "hidden"],
      },
      covered_source_identities: ["src_fixture_data"],
      grant_identity: "fixture-data-v1",
      grantor: "The Desk synthetic fixture author",
      paraphrase_permission: true,
      provider_exposure: {
        external_providers: false,
        fixture_stub:
          "rights-safe refs and permitted bounded consumer representations only",
        fixture_tts: "approved final spoken text only",
      },
      quotation_permission: false,
      retention: {
        canonical_source_bytes: "durable_offline_test_retention",
        policy_version: "synthetic-fixture-retention-v1",
        purge_behavior:
          "retain permitted tombstone metadata; no replacement bytes",
      },
      synthetic_grant: true,
    },
    rights_version_id: "d1250006-0000-4000-8000-000000000002",
    source_identity: "fixture-grant:fixture-data-v1",
  },
  {
    created_at: "2026-09-27T12:30:00Z",
    policy: {
      acquisition_permission: true,
      attribution: {
        exact_source_credit_refs: [
          "src_matchboard_analysis",
          "src_north_coast_gazette",
        ],
        required_for_spoken_reporting: true,
        supporter_identity_minimization: true,
      },
      consumer_exposure_ceiling: {
        auditor: ["exact_excerpt"],
        planner: ["paraphrase"],
        writer: ["paraphrase"],
      },
      covered_source_identities: [
        "src_matchboard_analysis",
        "src_north_coast_gazette",
      ],
      grant_identity: "fixture-paraphrase-v1",
      grantor: "The Desk synthetic fixture author",
      paraphrase_permission: true,
      provider_exposure: {
        external_providers: false,
        fixture_stub:
          "rights-safe refs and permitted bounded consumer representations only",
        fixture_tts: "approved final spoken text only",
      },
      quotation_permission: false,
      retention: {
        canonical_source_bytes: "durable_offline_test_retention",
        policy_version: "synthetic-fixture-retention-v1",
        purge_behavior:
          "retain permitted tombstone metadata; no replacement bytes",
      },
      synthetic_grant: true,
    },
    rights_version_id: "d1250006-0000-4000-8000-000000000005",
    source_identity: "fixture-grant:fixture-paraphrase-v1",
  },
  {
    created_at: "2026-09-27T12:30:00Z",
    policy: {
      acquisition_permission: true,
      attribution: {
        exact_source_credit_refs: [
          "src_supporter_blog_c",
          "src_supporter_forum_a",
          "src_supporter_forum_d",
          "src_supporter_podcast_b",
        ],
        required_for_spoken_reporting: false,
        supporter_identity_minimization: true,
      },
      consumer_exposure_ceiling: {
        auditor: ["exact_excerpt"],
        planner: ["paraphrase"],
        writer: ["paraphrase"],
      },
      covered_source_identities: [
        "src_supporter_blog_c",
        "src_supporter_forum_a",
        "src_supporter_forum_d",
        "src_supporter_podcast_b",
      ],
      grant_identity: "fixture-supporter-v1",
      grantor: "The Desk synthetic fixture author",
      paraphrase_permission: true,
      provider_exposure: {
        external_providers: false,
        fixture_stub:
          "rights-safe refs and permitted bounded consumer representations only",
        fixture_tts: "approved final spoken text only",
      },
      quotation_permission: false,
      retention: {
        canonical_source_bytes: "durable_offline_test_retention",
        policy_version: "synthetic-fixture-retention-v1",
        purge_behavior:
          "retain permitted tombstone metadata; no replacement bytes",
      },
      synthetic_grant: true,
    },
    rights_version_id: "d1250006-0000-4000-8000-000000000007",
    source_identity: "fixture-grant:fixture-supporter-v1",
  },
  {
    created_at: "2026-09-27T12:30:00Z",
    policy: {
      acquisition_permission: true,
      attribution: {
        exact_source_credit_refs: ["src_east_bank_review_archive"],
        required_for_spoken_reporting: false,
        supporter_identity_minimization: true,
      },
      consumer_exposure_ceiling: {
        auditor: ["exact_excerpt"],
        planner: ["exact_excerpt"],
        writer: ["exact_excerpt"],
      },
      covered_source_identities: ["src_east_bank_review_archive"],
      grant_identity: "fixture-quote-v1",
      grantor: "The Desk synthetic fixture author",
      paraphrase_permission: true,
      provider_exposure: {
        external_providers: false,
        fixture_stub:
          "rights-safe refs and permitted bounded consumer representations only",
        fixture_tts: "approved final spoken text only",
      },
      quotation_permission: true,
      retention: {
        canonical_source_bytes: "durable_offline_test_retention",
        policy_version: "synthetic-fixture-retention-v1",
        purge_behavior:
          "retain permitted tombstone metadata; no replacement bytes",
      },
      synthetic_grant: true,
    },
    rights_version_id: "d1250006-0000-4000-8000-000000000006",
    source_identity: "fixture-grant:fixture-quote-v1",
  },
  {
    created_at: "2026-09-27T12:30:00Z",
    policy: {
      acquisition_permission: true,
      attribution: {
        exact_source_credit_refs: ["src_fixture_market"],
        required_for_spoken_reporting: false,
        supporter_identity_minimization: true,
      },
      consumer_exposure_ceiling: {
        auditor: ["claim_only"],
        planner: ["claim_only"],
        writer: ["hidden"],
      },
      covered_source_identities: ["src_fixture_market"],
      grant_identity: "fixture-market-v1",
      grantor: "The Desk synthetic fixture author",
      paraphrase_permission: false,
      provider_exposure: {
        external_providers: false,
        fixture_stub:
          "rights-safe refs and permitted bounded consumer representations only",
        fixture_tts: "approved final spoken text only",
      },
      quotation_permission: false,
      retention: {
        canonical_source_bytes: "durable_offline_test_retention",
        policy_version: "synthetic-fixture-retention-v1",
        purge_behavior:
          "retain permitted tombstone metadata; no replacement bytes",
      },
      synthetic_grant: true,
    },
    rights_version_id: "d1250006-0000-4000-8000-000000000003",
    source_identity: "fixture-grant:fixture-market-v1",
  },
  {
    created_at: "2026-09-27T12:30:00Z",
    policy: {
      acquisition_permission: true,
      attribution: {
        exact_source_credit_refs: ["src_malicious_fixture"],
        required_for_spoken_reporting: false,
        supporter_identity_minimization: true,
      },
      consumer_exposure_ceiling: {
        auditor: ["exact_excerpt"],
        planner: ["hidden"],
        writer: ["hidden"],
      },
      covered_source_identities: ["src_malicious_fixture"],
      grant_identity: "fixture-audit-only-v1",
      grantor: "The Desk synthetic fixture author",
      paraphrase_permission: false,
      provider_exposure: {
        external_providers: false,
        fixture_stub:
          "rights-safe refs and permitted bounded consumer representations only",
        fixture_tts: "approved final spoken text only",
      },
      quotation_permission: false,
      retention: {
        canonical_source_bytes: "durable_offline_test_retention",
        policy_version: "synthetic-fixture-retention-v1",
        purge_behavior:
          "retain permitted tombstone metadata; no replacement bytes",
      },
      synthetic_grant: true,
    },
    rights_version_id: "d1250006-0000-4000-8000-000000000001",
    source_identity: "fixture-grant:fixture-audit-only-v1",
  },
];
const OUTPUT_SHAPE = {
  assurance: "s",
  binding: {
    brief_identity: {
      sha256: "s",
      utf8_bytes: "s",
    },
    budget_profile: "s",
    planner_identity: {
      sha256: "s",
      utf8_bytes: "s",
    },
    policy_sources: [
      {
        path: "s",
        sha256: "s",
        utf8_bytes: "s",
        version: "s",
      },
      {
        path: "s",
        sha256: "s",
        utf8_bytes: "s",
        version: "s",
      },
      {
        path: "s",
        sha256: "s",
        utf8_bytes: "s",
        version: "s",
      },
      {
        path: "s",
        sha256: "s",
        utf8_bytes: "s",
        version: "s",
      },
      {
        path: "s",
        sha256: "s",
        utf8_bytes: "s",
        version: "s",
      },
    ],
    representation_registry: {
      sha256: "s",
      utf8_bytes: "s",
    },
    source_observations: [
      {
        member: "s",
        role: "s",
        sha256: "s",
        utf8_bytes: "s",
      },
      {
        member: "s",
        role: "s",
        sha256: "s",
        utf8_bytes: "s",
      },
      {
        member: "s",
        role: "s",
        sha256: "s",
        utf8_bytes: "s",
      },
      {
        member: "s",
        role: "s",
        sha256: "s",
        utf8_bytes: "s",
      },
      {
        member: "s",
        role: "s",
        sha256: "s",
        utf8_bytes: "s",
      },
      {
        member: "s",
        role: "s",
        sha256: "s",
        utf8_bytes: "s",
      },
      {
        member: "s",
        role: "s",
        sha256: "s",
        utf8_bytes: "s",
      },
      {
        member: "s",
        role: "s",
        sha256: "s",
        utf8_bytes: "s",
      },
      {
        member: "s",
        role: "s",
        sha256: "s",
        utf8_bytes: "s",
      },
      {
        member: "s",
        role: "s",
        sha256: "s",
        utf8_bytes: "s",
      },
      {
        member: "s",
        role: "s",
        sha256: "s",
        utf8_bytes: "s",
      },
    ],
  },
  identities: {
    writer_context_sha256: "s",
    writer_data: {
      sha256: "s",
      utf8_bytes: "s",
    },
    writer_view_sha256: "s",
  },
  limits: ["s", "s", "s", "s", "s", "s", "s"],
  schema: "s",
  writer_context_manifest: {
    completeness_check: {
      exclusions_applied_count: 0,
      forbidden_refs_serialized_to_writer: false,
      missing_refs: [],
      status: "s",
    },
    estimated_input_tokens: 0,
    model_context_limit: 0,
    required_character_refs: ["s", "s", "s"],
    required_claim_refs: ["s", "s", "s", "s", "s", "s", "s", "s"],
    required_component_refs: ["s", "s"],
    required_comprehension_target_refs: ["s"],
    required_context_selection_refs: ["s", "s", "s"],
    required_policy_refs: ["s", "s", "s", "s"],
    reserved_output_tokens: 0,
    serialized_input_hash: "s",
  },
  writer_data: {
    brief_hash: "s",
    character_profile_versions: {
      gaz: "s",
      simon: "s",
      tully: "s",
    },
    compact_writing_standard: {
      principles: ["s", "s", "s", "s", "s", "s", "s", "s", "s", "s"],
      version: "s",
    },
    comprehension_targets: [
      {
        closing_synthesis_candidate: false,
        comprehension_target_id: "s",
        forward_horizon: "s",
        listener_question: "s",
        priority: "s",
        related_beat_ids: ["s", "s"],
        supporting_claim_refs: ["s", "s", "s", "s", "s"],
        useful_treatment_lenses: ["s", "s", "s", "s"],
      },
    ],
    context_selections: [
      {
        context_id: "s",
        context_selection_id: "s",
        function: "s",
        program_block_id: "s",
      },
      {
        context_id: "s",
        context_selection_id: "s",
        function: "s",
        program_block_id: "s",
      },
      {
        context_id: "s",
        context_selection_id: "s",
        function: "s",
        program_block_id: "s",
      },
    ],
    evidence_package_id: "s",
    live_search: false,
    locale: "s",
    package_hash: "s",
    program_block_refs: ["s", "s", "s", "s", "s", "s", "s", "s", "s"],
    purpose: "s",
    recent_pattern_signals: {
      disagreement_shape: ["s"],
      ending_shape: ["s", "s"],
      feature_usage: ["s"],
    },
    runtime_and_block_budgets: {
      purpose: "s",
      seconds: 0,
    },
    selected_claims: [
      {
        approved_representation: "s",
        attribution_requirement: {
          required: false,
        },
        claim_content_hash: "s",
        claim_id: "s",
        effective_usage_class: "s",
        frozen_state: "s",
        frozen_state_hash: "s",
        kind: "s",
        origin: "s",
        predicate: "s",
        subject_domain: "s",
        subject_ref: "s",
        support_refs: [
          {
            ref: "s",
            role: "s",
            type: "s",
          },
        ],
        value: {
          northbridge_goals: 0,
          southbank_goals: 0,
        },
        value_status: "s",
        value_type: "s",
      },
      {
        approved_representation: "s",
        attribution_requirement: {
          required: false,
        },
        claim_content_hash: "s",
        claim_id: "s",
        effective_usage_class: "s",
        frozen_state: "s",
        frozen_state_hash: "s",
        kind: "s",
        origin: "s",
        predicate: "s",
        subject_domain: "s",
        subject_ref: "s",
        support_refs: [
          {
            ref: "s",
            role: "s",
            type: "s",
          },
        ],
        value: {
          scalar: "s",
          unit: "s",
        },
        value_status: "s",
        value_type: "s",
      },
      {
        approved_representation: "s",
        attribution_requirement: {
          required: false,
        },
        claim_content_hash: "s",
        claim_id: "s",
        effective_usage_class: "s",
        frozen_state: "s",
        frozen_state_hash: "s",
        kind: "s",
        origin: "s",
        predicate: "s",
        subject_domain: "s",
        subject_ref: "s",
        support_refs: [
          {
            ref: "s",
            role: "s",
            type: "s",
          },
        ],
        value: {
          after_minute: 0,
          count: 0,
          sample_size: 0,
        },
        value_status: "s",
        value_type: "s",
      },
      {
        approved_representation: "s",
        attribution_requirement: {
          approved_prefix: "s",
          required: false,
          source_id: "s",
        },
        claim_content_hash: "s",
        claim_id: "s",
        effective_usage_class: "s",
        frozen_state: "s",
        frozen_state_hash: "s",
        kind: "s",
        origin: "s",
        predicate: "s",
        subject_domain: "s",
        subject_ref: "s",
        support_refs: [
          {
            ref: "s",
            role: "s",
            type: "s",
          },
        ],
        value: null,
        value_status: "s",
        value_type: "s",
      },
      {
        approved_representation: "s",
        attribution_requirement: {
          approved_prefix: "s",
          required: false,
          source_id: "s",
        },
        claim_content_hash: "s",
        claim_id: "s",
        effective_usage_class: "s",
        frozen_state: "s",
        frozen_state_hash: "s",
        kind: "s",
        origin: "s",
        predicate: "s",
        subject_domain: "s",
        subject_ref: "s",
        support_refs: [
          {
            ref: "s",
            role: "s",
            type: "s",
          },
        ],
        value: null,
        value_status: "s",
        value_type: "s",
      },
      {
        approved_representation: "s",
        attribution_requirement: {
          approved_prefix: "s",
          required: false,
          source_id: "s",
        },
        claim_content_hash: "s",
        claim_id: "s",
        effective_usage_class: "s",
        frozen_state: "s",
        frozen_state_hash: "s",
        kind: "s",
        origin: "s",
        predicate: "s",
        subject_domain: "s",
        subject_ref: "s",
        support_refs: [
          {
            ref: "s",
            role: "s",
            type: "s",
          },
        ],
        value: {
          direction: "s",
          observation_count: 0,
        },
        value_status: "s",
        value_type: "s",
      },
      {
        approved_representation: "s",
        attribution_requirement: {
          required: false,
        },
        claim_content_hash: "s",
        claim_id: "s",
        effective_usage_class: "s",
        frozen_state: "s",
        frozen_state_hash: "s",
        kind: "s",
        origin: "s",
        predicate: "s",
        subject_domain: "s",
        subject_ref: "s",
        support_refs: [
          {
            ref: "s",
            role: "s",
            type: "s",
          },
        ],
        value: {
          attested_since_year: 0,
          phrase: "s",
        },
        value_status: "s",
        value_type: "s",
      },
      {
        approved_representation: "s",
        attribution_requirement: {
          required: false,
        },
        claim_content_hash: "s",
        claim_id: "s",
        effective_usage_class: "s",
        frozen_state: "s",
        frozen_state_hash: "s",
        kind: "s",
        origin: "s",
        predicate: "s",
        subject_domain: "s",
        subject_ref: "s",
        support_refs: [
          {
            ref: "s",
            role: "s",
            type: "s",
          },
        ],
        value: {
          position: "s",
          topic_thread_id: "s",
        },
        value_status: "s",
        value_type: "s",
      },
    ],
    selected_evidence: [
      {
        authorized_representation: "s",
        consumer_exposure: {
          writer: "s",
        },
        content_hash: "s",
        evidence_type: "s",
        evidence_unit_id: "s",
        locator: {
          ref: "s",
          type: "s",
        },
        modality: "s",
        origin: "s",
        paraphrase_permission: false,
        quote_permission: false,
        rights_policy_version: "s",
        source_role: "s",
      },
      {
        authorized_representation: "s",
        consumer_exposure: {
          writer: "s",
        },
        content_hash: "s",
        evidence_type: "s",
        evidence_unit_id: "s",
        locator: {
          ref: "s",
          type: "s",
        },
        modality: "s",
        origin: "s",
        paraphrase_permission: false,
        quote_permission: false,
        rights_policy_version: "s",
        source_role: "s",
      },
      {
        authorized_representation: "s",
        consumer_exposure: {
          writer: "s",
        },
        content_hash: "s",
        evidence_type: "s",
        evidence_unit_id: "s",
        locator: {
          ref: "s",
          type: "s",
        },
        modality: "s",
        origin: "s",
        paraphrase_permission: false,
        quote_permission: false,
        rights_policy_version: "s",
        source_role: "s",
      },
    ],
    show_version: "s",
    showrunner_brief_version_id: "s",
    writing_craft_policy_version: "s",
    writing_policy_version: "s",
  },
};
const PARENT_NODES = [
  { a: "s" },
  { a: "b" },
  { a: "i" },
  { r: { bytes: 2, member: 0, role: 0, sha256: 0 } },
  { t: [3, 3, 3, 3, 3, 3, 3, 3, 3] },
  {
    r: {
      active_load_member: 0,
      active_load_rows: 2,
      container_observation: 0,
      fixture_version: 0,
      pack_members_sha256_anchor: 0,
      selected_member_binding: 0,
      selected_members: 4,
      zip_sha256_anchor: 0,
    },
  },
  { r: { bytes: 2, sha256: 0 } },
  { t: [0, 0, 0, 0, 0, 0, 0, 0] },
  {
    r: {
      assurance: 0,
      input_identity: 6,
      limits: 7,
      material_text_identity: 6,
      materialization: 0,
      package_text_identity: 6,
      profile: 0,
      view_canonical_identity: 6,
      view_domain_sha256: 0,
    },
  },
  {
    r: {
      autonomous_operation_policy: 0,
      claims_policy: 0,
      direction_spec: 0,
      evidence_package_spec: 0,
      hashing_contract: 0,
      operator_repair_policy: 0,
      planning_policy: 0,
      writing_craft_policy: 0,
      writing_fixture_profile_addendum: 0,
      writing_policy: 0,
    },
  },
  { r: { id: 0, job: 0, owner: 0 } },
  { t: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
  { r: { registry_version: 0, values: 11 } },
  { r: { description: 0, id: 0 } },
  { t: [13, 13, 13] },
  { r: { registry_version: 0, values: 14 } },
  {
    r: {
      character_bible_version: 0,
      participant_id: 0,
      participant_profile_version_id: 0,
      role: 0,
    },
  },
  {
    r: {
      character_bible_version: 0,
      collective_membership_language: 1,
      participant_id: 0,
      participant_profile_version_id: 0,
      role: 0,
    },
  },
  { t: [16, 16, 17] },
  { r: { profile_set_version: 0, profiles: 18 } },
  { r: { slot: 0, target_words: 2 } },
  { t: [0, 0, 0] },
  { r: { placement: 21, target_words: 2 } },
  {
    r: {
      a_small_request: 20,
      character_ritual_max_per_episode: 2,
      geek_of_the_week: 20,
      no_trigger_means_no_feature: 1,
      receipts: 22,
      sport_court: 20,
    },
  },
  {
    r: {
      big_minutes: 2,
      fixture_override_allowed: 1,
      quiet_minutes: 2,
      standard_minutes: 2,
    },
  },
  {
    r: {
      block_type: 0,
      job: 0,
      required: 1,
      sequence: 2,
      slot_id: 0,
      target_words_standard: 2,
    },
  },
  { t: [25, 25, 25, 25, 25, 25, 25, 25, 25, 25] },
  { r: { assembly_asset: 1, placement: 0, program_block: 1 } },
  { r: { sting: 27 } },
  {
    r: {
      feature_rules: 23,
      mode: 0,
      rundown_template_version_id: 0,
      runtime: 24,
      slots: 26,
      source_migration: 0,
      static_audio: 28,
      status: 0,
    },
  },
  { r: { max: 2, min: 2, purpose: 0 } },
  { r: { purpose: 0, seconds: 2 } },
  {
    r: {
      live_search: 1,
      mode_id: 0,
      publication_enabled: 1,
      rundown_template_version_id: 0,
      runtime_band: 30,
      runtime_target: 31,
    },
  },
  { r: { fixture_override: 1, max: 2, min: 2 } },
  {
    r: {
      autonomous_operation_policy_version: 0,
      configured_runtime_seconds: 33,
      default_episode_mode: 0,
      default_output_language: 0,
      default_rundown_template_version_id: 0,
      name: 0,
      operator_repair_policy_version: 0,
      pre_publish_review_policy: 0,
      pre_publish_review_required: 1,
      pre_publish_review_timeout_seconds: 2,
      publication_enabled: 1,
      show_id: 0,
      show_version: 0,
      writing_craft_policy_version: 0,
    },
  },
  {
    r: {
      canonical_payload: 34,
      config_hash: 0,
      created_at: 0,
      parent_version_id: 0,
      pre_publish_review_required: 1,
      schema_version: 0,
      show_config_version_id: 0,
      show_id: 0,
      version_number: 2,
    },
  },
  {
    r: {
      block_type_registry: 12,
      episode_mode_registry: 15,
      participant_profiles: 19,
      rundown_template: 29,
      selection: 32,
      show_config_version: 35,
    },
  },
  { r: { approved_prefix: 0, required: 1, source_id: 0 } },
  {
    r: {
      attribution_requirement: 37,
      consumer: 0,
      representation_id: 0,
      representation_kind: 0,
      rights_version_id: 0,
      source_content_hash: 0,
      source_evidence_unit_id: 0,
      source_identity: 0,
      target_hash: 0,
      target_id: 0,
      target_kind: 0,
      text: 0,
      text_sha256: 0,
      usage_class: 0,
      use_boundary: 0,
    },
  },
  { r: { required: 1, source_id: 0 } },
  {
    r: {
      attribution_requirement: 39,
      consumer: 0,
      representation_id: 0,
      representation_kind: 0,
      rights_version_id: 0,
      source_content_hash: 0,
      source_evidence_unit_id: 0,
      source_identity: 0,
      target_hash: 0,
      target_id: 0,
      target_kind: 0,
      text: 0,
      text_sha256: 0,
      usage_class: 0,
      use_boundary: 0,
    },
  },
  { t: [38, 38, 40, 40, 40, 40, 40, 40] },
  { r: { state: 0 } },
  { r: { reason: 0, state: 0 } },
  { r: { observation_count: 2, state: 0 } },
  {
    r: {
      continuity: 42,
      historical_context: 42,
      independent_analysis: 42,
      licensed_tracking_data: 43,
      serious_incident: 43,
      structured_stats: 42,
      supporter_evidence: 44,
      verified_result: 42,
    },
  },
  { t: [0, 0, 0, 0, 0] },
  {
    r: {
      beat_id: 0,
      candidate_selection_score: 0,
      label: 0,
      member_claim_refs: 46,
    },
  },
  {
    r: {
      beat_id: 0,
      candidate_selection_score: 0,
      label: 0,
      member_claim_refs: 21,
    },
  },
  { t: [0] },
  {
    r: {
      beat_id: 0,
      candidate_selection_score: 0,
      label: 0,
      member_claim_refs: 49,
    },
  },
  { t: [47, 48, 50] },
  { r: { required: 1 } },
  { a: "n" },
  {
    r: {
      claim_support_id: 0,
      derivation_run_id: 53,
      evidence_unit_id: 0,
      external_support_identity: 53,
      support_hash: 0,
      support_kind: 0,
      support_role: 0,
    },
  },
  { t: [54] },
  {
    r: {
      attribution_requirement: 52,
      claim_content_hash: 0,
      claim_id: 0,
      effective_usage_class: 0,
      frozen_state: 0,
      frozen_state_hash: 0,
      initial_status: 0,
      initial_usage_class: 0,
      kind: 0,
      origin: 0,
      predicate: 0,
      reduced_usage_class: 0,
      state_event_cursor: 53,
      subject_domain: 0,
      subject_ref: 0,
      support_refs: 55,
      value_type: 0,
    },
  },
  { r: { northbridge_goals: 2, southbank_goals: 2 } },
  {
    r: {
      consumption: 0,
      snapshot: 56,
      statement: 53,
      value: 57,
      value_status: 0,
    },
  },
  { r: { scalar: 0, unit: 0 } },
  {
    r: {
      consumption: 0,
      snapshot: 56,
      statement: 53,
      value: 59,
      value_status: 0,
    },
  },
  {
    r: {
      attribution_requirement: 37,
      claim_content_hash: 0,
      claim_id: 0,
      effective_usage_class: 0,
      frozen_state: 0,
      frozen_state_hash: 0,
      initial_status: 0,
      initial_usage_class: 0,
      kind: 0,
      origin: 0,
      predicate: 0,
      reduced_usage_class: 0,
      state_event_cursor: 53,
      subject_domain: 0,
      subject_ref: 0,
      support_refs: 55,
      value_type: 0,
    },
  },
  { r: { kind: 0, representation_id: 0, text: 0 } },
  {
    r: {
      consumption: 0,
      snapshot: 61,
      statement: 62,
      value: 53,
      value_status: 0,
    },
  },
  {
    r: {
      claim_support_id: 0,
      derivation_run_id: 53,
      evidence_unit_id: 53,
      external_support_identity: 0,
      support_hash: 0,
      support_kind: 0,
      support_role: 0,
    },
  },
  { t: [64] },
  {
    r: {
      attribution_requirement: 37,
      claim_content_hash: 0,
      claim_id: 0,
      effective_usage_class: 0,
      frozen_state: 0,
      frozen_state_hash: 0,
      initial_status: 0,
      initial_usage_class: 0,
      kind: 0,
      origin: 0,
      predicate: 0,
      reduced_usage_class: 0,
      state_event_cursor: 53,
      subject_domain: 0,
      subject_ref: 0,
      support_refs: 65,
      value_type: 0,
    },
  },
  { r: { direction: 0, observation_count: 2 } },
  {
    r: {
      consumption: 0,
      snapshot: 66,
      statement: 53,
      value: 67,
      value_status: 0,
    },
  },
  { r: { attested_since_year: 2, phrase: 0 } },
  {
    r: {
      consumption: 0,
      snapshot: 56,
      statement: 53,
      value: 69,
      value_status: 0,
    },
  },
  {
    r: {
      claim_support_id: 0,
      derivation_run_id: 0,
      evidence_unit_id: 53,
      external_support_identity: 53,
      support_hash: 0,
      support_kind: 0,
      support_role: 0,
    },
  },
  { t: [71] },
  {
    r: {
      attribution_requirement: 52,
      claim_content_hash: 0,
      claim_id: 0,
      effective_usage_class: 0,
      frozen_state: 0,
      frozen_state_hash: 0,
      initial_status: 0,
      initial_usage_class: 0,
      kind: 0,
      origin: 0,
      predicate: 0,
      reduced_usage_class: 0,
      state_event_cursor: 53,
      subject_domain: 0,
      subject_ref: 0,
      support_refs: 72,
      value_type: 0,
    },
  },
  { r: { after_minute: 2, count: 2, sample_size: 2 } },
  {
    r: {
      consumption: 0,
      snapshot: 73,
      statement: 53,
      value: 74,
      value_status: 0,
    },
  },
  {
    r: {
      attribution_requirement: 52,
      claim_content_hash: 0,
      claim_id: 0,
      effective_usage_class: 0,
      frozen_state: 0,
      frozen_state_hash: 0,
      initial_status: 0,
      initial_usage_class: 0,
      kind: 0,
      origin: 0,
      predicate: 0,
      reduced_usage_class: 0,
      state_event_cursor: 53,
      subject_domain: 0,
      subject_ref: 0,
      support_refs: 65,
      value_type: 0,
    },
  },
  { r: { position: 0, topic_thread_id: 0 } },
  {
    r: {
      consumption: 0,
      snapshot: 76,
      statement: 53,
      value: 77,
      value_status: 0,
    },
  },
  { t: [58, 60, 63, 63, 68, 70, 75, 60, 78] },
  { t: [0, 0] },
  { r: { claim_id: 0, context_id: 0, functions: 80, reason: 0 } },
  { r: { claim_id: 0, context_id: 0, functions: 49, reason: 0 } },
  { t: [81, 82, 82] },
  {
    r: {
      continuity_id: 0,
      published_only: 1,
      topic_thread_id: 0,
      withdrawn: 1,
    },
  },
  { t: [84] },
  { r: { condition: 0, state: 0 } },
  { t: [86, 86, 86] },
  { r: { auditor: 0, planner: 0, writer: 0 } },
  {
    r: {
      body_codepoint_end: 2,
      body_codepoint_start: 2,
      evidence_unit_id: 0,
      kind: 0,
      member: 0,
    },
  },
  {
    r: {
      acquisition_ref: 0,
      as_of: 0,
      competition_identity: 0,
      consumer_exposure: 88,
      content_hash: 0,
      entity_identity: 0,
      event_identity: 0,
      evidence_type: 0,
      evidence_unit_id: 0,
      language: 0,
      locator: 89,
      modality: 0,
      origin: 0,
      paraphrase_permission: 1,
      quote_permission: 1,
      retention_class: 0,
      rights_policy_version: 0,
      rights_version_id: 0,
      source_identity: 0,
      source_item_identity: 0,
      source_modality: 0,
      source_role: 0,
      speaker_identity: 53,
    },
  },
  {
    r: {
      claim_representation_refs: 49,
      representation: 53,
      representation_status: 0,
      snapshot: 90,
    },
  },
  {
    r: {
      claim_representation_refs: 49,
      representation: 62,
      representation_status: 0,
      snapshot: 90,
    },
  },
  { t: [] },
  {
    r: {
      acquisition_ref: 0,
      as_of: 0,
      competition_identity: 0,
      consumer_exposure: 88,
      content_hash: 0,
      entity_identity: 0,
      event_identity: 0,
      evidence_type: 0,
      evidence_unit_id: 0,
      language: 0,
      locator: 89,
      modality: 0,
      origin: 0,
      paraphrase_permission: 1,
      quote_permission: 1,
      retention_class: 0,
      rights_policy_version: 0,
      rights_version_id: 0,
      source_identity: 0,
      source_item_identity: 0,
      source_modality: 0,
      source_role: 0,
      speaker_identity: 0,
    },
  },
  {
    r: {
      claim_representation_refs: 93,
      representation: 62,
      representation_status: 0,
      snapshot: 94,
    },
  },
  { r: { kind: 0, span_end: 2, span_start: 2, text: 0 } },
  {
    r: {
      acquisition_ref: 0,
      as_of: 0,
      competition_identity: 0,
      consumer_exposure: 88,
      content_hash: 0,
      entity_identity: 0,
      event_identity: 53,
      evidence_type: 0,
      evidence_unit_id: 0,
      language: 0,
      locator: 89,
      modality: 0,
      origin: 0,
      paraphrase_permission: 1,
      quote_permission: 1,
      retention_class: 0,
      rights_policy_version: 0,
      rights_version_id: 0,
      source_identity: 0,
      source_item_identity: 0,
      source_modality: 0,
      source_role: 0,
      speaker_identity: 53,
    },
  },
  {
    r: {
      claim_representation_refs: 49,
      representation: 96,
      representation_status: 0,
      snapshot: 97,
    },
  },
  {
    r: {
      claim_representation_refs: 93,
      representation: 53,
      representation_status: 0,
      snapshot: 90,
    },
  },
  { t: [91, 91, 92, 92, 95, 95, 95, 95, 98, 91, 99, 99, 99, 99, 99] },
  {
    r: {
      competition_ids: 49,
      entity_ids: 49,
      event_ids: 49,
      locale: 0,
      scheduled_default_mode: 0,
      scope_type: 0,
      show_id: 0,
      target_publication_slot_ref: 0,
    },
  },
  {
    r: {
      competition_identity: 0,
      completed_at: 0,
      completion_status: 0,
      event_identity: 0,
      participant_entities: 80,
    },
  },
  {
    r: {
      competition_identity: 0,
      completed_at: 0,
      completion_status: 0,
      entity_identity: 0,
      event_identity: 0,
      rank_before_current_event: 2,
    },
  },
  { t: [103, 103, 103, 103, 103, 103] },
  {
    r: {
      as_of: 0,
      competition_identity: 0,
      complete_prior_schedule_assertion: 1,
      current_event: 102,
      current_event_identity: 0,
      entity_identity: 0,
      ordered_prior_schedule: 104,
      schedule_scope: 0,
      selected_event_identities: 46,
      selection_rule: 0,
      source_identity: 0,
      source_record_ref: 0,
      synthetic: 1,
      window_identity: 0,
    },
  },
  {
    r: {
      context_retrieval_version: 0,
      live_search: 1,
      match_window_proof: 105,
      operator: 0,
      selector_version: 0,
    },
  },
  { r: { applies_to: 0, note: 0, sensitivity_id: 0, state: 0 } },
  { t: [107] },
  { r: { ref: 0, signal_id: 0, type: 0 } },
  { t: [109, 109] },
  {
    r: {
      allowed_consumers: 80,
      claim_id: 0,
      effective_usage_class: 0,
      purpose: 0,
      support_refs: 49,
    },
  },
  { t: [111] },
  { r: { display_name: 0, source_id: 0, source_role: 0 } },
  { t: [113, 113, 113] },
  {
    r: {
      claims_policy: 0,
      evidence_package_spec: 0,
      lens_definition: 0,
      rights_registry: 0,
      show_version: 0,
    },
  },
  {
    r: {
      availability: 45,
      beats: 51,
      claims: 79,
      context_candidates: 83,
      continuity: 85,
      coverage_conditions: 87,
      evidence: 100,
      package_hash: 0,
      package_id: 0,
      scope: 101,
      scope_hash: 0,
      selection_provenance: 106,
      sensitivities: 108,
      signals: 110,
      silent_inputs: 112,
      source_attribution: 114,
      version_refs: 115,
    },
  },
  {
    r: {
      assurance: 0,
      execution_permission: 1,
      fixture_binding: 5,
      inspection_dependency: 8,
      policy_reference_binding: 0,
      policy_source_hashes: 9,
      programming_configuration: 36,
      purpose: 0,
      representation_registry: 41,
      representation_registry_identity: 6,
      representation_registry_version: 0,
      schema: 0,
      use_boundary: 0,
      planner_data: 116,
    },
  },
  { t: [0, 0, 0, 0] },
  {
    r: {
      closing_synthesis_candidate: 1,
      comprehension_target_id: 0,
      forward_horizon: 0,
      listener_question: 0,
      priority: 0,
      related_beat_ids: 80,
      supporting_claim_refs: 46,
      useful_treatment_lenses: 118,
    },
  },
  { t: [119] },
  {
    r: {
      context_id: 0,
      context_selection_id: 0,
      function: 0,
      program_block_id: 0,
    },
  },
  { t: [121, 121, 121] },
  { r: { continuity_id: 0, instruction: 0 } },
  { t: [123] },
  { r: { state: 0, type: 0 } },
  { t: [125] },
  {
    r: {
      effect: 0,
      exclusion_id: 0,
      reason_code: 0,
      scope_ref: 0,
      scope_type: 0,
      source: 0,
    },
  },
  { t: [127, 127, 127] },
  { r: { job: 0, participant_id: 0 } },
  { t: [129, 129] },
  { r: { seconds: 2 } },
  {
    r: {
      block_type: 0,
      claim_evidence_assignments: 93,
      context_selection_ids: 93,
      job: 0,
      participant_leads: 130,
      primary_question: 53,
      program_block_id: 0,
      required_cautions: 93,
      selected_beat_ids: 93,
      sequence: 2,
      target_duration_or_words: 131,
      template_slot_id: 0,
      topic_thread_ids: 93,
      transition_goal: 0,
    },
  },
  { t: [129] },
  {
    r: {
      block_type: 0,
      claim_evidence_assignments: 93,
      context_selection_ids: 93,
      job: 0,
      participant_leads: 133,
      primary_question: 53,
      program_block_id: 0,
      required_cautions: 93,
      selected_beat_ids: 93,
      sequence: 2,
      target_duration_or_words: 131,
      template_slot_id: 0,
      topic_thread_ids: 93,
      transition_goal: 0,
    },
  },
  { r: { claim_ids: 21, participant_id: 0 } },
  { t: [135] },
  {
    r: {
      block_type: 0,
      claim_evidence_assignments: 136,
      context_selection_ids: 93,
      job: 0,
      participant_leads: 133,
      primary_question: 53,
      program_block_id: 0,
      required_cautions: 93,
      selected_beat_ids: 49,
      sequence: 2,
      target_duration_or_words: 131,
      template_slot_id: 0,
      topic_thread_ids: 49,
      transition_goal: 0,
    },
  },
  { r: { claim_ids: 80, participant_id: 0 } },
  { t: [138] },
  {
    r: {
      block_type: 0,
      claim_evidence_assignments: 139,
      context_selection_ids: 93,
      job: 0,
      participant_leads: 130,
      primary_question: 53,
      program_block_id: 0,
      required_cautions: 93,
      selected_beat_ids: 49,
      sequence: 2,
      target_duration_or_words: 131,
      template_slot_id: 0,
      topic_thread_ids: 49,
      transition_goal: 0,
    },
  },
  {
    r: {
      block_type: 0,
      claim_evidence_assignments: 93,
      context_selection_ids: 93,
      job: 0,
      participant_leads: 133,
      primary_question: 53,
      program_block_id: 0,
      required_cautions: 93,
      selected_beat_ids: 49,
      sequence: 2,
      target_duration_or_words: 131,
      template_slot_id: 0,
      topic_thread_ids: 49,
      transition_goal: 0,
    },
  },
  {
    r: {
      block_type: 0,
      claim_evidence_assignments: 136,
      context_selection_ids: 93,
      job: 0,
      participant_leads: 130,
      primary_question: 53,
      program_block_id: 0,
      required_cautions: 93,
      selected_beat_ids: 49,
      sequence: 2,
      target_duration_or_words: 131,
      template_slot_id: 0,
      topic_thread_ids: 49,
      transition_goal: 0,
    },
  },
  {
    r: {
      block_type: 0,
      claim_evidence_assignments: 139,
      context_selection_ids: 93,
      job: 0,
      participant_leads: 133,
      primary_question: 53,
      program_block_id: 0,
      required_cautions: 93,
      selected_beat_ids: 80,
      sequence: 2,
      target_duration_or_words: 131,
      template_slot_id: 0,
      topic_thread_ids: 49,
      transition_goal: 0,
    },
  },
  { r: { claim_ids: 49, participant_id: 0 } },
  { t: [144] },
  {
    r: {
      block_type: 0,
      claim_evidence_assignments: 145,
      context_selection_ids: 93,
      job: 0,
      participant_leads: 133,
      primary_question: 53,
      program_block_id: 0,
      required_cautions: 93,
      selected_beat_ids: 93,
      sequence: 2,
      target_duration_or_words: 131,
      template_slot_id: 0,
      topic_thread_ids: 93,
      transition_goal: 0,
    },
  },
  { t: [132, 134, 137, 140, 141, 142, 143, 132, 146] },
  { r: { type: 0 } },
  { r: { claim_id: 0, type: 0 } },
  { t: [148, 148, 149] },
  { r: { beat_id: 0, reason_code: 0, treatment: 0 } },
  { t: [151, 151] },
  { t: [0, 0, 0, 0, 0, 0] },
  { r: { block_ids: 153, notability: 0, topic_thread_id: 0 } },
  { t: [154] },
  {
    r: {
      artifact_id: 0,
      attempt_id: 0,
      brief_hash: 0,
      central_question: 0,
      comprehension_targets: 120,
      context_selections: 122,
      continuity_instructions: 124,
      created_at: 0,
      evidence_package_id: 0,
      feature_selections: 93,
      known_gaps: 126,
      orientation_job: 0,
      package_hash: 0,
      planner_model_run_id: 0,
      planning_exclusions: 128,
      planning_policy_version: 0,
      program_blocks: 147,
      program_run_id: 0,
      programming_constraints: 150,
      purpose: 0,
      revision_parent_id: 53,
      revision_reason: 53,
      rundown_template_version_id: 0,
      runtime_target: 31,
      selected_beats: 152,
      selected_mode: 0,
      show_version: 0,
      showrunner_brief_version_id: 0,
      topic_thread_mappings: 155,
    },
  },
  {
    r: {
      artifact_id: 0,
      artifact_type: 0,
      byte_size: 53,
      content_hash: 0,
      created_at: 0,
      parent_artifact_id: 53,
      schema_version: 0,
      storage_uri: 0,
      supersedes_artifact_id: 53,
    },
  },
  {
    r: {
      artifact_id: 0,
      attempt_id: 0,
      evidence_package_id: 0,
      revision_parent_id: 53,
      showrunner_brief_version_id: 0,
    },
  },
  {
    r: {
      attempt_id: 0,
      created_at: 0,
      evidence_package_id: 0,
      parent_attempt_id: 53,
      program_run_id: 0,
      publication_enabled: 1,
      repair_plan_id: 53,
      show_config_version_id: 0,
      state: 0,
    },
  },
  {
    r: {
      created_at: 0,
      program_run_id: 0,
      publication_enabled: 53,
      purpose: 0,
      show_config_version_id: 53,
      show_id: 0,
      state: 0,
    },
  },
  {
    r: {
      attempt_id: 0,
      created_at: 0,
      model_identifier: 0,
      model_run_id: 0,
      output_artifact_id: 0,
      prompt_manifest_id: 0,
      provider_call_id: 0,
      semantic_input_hash: 0,
    },
  },
  {
    r: {
      claims_policy: 0,
      evidence_package_spec: 0,
      fixture_prompt: 0,
      planning_policy: 0,
    },
  },
  { r: { claims_policy: 0, evidence_package_spec: 0, planning_policy: 0 } },
  {
    r: {
      artifact_id: 0,
      component_versions: 162,
      created_at: 0,
      policy_source_hashes: 163,
      prompt_manifest_id: 0,
      rendered_request_hash: 0,
    },
  },
  {
    r: {
      attempt_id: 0,
      intentional_take_index: 53,
      logical_request_key: 0,
      model_identifier: 0,
      operation: 0,
      operational_try_number: 2,
      provider: 0,
      provider_call_id: 0,
      request_fingerprint: 0,
      reroll_of_provider_call_id: 53,
      reroll_trigger_id: 53,
      retry_of_provider_call_id: 53,
      started_at: 0,
    },
  },
  { r: { external_provider_contacted: 1, fixture_execution: 1 } },
  {
    r: {
      actual_cost: 0,
      currency: 0,
      ended_at: 0,
      event_type: 0,
      provider_call_event_id: 0,
      provider_call_id: 0,
      response_artifact_id: 0,
      response_reference: 53,
      usage: 166,
    },
  },
  { r: { artifact_id: 0, evidence_package_id: 0, package_hash: 0 } },
  { r: { member: 0, specimen_key: 0, encoding: 0, rendered_request_hash: 0 } },
  { r: { domain: 0, sha256: 0 } },
  {
    r: {
      record_kind: 0,
      brief_artifact: 157,
      brief_version: 158,
      planning_attempt: 159,
      program_run: 160,
      model_run: 161,
      prompt_manifest: 164,
      provider_call: 165,
      provider_event: 167,
      package_version: 168,
      request_reference: 169,
      prompt_payload_identity: 170,
      semantic_input_identity: 170,
    },
  },
  { r: { member: 0, role: 0, utf8_bytes: 0, sha256: 0 } },
  { t: [172, 172, 172, 172, 172, 172, 172, 172] },
  { t: [0, 0, 0, 0, 0, 0, 0, 0, 0] },
  {
    r: {
      schema: 0,
      assurance: 0,
      brief: 156,
      provenance: 171,
      source_observations: 173,
      limits: 174,
    },
  },
  {
    r: {
      input_utf8_bytes: 0,
      input_sha256: 0,
      package_text_utf8_bytes: 0,
      package_text_sha256: 0,
    },
  },
  { r: { consumption: 0, snapshot: 56, value: 57, value_status: 0 } },
  { r: { consumption: 0, snapshot: 56, value: 59, value_status: 0 } },
  { r: { consumption: 0, snapshot: 61, value: 53, value_status: 0 } },
  { r: { consumption: 0, snapshot: 66, value: 67, value_status: 0 } },
  { r: { consumption: 0, snapshot: 56, value: 69, value_status: 0 } },
  { r: { consumption: 0, snapshot: 73, value: 74, value_status: 0 } },
  { r: { consumption: 0, snapshot: 76, value: 77, value_status: 0 } },
  { t: [177, 178, 179, 179, 180, 181, 182, 178, 183] },
  {
    r: {
      claim_representation_refs: 93,
      representation: 53,
      representation_status: 0,
      snapshot: 94,
    },
  },
  { t: [91, 91, 91, 91, 185, 185, 185, 185, 98, 91, 99, 99, 99, 99, 99] },
  {
    r: {
      content_hash: 0,
      evidence_unit_id: 0,
      planner_exposure: 0,
      rights_version_id: 0,
    },
  },
  {
    r: {
      claim_id: 0,
      claim_support_id: 0,
      inspection: 187,
      support_hash: 0,
      support_kind: 0,
      support_role: 0,
    },
  },
  { r: { confidence: 0, direction: 0, intensity: 0 } },
  { r: { evidence_unit_id: 0, member: 0 } },
  {
    r: {
      content_hash: 0,
      evidence_unit_id: 0,
      observation_order: 2,
      scoped_description_ref: 190,
      source_identity: 0,
    },
  },
  { t: [191, 191, 191, 191] },
  {
    r: {
      as_of: 0,
      authored_synthetic_interpretation: 189,
      entity_identity: 0,
      event_identity: 0,
      method_version: 0,
      observation_count: 2,
      observation_set_identity: 0,
      observations: 192,
    },
  },
  { r: { projection: 193, support_kind: 0 } },
  { r: { artifact_id: 0, canonical_payload: 194, content_hash: 0 } },
  {
    r: {
      claim_id: 0,
      claim_support_id: 0,
      inspection: 195,
      support_hash: 0,
      support_kind: 0,
      support_role: 0,
    },
  },
  { r: { canonical_source_bytes: 0, policy_version: 0, purge_behavior: 0 } },
  {
    r: {
      acquisition_ref: 0,
      as_of: 0,
      competition_identity: 0,
      consumer_exposure: 88,
      entity_identity: 0,
      event_completed_at: 0,
      event_identity: 0,
      evidence_unit_id: 0,
      language: 0,
      locator: 89,
      origin: 0,
      paraphrase_permission: 1,
      quote_permission: 1,
      retention_declaration: 197,
      rights_version_id: 0,
      source_identity: 0,
      source_item_identity: 0,
      source_modality: 0,
      source_role: 0,
      speaker_identity: 53,
      window_identity: 0,
      window_order: 2,
    },
  },
  {
    r: {
      content_hash: 0,
      evidence_unit_id: 0,
      selected_provenance: 198,
      window_proof: 105,
    },
  },
  { t: [199, 199, 199, 199, 199] },
  { r: { after_minute: 2, window_matches: 2 } },
  {
    r: {
      created_at: 0,
      derivation_run_id: 0,
      exact_input_refs: 200,
      output: 74,
      output_hash: 0,
      parameters: 201,
      rule_version: 0,
    },
  },
  {
    r: {
      claim_id: 0,
      claim_support_id: 0,
      inspection: 202,
      support_hash: 0,
      support_kind: 0,
      support_role: 0,
    },
  },
  {
    r: {
      exact_text: 0,
      occurrence_identity: 0,
      occurrence_time: 0,
      participant_identity: 0,
      position: 0,
      semantic_turn_ref: 0,
    },
  },
  {
    r: {
      attestation_identity: 0,
      attested_by: 0,
      published_at: 0,
      state: 0,
      synthetic: 1,
    },
  },
  {
    r: {
      external_episode_ref: 0,
      external_script_ref: 0,
      external_script_version_ref: 0,
      on_air_occurrence: 204,
      publication_attestation: 205,
      topic_thread_id: 0,
      withdrawn: 1,
    },
  },
  { r: { projection: 206, support_kind: 0 } },
  { r: { artifact_id: 0, canonical_payload: 207, content_hash: 0 } },
  {
    r: {
      claim_id: 0,
      claim_support_id: 0,
      inspection: 208,
      support_hash: 0,
      support_kind: 0,
      support_role: 0,
    },
  },
  { t: [188, 188, 188, 188, 196, 188, 203, 188, 209] },
  {
    r: {
      assurance: 0,
      availability: 45,
      beats: 51,
      claims: 184,
      context_candidates: 83,
      continuity: 85,
      coverage_conditions: 87,
      evidence: 186,
      limits: 7,
      materialization: 0,
      package_hash: 0,
      package_id: 0,
      schema: 0,
      scope: 101,
      scope_hash: 0,
      selection_provenance: 106,
      sensitivities: 108,
      signals: 110,
      silent_inputs: 112,
      source_attribution: 114,
      version_refs: 115,
      support_summaries: 210,
    },
  },
  {
    r: {
      kind: 0,
      profile: 0,
      observation: 176,
      view: 211,
      canonical_json: 0,
      view_sha256: 0,
    },
  },
];
const CONFIG_SHAPE = {
  block_type_registry: {
    registry_version: "s",
    values: [
      {
        id: "s",
        job: "s",
        owner: "s",
      },
      {
        id: "s",
        job: "s",
        owner: "s",
      },
      {
        id: "s",
        job: "s",
        owner: "s",
      },
      {
        id: "s",
        job: "s",
        owner: "s",
      },
      {
        id: "s",
        job: "s",
        owner: "s",
      },
      {
        id: "s",
        job: "s",
        owner: "s",
      },
      {
        id: "s",
        job: "s",
        owner: "s",
      },
      {
        id: "s",
        job: "s",
        owner: "s",
      },
      {
        id: "s",
        job: "s",
        owner: "s",
      },
      {
        id: "s",
        job: "s",
        owner: "s",
      },
    ],
  },
  episode_mode_registry: {
    registry_version: "s",
    values: [
      {
        description: "s",
        id: "s",
      },
      {
        description: "s",
        id: "s",
      },
      {
        description: "s",
        id: "s",
      },
    ],
  },
  participant_profiles: {
    profile_set_version: "s",
    profiles: [
      {
        character_bible_version: "s",
        participant_id: "s",
        participant_profile_version_id: "s",
        role: "s",
      },
      {
        character_bible_version: "s",
        participant_id: "s",
        participant_profile_version_id: "s",
        role: "s",
      },
      {
        character_bible_version: "s",
        collective_membership_language: false,
        participant_id: "s",
        participant_profile_version_id: "s",
        role: "s",
      },
    ],
  },
  rundown_template: {
    feature_rules: {
      a_small_request: {
        slot: "s",
        target_words: 0,
      },
      character_ritual_max_per_episode: 0,
      geek_of_the_week: {
        slot: "s",
        target_words: 0,
      },
      no_trigger_means_no_feature: false,
      receipts: {
        placement: ["s", "s", "s"],
        target_words: 0,
      },
      sport_court: {
        slot: "s",
        target_words: 0,
      },
    },
    mode: "s",
    rundown_template_version_id: "s",
    runtime: {
      big_minutes: 0,
      fixture_override_allowed: false,
      quiet_minutes: 0,
      standard_minutes: 0,
    },
    slots: [
      {
        block_type: "s",
        job: "s",
        required: false,
        sequence: 0,
        slot_id: "s",
        target_words_standard: 0,
      },
      {
        block_type: "s",
        job: "s",
        required: false,
        sequence: 0,
        slot_id: "s",
        target_words_standard: 0,
      },
      {
        block_type: "s",
        job: "s",
        required: false,
        sequence: 0,
        slot_id: "s",
        target_words_standard: 0,
      },
      {
        block_type: "s",
        job: "s",
        required: false,
        sequence: 0,
        slot_id: "s",
        target_words_standard: 0,
      },
      {
        block_type: "s",
        job: "s",
        required: false,
        sequence: 0,
        slot_id: "s",
        target_words_standard: 0,
      },
      {
        block_type: "s",
        job: "s",
        required: false,
        sequence: 0,
        slot_id: "s",
        target_words_standard: 0,
      },
      {
        block_type: "s",
        job: "s",
        required: false,
        sequence: 0,
        slot_id: "s",
        target_words_standard: 0,
      },
      {
        block_type: "s",
        job: "s",
        required: false,
        sequence: 0,
        slot_id: "s",
        target_words_standard: 0,
      },
      {
        block_type: "s",
        job: "s",
        required: false,
        sequence: 0,
        slot_id: "s",
        target_words_standard: 0,
      },
      {
        block_type: "s",
        job: "s",
        required: false,
        sequence: 0,
        slot_id: "s",
        target_words_standard: 0,
      },
    ],
    source_migration: "s",
    static_audio: {
      sting: {
        assembly_asset: false,
        placement: "s",
        program_block: false,
      },
    },
    status: "s",
  },
  selection: {
    live_search: false,
    mode_id: "s",
    publication_enabled: false,
    rundown_template_version_id: "s",
    runtime_band: {
      max: 0,
      min: 0,
      purpose: "s",
    },
    runtime_target: {
      purpose: "s",
      seconds: 0,
    },
  },
  show_config_version: {
    canonical_payload: {
      autonomous_operation_policy_version: "s",
      configured_runtime_seconds: {
        fixture_override: false,
        max: 0,
        min: 0,
      },
      default_episode_mode: "s",
      default_output_language: "s",
      default_rundown_template_version_id: "s",
      name: "s",
      operator_repair_policy_version: "s",
      pre_publish_review_policy: "s",
      pre_publish_review_required: false,
      pre_publish_review_timeout_seconds: 0,
      publication_enabled: false,
      show_id: "s",
      show_version: "s",
      writing_craft_policy_version: "s",
    },
    config_hash: "s",
    created_at: "s",
    parent_version_id: "s",
    pre_publish_review_required: false,
    schema_version: "s",
    show_config_version_id: "s",
    show_id: "s",
    version_number: 0,
  },
};
const PC2_REGISTRY_SHAPE = [
  {
    attribution_requirement: {
      approved_prefix: "s",
      required: false,
      source_id: "s",
    },
    consumer: "s",
    representation_id: "s",
    representation_kind: "s",
    rights_version_id: "s",
    source_content_hash: "s",
    source_evidence_unit_id: "s",
    source_identity: "s",
    target_hash: "s",
    target_id: "s",
    target_kind: "s",
    text: "s",
    text_sha256: "s",
    usage_class: "s",
    use_boundary: "s",
  },
  {
    attribution_requirement: {
      approved_prefix: "s",
      required: false,
      source_id: "s",
    },
    consumer: "s",
    representation_id: "s",
    representation_kind: "s",
    rights_version_id: "s",
    source_content_hash: "s",
    source_evidence_unit_id: "s",
    source_identity: "s",
    target_hash: "s",
    target_id: "s",
    target_kind: "s",
    text: "s",
    text_sha256: "s",
    usage_class: "s",
    use_boundary: "s",
  },
  {
    attribution_requirement: {
      required: false,
      source_id: "s",
    },
    consumer: "s",
    representation_id: "s",
    representation_kind: "s",
    rights_version_id: "s",
    source_content_hash: "s",
    source_evidence_unit_id: "s",
    source_identity: "s",
    target_hash: "s",
    target_id: "s",
    target_kind: "s",
    text: "s",
    text_sha256: "s",
    usage_class: "s",
    use_boundary: "s",
  },
  {
    attribution_requirement: {
      required: false,
      source_id: "s",
    },
    consumer: "s",
    representation_id: "s",
    representation_kind: "s",
    rights_version_id: "s",
    source_content_hash: "s",
    source_evidence_unit_id: "s",
    source_identity: "s",
    target_hash: "s",
    target_id: "s",
    target_kind: "s",
    text: "s",
    text_sha256: "s",
    usage_class: "s",
    use_boundary: "s",
  },
  {
    attribution_requirement: {
      required: false,
      source_id: "s",
    },
    consumer: "s",
    representation_id: "s",
    representation_kind: "s",
    rights_version_id: "s",
    source_content_hash: "s",
    source_evidence_unit_id: "s",
    source_identity: "s",
    target_hash: "s",
    target_id: "s",
    target_kind: "s",
    text: "s",
    text_sha256: "s",
    usage_class: "s",
    use_boundary: "s",
  },
  {
    attribution_requirement: {
      required: false,
      source_id: "s",
    },
    consumer: "s",
    representation_id: "s",
    representation_kind: "s",
    rights_version_id: "s",
    source_content_hash: "s",
    source_evidence_unit_id: "s",
    source_identity: "s",
    target_hash: "s",
    target_id: "s",
    target_kind: "s",
    text: "s",
    text_sha256: "s",
    usage_class: "s",
    use_boundary: "s",
  },
  {
    attribution_requirement: {
      required: false,
      source_id: "s",
    },
    consumer: "s",
    representation_id: "s",
    representation_kind: "s",
    rights_version_id: "s",
    source_content_hash: "s",
    source_evidence_unit_id: "s",
    source_identity: "s",
    target_hash: "s",
    target_id: "s",
    target_kind: "s",
    text: "s",
    text_sha256: "s",
    usage_class: "s",
    use_boundary: "s",
  },
  {
    attribution_requirement: {
      required: false,
      source_id: "s",
    },
    consumer: "s",
    representation_id: "s",
    representation_kind: "s",
    rights_version_id: "s",
    source_content_hash: "s",
    source_evidence_unit_id: "s",
    source_identity: "s",
    target_hash: "s",
    target_id: "s",
    target_kind: "s",
    text: "s",
    text_sha256: "s",
    usage_class: "s",
    use_boundary: "s",
  },
];
const AUXILIARY_CANONICAL = [
  {
    member: "evidence_package.json",
    raw_bytes: 54034,
    raw_sha256:
      "bd9f5ff68156d6c03184c0e6d2f1acccc35bbb0c0223ab4ab611fb9378ba05f9",
    canonical_bytes: 40713,
    canonical_sha256:
      "62a5d00b86a7bd3661ff2b2542fdd1f31051c981098f519aa0965747a1c51ee5",
  },
  {
    member: "config/policy_versions.json",
    raw_bytes: 5005,
    raw_sha256:
      "5d02892aeb53f8236e437a3728e383beb5d0534c85760072ea5c3a32e36c6b18",
    canonical_bytes: 4496,
    canonical_sha256:
      "8ae4ad4cbdf5d0706f8bb666517e9cb0eb922a173478b18d363bdf9fc2ae179b",
  },
  {
    member: "config/participant_profiles.json",
    raw_bytes: 635,
    raw_sha256:
      "86fc33c6c4d9bb6c1226f4774815341716a677d8a04bfacea997658087440b61",
    canonical_bytes: 488,
    canonical_sha256:
      "63947c0fbae7fd51c87eda27edcce475a2bfcd06ebb2f922994cca14fb9e5080",
  },
  {
    member: "config/show_config_version.json",
    raw_bytes: 1188,
    raw_sha256:
      "2024e994b1fb6d772f04dd604d589fd2155015197591f9505ebd9ab0e646b5a7",
    canonical_bytes: 1034,
    canonical_sha256:
      "d3844d9305b982e836fd0f85bc9a2aa2391ec74d53a0f2bbf7d2968b6a3ec234",
  },
  {
    member: "config/rundown_template_post_event_launch_v2.json",
    raw_bytes: 3591,
    raw_sha256:
      "4c74bc6563680d907233921333a6528463ec5819a2375786ba77efbb15e3a9f6",
    canonical_bytes: 2752,
    canonical_sha256:
      "8108e9f3cec6ce54005ab70a7701ce63e7f94f22790c648e87fe1603c659e31a",
  },
  {
    member: "config/episode_modes.json",
    raw_bytes: 381,
    raw_sha256:
      "b03b3889cdc1b1facf4be77d76e2212d3d166f7e406c589aae8a9e8bf1d06586",
    canonical_bytes: 290,
    canonical_sha256:
      "db540f0b6b26a02bf2a8a202d97883ea50fe4e177fac818e6e8f13682da4ecf0",
  },
  {
    member: "config/block_types.json",
    raw_bytes: 1467,
    raw_sha256:
      "a6db53ee315437200bfadd76c988860512a9a36588e865dd8d78581c32dcfbb7",
    canonical_bytes: 1114,
    canonical_sha256:
      "bdb7f5c050f1f3c0cc9753741f1afaf9e648c0f0b61446ed6bce8fd845557ac7",
  },
  {
    member: "config/enum_registries.json",
    raw_bytes: 962,
    raw_sha256:
      "ba2d1ee8602b216d200cd5eec1cf1f20367e5a071f4509552d32afc47c64e4fd",
    canonical_bytes: 650,
    canonical_sha256:
      "2f187604b73e9ee2590ec6bad2479a448b250cfde05f8c2bcf15d34acb2d8e96",
  },
  {
    member: "support_payloads.json",
    raw_bytes: 3960,
    raw_sha256:
      "bb3fd40fc1ccbb182fc00fd42c04d67517163c8aa4f6ee23e774cb0c3da75d58",
    canonical_bytes: 2775,
    canonical_sha256:
      "e4eca5a55450d70d4bba90efb42df295a1a71a227ad184403358ef3df2b040d3",
  },
];
const PINS: FixturePins = {
  zipSha256: "7e1bb1108cdd84e47269b9ab2dab20ba934fcec64d44262f86d2b505616b0747",
  packMembersSha256:
    "58a3c5e6188a91eba380c4cb4c08fbebb747513b5979ca9b3b0baab61d5b84fe",
  familyCounts: {
    accounts: 2,
    artifacts: 36,
    assembly_recipes: 1,
    audio_artifacts: 12,
    audit_runs: 2,
    claim_state_events: 0,
    claim_supports: 9,
    claims: 9,
    derivation_runs: 1,
    evidence_packages: 1,
    evidence_units: 16,
    gate_definitions: 32,
    gate_results: 62,
    master_assembly_maps: 1,
    model_runs: 5,
    performance_direction_versions: 1,
    performance_intents: 8,
    program_blocks: 9,
    program_run_attempts: 2,
    program_runs: 2,
    prompt_manifests: 5,
    pronunciation_renderings: 3,
    pronunciations: 2,
    provider_call_events: 15,
    provider_calls: 15,
    render_blocks: 9,
    render_manifests: 1,
    render_takes: 10,
    reroll_triggers: 1,
    rights_versions: 7,
    script_versions: 3,
    show_config_versions: 2,
    showrunner_brief_versions: 1,
    shows: 1,
    take_selections: 10,
    turn_claim_uses: 36,
    turn_evidence_uses: 9,
    turns: 51,
    voice_profile_versions: 3,
    voice_profiles: 3,
  },
  totalRows: 398,
  artifactRows: 36,
  currentArtifactRows: 35,
  historicalDirection: {
    artifactId: "d1250005-0000-4000-8000-000000000012",
    contentHash:
      "ea5926e81267dd749cf33ed29564fe88815d3243b68260f1b4ddb96588e2f533",
  },
  activeLoadMember: "foundation_rows_398.json",
};

const FIXED_ROLES = [
  ["ARTIFACT_INVENTORY.json", "inventory"],
  ["README.md", "readme"],
  ["SOURCE_PROVENANCE.json", "inventory"],
  ["archive/ARCHIVE_ONLY_85.json", "archive_only_rows"],
  ["archive/HISTORICAL_DIRECTION_10.json", "historical_direction_rows"],
  ["archive/V2_ARCHIVED_283.json", "archive_only_rows"],
  ["archive/i2a_source/assembly_recipe.json", "archive_i2a_source"],
  ["archive/i2a_source/audit_result.json", "archive_i2a_source"],
  ["archive/i2a_source/config/show.json", "archive_i2a_source"],
  ["archive/i2a_source/deferred_hash_fields.json", "archive_i2a_source"],
  ["archive/i2a_source/evidence_package.json", "archive_i2a_source"],
  ["archive/i2a_source/evidence_store.json", "archive_i2a_source"],
  ["archive/i2a_source/foundation_rows.json", "archive_source_rows_396"],
  ["archive/i2a_source/master_assembly_map.json", "archive_i2a_source"],
  ["archive/i2a_source/mechanical_validation.json", "archive_i2a_source"],
  ["archive/i2a_source/performance_direction.json", "archive_i2a_source"],
  ["archive/i2a_source/prompt_payloads.json", "archive_i2a_source"],
  ["archive/i2a_source/pronunciations.json", "archive_i2a_source"],
  ["archive/i2a_source/ready_expectations.json", "archive_i2a_source"],
  ["archive/i2a_source/render_manifest.json", "archive_i2a_source"],
  ["archive/i2a_source/revalidation_result.json", "archive_i2a_source"],
  ["archive/i2a_source/revalidation_snapshot.json", "archive_i2a_source"],
  ["archive/i2a_source/scenarios.json", "archive_i2a_source"],
  ["archive/i2a_source/script_craft_revision.json", "archive_i2a_source"],
  ["archive/i2a_source/script_pass1.json", "archive_i2a_source"],
  ["archive/i2a_source/script_pass2.json", "archive_i2a_source"],
  ["archive/i2a_source/showrunner_brief.json", "archive_i2a_source"],
  ["archive/i2a_source/support_payloads.json", "archive_i2a_source"],
  ["archive/i2a_source/voice_profiles.json", "archive_i2a_source"],
  ["archive/i2a_source/writer_context_manifest.json", "archive_i2a_source"],
  ["archive/i2a_source/writer_view.json", "archive_i2a_source"],
  ["archive/i2a_source/writing_craft_review.json", "archive_i2a_source"],
  ["assembly_recipe.json", "artifact_payload_member"],
  ["audit_result.json", "artifact_payload_member"],
  [
    "authority/01_ARCHITECTURE_AND_ADRS/The_Desk_ADR_003A_BUILD_1_2_READY_and_Repair_Attempt_Semantics.md",
    "authority_source",
  ],
  [
    "authority/02_ACTIVE_SPECS/The_Desk_Character_Bible_v0.1.4.md",
    "supporting_authority_source",
  ],
  [
    "authority/02_ACTIVE_SPECS/The_Desk_Claims_Policy_v0.1.2.md",
    "authority_source",
  ],
  [
    "authority/02_ACTIVE_SPECS/The_Desk_Evidence_Package_v0.2.2.md",
    "authority_source",
  ],
  [
    "authority/02_ACTIVE_SPECS/The_Desk_Operator_Repair_v0.1.1.md",
    "authority_source",
  ],
  [
    "authority/02_ACTIVE_SPECS/The_Desk_Performance_and_Render_v0.1.4.md",
    "authority_source",
  ],
  [
    "authority/02_ACTIVE_SPECS/The_Desk_Showrunner_Planning_v0.1.3.md",
    "authority_source",
  ],
  [
    "authority/02_ACTIVE_SPECS/The_Desk_Writing_Build_1-2_Fixture_Profile_Addendum_v0.1.md",
    "provenance",
  ],
  [
    "authority/02_ACTIVE_SPECS/The_Desk_Writing_Craft_and_Invisible_Comprehension_v0.1.md",
    "authority_source",
  ],
  [
    "authority/02_ACTIVE_SPECS/The_Desk_Writing_Spec_v0.2.3.md",
    "authority_source",
  ],
  [
    "authority/04_IMPLEMENTATION/The_Desk_Hashing_Fingerprints_and_Text_Spans_v0.1.5.md",
    "provenance",
  ],
  ["authority_resolution_conformance.json", "provenance"],
  ["base_request_hash_conformance.json", "conformance_vectors"],
  ["claim_event_conformance.json", "conformance_vectors"],
  ["config/block_types.json", "programming_configuration"],
  ["config/enum_registries.json", "configuration_registry"],
  ["config/episode_modes.json", "programming_configuration"],
  ["config/participant_profiles.json", "programming_configuration"],
  ["config/policy_versions.json", "configuration"],
  [
    "config/rundown_template_post_event_launch_v2.json",
    "programming_configuration",
  ],
  ["config/show_config_version.json", "configuration"],
  ["config/show_config_version_v1_history.json", "configuration"],
  ["conformance_cases.py", "validator"],
  ["conformance_index.json", "conformance_vectors"],
  ["evidence_package.json", "artifact_payload_member"],
  ["fixture_audio/master.wav", "audio_bytes"],
  ["fixture_audio/rb01_take0.wav", "audio_bytes"],
  ["fixture_audio/rb02_take0.wav", "audio_bytes"],
  ["fixture_audio/rb03_take0.wav", "audio_bytes"],
  ["fixture_audio/rb04_take0.wav", "audio_bytes"],
  ["fixture_audio/rb05_take0.wav", "audio_bytes"],
  ["fixture_audio/rb06_take0.wav", "audio_bytes"],
  ["fixture_audio/rb06_take1.wav", "audio_bytes"],
  ["fixture_audio/rb07_take0.wav", "audio_bytes"],
  ["fixture_audio/rb08_take0.wav", "audio_bytes"],
  ["fixture_audio/rb09_take0.wav", "audio_bytes"],
  ["fixture_audio/sting.wav", "audio_bytes"],
  ["fixture_model_requests.json", "request_specimens"],
  ["fixture_persistence_conformance.json", "closed_request_mapping"],
  ["foundation_rows_398.json", "active_load"],
  ["gate_fingerprint_inputs.json", "stage_projections"],
  ["master_assembly_map.json", "artifact_payload_member"],
  ["mechanical_validation.json", "artifact_payload_member"],
  ["model_semantic_input_conformance.json", "conformance_vectors"],
  ["performance_direction.json", "artifact_payload_member"],
  ["performance_direction_corrected.json", "artifact_payload_member"],
  ["persistence_expectations.json", "fixture_expectations"],
  ["prompt_manifest_conformance.json", "conformance_vectors"],
  ["prompt_payloads.json", "artifact_payload_container"],
  ["provenance/BUILD330_RESULTS.json", "provenance_intermediate"],
  ["provenance/CONFIG330_DISPOSITION_TABLE.json", "frozen_plan_evidence"],
  ["provenance/CONFIG330_IDENTITY_TABLE.json", "frozen_plan_evidence"],
  ["provenance/DEFERRED_RUNTIME_GAP.md", "provenance"],
  ["provenance/FAMILY_TOTALS.json", "provenance"],
  ["provenance/FIXTURE_AUDIT_REPORT.json", "recorded_evaluation"],
  ["provenance/OBLIGATION_RECONCILIATION.json", "provenance"],
  ["provenance/PREEXEC_VERIFICATION.json", "provenance"],
  ["provenance/REJECTED_V3_DENYLIST.json", "provenance"],
  ["provenance/RUNTIME_BUDGET_RESOLUTION.md", "provenance"],
  ["provenance/SUCCESSOR_IDENTITY_REGISTRY.json", "provenance"],
  ["provenance/captured/model_semantic_inputs.json", "captured_projection"],
  [
    "provenance/captured/render_context_projections.json",
    "captured_projection",
  ],
  ["provenance/captured/scope_projection.bytes", "captured_bytes"],
  ["provenance/captured/writer_data_input.bytes", "captured_bytes"],
  ["provenance/correction_provenance.json", "provenance"],
  [
    "provenance/frozen/correction_input_projection.json",
    "frozen_correction_projection",
  ],
  [
    "provenance/frozen/i2b_v2/correction_input_projection_v1.json",
    "frozen_correction_projection",
  ],
  [
    "provenance/frozen/i2b_v2/technical_resolution_record_v1.md",
    "frozen_record",
  ],
  ["provenance/frozen/technical_resolution_record_v2.md", "frozen_record"],
  ["provenance/history/RUNTIME_BUDGET_FINDING_i2c_r2.md", "provenance"],
  ["provenance/i2b_v2/PHASE3_RESULTS_i2b_v2.json", "provenance_intermediate"],
  ["provenance/i2b_v2/PREEXEC_VERIFICATION_i2b_v2.json", "provenance"],
  ["provenance/i2b_v2/correction_provenance_i2b_v2.json", "provenance"],
  ["provenance/i2b_v2/retention_repair_provenance_i2b_v2.json", "provenance"],
  [
    "provenance/predecessor/config/voice_profile_versions.json",
    "predecessor_config_evidence",
  ],
  [
    "provenance/predecessor/render_request_projections.json",
    "predecessor_scene_config",
  ],
  ["provenance/predecessor/script_craft_revision.json", "predecessor_words"],
  ["provenance/predecessor/script_pass1.json", "predecessor_words"],
  ["provenance/predecessor/script_pass2.json", "predecessor_words"],
  ["provenance/predecessor_v0.4.4_pins.json", "pin_table"],
  ["provenance/uuid_correspondence_composed_330.tsv", "frozen_plan_evidence"],
  [
    "provenance/uuid_correspondence_handoff_transcription_v2.tsv",
    "frozen_plan_evidence",
  ],
  ["provenance/v0.4.6/IDENTITY_TRANSITION.json", "provenance"],
  ["ready_expectations.json", "fixture_expectations"],
  ["render_manifest.json", "artifact_payload_member"],
  ["render_request_projections.json", "projection_baselines"],
  ["revalidation_result.json", "artifact_payload_member"],
  ["revalidation_snapshot.json", "artifact_payload_member"],
  ["scenarios.json", "isolated_scenarios"],
  ["script_craft_revision.json", "artifact_payload_member"],
  ["script_pass1.json", "artifact_payload_member"],
  ["script_pass2.json", "artifact_payload_member"],
  ["showrunner_brief.json", "artifact_payload_member"],
  ["support_payloads.json", "artifact_payload_container"],
  ["unicode_conformance.json", "conformance_vectors"],
  ["validate_fixture.py", "validator"],
  ["writer_context_manifest.json", "artifact_payload_member"],
  ["writer_view.json", "artifact_payload_member"],
  ["writing_craft_review.json", "artifact_payload_member"],
] as const;

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

const SAFE_PROFILE_PATHS: Readonly<Record<string, readonly string[]>> = {
  profile_version_unsupported: [
    "package.manifest.version_refs.claims_policy",
    "package.manifest.version_refs.evidence_package_spec",
    "package.manifest.selection_provenance.selector_version",
    "package.manifest.selection_provenance.context_retrieval_version",
    "package.manifest.evidence[i].retention_declaration.policy_version",
    "material.rights_versions[i].policy.retention.policy_version",
    "material.derivations[i].rule_version",
    "material.derivations[i].exact_input_refs[j].selected_provenance.retention_declaration.policy_version",
    "material.support_carriers[i].canonical_payload.projection.method_version",
  ],
  profile_resource_limit: [
    "view.canonical_json",
    "package.manifest.claims[i].support_refs",
    "package.manifest.beats[i].member_claim_refs",
  ],
  profile_material_set_mismatch: [
    "material.claim_bases",
    "material.rights_versions",
    "material.evidence_bodies",
    "material.support_carriers",
    "material.derivations",
  ],
  profile_duplicate: [
    "package.manifest.beats[i].beat_id",
    "package.manifest.context_candidates[i].context_id",
    "package.manifest.signals[i].signal_id",
    "package.manifest.sensitivities[i].sensitivity_id",
    "package.manifest.source_attribution[i].source_id",
    "package.manifest.continuity[i].continuity_id",
    "package.manifest.silent_inputs[i].claim_id",
    "material.claim_bases[i].claim_id",
    "material.rights_versions[i].rights_version_id",
    "material.evidence_bodies[i].evidence_unit_id",
    "material.support_carriers[i].artifact_id",
    "material.derivations[i].derivation_run_id",
    "package.manifest.beats[i].member_claim_refs[j]",
    "package.manifest.silent_inputs[i].support_refs[j]",
    "material.support_carriers[i].canonical_payload.projection.observations[j].evidence_unit_id",
    "material.derivations[i].exact_input_refs[j].evidence_unit_id",
  ],
  profile_usage_unsupported: [
    "package.manifest.claims[i].state_event_cursor",
    "package.manifest.claims[i].frozen_state",
    "package.manifest.claims[i].reduced_usage_class",
    "package.manifest.claims[i].effective_usage_class",
  ],
  profile_quote_mismatch: [
    "package.manifest.evidence[i].permitted_quote.span_start",
    "package.manifest.evidence[i].permitted_quote.span_end",
    "package.manifest.evidence[i].permitted_quote.text",
  ],
  profile_support_hash_mismatch: [
    "package.manifest.claims[i].support_refs[j].support_hash",
  ],
  profile_calculation_mismatch: [
    "material.derivations[i].parameters.after_minute",
    "material.derivations[i].parameters.window_matches",
    "material.derivations[i].output.after_minute",
    "material.derivations[i].output.count",
    "material.derivations[i].output.sample_size",
  ],
  profile_support_unsupported: [
    "package.manifest.claims[i].support_refs[j].support_kind",
    "material.evidence_bodies[i].canonical_content",
  ],
  profile_support_unresolved: [
    "package.manifest.evidence[i].rights_version_id",
    "material.evidence_bodies[i].evidence_unit_id",
    "package.manifest.claims[i].support_refs[j].evidence_unit_id",
    "package.manifest.claims[i].support_refs[j].derivation_run_id",
    "package.manifest.claims[i].support_refs[j].external_support_identity",
    "material.support_carriers[i].canonical_payload.support_kind",
    "material.support_carriers[i].canonical_payload.projection.topic_thread_id",
    "material.support_carriers[i].canonical_payload.projection.observations[j].evidence_unit_id",
    "package.manifest.signals[i].ref",
    "package.manifest.context_candidates[i].claim_id",
    "package.manifest.beats[i].member_claim_refs[j]",
    "package.manifest.silent_inputs[i].claim_id",
    "package.manifest.silent_inputs[i].support_refs[j]",
    "package.manifest.claims[i].attribution_requirement.source_id",
    "material.derivations[i].exact_input_refs[j].evidence_unit_id",
    "internal",
  ],
  profile_exposure_unsupported: [
    "package.manifest.claims[i].support_refs[j].evidence_unit_id",
    "material.support_carriers[i].canonical_payload.projection.observations[j].evidence_unit_id",
    "package.manifest.silent_inputs[i].support_refs[j]",
    "package.manifest.evidence[i].permitted_quote",
    "package.manifest.evidence[i].consumer_exposure.planner",
    "package.manifest.claims[i].value.phrase",
  ],
};

const own = Object.getOwnPropertyDescriptor;
const keys = Reflect.ownKeys;
const apply = Reflect.apply;
const entries = Object.fromEntries;
// Fixed native DATA descriptors retain the original callable and its receiver.
function nativeFunction(
  target: object,
  key: PropertyKey,
): (...args: never[]) => unknown {
  const descriptor = own(target, key);
  if (!descriptor || !("value" in descriptor)) throw new TypeError();
  const fn: unknown = descriptor.value;
  if (typeof fn !== "function") throw new TypeError();
  return fn as (...args: never[]) => unknown;
}
function defined<T>(v: T | undefined): T {
  if (v === undefined) throw new TypeError();
  return v;
}
const mapEntries = nativeFunction(Map.prototype, "entries") as (
  this: Map<unknown, unknown>,
) => MapIterator<[unknown, unknown]>;
const iteratorPrototype: unknown = Object.getPrototypeOf(new Map().entries());
const mapNext = nativeFunction(objOrArray(iteratorPrototype), "next") as (
  this: MapIterator<[unknown, unknown]>,
) => IteratorResult<[unknown, unknown]>;
const typedPrototype: unknown = Object.getPrototypeOf(Uint8Array.prototype);
const byteLengthDescriptor = own(objOrArray(typedPrototype), "byteLength");
if (
  !byteLengthDescriptor ||
  "value" in byteLengthDescriptor ||
  typeof byteLengthDescriptor.get !== "function"
)
  throw new TypeError();
const byteLengthGetter = nativeFunction(byteLengthDescriptor, "get") as (
  this: Uint8Array,
) => number;
const typedSet = nativeFunction(objOrArray(typedPrototype), "set") as (
  this: Uint8Array,
  source: ArrayLike<number>,
  offset?: number,
) => void;
const H = /^[0-9a-f]{64}$/;
const U =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TS = /^\d{4}-\d{2}-\d{2}T/;
type Obj = Record<string, unknown>;
function obj(v: unknown): O {
  if (typeof v !== "object" || v === null || Array.isArray(v))
    throw new TypeError();
  return v as O;
}
function array(v: unknown): unknown[] {
  if (!Array.isArray(v)) throw new TypeError();
  return v as unknown[];
}
function value(v: object, k: string): unknown {
  const d = own(v, k);
  if (!d || !("value" in d)) throw new TypeError();
  return d.value as unknown;
}
function text(v: unknown): string {
  if (typeof v !== "string") throw new TypeError();
  return v;
}
function plain(v: unknown): v is Obj {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    (Object.getPrototypeOf(v) === Object.prototype ||
      Object.getPrototypeOf(v) === null)
  );
}
const normalizeNFC = nativeFunction(String.prototype, "normalize") as (
  this: string,
  form?: string,
) => string;
function wellFormed(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const n = s.charCodeAt(++i);
      if (!(n >= 0xdc00 && n <= 0xdfff)) return false;
    } else if (c >= 0xdc00 && c <= 0xdfff) return false;
  }
  return true;
}
// Known-invalid Unicode/NFC is admitted locally, before the owning semantic helper.
// No helper/native throwable is caught or inspected here.
function unicodeNFC(s: string): boolean {
  if (!wellFormed(s)) return false;
  const normalized: unknown = apply(normalizeNFC, s, ["NFC"]);
  invariant(typeof normalized === "string");
  return normalized === s;
}
function checkedNormalize(s: string): void {
  const normalized: unknown = normalizeString(s);
  invariant(typeof normalized === "string" && normalized === s);
}
function strings(v: unknown): boolean {
  if (
    typeof v !== "string" ||
    v.length === 0 ||
    v.length > 16384 ||
    v.trim().length === 0 ||
    !unicodeNFC(v)
  )
    return false;
  checkedNormalize(v);
  return true;
}
// This finite lexical/calendar admission mirrors the unchanged owning helper's
// accepted UTC Z syntax, including fractions. It computes no identity/domain.
function timestampData(s: string): boolean {
  const m =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/.exec(s);
  if (!m) return false;
  const decimal = (digits: string): number => {
    let n = 0;
    for (const c of digits) n = n * 10 + c.charCodeAt(0) - 48;
    return n;
  };
  const year = decimal(defined(m[1])),
    month = decimal(defined(m[2])),
    day = decimal(defined(m[3]));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= (days[month - 1] ?? 0) &&
    decimal(defined(m[4])) <= 23 &&
    decimal(defined(m[5])) <= 59 &&
    decimal(defined(m[6])) <= 59
  );
}
function invariant(v: unknown): asserts v {
  if (!v) throw new TypeError();
}
class Refused extends Error {
  constructor(readonly result: FixtureWriterInputRejection) {
    super();
  }
}
function refuse(
  phase: NormalPhase,
  code: Code,
  field: string,
  reader_code: string | null = null,
  parser_code: string | null = null,
): never {
  throw new Refused(
    Object.freeze({
      kind: "rejected",
      profile: PROFILE,
      phase,
      code,
      field,
      reader_code,
      parser_code,
    }),
  );
}
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    typeof a !== "object" ||
    a === null ||
    typeof b !== "object" ||
    b === null
  )
    return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a).sort(),
    kb = Object.keys(b).sort();
  return (
    ka.length === kb.length &&
    ka.every((k, i) => k === kb[i] && same(value(a, k), value(b, k)))
  );
}
function copy(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(copy);
  if (v !== null && typeof v === "object")
    return entries(
      Object.keys(v)
        .sort()
        .map((k) => [k, copy(value(v, k))]),
    );
  return v;
}
function freeze(v: unknown): void {
  if (v !== null && typeof v === "object") {
    for (const k of Object.keys(v)) freeze(value(v, k));
    const result: unknown = Object.freeze(v);
    invariant(result === v && Object.isFrozen(v));
  }
}
const R1 = [
  "zip_too_large",
  "zip_sha256_mismatch",
  "duplicate_zip_entry",
  "too_many_members",
  "unsafe_member_name",
  "pack_members_missing",
  "pack_members_sha256_mismatch",
  "pack_members_count_mismatch",
  "duplicate_pack_member",
  "member_set_mismatch",
  "active_load_not_unique",
  "pack_too_large",
  "member_read_failed",
  "member_sha256_mismatch",
] as const;
const R2 = ["unknown_member", "archival_member_not_loadable"] as const;
// PC2 contract02 R1 has sixteen codes. LOAD and our own reader retain R1's
// fourteen-code open set; their two member-only codes remain in R2.
const PC2_R1 = [...R1, ...R2] as const;
const R3 = [
  "rows_shape",
  "family_set_mismatch",
  "family_not_rows",
  "family_count_mismatch",
  "row_columns_mismatch",
  "primary_key_not_v4_uuid",
  "duplicate_primary_key",
  "total_rows_mismatch",
  "claim_events_not_zero",
  "artifact_split_mismatch",
] as const;
const PARSER = [
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
function known(
  error: unknown,
  cls: typeof FixtureIntegrityError | typeof Rejection,
  allowed: readonly string[],
): string | null {
  if (!(error instanceof cls)) return null;
  const d = own(error, "code");
  return d &&
    "value" in d &&
    typeof d.value === "string" &&
    allowed.includes(d.value)
    ? d.value
    : null;
}
// One generic graph admission, before any parent or selected shape reads.
// Every key and value occurrence is charged; whole surfaces precede descent.
function graph(
  v: unknown,
  bad: () => never,
  limit: () => never,
  frozen = false,
): void {
  let count = 0;
  const ancestors = new Set<object>();
  function walk(x: unknown, depth: number): void {
    if (++count > 65536) limit();
    if (x === null || typeof x === "boolean") return;
    if (typeof x === "number") {
      if (!Number.isSafeInteger(x) || Object.is(x, -0)) bad();
      return;
    }
    if (typeof x === "string") {
      if (!unicodeNFC(x)) bad();
      checkedNormalize(x);
      return;
    }
    if (typeof x !== "object") bad();
    if (ancestors.has(x) || (frozen && !Object.isFrozen(x))) bad();
    const containerDepth = depth + 1;
    if (containerDepth > 32) limit();
    ancestors.add(x);
    try {
      const ds = Object.getOwnPropertyDescriptors(x),
        ks = keys(x);
      if (ks.some((k) => typeof k !== "string")) bad();
      if (Array.isArray(x)) {
        if (Object.getPrototypeOf(x) !== Array.prototype) bad();
        const length = ds.length;
        if (
          !length ||
          !("value" in length) ||
          !Number.isSafeInteger(length.value) ||
          length.value < 0
        )
          bad();
        const n = length.value as number;
        if (n > 4096) limit();
        if (ks.length !== n + 1) bad();
        for (let i = 0; i < n; i++) {
          const d = ds[String(i)];
          if (!d || !("value" in d) || !d.enumerable) bad();
        }
        for (let i = 0; i < n; i++)
          walk(defined(ds[String(i)]).value as unknown, containerDepth);
      } else {
        if (
          !plain(x) ||
          (frozen && Object.getPrototypeOf(x) !== Object.prototype)
        )
          bad();
        const ordered = Object.keys(ds).sort();
        for (const k of ordered) {
          const d = defined(ds[k]);
          if (!("value" in d) || !d.enumerable) bad();
          if (!unicodeNFC(k)) bad();
          checkedNormalize(k);
        }
        for (const k of ordered) {
          if (++count > 65536) limit();
          walk(defined(ds[k]).value as unknown, containerDepth);
        }
      }
    } finally {
      ancestors.delete(x);
    }
  }
  walk(v, 0);
}
// The compiler is the fixed literal only. This profile has no unions or semantic retries.
function shape(
  v: unknown,
  t: unknown,
  path: string,
  bad: (p: string) => never,
): void {
  if (t === null) {
    if (v !== null) bad(path);
    return;
  }
  if (typeof t !== "object") {
    if (typeof v !== typeof t) bad(path);
    return;
  }
  if (Array.isArray(t)) {
    if (!Array.isArray(v) || Object.getPrototypeOf(v) !== Array.prototype)
      bad(path);
    const ds = Object.getOwnPropertyDescriptors<object>(v),
      ks = keys(v);
    const n = ds.length;
    if (!n || !("value" in n) || n.value !== t.length) bad(path);
    if (ks.some((k) => typeof k !== "string") || ks.length !== t.length + 1)
      bad(path);
    for (let i = 0; i < t.length; i++) {
      const d = ds[String(i)];
      if (!d || !("value" in d) || !d.enumerable) bad(`${path}[${String(i)}]`);
    }
    for (let i = 0; i < t.length; i++)
      shape(
        defined(ds[String(i)]).value as unknown,
        t[i],
        `${path}[${String(i)}]`,
        bad,
      );
    return;
  }
  if (!plain(v)) bad(path);
  const ds = Object.getOwnPropertyDescriptors(v),
    expected = Object.keys(t).sort();
  for (const k of expected) if (!Object.hasOwn(ds, k)) bad(path);
  if (keys(v).some((k) => typeof k !== "string" || !expected.includes(k)))
    bad(path);
  for (const k of expected) {
    const d = defined(ds[k]);
    if (!("value" in d) || !d.enumerable) bad(path + "." + k);
  }
  for (const k of expected)
    shape(defined(ds[k]).value as unknown, value(t, k), path + "." + k, bad);
}
function atoms(
  v: unknown,
  t: unknown,
  path: string,
  bad: (p: string) => never,
): void {
  if (t === null) return;
  if (typeof t === "string") {
    if (!strings(v)) bad(path);
    const s = text(v);
    if (H.test(t)) {
      if (!H.test(s)) bad(path);
    } else if (U.test(t)) {
      if (!U.test(s)) bad(path);
    } else if (TS.test(t)) {
      if (!timestampData(s)) bad(path);
      const timestamp: unknown = canonicalTimestamp(s);
      invariant(typeof timestamp === "string" && timestamp === s);
    }
    return;
  }
  if (typeof t === "number") {
    if (
      typeof v !== "number" ||
      !Number.isSafeInteger(v) ||
      v < 0 ||
      Object.is(v, -0)
    )
      bad(path);
    return;
  }
  if (typeof t !== "object") return;
  for (const k of Object.keys(t).sort((a, b) =>
    Array.isArray(t) ? Number(a) - Number(b) : a < b ? -1 : a > b ? 1 : 0,
  ))
    atoms(
      value(objOrArray(v), k),
      value(t, k),
      Array.isArray(t) ? path + "[" + k + "]" : path + "." + k,
      bad,
    );
}
function objOrArray(v: unknown): object {
  if (typeof v !== "object" || v === null) throw new TypeError();
  return v;
}
function firstDifference(v: unknown, t: unknown, path: string): string | null {
  if (same(v, t)) return null;
  if (typeof t !== "object" || t === null) return path;
  for (const k of Object.keys(t).sort((a, b) =>
    Array.isArray(t) ? Number(a) - Number(b) : a < b ? -1 : a > b ? 1 : 0,
  )) {
    const p = firstDifference(
      value(objOrArray(v), k),
      value(t, k),
      Array.isArray(t) ? path + "[" + k + "]" : path + "." + k,
    );
    if (p) return p;
  }
  return path;
}
function admitPack(raw: unknown): {
  pack: Pack;
  member: Pack["member"];
  pins: FixturePins;
  roles: ReadonlyMap<string, string>;
  memberNames: readonly string[];
} {
  const bad: () => never = () => refuse(3, "pack_binding_refused", "pack");
  if (!plain(raw)) bad();
  const expected = ["json", "member", "memberNames", "pins", "roles"];
  const ds = Object.getOwnPropertyDescriptors(raw);
  for (const k of expected) if (!Object.hasOwn(ds, k)) bad();
  if (keys(raw).some((k) => typeof k !== "string" || !expected.includes(k)))
    bad();
  for (const k of expected) {
    const descriptor = defined(ds[k]);
    if (!("value" in descriptor) || !descriptor.enumerable) bad();
  }
  if (
    typeof defined(ds.member).value !== "function" ||
    typeof defined(ds.json).value !== "function"
  )
    bad();
  const pins = defined(ds.pins).value as unknown;
  graph(pins, bad, bad);
  shape(pins, PINS, "pack", () => bad());
  atoms(pins, PINS, "pack", () => bad());
  if (!same(pins, PINS)) bad();
  const names = defined(ds.memberNames).value as unknown;
  graph(names, bad, bad);
  const expectedNames = FIXED_ROLES.map(([n]) => n).sort();
  shape(names, expectedNames, "pack", () => bad());
  atoms(names, expectedNames, "pack", () => bad());
  if (!same(names, expectedNames)) bad();
  const receiver: unknown = defined(ds.roles).value;
  const branded: unknown = nativeTypes.isMap(receiver as object);
  invariant(typeof branded === "boolean");
  if (!branded) bad();
  // A malformed brand-check result or any native traversal throwable is a fault;
  // arbitrary TypeError is never relabelled as an ordinary admission refusal.
  const it = apply(mapEntries, receiver as Map<unknown, unknown>, []);
  const roles: [string, string][] = [];
  for (let i = 0; i <= 512; i++) {
    const step: unknown = apply(mapNext, it, []);
    const result = closed(step, ["done", "value"]);
    const done = value(result, "done");
    invariant(typeof done === "boolean");
    if (done) {
      invariant(value(result, "value") === undefined);
      break;
    }
    if (i === 512) bad();
    const pair = value(result, "value");
    invariant(
      Array.isArray(pair) && Object.getPrototypeOf(pair) === Array.prototype,
    );
    invariant(keys(pair).length === 3 && own(pair, "length")?.value === 2);
    for (const k of ["0", "1"]) {
      const descriptor = own(pair, k);
      invariant(descriptor && "value" in descriptor && descriptor.enumerable);
    }
    const n = value(pair, "0"),
      r = value(pair, "1");
    if (!strings(n) || !strings(r)) bad();
    roles.push([text(n), text(r)]);
  }
  if (roles.length !== 133 || new Set(roles.map(([n]) => n)).size !== 133)
    bad();
  for (const [n, r] of FIXED_ROLES)
    if (!roles.some(([a, b]) => a === n && b === r)) bad();
  // A private independent pin clone is used by the facade; imported pins remain untouched.
  return {
    pack: raw as unknown as Pack,
    member: nativeFunction(defined(ds.member), "value") as Pack["member"],
    pins: copy(pins) as FixturePins,
    roles: new Map(roles),
    memberNames: copy(names) as readonly string[],
  };
}
function utf8(b: Uint8Array): boolean {
  for (let i = 0; i < b.length; ) {
    const a = defined(b[i++]);
    if (a <= 0x7f) continue;
    let n: number,
      lo = 0x80,
      hi = 0xbf;
    if (a >= 0xc2 && a <= 0xdf) n = 1;
    else if (a >= 0xe0 && a <= 0xef) {
      n = 2;
      if (a === 0xe0) lo = 0xa0;
      if (a === 0xed) hi = 0x9f;
    } else if (a >= 0xf0 && a <= 0xf4) {
      n = 3;
      if (a === 0xf0) lo = 0x90;
      if (a === 0xf4) hi = 0x8f;
    } else return false;
    if (i + n > b.length || defined(b[i]) < lo || defined(b[i]) > hi)
      return false;
    i++;
    for (let k = 1; k < n; k++) {
      if (defined(b[i]) < 0x80 || defined(b[i]) > 0xbf) return false;
      i++;
    }
  }
  return true;
}
function delimiterDepth(s: string): boolean {
  let quoted = false,
    escaped = false,
    depth = 0;
  for (const ch of s) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === "[" || ch === "{") {
      if (++depth > 32) return false;
    } else if (ch === "]" || ch === "}") depth--;
  }
  return true;
}

type J = null | boolean | number | string | J[] | { [key: string]: J };
type O = Record<string, J>;
function arr(v: unknown): J[] {
  return array(v) as J[];
}
function objects(v: unknown): O[] {
  return arr(v).map((x) => obj(x));
}
function str(v: unknown): string {
  return text(v);
}
function num(v: unknown): number {
  invariant(typeof v === "number");
  return v;
}
function at(p: string, i: number): string {
  return p + "[" + String(i) + "]";
}
function raw(v: string | Uint8Array): string {
  const d: unknown = sha256(typeof v === "string" ? Buffer.from(v, "utf8") : v);
  invariant(typeof d === "string" && H.test(d));
  return d;
}
function canonical(v: unknown): string {
  const s: unknown = canonicalJson(v);
  invariant(typeof s === "string");
  return s;
}
function domain(name: string, v: unknown): string {
  const s: unknown = domainHash(name, v);
  invariant(typeof s === "string" && H.test(s));
  return s;
}
function id(v: unknown): { utf8_bytes: string; sha256: string } {
  const s = canonical(v);
  return { utf8_bytes: String(Buffer.byteLength(s, "utf8")), sha256: raw(s) };
}
function rec(v: Obj): O {
  const r: unknown = Object.fromEntries(Object.entries(v));
  admitReconstruction(r, v);
  return r as O;
}
function count(v: unknown, cap = 65536): number {
  let n = 0;
  const add = (x: number): void => {
    n += x;
    if (n > cap) throw new CountExceeded();
  };
  const string = (s: string): void => {
    add(2);
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c === 34 || c === 92 || [8, 9, 10, 12, 13].includes(c)) add(2);
      else if (c < 32) add(6);
      else if (c < 128) add(1);
      else if (c < 2048) add(2);
      else if (c >= 0xd800 && c <= 0xdbff) {
        i++;
        add(4);
      } else add(3);
    }
  };
  const walk = (x: unknown): void => {
    if (x === null) {
      add(4);
      return;
    }
    if (typeof x === "boolean") {
      add(x ? 4 : 5);
      return;
    }
    if (typeof x === "number") {
      invariant(Number.isSafeInteger(x) && !Object.is(x, -0));
      add(String(x).length);
      return;
    }
    if (typeof x === "string") {
      string(x);
      return;
    }
    if (Array.isArray(x)) {
      add(2);
      for (let i = 0; i < x.length; i++) {
        if (i) add(1);
        walk(value(x, String(i)));
      }
      return;
    }
    const r = obj(x),
      ks = Object.keys(r);
    add(2);
    for (let i = 0; i < ks.length; i++) {
      if (i) add(1);
      const k = defined(ks[i]);
      string(k);
      add(1);
      walk(value(r, k));
    }
  };
  walk(v);
  return n;
}
class CountExceeded extends Error {}
type D =
  | { kind: "atom"; atom: string }
  | { kind: "record"; fields: Record<string, D> }
  | { kind: "array"; element: D }
  | { kind: "tuple"; items: D[] }
  | { kind: "union"; options: D[] };
function alternatives(s: string): string[] {
  let level = 0,
    start = 0;
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "[") level++;
    if (s[i] === "]") level--;
    if (s[i] === "|" && level === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out;
}
function inputD(s: string): D {
  const a = alternatives(s);
  if (a.length > 1) return { kind: "union", options: a.map(inputD) };
  if (s.startsWith("["))
    return { kind: "array", element: inputD(s.slice(1, -1)) };
  if (s.startsWith("R")) {
    const r = shapes[s];
    invariant(r);
    return {
      kind: "record",
      fields: Object.fromEntries(
        Object.entries(r).map(([k, v]) => [k, inputD(v)]),
      ),
    };
  }
  return { kind: "atom", atom: s };
}
function fixedD(v: unknown): D {
  if (v === null) return { kind: "atom", atom: "n" };
  if (typeof v === "string")
    return { kind: "atom", atom: H.test(v) ? "h" : U.test(v) ? "u" : "s" };
  if (typeof v === "number") return { kind: "atom", atom: "i" };
  if (typeof v === "boolean") return { kind: "atom", atom: "b" };
  if (Array.isArray(v)) return { kind: "tuple", items: v.map(fixedD) };
  return {
    kind: "record",
    fields: Object.fromEntries(
      Object.entries(obj(v)).map(([k, x]) => [k, fixedD(x)]),
    ),
  };
}
function atomType(v: unknown, a: string): boolean {
  return a === "n"
    ? v === null
    : a === "i"
      ? typeof v === "number"
      : a === "b"
        ? typeof v === "boolean"
        : typeof v === "string";
}
// Independent cursors preserve structural correlation and permanent elimination.
// No scalar meaning is consulted while selecting a structural branch.
interface StructuralWork {
  spend(amount: 1 | 8): void;
}
const structuralSafeInteger = nativeFunction(Number, "isSafeInteger") as (
  value: unknown,
) => boolean;
function structuralWork(cap: 15668 | 4928 | 4641224): StructuralWork {
  let remaining: number = cap;
  return {
    spend(amount) {
      const next = remaining - amount;
      const admitted: unknown = structuralSafeInteger(next);
      // After the primitive type guard, only boolean true can pass.
      invariant(typeof admitted === "boolean" && admitted && next >= 0);
      remaining = next;
    },
  };
}
interface StructuralChild {
  token: string;
  descriptor: D;
  value: unknown;
}
// Entry8 is paid by the caller before header work. Each expected descriptor
// lookup, including a missing key, is charged BEFORE that lookup. Children
// retain its admitted DATA value: dispatch never rereads the source property.
function structuralSurface(
  v: unknown,
  d: Exclude<D, { kind: "atom" } | { kind: "union" }>,
  work: StructuralWork,
): StructuralChild[] | null {
  const retained: StructuralChild[] = [];
  if (d.kind === "array" || d.kind === "tuple") {
    if (
      !Array.isArray(v) ||
      Object.getPrototypeOf(v) !== Array.prototype ||
      v.length > 256 ||
      keys(v).length !== v.length + 1 ||
      (d.kind === "tuple" && v.length !== d.items.length)
    )
      return null;
    for (let i = 0; i < v.length; i++) {
      work.spend(1);
      const z = own(v, String(i));
      if (!z || !("value" in z) || !z.enumerable) return null;
      retained.push({
        token: "[" + String(i) + "]",
        descriptor: d.kind === "array" ? d.element : defined(d.items[i]),
        value: z.value as unknown,
      });
    }
    return retained;
  }
  const names = Object.keys(d.fields).sort();
  if (!plain(v) || keys(v).length !== names.length) return null;
  for (const k of names) {
    work.spend(1);
    const z = own(v, k);
    if (!z || !("value" in z) || !z.enumerable) return null;
    retained.push({
      token: "." + k,
      descriptor: defined(d.fields[k]),
      value: z.value as unknown,
    });
  }
  return retained;
}
function choose(
  v: unknown,
  ds: readonly D[],
  p: string,
  work: StructuralWork,
): D {
  work.spend(8);
  interface Event {
    p: string;
    ok: boolean;
  }
  function* events(
    x: unknown,
    d: D,
    path: string,
  ): Generator<Event, void, undefined> {
    work.spend(8);
    if (d.kind === "union") {
      const selected = choose(x, d.options, path, work);
      work.spend(1);
      yield* events(x, selected, path);
      return;
    }
    if (d.kind === "atom") {
      yield { p: path, ok: atomType(x, d.atom) };
      return;
    }
    const retained = structuralSurface(x, d, work);
    yield { p: path, ok: retained !== null };
    if (retained === null) return;
    for (const child of retained) {
      work.spend(1);
      yield* events(child.value, child.descriptor, path + child.token);
    }
  }
  let active = ds.map((d) => {
    work.spend(1);
    return { d, it: events(v, d, p) };
  });
  for (;;) {
    const first = defined(active[0]),
      steps = active.map((c) => {
        work.spend(1);
        return { c, n: c.it.next() };
      });
    if (steps.every((s) => s.n.done)) return first.d;
    invariant(steps.every((s) => !s.n.done));
    const path = steps[0]?.n.value?.p;
    invariant(steps.every((s) => s.n.value?.p === path));
    const next = steps
      .filter((s) => {
        work.spend(1);
        return s.n.value?.ok;
      })
      .map((s) => s.c);
    if (!next.length) return first.d;
    active = next;
  }
}
function admitShape(
  v: unknown,
  d: D,
  p: string,
  bad: (p: string) => never,
  work: StructuralWork,
): D {
  work.spend(8);
  if (d.kind === "union") {
    const selected = choose(v, d.options, p, work);
    work.spend(1);
    return admitShape(v, selected, p, bad, work);
  }
  if (d.kind === "atom") {
    if (!atomType(v, d.atom)) bad(p);
    return d;
  }
  const retained = structuralSurface(v, d, work);
  if (retained === null) bad(p);
  if (d.kind === "array" || d.kind === "tuple")
    return {
      kind: "tuple",
      items: retained.map((child) => {
        work.spend(1);
        return admitShape(
          child.value,
          child.descriptor,
          p + child.token,
          bad,
          work,
        );
      }),
    };
  const fields: Record<string, D> = {};
  for (const child of retained) {
    work.spend(1);
    fields[child.token.slice(1)] = admitShape(
      child.value,
      child.descriptor,
      p + child.token,
      bad,
      work,
    );
  }
  return { kind: "record", fields };
}
function admitAtoms(
  v: unknown,
  d: D,
  p: string,
  bad: (p: string) => never,
  owner?: O,
  supportAdjunct = false,
): void {
  if (d.kind === "union") throw new TypeError();
  if (d.kind === "atom") {
    if (d.atom === "n" || d.atom === "b") return;
    if (d.atom === "i") {
      if (
        typeof v !== "number" ||
        !Number.isSafeInteger(v) ||
        v < 0 ||
        Object.is(v, -0)
      )
        bad(p);
    } else {
      if (!strings(v)) bad(p);
      if (d.atom === "h" && !H.test(text(v))) bad(p);
      if (
        d.atom === "u" &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
          text(v),
        )
      )
        bad(p);
    }
    // ROOT124D/F: adjunct created_at is ordinary s, never a base timestamp.
    if (!(supportAdjunct && p.endsWith(".created_at")))
      scalar(v as string | number, p, owner, (ok, path) => {
        if (!ok) bad(path);
      });
    return;
  }
  if (d.kind === "tuple") {
    d.items.forEach((x, i) => {
      admitAtoms(
        value(objOrArray(v), String(i)),
        x,
        at(p, i),
        bad,
        undefined,
        supportAdjunct,
      );
    });
    return;
  }
  if (d.kind === "array") throw new TypeError();
  for (const k of Object.keys(d.fields).sort())
    admitAtoms(
      value(obj(v), k),
      defined(d.fields[k]),
      p + "." + k,
      bad,
      obj(v),
      supportAdjunct,
    );
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
function scalar(
  v: string | number,
  path: string,
  owner: O | undefined,
  scalarCheck: (ok: boolean, path: string, code: string) => void,
): void {
  const p = path.replace(/\[\d+\]/g, "[]"),
    k = p.slice(p.lastIndexOf(".") + 1);
  const version = versions[p];
  if (version !== undefined)
    scalarCheck(v === version, path, "profile_version_unsupported");
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
    scalarCheck(
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
      scalarCheck(v >= 1, path, "profile_value_invalid");
    if (k === "after_minute")
      scalarCheck(v <= 1440, path, "profile_value_invalid");
    if (k === "sample_size")
      scalarCheck(v >= 1 && v <= 256, path, "profile_value_invalid");
    if (k === "count" && owner && typeof owner.sample_size === "number")
      scalarCheck(v <= owner.sample_size, path, "profile_value_invalid");
    if (k === "attested_since_year")
      scalarCheck(v <= 9999, path, "profile_value_invalid");
  }
  if (typeof v === "string" && k === "scalar") {
    scalarCheck(
      /^(?:0|[1-9]\d{0,17})(?:\.\d{0,17}[1-9])?$/.test(v),
      path,
      "profile_value_invalid",
    );
    if (owner?.unit === "percent" || owner?.unit === "probability") {
      const [whole, frac = ""] = v.split("."),
        scale = 10n ** BigInt(frac.length),
        amount = BigInt((whole ?? "") + frac);
      scalarCheck(
        amount <= BigInt(owner.unit === "percent" ? 100 : 1) * scale,
        path,
        "profile_value_invalid",
      );
    }
  }
  if (timestampPaths.includes(p)) {
    scalarCheck(
      typeof v === "string" && timestamp(v),
      path,
      "profile_value_invalid",
    );
    invariant(typeof v === "string");
    const admitted: unknown = canonicalTimestamp(v);
    invariant(typeof admitted === "string" && admitted === v);
  }
  if (p === "package.manifest.evidence[].source_document_date") {
    const d = typeof v === "string" ? datePattern.exec(v) : null;
    scalarCheck(d !== null && calendar(d), path, "profile_value_invalid");
  }
  if (
    k === "external_support_identity" &&
    (owner?.support_kind === "signal" || owner?.support_kind === "continuity")
  )
    scalarCheck(
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
    scalarCheck(
      typeof v === "string" &&
        v.startsWith("fixture-external:") &&
        v.length > "fixture-external:".length,
      path,
      "profile_value_invalid",
    );
}

const PG_SEEDS: Readonly<Record<string, string>> = {
  "package.manifest": roots.package_profile,
  "material.claim_bases": roots.claim_bases,
  "material.rights_versions": roots.rights_versions,
  "material.evidence_bodies": roots.evidence_bodies,
  "material.support_carriers": roots.support_carriers,
  "material.derivations": roots.derivations,
};
function pgNodes(field: string): D[] {
  if (field === "package.created_at" || field === "package.frozen_at")
    return [{ kind: "atom", atom: "s" }];
  if (
    [
      "continuity",
      "historical_context",
      "independent_analysis",
      "licensed_tracking_data",
      "serious_incident",
      "structured_stats",
      "supporter_evidence",
      "verified_result",
    ].some((k) => field === "package.manifest.availability." + k + ".reason")
  )
    return [{ kind: "atom", atom: "s" }];
  const seed = Object.keys(PG_SEEDS).find(
    (k) =>
      field === k || field.startsWith(k + ".") || field.startsWith(k + "["),
  );
  if (!seed) return [];
  const suffix = field.slice(seed.length),
    tokens = suffix.match(/\.[a-z_][a-z0-9_]*|\[(?:0|[1-9]\d*)\]/g) ?? [];
  if (tokens.join("") !== suffix) return [];
  let nodes = [inputD(PG_SEEDS[seed] ?? "n")];
  function expand(d: D): D[] {
    return d.kind === "union" ? d.options.flatMap(expand) : [d];
  }
  for (const token of tokens) {
    const next: D[] = [];
    for (const d of nodes.flatMap(expand)) {
      if (token.startsWith(".") && d.kind === "record") {
        const child = own(d.fields, token.slice(1));
        if (child && "value" in child && child.enumerable)
          next.push(child.value as D);
      } else if (
        token.startsWith("[") &&
        d.kind === "array" &&
        Number(token.slice(1, -1)) <= 255
      )
        next.push(d.element);
    }
    nodes = next;
    if (!nodes.length) return [];
  }
  return nodes.flatMap(expand);
}

type ParentNode =
  | { a: string }
  | { t: number[] }
  | { r: Record<string, number> };
function parentD(i: number): D {
  const node: ParentNode = defined(PARENT_NODES[i]);
  if ("a" in node) return { kind: "atom", atom: node.a };
  if ("t" in node) return { kind: "tuple", items: node.t.map(parentD) };
  return {
    kind: "record",
    fields: Object.fromEntries(
      Object.entries(node.r).map(([k, j]) => [k, parentD(j)]),
    ),
  };
}

const PC2_D = parentD(117),
  LOAD_D = parentD(175),
  INSPECTION_D = parentD(212);

interface Captured {
  bytes: Uint8Array[];
  observations: {
    member: string;
    role: string;
    utf8_bytes: string;
    sha256: string;
  }[];
  policyBytes: Uint8Array[];
  policyIdentities: { utf8_bytes: string; sha256: string }[];
}
function ioCode(error: unknown, allowed: readonly string[]): boolean {
  if (!(error instanceof Error)) return false;
  const d = own(error, "code");
  return (
    !!d &&
    "value" in d &&
    typeof d.value === "string" &&
    allowed.includes(d.value)
  );
}
function policyFile(i: number, prior: number): Uint8Array {
  const spec = defined(META.policies[i]),
    field = "policy[" + String(i) + "]";
  for (const k of ["O_RDONLY", "O_NOFOLLOW", "S_IFMT", "S_IFREG"] as const)
    invariant(
      typeof constants[k] === "number" &&
        Number.isSafeInteger(constants[k]) &&
        constants[k] >= 0,
    );
  invariant(
    constants.O_NOFOLLOW > 0 &&
      constants.O_RDONLY <= 0x7fffffff &&
      constants.O_NOFOLLOW <= 0x7fffffff,
  );
  let fd: unknown;
  try {
    fd = openSync(
      new URL("../../" + spec.path, import.meta.url),
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
  } catch (e) {
    if (ioCode(e, ["ENOENT", "EACCES", "EPERM", "ELOOP", "ENOTDIR"]))
      refuse(3, "policy_source_unavailable", field);
    throw e;
  }
  invariant(
    typeof fd === "number" &&
      Number.isSafeInteger(fd) &&
      fd >= 0 &&
      fd <= 2147483647,
  );
  let pending: unknown;
  let failed = false;
  let out: Uint8Array | undefined;
  try {
    let st: unknown;
    try {
      st = fstatSync(fd, { bigint: false });
    } catch (e) {
      if (ioCode(e, ["EIO"])) refuse(3, "policy_source_unavailable", field);
      throw e;
    }
    invariant(
      typeof st === "object" &&
        st !== null &&
        Object.getPrototypeOf(st) === Stats.prototype,
    );
    const used: Record<string, number> = {};
    for (const k of ["mode", "size", "nlink"]) {
      const d = own(st, k);
      invariant(
        d &&
          "value" in d &&
          typeof d.value === "number" &&
          Number.isSafeInteger(d.value) &&
          d.value >= 0,
      );
      used[k] = d.value;
    }
    const mode = defined(used.mode),
      size = defined(used.size),
      nlink = defined(used.nlink);
    invariant(mode <= 65535);
    if ((mode & constants.S_IFMT) !== constants.S_IFREG || nlink !== 1)
      refuse(3, "policy_source_unavailable", field);
    if (size > 131072 || prior + size > 524288)
      refuse(3, "policy_source_resource_limit", field);
    const scratch = new Uint8Array(131073);
    let offset = 0,
      reads = 0;
    for (;;) {
      invariant(++reads <= 131074);
      const request = Math.min(16384, 131073 - offset, 524289 - prior - offset);
      invariant(request > 0);
      let n: unknown;
      try {
        n = readSync(fd, scratch, offset, request, null);
      } catch (e) {
        if (ioCode(e, ["EIO", "EACCES", "EPERM"]))
          refuse(3, "policy_source_unavailable", field);
        throw e;
      }
      invariant(
        typeof n === "number" &&
          Number.isSafeInteger(n) &&
          n >= 0 &&
          n <= request,
      );
      if (n === 0) break;
      offset += n;
      if (offset > 131072 || prior + offset > 524288)
        refuse(3, "policy_source_resource_limit", field);
    }
    out = new Uint8Array(scratch.buffer, 0, offset);
  } catch (e) {
    failed = true;
    pending = e;
  }
  try {
    const close: (descriptor: number) => unknown = closeSync;
    const result = close(fd);
    invariant(result === undefined);
  } catch (e) {
    if (!failed) {
      failed = true;
      pending = e;
    }
  }
  if (failed) throw pending;
  return defined(out);
}
function capture(pack: Pack, member: Pack["member"]): Captured {
  const bytes: Uint8Array[] = [];
  let total = 0;
  for (let i = 0; i < META.sources.length; i++) {
    const ref = defined(META.sources[i]),
      field = "source[" + String(i) + "]";
    let b: unknown;
    try {
      b = apply(member, pack, [ref.member]);
    } catch (e) {
      const c = known(e, FixtureIntegrityError, R2);
      if (c) refuse(3, "reader_refused", field, c);
      throw e;
    }
    invariant(Buffer.isBuffer(b));
    const length: unknown = apply(byteLengthGetter, b, []);
    invariant(
      typeof length === "number" && Number.isSafeInteger(length) && length >= 0,
    );
    if (length > 1048576 || (total += length) > 2097152)
      refuse(3, "source_resource_limit", field);
    const owned = new Uint8Array(length);
    apply(typedSet, owned, [b]);
    bytes.push(owned);
  }
  const policyBytes: Uint8Array[] = [];
  let policyTotal = 0;
  for (let i = 0; i < 5; i++) {
    const b = policyFile(i, policyTotal);
    policyBytes.push(b);
    policyTotal += b.byteLength;
  }
  const observations = bytes.map((b, i) => ({
    ...defined(META.sources[i]),
    utf8_bytes: String(b.byteLength),
    sha256: raw(b),
  }));
  const policyIdentities = policyBytes.map((b) => ({
    utf8_bytes: String(b.byteLength),
    sha256: raw(b),
  }));
  return { bytes, observations, policyBytes, policyIdentities };
}
function parseSources(c: Captured): unknown[] {
  return c.bytes.map((b, i) => {
    const field = "source[" + String(i) + "]";
    if (!utf8(b)) refuse(3, "source_utf8_invalid", field);
    const s: unknown = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(b);
    invariant(typeof s === "string");
    if (!delimiterDepth(s)) refuse(3, "source_resource_limit", field);
    let v: unknown;
    try {
      v = JSON.parse(s) as unknown;
    } catch (e) {
      if (e instanceof SyntaxError) refuse(3, "source_json_invalid", field);
      throw e;
    }
    graph(
      v,
      () => refuse(3, "source_graph_invalid", field),
      () => refuse(3, "source_resource_limit", field),
    );
    return v;
  });
}
function pinSource(c: Captured, i: number): void {
  const actual = defined(c.observations[i]),
    expected = defined(META.sources[i]);
  if (
    actual.utf8_bytes !== expected.utf8_bytes ||
    actual.sha256 !== expected.sha256
  )
    refuse(
      i === 0 || i === 2 ? 7 : 4,
      "source_identity_mismatch",
      "source[" + String(i) + "]",
    );
}
function originalCorrespondence(c: Captured, docs: unknown[]): void {
  for (const [i, size, digest] of [
    [
      0,
      332794,
      "ac40e6fda276dcf25b2997b4ae117ef2a71a3ad0362474498791e2d883056235",
    ],
    [
      2,
      1113,
      "d4d936ce66ac9e3f51f0846a2d7fcef75971e5f1c8e6b06763f758e809584d21",
    ],
  ] as const) {
    const actual = defined(c.observations[i]),
      expected = defined(META.sources[i]);
    if (
      actual.utf8_bytes !== expected.utf8_bytes ||
      actual.sha256 !== expected.sha256
    )
      continue;
    invariant(count(docs[i], size) === size);
    const s = canonical(docs[i]);
    invariant(Buffer.byteLength(s, "utf8") === size && raw(s) === digest);
  }
}
function closed(v: unknown, names: readonly string[]): Obj {
  invariant(plain(v) && keys(v).length === names.length);
  for (const k of names) {
    const d = own(v, k);
    invariant(d && "value" in d && d.enumerable);
  }
  invariant(keys(v).every((k) => typeof k === "string" && names.includes(k)));
  return v;
}
function pathNodes(d: D, field: string, variableTuples = false): D[] {
  const tokens = field.match(/\.[a-z_][a-z0-9_]*|\[(?:0|[1-9]\d*)\]/g) ?? [];
  if (tokens.join("") !== field) return [];
  const expand = (x: D): D[] =>
    x.kind === "union" ? x.options.flatMap(expand) : [x];
  let nodes = [d];
  for (const token of tokens) {
    const next: D[] = [];
    for (const n of nodes.flatMap(expand)) {
      if (token.startsWith(".") && n.kind === "record") {
        const x = own(n.fields, token.slice(1));
        if (x && "value" in x && x.enumerable) next.push(x.value as D);
      } else if (token.startsWith("[") && Number(token.slice(1, -1)) <= 255) {
        if (n.kind === "array") next.push(n.element);
        if (n.kind === "tuple") {
          if (variableTuples) next.push(...n.items);
          else {
            const x = n.items[Number(token.slice(1, -1))];
            if (x) next.push(x);
          }
        }
      }
    }
    nodes = next;
  }
  return nodes.flatMap(expand);
}
function pattern(s: string, field: string): boolean {
  const re =
    "^" +
    s
      .split(/(\[i\]|\[j\])/)
      .map((part) =>
        part === "[i]" || part === "[j]"
          ? "\\[(?:0|[1-9][0-9]{0,2})\\]"
          : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      )
      .join("") +
    "$";
  return (
    new RegExp(re).test(field) &&
    [...field.matchAll(/\[(\d+)\]/g)].every((m) => Number(m[1]) <= 255)
  );
}
function safePC1(value: unknown): void {
  const r = closed(value, ["kind", "profile", "code", "field", "parser_code"]);
  invariant(
    r.kind === "rejected" &&
      r.profile === "planner-fixture-consumer-snapshot/1" &&
      typeof r.code === "string" &&
      typeof r.field === "string",
  );
  const c = r.code,
    f = r.field;
  const basic = [
    "input_type_invalid",
    "input_text_empty",
    "input_resource_limit",
    "input_unicode_invalid",
    "input_json_invalid",
    "input_semantic_json_invalid",
    "input_text_noncanonical",
  ];
  if (basic.includes(c)) {
    invariant(f === "input" && r.parser_code === null);
    return;
  }
  if (c === "input_envelope_invalid") {
    invariant(
      [
        "input",
        "input.schema",
        "input.package_payload",
        "input.material",
      ].includes(f) && r.parser_code === null,
    );
    return;
  }
  if (c === "parser_rejected") {
    invariant(
      f === "package" &&
        typeof r.parser_code === "string" &&
        (PARSER as readonly string[]).includes(r.parser_code),
    );
    return;
  }
  invariant(r.parser_code === null);
  const nodes = pgNodes(f);
  if (c === "profile_shape_invalid")
    invariant(nodes.some((n) => n.kind === "record"));
  else if (c === "profile_value_invalid" || c === "profile_binding_mismatch")
    invariant(nodes.length > 0);
  else
    invariant(
      (SAFE_PROFILE_PATHS[c] ?? []).some((p) => pattern(p, f)) &&
        (nodes.length > 0 ||
          (c === "profile_support_unresolved" && f === "internal") ||
          (c === "profile_resource_limit" && f === "view.canonical_json")),
    );
}

function validPC2Refusal(v: Obj): void {
  invariant(
    v.kind === "rejected" &&
      v.profile === "showrunner-fixture-input-candidate/1" &&
      typeof v.phase === "number" &&
      Number.isInteger(v.phase) &&
      typeof v.code === "string" &&
      typeof v.field === "string",
  );
  const p = v.phase,
    c = v.code,
    f = v.field;
  if (p !== 6) invariant(v.dependency === null);
  const src = /^source\[[0-8]\]$/.test(f);
  let ok = false;
  if (p === 0) ok = c === "arguments_not_allowed" && f === "arguments";
  else if (p === 1) {
    if (c === "reader_refused") {
      invariant(
        f === "reader" &&
          typeof v.reader_code === "string" &&
          (PC2_R1 as readonly string[]).includes(v.reader_code),
      );
      return;
    }
    ok =
      [
        "source_type_invalid",
        "source_anchor_refused",
        "archival_source_refused",
        "source_role_refused",
        "reader_schema_refused",
      ].includes(c) && f === "reader";
  } else if (p === 2) {
    if (c === "reader_refused") {
      invariant(
        src &&
          typeof v.reader_code === "string" &&
          (R2 as readonly string[]).includes(v.reader_code),
      );
      return;
    }
    ok =
      [
        "source_type_invalid",
        "source_resource_limit",
        "source_utf8_invalid",
        "source_json_invalid",
        "source_record_invalid",
      ].includes(c) && src;
  } else if (p === 3) {
    if (c === "reader_refused") {
      invariant(
        f === "source[0]" &&
          typeof v.reader_code === "string" &&
          (R3 as readonly string[]).includes(v.reader_code),
      );
      return;
    }
    const rowNode = f === "source[0]" || pc2SourceNodes(f);
    ok = c === "source_record_invalid" && rowNode;
    if (c === "source_version_unsupported") ok = rowNode && pc2VersionField(f);
    // Closure03's compiled missing-known-key rule includes the necessary-row
    // supersedes key. PC2 necessaryAdmission emits this exact diagnostic.
    if (
      c === "source_record_invalid" &&
      /^source\.evidence\[(?:[0-9]|1[01])\]\.(?:canonical_content|supersedes_evidence_unit_id)$/.test(
        f,
      )
    )
      ok = true;
    if (c === "necessary_source_unavailable")
      ok = /^source\.evidence\[(?:[0-9]|1[01])\]\.canonical_content$/.test(f);
    if (
      c === "source_version_unsupported" &&
      /^source\.evidence\[(?:[0-9]|1[01])\]\.supersedes_evidence_unit_id$/.test(
        f,
      )
    )
      ok = true;
  } else if (p === 4) {
    const m = /^rights\[(0|[1-6])\](.*)$/.exec(f);
    if (m) {
      const d = inputD("R4f8644d7587d");
      const nodes = pathNodes(d, m[2] ?? "");
      ok = c === "rights_grant_refused" && nodes.length > 0;
      if (c === "external_provider_forbidden")
        ok = m[2] === ".policy.provider_exposure.external_providers";
    }
  } else if (p === 5) {
    const nodes =
      f === "configuration"
        ? [fixedD(CONFIG_SHAPE)]
        : f.startsWith("configuration.")
          ? pathNodes(
              fixedD(CONFIG_SHAPE),
              f.slice("configuration".length),
              true,
            )
          : [];
    ok =
      ["configuration_shape_invalid", "configuration_binding_refused"].includes(
        c,
      ) && nodes.length > 0;
    if (c === "configuration_version_unsupported")
      ok =
        nodes.some((n) => n.kind === "atom" && n.atom === "s") &&
        PC2_CONFIG_VERSIONS.some((p) => pattern(p, f));
    if (c === "current_use_unsupported")
      ok =
        f ===
        "configuration.show_config_version.canonical_payload.publication_enabled";
  } else if (p === 6) {
    invariant(
      c === "inspection_dependency_refused" &&
        f === "inspection" &&
        v.reader_code === null,
    );
    safePC1(v.dependency);
    return;
  } else if (p === 7) {
    if (c === "candidate_resource_limit") ok = f === "candidate.canonical_json";
    if (c === "dependency_result_invalid")
      ok =
        f === "inspection" ||
        (f.startsWith("inspection.") &&
          pathNodes(INSPECTION_D, f.slice("inspection".length), true).length >
            0);
    const m = /^registry\[(0|[1-7])\](.*)$/.exec(f);
    if (c === "registry_binding_refused" && m)
      ok =
        pathNodes(
          fixedD(defined(PC2_REGISTRY_SHAPE[Number(m[1])])),
          m[2] ?? "",
          true,
        ).length > 0;
  } else if (p === 8)
    ok =
      (c === "source_identity_mismatch" && src) ||
      (c === "dependency_identity_mismatch" && f === "inspection");
  invariant(ok && v.reader_code === null && v.dependency === null);
}
function pc2SourceNodes(f: string): boolean {
  if (/^source\[[0-8]\]$/.test(f)) return true;
  const source0 = "source[0]";
  for (const k of [
    "claim_bases",
    "rights_versions",
    "evidence_bodies",
    "support_carriers",
    "derivations",
  ] as const)
    if (
      f === source0 + "." + k ||
      f.startsWith(source0 + "." + k + ".") ||
      f.startsWith(source0 + "." + k + "[")
    ) {
      const d = inputD(roots[k]);
      return pathNodes(d, f.slice((source0 + "." + k).length)).length > 0;
    }
  const source1 = "source[1]";
  if (f.startsWith("source[2].") || f.startsWith("source[2][")) {
    const suffix = f.slice("source[2]".length);
    return (
      pathNodes(inputD(roots.support_carriers), suffix).length > 0 ||
      pathNodes(inputD("R55f3f837f469"), suffix).length > 0
    );
  }
  if (
    f === source1 + ".manifest" ||
    f.startsWith(source1 + ".manifest.") ||
    f.startsWith(source1 + ".manifest[")
  )
    return (
      pathNodes(
        inputD(roots.package_profile),
        f.slice((source1 + ".manifest").length),
      ).length > 0
    );
  return [
    "artifact_id",
    "id",
    "selector_run_id",
    "package_hash",
    "scope_hash",
    "created_at",
    "frozen_at",
    "schema_version",
  ].some((k) => f === source1 + "." + k);
}
const PC2_CONFIG_VERSIONS = [
  "configuration.block_type_registry.registry_version",
  "configuration.episode_mode_registry.registry_version",
  "configuration.participant_profiles.profile_set_version",
  "configuration.participant_profiles.profiles[i].character_bible_version",
  "configuration.rundown_template.rundown_template_version_id",
  "configuration.show_config_version.schema_version",
  "configuration.show_config_version.canonical_payload.show_version",
  "configuration.show_config_version.canonical_payload.autonomous_operation_policy_version",
  "configuration.show_config_version.canonical_payload.operator_repair_policy_version",
  "configuration.show_config_version.canonical_payload.writing_craft_policy_version",
  "configuration.show_config_version.canonical_payload.default_output_language",
] as const;
// These are PC2 phase3's actual mapped scalar-version sites, independent of
// this consumer's local registry. Rights policy versions belong to PC2 phase4.
const PC2_SOURCE_VERSION_FIELDS = [
  "source[1].manifest.version_refs.claims_policy",
  "source[1].manifest.version_refs.evidence_package_spec",
  "source[1].manifest.selection_provenance.selector_version",
  "source[1].manifest.selection_provenance.context_retrieval_version",
  "source[1].manifest.evidence[i].retention_declaration.policy_version",
  "source[2].rule_version",
  "source[2].exact_input_refs[i].selected_provenance.retention_declaration.policy_version",
  "source[2][i].canonical_payload.projection.method_version",
] as const;
function pc2VersionField(f: string): boolean {
  if (f === "source[0]") return true;
  if (
    /^source\[1\]\.manifest\.claims\[(?:0|[1-9]\d{0,2})\](?:\.state_event_cursor)?$/.test(
      f,
    )
  )
    return pc2SourceNodes(f);
  return PC2_SOURCE_VERSION_FIELDS.some((p) => pattern(p, f));
}
function loadPlanField(f: string): boolean {
  return (
    [
      "brief.runtime_target.purpose",
      "brief.runtime_target.seconds",
      "brief.selected_mode",
      "brief.rundown_template_version_id",
      "brief.show_version",
      "brief.program_blocks",
    ].includes(f) ||
    [
      "brief.program_blocks[i].program_block_id",
      "brief.program_blocks[i].sequence",
      "brief.program_blocks[i].template_slot_id",
      "brief.program_blocks[i].block_type",
      "brief.program_blocks[i].target_duration_or_words.seconds",
    ].some((p) => pattern(p, f))
  );
}
function loadReferenceField(f: string): boolean {
  const tokens = f.match(/[a-z_]+|\d+/g) ?? [],
    last = tokens[tokens.length - 1] ?? "";
  if (/^\d+$/.test(last)) {
    // LOAD checks per-array string duplicates as well as array references.
    // The caller requires an actual string leaf in the complete fixed T.
    return true;
  }
  return (
    [
      "participant_id",
      "claim_id",
      "scope_ref",
      "context_id",
      "program_block_id",
      "continuity_id",
      "topic_thread_id",
      "context_selection_id",
      "exclusion_id",
      "comprehension_target_id",
    ].includes(last) || /^brief\.selected_beats\[\d+\]\.beat_id$/.test(f)
  );
}
function loadGeneratedField(f: string): boolean {
  // LOAD01 9A: these are generated constants, never invalid-source DATA.
  return [
    "provenance.record_kind",
    "provenance.request_reference.member",
    "provenance.request_reference.specimen_key",
    "provenance.request_reference.encoding",
    "provenance.prompt_payload_identity.domain",
    "provenance.semantic_input_identity.domain",
  ].includes(f);
}
function loadDocumentaryField(f: string, nodes: readonly D[]): boolean {
  // LOAD01 9A Q5e fixes these B diagnostics. Whole Brief equality at7
  // has a separate broader language; it does not widen documentary5.
  if (["brief", "brief.planner_model_run_id", "brief.created_at"].includes(f))
    return true;
  if (pattern("brief.program_blocks[i]", f)) return nodes.length > 0;
  if (["provenance.package_version", "provenance.prompt_manifest"].includes(f))
    return true;
  // Q5e25 compares EVERY source-derived D leaf, including null and boolean
  // columns. Other containers and generated labels are not blanket sites.
  return (
    f.startsWith("provenance.") &&
    !loadGeneratedField(f) &&
    nodes.some((n) => n.kind === "atom")
  );
}
function validLOADRefusal(v: Obj): void {
  invariant(
    v.kind === "rejected" &&
      v.profile === "showrunner-fixture-brief-load/1" &&
      typeof v.phase === "number" &&
      Number.isInteger(v.phase) &&
      typeof v.code === "string" &&
      typeof v.field === "string",
  );
  const p = v.phase,
    c = v.code,
    f = v.field,
    src = /^source\[[0-7]\]$/.test(f);
  if (c === "reader_refused") {
    invariant(typeof v.reader_code === "string" && v.parser_code === null);
    invariant(
      (p === 1 &&
        f === "pack" &&
        (R1 as readonly string[]).includes(v.reader_code)) ||
        (p === 2 && src && (R2 as readonly string[]).includes(v.reader_code)) ||
        (p === 3 &&
          f === "source[0]" &&
          (R3 as readonly string[]).includes(v.reader_code)),
    );
    return;
  }
  if (c === "parser_refused") {
    invariant(
      p === 3 &&
        f === "source[2]" &&
        v.reader_code === null &&
        typeof v.parser_code === "string" &&
        (PARSER as readonly string[]).includes(v.parser_code),
    );
    return;
  }
  invariant(v.reader_code === null && v.parser_code === null);
  const nodes = pathNodes(LOAD_D, "." + f),
    brief = nodes.length > 0 && (f === "brief" || f.startsWith("brief.")),
    provenance =
      nodes.length > 0 && (f === "provenance" || f.startsWith("provenance.")),
    scalar = nodes.some(
      (n) => n.kind === "atom" && ["s", "u", "h", "i"].includes(n.atom),
    ),
    string = nodes.some(
      (n) => n.kind === "atom" && ["s", "u", "h"].includes(n.atom),
    ),
    privatePayload = [
      "provenance.brief_artifact",
      "provenance.package_version",
      "provenance.prompt_manifest",
    ].includes(f);
  // Separate accepted LOAD01 schedule, with ROOT02 header counts; not companion P.
  let ok = false;
  if (p === 0) ok = c === "arguments_refused" && f === "input";
  if (p === 1) ok = c === "pack_binding_refused" && f === "pack";
  if (p === 2) ok = c === "source_resource_limit" && src;
  if (p === 3)
    ok =
      [
        "source_utf8_invalid",
        "source_json_invalid",
        "source_graph_invalid",
        "source_resource_limit",
      ].includes(c) && src;
  if (p === 4)
    ok =
      (c === "source_identity_mismatch" && /^source\[[2-7]\]$/.test(f)) ||
      (c === "brief_shape_invalid" && brief) ||
      (c === "brief_value_invalid" && brief && scalar) ||
      (c === "documentary_shape_invalid" &&
        provenance &&
        !loadGeneratedField(f)) ||
      (c === "documentary_value_invalid" &&
        provenance &&
        !loadGeneratedField(f) &&
        (scalar || privatePayload));
  if (p === 5)
    ok =
      (c === "brief_version_unsupported" &&
        [
          "brief.planning_policy_version",
          "provenance.brief_artifact.schema_version",
        ].includes(f)) ||
      (c === "purpose_unsupported" && f === "brief.purpose") ||
      (c === "brief_plan_invalid" && brief && loadPlanField(f)) ||
      (c === "brief_reference_invalid" &&
        brief &&
        string &&
        loadReferenceField(f)) ||
      (c === "documentary_binding_refused" && loadDocumentaryField(f, nodes));
  if (p === 6)
    ok =
      (c === "brief_hash_mismatch" && f === "brief.brief_hash") ||
      (c === "provenance_hash_mismatch" &&
        [
          "provenance.planning_attempt",
          "provenance.package_version",
          "provenance.request_reference.rendered_request_hash",
          "provenance.prompt_payload_identity.sha256",
          "provenance.semantic_input_identity.sha256",
        ].includes(f)) ||
      (c === "documentary_binding_refused" &&
        f === "provenance.prompt_manifest");
  if (p === 7)
    ok =
      (c === "source_identity_mismatch" &&
        (f === "source[0]" || f === "source[1]")) ||
      (c === "documentary_binding_refused" && brief);
  invariant(ok);
}
function admitParent(v: unknown, p: 1 | 2): O {
  graph(
    v,
    () => {
      throw new TypeError();
    },
    () => {
      throw new TypeError();
    },
    true,
  );
  invariant(plain(v));
  if (value(v, "kind") === "rejected") {
    const r = closed(
      v,
      p === 1
        ? [
            "kind",
            "profile",
            "phase",
            "code",
            "field",
            "reader_code",
            "dependency",
          ]
        : [
            "kind",
            "profile",
            "phase",
            "code",
            "field",
            "reader_code",
            "parser_code",
          ],
    );
    if (p === 1) validPC2Refusal(r);
    else validLOADRefusal(r);
    refuse(p, "parent_refused", p === 1 ? "planner" : "brief");
  }
  const r = closed(v, [
    "kind",
    "profile",
    "data",
    p === 1 ? "candidate_json" : "data_json",
    "identity",
  ]);
  invariant(
    r.kind ===
      (p === 1 ? "source_bound_fixture_candidate" : "loaded_fixture_brief") &&
      r.profile ===
        (p === 1
          ? "showrunner-fixture-input-candidate/1"
          : "showrunner-fixture-brief-load/1"),
  );
  const identity = closed(r.identity, ["utf8_bytes", "sha256"]),
    s = value(r, p === 1 ? "candidate_json" : "data_json");
  invariant(typeof s === "string" && Buffer.byteLength(s, "utf8") <= 2097152);
  invariant(
    typeof identity.utf8_bytes === "string" &&
      /^(?:0|[1-9]\d*)$/.test(identity.utf8_bytes) &&
      identity.utf8_bytes.length <= 7 &&
      typeof identity.sha256 === "string" &&
      H.test(identity.sha256),
  );
  const data = r.data,
    descriptor = p === 1 ? PC2_D : LOAD_D;
  const work = structuralWork(p === 1 ? 15668 : 4928);
  admitShape(
    data,
    descriptor,
    "",
    () => {
      throw new TypeError();
    },
    work,
  );
  invariant(count(data, 2097152) === Buffer.byteLength(s, "utf8"));
  invariant(canonical(data) === s);
  const expected =
    p === 1
      ? {
          utf8_bytes: "55418",
          sha256:
            "dfe650e4eae99674fc0868b7d6feb1c89c5e13a5aa62534cd10bd72f974b6a5a",
        }
      : {
          utf8_bytes: "15966",
          sha256:
            "eba56df10b5004d7585b9cae219d859e59b15875912c54a93b25dabc909c1b60",
        };
  invariant(
    identity.utf8_bytes === String(Buffer.byteLength(s, "utf8")) &&
      identity.sha256 === raw(s) &&
      same(identity, expected),
  );
  const owned = copy(data);
  freeze(owned);
  return obj(owned);
}

interface Material {
  claim_bases: O[];
  rights_versions: O[];
  evidence_bodies: O[];
  support_carriers: O[];
  derivations: O[];
  supportRows: O[];
  tables: Obj;
  package: O;
}
interface Prerequisites {
  tables: Obj;
  package: O;
}
interface ReaderSnapshot {
  pins: FixturePins;
  roles: ReadonlyMap<string, string>;
  memberNames: readonly string[];
}
function prerequisites(docs: unknown[], reader: ReaderSnapshot): Prerequisites {
  const { pins, roles, memberNames } = reader;
  let calls = 0;
  const facade: Pack = {
    pins,
    roles,
    memberNames,
    member() {
      throw new TypeError();
    },
    json(name: string): unknown {
      invariant(name === pins.activeLoadMember && ++calls === 1);
      return docs[0];
    },
  };
  let rows: unknown;
  try {
    rows = parseFoundationRows(facade);
  } catch (e) {
    const c = known(e, FixtureIntegrityError, R3);
    if (c) refuse(4, "reader_refused", "source[0]", c);
    throw e;
  }
  invariant(calls === 1);
  const rr = closed(rows, ["profile", "tables"]);
  graph(
    rr,
    () => {
      throw new TypeError();
    },
    () => {
      throw new TypeError();
    },
  );
  invariant(
    rr.profile === value(obj(docs[0]), "profile") &&
      same(rr.tables, value(obj(docs[0]), "tables")),
  );
  const pkg = obj(docs[1]);
  try {
    parsePayload(pkg);
  } catch (e) {
    const c = known(e, Rejection, PARSER);
    if (c) refuse(4, "parser_refused", "source[1]", null, c);
    throw e;
  }
  return { tables: obj(rr.tables), package: pkg };
}
function material(input: Prerequisites, docs: unknown[]): Material {
  const { tables, package: pkg } = input,
    family = (name: string): O[] => objects(value(tables, name));
  const evidence = objects(value(obj(pkg.manifest), "evidence")),
    rightIds = [...new Set(evidence.map((e) => str(e.rights_version_id)))];
  const rights = rightIds.map((id) => {
    const matches = family("rights_versions").filter(
      (r) => r.rights_version_id === id,
    );
    if (matches.length !== 1)
      refuse(4, "source_shape_invalid", "material.rights_versions");
    return defined(matches[0]);
  });
  return {
    claim_bases: family("claims"),
    rights_versions: rights,
    evidence_bodies: family("evidence_units"),
    derivations: family("derivation_runs"),
    supportRows: family("claim_supports"),
    support_carriers: objects(value(obj(docs[10]), "artifacts")),
    tables,
    package: pkg,
  };
}
function localAdmission(m: Material, c0: unknown): void {
  const rawCarrier = inputD(roots.support_carriers);
  invariant(rawCarrier.kind === "array" && rawCarrier.element.kind === "union");
  const carrierD: D = {
    kind: "array",
    element: {
      kind: "union",
      options: rawCarrier.element.options.map((d) => {
        invariant(d.kind === "record");
        return {
          kind: "record",
          fields: {
            artifact_id: defined(d.fields.artifact_id),
            canonical_payload: defined(d.fields.canonical_payload),
          },
        };
      }),
    },
  };
  const source2: Record<string, D> = {};
  for (const k of [
    "required_character_refs",
    "required_claim_refs",
    "required_component_refs",
    "required_comprehension_target_refs",
    "required_context_selection_refs",
    "required_policy_refs",
  ])
    source2[k] = { kind: "array", element: { kind: "atom", atom: "s" } };
  for (const k of ["serialized_input_hash", "writer_context_manifest_hash"])
    source2[k] = { kind: "atom", atom: "h" };
  for (const k of [
    "estimated_input_tokens",
    "model_context_limit",
    "reserved_output_tokens",
  ])
    source2[k] = { kind: "atom", atom: "i" };
  source2.completeness_check = {
    kind: "record",
    fields: {
      status: { kind: "atom", atom: "s" },
      missing_refs: { kind: "array", element: { kind: "atom", atom: "s" } },
      forbidden_refs_serialized_to_writer: { kind: "atom", atom: "b" },
      exclusions_applied_count: { kind: "atom", atom: "i" },
    },
  };
  const units: [unknown, D, string][] = [
    [m.claim_bases, inputD(roots.claim_bases), "material.claim_bases"],
    [m.rights_versions, fixedD(RIGHTS), "material.rights_versions"],
    [
      m.evidence_bodies,
      inputD(roots.evidence_bodies),
      "material.evidence_bodies",
    ],
    [m.support_carriers, carrierD, "material.support_carriers"],
    [m.derivations, inputD(roots.derivations), "material.derivations"],
    [c0, { kind: "record", fields: source2 }, "source[2]"],
  ];
  // ROOT124D resolutions1–6, accepted externally by ROOT124F. This is an
  // adjunct of the FIRST unit, not a seventh root or a new diagnostic descendant.
  const supportD: D = {
    kind: "array",
    element: {
      kind: "union",
      options: ["R2e6e421cc770", "R5dd0ea19335c", "Rb1ccb8b4ed76"].map((id) => {
        const d = inputD(id);
        invariant(d.kind === "record");
        return {
          kind: "record",
          fields: {
            ...d.fields,
            claim_id: { kind: "atom", atom: "u" },
            created_at: { kind: "atom", atom: "s" },
          },
        };
      }),
    },
  };
  const selected: D[] = [];
  const work = structuralWork(4641224);
  let supportSelected: D | undefined;
  for (let i = 0; i < units.length; i++) {
    const [v, d, p] = defined(units[i]);
    selected.push(
      admitShape(
        v,
        d,
        p,
        (path) =>
          refuse(4, "source_shape_invalid", p === "source[2]" ? p : path),
        work,
      ),
    );
    if (i === 0)
      supportSelected = admitShape(
        m.supportRows,
        supportD,
        p,
        () => refuse(4, "source_shape_invalid", "material.claim_bases"),
        work,
      );
  }
  for (let i = 0; i < units.length; i++) {
    const [v, , p] = defined(units[i]);
    admitAtoms(v, defined(selected[i]), p, (path) =>
      refuse(4, "source_value_invalid", p === "source[2]" ? p : path),
    );
    if (i === 0)
      admitAtoms(
        m.supportRows,
        defined(supportSelected),
        p,
        () => refuse(4, "source_value_invalid", "material.claim_bases"),
        undefined,
        true,
      );
  }
  const ctx = obj(c0),
    cc = obj(ctx.completeness_check);
  if (
    !["pass", "fail"].includes(str(cc.status)) ||
    num(ctx.model_context_limit) < 1 ||
    num(ctx.model_context_limit) > 262144 ||
    num(ctx.reserved_output_tokens) > 65536 ||
    num(ctx.estimated_input_tokens) > 262144
  )
    refuse(4, "source_value_invalid", "source[2]");
}
function bind(ok: unknown, code: Code, path: string): asserts ok {
  if (!ok) refuse(5, code, path);
}
function eq(a: unknown, b: unknown, code: Code, path: string): void {
  bind(same(a, b), code, path);
}
function digest(v: unknown): string {
  invariant(typeof v === "string" && H.test(v));
  return v;
}
function grants(m: Material): void {
  const evidence = objects(obj(m.package.manifest).evidence);
  for (let i = 0; i < m.rights_versions.length; i++) {
    const row = defined(m.rights_versions[i]),
      expected = defined(RIGHTS[i]),
      policy = obj(row.policy),
      original = obj(expected.policy),
      p = at("material.rights_versions", i) + ".policy";
    const affected = evidence.filter(
        (e) => e.rights_version_id === row.rights_version_id,
      ),
      ceil = obj(policy.consumer_exposure_ceiling);
    bind(
      affected.every((e) =>
        arr(policy.covered_source_identities).includes(
          e.source_identity ?? null,
        ),
      ),
      "rights_grant_refused",
      p + ".covered_source_identities",
    );
    bind(
      policy.acquisition_permission === true,
      "rights_grant_refused",
      p + ".acquisition_permission",
    );
    for (const mode of ["planner", "writer", "auditor"])
      bind(
        affected.every((e) =>
          arr(ceil[mode]).includes(obj(e.consumer_exposure)[mode] as J),
        ),
        "rights_grant_refused",
        p + ".consumer_exposure_ceiling." + mode,
      );
    bind(
      affected.every(
        (e) => !e.quote_permission || policy.quotation_permission === true,
      ),
      "rights_grant_refused",
      p + ".quotation_permission",
    );
    bind(
      affected.every(
        (e) =>
          !e.paraphrase_permission || policy.paraphrase_permission === true,
      ),
      "rights_grant_refused",
      p + ".paraphrase_permission",
    );
    for (const k of [
      "attribution",
      "retention",
      "grantor",
      "grant_identity",
      "covered_source_identities",
      "synthetic_grant",
    ]) {
      const diff = firstDifference(policy[k], original[k], p + "." + k);
      if (diff) refuse(5, "rights_grant_refused", diff);
    }
    eq(
      row.source_identity,
      expected.source_identity,
      "rights_grant_refused",
      at("material.rights_versions", i) + ".source_identity",
    );
    for (const k of ["fixture_stub", "fixture_tts"])
      eq(
        obj(policy.provider_exposure)[k],
        obj(original.provider_exposure)[k],
        "rights_grant_refused",
        p + ".provider_exposure." + k,
      );
    bind(
      obj(policy.provider_exposure).external_providers === false,
      "rights_grant_refused",
      p + ".provider_exposure.external_providers",
    );
    const diff = firstDifference(policy, original, p);
    if (diff) refuse(5, "rights_grant_refused", diff);
  }
}
function bodyBindings(m: Material): void {
  const evidence = objects(obj(m.package.manifest).evidence);
  for (let i = 0; i < m.evidence_bodies.length; i++) {
    const b = defined(m.evidence_bodies[i]),
      p = at("material.evidence_bodies", i);
    const es = evidence.filter(
      (e) => e.evidence_unit_id === b.evidence_unit_id,
    );
    bind(es.length === 1, "source_body_mismatch", p + ".evidence_unit_id");
    const e = defined(es[0]);
    for (const k of ["evidence_type", "rights_version_id", "content_hash"])
      eq(b[k], e[k], "source_body_mismatch", p + "." + k);
    const hash = digest(evidenceBodyHash(str(b.canonical_content)));
    bind(
      hash === b.content_hash,
      "source_body_mismatch",
      p + ".canonical_content",
    );
    bind(
      b.supersedes_evidence_unit_id === null,
      "source_body_mismatch",
      p + ".supersedes_evidence_unit_id",
    );
    const locator = {
      body_codepoint_end: Array.from(str(b.canonical_content)).length,
      body_codepoint_start: 0,
      evidence_unit_id: b.evidence_unit_id,
      kind: "synthetic_fixture_text",
      member: "evidence_store.json",
    };
    eq(e.locator, locator, "source_body_mismatch", p + ".evidence_unit_id");
  }
}
function claimBindings(m: Material): void {
  const f = obj(m.package.manifest),
    claims = objects(f.claims),
    evidence = objects(f.evidence);
  bind(
    claims.length === 9 && m.claim_bases.length === 9,
    "claim_binding_refused",
    "material.claim_bases",
  );
  bind(
    m.evidence_bodies.length === 16,
    "claim_binding_refused",
    "material.evidence_bodies",
  );
  bind(
    m.rights_versions.length === 7,
    "claim_binding_refused",
    "material.rights_versions",
  );
  bind(
    m.supportRows.length === 9,
    "claim_binding_refused",
    "material.claim_bases",
  );
  bind(
    m.derivations.length === 1,
    "claim_binding_refused",
    "material.derivations",
  );
  bind(
    m.support_carriers.length === 2,
    "claim_binding_refused",
    "material.support_carriers",
  );
  for (const [rows, key, p] of [
    [m.claim_bases, "claim_id", "material.claim_bases"],
    [m.rights_versions, "rights_version_id", "material.rights_versions"],
    [m.evidence_bodies, "evidence_unit_id", "material.evidence_bodies"],
    [m.support_carriers, "artifact_id", "material.support_carriers"],
    [m.derivations, "derivation_run_id", "material.derivations"],
  ] as const) {
    const seen = new Set<J>();
    for (let i = 0; i < rows.length; i++) {
      const x = defined(rows[i])[key] ?? null;
      bind(!seen.has(x), "claim_binding_refused", at(p, i) + "." + key);
      seen.add(x);
    }
  }
  for (let i = 0; i < claims.length; i++) {
    const cl = defined(claims[i]),
      base = defined(m.claim_bases[i]),
      p = at("material.claim_bases", i);
    eq(base.claim_id, cl.claim_id, "claim_binding_refused", p + ".claim_id");
  }
  for (let i = 0; i < m.derivations.length; i++) {
    const inputs = objects(defined(m.derivations[i]).exact_input_refs),
      seen = new Set<J>();
    for (let j = 0; j < inputs.length; j++) {
      const id = defined(inputs[j]).evidence_unit_id ?? null;
      bind(
        !seen.has(id),
        "claim_binding_refused",
        at(at("material.derivations", i) + ".exact_input_refs", j) +
          ".evidence_unit_id",
      );
      seen.add(id);
    }
  }
  for (let i = 0; i < claims.length; i++) {
    const cl = defined(claims[i]),
      base = defined(m.claim_bases[i]),
      p = at("material.claim_bases", i);
    eq(base.claim_kind, cl.kind, "claim_binding_refused", p + ".claim_kind");
    eq(
      obj(base.subject).entity_ref,
      cl.subject_ref,
      "claim_binding_refused",
      p + ".subject.entity_ref",
    );
    for (const [source, target] of [
      ["origin", "origin"],
      ["subject_domain", "subject_domain"],
      ["predicate", "predicate"],
      ["value", "value"],
      ["initial_status", "initial_status"],
      ["initial_usage_class", "initial_usage_class"],
    ] as const) {
      if (source === "value") {
        const difference = firstDifference(
          base[source],
          cl[target],
          p + ".value",
        );
        bind(
          difference === null,
          "claim_binding_refused",
          difference ?? p + ".value",
        );
      } else
        eq(base[source], cl[target], "claim_binding_refused", p + "." + source);
    }
    bind(
      base.supersedes_claim_id === null,
      "claim_binding_refused",
      p + ".supersedes_claim_id",
    );
    const hash = digest(claimContentHash(base));
    eq(hash, base.content_hash, "claim_binding_refused", p + ".content_hash");
    eq(
      hash,
      cl.claim_content_hash,
      "claim_binding_refused",
      p + ".content_hash",
    );
    eq(
      digest(
        claimFrozenStateHash({
          claim_content_hash: hash,
          state: cl.frozen_state,
          effective_usage_class: cl.effective_usage_class,
        }),
      ),
      cl.frozen_state_hash,
      "claim_binding_refused",
      p + ".content_hash",
    );
    bind(
      cl.state_event_cursor === null &&
        cl.frozen_state === cl.initial_status &&
        cl.reduced_usage_class === cl.initial_usage_class &&
        usages.indexOf(str(cl.effective_usage_class)) >=
          Math.max(
            usages.indexOf(str(cl.initial_usage_class)),
            usages.indexOf(str(cl.reduced_usage_class)),
          ),
      "claim_binding_refused",
      p + ".initial_usage_class",
    );
    const ss = m.supportRows.filter((s) => s.claim_id === cl.claim_id),
      refs = objects(cl.support_refs);
    bind(ss.length === refs.length, "claim_binding_refused", p);
    for (let j = 0; j < refs.length; j++) {
      const r = defined(refs[j]),
        s = defined(ss[j]);
      for (const k of Object.keys(r))
        eq(s[k], r[k], "claim_binding_refused", p);
      bind(
        !["lore", "prediction"].includes(str(s.support_kind)),
        "claim_binding_refused",
        p,
      );
    }
  }
  for (let i = 0; i < m.support_carriers.length; i++) {
    const r = defined(m.support_carriers[i]),
      p = at("material.support_carriers", i),
      arts = objects(value(m.tables, "artifacts")).filter(
        (a) => a.artifact_id === r.artifact_id,
      );
    bind(arts.length === 1, "claim_binding_refused", p + ".artifact_id");
    const a = defined(arts[0]);
    eq(
      a.canonical_payload,
      r.canonical_payload,
      "claim_binding_refused",
      p + ".canonical_payload",
    );
    const hash = digest(fixtureSupportObjectHash(r.canonical_payload));
    eq(a.content_hash, hash, "claim_binding_refused", p + ".canonical_payload");
  }
  // Existing signal/derivation/continuity and other-family checks below operate on
  // these independently admitted originals. ALL sixteen body bytes were checked.
  const carriers = m.support_carriers.map((r) => ({
    ...r,
    content_hash: digest(fixtureSupportObjectHash(r.canonical_payload)),
  }));
  const c: Context = {
    package: m.package,
    manifest: f,
    material: m as unknown as O,
    claims,
    evidence,
    bases: m.claim_bases,
    rights: m.rights_versions,
    bodies: m.evidence_bodies,
    carriers,
    derivations: m.derivations,
    beats: objects(f.beats),
    signals: objects(f.signals),
    continuity: objects(f.continuity),
  };
  consistency(c);
}

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
function mappedPath(path: string): string {
  const claim = /^package\.manifest\.claims\[(\d+)\](.*)$/.exec(path);
  if (claim) {
    const suffix = claim[2] ?? "";
    if (
      suffix.startsWith(".support_refs") ||
      [
        ".frozen_state_hash",
        ".claim_content_hash",
        ".effective_usage_class",
        ".state_event_cursor",
      ].some((k) => suffix.startsWith(k))
    )
      return at("material.claim_bases", Number(claim[1]));
    return (
      at("material.claim_bases", Number(claim[1])) +
      suffix
        .replace(/^\.kind(?=\.|$)/, ".claim_kind")
        .replace(/^\.subject_ref$/, ".subject.entity_ref")
    );
  }
  if (path.startsWith("material.")) return path;
  return "material.claim_bases";
}
function check(ok: unknown, path: string, code?: string): asserts ok;
function check(ok: unknown, path: string): asserts ok {
  bind(ok, "claim_binding_refused", mappedPath(path));
}
function boundEqual(a: unknown, b: unknown, path: string, code?: string): void;
function boundEqual(a: unknown, b: unknown, path: string): void {
  check(same(a, b), path);
}
function lookup(rows: readonly O[], key: string, id: unknown, path: string): O {
  const found = rows.filter((r) => r[key] === id);
  check(found.length === 1, path);
  return defined(found[0]);
}
const artifact =
  /^artifact:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function isJsonObject(v: unknown): v is O {
  return plain(v);
}
function keyset(v: unknown, names: readonly string[]): boolean {
  return (
    plain(v) &&
    keys(v).length === names.length &&
    names.every((k) => Object.hasOwn(v, k))
  );
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
    bodies,
    carriers,
    derivations,
    beats,
    signals,
    continuity,
  } = c;
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
          hash = digest(derivationOutputHash(d.output));
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
        const hash = digest(fixtureSupportObjectHash(payload));
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
  // 7. Recorded signal consistency, after bodyBindings recomputed ALL sixteen bodies.
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

function assertExposureSafe(w: unknown, r: unknown, m: Material): void {
  const claims = objects(obj(m.package.manifest).claims),
    c3 = defined(claims.find((c) => c.value_type === "structured_text")),
    c4 = defined(claims.find((c) => c.value_type === "analysis_text"));
  const forbidden = str(obj(c4.value).interpretation),
    structured = c3.value;
  function visit(x: unknown): void {
    invariant(!same(x, structured));
    if (typeof x === "string") {
      invariant(!x.includes(forbidden));
      return;
    }
    if (Array.isArray(x)) {
      for (let i = 0; i < x.length - 1; i++)
        if (typeof x[i] === "string" && typeof x[i + 1] === "string")
          invariant(!(String(x[i]) + String(x[i + 1])).includes(forbidden));
    }
    if (x !== null && typeof x === "object")
      for (const k of Object.keys(x)) {
        invariant(!k.includes(forbidden));
        visit(value(x, k));
      }
  }
  visit(w);
  visit(r);
}
function registry(m: Material): O {
  const f = obj(m.package.manifest),
    claims = objects(f.claims),
    evidence = objects(f.evidence);
  const es = META.wordings.map((q) => {
    const e = lookup(
      evidence,
      "evidence_unit_id",
      q.source_evidence_unit_id,
      "material.evidence_bodies",
    );
    const body = lookup(
      m.evidence_bodies,
      "evidence_unit_id",
      q.source_evidence_unit_id,
      "material.evidence_bodies",
    );
    const right = lookup(
      m.rights_versions,
      "rights_version_id",
      e.rights_version_id,
      "material.rights_versions",
    );
    const target =
      q.target_kind === "claim"
        ? lookup(claims, "claim_id", q.target_id, "material.claim_bases")
        : e;
    bind(
      e.source_identity === q.source_identity &&
        body.content_hash === e.content_hash,
      "representation_binding_refused",
      "registry",
    );
    const mode = obj(e.consumer_exposure).writer;
    bind(
      mode === "paraphrase" || mode === "exact_excerpt",
      "representation_binding_refused",
      "registry",
    );
    bind(
      mode !== "paraphrase" || obj(right.policy).paraphrase_permission === true,
      "representation_binding_refused",
      "registry",
    );
    bind(
      mode !== "exact_excerpt" || e.quote_permission === true,
      "representation_binding_refused",
      "registry",
    );
    if (mode === "paraphrase") invariant(q.text !== body.canonical_content);
    else
      bind(
        obj(e.permitted_quote).text === q.text,
        "representation_binding_refused",
        "registry",
      );
    return rec({
      representation_id: q.representation_id,
      target_kind: q.target_kind,
      target_id: q.target_id,
      target_hash:
        q.target_kind === "claim"
          ? target.claim_content_hash
          : target.content_hash,
      source_evidence_unit_id: e.evidence_unit_id,
      source_content_hash: body.content_hash,
      source_identity: e.source_identity,
      rights_version_id: right.rights_version_id,
      rights_policy_identity: id(right.policy),
      consumer: "writer",
      exposure: mode,
      usage_class:
        q.target_kind === "claim"
          ? target.effective_usage_class
          : body.usage_class,
      text: q.text,
      text_sha256: raw(q.text),
    });
  });
  const r = rec({
    schema: "writer-fixture-representations/2",
    policy_sources: META.policies,
    entries: es,
  });
  assertExposureSafe(null, r, m);
  return r;
}
interface Projection {
  w: O;
  r: O;
  order: string[];
  exclusions: number;
  characters: string[];
  contexts: string[];
  targets: string[];
}
function project(m: Material, load: O, docs: unknown[]): Projection {
  const b = obj(load.brief),
    f = obj(m.package.manifest),
    claims = objects(f.claims),
    ev = objects(f.evidence),
    blocks = objects(b.program_blocks),
    r = registry(m);
  const order: string[] = [];
  const add = (id: unknown): void => {
    bind(typeof id === "string", "selection_refused", "writer_data");
    if (!order.includes(id)) order.push(id);
  };
  for (const block of blocks)
    for (const a of objects(block.claim_evidence_assignments))
      for (const ref of arr(a.claim_ids)) add(ref);
  for (const cs of objects(b.context_selections)) {
    const found = objects(f.context_candidates).filter(
      (c) => c.context_id === cs.context_id,
    );
    bind(found.length === 1, "selection_refused", "writer_data");
    add(defined(found[0]).claim_id);
  }
  const fixed = [1, 2, 7, 3, 4, 5, 6, 9].map(
    (n) => "d1250008-0000-4000-8000-" + String(n).padStart(12, "0"),
  );
  bind(same(order, fixed), "selection_refused", "writer_data");
  const registryEntries = objects(r.entries),
    evidenceOrder: string[] = [];
  const outClaims = order.map((id) => {
    const cl = lookup(claims, "claim_id", id, "material.claim_bases");
    bind(
      cl.effective_usage_class !== "silent",
      "exposure_refused",
      "writer_data",
    );
    const refs = objects(cl.support_refs).map((s) => {
      const type = {
        evidence: "evidence_unit",
        derivation: "derivation_run",
        signal: "tenor_reading",
        continuity: "continuity",
      }[str(s.support_kind)];
      invariant(type);
      if (s.support_kind === "evidence") {
        const e = lookup(
          ev,
          "evidence_unit_id",
          s.evidence_unit_id,
          "material.evidence_bodies",
        );
        const mode = obj(e.consumer_exposure).writer;
        bind(mode !== "hidden", "exposure_refused", "writer_data");
        if (
          (mode === "paraphrase" || mode === "exact_excerpt") &&
          !evidenceOrder.includes(str(e.evidence_unit_id))
        )
          evidenceOrder.push(str(e.evidence_unit_id));
      }
      return rec({
        ref:
          s.evidence_unit_id ??
          s.derivation_run_id ??
          s.external_support_identity,
        role: s.support_role,
        type,
      });
    });
    const withheld =
      cl.value_type === "structured_text" || cl.value_type === "analysis_text";
    const derivative = registryEntries.find(
      (e) => e.target_kind === "claim" && e.target_id === id,
    );
    const original: Obj = {};
    for (const k of [
      "claim_id",
      "claim_content_hash",
      "frozen_state",
      "frozen_state_hash",
      "kind",
      "subject_domain",
      "subject_ref",
      "predicate",
      "value_type",
      "origin",
      "effective_usage_class",
      "attribution_requirement",
    ])
      original[k] = cl[k];
    return rec({
      ...original,
      value: withheld ? null : cl.value,
      value_status: withheld ? "withheld_original_text_value" : "original",
      approved_representation: derivative
        ? derivative.text
        : cl.approved_representation,
      support_refs: refs,
    });
  });
  bind(
    same(
      evidenceOrder,
      [3, 4, 9].map(
        (n) => "d1250007-0000-4000-8000-" + String(n).padStart(12, "0"),
      ),
    ),
    "selection_refused",
    "writer_data",
  );
  const outEvidence = evidenceOrder.map((id) => {
    const e = lookup(ev, "evidence_unit_id", id, "material.evidence_bodies"),
      entry = registryEntries.find(
        (r) => r.target_kind === "evidence" && r.target_id === id,
      );
    invariant(entry);
    return rec({
      evidence_unit_id: e.evidence_unit_id,
      content_hash: e.content_hash,
      evidence_type: e.evidence_type,
      modality: e.modality,
      origin: e.origin,
      source_role: e.source_role,
      quote_permission: e.quote_permission,
      paraphrase_permission: e.paraphrase_permission,
      rights_policy_version: e.rights_version_id,
      locator: rec({ ref: id, type: "fixture_record" }),
      authorized_representation: entry.text,
      consumer_exposure: rec({ writer: obj(e.consumer_exposure).writer }),
    });
  });
  const profiles = objects(obj(docs[4]).profiles),
    characterProfiles: Obj = {};
  for (const p of profiles) {
    invariant(typeof p.participant_id === "string");
    characterProfiles[p.participant_id] = p.participant_profile_version_id;
  }
  const w = rec({
    purpose: "evaluation",
    showrunner_brief_version_id: b.showrunner_brief_version_id,
    brief_hash: b.brief_hash,
    evidence_package_id: m.package.id,
    package_hash: m.package.package_hash,
    show_version: b.show_version,
    writing_policy_version: "writing-0.2.3",
    writing_craft_policy_version: "writing-craft-0.1",
    character_profile_versions: rec(characterProfiles),
    locale: obj(obj(docs[5]).canonical_payload).default_output_language,
    runtime_and_block_budgets: b.runtime_target,
    program_block_refs: blocks.map((x) => x.program_block_id),
    selected_claims: outClaims,
    selected_evidence: outEvidence,
    context_selections: b.context_selections,
    comprehension_targets: b.comprehension_targets,
    compact_writing_standard: rec({
      version: "writer-fixture-compact-standard/2",
      principles: META.principles,
    }),
    recent_pattern_signals: META.patterns,
    live_search: false,
  });
  // Generated-data checks are invariant faults, not alternate source refusals.
  const bad = (): never => {
    throw new TypeError();
  };
  shape(w, OUTPUT_SHAPE.writer_data, "writer_data", bad);
  assertExposureSafe(w, r, m);
  const refs = new Set<string>();
  function stringsIn(x: unknown): void {
    if (typeof x === "string") refs.add(x);
    else if (x !== null && typeof x === "object")
      for (const [k, v] of Object.entries(x)) {
        refs.add(k);
        stringsIn(v);
      }
  }
  stringsIn(w);
  const exclusions = objects(b.planning_exclusions),
    applied: string[] = [];
  const beatIds = [
    ...objects(b.selected_beats).map((x) => x.beat_id),
    ...blocks.flatMap((x) => arr(x.selected_beat_ids)),
  ];
  for (const x of exclusions) {
    const ok =
      x.scope_type === "beat"
        ? x.effect === "omit_from_programming" && !beatIds.includes(x.scope_ref)
        : x.effect === "forbidden_to_writer" && !refs.has(str(x.scope_ref));
    bind(
      ok && !applied.includes(str(x.exclusion_id)),
      "exposure_refused",
      "writer_data",
    );
    applied.push(str(x.exclusion_id));
  }
  bind(applied.length === 3, "completeness_refused", "writer_context_manifest");
  const characterIds = profiles.map((p) => str(p.participant_id));
  for (const block of blocks) {
    for (const p of [
      ...objects(block.participant_leads),
      ...objects(block.claim_evidence_assignments),
    ])
      bind(
        characterIds.includes(str(p.participant_id)),
        "selection_refused",
        "writer_data",
      );
    for (const beat of arr(block.selected_beat_ids))
      bind(
        objects(f.beats).some((x) => x.beat_id === beat),
        "selection_refused",
        "writer_data",
      );
  }
  const contexts = objects(b.context_selections),
    targets = objects(b.comprehension_targets);
  bind(
    new Set(order).size === order.length,
    "completeness_refused",
    "writer_context_manifest",
  );
  for (const cs of contexts)
    bind(
      blocks.some((x) => x.program_block_id === cs.program_block_id) &&
        objects(f.context_candidates).filter(
          (x) => x.context_id === cs.context_id,
        ).length === 1,
      "completeness_refused",
      "writer_context_manifest",
    );
  for (const t of targets)
    bind(
      arr(t.supporting_claim_refs).every((x) => order.includes(str(x))),
      "completeness_refused",
      "writer_context_manifest",
    );
  bind(
    num(obj(b.runtime_target).seconds) === 240 &&
      blocks.reduce(
        (n, x) => n + num(obj(x.target_duration_or_words).seconds),
        0,
      ) === 330,
    "selection_refused",
    "writer_data",
  );
  const conf = obj(obj(docs[5]).canonical_payload),
    band = obj(conf.configured_runtime_seconds);
  bind(
    num(band.min) <= 240 && num(band.max) >= 330,
    "selection_refused",
    "writer_data",
  );
  return {
    w,
    r,
    order,
    exclusions: applied.length,
    characters: profiles.map((p) => str(p.participant_profile_version_id)),
    contexts: contexts.map((c) => str(c.context_selection_id)),
    targets: targets.map((t) => str(t.comprehension_target_id)),
  };
}

function documentaryBindings(
  m: Material,
  load: O,
  planner: O,
  docs: unknown[],
): void {
  const b = obj(load.brief),
    d = obj(load.provenance),
    bad = (): never => refuse(5, "parent_binding_refused", "binding");
  const find = (family: string, key: string, id: unknown): Obj => {
    const rs = objects(value(m.tables, family)).filter((r) => r[key] === id);
    if (rs.length !== 1) bad();
    return obj(rs[0]);
  };
  const specs = [
    ["brief_artifact", "artifacts", "artifact_id"],
    [
      "brief_version",
      "showrunner_brief_versions",
      "showrunner_brief_version_id",
    ],
    ["model_run", "model_runs", "model_run_id"],
    ["package_version", "evidence_packages", "evidence_package_id"],
    ["planning_attempt", "program_run_attempts", "attempt_id"],
    ["program_run", "program_runs", "program_run_id"],
    ["prompt_manifest", "prompt_manifests", "prompt_manifest_id"],
    ["provider_call", "provider_calls", "provider_call_id"],
    ["provider_event", "provider_call_events", "provider_call_event_id"],
  ] as const;
  for (const [name, family, key] of specs) {
    const expected = obj(d[name]),
      row = find(family, key, expected[key]);
    for (const k of Object.keys(expected))
      if (!same(value(row, k), expected[k])) bad();
  }
  const art = find("artifacts", "artifact_id", b.artifact_id);
  if (!same(art.canonical_payload, b)) bad();
  const packageArtifact = find(
    "artifacts",
    "artifact_id",
    m.package.artifact_id,
  );
  if (
    !same(packageArtifact.canonical_payload, m.package) ||
    packageArtifact.content_hash !== m.package.package_hash
  )
    bad();
  const packageRow = find(
    "evidence_packages",
    "evidence_package_id",
    m.package.id,
  );
  if (
    packageRow.artifact_id !== m.package.artifact_id ||
    packageRow.package_hash !== m.package.package_hash
  )
    bad();
  const config = obj(docs[5]),
    configRow = find(
      "show_config_versions",
      "show_config_version_id",
      config.show_config_version_id,
    );
  if (!same(configRow, config)) bad();
  const pc = obj(planner.programming_configuration);
  for (const [key, index] of [
    ["participant_profiles", 4],
    ["show_config_version", 5],
    ["rundown_template", 6],
    ["episode_mode_registry", 7],
    ["block_type_registry", 8],
  ] as const)
    if (!same(pc[key], docs[index])) bad();
  const p = obj(planner.planner_data);
  if (
    p.package_id !== m.package.id ||
    p.package_hash !== m.package.package_hash ||
    p.scope_hash !== m.package.scope_hash
  )
    bad();
  for (const block of objects(b.program_blocks)) {
    const row = find(
        "program_blocks",
        "program_block_id",
        block.program_block_id,
      ),
      semantic: Obj = {};
    for (const k of Object.keys(block))
      if (!["program_block_id", "block_type", "sequence"].includes(k))
        semantic[k] = block[k];
    if (
      row.showrunner_brief_version_id !== b.showrunner_brief_version_id ||
      row.block_type !== block.block_type ||
      row.sequence !== block.sequence ||
      !same(row.semantic_payload, semantic)
    )
      bad();
  }
}
function envelope(
  p: Projection,
  c: Captured,
  ctx: O,
  wIdentity: { utf8_bytes: string; sha256: string },
  writerHash: string,
  contextHash: string,
): O {
  return {
    schema: PROFILE,
    assurance: "fixed_historical_fixture_data_only",
    writer_data: p.w,
    writer_context_manifest: ctx,
    identities: {
      writer_data: wIdentity,
      writer_view_sha256: writerHash,
      writer_context_sha256: contextHash,
    },
    binding: {
      planner_identity: {
        utf8_bytes: "55418",
        sha256:
          "dfe650e4eae99674fc0868b7d6feb1c89c5e13a5aa62534cd10bd72f974b6a5a",
      },
      brief_identity: {
        utf8_bytes: "15966",
        sha256:
          "eba56df10b5004d7585b9cae219d859e59b15875912c54a93b25dabc909c1b60",
      },
      representation_registry: id(p.r),
      budget_profile: "fixture-writer-byte-units/1",
      source_observations: c.observations,
      policy_sources: META.policies,
    },
    limits: META.limits,
  };
}
// Validate every reconstruction descriptor before serialization or ordinary Get.
// Final public copies also own each occurrence independently of private inputs.
function admitReconstruction(
  actual: unknown,
  expected: unknown,
  unique = false,
  seen = new Set<object>(),
  privateNodes?: ReadonlySet<object>,
): void {
  if (expected === null || typeof expected !== "object") {
    invariant(Object.is(actual, expected));
    return;
  }
  invariant(actual !== null && typeof actual === "object");
  const value = actual;
  if (unique) {
    invariant(!seen.has(value) && !privateNodes?.has(value));
    seen.add(value);
  }
  const list = Array.isArray(expected);
  invariant(Array.isArray(value) === list);
  invariant(
    list ? Object.getPrototypeOf(value) === Array.prototype : plain(value),
  );
  if (unique && !list)
    invariant(Object.getPrototypeOf(value) === Object.prototype);
  const wanted = Reflect.ownKeys(expected),
    found = Reflect.ownKeys(value);
  invariant(
    found.length === wanted.length &&
      found.every((k) => typeof k === "string" && wanted.includes(k)),
  );
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const expectedDescriptors = Object.getOwnPropertyDescriptors(expected);
  for (const key of wanted) {
    invariant(typeof key === "string");
    const d = descriptors[key],
      e = expectedDescriptors[key];
    invariant(
      d !== undefined && e !== undefined && "value" in d && "value" in e,
    );
    invariant(d.enumerable === !(list && key === "length"));
    admitReconstruction(
      d.value as unknown,
      e.value as unknown,
      unique,
      seen,
      privateNodes,
    );
  }
}
function admitFinalCopy(
  actual: unknown,
  expected: unknown,
  privateRoots: readonly unknown[],
): void {
  const privateNodes = new Set<object>();
  function mark(v: unknown): void {
    if (v === null || typeof v !== "object" || privateNodes.has(v)) return;
    privateNodes.add(v);
    for (const d of Object.values(Object.getOwnPropertyDescriptors(v))) {
      invariant("value" in d);
      mark(d.value as unknown);
    }
  }
  mark(expected);
  for (const root of privateRoots) mark(root);
  admitReconstruction(actual, expected, true, new Set<object>(), privateNodes);
}
/** Fixed zero-argument historical DATA boundary. No execution or provider wiring. */
export function buildFixtureWriterInput(): FixtureWriterInputResult {
  let phase: FixtureWriterInputPhase = 0;
  try {
    if (arguments.length !== 0) refuse(0, "arguments_refused", "input");
    phase = 1;
    const plannerResult = prepareShowrunnerFixtureInput(),
      planner = admitParent(plannerResult, 1);
    phase = 2;
    const loadResult = loadShowrunnerFixtureBrief(),
      load = admitParent(loadResult, 2);
    phase = 3;
    let rawPack: unknown;
    try {
      rawPack = openFixturePack();
    } catch (e) {
      const code = known(e, FixtureIntegrityError, R1);
      if (code) refuse(3, "reader_refused", "pack", code);
      throw e;
    }
    const admitted = admitPack(rawPack),
      captured = capture(admitted.pack, admitted.member),
      docs = parseSources(captured);
    phase = 4;
    const prerequisite = prerequisites(docs, admitted);
    for (const i of [1, 3, 4, 5, 6, 7, 8, 9, 10]) pinSource(captured, i);
    for (let i = 0; i < 5; i++) {
      const actual = defined(captured.policyIdentities[i]),
        expected = defined(META.policies[i]);
      if (
        actual.utf8_bytes !== expected.utf8_bytes ||
        actual.sha256 !== expected.sha256
      )
        refuse(
          4,
          "policy_source_identity_mismatch",
          "policy[" + String(i) + "]",
        );
    }
    for (const spec of AUXILIARY_CANONICAL) {
      const index = META.sources.findIndex((s) => s.member === spec.member);
      invariant(index >= 0);
      invariant(
        count(docs[index], spec.canonical_bytes) === spec.canonical_bytes,
      );
      const json = canonical(docs[index]);
      invariant(
        Buffer.byteLength(json, "utf8") === spec.canonical_bytes &&
          raw(json) === spec.canonical_sha256,
      );
    }
    const m = material(prerequisite, docs);
    localAdmission(m, docs[2]);
    originalCorrespondence(captured, docs);
    phase = 5;
    grants(m);
    bodyBindings(m);
    claimBindings(m);
    const projection = project(m, load, docs);
    documentaryBindings(m, load, planner, docs);
    phase = 6;
    let wCount: number;
    try {
      wCount = count(projection.w);
    } catch (e) {
      if (e instanceof CountExceeded)
        refuse(6, "input_resource_limit", "writer_data");
      throw e;
    }
    const writerText = canonical(projection.w);
    invariant(Buffer.byteLength(writerText, "utf8") === wCount);
    const writerIdentity = {
        utf8_bytes: String(wCount),
        sha256: raw(writerText),
      },
      writerHash = domain("writer-view-v2", projection.w);
    const settings = obj(docs[2]),
      estimated = Math.floor((wCount + 3) / 4);
    if (
      estimated + num(settings.reserved_output_tokens) >
      num(settings.model_context_limit)
    )
      refuse(6, "budget_refused", "writer_context_manifest");
    const ctx = rec({
      required_component_refs: [
        "showrunner_brief.json",
        PROFILE + ":writer_data",
      ],
      required_claim_refs: projection.order,
      required_context_selection_refs: projection.contexts,
      required_character_refs: projection.characters,
      required_policy_refs: META.policies.slice(0, 4).map((x) => x.version),
      required_comprehension_target_refs: projection.targets,
      serialized_input_hash: writerIdentity.sha256,
      estimated_input_tokens: estimated,
      model_context_limit: settings.model_context_limit,
      reserved_output_tokens: settings.reserved_output_tokens,
      completeness_check: rec({
        status: "pass",
        missing_refs: [],
        forbidden_refs_serialized_to_writer: false,
        exclusions_applied_count: projection.exclusions,
      }),
    });
    shape(
      ctx,
      OUTPUT_SHAPE.writer_context_manifest,
      "writer_context_manifest",
      () => {
        throw new TypeError();
      },
    );
    assertExposureSafe(ctx, projection.r, m);
    const contextHash = domain("writer-context-manifest-v2", ctx),
      prospective = envelope(
        projection,
        captured,
        ctx,
        writerIdentity,
        writerHash,
        contextHash,
      );
    let aCount: number;
    try {
      aCount = count(prospective);
    } catch (e) {
      if (e instanceof CountExceeded)
        refuse(6, "output_resource_limit", "data");
      throw e;
    }
    phase = 7;
    pinSource(captured, 0);
    pinSource(captured, 2);
    invariant(
      same(id(projection.r), {
        utf8_bytes: "5394",
        sha256:
          "03a4eadf3955e89c59837a9838f253490c9bb6f18bffa5d432dea1e98257a309",
      }),
    );
    invariant(
      writerIdentity.utf8_bytes === "11788" &&
        writerIdentity.sha256 ===
          "d4b955b1b2f10bfea357547d243b182587b040b2590b3a2701979e88b96ebe1e",
    );
    invariant(
      writerHash ===
        "05d2d0ccd6f46cd62d9ce65f6ce79df8b7bc3670a4fb4af3fc2821cedb7735b5" &&
        contextHash ===
          "58a54994fecae57803e15544d96901ee21d7a9b743ed242c6794b9c46bb58432",
    );
    invariant(aCount === 17006);
    phase = 8;
    const data = copy(prospective) as FixtureWriterInputData;
    admitFinalCopy(data, prospective, [
      plannerResult,
      loadResult,
      planner,
      load,
      docs,
      m,
      projection,
    ]);
    const json = canonical(data),
      identity = {
        utf8_bytes: String(Buffer.byteLength(json, "utf8")),
        sha256: raw(json),
      };
    invariant(
      identity.utf8_bytes === String(aCount) &&
        identity.sha256 ===
          "3559c08222d4703dac0ee7504ccd28962cf02bd075e4e7842dcc03d7ff298e9a",
    );
    const result = {
      kind: "fixture_writer_input" as const,
      profile: PROFILE as typeof PROFILE,
      data,
      writer_data_json: writerText,
      data_json: json,
      identity,
    };
    freeze(result);
    return result;
  } catch (e) {
    if (e instanceof Refused) return e.result;
    throw new FixtureWriterInputFault(phase);
  }
}
