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

This repair rewrites **unmerged, disposable-only** `001_foundation.sql` by explicit authorization. An old disposable database must be recreated; the new runner will not accept its old checksum or silently adapt its schema. No `002` repair migration is shipped. After the baseline is frozen/applied permanently, never edit applied bytes: use a reviewed forward migration or restore.

Before a destructive staging migration, take a provider snapshot, restore into a new isolated database, run `db:verify` and integrity tests, and record the outcome. No production operation is authorized here.

`db:reset` continues to reject production and requires the explicit destructive confirmation, then directs the operator to owner-level disposable database recreation and bootstrap. It no longer attempts to drop `public` with a migrator that intentionally does not own it. Do not expand migrator/runtime ownership to make that shortcut work.

## Semantic timestamps

Validate real calendar dates, hours 00–23, and explicit UTC `Z`. Preserve valid RFC 3339 fractional digits exactly as supplied. The active lock does not define fractional precision or trailing-zero normalization. Per repair-task adjudication, no trim/pad rule is introduced. Fractional canonicalization requires later spec adjudication before semantically equivalent fractional representations become hash-identical.
