# The Desk - Architecture Decision Record 001

## Coverage Commissioning, Durable Knowledge Enrichment, and Internal Context Retrieval

**Status:** Accepted  
**Date:** Sep 26, 2026  
**Architecture baseline:** The Desk - Technical Architecture v1.0  
**Decision owner:** Mike D'Amico  

## Why this decision exists

Technical Architecture v1.0 correctly separates shared sports knowledge from programming and keeps live research out of the writing layer. It also already contains lore, source/entity coverage, baselines, pronunciation, sensitivities, continuity, and package-facing context.

A remaining architectural socket needed to be made explicit: when The Desk starts covering a new club, competition, or eventually a new sport, the product's synthetic talent begins from **zero product-authorized knowledge** about that subject. The underlying foundation models may have latent knowledge, but that latent knowledge is not The Desk's evidence and must not silently become on-air knowledge.

The Desk therefore needs a rigorous commissioning process that deliberately builds enough sourced, structured, current, and culturally competent knowledge that planning and writing can operate without live web searching. That process must continue learning after launch without turning ordinary ingest into an uncontrolled mechanism for rewriting canonical knowledge.

This is a structural addition to the accepted architecture, so it is recorded as an explicit architecture decision rather than silently editing v1.0.

## Decision

### 1. Coverage Commissioning is a first-class capability

A new sport, competition, or entity is not coverage-ready merely because its canonical row exists in `entities`.

**Coverage Commissioning** is the bounded research and calibration process that establishes that The Desk knows enough, from legitimate evidence, to cover the scope responsibly.

For the launch product, implementation is required only for football clubs/entities. The interfaces must cheaply support later sport-level and competition-level commissioning.

Conceptually:

```text
SPORT COMMISSIONING
    rules, event shapes, terminology, authoritative bodies,
    meaningful statistics, result semantics
            ↓
COMPETITION COMMISSIONING
    structure, schedule/rules, local media/data ecosystem,
    competition-specific context
            ↓
ENTITY COMMISSIONING
    identity, history, rivalries, culture, current context,
    source portfolio, pronunciation, sensitivities, baselines
            ↓
COVERAGE READY
            ↓
ONGOING INGEST + MAINTENANCE
```

Do not implement sport/competition automation now unless needed for football v1. Represent the scope in interfaces so adding another sport later is not modeled as a special kind of club.

### 2. Foundation-model memory is a research lead, never evidence

Pretrained model knowledge may suggest what to investigate. It may not become canonical sports knowledge merely because the model recalls it.

The allowed conversion is:

```text
model suspects X
    ↓
research retrieves evidence for X
    ↓
verification / rights / provenance checks
    ↓
structured Desk claim or knowledge record
    ↓
available to package construction and programming
```

If a factual or culturally consequential point matters to the show, The Desk must have an intentional route for supplying it.

### 3. Research may search live; writing may not

Research, commissioning, ingest, and authorized verification components may browse/search/query external providers according to rights and security policy.

The planner and writer operate from Desk-controlled artifacts. The writing model does **no live searching** in normal production.

The target flow is:

```text
EXTERNAL RESEARCH / INGEST
    may search and retrieve
            ↓
VERIFY + STRUCTURE + RIGHTS
            ↓
DESK SPORTS KNOWLEDGE
            ↓
PROGRAM-SPECIFIC CONTEXT RETRIEVAL
            ↓
FROZEN EVIDENCE PACKAGE
            ↓
SHOWRUNNER BRIEF
            ↓
WRITING
    no live search
```

### 4. Spend more inference at commissioning, but spend it on method

Commissioning is intentionally allowed a larger token/time/cost budget than routine episode generation because the work is amortized across future coverage.

The extra budget should buy distinct work: broad discovery, local-language research, deep retrieval, source-portfolio mapping, structured extraction, adversarial gap finding, verification, and independent challenge. It should not mean one enormous model call producing an authoritative encyclopedia.

Cost remains measured and bounded. A deeper research budget is a product choice, not permission for unbounded retries.

### 5. Canonical knowledge is structured; dossiers are derived views

The Desk does not create one giant prose "world model" as the system of record.

Canonical knowledge remains composed of structured, provenance-bearing objects such as entities, relationships, claims, lore, source/entity coverage, baselines, pronunciations, sensitivities, events, continuity, and current-state projections.

A human-readable **Coverage Dossier** may summarize what The Desk knows about a scope, including gaps and readiness. It is a derived operational view, not an independent source of truth.

