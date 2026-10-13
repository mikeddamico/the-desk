// PC2: fixed-fixture evaluation DATA, unwired. Closed tuple02/03/ROOT04/05.
// Existing reader/input grammar remain qualified dependencies, not authentication.
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { ZodError } from "zod";
import {
  openFixturePack,
  FixtureIntegrityError,
  type Pack,
} from "../fixture/pack.js";
import { FIXTURE_V046_PINS } from "../fixture/pins.js";
import { parseFoundationRows } from "../fixture/rows.js";
import { canonicalJson, domainHash } from "../identity/canonical-json.js";
import { evidenceBodyHash } from "../identity/domains.js";
import { evidencePackageHash } from "../identity/artifacts.js";
import {
  claimContentHash,
  claimFrozenStateHash,
  derivationOutputHash,
  fixtureSupportObjectHash,
} from "../identity/knowledge.js";
import { showConfigVersionHash } from "../identity/show-config.js";
import { ProfileRejected } from "../identity/profile-errors.js";
import {
  materializePlannerFixtureConsumerSnapshot,
  type PlannerFixtureConsumerRejection,
} from "./planner-fixture-consumer-snapshot.js";

export const PROFILE = "showrunner-fixture-input-candidate/1";
const CAP = 2097152;
const SOURCE_CAP = 1048576;
type J = null | boolean | number | string | J[] | { [key: string]: J };
type O = Record<string, J>;

