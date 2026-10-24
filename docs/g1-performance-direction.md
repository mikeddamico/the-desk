# G1-A fixed fixture Performance Direction seam, Scope A (`performance-direction/1`)

Status: dependent contract of Lock v1.2.7 (no Lock edit, no new epoch), condensed from the accepted design packet `pr34-design-002`, its controlling
addendum `pr34-addendum-001/design/ADDENDUM.md` (31,713 bytes, SHA-256 `66924758da5687c67bd50d86ea2b173f7fae4c085dd773550776faab8bad3963`) and the
senior acceptance report (19,015 bytes, SHA-256 `5d1becf750ed15c058e6c68c35d1c5baf30caabec29605a21074de536dcacdeb`). Baseline: merged main
`5843406b1913fc120fdf77d123ddf05dacbbc85e`, tree `415b804747f5f7cddb2911cb69e63c61821f1e12`. This seam is downstream of the five accepted layers
(`docs/g1-writer-pass1.md`, `docs/g1-craft-critic.md`, `docs/g1-craft-revision.md`, `docs/g1-speech-texture.md`, `docs/g1-claims-writing-gate.md`), whose
behaviour it reuses and does not change. The only edit to an accepted module is `src/runtime/claims-writing-gate.ts` exporting `MARKUP_CHARS` and
`KNOWN_TAGS` (no behaviour change).

Nothing here is a model result, a semantic judgment, a performance-quality claim, a rights finding, SCRIPTED, READY, a G1-B certification or a lifecycle
step. This is an implementation of a design, not evidence that its tests pass; every count below is source-derived arithmetic or an implementation target,
never an observation. No producer, provider, model, auditor, audio path, spend or deployment exists in this scope.

## 1. Scope

Scope A is a pure/refusal slice: (C) a strict candidate grammar, (R) a Performance-owned read snapshot with an admission REFUSAL, (E) seven explicit-input
pure evaluators with a closed typed result profile, (S) a supplied-snapshot row classifier (examples only), and the planner. It writes nothing: attempt
and run stay `PENDING`. **Deferred, undesigned and not implemented:** door D (durable stored-door evaluation, write, retry, re-entry, final check,
convergence), any positive admission, any acceptance carrier or waiver, producers and semantic-audit dispatch. A direction that is not accepted by an
upstream that is accepted cannot exist here: the current upstream is recorded as 16 pass / 2 fail (aggregate `failed`), so the answer is a refusal.

## 2. Door C: the candidate grammar (`validateDirectionCandidate`)

A candidate has exactly `script_hash`, `direction_spec_version` (`performance-render-0.1.4`) and `performance_intents` (possibly empty; array order is
semantic identity, nothing is sorted, there is no duplicate rule). An intent has exactly `scope_type`, `scope_ref`, `intent_type`, `value`, `strength`,
`timing_anchor`. Order of checks, each pass over the whole candidate before the next: (1) semantic JSON (the `canonicalJson` domain: no floats, `-0`, lone
surrogates, NFC-duplicate keys, cycles; `not_semantic_json`), (2) exact keys (`missing_key`, `unknown_key`), (3) types (`type`), (4) vocabulary
(`perf_vocabulary_unknown` with `field`), (5) scope/family support (`perf_scope_unsupported`: `block_turn_mapping_unowned`, `text_span_ref_shape_unowned`),
(6) timing/shape (`timing_not_allowed`, `script_hash_shape`, `scope_ref_shape`), (7) script/spec binding (`perf_binding_mismatch`: `script_hash`,
`spec_version`), (8) turn binding (`turn_outside_script`). The supported `intent_type` values are exactly `delivery_affect` (14 labels), `pace` (slower,
standard, quicker, building) and `energy_intensity` (restrained, standard, heightened); strength is `light` or `standard`; `scope_type` is `turn` only
(`program_block` and `text_span` are recognised and unsupported); `timing_anchor` is null. Every other `intent_type` string (including `pause`,
`emphasis`, `non_verbal_event`, `overlap`) is `perf_vocabulary_unknown{field: intent_type, reason: not_in_supported_candidate_subset}`. `non_verbal_event` and
`overlap` exist only as the conditional specimen shapes consumed by gates 22 and 23 at door E. An admitted candidate yields the owned
`performance-direction-v1` hash (turn refs resolved to semantic anchors `tNN`, so it does not depend on storage UUIDs). Fingerprints: the four-key
`performance-gate-input-v1` and the eight-key `audit-input-v1` are pure arithmetic; computing one is not audit-dispatch readiness.

## 3. Door R: the Performance-owned read snapshot and the refusal

`planPerformanceDirection({ gatePlan, pack })` takes exactly those two properties (an admitted gate plan and a pack), reads one pinned member
(`foundation_rows_398.json`, SHA-256 `a27f4381…`) for the seven definition pins (`d1250019-0000-4000-8000-000000000019..25`; row and gate version "1"),
and returns a frozen plan. A wrong shape is a constant-text `TypeError`; there is no invocation field.

