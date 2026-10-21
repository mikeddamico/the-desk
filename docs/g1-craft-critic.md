# G1-A fixed fixture Craft Critic execution and immutable-review-lineage seam (`craft-critic-fixture/1`)

Status: dependent contract of Lock v1.2.7 (no Lock edit, no new epoch), condensed from the accepted design packet
`pr30-craft-critic-design-packet-v2-corrected.tar.gz` (141,022 bytes, SHA-256 `416eb07a83987adce545b3dc2fc4e794d8754090fc987c2efa3ae9ce1d03e1ae`)
as amended by the adopted technical erratum E1 (`40653ce5-PR30-design-V2-proposed-technical-erratum-E1-20261020.md`, 10,146 bytes, SHA-256
`8cdfa2c3ae552daac2c6c0a9cbbd135552e9ab1db094a7b1a67183d61879019a`) and ratifying decisions D-1 through D-13 only within the previously reviewed
bounds. Baseline: merged main `bc73cd597e3bf906f668314fe2a00c7f412b70fa`, tree `1d381b1e825094ccd5ed889d51444ed1d3d36f2f`. This seam is
downstream of `writer-fixture-pass1/1` (`docs/g1-writer-pass1.md`), whose accepted behaviour it reuses and does not change.

Nothing here is a model result, a quality judgment, a rights finding, a G1-B certification or a lifecycle step. This is an implementation of a
design, not evidence that its tests pass; validation is a separate, later, independently released phase. A deterministic stub returns a fixed
diagnostic specimen: nothing here states anything about model behaviour, independent semantic judgment, craft detection reliability, human
preference or Writing section 28. The historical benchmark remains FAIL (50%).

## 1. Scope

One honestly identified Craft Critic result about the exact Pass-1 subject (`script-v2`, hash
`b18d1fcee6ccd784933fd5e19b957ae252a5c892deb3d342ca768d61cea94ae9`) is recorded through the retained trusted non-network G1-A `fixture_stub`
route (unchanged `executeProviderCall`, uncertified: all eight admission columns stay NULL; never described as G1-B) as six additive rows in
existing tables. Every owned or mapped refusal is a closed typed stop; an unowned error (for example a programming fault or an unmapped
throwable) propagates with its identity unchanged.

Out of scope: writer revision, speech texture, deterministic Claims/Writing gates, diff lock, lint, performance direction, semantic audit
(`audit_runs`, `gate_results`), render/assembly/READY, repair, lifecycle transitions (attempt and run stay `PENDING`), any live or paid
provider, live search, craft-library retrieval, any new table, migration, grant, SECURITY DEFINER helper, service, framework, dependency,
queue, generic runner or generic retry, and any new rights grant or rights row.

## 2. Upstream handoff and permitted input

The handoff is a verified predicate over durable rows, never a returned object, cached flag or checkpoint. The Critic re-derives completeness
of Pass-1 inside its own coherent snapshot (the upstream-complete predicate U):

- U1. The unchanged planner is called exactly as `planWriterPass1({ ...invocation.pass1, attempt_id: invocation.attempt_id })`, so the nested
  record (`started_at`, `ended_at`, `created_at`) is completed by the single shared pinned attempt. Authored timestamps pass through unmodified.
  A planner stop maps to `critic_upstream_plan_stopped` with `upstream_code` from the closed Pass-1 stop set.
- U2. Host row: the pinned attempt and run are `PENDING`, evaluation purpose, publication disabled (the unchanged `hostMatches`).
- U3. Brief, package, selected claim and evidence bindings (the unchanged `bindingsMatch`).
- U4. Rights: R005 passes the unchanged `checkRightsPolicy`. This preserves the upstream Writer restrictions and the non-network fixture
  boundary; it is not a grant to the Critic.
- U5. All 41 Pass-1 rows equal the Pass-1 plan's rows by database-native `IS NOT DISTINCT FROM` comparison of every authored column; the
  unchanged `verifyDurableProvider` runs against the real upstream plan; the script rebuilt from the FETCHED subject payload plus the stored
  relational rows rehashes to the pinned subject hash (`reconcileScriptRows`).
- U6. Subject pins: `script_pass1` artifact `c392b9c1-57ac-4d12-ac9b-56665f102c40` and `script_versions` row
  `b0848965-f388-46bd-8615-221a8c4e6af7` with no revision parent. The historical Pass-1 script is never a valid subject.

