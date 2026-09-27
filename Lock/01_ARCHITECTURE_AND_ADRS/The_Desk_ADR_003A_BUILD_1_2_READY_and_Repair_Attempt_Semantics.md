# ADR-003A — Build 1–2 READY and Repair-Attempt Semantics

**Status:** ACCEPTED ADDENDUM
**Date:** September 27, 2026
**Authority:** Additive clarification to ADR-003 under Technical Architecture v1.0. It does not reopen or amend Architecture v1.0.

## Decision

### 1. Evaluation remains barred from READY

`program_runs.purpose = evaluation` remains structurally barred from `READY` and `PUBLISHING`. No test or fixture may weaken that safety boundary.

### 2. Build-2 READY proof uses a production-purpose, publication-disabled fixture run

The walking skeleton contains two paths over the same controlled, frozen content:

- an `evaluation` path that may execute through `VALIDATED` but cannot enter READY;
- a separate `production`-purpose run/attempt with `publication_enabled = false` used only to exercise production-path READY semantics.

`purpose=production` here means production-path lifecycle semantics. It does **not** imply production environment, live publication credentials, or permission to distribute.

### 3. READY requires a real validated fixture master

Build 2 may use deterministic `fixture_tts` audio to materialize rights-safe placeholder bytes, assemble a clean master, and validate it without paid credentials. A render-ready manifest alone is not a READY candidate.

When the publication-disabled production-purpose fixture enters READY, the normal Architecture v1.0 rule still applies: mint one durable internal Episode/GUID/pubDate record for that run if not already present. It remains non-publishable because publication is disabled and Build 8 publication infrastructure does not exist.

### 4. Revalidation proof is an interface/contract stub only

Build 2 may persist a deterministic fixture revalidation snapshot/result to prove READY -> REVALIDATED gate shape, expiry handling, and binding. This does **not** implement the full live revalidation sweep assigned to later builds.

### 5. Confirmed READY repair creates a child attempt

A READY attempt never moves backward. When review returns `request_repair` and the operator confirms the repair plan, orchestration creates a child attempt under the same `program_run`, recording `parent_attempt_id` and causal `repair_plan_id`.

The child attempt reuses exact immutable artifacts whose hashes remain valid and regenerates only from the earliest defective layer. If the evidence basis changes, it binds the required new Evidence Package.

The parent attempt and original READY candidate remain immutable and inspectable. Every child candidate that reaches READY receives a fresh review wait. Prior review decisions never transfer.

### 6. Run-level cumulative guard

Per-attempt retry/revision/cost ceilings remain, but the program run also carries a cumulative repair/generation ceiling so repeated child attempts cannot reset safety limits indefinitely.

## Consequences

- No new canonical lifecycle state is added.
- No `AWAITING_REVIEW` state is added.
- Publication remains out of scope.
- The walking skeleton can prove durable READY wait/resume and repair lineage without violating the evaluation safety boundary.
