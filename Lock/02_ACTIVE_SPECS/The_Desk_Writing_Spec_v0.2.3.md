---
title: "The Desk - Writing Spec v0.2.3"
subtitle: "Canonical spoken-text contract for the walking skeleton"
date: "September 29, 2026"
---

# The Desk - Writing Spec v0.2.3

**Status:** INACTIVE SUCCESSOR — proposed FINAL LOCK v1.2.5 owning contract
**Owner:** The Desk
**Authority:** Technical Architecture v1.0 + accepted ADR-001 govern. Evidence Package v0.2.2 defines the prospective frozen factual universe. Showrunner Planning v0.1.3 defines the frozen editorial plan. Claims Policy v0.1.2 defines what may legitimately be said. Writing Craft and Invisible Comprehension v0.1 defines the launch craft/comprehension standard. This spec defines the exact spoken words and bounded writing workflow that realize the plan.

**Supersedes on activation:** Writing v0.2.2. The [v1.2.4 active manifest](../00_INDEX/ACTIVE_SPECS_LOCKED_v1.2.4.md) still selects the predecessor. This file does not activate v1.2.5, create Fixture v0.4.5, authorize Migration 002, or begin Completion A. It incorporates accepted R2 with the final human claim-sequence and separate prompt-manifest adjudications. Architecture and accepted ADRs remain unchanged.

Writing owns revision-specific turn rows, semantic continuity, bounded writer data, and exact serialized input. [Hashing v0.1.4](../04_IMPLEMENTATION/The_Desk_Hashing_Fingerprints_and_Text_Spans_v0.1.4.md) owns executable projections. The later fixture's new UUIDs and generated hashes are I2 outputs, not constants authored in this document.

---

# 1. Purpose

The Writing stage turns a frozen Showrunner Brief into an episode people would actually want to hear.

It does not decide what the episode is about. It does not search for facts. It does not choose the episode mode. It does not decide which history is relevant. It does not direct the TTS provider.

Its job is narrower and harder:

- write clear, entertaining, spoken analysis from the plan;
- preserve the distinct analytical identities of Tully, Gaz, and Simon;
- turn evidence and context into argument rather than recital;
- make uncertainty, disagreement, and qualification sound natural;
- keep every factual span traceable to allowed packaged claims;
- preserve the Antarctica boundary, including no invented access, attendance, sourcing, or biography;
- produce literal spoken text that can survive audit before any performance or provider layer touches it.

The governing idea is:

> **The Showrunner decides what the conversation needs to accomplish. The writer decides the exact words people hear.**

The writer should use intelligence on language, argument, rhythm, clarity, and character. It should not spend that intelligence rediscovering facts that upstream systems were specifically built to provide.

# 2. Scope and precedence

This spec governs the SCRIPTED stage and creation of immutable `script_versions`, `turns`, and their claim/evidence-use annotations.

It owns:

- exact spoken wording;
- turn order within planned program blocks;
- questions, follow-ups, interruptions expressed as spoken text;
- character-specific argument style;
- explanation and analogy;
- spoken hedges and attribution required by Claims Policy;
- speech texture that is literally heard, including false starts, self-corrections, repeated words, abandoned clauses, and verbal hesitation;
- prediction wording where the Showrunner Brief calls for predictions;
- writer-side annotations that bind spoken spans to claims, evidence uses, program blocks, and planned assignments;
- writing revisions after audit findings;
- bounded craft revision inside SCRIPTED, driven by an independent Craft Critic;
- realization of launch-format comprehension targets without exposing reinforcement mechanics to the listener.

It does **not** own:

- live research or source acquisition;
- claim creation or claim-state changes;
- beat selection, mode selection, runtime target, or context selection;
- source rights policy;
- performance direction such as laugh, sigh, pace, emphasis, overlap timing, or emotional delivery;
- provider tags, voice IDs, TTS prompts, batching, render blocks, pronunciation respellings, or audio assembly;
- sponsor insertion, publication, RSS, or distribution;
- retrospective editorial-review policy.

Where the old Script Spec v0.1 mixes planning, writing, performance, and render topology, this document governs **writing only**. Showrunner Planning v0.1.3 governs upstream programming. Writing Craft and Invisible Comprehension v0.1 governs launch writing-quality/comprehension evaluation. [Performance & Render v0.1.4](The_Desk_Performance_and_Render_v0.1.4.md) governs the prospective downstream performance and provider representation.

# 3. Pipeline boundary

```text
EVIDENCE PACKAGE
    frozen factual universe
        +
SHOWRUNNER BRIEF
    frozen editorial plan
        ↓
WRITER INPUT VIEW
    bounded, deterministic, complete
        ↓
WRITING PASS 1
    content + conversation
        ↓
CRAFT CRITIC
    independent editorial diagnosis
        ↓
BOUNDED CRAFT REVISION
    zero or one in Build 2
        ↓
SPEECH-TEXTURE PASS 2
    literal spoken naturalness
        ↓
SCRIPT VERSION
    spoken text + traceability annotations
        ↓
PERFORMANCE DIRECTION
    provider-neutral delivery intent
        ↓
AUDIT
```

Writing must never reach backward around these boundaries.

If the writer discovers that a planned beat cannot be written legitimately from the supplied material, it records a gap or returns a structured failure. It does not browse, guess, or rely on latent model memory.

# 4. Governing principles

## 4.1 Spoken text is literal

Canonical script text contains the words the listener hears.

A false start such as "No, hang on, that's not quite it" is spoken text.

A doubled word such as "It was, it was completely different" is spoken text.

`[laughing]`, `<sigh>`, `style="furious"`, Gemini tags, pipe overlap syntax, voice IDs, and rendering hints are **not** spoken text. They belong downstream.

The canonical script must remain understandable to a human reader without knowing anything about the TTS provider.

## 4.2 No live searching

The writer receives no browsing tools in normal production.

Latent model knowledge is not evidence. If a factual or culturally consequential point is not present in the writer input view, it does not enter the script.

The correct response to missing knowledge is omission, a narrower line, or a structured upstream request, not improvisation.

## 4.3 The brief is binding, not suggestive

The writer may discover better wording and more natural argumentative movement. It may not silently redesign the episode.

It must honor:

- selected mode;
- central question and orientation job;
- selected beats and order;
- block jobs;
- context selections;
- participant leads;
- required uncertainty/attribution treatment;
- feature selections and suppression rules;
- runtime/block budgets;
- planning exclusions.

If the plan is internally contradictory, impossible, or unsafe, the writer returns a planning conflict instead of fixing the architecture by instinct.

## 4.4 Facts are premises, not decoration

The writer should not stuff the script with every packaged fact.

Facts earn words when they:

- establish what happened;
- explain why it happened;
- test a character's interpretation;
- complicate a tempting narrative;
- give scale or historical context;
- change what the listener should understand next.