Authored record: `{ attempt_id, pass1: { started_at, ended_at, created_at }, started_at, ended_at, created_at }`. Timestamps follow the Pass-1
domain exactly (RFC 3339, `Z` or numeric offset, 0-6 fractional digits, exact UTC microsecond instants). Each record's `ended_at` is not before
its `started_at`; the Critic `started_at` is not before `pass1.ended_at`. A violation stops `critic_invocation_invalid` with
`rejection_code` `invalid_uuid`, `invalid_timestamp` or `timestamp_precision` (`invalid_hash` is unreachable: the record has no hash field). The
Pass-1 record is a caller-retained input; if it is lost the seam fails closed at preflight (`critic_upstream_mismatch`).

Critic request input references, in order: the subject script (`script_pass1`, `c392b9c1-…`), the bound Showrunner Brief
(`showrunner_brief`, `595870e7-…`, hash `36fb22d0…c475`), and the bounded writer-view/2 (`writer_view_v2`, `5a290685-…`, hash `05d2d0cc…35b5`).
`ordered_input_evidence` and `ordered_input_claims` are empty. These are references only.

Reference-only adapter (adopted D-1): this fixture operation carries references only. It does not dereference input artifacts or materialize
evidence/source representations for a Critic. The unchanged R005 predicate preserves the upstream Writer restrictions and the non-network
fixture boundary; the Critic=Writer matrix is an upper bound, not a new positive materialization grant. No new grant, rights row or replacement
reference is introduced. Any future real rendering requires separately authorized consumer-permission and complete successor provenance design.

## 3. Request, manifest, reservation, outcome

- Rendered request (recipe `craft-critic-request/1`): compact canonical JSON of exactly six keys, 931 bytes, raw SHA-256
  `b07a9250…ad2d8`; refs/hashes and one fixed instruction only. Request bytes are reconstructable, not retained.
- Complete prompt manifest (sixteen fields) bound to addendum 0.2; artifact type `prompt_manifest_3`, schema `prompt-manifest/1`, hash
  `464ac653…239f`; typed `prompt_manifests` row; `model-semantic-input-v1` `66394ad0…0f68`. Mapped manifest codes: `pass1_manifest_binding`
  becomes `critic_manifest_binding`; `pass1_manifest_typed_mismatch` becomes `critic_manifest_typed_mismatch`.
- Reservation: provider `fixture_stub`, operation `craft_critic`, model `fixture_stub/craft-critic-pass1-v1`, `request_fingerprint` = request
  hash, `logical_request_key` `fixture_stub:craft_critic:<hash>`, try 1, take/retry/reroll NULL, `started_at` = invocation start. Terminal
  event: `succeeded`, `ended_at` = invocation end, usage `{external_provider_contacted:false, fixture_execution:true}`, cost `0.0000` USD,
  `response_artifact_id` NULL, `response_reference` `craft-critic-specimen/1:<specimen canonical sha>:<review hash>`.
- Adapter: pure, takes no pool or queryable, dereferences nothing. `perform` asserts the six identity fields against the plan, runs the inert
  fault point `craft_critic_perform`, and returns the deep-frozen specimen itself; there is no `lookup`. `finish` requires the response's
  canonical SHA-256 to be the pinned `a06de750…c93b`.
- Ids: `UUID = SHA-256("the-desk.craft-critic.id/1\n" + label)[0:16]`, version nibble 4, variant 10.

## 4. The specimen, admission and storage

The specimen (`src/fixture/craft-critic-specimen.ts`) is a deeply frozen closed object, canonical JSON 1,304 bytes, canonical-JSON SHA-256
`a06de7505cf998e0b6cbc7d23758da8efcfdeb131e8414bcfde898af2a06c93b` (the raw-response identity). It carries the wording of the frozen historical
critique for the four turns it cites (t08; t10, t12, t13), whose text is byte-identical in the new subject. This is fixed authored diagnostic
content, not model output and not a new evaluation of the changed turns (t06, t07); `cf02` is a subjective block-level critique. The acceptance
gate for the sentences is independent fixture-content review, not human-editor review and not model-quality evidence.

