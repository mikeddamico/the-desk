# G1-A fixed fixture Speech-Texture Pass 2 execution and immutable-texture-lineage seam (`speech-texture-fixture/1`)

Status: dependent contract of Lock v1.2.7 (no Lock edit, no new epoch), condensed from the accepted design packet
`PR32-speech-texture-pass2-design-packet-001-final.tar.gz` (98,794 bytes, SHA-256
`49491ec32476f1be866725449897a863643c51d6ebb716901a5a75565c0b63b8`, manifest SHA-256
`295f0222b6f1a6039c49ce3f1ef5d91b827d0528cedf63ca21b47018bff3ac72`) as amended by the adopted ROOT technical erratum E1
(`PR32-design001-ROOT-technical-erratum-E1-20261021.md`, 27,480 bytes, SHA-256
`af7148640a283e55edec40236e67b267deccb53aaf104e5385668896756d6cd3`), which controls where it conflicts with the packet. Baseline: merged main
`2c9858f6328e290b1910116812edced78cff9d6b`, tree `51d788add73c9eba311e15e0db6a5ff48185bfec`. This seam is downstream of
`writer-fixture-pass1/1` (`docs/g1-writer-pass1.md`), `craft-critic-fixture/1` (`docs/g1-craft-critic.md`) and `craft-revision-fixture/1`
(`docs/g1-craft-revision.md`), whose accepted behaviour it reuses and does not change.

Nothing here is a model result, a quality judgment, a rights finding, a G1-B certification or a lifecycle step. This is an implementation of a
design, not evidence that its tests pass; validation is a separate, later, independently released phase. A deterministic stub returns a fixed
authored specimen: nothing here states anything about model behaviour, independent semantic judgment, speech naturalness, texture quality,
timing or budget fit, human preference or Writing section 28. Addendum F6 (actual-consumer acceptance) is NOT discharged. The historical
benchmark remains FAIL (50%).

## 1. Scope

One honestly identified speech-texture child of the CURRENT substantive script (the accepted Craft Revision child, `script-v2` hash
`4a927ad9cd612aa0f2f57ed52273061abcfe8f1ba8d8f864ca2a25907c517b00`, relational version `ee585057-e51a-4dda-9bf9-52ce6c9c683e`) is recorded
through the retained trusted non-network G1-A `fixture_stub` route (unchanged `executeProviderCall`, uncertified: all eight admission columns
stay NULL, six on the call row and two on the event; never described as G1-B), operation and purpose `speech_texture`, as **39 additive rows in
existing tables**: T1t two (`artifacts` type `prompt_manifest_4`, `prompt_manifests`), reservation and event two (`provider_calls`,
`provider_call_events`), T3t thirty-five (`artifacts` type `script_pass2`, schema `speech-texture-script/1`, `script_versions`, 17 `turns`, 12
`turn_claim_uses`, 3 `turn_evidence_uses`, `model_runs`). Every owned or mapped refusal is a closed typed stop; an unowned error propagates with
its identity unchanged. R005 has no `speech_texture` ceiling key: reading the role as the Writer would be an upper bound, never a grant.

Out of scope: any other change to the script, deterministic Claims/Writing gates, diff-lock gate, lint, performance direction, semantic audit
(`audit_runs`, `gate_results`), render/assembly/READY, repair, lifecycle transitions (attempt and run stay `PENDING`), any live or paid
provider, any new table, migration, grant, SECURITY DEFINER helper, service, framework, dependency, queue, generic runner, generic retry or
resume, lease, TTL, takeover, and any new rights grant or rights row.

## 2. The four layers and the upstream predicate

The handoff is a verified predicate over durable rows, re-derived inside the texture's own coherent snapshot. The seam never calls an
upstream provider and never re-runs the strict fixture qualification. The texture classifier evaluates each layer once, in order, and only a
fully reconciled state 4 establishes that layer present:

1. Host, bindings and rights (`hostMatches`, `bindingsMatch`, `checkRightsPolicy`): `texture_attempt_unavailable`,
   `texture_input_identity_mismatch`, `texture_rights_exposure`; in final mode `texture_host_changed`.
2. Pass 1 (`upstreamStatus`): a mismatch is `texture_upstream_mismatch` (no layer newly verified). Incomplete is `texture_upstream_incomplete`
   only in preflight with no Critic, revision or texture row observed; in final mode, or with such a row, `texture_unexpected_state`.
3. Critic: `criticOwnState` is computed once. `null`, or state 4 with a failed `reviewReconciles`, is `texture_upstream_mismatch` (Pass 1
   present). States 0-3 are NOT run through complete-review reconciliation: preflight with no revision or texture row is
   `texture_upstream_incomplete`; final mode or a downstream row is `texture_unexpected_state`.
4. Revision: `revisionOwnState` is computed once. `null`, or state 4 with a failed parent-aware `revisionStateReconciles`, is
   `texture_upstream_mismatch` (Pass 1 and Critic present, revision unknown). States 0-3: preflight with no texture row is
   `texture_upstream_incomplete` (the texture seam never completes the revision: no takeover); final mode or a texture row is
   `texture_unexpected_state`.
5. The three-parent texture budget probe, the texture own state (T0-T4) and its parent-aware reconciliation, the strict count equation
   `n = fixture + Pass-1 owned (41) + Critic owned (6) + revision owned (39) + texture owned (T)`, and in final mode the demand for T4.

A preflight incomplete stop with no texture owned row reports all four texture durable facts `none_observed`; a mismatch, unexpected-state or
budget stop reports `unknown` unless this invocation already established stronger facts, and final failures merge into the invocation's
cumulative facts without erasing committed evidence. The accepted Pass-1, Critic and Revision classifiers are NOT weakened and are not called
downstream: their count equations and the revision's own budget probe reject every texture row by design, so after the first texture row
`runCraftRevision` refuses with its own contract (`revision_unexpected_state` or `revision_budget_exceeded`). There is no universal runner.

Serialization: every texture command takes the per-call advisory lock (class 182736481) keyed by the TEXTURE provider-call id, so participating
texture callers serialize. That lock does not exclude a concurrent revision writer, which uses a different call id: upstream completion, the
in-command budget probe and the final snapshot detect the stated contradictions inside the trusted fixture scope; they are not global exclusion
or a general serializable-writer proof.

## 3. Request, manifest, reservation, outcome

Four ordered input references, identities only (no body is copied): the safe Pass-1 script (`script_pass1`), the stored Critic review
(`writing_craft_review`), the exact accepted substantive script (`script_craft_revision`, the parent) and the Brief (`showrunner_brief`). No
writer-view/2, no context carrier, no claim or evidence body is referenced. The adapter is pure, takes no pool or queryable and dereferences
nothing. Pinned literals (never adjusted to fit): request recipe `speech-texture-request/1`, 1,342 bytes, SHA-256
`d5eba3bcdd96a37e4c4bb173a905a32a6a1e57994835d1122630bb9d3b2e675a`; manifest artifact hash
`ef4cfd0f5031e3b408096df64ff08bfa39be5f4a1b83de51e11e870f5633b17b`; semantic-input hash
`5b9eb333a39e83c25db8e21c9169b9649c250591b68351fd7cdafeb33fe9b623`; model identifier `fixture_stub/speech-texture-v1`; logical request key
`fixture_stub:speech_texture:<request hash>`; response reference `speech-texture-specimen/1:<specimen sha>:<child hash>`. Fresh storage UUIDs
are derived in the namespace `the-desk.speech-texture.id/1` from the child hash; semantic turn anchors continue.

The manifest check is the CURRENT writer-pass1 `checkManifestPair` through `checkTextureManifestPair` (`pass1_manifest_binding` becomes
`texture_manifest_binding`, `pass1_manifest_typed_mismatch` becomes `texture_manifest_typed_mismatch`). The legacy `verifyAddendumBindings`
compares against the 0.1 addendum version id and is not used; the role's presence in `addendumGovernedRoles` is descriptive, not a consumer
permission. The independently hashed raw policy source files and the 16-field manifest literal are unchanged.

