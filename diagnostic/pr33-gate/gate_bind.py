#!/usr/bin/python3
"""PR33 gate diagnostic: fixed source/control/tool/build binding, read-only database probe, verdict and evidence collection. Python standard library only.

PROPOSED (PR33 run86 diagnostic, derived from the accepted TU11 proposal003 binder), NOT RUN, NOT PARSED, NOT SYNTAX-CHECKED by its author. Hosted ubuntu-24.04
only. Subcommands: pre | dbprobe | bind-build | precheck | post | validate | collect.
There are NO other arguments, options or environment-selected paths: every path, hash and identity below is a literal. GITHUB_SHA identifies the
diagnostic CONTROL commit and is recorded SEPARATELY from the tested SOURCE commit; it is never treated as the product head, and this file does not
reuse the required workflow's PR/merge identity acceptance. The job's final gate is a separate outcome-only workflow step; nothing here runs after the upload.
The only use of the runner-provided GITHUB_OUTPUT channel is `collect` publishing the fixed boolean `upload_ready=true`, and only after it has verified
ownership of the capture root and exclusively created the fresh upload directory; the upload step is conditioned on exactly that output.
The test outcome and the evidence completeness are reported SEPARATELY: `validate` exits 0 exactly when the retained evidence is complete, whatever the
case results were; the workflow's final gate additionally requires the real test step to have succeeded, so a failing case keeps the job red.
PROPOSAL002 (R1-R3 of the independent review): bind-build FAILS CLOSED before the test unless the freshly measured dist equals the pinned run86 observation; the verbose
reporter's stdout (case records, final totals) and stderr (failure banners, FAIL references, diagnostic groups, dividers) are parsed separately; the 107 case names are an exact
bijection (the 14 parameterized observer names are literal members of the ledger).
"""
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import time
from pathlib import Path