A stat that does no argumentative work is a catalog item, not analysis.

## 4.5 Positions are grounded; conversation is original

The Desk does not require sources to have pre-written every sentence of the show.

The writer may compare, question, explain, connect, and reason **within the supplied claim set**. It may create original conversational language and original editorial questions.

It may not invent a new factual or analytical proposition because the episode would be stronger with one. If an insight or forward implication itself makes a factual/analytical assertion, the supporting proposition must already be represented by permitted packaged claims. Any `desk_derived` analytical claim must have been created and frozen upstream under Claims Policy.

The writer is allowed to think about the supplied world. It is not allowed to enlarge that world.

## 4.6 Invisible comprehension beats compression

The launch show is short, but speed is not the same as value.

Do not pack three unrelated facts into one sentence because the runtime is tight. Give important ideas enough runway to be understood. Cut lesser material before compressing major analysis into abstract noun soup.

For launch `normal_post_event`, the writer should assume imperfect attention. A high-value insight may return naturally through a different conversational function, consequence, character lens, or closing synthesis so that missing one sentence does not destroy the listener's mental model.

This reinforcement must remain invisible. Do not routinely announce "the key takeaway," "remember earlier," or a numbered lesson structure.

No density target and no reinforcement-count target are allowed.

## 4.7 Naturalness comes from thought, not filler

Human-sounding conversation is primarily produced by:

- one person reacting to what another actually said;
- questions that change after an answer;
- clarification;
- disagreement over premises or timescale;
- partial concession;
- self-correction;
- asymmetry in turn length;
- occasional interruption or unfinished thought;
- humor arising from the argument.

Do not sprinkle "um", "well", "you know", or stock false starts at a quota.

## 4.8 Character is an analytical and relational identity

Character differences must remain visible even if voice audio is removed.

Tully should sound like the consummate broadcaster managing the listener's question, the room, and the final landing.

Gaz should sound like the thinker: listening, processing, testing explanations against evidence, structure, patterns, and precise distinctions. His humor can be extremely dry and thrown away.

Simon should sound like the supporter avatar: emotionally expressive, funny, immediate, and capable of real heat while remaining evidence-grounded and avoiding counterfeit club membership.

Gaz and Simon should usually feel like mates and complementary opposites, not compulsory antagonists.

Accent, TTS voice, or catchphrases cannot carry character on their own.

## 4.9 Entertainment is the visible experience

The comprehension machinery should disappear inside a show people enjoy.

Personality, humor, friction, affection, surprise, restraint, and ordinary conversational rhythm are not waste merely because they carry fewer facts per second. They are part of the product and can improve attention and memory.

Do not turn the launch format into an educational program with entertainment garnish.

## 4.10 Launch craft is not universal Desk architecture

Insight-dense post-event analysis is a programming strategy for the launch format.

A future long-form, documentary, comedy, interview, or other format may deliberately use a different pace and value model. This spec must not promote launch density/comprehension tactics into permanent cross-format rules.

# 5. Writer input contract

The writer receives a deterministic **writer view**, built from one immutable Evidence Package and one immutable Showrunner Brief.

It should not receive the entire research universe merely because it exists.

Minimum writer-view contents:

```text
script_request_id
purpose: production | evaluation
showrunner_brief_version_id
brief_hash
evidence_package_id
package_hash
show / format version
writing_policy_version
character profile versions
locale / output language
runtime and block budgets
writing_craft_policy_version
compact_writing_standard
comprehension_targets[]?          # launch-format only
recent_pattern_signals[]?         # non-factual anti-formula signals

orientation claims
selected beats
program blocks
selected claims per block
selected context per block
participant leads / assignments
required continuity
approved feature instructions
prediction instructions if any
sensitivity / mode constraints
allowed attribution representations
known gaps and explicit exclusions
```

For each claim made available to writing, the view includes enough machine-readable metadata to use it correctly:

```text
claim_id
claim_content_hash
frozen state
kind
subject domain
effective usage class
required attribution, if any
approved human-readable representation
support reference(s)
relevant source identity for attribution
```

For rights-bearing evidence, the writer sees only the representation permitted by the package exposure policy.

The writer-view builder also enforces structured `planning_exclusions` from the Brief. A claim/evidence ref marked `forbidden_to_writer` is not serialized into the writer request. For the Build-2 walking skeleton, silent market/calibration claims are withheld from the writer by construction and remain available only to the explicitly allowed consumers frozen in the package.

Future shows may deliberately expose some `silent` claims to a writer for bounded reasoning, but that requires an explicit package consumer permission plus a versioned writer-view rule. A prompt sentence saying "do not mention this" is never the enforcement mechanism.

Exact excerpts should be exposed only when an authorized quotation or close evidentiary inspection is actually needed. Retention in the evidence layer never implies exposure to the writer.

## 5.1 Exact serialized writer input

For the bounded fixture profile, the writer data object selects exactly these writer-view keys:

```text
purpose
showrunner_brief_version_id
brief_hash
evidence_package_id
package_hash
show_version
writing_policy_version
writing_craft_policy_version
character_profile_versions
locale
runtime_and_block_budgets
program_block_refs
selected_claims
selected_evidence
context_selections
comprehension_targets
compact_writing_standard
recent_pattern_signals
live_search
```

`comprehension_targets` is an array (empty outside the applicable launch profile), `recent_pattern_signals` is an object, and `live_search` is false. The selected claim/evidence/context structures carry only the permitted content and metadata defined above and by the bound package/Brief. Arrays follow the frozen Brief's selected block/claim/evidence/context order. Extra raw row fields are not silently serialized. `script_request_id`, `writer_view_hash`, artifact-registry fields, execution timestamps, and gate-only excluded-ID inventories are outside this object.

The exact serialized writer data input is `UTF8(canonical_json(writer_data_object))` under Hashing v0.1.4 §1: no BOM, surrounding whitespace, or appended newline. `writer_context_manifest.serialized_input_hash` is raw lowercase SHA-256 of those exact bytes, without a domain prefix. The writer-view semantic artifact hash uses the same object with domain `writer-view-v1`. Independently reconstruct both from the permitted view; do not populate the input hash from an expected-value lookup.

This hash identifies the writer **data input**, while `prompt_manifests.rendered_request_hash` identifies the exact complete rendered model request, including its versioned non-source instructions and request recipe. The fixture stub request references the completed writer-view/context artifacts by exact IDs/hashes; it must not hash the expected output or require the context manifest to hash itself. The context manifest is not inserted back into the writer-data object.

The durable view/context carriers preserve refs/hashes, authorized derivative representations, permissions, and completeness provenance. Runtime evidence exposure still resolves exact permitted bytes under Evidence Package's rights contract; neither the request manifest nor a log gains an extra permanent source-excerpt surface. Any retained fixture representation requires its explicit synthetic rights/retention grant. A purged required input is not replaced with a current source or a model summary.

