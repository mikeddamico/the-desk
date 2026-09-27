# The Desk - Coverage Commissioning & Knowledge Readiness v0.1

**Status:** Skeleton-grade implementation spec  
**Date:** Sep 26, 2026  
**Depends on:** Technical Architecture v1.0 + ADR-001, Claims Policy v0.1, Ingest & Evidence v0.2, Lore Pipeline revision  
**Primary implementation stage:** Build 3 - One entity Coverage Commissioning  

## Authority and precedence

This spec implements the commissioning decision in ADR-001 without reopening the accepted six-layer architecture.

Where this spec conflicts with older Lore Pipeline v0.1 or Ingest & Digest v0.1 behavior, Technical Architecture v1.0 and ADR-001 govern. In particular:

- fixed press/fan source counts are no longer universal launch rules;
- source priority is not the same as factual authority;
- latent model knowledge is not canonical evidence;
- routine ingest may nominate durable enrichment but may not silently promote it;
- human-readable dossiers are derived views rather than systems of record;
- the writing model does not live-search for missing background.

## Purpose

Coverage Commissioning turns a new requested sport, competition, or entity from an empty product shell into a scope The Desk can cover responsibly.

The launch implementation focuses on football clubs. The interfaces are generic enough that later sport/competition commissioning can be added without pretending every sports object is a club.

The target outcome is not encyclopedic completeness. It is **coverage readiness**: enough verified sports knowledge, current context, media access, cultural competence, rights information, and retrievable depth that The Desk can plan and write from controlled internal knowledge plus fresh event evidence.

A club should not launch merely because a research call returned a long report.

## Governing principles

### Product-authorized knowledge starts at zero

For product purposes, Tully, Gaz, Simon, the planner, and the writer begin with no authorized knowledge of a newly requested entity.

The underlying models' pretrained memory may help formulate searches and hypotheses. It is never sufficient support for an on-air factual or culturally consequential assertion.

### Research is allowed to be expensive relative to routine generation

Commissioning is one of the places where spending additional tokens, calls, and a few dollars is justified. The work is amortized across future episodes.

The additional budget must be spent on breadth, depth, local-language work, retrieval, verification, adversarial challenge, source mapping, and gap finding rather than a single oversized generation call.

### Rigorous does not mean complete

Some omissions are structurally expensive: missing source coverage, rights metadata, provenance, pronunciation structure, competition semantics, sensitivity research, and durable entity identity.

Other omissions are ordinary knowledge gaps and can be enriched later. The system should prefer an explicit unknown to a weakly supported field filled for cosmetic completeness.

### Search upstream, not in writing

Commissioning and ingest may search/retrieve external material under policy. Program planning and writing use Desk-controlled knowledge and frozen package evidence.

### Canonical records first, dossier second

A Coverage Dossier is useful for Mike and operators, but it is generated from canonical records. Editing the dossier does not mutate canonical knowledge unless an explicit correction/research workflow does so.

### Ingest learns, but does not self-authorize permanent truth

Routine ingest can notice gaps and nominate enrichment. Durable promotion requires an explicit research/verification step.

## Commissioning scopes

The same commissioning contract supports three scopes.

### Sport scope

Eventually holds shared semantics that should not be rediscovered for every competition: rules, event phases, participant/result shapes, common terminology, meaningful statistics, authoritative governing bodies, and sport-specific verification quirks.

Football v1 may hand-seed much of this. Do not build a generalized sport ontology before needed.

### Competition scope

Eventually holds competition structure, schedule/rules, standings semantics, promotion/relegation or tournament logic, relevant official sources, competition-level baselines, and competition-specific data/media providers.

### Entity scope

For football v1 this is the main commissioning target: club identity, relationships, history, culture, media ecosystem, supporter context, pronunciation, sensitivities, baselines, current state, and explicit gaps.

## Commissioning lifecycle

A commissioning request moves through explicit states rather than one opaque research call.

```text
REQUESTED
    ↓
DISCOVERY
    ↓
EVIDENCE_DEEPENING
    ↓
MEDIA_MAPPED
    ↓
KNOWLEDGE_STRUCTURED
    ↓
ADVERSARIAL_REVIEW
    ↓
READINESS_EVALUATED
    ↓
READY | DEGRADED | NOT_READY
```