SOURCE_SHA = "059ab1ef77c5a7386b085c687d1b78466c5ec79b"
SOURCE_PARENT = "16846a7dddbe9819fd1caf62d8f6acea24c5cb99"
SOURCE_TREE = "f18ecfac4d85f4c6cea41f6fef1928443d81d505"
INVENTORY_SHA256 = "0787cdc467527f89e90035279bb1836585463bc42ee057742ce72489d2f32379"
EXPECTED_FILES = 356
PKG_SHA256 = "8f93210a55c0500f00b663488a82630e20035283a48a99a8dfb468f647c48297"
LOCK_SHA256 = "d9c5387d473b5406636800ce99ef92670f9192297e355d03028f6214161980bd"
CI_REL = ".github/workflows/ci.yml"
CI_SHA256 = "8ada7fc271e4a1bc05980202775697f51e682f53079924903490b576c82803d4"
CI_BLOB = "5e087d1afe6df649575113c24d27140850e2da47"
NODE_VERSION = "24.21.0"
NPM_VERSION = "11.19.0"
VITEST_VERSION = "4.1.12"
# The three selected test files: path -> (bytes, sha256, git blob). They are also members of the 356-row inventory.
GATE_FILES = (
    "test/unit/claims-writing-gate-plan.test.ts",
    "test/integration/claims-writing-gate.test.ts",
    "test/runtime-observe.test.ts",
)
GATE_PINS = {
    'test/unit/claims-writing-gate-plan.test.ts': (173403, '3ab9455c0fa7a8ecc8349d032c5f82ade051cbc926020a13fb15ed23cc7dee16', 'a17d19f97e4a6999fc3f4025d7016a166367179c'),
    'test/integration/claims-writing-gate.test.ts': (54034, 'edf663371c1a9d7a6e0d3ca9709a48827bac7403bf0b88ca3ba60787875c7bc2', 'c8e7b928e6e1e6995678b73b23d5f8764d8805c0'),
    'test/runtime-observe.test.ts': (57419, '1d7fc615aaf791c2ab1e3532da9253b7fe4aee6b4c673dd088396a2749b6b054', 'a80ffcddaac60416d49c9a4b37116eff12b6c676'),
}
CASE_COUNTS = (30, 16, 61)
CASE_TOTAL = 107
# Case identities: the complete 107-name ledger, NORMATIVE (static text extraction from the pinned test sources; the 14 parameterized observer names are fixed by the independent
# review of the pinned reporter's %s formatting; nothing was executed). Each name is exactly "<file> > <describe title> > <case title>", the form in which the verbose reporter joins them.
# The first 93 entries are the literal source titles in source order, followed by the 14 parameterized names in the review's order (all observer file). An observed result record must
# equal one of these names exactly and every name must occur exactly once: a bijection, so a duplicate, substituted, missing, extra or malformed identity makes the evidence incomplete.
EXACT_CASES = (
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU01 pinned literals recomputed: owners, fingerprint and its five controls, 18 definition ids, 18 result ids, specimen and script hashes'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU02 planner admission: invalid invocations, foreign and conflicting plan inputs, seam equality, texture stops, owner derivation'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU03 six-field projection: exact keys, no seventh key, every source changes the fingerprint, owner equality sources'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU04 typed numeral normalizer against an independent oracle: 18 tokens ⇒ 13 supported / 3 no-finding / 1 violation / 1 proof gap, role and form controls'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU05 checks 1-2 presence and use permission: M1 unknown claim, M2 state-hash flip, M3 hedge control, M4 unknown evidence mode'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU06 check 3 silent non-leak: M5 reproduced value form, M6 reliance on the silent claim'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU07 check 4 value support: M7-M14 role/order, form, authorised relation, existential credit and deictic boundaries; CP04 component positive'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU08 checks 5-6 quote and paraphrase permission: M15-M18 incl. the genuine third-party quotation boundary'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU09 check 7 speaker attribution and the soft access phrase: M19 prefix, M20 mode, M21 lexical access phrase warns only'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU10 checks 8-9 claim state and program history: M22 coherent supersession, M23 withdrawn continuity'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU11 checks 10-11 desk derivation and incident status: M24-M27 incl. four metadata subcases; the metadata check is consistent on the pinned inputs'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU12 check 12 span integrity: M28 shifted span, M29 swapped use tuples'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU13 preconditions 13-14: M22b hash not recomputed, M24b support hash untouched, support-hash corruption; stop shape and zero rows'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU14 H1-H3 participant validity, planned block membership and required blocks: M30-M32'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU15 H11/H12/H16 provider markup, pronunciation respelling and writer-context completeness: M33-M35'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU16 diff-lock structure: M36-M42 incl. the duplicate-anchor boundary (unrecomputable hash, not a fabricated mismatch)'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU17 diff-lock tokens, predictions and lineage: M43-M47 incl. the hedge and prediction controls'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU18 the exact finite delta: 9 rows over 8 anchors, net −5 code points, shifts t13 −1 and t17 −1, nine byte-identical turns (independent oracle)'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU19 P0: a denominator derived from the parent, witness absence, and historical rows never a current pass'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU20 soft warnings: W1, W4, W6 and W12 fire on crafted input and never fail the gate; eight probes stay not established'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU21 aggregate algebra: disjoint and exhaustive truth table; gaps retained; complete_defined_set unreachable on the pinned chain'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU22 planned rows and evaluation ownership: 18 derived rows, closed 8-key result, closed vocabularies, no text, substitution refused with zero queries'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU23 the fixed snapshot: 145 static read-only SELECTs plus one private native comparison (146; 148 driver calls), order, parameters, count projection'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU24 classifier: G0/G18, owned 1-17, history, owned conflict by column, stale, foreign, definition drift, precedence, texture states and projection strictness'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU25 stop and return shapes: 20 closed codes, exact key sets, no message or cause, the recorded summary and the coverage register (H01 included)'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU26 writer through a scripted router, 9 subcases: create 65, converged 9, conflict 9, unnamed SQL error 25, connect rejection 0, loss at 30, COMMIT lost 65, ordinary COMMIT error 66, release failure 65'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU27 orchestrator over the scripted router, 9 runs: O1 create (unseamed, 361), O2 converge, O3 release-only snapshot failure, O4 stranded T2, O5 owned partial, O6 stale row, O7 failed write, O8 COMMIT lost, O9 final snapshot connect failure'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU28 withheld-text guard: a 24-code-point original run is found on every output surface, keys included, in the fixed order; constant error messages'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU29 zero provider: no provider execution or provider/model write; every INSERT targets gate_results; the unchanged reads of provider rows are allowed'),
    (0, 'test/unit/claims-writing-gate-plan.test.ts > claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit) > GU30 totals asserted at the doors: real builds 4, gate runs 9, planner doors 12, API-level pack opens 17, scripted driver calls 2,182 (148 + 334 + 1,700)'),
    (1, 'test/integration/claims-writing-gate.test.ts > claims/writing gate fixed fixture seam (disposable PostgreSQL 17, runtime role) > GI01 happy path on the actual runtime role through all four layers: exactly +18 gate_results and nothing else, stored vector 16 pass / 2 fail by native equality, host still PENDING, aggregate failed'),
    (1, 'test/integration/claims-writing-gate.test.ts > claims/writing gate fixed fixture seam (disposable PostgreSQL 17, runtime role) > GI02 repeated entry: two sequential re-entries converge on the 18 rows with zero delta'),
    (1, 'test/integration/claims-writing-gate.test.ts > claims/writing gate fixed fixture seam (disposable PostgreSQL 17, runtime role) > GI03 texture T0, T1, T3 and a stranded T2 stop with zero gate writes and zero perform; completing the texture then permits the gate'),
    (1, 'test/integration/claims-writing-gate.test.ts > claims/writing gate fixed fixture seam (disposable PostgreSQL 17, runtime role) > GI04 seeded rows refuse in strict priority with zero writes: owned partial, foreign, stale, owned conflict (history and definitions cannot be seeded: immutable)'),
    (1, 'test/integration/claims-writing-gate.test.ts > claims/writing gate fixed fixture seam (disposable PostgreSQL 17, runtime role) > GI05 two simultaneous callers released by a barrier after both preflights: one creates, one converges; the 18 rows exist once'),
    (1, 'test/integration/claims-writing-gate.test.ts > claims/writing gate fixed fixture seam (disposable PostgreSQL 17, runtime role) > GI06 failures at the lock, after the fifth insert and after the reconcile: the injected error propagates unchanged, the transaction rolls back, zero rows'),
    (1, 'test/integration/claims-writing-gate.test.ts > claims/writing gate fixed fixture seam (disposable PostgreSQL 17, runtime role) > GI07 COMMIT outcome uncertainty: the same stop for an unapplied and an applied lost acknowledgment; only the database tells them apart and the next entry reconciles'),
    (1, 'test/integration/claims-writing-gate.test.ts > claims/writing gate fixed fixture seam (disposable PostgreSQL 17, runtime role) > GI08 preflight snapshot failures (connect, BEGIN, the 70th driver call, COMMIT): gate_snapshot_failed with owned cleanup and zero writes'),
    (1, "test/integration/claims-writing-gate.test.ts > claims/writing gate fixed fixture seam (disposable PostgreSQL 17, runtime role) > GI09 interleaving: a foreign row visible to the final snapshot is detected with the acknowledged create retained; a row committed after the preflight snapshot began is invisible to it and caught by the writer's re-partition under the lock"),
    (1, 'test/integration/claims-writing-gate.test.ts > claims/writing gate fixed fixture seam (disposable PostgreSQL 17, runtime role) > GI10 the count projection is local: after the gate the unchanged texture runner stops texture_unexpected_state with zero writes, and the unprojected snapshot is refused too'),
    (1, 'test/integration/claims-writing-gate.test.ts > claims/writing gate fixed fixture seam (disposable PostgreSQL 17, runtime role) > GI11 no takeover: the unchanged Pass-1, Critic and Revision runners refuse the downstream state with zero writes'),
    (1, 'test/integration/claims-writing-gate.test.ts > claims/writing gate fixed fixture seam (disposable PostgreSQL 17, runtime role) > GI12 scope: only gate_results +18 against the pre-gate baseline; no audit run, no script version, no lifecycle change; host and run still PENDING'),
    (1, 'test/integration/claims-writing-gate.test.ts > claims/writing gate fixed fixture seam (disposable PostgreSQL 17, runtime role) > GI13 read-back: the 18 stored rows equal the authored expectation on every column by native jsonb and timestamptz equality; no other row carries the fingerprint'),
    (1, 'test/integration/claims-writing-gate.test.ts > claims/writing gate fixed fixture seam (disposable PostgreSQL 17, runtime role) > GI14 the 18 definition rows equal the loaded definitions with their full JSON; the fingerprint recomputed from stored values equals the stored one'),
    (1, 'test/integration/claims-writing-gate.test.ts > claims/writing gate fixed fixture seam (disposable PostgreSQL 17, runtime role) > GI15 role and privilege: the actual runtime role inserted the rows (GI01); UPDATE and DELETE of a gate row are refused by the immutability triggers'),
    (1, 'test/integration/claims-writing-gate.test.ts > claims/writing gate fixed fixture seam (disposable PostgreSQL 17, runtime role) > GI16 the 62 loaded gate rows (31 of the host attempt and 31 of the second attempt) still equal the fixture rows by id and every column; the counted doors of the file'),
    (2, 'test/runtime-observe.test.ts > projectEvent: a flat projection of validated values > certified reconcile reasons remain closed safe diagnostics; arbitrary canary reason is omitted'),
    (2, 'test/runtime-observe.test.ts > projectEvent: a flat projection of validated values > picks keys only: bodies, details, usage, messages and unknown keys never appear'),
    (2, 'test/runtime-observe.test.ts > projectEvent: a flat projection of validated values > validates every VALUE: invalid ids, hashes, keys, stages and enums are omitted, never echoed'),
    (2, 'test/runtime-observe.test.ts > projectEvent: a flat projection of validated values > the projection is IDEMPOTENT (the logger adapter re-projects): omitted unknown values keep their *_known:false markers'),
    (2, 'test/runtime-observe.test.ts > projectEvent: a flat projection of validated values > provider/operation are finite known allowlists: unknown values are omitted with known:false (a secret is never echoed)'),
    (2, 'test/runtime-observe.test.ts > projectEvent: a flat projection of validated values > codes: a known code passes, an unknown code is omitted with code_known:false'),
    (2, 'test/runtime-observe.test.ts > projectEvent: a flat projection of validated values > workflow events carry fixed counts only (no list), and no committed flag'),
    (2, 'test/runtime-observe.test.ts > projectEvent: a flat projection of validated values > never throws on adversarial input'),
    (2, 'test/runtime-observe.test.ts > contextProblem and readAttemptRun > validates a declared context at runtime (types alone are not enforcement)'),
    (2, 'test/runtime-observe.test.ts > contextProblem and readAttemptRun > derives the run id from the row, labels a missing attempt and a failed lookup truthfully, and never throws'),
    (2, 'test/runtime-observe.test.ts > runCommand emits ONE truthful event per invocation (scripted client, not real-PostgreSQL evidence) > created: committed, emitted AFTER the COMMIT acknowledgment and AFTER release'),
    (2, 'test/runtime-observe.test.ts > runCommand emits ONE truthful event per invocation (scripted client, not real-PostgreSQL evidence) > converged is committed; conflict and rejected are not_committed (after the ROLLBACK acknowledgment) with a known code'),
    (2, 'test/runtime-observe.test.ts > runCommand emits ONE truthful event per invocation (scripted client, not real-PostgreSQL evidence) > a request refused before any transaction emits one not_committed event'),
    (2, 'test/runtime-observe.test.ts > runCommand emits ONE truthful event per invocation (scripted client, not real-PostgreSQL evidence) > connection lost BEFORE COMMIT: error / not_committed / commit_outcome not_attempted (COMMIT never sent)'),
    (2, 'test/runtime-observe.test.ts > runCommand emits ONE truthful event per invocation (scripted client, not real-PostgreSQL evidence) > COMMIT sent and its acknowledgment lost: durability unknown, commit_outcome unknown (event and query-first 57P01 alike)'),
    (2, 'test/runtime-observe.test.ts > runCommand emits ONE truthful event per invocation (scripted client, not real-PostgreSQL evidence) > a 57P01 on a statement, and on a ROLLBACK, is classified by phase and never commit-unknown'),
    (2, 'test/runtime-observe.test.ts > runCommand emits ONE truthful event per invocation (scripted client, not real-PostgreSQL evidence) > an ORDINARY server error at COMMIT is not_committed (the server answered); an unclassified transport error in the commit phase is unknown'),
    (2, 'test/runtime-observe.test.ts > runCommand emits ONE truthful event per invocation (scripted client, not real-PostgreSQL evidence) > a loss recorded around an ACKNOWLEDGED COMMIT keeps committed and the result'),
    (2, 'test/runtime-observe.test.ts > runCommand emits ONE truthful event per invocation (scripted client, not real-PostgreSQL evidence) > success whose release throws: committed, the thrown cleanup error is reported by class and count only'),
    (2, 'test/runtime-observe.test.ts > runCommand emits ONE truthful event per invocation (scripted client, not real-PostgreSQL evidence) > a failed command with a secondary cleanup failure: first error class, count of cleanup failures, error identity untouched'),
    (2, 'test/runtime-observe.test.ts > runCommand emits ONE truthful event per invocation (scripted client, not real-PostgreSQL evidence) > without a trace nothing is emitted and behavior is unchanged'),
    (2, 'test/runtime-observe.test.ts > review regressions (scripted client, not real-PostgreSQL evidence) > a lookalike plain Error with a DatabaseError-like shape is not a server rejection: unknown'),
    (2, 'test/runtime-observe.test.ts > review regressions (scripted client, not real-PostgreSQL evidence) > a PRIMARY error whose `code` getter throws is rethrown unchanged: instrumentation can never replace it (the getter is reached only by instrumentation)'),
    (2, 'test/runtime-observe.test.ts > review regressions (scripted client, not real-PostgreSQL evidence) > a malformed trace whose `context`, `subject` or `command` getter throws is contained too'),
    (2, 'test/runtime-observe.test.ts > review regressions (scripted client, not real-PostgreSQL evidence) > the public logger adapter RE-PROJECTS: extra fields, invalid values and secrets in a type-cast event are not logged'),
    (2, 'test/runtime-observe.test.ts > review regressions (scripted client, not real-PostgreSQL evidence) > the public adapter given a MALFORMED workflow event never logs a transaction durability/connection/cleanup fact, and the level is not driven by one'),
    (2, 'test/runtime-observe.test.ts > review regressions (scripted client, not real-PostgreSQL evidence) > workflow entry points snapshot the declared context once: a throwing getter or malformed context is REFUSED before any database work (never thrown)'),
    (2, 'test/runtime-observe.test.ts > bounded noninterference: result, error and cleanup errors never change (no claim about observer duration or sink delivery) > a synchronously throwing observer: the result is returned unchanged and one fixed-text report is written'),
    (2, 'test/runtime-observe.test.ts > bounded noninterference: result, error and cleanup errors never change (no claim about observer duration or sink delivery) > an async observer that REJECTS (assignable to a void-returning type) is contained: no unhandled rejection, result unchanged'),
    (2, 'test/runtime-observe.test.ts > bounded noninterference: result, error and cleanup errors never change (no claim about observer duration or sink delivery) > a failing reporter (stderr.write throws) cannot affect the command'),
    (2, 'test/runtime-observe.test.ts > bounded noninterference: result, error and cleanup errors never change (no claim about observer duration or sink delivery) > with a failing observer the primary error identity and its cleanup errors are unchanged'),
    (2, 'test/runtime-observe.test.ts > bounded noninterference: result, error and cleanup errors never change (no claim about observer duration or sink delivery) > safeEmit contains a failure while RESOLVING the observer or building the event (throwing getters/Proxies), and drops only the event'),
    (2, 'test/runtime-observe.test.ts > supplementary scanner: independent syntax and catalog canaries > S1 retains genuine known and unknown literal positions and suffix calls'),
    (2, 'test/runtime-observe.test.ts > supplementary scanner: independent syntax and catalog canaries > S2 distinguishes complete code names from all four suffix neighbors'),
    (2, 'test/runtime-observe.test.ts > supplementary scanner: independent syntax and catalog canaries > S3 excludes annotations and documentary text but retains the same-value neighbor'),
    (2, 'test/runtime-observe.test.ts > supplementary scanner: independent syntax and catalog canaries > S4 collects quoted, computed, template, wrapped and escaped property spellings'),
    (2, 'test/runtime-observe.test.ts > supplementary scanner: independent syntax and catalog canaries > S5 traverses nested applicable children and keeps static member call forms'),
    (2, 'test/runtime-observe.test.ts > supplementary scanner: independent syntax and catalog canaries > S6 excludes dynamic values and rejects complete-word grammar violations'),
    (2, 'test/runtime-observe.test.ts > supplementary scanner: independent syntax and catalog canaries > S7 throws a fixed syntax failure before collecting and recognizes the repair'),
    (2, 'test/runtime-observe.test.ts > supplementary scanner: independent syntax and catalog canaries > S8 keeps private/optional terminals while external references stay inert'),
    (2, 'test/runtime-observe.test.ts > supplementary scanner: independent syntax and catalog canaries > covers every declared value wrapper without executing a value'),
    (2, 'test/runtime-observe.test.ts > supplementary scanner: independent syntax and catalog canaries > covers every declared static-name and callee wrapper'),
    (2, 'test/runtime-observe.test.ts > supplementary scanner: independent syntax and catalog canaries > keeps mixed nested unknown neighbors despite duplicates and irrelevant outers'),
    (2, 'test/runtime-observe.test.ts > supplementary scanner: independent syntax and catalog canaries > does not silently expand into class fields, local constants or assignments'),
    (2, 'test/runtime-observe.test.ts > supplementary scanner: independent syntax and catalog canaries > retains known collection through multiline and comment-separated syntax'),
    (2, 'test/runtime-observe.test.ts > supplementary scanner: independent syntax and catalog canaries > keeps documentary labels unknown and private payloads absent from projection'),
    (2, 'test/runtime-observe.test.ts > supplementary drift check (NOT the proof): syntax-scoped code literals in src/ are in the known set > every collected object-code or suffix-named call/new literal is a member of KNOWN_OUTCOME_CODES'),
    (2, 'test/runtime-observe.test.ts > review regressions (scripted client, not real-PostgreSQL evidence) > COMMIT rejected with a Node system error ECONNRESET (a `code` string, but NOT a server answer) stays unknown'),
    (2, 'test/runtime-observe.test.ts > review regressions (scripted client, not real-PostgreSQL evidence) > COMMIT rejected with a Node system error EPIPE (a `code` string, but NOT a server answer) stays unknown'),
    (2, 'test/runtime-observe.test.ts > review regressions (scripted client, not real-PostgreSQL evidence) > COMMIT rejected with a Node system error ETIMEDOUT (a `code` string, but NOT a server answer) stays unknown'),
    (2, 'test/runtime-observe.test.ts > review regressions (scripted client, not real-PostgreSQL evidence) > a real pg.DatabaseError severity ERROR SQLSTATE 23514 (deferred constraint rejection) at COMMIT is a definite server rejection: not_committed'),
    (2, 'test/runtime-observe.test.ts > review regressions (scripted client, not real-PostgreSQL evidence) > a real pg.DatabaseError severity ERROR SQLSTATE 40001 (serialization failure) at COMMIT is a definite server rejection: not_committed'),
    (2, 'test/runtime-observe.test.ts > review regressions (scripted client, not real-PostgreSQL evidence) > severity FATAL SQLSTATE 08006 (connection termination (class 08)) at COMMIT is NOT a definite rejection: unknown'),
    (2, 'test/runtime-observe.test.ts > review regressions (scripted client, not real-PostgreSQL evidence) > severity FATAL SQLSTATE 57P02 (crash shutdown) at COMMIT is NOT a definite rejection: unknown'),
    (2, 'test/runtime-observe.test.ts > review regressions (scripted client, not real-PostgreSQL evidence) > severity ERROR SQLSTATE 08006 (class 08 even with severity ERROR) at COMMIT is NOT a definite rejection: unknown'),
    (2, 'test/runtime-observe.test.ts > review regressions (scripted client, not real-PostgreSQL evidence) > severity PANIC SQLSTATE XX000 (PANIC) at COMMIT is NOT a definite rejection: unknown'),
    (2, 'test/runtime-observe.test.ts > review regressions (scripted client, not real-PostgreSQL evidence) > severity null SQLSTATE 23514 (missing severity) at COMMIT is NOT a definite rejection: unknown'),
    (2, 'test/runtime-observe.test.ts > review regressions (scripted client, not real-PostgreSQL evidence) > a malformed trace context (observer getter throws) cannot change the result or the primary error'),
    (2, 'test/runtime-observe.test.ts > review regressions (scripted client, not real-PostgreSQL evidence) > a malformed trace context (correlationId getter throws) cannot change the result or the primary error'),
    (2, 'test/runtime-observe.test.ts > review regressions (scripted client, not real-PostgreSQL evidence) > a malformed trace context (runId getter throws) cannot change the result or the primary error'),
    (2, 'test/runtime-observe.test.ts > review regressions (scripted client, not real-PostgreSQL evidence) > a malformed trace context (stage getter throws) cannot change the result or the primary error'),
)
DB_URL_LITERAL = "postgresql://postgres:postgres@localhost:5432/the_desk_test"   # the existing foundation-ci disposable service URL, exact
DB_NAME = "the_desk_test"
RUN86_DIST_FILES = 210                    # run86 observation for this source: bind-build fails closed BEFORE the test unless the FRESH build equals both pins (validate repeats the check)
RUN86_DIST_DIGEST = "b0a04bc8acb24e1f1547d00ba230fc009da4a30649e3813df11749d8c2533c56"
NODE_PROBE = """import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  const r = await client.query("select current_setting('server_version_num')::int as v, current_database() as d, current_user as u, (select rolsuper from pg_roles where rolname = current_user) as su, (select rolcreatedb from pg_roles where rolname = current_user) as cdb, (select rolcreaterole from pg_roles where rolname = current_user) as crole");
  const row = r.rows[0];
  console.log(JSON.stringify({ ok: true, v: row.v, d: row.d, u: row.u, su: row.su, cdb: row.cdb, crole: row.crole }));
} catch (error) {
  console.log(JSON.stringify({ ok: false, code: typeof error?.code === 'string' ? error.code : 'ERROR' }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
"""

