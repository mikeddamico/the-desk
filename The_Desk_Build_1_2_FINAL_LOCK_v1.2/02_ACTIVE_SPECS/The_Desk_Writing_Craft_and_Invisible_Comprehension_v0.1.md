# The Desk - Writing Craft and Invisible Comprehension v0.1

**Status:** ACTIVE - LAUNCH EDITORIAL STANDARD  
**Date:** September 26, 2026  
**Scope:** Launch post-event analysis format only unless a later show explicitly adopts it  
**Owns:** Writing-quality standard, craft critique, anti-patterns, invisible comprehension design, and launch closing-synthesis craft  
**Does not own:** Sports facts, claim permissions, source acquisition, episode mode, program-block selection, exact character canon, performance direction, TTS, monetization, or distribution

## 1. Purpose

The Desk already defines what a script is allowed to say, what an episode is programmed to discuss, and how Tully, Gaz, and Simon differ. This standard defines a different problem:

> **What makes the resulting conversation worth listening to, easy to follow under imperfect attention, and useful after the episode ends?**

For the launch post-event show, factual correctness and entertainment are necessary but insufficient. The listener should receive supportable insights they would otherwise have had to spend meaningful time finding and synthesizing, while experiencing the episode as entertainment rather than instruction.

The launch product therefore aims for four simultaneous qualities:

1. **Epistemic integrity:** everything factual or analytical remains supportable under Claims Policy.
2. **Editorial value:** the show prioritizes consequential insight and implication over box-score recitation.
3. **Invisible comprehension:** important ideas survive distracted listening without the script feeling repetitive or instructional.
4. **Entertainment craft:** the conversation feels alive, characterful, funny where appropriate, and non-formulaic.

None of these licenses the Desk to invent analysis that is absent from the evidence/claims system.

## 2. Launch-specific scope

This document is deliberately **not** a universal business-model rule for every future Desk show.

The launch format is short post-event analysis for listeners who usually know the result. Its programming strategy values efficient understanding because the show attempts to cover a whole event in roughly 8-12 minutes.

A future long-form weekly show, documentary, comedy format, interview format, or other media product may deliberately optimize for atmosphere, companionship, narrative, entertainment, or another goal. Those formats should adopt this standard only through an explicit versioned programming decision.

Do not turn "information density" into a global Desk value.

## 3. The valuable unit: supportable insight

The launch show should distinguish among four levels:

```text
FACT
    what happened
        ↓
INTERPRETATION
    how a source or supported analysis explains it
        ↓
INSIGHT
    what changes the listener's model of the event/team
        ↓
IMPLICATION
    why that matters now or what becomes worth watching next
```

Facts remain essential, but facts do not earn airtime merely because they exist.

An insight can be tactical, statistical, contextual, emotional, cultural, historical, or a supporter-texture insight. It does not default to Gaz or to numerical analysis.

Examples of **shape**, not factual assertions:

- a formation change looked decisive, but specialist reporting attributes the shift to the opponent changing its press;
- a headline stat looks encouraging, but its composition makes the result less reassuring;
- supporter anger is larger than the result because the same failure mode has repeated;
- a win changes the emotional temperature without resolving the underlying question;
- a seemingly minor incident matters because verified club history gives it unusual weight.

### 3.1 No independent insight manufacture

The Showrunner and Writer may compare, arrange, question, explain, and synthesize **within the bounds of packaged claims**. They may not create a new factual or analytical proposition simply because it would make a stronger show.

When an insight or forward implication itself makes a factual/analytical assertion, it must be supported by one or more frozen speakable claims. If The Desk creates a `desk_derived` analytical claim, that derivation belongs upstream under Claims Policy and must be frozen before the Writer may assert it.

A programming question may be original. Its answer may not outrun the claims.

## 4. The launch listener model

Podcast listening is commonly divided attention. The Desk should assume the listener may be driving, exercising, cooking, cleaning, walking, or mentally drifting in and out.

That does **not** mean writing down to the audience. It means important ideas should not depend on one fragile sentence being heard perfectly once.

The design target is:

> **A listener can miss a short window of the episode and still reconstruct the important mental model from later natural conversation.**

This property is called **comprehension resilience**.

## 5. Invisible Comprehension Design

Invisible Comprehension Design is the deliberate use of normal entertainment and conversation mechanics to improve understanding and later recall without announcing an educational technique.

The audience should not feel that the script is teaching, reviewing, drilling, or presenting "key takeaways."

The preferred experience is:

> The listener enjoys a sports show now and later discovers that the important insight is available to them when the next relevant match situation occurs.

### 5.1 Bad repetition versus useful reinforcement

The Craft Critic must distinguish these categories:

