// PC1/05 public-boundary tests. Independently pinned literal data; never a historical test PASS.
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import pg from "pg";
import { describe, expect, it, vi } from "vitest";
import { canonicalJson } from "../../src/identity/canonical-json.js";
import * as identity from "../../src/identity/canonical-json.js";
import { evidencePackageHash } from "../../src/identity/artifacts.js";
import {
  claimContentHash,
  claimFrozenStateHash,
  derivationOutputHash,
  fixtureSupportObjectHash,
} from "../../src/identity/knowledge.js";
import { isJsonObject, type Json } from "../../src/runtime/command.js";
import {
  PROFILE,
  materializePlannerFixtureConsumerSnapshot as project,
  type PlannerFixtureConsumerError,
} from "../../src/runtime/planner-fixture-consumer-snapshot.js";
type O = Record<string, Json>;
interface Input {
  schema: string;
  package_payload: O;
  material: O;
}
// Whole retained canonical input components and independently specified expected View parts.
const PACKAGE_TEXT =
  '{"artifact_id":"d1250005-0000-4000-8000-000000000011","created_at":"2026-09-27T13:00:00Z","frozen_at":"2026-09-27T13:00:05Z","id":"d1250004-0000-4000-8000-000000000001","manifest":{"availability":{"continuity":{"state":"available"},"historical_context":{"state":"available"},"independent_analysis":{"state":"available"},"licensed_tracking_data":{"reason":"provider_not_configured","state":"not_applicable"},"serious_incident":{"reason":"no_confirmed_in_scope_incident","state":"absent"},"structured_stats":{"state":"available"},"supporter_evidence":{"observation_count":4,"state":"available"},"verified_result":{"state":"available"}},"beats":[{"beat_id":"beat_control","candidate_selection_score":"0.92","label":"late-game control","member_claim_refs":["d1250008-0000-4000-8000-000000000001","d1250008-0000-4000-8000-000000000002","d1250008-0000-4000-8000-000000000003","d1250008-0000-4000-8000-000000000004","d1250008-0000-4000-8000-000000000007"]},{"beat_id":"beat_supporter","candidate_selection_score":"0.83","label":"supporter consequence","member_claim_refs":["d1250008-0000-4000-8000-000000000005","d1250008-0000-4000-8000-000000000006","d1250008-0000-4000-8000-000000000009"]},{"beat_id":"beat_market","candidate_selection_score":"0.20","label":"market calibration","member_claim_refs":["d1250008-0000-4000-8000-000000000008"]}],"claims":[{"approved_representation":"Northbridge FC beat Southbank Athletic 2-1.","attribution_requirement":{"required":false},"claim_content_hash":"fbb285c68fd26f5bb5cd26b6f0179d9aa0062e30e84e47e98c8c8d14292c2aa1","claim_id":"d1250008-0000-4000-8000-000000000001","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"2239630f0ed9835266704ae1432d3b269dccfdd2d43b946a2b969aae310e9e94","initial_status":"confirmed","initial_usage_class":"assertable","kind":"event_fact","origin":"official_source","predicate":"match_result","reduced_usage_class":"assertable","state_event_cursor":null,"subject_domain":"statistical","subject_ref":"entity_northbridge_fc","support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000001","derivation_run_id":null,"evidence_unit_id":"d1250007-0000-4000-8000-000000000001","external_support_identity":null,"support_hash":"5dfd65df76fdcd9b3fa8b2ab730cb38712f3941875ad2ae1319d788d256bd1a3","support_kind":"evidence","support_role":"supports_value"}],"value":{"northbridge_goals":2,"southbank_goals":1},"value_type":"scoreline"},{"approved_representation":"Northbridge had 43 percent possession.","attribution_requirement":{"required":false},"claim_content_hash":"55e10cb05eef3ff50b04d02b9c328bd502e7f3af840ecd774ffe7f9743408376","claim_id":"d1250008-0000-4000-8000-000000000002","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"db0710627bea350c1ca0d9c3344c951c9bb57d7740dd8c23bbc91a7060fd732f","initial_status":"confirmed","initial_usage_class":"assertable","kind":"event_fact","origin":"data_provider","predicate":"possession_percent","reduced_usage_class":"assertable","state_event_cursor":null,"subject_domain":"statistical","subject_ref":"entity_northbridge_fc","support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000002","derivation_run_id":null,"evidence_unit_id":"d1250007-0000-4000-8000-000000000002","external_support_identity":null,"support_hash":"a5565030c5163db39ffd10a1cd80a07cb30559d898737d23d87fc4f029fefdb0","support_kind":"evidence","support_role":"supports_value"}],"value":{"scalar":"43","unit":"percent"},"value_type":"exact_decimal"},{"approved_representation":"The North Coast Gazette reports Northbridge had rehearsed a 5-4-1 closing shape in training.","attribution_requirement":{"approved_prefix":"The North Coast Gazette reports","required":true,"source_id":"src_north_coast_gazette"},"claim_content_hash":"a6b3d89db355e2854bf35519496959e3b343639ff074be88202d9c10a4f74d38","claim_id":"d1250008-0000-4000-8000-000000000003","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"3de1334c7a8e5c58ba2cbdd531d6541bec7e1a7f5fc7447714b41b584af2bae4","initial_status":"confirmed","initial_usage_class":"assertable","kind":"reported_fact","origin":"external_publisher","predicate":"closing_shape_rehearsed","reduced_usage_class":"assertable","state_event_cursor":null,"subject_domain":"tactical","subject_ref":"entity_northbridge_fc","support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000003","derivation_run_id":null,"evidence_unit_id":"d1250007-0000-4000-8000-000000000003","external_support_identity":null,"support_hash":"a71d542b57e7edcfe91186a9a934b0301845599b4a40f7fecb8d6e633b4b8578","support_kind":"evidence","support_role":"supports_value"}],"value":{"context":"closing shape rehearsed in training","formation":"5-4-1"},"value_type":"structured_text"},{"approved_representation":"One specialist analysis in the package suggests Southbank\'s wider second-half attacks may have been a deliberate response to Northbridge narrowing the midfield.","attribution_requirement":{"approved_prefix":"One specialist analysis in the package suggests","required":true,"source_id":"src_matchboard_analysis"},"claim_content_hash":"f8bdddac5d0d10856a94121cd1dd178fd650477cbd82e338afa52cde5b228672","claim_id":"d1250008-0000-4000-8000-000000000004","effective_usage_class":"hedged_only","frozen_state":"confirmed","frozen_state_hash":"59580d5287ca5d6d8c428d73936fc442c21454be258e5b0c6d4b5209b2fca4cd","initial_status":"confirmed","initial_usage_class":"hedged_only","kind":"analysis","origin":"external_publisher","predicate":"southbank_wide_response","reduced_usage_class":"hedged_only","state_event_cursor":null,"subject_domain":"tactical","subject_ref":"entity_northbridge_fc","support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000004","derivation_run_id":null,"evidence_unit_id":"d1250007-0000-4000-8000-000000000004","external_support_identity":null,"support_hash":"98cc45be73f4be9296b343ad543d249a63fc20f6c31daf0a86b6c90eb1b8e4df","support_kind":"evidence","support_role":"supports_value"}],"value":{"interpretation":"Southbank\'s second-half wing focus may have been a deliberate response to Northbridge narrowing the midfield."},"value_type":"analysis_text"},{"approved_representation":"Across four supporter sources in the package, the dominant note was relief more than celebration.","attribution_requirement":{"approved_prefix":"Across four supporter sources in the package","required":true,"source_id":"supporter_sample"},"claim_content_hash":"077522e8f69193fa36fa038ab8378b3780c49456f67ea9eb730c928da00733c5","claim_id":"d1250008-0000-4000-8000-000000000005","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"4a32d360454d615f54c7b467e95338c8cde8c9388c67919aa9bc4bcf8fa41a8e","initial_status":"confirmed","initial_usage_class":"assertable","kind":"mood","origin":"supporter_source","predicate":"supporter_postmatch_tenor","reduced_usage_class":"assertable","state_event_cursor":null,"subject_domain":"cultural","subject_ref":"entity_northbridge_fc","support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000005","derivation_run_id":null,"evidence_unit_id":null,"external_support_identity":"artifact:d1250005-0000-4000-8000-000000000017","support_hash":"46e6a24048f151f62f9e03a66bb57ca4aae78c0281630850bc74bf9205cd4c28","support_kind":"signal","support_role":"supports_value"}],"value":{"direction":"relief_over_celebration","observation_count":4},"value_type":"tenor"},{"approved_representation":"An approved lore source traces the phrase \'the long ten\' to at least 2019.","attribution_requirement":{"required":false},"claim_content_hash":"9be7ef594118c81d980d25a343ade42b6dfc2932c9a3a31eb69170584aee117d","claim_id":"d1250008-0000-4000-8000-000000000006","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"2999b750b23ef1a6c98b3b6ab029a0cf734ea6d2ca9a823f5420dce700bcfc5f","initial_status":"confirmed","initial_usage_class":"assertable","kind":"lore","origin":"external_publisher","predicate":"supporter_phrase_long_ten","reduced_usage_class":"assertable","state_event_cursor":null,"subject_domain":"cultural","subject_ref":"entity_northbridge_fc","support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000006","derivation_run_id":null,"evidence_unit_id":"d1250007-0000-4000-8000-000000000009","external_support_identity":null,"support_hash":"413c4fc6bbce8ab3ec6704e07bfc85f7e6800b92ae8f51de1c430b65a74c6ee3","support_kind":"evidence","support_role":"supports_value"}],"value":{"attested_since_year":2019,"phrase":"the long ten"},"value_type":"lore_phrase"},{"approved_representation":"Northbridge conceded after the 80th minute in 3 of their last 5 league matches.","attribution_requirement":{"required":false},"claim_content_hash":"cabbed4a2abed81a76fa2a0d4ce7ca2232545224ffbd37ac5a01e1b56fb2063f","claim_id":"d1250008-0000-4000-8000-000000000007","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"98fa9d6b3406e2b5734cc8fcc12cdd9038e9976838d95f1d4b7f8321ecfb833e","initial_status":"confirmed","initial_usage_class":"assertable","kind":"desk_derived","origin":"desk_derived","predicate":"late_concessions_recent","reduced_usage_class":"assertable","state_event_cursor":null,"subject_domain":"statistical","subject_ref":"entity_northbridge_fc","support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000007","derivation_run_id":"d1250009-0000-4000-8000-000000000001","evidence_unit_id":null,"external_support_identity":null,"support_hash":"eb65fd3581e65333e7dcc68a0150e17dc8e728c8e348510b7c3ca12f2d748a88","support_kind":"derivation","support_role":"supports_value"}],"value":{"after_minute":80,"count":3,"sample_size":5},"value_type":"count_window"},{"approved_representation":"Market-implied Northbridge win probability: 0.58.","attribution_requirement":{"required":false},"claim_content_hash":"d635b3253e5d2aba9cea12a2ac3495606ebac7d3d365b6b9623d613fa92e7a53","claim_id":"d1250008-0000-4000-8000-000000000008","effective_usage_class":"silent","frozen_state":"confirmed","frozen_state_hash":"4006b76c4b9ad0bd1a841ddaa5930d877c110fb821f522c45f71ae2c8ae1ffa3","initial_status":"confirmed","initial_usage_class":"silent","kind":"analysis","origin":"data_provider","predicate":"next_match_market_probability","reduced_usage_class":"silent","state_event_cursor":null,"subject_domain":"statistical","subject_ref":"entity_northbridge_fc","support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000008","derivation_run_id":null,"evidence_unit_id":"d1250007-0000-4000-8000-000000000010","external_support_identity":null,"support_hash":"348f6a219bc56f3d69f86267c1669d9c672f30db7712dc88cd6a8f4ff6e1f8f4","support_kind":"evidence","support_role":"supports_value"}],"value":{"scalar":"0.58","unit":"probability"},"value_type":"exact_decimal"},{"approved_representation":"The previous published episode left late-game control unresolved.","attribution_requirement":{"required":false},"claim_content_hash":"92d17eee43920805daf81919b546e7be44a50915d579e4da84ff5782e828d54f","claim_id":"d1250008-0000-4000-8000-000000000009","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"dfa61e2a799d3966fe4eccb6998b9d4925e074a04ad07724d95957d4052d8231","initial_status":"confirmed","initial_usage_class":"assertable","kind":"program_history","origin":"desk_derived","predicate":"prior_published_position","reduced_usage_class":"assertable","state_event_cursor":null,"subject_domain":"historical","subject_ref":"entity_northbridge_fc","support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000009","derivation_run_id":null,"evidence_unit_id":null,"external_support_identity":"artifact:d1250005-0000-4000-8000-000000000018","support_hash":"2192b1ec1e126a0d7f705e69338cc5e2b457c6cd8f13136bc07f72cccdf46dd1","support_kind":"continuity","support_role":"supports_value"}],"value":{"position":"late-game control remained unresolved","topic_thread_id":"thr_late_game_control"},"value_type":"program_history"}],"context_candidates":[{"claim_id":"d1250008-0000-4000-8000-000000000007","context_id":"ctx_latepattern","functions":["supports","continuity"],"reason":"Recent late-concession pattern sharpens the control question."},{"claim_id":"d1250008-0000-4000-8000-000000000006","context_id":"ctx_lore","functions":["meaning"],"reason":"Approved supporter language explains why the final minutes feel culturally familiar."},{"claim_id":"d1250008-0000-4000-8000-000000000009","context_id":"ctx_continuity","functions":["continuity"],"reason":"Prior published position makes the unresolved thread explicit."}],"continuity":[{"continuity_id":"artifact:d1250005-0000-4000-8000-000000000018","published_only":true,"topic_thread_id":"thr_late_game_control","withdrawn":false}],"coverage_conditions":[{"condition":"normal_match_analysis","state":"satisfied"},{"condition":"supporter_texture","state":"satisfied"},{"condition":"independent_analysis","state":"satisfied"}],"evidence":[{"acquisition_ref":"fixture-acquisition:src_north_coast_league:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"claim_only"},"content_hash":"5dfd65df76fdcd9b3fa8b2ab730cb38712f3941875ad2ae1319d788d256bd1a3","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","evidence_type":"fact","evidence_unit_id":"d1250007-0000-4000-8000-000000000001","language":"en-GB","locator":{"body_codepoint_end":46,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000001","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"structured_data","origin":"official_source","paraphrase_permission":true,"quote_permission":false,"retention_class":"fixture_retained","retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_policy_version":"d1250006-0000-4000-8000-000000000004","rights_version_id":"d1250006-0000-4000-8000-000000000004","source_identity":"src_north_coast_league","source_item_identity":"fixture-item:ev_official_result:v1","source_modality":"structured_data","source_role":"official","speaker_identity":null},{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"claim_only"},"content_hash":"a5565030c5163db39ffd10a1cd80a07cb30559d898737d23d87fc4f029fefdb0","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","evidence_type":"fact","evidence_unit_id":"d1250007-0000-4000-8000-000000000002","language":"en-GB","locator":{"body_codepoint_end":38,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000002","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"structured_data","origin":"data_provider","paraphrase_permission":true,"quote_permission":false,"retention_class":"fixture_retained","retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_policy_version":"d1250006-0000-4000-8000-000000000002","rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_possession:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null},{"acquisition_ref":"fixture-acquisition:src_north_coast_gazette:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"exact_excerpt","planner":"paraphrase","writer":"paraphrase"},"content_hash":"a71d542b57e7edcfe91186a9a934b0301845599b4a40f7fecb8d6e633b4b8578","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","evidence_type":"observation","evidence_unit_id":"d1250007-0000-4000-8000-000000000003","language":"en-GB","locator":{"body_codepoint_end":98,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000003","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"text","origin":"external_publisher","paraphrase_permission":true,"quote_permission":false,"retention_class":"fixture_retained","retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_policy_version":"d1250006-0000-4000-8000-000000000005","rights_version_id":"d1250006-0000-4000-8000-000000000005","source_identity":"src_north_coast_gazette","source_item_identity":"fixture-item:ev_gazette_shape:v1","source_modality":"text","source_role":"journalist","speaker_identity":null},{"acquisition_ref":"fixture-acquisition:src_matchboard_analysis:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"exact_excerpt","planner":"paraphrase","writer":"paraphrase"},"content_hash":"98cc45be73f4be9296b343ad543d249a63fc20f6c31daf0a86b6c90eb1b8e4df","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","evidence_type":"analysis","evidence_unit_id":"d1250007-0000-4000-8000-000000000004","language":"en-GB","locator":{"body_codepoint_end":126,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000004","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"text","origin":"external_publisher","paraphrase_permission":true,"quote_permission":false,"retention_class":"fixture_retained","retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_policy_version":"d1250006-0000-4000-8000-000000000005","rights_version_id":"d1250006-0000-4000-8000-000000000005","source_identity":"src_matchboard_analysis","source_item_identity":"fixture-item:ev_specialist_wide:v1","source_modality":"text","source_role":"analyst","speaker_identity":null},{"acquisition_ref":"fixture-acquisition:src_supporter_forum_a:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"exact_excerpt","planner":"paraphrase","writer":"paraphrase"},"content_hash":"bb010e8fa7d1b2925a142620f20771294db03a6077c78ab72b041a3601cd41f3","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","evidence_type":"sentiment","evidence_unit_id":"d1250007-0000-4000-8000-000000000005","language":"en-GB","locator":{"body_codepoint_end":30,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000005","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"text","observation_order":1,"observation_set_identity":"fixture-supporter-reaction-event-001-v1","observation_window":{"end":"2026-09-27T12:59:00Z","start":"2026-09-27T12:00:00Z"},"origin":"supporter_source","paraphrase_permission":true,"quote_permission":false,"retention_class":"fixture_retained","retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_policy_version":"d1250006-0000-4000-8000-000000000007","rights_version_id":"d1250006-0000-4000-8000-000000000007","source_identity":"src_supporter_forum_a","source_item_identity":"fixture-item:ev_supporter_1:v1","source_modality":"text","source_role":"supporter","speaker_identity":"anonymous-synthetic-observation-1"},{"acquisition_ref":"fixture-acquisition:src_supporter_podcast_b:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"exact_excerpt","planner":"paraphrase","writer":"paraphrase"},"content_hash":"290dca152f388f068d078aca310869cb6aebc6506588f9c9d06de4a5cce1d7e0","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","evidence_type":"sentiment","evidence_unit_id":"d1250007-0000-4000-8000-000000000006","language":"en-GB","locator":{"body_codepoint_end":19,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000006","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"audio","observation_order":2,"observation_set_identity":"fixture-supporter-reaction-event-001-v1","observation_window":{"end":"2026-09-27T12:59:00Z","start":"2026-09-27T12:00:00Z"},"origin":"supporter_source","paraphrase_permission":true,"quote_permission":false,"retention_class":"fixture_retained","retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_policy_version":"d1250006-0000-4000-8000-000000000007","rights_version_id":"d1250006-0000-4000-8000-000000000007","source_identity":"src_supporter_podcast_b","source_item_identity":"fixture-item:ev_supporter_2:v1","source_modality":"audio","source_role":"supporter","speaker_identity":"anonymous-synthetic-observation-2"},{"acquisition_ref":"fixture-acquisition:src_supporter_blog_c:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"exact_excerpt","planner":"paraphrase","writer":"paraphrase"},"content_hash":"3089e7a00a05ca9145a2b83edf9dc3e0fd7d1b7be70df5f5f69ffde049958e21","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","evidence_type":"sentiment","evidence_unit_id":"d1250007-0000-4000-8000-000000000007","language":"en-GB","locator":{"body_codepoint_end":49,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000007","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"text","observation_order":3,"observation_set_identity":"fixture-supporter-reaction-event-001-v1","observation_window":{"end":"2026-09-27T12:59:00Z","start":"2026-09-27T12:00:00Z"},"origin":"supporter_source","paraphrase_permission":true,"quote_permission":false,"retention_class":"fixture_retained","retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_policy_version":"d1250006-0000-4000-8000-000000000007","rights_version_id":"d1250006-0000-4000-8000-000000000007","source_identity":"src_supporter_blog_c","source_item_identity":"fixture-item:ev_supporter_3:v1","source_modality":"text","source_role":"supporter","speaker_identity":"anonymous-synthetic-observation-3"},{"acquisition_ref":"fixture-acquisition:src_supporter_forum_d:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"exact_excerpt","planner":"paraphrase","writer":"paraphrase"},"content_hash":"3a462ce692fcdbdffcb3ce62810b2efbe50a1d18af3460944f46ba00623fdef5","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","evidence_type":"sentiment","evidence_unit_id":"d1250007-0000-4000-8000-000000000008","language":"en-GB","locator":{"body_codepoint_end":13,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000008","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"text","observation_order":4,"observation_set_identity":"fixture-supporter-reaction-event-001-v1","observation_window":{"end":"2026-09-27T12:59:00Z","start":"2026-09-27T12:00:00Z"},"origin":"supporter_source","paraphrase_permission":true,"quote_permission":false,"retention_class":"fixture_retained","retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_policy_version":"d1250006-0000-4000-8000-000000000007","rights_version_id":"d1250006-0000-4000-8000-000000000007","source_identity":"src_supporter_forum_d","source_item_identity":"fixture-item:ev_supporter_4:v1","source_modality":"text","source_role":"supporter","speaker_identity":"anonymous-synthetic-observation-4"},{"acquisition_ref":"fixture-acquisition:src_east_bank_review_archive:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"exact_excerpt","planner":"exact_excerpt","writer":"exact_excerpt"},"content_hash":"413c4fc6bbce8ab3ec6704e07bfc85f7e6800b92ae8f51de1c430b65a74c6ee3","entity_identity":"entity_northbridge_fc","event_identity":null,"evidence_type":"context","evidence_unit_id":"d1250007-0000-4000-8000-000000000009","language":"en-GB","locator":{"body_codepoint_end":110,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000009","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"text","origin":"external_publisher","paraphrase_permission":true,"permitted_quote":{"span_end":83,"span_start":71,"text":"the long ten"},"quote_permission":true,"retention_class":"fixture_retained","retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_policy_version":"d1250006-0000-4000-8000-000000000006","rights_version_id":"d1250006-0000-4000-8000-000000000006","source_document_date":"2019-12-31","source_document_identity":"east-bank-2019-season-notes","source_identity":"src_east_bank_review_archive","source_item_identity":"fixture-item:ev_lore_long_ten:v1","source_modality":"text","source_role":"reference","speaker_identity":null},{"acquisition_ref":"fixture-acquisition:src_fixture_market:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"content_hash":"348f6a219bc56f3d69f86267c1669d9c672f30db7712dc88cd6a8f4ff6e1f8f4","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","evidence_type":"analysis","evidence_unit_id":"d1250007-0000-4000-8000-000000000010","language":"en-GB","locator":{"body_codepoint_end":32,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000010","kind":"synthetic_fixture_text","member":"evidence_store.json"},"market_event_identity":"event_fixture_next_001","modality":"structured_data","origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"reasoning_only":true,"retention_class":"fixture_retained","retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_policy_version":"d1250006-0000-4000-8000-000000000003","rights_version_id":"d1250006-0000-4000-8000-000000000003","source_identity":"src_fixture_market","source_item_identity":"fixture-item:ev_market:v1","source_modality":"structured_data","source_role":"market","speaker_identity":null},{"acquisition_ref":"fixture-acquisition:src_malicious_fixture:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"exact_excerpt","planner":"hidden","writer":"hidden"},"content_hash":"16c2b0ba472b17e10a395c3aa1800011a4997a26865021c5e75bd5361792da10","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","evidence_type":"context","evidence_unit_id":"d1250007-0000-4000-8000-000000000011","language":"en-GB","locator":{"body_codepoint_end":106,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000011","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"text","origin":"external_publisher","paraphrase_permission":false,"quote_permission":false,"retention_class":"fixture_retained","retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_policy_version":"d1250006-0000-4000-8000-000000000001","rights_version_id":"d1250006-0000-4000-8000-000000000001","source_identity":"src_malicious_fixture","source_item_identity":"fixture-item:ev_injection:v1","source_modality":"text","source_role":"journalist","speaker_identity":null,"untrusted_injection_specimen":true},{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"content_hash":"3c7a7888d1ae4d5c6a40aadae89f0db9cf0732c3a22265c65ac688867c785150","entity_identity":"entity_northbridge_fc","event_completed_at":"2026-09-21T12:00:00Z","event_identity":"event_fixture_previous_1","evidence_type":"fact","evidence_unit_id":"d1250007-0000-4000-8000-000000000012","language":"en-GB","locator":{"body_codepoint_end":52,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000012","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"structured_data","origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_class":"fixture_retained","retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_policy_version":"d1250006-0000-4000-8000-000000000002","rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_prev_1:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null,"window_identity":"fixture-last-five-league-before-event-001-v1","window_order":1},{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"content_hash":"ad8cbb012e22007db8c815249f907fbbf2039b63c83d3d9be6a222249a7ffd24","entity_identity":"entity_northbridge_fc","event_completed_at":"2026-09-14T12:00:00Z","event_identity":"event_fixture_previous_2","evidence_type":"fact","evidence_unit_id":"d1250007-0000-4000-8000-000000000013","language":"en-GB","locator":{"body_codepoint_end":62,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000013","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"structured_data","origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_class":"fixture_retained","retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_policy_version":"d1250006-0000-4000-8000-000000000002","rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_prev_2:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null,"window_identity":"fixture-last-five-league-before-event-001-v1","window_order":2},{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"content_hash":"c5ff2da2639e0f56c53a2812dda8e435f5c7ccfd1df7fe306ace66e075652fba","entity_identity":"entity_northbridge_fc","event_completed_at":"2026-09-07T12:00:00Z","event_identity":"event_fixture_previous_3","evidence_type":"fact","evidence_unit_id":"d1250007-0000-4000-8000-000000000014","language":"en-GB","locator":{"body_codepoint_end":52,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000014","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"structured_data","origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_class":"fixture_retained","retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_policy_version":"d1250006-0000-4000-8000-000000000002","rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_prev_3:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null,"window_identity":"fixture-last-five-league-before-event-001-v1","window_order":3},{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"content_hash":"fa9d0a653d449f5d4b599799dffcc487e04f2cc24dbcec7e0451bb102eebdc6b","entity_identity":"entity_northbridge_fc","event_completed_at":"2026-08-31T12:00:00Z","event_identity":"event_fixture_previous_4","evidence_type":"fact","evidence_unit_id":"d1250007-0000-4000-8000-000000000015","language":"en-GB","locator":{"body_codepoint_end":62,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000015","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"structured_data","origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_class":"fixture_retained","retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_policy_version":"d1250006-0000-4000-8000-000000000002","rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_prev_4:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null,"window_identity":"fixture-last-five-league-before-event-001-v1","window_order":4},{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"content_hash":"b21989b1b1461ca40d2ce84498250648e5f03949881d9fc3e82167fbf36acba5","entity_identity":"entity_northbridge_fc","event_completed_at":"2026-08-24T12:00:00Z","event_identity":"event_fixture_previous_5","evidence_type":"fact","evidence_unit_id":"d1250007-0000-4000-8000-000000000016","language":"en-GB","locator":{"body_codepoint_end":52,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000016","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"structured_data","origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_class":"fixture_retained","retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_policy_version":"d1250006-0000-4000-8000-000000000002","rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_prev_5:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null,"window_identity":"fixture-last-five-league-before-event-001-v1","window_order":5}],"schema":"evidence-package/2.0","scope":{"competition_ids":["competition_north_coast_league"],"entity_ids":["entity_northbridge_fc"],"event_ids":["event_fixture_001"],"locale":"en-GB","scheduled_default_mode":"normal_post_event","scope_type":"event","show_id":"d1250002-0000-4000-8000-000000000001","target_publication_slot_ref":"fixture_slot_001"},"selection_provenance":{"context_retrieval_version":"fixture.manual.v1","live_search":false,"match_window_proof":{"as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","complete_prior_schedule_assertion":true,"current_event":{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-27T12:00:00Z","completion_status":"final","event_identity":"event_fixture_001","participant_entities":["entity_northbridge_fc","entity_southbank_athletic"]},"current_event_identity":"event_fixture_001","entity_identity":"entity_northbridge_fc","ordered_prior_schedule":[{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-21T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_1","rank_before_current_event":1},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-14T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_2","rank_before_current_event":2},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-07T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_3","rank_before_current_event":3},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-31T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_4","rank_before_current_event":4},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-24T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_5","rank_before_current_event":5},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-17T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_6","rank_before_current_event":6}],"schedule_scope":"complete six most recent prior completed league matches in this synthetic fixture","selected_event_identities":["event_fixture_previous_1","event_fixture_previous_2","event_fixture_previous_3","event_fixture_previous_4","event_fixture_previous_5"],"selection_rule":"last five completed league matches before current event; descending completion time","source_identity":"src_fixture_data","source_record_ref":"fixture-schedule-ledger-v1","synthetic":true,"window_identity":"fixture-last-five-league-before-event-001-v1"},"operator":"fixture_builder","selector_version":"fixture.manual.v2"},"sensitivities":[{"applies_to":"event_fixture_001","note":"No in-scope serious incident or protected sensitivity at freeze.","sensitivity_id":"sens_none","state":"none"}],"signals":[{"ref":"artifact:d1250005-0000-4000-8000-000000000017","signal_id":"sig_tenor","type":"tenor_reading"},{"ref":"d1250009-0000-4000-8000-000000000001","signal_id":"sig_late_pattern","type":"derivation_run"}],"silent_inputs":[{"allowed_consumers":["planner","auditor"],"claim_id":"d1250008-0000-4000-8000-000000000008","effective_usage_class":"silent","purpose":"calibration_only","support_refs":["d1250007-0000-4000-8000-000000000010"]}],"source_attribution":[{"display_name":"North Coast Gazette","source_id":"src_north_coast_gazette","source_role":"journalist"},{"display_name":"Matchboard Analysis","source_id":"src_matchboard_analysis","source_role":"analyst"},{"display_name":"East Bank Review Archive","source_id":"src_east_bank_review_archive","source_role":"reference"}],"version_refs":{"claims_policy":"0.1.2","evidence_package_spec":"0.2.2","lens_definition":"fixture-lens-v1","rights_registry":"fixture-rights-v1","show_version":"postmatch-fixture-v4"}},"package_hash":"a8655c0e8bd72094a823b367a0c21cd665d3d99c271341286a92dbdc2ea304ab","schema_version":"evidence-package/2.0","scope_hash":"ecb1eb2b675a9e383dfe88e6311f8cc88cc97eb17183df9a8cae935d8d1f8979","selector_run_id":"selector_fixture_004"}';
