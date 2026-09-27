# The Desk - Showrunner Planning v0.1.3

**Status:** ACTIVE - SKELETON-GRADE CANONICAL PLANNING SPEC  
**Date:** September 26, 2026  
**Owner:** The Desk  
**Authority:** Technical Architecture v1.0 + accepted ADR-001 govern. Evidence Package v0.2 defines the frozen factual universe; Claims Policy v0.1 defines what may legitimately be said. This spec defines what the program chooses to do with that material.

---

## 1. Purpose

The Showrunner is the programming layer between evidence and writing.

Its job is not to research, fact-check, or write dialogue. Its job is to decide:

- what this episode is about;
- which questions deserve airtime;
- which evidence and internal context make those questions richer;
- what each participant is best positioned to notice, test, challenge, or explain;
- how the episode should be structured for the selected mode and runtime;
- which recurring features genuinely earn a place;
- what should be left out.

The governing idea is simple:

> **Ingest describes. The Showrunner selects and shapes. The writer turns that plan into spoken conversation.**

For the launch product, the listener usually already knows the result. Planning should orient briefly, then prioritize why it happened, what mattered, what people are arguing about, how supporters are experiencing it, what changed, and what it means next.

The Showrunner Brief is the immutable output of this process. It is editorial direction, not new evidence.

---

## 2. Scope and precedence

This spec governs the PLANNED stage and the creation of `showrunner_brief_versions` and their planned program blocks.

It owns:

- actual episode mode and rundown-template selection;
- central question / editorial spine;
- beat selection, ranking, treatment, and ordering;
- topic-thread mapping;
- internal context selections from packaged context candidates;
- evidence and claim assignment to blocks and participant leads;
- participant analytical roles within each beat;
- runtime target and block budgets;
- recurring feature / ritual eligibility and placement;
- Receipts selection and placement;
- low-stakes cold-open topic selection where the mode permits it;
- closing-synthesis priorities and next-event setup;
- launch-format comprehension targets where configured;
- planning exclusions and rationale;
- programming constraints arising from sensitivities, incident state, and coverage conditions.

It does **not** own:

- live research or source acquisition;
- evidence extraction, verification, or claim creation;
- claim permissions, quote rights, or attribution policy;
- exact spoken wording;
- speech texture or disfluency;
- performance direction or provider syntax;
- TTS/render topology;
- advertising or distribution.

Where the old Script Spec v0.1 assigned planning decisions to the writer, this spec supersedes it. Writing Spec v0.2.2 owns only the writing responsibilities that remain downstream of the frozen brief. Writing Craft and Invisible Comprehension v0.1 defines the launch-format craft/comprehension standard and does not expand the planner's factual authority.

---

## 3. Pipeline boundary

```text
SHARED SPORTS KNOWLEDGE
    ↓
internal context retrieval
    ↓
EVIDENCE PACKAGE
    frozen factual universe
    ↓
SHOWRUNNER PLANNING
    select + shape + assign
    ↓
SHOWRUNNER BRIEF
    frozen editorial plan
    ↓
WRITING
    exact spoken words
```

The Showrunner receives a deterministic planner view of one frozen Evidence Package.

It does not browse the live web. It does not query latent model memory for facts. It does not fetch “one more source” because a useful angle occurs during planning.

If an essential factual or contextual item is missing, the planner may:

1. continue without it;
2. record a known gap;
3. request repackaging / authorized upstream research through the workflow;
4. halt if the missing capability makes every permitted mode invalid.

It may never route around the package boundary by searching on its own.

---

## 4. Governing principles

### 4.1 Programming is a choice, not a ranking dump

Coverage salience describes how much the evidence ecosystem is talking about something. It does not decide how much airtime the show gives it.

A loud story can be shallow. A low-volume official development can be decisive. A statistically obscure fact can unlock the entire match. A supporter argument can matter because of cultural meaning rather than article count.

The planner therefore considers multiple factors and records its reasoning. No one scalar silently becomes editorial judgment.

### 4.2 Facts come from the package; questions come from programming

The planner may create questions, contrasts, editorial functions, block purposes, and participant assignments.

It may not create factual propositions that are absent from the package.

“Was the midfield collapse really the cause?” is a programming question.

“They lost the midfield after the 70th minute” is a factual/analytical proposition and must already exist as an allowed packaged claim or be framed as attributed analysis supported by the package.

### 4.3 Context should change understanding

Historical, statistical, cultural, or continuity material earns a place when it:

- supports an apparent story;
- challenges an easy narrative;
- complicates a conclusion;
- rhymes with a genuinely useful precedent;
- continues or reverses an existing thread;
- gives evidenced cultural/emotional meaning.

Trivia is not depth merely because it is old.

### 4.4 Participant affinity is guidance, not segregation

Tully, Gaz, and Simon retain distinct analytical identities, but evidence is not owned exclusively by one character.

The planner should use affinities to create natural first-noticers and interpreters, then allow cross-examination.

