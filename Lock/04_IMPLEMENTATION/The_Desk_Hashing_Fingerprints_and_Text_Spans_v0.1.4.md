# The Desk — Hashing, Fingerprints & Text Spans v0.1.4

**Status:** INACTIVE SUCCESSOR — proposed FINAL LOCK v1.2.5 implementation contract
**Date:** September 29, 2026
**Supersedes on activation:** v0.1.3
**Authority:** Technical Architecture v1.0 + accepted ADRs/addenda + owning specs. This document makes their hashing/fingerprint mechanics executable; it does not create editorial policy.

The [v1.2.4 active manifest](../00_INDEX/ACTIVE_SPECS_LOCKED_v1.2.4.md) still selects the predecessor. This file does not activate v1.2.5, create Fixture v0.4.5, authorize Migration 002, or begin Completion A. It incorporates accepted R2 with the final human claim-sequence and separate prompt-manifest adjudications. Architecture, accepted ADRs, all predecessors, and Foundation 001 remain unchanged.

Prospective owners are [Claims v0.1.2](../02_ACTIVE_SPECS/The_Desk_Claims_Policy_v0.1.2.md), [Evidence Package v0.2.2](../02_ACTIVE_SPECS/The_Desk_Evidence_Package_v0.2.2.md), [Writing v0.2.3](../02_ACTIVE_SPECS/The_Desk_Writing_Spec_v0.2.3.md), and [Performance & Render v0.1.4](../02_ACTIVE_SPECS/The_Desk_Performance_and_Render_v0.1.4.md). Future Handoff/Trace v0.5.4, Fixture v0.4.5, and the v1.2.5 activation files depend on completed conformance; they are not created or selected by I1. Generated successor values remain I2 outputs.

## 1. Canonical serializer

All hash-bearing semantic projections use one serializer:

- validate to JSON-compatible semantic values before hashing;
- strings and object keys normalized to Unicode NFC;
- reject duplicate keys created by normalization;
- object keys sorted by Unicode **code point** ascending, not locale and not JavaScript UTF-16 default sort;
- arrays preserve owning-spec semantic order; owning projections sort semantically unordered collections explicitly;
- compact UTF-8 JSON, literal non-ASCII (`ensure_ascii=false` semantics);
- reject `undefined`, NaN, infinities, cyclic objects, unpaired surrogates, and unprojected class/object instances;
- binary floating-point values are forbidden in semantic projections; represent exact decimals as canonical strings or fixed integers under the owning contract;
- semantic timestamps included in a projection use RFC 3339 UTC `Z`; operational timestamps are excluded unless an owning contract explicitly makes them semantic.

For the domain-separated artifacts in this document, hash bytes are:

```text
sha256(domain_separator + "\n" + canonical_json(semantic_projection))
```

Hex output is lowercase. Never hash a persistence/database row merely because it is convenient.

TTS base-request hashes retain the separate `v1:sha256(canonical_json(projection))` form owned by Performance & Render v0.1.4. Evidence body, exact serialized writer data, exact rendered-request, and audio-byte hashes are explicit raw-byte exceptions below; do not add a domain prefix to those bytes.

## 2. Script revision-parent identity

For `script-v2` projections:

- root script: omit `revision_parent_content_identity`;
- child script: `revision_parent_content_identity` is the **parent script content hash**, not a database ID.

The parent hash participates in the child's semantic identity.

## 3. Artifact domains used by Build 1–2

| Artifact / projection | Domain separator |
| --- | --- |
| Evidence Package semantic manifest | `evidence-package-v2` |
| Showrunner Brief | `showrunner-brief-v1` |
| Writer view | `writer-view-v1` |
| Writer context manifest | `writer-context-manifest-v1` |
| Script version | `script-v2` |
| Writing Craft review | `writing-craft-review-v1` |
| Performance Direction | `performance-direction-v1` |
| Semantic audit input | `audit-input-v1` |
| Render Manifest | `render-manifest-v1` |
| Assembly recipe | `assembly-recipe-v1` |
| Master assembly map | `master-assembly-map-v1` |
| Show config version | `show-config-v1` |
| Claims/Writing gate input | `claims-writing-gate-input-v1` |
| Performance gate input | `performance-gate-input-v1` |
| Render gate input | `render-gate-input-v1` |
| Assembly gate input | `assembly-gate-input-v1` |
| READY candidate | `ready-candidate-v1` |
| Immutable claim content | `claim-content-v1` |
| Frozen claim status/effective usage | `claim-frozen-state-v1` |
| Derivation output | `derivation-output-v1` |
| Fixture tenor / continuity carrier | `fixture-support-object-v1` |
| Complete prompt-manifest artifact | `prompt-manifest-artifact-v1` |
| Semantic-audit result carrier | `semantic-audit-result-v1` |
| Mechanical-validation result carrier | `mechanical-validation-result-v1` |
| Fixture revalidation snapshot carrier | `fixture-revalidation-snapshot-v1` |
| Fixture revalidation result carrier | `fixture-revalidation-result-v1` |

## 4. Build 1–2 artifact projection clarifications

The owning specs define semantic content. Select these projections from independently validated authoritative objects, not from expected-hash tables or whole database rows. A storage PK excluded from its own object's content may still be a required semantic reference in another projection; there is no global exclude-all-IDs rule.

### 4.1 Script `script-v2`

Select exactly `brief_hash`, `package_hash`, `writing_policy_version`, `program_block_refs`, `turns`, `turn_claim_uses`, `turn_evidence_uses`, and `prediction_candidates`, plus `revision_parent_content_identity` only for a child.

