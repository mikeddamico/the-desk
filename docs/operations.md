# Foundation operations

## Environment and deployment

`DESK_ENV` is mandatory and is never inferred. Development/test providers are disabled and generation is killed by default. Staging must use isolated Postgres credentials, set `DESK_ENV=staging`, inject secrets through the hosting platform, and build the same immutable Docker image CI verifies. `DEPLOYED_COMMIT` is embedded at build/deploy time and emitted by the health command. Production is intentionally not deployed by this tranche.

A staging completion record must capture the image digest, commit SHA, migration checksums, health-command output, and one synthetic exception correlation ID observed in a hosted error tracker. Protected source bodies, prompts, authorization headers, and credentials must never be attached. This repository supplies the correlation-aware structured logger; selecting/configuring hosted staging infrastructure remains an external deployment action.

## Database privileges

Run `migrations/roles.sql` as a database owner, grant login credentials out of band, and execute migrations with `MIGRATION_DATABASE_URL`. Runtime code uses the distinct `DATABASE_URL` role, which has `SELECT`/`INSERT`, no schema creation, and no `UPDATE`/`DELETE`/`TRUNCATE`. Immutable table triggers provide defense in depth even if a broader credential is accidentally used.

## Forward migration and recovery

Migrations are ordered SQL and checksummed on first application. Applied bytes must never change; add a forward-fix migration. Before a destructive staging migration, take a provider-native snapshot, record its identity, restore it into a fresh isolated database, run `npm run db:verify`, and execute repository/integrity tests. Record duration and result. Build 1 does not authorize production migrations.

## Destructive commands

`npm run db:reset` refuses production and requires `DESTRUCTIVE_CONFIRMATION=destroy-<environment>`. It uses migration credentials only.