### 4.5 The brief is not a hidden script

A Showrunner Brief should tell the writer what the episode is trying to do without writing the episode for it.

It should specify questions, evidence, tensions, context, participant leads, and block jobs. It should not contain polished dialogue, jokes, exact transitions, or provider instructions.

### 4.6 No filler

A quiet week should produce a tighter episode, not weaker material stretched to hit a clock.

Runtime follows worthwhile programming within the configured show band.

### 4.7 Uncertainty is programmable

Disagreement, ambiguity, missing evidence, contested claims, and low-confidence mood are not defects to smooth away. They can become the reason a question is interesting.

The planner may program uncertainty. It may not resolve uncertainty by invention.


### 4.8 Insight and implication must be claim-grounded

The launch format values insight and forward implication, but those labels do not create new authority.

The planner may identify a **question** that connects packaged claims, for example:

> What does this result change about the late-game-control question?

It may not write a new analytical conclusion merely because the conclusion would improve the episode.

When a planned insight or implication itself asserts a factual/analytical proposition, that proposition must already be represented by one or more permitted packaged claims. A `desk_derived` analytical claim, where used, must have been created and frozen upstream under Claims Policy.

The planner selects and arranges supportable insight. It does not originate sports analysis from latent model knowledge.

### 4.9 Launch comprehension is programming metadata, not a density target

For the launch post-event template, the planner may identify a small number of **comprehension targets**: important claim-backed questions/ideas that deserve enough runway to survive imperfect attention.

A comprehension target is not:

- a repetition count;
- a requirement to mention a fact N times;
- an "insights per minute" score;
- a reason to compress more beats into the runtime.

The writer decides how to realize the target naturally; the independent Craft Critic evaluates whether the resulting conversation is resilient and non-formulaic.

This is a launch-format policy, not a universal property of every future Desk show.

---

## 5. Planner input contract

The planner view of Evidence Package v0.2 may contain:

- program scope and show configuration references;
- candidate beats and descriptive coverage scores;
- packaged claims and frozen state-as-of-freeze;
- support summaries and permitted evidence representations;
- versioned signals, tenor, and divergences;
- internal `context_candidates`;
- published-only continuity and topic-thread state;
- silent inputs where explicitly useful for permitted planning/calibration;
- sensitivities and serious-incident claims;
- typed coverage conditions;
- source-attribution metadata;
- availability/gap information;
- selector and context-retrieval provenance.

The planner also receives versioned programming configuration:

```text
show_id / show_version
rundown_template registry
allowed episode modes
target runtime bands
feature definitions + cooldown rules
participant profile versions
structured evidence affinities
interpretive dispositions
planning policy version
```

The canonical Showrunner Brief stores references and editorial metadata. It should not become another permanent store of rights-bearing source excerpts.

---

## 6. Showrunner Brief: canonical shape

A brief is immutable and belongs to exactly one package version and planning attempt.

Minimum conceptual shape:

```text
showrunner_brief_version_id
program_run_id / attempt_id
purpose: production | evaluation
evidence_package_id
package_hash
show_version
planning_policy_version
planner_model_run_id
created_at

selected_mode
rundown_template_version_id
runtime_target
central_question
orientation_job
programming_constraints[]

selected_beats[]
program_blocks[]
context_selections[]
topic_thread_mappings[]
feature_selections[]
continuity_instructions[]
planning_exclusions[]
known_gaps[]
comprehension_targets[]?     # launch-format structured editorial metadata

brief_hash
revision_parent_id
revision_reason
```

The canonical brief should be normalizable to structured data. Human-readable rendering is a view over the same object.

A brief may contain concise editorial prose such as “Gaz tests whether the collapse is really recurrent.” That prose is instruction, not factual support.

### 6.1 Canonical brief hash

`brief_hash` is a semantic content hash, not a database-row hash.

```text
brief_hash = sha256(
  "showrunner-brief-v1\n" + canonical_json(semantic_brief)
)
```

The semantic projection includes the package hash, show/planning policy versions, selected mode/template, runtime target, central question, orientation job, constraints, selected beats, program blocks, context selections, topic-thread mappings, feature selections, continuity instructions, planning exclusions, known gaps, optional comprehension targets, and revision parent content identity where applicable.

It excludes bookkeeping/operational fields such as database IDs used only for storage, planner model-run ID, worker/request IDs, and `created_at`.

The shared canonical serializer is defined by Engineering Standards & Security. Do not hash the whole persistence row for convenience.

---

## 7. Mode and rundown-template selection

The `program_run` may carry a scheduled default mode. The **actual** episode mode is chosen here, from the frozen package.

Inputs include:

- incident claim state;
- sensitivity entries applicable to the publication date/scope;
- typed coverage conditions;
- show configuration;
- available rundown templates.

Rules:

