# Foundation audit repair — pre-commit report

Starting branch: `codex/implement-build-1-foundation-tranche`.
Starting HEAD: `fdfaf19a3a95a0c6224c440b19851631d0b051de`.
The starting tree was clean. No branch repair, fetch, reset, rebase, merge, new branch, or new PR was performed. `/Lock` is unchanged.

## Files changed

- `migrations/001_foundation.sql`, `migrations/roles.sql`: schema, constrained lifecycle, provenance and privileges.
- `src/db/migrations.ts`, `src/db/pool.ts`, `src/db/cli.ts`: exact-byte migration identity, advisory locking, effective roles, migration-only credentials and safe reset behavior.
- `src/config.ts`: runtime/migration separation and deployed commit identity.
- `src/identity/canonical-json.ts`, `src/identity/spans.ts`, `src/identity/fingerprints.ts`: semantic boundary and exact stage projection validation.
- `test/integration/database.test.ts`: live PostgreSQL 17 regression and least-privilege proof.
- `test/canonical-json.test.ts`, `test/config-logging.test.ts`, `test/migrations.test.ts`, new `test/fingerprints.test.ts` and `test/spans.test.ts`: adversarial tests and configuration checks.
- `.gitattributes`, `.npmrc`, `package.json`, `package-lock.json`, `Dockerfile`, `.github/workflows/ci.yml`: migration LF policy, consistent existing npm pin, clean install, and requested Action SHA pins.
- `README.md`, `docs/operations.md`, this report: procedure, scope, recovery and review evidence.

## B1 — lifecycle and Build-2 integrity

One `lifecycle_state` enum implements the supplied canonical sequence plus HALTED; it is shared by run and attempt projections. Inserts must start PENDING. Evaluation cannot enable publication or pass VALIDATED. Publication-disabled production can enter READY/REVALIDATED but cannot publish. Same-show configuration is enforced in the attempt trigger. Runtime has no direct UPDATE privilege.

New functions and their necessity:

- `valid_lifecycle_edge`: one shared graph; unrestricted text could not reject unknown/skipped/reversed transitions.
- `guard_run_lifecycle`: validates run inserts/updates, protects identity, and requires an attempt at the projected next state.
- `guard_attempt_lifecycle`: validates purpose, publication, configuration, package binding, repair lineage, canonical edges and candidate-specific approval. Existing foreign keys could not express these cross-table rules.
- `transition_run` and `transition_attempt`: expected-state compare-and-update entry points, with secured search paths and narrowly granted EXECUTE. They replace unrestricted runtime UPDATE; READY minting occurs in the same transaction as advancement.
- `bind_evidence_package`: one-time binding before PACKAGED, needed because ordinary attempts may begin before their package is available. It cannot replace a previously bound package.
- `guard_render_take`: binds a take to its successful provider call, exact base request, take index and audio artifact. Independent foreign keys previously allowed inconsistent combinations.

Additional constraints: SHA-256 domains for plain and `v1:` identities; closed evidence types, claim kinds/origins, claim/evidence use modes, gate outcomes and take-selection decisions; nonempty claim `subject_domain`; nonempty auditor kind/version; composite take-selection/block foreign key; and a required master-audio foreign key on assembly maps. Subject domains and auditor kinds are not given invented closed registries. Existing hash checks remain, and previously unconstrained claimed hashes now validate shape.

The state graph is not a full Build-2 gate executor, live revalidation implementation, or publication implementation. READY requires a stored audio artifact, but this tranche does not claim to execute audio validation itself.

## B2 — Evidence Package binding

`evidence_packages.program_run_id` is removed. Package/artifact uniqueness is preserved, and package hash shape is constrained. `program_run_attempts.evidence_package_id` references the shared immutable snapshot. A new table was unnecessary: the attempt is the consumer binding already required by Architecture v1.0 and ADR-003A.

The lifecycle guard requires a package from PACKAGED onward. Lower-layer repair children must reuse the parent's exact package; evidence repairs can bind a new one.

## B3 — Episode, review and repair lineage

Episodes retain one unique originating run, GUID and canonical `pub_date`. First READY mints them under a run-row lock; later repaired candidates reuse the identity. The first attempt/master are no longer columns on the Episode.

New tables:

- `episode_versions`: Architecture v1.0's existing concept, now physically represented with Episode, unique attempt, exact master, unique READY fingerprint and immutable creation status. One Episode row could not represent multiple repaired candidates without mutation.
- `repair_plan_decisions`: unique terminal confirm/reject per plan, human actor and timestamp. An immutable plan cannot safely carry a later mutable confirmation flag.

New functions:

- `guard_episode_lineage`: rejects evaluation Episodes and cross-run/non-READY versions even with owner-level INSERT.
- `guard_operator_decision`: requires a human actor and a current READY version for review; privilege grants separately restrict who can perform the write.

