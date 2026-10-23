# G1-A fixed fixture deterministic Claims/Writing gate seam and SpeechTexture content-diff lock (`claims-writing-gate/1`)

Status: dependent contract of Lock v1.2.7 (no Lock edit, no new epoch), condensed from the accepted design packet `pr33-gate-design-002`
(archive 72,855 bytes, SHA-256 `ecd2321e4d0986be1389b73f047030c20a7bea365b28a3ba185581c6f8e0861f`, manifest SHA-256
`b98535badb79167e408a07ea25b3e88b6efdd2980102c4e75655cb802a5b9385`) as amended by the final ROOT controlling erratum E1
(`PR33-ROOT-controlling-erratum-E1-20261022.md`, 2,477 bytes, SHA-256 `0554cd59769e3cd5ff3accb0ae1afa7cdb8d52f6c7bc9c5d4d64678f608b4264`), which
adopts the focused independent review R1-R6 (`PR33-design002-focused-independent-review-20261022.md`, 29,771 bytes, SHA-256
`ba9f376007a52ec47dd47380ba0f5fe9fe93b7e8c74b67d887450d917712229f`; conformance acceptance 5,596 bytes, SHA-256
`303fb2d254c1c92bfd5b9b3e3aaafa4b4937c11133578377900b2a58cbb95b44`). E1 and the report control where they conflict with the packet. Baseline: merged
main `363c902a580264d09a529a3f76b966de1f9f40c0`, tree `595ce2d3e987b079bb32550c56654f70f4fd13f7`. This seam is downstream of the four accepted layers
(`docs/g1-writer-pass1.md`, `docs/g1-craft-critic.md`, `docs/g1-craft-revision.md`, `docs/g1-speech-texture.md`), whose behaviour it reuses and does not
change.

