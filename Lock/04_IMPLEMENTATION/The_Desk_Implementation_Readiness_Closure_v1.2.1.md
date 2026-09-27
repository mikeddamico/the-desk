# The Desk — Implementation Readiness Closure v1.2.1

**Status:** CLOSED — READY FOR BUILD 1 IMPLEMENTATION
**Date:** September 27, 2026
**Scope:** Builds 1–2 walking skeleton

## 1. Closure statement

The independent Codex implementation dry run and Claude adversarial review identified four concrete blockers. The v1.2.1 corrective lock resolves them without reopening Technical Architecture v1.0.

No general architecture review is required before Build 1. The coding agent should first run a bounded mechanical conformance check against the active corpus and Fixture v0.4.1; if that check reveals no new contradiction, implementation proceeds.

## 2. Closed blockers

### B1 — Evaluation run versus READY

**Closed by:** ADR-003A + Handoff v0.5 + Trace v0.5 + Fixture v0.4.1.

Evaluation attempts remain barred from READY. The fixture now contains a separate `purpose=production`, `publication_enabled=false` review path. Deterministic fixture TTS produces a real validated master; READY mints the internal fixture Episode/GUID; a fixture revalidation result proves the interface only, not the later live system.

### B2 — READY repair attempt semantics

**Closed by:** ADR-003A + Operator Repair v0.1.1.

A confirmed repair of a READY candidate creates a child attempt under the same run. The parent READY candidate remains immutable and never transitions backward. Exact valid upstream artifacts may be reused; every repaired READY candidate receives a new wait. Run-level cumulative ceilings prevent repair attempts from resetting safety budgets indefinitely.

### B3 — Fixture conformance failures

**Closed by:** Fixture v0.4.1 + Claims v0.1.1 + Evidence Package v0.2.1 + Performance & Render v0.1.3 + Trace v0.5.

The corrected fixture uses valid evidence axes, all nine required launch template slots, per-use required attribution, valid timestamps, complete immutable repair records, a named mechanical reroll, authoritative provider-call records, minimum actor/knowledge/model provenance, correct consumer exposure, and deterministic fixture audio/master materialization.

### B4 — Underspecified hash/fingerprint/span contract

**Closed by:** Hashing, Fingerprints & Text Spans v0.1 + Fixture v0.4.1.

The active contract now defines canonical serialization, domain separators, revision-parent content identity, stage-specific gate subjects, audit/render/assembly/READY fingerprints, and zero-based half-open Unicode code-point spans over NFC text. The fixture includes non-ASCII/astral conformance vectors.

## 3. Important amendments incorporated

The lock also incorporates the non-blocking findings from both dry runs:

- minimal relational claims/evidence/support/derivation spine for Build 2, without ingest;
- one authoritative provider-call/cost ledger;
- consumer exposure defaults for Craft Critic, Performance Director, Operator Editor, and unknown consumers;
- confirmation as a separate append-only repair decision;
- shared pronunciation correction routed through the append-only Corrections path;
- deterministic CI versus model-evaluation test classification;
- strict per-use attribution for required-attribution claims in Builds 1–2;
- staging deployment and hosted error-tracking correlation restored as Build-1 completion requirements.

## 4. Intentionally deferred

Still deferred: ingest automation, Coverage Commissioning implementation, publication/RSS, full live revalidation, production hosting choice, production model/provider selection beyond the active skeleton TTS path, polished review UI/notifications, generalized knowledge infrastructure, forced alignment, alternate TTS failover, multilingual, dynamic ads, and production purge execution across provider/backups.

## 5. Build 1 go/no-go

**GO.** Start from `ACTIVE_SPECS_LOCKED_v1.2.1.md`, Handoff v0.5, Contract Trace v0.5, Hashing/Fingerprints/Text Spans v0.1, and Fixture v0.4.1.

The first coding-agent action should be a short read-only mechanical verification that the active source hashes, fixture hashes/fingerprints, enums, and required file references resolve. It is not another design exercise.