`readPerformanceSnapshot(pool, plan)` composes the exported primitives `gateSnapshotStatements`, `stageGateSnapshot` and `gateRawOf` on ONE client it checks
out itself. It never nests `readGateSnapshot`, never calls `classifyGateAcquisition` and never mints or registers an upstream acquisition or plan. Order:
admitted-plan check; `pool.connect()`; `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`; the 145 static statements sequentially (the fault point
`performance_direction_admission_after_first_read` runs after the first, inert unless `DESK_TEST_FAULTS=1`); staging; the one native expected-row SELECT;
COMMIT; settlement (one ROLLBACK attempt on a failure or held-throwable path only, exactly one `release(true)` after a successful checkout, errors counted in
`attached_errors` and never retried); then a module-private `PerformanceAcquisition`. Normal path: 146 SELECTs plus BEGIN plus COMMIT = **148** driver
calls; failure bound **149**. It adds no Performance statement: the Performance tables are not read in detail, only the unchanged inherited count and
history probes run (the host-row query and the native comparison include the historical Performance `gate_results` rows; a new Performance
`gate_results` row would stop the unchanged classifier as foreign). A reader failure is `perf_upstream_unavailable`.

Admission is `classifyGateRaw(raw, plan.gate, candidate, "preflight")` over the reader-owned value only: a stop becomes `perf_upstream_stopped` (closed
upstream code, stage and verified-layer facts copied verbatim); gate 0 is `perf_upstream_gate_absent`; gate 18 maps the candidate's own aggregate
(`failed` is `perf_upstream_gate_failed`, `incomplete` is `perf_upstream_gate_incomplete`, the synthetic-only `complete_defined_set` is
`perf_positive_branch_unimplemented`). H04 and H13 are unconditional required coverage gaps, so `complete_defined_set` is unreachable on real data. The
refusal object is exactly `{ kind: "refused", stage: "admission", code, writes_attempted: 0, upstream, durable: { performance: "not_read" }, cleanup,
reconciled: false }` with the four-arm `upstream` union (`unavailable`; `stop` with `code`, `stage`, optional `verified`; `state` gate 0; `state` gate 18
with `aggregate`). The ten stop literals are `perf_grammar_invalid`, `perf_vocabulary_unknown`, `perf_scope_unsupported`, `perf_binding_mismatch`,
`perf_upstream_unavailable`, `perf_upstream_stopped`, `perf_upstream_gate_absent`, `perf_upstream_gate_failed`, `perf_upstream_gate_incomplete`,
`perf_positive_branch_unimplemented`; each is a literal `code:` site, so the accepted source-scanning test registers all ten in `KNOWN_OUTCOME_CODES`.

## 4. Door E: the seven evaluators and the closed result profile

Explicit stored-shaped facts only (pins, payload as stored, version rows, artifact, intent rows, final-script facts, mode, sensitivities); no I/O. A
non-record payload or collection is a constant-text `TypeError`, and so is any non-semantic-JSON value (a float, `-0`, duplicate NFC key, lone surrogate or
cycle in the payload, artifact, version rows or stored intents) BEFORE any row or finding exists. Definitions 19 `intent_ref_integrity`, 20
`script_binding`, 21 `mode_intent_allowed` (every payload intent in a registered mode is a proof gap `mode_rule_set_absent`: the mode-by-family table is
unowned), 22 `protected_nonverbal`, 23 `overlap_protected_span`, 24 `no_spoken_text_mutation`, 25 `no_provider_syntax` (the exported `MARKUP_CHARS` and
`KNOWN_TAGS` applied only to free leaves, never to governed tokens). Gate 22: a heightened intensity in a non-sombre mode with an active sensitivity emits
BOTH proof gaps. Gate 23: only an ABSENT span defaults to the whole turn; an invalid PRESENT span emits `overlap_span_unusable` and skips that side (no
intersection is inferred; gate 19 reports `span_out_of_range` for the same span). Gate 25's `denominator_mismatch` is an implementation invariant (the
recursive walk and the canonical serialization enumerate the same universe on semantic JSON); it is demonstrated by a direct result-validator specimen.
Record collections are required to be DENSE (a hole is a structural precondition failure, never skipped or compacted); gate 23 looks protected use modes up in
its OWN three-entry table (an inherited key such as `toString` is an unprotected mode); the validator requires every own location field of the selected variant to
carry its declared value and rejects holes in `findings` and `subject_refs`.