WORKSPACE = Path("/home/runner/work/the-desk/the-desk")
TARGET = WORKSPACE / "pr33-gate-target"
CONTROL = WORKSPACE / "pr33-gate-control"
TEMP = Path("/home/runner/work/_temp")
BASE = TEMP / "g33"          # short on purpose: the inherited guard binds a unix socket below CAP/tmp (F1)
CAP = BASE / "c"
UPLOAD = BASE / "u"
CDIR = CONTROL / "diagnostic/pr33-gate"
INVENTORY_FILE = CDIR / "inventory-356.tsv"
# The complete reviewed control delta: five additions to the tested source tree, each committed as a regular 100644 blob.
CONTROL_FILES = (
    ".github/workflows/pr33-gate-diagnostic.yml",
    "diagnostic/pr33-gate/gate_bind.py",
    "diagnostic/pr33-gate/inventory-356.tsv",
    "diagnostic/pr33-gate/p33-gate-supervisor.py",
    "diagnostic/pr33-gate/run-gate.sh",
)
SYSTEM_TOOLS = ("/usr/bin/python3", "/usr/bin/timeout", "/usr/bin/env", "/bin/bash", "/usr/bin/git", "/usr/bin/ps", "/usr/bin/sha256sum")
GUARD_ARGV = ("/usr/bin/timeout --signal=TERM --kill-after=20 300 /usr/bin/python3 "
              "/home/runner/work/the-desk/the-desk/pr33-gate-control/diagnostic/pr33-gate/p33-gate-supervisor.py guard gate\n")
ENV_KEYS = ("PATH\nHOME\nTMPDIR\nLANG\nLC_ALL\nTZ\nCI\nTEST_DATABASE_URL\n", "PATH\nHOME\nTMPDIR\nLANG\nLC_ALL\nTZ\nCI\nTEST_DATABASE_URL\nRUNNER_TRACKING_ID\n")
ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
SOCKET_LIMIT = 108                  # sizeof(sockaddr_un.sun_path): the pathname plus its terminator must fit, so the pathname must be < 108 bytes
MAX_FILE = 64 * 1024 * 1024         # source, capture and read allowance (unchanged)
TOOL_MAX = 256 * 1024 * 1024        # separate read ceiling for explicit executable/tool hashing only (F2)
COLLECT_ENTRIES = 4096              # collection ceilings only (F4); not runtime allowances
COLLECT_DEPTH = 24
COLLECT_FILE = 64 * 1024 * 1024
COLLECT_TOTAL = 512 * 1024 * 1024
SOCKET_RE = re.compile(r"tmp/the-desk-p33-[0-9]+-[0-9a-f]{24}/attempt-[A-Za-z0-9_]{8}/guard\.sock")
VERDICT_ALL_PASS = "GATE_DIAGNOSTIC_ALL_107_CASES_PASSED"
VERDICT_FAILURES = "GATE_DIAGNOSTIC_EVIDENCE_COMPLETE_WITH_CASE_FAILURES"
VERDICT_INCOMPLETE = "GATE_DIAGNOSTIC_EVIDENCE_INCOMPLETE_HOLD"
T0 = time.monotonic()
MISSING = object()
UPLOAD_STATE = {"created": False}   # True only after THIS process exclusively created UPLOAD; a pre-existing directory is never ours to write into
LEDGER = []       # every fixed binding/version query of this process: argv, cwd, status, streams, timing
PARTIAL = {}      # measurements completed so far in this process


class Hold(Exception):
    """A closed stop: the message is a fixed label, never an input."""


def need(ok, label):
    if not ok:
        raise Hold(label)


def utc():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha256_file(path, limit=MAX_FILE):
    h = hashlib.sha256()
    size = 0
    with open(path, "rb") as stream:
        while True:
            block = stream.read(1 << 20)
            if not block:
                break
            size += len(block)
            need(size <= limit, "file_over_cap")
            h.update(block)
    return h.hexdigest(), size