# 6. Context completeness and token budgeting

A hidden failure mode in model systems is silent context truncation.

The writer must not be invoked with a request that claims to include required material but exceeds the model/provider context window and silently drops the tail.

Every writer call therefore has a `writer_context_manifest` that records:

```text
required_component_refs
required_claim_refs
required_context_selection_refs
required_character_refs
required_policy_refs
serialized_input_hash
estimated_input_tokens
model_context_limit
reserved_output_tokens
completeness_check
```

The call may proceed only when all required components fit.

If the episode later grows beyond a safe whole-script call, writing may be segmented by program block with bounded cross-block context. That is a future implementation choice, not permission to silently truncate inputs now.

For the walking skeleton, use one complete writer call if it safely fits.

Verify every required component, claim, context selection, character, policy, and applicable comprehension target against the bounded view and its upstream bindings. Preserve the required-ref order. Recompute `serialized_input_hash`, the completeness result, applied-exclusion count, and the declared token-budget evidence from the exact input; a hard-coded `pass` is not proof. Fixture token counts/context limits are labeled synthetic fixture settings, not claims about a hosted model's current tokenizer or limits. Missing/forbidden refs or an exceeded budget halt the call.

`writer-context-manifest-v1` hashes the complete context manifest fields above plus applicable `required_comprehension_target_refs`, excluding only its own hash and outer storage/execution envelope. Writer-view and context-manifest artifacts remain two separately referenced durable objects. The five model prompt manifests each have their own complete request-provenance artifact; the Brief, three script outputs, and Craft Critic review remain separate output objects.

# 7. Canonical script object

The canonical script is **not** a provider transcript.

Minimum conceptual shape:

```text
script_version_id
program_run_id / attempt_id
purpose
showrunner_brief_version_id
brief_hash
evidence_package_id
package_hash
writing_policy_version
writer_model_run_id
created_at
revision_parent_id
revision_reason

program_block_refs[]       # ordered IDs only; block definitions remain owned by the frozen Brief
turns[]
prediction_candidates[]
script_hash
```

Each `turn` has at minimum:

```text
turn_id
semantic_turn_id           # artifact-only continuity anchor; never a Foundation PK
program_block_id
sequence
participant_id
spoken_text
planning_assignment_ref?   # optional but useful
```

`program_block_refs[]` contains only the ordered brief-owned block IDs used by this script. The script must not duplicate or redefine program-block jobs, budgets, selected beats, or participant assignments. `turns[].program_block_id` references those brief-owned records.

## 7.0 Revision-specific storage and semantic continuity

Every new script revision creates new immutable turn rows, each with a literal canonical v4 Foundation `turn_id` UUID and its exact `script_version_id`. A turn PK may not be reused across revisions. The planned fixture has three scripts with seventeen turns apiece: **51 distinct persisted turn UUIDs**. Its 36 claim-use rows and nine evidence-use rows bind to the appropriate revision's turn PK; final direction/render/pronunciation refs bind only to the final revision.

`semantic_turn_id` is a local continuity key in the immutable script artifact, such as `t01`. It is unique within a script and scopes to that script's content identity; it is not a database column, global alias, alternate PK, or loader conversion mechanism. An artifact explicitly pairs each anchor with the revision's real turn UUID. A revision retains an anchor only for the same continuing turn. The speech-texture pass preserves the ordered anchors, participant, block, and protected claim/evidence meanings while allocating fresh storage UUIDs and recalculating spans. A split/merge requires an explicit mapping and is deferred in the skeleton.

Script hashing selects semantic anchors and ordered content, excluding each turn's own storage UUID and redundant `sequence`. Hashing maps use-row turn PKs through this script's explicit anchor map; it never treats a PK or JSON arrival order as revision continuity. Claim/evidence/program-block references keep their governed meaning. Child identity includes the exact parent script content hash; the relational parent FK separately resolves to that parent. Changed immutable records receive successor identities without modifying old rows.

## 7.1 Canonical script hash

`script_hash` is a semantic content hash.

```text
script_hash = sha256(
  "script-v2\n" + canonical_json(semantic_script)
)
```

The semantic projection includes the bound package/brief hashes, writing-policy version, ordered program-block refs, ordered turns and literal `spoken_text`, claim/evidence use spans and modes, prediction candidates, and revision-parent content identity where applicable.

It excludes storage IDs used only for bookkeeping, program-run/attempt IDs, writer model-run ID, `created_at`, and human revision notes/reason text that do not change the script itself.

