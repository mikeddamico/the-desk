# Foundation operations

## Environment and deployment

`DESK_ENV` is mandatory. Development/test providers are disabled and generation is killed by default. Staging uses isolated credentials, `DESK_ENV=staging`, and the same immutable image CI verifies. Staging/production require a full lowercase 40-character Git commit in `DEPLOYED_COMMIT`; `unknown`, `local`, and abbreviated identities fail configuration validation. Production is not deployed by this tranche.

Normal startup/health needs `DATABASE_URL` only. `MIGRATION_DATABASE_URL` belongs to migration tooling and must not be injected into the runtime container. Migration configuration additionally validates that the two URLs differ. Node 24.21.0 and npm 11.19.0 are pinned; use `nvm use`, then `npm install --global npm@11.19.0 --ignore-scripts` if needed before `npm ci --ignore-scripts`.

A later staging completion record must capture image digest, commit SHA, migration checksums, health output, and a synthetic exception correlation ID observed in hosted error tracking. This repair does not satisfy those remaining Build-1 gates.

## Bootstrap and effective roles

Use a fresh, isolated PostgreSQL 17 database. As database owner, execute `migrations/roles.sql` before migrations. The database owner retains ownership of `public`; `desk_migrator` receives schema USAGE/CREATE and owns the objects it creates. `desk_internal` holds the migration ledger and is inaccessible to runtime.

The capability roles are NOLOGIN. Provision separate LOGIN wrapper roles/credentials through the platform, without SUPERUSER, CREATEDB, CREATEROLE, REPLICATION, or BYPASSRLS, and grant only the intended capability:

```sql
-- Bootstrap owner, with wrapper identities provisioned out of band:
GRANT desk_migrator TO your_migration_login;
GRANT desk_runtime TO your_application_login;
GRANT desk_operator TO your_privileged_operator_login;
```

Do not grant the migrator capability to runtime/operator logins. Application and migration pools set the effective role through the connection's `options` setting. SQL tooling must explicitly `SET ROLE desk_migrator` before applying migrations. Inherited membership alone does not select the creator identity for default privileges. `npm run db:migrate` rejects any effective role other than `desk_migrator`.

Migrator-created application tables receive SELECT/INSERT for runtime by default. Migrations must explicitly revoke INSERT for new privileged/internal objects, as Foundation does for Episodes, Episode versions, review decisions, and repair-plan decisions. Functions have no default PUBLIC EXECUTE. Only the three lifecycle/package entry points are granted to runtime. There is no runtime UPDATE, DELETE, TRUNCATE, schema CREATE/ownership, ledger access, trigger-disable privilege, or migrator membership.

`desk_operator` inherits ordinary runtime capabilities and additionally inserts review/repair-plan decisions. Those inserts require a human actor identity. The application must authenticate/authorize the operator before using this credential; an actor UUID alone is not authorization. These credentials are not required by the runtime health process.

The integration suite bootstraps with the owner, then reconnects as three disposable non-superuser LOGIN wrappers and proves both `session_user` and `current_user`. Owner is not used for application writes or migrations.

## Lifecycle and immutable history

Create runs/attempts at `PENDING`. Bind a frozen Evidence Package at insertion, or once through `bind_evidence_package(attempt, package)` before PACKAGED. Advance through `transition_attempt(attempt, expected, next)`; it rejects stale, skipped, reversed, and forbidden transitions. READY additionally takes the exact fingerprint and master artifact ID and atomically mints/reuses the Episode and inserts an Episode version. `transition_run(run, expected, next)` advances the optional run projection only when an attempt is at that state. Repair children traverse the same graph; they never move the parent backward.

Episode version `status=READY` records immutable candidate creation status. The attempt holds current lifecycle state; review decisions are separate immutable records. No publication/version-state machinery is introduced here.

Append-only tables reject UPDATE/DELETE and statement-level TRUNCATE, including empty-table TRUNCATE and cascades. Object owners can deliberately change DDL; runtime cannot. These protections do not purport to constrain a malicious database owner or superuser.

## Provider-call reservation and recovery

Insert and commit `provider_calls` before any paid side effect. Only the worker that successfully reserves `(logical_request_key, operational_try_number)` may issue that operational try. A duplicate worker reads existing history. TTS logical keys are exactly `base_request_hash:take_index`; retries retain that identity and require a prior retryable outcome. A changed editorial request gets a changed base hash. Mechanical rerolls allocate a new take index from a named, versioned `reroll_triggers` record. Subjective new takes require a confirmed operator-repair trigger and execute in its child attempt.

The immutable call row is the started/reserved record; `provider_call_events` appends one terminal outcome for that operational try. An unfinished reservation remains durable after a crash. Recovery must reconcile an ambiguous provider result before recording retryable failure/retrying. No real provider adapter or automatic recovery worker is implemented here. Provider-side exactly-once behavior cannot be promised for an ambiguous timeout without provider idempotency support (Performance & Render §26).

Send exact cost as a decimal string to PostgreSQL `numeric`; never convert it through a JavaScript number. JSON usage preserves decimal strings. Sum outcome `actual_cost` grouped by currency to derive spend; no domain table owns a separate spend total.

## Migration integrity and recovery

Migration identity hashes exact file bytes. `.gitattributes` pins SQL to LF. Fatal UTF-8 decoding prevents silently executing a replacement-character version of invalid bytes. A transaction-scoped PostgreSQL advisory lock serializes ledger creation, verification and application on one connection. Unknown applied migrations or changed checksums fail, including fabricated future entries.

This repair rewrites **unmerged, disposable-only** `001_foundation.sql` by explicit authorization. An old disposable database must be recreated; the new runner will not accept its old checksum or silently adapt its schema. No repair migration rewrites 001; `002_persistence_profile.sql` is a normal forward migration (below). After the baseline is frozen/applied permanently, never edit applied bytes: use a reviewed forward migration or restore.