This prevents the failure mode where the database, an old lore report, and a generated dossier disagree about which version is canonical.

### 6. Source priority and source authority are separate

Commissioning maps the media ecosystem and determines what The Desk should routinely consume.

A source may be high-priority for acquisition while authoritative only for a narrow kind of evidence. For example, a supporter podcast may be high-priority for supporter texture and cultural weight while low-authority for injury status. A club statement may be high-authority for an official status while poor evidence for independent analysis or supporter sentiment.

`source_entity_coverage` therefore represents an entity-relative coverage profile, including at minimum:

- acquisition priority;
- relevance to the entity/scope;
- evidence domains/roles it is useful for;
- reliability/authority by domain where useful;
- language;
- acquisition path and access/rights version;
- publishing frequency and lag;
- source health;
- vetting/review state.

Do not collapse these into one global source score.

Old targets such as a fixed number of press and fan sites are guidance from the article-heavy prototype, not universal launch rules. Coverage readiness is capability-based: can The Desk reliably obtain verified event facts, meaningful independent analysis/reporting, and adequate supporter/cultural evidence for the product it intends to make?

### 7. Commissioning must represent uncertainty and gaps

A rigorous spin-up produces both knowledge and explicit unknowns.

Readiness artifacts should be able to say that a domain is verified, partial, contested, weakly covered, or absent. The system should not reward a research model for filling every field.

Knowledge and source records should carry appropriate confidence, provenance, verification time, and expected volatility/review cadence.

### 8. Ongoing ingest nominates durable enrichment; it does not silently promote it

Routine ingest will discover facts, terminology, sources, cultural references, and historical context that the original commissioning pass missed or that became important later.

Ingest may create a `knowledge_gap_candidate` or `source_candidate` with the evidence that triggered it and a reason it appears durable or coverage-relevant.

Promotion follows a scoped research/verification process:

```text
ongoing evidence
    ↓
knowledge/source candidate
    ↓
scoped research + verification
    ↓
accepted → canonical knowledge/coverage profile
rejected → logged with reason
contested → stored with contested state
current-only → remains current-state evidence
```

Routine ingest must never silently rewrite lore, culture, source authority, or other durable knowledge merely because one new item mentioned it.

### 9. Internal context retrieval happens before Evidence Package freeze

The Showrunner should be able to use relevant history, lore, cultural context, season patterns, prior meetings, continuity, and desk-derived patterns to support, challenge, complicate, or contextualize today's stories.

However, Technical Architecture v1.0 requires every factual assertion available to programming/writing to resolve to the frozen Evidence Package. Therefore internal context retrieval belongs to **package construction**, before the package is frozen.

Conceptually:

```text
shared event/current evidence
    ↓
candidate beats
    ↓
INTERNAL CONTEXT RETRIEVAL
    queries Desk knowledge + continuity only
    no live web search
    ↓
bounded context candidates with provenance/confidence/relevance reason
    ↓
EVIDENCE PACKAGE FREEZE
    event evidence + allowed claims + context candidates
    ↓
SHOWRUNNER
    selects which context actually matters
```

The retrieval layer proposes. Programming decides.

A similarity score, embedding, or retrieval model must not itself decide that a historical analogy belongs in the show.

### 10. The Showrunner owns Context Selections

The Showrunner Brief gains an explicit per-beat `context_selections` concept.

A context selection identifies an allowed packaged claim/context item and its editorial function. Initial vocabulary to test includes:

- `supports`;
- `challenges` or `refutes`;
- `complicates`;
- `rhymes` / historical analogue;
- `continuity`;
- `meaning` / cultural significance.

These are planning labels, not evidence types. The final vocabulary belongs to the Showrunner Planning Spec and may remain extensible.

Example:

```text
Beat: Why did Spurs lose midfield control?

Primary evidence:
- current event/tactical claims

Context selections:
- six-match late-game possession trend → supports
- full-season late-goal record → complicates
- ongoing midfield-fatigue thread → continuity
- verified supporter context → meaning

Participant leads:
- Gaz: test pattern against the easy narrative
- Simon: explain why the narrative still feels true
- Tully: force distinction between symptom and cause
```

The writer may express the plan but may not invent historical/context facts outside the package.

## Architecture/interface additions

The following concepts are added or made explicit. Exact physical tables may be combined where implementation simplicity warrants it, but their identities and provenance must remain distinguishable.

