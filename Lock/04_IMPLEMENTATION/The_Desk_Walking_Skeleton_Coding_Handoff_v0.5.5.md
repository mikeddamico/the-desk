# The Desk - Walking Skeleton Coding Handoff v0.5.5

**Status:** INACTIVE SUCCESSOR - proposed for FINAL LOCK v1.2.6; not ratified; not selected by any active manifest
**Date:** October 1, 2026
**Scope:** Build 1 + Build 2 only
**Supersedes on activation:** v0.5.4 (retained as history)

## Objective

Build the smallest coherent TypeScript/Node system that proves the accepted artifact path from a frozen Evidence Package through a validated clean master, production-path READY review/repair semantics, and stored inspectable lineage. Paid provider credentials are optional because Fixture v0.4.6 includes deterministic fixture TTS for the conformance path.

Do not implement ingest, coverage commissioning automation, publication/RSS, monetization, dashboards, autonomous editorial review, or generalized multi-sport production.

The walking skeleton is evidence that the contracts can work together. It is not permission to invent future architecture.

## Required active specs

Read `00_INDEX/ACTIVE_SPECS_LOCKED_v1.2.5.md` first.

Implementation must use:

- Technical Architecture v1.0
- ADR-001 Coverage Commissioning
- ADR-002 Application Runtime
- ADR-003 Autonomous Operation, Pre-Publish Review, and Operator Repair
- ADR-003A Build 1–2 READY and Repair-Attempt Semantics
- Operator Repair v0.1.1
- Claims Policy v0.1.2
- Evidence Package v0.2.2
- Showrunner Planning v0.1.3
- Writing Craft and Invisible Comprehension v0.1
- Writing Spec v0.2.3
- Performance & Render v0.1.4
- Character Bible v0.1.4
- Engineering Standards & Security v0.1.3-skeleton
- Hashing, Fingerprints & Text Spans v0.1.4 (base contract; see the v1.2.5 activation record)
- Walking-Skeleton Contract Trace v0.5.4
- Frozen Walking-Skeleton Fixture v0.4.5

The superseded Script Spec v0.1 and Episode Input Package v0.1 are not implementation sources. The Render Test Kit is an experimental fixture only.

If this handoff conflicts with an active spec, the active spec wins and the conflict must be surfaced.

## Runtime decision

ADR-002 is settled:

```text
TypeScript
Node.js 24 LTS
TypeScript strict mode
```

Do not reopen the runtime during Build 1.

The coding-agent dry run may propose the package manager, schema-validation library, Postgres/query/migration tooling, test framework, workflow mechanism/vendor, logging library, and deployment shape. Each structural/dependency choice must be justified against the existing requirements.

## Structural-change rule

Before adding any dependency, service, table, queue, cache, configuration system, framework, or abstraction, state:

1. the concrete requirement;
2. why the current mechanism cannot satisfy it;
3. the smallest proposed addition;
4. migration/rollback implications.

Do not proceed silently.

## v1.2.5 activation record (history; FINAL LOCK v1.2.5 stays active until a later activation)

Activation of FINAL LOCK v1.2.5 selects Claims Policy v0.1.2, Evidence Package v0.2.2, Writing Spec v0.2.3, Performance & Render v0.1.4, Hashing, Fingerprints & Text Spans v0.1.4, Frozen Walking-Skeleton Fixture v0.4.5 (ZIP SHA-256 `c6ae9791843463ef3994b1de04f4f129517a3097aeb26ce046f58941d1d1d240`), this handoff and Contract Trace v0.5.4. It is a Lock-activation change only. It contains no Migration 002, SQL, loader, runtime, test, provider or product-implementation change, and no Build 1 or Build 2 scope broadens.

Pre-activation status notices. Each proposed successor file of this tranche (Hashing v0.1.5, the Writing Build 1-2 Fixture-Profile Addendum v0.1, Contract Trace v0.5.5, Coding Handoff v0.5.5, Implementation Readiness Closure v1.2.6) carries a header that says "INACTIVE SUCCESSOR" and that it is proposed for a later FINAL LOCK v1.2.6; that wording records its pre-activation authorship state and is superseded by an activation manifest that selects it unchanged. Claims Policy v0.1.2, Evidence Package v0.2.2, Writing Spec v0.2.3 and Performance & Render v0.1.4 are not part of this change: they stay byte-identical to the bytes bound by Fixtures v0.4.5 and v0.4.6, and their policy source hashes are unchanged. FINAL LOCK v1.2.5 remains the active selection until a later activation.

### Hashing base contract versus bounded fixture decisions

### Layer A - base implementation contract

