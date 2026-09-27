# The Desk - Walking-Skeleton Contract Trace v0.3

**Status:** LOCKED FOR BUILD 1-2  
**Date:** September 26, 2026  
**Purpose:** Prove that the active specs define one coherent artifact path from frozen evidence to validated clean master before automation broadens. Supersedes v0.1.

## 1. Fixture scope

Use one synthetic or rights-safe football post-match fixture. It should be deliberately small but include enough variation to exercise the contracts:

- one verified result/stat fact;
- one attributed reporting claim;
- one `hedged_only` claim;
- one supporter-mood claim with bounded observation set;
- one lore/context claim;
- one `desk_derived` claim with reconstructable derivation;
- one silent market/calibration input that is structurally withheld from the writer;
- one continuity item or eligible prior prediction;
- one sensitivity constraint or explicit `none` state;
- one canonical pronunciation plus one current provider/voice rendering and one stale rendering;
- at least two **brief-owned** program blocks;
- at least one two-speaker render block;
- one intentional TTS reroll;
- one external-content prompt-injection string stored as inert evidence data;
- one adapter-level literal provider-syntax escaping vector.

No live ingest, no live web search, and no publication are required in the walking skeleton.

### 1.1 Fixture conformance gate

Before any implementation hashes or persists the fixture, validate each artifact against the field ownership and closed enums in its active owning spec.

The fixture must fail fast if:

- an enum value is outside the owning registry;
- a required field is missing;
- a lower-layer artifact duplicates a higher-layer source of truth;
- an artifact carries a field whose shape conflicts with the active spec;
- a fixture mutation cannot fail for the named reason.

The fixture is an executable contract, not a convenient example. If fixture bytes and an active spec disagree, the active spec wins and the fixture must be rebuilt.

## 2. Artifact chain

### A. Hand-seeded Evidence Package v0.2

**Must contain**

- package/schema/version IDs and canonical hash;
- `scope`/entity/event refs;
- explicit `availability` states;
- claims with canonical claim content hashes and frozen state-as-of;
- structured `value`/`value_type` where a precise value is gated;
- effective usage class;
- support refs and support hashes;
- rights/exposure rules using the package's consumer exposure enum;
- bounded evidence representations;
- descriptive `beats` and `signals`;
- context candidates;
- continuity;
- silent inputs with allowed consumers;
- sensitivities;
- typed coverage conditions;
- source attribution metadata;
- selection provenance;
- version refs;
- explicit absences.

**Must not contain**

- unbounded source bodies;
- live pointers as provenance truth;
- editorial beat selection;
- provider instructions.

**Hash invariant:** use Evidence Package v0.2 §23 exactly:

```text
sha256("evidence-package-v2\n" + canonical_json(semantic_manifest))
```

Operational fields such as `created_at`/`frozen_at`, worker IDs, and request trace IDs do not alter semantic identity.

**Invariant test:** rebuilding the same semantic fixture at a different execution timestamp yields the same package hash.

### B. Showrunner Brief v0.1.1

**Consumes:** planner view of the frozen package only.

**Creates**

- selected episode mode/template;
- central question/editorial spine;
- selected/omitted beats;
- context selections with functions such as `supports`, `challenges`, `complicates`, `rhymes`, `continuity`, `meaning`;
- participant leads/evidence assignments;
- ordered **program block definitions**;
- runtime budgets;
- feature/Receipts decision;
- prediction tasks if configured;
- sensitivity constraints;
- structured planning exclusions.

Program blocks are owned here. A script may reference them but may not redefine them.

`planning_exclusions` carries structured refs. A `forbidden_to_writer` restriction inherited from Claims Policy/package policy is enforced by writer-view construction, not by a sentence inside a prompt.

**Cannot create:** new facts, new evidence, stronger usage permissions, spoken wording, performance direction.

**Invariant test:** every factual premise ref in the brief resolves into the same frozen package.

### C. Script Version v0.2.1 - Pass 1

**Consumes:** deterministic bounded writer view from the same package + brief.

The writer view omits any `forbidden_to_writer` claim/evidence ref and records a context-completeness manifest.

**Creates**

