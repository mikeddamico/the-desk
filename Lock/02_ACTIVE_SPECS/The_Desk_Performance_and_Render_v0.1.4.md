# The Desk - Performance & Render Spec v0.1.4

September 29, 2026

**Status:** INACTIVE SUCCESSOR — proposed FINAL LOCK v1.2.5 owning contract. Full hardening is required before Build 7 is complete.

**Canonical authority:** Technical Architecture v1.0 and accepted ADRs govern on conflict. Claims Policy v0.1.2 governs the prospective factual, sensitive, attribution, and performance-meaning rules. Writing Spec v0.2.3 governs canonical spoken text. Showrunner Planning v0.1.3 governs program structure and runtime intent. Character Bible v0.1.4 governs enduring character behavior where it does not conflict with higher authority.

**Supersedes:** Provider/performance/render mechanics embedded in Script Spec v0.1 and Character Bible v0.1. The Render Test Kit remains a test fixture, not product canon.

**Supersedes on activation:** Performance & Render v0.1.3. The [v1.2.4 active manifest](../00_INDEX/ACTIVE_SPECS_LOCKED_v1.2.4.md) still selects the predecessor. This file does not activate v1.2.5, create Fixture v0.4.5, authorize Migration 002, or begin Completion A. It incorporates accepted R2 with the final human claim-sequence and separate prompt-manifest adjudications. Architecture and accepted ADRs remain unchanged.

P&R owns pronunciation/canonical lineage, exact voice-version application, compatibility validation, nested render selection, deterministic fixture response mapping, duration, and assembly timing. [Hashing v0.1.4](../04_IMPLEMENTATION/The_Desk_Hashing_Fingerprints_and_Text_Spans_v0.1.4.md) specifies executable projections and the bounded future eight-table migration profile. Future generated request hashes/mapping entries remain I2 work.

---

## Retained reroll, provider-ledger, and fixture boundaries

These v0.1.3 rules are retained for Builds 1–2 when this successor is activated.

### Automatic reroll trigger

Automatic reroll is legal only after a **named mechanical technical-validation failure** under a versioned policy. Subjective acoustic dissatisfaction with a technically valid take is not an automatic reroll condition; it routes through privileged override / Operator Repair.

The intentional `take_index` is allocated from a durable reroll-trigger record under the same uniqueness/lease boundary that protects the provider call. A process retry must not accidentally mint the next take index.

### One authoritative external-call and cost ledger

`provider_calls` (or an equivalently named single append-only provider-call record) is authoritative for external side effects, operational tries/retries, provider request identity, usage, latency, and actual provider cost. Semantic objects such as `model_runs` and `render_takes` reference the provider call that produced them; they must not become competing cost/retry ledgers. Any duplicated cost value on a domain row is derived/cache-only and not a source of truth.

Budget admission is checked atomically with paid-call lease acquisition. Failed paid calls remain in the provider-call ledger even when no take is produced.

### Fixture TTS

Build 2 may use a deterministic `fixture_tts` adapter that returns rights-safe synthetic placeholder audio through the exact frozen request-to-response mapping in §20.1. This proves take identity, assembly, clean-master validation, READY, review, and repair without paid credentials. Fixture audio must be unmistakably identified as test material and is not evidence of product voice quality.

### Hash/fingerprint ownership

Base request semantics remain governed by this spec. The prospective exact projections, artifact domains, gate-input fingerprints, and canonical text-span coordinates are specified by Hashing v0.1.4; the active v1.2.4 implementation remains governed by its selected predecessor contract.

---
## 1. What this spec is for

This spec owns the path from an approved canonical script to a validated clean editorial master.

It exists to keep three things separate:

```text
WRITING
literal words the listener hears
        |
        v
PERFORMANCE DIRECTION
provider-neutral, meaning-bearing delivery intent
        |
        v
AUDIT
words + performance direction judged together
        |
        v
RENDER PLANNING
mechanical/provider mapping only
        |
        v
SYNTHESIS -> ASSEMBLY -> VALIDATION
```

The central rule is:

> **Tone may affect meaning, so tone is audited. Provider mechanics may not affect editorial meaning, so they happen only after audit.**

This spec defines:

- the Performance Direction artifact and its initial vocabulary;
- the boundary between audited direction and provider-specific representation;
- voice identity and render-facing voice-profile versions;
- render manifests and render-block planning;
- bounded context and cache invalidation;
- pronunciation application;
- explicit synthesis request hashing;
- immutable takes, rerolls, and take selection;
- provider adapter responsibilities;
- audio assembly and master-map provenance;
- technical validation and failure behavior;
- walking-skeleton capability tests and acceptance criteria.

It does **not** decide what the episode is about, write dialogue, research facts, select program beats, choose episode mode, or publish RSS.

---

## 2. Precedence and retired assumptions

Where this document conflicts with older render-related language, this document governs.

| Older assumption | v0.1 rule |
| --- | --- |
| Canonical script contains TTS tags or style strings | Retired. Canonical script contains literal spoken text only. |
| Render block is the same thing as a program block | Retired. Program blocks are editorial; render blocks are synthesis units nested inside them. |
| `SOLO` / `DUO` describe canonical show grammar | Retired as product structure. They may appear only as test shorthand or adapter-local grouping labels. |
| Performance is the second writing pass | Retired. Writing pass 2 is speech texture. Performance Direction is a separate immutable artifact after writing. |
| Provider pipe syntax belongs in script text | Retired. Pipe syntax, tags, SSML-like markup, and equivalent provider syntax exist only inside the adapter. |
| Gaz's prototype persona crutch belongs in every turn | Retired. Any render-facing crutch belongs to the immutable voice-profile version. |
| Three-minute render blocks are an editorial rule | Retired. Any provider block limit is render configuration based on measured capability. |
| 150 words/minute is a universal runtime constant | Retired. Runtime estimates use measured participant/provider behavior and remain planning estimates, not truth. |

The Render Test Kit's transcripts, styles, block labels, and provider prompts are fixtures used to answer capability questions. An implementation agent must not copy their syntax into canonical script storage.

---

## 3. System boundary

The Performance & Render layer receives **approved editorial artifacts** and produces **audio artifacts**.

### Required upstream inputs

At minimum:

```text
approved script_version_id
approved performance_direction_version_id
program block definitions from the frozen Showrunner Brief
participant / character profile versions
mode and sensitivity constraints
claim/evidence protected spans needed for render safety checks
canonical pronunciation versions + provider/voice renderings
show / provider render configuration
```

The Render Manifest may not resolve new sports facts, browse, search, or retrieve source material.

### Outputs

```text
performance_direction_version
performance_intents[]

render_manifest
render_blocks[]

render_takes[]
take_selections[]
audio_artifacts[]

master_assembly_map
clean editorial master
validation gate results
```

### Material that must not enter this layer

- raw source articles, posts, transcripts, or media unless already literally present as approved spoken text;
- silent evidence or market inputs that are not spoken;
- hidden writer/planner reasoning;
- live web/search results;
- unpublished factual additions;
- commercial/ad audio when producing the clean editorial master.

The TTS provider receives the minimum material necessary to synthesize approved speech.

---

# PART I - PERFORMANCE DIRECTION

## 4. Performance Direction is an editorial artifact

Performance Direction answers:

> **How should these already-approved words be delivered so their intended meaning survives audio?**

It does not answer:

- what words to say;
- which voice asset to use;
- which turns to batch;
- how the provider encodes direction;
- where audio files are joined.

A Performance Direction version is immutable and bound to exactly one immutable script version.

```text
performance_direction_versions
  id
  script_version_id
  direction_spec_version
  producer_run_id / actor
  input_fingerprint
  direction_hash
  created_at
```

The artifact owns zero factual content beyond references to the approved script and its structural annotations.

`direction_hash` is a semantic content hash:

```text
direction_hash = sha256(
  "performance-direction-v1\n" + canonical_json(semantic_direction)
)
```

