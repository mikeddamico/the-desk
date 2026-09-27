# The Desk — Hashing, Fingerprints & Text Spans v0.1

**Status:** ACTIVE BUILD 1–2 IMPLEMENTATION CONTRACT
**Date:** September 27, 2026
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

Hash bytes are:

```text
sha256(domain_separator + "\n" + canonical_json(semantic_projection))
```

Hex output is lowercase. Never hash a persistence/database row merely because it is convenient.

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

TTS base-request hashes retain the `v1:sha256(...)` recipe owned by Performance & Render v0.1.3 rather than the domain-separator table above.

## 4. Stage-specific fingerprint subjects

Gate fingerprints must depend only on artifacts that exist at the stage being judged. A later artifact may never be smuggled into an earlier gate fingerprint.

### Claims/Writing gate

Projection contains exact content identities for:

- Evidence Package;
- Showrunner Brief;
- final script version under claims/writing judgment;
- Claims Policy version/content identity;
- Writing policy / relevant deterministic writing-rule version identities.

It does **not** contain Performance Direction.

### Performance gate

Projection contains:

- exact final script content identity;
- exact Performance Direction content identity;
- applicable performance-policy/version identities.

### Semantic audit input

Projection contains exact:

- Evidence Package identity;
- Showrunner Brief identity;
- final script identity;
- Performance Direction identity;
- Claims Policy version/content identity;
- writing/performance policy identities required by the auditor contract;
- auditor contract version.

### Render gate

Projection contains the exact Render Manifest identity plus the exact upstream audit/pass identity and applicable render-policy/version identities required by the gate definition.

### Assembly gate

Projection contains exact selected audio artifact hashes/selection lineage, assembly recipe identity, master assembly map identity, and applicable assembly-validation policy version.

### READY candidate

Projection contains the exact validated master artifact identity, assembly-gate result identity/fingerprint, attempt/run binding, and exact show-config/review-policy identity required to determine READY eligibility. Operational wait timestamps are excluded.

Every `gate_result` stores the exact fingerprint it judged. Any dependent semantic change makes the old result non-transferable.

## 5. Spoken-text span coordinates

All `span_start` / `span_end` coordinates are:

- zero-based;
- half-open `[start, end)`;
- counted in Unicode **code points**;
- over NFC-normalized canonical `spoken_text`.

They are not UTF-8 byte offsets and not JavaScript UTF-16 code-unit indices. Persistence/validation code must convert deliberately when using native JavaScript string indexes.

Build-1 conformance includes a non-ASCII/astral-character span vector and a key-order vector that distinguishes Unicode code-point order from JavaScript default UTF-16 ordering.

## 6. Fixture conformance

Frozen Walking-Skeleton Fixture v0.4.1 is the executable vector set for these domains and fingerprints. If fixture values and this contract disagree, this contract and the higher-authority owning spec govern; rebuild the fixture rather than weakening validation.