Hashing, Fingerprints & Text Spans v0.1.5 (SHA-256 `a78ac9478b8ee9a55caae21ba07fd1106e110ba6cd30de807181cd4a15a10e89`; v0.1.4, SHA-256 `73cfc4727ce375df0a402c38b9a9044ceb6a1015ce0bcbeaf97433f6986f6d60`, remains the Layer A contract of FINAL LOCK v1.2.5 until a Lock selecting v0.1.5 is activated) is the base implementation contract. It owns the canonical serializer (§1) and the declared-profile conventions (§1.1), the six stage-fingerprint domains, the nested base-request projection and pronunciation grouping (§7.1), the complete prompt-manifest artifact and addendum binding (§12.5, §4.4.2), the persistence profile (§13), the base artifact registry (§14.1, exactly 35 base artifacts) and the mandatory conformance additions (§10.1). Its prediction-candidate and writer-view profiles take their field lists from the Writing Build 1-2 Fixture-Profile Addendum v0.1 (SHA-256 `79ea43076b0b5ca68916f8e12ac3457e48c6ad31a9bf5f1c47034fcb1de7f55f`; version id `writing-fixture-profile-addendum-0.1`, pinned beside the unchanged Writing Spec v0.2.3 / `writing-0.2.3`), and its show-configuration profile takes its schema from Layer B item 6 below. It does **not** define the other Layer B items below, and nothing in this document implies that it does.

### Layer B - later accepted bounded additive fixture decisions

Source: the accepted I2B technical adjudication and the frozen technical-resolution records shipped inside Fixture v0.4.5 (`provenance/frozen/i2b_v2/technical_resolution_record_v1.md`, SHA-256 `3f8a760aa106e238d262132ab396cc3a99f71c72768a2f6a72b14c65bd7f78c3`; `provenance/frozen/technical_resolution_record_v2.md`, SHA-256 `7a682cc5e17eda228e8711f10fb6214723550d3516cddebc995753e8a520de9c`; version 2 inherits version 1 sections 2.1-2.5 unchanged and records the CONFIG-330 corrected successor). Items 1-5 are additive decisions that apply to the content of Fixture v0.4.5 and are carried byte-for-byte into Fixture v0.4.6; items 6-9 are added for Fixture v0.4.6. All are fixture-specific, are not Hashing text, and are not product-wide policy.