- ordered references to brief-owned program blocks;
- program-block-contained turns;
- literal spoken text;
- participant IDs;
- span-linked `turn_claim_uses`;
- span-linked `turn_evidence_uses` where needed;
- prediction candidates where requested.

**Cannot create:** live-search facts, new beats, new program-block definitions, provider tags, voice IDs, render grouping.

**Invariant test:** every factual spoken span has a permitted claim-use path, and precise numeric spans compare against structured claim values rather than assertion prose.

### D. Script Version v0.2.1 - Speech-texture Pass 2

**May change:** literal verbal texture only where meaning is preserved.

**Must preserve**

- turn IDs/order;
- speakers;
- program-block membership;
- claim IDs and use modes;
- numbers;
- quote wording where exactness is required;
- prediction meaning;
- sensitivity constraints.

Pass 2 is a child immutable `script_version` with `revision_parent_id`. It never edits Pass 1 in place.

**Invariant test:** diff lock rejects a changed score/number/claim/use mode and deterministically re-anchors spans when approved text texture changes.

### E. Performance Direction v0.1.1

**Bound to:** exact final script version hash.

**Creates sparse provider-neutral intent**

- affect;
- pace;
- intensity;
- pause intent;
- non-verbal event;
- emphasis;
- overlap.

All values must use the closed v0.1.1 vocabulary and intent-row shape.

**Cannot change:** spoken text, factual meaning, attribution, sensitivity handling.

**Invariant test:** an unknown enum value is rejected; direction that materially changes meaning is rejected before render planning.

### F. Deterministic Gates + Semantic Audit

Deterministic gates remain typed `gate_results`, not an ad-hoc boolean map. Each result records:

```text
gate_key
gate_class
gate_version
input_fingerprint
status
subject refs/hashes
actor/model/adjudication where applicable
```

The semantic audit consumes the exact package + brief + final script + Performance Direction + Claims Policy version.

Audit provenance records whether the Build-2 semantic interface used a fixture stub or a real auditor model.

**Checks at minimum**

- claims-policy deterministic gates;
- writing/diff-lock gates;
- performance-direction deterministic gates;
- support/attribution;
- quote/paraphrase rights;
- implied access;
- real-person risk;
- character/product boundary;
- performance-tone risk;
- unresolved deterministic failures.

**Result:** audit is bound to the exact input fingerprint including Claims Policy version. A later artifact or policy revision invalidates that approval.

### G. Render Manifest v0.1.1

Created only after the audited chain passes.

**Creates**

- render blocks nested wholly inside program blocks;
- ordered `speaker_map` snapshots binding each turn/participant to an immutable voice-profile version;
- current pronunciation renderings;
- concrete provider/model/settings;
- bounded text-context recipe and exact resolved context;
- applied audited performance-intent IDs;
- named adapter/text-transform versions;
- base render request projection/hash.

**Cannot create:** new tone, new spoken words, new editorial structure.

Read-only bounded context may use P&R recipe `C2` and cross from the immediately preceding program block. Generated `ordered_turn_ids[]` may never cross a program-block boundary.

**Base-hash invariant:** implement Performance & Render §23 exactly. The base hash must change when spoken text, voice profile, approved intent, bounded context, applied pronunciation, model/settings, or adapter transform changes, and must remain stable for non-render admin metadata and `take_index`.

### H. TTS Takes

For each render block:

```text
base_request_hash
  + take_index / take identity
    -> immutable audio artifact
```

**Retry test:** transient provider failure repeats the same logical request without creating an intentional new take.

**Reroll test:** an intentional second take is stored separately; take 0 remains immutable.

**Concurrency test:** duplicate workers cannot bill/generate the same missing logical take concurrently.

### I. Take Selection

Create append-only selection records referencing approved/rejected takes.

**Invariant test:** rerendering/reassembling honors the current approved selection and does not silently revert to take 0. Selection history retains the prior decision.

### J. Clean Master + Assembly Map

Assembly uses:

- exact selected audio hashes;
- versioned assembly recipe;
- static editorial assets where configured;
- deterministic program ordering.

Store at least program-block offsets plus timing method/confidence.

The provider-free fixture may ship placeholder audio-artifact metadata rather than real audio bytes, but it must include the schema for takes, selections, assembly recipe/map, and final master artifact state.