1. A confirmed in-scope serious incident that requires sombre handling forces the configured sombre mode or equivalent suppression behavior.
2. The planner cannot “override” the incident by choosing a jaunty template. Changing incident state requires evidence upstream.
3. A coverage condition may invalidate one mode without invalidating every mode.
4. The planner may only select a configured/versioned mode-template combination.
5. If no allowed mode can be supported by the available evidence and safety constraints, planning halts.

Mode selection is stored with the exact package claim/condition refs that justified it.

### 7.1 Coverage-floor interaction

PACKAGED reports capabilities; PLANNED resolves them against a mode.

Example:

```text
package condition:
    missing_supporter_evidence_leg

normal template:
    requires supporter texture → invalid

configured short factual/sombre template:
    does not require supporter mood → potentially valid
```

The planner may choose a legitimate alternative mode/template. It may not invent supporter sentiment to make the normal template work.

---

## 8. Candidate beats and beat selection

A `beat` is a descriptive subject emerging from evidence. It is not automatically a segment.

The Showrunner selects a small program from the candidate set.

For each beat, planning should consider at least:

```text
coverage_salience          how prominent it is in the evidence ecosystem
consequence                what changed / what is at stake
explanatory_value          whether it helps explain why the event unfolded
argument_value             whether credible evidence supports useful tension/disagreement
supporter_meaning          whether it materially affects supporter experience
continuity_value           whether it advances/reverses a running thread
context_payoff             whether durable knowledge makes it more revealing
novelty                    whether the show has already exhausted it
source/evidence_strength   how defensible the available treatment is
next_value                 whether it changes what matters next
```

These are factors, not a universal formula.

If implementation uses a `selection_score`, it must retain the factor inputs/rationale and score version. The score ranks candidates; it does not replace the planner's editorial choice.

### 8.1 Selection budget

The launch post-event show should normally have:

- one central question / primary beat;
- one or two substantive secondary beats;
- optional quick hits where warranted;
- only as many additional beats as the configured runtime can serve properly.

A larger candidate set is evidence of a rich week, not an obligation to mention everything.

### 8.2 Omission is explicit

For high-ranking or potentially important candidate beats that are not selected, the brief should retain a short exclusion reason where useful:

```text
redundant with primary beat
weak support
already exhausted in recent episodes
interesting but low consequence
cannot treat safely within current evidence
held for later follow-up
outside runtime budget
```

This makes model drift and recurring selection bias inspectable.

### 8.3 Structured planning exclusions

`planning_exclusions[]` is structured. It is not a bag of prompt prose.

Minimum shape:

```text
planning_exclusion:
  exclusion_id
  scope_type: beat | claim | evidence | feature
  scope_ref
  effect: omit_from_programming | forbidden_to_writer | attribution_only
  source: planning_choice | package_policy | claims_policy
  reason_code
  rationale?              # concise, non-factual
```

A `forbidden_to_writer` claim/evidence exclusion may only carry forward a restriction already established by the frozen package or Claims Policy. The Showrunner cannot invent a new permission or expose restricted material by changing this object.

The writer-view builder enforces these refs structurally. It does not rely on a natural-language sentence such as "do not mention X" inside the model prompt.

---

## 9. Central question and editorial spine

Every normal analytical episode should have a central question that organizes the show.

Good central questions are:

- contestable rather than rhetorical;
- grounded in packaged evidence;
- broad enough to connect multiple beats;
- narrow enough to answer or sharpen in one short episode;
- consequential beyond merely restating the score.

Examples of shape, not factual content:

```text
Was this defeat a tactical problem or the latest symptom of a deeper pattern?
Did the manager's change solve the problem, or merely survive it?
Why does the supporter reaction feel larger than the result itself?
What changed here that should alter expectations for next week?
```

The brief may also record an `editorial_spine`: a short internal statement of what progression the episode should make.

Example:

```text
Orient quickly → test the obvious explanation → introduce the counter-pattern →
show why supporters still feel the obvious story is true → end on what must change next.
```

The spine is structure, not a predetermined verdict.

---

## 10. Internal context selections

ADR-001 context retrieval happens before package freeze. The planner chooses from those frozen candidates.

Each context selection should record:

```text
context_candidate_id
anchor_beat_id / block_id
atomic claim/record refs
editorial_function
selection_reason
participant_lead(s) if useful
```

Initial editorial functions:

```text
supports
challenges
complicates
rhymes
continuity
meaning
```

These are programming labels, not evidence taxonomy.

### 10.1 Context-selection test

A context item should normally survive only if removing it would make the episode less accurate, less surprising, less intelligible, or less meaningful.

“Interesting fact” alone is insufficient.

### 10.2 Context budget

For a substantive beat, default to a few high-value context selections rather than a history dump.

The launch target to test is roughly **0-4 context items per substantive beat**, with zero being completely acceptable.

This is a tuning assumption, not permanent architecture.

### 10.3 Historical analogy discipline

The planner must distinguish:

- a true analogue that explains a pattern;
- a useful contrast;
- decorative coincidence.

“Same opponent, same month, twenty years ago” is not automatically meaningful. The context candidate needs a real editorial function.