def git_blob(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def as_text(value):
    if value is None:
        return ""
    return value.decode("utf-8", "replace") if isinstance(value, bytes) else str(value)


def run(argv, cwd, extra_path=None):
    """A short bounded fixed query: closed stdin (an empty pipe), capture-local HOME/TMPDIR, minimal environment. The complete argv/cwd/status/
    streams/timing are retained in the ledger FIRST, then any nonzero status, timeout or launch error is a HOLD. Never retried. Returns stdout text."""
    env = {"PATH": (extra_path + ":" if extra_path else "") + "/usr/bin:/bin", "HOME": str(CAP / "home"), "TMPDIR": str(CAP / "tmp"), "LANG": "C.UTF-8",
           "LC_ALL": "C.UTF-8", "GIT_OPTIONAL_LOCKS": "0", "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": str(CAP / "home/gitconfig-absent")}
    entry = {"argv": list(argv), "cwd": str(cwd)}
    started = time.monotonic()
    try:
        done = subprocess.run(argv, cwd=cwd, env=env, input=b"", capture_output=True, timeout=30, check=False)
    except subprocess.TimeoutExpired as error:
        entry.update(status="timeout_status_unknown", returncode=None, stdout=as_text(error.stdout), stderr=as_text(error.stderr),
                     seconds=round(time.monotonic() - started, 6))
        LEDGER.append(entry)
        raise Hold("command_timeout")
    except Exception as error:
        entry.update(status="launch_error:" + type(error).__name__, returncode=None, stdout="", stderr="", seconds=round(time.monotonic() - started, 6))
        LEDGER.append(entry)
        raise Hold("command_launch_error")
    entry.update(status="completed", returncode=done.returncode, stdout=as_text(done.stdout), stderr=as_text(done.stderr),
                 seconds=round(time.monotonic() - started, 6))
    LEDGER.append(entry)
    need(done.returncode == 0, "command_nonzero_status:" + os.path.basename(argv[0]))
    return entry["stdout"]


def real_dir(path, label):
    need(path.is_dir() and not path.is_symlink() and Path(os.path.realpath(path)) == path, label)


def walk(root):
    """Exact nonfollowing membership of `root`, excluding only the top-level .git, node_modules and dist entries (dist is measured by measure_dist). Modes keep every permission bit."""
    rows, dirs = {}, set()

    def visit(directory, prefix):
        with os.scandir(directory) as entries:
            ordered = sorted(entries, key=lambda e: e.name.encode())
        for entry in ordered:
            if prefix == "" and entry.name in (".git", "node_modules", "dist"):
                continue
            rel = prefix + entry.name
            st = entry.stat(follow_symlinks=False)
            if stat.S_ISDIR(st.st_mode):
                dirs.add(rel)
                visit(entry.path, rel + "/")
            elif stat.S_ISREG(st.st_mode):
                need(st.st_nlink == 1, "multilink_file:" + rel)
                digest, size = sha256_file(entry.path)
                need(size == st.st_size, "size_race:" + rel)
                rows[rel] = ("%o" % stat.S_IMODE(st.st_mode), size, digest)
            else:
                raise Hold("link_or_special_member:" + rel)

    visit(str(root), "")
    return rows, dirs


def expected_inventory():
    data = INVENTORY_FILE.read_bytes()
    need(sha256_bytes(data) == INVENTORY_SHA256, "inventory_file_identity")
    rows = {}
    for line in data.decode("utf-8").split("\n"):
        if not line:
            continue
        path, mode, size, digest = line.split("\t")
        rows[path] = (mode, int(size), digest)
    need(len(rows) == EXPECTED_FILES, "inventory_row_count")
    return rows


def _ancestors(path):
    parts = path.split("/")[:-1]
    return {"/".join(parts[: i + 1]) for i in range(len(parts))}


PRE_IGNORED = ([], ["!! node_modules/"])
BUILT_IGNORED = (["!! dist/"], ["!! dist/", "!! node_modules/"])


def measure_source(allowed=PRE_IGNORED):
    """A fresh read of the target checkout (git identity plus a complete nonfollowing 356-file walk); pre, bind-build and post each perform their own.
    Tracked or untracked changes are never tolerated. The only tolerated ignored entries are those listed for the phase: node_modules always, dist only
    after the build (dist is measured separately by measure_dist and is excluded from the source walk)."""
    real_dir(TARGET, "target_checkout_dir")
    head = run(["/usr/bin/git", "-C", str(TARGET), "rev-parse", "HEAD"], TARGET).strip()
    tree = run(["/usr/bin/git", "-C", str(TARGET), "rev-parse", "HEAD^{tree}"], TARGET).strip()
    parents = run(["/usr/bin/git", "-C", str(TARGET), "rev-list", "--parents", "-n1", "HEAD"], TARGET).split()
    need(head == SOURCE_SHA, "target_head_is_not_the_literal_source_commit")
    need(tree == SOURCE_TREE, "target_tree")
    need(parents == [SOURCE_SHA, SOURCE_PARENT], "target_sole_parent")
    status = run(["/usr/bin/git", "-C", str(TARGET), "status", "--porcelain=v1", "--ignored"], TARGET)
    lines = sorted(status.splitlines())
    ignored = [line for line in lines if line.startswith("!! ")]
    changed = [line for line in lines if not line.startswith("!! ")]
    need(changed == [], "target_worktree_not_clean:" + status[:80])
    need(ignored in [list(entry) for entry in allowed], "target_ignored_entries_unexpected:" + status[:80])
    rows, dirs = walk(TARGET)
    want = expected_inventory()
    need(rows == want, "membership_modes_sizes_or_hashes_differ_from_the_356_inventory")
    need(dirs == {a for p in want for a in _ancestors(p)}, "unexpected_directory_in_source_namespace")
    gate_tests = {}
    for rel in GATE_FILES:
        data = (TARGET / rel).read_bytes()
        nbytes, digest, blob = GATE_PINS[rel]
        need(len(data) == nbytes and sha256_bytes(data) == digest and git_blob(data) == blob, "gate_test_identity:" + rel)
        gate_tests[rel] = {"bytes": nbytes, "sha256": digest, "blob": blob}
    need(sha256_file(TARGET / "package.json")[0] == PKG_SHA256 and sha256_file(TARGET / "package-lock.json")[0] == LOCK_SHA256, "package_pair")
    inventory_text = "".join("%s\t%s\t%d\t%s\n" % (p, rows[p][0], rows[p][1], rows[p][2]) for p in sorted(rows, key=lambda s: s.encode()))
    need(sha256_bytes(inventory_text.encode()) == INVENTORY_SHA256, "rendered_inventory_identity")
    return {"source_head": head, "source_tree": tree, "source_parents": parents, "files": len(rows), "directories": len(dirs),
            "inventory_sha256": INVENTORY_SHA256, "gate_tests": gate_tests, "package_sha256": PKG_SHA256, "lock_sha256": LOCK_SHA256,
            "status": "", "ignored": ignored}


def measure_tools():
    """Actual hosted executable identities. Executables use the separate TOOL_MAX read ceiling; nothing here pins a hosted hash or size."""
    tools = {}
    for path in SYSTEM_TOOLS:
        real = os.path.realpath(path)
        digest, size = sha256_file(real, TOOL_MAX)
        tools[path] = {"realpath": real, "sha256": digest, "bytes": size}
    which = shutil.which("node")
    need(which is not None, "node_not_on_path")
    node = os.path.realpath(which)
    node_dir = os.path.dirname(node)
    version = run([node, "--version"], TARGET, node_dir).strip()
    need(version == "v" + NODE_VERSION, "node_version")
    digest, size = sha256_file(node, TOOL_MAX)
    tools["node"] = {"realpath": node, "sha256": digest, "bytes": size, "version": version}
    npm_version = run([os.path.join(node_dir, "npm"), "--version"], TARGET, node_dir).strip()
    need(npm_version == NPM_VERSION, "npm_version")
    tools["npm"] = {"version": npm_version}
    pkg_path = TARGET / "node_modules/vitest/package.json"
    pkg = json.loads(pkg_path.read_text("utf-8"))
    need(pkg.get("version") == VITEST_VERSION, "installed_vitest_version")
    entry = TARGET / "node_modules/vitest/vitest.mjs"
    digest, size = sha256_file(entry)
    tools["vitest"] = {"version": pkg["version"], "entrypoint": str(entry), "entrypoint_sha256": digest, "entrypoint_bytes": size,
                       "package_json_sha256": sha256_file(pkg_path)[0]}
    py = sys.version_info
    need(py[:2] in ((3, 12), (3, 13)) and sys.implementation.name == "cpython", "python_version")
    tools["python"] = {"version": sys.version, "executable": os.path.realpath(sys.executable)}
    return tools


def committed_file(root, rel):
    """Actual on-disk identity of one committed control file: regular, single-link, no intermediate link, every permission bit, bytes and git blob."""
    path = root / rel
    need(os.path.realpath(path) == str(path), "control_path_is_linked:" + rel)
    st = path.lstat()
    need(stat.S_ISREG(st.st_mode) and st.st_nlink == 1 and st.st_size <= MAX_FILE, "control_file_not_a_single_regular_file:" + rel)
    data = path.read_bytes()
    need(len(data) == st.st_size, "control_size_race:" + rel)
    return {"mode": "%o" % stat.S_IMODE(st.st_mode), "bytes": len(data), "sha256": sha256_bytes(data), "blob": git_blob(data)}


def measure_control(control_sha):
    """Control commit == GITHUB_SHA; its SOLE parent is the exact tested source; the parent-to-control tree delta is exactly the five reviewed
    additions (this also preserves the original ci.yml); a clean control worktree; each actual file equals its committed blob and mode."""
    head = run(["/usr/bin/git", "-C", str(CONTROL), "rev-parse", "HEAD"], CONTROL).strip()
    need(head == control_sha, "control_checkout_is_not_github_sha")
    parents = run(["/usr/bin/git", "-C", str(TARGET), "rev-list", "--parents", "-n1", control_sha], TARGET).split()
    need(parents == [control_sha, SOURCE_SHA], "control_sole_parent_is_not_the_tested_source")
    raw = run(["/usr/bin/git", "-C", str(TARGET), "diff-tree", "-r", "--raw", "--no-abbrev", "--no-renames", SOURCE_SHA, control_sha], TARGET)
    delta = {}
    for line in raw.splitlines():
        match = re.fullmatch(r":000000 100644 0{40} ([0-9a-f]{40}) A\t(.+)", line)
        need(match is not None, "control_delta_entry_is_not_a_reviewed_regular_addition")
        need(match.group(2) not in delta, "control_delta_duplicate_path")
        delta[match.group(2)] = match.group(1)
    need(sorted(delta) == list(CONTROL_FILES), "control_delta_is_not_exactly_the_five_reviewed_additions")
    status = run(["/usr/bin/git", "-C", str(CONTROL), "status", "--porcelain=v1", "--ignored"], CONTROL)
    need(status == "", "control_worktree_not_clean")
    listing = run(["/usr/bin/git", "-C", str(CONTROL), "ls-tree", "-r", "--full-tree", "HEAD", "--", *CONTROL_FILES, CI_REL], CONTROL)
    committed = {}
    for line in listing.splitlines():
        match = re.fullmatch(r"(100644) blob ([0-9a-f]{40})\t(.+)", line)
        need(match is not None, "control_committed_entry_is_not_a_regular_100644_blob")
        committed[match.group(3)] = match.group(2)
    need(sorted(committed) == sorted(CONTROL_FILES + (CI_REL,)), "control_committed_entries_incomplete")
    files = {}
    for rel in CONTROL_FILES:
        ident = committed_file(CONTROL, rel)
        need(ident["mode"] == "644" and ident["blob"] == committed[rel] == delta[rel], "control_file_differs_from_its_committed_blob_or_mode:" + rel)
        files[rel] = ident
    ci = committed_file(CONTROL, CI_REL)
    need(ci["sha256"] == CI_SHA256 and ci["blob"] == CI_BLOB == committed[CI_REL] and ci["mode"] == "644", "original_ci_yml_changed")
    files[CI_REL] = ci
    return {"head": head, "sole_parent": SOURCE_SHA, "delta": delta, "status": status, "files": files}


def socket_model():
    """The guard's unchanged runtime-directory/socket naming, modeled with the ACTUAL numeric uid: CAP/tmp/the-desk-p33-<uid>-<24 hex>/attempt-<8>/guard.sock.
    The pathname must be shorter than sizeof(sun_path)=108 bytes. A violation is a HOLD before anything is created or launched; there is no alternate path."""
    uid = os.getuid()
    key = hashlib.sha256(str(TARGET).encode()).hexdigest()[:24]
    path = "%s/tmp/the-desk-p33-%d-%s/attempt-%s/guard.sock" % (CAP, uid, key, "x" * 8)
    length = len(path.encode("utf-8"))
    model = {"uid": uid, "runtime_key": key, "modeled_path": path, "bytes": length, "limit": SOCKET_LIMIT, "rule": "bytes < limit"}
    PARTIAL["socket_model"] = model
    need(length < SOCKET_LIMIT, "guard_socket_pathname_not_shorter_than_108_bytes")
    return model


def write_new(path, value):
    data = (json.dumps(value, sort_keys=True, indent=2) + "\n").encode()
    write_bytes_new(path, data)


def write_bytes_new(path, data):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def read_bounded(path):
    """At most MAX_FILE bytes plus a one-byte overrun detector; MISSING for any unreadable, overlong or non-regular file."""
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(fd, "rb") as stream:
            if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
                return MISSING
            data = stream.read(MAX_FILE + 1)
    except OSError:
        return MISSING
    return MISSING if len(data) > MAX_FILE else data


def read_text(path):
    data = read_bounded(path)
    return MISSING if data is MISSING else data.decode("utf-8", "replace")


def load_json(path):
    data = read_bounded(path)
    if data is MISSING:
        return MISSING
    try:
        return json.loads(data.decode("utf-8"))
    except ValueError:
        return MISSING


def get(value, *keys):
    """Presence-checked lookup: an absent field is MISSING and can never become a falsey default."""
    for key in keys:
        if not isinstance(value, dict) or key not in value:
            return MISSING
        value = value[key]
    return value


def owned():
    marker = load_json(CAP / "owner.json")
    return (get(marker, "run_id") == os.environ.get("GITHUB_RUN_ID") and get(marker, "run_attempt") == os.environ.get("GITHUB_RUN_ATTEMPT")
            and os.environ.get("GITHUB_RUN_ID") is not None)


def write_failure(phase, kind, label):
    """Exclusive phase failure record with the accumulated ledger and partial measurements; best effort, never overwriting, never inventing a status."""
    record = {"phase": phase, "kind": kind, "label": label, "commands": LEDGER, "partial": PARTIAL, "utc": utc(),
              "monotonic_seconds": round(time.monotonic() - T0, 6)}
    if not owned():
        targets = []   # a root rejected as unowned is never written into: only the fixed HOLD/error reaches the job log
    elif phase == "collect":
        targets = [BASE / "collect-failure.json"] + ([UPLOAD / "collect-failure.json"] if UPLOAD_STATE["created"] else [])
    else:
        targets = [CAP / (phase + "-failure.json")]
    for target in targets:
        try:
            write_new(target, record)
        except Exception as error:
            print("failure record not written:", target, type(error).__name__, file=sys.stderr)


def common_identity():
    sha = os.environ.get("GITHUB_SHA", "")
    need(re.fullmatch(r"[0-9a-f]{40}", sha) is not None, "github_sha_shape")
    need(sha != SOURCE_SHA, "control_sha_equals_source_sha")
    real_dir(CONTROL, "control_checkout_dir")
    need(os.environ.get("RUNNER_TEMP") == str(TEMP), "runner_temp_literal")
    need(os.environ.get("GITHUB_WORKSPACE") == str(WORKSPACE), "workspace_literal")
    need(os.environ.get("GITHUB_EVENT_NAME") == "push" and os.environ.get("GITHUB_REF") == "refs/heads/diagnostic/pr33-gate-001", "event_and_ref")
    return {"control_github_sha": sha, "source_sha": SOURCE_SHA, "github_run_id": os.environ.get("GITHUB_RUN_ID"),
            "github_run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT"), "github_ref": os.environ.get("GITHUB_REF"),
            "github_event_name": os.environ.get("GITHUB_EVENT_NAME")}