## 4. The specimen, admission and storage

The specimen (`src/fixture/speech-texture-specimen.ts`, schema `speech-texture-specimen/1`, 13 top-level keys) has canonical-JSON SHA-256
`26473b55f9dfe00f17b75a16c82c4084fee5a98d61524d99a3e9c0f0b67b5359` (9,745 bytes) and child `script-v2` hash
`776eefadaa96ae3ef0030e48d15184ac1aa49032695d6e84f03b2ce9f6084fe0`, which includes the semantic `revision_parent_content_identity`
(`4a927ad9...`). The specimen has no `review_hash` and no `finding_refs`: Pass 2 is not review-driven. Eight of seventeen turns change and nine
are byte-identical (t01, t03, t04, t06, t10, t11, t12, t15, t16). The closed rewrite table R has nine rows: eight spoken contraction rows (t02, t05,
t07, t09, t13 twice, t14, t17) and one concession beat in t08 (`Fine.`, the main specimen; the alternative variant is not
operative). Fifteen use spans (12 claim, 3 evidence) keep their protected text; two move by one code point (t13 68-98 to 67-97, t17 26-29 to
25-28) and thirteen do not. The text is authored fixture content, not model output or an editorial judgment; whether it is better speech is an
editorial question this phase does not answer.

Overlap with the historical archive Pass 2 is stated exactly: eight complete child turns equal historical Pass-2 turns (t01, t02, t03, t04, t09,
t11, t14, t15); among the CHANGED turns only t02, t09 and t14 coincide with it (the same minimal contraction), which is not whole-script copying.
The current parent, not the historical revision, is the base: copying the historical Pass 2 would undo the accepted craft repairs.

