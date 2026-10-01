# The Desk — Writing Spec v0.2.3: Build 1–2 Fixture-Profile Addendum v0.1

**Status:** INACTIVE SUCCESSOR — proposed for a later FINAL LOCK v1.2.6; not ratified; not selected by any active manifest
**Date:** October 1, 2026
**Version id:** `writing-fixture-profile-addendum-0.1`
**Relationship:** An addendum to [Writing v0.2.3](../02_ACTIVE_SPECS/The_Desk_Writing_Spec_v0.2.3.md). It does **not** supersede Writing v0.2.3 and does **not** change `writing_policy_version` (`writing-0.2.3`), which remains the policy id carried by scripts, the writer view, and the semantic-audit and stage projections. It is a separately versioned policy source that the artifacts it governs bind explicitly (section D). It applies only to the bounded synthetic fixture profile that Writing §5.1 already names; it is not a production contract.

## A. Script `prediction_candidates[]` — Build 1–2 prediction wording candidate

Writing v0.2.3 §2 lists "prediction wording where the Showrunner Brief calls for predictions" as a Writing output, §16 says the Brief determines whether and where predictions occur, and §7 shows `prediction_candidates[]` in the script without an item shape. §16's seven-field `prediction_candidate` applies "where a prediction is machine-settleable". This addendum defines the item shape for the other case: a **prediction wording candidate** — the writer's spoken prediction, located in the script, with no settlement semantics. It creates **no editorial standard for predictions**: how a prediction is formed, calibrated or phrased stays in §16 and the Claims Policy.

A wording candidate is a closed object with exactly these fields:

| Field | Meaning | Existing owner basis |
| --- | --- | --- |
| `prediction_candidate_id` | Artifact-local label of this candidate; stable across script revisions; not a storage id. | Local-anchor idiom of §7 (`semantic_turn_id`). |
| `turn_id` | The storage `turn_id` of the turn **in this same script** whose spoken words carry the prediction. | §2 "writer-side annotations that bind spoken spans to … program blocks"; §7 turns. |
| `participant_id` | The speaker; must equal that turn's participant. | §16 "the writer may create the spoken prediction in character". |
| `prediction_text` | The predicted wording as spoken (NFC). | §2 "prediction wording"; Showrunner §17 "the exact prediction and wording are Writing outputs". |
| `horizon` | Opaque governed string naming how far ahead the prediction looks (fixture value `next_relevant_event`). Its vocabulary is **not defined** by Writing or Showrunner (the Brief's `forward_horizon` is a different, closing-synthesis field); it is an opaque string here. | none (opaque). |
| `topic_thread_id` | A topic thread present in the bound Brief's `topic_thread_mappings`. | Showrunner Brief schema `topic_thread_mappings[]`. |

Constraints: the turn must sit in a Brief program block whose `block_type` is `predictions` (§16: the Brief determines where predictions occur); `prediction_candidate_id` is unique in the script; array order is authored order and is semantic. A stored candidate carries `turn_id`, never `semantic_turn_id` (the anchor is derived from the turn row by the hashing profile), `script_version_id`, any §16 settlement field, or any other key. A settleable prediction continues to use §16 and is **outside** this profile; it needs its own versioned profile before it can appear in a script.

## B. Writer view nested members — what the writer may see

Writing §5.1 fixes the nineteen top-level keys and says nested structures carry only permitted content and metadata defined above and by the bound package/Brief, with extra raw row fields never silently serialized. This section names the nested keys. Writer-facing exposure follows §5: the writer sees only the representation permitted by the package exposure policy, and retention in the evidence layer never implies exposure to the writer.

**`selected_claims[]`** — exactly: `claim_id`, `claim_content_hash`, `frozen_state`, `frozen_state_hash`, `kind`, `subject_domain`, `subject_ref`, `predicate`, `value`, `value_type`, `origin`, `effective_usage_class`, `attribution_requirement`, `approved_representation`, `support_refs`; `support_refs[]` items exactly `ref`, `role`, `type`.

| Key(s) | Basis |
| --- | --- |
| `claim_id`, `claim_content_hash`, `frozen_state`, `kind`, `subject_domain`, `effective_usage_class`, `approved_representation`, `support_refs` | Listed verbatim in Writing §5 ("for each claim made available to writing"). |
| `attribution_requirement` | §5 "required attribution, if any"; Claims Policy (`attribution_requirement.required`). |
| `frozen_state_hash` | Needed to emit a claim use: a use item selects the package's exact frozen-state hash (Hashing §4.1 `claim_state_hash`; Writing §7 uses). |
| `value`, `value_type` | §5 "enough machine-readable metadata to use [the claim] correctly"; Writing §24.1 compares a spoken numeric span with the claim's structured `value`/`value_type`. |
| `predicate`, `subject_ref`, `origin` | Claim content fields defined by the Claims Policy and carried by the package (Evidence Package §9). Writing §5 supports them only through the same "enough machine-readable metadata" clause; **this addendum is the explicit grant.** |

**`selected_evidence[]`** — exactly: `evidence_unit_id`, `content_hash`, `evidence_type`, `modality`, `origin`, `source_role`, `locator`, `authorized_representation`, `quote_permission`, `paraphrase_permission`, `rights_policy_version`, `consumer_exposure`, with `consumer_exposure` containing exactly one entry, `writer`.

| Key(s) | Basis |
| --- | --- |
| `evidence_unit_id`, `content_hash` | Refs/hashes preserved by view carriers (Writing §5.1); Evidence Package §10 snapshot. |
| `evidence_type`, `modality`, `source_role` | Evidence Package §10 snapshot ("source_role / evidence_type / modality"). |
| `locator` | Evidence Package §10 snapshot lists `locator`. In the writer view it is the writer-safe opaque reference (`{ref,type}`), **not** the package's acquisition locator (the fixture's two differ). |
| `rights_policy_version` | Evidence Package §10; needed to emit an evidence use (Hashing §4.1 `rights_policy_version`). |
| `quote_permission`, `paraphrase_permission` | Evidence Package §10; Writing §5.1 "permissions". |
| `authorized_representation` | Writing §5 "the writer sees only the representation permitted by the package exposure policy"; §5.1 "authorized derivative representations". |
| `origin` | Package-carried source-kind vocabulary used for attribution (§5 "relevant source identity for attribution"); not in the Evidence Package §10 list — **explicit grant here.** |
| `consumer_exposure` | Evidence Package §10 "consumer exposure instructions" is package-owned; Writing §5 limits the writer to what is permitted for it. **Only the writer's own entry is serialized**; the planner and auditor entries are not writer-facing (the auditor may receive broader exposure, Evidence Package §10.2, which is not a writer concern). |