// Frozen contract DATA. Structural derivations select ONLY these reviewed literals;
// new fields require a challenged/accepted revision, never infer from returned data.
const FIXED_M = {
  assurance: "source_bound_fixture_candidate",
  execution_permission: false,
  fixture_binding: {
    active_load_member: "foundation_rows_398.json",
    active_load_rows: 398,
    container_observation: "existing_reader_check_not_atomic_zip_snapshot",
    fixture_version: "0.4.6",
    pack_members_sha256_anchor:
      "58a3c5e6188a91eba380c4cb4c08fbebb747513b5979ca9b3b0baab61d5b84fe",
    selected_member_binding: "actual_member_bytes",
    selected_members: [
      {
        bytes: 471514,
        member: "foundation_rows_398.json",
        role: "active_load",
        sha256:
          "a27f4381bd6449bfb656c6431b56115a932e05c82791696fc293c701c0a58a7e",
      },
      {
        bytes: 54034,
        member: "evidence_package.json",
        role: "artifact_payload_member",
        sha256:
          "bd9f5ff68156d6c03184c0e6d2f1acccc35bbb0c0223ab4ab611fb9378ba05f9",
      },
      {
        bytes: 3960,
        member: "support_payloads.json",
        role: "artifact_payload_container",
        sha256:
          "bb3fd40fc1ccbb182fc00fd42c04d67517163c8aa4f6ee23e774cb0c3da75d58",
      },
      {
        bytes: 5005,
        member: "config/policy_versions.json",
        role: "configuration",
        sha256:
          "5d02892aeb53f8236e437a3728e383beb5d0534c85760072ea5c3a32e36c6b18",
      },
      {
        bytes: 1188,
        member: "config/show_config_version.json",
        role: "configuration",
        sha256:
          "2024e994b1fb6d772f04dd604d589fd2155015197591f9505ebd9ab0e646b5a7",
      },
      {
        bytes: 381,
        member: "config/episode_modes.json",
        role: "programming_configuration",
        sha256:
          "b03b3889cdc1b1facf4be77d76e2212d3d166f7e406c589aae8a9e8bf1d06586",
      },
      {
        bytes: 3591,
        member: "config/rundown_template_post_event_launch_v2.json",
        role: "programming_configuration",
        sha256:
          "4c74bc6563680d907233921333a6528463ec5819a2375786ba77efbb15e3a9f6",
      },
      {
        bytes: 635,
        member: "config/participant_profiles.json",
        role: "programming_configuration",
        sha256:
          "86fc33c6c4d9bb6c1226f4774815341716a677d8a04bfacea997658087440b61",
      },
      {
        bytes: 1467,
        member: "config/block_types.json",
        role: "programming_configuration",
        sha256:
          "a6db53ee315437200bfadd76c988860512a9a36588e865dd8d78581c32dcfbb7",
      },
    ],
    zip_sha256_anchor:
      "7e1bb1108cdd84e47269b9ab2dab20ba934fcec64d44262f86d2b505616b0747",
  },
  inspection_dependency: {
    assurance: "snapshot_consistency_only",
    input_identity: {
      bytes: 78389,
      sha256:
        "4d147c9cc1cbaaa8abfe5f44bb3ebcbd2cbdcac44e8c3b57fd4cbc1be9565751",
    },
    limits: [
      "authentic_persisted_freeze_not_verified",
      "current_rights_and_current_use_not_verified",
      "evidence_paraphrases_not_materialized",
      "two_free_text_claim_values_withheld",
      "approved_claim_representation_prose_not_emitted",
      "complete_fixture_consumer_adequacy_not_established",
      "support_sufficiency_and_semantic_truth_not_certified",
      "planner_configuration_and_execution_not_included",
    ],
    material_text_identity: {
      bytes: 37600,
      sha256:
        "67773b6917993ef1f644707d8559fb0a63834e6f5d87cd264783415b3de897af",
    },
    materialization: "supplied_snapshot_candidate",
    package_text_identity: {
      bytes: 40713,
      sha256:
        "62a5d00b86a7bd3661ff2b2542fdd1f31051c981098f519aa0965747a1c51ee5",
    },
    profile: "planner-fixture-consumer-snapshot/1",
    view_canonical_identity: {
      bytes: 62964,
      sha256:
        "f00c6001ac059a75fc45d7d92c2d17e5ed5412d85974c99a37a7ffb6e861e05f",
    },
    view_domain_sha256:
      "381b304c8291412614d1d4fb1378bac328e13546b730c6a4847ab9552fa646f6",
  },
  policy_reference_binding:
    "selected_fixture_policy_map_not_fresh_live_authority",
  policy_source_hashes: {
    autonomous_operation_policy:
      "24d285344f29316d83929857c167891b082e83ee0923b11dc3a1b4f7e35cc89b",
    claims_policy:
      "d62323da55dea8f0aa0754ead2fb27efd435e744c600215a9de71a712afaa9ed",
    direction_spec:
      "959474f6f90668b0c5d76e2bd4deafdb9cb52e8df706e469dc9d4b7b088381dc",
    evidence_package_spec:
      "f12582a70cd9223fdd05dbabf8bf2fbddfe11816ab4c1925d24e24c8051e71ea",
    hashing_contract:
      "a78ac9478b8ee9a55caae21ba07fd1106e110ba6cd30de807181cd4a15a10e89",
    operator_repair_policy:
      "4754180431d65e9c4e66bbb1af4c4036830651b86d0eaef1c1a57bcb11c9d686",
    planning_policy:
      "8a658b976a3c9d73bb2e039655ab4016af867b919d906bbc07aef286555b7367",
    writing_craft_policy:
      "07b9cc27d2e20882c8890aec8c5432044aa9d5b295b7ac166e9e99beec30ad04",
    writing_fixture_profile_addendum:
      "79ea43076b0b5ca68916f8e12ac3457e48c6ad31a9bf5f1c47034fcb1de7f55f",
    writing_policy:
      "62f2a4c5424a39ee445929a47c2ffea070eb3ded40767876ae328fe2dcc42bda",
  },
  programming_configuration: {
    block_type_registry: {
      registry_version: "block-types-v2",
      values: [
        {
          id: "cold_open",
          job: "low-stakes off-match opening texture; optional when mode/sensitivity permits",
          owner: "programming",
        },
        {
          id: "host_cut_in",
          job: "brief anchor interruption that starts the formal show",
          owner: "programming",
        },
        {
          id: "orientation",
          job: "result/context orientation and central question",
          owner: "programming",
        },
        {
          id: "analysis",
          job: "substantive contestable analytical beat",
          owner: "programming",
        },
        {
          id: "recap_turn",
          job: "synthesis and meaningful bridge",
          owner: "programming",
        },
        {
          id: "feature_or_analysis",
          job: "second analytical beat or one triggered configured feature",
          owner: "programming",
        },
        {
          id: "quick_hits",
          job: "optional compressed lower-salience beats",
          owner: "programming",
        },
        {
          id: "wrap",
          job: "closing synthesis: what deserves to linger, what remains unresolved, and what matters next",
          owner: "programming",
        },
        {
          id: "predictions",
          job: "configured forward-looking calls stored for continuity/Receipts",
          owner: "programming",
        },
        {
          id: "sign_off",
          job: "brief close and configured rallying line where appropriate",
          owner: "programming",
        },
      ],
    },
    episode_mode_registry: {
      registry_version: "episode-modes-v1",
      values: [
        {
          description: "standard post-event analysis",
          id: "normal_post_event",
        },
        { description: "weekly/off-season roundup", id: "roundup" },
        {
          description:
            "sensitivity/serious-incident mode; cannot be operator-overridden into normal",
          id: "sombre",
        },
      ],
    },
    participant_profiles: {
      profile_set_version: "football-desk-participants-v2",
      profiles: [
        {
          character_bible_version: "0.1.4",
          participant_id: "tully",
          participant_profile_version_id: "pp_tully_v2",
          role: "anchor",
        },
        {
          character_bible_version: "0.1.4",
          participant_id: "gaz",
          participant_profile_version_id: "pp_gaz_v2",
          role: "analyst",
        },
        {
          character_bible_version: "0.1.4",
          collective_membership_language: false,
          participant_id: "simon",
          participant_profile_version_id: "pp_simon_v2",
          role: "supporter_advocate",
        },
      ],
    },
    rundown_template: {
      feature_rules: {
        a_small_request: {
          slot: "analysis_2_or_feature_or_additional_big_week",
          target_words: 350,
        },
        character_ritual_max_per_episode: 1,
        geek_of_the_week: { slot: "analysis_2_or_feature", target_words: 350 },
        no_trigger_means_no_feature: true,
        receipts: {
          placement: [
            "after_orientation",
            "between_analysis_blocks",
            "into_predictions",
          ],
          target_words: 120,
        },
        sport_court: { slot: "analysis_2_or_feature", target_words: 350 },
      },
      mode: "normal_post_event",
      rundown_template_version_id: "post-event-launch-v2",
      runtime: {
        big_minutes: 12,
        fixture_override_allowed: true,
        quiet_minutes: 8,
        standard_minutes: 10,
      },
      slots: [
        {
          block_type: "cold_open",
          job: "Low-stakes tangent unrelated to the event; never invent character biography.",
          required: true,
          sequence: 1,
          slot_id: "cold_open",
          target_words_standard: 60,
        },
        {
          block_type: "host_cut_in",
          job: "Tully cuts in on the configured beat.",
          required: true,
          sequence: 2,
          slot_id: "host_cut_in",
          target_words_standard: 10,
        },
        {
          block_type: "orientation",
          job: "Orient briefly, state result/key facts, establish central question.",
          required: true,
          sequence: 3,
          slot_id: "orientation",
          target_words_standard: 120,
        },
        {
          block_type: "analysis",
          job: "Primary argument on highest-salience contestable beat.",
          required: true,
          sequence: 4,
          slot_id: "analysis_1",
          target_words_standard: 400,
        },
        {
          block_type: "recap_turn",
          job: "Synthesize where the first argument leaves the club and bridge by meaning.",
          required: true,
          sequence: 5,
          slot_id: "recap_turn",
          target_words_standard: 60,
        },
        {
          block_type: "feature_or_analysis",
          job: "Second argument or one triggered configured feature.",
          required: true,
          sequence: 6,
          slot_id: "analysis_2_or_feature",
          target_words_standard: 350,
        },
        {
          block_type: "quick_hits",
          job: "Optional lower-salience beats; shrink adjacent analysis budgets rather than padding runtime.",
          required: false,
          sequence: 7,
          slot_id: "quick_hits",
          target_words_standard: 120,
        },
        {
          block_type: "wrap",
          job: "Closing synthesis: what deserves to linger, what remains unresolved, and what matters next. Not a fixed recap checklist.",
          required: true,
          sequence: 8,
          slot_id: "wrap",
          target_words_standard: 140,
        },
        {
          block_type: "predictions",
          job: "Forward-looking calls stored for continuity/Receipts.",
          required: true,
          sequence: 9,
          slot_id: "predictions",
          target_words_standard: 70,
        },
        {
          block_type: "sign_off",
          job: "Tully closes; configured cultural callback/rallying line only where appropriate.",
          required: true,
          sequence: 10,
          slot_id: "sign_off",
          target_words_standard: 40,
        },
      ],
      source_migration:
        "post-event-launch-v1 + launch craft decision: wrap clarified as closing synthesis; render topology unchanged",
      static_audio: {
        sting: {
          assembly_asset: true,
          placement: "after_host_cut_in",
          program_block: false,
        },
      },
      status: "active",
    },
    selection: {
      live_search: false,
      mode_id: "normal_post_event",
      publication_enabled: false,
      rundown_template_version_id: "post-event-launch-v2",
      runtime_band: { max: 330, min: 60, purpose: "evaluation_fixture" },
      runtime_target: { purpose: "evaluation_fixture", seconds: 240 },
    },
    show_config_version: {
      canonical_payload: {
        autonomous_operation_policy_version: "adr-003a-v1",
        configured_runtime_seconds: {
          fixture_override: true,
          max: 330,
          min: 60,
        },
        default_episode_mode: "normal_post_event",
        default_output_language: "en-GB",
        default_rundown_template_version_id: "post-event-launch-v2",
        name: "Northbridge Post-Match",
        operator_repair_policy_version: "operator-repair-0.1.1",
        pre_publish_review_policy: "required",
        pre_publish_review_required: true,
        pre_publish_review_timeout_seconds: 3600,
        publication_enabled: false,
        show_id: "d1250002-0000-4000-8000-000000000001",
        show_version: "postmatch-fixture-v4",
        writing_craft_policy_version: "writing-craft-0.1",
      },
      config_hash:
        "d1f022782d543d1b8d9a7fd3d56895b57ca1f2b8381457d84261508e75b36719",
      created_at: "2026-09-27T12:00:02Z",
      parent_version_id: "d1250003-0000-4000-8000-000000000001",
      pre_publish_review_required: true,
      schema_version: "show-config/1",
      show_config_version_id: "46238a92-dc6b-4fc5-80cc-84156dd9078a",
      show_id: "d1250002-0000-4000-8000-000000000001",
      version_number: 2,
    },
  },
  purpose: "evaluation",
  representation_registry: [
    {
      attribution_requirement: {
        approved_prefix: "The North Coast Gazette reports",
        required: true,
        source_id: "src_north_coast_gazette",
      },
      consumer: "planner",
      representation_id: "pc2-claim-reporting/1",
      representation_kind: "reviewed_fixture_claim_statement",
      rights_version_id: "d1250006-0000-4000-8000-000000000005",
      source_content_hash:
        "a71d542b57e7edcfe91186a9a934b0301845599b4a40f7fecb8d6e633b4b8578",
      source_evidence_unit_id: "d1250007-0000-4000-8000-000000000003",
      source_identity: "src_north_coast_gazette",
      target_hash:
        "a6b3d89db355e2854bf35519496959e3b343639ff074be88202d9c10a4f74d38",
      target_id: "d1250008-0000-4000-8000-000000000003",
      target_kind: "claim",
      text: "The North Coast Gazette reports that Northbridge practiced a 5-4-1 arrangement for the closing stages during training.",
      text_sha256:
        "6a67cfa57d477b4a944d5c68709c8b484a7b570dfc8bc25043eaa7747817059c",
      usage_class: "assertable",
      use_boundary: "planning_data_only_no_spoken_permission",
    },
    {
      attribution_requirement: {
        approved_prefix: "One specialist analysis in the package suggests",
        required: true,
        source_id: "src_matchboard_analysis",
      },
      consumer: "planner",
      representation_id: "pc2-claim-analysis/2",
      representation_kind: "reviewed_fixture_claim_statement",
      rights_version_id: "d1250006-0000-4000-8000-000000000005",
      source_content_hash:
        "98cc45be73f4be9296b343ad543d249a63fc20f6c31daf0a86b6c90eb1b8e4df",
      source_evidence_unit_id: "d1250007-0000-4000-8000-000000000004",
      source_identity: "src_matchboard_analysis",
      target_hash:
        "f8bdddac5d0d10856a94121cd1dd178fd650477cbd82e338afa52cde5b228672",
      target_id: "d1250008-0000-4000-8000-000000000004",
      target_kind: "claim",
      text: "One specialist analysis in the package suggests that Southbank's emphasis on wide areas after the interval could have been an intentional response to Northbridge becoming narrower in midfield.",
      text_sha256:
        "150e8d7fe21fe54dfb52415d5be6bbfe5753ae96608cead36ec8106f6cd624d8",
      usage_class: "hedged_only",
      use_boundary: "planning_data_only_no_spoken_permission",
    },
    {
      attribution_requirement: {
        required: true,
        source_id: "src_north_coast_gazette",
      },
      consumer: "planner",
      representation_id: "pc2-evidence-reporting/1",
      representation_kind: "reviewed_fixture_paraphrase",
      rights_version_id: "d1250006-0000-4000-8000-000000000005",
      source_content_hash:
        "a71d542b57e7edcfe91186a9a934b0301845599b4a40f7fecb8d6e633b4b8578",
      source_evidence_unit_id: "d1250007-0000-4000-8000-000000000003",
      source_identity: "src_north_coast_gazette",
      target_hash:
        "a71d542b57e7edcfe91186a9a934b0301845599b4a40f7fecb8d6e633b4b8578",
      target_id: "d1250007-0000-4000-8000-000000000003",
      target_kind: "evidence",
      text: "The North Coast Gazette reports training work by Northbridge on a 5-4-1 setup for the late part of a match.",
      text_sha256:
        "932c779db2031f99dfed18b46f57567a988354085c917e58558a0a1742d7d665",
      usage_class: "assertable",
      use_boundary: "planning_data_only_no_spoken_permission",
    },
    {
      attribution_requirement: {
        required: true,
        source_id: "src_matchboard_analysis",
      },
      consumer: "planner",
      representation_id: "pc2-evidence-analysis/2",
      representation_kind: "reviewed_fixture_paraphrase",
      rights_version_id: "d1250006-0000-4000-8000-000000000005",
      source_content_hash:
        "98cc45be73f4be9296b343ad543d249a63fc20f6c31daf0a86b6c90eb1b8e4df",
      source_evidence_unit_id: "d1250007-0000-4000-8000-000000000004",
      source_identity: "src_matchboard_analysis",
      target_hash:
        "98cc45be73f4be9296b343ad543d249a63fc20f6c31daf0a86b6c90eb1b8e4df",
      target_id: "d1250007-0000-4000-8000-000000000004",
      target_kind: "evidence",
      text: "One specialist analysis in the package suggests a possible explanation: Southbank's second-half use of the flanks could have been a purposeful reply to Northbridge narrowing the midfield.",
      text_sha256:
        "82010a2bd5f60a50e5a8a9886be67dab1cfa4c0a35ce4fa7fe290472154e4645",
      usage_class: "hedged_only",
      use_boundary: "planning_data_only_no_spoken_permission",
    },
    {
      attribution_requirement: {
        required: false,
        source_id: "src_supporter_forum_a",
      },
      consumer: "planner",
      representation_id: "pc2-supporter-a/1",
      representation_kind: "reviewed_fixture_paraphrase",
      rights_version_id: "d1250006-0000-4000-8000-000000000007",
      source_content_hash:
        "bb010e8fa7d1b2925a142620f20771294db03a6077c78ab72b041a3601cd41f3",
      source_evidence_unit_id: "d1250007-0000-4000-8000-000000000005",
      source_identity: "src_supporter_forum_a",
      target_hash:
        "bb010e8fa7d1b2925a142620f20771294db03a6077c78ab72b041a3601cd41f3",
      target_id: "d1250007-0000-4000-8000-000000000005",
      target_kind: "evidence",
      text: "This supporter response emphasizes relief rather than celebration.",
      text_sha256:
        "898d0e36d8c179a46581656d9258a83a328820cc9e8b6f86aa1bbc71831bfab6",
      usage_class: "assertable",
      use_boundary: "planning_data_only_no_spoken_permission",
    },
    {
      attribution_requirement: {
        required: false,
        source_id: "src_supporter_podcast_b",
      },
      consumer: "planner",
      representation_id: "pc2-supporter-b/2",
      representation_kind: "reviewed_fixture_paraphrase",
      rights_version_id: "d1250006-0000-4000-8000-000000000007",
      source_content_hash:
        "290dca152f388f068d078aca310869cb6aebc6506588f9c9d06de4a5cce1d7e0",
      source_evidence_unit_id: "d1250007-0000-4000-8000-000000000006",
      source_identity: "src_supporter_podcast_b",
      target_hash:
        "290dca152f388f068d078aca310869cb6aebc6506588f9c9d06de4a5cce1d7e0",
      target_id: "d1250007-0000-4000-8000-000000000006",
      target_kind: "evidence",
      text: "This supporter response sounds relieved but concerned.",
      text_sha256:
        "02497732107f3d9821f3fb7b8aaeff4166f9d644e41b3a29f4b8eb76890dfb9c",
      usage_class: "assertable",
      use_boundary: "planning_data_only_no_spoken_permission",
    },
    {
      attribution_requirement: {
        required: false,
        source_id: "src_supporter_blog_c",
      },
      consumer: "planner",
      representation_id: "pc2-supporter-c/1",
      representation_kind: "reviewed_fixture_paraphrase",
      rights_version_id: "d1250006-0000-4000-8000-000000000007",
      source_content_hash:
        "3089e7a00a05ca9145a2b83edf9dc3e0fd7d1b7be70df5f5f69ffde049958e21",
      source_evidence_unit_id: "d1250007-0000-4000-8000-000000000007",
      source_identity: "src_supporter_blog_c",
      target_hash:
        "3089e7a00a05ca9145a2b83edf9dc3e0fd7d1b7be70df5f5f69ffde049958e21",
      target_id: "d1250007-0000-4000-8000-000000000007",
      target_kind: "evidence",
      text: "This supporter response welcomes the result but questions how the game was managed.",
      text_sha256:
        "e045c7e314f9fca4c3364beaea2f977afcbc77a0e4088a6260e32166507e98a5",
      usage_class: "assertable",
      use_boundary: "planning_data_only_no_spoken_permission",
    },
    {
      attribution_requirement: {
        required: false,
        source_id: "src_supporter_forum_d",
      },
      consumer: "planner",
      representation_id: "pc2-supporter-d/1",
      representation_kind: "reviewed_fixture_paraphrase",
      rights_version_id: "d1250006-0000-4000-8000-000000000007",
      source_content_hash:
        "3a462ce692fcdbdffcb3ce62810b2efbe50a1d18af3460944f46ba00623fdef5",
      source_evidence_unit_id: "d1250007-0000-4000-8000-000000000008",
      source_identity: "src_supporter_forum_d",
      target_hash:
        "3a462ce692fcdbdffcb3ce62810b2efbe50a1d18af3460944f46ba00623fdef5",
      target_id: "d1250007-0000-4000-8000-000000000008",
      target_kind: "evidence",
      text: "Relief predominates in this supporter response.",
      text_sha256:
        "10252d7304c7cf89a693af0fe966b6503a7067f7fbf35130fda6784b776fad5f",
      usage_class: "assertable",
      use_boundary: "planning_data_only_no_spoken_permission",
    },
  ],
  representation_registry_identity: {
    bytes: 7279,
    sha256: "5ba97aba228734351fefb3072e987c7526c1cec2649def874579f63764b5ede2",
  },
  representation_registry_version: "pc2-fixture-representations/2",
  schema: "showrunner-fixture-input-candidate/1",
  use_boundary: "fixed_synthetic_fixture_data_only",
} as const;
const FIXED_P = {
  availability: {
    continuity: { state: "available" },
    historical_context: { state: "available" },
    independent_analysis: { state: "available" },
    licensed_tracking_data: {
      reason: "provider_not_configured",
      state: "not_applicable",
    },
    serious_incident: {
      reason: "no_confirmed_in_scope_incident",
      state: "absent",
    },
    structured_stats: { state: "available" },
    supporter_evidence: { observation_count: 4, state: "available" },
    verified_result: { state: "available" },
  },
  beats: [
    {
      beat_id: "beat_control",
      candidate_selection_score: "0.92",
      label: "late-game control",
      member_claim_refs: [
        "d1250008-0000-4000-8000-000000000001",
        "d1250008-0000-4000-8000-000000000002",
        "d1250008-0000-4000-8000-000000000003",
        "d1250008-0000-4000-8000-000000000004",
        "d1250008-0000-4000-8000-000000000007",
      ],
    },
    {
      beat_id: "beat_supporter",
      candidate_selection_score: "0.83",
      label: "supporter consequence",
      member_claim_refs: [
        "d1250008-0000-4000-8000-000000000005",
        "d1250008-0000-4000-8000-000000000006",
        "d1250008-0000-4000-8000-000000000009",
      ],
    },
    {
      beat_id: "beat_market",
      candidate_selection_score: "0.20",
      label: "market calibration",
      member_claim_refs: ["d1250008-0000-4000-8000-000000000008"],
    },
  ],
  claims: [
    {
      consumption: "ordinary_snapshot",
      snapshot: {
        attribution_requirement: { required: false },
        claim_content_hash:
          "fbb285c68fd26f5bb5cd26b6f0179d9aa0062e30e84e47e98c8c8d14292c2aa1",
        claim_id: "d1250008-0000-4000-8000-000000000001",
        effective_usage_class: "assertable",
        frozen_state: "confirmed",
        frozen_state_hash:
          "2239630f0ed9835266704ae1432d3b269dccfdd2d43b946a2b969aae310e9e94",
        initial_status: "confirmed",
        initial_usage_class: "assertable",
        kind: "event_fact",
        origin: "official_source",
        predicate: "match_result",
        reduced_usage_class: "assertable",
        state_event_cursor: null,
        subject_domain: "statistical",
        subject_ref: "entity_northbridge_fc",
        support_refs: [
          {
            claim_support_id: "d125000a-0000-4000-8000-000000000001",
            derivation_run_id: null,
            evidence_unit_id: "d1250007-0000-4000-8000-000000000001",
            external_support_identity: null,
            support_hash:
              "5dfd65df76fdcd9b3fa8b2ab730cb38712f3941875ad2ae1319d788d256bd1a3",
            support_kind: "evidence",
            support_role: "supports_value",
          },
        ],
        value_type: "scoreline",
      },
      statement: null,
      value: { northbridge_goals: 2, southbank_goals: 1 },
      value_status: "packaged_typed_value",
    },
    {
      consumption: "ordinary_snapshot",
      snapshot: {
        attribution_requirement: { required: false },
        claim_content_hash:
          "55e10cb05eef3ff50b04d02b9c328bd502e7f3af840ecd774ffe7f9743408376",
        claim_id: "d1250008-0000-4000-8000-000000000002",
        effective_usage_class: "assertable",
        frozen_state: "confirmed",
        frozen_state_hash:
          "db0710627bea350c1ca0d9c3344c951c9bb57d7740dd8c23bbc91a7060fd732f",
        initial_status: "confirmed",
        initial_usage_class: "assertable",
        kind: "event_fact",
        origin: "data_provider",
        predicate: "possession_percent",
        reduced_usage_class: "assertable",
        state_event_cursor: null,
        subject_domain: "statistical",
        subject_ref: "entity_northbridge_fc",
        support_refs: [
          {
            claim_support_id: "d125000a-0000-4000-8000-000000000002",
            derivation_run_id: null,
            evidence_unit_id: "d1250007-0000-4000-8000-000000000002",
            external_support_identity: null,
            support_hash:
              "a5565030c5163db39ffd10a1cd80a07cb30559d898737d23d87fc4f029fefdb0",
            support_kind: "evidence",
            support_role: "supports_value",
          },
        ],
        value_type: "exact_decimal",
      },
      statement: null,
      value: { scalar: "43", unit: "percent" },
      value_status: "packaged_typed_value",
    },
    {
      consumption: "ordinary_snapshot",
      snapshot: {
        attribution_requirement: {
          approved_prefix: "The North Coast Gazette reports",
          required: true,
          source_id: "src_north_coast_gazette",
        },
        claim_content_hash:
          "a6b3d89db355e2854bf35519496959e3b343639ff074be88202d9c10a4f74d38",
        claim_id: "d1250008-0000-4000-8000-000000000003",
        effective_usage_class: "assertable",
        frozen_state: "confirmed",
        frozen_state_hash:
          "3de1334c7a8e5c58ba2cbdd531d6541bec7e1a7f5fc7447714b41b584af2bae4",
        initial_status: "confirmed",
        initial_usage_class: "assertable",
        kind: "reported_fact",
        origin: "external_publisher",
        predicate: "closing_shape_rehearsed",
        reduced_usage_class: "assertable",
        state_event_cursor: null,
        subject_domain: "tactical",
        subject_ref: "entity_northbridge_fc",
        support_refs: [
          {
            claim_support_id: "d125000a-0000-4000-8000-000000000003",
            derivation_run_id: null,
            evidence_unit_id: "d1250007-0000-4000-8000-000000000003",
            external_support_identity: null,
            support_hash:
              "a71d542b57e7edcfe91186a9a934b0301845599b4a40f7fecb8d6e633b4b8578",
            support_kind: "evidence",
            support_role: "supports_value",
          },
        ],
        value_type: "structured_text",
      },
      statement: {
        kind: "reviewed_fixture_claim_statement",
        representation_id: "pc2-claim-reporting/1",
        text: "The North Coast Gazette reports that Northbridge practiced a 5-4-1 arrangement for the closing stages during training.",
      },
      value: null,
      value_status: "withheld_original_text_value",
    },
    {
      consumption: "ordinary_snapshot",
      snapshot: {
        attribution_requirement: {
          approved_prefix: "One specialist analysis in the package suggests",
          required: true,
          source_id: "src_matchboard_analysis",
        },
        claim_content_hash:
          "f8bdddac5d0d10856a94121cd1dd178fd650477cbd82e338afa52cde5b228672",
        claim_id: "d1250008-0000-4000-8000-000000000004",
        effective_usage_class: "hedged_only",
        frozen_state: "confirmed",
        frozen_state_hash:
          "59580d5287ca5d6d8c428d73936fc442c21454be258e5b0c6d4b5209b2fca4cd",
        initial_status: "confirmed",
        initial_usage_class: "hedged_only",
        kind: "analysis",
        origin: "external_publisher",
        predicate: "southbank_wide_response",
        reduced_usage_class: "hedged_only",
        state_event_cursor: null,
        subject_domain: "tactical",
        subject_ref: "entity_northbridge_fc",
        support_refs: [
          {
            claim_support_id: "d125000a-0000-4000-8000-000000000004",
            derivation_run_id: null,
            evidence_unit_id: "d1250007-0000-4000-8000-000000000004",
            external_support_identity: null,
            support_hash:
              "98cc45be73f4be9296b343ad543d249a63fc20f6c31daf0a86b6c90eb1b8e4df",
            support_kind: "evidence",
            support_role: "supports_value",
          },
        ],
        value_type: "analysis_text",
      },
      statement: {
        kind: "reviewed_fixture_claim_statement",
        representation_id: "pc2-claim-analysis/2",
        text: "One specialist analysis in the package suggests that Southbank's emphasis on wide areas after the interval could have been an intentional response to Northbridge becoming narrower in midfield.",
      },
      value: null,
      value_status: "withheld_original_text_value",
    },
    {
      consumption: "ordinary_snapshot",
      snapshot: {
        attribution_requirement: {
          approved_prefix: "Across four supporter sources in the package",
          required: true,
          source_id: "supporter_sample",
        },
        claim_content_hash:
          "077522e8f69193fa36fa038ab8378b3780c49456f67ea9eb730c928da00733c5",
        claim_id: "d1250008-0000-4000-8000-000000000005",
        effective_usage_class: "assertable",
        frozen_state: "confirmed",
        frozen_state_hash:
          "4a32d360454d615f54c7b467e95338c8cde8c9388c67919aa9bc4bcf8fa41a8e",
        initial_status: "confirmed",
        initial_usage_class: "assertable",
        kind: "mood",
        origin: "supporter_source",
        predicate: "supporter_postmatch_tenor",
        reduced_usage_class: "assertable",
        state_event_cursor: null,
        subject_domain: "cultural",
        subject_ref: "entity_northbridge_fc",
        support_refs: [
          {
            claim_support_id: "d125000a-0000-4000-8000-000000000005",
            derivation_run_id: null,
            evidence_unit_id: null,
            external_support_identity:
              "artifact:d1250005-0000-4000-8000-000000000017",
            support_hash:
              "46e6a24048f151f62f9e03a66bb57ca4aae78c0281630850bc74bf9205cd4c28",
            support_kind: "signal",
            support_role: "supports_value",
          },
        ],
        value_type: "tenor",
      },
      statement: null,
      value: { direction: "relief_over_celebration", observation_count: 4 },
      value_status: "packaged_typed_value",
    },
    {
      consumption: "ordinary_snapshot",
      snapshot: {
        attribution_requirement: { required: false },
        claim_content_hash:
          "9be7ef594118c81d980d25a343ade42b6dfc2932c9a3a31eb69170584aee117d",
        claim_id: "d1250008-0000-4000-8000-000000000006",
        effective_usage_class: "assertable",
        frozen_state: "confirmed",
        frozen_state_hash:
          "2999b750b23ef1a6c98b3b6ab029a0cf734ea6d2ca9a823f5420dce700bcfc5f",
        initial_status: "confirmed",
        initial_usage_class: "assertable",
        kind: "lore",
        origin: "external_publisher",
        predicate: "supporter_phrase_long_ten",
        reduced_usage_class: "assertable",
        state_event_cursor: null,
        subject_domain: "cultural",
        subject_ref: "entity_northbridge_fc",
        support_refs: [
          {
            claim_support_id: "d125000a-0000-4000-8000-000000000006",
            derivation_run_id: null,
            evidence_unit_id: "d1250007-0000-4000-8000-000000000009",
            external_support_identity: null,
            support_hash:
              "413c4fc6bbce8ab3ec6704e07bfc85f7e6800b92ae8f51de1c430b65a74c6ee3",
            support_kind: "evidence",
            support_role: "supports_value",
          },
        ],
        value_type: "lore_phrase",
      },
      statement: null,
      value: { attested_since_year: 2019, phrase: "the long ten" },
      value_status: "packaged_typed_value",
    },
    {
      consumption: "ordinary_snapshot",
      snapshot: {
        attribution_requirement: { required: false },
        claim_content_hash:
          "cabbed4a2abed81a76fa2a0d4ce7ca2232545224ffbd37ac5a01e1b56fb2063f",
        claim_id: "d1250008-0000-4000-8000-000000000007",
        effective_usage_class: "assertable",
        frozen_state: "confirmed",
        frozen_state_hash:
          "98fa9d6b3406e2b5734cc8fcc12cdd9038e9976838d95f1d4b7f8321ecfb833e",
        initial_status: "confirmed",
        initial_usage_class: "assertable",
        kind: "desk_derived",
        origin: "desk_derived",
        predicate: "late_concessions_recent",
        reduced_usage_class: "assertable",
        state_event_cursor: null,
        subject_domain: "statistical",
        subject_ref: "entity_northbridge_fc",
        support_refs: [
          {
            claim_support_id: "d125000a-0000-4000-8000-000000000007",
            derivation_run_id: "d1250009-0000-4000-8000-000000000001",
            evidence_unit_id: null,
            external_support_identity: null,
            support_hash:
              "eb65fd3581e65333e7dcc68a0150e17dc8e728c8e348510b7c3ca12f2d748a88",
            support_kind: "derivation",
            support_role: "supports_value",
          },
        ],
        value_type: "count_window",
      },
      statement: null,
      value: { after_minute: 80, count: 3, sample_size: 5 },
      value_status: "packaged_typed_value",
    },
    {
      consumption: "silent_calibration_only",
      snapshot: {
        attribution_requirement: { required: false },
        claim_content_hash:
          "d635b3253e5d2aba9cea12a2ac3495606ebac7d3d365b6b9623d613fa92e7a53",
        claim_id: "d1250008-0000-4000-8000-000000000008",
        effective_usage_class: "silent",
        frozen_state: "confirmed",
        frozen_state_hash:
          "4006b76c4b9ad0bd1a841ddaa5930d877c110fb821f522c45f71ae2c8ae1ffa3",
        initial_status: "confirmed",
        initial_usage_class: "silent",
        kind: "analysis",
        origin: "data_provider",
        predicate: "next_match_market_probability",
        reduced_usage_class: "silent",
        state_event_cursor: null,
        subject_domain: "statistical",
        subject_ref: "entity_northbridge_fc",
        support_refs: [
          {
            claim_support_id: "d125000a-0000-4000-8000-000000000008",
            derivation_run_id: null,
            evidence_unit_id: "d1250007-0000-4000-8000-000000000010",
            external_support_identity: null,
            support_hash:
              "348f6a219bc56f3d69f86267c1669d9c672f30db7712dc88cd6a8f4ff6e1f8f4",
            support_kind: "evidence",
            support_role: "supports_value",
          },
        ],
        value_type: "exact_decimal",
      },
      statement: null,
      value: { scalar: "0.58", unit: "probability" },
      value_status: "packaged_typed_value",
    },
    {
      consumption: "ordinary_snapshot",
      snapshot: {
        attribution_requirement: { required: false },
        claim_content_hash:
          "92d17eee43920805daf81919b546e7be44a50915d579e4da84ff5782e828d54f",
        claim_id: "d1250008-0000-4000-8000-000000000009",
        effective_usage_class: "assertable",
        frozen_state: "confirmed",
        frozen_state_hash:
          "dfa61e2a799d3966fe4eccb6998b9d4925e074a04ad07724d95957d4052d8231",
        initial_status: "confirmed",
        initial_usage_class: "assertable",
        kind: "program_history",
        origin: "desk_derived",
        predicate: "prior_published_position",
        reduced_usage_class: "assertable",
        state_event_cursor: null,
        subject_domain: "historical",
        subject_ref: "entity_northbridge_fc",
        support_refs: [
          {
            claim_support_id: "d125000a-0000-4000-8000-000000000009",
            derivation_run_id: null,
            evidence_unit_id: null,
            external_support_identity:
              "artifact:d1250005-0000-4000-8000-000000000018",
            support_hash:
              "2192b1ec1e126a0d7f705e69338cc5e2b457c6cd8f13136bc07f72cccdf46dd1",
            support_kind: "continuity",
            support_role: "supports_value",
          },
        ],
        value_type: "program_history",
      },
      statement: null,
      value: {
        position: "late-game control remained unresolved",
        topic_thread_id: "thr_late_game_control",
      },
      value_status: "packaged_typed_value",
    },
  ],
  context_candidates: [
    {
      claim_id: "d1250008-0000-4000-8000-000000000007",
      context_id: "ctx_latepattern",
      functions: ["supports", "continuity"],
      reason: "Recent late-concession pattern sharpens the control question.",
    },
    {
      claim_id: "d1250008-0000-4000-8000-000000000006",
      context_id: "ctx_lore",
      functions: ["meaning"],
      reason:
        "Approved supporter language explains why the final minutes feel culturally familiar.",
    },
    {
      claim_id: "d1250008-0000-4000-8000-000000000009",
      context_id: "ctx_continuity",
      functions: ["continuity"],
      reason: "Prior published position makes the unresolved thread explicit.",
    },
  ],
  continuity: [
    {
      continuity_id: "artifact:d1250005-0000-4000-8000-000000000018",
      published_only: true,
      topic_thread_id: "thr_late_game_control",
      withdrawn: false,
    },
  ],
  coverage_conditions: [
    { condition: "normal_match_analysis", state: "satisfied" },
    { condition: "supporter_texture", state: "satisfied" },
    { condition: "independent_analysis", state: "satisfied" },
  ],
  evidence: [
    {
      claim_representation_refs: ["d1250008-0000-4000-8000-000000000001"],
      representation: null,
      representation_status: "claim_only",
      snapshot: {
        acquisition_ref:
          "fixture-acquisition:src_north_coast_league:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "claim_only",
          planner: "claim_only",
          writer: "claim_only",
        },
        content_hash:
          "5dfd65df76fdcd9b3fa8b2ab730cb38712f3941875ad2ae1319d788d256bd1a3",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_001",
        evidence_type: "fact",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000001",
        language: "en-GB",
        locator: {
          body_codepoint_end: 46,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000001",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "structured_data",
        origin: "official_source",
        paraphrase_permission: true,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000004",
        rights_version_id: "d1250006-0000-4000-8000-000000000004",
        source_identity: "src_north_coast_league",
        source_item_identity: "fixture-item:ev_official_result:v1",
        source_modality: "structured_data",
        source_role: "official",
        speaker_identity: null,
      },
    },
    {
      claim_representation_refs: ["d1250008-0000-4000-8000-000000000002"],
      representation: null,
      representation_status: "claim_only",
      snapshot: {
        acquisition_ref: "fixture-acquisition:src_fixture_data:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "claim_only",
          planner: "claim_only",
          writer: "claim_only",
        },
        content_hash:
          "a5565030c5163db39ffd10a1cd80a07cb30559d898737d23d87fc4f029fefdb0",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_001",
        evidence_type: "fact",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000002",
        language: "en-GB",
        locator: {
          body_codepoint_end: 38,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000002",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "structured_data",
        origin: "data_provider",
        paraphrase_permission: true,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000002",
        rights_version_id: "d1250006-0000-4000-8000-000000000002",
        source_identity: "src_fixture_data",
        source_item_identity: "fixture-item:ev_possession:v1",
        source_modality: "structured_data",
        source_role: "reference",
        speaker_identity: null,
      },
    },
    {
      claim_representation_refs: ["d1250008-0000-4000-8000-000000000003"],
      representation: {
        kind: "reviewed_fixture_paraphrase",
        representation_id: "pc2-evidence-reporting/1",
        text: "The North Coast Gazette reports training work by Northbridge on a 5-4-1 setup for the late part of a match.",
      },
      representation_status: "fixture_paraphrase",
      snapshot: {
        acquisition_ref:
          "fixture-acquisition:src_north_coast_gazette:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "exact_excerpt",
          planner: "paraphrase",
          writer: "paraphrase",
        },
        content_hash:
          "a71d542b57e7edcfe91186a9a934b0301845599b4a40f7fecb8d6e633b4b8578",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_001",
        evidence_type: "observation",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000003",
        language: "en-GB",
        locator: {
          body_codepoint_end: 98,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000003",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "text",
        origin: "external_publisher",
        paraphrase_permission: true,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000005",
        rights_version_id: "d1250006-0000-4000-8000-000000000005",
        source_identity: "src_north_coast_gazette",
        source_item_identity: "fixture-item:ev_gazette_shape:v1",
        source_modality: "text",
        source_role: "journalist",
        speaker_identity: null,
      },
    },
    {
      claim_representation_refs: ["d1250008-0000-4000-8000-000000000004"],
      representation: {
        kind: "reviewed_fixture_paraphrase",
        representation_id: "pc2-evidence-analysis/2",
        text: "One specialist analysis in the package suggests a possible explanation: Southbank's second-half use of the flanks could have been a purposeful reply to Northbridge narrowing the midfield.",
      },
      representation_status: "fixture_paraphrase",
      snapshot: {
        acquisition_ref:
          "fixture-acquisition:src_matchboard_analysis:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "exact_excerpt",
          planner: "paraphrase",
          writer: "paraphrase",
        },
        content_hash:
          "98cc45be73f4be9296b343ad543d249a63fc20f6c31daf0a86b6c90eb1b8e4df",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_001",
        evidence_type: "analysis",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000004",
        language: "en-GB",
        locator: {
          body_codepoint_end: 126,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000004",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "text",
        origin: "external_publisher",
        paraphrase_permission: true,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000005",
        rights_version_id: "d1250006-0000-4000-8000-000000000005",
        source_identity: "src_matchboard_analysis",
        source_item_identity: "fixture-item:ev_specialist_wide:v1",
        source_modality: "text",
        source_role: "analyst",
        speaker_identity: null,
      },
    },
    {
      claim_representation_refs: [],
      representation: {
        kind: "reviewed_fixture_paraphrase",
        representation_id: "pc2-supporter-a/1",
        text: "This supporter response emphasizes relief rather than celebration.",
      },
      representation_status: "fixture_paraphrase",
      snapshot: {
        acquisition_ref:
          "fixture-acquisition:src_supporter_forum_a:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "exact_excerpt",
          planner: "paraphrase",
          writer: "paraphrase",
        },
        content_hash:
          "bb010e8fa7d1b2925a142620f20771294db03a6077c78ab72b041a3601cd41f3",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_001",
        evidence_type: "sentiment",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000005",
        language: "en-GB",
        locator: {
          body_codepoint_end: 30,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000005",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "text",
        origin: "supporter_source",
        paraphrase_permission: true,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000007",
        rights_version_id: "d1250006-0000-4000-8000-000000000007",
        source_identity: "src_supporter_forum_a",
        source_item_identity: "fixture-item:ev_supporter_1:v1",
        source_modality: "text",
        source_role: "supporter",
        speaker_identity: "anonymous-synthetic-observation-1",
      },
    },
    {
      claim_representation_refs: [],
      representation: {
        kind: "reviewed_fixture_paraphrase",
        representation_id: "pc2-supporter-b/2",
        text: "This supporter response sounds relieved but concerned.",
      },
      representation_status: "fixture_paraphrase",
      snapshot: {
        acquisition_ref:
          "fixture-acquisition:src_supporter_podcast_b:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "exact_excerpt",
          planner: "paraphrase",
          writer: "paraphrase",
        },
        content_hash:
          "290dca152f388f068d078aca310869cb6aebc6506588f9c9d06de4a5cce1d7e0",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_001",
        evidence_type: "sentiment",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000006",
        language: "en-GB",
        locator: {
          body_codepoint_end: 19,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000006",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "audio",
        origin: "supporter_source",
        paraphrase_permission: true,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000007",
        rights_version_id: "d1250006-0000-4000-8000-000000000007",
        source_identity: "src_supporter_podcast_b",
        source_item_identity: "fixture-item:ev_supporter_2:v1",
        source_modality: "audio",
        source_role: "supporter",
        speaker_identity: "anonymous-synthetic-observation-2",
      },
    },
    {
      claim_representation_refs: [],
      representation: {
        kind: "reviewed_fixture_paraphrase",
        representation_id: "pc2-supporter-c/1",
        text: "This supporter response welcomes the result but questions how the game was managed.",
      },
      representation_status: "fixture_paraphrase",
      snapshot: {
        acquisition_ref:
          "fixture-acquisition:src_supporter_blog_c:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "exact_excerpt",
          planner: "paraphrase",
          writer: "paraphrase",
        },
        content_hash:
          "3089e7a00a05ca9145a2b83edf9dc3e0fd7d1b7be70df5f5f69ffde049958e21",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_001",
        evidence_type: "sentiment",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000007",
        language: "en-GB",
        locator: {
          body_codepoint_end: 49,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000007",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "text",
        origin: "supporter_source",
        paraphrase_permission: true,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000007",
        rights_version_id: "d1250006-0000-4000-8000-000000000007",
        source_identity: "src_supporter_blog_c",
        source_item_identity: "fixture-item:ev_supporter_3:v1",
        source_modality: "text",
        source_role: "supporter",
        speaker_identity: "anonymous-synthetic-observation-3",
      },
    },
    {
      claim_representation_refs: [],
      representation: {
        kind: "reviewed_fixture_paraphrase",
        representation_id: "pc2-supporter-d/1",
        text: "Relief predominates in this supporter response.",
      },
      representation_status: "fixture_paraphrase",
      snapshot: {
        acquisition_ref:
          "fixture-acquisition:src_supporter_forum_d:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "exact_excerpt",
          planner: "paraphrase",
          writer: "paraphrase",
        },
        content_hash:
          "3a462ce692fcdbdffcb3ce62810b2efbe50a1d18af3460944f46ba00623fdef5",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_001",
        evidence_type: "sentiment",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000008",
        language: "en-GB",
        locator: {
          body_codepoint_end: 13,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000008",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "text",
        origin: "supporter_source",
        paraphrase_permission: true,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000007",
        rights_version_id: "d1250006-0000-4000-8000-000000000007",
        source_identity: "src_supporter_forum_d",
        source_item_identity: "fixture-item:ev_supporter_4:v1",
        source_modality: "text",
        source_role: "supporter",
        speaker_identity: "anonymous-synthetic-observation-4",
      },
    },
    {
      claim_representation_refs: ["d1250008-0000-4000-8000-000000000006"],
      representation: {
        kind: "exact_permitted_span",
        span_end: 83,
        span_start: 71,
        text: "the long ten",
      },
      representation_status: "exact_span",
      snapshot: {
        acquisition_ref:
          "fixture-acquisition:src_east_bank_review_archive:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "exact_excerpt",
          planner: "exact_excerpt",
          writer: "exact_excerpt",
        },
        content_hash:
          "413c4fc6bbce8ab3ec6704e07bfc85f7e6800b92ae8f51de1c430b65a74c6ee3",
        entity_identity: "entity_northbridge_fc",
        event_identity: null,
        evidence_type: "context",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000009",
        language: "en-GB",
        locator: {
          body_codepoint_end: 110,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000009",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "text",
        origin: "external_publisher",
        paraphrase_permission: true,
        quote_permission: true,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000006",
        rights_version_id: "d1250006-0000-4000-8000-000000000006",
        source_identity: "src_east_bank_review_archive",
        source_item_identity: "fixture-item:ev_lore_long_ten:v1",
        source_modality: "text",
        source_role: "reference",
        speaker_identity: null,
      },
    },
    {
      claim_representation_refs: ["d1250008-0000-4000-8000-000000000008"],
      representation: null,
      representation_status: "claim_only",
      snapshot: {
        acquisition_ref: "fixture-acquisition:src_fixture_market:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "claim_only",
          planner: "claim_only",
          writer: "hidden",
        },
        content_hash:
          "348f6a219bc56f3d69f86267c1669d9c672f30db7712dc88cd6a8f4ff6e1f8f4",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_001",
        evidence_type: "analysis",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000010",
        language: "en-GB",
        locator: {
          body_codepoint_end: 32,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000010",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "structured_data",
        origin: "data_provider",
        paraphrase_permission: false,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000003",
        rights_version_id: "d1250006-0000-4000-8000-000000000003",
        source_identity: "src_fixture_market",
        source_item_identity: "fixture-item:ev_market:v1",
        source_modality: "structured_data",
        source_role: "market",
        speaker_identity: null,
      },
    },
    {
      claim_representation_refs: [],
      representation: null,
      representation_status: "claim_only",
      snapshot: {
        acquisition_ref: "fixture-acquisition:src_fixture_data:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "claim_only",
          planner: "claim_only",
          writer: "hidden",
        },
        content_hash:
          "3c7a7888d1ae4d5c6a40aadae89f0db9cf0732c3a22265c65ac688867c785150",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_previous_1",
        evidence_type: "fact",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000012",
        language: "en-GB",
        locator: {
          body_codepoint_end: 52,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000012",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "structured_data",
        origin: "data_provider",
        paraphrase_permission: false,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000002",
        rights_version_id: "d1250006-0000-4000-8000-000000000002",
        source_identity: "src_fixture_data",
        source_item_identity: "fixture-item:ev_prev_1:v1",
        source_modality: "structured_data",
        source_role: "reference",
        speaker_identity: null,
      },
    },
    {
      claim_representation_refs: [],
      representation: null,
      representation_status: "claim_only",
      snapshot: {
        acquisition_ref: "fixture-acquisition:src_fixture_data:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "claim_only",
          planner: "claim_only",
          writer: "hidden",
        },
        content_hash:
          "ad8cbb012e22007db8c815249f907fbbf2039b63c83d3d9be6a222249a7ffd24",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_previous_2",
        evidence_type: "fact",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000013",
        language: "en-GB",
        locator: {
          body_codepoint_end: 62,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000013",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "structured_data",
        origin: "data_provider",
        paraphrase_permission: false,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000002",
        rights_version_id: "d1250006-0000-4000-8000-000000000002",
        source_identity: "src_fixture_data",
        source_item_identity: "fixture-item:ev_prev_2:v1",
        source_modality: "structured_data",
        source_role: "reference",
        speaker_identity: null,
      },
    },
    {
      claim_representation_refs: [],
      representation: null,
      representation_status: "claim_only",
      snapshot: {
        acquisition_ref: "fixture-acquisition:src_fixture_data:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "claim_only",
          planner: "claim_only",
          writer: "hidden",
        },
        content_hash:
          "c5ff2da2639e0f56c53a2812dda8e435f5c7ccfd1df7fe306ace66e075652fba",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_previous_3",
        evidence_type: "fact",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000014",
        language: "en-GB",
        locator: {
          body_codepoint_end: 52,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000014",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "structured_data",
        origin: "data_provider",
        paraphrase_permission: false,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000002",
        rights_version_id: "d1250006-0000-4000-8000-000000000002",
        source_identity: "src_fixture_data",
        source_item_identity: "fixture-item:ev_prev_3:v1",
        source_modality: "structured_data",
        source_role: "reference",
        speaker_identity: null,
      },
    },
    {
      claim_representation_refs: [],
      representation: null,
      representation_status: "claim_only",
      snapshot: {
        acquisition_ref: "fixture-acquisition:src_fixture_data:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "claim_only",
          planner: "claim_only",
          writer: "hidden",
        },
        content_hash:
          "fa9d0a653d449f5d4b599799dffcc487e04f2cc24dbcec7e0451bb102eebdc6b",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_previous_4",
        evidence_type: "fact",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000015",
        language: "en-GB",
        locator: {
          body_codepoint_end: 62,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000015",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "structured_data",
        origin: "data_provider",
        paraphrase_permission: false,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000002",
        rights_version_id: "d1250006-0000-4000-8000-000000000002",
        source_identity: "src_fixture_data",
        source_item_identity: "fixture-item:ev_prev_4:v1",
        source_modality: "structured_data",
        source_role: "reference",
        speaker_identity: null,
      },
    },
    {
      claim_representation_refs: [],
      representation: null,
      representation_status: "claim_only",
      snapshot: {
        acquisition_ref: "fixture-acquisition:src_fixture_data:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "claim_only",
          planner: "claim_only",
          writer: "hidden",
        },
        content_hash:
          "b21989b1b1461ca40d2ce84498250648e5f03949881d9fc3e82167fbf36acba5",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_previous_5",
        evidence_type: "fact",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000016",
        language: "en-GB",
        locator: {
          body_codepoint_end: 52,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000016",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "structured_data",
        origin: "data_provider",
        paraphrase_permission: false,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000002",
        rights_version_id: "d1250006-0000-4000-8000-000000000002",
        source_identity: "src_fixture_data",
        source_item_identity: "fixture-item:ev_prev_5:v1",
        source_modality: "structured_data",
        source_role: "reference",
        speaker_identity: null,
      },
    },
  ],
  package_hash:
    "a8655c0e8bd72094a823b367a0c21cd665d3d99c271341286a92dbdc2ea304ab",
  package_id: "d1250004-0000-4000-8000-000000000001",
  scope: {
    competition_ids: ["competition_north_coast_league"],
    entity_ids: ["entity_northbridge_fc"],
    event_ids: ["event_fixture_001"],
    locale: "en-GB",
    scheduled_default_mode: "normal_post_event",
    scope_type: "event",
    show_id: "d1250002-0000-4000-8000-000000000001",
    target_publication_slot_ref: "fixture_slot_001",
  },
  scope_hash:
    "ecb1eb2b675a9e383dfe88e6311f8cc88cc97eb17183df9a8cae935d8d1f8979",
  selection_provenance: {
    context_retrieval_version: "fixture.manual.v1",
    live_search: false,
    match_window_proof: {
      as_of: "2026-09-27T12:59:00Z",
      competition_identity: "competition_north_coast_league",
      complete_prior_schedule_assertion: true,
      current_event: {
        competition_identity: "competition_north_coast_league",
        completed_at: "2026-09-27T12:00:00Z",
        completion_status: "final",
        event_identity: "event_fixture_001",
        participant_entities: [
          "entity_northbridge_fc",
          "entity_southbank_athletic",
        ],
      },
      current_event_identity: "event_fixture_001",
      entity_identity: "entity_northbridge_fc",
      ordered_prior_schedule: [
        {
          competition_identity: "competition_north_coast_league",
          completed_at: "2026-09-21T12:00:00Z",
          completion_status: "final",
          entity_identity: "entity_northbridge_fc",
          event_identity: "event_fixture_previous_1",
          rank_before_current_event: 1,
        },
        {
          competition_identity: "competition_north_coast_league",
          completed_at: "2026-09-14T12:00:00Z",
          completion_status: "final",
          entity_identity: "entity_northbridge_fc",
          event_identity: "event_fixture_previous_2",
          rank_before_current_event: 2,
        },
        {
          competition_identity: "competition_north_coast_league",
          completed_at: "2026-09-07T12:00:00Z",
          completion_status: "final",
          entity_identity: "entity_northbridge_fc",
          event_identity: "event_fixture_previous_3",
          rank_before_current_event: 3,
        },
        {
          competition_identity: "competition_north_coast_league",
          completed_at: "2026-08-31T12:00:00Z",
          completion_status: "final",
          entity_identity: "entity_northbridge_fc",
          event_identity: "event_fixture_previous_4",
          rank_before_current_event: 4,
        },
        {
          competition_identity: "competition_north_coast_league",
          completed_at: "2026-08-24T12:00:00Z",
          completion_status: "final",
          entity_identity: "entity_northbridge_fc",
          event_identity: "event_fixture_previous_5",
          rank_before_current_event: 5,
        },
        {
          competition_identity: "competition_north_coast_league",
          completed_at: "2026-08-17T12:00:00Z",
          completion_status: "final",
          entity_identity: "entity_northbridge_fc",
          event_identity: "event_fixture_previous_6",
          rank_before_current_event: 6,
        },
      ],
      schedule_scope:
        "complete six most recent prior completed league matches in this synthetic fixture",
      selected_event_identities: [
        "event_fixture_previous_1",
        "event_fixture_previous_2",
        "event_fixture_previous_3",
        "event_fixture_previous_4",
        "event_fixture_previous_5",
      ],
      selection_rule:
        "last five completed league matches before current event; descending completion time",
      source_identity: "src_fixture_data",
      source_record_ref: "fixture-schedule-ledger-v1",
      synthetic: true,
      window_identity: "fixture-last-five-league-before-event-001-v1",
    },
    operator: "fixture_builder",
    selector_version: "fixture.manual.v2",
  },
  sensitivities: [
    {
      applies_to: "event_fixture_001",
      note: "No in-scope serious incident or protected sensitivity at freeze.",
      sensitivity_id: "sens_none",
      state: "none",
    },
  ],
  signals: [
    {
      ref: "artifact:d1250005-0000-4000-8000-000000000017",
      signal_id: "sig_tenor",
      type: "tenor_reading",
    },
    {
      ref: "d1250009-0000-4000-8000-000000000001",
      signal_id: "sig_late_pattern",
      type: "derivation_run",
    },
  ],
  silent_inputs: [
    {
      allowed_consumers: ["planner", "auditor"],
      claim_id: "d1250008-0000-4000-8000-000000000008",
      effective_usage_class: "silent",
      purpose: "calibration_only",
      support_refs: ["d1250007-0000-4000-8000-000000000010"],
    },
  ],
  source_attribution: [
    {
      display_name: "North Coast Gazette",
      source_id: "src_north_coast_gazette",
      source_role: "journalist",
    },
    {
      display_name: "Matchboard Analysis",
      source_id: "src_matchboard_analysis",
      source_role: "analyst",
    },
    {
      display_name: "East Bank Review Archive",
      source_id: "src_east_bank_review_archive",
      source_role: "reference",
    },
  ],
  version_refs: {
    claims_policy: "0.1.2",
    evidence_package_spec: "0.2.2",
    lens_definition: "fixture-lens-v1",
    rights_registry: "fixture-rights-v1",
    show_version: "postmatch-fixture-v4",
  },
} as const;
const FIXED_V_FIELDS = {
  assurance: "snapshot_consistency_only",
  availability: {
    continuity: { state: "available" },
    historical_context: { state: "available" },
    independent_analysis: { state: "available" },
    licensed_tracking_data: {
      reason: "provider_not_configured",
      state: "not_applicable",
    },
    serious_incident: {
      reason: "no_confirmed_in_scope_incident",
      state: "absent",
    },
    structured_stats: { state: "available" },
    supporter_evidence: { observation_count: 4, state: "available" },
    verified_result: { state: "available" },
  },
  beats: [
    {
      beat_id: "beat_control",
      candidate_selection_score: "0.92",
      label: "late-game control",
      member_claim_refs: [
        "d1250008-0000-4000-8000-000000000001",
        "d1250008-0000-4000-8000-000000000002",
        "d1250008-0000-4000-8000-000000000003",
        "d1250008-0000-4000-8000-000000000004",
        "d1250008-0000-4000-8000-000000000007",
      ],
    },
    {
      beat_id: "beat_supporter",
      candidate_selection_score: "0.83",
      label: "supporter consequence",
      member_claim_refs: [
        "d1250008-0000-4000-8000-000000000005",
        "d1250008-0000-4000-8000-000000000006",
        "d1250008-0000-4000-8000-000000000009",
      ],
    },
    {
      beat_id: "beat_market",
      candidate_selection_score: "0.20",
      label: "market calibration",
      member_claim_refs: ["d1250008-0000-4000-8000-000000000008"],
    },
  ],
  claims: [
    {
      consumption: "ordinary_snapshot",
      snapshot: {
        attribution_requirement: { required: false },
        claim_content_hash:
          "fbb285c68fd26f5bb5cd26b6f0179d9aa0062e30e84e47e98c8c8d14292c2aa1",
        claim_id: "d1250008-0000-4000-8000-000000000001",
        effective_usage_class: "assertable",
        frozen_state: "confirmed",
        frozen_state_hash:
          "2239630f0ed9835266704ae1432d3b269dccfdd2d43b946a2b969aae310e9e94",
        initial_status: "confirmed",
        initial_usage_class: "assertable",
        kind: "event_fact",
        origin: "official_source",
        predicate: "match_result",
        reduced_usage_class: "assertable",
        state_event_cursor: null,
        subject_domain: "statistical",
        subject_ref: "entity_northbridge_fc",
        support_refs: [
          {
            claim_support_id: "d125000a-0000-4000-8000-000000000001",
            derivation_run_id: null,
            evidence_unit_id: "d1250007-0000-4000-8000-000000000001",
            external_support_identity: null,
            support_hash:
              "5dfd65df76fdcd9b3fa8b2ab730cb38712f3941875ad2ae1319d788d256bd1a3",
            support_kind: "evidence",
            support_role: "supports_value",
          },
        ],
        value_type: "scoreline",
      },
      value: { northbridge_goals: 2, southbank_goals: 1 },
      value_status: "packaged_typed_value",
    },
    {
      consumption: "ordinary_snapshot",
      snapshot: {
        attribution_requirement: { required: false },
        claim_content_hash:
          "55e10cb05eef3ff50b04d02b9c328bd502e7f3af840ecd774ffe7f9743408376",
        claim_id: "d1250008-0000-4000-8000-000000000002",
        effective_usage_class: "assertable",
        frozen_state: "confirmed",
        frozen_state_hash:
          "db0710627bea350c1ca0d9c3344c951c9bb57d7740dd8c23bbc91a7060fd732f",
        initial_status: "confirmed",
        initial_usage_class: "assertable",
        kind: "event_fact",
        origin: "data_provider",
        predicate: "possession_percent",
        reduced_usage_class: "assertable",
        state_event_cursor: null,
        subject_domain: "statistical",
        subject_ref: "entity_northbridge_fc",
        support_refs: [
          {
            claim_support_id: "d125000a-0000-4000-8000-000000000002",
            derivation_run_id: null,
            evidence_unit_id: "d1250007-0000-4000-8000-000000000002",
            external_support_identity: null,
            support_hash:
              "a5565030c5163db39ffd10a1cd80a07cb30559d898737d23d87fc4f029fefdb0",
            support_kind: "evidence",
            support_role: "supports_value",
          },
        ],
        value_type: "exact_decimal",
      },
      value: { scalar: "43", unit: "percent" },
      value_status: "packaged_typed_value",
    },
    {
      consumption: "ordinary_snapshot",
      snapshot: {
        attribution_requirement: {
          approved_prefix: "The North Coast Gazette reports",
          required: true,
          source_id: "src_north_coast_gazette",
        },
        claim_content_hash:
          "a6b3d89db355e2854bf35519496959e3b343639ff074be88202d9c10a4f74d38",
        claim_id: "d1250008-0000-4000-8000-000000000003",
        effective_usage_class: "assertable",
        frozen_state: "confirmed",
        frozen_state_hash:
          "3de1334c7a8e5c58ba2cbdd531d6541bec7e1a7f5fc7447714b41b584af2bae4",
        initial_status: "confirmed",
        initial_usage_class: "assertable",
        kind: "reported_fact",
        origin: "external_publisher",
        predicate: "closing_shape_rehearsed",
        reduced_usage_class: "assertable",
        state_event_cursor: null,
        subject_domain: "tactical",
        subject_ref: "entity_northbridge_fc",
        support_refs: [
          {
            claim_support_id: "d125000a-0000-4000-8000-000000000003",
            derivation_run_id: null,
            evidence_unit_id: "d1250007-0000-4000-8000-000000000003",
            external_support_identity: null,
            support_hash:
              "a71d542b57e7edcfe91186a9a934b0301845599b4a40f7fecb8d6e633b4b8578",
            support_kind: "evidence",
            support_role: "supports_value",
          },
        ],
        value_type: "structured_text",
      },
      value: null,
      value_status: "withheld_pending_representation",
    },
    {
      consumption: "ordinary_snapshot",
      snapshot: {
        attribution_requirement: {
          approved_prefix: "One specialist analysis in the package suggests",
          required: true,
          source_id: "src_matchboard_analysis",
        },
        claim_content_hash:
          "f8bdddac5d0d10856a94121cd1dd178fd650477cbd82e338afa52cde5b228672",
        claim_id: "d1250008-0000-4000-8000-000000000004",
        effective_usage_class: "hedged_only",
        frozen_state: "confirmed",
        frozen_state_hash:
          "59580d5287ca5d6d8c428d73936fc442c21454be258e5b0c6d4b5209b2fca4cd",
        initial_status: "confirmed",
        initial_usage_class: "hedged_only",
        kind: "analysis",
        origin: "external_publisher",
        predicate: "southbank_wide_response",
        reduced_usage_class: "hedged_only",
        state_event_cursor: null,
        subject_domain: "tactical",
        subject_ref: "entity_northbridge_fc",
        support_refs: [
          {
            claim_support_id: "d125000a-0000-4000-8000-000000000004",
            derivation_run_id: null,
            evidence_unit_id: "d1250007-0000-4000-8000-000000000004",
            external_support_identity: null,
            support_hash:
              "98cc45be73f4be9296b343ad543d249a63fc20f6c31daf0a86b6c90eb1b8e4df",
            support_kind: "evidence",
            support_role: "supports_value",
          },
        ],
        value_type: "analysis_text",
      },
      value: null,
      value_status: "withheld_pending_representation",
    },
    {
      consumption: "ordinary_snapshot",
      snapshot: {
        attribution_requirement: {
          approved_prefix: "Across four supporter sources in the package",
          required: true,
          source_id: "supporter_sample",
        },
        claim_content_hash:
          "077522e8f69193fa36fa038ab8378b3780c49456f67ea9eb730c928da00733c5",
        claim_id: "d1250008-0000-4000-8000-000000000005",
        effective_usage_class: "assertable",
        frozen_state: "confirmed",
        frozen_state_hash:
          "4a32d360454d615f54c7b467e95338c8cde8c9388c67919aa9bc4bcf8fa41a8e",
        initial_status: "confirmed",
        initial_usage_class: "assertable",
        kind: "mood",
        origin: "supporter_source",
        predicate: "supporter_postmatch_tenor",
        reduced_usage_class: "assertable",
        state_event_cursor: null,
        subject_domain: "cultural",
        subject_ref: "entity_northbridge_fc",
        support_refs: [
          {
            claim_support_id: "d125000a-0000-4000-8000-000000000005",
            derivation_run_id: null,
            evidence_unit_id: null,
            external_support_identity:
              "artifact:d1250005-0000-4000-8000-000000000017",
            support_hash:
              "46e6a24048f151f62f9e03a66bb57ca4aae78c0281630850bc74bf9205cd4c28",
            support_kind: "signal",
            support_role: "supports_value",
          },
        ],
        value_type: "tenor",
      },
      value: { direction: "relief_over_celebration", observation_count: 4 },
      value_status: "packaged_typed_value",
    },
    {
      consumption: "ordinary_snapshot",
      snapshot: {
        attribution_requirement: { required: false },
        claim_content_hash:
          "9be7ef594118c81d980d25a343ade42b6dfc2932c9a3a31eb69170584aee117d",
        claim_id: "d1250008-0000-4000-8000-000000000006",
        effective_usage_class: "assertable",
        frozen_state: "confirmed",
        frozen_state_hash:
          "2999b750b23ef1a6c98b3b6ab029a0cf734ea6d2ca9a823f5420dce700bcfc5f",
        initial_status: "confirmed",
        initial_usage_class: "assertable",
        kind: "lore",
        origin: "external_publisher",
        predicate: "supporter_phrase_long_ten",
        reduced_usage_class: "assertable",
        state_event_cursor: null,
        subject_domain: "cultural",
        subject_ref: "entity_northbridge_fc",
        support_refs: [
          {
            claim_support_id: "d125000a-0000-4000-8000-000000000006",
            derivation_run_id: null,
            evidence_unit_id: "d1250007-0000-4000-8000-000000000009",
            external_support_identity: null,
            support_hash:
              "413c4fc6bbce8ab3ec6704e07bfc85f7e6800b92ae8f51de1c430b65a74c6ee3",
            support_kind: "evidence",
            support_role: "supports_value",
          },
        ],
        value_type: "lore_phrase",
      },
      value: { attested_since_year: 2019, phrase: "the long ten" },
      value_status: "packaged_typed_value",
    },
    {
      consumption: "ordinary_snapshot",
      snapshot: {
        attribution_requirement: { required: false },
        claim_content_hash:
          "cabbed4a2abed81a76fa2a0d4ce7ca2232545224ffbd37ac5a01e1b56fb2063f",
        claim_id: "d1250008-0000-4000-8000-000000000007",
        effective_usage_class: "assertable",
        frozen_state: "confirmed",
        frozen_state_hash:
          "98fa9d6b3406e2b5734cc8fcc12cdd9038e9976838d95f1d4b7f8321ecfb833e",
        initial_status: "confirmed",
        initial_usage_class: "assertable",
        kind: "desk_derived",
        origin: "desk_derived",
        predicate: "late_concessions_recent",
        reduced_usage_class: "assertable",
        state_event_cursor: null,
        subject_domain: "statistical",
        subject_ref: "entity_northbridge_fc",
        support_refs: [
          {
            claim_support_id: "d125000a-0000-4000-8000-000000000007",
            derivation_run_id: "d1250009-0000-4000-8000-000000000001",
            evidence_unit_id: null,
            external_support_identity: null,
            support_hash:
              "eb65fd3581e65333e7dcc68a0150e17dc8e728c8e348510b7c3ca12f2d748a88",
            support_kind: "derivation",
            support_role: "supports_value",
          },
        ],
        value_type: "count_window",
      },
      value: { after_minute: 80, count: 3, sample_size: 5 },
      value_status: "packaged_typed_value",
    },
    {
      consumption: "silent_calibration_only",
      snapshot: {
        attribution_requirement: { required: false },
        claim_content_hash:
          "d635b3253e5d2aba9cea12a2ac3495606ebac7d3d365b6b9623d613fa92e7a53",
        claim_id: "d1250008-0000-4000-8000-000000000008",
        effective_usage_class: "silent",
        frozen_state: "confirmed",
        frozen_state_hash:
          "4006b76c4b9ad0bd1a841ddaa5930d877c110fb821f522c45f71ae2c8ae1ffa3",
        initial_status: "confirmed",
        initial_usage_class: "silent",
        kind: "analysis",
        origin: "data_provider",
        predicate: "next_match_market_probability",
        reduced_usage_class: "silent",
        state_event_cursor: null,
        subject_domain: "statistical",
        subject_ref: "entity_northbridge_fc",
        support_refs: [
          {
            claim_support_id: "d125000a-0000-4000-8000-000000000008",
            derivation_run_id: null,
            evidence_unit_id: "d1250007-0000-4000-8000-000000000010",
            external_support_identity: null,
            support_hash:
              "348f6a219bc56f3d69f86267c1669d9c672f30db7712dc88cd6a8f4ff6e1f8f4",
            support_kind: "evidence",
            support_role: "supports_value",
          },
        ],
        value_type: "exact_decimal",
      },
      value: { scalar: "0.58", unit: "probability" },
      value_status: "packaged_typed_value",
    },
    {
      consumption: "ordinary_snapshot",
      snapshot: {
        attribution_requirement: { required: false },
        claim_content_hash:
          "92d17eee43920805daf81919b546e7be44a50915d579e4da84ff5782e828d54f",
        claim_id: "d1250008-0000-4000-8000-000000000009",
        effective_usage_class: "assertable",
        frozen_state: "confirmed",
        frozen_state_hash:
          "dfa61e2a799d3966fe4eccb6998b9d4925e074a04ad07724d95957d4052d8231",
        initial_status: "confirmed",
        initial_usage_class: "assertable",
        kind: "program_history",
        origin: "desk_derived",
        predicate: "prior_published_position",
        reduced_usage_class: "assertable",
        state_event_cursor: null,
        subject_domain: "historical",
        subject_ref: "entity_northbridge_fc",
        support_refs: [
          {
            claim_support_id: "d125000a-0000-4000-8000-000000000009",
            derivation_run_id: null,
            evidence_unit_id: null,
            external_support_identity:
              "artifact:d1250005-0000-4000-8000-000000000018",
            support_hash:
              "2192b1ec1e126a0d7f705e69338cc5e2b457c6cd8f13136bc07f72cccdf46dd1",
            support_kind: "continuity",
            support_role: "supports_value",
          },
        ],
        value_type: "program_history",
      },
      value: {
        position: "late-game control remained unresolved",
        topic_thread_id: "thr_late_game_control",
      },
      value_status: "packaged_typed_value",
    },
  ],
  context_candidates: [
    {
      claim_id: "d1250008-0000-4000-8000-000000000007",
      context_id: "ctx_latepattern",
      functions: ["supports", "continuity"],
      reason: "Recent late-concession pattern sharpens the control question.",
    },
    {
      claim_id: "d1250008-0000-4000-8000-000000000006",
      context_id: "ctx_lore",
      functions: ["meaning"],
      reason:
        "Approved supporter language explains why the final minutes feel culturally familiar.",
    },
    {
      claim_id: "d1250008-0000-4000-8000-000000000009",
      context_id: "ctx_continuity",
      functions: ["continuity"],
      reason: "Prior published position makes the unresolved thread explicit.",
    },
  ],
  continuity: [
    {
      continuity_id: "artifact:d1250005-0000-4000-8000-000000000018",
      published_only: true,
      topic_thread_id: "thr_late_game_control",
      withdrawn: false,
    },
  ],
  coverage_conditions: [
    { condition: "normal_match_analysis", state: "satisfied" },
    { condition: "supporter_texture", state: "satisfied" },
    { condition: "independent_analysis", state: "satisfied" },
  ],
  evidence: [
    {
      claim_representation_refs: ["d1250008-0000-4000-8000-000000000001"],
      representation: null,
      representation_status: "claim_only",
      snapshot: {
        acquisition_ref:
          "fixture-acquisition:src_north_coast_league:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "claim_only",
          planner: "claim_only",
          writer: "claim_only",
        },
        content_hash:
          "5dfd65df76fdcd9b3fa8b2ab730cb38712f3941875ad2ae1319d788d256bd1a3",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_001",
        evidence_type: "fact",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000001",
        language: "en-GB",
        locator: {
          body_codepoint_end: 46,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000001",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "structured_data",
        origin: "official_source",
        paraphrase_permission: true,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000004",
        rights_version_id: "d1250006-0000-4000-8000-000000000004",
        source_identity: "src_north_coast_league",
        source_item_identity: "fixture-item:ev_official_result:v1",
        source_modality: "structured_data",
        source_role: "official",
        speaker_identity: null,
      },
    },
    {
      claim_representation_refs: ["d1250008-0000-4000-8000-000000000002"],
      representation: null,
      representation_status: "claim_only",
      snapshot: {
        acquisition_ref: "fixture-acquisition:src_fixture_data:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "claim_only",
          planner: "claim_only",
          writer: "claim_only",
        },
        content_hash:
          "a5565030c5163db39ffd10a1cd80a07cb30559d898737d23d87fc4f029fefdb0",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_001",
        evidence_type: "fact",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000002",
        language: "en-GB",
        locator: {
          body_codepoint_end: 38,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000002",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "structured_data",
        origin: "data_provider",
        paraphrase_permission: true,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000002",
        rights_version_id: "d1250006-0000-4000-8000-000000000002",
        source_identity: "src_fixture_data",
        source_item_identity: "fixture-item:ev_possession:v1",
        source_modality: "structured_data",
        source_role: "reference",
        speaker_identity: null,
      },
    },
    {
      claim_representation_refs: ["d1250008-0000-4000-8000-000000000003"],
      representation: null,
      representation_status: "paraphrase_not_materialized",
      snapshot: {
        acquisition_ref:
          "fixture-acquisition:src_north_coast_gazette:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "exact_excerpt",
          planner: "paraphrase",
          writer: "paraphrase",
        },
        content_hash:
          "a71d542b57e7edcfe91186a9a934b0301845599b4a40f7fecb8d6e633b4b8578",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_001",
        evidence_type: "observation",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000003",
        language: "en-GB",
        locator: {
          body_codepoint_end: 98,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000003",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "text",
        origin: "external_publisher",
        paraphrase_permission: true,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000005",
        rights_version_id: "d1250006-0000-4000-8000-000000000005",
        source_identity: "src_north_coast_gazette",
        source_item_identity: "fixture-item:ev_gazette_shape:v1",
        source_modality: "text",
        source_role: "journalist",
        speaker_identity: null,
      },
    },
    {
      claim_representation_refs: ["d1250008-0000-4000-8000-000000000004"],
      representation: null,
      representation_status: "paraphrase_not_materialized",
      snapshot: {
        acquisition_ref:
          "fixture-acquisition:src_matchboard_analysis:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "exact_excerpt",
          planner: "paraphrase",
          writer: "paraphrase",
        },
        content_hash:
          "98cc45be73f4be9296b343ad543d249a63fc20f6c31daf0a86b6c90eb1b8e4df",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_001",
        evidence_type: "analysis",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000004",
        language: "en-GB",
        locator: {
          body_codepoint_end: 126,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000004",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "text",
        origin: "external_publisher",
        paraphrase_permission: true,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000005",
        rights_version_id: "d1250006-0000-4000-8000-000000000005",
        source_identity: "src_matchboard_analysis",
        source_item_identity: "fixture-item:ev_specialist_wide:v1",
        source_modality: "text",
        source_role: "analyst",
        speaker_identity: null,
      },
    },
    {
      claim_representation_refs: [],
      representation: null,
      representation_status: "paraphrase_not_materialized",
      snapshot: {
        acquisition_ref:
          "fixture-acquisition:src_supporter_forum_a:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "exact_excerpt",
          planner: "paraphrase",
          writer: "paraphrase",
        },
        content_hash:
          "bb010e8fa7d1b2925a142620f20771294db03a6077c78ab72b041a3601cd41f3",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_001",
        evidence_type: "sentiment",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000005",
        language: "en-GB",
        locator: {
          body_codepoint_end: 30,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000005",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "text",
        origin: "supporter_source",
        paraphrase_permission: true,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000007",
        rights_version_id: "d1250006-0000-4000-8000-000000000007",
        source_identity: "src_supporter_forum_a",
        source_item_identity: "fixture-item:ev_supporter_1:v1",
        source_modality: "text",
        source_role: "supporter",
        speaker_identity: "anonymous-synthetic-observation-1",
      },
    },
    {
      claim_representation_refs: [],
      representation: null,
      representation_status: "paraphrase_not_materialized",
      snapshot: {
        acquisition_ref:
          "fixture-acquisition:src_supporter_podcast_b:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "exact_excerpt",
          planner: "paraphrase",
          writer: "paraphrase",
        },
        content_hash:
          "290dca152f388f068d078aca310869cb6aebc6506588f9c9d06de4a5cce1d7e0",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_001",
        evidence_type: "sentiment",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000006",
        language: "en-GB",
        locator: {
          body_codepoint_end: 19,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000006",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "audio",
        origin: "supporter_source",
        paraphrase_permission: true,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000007",
        rights_version_id: "d1250006-0000-4000-8000-000000000007",
        source_identity: "src_supporter_podcast_b",
        source_item_identity: "fixture-item:ev_supporter_2:v1",
        source_modality: "audio",
        source_role: "supporter",
        speaker_identity: "anonymous-synthetic-observation-2",
      },
    },
    {
      claim_representation_refs: [],
      representation: null,
      representation_status: "paraphrase_not_materialized",
      snapshot: {
        acquisition_ref:
          "fixture-acquisition:src_supporter_blog_c:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "exact_excerpt",
          planner: "paraphrase",
          writer: "paraphrase",
        },
        content_hash:
          "3089e7a00a05ca9145a2b83edf9dc3e0fd7d1b7be70df5f5f69ffde049958e21",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_001",
        evidence_type: "sentiment",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000007",
        language: "en-GB",
        locator: {
          body_codepoint_end: 49,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000007",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "text",
        origin: "supporter_source",
        paraphrase_permission: true,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000007",
        rights_version_id: "d1250006-0000-4000-8000-000000000007",
        source_identity: "src_supporter_blog_c",
        source_item_identity: "fixture-item:ev_supporter_3:v1",
        source_modality: "text",
        source_role: "supporter",
        speaker_identity: "anonymous-synthetic-observation-3",
      },
    },
    {
      claim_representation_refs: [],
      representation: null,
      representation_status: "paraphrase_not_materialized",
      snapshot: {
        acquisition_ref:
          "fixture-acquisition:src_supporter_forum_d:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "exact_excerpt",
          planner: "paraphrase",
          writer: "paraphrase",
        },
        content_hash:
          "3a462ce692fcdbdffcb3ce62810b2efbe50a1d18af3460944f46ba00623fdef5",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_001",
        evidence_type: "sentiment",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000008",
        language: "en-GB",
        locator: {
          body_codepoint_end: 13,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000008",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "text",
        origin: "supporter_source",
        paraphrase_permission: true,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000007",
        rights_version_id: "d1250006-0000-4000-8000-000000000007",
        source_identity: "src_supporter_forum_d",
        source_item_identity: "fixture-item:ev_supporter_4:v1",
        source_modality: "text",
        source_role: "supporter",
        speaker_identity: "anonymous-synthetic-observation-4",
      },
    },
    {
      claim_representation_refs: ["d1250008-0000-4000-8000-000000000006"],
      representation: {
        kind: "exact_permitted_span",
        span_end: 83,
        span_start: 71,
        text: "the long ten",
      },
      representation_status: "exact_span",
      snapshot: {
        acquisition_ref:
          "fixture-acquisition:src_east_bank_review_archive:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "exact_excerpt",
          planner: "exact_excerpt",
          writer: "exact_excerpt",
        },
        content_hash:
          "413c4fc6bbce8ab3ec6704e07bfc85f7e6800b92ae8f51de1c430b65a74c6ee3",
        entity_identity: "entity_northbridge_fc",
        event_identity: null,
        evidence_type: "context",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000009",
        language: "en-GB",
        locator: {
          body_codepoint_end: 110,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000009",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "text",
        origin: "external_publisher",
        paraphrase_permission: true,
        quote_permission: true,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000006",
        rights_version_id: "d1250006-0000-4000-8000-000000000006",
        source_identity: "src_east_bank_review_archive",
        source_item_identity: "fixture-item:ev_lore_long_ten:v1",
        source_modality: "text",
        source_role: "reference",
        speaker_identity: null,
      },
    },
    {
      claim_representation_refs: ["d1250008-0000-4000-8000-000000000008"],
      representation: null,
      representation_status: "claim_only",
      snapshot: {
        acquisition_ref: "fixture-acquisition:src_fixture_market:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "claim_only",
          planner: "claim_only",
          writer: "hidden",
        },
        content_hash:
          "348f6a219bc56f3d69f86267c1669d9c672f30db7712dc88cd6a8f4ff6e1f8f4",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_001",
        evidence_type: "analysis",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000010",
        language: "en-GB",
        locator: {
          body_codepoint_end: 32,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000010",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "structured_data",
        origin: "data_provider",
        paraphrase_permission: false,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000003",
        rights_version_id: "d1250006-0000-4000-8000-000000000003",
        source_identity: "src_fixture_market",
        source_item_identity: "fixture-item:ev_market:v1",
        source_modality: "structured_data",
        source_role: "market",
        speaker_identity: null,
      },
    },
    {
      claim_representation_refs: [],
      representation: null,
      representation_status: "claim_only",
      snapshot: {
        acquisition_ref: "fixture-acquisition:src_fixture_data:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "claim_only",
          planner: "claim_only",
          writer: "hidden",
        },
        content_hash:
          "3c7a7888d1ae4d5c6a40aadae89f0db9cf0732c3a22265c65ac688867c785150",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_previous_1",
        evidence_type: "fact",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000012",
        language: "en-GB",
        locator: {
          body_codepoint_end: 52,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000012",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "structured_data",
        origin: "data_provider",
        paraphrase_permission: false,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000002",
        rights_version_id: "d1250006-0000-4000-8000-000000000002",
        source_identity: "src_fixture_data",
        source_item_identity: "fixture-item:ev_prev_1:v1",
        source_modality: "structured_data",
        source_role: "reference",
        speaker_identity: null,
      },
    },
    {
      claim_representation_refs: [],
      representation: null,
      representation_status: "claim_only",
      snapshot: {
        acquisition_ref: "fixture-acquisition:src_fixture_data:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "claim_only",
          planner: "claim_only",
          writer: "hidden",
        },
        content_hash:
          "ad8cbb012e22007db8c815249f907fbbf2039b63c83d3d9be6a222249a7ffd24",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_previous_2",
        evidence_type: "fact",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000013",
        language: "en-GB",
        locator: {
          body_codepoint_end: 62,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000013",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "structured_data",
        origin: "data_provider",
        paraphrase_permission: false,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000002",
        rights_version_id: "d1250006-0000-4000-8000-000000000002",
        source_identity: "src_fixture_data",
        source_item_identity: "fixture-item:ev_prev_2:v1",
        source_modality: "structured_data",
        source_role: "reference",
        speaker_identity: null,
      },
    },
    {
      claim_representation_refs: [],
      representation: null,
      representation_status: "claim_only",
      snapshot: {
        acquisition_ref: "fixture-acquisition:src_fixture_data:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "claim_only",
          planner: "claim_only",
          writer: "hidden",
        },
        content_hash:
          "c5ff2da2639e0f56c53a2812dda8e435f5c7ccfd1df7fe306ace66e075652fba",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_previous_3",
        evidence_type: "fact",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000014",
        language: "en-GB",
        locator: {
          body_codepoint_end: 52,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000014",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "structured_data",
        origin: "data_provider",
        paraphrase_permission: false,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000002",
        rights_version_id: "d1250006-0000-4000-8000-000000000002",
        source_identity: "src_fixture_data",
        source_item_identity: "fixture-item:ev_prev_3:v1",
        source_modality: "structured_data",
        source_role: "reference",
        speaker_identity: null,
      },
    },
    {
      claim_representation_refs: [],
      representation: null,
      representation_status: "claim_only",
      snapshot: {
        acquisition_ref: "fixture-acquisition:src_fixture_data:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "claim_only",
          planner: "claim_only",
          writer: "hidden",
        },
        content_hash:
          "fa9d0a653d449f5d4b599799dffcc487e04f2cc24dbcec7e0451bb102eebdc6b",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_previous_4",
        evidence_type: "fact",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000015",
        language: "en-GB",
        locator: {
          body_codepoint_end: 62,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000015",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "structured_data",
        origin: "data_provider",
        paraphrase_permission: false,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000002",
        rights_version_id: "d1250006-0000-4000-8000-000000000002",
        source_identity: "src_fixture_data",
        source_item_identity: "fixture-item:ev_prev_4:v1",
        source_modality: "structured_data",
        source_role: "reference",
        speaker_identity: null,
      },
    },
    {
      claim_representation_refs: [],
      representation: null,
      representation_status: "claim_only",
      snapshot: {
        acquisition_ref: "fixture-acquisition:src_fixture_data:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "claim_only",
          planner: "claim_only",
          writer: "hidden",
        },
        content_hash:
          "b21989b1b1461ca40d2ce84498250648e5f03949881d9fc3e82167fbf36acba5",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_previous_5",
        evidence_type: "fact",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000016",
        language: "en-GB",
        locator: {
          body_codepoint_end: 52,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000016",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "structured_data",
        origin: "data_provider",
        paraphrase_permission: false,
        quote_permission: false,
        retention_class: "fixture_retained",
        rights_policy_version: "d1250006-0000-4000-8000-000000000002",
        rights_version_id: "d1250006-0000-4000-8000-000000000002",
        source_identity: "src_fixture_data",
        source_item_identity: "fixture-item:ev_prev_5:v1",
        source_modality: "structured_data",
        source_role: "reference",
        speaker_identity: null,
      },
    },
  ],
  limits: [
    "authentic_persisted_freeze_not_verified",
    "current_rights_and_current_use_not_verified",
    "evidence_paraphrases_not_materialized",
    "two_free_text_claim_values_withheld",
    "approved_claim_representation_prose_not_emitted",
    "complete_fixture_consumer_adequacy_not_established",
    "support_sufficiency_and_semantic_truth_not_certified",
    "planner_configuration_and_execution_not_included",
  ],
  materialization: "supplied_snapshot_candidate",
  package_hash:
    "a8655c0e8bd72094a823b367a0c21cd665d3d99c271341286a92dbdc2ea304ab",
  package_id: "d1250004-0000-4000-8000-000000000001",
  schema: "planner-fixture-consumer-snapshot/1",
  scope: {
    competition_ids: ["competition_north_coast_league"],
    entity_ids: ["entity_northbridge_fc"],
    event_ids: ["event_fixture_001"],
    locale: "en-GB",
    scheduled_default_mode: "normal_post_event",
    scope_type: "event",
    show_id: "d1250002-0000-4000-8000-000000000001",
    target_publication_slot_ref: "fixture_slot_001",
  },
  scope_hash:
    "ecb1eb2b675a9e383dfe88e6311f8cc88cc97eb17183df9a8cae935d8d1f8979",
  selection_provenance: {
    context_retrieval_version: "fixture.manual.v1",
    live_search: false,
    match_window_proof: {
      as_of: "2026-09-27T12:59:00Z",
      competition_identity: "competition_north_coast_league",
      complete_prior_schedule_assertion: true,
      current_event: {
        competition_identity: "competition_north_coast_league",
        completed_at: "2026-09-27T12:00:00Z",
        completion_status: "final",
        event_identity: "event_fixture_001",
        participant_entities: [
          "entity_northbridge_fc",
          "entity_southbank_athletic",
        ],
      },
      current_event_identity: "event_fixture_001",
      entity_identity: "entity_northbridge_fc",
      ordered_prior_schedule: [
        {
          competition_identity: "competition_north_coast_league",
          completed_at: "2026-09-21T12:00:00Z",
          completion_status: "final",
          entity_identity: "entity_northbridge_fc",
          event_identity: "event_fixture_previous_1",
          rank_before_current_event: 1,
        },
        {
          competition_identity: "competition_north_coast_league",
          completed_at: "2026-09-14T12:00:00Z",
          completion_status: "final",
          entity_identity: "entity_northbridge_fc",
          event_identity: "event_fixture_previous_2",
          rank_before_current_event: 2,
        },
        {
          competition_identity: "competition_north_coast_league",
          completed_at: "2026-09-07T12:00:00Z",
          completion_status: "final",
          entity_identity: "entity_northbridge_fc",
          event_identity: "event_fixture_previous_3",
          rank_before_current_event: 3,
        },
        {
          competition_identity: "competition_north_coast_league",
          completed_at: "2026-08-31T12:00:00Z",
          completion_status: "final",
          entity_identity: "entity_northbridge_fc",
          event_identity: "event_fixture_previous_4",
          rank_before_current_event: 4,
        },
        {
          competition_identity: "competition_north_coast_league",
          completed_at: "2026-08-24T12:00:00Z",
          completion_status: "final",
          entity_identity: "entity_northbridge_fc",
          event_identity: "event_fixture_previous_5",
          rank_before_current_event: 5,
        },
        {
          competition_identity: "competition_north_coast_league",
          completed_at: "2026-08-17T12:00:00Z",
          completion_status: "final",
          entity_identity: "entity_northbridge_fc",
          event_identity: "event_fixture_previous_6",
          rank_before_current_event: 6,
        },
      ],
      schedule_scope:
        "complete six most recent prior completed league matches in this synthetic fixture",
      selected_event_identities: [
        "event_fixture_previous_1",
        "event_fixture_previous_2",
        "event_fixture_previous_3",
        "event_fixture_previous_4",
        "event_fixture_previous_5",
      ],
      selection_rule:
        "last five completed league matches before current event; descending completion time",
      source_identity: "src_fixture_data",
      source_record_ref: "fixture-schedule-ledger-v1",
      synthetic: true,
      window_identity: "fixture-last-five-league-before-event-001-v1",
    },
    operator: "fixture_builder",
    selector_version: "fixture.manual.v2",
  },
  sensitivities: [
    {
      applies_to: "event_fixture_001",
      note: "No in-scope serious incident or protected sensitivity at freeze.",
      sensitivity_id: "sens_none",
      state: "none",
    },
  ],
  signals: [
    {
      ref: "artifact:d1250005-0000-4000-8000-000000000017",
      signal_id: "sig_tenor",
      type: "tenor_reading",
    },
    {
      ref: "d1250009-0000-4000-8000-000000000001",
      signal_id: "sig_late_pattern",
      type: "derivation_run",
    },
  ],
  silent_inputs: [
    {
      allowed_consumers: ["planner", "auditor"],
      claim_id: "d1250008-0000-4000-8000-000000000008",
      effective_usage_class: "silent",
      purpose: "calibration_only",
      support_refs: ["d1250007-0000-4000-8000-000000000010"],
    },
  ],
  source_attribution: [
    {
      display_name: "North Coast Gazette",
      source_id: "src_north_coast_gazette",
      source_role: "journalist",
    },
    {
      display_name: "Matchboard Analysis",
      source_id: "src_matchboard_analysis",
      source_role: "analyst",
    },
    {
      display_name: "East Bank Review Archive",
      source_id: "src_east_bank_review_archive",
      source_role: "reference",
    },
  ],
  version_refs: {
    claims_policy: "0.1.2",
    evidence_package_spec: "0.2.2",
    lens_definition: "fixture-lens-v1",
    rights_registry: "fixture-rights-v1",
    show_version: "postmatch-fixture-v4",
  },
} as const;
const FIXED_SUMMARIES = [
  {
    claim_id: "d1250008-0000-4000-8000-000000000001",
    claim_support_id: "d125000a-0000-4000-8000-000000000001",
    inspection: {
      content_hash:
        "5dfd65df76fdcd9b3fa8b2ab730cb38712f3941875ad2ae1319d788d256bd1a3",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000001",
      planner_exposure: "claim_only",
      rights_version_id: "d1250006-0000-4000-8000-000000000004",
    },
    support_hash:
      "5dfd65df76fdcd9b3fa8b2ab730cb38712f3941875ad2ae1319d788d256bd1a3",
    support_kind: "evidence",
    support_role: "supports_value",
  },
  {
    claim_id: "d1250008-0000-4000-8000-000000000002",
    claim_support_id: "d125000a-0000-4000-8000-000000000002",
    inspection: {
      content_hash:
        "a5565030c5163db39ffd10a1cd80a07cb30559d898737d23d87fc4f029fefdb0",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000002",
      planner_exposure: "claim_only",
      rights_version_id: "d1250006-0000-4000-8000-000000000002",
    },
    support_hash:
      "a5565030c5163db39ffd10a1cd80a07cb30559d898737d23d87fc4f029fefdb0",
    support_kind: "evidence",
    support_role: "supports_value",
  },
  {
    claim_id: "d1250008-0000-4000-8000-000000000003",
    claim_support_id: "d125000a-0000-4000-8000-000000000003",
    inspection: {
      content_hash:
        "a71d542b57e7edcfe91186a9a934b0301845599b4a40f7fecb8d6e633b4b8578",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000003",
      planner_exposure: "paraphrase",
      rights_version_id: "d1250006-0000-4000-8000-000000000005",
    },
    support_hash:
      "a71d542b57e7edcfe91186a9a934b0301845599b4a40f7fecb8d6e633b4b8578",
    support_kind: "evidence",
    support_role: "supports_value",
  },
  {
    claim_id: "d1250008-0000-4000-8000-000000000004",
    claim_support_id: "d125000a-0000-4000-8000-000000000004",
    inspection: {
      content_hash:
        "98cc45be73f4be9296b343ad543d249a63fc20f6c31daf0a86b6c90eb1b8e4df",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000004",
      planner_exposure: "paraphrase",
      rights_version_id: "d1250006-0000-4000-8000-000000000005",
    },
    support_hash:
      "98cc45be73f4be9296b343ad543d249a63fc20f6c31daf0a86b6c90eb1b8e4df",
    support_kind: "evidence",
    support_role: "supports_value",
  },
  {
    claim_id: "d1250008-0000-4000-8000-000000000005",
    claim_support_id: "d125000a-0000-4000-8000-000000000005",
    inspection: {
      artifact_id: "d1250005-0000-4000-8000-000000000017",
      canonical_payload: {
        projection: {
          as_of: "2026-09-27T12:59:00Z",
          authored_synthetic_interpretation: {
            confidence: "medium",
            direction: "relief_over_celebration",
            intensity: "moderate",
          },
          entity_identity: "entity_northbridge_fc",
          event_identity: "event_fixture_001",
          method_version: "bounded-supporter-tenor/v1",
          observation_count: 4,
          observation_set_identity: "fixture-supporter-reaction-event-001-v1",
          observations: [
            {
              content_hash:
                "bb010e8fa7d1b2925a142620f20771294db03a6077c78ab72b041a3601cd41f3",
              evidence_unit_id: "d1250007-0000-4000-8000-000000000005",
              observation_order: 1,
              scoped_description_ref: {
                evidence_unit_id: "d1250007-0000-4000-8000-000000000005",
                member: "evidence_store.json",
              },
              source_identity: "src_supporter_forum_a",
            },
            {
              content_hash:
                "290dca152f388f068d078aca310869cb6aebc6506588f9c9d06de4a5cce1d7e0",
              evidence_unit_id: "d1250007-0000-4000-8000-000000000006",
              observation_order: 2,
              scoped_description_ref: {
                evidence_unit_id: "d1250007-0000-4000-8000-000000000006",
                member: "evidence_store.json",
              },
              source_identity: "src_supporter_podcast_b",
            },
            {
              content_hash:
                "3089e7a00a05ca9145a2b83edf9dc3e0fd7d1b7be70df5f5f69ffde049958e21",
              evidence_unit_id: "d1250007-0000-4000-8000-000000000007",
              observation_order: 3,
              scoped_description_ref: {
                evidence_unit_id: "d1250007-0000-4000-8000-000000000007",
                member: "evidence_store.json",
              },
              source_identity: "src_supporter_blog_c",
            },
            {
              content_hash:
                "3a462ce692fcdbdffcb3ce62810b2efbe50a1d18af3460944f46ba00623fdef5",
              evidence_unit_id: "d1250007-0000-4000-8000-000000000008",
              observation_order: 4,
              scoped_description_ref: {
                evidence_unit_id: "d1250007-0000-4000-8000-000000000008",
                member: "evidence_store.json",
              },
              source_identity: "src_supporter_forum_d",
            },
          ],
        },
        support_kind: "signal",
      },
      content_hash:
        "46e6a24048f151f62f9e03a66bb57ca4aae78c0281630850bc74bf9205cd4c28",
    },
    support_hash:
      "46e6a24048f151f62f9e03a66bb57ca4aae78c0281630850bc74bf9205cd4c28",
    support_kind: "signal",
    support_role: "supports_value",
  },
  {
    claim_id: "d1250008-0000-4000-8000-000000000006",
    claim_support_id: "d125000a-0000-4000-8000-000000000006",
    inspection: {
      content_hash:
        "413c4fc6bbce8ab3ec6704e07bfc85f7e6800b92ae8f51de1c430b65a74c6ee3",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000009",
      planner_exposure: "exact_excerpt",
      rights_version_id: "d1250006-0000-4000-8000-000000000006",
    },
    support_hash:
      "413c4fc6bbce8ab3ec6704e07bfc85f7e6800b92ae8f51de1c430b65a74c6ee3",
    support_kind: "evidence",
    support_role: "supports_value",
  },
  {
    claim_id: "d1250008-0000-4000-8000-000000000007",
    claim_support_id: "d125000a-0000-4000-8000-000000000007",
    inspection: {
      created_at: "2026-09-27T12:59:30Z",
      derivation_run_id: "d1250009-0000-4000-8000-000000000001",
      exact_input_refs: [
        {
          content_hash:
            "3c7a7888d1ae4d5c6a40aadae89f0db9cf0732c3a22265c65ac688867c785150",
          evidence_unit_id: "d1250007-0000-4000-8000-000000000012",
          selected_provenance: {
            acquisition_ref:
              "fixture-acquisition:src_fixture_data:2026-09-27:v1",
            as_of: "2026-09-27T12:59:00Z",
            competition_identity: "competition_north_coast_league",
            consumer_exposure: {
              auditor: "claim_only",
              planner: "claim_only",
              writer: "hidden",
            },
            entity_identity: "entity_northbridge_fc",
            event_completed_at: "2026-09-21T12:00:00Z",
            event_identity: "event_fixture_previous_1",
            evidence_unit_id: "d1250007-0000-4000-8000-000000000012",
            language: "en-GB",
            locator: {
              body_codepoint_end: 52,
              body_codepoint_start: 0,
              evidence_unit_id: "d1250007-0000-4000-8000-000000000012",
              kind: "synthetic_fixture_text",
              member: "evidence_store.json",
            },
            origin: "data_provider",
            paraphrase_permission: false,
            quote_permission: false,
            retention_declaration: {
              canonical_source_bytes: "durable_offline_test_retention",
              policy_version: "synthetic-fixture-retention-v1",
              purge_behavior:
                "retain permitted tombstone metadata; no replacement bytes",
            },
            rights_version_id: "d1250006-0000-4000-8000-000000000002",
            source_identity: "src_fixture_data",
            source_item_identity: "fixture-item:ev_prev_1:v1",
            source_modality: "structured_data",
            source_role: "reference",
            speaker_identity: null,
            window_identity: "fixture-last-five-league-before-event-001-v1",
            window_order: 1,
          },
          window_proof: {
            as_of: "2026-09-27T12:59:00Z",
            competition_identity: "competition_north_coast_league",
            complete_prior_schedule_assertion: true,
            current_event: {
              competition_identity: "competition_north_coast_league",
              completed_at: "2026-09-27T12:00:00Z",
              completion_status: "final",
              event_identity: "event_fixture_001",
              participant_entities: [
                "entity_northbridge_fc",
                "entity_southbank_athletic",
              ],
            },
            current_event_identity: "event_fixture_001",
            entity_identity: "entity_northbridge_fc",
            ordered_prior_schedule: [
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-09-21T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_1",
                rank_before_current_event: 1,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-09-14T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_2",
                rank_before_current_event: 2,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-09-07T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_3",
                rank_before_current_event: 3,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-08-31T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_4",
                rank_before_current_event: 4,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-08-24T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_5",
                rank_before_current_event: 5,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-08-17T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_6",
                rank_before_current_event: 6,
              },
            ],
            schedule_scope:
              "complete six most recent prior completed league matches in this synthetic fixture",
            selected_event_identities: [
              "event_fixture_previous_1",
              "event_fixture_previous_2",
              "event_fixture_previous_3",
              "event_fixture_previous_4",
              "event_fixture_previous_5",
            ],
            selection_rule:
              "last five completed league matches before current event; descending completion time",
            source_identity: "src_fixture_data",
            source_record_ref: "fixture-schedule-ledger-v1",
            synthetic: true,
            window_identity: "fixture-last-five-league-before-event-001-v1",
          },
        },
        {
          content_hash:
            "ad8cbb012e22007db8c815249f907fbbf2039b63c83d3d9be6a222249a7ffd24",
          evidence_unit_id: "d1250007-0000-4000-8000-000000000013",
          selected_provenance: {
            acquisition_ref:
              "fixture-acquisition:src_fixture_data:2026-09-27:v1",
            as_of: "2026-09-27T12:59:00Z",
            competition_identity: "competition_north_coast_league",
            consumer_exposure: {
              auditor: "claim_only",
              planner: "claim_only",
              writer: "hidden",
            },
            entity_identity: "entity_northbridge_fc",
            event_completed_at: "2026-09-14T12:00:00Z",
            event_identity: "event_fixture_previous_2",
            evidence_unit_id: "d1250007-0000-4000-8000-000000000013",
            language: "en-GB",
            locator: {
              body_codepoint_end: 62,
              body_codepoint_start: 0,
              evidence_unit_id: "d1250007-0000-4000-8000-000000000013",
              kind: "synthetic_fixture_text",
              member: "evidence_store.json",
            },
            origin: "data_provider",
            paraphrase_permission: false,
            quote_permission: false,
            retention_declaration: {
              canonical_source_bytes: "durable_offline_test_retention",
              policy_version: "synthetic-fixture-retention-v1",
              purge_behavior:
                "retain permitted tombstone metadata; no replacement bytes",
            },
            rights_version_id: "d1250006-0000-4000-8000-000000000002",
            source_identity: "src_fixture_data",
            source_item_identity: "fixture-item:ev_prev_2:v1",
            source_modality: "structured_data",
            source_role: "reference",
            speaker_identity: null,
            window_identity: "fixture-last-five-league-before-event-001-v1",
            window_order: 2,
          },
          window_proof: {
            as_of: "2026-09-27T12:59:00Z",
            competition_identity: "competition_north_coast_league",
            complete_prior_schedule_assertion: true,
            current_event: {
              competition_identity: "competition_north_coast_league",
              completed_at: "2026-09-27T12:00:00Z",
              completion_status: "final",
              event_identity: "event_fixture_001",
              participant_entities: [
                "entity_northbridge_fc",
                "entity_southbank_athletic",
              ],
            },
            current_event_identity: "event_fixture_001",
            entity_identity: "entity_northbridge_fc",
            ordered_prior_schedule: [
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-09-21T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_1",
                rank_before_current_event: 1,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-09-14T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_2",
                rank_before_current_event: 2,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-09-07T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_3",
                rank_before_current_event: 3,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-08-31T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_4",
                rank_before_current_event: 4,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-08-24T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_5",
                rank_before_current_event: 5,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-08-17T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_6",
                rank_before_current_event: 6,
              },
            ],
            schedule_scope:
              "complete six most recent prior completed league matches in this synthetic fixture",
            selected_event_identities: [
              "event_fixture_previous_1",
              "event_fixture_previous_2",
              "event_fixture_previous_3",
              "event_fixture_previous_4",
              "event_fixture_previous_5",
            ],
            selection_rule:
              "last five completed league matches before current event; descending completion time",
            source_identity: "src_fixture_data",
            source_record_ref: "fixture-schedule-ledger-v1",
            synthetic: true,
            window_identity: "fixture-last-five-league-before-event-001-v1",
          },
        },
        {
          content_hash:
            "c5ff2da2639e0f56c53a2812dda8e435f5c7ccfd1df7fe306ace66e075652fba",
          evidence_unit_id: "d1250007-0000-4000-8000-000000000014",
          selected_provenance: {
            acquisition_ref:
              "fixture-acquisition:src_fixture_data:2026-09-27:v1",
            as_of: "2026-09-27T12:59:00Z",
            competition_identity: "competition_north_coast_league",
            consumer_exposure: {
              auditor: "claim_only",
              planner: "claim_only",
              writer: "hidden",
            },
            entity_identity: "entity_northbridge_fc",
            event_completed_at: "2026-09-07T12:00:00Z",
            event_identity: "event_fixture_previous_3",
            evidence_unit_id: "d1250007-0000-4000-8000-000000000014",
            language: "en-GB",
            locator: {
              body_codepoint_end: 52,
              body_codepoint_start: 0,
              evidence_unit_id: "d1250007-0000-4000-8000-000000000014",
              kind: "synthetic_fixture_text",
              member: "evidence_store.json",
            },
            origin: "data_provider",
            paraphrase_permission: false,
            quote_permission: false,
            retention_declaration: {
              canonical_source_bytes: "durable_offline_test_retention",
              policy_version: "synthetic-fixture-retention-v1",
              purge_behavior:
                "retain permitted tombstone metadata; no replacement bytes",
            },
            rights_version_id: "d1250006-0000-4000-8000-000000000002",
            source_identity: "src_fixture_data",
            source_item_identity: "fixture-item:ev_prev_3:v1",
            source_modality: "structured_data",
            source_role: "reference",
            speaker_identity: null,
            window_identity: "fixture-last-five-league-before-event-001-v1",
            window_order: 3,
          },
          window_proof: {
            as_of: "2026-09-27T12:59:00Z",
            competition_identity: "competition_north_coast_league",
            complete_prior_schedule_assertion: true,
            current_event: {
              competition_identity: "competition_north_coast_league",
              completed_at: "2026-09-27T12:00:00Z",
              completion_status: "final",
              event_identity: "event_fixture_001",
              participant_entities: [
                "entity_northbridge_fc",
                "entity_southbank_athletic",
              ],
            },
            current_event_identity: "event_fixture_001",
            entity_identity: "entity_northbridge_fc",
            ordered_prior_schedule: [
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-09-21T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_1",
                rank_before_current_event: 1,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-09-14T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_2",
                rank_before_current_event: 2,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-09-07T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_3",
                rank_before_current_event: 3,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-08-31T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_4",
                rank_before_current_event: 4,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-08-24T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_5",
                rank_before_current_event: 5,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-08-17T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_6",
                rank_before_current_event: 6,
              },
            ],
            schedule_scope:
              "complete six most recent prior completed league matches in this synthetic fixture",
            selected_event_identities: [
              "event_fixture_previous_1",
              "event_fixture_previous_2",
              "event_fixture_previous_3",
              "event_fixture_previous_4",
              "event_fixture_previous_5",
            ],
            selection_rule:
              "last five completed league matches before current event; descending completion time",
            source_identity: "src_fixture_data",
            source_record_ref: "fixture-schedule-ledger-v1",
            synthetic: true,
            window_identity: "fixture-last-five-league-before-event-001-v1",
          },
        },
        {
          content_hash:
            "fa9d0a653d449f5d4b599799dffcc487e04f2cc24dbcec7e0451bb102eebdc6b",
          evidence_unit_id: "d1250007-0000-4000-8000-000000000015",
          selected_provenance: {
            acquisition_ref:
              "fixture-acquisition:src_fixture_data:2026-09-27:v1",
            as_of: "2026-09-27T12:59:00Z",
            competition_identity: "competition_north_coast_league",
            consumer_exposure: {
              auditor: "claim_only",
              planner: "claim_only",
              writer: "hidden",
            },
            entity_identity: "entity_northbridge_fc",
            event_completed_at: "2026-08-31T12:00:00Z",
            event_identity: "event_fixture_previous_4",
            evidence_unit_id: "d1250007-0000-4000-8000-000000000015",
            language: "en-GB",
            locator: {
              body_codepoint_end: 62,
              body_codepoint_start: 0,
              evidence_unit_id: "d1250007-0000-4000-8000-000000000015",
              kind: "synthetic_fixture_text",
              member: "evidence_store.json",
            },
            origin: "data_provider",
            paraphrase_permission: false,
            quote_permission: false,
            retention_declaration: {
              canonical_source_bytes: "durable_offline_test_retention",
              policy_version: "synthetic-fixture-retention-v1",
              purge_behavior:
                "retain permitted tombstone metadata; no replacement bytes",
            },
            rights_version_id: "d1250006-0000-4000-8000-000000000002",
            source_identity: "src_fixture_data",
            source_item_identity: "fixture-item:ev_prev_4:v1",
            source_modality: "structured_data",
            source_role: "reference",
            speaker_identity: null,
            window_identity: "fixture-last-five-league-before-event-001-v1",
            window_order: 4,
          },
          window_proof: {
            as_of: "2026-09-27T12:59:00Z",
            competition_identity: "competition_north_coast_league",
            complete_prior_schedule_assertion: true,
            current_event: {
              competition_identity: "competition_north_coast_league",
              completed_at: "2026-09-27T12:00:00Z",
              completion_status: "final",
              event_identity: "event_fixture_001",
              participant_entities: [
                "entity_northbridge_fc",
                "entity_southbank_athletic",
              ],
            },
            current_event_identity: "event_fixture_001",
            entity_identity: "entity_northbridge_fc",
            ordered_prior_schedule: [
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-09-21T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_1",
                rank_before_current_event: 1,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-09-14T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_2",
                rank_before_current_event: 2,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-09-07T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_3",
                rank_before_current_event: 3,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-08-31T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_4",
                rank_before_current_event: 4,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-08-24T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_5",
                rank_before_current_event: 5,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-08-17T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_6",
                rank_before_current_event: 6,
              },
            ],
            schedule_scope:
              "complete six most recent prior completed league matches in this synthetic fixture",
            selected_event_identities: [
              "event_fixture_previous_1",
              "event_fixture_previous_2",
              "event_fixture_previous_3",
              "event_fixture_previous_4",
              "event_fixture_previous_5",
            ],
            selection_rule:
              "last five completed league matches before current event; descending completion time",
            source_identity: "src_fixture_data",
            source_record_ref: "fixture-schedule-ledger-v1",
            synthetic: true,
            window_identity: "fixture-last-five-league-before-event-001-v1",
          },
        },
        {
          content_hash:
            "b21989b1b1461ca40d2ce84498250648e5f03949881d9fc3e82167fbf36acba5",
          evidence_unit_id: "d1250007-0000-4000-8000-000000000016",
          selected_provenance: {
            acquisition_ref:
              "fixture-acquisition:src_fixture_data:2026-09-27:v1",
            as_of: "2026-09-27T12:59:00Z",
            competition_identity: "competition_north_coast_league",
            consumer_exposure: {
              auditor: "claim_only",
              planner: "claim_only",
              writer: "hidden",
            },
            entity_identity: "entity_northbridge_fc",
            event_completed_at: "2026-08-24T12:00:00Z",
            event_identity: "event_fixture_previous_5",
            evidence_unit_id: "d1250007-0000-4000-8000-000000000016",
            language: "en-GB",
            locator: {
              body_codepoint_end: 52,
              body_codepoint_start: 0,
              evidence_unit_id: "d1250007-0000-4000-8000-000000000016",
              kind: "synthetic_fixture_text",
              member: "evidence_store.json",
            },
            origin: "data_provider",
            paraphrase_permission: false,
            quote_permission: false,
            retention_declaration: {
              canonical_source_bytes: "durable_offline_test_retention",
              policy_version: "synthetic-fixture-retention-v1",
              purge_behavior:
                "retain permitted tombstone metadata; no replacement bytes",
            },
            rights_version_id: "d1250006-0000-4000-8000-000000000002",
            source_identity: "src_fixture_data",
            source_item_identity: "fixture-item:ev_prev_5:v1",
            source_modality: "structured_data",
            source_role: "reference",
            speaker_identity: null,
            window_identity: "fixture-last-five-league-before-event-001-v1",
            window_order: 5,
          },
          window_proof: {
            as_of: "2026-09-27T12:59:00Z",
            competition_identity: "competition_north_coast_league",
            complete_prior_schedule_assertion: true,
            current_event: {
              competition_identity: "competition_north_coast_league",
              completed_at: "2026-09-27T12:00:00Z",
              completion_status: "final",
              event_identity: "event_fixture_001",
              participant_entities: [
                "entity_northbridge_fc",
                "entity_southbank_athletic",
              ],
            },
            current_event_identity: "event_fixture_001",
            entity_identity: "entity_northbridge_fc",
            ordered_prior_schedule: [
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-09-21T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_1",
                rank_before_current_event: 1,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-09-14T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_2",
                rank_before_current_event: 2,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-09-07T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_3",
                rank_before_current_event: 3,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-08-31T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_4",
                rank_before_current_event: 4,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-08-24T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_5",
                rank_before_current_event: 5,
              },
              {
                competition_identity: "competition_north_coast_league",
                completed_at: "2026-08-17T12:00:00Z",
                completion_status: "final",
                entity_identity: "entity_northbridge_fc",
                event_identity: "event_fixture_previous_6",
                rank_before_current_event: 6,
              },
            ],
            schedule_scope:
              "complete six most recent prior completed league matches in this synthetic fixture",
            selected_event_identities: [
              "event_fixture_previous_1",
              "event_fixture_previous_2",
              "event_fixture_previous_3",
              "event_fixture_previous_4",
              "event_fixture_previous_5",
            ],
            selection_rule:
              "last five completed league matches before current event; descending completion time",
            source_identity: "src_fixture_data",
            source_record_ref: "fixture-schedule-ledger-v1",
            synthetic: true,
            window_identity: "fixture-last-five-league-before-event-001-v1",
          },
        },
      ],
      output: { after_minute: 80, count: 3, sample_size: 5 },
      output_hash:
        "eb65fd3581e65333e7dcc68a0150e17dc8e728c8e348510b7c3ca12f2d748a88",
      parameters: { after_minute: 80, window_matches: 5 },
      rule_version: "late-concession-count/v1",
    },
    support_hash:
      "eb65fd3581e65333e7dcc68a0150e17dc8e728c8e348510b7c3ca12f2d748a88",
    support_kind: "derivation",
    support_role: "supports_value",
  },
  {
    claim_id: "d1250008-0000-4000-8000-000000000008",
    claim_support_id: "d125000a-0000-4000-8000-000000000008",
    inspection: {
      content_hash:
        "348f6a219bc56f3d69f86267c1669d9c672f30db7712dc88cd6a8f4ff6e1f8f4",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000010",
      planner_exposure: "claim_only",
      rights_version_id: "d1250006-0000-4000-8000-000000000003",
    },
    support_hash:
      "348f6a219bc56f3d69f86267c1669d9c672f30db7712dc88cd6a8f4ff6e1f8f4",
    support_kind: "evidence",
    support_role: "supports_value",
  },
  {
    claim_id: "d1250008-0000-4000-8000-000000000009",
    claim_support_id: "d125000a-0000-4000-8000-000000000009",
    inspection: {
      artifact_id: "d1250005-0000-4000-8000-000000000018",
      canonical_payload: {
        projection: {
          external_episode_ref: "fixture-external:episode_fixture_prior_001",
          external_script_ref: "fixture-external:scr_fixture_prior_001",
          external_script_version_ref: "fixture-external:prior-script/v1",
          on_air_occurrence: {
            exact_text: "Late-game control remains unresolved.",
            occurrence_identity: "fixture-external:late-control-occurrence-001",
            occurrence_time: "2026-09-21T13:30:00Z",
            participant_identity: "tully",
            position: "late-game control remained unresolved",
            semantic_turn_ref: "prior_tully_close_001",
          },
          publication_attestation: {
            attestation_identity:
              "fixture-external:publication-attestation-001",
            attested_by: "The Desk synthetic fixture author",
            published_at: "2026-09-21T14:00:00Z",
            state: "published",
            synthetic: true,
          },
          topic_thread_id: "thr_late_game_control",
          withdrawn: false,
        },
        support_kind: "continuity",
      },
      content_hash:
        "2192b1ec1e126a0d7f705e69338cc5e2b457c6cd8f13136bc07f72cccdf46dd1",
    },
    support_hash:
      "2192b1ec1e126a0d7f705e69338cc5e2b457c6cd8f13136bc07f72cccdf46dd1",
    support_kind: "continuity",
    support_role: "supports_value",
  },
] as const;
const FIXED_V = { ...FIXED_V_FIELDS, support_summaries: FIXED_SUMMARIES };

