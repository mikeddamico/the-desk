# The Desk - Implementation-Readiness Closure v1.2

**Status:** CLOSED - READY FOR CODING-AGENT DRY RUN  
**Date:** September 26, 2026  
**Scope:** Build 1 + Build 2 + launch-operation and launch-writing-craft sockets  
**Supersedes:** v1.1

## Final disposition

The implementation-facing corpus remains ready for the coding-agent dry run after incorporating the accepted launch writing-craft and ensemble changes.

Technical Architecture v1.0 remains frozen. ADR-001 through ADR-003 remain governing. The new work is a **downstream product/editorial refinement**, not an architecture reopen.

The active successors are now:

- Showrunner Planning v0.1.3;
- Writing Craft and Invisible Comprehension v0.1;
- Writing Spec v0.2.2;
- Character Bible v0.1.4;
- Walking-Skeleton Contract Trace v0.4;
- Frozen Walking-Skeleton Fixture v0.4;
- Coding Handoff v0.4.

## What changed after v1.1

The accepted launch product now has an explicit writing-quality mechanism rather than relying on a generic "write well" prompt or a large golden-example corpus.

### Writing craft

- Positive examples teach abstract craft principles rather than surface templates.
- Contrastive examples and anti-patterns are preferred to imitation-heavy few-shot prompting.
- The production Writer receives a compact standard rather than the whole Craft Library.
- An independent Craft Critic diagnoses writing quality but cannot rewrite or add sports facts.
- Build 2 allows zero or one substantive craft revision inside `SCRIPTED`, followed by the existing speech-texture pass.
- The semantic/factual auditor remains separate and retains its existing authority.

### Invisible Comprehension Design

For the launch post-event format only:

- valuable supportable insight and implication are prioritized over box-score recitation;
- important ideas may be semantically reinforced through different conversational jobs rather than repeated literally;
- comprehension mechanics must remain invisible to the listener;
- no numeric repetition target or information-density metric is introduced;
- the Showrunner may mark a small number of claim-backed comprehension targets but may not manufacture their conclusions;
- forward implication is part of the editorial lens, while all factual/analytical assertions remain claim-bound.

This is not a permanent doctrine for every future Desk format.

### Ensemble tuning

- The covered club is the shared object of concern that unites the desk and listener without synthetic claims of supporter membership or biography.
- Simon is an emotionally expressive supporter avatar and personality. He argues the supporter case directly when warranted, but he is not argumentative by nature.
- Gaz and Simon are warm complementary mates. Their friction is earned, not scheduled.
- Gaz is a thinker/listener/solver with dry, flat intellectual humor; his role is not serial stat delivery.
- "Gaz begins with IQ; Simon begins with EQ" is a design shorthand, not an intelligence hierarchy.
- Tully owns a real **closing synthesis** that decides what deserves to linger and points the listener toward what matters next. It has no fixed point count or surface template.

The Character Bible also explicitly removes fabricated life-history interpretation from Gaz's "maths teacher" lens. That is behavioral energy only, not biography.

## Build-1 consequences

No new service, queue, canonical lifecycle state, or mandatory dedicated table is required.

The coding-agent dry run must show how the existing immutable artifact/model-run mechanism and `script_version` lineage can represent:

- Craft Critic provenance/results;
- zero/one bounded substantive craft revision;
- relevant policy/version refs;
- retry/idempotency behavior for the new model call;
- cost accounting through existing provider/model provenance mechanisms.

A new storage abstraction is permitted only if the agent demonstrates why the existing mechanism cannot preserve the required lineage safely and simply.

## Build-2 consequences

The walking skeleton must prove this path:

```text
Evidence Package
  -> Showrunner Brief
  -> Script Pass 1
  -> independent Craft Critic
  -> zero/one craft revision
  -> speech-texture Pass 2
  -> Performance Direction
  -> deterministic/semantic audit
  -> Render Manifest
  -> TTS takes/selections
  -> clean master
  -> validation
```

The craft loop stays inside `SCRIPTED`. It cannot waive claims, rights, silent-input rules, provenance, implied-access controls, incident/sombre policy, or the no-counterfeit-membership boundary.

Fixture v0.4 adds negative vectors for critic fact invention, Good Thing x50, visible educational signposting, detached Simon, repetition-count controls, stat-vending Gaz, and flat/formulaic closing synthesis.

## Existing v1.1 closure remains in force

The prior implementation-readiness and S1/ADR-003 closures remain unchanged, including:

- TypeScript on maintained Node.js LTS;
- automatic take-0 approval after technical validation;
- no per-render-block human approval queue;
- subjective acoustic dissatisfaction routed through Operator Repair;
- bannered legacy hazards;
- canonical episode-mode registry;
- durable READY pre-publish review wait/resume with timeout-to-halt;
- `approve | request_repair | halt` launch review outcomes;
- earliest-layer Operator Repair with one confirmation and immutable history.

## Final sequence

```text
locked corpus v1.2
-> coding-agent dry run (no code)
-> human adjudication of implementation choices
-> Build 1
-> Build 1 review
-> Build 2 walking skeleton
-> measure
-> revise
```

Do not run another general architecture red team before coding. The next meaningful step is executable conformance plus the coding-agent dry run.