Constraints include unique candidate fingerprints/attempts, exact version/fingerprint review foreign keys, one terminal decision per version, the three launch outcomes, same-run composite parent foreign key, paired parent/causal plan, unique child per plan, confirmed causal plan checks, exact repair-request attempt/fingerprint foreign key, plan-version uniqueness/positivity and the closed repair-layer registry. The parent remains READY; children start PENDING and traverse the same lifecycle. Version status records READY creation, while current execution state belongs to the attempt.

A separate `desk_operator` NOLOGIN capability inherits runtime access and adds INSERT only for privileged review/plan decisions. Ordinary runtime cannot confirm its own repair or review. Actor IDs are not substitutes for authenticating the operator; the later operator entry point must authorize use of that capability.

## B4 — authoritative provider-call history

`provider_calls` is the immutable started/reserved operational-try identity. It records attempt, provider, operation, model, request fingerprint, logical key, try number, intentional index, retry/reroll lineage and start time. The old mutable outcome/cost columns and ambiguous minor-unit cost are removed.

New subordinate tables:

- `provider_call_events`: one append-only terminal outcome per reserved operational try, end time, exact usage, exact unscaled PostgreSQL `numeric` cost, currency and optional response artifact/reference. A reservation cannot know its future outcome, and mutating it contradicts append-only history.
- `reroll_triggers`: durable next-take allocation, source call, named mechanical failure/version/validation artifact/actor; an operator-repair trigger instead binds a confirmed plan. Retry pointers alone cannot distinguish deliberate new takes from network retries.

`guard_provider_history` validates chronology, sequential same-identity retries following retryable outcomes, retained-take reroll provenance, and confirmed repair-child execution for subjective editorial takes. Constraints cover `(logical_request_key, operational_try_number)` uniqueness, a unique retry successor, positive tries/nonnegative indices, exact TTS logical-key derivation, matched retry/reroll relationships, closed terminal event types, one outcome per try, object-shaped usage, finite nonnegative numeric cost with currency, unique `(base_request_hash, take_index)` trigger allocation and causal foreign keys.

Spend derives only from provider-call outcomes, grouped by currency. No separate spend table exists. Unknown post-crash outcomes remain unfinished reservations and require reconciliation; no live adapter or exactly-once external-provider guarantee is invented.

## B5 — effective least privilege and migration integrity

Bootstrap retains ownership of the application schema; migrator has CREATE/USAGE and owns its application objects. Default privileges apply to the actual creator, `desk_migrator`, selected by the migration pool. Runtime uses its own effective role and has SELECT/INSERT except explicit protected-table exceptions. It cannot CREATE, UPDATE, DELETE, TRUNCATE, disable triggers, become migrator, or access the migration ledger.

The new `desk_internal` schema isolates the existing `schema_migrations` table from application default grants; no second ledger was added. Migration runner rejects unknown/changed applied entries, hashes exact file bytes, fatally decodes UTF-8 and serializes ledger creation/checks/application with a transaction advisory lock on one connection. SQL checkout line endings are fixed to LF.

`reject_immutable_mutation` is retained. Every declared immutable relation now has both row UPDATE/DELETE and statement TRUNCATE triggers, including the new history tables. A malicious object owner can change DDL; application credentials cannot.

Runtime configuration no longer contains migration credentials. Migration CLI uses a separate loader. Reset now directs explicit, non-production owner-level disposable database recreation instead of granting migrator schema ownership merely to drop `public`.

## Regression evidence and existing test changes

The live integration suite covers each reproduced failure:

- Evaluation READY/PUBLISHING/publication enablement/Episode creation; disabled-production READY and publishing denial; full enabled-production graph; skip/reversal/stale/terminal transitions; cross-show config; run projection and one-time package binding.
- One package shared across evaluation/production/repair; changed evidence only through confirmed evidence repair.
- Stable Episode/GUID/pubDate across child READY; causal same-run lineage; confirmation/rejection separate from plans; rejected/unconfirmed plans; privileged decisions; duplicate terminal reviews; unknown outcomes and malformed/mismatched fingerprints; fresh child approval.
- Concurrent duplicate reservations; immutable success/retryable/terminal outcomes; decimal cost beyond binary floating-point precision; retry/reroll distinction; named mechanical trigger; separate confirmed editorial take; no mutation to close a reservation.
- Bootstrap as owner, migrations/application writes under non-superuser LOGIN wrappers and effective capabilities; real pool factories; concurrent migration connections; later migration-created table grants; forbidden DDL/DML/ledger writes/trigger disabling; all immutable tables reject owner-level TRUNCATE; forged future migration detected.
- Cross-block/base-request take rejection; real master-map foreign key; closed registries, auditor identity and SHA shape.

Unit/fixture tests cover sparse arrays, lone surrogates, impossible dates/24:00/non-Z timestamps, preserving supplied fractional digits, all six exact fingerprint key sets/nested assembly shape, all existing fixture conformance tests, raw migration bytes/invalid UTF-8, deployed SHA validation and health without migration credentials.

No test was removed to conceal a defect. The old integration test's `created` state was replaced by PENDING because Architecture v1.0's canonical lifecycle excludes `created`. The old mutable provider-row test was replaced by reservation/outcome regressions under the accepted repair model. The config credential-separation assertion now targets the migration loader; normal startup must not require migration credentials. The old short production commit fixture was changed to a full SHA to satisfy the deployed-version requirement. Existing frozen-fixture tests remain unchanged.

