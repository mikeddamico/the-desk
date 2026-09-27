# The Desk - Evidence Package v0.2

**Status:** Canonical package contract for the walking skeleton and automated package construction  
**Date:** September 26, 2026  
**Owner:** The Desk  
**Authority:** Technical Architecture v1.0 + accepted ADR-001 + Claims Policy v0.1 govern. This document supersedes Episode Input Package v0.1 wherever they conflict.

---

## 1. Purpose

The Evidence Package is the frozen factual and evidentiary boundary between shared sports knowledge and program-specific editorial work.

Its job is to answer:

> **For this program attempt, what does The Desk know, what evidence supports it, what may downstream systems use, and what was the state of that knowledge when programming began?**

The package is not the episode plan and it is not the writer prompt. It is the immutable source universe from which the Showrunner may program an episode.

The governing rule from Episode Input Package v0.1 survives in stricter form:

> **If a factual proposition is not supported by an allowed claim in the frozen Evidence Package, it cannot become a factual proposition in the program.**

This binds the Showrunner, writer, performance direction, auditor, and any later revision pass.

The package exists so that programming and writing can run without live search while still having enough verified event evidence, current context, continuity, and durable sports knowledge to produce a deep show.

---

## 2. What changed from Episode Input Package v0.1

The predecessor was a strong prototype seam, but several responsibilities have moved.

1. **Writer input.** v0.1 treated the package as everything the writing model receives. v0.2 makes it the maximum frozen evidence universe available to programming; the writer receives a bounded downstream view plus the Showrunner Brief.
2. **Planning boundary.** v0.1 mixed planning and evidence. v0.2 separates the immutable Evidence Package from the immutable Showrunner Brief.
3. **Evidence shape.** v0.1 centered press and fan streams. v0.2 represents heterogeneous evidence through modality, source role, evidence type, domain, confidence, rights, provenance, and derived lenses.
4. **Retention and exposure.** v0.1 was paraphrase-only and discarded source text. v0.2 stores refs + hashes in the package while rights-bearing bytes remain in the evidence layer; authorized exact excerpts can be materialized when rights/exposure allow.
5. **Historical truth.** v0.1 could lean on convenient current rows. v0.2 freezes immutable claims/evidence and state-as-of-package; mutable projections are never provenance targets.
6. **Durable context.** v0.1 supplied lore broadly. v0.2 retrieves relevant durable knowledge as bounded context candidates before freeze.
7. **Programming ownership.** v0.1 left beat selection to the writer. v0.2 gives the Showrunner ownership of beats, context, treatment, runtime, and participant approach.
8. **Signals.** v0.1 flags could encode show logic. v0.2 carries descriptive signals/conditions and leaves programming decisions downstream.
9. **Reuse.** v0.1 implied one package per episode run. v0.2 allows frozen packages to be reused by evaluation attempts and by production attempts when the factual universe has not changed.

The useful predecessor principle **absence is explicit** also survives. Missing expected material is represented with a typed reason, never silently omitted.

---

## 3. Boundary in the pipeline

```text
SHARED SPORTS KNOWLEDGE + INGEST + CONTINUITY
    media / data / durable knowledge / current state
                 |
                 v
        PACKAGE CONSTRUCTION
    show-specific selection + internal context retrieval
                 |
                 v
          EVIDENCE PACKAGE
          immutable + hashed
                 |
                 v
          SHOWRUNNER BRIEF
       editorial selection and plan
                 |
                 v
              SCRIPT
          no live searching
```

Package construction may use authorized internal retrieval over Desk-controlled knowledge. It may not ask the writer to browse for missing facts later.

The package reports what is known and allowed. The Showrunner decides what matters.

---

## 4. Governing principles

### 4.1 The package is a manifest, not a rights-bearing blob

The canonical package artifact stores stable internal references, hashes, frozen state, permissions, versions, and selection provenance.

It does **not** duplicate permanent copies of source excerpts, article bodies, transcripts, or other rights-bearing bytes. Those remain in `evidence_units` or the approved evidence storage surface.

