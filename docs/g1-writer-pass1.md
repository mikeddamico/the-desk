# G1-A fixed fixture writer Pass-1 execution and immutable-lineage seam (`writer-fixture-pass1/1`)

Status: dependent contract of Lock v1.2.7 (no Lock edit, no new epoch), condensed from the independently reviewed design packet
`PR28-writer-pass1-design-packet-r4.tgz` (76,735 bytes, SHA-256 `a34f4e66d1bdc51839ec8013cc5109cc1cd6ee8cc8e2ee2aafa842993b903de2`)
plus the ROOT erratum E1 (`PR28-writer-pass1-R4-ROOT-erratum-E1-20261020.md`, 2,580 bytes, SHA-256
`4d1b88dd52213e83c24eecca0589a7f257a88107eb4556d0cbbd0067681e0f3d`), which replaces only the packet's §5.8 in-flight COMMIT-loss row (see
"Crash and lost-return recovery"). Merge rule M and the mapping table below govern that row. Lineage: original packet, reviewed R2 (only its
accepted portions and literals were carried forward; the complete R2 design was never accepted), R3, R4. Baseline: merged main
`89563df935c3af4d21f379e3229ad8673dbbcd22`, tree `116c6689a8d1173fbbe13c3411a27f2d628fc034`. Revised after the independent actual-source reviews of the source candidate (findings F1–F10, then R1–R5).

Nothing here is a model result, a quality judgment, a rights finding, a G1-B certification or a lifecycle step. This is an implementation of
a design, not evidence that its tests pass; validation is a separate, later, independently released phase.

## 1. Scope

One honestly identified Pass-1 script result is recorded through the retained trusted non-network G1-A `fixture_stub` route (unchanged
`executeProviderCall`, uncertified: all eight admission columns stay NULL; never described as G1-B) and existing tables. Out of scope: Craft
Critic, revision, speech texture, deterministic Claims/Writing gates, performance/render/audio/READY/repair, semantic-audit findings,
lifecycle transitions, live search, any real or paid provider, any new table/service/framework/dependency/grant/migration/SECURITY DEFINER
helper/generic retry machinery. A deterministic stub returned a fixed specimen: nothing here states anything about model behaviour,
Writing section 28 or craft quality.

## 2. Inputs (`writer-fixture-input/2` DATA boundary)

