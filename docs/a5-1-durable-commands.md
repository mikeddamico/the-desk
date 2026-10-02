# A5.1 durable command helpers and one bounded workflow slice

Scope: `src/runtime/` (command transactions, evidence-unit persistence, claim-event append, evidence-package persistence and
binding, `runEvidenceSlice`). **Not** the minimal durable workflow/command runner (no scheduler, step registry or generic
checkpoint store), and **not** Completion A. No migration, privilege, dependency, Lock or fixture change. Provider
reservation/outcome commands (A5.2) are held for separate review.

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
- Packages: the hash is not validation. Evidence entries are checked against the persisted unit and rights rows, claim entries against
  the persisted claim rows, and the slice requires the package's evidence set to equal its units. A preexisting artifact without its typed
  row (another writer) is completed only when its manifest equals the request's; otherwise `artifact_differs_for_hash`.
- Cross-config package sharing is a persistence characterization only; it establishes no editorial eligibility.

## Outstanding (not claimed)

Minimal workflow runner and Completion A; run/attempt creation identity and lifecycle transition retry; take selection and gate-result
retry identity; READY/operator authorization; package construction; the durable provenance snapshot; provider reservation/outcome and
reconciliation (A5.2); production retry/timeout values; cross-config eligibility.