def cmd_pre():
    model = socket_model()
    need(not os.path.lexists(BASE), "capture_base_must_be_absent")
    os.mkdir(BASE, 0o700)
    os.mkdir(CAP, 0o700)
    write_new(CAP / "owner.json", {"run_id": os.environ.get("GITHUB_RUN_ID"), "run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT"), "utc": utc()})
    os.mkdir(CAP / "home", 0o700)
    os.mkdir(CAP / "tmp", 0o700)
    identity = common_identity()
    PARTIAL["identity"] = identity
    control = measure_control(identity["control_github_sha"])
    PARTIAL["control"] = control
    source = measure_source()
    PARTIAL["source"] = source
    tools = measure_tools()
    PARTIAL["tools"] = tools
    write_new(CAP / "bind-pre.json", {"phase": "pre", **identity, "socket_model": model, "control": control, "source": source, "tools": tools,
                                      "commands": LEDGER, "utc": utc(), "monotonic_seconds": round(time.monotonic() - T0, 6)})
    print("pre ok")
    return 0


def without_ignored(source):
    return {key: value for key, value in source.items() if key != "ignored"}


def redact(text):
    """Only the exact disposable URL literal is replaced; nothing else is altered."""
    return text.replace(DB_URL_LITERAL, "[REDACTED_DISPOSABLE_TEST_DATABASE_URL]")


def interpret_db_probe(row):
    """The existing CI interpretation (tools/ci-validation/ci.py interpret_db_probe), same meaning: ok true, major 17, database the_desk_test, superuser."""
    errors, record = [], {}
    if not isinstance(row, dict) or row.get("ok") is not True:
        code = row.get("code") if isinstance(row, dict) and isinstance(row.get("code"), str) else "unknown"
        return ["database probe failed (error code %s)" % re.sub(r"[^A-Za-z0-9_]", "", code)[:32]], record
    version = row.get("v")
    record = {"server_version_num": version, "major": version // 10000 if isinstance(version, int) and not isinstance(version, bool) else None,
              "database": row.get("d"), "role": row.get("u"), "superuser": row.get("su"), "createdb": row.get("cdb"), "createrole": row.get("crole")}
    if record["major"] != 17:
        errors.append("database major version is not 17")
    if record["database"] != DB_NAME:
        errors.append("connected database is not " + DB_NAME)
    if record["superuser"] is not True:
        errors.append("connected role is not a superuser (cluster-wide role bootstrap is required)")
    return errors, record


def cmd_dbprobe():
    """The fixed read-only database probe of tools/ci-validation/ci.py: the same script text (NODE_PROBE), the same environment (PATH, HOME, TEST_DATABASE_URL),
    the same interpretation, run once against the disposable service in the target checkout. Unlike the CI probe (which discards stderr) both streams and
    the status are retained, with only the exact disposable URL literal redacted. No other SQL exists in this file."""
    need(owned(), "dbprobe_capture_not_owned")
    pre = load_json(CAP / "bind-pre.json")
    need(get(pre, "phase") == "pre", "dbprobe_without_pre_record")
    url = os.environ.get("TEST_DATABASE_URL")
    need(url == DB_URL_LITERAL, "test_database_url_is_not_the_disposable_literal")
    node = shutil.which("node")
    need(node is not None, "node_not_on_path")
    argv = [node, "--input-type=module", "-e", NODE_PROBE]
    env = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "HOME": str(CAP / "home"), "TEST_DATABASE_URL": url}
    record = {"phase": "dbprobe", "argv": [node, "--input-type=module", "-e", "<NODE_PROBE sha256 %s>" % sha256_bytes(NODE_PROBE.encode())],
              "cwd": str(TARGET), "env_keys": sorted(env), "timeout_seconds": 30, "errors": []}
    started = time.monotonic()
    try:
        done = subprocess.run(argv, cwd=TARGET, env=env, input=b"", capture_output=True, timeout=30, check=False)
    except subprocess.TimeoutExpired as error:
        record.update(status="timeout_status_unknown", returncode=None, stdout=redact(as_text(error.stdout)), stderr=redact(as_text(error.stderr)))
        record["errors"].append("database probe timed out")
    except Exception as error:
        record.update(status="launch_error:" + type(error).__name__, returncode=None, stdout="", stderr="")
        record["errors"].append("database probe could not be launched")
    else:
        stdout = as_text(done.stdout)
        record.update(status="completed", returncode=done.returncode, stdout=redact(stdout), stderr=redact(as_text(done.stderr)))
        if done.returncode != 0:
            record["errors"].append("database probe process exit status is %r, want exactly 0" % (done.returncode,))
        else:
            last = stdout.strip().splitlines()[-1:]
            try:
                row = json.loads(last[0]) if last else {}
            except ValueError:
                row = None
                record["errors"].append("database probe output unreadable")
            if row is not None:
                errors, info = interpret_db_probe(row)
                record["server"] = info
                record["errors"] += errors
    record["seconds"] = round(time.monotonic() - started, 6)
    record["ok"] = not record["errors"]
    write_new(CAP / "db-probe.json", record)
    print(json.dumps({"dbprobe": record["ok"], "errors": record["errors"][:3]}))
    need(record["ok"], "database_probe_failed")
    return 0


def measure_dist():
    """The emitted build output: a complete nonfollowing inventory of TARGET/dist (regular single-link files only), its count and the same digest recipe as
    tools/ci-validation/ci.py (sha256 over the sorted lines "<rel>\\0<bytes>\\0<sha256>" joined by newlines). Measured fresh; nothing is copied from an older record."""
    root = TARGET / "dist"
    need(root.is_dir() and not root.is_symlink() and Path(os.path.realpath(root)) == root, "dist_dir")
    rows = []

    def visit(directory, prefix):
        with os.scandir(directory) as entries:
            ordered = sorted(entries, key=lambda e: e.name.encode())
        for entry in ordered:
            rel = prefix + entry.name
            st = entry.stat(follow_symlinks=False)
            if stat.S_ISDIR(st.st_mode):
                visit(entry.path, rel + "/")
            elif stat.S_ISREG(st.st_mode):
                need(st.st_nlink == 1, "dist_multilink_file:" + rel)
                digest, size = sha256_file(entry.path)
                need(size == st.st_size, "dist_size_race:" + rel)
                rows.append((rel, size, digest))
                need(len(rows) <= 20000, "dist_file_bound")
            else:
                raise Hold("dist_link_or_special_member:" + rel)

    visit(str(root), "")
    need(rows != [], "dist_empty")
    ordered = sorted(rows)
    lines = ["%s\0%d\0%s" % (rel, size, digest) for rel, size, digest in ordered]
    return {"files": len(ordered), "digest": sha256_bytes("\n".join(lines).encode()), "inventory": [[rel, size, digest] for rel, size, digest in ordered]}