**Source002 correction.** This document also incorporates the consolidated independent review of source001
(`PR33-source001-consolidated-independent-review-20261022.md`, 34,473 bytes, SHA-256
`fb392aa271c10ff4831711f4035d73b49319c2f0105e167b1b2bea5530b353a2`), findings F1-F6, adopted by ROOT as one finite source-only correction. The
cumulative product scope is **seven paths** (four new, three modified, still 356 source members): the six of source001 plus the existing
`src/runtime/observe.ts`, which gains exactly six `KNOWN_OUTCOME_CODES` strings (`gate_mapping_invariant`, `gate_precondition_failed`,
`gate_result_conflict`, `gate_result_foreign`, `gate_result_stale`, `gate_unexpected_state`: the set the accepted source-scanning test derives from
this module's object-literal code sites; the other fourteen stop names are not literal code sites and are not registered).

Nothing here is a model result, a semantic judgment, a rights finding, a Claims/Writing acceptance, SCRIPTED, READY, a G1-B certification or a lifecycle
step. This is an implementation of a design, not evidence that its tests pass; every count below is source-derived arithmetic or an implementation
target, never an observation. The intended production result is the TRUTHFUL result of the unchanged chain: failed, with retained proof and coverage
gaps, not a green disposition. The frozen script (`776eefad…6084fe0`), its substantive parent (`4a927ad9…17b00`) and the six-field fingerprint
(`1be8aaa9…a5ba`) are unchanged; no content repair, second child, reparenting, budget bypass or waiver exists.

## 1. Scope

One evaluation of the exact accepted speech-texture child (artifact `e25b9e76…`, version `063cbf1b-c4fa-4254-a63b-343dfd494787`) against the eighteen
frozen claims/writing gate definitions (`d1250019-0000-4000-8000-0000000000NN`, NN = 01..18), recorded as **18 additive `gate_results` rows and nothing
else**. Definitions: Claims section 22 checks 1-12 as rows 01-12; Writing hard failures H1, H2, H3, H11+H12, H16 and the diff lock as rows 13-18
(`participant_validity`, `planned_block_membership`, `required_blocks`, `provider_markup_lint`, `diff_lock`, `context_complete`). Claims checks 13
(state reconstruction) and 14 (support identity) are **preconditions with no row**: a failure is a stop. Out of scope: any other table, `audit_runs`,
semantic audit, performance direction, render/assembly/READY, repair, lifecycle (attempt and run stay `PENDING`), any provider, model, audio, network, new
table, migration, grant, dependency, service, framework or generic runner; no waiver, disposition or exemption input exists anywhere.

## 2. Inputs and the fingerprint

`C` the stored child payload (22 keys), `K` the stored substantive parent payload, `P` the frozen package manifest and `B` the Brief as the snapshot
captured them, `W`/`M` the Pass-1 writer view and writer-context manifest (hash-bound by the admitted plan), the gate-owned facts of nine factual
SELECTs, and static programming configuration (`participant_profiles`, the rundown template, `episode_modes`, `block_types`, the policy-version map and
the package) read from the verified pack and re-hashed against pinned SHA-256 values before use.

Domain `claims-writing-gate-input-v1`, exactly six keys `package_hash`, `brief_hash`, `script_hash`, `claims_policy_version`, `writing_policy_version`,
`gate_set_version` through the existing `fingerprint("claims_writing", …)`. All six are recomputed at plan time with the real helpers (package, Brief
and script hashes; both policy versions from the prompt-manifest `component_versions` AND the policy-version map; the gate-set constant imported from
`src/fixture/derive.ts`); the pin is a cross-check. Controls: the frozen historical projection `000b3e1e…`, parent-bound `7e4a9e49…`, `claims-0.1.1`
`900db1b0…`, `writing-0.2.2` `3345214c…`, `build2-gates-v2` `de53cbb1…`. The gate-set value has no mutable source slot; its stale control is a stale
projection through `buildGateProjection` and the fingerprint.

## 3. Findings, aggregate and coverage

A finding is a `violation` (a required predicate was evaluated and failed) or a `proof_gap` (a required proof is absent; never a claim that the statement
is false). The class is derived from the closed code. A row is `pass` iff it has zero findings. A `pass` needs an independently derived denominator
(the parent `K` or the package) equal to the examined count (`denominator_mismatch` otherwise); an empty set or a historical `pass` row never
establishes a current pass. Aggregate (disjoint, exhaustive): `failed` iff any violation; else `incomplete` iff any proof gap or any coverage entry
`not_established_required`; else `complete_defined_set`, which authorises nothing.

The coverage register (returned, never durable) closes every obligation with no definition: `C13` (`established_with_limits`:
`historical_visibility_unprovable`, `frozen_ceiling_unavailable`), `C14`, `H01` (`established_with_limits`: `show_roster_document_absent`), `H04` and
`H13` (`not_established_required`), `H14` (`inapplicable_witnessed` when the Brief has no `receipts` block), `X01`/`X02` (`deferred_semantic`) and the
twelve soft probes `W01`-`W12`. Soft warnings (`lexical_access_phrase`, `lexical_opener_repeat`, `overlap_run_24_unquoted`, `lexical_signposting`) never
fail the gate and are never durable.

## 4. The predicates (lexical and structural; none is a semantic verdict)

- **Typed value normalizer `fixture-value-forms/1`.** Tokens (decimal, hyphen compound, ordinal/integer, cardinal word one..ten) are classified by role
  and order, never by a bag of numerals. A count window is classified only inside one of the two accepted frames, `after the Nth minute in C of their
last S league matches` and `C late concessions in S`; each slot must have its declared form (an ordinal after-minute; plain-integer or cardinal
  count and sample size) and is converted exactly, never by a leading-digits prefix, so a decimal or compound count or a nonmatching frame fails
  closed (`numeral_form_unclassified`) while a well-formed wrong value keeps `numeral_role_order_mismatch`. A digit or word inside an evidence
  quotation carries no numeric role only if that quotation passes the same per-quotation approval predicate that check 5 uses (permission flags,
  locator identity, approved representation, marks and span); otherwise it is classified fail-closed. A plain-integer duration (`10 minutes`) reaches
  the same past-event / prospective / conditional proofs as a cardinal word; decimal, compound and ordinal durations do not. The source credit `One`
  must open a sentence (the text start, or after `.`, `?` or `!` and whitespace); a comma or colon is not a sentence start. Tokens: scoreline (subject-first), formation (order preserved), percent, after-minute / count / sample-size frames,
  observation count (with the tenor carrier projection), attested year, existential source credit (the exact `supports_value` evidence count), words
  inside an approved evidence quotation, deictic `one`, and duration context forms (`past_event_duration`, `prospective_prediction` of a registered
  candidate, `conditional_generic`, otherwise `violation duration_context_unclassified`). Every supported class additionally needs an authorised value
  relation: a package `supports_value` support whose hash proof holds and that equals the stored `claim_supports` row. On the pinned chain: 18 tokens, 13
  supported, 3 no-finding, 1 violation (`t04` precise past duration [136,139)) and 1 proof gap (`t08` conditional duration [127,130)). No 90 minus 80
  derivation is inferred.
- **Quotations.** An evidence quotation is covered by a `quoted` use whose text (marks removed) equals `permitted_quote.text`. A _metalinguistic
  mention_ is a single-quoted phrase whose immediately preceding exact two-word phrase is `the phrase`, `the word`, `the term` or `the expression`
  (one separating space), with no attribution verb in the clause, no evidence use over it, text that equals no package `permitted_quote.text` and no
  24-code-point run of a withheld original. Anything else is `quote_without_use`; no phrase allow-list exists.
- **Desk derivation (row 10).** Metadata only: rule, parameters, output equal to the claim value, output hash, ordered inputs and window identity
  against the run and the package's own `match_window_proof`. The count re-execution over withheld bodies is not performed (P3: the gate never reads
  `evidence_units.canonical_content`): the row carries a permanent `required_proof_not_established` proof gap and therefore `fail`.