### 4.2 Retention is not exposure

Keeping an evidence unit for provenance does not mean every downstream model may see it.

The package freezes exposure instructions separately for planner, writer, and auditor use. A model-facing view may resolve an authorized excerpt at execution time only if:

- the evidence unit still exists and its hash matches;
- the frozen rights/exposure policy permits that consumer to see it;
- current policy has not made the intended use invalid;
- the prompt assembler records the exact evidence refs/hashes it materialized.

### 4.3 The package freezes historical truth, not the world

The package records:

- immutable claim assertion hashes;
- claim state as of package freeze;
- effective usage class as of package freeze;
- support refs/hashes;
- evidence rights/exposure state used at freeze;
- relevant result/event evidence hashes.

Later corrections, supersessions, purges, or event-status changes do not rewrite the old package. They trigger revalidation or a new package when material.

### 4.4 Every factual route converges on claims

Event facts, lore, mood, Desk calculations, program history, incidents, rumors, and other factual propositions become speakable only through claims governed by Claims Policy v0.1.

The package may include contextual records that are useful for planning, but any fact that reaches spoken text must resolve to a packaged claim.

### 4.5 Package depth is bounded, not shallow

The package should contain enough depth to let the Showrunner find meaningful connections without browsing, but it is not a dump of the entire club knowledge base.

Internal context retrieval proposes a bounded set of relevant durable/context candidates. The Showrunner selects from that set.

### 4.6 The same semantic package should hash the same way

Construction is deterministic at the manifest boundary. Database row order, transient IDs, timestamps of execution, or presigned URLs must not make semantically identical packages hash differently.

---

## 5. Package lifecycle and identity

Package construction has a mutable staging phase and one immutable freeze event.

```text
candidate set
    -> BUILDING
    -> validate references / rights / claim state
    -> canonicalize
    -> hash
    -> FROZEN
```

After `FROZEN`, the manifest never changes.

If construction must change anything material, it creates a new package artifact with a new hash.

### 5.1 Logical identity

Conceptual fields:

```text
id                         durable internal ID
schema_version             evidence-package/2.x
package_hash               canonical content hash
created_at                 operational metadata; not semantic identity
selector_run_id            package-construction provenance
scope_hash                 canonical scope identity
manifest                   immutable canonical payload
```

`package_hash` is the content identity. `id` is the database identity.

A repeated construction that produces the same canonical payload may reuse the existing package by hash.

### 5.2 Package-to-run cardinality

An Evidence Package is not owned by a single `program_run`.

A `program_run_attempt` references an Evidence Package. Evaluation attempts may reuse the same package without creating fake publication runs. A production rebuild may reuse the same package when only downstream writing/rendering changes; a material evidence change normally creates a new package.

---

## 6. Canonical manifest shape

The exact storage representation may evolve, but the semantic sections below are canonical.

```text
manifest
  schema
  scope
  availability
  claims
  evidence
  beats
  signals
  context_candidates
  continuity
  silent_inputs
  sensitivities
  coverage_conditions
  source_attribution
  selection_provenance
  version_refs
```

The manifest is a graph of references and snapshots, not a prose briefing.

---

## 7. `scope`

The package must say exactly what programming scope it was built for.

Minimum concepts:

```text
show_id
scope_type                 event | events | time_window
entity_ids
competition_ids
event_ids / window
locale / output language context
target publication slot reference
scheduled default mode     informational only; actual mode belongs to Showrunner Brief
```

For v1 football, one post-match package will usually cover one resolved event and one primary club entity. The schema must not assume that forever.

Display names may be copied for readability. Any factual current-state property used on air still requires a claim.

---

## 8. `availability`: explicit absences and known gaps

Expected package components never disappear silently.

Each expected capability may be represented as:

```text
available
partial
absent
not_applicable
```

with a typed reason and source of the assessment.

Examples:

```text
supporter_evidence: partial - only two verified sources survived
independent_analysis: available
continuity: absent - first published episode for this show/entity
historical_context: available
licensed_tracking_data: not_applicable - provider not configured
```