**Not serialized to the writer:** the package's `retention_class` (a retention snapshot field with no writer function; Writing §5: "Retention in the evidence layer never implies exposure to the writer"), and the non-writer entries of `consumer_exposure`. Fixture v0.4.5 serialized both; this corrects a fixture authoring excess against existing §5 text and is not a policy change.

**`context_selections[]`** — exactly: `context_selection_id`, `context_id`, `function`, `program_block_id`. Basis: Writing §5 "selected context per block"; Showrunner Brief `context_selections`.

All other members of the nineteen-key object are hashed whole.

## C. Reporting a stored shape the profile does not name

A stored writer view or script carrier with a nested key this addendum does not list, or without a key it does list, is not a conforming Build 1–2 fixture input (Hashing v0.1.5 §4.1.1 and §4.4.1 define the rejection codes). This addendum does not define the semantic-audit finding object (no Lock owner does; Hashing §4.6.1 rejects non-empty findings), the show-configuration schema (Layer B decision B6), or any general production profile for predictions or writer views.

## D. Binding: where this addendum governs an input

The addendum governs the **writer-view input shape** (section B) and the **script carriers** a writer role emits (section A). It is therefore bound — a policy inventory entry alone is insufficient — in these places:

1. **Writer context manifest.** `required_policy_refs` lists `writing-fixture-profile-addendum-0.1` immediately after `writing-0.2.3`, giving the order `writing-0.2.3`, `writing-fixture-profile-addendum-0.1`, `writing-craft-0.1`, `claims-0.1.2`. Writing owns required-ref ordering; this is that order.
2. **Complete prompt manifests (and their typed rows).** Every model role that receives the writer view or emits script carriers — `writer`, `craft_critic`, `writer_revision`, `speech_texture` — carries `component_versions.writing_fixture_profile_addendum = "writing-fixture-profile-addendum-0.1"` and `policy_source_hashes.writing_fixture_profile_addendum` = the raw SHA-256 of this file's exact bytes. The `showrunner_planner` manifest does **not** bind it: this addendum governs no planner input.
3. **Policy map.** The fixture policy map lists the addendum under `writing_fixture_profile_addendum` with its shipped path and source hash, so every binding above can be rehashed against shipped bytes.
4. **Scripts keep `writing_policy_version = writing-0.2.3`.** Script, review, direction, audit and stage-fingerprint projections are unchanged by this addendum (their key sets are closed in Hashing §4.1–§5); the addendum reaches them only through the complete prompt manifests and typed rows of the model runs that consume the writer view and emit the script outputs.