| Type | Default treatment |
|---|---|
| Surface repetition | Usually bad. Same wording or sentence shape repeated. |
| Explanatory redundancy | Usually bad. Same point explained again without new value. |
| Structural repetition | Often bad. Same speaker sequence, challenge mechanism, joke shape, or beat architecture repeated. |
| Semantic reinforcement | Often useful. A high-value idea reappears through a different consequence, context, voice, or abstraction level. |
| Callback | Useful when natural. Relies on recognition of something established earlier. |

A second encounter with an idea should normally **advance understanding**, not merely paraphrase it.

Possible progression:

```text
EXPOSURE
    what is happening?
        ↓
INTERPRETATION
    why does it matter?
        ↓
CONNECTION
    what else does it explain?
        ↓
CONSEQUENCE
    why should a supporter care?
        ↓
FORWARD LENS
    what becomes worth watching next?
```

This is a menu, not a mandatory five-stage script shape.

### 5.2 Reinforcement without a count target

Do **not** give the Writer a control such as `repeat_count`, `desired_mentions`, or `desired_reinforcement: 3`.

Those fields reward literal compliance and invite Good Thing x50.

Instead, planning identifies a small number of **comprehension-worthy targets**. Writing solves for natural reinforcement. The Craft Critic then asks whether a distracted listener gets more than one meaningful route into the core idea where that idea is sufficiently important/complex.

No episode-level numeric "insights per minute" or "facts per minute" target is permitted.

### 5.3 Comprehension requires room

The system must not optimize word count toward beat density.

Humor, a short detour, a plain-language restatement, a reaction, a pause in argumentative pace, or one idea receiving extra runway can improve comprehension even though each lowers information throughput.

When runtime is tight, cut lesser material before compressing major insight into abstraction.

## 6. The forward lens: what does this mean now?

For the launch post-event format, analysis should usually ladder toward:

> **So what does this change about how the listener should understand the team, and what becomes worth watching next?**

The horizon may be immediate, next event, near term, season, or longer-term. Not every beat needs every horizon.

Forward implication is not prediction theatre. The honest answer may be:

> "This does not answer the question yet. It gives us a cleaner thing to watch next time."

The forward lens is especially valuable as semantic reinforcement because it causes earlier analysis to reappear in a new job.

### 6.1 Support requirement

The forward lens cannot be a license for unsupported punditry.

If the script says something factual about the next opponent, schedule, injury, manager intention, tactical profile, transfer market, or likely outcome, the proposition requires the same claim lineage as every other factual assertion.

Hypothetical framing is allowed when it remains clearly hypothetical and uses only supported premises.

## 7. Craft system architecture

The Desk should not teach taste by placing a large collection of "great scripts" in the production prompt.

The craft system has five distinct pieces:

```text
COMPACT WRITING STANDARD
        +
CRAFT LIBRARY
        +
CONTRASTIVE EXAMPLES / ANTI-PATTERNS
        ↓
       WRITER
        ↓
INDEPENDENT CRAFT CRITIC
        ↓
BOUNDED WRITING REVISION
        ↓
SPEECH-TEXTURE PASS
```

### 7.1 Compact Writing Standard

The Writer receives the compact principles needed for generation. It should not receive the full craft archive on every episode.

The launch standard is:

- Write a conversation in which participants affect what comes next.
- Prefer consequential insight over recitation.
- Let evidence do argumentative work.
- Make forward implication matter, but do not manufacture certainty.
- Reinforce only the few ideas worth retaining, and reinforce by changing their conversational function.
- Make comprehension design invisible.
- Let personality create pleasure, not merely perform a functional role.
- Allow restraint. Not every turn needs a joke, stat, argument, analogy, or conclusion.
- End beats when their value is extracted.
- Do not imitate prior surface forms merely because they worked.

### 7.2 Craft Library

The Craft Library may be richer than the production prompt. It can hold:

- principles;
- annotated contrastive examples;
- anti-patterns;
- diagnoses from prior episodes;
- versioned notes on ensemble and relational writing;
- examples of restraint;
- examples of excellent closing synthesis;
- examples of semantic reinforcement that does and does not feel repetitive.

The library teaches **why** writing works, not phrases to reuse.

### 7.3 Contrastive examples

Prefer A/B/C examples of the same editorial problem over isolated "gold" passages.

A useful contrast explains:

- why A fails;
- why B fixes the obvious defect but exposes a formula;
- why C succeeds for a deeper craft reason;
- what surface features must **not** be copied.

The production Writer should see only a small, relevant example when a specific craft problem warrants retrieval. Never inject a greatest-hits corpus by default.

### 7.4 Anti-pattern taxonomy

The Craft Critic should recognize at least:

- sequential mini-essays;
- repeated Tully-question / Gaz-answer / Simon-reaction rotation;
- manufactured disagreement;
- universal neat conclusions;
- generic transitions;
- empty recap;
- stat catalogues;
- supporter sentiment reported like polling instead of embodied dramatically;
- every Gaz turn using correction/stat/pedantry;
- every Simon turn using outrage or fan-temperature language;
- every Tully turn using rhetorical provocation;
- repeated joke architecture;
- repeated analogy architecture;
- serial rhetorical reversals;
- over-explanation after the point has landed;
- pseudo-spontaneous filler;
- "key takeaway" educational language;
- semantic reinforcement that does not advance understanding;
- closing synthesis that merely lists the preceding beats.

### 7.5 Structural repetition signals

Recent-episode continuity may provide **non-factual pattern signals** such as:

```text
cold_open_shape
first_analyst
beat_entry_shape
disagreement_shape
ending_shape
feature_usage
speaker_sequence_signature
recurring_joke_device
```

These signals create pressure against accidental formula. They are not quotas and never override the natural logic of the current episode.

Novelty is not itself a goal.

## 8. Independent Craft Critic

The Craft Critic is separate from the factual/semantic episode auditor.

Its job is editorial diagnosis, not truth adjudication and not rewriting.

It may have access to a richer craft library than the Writer, but it must not receive hidden sports facts that the Writer cannot use.

The Critic asks questions such as:

- Do people respond to the specific thing just said?
- Does the conversation progress, or merely rotate speakers?
- Are the best facts used rather than merely included?
- Is there a real insight, and is its implication supportable?
- Does a high-value idea get a second natural route into the listener's head when needed?
- Does reinforcement advance the idea rather than paraphrase it?
- Does the script feel like it is teaching?
- Is any character performing a defining trait too often?
- Has a successful device become saturated within the episode?
- Are Gaz and Simon behaving like mates/complements rather than assigned opponents?
- Does Simon embody supporter stakes rather than calmly report them?
- Does Gaz listen, process, solve, qualify, or change his mind rather than dispense analysis on demand?
- Does Tully's closing synthesis make the prior conversation linger and point forward?
- Has the script become over-dense?
- Is there enough room for personality, humor, and ordinary human rhythm?

### 8.1 Critic output

The Critic should produce typed findings, for example:

```text
finding:
  finding_id
  type: device_saturation | conversational_inertia | character_caricature |
        detached_supporter_voice | over_density | brittle_comprehension |
        flat_closing_synthesis | educational_signposting | other
  severity: note | revise
  span_refs[]
  observation
  consequence
  revision_instruction
  prohibited_shortcut?
```

Good revision instruction:

> "Three consecutive exchanges use the same proposition -> statistical correction -> emotional qualification mechanism. Revise the beat so progression follows the substance. Do not merely permute speaker order."

Bad revision instruction:

> "Have Simon go first."

The Critic never supplies replacement sports facts or final prose.

## 9. Bounded writing revision

Craft review occurs **inside SCRIPTED**, before Performance Direction. It does not add a canonical lifecycle state.

Conceptual launch path:

```text
Pass 1 candidate
    ↓
Craft Critic
    ↓
0 or 1 bounded craft revision for Build 2
    ↓
Speech-texture pass
    ↓
normal deterministic + semantic audit
```

A later version may permit more than one bounded craft revision if measurements justify the cost. Launch should begin conservatively.

Every material revision remains immutable and linked by `revision_parent_id`.

The craft loop cannot:

- add facts absent from the writer view;
- weaken attribution/hedging;
- change usage permissions;
- bypass the brief;
- change episode mode;
- turn silent inputs into spoken material;
- mutate Character Bible or Writing Standard automatically.

## 10. Ensemble craft

The club is the shared object of concern in the launch desk.

No synthetic host claims club membership, but the program should not sound like three neutral contractors assigned interchangeable subject matter. Sustained attention, curiosity, frustration, humor, and care create an implicit connection among the hosts and listener.

The character contracts remain owned by the Character Bible. For craft evaluation, preserve these functional distinctions:

- **Tully:** consummate broadcaster. She understands both Gaz and Simon, shapes the room, and lands the episode.
- **Gaz:** the thinker. His first instinct is to solve, test, qualify, and connect. His humor is dry enough to resemble an anti-punchline.
- **Simon:** the emotional participant and supporter avatar. His first instinct is consequence. He can be joyful, anxious, indignant, ridiculous, wounded, hopeful, or incandescent without becoming argumentative by default.

A useful shorthand is **Gaz begins with IQ; Simon begins with EQ**. Neither lacks the other.

### 10.1 Gaz and Simon

Gaz and Simon are mates and complementary opposites, not permanent debate-team opponents.

Their warmth comes partly from shared concern for the same club. They respect the other's ability to perceive something they cannot. They can tease, collaborate, set each other up, agree, gang up on Tully, or argue intensely.

