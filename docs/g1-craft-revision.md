# G1-A fixed fixture Craft Revision execution and immutable-revision-lineage seam (`craft-revision-fixture/1`)

Status: dependent contract of Lock v1.2.7 (no Lock edit, no new epoch), condensed from the accepted design packet
`pr31-design-packet-002.tar.gz` (1,233,037 bytes, SHA-256 `e1fc0c325d17a527dd18b61f3aa32dbfe18344ddb26ecf8388864423b48019d4`, manifest SHA-256
`d48bcf6b3aa0f025f8bce87334e691aad15910edc2a56ecdd7ccbf0d6784a90a`) as amended by the adopted ROOT technical erratum E1
(`PR31-design002-ROOT-technical-erratum-E1-20261021.md`, 13,994 bytes, SHA-256
`5e37cba284c24142445f8ee1681d7c4d7ac0f499f24f6a25653b5a687a5dc5fa`), which controls where it conflicts with the packet. Baseline: merged main
`c7df7facc1d1e66bbbb8abe248c3f2f2808a3a06`, tree `934a9dd56672737b031967743332ce63b832eacb`. This seam is downstream of
`writer-fixture-pass1/1` (`docs/g1-writer-pass1.md`) and `craft-critic-fixture/1` (`docs/g1-craft-critic.md`), whose accepted behaviour it
reuses and does not change.

Nothing here is a model result, a quality judgment, a rights finding, a G1-B certification or a lifecycle step. This is an implementation of a
design, not evidence that its tests pass; validation is a separate, later, independently released phase. A deterministic stub returns a fixed
authored specimen: nothing here states anything about model behaviour, independent semantic judgment, revision quality, craft detection
reliability, human preference or Writing section 28. The Critic outcome `revise_once` is a precondition of this seam, never an authority. The
historical benchmark remains FAIL (50%).

## 1. Scope

One honestly identified Craft revision child of the exact current safe Pass-1 script (`script-v2`, hash
`b18d1fcee6ccd784933fd5e19b957ae252a5c892deb3d342ca768d61cea94ae9`), answering the exact stored fixed Critic review (hash
`b1129448ccdfd8ed799652b8463f16204f40b004bb5f6600279472eeb80df896`, findings cf01 and cf02), is recorded through the retained trusted
non-network G1-A `fixture_stub` route (unchanged `executeProviderCall`, uncertified: all eight admission columns stay NULL, six on the call row
and two on the event; never described as G1-B), operation and purpose `writer_revision`, as **39 additive rows in existing tables**: T1r two
(`artifacts` type `prompt_manifest_4`, `prompt_manifests`), reservation and event two (`provider_calls`, `provider_call_events`), T3r thirty-five
(`artifacts` type `script_craft_revision`, schema `craft-revision-script/1`, `script_versions`, 17 `turns`, 12 `turn_claim_uses`, 3
`turn_evidence_uses`, `model_runs`). Every owned or mapped refusal is a closed typed stop; an unowned error propagates with its identity unchanged.

Out of scope: a second revision, speech texture, deterministic Claims/Writing gates, diff lock, lint, performance direction, semantic audit
(`audit_runs`, `gate_results`), render/assembly/READY, repair, lifecycle transitions (attempt and run stay `PENDING`), any live or paid provider,
live search, craft-library retrieval, any new table, migration, grant, SECURITY DEFINER helper, service, framework, dependency, queue, generic
runner, generic retry or resume, lease, TTL, takeover, and any new rights grant or rights row.

## 2. The three layers and the upstream predicate

The handoff is a verified predicate over durable rows, never a returned object or cached flag, re-derived inside the revision's own coherent
snapshot. The seam never calls an upstream provider and never re-runs the strict fixture qualification (`verifyCompletePinnedFixture` stays
caller-owned, once, before the first Pass-1 call).