1. **`evidence-package-scope-v1`.** Projection = exactly the eight `manifest.scope` fields, values and array order preserved: `competition_ids`, `entity_ids`, `event_ids` (ordered arrays of nonblank strings); `locale`, `scheduled_default_mode`, `target_publication_slot_ref` (nonblank strings); `scope_type` (literal `event`); `show_id` (governed UUID resolving to the bound show). Any other scope type or unrecognized field is rejected. `scope_hash = lower_hex(SHA256(UTF8("evidence-package-scope-v1\n") || canonical_json_bytes(scope_projection)))` using the Hashing v0.1.4 §1 canonical serializer, exactly one LF after the domain, no BOM, no trailing LF, no wrapper. The package hash keeps selecting `manifest` and excludes this envelope digest. Fixture value `ecb1eb2b675a9e383dfe88e6311f8cc88cc97eb17183df9a8cae935d8d1f8979`; captured bytes `provenance/captured/scope_projection.bytes` (SHA-256 `eee3d6c86f3f6a7afb75dcda3faf89fde158a3a560de70b97379385061cdd49e`).
2. **`render-context-v1` and the exact bounded C2 fixture application.** `rb01` stays `C0-v1` with no context, `{"recipe_version":"C0-v1","turns":[]}`, and receives a computed non-null digest. `rb02`-`rb09` are `C2-v1`: the render block begins at the first approved turn of its program block and uses exactly one context turn, the final approved turn of the immediately preceding program block (the within-block C1 component is empty). The recipe is rejected if the block begins elsewhere, the preceding block is not adjacent in the frozen Brief order, or the context turn is not that block's final approved turn; it is not extended to split-block cases. `context_hash = lower_hex(SHA256(UTF8("render-context-v1\n") || canonical_json_bytes({"recipe_version": ..., "turns": [{"semantic_turn_id", "participant_id", "spoken_text"}, ...]})))`; storage UUIDs, sequence, program-block storage refs, script/manifest hashes and the digest itself are excluded. TTS base hashes bound context content directly, not this digest. C2 boundary table (render block: context anchor -> block-start anchor): rb02 t02->t03; rb03 t03->t04; rb04 t05->t06; rb05 t08->t09; rb06 t09->t10; rb07 t13->t14; rb08 t14->t15; rb09 t16->t17. Captured projections: `provenance/captured/render_context_projections.json` (SHA-256 `4e9629ffe3ee02abf69390090ee2907ab2ca0e048ee68fe97bedbefc7109019e`).
3. **`performance-direction-correction-input-v1`.** `input_fingerprint = lower_hex(SHA256(UTF8("performance-direction-correction-input-v1\n") || canonical_json_bytes(P)))`; P has exactly five top-level keys: `source_direction_hash`, `script_hash`, `direction_spec_version` (`performance-render-0.1.4`), `adjudication_record_sha256` (raw-byte SHA-256 of the frozen record file) and `correction` = `{source_performance_intent_id, source_scope_ref, intent_type: "pace", expected_value: "measured", replacement_value: "slower"}`. In Fixture v0.4.5: `source_direction_hash` `ea5926e81267dd749cf33ed29564fe88815d3243b68260f1b4ddb96588e2f533`; `script_hash` `883cbe121635364f72072b29264f00af9b79eb32fd7ebd3d7e8462f829f50677`; `adjudication_record_sha256` `7a682cc5e17eda228e8711f10fb6214723550d3516cddebc995753e8a520de9c` (version 2 record); `source_scope_ref` is the successor turn UUID of final-script anchor t14. Result `f2fdd19480a00686f0efed0f201918d628a59876cc65f572203adaae6b344d65`; frozen projection `provenance/frozen/correction_input_projection.json` (SHA-256 `de9b289aca46324c1b475b0da1ab734e79beb886d7d817b70b8c0ecaf29fb2a5`; the version 1 projection `provenance/frozen/i2b_v2/correction_input_projection_v1.json`, SHA-256 `2aaa8a5f2e0c6b56dcafff436051af9411c66bae69fb3744bb0ecba29808af5a`, is history). Direction content hashing excludes the producer fingerprint. Only the pace intent value changes (`measured` -> `slower`); `slower` is a selected delivery correction, not a synonym declaration. The corrected direction is a new immutable version superseding the historical source through the existing `artifacts.supersedes_artifact_id`; original source rows are never reparented or mutated.
4. **Historical-null disposition.** JSON null is authorized only for the preserved historical direction envelope and its artifact-payload copy, disposition `historical_producer_inputs_not_recorded`: one nested field, two storage copies, outside the 176 typed placeholders, never a computed hash and never a substitute hash. The corrected direction's `input_fingerprint` is non-null.
5. **Artifact accounting.** The Fixture v0.4.5 load contains **36 artifact rows = 35 current conforming artifact rows + 1 retained historical artifact row** (historical direction artifact `d1250005-0000-4000-8000-000000000012`, loaded only as the `supersedes_artifact_id` target and as history). The Hashing v0.1.4 §14.1 base registry remains exactly 35; the 36th row is the Layer B retained historical object, not a registry change.
6. **`show-config/1` bounded synthetic fixture profile (hashing: `show-config-v1`).** No Lock owner defines a general show-configuration schema, so this decision is **fixture-scoped**: it is not a product configuration contract, and production configuration hashing stays blocked (an unsupported `schema_version` is rejected) until an owner defines another schema and a new domain version. The profile has exactly fourteen payload keys `autonomous_operation_policy_version`, `configured_runtime_seconds`, `default_episode_mode`, `default_output_language`, `default_rundown_template_version_id`, `name`, `operator_repair_policy_version`, `pre_publish_review_policy`, `pre_publish_review_required`, `pre_publish_review_timeout_seconds`, `publication_enabled`, `show_id`, `show_version`, `writing_craft_policy_version` (`configured_runtime_seconds` has exactly `fixture_override`, `max`, `min`); `show-config-v1` hashes the complete closed payload; row columns, `config_hash`, and the redundant `pre_publish_review_required` column are excluded; an unknown or missing key is rejected. Every key is hashed because the payload is a closed synthetic object authored by the fixture, no owner declares any key display-only, and excluding a key would be an unowned editorial decision with hash consequences. Per-field basis:

   | Key | Basis in the Lock |
   | --- | --- |
   | `show_id` | Foundation 001 `show_config_versions.show_id`; a configuration is of a particular show (the payload value must equal the column). |
   | `show_version` | Consumed as `show_version` by the Brief (Showrunner §6.1) and the writer view (Writing §5 "show / format version"). |
   | `name` | No Lock owner consumes it; it mirrors `shows.title`. Hashed only by the fixture-profile completeness rule (decision D4). A production schema may treat it as display-only; that is an open owner question. |
   | `default_output_language` | Architecture ("Durable episode identity"): `shows.default_output_language` is a default; feeds writer-view `locale`. |
   | `default_episode_mode`, `default_rundown_template_version_id` | Concepts named by Showrunner (Brief `selected_mode`, `rundown_template_version_id`); the key names and default semantics are not defined in the Lock. |
   | `configured_runtime_seconds.{min,max}` | The fixture-only runtime band of Contract Trace §10 (version 2 changes only `max`, 300 to 330). |
   | `configured_runtime_seconds.fixture_override` | The only Lock definition is Contract Trace §10: the band is an evaluation-fixture value, not product runtime policy. The flag is hashed because it is the payload's declaration of that status; it has no production meaning. |
   | `pre_publish_review_policy`, `pre_publish_review_required`, `pre_publish_review_timeout_seconds` | ADR-003 §1 (policy `required` at launch; review waits bounded by freshness, expiry halts); Engineering Standards v0.1.3 ("Build 1-2 autonomous-operation and repair socket"). The timeout key name is not defined in the Lock. |
   | `publication_enabled` | ADR-003A §2 / Contract Trace §1.1: production-purpose fixture run with `publication_enabled = false`. |
   | `autonomous_operation_policy_version`, `operator_repair_policy_version`, `writing_craft_policy_version` | Governing policy version pins (ADR-003A, Operator Repair v0.1.1, Writing §5); key names for the first two are not defined in the Lock. |

   The fixture's runtime values (a 240-second `runtime_target`, a 330-second maximum band marked `fixture_override`) are evaluation-fixture values and remain distinct from the launch product templates (quiet 8 / standard 10 / big 12 minutes).
