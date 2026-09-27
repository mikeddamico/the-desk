# The Desk — Hashing, Fingerprints & Text Spans v0.1.2

**Status:** ACTIVE BUILD 1–2 IMPLEMENTATION CONTRACT  
**Date:** September 27, 2026  
**Supersedes:** v0.1.1  
**Authority:** Technical Architecture v1.0 + active owning specs. This document makes already-required hashing/fingerprint mechanics executable; it does not create editorial policy.

## 1. Canonical serializer

All hash-bearing semantic projections use one serializer:

- validate to JSON-compatible semantic values before hashing;
- strings and object keys normalized to Unicode NFC;
- reject duplicate keys created by normalization;
- object keys sorted by Unicode **code point** ascending, not locale and not JavaScript UTF-16 default sort;
- arrays preserve owning-spec semantic order; owning projections sort semantically unordered collections explicitly;
- compact UTF-8 JSON, literal non-ASCII (`ensure_ascii=false` semantics);
- reject `undefined`, NaN, infinities, cyclic objects, unpaired surrogates, and unprojected class/object instances;
- binary floating-point values are forbidden in semantic projections; represent exact decimals as canonical strings or fixed integers under the owning contract;
- semantic timestamps included in a projection use RFC 3339 UTC `Z`; operational timestamps are excluded unless an owning contract explicitly makes them semantic.

For the domain-separated artifacts in this document, hash bytes are:

```text
sha256(domain_separator + "\n" + canonical_json(semantic_projection))
```

Hex output is lowercase. Never hash a persistence/database row merely because it is convenient.

TTS base-request hashes retain the separate `v1:sha256(canonical_json(projection))` form owned by Performance & Render v0.1.3.

## 2. Script revision-parent identity

For `script-v2` projections:

- root script: omit `revision_parent_content_identity`;
- child script: `revision_parent_content_identity` is the **parent script content hash**, not a database ID.

The parent hash participates in the child's semantic identity.

## 3. Artifact domains used by Build 1–2

| Artifact / projection | Domain separator |
| --- | --- |
| Evidence Package semantic manifest | `evidence-package-v2` |
| Showrunner Brief | `showrunner-brief-v1` |
| Writer view | `writer-view-v1` |
| Writer context manifest | `writer-context-manifest-v1` |
| Script version | `script-v2` |
| Writing Craft review | `writing-craft-review-v1` |
| Performance Direction | `performance-direction-v1` |
| Semantic audit input | `audit-input-v1` |
| Render Manifest | `render-manifest-v1` |
| Assembly recipe | `assembly-recipe-v1` |
| Master assembly map | `master-assembly-map-v1` |
| Show config version | `show-config-v1` |
| Claims/Writing gate input | `claims-writing-gate-input-v1` |
| Performance gate input | `performance-gate-input-v1` |
| Render gate input | `render-gate-input-v1` |
| Assembly gate input | `assembly-gate-input-v1` |
| READY candidate | `ready-candidate-v1` |

## 4. Build 1–2 artifact projection clarifications

The owning specs continue to define semantic content. The following exclusions were implicit in Fixture v0.4.1 and are now normative so an implementation does not have to reverse-engineer them.

### 4.1 Script `script-v2`

`turns[]` is an ordered semantic array. `turns[].sequence` is a redundant persistence/order projection and is **excluded** from `semantic_script`. The turn's semantic order is its position in `turns[]`.

This is in addition to the Writing Spec exclusions for storage IDs, run/attempt IDs, model-run IDs, `created_at`, and non-semantic revision-note text.

### 4.2 Writing Craft review `writing-craft-review-v1`

`findings[]` is an ordered semantic array. `findings[].finding_id` is a local bookkeeping anchor and is **excluded** from the review's semantic projection. Finding type, severity, span refs, observation, consequence, revision instruction, prohibited shortcut, ordered position, subject-script identity, critic contract/policy identities, and outcome remain semantic.

### 4.3 Render Manifest `render-manifest-v1`

Within `render_blocks[]`, the following are **excluded** from the semantic Render Manifest projection:

- `sequence` because array order is semantic;
- `render_block_id` because it is storage identity;
- `state` because it is operational execution state.

For each ordered render block, the semantic plan includes:

```text
program_block_id
ordered_turn_ids
speaker_map
provider
context_recipe_version
resolved_context_refs
applied_performance_intent_ids
applied_pronunciation_rendering_ids
named_text_transform_versions
base_request_hash
```

The top-level semantic Render Manifest includes the exact script and Performance Direction content identities, semantic-audit fingerprint, render/adapter/provider/show-config versions, and those ordered semantic render-block plans. Storage IDs and timestamps are excluded.

## 5. Exact stage-fingerprint projections for Builds 1–2

A gate fingerprint depends only on artifacts available when that gate runs. A later artifact may never be included in an earlier gate fingerprint.

Fixture v0.4.3 ships the exact projection object for every stage in `gate_fingerprint_inputs.json`. Implementations must derive the same projection from persisted authoritative records and reproduce the supplied expected hash. They must not hash the fixture's expected hash field itself.