The semantic projection includes the exact bound `script_hash`, `direction_spec_version`, and ordered structured performance intents. It excludes the storage ID, producer/model run ID, actor, `created_at`, and other operational metadata.

A revised script requires a new Performance Direction version. Direction never floats across changed script versions merely because the wording looks similar.

---

## 5. Who produces direction

The stage may initially be produced by a model, deterministic rules, a human operator, or a combination. The contract is the same.

The producer receives only what it needs:

- the approved script;
- the frozen Showrunner Brief;
- stable character/performance guidance;
- episode mode;
- relevant sensitivity/protected-span annotations;
- the current Performance Direction spec.

It does **not** need raw source evidence. It may not rewrite dialogue.

Normal production should prefer sparse direction. If spoken text and stable voice identity already carry the intended delivery, **no intent is better than decorative direction**.

The goal is not to make every sentence acted. It is to preserve editorial meaning and character rhythm.

---

## 6. Performance intent model

Each intent is structured and anchored to a program block, turn, or exact text span.

Conceptually:

```text
performance_intent:
  id
  performance_direction_version_id
  scope_type: program_block | turn | text_span
  scope_ref
  intent_type
  value
  strength
  timing_anchor
  rationale_code?       # optional, short and non-factual
```

Free-form provider prompts are not canonical Performance Direction.

### 6.1 Initial intent families

The v0.1 vocabulary is intentionally small.

#### Delivery affect

Initial provider-neutral labels:

```text
neutral
warm
dry
gently_amused
curious
skeptical
incredulous
frustrated
disappointed
joyful
rueful
grave
restrained
emphatic
```

These labels describe delivery, not new opinions.

#### Pace

```text
slower
standard
quicker
building
```

`building` means pace/energy may rise through the scoped turn. It does not authorize rewriting or adding words.

#### Energy / intensity

```text
restrained
standard
heightened
```

This is separate from loudness. The adapter may map intensity to a provider-supported control, prompt cue, or nothing at all.

#### Pause intent

```text
short
medium
long
```

A pause is anchored before or after a turn/span boundary. It is not encoded into canonical punctuation solely to manipulate TTS.

#### Non-verbal event

Initial events:

```text
breath
sigh
chuckle
laugh
```

These are meaning-bearing and are therefore audited.

They should be uncommon. A written joke does not automatically earn a laugh event.

#### Emphasis

An emphasis intent points to an exact text span in one turn.

It may strengthen already-spoken wording but may not turn an uncertain proposition into a categorical one or invert the meaning of a quote.

#### Overlap

Overlap is an explicit relationship between two approved turns/spans:

```text
overlap_intent:
  foreground_turn_id
  background_turn_id
  foreground_span?
  background_span?
  placement: beginning | middle | end
  duration_class: brief | short
```

The audited artifact describes **the desired conversational event**, not Gemini pipe syntax or any other implementation.

### 6.2 No open-ended acting prompt in v0.1

For the walking skeleton, do not add a large free-text `director_note` field to every turn. It would become an uncontrolled second script and make provider drift harder to inspect.

If later listening tests show that the compact vocabulary cannot express important performance, extend the versioned vocabulary deliberately.

---

## 7. Character identity is not performance tagging

Tully, Gaz, and Simon should remain recognizable with minimal per-turn direction.

Stable acoustic/persona identity belongs primarily in:

```text
character canon
    +
voice profile / voice-profile version
```

Episode-level direction expresses **state**, not identity.

Bad pattern:

```text
Every Gaz turn:
"Mancunian, pedantic, former maths teacher, dry, precise..."
```

Correct pattern:

```text
voice_profile_version:
  stable render-facing Gaz identity / prototype crutch if still needed

performance_intent for this turn:
  affect: curious
  pace: slower
```

This is especially important for the current Gaz prototype, whose temporary persona crutch must remain a voice-profile concern rather than thousands of duplicated turn instructions.

Whether the characters' **names are spoken** is a writing/show-format decision, not a Performance & Render decision.

---

## 8. Meaning and sensitivity constraints

Performance can change meaning even when text is untouched.

Examples:

- laughing under a real-person allegation can make the treatment contemptuous;
- emphatic stress can make a hedge sound categorical;
- sarcasm can reverse the apparent meaning of a sentence;
- overlap can obscure an attribution or disclaimer;
- jaunty energy can violate a sombre episode even if every word is technically respectful.

Therefore Performance Direction is part of semantic audit.

### Deterministic direction gates

Before semantic audit, fail when:

1. an intent points to a missing script/program-block/span reference;
2. direction is attached to a different script version;
3. the selected mode forbids that intent family;
4. a laugh/chuckle or heightened jocular event occurs in a protected sombre/sensitivity scope where policy forbids it;
5. overlap intersects an exact quote, critical attribution, materially qualified factual span, protected real-person/sensitive span, or other configured protected region;
6. direction attempts to add, replace, or delete spoken text;
7. provider syntax appears in the audited direction artifact.

### Semantic audit

The independent auditor judges script **plus** direction and may return `performance_tone_risk` when delivery plausibly changes meaning, fairness, sensitivity, or character behavior.

A render adapter may never "fix" a failed direction finding by silently changing the requested delivery.

---

## 9. Performance Direction revision

A direction finding is resolved in one of two ways:

1. create a new immutable Performance Direction version and re-audit the exact script + direction chain; or
2. a named human adjudicates a false positive where the gate class permits it, with reason and exact fingerprint.

Never mutate an already-audited direction object in place.

---

# PART II - VOICE IDENTITY

## 10. Stable voice profile versus immutable render version

A voice has a durable identity and versioned render-affecting configuration.

### `voice_profiles`

Holds stable identity such as:

```text
participant_id
provider family / voice family
human-readable label
active / reserve state
```

### `voice_profile_versions`

Holds only values that can change generated audio, for example:

```text
provider
provider_voice_id
provider_model_compatibility
render-facing design/persona/crutch text actually sent or applied
request-side voice controls
version
```

If a field is not used to generate audio, it does not belong in the render-facing version.

### Measurements live elsewhere

Do not invalidate caches because somebody updated a QA note.

Measured information such as:

- observed words/minute;
- mean F0 / voice-separation measurements;
- long-block accent hold notes;
- reviewer comments;
- audition status;
- sample dates;
- car-listening intelligibility;

belongs in `voice_measurements` or equivalent non-render metadata.

If a measurement is later converted into a concrete provider setting that affects generation, that **setting** belongs in a new voice-profile version and therefore changes the request hash.

---

## 11. Prototype voice fixture

The current prototype trio may be used by the walking skeleton as configuration, not product canon:

| Participant | Current provider voice ID | Status |
| --- | --- | --- |
| Tully | `voice_547e9km49635` | Workable prototype |
| Gaz | `voice_d64rpebwvcc0` | Workable but provisional |
| Simon | `voice_dodpkirvm74x` | Workable prototype |

Current prototype TTS model ID:

```text
gemini-3.8-flash-tts
```

These values belong in environment/config-backed voice records, not in the Character Bible, script, or writer prompt.

A replacement voice creates a new immutable voice-profile version. It does not rewrite old audio history.

---

## 12. Voice/model drift

A stored voice ID does not guarantee that a provider will sound identical forever.

For each successful take, record when available:

```text
requested provider/model ID
provider-reported concrete model/revision
voice ID/version
request timestamp
provider response/request ID
```

If the provider supports a concrete pinned model version, prefer it over a floating alias for production.

If the provider can silently update a model or voice behind a stable ID, caching protects existing audio but does not protect future episodes from acoustic drift. Before production, maintain a fixed regression passage and periodically rerender/listen when:

- provider model revision changes;
- a voice profile changes;
- unexpected voice drift is reported;
- a major provider release occurs.

Do not build automated acoustic identity scoring unless manual regression proves insufficient.

---

# PART III - RENDER PLANNING

## 13. Render Manifest

The Render Manifest is created only after the exact script + Performance Direction chain has passed semantic audit or valid adjudication.

It is immutable and mechanical.