Closed first-error admission order: (1) the recursive grammar (ordinary objects, exact own keys, strings for textual and identity fields, safe
integers for sequence and span positions, `schema = speech-texture-specimen/1`, `script_phase = speech_texture`, `revision_reason =
speech_texture_pass`, **`purpose = evaluation`**; unknown key before missing key, fixed traversal; no cardinality is a grammar predicate); (2)
NFC of every string leaf; (3) subject binding (policy, Brief, package, parent hash); (4) protected structure (block refs, turn structure); (5)
the changed-text set equals the anchors of R; (6) uses identical except spans (ids, modes, hashes, counts, order); (7) spans in code-point range;
(8) child span text equals the protected parent text; (9) protected tokens per changed turn (numeric tokens including the cardinal words one to
ten, single-quoted phrases, the closed hedge/attribution cue set, the negation count after contraction expansion, punctuation classes already used
by the parent script); (10) prediction candidates identical; (11) the 24-code-point withheld-text guard over every string leaf of the specimen;
(12) rewrite-table equality per changed turn. Then the mapping, each as a small exported texture-owned validator over the real helper hash and canonical SHA-256 against fixed module constants (never an injected answer): the temporary-id hash equals the pin (`texture_script_hash_mismatch`), the rebuilt final-id hash equals the same pin, the raw specimen canonical identity equals its pin and the six derived identities plus 32 row ids hold (each `texture_mapping_invariant`).
A stored payload of 22 keys is the revision's 23 minus `finding_refs`; `script_phase` `speech_texture` and `revision_reason`
`speech_texture_pass` are outside the governed hash, the semantic `revision_parent_content_identity` is inside it, and the relational
`revision_parent_id` (the substantive child's version) and `revision_parent_content_identity` form the pair the database requires.

Closed `field` labels (28): the 13 top-level key names, `specimen`, `turn`, `claim_use`, `evidence_use`, `prediction`, `spoken_text`,
`turn_structure`, `turn_scope`, `use_span_text`, `rewrite_row`, `numeric_token`, `quoted_text`, `hedge_cue`, `negation_balance`,
`punctuation_class`. Closed `surface`: `specimen`, `request`, `manifest`, `script_payload`. Nothing about an input key, path or text is echoed.
Every admission stop has exactly: `kind`, `stage`, `code`, `writes_attempted: false`, `upstream {pass1, critic, revision}` all `unknown`,
`durable` all `unknown`, `cleanup {attached_errors: 0, complete: true}`, plus `field` or `surface` only when the row supplies it.

The withheld-run scanner is a 24-code-point overlap guard over every string leaf of each supplied surface (object keys included). It does not
detect a four-character literal such as `0.58`, a numeric value, a structural mutation or any semantic property; those are protected by the
separate token predicates, exact recipe or shape equality, and per-surface assertions in the tests.

## 5. Persistence protocol and recovery

Texture own state T is monotone over four levels (T1t, reservation, event, T3t): T0 nothing, T1 two rows, T2 three, T3 four, T4 thirty-nine.
Total additive rows at T4 are 125 above the fixture (41 + 6 + 39 + 39), 523 logical rows in all (398 + 125).

- T1t (`stageTextureInputs`): one command under the per-call advisory lock; the Pass-1 script and its `script_versions` row, the stored review,
  the substantive child artifact and its `script_versions` row and the Brief must be present and equal; then two `ensureRow` calls.
- E (`executeTextureCall`): `executeProviderCall` with a finite allowlist (only an exact `performed`, or an exact `completed` of this authored
  id, proceeds) and exact durable call and event verification. Only the worker whose OWN committed reservation returned `created` may perform;
  a converged reservation never grants execution.
- T3t (`recordTextureLineage`): lock; exact call and event; inputs; exact T1t rows; the three-parent budget probe in the transaction; 35
  `ensureRow` calls; then the texture-owned `reconcileTextureRows`. A failed reconciliation rolls back every row the command added.

Recovery follows the OBSERVED durable state of a fresh entry: T0 creates T1t and follows the normal flow; T1 reserves under the existing
provider rule and follows the normal flow; **T2 is stranded** (`texture_provider_unfinished`: no perform, no invented outcome, no takeover, no
lineage write, no lease, TTL or new try), including a reservation whose COMMIT really happened and whose return was lost; T3 uses the already
durable matching outcome and records the lineage without another perform; T4 reconciles and converges with zero new rows and zero perform.
An unknown COMMIT is never assumed committed or rolled back: the next entry reads the state and this table governs it. A provably uncommitted
reservation leaves T1 and permits a later fresh reservation; a committed one leaves T2 and may not perform.

`reconcileTextureRows` (pure; first failing step): (1) the fetched payload equals the plan payload exactly; (2) relational and payload carriers
agree; (3) the verified parent pair (relational pair, payload pair and the SUBSTANTIVE child's stored content hash); (4) rebuild from the fetched
rows with the verified relational identity; (5) the hash equals the payload hash, the artifact hash and the pin; then the model-run binding. It
never passes an expected hash to the root helper and never drops the identity.

**The texture budget** is the successor-owned predicate: the `script_versions` rows whose parent is one of [the Pass-1 version, the substantive
child, the planned texture child] must be exactly `{(substantive child, Pass-1 version)}` optionally plus `{(planned texture child, substantive
child)}`. A second substantive child, a foreign second child of the substantive child and a child of the texture child are
`texture_budget_exceeded`; the legitimate texture child is not. It is detected, not database-enforced; a non-participating writer is outside
the proof.

The snapshot is one `REPEATABLE READ READ ONLY` transaction of 134 SELECTs: statements 0-92 are the accepted revision snapshot without its
counts (the 53 Critic statements, the 37 revision rows with the child payload at index 55, call, events and the revision's own budget probe
whose verdict is never used), 93-129 the 37 planned texture rows (the child payload at index 95), 130 the texture call, 131 its events, 132
the texture budget probe and 133 the counts. The reader is a bounded duplicate of the accepted reader (its statement list is fixed in the
accepted module, which is not edited), with ownership-based cleanup (a failed connect acquires nothing; at most one ROLLBACK; exactly one
attempted `release(true)`; a throwing release after COMMIT discards the data and is counted once, with destruction never claimed confirmed).

## 6. Closed result, errors and stop mapping

`recorded` carries 13 identities, per-layer `upstream` facts for all three upstream layers, `gates_not_run`, `not_proven` and the durable facts.
`stopped` carries stage, code (37 closed codes, the revision's 37 with the `texture_` prefix), `writes_attempted`, `upstream {pass1, critic,
revision}`, `durable`, cleanup and closed optional detail. No formal Claims/Writing gate is executed, persisted or returned; an informational
six-key fingerprint exists only as design arithmetic and is not a result of this seam.

Each upstream fact becomes `present` when a committed snapshot of this call verifies that layer complete; a later failure never downgrades an
established fact. A missing or malformed retained record is `texture_invocation_invalid` before any snapshot; a well-formed but differing
retained record is surfaced by the durable predicate.

Error identity: texture-owned catches propagate the throwable they receive unchanged unless it is an explicitly mapped type from its own origin.
A real `CommandConnectionError` at T1t or T3t is `texture_command_connection` with its real phase and commit outcome, the stage fact `unknown`
(never `none_observed`) and the actual attached cleanup count. The E boundary maps `ProviderExecutionError` to `texture_provider_error` with the
existing safe closed fields (reserve or record stage, actual `commit_state` and `reservation_commit_state`); it is not a command-connection stop
merely because a nested transport problem occurred, and its cleanup knowledge stays `{attached_errors: null, complete: false}`. An acknowledged
committed reservation or event supports a `present` fact; an unknown COMMIT stays `unknown`. An error converted to a `DbError` by the accepted
`tx.attempt` path and passed to `rethrow` becomes a new Error carrying code and constraint. `chaosPool`-style faults target the READ ONLY
snapshots only; a lost write acknowledgement is modelled at the writing-command boundary.

Observer catalog: the eight literals carried by a `code:` assignment in this module are in `KNOWN_OUTCOME_CODES` (`texture_budget_exceeded`,
`texture_command_connection`, `texture_preflight_failed`, `texture_prerequisite_missing`, `texture_provider_error`,
`texture_provider_mismatch`, `texture_reconcile_failed`, `texture_stage_conflict`); `speech_texture` is already a known operation. Fault points
(inert unless `DESK_TEST_FAULTS=1`): `speech_texture_preflight_after_first_read`, `speech_texture_after_preflight`, `speech_texture_perform`,
`speech_texture_before_final_check`.

## 7. Non-claims

Not SCRIPTED, not READY, not G1-B, no gate discharged, no diff-lock gate, no semantic audit, no Writing section 28 discharge, no live or paid
model call, no audio, no real-model quality claim, no naturalness, timing or budget-fit claim (the whitespace-token count 453 to 446 is recorded
only), no independent semantic judgment of the texture, no rights finding. Session scope is the Pass-1 scope: a trusted, exclusively owned
disposable fixture session; non-participating writers are outside the proof. The user alone merges.

## 8. Test inventory and bounds (the implementation's, not results)

`test/unit/speech-texture-plan.test.ts`: 28 database-free cases (TU01-TU28). `test/integration/speech-texture.test.ts`: 20 cases (TI01-TI20) on
disposable PostgreSQL 17, plus an uncounted teardown. Subcases are nested within these 48 fixed top-level cases and are not counted. The unit
file makes real planner and orchestrator calls only through two counted doors and asserts the totals (exactly the ten named orchestrator
invocations O1-O10; O10 is one already-complete T4 re-entry through both snapshots and all three components over a narrow scripted SQL router
that rejects any write or unscripted statement). Expected totals after the implementation (to be recomputed from the implemented tests, never relaxed): 352 source members, 73
tracked test files, 72 aggregate-selected files, 26 integration files, 8,397 tests; the focused parity harness stays separately 2/2. These are
derived expectations, not results.
