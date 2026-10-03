# A5.1 durable command helpers and one bounded workflow slice

Scope: `src/runtime/` (command transactions, evidence-unit persistence, claim-event append, evidence-package persistence and
binding, `runEvidenceSlice`). It is a bounded slice over three convergent commands; Completion A as a whole is NOT complete. No
migration, privilege, dependency, Lock or fixture change. Provider reservation/outcome commands (A5.2) are held for separate review.

## Which identities are authored and which are database-generated

| Record                 | Identity                                                     | Source                                                                                                            |
| ---------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Evidence unit          | `evidence_unit_id`                                           | authored UUID (never the body hash)                                                                               |
| Rights version         | `rights_version_id`                                          | authored UUID; must agree with the unit's `rights_version_id`                                                     |
| Claim-state event      | `claim_state_event_id` + explicit `event_sequence`           | authored UUID and sequence; all seven immutable columns compared in SQL                                           |
| Evidence package       | governed package hash (`evidencePackageHash`, manifest only) | derived; `artifact_id` / `evidence_package_id` are authored but unused when an existing package is reused by hash |
| Attempt binding        | `(attempt_id, evidence_package_id)`                          | immutable once assigned (`bind_evidence_package`)                                                                 |
| Run / attempt creation | database-generated                                           | **outside this tranche** (a named limitation)                                                                     |

## Contracts

- Timestamps: RFC 3339, `Z` or numeric offset, 0-6 fractional digits (a 7th is rejected: PostgreSQL rounds it). The authored string is
  inserted and compared in SQL; A3's millisecond `Date` normalization is used only for payload validation.
- A command returning `conflict` or `rejected` rolls back; nothing it did (including an incidental rights row) is committed.
- After a unique violation the command rolls back to its savepoint before re-reading; only named constraints are treated as races,
  other database errors are rethrown.
- Claim events: a head read does not reserve a sequence; stale explicit sequences are rejected. After an ambiguous acknowledgement the
  caller resends the identical request or calls `lookupClaimEvent`; it never assigns the UUID another sequence.
- Evidence provenance/locator snapshot: no durable column exists. `snapshot.status` is `verified` only against an explicitly identified
  persisted package (by package hash); otherwise `not_supplied` or `unverifiable`. Row convergence is reported separately
  (`comparison: "row_only" | "row_and_snapshot_verified"`). Full Evidence Package 24.1 completion therefore remains outstanding.
- Packages: the hash is not validation. A package is validated against the active profile (`package-profile.ts`: the governed
  `evidence-package/2.0` payload/manifest labels, the evidence_package row's inherited `fixture-v0.4.5` label, required fields and types,
  closed key sets, in-manifest references; unknown labels are rejected, missing or malformed arrays are never defaulted) and reconciled
  with the persisted rows: evidence entries against unit and rights rows; claim entries against the claim rows (identity, kind/origin/
  domain/predicate/value, `subject_ref` against the bounded fixture representation `subject = {entity_ref}`, initial fields, explicit
  cursor/prefix and frozen state/hash through the accepted A3 `verifyFrozenEntry`); each SELECTED support ref against its own persisted `claim_supports` row for that claim
  (id, kind, role, targets, hash) and its exact target hash (Claims 4.3: evidence `content_hash`, derivation `output_hash`, carrier
  `artifacts.content_hash`). Evidence 9 freezes the selected refs; no clause requires them to equal every support row the claim has
  now, so later lawful support rows neither invalidate nor are demanded of a frozen package, and no support-sufficiency policy is inferred. The A3 verifier cannot reproduce the frozen-time usage ceiling; that limit is returned in
  `verification.limits`. The same validation runs on reuse by hash, on completion of an untyped artifact another writer stored, on every
  binding path (first, same-package retry, race winner) and when a stored package is read for snapshot verification or slice status.
- Occupied authored ids and READ COMMITTED: `persistEvidencePackage` judges an authored artifact/package id "occupied by a different
  record" only after ONE full re-read of the semantic (hash) lookups. An identical governed winner committed across a read boundary
  (before the occupied-artifact read, before the occupied-package read, or completing the same orphan artifact) therefore converges;
  an unrelated occupant (no package with this hash) is still a conflict. The re-read is taken at most once (bounded). Proved
  deterministically on PostgreSQL 17 (`a5-1-package-interleaving.test.ts`).
- One normalized JSON representation (every own key preserved, including `__proto__`) is hashed, compared and stored.
- Cross-config package sharing is a persistence characterization only; it establishes no editorial eligibility.

## Outstanding (not claimed)

Handoff v0.5.5 Done-when items still to be demonstrated: 10 (a database/workflow concurrency guard preventing duplicate paid work:
provider reservation/outcome commands, A5.2, held); item 9 is offered by this slice for review, not self-accepted. Build 2 path steps not
implemented here: persisting a program attempt (run/attempt creation identity), lifecycle transitions and `transition_attempt` retry,
evaluation path through VALIDATED, provider-call identity, takes and reroll, READY/operator authorization. Also outstanding: take
selection and gate-result retry identity, package construction (selection/scoring), the durable provenance/locator snapshot (no column; verified
only against an explicitly identified persisted package, so full Evidence 24.1 completion remains outstanding), lease/takeover,
production retry values, and cross-config editorial eligibility.