- V1. The unchanged Critic planner is called as `planCraftCritic({ ...invocation.critic, attempt_id, pass1: invocation.pass1 })`, which in turn
  reproduces the Pass-1 plan. A refusal maps to `revision_upstream_plan_stopped` with `upstream_code` from the closed Pass-1 or Critic stop set.
- V2. Host, Brief, package, claim/evidence bindings and R005: the unchanged `hostMatches`, `bindingsMatch`, `checkRightsPolicy`.
- V3. Pass 1 complete: the unchanged row-level evidence `upstreamStatus` (all 41 rows equal the plan; provider verified; the script rebuilt from
  the fetched payload and relational rows rehashes to `b18d1fce...`).
- V4. Critic complete: `criticOwnState === 4` and `reviewReconciles`. `classifyCriticSnapshot` is deliberately not called: its count equation
  rejects every revision row by design and is not weakened.
- V5. The stored review is the pinned review with outcome `revise_once`; findings cf01 and cf02 are `revise`.
- V6. The parent is the Pass-1 script artifact and `script_versions` row only; the historical Pass-1 script is never a valid parent.

The four exported helpers (`upstreamStatus`, `criticOwnState`, `reviewReconciles`, `rowsById`) are the only change to accepted logic files
(export keywords). The root-only `reconcileScriptRows` is used for Pass 1 only and is unchanged: it rebuilds a closed object that omits
`revision_parent_content_identity` and so hashes the child as a root script (`a3198acb...`, not the child hash).

Upstream recoverability is per layer and not uniform. Ordinary upstream re-entry can complete P0, P1, P3 and C0, C1, C3 before any revision row
exists; a stranded reservation (P2 in Pass 1, C2 in the Critic) is not resumable (no takeover, lease or TTL). In P2 and C2 the seam returns
`revision_upstream_incomplete` with zero revision work and calls no upstream provider. After the first Critic row, ordinary Pass-1 re-entry
stops `pass1_unexpected_state`; after the first revision row, ordinary Critic re-entry stops `critic_unexpected_state` (by design).

## 3. Request, manifest, reservation, outcome

Five ordered input references, identities only (no body is copied): the Pass-1 parent script, the stored Critic review, the Brief, the
writer-view/2 and the writer-context-manifest/2. The adapter is pure, takes no pool or queryable and dereferences nothing; R005 has no
`writer_revision` ceiling key, so "writer_revision = Writer" is an upper bound, not a grant (a real consumer rendering needs a separately
authorized design). Pinned literals (never adjusted to fit): request recipe `craft-revision-request/1`, 1,405 bytes, SHA-256
`7e298f22e2c8ec15fc13c27e2ea402dab8c65428330fc6ce04756d284a782f78`; manifest artifact hash
`727f9d3943d1e7e4f90321505f805fc29ba65388cc03a1340dc6275b96836c94`; semantic-input hash
`2e5e86960395c8be57db1ab07322e1ffbdacca69ace16c176bb302c6e069fd88`; model identifier `fixture_stub/craft-revision-v1`; logical request key
`fixture_stub:writer_revision:<request hash>`; response reference `craft-revision-specimen/1:<specimen sha>:<child hash>`. Fresh storage UUIDs are
derived in the namespace `the-desk.craft-revision.id/1` from the child hash; semantic turn anchors continue. The admitted reservation is
authored once; `perform` asserts the six identity fields and returns the deep-frozen specimen; `finish` requires the specimen's canonical SHA-256.

## 4. The specimen, admission and storage

The specimen (`src/fixture/craft-revision-specimen.ts`) has canonical-JSON SHA-256 `0c2c528ed19ffdee7b0d6a87d60605a85bee0513fb357e9e2b073e597ecd4a4d`
(9,868 bytes) and child `script-v2` hash `4a927ad9cd612aa0f2f57ed52273061abcfe8f1ba8d8f864ca2a25907c517b00`, which includes the semantic
`revision_parent_content_identity`. Exactly four turns change (t08 cf01; t10, t12, t13 cf02); thirteen are byte-identical; one claim-use span moves
(claim 0007 on t13, 0-30 to 68-98). The text is authored fixture content, not model output or an editorial judgment.

