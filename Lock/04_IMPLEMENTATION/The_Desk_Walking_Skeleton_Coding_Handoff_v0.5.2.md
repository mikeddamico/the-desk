# The Desk - Walking Skeleton Coding Handoff v0.5.2

**Status:** LOCKED FOR BUILD 1 IMPLEMENTATION  
**Date:** September 27, 2026  
**Scope:** Build 1 + Build 2 only  
**Supersedes:** v0.5.1

## Objective

Build the smallest coherent TypeScript/Node system that proves the accepted artifact path from a frozen Evidence Package through a validated clean master, production-path READY review/repair semantics, and stored inspectable lineage. Paid provider credentials are optional because Fixture v0.4.3 includes deterministic fixture TTS for the conformance path.

Do not implement ingest, coverage commissioning automation, publication/RSS, monetization, dashboards, autonomous editorial review, or generalized multi-sport production.

The walking skeleton is evidence that the contracts can work together. It is not permission to invent future architecture.

## Required active specs

Read `00_INDEX/ACTIVE_SPECS_LOCKED_v1.2.3.md` first.

Implementation must use:

- Technical Architecture v1.0
- ADR-001 Coverage Commissioning
- ADR-002 Application Runtime
- ADR-003 Autonomous Operation, Pre-Publish Review, and Operator Repair
- ADR-003A Build 1–2 READY and Repair-Attempt Semantics
- Operator Repair v0.1.1
- Claims Policy v0.1.1
- Evidence Package v0.2.1
- Showrunner Planning v0.1.3
- Writing Craft and Invisible Comprehension v0.1
- Writing Spec v0.2.2
- Performance & Render v0.1.3
- Character Bible v0.1.4
- Engineering Standards & Security v0.1.3-skeleton
- Hashing, Fingerprints & Text Spans v0.1.2
- Walking-Skeleton Contract Trace v0.5.2.1
- Frozen Walking-Skeleton Fixture v0.4.3

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

## v1.2.3 clerical lineage hotfix

The independent Codex and Claude reviews are complete. v1.2.3 is a clerical lineage hotfix over v1.2.2, not a new architecture pass. It corrects the stale READY fingerprint in the fixture revalidation result and refreshes the fixture README identities. No hash-bearing semantic artifact, policy, projection rule, or repair semantic changed. Do not reopen general architecture review before Build 1 unless implementation exposes a new concrete contradiction.

Locked implementation consequences:

- evaluation attempts remain barred from READY; the READY drill uses a separate production-purpose, publication-disabled fixture run;
- deterministic fixture TTS may materialize test audio so CI can reach a validated master and READY without paid credentials;
- confirmed READY repair forks a child attempt and never moves the parent backward;
- fixture performance-repair and programming-repair examples are alternative reset scenarios from the same immutable READY seed; they are never inserted together as two terminal review decisions in one history, and each plan is confirmed before child-attempt execution;
- one authoritative `provider_calls` ledger owns provider side effects, tries/retries, usage, and cost;
- the minimum relational knowledge spine includes `evidence_units`, `claims`, `claim_state_events`, `claim_supports`, and `derivation_runs`, without implementing ingest;
- stage-specific fingerprints and Unicode code-point spans follow Hashing, Fingerprints & Text Spans v0.1.2;
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
4. load Frozen Walking-Skeleton Fixture v0.4.3;
5. validate every fixture artifact against its owning field/enums contract;
6. persist each artifact with correct lineage;
7. reproduce every expected artifact hash and all six stage fingerprints from the exact fixture-shipped `input_projection` objects; reproduce all nine P&R §24 base-request sensitivity/stability vectors from their row-level `input_record` values; and separately reproduce the nine actual render-block baseline projections in `render_request_projections.json`;
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

Automate the deterministic Contract Trace v0.5.2 failure drills and Fixture v0.4.3 negative vectors, including:

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

> Read `00_INDEX/ACTIVE_SPECS_LOCKED_v1.2.3.md` and every Build-1/2 active document it names. Do not write code yet.  
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
> Validate your proposed schema against Frozen Walking-Skeleton Fixture v0.4.3 and Contract Trace v0.5.2. If you find a contradiction or a structurally important question the active corpus does not answer, stop and report it instead of choosing silently.  
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
