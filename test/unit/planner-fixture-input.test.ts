// Independent accepted02/03/04 DATA witnesses; no expected value imported from PC2.
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { ZodError } from "zod";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  openFixturePack,
  FixtureIntegrityError,
  type Pack,
} from "../../src/fixture/pack.js";
import {
  canonicalJson,
  domainHash,
} from "../../src/identity/canonical-json.js";
import { showConfigVersionHash } from "../../src/identity/show-config.js";
import type { Json } from "../../src/runtime/command.js";
import type { PC2FaultPhase } from "../../src/runtime/planner-fixture-input.js";
import { projectEvent } from "../../src/runtime/observe.js";
describe("ROOT28 exact catalog projection without PC2 wiring", () => {
  const context = {
    event: "workflow.completed",
    workflow: "evidence_slice.run",
    stage: "evidence_slice",
    correlation_id: "d1250002-0000-4000-8000-000000000001",
    duration_ms: 17,
    status: "stopped",
    complete: false,
    stopped_step: "S2_snapshot_verification",
    stopped_outcome: "rejected",
  };
  const privateFields = {
    message: "PRIVATE_MESSAGE",
    detail: "PRIVATE_DETAIL",
    path: "/PRIVATE_PATH",
    payload: { source: "PRIVATE_PAYLOAD" },
  };
  it.each(["unexpected_failure", "input_resource_limit"] as const)(
    "%s projects only its declared code and stopped_code in an existing workflow",
    (code) => {
      const expected = {
        ...context,
        code,
        code_known: true,
        stopped_code: code,
      };
      const projected = projectEvent({
        ...context,
        ...privateFields,
        code,
        stopped_code: code,
      });
      expect(projected).toEqual(expected);
      expect(
        projectEvent(projected as unknown as Record<string, unknown>),
      ).toEqual(expected);
      expect(JSON.stringify(projected)).not.toContain("PRIVATE_");
    },
  );
  it.each([
    "unexpected_failure_private",
    "input_resource_limit_private",
  ] as const)(
    "neighbor %s remains omitted and unknown without private fields",
    (code) => {
      const expected = { ...context, code_known: false };
      const projected = projectEvent({
        ...context,
        ...privateFields,
        code,
        stopped_code: code,
      });
      expect(projected).toEqual(expected);
      expect(
        projectEvent(projected as unknown as Record<string, unknown>),
      ).toEqual(expected);
      expect(Object.hasOwn(projected, "code")).toBe(false);
      expect(Object.hasOwn(projected, "stopped_code")).toBe(false);
      expect(JSON.stringify(projected)).not.toContain("PRIVATE_");
    },
  );
});
type O = Record<string, Json>;
function obj(v: unknown): O {
  if (v === null || typeof v !== "object" || Array.isArray(v))
    throw new TypeError("expected record DATA");
  return v as O;
}
function list(v: unknown): O[] {
  if (!Array.isArray(v)) throw new TypeError("expected record array");
  return v as O[];
}
function buffer(v: unknown): Buffer {
  if (!Buffer.isBuffer(v)) throw new TypeError("expected byte DATA");
  return v;
}
function display(v: unknown): string {
  if (typeof v !== "string" && typeof v !== "number")
    throw new TypeError("expected primitive text/number");
  return String(v);
}
const clone = (v: unknown): Json => JSON.parse(JSON.stringify(v)) as Json;
const sha = (v: string | Uint8Array): string =>
  createHash("sha256").update(v).digest("hex");