Closed first-error admission order: (1) the recursive grammar (exact own keys and primitive types at every level, unknown key before missing key,
fixed traversal order; `finding_refs` is only an array of strings: its cardinality, contents, value and order bind at step 3); (2) NFC; (3) subject
binding (policy, Brief, package, parent hash, review hash and outcome, finding list); (4) protected structure (block refs, turn structure); (5) the
changed-text set equals the cited anchors; (6) uses identical except spans; (7) spans in code-point range; (8) child span text equals the protected
parent text, then the closed retained-segment table; (9) prediction candidates; (10) the 24-code-point withheld-text guard. Then the mapping: hash
with temporary ids equals the pin, derive ids, rehash, specimen identity. A stored payload of 23 keys carries `finding_refs`, `revision_parent_id`, `revision_parent_content_identity`, `script_phase` `craft_revision` and
`revision_reason`. The bookkeeping fields `finding_refs`, `revision_parent_id`, `script_phase` and `revision_reason` are outside the governed hash. The
semantic `revision_parent_content_identity` is included in the governed script hash. The relational `revision_parent_id` and
`revision_parent_content_identity` form the pair the database requires.

Closed `field` labels: the fifteen top-level key names, `specimen`, `turn`, `claim_use`, `evidence_use`, `prediction`, `spoken_text`,
`turn_structure`, `turn_scope`, `use_span_text`, `retained_segment`. Closed `surface`: `specimen`, `request`, `manifest`, `script_payload`.
Nothing about an input key, path or text is echoed. The 24-code-point scanner detects only runs of 24 or more code points shared with a withheld
original; it does not detect a four-character literal, a numeric value, a structural mutation or a semantic property. Exposure is therefore
asserted per surface by exact recipe or shape equality (request, manifest), the overlap scanner and fixed surface assertions in tests.

## 5. Persistence protocol and recovery

Revision own state R is monotone over four levels (T1r, reservation, event, T3r): R0 nothing, R1 two rows, R2 three, R3 four, R4 thirty-nine. The
composite count equation is `n = fixture + Pass-1 owned (41) + Critic owned (6) + revision owned (R)`; total additive rows at R4 are 86. The
classifier is pure, first match wins: host, bindings, rights; Pass-1 mismatch; Pass-1 incomplete; Critic mismatch or review not reconciling;
Critic incomplete; **budget probe**; own-row conflicts or non-monotone sets; R4 child not reconciling; count equation; final mode needs R4.

- T1r (`stageRevisionInputs`): one command under the per-call advisory lock (class 182736481, key `hashtext(provider_call_id)`; no new class);
  the Pass-1 script and its `script_versions` row, W2, C2, the stored review (every planned column) and the Brief (id/type/hash) must be present and
  equal; then two `ensureRow` calls.
- E (`executeRevisionCall`): `executeProviderCall` with a finite allowlist (only an exact `performed`, or an exact `completed` of this authored id,
  proceeds) and exact durable call and event verification. A reservation without an outcome is `revision_provider_unfinished`; there is no takeover.
- T3r (`recordRevisionLineage`): lock; exact call and event; inputs; exact T1r rows; the budget probe in the transaction; 35 `ensureRow` calls; then
  the revision-owned `reconcileRevisionRows`. A failed reconciliation rolls back every row the command added.