A `commissioning_run` records the scope, configuration/spec versions, research/model calls, cost, artifacts, reviewer/adjudication, and terminal state.

A failed or partial run may be resumed with a new attempt rather than overwriting history.

## Phase 1 - Discovery

The discovery pass is recall-heavy. Its job is to map what needs deeper investigation rather than decide final truth.

For a football club, discovery should look for at least:

- canonical entity identity and aliases;
- parent competition(s) and major relationships;
- official club/league/governing sources;
- structured data providers available for the competition;
- local and regional reporting;
- national/specialist reporting with regular entity relevance;
- tactical/statistical specialists;
- supporter publications, forums/communities, podcasts/radio, trusts or supporter groups where relevant;
- historical/reference sources;
- local-language search terms and naming variants;
- obvious rivalries and historical/cultural claims to investigate;
- current squad/manager/stadium/current-season context;
- pronunciation targets;
- sensitivity topics and anniversary candidates;
- likely knowledge gaps.

Discovery results are candidates, not canonical facts.

### Local-language requirement

Where meaningful local discourse is not predominantly in the listener's language, commissioning must search in the club/community language as well as the product language.

Translation must preserve the source-language locator so later audits can return to the actual evidence.

## Phase 2 - Deep evidence and structured knowledge

Important discovery candidates are investigated through actual evidence rather than model recall.

Commissioning should prefer atomic, provenance-bearing knowledge over prose summaries.

Examples of durable or slow-changing knowledge include:

- founding/identity;
- stadium and major moves;
- honours and defining eras;
- meaningful rivalries and their relative cultural weight;
- recurring cultural references and verified vernacular;
- historically important people/events;
- competition/entity relationships;
- sensitivity entries;
- pronunciation records;
- source/entity coverage profiles.

All speakable factual knowledge must ultimately resolve through the common claims/support model defined by Technical Architecture v1.0 and Claims Policy.

## Phase 3 - Media ecosystem mapping

The Desk should learn **how to cover the entity**, not merely what happened in its past.

### Source discovery

Candidate acquisition sources may include:

- official club/league/governing communications;
- local beat/regional reporting;
- national/specialist reporting;
- statistical/tactical analysis;
- structured data providers;
- press conferences/interview feeds;
- broadcast/replay analysis where rights/access allow;
- podcasts/radio;
- supporter publications;
- supporter forums/communities/social channels;
- historical/reference sources;
- business/off-field reporting.

### Source/entity coverage profile

A source is evaluated relative to the scope it covers. The same publisher may have different utility for different clubs or competitions.

The logical coverage profile should be able to represent:

```text
source_id
scope/entity_id
languages
acquisition_priority
coverage_domains
source_roles
reliability_or_authority_by_domain
independence_group / duplication risk
publishing_frequency
publishing_lag
acquisition_method
rights_version
health
vetting_state
last_reviewed_at
notes / known limitations
```

The first database implementation may use typed columns plus a constrained JSON field for low-volume domain ratings rather than prematurely normalizing every rating dimension.

### Priority is not authority

Never use a single scalar to mean both "we should routinely ingest this" and "we should believe everything it says."

Examples:

```text
Supporter podcast
  acquisition_priority: high
  supporter texture/culture: high value
  injury status: low authority
  transfer rumor: low authority / attribution required

Club official site
  acquisition_priority: high
  official status/lineup/transaction: high authority
  independent analysis: low value
  supporter sentiment: not representative
```

### Portfolio construction

Commissioning produces a working acquisition portfolio, not a permanent closed list.

Selection should optimize for coverage capability, independence, freshness, rights/access, and useful modality/role diversity. Fixed counts such as "4-6 press + 5-8 fan" may be used as initial football heuristics but are not product invariants.

The portfolio should answer:

- Can we verify basic event/status facts?
- Do we have meaningful independent reporting/analysis?
- Do we have enough supporter-native material to understand sentiment and cultural meaning?
- Are we over-dependent on one publisher or syndicated story?
- Are there important domains for which we have no legitimate ingest path?
- Can the sources actually be acquired within the intended post-event production window?

### Rights and access

Every routine acquisition source must have an applicable rights/access version before it is considered production-ready.

Commissioning records what the product is allowed to retrieve, retain, quote, paraphrase, expose to models, and use commercially. A source can be editorially valuable but operationally unavailable.