### 5.1 Claims/Writing gate

Domain: `claims-writing-gate-input-v1`

Exact projection keys:

```text
package_hash
brief_hash
script_hash
claims_policy_version
writing_policy_version
gate_set_version
```

Performance Direction is absent because it does not exist at this gate.

### 5.2 Performance gate

Domain: `performance-gate-input-v1`

Exact projection keys:

```text
script_hash
performance_direction_hash
performance_policy_version
gate_set_version
```

### 5.3 Semantic audit input

Domain: `audit-input-v1`

Exact projection keys:

```text
package_hash
brief_hash
script_hash
performance_direction_hash
claims_policy_version
writing_policy_version
performance_policy_version
auditor_contract_version
```

The immutable policy `version_id` is the fingerprint-facing policy identity for Builds 1–2. `config/policy_versions.json` separately binds every such version ID to the exact active source SHA-256, and conformance must fail if that source-hash binding does not match the pack.

### 5.4 Render gate

Domain: `render-gate-input-v1`

Exact projection keys:

```text
render_manifest_hash
audit_input_fingerprint
render_policy_version
gate_set_version
```

### 5.5 Assembly gate

Domain: `assembly-gate-input-v1`

Exact projection keys:

```text
selected_take_lineage[]
assembly_recipe_hash
master_assembly_map_hash
assembly_policy_version
gate_set_version
```

Each ordered `selected_take_lineage[]` item contains exactly:

```text
render_block_id
take_selection_id
render_take_id
take_index
audio_sha256
```

Only final approved selections are included, in render-block order. Rejected/superseded selections remain provenance but are not the selected assembly inputs.

### 5.6 READY candidate

Domain: `ready-candidate-v1`

Exact projection keys:

```text
master_artifact_id
master_audio_sha256
assembly_gate_fingerprint
program_run_id
attempt_id
show_config_version_hash
review_gate_version
gate_set_version
```

Operational wait timestamps are excluded. A repaired child attempt therefore creates a distinct READY candidate even if it reuses the same validated master, because the attempt binding is semantic to the review authorization.

## 6. Stage fingerprint expected values in Fixture v0.4.3

| Stage | Expected hash |
| --- | --- |
| Claims/Writing | `a56625ab7885982feb59c2b9661f7048aac8882bee646c871d511e7ea5404821` |
| Performance | `2b8d739aa58d4721daf75ef7e72594994c80ddeb9d00d677114ee7ced5b7c761` |
| Semantic audit | `de4e027bd6d8599ecc047745023fe2545e0fcbdaace645528f7d99902f338657` |
| Render | `d92d620c8e60098e750bea6c490a85f7ca71d27994e90cb9e247bc8072241b37` |
| Assembly | `dd20eb19b78bea075369ebc04db438928ab272986bd3d062904604b069a84518` |
| READY candidate | `c9ec6c12015993af3199054429b82cc37c0c692dd259df51319e5d41e34b41ce` |

These values are executable vectors, not product constants.

## 7. TTS base-request projection and conformance vectors

Performance & Render v0.1.3 §23 owns the eleven render-affecting base-request fields. The projection function selects exactly those eleven fields from a resolved request input record and excludes `take_index` and non-render administrative metadata.

Fixture v0.4.3 distinguishes two kinds of render vectors:

1. `render_request_projections.json` contains the **nine actual fixture block baseline projections** and their base hashes.
2. `base_request_hash_conformance.json` contains the **nine P&R §24 sensitivity/stability vectors**:
   - equivalent independent caller;
   - non-render admin field excluded;
   - one spoken word changes;
   - voice-profile render field changes;
   - performance intent changes;
   - bounded context changes;
   - pronunciation rendering changes;
   - adapter transform changes;
   - `take_index` changes without changing the base hash.

The conformance file includes both each row-level `input_record` and its expected projected render request. CI must test the projection function as well as the serializer/hash function.

## 8. Spoken-text span coordinates

All `span_start` / `span_end` coordinates are:

- zero-based;
- half-open `[start, end)`;
- counted in Unicode **code points**;
- over NFC-normalized canonical `spoken_text`.

They are not UTF-8 byte offsets and not JavaScript UTF-16 code-unit indices. Persistence/validation code must convert deliberately when using native JavaScript string indexes.

Build-1 conformance includes a non-ASCII/astral-character span vector and a key-order vector that distinguishes Unicode code-point order from JavaScript default UTF-16 ordering.

## 9. Model-judgement classification

`implied_access` remains an adjudicated semantic blocker under the governing architecture/Claims rules. It is not a deterministic keyword gate. Fixture vector NV03 is therefore `recorded_model_eval`, not deterministic CI. Deterministic CI may verify that the semantic-audit result is represented and binding, but may not fake the adjudication with a phrase blacklist.

## 10. Fixture conformance

Frozen Walking-Skeleton Fixture v0.4.3 is the executable vector set for these domains, projections, fingerprints, spans, base-request sensitivity tests, and repair-scenario semantics.

If fixture values and this contract disagree, this contract and the higher-authority owning spec govern; rebuild the fixture rather than weakening validation.