`reconcileRevisionRows` (pure; first failing step): (1) the fetched payload equals the plan payload exactly; (2) relational and payload carriers
agree; (3) the verified parent pair (relational pair, payload pair and the parent artifact's stored content hash); (4) rebuild from the fetched
rows with the verified relational identity; (5) the hash equals the payload hash, the artifact hash and the pin; then the model-run binding. It
never passes an expected hash to the root helper and never drops the identity.

**At most one substantive revision** is detected, not database-enforced (no migration is authorized): the snapshot's probe (statement 92) and the
in-transaction probe name any `script_versions` row whose parent is the Pass-1 version or the planned child and whose id is not the planned
child (`revision_budget_exceeded`). A non-participating writer committing a second child after our last check is detected at the final snapshot;
`recorded` is never returned.

The snapshot is one `REPEATABLE READ READ ONLY` transaction of 94 SELECTs (the 53 accepted critic statements without their counts, 2 T1r rows, 35
T3r rows with the child payload at index 55, call, events, the budget probe, counts), SELECT privilege only, with ownership-based cleanup (a
failed connect acquires nothing; at most one ROLLBACK; exactly one attempted `release(true)`; a throwing release after COMMIT discards the data
and is counted once, with destruction never claimed confirmed).

## 6. Closed result, errors and stop mapping

`recorded` carries 14 identities, per-layer `upstream` facts, `gates_not_run`, `not_proven` (including `revision_quality`) and the durable facts.
`stopped` carries stage, code (37 closed codes), `writes_attempted`, `upstream {pass1, critic}`, `durable`, cleanup and closed optional detail.

Each upstream fact becomes `present` when a committed snapshot of this call verifies that layer complete (Pass 1 at V3, Critic at V4); a later
failure never downgrades an established fact. A well-formed but differing Pass-1 record yields `{pass1: unknown, critic: unknown}`; a well-formed
but differing Critic record with the exact retained Pass-1 record yields `{pass1: present, critic: unknown}`. A missing or malformed retained
record is `revision_invocation_invalid` before any snapshot; a differing revision record on re-entry is `revision_unexpected_state`.

Error identity: revision-owned catches propagate the throwable they receive unchanged unless it is an explicitly mapped type
(`CommandConnectionError`, `ProviderExecutionError`). An error converted to a `DbError` by the accepted `tx.attempt` path and passed to `rethrow`
becomes a new Error carrying code and constraint; that is not a guarantee about every database failure: ordinary probe/query failures may reach
the revision-owned catch unchanged, while session-loss and cleanup transformations keep their accepted behaviour. `runCommand`, `ensureRow`,
provider wrapping and snapshot cleanup are unchanged. `CommandConnectionError` maps in its constructor-reachable pairs only; without prior
verified presence the stage fact is `unknown`, never `none_observed`.

Observer catalog: the eight literals carried by a `code:` assignment in this module are in `KNOWN_OUTCOME_CODES`
(`revision_budget_exceeded`, `revision_command_connection`, `revision_preflight_failed`, `revision_prerequisite_missing`,
`revision_provider_error`, `revision_provider_mismatch`, `revision_reconcile_failed`, `revision_stage_conflict`); `writer_revision` is already a
known operation. Fault points (inert unless `DESK_TEST_FAULTS=1`): `craft_revision_preflight_after_first_read`, `craft_revision_after_preflight`,
`craft_revision_perform`, `craft_revision_before_final_check`.

## 7. Non-claims

Not SCRIPTED, not READY, not G1-B, no gate discharged, no semantic audit, no Writing section 28 discharge, no live or paid model call, no audio,
no real-model quality claim, no independent semantic judgment of the revision, no rights finding, no timing or budget fit (word growth 379 to 453 is
recorded only; a later budget overshoot is a Writing 24.2 soft warning). Session scope is the Pass-1 scope: a trusted, exclusively owned
disposable fixture session; non-participating writers are outside the proof. The user alone merges.

## 8. Test inventory and bounds (the implementation's, not results)

`test/unit/craft-revision-plan.test.ts`: 32 database-free cases (RU01-RU32). `test/integration/craft-revision.test.ts`: 23 cases (RI01-RI23) on
disposable PostgreSQL 17, plus an uncounted teardown. Subcases are nested within these 55 fixed top-level cases and are not counted. Expected
totals after the implementation (to be recomputed from the implemented tests, never relaxed): 347 source members, 71 tracked test files, 70
aggregate-selected files, 25 integration files, 8,349 tests. These are derived expectations, not results.