Before a destructive staging migration, take a provider snapshot, restore into a new isolated database, run `db:verify` and integrity tests, and record the outcome. No production operation is authorized here.

`db:reset` continues to reject production and requires the explicit destructive confirmation, then directs the operator to owner-level disposable database recreation and bootstrap. It no longer attempts to drop `public` with a migrator that intentionally does not own it. Do not expand migrator/runtime ownership to make that shortcut work.

## Migration 002 (persistence profile)

`002_persistence_profile.sql` applies the approved Foundation 001+002 profile to exactly eight tables: `claims`, `claim_state_events`, `evidence_units`, `claim_supports`, `derivation_runs`, `pronunciations`, `pronunciation_renderings`, `prompt_manifests` (Hashing v0.1.4 section 13). It adds no table, default or backfill and expands no privilege.

- **Empty-database only.** After the runner's advisory lock, 002 locks the twelve protected tables `ACCESS EXCLUSIVE` in a fixed order (`claim_state_events, claim_supports, claims, derivation_runs, evidence_packages, evidence_units, prompt_manifests, pronunciation_renderings, pronunciations, render_manifests, turn_claim_uses, turn_evidence_uses`) and only then checks that all are empty. A populated protected table, an unexpected schema (for example a missing legacy constraint) or a non-UTF8 database fails the whole transaction: no partial DDL and no ledger row. Accounts, shows, show configuration, artifacts, rights and voice records may already exist. Populated history needs a separately reviewed data-aware migration; never work around the check, disable triggers or delete history.
- **Runner behavior.** On an empty 001 database the runner applies 002 alone; on a fresh database it applies 001 and 002 in one transaction. Expect the longer exclusive locks only during that migration; stop application writers first.
- **Claim-event append order.** `claim_state_events.event_sequence` is the claim-local reducer order. A `BEFORE INSERT` guard first requires `READ COMMITTED`: any other isolation level (REPEATABLE READ, SERIALIZABLE, and READ UNCOMMITTED, which reports `read uncommitted`) is rejected before any lock or read with SQLSTATE `0A000` (unsupported operation); retrying at that isolation level can never succeed, so append in a new READ COMMITTED transaction. The guard then takes a per-claim transaction advisory lock (held to commit) and, with a fresh per-query snapshot (the function is `VOLATILE`), requires the first sequence to be 1 and every later one to exceed the accepted maximum; gaps above the maximum are allowed, earlier or unused-gap sequences are rejected (`23514`). Why not support higher isolation: there one snapshot is fixed before the lock is granted, and no property of the snapshot or of the transaction id proves that a competitor has not committed since (a transaction can obtain its id before the competitor writes), so lock-then-`MAX` can persist a sequence below a committed maximum. An earlier proof based on transaction ids was found insufficient and removed. Retrying an event must reuse its authored event UUID; the table never treats timestamp/type as an idempotency key.
- **Out of scope here.** Claim-support kind/target agreement, provider/model compatibility of pronunciation renderings, the fixture loader, hashing expansion, reducer, workflow runner and Completion A/B remain later work.

## Semantic timestamps

Validate real calendar dates, hours 00–23, and explicit UTC `Z`. Preserve valid RFC 3339 fractional digits exactly as supplied. The active lock does not define fractional precision or trailing-zero normalization. Per repair-task adjudication, no trim/pad rule is introduced. Fractional canonicalization requires later spec adjudication before semantically equivalent fractional representations become hash-identical.

## Frozen Fixture v0.4.6 load (A2, development/test only)

`npm run db:load-fixture` loads the 398 foundation rows of the pinned v0.4.6 pack through the migration pool (role
`desk_migrator`). It refuses unless `DESK_ENV` is `development` or `test`; it is not part of any deployment or image.

- The pack is verified before any write: pinned ZIP and PACK_MEMBERS hashes, exact member set, safe names, bounded reads,
  per-member hashes. Archival members are hashed only, never parsed or inserted.
- The target must be empty. One transaction takes the migration advisory lock, checks the migration ledger on the same
  connection, locks all 46 tables (`SHARE ROW EXCLUSIVE`, alphabetical), checks emptiness, inserts in a row-level
  foreign-key order, reads back every persisted column and re-runs the A1 hash/binding checks over the persisted rows.
  Any failure rolls everything back; a repeated load fails with `FixtureTargetNotEmptyError` and changes nothing.
- jsonb is compared semantically (canonical JSON), not byte-for-byte. The historical direction artifact keeps its null
  disposition.
- Not covered here: claim reduction, prefix freezing, durable retry (A5), READY authorization, cached-take acceptance,
  audio bytes (never written to the database). A concurrent runtime writer can deadlock with the loader's table locks, in
  which case the loader aborts atomically.

## Claim state freeze (A3, read-only)

`freezeClaims(db, claimIds, ceilings)` (`src/knowledge/claim-log.ts`) reads the requested claims and their events in a
single statement and returns manifest-shaped frozen entries (`state_event_cursor` is `null` or
`{claim_state_event_id, event_sequence}`). It works at any isolation level, takes no lock, writes nothing and never blocks an
appender; appends keep requiring `READ COMMITTED` and the Migration 002 per-claim lock. A freeze is a consistent
sequence-prefix because commit order equals sequence order per claim. `ceilings` (frozen-time external usage ceilings) is
required for every claim: nothing is inferred. Verify a stored entry later with `verifyFrozenEntry` and a separately supplied
current ceiling; the result lists what was verified and what could not be (historical visibility, unavailable frozen ceiling).
Sequence allocation, event identity and retry convergence (A5) are not implemented: a retried event is rejected by the
database, not converged.