Conceptually:

```text
render_manifest:
  id
  script_version_id
  performance_direction_version_id
  audit_gate_fingerprint
  render_spec_version
  adapter_contract_version
  provider_capability_version
  show_render_config_version
  manifest_hash
  created_at
  render_blocks[]
```

It may translate approved intent into a provider plan. It may not create new tone, jokes, words, pauses, overlaps, or emotional interpretation.

A new manifest may be built for the same approved script/direction when mechanical configuration changes. That does not require rewriting the script, but any render-affecting change creates different request hashes.

`manifest_hash` is a semantic content hash:

```text
manifest_hash = sha256(
  "render-manifest-v1\n" + canonical_json(semantic_render_manifest)
)
```

The semantic projection includes the approved script/direction content identities, audit gate fingerprint, render/adapter/provider/show-config versions, and the mechanical render-block plan including each `base_request_hash`. It excludes storage IDs and timestamps that cannot affect the plan.

---

## 14. Provider capability profile

Do not hard-code Gemini quirks into program structure.

Each adapter exposes a versioned capability declaration, whether stored in config or code:

```text
supports_single_speaker
supports_multi_speaker
max_speakers_per_request
supports_overlap
supports_nonverbal_events
supports_pause_control
supports_emphasis
supports_nonspoken_context
returns_turn_timing
max_request_chars / duration if applicable
supported_output_formats
```

The capability declaration tells Render Planning what can be represented mechanically.

If an **audited** performance intent cannot be represented by the selected provider/profile, Render Planning must:

1. choose another already-approved mechanical arrangement that preserves the exact audited intent; or
2. halt with a typed unsupported-capability result.

It may **not** silently drop the intent or approximate it in a meaning-changing way.

A provider or voice fallback that materially changes acoustic identity is not an invisible retry. It requires an explicit manifest/config choice and applicable approval policy.

---

## 15. Render blocks

A render block is one synthesis request unit.

Minimum fields conceptually:

```text
render_block:
  id
  render_manifest_id
  program_block_id
  ordered_turn_ids[]
  speaker_map[]             # authoritative ordered turn -> participant -> immutable voice-profile-version binding
  provider/model/settings
  context_recipe_version
  resolved_context_refs/hash
  applied_performance_intent_ids[]
  applied_pronunciation_rendering_ids[]
  named_text_transform_versions[]
  base_request_hash
  state
```

`speaker_map[]` is snapshotted when the manifest is built and is the authoritative participant-to-voice binding for synthesis and hashing. Do not resolve a "current voice" later at provider-call time. Convenience arrays of participant IDs or voice IDs may be derived for display, but they are not a second source of truth.

### Boundary invariant

A render block must nest entirely inside exactly one program block.

```text
PROGRAM BLOCK A
  render block A1
  render block A2

PROGRAM BLOCK B
  render block B1
```

Never:

```text
PROGRAM BLOCK A | PROGRAM BLOCK B
        one render block across boundary   <- invalid
```

This invariant protects:

- editorial structure;
- ad-safe boundary resolution;
- source/claim tracing;
- deterministic rebuilds;
- later complaint investigation;
- assembly maps.

A provider request may receive bounded preceding context from earlier audio/text, but the **generated audio stream itself** cannot cross a program-block boundary.

The boundary invariant applies to `ordered_turn_ids[]`, not to read-only bounded context. Recipe `C2` may therefore include a small approved tail from the immediately preceding program block. That context is part of the request hash and may invalidate the downstream block when it changes; it never causes the generated turns themselves to belong to two program blocks.

---

## 16. Grouping turns into render blocks

Render Planning groups approved turns based on:

- provider speaker capability;
- approved overlap intents;
- provider request limits;
- measured long-block stability;
- current voice/profile compatibility;
- cache/context tradeoffs;
- program-block boundary invariant.

Grouping is not editorial sequencing. Turn order is already fixed by the canonical script.

The planner must not split a single protected spoken phrase in a way that makes meaning or pronunciation unstable without a tested reason.

No permanent one-speaker/two-speaker topology is assumed. The current prototype's Tully-solo / Gaz-Simon-pair arrangement is a measured implementation option, not show grammar.

---

## 17. Bounded context policy

Conversational continuity can improve when a renderer sees preceding text, but broad context creates cache invalidation and cost.

The policy is:

> **Use the smallest exact approved context that materially improves the rendered audio. Measure before expanding.**

### Context may contain

Only approved material such as:

- exact preceding canonical spoken turns;
- their participant identities;
- already-audited performance state needed for continuity;
- stable render-facing scene/persona configuration.

Do not create a new AI summary of the episode and send it as context. That summary could introduce un-audited factual or tonal content.

Do not send raw source text or silent evidence to TTS for "context."

### Initial recipes to test

The walking skeleton should compare at least:

```text
C0: no conversational text context
C1: bounded preceding turns within the same program block
C2: C1 + a small approved tail from the immediately preceding program block
```

Exact sizes remain configuration until measured.

The chosen recipe and exact resolved context are part of the base request identity.

### Dependency and invalidation

If render block B includes text from block A as context, a change to A may invalidate B even if B's own spoken text is unchanged.

Therefore do not promise "change one line, rerender only one block" until dependency measurements prove it.

The system should be able to explain why a changed script/voice/context caused a particular block to miss cache.

---

# PART IV - PRONUNCIATION

## 18. Canonical pronunciation versus provider rendering

Pronunciation has two levels:

```text
canonical pronunciation record
(entity keyed, versioned)
        |
        v
provider / voice-specific pronunciation rendering
```

Canonical records represent how the entity should be pronounced independent of a TTS provider.

Provider renderings represent how a particular provider/voice needs the name written or configured to achieve that pronunciation.

`pronunciation_renderings` must record the canonical pronunciation version they derive from.

### 18.1 Canonical persistence and correction history

Future Migration 002 removes `pronunciations_canonical_text_key` and adds required `entity_identity text`, `canonical_version integer`, `language text`, nullable `ipa text`, and nullable `supersedes_pronunciation_id uuid` referencing `pronunciations(pronunciation_id)`. Preserve the existing literal UUID PK and `canonical_text`.

- Canonical identity is `(entity_identity, language, canonical_version)`, unique, with a positive version.
- Entity identity, language, and canonical text are nonblank NFC text; supplied IPA is nonblank NFC. IPA is optional generally; both fixture versions supply it.
- Version 1 has no predecessor; each later version references the immediately preceding version of the same entity/language. Reject self-reference, wrong entity/language, and skipped predecessor version.
- The predecessor FK is immediate with `ON UPDATE NO ACTION ON DELETE NO ACTION`. Preserve immutable historical records; correction inserts a successor.
- `entity_identity` is a stable text key. This bounded Foundation has no entity table; do not add a fictitious entity FK or a pronunciation service.

The fixture carries canonical v1 and v2, historical Tully v1 rendering, current Tully v2 rendering, and current Gaz v2 rendering. No authoritative mutable `current`/`stale` flag is added; freshness derives from canonical lineage at planning. Old renderings remain inspectable and restorable.

### 18.2 Exact voice-version rendering and validation ownership

Future Migration 002 adds required `pronunciation_renderings.voice_profile_version_id uuid` referencing `voice_profile_versions(voice_profile_version_id)`, immediate with `NO ACTION`. Replace `(pronunciation_id, provider, version)` uniqueness with `(pronunciation_id, provider, voice_profile_version_id, version)`. Rendering version is positive; provider/rendering are nonblank text. The existing `pronunciation_id` FK identifies the exact canonical version.

| Layer | Required responsibility |
| --- | --- |
| SQL | Required fields, PK/FKs, structural predecessor lineage, positive versions, structural uniqueness, immutability. |
| Fixture validator | Interpret frozen voice render fields; verify provider/model compatibility, participant-to-voice binding, freshness, application spans, and projected request identity. |
| Render Planning/runtime | Apply that same versioned voice contract before synthesis; reject incompatible provider/model/voice, stale/ambiguous canonical selection, and wrong-speaker application. |
| P&R conformance | Exercise supported and unsupported combinations and their actual request invalidation. |