const MATERIAL_TEXT =
  '{"claim_bases":[{"asserted_at":"2026-09-27T12:59:00Z","claim_id":"d1250008-0000-4000-8000-000000000001","claim_kind":"event_fact","content_hash":"fbb285c68fd26f5bb5cd26b6f0179d9aa0062e30e84e47e98c8c8d14292c2aa1","created_at":"2026-09-27T12:59:00Z","initial_status":"confirmed","initial_usage_class":"assertable","origin":"official_source","predicate":"match_result","subject":{"entity_ref":"entity_northbridge_fc"},"subject_domain":"statistical","supersedes_claim_id":null,"value":{"northbridge_goals":2,"southbank_goals":1}},{"asserted_at":"2026-09-27T12:59:00Z","claim_id":"d1250008-0000-4000-8000-000000000002","claim_kind":"event_fact","content_hash":"55e10cb05eef3ff50b04d02b9c328bd502e7f3af840ecd774ffe7f9743408376","created_at":"2026-09-27T12:59:00Z","initial_status":"confirmed","initial_usage_class":"assertable","origin":"data_provider","predicate":"possession_percent","subject":{"entity_ref":"entity_northbridge_fc"},"subject_domain":"statistical","supersedes_claim_id":null,"value":{"scalar":"43","unit":"percent"}},{"asserted_at":"2026-09-27T12:59:00Z","claim_id":"d1250008-0000-4000-8000-000000000003","claim_kind":"reported_fact","content_hash":"a6b3d89db355e2854bf35519496959e3b343639ff074be88202d9c10a4f74d38","created_at":"2026-09-27T12:59:00Z","initial_status":"confirmed","initial_usage_class":"assertable","origin":"external_publisher","predicate":"closing_shape_rehearsed","subject":{"entity_ref":"entity_northbridge_fc"},"subject_domain":"tactical","supersedes_claim_id":null,"value":{"context":"closing shape rehearsed in training","formation":"5-4-1"}},{"asserted_at":"2026-09-27T12:59:00Z","claim_id":"d1250008-0000-4000-8000-000000000004","claim_kind":"analysis","content_hash":"f8bdddac5d0d10856a94121cd1dd178fd650477cbd82e338afa52cde5b228672","created_at":"2026-09-27T12:59:00Z","initial_status":"confirmed","initial_usage_class":"hedged_only","origin":"external_publisher","predicate":"southbank_wide_response","subject":{"entity_ref":"entity_northbridge_fc"},"subject_domain":"tactical","supersedes_claim_id":null,"value":{"interpretation":"Southbank\'s second-half wing focus may have been a deliberate response to Northbridge narrowing the midfield."}},{"asserted_at":"2026-09-27T12:59:00Z","claim_id":"d1250008-0000-4000-8000-000000000005","claim_kind":"mood","content_hash":"077522e8f69193fa36fa038ab8378b3780c49456f67ea9eb730c928da00733c5","created_at":"2026-09-27T12:59:00Z","initial_status":"confirmed","initial_usage_class":"assertable","origin":"supporter_source","predicate":"supporter_postmatch_tenor","subject":{"entity_ref":"entity_northbridge_fc"},"subject_domain":"cultural","supersedes_claim_id":null,"value":{"direction":"relief_over_celebration","observation_count":4}},{"asserted_at":"2026-09-27T12:59:00Z","claim_id":"d1250008-0000-4000-8000-000000000006","claim_kind":"lore","content_hash":"9be7ef594118c81d980d25a343ade42b6dfc2932c9a3a31eb69170584aee117d","created_at":"2026-09-27T12:59:00Z","initial_status":"confirmed","initial_usage_class":"assertable","origin":"external_publisher","predicate":"supporter_phrase_long_ten","subject":{"entity_ref":"entity_northbridge_fc"},"subject_domain":"cultural","supersedes_claim_id":null,"value":{"attested_since_year":2019,"phrase":"the long ten"}},{"asserted_at":"2026-09-27T12:59:00Z","claim_id":"d1250008-0000-4000-8000-000000000007","claim_kind":"desk_derived","content_hash":"cabbed4a2abed81a76fa2a0d4ce7ca2232545224ffbd37ac5a01e1b56fb2063f","created_at":"2026-09-27T12:59:00Z","initial_status":"confirmed","initial_usage_class":"assertable","origin":"desk_derived","predicate":"late_concessions_recent","subject":{"entity_ref":"entity_northbridge_fc"},"subject_domain":"statistical","supersedes_claim_id":null,"value":{"after_minute":80,"count":3,"sample_size":5}},{"asserted_at":"2026-09-27T12:59:00Z","claim_id":"d1250008-0000-4000-8000-000000000008","claim_kind":"analysis","content_hash":"d635b3253e5d2aba9cea12a2ac3495606ebac7d3d365b6b9623d613fa92e7a53","created_at":"2026-09-27T12:59:00Z","initial_status":"confirmed","initial_usage_class":"silent","origin":"data_provider","predicate":"next_match_market_probability","subject":{"entity_ref":"entity_northbridge_fc"},"subject_domain":"statistical","supersedes_claim_id":null,"value":{"scalar":"0.58","unit":"probability"}},{"asserted_at":"2026-09-27T12:59:00Z","claim_id":"d1250008-0000-4000-8000-000000000009","claim_kind":"program_history","content_hash":"92d17eee43920805daf81919b546e7be44a50915d579e4da84ff5782e828d54f","created_at":"2026-09-27T12:59:00Z","initial_status":"confirmed","initial_usage_class":"assertable","origin":"desk_derived","predicate":"prior_published_position","subject":{"entity_ref":"entity_northbridge_fc"},"subject_domain":"historical","supersedes_claim_id":null,"value":{"position":"late-game control remained unresolved","topic_thread_id":"thr_late_game_control"}}],"derivations":[{"created_at":"2026-09-27T12:59:30Z","derivation_run_id":"d1250009-0000-4000-8000-000000000001","exact_input_refs":[{"content_hash":"3c7a7888d1ae4d5c6a40aadae89f0db9cf0732c3a22265c65ac688867c785150","evidence_unit_id":"d1250007-0000-4000-8000-000000000012","selected_provenance":{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"entity_identity":"entity_northbridge_fc","event_completed_at":"2026-09-21T12:00:00Z","event_identity":"event_fixture_previous_1","evidence_unit_id":"d1250007-0000-4000-8000-000000000012","language":"en-GB","locator":{"body_codepoint_end":52,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000012","kind":"synthetic_fixture_text","member":"evidence_store.json"},"origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_prev_1:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null,"window_identity":"fixture-last-five-league-before-event-001-v1","window_order":1},"window_proof":{"as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","complete_prior_schedule_assertion":true,"current_event":{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-27T12:00:00Z","completion_status":"final","event_identity":"event_fixture_001","participant_entities":["entity_northbridge_fc","entity_southbank_athletic"]},"current_event_identity":"event_fixture_001","entity_identity":"entity_northbridge_fc","ordered_prior_schedule":[{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-21T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_1","rank_before_current_event":1},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-14T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_2","rank_before_current_event":2},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-07T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_3","rank_before_current_event":3},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-31T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_4","rank_before_current_event":4},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-24T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_5","rank_before_current_event":5},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-17T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_6","rank_before_current_event":6}],"schedule_scope":"complete six most recent prior completed league matches in this synthetic fixture","selected_event_identities":["event_fixture_previous_1","event_fixture_previous_2","event_fixture_previous_3","event_fixture_previous_4","event_fixture_previous_5"],"selection_rule":"last five completed league matches before current event; descending completion time","source_identity":"src_fixture_data","source_record_ref":"fixture-schedule-ledger-v1","synthetic":true,"window_identity":"fixture-last-five-league-before-event-001-v1"}},{"content_hash":"ad8cbb012e22007db8c815249f907fbbf2039b63c83d3d9be6a222249a7ffd24","evidence_unit_id":"d1250007-0000-4000-8000-000000000013","selected_provenance":{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"entity_identity":"entity_northbridge_fc","event_completed_at":"2026-09-14T12:00:00Z","event_identity":"event_fixture_previous_2","evidence_unit_id":"d1250007-0000-4000-8000-000000000013","language":"en-GB","locator":{"body_codepoint_end":62,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000013","kind":"synthetic_fixture_text","member":"evidence_store.json"},"origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_prev_2:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null,"window_identity":"fixture-last-five-league-before-event-001-v1","window_order":2},"window_proof":{"as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","complete_prior_schedule_assertion":true,"current_event":{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-27T12:00:00Z","completion_status":"final","event_identity":"event_fixture_001","participant_entities":["entity_northbridge_fc","entity_southbank_athletic"]},"current_event_identity":"event_fixture_001","entity_identity":"entity_northbridge_fc","ordered_prior_schedule":[{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-21T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_1","rank_before_current_event":1},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-14T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_2","rank_before_current_event":2},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-07T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_3","rank_before_current_event":3},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-31T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_4","rank_before_current_event":4},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-24T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_5","rank_before_current_event":5},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-17T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_6","rank_before_current_event":6}],"schedule_scope":"complete six most recent prior completed league matches in this synthetic fixture","selected_event_identities":["event_fixture_previous_1","event_fixture_previous_2","event_fixture_previous_3","event_fixture_previous_4","event_fixture_previous_5"],"selection_rule":"last five completed league matches before current event; descending completion time","source_identity":"src_fixture_data","source_record_ref":"fixture-schedule-ledger-v1","synthetic":true,"window_identity":"fixture-last-five-league-before-event-001-v1"}},{"content_hash":"c5ff2da2639e0f56c53a2812dda8e435f5c7ccfd1df7fe306ace66e075652fba","evidence_unit_id":"d1250007-0000-4000-8000-000000000014","selected_provenance":{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"entity_identity":"entity_northbridge_fc","event_completed_at":"2026-09-07T12:00:00Z","event_identity":"event_fixture_previous_3","evidence_unit_id":"d1250007-0000-4000-8000-000000000014","language":"en-GB","locator":{"body_codepoint_end":52,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000014","kind":"synthetic_fixture_text","member":"evidence_store.json"},"origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_prev_3:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null,"window_identity":"fixture-last-five-league-before-event-001-v1","window_order":3},"window_proof":{"as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","complete_prior_schedule_assertion":true,"current_event":{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-27T12:00:00Z","completion_status":"final","event_identity":"event_fixture_001","participant_entities":["entity_northbridge_fc","entity_southbank_athletic"]},"current_event_identity":"event_fixture_001","entity_identity":"entity_northbridge_fc","ordered_prior_schedule":[{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-21T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_1","rank_before_current_event":1},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-14T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_2","rank_before_current_event":2},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-07T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_3","rank_before_current_event":3},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-31T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_4","rank_before_current_event":4},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-24T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_5","rank_before_current_event":5},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-17T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_6","rank_before_current_event":6}],"schedule_scope":"complete six most recent prior completed league matches in this synthetic fixture","selected_event_identities":["event_fixture_previous_1","event_fixture_previous_2","event_fixture_previous_3","event_fixture_previous_4","event_fixture_previous_5"],"selection_rule":"last five completed league matches before current event; descending completion time","source_identity":"src_fixture_data","source_record_ref":"fixture-schedule-ledger-v1","synthetic":true,"window_identity":"fixture-last-five-league-before-event-001-v1"}},{"content_hash":"fa9d0a653d449f5d4b599799dffcc487e04f2cc24dbcec7e0451bb102eebdc6b","evidence_unit_id":"d1250007-0000-4000-8000-000000000015","selected_provenance":{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"entity_identity":"entity_northbridge_fc","event_completed_at":"2026-08-31T12:00:00Z","event_identity":"event_fixture_previous_4","evidence_unit_id":"d1250007-0000-4000-8000-000000000015","language":"en-GB","locator":{"body_codepoint_end":62,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000015","kind":"synthetic_fixture_text","member":"evidence_store.json"},"origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_prev_4:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null,"window_identity":"fixture-last-five-league-before-event-001-v1","window_order":4},"window_proof":{"as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","complete_prior_schedule_assertion":true,"current_event":{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-27T12:00:00Z","completion_status":"final","event_identity":"event_fixture_001","participant_entities":["entity_northbridge_fc","entity_southbank_athletic"]},"current_event_identity":"event_fixture_001","entity_identity":"entity_northbridge_fc","ordered_prior_schedule":[{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-21T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_1","rank_before_current_event":1},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-14T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_2","rank_before_current_event":2},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-07T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_3","rank_before_current_event":3},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-31T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_4","rank_before_current_event":4},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-24T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_5","rank_before_current_event":5},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-17T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_6","rank_before_current_event":6}],"schedule_scope":"complete six most recent prior completed league matches in this synthetic fixture","selected_event_identities":["event_fixture_previous_1","event_fixture_previous_2","event_fixture_previous_3","event_fixture_previous_4","event_fixture_previous_5"],"selection_rule":"last five completed league matches before current event; descending completion time","source_identity":"src_fixture_data","source_record_ref":"fixture-schedule-ledger-v1","synthetic":true,"window_identity":"fixture-last-five-league-before-event-001-v1"}},{"content_hash":"b21989b1b1461ca40d2ce84498250648e5f03949881d9fc3e82167fbf36acba5","evidence_unit_id":"d1250007-0000-4000-8000-000000000016","selected_provenance":{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"entity_identity":"entity_northbridge_fc","event_completed_at":"2026-08-24T12:00:00Z","event_identity":"event_fixture_previous_5","evidence_unit_id":"d1250007-0000-4000-8000-000000000016","language":"en-GB","locator":{"body_codepoint_end":52,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000016","kind":"synthetic_fixture_text","member":"evidence_store.json"},"origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_prev_5:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null,"window_identity":"fixture-last-five-league-before-event-001-v1","window_order":5},"window_proof":{"as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","complete_prior_schedule_assertion":true,"current_event":{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-27T12:00:00Z","completion_status":"final","event_identity":"event_fixture_001","participant_entities":["entity_northbridge_fc","entity_southbank_athletic"]},"current_event_identity":"event_fixture_001","entity_identity":"entity_northbridge_fc","ordered_prior_schedule":[{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-21T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_1","rank_before_current_event":1},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-14T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_2","rank_before_current_event":2},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-07T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_3","rank_before_current_event":3},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-31T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_4","rank_before_current_event":4},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-24T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_5","rank_before_current_event":5},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-17T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_6","rank_before_current_event":6}],"schedule_scope":"complete six most recent prior completed league matches in this synthetic fixture","selected_event_identities":["event_fixture_previous_1","event_fixture_previous_2","event_fixture_previous_3","event_fixture_previous_4","event_fixture_previous_5"],"selection_rule":"last five completed league matches before current event; descending completion time","source_identity":"src_fixture_data","source_record_ref":"fixture-schedule-ledger-v1","synthetic":true,"window_identity":"fixture-last-five-league-before-event-001-v1"}}],"output":{"after_minute":80,"count":3,"sample_size":5},"output_hash":"eb65fd3581e65333e7dcc68a0150e17dc8e728c8e348510b7c3ca12f2d748a88","parameters":{"after_minute":80,"window_matches":5},"rule_version":"late-concession-count/v1"}],"evidence_bodies":[{"canonical_content":"The East Bank Review Archive records the Northbridge supporter phrase \'the long ten\' in its 2019 season notes.","content_hash":"413c4fc6bbce8ab3ec6704e07bfc85f7e6800b92ae8f51de1c430b65a74c6ee3","created_at":"2026-09-27T12:59:00Z","evidence_type":"context","evidence_unit_id":"d1250007-0000-4000-8000-000000000009","rights_version_id":"d1250006-0000-4000-8000-000000000006","supersedes_evidence_unit_id":null,"usage_class":"assertable"},{"canonical_content":"Previous match 1: Northbridge conceded in minute 84.","content_hash":"3c7a7888d1ae4d5c6a40aadae89f0db9cf0732c3a22265c65ac688867c785150","created_at":"2026-09-27T12:59:00Z","evidence_type":"fact","evidence_unit_id":"d1250007-0000-4000-8000-000000000012","rights_version_id":"d1250006-0000-4000-8000-000000000002","supersedes_evidence_unit_id":null,"usage_class":"assertable"},{"canonical_content":"Previous match 2: Northbridge did not concede after minute 80.","content_hash":"ad8cbb012e22007db8c815249f907fbbf2039b63c83d3d9be6a222249a7ffd24","created_at":"2026-09-27T12:59:00Z","evidence_type":"fact","evidence_unit_id":"d1250007-0000-4000-8000-000000000013","rights_version_id":"d1250006-0000-4000-8000-000000000002","supersedes_evidence_unit_id":null,"usage_class":"assertable"},{"canonical_content":"Previous match 3: Northbridge conceded in minute 88.","content_hash":"c5ff2da2639e0f56c53a2812dda8e435f5c7ccfd1df7fe306ace66e075652fba","created_at":"2026-09-27T12:59:00Z","evidence_type":"fact","evidence_unit_id":"d1250007-0000-4000-8000-000000000014","rights_version_id":"d1250006-0000-4000-8000-000000000002","supersedes_evidence_unit_id":null,"usage_class":"assertable"},{"canonical_content":"Previous match 4: Northbridge did not concede after minute 80.","content_hash":"fa9d0a653d449f5d4b599799dffcc487e04f2cc24dbcec7e0451bb102eebdc6b","created_at":"2026-09-27T12:59:00Z","evidence_type":"fact","evidence_unit_id":"d1250007-0000-4000-8000-000000000015","rights_version_id":"d1250006-0000-4000-8000-000000000002","supersedes_evidence_unit_id":null,"usage_class":"assertable"},{"canonical_content":"Previous match 5: Northbridge conceded in minute 90.","content_hash":"b21989b1b1461ca40d2ce84498250648e5f03949881d9fc3e82167fbf36acba5","created_at":"2026-09-27T12:59:00Z","evidence_type":"fact","evidence_unit_id":"d1250007-0000-4000-8000-000000000016","rights_version_id":"d1250006-0000-4000-8000-000000000002","supersedes_evidence_unit_id":null,"usage_class":"assertable"}],"rights_versions":[{"created_at":"2026-09-27T12:30:00Z","policy":{"acquisition_permission":true,"attribution":{"exact_source_credit_refs":["src_north_coast_league"],"required_for_spoken_reporting":false,"supporter_identity_minimization":true},"consumer_exposure_ceiling":{"auditor":["claim_only"],"planner":["claim_only"],"writer":["claim_only"]},"covered_source_identities":["src_north_coast_league"],"grant_identity":"fixture-official-v1","grantor":"The Desk synthetic fixture author","paraphrase_permission":true,"provider_exposure":{"external_providers":false,"fixture_stub":"rights-safe refs and permitted bounded consumer representations only","fixture_tts":"approved final spoken text only"},"quotation_permission":false,"retention":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"synthetic_grant":true},"rights_version_id":"d1250006-0000-4000-8000-000000000004","source_identity":"fixture-grant:fixture-official-v1"},{"created_at":"2026-09-27T12:30:00Z","policy":{"acquisition_permission":true,"attribution":{"exact_source_credit_refs":["src_fixture_data"],"required_for_spoken_reporting":false,"supporter_identity_minimization":true},"consumer_exposure_ceiling":{"auditor":["claim_only"],"planner":["claim_only"],"writer":["claim_only","hidden"]},"covered_source_identities":["src_fixture_data"],"grant_identity":"fixture-data-v1","grantor":"The Desk synthetic fixture author","paraphrase_permission":true,"provider_exposure":{"external_providers":false,"fixture_stub":"rights-safe refs and permitted bounded consumer representations only","fixture_tts":"approved final spoken text only"},"quotation_permission":false,"retention":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"synthetic_grant":true},"rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"fixture-grant:fixture-data-v1"},{"created_at":"2026-09-27T12:30:00Z","policy":{"acquisition_permission":true,"attribution":{"exact_source_credit_refs":["src_matchboard_analysis","src_north_coast_gazette"],"required_for_spoken_reporting":true,"supporter_identity_minimization":true},"consumer_exposure_ceiling":{"auditor":["exact_excerpt"],"planner":["paraphrase"],"writer":["paraphrase"]},"covered_source_identities":["src_matchboard_analysis","src_north_coast_gazette"],"grant_identity":"fixture-paraphrase-v1","grantor":"The Desk synthetic fixture author","paraphrase_permission":true,"provider_exposure":{"external_providers":false,"fixture_stub":"rights-safe refs and permitted bounded consumer representations only","fixture_tts":"approved final spoken text only"},"quotation_permission":false,"retention":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"synthetic_grant":true},"rights_version_id":"d1250006-0000-4000-8000-000000000005","source_identity":"fixture-grant:fixture-paraphrase-v1"},{"created_at":"2026-09-27T12:30:00Z","policy":{"acquisition_permission":true,"attribution":{"exact_source_credit_refs":["src_supporter_blog_c","src_supporter_forum_a","src_supporter_forum_d","src_supporter_podcast_b"],"required_for_spoken_reporting":false,"supporter_identity_minimization":true},"consumer_exposure_ceiling":{"auditor":["exact_excerpt"],"planner":["paraphrase"],"writer":["paraphrase"]},"covered_source_identities":["src_supporter_blog_c","src_supporter_forum_a","src_supporter_forum_d","src_supporter_podcast_b"],"grant_identity":"fixture-supporter-v1","grantor":"The Desk synthetic fixture author","paraphrase_permission":true,"provider_exposure":{"external_providers":false,"fixture_stub":"rights-safe refs and permitted bounded consumer representations only","fixture_tts":"approved final spoken text only"},"quotation_permission":false,"retention":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"synthetic_grant":true},"rights_version_id":"d1250006-0000-4000-8000-000000000007","source_identity":"fixture-grant:fixture-supporter-v1"},{"created_at":"2026-09-27T12:30:00Z","policy":{"acquisition_permission":true,"attribution":{"exact_source_credit_refs":["src_east_bank_review_archive"],"required_for_spoken_reporting":false,"supporter_identity_minimization":true},"consumer_exposure_ceiling":{"auditor":["exact_excerpt"],"planner":["exact_excerpt"],"writer":["exact_excerpt"]},"covered_source_identities":["src_east_bank_review_archive"],"grant_identity":"fixture-quote-v1","grantor":"The Desk synthetic fixture author","paraphrase_permission":true,"provider_exposure":{"external_providers":false,"fixture_stub":"rights-safe refs and permitted bounded consumer representations only","fixture_tts":"approved final spoken text only"},"quotation_permission":true,"retention":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"synthetic_grant":true},"rights_version_id":"d1250006-0000-4000-8000-000000000006","source_identity":"fixture-grant:fixture-quote-v1"},{"created_at":"2026-09-27T12:30:00Z","policy":{"acquisition_permission":true,"attribution":{"exact_source_credit_refs":["src_fixture_market"],"required_for_spoken_reporting":false,"supporter_identity_minimization":true},"consumer_exposure_ceiling":{"auditor":["claim_only"],"planner":["claim_only"],"writer":["hidden"]},"covered_source_identities":["src_fixture_market"],"grant_identity":"fixture-market-v1","grantor":"The Desk synthetic fixture author","paraphrase_permission":false,"provider_exposure":{"external_providers":false,"fixture_stub":"rights-safe refs and permitted bounded consumer representations only","fixture_tts":"approved final spoken text only"},"quotation_permission":false,"retention":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"synthetic_grant":true},"rights_version_id":"d1250006-0000-4000-8000-000000000003","source_identity":"fixture-grant:fixture-market-v1"},{"created_at":"2026-09-27T12:30:00Z","policy":{"acquisition_permission":true,"attribution":{"exact_source_credit_refs":["src_malicious_fixture"],"required_for_spoken_reporting":false,"supporter_identity_minimization":true},"consumer_exposure_ceiling":{"auditor":["exact_excerpt"],"planner":["hidden"],"writer":["hidden"]},"covered_source_identities":["src_malicious_fixture"],"grant_identity":"fixture-audit-only-v1","grantor":"The Desk synthetic fixture author","paraphrase_permission":false,"provider_exposure":{"external_providers":false,"fixture_stub":"rights-safe refs and permitted bounded consumer representations only","fixture_tts":"approved final spoken text only"},"quotation_permission":false,"retention":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"synthetic_grant":true},"rights_version_id":"d1250006-0000-4000-8000-000000000001","source_identity":"fixture-grant:fixture-audit-only-v1"}],"support_carriers":[{"artifact_id":"d1250005-0000-4000-8000-000000000017","canonical_payload":{"projection":{"as_of":"2026-09-27T12:59:00Z","authored_synthetic_interpretation":{"confidence":"medium","direction":"relief_over_celebration","intensity":"moderate"},"entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","method_version":"bounded-supporter-tenor/v1","observation_count":4,"observation_set_identity":"fixture-supporter-reaction-event-001-v1","observations":[{"content_hash":"bb010e8fa7d1b2925a142620f20771294db03a6077c78ab72b041a3601cd41f3","evidence_unit_id":"d1250007-0000-4000-8000-000000000005","observation_order":1,"scoped_description_ref":{"evidence_unit_id":"d1250007-0000-4000-8000-000000000005","member":"evidence_store.json"},"source_identity":"src_supporter_forum_a"},{"content_hash":"290dca152f388f068d078aca310869cb6aebc6506588f9c9d06de4a5cce1d7e0","evidence_unit_id":"d1250007-0000-4000-8000-000000000006","observation_order":2,"scoped_description_ref":{"evidence_unit_id":"d1250007-0000-4000-8000-000000000006","member":"evidence_store.json"},"source_identity":"src_supporter_podcast_b"},{"content_hash":"3089e7a00a05ca9145a2b83edf9dc3e0fd7d1b7be70df5f5f69ffde049958e21","evidence_unit_id":"d1250007-0000-4000-8000-000000000007","observation_order":3,"scoped_description_ref":{"evidence_unit_id":"d1250007-0000-4000-8000-000000000007","member":"evidence_store.json"},"source_identity":"src_supporter_blog_c"},{"content_hash":"3a462ce692fcdbdffcb3ce62810b2efbe50a1d18af3460944f46ba00623fdef5","evidence_unit_id":"d1250007-0000-4000-8000-000000000008","observation_order":4,"scoped_description_ref":{"evidence_unit_id":"d1250007-0000-4000-8000-000000000008","member":"evidence_store.json"},"source_identity":"src_supporter_forum_d"}]},"support_kind":"signal"},"content_hash":"46e6a24048f151f62f9e03a66bb57ca4aae78c0281630850bc74bf9205cd4c28"},{"artifact_id":"d1250005-0000-4000-8000-000000000018","canonical_payload":{"projection":{"external_episode_ref":"fixture-external:episode_fixture_prior_001","external_script_ref":"fixture-external:scr_fixture_prior_001","external_script_version_ref":"fixture-external:prior-script/v1","on_air_occurrence":{"exact_text":"Late-game control remains unresolved.","occurrence_identity":"fixture-external:late-control-occurrence-001","occurrence_time":"2026-09-21T13:30:00Z","participant_identity":"tully","position":"late-game control remained unresolved","semantic_turn_ref":"prior_tully_close_001"},"publication_attestation":{"attestation_identity":"fixture-external:publication-attestation-001","attested_by":"The Desk synthetic fixture author","published_at":"2026-09-21T14:00:00Z","state":"published","synthetic":true},"topic_thread_id":"thr_late_game_control","withdrawn":false},"support_kind":"continuity"},"content_hash":"2192b1ec1e126a0d7f705e69338cc5e2b457c6cd8f13136bc07f72cccdf46dd1"}]}';
