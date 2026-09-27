# The Desk — ADR-003: Autonomous Operation, Pre-Publish Review, and Operator Repair

**Status:** ACCEPTED AMENDMENT  
**Date:** September 26, 2026  
**Amends:** Technical Architecture v1.0  
**Scope:** Product operating model; Builds 1–2 sockets; launch operation

## 1. Decision

**The Desk runs itself.** The normal production path is autonomous. Human involvement is limited to:

1. a toggleable whole-episode pre-publish review at launch; and
2. exception handling for typed halts, policy-required adjudication, or operator-requested repair.

Take selection is not a routine review point. Acoustic judgement per render block is not a routine review point. Human review must not be scattered through the pipeline.

At launch, `pre_publish_review_policy = required` for configured shows. The intended review unit is the READY episode/master, roughly one listen plus a glance at relevant audit/claim information. The policy may later be changed to `automatic` on evidence. The initial physical schema may use `shows.pre_publish_review_required BOOLEAN NOT NULL DEFAULT TRUE`, but the product concept is a versioned policy rather than permanent boolean semantics.

## 2. Placement

The accepted artifact lifecycle remains unchanged:

```text
VALIDATED → READY → REVALIDATED → PUBLISHING → PUBLISHED
```

The optional review is a **gate and durable workflow wait while the episode is at READY**, not a new canonical artifact state. If review is required, the workflow suspends after READY and before REVALIDATED. It resumes only from a durable external decision. Revalidation therefore remains the freshest automated check immediately before publication.

A review wait is bounded by freshness policy. Expiry halts; it never silently publishes. Multiple READY episodes may be parked concurrently.

## 3. Review outcomes

The launch review gate accepts exactly:

- `approve` — resume to REVALIDATED;
- `request_repair` — create an immutable repair request and enter Operator Repair;
- `halt` — stop the attempt with a typed operator halt.

Record every review outcome from launch. Approval-unchanged rate, repair rate, repair layer, first-repair success, and time-to-new-READY are calibration data. No automatic off-switch threshold is specified yet. A human changes the review policy after examining evidence.

## 4. Automatic take selection

A technically valid take is selected by named policy, default `auto_approve_on_technical_validation`. The append-only `take_selection` record stores the policy actor. A human action exists only when overriding that policy.

Automatic rerolls are permitted only for named mechanical failures covered by Performance & Render hard validation. Operational retries remain distinct. Acoustic taste, comedic timing, character naturalness, or subjective delivery never trigger an unbounded automatic reroll loop. Those are episode-review/repair concerns.

## 5. Operator Repair

Operator Repair is an operator-facing control function, not a new autonomous editorial authority. Its purpose is to translate natural-language feedback into the smallest valid pipeline intervention.

Core rule:

> **Repair from the earliest layer that is actually wrong, but no earlier.**

Examples:

| Operator observation | Normal repair layer | Typical consequence |
|---|---|---|
| Wrong pronunciation | pronunciation/render | new pronunciation rendering; rerender affected blocks |
| Correct words, wrong delivery | performance | new Performance Direction; audit and rebuild downstream |
| Bad overlap/pause | performance/render planning | revise approved intent or render plan; rerender affected blocks |
| Synthetic or awkward dialogue | writing | new script version; re-audit and rebuild downstream |
| Weak/boring structure | programming | new Brief version; regenerate every downstream artifact |
| Possible factual error | evidence/claims | return upstream for verification; editor may not simply rewrite the fact |
| Tonal failure around serious event | diagnose earliest defective layer, often programming/writing/performance | preserve sombre/incident rules; rebuild downstream |

Operator feedback is **instruction, not sports evidence**. It cannot create or alter a factual claim merely because the operator asserts a fact. It cannot grant rights, override usage class, bypass sombre/incident policy, create implied access, or authorize prohibited quotation.

## 6. Repair contract

Builds 1–2 must be able to represent:

```text
repair_request
  repair_request_id
  program_run_id
  attempt_id
  source_ready_artifact_ref
  operator_actor_id
  natural_language_feedback
  created_at

repair_plan
  repair_plan_id
  repair_request_id
  repair_policy_version
  repair_layer
  earliest_invalidated_stage
  affected_artifact_refs[]
  preserved_artifact_refs[]
  proposed_actions[]
  constraint_checks[]
  requires_operator_confirmation
  created_at
```

`repair_layer` v0.1 values:

`programming | writing | performance | pronunciation | render_planning | evidence_claims | unknown`

The Operator Editor may **propose** a typed repair plan. It does not receive arbitrary database mutation privileges. The orchestration layer validates the plan against allowed re-entry points and active policy, creates new immutable artifact versions/attempt lineage, invalidates every downstream approval bound to superseded content, and reruns required gates.

For launch, operator confirmation of the proposed repair plan is required before execution. This is one confirmation of the repair, not a sequence of low-level approvals.

## 7. Episode repair vs system learning

An episode repair may also create an `editorial_improvement_candidate` describing a recurring or systemic concern. It may not silently mutate Character Bible, Showrunner policy, writing prompts, performance vocabulary, voice profiles, or other canonical configuration.

Systemic change follows:

```text
episode observation
→ improvement candidate
→ Editorial Review / human adjudication
→ versioned canonical change
→ measure
```

This preserves the distinction between fixing today's episode and changing tomorrow's system.

## 8. Build boundary

Build 1 roughs in persistence and orchestration:

- show-level pre-publish review policy field;
- review gate definition;
- durable external-event suspend/resume capability;
- immutable repair request/plan objects and lineage;
- allowed re-entry-stage validation.

Build 2 proves the behavior with fixture examples.

A polished review UI, notification system, queue product, automatic acoustic-quality judge, and autonomous canonical-policy mutation are not required for the walking skeleton. A minimal operator entry point sufficient to submit natural-language repair feedback may be CLI/API/internal form at launch; presentation is not architecture.

## 9. Origin clarification

Architecture's six-member evidence-origin vocabulary describes **evidence-unit origin**. Claim origin is governed by Claims Policy and additionally permits `desk_derived`. Do not collapse these into one shared enum.

## 10. Governing principle

The system should handle uncertainty with policy, ordinary failure with bounded retry/revision, and genuine blockers with typed halt. Human attention is scarce and belongs at whole-episode product judgement and true exceptions, not at every internal artifact.