Do not add a SQL JSON trigger that interprets `voice_profile_versions.render_fields` for provider compatibility. Structural acceptance of a historical rendering does not grant its use in a new plan. Reconcile fixture voice/config copies to the three exact immutable voice versions actually selected by the resolved requests; synthesis never looks up a mutable current voice.

---

## 19. Staleness and application

Render Planning must fail if it attempts to use a provider pronunciation rendering derived from an older canonical version.

Example:

```text
canonical pronunciation version: 4
provider rendering derives_from: 3
=> RENDER_PLANNED blocked until provider rendering is regenerated/corrected
```

### Mention resolution

Prefer entity-linked mentions.

The manifest resolves each application to a concrete turn/span and entity where possible:

```text
resolved_pronunciation:
  turn_id
  start_offset
  end_offset
  entity_id
  pronunciation_rendering_id
```

Raw string matching is a fallback only.

If a string can refer to multiple entities or a homograph creates ambiguity, the system must surface the ambiguity instead of silently respelling every occurrence.

### Canonical text remains readable

The script stores the normal written name. Provider-friendly respelling is applied only in the adapter/request representation.

Pronunciation transforms may not alter the semantic spoken wording.

For Fixture v0.4.5, the applications resolve to final-revision UUIDs paired with these semantic continuity anchors and half-open Unicode code-point spans over NFC canonical text:

| Semantic turn | Span | Participant/voice |
| --- | --- | --- |
| `t03` | `[62,73)` | Tully |
| `t04` | `[0,11)` | Tully |
| `t05` | `[49,60)` | Gaz |
| `t06` | `[59,70)` | Tully |
| `t07` | `[125,136)` | Gaz |
| `t14` | `[151,162)` | Tully |

Each must resolve the real entity mention and the exact current canonical/provider/voice rendering. There is no Simon application in this fixture. Earlier script UUIDs and unrelated text spans fail even if a rendering row structurally exists.

---

# PART V - PROVIDER ADAPTER

## 20. Adapter contract

The provider adapter is the only component allowed to know provider syntax.

Its input is a typed Render Block plan. Its output is a concrete provider request and then validated provider response metadata/audio.

Conceptually:

```text
Render Block
  -> provider adapter
     -> provider request representation
     -> TTS provider
     -> audio bytes + metadata
```

Provider-specific details such as Gemini style fields, speaker declarations, pipe overlap syntax, SSML, or equivalent markup belong **inside the adapter**.

No provider syntax is written back into canonical script or Performance Direction.

### 20.1 Deterministic fixture request-to-response mapping

`fixture_tts` is a fixture/test adapter whose supported responses are a frozen mapping, not a waveform algorithm inferred from a filename or request hash. Independently resolve the eleven-field request projection in §23 and its base hash before selecting a response.

The planned `fixture_persistence_conformance.json` member contains ten literal mapping entries. Each binds adapter/model identity, corrected base hash and intentional take index to the exact provider-call UUID, succeeded terminal-event UUID, response artifact UUID, audio-row UUID, WAV member path, byte length, and WAV SHA-256. Independently reconcile all entries to reservation/event/take/audio records and actual shipped bytes:

```text
resolved request -> corrected base hash + take_index
  -> frozen mapping + exact reservation
  -> one succeeded terminal event + response artifact
  -> exact audio row/member -> SHA-256 of exact WAV bytes
```

Unknown request identities fail. No filename fallback, response swap, or automatic remapping after an input mutation is allowed. Nine base requests produce ten take responses because `rb06` has two intentional takes. Static sting and clean master are assembly objects, not extra TTS reservations. Operational retries preserve logical take identity; base calls use try 1.

Advance the fixture adapter render-contract version for this clarified representation. The mapping is authored after completed request hashes and frozen by ZIP/member integrity. It is not part of the base preimage and is not hashed back into its own adapter version.

All twelve predecessor WAV streams may stay byte-identical only because these explicit corrected request identities bind to those frozen synthetic responses/static/master bytes. Do not claim waveform regeneration from corrected hashes or proof of real speech fidelity, product durations, acoustic compatibility, or real billing.

The base ledger has fifteen reservations and fifteen succeeded terminal events: five `fixture_stub/model-v1` model executions and ten `fixture_tts` TTS executions, each with explicit usage and actual cost `"0.0000"` / `USD`. The review attempt reuses valid immutable outputs without replaying these calls. Outcomes/cost/response belong to `provider_call_events`, not inline reservation outcomes.

The rejected `rb06` take remains a provider success with retained bytes. Its measurable `unexpected_truncation` validation precedes the mechanical reroll trigger, rejected selection, take-1 reservation/response, and superseding approval. The fixture compares 6,240 observed frames to its declared 6,959-frame minimum. Retain the trigger at `2026-09-27T13:16:09Z`, reroll start at `13:16:11Z`, and causal intervening timestamps. These are synthetic test settings, not product speaking-rate rules.

---

## 21. Adapter escaping and injection safety

Canonical spoken text is untrusted with respect to provider-control syntax.

A literal character sequence in spoken text must not accidentally become an instruction because the selected provider treats it specially.

Examples include:

- angle-bracket tag syntax;
- pipe-delimited overlap syntax;
- SSML-like markup;
- delimiters used to separate instructions from transcript;
- provider-specific escape sequences.

The adapter must escape or encode literal spoken text according to the provider contract before adding its own control representation.

Test this explicitly.

A listener-facing sentence that literally contains `<laugh>` or `|don't|` must be treated as spoken content unless an audited structured intent says otherwise.

This boundary is the render-layer equivalent of prompt-injection hygiene.

---

## 22. Exact request provenance without secret leakage

For every synthesis request, retain enough information to explain exactly what affected the audio without putting secrets into durable artifacts.

Never store or hash:

- API keys;
- bearer tokens;
- signed URLs;
- secret headers;
- raw credentials.

Record instead:

- adapter/request-template version;
- concrete provider/model/voice/config fields;
- canonical request identity hash;
- provider request ID when returned;
- request/response timing and cost metadata;
- exact output audio hash.

Raw serialized provider requests may be retained only under explicit retention policy. The durable provenance promise is the canonical manifest + versions + request hash, not immortal storage of every provider payload.

---

# PART VI - CONTENT-ADDRESSED SYNTHESIS

## 23. Base render request hash

Every logical synthesis request has a base request hash computed from **explicit render-affecting projections only**.

Conceptually:

```text
v1:sha256(canonical_json({
  concrete_model_identity,
  adapter_render_contract_version,
  immutable_voice_profile_version_render_fields,
  speaker_map,
  resolved_generation_settings,
  canonical_spoken_text,
  approved_performance_intents,
  bounded_render_context,
  render_facing_persona_or_scene_config,
  applied_pronunciation_rendering_versions,
  named_text_transform_versions
}))
```

All defaults must be resolved before hashing. The same semantic request must not hash differently because one caller omitted a default while another supplied it explicitly.

### Include

Anything that can change the generated audio request or provider interpretation, including:

- exact spoken text;
- participant-to-voice mapping;
- concrete model identity/version where available;
- render-facing voice-profile fields;
- generation controls;
- applied audited intents;
- exact bounded context;
- pronunciation renderings actually applied;
- adapter/text-transform versions that alter provider input.

### Exclude

Fields that cannot affect generated audio, including:

- database row IDs used only for bookkeeping;
- created/updated timestamps;
- operator names;
- QA notes;
- measured WPM/F0;
- prior cost estimates;
- block state;
- review labels;
- unrelated upstream spec versions whose effects are already represented by hashed outputs;
- `take_index`.

Do not hash an entire database object for convenience.

### 23.1 Nested render selection