def cmd_bind_build():
    """After the existing `npm run build`: source, control, tools and the emitted dist are bound again BEFORE the test, and must equal the pre binding
    (dist is new). The dist count and digest are measured here; no earlier record is trusted. The record is written first, then the fresh count and digest must equal the pinned run86 observation or this step fails (the failure record prevents the test from launching)."""
    need(owned(), "bind_build_capture_not_owned")
    pre = load_json(CAP / "bind-pre.json")
    need(get(pre, "phase") == "pre", "bind_build_without_pre_record")
    probe = load_json(CAP / "db-probe.json")
    need(get(probe, "ok") is True, "bind_build_without_a_passing_database_probe")
    identity = common_identity()
    PARTIAL["identity"] = identity
    control = measure_control(identity["control_github_sha"])
    PARTIAL["control"] = control
    source = measure_source(BUILT_IGNORED)
    PARTIAL["source"] = source
    tools = measure_tools()
    PARTIAL["tools"] = tools
    dist = measure_dist()
    PARTIAL["dist"] = {"files": dist["files"], "digest": dist["digest"]}
    write_new(CAP / "bind-build.json", {"phase": "build", **identity, "control": control, "source": source, "tools": tools, "dist": dist,
                                        "commands": LEDGER, "utc": utc(), "monotonic_seconds": round(time.monotonic() - T0, 6)})
    need(identity["control_github_sha"] == pre["control_github_sha"], "control_identity_changed_before_test")
    need(control == pre["control"], "control_changed_before_test")
    need(without_ignored(source) == without_ignored(pre["source"]), "source_changed_by_setup_or_build")
    need(tools == pre["tools"], "tools_changed_before_test")
    need(dist["files"] == RUN86_DIST_FILES and dist["digest"] == RUN86_DIST_DIGEST, "dist_differs_from_run86_observation")
    print("bind-build ok", dist["files"], dist["digest"])
    return 0


def cmd_precheck():
    """Launcher gate: pre, the passing database probe and the build binding completed in this run, no failure record, the disposable URL is exactly the
    literal, the socket model re-derived and still fitting, and no stage directory yet."""
    need(owned(), "precheck_capture_not_owned")
    pre = load_json(CAP / "bind-pre.json")
    need(get(pre, "phase") == "pre", "precheck_pre_record")
    need(get(load_json(CAP / "db-probe.json"), "ok") is True, "precheck_database_probe")
    need(get(load_json(CAP / "bind-build.json"), "phase") == "build", "precheck_build_record")
    need(os.environ.get("TEST_DATABASE_URL") == DB_URL_LITERAL, "precheck_test_database_url")
    need(not [p for p in CAP.glob("*-failure.json")], "precheck_failure_record_present")
    again = socket_model()
    need(get(pre, "socket_model") == again, "precheck_socket_model_changed")
    need(not os.path.lexists(CAP / "stage"), "precheck_stage_exists")
    return 0


def cmd_post():
    """After the test, also after a failing test: control, source, tools and dist are measured again and must equal the pre/bind-build bindings."""
    need(owned(), "post_capture_not_owned")
    pre = load_json(CAP / "bind-pre.json")
    need(get(pre, "phase") == "pre", "post_without_pre_record")
    build = load_json(CAP / "bind-build.json")
    need(get(build, "phase") == "build", "post_without_build_record")
    identity = common_identity()
    PARTIAL["identity"] = identity
    control = measure_control(identity["control_github_sha"])
    PARTIAL["control"] = control
    source = measure_source(BUILT_IGNORED)
    PARTIAL["source"] = source
    tools = measure_tools()
    PARTIAL["tools"] = tools
    dist = measure_dist()
    PARTIAL["dist"] = {"files": dist["files"], "digest": dist["digest"]}
    write_new(CAP / "bind-post.json", {"phase": "post", **identity, "control": control, "source": source, "tools": tools, "dist": dist, "commands": LEDGER,
                                       "utc": utc(), "monotonic_seconds": round(time.monotonic() - T0, 6)})
    need(identity["control_github_sha"] == pre["control_github_sha"], "control_identity_changed")
    need(control == pre["control"], "control_changed_during_run")
    need(without_ignored(source) == without_ignored(pre["source"]), "source_changed_during_run")
    need(source["ignored"] == build["source"]["ignored"], "ignored_entries_changed_during_run")
    need(tools == pre["tools"], "tools_changed_during_run")
    need(dist == build["dist"], "dist_changed_during_run")
    print("post ok")
    return 0


# ---- Pinned Vitest 4.1.12 verbose reporter, as established by the independent review of the installed sources (stream split, FAIL/divider/banner structure).
# STDOUT carries the verbose case records (one line per case: glyph, full name, duration; short `→ message` arrows) and the final `Test Files` / `Tests` rows.
# STDERR carries the `Failed Suites` / `Failed Tests` banners, the exact `FAIL <identity>` references, the complete diagnostic bodies and the group dividers.
# The two streams are parsed SEPARATELY and never concatenated: there is no cross-stream chronology. printTestModule of the verbose reporter prints nothing, so
# per-file result rows are NOT expected; any record-looking line that is not a known case record is retained and makes the evidence incomplete.
PINNED_GLYPHS = {"✓": "pass", "×": "fail", "↓": "skip", "□": "todo"}
RECORD_START = re.compile(r"^[✓√×✗✘↓□○❯] ")
DURATION = re.compile(r" [0-9]+(?:\.[0-9]+)?m?s$")
FRAME = re.compile(r"^❯ .*:[0-9]+:[0-9]+")
BANNER = re.compile(r"^⎯+ (Failed Suites|Failed Tests) ([0-9]+) ⎯+$")
DIVIDER = re.compile(r"^⎯+(?: ?\[([0-9]+)/([0-9]+)\] ?⎯*)?$")
FAIL_REF = re.compile(r"^FAIL (.+)$")


def norm(text):
    return re.sub(r"\s+", " ", text.strip())


EXACT_NAMES = {norm(name): index for index, name in EXACT_CASES}
# Suite/file FAIL references can only be a selected file or one of the actual "<file> > <describe title>" suites; never a fabricated case identity.
SUITE_REFS = set(GATE_FILES) | {norm(name).rsplit(" > ", 1)[0] for _, name in EXACT_CASES}


def summary_counts(lines, label):
    """One `Test Files` / `Tests` row -> {total, passed, failed, ...}; None when the row is absent, repeated or not understood (never inferred)."""
    rows = [line for line in lines if line.startswith(label + " ")]
    if len(rows) != 1:
        return None
    match = re.fullmatch(re.escape(label) + r" (.+?) \(([0-9]+)\)", rows[0])
    if match is None:
        return None
    counts = {"total": int(match.group(2))}
    for part in match.group(1).split(" | "):
        piece = re.fullmatch(r"([0-9]+) (failed|passed|expected fail|skipped|todo)", part)
        if piece is None or piece.group(2) in counts:
            return None
        counts[piece.group(2)] = int(piece.group(1))
    return counts


def parse_stdout(out):
    """STDOUT only: the case records and the final summaries. Every record-looking line is either an exact expected case identity with a pinned glyph or is kept in
    `unclassified` (a per-file row, a `❯` marker, a non-pinned glyph, a substituted or malformed name). Short `→` arrows are counted, never taken as stacks."""
    lines = [norm(line) for line in ANSI.sub("", out).splitlines()]
    lines = [line for line in lines if line != ""]
    seen, unclassified, arrows = {}, [], 0
    for line in lines:
        if RECORD_START.match(line) is None:
            if line.startswith("→ "):
                arrows += 1
            continue
        status = PINNED_GLYPHS.get(line[0])
        name = DURATION.sub("", line[2:], count=1)
        if status is not None and name in EXACT_NAMES:
            seen.setdefault(name, []).append(status)
        else:
            unclassified.append(line[:300])
    return {"line_count": len(lines), "seen": seen, "unclassified": unclassified, "arrow_lines": arrows,
            "test_files": summary_counts(lines, "Test Files"), "tests": summary_counts(lines, "Tests")}


def parse_stderr(err):
    """STDERR only: the failure banners and the emitted (merged) error groups. A group is one or more exact `FAIL <identity>` references, a nonempty diagnostic body and a
    closing `[n/m]` divider; n advances once per emitted group and m is the raw error-list size before merging. Groups are read only after a `Failed ...` banner. Raw
    slices (the original, unstripped lines) are returned for retention; anything that does not form a complete group is recorded in `problems` / `stray`."""
    original = err.splitlines()
    lines = [norm(line) for line in ANSI.sub("", err).splitlines()]
    banners, groups, problems, stray, unhandled = [], [], [], [], False
    section, group = None, None
    for number, line in enumerate(lines, start=1):
        banner = BANNER.match(line)
        if banner is not None or (line.startswith("⎯") and "Unhandled" in line):
            if group is not None:
                problems.append("group_open_at_banner:%d" % group["start"])
                group = None
            if banner is not None:
                section = "suites" if banner.group(1) == "Failed Suites" else "tests"
                banners.append({"kind": section, "count": int(banner.group(2)), "line": number})
            else:
                section, unhandled = "unhandled", True
            continue
        if section in (None, "unhandled") or line == "":
            continue
        divider = DIVIDER.match(line) if line.startswith("⎯") else None
        if divider is not None and divider.group(1) is not None:
            if group is None:
                problems.append("unexpected_divider:%d" % number)
                group = None
                continue
            if group["body"] == 0:
                problems.append("group_without_diagnostic_body:%d" % group["start"])
            group.update(end=number, section=section, numerator=int(divider.group(1)), denominator=int(divider.group(2)))
            group["text"] = "\n".join(original[group["start"] - 1:number])
            groups.append(group)
            group = None
            continue
        ref = FAIL_REF.match(line)
        if ref is not None:
            if group is not None and group["body"] > 0:
                problems.append("group_without_closing_divider:%d" % group["start"])
                group = None
            if group is None:
                group = {"start": number, "refs": [], "body": 0, "frames": 0}
            group["refs"].append(ref.group(1))
            continue
        if group is None:
            stray.append("%d:%s" % (number, line[:200]))
        else:
            group["body"] += 1
            if FRAME.match(line):
                group["frames"] += 1
    if group is not None:
        problems.append("truncated_open_group:%d" % group["start"])
    return {"line_count": len(lines), "banners": banners, "groups": groups, "problems": problems, "stray": stray[:20], "stray_count": len(stray), "unhandled": unhandled}