## Phase 4 - Baselines and current-state bootstrap

A new club should not begin its first episode as if the season started that morning.

### Seeded baselines

Where feasible, commission recent historical output sufficient to seed baseline expectations for:

- publishing rate and lag;
- coverage volume;
- beat/topic mix;
- supporter tenor range;
- source health/frequency;
- other source/lens norms used by ingest.

Recent periods matter more than old archives for publishing behavior because media habits change.

### Current-state bootstrap

Commissioning should establish the current context needed for the first production run, such as:

- current competition/season;
- manager/coaching leadership;
- current squad/roster and major status changes;
- recent results/form context where relevant;
- table/standing state;
- current major topic threads that are well-supported;
- recent durable club changes such as stadium/ownership/leadership changes.

Fast-changing information remains current-state knowledge and must not be mistaken for permanent lore.

## Phase 5 - Lore, culture, pronunciation, and sensitivity

The existing Lore Pipeline methods remain useful but become a subsystem of Coverage Commissioning rather than the owner of all spin-up.

### Lore/cultural method

Preserve the principle that different source classes are good for different kinds of claims. Historical/reference and official sources can establish many facts; supporter-native sources are often necessary to establish cultural weight, vernacular, grievance, or emotional importance.

Culture is sourced or absent.

### Pronunciation

Commission the canonical pronunciation set required for current coverage: club, stadium, manager/staff names likely to be spoken, current squad/roster, and recurring competition/place names where needed.

Provider/voice-specific renderings remain downstream derivatives of canonical pronunciation versions.

### Sensitivity

Run explicit recall-first searches for material where omission creates disproportionate risk: tragedies, deaths, discriminatory abuse, politically/ownership-sensitive topics, abusive nicknames/chants, and important anniversaries.

An empty sensitivity list means "checked and none found," not "not researched."

## Phase 6 - Adversarial and gap review

The primary research process must not be the sole judge of its own completeness.

Commissioning performs at least these independent challenge modes:

### Evidence retrieval challenge

For important claims, return the supporting source/evidence locator. Unsupported items are demoted, contested, or removed according to Claims Policy.

### Adversarial factual challenge

A distinct model/provider where practical identifies the highest-risk claims, unsupported leaps, source monocultures, and contradictions.

Do not use an artificial requirement to find errors where none exist as the final decision rule. The purpose is pressure testing, not manufacturing findings.

### Outsider/wince challenge

Ask whether the result contains culturally plausible but locally wrong framing: nominal rivalries treated as emotionally central, opposition nicknames presented as self-identification, stale tropes, or outsider assumptions.

### Missing-domain challenge

Explicitly ask what a knowledgeable producer would expect to know that the commissioning output does not yet cover.

Missing knowledge may remain a gap if it is nonessential. The important thing is that the gap becomes visible rather than silently hallucinated away.

## Phase 7 - Coverage readiness evaluation

Coverage readiness is an evidence-backed assessment, not a boolean set by the drafting model.

Possible terminal states:

- `READY`: sufficient capability for the intended show;
- `DEGRADED`: launch may be possible with explicit known limitations and programming constraints;
- `NOT_READY`: the Desk cannot yet make the intended show responsibly.

### Readiness dimensions

The assessment should cover at minimum:

- **Entity identity:** Do we know who/what this scope is and its key relationships?
- **Event/status facts:** Can we reliably obtain authoritative current facts?
- **Independent analysis/reporting:** Do we have legitimate external perspective beyond official statements?
- **Supporter/cultural evidence:** Can we understand how supporters talk/feel without inventing it?
- **Data coverage:** Are the structured statistics needed by Gaz/the format actually available?
- **Rights/access:** Can production legally/operationally acquire and use the selected sources?
- **Pronunciation:** Are recurring names covered or visibly queued?
- **Sensitivity:** Has the recall-first sensitivity pass been completed?
- **Baselines:** Is there enough recent history to interpret unusual volume/tenor where the format depends on it?
- **Current-state bootstrap:** Can the first episode sound season-aware rather than born this morning?
- **Retrieval:** Can relevant stored knowledge actually be found later?
- **Known gaps:** Are material gaps explicitly represented?

### Coverage capability beats raw source count

A portfolio with many websites can still be weak if they all syndicate the same story or omit supporter-native/contextual material. A smaller but complementary portfolio can be stronger.