Known commissioning gaps that matter to this episode may be included as warnings. They do not become facts merely because they are listed.

---

## 9. `claims`: the speakable factual universe

For every selected claim the package freezes at minimum:

```text
claim_id
claim_content_hash
kind
origin
subject refs / domain
value or stable value reference
frozen_state
frozen_state_hash / state event cursor
effective_usage_class
support_refs + support hashes
attribution requirement
freshness / validity information where applicable
```

The package does not recalculate permissions downstream. It freezes the effective result of Claims Policy at package time.

A planner or writer may make a claim more cautious than its permission, but may never promote it.

### 9.1 Compound and exact-value support

The package should expose claims at sufficient granularity to let writing link exact factual spans to exact values.

A claim that supports "strong favorite" does not implicitly support "70% favorite." A season summary does not automatically support every factual sentence contained in it.

### 9.2 Mutable projections are convenience only

Objects such as current standings, roster projections, or event participant projections may help package construction, but the frozen package points to immutable claims/evidence that establish the selected values.

---

## 10. `evidence`: provenance and exposure instructions

For every evidence unit needed to support or inspect packaged claims, store a reference snapshot such as:

```text
evidence_unit_id
content_hash
media_item_id / provider record ref
locator
speaker_entity_id if relevant
language
translation lineage if used
rights_policy_version
retention_class
source_role / evidence_type / modality
consumer exposure instructions
quote permission
paraphrase permission
```

The package does not store the excerpt body itself as canonical content.

### 10.1 Skeleton exposure modes

For each consumer, package construction may freeze an exposure mode:

```text
hidden
claim_only
paraphrase
exact_excerpt
```

Consumers initially are:

```text
planner
writer
auditor
```

These modes describe what representation may be materialized, not what may be said on air.

Quotation/paraphrase output permission remains a separate Claims Policy/right decision.

Examples:

- an exact official quote may be `exact_excerpt` for planner/writer/auditor and `quote_allowed=true`;
- a rights-limited article may be `exact_excerpt` for auditor, `paraphrase` for writer, `quote_allowed=false`;
- a silent market input may be `claim_only` for planner/writer and never quoted/paraphrased;
- a purged unit resolves only to tombstone metadata, never to substituted text.

### 10.2 No magical auditor bypass

The auditor may receive broader exposure than the writer only where rights/policy permit internal audit. Audit status does not override source rights.

---

## 11. `beats`: descriptive coverage subjects, not the rundown

A beat is what the evidence is about. It is not automatically a segment.

Package beats may carry:

```text
beat_id
label / stable topic identity where available
scope refs
member claim/evidence refs
coverage salience by versioned lens
current volume/baseline references
relevant descriptive signals
candidate selection score
```

The package may contain more beats than the eventual episode discusses.

The Showrunner owns:

- which beats become program blocks;
- which are quick hits, full discussions, context-only, or omitted;
- runtime allocation;
- topic-thread linkage where needed.

---

## 12. `signals`: descriptive measurements with versions

The package may freeze relevant descriptive outputs of ingest/knowledge systems, including:

- coverage salience;
- baseline comparisons;
- tenor readings;
- divergences;
- low-confidence mood indicators;
- low-stakes chatter tags;
- cold-start or source-health conditions where relevant.

Every signal that affects selection records the version of the lens/rule/baseline that produced it.

Show-specific editorial decisions such as ritual eligibility or "predictions due" do not belong in ingest signals. They are derived during package construction/planning from canonical records.

---

## 13. `context_candidates`: relevant durable knowledge before freeze

ADR-001 adds internal context retrieval before package freeze.

For each candidate beat, package construction may query only Desk-controlled knowledge and continuity to find a bounded set of potentially useful context.

Candidate families include:

- historical/lore claims;
- current-season patterns;
- prior meetings where genuinely relevant;
- Desk-derived statistical patterns;
- participant/player/manager history;
- competition context;
- topic-thread continuity;
- prior published predictions/positions;
- cultural or supporter meaning.

