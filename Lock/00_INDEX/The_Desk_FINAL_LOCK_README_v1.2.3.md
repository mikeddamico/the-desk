# The Desk — Build 1–2 Final Lock v1.2.3

**Status:** CODE-READY FINAL LINEAGE HOTFIX  
**Date:** September 27, 2026

This package supersedes Build 1–2 Final Lock v1.2.2 for implementation. Technical Architecture v1.0 remains frozen.

## What changed from v1.2.2

No product architecture, policy, hash projection, or semantic artifact changed. This is a two-reference clerical correction identified by the final verifier:

- `revalidation_result.json` now binds the current READY candidate fingerprint `c9ec6c12...`, matching `episode_ready.json`, `pre_publish_review.json`, and the published READY projection;
- Fixture v0.4.3 README now lists the current five stage/READY fingerprint identities instead of the superseded v0.4.1 values.

Because the fixture bytes changed, the corrected executable fixture is versioned as v0.4.3 rather than silently replacing v0.4.2. Current implementation-facing documents were correspondingly versioned without changing their substantive contracts.

## Start here

1. `00_INDEX/ACTIVE_SPECS_LOCKED_v1.2.3.md`
2. `04_IMPLEMENTATION/The_Desk_Walking_Skeleton_Coding_Handoff_v0.5.2.md`
3. `04_IMPLEMENTATION/The_Desk_Walking_Skeleton_Contract_Trace_v0.5.2.md`
4. `04_IMPLEMENTATION/The_Desk_Hashing_Fingerprints_and_Text_Spans_v0.1.2.md`
5. `04_IMPLEMENTATION/The_Desk_Walking_Skeleton_Fixture_v0.4.3.zip`
6. `04_IMPLEMENTATION/The_Desk_Implementation_Readiness_Closure_v1.2.3.md`

Proceed to Build 1 implementation. No further architecture or pack review is required unless implementation exposes a new concrete contradiction.