The readiness assessment should therefore use capability checks rather than a universal numeric source threshold. Show-specific coverage floors may still require particular lenses at package time.

### Independent readiness judgment

The same model run that assembled the commissioning output may not be the sole authority setting `READY`.

A separate evaluation pass or named human adjudication confirms the result. The implementation can be lightweight for one operator, but the provenance must exist.

## The Coverage Dossier

The operator needs an easy way to understand the commissioned scope without querying tables manually.

The system therefore generates a derived Coverage Dossier containing, as appropriate:

- scope identity and relationships;
- readiness state and last evaluation date;
- concise identity/history/culture summary;
- current competition/season state;
- source/media ecosystem and acquisition priorities;
- what each important source is trusted/useful for;
- rights/access limitations;
- pronunciation coverage;
- sensitivities;
- baseline state;
- known gaps and degraded areas;
- recent enrichment/correction activity;
- next review dates.

The dossier is regenerated from canonical records. It is not cited as factual support by the episode pipeline.

## Knowledge volatility and maintenance

Commissioning records or derives an expected volatility/review class. Initial classes may be simple:

```text
very_stable
slow
seasonal
fast
```

Examples:

- founding year: `very_stable`;
- rivalry/cultural weight: `slow`;
- source portfolio/baselines: `seasonal` or event-driven;
- manager/squad/current threads: `fast`.

Review cadence should follow volatility rather than rerunning the entire commissioning job on one schedule.

Maintenance triggers may include:

- source health degradation;
- source rights/access change;
- reporter/outlet move;
- newly discovered influential source;
- promotion/relegation or competition change;
- manager/squad turnover;
- venue/ownership/leadership change;
- repeated new terminology/cultural references;
- correction submission;
- enrichment candidates from ingest;
- scheduled slow/annual re-audit.

## Durable enrichment from ongoing ingest

The initial run will miss things. This is expected.

### Knowledge-gap candidate

When ingest sees evidence suggesting durable knowledge absent from the canonical layer, it may create a candidate such as:

```text
candidate_id
scope
candidate_kind
trigger_evidence_refs
reason
suggested_subject/predicate or research question
first_seen_at
recurrence_count
priority
status
research_run_id
resolution
```

Candidate kinds may include lore/history, relationship, pronunciation, sensitivity, source discovery, source-role change, rivalry/cultural weight, durable tactic/identity context, or other explicitly enumerated categories.

### Nomination rules

Nomination should be cheap and recall-oriented. Promotion should be stricter.

A candidate may gain priority when:

- multiple independent ingest windows surface it;
- it is repeatedly needed by planning;
- it affects accuracy/safety;
- it indicates a missing routine source;
- it repeatedly causes retrieval failure or manual intervention.

### Resolution

A scoped research job resolves the candidate into one of:

- accepted/promoted;
- rejected;
- contested;
- current-only/not durable;
- duplicate/already known;
- deferred.

All resolutions preserve provenance and reason.

### No silent promotion

An ingestion model may not directly edit canonical lore or durable source authority because a new article, podcast, or post claims something.

## Internal context retrieval for programming

Coverage Commissioning only pays off if programming can retrieve the right knowledge later.

Internal context retrieval is therefore a first-class package-construction step.

### Inputs

For a program attempt, retrieval may use:

- candidate beats from current/shared evidence;
- event/entity/competition/sport scope;
- participant identities;
- current topic-thread mappings where known;
- show format and allowed context classes;
- recency/validity requirements;
- context budget.

### Search universe

Retrieval may search Desk-controlled knowledge only:

- approved claims and supports;
- lore/history/culture;
- structured stats and desk derivations;
- prior-event/reference records;
- editorial continuity/topic threads;
- prior published predictions/positions;
- current-state projections where their underlying evidence can be frozen;
- season/competition context.

It does not browse the live web.

### Output: context candidates

The retrieval result is a bounded candidate set. Each item should include:

```text
claim/context reference
scope
confidence/current state
support/provenance references
validity/freshness
retrieval reason
candidate beat(s)
relevance score or rank
retrieval method/model/rule version
```

The retrieval reason is explanatory, not an editorial command.

### Retrieval is not programming

A context candidate's relevance score does not force inclusion.

The package builder freezes enough plausible context for the Showrunner to make a real choice without dumping the whole knowledge store into the planner prompt.