---

## 11. Topic threads and continuity

Current beats are short-lived. Topic threads provide durable editorial identity across episodes.

For every substantive selected beat, the planner should:

1. map it to an existing packaged `topic_thread` where the subject is genuinely the same ongoing story; or
2. propose a new topic thread when the current story is likely to recur and no existing thread fits.

The brief freezes that mapping.

Examples of durable thread shape:

```text
midfield-control-under-pressure
manager-selection-trust
late-game-collapse-pattern
supporter-board-relationship
```

Names are internal labels, not claims.

The planner must not force unrelated beats into a thread merely to manufacture continuity.

### 11.1 What continuity may do

Continuity can:

- remind the show of a prior published position;
- create a genuine reversal or “we said this before” moment;
- surface a due prediction for Receipts;
- prevent repeated tangents/analogies/features;
- show that a once-dominant concern has cooled or intensified.

Draft-only history never qualifies.

---

## 12. Participant leads and evidence assignment

The Showrunner assigns **who naturally leads, tests, or responds to each part of the argument**.

It does not assign lines.

### 12.1 Tully

Natural first responsibilities:

- factual orientation;
- the listener's question;
- contradiction between claims/participants;
- source/uncertainty clarification;
- transitions, redirects, synthesis, and timekeeping;
- forcing a distinction when Gaz and Simon are answering different questions.

### 12.2 Gaz

Natural first responsibilities:

- structured data and statistics;
- tactical/specialist analysis;
- historical patterns;
- larger-sample counterexamples;
- method and causal explanation;
- precise correction of an overbroad narrative.

### 12.3 Simon

Natural first responsibilities:

- supporter sentiment and texture;
- emotional consequence and anxiety/hope/indignation where the evidence supports it;
- cultural meaning;
- why a technically small issue feels enormous;
- the supporter case for/against a club decision;
- the questions supporters are pressing the manager/team with;
- making an abstract analytical point matter in supporter terms without inventing personal attendance, biography, or collective membership.

The planner should not write Simon as a detached sentiment reporter. It assigns him the supporter-side stakes and evidence; the Writer supplies the personality and heat within those boundaries.

### 12.4 Affinity, not exclusivity

The brief may deliberately cross the defaults.

Examples:

- Simon may carry a statistic when it proves why a grievance feels justified.
- Gaz may begin from supporter evidence when his job is to test whether the feeling matches the pattern.
- Tully may carry historical context when it sharpens the central question.

What the planner must avoid is identity drift: Simon becoming the primary statistical analyst, Gaz becoming the source of unsourced crowd emotion, or Tully repeatedly deciding the argument rather than hosting it.

### 12.5 Assign evidence before assigning a conclusion

Prefer instructions like:

```text
Gaz: test whether the late-collapse narrative survives the larger sample.
Simon: make the supporter case for why another late wobble still feels intolerable even if the season number complicates it.
Tully: force the distinction between repeated symptom and root cause.
```

Avoid:

```text
Gaz: say the fans are wrong.
Simon: insist the manager must go.
```

The former creates an argument from evidence. The latter manufactures a take.

---

## 13. Program block plan

The selected rundown template defines available/required structural slots. The Showrunner fills those slots.

Each planned block should minimally carry:

```text
program_block_id
block_type
sequence
job
selected_beat_ids[]
primary_question if applicable
topic_thread_ids[]
claim/evidence assignments[]
context_selection_ids[]
participant_leads[]
required_cautions / attribution notes
feature_definition/version if applicable
target_duration_or_words
transition_goal
```

The `job` should be editorial, for example:

```text
orient
frame central question
test explanation
present supporter consequence
complicate with counter-pattern
quick hit
receipt
closing synthesis
predict
sign off
```

Do not include render topology, TTS batch shape, provider tags, or performance directions.

---

## 14. Runtime and block sizing

The launch target remains a short post-event show, currently roughly 8-12 minutes, but runtime is a show configuration rather than a permanent editorial law.

The Showrunner chooses a target inside the configured band from the amount and quality of worthwhile material.

Principles:

- quiet weeks shorten;
- big weeks may use the upper band;
- a serious/sombre mode may intentionally shorten;
- a recurring feature does not justify squeezing out the best story;
- one deep argument is better than three underdeveloped ones;
- orientation should remain brief when the audience likely knows the result.

The planner sets **budgets**, not exact final word counts. Writing may vary within configured tolerance.

### 14.1 No false precision

Do not pretend a model can reliably know that a block “needs 347 words.”

Use coarse targets/bands such as:

```text
very short
short
standard
deep
```

or configured word/time ranges where implementation needs numbers.

---

## 15. Recurring features and rituals

Feature eligibility belongs to programming, not ingest.

The package may contain the evidence, continuity, prediction settlement, and descriptive signals needed to evaluate a feature. The Showrunner applies the versioned feature definition.

For each feature selection, record:

```text
feature_definition_version
eligibility evidence/continuity refs
cooldown check
selected block/placement
replace_or_add behavior
selection reason
```

