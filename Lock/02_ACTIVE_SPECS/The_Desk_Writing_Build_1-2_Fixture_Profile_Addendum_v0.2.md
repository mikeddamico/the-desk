# The Desk — Writing Spec v0.2.3: Build 1–2 Fixture-Profile Addendum v0.2

**Status:** INACTIVE SUCCESSOR DRAFT for FINAL LOCK v1.2.7; exact text pending ROOT/SAME review; not active merely by being drafted
**Date:** October 15, 2026
**Version id:** `writing-fixture-profile-addendum-0.2`
**Relationship:** An addendum to [Writing v0.2.3](../02_ACTIVE_SPECS/The_Desk_Writing_Spec_v0.2.3.md). Writing policy remains `writing-0.2.3`. This successor adds ONLY the exposure-safe fixed writer projection in §E–F. It creates no production or model-call contract. Mike approved the semantic direction at 2026-10-15T17:37:21-04:00; that approval does not ratify this exact text. Only later reviewed activation may select it.

**Legacy scope.** Sections A–D below carry predecessor v0.1 forward for legacy prediction/script and `writer-view/1` behavior. Those sections' field lists, meanings and historical bindings remain unchanged. Their references to the addendum/source file for legacy artifacts mean the frozen v0.1 file, not v0.2's bytes. Existing fifteen-key writer records are NOT migrated; existing model manifests keep their v0.1 source hash. Section E is an explicit separate `writer-view/2` profile for the fixed, unwired `writer-fixture-input/2` DATA boundary only. Neither profile may be inferred by key count alone.

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

## B. Legacy writer-view/1 nested members — what the writer may see

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

## C. Reporting a legacy stored shape the profile does not name

A stored writer view or script carrier with a nested key this addendum does not list, or without a key it does list, is not a conforming Build 1–2 fixture input (Hashing v0.1.5 §4.1.1 and §4.4.1 define the rejection codes). This addendum does not define the semantic-audit finding object (no Lock owner does; Hashing §4.6.1 rejects non-empty findings), the show-configuration schema (Layer B decision B6), or any general production profile for predictions or writer views.

## D. Legacy binding: where predecessor v0.1 governs an input

The addendum governs the **writer-view input shape** (section B) and the **script carriers** a writer role emits (section A). It is therefore bound — a policy inventory entry alone is insufficient — in these places:

1. **Writer context manifest.** `required_policy_refs` lists `writing-fixture-profile-addendum-0.1` immediately after `writing-0.2.3`, giving the order `writing-0.2.3`, `writing-fixture-profile-addendum-0.1`, `writing-craft-0.1`, `claims-0.1.2`. Writing owns required-ref ordering; this is that order.
2. **Complete prompt manifests (and their typed rows).** Every model role that receives the writer view or emits script carriers — `writer`, `craft_critic`, `writer_revision`, `speech_texture` — carries `component_versions.writing_fixture_profile_addendum = "writing-fixture-profile-addendum-0.1"` and `policy_source_hashes.writing_fixture_profile_addendum` = the raw SHA-256 of the frozen predecessor v0.1 file's exact bytes. The `showrunner_planner` manifest does **not** bind it: this addendum governs no planner input.
3. **Policy map.** The fixture policy map lists the addendum under `writing_fixture_profile_addendum` with its shipped path and source hash, so every binding above can be rehashed against shipped bytes.
4. **Scripts keep `writing_policy_version = writing-0.2.3`.** Script, review, direction, audit and stage-fingerprint projections are unchanged by this addendum (their key sets are closed in Hashing §4.1–§5); the addendum reaches them only through the complete prompt manifests and typed rows of the model runs that consume the writer view and emit the script outputs.

## E. Exposure-safe fixed writer projection — writer-view/2

### E.1 Authority, exact scope and narrow precedence

This section implements ONLY the approved owner103 semantic direction (24868 UTF8 bytes; SHA-256 `7802c6c6ba62439b662f38449fd9b6dd7e61fe00c0f00d7679ee7f390c9d410e`). It governs the proposed no-argument, synchronous, fixed `writer-fixture-input/2` DATA contract, once that contract and this owner text are independently accepted and activated. It is not a generic writer loader, producer role, model input execution permission, script output, persistence interface or complete production schema.