The result object has exactly eight keys (`actor_id` `d1250001-0000-4000-8000-000000000002`, `actor_kind` `policy`, `check`, `facts`, `findings`,
`fingerprint_stage` `performance`, `schema` `performance-direction-gate-result/1`, `subject_refs`); facts are non-negative integers with the declared
keys; a finding has a class, a closed code and one accepted location variant (none, intent, intent+side, intent+side+use kind+use index, or the
`direction_envelope` reference). A row is `pass` iff it has no findings; a row with only proof gaps is still `fail`. The returned (never durable)
aggregate is `failed` iff any violation, else `incomplete` iff any proof gap or required coverage gap, else `complete_defined_set`, which authorises
nothing. Coverage register: `M01`, `S01` (required unless inapplicable), `B01`, `Q01`, `Q02` (established with limits), `T01`, `T02`, `A01` (deferred semantic).

## 5. Door S (examples only)

`classifyDirectionRows(snapshot, pins)` labels a SUPPLIED list of rows `none`, `exact`, `partial`, `conflict`, `stale`, `foreign` or `historical`. It proves
nothing about a database, a write, a re-entry, a final check or convergence; each expected row identity is satisfied once per table (a repeat is a duplicate extra); the durable contract needs an exact Performance-owned row partition and a
proof-before-subtraction count projection that are not designed here.

## 6. Cost and member-reading ledger (static arithmetic over the recorded source; nothing here is a measurement or a timing promise)

One `openFixturePack()` is 135 whole-ZIP reads (112,323,240 B), one intended native `unzip -Z1` process and 134 member reads, nominally 14 `readSync` per
member (source bound 832,025 per member), fallback `unzip -p` nominally 0 and at most one per member read. One chain plan is exactly four opens, 28 planner
member copies (1,656,614 B), two `pack.json` reads (484,720 B) and five DISK policy-file reads (249,026 B): five policy-file reads are not 23 nominal
low-level `readSync` calls per chain (92 for four chains). A gate plan with a supplied pack costs seven member copies; the Performance plan costs one.
**Unit file:** 5 API opens (one pack plus one real chain plan), one shared real plan, no per-case pack open, and **1,571** scripted driver calls with 13
`stageGateSnapshot` invocations on the all-assertions-reached route: R1-R12 with the shared normal acquisition counted once = 973 calls (5 scripted staging
evaluations, one attempted throwing stage), the socket-event witness R13 = 3 (0 staging), the four PU19 full refusal reads = 592 (4 staging), the PU19 unavailable
read with a failed rollback = 3 (0 staging); the four direct `classifyPure` calls add 4 further staging invocations and no SQL. Post-open member copies are 41
(3,681,777 bytes), not 38: three extra JSON member reads contribute 532,302 bytes, so blanket zero per-case member reads is false though per-case opens are zero.
PU01 reads this module's source once. The tampered-pack `{}` buffer is a synthetic rejected hash specimen, not a ZIP read.
**Integration file:** 19 API opens (5 in `beforeAll`, 1 load, 1 verification, 12 for three upstream runs), one monotone scenario database plus one bootstrap
database, 8 pool objects, and **4,493 + D** driver calls on the all-assertions-reached route, where D counts the `DROP DATABASE` statements actually reached
(nominal D = 2, so 4,495; at most 204 when the repeated closes also reach their retry loop; conditional role-SQL retries add at most 10 separately). Components:
fixture load / Q0 / initial historical baseline 566 + 69 + 40; the adopted upstream W/C/R and standalone texture setup 1,061; migrations 12 + the Claims/Writing
create path 361 + five Performance reads 740; owner schema/role setup 4; four marks at 125 layer reads + 46 table counts = 684; four verifications at 46 counts + 40
historical + 125 layer reads = 844; other per-case reads 102 (PI01 6, PI02 2, PI03 49, PI04 1, PI05 44) giving a 4,483 non-administration subtotal; fixed
non-DROP administration 10. The counted-pool subtotal 361 + 5 x 148 = 1,101 is not the complete file cost. Integration member copies stay 221 (12,942,628 bytes).
These are static all-reach formulas, not measurements and not a promise for any failure or short-circuit route; no timeout is changed. Two inherited items are
bounded, not counted: whether a repeated `TestCluster.close()` reaches its drop loop, and the internal composition of the adopted inherited upstream setup.

## 7. Tests (20 unit + 5 integration groups; no existing test is changed)

`test/unit/performance-direction-plan.test.ts` (PU01-PU20) and `test/integration/performance-direction.test.ts` (PI01-PI05, one monotone scenario). The
integration file requires `TEST_DATABASE_URL`; the required witness PI03 asserts the current chain refusal `perf_upstream_gate_failed` with zero effects. The
strict CI counts become 8,468 tests, 76 selected files, 28 integration files and 77 tracked test files (`tools/ci-validation`); those are targets until a
release runs them. Model-evaluation duties (tone risk, emphasis turning a hedge categorical, sarcasm, overlap obscuring an attribution, whether a value is
jocular, character drift) remain recorded, never keyword rules.