`buildFixtureWriterInput()` returns the writer object W (19 keys) and the context manifest C (11 keys); R and A are withheld and never
persisted. Pinned identities (verified at plan time, never adjusted): W raw `d4b955b1…ebe1e` (11,788 B) and domain (`writer-view-v2`)
`05d2d0cc…35b5`; C raw `e589a3bb…eedf` (1,033 B) and domain (`writer-context-manifest-v2`) `58a54994…8432`; R raw `03a4eadf…a309`; A raw
`3559c082…8e9a`. A normal refusal stops `pass1_input_refused` (the factory's own closed `phase`, `code`, `field`); a thrown
`FixtureWriterInputFault` stops `pass1_input_fault` (integer `phase` only); any other thrown value is not caught.

W2/C2 are stored as `artifacts` rows of types `writer_view_v2` / `writer_context_manifest_v2` (`schema_version` `writer-view/2` /
`writer-context-manifest/2`), payload exactly W / C, `content_hash` the domain hashes above (consumer-owner gap G1; the v1 helpers
correctly refuse them).

## 3. Chain

* Rendered request (recipe `writer-pass1-request/1`): compact canonical JSON of exactly six keys, 678 bytes, raw SHA-256
  `443ebf6b…752b`; it carries artifact refs/hashes and one fixed instruction only. Request bytes are reconstructable, not retained.
* Complete prompt manifest (sixteen fields) bound to addendum 0.2; artifact type `prompt_manifest_2`, schema `prompt-manifest/1`, hash
  `0331df55…683f`; typed `prompt_manifests` row (`component_versions`, `rendered_request_hash`, `policy_source_hashes`, `artifact_id`);
  `model-semantic-input-v1` `f1ff636a…7f73`. Its retention text states the truthful raw-response relation: the raw response is the pinned
  `writer-pass1-specimen/1` constant identified by its canonical-JSON SHA-256 in the provider event `response_reference`; it is not stored
  verbatim; the stored script is the canonical carrier deterministically mapped from it.
* Reservation (twelve authored immutable columns): provider `fixture_stub`, operation `writer`, model `fixture_stub/writer-pass1-v2`,
  `request_fingerprint` = request hash, `logical_request_key` `fixture_stub:writer:<hash>`, try 1, take/retry/reroll NULL, `started_at` =
  invocation start. Terminal event: `succeeded`, `ended_at` = invocation end, usage `{external_provider_contacted:false,
  fixture_execution:true}`, cost `0.0000` USD, `response_artifact_id` NULL, `response_reference`
  `writer-pass1-specimen/1:<specimen canonical sha>:<script hash>`.
* Adapter: pure; `perform` asserts the request against the plan, then returns the deep-frozen semantic specimen itself; there is no
  `lookup`. `finish` requires the response's canonical SHA-256 to be the pinned `bff8461a…5682`.
* 41 additive rows: T1 four (`artifacts` ×3, `prompt_manifests`), reservation + event two, T3 thirty-five (`artifacts` script, `script_versions`,
  17 `turns`, 12 `turn_claim_uses`, 3 `turn_evidence_uses`, `model_runs`). The 398 historical rows are untouched; host attempt and run stay
  `PENDING`.

## 4. The output: specimen, admission, mapping, storage

The specimen (`src/fixture/writer-pass1-specimen.ts`) is a deeply frozen closed object of 17 turns, 12 claim uses, 3 evidence uses and 2
prediction candidates (semantic form: anchors, never UUIDs). Relative to the historical Pass-1 script the approved semantic delta is exactly
the `spoken_text` of t06 and t07 and the four span ends that follow them (C3 118→144, C4 159→168, E003 118→144, E004 159→168). The historical
script itself is rejected as an output (its t07 shares a 76-character run with the withheld original C4 sentence). Canonical-JSON SHA-256 of
the specimen: `bff8461a…5682`; script-v2 hash of the mapped script: `b18d1fce…4ae9`.

Admission is one closed first-error order, all pure and before any write: (1) grammar `pass1_specimen_invalid` (NFC is not a grammar
predicate); (2) every string NFC `pass1_text_not_nfc`; (3) brief/package/policy/`program_block_refs` vs W `pass1_binding_mismatch`, unknown
block `pass1_program_block_unknown`; (4) claim/evidence selected by W (`pass1_use_claim_not_selected`, `pass1_use_evidence_not_selected`), state
hash / rights version equal to W (`pass1_binding_mismatch`); (5) spans in code-point range `pass1_span_out_of_range`, then use modes
`pass1_use_mode_not_permitted` (quoted only where W permits; hedged-only claims only hedged; attribution-required claims only
attributed/hedged); (6) exposure guard `pass1_withheld_text_relocated` (no contiguous run of 24 characters shared with the original C3
`context` or C4 `interpretation`; a finite regression control, not a rights oracle); (7) the mapping recipe in order: (a) temporary turn ids
`tmp-turn-<anchor>` through the unchanged real `scriptHash(…, {brief})` (a helper `ProfileRejected`/`TypeError` ⇒ `pass1_specimen_invalid` with a
closed `underlying` value), (b) compare with the pinned script hash `pass1_script_hash_mismatch`, (c) derive final ids from the hash, rebuild,
require equal `pass1_mapping_invariant`; (8) defense-in-depth scan of the final request, manifest and script payload (surface named).

Ids: UUID = SHA-256(`the-desk.writer-pass1.id/1\n` + label)[0:16] with version nibble 4 and variant 10; labels carry the governing hash (turn,
claim-use and evidence-use labels include the script hash, anchor, target id, mode and span start). The stored script artifact payload has the
21 keys of the historical stored payload (`revision_parent_id` null, `revision_parent_content_identity` omitted, candidates in the source
carrier with `turn_id`), `schema_version` `writer-pass1-script/1`, `artifact_type` `script_pass1`; relational rows are reconciled with it
field by field and the object rebuilt from the stored rows must hash to both the payload hash and `artifacts.content_hash`.

## 5. Persistence protocol

* Session (a caller-side setup-boundary precondition): a trusted, exclusively owned disposable fixture session; independent lifecycle writers
  and non-participating writers to the touched tables are outside the proof. The caller runs the strict `verifyCompletePinnedFixture` (Q0)
  exactly once before the first call and retains the authored invocation record (`attempt_id`, `started_at`, `ended_at`, `created_at`, RFC 3339
  timestamps with `Z` or a numeric UTC offset and 0–6 fractional digits, compared as exact UTC microsecond instants and never through a
  millisecond-truncating `Date` round trip (the public input stays four-digit; stored UTC text may render a five-digit year across the 9999/10000 rollover and is compared internally as the same instant), `ended_at` not before `started_at`); the strict checkpoint fails from T1 onward by design and is never re-run or weakened.
* Coherent snapshot: every fact the preflight uses together is read inside ONE checked-out `REPEATABLE READ READ ONLY` transaction (SELECT
  privilege only), closed by COMMIT and released before T1; never held across a write or provider execution. Only driver operations
  (connect, BEGIN, each statement, COMMIT) are caught: a failure there triggers one ROLLBACK, discards the data and stops
  `pass1_preflight_failed`; faults raised by the pure code or a test hook keep their identity. Every acquired-client path ends in at most
  one destructive `release(true)`: no snapshot data is used after a driver, COMMIT or release failure, a release that throws is counted as
  an observed cleanup failure with destruction unconfirmed, and there is no second release, reconnect, retry or stronger claim. Previously
  established durable facts and cumulative writes stay governed by merge rule M and E1. The final recheck uses a fresh snapshot.
* Equality: every authored column is compared by the database itself (`IS NOT DISTINCT FROM $n::type`, null-safe, `jsonb` included) in
  the probes and in snapshot classification, so JSON precision or key-order differences are never decided by JavaScript.
* Preflight (initial entry and re-entry): the pinned host attempt/run (`PENDING`, evaluation, publication disabled, show-config bound, no
  parent/repair), the Brief and evidence package hashes, selected claim/evidence content hashes, the paraphrase-only rights row R005
  (`pass1_rights_provider_exposure`), the exact own rows of five monotone states (∅ → T1 → +reservation → +event → +T3), per-table counts
  equal to the fixture counts plus this seam's own present rows (foreign additive row ⇒ `pass1_unexpected_state`), and the stop-boundary
  tables unchanged.
* T1 `stageWriterPass1Inputs(pool, plan)`: one `runCommand` (READ COMMITTED), ordinary SELECTs and savepoint-wrapped INSERTs under
  `pg_advisory_xact_lock(182736481, hashtext(provider_call_id))`. Every column except database-generated `created_at` is compared; the same
  content under another id or schema is a named conflict, never adopted. No `FOR SHARE` (the runtime role has SELECT and INSERT only).
* E `executeWriterPass1Call(pool, plan, observerContext, controls)`: `executeProviderCall`; only an exact `performed` (outcome
  created/converged) or an exact `completed` of THIS authored id proceeds, then the durable call (twelve fields, `started_at`, six NULL
  admission columns) and exactly one exact event are verified. `unfinished`, `ambiguous`, `conflict`, `rejected` and a `completed` for another
  authored id stop. Only the caller whose own committed reservation returned `created` may perform; no takeover, lease or retry.
* T3 `recordWriterPass1Lineage(pool, plan)`: verifies the exact T1 rows and the exact call + event itself, inserts the 35 rows in order (script
  artifact, `script_versions`, turns, claim uses, evidence uses, `model_runs`) and reconciles them.
* `runWriterPass1(pool, invocation, observerContext, controls)` is the only composition: plan → snapshot preflight → T1 → E → T3 → fresh
  snapshot final recheck (`pass1_host_changed` on change) → `recorded`. The components accept only an admitted plan minted by
  `planWriterPass1`; none bypasses the preflight and the orchestrator never skips it.
* Fault points (inert unless `DESK_TEST_FAULTS=1` with an installed hook): `writer_pass1_preflight_after_first_read`,
  `writer_pass1_after_preflight`, `writer_pass1_perform`, `writer_pass1_before_final_check`, plus the existing provider/command points.

### Crash and lost-return recovery (names accurate)

Lost return after an acknowledged T1 commit: explicit identical re-entry converges. Lost return after the acknowledged reservation: stop
`unfinished`/`provider_error` (no takeover; fixture lane: discard the disposable database). `perform` throws or times out: `ambiguous`, no
fabricated event. Lost return after the acknowledged outcome: re-entry gets `completed` exact and proceeds to T3. T3 failed before commit:
re-entry completes it. Lost return after the acknowledged T3 commit: re-entry has zero deltas.

**In-flight COMMIT acknowledgment loss** (`CommandConnectionError` `phase 'commit'`, `commitOutcome 'unknown'`) (ROOT erratum E1): the stage
fact is `unknown` unless prior verified presence survives merge rule M; it is `present` where presence was already verified or acknowledged.
The local `connection.commit_outcome` stays `unknown`; there is no internal retry and no inference about that command's commit outcome. The
fault-seam tests do not exercise this; the existing `runCommand` suites prove the underlying behaviour and are reused. This composition's mapping
is tested by feeding real `CommandConnectionError` instances to the stop mapper. Reconciliation is an explicit later identical re-entry.

## 6. Closed result and error mapping

`Fact = present | none_observed | unknown` describes what this call last observed or was told, never "now". A local "did not commit"
observation (`Durability` `not_committed`, `commitOutcome 'not_attempted'`, a rolled-back `conflict`/`rejected`) never establishes global
absence.

Merge rule M (every mapping row): the call keeps a cumulative context `D` (per-stage facts, starting from the preflight snapshot or all
`unknown`) and `W` (`writes_attempted`, false until the first writing command begins, then true for the rest of the invocation). For each stage
the reported fact is `present` if `D` already holds `present` or the row newly acknowledges/verifies presence; otherwise the row's default
(`unknown` wins over `none_observed`); a stage the row does not name keeps `D`. Table `unknown` entries are defaults for facts not already
known present and never override `present`. `connection.commit_outcome` and `provider_error.{commit_state, reservation_commit_state}` are
reported verbatim. A failed snapshot discards only its newly obtained data: an initial failure (stage `preconditions`) has nothing known and
no writes; a final failure (stage `final_check`, same `pass1_preflight_failed` code) keeps every established fact and `writes_attempted:true`
and is never `recorded`.

Result: `recorded` (pinned identities, `convergence {t1, execute, t3}`, `gates_not_run`, `durable`) or `stopped` (`stage`, `code`,
`writes_attempted`, `durable {t1, reservation, outcome, lineage}`, `cleanup {attached_errors, complete}` and closed optional detail:
`input`, `underlying`, `rejection_code`, `conflict {row, kind}`, `mismatch_field`, `provider {status, code?, reason?}`, `provider_error {code?,
stage, commit_state, reservation_commit_state, error_class}`, `connection {phase, commit_outcome}`, `surface`). Implementation note: the
`surface` field (request, manifest, script_payload, specimen) is the "reported with the surface name" of the step-8 scan, added to the closed
shape. No result contains a message, cause, SQL, URL, source text or claim value.

Cleanup field: the count attached to a keyed `runCommand` throwable by `commandCleanupErrors` (`complete:true`); for the snapshot, the number
this function observed; for a `ProviderExecutionError` always `{attached_errors:null, complete:false}` because the wrapper discards the
underlying throwable. Raw cause chains are never inspected.

Stop codes (closed): `pass1_input_refused`, `pass1_input_fault`, `pass1_invocation_invalid`, `pass1_preflight_failed`,
`pass1_specimen_invalid`, `pass1_text_not_nfc`, `pass1_binding_mismatch`, `pass1_program_block_unknown`, `pass1_use_claim_not_selected`,
`pass1_use_evidence_not_selected`, `pass1_span_out_of_range`, `pass1_use_mode_not_permitted`, `pass1_withheld_text_relocated`,
`pass1_script_hash_mismatch`, `pass1_mapping_invariant`, `pass1_request_hash_mismatch`, `pass1_manifest_binding`,
`pass1_manifest_typed_mismatch`, `pass1_input_identity_mismatch`, `pass1_rights_provider_exposure`, `pass1_attempt_unavailable`,
`pass1_unexpected_state`, `pass1_stage_conflict`, `pass1_stage_rejected`, `pass1_command_connection`, `pass1_provider_unfinished`,
`pass1_provider_ambiguous`, `pass1_provider_conflict`, `pass1_provider_rejected`, `pass1_provider_error`, `pass1_provider_outcome_failed`,
`pass1_provider_mismatch`, `pass1_provider_completed_mismatch`, `pass1_host_changed`.

| Source | Code | Row default facts (merged with the cumulative context) |
|---|---|---|
| factory refusal / fault | `pass1_input_refused` / `pass1_input_fault` | nothing read: all `unknown`, no writes |
| invalid invocation | `pass1_invocation_invalid` (`rejection_code`) | all `unknown`, no writes |
| admission refusals | their own codes | all `unknown`, no writes |
| initial snapshot failure | `pass1_preflight_failed` | all `unknown`, no writes |
| preflight classification | `pass1_attempt_unavailable`, `pass1_input_identity_mismatch`, `pass1_rights_provider_exposure`, `pass1_unexpected_state` | the snapshot's facts (all `unknown` if its own rows cannot be trusted), no writes |
| T1/T3 `conflict` | `pass1_stage_conflict` | that stage `unknown` |
| T1/T3 `rejected` | `pass1_stage_rejected` | that stage `unknown` |
| T1/T3 `CommandConnectionError` | `pass1_command_connection` | that stage `unknown` for both `commit_outcome` values (R-F) |
| E `performed`, outcome created/converged, exact | proceeds | reservation, outcome `present` |
| E `performed`, outcome conflict/rejected | `pass1_provider_outcome_failed` | reservation `present`, outcome `unknown` |
| E `completed` exact | proceeds | reservation, outcome `present` |
| E `completed`, other authored id | `pass1_provider_completed_mismatch` | reservation, outcome `unknown` |
| E `unfinished` | `pass1_provider_unfinished` | `converged_without_outcome`: reservation `present`, outcome `none_observed`; other reasons `unknown` |
| E `ambiguous` | `pass1_provider_ambiguous` | reservation `present`, outcome `unknown` |
| E `conflict` / `rejected` | `pass1_provider_conflict` / `pass1_provider_rejected` | reservation, outcome `unknown` |
| E `ProviderExecutionError` | `pass1_provider_error` | reservation `present` iff `reservation_commit_state` is `committed`; outcome `present` iff `stage` is `record` and `commit_state` is `committed`; else `unknown` |
| durable provider verification mismatch | `pass1_provider_mismatch` (`mismatch_field`) | facts acknowledged so far |
| final snapshot failure | `pass1_preflight_failed` at `final_check` | none named: cumulative facts kept, `writes_attempted:true` |
| final recheck change | `pass1_host_changed` | cumulative facts kept |
| any other thrown value (including an unowned database error rethrown by `runCommand`) | not caught | the caller treats every fact as unknown and re-enters identically |

## 7. The stop

The seam ends after the final recheck and reports `gates_not_run` (craft critic, writer revision, speech texture, deterministic diff lock,
provider syntax lint, implied access lint, claims/writing gate, performance gate, semantic audit, render/assembly/ready gates). It writes no
`gate_results` or `audit_runs`, never calls `transition_attempt`, leaves attempt and run `PENDING`, and does not claim SCRIPTED or READY. Writing
section 28 is not discharged and semantic-audit findings stay `[]`.

## 8. Test inventory and bounds (the implementation's, not results)

`test/unit/writer-pass1-plan.test.ts`: 35 tests (U01–U35, DB-free). `test/integration/writer-pass1.test.ts`: 21 tests (I01–I21) on the
`desk_runtime` pool of disposable PostgreSQL 17 databases, plus an uncounted teardown that retains owned database and login-role names, closes
every tracked environment collecting failures, invokes `TestCluster.shutdown()`, then asserts through a separate owned admin connection that no
owned database or role remains. Counts: 67 tracked test files, 66 aggregate-selected, 23 integration files, 8,242 aggregate tests
(8,186 + 56). Required validation is the unchanged `foundation-ci`; no local run or inert validator command is released by this document.