const EXPECTED_FIELDS =
  '{"assurance":"snapshot_consistency_only","availability":{"continuity":{"state":"available"},"historical_context":{"state":"available"},"independent_analysis":{"state":"available"},"licensed_tracking_data":{"reason":"provider_not_configured","state":"not_applicable"},"serious_incident":{"reason":"no_confirmed_in_scope_incident","state":"absent"},"structured_stats":{"state":"available"},"supporter_evidence":{"observation_count":4,"state":"available"},"verified_result":{"state":"available"}},"beats":[{"beat_id":"beat_control","candidate_selection_score":"0.92","label":"late-game control","member_claim_refs":["d1250008-0000-4000-8000-000000000001","d1250008-0000-4000-8000-000000000002","d1250008-0000-4000-8000-000000000003","d1250008-0000-4000-8000-000000000004","d1250008-0000-4000-8000-000000000007"]},{"beat_id":"beat_supporter","candidate_selection_score":"0.83","label":"supporter consequence","member_claim_refs":["d1250008-0000-4000-8000-000000000005","d1250008-0000-4000-8000-000000000006","d1250008-0000-4000-8000-000000000009"]},{"beat_id":"beat_market","candidate_selection_score":"0.20","label":"market calibration","member_claim_refs":["d1250008-0000-4000-8000-000000000008"]}],"claims":[{"consumption":"ordinary_snapshot","snapshot":{"attribution_requirement":{"required":false},"claim_content_hash":"fbb285c68fd26f5bb5cd26b6f0179d9aa0062e30e84e47e98c8c8d14292c2aa1","claim_id":"d1250008-0000-4000-8000-000000000001","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"2239630f0ed9835266704ae1432d3b269dccfdd2d43b946a2b969aae310e9e94","initial_status":"confirmed","initial_usage_class":"assertable","kind":"event_fact","origin":"official_source","predicate":"match_result","reduced_usage_class":"assertable","state_event_cursor":null,"subject_domain":"statistical","subject_ref":"entity_northbridge_fc","support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000001","derivation_run_id":null,"evidence_unit_id":"d1250007-0000-4000-8000-000000000001","external_support_identity":null,"support_hash":"5dfd65df76fdcd9b3fa8b2ab730cb38712f3941875ad2ae1319d788d256bd1a3","support_kind":"evidence","support_role":"supports_value"}],"value_type":"scoreline"},"value":{"northbridge_goals":2,"southbank_goals":1},"value_status":"packaged_typed_value"},{"consumption":"ordinary_snapshot","snapshot":{"attribution_requirement":{"required":false},"claim_content_hash":"55e10cb05eef3ff50b04d02b9c328bd502e7f3af840ecd774ffe7f9743408376","claim_id":"d1250008-0000-4000-8000-000000000002","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"db0710627bea350c1ca0d9c3344c951c9bb57d7740dd8c23bbc91a7060fd732f","initial_status":"confirmed","initial_usage_class":"assertable","kind":"event_fact","origin":"data_provider","predicate":"possession_percent","reduced_usage_class":"assertable","state_event_cursor":null,"subject_domain":"statistical","subject_ref":"entity_northbridge_fc","support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000002","derivation_run_id":null,"evidence_unit_id":"d1250007-0000-4000-8000-000000000002","external_support_identity":null,"support_hash":"a5565030c5163db39ffd10a1cd80a07cb30559d898737d23d87fc4f029fefdb0","support_kind":"evidence","support_role":"supports_value"}],"value_type":"exact_decimal"},"value":{"scalar":"43","unit":"percent"},"value_status":"packaged_typed_value"},{"consumption":"ordinary_snapshot","snapshot":{"attribution_requirement":{"approved_prefix":"The North Coast Gazette reports","required":true,"source_id":"src_north_coast_gazette"},"claim_content_hash":"a6b3d89db355e2854bf35519496959e3b343639ff074be88202d9c10a4f74d38","claim_id":"d1250008-0000-4000-8000-000000000003","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"3de1334c7a8e5c58ba2cbdd531d6541bec7e1a7f5fc7447714b41b584af2bae4","initial_status":"confirmed","initial_usage_class":"assertable","kind":"reported_fact","origin":"external_publisher","predicate":"closing_shape_rehearsed","reduced_usage_class":"assertable","state_event_cursor":null,"subject_domain":"tactical","subject_ref":"entity_northbridge_fc","support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000003","derivation_run_id":null,"evidence_unit_id":"d1250007-0000-4000-8000-000000000003","external_support_identity":null,"support_hash":"a71d542b57e7edcfe91186a9a934b0301845599b4a40f7fecb8d6e633b4b8578","support_kind":"evidence","support_role":"supports_value"}],"value_type":"structured_text"},"value":null,"value_status":"withheld_pending_representation"},{"consumption":"ordinary_snapshot","snapshot":{"attribution_requirement":{"approved_prefix":"One specialist analysis in the package suggests","required":true,"source_id":"src_matchboard_analysis"},"claim_content_hash":"f8bdddac5d0d10856a94121cd1dd178fd650477cbd82e338afa52cde5b228672","claim_id":"d1250008-0000-4000-8000-000000000004","effective_usage_class":"hedged_only","frozen_state":"confirmed","frozen_state_hash":"59580d5287ca5d6d8c428d73936fc442c21454be258e5b0c6d4b5209b2fca4cd","initial_status":"confirmed","initial_usage_class":"hedged_only","kind":"analysis","origin":"external_publisher","predicate":"southbank_wide_response","reduced_usage_class":"hedged_only","state_event_cursor":null,"subject_domain":"tactical","subject_ref":"entity_northbridge_fc","support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000004","derivation_run_id":null,"evidence_unit_id":"d1250007-0000-4000-8000-000000000004","external_support_identity":null,"support_hash":"98cc45be73f4be9296b343ad543d249a63fc20f6c31daf0a86b6c90eb1b8e4df","support_kind":"evidence","support_role":"supports_value"}],"value_type":"analysis_text"},"value":null,"value_status":"withheld_pending_representation"},{"consumption":"ordinary_snapshot","snapshot":{"attribution_requirement":{"approved_prefix":"Across four supporter sources in the package","required":true,"source_id":"supporter_sample"},"claim_content_hash":"077522e8f69193fa36fa038ab8378b3780c49456f67ea9eb730c928da00733c5","claim_id":"d1250008-0000-4000-8000-000000000005","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"4a32d360454d615f54c7b467e95338c8cde8c9388c67919aa9bc4bcf8fa41a8e","initial_status":"confirmed","initial_usage_class":"assertable","kind":"mood","origin":"supporter_source","predicate":"supporter_postmatch_tenor","reduced_usage_class":"assertable","state_event_cursor":null,"subject_domain":"cultural","subject_ref":"entity_northbridge_fc","support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000005","derivation_run_id":null,"evidence_unit_id":null,"external_support_identity":"artifact:d1250005-0000-4000-8000-000000000017","support_hash":"46e6a24048f151f62f9e03a66bb57ca4aae78c0281630850bc74bf9205cd4c28","support_kind":"signal","support_role":"supports_value"}],"value_type":"tenor"},"value":{"direction":"relief_over_celebration","observation_count":4},"value_status":"packaged_typed_value"},{"consumption":"ordinary_snapshot","snapshot":{"attribution_requirement":{"required":false},"claim_content_hash":"9be7ef594118c81d980d25a343ade42b6dfc2932c9a3a31eb69170584aee117d","claim_id":"d1250008-0000-4000-8000-000000000006","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"2999b750b23ef1a6c98b3b6ab029a0cf734ea6d2ca9a823f5420dce700bcfc5f","initial_status":"confirmed","initial_usage_class":"assertable","kind":"lore","origin":"external_publisher","predicate":"supporter_phrase_long_ten","reduced_usage_class":"assertable","state_event_cursor":null,"subject_domain":"cultural","subject_ref":"entity_northbridge_fc","support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000006","derivation_run_id":null,"evidence_unit_id":"d1250007-0000-4000-8000-000000000009","external_support_identity":null,"support_hash":"413c4fc6bbce8ab3ec6704e07bfc85f7e6800b92ae8f51de1c430b65a74c6ee3","support_kind":"evidence","support_role":"supports_value"}],"value_type":"lore_phrase"},"value":{"attested_since_year":2019,"phrase":"the long ten"},"value_status":"packaged_typed_value"},{"consumption":"ordinary_snapshot","snapshot":{"attribution_requirement":{"required":false},"claim_content_hash":"cabbed4a2abed81a76fa2a0d4ce7ca2232545224ffbd37ac5a01e1b56fb2063f","claim_id":"d1250008-0000-4000-8000-000000000007","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"98fa9d6b3406e2b5734cc8fcc12cdd9038e9976838d95f1d4b7f8321ecfb833e","initial_status":"confirmed","initial_usage_class":"assertable","kind":"desk_derived","origin":"desk_derived","predicate":"late_concessions_recent","reduced_usage_class":"assertable","state_event_cursor":null,"subject_domain":"statistical","subject_ref":"entity_northbridge_fc","support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000007","derivation_run_id":"d1250009-0000-4000-8000-000000000001","evidence_unit_id":null,"external_support_identity":null,"support_hash":"eb65fd3581e65333e7dcc68a0150e17dc8e728c8e348510b7c3ca12f2d748a88","support_kind":"derivation","support_role":"supports_value"}],"value_type":"count_window"},"value":{"after_minute":80,"count":3,"sample_size":5},"value_status":"packaged_typed_value"},{"consumption":"silent_calibration_only","snapshot":{"attribution_requirement":{"required":false},"claim_content_hash":"d635b3253e5d2aba9cea12a2ac3495606ebac7d3d365b6b9623d613fa92e7a53","claim_id":"d1250008-0000-4000-8000-000000000008","effective_usage_class":"silent","frozen_state":"confirmed","frozen_state_hash":"4006b76c4b9ad0bd1a841ddaa5930d877c110fb821f522c45f71ae2c8ae1ffa3","initial_status":"confirmed","initial_usage_class":"silent","kind":"analysis","origin":"data_provider","predicate":"next_match_market_probability","reduced_usage_class":"silent","state_event_cursor":null,"subject_domain":"statistical","subject_ref":"entity_northbridge_fc","support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000008","derivation_run_id":null,"evidence_unit_id":"d1250007-0000-4000-8000-000000000010","external_support_identity":null,"support_hash":"348f6a219bc56f3d69f86267c1669d9c672f30db7712dc88cd6a8f4ff6e1f8f4","support_kind":"evidence","support_role":"supports_value"}],"value_type":"exact_decimal"},"value":{"scalar":"0.58","unit":"probability"},"value_status":"packaged_typed_value"},{"consumption":"ordinary_snapshot","snapshot":{"attribution_requirement":{"required":false},"claim_content_hash":"92d17eee43920805daf81919b546e7be44a50915d579e4da84ff5782e828d54f","claim_id":"d1250008-0000-4000-8000-000000000009","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"dfa61e2a799d3966fe4eccb6998b9d4925e074a04ad07724d95957d4052d8231","initial_status":"confirmed","initial_usage_class":"assertable","kind":"program_history","origin":"desk_derived","predicate":"prior_published_position","reduced_usage_class":"assertable","state_event_cursor":null,"subject_domain":"historical","subject_ref":"entity_northbridge_fc","support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000009","derivation_run_id":null,"evidence_unit_id":null,"external_support_identity":"artifact:d1250005-0000-4000-8000-000000000018","support_hash":"2192b1ec1e126a0d7f705e69338cc5e2b457c6cd8f13136bc07f72cccdf46dd1","support_kind":"continuity","support_role":"supports_value"}],"value_type":"program_history"},"value":{"position":"late-game control remained unresolved","topic_thread_id":"thr_late_game_control"},"value_status":"packaged_typed_value"}],"context_candidates":[{"claim_id":"d1250008-0000-4000-8000-000000000007","context_id":"ctx_latepattern","functions":["supports","continuity"],"reason":"Recent late-concession pattern sharpens the control question."},{"claim_id":"d1250008-0000-4000-8000-000000000006","context_id":"ctx_lore","functions":["meaning"],"reason":"Approved supporter language explains why the final minutes feel culturally familiar."},{"claim_id":"d1250008-0000-4000-8000-000000000009","context_id":"ctx_continuity","functions":["continuity"],"reason":"Prior published position makes the unresolved thread explicit."}],"continuity":[{"continuity_id":"artifact:d1250005-0000-4000-8000-000000000018","published_only":true,"topic_thread_id":"thr_late_game_control","withdrawn":false}],"coverage_conditions":[{"condition":"normal_match_analysis","state":"satisfied"},{"condition":"supporter_texture","state":"satisfied"},{"condition":"independent_analysis","state":"satisfied"}],"evidence":[{"claim_representation_refs":["d1250008-0000-4000-8000-000000000001"],"representation":null,"representation_status":"claim_only","snapshot":{"acquisition_ref":"fixture-acquisition:src_north_coast_league:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"claim_only"},"content_hash":"5dfd65df76fdcd9b3fa8b2ab730cb38712f3941875ad2ae1319d788d256bd1a3","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","evidence_type":"fact","evidence_unit_id":"d1250007-0000-4000-8000-000000000001","language":"en-GB","locator":{"body_codepoint_end":46,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000001","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"structured_data","origin":"official_source","paraphrase_permission":true,"quote_permission":false,"retention_class":"fixture_retained","rights_policy_version":"d1250006-0000-4000-8000-000000000004","rights_version_id":"d1250006-0000-4000-8000-000000000004","source_identity":"src_north_coast_league","source_item_identity":"fixture-item:ev_official_result:v1","source_modality":"structured_data","source_role":"official","speaker_identity":null}},{"claim_representation_refs":["d1250008-0000-4000-8000-000000000002"],"representation":null,"representation_status":"claim_only","snapshot":{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"claim_only"},"content_hash":"a5565030c5163db39ffd10a1cd80a07cb30559d898737d23d87fc4f029fefdb0","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","evidence_type":"fact","evidence_unit_id":"d1250007-0000-4000-8000-000000000002","language":"en-GB","locator":{"body_codepoint_end":38,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000002","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"structured_data","origin":"data_provider","paraphrase_permission":true,"quote_permission":false,"retention_class":"fixture_retained","rights_policy_version":"d1250006-0000-4000-8000-000000000002","rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_possession:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null}},{"claim_representation_refs":["d1250008-0000-4000-8000-000000000003"],"representation":null,"representation_status":"paraphrase_not_materialized","snapshot":{"acquisition_ref":"fixture-acquisition:src_north_coast_gazette:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"exact_excerpt","planner":"paraphrase","writer":"paraphrase"},"content_hash":"a71d542b57e7edcfe91186a9a934b0301845599b4a40f7fecb8d6e633b4b8578","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","evidence_type":"observation","evidence_unit_id":"d1250007-0000-4000-8000-000000000003","language":"en-GB","locator":{"body_codepoint_end":98,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000003","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"text","origin":"external_publisher","paraphrase_permission":true,"quote_permission":false,"retention_class":"fixture_retained","rights_policy_version":"d1250006-0000-4000-8000-000000000005","rights_version_id":"d1250006-0000-4000-8000-000000000005","source_identity":"src_north_coast_gazette","source_item_identity":"fixture-item:ev_gazette_shape:v1","source_modality":"text","source_role":"journalist","speaker_identity":null}},{"claim_representation_refs":["d1250008-0000-4000-8000-000000000004"],"representation":null,"representation_status":"paraphrase_not_materialized","snapshot":{"acquisition_ref":"fixture-acquisition:src_matchboard_analysis:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"exact_excerpt","planner":"paraphrase","writer":"paraphrase"},"content_hash":"98cc45be73f4be9296b343ad543d249a63fc20f6c31daf0a86b6c90eb1b8e4df","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","evidence_type":"analysis","evidence_unit_id":"d1250007-0000-4000-8000-000000000004","language":"en-GB","locator":{"body_codepoint_end":126,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000004","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"text","origin":"external_publisher","paraphrase_permission":true,"quote_permission":false,"retention_class":"fixture_retained","rights_policy_version":"d1250006-0000-4000-8000-000000000005","rights_version_id":"d1250006-0000-4000-8000-000000000005","source_identity":"src_matchboard_analysis","source_item_identity":"fixture-item:ev_specialist_wide:v1","source_modality":"text","source_role":"analyst","speaker_identity":null}},{"claim_representation_refs":[],"representation":null,"representation_status":"paraphrase_not_materialized","snapshot":{"acquisition_ref":"fixture-acquisition:src_supporter_forum_a:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"exact_excerpt","planner":"paraphrase","writer":"paraphrase"},"content_hash":"bb010e8fa7d1b2925a142620f20771294db03a6077c78ab72b041a3601cd41f3","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","evidence_type":"sentiment","evidence_unit_id":"d1250007-0000-4000-8000-000000000005","language":"en-GB","locator":{"body_codepoint_end":30,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000005","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"text","origin":"supporter_source","paraphrase_permission":true,"quote_permission":false,"retention_class":"fixture_retained","rights_policy_version":"d1250006-0000-4000-8000-000000000007","rights_version_id":"d1250006-0000-4000-8000-000000000007","source_identity":"src_supporter_forum_a","source_item_identity":"fixture-item:ev_supporter_1:v1","source_modality":"text","source_role":"supporter","speaker_identity":"anonymous-synthetic-observation-1"}},{"claim_representation_refs":[],"representation":null,"representation_status":"paraphrase_not_materialized","snapshot":{"acquisition_ref":"fixture-acquisition:src_supporter_podcast_b:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"exact_excerpt","planner":"paraphrase","writer":"paraphrase"},"content_hash":"290dca152f388f068d078aca310869cb6aebc6506588f9c9d06de4a5cce1d7e0","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","evidence_type":"sentiment","evidence_unit_id":"d1250007-0000-4000-8000-000000000006","language":"en-GB","locator":{"body_codepoint_end":19,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000006","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"audio","origin":"supporter_source","paraphrase_permission":true,"quote_permission":false,"retention_class":"fixture_retained","rights_policy_version":"d1250006-0000-4000-8000-000000000007","rights_version_id":"d1250006-0000-4000-8000-000000000007","source_identity":"src_supporter_podcast_b","source_item_identity":"fixture-item:ev_supporter_2:v1","source_modality":"audio","source_role":"supporter","speaker_identity":"anonymous-synthetic-observation-2"}},{"claim_representation_refs":[],"representation":null,"representation_status":"paraphrase_not_materialized","snapshot":{"acquisition_ref":"fixture-acquisition:src_supporter_blog_c:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"exact_excerpt","planner":"paraphrase","writer":"paraphrase"},"content_hash":"3089e7a00a05ca9145a2b83edf9dc3e0fd7d1b7be70df5f5f69ffde049958e21","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","evidence_type":"sentiment","evidence_unit_id":"d1250007-0000-4000-8000-000000000007","language":"en-GB","locator":{"body_codepoint_end":49,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000007","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"text","origin":"supporter_source","paraphrase_permission":true,"quote_permission":false,"retention_class":"fixture_retained","rights_policy_version":"d1250006-0000-4000-8000-000000000007","rights_version_id":"d1250006-0000-4000-8000-000000000007","source_identity":"src_supporter_blog_c","source_item_identity":"fixture-item:ev_supporter_3:v1","source_modality":"text","source_role":"supporter","speaker_identity":"anonymous-synthetic-observation-3"}},{"claim_representation_refs":[],"representation":null,"representation_status":"paraphrase_not_materialized","snapshot":{"acquisition_ref":"fixture-acquisition:src_supporter_forum_d:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"exact_excerpt","planner":"paraphrase","writer":"paraphrase"},"content_hash":"3a462ce692fcdbdffcb3ce62810b2efbe50a1d18af3460944f46ba00623fdef5","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","evidence_type":"sentiment","evidence_unit_id":"d1250007-0000-4000-8000-000000000008","language":"en-GB","locator":{"body_codepoint_end":13,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000008","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"text","origin":"supporter_source","paraphrase_permission":true,"quote_permission":false,"retention_class":"fixture_retained","rights_policy_version":"d1250006-0000-4000-8000-000000000007","rights_version_id":"d1250006-0000-4000-8000-000000000007","source_identity":"src_supporter_forum_d","source_item_identity":"fixture-item:ev_supporter_4:v1","source_modality":"text","source_role":"supporter","speaker_identity":"anonymous-synthetic-observation-4"}},{"claim_representation_refs":["d1250008-0000-4000-8000-000000000006"],"representation":{"kind":"exact_permitted_span","span_end":83,"span_start":71,"text":"the long ten"},"representation_status":"exact_span","snapshot":{"acquisition_ref":"fixture-acquisition:src_east_bank_review_archive:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"exact_excerpt","planner":"exact_excerpt","writer":"exact_excerpt"},"content_hash":"413c4fc6bbce8ab3ec6704e07bfc85f7e6800b92ae8f51de1c430b65a74c6ee3","entity_identity":"entity_northbridge_fc","event_identity":null,"evidence_type":"context","evidence_unit_id":"d1250007-0000-4000-8000-000000000009","language":"en-GB","locator":{"body_codepoint_end":110,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000009","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"text","origin":"external_publisher","paraphrase_permission":true,"quote_permission":true,"retention_class":"fixture_retained","rights_policy_version":"d1250006-0000-4000-8000-000000000006","rights_version_id":"d1250006-0000-4000-8000-000000000006","source_identity":"src_east_bank_review_archive","source_item_identity":"fixture-item:ev_lore_long_ten:v1","source_modality":"text","source_role":"reference","speaker_identity":null}},{"claim_representation_refs":["d1250008-0000-4000-8000-000000000008"],"representation":null,"representation_status":"claim_only","snapshot":{"acquisition_ref":"fixture-acquisition:src_fixture_market:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"content_hash":"348f6a219bc56f3d69f86267c1669d9c672f30db7712dc88cd6a8f4ff6e1f8f4","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","evidence_type":"analysis","evidence_unit_id":"d1250007-0000-4000-8000-000000000010","language":"en-GB","locator":{"body_codepoint_end":32,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000010","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"structured_data","origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_class":"fixture_retained","rights_policy_version":"d1250006-0000-4000-8000-000000000003","rights_version_id":"d1250006-0000-4000-8000-000000000003","source_identity":"src_fixture_market","source_item_identity":"fixture-item:ev_market:v1","source_modality":"structured_data","source_role":"market","speaker_identity":null}},{"claim_representation_refs":[],"representation":null,"representation_status":"claim_only","snapshot":{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"content_hash":"3c7a7888d1ae4d5c6a40aadae89f0db9cf0732c3a22265c65ac688867c785150","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_1","evidence_type":"fact","evidence_unit_id":"d1250007-0000-4000-8000-000000000012","language":"en-GB","locator":{"body_codepoint_end":52,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000012","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"structured_data","origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_class":"fixture_retained","rights_policy_version":"d1250006-0000-4000-8000-000000000002","rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_prev_1:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null}},{"claim_representation_refs":[],"representation":null,"representation_status":"claim_only","snapshot":{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"content_hash":"ad8cbb012e22007db8c815249f907fbbf2039b63c83d3d9be6a222249a7ffd24","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_2","evidence_type":"fact","evidence_unit_id":"d1250007-0000-4000-8000-000000000013","language":"en-GB","locator":{"body_codepoint_end":62,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000013","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"structured_data","origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_class":"fixture_retained","rights_policy_version":"d1250006-0000-4000-8000-000000000002","rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_prev_2:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null}},{"claim_representation_refs":[],"representation":null,"representation_status":"claim_only","snapshot":{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"content_hash":"c5ff2da2639e0f56c53a2812dda8e435f5c7ccfd1df7fe306ace66e075652fba","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_3","evidence_type":"fact","evidence_unit_id":"d1250007-0000-4000-8000-000000000014","language":"en-GB","locator":{"body_codepoint_end":52,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000014","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"structured_data","origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_class":"fixture_retained","rights_policy_version":"d1250006-0000-4000-8000-000000000002","rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_prev_3:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null}},{"claim_representation_refs":[],"representation":null,"representation_status":"claim_only","snapshot":{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"content_hash":"fa9d0a653d449f5d4b599799dffcc487e04f2cc24dbcec7e0451bb102eebdc6b","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_4","evidence_type":"fact","evidence_unit_id":"d1250007-0000-4000-8000-000000000015","language":"en-GB","locator":{"body_codepoint_end":62,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000015","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"structured_data","origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_class":"fixture_retained","rights_policy_version":"d1250006-0000-4000-8000-000000000002","rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_prev_4:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null}},{"claim_representation_refs":[],"representation":null,"representation_status":"claim_only","snapshot":{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"content_hash":"b21989b1b1461ca40d2ce84498250648e5f03949881d9fc3e82167fbf36acba5","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_5","evidence_type":"fact","evidence_unit_id":"d1250007-0000-4000-8000-000000000016","language":"en-GB","locator":{"body_codepoint_end":52,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000016","kind":"synthetic_fixture_text","member":"evidence_store.json"},"modality":"structured_data","origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_class":"fixture_retained","rights_policy_version":"d1250006-0000-4000-8000-000000000002","rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_prev_5:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null}}],"limits":["authentic_persisted_freeze_not_verified","current_rights_and_current_use_not_verified","evidence_paraphrases_not_materialized","two_free_text_claim_values_withheld","approved_claim_representation_prose_not_emitted","complete_fixture_consumer_adequacy_not_established","support_sufficiency_and_semantic_truth_not_certified","planner_configuration_and_execution_not_included"],"materialization":"supplied_snapshot_candidate","package_hash":"a8655c0e8bd72094a823b367a0c21cd665d3d99c271341286a92dbdc2ea304ab","package_id":"d1250004-0000-4000-8000-000000000001","schema":"planner-fixture-consumer-snapshot/1","scope":{"competition_ids":["competition_north_coast_league"],"entity_ids":["entity_northbridge_fc"],"event_ids":["event_fixture_001"],"locale":"en-GB","scheduled_default_mode":"normal_post_event","scope_type":"event","show_id":"d1250002-0000-4000-8000-000000000001","target_publication_slot_ref":"fixture_slot_001"},"scope_hash":"ecb1eb2b675a9e383dfe88e6311f8cc88cc97eb17183df9a8cae935d8d1f8979","selection_provenance":{"context_retrieval_version":"fixture.manual.v1","live_search":false,"match_window_proof":{"as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","complete_prior_schedule_assertion":true,"current_event":{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-27T12:00:00Z","completion_status":"final","event_identity":"event_fixture_001","participant_entities":["entity_northbridge_fc","entity_southbank_athletic"]},"current_event_identity":"event_fixture_001","entity_identity":"entity_northbridge_fc","ordered_prior_schedule":[{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-21T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_1","rank_before_current_event":1},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-14T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_2","rank_before_current_event":2},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-07T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_3","rank_before_current_event":3},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-31T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_4","rank_before_current_event":4},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-24T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_5","rank_before_current_event":5},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-17T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_6","rank_before_current_event":6}],"schedule_scope":"complete six most recent prior completed league matches in this synthetic fixture","selected_event_identities":["event_fixture_previous_1","event_fixture_previous_2","event_fixture_previous_3","event_fixture_previous_4","event_fixture_previous_5"],"selection_rule":"last five completed league matches before current event; descending completion time","source_identity":"src_fixture_data","source_record_ref":"fixture-schedule-ledger-v1","synthetic":true,"window_identity":"fixture-last-five-league-before-event-001-v1"},"operator":"fixture_builder","selector_version":"fixture.manual.v2"},"sensitivities":[{"applies_to":"event_fixture_001","note":"No in-scope serious incident or protected sensitivity at freeze.","sensitivity_id":"sens_none","state":"none"}],"signals":[{"ref":"artifact:d1250005-0000-4000-8000-000000000017","signal_id":"sig_tenor","type":"tenor_reading"},{"ref":"d1250009-0000-4000-8000-000000000001","signal_id":"sig_late_pattern","type":"derivation_run"}],"silent_inputs":[{"allowed_consumers":["planner","auditor"],"claim_id":"d1250008-0000-4000-8000-000000000008","effective_usage_class":"silent","purpose":"calibration_only","support_refs":["d1250007-0000-4000-8000-000000000010"]}],"source_attribution":[{"display_name":"North Coast Gazette","source_id":"src_north_coast_gazette","source_role":"journalist"},{"display_name":"Matchboard Analysis","source_id":"src_matchboard_analysis","source_role":"analyst"},{"display_name":"East Bank Review Archive","source_id":"src_east_bank_review_archive","source_role":"reference"}],"version_refs":{"claims_policy":"0.1.2","evidence_package_spec":"0.2.2","lens_definition":"fixture-lens-v1","rights_registry":"fixture-rights-v1","show_version":"postmatch-fixture-v4"}}';