- **`commissioning_runs`:** durable research/calibration run for a sport, competition, or entity scope, including model/provider/cost/provenance.
- **`coverage_readiness_assessments`:** versioned readiness result, capability checks, gaps, reviewer/adjudication, and next review.
- **`knowledge_gap_candidates`:** durable knowledge/source enrichment nominations discovered during ingest or operation.
- **`context_retrieval_runs`:** reproducible internal retrieval for a program attempt/beat candidate set, including query/rule/model version.
- **`context_candidates`:** bounded claims/context items proposed to package construction with provenance, confidence, relevance reason, and scope.
- **Coverage Dossier:** derived human-readable view of canonical records, readiness, source portfolio, current gaps, and review dates.

Where possible, existing v1.0 objects remain authoritative rather than creating parallel stores. In particular, accepted durable facts continue to resolve through the common claims/provenance model; this ADR does not create a second encyclopedia table.

## Build-order changes

The accepted v1.0 build sequence is amended as follows:

### Build 3 becomes: One entity Coverage Commissioning

For one football club, prove the commissioning path: identity/relationships, lore/culture, media ecosystem and source/entity coverage profiles, rights versions, seeded baselines, pronunciation, sensitivities, current-state bootstrap, explicit known gaps, and a coverage-readiness assessment.

The output should include a derived Coverage Dossier for operator inspection.

### Build 4 gains: enrichment nomination

Shared ingest/evidence must be able to nominate new durable knowledge/source candidates without auto-promoting them.

### Build 5 gains: internal context retrieval and Showrunner context selection

Before Evidence Package freeze, retrieve a bounded candidate set from Desk knowledge/continuity for the candidate beats. Freeze those candidates into the package. The Showrunner selects the small subset actually used for programming and records their editorial function in the brief.

### Build 10 remains the hardcoding test

A second entity should run through the same commissioning machinery primarily through data/configuration/research outputs, not new code paths.

## Spec-readiness changes

A new dependent spec is required:

**Coverage Commissioning & Knowledge Readiness v0.1**

It is required before Build 3. It owns the commissioning methodology, source/media ecosystem mapping, readiness/gap evaluation, maintenance/enrichment nomination, derived dossier contract, and commissioning provenance/cost rules.

Other successor specs are amended in responsibility:

- **Ingest & Evidence v0.2:** source candidate and durable knowledge-gap nomination; no auto-promotion.
- **Evidence Package v0.2:** internal context candidates and their provenance become freezeable package inputs.
- **Showrunner Planning v0.1:** per-beat context selection and editorial-function labels.
- **Lore Pipeline revision:** becomes one commissioning subsystem, not the orchestrator of all club spin-up.
- **Editorial Continuity & Ledger v0.1:** exposes continuity/context records to internal retrieval.
- **Claims Policy v0.1:** governs how retrieved lore/history/mood/desk-derived/context claims may be spoken.

## Evaluation requirements

Commissioning quality is evaluated by outputs, not completion flags.

The Coverage Commissioning spec must include tests such as:

- difficult retrieval questions answerable from stored Desk knowledge rather than latent model memory;
- source-portfolio capability/gap checks;
- rights/provenance completeness for routine acquisition sources;
- local-language and cultural-gap challenge where relevant;
- adversarial review by a model/provider distinct from the primary drafter where practical;
- supporter-wince / outsider-assumption review for club culture;
- explicit unknowns rather than forced field completion;
- context-retrieval tests proving that relevant knowledge can actually be surfaced later.

The same model or run that drafts the commissioning output must not be the sole authority declaring coverage readiness.

## Security and trust boundary

External media, search results, transcripts, social posts, and web pages remain untrusted data. Commissioning is a particularly broad research surface, so prompt-injection defenses and strict separation between retrieved content and operator/system instructions are mandatory.

Research access must also obey the same rights, secrets, logging/redaction, retention, and provider controls defined by Engineering Standards & Security.

## What this decision does not do

This ADR does not:

- create an original-reporting operation;
- allow synthetic characters to claim lived experience or attendance;
- require audio/video ingest for football v1;
- require encyclopedic completeness before launch;
- make every discovered fact permanent knowledge;
- make retrieval similarity an editorial decision;
- allow the writer to browse the live web;
- replace Evidence Package immutability;
- reopen the six-layer architecture.

## Consequence

Technical Architecture v1.0 remains the accepted baseline. ADR-001 is an accepted architectural amendment and governs only the explicit deltas above. A future consolidated architecture revision may fold the decision into the main document, but implementation should not wait for that editorial consolidation.