**Invariant test:** the master can be explained from exact selected audio artifacts without consulting mutable current state.

## 3. Required failure drills

1. Run package construction twice with different execution timestamps: same semantic package hash, no duplicate logical package.
2. Stop after script Pass 1: resume without regenerating a different package/brief.
3. Change a claim number during Pass 2: diff lock/value gate fails.
4. Feed a literal provider-looking string such as `<laugh>` / `|don't|` into the adapter test: it is escaped/encoded as spoken content, never interpreted as control.
5. Resolve an external evidence excerpt containing prompt-injection text: it remains delimited untrusted data and never changes system/operator instructions.
6. Apply a stale pronunciation rendering: render planning blocks.
7. Kill a TTS worker after provider success but before local acknowledgement: retry reconciles or avoids duplicate billing as far as provider capability allows.
8. Reroll one block: unaffected blocks remain reusable.
9. Select take 1 after rejecting take 0, rebuild/reassemble: selection remains take 1.
10. Change only a non-render metadata field: base request hash remains stable.
11. Change one spoken word: affected base request hash changes.
12. Change voice-profile version: only affected blocks invalidate.
13. Change one approved performance intent: affected base request hash changes.
14. Change bounded context: only dependent requests invalidate.
15. Correct an applied pronunciation rendering: affected base request hash changes.
16. Change adapter transform version: affected base request hash changes.
17. Change only `take_index`: base request hash remains stable.
18. Attempt one render block containing turns from two program blocks: render planning blocks.
19. Run two workers for the same `(base_request_hash, take_index)`: one acquires the paid-call lease/unique guard; the other reuses/waits and does not make a second paid call.
20. Purge one rights-bearing evidence unit after package freeze: provenance resolves to tombstone; production replay does not substitute a newer source.
21. Introduce a confirmed sombre incident before publication: current attempt cannot silently continue as a normal show; rebuild/revalidation path is required.

## 4. Measurements to capture during the skeleton

Do not treat these as fixed architecture values:

- actual speaking rate by voice and block type;
- three-speaker provider capability;
- automatic filler/disfluency quality;
- long-block voice/accent drift;
- bounded-context quality versus cache reuse;
- overlap behavior/regression;
- TTS latency and cost per unique request;
- reroll frequency;
- word-count estimate error versus final duration;
- human-rated naturalness and character distinction.

## 5. Deliberately out of scope

- live ingest/search;
- automated Coverage Commissioning;
- production RSS/publication;
- dynamic ads;
- forced alignment;
- alternate TTS-provider failover;
- full Editorial Review;
- multilingual output;
- betting/pre-event product;
- generalized graph/vector infrastructure.

## 6. Skeleton exit criteria

The walking skeleton is complete only when:

- every fixture artifact validates against its owning active spec;
- every expected hash/fingerprint reproduces from the shared canonical serializer;
- all required failure drills fail/pass for the named reason;
- the artifact chain is inspectable from package to master;
- immutable histories survive retries/rerolls/revisions;
- paid-call concurrency protection is proven;
- the measured Render Test Kit questions have recorded results;
- no live web search occurs in normal Build-2 execution.


## Supplement S1 + ADR-003 closure requirements

Fixture v0.3 additionally contains:

- one versioned show configuration;
- canonical episode-mode and block-type registries;
- one configured `normal_post_event` rundown template;
- three participant-profile versions and voice-profile versions;
- default automatic take-selection policy;
- one pre-publish review gate definition;
- one durable READY wait/resume fixture;
- review decisions `approve | request_repair | halt`;
- Operator Repair request/plan examples for a localized performance repair and a programming repair.

Additional failure drills:

1. a normal render block must never enter a per-block human approval wait;
2. subjective acoustic dissatisfaction must not trigger an automatic reroll;
3. a required READY review cannot be bypassed into REVALIDATED without an external approval/repair resolution;
4. review timeout halts rather than publishes;
5. performance-only repair must preserve the exact script content identity and invalidate direction/audit/render downstream;
6. programming repair must invalidate Brief and all downstream artifacts;
7. factual-correction feedback must route to evidence/claims rather than directly editing spoken text;
8. repair cannot override silent/rights/sombre/implied-access gates;
9. repair leaves the original READY candidate and superseded artifacts immutable and inspectable.