## Authority, remaining scope and rollback

All five audit defects are addressed. No requested audit finding is intentionally left unfixed. The user adjudicated the only surfaced timestamp ambiguity: accept valid RFC 3339 UTC Z fractions as supplied and preserve every digit. No fractional trim/pad rule is added. Fractional canonicalization remains a later spec-adjudication matter before equivalent fractional representations become hash-identical. The Handoff's stale trace reference is handled by the active manifest without changing Lock.

This is an authorized edit of an unmerged, disposable-only baseline. Repository operations documentation supplied no evidence of permanent application; only a newly created disposable local PostgreSQL container was accessed. Existing disposable databases must be recreated. Rollback means reverting this commit and recreating the disposable database from the corresponding baseline; never run either edited baseline over an already-applied permanent environment. No production access or `002` repair migration is involved.

Staging deployment and hosted error-tracking correlation remain later Build-1 completion gates. Full workflow execution, paid providers, live revalidation, publication and the other stated non-goals remain outside this repair.

## External dependency/toolchain verification

- Selected Node `24.21.0`, local npm `11.19.0`, PostgreSQL 17, `pg` 8.16.3 and lockfile versions were inspected. No application dependency was added or upgraded.
- npm 11.19.0's official package metadata reports Node `^20.17.0 || >=22.9.0`; the existing Node pin satisfies it. Its [release notes](https://github.com/npm/cli/releases/tag/v11.19.0) and [security advisories](https://github.com/npm/cli/security/advisories) were checked. npm is now explicitly pinned rather than implicitly inherited from the Node distribution.
- Regenerating the lockfile with npm 11.19.0 removed 27 entries already marked `extraneous`; no retained package version changed. Clean local/container installation uses `npm ci --ignore-scripts`.
- Verified core [PostgreSQL 17 UUID generation](https://www.postgresql.org/docs/17/functions-uuid.html), allowing removal of the unnecessary pgcrypto extension, and the [Node 24.21.0 TextDecoder contract](https://raw.githubusercontent.com/nodejs/node/v24.21.0/doc/api/util.md) for fatal UTF-8 decoding. The Node documentation site was inaccessible, so the official tagged source documentation was used.
- Verified official [PostgreSQL 17 default privileges](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html), [function security](https://www.postgresql.org/docs/17/sql-createfunction.html), [triggers](https://www.postgresql.org/docs/17/sql-createtrigger.html), [advisory locks](https://www.postgresql.org/docs/17/explicit-locking.html), [security advisories](https://www.postgresql.org/support/security/17/), and [node-postgres connection options](https://node-postgres.com/apis/client). Live validation uses PostgreSQL 17.11.
- Verified [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) and [setup-node v7.0.0](https://github.com/actions/setup-node/releases/tag/v7.0.0), their SHA-specific `action.yml`/READMEs and advisory pages. Both use Node 24. Their runner requirements are compatible with the existing GitHub-hosted `ubuntu-latest` job. Only these requested Actions changed, pinned to the supplied verified SHAs.

## Validation results

Final local validation (2026-09-28 UTC):

| Check                                                                                          | Result                                                                                                 |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `node --version` / `npm --version`                                                             | `v24.21.0` / `11.19.0`                                                                                 |
| `npm ci --ignore-scripts`                                                                      | Passed; 173 packages installed                                                                         |
| `npm run format:check`                                                                         | Passed                                                                                                 |
| `npm run lint`                                                                                 | Passed                                                                                                 |
| `npm run typecheck`                                                                            | Passed                                                                                                 |
| `npm run build`                                                                                | Passed                                                                                                 |
| `npm run test:all` with disposable PostgreSQL 17.11                                            | 7 files, 39 tests passed; integration was not skipped                                                  |
| `npm audit --audit-level=high`                                                                 | Passed; zero vulnerabilities reported                                                                  |
| `docker build --tag the-desk:audit-repair --build-arg DEPLOYED_COMMIT=$(git rev-parse HEAD) .` | Passed                                                                                                 |
| Built-container staging health without migration credentials                                   | Passed; status `ok` and full commit identity                                                           |
| `git diff --check`                                                                             | Passed                                                                                                 |
| Lock changes                                                                                   | None                                                                                                   |
| Changed/new-file secret review                                                                 | No credential signature matches or secret material found; test login passwords are generated in memory |

Fresh creation, concurrent migration application, rerun/checksum verification, forged-future-entry rejection, exact fixture conformance and effective privilege checks are included in the 39 tests. Local gitleaks is not installed; the existing CI gitleaks action is unchanged. The local secret check was a targeted signature scan plus review, not a claim of running gitleaks.

Initial sandbox attempts could not connect to PostgreSQL, execute the fixture unzip child process, or reach npm audit/metadata DNS. Those checks were rerun with the required access and passed; no validation was bypassed. GitHub-hosted CI itself has not been claimed as locally executed.