### Package boundary

Context retrieval must finish before Evidence Package freeze.

The frozen package records the selected candidate claims/items, their state-as-of-freeze, provenance, and retrieval-run version. If the Showrunner later wants a fact that is not in the package, normal production does not live-search around the boundary; the attempt must be repackaged/replanned.

## Showrunner Context Selections

The Showrunner selects a short list of packaged context that actually helps the episode.

Each selection belongs to a beat/block plan and records an editorial function. Initial functions to test:

```text
supports
challenges
complicates
rhymes
continuity
meaning
```

The planning spec may refine names or permit a constrained free-form explanation. These functions are editorial metadata, not claim/evidence taxonomy.

### Selection questions

For each candidate beat the Showrunner may ask:

- Is there a recent pattern that supports the apparent story?
- Is there a larger sample that undermines an easy narrative?
- Has this happened before in a genuinely useful way?
- Does current supporter feeling connect to an evidenced cultural/historical context?
- Does this continue or reverse a topic thread the show has already established?
- Is there a prior statement/prediction that creates useful tension?
- Is a historical analogy illuminating, or merely decorative trivia?

### Context budget

The brief should normally select only a few contextual items per substantive beat. More available knowledge does not justify stuffing the script with trivia.

The Showrunner should prefer context that changes understanding, sharpens disagreement, or gives emotional meaning.

### Character lenses

Evidence affinity can influence which context each participant naturally notices, but context is not exclusively assigned by character.

Gaz may naturally lead on statistical/tactical/historical-pattern context. Simon may naturally lead on supporter/cultural meaning. Tully may naturally lead on contradictions, prior statements, factual clarification, and synthesis.

The Showrunner may deliberately cross those defaults when the editorial logic is stronger.

## Data/interface concepts

Exact table design belongs to implementation, but the following logical contracts should exist.

### `commissioning_runs`

Minimum logical fields:

```text
id
scope_type / scope_id
purpose
spec_version
config_hash
state
attempt
started_at / completed_at
model/provider run refs
artifact refs
cost totals
reviewer/adjudication
failure/resume info
```

### `coverage_readiness_assessments`

```text
id
scope_type / scope_id
commissioning_run_id
evaluated_at
state: READY | DEGRADED | NOT_READY
dimension_results
known_gap_refs
constraints
reviewer / model_run
next_review_at
supersedes_assessment_id
```

### `knowledge_gap_candidates`

Use the lifecycle described above. Candidate records are append/history-friendly; resolution does not delete the trigger evidence.

### `context_retrieval_runs`

```text
id
program_attempt_id
input beat refs
scope refs
retrieval spec/version
query/rule/model manifest
candidate count
selected-for-package count
cost/latency
created_at
```

### `context_candidates`

May be rows or an immutable artifact owned by the retrieval run. They reference existing claims/knowledge objects rather than copying source text.

## Provenance and explainability

Six months later an operator should be able to answer:

- Why did we decide this club was coverage-ready?
- Which sources were considered important at launch and why?
- What did a source's rights/access policy allow at that time?
- Which commissioning evidence supported a lore/cultural claim?
- Was a knowledge item present at launch or added later?
- What ingest item triggered an enrichment candidate?
- Which research run promoted or rejected it?
- Why did the package retrieve this historical/context item for this beat?
- Why did the Showrunner select or omit it?

This is lineage, not a requirement to retain purged rights-bearing text forever. Hashes/tombstones follow the architecture's retention rules.

## Prompt-injection and source safety

Commissioning has broad web/search exposure and must assume source material is malicious or instruction-bearing.

Retrieved text is data, never instruction. Research agents may extract claims, links, quotes, and metadata from it, but source text cannot modify system/product/operator instructions, tool permissions, rights rules, or readiness criteria.

The Engineering Standards & Security spec owns implementation details such as sandboxing, tool permissions, logging/redaction, provider data retention, secret handling, and allow/deny policies.

## Cost, quotas, and failure control

Commissioning may have a deliberately larger budget than routine production but still needs:

- per-run spend visibility;
- bounded retry/research loops;
- provider quota awareness;
- cancellation/kill controls;
- checkpoint/resume rather than restart-all behavior;
- cost attribution by discovery, deep research, verification, and adversarial review.

A cost ceiling should fail to a resumable `DEGRADED`/incomplete run rather than silently skipping verification to hit budget.