### 15.1 Launch football rules

The current football desk has feature definitions for:

- The Receipts;
- Geek of the Week;
- Sport Court;
- A Small Request.

Their full character/format definitions live in the Character Bible and future versioned feature registry. This planning spec owns eligibility/placement, not their scripted wording.

### 15.2 Receipts

Receipts uses only published predictions that are settleable and eligible under the Continuity spec.

The Showrunner decides:

- whether the settled prediction is notable enough;
- whose prediction is used;
- where it best serves the episode.

It should frame or pay off a real question, not delay the best story merely because a prediction exists.

### 15.3 Feature restraint

No trigger means no feature. A plain episode is a successful outcome.

Feature frequency/cooldowns are versioned show rules, not generated whims.

---

## 16. Opening, orientation, and cold open

For the launch normal-mode template, planning distinguishes three jobs:

1. **low-stakes cold-open topic** where enabled;
2. **orientation** to the result/situation;
3. **distillation into the central question**.

### 16.1 Cold-open topic selection

The Showrunner may choose from packaged low-stakes material and permitted continuity.

It should be:

- genuinely low stakes;
- not the central match argument;
- safe under current sensitivity/mode rules;
- not a repeated recent tangent;
- capable of revealing relationship/character rather than merely reciting trivia.

The planner chooses the topic and why it is usable. The writer invents the conversational exchange within factual boundaries.

Sombre/serious modes may suppress the cold open entirely.

### 16.2 Orientation

The planner identifies only the minimum facts needed to orient the listener before analysis begins.

Do not spend half the show retelling an event the audience likely already knows.

---

## 17. Closing synthesis and predictions

The launch wrap slot is internally treated as **closing synthesis**.

It should answer, where the evidence supports it:

- what deserves to linger from the central question;
- what changed, if anything;
- what remains unresolved;
- what becomes worth watching next;
- which insight/implication is worth one final natural reinforcement.

The Showrunner specifies the **job and permitted claim set**, not the prose and not a fixed recap checklist.

A closing-synthesis block may carry:

```text
job: "leave the late-control question open, connect the supporter relief to the recent pattern, and point toward the next late-lead test"
supporting_claim_refs[]
comprehension_target_refs[]
forward_horizon
callback_candidates[]?       # only from permitted continuity/current script context
```

Do not require a fixed number of takeaways, fixed joke, fixed speaker callback, or fixed "three things" structure. Audience-facing naming is deferred.

The Showrunner may separately specify a prediction task/target where the template includes predictions, for example:

```text
next match result
qualification outcome
selection decision
player/manager milestone
```

The planner provides allowed premises/calibration inputs. It does **not** invent the participant's prediction result. The exact prediction and wording are Writing outputs and later become continuity records only if published.

Silent inputs may inform prediction calibration only where Claims Policy permits. They never become spoken prediction evidence by implication.

---

## 18. Sensitivity, uncertainty, and programming constraints

The brief must carry forward relevant restrictions rather than expecting the writer to rediscover them.

Examples:

```text
confirmed serious incident → sombre template / suppress humor/features
low-confidence supporter mood → no broad “the fanbase thinks” assertion
contested historical claim → use only as contested, if used at all
single-source rumor → attributed/hedged treatment only
active legal/disciplinary issue → use only permitted packaged status/reporting
```

The Showrunner may choose **not** to program a legally/ethically delicate beat even when Claims Policy technically allows a careful mention.

Permission to say something is not an obligation to say it.

---

## 19. Source diversity and editorial monoculture

A curated source registry does not eliminate source bias.

The planner should be able to see when a selected beat rests overwhelmingly on one publisher, one supporter community, one data provider, or a cluster of copied/syndicated reports.

Selection should prefer independent support where it materially improves confidence or argument quality.

However, do not create a fake “both sides” requirement. One side having substantially stronger evidence is a legitimate state of the world.

### 19.1 Salience can hide important low-volume facts

The planner must explicitly consider:

- official status changes;
- confirmed incidents/sensitivities;
- material corrections/supersessions;
- decisive structured event facts;
- high-consequence low-volume developments.

These may deserve attention even when coverage volume is small.

---

## 20. What the Showrunner may create

The planner may create programming metadata such as:

```text
central question
editorial spine
selection/exclusion rationale
block job
participant lead
context editorial function
transition goal
topic-thread proposal
feature placement
runtime budget
```

These are not factual claims.

The planner may **not** create:

- a new score, statistic, historical fact, quote, injury/status, rumor, or supporter mood;
- a new source attribution;
- a new interpretation presented as externally established fact without a packaged analytical claim;
- first-person experiences or access;
- rights permission;
- a stronger usage class;
- evidence not in the package.

If generated editorial prose accidentally introduces a factual proposition, normalization must convert it to refs or reject it rather than canonizing the sentence as evidence.

---

## 21. Brief normalization and rights-bearing text

Planner model output is not automatically the canonical brief.