const EXPECTED_SUMMARIES =
  '[{"claim_id":"d1250008-0000-4000-8000-000000000001","claim_support_id":"d125000a-0000-4000-8000-000000000001","inspection":{"content_hash":"5dfd65df76fdcd9b3fa8b2ab730cb38712f3941875ad2ae1319d788d256bd1a3","evidence_unit_id":"d1250007-0000-4000-8000-000000000001","planner_exposure":"claim_only","rights_version_id":"d1250006-0000-4000-8000-000000000004"},"support_hash":"5dfd65df76fdcd9b3fa8b2ab730cb38712f3941875ad2ae1319d788d256bd1a3","support_kind":"evidence","support_role":"supports_value"},{"claim_id":"d1250008-0000-4000-8000-000000000002","claim_support_id":"d125000a-0000-4000-8000-000000000002","inspection":{"content_hash":"a5565030c5163db39ffd10a1cd80a07cb30559d898737d23d87fc4f029fefdb0","evidence_unit_id":"d1250007-0000-4000-8000-000000000002","planner_exposure":"claim_only","rights_version_id":"d1250006-0000-4000-8000-000000000002"},"support_hash":"a5565030c5163db39ffd10a1cd80a07cb30559d898737d23d87fc4f029fefdb0","support_kind":"evidence","support_role":"supports_value"},{"claim_id":"d1250008-0000-4000-8000-000000000003","claim_support_id":"d125000a-0000-4000-8000-000000000003","inspection":{"content_hash":"a71d542b57e7edcfe91186a9a934b0301845599b4a40f7fecb8d6e633b4b8578","evidence_unit_id":"d1250007-0000-4000-8000-000000000003","planner_exposure":"paraphrase","rights_version_id":"d1250006-0000-4000-8000-000000000005"},"support_hash":"a71d542b57e7edcfe91186a9a934b0301845599b4a40f7fecb8d6e633b4b8578","support_kind":"evidence","support_role":"supports_value"},{"claim_id":"d1250008-0000-4000-8000-000000000004","claim_support_id":"d125000a-0000-4000-8000-000000000004","inspection":{"content_hash":"98cc45be73f4be9296b343ad543d249a63fc20f6c31daf0a86b6c90eb1b8e4df","evidence_unit_id":"d1250007-0000-4000-8000-000000000004","planner_exposure":"paraphrase","rights_version_id":"d1250006-0000-4000-8000-000000000005"},"support_hash":"98cc45be73f4be9296b343ad543d249a63fc20f6c31daf0a86b6c90eb1b8e4df","support_kind":"evidence","support_role":"supports_value"},{"claim_id":"d1250008-0000-4000-8000-000000000005","claim_support_id":"d125000a-0000-4000-8000-000000000005","inspection":{"artifact_id":"d1250005-0000-4000-8000-000000000017","canonical_payload":{"projection":{"as_of":"2026-09-27T12:59:00Z","authored_synthetic_interpretation":{"confidence":"medium","direction":"relief_over_celebration","intensity":"moderate"},"entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_001","method_version":"bounded-supporter-tenor/v1","observation_count":4,"observation_set_identity":"fixture-supporter-reaction-event-001-v1","observations":[{"content_hash":"bb010e8fa7d1b2925a142620f20771294db03a6077c78ab72b041a3601cd41f3","evidence_unit_id":"d1250007-0000-4000-8000-000000000005","observation_order":1,"scoped_description_ref":{"evidence_unit_id":"d1250007-0000-4000-8000-000000000005","member":"evidence_store.json"},"source_identity":"src_supporter_forum_a"},{"content_hash":"290dca152f388f068d078aca310869cb6aebc6506588f9c9d06de4a5cce1d7e0","evidence_unit_id":"d1250007-0000-4000-8000-000000000006","observation_order":2,"scoped_description_ref":{"evidence_unit_id":"d1250007-0000-4000-8000-000000000006","member":"evidence_store.json"},"source_identity":"src_supporter_podcast_b"},{"content_hash":"3089e7a00a05ca9145a2b83edf9dc3e0fd7d1b7be70df5f5f69ffde049958e21","evidence_unit_id":"d1250007-0000-4000-8000-000000000007","observation_order":3,"scoped_description_ref":{"evidence_unit_id":"d1250007-0000-4000-8000-000000000007","member":"evidence_store.json"},"source_identity":"src_supporter_blog_c"},{"content_hash":"3a462ce692fcdbdffcb3ce62810b2efbe50a1d18af3460944f46ba00623fdef5","evidence_unit_id":"d1250007-0000-4000-8000-000000000008","observation_order":4,"scoped_description_ref":{"evidence_unit_id":"d1250007-0000-4000-8000-000000000008","member":"evidence_store.json"},"source_identity":"src_supporter_forum_d"}]},"support_kind":"signal"},"content_hash":"46e6a24048f151f62f9e03a66bb57ca4aae78c0281630850bc74bf9205cd4c28"},"support_hash":"46e6a24048f151f62f9e03a66bb57ca4aae78c0281630850bc74bf9205cd4c28","support_kind":"signal","support_role":"supports_value"},{"claim_id":"d1250008-0000-4000-8000-000000000006","claim_support_id":"d125000a-0000-4000-8000-000000000006","inspection":{"content_hash":"413c4fc6bbce8ab3ec6704e07bfc85f7e6800b92ae8f51de1c430b65a74c6ee3","evidence_unit_id":"d1250007-0000-4000-8000-000000000009","planner_exposure":"exact_excerpt","rights_version_id":"d1250006-0000-4000-8000-000000000006"},"support_hash":"413c4fc6bbce8ab3ec6704e07bfc85f7e6800b92ae8f51de1c430b65a74c6ee3","support_kind":"evidence","support_role":"supports_value"},{"claim_id":"d1250008-0000-4000-8000-000000000007","claim_support_id":"d125000a-0000-4000-8000-000000000007","inspection":{"created_at":"2026-09-27T12:59:30Z","derivation_run_id":"d1250009-0000-4000-8000-000000000001","exact_input_refs":[{"content_hash":"3c7a7888d1ae4d5c6a40aadae89f0db9cf0732c3a22265c65ac688867c785150","evidence_unit_id":"d1250007-0000-4000-8000-000000000012","selected_provenance":{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"entity_identity":"entity_northbridge_fc","event_completed_at":"2026-09-21T12:00:00Z","event_identity":"event_fixture_previous_1","evidence_unit_id":"d1250007-0000-4000-8000-000000000012","language":"en-GB","locator":{"body_codepoint_end":52,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000012","kind":"synthetic_fixture_text","member":"evidence_store.json"},"origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_prev_1:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null,"window_identity":"fixture-last-five-league-before-event-001-v1","window_order":1},"window_proof":{"as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","complete_prior_schedule_assertion":true,"current_event":{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-27T12:00:00Z","completion_status":"final","event_identity":"event_fixture_001","participant_entities":["entity_northbridge_fc","entity_southbank_athletic"]},"current_event_identity":"event_fixture_001","entity_identity":"entity_northbridge_fc","ordered_prior_schedule":[{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-21T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_1","rank_before_current_event":1},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-14T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_2","rank_before_current_event":2},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-07T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_3","rank_before_current_event":3},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-31T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_4","rank_before_current_event":4},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-24T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_5","rank_before_current_event":5},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-17T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_6","rank_before_current_event":6}],"schedule_scope":"complete six most recent prior completed league matches in this synthetic fixture","selected_event_identities":["event_fixture_previous_1","event_fixture_previous_2","event_fixture_previous_3","event_fixture_previous_4","event_fixture_previous_5"],"selection_rule":"last five completed league matches before current event; descending completion time","source_identity":"src_fixture_data","source_record_ref":"fixture-schedule-ledger-v1","synthetic":true,"window_identity":"fixture-last-five-league-before-event-001-v1"}},{"content_hash":"ad8cbb012e22007db8c815249f907fbbf2039b63c83d3d9be6a222249a7ffd24","evidence_unit_id":"d1250007-0000-4000-8000-000000000013","selected_provenance":{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"entity_identity":"entity_northbridge_fc","event_completed_at":"2026-09-14T12:00:00Z","event_identity":"event_fixture_previous_2","evidence_unit_id":"d1250007-0000-4000-8000-000000000013","language":"en-GB","locator":{"body_codepoint_end":62,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000013","kind":"synthetic_fixture_text","member":"evidence_store.json"},"origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_prev_2:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null,"window_identity":"fixture-last-five-league-before-event-001-v1","window_order":2},"window_proof":{"as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","complete_prior_schedule_assertion":true,"current_event":{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-27T12:00:00Z","completion_status":"final","event_identity":"event_fixture_001","participant_entities":["entity_northbridge_fc","entity_southbank_athletic"]},"current_event_identity":"event_fixture_001","entity_identity":"entity_northbridge_fc","ordered_prior_schedule":[{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-21T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_1","rank_before_current_event":1},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-14T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_2","rank_before_current_event":2},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-07T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_3","rank_before_current_event":3},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-31T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_4","rank_before_current_event":4},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-24T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_5","rank_before_current_event":5},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-17T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_6","rank_before_current_event":6}],"schedule_scope":"complete six most recent prior completed league matches in this synthetic fixture","selected_event_identities":["event_fixture_previous_1","event_fixture_previous_2","event_fixture_previous_3","event_fixture_previous_4","event_fixture_previous_5"],"selection_rule":"last five completed league matches before current event; descending completion time","source_identity":"src_fixture_data","source_record_ref":"fixture-schedule-ledger-v1","synthetic":true,"window_identity":"fixture-last-five-league-before-event-001-v1"}},{"content_hash":"c5ff2da2639e0f56c53a2812dda8e435f5c7ccfd1df7fe306ace66e075652fba","evidence_unit_id":"d1250007-0000-4000-8000-000000000014","selected_provenance":{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"entity_identity":"entity_northbridge_fc","event_completed_at":"2026-09-07T12:00:00Z","event_identity":"event_fixture_previous_3","evidence_unit_id":"d1250007-0000-4000-8000-000000000014","language":"en-GB","locator":{"body_codepoint_end":52,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000014","kind":"synthetic_fixture_text","member":"evidence_store.json"},"origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_prev_3:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null,"window_identity":"fixture-last-five-league-before-event-001-v1","window_order":3},"window_proof":{"as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","complete_prior_schedule_assertion":true,"current_event":{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-27T12:00:00Z","completion_status":"final","event_identity":"event_fixture_001","participant_entities":["entity_northbridge_fc","entity_southbank_athletic"]},"current_event_identity":"event_fixture_001","entity_identity":"entity_northbridge_fc","ordered_prior_schedule":[{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-21T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_1","rank_before_current_event":1},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-14T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_2","rank_before_current_event":2},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-07T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_3","rank_before_current_event":3},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-31T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_4","rank_before_current_event":4},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-24T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_5","rank_before_current_event":5},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-17T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_6","rank_before_current_event":6}],"schedule_scope":"complete six most recent prior completed league matches in this synthetic fixture","selected_event_identities":["event_fixture_previous_1","event_fixture_previous_2","event_fixture_previous_3","event_fixture_previous_4","event_fixture_previous_5"],"selection_rule":"last five completed league matches before current event; descending completion time","source_identity":"src_fixture_data","source_record_ref":"fixture-schedule-ledger-v1","synthetic":true,"window_identity":"fixture-last-five-league-before-event-001-v1"}},{"content_hash":"fa9d0a653d449f5d4b599799dffcc487e04f2cc24dbcec7e0451bb102eebdc6b","evidence_unit_id":"d1250007-0000-4000-8000-000000000015","selected_provenance":{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"entity_identity":"entity_northbridge_fc","event_completed_at":"2026-08-31T12:00:00Z","event_identity":"event_fixture_previous_4","evidence_unit_id":"d1250007-0000-4000-8000-000000000015","language":"en-GB","locator":{"body_codepoint_end":62,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000015","kind":"synthetic_fixture_text","member":"evidence_store.json"},"origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_prev_4:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null,"window_identity":"fixture-last-five-league-before-event-001-v1","window_order":4},"window_proof":{"as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","complete_prior_schedule_assertion":true,"current_event":{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-27T12:00:00Z","completion_status":"final","event_identity":"event_fixture_001","participant_entities":["entity_northbridge_fc","entity_southbank_athletic"]},"current_event_identity":"event_fixture_001","entity_identity":"entity_northbridge_fc","ordered_prior_schedule":[{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-21T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_1","rank_before_current_event":1},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-14T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_2","rank_before_current_event":2},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-07T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_3","rank_before_current_event":3},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-31T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_4","rank_before_current_event":4},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-24T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_5","rank_before_current_event":5},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-17T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_6","rank_before_current_event":6}],"schedule_scope":"complete six most recent prior completed league matches in this synthetic fixture","selected_event_identities":["event_fixture_previous_1","event_fixture_previous_2","event_fixture_previous_3","event_fixture_previous_4","event_fixture_previous_5"],"selection_rule":"last five completed league matches before current event; descending completion time","source_identity":"src_fixture_data","source_record_ref":"fixture-schedule-ledger-v1","synthetic":true,"window_identity":"fixture-last-five-league-before-event-001-v1"}},{"content_hash":"b21989b1b1461ca40d2ce84498250648e5f03949881d9fc3e82167fbf36acba5","evidence_unit_id":"d1250007-0000-4000-8000-000000000016","selected_provenance":{"acquisition_ref":"fixture-acquisition:src_fixture_data:2026-09-27:v1","as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","consumer_exposure":{"auditor":"claim_only","planner":"claim_only","writer":"hidden"},"entity_identity":"entity_northbridge_fc","event_completed_at":"2026-08-24T12:00:00Z","event_identity":"event_fixture_previous_5","evidence_unit_id":"d1250007-0000-4000-8000-000000000016","language":"en-GB","locator":{"body_codepoint_end":52,"body_codepoint_start":0,"evidence_unit_id":"d1250007-0000-4000-8000-000000000016","kind":"synthetic_fixture_text","member":"evidence_store.json"},"origin":"data_provider","paraphrase_permission":false,"quote_permission":false,"retention_declaration":{"canonical_source_bytes":"durable_offline_test_retention","policy_version":"synthetic-fixture-retention-v1","purge_behavior":"retain permitted tombstone metadata; no replacement bytes"},"rights_version_id":"d1250006-0000-4000-8000-000000000002","source_identity":"src_fixture_data","source_item_identity":"fixture-item:ev_prev_5:v1","source_modality":"structured_data","source_role":"reference","speaker_identity":null,"window_identity":"fixture-last-five-league-before-event-001-v1","window_order":5},"window_proof":{"as_of":"2026-09-27T12:59:00Z","competition_identity":"competition_north_coast_league","complete_prior_schedule_assertion":true,"current_event":{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-27T12:00:00Z","completion_status":"final","event_identity":"event_fixture_001","participant_entities":["entity_northbridge_fc","entity_southbank_athletic"]},"current_event_identity":"event_fixture_001","entity_identity":"entity_northbridge_fc","ordered_prior_schedule":[{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-21T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_1","rank_before_current_event":1},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-14T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_2","rank_before_current_event":2},{"competition_identity":"competition_north_coast_league","completed_at":"2026-09-07T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_3","rank_before_current_event":3},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-31T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_4","rank_before_current_event":4},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-24T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_5","rank_before_current_event":5},{"competition_identity":"competition_north_coast_league","completed_at":"2026-08-17T12:00:00Z","completion_status":"final","entity_identity":"entity_northbridge_fc","event_identity":"event_fixture_previous_6","rank_before_current_event":6}],"schedule_scope":"complete six most recent prior completed league matches in this synthetic fixture","selected_event_identities":["event_fixture_previous_1","event_fixture_previous_2","event_fixture_previous_3","event_fixture_previous_4","event_fixture_previous_5"],"selection_rule":"last five completed league matches before current event; descending completion time","source_identity":"src_fixture_data","source_record_ref":"fixture-schedule-ledger-v1","synthetic":true,"window_identity":"fixture-last-five-league-before-event-001-v1"}}],"output":{"after_minute":80,"count":3,"sample_size":5},"output_hash":"eb65fd3581e65333e7dcc68a0150e17dc8e728c8e348510b7c3ca12f2d748a88","parameters":{"after_minute":80,"window_matches":5},"rule_version":"late-concession-count/v1"},"support_hash":"eb65fd3581e65333e7dcc68a0150e17dc8e728c8e348510b7c3ca12f2d748a88","support_kind":"derivation","support_role":"supports_value"},{"claim_id":"d1250008-0000-4000-8000-000000000008","claim_support_id":"d125000a-0000-4000-8000-000000000008","inspection":{"content_hash":"348f6a219bc56f3d69f86267c1669d9c672f30db7712dc88cd6a8f4ff6e1f8f4","evidence_unit_id":"d1250007-0000-4000-8000-000000000010","planner_exposure":"claim_only","rights_version_id":"d1250006-0000-4000-8000-000000000003"},"support_hash":"348f6a219bc56f3d69f86267c1669d9c672f30db7712dc88cd6a8f4ff6e1f8f4","support_kind":"evidence","support_role":"supports_value"},{"claim_id":"d1250008-0000-4000-8000-000000000009","claim_support_id":"d125000a-0000-4000-8000-000000000009","inspection":{"artifact_id":"d1250005-0000-4000-8000-000000000018","canonical_payload":{"projection":{"external_episode_ref":"fixture-external:episode_fixture_prior_001","external_script_ref":"fixture-external:scr_fixture_prior_001","external_script_version_ref":"fixture-external:prior-script/v1","on_air_occurrence":{"exact_text":"Late-game control remains unresolved.","occurrence_identity":"fixture-external:late-control-occurrence-001","occurrence_time":"2026-09-21T13:30:00Z","participant_identity":"tully","position":"late-game control remained unresolved","semantic_turn_ref":"prior_tully_close_001"},"publication_attestation":{"attestation_identity":"fixture-external:publication-attestation-001","attested_by":"The Desk synthetic fixture author","published_at":"2026-09-21T14:00:00Z","state":"published","synthetic":true},"topic_thread_id":"thr_late_game_control","withdrawn":false},"support_kind":"continuity"},"content_hash":"2192b1ec1e126a0d7f705e69338cc5e2b457c6cd8f13136bc07f72cccdf46dd1"},"support_hash":"2192b1ec1e126a0d7f705e69338cc5e2b457c6cd8f13136bc07f72cccdf46dd1","support_kind":"continuity","support_role":"supports_value"}]';
function object(v: unknown): O {
  if (!isJsonObject(v)) throw new Error("test record");
  return v;
}
function array(v: unknown): Json[] {
  if (!Array.isArray(v)) throw new Error("test array");
  return v as Json[];
}
function text(v: unknown): string {
  if (typeof v !== "string") throw new Error("test string");
  return v;
}
function fixture(): Input {
  return {
    schema: "planner-fixture-consumer-input/1",
    package_payload: object(JSON.parse(PACKAGE_TEXT)),
    material: object(JSON.parse(MATERIAL_TEXT)),
  };
}
function manifest(p: O): O {
  return object(p.manifest);
}
function claim(p: O, i = 0): O {
  return object(array(manifest(p).claims)[i]);
}
function evidence(p: O, i = 0): O {
  return object(array(manifest(p).evidence)[i]);
}
function beat(p: O): O {
  return object(array(manifest(p).beats)[0]);
}
function ref(p: O, i = 0): O {
  return object(array(claim(p, i).support_refs)[0]);
}
function row(f: Input, family: string, i = 0): O {
  return object(array(f.material[family])[i]);
}
function uuid(i: number): string {
  return "c1000000-0000-4000-8000-" + String(i).padStart(12, "0");
}
function raw(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
function bind(f: Input): string {
  f.package_payload.package_hash = evidencePackageHash(f.package_payload);
  return canonicalJson(f);
}
function good(f = fixture()) {
  const r = project(bind(f));
  expect(r.kind).toBe("materialized_candidate");
  if (r.kind !== "materialized_candidate")
    throw new Error("expected projection");
  return r;
}
function refusal(
  input: unknown,
  code: PlannerFixtureConsumerError,
  field = "input",
  parser_code: string | null = null,
): void {
  const result = project(input);
  expect(result).toEqual({
    kind: "rejected",
    profile: PROFILE,
    code,
    field,
    parser_code,
  });
  expect(Object.isFrozen(result)).toBe(true);
}
function expectFrozen(value: unknown): void {
  if (typeof value === "object" && value !== null) {
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.getPrototypeOf(value)).toBe(
      Array.isArray(value) ? Array.prototype : Object.prototype,
    );
    for (const c of Object.values(value)) expectFrozen(c);
  }
}
function replaceBaseHash(f: Input, i: number): void {
  const base = row(f, "claim_bases", i),
    cl = claim(f.package_payload, i),
    h = claimContentHash(base);
  base.content_hash = h;
  cl.claim_content_hash = h;
  cl.frozen_state_hash = claimFrozenStateHash({
    claim_content_hash: h,
    state: cl.frozen_state,
    effective_usage_class: cl.effective_usage_class,
  });
}
function rebindCarrier(f: Input, i: number): void {
  const r = row(f, "support_carriers", i),
    hash = fixtureSupportObjectHash(r.canonical_payload);
  r.content_hash = hash;
  for (const cl of array(manifest(f.package_payload).claims))
    for (const s of array(object(cl).support_refs)) {
      const a = object(s);
      if (a.external_support_identity === "artifact:" + text(r.artifact_id))
        a.support_hash = hash;
    }
}
function pointer(
  f: Input,
  path: string,
): { parent: O | Json[]; key: string | number } {
  const tokens = path
    .replace(/^package/, "package_payload")
    .match(/[A-Za-z_]+|\d+/g);
  if (!tokens) throw new Error("test pointer");
  let cur: unknown = f;
  for (const k of tokens.slice(0, -1))
    cur = Array.isArray(cur) ? cur[Number(k)] : object(cur)[k];
  const last = tokens.at(-1);
  if (!last) throw new Error("test pointer");
  return {
    parent: Array.isArray(cur) ? (cur as Json[]) : object(cur),
    key: Array.isArray(cur) ? Number(last) : last,
  };
}
function set(f: Input, path: string, value: Json): void {
  const { parent, key } = pointer(f, path);
  if (Array.isArray(parent)) parent[Number(key)] = value;
  else parent[String(key)] = value;
}
function get(f: Input, path: string): Json {
  const { parent, key } = pointer(f, path);
  const v = Array.isArray(parent) ? parent[Number(key)] : parent[String(key)];
  if (v === undefined) throw new Error("test pointer leaf");
  return v;
}

describe("independent complete fixture and exact owned snapshot", () => {
  it("matches whole View literal, counts, both identities and every always-visible limit", () => {
    expect(raw(PACKAGE_TEXT)).toBe(
      "62a5d00b86a7bd3661ff2b2542fdd1f31051c981098f519aa0965747a1c51ee5",
    );
    expect(raw(MATERIAL_TEXT)).toBe(
      "67773b6917993ef1f644707d8559fb0a63834e6f5d87cd264783415b3de897af",
    );
    const expected = object(JSON.parse(EXPECTED_FIELDS));
    expected.support_summaries = JSON.parse(EXPECTED_SUMMARIES) as Json;
    const literal = canonicalJson(expected);
    expect(Buffer.byteLength(literal)).toBe(62964);
    expect(raw(literal)).toBe(
      "f00c6001ac059a75fc45d7d92c2d17e5ed5412d85974c99a37a7ffb6e861e05f",
    );
    const f = fixture(),
      input = bind(f),
      r = good(f);
    expect(r.view).toEqual(expected);
    expect(r.canonical_json).toBe(literal);
    expect(r.view_sha256).toBe(
      "381b304c8291412614d1d4fb1378bac328e13546b730c6a4847ab9552fa646f6",
    );
    expect(r.observation).toEqual({
      input_utf8_bytes: String(Buffer.byteLength(input)),
      input_sha256: raw(input),
      package_text_utf8_bytes: "40713",
      package_text_sha256: raw(PACKAGE_TEXT),
    });
    expect(r.view.claims).toHaveLength(9);
    expect(r.view.evidence).toHaveLength(15);
    expect(r.view.beats).toHaveLength(3);
    expect(r.view.support_summaries).toHaveLength(9);
    expect(r.view.claims.filter((c) => c.value !== null)).toHaveLength(7);
    expect(
      r.view.evidence.filter(
        (e) => e.representation_status === "paraphrase_not_materialized",
      ),
    ).toHaveLength(6);
    expect(r.view.limits).toEqual([
      "authentic_persisted_freeze_not_verified",
      "current_rights_and_current_use_not_verified",
      "evidence_paraphrases_not_materialized",
      "two_free_text_claim_values_withheld",
      "approved_claim_representation_prose_not_emitted",
      "complete_fixture_consumer_adequacy_not_established",
      "support_sufficiency_and_semantic_truth_not_certified",
      "planner_configuration_and_execution_not_included",
    ]);
    expectFrozen(r);
  });
  it("does not retain input aliases, approved claim prose, either free-text value or whole body store", () => {
    const f = fixture(),
      before = canonicalJson(f),
      r = good(f);
    expect(canonicalJson(f)).toBe(before);
    const denied = [
      text(claim(f.package_payload, 2).approved_representation),
      text(claim(f.package_payload, 3).approved_representation),
      text(object(claim(f.package_payload, 2).value).context),
      text(object(claim(f.package_payload, 3).value).interpretation),
      text(row(f, "evidence_bodies").canonical_content),
    ];
    for (const v of denied) expect(r.canonical_json.includes(v)).toBe(false);
    row(f, "claim_bases").predicate = "changed";
    object(manifest(f.package_payload).scope).locale = "changed";
    expect(r.canonical_json).toBe(good().canonical_json);
    expect(r.view.claims[7]?.consumption).toBe("silent_calibration_only");
    expect(r.view.claims[7]?.snapshot.effective_usage_class).toBe("silent");
    for (const c of r.view.claims)
      expect(Object.keys(c.snapshot).sort()).toEqual(
        "claim_id,claim_content_hash,frozen_state_hash,frozen_state,effective_usage_class,state_event_cursor,support_refs,attribution_requirement,initial_status,initial_usage_class,kind,origin,predicate,reduced_usage_class,subject_domain,subject_ref,value_type"
          .split(",")
          .sort(),
      );
    for (const e of r.view.evidence)
      expect(Object.keys(e.snapshot)).toHaveLength(23);
  });
  it("separates envelope observation, complete manifest identity and View identity", () => {
    const a = good(),
      f = fixture();
    f.package_payload.created_at = "2026-09-27T13:01:00Z";
    const b = good(f);
    expect(b.view.package_hash).toBe(a.view.package_hash);
    expect(b.view_sha256).toBe(a.view_sha256);
    expect(b.observation.input_sha256).not.toBe(a.observation.input_sha256);
    manifest(f.package_payload).selection_provenance = {
      ...object(manifest(f.package_payload).selection_provenance),
      operator: "independent synthetic author",
    };
    const c = good(f);
    expect(c.view.package_hash).not.toBe(a.view.package_hash);
    expect(c.view_sha256).not.toBe(a.view_sha256);
  });
  it("does not connect/query through the imported pg classes during calls", () => {
    const blocked = () => {
      throw new Error(
        "DB/network calls forbidden in this pure call-boundary test",
      );
    };
    const client = vi
        .spyOn(pg.Client.prototype, "connect")
        .mockImplementation(blocked),
      query = vi
        .spyOn(pg.Client.prototype, "query")
        .mockImplementation(blocked),
      pool = vi.spyOn(pg.Pool.prototype, "connect").mockImplementation(blocked);
    try {
      good();
      refusal(null, "input_type_invalid");
      expect(client).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
      expect(pool).not.toHaveBeenCalled();
    } finally {
      client.mockRestore();
      query.mockRestore();
      pool.mockRestore();
    }
  });
});