`turns[]` is the ordered semantic array. Each item selects `semantic_turn_id`, `program_block_id`, `participant_id`, `spoken_text`, and `planning_assignment_ref` only when supplied. Exclude its storage `turn_id` and redundant `sequence`. All persisted PKs/FKs remain literal Foundation UUIDs. The artifact explicitly pairs each local anchor to its revision-specific UUID; resolve that map before projecting uses. The three fixture revisions have 51 distinct turn UUIDs, not seventeen reused PKs.

Claim-use items select `semantic_turn_id`, `claim_id`, `use_mode`, `span_start`, `span_end`, and `claim_state_hash` (the package's exact frozen-state hash). Evidence-use items select `semantic_turn_id`, `evidence_unit_id`, `use_mode`, `span_start`, `span_end`, and `rights_policy_version` (the exact frozen rights version). Resolve the turn anchor from the referenced row in this script, never from a runtime alias. Order uses by script turn position, span start/end, use mode, and target UUID as a deterministic final tie-break; this tie-break is use enumeration, never claim-event reduction. Reject duplicate identical use entries.

Preserve ordered brief-owned program-block UUID refs and prediction candidates. Exclude script/artifact PKs, program-run/attempt IDs, purpose, writer model-run ID, `created_at`, relational revision-parent ID, revision notes/reason, script-phase labels, finding bookkeeping refs, and expected hashes. Parent content hash remains semantic. Fresh storage turn UUIDs alone do not change script content; changing anchor/order/text/protected use/bound content does.

### 4.2 Writing Craft review `writing-craft-review-v1`

`findings[]` is an ordered semantic array. `findings[].finding_id` is a local bookkeeping anchor and is **excluded** from the review's semantic projection. Finding type, severity, span refs, observation, consequence, revision instruction, prohibited shortcut, ordered position, subject-script identity, critic contract/policy identities, and outcome remain semantic.

Select top-level `subject_script_hash`, `craft_policy_version`, `critic_contract_version`, `findings`, and `outcome`. Findings' turn/span refs resolve against that exact subject script and select its semantic anchors. Retain their other listed diagnostic fields; reject unknown fields rather than hashing a row. Exclude the review PK, subject-script storage UUID, critic model-run ID, creation time, and own hash. The subject hash scopes the anchor mapping.

### 4.2.1 Performance Direction

Select `script_hash`, `direction_spec_version`, and ordered `performance_intents`. Each intent selects `scope_type`, `scope_ref`, `intent_type`, `value`, `strength`, and `timing_anchor`. Resolve turn-scoped refs/timing turn refs to the exact bound script's semantic anchors; program-block refs remain governed UUIDs. Exclude intent PKs and the direction/script/model/run/actor storage envelope, creation time, redundant input fingerprint, and own hash. The structural direction artifact/rows separately preserve exact final-revision turn UUIDs.

### 4.3 Render Manifest `render-manifest-v1`

Within `render_blocks[]`, the following are **excluded** from the semantic Render Manifest projection:

- `sequence` because array order is semantic;
- `render_block_id` because it is storage identity;
- `state` because it is operational execution state.

For each ordered render block, the semantic plan includes:

```text
program_block_id
ordered_turn_ids
speaker_map
provider
context_recipe_version
resolved_context_refs
applied_performance_intent_ids
applied_pronunciation_rendering_ids
named_text_transform_versions
base_request_hash
```

The top-level semantic Render Manifest includes the exact script and Performance Direction content identities, semantic-audit fingerprint, render/adapter/provider/show-config versions, and those ordered semantic render-block plans. Storage IDs and timestamps are excluded.

Structural program-block/turn/intent/pronunciation refs in the manifest are literal governed UUIDs and must resolve to the exact final script/versions; these references stay semantic in this plan. They are distinct from the nested render-content projection in §7.1, which excludes bookkeeping PKs after exact resolution.

### 4.4 Writer view and context

`writer-view-v1` selects the exact nineteen-key writer-data object in Writing v0.2.3 §5.1. Its raw canonical UTF-8 bytes, without newline/BOM, also produce `writer_context_manifest.serialized_input_hash` with raw SHA-256. The complete rendered model request has its own raw-byte hash; the two byte hashes do not claim to cover the same object.

`writer-context-manifest-v1` selects exactly `required_component_refs`, `required_claim_refs`, `required_context_selection_refs`, `required_character_refs`, `required_policy_refs`, `required_comprehension_target_refs`, `serialized_input_hash`, `estimated_input_tokens`, `model_context_limit`, `reserved_output_tokens`, and `completeness_check`. Use an empty applicable-target list where none applies. Exclude its own hash and outer storage/execution envelope. Required-ref ordering is owned by Writing. Do not put the context manifest into the data it hashes or serialize gate-only forbidden-ID inventories to the writer.

### 4.5 Assembly recipe and map

The fixture `assembly-recipe-v1` selects exactly `assembly_recipe_version`, `ordered_audio_artifact_hashes`, `normalization`, `output_target`, `trim_policy_version`, `join_gap_policy_version`, `fade_policy_version`, `static_asset_hashes`, and `deterministic_fixture_command`. Ordered byte hashes include the sting at its exact selected position. Exclude recipe/artifact PKs, metadata envelopes, creation time, and own hash. Unchanged bytes/settings may retain this hash; new storage IDs alone do not enter it.

The fixture `master-assembly-map-v1` selects exactly `assembly_recipe_id`, `assembly_recipe_hash`, `master_audio_artifact_id`, `master_artifact_id`, `master_audio_hash`, `sample_rate_hz`, `selected_audio_hashes`, `segments`, `program_block_offsets`, `timing_method`, and `timing_confidence`. Each ordered segment selects `kind`, `audio_artifact_id`, `artifact_id`, `audio_sha256`, `render_block_id`, `render_take_id`, `take_selection_id`, `program_block_id`, `start_frame`, `end_frame`, and `join_metadata`. A static segment has null speech/take/block refs and explicit inter-block placement in `join_metadata`; its audio row/artifact/hash remain exact. Program-block offset entries select `program_block_id`, `start_frame`, and `end_frame` in program-block order. Frame bounds are half-open at the declared output rate.

Exclude the map PK/artifact ID, creation time, self hash, and redundant derived millisecond/decimal display fields. Optional actual turn timing, when available under an explicitly versioned extension, must enter that extension's projection; the base fixture fabricates none. Recipe/master/selected row refs and hashes must all reconcile. P&R owns exact duration rounding and frame arithmetic; row milliseconds never accumulate into assembly authority.

### 4.6 Durable result carriers

The existing artifact registry needs an owned content hash for its audit, mechanical-validation, and two revalidation results. These bounded projections give those four required carriers integrity without adding tables, wrappers, or a new result service:

| Domain | Exact top-level projection keys |
| --- | --- |
| `semantic-audit-result-v1` | `auditor_kind`, `auditor_version`, `input_projection`, `input_fingerprint`, `result`, `findings`, `fixture_stub` |
| `mechanical-validation-result-v1` | `validation_policy_version`, `base_request_hash`, `take_index`, `audio_sha256`, `result`, `failure_code`, `measurements` |
| `fixture-revalidation-snapshot-v1` | `fixture_stub`, `live_search`, `source_package_hash`, `claim_state_changes`, `sensitivity_changes`, `mode_rule_changes`, `captured_at` |
| `fixture-revalidation-result-v1` | `adapter`, `fixture_stub`, `ready_candidate_fingerprint`, `snapshot_artifact_id`, `snapshot_hash`, `result`, `expires_at`, `publication_enabled`, `next_allowed_state`, `publishing_transition_allowed` |

Audit findings preserve ordered typed content and exact subject/span bindings; a finding label is bookkeeping. Mechanical measurements include the independently observed/required frame counts and declared comparison rule. The fixture stub changes are explicit frozen-vs-live diffs, with claim refs/status/usage/sequence cursors where relevant; empty changes are explicit arrays. Snapshot `captured_at` is its semantic as-of point, and result `expires_at` is semantic authorization expiry, both UTC `Z`. Hash the complete selected nested values; exclude carrier/run PKs, local display labels, outer insertion time, and self hashes. These result hashes are future generated values. Revalidation remains an interface stub and never gains live-search or publication authority.

## 5. Exact stage-fingerprint projections for Builds 1–2

A gate fingerprint depends only on artifacts available when that gate runs. A later artifact may never be included in an earlier gate fingerprint.

Future Fixture v0.4.5 must ship the exact projection object for every stage in `gate_fingerprint_inputs.json`. Implementations derive the projection from authoritative records and independently reproduce the generated expected hash. They never hash the expected-hash field itself. The six domains and top-level key sets below are unchanged.

### 5.1 Claims/Writing gate

Domain: `claims-writing-gate-input-v1`

Exact projection keys:

```text
package_hash
brief_hash
script_hash
claims_policy_version
writing_policy_version
gate_set_version
```

Performance Direction is absent because it does not exist at this gate.

### 5.2 Performance gate

Domain: `performance-gate-input-v1`

Exact projection keys:

```text
script_hash
performance_direction_hash
performance_policy_version
gate_set_version
```

### 5.3 Semantic audit input

Domain: `audit-input-v1`

Exact projection keys:

```text
package_hash
brief_hash
script_hash
performance_direction_hash
claims_policy_version
writing_policy_version
performance_policy_version
auditor_contract_version
```

The immutable policy `version_id` is the fingerprint-facing policy identity for Builds 1–2. `config/policy_versions.json` separately binds every such version ID to the exact active source SHA-256, and conformance must fail if that source-hash binding does not match the pack.

### 5.4 Render gate

Domain: `render-gate-input-v1`

Exact projection keys:

```text
render_manifest_hash
audit_input_fingerprint
render_policy_version
gate_set_version
```

### 5.5 Assembly gate

Domain: `assembly-gate-input-v1`

Exact projection keys:

```text
selected_take_lineage[]
assembly_recipe_hash
master_assembly_map_hash
assembly_policy_version
gate_set_version
```

Each ordered `selected_take_lineage[]` item contains exactly:

```text
render_block_id
take_selection_id
render_take_id
take_index
audio_sha256
```

Only final approved selections are included, in render-block order. Rejected/superseded selections remain provenance but are not the selected assembly inputs.

### 5.6 READY candidate

Domain: `ready-candidate-v1`

Exact projection keys:

```text
master_artifact_id
master_audio_sha256
assembly_gate_fingerprint
program_run_id
attempt_id
show_config_version_hash
review_gate_version
gate_set_version
```

Operational wait timestamps are excluded. A repaired child attempt therefore creates a distinct READY candidate even if it reuses the same validated master, because the attempt binding is semantic to the review authorization.

## 6. Successor generated values

I1 defines projections without inventing Fixture v0.4.5 expected hashes. I2 independently generates and validates them in topological order. None of the predecessor stage constants are promoted to successor values merely because a stage/domain name stays the same. The independent three-field model exclusion vectors in §11.1 retain their already-generated inputs/values because their projections do not acquire fixture dependencies.

## 7. TTS base-request projection and conformance vectors

Performance & Render v0.1.4 §23 owns the eleven render-affecting base-request fields. The projection function selects exactly those eleven fields and their nested projections below from a validated resolved request record. It excludes `take_index` and non-render administrative metadata.

Future Fixture v0.4.5 must distinguish two kinds of render vectors:

1. `render_request_projections.json` contains the **nine actual fixture block baseline projections** and their base hashes.
2. `base_request_hash_conformance.json` contains the **nine P&R §24 sensitivity/stability vectors**:
   - equivalent independent caller;
   - non-render admin field excluded;
   - one spoken word changes;
   - voice-profile render field changes;
   - performance intent changes;
   - bounded context changes;
   - pronunciation rendering changes;
   - adapter transform changes;
   - `take_index` changes without changing the base hash.

The conformance file includes both each row-level `input_record` and its expected projected render request. CI must test the projection function as well as the serializer/hash function.

### 7.1 Exact nested fixture selection

Select exactly the eleven top-level P&R fields. Their bounded nested shape is:

| Field | Selection |
| --- | --- |
| `concrete_model_identity` | Exact nonblank concrete model/version string. |
| `adapter_render_contract_version` | Exact immutable adapter contract version string, advanced for the corrected fixture representation. |
| `immutable_voice_profile_version_render_fields` | Object keyed by participant identity; each value selects `version`, `provider`, `provider_voice_id`, `provider_model_compatibility`, `render_facing_design`, and `request_side_voice_controls` from that participant's exact bound voice version. Compatibility is a unique model-identity list sorted by Unicode code point; controls select actual resolved render settings. |
| `speaker_map` | Ordered generated-turn array of `{semantic_turn_id, participant_id, voice_version}`; `voice_version` is that participant's immutable integer version in the voice map. |
| `resolved_generation_settings` | Exact resolved fixture settings `{temperature, format, sample_rate_hz, channels}`. Temperature is exact decimal text. Other adapters need an explicit versioned projection rather than silently hashing arbitrary configuration. |
| `canonical_spoken_text` | Ordered generated-turn array of `{semantic_turn_id, participant_id, spoken_text}` using exact NFC canonical words. |
| `approved_performance_intents` | Ordered applied array selecting `{scope_type, scope_ref, intent_type, value, strength, timing_anchor}` from audited direction. Resolve turn refs/timing turn refs to the bound script's semantic anchors; retain governed program-block refs for block scope. Exclude intent PK. |
| `bounded_render_context` | `{recipe_version, turns}`; ordered context turns select `{semantic_turn_id, participant_id, spoken_text}` from exact approved script content. An empty context has an explicit empty array. |
| `render_facing_persona_or_scene_config` | Exact fixture `{scene_version, description}` plus voice design already in the voice map; no planning-only notes. |
| `applied_pronunciation_rendering_versions` | Ordered applied objects selecting `entity_identity`, `canonical_text`, `canonical_version`, `language`, `ipa` (explicit null when absent), `provider`, `participant_id`, `voice_render_identity`, `rendering_version`, `render_text`, and `applications`. `voice_render_identity` is the exact six-field voice-map value for that participant. Ordered applications select `{semantic_turn_id, start_offset, end_offset}`. |
| `named_text_transform_versions` | Ordered version strings for transforms actually applied, including literal escaping and pronunciation application. |

Every semantic anchor resolves through the exact script referenced by the manifest. The script binding stays in manifest/provenance; do not insert an unrelated whole-script hash into each base request and invent wider context dependency. Ordered generated turns must stay inside one program block. Bounded preceding context may use the approved cross-block recipe, and changes to that actual context invalidate the dependent request.

Pronunciation entries follow first application in generated-turn/span order, with canonical entity/voice/rendering identity as a deterministic tie-break; applications follow generated-turn/span order. Project the exact applied canonical version, rendering, and voice fields after structural/compatibility/freshness checks. A different storage UUID with identical selected content does not itself affect base identity. Actual voice/version, pronunciation/version/application, intent, text, context, model, settings, or transform changes do.

Explicitly exclude voice/canonical/rendering/intent/turn storage PKs, mutable status/current flags, QA notes, admin labels, measurements, creation timestamps, redundant rendering/expected hashes, output/cost/reservation identities, and `take_index`. The manifest still preserves and validates exact structural UUIDs. Do not hash full nested persistence rows. Provider syntax remains a derived adapter request, never script content.

Future vectors must independently test every selected nested sensitivity, excluded PK/status/QA metadata stability, wrong final-turn/voice/pronunciation binding, and unknown fixture request rejection. TTS mapping is generated after these base hashes and cannot enter their preimages.

## 8. Spoken-text span coordinates

All `span_start` / `span_end` coordinates are:

- zero-based;
- half-open `[start, end)`;
- counted in Unicode **code points**;
- over NFC-normalized canonical `spoken_text`.

They are not UTF-8 byte offsets and not JavaScript UTF-16 code-unit indices. Persistence/validation code must convert deliberately when using native JavaScript string indexes.

Build-1 conformance includes a non-ASCII/astral-character span vector and a key-order vector that distinguishes Unicode code-point order from JavaScript default UTF-16 ordering.

## 9. Model-judgement classification

`implied_access` remains an adjudicated semantic blocker under the governing architecture/Claims rules. It is not a deterministic keyword gate. Fixture vector NV03 is therefore `recorded_model_eval`, not deterministic CI. Deterministic CI may verify that the semantic-audit result is represented and binding, but may not fake the adjudication with a phrase blacklist.

## 10. Fixture conformance

Future Frozen Walking-Skeleton Fixture v0.4.5 must supply the executable vectors for this successor. I1 creates no ZIP or expected-value constants and leaves the active Fixture v0.4.4 selection untouched.

If fixture values and this contract disagree, this contract and the higher-authority owning spec govern; rebuild the fixture rather than weakening validation.

## 11. Model semantic-input identity (unchanged)

This retains the v0.1.3 three-field projection exactly. Complete request provenance gains its own artifact in §12.5; it does not expand model semantic-input identity.

Domain separator: `model-semantic-input-v1`.

For one `model_run`, derive exactly this semantic projection from its referenced durable authoritative `prompt_manifest`:

```json
{
  "component_versions": "<prompt_manifest.component_versions>",
  "policy_source_hashes": "<prompt_manifest.policy_source_hashes>",
  "rendered_request_hash": "<prompt_manifest.rendered_request_hash>"
}
```

The placeholders denote the actual JSON values, not string interpolation or stringification. Use the canonical serializer in §1, preserving the referenced manifest values.

```text
sha256("model-semantic-input-v1" + "\n" + canonical_json(semantic_projection))
```

Output is lowercase hexadecimal SHA-256.

Explicitly exclude `prompt_manifest_id`, `model_run_id`, `provider_call_id`, `program_run_id`, `attempt_id`, `provider`, `model_identifier`, retry identity, `operational_try_number`, intentional take identity, timestamps, usage, cost, currency, `output_artifact_id`, database IDs, storage IDs, and execution-only metadata. Select only the three named manifest fields; never hash a whole persistence row.

Semantic input identity must be reconstructable from durable authoritative provenance. Provider/model choice is execution identity, not semantic input identity. `rendered_request_hash` binds the exact rendered request. `component_versions` and `policy_source_hashes` preserve provenance identity even if rendered request bytes happen to remain identical. Workers must never invent stage-specific semantic-input projections.

### 11.1 Deterministic conformance vectors

The active Fixture v0.4.4 already contains these independent `model_semantic_input_conformance.json` vectors. I2 carries their unchanged projection cases into Fixture v0.4.5, alongside new complete-manifest-artifact vectors. An identical semantic manifest has the same hash; each of the three fields changed independently changes the hash; each excluded metadata field changed independently leaves the hash unchanged. These are additive vectors and do not change any pre-existing domain or projection.

Baseline semantic projection:

```json
{
  "component_versions": {
    "fixture_prompt": "fixture-model-prompt-v1"
  },
  "policy_source_hashes": {
    "policy": "0000000000000000000000000000000000000000000000000000000000000000"
  },
  "rendered_request_hash": "1111111111111111111111111111111111111111111111111111111111111111"
}
```

| Vector | Expected SHA-256 |
| --- | --- |
| identical-semantic-fields | `02d99899a1ff6b46e960712558ca46521db078edc0e4abfeb7cd4042a28e9b3f` |
| change-component_versions | `27e9535fdfc0c5afdcd19c4555f2c73368fded309518f987a9816c53a8bd96cf` |
| change-policy_source_hashes | `0d74d4c4999b15fef2496df59f6d9c5e42c9da1055fadd0c19757f1943a9c194` |
| change-rendered_request_hash | `932c46368467899714c36d11f9a8f1f17d1b20c5c20b1dec7a17757f259c000c` |

Every excluded-metadata vector has the baseline hash `02d99899a1ff6b46e960712558ca46521db078edc0e4abfeb7cd4042a28e9b3f`.

## 12. Knowledge and complete prompt-manifest projections

### 12.1 Claim content and frozen state

Select exactly this immutable claim-content object from the authoritative claim record:

```text
{claim_kind, origin, subject_domain, subject, predicate, value,
 initial_status, initial_usage_class, asserted_at}
```

`asserted_at` is semantic UTC `Z` or explicit null; `subject` and `value` retain validated canonical JSON values. Hash with `claim-content-v1`. Initial status/usage changes affect this hash. Exclude claim/artifact PKs, insertion time, supports, approved representations, supersession-link bookkeeping, later events, and current projections.

Reduce the selected claim-local event prefix by `event_sequence`, starting from the immutable initial fields, and apply Claims' strictest permission rules. Select exactly `{claim_content_hash, state, effective_usage_class}` for `claim-frozen-state-v1`; `state` means reduced status. No event actor/time/reason/UUID/sequence is an extra state-hash field.

The package manifest separately includes initial fields, reduced usage, explicit `state_event_cursor` null or `{claim_state_event_id, event_sequence}`, reduced status/effective usage, support roles/refs/hashes, and selected provenance/rights/exposure. Its `evidence-package-v2` hash therefore binds the precise prefix, even when distinct prefixes yield the same state hash. Cursor UUID/sequence must resolve to the same claim and selected last event. Equal `occurred_at` values are reduced by sequence, never UUID/JSON/timestamp order. Later appends cannot insert an earlier sequence and reinterpret that prefix. Null binds the empty prefix; base Fixture v0.4.5 has zero events. The isolated usage-change scenario starts at sequence 1.

### 12.2 Evidence bodies

In the fixture text profile, `evidence_units.canonical_content` is the JSON string containing the exact NFC body. Select that string's UTF-8 bytes and hash raw SHA-256, without JSON quotes, domain prefix, trimming, extra newline, source identity, locator, or rights. Two evidence UUIDs may share this body hash while retaining different provenance/rights. The package, not the body hash, binds the selected UUID and provenance snapshot. Evidence lookup/idempotency must not collapse rows by body hash.

### 12.3 Derivation output

`derivation-output-v1` selects exactly the complete validated `derivation_runs.output` JSON value. Parameters and ordered `exact_input_refs` are separate authoritative calculation provenance and must independently reproduce that output under the exact rule version. The fixture uses `{after_minute:80, window_matches:5}` parameters and `{count:3, sample_size:5, after_minute:80}` output, counting strictly greater than minute 80. Validate distinct matches and the selected league/entity/as-of window. No package back-reference enters derivation inputs.

### 12.4 External support artifact equality

The complete hash-bearing tenor/continuity carrier payload is exactly `{support_kind, projection}` under `fixture-support-object-v1`. `support_kind` identifies the corresponding signal or continuity support. The tenor projection includes method version, four ordered evidence UUIDs/body hashes, scoped observations/count, and explicitly authored synthetic interpretation. The continuity projection includes the atomic prior on-air occurrence, exact relevant text/position, external episode/script/version refs, publication attestation, and non-withdrawn status. Hash the entire selected nested proof; no second summary digest is authoritative.

The resulting digest is the carrier's actual `artifacts.content_hash` and must literally equal `claim_supports.support_hash`. `external_support_identity` resolves `artifact:<literal UUID>` to that carrier. Evidence support hashes equal referenced body hashes; derivation support hashes equal authoritative output hashes. Roles bind in the package support snapshot and do not turn an attribution/context-only link into value support. Carrier UUID/local labels outside the payload remain bookkeeping. No extra generic evidence-provenance carrier is added.

### 12.5 Complete prompt-manifest artifact

Future Migration 002 adds:

```text
prompt_manifests.artifact_id uuid NOT NULL UNIQUE
  REFERENCES artifacts(artifact_id)
```

Each of the five fixture prompt rows binds one dedicated immutable request-provenance artifact, distinct from its model output. `artifacts.canonical_payload` is the **complete rights-safe manifest object**, with exactly these fields:

| Field | Required content |
| --- | --- |
| `schema_version` | `prompt-manifest/1` for this complete-payload contract. |
| `purpose` | Purpose-specific model role: planner, writer, Craft Critic, writer revision, or speech texture. |
| `component_versions` | Exact typed prompt-row component/version object. |
| `template_version` | Exact rendered request-template version. |
| `policy_source_hashes` | Exact typed prompt-row map binding policy versions to owning source SHA-256 values. |
| `ordered_input_artifacts` | Ordered `{artifact_id, artifact_type, content_hash}` refs; no copied artifact bodies. |
| `ordered_input_evidence` | Ordered `{evidence_unit_id, content_hash, rights_version_id, exposure}` refs, or an explicit empty array. |
| `ordered_input_claims` | Ordered `{claim_id, claim_content_hash, frozen_state_hash, package_hash}` refs, or an explicit empty array. |
| `exposure_instructions` | Complete consumer/profile/representation instructions for the request, consistent with its package and bounded view. |
| `non_source_text` | Ordered `{role, text}` entries for applicable non-rights-bearing system/product/operator instructions. |
| `provider` | Exact fixture provider identity. |
| `model_identifier` | Exact concrete fixture model identity. |
| `settings` | Complete resolved settings object; exact decimals use canonical strings. |
| `rendered_request_hash` | Exact typed prompt-row hash of the rendered request bytes. |
| `rendered_request_ref` | Rights-safe fixture request-specimen reference identifying the immutable ZIP member and that manifest's specimen; general retention may instead declare unavailable bytes. No transient signed URL or secret. |
| `retention` | Explicit manifest policy/version, request-byte retention/availability, raw-output retention policy, and source-byte retention/provenance declaration. |

Do not retain rights-bearing source excerpts in this payload, including within instructions, settings, exposure text, or retained request specimens. Record refs/hashes, locator/exposure metadata where needed, and permitted non-source text. Canonical evidence remains its rights-bearing owner. This implements Architecture's prompt-manifest rule and preserves explanation after required purge without promising reconstruction of deleted source bytes.

The artifact content hash is exactly:

```text
SHA256("prompt-manifest-artifact-v1\n" +
       canonical_json(artifacts.canonical_payload))
```

**Every field and nested value of that complete manifest payload participates.** There is no hidden unhashed provenance tail. Exclude only the outer artifact/typed-row storage envelope: own artifact/prompt PKs, storage URI/byte size, insertion timestamps, model-run/provider-call/retry/output IDs, cost, and the content hash itself. These excluded values must not be smuggled into the complete payload as an envelope. Ordered input reference UUIDs remain hash-bearing governed refs. Provider/model/settings/exposure/retention/non-source text are included in this complete-manifest artifact hash.

The relational prompt row remains authoritative for `component_versions`, `rendered_request_hash`, and `policy_source_hashes`. Each must reconcile exactly with its corresponding complete-payload field, using canonical JSON value equality where appropriate. Independently rehash the complete payload and verify the unique FK, typed three-field reconciliation, ordered inputs/exposure, request specimen hash, model binding, and retention declaration. A missing artifact, wrong role/input/field, excerpt duplication, or stale hash fails.

`rendered_request_hash` is raw SHA-256 of the **exact rendered UTF-8 request bytes**, without added domain prefix, newline, trimming, or reserialization. The fixture owns exact rights-safe request strings; never infer this hash from an output, template name, or input hash alone.

`model-semantic-input-v1` remains §11's exact three-field relational projection. Do not add provider/model/output/cost/timestamp/storage/complete-artifact identity to it. With those three fields unchanged, changing provider/model/settings/exposure/retention provenance changes the complete-manifest hash while preserving semantic-input identity. If request bytes or either other selected relational field actually changes, semantic-input identity changes through the existing projection.

The five output artifacts remain the Brief, three script revisions, and Craft Critic response under their owning semantic domains. They do not carry complete request provenance in `fixture_model_provenance` or another hidden `canonical_payload` field. Model-run/output bindings and provider reservation/terminal-event accounting remain separate authoritative objects. No new provenance service/table is required.

## 13. Future persistence profile and initial migration boundary

This is the approved **future** Foundation 001+002 contract, not an I1 migration or executable DDL. It changes exactly eight existing tables. Field details belong to the linked owners; this table records the bounded implementation interface.

| Table | Approved future Migration 002 change | Owning successor |
| --- | --- | --- |
| `claims` | Add `initial_status text NOT NULL`, no default; six-status CHECK; immutable initial-state authority. | Claims §4.4 |
| `claim_state_events` | Add `event_sequence integer NOT NULL`, no default; positive CHECK and `UNIQUE (claim_id, event_sequence)`; drop `claim_state_events_claim_id_occurred_at_event_type_key` from Foundation 001; first 1, strictly increasing accepted append, authoritative claim-local reducer order. | Claims §4.4.2 |
| `evidence_units` | Remove global body-hash uniqueness `evidence_units_content_hash_key`; add non-unique B-tree `evidence_units_content_hash_idx` lookup; preserve PK/hash/rights/supersession checks/FKs. | Evidence Package §10.0 |
| `claim_supports` | Add `support_role text NOT NULL`, no default; five-role CHECK; preserve one-target/FK constraints. | Claims §4.3 |
| `derivation_runs` | Add `parameters jsonb NOT NULL` and `output jsonb NOT NULL`, no defaults; parameters object; output non-null JSON object/array/string/number/boolean. | Claims §12 |
| `pronunciations` | Remove canonical-text uniqueness; add entity/language/positive canonical-version identity, nullable IPA and immediate predecessor FK; version/lineage/NFC/nonblank rules. | P&R §18.1 |
| `pronunciation_renderings` | Add required exact voice-version FK; replace old uniqueness with canonical/provider/voice-version/rendering-version uniqueness; positive/nonblank/structural rules only. | P&R §18.2 |
| `prompt_manifests` | Add required unique complete-manifest artifact FK; keep the existing three typed fields authoritative and reconciled. | Hashing §12.5 / Architecture prompt manifests |

The exact legacy constraint name above was read from a fresh PostgreSQL 17 catalog after applying the unchanged Foundation 001 migration. Future 002 must remove that timestamp/type uniqueness and must not replace it with timestamp-based causal or deduplication logic. Same-claim, same-time, same-type accepted events are distinct when their event UUIDs and sequences are distinct. Durable authored event identity/operation semantics must make execution retries converge on one intended event or fail safely; a new available sequence does not make a duplicate logical transition acceptable. Migration 002 / Completion A must prove this alongside monotonic concurrency enforcement.

Foundation's existing immutable-row guards, lifecycle/provider history, FKs, rights, privileges, and actor boundaries remain. Event allocation/concurrency enforcement is later 002/Completion A work and must prove that no later insert can rewrite an earlier logical prefix; positive/unique sequence constraints alone are insufficient. Provider/model/voice compatibility remains validator/runtime work, not a SQL JSON trigger. Add no other columns/tables/services or defaults/backfills under this contract.

The approved initial path **fails on populated protected history**. Extend R2's eleven-table inspection set with `prompt_manifests`; `claim_state_events` was already protected. The final twelve-table set and fixed lock/inspection order are:

```text
claim_state_events
claim_supports
claims
derivation_runs
evidence_packages
evidence_units
prompt_manifests
pronunciation_renderings
pronunciations
render_manifests
turn_claim_uses
turn_evidence_uses
```

Acquire the existing migrator's transaction/advisory boundary, then protect all twelve tables before their emptiness checks and the profile DDL. All twelve must be empty. Dependent model/use/history rows cannot authorize bypassing these checks. Accounts, shows, show configuration, artifacts, and independently provisioned voice records do not need to be empty merely because they already exist.

Use the existing one-client transaction and migration checksum/ledger mechanism; hold fixed-order table locks through commit. `ACCESS EXCLUSIVE` is the bounded initial lock choice. Check emptiness after locks, then create/validate the required constraints and ordinary non-unique index in that same transaction. Unexpected schema or populated protected data fails and rolls back; any populated-data transition requires a separately reviewed data-aware migration. No CASCADE, inferred initial state/role, synthetic history, empty-JSON default, disabled immutable trigger, unvalidated constraint, or expanded runtime privilege is permitted. Committed populated successor history is repaired forward or restored in isolation, not destructively downgraded.

The repository selects PostgreSQL major 17 for CI. The future add/drop-column/constraint and lock clauses were checked against official [ALTER TABLE](https://www.postgresql.org/docs/17/sql-altertable.html), [LOCK](https://www.postgresql.org/docs/17/sql-lock.html), [CREATE INDEX](https://www.postgresql.org/docs/17/sql-createindex.html), and [constraints](https://www.postgresql.org/docs/17/ddl-constraints.html) documentation. Structural cross-row lineage requires insert checks/FKs rather than a cross-row CHECK expression; SQL [NFC normalization](https://www.postgresql.org/docs/17/functions-string.html) requires UTF8 encoding. The existing `pg` driver is pinned to 8.16.3; its official [transaction guidance](https://node-postgres.com/features/transactions) requires the same client across transaction statements. Official [release notes](https://www.postgresql.org/docs/17/release.html), [security advisories](https://www.postgresql.org/support/security/17/), and [support policy](https://www.postgresql.org/support/versioning/) were consulted. This records contract feasibility, not a server/patch/security certification; no upgrade or SQL execution is part of I1. Recheck actual selected runtime/driver/server versions before the later implementation.

## 14. Fixture inventory, dependency graph, and later conformance

### 14.1 Exact base artifact registry

Derive registry rows from distinct immutable objects with actual durable references. The minimum base Fixture v0.4.5 registry is exactly **35 artifacts**:

| Family | Count | Durable owner/reference |
| --- | ---: | --- |
| Model output objects | 5 | One Brief, three script artifacts, one Craft Critic review; model outputs and typed artifact bindings. |
| Complete prompt-manifest objects | 5 | Five distinct `prompt_manifests.artifact_id` bindings, one per model role; §12.5 complete-payload hash. |
| Audio bytes | 12 | Ten takes, one static sting, one clean master; audio rows/provider responses/selections/assembly. |
| Evidence Package | 1 | `evidence_packages.artifact_id`; both attempts and downstream frozen inputs. |
| Performance Direction | 1 | `performance_direction_versions.artifact_id`; final script/intents. |
| Semantic-audit result | 1 | Both applicable `audit_runs.result_artifact_id` refs to the same valid frozen result. |
| Render Manifest | 1 | `render_manifests.artifact_id`; exact final plan/request bindings. |
| Assembly recipe | 1 | `assembly_recipes.artifact_id`; exact selected bytes/settings. |
| Master assembly map | 1 | `master_assembly_maps.artifact_id`; recipe/master/block/frame explanation. |
| External tenor and continuity | 2 | Exact support carriers; support hash equals each artifact's content hash. |
| Writer view and context manifest | 2 | Separate bounded input/completeness artifacts referenced by model manifests. |
| Mechanical-validation result | 1 | `reroll_triggers.validation_artifact_id`; measured retained rejected-take failure. |
| Fixture revalidation snapshot and result | 2 | Distinct stub interface objects bound to snapshot/package/candidate/expiry. |
| Total | **35** | Repeated references reuse the exact same row. |

Arithmetic: `5 + 5 + 12 + 1 + 1 + 1 + 1 + 1 + 1 + 2 + 2 + 1 + 2 = 35`. This is R2's thirty necessary objects plus five separate complete prompt manifests. No standalone generic evidence-provenance wrapper is retained. The frozen TTS mapping, configuration rows, claims/evidence/derivation rows, projection vectors, and arbitrary JSON members do not automatically become artifacts. Review reuses base artifacts; isolated alternatives are not additional base rows. Every registry row needs a resolvable consumer; no orphan padding.

### 14.2 Topological generation and blast radius

Generate evidence body hashes and independent match/window proof first; then derivation output, external support carriers, claim content, and reduced frozen states. Build the package with exact selected identities/support roles/rights/cursors. Next generate Brief, permitted writer view/exact serialized input/context, Pass 1, Craft Critic, craft revision, and final speech-texture script. Direction and audit precede Render Manifest. Resolve voices/pronunciations/intents/text/context before nine TTS base hashes, then freeze the ten request-response mappings and lawful reservation/event/take/selection lineage. Selected byte/settings recipe and exact master/frame map precede Assembly, READY, runtime Episode minting, and isolated review/revalidation/repair bindings.

Each model's completed input artifacts and owning source-policy hashes precede its purpose-specific request, complete-manifest artifact, and three-field semantic-input hash. The request manifest never references its output or own artifact hash. Derivation/support inputs never reference the downstream package. TTS mapping never enters its base preimage. READY never hashes subsequently minted Episode/version IDs. Generate the pack manifest last without hashing it back into selected policy/fixture source inputs.

I2 must reconstruct all governed hashes. Expect six evidence body corrections (four supporter, market, expanded lore) and ten unchanged body preimages; all nine claim/state hashes; null cursor bindings; derivation/support carriers; package/Brief; writer/context; all five request/complete-manifest/semantic-input identities; all three script/review/direction/audit/render dependencies; nine TTS base hashes/mappings; the frame map; and all six stage fingerprints. Twelve WAV byte hashes remain unchanged only under the exact frozen response mapping. Recipe identity may stay unchanged only if its exact selected byte/settings projection stays identical. Registry/member/ZIP/pack hashes change. Independent Unicode/model exclusion vectors remain unchanged where their actual projections do.

### 14.3 Future vectors and handoff obligations

I2 owns actual UUID allocation and generated fixture constants, reproducible member/ZIP generation, an independent validator, precise negative-vector selectors, and mechanical conformance alignment. Validate literal Foundation v4 PK/FK families, 51 distinct revision turns, zero base events/null cursors, sequence-ordered reduction/monotonic append, evidence equal-body/different-UUID rights, support roles/hash equality, five-match/lore/continuity proof, pronunciation structural and semantic compatibility, request-to-WAV mapping/ledger causality, exact decimal/frame timing, minted READY binding, and isolated plan/confirm/fork examples.

Reducer vectors must use `event_sequence` even at equal timestamps; permutation of JSON order or UUIDs never changes the selected reduction. Test two accepted events with the same claim, `occurred_at`, and `event_type` but distinct UUIDs/sequences, and reject a retried operation that would create a duplicate logical transition merely because a further sequence is available. Test zero/duplicate sequence, first sequence other than 1, an attempted earlier/gap insertion after a later append, wrong-claim/mismatched cursor, omitted prefix event, and post-freeze backdated append. Concurrency and retry enforcement need later isolated database/runtime proof.

Complete-manifest vectors independently rehash every included field, require five distinct unique FKs and typed three-field reconciliation, reject rights-bearing excerpts/hidden output provenance/missing retention, and prove that complete-manifest-only metadata changes leave §11 unchanged when its three fields stay identical. Keep original model sensitivity/exclusion and Unicode vectors. Unknown TTS identities fail; deliberately wrong selectors must fail at selector resolution before mutation. Recorded model judgements such as implied access remain recorded evaluations, never keyword CI substitutes.

Future Handoff/Trace v0.5.4 must repeat the eight-table 001+002 requirement, the exact legacy timestamp/type constraint drop, twelve protected tables, zero-event/null-cursor base, sequence-order/append and event-retry invariants, separate complete prompt artifacts and 35-row inventory, unchanged three-field model hash, deterministic TTS byte mapping, frame/duration rules, runtime READY minting, and isolated repair/revalidation limits. They must not claim that Foundation 001 alone can persist the successor fixture. Finish those files only after the fixture/conformance proof; activation then requires a coherent reviewed index/README/pack update. Actual Migration 002 and Completion A remain later work with fresh-database constraints/privileges/concurrency and runtime-replay tests. I1 proves none of those implementation gates.
