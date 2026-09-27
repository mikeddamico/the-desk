# The Desk — Implementation-Readiness Closure v1.1

**Status:** CLOSED — READY FOR CODING-AGENT DRY RUN  
**Date:** September 26, 2026  
**Scope:** Build 1 + Build 2 + launch-operation sockets  
**Closes:** Implementation-Readiness Review v1.0 + Supplement S1 + accepted Operator Repair requirement

## Final disposition

The implementation-facing corpus is locked for the coding-agent dry run. Technical Architecture v1.0 remains frozen. ADR-002 fixes TypeScript/Node.js; ADR-003 records the autonomous operating model, one READY pre-publish review socket, and Operator Repair.

All v1.0 A/B blockers remain closed by the v0.2 work. Supplement S1 is now closed as follows:

| Finding | Resolution |
|---|---|
| S1 take-selection conflict | Default `auto_approve_on_technical_validation`; human action only overrides policy. Automatic reroll only for named mechanical failure; subjective acoustic judgement routes to Operator Repair. |
| S2 unbannered legacy docs | Bannered legacy copies created; active manifest forbids implementing obsolete source discard, sombre override, mutable pronunciation map, fixed source counts. |
| S3 no launch rundown | `post-event-launch-v1`, `block-types-v1`, and `episode-modes-v1` ship as versioned configuration in Fixture v0.3. Editorial format migrated from superseded Script Spec without importing its render topology. |
| S4 no config fixture | Fixture v0.3 includes show, policy, participant, voice, mode, block-type and rundown configuration. |
| S5 origin enum ambiguity | ADR-003 clarifies evidence-unit origin vs claim origin; `desk_derived` belongs to claim origin. |
| S6 missing brief fields | Fixture retains required `central_question` and `orientation_job`. |
| S7 single beat | Fixture retains two selected beats/two program blocks. |
| S8 mode drift | Canonical v1 registry uses `normal_post_event`, `roundup`, `sombre`. |
| S9 review socket | Show-level review policy, READY gate, durable external-event wait/resume, timeout-to-halt contract. No new canonical lifecycle state and no review UI required for skeleton. |

## New launch requirement: Operator Repair

Launch review is not approve/reject only. The operator can request repair in natural language. The Operator Editor diagnoses the earliest defective layer, proposes the smallest typed repair plan, and after one operator confirmation orchestration creates new immutable versions and reruns every required downstream gate/stage.

The governing rule is **repair from the earliest layer actually wrong, but no earlier**. Operator feedback is instruction, never sports evidence. Repair cannot waive claims, rights, silent usage, sombre policy, provenance, or implied-access controls. Systemic observations may be nominated for later Editorial Review but cannot silently mutate canonical policy or character configuration.

## Build-1/2 consequences

Build 1 must represent shows/review policy, gate definitions/results, durable external-event workflow waits, immutable repair requests/plans, and allowed re-entry validation. Build 2 must prove approve/request-repair/halt, localized performance repair, upstream programming repair, factual-feedback routing to evidence/claims, downstream invalidation/re-gating, and absence of per-block human approval.

No polished review UI, notification service, automatic acoustic judge, or autonomous canonical-policy editor is required before the walking skeleton.

## Final sequence

```text
locked corpus v1.1
→ coding-agent dry run (no code)
→ human adjudication of implementation choices
→ Build 1
→ Build 1 review
→ Build 2 walking skeleton
→ measure
```

Do not run another general architecture red team before coding. The next meaningful test is executable conformance plus the coding-agent dry run.