export type PC2FaultPhase = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type Phase = Exclude<PC2FaultPhase, 9>;
type Code =
  | "arguments_not_allowed"
  | "source_type_invalid"
  | "source_anchor_refused"
  | "archival_source_refused"
  | "source_role_refused"
  | "reader_schema_refused"
  | "reader_refused"
  | "source_resource_limit"
  | "source_utf8_invalid"
  | "source_json_invalid"
  | "source_record_invalid"
  | "necessary_source_unavailable"
  | "source_version_unsupported"
  | "rights_grant_refused"
  | "external_provider_forbidden"
  | "configuration_shape_invalid"
  | "configuration_version_unsupported"
  | "configuration_binding_refused"
  | "current_use_unsupported"
  | "inspection_dependency_refused"
  | "dependency_result_invalid"
  | "registry_binding_refused"
  | "candidate_resource_limit"
  | "source_identity_mismatch"
  | "dependency_identity_mismatch";
export interface PC2Rejection {
  readonly kind: "rejected";
  readonly profile: typeof PROFILE;
  readonly phase: Phase;
  readonly code: Code;
  readonly field: string;
  readonly reader_code: string | null;
  readonly dependency: PlannerFixtureConsumerRejection | null;
}
export interface PC2Candidate {
  readonly kind: "source_bound_fixture_candidate";
  readonly profile: typeof PROFILE;
  readonly data: typeof FIXED_M & { readonly planner_data: typeof FIXED_P };
  readonly candidate_json: string;
  readonly identity: { readonly utf8_bytes: string; readonly sha256: string };
}
export type PC2Result = PC2Candidate | PC2Rejection;
export class PC2FixtureInputFault extends Error {
  declare readonly code: "unexpected_failure";
  declare readonly phase: PC2FaultPhase;
  constructor(phase: PC2FaultPhase) {
    super("PC2 fixture input failed");
    const p =
      arguments.length === 1 &&
      typeof phase === "number" &&
      Number.isInteger(phase) &&
      phase >= 0 &&
      phase <= 9
        ? phase === 0
          ? 0
          : phase
        : 9;
    for (const [key, value] of Object.entries({
      name: "PC2FixtureInputFault",
      message: "PC2 fixture input failed",
      stack: "PC2FixtureInputFault: PC2 fixture input failed",
      code: "unexpected_failure",
      phase: p,
    }))
      Object.defineProperty(this, key, {
        value,
        enumerable: key === "code" || key === "phase",
        writable: false,
        configurable: false,
      });
    Object.freeze(this);
  }
}
class Refusal extends Error {
  constructor(readonly result: PC2Rejection) {
    super("PC2 refusal");
  }
}
function reject(
  phase: Phase,
  code: Code,
  field: string,
  reader_code: string | null = null,
  dependency: PlannerFixtureConsumerRejection | null = null,
): never {
  throw new Refusal(
    freeze({
      kind: "rejected" as const,
      profile: PROFILE,
      phase,
      code,
      field,
      reader_code,
      dependency,
    }),
  );
}
function freeze<T>(v: T): T {
  if (v !== null && typeof v === "object") {
    Object.freeze(v);
    for (const c of Object.values(v)) freeze(c);
  }
  return v;
}
function copy(v: J): J {
  if (Array.isArray(v)) return v.map(copy);
  if (v !== null && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v).map((k) => {
        const child = v[k];
        if (child === undefined) throw new TypeError("owned undefined");
        return [k, copy(child)];
      }),
    );
  return v;
}
function obj(v: unknown): O {
  if (v === null || typeof v !== "object" || Array.isArray(v))
    throw new TypeError("owned record");
  return v as O;
}
function arr(v: unknown): J[] {
  if (!Array.isArray(v)) throw new TypeError("owned array");
  return v as J[];
}
function objects(v: unknown): O[] {
  return arr(v).map(obj);
}
function str(v: unknown): string {
  if (typeof v !== "string") throw new TypeError("owned text");
  return v;
}
function num(v: unknown): number {
  if (typeof v !== "number") throw new TypeError("owned number");
  return v;
}
function at(p: string, i: number): string {
  return p + "[" + String(i) + "]";
}
function raw(v: string | Uint8Array): string {
  return createHash("sha256").update(v).digest("hex");
}
function identity(v: string | Uint8Array): { bytes: number; sha256: string } {
  return {
    bytes: typeof v === "string" ? Buffer.byteLength(v, "utf8") : v.byteLength,
    sha256: raw(v),
  };
}
function same(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const uuid4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hex = /^[0-9a-f]{64}$/;
const artifact =
  /^artifact:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function unpaired(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const x = s.charCodeAt(i);
    if (x >= 0xd800 && x <= 0xdbff) {
      const y = s.charCodeAt(++i);
      if (!(y >= 0xdc00 && y <= 0xdfff)) return true;
    } else if (x >= 0xdc00 && x <= 0xdfff) return true;
  }
  return false;
}
function textOK(v: unknown): v is string {
  return (
    typeof v === "string" &&
    !unpaired(v) &&
    v.normalize("NFC") === v &&
    v.length <= 16384 &&
    v.trim().length > 0
  );
}
function plain(v: unknown): v is O {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    (Object.getPrototypeOf(v) === Object.prototype ||
      Object.getPrototypeOf(v) === null)
  );
}
function surface(
  v: unknown,
  keys: readonly string[],
  phase: Phase,
  code: Code,
  path: string,
): O {
  const fail = (field: string): never =>
    reject(phase, code, phase === 1 ? "reader" : field);
  if (!plain(v)) return fail(path);
  const own = Reflect.ownKeys(v);
  for (const k of [...keys].sort())
    if (!Object.hasOwn(v, k)) fail(path + "." + k);
  if (own.some((k) => typeof k !== "string")) fail(path);
  if (
    own.length !== keys.length ||
    own.some((k) => typeof k !== "string" || !keys.includes(k))
  )
    fail(path);
  for (const k of keys) {
    const d = Object.getOwnPropertyDescriptor(v, k);
    if (!d || !("value" in d)) fail(path);
  }
  return v;
}
function graph(v: unknown, phase: Phase, path: string, source: boolean): void {
  let nodes = 0;
  const cap = source ? 65536 : 32768;
  function visit(x: unknown, depth: number): void {
    if (++nodes > cap)
      reject(
        phase,
        source ? "source_resource_limit" : "dependency_result_invalid",
        path,
      );
    if (x === null || typeof x === "boolean") return;
    if (typeof x === "number") {
      if (source && (!Number.isSafeInteger(x) || Object.is(x, -0)))
        reject(phase, "source_record_invalid", path);
      return;
    }
    if (typeof x === "string") {
      if (source && (unpaired(x) || x.normalize("NFC") !== x))
        reject(phase, "source_record_invalid", path);
      if (source && x.length > 16384)
        reject(phase, "source_resource_limit", path);
      return;
    }
    if (depth > 32)
      reject(
        phase,
        source ? "source_resource_limit" : "dependency_result_invalid",
        path,
      );
    if (Array.isArray(x)) {
      if (
        Object.getPrototypeOf(x) !== Array.prototype ||
        Reflect.ownKeys(x).length !== x.length + 1
      )
        reject(
          phase,
          source ? "source_record_invalid" : "dependency_result_invalid",
          path,
        );
      if (x.length > (source ? 4096 : 256))
        reject(
          phase,
          source ? "source_resource_limit" : "dependency_result_invalid",
          path,
        );
      for (let i = 0; i < x.length; i++) {
        const d = Object.getOwnPropertyDescriptor(x, String(i));
        if (!d || !("value" in d))
          reject(
            phase,
            source ? "source_record_invalid" : "dependency_result_invalid",
            path,
          );
        visit(
          d.value,
          typeof d.value === "object" && d.value !== null ? depth + 1 : depth,
        );
      }
      return;
    }
    if (!plain(x))
      reject(
        phase,
        source ? "source_record_invalid" : "dependency_result_invalid",
        path,
      );
    const keys = Reflect.ownKeys(x);
    if (keys.some((k) => typeof k !== "string"))
      reject(
        phase,
        source ? "source_record_invalid" : "dependency_result_invalid",
        path,
      );
    for (const k of (keys as string[]).sort()) {
      if (++nodes > cap)
        reject(
          phase,
          source ? "source_resource_limit" : "dependency_result_invalid",
          path,
        );
      if (unpaired(k) || k.normalize("NFC") !== k)
        reject(
          phase,
          source ? "source_record_invalid" : "dependency_result_invalid",
          path,
        );
      if (k.length > 16384)
        reject(
          phase,
          source ? "source_resource_limit" : "dependency_result_invalid",
          path,
        );
      const d = Object.getOwnPropertyDescriptor(x, k);
      if (!d || !("value" in d))
        reject(
          phase,
          source ? "source_record_invalid" : "dependency_result_invalid",
          path,
        );
      visit(
        d.value,
        typeof d.value === "object" && d.value !== null ? depth + 1 : depth,
      );
    }
  }
  visit(v, typeof v === "object" && v !== null ? 1 : 0);
}
const R1 = [
  "unsafe_member_name",
  "member_read_failed",
  "zip_too_large",
  "zip_sha256_mismatch",
  "duplicate_zip_entry",
  "too_many_members",
  "pack_members_missing",
  "pack_members_sha256_mismatch",
  "pack_members_count_mismatch",
  "duplicate_pack_member",
  "member_set_mismatch",
  "active_load_not_unique",
  "pack_too_large",
  "member_sha256_mismatch",
  "unknown_member",
  "archival_member_not_loadable",
];
const R2 = ["unknown_member", "archival_member_not_loadable"];
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
];
function parent<T>(
  call: () => T,
  phase: Phase,
  field: string,
  codes: readonly string[],
): T {
  try {
    return call();
  } catch (e) {
    if (e instanceof FixtureIntegrityError) {
      const d = Object.getOwnPropertyDescriptor(e, "code");
      if (
        d &&
        "value" in d &&
        typeof d.value === "string" &&
        codes.includes(d.value)
      )
        reject(phase, "reader_refused", field, d.value);
    }
    if (phase === 1 && e instanceof ZodError)
      reject(1, "reader_schema_refused", "reader");
    throw e;
  }
}
// The exact pinned82 INPUT descriptors are DATA for selected source validation and
// the finite SAFE PRESENTATION forest; never exposed as a public output parser.
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
  if (timestampPaths.includes(p))
    scalarCheck(
      typeof v === "string" && timestamp(v),
      path,
      "profile_value_invalid",
    );
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