def evaluate(check, report):
    """Every check reads the actual retained facts; an absent or mistyped field fails its check. `report` receives the facts the verdict publishes."""
    check("no_phase_failure_records", sorted(p.name for p in CAP.glob("*-failure.json")) == [])
    pre = load_json(CAP / "bind-pre.json")
    build = load_json(CAP / "bind-build.json")
    post = load_json(CAP / "bind-post.json")
    probe = load_json(CAP / "db-probe.json")
    check("bind_pre_record_present", get(pre, "phase") == "pre")
    check("bind_build_record_present", get(build, "phase") == "build")
    check("bind_post_record_present", get(post, "phase") == "post")
    check("database_probe_passed_postgres17_the_desk_test", get(probe, "ok") is True and get(probe, "server", "major") == 17
          and get(probe, "server", "database") == DB_NAME and get(probe, "returncode") == 0)
    for key in ("control_github_sha", "control", "tools"):
        check("pre_build_post_equal_" + key, get(pre, key) is not MISSING and get(pre, key) == get(build, key) == get(post, key))
    source_pre, source_build, source_post = get(pre, "source"), get(build, "source"), get(post, "source")
    check("source_equal_pre_build_post_modulo_ignored", all(isinstance(s, dict) for s in (source_pre, source_build, source_post))
          and without_ignored(source_pre) == without_ignored(source_build) == without_ignored(source_post))
    check("ignored_entries_as_expected", get(source_pre, "ignored") in ([], ["!! node_modules/"]) and get(source_build, "ignored") == get(source_post, "ignored")
          and get(source_build, "ignored") in (["!! dist/"], ["!! dist/", "!! node_modules/"]))
    dist_build, dist_post = get(build, "dist"), get(post, "dist")
    check("dist_inventory_equal_build_and_post", dist_build is not MISSING and dist_build == dist_post)
    dist_files, dist_digest = get(build, "dist", "files"), get(build, "dist", "digest")
    check("dist_nonempty_with_recorded_digest", isinstance(dist_files, int) and dist_files > 0 and isinstance(dist_digest, str) and len(dist_digest) == 64)
    report["dist"] = {"files": None if dist_files is MISSING else dist_files, "digest": None if dist_digest is MISSING else dist_digest}
    check("dist_matches_the_run86_observation_for_this_source", dist_files == RUN86_DIST_FILES and dist_digest == RUN86_DIST_DIGEST)
    check("source_sha_literal", get(pre, "source_sha") == SOURCE_SHA and get(post, "source_sha") == SOURCE_SHA)
    control_sha = get(pre, "control_github_sha")
    check("control_sha_distinct_from_source", isinstance(control_sha, str) and control_sha != SOURCE_SHA and get(pre, "control", "head") == control_sha)
    check("control_sole_parent_is_source", get(pre, "control", "sole_parent") == SOURCE_SHA)
    check("control_delta_is_the_five_files", isinstance(get(pre, "control", "delta"), dict) and sorted(get(pre, "control", "delta")) == list(CONTROL_FILES))
    check("control_worktree_clean", get(pre, "control", "status") == "")
    check("source_356_files", get(pre, "source", "files") == EXPECTED_FILES and get(pre, "source", "inventory_sha256") == INVENTORY_SHA256)
    check("gate_test_files_pinned", get(pre, "source", "gate_tests") == {rel: {"bytes": GATE_PINS[rel][0], "sha256": GATE_PINS[rel][1], "blob": GATE_PINS[rel][2]} for rel in GATE_FILES})
    modeled = get(pre, "socket_model", "bytes")
    check("socket_path_shorter_than_108", isinstance(modeled, int) and not isinstance(modeled, bool) and modeled < SOCKET_LIMIT
          and get(pre, "socket_model", "limit") == SOCKET_LIMIT and isinstance(get(pre, "socket_model", "uid"), int))
    stage = CAP / "stage"
    exact = {"limits.txt": "core 0 0\nfsize 67108864 67108864\n", "snapshot-status.txt": "ps-pre 0\nps-post 0\n", "argv.txt": GUARD_ARGV, "pre-attempts": ""}
    for name, text in exact.items():
        check("stage_" + name + "_exact", read_text(stage / name) == text)
    check("stage_env_keys_exact", read_text(stage / "env-keys.txt") in ENV_KEYS)
    for name in ("started-utc", "ended-utc", "monotonic-start.txt", "monotonic-end.txt", "ps-pre.txt", "ps-post.txt", "post-attempts", "stdout", "stderr"):
        check("stage_present_" + name, read_text(stage / name) is not MISSING)
    check("no_prelaunch_failure_record", not os.path.lexists(stage / "prelaunch-failed"))
    exit_text = read_text(stage / "exit")
    stage_exit = int(exit_text) if isinstance(exit_text, str) and re.fullmatch(r"[0-9]+\n", exit_text) else None
    report["stage_exit"] = stage_exit
    check("stage_exit_is_a_recorded_integer", stage_exit is not None)
    runtimes = sorted(CAP.glob("tmp/the-desk-p33-*"))
    attempts = sorted(CAP.glob("tmp/the-desk-p33-*/attempt-*"))
    check("exactly_one_runtime_directory", len(runtimes) == 1)
    check("exactly_one_guard_attempt", len(attempts) == 1)
    reaped = []
    if len(attempts) == 1:
        attempt = attempts[0]
        check("post_attempts_names_the_attempt", read_text(stage / "post-attempts") == attempt.name + "\n")
        prereq = load_json(attempt / "prerequisite.json")
        check("prerequisite_subreaper_pidfd_proc", get(prereq, "subreaper") is True and get(prereq, "pidfdSignal0") is True and get(prereq, "proc") is True)
        check("prerequisite_interpreter_identity", isinstance(get(prereq, "python"), str) and isinstance(get(prereq, "kernel"), str)
              and get(prereq, "executable") == get(pre, "tools", "python", "executable") and get(prereq, "executable") is not MISSING)
        guard = load_json(attempt / "guard-result.json")
        check("guard_fatal_present_null", get(guard, "fatal") is None)
        check("guard_contained_rejection_present_null", get(guard, "containedRejection") is None)
        for key in ("settled", "directReaped", "noChildren", "complete"):
            check("guard_" + key + "_true", get(guard, key) is True)
        for key in ("errors", "residual", "cleanupErrors"):
            check("guard_" + key + "_present_empty", get(guard, key) == [])
        listed = get(guard, "reaped")
        reaped = listed if isinstance(listed, list) else []
        allowed = (0,) if stage_exit == 0 else (0, 1)
        check("guard_reaped_nonempty_exits_consistent_with_the_stage_exit", stage_exit in (0, 1) and isinstance(listed, list) and len(listed) >= 1 and all(
            isinstance(r, dict) and isinstance(r.get("pid"), int) and not isinstance(r.get("pid"), bool) and r.get("exit") in allowed for r in listed)
            and (stage_exit == 0 or any(r.get("exit") == 1 for r in listed)))
        check("no_p33_case_folder_invented", not [p for p in attempt.iterdir() if p.is_dir()])
    ps_post = read_text(stage / "ps-post.txt")
    post_pids = set()
    if ps_post is not MISSING:
        for line in ps_post.splitlines():
            parts = line.split()
            if parts and parts[0].isdigit():
                post_pids.add(int(parts[0]))
    check("recorded_reaped_pids_absent_after", ps_post is not MISSING and all(r.get("pid") not in post_pids for r in reaped if isinstance(r, dict)))
    out = read_text(stage / "stdout")
    err = read_text(stage / "stderr")
    check("stdout_and_stderr_readable", out is not MISSING and err is not MISSING)
    cases, outcome = [], "not_established"
    if out is not MISSING and err is not MISSING:
        so, se = parse_stdout(out), parse_stderr(err)
        missing, duplicated = [], []
        for index, name in EXACT_CASES:
            records = so["seen"].get(norm(name), [])
            if len(records) == 1:
                cases.append({"file": GATE_FILES[index], "name": name, "status": records[0]})
            elif records:
                duplicated.append(name)
            else:
                missing.append(name)
        per_file = [sum(1 for c in cases if c["file"] == rel) for rel in GATE_FILES]
        counts = {s: sum(1 for c in cases if c["status"] == s) for s in ("pass", "fail", "skip", "todo")}
        failed_names = [c["name"] for c in cases if c["status"] == "fail"]
        status_of = {norm(c["name"]): c["status"] for c in cases}
        failed_files = {c["file"] for c in cases if c["status"] == "fail"}
        referenced_failed, suite_refs, ref_unknown, ref_misplaced, ref_nonfailed = set(), [], [], [], []
        for g in se["groups"]:
            for ref in g["refs"]:
                if ref in EXACT_NAMES:
                    if g["section"] != "tests":
                        ref_misplaced.append(ref)
                    if status_of.get(ref) == "fail":
                        referenced_failed.add(ref)
                    else:
                        ref_nonfailed.append(ref)
                elif ref in SUITE_REFS:
                    if g["section"] != "suites":
                        ref_misplaced.append(ref)
                    suite_refs.append(ref)
                else:
                    ref_unknown.append(ref)
        suite_files = {ref.split(" > ")[0] for ref in suite_refs}
        numerators = [g["numerator"] for g in se["groups"]]
        denominators = sorted({g["denominator"] for g in se["groups"]})
        raw_refs = sum(len(g["refs"]) for g in se["groups"])
        tests_banners = [b["count"] for b in se["banners"] if b["kind"] == "tests"]
        suites_banners = [b["count"] for b in se["banners"] if b["kind"] == "suites"]
        report.update(cases=cases, case_counts=counts, per_file=per_file, failed_cases=failed_names, unclassified=so["unclassified"][:20], unclassified_count=len(so["unclassified"]),
                      missing_cases=missing[:20], duplicated_cases=duplicated[:20], test_files=so["test_files"], tests=so["tests"], stdout_arrow_lines=so["arrow_lines"],
                      stderr_banners=se["banners"], stderr_problems=se["problems"], stderr_stray=se["stray"], stderr_stray_count=se["stray_count"], unhandled_section=se["unhandled"],
                      failure_groups=[{"section": g["section"], "start_line": g["start"], "end_line": g["end"], "refs": g["refs"], "diagnostic_body_lines": g["body"], "frame_lines": g["frames"],
                                       "numerator": g["numerator"], "denominator": g["denominator"], "raw_bytes": len(g["text"].encode("utf-8", "replace")),
                                       "raw_sha256": sha256_bytes(g["text"].encode("utf-8", "replace"))} for g in se["groups"]],
                      failure_group_slices=[{"start_line": g["start"], "end_line": g["end"], "text": g["text"]} for g in se["groups"]],
                      divider_denominators=denominators, raw_fail_references=raw_refs, suite_references=sorted(set(suite_refs)),
                      stderr_bytes=len(err.encode()), stdout_bytes=len(out.encode()),
                      database_url_literal_occurrences={"stdout": out.count(DB_URL_LITERAL), "stderr": err.count(DB_URL_LITERAL)})
        check("exact_107_name_bijection_with_exactly_one_pinned_result_record_each", not missing and not duplicated and so["unclassified"] == [] and len(cases) == CASE_TOTAL
              and sorted(so["seen"]) == sorted(norm(name) for _, name in EXACT_CASES))
        check("case_counts_per_file_30_16_61", tuple(per_file) == CASE_COUNTS)
        check("no_unclassified_result_lines", so["unclassified"] == [])
        check("no_skipped_or_todo_cases", counts["skip"] == 0 and counts["todo"] == 0)
        files, tests = so["test_files"], so["tests"]
        check("tests_summary_total_107_reconciles_with_the_case_records", isinstance(tests, dict) and tests.get("total") == CASE_TOTAL
              and tests.get("passed", 0) == counts["pass"] and tests.get("failed", 0) == counts["fail"]
              and tests.get("skipped", 0) == 0 and tests.get("todo", 0) == 0 and tests.get("expected fail", 0) == 0
              and tests.get("passed", 0) + tests.get("failed", 0) == CASE_TOTAL)
        failing_files = failed_files | suite_files
        check("test_files_summary_total_3_reconciles_with_case_and_suite_failures", isinstance(files, dict) and files.get("total") == 3
              and files.get("failed", 0) == len(failing_files) and files.get("passed", 0) == 3 - len(failing_files)
              and files.get("skipped", 0) == 0 and files.get("todo", 0) == 0 and files.get("expected fail", 0) == 0)
        check("failure_group_structure_established", se["problems"] == [] and se["stray_count"] == 0 and all(g["body"] >= 1 for g in se["groups"]))
        check("failure_group_sequence_one_per_emitted_group", numerators == list(range(1, len(se["groups"]) + 1)))
        check("one_divider_denominator_equal_to_the_raw_fail_references", len(denominators) <= 1 and (not se["groups"] or denominators == [raw_refs]))
        check("failure_references_are_exact_known_identities_in_the_right_section", not ref_unknown and not ref_misplaced and not ref_nonfailed)
        check("every_failed_case_is_referenced_by_an_error_group", {norm(n) for n in failed_names} <= referenced_failed)
        check("failed_tests_banner_matches_the_failed_case_count", tests_banners == ([len(failed_names)] if failed_names else []))
        check("failed_suites_banner_matches_the_distinct_suite_references", suites_banners == ([len(set(suite_refs))] if suite_refs else []))
        check("failure_sections_present_exactly_when_something_failed", bool(se["banners"] or se["groups"]) == bool(failed_names or suite_refs))
        check("no_unhandled_errors_section_the_schema_cannot_establish", not se["unhandled"])
        if stage_exit is None:
            outcome = "exit_unreadable"
        elif stage_exit not in (0, 1):
            outcome = "abnormal_exit_%d" % stage_exit
        elif se["unhandled"]:
            outcome = "unhandled_errors_present"
        elif len(cases) != CASE_TOTAL:
            outcome = "not_established"
        else:
            parts = (["suite_errors:%d" % len(set(suite_refs))] if suite_refs else []) + (["case_failures:%d" % len(failed_names)] if failed_names else [])
            if not parts and counts["pass"] == CASE_TOTAL and stage_exit == 0:
                outcome = "all_passed"
            elif parts and stage_exit == 1:
                outcome = "+".join(parts)
            else:
                outcome = "not_established"
        check("exit_status_consistent_with_the_outcome", (outcome == "all_passed" and stage_exit == 0)
              or (outcome.startswith(("suite_errors:", "case_failures:")) and stage_exit == 1))
    report["test_outcome"] = outcome