- **Preconditions 13-14.** `verifyFrozenEntry` for the nine entries with `frozenCeiling = {unavailable: true}` and `currentCeiling = "assertable"`
  (nine bounded entry checks, not nine discharges of the historical permission input); support identity for every package support (kind/column
  agreement, kind-specific hash, equality with the stored row). A failure stops with zero rows.
- **Diff lock (row 17, DL01-DL19).** Child hash recomputed with the real helper (only `TypeError` is caught: `child_hash_unrecomputable`), lineage,
  relational parent, bindings, turn structure, scope equals the anchors of the pinned rewrite table `R`, per-turn rewrite equality, claim/evidence uses
  compared by position within their kind, spans and re-anchoring (`child = parent + Σ delta` of rows ending before the bound), numeric/quote/hedge/
  negation multisets, punctuation classes, predictions, `R` equals the pinned nine rows, relational rows equal the payload, and the first-refusal
  `admitTextureAgainst` translated once (only `instanceof TextureRefusal`). A diff lock proves preservation of the accepted delta (9 rows, 8 anchors,
  net −6 code points, `t13` and `t17` spans each shift by −1), not correctness of inherited prose.

Diff-lock row-set rules added by source002: presence and DL18 each independently require exact per-kind correspondence between payload uses and stored
relational rows (unique ids on both sides, complete coverage, equal turn id, target id, mode, start and end); a use with a missing, duplicate or
unequal mate is located, an extra relational row with no payload mate is the one finding with no location. After a tuple difference, the range, text
and re-anchor comparisons still run whenever both mates exist. `turn_structure_changed` for a changed turn is located at the stable positional parent
anchor, not at the child's possibly mutated anchor.

## 5. Rows and identity