## Evaluation suite

Before the first real club is marked READY, create a small commissioning evaluation set.

### Stored-knowledge retrieval test

Ask difficult but fair questions about the commissioned club with live browsing disabled. The system must return answers from stored claims/evidence or explicitly say the knowledge is absent.

The test should include easy facts, culturally sensitive questions, relationship/rivalry questions, source-ecosystem questions, and current-state questions.

### Provenance test

Randomly sample important answers and trace them back to actual evidence/support and rights metadata.

### Source-portfolio test

Simulate the loss of one or more priority sources. Determine whether coverage remains viable, degraded, or below floor. This exposes hidden single-source dependency.

### Cultural/wince test

Challenge the stored lore/terminology with a supporter-perspective review. Findings become research tasks, not automatic truth.

### Gap-honesty test

Include questions the commissioning pass intentionally does not know. The correct behavior is to surface the gap, not improvise from latent model memory.

### Context-retrieval test

Given a frozen historical/current beat, verify that relevant internal context can be retrieved with useful provenance and irrelevant trivia is not overwhelmingly ranked above it.

## Operator experience

The operator should be able to inspect:

- commissioning status and cost;
- readiness dimensions;
- source portfolio and health;
- rights-review warnings;
- unresolved knowledge gaps;
- recent enrichment candidates;
- due maintenance tasks;
- Coverage Dossier;
- context-retrieval traces during program inspection.

For the first implementation, this can be a simple admin view. Do not build a separate knowledge-management product.

## Build 3 done-when

Build 3 is complete for the first football club when:

1. A durable commissioning run exists with inspectable provenance/cost.
2. Canonical entity/relationship/current-state basics are present.
3. Lore/cultural claims have the required supports and review history.
4. The routine media/source portfolio is mapped with rights/access and entity-relative utility.
5. Seeded baselines exist where the launch format depends on them.
6. Pronunciation and sensitivity requirements meet launch minimums.
7. Material gaps are explicitly represented.
8. An independent readiness evaluation returns READY or an intentionally adjudicated DEGRADED state.
9. A derived Coverage Dossier can be regenerated from canonical records.
10. The stored-knowledge retrieval test works with live search disabled.
11. Re-running/resuming commissioning does not duplicate canonical records or overwrite accepted history silently.

## Build 4 handoff

Ingest & Evidence v0.2 must consume the commissioned source portfolio and rights policies, update source health/baselines, and emit knowledge/source candidates when it encounters plausible durable gaps.

It may not silently promote those candidates.

## Build 5 handoff

Evidence Package/Showrunner Planning must implement internal context retrieval before package freeze, then record a small set of Showrunner `context_selections` per beat where useful.

The writer still sees no live web.

## Open questions for implementation, not architecture

- Exact readiness dimension scoring format: pass/warn/fail vs richer typed results.
- Initial football heuristic for portfolio breadth after moving away from universal source counts.
- Whether context retrieval v1 is deterministic/keyword + SQL first, embeddings first, or a hybrid. Choose the simplest method that passes the retrieval evaluation.
- Whether enrichment candidates are individual rows or a generic review-queue abstraction shared with corrections. Prefer extending an existing coherent abstraction if it fits.
- Whether sport/competition commissioning v1 is hand-seeded configuration or uses the same research runner. Do not automate before another sport/competition requires it.

## What we are intentionally not implementing yet

- generalized automated commissioning for every sport;
- audio/video consumption solely to make commissioning richer;
- autonomous promotion of knowledge candidates;
- a vector database solely because context retrieval exists;
- a graph database solely because entities have relationships;
- a standalone knowledge-management service;
- human-original reporting or source outreach;
- writer browsing/search;
- encyclopedic completion targets.

## Summary contract

Coverage Commissioning establishes enough evidence-backed institutional knowledge that The Desk can cover a new scope from Antarctica without pretending the synthetic talent already knew it.

Ongoing ingest keeps that institutional knowledge alive by surfacing gaps and changes, but durable promotion remains controlled and auditable.

Programming later retrieves a bounded set of relevant internal context, freezes it into the Evidence Package, and lets the Showrunner decide which history, data, continuity, or cultural material actually helps today's story.

**Research discovers. Knowledge preserves. Retrieval proposes. Programming decides. Writing expresses.**