describe("P0-P6 exact admission and real transport boundaries", () => {
  it.each([
    null,
    undefined,
    false,
    0,
    [],
    {},
    new String("x"),
    Buffer.from("x"),
  ])("rejects nonprimitive %# without coercion", (v) => {
    refusal(v, "input_type_invalid");
  });
  it("never reflects on rejected proxies or invokes coercion", () => {
    let calls = 0;
    const p = new Proxy(
      {},
      {
        get() {
          calls++;
          throw new Error("trap");
        },
        ownKeys() {
          calls++;
          throw new Error("trap");
        },
        getPrototypeOf() {
          calls++;
          throw new Error("trap");
        },
      },
    );
    refusal(p, "input_type_invalid");
    refusal(
      {
        toJSON() {
          calls++;
          throw new Error("callback");
        },
        valueOf() {
          calls++;
          throw new Error("coercion");
        },
      },
      "input_type_invalid",
    );
    expect(calls).toBe(0);
  });
  it("preserves empty, syntax, Unicode and canonical-text distinctions", () => {
    refusal("", "input_text_empty");
    refusal("{", "input_json_invalid");
    refusal('"\\ud800"', "input_semantic_json_invalid");
    refusal('"' + String.fromCharCode(0xd800) + '"', "input_unicode_invalid");
    for (const v of [
      '{"a":0,"a":1}',
      '{"b":0,"a":1}',
      ' {"a":0}',
      '{"a":1e0}',
      '{"a":"e\\u0301"}',
      '{"a":"\\u0061"}',
    ])
      refusal(v, "input_text_noncanonical");
    for (const v of ["-0", "1.5", "9007199254740992", '{"é":0,"e\\u0301":0}'])
      refusal(v, "input_semantic_json_invalid");
  });
  it("uses inclusive UTF16 and UTF8 transport bounds before envelope checks", () => {
    refusal('"' + "x".repeat(2097150) + '"', "input_envelope_invalid");
    refusal('"' + "x".repeat(2097151) + '"', "input_resource_limit");
    refusal('"' + "é".repeat(1048575) + '"', "input_envelope_invalid");
    refusal('"' + "é".repeat(1048575) + 'x"', "input_resource_limit");
  });
  it("uses root depth one and exact key/value node counting", () => {
    refusal("[".repeat(32) + "0" + "]".repeat(32), "input_envelope_invalid");
    refusal("[".repeat(33) + "0" + "]".repeat(33), "input_resource_limit");
    refusal(
      "[" + Array(32767).fill("null").join(",") + "]",
      "input_envelope_invalid",
    );
    refusal(
      "[" + Array(32768).fill("null").join(",") + "]",
      "input_resource_limit",
    );
    const keys = Object.fromEntries(
      Array.from({ length: 16383 }, (_, i) => [
        "k" + String(i).padStart(5, "0"),
        null,
      ]),
    );
    refusal(canonicalJson(keys), "input_envelope_invalid");
    keys.extra = null;
    refusal(canonicalJson(keys), "input_resource_limit");
  });
  it.each(["null", "[]", "0", "true"])(
    "refuses non-envelope canonical %s",
    (s) => {
      refusal(s, "input_envelope_invalid");
    },
  );
  it.each([
    ["schema", "future", "input.schema"],
    ["package_payload", null, "input.package_payload"],
    ["material", null, "input.material"],
  ] as const)("refuses exact outer %s", (k, v, path) => {
    const f = fixture();
    const x = { ...f, [k]: v };
    refusal(canonicalJson(x), "input_envelope_invalid", path);
  });
  it("rejects outer/material tails and wrong material array types before the parser", () => {
    const f = fixture();
    refusal(canonicalJson({ ...f, tail: 0 }), "input_envelope_invalid");
    f.material.extra = [];
    refusal(canonicalJson(f), "input_envelope_invalid", "input.material");
    Reflect.deleteProperty(f.material, "extra");
    f.material.claim_bases = null;
    refusal(canonicalJson(f), "input_envelope_invalid", "input.material");
  });
});

const parserCases: readonly [string, (p: O) => void, boolean?][] = [
  [
    "invalid_uuid",
    (p) => {
      p.artifact_id = null;
    },
  ],
  [
    "invalid_hash",
    (p) => {
      evidence(p).content_hash = "bad";
    },
    true,
  ],
  [
    "invalid_timestamp",
    (p) => {
      p.created_at = "2026-02-30T00:00:00Z";
    },
  ],
  [
    "timestamp_precision",
    (p) => {
      p.created_at = "2026-01-01T00:00:00.1234567Z";
    },
  ],
  [
    "package_field_missing",
    (p) => {
      Reflect.deleteProperty(p, "id");
    },
  ],
  [
    "package_field_unknown_field",
    (p) => {
      p.extra = true;
    },
  ],
  [
    "package_field_type",
    (p) => {
      p.selector_run_id = null;
    },
  ],
  [
    "package_schema_unknown",
    (p) => {
      p.schema_version = "future";
    },
  ],
  [
    "package_manifest_missing",
    (p) => {
      p.manifest = null;
    },
  ],
  [
    "package_manifest_section_missing",
    (p) => {
      Reflect.deleteProperty(manifest(p), "beats");
    },
  ],
  [
    "package_manifest_section_unknown_field",
    (p) => {
      manifest(p).extra = true;
    },
  ],
  [
    "package_manifest_section_type",
    (p) => {
      manifest(p).beats = null;
    },
  ],
  [
    "package_hash_field_mismatch",
    (p) => {
      p.package_hash = "0".repeat(64);
    },
  ],
  [
    "package_scope_invalid",
    (p) => {
      object(manifest(p).scope).scope_type = "other";
      p.package_hash = evidencePackageHash(p);
    },
  ],
  [
    "package_scope_hash_mismatch",
    (p) => {
      p.scope_hash = "0".repeat(64);
    },
  ],
  [
    "package_evidence_shape",
    (p) => {
      array(manifest(p).evidence)[0] = null;
    },
    true,
  ],
  [
    "package_evidence_field_missing",
    (p) => {
      Reflect.deleteProperty(evidence(p), "language");
    },
    true,
  ],
  [
    "package_evidence_field_unknown_field",
    (p) => {
      evidence(p).extra = true;
    },
    true,
  ],
  [
    "package_evidence_field_type",
    (p) => {
      evidence(p).language = null;
    },
    true,
  ],
  [
    "package_evidence_exposure_shape",
    (p) => {
      object(evidence(p).consumer_exposure).planner = "future";
    },
    true,
  ],
  [
    "package_evidence_locator_unit",
    (p) => {
      object(evidence(p).locator).evidence_unit_id = uuid(7000);
    },
    true,
  ],
  [
    "package_evidence_duplicate",
    (p) => {
      array(manifest(p).evidence).push(structuredClone(evidence(p)));
    },
    true,
  ],
  [
    "package_claim_shape",
    (p) => {
      array(manifest(p).claims)[0] = null;
    },
    true,
  ],
  [
    "package_claim_field_missing",
    (p) => {
      Reflect.deleteProperty(claim(p), "predicate");
    },
    true,
  ],
  [
    "package_claim_field_unknown_field",
    (p) => {
      claim(p).extra = true;
    },
    true,
  ],
  [
    "package_claim_field_type",
    (p) => {
      claim(p).predicate = null;
    },
    true,
  ],
  [
    "package_claim_cursor_shape",
    (p) => {
      claim(p).state_event_cursor = {
        claim_state_event_id: uuid(1),
        event_sequence: 0,
      };
    },
    true,
  ],
  [
    "package_support_refs_missing",
    (p) => {
      claim(p).support_refs = null;
    },
    true,
  ],
  [
    "package_support_ref_missing",
    (p) => {
      Reflect.deleteProperty(ref(p), "support_hash");
    },
    true,
  ],
  [
    "package_support_ref_unknown_field",
    (p) => {
      ref(p).extra = true;
    },
    true,
  ],
  [
    "package_support_ref_shape",
    (p) => {
      ref(p).support_role = "future";
    },
    true,
  ],
  [
    "package_support_ref_duplicate",
    (p) => {
      array(claim(p).support_refs).push(structuredClone(ref(p)));
    },
    true,
  ],
  [
    "package_claim_duplicate",
    (p) => {
      array(manifest(p).claims).push(structuredClone(claim(p)));
    },
    true,
  ],
  [
    "package_reference_shape",
    (p) => {
      manifest(p).silent_inputs = [null];
    },
    true,
  ],
  [
    "package_reference_unresolved",
    (p) => {
      array(beat(p).member_claim_refs).push(uuid(7000));
    },
    true,
  ],
];
describe("unchanged parser ownership and competing errors", () => {
  it.each(parserCases)("keeps inherited %s", (code, mutate, rehash) => {
    const f = fixture();
    mutate(f.package_payload);
    refusal(
      rehash ? bind(f) : canonicalJson(f),
      "parser_rejected",
      "package",
      code,
    );
  });
  it("documents the two public-pipeline source invariants rather than fabricating parser PASS", () => {
    // invalid_json: P0-P5 already owns bounded native JSON, semantic safe integers and depth32.
    // package_payload_shape: P6 rejects non-record package_payload before parsePayload.
    expect(parserCases).toHaveLength(35);
    for (const v of [null, 0, [], true]) {
      const f = fixture();
      refusal(
        canonicalJson({ ...f, package_payload: v }),
        "input_envelope_invalid",
        "input.package_payload",
      );
    }
  });
  it("retains required-key before extra-key, stale package before evidence, and evidence before support priority", () => {
    const f = fixture();
    Reflect.deleteProperty(f.package_payload, "id");
    f.package_payload.extra = true;
    refusal(
      canonicalJson(f),
      "parser_rejected",
      "package",
      "package_field_missing",
    );
    const q = fixture();
    evidence(q.package_payload).language = null;
    ref(q.package_payload).support_hash = null;
    q.package_payload.package_hash = "0".repeat(64);
    refusal(
      canonicalJson(q),
      "parser_rejected",
      "package",
      "package_hash_field_mismatch",
    );
    refusal(
      bind(q),
      "parser_rejected",
      "package",
      "package_evidence_field_type",
    );
  });
});

const versionCases: readonly (readonly [string, string])[] = [
  ["package.manifest.version_refs.claims_policy", "0.1.2"],
  ["package.manifest.version_refs.evidence_package_spec", "0.2.2"],
  [
    "package.manifest.selection_provenance.selector_version",
    "fixture.manual.v2",
  ],
  [
    "package.manifest.selection_provenance.context_retrieval_version",
    "fixture.manual.v1",
  ],
  [
    "package.manifest.evidence[0].retention_declaration.policy_version",
    "synthetic-fixture-retention-v1",
  ],
  [
    "material.rights_versions[0].policy.retention.policy_version",
    "synthetic-fixture-retention-v1",
  ],
  ["material.derivations[0].rule_version", "late-concession-count/v1"],
  [
    "material.derivations[0].exact_input_refs[0].selected_provenance.retention_declaration.policy_version",
    "synthetic-fixture-retention-v1",
  ],
  [
    "material.support_carriers[0].canonical_payload.projection.method_version",
    "bounded-supporter-tenor/v1",
  ],
];
describe("P7 finite versions, scalar/identity safety and nullable owner distinction", () => {
  it.each(versionCases)(
    "rejects future interpreted version at %s",
    (path, current) => {
      const f = fixture();
      expect(get(f, path)).toBe(current);
      set(f, path, "future/version");
      refusal(bind(f), "profile_version_unsupported", path);
    },
  );
  it.each([null, 0, "", "x".repeat(16385)])(
    "refuses malformed version before unsupported version %#",
    (v) => {
      const f = fixture(),
        p = "material.derivations[0].rule_version";
      set(f, p, v);
      refusal(bind(f), "profile_value_invalid", p);
    },
  );
  it("does not arbitrarily repin opaque config/registry/script-version identities", () => {
    const f = fixture(),
      v = object(manifest(f.package_payload).version_refs);
    v.lens_definition = "different-owned-lens";
    v.rights_registry = "different-owned-registry";
    v.show_version = "different-show-reference";
    object(
      object(row(f, "support_carriers", 1).canonical_payload).projection,
    ).external_script_version_ref = "fixture-external:other-owned-version";
    rebindCarrier(f, 1);
    expect(good(f).view.version_refs.show_version).toBe(
      "different-show-reference",
    );
  });
  it.each([
    "initial_status",
    "initial_usage_class",
    "origin",
    "subject_domain",
    "claim_kind",
  ])("preflights material %s before immutable helper oneOf", (key) => {
    const f = fixture();
    row(f, "claim_bases")[key] = "unknown";
    refusal(bind(f), "profile_value_invalid", "material.claim_bases[0]." + key);
  });
  it("preflights carrier kind, exact keys and non-null derivation output before identity helpers", () => {
    const f = fixture();
    object(row(f, "support_carriers").canonical_payload).support_kind =
      "future";
    refusal(
      bind(f),
      "profile_value_invalid",
      "material.support_carriers[0].canonical_payload.support_kind",
    );
    const q = fixture();
    row(q, "derivations").output = null;
    refusal(bind(q), "profile_value_invalid", "material.derivations[0].output");
    const r = fixture();
    object(row(r, "support_carriers").canonical_payload).tail = true;
    refusal(
      bind(r),
      "profile_shape_invalid",
      "material.support_carriers[0].canonical_payload",
    );
  });
  it("allows immutable owner asserted_at null but refuses the declared non-null consumer subset", () => {
    const f = fixture();
    row(f, "claim_bases").asserted_at = null;
    expect(() => claimContentHash(row(f, "claim_bases"))).not.toThrow();
    refusal(
      bind(f),
      "profile_value_invalid",
      "material.claim_bases[0].asserted_at",
    );
  });
  it("refuses a parser-valid non-null cursor at the selected null-only P7 admission leaf", () => {
    const f = fixture();
    claim(f.package_payload).state_event_cursor = {
      claim_state_event_id: uuid(10001),
      event_sequence: 1,
    };
    // P6 accepts both canonical UUID and positive bounded sequence; cursor is not in frozen-state identity.
    refusal(
      bind(f),
      "profile_value_invalid",
      "package.manifest.claims[0].state_event_cursor",
    );
  });
  it("validates value type/record compatibility without exposing either prose value", () => {
    const f = fixture();
    claim(f.package_payload).value_type = "tenor";
    refusal(
      bind(f),
      "profile_value_invalid",
      "package.manifest.claims[0].value",
    );
  });
  it.each(["00", "01.2", "1.0", "1e2", "-1", "0.0000000000000000001", "100.1"])(
    "refuses noncanonical/out-of-range percent %s",
    (value) => {
      const f = fixture();
      object(claim(f.package_payload, 1).value).scalar = value;
      refusal(
        bind(f),
        "profile_value_invalid",
        "package.manifest.claims[1].value.scalar",
      );
    },
  );
  it.each([
    ["sample_size", 0],
    ["after_minute", 1441],
    ["count", 6],
  ] as const)("enforces count_window %s bound", (key, value) => {
    const f = fixture(),
      valueRecord = object(claim(f.package_payload, 6).value);
    valueRecord[key] = value;
    if (key === "sample_size") valueRecord.count = 0;
    refusal(
      bind(f),
      "profile_value_invalid",
      "package.manifest.claims[6].value." + key,
    );
  });
  it("refuses extra nested record keys and overlong/NFC/blank values with exact fixed diagnostics", () => {
    const f = fixture();
    object(manifest(f.package_payload).availability).tail = true;
    refusal(bind(f), "profile_shape_invalid", "package.manifest.availability");
    const q = fixture();
    row(q, "claim_bases").predicate = "x".repeat(16385);
    refusal(
      bind(q),
      "profile_value_invalid",
      "material.claim_bases[0].predicate",
    );
    const r = fixture();
    row(r, "claim_bases").predicate = "\u2003";
    refusal(
      bind(r),
      "profile_value_invalid",
      "material.claim_bases[0].predicate",
    );
  });
  it("enforces individual array and cumulative references without truncation", () => {
    const f = fixture();
    array(manifest(f.package_payload).sensitivities).push(
      ...Array.from({ length: 256 }, () =>
        structuredClone(
          array(manifest(f.package_payload).sensitivities)[0] ?? null,
        ),
      ),
    );
    refusal(bind(f), "profile_value_invalid", "package.manifest.sensitivities");
    // Existing9supports plus16 legal arrays of256 member refs cross4096 at the16th; duplicate phase is later.
    const q = fixture(),
      first = beat(q.package_payload);
    manifest(q.package_payload).beats = Array.from({ length: 17 }, (_, i) => ({
      ...structuredClone(first),
      beat_id: "b" + String(i),
      member_claim_refs: Array(256).fill(
        claim(q.package_payload).claim_id,
      ) as Json[],
    }));
    refusal(
      bind(q),
      "profile_resource_limit",
      "package.manifest.beats[15].member_claim_refs",
    );
  });
});

describe("exact timestamp/date ownership and chronological versus copied-byte identity", () => {
  it.each([
    "1900-02-29T00:00:00Z",
    "2026-02-30T12:00:00Z",
    "2026-00-01T00:00:00Z",
    "2026-13-01T00:00:00Z",
    "2026-01-00T00:00:00Z",
    "2026-01-01T24:00:00Z",
    "2026-01-01T00:60:00Z",
    "2026-01-01T00:00:60Z",
    "2026-01-01T00:00:00.Z",
    "2026-01-01T00:00:00+00:00",
    "2026-01-01T00:00:00+01:00",
  ])("preflights known invalid material timestamp %s", (v) => {
    const f = fixture();
    row(f, "claim_bases").asserted_at = v;
    refusal(
      bind(f),
      "profile_value_invalid",
      "material.claim_bases[0].asserted_at",
    );
  });
  it.each([
    "2000-02-29T00:00:00Z",
    "0000-02-29T00:00:00Z",
    "2026-01-01T00:00:00.1234567Z",
  ])("preserves valid owner timestamp bytes %s", (v) => {
    const f = fixture();
    row(f, "claim_bases").asserted_at = v;
    replaceBaseHash(f, 0);
    good(f);
  });
  it("keeps P6 offset/precision/calendar behavior distinct from P7 Z-only admission", () => {
    const f = fixture();
    f.package_payload.created_at = "2026-09-27T12:59:00.1234567Z";
    refusal(bind(f), "parser_rejected", "package", "timestamp_precision");
    f.package_payload.created_at = "2026-09-27T12:59:00+00:00";
    refusal(bind(f), "profile_value_invalid", "package.created_at");
    f.package_payload.created_at = "0000-01-01T00:00:00Z";
    refusal(bind(f), "parser_rejected", "package", "invalid_timestamp");
  });
  it("admits exactly16363 unhashed fractional digits and refuses one more before claim hashing", () => {
    const f = fixture();
    row(f, "claim_bases").asserted_at =
      "2026-01-01T00:00:00." + "1".repeat(16363) + "Z";
    replaceBaseHash(f, 0);
    good(f);
    row(f, "claim_bases").asserted_at =
      "2026-01-01T00:00:00." + "1".repeat(16364) + "Z";
    refusal(
      bind(f),
      "profile_value_invalid",
      "material.claim_bases[0].asserted_at",
    );
  });
  it.each(["2026-02-29", "2026-02-30", "2026-13-01", "2026-01-00", null])(
    "refuses date-only semantic leaf %#",
    (v) => {
      const f = fixture();
      evidence(f.package_payload, 8).source_document_date = v;
      refusal(
        bind(f),
        "profile_value_invalid",
        "package.manifest.evidence[8].source_document_date",
      );
    },
  );
  it.each(["2000-02-29", "2019-12-31"])(
    "allows source date %s without inferred midnight",
    (v) => {
      const f = fixture();
      evidence(f.package_payload, 8).source_document_date = v;
      good(f);
    },
  );
  it.each([
    ["2026-09-21T14:00:00.1Z", "2026-09-21T14:00:00.10Z", false],
    ["2026-09-21T14:00:00.099999999Z", "2026-09-21T14:00:00.1Z", true],
    ["2026-09-21T14:00:00.100000001Z", "2026-09-21T14:00:00.1Z", false],
    ["2026-09-21T14:00:00Z", "2026-09-21T14:00:00.000Z", false],
    ["2026-09-21T14:00:00.9Z", "2026-09-21T14:00:01Z", true],
  ] as const)(
    "strict continuity comparison %s vs %s",
    (occurrence, published, passes) => {
      const f = fixture(),
        v = object(
          object(row(f, "support_carriers", 1).canonical_payload).projection,
        );
      object(v.on_air_occurrence).occurrence_time = occurrence;
      object(v.publication_attestation).published_at = published;
      rebindCarrier(f, 1);
      if (passes) good(f);
      else
        refusal(
          bind(f),
          "profile_binding_mismatch",
          "material.support_carriers[1].canonical_payload.projection.on_air_occurrence.occurrence_time",
        );
    },
  );
  it("refuses publication after proof as_of even before frozen_at, then the independent frozen_at bound", () => {
    const f = fixture(),
      v = object(
        object(row(f, "support_carriers", 1).canonical_payload).projection,
      );
    object(v.publication_attestation).published_at = "2026-09-27T13:00:00Z";
    f.package_payload.frozen_at = "2026-09-27T14:00:00Z";
    rebindCarrier(f, 1);
    refusal(
      bind(f),
      "profile_binding_mismatch",
      "material.support_carriers[1].canonical_payload.projection.publication_attestation.published_at",
    );
    object(v.publication_attestation).published_at = "2026-09-21T14:00:00Z";
    f.package_payload.frozen_at = "2026-09-21T13:59:59Z";
    rebindCarrier(f, 1);
    refusal(
      bind(f),
      "profile_binding_mismatch",
      "material.support_carriers[1].canonical_payload.projection.publication_attestation.published_at",
    );
  });
  it("requires exact copied proof strings even for equal fractional instants", () => {
    const f = fixture(),
      d = row(f, "derivations"),
      proof = object(object(array(d.exact_input_refs)[0]).window_proof);
    proof.as_of = "2026-09-27T12:59:00.000Z";
    refusal(
      bind(f),
      "profile_binding_mismatch",
      "material.derivations[0].exact_input_refs[0].window_proof",
    );
  });
  it("retains grammar timestamp error before later hash/binding/version defects", () => {
    const f = fixture();
    row(f, "claim_bases").asserted_at = "2026-02-30T00:00:00Z";
    row(f, "claim_bases").content_hash = "0".repeat(64);
    row(f, "derivations").rule_version = "future";
    refusal(
      bind(f),
      "profile_value_invalid",
      "material.claim_bases[0].asserted_at",
    );
    f.package_payload.package_hash = "0".repeat(64);
    refusal(
      canonicalJson(f),
      "parser_rejected",
      "package",
      "package_hash_field_mismatch",
    );
  });
});