`gate_result_id = deriveGateId("gate_result:" + F + ":" + definition_id)` (namespace `the-desk.claims-writing-gate.id/1`; bound to the single admitted
host attempt `e5aaee76-ec19-4917-b293-24a0435b3a92`). `result` is a closed 8-key object (`actor_id`, `actor_kind`, `check`, `facts`, `findings`,
`fingerprint_stage`, `schema` = `claims-writing-gate-result/1`, `subject_refs`); `facts` are integers only; findings carry only closed codes, anchors
`t01`-`t17`, code-point spans, a use index (claim uses then evidence uses), a reference or a texture code; no source text appears anywhere. `outcome` is
`pass` or `fail`; `created_at` is the caller-retained invocation string (never `now()`). The inner schemas are closed per definition: exactly the declared integer fact keys (`examined` and `expected_examined` plus the definition's own),
only the finding codes that definition may emit, and for each code exactly one of its accepted location-key variants (for example
`required_proof_not_established` carries exactly its `derivation_count_reexecution` reference, `denominator_mismatch` carries no location, and
`texture_admission_refused` requires a closed upstream code and permits only its declared field). Before the candidate evaluation can become ready,
the complete planned rows, warnings and coverage are scanned with the accepted 24-code-point primitives in production (a hit raises the constant guard
`TypeError` inside the reader's unowned-throwable path, before the native comparison and before any writer). Derived expectation on the pinned chain: 16 `pass`, 2 `fail`
(row 04: one violation and one proof gap; row 10: one proof gap); aggregate `failed`.

## 6. The coherent snapshot (E1/R1)

One `REPEATABLE READ READ ONLY` transaction: the 134 unchanged texture SELECTs, the 18-row definitions comparison (every column incl. the whole
`definition` jsonb), the host attempt's gate-row ids and nine factual SELECTs (145 static SELECTs); inside the transaction a private, non-writable
candidate evaluation is built from the plan and the captured facts; the 146th SELECT is a native comparison of all 31 historical and 18 computed owned
rows (every column; jsonb and `timestamptz` by database equality; only the 31 when no owned values can be computed). COMMIT and release must succeed
before a **reader-owned acquisition** exists (a frozen object bound in a module-private `WeakSet`, carrying the exact admitted plan, the captured rows,
the candidate and the comparison). Normal read: 146 SELECTs, 148 driver calls. A failed, partial or cleanup-failed read has no acquisition; after a
release failure the inherited API returns `cleanup: {attached_errors: 1, complete: true}` (bounded attempts completed; physical destruction is not
proved), the data is discarded and nothing is minted. An unowned exception from statement or candidate construction gets the same bounded cleanup and
is rethrown unchanged.

Precedence over one acquisition, first match wins: definitions complete (`gate_definitions_mismatch`); historical identity (`gate_history_mismatch`);
a recorded mapping/precondition stop; owned conflict (`gate_result_conflict`), stale (`gate_result_stale`), foreign (`gate_result_foreign`), owned
partial (`gate_unexpected_state`); then the **unchanged** `classifyTextureSnapshot` over a count projection that subtracts only the `k ∈ {0, 18}` owned
rows proven exactly equal (unrelated drift stays the texture classifier's own `texture_unexpected_state`, reported as `gate_upstream_stopped`); then the
texture state (`gate_texture_incomplete{texture_state}` below 4). `OwnedEvaluation` is minted only from a classified acquisition of an admitted plan.
A plain object, a raw snapshot, a component evaluation, a structural clone, another plan's object or a failed read can never write.
Consequence C1: once gate rows exist, the unchanged `runSpeechTexture` re-entry returns `texture_unexpected_state` with zero writes (as the unchanged
upstream runners refuse after downstream rows); nothing is weakened.

## 7. The write (all 18 rows or none) and recovery

`runCommand` (READ COMMITTED), advisory lock `[182736491, "claims_writing_gate:" + F]`. The complete read prefix is collected first (host, definitions,
host ids, native expected-row flags, texture witness) and classified as a whole before any INSERT: a converged or refused call is 9 driver calls; a
create is 65 (8 prefix, 18 × SAVEPOINT/INSERT/RELEASE, 2 reconcile reads, COMMIT). A unique race on `gate_results_pkey` is re-probed natively; any other
database error is rethrown through the command helper's documented projection. Only `CommandConnectionError` is mapped (`gate_command_connection`
with `phase` and `commit_outcome`; durable gate `unknown`, never inferred); an ordinary COMMIT error (cleanup ROLLBACK, 66 calls), a release failure after
an acknowledged COMMIT (the raw release error) and a rejected `connect()` propagate unchanged. After the write a fresh final snapshot must classify to
gate 18 + texture 4; a failure keeps `durable.gate: "present"` from the acknowledged create with `reconciled: false`. Entry at gate 18 converges with
zero writes and no final snapshot. No retry, takeover, lease, TTL, rollback-after-success or generic resume exists.

Concurrency bound: the lock serialises participating gate callers only; it does not exclude a texture re-entry or a non-participating writer;
`gate_results` has no uniqueness beyond its primary key, so a foreign different-id row cannot be prevented, only detected when visible in the relevant
snapshot (a row committed after a `REPEATABLE READ` snapshot began is invisible to it and is caught by the writer's re-partition under the lock or by the
next entry).

## 8. Closed results and errors

Twenty stop codes (`gate_invocation_invalid`, `gate_texture_plan_stopped`, `gate_input_identity_mismatch`, `gate_static_input_mismatch`,
`gate_attempt_unavailable`, `gate_snapshot_failed`, `gate_upstream_stopped`, `gate_texture_incomplete`, `gate_definitions_mismatch`,
`gate_history_mismatch`, `gate_result_conflict`, `gate_result_stale`, `gate_result_foreign`, `gate_unexpected_state`, `gate_mapping_invariant`,
`gate_precondition_failed`, `gate_write_rejected`, `gate_reconcile_failed`, `gate_command_connection`, `gate_final_state_mismatch`); a stop carries the
stage, cumulative `writes_attempted`, the per-layer upstream facts, `durable: {gate, texture}`, `reconciled: false`, `cleanup` and closed optional
details (never a message, cause, SQL, URL, text, claim value, key or path). Programmer errors (a foreign plan, a plan with texture inputs, a non-owned
evaluation, a non-acquisition) are `TypeError`s with constant text raised before any I/O. Every output surface (rows, warnings, coverage, stop,
summary) is scanned with the accepted 24-code-point primitives; the content guarantee is the closed vocabulary. Fault points (inert unless
`DESK_TEST_FAULTS=1`): `claims_writing_gate_after_preflight`, `claims_writing_gate_preflight_after_first_read`, `claims_writing_gate_after_lock`,
`claims_writing_gate_after_insert_5`, `claims_writing_gate_after_reconcile`, `claims_writing_gate_before_final_check`,
`claims_writing_gate_final_after_first_read`.

## 9. Non-claims

Not SCRIPTED, not READY, not G1-B, no Claims/Writing acceptance, no fourteen-gate discharge, no semantic audit, no implied-access assertion absent, no
unmarked non-numeric factual content absent, no derivation count re-execution, no naturalness, timing or budget fit, no live or paid model call, no
audio, no rights finding. Session scope is the accepted fixture scope: a trusted, exclusively owned disposable fixture session. The user alone merges.

## 10. Test inventory and bounds (the implementation's, not results)

`test/unit/claims-writing-gate-plan.test.ts`: 30 database-free grouped cases (GU01-GU30) with nested witnesses (uncounted); the planner and
orchestrator run through two counted doors; the writer and orchestrator run over one narrow scripted SQL router that simulates `gate_results` and the
texture snapshot. Derived unit targets: 12 external planner-door calls (one module-level plan, ten in GU02 and one distinct admitted plan in GU22; the nine internal planner
entries of the orchestrator runs are separate and not part of the 12), 4 real texture builds, 9 gate runs, 17 API-level `openFixturePack` calls (1 + 4 × 4; each can spawn native
processes, which are not counted), 2,182 scripted driver calls (148 acquisition + 334 writer + 1,700 orchestrator). `test/integration/claims-writing-gate.test.ts`:
16 grouped cases (GI01-GI16) over 8 fixture-prepared disposable PostgreSQL 17 scenario databases (A-H; the existing test cluster bootstrap additionally creates one temporary
non-migrated database, so nine `CREATE DATABASE` operations occur in setup, not eight) on the actual `desk_runtime` role, plus an uncounted teardown that asserts no
database or login role remains. Derived integration targets: 26 gate runs, 133 API-level pack opens, 4,719 gate driver calls (fixture, upstream, setup
and assertion queries are not included and not called zero). Expected aggregate after the implementation (to be recomputed from the implemented tests,
never relaxed): 356 source members, 75 tracked test files, 74 aggregate-selected files, 27 integration files, 8,443 tests; the focused parity harness
stays separately 2/2. The per-case timeout stays the existing 300,000 ms for integration and 120,000 ms for unit; no timeout is raised.