const id = (v: string | Uint8Array) => ({
  bytes: typeof v === "string" ? Buffer.byteLength(v) : v.byteLength,
  sha256: sha(v),
});
const FIE = FixtureIntegrityError;
const EXPECTED_P: O = {
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
};
const EXPECTED_M: O = {
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
};
const EXPECTED_V: O = {
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
  support_summaries: [
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
              occurrence_identity:
                "fixture-external:late-control-occurrence-001",
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
  ],
};
const SOURCE_LITERALS: O = {
  all_seven_complete_rights_rows: [
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
  ],
  complete_tenor_carrier: {
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
  indirect_supporter_claim_entry: {
    approved_representation:
      "Across four supporter sources in the package, the dominant note was relief more than celebration.",
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
    value: { direction: "relief_over_celebration", observation_count: 4 },
    value_type: "tenor",
  },
  indirect_supporter_claim_row: {
    asserted_at: "2026-09-27T12:59:00Z",
    claim_id: "d1250008-0000-4000-8000-000000000005",
    claim_kind: "mood",
    content_hash:
      "077522e8f69193fa36fa038ab8378b3780c49456f67ea9eb730c928da00733c5",
    created_at: "2026-09-27T12:59:00Z",
    initial_status: "confirmed",
    initial_usage_class: "assertable",
    origin: "supporter_source",
    predicate: "supporter_postmatch_tenor",
    subject: { entity_ref: "entity_northbridge_fc" },
    subject_domain: "cultural",
    supersedes_claim_id: null,
    value: { direction: "relief_over_celebration", observation_count: 4 },
  },
  indirect_supporter_support_row: {
    claim_id: "d1250008-0000-4000-8000-000000000005",
    claim_support_id: "d125000a-0000-4000-8000-000000000005",
    created_at: "2026-09-27T12:59:40Z",
    derivation_run_id: null,
    evidence_unit_id: null,
    external_support_identity: "artifact:d1250005-0000-4000-8000-000000000017",
    support_hash:
      "46e6a24048f151f62f9e03a66bb57ca4aae78c0281630850bc74bf9205cd4c28",
    support_kind: "signal",
    support_role: "supports_value",
  },
  rejected_writer_authorized_representation_strings: [
    {
      authorized_representation:
        "The North Coast Gazette reported that Northbridge had rehearsed a 5-4-1 closing shape in training.",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000003",
      reason: "whole-source-equal; not used",
    },
    {
      authorized_representation:
        "Tactical review: Southbank's second-half wing focus may have been a deliberate response to Northbridge narrowing the midfield.",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000004",
      reason: "whole-source-equal; not used",
    },
  ],
  six_complete_body_rows: [
    {
      canonical_content:
        "The North Coast Gazette reported that Northbridge had rehearsed a 5-4-1 closing shape in training.",
      content_hash:
        "a71d542b57e7edcfe91186a9a934b0301845599b4a40f7fecb8d6e633b4b8578",
      created_at: "2026-09-27T12:59:00Z",
      evidence_type: "observation",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000003",
      rights_version_id: "d1250006-0000-4000-8000-000000000005",
      supersedes_evidence_unit_id: null,
      usage_class: "assertable",
    },
    {
      canonical_content:
        "Tactical review: Southbank's second-half wing focus may have been a deliberate response to Northbridge narrowing the midfield.",
      content_hash:
        "98cc45be73f4be9296b343ad543d249a63fc20f6c31daf0a86b6c90eb1b8e4df",
      created_at: "2026-09-27T12:59:00Z",
      evidence_type: "analysis",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000004",
      rights_version_id: "d1250006-0000-4000-8000-000000000005",
      supersedes_evidence_unit_id: null,
      usage_class: "hedged_only",
    },
    {
      canonical_content: "relieved more than celebratory",
      content_hash:
        "bb010e8fa7d1b2925a142620f20771294db03a6077c78ab72b041a3601cd41f3",
      created_at: "2026-09-27T12:59:00Z",
      evidence_type: "sentiment",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000005",
      rights_version_id: "d1250006-0000-4000-8000-000000000007",
      supersedes_evidence_unit_id: null,
      usage_class: "assertable",
    },
    {
      canonical_content: "relief with concern",
      content_hash:
        "290dca152f388f068d078aca310869cb6aebc6506588f9c9d06de4a5cce1d7e0",
      created_at: "2026-09-27T12:59:00Z",
      evidence_type: "sentiment",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000006",
      rights_version_id: "d1250006-0000-4000-8000-000000000007",
      supersedes_evidence_unit_id: null,
      usage_class: "assertable",
    },
    {
      canonical_content: "happy with result; unconvinced by game management",
      content_hash:
        "3089e7a00a05ca9145a2b83edf9dc3e0fd7d1b7be70df5f5f69ffde049958e21",
      created_at: "2026-09-27T12:59:00Z",
      evidence_type: "sentiment",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000007",
      rights_version_id: "d1250006-0000-4000-8000-000000000007",
      supersedes_evidence_unit_id: null,
      usage_class: "assertable",
    },
    {
      canonical_content: "mostly relief",
      content_hash:
        "3a462ce692fcdbdffcb3ce62810b2efbe50a1d18af3460944f46ba00623fdef5",
      created_at: "2026-09-27T12:59:00Z",
      evidence_type: "sentiment",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000008",
      rights_version_id: "d1250006-0000-4000-8000-000000000007",
      supersedes_evidence_unit_id: null,
      usage_class: "assertable",
    },
  ],
  text_claim_entries: [
    {
      approved_representation:
        "The North Coast Gazette reports Northbridge had rehearsed a 5-4-1 closing shape in training.",
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
      value: {
        context: "closing shape rehearsed in training",
        formation: "5-4-1",
      },
      value_type: "structured_text",
    },
    {
      approved_representation:
        "One specialist analysis in the package suggests Southbank's wider second-half attacks may have been a deliberate response to Northbridge narrowing the midfield.",
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
      value: {
        interpretation:
          "Southbank's second-half wing focus may have been a deliberate response to Northbridge narrowing the midfield.",
      },
      value_type: "analysis_text",
    },
  ],
  text_claim_source_rows: [
    {
      asserted_at: "2026-09-27T12:59:00Z",
      claim_id: "d1250008-0000-4000-8000-000000000003",
      claim_kind: "reported_fact",
      content_hash:
        "a6b3d89db355e2854bf35519496959e3b343639ff074be88202d9c10a4f74d38",
      created_at: "2026-09-27T12:59:00Z",
      initial_status: "confirmed",
      initial_usage_class: "assertable",
      origin: "external_publisher",
      predicate: "closing_shape_rehearsed",
      subject: { entity_ref: "entity_northbridge_fc" },
      subject_domain: "tactical",
      supersedes_claim_id: null,
      value: {
        context: "closing shape rehearsed in training",
        formation: "5-4-1",
      },
    },
    {
      asserted_at: "2026-09-27T12:59:00Z",
      claim_id: "d1250008-0000-4000-8000-000000000004",
      claim_kind: "analysis",
      content_hash:
        "f8bdddac5d0d10856a94121cd1dd178fd650477cbd82e338afa52cde5b228672",
      created_at: "2026-09-27T12:59:00Z",
      initial_status: "confirmed",
      initial_usage_class: "hedged_only",
      origin: "external_publisher",
      predicate: "southbank_wide_response",
      subject: { entity_ref: "entity_northbridge_fc" },
      subject_domain: "tactical",
      supersedes_claim_id: null,
      value: {
        interpretation:
          "Southbank's second-half wing focus may have been a deliberate response to Northbridge narrowing the midfield.",
      },
    },
  ],
  text_claim_support_rows: [
    {
      claim_id: "d1250008-0000-4000-8000-000000000003",
      claim_support_id: "d125000a-0000-4000-8000-000000000003",
      created_at: "2026-09-27T12:59:40Z",
      derivation_run_id: null,
      evidence_unit_id: "d1250007-0000-4000-8000-000000000003",
      external_support_identity: null,
      support_hash:
        "a71d542b57e7edcfe91186a9a934b0301845599b4a40f7fecb8d6e633b4b8578",
      support_kind: "evidence",
      support_role: "supports_value",
    },
    {
      claim_id: "d1250008-0000-4000-8000-000000000004",
      claim_support_id: "d125000a-0000-4000-8000-000000000004",
      created_at: "2026-09-27T12:59:40Z",
      derivation_run_id: null,
      evidence_unit_id: "d1250007-0000-4000-8000-000000000004",
      external_support_identity: null,
      support_hash:
        "98cc45be73f4be9296b343ad543d249a63fc20f6c31daf0a86b6c90eb1b8e4df",
      support_kind: "evidence",
      support_role: "supports_value",
    },
  ],
};
const EXPECTED_PACKAGE: O = {
  artifact_id: "d1250005-0000-4000-8000-000000000011",
  created_at: "2026-09-27T13:00:00Z",
  frozen_at: "2026-09-27T13:00:05Z",
  id: "d1250004-0000-4000-8000-000000000001",
  manifest: {
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
        approved_representation: "Northbridge FC beat Southbank Athletic 2-1.",
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
        value: { northbridge_goals: 2, southbank_goals: 1 },
        value_type: "scoreline",
      },
      {
        approved_representation: "Northbridge had 43 percent possession.",
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
        value: { scalar: "43", unit: "percent" },
        value_type: "exact_decimal",
      },
      {
        approved_representation:
          "The North Coast Gazette reports Northbridge had rehearsed a 5-4-1 closing shape in training.",
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
        value: {
          context: "closing shape rehearsed in training",
          formation: "5-4-1",
        },
        value_type: "structured_text",
      },
      {
        approved_representation:
          "One specialist analysis in the package suggests Southbank's wider second-half attacks may have been a deliberate response to Northbridge narrowing the midfield.",
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
        value: {
          interpretation:
            "Southbank's second-half wing focus may have been a deliberate response to Northbridge narrowing the midfield.",
        },
        value_type: "analysis_text",
      },
      {
        approved_representation:
          "Across four supporter sources in the package, the dominant note was relief more than celebration.",
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
        value: { direction: "relief_over_celebration", observation_count: 4 },
        value_type: "tenor",
      },
      {
        approved_representation:
          "An approved lore source traces the phrase 'the long ten' to at least 2019.",
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
        value: { attested_since_year: 2019, phrase: "the long ten" },
        value_type: "lore_phrase",
      },
      {
        approved_representation:
          "Northbridge conceded after the 80th minute in 3 of their last 5 league matches.",
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
        value: { after_minute: 80, count: 3, sample_size: 5 },
        value_type: "count_window",
      },
      {
        approved_representation:
          "Market-implied Northbridge win probability: 0.58.",
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
        value: { scalar: "0.58", unit: "probability" },
        value_type: "exact_decimal",
      },
      {
        approved_representation:
          "The previous published episode left late-game control unresolved.",
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
        value: {
          position: "late-game control remained unresolved",
          topic_thread_id: "thr_late_game_control",
        },
        value_type: "program_history",
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
        reason:
          "Prior published position makes the unresolved thread explicit.",
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
        retention_declaration: {
          canonical_source_bytes: "durable_offline_test_retention",
          policy_version: "synthetic-fixture-retention-v1",
          purge_behavior:
            "retain permitted tombstone metadata; no replacement bytes",
        },
        rights_policy_version: "d1250006-0000-4000-8000-000000000004",
        rights_version_id: "d1250006-0000-4000-8000-000000000004",
        source_identity: "src_north_coast_league",
        source_item_identity: "fixture-item:ev_official_result:v1",
        source_modality: "structured_data",
        source_role: "official",
        speaker_identity: null,
      },
      {
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
        retention_declaration: {
          canonical_source_bytes: "durable_offline_test_retention",
          policy_version: "synthetic-fixture-retention-v1",
          purge_behavior:
            "retain permitted tombstone metadata; no replacement bytes",
        },
        rights_policy_version: "d1250006-0000-4000-8000-000000000002",
        rights_version_id: "d1250006-0000-4000-8000-000000000002",
        source_identity: "src_fixture_data",
        source_item_identity: "fixture-item:ev_possession:v1",
        source_modality: "structured_data",
        source_role: "reference",
        speaker_identity: null,
      },
      {
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
        retention_declaration: {
          canonical_source_bytes: "durable_offline_test_retention",
          policy_version: "synthetic-fixture-retention-v1",
          purge_behavior:
            "retain permitted tombstone metadata; no replacement bytes",
        },
        rights_policy_version: "d1250006-0000-4000-8000-000000000005",
        rights_version_id: "d1250006-0000-4000-8000-000000000005",
        source_identity: "src_north_coast_gazette",
        source_item_identity: "fixture-item:ev_gazette_shape:v1",
        source_modality: "text",
        source_role: "journalist",
        speaker_identity: null,
      },
      {
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
        retention_declaration: {
          canonical_source_bytes: "durable_offline_test_retention",
          policy_version: "synthetic-fixture-retention-v1",
          purge_behavior:
            "retain permitted tombstone metadata; no replacement bytes",
        },
        rights_policy_version: "d1250006-0000-4000-8000-000000000005",
        rights_version_id: "d1250006-0000-4000-8000-000000000005",
        source_identity: "src_matchboard_analysis",
        source_item_identity: "fixture-item:ev_specialist_wide:v1",
        source_modality: "text",
        source_role: "analyst",
        speaker_identity: null,
      },
      {
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
        observation_order: 1,
        observation_set_identity: "fixture-supporter-reaction-event-001-v1",
        observation_window: {
          end: "2026-09-27T12:59:00Z",
          start: "2026-09-27T12:00:00Z",
        },
        origin: "supporter_source",
        paraphrase_permission: true,
        quote_permission: false,
        retention_class: "fixture_retained",
        retention_declaration: {
          canonical_source_bytes: "durable_offline_test_retention",
          policy_version: "synthetic-fixture-retention-v1",
          purge_behavior:
            "retain permitted tombstone metadata; no replacement bytes",
        },
        rights_policy_version: "d1250006-0000-4000-8000-000000000007",
        rights_version_id: "d1250006-0000-4000-8000-000000000007",
        source_identity: "src_supporter_forum_a",
        source_item_identity: "fixture-item:ev_supporter_1:v1",
        source_modality: "text",
        source_role: "supporter",
        speaker_identity: "anonymous-synthetic-observation-1",
      },
      {
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
        observation_order: 2,
        observation_set_identity: "fixture-supporter-reaction-event-001-v1",
        observation_window: {
          end: "2026-09-27T12:59:00Z",
          start: "2026-09-27T12:00:00Z",
        },
        origin: "supporter_source",
        paraphrase_permission: true,
        quote_permission: false,
        retention_class: "fixture_retained",
        retention_declaration: {
          canonical_source_bytes: "durable_offline_test_retention",
          policy_version: "synthetic-fixture-retention-v1",
          purge_behavior:
            "retain permitted tombstone metadata; no replacement bytes",
        },
        rights_policy_version: "d1250006-0000-4000-8000-000000000007",
        rights_version_id: "d1250006-0000-4000-8000-000000000007",
        source_identity: "src_supporter_podcast_b",
        source_item_identity: "fixture-item:ev_supporter_2:v1",
        source_modality: "audio",
        source_role: "supporter",
        speaker_identity: "anonymous-synthetic-observation-2",
      },
      {
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
        observation_order: 3,
        observation_set_identity: "fixture-supporter-reaction-event-001-v1",
        observation_window: {
          end: "2026-09-27T12:59:00Z",
          start: "2026-09-27T12:00:00Z",
        },
        origin: "supporter_source",
        paraphrase_permission: true,
        quote_permission: false,
        retention_class: "fixture_retained",
        retention_declaration: {
          canonical_source_bytes: "durable_offline_test_retention",
          policy_version: "synthetic-fixture-retention-v1",
          purge_behavior:
            "retain permitted tombstone metadata; no replacement bytes",
        },
        rights_policy_version: "d1250006-0000-4000-8000-000000000007",
        rights_version_id: "d1250006-0000-4000-8000-000000000007",
        source_identity: "src_supporter_blog_c",
        source_item_identity: "fixture-item:ev_supporter_3:v1",
        source_modality: "text",
        source_role: "supporter",
        speaker_identity: "anonymous-synthetic-observation-3",
      },
      {
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
        observation_order: 4,
        observation_set_identity: "fixture-supporter-reaction-event-001-v1",
        observation_window: {
          end: "2026-09-27T12:59:00Z",
          start: "2026-09-27T12:00:00Z",
        },
        origin: "supporter_source",
        paraphrase_permission: true,
        quote_permission: false,
        retention_class: "fixture_retained",
        retention_declaration: {
          canonical_source_bytes: "durable_offline_test_retention",
          policy_version: "synthetic-fixture-retention-v1",
          purge_behavior:
            "retain permitted tombstone metadata; no replacement bytes",
        },
        rights_policy_version: "d1250006-0000-4000-8000-000000000007",
        rights_version_id: "d1250006-0000-4000-8000-000000000007",
        source_identity: "src_supporter_forum_d",
        source_item_identity: "fixture-item:ev_supporter_4:v1",
        source_modality: "text",
        source_role: "supporter",
        speaker_identity: "anonymous-synthetic-observation-4",
      },
      {
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
        permitted_quote: { span_end: 83, span_start: 71, text: "the long ten" },
        quote_permission: true,
        retention_class: "fixture_retained",
        retention_declaration: {
          canonical_source_bytes: "durable_offline_test_retention",
          policy_version: "synthetic-fixture-retention-v1",
          purge_behavior:
            "retain permitted tombstone metadata; no replacement bytes",
        },
        rights_policy_version: "d1250006-0000-4000-8000-000000000006",
        rights_version_id: "d1250006-0000-4000-8000-000000000006",
        source_document_date: "2019-12-31",
        source_document_identity: "east-bank-2019-season-notes",
        source_identity: "src_east_bank_review_archive",
        source_item_identity: "fixture-item:ev_lore_long_ten:v1",
        source_modality: "text",
        source_role: "reference",
        speaker_identity: null,
      },
      {
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
        market_event_identity: "event_fixture_next_001",
        modality: "structured_data",
        origin: "data_provider",
        paraphrase_permission: false,
        quote_permission: false,
        reasoning_only: true,
        retention_class: "fixture_retained",
        retention_declaration: {
          canonical_source_bytes: "durable_offline_test_retention",
          policy_version: "synthetic-fixture-retention-v1",
          purge_behavior:
            "retain permitted tombstone metadata; no replacement bytes",
        },
        rights_policy_version: "d1250006-0000-4000-8000-000000000003",
        rights_version_id: "d1250006-0000-4000-8000-000000000003",
        source_identity: "src_fixture_market",
        source_item_identity: "fixture-item:ev_market:v1",
        source_modality: "structured_data",
        source_role: "market",
        speaker_identity: null,
      },
      {
        acquisition_ref:
          "fixture-acquisition:src_malicious_fixture:2026-09-27:v1",
        as_of: "2026-09-27T12:59:00Z",
        competition_identity: "competition_north_coast_league",
        consumer_exposure: {
          auditor: "exact_excerpt",
          planner: "hidden",
          writer: "hidden",
        },
        content_hash:
          "16c2b0ba472b17e10a395c3aa1800011a4997a26865021c5e75bd5361792da10",
        entity_identity: "entity_northbridge_fc",
        event_identity: "event_fixture_001",
        evidence_type: "context",
        evidence_unit_id: "d1250007-0000-4000-8000-000000000011",
        language: "en-GB",
        locator: {
          body_codepoint_end: 106,
          body_codepoint_start: 0,
          evidence_unit_id: "d1250007-0000-4000-8000-000000000011",
          kind: "synthetic_fixture_text",
          member: "evidence_store.json",
        },
        modality: "text",
        origin: "external_publisher",
        paraphrase_permission: false,
        quote_permission: false,
        retention_class: "fixture_retained",
        retention_declaration: {
          canonical_source_bytes: "durable_offline_test_retention",
          policy_version: "synthetic-fixture-retention-v1",
          purge_behavior:
            "retain permitted tombstone metadata; no replacement bytes",
        },
        rights_policy_version: "d1250006-0000-4000-8000-000000000001",
        rights_version_id: "d1250006-0000-4000-8000-000000000001",
        source_identity: "src_malicious_fixture",
        source_item_identity: "fixture-item:ev_injection:v1",
        source_modality: "text",
        source_role: "journalist",
        speaker_identity: null,
        untrusted_injection_specimen: true,
      },
      {
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
        event_completed_at: "2026-09-21T12:00:00Z",
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
        retention_declaration: {
          canonical_source_bytes: "durable_offline_test_retention",
          policy_version: "synthetic-fixture-retention-v1",
          purge_behavior:
            "retain permitted tombstone metadata; no replacement bytes",
        },
        rights_policy_version: "d1250006-0000-4000-8000-000000000002",
        rights_version_id: "d1250006-0000-4000-8000-000000000002",
        source_identity: "src_fixture_data",
        source_item_identity: "fixture-item:ev_prev_1:v1",
        source_modality: "structured_data",
        source_role: "reference",
        speaker_identity: null,
        window_identity: "fixture-last-five-league-before-event-001-v1",
        window_order: 1,
      },
      {
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
        event_completed_at: "2026-09-14T12:00:00Z",
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
        retention_declaration: {
          canonical_source_bytes: "durable_offline_test_retention",
          policy_version: "synthetic-fixture-retention-v1",
          purge_behavior:
            "retain permitted tombstone metadata; no replacement bytes",
        },
        rights_policy_version: "d1250006-0000-4000-8000-000000000002",
        rights_version_id: "d1250006-0000-4000-8000-000000000002",
        source_identity: "src_fixture_data",
        source_item_identity: "fixture-item:ev_prev_2:v1",
        source_modality: "structured_data",
        source_role: "reference",
        speaker_identity: null,
        window_identity: "fixture-last-five-league-before-event-001-v1",
        window_order: 2,
      },
      {
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
        event_completed_at: "2026-09-07T12:00:00Z",
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
        retention_declaration: {
          canonical_source_bytes: "durable_offline_test_retention",
          policy_version: "synthetic-fixture-retention-v1",
          purge_behavior:
            "retain permitted tombstone metadata; no replacement bytes",
        },
        rights_policy_version: "d1250006-0000-4000-8000-000000000002",
        rights_version_id: "d1250006-0000-4000-8000-000000000002",
        source_identity: "src_fixture_data",
        source_item_identity: "fixture-item:ev_prev_3:v1",
        source_modality: "structured_data",
        source_role: "reference",
        speaker_identity: null,
        window_identity: "fixture-last-five-league-before-event-001-v1",
        window_order: 3,
      },
      {
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
        event_completed_at: "2026-08-31T12:00:00Z",
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
        retention_declaration: {
          canonical_source_bytes: "durable_offline_test_retention",
          policy_version: "synthetic-fixture-retention-v1",
          purge_behavior:
            "retain permitted tombstone metadata; no replacement bytes",
        },
        rights_policy_version: "d1250006-0000-4000-8000-000000000002",
        rights_version_id: "d1250006-0000-4000-8000-000000000002",
        source_identity: "src_fixture_data",
        source_item_identity: "fixture-item:ev_prev_4:v1",
        source_modality: "structured_data",
        source_role: "reference",
        speaker_identity: null,
        window_identity: "fixture-last-five-league-before-event-001-v1",
        window_order: 4,
      },
      {
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
        event_completed_at: "2026-08-24T12:00:00Z",
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
        retention_declaration: {
          canonical_source_bytes: "durable_offline_test_retention",
          policy_version: "synthetic-fixture-retention-v1",
          purge_behavior:
            "retain permitted tombstone metadata; no replacement bytes",
        },
        rights_policy_version: "d1250006-0000-4000-8000-000000000002",
        rights_version_id: "d1250006-0000-4000-8000-000000000002",
        source_identity: "src_fixture_data",
        source_item_identity: "fixture-item:ev_prev_5:v1",
        source_modality: "structured_data",
        source_role: "reference",
        speaker_identity: null,
        window_identity: "fixture-last-five-league-before-event-001-v1",
        window_order: 5,
      },
    ],
    schema: "evidence-package/2.0",
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
  },
  package_hash:
    "a8655c0e8bd72094a823b367a0c21cd665d3d99c271341286a92dbdc2ea304ab",
  schema_version: "evidence-package/2.0",
  scope_hash:
    "ecb1eb2b675a9e383dfe88e6311f8cc88cc97eb17183df9a8cae935d8d1f8979",
  selector_run_id: "selector_fixture_004",
};
const EXPECTED_MATERIAL: O = {
  claim_bases: [
    {
      asserted_at: "2026-09-27T12:59:00Z",
      claim_id: "d1250008-0000-4000-8000-000000000001",
      claim_kind: "event_fact",
      content_hash:
        "fbb285c68fd26f5bb5cd26b6f0179d9aa0062e30e84e47e98c8c8d14292c2aa1",
      created_at: "2026-09-27T12:59:00Z",
      initial_status: "confirmed",
      initial_usage_class: "assertable",
      origin: "official_source",
      predicate: "match_result",
      subject: { entity_ref: "entity_northbridge_fc" },
      subject_domain: "statistical",
      supersedes_claim_id: null,
      value: { northbridge_goals: 2, southbank_goals: 1 },
    },
    {
      asserted_at: "2026-09-27T12:59:00Z",
      claim_id: "d1250008-0000-4000-8000-000000000002",
      claim_kind: "event_fact",
      content_hash:
        "55e10cb05eef3ff50b04d02b9c328bd502e7f3af840ecd774ffe7f9743408376",
      created_at: "2026-09-27T12:59:00Z",
      initial_status: "confirmed",
      initial_usage_class: "assertable",
      origin: "data_provider",
      predicate: "possession_percent",
      subject: { entity_ref: "entity_northbridge_fc" },
      subject_domain: "statistical",
      supersedes_claim_id: null,
      value: { scalar: "43", unit: "percent" },
    },
    {
      asserted_at: "2026-09-27T12:59:00Z",
      claim_id: "d1250008-0000-4000-8000-000000000003",
      claim_kind: "reported_fact",
      content_hash:
        "a6b3d89db355e2854bf35519496959e3b343639ff074be88202d9c10a4f74d38",
      created_at: "2026-09-27T12:59:00Z",
      initial_status: "confirmed",
      initial_usage_class: "assertable",
      origin: "external_publisher",
      predicate: "closing_shape_rehearsed",
      subject: { entity_ref: "entity_northbridge_fc" },
      subject_domain: "tactical",
      supersedes_claim_id: null,
      value: {
        context: "closing shape rehearsed in training",
        formation: "5-4-1",
      },
    },
    {
      asserted_at: "2026-09-27T12:59:00Z",
      claim_id: "d1250008-0000-4000-8000-000000000004",
      claim_kind: "analysis",
      content_hash:
        "f8bdddac5d0d10856a94121cd1dd178fd650477cbd82e338afa52cde5b228672",
      created_at: "2026-09-27T12:59:00Z",
      initial_status: "confirmed",
      initial_usage_class: "hedged_only",
      origin: "external_publisher",
      predicate: "southbank_wide_response",
      subject: { entity_ref: "entity_northbridge_fc" },
      subject_domain: "tactical",
      supersedes_claim_id: null,
      value: {
        interpretation:
          "Southbank's second-half wing focus may have been a deliberate response to Northbridge narrowing the midfield.",
      },
    },
    {
      asserted_at: "2026-09-27T12:59:00Z",
      claim_id: "d1250008-0000-4000-8000-000000000005",
      claim_kind: "mood",
      content_hash:
        "077522e8f69193fa36fa038ab8378b3780c49456f67ea9eb730c928da00733c5",
      created_at: "2026-09-27T12:59:00Z",
      initial_status: "confirmed",
      initial_usage_class: "assertable",
      origin: "supporter_source",
      predicate: "supporter_postmatch_tenor",
      subject: { entity_ref: "entity_northbridge_fc" },
      subject_domain: "cultural",
      supersedes_claim_id: null,
      value: { direction: "relief_over_celebration", observation_count: 4 },
    },
    {
      asserted_at: "2026-09-27T12:59:00Z",
      claim_id: "d1250008-0000-4000-8000-000000000006",
      claim_kind: "lore",
      content_hash:
        "9be7ef594118c81d980d25a343ade42b6dfc2932c9a3a31eb69170584aee117d",
      created_at: "2026-09-27T12:59:00Z",
      initial_status: "confirmed",
      initial_usage_class: "assertable",
      origin: "external_publisher",
      predicate: "supporter_phrase_long_ten",
      subject: { entity_ref: "entity_northbridge_fc" },
      subject_domain: "cultural",
      supersedes_claim_id: null,
      value: { attested_since_year: 2019, phrase: "the long ten" },
    },
    {
      asserted_at: "2026-09-27T12:59:00Z",
      claim_id: "d1250008-0000-4000-8000-000000000007",
      claim_kind: "desk_derived",
      content_hash:
        "cabbed4a2abed81a76fa2a0d4ce7ca2232545224ffbd37ac5a01e1b56fb2063f",
      created_at: "2026-09-27T12:59:00Z",
      initial_status: "confirmed",
      initial_usage_class: "assertable",
      origin: "desk_derived",
      predicate: "late_concessions_recent",
      subject: { entity_ref: "entity_northbridge_fc" },
      subject_domain: "statistical",
      supersedes_claim_id: null,
      value: { after_minute: 80, count: 3, sample_size: 5 },
    },
    {
      asserted_at: "2026-09-27T12:59:00Z",
      claim_id: "d1250008-0000-4000-8000-000000000008",
      claim_kind: "analysis",
      content_hash:
        "d635b3253e5d2aba9cea12a2ac3495606ebac7d3d365b6b9623d613fa92e7a53",
      created_at: "2026-09-27T12:59:00Z",
      initial_status: "confirmed",
      initial_usage_class: "silent",
      origin: "data_provider",
      predicate: "next_match_market_probability",
      subject: { entity_ref: "entity_northbridge_fc" },
      subject_domain: "statistical",
      supersedes_claim_id: null,
      value: { scalar: "0.58", unit: "probability" },
    },
    {
      asserted_at: "2026-09-27T12:59:00Z",
      claim_id: "d1250008-0000-4000-8000-000000000009",
      claim_kind: "program_history",
      content_hash:
        "92d17eee43920805daf81919b546e7be44a50915d579e4da84ff5782e828d54f",
      created_at: "2026-09-27T12:59:00Z",
      initial_status: "confirmed",
      initial_usage_class: "assertable",
      origin: "desk_derived",
      predicate: "prior_published_position",
      subject: { entity_ref: "entity_northbridge_fc" },
      subject_domain: "historical",
      supersedes_claim_id: null,
      value: {
        position: "late-game control remained unresolved",
        topic_thread_id: "thr_late_game_control",
      },
    },
  ],
  derivations: [
    {
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
  ],
  evidence_bodies: [
    {
      canonical_content:
        "The East Bank Review Archive records the Northbridge supporter phrase 'the long ten' in its 2019 season notes.",
      content_hash:
        "413c4fc6bbce8ab3ec6704e07bfc85f7e6800b92ae8f51de1c430b65a74c6ee3",
      created_at: "2026-09-27T12:59:00Z",
      evidence_type: "context",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000009",
      rights_version_id: "d1250006-0000-4000-8000-000000000006",
      supersedes_evidence_unit_id: null,
      usage_class: "assertable",
    },
    {
      canonical_content: "Previous match 1: Northbridge conceded in minute 84.",
      content_hash:
        "3c7a7888d1ae4d5c6a40aadae89f0db9cf0732c3a22265c65ac688867c785150",
      created_at: "2026-09-27T12:59:00Z",
      evidence_type: "fact",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000012",
      rights_version_id: "d1250006-0000-4000-8000-000000000002",
      supersedes_evidence_unit_id: null,
      usage_class: "assertable",
    },
    {
      canonical_content:
        "Previous match 2: Northbridge did not concede after minute 80.",
      content_hash:
        "ad8cbb012e22007db8c815249f907fbbf2039b63c83d3d9be6a222249a7ffd24",
      created_at: "2026-09-27T12:59:00Z",
      evidence_type: "fact",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000013",
      rights_version_id: "d1250006-0000-4000-8000-000000000002",
      supersedes_evidence_unit_id: null,
      usage_class: "assertable",
    },
    {
      canonical_content: "Previous match 3: Northbridge conceded in minute 88.",
      content_hash:
        "c5ff2da2639e0f56c53a2812dda8e435f5c7ccfd1df7fe306ace66e075652fba",
      created_at: "2026-09-27T12:59:00Z",
      evidence_type: "fact",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000014",
      rights_version_id: "d1250006-0000-4000-8000-000000000002",
      supersedes_evidence_unit_id: null,
      usage_class: "assertable",
    },
    {
      canonical_content:
        "Previous match 4: Northbridge did not concede after minute 80.",
      content_hash:
        "fa9d0a653d449f5d4b599799dffcc487e04f2cc24dbcec7e0451bb102eebdc6b",
      created_at: "2026-09-27T12:59:00Z",
      evidence_type: "fact",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000015",
      rights_version_id: "d1250006-0000-4000-8000-000000000002",
      supersedes_evidence_unit_id: null,
      usage_class: "assertable",
    },
    {
      canonical_content: "Previous match 5: Northbridge conceded in minute 90.",
      content_hash:
        "b21989b1b1461ca40d2ce84498250648e5f03949881d9fc3e82167fbf36acba5",
      created_at: "2026-09-27T12:59:00Z",
      evidence_type: "fact",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000016",
      rights_version_id: "d1250006-0000-4000-8000-000000000002",
      supersedes_evidence_unit_id: null,
      usage_class: "assertable",
    },
  ],
  rights_versions: [
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
  ],
  support_carriers: [
    {
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
    {
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
  ],
};

const Q3_PINS = [
  [
    "compact",
    332794,
    "ac40e6fda276dcf25b2997b4ae117ef2a71a3ad0362474498791e2d883056235",
  ],
  [
    "body_null",
    332698,
    "5bdce70e180241a623528c718057a5a62946334a8e003e9118a52273db755964",
  ],
  [
    "duplicate_and_null",
    333052,
    "c337e1fbacbd6c0d7c84b938deb20b4cef9f5c6a9d5a8aa0299035c0dd4a4e55",
  ],
  [
    "bad_id_and_null",
    332698,
    "b8334499871698253f08f86c74dd64caef09dd23aa0930845e82d87d877c6c5f",
  ],
  [
    "missing9_and_null3",
    332240,
    "263ed2eb36c81e00f6ac7104460c5f2a5227544ba4b5db8df63c36b042104455",
  ],
  [
    "superseded9_and_null3",
    332732,
    "d55c0509a93b11341e3029a0f7ea0c13bd3c5e5727f6328d3986ab91aaea5c94",
  ],
  [
    "superseded9",
    332828,
    "9d2c5ece857de3b78ba154f14ff59d8cc49d4ee3af0f109a3ad7596703551838",
  ],
  [
    "deleted_body_and_columns",
    332685,
    "c9c631677c22307cc04bddf90b2677ed6187ee9c85738a7f8b1ec0dfd711f946",
  ],
  [
    "columns_control",
    332806,
    "bb69850ebb931916778f877f235628f540ed5543de725eb8a7cd966b8a62c8b8",
  ],
  [
    "uninspectable_and_null",
    332312,
    "9b85024313c8c49221c4bfb393bed55ddf30209c644875f8df36edab7b21fd73",
  ],
  [
    "superseded9_and_bodytype3",
    332729,
    "ac37a693af428748a866536249041b8f4ff5f71bb9aac6e421759a318453f7af",
  ],
  [
    "bodytype_control",
    332695,
    "5c82fcede906db250e63f3214af2d4cf6fba0c3637ea869690c0640c92bbba9b",
  ],
] as const;
const SOURCE_VECTOR_PINS = [
  [
    "body_null",
    0,
    332698,
    "5bdce70e180241a623528c718057a5a62946334a8e003e9118a52273db755964",
  ],
  [
    "body_deleted",
    0,
    332673,
    "9ac3aea51ccb9f404743fc6d5322707226bfdfd5f126765b15859c4a25793dab",
  ],
  [
    "body_superseded",
    0,
    332828,
    "7a039f60c4ecbc805a96bea9cd1d75b598d34bc2cb4bc5bd1be43518fb3d8d75",
  ],
  [
    "coverage",
    0,
    332768,
    "187d421b559f67c46c6e665f1c7c656909c79e9c419fa75db7d0c33100701bc1",
  ],
  [
    "acquisition",
    0,
    332795,
    "d789ac0f0c719008c0456e95bfdc7de9f99580de4e5e5db6ba97e69df81d30ea",
  ],
  [
    "planner_ceiling",
    0,
    332790,
    "8a174938cc5f0b3b8fcf04c9e0c8e261420148e7b2fa9c8ecb9e0746c0df433d",
  ],
  [
    "paraphrase",
    0,
    332795,
    "b9fd6a079366e7e88c1ad631f2da94a31a5dd7c91b16731500592dfeec1e5df7",
  ],
  [
    "retention",
    0,
    332775,
    "19b532b92589d9e1006d175df7d7ffc63a9f302c559b72501c81c3159d6a9a5f",
  ],
  [
    "external",
    0,
    332793,
    "50eb939c503f07e00195e27e15476f2dfc43aad343663e150f1b41327c222cb7",
  ],
  [
    "body_null_and_acquisition",
    0,
    332699,
    "cd41c23d578febe8d4cd932422d89ba982ec0d094ad6e2cc70c8eceb63502672",
  ],
  [
    "coverage_and_ceiling",
    0,
    332764,
    "a57a682d56de3059f7895120c6bbad62125b7bdf6c4d24ab4e25d7f6173f8000",
  ],
  [
    "publish",
    0,
    332793,
    "e00c6034b53e29ca8022cfcc46f62c210be27cca127e7f9cbcbf3e0ac51d5dbb",
  ],
  [
    "publish",
    4,
    1033,
    "e9c41ead1e36e8732ca018d38a95bc067a5317ddeb8cac0767edd9e8f814042c",
  ],
  [
    "review",
    0,
    332795,
    "4bf1506e2739226d4eb79d4a8439e0864eed5b5f42dc2c5965028f5e104c1bb0",
  ],
  [
    "review",
    4,
    1035,
    "d5014005a16a274ffbbcb1e21254f584eeec70329a6a2e6289e694093d87ff25",
  ],
  [
    "config_version",
    0,
    332794,
    "b00d5af1eaccc1d2da07dbe08ac6953ec1633e44a95073e51b149549e6d81232",
  ],
  [
    "config_version",
    4,
    1034,
    "06cd7179cc330de0a8acffa86386372c2f12524262adae8364f77d77732e43aa",
  ],
  [
    "config_extra",
    0,
    332806,
    "243edd370123d8fb717a4a82a2e61dd8012857c2a269e2b3993b1ef860b758fb",
  ],
  [
    "config_extra",
    4,
    1046,
    "68db1cb0b7772710f8a3172a279b8b706e3ad70bb8a8f40c4e7b46efb82853e3",
  ],
  [
    "config_name",
    0,
    332802,
    "17c5d4bd366ffb74b4795eb565cbf97236c446094b4ee61c3d2078d7738bc259",
  ],
  [
    "config_name",
    4,
    1042,
    "3873b5677f366340c54438dbb708aec3c899fbb55fca527c25593fece8095b00",
  ],
  [
    "config_mode",
    0,
    332789,
    "7a2a29b014eaf522a157e49553d9827a1e97f236a0f3250f6f9a3be49b085fe6",
  ],
  [
    "config_mode",
    4,
    1029,
    "c2c0d30185a049591155d41484bd35ea15f173952d6547d6c7e3439dd209bb3d",
  ],
  [
    "config_extra_and_publish",
    0,
    332805,
    "8bf834a3f09241195bdc9532c2e4ba699a80d74f6e27596cabcdf2b6a376e6d3",
  ],
  [
    "config_extra_and_publish",
    4,
    1045,
    "7773a58c273ae8193077a5f8d036f0bf94cf50fb41ebf5e028be23378442e264",
  ],
  [
    "external_and_publish",
    0,
    332792,
    "583e356bee11bef34748ad477c683595042934452456153f5036f71e0d09f307",
  ],
  [
    "external_and_publish",
    4,
    1033,
    "e9c41ead1e36e8732ca018d38a95bc067a5317ddeb8cac0767edd9e8f814042c",
  ],
  [
    "resource_config",
    0,
    349156,
    "49a23dd253006b5667f23ff8c57c1031b9982815b60cc9cfba930b0b472ce9e9",
  ],
  [
    "resource_config",
    4,
    17396,
    "26d006dd34f330783d2b932fca57c91643c67c9fb41bd69b6fbde8104f24698d",
  ],
  [
    "rows_shape",
    0,
    332514,
    "a83c45d15ca7d857560cf614d6cb9b3b8fd1d69e70e95f38e11d09c59219779f",
  ],
  [
    "family_set",
    0,
    332425,
    "d862cf78c720af633ac77e1b86e16c594349e11d4caf3b55534ce00af2f17d67",
  ],
  [
    "family_count",
    0,
    332963,
    "a786f72541a378c84ab4f02b6bdd6422d46caff9631016c794e236dff6783d7f",
  ],
  [
    "row_columns",
    0,
    332806,
    "965464c2791b00c33123d758895fd17a7d3bf3c496d92799378c199a7db98bc5",
  ],
  [
    "primary_key",
    0,
    332794,
    "ba497debd4a790b7edd225a3ab3a80cfd5ec7b381e341d432cef9c0759cdb208",
  ],
  [
    "duplicate_primary",
    0,
    332794,
    "7a336a72bb9eb76ac75e19ea39b44c0fc4df24c5b95341228516e2fa297549ff",
  ],
  [
    "oversize",
    5,
    1048577,
    "154b8ed3c2383ce429058768595935faf7851b5c38db2b1732594be1d88bc05a",
  ],
  [
    "json",
    5,
    1,
    "021fb596db81e6d02bf3d2586ee3981fe519f275c0ac9ca76bbcf2ebb4097d96",
  ],
  [
    "long_string",
    5,
    16420,
    "5a6a5d7cf3692219c2a7ea166c2a0ec3282e2dbbbf463fc42a29076c76205cb4",
  ],
  [
    "string_control",
    5,
    16419,
    "32d706e0386cacb3446b6d516838eab85260f4ec159a67bda0b7866d1254de3f",
  ],
  [
    "unicode",
    5,
    38,
    "d2e5162d7e171b5fe33181b95076a6b4a096deea92074f7a027c7cfd1e562057",
  ],
  [
    "whitespace",
    5,
    382,
    "562a384772d69d9ba68f82dfe72670934dbd2234c7f342b689fe23be045427f9",
  ],
  [
    "repair_foundation_compact",
    0,
    332794,
    "ac40e6fda276dcf25b2997b4ae117ef2a71a3ad0362474498791e2d883056235",
  ],
  [
    "repair_config_compact",
    4,
    1034,
    "d3844d9305b982e836fd0f85bc9a2aa2391ec74d53a0f2bbf7d2968b6a3ec234",
  ],
] as const;
function grant(f: O): O {
  return obj(
    list(obj(f.tables).rights_versions).find(
      (r) => r.rights_version_id === "d1250006-0000-4000-8000-000000000005",
    ),
  );
}
function verifyVector(name: string, map: Map<string, Buffer>) {
  for (const [n, i, b, h] of SOURCE_VECTOR_PINS)
    if (n === name)
      expect(id(buffer(map.get(display(members[i]?.member))))).toEqual({
        bytes: b,
        sha256: h,
      });
}
function configSource(
  change: (s: O, f: O) => void,
  rehash: boolean,
): Map<string, Buffer> {
  const map = source((f) => {
    const rows = list(obj(f.tables).show_config_versions),
      s = obj(
        rows.find(
          (r) =>
            r.show_config_version_id ===
            obj(obj(EXPECTED_M.programming_configuration).show_config_version)
              .show_config_version_id,
        ),
      );
    change(s, f);
    if (rehash) s.config_hash = showConfigVersionHash(s);
  });
  const f = obj(
    JSON.parse(buffer(map.get(display(members[0]?.member))).toString()) as Json,
  );
  const s = obj(
    list(obj(f.tables).show_config_versions).find(
      (r) =>
        r.show_config_version_id ===
        obj(obj(EXPECTED_M.programming_configuration).show_config_version)
          .show_config_version_id,
    ),
  );
  map.set(display(members[4]?.member), Buffer.from(JSON.stringify(s)));
  return map;
}
describe("PC2 constructive source and competing-defect controls", () => {
  it("uses the real default pinned reader and preserves full source literal bindings", async () => {
    vi.resetModules();
    const api = await import("../../src/runtime/planner-fixture-input.js");
    const r = api.prepareShowrunnerFixtureInput();
    expect(r.kind).toBe("source_bound_fixture_candidate");
    if (r.kind !== "source_bound_fixture_candidate")
      throw new Error("real reader positive refused");
    const f = obj(
        JSON.parse(
          buffer(original.get(display(members[0]?.member))).toString(),
        ) as Json,
      ),
      tables = obj(f.tables);
    expect(list(tables.rights_versions)).toEqual(
      SOURCE_LITERALS.all_seven_complete_rights_rows,
    );
    for (const row of list(SOURCE_LITERALS.six_complete_body_rows))
      expect(
        list(tables.evidence_units).find(
          (x) => x.evidence_unit_id === row.evidence_unit_id,
        ),
      ).toEqual(row);
    for (const row of list(SOURCE_LITERALS.text_claim_source_rows))
      expect(
        list(tables.claims).find((x) => x.claim_id === row.claim_id),
      ).toEqual(row);
    for (const row of list(SOURCE_LITERALS.text_claim_support_rows))
      expect(
        list(tables.claim_supports).find(
          (x) => x.claim_support_id === row.claim_support_id,
        ),
      ).toEqual(row);
    expect(
      list(tables.claims).find(
        (x) =>
          x.claim_id ===
          obj(SOURCE_LITERALS.indirect_supporter_claim_row).claim_id,
      ),
    ).toEqual(SOURCE_LITERALS.indirect_supporter_claim_row);
    const packageSource = obj(
        JSON.parse(
          buffer(original.get(display(members[1]?.member))).toString(),
        ) as Json,
      ),
      manifest = obj(packageSource.manifest);
    for (const entry of list(SOURCE_LITERALS.text_claim_entries))
      expect(
        list(manifest.claims).find((x) => x.claim_id === entry.claim_id),
      ).toEqual(entry);
    expect(
      list(manifest.claims).find(
        (x) =>
          x.claim_id ===
          obj(SOURCE_LITERALS.indirect_supporter_claim_entry).claim_id,
      ),
    ).toEqual(SOURCE_LITERALS.indirect_supporter_claim_entry);
    const indirect = obj(SOURCE_LITERALS.indirect_supporter_support_row);
    expect(
      list(tables.claim_supports).find(
        (x) => x.claim_support_id === indirect.claim_support_id,
      ),
    ).toEqual(indirect);
    const carrier = obj(SOURCE_LITERALS.complete_tenor_carrier),
      artifact = obj(
        list(tables.artifacts).find(
          (x) => x.artifact_id === carrier.artifact_id,
        ),
      );
    expect(
      Object.fromEntries(
        Object.keys(carrier).map((key) => [key, artifact[key]]),
      ),
    ).toEqual(carrier);
    for (const registry of r.data.representation_registry) {
      const body = obj(
        list(SOURCE_LITERALS.six_complete_body_rows).find(
          (x) => x.evidence_unit_id === registry.source_evidence_unit_id,
        ),
      );
      expect(registry.source_content_hash).toBe(body.content_hash);
      const packagedEvidence = obj(
        list(manifest.evidence).find(
          (x) => x.evidence_unit_id === body.evidence_unit_id,
        ),
      );
      expect(registry.source_identity).toBe(packagedEvidence.source_identity);
      expect(packagedEvidence.content_hash).toBe(body.content_hash);
      expect(packagedEvidence.rights_version_id).toBe(body.rights_version_id);
      expect(registry.rights_version_id).toBe(body.rights_version_id);
      expect(registry.text).not.toBe(body.canonical_content);
      if (registry.target_kind === "claim") {
        const entry = obj(
          list(SOURCE_LITERALS.text_claim_entries).find(
            (x) => x.claim_id === registry.target_id,
          ),
        );
        expect(registry.target_hash).toBe(entry.claim_content_hash);
        expect(registry.usage_class).toBe(entry.effective_usage_class);
        expect(registry.attribution_requirement).toEqual(
          entry.attribution_requirement,
        );
        expect(
          list(entry.support_refs).some(
            (x) =>
              x.evidence_unit_id === registry.source_evidence_unit_id &&
              x.support_hash === registry.source_content_hash,
          ),
        ).toBe(true);
      } else {
        expect(registry.target_id).toBe(body.evidence_unit_id);
        expect(registry.target_hash).toBe(body.content_hash);
      }
    }
    for (const rejected of list(
      SOURCE_LITERALS.rejected_writer_authorized_representation_strings,
    )) {
      const body = obj(
        list(SOURCE_LITERALS.six_complete_body_rows).find(
          (x) => x.evidence_unit_id === rejected.evidence_unit_id,
        ),
      );
      expect(body.canonical_content).toBe(rejected.authorized_representation);
      expect(
        r.data.representation_registry.every(
          (x) => x.text !== rejected.authorized_representation,
        ),
      ).toBe(true);
    }
  });
  it.each(Q3_PINS)(
    "Q3 %s preserves the independently calculated DATA and first refusal",
    async (name, bytes, digest) => {
      const map = source((f) => {
        if (name === "compact") return;
        const units = obj(f.tables).evidence_units as Json[];
        const row3 = evidence(f, 3),
          row9 = evidence(f, 9);
        if (
          [
            "body_null",
            "duplicate_and_null",
            "bad_id_and_null",
            "missing9_and_null3",
            "superseded9_and_null3",
            "uninspectable_and_null",
          ].includes(name)
        )
          row3.canonical_content = null;
        if (name === "duplicate_and_null") units.push(clone(row3));
        if (name === "bad_id_and_null")
          obj(units[0]).evidence_unit_id = "0".repeat(36);
        if (name === "missing9_and_null3") units.splice(units.indexOf(row9), 1);
        if (
          [
            "superseded9_and_null3",
            "superseded9",
            "superseded9_and_bodytype3",
          ].includes(name)
        )
          row9.supersedes_evidence_unit_id = E(1);
        if (["deleted_body_and_columns", "columns_control"].includes(name)) {
          const body = row3.canonical_content;
          delete row3.canonical_content;
          if (name === "columns_control") row3.canonical_content = body ?? null;
          obj(list(obj(f.tables).accounts)[0]).unknown = 0;
        }
        if (name === "uninspectable_and_null") units[0] = null;
        if (["superseded9_and_bodytype3", "bodytype_control"].includes(name))
          row3.canonical_content = 0;
      });
      expect(id(buffer(map.get(display(members[0]?.member))))).toEqual({
        bytes,
        sha256: digest,
      });
      const expected: Record<
        string,
        readonly [number, string, string, string | null]
      > = {
        compact: [8, "source_identity_mismatch", "source[0]", null],
        body_null: [
          3,
          "necessary_source_unavailable",
          "source.evidence[6].canonical_content",
          null,
        ],
        duplicate_and_null: [3, "source_record_invalid", "source[0]", null],
        bad_id_and_null: [3, "source_record_invalid", "source[0]", null],
        missing9_and_null3: [
          3,
          "necessary_source_unavailable",
          "source.evidence[0].canonical_content",
          null,
        ],
        superseded9_and_null3: [
          3,
          "necessary_source_unavailable",
          "source.evidence[6].canonical_content",
          null,
        ],
        superseded9: [
          3,
          "source_version_unsupported",
          "source.evidence[0].supersedes_evidence_unit_id",
          null,
        ],
        deleted_body_and_columns: [
          3,
          "necessary_source_unavailable",
          "source.evidence[6].canonical_content",
          null,
        ],
        columns_control: [
          3,
          "reader_refused",
          "source[0]",
          "row_columns_mismatch",
        ],
        uninspectable_and_null: [
          3,
          "reader_refused",
          "source[0]",
          "family_not_rows",
        ],
        superseded9_and_bodytype3: [
          3,
          "source_version_unsupported",
          "source.evidence[0].supersedes_evidence_unit_id",
          null,
        ],
        bodytype_control: [
          3,
          "source_record_invalid",
          "source.evidence[6].canonical_content",
          null,
        ],
      };
      const e = expected[name];
      if (!e) throw new Error("missing independently declared control");
      await refused({ members: map }, ...e);
      const partial: Record<string, string> = {
        duplicate_and_null: "body_null",
        bad_id_and_null: "body_null",
        missing9_and_null3: "body_null",
        superseded9_and_null3: "superseded9",
        deleted_body_and_columns: "columns_control",
        uninspectable_and_null: "body_null",
        superseded9_and_bodytype3: "bodytype_control",
      };
      const remaining = partial[name];
      if (remaining) {
        const repaired = source((f) => {
          if (remaining === "body_null")
            evidence(f, 3).canonical_content = null;
          if (remaining === "superseded9")
            evidence(f, 9).supersedes_evidence_unit_id = E(1);
          if (remaining === "columns_control") {
            const row = evidence(f, 3),
              body = row.canonical_content;
            delete row.canonical_content;
            row.canonical_content = body ?? null;
            obj(list(obj(f.tables).accounts)[0]).unknown = 0;
          }
          if (remaining === "bodytype_control")
            evidence(f, 3).canonical_content = 0;
        });
        const pin = Q3_PINS.find((r) => r[0] === remaining),
          tuple = expected[remaining];
        if (!pin || !tuple)
          throw new Error("missing independent repair control");
        expect(id(buffer(repaired.get(display(members[0]?.member))))).toEqual({
          bytes: pin[1],
          sha256: pin[2],
        });
        await refused({ members: repaired }, ...tuple);
      }
      const compact = source(() => undefined);
      expect(id(buffer(compact.get(display(members[0]?.member))))).toEqual({
        bytes: 332794,
        sha256:
          "ac40e6fda276dcf25b2997b4ae117ef2a71a3ad0362474498791e2d883056235",
      });
      await refused(
        { members: compact },
        8,
        "source_identity_mismatch",
        "source[0]",
      );
      const restored = await subject();
      expect(restored.prepareShowrunnerFixtureInput()).toMatchObject({
        kind: "source_bound_fixture_candidate",
        identity: {
          utf8_bytes: "55418",
          sha256:
            "dfe650e4eae99674fc0868b7d6feb1c89c5e13a5aa62534cd10bd72f974b6a5a",
        },
      });
    },
  );
  it.each([
    ["coverage", "covered_source_identities", 2],
    ["acquisition", "acquisition_permission", 2],
    ["planner_ceiling", "consumer_exposure_ceiling.planner", 2],
    ["paraphrase", "paraphrase_permission", 2],
    ["retention", "retention.canonical_source_bytes", 2],
    ["external", "provider_exposure.external_providers", 2],
    ["body_null_and_acquisition", "canonical_content", 6],
    ["coverage_and_ceiling", "covered_source_identities", 2],
  ] as const)(
    "rights %s has an independent byte witness and ordered repair",
    async (name, leaf, index) => {
      const map = source((f) => {
        const p = obj(grant(f).policy);
        if (["coverage", "coverage_and_ceiling"].includes(name))
          p.covered_source_identities = ["src_matchboard_analysis"];
        if (["acquisition", "body_null_and_acquisition"].includes(name))
          p.acquisition_permission = false;
        if (["planner_ceiling", "coverage_and_ceiling"].includes(name))
          obj(p.consumer_exposure_ceiling).planner = ["hidden"];
        if (name === "paraphrase") p.paraphrase_permission = false;
        if (name === "retention")
          obj(p.retention).canonical_source_bytes = "unavailable";
        if (name === "external")
          obj(p.provider_exposure).external_providers = true;
        if (name === "body_null_and_acquisition")
          evidence(f, 3).canonical_content = null;
      });
      verifyVector(name, map);
      if (name === "body_null_and_acquisition") {
        const partial = source((f) => {
          obj(grant(f).policy).acquisition_permission = false;
        });
        verifyVector("acquisition", partial);
        await refused(
          { members: partial },
          4,
          "rights_grant_refused",
          "rights[2].policy.acquisition_permission",
        );
      }
      if (name === "coverage_and_ceiling") {
        const partial = source((f) => {
          obj(obj(grant(f).policy).consumer_exposure_ceiling).planner = [
            "hidden",
          ];
        });
        verifyVector("planner_ceiling", partial);
        await refused(
          { members: partial },
          4,
          "rights_grant_refused",
          "rights[2].policy.consumer_exposure_ceiling.planner",
        );
      }
      await refused(
        { members: source(() => undefined) },
        8,
        "source_identity_mismatch",
        "source[0]",
      );
      await refused(
        { members: map },
        name === "body_null_and_acquisition" ? 3 : 4,
        name === "body_null_and_acquisition"
          ? "necessary_source_unavailable"
          : name === "external"
            ? "external_provider_forbidden"
            : "rights_grant_refused",
        name === "body_null_and_acquisition"
          ? "source.evidence[6].canonical_content"
          : "rights[" + display(index) + "].policy." + leaf,
      );
      const api = await subject();
      expect(api.prepareShowrunnerFixtureInput().kind).toBe(
        "source_bound_fixture_candidate",
      );
    },
  );
  it.each([
    [
      "publish",
      true,
      5,
      "current_use_unsupported",
      ".canonical_payload.publication_enabled",
    ],
    [
      "review",
      false,
      5,
      "configuration_binding_refused",
      ".pre_publish_review_required",
    ],
    [
      "config_version",
      false,
      5,
      "configuration_version_unsupported",
      ".schema_version",
    ],
    // ROOT06/07 correct ONLY these two old expectations; bytes/recipes retained.
    ["config_extra", false, 3, "reader_refused", "source[0]"],
    ["config_name", true, 8, "source_identity_mismatch", "source[0]"],
    [
      "config_mode",
      true,
      5,
      "configuration_binding_refused",
      ".canonical_payload.default_episode_mode",
    ],
    ["config_extra_and_publish", true, 3, "reader_refused", "source[0]"],
    [
      "external_and_publish",
      true,
      4,
      "external_provider_forbidden",
      "rights[2].policy.provider_exposure.external_providers",
    ],
  ] as const)(
    "configuration %s closes source/row/hash and stage order",
    async (name, rehash, phase, code, suffix) => {
      const map = configSource((s, f) => {
        const p = obj(s.canonical_payload);
        if (
          [
            "publish",
            "config_extra_and_publish",
            "external_and_publish",
          ].includes(name)
        )
          p.publication_enabled = true;
        if (name === "review") s.pre_publish_review_required = false;
        if (name === "config_version") s.schema_version = "show-config/2";
        if (["config_extra", "config_extra_and_publish"].includes(name))
          s.unknown = 0;
        if (name === "config_name") p.name = "Northbridge Post-Match revised";
        if (name === "config_mode") p.default_episode_mode = "unknown_mode";
        if (name === "external_and_publish")
          obj(obj(grant(f).policy).provider_exposure).external_providers = true;
      }, rehash);
      verifyVector(name, map);
      await refused(
        { members: map },
        phase,
        code,
        phase === 8 || phase === 4 || phase === 3
          ? suffix
          : "configuration.show_config_version" + suffix,
        phase === 3 ? "row_columns_mismatch" : null,
      );
      if (name === "external_and_publish") {
        const publish = configSource((s) => {
          obj(s.canonical_payload).publication_enabled = true;
        }, true);
        verifyVector("publish", publish);
        await refused(
          { members: publish },
          5,
          "current_use_unsupported",
          "configuration.show_config_version.canonical_payload.publication_enabled",
        );
      }
      // Accepted06's two extra-column cases have their complete, separately
      // pinned chains below. Complete the remaining original H controls here.
      if (name !== "config_extra" && name !== "config_extra_and_publish") {
        const compact = configSource(() => undefined, false);
        verifyVector("repair_foundation_compact", compact);
        verifyVector("repair_config_compact", compact);
        await refused(
          { members: compact },
          8,
          "source_identity_mismatch",
          "source[0]",
        );
        await fullPositive();
      }
    },
  );
  it.each([
    ["rows_shape", "rows_shape"],
    ["family_set", "family_set_mismatch"],
    ["family_count", "family_count_mismatch"],
    ["row_columns", "row_columns_mismatch"],
    ["primary_key", "primary_key_not_v4_uuid"],
    ["duplicate_primary", "duplicate_primary_key"],
  ] as const)("unchanged parent row-parser owns %s", async (name, code) => {
    const map = source((f) => {
      const t = obj(f.tables);
      if (name === "rows_shape") f.profile = 0;
      if (name === "family_set") delete t.accounts;
      const rows = Array.isArray(t.accounts) ? list(t.accounts) : [];
      if (name === "family_count") rows.push(obj(clone(rows[0])));
      if (name === "row_columns") obj(rows[0]).unknown = 0;
      if (name === "primary_key") obj(rows[0]).account_id = "0".repeat(36);
      if (name === "duplicate_primary")
        obj(rows[1]).account_id = obj(rows[0]).account_id ?? null;
    });
    verifyVector(name, map);
    await refused({ members: map }, 3, "reader_refused", "source[0]", code);
    const compact = source(() => undefined);
    verifyVector("repair_foundation_compact", compact);
    await refused(
      { members: compact },
      8,
      "source_identity_mismatch",
      "source[0]",
    );
    await fullPositive();
  });
  it.each([
    "oversize",
    "json",
    "long_string",
    "unicode",
    "whitespace",
  ] as const)("raw %s precedence/pin", async (name) => {
    const map = new Map(original),
      member = display(members[5]?.member);
    const b =
      name === "oversize"
        ? Buffer.alloc(1048577, "x")
        : name === "json"
          ? Buffer.from("{")
          : name === "long_string"
            ? Buffer.from(
                JSON.stringify({
                  registry_version: "A".repeat(16385),
                  values: [],
                }),
              )
            : name === "unicode"
              ? Buffer.from(
                  JSON.stringify({ registry_version: "e\u0301", values: [] }),
                )
              : Buffer.concat([buffer(original.get(member)), Buffer.from(" ")]);
    map.set(member, b);
    verifyVector(name, map);
    await refused(
      { members: map },
      name === "whitespace" ? 8 : 2,
      name === "oversize" || name === "long_string"
        ? "source_resource_limit"
        : name === "json"
          ? "source_json_invalid"
          : name === "unicode"
            ? "source_record_invalid"
            : "source_identity_mismatch",
      "source[5]",
    );
    if (name === "long_string") {
      map.set(
        member,
        Buffer.from(
          JSON.stringify({ registry_version: "A".repeat(16384), values: [] }),
        ),
      );
      verifyVector("string_control", map);
      await refused(
        { members: map },
        5,
        "configuration_version_unsupported",
        "configuration.episode_mode_registry.registry_version",
      );
    }
    map.set(member, buffer(original.get(member)));
    await fullPositive({ members: map });
  });
  it("source aliases remain unmodified and opaque rejection data is deeply owned", async () => {
    const pins = structuredClone(base.pins),
      roles = new Map(base.roles),
      names = [...base.memberNames],
      bytes = new Map(original);
    const api = await subject({
      open: () => ({
        pins,
        roles,
        memberNames: names,
        member: (n: string) => bytes.get(n),
        json: () => {
          throw new Error("unused");
        },
      }),
    });
    const r = api.prepareShowrunnerFixtureInput();
    expect(r.kind).toBe("source_bound_fixture_candidate");
    expect(Object.isFrozen(pins)).toBe(false);
    expect(Object.isFrozen(pins.familyCounts)).toBe(false);
    const dep = {
      kind: "rejected",
      profile: "planner-fixture-consumer-snapshot/1",
      code: "input_type_invalid",
      field: "input",
      parser_code: null,
    };
    const other = await subject({ returned: dep }),
      refusedResult = other.prepareShowrunnerFixtureInput();
    expect(refusedResult.kind).toBe("rejected");
    dep.field = "private";
    if (refusedResult.kind === "rejected")
      expect(refusedResult.dependency?.field).toBe("input");
  });
});

describe("accepted ROOT amendment06 exact specimens and every repair", () => {
  const first = () => display(members[0]?.member),
    config = () => display(members[4]?.member);
  const compactPins = (map: Map<string, Buffer>) => {
    expect(id(buffer(map.get(first())))).toEqual({
      bytes: 332794,
      sha256:
        "ac40e6fda276dcf25b2997b4ae117ef2a71a3ad0362474498791e2d883056235",
    });
    expect(id(buffer(map.get(config())))).toEqual({
      bytes: 1034,
      sha256:
        "d3844d9305b982e836fd0f85bc9a2aa2391ec74d53a0f2bbf7d2968b6a3ec234",
    });
  };
  async function restored(map: Map<string, Buffer>) {
    const api = await subject({ members: map }),
      r = api.prepareShowrunnerFixtureInput();
    expect(r.kind).toBe("source_bound_fixture_candidate");
    if (r.kind === "source_bound_fixture_candidate") {
      expect(r.data).toEqual(pos());
      expect(id(r.candidate_json)).toEqual({
        bytes: 55418,
        sha256:
          "dfe650e4eae99674fc0868b7d6feb1c89c5e13a5aa62534cd10bd72f974b6a5a",
      });
    }
  }
  it.each([false, true])(
    "old full-row extra, publication=%s, retains exact recipes and complete repair chain",
    async (publish) => {
      const name = publish ? "config_extra_and_publish" : "config_extra";
      const old = configSource((s) => {
        if (publish) obj(s.canonical_payload).publication_enabled = true;
      }, publish);
      const f = obj(JSON.parse(buffer(old.get(first())).toString()) as Json);
      const selected = obj(
        list(obj(f.tables).show_config_versions).find(
          (r) =>
            r.show_config_version_id ===
            obj(obj(EXPECTED_M.programming_configuration).show_config_version)
              .show_config_version_id,
        ),
      );
      selected.unknown = 0;
      old.set(first(), Buffer.from(JSON.stringify(f)));
      const s = obj(JSON.parse(buffer(old.get(config())).toString()) as Json);
      s.unknown = 0;
      old.set(config(), Buffer.from(JSON.stringify(s)));
      verifyVector(name, old);
      await refused(
        { members: old },
        3,
        "reader_refused",
        "source[0]",
        "row_columns_mismatch",
      );
      delete s.unknown;
      old.set(config(), Buffer.from(JSON.stringify(s)));
      expect(id(buffer(old.get(config())))).toEqual(
        publish
          ? {
              bytes: 1033,
              sha256:
                "e9c41ead1e36e8732ca018d38a95bc067a5317ddeb8cac0767edd9e8f814042c",
            }
          : {
              bytes: 1034,
              sha256:
                "d3844d9305b982e836fd0f85bc9a2aa2391ec74d53a0f2bbf7d2968b6a3ec234",
            },
      );
      await refused(
        { members: old },
        3,
        "reader_refused",
        "source[0]",
        "row_columns_mismatch",
      );
      delete selected.unknown;
      old.set(first(), Buffer.from(JSON.stringify(f)));
      if (publish) {
        verifyVector("publish", old);
        await refused(
          { members: old },
          5,
          "current_use_unsupported",
          "configuration.show_config_version.canonical_payload.publication_enabled",
        );
      } else {
        compactPins(old);
        await refused(
          { members: old },
          8,
          "source_identity_mismatch",
          "source[0]",
        );
      }
      const compact = configSource(() => undefined, false);
      compactPins(compact);
      await refused(
        { members: compact },
        8,
        "source_identity_mismatch",
        "source[0]",
      );
      compact.set(first(), buffer(original.get(first())));
      compact.set(config(), buffer(original.get(config())));
      await restored(compact);
    },
  );
  it.each([false, true])(
    "new member-only extra, publication=%s, discriminates Q5 surface and every repair",
    async (publish) => {
      const map = publish
        ? configSource((s) => {
            obj(s.canonical_payload).publication_enabled = true;
          }, true)
        : new Map(original);
      const s = obj(JSON.parse(buffer(map.get(config())).toString()) as Json);
      s.unknown = 0;
      map.set(config(), Buffer.from(JSON.stringify(s)));
      expect(id(buffer(map.get(first())))).toEqual(
        publish
          ? {
              bytes: 332793,
              sha256:
                "e00c6034b53e29ca8022cfcc46f62c210be27cca127e7f9cbcbf3e0ac51d5dbb",
            }
          : {
              bytes: 471514,
              sha256:
                "a27f4381bd6449bfb656c6431b56115a932e05c82791696fc293c701c0a58a7e",
            },
      );
      expect(id(buffer(map.get(config())))).toEqual(
        publish
          ? {
              bytes: 1045,
              sha256:
                "7773a58c273ae8193077a5f8d036f0bf94cf50fb41ebf5e028be23378442e264",
            }
          : {
              bytes: 1046,
              sha256:
                "68db1cb0b7772710f8a3172a279b8b706e3ad70bb8a8f40c4e7b46efb82853e3",
            },
      );
      await refused(
        { members: map },
        5,
        "configuration_shape_invalid",
        "configuration.show_config_version",
      );
      delete s.unknown;
      map.set(config(), Buffer.from(JSON.stringify(s)));
      if (publish) {
        verifyVector("publish", map);
        await refused(
          { members: map },
          5,
          "current_use_unsupported",
          "configuration.show_config_version.canonical_payload.publication_enabled",
        );
        const compact = configSource(() => undefined, false);
        compactPins(compact);
        await refused(
          { members: compact },
          8,
          "source_identity_mismatch",
          "source[0]",
        );
        compact.set(first(), buffer(original.get(first())));
        compact.set(config(), buffer(original.get(config())));
        await restored(compact);
      } else {
        expect(id(buffer(map.get(config())))).toEqual({
          bytes: 1034,
          sha256:
            "d3844d9305b982e836fd0f85bc9a2aa2391ec74d53a0f2bbf7d2968b6a3ec234",
        });
        await refused(
          { members: map },
          8,
          "source_identity_mismatch",
          "source[4]",
        );
        map.set(config(), buffer(original.get(config())));
        await restored(map);
      }
    },
  );
});

describe("remaining original02H and review10/11 boundary controls", () => {
  it.each([
    "anchor",
    "archive",
    "role",
    "zip_too_large",
    "unknown_parent",
    "zod",
    "member_type",
  ] as const)("original non-JSON %s and complete repair", async (kind) => {
    const map = new Map(original),
      pins = structuredClone(base.pins),
      roles = new Map(base.roles);
    if (kind === "anchor") obj(pins).zipSha256 = "0".repeat(64);
    if (kind === "archive") {
      roles.set(display(members[0]?.member), "archive_source_rows_396");
      map.set(display(members[0]?.member), Buffer.from("{"));
    }
    if (kind === "role") roles.set(display(members[0]?.member), "unknown_role");
    const member = vi.fn((name: string): unknown =>
      kind === "member_type" && name === display(members[5]?.member)
        ? [0]
        : map.get(name),
    );
    const api = await subject({
      open: () => {
        if (kind === "zip_too_large")
          throw new FIE("zip_too_large", "SECRET_SENTINEL");
        if (kind === "unknown_parent")
          throw new FIE("not_known", "SECRET_SENTINEL");
        if (kind === "zod") throw new ZodError([]);
        return {
          pins,
          roles,
          memberNames: [...base.memberNames],
          member,
          json: () => {
            throw new Error("unused");
          },
        };
      },
    });
    if (kind === "unknown_parent") {
      expect(() => api.prepareShowrunnerFixtureInput()).toThrow(
        api.PC2FixtureInputFault,
      );
      try {
        api.prepareShowrunnerFixtureInput();
      } catch (e) {
        expect(obj(e).phase).toBe(1);
        expect(obj(e).message).toBe("PC2 fixture input failed");
      }
    } else {
      const expected =
        kind === "anchor"
          ? rejection(1, "source_anchor_refused", "reader")
          : kind === "archive"
            ? rejection(1, "archival_source_refused", "reader")
            : kind === "role"
              ? rejection(1, "source_role_refused", "reader")
              : kind === "zip_too_large"
                ? rejection(1, "reader_refused", "reader", "zip_too_large")
                : kind === "zod"
                  ? rejection(1, "reader_schema_refused", "reader")
                  : rejection(2, "source_type_invalid", "source[5]");
      expect(api.prepareShowrunnerFixtureInput()).toEqual(expected);
    }
    if (kind !== "member_type") expect(member).not.toHaveBeenCalled();
    if (kind === "archive") {
      await refused({ members: map }, 2, "source_json_invalid", "source[0]");
    }
    await fullPositive();
  });
  it.each(["body_deleted", "body_superseded"] as const)(
    "original necessary %s and raw restoration",
    async (kind) => {
      const map = source((f) => {
        const row = evidence(f, 3);
        if (kind === "body_deleted") delete row.canonical_content;
        else row.supersedes_evidence_unit_id = E(4);
      });
      verifyVector(kind, map);
      await refused(
        { members: map },
        3,
        kind === "body_deleted"
          ? "necessary_source_unavailable"
          : "source_version_unsupported",
        "source.evidence[6]." +
          (kind === "body_deleted"
            ? "canonical_content"
            : "supersedes_evidence_unit_id"),
      );
      const compact = source(() => undefined);
      verifyVector("repair_foundation_compact", compact);
      await refused(
        { members: compact },
        8,
        "source_identity_mismatch",
        "source[0]",
      );
      await fullPositive();
    },
  );
  it.each([
    ["view_unknown_key", "inspection.view"],
    ["claim_type", "inspection.view.claims[0].value.northbridge_goals"],
    ["silent_promotion", "inspection.view.claims[7].consumption"],
    ["registry_target", "registry[1].target_hash"],
    ["registry_evidence", "registry[0].source_content_hash"],
    ["registry_rights", "registry[0].rights_version_id"],
    ["canonical_mismatch", "inspection.canonical_json"],
    ["old_identity_as_domain", "inspection.view_sha256"],
  ] as const)(
    "original returned %s and actual unmocked repair",
    async (kind, field) => {
      const v = clone(EXPECTED_V),
        view = obj(v);
      if (kind === "view_unknown_key") view.unknown = 0;
      if (kind === "claim_type")
        obj(list(view.claims)[0]?.value).northbridge_goals = "2";
      if (kind === "silent_promotion")
        obj(list(view.claims)[7]).consumption = "ordinary_snapshot";
      if (kind === "registry_target")
        obj(list(view.claims)[3]?.snapshot).claim_content_hash = "0".repeat(64);
      if (kind === "registry_evidence")
        obj(list(view.evidence)[2]?.snapshot).content_hash = "0".repeat(64);
      if (kind === "registry_rights")
        obj(list(view.evidence)[2]?.snapshot).rights_version_id =
          "d1250006-0000-4000-8000-000000000001";
      const r = result(v);
      if (kind === "canonical_mismatch")
        r.canonical_json = display(r.canonical_json) + " ";
      if (kind === "old_identity_as_domain")
        r.view_sha256 =
          "afdf2fae6906434829728c2fb240047aa561f2621fb04040cc0307355b96ef7d";
      await refused(
        { returned: r },
        7,
        kind.startsWith("registry_")
          ? "registry_binding_refused"
          : "dependency_result_invalid",
        field,
      );
      await fullPositive();
    },
  );
  it.each([32, 33])(
    "source depth%s boundary retains coarse source diagnostics",
    async (depth) => {
      const map = new Map(original);
      map.set(
        display(members[5]?.member),
        Buffer.from("[".repeat(depth) + "0" + "]".repeat(depth)),
      );
      await refused(
        { members: map },
        depth === 33 ? 2 : 5,
        depth === 33 ? "source_resource_limit" : "configuration_shape_invalid",
        depth === 33 ? "source[5]" : "configuration.episode_mode_registry",
      );
    },
  );
  it.each([4096, 4097])(
    "source array%s cap and deliberately smaller config array surface",
    async (size) => {
      const map = new Map(original);
      map.set(
        display(members[5]?.member),
        Buffer.from(
          JSON.stringify({
            registry_version: "episode-modes-v1",
            values: Array.from({ length: size }, () => 0),
          }),
        ),
      );
      await refused(
        { members: map },
        size === 4097 ? 2 : 5,
        size === 4097 ? "source_resource_limit" : "configuration_shape_invalid",
        size === 4097
          ? "source[5]"
          : "configuration.episode_mode_registry.values",
      );
    },
  );
  it.each([65536, 65537])(
    "source graph nodes%s inclusive/control",
    async (nodes) => {
      const doc: O = Object.fromEntries(
        Array.from({ length: 16 }, (_, i) => [
          "k" + display(i).padStart(2, "0"),
          Array.from({ length: 4094 }, () => 0),
        ]),
      );
      if (nodes === 65536) (doc.k15 as Json[]).pop();
      const map = new Map(original);
      map.set(display(members[5]?.member), Buffer.from(canonicalJson(doc)));
      await refused(
        { members: map },
        nodes === 65537 ? 2 : 5,
        nodes === 65537
          ? "source_resource_limit"
          : "configuration_shape_invalid",
        nodes === 65537
          ? "source[5]"
          : "configuration.episode_mode_registry.registry_version",
      );
    },
  );
  it("ordinary S length repair admits source graph before unsupported configuration version", async () => {
    const map = new Map(original);
    map.set(
      display(members[5]?.member),
      Buffer.from(
        JSON.stringify({ registry_version: "A".repeat(16384), values: [] }),
      ),
    );
    verifyVector("string_control", map);
    await refused(
      { members: map },
      5,
      "configuration_version_unsupported",
      "configuration.episode_mode_registry.registry_version",
    );
  });
  it("structural graph budget precedes a later tag defect and never gets an own accessor", async () => {
    const r = result(),
      view = obj(r.view),
      summary = list(view.support_summaries).find(
        (x) => x.support_kind === "derivation",
      );
    if (!summary) throw new Error("independent derivation literal");
    view.support_summaries = Array.from({ length: 256 }, () => clone(summary));
    const last = obj(list(view.support_summaries)[255]);
    last.support_kind = "not_declared";
    let gets = 0;
    Object.defineProperty(obj(last.inspection), "output", {
      get: () => {
        gets++;
        throw new Error("private");
      },
      enumerable: true,
      configurable: true,
    });
    await refused(
      { returned: r },
      7,
      "dependency_result_invalid",
      "inspection",
    );
    expect(gets).toBe(0);
    const actual = await subject();
    expect(actual.prepareShowrunnerFixtureInput().kind).toBe(
      "source_bound_fixture_candidate",
    );
  });
  it("source bytes are privately copied before later member mutation; own length getter is never acquired", async () => {
    const first = display(members[0]?.member),
      bytes = Buffer.from(buffer(original.get(first)));
    let lengthGets = 0;
    Object.defineProperty(bytes, "length", {
      get: () => {
        lengthGets++;
        throw new Error("length getter");
      },
      configurable: true,
    });
    const api = await subject({
      open: () => ({
        pins: structuredClone(base.pins),
        roles: new Map(base.roles),
        memberNames: [...base.memberNames],
        json: () => null,
        member: (name: string) => {
          if (name === first) return bytes;
          Uint8Array.prototype.fill.call(bytes, 120);
          return original.get(name);
        },
      }),
    });
    const r = api.prepareShowrunnerFixtureInput();
    expect(r.kind).toBe("source_bound_fixture_candidate");
    expect(lengthGets).toBe(0);
    if (r.kind === "source_bound_fixture_candidate") {
      expect(r.data).toEqual(pos());
      expect(id(r.candidate_json)).toEqual({
        bytes: 55418,
        sha256:
          "dfe650e4eae99674fc0868b7d6feb1c89c5e13a5aa62534cd10bd72f974b6a5a",
      });
    }
  });
  it.each(["direct", "reflect"] as const)(
    "constructor %s has independently specified five descriptors for every phase/invalid invocation",
    async (mode) => {
      const api = await subject();
      let gets = 0;
      const hostile = {
        get valueOf() {
          gets++;
          throw new Error("private");
        },
      };
      const Ctor = api.PC2FixtureInputFault as unknown as new (
        ...args: unknown[]
      ) => Error;
      const cases: readonly (readonly [unknown[], number])[] = [
        [[0], 0],
        [[1], 1],
        [[2], 2],
        [[3], 3],
        [[4], 4],
        [[5], 5],
        [[6], 6],
        [[7], 7],
        [[8], 8],
        [[9], 9],
        [[-0], 0],
        [[], 9],
        [[undefined], 9],
        [[null], 9],
        [[false], 9],
        [["0"], 9],
        [[Symbol("0")], 9],
        [[0n], 9],
        [[new Number(0)], 9],
        [[hostile], 9],
        [[0, 0], 9],
        [[-1], 9],
        [[10], 9],
        [[0.5], 9],
        [[Infinity], 9],
        [[-Infinity], 9],
        [[NaN], 9],
        [[{}], 9],
      ];
      for (const [args, phase] of cases) {
        const e =
          mode === "direct"
            ? new Ctor(...args)
            : (Reflect.construct(
                api.PC2FixtureInputFault,
                args,
                api.PC2FixtureInputFault,
              ) as Error);
        const descriptor = (value: unknown, enumerable: boolean) => ({
          value,
          enumerable,
          writable: false,
          configurable: false,
        });
        expect(Object.getOwnPropertyDescriptors(e)).toEqual({
          name: descriptor("PC2FixtureInputFault", false),
          message: descriptor("PC2 fixture input failed", false),
          stack: descriptor(
            "PC2FixtureInputFault: PC2 fixture input failed",
            false,
          ),
          code: descriptor("unexpected_failure", true),
          phase: descriptor(phase, true),
        });
        expect(Object.getOwnPropertySymbols(e)).toEqual([]);
        expect(Object.isFrozen(e)).toBe(true);
        expect(Object.is(obj(e).phase, -0)).toBe(false);
      }
      expect(gets).toBe(0);
      expect(api.observed).not.toHaveBeenCalled();
    },
  );
});

describe("RESOURCE17/18 independent candidate arithmetic, repairs and finalization fence", () => {
  it.each([17, 18])(
    "RESOURCE%s independently pins logical DATA and the complete repaired control",
    async (pad) => {
      const selected = obj(
        obj(EXPECTED_M.programming_configuration).show_config_version,
      ).show_config_version_id;
      const map = source((f) => {
        const row = obj(
          list(obj(f.tables).show_config_versions).find(
            (r) => r.show_config_version_id === selected,
          ),
        );
        obj(row.canonical_payload).name = "N".repeat(16384);
        row.config_hash = showConfigVersionHash(row);
      });
      const f = obj(
          JSON.parse(
            buffer(map.get(display(members[0]?.member))).toString(),
          ) as Json,
        ),
        config = obj(
          list(obj(f.tables).show_config_versions).find(
            (r) => r.show_config_version_id === selected,
          ),
        );
      map.set(display(members[4]?.member), Buffer.from(canonicalJson(config)));
      const v = clone(EXPECTED_V),
        view = obj(v),
        claims = list(view.claims),
        baseClaim = obj(claims[0]);
      const extras: O[] = [];
      for (let i = 1; i <= 118; i++) {
        const cl = obj(clone(baseClaim)),
          snap = obj(cl.snapshot);
        snap.claim_id =
          "d1250018-0000-4000-8000-" + display(i).padStart(12, "0");
        snap.subject_ref = "S".repeat(16384);
        snap.support_refs = [];
        extras.push(cl);
        claims.push(cl);
      }
      obj(list(view.source_attribution)[0]).display_name =
        display(list(view.source_attribution)[0]?.display_name) +
        "D".repeat(pad);
      const returned = result(v),
        p = obj(clone(EXPECTED_P)),
        m = obj(clone(EXPECTED_M));
      (p.claims as Json[]).push(
        ...extras.map((e) => ({ ...e, statement: null })),
      );
      p.source_attribution = clone(view.source_attribution);
      obj(m.programming_configuration).show_config_version = clone(config);
      const selectedMembers = list(obj(m.fixture_binding).selected_members);
      for (const index of [0, 4])
        Object.assign(
          obj(selectedMembers[index]),
          id(buffer(map.get(display(members[index]?.member)))),
        );
      const inspection = obj(m.inspection_dependency);
      inspection.view_canonical_identity = id(canonicalJson(v));
      inspection.view_domain_sha256 = returned.view_sha256 ?? null;
      const expectedData = { ...m, planner_data: p };
      expect(id(canonicalJson(expectedData))).toEqual(
        pad === 17
          ? {
              bytes: 2097152,
              sha256:
                "3761d392f27aa22c2e197735fbed451b6dc0169780b0d6eba236a201bb324840",
            }
          : {
              bytes: 2097153,
              sha256:
                "24c4bd961bd52960ee74fd231bf59be21a8cfc3e019a2cadb0cd22ccefb3f9e9",
            },
      );
      const observed = await finalizationObserver({ members: map, returned }),
        api = observed.api;
      expect(api.prepareShowrunnerFixtureInput()).toEqual(
        pad === 17
          ? rejection(8, "source_identity_mismatch", "source[0]")
          : rejection(
              7,
              "candidate_resource_limit",
              "candidate.canonical_json",
            ),
      );
      expect(observed.counts).toEqual({ copy: 0, canonical: 0, hash: 0 });
      vi.restoreAllMocks();
      vi.doUnmock("../../src/identity/canonical-json.js");
      vi.doUnmock("node:crypto");
      const originalMeta = obj(clone(EXPECTED_M));
      obj(originalMeta.inspection_dependency).view_canonical_identity = id(
        canonicalJson(v),
      );
      obj(originalMeta.inspection_dependency).view_domain_sha256 =
        returned.view_sha256 ?? null;
      if (pad === 17)
        expect(id(canonicalJson({ ...originalMeta, planner_data: p }))).toEqual(
          {
            bytes: 2080789,
            sha256:
              "9fbed521ee2d2e6eb663846300b8ee1c337c18aedbdba12122997dd3afd459ea",
          },
        );
      await refused(
        { returned },
        8,
        "dependency_identity_mismatch",
        "inspection",
      );
      await fullPositive();
    },
  );
  it("positive ownership is per occurrence, not only a frozen top-level object", async () => {
    const api = await subject(),
      r = api.prepareShowrunnerFixtureInput();
    if (r.kind !== "source_bound_fixture_candidate")
      throw new Error("positive refused");
    const first = r.data.representation_registry[0],
      second = r.data.representation_registry[2];
    expect(first.attribution_requirement).not.toBe(
      second.attribution_requirement,
    );
    const firstExposure =
        r.data.planner_data.evidence[2].snapshot.consumer_exposure,
      secondExposure =
        r.data.planner_data.evidence[3].snapshot.consumer_exposure;
    expect(firstExposure).not.toBe(secondExposure);
    expect(Object.isFrozen(firstExposure)).toBe(true);
    expect(() =>
      Object.defineProperty(firstExposure, "planner", { value: "hidden" }),
    ).toThrow(TypeError);
    const again = api.prepareShowrunnerFixtureInput();
    expect(again).toEqual(r);
    if (again.kind === "source_bound_fixture_candidate")
      expect(
        again.data.planner_data.evidence[2].snapshot.consumer_exposure,
      ).not.toBe(firstExposure);
  });
});

const PROFILE = "showrunner-fixture-input-candidate/1";
describe("renewal23 source18 admission and complete repairs", () => {
  it("original oversize_and_utf8 removes leading x before UTF8 and complete RAW restoration", async () => {
    const member = display(members[5]?.member),
      map = new Map(original),
      bad = Buffer.concat([Buffer.alloc(1048576, "x"), Buffer.from([255])]);
    expect(id(bad)).toEqual({
      bytes: 1048577,
      sha256:
        "06ebeb54465169e50636b63f4556a7b7e185b64e962e4f95e9e2fc42a330fda4",
    });
    map.set(member, bad);
    await refused({ members: map }, 2, "source_resource_limit", "source[5]");
    const repaired = Buffer.from(bad.subarray(1048576));
    expect(id(repaired)).toEqual({
      bytes: 1,
      sha256:
        "a8100ae6aa1940d0b663bb31cd466142ebbdbd5187131b92d93818987832eb89",
    });
    map.set(member, repaired);
    await refused({ members: map }, 2, "source_utf8_invalid", "source[5]");
    map.set(member, buffer(original.get(member)));
    await fullPositive({ members: map });
  });
  const vectors = [
    [
      3,
      "policy_null",
      "source[3]",
      "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b",
    ],
    [
      3,
      "policy_scalar",
      "source[3]",
      "5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9",
    ],
    [
      3,
      "policies_null",
      "source[3]",
      "947f4735285721e40226ef271f33ebbaa9d3dcc858ce4e04326edae90ddd5412",
    ],
    [
      3,
      "policy_entry_scalar",
      "source[3]",
      "665b1ba68650988fabd01bc698be3da098f5b05206c98594cb2fa469747151ee",
    ],
    [
      3,
      "policy_digest_scalar",
      "source[3]",
      "33a30e189b254c1bd4e708cfeff311961ae0f8118cfb141c6fabb0303ec7d8e1",
    ],
    [
      2,
      "support_null",
      "source[2]",
      "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b",
    ],
    [
      2,
      "wrapper_missing",
      "source[2]",
      "813671031878947ba9c396f145e4df6c1b733a209a58b38725c8339820b65c2a",
    ],
    [
      2,
      "wrapper_extra",
      "source[2]",
      "fb238051bd09bd7ce01cf352d14f1662d4aaa1226d2c775a9eb829eff3caf695",
    ],
    [
      2,
      "carrier_unresolved",
      "source[2][0].artifact_id",
      "db45256784f7aebdf655375b51def6535943dfe721999f349116fc25df7480fe",
    ],
    [
      2,
      "artifacts_object",
      "source[2]",
      "a1f702d2dc9030e36c1ac7b293f12cbec8d57abaa1ec83e23b488d29b763508b",
    ],
    [
      2,
      "derivation_scalar",
      "source[2]",
      "db684ed2b55ddf772c7752ad7480f27fa5c3baa9c62297d8d8df10eedfddda52",
    ],
    [
      2,
      "carrier_null",
      "source[2][0]",
      "6eaef4f3ef6106579e27a0c6f0f2f2f935b4120ab232b8ac8f38e403d29d048f",
    ],
    [
      2,
      "carrier_payload_scalar",
      "source[2][0].canonical_payload",
      "ac864df40bfec0d59bdd7b4c489ce294453d3d9c6fa92f95d6434fa2714deca3",
    ],
    [
      2,
      "carrier_confidence_scalar",
      "source[2][0].canonical_payload.projection.authored_synthetic_interpretation.confidence",
      "227cce3287e4b9170097642e84a110d24019c0f1a31baff89b0bd73783134982",
    ],
  ] as const;
  it.each(vectors)(
    "selected source%s %s uses independent DATA before helpers/hash",
    async (index, name, field, digest) => {
      const member = display(members[index]?.member),
        doc = obj(JSON.parse(buffer(original.get(member)).toString()) as Json);
      let specimen: Json = doc;
      if (name === "policy_null" || name === "support_null") specimen = null;
      if (name === "policy_scalar") specimen = 0;
      if (name === "policies_null") doc.policies = null;
      if (name === "policy_entry_scalar") obj(doc.policies).claims_policy = 0;
      if (name === "policy_digest_scalar")
        obj(obj(doc.policies).claims_policy).source_sha256 = 0;
      if (name === "wrapper_missing") delete doc.artifacts;
      if (name === "wrapper_extra") doc.unknown_wrapper = "PRIVATE_SENTINEL";
      if (name === "carrier_unresolved")
        obj(list(doc.artifacts)[0]).artifact_id =
          "d1250005-0000-4000-8000-000000000099";
      if (name === "artifacts_object") doc.artifacts = {};
      if (name === "derivation_scalar") doc.derivation_run_ref = 0;
      if (name === "carrier_null") {
        if (!Array.isArray(doc.artifacts))
          throw new Error("independent artifacts array");
        doc.artifacts[0] = null;
      }
      if (name === "carrier_payload_scalar")
        obj(list(doc.artifacts)[0]).canonical_payload = 0;
      if (name === "carrier_confidence_scalar")
        obj(
          obj(obj(list(doc.artifacts)[0]?.canonical_payload).projection)
            .authored_synthetic_interpretation,
        ).confidence = 0;
      const map = new Map(original),
        bytes = Buffer.from(JSON.stringify(specimen));
      map.set(member, bytes);
      expect(sha(bytes)).toBe(digest);
      await refused({ members: map }, 3, "source_record_invalid", field);
      map.set(member, buffer(original.get(member)));
      await fullPositive({ members: map });
    },
  );
  it.each(["necessary", "row_columns"] as const)(
    "earlier %s precedes both malformed wrappers through each RAW repair",
    async (defect) => {
      const map = source((f) => {
        if (defect === "necessary") evidence(f, 3).canonical_content = null;
        else obj(list(obj(f.tables).accounts)[0]).unknown = 0;
      });
      if (defect === "necessary") verifyVector("body_null", map);
      else verifyVector("row_columns", map);
      map.set(display(members[2]?.member), Buffer.from("null"));
      map.set(display(members[3]?.member), Buffer.from("null"));
      await refused(
        { members: map },
        3,
        defect === "necessary"
          ? "necessary_source_unavailable"
          : "reader_refused",
        defect === "necessary"
          ? "source.evidence[6].canonical_content"
          : "source[0]",
        defect === "necessary" ? null : "row_columns_mismatch",
      );
      map.set(
        display(members[0]?.member),
        buffer(original.get(display(members[0]?.member))),
      );
      await refused({ members: map }, 3, "source_record_invalid", "source[2]");
      map.set(
        display(members[2]?.member),
        buffer(original.get(display(members[2]?.member))),
      );
      await refused({ members: map }, 3, "source_record_invalid", "source[3]");
      map.set(
        display(members[3]?.member),
        buffer(original.get(display(members[3]?.member))),
      );
      await fullPositive({ members: map });
    },
  );
  it("aligned invalid carrier payload must be admitted before its domain helper", async () => {
    const map = source((f) => {
      obj(
        list(obj(f.tables).artifacts).find(
          (x) => x.artifact_id === "d1250005-0000-4000-8000-000000000017",
        ),
      ).canonical_payload = 0;
    });
    const member = display(members[2]?.member),
      support = obj(
        JSON.parse(buffer(original.get(member)).toString()) as Json,
      );
    obj(list(support.artifacts)[0]).canonical_payload = 0;
    map.set(member, Buffer.from(JSON.stringify(support)));
    let invalidHashes = 0;
    vi.doMock("../../src/identity/knowledge.js", async () => {
      const actual = await vi.importActual<
        typeof import("../../src/identity/knowledge.js")
      >("../../src/identity/knowledge.js");
      return {
        ...actual,
        fixtureSupportObjectHash: (value: unknown) => {
          if (value === 0) invalidHashes++;
          return actual.fixtureSupportObjectHash(value);
        },
      };
    });
    await refused(
      { members: map },
      3,
      "source_record_invalid",
      "source[2][0].canonical_payload",
    );
    expect(invalidHashes).toBe(0);
    map.set(member, buffer(original.get(member)));
    await refused({ members: map }, 3, "source_record_invalid", "source[2][0]");
    map.set(
      display(members[0]?.member),
      buffer(original.get(display(members[0]?.member))),
    );
    await fullPositive({ members: map });
  });
  it("carrier structure precedes a primitive-string invalid derivation UUID through repairs", async () => {
    const name = display(members[2]?.member),
      support = obj(JSON.parse(buffer(original.get(name)).toString()) as Json),
      map = new Map(original);
    support.derivation_run_ref = "not-a-uuid";
    obj(list(support.artifacts)[0]).canonical_payload = 0;
    map.set(name, Buffer.from(JSON.stringify(support)));
    await refused(
      { members: map },
      3,
      "source_record_invalid",
      "source[2][0].canonical_payload",
    );
    const raw = obj(JSON.parse(buffer(original.get(name)).toString()) as Json);
    support.artifacts = raw.artifacts ?? null;
    map.set(name, Buffer.from(JSON.stringify(support)));
    await refused({ members: map }, 3, "source_record_invalid", "source[2]");
    map.set(name, buffer(original.get(name)));
    await fullPositive({ members: map });
  });
});
describe("renewal17 independently declared priority and repair controls", () => {
  it("missing profile precedes a symbol extra; each repair stays in the declared diagnostic language", async () => {
    const r = result();
    delete r.profile;
    const symbol = Symbol("private sentinel");
    let getters = 0;
    Object.defineProperty(r, symbol, {
      get: () => {
        getters++;
        throw new Error("private symbol");
      },
      configurable: true,
    });
    const invoke = async (field: string) => {
      const api = await subject({ returned: r }),
        rejection = api.prepareShowrunnerFixtureInput();
      expect(rejection).toEqual({
        kind: "rejected",
        profile: PROFILE,
        phase: 7,
        code: "dependency_result_invalid",
        field,
        reader_code: null,
        dependency: null,
      });
      expect(JSON.stringify(rejection)).not.toContain("private sentinel");
    };
    await invoke("inspection.profile");
    r.profile = "planner-fixture-consumer-snapshot/1";
    await invoke("inspection");
    expect(getters).toBe(0);
    Reflect.deleteProperty(r, symbol);
    const api = await subject();
    expect(api.prepareShowrunnerFixtureInput()).toMatchObject({
      kind: "source_bound_fixture_candidate",
      identity: {
        utf8_bytes: "55418",
        sha256:
          "dfe650e4eae99674fc0868b7d6feb1c89c5e13a5aa62534cd10bd72f974b6a5a",
      },
    });
  });
  it("every present extra scoreline support resolves at a compiled leaf before the narrow empty-array rule", async () => {
    const v = clone(EXPECTED_V),
      claims = list(obj(v).claims),
      extra = obj(clone(claims[0])),
      snap = obj(extra.snapshot);
    snap.claim_id = "d1250018-0000-4000-8000-000000000001";
    const ref = obj(list(snap.support_refs)[0]);
    ref.evidence_unit_id = E(99);
    claims.push(extra);
    await refused(
      { returned: result(v) },
      7,
      "dependency_result_invalid",
      "inspection.view.claims[9].snapshot.support_refs[0].evidence_unit_id",
    );
    ref.evidence_unit_id = E(1);
    await refused(
      { returned: result(v) },
      7,
      "dependency_result_invalid",
      "inspection.view.claims[9].snapshot.support_refs",
    );
    ref.claim_support_id = "d125000a-0000-4000-8000-000000000099";
    await refused(
      { returned: result(v) },
      7,
      "dependency_result_invalid",
      "inspection.view.claims[9].snapshot.support_refs[0].claim_support_id",
    );
    ref.claim_support_id = "d125000a-0000-4000-8000-000000000001";
    ref.support_hash = "0".repeat(64);
    await refused(
      { returned: result(v) },
      7,
      "dependency_result_invalid",
      "inspection.view.claims[9].snapshot.support_refs[0].support_hash",
    );
    snap.support_refs = [];
    await refused(
      { returned: result(v) },
      8,
      "dependency_identity_mismatch",
      "inspection",
    );
    const api = await subject();
    expect(api.prepareShowrunnerFixtureInput().kind).toBe(
      "source_bound_fixture_candidate",
    );
  });
  it("known repeated profiles check index2 then index10 versions before finite cardinality binding", async () => {
    const name = display(members[7]?.member),
      data = obj(JSON.parse(buffer(original.get(name)).toString()) as Json),
      first = clone(list(data.profiles)[0]);
    data.profiles = Array.from({ length: 11 }, () => clone(first));
    const profiles = list(data.profiles),
      map = new Map(original),
      save = () => {
        map.set(name, Buffer.from(JSON.stringify(data)));
      };
    obj(profiles[2]).character_bible_version = "unsupported_2";
    obj(profiles[10]).character_bible_version = "unsupported_10";
    save();
    await refused(
      { members: map },
      5,
      "configuration_version_unsupported",
      "configuration.participant_profiles.profiles[2].character_bible_version",
    );
    obj(profiles[2]).character_bible_version = "0.1.4";
    save();
    await refused(
      { members: map },
      5,
      "configuration_version_unsupported",
      "configuration.participant_profiles.profiles[10].character_bible_version",
    );
    obj(profiles[10]).character_bible_version = "0.1.4";
    save();
    await refused(
      { members: map },
      5,
      "configuration_binding_refused",
      "configuration.participant_profiles.profiles",
    );
    const api = await subject();
    expect(api.prepareShowrunnerFixtureInput().kind).toBe(
      "source_bound_fixture_candidate",
    );
  });
  it.each([
    "00",
    "01",
    "+1",
    "-0",
    "1.0",
    "1e0",
    "2097153",
    "10000000",
    "9".repeat(128),
  ] as const)(
    "unsigned observation %s is rejected lexically without coercion, then repaired",
    async (value) => {
      const r = result();
      obj(r.observation).input_utf8_bytes = value;
      let conversions = 0;
      const convert = Number;
      const spy = vi
        .spyOn(globalThis, "Number")
        .mockImplementation((input?: unknown) => {
          // "00" also occurs in unchanged owner timestamps. This observer
          // scopes conversion to the NEW public-atom call chain only.
          if (
            input === value &&
            (new Error().stack ?? "").includes("publicAtoms")
          )
            conversions++;
          return convert(input);
        });
      for (const key of Reflect.ownKeys(convert)) {
        if (["length", "name", "prototype"].includes(String(key))) continue;
        const d = Object.getOwnPropertyDescriptor(convert, key);
        if (d) Object.defineProperty(spy, key, d);
      }
      await refused(
        { returned: r },
        7,
        "dependency_result_invalid",
        "inspection.observation.input_utf8_bytes",
      );
      expect(conversions).toBe(0);
      vi.restoreAllMocks();
      const api = await subject();
      expect(api.prepareShowrunnerFixtureInput().kind).toBe(
        "source_bound_fixture_candidate",
      );
    },
  );
  it.each(["0", "2097152"] as const)(
    "inclusive lexical observation %s reaches its observation binding, then repaired",
    async (value) => {
      const r = result();
      obj(r.observation).input_utf8_bytes = value;
      await refused(
        { returned: r },
        7,
        "dependency_result_invalid",
        "inspection.observation.input_utf8_bytes",
      );
      const api = await subject();
      expect(api.prepareShowrunnerFixtureInput().kind).toBe(
        "source_bound_fixture_candidate",
      );
    },
  );
  it("union-prefix admission stops before a late locator probe or later tag/getter defect", async () => {
    const v = clone(EXPECTED_V),
      view = obj(v),
      claims = list(view.claims),
      evidenceRows = list(view.evidence),
      first = obj(claims[0]);
    for (let i = 1; i <= 247; i++) {
      const extra = obj(clone(first)),
        snap = obj(extra.snapshot);
      snap.claim_id = "d1250018-0000-4000-8000-" + display(i).padStart(12, "0");
      snap.support_refs = [];
      claims.push(extra);
    }
    const originalRef = clone(list(obj(first.snapshot).support_refs)[0]);
    obj(first.snapshot).support_refs = Array.from({ length: 101 }, () =>
      clone(originalRef),
    );
    while (evidenceRows.length < 256)
      evidenceRows.push(obj(clone(evidenceRows[0])));
    const r = result(v),
      lateLocator = obj(obj(evidenceRows[255]?.snapshot).locator);
    const last = obj(list(view.support_summaries)[8]);
    last.support_kind = "not_declared";
    let getterCalls = 0;
    Object.defineProperty(last, "inspection", {
      enumerable: true,
      configurable: true,
      get: () => {
        getterCalls++;
        throw new Error("private");
      },
    });
    let lateProbes = 0;
    const descriptor = Object.getOwnPropertyDescriptor;
    vi.spyOn(Object, "getOwnPropertyDescriptor").mockImplementation(
      (object: unknown, key: PropertyKey) => {
        if (object === lateLocator && key === "member") lateProbes++;
        return descriptor(object, key);
      },
    );
    await refused(
      { returned: r },
      7,
      "dependency_result_invalid",
      "inspection",
    );
    expect(lateProbes).toBe(0);
    expect(getterCalls).toBe(0);
    vi.restoreAllMocks();
    const repaired = result(),
      summary = obj(list(obj(repaired.view).support_summaries)[8]);
    summary.support_kind = "not_declared";
    await refused(
      { returned: repaired },
      7,
      "dependency_result_invalid",
      "inspection.view.support_summaries[8].support_kind",
    );
    const api = await subject();
    expect(api.prepareShowrunnerFixtureInput().kind).toBe(
      "source_bound_fixture_candidate",
    );
  });
  it.each(["observe", "copy", "canonical", "hash"] as const)(
    "actual positive finalization %s delegates or fails only at sanitized phase8",
    async (block) => {
      const observed = await finalizationObserver(
        {},
        block === "observe" ? undefined : block,
      );
      if (block === "observe") {
        const r = observed.api.prepareShowrunnerFixtureInput();
        expect(r).toMatchObject({
          kind: "source_bound_fixture_candidate",
          identity: {
            utf8_bytes: "55418",
            sha256:
              "dfe650e4eae99674fc0868b7d6feb1c89c5e13a5aa62534cd10bd72f974b6a5a",
          },
        });
        expect(observed.counts.copy).toBeGreaterThan(0);
        expect(observed.counts.canonical).toBeGreaterThan(0);
        expect(observed.counts.hash).toBe(1);
      } else {
        expect(() => observed.api.prepareShowrunnerFixtureInput()).toThrow(
          observed.api.PC2FixtureInputFault,
        );
        try {
          observed.api.prepareShowrunnerFixtureInput();
        } catch (e) {
          expect(obj(e).phase).toBe(8);
          expect(obj(e).message).toBe("PC2 fixture input failed");
          expect(Object.hasOwn(obj(e), "cause")).toBe(false);
        }
        expect(observed.counts[block]).toBeGreaterThan(0);
        if (block === "copy") {
          expect(observed.counts.canonical).toBe(0);
          expect(observed.counts.hash).toBe(0);
        }
        if (block === "canonical") expect(observed.counts.hash).toBe(0);
      }
    },
  );
});
const members = list(obj(EXPECTED_M.fixture_binding).selected_members);
let base: Pack;
let original: Map<string, Buffer>;
beforeAll(() => {
  base = openFixturePack();
  original = new Map(
    members.map((r) => [
      display(r.member),
      Buffer.from(base.member(display(r.member))),
    ]),
  );
});
afterEach(() => {
  vi.doUnmock("../../src/fixture/pack.js");
  vi.doUnmock("../../src/runtime/planner-fixture-consumer-snapshot.js");
  vi.doUnmock("../../src/identity/canonical-json.js");
  vi.doUnmock("node:crypto");
  vi.doUnmock("../../src/identity/knowledge.js");
  vi.restoreAllMocks();
  vi.resetModules();
});
interface Options {
  members?: Map<string, Buffer>;
  returned?: unknown;
  open?: () => unknown;
  member?: (name: string) => Buffer;
}
async function finalizationObserver(
  options: Options,
  block?: "copy" | "canonical" | "hash",
) {
  const counts = { copy: 0, canonical: 0, hash: 0 };
  const candidateText = (value: unknown) =>
    typeof value === "string" &&
    value.startsWith('{"assurance":') &&
    value.includes('"planner_data":');
  vi.doMock("node:crypto", async () => {
    const actual =
      await vi.importActual<typeof import("node:crypto")>("node:crypto");
    return {
      ...actual,
      createHash: (...args: Parameters<typeof actual.createHash>) => {
        const hash = actual.createHash(...args),
          update = hash.update.bind(hash);
        vi.spyOn(hash, "update").mockImplementation(
          (...values: Parameters<typeof hash.update>) => {
            if (candidateText(values[0])) {
              counts.hash++;
              if (block === "hash") throw new Error("private hash sentinel");
            }
            return update(...values);
          },
        );
        return hash;
      },
    };
  });
  vi.doMock("../../src/identity/canonical-json.js", async () => {
    const actual = await vi.importActual<
      typeof import("../../src/identity/canonical-json.js")
    >("../../src/identity/canonical-json.js");
    return {
      ...actual,
      canonicalJson: (value: unknown) => {
        if (
          value !== null &&
          typeof value === "object" &&
          Object.hasOwn(value, "planner_data")
        ) {
          counts.canonical++;
          if (block === "canonical")
            throw new Error("private canonical sentinel");
        }
        return actual.canonicalJson(value);
      },
    };
  });
  const api = await subject(options),
    fromEntries = Object.fromEntries;
  vi.spyOn(Object, "fromEntries").mockImplementation(
    (entries: Iterable<readonly unknown[]>) => {
      const pairs = Array.from(entries);
      if (pairs.some((pair) => pair[0] === "planner_data")) {
        counts.copy++;
        if (block === "copy") throw new Error("private copy sentinel");
      }
      return Reflect.apply(fromEntries, Object, [pairs]) as Record<
        PropertyKey,
        unknown
      >;
    },
  );
  return { api, counts };
}
async function subject(options: Options = {}) {
  vi.doUnmock("../../src/runtime/planner-fixture-consumer-snapshot.js");
  vi.resetModules();
  const observed = vi.fn(() =>
    options.open
      ? options.open()
      : {
          pins: structuredClone(base.pins),
          roles: new Map(base.roles),
          memberNames: [...base.memberNames],
          member: (name: string) =>
            options.member
              ? options.member(name)
              : Buffer.from(
                  options.members?.get(name) ??
                    original.get(name) ??
                    base.member(name),
                ),
          json: () => {
            throw new Error("Pack.json must not be called");
          },
        },
  );
  vi.doMock("../../src/fixture/pack.js", () => ({
    openFixturePack: observed,
    FixtureIntegrityError: FIE,
  }));
  if (Object.hasOwn(options, "returned"))
    vi.doMock("../../src/runtime/planner-fixture-consumer-snapshot.js", () => ({
      materializePlannerFixtureConsumerSnapshot: vi.fn(() => options.returned),
    }));
  const api = await import("../../src/runtime/planner-fixture-input.js");
  return { ...api, observed };
}
async function fullPositive(options: Options = {}) {
  const api = await subject(options),
    actual = api.prepareShowrunnerFixtureInput();
  expect(actual).toEqual({
    kind: "source_bound_fixture_candidate",
    profile: PROFILE,
    data: pos(),
    candidate_json: canonicalJson(pos()),
    identity: {
      utf8_bytes: "55418",
      sha256:
        "dfe650e4eae99674fc0868b7d6feb1c89c5e13a5aa62534cd10bd72f974b6a5a",
    },
  });
}
function result(view: Json = clone(EXPECTED_V)): O {
  const dep = obj(EXPECTED_M.inspection_dependency),
    input = obj(dep.input_identity),
    pkg = obj(dep.package_text_identity);
  return {
    kind: "materialized_candidate",
    profile: "planner-fixture-consumer-snapshot/1",
    observation: {
      input_utf8_bytes: display(input.bytes),
      input_sha256: input.sha256 ?? null,
      package_text_utf8_bytes: display(pkg.bytes),
      package_text_sha256: pkg.sha256 ?? null,
    },
    view,
    canonical_json: canonicalJson(view),
    view_sha256: domainHash("planner-fixture-consumer-snapshot-v1", view),
  };
}
function rejection(
  phase: number,
  code: string,
  field: string,
  reader_code: string | null = null,
  dependency: Json = null,
): O {
  return {
    kind: "rejected",
    profile: PROFILE,
    phase,
    code,
    field,
    reader_code,
    dependency,
  };
}
async function refused(
  options: Options,
  phase: number,
  code: string,
  field: string,
  reader_code: string | null = null,
  dependency: Json = null,
) {
  const api = await subject(options),
    r = api.prepareShowrunnerFixtureInput();
  expect(r).toEqual(rejection(phase, code, field, reader_code, dependency));
  expect(api.observed).toHaveBeenCalledTimes(1);
  expect(Object.isFrozen(r)).toBe(true);
}
async function fault(options: Options, phase: PC2FaultPhase) {
  const api = await subject(options);
  try {
    api.prepareShowrunnerFixtureInput();
    throw new Error("expected sanitized fault");
  } catch (e) {
    expect(e).toBeInstanceOf(api.PC2FixtureInputFault);
    expect(Object.getOwnPropertyNames(e).sort()).toEqual([
      "code",
      "message",
      "name",
      "phase",
      "stack",
    ]);
    expect(obj(e).phase).toBe(phase);
    expect(obj(e).message).toBe("PC2 fixture input failed");
    expect(Object.isFrozen(e)).toBe(true);
  }
}
function source(change: (f: O) => void): Map<string, Buffer> {
  const map = new Map(original),
    f = obj(
      JSON.parse(
        (
          original.get(display(members[0]?.member)) ?? Buffer.alloc(0)
        ).toString(),
      ) as Json,
    );
  change(f);
  map.set(display(members[0]?.member), Buffer.from(JSON.stringify(f)));
  return map;
}
const E = (n: number) =>
  "d1250007-0000-4000-8000-" + display(n).padStart(12, "0");
const evidence = (f: O, n: number) =>
  obj(
    list(obj(f.tables).evidence_units).find((x) => x.evidence_unit_id === E(n)),
  );
const pos = () => ({ ...EXPECTED_M, planner_data: EXPECTED_P });
describe("PC2 fixed fixture DATA boundary", () => {
  it("matches complete independently specified P, M, registry, source meanings and raw identity", async () => {
    const api = await subject(),
      r = api.prepareShowrunnerFixtureInput();
    expect(r.kind).toBe("source_bound_fixture_candidate");
    if (r.kind !== "source_bound_fixture_candidate")
      throw new Error("positive refused");
    expect(r.data).toEqual(pos());
    expect(id(canonicalJson(r.data.planner_data))).toEqual({
      bytes: 37613,
      sha256:
        "ef0de4ab53385150be0e00a535a5c0f7c5180a7040870e3f85c5a1d90ab82083",
    });
    const { planner_data, ...m } = r.data;
    expect("support_summaries" in planner_data).toBe(false);
    expect(id(canonicalJson(m))).toEqual({
      bytes: 17789,
      sha256:
        "c4c08bd5621a49974907b03d9e4725fe3fc284cb4fdd83f08a5ecf67edcb113b",
    });
    expect(id(r.candidate_json)).toEqual({
      bytes: 55418,
      sha256:
        "dfe650e4eae99674fc0868b7d6feb1c89c5e13a5aa62534cd10bd72f974b6a5a",
    });
    expect(id(canonicalJson(r.data.representation_registry))).toEqual({
      bytes: 7279,
      sha256:
        "5ba97aba228734351fefb3072e987c7526c1cec2649def874579f63764b5ede2",
    });
    expect(Object.keys(SOURCE_LITERALS)).toHaveLength(10);
    expect(api.observed).toHaveBeenCalledExactlyOnceWith();
    const again = api.prepareShowrunnerFixtureInput();
    expect(again).toEqual(r);
    expect(again).not.toBe(r);
    if (again.kind === "source_bound_fixture_candidate") {
      expect(again.data).not.toBe(r.data);
      expect(again.data.planner_data.claims[0]).not.toBe(
        r.data.planner_data.claims[0],
      );
    }
    const walk = (x: unknown) => {
      if (x !== null && typeof x === "object") {
        expect(Object.isFrozen(x)).toBe(true);
        Object.values(x).forEach(walk);
      }
    };
    walk(r);
  });
  it("rejects arguments before I/O", async () => {
    const api = await subject();
    expect(
      Reflect.apply(api.prepareShowrunnerFixtureInput, undefined, [undefined]),
    ).toEqual(rejection(0, "arguments_not_allowed", "arguments"));
    expect(api.observed).not.toHaveBeenCalled();
  });
  it("does not acquire parent kind through a getter, or array elements through getters", async () => {
    let gets = 0;
    const bad = result();
    Object.defineProperty(bad, "kind", {
      get: () => {
        gets++;
        throw new Error("private");
      },
      enumerable: true,
    });
    await refused(
      { returned: bad },
      7,
      "dependency_result_invalid",
      "inspection",
    );
    expect(gets).toBe(0);
    const v = clone(EXPECTED_V),
      rows = list(obj(v).claims);
    Object.defineProperty(rows, "0", {
      get: () => {
        gets++;
        throw new Error("private");
      },
      enumerable: true,
      configurable: true,
    });
    const r = result();
    r.view = v;
    await refused(
      { returned: r },
      7,
      "dependency_result_invalid",
      "inspection.view.claims",
    );
    expect(gets).toBe(0);
  });
  it("sanitizes unexpected member/copy/digest faults at phase2, open faults at1", async () => {
    await fault(
      {
        open: () => {
          throw new Error("private path");
        },
      },
      1,
    );
    await fault(
      {
        member: () => {
          throw new Error("private");
        },
      },
      2,
    );
    await refused(
      {
        member: () => {
          throw new FIE("unknown_member", "secret");
        },
      },
      2,
      "reader_refused",
      "source[0]",
      "unknown_member",
    );
    await fault(
      {
        member: () => {
          throw new FIE("zip_too_large", "secret");
        },
      },
      2,
    );
  });
  it("handles malformed/null returns without property access", async () => {
    await refused(
      { returned: null },
      7,
      "dependency_result_invalid",
      "inspection",
    );
    await fault(
      {
        returned: {
          kind: "rejected",
          profile: "planner-fixture-consumer-snapshot/1",
          code: "input_type_invalid",
          field: "input",
          parser_code: null,
          detail: "secret",
        },
      },
      6,
    );
  });
  it.each([
    [
      "tag_unknown_hash_type",
      "not_declared",
      0,
      false,
      131916,
      "14b8a7dc144ae65540485fa4ee107f23a52a947c41714783023fa744785cfcce",
      "value_type",
    ],
    [
      "tag_unknown_hash_lex",
      "not_declared",
      "g".repeat(64),
      false,
      132048,
      "e3e7f9042dc9b562b5041b90c392c0bf1e8db87ae4ec36e71f33c8ade22cb633",
      "value_type",
    ],
    [
      "tag_known_hash_lex",
      "structured_text",
      "g".repeat(64),
      false,
      132054,
      "367a67428e6974bd015bcfcdfd7255eb5a879b8c858cff8b6f4b438630032c0d",
      "claim_content_hash",
    ],
    [
      "tag_unknown_missingid",
      "not_declared",
      "f".repeat(64),
      true,
      131944,
      "00f92e4008fbb4fd1db85880545ffb11e8b56fdf2c617cf899aa39285ffed473",
      "claim_id",
    ],
  ] as const)(
    "%s discriminates tag/common-surface/hash priorities",
    async (_name, tag, hash, missing, bytes, digest, field) => {
      const v = clone(EXPECTED_V),
        snap = obj(list(obj(v).claims)[2]?.snapshot);
      snap.value_type = tag;
      if (missing) delete snap.claim_id;
      else snap.claim_content_hash = hash;
      const r = result(v);
      expect(id(canonicalJson(r))).toEqual({ bytes, sha256: digest });
      await refused(
        { returned: r },
        7,
        "dependency_result_invalid",
        "inspection.view.claims[2].snapshot." + field,
      );
      const api = await subject({ returned: result() });
      expect(api.prepareShowrunnerFixtureInput().kind).toBe(
        "source_bound_fixture_candidate",
      );
    },
  );
  it.each(["planner", "quote"] as const)(
    "checks returned registered %s permission before budget",
    async (kind) => {
      const v = clone(EXPECTED_V),
        e = obj(list(obj(v).evidence)[2]),
        s = obj(e.snapshot);
      if (kind === "planner") {
        obj(s.consumer_exposure).planner = "claim_only";
        e.representation = null;
        e.representation_status = "claim_only";
      } else s.quote_permission = true;
      const r = result(v);
      expect(id(canonicalJson(r))).toEqual(
        kind === "planner"
          ? {
              bytes: 132020,
              sha256:
                "253edb5e796df49e73e6a356f149bef8e5e4f5f4837fe838dfa41b95348d8c86",
            }
          : {
              bytes: 132052,
              sha256:
                "663d340a267637ee1f2406c9994aef6bc38e90956c37021bd2e381874f736e72",
            },
      );
      await refused(
        { returned: r },
        7,
        "registry_binding_refused",
        "registry[0]",
      );
    },
  );
  it.each([
    [
      "profile_duplicate",
      "package.manifest.context_candidates[0].context_id",
      true,
    ],
    ["profile_duplicate", "package.manifest.contexts[0].context_id", false],
    ["profile_binding_mismatch", "material.claim_bases[0].subject", true],
    [
      "profile_binding_mismatch",
      "material.claim_bases[0].subject.unknown",
      false,
    ],
  ] as const)(
    "projects only SAFE parent %s %s",
    async (code, field, allowed) => {
      const dep = {
        kind: "rejected",
        profile: "planner-fixture-consumer-snapshot/1",
        code,
        field,
        parser_code: null,
      };
      if (allowed)
        await refused(
          { returned: dep },
          6,
          "inspection_dependency_refused",
          "inspection",
          null,
          dep,
        );
      else await fault({ returned: dep }, 6);
    },
  );
  it("all aggregate headers precede invalid JSON and UTF8, with repair", async () => {
    const map = new Map(original),
      x = Buffer.alloc(1048576, "x");
    expect(sha(x)).toBe(
      "8f990ba0b577b51cf009ea049368c16bbda1b21e1b93be07a824758bb253c39b",
    );
    map.set(display(members[0]?.member), x);
    map.set(display(members[1]?.member), x);
    map.set(display(members[2]?.member), Buffer.from([255]));
    await refused({ members: map }, 2, "source_resource_limit", "source[2]");
    map.set(
      display(members[0]?.member),
      buffer(original.get(display(members[0]?.member))),
    );
    map.set(
      display(members[1]?.member),
      buffer(original.get(display(members[1]?.member))),
    );
    await refused({ members: map }, 2, "source_utf8_invalid", "source[2]");
    map.set(
      display(members[2]?.member),
      buffer(original.get(display(members[2]?.member))),
    );
    await fullPositive({ members: map });
  });
  it.each([0, 1])(
    "admits inclusive total source then fixed identity; excess %s crosses source[8]",
    async (extra) => {
      const map = new Map(original),
        f = Buffer.concat([
          buffer(original.get(display(members[0]?.member))),
          Buffer.alloc(577062, " "),
        ]),
        p = Buffer.concat([
          buffer(original.get(display(members[1]?.member))),
          Buffer.alloc(978315 + extra, " "),
        ]);
      expect(id(f)).toEqual({
        bytes: 1048576,
        sha256:
          "af2e39a0c59e604a7158252d1b045e1e76b2b4c823c672f112e5bff861980c60",
      });
      expect(id(p)).toEqual(
        extra
          ? {
              bytes: 1032350,
              sha256:
                "6292f8a704599f5e9eb09c5acae1057b161e60274ad647a236e342c047745bb2",
            }
          : {
              bytes: 1032349,
              sha256:
                "8041c8dee019e7c2836e48f5a164ce1df166ae1af41e62d48fb3308461812359",
            },
      );
      map.set(display(members[0]?.member), f);
      map.set(display(members[1]?.member), p);
      await refused(
        { members: map },
        extra ? 2 : 8,
        extra ? "source_resource_limit" : "source_identity_mismatch",
        extra ? "source[8]" : "source[0]",
      );
      if (extra) {
        const equal = Buffer.from(p.subarray(0, p.length - 1));
        expect(id(equal)).toEqual({
          bytes: 1032349,
          sha256:
            "8041c8dee019e7c2836e48f5a164ce1df166ae1af41e62d48fb3308461812359",
        });
        map.set(display(members[1]?.member), equal);
        await refused(
          { members: map },
          8,
          "source_identity_mismatch",
          "source[0]",
        );
      }
      for (const index of [0, 1]) {
        const name = display(members[index]?.member);
        map.set(name, buffer(original.get(name)));
      }
      await fullPositive({ members: map });
    },
  );
  it.each([17, 18])(
    "RESOURCE%s retains original local proofs and actual metadata",
    async (pad) => {
      const selected = obj(
        obj(EXPECTED_M.programming_configuration).show_config_version,
      ).show_config_version_id;
      const map = source((f) => {
        const row = obj(
          list(obj(f.tables).show_config_versions).find(
            (r) => r.show_config_version_id === selected,
          ),
        );
        obj(row.canonical_payload).name = "N".repeat(16384);
        row.config_hash = showConfigVersionHash(row);
      });
      const f = obj(
          JSON.parse(
            buffer(map.get(display(members[0]?.member))).toString(),
          ) as Json,
        ),
        config = obj(
          list(obj(f.tables).show_config_versions).find(
            (r) => r.show_config_version_id === selected,
          ),
        );
      map.set(display(members[4]?.member), Buffer.from(canonicalJson(config)));
      expect(id(buffer(map.get(display(members[0]?.member))))).toEqual({
        bytes: 349156,
        sha256:
          "49a23dd253006b5667f23ff8c57c1031b9982815b60cc9cfba930b0b472ce9e9",
      });
      const v = clone(EXPECTED_V),
        rows = list(obj(v).claims),
        baseClaim = obj(rows[0]);
      for (let i = 1; i <= 118; i++) {
        const cl = obj(clone(baseClaim)),
          s = obj(cl.snapshot);
        s.claim_id = "d1250018-0000-4000-8000-" + display(i).padStart(12, "0");
        s.subject_ref = "S".repeat(16384);
        s.support_refs = [];
        rows.push(cl);
      }
      const attrib = obj(list(obj(v).source_attribution)[0]);
      attrib.display_name = display(attrib.display_name) + "D".repeat(pad);
      const r = result(v);
      expect(id(canonicalJson(v))).toEqual(
        pad === 17
          ? {
              bytes: 2086327,
              sha256:
                "eb1a5ecbe179398e84d8d2abff4ea719a4615e1b04868c2965e5292ec0581431",
            }
          : {
              bytes: 2086328,
              sha256:
                "f35ac0ca8423303cc8c221229ce03891baa0e0de151d1ab33525f7c0fad8f53c",
            },
      );
      await refused(
        { members: map, returned: r },
        pad === 17 ? 8 : 7,
        pad === 17 ? "source_identity_mismatch" : "candidate_resource_limit",
        pad === 17 ? "source[0]" : "candidate.canonical_json",
      );
    },
  );
  it("constructor owns exactly five frozen data descriptors, never coerces invalid arguments", async () => {
    const api = await subject();
    let gets = 0;
    const hostile = {
      get valueOf() {
        gets++;
        throw new Error("private");
      },
    };
    const cases: unknown[][] = [
      [],
      [undefined],
      [null],
      ["0"],
      [hostile],
      [0, 0],
      [-1],
      [10],
      [0.5],
      [Infinity],
      [NaN],
      [0],
      [-0],
      [9],
    ];
    for (const args of cases) {
      const e = Reflect.construct(
        api.PC2FixtureInputFault,
        args,
        api.PC2FixtureInputFault,
      ) as Error;
      const phase =
        args.length === 1 &&
        typeof args[0] === "number" &&
        Number.isInteger(args[0]) &&
        args[0] >= 0 &&
        args[0] <= 9
          ? args[0] === 0
            ? 0
            : args[0]
          : 9;
      expect(obj(e).phase).toBe(phase);
      expect(Object.is(obj(e).phase, -0)).toBe(false);
      expect(Object.getOwnPropertySymbols(e)).toEqual([]);
      expect(Object.getOwnPropertyNames(e).sort()).toEqual([
        "code",
        "message",
        "name",
        "phase",
        "stack",
      ]);
      for (const key of Object.getOwnPropertyNames(e)) {
        const d = Object.getOwnPropertyDescriptor(e, key);
        expect(d).toEqual({
          value: obj(e)[key],
          enumerable: key === "code" || key === "phase",
          writable: false,
          configurable: false,
        });
      }
      expect(Object.isFrozen(e)).toBe(true);
    }
    expect(gets).toBe(0);
    expect(api.observed).not.toHaveBeenCalled();
  });
});

describe("review09 correspondence and first-error discrimination", () => {
  it.each(["pin_getter", "name_getter", "pin_primitive"] as const)(
    "admits nested own header DATA before comparisons: %s",
    async (kind) => {
      let gets = 0;
      const pins = structuredClone(base.pins),
        names = [...base.memberNames];
      if (kind === "pin_getter")
        Object.defineProperty(pins.familyCounts, "accounts", {
          get: () => {
            gets++;
            throw new Error("private");
          },
          enumerable: true,
          configurable: true,
        });
      if (kind === "name_getter")
        Object.defineProperty(names, "0", {
          get: () => {
            gets++;
            throw new Error("private");
          },
          enumerable: true,
          configurable: true,
        });
      if (kind === "pin_primitive") obj(pins).totalRows = NaN;
      const api = await subject({
        open: () => ({
          pins,
          memberNames: names,
          roles: new Map(base.roles),
          member: (n: string) => original.get(n),
          json: () => null,
        }),
      });
      expect(api.prepareShowrunnerFixtureInput()).toEqual(
        rejection(1, "source_type_invalid", "reader"),
      );
      expect(gets).toBe(0);
    },
  );
  it("captures headers and the member callable before any member effect", async () => {
    const pins = structuredClone(base.pins),
      names = [...base.memberNames],
      roles = new Map(base.roles),
      seen: string[] = [];
    const pack = {
      pins,
      memberNames: names,
      roles,
      member: (n: string) => {
        seen.push(n);
        if (seen.length === 1) {
          obj(pins).totalRows = 0;
          names.splice(0);
          roles.clear();
          Object.defineProperty(pack, "member", {
            get: () => {
              throw new Error("member reread");
            },
            configurable: true,
          });
        }
        return original.get(n);
      },
      json: () => {
        throw new Error("json read");
      },
    };
    const api = await subject({ open: () => pack });
    expect(api.prepareShowrunnerFixtureInput().kind).toBe(
      "source_bound_fixture_candidate",
    );
    expect(seen).toEqual(members.map((r) => r.member));
  });
  it("untagged descendant selection never calls an accessor", async () => {
    let gets = 0;
    const r = result(),
      v = obj(r.view),
      e = obj(list(v.evidence)[8]),
      locator = obj(obj(e.snapshot).locator);
    Object.defineProperty(locator, "body_codepoint_start", {
      get: () => {
        gets++;
        throw new Error("private");
      },
      enumerable: true,
      configurable: true,
    });
    await refused(
      { returned: r },
      7,
      "dependency_result_invalid",
      "inspection.view.evidence[8].snapshot.locator",
    );
    expect(gets).toBe(0);
  });
  it.each([
    "extra",
    "symbol",
    "accessor",
    "unknown_code",
    "unknown_parser",
    "wrong_field_type",
  ] as const)(
    "malformed SAFE rejection is unexpected fault6: %s",
    async (kind) => {
      let gets = 0;
      const dep: Record<PropertyKey, unknown> = {
        kind: "rejected",
        profile: "planner-fixture-consumer-snapshot/1",
        code: "input_type_invalid",
        field: "input",
        parser_code: null,
      };
      if (kind === "extra") dep.detail = "private";
      if (kind === "symbol") dep[Symbol("private")] = 0;
      if (kind === "accessor")
        Object.defineProperty(dep, "code", {
          get: () => {
            gets++;
            throw new Error("private");
          },
          enumerable: true,
          configurable: true,
        });
      if (kind === "unknown_code") dep.code = "not_declared";
      if (kind === "unknown_parser") {
        dep.code = "parser_rejected";
        dep.field = "package";
        dep.parser_code = "not_declared";
      }
      if (kind === "wrong_field_type") dep.field = 0;
      await fault({ returned: dep }, 6);
      expect(gets).toBe(0);
    },
  );
  it.each([
    [5, "description", "episode_mode_registry", "values"],
    [8, "job", "block_type_registry", "values"],
    [6, "job", "rundown_template", "slots"],
    [6, "source_migration", "rundown_template", ""],
  ] as const)(
    "legal descriptive member%s %s is deferred to source identity8",
    async (index, key, _owner, arrayKey) => {
      const map = new Map(original),
        member = display(members[index]?.member),
        doc = obj(JSON.parse(buffer(original.get(member)).toString()) as Json);
      const row = arrayKey ? obj(list(doc[arrayKey])[0]) : doc;
      row[key] = display(row[key]) + " revised";
      map.set(member, Buffer.from(JSON.stringify(doc)));
      await refused(
        { members: map },
        8,
        "source_identity_mismatch",
        "source[" + display(index) + "]",
      );
      const participantsMember = display(members[7]?.member),
        participants = obj(
          JSON.parse(
            buffer(original.get(participantsMember)).toString(),
          ) as Json,
        );
      obj(list(participants.profiles)[0]).character_bible_version = "0.1.5";
      map.set(participantsMember, Buffer.from(JSON.stringify(participants)));
      await refused(
        { members: map },
        5,
        "configuration_version_unsupported",
        "configuration.participant_profiles.profiles[0].character_bible_version",
      );
    },
  );
  it("show-version category precedes name binding and has a reconciled source/config control", async () => {
    const map = configSource((s) => {
      obj(s.canonical_payload).name = "changed valid name";
      obj(s.canonical_payload).show_version = "not_supported";
    }, true);
    await refused(
      { members: map },
      5,
      "configuration_version_unsupported",
      "configuration.show_config_version.canonical_payload.show_version",
    );
  });
  it.each([
    [
      "evidence_duplicate",
      "inspection.view.evidence[0].claim_representation_refs[1]",
    ],
    [
      "evidence_unresolved",
      "inspection.view.evidence[0].claim_representation_refs[0]",
    ],
    ["beat_duplicate", "inspection.view.beats[0].member_claim_refs[1]"],
    ["context_unresolved", "inspection.view.context_candidates[0].claim_id"],
    ["signal_unresolved", "inspection.view.signals[0].ref"],
    ["continuity_unresolved", "inspection.view.continuity[0].continuity_id"],
    ["silent_unresolved", "inspection.view.silent_inputs[0].support_refs[0]"],
  ] as const)(
    "present %s must resolve uniquely before registry content faults",
    async (kind, field) => {
      const v = clone(EXPECTED_V),
        view = obj(v),
        unknownClaim = "d1250008-0000-4000-8000-000000000099";
      if (kind === "evidence_duplicate") {
        const e = obj(list(view.evidence)[0]);
        e.claim_representation_refs = [
          ...(e.claim_representation_refs as Json[]),
          ...(e.claim_representation_refs as Json[]),
        ];
      }
      if (kind === "evidence_unresolved")
        obj(list(view.evidence)[0]).claim_representation_refs = [unknownClaim];
      if (kind === "beat_duplicate") {
        const b = obj(list(view.beats)[0]);
        const refs = b.member_claim_refs as Json[];
        refs[1] = refs[0] ?? null;
      }
      if (kind === "context_unresolved")
        obj(list(view.context_candidates)[0]).claim_id = unknownClaim;
      if (kind === "signal_unresolved")
        obj(list(view.signals)[0]).ref =
          "artifact:d1250005-0000-4000-8000-000000000099";
      if (kind === "continuity_unresolved")
        obj(list(view.continuity)[0]).continuity_id =
          "artifact:d1250005-0000-4000-8000-000000000099";
      if (kind === "silent_unresolved")
        obj(list(view.silent_inputs)[0]).support_refs = [E(99)];
      obj(list(view.claims)[3]?.snapshot).claim_content_hash = "0".repeat(64);
      await refused(
        { returned: result(v) },
        7,
        "dependency_result_invalid",
        field,
      );
    },
  );
  it("silent source support relation is checked before registry content", async () => {
    const v = clone(EXPECTED_V),
      view = obj(v);
    obj(list(view.silent_inputs)[0]).support_refs = [E(1)];
    obj(list(view.claims)[3]?.snapshot).claim_content_hash = "0".repeat(64);
    await refused(
      { returned: result(v) },
      7,
      "dependency_result_invalid",
      "inspection.view.silent_inputs[0].support_refs[0]",
    );
  });
  it("nonregistry evidence refs bind the exact captured relationship", async () => {
    const v = clone(EXPECTED_V),
      e = obj(list(obj(v).evidence)[0]);
    e.claim_representation_refs = [
      obj(list(obj(v).claims)[1]?.snapshot).claim_id ?? null,
    ];
    await refused(
      { returned: result(v) },
      7,
      "dependency_result_invalid",
      "inspection.view.evidence[0].claim_representation_refs[0]",
    );
  });
  it.each([
    ["rights_version_id", "rights_policy_version"],
    ["rights_policy_version", "source_identity"],
    ["source_identity", "consumer_exposure.planner"],
    ["consumer_exposure.planner", "consumer_exposure.writer"],
    ["consumer_exposure.writer", "consumer_exposure.auditor"],
    ["consumer_exposure.auditor", "quote_permission"],
    ["quote_permission", "paraphrase_permission"],
    ["paraphrase_permission", "retention_class"],
    ["retention_class", "locator"],
  ] as const)(
    "nonregistry permission %s precedes %s and content hash",
    async (first, second) => {
      const v = clone(EXPECTED_V),
        e = obj(list(obj(v).evidence)[0]),
        s = obj(e.snapshot);
      const edit = (key: string) => {
        const parts = key.split(".");
        if (parts.length === 2)
          obj(s.consumer_exposure)[parts[1] ?? ""] = "paraphrase";
        else if (key === "rights_version_id" || key === "rights_policy_version")
          s[key] = "d1250006-0000-4000-8000-000000000001";
        else if (key === "quote_permission" || key === "paraphrase_permission")
          s[key] = !s[key];
        else if (key === "retention_class") s[key] = "fixture_retained";
        else if (key === "locator") obj(s.locator).body_codepoint_start = 1;
        else s[key] = "changed_source";
      };
      if (first === "retention_class") {
        obj(s.locator).body_codepoint_start = 1;
        e.representation_status = "exact_span";
        await refused(
          { returned: result(v) },
          7,
          "dependency_result_invalid",
          "inspection.view.evidence[0].snapshot.locator.body_codepoint_start",
        );
        return;
      }
      edit(first);
      edit(second);
      s.content_hash = "0".repeat(64);
      await refused(
        { returned: result(v) },
        7,
        "dependency_result_invalid",
        "inspection.view.evidence[0].snapshot." + first,
      );
    },
  );
  it("nonregistry status and remaining sorted snapshot fields retain declared priority", async () => {
    const v = clone(EXPECTED_V),
      e = obj(list(obj(v).evidence)[0]),
      s = obj(e.snapshot);
    e.representation_status = "exact_span";
    s.content_hash = "0".repeat(64);
    await refused(
      { returned: result(v) },
      7,
      "dependency_result_invalid",
      "inspection.view.evidence[0].representation_status",
    );
    const repaired = clone(EXPECTED_V),
      other = obj(list(obj(repaired).evidence)[0]);
    obj(other.snapshot).content_hash = "0".repeat(64);
    await refused(
      { returned: result(repaired) },
      7,
      "dependency_result_invalid",
      "inspection.view.evidence[0].snapshot.content_hash",
    );
  });

  it.each([false, true])(
    "original summaries bind captured derivation DATA, changed returned control=%s",
    async (reconciled) => {
      const time = "2026-09-27T12:59:31Z";
      const map = source((f) => {
        obj(list(obj(f.tables).derivation_runs)[0]).created_at = time;
      });
      const material = clone(EXPECTED_MATERIAL);
      obj(list(obj(material).derivations)[0]).created_at = time;
      const input = canonicalJson({
        schema: "planner-fixture-consumer-input/1",
        package_payload: EXPECTED_PACKAGE,
        material,
      });
      const v = clone(EXPECTED_V);
      if (reconciled)
        obj(
          list(obj(v).support_summaries).find(
            (s) => s.support_kind === "derivation",
          )?.inspection,
        ).created_at = time;
      const r = result(v),
        observation = obj(r.observation);
      observation.input_utf8_bytes = display(Buffer.byteLength(input));
      observation.input_sha256 = sha(input);
      await refused(
        { members: map, returned: r },
        reconciled ? 8 : 7,
        reconciled ? "source_identity_mismatch" : "dependency_result_invalid",
        reconciled
          ? "source[0]"
          : "inspection.view.support_summaries[6].inspection.created_at",
      );
    },
  );
  it("nonregistry locator priority precedes status after valid permission fields", async () => {
    const v = clone(EXPECTED_V),
      e = obj(list(obj(v).evidence)[0]);
    obj(obj(e.snapshot).locator).body_codepoint_start = 1;
    e.representation_status = "exact_span";
    await refused(
      { returned: result(v) },
      7,
      "dependency_result_invalid",
      "inspection.view.evidence[0].snapshot.locator.body_codepoint_start",
    );
  });

  it("value quantity semantics precede otherwise valid registry content defects", async () => {
    const v = clone(EXPECTED_V),
      view = obj(v);
    obj(list(view.claims)[6]?.value).after_minute = 1441;
    obj(list(view.claims)[3]?.snapshot).claim_content_hash = "0".repeat(64);
    await refused(
      { returned: result(v) },
      7,
      "dependency_result_invalid",
      "inspection.view.claims[6].value.after_minute",
    );
  });
});