A context candidate must resolve to atomic claims/records. A Coverage Dossier paragraph, season capsule prose, prior Showrunner Brief, or old script is not itself factual support.

Minimum candidate fields:

```text
context_candidate_id
anchor_beat_id / query scope
claim / atomic record refs + hashes
retrieval_run_id
retrieval method/version
relevance score if used
relevance_reason
confidence / state summary
```

`relevance_reason` explains why retrieval proposed the item. It is not evidence and it does not decide that the item belongs in the episode.

The Showrunner later assigns editorial functions such as `supports`, `challenges`, `complicates`, `rhymes`, `continuity`, or `meaning`.

### 13.1 No live-web context retrieval

Internal context retrieval may search/query Desk-controlled stores only. If a missing piece requires new external research, it returns a gap/enrichment candidate or triggers an authorized upstream research path. It does not browse from inside planning or writing.

---

## 14. `continuity`: only things that actually aired

The package may include continuity records needed for programming:

- published topic threads and their recent occurrences;
- published participant positions;
- published predictions with structured predicates and settlement state;
- motifs/analogies/cold-open history where the continuity spec permits;
- prior episode references needed to avoid repetition or support Receipts.

Continuity inputs qualify only when attached to a published, non-withdrawn episode version under Editorial Continuity & Ledger rules.

Draft-only material never becomes package continuity.

---

## 15. `silent_inputs`

Silent inputs remain first-class packaged material because a model may legitimately reason from them while being forbidden to voice them.

Each silent input is represented as a claim with:

```text
effective_usage_class = silent
allowed consumers
support refs
purpose / calibration role
```

The package view must make the restriction conspicuous. Silent status is not buried in prose.

Any downstream spoken proposition influenced by a silent input still needs separate assertable/hedged support for what is actually said.

---

## 16. `sensitivities` and serious incidents

Relevant sensitivity entries and incident claims may be packaged when they can affect safe programming.

The package freezes:

- incident claim state;
- supporting high-authority evidence;
- sensitivity entry version/date applicability;
- any deterministic suppression condition already known.

The package does not choose the final episode mode. The Showrunner applies planning rules to the frozen incident/sensitivity state.

A later material incident/status change is a revalidation event.

---

## 17. `coverage_conditions`: evidence capability, not a hidden show decision

Coverage floor evaluation happens at PACKAGED, but actual episode mode is chosen at PLANNED. Therefore package construction emits **typed coverage conditions** rather than hiding the problem inside a boolean.

Initial examples:

```text
coverage_floor_ok
coverage_floor_marginal
missing_independent_analysis_leg
missing_supporter_evidence_leg
missing_verified_event_fact_leg
late_coverage
low_confidence_mood
```

Show configuration defines which capabilities a mode requires.

Rules:

1. If the available evidence cannot support **any permissible mode**, package construction halts the attempt.
2. If normal post-match coverage is invalid but another legitimate mode may be possible, the package freezes the condition and the Showrunner resolves it through mode/template selection.
3. A planner may never waive a factual/rights/safety absence merely to fill a slot.
4. The package records the exact rule/config version used to evaluate coverage.

This prevents the PACKAGED stage from accidentally making a programming decision before mode exists.

---

## 18. `source_attribution`: enough metadata to credit what was actually used

The package should preserve stable references to attribution metadata needed downstream, including where applicable:

```text
source / outlet display name
headline/title
byline where publication policy allows
canonical URL/provider reference
speaker identity for quotes
media item ID/hash
source/entity coverage profile version
```

Do not store temporary signed URLs or credentials inside the package.

Individual supporter identities are minimized or omitted unless an explicit publication policy permits naming them. Source credit does not mean every acquired item is listed in the final credits; publication assets derive credits from evidence actually used in the final script.

---

## 19. Selection provenance

A package must explain why its contents were available to programming.

Freeze/reference:

```text
selector_version
selector_run_id / model_run_id if model-assisted
candidate_set_hash
package_candidate_scores reference/hash
source/entity coverage profile versions
lens/baseline/signal versions
context_retrieval_run IDs
show coverage-requirement version
selection budget/config version
```

Where useful, store exclusion reasons such as:

```text
wrong scope
failed verification
rights unavailable
superseded
redundant support
below selection budget
context retrieval not relevant enough
```

The full candidate universe may live in relational selection records rather than be copied into the package manifest, provided the package references a frozen/hashable selection result.

---

## 20. Consumer-specific package views

The canonical package is not itself a model prompt.

A **package view** is a deterministic materialization for a specific consumer from the same frozen package.

### 20.1 Planner view

May include:

- all packaged candidate beats;
- relevant claims and support summaries;
- permitted evidence excerpts/paraphrases;
- context candidates;
- continuity;
- silent inputs where useful;
- coverage/sensitivity conditions.

The planner may organize and interpret but cannot create new evidence or promote permissions.

### 20.2 Writer view

The writer normally receives a narrower subset selected by the frozen Showrunner Brief:

- claims assigned to selected beats/blocks;
- selected context claims;
- permitted supporting evidence representations;
- relevant continuity;
- silent inputs only when explicitly required for a permitted reasoning task;
- the Showrunner Brief itself.

The package remains the maximum factual universe. The brief narrows it; the writer cannot expand it.

### 20.3 Auditor view

The auditor receives the frozen package plus brief/script/performance direction and the evidence representations needed to verify support, attribution, quote/paraphrase compliance, and source framing, subject to rights.

### 20.4 Prompt provenance

The actual bytes sent to any model are recorded by the prompt-manifest system:

```text
prompt/template/component versions
ordered package/claim/evidence refs + hashes
consumer view/version
non-rights-bearing instructions
rendered request hash
```

The Evidence Package does not duplicate that job.

---

## 21. Rights, purge, and tombstone behavior

### 21.1 One canonical rights-bearing surface

Rights-bearing evidence text/data lives in the evidence layer, not in package blobs.

### 21.2 Purge after package freeze

If evidence is purged later:

- the package manifest and hash remain unchanged;
- the evidence reference resolves to a compliant tombstone containing permitted provenance/hash metadata;
- historical explanation can still identify what evidence identity was used;
- exact source bytes may no longer be reconstructable.

### 21.3 Replay behavior

A replay must never resolve an old evidence ID to new/replaced content.

If a replay requires bytes that no longer exist or are no longer permitted:

- evaluation may continue only if its task does not require those bytes;
- production must halt/rebuild when the missing material is necessary to support intended use;
- the system must not silently substitute a new article, a current claim, or a regenerated summary.

Golden evaluation packages should use evidence whose rights permit durable retention.

---

## 22. Revalidation interaction

Package freeze is not publication authorization forever.

Before publication, revalidation compares frozen package state against the live world/system for material changes including:

- claim supersession, demotion, contest, expiry, or usage change;
- event/result/status correction;
- serious incident changes;
- source-rights changes or purge/tombstone affecting intended use;
- freshness horizon;
- other show-defined material current-state changes.

A hit does not mutate the package. It produces a typed halt/adjudication/rebuild outcome under architecture rules.

A rebuild that needs changed evidence creates a new package. A rebuild that only changes writing/performance may reuse the package.

---

## 23. Canonical serialization and hashing

`package_hash` must use the shared canonical serializer defined by Engineering Standards/architecture.

Conceptually:

```text
package_hash = sha256(
  "evidence-package-v2\n" + canonical_json(semantic_manifest)
)
```

The semantic manifest **includes** anything that could change the factual/permission universe, including:

- selected claim/evidence IDs + content hashes;
- frozen claim state/effective usage;
- rights/exposure instructions and policy versions;
- event/result evidence hashes;
- signals/lens/baseline versions that affect selection;
- context candidate identities;
- continuity identities;
- silent inputs;
- coverage/sensitivity conditions;
- selector and context-retrieval versions/refs.

