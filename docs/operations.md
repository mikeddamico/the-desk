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

## Post-commit fixture verification (A4)

`verifyPersistedFixture(runtimePool)` (`src/fixture/persist.ts`) re-reads and verifies the loaded Fixture v0.4.6 from a fresh
session: one pinned `desk_runtime` connection, `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, 40 family reads plus the SQL
binding checks on that one snapshot, then COMMIT (ROLLBACK and release on any failure). It takes no write-blocking lock and never
delays a writer. Never run the transaction commands or the reads through unpinned `pool.query` calls. Immutable relations reject
UPDATE/DELETE/TRUNCATE for the runtime role with SQLSTATE `42501` (no privilege) and, for a privileged role, with `55000` from the
immutable-row trigger; TRUNCATE of an FK-referenced table needs its referencing tables in the same statement before the trigger is
reached. No privilege or migration changes.

The caller-owned entry point (`verifyPersistedFixtureOnSnapshot`) requires the effective role, REPEATABLE READ (or SERIALIZABLE) READ ONLY,
and a genuinely open transaction block (checked with a savepoint probe, `verifier_not_in_transaction` otherwise); it never begins,
commits or rolls back the caller's transaction.

## Command connection failures (`runCommand`)

`pg-pool` removes its own `error` listener while a client is checked out (pg-pool 3.14.0 `_acquireClient`; the official node-postgres docs describe only idle-client errors and do not specify checked-out behavior), so `runCommand` attaches a scoped listener right after checkout and removes it only after `release`. A connection that reports an error is destroyed (`release(true)`), never reused. A failure before COMMIT, or during the ROLLBACK of a non-committing outcome, rejects with `CommandConnectionError` (`commitOutcome: "not_attempted"`: this command never sent COMMIT); a failure while COMMIT is in flight is `commitOutcome: "unknown"` and the caller must reconcile by authored identity (look up or resend the identical request), never assume either result. The first connection error is the `cause`; later cleanup failures (ROLLBACK/release) are recorded beside it and read with the exported accessor `commandCleanupErrors(error)` (a WeakMap, so a frozen error cannot make recording throw); if the first failure is not an object, the command rejects with an `AggregateError` of that failure plus the cleanup failures. A connection failure after a successful COMMIT keeps the durable outcome. Nothing is replayed automatically and no provider call is made. The first sign of a lost session is recorded together with the phase it struck in, at the earliest observation: pg delivers a terminating backend's FATAL (SQLSTATE `57P01`, `admin_shutdown`) as the rejection of the query that is in flight, before any client `error` event, so every command query is observed and a `57P01` rejection is classified exactly like the event (statement or pre-COMMIT: `before_commit`/`not_attempted`; COMMIT in flight: `commit`/`unknown`; ROLLBACK: `rollback`/`not_attempted`); a caller that swallows the rejection still cannot obtain a success, and `ROLLBACK TO SAVEPOINT`/cleanup are not attempted on a lost session. Only `57P01` is classified: other Class 57 and Class 08 codes (`57P02`, `57P03`, `57P04`, `57P05`, `57014`, `08006`, ...) keep their previous raw handling, which is unaddressed scope rather than a claim that raw handling is safe; widening needs per-code authority and a real-PostgreSQL control. Not covered: the runtime pool itself has no pool-level `error` handler (an idle-client failure is a separate, pre-existing concern).

## Command observability (G3 preparatory tranche; G3 stays OPEN)

`src/runtime/observe.ts` defines a closed, FLAT command event and the single bounded emission path; `commandObserver(logger)` in `src/logging.ts` adapts it to pino. **This is preparation, not closure of Handoff Deliver l.187 / Standards 20:** no process entry, logger configuration or correlation origin exists in the repository (the container entry is `node dist/health.js`), no runner path emits configured logs, and no delivery to any sink is claimed. Completion B (hosted error tracking) is separate.

- **Where events come from:** `runCommand` emits exactly ONE `command.completed` event per command invocation (when a trace/context is supplied), after the result/error and the cleanup are established, i.e. after the COMMIT/ROLLBACK acknowledgment and the release/destroy. A request refused before any transaction emits one `not_committed` rejected event. `runEvidenceSlice`, `executeProviderCall` and `reconcileProviderCall` REQUIRE a declared context (`correlationId` = a canonical UUID, supplied by the caller; an `observer` function) which is validated at runtime and snapshotted once: a missing, malformed or throwing-getter context is refused before any database work. The observer may still be a no-op, so this proves a declared context, not that logs are produced. Each workflow adds one `workflow.completed` event with a fixed workflow-level stage (`evidence_slice`, `provider_execute`, `provider_reconcile`); child command events keep their actual stages.
- **Identifiers:** workflow events and their child events carry `correlation_id`, `attempt_id` and, when it can be derived, `run_id`, read from `program_run_attempts` by one non-transactional lookup per workflow invocation; `run_id_status` says `derived`, `attempt_not_found` or `lookup_failed` (a failed lookup never changes a domain result). Primitives called directly have no attempt in their own input and carry only their own subject ids.
- **Durability (command events only):** `committed` only after an acknowledged COMMIT; `not_committed` after an acknowledged ROLLBACK, a refusal, a loss before COMMIT, or a COMMIT the server definitely rejected (a real `pg.DatabaseError`, severity `ERROR`, SQLSTATE outside class `08` and `57P0x`); `unknown` for a COMMIT whose answer was lost (connection loss, a Node system error such as ECONNRESET/EPIPE, FATAL/PANIC, a missing severity). pg 8.16.3 parses only the localized severity field, so on a server with non-English `lc_messages` a rejection is conservatively `unknown`. This describes durability only; it implies no retry policy, and the classification of lost sessions is unchanged (only `57P01`). Workflow events carry fixed per-stage facts (for the provider workflows `reservation`, `perform`, `outcome_record`) and never a single committed flag, so an ambiguous perform after a committed reservation, an unfinished durable call, and a `finish` that throws after a successful perform are each visible as exactly that.
- **Privacy by construction:** `projectEvent` PICKS keys and validates every VALUE (canonical UUIDs, 64-hex hashes, safe integers, closed enums; provider and operation only from the supported contract; outcome codes only from a closed known set; unknown values are omitted, with a `*_known:false` marker). No messages, SQL, request bodies, payloads, usage, costs, response references or error names are ever logged; errors are reduced to a closed class and counts. The logger adapter re-projects before logging. pino `redact` paths are per-segment and are NOT relied on for nested data; no blanket nested redaction is claimed. A projection failure caused by an adversarial getter or Proxy is contained by the emission path (the event is dropped); `projectEvent` itself is only claimed safe for plain data.
- **Noninterference (bounded):** an observer exception, a Promise rejection returned by an `async` observer, a throwing getter anywhere in the trace/context, or a failing reporter never changes the command result, the thrown error or its cleanup errors; one fixed-text line is written to stderr when an event is dropped. Nothing is claimed about how long an observer runs or whether a sink receives the event.

## Program run and attempt creation (`createProgramRun` / `createProgramAttempt`)

- **Scope:** two convergent commands (`src/runtime/program.ts`) over the existing schema, roles and guards: no migration, no new privilege (the runtime role has INSERT and no UPDATE on either table), no lifecycle advance, driver, policy or CLI. Shows and show-config versions are prerequisites owned by privileged setup or the loader; these commands create neither.
- **Identity and projection:** authored `program_run_id` / `attempt_id`. Compared in SQL (UUID, `timestamptz` equality at microsecond precision, never a JS `Date`): run `show_id`, `purpose`, `created_at`; attempt `program_run_id`, `show_config_version_id`, `created_at`, no parent, no repair plan, publication disabled. `state`, the run's config binding and publication flag, and the attempt's `evidence_package_id` are returned truthfully and never compared, so a retry after binding, packaging or lifecycle movement still converges.
- **Strict API:** the initial command cannot carry state, a package binding, publication enablement or repair lineage; any other key is `unsupported_field`; `parent_attempt_id` / `repair_plan_id` may be absent or null; `publication_enabled` may be absent or exactly `false` (null is refused); all refusals happen before any write. A run is created without a config binding; the first attempt's database guard binds `show_config_version_id` / `publication_enabled` in the same transaction as the attempt insert, and a command that fails afterwards rolls both back.
- **Concurrency:** participating creators of one run are serialized by one transaction-scoped advisory lock (class `182736461`, key `hashtext(program_run_id)`, taken first; the guard's run-row update follows inside the INSERT), so exactly one first attempt binds and a loser gets the typed `run_config_binding_mismatch` conflict. Only the NAMED primary-key races (`program_runs_pkey`, `program_run_attempts_pkey`) and the NAMED foreign keys explained by absent rows are reconciled; every other database error, including every `P0001` (the guard's `RAISE EXCEPTION` carries no constraint name and an unrelated trigger can raise it too), is rethrown unchanged. An out-of-protocol privileged first insert that does not take the lock can make a participating creator lose at the guard: that creator sees the original guard error, and the identical retry then returns the truthful identity or binding outcome from the committed rows.
- **Ambiguous commit:** a lost acknowledgment is `CommandConnectionError{commitOutcome:"unknown"}`; read back with `lookupProgramRun` / `lookupProgramAttempt` or resend the identical request, which converges.
- **Observability:** existing G3 behavior only: command names `program_run.create` / `program_attempt.create`, subject key `program_run_id`, typed codes added to the closed known set. G3 stays OPEN (no process entry or correlation origin exists).

## Program attempt process entry (`npm run program:attempt`, P1; development/test only)

- **What it is:** `src/cli/program-attempt.ts` is a thin local process entry that calls the merged commands in one fixed, code-defined order: `createProgramRun` -> `createProgramAttempt` -> `runEvidenceSlice`. It is NOT the minimal durable runner and decides nothing about the workflow platform: no stage list, no lifecycle advance, no retry or replay, no provider, no cost or timeout policy, no privileged setup (the pool is the runtime role). G3, G5 and Completion A stay OPEN; hosted error-tracking correlation is Completion B.
- **Usage:** `npm run program:attempt -- <input.json> [--correlation-id <uuid>]`. The input is one JSON file: `{"run": AuthoredProgramRun, "attempt": AuthoredProgramAttempt, "slice": {"units": [...], "pkg": {...}}}` (strict envelope; unknown keys refused; the values are validated by the existing commands and authored strings are passed through untouched). `attempt.program_run_id` must equal `run.program_run_id`. Prerequisites (accounts, show, show-config versions, claims, claim supports, and the units a package's supports reference) are owned by privileged setup or the A5.1 commands.
- **Before the pool exists (no database access):** configuration, the existing development/test guard (`assertFixtureLoadAllowed`: `DESK_ENV` development or test only), argument syntax, the correlation id (one fresh UUID per invocation, or a supplied canonical lowercase UUID), the input file and envelope, and the run/attempt identity cross-check. A refusal there exits 1 with one fixed stderr line and contacts no database (proved with a counting listener, not only by unchanged rows).
- **Logging:** the configured pino logger on a SYNCHRONOUS stdout destination (pino's default stdout destination is asynchronous) through the existing `commandObserver`: one JSON line per command and one `workflow.completed` for the slice, all with the same `correlation_id`. No bodies, payloads or error objects are logged (existing G3 contract).
- **Exit codes:** `0` complete (created or converged all the way); `2` a typed domain refusal (conflict, rejected, held-by-other) or a stopped slice; `1` anything unexpected: configuration, guard, usage or input errors, a thrown command error (a lost connection is never retried or replayed; the event stream carries its facts), and an infrastructure completion failure. stderr carries only fixed lines `program-attempt: <code>`: never a raw Error, input, environment or configuration value.
- **Not atomic (truthful partial progress):** the three commands are separate durable transactions. A refusal at a later step leaves the earlier steps' rows committed (for example a new run row when the attempt then conflicts, or the run and attempt when the slice refuses); the exit code 2 and the logged events say so. Re-running with corrected input converges the earlier steps.
- **Cleanup:** the outcome is decided first. Flushing the logger and ending the pool then run together under one fixed 5000 ms process safeguard (not a provider, retry or cost timeout policy) and the process then exits explicitly. A prior nonzero exit is always preserved; if the run was otherwise successful but the flush or shutdown failed or timed out the exit is 1 with `cleanup_failed` (rows may already be committed: exit 1 does not mean nothing was written).
- **Version evidence (pinned, installed, no upgrade):** pino 9.9.5, sonic-boom 4.2.1, pg 8.16.3, pg-pool 3.14.0, zod 4.1.11. Read from the installed sources and the official documentation: pino documents `logger.flush([cb])` for asynchronous (`sync: false`) destinations with a callback to wait on, and the installed `lib/tools.js` builds the default stdout destination as an asynchronous SonicBoom, hence the synchronous destination here; node-postgres documents that `pool.end()` drains the pool, returns a Promise, and that idle clients can emit errors through the pool's `error` event (an unhandled one can crash the process), hence the pool error listener.