const closedRecordCases = [
  {
    path: "input",
    code: "input_envelope_invalid",
    field: "input",
    parser: null,
  },
  {
    path: "package",
    code: "parser_rejected",
    field: "package",
    parser: "package_field_unknown_field",
  },
  {
    path: "package.manifest",
    code: "parser_rejected",
    field: "package",
    parser: "package_manifest_section_unknown_field",
  },
  {
    path: "package.manifest.availability",
    code: "profile_shape_invalid",
    field: "package.manifest.availability",
    parser: null,
  },
  {
    path: "package.manifest.availability.continuity",
    code: "profile_shape_invalid",
    field: "package.manifest.availability.continuity",
    parser: null,
  },
  {
    path: "package.manifest.availability.historical_context",
    code: "profile_shape_invalid",
    field: "package.manifest.availability.historical_context",
    parser: null,
  },
  {
    path: "package.manifest.availability.independent_analysis",
    code: "profile_shape_invalid",
    field: "package.manifest.availability.independent_analysis",
    parser: null,
  },
  {
    path: "package.manifest.availability.licensed_tracking_data",
    code: "profile_shape_invalid",
    field: "package.manifest.availability.licensed_tracking_data",
    parser: null,
  },
  {
    path: "package.manifest.availability.serious_incident",
    code: "profile_shape_invalid",
    field: "package.manifest.availability.serious_incident",
    parser: null,
  },
  {
    path: "package.manifest.availability.structured_stats",
    code: "profile_shape_invalid",
    field: "package.manifest.availability.structured_stats",
    parser: null,
  },
  {
    path: "package.manifest.availability.supporter_evidence",
    code: "profile_shape_invalid",
    field: "package.manifest.availability.supporter_evidence",
    parser: null,
  },
  {
    path: "package.manifest.availability.verified_result",
    code: "profile_shape_invalid",
    field: "package.manifest.availability.verified_result",
    parser: null,
  },
  {
    path: "package.manifest.beats[0]",
    code: "profile_shape_invalid",
    field: "package.manifest.beats[0]",
    parser: null,
  },
  {
    path: "package.manifest.beats[1]",
    code: "profile_shape_invalid",
    field: "package.manifest.beats[1]",
    parser: null,
  },
  {
    path: "package.manifest.beats[2]",
    code: "profile_shape_invalid",
    field: "package.manifest.beats[2]",
    parser: null,
  },
  {
    path: "package.manifest.claims[0]",
    code: "parser_rejected",
    field: "package",
    parser: "package_claim_field_unknown_field",
  },
  {
    path: "package.manifest.claims[0].attribution_requirement",
    code: "profile_shape_invalid",
    field: "package.manifest.claims[0].attribution_requirement",
    parser: null,
  },
  {
    path: "package.manifest.claims[0].support_refs[0]",
    code: "parser_rejected",
    field: "package",
    parser: "package_support_ref_unknown_field",
  },
  {
    path: "package.manifest.claims[0].value",
    code: "profile_shape_invalid",
    field: "package.manifest.claims[0].value",
    parser: null,
  },
  {
    path: "package.manifest.claims[1]",
    code: "parser_rejected",
    field: "package",
    parser: "package_claim_field_unknown_field",
  },
  {
    path: "package.manifest.claims[1].attribution_requirement",
    code: "profile_shape_invalid",
    field: "package.manifest.claims[1].attribution_requirement",
    parser: null,
  },
  {
    path: "package.manifest.claims[1].support_refs[0]",
    code: "parser_rejected",
    field: "package",
    parser: "package_support_ref_unknown_field",
  },
  {
    path: "package.manifest.claims[1].value",
    code: "profile_shape_invalid",
    field: "package.manifest.claims[1].value",
    parser: null,
  },
  {
    path: "package.manifest.claims[2]",
    code: "parser_rejected",
    field: "package",
    parser: "package_claim_field_unknown_field",
  },
  {
    path: "package.manifest.claims[2].attribution_requirement",
    code: "profile_shape_invalid",
    field: "package.manifest.claims[2].attribution_requirement",
    parser: null,
  },
  {
    path: "package.manifest.claims[2].support_refs[0]",
    code: "parser_rejected",
    field: "package",
    parser: "package_support_ref_unknown_field",
  },
  {
    path: "package.manifest.claims[2].value",
    code: "profile_shape_invalid",
    field: "package.manifest.claims[2].value",
    parser: null,
  },
  {
    path: "package.manifest.claims[3]",
    code: "parser_rejected",
    field: "package",
    parser: "package_claim_field_unknown_field",
  },
  {
    path: "package.manifest.claims[3].attribution_requirement",
    code: "profile_shape_invalid",
    field: "package.manifest.claims[3].attribution_requirement",
    parser: null,
  },
  {
    path: "package.manifest.claims[3].support_refs[0]",
    code: "parser_rejected",
    field: "package",
    parser: "package_support_ref_unknown_field",
  },
  {
    path: "package.manifest.claims[3].value",
    code: "profile_shape_invalid",
    field: "package.manifest.claims[3].value",
    parser: null,
  },
  {
    path: "package.manifest.claims[4]",
    code: "parser_rejected",
    field: "package",
    parser: "package_claim_field_unknown_field",
  },
  {
    path: "package.manifest.claims[4].attribution_requirement",
    code: "profile_shape_invalid",
    field: "package.manifest.claims[4].attribution_requirement",
    parser: null,
  },
  {
    path: "package.manifest.claims[4].support_refs[0]",
    code: "parser_rejected",
    field: "package",
    parser: "package_support_ref_unknown_field",
  },
  {
    path: "package.manifest.claims[4].value",
    code: "profile_shape_invalid",
    field: "package.manifest.claims[4].value",
    parser: null,
  },
  {
    path: "package.manifest.claims[5]",
    code: "parser_rejected",
    field: "package",
    parser: "package_claim_field_unknown_field",
  },
  {
    path: "package.manifest.claims[5].attribution_requirement",
    code: "profile_shape_invalid",
    field: "package.manifest.claims[5].attribution_requirement",
    parser: null,
  },
  {
    path: "package.manifest.claims[5].support_refs[0]",
    code: "parser_rejected",
    field: "package",
    parser: "package_support_ref_unknown_field",
  },
  {
    path: "package.manifest.claims[5].value",
    code: "profile_shape_invalid",
    field: "package.manifest.claims[5].value",
    parser: null,
  },
  {
    path: "package.manifest.claims[6]",
    code: "parser_rejected",
    field: "package",
    parser: "package_claim_field_unknown_field",
  },
  {
    path: "package.manifest.claims[6].attribution_requirement",
    code: "profile_shape_invalid",
    field: "package.manifest.claims[6].attribution_requirement",
    parser: null,
  },
  {
    path: "package.manifest.claims[6].support_refs[0]",
    code: "parser_rejected",
    field: "package",
    parser: "package_support_ref_unknown_field",
  },
  {
    path: "package.manifest.claims[6].value",
    code: "profile_shape_invalid",
    field: "package.manifest.claims[6].value",
    parser: null,
  },
  {
    path: "package.manifest.claims[7]",
    code: "parser_rejected",
    field: "package",
    parser: "package_claim_field_unknown_field",
  },
  {
    path: "package.manifest.claims[7].attribution_requirement",
    code: "profile_shape_invalid",
    field: "package.manifest.claims[7].attribution_requirement",
    parser: null,
  },
  {
    path: "package.manifest.claims[7].support_refs[0]",
    code: "parser_rejected",
    field: "package",
    parser: "package_support_ref_unknown_field",
  },
  {
    path: "package.manifest.claims[7].value",
    code: "profile_shape_invalid",
    field: "package.manifest.claims[7].value",
    parser: null,
  },
  {
    path: "package.manifest.claims[8]",
    code: "parser_rejected",
    field: "package",
    parser: "package_claim_field_unknown_field",
  },
  {
    path: "package.manifest.claims[8].attribution_requirement",
    code: "profile_shape_invalid",
    field: "package.manifest.claims[8].attribution_requirement",
    parser: null,
  },
  {
    path: "package.manifest.claims[8].support_refs[0]",
    code: "parser_rejected",
    field: "package",
    parser: "package_support_ref_unknown_field",
  },
  {
    path: "package.manifest.claims[8].value",
    code: "profile_shape_invalid",
    field: "package.manifest.claims[8].value",
    parser: null,
  },
  {
    path: "package.manifest.context_candidates[0]",
    code: "profile_shape_invalid",
    field: "package.manifest.context_candidates[0]",
    parser: null,
  },
  {
    path: "package.manifest.context_candidates[1]",
    code: "profile_shape_invalid",
    field: "package.manifest.context_candidates[1]",
    parser: null,
  },
  {
    path: "package.manifest.context_candidates[2]",
    code: "profile_shape_invalid",
    field: "package.manifest.context_candidates[2]",
    parser: null,
  },
  {
    path: "package.manifest.continuity[0]",
    code: "profile_shape_invalid",
    field: "package.manifest.continuity[0]",
    parser: null,
  },
  {
    path: "package.manifest.coverage_conditions[0]",
    code: "profile_shape_invalid",
    field: "package.manifest.coverage_conditions[0]",
    parser: null,
  },
  {
    path: "package.manifest.coverage_conditions[1]",
    code: "profile_shape_invalid",
    field: "package.manifest.coverage_conditions[1]",
    parser: null,
  },
  {
    path: "package.manifest.coverage_conditions[2]",
    code: "profile_shape_invalid",
    field: "package.manifest.coverage_conditions[2]",
    parser: null,
  },
  {
    path: "package.manifest.evidence[0]",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_field_unknown_field",
  },
  {
    path: "package.manifest.evidence[0].consumer_exposure",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_exposure_shape",
  },
  {
    path: "package.manifest.evidence[0].locator",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[0].locator",
    parser: null,
  },
  {
    path: "package.manifest.evidence[0].retention_declaration",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[0].retention_declaration",
    parser: null,
  },
  {
    path: "package.manifest.evidence[1]",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_field_unknown_field",
  },
  {
    path: "package.manifest.evidence[1].consumer_exposure",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_exposure_shape",
  },
  {
    path: "package.manifest.evidence[1].locator",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[1].locator",
    parser: null,
  },
  {
    path: "package.manifest.evidence[1].retention_declaration",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[1].retention_declaration",
    parser: null,
  },
  {
    path: "package.manifest.evidence[2]",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_field_unknown_field",
  },
  {
    path: "package.manifest.evidence[2].consumer_exposure",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_exposure_shape",
  },
  {
    path: "package.manifest.evidence[2].locator",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[2].locator",
    parser: null,
  },
  {
    path: "package.manifest.evidence[2].retention_declaration",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[2].retention_declaration",
    parser: null,
  },
  {
    path: "package.manifest.evidence[3]",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_field_unknown_field",
  },
  {
    path: "package.manifest.evidence[3].consumer_exposure",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_exposure_shape",
  },
  {
    path: "package.manifest.evidence[3].locator",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[3].locator",
    parser: null,
  },
  {
    path: "package.manifest.evidence[3].retention_declaration",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[3].retention_declaration",
    parser: null,
  },
  {
    path: "package.manifest.evidence[4]",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_field_unknown_field",
  },
  {
    path: "package.manifest.evidence[4].consumer_exposure",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_exposure_shape",
  },
  {
    path: "package.manifest.evidence[4].locator",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[4].locator",
    parser: null,
  },
  {
    path: "package.manifest.evidence[4].observation_window",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[4].observation_window",
    parser: null,
  },
  {
    path: "package.manifest.evidence[4].retention_declaration",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[4].retention_declaration",
    parser: null,
  },
  {
    path: "package.manifest.evidence[5]",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_field_unknown_field",
  },
  {
    path: "package.manifest.evidence[5].consumer_exposure",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_exposure_shape",
  },
  {
    path: "package.manifest.evidence[5].locator",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[5].locator",
    parser: null,
  },
  {
    path: "package.manifest.evidence[5].observation_window",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[5].observation_window",
    parser: null,
  },
  {
    path: "package.manifest.evidence[5].retention_declaration",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[5].retention_declaration",
    parser: null,
  },
  {
    path: "package.manifest.evidence[6]",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_field_unknown_field",
  },
  {
    path: "package.manifest.evidence[6].consumer_exposure",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_exposure_shape",
  },
  {
    path: "package.manifest.evidence[6].locator",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[6].locator",
    parser: null,
  },
  {
    path: "package.manifest.evidence[6].observation_window",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[6].observation_window",
    parser: null,
  },
  {
    path: "package.manifest.evidence[6].retention_declaration",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[6].retention_declaration",
    parser: null,
  },
  {
    path: "package.manifest.evidence[7]",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_field_unknown_field",
  },
  {
    path: "package.manifest.evidence[7].consumer_exposure",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_exposure_shape",
  },
  {
    path: "package.manifest.evidence[7].locator",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[7].locator",
    parser: null,
  },
  {
    path: "package.manifest.evidence[7].observation_window",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[7].observation_window",
    parser: null,
  },
  {
    path: "package.manifest.evidence[7].retention_declaration",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[7].retention_declaration",
    parser: null,
  },
  {
    path: "package.manifest.evidence[8]",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_field_unknown_field",
  },
  {
    path: "package.manifest.evidence[8].consumer_exposure",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_exposure_shape",
  },
  {
    path: "package.manifest.evidence[8].locator",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[8].locator",
    parser: null,
  },
  {
    path: "package.manifest.evidence[8].permitted_quote",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[8].permitted_quote",
    parser: null,
  },
  {
    path: "package.manifest.evidence[8].retention_declaration",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[8].retention_declaration",
    parser: null,
  },
  {
    path: "package.manifest.evidence[9]",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_field_unknown_field",
  },
  {
    path: "package.manifest.evidence[9].consumer_exposure",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_exposure_shape",
  },
  {
    path: "package.manifest.evidence[9].locator",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[9].locator",
    parser: null,
  },
  {
    path: "package.manifest.evidence[9].retention_declaration",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[9].retention_declaration",
    parser: null,
  },
  {
    path: "package.manifest.evidence[10]",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_field_unknown_field",
  },
  {
    path: "package.manifest.evidence[10].consumer_exposure",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_exposure_shape",
  },
  {
    path: "package.manifest.evidence[10].locator",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[10].locator",
    parser: null,
  },
  {
    path: "package.manifest.evidence[10].retention_declaration",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[10].retention_declaration",
    parser: null,
  },
  {
    path: "package.manifest.evidence[11]",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_field_unknown_field",
  },
  {
    path: "package.manifest.evidence[11].consumer_exposure",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_exposure_shape",
  },
  {
    path: "package.manifest.evidence[11].locator",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[11].locator",
    parser: null,
  },
  {
    path: "package.manifest.evidence[11].retention_declaration",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[11].retention_declaration",
    parser: null,
  },
  {
    path: "package.manifest.evidence[12]",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_field_unknown_field",
  },
  {
    path: "package.manifest.evidence[12].consumer_exposure",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_exposure_shape",
  },
  {
    path: "package.manifest.evidence[12].locator",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[12].locator",
    parser: null,
  },
  {
    path: "package.manifest.evidence[12].retention_declaration",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[12].retention_declaration",
    parser: null,
  },
  {
    path: "package.manifest.evidence[13]",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_field_unknown_field",
  },
  {
    path: "package.manifest.evidence[13].consumer_exposure",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_exposure_shape",
  },
  {
    path: "package.manifest.evidence[13].locator",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[13].locator",
    parser: null,
  },
  {
    path: "package.manifest.evidence[13].retention_declaration",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[13].retention_declaration",
    parser: null,
  },
  {
    path: "package.manifest.evidence[14]",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_field_unknown_field",
  },
  {
    path: "package.manifest.evidence[14].consumer_exposure",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_exposure_shape",
  },
  {
    path: "package.manifest.evidence[14].locator",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[14].locator",
    parser: null,
  },
  {
    path: "package.manifest.evidence[14].retention_declaration",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[14].retention_declaration",
    parser: null,
  },
  {
    path: "package.manifest.evidence[15]",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_field_unknown_field",
  },
  {
    path: "package.manifest.evidence[15].consumer_exposure",
    code: "parser_rejected",
    field: "package",
    parser: "package_evidence_exposure_shape",
  },
  {
    path: "package.manifest.evidence[15].locator",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[15].locator",
    parser: null,
  },
  {
    path: "package.manifest.evidence[15].retention_declaration",
    code: "profile_shape_invalid",
    field: "package.manifest.evidence[15].retention_declaration",
    parser: null,
  },
  {
    path: "package.manifest.scope",
    code: "parser_rejected",
    field: "package",
    parser: "package_scope_invalid",
  },
  {
    path: "package.manifest.selection_provenance",
    code: "profile_shape_invalid",
    field: "package.manifest.selection_provenance",
    parser: null,
  },
  {
    path: "package.manifest.selection_provenance.match_window_proof",
    code: "profile_shape_invalid",
    field: "package.manifest.selection_provenance.match_window_proof",
    parser: null,
  },
  {
    path: "package.manifest.selection_provenance.match_window_proof.current_event",
    code: "profile_shape_invalid",
    field:
      "package.manifest.selection_provenance.match_window_proof.current_event",
    parser: null,
  },
  {
    path: "package.manifest.selection_provenance.match_window_proof.ordered_prior_schedule[0]",
    code: "profile_shape_invalid",
    field:
      "package.manifest.selection_provenance.match_window_proof.ordered_prior_schedule[0]",
    parser: null,
  },
  {
    path: "package.manifest.selection_provenance.match_window_proof.ordered_prior_schedule[1]",
    code: "profile_shape_invalid",
    field:
      "package.manifest.selection_provenance.match_window_proof.ordered_prior_schedule[1]",
    parser: null,
  },
  {
    path: "package.manifest.selection_provenance.match_window_proof.ordered_prior_schedule[2]",
    code: "profile_shape_invalid",
    field:
      "package.manifest.selection_provenance.match_window_proof.ordered_prior_schedule[2]",
    parser: null,
  },
  {
    path: "package.manifest.selection_provenance.match_window_proof.ordered_prior_schedule[3]",
    code: "profile_shape_invalid",
    field:
      "package.manifest.selection_provenance.match_window_proof.ordered_prior_schedule[3]",
    parser: null,
  },
  {
    path: "package.manifest.selection_provenance.match_window_proof.ordered_prior_schedule[4]",
    code: "profile_shape_invalid",
    field:
      "package.manifest.selection_provenance.match_window_proof.ordered_prior_schedule[4]",
    parser: null,
  },
  {
    path: "package.manifest.selection_provenance.match_window_proof.ordered_prior_schedule[5]",
    code: "profile_shape_invalid",
    field:
      "package.manifest.selection_provenance.match_window_proof.ordered_prior_schedule[5]",
    parser: null,
  },
  {
    path: "package.manifest.sensitivities[0]",
    code: "profile_shape_invalid",
    field: "package.manifest.sensitivities[0]",
    parser: null,
  },
  {
    path: "package.manifest.signals[0]",
    code: "profile_shape_invalid",
    field: "package.manifest.signals[0]",
    parser: null,
  },
  {
    path: "package.manifest.signals[1]",
    code: "profile_shape_invalid",
    field: "package.manifest.signals[1]",
    parser: null,
  },
  {
    path: "package.manifest.silent_inputs[0]",
    code: "profile_shape_invalid",
    field: "package.manifest.silent_inputs[0]",
    parser: null,
  },
  {
    path: "package.manifest.source_attribution[0]",
    code: "profile_shape_invalid",
    field: "package.manifest.source_attribution[0]",
    parser: null,
  },
  {
    path: "package.manifest.source_attribution[1]",
    code: "profile_shape_invalid",
    field: "package.manifest.source_attribution[1]",
    parser: null,
  },
  {
    path: "package.manifest.source_attribution[2]",
    code: "profile_shape_invalid",
    field: "package.manifest.source_attribution[2]",
    parser: null,
  },
  {
    path: "package.manifest.version_refs",
    code: "profile_shape_invalid",
    field: "package.manifest.version_refs",
    parser: null,
  },
  {
    path: "material",
    code: "input_envelope_invalid",
    field: "input.material",
    parser: null,
  },
  {
    path: "material.claim_bases[0]",
    code: "profile_shape_invalid",
    field: "material.claim_bases[0]",
    parser: null,
  },
  {
    path: "material.claim_bases[0].subject",
    code: "profile_shape_invalid",
    field: "material.claim_bases[0].subject",
    parser: null,
  },
  {
    path: "material.claim_bases[0].value",
    code: "profile_shape_invalid",
    field: "material.claim_bases[0].value",
    parser: null,
  },
  {
    path: "material.claim_bases[1]",
    code: "profile_shape_invalid",
    field: "material.claim_bases[1]",
    parser: null,
  },
  {
    path: "material.claim_bases[1].subject",
    code: "profile_shape_invalid",
    field: "material.claim_bases[1].subject",
    parser: null,
  },
  {
    path: "material.claim_bases[1].value",
    code: "profile_shape_invalid",
    field: "material.claim_bases[1].value",
    parser: null,
  },
  {
    path: "material.claim_bases[2]",
    code: "profile_shape_invalid",
    field: "material.claim_bases[2]",
    parser: null,
  },
  {
    path: "material.claim_bases[2].subject",
    code: "profile_shape_invalid",
    field: "material.claim_bases[2].subject",
    parser: null,
  },
  {
    path: "material.claim_bases[2].value",
    code: "profile_shape_invalid",
    field: "material.claim_bases[2].value",
    parser: null,
  },
  {
    path: "material.claim_bases[3]",
    code: "profile_shape_invalid",
    field: "material.claim_bases[3]",
    parser: null,
  },
  {
    path: "material.claim_bases[3].subject",
    code: "profile_shape_invalid",
    field: "material.claim_bases[3].subject",
    parser: null,
  },
  {
    path: "material.claim_bases[3].value",
    code: "profile_shape_invalid",
    field: "material.claim_bases[3].value",
    parser: null,
  },
  {
    path: "material.claim_bases[4]",
    code: "profile_shape_invalid",
    field: "material.claim_bases[4]",
    parser: null,
  },
  {
    path: "material.claim_bases[4].subject",
    code: "profile_shape_invalid",
    field: "material.claim_bases[4].subject",
    parser: null,
  },
  {
    path: "material.claim_bases[4].value",
    code: "profile_shape_invalid",
    field: "material.claim_bases[4].value",
    parser: null,
  },
  {
    path: "material.claim_bases[5]",
    code: "profile_shape_invalid",
    field: "material.claim_bases[5]",
    parser: null,
  },
  {
    path: "material.claim_bases[5].subject",
    code: "profile_shape_invalid",
    field: "material.claim_bases[5].subject",
    parser: null,
  },
  {
    path: "material.claim_bases[5].value",
    code: "profile_shape_invalid",
    field: "material.claim_bases[5].value",
    parser: null,
  },
  {
    path: "material.claim_bases[6]",
    code: "profile_shape_invalid",
    field: "material.claim_bases[6]",
    parser: null,
  },
  {
    path: "material.claim_bases[6].subject",
    code: "profile_shape_invalid",
    field: "material.claim_bases[6].subject",
    parser: null,
  },
  {
    path: "material.claim_bases[6].value",
    code: "profile_shape_invalid",
    field: "material.claim_bases[6].value",
    parser: null,
  },
  {
    path: "material.claim_bases[7]",
    code: "profile_shape_invalid",
    field: "material.claim_bases[7]",
    parser: null,
  },
  {
    path: "material.claim_bases[7].subject",
    code: "profile_shape_invalid",
    field: "material.claim_bases[7].subject",
    parser: null,
  },
  {
    path: "material.claim_bases[7].value",
    code: "profile_shape_invalid",
    field: "material.claim_bases[7].value",
    parser: null,
  },
  {
    path: "material.claim_bases[8]",
    code: "profile_shape_invalid",
    field: "material.claim_bases[8]",
    parser: null,
  },
  {
    path: "material.claim_bases[8].subject",
    code: "profile_shape_invalid",
    field: "material.claim_bases[8].subject",
    parser: null,
  },
  {
    path: "material.claim_bases[8].value",
    code: "profile_shape_invalid",
    field: "material.claim_bases[8].value",
    parser: null,
  },
  {
    path: "material.derivations[0]",
    code: "profile_shape_invalid",
    field: "material.derivations[0]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[0]",
    code: "profile_shape_invalid",
    field: "material.derivations[0].exact_input_refs[0]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[0].selected_provenance",
    code: "profile_shape_invalid",
    field: "material.derivations[0].exact_input_refs[0].selected_provenance",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[0].selected_provenance.consumer_exposure",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[0].selected_provenance.consumer_exposure",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[0].selected_provenance.locator",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[0].selected_provenance.locator",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[0].selected_provenance.retention_declaration",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[0].selected_provenance.retention_declaration",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[0].window_proof",
    code: "profile_shape_invalid",
    field: "material.derivations[0].exact_input_refs[0].window_proof",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[0].window_proof.current_event",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[0].window_proof.current_event",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[0].window_proof.ordered_prior_schedule[0]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[0].window_proof.ordered_prior_schedule[0]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[0].window_proof.ordered_prior_schedule[1]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[0].window_proof.ordered_prior_schedule[1]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[0].window_proof.ordered_prior_schedule[2]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[0].window_proof.ordered_prior_schedule[2]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[0].window_proof.ordered_prior_schedule[3]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[0].window_proof.ordered_prior_schedule[3]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[0].window_proof.ordered_prior_schedule[4]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[0].window_proof.ordered_prior_schedule[4]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[0].window_proof.ordered_prior_schedule[5]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[0].window_proof.ordered_prior_schedule[5]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[1]",
    code: "profile_shape_invalid",
    field: "material.derivations[0].exact_input_refs[1]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[1].selected_provenance",
    code: "profile_shape_invalid",
    field: "material.derivations[0].exact_input_refs[1].selected_provenance",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[1].selected_provenance.consumer_exposure",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[1].selected_provenance.consumer_exposure",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[1].selected_provenance.locator",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[1].selected_provenance.locator",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[1].selected_provenance.retention_declaration",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[1].selected_provenance.retention_declaration",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[1].window_proof",
    code: "profile_shape_invalid",
    field: "material.derivations[0].exact_input_refs[1].window_proof",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[1].window_proof.current_event",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[1].window_proof.current_event",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[1].window_proof.ordered_prior_schedule[0]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[1].window_proof.ordered_prior_schedule[0]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[1].window_proof.ordered_prior_schedule[1]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[1].window_proof.ordered_prior_schedule[1]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[1].window_proof.ordered_prior_schedule[2]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[1].window_proof.ordered_prior_schedule[2]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[1].window_proof.ordered_prior_schedule[3]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[1].window_proof.ordered_prior_schedule[3]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[1].window_proof.ordered_prior_schedule[4]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[1].window_proof.ordered_prior_schedule[4]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[1].window_proof.ordered_prior_schedule[5]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[1].window_proof.ordered_prior_schedule[5]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[2]",
    code: "profile_shape_invalid",
    field: "material.derivations[0].exact_input_refs[2]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[2].selected_provenance",
    code: "profile_shape_invalid",
    field: "material.derivations[0].exact_input_refs[2].selected_provenance",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[2].selected_provenance.consumer_exposure",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[2].selected_provenance.consumer_exposure",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[2].selected_provenance.locator",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[2].selected_provenance.locator",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[2].selected_provenance.retention_declaration",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[2].selected_provenance.retention_declaration",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[2].window_proof",
    code: "profile_shape_invalid",
    field: "material.derivations[0].exact_input_refs[2].window_proof",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[2].window_proof.current_event",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[2].window_proof.current_event",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[2].window_proof.ordered_prior_schedule[0]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[2].window_proof.ordered_prior_schedule[0]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[2].window_proof.ordered_prior_schedule[1]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[2].window_proof.ordered_prior_schedule[1]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[2].window_proof.ordered_prior_schedule[2]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[2].window_proof.ordered_prior_schedule[2]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[2].window_proof.ordered_prior_schedule[3]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[2].window_proof.ordered_prior_schedule[3]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[2].window_proof.ordered_prior_schedule[4]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[2].window_proof.ordered_prior_schedule[4]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[2].window_proof.ordered_prior_schedule[5]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[2].window_proof.ordered_prior_schedule[5]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[3]",
    code: "profile_shape_invalid",
    field: "material.derivations[0].exact_input_refs[3]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[3].selected_provenance",
    code: "profile_shape_invalid",
    field: "material.derivations[0].exact_input_refs[3].selected_provenance",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[3].selected_provenance.consumer_exposure",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[3].selected_provenance.consumer_exposure",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[3].selected_provenance.locator",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[3].selected_provenance.locator",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[3].selected_provenance.retention_declaration",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[3].selected_provenance.retention_declaration",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[3].window_proof",
    code: "profile_shape_invalid",
    field: "material.derivations[0].exact_input_refs[3].window_proof",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[3].window_proof.current_event",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[3].window_proof.current_event",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[3].window_proof.ordered_prior_schedule[0]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[3].window_proof.ordered_prior_schedule[0]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[3].window_proof.ordered_prior_schedule[1]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[3].window_proof.ordered_prior_schedule[1]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[3].window_proof.ordered_prior_schedule[2]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[3].window_proof.ordered_prior_schedule[2]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[3].window_proof.ordered_prior_schedule[3]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[3].window_proof.ordered_prior_schedule[3]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[3].window_proof.ordered_prior_schedule[4]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[3].window_proof.ordered_prior_schedule[4]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[3].window_proof.ordered_prior_schedule[5]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[3].window_proof.ordered_prior_schedule[5]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[4]",
    code: "profile_shape_invalid",
    field: "material.derivations[0].exact_input_refs[4]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[4].selected_provenance",
    code: "profile_shape_invalid",
    field: "material.derivations[0].exact_input_refs[4].selected_provenance",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[4].selected_provenance.consumer_exposure",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[4].selected_provenance.consumer_exposure",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[4].selected_provenance.locator",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[4].selected_provenance.locator",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[4].selected_provenance.retention_declaration",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[4].selected_provenance.retention_declaration",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[4].window_proof",
    code: "profile_shape_invalid",
    field: "material.derivations[0].exact_input_refs[4].window_proof",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[4].window_proof.current_event",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[4].window_proof.current_event",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[4].window_proof.ordered_prior_schedule[0]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[4].window_proof.ordered_prior_schedule[0]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[4].window_proof.ordered_prior_schedule[1]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[4].window_proof.ordered_prior_schedule[1]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[4].window_proof.ordered_prior_schedule[2]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[4].window_proof.ordered_prior_schedule[2]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[4].window_proof.ordered_prior_schedule[3]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[4].window_proof.ordered_prior_schedule[3]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[4].window_proof.ordered_prior_schedule[4]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[4].window_proof.ordered_prior_schedule[4]",
    parser: null,
  },
  {
    path: "material.derivations[0].exact_input_refs[4].window_proof.ordered_prior_schedule[5]",
    code: "profile_shape_invalid",
    field:
      "material.derivations[0].exact_input_refs[4].window_proof.ordered_prior_schedule[5]",
    parser: null,
  },
  {
    path: "material.derivations[0].output",
    code: "profile_shape_invalid",
    field: "material.derivations[0].output",
    parser: null,
  },
  {
    path: "material.derivations[0].parameters",
    code: "profile_shape_invalid",
    field: "material.derivations[0].parameters",
    parser: null,
  },
  {
    path: "material.evidence_bodies[0]",
    code: "profile_shape_invalid",
    field: "material.evidence_bodies[0]",
    parser: null,
  },
  {
    path: "material.evidence_bodies[1]",
    code: "profile_shape_invalid",
    field: "material.evidence_bodies[1]",
    parser: null,
  },
  {
    path: "material.evidence_bodies[2]",
    code: "profile_shape_invalid",
    field: "material.evidence_bodies[2]",
    parser: null,
  },
  {
    path: "material.evidence_bodies[3]",
    code: "profile_shape_invalid",
    field: "material.evidence_bodies[3]",
    parser: null,
  },
  {
    path: "material.evidence_bodies[4]",
    code: "profile_shape_invalid",
    field: "material.evidence_bodies[4]",
    parser: null,
  },
  {
    path: "material.evidence_bodies[5]",
    code: "profile_shape_invalid",
    field: "material.evidence_bodies[5]",
    parser: null,
  },
  {
    path: "material.rights_versions[0]",
    code: "profile_shape_invalid",
    field: "material.rights_versions[0]",
    parser: null,
  },
  {
    path: "material.rights_versions[0].policy",
    code: "profile_shape_invalid",
    field: "material.rights_versions[0].policy",
    parser: null,
  },
  {
    path: "material.rights_versions[0].policy.attribution",
    code: "profile_shape_invalid",
    field: "material.rights_versions[0].policy.attribution",
    parser: null,
  },
  {
    path: "material.rights_versions[0].policy.consumer_exposure_ceiling",
    code: "profile_shape_invalid",
    field: "material.rights_versions[0].policy.consumer_exposure_ceiling",
    parser: null,
  },
  {
    path: "material.rights_versions[0].policy.provider_exposure",
    code: "profile_shape_invalid",
    field: "material.rights_versions[0].policy.provider_exposure",
    parser: null,
  },
  {
    path: "material.rights_versions[0].policy.retention",
    code: "profile_shape_invalid",
    field: "material.rights_versions[0].policy.retention",
    parser: null,
  },
  {
    path: "material.rights_versions[1]",
    code: "profile_shape_invalid",
    field: "material.rights_versions[1]",
    parser: null,
  },
  {
    path: "material.rights_versions[1].policy",
    code: "profile_shape_invalid",
    field: "material.rights_versions[1].policy",
    parser: null,
  },
  {
    path: "material.rights_versions[1].policy.attribution",
    code: "profile_shape_invalid",
    field: "material.rights_versions[1].policy.attribution",
    parser: null,
  },
  {
    path: "material.rights_versions[1].policy.consumer_exposure_ceiling",
    code: "profile_shape_invalid",
    field: "material.rights_versions[1].policy.consumer_exposure_ceiling",
    parser: null,
  },
  {
    path: "material.rights_versions[1].policy.provider_exposure",
    code: "profile_shape_invalid",
    field: "material.rights_versions[1].policy.provider_exposure",
    parser: null,
  },
  {
    path: "material.rights_versions[1].policy.retention",
    code: "profile_shape_invalid",
    field: "material.rights_versions[1].policy.retention",
    parser: null,
  },
  {
    path: "material.rights_versions[2]",
    code: "profile_shape_invalid",
    field: "material.rights_versions[2]",
    parser: null,
  },
  {
    path: "material.rights_versions[2].policy",
    code: "profile_shape_invalid",
    field: "material.rights_versions[2].policy",
    parser: null,
  },
  {
    path: "material.rights_versions[2].policy.attribution",
    code: "profile_shape_invalid",
    field: "material.rights_versions[2].policy.attribution",
    parser: null,
  },
  {
    path: "material.rights_versions[2].policy.consumer_exposure_ceiling",
    code: "profile_shape_invalid",
    field: "material.rights_versions[2].policy.consumer_exposure_ceiling",
    parser: null,
  },
  {
    path: "material.rights_versions[2].policy.provider_exposure",
    code: "profile_shape_invalid",
    field: "material.rights_versions[2].policy.provider_exposure",
    parser: null,
  },
  {
    path: "material.rights_versions[2].policy.retention",
    code: "profile_shape_invalid",
    field: "material.rights_versions[2].policy.retention",
    parser: null,
  },
  {
    path: "material.rights_versions[3]",
    code: "profile_shape_invalid",
    field: "material.rights_versions[3]",
    parser: null,
  },
  {
    path: "material.rights_versions[3].policy",
    code: "profile_shape_invalid",
    field: "material.rights_versions[3].policy",
    parser: null,
  },
  {
    path: "material.rights_versions[3].policy.attribution",
    code: "profile_shape_invalid",
    field: "material.rights_versions[3].policy.attribution",
    parser: null,
  },
  {
    path: "material.rights_versions[3].policy.consumer_exposure_ceiling",
    code: "profile_shape_invalid",
    field: "material.rights_versions[3].policy.consumer_exposure_ceiling",
    parser: null,
  },
  {
    path: "material.rights_versions[3].policy.provider_exposure",
    code: "profile_shape_invalid",
    field: "material.rights_versions[3].policy.provider_exposure",
    parser: null,
  },
  {
    path: "material.rights_versions[3].policy.retention",
    code: "profile_shape_invalid",
    field: "material.rights_versions[3].policy.retention",
    parser: null,
  },
  {
    path: "material.rights_versions[4]",
    code: "profile_shape_invalid",
    field: "material.rights_versions[4]",
    parser: null,
  },
  {
    path: "material.rights_versions[4].policy",
    code: "profile_shape_invalid",
    field: "material.rights_versions[4].policy",
    parser: null,
  },
  {
    path: "material.rights_versions[4].policy.attribution",
    code: "profile_shape_invalid",
    field: "material.rights_versions[4].policy.attribution",
    parser: null,
  },
  {
    path: "material.rights_versions[4].policy.consumer_exposure_ceiling",
    code: "profile_shape_invalid",
    field: "material.rights_versions[4].policy.consumer_exposure_ceiling",
    parser: null,
  },
  {
    path: "material.rights_versions[4].policy.provider_exposure",
    code: "profile_shape_invalid",
    field: "material.rights_versions[4].policy.provider_exposure",
    parser: null,
  },
  {
    path: "material.rights_versions[4].policy.retention",
    code: "profile_shape_invalid",
    field: "material.rights_versions[4].policy.retention",
    parser: null,
  },
  {
    path: "material.rights_versions[5]",
    code: "profile_shape_invalid",
    field: "material.rights_versions[5]",
    parser: null,
  },
  {
    path: "material.rights_versions[5].policy",
    code: "profile_shape_invalid",
    field: "material.rights_versions[5].policy",
    parser: null,
  },
  {
    path: "material.rights_versions[5].policy.attribution",
    code: "profile_shape_invalid",
    field: "material.rights_versions[5].policy.attribution",
    parser: null,
  },
  {
    path: "material.rights_versions[5].policy.consumer_exposure_ceiling",
    code: "profile_shape_invalid",
    field: "material.rights_versions[5].policy.consumer_exposure_ceiling",
    parser: null,
  },
  {
    path: "material.rights_versions[5].policy.provider_exposure",
    code: "profile_shape_invalid",
    field: "material.rights_versions[5].policy.provider_exposure",
    parser: null,
  },
  {
    path: "material.rights_versions[5].policy.retention",
    code: "profile_shape_invalid",
    field: "material.rights_versions[5].policy.retention",
    parser: null,
  },
  {
    path: "material.rights_versions[6]",
    code: "profile_shape_invalid",
    field: "material.rights_versions[6]",
    parser: null,
  },
  {
    path: "material.rights_versions[6].policy",
    code: "profile_shape_invalid",
    field: "material.rights_versions[6].policy",
    parser: null,
  },
  {
    path: "material.rights_versions[6].policy.attribution",
    code: "profile_shape_invalid",
    field: "material.rights_versions[6].policy.attribution",
    parser: null,
  },
  {
    path: "material.rights_versions[6].policy.consumer_exposure_ceiling",
    code: "profile_shape_invalid",
    field: "material.rights_versions[6].policy.consumer_exposure_ceiling",
    parser: null,
  },
  {
    path: "material.rights_versions[6].policy.provider_exposure",
    code: "profile_shape_invalid",
    field: "material.rights_versions[6].policy.provider_exposure",
    parser: null,
  },
  {
    path: "material.rights_versions[6].policy.retention",
    code: "profile_shape_invalid",
    field: "material.rights_versions[6].policy.retention",
    parser: null,
  },
  {
    path: "material.support_carriers[0]",
    code: "profile_shape_invalid",
    field: "material.support_carriers[0]",
    parser: null,
  },
  {
    path: "material.support_carriers[0].canonical_payload",
    code: "profile_shape_invalid",
    field: "material.support_carriers[0].canonical_payload",
    parser: null,
  },
  {
    path: "material.support_carriers[0].canonical_payload.projection",
    code: "profile_shape_invalid",
    field: "material.support_carriers[0].canonical_payload.projection",
    parser: null,
  },
  {
    path: "material.support_carriers[0].canonical_payload.projection.authored_synthetic_interpretation",
    code: "profile_shape_invalid",
    field:
      "material.support_carriers[0].canonical_payload.projection.authored_synthetic_interpretation",
    parser: null,
  },
  {
    path: "material.support_carriers[0].canonical_payload.projection.observations[0]",
    code: "profile_shape_invalid",
    field:
      "material.support_carriers[0].canonical_payload.projection.observations[0]",
    parser: null,
  },
  {
    path: "material.support_carriers[0].canonical_payload.projection.observations[0].scoped_description_ref",
    code: "profile_shape_invalid",
    field:
      "material.support_carriers[0].canonical_payload.projection.observations[0].scoped_description_ref",
    parser: null,
  },
  {
    path: "material.support_carriers[0].canonical_payload.projection.observations[1]",
    code: "profile_shape_invalid",
    field:
      "material.support_carriers[0].canonical_payload.projection.observations[1]",
    parser: null,
  },
  {
    path: "material.support_carriers[0].canonical_payload.projection.observations[1].scoped_description_ref",
    code: "profile_shape_invalid",
    field:
      "material.support_carriers[0].canonical_payload.projection.observations[1].scoped_description_ref",
    parser: null,
  },
  {
    path: "material.support_carriers[0].canonical_payload.projection.observations[2]",
    code: "profile_shape_invalid",
    field:
      "material.support_carriers[0].canonical_payload.projection.observations[2]",
    parser: null,
  },
  {
    path: "material.support_carriers[0].canonical_payload.projection.observations[2].scoped_description_ref",
    code: "profile_shape_invalid",
    field:
      "material.support_carriers[0].canonical_payload.projection.observations[2].scoped_description_ref",
    parser: null,
  },
  {
    path: "material.support_carriers[0].canonical_payload.projection.observations[3]",
    code: "profile_shape_invalid",
    field:
      "material.support_carriers[0].canonical_payload.projection.observations[3]",
    parser: null,
  },
  {
    path: "material.support_carriers[0].canonical_payload.projection.observations[3].scoped_description_ref",
    code: "profile_shape_invalid",
    field:
      "material.support_carriers[0].canonical_payload.projection.observations[3].scoped_description_ref",
    parser: null,
  },
  {
    path: "material.support_carriers[1]",
    code: "profile_shape_invalid",
    field: "material.support_carriers[1]",
    parser: null,
  },
  {
    path: "material.support_carriers[1].canonical_payload",
    code: "profile_shape_invalid",
    field: "material.support_carriers[1].canonical_payload",
    parser: null,
  },
  {
    path: "material.support_carriers[1].canonical_payload.projection",
    code: "profile_shape_invalid",
    field: "material.support_carriers[1].canonical_payload.projection",
    parser: null,
  },
  {
    path: "material.support_carriers[1].canonical_payload.projection.on_air_occurrence",
    code: "profile_shape_invalid",
    field:
      "material.support_carriers[1].canonical_payload.projection.on_air_occurrence",
    parser: null,
  },
  {
    path: "material.support_carriers[1].canonical_payload.projection.publication_attestation",
    code: "profile_shape_invalid",
    field:
      "material.support_carriers[1].canonical_payload.projection.publication_attestation",
    parser: null,
  },
] as const;
const timestampCases = [
  "package.created_at",
  "package.frozen_at",
  "package.manifest.evidence[0].as_of",
  "package.manifest.evidence[1].as_of",
  "package.manifest.evidence[2].as_of",
  "package.manifest.evidence[3].as_of",
  "package.manifest.evidence[4].as_of",
  "package.manifest.evidence[4].observation_window.start",
  "package.manifest.evidence[4].observation_window.end",
  "package.manifest.evidence[5].as_of",
  "package.manifest.evidence[5].observation_window.start",
  "package.manifest.evidence[5].observation_window.end",
  "package.manifest.evidence[6].as_of",
  "package.manifest.evidence[6].observation_window.start",
  "package.manifest.evidence[6].observation_window.end",
  "package.manifest.evidence[7].as_of",
  "package.manifest.evidence[7].observation_window.start",
  "package.manifest.evidence[7].observation_window.end",
  "package.manifest.evidence[8].as_of",
  "package.manifest.evidence[9].as_of",
  "package.manifest.evidence[10].as_of",
  "package.manifest.evidence[11].as_of",
  "package.manifest.evidence[11].event_completed_at",
  "package.manifest.evidence[12].as_of",
  "package.manifest.evidence[12].event_completed_at",
  "package.manifest.evidence[13].as_of",
  "package.manifest.evidence[13].event_completed_at",
  "package.manifest.evidence[14].as_of",
  "package.manifest.evidence[14].event_completed_at",
  "package.manifest.evidence[15].as_of",
  "package.manifest.evidence[15].event_completed_at",
  "package.manifest.selection_provenance.match_window_proof.as_of",
  "package.manifest.selection_provenance.match_window_proof.current_event.completed_at",
  "package.manifest.selection_provenance.match_window_proof.ordered_prior_schedule[0].completed_at",
  "package.manifest.selection_provenance.match_window_proof.ordered_prior_schedule[1].completed_at",
  "package.manifest.selection_provenance.match_window_proof.ordered_prior_schedule[2].completed_at",
  "package.manifest.selection_provenance.match_window_proof.ordered_prior_schedule[3].completed_at",
  "package.manifest.selection_provenance.match_window_proof.ordered_prior_schedule[4].completed_at",
  "package.manifest.selection_provenance.match_window_proof.ordered_prior_schedule[5].completed_at",
  "material.claim_bases[0].created_at",
  "material.claim_bases[0].asserted_at",
  "material.claim_bases[1].created_at",
  "material.claim_bases[1].asserted_at",
  "material.claim_bases[2].created_at",
  "material.claim_bases[2].asserted_at",
  "material.claim_bases[3].created_at",
  "material.claim_bases[3].asserted_at",
  "material.claim_bases[4].created_at",
  "material.claim_bases[4].asserted_at",
  "material.claim_bases[5].created_at",
  "material.claim_bases[5].asserted_at",
  "material.claim_bases[6].created_at",
  "material.claim_bases[6].asserted_at",
  "material.claim_bases[7].created_at",
  "material.claim_bases[7].asserted_at",
  "material.claim_bases[8].created_at",
  "material.claim_bases[8].asserted_at",
  "material.rights_versions[0].created_at",
  "material.rights_versions[1].created_at",
  "material.rights_versions[2].created_at",
  "material.rights_versions[3].created_at",
  "material.rights_versions[4].created_at",
  "material.rights_versions[5].created_at",
  "material.rights_versions[6].created_at",
  "material.evidence_bodies[0].created_at",
  "material.evidence_bodies[1].created_at",
  "material.evidence_bodies[2].created_at",
  "material.evidence_bodies[3].created_at",
  "material.evidence_bodies[4].created_at",
  "material.evidence_bodies[5].created_at",
  "material.derivations[0].created_at",
  "material.derivations[0].exact_input_refs[0].selected_provenance.as_of",
  "material.derivations[0].exact_input_refs[0].selected_provenance.event_completed_at",
  "material.derivations[0].exact_input_refs[0].window_proof.as_of",
  "material.derivations[0].exact_input_refs[0].window_proof.current_event.completed_at",
  "material.derivations[0].exact_input_refs[0].window_proof.ordered_prior_schedule[0].completed_at",
  "material.derivations[0].exact_input_refs[0].window_proof.ordered_prior_schedule[1].completed_at",
  "material.derivations[0].exact_input_refs[0].window_proof.ordered_prior_schedule[2].completed_at",
  "material.derivations[0].exact_input_refs[0].window_proof.ordered_prior_schedule[3].completed_at",
  "material.derivations[0].exact_input_refs[0].window_proof.ordered_prior_schedule[4].completed_at",
  "material.derivations[0].exact_input_refs[0].window_proof.ordered_prior_schedule[5].completed_at",
  "material.derivations[0].exact_input_refs[1].selected_provenance.as_of",
  "material.derivations[0].exact_input_refs[1].selected_provenance.event_completed_at",
  "material.derivations[0].exact_input_refs[1].window_proof.as_of",
  "material.derivations[0].exact_input_refs[1].window_proof.current_event.completed_at",
  "material.derivations[0].exact_input_refs[1].window_proof.ordered_prior_schedule[0].completed_at",
  "material.derivations[0].exact_input_refs[1].window_proof.ordered_prior_schedule[1].completed_at",
  "material.derivations[0].exact_input_refs[1].window_proof.ordered_prior_schedule[2].completed_at",
  "material.derivations[0].exact_input_refs[1].window_proof.ordered_prior_schedule[3].completed_at",
  "material.derivations[0].exact_input_refs[1].window_proof.ordered_prior_schedule[4].completed_at",
  "material.derivations[0].exact_input_refs[1].window_proof.ordered_prior_schedule[5].completed_at",
  "material.derivations[0].exact_input_refs[2].selected_provenance.as_of",
  "material.derivations[0].exact_input_refs[2].selected_provenance.event_completed_at",
  "material.derivations[0].exact_input_refs[2].window_proof.as_of",
  "material.derivations[0].exact_input_refs[2].window_proof.current_event.completed_at",
  "material.derivations[0].exact_input_refs[2].window_proof.ordered_prior_schedule[0].completed_at",
  "material.derivations[0].exact_input_refs[2].window_proof.ordered_prior_schedule[1].completed_at",
  "material.derivations[0].exact_input_refs[2].window_proof.ordered_prior_schedule[2].completed_at",
  "material.derivations[0].exact_input_refs[2].window_proof.ordered_prior_schedule[3].completed_at",
  "material.derivations[0].exact_input_refs[2].window_proof.ordered_prior_schedule[4].completed_at",
  "material.derivations[0].exact_input_refs[2].window_proof.ordered_prior_schedule[5].completed_at",
  "material.derivations[0].exact_input_refs[3].selected_provenance.as_of",
  "material.derivations[0].exact_input_refs[3].selected_provenance.event_completed_at",
  "material.derivations[0].exact_input_refs[3].window_proof.as_of",
  "material.derivations[0].exact_input_refs[3].window_proof.current_event.completed_at",
  "material.derivations[0].exact_input_refs[3].window_proof.ordered_prior_schedule[0].completed_at",
  "material.derivations[0].exact_input_refs[3].window_proof.ordered_prior_schedule[1].completed_at",
  "material.derivations[0].exact_input_refs[3].window_proof.ordered_prior_schedule[2].completed_at",
  "material.derivations[0].exact_input_refs[3].window_proof.ordered_prior_schedule[3].completed_at",
  "material.derivations[0].exact_input_refs[3].window_proof.ordered_prior_schedule[4].completed_at",
  "material.derivations[0].exact_input_refs[3].window_proof.ordered_prior_schedule[5].completed_at",
  "material.derivations[0].exact_input_refs[4].selected_provenance.as_of",
  "material.derivations[0].exact_input_refs[4].selected_provenance.event_completed_at",
  "material.derivations[0].exact_input_refs[4].window_proof.as_of",
  "material.derivations[0].exact_input_refs[4].window_proof.current_event.completed_at",
  "material.derivations[0].exact_input_refs[4].window_proof.ordered_prior_schedule[0].completed_at",
  "material.derivations[0].exact_input_refs[4].window_proof.ordered_prior_schedule[1].completed_at",
  "material.derivations[0].exact_input_refs[4].window_proof.ordered_prior_schedule[2].completed_at",
  "material.derivations[0].exact_input_refs[4].window_proof.ordered_prior_schedule[3].completed_at",
  "material.derivations[0].exact_input_refs[4].window_proof.ordered_prior_schedule[4].completed_at",
  "material.derivations[0].exact_input_refs[4].window_proof.ordered_prior_schedule[5].completed_at",
  "material.support_carriers[0].canonical_payload.projection.as_of",
  "material.support_carriers[1].canonical_payload.projection.on_air_occurrence.occurrence_time",
  "material.support_carriers[1].canonical_payload.projection.publication_attestation.published_at",
] as const;
describe("complete supplied nested record closure and finite timestamp registry", () => {
  it.each(closedRecordCases)(
    "refuses a tail at $path before graph/hash calculations",
    ({ path, code, field, parser }) => {
      const f = fixture();
      if (path === "input")
        refusal(
          canonicalJson({ ...f, unexpected_tail: 0 }),
          code,
          field,
          parser,
        );
      else {
        const r = object(get(f, path));
        r.unexpected_tail = 0;
        const input = path === "material" ? canonicalJson(f) : bind(f);
        refusal(input, code, field, parser);
      }
    },
  );
  it.each(timestampCases)("checks invalid/null semantic time at %s", (path) => {
    for (const v of ["2026-02-30T00:00:00Z", null]) {
      const f = fixture();
      set(f, path, v);
      const parser =
        path === "package.created_at" ||
        path === "package.frozen_at" ||
        /^package\.manifest\.evidence\[\d+\]\.as_of$/.test(path);
      refusal(
        bind(f),
        parser ? "parser_rejected" : "profile_value_invalid",
        parser ? "package" : path,
        parser ? "invalid_timestamp" : null,
      );
    }
  });
});

