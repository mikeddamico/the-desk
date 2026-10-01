# The Desk - Active Specs Manifest v1.2.6 (INACTIVE SUCCESSOR - PROPOSED)

**Status:** INACTIVE SUCCESSOR - PROPOSED. Not selected: FINAL LOCK v1.2.5 (`ACTIVE_SPECS_LOCKED_v1.2.5.md`) remains the active manifest until a later activation. If activated, this manifest would supersede it
**Date:** October 1, 2026
**Purpose:** Proposed single implementation-facing authority index after the v1.2.6 authority-resolution tranche and, before that, after the independent Codex/Claude dry runs, v1.2.1 corrective lock, the bounded v1.2.4 executable-contract hotfix, and the v1.2.5 persistence-contract activation.

| Document | Version | Status | Required by | Owns |
|---|---:|---|---|---|
| Technical Architecture | v1.0 | ACCEPTED / FROZEN | All builds | System boundaries, durable artifacts, lifecycle, persistence/lineage |
| ADR-001 Coverage Commissioning | 001 | ACCEPTED AMENDMENT | Builds 3-5 | Commissioning, enrichment, internal context retrieval |
| ADR-002 Application Runtime | 002 | ACCEPTED AMENDMENT | Build 1+ | TypeScript, Node.js 24 LTS, strict mode |
| ADR-003 Autonomous Operation & Operator Repair | 003 | ACCEPTED AMENDMENT | Build 1+ / launch | Autonomous operating model, READY review socket, repair authority/boundaries |
| ADR-003A READY & Repair-Attempt Semantics | 003A | ACCEPTED ADDENDUM | Builds 1-2 / launch | Evaluation/READY separation, fixture READY proof, child-attempt repair semantics |
| Operator Repair | v0.1.1 | ACTIVE | Builds 1-2 / launch | Natural-language feedback -> typed repair plan; READY repair child-attempt rule |
| Coverage Commissioning & Knowledge Readiness | v0.1 | ACTIVE, NO BUILD 1-2 IMPLEMENTATION | Build 3 | Coverage readiness |
| Claims Policy | v0.1.2 | ACTIVE | Builds 2, 6 | Claims, usage, grounding, required-attribution semantics, silent non-leak |
| Evidence Package | v0.2.2 | ACTIVE | Builds 2, 5 | Frozen evidence contract and consumer-exposure profiles |
| Showrunner Planning | v0.1.3 | ACTIVE | Builds 2, 5 | Mode/template selection, brief-owned program blocks, comprehension targets, closing synthesis |
| Writing Craft & Invisible Comprehension | v0.1 | ACTIVE - LAUNCH FORMAT | Builds 2, 6 | Craft standard, Craft Critic, semantic reinforcement, comprehension resilience |
| Writing | v0.2.3 | ACTIVE | Builds 2, 6 | Spoken text, bounded craft revision, speech texture, spans/gates subject to hash/span contract |
| Writing Build 1-2 Fixture-Profile Addendum | v0.1 | ACTIVE (addendum to Writing v0.2.3; version id `writing-fixture-profile-addendum-0.1`) | Builds 2, 6 | Prediction wording-candidate carrier, writer-view nested members and exposure, addendum binding |
| Performance & Render | v0.1.4 | ACTIVE | Builds 2, 7 | Direction/render/takes/assembly, mechanical reroll rule, provider-call ledger relationship |
| Character Bible | v0.1.4 | ACTIVE | Builds 2, 5 | Character identity, ensemble relationships, shared object of concern |
| Engineering Standards & Security | v0.1.3-skeleton | ACTIVE SKELETON | Builds 1-2 | Engineering/security floor, staging/error-tracking proof, provider-call accounting |
| Hashing, Fingerprints & Text Spans | v0.1.5 | ACTIVE IMPLEMENTATION CONTRACT (base contract) | Builds 1-2 | Canonical serializer and declared-profile conventions, domains, stage fingerprints, nested base-request projection with rendering-identity pronunciation grouping, complete prompt manifests and addendum binding, show-config/1 and Brief projections, audit-findings gate, Foundation 001+002 profile status, base artifact registry, Unicode spans, mandatory conformance additions |
| Walking-Skeleton Contract Trace | v0.5.5 | ACTIVE IMPLEMENTATION CONTRACT | Builds 1-2 | Conformance/failure drills; Layer B fixture decisions 1-9 |
| Frozen Walking-Skeleton Fixture | v0.4.6 | ACTIVE EXECUTABLE CONTRACT | Builds 1-2 | CONFIG-330 corrected synthetic conformance/config/review/repair vectors, 398-row load, fixture audio, authority-resolution vectors and identity transition |
| Walking-Skeleton Coding Handoff | v0.5.5 | ACTIVE IMPLEMENTATION HANDOFF | Builds 1-2 | Exact Build-1/2 scope and completion gates |
| Lore Pipeline | v0.1 | LEGACY ONLY WHERE NOT SUPERSEDED; BANNER REQUIRED | Until Build 3 revision | Narrow legacy lore behavior only |
| Ingest & Digest | v0.1 | LEGACY ONLY WHERE NOT SUPERSEDED; BANNER REQUIRED | Until Build 4 revision | Narrow legacy ingest behavior only |
| Render Test Kit | prototype | TEST FIXTURE | Build 2 experiments | Provider capability experiments only |
| Implementation Readiness Closure | v1.2.6 | ACTIVATION CLOSURE | Builds 1-2 | Activation closure record; not implementation completion |
| Episode Input Package | v0.1 | SUPERSEDED | None | Historical only |
| Script Spec | v0.1 | SUPERSEDED | None | Historical only |

