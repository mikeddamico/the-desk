# Frozen Fixture046 response lineage — historical synthetic verification only

This is the adopted bounded `frozen-fixture046-response-lineage/1` seam, following PR36's
`frozen-fixture046-render-planning/1`. It verifies that the nine independently derived
**original seventeen-turn** render requests reconcile to the ten frozen Fixture0.4.6 synthetic
responses and their shipped WAV bytes. It is not provider execution, speech generation, a new
take, a reroll, technical acceptance, selection, assembly, READY, or semantic, production or Build
clearance. It is not PR35's nineteen-turn continuation or PR33/34's failed subject.

FINAL LOCK v1.2.7's coherent Activation Record governs. Historical fixture pins (Fixture0.4.6,
Hashing0.1.5, Addendum0.1) keep their explicit versions and are not repinned. P&R0.1.4 §20.1 owns
the request-to-response mapping; nine base requests produce ten take responses because `rb06`
has two intentional historical takes. Static sting and clean master are assembly objects, not
additional TTS responses.

## Closed public operation

```ts
verifyFrozenFixture046ResponseLineage({
  profile: "frozen-fixture046-response-lineage/1",
  purpose: "fixture_conformance",
  environment: "test",
});
```

Exactly these three own data properties and values. No receipt, plan, hash or path is accepted;
accessors are never invoked. Before acquisition and again immediately before success the wrapper
reads `DESK_ENV=test`, `PROVIDERS_ENABLED=false`, `GENERATION_KILL_SWITCH=true` (a private local
comparison; PR36's helper and API are unchanged). It does not call `loadConfig()` or inspect
credentials. The protection against misuse is the absence of any consumer or authority API and of
any provider or database import, not an incompatibility of process settings, which can change.

Success is `fixture_response_lineage_pass`: a deeply frozen, serializable result with explicit
non-clearance flags, the planner's manifest and render-gate hashes, a pin receipt, and ten ordered
responses (block ordinal, take index) carrying only historical identifiers, `wav` facts
(`byte_length` and `frame_count` as canonical decimal strings), the provenance label
`historical_fixture_v0.4.6_synthetic_response`, `relabeled_as_new_generation: false` and
`technical_acceptance: "not_evaluated"`. It outputs no selection, technical verdict, PCM
diagnostic, threshold, cost or timestamp. `blocked` results are exactly
`status/profile/code/phase`, with no partial lineage and no reflected text.

## Source boundary (reused, unchanged)

The wrapper calls PR36's `planFrozenFixture046Render` itself (its fixed 27 files), then reads
through the existing `fixturePack()`: the mapping member, the 398-row active load via
`loadFoundationRows()` (inherited validation of unrelated historical rows) and the ten literal
WAV members. No additional member is selected for parsing or measurement; the unchanged pack
opener still reads and hashes all members for integrity on first cache creation.

`fixturePack()` is process-cached. The receipt describes that verified cached snapshot, not a
fresh disk read. Inherited limits remain: whole-ZIP reads per member on first open, an `unzip`
subprocess for listing with a possible per-member fallback, no timeout, no atomic cross-read or
TOCTOU guarantee, and no protection from fatal failures or hangs. Mapping paths are compared with
the literal ten names and never opened. The pure module reads no file, environment, database or
provider.

## Pure reconciliation

`reconcileFrozenFixture046Responses(unknown)` takes a closed plain-data bundle (`plan`,
`mapping`, `tables`, `wavs`) and always returns `authority: "none"`. The plan is a named
nine-item identity projection extracted by the wrapper, never full eleven-field projections.
Caller-supplied data is never promotable to the wrapper's public success.

Mapping and rows are two reconciliation paths inside one pinned historical pack, not independent
trust roots: rows are authoritative and the mapping is the comparison target. The unchanged
`verifyLedger` reconciles them; adapter `fixture_tts`, model `fixture-model-1.0` and adapter
version `fixture-adapter-contract-v2` are checked separately and against the plan because the
ledger never inspects the version. Each WAV is measured once with the unchanged
`measureCanonicalPcm`; its SHA-256, byte length and frame count must equal the mapping. The
helper's 12,000/48,000-frame diagnostics are test diagnostics, never read or output. Byte
identity proves neither speech fidelity nor product duration.

The rb06 evidence tie reads the already-loaded mechanical-validation artifact's `canonical_payload`
and requires its recorded observation (6,240 frames) to equal the measured take-0 frames, the
recorded comparison rule, method and synthetic marker, and the fixture's declared 6,959-frame
minimum to exceed it. This verifies old recorded evidence only; 6,959 is a synthetic Fixture0.4.6
setting, not a speaking-rate rule, and nothing new is validated, accepted, rerolled or selected.

## First-failure order

One acquisition pass and no wrapper retry. For responses, steps 14 and 15 run per response in
order before advancing, so the first bad response wins. Codes are closed.

| Step | Phase               | Refusal code                                                                                                                                           |
| ---- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | invocation_context  | `invalid_invocation`                                                                                                                                   |
| 2    | invocation_context  | `unsafe_runtime_configuration`                                                                                                                         |
| 3    | request_plan        | `request_plan_blocked`; `plan_identity_invalid` (not the exact planner pass, or a malformed carrier or identity form, refused before any archive read) |
| 4    | response_source     | `response_source_invalid` (pack, mapping, any of the ten WAV reads)                                                                                    |
| 5    | response_source     | `historical_rows_invalid`                                                                                                                              |
| 6    | input_closure       | `input_shape_invalid`                                                                                                                                  |
| 7    | mapping_shape       | `mapping_shape_invalid` (grammar, ranges, paths, receipt literals)                                                                                     |
| 8    | mapping_shape       | `mapping_duplicate_identity`                                                                                                                           |
| 9    | mapping_shape       | `adapter_identity_mismatch`                                                                                                                            |
| 10   | mapping_shape       | `adapter_contract_version_mismatch`                                                                                                                    |
| 11   | historical_ledger   | `historical_ledger_mismatch` (any `verifyLedger` exception)                                                                                            |
| 12   | request_identity    | `request_block_mismatch` (program block id, or a sequence that is not the exact integer ordinal)                                                       |
| 13   | request_identity    | `request_identity_unmapped`                                                                                                                            |
| 14   | response_bytes      | `response_bytes_invalid`                                                                                                                               |
| 15   | response_bytes      | `response_bytes_mismatch`                                                                                                                              |
| 16   | historical_evidence | `historical_evidence_mismatch`                                                                                                                         |
| 17   | invocation_context  | `unsafe_runtime_configuration` (settings re-observed)                                                                                                  |
| 18   | invocation_context  | `unexpected_failure` (assembly), as for any other unlisted exception                                                                                   |

Step 6 uses one budget for the whole bundle, counted from the bundle as the depth-0 root: at most depth 16 and 100,000 nodes, each object, array and scalar counted once per occurrence. The `bytes` slot of an admitted WAV record is a single leaf; its contents are never traversed (the measurer owns byte refusals). An oversized array is refused before its elements are copied.

Step 7 checks only primitive grammar for `logical_request_key`; equality to the entry's own hash
and take index is a ledger check at step 11. Planner, measurer and other unlisted exceptions map
to `unexpected_failure` with the current phase. Fatal process failures, exhaustion and hangs are
outside this return guarantee.

## Not provided

A runtime `fixture_tts` adapter, reservation or provider-call ledger use, take or reroll
allocation, technical acceptance, selection, assembly, any transferable authorization, an owned
TTS quantity profile (G1-B R1) and settings reconciliation with G1-A remain separately
unauthorized. PR36's receipt remains synthetic data; this output is the same kind of data.

## Evidence

`test/unit/frozen-render046-responses.test.ts` registers exactly 89 individual cases with
independent literals for all ten responses. Exact additive CI inventory: 81 tracked TS test files,
80 aggregate-selected, 8688 cases, 29 integration files; writer stays (1, 4908, 0) and the rest
becomes (79, 3780, 29). Source review, local validation, exact-final hosted CI, independent
review and the fresh pre-merge check remain separate mandatory gates.