For THIS declared profile ONLY, E–F replace the predecessor's fifteen-key selected-claim list with E.2 and replace Writing v0.2.3 §5.1's `writer-view-v1` domain selection with `writer-view-v2`; Writing §6's context domain is `writer-context-manifest-v2`. Hashing v0.1.6 §4.4.3–4.4.4 define those exact projections. This narrow precedence does not alter Writing §5's cumulative exposure rules, its nineteen top-level keys, attribution, Claims/rights limits, script or gate projections, or ANY legacy v1 profile. The new status is not an exception authorizing original prose.

The fixed historical Evidence Package/Brief and underlying sources remain unchanged. Required selections follow Brief-owned order; no inferred reciprocal block-context rule is introduced. Empty per-block context arrays with applicable top-level context selections and the accepted 240-second target/330-second block-budget sum remain documentary fixture data, not a new policy error.

### E.2 Exactly sixteen selected-claim keys and honest value semantics

Each selected_claims[] item has EXACTLY:
`claim_id`, `claim_content_hash`, `frozen_state`, `frozen_state_hash`, `kind`, `subject_domain`, `subject_ref`, `predicate`, `value`, `value_type`, `origin`, `effective_usage_class`, `attribution_requirement`, `approved_representation`, `support_refs`, `value_status`.
Every key is required; no extra key, optional mask, hidden original, raw source tail or compatibility default is permitted. support_refs[] stays exactly `ref`, `role`, `type`.

`value_status` has exactly TWO primitive string values:
- `original`: value is the EXACT admitted immutable original claim value, with unchanged nested structure/types/strings. It is not rewritten, summarized or rehashed as a new claim.
- `withheld_original_text_value`: value is exactly JSON null as an explicit WITHHELD PROJECTION MARKER. It is NOT the original value, an unknown fact, original-null claim, tombstone, new claim or changed immutable claim. The whole original value is withheld; preserving just a safe-looking subfield is not this profile.

`value_type` ALWAYS identifies the ORIGINAL source claim's type. In the withheld branch, structured_text/analysis_text describe the source claim; neither asserts that null has that type. A consumer must dispatch on the explicit accepted profile and status before interpreting value. There is no generic nullable relaxation, v1 backport, automatic rehydration or indirect recovery of the withheld value from prose. This owner creates no consumer execution path.

The fixed claim order/statuses are exhaustive. Cn means UUID `d1250008-0000-4000-8000-` plus the printed twelve-digit suffix; it does not mean an evidence index:

| Order | Claim suffix | Source value_type | value_status | value |
|---|---|---|---|---|
|0|000000000001|scoreline|original|Exact original|
|1|000000000002|exact_decimal|original|Exact original|
|2|000000000007|count_window|original|Exact original|
|3|000000000003|structured_text|withheld_original_text_value|null|
|4|000000000004|analysis_text|withheld_original_text_value|null|
|5|000000000005|tenor|original|Exact original|
|6|000000000006|lore_phrase|original|Exact original|
|7|000000000009|program_history|original|Exact original|

The other SIX original values still require all existing grant/selection/meaning checks. This table is not an assertion that all structured metadata is universally harmless. C5 remains scoped tenor, C6 the permitted lore phrase, C7 the exact supported derivation, C9 the synthetic published/non-withdrawn continuity. No arbitrary caller masks or claim substitution.

claim_content_hash and frozen_state_hash remain identity REFERENCES to the ORIGINAL immutable claim content and original frozen reduced state, respectively. The projected sixteen-key record is NOT either hash's preimage. Source/evidence hashes remain references to original bytes. Never recompute claim-content/state hashes from null or paraphrase. Hashing v0.1.6 supplies a NEW whole-view projection identity; no extra assurance/identity key is added to the sixteen-key claim or nineteen-key writer object.

### E.3 Permitted wordings and cumulative exposure boundaries

The separate writer-specific representation registry binds exact original claim/evidence UUIDs, source content hashes, source identities, R005, writer consumer, package exposure, usage and these reviewed derivatives. It is not the planner registry relabelled. Full source/grant/meaning review remains required; hash agreement or whole-body inequality is not a paraphrase oracle.

C3 approved_representation is exactly:
“The North Coast Gazette reports that training included a 5-4-1 option for Northbridge to use when closing out a match.”
C4 approved_representation is exactly:
“One specialist analysis in the package suggests Southbank's focus on the flanks after half-time could have been an intentional answer to Northbridge's narrower midfield.”