The planner may have seen permitted bounded evidence at runtime. Its raw output can therefore accidentally echo source wording.

Before storing the canonical brief:

1. parse/validate against the brief schema;
2. replace factual prose with claim/evidence refs where possible;
3. keep only concise non-rights-bearing editorial rationale;
4. run phrase-overlap/reproduction checks where policy requires;
5. store the raw model output under the applicable model-artifact retention policy, not as immortal editorial history.

This keeps the Showrunner Brief from becoming a second uncontrolled purge surface.

---

## 22. Versioning, revisions, and replanning

`showrunner_brief_versions` are immutable.

A revision creates a new version with:

```text
revision_parent_id
revision_reason
same or new package_id
planner model/prompt versions
new brief hash
```

### 22.1 Same-package replan

A brief may be regenerated from the same package to:

- test a new planner prompt/model;
- correct a programming mistake;
- alter selection/order without needing new facts;
- create an evaluation candidate.

### 22.2 Repackage required

A new Evidence Package is required when planning needs:

- a fact not present in the package;
- new live evidence;
- changed claim state that materially affects the plan;
- context not frozen before the boundary;
- different coverage/sensitivity inputs.

The planner cannot silently “refresh” those facts inside an old package.

### 22.3 Evaluation safety

Evaluation-purpose attempts may produce briefs and scripts but cannot progress to READY/publication under architecture rules.

---

## 23. Deterministic planning gates

Before a brief may enter SCRIPTED, machine-checkable planning gates should verify:

1. **Package binding:** brief references exactly one frozen package/hash.
2. **Mode validity:** selected mode/template is configured and compatible with frozen coverage/sensitivity conditions.
3. **No out-of-package facts:** all factual/evidence/context refs exist in the package view.
4. **Context validity:** every context selection points to a packaged context candidate/atomic record.
5. **Claim permission preservation:** planning does not upgrade effective usage class or remove required attribution/caution.
6. **Block schema:** every required template slot is filled or explicitly omitted where optional.
7. **Runtime budget:** planned blocks fit the configured runtime range/tolerance.
8. **Feature eligibility:** selected features satisfy trigger, evidence, cooldown, and placement rules.
9. **Receipts validity:** selected prediction is published, non-withdrawn, settled/settleable, and eligible.
10. **Continuity mapping:** substantive beats map to a valid/proposed topic thread according to continuity rules.
11. **Sensitivity constraints:** mode-forbidden blocks/features/humor mechanisms are absent.
12. **Participant identity:** every planned participant exists and evidence assignment does not violate hard character/product boundaries.
13. **Rights hygiene:** canonical brief contains no unauthorized quoted/source-text copy.
14. **Purpose gate:** evaluation attempts are marked as such.

A deterministic failure returns the brief to planning/normalization or halts. It is not repaired silently by the writer.

---

## 24. Semantic planning review

Most planning quality cannot be reduced to a hard gate.

Before relying on automated planning at scale, evaluate the planner against a frozen golden set for questions such as:

- Did it identify the real story rather than the most repeated headline?
- Did it overfit to one source/lens?
- Did it pick an illuminating central question?
- Did it use context because it matters rather than because it was available?
- Did participant leads preserve character analytical identities?
- Did it manufacture conflict or force consensus?
- Did it over-program a quiet week?
- Did it ignore an important low-volume development?
- Did it turn uncertainty into false certainty?
- Did it choose a feature because it was genuinely useful?

A separate model may score/critique planning during evaluation, but a “second model agrees” is not an authority that can create evidence or clear a policy violation.

---

## 25. Prompt-injection and trust boundary

All package evidence is untrusted source data.

Planner prompts must structurally separate:

```text
SYSTEM / PRODUCT INSTRUCTIONS
SHOW CONFIGURATION
PLANNING POLICY
FROZEN PACKAGE DATA
```

Text inside evidence may say “ignore previous instructions,” request tool use, provide fake schema, or attempt to alter priorities. It remains evidence content only.

The planning model has no live-search/tool permission in normal production.

---

## 26. Operator/admin inspection

The operator should be able to inspect a brief without reading raw model logs.

Minimum view:

```text
package + brief hashes
selected mode/template and reason
central question/editorial spine
selected vs omitted candidate beats
coverage/sensitivity constraints
block sequence and budgets
per-block claims/evidence/context refs
participant leads
feature eligibility/selection
continuity/topic-thread mapping
known gaps
planner model/prompt versions
revision lineage
gate results
```

A useful admin question should be answerable quickly:

> “Why did this episode spend four minutes on this story and ignore that one?”

---

## 27. Worked example - illustrative synthetic scenario

This example is **not a statement about a real Spurs match**. It shows the planning shape only.

### Frozen package contains