describe("ROOT correlated union-prefix clarification and repair progression", () => {
  it.each([2, 3, 4, 6, 8])(
    "keeps claim %s's earlier compatible prefix when its value gains a tail",
    (i) => {
      const f = fixture();
      good(f);
      const value = object(claim(f.package_payload, i).value);
      value.unexpected_tail = 0;
      refusal(
        bind(f),
        "profile_shape_invalid",
        `package.manifest.claims[${String(i)}].value`,
      );
      delete value.unexpected_tail;
      good(f);
    },
  );
  it.each([
    "authored_synthetic_interpretation",
    ...[0, 1, 2, 3].flatMap((i) => [
      `observations[${String(i)}]`,
      `observations[${String(i)}].scoped_description_ref`,
    ]),
  ])(
    "keeps the signal root for nested tail %s and its repaired positive",
    (suffix) => {
      const f = fixture();
      const path =
        "material.support_carriers[0].canonical_payload.projection." + suffix;
      good(f);
      const record = object(get(f, path));
      record.unexpected_tail = 0;
      refusal(bind(f), "profile_shape_invalid", path);
      delete record.unexpected_tail;
      good(f);
    },
  );
  it("does not turn signal null-time into a continuity root-shape error", () => {
    const f = fixture();
    const path =
      "material.support_carriers[0].canonical_payload.projection.as_of";
    const original = get(f, path);
    set(f, path, null);
    refusal(bind(f), "profile_value_invalid", path);
    set(f, path, original);
    good(f);
  });
  it("keeps an earlier genuine attribution shape failure before a value tail, then exposes the tail", () => {
    const f = fixture(),
      cl = claim(f.package_payload, 2);
    const attribution = object(cl.attribution_requirement),
      value = object(cl.value);
    attribution.unexpected_tail = 0;
    value.unexpected_tail = 0;
    refusal(
      bind(f),
      "profile_shape_invalid",
      "package.manifest.claims[2].attribution_requirement",
    );
    delete attribution.unexpected_tail;
    refusal(
      bind(f),
      "profile_shape_invalid",
      "package.manifest.claims[2].value",
    );
    delete value.unexpected_tail;
    good(f);
  });
  it("validates an earlier selected-branch semantic leaf before its later structural stopping event", () => {
    const f = fixture();
    const path = "material.support_carriers[0].canonical_payload.projection";
    const projection = object(get(f, path)),
      observation = object(array(projection.observations)[0]);
    const original = projection.as_of;
    projection.as_of = "2026-02-30T00:00:00Z";
    observation.unexpected_tail = 0;
    refusal(bind(f), "profile_value_invalid", path + ".as_of");
    if (original === undefined) throw new Error("fixture as_of");
    projection.as_of = original;
    refusal(bind(f), "profile_shape_invalid", path + ".observations[0]");
    delete observation.unexpected_tail;
    good(f);
  });
  it("keeps semantic validation at the attribution prefix ahead of a later value tail", () => {
    const f = fixture(),
      cl = claim(f.package_payload, 2);
    const attribution = object(cl.attribution_requirement),
      value = object(cl.value);
    const original = attribution.approved_prefix;
    attribution.approved_prefix = "";
    value.unexpected_tail = 0;
    refusal(
      bind(f),
      "profile_value_invalid",
      "package.manifest.claims[2].attribution_requirement.approved_prefix",
    );
    if (original === undefined) throw new Error("fixture approved_prefix");
    attribution.approved_prefix = original;
    refusal(
      bind(f),
      "profile_shape_invalid",
      "package.manifest.claims[2].value",
    );
    delete value.unexpected_tail;
    good(f);
  });
  it("cannot splice attribution and derivation columns from different claim alternatives", () => {
    const f = fixture(),
      cl = claim(f.package_payload, 2);
    const original = cl.support_refs;
    cl.support_refs = [
      { ...ref(f.package_payload, 6), claim_support_id: uuid(401) },
    ];
    refusal(
      bind(f),
      "profile_value_invalid",
      "package.manifest.claims[2].support_refs[0].derivation_run_id",
    );
    if (original === undefined) throw new Error("fixture support_refs");
    cl.support_refs = original;
    good(f);
  });
  it("retains a derivation branch across support-array siblings before a later value tail", () => {
    const f = fixture(),
      cl = claim(f.package_payload, 6);
    const supports = array(cl.support_refs),
      value = object(cl.value);
    supports.push({
      ...ref(f.package_payload, 0),
      claim_support_id: uuid(402),
    });
    value.unexpected_tail = 0;
    refusal(
      bind(f),
      "profile_value_invalid",
      "package.manifest.claims[6].support_refs[1].derivation_run_id",
    );
    supports.pop();
    refusal(
      bind(f),
      "profile_shape_invalid",
      "package.manifest.claims[6].value",
    );
    delete value.unexpected_tail;
    good(f);
  });
  it("does not accept a count-prefix/structured-value hybrid", () => {
    const f = fixture(),
      cl = claim(f.package_payload, 6);
    const original = cl.value;
    cl.value = structuredClone(claim(f.package_payload, 2).value ?? null);
    refusal(
      bind(f),
      "profile_shape_invalid",
      "package.manifest.claims[6].value",
    );
    if (original === undefined) throw new Error("fixture count value");
    cl.value = original;
    good(f);
  });
  it.each([0, 6])(
    "allows empty support prefixes without guessing a value variant for claim %s",
    (i) => {
      const f = fixture();
      claim(f.package_payload, i).support_refs = [];
      expect(good(f).view.claims[i]?.snapshot.support_refs).toEqual([]);
    },
  );
  it("selects genuinely per-item claim unions independently after a matching material reorder", () => {
    const f = fixture(),
      claims = array(manifest(f.package_payload).claims),
      bases = array(f.material.claim_bases);
    claims.splice(0, 2, ...claims.slice(0, 2).reverse());
    bases.splice(0, 2, ...bases.slice(0, 2).reverse());
    expect(
      good(f)
        .view.claims.slice(0, 2)
        .map((c) => c.snapshot.value_type),
    ).toEqual(["exact_decimal", "scoreline"]);
  });
  it("keeps a genuine P6 target error before both union-prefix defects, with repair progression", () => {
    const f = fixture(),
      cl = claim(f.package_payload, 2);
    const attribution = object(cl.attribution_requirement),
      value = object(cl.value);
    const support = ref(f.package_payload, 2),
      original = support.evidence_unit_id;
    support.evidence_unit_id = "not-a-uuid";
    attribution.unexpected_tail = 0;
    value.unexpected_tail = 0;
    refusal(bind(f), "parser_rejected", "package", "invalid_uuid");
    if (original === undefined) throw new Error("fixture evidence target");
    support.evidence_unit_id = original;
    refusal(
      bind(f),
      "profile_shape_invalid",
      "package.manifest.claims[2].attribution_requirement",
    );
    delete attribution.unexpected_tail;
    refusal(
      bind(f),
      "profile_shape_invalid",
      "package.manifest.claims[2].value",
    );
    delete value.unexpected_tail;
    good(f);
  });
});

describe("ROOT additive P7 envelope placement and unchanged P6 priority", () => {
  it("finishes manifest admission before the created_at offset check", () => {
    const f = fixture();
    object(manifest(f.package_payload).version_refs).claims_policy = "future";
    f.package_payload.created_at = "2026-09-27T12:59:00+00:00";
    refusal(
      bind(f),
      "profile_version_unsupported",
      "package.manifest.version_refs.claims_policy",
    );
    object(manifest(f.package_payload).version_refs).claims_policy = "0.1.2";
    refusal(bind(f), "profile_value_invalid", "package.created_at");
  });
  it("checks created_at before frozen_at after P6 accepts both offsets", () => {
    const f = fixture();
    f.package_payload.created_at = "2026-09-27T12:59:00+00:00";
    f.package_payload.frozen_at = "2026-09-27T13:00:00+00:00";
    refusal(bind(f), "profile_value_invalid", "package.created_at");
    f.package_payload.created_at = "2026-09-27T12:59:00Z";
    refusal(bind(f), "profile_value_invalid", "package.frozen_at");
  });
  it("checks frozen_at before material admission, with repair exposing the next defect", () => {
    const f = fixture();
    f.package_payload.frozen_at = "2026-09-27T13:00:00+00:00";
    row(f, "claim_bases").asserted_at = "2026-02-30T00:00:00Z";
    refusal(bind(f), "profile_value_invalid", "package.frozen_at");
    f.package_payload.frozen_at = "2026-09-27T13:00:00Z";
    refusal(
      bind(f),
      "profile_value_invalid",
      "material.claim_bases[0].asserted_at",
    );
  });
  it("keeps a genuine P6 precision error before manifest/material P7 errors", () => {
    const f = fixture();
    f.package_payload.created_at = "2026-09-27T12:59:00.1234567Z";
    object(manifest(f.package_payload).version_refs).claims_policy = "future";
    row(f, "claim_bases").asserted_at = "bad";
    refusal(bind(f), "parser_rejected", "package", "timestamp_precision");
  });
});

