# The Desk - Active Specs Manifest v1.2.3

**Status:** LOCKED FOR BUILD 1 IMPLEMENTATION
**Date:** September 27, 2026
**Purpose:** Single implementation-facing authority index after the independent Codex/Claude dry runs, v1.2.1 corrective lock, and bounded v1.2.3 lineage hotfix.

| Document | Version | Status | Required by | Owns |
|---|---:|---|---|---|
| Technical Architecture | v1.0 | ACCEPTED / FROZEN | All builds | System boundaries, durable artifacts, lifecycle, persistence/lineage |
| ADR-001 Coverage Commissioning | 001 | ACCEPTED AMENDMENT | Builds 3-5 | Commissioning, enrichment, internal context retrieval |
| ADR-002 Application Runtime | 002 | ACCEPTED AMENDMENT | Build 1+ | TypeScript, Node.js 24 LTS, strict mode |
| ADR-003 Autonomous Operation & Operator Repair | 003 | ACCEPTED AMENDMENT | Build 1+ / launch | Autonomous operating model, READY review socket, repair authority/boundaries |
| ADR-003A READY & Repair-Attempt Semantics | 003A | ACCEPTED ADDENDUM | Builds 1-2 / launch | Evaluation/READY separation, fixture READY proof, child-attempt repair semantics |
| Operator Repair | v0.1.1 | ACTIVE | Builds 1-2 / launch | Natural-language feedback -> typed repair plan; READY repair child-attempt rule |
| Coverage Commissioning & Knowledge Readiness | v0.1 | ACTIVE, NO BUILD 1-2 IMPLEMENTATION | Build 3 | Coverage readiness |
| Claims Policy | v0.1.1 | ACTIVE | Builds 2, 6 | Claims, usage, grounding, required-attribution semantics, silent non-leak |
| Evidence Package | v0.2.1 | ACTIVE | Builds 2, 5 | Frozen evidence contract and consumer-exposure profiles |
| Showrunner Planning | v0.1.3 | ACTIVE | Builds 2, 5 | Mode/template selection, brief-owned program blocks, comprehension targets, closing synthesis |
| Writing Craft & Invisible Comprehension | v0.1 | ACTIVE - LAUNCH FORMAT | Builds 2, 6 | Craft standard, Craft Critic, semantic reinforcement, comprehension resilience |
| Writing | v0.2.2 | ACTIVE | Builds 2, 6 | Spoken text, bounded craft revision, speech texture, spans/gates subject to hash/span contract |
| Performance & Render | v0.1.3 | ACTIVE | Builds 2, 7 | Direction/render/takes/assembly, mechanical reroll rule, provider-call ledger relationship |
| Character Bible | v0.1.4 | ACTIVE | Builds 2, 5 | Character identity, ensemble relationships, shared object of concern |
| Engineering Standards & Security | v0.1.3-skeleton | ACTIVE SKELETON | Builds 1-2 | Engineering/security floor, staging/error-tracking proof, provider-call accounting |
| Hashing, Fingerprints & Text Spans | v0.1.2 | ACTIVE IMPLEMENTATION CONTRACT | Builds 1-2 | Canonical serializer domains, stage fingerprints, revision-parent identity, Unicode spans |
| Walking-Skeleton Contract Trace | v0.5.2 | ACTIVE IMPLEMENTATION CONTRACT | Builds 1-2 | Conformance/failure drills after dry-run corrections |
| Frozen Walking-Skeleton Fixture | v0.4.3 | ACTIVE EXECUTABLE CONTRACT | Builds 1-2 | Corrected synthetic conformance/config/review/repair vectors and fixture audio |
| Walking-Skeleton Coding Handoff | v0.5.2 | ACTIVE IMPLEMENTATION HANDOFF | Builds 1-2 | Exact Build-1/2 scope and completion gates |
| Lore Pipeline | v0.1 | LEGACY ONLY WHERE NOT SUPERSEDED; BANNER REQUIRED | Until Build 3 revision | Narrow legacy lore behavior only |
| Ingest & Digest | v0.1 | LEGACY ONLY WHERE NOT SUPERSEDED; BANNER REQUIRED | Until Build 4 revision | Narrow legacy ingest behavior only |
| Render Test Kit | prototype | TEST FIXTURE | Build 2 experiments | Provider capability experiments only |
| Episode Input Package | v0.1 | SUPERSEDED | None | Historical only |
| Script Spec | v0.1 | SUPERSEDED | None | Historical only |

## Precedence

1. Technical Architecture v1.0 and accepted ADRs/addenda.
2. Active successor specifications.
3. Active Build 1–2 implementation contracts/handoff where they do not alter higher-level authority.
4. Bannered legacy documents only for narrow material not addressed by a newer active spec.
5. Test fixtures as executable examples subordinate to the governing contracts.

If active documents appear to conflict, stop and surface the conflict. Do not silently reconcile.

## v1.2.3 clerical lineage hotfix

This lock preserves every v1.2.2 product, architecture, hashing, repair, and conformance decision. It closes the verifier's final two stale-reference defects only:

1. **Revalidation lineage:** Fixture v0.4.3 binds `revalidation_result.ready_candidate_fingerprint` to the current READY candidate `c9ec6c12...`, matching the published READY projection and the other review records.
2. **Fixture documentation:** the fixture README now lists the current claims/writing, performance, render, assembly, and READY fingerprints.

No hash-bearing semantic artifact changed. No architecture or policy decision changed.

## Build 1 implementation boundary

General architecture review is closed. Routine implementation choices such as package manager, validation library, test runner, thin SQL migration runner, UUID library, and file/directory naming do not require Mike adjudication unless they materially alter architecture, security, provenance, recoverability, or cost.

Build 1 must still prove an isolated staging deployment and correlation to hosted error tracking before Build 1 is called complete. Production hosting, publication infrastructure, full live revalidation, ingest, commissioning automation, polished review UI, and alternate provider failover remain deferred.

The next step is **Build 1 implementation under Handoff v0.5.2**, beginning with a short mechanical conformance check against Fixture v0.4.3 rather than another general architecture review.