Closed S0 grammar: top level exactly `schema, subject_script_hash, craft_policy_version, critic_contract_version, findings, outcome`; 0-8
findings, each exactly `finding_id, type, severity, span_refs, observation, consequence, revision_instruction, prohibited_shortcut`;
`prohibited_shortcut` is a required key whose value is a string or `null`; `finding_id` `^cf[0-9]{2}$` and unique (local bookkeeping, excluded from the governed hash and compared exactly in the stored payload);
`type` from the Craft v0.1 list; `severity` `note` or `revise`; text NFC, non-blank, at most 400 code points; `span_refs` 1-8 items, each
exactly `{ semantic_turn_id }` (whole-turn refs; coordinates are unsupported by this profile), anchors distinct within a finding and one of
`t01…t17`; `outcome` is `revise_once` iff at least one finding has severity `revise`, else `no_revision`. `outcome` carries no authority.

Closed first-error order (all pure, before any write):

1. Grammar: an unknown key is `critic_field_unsupported`; a missing key, wrong type, format, count, length or enumeration is
   `critic_specimen_invalid`. `field` is drawn only from a closed set of eighteen schema/container labels, never an input key, path or text.
2. Every string (object keys included) is NFC: `critic_text_not_nfc`.
3. Subject binding (subject hash, craft policy version equal to `writing-craft-0.1` and the W2 value, contract label
   `craft-critic-fixture-stub/1`): `critic_subject_mismatch`.
4. Anchors resolve: `critic_anchor_unresolved`.
5. Outcome consistency: `critic_outcome_inconsistent`.
6. Withheld-text guard over the specimen: `critic_withheld_text_relocated` with `surface` `specimen`.
7. Mapping and identity: (a) map anchors to the subject's storage turn ids; (b) the real unchanged `writingCraftReviewHash` equals the pinned
   `b1129448…f896`, else `critic_review_hash_mismatch`; (c) rebuild from the stored form, else `critic_mapping_invariant`; (d) the specimen's
   canonical SHA-256 equals the pinned raw identity, else `critic_specimen_invalid` with `field` `specimen`.
8. Request, manifest, typed row, semantic input, ids and exposure instructions: `critic_request_hash_mismatch`, `critic_manifest_binding`,
   `critic_manifest_typed_mismatch`, `critic_mapping_invariant`.
9. Defense-in-depth scan of `specimen, request, manifest, review_payload` in that order: `critic_withheld_text_relocated` with `surface`.

Only the exact canonical fixed specimen may mint a full plan. The scan is the Critic's own local scanner (the unchanged Pass-1 scanner does not
know a `review_payload` surface). It is a finite regression guard (24-character shared run against two originals), not a paraphrase or rights
oracle. The helper `writingCraftReviewHash` is not modified: it copies extra span-ref keys into the hash and validates no enumeration, text,
count or subject binding, so admission does that closing.

Stored review: `writing_craft_review` artifact, schema `craft-critic-review/1`, `content_hash` = review hash, NULL parent/supersedes/storage
URI/byte size, a ten-key payload (`craft_policy_version, created_at, critic_contract_version, critic_model_run_id, findings, outcome,
review_hash, subject_script_hash, subject_script_version_id, writing_craft_review_id`) with `created_at` = `invocation.created_at`. The review
writes no `audit_runs`, `gate_results`, `script_versions` child, `turns` or lifecycle change; the semantic-audit carrier refuses nonempty
findings (`audit_findings_unsupported`).