The eleven top-level fields are unchanged. Within them, select explicit render content under [Hashing v0.1.4 §7.1](../04_IMPLEMENTATION/The_Desk_Hashing_Fingerprints_and_Text_Spans_v0.1.4.md#71-exact-nested-fixture-selection):

- voice render fields are keyed by participant, retaining immutable version, provider/voice, compatibility, design, and actual request controls; exclude voice storage UUIDs and QA/admin metadata;
- speaker/spoken/context entries use the bound script's semantic turn anchor and participant, with literal approved text where applicable; structural UUIDs remain in the manifest/provenance;
- approved intents retain exact scope/content/strength/timing, resolving turn scope through the bound script's anchor map and excluding the intent PK;
- pronunciations retain canonical entity/text/version/language/IPA, provider, exact participant voice render identity, rendering version/text, and exact ordered anchor/span applications; exclude mutable status flags, rendering PKs, and redundant expected hashes;
- resolve generation defaults and named transform versions explicitly; preserve ordered turns, context, intents, applications, and transform application order.

The manifest separately validates every exact canonical/voice/turn FK. PK exclusion from render content is not permission to skip structural checks. A voice UUID relabel with identical render identity leaves the base hash unchanged; selecting another actual voice version changes it. The manifest's structural plan hash may still change when a governed FK changes. Provider syntax remains adapter-derived, outside canonical spoken text.

---

## 24. Hash conformance tests

The canonical hashing library must have fixed fixtures proving:

1. two independent callers create the same hash from equivalent resolved request inputs;
2. changing a non-render admin field leaves the hash unchanged;
3. changing one spoken word changes the hash;
4. changing a voice-profile version changes the hash;
5. changing a performance intent changes the hash;
6. changing bounded context changes the hash;
7. correcting an applied pronunciation rendering changes the hash;
8. changing an adapter transform version changes the hash;
9. changing `take_index` does **not** change the base hash.

The persisted v0.1 string form is:

```text
v1:<lowercase-hex-sha256-of-canonical-projection>
```

The request projection itself is versioned so future schema changes do not make old hashes uninterpretable.

---

# PART VII - TAKES, REROLLS, RETRIES

## 25. Take identity

A successful stochastic generation is an immutable take:

```text
(base_request_hash, take_index)
```

`take_index` starts at 0 and increments only for an intentional new generation after a prior successful/retained take or a policy-defined reroll.

The take stores:

```text
base_request_hash
take_index
audio_artifact_id / audio hash
provider request/response metadata
cost
duration
technical validation result
created_at
```

A reroll never overwrites take 0.

---

## 26. Operational retry is not a reroll

Distinguish:

**Operational retry:** the same logical take failed to return a usable result because of timeout, capacity, transient 5xx, worker crash, or similar infrastructure failure.

**Reroll:** a valid take exists, but another acoustic realization is deliberately requested.

Operational retries do not increment `take_index` by default.

If the provider supports an idempotency key, use a stable key derived from the logical take identity.

If a timeout leaves the provider-side result ambiguous and the provider offers no idempotency mechanism, the system may incur duplicate provider work. It must still persist only one canonical successful take for the logical identity and record the duplicate-call/cost anomaly in operational telemetry.

Do not solve this by silently treating retries as new editorial takes.

---

## 27. Concurrency and duplicate billing protection

Before calling the provider for a logical take, acquire the workflow/runtime's supported lease or uniqueness guard for:

```text
(base_request_hash, take_index)
```

A duplicate worker should discover the existing/in-flight result rather than issue another paid request.

Do not introduce Redis solely for this in v0.1 if the workflow/database concurrency mechanisms already provide the needed guarantee.

---

## 28. Take selection

`take_selections` is append-only history of which take is approved or rejected for a base request.

Conceptually:

```text
take_selection:
  base_request_hash
  take_index
  decision: approved | rejected
  actor / policy
  reason_code
  created_at
```

A later approval supersedes earlier approval in the current projection but does not delete history.

### Default skeleton behavior

For the walking skeleton:

1. synthesize take 0;
2. run technical validation;
3. if it passes, select take 0 under named policy `auto_approve_on_technical_validation` unless the fixture explicitly exercises a policy-permitted reroll;
4. generate take 1 for one selected block;
5. reject/approve deliberately;
6. rebuild the manifest/master and prove the selected take remains honored.

A future manifest encountering the same base request must use the current approved take rather than silently defaulting to take 0.

---

## 29. Fallback behavior

A provider outage is not permission to change cast.

Do not automatically:

- switch TTS provider;
- switch to a reserve voice;
- collapse to a single host;
- remove an audited overlap;
- drop performance intents;
- substitute a different model family.

Those may become explicit degraded product modes later, but each changes the listener-facing product enough to require deliberate specification and measurement.

For v0.1, bounded retry then typed halt is safer than invisible format mutation.

---

# PART VIII - SYNTHESIS OUTPUT

## 30. Audio artifact validation at take level

A provider response is not a valid take merely because the API returned 200.

At minimum validate:

- audio bytes are non-empty;
- declared container/codec can be decoded;
- duration is positive and below configured absurdity limits;
- sample rate/channels are known or normalizable;
- the audio hash is computed after bytes are durably stored;
- provider metadata is structurally valid;
- gross silence/zero-byte corruption is absent.

Useful but initially soft/manual checks include:

- unexpected clipping;
- extreme leading/trailing silence;
- severe pronunciation failure;
- wrong speaker/voice identity;
- model hallucinating provider instructions aloud;
- overlap rendered sequentially when overlap was requested.

Acoustic taste should not be disguised as deterministic correctness.

### 30.1 Exact duration projection

For the fixture's declared decimal seconds, use nonnegative decimal text (digits with an optional fractional part; no sign, exponent, or non-finite value) and exact arithmetic:

```text
duration_ms = floor(duration_seconds * 1000 + 0.5)
```

This rounds to nearest integer millisecond, with ties upward. Examples: `0.000499 -> 0`, `0.000500 -> 1`, `0.001500 -> 2`, `0.144979 -> 145`, `1.189979 -> 1190`. Reject malformed/negative values and values beyond the Foundation integer column's range. Binary floating-point rounding is invalid.

Retain exact declared decimal text/precision, sample rate, frame count, format, channels, byte length, and SHA-256 in immutable artifact metadata. Validate the declared rounded decimal against the exact `frame_count / sample_rate_hz` rational at its declared precision. The selected reroll has `6959/48000` seconds and the clean master `57119/48000`; their six-place decimal strings represent those rationals rounded to six places. A rounded row millisecond is a storage/display projection, not assembly timing authority. Positive take duration is checked from frames, even if a lawful very short duration rounds to 0 ms.

---

## 31. Speaking-rate measurements

Planning works in runtime budgets; synthesis produces actual seconds.

Observed speaking rate should be measured per voice/profile and, where useful, by broad pace intent.

Use these measurements to improve estimates, not to mutate already-approved scripts automatically.

Measured WPM/seconds-per-word is non-render metadata and does not enter the base request hash unless it is converted into an actual provider control.

The skeleton must record measured rates for Tully, Gaz, and Simon rather than assuming a universal 150 WPM.

---

# PART IX - ASSEMBLY

## 32. Clean editorial master

The first assembled product is the **clean editorial master**.

It contains:

- approved editorial speech/audio;
- show sting/ident where planned;
- approved editorial music/sound assets if any;
- no dynamically inserted commercial audio;
- no listener-specific treatment.

Commercial variants are downstream.

This preserves the system boundary:

```text
EDITORIAL MASTER
     |
     +--> public commercial variant
     +--> premium/ad-free variant
     +--> future distribution treatments
```

Do not make ad technology define editorial pacing.

---

## 33. Assembly recipe

Assembly is deterministic given exact selected input artifacts and exact transform configuration.

Version and record at least:

```text
assembly_recipe_version
ordered audio artifact hashes
normalization settings/version
sample-rate/channel output target
trim policy/version
join/gap policy/version
fade policy/version if used
static asset hashes
```

Any processing that changes final bytes belongs in the assembly recipe identity.

The master artifact has its own content hash. It is not identified merely by the script or render manifest.

Keep the exact selected byte hashes, static sting position, actual concatenation order, and transform settings. The recipe hash uses only these byte/settings semantics, not added storage UUIDs. It may remain unchanged only if that complete projection remains identical. Generated hash comparisons belong to I2.

---

## 34. Master assembly map

The assembly map is the explanation of how exact audio artifacts became the master.

For the fixture, assembly timing authority is exact integer frame arithmetic at the declared common output sample rate. Derive starts/ends cumulatively from selected frame counts and transformations; never sum rounded `duration_ms` rows. Millisecond/decimal offsets are derived displays.

Minimum fixture map shape (storage IDs/self hash and derived displays remain outside its semantic projection):

```text
master_assembly_map:
  master_audio_artifact_id      # audio row UUID
  master_artifact_id            # underlying artifact UUID
  master_audio_hash
  assembly_recipe_id
  assembly_recipe_hash
  sample_rate_hz
  selected_audio_hashes[]
  segments[]:
    kind                        # speech | static
    audio_artifact_id           # audio row UUID
    artifact_id                 # underlying artifact UUID
    audio_sha256
    render_block_id             # null for static
    render_take_id              # null for static
    take_selection_id           # null for static
    program_block_id            # null for inter-block static
    start_frame
    end_frame
    join_metadata
  program_block_offsets[]:
    program_block_id
    start_frame
    end_frame
  timing_method
  timing_confidence
```

Derived millisecond/decimal offsets may be displayed separately. Optional actual turn timings require an explicit versioned projection extension; none are fabricated for this fixture.

### Required timing

For v0.1, exact **program-block** start/end offsets are required.

Turn-level timing is optional unless:

- the provider returns it reliably; or
- a measured product/operational need justifies alignment.

Do not add forced alignment to the walking skeleton merely because the schema can represent it.

Potential `timing_method` values include:

```text
assembly_exact
provider_timing
forced_alignment
mixed
```

Program-block offsets derived from concatenation/assembly are exact even when turn timing inside a multi-speaker take is unknown.

The fixture map binds the exact recipe row/hash, master audio row/underlying artifact/hash, selected speech render/program blocks, approved take/selection lineage, and ordered speech/static byte hashes. A static sting has an explicit inter-block placement and no invented render-take identity. The map's own PK/artifact ID are excluded from semantic content. [Hashing v0.1.4 §4.5](../04_IMPLEMENTATION/The_Desk_Hashing_Fingerprints_and_Text_Spans_v0.1.4.md#45-assembly-recipe-and-map) defines the exact frame-map projection.

Foundation distinguishes `audio_artifacts.audio_artifact_id` (audio row) from its underlying `artifacts.artifact_id`. `render_takes.audio_artifact_id` and READY's master binding target the underlying artifact UUID; `master_assembly_maps.master_audio_artifact_id` targets the audio row UUID. Verify both bindings and the exact selected bytes. Do not fabricate turn timing or introduce forced alignment.

### 34.1 READY and isolated repair examples

Use normal Foundation READY transition behavior: a production-purpose, publication-disabled fixture run mints its Episode/GUID/pubDate once and a candidate Episode-version UUID. Fixture data describes the expected binding/query, not literal rows for these runtime-minted identities. Rebuilds in the same unpublished run reuse Episode/GUID. Evaluation remains barred from READY. READY hashes do not depend on the subsequently minted IDs.

Approve, halt, timeout, performance repair, and programming repair are mutually exclusive reset scenarios. Bind human decisions to the actual minted candidate. Repair examples prove immutable request, typed plan, separate human confirmation, and causal child fork in `PENDING`; they do not fabricate repaired scripts/takes/masters or completed child READY histories. Performance repair preserves script identity and invalidates from direction; programming repair invalidates Brief and downstream artifacts. The original READY parent remains unchanged. A child actually rebuilt later must receive fresh gates and review. Full live revalidation/publication remain deferred.

---

## 35. Immutable published audio history

Audio artifacts are content-addressed/immutable.

A selected-take change before publication produces a new candidate master/map rather than mutating the old master bytes.

Once an episode version is published, its canonical editorial master must not be silently replaced beneath historical provenance. Corrections or withdrawals follow the episode/versioning rules in Technical Architecture v1.0.

---

# PART X - VALIDATION AND GATES

## 36. RENDER_PLANNED gates

Before entering `RENDER_PLANNED`, prove:

1. exact script and Performance Direction versions have a clean/valid audit result for their fingerprint;
2. every render block references only turns from that script;
3. every render block nests within one program block;
4. every participant has a valid compatible voice-profile version;
5. provider capabilities can realize all required audited intents;
6. pronunciation renderings are current and unambiguous;
7. exact bounded context resolves;
8. provider/model/settings/defaults are concrete;
9. base request hashes are generated by the canonical projection/version;
10. no secrets or source evidence are embedded in the manifest.

A failure here blocks synthesis rather than letting the adapter improvise.

---

## 37. SYNTHESIZED gates

Before entering `SYNTHESIZED`:

- every required render block has at least one technically valid successful take;
- every base request has one effective approved take selection;
- selected audio artifacts exist durably and hashes resolve;
- no selected take belongs to a different base request;
- required provider metadata/cost/duration has been recorded.

---

## 38. ASSEMBLED gates

Before entering `ASSEMBLED`:

- all assembly inputs are exact approved audio hashes or versioned static assets;
- every required program block appears in order;
- no unexpected or duplicate block is inserted;
- the assembly recipe is versioned;
- the master and assembly map are written atomically enough that a crash cannot leave an unexplained master;
- map offsets fall within the actual master duration.

If assembly fails halfway, retry from immutable inputs. Do not regenerate TTS unnecessarily.

---

## 39. VALIDATED gates

Technical master validation fingerprints the exact master + assembly map.

At minimum:

- master decodes end to end;
- byte size is sane and non-zero;
- duration is sane relative to the planned runtime tolerance;
- target loudness is within configured tolerance;
- unexplained long gaps/silence are absent;
- required program-block boundaries resolve;
- assembly-map total duration agrees with master duration within tolerance;
- each map input hash exists;
- sample/container properties meet distribution requirements;
- no stale gate/override from a different artifact fingerprint is being reused.

Soft warnings may include small runtime deviations or aesthetic join concerns. Missing audio, undecodable audio, wrong artifact hashes, or map/master mismatch are deterministic blockers.

---

# PART XI - FAILURE, COST, AND OPERATIONS

## 40. Failure classification

Use the architecture's failure classes.

### Retryable operational failures

Examples:

- 429/capacity;
- provider 5xx;
- network timeout;
- transient storage failure;
- worker interruption.

Use bounded retry with provider-aware backoff/jitter and durable checkpoints.

### Non-retryable request failures

Examples:

- invalid provider schema;
- unsupported voice/model pairing;
- request too large under known limits;
- stale pronunciation rendering;
- unsupported audited intent;
- adapter serialization bug.

Fail immediately and surface a typed reason. Repeatedly sending the same invalid paid request is not resilience.

### Editorial rebuild required

If the only way to proceed changes spoken meaning or audited performance intent, return upstream for a new artifact/version. Do not repair it inside render planning.

---

## 41. Cost controls

Track actual:

- provider characters/tokens if supplied;
- generated audio seconds;
- request count;
- successful/failed call costs;
- reroll cost;
- assembly compute cost where meaningful;
- cache hits/misses and why a miss occurred.

The workflow should have configurable ceilings for:

- maximum synthesis attempts per logical take;
- maximum automatic rerolls per block/run for named mechanical failures;
- maximum TTS spend per program-run attempt;
- maximum generated seconds relative to planned runtime.

A runaway loop should halt, not keep buying audio.

---

## 42. Observability

Every render operation should be traceable by the program-run attempt/correlation ID through:

```text
script version
-> performance direction version
-> audit result
-> render manifest
-> render block
-> base request hash
-> provider call / take
-> selected audio hash
-> assembly map
-> master hash
-> validation result
```

Useful structured events include:

- render plan created;
- cache hit/miss + invalidation reason;
- provider call started/succeeded/failed;
- take created;
- take selected/rejected;
- pronunciation stale/ambiguous;
- assembly started/completed;
- master validation failed/passed;
- spend threshold warning/halt.

Do not log secrets. Avoid logging full provider request text by default when hashes/IDs suffice.

---

# PART XII - CURRENT PROVIDER MAPPING

## 43. Gemini mapping is adapter behavior, not canon

The current prototype uses Gemini TTS. Its exact controls remain inside the Gemini adapter.

Examples of adapter-local behavior may include:

- mapping `affect + pace + intensity` into a short style field;
- mapping non-verbal events into supported provider syntax;
- mapping an audited overlap intent into pipe syntax where the tested provider behavior supports it;
- applying provider-friendly pronunciation respellings;
- composing the current Gaz render-facing crutch from `voice_profile_version` rather than writing it into each turn.

If a future provider uses SSML, numeric prosody controls, separate speaker roles, or no performance controls at all, the canonical script and audited Performance Direction stay unchanged.

The adapter should implement an explicit mapping table from canonical intent vocabulary to provider representation. Unsupported mappings fail visibly.

---

## 44. Provider request representation is derived

The exact provider transcript/request may differ from canonical spoken text because it can contain:

- escaped provider control characters;
- pronunciation respellings;
- provider direction metadata;
- speaker declarations;
- overlap encoding;
- bounded context in a provider-supported non-spoken channel.

That representation is a **derived artifact**.

It must be possible to trace every difference back to:

- a named adapter transform;
- an approved performance intent;
- a pronunciation rendering;
- a voice/profile setting;
- or provider-required escaping.

There is no miscellaneous "TTS cleanup" step allowed to rewrite speech.

---

# PART XIII - WALKING SKELETON

## 45. Build 2 minimum implementation

The walking skeleton needs enough of this spec to prove the architecture, not a production audio platform.

Implement:

1. one immutable Performance Direction version bound to the hand-seeded script;
2. structured intents for a small number of turns, including at least one pause/non-verbal/emphasis or overlap case;
3. deterministic direction gates;
4. semantic audit of script + direction before Render Planning;
5. current voice-profile versions for Tully, Gaz, and Simon;
6. one current-provider adapter;
7. render blocks that obey program-block nesting;
8. explicit v1 base-request hashing;
9. one pronunciation rendering application and stale-version test;
10. bounded-context experiment/recording;
11. immutable take 0 for every block;
12. one deliberate reroll and take-selection change;
13. clean-master assembly from exact audio hashes;
14. assembly map with program-block offsets;
15. technical master validation;
16. stored cost/duration/cache observations.

No alternate TTS provider, automatic voice fallback, forced alignment, distributed audio service, or sophisticated audition UI is required.

---

## 46. Build 2 capability measurements

The skeleton must turn the open Render Test Kit questions into measured facts.

### A. Three speakers in one request

Test whether the current provider/model reliably supports Tully + Gaz + Simon in one synthesis call.

Record:

- supported/refused;
- voice separation;
- instruction adherence;
- whether direction/overlap remains reliable;
- any quality degradation versus one/two-speaker calls.

Do not change show structure merely because it technically accepts three speakers. Quality decides whether the capability is useful.

### B. Automatic filler/disfluency behavior

Compare provider automatic disfluency behavior, if available, against canonical written speech texture.

The default remains: words the listener hears belong in canonical text. Automatic filler should not introduce uncontrolled new spoken words into factual/claim-bearing speech.

If the provider inserts unpredictable literal words, treat that as a product risk rather than a free naturalness feature.

### C. Long-block drift

Render a continuous multi-minute block and test:

- voice consistency;
- accent hold;
- energy drift;
- speaker confusion;
- instruction decay;
- whether a provider cap is actually needed.

Any block-duration ceiling becomes render config based on this measurement, not character/script canon.

### D. Gaz accent hold

Specifically measure whether the provisional Gaz voice remains recognizably Mancunian/consistent through longer material and emotional transitions.

If it does not, prefer recasting/re-cutting the voice over increasingly large prompt crutches.

### E. Bounded context quality and cache reuse

Compare C0/C1/C2 context recipes.

Measure:

- audible continuity improvement;
- cost/request size;
- how many later blocks invalidate after an early edit;
- whether cache reuse remains worthwhile.

Choose the smallest recipe that materially improves output.

### F. Speaking rates

Measure actual rendered words/minute or equivalent for each prototype voice under typical `standard` delivery and at least one pace variation.

Feed the observations back into planning/runtime estimates later. Do not rewrite existing scripts to chase a theoretical WPM target.

### G. Existing overlap regression

The custom Gaz/Simon overlap path has worked in prototype testing. Re-run the known overlap fixture inside the adapter contract and record whether it remains reliable under the current model/version.

A previously successful prototype does not eliminate regression testing.

---

## 47. Walking-skeleton acceptance tests

At minimum the skeleton must prove all of the following.

1. **Clean-script invariant**
   The canonical script contains no provider tags, voice IDs, pronunciation respellings, or pipe syntax.

2. **Direction binding**
   Performance Direction for script version A cannot be attached to changed script version B.

3. **No direction text mutation**
   A direction producer attempting to change spoken words is rejected.

4. **Sombre intent block**
   A forbidden laugh/chuckle/heightened intent inside a protected sombre block fails deterministically.

5. **Protected overlap block**
   An overlap across an exact quote or critical attribution span fails.

6. **Audit ordering**
   Render Manifest creation is blocked until the exact script + direction fingerprint has passed audit/adjudication.

7. **Manifest cannot invent tone**
   An adapter/render planner cannot add a non-verbal event absent from approved Performance Direction.

8. **Program-block nesting**
   A render block containing turns from two program blocks is rejected.

9. **Provider capability failure**
   An unsupported audited intent halts instead of being silently dropped.

10. **Hash exclusion**
    Editing an admin note or measured WPM leaves the base request hash unchanged.

11. **Hash inclusion**
    Changing spoken text, voice version, direction, context, model setting, or applied pronunciation changes the base hash.

12. **Take identity**
    Take 1 has the same base request hash as take 0 and both artifacts remain stored.

13. **Selection persistence**
    After take 1 is approved, rebuilding the same manifest still selects take 1 rather than defaulting to take 0.

14. **Stale pronunciation block**
    Advancing a canonical pronunciation version makes an older derived provider rendering invalid for new Render Planning.

15. **Homograph ambiguity**
    A fallback string match with ambiguous entity identity produces an explicit ambiguity result.

16. **Bounded-context invalidation**
    Changing preceding context invalidates only requests whose exact hash projection includes that changed context.

17. **Adapter escaping**
    Spoken text containing provider-special delimiter/tag characters remains literal and cannot become an accidental instruction.

18. **Duplicate-worker guard**
    Two workers attempting the same logical take do not both create distinct canonical takes or duplicate normal provider calls where the chosen runtime can prevent it.

19. **No source leakage**
    A fixture containing restricted/source-only evidence proves that only approved spoken text reaches the TTS request.

20. **Exact assembly provenance**
    The assembly map points to the exact selected audio hashes in the exact order used to create the master.

21. **Master mismatch detection**
    Removing/swapping one assembly artifact causes VALIDATED to fail.

22. **Model provenance**
    A take records requested and provider-reported model identity where available.

23. **Technical corruption**
    Empty/undecodable audio fails before SYNTHESIZED/VALIDATED.

24. **Cache measurement, not assumption**
    The skeleton records actual cache reuse/invalidation under an early-script edit and a voice swap.

---

# PART XIV - BUILD 7 HARDENING

## 48. What becomes full before Build 7 is done

After the skeleton proves the contracts, Build 7 hardens them for unattended operation.

Required maturity includes:

- tested provider capability/config versioning;
- stable intent-to-provider mapping;
- measured bounded-context recipe;
- explicit per-provider request limits;
- robust concurrency/idempotency behavior;
- quota/backoff/cost ceilings;
- current pronunciation correction propagation;
- deterministic base-hash fixtures in CI;
- durable take-selection behavior;
- unattended assembly recovery;
- master/map validation strong enough for publication;
- provider/model regression fixture and runbook;
- operator visibility into failed blocks, takes, costs, and rerolls;
- clear typed halts rather than silent fallbacks.

Still do not add a second TTS provider unless a concrete reliability/cost/product need justifies it.

---

# PART XV - OPERATOR EXPERIENCE

## 49. What an operator should be able to inspect

Without reading raw logs, an operator should be able to answer:

- Which script/direction/audit created this audio?
- Which program block and turns are in this render block?
- Which provider/model/voice versions were used?
- What performance intents were mapped?
- What pronunciation renderings were applied?
- What bounded context was included?
- Was this a cache hit?
- How many takes exist and which is approved?
- Why was another take rejected?
- What did the block cost and how long did it render?
- Which exact audio hashes became the master?
- Which validation gate failed?

A reroll is automatic only for a named mechanical failure covered by the hard validation policy, within configured bounds. A reroll for subjective acoustic judgement requires an Operator Repair request/confirmed repair plan. Never "try again until it sounds nice."

---

# PART XVI - SECURITY, PRIVACY, RIGHTS, AND BLIND SPOTS

## 50. Minimum-data exposure to TTS providers

The TTS provider is an external processor. Send only what is necessary to render the episode.

Normally it needs:

- approved spoken text;
- participant/voice mapping;
- approved performance direction in provider form;
- minimal bounded approved context;
- pronunciation/provider controls.

It normally does **not** need:

- source URLs;
- reporter/forum identities;
- raw evidence excerpts not spoken;
- silent betting/market inputs;
- internal confidence notes;
- Showrunner rejected beats;
- hidden audit findings;
- user/account data.

Provider retention/training terms belong in Engineering Standards & Security / rights operations before production launch.

---

## 51. Render request retention

The system needs explainability without needlessly retaining transformed prompt/request text forever.

Durably preserve:

- canonical script and direction artifacts;
- render manifest;
- versions/IDs of all render-affecting inputs;
- exact base request hash;
- provider request/response IDs where available;
- output audio hash and technical metadata.

Any full serialized provider payload is retained only according to explicit provider/data-rights policy.

A later purge may make byte-for-byte request reconstruction impossible if external/source-derived material had to be removed upstream. Preserve the recorded request hash/tombstone rather than promising impossible historical regeneration.

---

## 52. Provider supply-chain and model change

TTS is a production dependency. Before launch, operational ownership must answer:

- who notices provider outage or quality regression;
- where quotas and billing alerts fire;
- how a compromised/revoked API credential is rotated;
- what model/voice changes require regression listening;
- what the kill switch disables;
- whether a bad model release pauses synthesis or permits a pinned fallback already approved in configuration.

Do not let the first person who notices be a listener posting that Gaz suddenly sounds different.

---

## 53. Audio rights and derived assets

The clean editorial master is a derived editorial artifact, not permission to ignore rights constraints on underlying spoken quotations or licensed assets.

Assembly may include only static music/sting assets with documented rights for the intended distribution.

Commercial treatment remains downstream. Host-read sponsorship and DAI behavior are not implemented by this spec.

---

# PART XVII - DELIBERATE DEFERRALS

## 54. Not in v0.1 implementation

The schema/interfaces may represent these where cheap, but do not build them without present need:

- alternate TTS provider routing/failover;
- automatic single-host degraded episodes;
- forced alignment for turn-level timing;
- real-time/streaming synthesis;
- video/avatar/lip-sync output;
- listener-selectable voices;
- per-listener audio variants;
- automatic acoustic quality scoring replacing human listening;
- generalized sound-design engine;
- automated mastering based on content semantics;
- dynamic ad insertion;
- autonomous voice recasting;
- AI-generated music beds;
- automatic Editorial Review-driven prompt changes.

---

# PART XVIII - QUESTIONS TO MEASURE, NOT DECIDE IN PROSE

## 55. Open measured questions

The following are implementation experiments, not architectural ambiguity:

- Does three-speaker synthesis meet quality requirements?
- What bounded context materially improves continuity?
- How much cache reuse is lost as context expands?
- What render-block duration avoids voice/accent drift?
- Does the current Gaz voice remain good enough, or should it be re-cut?
- How sparse can performance direction be while still improving audio?
- Does automatic non-verbal/filler behavior add uncontrolled words?
- What actual speaking-rate distributions should inform runtime estimates?
- Does provider overlap remain stable under the current model revision?
- Are program-block offsets sufficient for initial operations, or does a measured need justify turn alignment?

Record results as measurements/configuration changes. Do not promote today's answers into permanent editorial rules.

---

# PART XIX - DEFINITION OF DONE

## 56. Skeleton-grade done

Performance & Render v0.1.4 is implemented at skeleton grade when one hand-seeded episode can move through:

```text
SCRIPTED
-> PERFORMANCE_DIRECTED
-> AUDITED
-> RENDER_PLANNED
-> SYNTHESIZED
-> ASSEMBLED
-> VALIDATED
```

and an operator can inspect the complete lineage from exact script turn to final master audio hash.

The skeleton must also prove the acceptance tests in section 47 and record the capability measurements in section 46.

---

## 57. Full Build-7 done

Build 7 is complete when:

- render behavior is entirely behind this contract rather than prototype scripts;
- provider syntax exists only in adapters;
- performance direction is sparse, audited, and immutable;
- explicit hash projections are covered by CI fixtures;
- rerolls are immutable and selections persist;
- pronunciation corrections invalidate only affected render requests;
- render blocks never cross program blocks;
- bounded-context invalidation is understood and measured;
- synthesis retries are bounded/idempotent as provider capability permits;
- clean masters and maps can be assembled/recovered unattended;
- master validation is sufficient for publication;
- cost/quota/quality regressions are observable;
- a provider/model/voice regression runbook exists.

At that point Performance & Render is no longer prototype plumbing. It is a durable production boundary between editorial artifacts and audio-generation technology.

---

# Appendix A - Canonical object summary

```text
SCRIPTED
  script_version
  turns
  claim/evidence span uses

PERFORMANCE_DIRECTED
  performance_direction_version
  performance_intents

AUDITED
  audit_run + gate fingerprint

RENDER_PLANNED
  render_manifest
  render_blocks
  voice_profile_versions
  pronunciation_renderings
  base_request_hashes

SYNTHESIZED
  render_takes
  take_selections
  raw/block audio_artifacts

ASSEMBLED
  clean master audio_artifact
  master_assembly_map

VALIDATED
  gate_results bound to exact master + map fingerprint
```

---

# Appendix B - The seam test

When deciding where a new field or behavior belongs, ask:

**Does it change the words heard?**
Writing.

**Does it change how approved words are meaningfully delivered?**
Performance Direction, before audit.

**Does it merely translate approved delivery into a provider request?**
Render Manifest / provider adapter, after audit.

**Does it change generated audio bytes?**
It belongs in an explicit render hash projection or assembly recipe.

**Does it only describe what happened after generation?**
Measurement/telemetry, not the render hash.

That test should prevent TTS constraints from becoming editorial grammar as providers change.


## ADR-003 clarification: take selection and episode repair

Take selection is an immutable decision record, not a routine human checkpoint. The default selector is `auto_approve_on_technical_validation`; `actor`/`policy` records that automated decision. Human take selection exists only as an override or as the consequence of a confirmed Operator Repair plan.

There is no render-block-level `awaiting_operator` state on the normal path. Whole-episode subjective judgement belongs at the optional READY pre-publish review gate. If feedback concerns performance, pronunciation, overlap, or render planning, Operator Repair identifies the earliest affected layer and creates new immutable downstream artifacts. Existing takes may be reused only where the canonical base request hash remains unchanged.