describe("P8 graph, rights, exposure, full proof and synthetic calculation controls", () => {
  it("rejects duplicates before material order and material order before base mismatch", () => {
    const f = fixture();
    array(manifest(f.package_payload).beats).push(
      structuredClone(beat(f.package_payload)),
    );
    array(f.material.claim_bases).reverse();
    refusal(bind(f), "profile_duplicate", "package.manifest.beats[3].beat_id");
    array(manifest(f.package_payload).beats).pop();
    refusal(bind(f), "profile_material_set_mismatch", "material.claim_bases");
    array(f.material.claim_bases).reverse();
    row(f, "claim_bases").predicate = "changed";
    refusal(
      bind(f),
      "profile_binding_mismatch",
      "material.claim_bases[0].predicate",
    );
  });
  it.each([
    "claim_bases",
    "rights_versions",
    "evidence_bodies",
    "support_carriers",
    "derivations",
  ])("requires exact %s set/order without extras", (name) => {
    const f = fixture();
    array(f.material[name]).push(
      structuredClone(array(f.material[name])[0] ?? null),
    );
    refusal(
      bind(f),
      "profile_duplicate",
      "material." +
        name +
        "[" +
        String(array(f.material[name]).length - 1) +
        "]." +
        ({
          claim_bases: "claim_id",
          rights_versions: "rights_version_id",
          evidence_bodies: "evidence_unit_id",
          support_carriers: "artifact_id",
          derivations: "derivation_run_id",
        }[name] ?? ""),
    );
    array(f.material[name]).pop();
    if (name === "derivations") {
      // Retain the referenced row/input bodies so the later derivations-set check
      // is reached. A distinct-ID extra row passes the preceding duplicate check.
      array(f.material.derivations).push({
        ...row(f, "derivations"),
        derivation_run_id: uuid(403),
      });
    } else array(f.material[name]).pop();
    refusal(bind(f), "profile_material_set_mismatch", "material." + name);
  });
  it("reaches the missing-derivation set check after removing its now-extra input bodies", () => {
    const f = fixture();
    f.material.derivations = [];
    // The quote body remains first; the five derivation bodies no longer belong
    // to the required set when the supplying derivation row is absent.
    f.material.evidence_bodies = array(f.material.evidence_bodies).slice(0, 1);
    refusal(bind(f), "profile_material_set_mismatch", "material.derivations");
  });
  it("checks fresh state/reduced usage and rejects permission promotion after correct immutable state hash", () => {
    const f = fixture(),
      cl = claim(f.package_payload);
    cl.frozen_state = "contested";
    replaceBaseHash(f, 0);
    refusal(
      bind(f),
      "profile_usage_unsupported",
      "package.manifest.claims[0].frozen_state",
    );
    const q = fixture();
    claim(q.package_payload).reduced_usage_class = "hedged_only";
    refusal(
      bind(q),
      "profile_usage_unsupported",
      "package.manifest.claims[0].reduced_usage_class",
    );
    const r = fixture();
    claim(r.package_payload, 7).effective_usage_class = "assertable";
    replaceBaseHash(r, 7);
    refusal(
      bind(r),
      "profile_usage_unsupported",
      "package.manifest.claims[7].effective_usage_class",
    );
  });
  it.each(["acquisition_permission", "synthetic_grant"])(
    "checks synthetic policy %s",
    (key) => {
      const f = fixture();
      object(row(f, "rights_versions").policy)[key] = false;
      refusal(
        bind(f),
        "profile_binding_mismatch",
        "material.rights_versions[0].policy." + key,
      );
    },
  );

  it("requires covered source and each actual consumer mode within its ceiling", () => {
    const f = fixture(),
      policy = object(row(f, "rights_versions").policy);
    policy.covered_source_identities = [];
    refusal(
      bind(f),
      "profile_binding_mismatch",
      "package.manifest.evidence[0].source_identity",
    );
    for (const consumer of ["planner", "writer", "auditor"]) {
      const q = fixture();
      object(
        object(row(q, "rights_versions").policy).consumer_exposure_ceiling,
      )[consumer] = [];
      refusal(
        bind(q),
        "profile_binding_mismatch",
        "package.manifest.evidence[0].consumer_exposure." + consumer,
      );
    }
  });
  it("refuses quote/paraphrase permissions exceeding their complete supplied grant", () => {
    const f = fixture(),
      e = evidence(f.package_payload, 8),
      right = array(f.material.rights_versions)
        .map(object)
        .find((r) => r.rights_version_id === e.rights_version_id);
    if (!right) throw new Error("fixture lore rights");
    object(right.policy).quotation_permission = false;
    refusal(
      bind(f),
      "profile_binding_mismatch",
      "package.manifest.evidence[8].quote_permission",
    );
    const q = fixture(),
      target = array(manifest(q.package_payload).evidence)
        .map(object)
        .find((r) => r.paraphrase_permission === true);
    if (!target) throw new Error("fixture paraphrase");
    const grant = array(q.material.rights_versions)
      .map(object)
      .find((r) => r.rights_version_id === target.rights_version_id);
    if (!grant) throw new Error("fixture paraphrase rights");
    object(grant.policy).paraphrase_permission = false;
    const first = array(manifest(q.package_payload).evidence)
      .map(object)
      .findIndex(
        (r) =>
          r.rights_version_id === target.rights_version_id &&
          r.paraphrase_permission === true,
      );
    refusal(
      bind(q),
      "profile_binding_mismatch",
      "package.manifest.evidence[" + String(first) + "].paraphrase_permission",
    );
  });
  it("compares the complete retention record rather than only its version/byte-retention labels", () => {
    const f = fixture();
    object(object(row(f, "rights_versions").policy).retention).purge_behavior =
      "other-supplied-retention";
    refusal(
      bind(f),
      "profile_binding_mismatch",
      "package.manifest.evidence[0].retention_declaration",
    );
  });

  it("rejects external provider permission and checks hidden-unit rights too", () => {
    const f = fixture();
    object(
      object(row(f, "rights_versions").policy).provider_exposure,
    ).external_providers = true;
    refusal(
      bind(f),
      "profile_binding_mismatch",
      "material.rights_versions[0].policy.provider_exposure.external_providers",
    );
    const q = fixture(),
      hidden = array(manifest(q.package_payload).evidence)
        .map(object)
        .find((e) => object(e.consumer_exposure).planner === "hidden");
    if (!hidden) throw new Error("fixture hidden");
    const r = array(q.material.rights_versions)
      .map(object)
      .find((r) => r.rights_version_id === hidden.rights_version_id);
    if (!r) throw new Error("fixture rights");
    object(r.policy).acquisition_permission = false;
    const idx = array(q.material.rights_versions).indexOf(r);
    refusal(
      bind(q),
      "profile_binding_mismatch",
      "material.rights_versions[" +
        String(idx) +
        "].policy.acquisition_permission",
    );
  });
  it.each(["paraphrase", "claim_only"])(
    "does not leak retained exact quote after %s downgrade",
    (mode) => {
      const f = fixture(),
        e = evidence(f.package_payload, 8),
        rights = array(f.material.rights_versions)
          .map(object)
          .find((r) => r.rights_version_id === e.rights_version_id);
      if (!rights) throw new Error("fixture rights");
      array(
        object(object(rights.policy).consumer_exposure_ceiling).planner,
      ).push(mode);
      object(e.consumer_exposure).planner = mode;
      refusal(
        bind(f),
        "profile_exposure_unsupported",
        "package.manifest.evidence[8].permitted_quote",
      );
      // The retained finite lore record requires permitted_quote: its removal refuses P7 shape even earlier.
      Reflect.deleteProperty(e, "permitted_quote");
      refusal(bind(f), "profile_shape_invalid", "package.manifest.evidence[8]");
    },
  );
  it("refuses shifted quote spans, changed exact text and unmatched lore value", () => {
    const f = fixture(),
      q = object(evidence(f.package_payload, 8).permitted_quote);
    q.span_start = 72;
    refusal(
      bind(f),
      "profile_quote_mismatch",
      "package.manifest.evidence[8].permitted_quote.text",
    );
    const g = fixture();
    object(evidence(g.package_payload, 8).permitted_quote).text =
      "the wrong ten";
    refusal(
      bind(g),
      "profile_quote_mismatch",
      "package.manifest.evidence[8].permitted_quote.text",
    );
    const h = fixture();
    object(claim(h.package_payload, 5).value).phrase = "the wrong ten";
    object(row(h, "claim_bases", 5).value).phrase = "the wrong ten";
    replaceBaseHash(h, 5);
    refusal(
      bind(h),
      "profile_exposure_unsupported",
      "package.manifest.claims[5].value.phrase",
    );
  });
  it("rejects same-length replaced body bytes under stale hash before quote/support output", () => {
    const f = fixture(),
      b = row(f, "evidence_bodies");
    b.canonical_content = text(b.canonical_content).replace(
      "Northbridge",
      "Southbridge",
    );
    refusal(
      bind(f),
      "profile_binding_mismatch",
      "material.evidence_bodies[0].content_hash",
    );
  });
  it("checks support resolution, full target hashes and hidden dependencies in order", () => {
    const f = fixture();
    ref(f.package_payload).evidence_unit_id = uuid(999);
    refusal(
      bind(f),
      "profile_support_unresolved",
      "package.manifest.claims[0].support_refs[0].evidence_unit_id",
    );
    const q = fixture();
    ref(q.package_payload).support_hash = "0".repeat(64);
    refusal(
      bind(q),
      "profile_support_hash_mismatch",
      "package.manifest.claims[0].support_refs[0].support_hash",
    );
    const h = fixture();
    object(evidence(h.package_payload).consumer_exposure).planner = "hidden";
    array(
      object(object(row(h, "rights_versions").policy).consumer_exposure_ceiling)
        .planner,
    ).push("hidden");
    refusal(
      bind(h),
      "profile_exposure_unsupported",
      "package.manifest.claims[0].support_refs[0].evidence_unit_id",
    );
  });
  it.each(["lore", "prediction"])(
    "refuses unsupported %s support KIND while a lore CLAIM is preserved",
    (kind) => {
      const f = fixture();
      ref(f.package_payload, 4).support_kind = kind;
      // The remaining continuity claim target now precedes signal-section targets.
      // Reorder the complete original rows only; payloads/hashes/rights stay intact.
      array(f.material.support_carriers).reverse();
      refusal(
        bind(f),
        "profile_support_unsupported",
        "package.manifest.claims[4].support_refs[0].support_kind",
      );
      expect(good().view.claims[5]?.snapshot.kind).toBe("lore");
    },
  );
  it.each([0, 4, 6, 8])(
    "preserves all five roles on the actual support family at claim %s",
    (i) => {
      const f = fixture(),
        cl = claim(f.package_payload, i),
        original = object(array(cl.support_refs)[0]);
      const roles = [
        "supports_value",
        "supports_attribution",
        "qualifies",
        "contradicts",
        "context_only",
      ];
      cl.support_refs = roles.map((role, j) => ({
        ...original,
        claim_support_id: uuid(100 + i * 10 + j),
        support_role: role,
      }));
      const r = good(f);
      expect(
        r.view.claims[i]?.snapshot.support_refs.map((x) => x.support_role),
      ).toEqual(roles);
      expect(
        r.view.support_summaries
          .filter((x) => x.claim_id === cl.claim_id)
          .map((x) => x.support_role),
      ).toEqual(roles);
    },
  );
  it("checks four distinct signal sources even after consistent recorded hashes/provenance", () => {
    const f = fixture(),
      v = object(
        object(row(f, "support_carriers").canonical_payload).projection,
      ),
      observations = array(v.observations).map(object),
      first = observations[0],
      second = observations[1];
    if (!first || !second) throw new Error("fixture observations");
    second.source_identity = first.source_identity ?? null;
    evidence(f.package_payload, 5).source_identity =
      first.source_identity ?? null;
    rebindCarrier(f, 0);
    refusal(
      bind(f),
      "profile_binding_mismatch",
      "material.support_carriers[0].canonical_payload.projection.observations[1].source_identity",
    );
  });
  it("compares recorded observation hash without inventing absent observation bodies", () => {
    const f = fixture(),
      v = object(
        object(row(f, "support_carriers").canonical_payload).projection,
      );
    object(array(v.observations)[0]).content_hash = "0".repeat(64);
    rebindCarrier(f, 0);
    refusal(
      bind(f),
      "profile_binding_mismatch",
      "material.support_carriers[0].canonical_payload.projection.observations[0].content_hash",
    );
    const g = fixture();
    expect(
      array(g.material.evidence_bodies)
        .map(object)
        .some(
          (b) =>
            b.evidence_unit_id ===
            evidence(g.package_payload, 4).evidence_unit_id,
        ),
    ).toBe(false);
    good(g);
  });
  it("checks count/order and tenor authored interpretation instead of calculating sentiment", () => {
    const f = fixture(),
      v = object(
        object(row(f, "support_carriers").canonical_payload).projection,
      );
    v.observation_count = 3;
    rebindCarrier(f, 0);
    refusal(
      bind(f),
      "profile_binding_mismatch",
      "material.support_carriers[0].canonical_payload.projection.observation_count",
    );
    const q = fixture();
    object(claim(q.package_payload, 4).value).observation_count = 3;
    object(row(q, "claim_bases", 4).value).observation_count = 3;
    replaceBaseHash(q, 4);
    refusal(
      bind(q),
      "profile_binding_mismatch",
      "package.manifest.claims[4].value.observation_count",
    );
  });
  it("requires observation start<=end<=as_of", () => {
    const f = fixture();
    object(evidence(f.package_payload, 4).observation_window).start =
      "2026-09-27T13:00:00Z";
    refusal(
      bind(f),
      "profile_binding_mismatch",
      "package.manifest.evidence[4].observation_window.start",
    );
  });
  it.each([
    ["after_minute", 81],
    ["window_matches", 4],
  ] as const)("refuses changed derivation parameter %s", (key, value) => {
    const f = fixture();
    object(row(f, "derivations").parameters)[key] = value;
    refusal(
      bind(f),
      "profile_calculation_mismatch",
      "material.derivations[0].parameters." + key,
    );
  });
  it("reproduces the actual five finite bodies as3/5, not an arbitrary NLP/output label", () => {
    const r = good();
    expect(r.view.claims[6]?.value).toEqual({
      after_minute: 80,
      count: 3,
      sample_size: 5,
    });
    const f = fixture(),
      d = row(f, "derivations");
    object(d.output).count = 4;
    d.output_hash = derivationOutputHash(d.output);
    ref(f.package_payload, 6).support_hash = d.output_hash;
    refusal(
      bind(f),
      "profile_calculation_mismatch",
      "material.derivations[0].output.count",
    );
  });
  it("rejects unsupported body grammar after actual body hashes/locators/provenance are reconciled", () => {
    const f = fixture(),
      b = row(f, "evidence_bodies", 1),
      e = evidence(f.package_payload, 11);
    b.canonical_content =
      "Previous match 1: an unsupported authored description.";
    b.content_hash = raw(text(b.canonical_content));
    e.content_hash = b.content_hash;
    object(e.locator).body_codepoint_end = Array.from(
      text(b.canonical_content),
    ).length;
    const input = object(array(row(f, "derivations").exact_input_refs)[0]);
    input.content_hash = b.content_hash;
    object(input.selected_provenance).locator = structuredClone(
      e.locator ?? null,
    );
    refusal(
      bind(f),
      "profile_support_unsupported",
      "material.evidence_bodies[1].canonical_content",
    );
  });
  it("checks publication flags and continuity topic/position before pretending real on-air proof", () => {
    const f = fixture(),
      v = object(
        object(row(f, "support_carriers", 1).canonical_payload).projection,
      );
    v.withdrawn = true;
    rebindCarrier(f, 1);
    refusal(
      bind(f),
      "profile_binding_mismatch",
      "material.support_carriers[1].canonical_payload.projection.withdrawn",
    );
    const q = fixture();
    object(
      object(row(q, "support_carriers", 1).canonical_payload).projection,
    ).topic_thread_id = "different-topic";
    rebindCarrier(q, 1);
    refusal(
      bind(q),
      "profile_binding_mismatch",
      "material.support_carriers[1].canonical_payload.projection.topic_thread_id",
    );
  });
  it("requires silent inverse and source attribution, without permitting speech", () => {
    const f = fixture();
    manifest(f.package_payload).silent_inputs = [];
    refusal(
      bind(f),
      "profile_binding_mismatch",
      "package.manifest.claims[7].effective_usage_class",
    );
    const q = fixture();
    object(claim(q.package_payload, 2).attribution_requirement).source_id =
      "absent-source";
    refusal(
      bind(q),
      "profile_support_unresolved",
      "package.manifest.claims[2].attribution_requirement.source_id",
    );
  });
  it("keeps authored claims synthetic and snapshot-only even when consistent fabricated labels pass", () => {
    const f = fixture();
    claim(f.package_payload).predicate = "synthetically-fabricated";
    row(f, "claim_bases").predicate = "synthetically-fabricated";
    replaceBaseHash(f, 0);
    const r = good(f);
    expect(r.view.assurance).toBe("snapshot_consistency_only");
    expect(r.view.materialization).toBe("supplied_snapshot_candidate");
  });
});

function amplifiedFixture(padding: number): Input {
  const f = fixture(),
    carrier = row(f, "support_carriers", 1);
  object(object(carrier.canonical_payload).projection).on_air_occurrence = {
    ...object(
      object(object(carrier.canonical_payload).projection).on_air_occurrence,
    ),
    exact_text: "x".repeat(16000),
  };
  rebindCarrier(f, 1);
  const original = ref(f.package_payload, 8);
  claim(f.package_payload, 8).support_refs = Array.from(
    { length: 116 },
    (_, i) => ({ ...original, claim_support_id: uuid(i) }),
  );
  const attribution = object(
    array(manifest(f.package_payload).source_attribution)[0],
  );
  attribution.display_name =
    text(attribution.display_name) + "x".repeat(padding);
  return f;
}
function rewritePreviousMatch(f: Input, body: string, count: number): void {
  const b = row(f, "evidence_bodies", 1),
    e = evidence(f.package_payload, 11),
    d = row(f, "derivations");
  b.canonical_content = body;
  b.content_hash = raw(body);
  e.content_hash = b.content_hash;
  object(e.locator).body_codepoint_end = Array.from(body).length;
  const input = object(array(d.exact_input_refs)[0]);
  input.content_hash = b.content_hash;
  object(input.selected_provenance).locator = structuredClone(
    e.locator ?? null,
  );
  object(d.output).count = count;
  d.output_hash = derivationOutputHash(d.output);
  ref(f.package_payload, 6).support_hash = d.output_hash;
  object(claim(f.package_payload, 6).value).count = count;
  object(row(f, "claim_bases", 6).value).count = count;
  replaceBaseHash(f, 6);
}
function rebindWindow(f: Input): void {
  const proof = object(
    object(manifest(f.package_payload).selection_provenance).match_window_proof,
  );
  const prior = array(proof.ordered_prior_schedule).map(object);
  for (const [i, value] of array(
    row(f, "derivations").exact_input_refs,
  ).entries()) {
    const input = object(value),
      e = evidence(f.package_payload, 11 + i),
      p = object(input.selected_provenance);
    e.event_completed_at = prior[i]?.completed_at ?? null;
    p.event_completed_at = e.event_completed_at;
    input.window_proof = structuredClone(proof);
  }
}
describe("independent exact logical View budget before repeated payload construction", () => {
  it("admits the independently specified legal2MiB View boundary", () => {
    const f = amplifiedFixture(320),
      input = bind(f);
    expect(Buffer.byteLength(input)).toBe(132277);
    expect(raw(input)).toBe(
      "4a011be947a9ef1c956400aa22135b36aba007d4e0463f921d361bfb0e3bcb45",
    );
    const r = good(f);
    expect(Buffer.byteLength(r.canonical_json)).toBe(2097152);
    expect(raw(r.canonical_json)).toBe(
      "37106fc372462663f65abc3e4e4ef2c39461b2cba10845dc465c12f2b756a697",
    );
    expect(r.view_sha256).toBe(
      "e941b33a78600f35c1479db9dedb6b6b6bd1c6291be57f50e819e36e9bb2da28",
    );
    expect(r.view.support_summaries).toHaveLength(124);
    expectFrozen(r);
  });
  it("refuses one byte above the independently pinned boundary before complete View serialization or hashing", () => {
    const f = amplifiedFixture(321),
      input = bind(f);
    expect(Buffer.byteLength(input)).toBe(132278);
    expect(raw(input)).toBe(
      "a9d12e4e0844eb64db60b602cc9f3dcb433101d17719c1c157ed4152856e5ba0",
    );
    const serialize = identity.canonicalJson;
    const spy = vi.spyOn(identity, "domainHash"),
      serialization = vi
        .spyOn(identity, "canonicalJson")
        .mockImplementation((v) => serialize(v));
    try {
      refusal(input, "profile_resource_limit", "view.canonical_json");
      expect(
        spy.mock.calls.some(
          (call) => call[0] === "planner-fixture-consumer-snapshot-v1",
        ),
      ).toBe(false);
      expect(
        serialization.mock.calls.some(
          (call) => isJsonObject(call[0]) && call[0].schema === PROFILE,
        ),
      ).toBe(false);
    } finally {
      serialization.mockRestore();
      spy.mockRestore();
    }
  });
  it("keeps an earlier binding error ahead of amplified-output refusal", () => {
    const f = amplifiedFixture(321);
    row(f, "claim_bases").predicate = "changed";
    refusal(
      bind(f),
      "profile_binding_mismatch",
      "material.claim_bases[0].predicate",
    );
  });
  it("counts every repeated complete proof, not unique hashes or references", () => {
    const f = amplifiedFixture(321);
    array(claim(f.package_payload, 8).support_refs).pop();
    const r = good(f);
    expect(Buffer.byteLength(r.canonical_json)).toBeLessThan(2097152);
    const records = r.view.support_summaries.filter(
      (x) => x.support_kind === "continuity",
    );
    expect(records).toHaveLength(115);
    if (!records[0] || !records[1]) throw new Error("test repeated proof");
    expect(records[0].inspection).toEqual(records[1].inspection);
    expect(records[0].inspection).not.toBe(records[1].inspection);
  });
  it("accounts exact escaping/UTF8 including supplementary and line-separator codepoints", () => {
    const f = fixture(),
      v = object(
        object(row(f, "support_carriers", 1).canonical_payload).projection,
      );
    object(v.on_air_occurrence).exact_text =
      'quote" slash\\ tab\t LF\n BS\b FF\f CR\r zero\u0000 é 😀 \u2028 \u2029';
    rebindCarrier(f, 1);
    const r = good(f),
      s = r.view.support_summaries.find((s) => s.support_kind === "continuity");
    if (!s) throw new Error("test carrier");
    expect(
      object(object(object(s.inspection).canonical_payload).projection)
        .on_air_occurrence,
    ).toEqual(v.on_air_occurrence);
    expect(r.canonical_json).toContain("\\u0000");
    expect(r.view_sha256).toBe(
      identity.domainHash("planner-fixture-consumer-snapshot-v1", r.view),
    );
  });
});

describe("independent finite derivation and exact proof chronology", () => {
  it.each([
    [80, 2],
    [81, 3],
  ] as const)(
    "counts minute%s against the owned strict80 threshold",
    (minute, count) => {
      const f = fixture();
      rewritePreviousMatch(
        f,
        "Previous match 1: Northbridge conceded in minute " +
          String(minute) +
          ".",
        count,
      );
      const r = good(f);
      expect(r.view.claims[6]?.value).toEqual({
        after_minute: 80,
        count,
        sample_size: 5,
      });
    },
  );
  it.each([0, 1441])(
    "refuses unsupported minute%s after all byte/provenance/hash bindings",
    (minute) => {
      const f = fixture();
      rewritePreviousMatch(
        f,
        "Previous match 1: Northbridge conceded in minute " +
          String(minute) +
          ".",
        3,
      );
      refusal(
        bind(f),
        "profile_support_unsupported",
        "material.evidence_bodies[1].canonical_content",
      );
    },
  );
  it("refuses equal current/prior instants even when fractional strings differ and proofs agree", () => {
    const f = fixture(),
      proof = object(
        object(manifest(f.package_payload).selection_provenance)
          .match_window_proof,
      );
    object(proof.current_event).completed_at = "2026-09-27T12:50:00.1Z";
    object(array(proof.ordered_prior_schedule)[0]).completed_at =
      "2026-09-27T12:50:00.10Z";
    rebindWindow(f);
    refusal(
      bind(f),
      "profile_binding_mismatch",
      "material.derivations[0].exact_input_refs[0].window_proof.ordered_prior_schedule[0].completed_at",
    );
  });
  it("refuses a nondecreasing ranked prior schedule after exact copied-proof repair", () => {
    const f = fixture(),
      proof = object(
        object(manifest(f.package_payload).selection_provenance)
          .match_window_proof,
      ),
      prior = array(proof.ordered_prior_schedule).map(object);
    if (!prior[0] || !prior[1]) throw new Error("test schedule");
    prior[1].completed_at = prior[0].completed_at ?? null;
    rebindWindow(f);
    refusal(
      bind(f),
      "profile_binding_mismatch",
      "material.derivations[0].exact_input_refs[0].window_proof.ordered_prior_schedule[1].completed_at",
    );
  });
  it("allows equivalent fractional instants for chronology while retaining different observation/hash bytes", () => {
    const f = fixture(),
      v = object(
        object(row(f, "support_carriers", 1).canonical_payload).projection,
      ),
      p = object(v.publication_attestation);
    p.published_at = "2026-09-27T12:00:00.10Z";
    object(v.on_air_occurrence).occurrence_time =
      "2026-09-27T12:00:00.099999999Z";
    rebindCarrier(f, 1);
    const a = good(f);
    p.published_at = "2026-09-27T12:00:00.1000000Z";
    rebindCarrier(f, 1);
    const b = good(f);
    expect(a.view_sha256).not.toBe(b.view_sha256);
    expect(a.canonical_json).not.toBe(b.canonical_json);
  });
});

describe("selected native and invariant controls — serial restored descriptors", () => {
  it("propagates an unexpected structural-selection native failure without eliminating its candidate", () => {
    const input = bind(fixture()),
      original = Object.hasOwn.bind(Object);
    const descriptor = Object.getOwnPropertyDescriptor(Object, "hasOwn");
    const sentinel = new TypeError("selected structural-prefix sentinel");
    const spy = vi.spyOn(Object, "hasOwn").mockImplementation((value, key) => {
      // P5 array ownership probes and P6 package fields delegate unchanged.
      // This keyset belongs to the supplied material signal projection in P7.
      if (key === "authored_synthetic_interpretation") throw sentinel;
      return original(value, key);
    });
    let caught: unknown;
    try {
      try {
        project(input);
      } catch (error) {
        caught = error;
      }
    } finally {
      spy.mockRestore();
    }
    expect(caught).toBe(sentinel);
    expect(Object.getOwnPropertyDescriptor(Object, "hasOwn")).toEqual(
      descriptor,
    );
    good();
  });
  it("propagates an unexpected native normalization TypeError and restores the exact descriptor", () => {
    const input = bind(fixture()),
      descriptor = Object.getOwnPropertyDescriptor(
        String.prototype,
        "normalize",
      );
    if (!descriptor) throw new Error("test descriptor");
    const sentinel = new TypeError("selected test sentinel");
    let caught: unknown;
    try {
      Object.defineProperty(String.prototype, "normalize", {
        ...descriptor,
        value() {
          throw sentinel;
        },
      });
      try {
        project(input);
      } catch (error) {
        caught = error;
      }
    } finally {
      Object.defineProperty(String.prototype, "normalize", descriptor);
    }
    expect(caught).toBe(sentinel);
    expect(
      Object.getOwnPropertyDescriptor(String.prototype, "normalize"),
    ).toEqual(descriptor);
    good();
  });
  it("detects all normalized-key collisions before traversing an earlier numeric child", () => {
    const descriptor = Object.getOwnPropertyDescriptor(Number, "isSafeInteger");
    if (!descriptor) throw new Error("test descriptor");
    const sentinel = new TypeError("selected number sentinel");
    let result: ReturnType<typeof project> | undefined;
    try {
      Object.defineProperty(Number, "isSafeInteger", {
        ...descriptor,
        value() {
          throw sentinel;
        },
      });
      result = project('{"é":-0,"e\\u0301":0}');
    } finally {
      Object.defineProperty(Number, "isSafeInteger", descriptor);
    }
    expect(result).toEqual({
      kind: "rejected",
      profile: PROFILE,
      code: "input_semantic_json_invalid",
      field: "input",
      parser_code: null,
    });
    expect(Object.getOwnPropertyDescriptor(Number, "isSafeInteger")).toEqual(
      descriptor,
    );
    good();
  });

  it.each([
    "claim-content-v1",
    "fixture-support-object-v1",
    "planner-fixture-consumer-snapshot-v1",
  ])(
    "propagates an unexpected later-domain%s failure with other domains delegated",
    (domain) => {
      const input = bind(fixture()),
        original = identity.domainHash,
        sentinel = new TypeError("selected later invariant sentinel");
      const spy = vi
        .spyOn(identity, "domainHash")
        .mockImplementation((d, value) => {
          if (d === domain) throw sentinel;
          return original(d, value);
        });
      let caught: unknown;
      try {
        try {
          project(input);
        } catch (error) {
          caught = error;
        }
      } finally {
        spy.mockRestore();
      }
      expect(caught).toBe(sentinel);
      expect(good().kind).toBe("materialized_candidate");
    },
  );

  it("propagates an unexpected P6 package-domain failure rather than treating it as source rejection", () => {
    const input = bind(fixture()),
      sentinel = new TypeError("selected invariant sentinel");
    const spy = vi.spyOn(identity, "domainHash").mockImplementation(() => {
      throw sentinel;
    });
    let caught: unknown;
    try {
      try {
        project(input);
      } catch (error) {
        caught = error;
      }
    } finally {
      spy.mockRestore();
    }
    expect(caught).toBe(sentinel);
    good();
  });
});