7. **`mechanical_sensitivity` labelling.** Vectors in `base_request_hash_conformance.json` that isolate one field and are rejected by the fixture-scoped ownership check are evidence only for the mechanical projection function. In Fixture v0.4.6, 23 of the 93 hash-bearing vectors are such (including SN015, ownership code `participant_not_from_bound_script`, and SN049, `pronunciation_span_mismatch`); each is labelled `mechanical_sensitivity`, names the ownership code, and is paired with a rejection vector for that code. `OW027` is added because v0.4.5 had no rejection vector for `context_text_not_from_bound_script`. Counting convention: the nine actual block baselines; the 93 hash-bearing vectors; the 27 ownership-rejection vectors (26 + `OW027`) and the 12 closed-mapping vectors are separate sets; the last three together with the hash-bearing set make the 132-vector suite (131 in v0.4.5).
8. **Configuration identities (a fact of this fixture, not a rule).** In Fixture v0.4.5 and v0.4.6 the Render Manifest's `show_render_config_version` is `postmatch-fixture-v4`, which equals the `show_version` of both configuration payloads and of the Brief and writer view. No Lock text derives the Render Manifest field from the configuration, requires that equality, or binds the Render Manifest to `show_config_version_hash`; the READY candidate binds the content hash (version 2). The label does not distinguish configuration versions 1 and 2, which share it. Whether Performance & Render should derive or bind the field is for that owner and is not decided here.
9. **Fixture v0.4.6 regeneration (decisions D1 and D2).** The writer view no longer carries evidence `retention_class` or the planner/auditor entries of `consumer_exposure` (Writing Build 1-2 Fixture-Profile Addendum §B); the addendum is bound in the writer context manifest's `required_policy_refs` and in the complete prompt manifests and typed rows of the four roles that receive the writer view. The changed identities are exactly: the writer view, the writer context manifest (and the raw `serialized_input_hash`), prompt manifests 2-5 (complete-payload hash, rendered request bytes, `rendered_request_hash`, typed three-field semantic-input hash) and the four `provider_calls` request fingerprints/keys that embed those request hashes. Script, craft-review, direction, audit, render-manifest, assembly, READY and revalidation identities, the six stage fingerprints, both show configurations, the nine base-request hashes and all twelve WAV byte hashes were recomputed under both profiles and are unchanged (`provenance/v0.4.6/IDENTITY_TRANSITION.json`, validator groups G35-G36). Fixture v0.4.6 ZIP SHA-256 `7e1bb1108cdd84e47269b9ab2dab20ba934fcec64d44262f86d2b505616b0747`; `PACK_MEMBERS.json` SHA-256 `58a3c5e6188a91eba380c4cb4c08fbebb747513b5979ca9b3b0baab61d5b84fe`.

### Fixture v0.4.5 load profile

The one active load is `foundation_rows_398.json`: 398 rows in 40 families = 123 retained source rows + 275 fresh rows (274 replacements + 1 new show-configuration version). It contains 36 artifact rows (35 current + 1 retained historical). Archived rows (the original 396-row source, the 283 accepted I2B v2 rows replaced or archived, the 85 archive-only and 10 historical-direction rows) are never co-loaded. Every primary key is its literal Foundation UUID; the correspondence tables are frozen evidence, not runtime alias resolvers. A loader must consume explicit provenance and must not fabricate missing model provenance. The full accepted constants are in Contract Trace v0.5.4 §8.

Fixture-only runtime band. Fixture v0.4.5 appended show-configuration version 2 (carried unchanged into v0.4.6) (parent = version 1) that changes only `configured_runtime_seconds.max` from 300 to 330 (hash `d1f022782d543d1b8d9a7fd3d56895b57ca1f2b8381457d84261508e75b36719`; version 1, history, `1d4e82bdc40571351f582aa0173ff55cf040f48bef7028fde958bd7b595c5683`). This is an evaluation-fixture value required because the nine authored block budgets sum to 330 seconds. It is not product runtime policy: the launch product templates remain quiet 8 / standard 10 / big 12 minutes, and the fixture `runtime_target` of 240 seconds (`evaluation_fixture`) is likewise an evaluation-fixture value only; no equality between block budgets and the target is required and neither value becomes product policy.