Reconciliation has two separate checks, never merged: (1) the stored payload equals the plan's payload by strict structural JSON equality over
all ten keys including every `finding_id` and `created_at`; (2) the findings rebuilt through the real helper, with anchors from the stored and
already reconciled subject payload, rehash to `review_hash`, to `artifacts.content_hash` and to the pinned value. In the composite
classifier this second check runs only after the upstream classification (native row equality and the subject's reconciliation) is complete;
a failed review reconciliation is then `critic_unexpected_state` with the upstream presence verified. The model run references the
review artifact, the Critic manifest and the pinned semantic input. Stored-payload claims mean actual FETCHED values (E1.1), never an
unverified plan payload.

## 5. Persistence protocol and recovery

Six additive rows: T1c (`artifacts` `prompt_manifest_3`, `prompt_manifests`), reservation + event (`provider_calls`, `provider_call_events`),
T3c (`artifacts` `writing_craft_review`, `model_runs`). The 398 historical rows and the 41 Pass-1 rows are untouched. Every authored column is
compared by the database (`IS NOT DISTINCT FROM`, null-safe, `jsonb` included); natural-key conflicts are named and never adopted. The seam
only INSERTs its own six rows under `pg_advisory_xact_lock(182736481, hashtext(provider_call_id))`.

Snapshot reader: one checked-out `REPEATABLE READ READ ONLY` transaction of exactly 54 SELECTs: bindings 6 (0-5), upstream T1 rows 4 (6-9),
upstream T3 rows 35 (10-44), upstream call (45) and events (46), Critic T1c rows 2 (47-48), T3c rows 2 (49-50), Critic call (51) and events
(52), per-table counts (53). The first 47 statements and the counts statement are those of the unchanged `snapshotStatements(upstreamPlan)`
(48 statements). The only two critic-local projection additions are `canonical_payload AS canonical_payload` on the subject script artifact
statement (index 10) and the review artifact statement (index 49); the unchanged assembler receives `[...results[0..46], results[53]]`.

Cleanup is ownership-based (E1.4). A failed connect acquired nothing: no ROLLBACK, no release, cleanup count 0. For an acquired client, a
BEGIN, read or COMMIT failure, or a hook throwable, triggers at most one ROLLBACK, then exactly one attempted `release(true)` and removal of
the error listener; failures are counted, never retried. After a successful COMMIT `release(true)` is attempted once; if it throws, all
snapshot data is discarded, one cleanup failure is counted and no ROLLBACK or second release occurs. A hook throwable propagates with its
identity. A throwing release leaves destruction unconfirmed. `cleanup.complete` means only that the observed error count is available.

Entry points:

- `runCraftCritic(pool, invocation, observerContext, controls)` is the only composition: the complete composite preflight in one coherent
  snapshot, then T1c, E, T3c, then a fresh final snapshot. The preflight is never weakened.
- Direct stage entry points `stageCriticInputs`, `executeCriticCall`, `recordCriticLineage` accept only an admitted immutable plan and enforce
  their documented local prerequisites; they are not alternative orchestration paths and do not run the composite preflight.

Composite classifier (pure, in order): row-level evidence for U; the Critic's own monotone state C (0 empty, 1 T1c, 2 +reservation, 3 +event,
4 +T3c); allowed combinations are (Pass-1 complete, C in 0..4) only; Pass-1 absent or partial with no Critic rows is
`critic_upstream_incomplete` (writes none): this includes a nonconflicting partial upstream T1/T3 group, a non-monotone set of upstream
levels and an upstream event without its reservation, and in the preflight with no Critic rows it reports all four Critic facts
`none_observed`; with any Critic row, or in `final` mode, the same snapshot is `critic_unexpected_state`. No Pass-1 recovery from an
arbitrary corrupted state is promised, and the full 41-row count equation is applied only once the upstream is complete. Conflicting Pass-1 rows or subject pins are `critic_upstream_mismatch`; any Critic row with Pass-1
incomplete, a level without its predecessors or a conflicting Critic row is `critic_unexpected_state`; last, the composite count equation
`n = fixture + 41-row Pass-1 distribution + critic-owned(C)`. `final` mode demands C=4 and reports `critic_host_changed` for a changed
host, bindings or rights. The Pass-1 classifier is unchanged: after the first Critic row, ordinary Pass-1 re-entry stops
`pass1_unexpected_state` with zero writes, by design.

Re-entry: an incomplete Pass-1 (P0, P1, P3) stops the Critic with zero writes and is completed by ordinary Pass-1 re-entry; a stranded Pass-1
reservation (P2) is not resumable; a stranded Critic reservation (C2) stops `critic_provider_unfinished` with no extra `perform`, zero new rows
and no takeover; C3 resumes through an exact `completed` and T3c; C4 re-entry has zero deltas. No lease, TTL, retry or takeover exists.
Concurrency invariant: exactly one authorized `perform` and exactly one immutable row set; the other caller may stop
`critic_provider_unfinished` or proceed through an exact `completed`. Session scope is Pass-1's: a trusted, exclusively owned disposable
fixture session.

## 6. Closed result and stop mapping

`recorded`: `{ kind, identities (13), convergence { t1c, execute, t3c }, upstream { pass1: "present" }, gates_not_run, not_proven, durable }`.
`stopped`: `{ kind, stage, code, writes_attempted (cumulative), upstream { pass1: "present" | "unknown" }, durable { t1, reservation, outcome,
lineage }, cleanup { attached_errors, complete } }` plus closed optional detail fields (`rejection_code`, `conflict { row, kind }`,
`mismatch_field`, `provider`, `provider_error`, `connection`, `upstream_code`, `field`, `surface`). No message, cause, SQL, URL, source text,
claim value, input key or path ever appears. `upstream.pass1` becomes `present` exactly when a committed snapshot of the call verified U, and
is never downgraded.