It **excludes** operational metadata that does not change semantics, such as:

- database primary key;
- row insertion order;
- worker ID;
- request trace ID;
- generated presigned URLs;
- duplicate human-readable labels derived from canonical IDs;
- `created_at` if the same content would otherwise be identical.

Canonical arrays are ordered by a documented deterministic rule. Never rely on database default order.

---

## 24. Construction idempotency and partial failure

Package construction must be safe if it runs twice or stops halfway through.

Required behavior:

1. Candidate scoring/retrieval runs are separately identified and logged.
2. No package is considered canonical until validation + canonicalization + hash + durable store succeed.
3. A crash after package storage but before attempt linkage resumes by package hash rather than creating a semantically different duplicate.
4. Concurrent workers constructing the same semantic package converge on one hash/artifact.
5. No half-built package may be consumed by planning.

The initial implementation can achieve this with transactions/unique constraints and workflow idempotency. Do not add a distributed locking service solely for package creation.

---

## 25. Security and prompt-injection boundary

Evidence Package construction processes untrusted external content.

Rules:

- source text is always data, never instructions;
- package manifests never store secrets, cookies, auth headers, API keys, or signed URLs;
- source-provided instructions cannot change exposure modes, Claims Policy, tool permissions, or selection rules;
- any extracted markup/scripts are inert data;
- model-assisted selectors receive explicit system/operator instructions outside source-content fields;
- logs redact restricted evidence according to Engineering Standards;
- consumer views expose the minimum evidence needed for the job.

A package that contains a malicious article is still only a container of evidence refs/claims. It is never an executable instruction bundle.

---

## 26. Privacy and supporter evidence

Supporter evidence may contain usernames, personal stories, locations, or other PII that is irrelevant to the program.

Package construction should minimize that data before exposure:

- preserve the source/evidence identity needed for provenance;
- do not pass individual usernames to planner/writer by default;
- prefer aggregate tenor/cultural claims when the program does not need an individual post;
- retain exact personal detail only when policy/rights and editorial need justify it;
- ensure purge/deletion obligations apply to every materialized copy.

This is especially important because a source may be public on the web without making all personal details necessary to reproduce in a synthetic show.

---

## 27. Time, language, and translation lineage

The package must not create false precision through normalization.

Where relevant, freeze:

- canonical timestamp + source/event timezone context;
- original language;
- translated representation ID/version;
- translation model/provider/version where material;
- original evidence hash.

A translated claim/excerpt remains linked to the original evidence. Translation does not create a new independent source.

---

## 28. Operator/admin inspection

For a frozen package, an operator should be able to answer without reading database internals:

- What event/entity/window is this for?
- What claims are available to programming?
- What was each claim's frozen state and usage class?
- What evidence supports it?
- Which source/evidence bytes may planner, writer, and auditor see?
- What material is silent?
- What coverage legs are thin or missing?
- What context was retrieved and why?
- What continuity was available?
- Which selector/rules/models created the package?
- What was excluded and for what reason?
- Has any referenced claim/evidence changed or been purged since freeze?
- Which run attempts reused this package?

For v1 this can be a simple internal page or JSON inspector. Do not build a separate evidence-management product.

---

## 29. Worked example - illustrative only

The following is a synthetic shape example, not a real match record.