Foundation 001 + Migration 002 profile. Migration 002 (merged at the v1.2.5 baseline `e8a45524fc35e266d997a1eb72be05aa0a13de95`) changes **exactly eight existing tables**: `claims`, `claim_state_events`, `evidence_units`, `claim_supports`, `derivation_runs`, `pronunciations`, `pronunciation_renderings`, `prompt_manifests`, as bounded by Hashing v0.1.4 §13 and the owning successor specifications. It adds no other table, column, default, backfill, service or capability. Foundation 001 alone cannot persist the successor fixture. The obligations carried forward unchanged from Hashing v0.1.4 §§13-14: the exact legacy constraint drop (`claim_state_events_claim_id_occurred_at_event_type_key`) with no timestamp-based replacement; the twelve protected tables locked ACCESS EXCLUSIVE in the fixed order and required empty (`claim_state_events`, `claim_supports`, `claims`, `derivation_runs`, `evidence_packages`, `evidence_units`, `prompt_manifests`, `pronunciation_renderings`, `pronunciations`, `render_manifests`, `turn_claim_uses`, `turn_evidence_uses`); the zero-event / null-cursor base; sequence-ordered reduction with monotonic append (Migration 002's append-order and `READ COMMITTED` isolation guard); durable event identity and operation/retry convergence, which Migration 002 does **not** prove and which remains unresolved (work item A5); separate complete prompt-manifest artifacts and the 35-row base inventory; the unchanged three-field `model-semantic-input-v1`; the deterministic TTS byte mapping; frame/duration rules; runtime READY minting; and the isolated repair/revalidation limits.

Completion A / Completion B (product-sequence labels). The labels originate in the Product Thesis, which is sequencing and product context and not technical authority. Their technical substance is carried by the Lock: the runtime persistence, retry and concurrency work (Done-when items 6, 9 and 10 of this handoff, with Hashing v0.1.5 §13; Migration 002's append-order guard is merged, but durable event identity and operation/retry convergence, A5, remains unresolved) is the not-yet-implemented work labelled Completion A; the staging and error-tracking proof is the locked Build 1 requirement in Technical Architecture v1.0 ("staging deploys; correlation IDs reach error tracking") and Done-when items 12 and 13 of this handoff, labelled Completion B. Completion A precedes Completion B. This successor does not begin Completion A or Completion B.

Feed/media boundaries restated from Technical Architecture v1.0 only (no new requirement): the canonical episode owns the RSS GUID and episode, episode-version, distribution-variant and audio identities are as defined in Architecture §7; public feeds are pre-rendered from object storage/CDN and are not generated by querying Postgres on each poll; authenticated RSS is deferred access control, not personalized programming (the Architecture `feed_tokens` data-model row is not built in Builds 1-2); publication/RSS is outside Build 1-2 scope (Architecture Build 8). Nothing here adds an identity, table, column, default, backfill, service or capability, and no feed, account, subscription, entitlement, credential or protected-media contract is activated.

## History: v1.2.4 executable-contract hotfix (superseded baseline - predecessor values, not current)

Triggered by the read-only Completion A persistence design pass, this bounded hotfix repairs fixture run/attempt, render-block, take, selection, and audio/artifact identities to authoritative Foundation UUIDs, completes explicit deterministic `fixture_stub` model provenance, and closes the previously unspecified `model_runs.semantic_input_hash` projection/domain via Hashing v0.1.3.

Foundation UUID primary keys remain the durable persisted identities; no canonical-identity columns or permanent alias system are introduced. Each of the five intended typed model executions has a purpose-specific prompt manifest, explicit component versions and policy source hashes, rendered-request and semantic-input hashes, a synthetic provider-call reservation, one succeeded terminal event, zero actual USD cost, fixture model identity, and an output-artifact binding. No external provider was contacted or paid. `provider_calls` remains the authoritative side-effect/try ledger; production provider-accounting semantics are unchanged.

There is no database/schema, migration, lifecycle, product-intent, dependency, or product-implementation change. No unrelated semantic projection changes. Build 1 and Build 2 scope does not broaden; this hotfix does not begin Build 1 Completion A. Technical Architecture v1.0 and accepted ADRs remain unchanged. The Product Thesis remains working product context, outside locked implementation authority.

Predecessor Fixture v0.4.4 baseline values, recorded as history only and replaced by Fixture v0.4.5 (see the v1.2.5 activation record and Contract Trace v0.5.4) and then by v0.4.6 for the writer chain: the completed persistence-compatible identity repair changed Assembly from `dd20eb19b78bea075369ebc04db438928ab272986bd3d062904604b069a84518` to `075453adc3daaee4fc458f51b005d9a70323341fbf2c5393730c3f8017dcc5cf` and READY from the pre-second-repair `76e7e59ba2d6c21ed152afdc9b8781151fa9caadffa9dc9471ae2caf57bd06c6` to `5ca32745069787bec224344fc7207239f332bf8e388b60a8da388f916958194e`. Claims/Writing, Performance, Semantic Audit, and Render remain unchanged. Governed upstream semantic artifact identities are unchanged. The five model semantic-input hashes are additive provenance identities.

Locked implementation consequences (carried forward unchanged under v1.2.5):

- evaluation attempts remain barred from READY; the READY drill uses a separate production-purpose, publication-disabled fixture run;
- deterministic fixture TTS may materialize test audio so CI can reach a validated master and READY without paid credentials;
- confirmed READY repair forks a child attempt and never moves the parent backward;
- fixture performance-repair and programming-repair examples are alternative reset scenarios from the same immutable READY seed; they are never inserted together as two terminal review decisions in one history, and each plan is confirmed before child-attempt execution;
- one authoritative `provider_calls` ledger owns provider side effects, tries/retries, usage, and cost;
- the minimum relational knowledge spine includes `evidence_units`, `claims`, `claim_state_events`, `claim_supports`, and `derivation_runs`, without implementing ingest;
- stage-specific fingerprints and Unicode code-point spans follow Hashing, Fingerprints & Text Spans v0.1.4;
- required-attribution claims are attributed on every spoken use in Builds 1–2;
- Craft Critic and Performance Director do not receive broader sports-evidence exposure than the Writer; unmapped consumers default hidden;
- Build 1 completion still includes an isolated staging deploy and hosted error-tracking correlation proof.

Routine tooling choices are implementation discretion unless they materially change architecture, security, provenance, recoverability, or operating cost.

## Pre-Build coding-agent dry run — no code

Before Build 1 implementation, the coding agent must return a design reading of the active corpus without creating or modifying source files.

It must provide:

- proposed repository layout;
- proposed Postgres schema/table list with ownership and key relationships;
- which artifact fields live as typed columns versus immutable JSON/artifact payloads and why;
- migration strategy;
- canonical serializer/hash implementation approach;
- workflow/idempotency/concurrency approach;
- paid-provider lease/unique-guard approach;
- dependency list, versioning strategy, and justification;
- environment/secrets plan;
- object/artifact storage plan;
- structured logging/error-tracking approach;
- CI checks;
- local development commands;
- proposed representation for Craft Critic output and bounded craft-revision provenance using existing objects first;
- exact list of any remaining ambiguities or spec conflicts.

The dry run must not solve an ambiguity by silently inventing architecture.

Mike/human review approves or changes this shape before code begins.

## Build 1 — repository, database, deployable skeleton

### Deliver

- one TypeScript repository with clear README and local setup;
- Node.js 24 LTS pinning for local/CI;
- TypeScript strict compiler configuration;
- formatter/linter;
- test runner;
- committed lockfile;
- secret scanning and dependency/security scanning;
- environment/config handling with no committed secrets;
- Postgres schema and versioned migrations for the Build-2 artifact path;
- shared canonical JSON serializer + SHA-256/domain-separated hashing utility matching Engineering Standards and owning specs;
- structured logging with run/attempt/stage IDs;
- a minimal durable workflow/command runner sufficient to execute the fixture;
- CI that creates a fresh database, runs migrations, validates the fixture, runs hash conformance, tests, lint/types, secret scan, and dependency scan;
- documented backup configuration and restore-drill procedure;
- development/staging defaults that cannot silently target production.

### Minimum persistent objects

Implement only what Build 2 needs. Use Architecture v1.0's object names unless an active successor spec says otherwise.

At minimum the system must durably represent:

- `program_runs`;
- `program_run_attempts`;
- `evidence_packages`;
- fixture-grade `evidence_units`;
- `claims`;
- append-only `claim_state_events`;
- `claim_supports`;
- `derivation_runs`;
- minimal rights/version records required by the fixture;
- `showrunner_brief_versions`;
- **brief-owned** `program_blocks`;
- `script_versions` including `revision_parent_id`;
- `turns`;
- `turn_claim_uses`;
- `turn_evidence_uses`;
- `performance_direction_versions`;
- `performance_intents`;
- `audit_runs`;
- `gate_definitions`;
- `gate_results`;
- `render_manifests`;
- `render_blocks` with snapshotted `speaker_map`;
- `voice_profiles`;
- `voice_profile_versions`;
- canonical `pronunciations`;
- `pronunciation_renderings`;
- `render_takes`;
- append-only `take_selections`;
- `audio_artifacts`;
- `master_assembly_maps`;
- versioned assembly recipe representation;
- authoritative append-only `provider_calls` for provider side effects/tries/usage/cost;
- `model_runs` and `prompt_manifests` for semantic model provenance, referencing provider calls rather than duplicating their ledger;
- `shows` with launch review policy/config binding;
- minimal `accounts`/actor identity for privileged review/repair actions;
- fixture-grade Episode/GUID record required at READY;
- immutable `repair_requests`;
- immutable/versioned `repair_plans`;
- review decision records / gate results sufficient to resume a durable READY wait.

Do not create a second `program_blocks` source under scripts. Scripts reference brief-owned blocks.

Do not add a separate mutable `provider_spend` table merely to total costs. For Build 1–2, derive spend from the authoritative durable `provider_calls` ledger. `model_runs` and `render_takes` reference those calls; they are not independent spend sources.

### Done when

A clean checkout can:

1. install from the lockfile;
2. create a fresh database;
3. run all migrations;
4. load Frozen Walking-Skeleton Fixture v0.4.5 (the single 398-row `foundation_rows_398.json` load);
5. validate every fixture artifact against its owning field/enums contract;
6. persist each artifact with correct lineage;
7. reproduce every expected artifact hash and all six stage fingerprints from the exact fixture-shipped `input_projection` objects; reproduce all nine P&R §24 base-request sensitivity/stability vectors from their row-level `input_record` values; and separately reproduce the nine actual render-block baseline projections in `render_request_projections.json`; reproduce the bounded Layer B fixture hashes recorded in Contract Trace v0.5.5 §9 from their exact captured projections; reproduce every Hashing v0.1.5 §10.1 vector in `authority_resolution_conformance.json` and all 132 base-request vectors;
8. prove the package hash is unchanged by execution timestamp changes;
9. demonstrate one idempotent workflow retry;
10. demonstrate one database/workflow concurrency guard preventing duplicate paid work;
11. run CI green with strict type checking, security scans, and fixture tests;
12. deploy the skeleton to an isolated staging environment with explicit non-production identity;
13. prove a correlation ID reaches the chosen hosted error-tracking/exception surface from staging without leaking protected source/prompt content.

## Build 2 — hand-seeded walking skeleton

### Path

1. Load frozen `evidence_package.json`.
2. Persist a program attempt and bind the package.
3. Load or produce the fixture Showrunner Brief.
4. Build the deterministic writer view and prove consumer-exposure rules: forbidden refs are absent; silent values are exposed only where the versioned profile explicitly permits silent reasoning, and never leak into speech.
5. Produce/load immutable Script Pass 1 candidate.
6. Run the independent Craft Critic against Pass 1 using the versioned compact Writing Standard / anti-pattern policy. The Critic diagnoses; it does not rewrite or add sports facts.
7. If the fixture calls for repair, produce/load one immutable substantive craft-revision child script version. Build 2 allows at most one craft revision.
8. Produce/load immutable Speech-Texture Pass 2 as a child of the approved substantive script.
9. Run deterministic Claims/Writing gates and diff lock.
10. Produce Performance Direction using the closed vocabulary.
11. Run deterministic Performance Direction gates.
12. Run the semantic-audit interface against the exact package + brief + final script + direction + Claims Policy version. A fixture stub is acceptable only if `auditor_kind/version` make it distinguishable from a real audit.
13. Produce Render Manifest only after the exact audit fingerprint passes.
14. Run render-planning gates including program-block boundary, speaker-map completeness, pronunciation freshness, and request-hash conformance.
15. Execute the evaluation-purpose fixture path through VALIDATED; it may never enter READY.
16. Use deterministic `fixture_tts` when paid credentials are absent, or the approved live skeleton TTS adapter when explicitly enabled; either path must persist provider-call identity under the same adapter contract.
17. Store immutable takes.
18. Exercise one **named mechanical-failure** reroll distinct from operational retry, with durable reroll trigger and append-only take selection.
19. Assemble a clean master from exact selected audio hashes.
20. Validate duration/container/basic audio integrity.
21. Store assembly map and actual master artifact hash.
22. Execute the separate production-purpose, publication-disabled review attempt, reusing exact immutable artifacts where hashes remain valid; mint the fixture Episode/GUID at READY.
23. Prove durable READY wait and all three decisions: `approve`, `request_repair`, `halt`; prove timeout halts.
24. For `request_repair`, confirm the plan, fork a child attempt, reuse valid upstream artifacts, rebuild/regate only from the earliest defective layer, and require a fresh READY wait.
25. Exercise the deterministic fixture revalidation interface/result only; do not implement the later full live revalidation sweep.
26. Record Build-2 provider/capability measurements.

No live search is allowed anywhere in this path.

## Required tests before Build 2 is complete

Automate the deterministic Contract Trace v0.5.4 failure drills and Fixture v0.4.5 negative vectors, including:

- wrong numeric claim value;
- silent market-value leak;
- invented first-person attendance/access;
- stale pronunciation rendering;
- render block crossing a program-block boundary;
- duplicate workers requesting the same logical paid take;
- Pass-2 number change;
- literal provider-looking text escaping;
- external evidence prompt injection remaining inert;
- non-render metadata leaving base request hash unchanged;
- spoken-word change changing the base request hash;
- voice-profile version change invalidating only affected requests;
- performance-intent change changing the affected hash;
- bounded-context dependency invalidation;
- pronunciation-rendering correction changing the affected hash;
- adapter-transform change changing the affected hash;
- `take_index` not changing the base request hash;
- reroll vs operational retry;
- take-selection history surviving rebuild/reassembly;
- package timestamp mutation leaving package hash unchanged;
- failed/rebuilt attempts preserving immutable history;
- Craft Critic cannot introduce new sports facts or rewrite the script itself;
- repeated Gaz dry-correction device triggers a device-saturation finding rather than a speaker-order permutation;
- explicit "key takeaway" educational language is surfaced under the launch invisible-comprehension policy;
- Simon can embody strong supporter emotion without collective-membership language or invented attendance;
- a claim-backed comprehension target can be reinforced through different conversational functions without any repetition-count field;
- Tully's closing synthesis is present as a planned editorial job and points forward without unsupported claims.

A mutation test must fail for the named reason, not because a generic schema error happened earlier. Vectors that require model judgement are recorded model-evaluation cases and must not be disguised as deterministic CI keyword rules.

## TTS/provider requirements

Use an adapter boundary. Provider-specific tags, overlap syntax, request envelopes, and escaping exist only inside the adapter.

Current prototype voice IDs may be loaded as development configuration if available, but code must not hard-code character names to provider IDs.

The Render Manifest snapshots the exact turn -> participant -> immutable voice-profile-version `speaker_map`. Do not resolve a mutable "current voice" at synthesis time.

Never log provider secrets or full requests that contain protected text.

The Render Test Kit capability questions remain measurements. Implement test hooks for:

- three speakers in one request;
- automatic filler behavior;
- long-block voice/accent drift;
- bounded-context quality/caching tradeoff;
- measured speaking rate;
- overlap regression.

Do not let the answers rewrite editorial program structure automatically. Automatic reroll remains restricted to named mechanical validation failures; subjective dissatisfaction requires privileged repair/override.

## Failure policy

Classify failures as:

- deterministic contract failure;
- adjudicated semantic/editorial audit failure;
- retryable operational/provider failure;
- terminal operational failure.

Do not retry semantic failure indefinitely. Do not turn a reroll into a network retry. Preserve failed-attempt records.

## What not to build

Not in scope:

- automated ingest;
- web research;
- source commissioning UI;
- publication/RSS;
- consumer/user account product (the minimal internal actor/account identity required for audit is in scope);
- payments;
- dynamic ads;
- alternate TTS failover;
- full Editorial Review agent;
- large automatic Craft Library retrieval system;
- engagement-driven automatic writing-policy optimization;
- production attention-loss simulation;
- betting/pre-event product;
- multilingual;
- generalized knowledge graph/vector database;
- Redis/message broker unless a demonstrated Build-2 requirement cannot be met without it;
- Kubernetes/microservices.

## Dry-run prompt — use first

> Read `00_INDEX/ACTIVE_SPECS_LOCKED_v1.2.5.md` and every Build-1/2 active document it names. Do not write code yet.
>
> Return an implementation proposal for Build 1 only: repository layout, Postgres schema/table list and key relationships, artifact storage approach, migration strategy, canonical serialization/hash plan, workflow/idempotency/concurrency plan, paid-provider uniqueness/lease mechanism, dependencies with justification, environment/secrets plan, logging/error-tracking plan, CI checks, and exact local commands you would expect to use.
>
> The application runtime is already decided by ADR-002: TypeScript on Node.js 24 LTS in strict mode. Do not reopen it.
>
> Before proposing any dependency, service, table, queue, cache, configuration system, framework, or abstraction, state the concrete requirement and why the existing mechanisms cannot satisfy it.
>
> Use the active specs, not superseded documents, to resolve the model. Writing Craft and Invisible Comprehension v0.1 is launch-format policy, not a new lifecycle layer. Craft Critic runs inside SCRIPTED and must use existing immutable artifact/model-run representation unless you can justify a smaller/safer alternative. Do not create a dedicated craft-review table without first proving the existing mechanism cannot serve.

Use the active specs, not superseded documents, to resolve the model. Program blocks are owned by the frozen Showrunner Brief. Scripts reference them. Important editorial artifacts are immutable/versioned. External media/model output are untrusted data. No production defaults. No live search in the walking skeleton.
>
> Validate your proposed schema against Frozen Walking-Skeleton Fixture v0.4.6 and Contract Trace v0.5.5. If you find a contradiction or a structurally important question the active corpus does not answer, stop and report it instead of choosing silently.
>
> End with a section titled `Questions requiring human decision`. If there are none, write `None.`

## Build-1 implementation prompt — use only after dry-run approval

> Implement the approved Build-1 proposal only. Do not implement Build 2 yet.
>
> Preserve the approved schema, dependency set, canonical hash contract, and workflow/concurrency approach. If implementation reveals a contradiction that was not visible in the dry run, stop and surface it before changing structure.
>
> At completion, provide: migration/schema summary, dependency list and lock status, tests/CI summary, hash-conformance results, fixture-validation results, known deferrals, security scan results, and exact local/CI commands.

## Human review checkpoint

Before Build 1 implementation, Mike reviews the coding-agent dry run.

Before Build 2 implementation, Mike reviews:

- actual schema/migrations;
- dependency additions;
- environment/secrets setup;
- canonical hashing implementation;
- artifact immutability enforcement;
- workflow/idempotency mechanism;
- provider concurrency/cost controls;
- CI/conformance results.

At both checkpoints ask:

> What are we not discussing because Mike would have to already know it exists in order to ask?


## Launch operating path: autonomous by default

Do not add a per-render-block approval queue. Technically valid take 0 is selected by `auto_approve_on_technical_validation`; automatic rerolls are restricted to named mechanical failures. Subjective acoustic judgement is not a retry condition.

The workflow mechanism selected in the dry run must support a **durable external-event wait and resume** without replaying completed paid work. Build 2 proves this at READY before REVALIDATED when the show review policy requires it. This is a workflow capability, not a new canonical episode state.

Review outcomes are `approve`, `request_repair`, and `halt`. `request_repair` creates an immutable repair request from natural-language operator feedback. The Operator Repair planner returns a typed plan naming the repair layer, earliest invalidated stage, preserved artifacts, downstream rebuild scope, and constraint checks. At launch, the operator confirms the plan once; orchestration forks a child attempt under ADR-003A and invokes existing stage interfaces from the earliest defective layer. The original READY attempt never moves backward.

The Operator Editor must not receive arbitrary database write access and must not treat operator feedback as sports evidence. It cannot bypass Claims Policy, rights, silent usage, sombre mode, provenance, or implied-access rules.

A minimal CLI/API/internal form is sufficient for Build 2/launch proof. Do not build a polished review dashboard, notification service, or queue product before measured need.

Fixture v0.4.5 `validate_fixture.py` verifies the 398-row load, the UUID references, five explicit synthetic model executions, model semantic-input vectors, existing artifact and stage identities, and immutable-pack inventory. Run it from the repository root as documented in the fixture README. Future loaders must consume explicit provenance and must not fabricate missing model provenance.