Evidence `d1250007-0000-4000-8000-000000000003`, source `src_north_coast_gazette`, authorized_representation:
“Reporting by the North Coast Gazette describes Northbridge working in training on a 5-4-1 setup for late-match situations.”
Evidence `d1250007-0000-4000-8000-000000000004`, source `src_matchboard_analysis`, authorized_representation:
“Matchboard Analysis describes Southbank's focus on wide areas after the break as a possible intentional answer to Northbridge compressing midfield.”

Quotation marks above delimit the literal sentences; they are not part of the field value. Preserve required attribution/source_id/prefix, original support refs and C4 hedged_only. C3 remains reporting about training/rehearsal, not deployment/effectiveness; C4 remains a possible intentional response, not proved causation or firsthand reporting. No missing fact/value may be inferred from this wording.

R005 UUID `d1250006-0000-4000-8000-000000000005` remains fixture-paraphrase-v1: writer/planner paraphrase, auditor exact_excerpt; quotation_permission=false; paraphrase_permission=true; exact credits src_matchboard_analysis/src_north_coast_gazette; required spoken attribution; external_providers=false; fixture_stub restricted to rights-safe refs and permitted bounded consumer representations. Acquisition/retention/purge permissions remain unchanged. This addendum does not amend the grant, pack, original claim, package, Brief, old request/model/artifact or any historical identity.

Original C4 sentence (engineering-review NEGATIVE, not permitted writer content):
“Southbank's second-half wing focus may have been a deliberate response to Northbridge narrowing the midfield.”
It remains prohibited as original prose in EVERY writer-facing descendant, not merely value/approved_representation/authorized_representation. No relocation into contexts, comprehension, character/policy/budget/program metadata, locators, registry extras, debug/output envelopes, fragments reconstructed as the same sentence or gate inventories. The full C3 original value `{context:"closing shape rehearsed in training",formation:"5-4-1"}` is also withheld, not copied into a different field. The approved paraphrase's factual formation reference does not authorize exposing the original value object.

Materialization rights apply even to a no-output DATA interface. Approved wording does not exempt other original values, locators or nested metadata from substantive rights review. Retained offline source bytes, an archived completeness pass or an old writer_authorized label is not permission. The package remains the maximum factual universe, narrowed by the Brief. Preserve all forbidden/silent/exposure exclusions, no live search and no nonwriter exposure entries. Runtime current-rights/purge admission and authenticated freeze remain unproved.

### E.4 Closed writer and context objects

writer_data has EXACTLY nineteen keys:
`purpose`, `showrunner_brief_version_id`, `brief_hash`, `evidence_package_id`, `package_hash`, `show_version`, `writing_policy_version`, `writing_craft_policy_version`, `character_profile_versions`, `locale`, `runtime_and_block_budgets`, `program_block_refs`, `selected_claims`, `selected_evidence`, `context_selections`, `comprehension_targets`, `compact_writing_standard`, `recent_pattern_signals`, `live_search`.

selected_evidence[] stays exactly TWELVE keys:
`evidence_unit_id`, `content_hash`, `evidence_type`, `modality`, `origin`, `source_role`, `locator`, `authorized_representation`, `quote_permission`, `paraphrase_permission`, `rights_policy_version`, `consumer_exposure`.
consumer_exposure contains exactly writer. locator is the permitted opaque {ref,type}, never acquisition metadata. context_selections[] stays exactly FOUR keys: context_selection_id, context_id, function, program_block_id. support_refs[] stays exactly THREE keys as E.2.

The context manifest has EXACTLY ELEVEN keys:
required_component_refs, required_claim_refs, required_context_selection_refs, required_character_refs, required_policy_refs, required_comprehension_target_refs, serialized_input_hash, estimated_input_tokens, model_context_limit, reserved_output_tokens, completeness_check.

Arrays preserve the exact owning selection/order; no silent extra stripping or gate-only excluded-ID inventory in writer_data. All other nineteen-key members are hashed whole under their closed dependent grammar. The full recursive literal/grammar and independent new positive remain to be closed in the separately reviewed writer-fixture-input/2 contract; this text does not accept an arbitrary JSON tail or invented v2 literal.

compact_writing_standard MUST carry all TEN Craft0.1 §7.1 principles, in this order:
1. Write a conversation in which participants affect what comes next.
2. Prefer consequential insight over recitation.
3. Let evidence do argumentative work.
4. Make forward implication matter, but do not manufacture certainty.
5. Reinforce only the few ideas worth retaining, and reinforce by changing their conversational function.
6. Make comprehension design invisible.
7. Let personality create pleasure, not merely perform a functional role.
8. Allow restraint. Not every turn needs a joke, stat, argument, analogy, or conclusion.
9. End beats when their value is extracted.
10. Do not imitate prior surface forms merely because they worked.