type D =
  | { kind: "atom"; atom: string }
  | { kind: "record"; fields: Record<string, D> }
  | { kind: "array"; element: D }
  | { kind: "union"; options: D[] };
function alternatives(s: string): string[] {
  let depth = 0,
    start = 0;
  const a: string[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "[") depth++;
    if (s[i] === "]") depth--;
    if (s[i] === "|" && depth === 0) {
      a.push(s.slice(start, i));
      start = i + 1;
    }
  }
  a.push(s.slice(start));
  return a;
}
function inputD(s: string): D {
  const a = alternatives(s);
  if (a.length > 1) return { kind: "union", options: a.map(inputD) };
  if (s.startsWith("["))
    return { kind: "array", element: inputD(s.slice(1, -1)) };
  if (s.startsWith("R")) {
    const r = shapes[s];
    if (!r) throw new TypeError("closed descriptor");
    return {
      kind: "record",
      fields: Object.fromEntries(
        Object.entries(r).map(([k, v]) => [k, inputD(v)]),
      ),
    };
  }
  return { kind: "atom", atom: s };
}
function sk(v: unknown): D {
  if (v === null) return { kind: "atom", atom: "n" };
  if (typeof v === "string") return { kind: "atom", atom: "s" };
  if (typeof v === "boolean") return { kind: "atom", atom: "b" };
  if (typeof v === "number") return { kind: "atom", atom: "i" };
  if (Array.isArray(v)) {
    const options = v.map(sk);
    const unique = options.filter(
      (d, i) =>
        options.findIndex((x) => JSON.stringify(x) === JSON.stringify(d)) === i,
    );
    return {
      kind: "array",
      element:
        unique.length === 1
          ? (unique[0] ?? { kind: "atom", atom: "n" })
          : { kind: "union", options: unique },
    };
  }
  return {
    kind: "record",
    fields: Object.fromEntries(
      Object.entries(obj(v)).map(([k, x]) => [k, sk(x)]),
    ),
  };
}
function structural(v: unknown, d: D): boolean {
  if (d.kind === "atom")
    return d.atom === "n"
      ? v === null
      : d.atom === "b"
        ? typeof v === "boolean"
        : d.atom === "i"
          ? typeof v === "number"
          : typeof v === "string";
  if (d.kind === "array") {
    if (
      !Array.isArray(v) ||
      Object.getPrototypeOf(v) !== Array.prototype ||
      Reflect.ownKeys(v).length !== v.length + 1 ||
      v.length > 256
    )
      return false;
    for (let i = 0; i < v.length; i++) {
      const child = Object.getOwnPropertyDescriptor(v, String(i));
      if (!child || !("value" in child) || !structural(child.value, d.element))
        return false;
    }
    return true;
  }
  if (d.kind === "union") return d.options.some((x) => structural(v, x));
  return (
    plain(v) &&
    Reflect.ownKeys(v).length === Object.keys(d.fields).length &&
    Object.entries(d.fields).every(([k, x]) => {
      const child = Object.getOwnPropertyDescriptor(v, k);
      return !!child && "value" in child && structural(child.value, x);
    })
  );
}
// Preserve compatible structural prefixes when every whole alternative has a
// later defect. Cursor probes read only admitted own data descriptors; semantic
// values never choose or retry a branch.
function chooseStructure(
  v: unknown,
  options: readonly D[],
  path: string,
  budget: StructuralBudget | undefined,
  depth: number,
): D {
  interface Event {
    path: string;
    accepted: boolean;
  }
  function* events(
    value: unknown,
    d: D,
    field: string,
    level: number,
  ): Generator<Event, void, undefined> {
    if (d.kind === "union") {
      yield* events(
        value,
        chooseStructure(value, d.options, field, budget, level),
        field,
        level,
      );
      return;
    }
    if (d.kind === "atom") {
      structuralValue(budget, value, field, level);
      yield { path: field, accepted: structural(value, d) };
      return;
    }
    if (d.kind === "array") {
      const accepted =
        Array.isArray(value) &&
        Object.getPrototypeOf(value) === Array.prototype &&
        value.length <= 256 &&
        Reflect.ownKeys(value).length === value.length + 1 &&
        Array.from({ length: value.length }, (_, i) =>
          Object.getOwnPropertyDescriptor(value, String(i)),
        ).every((child) => !!child && "value" in child);
      yield { path: field, accepted };
      if (!accepted || !Array.isArray(value)) return;
      structuralValue(budget, value, field, level);
      for (let i = 0; i < value.length; i++) {
        const child = Object.getOwnPropertyDescriptor(value, String(i));
        if (!child || !("value" in child))
          throw new TypeError("structural array descriptor");
        yield* events(
          child.value,
          d.element,
          at(field, i),
          child.value !== null && typeof child.value === "object"
            ? level + 1
            : level,
        );
      }
      return;
    }
    const accepted =
      plain(value) &&
      Reflect.ownKeys(value).length === Object.keys(d.fields).length &&
      Object.keys(d.fields).every((key) => {
        const child = Object.getOwnPropertyDescriptor(value, key);
        return !!child && "value" in child;
      });
    yield { path: field, accepted };
    if (!accepted || !plain(value)) return;
    structuralRecord(budget, value, field, level);
    for (const key of Object.keys(d.fields).sort()) {
      const child = Object.getOwnPropertyDescriptor(value, key),
        descriptor = d.fields[key];
      if (!child || !("value" in child) || !descriptor)
        throw new TypeError("structural record descriptor");
      yield* events(
        child.value,
        descriptor,
        field + "." + key,
        child.value !== null && typeof child.value === "object"
          ? level + 1
          : level,
      );
    }
  }
  let cursors = options.map((descriptor) => ({
    descriptor,
    iterator: events(v, descriptor, path, depth),
  }));
  for (;;) {
    const first = cursors[0];
    if (!first) throw new TypeError("structural alternatives");
    const active: { cursor: typeof first; event: Event }[] = [];
    let completed = 0;
    for (const cursor of cursors) {
      const next = cursor.iterator.next();
      if (next.done) completed++;
      else active.push({ cursor, event: next.value });
    }
    if (completed === cursors.length) return first.descriptor;
    if (
      completed ||
      active.some((step) => step.event.path !== active[0]?.event.path)
    )
      throw new TypeError("structural prefix alignment");
    const survivors = active.filter((step) => step.event.accepted);
    if (!survivors.length) return first.descriptor;
    cursors = survivors.map((step) => step.cursor);
  }
}
function report(p: Phase, c: Code, path: string): never {
  return reject(p, c, p === 1 ? "reader" : path);
}
interface StructuralBudget {
  nodes: number;
  occurrences: Set<string>;
}
function structuralCount(
  budget: StructuralBudget | undefined,
  key: string,
): void {
  if (!budget || budget.occurrences.has(key)) return;
  budget.occurrences.add(key);
  if (++budget.nodes > 32768)
    reject(7, "dependency_result_invalid", "inspection");
}
function structuralValue(
  budget: StructuralBudget | undefined,
  value: unknown,
  path: string,
  depth: number,
): void {
  if (budget && value !== null && typeof value === "object" && depth > 32)
    reject(7, "dependency_result_invalid", "inspection");
  structuralCount(budget, "value:" + path);
}
function structuralRecord(
  budget: StructuralBudget | undefined,
  row: O,
  path: string,
  depth: number,
): void {
  structuralValue(budget, row, path, depth);
  for (const key of Object.keys(row).sort())
    structuralCount(budget, "key:" + path + "." + key);
}
function dense(v: unknown, p: Phase, c: Code, path: string): J[] {
  if (
    !Array.isArray(v) ||
    Object.getPrototypeOf(v) !== Array.prototype ||
    Reflect.ownKeys(v).length !== v.length + 1 ||
    v.length > 256
  )
    report(p, c, path);
  for (let i = 0; i < v.length; i++) {
    const e = Object.getOwnPropertyDescriptor(v, String(i));
    if (!e || !("value" in e)) report(p, c, path);
  }
  return v as J[];
}
const VC_KEYS = Object.keys(FIXED_V.claims[0]);
const CS_KEYS = Object.keys(FIXED_V.claims[0].snapshot);
const ES_KEYS = Object.keys(FIXED_V.evidence[0].snapshot);
const CS_ROOTS: Readonly<Record<string, string>> = {
  lore_phrase: "R3a1073f7e11c",
  count_window: "R5681a0133ba0",
  analysis_text: "R60541b5f0a90",
  scoreline: "R66a7cbc03bde",
  structured_text: "R734ba770849b",
  tenor: "Raba0677f9ff8",
  program_history: "Rb0847f121459",
  exact_decimal: "Rc1826cfae0eb",
};
const ES_ROOTS = [
  "R0eae16aca4ec",
  "R60958cf6e219",
  "R6a46faa77fff",
  "R72719a477070",
  "R8bbd99f04000",
  "R9b2474a6db6f",
];
function descriptorPick(d: D, keys: readonly string[]): D {
  if (d.kind !== "record") throw new TypeError("descriptor pick");
  return {
    kind: "record",
    fields: Object.fromEntries(
      keys.map((k) => {
        const child = d.fields[k];
        if (!child) throw new TypeError("descriptor pick key");
        return [k, child];
      }),
    ),
  };
}
function evidenceDescriptor(): D {
  return {
    kind: "union",
    options: ES_ROOTS.map((r) => descriptorPick(inputD(r), ES_KEYS)),
  };
}
const SUMMARY_INSPECTION: Readonly<Record<string, string>> = {
  derivation: "R55f3f837f469",
  signal: "Rc88243c7ff7e",
  continuity: "Rb6a9be381785",
};
const claimsByType = new Map<string, (typeof FIXED_V.claims)[number]>(
  FIXED_V.claims.map((c) => [c.snapshot.value_type, c]),
);
const summariesByKind = new Map<string, (typeof FIXED_SUMMARIES)[number]>(
  FIXED_SUMMARIES.map((c) => [c.support_kind, c]),
);
function shape(
  v: unknown,
  d: D,
  path: string,
  p: Phase,
  c: Code,
  tagged = true,
  budget?: StructuralBudget,
  depth = 1,
): void {
  const n = path.replace(/\[\d+\]/g, "[]");
  if (tagged && n === "inspection.view.claims[]") {
    const cl = surface(v, VC_KEYS, p, c, path),
      snap = surface(cl.snapshot, CS_KEYS, p, c, path + ".snapshot");
    structuralRecord(budget, cl, path, depth);
    structuralRecord(budget, snap, path + ".snapshot", depth + 1);
    structuralValue(
      budget,
      snap.value_type,
      path + ".snapshot.value_type",
      depth + 1,
    );
    const tag = snap.value_type;
    if (typeof tag !== "string" || !claimsByType.has(tag))
      report(p, c, path + ".snapshot.value_type");
    const selected = sk(claimsByType.get(tag)),
      root = inputD(CS_ROOTS[tag] ?? "");
    if (selected.kind !== "record" || root.kind !== "record")
      throw new TypeError("claim descriptor");
    selected.fields.snapshot = descriptorPick(root, CS_KEYS);
    if (tag !== "analysis_text" && tag !== "structured_text") {
      const value = root.fields.value;
      if (!value) throw new TypeError("claim value descriptor");
      selected.fields.value = value;
    }
    shape(v, selected, path, p, c, false, budget, depth);
    return;
  }
  if (tagged && n === "inspection.view.evidence[]") {
    const e = surface(v, Object.keys(FIXED_V.evidence[0]), p, c, path),
      s = surface(e.snapshot, ES_KEYS, p, c, path + ".snapshot");
    const ex = surface(
        s.consumer_exposure,
        ["planner", "writer", "auditor"],
        p,
        c,
        path + ".snapshot.consumer_exposure",
      ),
      tag = ex.planner;
    structuralRecord(budget, e, path, depth);
    structuralRecord(budget, s, path + ".snapshot", depth + 1);
    structuralRecord(
      budget,
      ex,
      path + ".snapshot.consumer_exposure",
      depth + 2,
    );
    structuralValue(
      budget,
      tag,
      path + ".snapshot.consumer_exposure.planner",
      depth + 2,
    );
    const sample = FIXED_V.evidence.find(
      (x) => x.snapshot.consumer_exposure.planner === tag,
    );
    if (
      typeof tag !== "string" ||
      !["claim_only", "paraphrase", "exact_excerpt"].includes(tag) ||
      !sample
    )
      report(p, c, path + ".snapshot.consumer_exposure.planner");
    const selected = sk(sample);
    if (selected.kind !== "record") throw new TypeError("evidence descriptor");
    selected.fields.snapshot = evidenceDescriptor();
    shape(v, selected, path, p, c, false, budget, depth);
    return;
  }
  if (tagged && n === "inspection.view.support_summaries[]") {
    const row = surface(v, Object.keys(FIXED_SUMMARIES[0]), p, c, path),
      tag = row.support_kind;
    structuralRecord(budget, row, path, depth);
    structuralValue(budget, tag, path + ".support_kind", depth);
    if (typeof tag !== "string" || !summariesByKind.has(tag))
      report(p, c, path + ".support_kind");
    const selected = sk(summariesByKind.get(tag));
    if (selected.kind !== "record") throw new TypeError("summary descriptor");
    selected.fields.claim_id = { kind: "atom", atom: "u" };
    selected.fields.claim_support_id = { kind: "atom", atom: "u" };
    selected.fields.support_hash = { kind: "atom", atom: "h" };
    if (tag !== "evidence")
      selected.fields.inspection = inputD(SUMMARY_INSPECTION[tag] ?? "");
    else
      selected.fields.inspection = {
        kind: "record",
        fields: {
          evidence_unit_id: { kind: "atom", atom: "u" },
          content_hash: { kind: "atom", atom: "h" },
          rights_version_id: { kind: "atom", atom: "u" },
          planner_exposure: { kind: "atom", atom: "s" },
        },
      };
    shape(v, selected, path, p, c, false, budget, depth);
    return;
  }
  if (tagged && n === "configuration.participant_profiles.profiles[]") {
    if (!plain(v)) report(p, c, path);
    const common = [
        "character_bible_version",
        "participant_id",
        "participant_profile_version_id",
        "role",
      ],
      allowed = [...common, "collective_membership_language"];
    for (const key of common.sort())
      if (!Object.hasOwn(v, key)) report(p, c, path + "." + key);
    if (
      Reflect.ownKeys(v).some(
        (k) =>
          typeof k !== "string" ||
          !allowed.includes(k) ||
          !("value" in (Object.getOwnPropertyDescriptor(v, k) ?? {})),
      )
    )
      report(p, c, path);
    structuralRecord(budget, v, path, depth);
    structuralValue(budget, v.participant_id, path + ".participant_id", depth);
    const tag = v.participant_id,
      sample =
        FIXED_M.programming_configuration.participant_profiles.profiles.find(
          (x) => x.participant_id === tag,
        );
    if (typeof tag !== "string" || !sample)
      report(p, c, path + ".participant_id");
    shape(v, sk(sample), path, p, c, false, budget, depth);
    return;
  }
  if (tagged && n === "inspection.view.signals[]") {
    const row = surface(v, ["ref", "signal_id", "type"], p, c, path),
      tag = row.type;
    structuralRecord(budget, row, path, depth);
    structuralValue(budget, tag, path + ".type", depth);
    if (tag !== "tenor_reading" && tag !== "derivation_run")
      report(p, c, path + ".type");
    const chosen = sk(FIXED_V.signals.find((x) => x.type === tag));
    if (chosen.kind !== "record") throw new TypeError("signal descriptor");
    chosen.fields.ref = {
      kind: "atom",
      atom: tag === "tenor_reading" ? "a" : "u",
    };
    shape(v, chosen, path, p, c, false, budget, depth);
    return;
  }
  if (tagged && n === "registry[]") {
    const row = surface(
      v,
      Object.keys(FIXED_M.representation_registry[0]),
      p,
      c,
      path,
    );
    structuralRecord(budget, row, path, depth);
    structuralValue(budget, row.target_kind, path + ".target_kind", depth);
    if (row.target_kind !== "claim" && row.target_kind !== "evidence")
      report(p, c, path + ".target_kind");
    structuralValue(
      budget,
      row.representation_kind,
      path + ".representation_kind",
      depth,
    );
    if (
      row.representation_kind !== "reviewed_fixture_claim_statement" &&
      row.representation_kind !== "reviewed_fixture_paraphrase"
    )
      report(p, c, path + ".representation_kind");
    const sample = FIXED_M.representation_registry.find(
      (x) => x.target_kind === row.target_kind,
    );
    shape(v, sk(sample), path, p, c, false, budget, depth);
    return;
  }
  if (d.kind === "union") {
    shape(
      v,
      chooseStructure(v, d.options, path, budget, depth),
      path,
      p,
      c,
      tagged,
      budget,
      depth,
    );
    return;
  }
  if (d.kind === "record") {
    const row = surface(v, Object.keys(d.fields), p, c, path);
    structuralRecord(budget, row, path, depth);
    for (const k of Object.keys(d.fields).sort()) {
      const child = d.fields[k];
      if (!child) throw new TypeError("descriptor field");
      const value = row[k];
      shape(
        value,
        child,
        path + "." + k,
        p,
        c,
        true,
        budget,
        value !== null && typeof value === "object" ? depth + 1 : depth,
      );
    }
    return;
  }
  if (d.kind === "array") {
    const a = dense(v, p, c, path);
    structuralValue(budget, a, path, depth);
    a.forEach((x, i) => {
      shape(
        x,
        d.element,
        at(path, i),
        p,
        c,
        true,
        budget,
        x !== null && typeof x === "object" ? depth + 1 : depth,
      );
    });
    return;
  }
  if (!structural(v, d)) report(p, c, path);
  structuralValue(budget, v, path, depth);
}
function semantics(
  v: J,
  d: D,
  path: string,
  p: Phase,
  c: Code,
  mapped = path,
  owner?: O,
): void {
  if (d.kind === "union") {
    const a = d.options.find((x) => structural(v, x)) ?? d.options[0];
    if (!a) report(p, c, path);
    semantics(v, a, path, p, c, mapped, owner);
    return;
  }
  if (d.kind === "array") {
    arr(v).forEach((x, i) => {
      semantics(x, d.element, at(path, i), p, c, at(mapped, i));
    });
    return;
  }
  if (d.kind === "record") {
    const o = obj(v);
    for (const k of Object.keys(d.fields).sort()) {
      const x = d.fields[k];
      if (!x) throw new TypeError("descriptor");
      semantics(o[k] ?? null, x, path + "." + k, p, c, mapped + "." + k, o);
    }
    return;
  }
  if (d.atom === "i") {
    if (
      !Number.isSafeInteger(v) ||
      typeof v !== "number" ||
      v < 0 ||
      Object.is(v, -0)
    )
      report(p, c, path);
  }
  if (!["n", "b", "i"].includes(d.atom) && !textOK(v)) report(p, c, path);
  if (d.atom === "u" && !uuid.test(str(v))) report(p, c, path);
  if (d.atom === "h" && !hex.test(str(v))) report(p, c, path);
  if (d.atom === "a" && !artifact.test(str(v))) report(p, c, path);
  if (
    (typeof v === "string" || typeof v === "number") &&
    !mapped.startsWith("configuration")
  )
    scalar(v, mapped, owner, (ok, _, code) => {
      if (!ok)
        report(
          p,
          code === "profile_version_unsupported" && p === 3
            ? "source_version_unsupported"
            : c,
          path,
        );
    });
}
function full(
  v: unknown,
  d: D,
  path: string,
  p: Phase,
  c: Code,
  mapped = path,
): void {
  shape(v, d, path, p, c);
  semantics(v as J, d, path, p, c, mapped);
}
function pick(v: O, keys: readonly string[]): O {
  return Object.fromEntries(
    keys.map((k) => {
      if (!Object.hasOwn(v, k)) throw new TypeError("owned pick");
      return [k, v[k] ?? null];
    }),
  );
}
function equalFields(
  actual: J,
  expected: J,
  p: Phase,
  c: Code,
  path: string,
  skip: ReadonlySet<string> = new Set(),
): void {
  if (skip.has(path)) return;
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length)
      report(p, c, path);
    expected.forEach((x, i) => {
      equalFields(actual[i] ?? null, x, p, c, at(path, i), skip);
    });
    return;
  }
  if (expected !== null && typeof expected === "object") {
    const a = obj(actual);
    for (const k of Object.keys(expected).sort())
      equalFields(
        a[k] ?? null,
        expected[k] ?? null,
        p,
        c,
        path + "." + k,
        skip,
      );
    return;
  }
  if (actual !== expected) report(p, c, path);
}
function lookup(rows: O[], key: string, id: J, path: string): O {
  const found = rows.filter((r) => r[key] === id);
  if (found.length !== 1) reject(3, "source_record_invalid", path);
  return found[0] ?? {};
}
function count(v: J): number {
  let total = 0;
  function add(n: number): void {
    total += n;
  }
  function visit(x: J): void {
    if (x === null) {
      add(4);
      return;
    }
    if (typeof x !== "object") {
      add(Buffer.byteLength(JSON.stringify(x), "utf8"));
      return;
    }
    if (Array.isArray(x)) {
      add(2);
      x.forEach((a, i) => {
        if (i) add(1);
        visit(a);
      });
      return;
    }
    add(2);
    Object.keys(x)
      .sort()
      .forEach((k, i) => {
        if (i) add(1);
        add(Buffer.byteLength(JSON.stringify(k), "utf8") + 1);
        visit(x[k] ?? null);
      });
  }
  visit(v);
  return total;
}