```text
package:
  schema_version: evidence-package/2.0
  scope:
    show: desk-spurs-postmatch
    primary_entity: tottenham-hotspur
    event: evt/example-spurs-opponent
    locale: en-GB

  availability:
    verified_event_facts: available
    independent_analysis: available
    supporter_evidence: partial
    continuity: available

  claims:
    c_result:
      kind: event_fact
      value: "Spurs lost 2-1"
      frozen_state: confirmed
      usage: assertable
      supports: [e_result_official, e_result_data]

    c_late_pattern:
      kind: desk_derived
      value: "four goals conceded after 75 minutes in six matches"
      frozen_state: confirmed
      usage: assertable
      supports: [derivation/late-goals-v3]

    c_supporter_mood:
      kind: mood
      value: "supporter reaction is angry but split on the manager"
      frozen_state: confirmed
      usage: hedged_only
      supports: [tenor/run-882]

    c_market:
      kind: analysis
      value: 0.63
      usage: silent
      supports: [market/provider-record]

  beats:
    b_control:
      label: "late loss of midfield control"
      evidence: [c_tactical_1, c_tactical_2, c_result]
      salience: high

  context_candidates:
    k1:
      anchor: b_control
      claim: c_late_pattern
      retrieval_reason: "recent same-phase pattern"
    k2:
      anchor: b_control
      claim: lore/example-historical-analogue
      retrieval_reason: "similar documented tactical adjustment"

  continuity:
    topic_thread: midfield-fatigue
    prior_published_position: gaz-position-31

  coverage_conditions:
    supporter_evidence: marginal

  evidence:
    e_report_1:
      hash: sha256:...
      rights_policy_version: rights-v14
      writer_exposure: paraphrase
      auditor_exposure: exact_excerpt
      quote_allowed: false

  selection_provenance:
    selector_version: package-selector-v3
    candidate_set_hash: sha256:...
    context_retrieval_run: ctr-204
```

The Showrunner can now decide that `c_late_pattern` supports the current beat, that the historical item merely rhymes with it, and that supporter mood needs cautious wording. The writer does not browse for another example if it wants one.

---

## 30. Walking-skeleton implementation profile - Build 2

The hand-seeded walking skeleton does **not** need automated ingest or sophisticated retrieval. It does need the real package boundary.

Build 2 must implement:

- immutable package artifact + schema version + content hash;
- event/entity scope;
- selected claims with frozen state/effective usage;
- selected evidence refs + hashes + rights/exposure instructions;
- silent input representation;
- explicit availability/absence;
- at least one durable-context claim/reference;
- consumer-specific materialization sufficient for planner/writer/auditor fixtures;
- tombstone-safe reference semantics;
- prompt-manifest linkage;
- reuse by an evaluation attempt;
- deterministic serialization tests.

The fixture should use evidence whose rights permit durable testing.

Automated package scoring/retrieval may be hand-authored in the fixture.

---

## 31. Full implementation profile - Build 5

Before automated package construction is considered complete, add:

- show-specific package candidate scoring;
- shared-ingest consumption without re-ingest;
- typed coverage-condition evaluation;
- automated internal context retrieval over Desk knowledge/continuity;
- candidate-set hashing and selection provenance;
- versioned lens/baseline/signal inputs;
- continuity retrieval from published-only views;
- source/entity coverage-profile versions;
- automated rights/exposure snapshotting;
- reproducible package construction under retries/concurrency;
- package inspector/operator view;
- metrics for package size, context depth, selector exclusions, and materialization cost.

---

## 32. Acceptance tests

At minimum, executable fixtures should prove:

1. **Hash determinism:** shuffled database/query ordering yields the same package hash.
2. **Frozen state:** a later claim-state event does not mutate the old package.
3. **Revalidation visibility:** the same later state event is detectable as a live-vs-frozen diff.
4. **No inline rights bytes:** the canonical manifest contains refs/hashes/permissions, not stored source excerpts.
5. **Exposure separation:** planner/writer/auditor receive only their permitted representations.
6. **Quote restriction:** `quote_allowed=false` cannot be bypassed by writer exposure to an exact excerpt.
7. **Silent representation:** a silent claim is conspicuous and cannot become a voiced claim without separate support.
8. **Tombstone replay:** a purged unit resolves to its tombstone and never to replacement content.
9. **Production missing-byte halt:** if necessary evidence bytes are gone before use, production does not silently improvise.
10. **Evaluation reuse:** two evaluation attempts can reference one package without creating publication identity.
11. **Rebuild reuse:** a downstream-only rewrite can reuse the package; a material evidence change creates a new one.
12. **Explicit absence:** missing supporter evidence carries a reason rather than disappearing.
13. **Coverage-mode interaction:** a condition that blocks normal mode but allows a legitimate alternate mode reaches planning as a typed condition rather than an unconditional package failure.
14. **Internal-only context:** context retrieval fixture uses Desk knowledge/continuity only, no live web.
15. **Atomic context support:** a dossier/summary cannot become direct spoken support without resolving to atomic claims.
16. **Selector provenance:** package shows which candidate set/rules/model version selected it.
17. **No-browse writer:** a writer prompted for an unpackaged fact must omit it rather than search or invent it.
18. **Idempotent retry:** package construction repeated after a crash converges on the same immutable artifact/hash.
19. **No secrets:** package validation rejects/strips credentials or presigned access tokens from canonical fields.
20. **Translation lineage:** translated evidence retains original evidence hash and translation/version provenance.