The five-item historical fixture standard is a comparator, not the new complete standard. Ten-item correspondence is not semantic keyword/quality proof. Recent-pattern signals remain explicitly synthetic nonfactual fixture settings, not measured history.

### E.5 Budget/completeness and remaining authority

Independently resolve required components, claims, contexts, characters, policies and comprehension targets against the bounded permitted view/Brief/config. Recompute actual exclusion count, exact serialized input hash and completeness; never hard-code pass or place the context inside its own hashed input. The DATA-only component alias is `writer-fixture-input/2:writer_data`, not a claimed physical file/artifact. showrunner_brief.json resolves to the admitted fixed LOAD Brief, not an optional reread of a different source.

The dependent contract must bind its finite source inputs and explicit fixture counting recipe. If using the previously proposed byte-unit recipe, recompute ceil(exact NEW canonical writer UTF8 bytes/4) and check estimated+reserved<=limit inclusive from the new full permitted view. Old6200/200000/8000 settings and old11731->2933/10933 pins are not v2 expected values, tokenizer evidence, conservative hosted bounds or a rendered model request. No numerical v2 literal/hash is introduced here.

This addendum grants no provider/model/producer invocation, writer request, persistence, current rights, authenticated freeze, full-input adequacy, fourteen-gate/SCRIPTEDREADY/G3/G1-C/Build/listening/deploy/publication/merge permission. This addendum authorizes no new pipeline or model wiring and no changes to accepted PC1/PC2/LOAD algorithms, APIs or historical pins. It does not prohibit the separately accepted fixed writer contract from delegating once to each unchanged zero-argument PC2 and LOAD reader under a separate implementation commission. Such delegation confers no producer, model-execution or current-rights authority. Existing reader external-unzip/no-timeout/reopened-path/TOCTOU and selected-realm/native/fatal limitations survive. Normal accepted PC1/PC2/LOAD APIs and historical explicit owner/fixture pins remain unchanged.

## F. Binding the NEW profile without migrating legacy artifacts

F applies ONLY to writer-view/2 and writer-fixture-input/2. For legacy scripts/prompts/views, D continues to bind frozen Addendum0.1, not this file.

1. writer_data.writing_policy_version remains writing-0.2.3; Craft version remains writing-craft-0.1. Do not invent a Writing0.2.4 policy or add a twentieth writer field for the addendum.
2. Required_policy_refs is EXACTLY [writing-0.2.3, writing-fixture-profile-addendum-0.2, writing-craft-0.1, claims-0.1.2]. Order, identity and full actual source-byte binding are mandatory; an inventory entry alone is insufficient.
3. The separately closed v2 source-policy ledger must bind Writing0.2.3, this exact Addendum0.2, Craft0.1, Claims0.1.2 and the exact Hashing0.1.6 source at their shipped paths and measured raw SHA-256 bytes. Keep engineering/assurance source bindings OUTSIDE the nineteen writer keys. No invented source hashes or self-hash field in this owner file. Hashing/manifest source hashes are provenance, not rights authentication.
4. The original ZIP's config/policy_versions.json remains byte-identical and identifies its historical v1 policy sources. It is NOT a v2 policy map. Do not repin/rebuild frozen Fixture0.4.6 or old PC1/PC2/LOAD constants to make it appear current. The new separately reviewed contract must close its exact finite additional successor source bindings and read/capture behavior; this clause is not a generic loader or injected-reader API.
5. Raw exact canonical writer byte SHA, writer-view-v2 domain hash, writer-context-manifest-v2 domain hash and optional full DATA-envelope identity are distinct. Domain and context formulas are Hashing0.1.6 §4.4.3. No model request exists in this slice. Historical v1 helpers remain v1; no default helper dispatch to v2.
6. Any future actual model consumer needs its own separate commission and complete request/retention/typed provenance review under unchanged owners; this draft creates none. If a separately ratified future model path consumes v2, its component_versions.writing_fixture_profile_addendum and policy_source_hashes.writing_fixture_profile_addendum must bind 0.2 and these exact source bytes. Historical prompt manifests/typed rows remain 0.1 unchanged; planner manifests acquire no writer addendum by this owner activation.
7. Exact-text ROOT/SAME review and later coherent Lock activation are required before this successor is selected. Mike's approved semantic direction is not ratification of unwritten contract/literals or implementation.
