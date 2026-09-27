# The Desk — Active Specs Manifest

**Status:** LOCKED FOR BUILD 1–2 / CODING-AGENT DRY RUN  
**Date:** September 26, 2026  
**Purpose:** Single implementation-facing authority index after Implementation Readiness Review v1.0, Supplement S1, and accepted Operator Repair requirement.

| Document | Version | Status | Required by | Owns |
|---|---:|---|---|---|
| Technical Architecture | v1.0 | ACCEPTED / FROZEN | All builds | System boundaries, durable artifacts, lifecycle, persistence/lineage |
| ADR-001 Coverage Commissioning | 001 | ACCEPTED AMENDMENT | Builds 3–5 | Commissioning, enrichment, internal context retrieval |
| ADR-002 Application Runtime | 002 | ACCEPTED AMENDMENT | Build 1+ | TypeScript, Node.js 24 LTS, strict mode |
| ADR-003 Autonomous Operation & Operator Repair | 003 | ACCEPTED AMENDMENT | Build 1+ / launch | Autonomous operating model, READY review socket, repair authority/boundaries |
| Operator Repair | v0.1 | ACTIVE | Builds 1–2 / launch | Natural-language feedback → typed repair plan/re-entry contract |
| Coverage Commissioning & Knowledge Readiness | v0.1 | ACTIVE, NO BUILD 1–2 IMPLEMENTATION | Build 3 | Coverage readiness |
| Claims Policy | v0.1 | ACTIVE | Builds 2, 6 | Claims, usage, grounding, incidents, implied access |
| Evidence Package | v0.2 | ACTIVE | Builds 2, 5 | Frozen evidence contract/exposure/context candidates |
| Showrunner Planning | v0.1.2 | ACTIVE | Builds 2, 5 | Mode/template selection, brief-owned program blocks, launch registries |
| Writing | v0.2.1 | ACTIVE | Builds 2, 6 | Spoken text, two-pass writing, spans/gates |
| Performance & Render | v0.1.2 | ACTIVE | Builds 2, 7 | Direction/render/takes/assembly; automatic take policy |
| Character Bible | v0.1.3 | ACTIVE | Builds 2, 5 | Character identity/behavior only; no render topology |
| Engineering Standards & Security | v0.1.2-skeleton | ACTIVE SKELETON | Builds 1–2 | Engineering/security floor; durable wait/repair least privilege |
| Walking-Skeleton Contract Trace | v0.3 | ACTIVE IMPLEMENTATION CONTRACT | Builds 1–2 | Conformance and failure drills |
| Frozen Walking-Skeleton Fixture | v0.3 | ACTIVE EXECUTABLE CONTRACT | Builds 1–2 | Synthetic conformance/config/review/repair examples |
| Lore Pipeline | v0.1 | LEGACY ONLY WHERE NOT SUPERSEDED; BANNER REQUIRED | Until Build 3 revision | Narrow legacy lore behavior only |
| Ingest & Digest | v0.1 | LEGACY ONLY WHERE NOT SUPERSEDED; BANNER REQUIRED | Until Build 4 revision | Narrow legacy ingest behavior only |
| Render Test Kit | prototype | TEST FIXTURE | Build 2 experiments | Provider capability experiments only |
| Episode Input Package | v0.1 | SUPERSEDED | None | Historical only |
| Script Spec | v0.1 | SUPERSEDED | None | Historical only; launch rundown migrated into v0.3 config |

## Precedence

1. Technical Architecture v1.0 and accepted ADRs.
2. Active successor specifications.
3. Active skeleton/implementation contracts where they do not alter higher-level authority.
4. Bannered legacy documents only for narrow material not addressed by a newer active spec.
5. Test fixtures only as experiments/examples.

If active documents appear to conflict, stop and surface the conflict. Do not silently reconcile.

## Legacy hazard rule

Never implement from unbannered copies of Lore Pipeline v0.1 or Ingest & Digest v0.1. In particular, do not carry forward source-text discard/paraphrase-only retention, sombre override, mutable cached pronunciation correction, fixed press/fan source counts, or ingest-owned ritual/prediction decisions. Re-derive pronunciation, retention, incident/sombre, and rights behavior from the active successor chain.

## Build 1–2 lock

General foundation review is closed. Reopen only for a concrete implementation contradiction, failing conformance test, measured provider/runtime fact, security/rights defect, or explicit new product decision. The next step is the coding-agent dry run in Handoff v0.3.