There are 35 stop codes, with the unchanged provider and command classes translated by the prefix rule `pass1_` to `critic_` (and
`pass1_rights_provider_exposure` to `critic_rights_exposure`): `critic_invocation_invalid`, `critic_upstream_plan_stopped`,
`critic_specimen_invalid`, `critic_field_unsupported`, `critic_text_not_nfc`, `critic_subject_mismatch`, `critic_anchor_unresolved`,
`critic_outcome_inconsistent`, `critic_withheld_text_relocated`, `critic_review_hash_mismatch`, `critic_mapping_invariant`,
`critic_request_hash_mismatch`, `critic_manifest_binding`, `critic_manifest_typed_mismatch`, `critic_preflight_failed`,
`critic_attempt_unavailable`, `critic_input_identity_mismatch`, `critic_rights_exposure`, `critic_upstream_incomplete`,
`critic_upstream_mismatch`, `critic_unexpected_state`, `critic_stage_conflict`, `critic_stage_rejected`, `critic_prerequisite_missing`,
`critic_reconcile_failed`, `critic_command_connection`, `critic_provider_unfinished`, `critic_provider_ambiguous`,
`critic_provider_conflict`, `critic_provider_rejected`, `critic_provider_error`, `critic_provider_outcome_failed`,
`critic_provider_mismatch`, `critic_provider_completed_mismatch`, `critic_host_changed`.

- A T1c/T3c prerequisite or reconcile rejection is internally `critic_prerequisite_missing` / `critic_reconcile_failed`; the public result is
  `critic_stage_rejected` and the internal code is deliberately omitted.
- `CommandConnectionError` is mapped in exactly its constructor-reachable pairs `(before_commit, not_attempted)`, `(commit, unknown)`,
  `(rollback, not_attempted)`, at T1c and T3c. Without prior verified presence the stage fact is `unknown`, never `none_observed`; with prior
  presence it stays `present`. `connection.phase` and `connection.commit_outcome` are the real instance's values; cleanup is
  `{ attached_errors: <attached count>, complete: true }`.
- `ProviderExecutionError`: reservation `present` iff `reservation_commit_state` is `committed`; outcome `present` iff stage `record` and
  `commit_state` is `committed`; cleanup `{ attached_errors: null, complete: false }`. An unowned error propagates with identity unchanged.
- Initial snapshot failure: stage `preconditions`, nothing known, `writes_attempted:false`. Final snapshot failure: stage `final_check`, the
  four durable facts kept, `writes_attempted:true`, never `recorded`.

Observer catalog (D-6): exactly seven literals are added to `KNOWN_OUTCOME_CODES`: `critic_command_connection`, `critic_preflight_failed`,
`critic_prerequisite_missing`, `critic_provider_error`, `critic_provider_mismatch`, `critic_reconcile_failed`, `critic_stage_conflict`. Besides
`code`/`code_known`, the projection also retains them as `stopped_code` values and the existing owned-Rejection, Pass-1 and Critic safe-code
filters admit them if they arise; no arbitrary detail whitelist is widened, and `craft_critic` was already a known operation. The
other stop codes are never carried by a `code:` property assignment or a `Rejection`/`ClaimStateError` call literal. Observer projection and
actual provider observation are different boundaries (E1.3): `projectEvent` is a pure catalog projection; only the unchanged provider
boundary emits events, and snapshot or preflight stops emit none.

## 7. Non-claims

Fixture-only, uncertified G1-A. A fixed specimen returned by a trusted deterministic stub proves wiring, identity, exposure shape and
persistence only. It does not prove independent semantic judgment, craft detection reliability, human preference or Writing section 28; it
does not discharge any gate; it is not SCRIPTED, READY or G1-B. Full hosted CI for any eventual head remains mandatory and unaccepted until
observed; the user alone merges.

## 8. Test inventory and bounds (the implementation's, not results)

31 database-free unit cases (`test/unit/craft-critic-plan.test.ts`, CU01-CU31) and 21 integration cases on disposable PostgreSQL 17
(`test/integration/craft-critic.test.ts`, I01-I21), one top-level case per identifier, extra witnesses as explicit subcases. Aggregate
proposal: 342 source members, 69 tracked test files, 68 selected files, 24 integration files, 8,294 tests (8,242 + 31 + 21). These counts are
derived from the test list and must be recomputed from the implemented tests, never relaxed. No local run of any of them has been made.
