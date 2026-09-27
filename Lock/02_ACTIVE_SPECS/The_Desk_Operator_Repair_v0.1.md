# The Desk — Operator Repair v0.1

**Status:** ACTIVE  
**Date:** September 26, 2026  
**Authority:** ADR-003; Technical Architecture v1.0; Claims Policy v0.1; active layer specs
**Required by:** Builds 1–2 for representation and walking-skeleton proof; launch for operator use

## 1. Purpose

Operator Repair turns a human's natural-language judgement of a READY episode into a safe, typed, minimal repair. It exists so the operator can say what is wrong without knowing which database object, model prompt, render block, or pipeline stage must change.

It is not a fourth synthetic host, a fact source, a free-form database agent, or a bypass around claims/rights/sensitivity policy.

## 2. Input

Required input is a `repair_request` bound to one exact READY candidate/master and its program attempt. The request preserves the operator's original feedback verbatim. Optional structured locators may identify approximate time range, participant, turn, program block, or issue category, but the operator is not required to know them.

## 3. Diagnosis and routing

The repair planner classifies the earliest layer actually defective:

- `programming`
- `writing`
- `performance`
- `pronunciation`
- `render_planning`
- `evidence_claims`
- `unknown`

The planner must prefer the smallest intervention that can solve the stated problem without moving responsibility into the wrong layer. Examples: delivery-only feedback must not rewrite spoken text; pronunciation must not be encoded as canonical script respelling; boring structure must not be disguised as a performance tweak.

If diagnosis is materially ambiguous, the plan may present at most a small number of concrete alternatives to the operator. It must not silently choose a high-impact upstream rewrite when a lower-impact repair may suffice.

## 4. Repair plan

Every proposed plan records:

- source READY artifact and exact input lineage;
- chosen `repair_layer`;
- `earliest_invalidated_stage`;
- preserved upstream artifact hashes;
- artifacts to supersede/rebuild;
- affected turn/block/entity refs where known;
- proposed action in plain language;
- policy checks required before execution;
- estimated rebuild scope (`localized` or `full_downstream`);
- whether paid provider work will be repeated;
- operator confirmation decision.

The plan is immutable. A changed plan is a new version.

## 5. Allowed re-entry points

| Repair layer | Earliest normal re-entry | Must rebuild downstream |
|---|---|---|
| programming | `PLANNED` | Brief, scripts, direction, audit, render, assembly, validation |
| writing | `SCRIPTED` | script, direction, audit, render, assembly, validation |
| performance | `PERFORMANCE_DIRECTED` | direction, audit, render, assembly, validation |
| pronunciation | `RENDER_PLANNED` | affected render requests/takes, selections as required, assembly, validation |
| render_planning | `RENDER_PLANNED` | manifest, affected takes, selections as required, assembly, validation |
| evidence_claims | upstream evidence/claim correction path | new package/attempt as required, then every downstream stage |
| unknown | none | halt for operator clarification |

Re-entry labels describe the earliest artifact responsibility, not permission to mutate an existing artifact. New immutable versions/attempts are created.

## 6. Invalidation

A repair invalidates every gate/manifest/selection/master whose input fingerprint depends on changed content. Unaffected content-addressed render takes may be reused only when their base request hashes remain exactly valid. The system must never infer reuse from human similarity.

## 7. Factual and policy boundary

Operator feedback cannot itself support a sports-world assertion. If feedback says a fact is wrong, route to `evidence_claims`; verify against legitimate evidence before changing the claim.

Repair cannot:

- change a `silent` claim into speakable content;
- waive quote/paraphrase/retention/provider-exposure rights;
- override confirmed sombre mode into normal;
- manufacture first-person attendance/access/biography;
- silently alter a published historical artifact;
- edit canonical Character Bible/policy/prompts as an episode side effect.

## 8. Execution and confirmation

At launch, the Operator Editor proposes the plan and the operator confirms it. After confirmation, orchestration invokes existing stage interfaces. The Editor does not perform arbitrary writes.

The repair attempt is bounded by the same revision, retry, cost, and provider controls as ordinary production. Failure to repair within policy ends in a typed halt rather than an unbounded regeneration loop.

## 9. Review outcomes and measurement

Store at least:

- `approved_unchanged`;
- `repair_requested`;
- `halted`;
- repair layer;
- localized/full rebuild;
- first-repair success;
- elapsed time request → new READY;
- operator reason/category;
- optional improvement-candidate ref.

These measurements inform when routine pre-publish review can be disabled and what quality failures deserve future automation. They are not an automatic quality score.

## 10. System-learning nomination

When feedback appears systemic, the episode repair may append an `editorial_improvement_candidate` with evidence refs to affected turns/episodes and a proposed owner. It cannot enact the systemic change. That remains an Editorial Review + human decision.

## 11. Walking-skeleton acceptance

Build 2 must demonstrate at least:

1. READY can durably suspend for required review and resume from an external event;
2. `approve` resumes toward REVALIDATED;
3. `halt` cannot publish;
4. a performance-only repair preserves script hash and rebuilds direction/audit/render downstream;
5. a programming repair creates a new Brief and full downstream lineage;
6. factual-correction feedback routes to evidence/claims rather than directly rewriting script;
7. repair cannot override sombre/rights/silent/implied-access rules;
8. unchanged render requests may reuse valid takes; changed request hashes may not;
9. the original READY candidate and every superseded artifact remain inspectable;
10. no per-render-block human approval state exists on the normal path.