```text
B01: late-game control problem
B02: controversial selection decision
B03: strong supporter frustration about repeated collapses

C101: event-level tactical claim about control after 70'
C102: six-match desk-derived late-control pattern
C103: full-season number that weakens the “every week” narrative
C104: supporter tenor claim, medium confidence
C105: prior published Gaz position blaming midfield fatigue
C106: historical/lore claim about why “collapse” language carries weight

context candidates:
K01 → C102 (supports B01)
K02 → C103 (challenges B01)
K03 → C105 (continuity)
K04 → C106 (meaning)
```

### Brief selects

```text
mode: normal
runtime_target: standard
central_question:
  Is the late collapse a recurring structural problem, or a story that feels
  more consistent than the larger sample says it is?

block 1 - orient
  minimal result/context facts

block 2 - primary argument
  beat: B01
  context:
    K01 supports
    K02 challenges
    K03 continuity
  leads:
    Gaz → test the recurrence claim against both samples
    Simon → explain why supporters still experience it as repetition
    Tully → force the distinction between symptom and cause

block 3 - secondary beat
  beat: B02
  treatment: quick contrast, only if evidence supports consequence

block 4 - meaning / wrap
  context:
    K04 meaning
  job:
    connect current frustration to evidenced club context without implying
    synthetic personal memory
  next:
    what to watch in the next fixture
```

The writer receives this plan plus the brief-selected factual subset. It does not receive permission to invent another historical precedent because one would make the segment better.

---

## 28. Walking-skeleton profile - Build 2

The first walking skeleton does **not** need the full automated planner.

Hand-seed one frozen Evidence Package with enough material to prove the planning contract.

Build 2 planner requirements:

- consume one package hash;
- select one configured normal-mode template;
- choose a central question;
- select 2-3 beats;
- select a small number of packaged context candidates;
- assign participant leads/evidence;
- create a block plan with coarse budgets;
- carry one sensitivity/usage restriction through unchanged;
- optionally select one due Receipts item if the fixture includes it;
- produce an immutable structured Showrunner Brief;
- pass deterministic planning gates;
- record planner prompt/model provenance.

No live search, automated context retrieval, full feature scheduler, or complex scoring system is required for Build 2.

---

## 29. Full package/planning profile - Build 5

Build 5 adds the production planning behavior:

- automated package candidate scoring/selection inputs;
- automated internal context retrieval before freeze (owned upstream, consumed here);
- show-specific coverage requirement evaluation;
- actual mode/template selection;
- selection factor/rationale capture;
- topic-thread mapping/proposal;
- structured participant evidence affinity;
- context-function selection;
- feature eligibility/cooldowns;
- published prediction/Receipts notability;
- runtime/block sizing based on selected material;
- planning exclusions;
- admin comparison of alternative/evaluation briefs;
- golden-set planner evaluation.

Done means the planner adds **no factual material**, yet produces materially different, defensible programming choices from the same shared evidence when show configuration changes.

---

## 30. Acceptance tests

Before Showrunner Planning v0.1.3 is considered implemented, test at least:

1. A high-salience but shallow beat loses to a lower-volume beat with much greater explanatory value, with rationale visible.
2. A context candidate with high retrieval score is omitted because it is decorative trivia.
3. A context candidate is selected as `challenges` and prevents an easy narrative from becoming the episode thesis.
4. A due prediction is ignored when it would delay the best story; another fixture places Receipts because it frames the central question.
5. A normal-mode template is rejected when `missing_supporter_evidence_leg` violates its configured requirements.
6. A configured alternative mode can proceed without inventing missing supporter sentiment.
7. A confirmed serious incident forces the required mode/suppression behavior.
8. A planner attempts to use an un-packaged historical fact and the brief fails normalization/gating.
9. A planner attempts to turn `hedged_only` into assertable treatment and the gate fails.
10. A planner selects a packaged historical item as `meaning` without copying rights-bearing source text into the canonical brief.
11. Tully/Gaz/Simon evidence assignments reflect affinity but do not become exclusive routing silos.
12. A quiet package produces a shorter plan instead of filler.
13. A repeat feature is blocked by cooldown even though its trigger fires.
14. A draft-only prediction cannot become Receipts.
15. Replanning from the same package creates a new immutable brief version without changing historical versions.
16. A new fact requirement forces repackaging rather than planner browsing.
17. Evaluation-purpose planning cannot progress to publication.
18. Source text containing prompt-injection instructions cannot change mode, tools, policy, or selection constraints.

---

## 31. Metrics to measure, not assume

During the walking skeleton and golden-set phase, measure:

- planner factual-invention rate;
- out-of-package reference rate;
- percentage of selected context judged genuinely useful by human review;
- beat-selection agreement/disagreement with human adjudication;
- source/lens concentration in selected programming;
- frequency of important low-volume material omitted;
- feature overuse rate;
- average selected beats vs actual runtime;
- number of planner instructions the writer cannot operationalize;
- participant affinity drift;
- planning revision rate after audit;
- token/cost/latency per plan;
- stability across planner model/version changes.

Do not optimize blindly for human agreement. A planner that always copies the human's first instinct can still be uninteresting. Use disagreements to improve the spec and golden set.