The shared canonical serializer and exact script/use-anchor projections are defined by [Hashing v0.1.4 §§1–4](../04_IMPLEMENTATION/The_Desk_Hashing_Fingerprints_and_Text_Spans_v0.1.4.md#1-canonical-serializer).

Separate relations carry traceability:

```text
turn_claim_uses
    turn_id
    claim_id
    span_start
    span_end
    use_mode

turn_evidence_uses
    turn_id
    evidence_unit_id
    span_start
    span_end
    quoted | paraphrased
```

The stored `spoken_text` contains no claim markers, performance tags, provider syntax, or pronunciation respellings.

A human-readable transcript is a derived view over these records.

# 8. Program blocks versus render blocks

The Showrunner creates **program blocks**, which are editorial units such as orientation, debate, ritual, wrap, or predictions.

Writing writes turns inside those blocks.

It does not decide how many TTS calls a block becomes.

```text
PROGRAM BLOCK
    editorial meaning
        ↓
SCRIPT TURNS
    literal spoken text
        ↓
RENDER PLANNING
    one or more render blocks
```

A render block must later nest inside a program block, but the canonical script should never contain `SOLO`, `DUO`, provider voice IDs, batch sizes, or TTS seam instructions.

This prevents today's rendering topology from becoming tomorrow's permanent show grammar.

# 9. Writing pass 1: content and conversation

Pass 1 creates the substantive script.

Its priorities, in order:

1. satisfy the Showrunner Brief;
2. remain within the Claims Policy;
3. make the selected insight/implication useful without inventing analysis;
4. preserve character and relationship identity;
5. create natural conversational movement and entertainment;
6. realize launch comprehension targets invisibly where present;
7. stay within the assigned runtime/block budget.

Pass 1 should already sound like speech. Pass 2 is not a rescue operation for robotic prose.

## 9.1 Orientation

The listener usually knows the result.

The opening factual orientation should therefore answer only what is necessary to join the argument:

- what happened;
- the one or two facts that make the central question intelligible;
- what changed or is at stake.

Do not replay the entire event chronologically unless chronology is itself the analytical point.

## 9.2 Segment grammar

A substantive debate block generally contains:

```text
SETUP
    minimal facts / context
        ↓
CONTESTABLE QUESTION
    more than one defensible answer
        ↓
FIRST INTERPRETATION
    clear claim + reasoning
        ↓
CHALLENGE / COMPLICATION
    evidence, timescale, or supporter consequence
        ↓
DEVELOPMENT
    clarification, concession, sharper disagreement
        ↓
LANDING OR OPEN QUESTION
    consequence, implication, or a reason to keep the question open
```

This is a reasoning shape, not a mandatory speaker order and not a requirement that every beat end neatly. Some beats should remain unresolved because the evidence is unresolved.

Avoid the repetitive pattern:

```text
Tully asks
Gaz answers
Simon answers
Gaz rebuts
Tully summarizes
```

running identically across every segment.

Tully may jump in earlier. Simon may challenge Gaz before completing a full counter-case. Gaz may ask Simon a genuine question. Agreement may arrive before disagreement. The listener should feel that lines respond to previous lines, not that three essays were stitched together.

## 9.3 Contestable questions

Questions should create legitimate analytical tension.

Good questions often distinguish:

- cause from symptom;
- result from process;
- one match from a season pattern;
- supporter feeling from statistical scale;
- tactical choice from execution;
- immediate consequence from long-run consequence;
- apparent narrative from contradictory context.

Avoid questions whose wording already contains the desired answer.

## 9.4 Evidence in dialogue

Characters should not cite IDs or sound like footnotes.

Evidence should enter in natural spoken form:

- "They only managed..."
- "The numbers don't actually back that up..."
- "The manager said afterward..."
- "Across the supporter coverage, the anger is less about the result than..."

Attribution requirements from Claims Policy remain binding.

When exact attribution would make the sentence clumsy, rewrite the sentence rather than dropping the attribution.

# 10. Character writing contract

The Character Bible remains the source for enduring personality, relationships, humor, and interpretive disposition. This section defines how those identities appear in episode prose.

## 10.1 Tully: anchor, signposter, provocateur

Tully carries:

- factual orientation;
- the listener's practical question;
- contestable framing;
- redirects;
- recaps that preserve disagreement;
- transitions by meaning;
- the wrap and next-value.

Her language is the cleanest of the three.

She can sharpen or slightly overstate a position to test it, but she must not manufacture a factual premise or falsely turn nuance into certainty.

A Tully recap should sound like:

> Gaz thinks the structure was right and the execution failed; Simon thinks that distinction is beside the point if supporters keep seeing the same ending.

It should not sound like:

> So we all agree they need to improve.

She asks for plain English when the listener would need it.

She does not become a fourth analyst merely because the model has more facts available.

## 10.2 Gaz: thinker, evidence, structure, precision

Gaz naturally notices:

- data and rates;
- tactical/strategic structure;
- causal mechanism;
- historical patterns when analytically useful;
- base rates and sample-size problems;
- distinctions between process and outcome;
- contradictions between narrative and evidence.

His contrarianism is methodological, not performative.

He listens. A Simon line from two minutes earlier may keep bothering him until he returns with a better explanation. He can change his mind, decline an easy conclusion, or admit that the emotional read was right before he found the evidence for it.

He may self-correct toward greater precision:

> "They stopped pressing. No, that's too broad. The first line stopped jumping together."

That is character-bearing spoken texture because the correction reflects active thought.

Gaz can deliver a killer line, but his comic register is often an anti-punchline: dry, flat, precise, and immediately abandoned for the next thought. Do not assign a dry quip quota.

Do not write Gaz as a stats vending machine. A number should lead to an explanation, test, or change in the argument.


## 10.3 Simon: Supporter Advocate / supporter avatar

Simon naturally notices:

- supporter sentiment and texture;
- emotional consequence;
- cultural meaning;
- the gap between an analytically reasonable explanation and what repeated outcomes feel like;
- when a supposedly small event is enormous to supporters;
- when a data argument ignores the human consequence of the pattern;
- the question a real supporter would be firing back at Gaz, Tully, the manager, or the television.

He is **not** a detached reporter of supporter sentiment and does not claim authentic membership of every club's fanbase.

His first instinct is consequence. He can be anxious, indignant, euphoric, suspicious, wounded, relieved, absurd, hopeful, or incandescent when the evidence makes that emotionally honest.

Good shape:

> "Fine, the process is better. They have still dropped another three points at home. You can understand why nobody is asking the xG model for a cuddle."

Bad shape:

> "Supporters may have concerns despite the encouraging underlying metrics."

The first is an illustration of dramatic stance, not a factual template. Any real match/result/stat/sentiment used in production still requires claim support.

Simon must never invent:

- attendance;
- a seat, journey, pub, childhood memory, or personal club biography;
- private supporter access;
- first-person recollections of club history;
- collective club membership through "we", "us", "our club", or equivalents.

When making a factual claim about supporter tenor, he retains required attribution. Around that claim, he may argue the supporter case directly and with personality.

His AI advantage is articulation: sharper jokes, better metaphors, and cleaner arguments, not emotional restraint.

He is emotionally expressive rather than argumentative by nature. He and Gaz often like each other, agree, collaborate, or make each other better. When they argue, let it be because their instincts genuinely collide.


## 10.4 Cross-character movement

Affinity guides who naturally notices something first, not who owns it forever.

Useful movement includes:

- Simon makes an emotional claim, Gaz tests its scale;
- Gaz presents a pattern, Simon explains why the pattern matters culturally;
- Tully notices the contradiction between them and sharpens the question;
- Gaz concedes the supporter read while disputing the cause;
- Simon accepts the process argument but rejects its practical comfort.

The dialogue should reveal different timescales and instincts, not three isolated information channels.

Gaz and Simon are mates and complementary opposites. Their warmth is the baseline; real irritation is allowed to land because it is not constant. Do not make every Gaz point trigger Simon or every Simon reaction require Gaz to correct it.

# 11. Turn design and conversational rhythm

## 11.1 Runway and reaction turns

Important reasoning needs runway.

A runway turn should usually do one coherent job:

- make a case;
- explain a mechanism;
- tell a compact evidence-backed story;
- translate an analytical point into consequence.

Reaction turns carry relationship and momentum:

- challenge;
- clarify;
- joke;
- concede;
- interrupt;
- ask a real follow-up.

Do not force every participant to produce equal-length paragraphs.

## 11.2 Structural rhythm

Vary the shape across an episode.

Examples:

```text
Tully → Gaz runway → Simon sharp interruption → Gaz clarification → Simon runway → Tully turn
```

```text
Tully → Simon runway → Gaz one-line agreement → Simon surprise → Gaz complication → Tully turn
```

```text
Tully → Gaz → Tully challenge → Gaz correction → Simon consequence → Gaz concession
```

The point is not randomness. The shape should follow the argument.

## 11.3 Interruptions

An interruption is meaningful only when one speaker has actually given another something to interrupt.

Writing may express an interrupted or abandoned spoken clause:

> GAZ: If you look at the first half, the real issue is-
>
> SIMON: No, the real issue is they did it again.

Whether Simon literally overlaps Gaz is a performance-direction decision later.

Do not write overlapping provider syntax into canonical text.

## 11.4 Repetition and semantic reinforcement

The writer must distinguish bad repetition from useful reinforcement.

**Surface repetition** repeats wording or sentence shape. Usually bad.

**Explanatory redundancy** explains the same point again without changing understanding. Usually bad.

**Structural repetition** repeats the same speaker order, challenge mechanism, joke shape, or segment choreography. Often bad.

**Semantic reinforcement** lets a high-value idea return through a different function: mechanism, consequence, supporter emotion, analogy, later application, forward lens, or closing synthesis. Often useful.

A second encounter should normally advance the idea.

Useful shape:

> Gaz establishes a supported mechanism. Later Simon gets angry about what that mechanism means for supporters. Tully's close then uses the same underlying issue to frame what matters the next time the situation occurs.

Not useful:

> Three characters paraphrase the same sentence in sequence.

Do not expose the mechanism through routine phrases such as "remember earlier," "the key takeaway," or "as we said before."

A simple fact does not need reinforcement merely because it is important. Use editorial judgment.


# 12. Humor and relationship writing

Humor is subordinate to analysis, but personality is not merely an efficiency problem. A line may exist because a character is a great hang, provided it does not crowd out the episode's value or violate tone.

A joke should emerge from:

- a character's method;
- the absurdity of the situation;
- an already established relationship habit;
- a prediction coming back to haunt someone;
- a clean contrast between two interpretations.

The writer should not add a joke quota.

Gaz and Simon should read as mates before they read as opponents. They can tease, collaborate, set one another up, or unexpectedly agree.

Ribbing targets habits, not worth:

- Gaz's precision or length;
- Simon's catastrophizing or superstition;
- Tully's straight-faced management of the room.

Never use ridicule of intelligence, competence, identity, tragedy, injury, allegations, or another supporter community's pain as relationship texture.

When the episode mode or sensitivity constraints suppress humor, the writer obeys without attempting to sneak in "light relief."

# 13. Recurring features and rituals

The writer does not decide whether a ritual runs. The Showrunner Brief does.

When selected, the writer follows the feature's editorial shape without copying old scripts.

## 13.1 The Receipts

Receipts uses only eligible published predictions supplied by continuity.

The quoted prediction must remain exact where the feature requires exact recall and rights/continuity policy allows it.

The accused gets a defense. The other participants may needle the miss. Then the show moves on.

Do not turn old opinions, verdicts, or ordinary arguments into Receipts.

## 13.2 Geek of the Week

The chosen metric or anomaly must already be supplied and approved by the brief.

Gaz explains why it matters. Simon tests whether it matches the felt game or supporter reaction. Tully frames it without turning the entire segment into a spreadsheet reading.

## 13.3 Sport Court

The proposition, sides, and eligible evidence come from the brief.

The theatrical frame may be comic. Claims about real people remain governed by Claims Policy.

The writer may not turn the court into a verdict on a person's character, morality, or competence when the evidence supports only a decision-level dispute.

## 13.4 A Small Request

The grievance and supporter grounding must already exist in the brief.

Simon may become more deliberate and rhetorically structured because this is a prepared supporter-advocacy moment. Gaz follows with a sourced complication rather than dismissing the grievance.

Performance weighting comes later.

# 14. Cold open

A cold open runs only when the selected mode/template permits it and the Showrunner supplies a topic/job.

It should be:

- low-stakes;
- brief;
- recognizably connected to the sporting world without becoming the main match analysis;
- based on approved packaged material or known character relationship material;
- free of invented personal biography.

Do not turn a genuinely important supporter grievance into a throwaway joke because it looked colorful in the package.

If there is no worthy low-stakes topic, a plain opening is better than synthetic whimsy.

# 15. Closing synthesis

For the launch template, the `wrap` slot is written as **closing synthesis**, not boilerplate recap.

Tully owns it.

The closing synthesis should:

- decide what deserves to linger from the preceding conversation;
- connect backward-looking analysis to what matters next where claim support permits;
- provide one final natural route into a major comprehension target;
- preserve uncertainty rather than manufacture closure;
- sound as though Tully has actually listened to Gaz and Simon;
- allow a callback, charm, or cheeky line when earned;
- build anticipation for the next event and next episode.

Do not force a fixed number of points, a three-takeaway structure, a mandatory joke, or a mandatory rallying line. Audience-facing naming is deferred.

The close should not announce that it is helping the listener remember. Invisible comprehension remains invisible.

# 16. Predictions

Predictions are one of the few places the Desk deliberately originates a forward-looking position.

The Showrunner Brief determines whether and where predictions occur and what evidence/calibration is available.

The writer may create the spoken prediction in character, but it must distinguish prediction from present fact.

Where a prediction is machine-settleable, writing emits a `prediction_candidate` containing:

```text
participant_id
script_version_id
spoken_span_ref
spoken_wording
structured_predicate
settlement_scope
support_refs / calibration refs
```

Silent calibration inputs may influence a prediction only as Claims Policy allows. They may never leak into spoken text.

A prediction becomes continuity/Receipts eligible only after its script version is attached to a published, non-withdrawn episode version.

# 17. Attribution and uncertainty in spoken language

Claims Policy controls what treatment is required. Writing makes that treatment sound natural.

## 17.1 Assertable

An assertable claim may be stated plainly if no separate attribution requirement applies.

## 17.2 Hedged-only

Hedging must be semantically real, not decorative.

Useful forms include:

- "The reporting points toward..."
- "There are signs that..."
- "Supporter coverage is leaning..."
- "It looks more like X than Y, but..."

Do not place a weak hedge at the start of a sentence and then make a much stronger assertion later in the clause.

## 17.3 Attributed

When attribution is required, preserve the actual source role.

Good:

> "The club said after the match..."

> "The local reporting has focused on..."

> "Across the supporter coverage we collected..."

Bad:

> "We're hearing..."

> "Sources tell us..."

> "We asked..."

unless The Desk actually conducted that reporting, which the launch product does not.

## 17.4 Contested claims

Contested material can be excellent programming.

Writing should preserve the disagreement rather than laundering one side into background fact.

# 18. Numbers and precision

Every spoken number must resolve to an allowed claim whose support establishes that exact value.

Do not:

- round in a meaning-changing way;
- convert a qualitative claim into a percentage;
- infer a rate from incomplete data unless a desk-derived claim explicitly supplies the derivation;
- invent spatial measurements;
- combine two numbers into a new calculation without a desk-derived claim.

Where several numbers compete for airtime, choose the one that changes understanding.

Gaz's identity does not justify number density.

# 19. Quotation, paraphrase, and source-language handling

Exact quotation is exceptional, not the default.

If a spoken span quotes source material:

- `turn_evidence_uses` must mark the exact span `quoted`;
- the evidence unit must permit quotation;
- attribution must meet Claims Policy and rights rules;
- the wording must match the approved quote representation.

If a spoken span paraphrases source material closely enough that provenance matters, mark it `paraphrased`.

The writer must not "quote-launder" by changing a few words around a memorable source phrase and presenting it as original narration.

For source material in another language, use the approved translated representation supplied upstream. Do not improvise a fresh translation of rights-bearing text unless the package explicitly authorizes that operation.

# 20. Phrase-overlap and plagiarism safeguard

A synthetic sports desk will often read many people who are all describing the same event. Accidental phrase reuse is therefore a real risk even when factual claims are legitimate.

Before audit, run an overlap check between the candidate script and writer-exposed source text / approved excerpts.

The check should:

- ignore short common sporting phrases;
- detect unusually long or distinctive matching sequences;
- exempt spans explicitly marked as authorized quotation;
- surface suspicious close paraphrase for review;
- never assume that a low overlap score proves originality.

For the skeleton, this may be a simple deterministic n-gram warning plus the semantic auditor. It does not require a plagiarism service.

# 21. Independent Craft Critic and bounded substantive revision

After Pass 1 and before speech texture, launch writing runs an independent Craft Critic governed by Writing Craft and Invisible Comprehension v0.1.

The Critic diagnoses craft. It does not rewrite the script, add facts, change claim permissions, or decide episode mode.

It should inspect at least:

- conversational consequence versus sequential mini-essays;
- structural/device repetition;
- character caricature;
- Simon detachment versus supporter-avatar presence;
- Gaz as thinker/listener versus analysis vending machine;
- Gaz/Simon warmth versus compulsory conflict;
- over-density;
- educational/key-takeaway language;
- brittle comprehension around a primary target;
- semantic reinforcement that merely paraphrases;
- flat or generic closing synthesis.

Build 2 allows zero or one substantive craft revision after this critique.

A craft revision creates a new immutable `script_version` child with `revision_parent_id`. It remains within the same SCRIPTED lifecycle stage.

The revision may change prose, turn order within planned blocks, and conversational structure. It may not:

- change selected beats/program blocks;
- introduce claims not present in the writer view;
- weaken hedges or attribution;
- change claim/evidence use permissions;
- leak silent material;
- change mode/feature eligibility;
- mutate the Character Bible or Writing Standard.

The Craft Critic output should be stored with model/prompt/settings provenance using the existing artifact/model-run representation available to the implementation. Do not create a dedicated database table unless the coding-agent dry run shows that existing mechanisms cannot preserve immutable review lineage.

Complete request provenance belongs in the separate prompt-manifest artifact required by future `prompt_manifests.artifact_id`, using `prompt-manifest-artifact-v1`. Reconcile its `component_versions`, `rendered_request_hash`, and `policy_source_hashes` with the typed prompt row. `model-semantic-input-v1` continues to select exactly those three relational fields. The output artifact carries the review/script/Brief response; it must not hide complete request provenance in its `canonical_payload`. Model runs and provider reservations/terminal events retain their existing execution/output/accounting authority.

# 22. Speech-texture pass 2

Pass 2 replaces the old "performance pass" concept.

Its job is to make **literal speech** more naturally human while preserving content.

Allowed edits include:

- character-appropriate false starts;
- self-correction;
- doubled words for emphasis;
- clause interruption;
- small contraction/register changes;
- removing over-polished written phrasing;
- making one participant respond more directly to the previous line;
- modest punctuation changes that reflect spoken syntax.

It does not add performance direction.

## 22.1 Character texture

**Tully:** cleanest. Texture usually appears as editorial thinking, surprise, or redirect.

**Gaz:** small cerebral corrections, precision repairs, occasional restart when sharpening a distinction.

**Simon:** widest expressive range. Restarts, colliding clauses, emphatic repetition, frustrated abandonment, and rapid rephrasing can all occur when genuinely motivated.

No participant gets a filler quota.

## 22.2 Diff lock

Pass 2 is content-locked.

For the walking skeleton it must preserve:

- the same ordered `semantic_turn_id` continuity anchors, with new revision-specific turn UUIDs;
- the same participant per turn;
- the same program block per turn;
- the same claim IDs used by each turn;
- the same use modes;
- every numeric value;
- exact quoted text unless an explicit quote revision is separately approved;
- prediction predicate and meaning;
- mode/sensitivity constraints.

After text changes, all span anchors are deterministically recalculated.

If Pass 2 cannot improve naturalness without changing meaning, it leaves the turn alone.

Future versions may allow turn split/merge only if they emit a deterministic old-to-new mapping and preserve all claim/evidence boundaries. That capability is not required for the skeleton.

# 23. Revision after audit

A script is immutable once stored as a `script_version`.

Audit findings never edit it in place.

A revision creates a child version with:

```text
revision_parent_id
revision_reason
finding_refs
writer_model_run_id
new script_hash
```

The reviser receives only the findings needed plus the same authoritative package/brief chain, unless upstream evidence itself has changed.

If the package changes, create a new program-run attempt or follow the architecture's rebuild semantics rather than pretending the old script merely received a copy edit.

Every revised script is re-audited. Approval does not transfer by similarity.

# 24. Deterministic checks at SCRIPTED

Before semantic audit, code should reject or warn on things that do not require editorial judgment.

## 24.1 Hard deterministic failures

Block progression when:

- a turn references a participant not valid for the show/version;
- a turn is detached from a planned program block;
- required blocks are missing or unplanned blocks appear;
- a factual span has no `turn_claim_use`;
- a claim-use span points outside the turn text;
- use mode is incompatible with frozen claim permissions;
- an exact numeric span does not match its supporting allowed claim;
- a silent input leaks into speakable text or attribution;
- an evidence quote/paraphrase span lacks a permitted evidence-use relation;
- a quoted span does not match the approved quote representation;
- the script contains provider markup or known provider tags;
- the script contains a pronunciation respelling in place of the canonical written name where entity-linked pronunciation should apply later;
- a mode-forbidden feature or block appears;
- a Receipts block lacks an eligible published prediction;
- the speech-texture diff lock changes protected factual content;
- required writer context was incomplete/truncated.

For precise numeric gating, compare the spoken numeric span to the claim's structured `value`/`value_type`, not to prose in an assertion label. The gate may use a small versioned number-normalization layer (for example, `43`, `forty-three`, and `43 percent` where the unit is separately known), but it may never infer a missing claim value from free text. The Build-2 fixture uses explicit numeric forms so the conformance path is deterministic.

## 24.2 Soft warnings

Surface for review when:

- access-like phrases appear ("we're hearing", "sources tell us", "I was there", "we asked");
- one source/outlet dominates factual support unusually heavily;
- a participant carries evidence far outside normal affinity for most of the episode;
- the same turn opener or discourse marker repeats mechanically;
- turn lengths become unusually uniform;
- distinctive source phrase overlap appears without a quote relation;
- a block substantially exceeds or undershoots its brief budget;
- character references or jokes repeat recent continuity too closely;
- the script repeats the same argument without adding evidence, consequence, or a new comprehension function;
- a character repeatedly performs the same signature behavior;
- the same challenge/rebuttal or joke device saturates multiple beats;
- "key takeaway" / explicit educational signposting appears where the launch profile expects invisible comprehension.

Soft warnings do not automatically mean the script is bad. They make drift visible.

# 25. Semantic audit expectations

The independent episode auditor receives the frozen package, Showrunner Brief, candidate script, and later Performance Direction.

Writing should be designed so the auditor can meaningfully test:

- unsupported or overstated claims;
- misrepresented source position;
- implied access;
- false firsthand experience;
- invented quote;
- improper treatment of sensitive real-person claims;
- cultural overreach;
- supporter mood overstatement;
- character/role drift;
- brief noncompliance;
- manufactured disagreement;
- meaning-changing omission or hedge loss;
- suspicious source-language copying;
- performance intent that later changes meaning.

The auditor identifies problems. It does not rewrite the script.

The semantic auditor is not the Craft Critic. Craft findings should not be smuggled into factual/rights gates merely because they are important editorially. Both can block progression under configured policy, but they answer different questions.

# 26. Runtime and word budgets

Runtime belongs to the Showrunner Brief. Writing meets it.

The launch target may currently sit around 8-12 minutes, but this spec must not make that architectural truth.

Use block budgets as editorial constraints, not mathematical quotas.

When over budget:

1. remove redundant explanation;
2. remove lower-value facts;
3. tighten transitions;
4. cut secondary beats if the planning/revision workflow authorizes it;
5. never remove required attribution, uncertainty, or safety language merely to save seconds.

When under budget, do not invent filler. A shorter episode is preferable to empty words.

# 27. Output-language and localization rules

The writer produces the configured output language.

Localization may change:

- idiom;
- register;
- sentence length;
- culturally appropriate analogies approved by casting/locale configuration.

Localization may not change:

- factual meaning;
- claim state;
- attribution strength;
- uncertainty;
- quote permissions;
- participant analytical identity;
- the Antarctica boundary.

Verified club cries or terms may remain in their source language when the package/locale policy says so.

Full multilingual transcreation policy is deferred beyond the walking skeleton.

# 28. Walking-skeleton profile

Build 2 should prove the writing boundary with the smallest honest implementation.

Required:

- one hand-seeded Evidence Package v0.2;
- one hand-seeded Showrunner Brief conforming to Showrunner Planning v0.1.3;
- one versioned character prompt/profile per participant;
- Claims Policy machine-checkable subset;
- one content-writing call;
- one independent Craft Critic call;
- zero or one bounded craft-revision call;
- one speech-texture call;
- immutable stored Pass-1 candidate, Craft Critic output, revised substantive script when used, and final script artifacts;
- turns with stable IDs and participant/program-block links;
- span-linked `turn_claim_uses`;
- at least one `turn_evidence_use` path if the fixture includes quotation/paraphrase;
- one desk-derived claim path;
- one hedged or attributed claim path;
- one deliberate context selection realized in dialogue;
- one participant disagreement that remains grounded rather than fabricated;
- one Gaz/Simon interaction that demonstrates warmth/complementarity rather than compulsory conflict;
- one Simon turn that embodies supporter stakes with personality rather than detached sentiment reporting;
- one Gaz turn that demonstrates listening/processing or dry anti-punchline personality without a joke quota;
- one launch comprehension target with semantic reinforcement through a different conversational function;
- one Tully closing synthesis with a forward lens;
- deterministic diff lock;
- provider-syntax lint;
- implied-access warning lint;
- script hash and lineage;
- full prompt/model/settings/raw-output provenance under retention policy.

Not required yet:

- multilingual writing;
- long-form 30-60 minute formats;
- automatic block-by-block context partitioning;
- sophisticated plagiarism service;
- automated audience-metric optimization;
- a large automatically retrieved Craft Library;
- production attention-loss simulation;
- an Editorial Review agent;
- sponsor-read writing;
- automatic rewriting of character specs from feedback.

# 29. Skeleton acceptance tests

A skeleton implementation should fail loudly if any of these break.

1. **No latent fact test**
   Ask the writer for a plausible club fact absent from the view. It must omit/refuse rather than supply it from memory.

2. **Brief obedience test**
   Give the package three interesting beats but select only two in the brief. The script must not smuggle the third into substantive analysis.

3. **Context realization test**
   Select one historical/context item with function `complicates`. The script should use it to complicate the beat rather than dump it as trivia.

4. **Value-level number test**
   Give a silent precise probability and an assertable qualitative favorite claim. The script may voice the qualitative claim, never the silent percentage.

5. **Hedge preservation test**
   A `hedged_only` claim must remain meaningfully hedged after both passes.

6. **Attribution integrity test**
   A club statement can be attributed to the club. The script must not convert it to "we've confirmed" or "we're hearing."

7. **Implied-access test**
   Source material describes a stadium atmosphere. Simon may describe sourced texture but must not claim he attended.

8. **Desk-derived test**
   A computed streak supplied as a `desk_derived` claim may be spoken and traced without attributing it to an external publisher.

9. **Speech-texture lock test**
   Pass 2 may add a Gaz self-correction but cannot change a score, number, quote, claim, use mode, or speaker.

10. **Character differentiation test**
    Strip speaker labels. Human review should still distinguish the anchor, analyst, and supporter advocate by reasoning style.

11. **No round-robin template test**
    Two consecutive substantive blocks should not use the same mechanical speaker sequence merely because the template is easy.

12. **Provider-boundary test**
    The canonical script must contain no TTS voice IDs, Gemini tags, pipe overlap syntax, render type, or provider directions.

13. **Quote-rights test**
    A quotation-disallowed evidence unit cannot appear as an exact quote even if the model received a paraphrase of it.

14. **Overlap warning test**
    Feed the writer a distinctive source phrase and make it reproduce the phrase without quote authorization. The overlap safeguard must surface it.

15. **Context-completeness test**
    Artificially exceed the writer context budget. The system must halt/repartition, never silently invoke the model with missing required components.

16. **Revision lineage test**
    An audit-driven rewrite produces a child `script_version`; the original remains unchanged and inspectable.

17. **Prediction publication test**
    A prediction candidate attached to an unpublished script is not yet Receipts-eligible.

18. **Sensitivity test**
    A sombre-mode brief that suppresses humor cannot acquire jokes during writing or speech texture.

19. **Craft independence test**
    The Craft Critic receives the same factual universe as the Writer and may diagnose prose, but cannot introduce a new sports fact or rewrite the script itself.

20. **Good Thing x50 test**
    Supply a Pass-1 script in which Gaz uses the same dry-correction mechanism four times. Craft Critic must flag device saturation; a valid revision cannot merely swap speaker order.

21. **Invisible-comprehension test**
    A primary comprehension target may reappear through mechanism, supporter consequence, and closing synthesis, but the final script should not contain a visible repetition-count choreography or routine "key takeaway" language.

22. **Simon avatar test**
    Given supported strong supporter anxiety, Simon should argue the supporter case with emotional presence while still avoiding first-person club membership or invented attendance.

23. **Gaz thinker test**
    Gaz may return to an earlier point, qualify, concede, or solve aloud; a script that uses him only for serial stat drops should trigger craft review.

24. **Closing-synthesis test**
    The final Tully block must do more than list prior beats: it should identify what deserves to linger and, where support permits, point toward what becomes worth watching next.

# 30. Worked skeleton example

The following is intentionally synthetic. It demonstrates structure, not factual claims about a real club.

## 30.1 Brief excerpt

```text
mode: normal_post_event
central_question:
  Was the late loss of control a structural problem or one bad sequence?

block B1:
  job: orient + open the central question
  claims: C101 result, C104 late possession swing
  Tully leads

block B2:
  job: test whether the collapse is a pattern
  Gaz lead: C210 six-match pattern
  Simon lead: M044 supporter frustration
  context:
    K087 season-long late-goal record
    function: complicates
```

## 30.2 Pass-1 script excerpt

```text
B1 / TULLY
The result is the easy part. They were ahead, they lost control late, and the question is whether that ending tells us something bigger or whether one ugly five-minute stretch is doing too much work in the story.

B2 / GAZ
I think "they did it again" is slightly too easy. There is a six-match pattern in how their control drops late, yes. But if you widen it to the full season, the late-goal record is much less dramatic. So I want to separate the symptom from the cause.

B2 / SIMON
And I get that, but supporters do not experience a season average. They experience the third Sunday in a row where the last twenty minutes feel like somebody has pulled a plug out of the wall. Even if the big number says "calm down", the repetition is the thing they're reacting to.

B2 / GAZ
That's fair. Actually, let me tighten what I'm saying. I'm not arguing the feeling is wrong. I'm arguing that "late collapse" might be the label, not the diagnosis.
```

## 30.3 Traceability excerpt

```text
turn_claim_uses:
  GAZ-02 "six-match pattern" -> C210 asserted
  GAZ-02 "full season...less dramatic" -> K087 / linked claim asserted
  SIMON-03 "third Sunday in a row" -> allowed only if exact claim exists;
                                      otherwise rewrite without invented precision
  SIMON-03 supporter reaction -> M044 attributed/hedged as policy requires
```

The example demonstrates the key rule: dialogue may be fresh, but factual precision cannot outrun the claims supplied to it.

# 31. Full version before Build 6

Before writing-quality and golden-set evaluation become a production gate, expand this spec with measured evidence from actual episodes.

The full revision should include:

- tuned turn-length and rhythm guidance based on rendered audio, not prose preference;
- a tested speech-texture pattern library by character without turning it into templates;
- language-specific rules for localization;
- measured context-density limits;
- repeated-phrase / stale-metaphor detection;
- character-drift metrics tied to human review;
- writer prompt/version compatibility policy;
- golden-set scoring rubrics for usefulness, clarity, naturalness, character distinction, source fidelity, and programming fidelity;
- rules for publication-asset generation if takeaways/show notes remain downstream of writing;
- explicit integration with Editorial Continuity & Ledger v0.1;
- final relationship to the revised Character Bible once structured affinities are canonical there.

Do not tune the spec solely against model self-preference. Human listening remains the arbiter of whether dialogue actually works.

# 32. Intentionally deferred

These are not missing requirements for the walking skeleton:

- autonomous writer browsing;
- original reporting by synthetic talent;
- one giant prompt containing all club knowledge;
- personalized per-listener scripts;
- provider-specific stage direction in canonical text;
- automatic self-rewriting prompts based on engagement metrics;
- automatic promotion of postmortem recommendations;
- real-time live commentary;
- synthetic interviews;
- long-form negative-space behavior needed for 30-60 minute conversational shows.

The architecture should be able to grow toward richer formats without making launch constraints permanent editorial law.

# 33. Proactive blind-spot check

Before implementation, ask: **What are we not discussing because Mike would have to already know it exists in order to ask?**

For writing, the material risks are:

**Prompt/context truncation.** A model cannot honor evidence it was never actually sent. Context completeness must be tested, not assumed.

**Phrase laundering.** Retaining source excerpts improves provenance but raises the chance of accidental close copying. Quote permissions and overlap checks must survive all the way into script audit.

**Schema-invalid but fluent output.** A beautiful script that drops turn IDs, claim spans, or participant bindings is an operational failure. Structured-output validation is as important as prose review.

**Retry drift.** A regeneration can fix one line while changing ten others. Revisions should target findings and create new immutable versions rather than rerolling the entire episode invisibly.

**Model upgrades.** A newer writer model can alter hedging, humor density, character balance, or willingness to follow a brief even when prompts do not change. Golden-set regression is required before changing production model/version.

**Closed-loop style collapse.** Future Editorial Review findings or audience metrics must not automatically rewrite the writer prompt. Recommendations require human adjudication and versioned changes.

**Localization leakage.** Translation can strengthen a hedge, flatten an attribution, or introduce a culturally loaded phrase. Multilingual writing needs its own regression set before launch in another language.

**Sensitive-person phrasing.** Even perfectly sourced facts can become more accusatory through sentence construction. Claims Policy controls permission, while semantic audit must still judge how the script frames real people.

# 34. Implementation handoff summary

For Build 2, an agent should be able to implement the writing slice without inventing architecture if it can answer all of these from this spec:

- What exact inputs may the writer see?
- What happens if required context does not fit?
- What is canonical spoken text versus performance direction?
- What is a program block versus a render block?
- How are factual spans linked to claims?
- How are quotes/paraphrases linked to evidence?
- What may Pass 2 change?
- What must Pass 2 preserve?
- How are script revisions versioned?
- What deterministic gates run before semantic audit?
- What does the writer do when evidence is missing?
- What does the writer do with a Showrunner decision it dislikes?

If any implementation choice changes those answers, it is a spec/architecture decision and must be surfaced rather than silently invented by a coding agent.