const FIXED_RIGHTS = [
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
] as const;
const necessary = [9, 12, 13, 14, 15, 16, 3, 4, 5, 6, 7, 8].map(
  (i) => "d1250007-0000-4000-8000-" + String(i).padStart(12, "0"),
);
function necessaryAdmission(doc: J): void {
  if (
    !plain(doc) ||
    !plain(doc.tables) ||
    !Array.isArray(doc.tables.evidence_units) ||
    !doc.tables.evidence_units.every(plain)
  )
    return;
  const rows = objects(doc.tables.evidence_units),
    index = new Map<string, O>();
  for (const row of rows) {
    const id = row.evidence_unit_id;
    if (typeof id !== "string" || !uuid4.test(id) || index.has(id))
      reject(3, "source_record_invalid", "source[0]");
    index.set(id, row);
  }
  necessary.forEach((id, j) => {
    const row = index.get(id);
    if (
      !row ||
      !Object.hasOwn(row, "canonical_content") ||
      row.canonical_content === null
    )
      reject(
        3,
        "necessary_source_unavailable",
        at("source.evidence", j) + ".canonical_content",
      );
  });
  necessary.forEach((id, j) => {
    const row = index.get(id);
    if (!row) throw new TypeError("necessary row");
    const path = at("source.evidence", j) + ".supersedes_evidence_unit_id";
    if (!Object.hasOwn(row, "supersedes_evidence_unit_id"))
      reject(3, "source_record_invalid", path);
    if (row.supersedes_evidence_unit_id !== null)
      reject(3, "source_version_unsupported", path);
  });
  necessary.forEach((id, j) => {
    if (!textOK(index.get(id)?.canonical_content))
      reject(
        3,
        "source_record_invalid",
        at("source.evidence", j) + ".canonical_content",
      );
  });
}
interface Captured {
  pack: Pack;
  bytes: Buffer[];
  docs: J[];
  observations: { bytes: number; sha256: string }[];
}
function capture(setPhase: (phase: Phase) => void): Captured {
  const pack = parent(() => openFixturePack(), 1, "reader", R1);
  const owned = surface(
    pack,
    ["pins", "roles", "memberNames", "member", "json"],
    1,
    "source_type_invalid",
    "reader",
  );
  const memberFunction: unknown = Object.getOwnPropertyDescriptor(
      pack,
      "member",
    )?.value,
    jsonFunction: unknown = Object.getOwnPropertyDescriptor(
      pack,
      "json",
    )?.value,
    pinValue = owned.pins,
    nameValue = owned.memberNames,
    roleValue = owned.roles;
  if (
    typeof memberFunction !== "function" ||
    typeof jsonFunction !== "function"
  )
    reject(1, "source_type_invalid", "reader");
  full(pinValue, sk(FIXTURE_V046_PINS), "reader", 1, "source_type_invalid");
  const pins = copy(pinValue as J) as unknown as Pack["pins"];
  if (!same(pins, FIXTURE_V046_PINS))
    reject(1, "source_anchor_refused", "reader");
  if (!(roleValue instanceof Map)) reject(1, "source_type_invalid", "reader");
  const sizeDescriptor = Object.getOwnPropertyDescriptor(Map.prototype, "size");
  if (!sizeDescriptor?.get) throw new TypeError("selected Map size");
  const roleCount: unknown = sizeDescriptor.get.call(roleValue);
  if (typeof roleCount !== "number" || roleCount > 133)
    reject(1, "source_type_invalid", "reader");
  const admittedNames = dense(nameValue, 1, "source_type_invalid", "reader");
  if (admittedNames.length !== 133 || admittedNames.some((n) => !textOK(n)))
    reject(1, "source_type_invalid", "reader");
  const names = admittedNames.map(str);
  const roles = new Map<string, string>();
  for (const [name, role] of Map.prototype.entries.call(
    roleValue,
  ) as unknown as Iterable<[unknown, unknown]>) {
    if (!textOK(name) || !textOK(role) || roles.has(name))
      reject(1, "source_type_invalid", "reader");
    roles.set(name, role);
  }
  if (!same([...roles.keys()].sort(), names) || roles.size !== 133)
    reject(1, "source_anchor_refused", "reader");
  for (const row of FIXED_M.fixture_binding.selected_members) {
    const role = roles.get(row.member);
    if (role?.startsWith("archive"))
      reject(1, "archival_source_refused", "reader");
    if (role !== row.role) reject(1, "source_role_refused", "reader");
  }
  setPhase(2);
  const bytes: Buffer[] = [];
  let total = 0;
  for (const [i, row] of FIXED_M.fixture_binding.selected_members.entries()) {
    const b = parent(
      () => Reflect.apply(memberFunction, pack, [row.member]) as unknown,
      2,
      at("source", i),
      R2,
    );
    if (!Buffer.isBuffer(b)) reject(2, "source_type_invalid", at("source", i));
    const viewPrototype: object = Object.getPrototypeOf(
      Uint8Array.prototype,
    ) as object;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(
      viewPrototype,
      "length",
    );
    if (!lengthDescriptor?.get)
      throw new TypeError("selected TypedArray length");
    const length: unknown = lengthDescriptor.get.call(b);
    if (
      typeof length !== "number" ||
      !Number.isSafeInteger(length) ||
      length < 0
    )
      reject(2, "source_type_invalid", at("source", i));
    if (length > SOURCE_CAP)
      reject(2, "source_resource_limit", at("source", i));
    total += length;
    if (total > CAP) reject(2, "source_resource_limit", at("source", i));
    const ownedBytes = Buffer.alloc(length);
    Uint8Array.prototype.set.call(ownedBytes, b);
    bytes.push(ownedBytes);
  }
  const observations = bytes.map(identity),
    docs: J[] = [];
  for (const [i, b] of bytes.entries()) {
    const text = b.toString("utf8");
    if (!Buffer.from(text, "utf8").equals(b))
      reject(2, "source_utf8_invalid", at("source", i));
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      if (e instanceof SyntaxError)
        reject(2, "source_json_invalid", at("source", i));
      throw e;
    }
    graph(parsed, 2, at("source", i), true);
    docs.push(parsed as J);
  }
  return {
    pack: {
      pins: freeze(pins),
      roles,
      memberNames: names,
      member: (name: string) => {
        const i = FIXED_M.fixture_binding.selected_members.findIndex(
          (r) => r.member === name,
        );
        if (i < 0) throw new TypeError("captured member");
        return Buffer.from(bytes[i] ?? Buffer.alloc(0));
      },
      json: (name: string) => {
        if (name !== FIXTURE_V046_PINS.activeLoadMember)
          throw new TypeError("captured json");
        return docs[0];
      },
    },
    bytes,
    docs,
    observations,
  };
}
interface Source {
  package: O;
  material: O;
  tables: Record<string, readonly Record<string, unknown>[]>;
  evidence: O[];
  bodies: O[];
  rights: O[];
  config: O;
  policyHashes: O;
}
function assembly(c: Captured): Source {
  const foundation = c.docs[0];
  if (foundation === undefined) throw new TypeError("capture");
  necessaryAdmission(foundation);
  const rows = parent(() => parseFoundationRows(c.pack), 3, "source[0]", R3),
    tables = rows.tables;
  const family = (name: string): O[] => objects(tables[name]);
  const pkg = surface(
    c.docs[1],
    [
      "artifact_id",
      "created_at",
      "frozen_at",
      "id",
      "manifest",
      "package_hash",
      "schema_version",
      "scope_hash",
      "selector_run_id",
    ],
    3,
    "source_record_invalid",
    "source[1]",
  );
  for (const key of ["artifact_id", "id"])
    if (typeof pkg[key] !== "string" || !uuid.test(pkg[key]))
      reject(3, "source_record_invalid", "source[1]." + key);
  if (!textOK(pkg.selector_run_id))
    reject(3, "source_record_invalid", "source[1].selector_run_id");
  for (const key of ["package_hash", "scope_hash"])
    if (typeof pkg[key] !== "string" || !hex.test(pkg[key]))
      reject(3, "source_record_invalid", "source[1]." + key);
  for (const key of ["created_at", "frozen_at"])
    if (typeof pkg[key] !== "string" || !timestamp(pkg[key]))
      reject(3, "source_record_invalid", "source[1]." + key);
  const payload = lookup(
    family("artifacts"),
    "artifact_id",
    pkg.artifact_id ?? null,
    "source[0]",
  );
  if (payload.supersedes_artifact_id !== null)
    reject(3, "source_version_unsupported", "source[0]");
  if (
    !same(payload.canonical_payload, pkg) ||
    payload.content_hash !== pkg.package_hash
  )
    reject(3, "source_record_invalid", "source[1]");
  const typed = lookup(
    family("evidence_packages"),
    "evidence_package_id",
    pkg.id ?? null,
    "source[0]",
  );
  if (
    typed.artifact_id !== pkg.artifact_id ||
    typed.package_hash !== pkg.package_hash
  )
    reject(3, "source_record_invalid", "source[1]");
  if (plain(pkg.manifest) && Array.isArray(pkg.manifest.claims))
    pkg.manifest.claims.forEach((cl, i) => {
      if (
        plain(cl) &&
        Object.hasOwn(cl, "state_event_cursor") &&
        cl.state_event_cursor !== null
      )
        reject(
          3,
          "source_version_unsupported",
          at("source[1].manifest.claims", i) + ".state_event_cursor",
        );
    });
  full(
    pkg.manifest,
    inputD(roots.package_profile),
    "source[1].manifest",
    3,
    "source_record_invalid",
    "package.manifest",
  );
  if (evidencePackageHash(pkg) !== pkg.package_hash)
    reject(3, "source_record_invalid", "source[1].package_hash");
  const f = obj(pkg.manifest),
    claims = objects(f.claims),
    evidence = objects(f.evidence),
    allBodies = family("evidence_units");
  const bases = claims.map((cl, i) => {
    const row = lookup(
      family("claims"),
      "claim_id",
      cl.claim_id ?? null,
      at("source[1].manifest.claims", i),
    );
    if (row.supersedes_claim_id !== null || cl.state_event_cursor !== null)
      reject(
        3,
        "source_version_unsupported",
        at("source[1].manifest.claims", i),
      );
    const base = { ...row };
    full(
      base,
      inputD(alternatives(roots.claim_bases.slice(1, -1)).join("|")),
      at("source[0].claim_bases", i),
      3,
      "source_record_invalid",
      at("material.claim_bases", i),
    );
    if (
      cl.claim_content_hash !== claimContentHash(row) ||
      row.content_hash !== cl.claim_content_hash ||
      !same(row.value, cl.value) ||
      obj(row.subject).entity_ref !== cl.subject_ref
    )
      reject(3, "source_record_invalid", at("source[1].manifest.claims", i));
    if (
      cl.frozen_state_hash !==
      claimFrozenStateHash({
        claim_content_hash: cl.claim_content_hash,
        state: cl.frozen_state,
        effective_usage_class: cl.effective_usage_class,
      })
    )
      reject(3, "source_record_invalid", at("source[1].manifest.claims", i));
    for (const [j, s] of objects(cl.support_refs).entries()) {
      const row = lookup(
        family("claim_supports"),
        "claim_support_id",
        s.claim_support_id ?? null,
        "source[0]",
      );
      if (row.claim_id !== cl.claim_id || !same(pick(row, Object.keys(s)), s))
        reject(
          3,
          "source_record_invalid",
          at(at("source[1].manifest.claims", i) + ".support_refs", j),
        );
    }
    return base;
  });
  const rightsIDs = [...new Set(evidence.map((e) => str(e.rights_version_id)))],
    rights = rightsIDs.map((id) =>
      lookup(family("rights_versions"), "rights_version_id", id, "source[0]"),
    );
  if (rights.length !== 7) reject(3, "source_record_invalid", "source[0]");
  const bodyMap = allBodies.filter((r) =>
    necessary.includes(str(r.evidence_unit_id)),
  );
  for (const [j, id] of necessary.entries()) {
    const body = lookup(bodyMap, "evidence_unit_id", id, "source[0]"),
      ep = lookup(evidence, "evidence_unit_id", id, "source[1]");
    if (
      body.content_hash !== evidenceBodyHash(str(body.canonical_content)) ||
      body.content_hash !== ep.content_hash ||
      body.rights_version_id !== ep.rights_version_id
    )
      reject(
        3,
        "source_record_invalid",
        at("source.evidence", j) + ".canonical_content",
      );
  }
  const bodies = necessary
    .slice(0, 6)
    .map((id) => lookup(allBodies, "evidence_unit_id", id, "source[0]"));
  const support = c.docs[2];
  if (
    !plain(support) ||
    Reflect.ownKeys(support).length !== 2 ||
    !["artifacts", "derivation_run_ref"].every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(support, key);
      return !!descriptor && "value" in descriptor;
    })
  )
    reject(3, "source_record_invalid", "source[2]");
  // The returned member has no content_hash. Admit its actual two-field
  // carriers with the unchanged transitive82 shapes before lookup or hashing.
  const carrierArray = inputD(roots.support_carriers);
  if (carrierArray.kind !== "array" || carrierArray.element.kind !== "union")
    throw new TypeError("closed support descriptor");
  const rawCarrierArray: D = {
    kind: "array",
    element: {
      kind: "union",
      options: carrierArray.element.options.map((d) =>
        descriptorPick(d, ["artifact_id", "canonical_payload"]),
      ),
    },
  };
  const rawCarriers = support.artifacts ?? null;
  shape(rawCarriers, rawCarrierArray, "source[2]", 3, "source_record_invalid");
  if (typeof support.derivation_run_ref !== "string")
    reject(3, "source_record_invalid", "source[2]");
  semantics(
    rawCarriers,
    rawCarrierArray,
    "source[2]",
    3,
    "source_record_invalid",
    "material.support_carriers",
  );
  if (!uuid.test(support.derivation_run_ref))
    reject(3, "source_record_invalid", "source[2]");
  const derivation = lookup(
    family("derivation_runs"),
    "derivation_run_id",
    support.derivation_run_ref,
    "source[0]",
  );
  full(
    derivation,
    inputD("R55f3f837f469"),
    "source[2]",
    3,
    "source_record_invalid",
    "material.derivations[0]",
  );
  if (derivation.output_hash !== derivationOutputHash(derivation.output))
    reject(3, "source_record_invalid", "source[2]");
  const carriers = objects(rawCarriers).map((x, i) => {
    const row = lookup(
      family("artifacts"),
      "artifact_id",
      x.artifact_id ?? null,
      at("source[2]", i) + ".artifact_id",
    );
    if (
      !same(x.canonical_payload, row.canonical_payload) ||
      row.content_hash !== fixtureSupportObjectHash(x.canonical_payload)
    )
      reject(3, "source_record_invalid", at("source[2]", i));
    return pick(row, ["artifact_id", "canonical_payload", "content_hash"]);
  });
  full(
    carriers,
    inputD(roots.support_carriers),
    "source[2]",
    3,
    "source_record_invalid",
    "material.support_carriers",
  );
  const material = {
    claim_bases: bases,
    rights_versions: rights,
    derivations: [derivation],
    support_carriers: carriers,
    evidence_bodies: bodies,
  };
  // This is the selected hash projection, not a claim that the whole policy
  // member is82. Unused historical metadata retains its raw identity at8.
  const policyRecord = (value: unknown): O => {
    if (!plain(value)) reject(3, "source_record_invalid", "source[3]");
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== "string" || !descriptor || !("value" in descriptor))
        reject(3, "source_record_invalid", "source[3]");
    }
    return value;
  };
  const policyWrapper = policyRecord(c.docs[3]),
    selectedPolicies = Object.getOwnPropertyDescriptor(
      policyWrapper,
      "policies",
    );
  if (!selectedPolicies || !("value" in selectedPolicies))
    reject(3, "source_record_invalid", "source[3]");
  const p = policyRecord(selectedPolicies.value),
    policyKeys = Object.keys(FIXED_M.policy_source_hashes).sort();
  if (
    Reflect.ownKeys(p).length !== policyKeys.length ||
    policyKeys.some((k) => !Object.hasOwn(p, k))
  )
    reject(3, "source_record_invalid", "source[3]");
  // Complete selected structure before testing any digest's lexical value.
  const policyEntries = policyKeys.map((k) => {
    const entry = policyRecord(Object.getOwnPropertyDescriptor(p, k)?.value),
      digest = Object.getOwnPropertyDescriptor(entry, "source_sha256");
    if (!digest || !("value" in digest))
      reject(3, "source_record_invalid", "source[3]");
    const text: unknown = digest.value;
    if (typeof text !== "string")
      reject(3, "source_record_invalid", "source[3]");
    return { key: k, digest: text };
  });
  const policyHashes = Object.fromEntries(
    policyEntries.map(({ key, digest }) => {
      if (!hex.test(digest)) reject(3, "source_record_invalid", "source[3]");
      return [key, digest];
    }),
  );
  return {
    package: pkg,
    material,
    tables,
    evidence,
    bodies: allBodies,
    rights,
    config: {
      show_config_version: c.docs[4] ?? null,
      episode_mode_registry: c.docs[5] ?? null,
      rundown_template: c.docs[6] ?? null,
      participant_profiles: c.docs[7] ?? null,
      block_type_registry: c.docs[8] ?? null,
      selection: FIXED_M.programming_configuration.selection,
    },
    policyHashes,
  };
}
function grants(s: Source): void {
  s.rights.forEach((row, j) => {
    const path = at("rights", j),
      d = inputD("R4f8644d7587d");
    shape(row, d, path, 4, "rights_grant_refused");
    semantics(
      row,
      d,
      path,
      4,
      "rights_grant_refused",
      at("material.rights_versions", j),
    );
    const policy = obj(row.policy),
      sources = s.evidence.filter(
        (e) => e.rights_version_id === row.rights_version_id,
      );
    const covered = arr(policy.covered_source_identities);
    if (sources.some((e) => !covered.includes(e.source_identity ?? null)))
      reject(
        4,
        "rights_grant_refused",
        path + ".policy.covered_source_identities",
      );
    if (policy.acquisition_permission !== true)
      reject(
        4,
        "rights_grant_refused",
        path + ".policy.acquisition_permission",
      );
    const ceil = obj(policy.consumer_exposure_ceiling);
    for (const consumer of ["planner", "writer", "auditor"])
      if (
        sources.some(
          (e) =>
            !arr(ceil[consumer]).includes(
              obj(e.consumer_exposure)[consumer] ?? null,
            ),
        )
      )
        reject(
          4,
          "rights_grant_refused",
          path + ".policy.consumer_exposure_ceiling." + consumer,
        );
    if (
      sources.some((e) => e.quote_permission === true) &&
      policy.quotation_permission !== true
    )
      reject(4, "rights_grant_refused", path + ".policy.quotation_permission");
    if (
      sources.some((e) => e.paraphrase_permission === true) &&
      policy.paraphrase_permission !== true
    )
      reject(4, "rights_grant_refused", path + ".policy.paraphrase_permission");
    const retention = obj(policy.retention);
    if (retention.canonical_source_bytes !== "durable_offline_test_retention")
      reject(
        4,
        "rights_grant_refused",
        path + ".policy.retention.canonical_source_bytes",
      );
    if (retention.policy_version !== "synthetic-fixture-retention-v1")
      reject(
        4,
        "rights_grant_refused",
        path + ".policy.retention.policy_version",
      );
    if (
      retention.purge_behavior !==
      "retain permitted tombstone metadata; no replacement bytes"
    )
      reject(
        4,
        "rights_grant_refused",
        path + ".policy.retention.purge_behavior",
      );
    if (
      policy.synthetic_grant !== true ||
      policy.grantor !== "The Desk synthetic fixture author"
    )
      reject(4, "rights_grant_refused", path + ".policy.grantor");
    const grant = FIXED_RIGHTS.find(
      (r) => r.rights_version_id === row.rights_version_id,
    );
    if (!grant) reject(4, "rights_grant_refused", path + ".rights_version_id");
    if (row.source_identity !== grant.source_identity)
      reject(4, "rights_grant_refused", path + ".source_identity");
    if (policy.grant_identity !== grant.policy.grant_identity)
      reject(4, "rights_grant_refused", path + ".policy.grant_identity");
    equalFields(
      policy.attribution ?? null,
      grant.policy.attribution as unknown as J,
      4,
      "rights_grant_refused",
      path + ".policy.attribution",
    );
    const providers = obj(policy.provider_exposure);
    for (const key of ["fixture_stub", "fixture_tts"] as const)
      if (providers[key] !== grant.policy.provider_exposure[key])
        reject(
          4,
          "rights_grant_refused",
          path + ".policy.provider_exposure." + key,
        );
    if (providers.external_providers !== false)
      reject(
        4,
        "external_provider_forbidden",
        path + ".policy.provider_exposure.external_providers",
      );
  });
}
function configuration(s: Source): void {
  const config = s.config,
    d = sk(FIXED_M.programming_configuration);
  shape(config, d, "configuration", 5, "configuration_shape_invalid");
  const show = obj(config.show_config_version),
    payload = obj(show.canonical_payload),
    base = FIXED_M.programming_configuration;
  const versionPaths = [
    "block_type_registry.registry_version",
    "episode_mode_registry.registry_version",
    "participant_profiles.profile_set_version",
    "rundown_template.rundown_template_version_id",
    "show_config_version.schema_version",
    "show_config_version.canonical_payload.show_version",
    "show_config_version.canonical_payload.autonomous_operation_policy_version",
    "show_config_version.canonical_payload.operator_repair_policy_version",
    "show_config_version.canonical_payload.writing_craft_policy_version",
    "show_config_version.canonical_payload.default_output_language",
  ];
  arr(obj(config.participant_profiles).profiles).forEach((_, i) =>
    versionPaths.push(
      at("participant_profiles.profiles", i) + ".character_bible_version",
    ),
  );
  const selected = (record: J, path: string): J => {
    let value = record;
    for (const token of path.match(/[A-Za-z_]+|\d+/g) ?? [])
      value = Array.isArray(value)
        ? (value[Number(token)] ?? null)
        : (obj(value)[token] ?? null);
    return value;
  };
  const orderedPaths = versionPaths.sort((a, b) => {
    const left = a.match(/[A-Za-z_]+|\d+/g) ?? [],
      right = b.match(/[A-Za-z_]+|\d+/g) ?? [];
    for (let i = 0; i < Math.min(left.length, right.length); i++) {
      const x = left[i] ?? "",
        y = right[i] ?? "";
      if (x === y) continue;
      if (/^\d+$/.test(x) && /^\d+$/.test(y)) return Number(x) - Number(y);
      return x < y ? -1 : 1;
    }
    return left.length - right.length;
  });
  for (const path of orderedPaths)
    if (
      selected(config, path) !==
      (path.endsWith(".character_bible_version")
        ? "0.1.4"
        : selected(base as unknown as J, path))
    )
      reject(5, "configuration_version_unsupported", "configuration." + path);
  for (const key of ["show_config_version_id", "show_id", "parent_version_id"])
    if (!uuid.test(str(show[key])))
      reject(
        5,
        "configuration_binding_refused",
        "configuration.show_config_version." + key,
      );
  if (!hex.test(str(show.config_hash)))
    reject(
      5,
      "configuration_binding_refused",
      "configuration.show_config_version.config_hash",
    );
  if (!timestamp(str(show.created_at)))
    reject(
      5,
      "configuration_binding_refused",
      "configuration.show_config_version.created_at",
    );
  if (show.pre_publish_review_required !== payload.pre_publish_review_required)
    reject(
      5,
      "configuration_binding_refused",
      "configuration.show_config_version.pre_publish_review_required",
    );
  const rows = objects(s.tables.show_config_versions),
    row = lookup(
      rows,
      "show_config_version_id",
      show.show_config_version_id ?? null,
      "source[0]",
    );
  if (!same(row, show))
    reject(
      5,
      "configuration_binding_refused",
      "configuration.show_config_version",
    );
  if (
    show.show_id !== payload.show_id ||
    payload.show_id !== obj(obj(s.package.manifest).scope).show_id
  )
    reject(
      5,
      "configuration_binding_refused",
      "configuration.show_config_version.show_id",
    );
  if (payload.publication_enabled !== false)
    reject(
      5,
      "current_use_unsupported",
      "configuration.show_config_version.canonical_payload.publication_enabled",
    );
  const skip = new Set([
    "configuration.show_config_version.canonical_payload.name",
    "configuration.show_config_version.config_hash",
    "configuration.rundown_template.source_migration",
  ]);
  for (const [key, rows, leaf] of [
    [
      "episode_mode_registry.values",
      obj(config.episode_mode_registry).values,
      "description",
    ],
    [
      "block_type_registry.values",
      obj(config.block_type_registry).values,
      "job",
    ],
    ["rundown_template.slots", obj(config.rundown_template).slots, "job"],
  ] as const)
    arr(rows).forEach((_, i) =>
      skip.add(at("configuration." + key, i) + "." + leaf),
    );
  equalFields(
    config,
    base as unknown as J,
    5,
    "configuration_binding_refused",
    "configuration",
    skip,
  );
  semantics(config, d, "configuration", 5, "configuration_binding_refused");
  try {
    if (showConfigVersionHash(show) !== show.config_hash)
      reject(
        5,
        "configuration_binding_refused",
        "configuration.show_config_version.config_hash",
      );
  } catch (e) {
    if (e instanceof Refusal) throw e;
    if (e instanceof ProfileRejected) {
      const codes = [
        "show_config_schema_unsupported",
        "show_config_keys_not_closed",
        "show_config_runtime_keys_not_closed",
        "show_config_column_payload_conflict",
        "show_config_show_id_conflict",
      ];
      if (codes.includes(e.code))
        reject(
          5,
          "configuration_binding_refused",
          "configuration.show_config_version",
        );
    }
    throw e;
  }
}

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
const PARSER_CODES = [
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
];
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
    tokens = suffix.match(/\.[a-z_]+|\[(?:0|[1-9]\d*)\]/g) ?? [];
  if (tokens.join("") !== suffix) return [];
  let nodes = [inputD(PG_SEEDS[seed] ?? "n")];
  function expand(d: D): D[] {
    return d.kind === "union" ? d.options.flatMap(expand) : [d];
  }
  for (const token of tokens) {
    const next: D[] = [];
    for (const d of nodes.flatMap(expand)) {
      if (token.startsWith(".") && d.kind === "record") {
        const child = d.fields[token.slice(1)];
        if (child) next.push(child);
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
function safeDependency(value: unknown): PlannerFixtureConsumerRejection {
  if (!plain(value)) throw new TypeError("dependency rejection");
  let o: O;
  try {
    o = surface(
      value,
      ["kind", "profile", "code", "field", "parser_code"],
      6,
      "dependency_result_invalid",
      "inspection",
    );
  } catch {
    throw new TypeError("dependency rejection surface");
  }
  if (
    o.kind !== "rejected" ||
    o.profile !== "planner-fixture-consumer-snapshot/1" ||
    typeof o.code !== "string" ||
    typeof o.field !== "string"
  )
    throw new TypeError("dependency rejection");
  const code = o.code,
    field = o.field;
  let allowed = false;
  if (
    [
      "input_type_invalid",
      "input_text_empty",
      "input_resource_limit",
      "input_unicode_invalid",
      "input_json_invalid",
      "input_semantic_json_invalid",
      "input_text_noncanonical",
    ].includes(code)
  )
    allowed = field === "input" && o.parser_code === null;
  else if (code === "input_envelope_invalid")
    allowed =
      [
        "input",
        "input.schema",
        "input.package_payload",
        "input.material",
      ].includes(field) && o.parser_code === null;
  else if (code === "parser_rejected")
    allowed =
      field === "package" &&
      typeof o.parser_code === "string" &&
      PARSER_CODES.includes(o.parser_code);
  else if (o.parser_code === null) {
    const nodes = pgNodes(field);
    if (code === "profile_shape_invalid")
      allowed = nodes.some((n) => n.kind === "record");
    else if (
      code === "profile_value_invalid" ||
      code === "profile_binding_mismatch"
    )
      allowed = nodes.length > 0;
    else
      allowed =
        (SAFE_PROFILE_PATHS[code] ?? []).some((pattern) => {
          const re =
            "^" +
            pattern
              .replace(/[.*+?^${}()|\\]/g, "\\$&")
              .replace(/\[i\]|\[j\]/g, "\\[(?:0|[1-9][0-9]{0,2})\\]") +
            "$";
          return (
            new RegExp(re).test(field) &&
            (!/\[(\d+)\]/g.test(field) ||
              [...field.matchAll(/\[(\d+)\]/g)].every(
                (m) => Number(m[1]) <= 255,
              ))
          );
        }) &&
        (nodes.length > 0 ||
          (field === "internal" && code === "profile_support_unresolved") ||
          (field === "view.canonical_json" &&
            code === "profile_resource_limit"));
  }
  if (!allowed) throw new TypeError("unsafe dependency rejection");
  return freeze(copy(o) as unknown as PlannerFixtureConsumerRejection);
}
const PUBLIC_FAMILY_ROOTS: Readonly<Record<string, string>> = {
  scope: "R206018f919aa",
  version_refs: "Rc4725114b6be",
  availability: "R6429e700b661",
  beats: "[Rc6af9486bddb]",
  signals: "[R9456ebf86aca|R94f48bcd9c6a]",
  context_candidates: "[R053276b9de0c]",
  continuity: "[R4c322a66fb56]",
  silent_inputs: "[R3f4585139a10]",
  sensitivities: "[Rd5da2454ca3a]",
  coverage_conditions: "[Rf089e3c10e94]",
  source_attribution: "[R37cfb3bbb0e1]",
  selection_provenance: "Rd10605cda18a",
};
function outputD(): D {
  const d = sk(FIXED_V);
  if (d.kind !== "record") throw new TypeError("view descriptor");
  for (const [key, root] of Object.entries(PUBLIC_FAMILY_ROOTS))
    d.fields[key] = inputD(root);
  return {
    kind: "record",
    fields: {
      kind: { kind: "atom", atom: "s" },
      profile: { kind: "atom", atom: "s" },
      observation: {
        kind: "record",
        fields: {
          input_utf8_bytes: { kind: "atom", atom: "s" },
          input_sha256: { kind: "atom", atom: "h" },
          package_text_utf8_bytes: { kind: "atom", atom: "s" },
          package_text_sha256: { kind: "atom", atom: "h" },
        },
      },
      view: d,
      canonical_json: { kind: "atom", atom: "s" },
      view_sha256: { kind: "atom", atom: "h" },
    },
  };
}
function publicAtoms(
  v: J,
  path: string,
  owner?: O,
  mapped = path
    .replace(/^inspection\.view/, "package.manifest")
    .replace(".snapshot.", "."),
): void {
  const norm = path.replace(/\[\d+\]/g, "[]"),
    last = norm.slice(norm.lastIndexOf(".") + 1);
  if (
    path.startsWith("inspection.view.") &&
    !path.slice("inspection.view.".length).includes(".")
  ) {
    const key = path.slice("inspection.view.".length),
      root = PUBLIC_FAMILY_ROOTS[key];
    if (root && key !== "signals") {
      semantics(v, inputD(root), path, 7, "dependency_result_invalid", mapped);
      return;
    }
  }
  if (norm === "inspection.view.signals[]") {
    const signal = obj(v);
    semantics(
      v,
      inputD(
        signal.type === "tenor_reading" ? "R9456ebf86aca" : "R94f48bcd9c6a",
      ),
      path,
      7,
      "dependency_result_invalid",
      mapped,
    );
    return;
  }
  if (norm === "inspection.view.claims[].snapshot") {
    const snapshot = obj(v);
    semantics(
      v,
      descriptorPick(inputD(CS_ROOTS[str(snapshot.value_type)] ?? ""), CS_KEYS),
      path,
      7,
      "dependency_result_invalid",
      mapped,
    );
    return;
  }
  if (norm === "inspection.view.claims[].value" && v !== null) {
    const root = inputD(CS_ROOTS[str(obj(owner?.snapshot).value_type)] ?? "");
    if (root.kind !== "record" || !root.fields.value)
      throw new TypeError("value semantic descriptor");
    semantics(
      v,
      root.fields.value,
      path,
      7,
      "dependency_result_invalid",
      mapped,
    );
    return;
  }
  if (norm === "inspection.view.evidence[].snapshot") {
    semantics(
      v,
      evidenceDescriptor(),
      path,
      7,
      "dependency_result_invalid",
      mapped,
    );
    return;
  }
  if (norm === "inspection.view.support_summaries[].inspection") {
    const kind = str(owner?.support_kind),
      d =
        kind === "evidence"
          ? ({
              kind: "record",
              fields: {
                evidence_unit_id: { kind: "atom", atom: "u" },
                content_hash: { kind: "atom", atom: "h" },
                rights_version_id: { kind: "atom", atom: "u" },
                planner_exposure: { kind: "atom", atom: "s" },
              },
            } as D)
          : inputD(SUMMARY_INSPECTION[kind] ?? "");
    semantics(v, d, path, 7, "dependency_result_invalid", mapped);
    return;
  }
  if (Array.isArray(v)) {
    v.forEach((x, i) => {
      publicAtoms(x, at(path, i), undefined, at(mapped, i));
    });
    return;
  }
  if (v !== null && typeof v === "object") {
    for (const k of Object.keys(v).sort()) {
      let childMapped = mapped + "." + k;
      if (k === "snapshot") childMapped = mapped;
      if (norm === "inspection.view.support_summaries[]" && k === "inspection")
        childMapped =
          v.support_kind === "derivation"
            ? "material.derivations[0]"
            : v.support_kind === "signal" || v.support_kind === "continuity"
              ? "material.support_carriers[0]"
              : "package.manifest.evidence[0]";
      publicAtoms(v[k] ?? null, path + "." + k, v, childMapped);
    }
    return;
  }
  if (v === null || typeof v === "boolean") return;
  if (path === "inspection.canonical_json") {
    if (typeof v !== "string" || unpaired(v) || Buffer.byteLength(v) > CAP)
      reject(7, "dependency_result_invalid", path);
    return;
  }
  if (typeof v === "number") {
    if (!Number.isSafeInteger(v) || v < 0 || Object.is(v, -0))
      reject(7, "dependency_result_invalid", path);
    scalar(v, mapped, owner, (ok) => {
      if (!ok) reject(7, "dependency_result_invalid", path);
    });
    return;
  }
  if (!textOK(v)) reject(7, "dependency_result_invalid", path);
  const claim = norm.startsWith("inspection.view.claims[].snapshot.");
  const ev = norm.startsWith("inspection.view.evidence[].snapshot.");
  const H =
    norm === "inspection.view_sha256" ||
    norm === "inspection.observation.input_sha256" ||
    norm === "inspection.observation.package_text_sha256" ||
    (claim &&
      ["claim_content_hash", "frozen_state_hash", "support_hash"].includes(
        last,
      )) ||
    (ev && last === "content_hash");
  const U =
    (claim &&
      [
        "claim_id",
        "claim_support_id",
        "evidence_unit_id",
        "derivation_run_id",
      ].includes(last)) ||
    (ev &&
      [
        "evidence_unit_id",
        "rights_version_id",
        "rights_policy_version",
      ].includes(last)) ||
    [
      "inspection.view.package_id",
      "inspection.view.scope.show_id",
      "inspection.view.context_candidates[].claim_id",
      "inspection.view.beats[].member_claim_refs[]",
      "inspection.view.silent_inputs[].claim_id",
      "inspection.view.silent_inputs[].support_refs[]",
      "inspection.view.evidence[].claim_representation_refs[]",
    ].includes(norm);
  if ((H && !hex.test(v)) || (U && !uuid.test(v)))
    reject(7, "dependency_result_invalid", path);
  if (
    norm.startsWith("inspection.observation.") &&
    last.endsWith("_bytes") &&
    (!/^(?:0|[1-9]\d*)$/.test(v) ||
      v.length > 7 ||
      (v.length === 7 && v > "2097152"))
  )
    reject(7, "dependency_result_invalid", path);
  scalar(v, mapped, owner, (ok) => {
    if (!ok) reject(7, "dependency_result_invalid", path);
  });
}
function viewValidation(
  result: unknown,
  s: Source,
  inputText: string,
  packageText: string,
): O {
  shape(result, outputD(), "inspection", 7, "dependency_result_invalid", true, {
    nodes: 0,
    occurrences: new Set(),
  });
  graph(result, 7, "inspection", false);
  const owned = copy(result as J) as O,
    view = obj(owned.view);
  publicAtoms(owned, "inspection");
  if (
    owned.kind !== "materialized_candidate" ||
    owned.profile !== "planner-fixture-consumer-snapshot/1"
  )
    reject(7, "dependency_result_invalid", "inspection.profile");
  const observed = obj(owned.observation),
    expected = {
      input_utf8_bytes: String(Buffer.byteLength(inputText)),
      input_sha256: raw(inputText),
      package_text_utf8_bytes: String(Buffer.byteLength(packageText)),
      package_text_sha256: raw(packageText),
    };
  equalFields(
    observed,
    expected,
    7,
    "dependency_result_invalid",
    "inspection.observation",
  );
  if (str(owned.canonical_json) !== canonicalJson(view))
    reject(7, "dependency_result_invalid", "inspection.canonical_json");
  if (
    owned.view_sha256 !==
    domainHash("planner-fixture-consumer-snapshot-v1", view)
  )
    reject(7, "dependency_result_invalid", "inspection.view_sha256");
  const claims = objects(view.claims),
    evidence = objects(view.evidence),
    pkg = obj(s.package.manifest),
    original = objects(pkg.claims);
  for (const [name, rows, key] of [
    ["claims", claims, "claim_id"],
    ["evidence", evidence, "evidence_unit_id"],
  ] as const) {
    const seen = new Set<J>();
    rows.forEach((r, i) => {
      const id = obj(r.snapshot)[key] ?? null;
      if (seen.has(id))
        reject(
          7,
          "dependency_result_invalid",
          at("inspection.view." + name, i) + ".snapshot." + key,
        );
      seen.add(id);
    });
  }
  for (const cl of original)
    if (
      claims.filter((x) => obj(x.snapshot).claim_id === cl.claim_id).length !==
      1
    )
      reject(7, "dependency_result_invalid", "inspection.view.claims");
  evidence.forEach((e, i) => {
    if (
      !s.evidence.some(
        (x) => x.evidence_unit_id === obj(e.snapshot).evidence_unit_id,
      )
    )
      reject(
        7,
        "dependency_result_invalid",
        at("inspection.view.evidence", i) + ".snapshot.evidence_unit_id",
      );
  });
  const originalIDs = new Set(original.map((cl) => cl.claim_id)),
    carriers = objects(s.material.support_carriers),
    derivations = objects(s.material.derivations);
  const resolve = (rows: O[], key: string, value: J, path: string): O => {
    const matches = rows.filter((r) => r[key] === value);
    if (matches.length !== 1) reject(7, "dependency_result_invalid", path);
    const found = matches[0];
    if (!found) throw new TypeError("resolved reference");
    return found;
  };
  const originalClaim = (value: J, path: string): O => {
    if (!originalIDs.has(value)) reject(7, "dependency_result_invalid", path);
    return resolve(
      claims.map((cl) => obj(cl.snapshot)),
      "claim_id",
      value,
      path,
    );
  };
  const uniqueRefs = (
    refs: J[],
    path: string,
    check: (ref: J, field: string) => void,
  ): void => {
    const seen = new Set<J>();
    refs.forEach((ref, j) => {
      const field = at(path, j);
      if (seen.has(ref)) reject(7, "dependency_result_invalid", field);
      seen.add(ref);
      check(ref, field);
    });
  };
  const uniqueRows = (rows: O[], key: string, path: string): void => {
    const seen = new Set<J>();
    rows.forEach((r, i) => {
      const value = r[key] ?? null;
      if (seen.has(value))
        reject(7, "dependency_result_invalid", at(path, i) + "." + key);
      seen.add(value);
    });
  };
  evidence.forEach((e, i) => {
    uniqueRefs(
      arr(e.claim_representation_refs),
      at("inspection.view.evidence", i) + ".claim_representation_refs",
      originalClaim,
    );
  });
  const contexts = objects(view.context_candidates),
    beats = objects(view.beats),
    signals = objects(view.signals),
    continuity = objects(view.continuity),
    silentRows = objects(view.silent_inputs);
  uniqueRows(contexts, "context_id", "inspection.view.context_candidates");
  uniqueRows(beats, "beat_id", "inspection.view.beats");
  uniqueRows(signals, "signal_id", "inspection.view.signals");
  uniqueRows(continuity, "continuity_id", "inspection.view.continuity");
  uniqueRows(silentRows, "claim_id", "inspection.view.silent_inputs");
  contexts.forEach((r, i) =>
    originalClaim(
      r.claim_id ?? null,
      at("inspection.view.context_candidates", i) + ".claim_id",
    ),
  );
  beats.forEach((r, i) => {
    uniqueRefs(
      arr(r.member_claim_refs),
      at("inspection.view.beats", i) + ".member_claim_refs",
      originalClaim,
    );
  });
  signals.forEach((r, i) => {
    const path = at("inspection.view.signals", i) + ".ref";
    if (r.type === "derivation_run")
      resolve(derivations, "derivation_run_id", r.ref ?? null, path);
    else {
      const carrier = resolve(
        carriers,
        "artifact_id",
        str(r.ref).slice("artifact:".length),
        path,
      );
      if (obj(carrier.canonical_payload).support_kind !== "signal")
        reject(7, "dependency_result_invalid", path);
    }
  });
  continuity.forEach((r, i) => {
    const path = at("inspection.view.continuity", i) + ".continuity_id",
      carrier = resolve(
        carriers,
        "artifact_id",
        str(r.continuity_id).slice("artifact:".length),
        path,
      );
    if (obj(carrier.canonical_payload).support_kind !== "continuity")
      reject(7, "dependency_result_invalid", path);
  });
  silentRows.forEach((r, i) => {
    const path = at("inspection.view.silent_inputs", i);
    originalClaim(r.claim_id ?? null, path + ".claim_id");
    uniqueRefs(arr(r.support_refs), path + ".support_refs", (ref, field) => {
      resolve(
        evidence.map((e) => obj(e.snapshot)),
        "evidence_unit_id",
        ref,
        field,
      );
    });
  });
  claims.forEach((cl, i) => {
    const snap = obj(cl.snapshot),
      silent = snap.effective_usage_class === "silent";
    if (
      cl.consumption !==
      (silent ? "silent_calibration_only" : "ordinary_snapshot")
    )
      reject(
        7,
        "dependency_result_invalid",
        at("inspection.view.claims", i) + ".consumption",
      );
    const matchingSilent = silentRows.filter(
      (x) => x.claim_id === snap.claim_id,
    );
    if (matchingSilent.length !== (silent ? 1 : 0))
      reject(7, "dependency_result_invalid", "inspection.view.silent_inputs");
    if (
      cl.value_status !==
      (["analysis_text", "structured_text"].includes(str(snap.value_type))
        ? "withheld_pending_representation"
        : "packaged_typed_value")
    )
      reject(
        7,
        "dependency_result_invalid",
        at("inspection.view.claims", i) + ".value_status",
      );
  });
  silentRows.forEach((r, i) => {
    const path = at("inspection.view.silent_inputs", i),
      captured = objects(pkg.silent_inputs).find(
        (x) => x.claim_id === r.claim_id,
      );
    if (!captured) reject(7, "dependency_result_invalid", path + ".claim_id");
    if (!arr(r.allowed_consumers).includes("planner"))
      reject(7, "dependency_result_invalid", path + ".allowed_consumers");
    const sourceClaim = original.find((cl) => cl.claim_id === r.claim_id);
    if (!sourceClaim) throw new TypeError("silent original claim");
    const supportIDs = objects(sourceClaim.support_refs)
      .filter((ref) => ref.support_kind === "evidence")
      .map((ref) => ref.evidence_unit_id ?? null);
    equalFields(
      r.support_refs ?? null,
      supportIDs,
      7,
      "dependency_result_invalid",
      path + ".support_refs",
    );
    equalFields(r, captured, 7, "dependency_result_invalid", path);
  });
  const registry = FIXED_M.representation_registry;
  registry.forEach((r, i) => {
    const path = at("registry", i),
      target =
        r.target_kind === "claim"
          ? claims.find((x) => obj(x.snapshot).claim_id === r.target_id)
          : evidence.find(
              (x) => obj(x.snapshot).evidence_unit_id === r.target_id,
            );
    if (
      !target ||
      obj(target.snapshot)[
        r.target_kind === "claim" ? "claim_content_hash" : "content_hash"
      ] !== r.target_hash
    )
      reject(7, "registry_binding_refused", path + ".target_hash");
    const e = evidence.find(
        (x) => obj(x.snapshot).evidence_unit_id === r.source_evidence_unit_id,
      ),
      source = s.evidence.find(
        (x) => x.evidence_unit_id === r.source_evidence_unit_id,
      ),
      body = s.bodies.find(
        (x) => x.evidence_unit_id === r.source_evidence_unit_id,
      );
    if (
      !e ||
      !source ||
      !body ||
      obj(e.snapshot).content_hash !== r.source_content_hash ||
      body.content_hash !== r.source_content_hash ||
      source.content_hash !== r.source_content_hash
    )
      reject(7, "registry_binding_refused", path + ".source_content_hash");
    const snap = obj(e.snapshot);
    for (const key of [
      "rights_version_id",
      "rights_policy_version",
      "source_identity",
      "consumer_exposure.planner",
      "consumer_exposure.writer",
      "consumer_exposure.auditor",
      "quote_permission",
      "paraphrase_permission",
      "retention_class",
    ]) {
      const get = (v: O): J => {
        const parts = key.split(".");
        return parts.length === 2
          ? (obj(v[parts[0] ?? ""])[parts[1] ?? ""] ?? null)
          : (v[key] ?? null);
      };
      if (get(snap) !== get(source))
        reject(
          7,
          "registry_binding_refused",
          key === "rights_version_id"
            ? path + ".rights_version_id"
            : key === "source_identity"
              ? path + ".source_identity"
              : path,
        );
    }
    if (
      snap.rights_version_id !== r.rights_version_id ||
      snap.source_identity !== r.source_identity
    )
      reject(7, "registry_binding_refused", path + ".rights_version_id");
    if (
      snap.quote_permission !== false ||
      snap.paraphrase_permission !== true ||
      obj(snap.consumer_exposure).planner !== "paraphrase"
    )
      reject(7, "registry_binding_refused", path);
    if (r.target_kind === "claim") {
      const original = objects(pkg.claims).find(
          (x) => x.claim_id === r.target_id,
        ),
        returned = obj(target.snapshot);
      if (!original || !same(pick(original, CS_KEYS), returned))
        reject(7, "registry_binding_refused", path + ".target_hash");
      if (
        !same(original.attribution_requirement, r.attribution_requirement) ||
        returned.effective_usage_class !== r.usage_class
      )
        reject(
          7,
          "registry_binding_refused",
          path + ".attribution_requirement",
        );
    }
    const generated: O = r;
    if (
      raw(r.text) !== r.text_sha256 ||
      r.text === body.canonical_content ||
      generated.consumer !== "planner" ||
      generated.use_boundary !== "planning_data_only_no_spoken_permission"
    )
      reject(7, "registry_binding_refused", path + ".text");
  });
  original.forEach((cl) => {
    const i = claims.findIndex((x) => obj(x.snapshot).claim_id === cl.claim_id),
      returned = claims[i];
    if (!returned) throw new TypeError("original claim");
    equalFields(
      obj(returned.snapshot),
      pick(cl, CS_KEYS),
      7,
      "dependency_result_invalid",
      at("inspection.view.claims", i) + ".snapshot",
    );
    const text = ["structured_text", "analysis_text"].includes(
      str(cl.value_type),
    );
    equalFields(
      returned.value ?? null,
      text ? null : (cl.value ?? null),
      7,
      "dependency_result_invalid",
      at("inspection.view.claims", i) + ".value",
    );
    if (
      returned.value_status !==
      (text ? "withheld_pending_representation" : "packaged_typed_value")
    )
      reject(
        7,
        "dependency_result_invalid",
        at("inspection.view.claims", i) + ".value_status",
      );
  });
  claims.forEach((cl, i) => {
    const snap = obj(cl.snapshot);
    if (!original.some((x) => x.claim_id === snap.claim_id)) {
      const base = obj(FIXED_V.claims[0].snapshot),
        skip = new Set(
          [
            "claim_id",
            "subject_ref",
            "support_refs",
            "claim_content_hash",
            "frozen_state_hash",
          ].map((k) => at("inspection.view.claims", i) + ".snapshot." + k),
        );
      equalFields(
        snap,
        base,
        7,
        "dependency_result_invalid",
        at("inspection.view.claims", i) + ".snapshot",
        skip,
      );
      if (!textOK(snap.subject_ref) || !uuid.test(str(snap.claim_id)))
        reject(
          7,
          "dependency_result_invalid",
          at("inspection.view.claims", i) + ".snapshot.support_refs",
        );
      const value = obj(cl.value);
      for (const key of ["northbridge_goals", "southbank_goals"])
        if (
          !Number.isSafeInteger(value[key]) ||
          typeof value[key] !== "number" ||
          value[key] < 0 ||
          Object.is(value[key], -0)
        )
          reject(
            7,
            "dependency_result_invalid",
            at("inspection.view.claims", i) + ".value." + key,
          );
      if (
        cl.value_status !== "packaged_typed_value" ||
        cl.consumption !== "ordinary_snapshot"
      )
        reject(7, "dependency_result_invalid", at("inspection.view.claims", i));
    }
    objects(snap.support_refs).forEach((ref, j) => {
      const originalRef = original
        .flatMap((x) => objects(x.support_refs))
        .find((x) => x.claim_support_id === ref.claim_support_id);
      const path = at(
        at("inspection.view.claims", i) + ".snapshot.support_refs",
        j,
      );
      if (!originalRef)
        reject(7, "dependency_result_invalid", path + ".claim_support_id");
      equalFields(ref, originalRef, 7, "dependency_result_invalid", path);
    });
    if (
      !original.some((x) => x.claim_id === snap.claim_id) &&
      objects(snap.support_refs).length !== 0
    )
      reject(
        7,
        "dependency_result_invalid",
        at("inspection.view.claims", i) + ".snapshot.support_refs",
      );
  });
  // Full original summary/carrier/derivation content, never promoted into P.
  const summaries = objects(view.support_summaries),
    summaryIDs = new Set<J>();
  summaries.forEach((r, i) => {
    if (summaryIDs.has(r.claim_support_id ?? null))
      reject(
        7,
        "dependency_result_invalid",
        at("inspection.view.support_summaries", i) + ".claim_support_id",
      );
    summaryIDs.add(r.claim_support_id ?? null);
  });
  const expectedSummaries = original.flatMap((cl) =>
    objects(cl.support_refs).map((ref) => {
      let inspection: J;
      if (ref.support_kind === "evidence") {
        const e = s.evidence.find(
          (x) => x.evidence_unit_id === ref.evidence_unit_id,
        );
        if (!e) throw new TypeError("original support evidence");
        inspection = {
          evidence_unit_id: e.evidence_unit_id ?? null,
          content_hash: e.content_hash ?? null,
          rights_version_id: e.rights_version_id ?? null,
          planner_exposure: obj(e.consumer_exposure).planner ?? null,
        };
      } else if (ref.support_kind === "derivation") {
        const d = objects(s.material.derivations).find(
          (x) => x.derivation_run_id === ref.derivation_run_id,
        );
        if (!d) throw new TypeError("original support derivation");
        inspection = d;
      } else {
        const carrier = objects(s.material.support_carriers).find(
          (x) =>
            "artifact:" + str(x.artifact_id) === ref.external_support_identity,
        );
        if (!carrier) throw new TypeError("original support carrier");
        inspection = carrier;
      }
      return {
        claim_id: cl.claim_id ?? null,
        claim_support_id: ref.claim_support_id ?? null,
        support_kind: ref.support_kind ?? null,
        support_role: ref.support_role ?? null,
        support_hash: ref.support_hash ?? null,
        inspection,
      };
    }),
  );
  equalFields(
    summaries,
    expectedSummaries,
    7,
    "dependency_result_invalid",
    "inspection.view.support_summaries",
  );
  summaries.forEach((summary, i) => {
    if (summary.support_kind !== "continuity") return;
    const projection = obj(
        obj(obj(summary.inspection).canonical_payload).projection,
      ),
      occurrence = obj(projection.on_air_occurrence),
      publication = obj(projection.publication_attestation),
      path =
        at("inspection.view.support_summaries", i) +
        ".inspection.canonical_payload.projection";
    if (
      publication.state !== "published" ||
      publication.synthetic !== true ||
      projection.withdrawn !== false
    )
      reject(7, "dependency_result_invalid", path + ".publication_attestation");
    if (instant(occurrence.occurrence_time, publication.published_at) >= 0)
      reject(
        7,
        "dependency_result_invalid",
        path + ".on_air_occurrence.occurrence_time",
      );
    const proof = obj(pkg.selection_provenance).match_window_proof;
    if (
      instant(publication.published_at, obj(proof).as_of) > 0 ||
      instant(publication.published_at, s.package.frozen_at) > 0
    )
      reject(
        7,
        "dependency_result_invalid",
        path + ".publication_attestation.published_at",
      );
  });
  evidence.forEach((e, i) => {
    const snap = obj(e.snapshot),
      source = s.evidence.find(
        (x) => x.evidence_unit_id === snap.evidence_unit_id,
      );
    if (!source) throw new TypeError("evidence source");
    const path = at("inspection.view.evidence", i),
      snapshotPath = path + ".snapshot",
      nonregistry = !registry.some(
        (x) =>
          x.target_kind === "evidence" && x.target_id === snap.evidence_unit_id,
      );
    const permissionKeys = [
      "rights_version_id",
      "rights_policy_version",
      "source_identity",
      "consumer_exposure.planner",
      "consumer_exposure.writer",
      "consumer_exposure.auditor",
      "quote_permission",
      "paraphrase_permission",
      "retention_class",
      "locator",
    ];
    if (nonregistry)
      for (const key of permissionKeys) {
        const parts = key.split("."),
          value = (row: O): J =>
            parts.length === 2
              ? (obj(row[parts[0] ?? ""])[parts[1] ?? ""] ?? null)
              : (row[key] ?? null);
        equalFields(
          value(snap),
          value(source),
          7,
          "dependency_result_invalid",
          snapshotPath + "." + key,
        );
      }
    const mode = obj(snap.consumer_exposure).planner;
    const grant = s.rights.find(
      (r) => r.rights_version_id === source.rights_version_id,
    );
    if (!grant) throw new TypeError("evidence grant proof");
    const policy = obj(grant.policy),
      ceiling = obj(policy.consumer_exposure_ceiling);
    for (const consumer of ["planner", "writer", "auditor"])
      if (
        !arr(ceiling[consumer]).includes(
          obj(snap.consumer_exposure)[consumer] ?? null,
        )
      )
        reject(
          7,
          "dependency_result_invalid",
          snapshotPath + ".consumer_exposure." + consumer,
        );
    const status =
      mode === "exact_excerpt"
        ? "exact_span"
        : mode === "paraphrase"
          ? "paraphrase_not_materialized"
          : "claim_only";
    if (e.representation_status !== status)
      reject(7, "dependency_result_invalid", path + ".representation_status");
    if (
      (mode === "claim_only" || mode === "paraphrase") &&
      e.representation !== null
    )
      reject(7, "dependency_result_invalid", path + ".representation");
    if (mode === "exact_excerpt") {
      const span = obj(e.representation),
        quote = obj(source.permitted_quote),
        body = s.bodies.find(
          (x) => x.evidence_unit_id === snap.evidence_unit_id,
        );
      if (
        !body ||
        source.quote_permission !== true ||
        policy.quotation_permission !== true
      )
        reject(7, "dependency_result_invalid", path + ".representation");
      equalFields(
        span,
        {
          kind: "exact_permitted_span",
          text: quote.text ?? null,
          span_start: quote.span_start ?? null,
          span_end: quote.span_end ?? null,
        },
        7,
        "dependency_result_invalid",
        path + ".representation",
      );
      if (
        num(span.span_start) > num(span.span_end) ||
        num(span.span_end) > Array.from(str(body.canonical_content)).length ||
        Array.from(str(body.canonical_content))
          .slice(num(span.span_start), num(span.span_end))
          .join("") !== span.text
      )
        reject(7, "dependency_result_invalid", path + ".representation");
    }
    const skip = new Set(permissionKeys.map((key) => snapshotPath + "." + key));
    skip.add(snapshotPath + ".consumer_exposure");
    equalFields(
      snap,
      pick(source, ES_KEYS),
      7,
      "dependency_result_invalid",
      snapshotPath,
      nonregistry ? skip : new Set(),
    );
    const representationRefs = original
      .filter((cl) =>
        objects(cl.support_refs).some(
          (ref) =>
            ref.support_kind === "evidence" &&
            ref.evidence_unit_id === snap.evidence_unit_id,
        ),
      )
      .map((cl) => cl.claim_id ?? null);
    equalFields(
      e.claim_representation_refs ?? null,
      representationRefs,
      7,
      "dependency_result_invalid",
      path + ".claim_representation_refs",
    );
  });
  for (const key of Object.keys(FIXED_V_FIELDS).filter(
    (k) =>
      ![
        "claims",
        "evidence",
        "limits",
        "materialization",
        "assurance",
        "schema",
        "source_attribution",
      ].includes(k),
  )) {
    const expectedValue =
      key === "package_id"
        ? s.package.id
        : (obj(s.package.manifest)[key] ?? s.package[key]);
    if (expectedValue !== undefined)
      equalFields(
        view[key] ?? null,
        expectedValue,
        7,
        "dependency_result_invalid",
        "inspection.view." + key,
      );
  }
  const attrib = objects(view.source_attribution),
    sourceAttrib = objects(pkg.source_attribution);
  if (attrib.length !== sourceAttrib.length)
    reject(
      7,
      "dependency_result_invalid",
      "inspection.view.source_attribution",
    );
  attrib.forEach((r, i) => {
    equalFields(
      r,
      sourceAttrib[i] ?? {},
      7,
      "dependency_result_invalid",
      at("inspection.view.source_attribution", i),
      new Set([at("inspection.view.source_attribution", i) + ".display_name"]),
    );
  });
  if (
    !same(view.limits, FIXED_V.limits) ||
    view.schema !== FIXED_V.schema ||
    view.assurance !== FIXED_V.assurance ||
    view.materialization !== FIXED_V.materialization
  )
    reject(7, "dependency_result_invalid", "inspection.view");
  return owned;
}
function logical(
  s: Source,
  c: Captured,
  inspection: O,
  inputText: string,
  packageText: string,
  materialText: string,
): O {
  const view = obj(inspection.view),
    registry = FIXED_M.representation_registry;
  const p: O = Object.fromEntries(
    Object.keys(FIXED_P).map((k) => [k, view[k] ?? null]),
  );
  p.claims = objects(view.claims).map((cl) => {
    const r = registry.find(
      (r) =>
        r.target_kind === "claim" && r.target_id === obj(cl.snapshot).claim_id,
    );
    return {
      ...cl,
      value_status: r
        ? "withheld_original_text_value"
        : (cl.value_status ?? null),
      statement: r
        ? {
            kind: r.representation_kind,
            representation_id: r.representation_id,
            text: r.text,
          }
        : null,
    };
  });
  p.evidence = objects(view.evidence).map((e) => {
    const r = registry.find(
      (r) =>
        r.target_kind === "evidence" &&
        r.target_id === obj(e.snapshot).evidence_unit_id,
    );
    return {
      ...e,
      representation: r
        ? {
            kind: r.representation_kind,
            representation_id: r.representation_id,
            text: r.text,
          }
        : (e.representation ?? null),
      representation_status: r
        ? "fixture_paraphrase"
        : (e.representation_status ?? null),
    };
  });
  return {
    ...FIXED_M,
    fixture_binding: {
      ...FIXED_M.fixture_binding,
      selected_members: FIXED_M.fixture_binding.selected_members.map(
        (r, i) => ({ ...r, ...c.observations[i] }),
      ),
    },
    inspection_dependency: {
      ...FIXED_M.inspection_dependency,
      input_identity: identity(inputText),
      package_text_identity: identity(packageText),
      material_text_identity: identity(materialText),
      view_canonical_identity: identity(str(inspection.canonical_json)),
      view_domain_sha256: inspection.view_sha256 ?? null,
    },
    programming_configuration: s.config,
    policy_source_hashes: s.policyHashes,
    planner_data: p,
  } as unknown as O;
}
export function prepareShowrunnerFixtureInput(): PC2Result {
  let phase: Phase = 0;
  try {
    if (arguments.length !== 0) reject(0, "arguments_not_allowed", "arguments");
    phase = 1;
    const c = capture((p) => {
      phase = p;
    });
    phase = 3;
    const s = assembly(c);
    phase = 4;
    grants(s);
    phase = 5;
    configuration(s);
    phase = 6;
    const packageText = canonicalJson(s.package),
      materialText = canonicalJson(s.material),
      inputText = canonicalJson({
        schema: "planner-fixture-consumer-input/1",
        package_payload: s.package,
        material: s.material,
      });
    if (Buffer.byteLength(inputText) > CAP)
      reject(6, "inspection_dependency_refused", "inspection", null, {
        kind: "rejected",
        profile: "planner-fixture-consumer-snapshot/1",
        code: "input_resource_limit",
        field: "input",
        parser_code: null,
      });
    const returned: unknown =
      materializePlannerFixtureConsumerSnapshot(inputText);
    const kindDescriptor =
      returned !== null && typeof returned === "object"
        ? Object.getOwnPropertyDescriptor(returned, "kind")
        : undefined;
    if (kindDescriptor?.value === "rejected" && "value" in kindDescriptor) {
      const dep = safeDependency(returned);
      reject(6, "inspection_dependency_refused", "inspection", null, dep);
    }
    phase = 7;
    const inspection = viewValidation(returned, s, inputText, packageText),
      data = logical(s, c, inspection, inputText, packageText, materialText),
      bytes = count(data);
    if (bytes > CAP)
      reject(7, "candidate_resource_limit", "candidate.canonical_json");
    phase = 8;
    c.observations.forEach((r, i) => {
      const expected = FIXED_M.fixture_binding.selected_members[i];
      if (r.bytes !== expected?.bytes || r.sha256 !== expected.sha256)
        reject(8, "source_identity_mismatch", at("source", i));
    });
    if (
      !same(
        identity(inputText),
        FIXED_M.inspection_dependency.input_identity,
      ) ||
      !same(
        identity(packageText),
        FIXED_M.inspection_dependency.package_text_identity,
      ) ||
      !same(
        identity(materialText),
        FIXED_M.inspection_dependency.material_text_identity,
      ) ||
      !same(obj(inspection).view, FIXED_V) ||
      inspection.view_sha256 !==
        FIXED_M.inspection_dependency.view_domain_sha256
    )
      reject(8, "dependency_identity_mismatch", "inspection");
    const owned = copy(data) as unknown as PC2Candidate["data"],
      candidate_json = canonicalJson(owned);
    if (
      Buffer.byteLength(candidate_json) !== bytes ||
      !same(owned, { ...FIXED_M, planner_data: FIXED_P })
    )
      throw new TypeError("candidate final invariant");
    return freeze({
      kind: "source_bound_fixture_candidate",
      profile: PROFILE,
      data: owned,
      candidate_json,
      identity: { utf8_bytes: String(bytes), sha256: raw(candidate_json) },
    });
  } catch (e) {
    if (e instanceof Refusal) return e.result;
    throw new PC2FixtureInputFault(phase);
  }
}