---

## 33. Metrics to measure, not assume

During the skeleton and first automated packages, record:

- canonical package byte size;
- planner-view and writer-view token sizes;
- number of claims/evidence units/beats/context candidates;
- percentage of packaged context candidates actually selected by Showrunner;
- package construction time/cost;
- evidence materialization failures;
- rights/exposure blocks;
- live-vs-frozen revalidation hit rate;
- how often the writer requests or attempts facts outside the package;
- how often important human-reviewed context existed in Desk knowledge but retrieval failed to surface it.

The last metric distinguishes a weak knowledge base from a weak librarian.

Do not set permanent caps before measuring real packages. Use configurable safety limits for runaway prompts/costs, then tune them from evidence.

---

## 34. What is intentionally deferred

Do not implement these merely because the package leaves room for them:

- vector database or graph database solely for context retrieval;
- cross-sport generalized ontology beyond the interfaces already represented;
- package delta/compression storage;
- live writer browsing;
- autonomous promotion of knowledge-gap candidates;
- generalized legal clearance engine;
- personalized per-listener evidence packages;
- permanent storage of every rendered consumer view;
- sophisticated semantic proof that a silent value did not influence wording;
- universal package-size optimization service;
- fully automatic multilingual quote translation for publication.

Use existing Postgres/object storage and simple retrieval mechanisms until measurement proves a new dependency is needed.

---

## 35. Dependencies and successors

This spec consumes:

- Technical Architecture v1.0;
- ADR-001 Coverage Commissioning, Durable Knowledge Enrichment, and Internal Context Retrieval;
- Claims Policy v0.1;
- Coverage Commissioning & Knowledge Readiness v0.1;
- Ingest & Evidence v0.2 once written;
- Lore Pipeline revision;
- Editorial Continuity & Ledger v0.1 once written.

It is consumed by:

- Showrunner Planning v0.1;
- Script/Writing v0.2;
- independent semantic audit;
- pre-publication revalidation;
- golden-set evaluation tooling.

Where an older Episode Input Package v0.1 or Script Spec v0.1 conflicts with this document, this document governs the evidence/package boundary.

---

## 36. Definition of done for Evidence Package v0.2

Evidence Package v0.2 is implementation-ready when:

- a frozen package can be serialized and hashed deterministically;
- every packaged factual claim carries frozen state, effective usage class, and support refs;
- evidence refs carry hashes, rights versions, and consumer exposure instructions;
- rights-bearing bytes remain outside the canonical package artifact;
- absence/coverage conditions are explicit;
- silent inputs are machine-readable;
- internal context candidates resolve to atomic Desk knowledge and are frozen before planning;
- planner/writer/auditor views can be materialized without live search;
- old packages survive later state changes without mutation;
- purged evidence resolves to tombstones rather than substituted content;
- package reuse works for evaluation/downstream rebuilds without creating publication identity;
- package construction is idempotent under retry/concurrency;
- all Build 2 acceptance tests have fixtures;
- Build 5 automation requirements have a clear owner and do not require the coding agent to invent package semantics.

At that point the Evidence Package is a real contract rather than a prompt-shaped bag of notes: rich enough to support deep programming, bounded enough to audit, and frozen enough to explain months later exactly what The Desk knew when it made the show.