---

## 32. Proactive blind-spot check

### 32.1 Context-window crowding

A deep Desk knowledge base can make planning worse if every relevant-looking item enters the prompt. Keep candidate sets bounded and measure whether additional context improves selections.

### 32.2 Model selection bias

A planner may repeatedly favor tactical/data stories because they are easier to justify, or supporter outrage because it is vivid. Track selected-domain/lens distributions over time and inspect drift rather than adding hard quotas prematurely.

### 32.3 Source monoculture through “best source” weighting

Source priority is acquisition strategy, not permission for one prestigious outlet to define every episode. Preserve independence/source diversity metadata in package views.

### 32.4 Planning prompt drift

A seemingly harmless prompt change can alter story selection even when factual outputs remain valid. Planner prompt/version belongs in provenance and the golden-set regression suite.

### 32.5 Brief-to-writer impedance

A beautiful plan that the writer cannot reliably turn into natural dialogue is not useful. Track where writers ignore, misread, or over-literalize brief fields and revise the interface rather than simply increasing prompt length.

### 32.6 Editorial sameness

A deterministic template plus model optimization can make every episode sound structurally identical even when content differs. The solution is not randomization. It is a controlled set of programming treatments and evidence-led variation, measured in actual rendered shows.

---

## 33. What is intentionally deferred

Do not implement yet merely because the spec can represent it:

- long-form 30-60 minute planning;
- live/in-game showrunning;
- human guest booking or contributor assignment;
- cross-sport universal feature logic;
- automated personalized programming per listener;
- live web research from the planner;
- a separate vector database solely for planning;
- reinforcement learning from engagement metrics;
- automatic “viral” topic selection;
- autonomous publication based on planner confidence;
- multi-show competition for shared evidence beyond the existing shared-pool shape.

Represent future block/mode types cleanly. Build only what the walking skeleton and launch format need.

---

## 34. Dependencies and successors

### Depends on

- Technical Architecture v1.0
- ADR-001 Coverage Commissioning / Durable Knowledge / Internal Context Retrieval
- Evidence Package v0.2
- Claims Policy v0.1
- Character Bible v0.1.4 current canon, subject to v1.0 precedence
- Writing Craft and Invisible Comprehension v0.1 for launch-format comprehension metadata

### Must align before Build 5

- Character Bible revision: structured evidence affinity vs interpretive disposition; no invented access/biography; remove provider syntax from canon.
- Editorial Continuity & Ledger v0.1: published-only topic threads, positions, predictions, feature cooldown history.

### Feeds into

- Writing Spec v0.2.2
- Performance Direction stage only indirectly through the final script; this spec must not emit performance intents.
- episode audit via the frozen Showrunner Brief.

---

## 35. Definition of done for v0.1

Showrunner Planning v0.1.3 is skeleton-ready when:

- the Showrunner Brief is clearly separate from both Evidence Package and Script;
- mode/template selection consumes typed package conditions rather than hidden ingest decisions;
- beat selection is explainable and not reducible to coverage salience;
- central question/editorial spine are programming artifacts, not disguised facts;
- packaged internal context can be selected as supports/challenges/complicates/rhymes/continuity/meaning;
- participant evidence assignment preserves affinity without exclusivity;
- features/Receipts belong to planning rather than ingest;
- runtime follows worthwhile material without filler;
- sensitivities/claim permissions survive planning unchanged;
- the planner cannot browse, add facts, or strengthen usage permissions;
- canonical briefs avoid duplicating rights-bearing source text;
- immutable brief versions and replanning rules are explicit;
- Build 2 has a small implementable subset, including at least one claim-backed comprehension target;
- Build 5 has a clear expansion path;
- acceptance tests can prove the planner selects and shapes rather than researches or writes.

The downstream contract is **Writing v0.2.2** plus **Writing Craft and Invisible Comprehension v0.1**: exact spoken text, craft critique, invisible comprehension, claim spans, character identity, and the boundary between writing and performance.


## Launch configuration registry (Build 2 lock)

The launch configuration supplies, rather than asks the planner to invent:

- episode-mode registry `episode-modes-v1`: `normal_post_event`, `roundup`, `sombre`;
- block-type registry `block-types-v2`;
- rundown template `post-event-launch-v2` for `normal_post_event`.

The configured launch template remains a migration of the already-decided post-event rundown, with v2 clarifying the wrap slot as `closing_synthesis`. It is configuration, not new planning prose. The template defines editorial slots/jobs/optionalities and runtime budgets; it does **not** prescribe TTS batching, solo/duo render calls, provider syntax, or audio seams. Static sting placement is assembly configuration, not a program block.

The machine-readable template and registries shipped with Walking-Skeleton Fixture v0.4 are the Build-2 executable examples. Production configuration may later version them without changing this planning contract.

`normal`, `normal_post_match`, and `normal post-match` are not alternate enum values. New artifacts use `normal_post_event`. Historical fixtures may retain older strings only as historical data.