Conflict should arise from a real difference in perspective. Because affection is the baseline, genuine irritation can carry dramatic weight.

Do not make every Gaz insight provoke Simon or every Simon emotion require Gaz to correct it.

## 11. Simon: emotional salience as comprehension

Simon is especially useful to Invisible Comprehension Design because emotional reaction can encode an analytical idea a second time without sounding like explanation.

If Gaz establishes a supported mechanism, Simon may later make the supporter consequence vivid. The listener encounters the same underlying insight in a different cognitive form.

This is not an excuse to turn Simon into "angry fan mode."

Simon is emotionally expressive, not argumentative by nature. His personality should be pleasurable even when there is nothing to rage about.

## 12. Gaz: thought as entertainment

Gaz's craft advantage is not merely access to numbers.

He listens, processes, solves, and sometimes returns to an earlier point because it has been bothering him. He can change his mind, decline an easy conclusion, or discover that Simon's gut is supported.

His best humor often arrives as a flat, precise observation that barely acknowledges itself as a joke.

The Writer should not turn this into `Gaz = one dry line per beat`.

## 13. Tully's closing synthesis

The launch template should treat the end-of-show synthesis as a real editorial job, not a generic recap.

Internal working name: **closing synthesis**. Audience-facing naming is deliberately deferred until actual episodes establish the ritual.

The closing synthesis should:

- identify what deserves to linger, not list everything discussed;
- turn backward-looking analysis toward the future where support permits;
- provide a final natural route into one or more important insights;
- preserve uncertainty;
- sound like Tully has listened to the preceding conversation;
- use her broadcaster personality, including humor/callback where earned;
- build anticipation for what matters next and for the next episode.

It should not be forced into a fixed number of points, fixed joke, fixed speaker callback, or fixed sentence structure.

A listener should learn over time that the closing synthesis is worth leaning back into even if their attention wandered earlier.

## 14. Human calibration

Operator Repair remains episode repair, not automatic policy mutation.

Feedback such as:

- "Gaz is doing Gaz again";
- "Simon sounds like a reporter describing supporters";
- "the first three minutes sound written";
- "they are trying too hard";
- "I missed the actual point";
- "that ending just recapped the show";

may create an `editorial_improvement_candidate` after the episode repair is handled.

Only repeated evidence plus human adjudication may change the Craft Standard, Character Bible, examples, anti-patterns, or Critic policy.

Audience completion/retention metrics are evidence, not definitions of good writing. Do not let engagement metrics autonomously rewrite the standard.

## 15. Build 2 profile

Build 2 should rough in the mechanism without building a permanent craft platform.

Required:

- one versioned compact Writing Standard;
- one small contrastive example set;
- one versioned anti-pattern list;
- one independent Craft Critic call over Pass 1;
- zero or one bounded craft revision;
- immutable stored Pass-1 candidate, Craft Critic result, revised substantive script if used, and final speech-texture script;
- one launch comprehension target represented in the fixture;
- one example of semantic reinforcement that advances rather than restates;
- one example of Simon carrying supporter stakes with emotional salience;
- one example of Gaz's dry/processing personality without turning it into a joke quota;
- one Tully closing synthesis with a forward lens;
- one negative vector showing the Critic catches Good Thing x50 device saturation;
- one negative vector showing the Critic catches educational/key-takeaway language;
- no numeric density target;
- no reinforcement count target;
- no new lifecycle state;
- no new service or dedicated database table unless the coding-agent dry run demonstrates the existing artifact/model-run representation cannot preserve the required immutable review/provenance.

## 16. Deferred

Do not build yet:

- automatic retrieval over a large craft library;
- audience-personalized comprehension strategies;
- automatic longitudinal style optimization from engagement metrics;
- reinforcement learning from Mike's feedback;
- automatic policy rewriting;
- long-form format rules;
- academic scoring models for comprehension;
- production attention-loss simulation.

Attention-loss simulation is a promising evaluation experiment after the skeleton: deliberately remove short transcript windows and test whether an evaluator can still recover the central insight/implication. It is not a launch gate until measured.

## 17. Acceptance criteria

This standard is implemented for Build 2 when:

- the Writer is not trained by a giant few-shot greatest-hits corpus;
- positive examples teach principles and include explicit do-not-imitate notes;
- the Craft Critic diagnoses rather than rewrites;
- the craft loop is bounded and preserves claims/brief constraints;
- semantic reinforcement is distinguishable from redundant repetition;
- the launch show has no density or repetition quota;
- forward implication is claim-grounded;
- Simon can be emotionally intense without counterfeit membership;
- Gaz and Simon read as warm complementary mates, not compulsory antagonists;
- Tully's close functions as closing synthesis rather than boilerplate recap;
- the entire mechanism remains launch-format programming/writing policy, not universal Desk architecture.