def cmd_validate():
    """Writes the diagnostic verdict/check list BEFORE collection. Runs whenever the owned capture root was initialized, whatever failed earlier. The
    verdict separates evidence completeness (this command's exit status) from the test outcome (the workflow's final gate judges the real test step)."""
    need(owned(), "validate_without_an_owned_capture_root")
    need(not os.path.lexists(CAP / "verdict.json"), "verdict_already_exists")
    checks, failures, report = [], [], {}

    def check(label, ok):
        passed = ok is True
        checks.append({"check": label, "ok": passed})
        if not passed:
            failures.append(label)

    try:
        evaluate(check, report)
    except Exception as error:
        failures.append("validate_exception:" + type(error).__name__)
    slices = report.pop("failure_group_slices", None)
    if slices:
        try:
            write_new(CAP / "failure-groups.json", {"note": "complete raw slices (original stderr lines) of every emitted error group, by 1-based stderr line range", "groups": slices})
        except Exception as error:
            failures.append("failure_groups_record_not_written:" + type(error).__name__)
    outcome = report.get("test_outcome", "not_established")
    if failures:
        verdict = VERDICT_INCOMPLETE
    elif outcome == "all_passed":
        verdict = VERDICT_ALL_PASS
    else:
        verdict = VERDICT_FAILURES
    document = {"verdict": verdict, "evidence_complete": not failures, "test_outcome": outcome, "job_expected_conclusion": "success" if verdict == VERDICT_ALL_PASS else "failure",
                "failures": failures, "checks": checks, **report,
                "note": "Three selected files / 107 cases only: never a full-CI, 74-file or 8,443-test result. Evidence completeness is this verdict; the test outcome is the "
                        "real child status; the workflow gate keeps the job red for any failing case. Upload success is judged by the workflow gate."}
    write_new(CAP / "verdict.json", document)
    print(json.dumps({k: document[k] for k in ("verdict", "evidence_complete", "test_outcome", "failures")}, sort_keys=True))
    return 0 if not failures else 1


def publish_upload_ready():
    """Appends the fixed line `upload_ready=true` to the runner-provided GITHUB_OUTPUT file (which already exists; never created here). Any failure is a HOLD."""
    path = os.environ.get("GITHUB_OUTPUT", "")
    need(path != "", "github_output_channel_missing")
    try:
        fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_NOFOLLOW)
        with os.fdopen(fd, "ab") as stream:
            stream.write(b"upload_ready=true\n")
            stream.flush()
            os.fsync(stream.fileno())
    except OSError:
        raise Hold("upload_ready_output_not_published")


def cmd_collect():
    """Builds the upload snapshot from verified regular-file copies of the owned capture root (verdict and exact raw inputs included) with explicit
    finite ceilings. Type, size and budget are checked BEFORE a bounded read. The guard's unix socket is recorded as a non-content omission and is
    never copied; any other link/special member, any limit overrun and any omission is a recorded HOLD. A partial snapshot is retained, not hidden.
    Ownership is verified first and the fresh UPLOAD directory is created exclusively; only then is `upload_ready=true` published, so the upload step
    can never transmit a directory this process did not create. Failure after that point keeps the partial snapshot uploadable but collect fails."""
    need(owned(), "collect_without_an_owned_capture_root")
    os.mkdir(UPLOAD, 0o700)
    UPLOAD_STATE["created"] = True
    publish_upload_ready()
    holds, sockets, copied = [], [], []
    state = {"entries": 0, "total": 0, "stopped": False}

    def copy_file(rel, path, st):
        if st.st_size > COLLECT_FILE:
            holds.append("file_over_64MiB:%s:%d" % (rel, st.st_size))
            return
        if state["total"] + st.st_size > COLLECT_TOTAL:
            holds.append("aggregate_over_512MiB_budget_before:" + rel)
            return
        data = read_bounded(path)
        if data is MISSING or len(data) != st.st_size:
            holds.append("read_failed_or_size_changed:" + rel)
            return
        target = UPLOAD / rel
        write_bytes_new(target, data)
        back = read_bounded(target)
        digest = sha256_bytes(data)
        if back is MISSING or sha256_bytes(back) != digest or len(back) != len(data):
            holds.append("copy_hash_mismatch:" + rel)
            return
        state["total"] += len(data)
        copied.append((rel, len(data), digest))

    def visit(directory, rel_dir, depth):
        if depth > COLLECT_DEPTH:
            holds.append("depth_over_24:" + rel_dir)
            return
        with os.scandir(directory) as scan:
            ordered = sorted(scan, key=lambda e: e.name.encode())
        for entry in ordered:
            state["entries"] += 1
            if state["entries"] > COLLECT_ENTRIES:
                holds.append("entries_over_4096")
                state["stopped"] = True
                return
            rel = rel_dir + entry.name
            st = entry.stat(follow_symlinks=False)
            if stat.S_ISDIR(st.st_mode):
                os.mkdir(UPLOAD / rel, 0o700)
                visit(entry.path, rel + "/", depth + 1)
                if state["stopped"]:
                    return
            elif stat.S_ISREG(st.st_mode):
                copy_file(rel, entry.path, st)
            elif stat.S_ISSOCK(st.st_mode) and SOCKET_RE.fullmatch(rel):
                sockets.append(rel)
            else:
                holds.append("link_or_special_not_copied:%s:%o" % (rel, stat.S_IFMT(st.st_mode)))

    visit(str(CAP), "", 1)
    verdict = load_json(CAP / "verdict.json")
    if get(verdict, "verdict") is MISSING:
        holds.append("verdict_missing_or_unreadable")
    manifest = "".join("%s  %s\n" % (digest, rel) for rel, size, digest in sorted(copied, key=lambda r: r[0].encode()))
    status = {"status": "complete" if not holds else "partial_hold", "holds": holds, "copied_files": len(copied), "copied_bytes": state["total"],
              "entries_seen": state["entries"], "omitted_guard_sockets": sockets, "verdict": get(verdict, "verdict") if get(verdict, "verdict") is not MISSING else None,
              "limits": {"entries": COLLECT_ENTRIES, "depth": COLLECT_DEPTH, "file_bytes": COLLECT_FILE, "total_bytes": COLLECT_TOTAL},
              "sizes": {rel: size for rel, size, digest in copied},
              "note": "Cancellation, the job deadline or a lost runner can leave this evidence incomplete; that is HOLD, never a pass."}
    status_bytes = (json.dumps(status, sort_keys=True, indent=2) + "\n").encode()
    for root in (BASE, UPLOAD):
        write_bytes_new(root / "MANIFEST.sha256", manifest.encode())
        write_bytes_new(root / "collect-status.json", status_bytes)
    print("collect", status["status"], len(copied), "copied", len(sockets), "socket omitted", len(holds), "holds")
    print("manifest sha256", sha256_bytes(manifest.encode()), "status sha256", sha256_bytes(status_bytes))
    return 0 if not holds else 1


def main():
    commands = {"pre": cmd_pre, "dbprobe": cmd_dbprobe, "bind-build": cmd_bind_build, "precheck": cmd_precheck, "post": cmd_post, "validate": cmd_validate,
                "collect": cmd_collect}
    if len(sys.argv) != 2 or sys.argv[1] not in commands:
        print("usage: gate_bind.py pre|dbprobe|bind-build|precheck|post|validate|collect", file=sys.stderr)
        return 64
    phase = sys.argv[1]
    try:
        return commands[phase]()
    except Hold as error:
        write_failure(phase, "hold", str(error))
        print("HOLD:", error, file=sys.stderr)
        return 3
    except Exception as error:
        write_failure(phase, "exception", type(error).__name__ + ":" + str(error)[:200])
        print("EXCEPTION:", type(error).__name__, file=sys.stderr)
        return 70


if __name__ == "__main__":
    raise SystemExit(main())