## v1.2.6 successor (proposed; inactive)

If activated, this Lock selects Hashing v0.1.5 (SHA-256 `a78ac9478b8ee9a55caae21ba07fd1106e110ba6cd30de807181cd4a15a10e89`), the Writing Build 1-2 Fixture-Profile Addendum v0.1 (SHA-256 `79ea43076b0b5ca68916f8e12ac3457e48c6ad31a9bf5f1c47034fcb1de7f55f`), Fixture v0.4.6 (ZIP SHA-256 `7e1bb1108cdd84e47269b9ab2dab20ba934fcec64d44262f86d2b505616b0747`), Coding Handoff v0.5.5, Contract Trace v0.5.5 and Implementation Readiness Closure v1.2.6. Claims Policy v0.1.2, Evidence Package v0.2.2, Writing Spec v0.2.3, Performance & Render v0.1.4, Showrunner v0.1.3 and the other rows above are unchanged. It makes no database/schema, migration, lifecycle, product-intent, dependency or product-implementation change, broadens no Build 1 or Build 2 scope, and does not begin Completion A, Completion B or the A5 retry/operation work.

Each proposed successor file of this tranche (Hashing v0.1.5, the Writing Build 1-2 Fixture-Profile Addendum v0.1, Contract Trace v0.5.5, Coding Handoff v0.5.5, Implementation Readiness Closure v1.2.6) carries a header that says "INACTIVE SUCCESSOR" and that it is proposed for a later FINAL LOCK v1.2.6; that wording records its pre-activation authorship state and is superseded by an activation manifest that selects it unchanged. Claims Policy v0.1.2, Evidence Package v0.2.2, Writing Spec v0.2.3 and Performance & Render v0.1.4 are not part of this change: they stay byte-identical to the bytes bound by Fixtures v0.4.5 and v0.4.6, and their policy source hashes are unchanged. FINAL LOCK v1.2.5 remains the active selection until a later activation.

Every v1.2.5 and earlier Lock file, including Hashing v0.1.4, Trace v0.5.4, Handoff v0.5.4, Closure v1.2.5 and Fixture v0.4.5, is retained byte-identical as history.

## Hashing v0.1.5, the Writing addendum and bounded fixture decisions

Hashing v0.1.5 is the base implementation contract. Its prediction-candidate and writer-view profiles take their field lists from the Writing Build 1-2 Fixture-Profile Addendum; its show-configuration profile takes its schema from Layer B decision 6. The bounded fixture decisions (items 1-9) are recorded with exact formulas in Contract Trace v0.5.5 §9, apply only to fixture content, are not Hashing text, and are not product-wide policy.

## Fixture-only runtime band

The fixture show configuration band maximum of 330 seconds and the 240-second `runtime_target` are evaluation-fixture values only. They are not product runtime policy; the launch product templates remain quiet 8 / standard 10 / big 12 minutes.

## Precedence

1. Technical Architecture v1.0 and accepted ADRs/addenda.
2. Active successor specifications (including the Writing addendum as an addendum to Writing v0.2.3).
3. Active Build 1-2 implementation contracts/handoff where they do not alter higher-level authority.
4. Bannered legacy documents only for narrow material not addressed by a newer active spec.
5. Test fixtures as executable examples subordinate to the governing contracts; the bounded fixture decisions are subordinate to Hashing v0.1.5 as the base contract.

If active documents appear to conflict, stop and surface the conflict. Do not silently reconcile.

## Build 1 implementation boundary

General architecture review is closed. Build 1 must still prove an isolated staging deployment and correlation to hosted error tracking before Build 1 is called complete (Technical Architecture v1.0 Build 1; Handoff v0.5.5 Done-when items 12-13). Subsequent implementation follows Handoff v0.5.5 and begins with mechanical conformance against Fixture v0.4.6. Migration 002 (append-order and isolation guard) is merged at the v1.2.5 baseline; the durable event-identity and operation/retry semantics (A5) are unresolved and are not discharged by it.
