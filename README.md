# The Desk — Build 1 Foundation

Foundation implementation: Node.js 24/strict TypeScript, explicit validated configuration, structured redacted logging, PostgreSQL forward migrations and least-privilege roles, immutable editorial lineage, canonical identity primitives, and fixture conformance.

Current implementation authority is FINAL LOCK v1.2.7 (`Lock/00_INDEX/ACTIVE_SPECS_LOCKED_v1.2.7.md`), whose executable contract is Frozen Walking-Skeleton Fixture v0.4.6. While the initial Foundation tranche was authored against FINAL LOCK v1.2.3 and Fixture v0.4.3, subsequent bounded tranches have updated the fixture loader and conformance suite to Fixture v0.4.6 (`src/fixture/`) and added canonical identity/projection helpers (`src/identity/`) and bounded runtime modules (`src/runtime/`). These bounded implementations do not constitute full Build 1 completion.

Migration 002 (`migrations/002_persistence_profile.sql`) is implemented as the bounded, empty-database-only persistence migration for the approved eight-table profile: it locks the twelve protected tables in a fixed order and fails with full rollback if any holds history. It adds the claim-event append-order guard, which requires `READ COMMITTED` for claim-event appends (other isolation levels are rejected with SQLSTATE `0A000`; see [foundation operations](docs/operations.md)). This is the migration only: the unfinished runtime and Completion A work above is not implied by it.

## Local checks

```bash
nvm use
npm install --global npm@11.19.0 --ignore-scripts
npm ci --ignore-scripts
npm run format:check
npm run lint
npm run typecheck
npm run build
npm test
```

Database integration tests require a disposable PostgreSQL 17 database:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/the_desk_test npm run test:integration
```

Copy `.env.example` to an ignored `.env` only for local shell tooling; the application does not silently load files or infer an environment. Migration and runtime credentials must be distinct. Bootstrap roles as the owner before migrating; see the operations guide. Runtime startup does not require migration credentials.

## Direct dependencies

- `pg`: the required thin parameterized PostgreSQL connection layer; no ORM is introduced.
- `zod`: runtime validation at configuration and frozen-fixture trust boundaries.
- `pino`: small mature structured logger with path-based redaction.

TypeScript, ESLint, Prettier, Vitest, and `tsx` are development-only compiler/quality/test/CLI tooling. No queue, cache, workflow vendor, ORM, web framework, or additional datastore is introduced.

## Scope and repository layout

In addition to the initial Foundation database lifecycle and migration layer, the repository includes bounded implementations for:

- `src/identity/`: canonical JSON/timestamp primitives, identity selection, and pure projections ([authority limits](docs/identity-projection-authority.md)).
- `src/fixture/`: pinned Fixture v0.4.6 pack verification, row parsing, and persistence.
- `src/runtime/`: bounded durable and provider command operations ([A5.1](docs/a5-1-durable-commands.md), [A5.2](docs/a5-2-provider-commands.md)), writer fixture input projection ([G1](docs/g1-writer-fixture-input.md)), development/test `READY` review wait/resume (`src/runtime/review-wait.ts`), and synthetic Frozen Fixture v0.4.6 render planning ([render planning](docs/frozen-render046-planning.md)).
- `test/`: unit, conformance, and database integration suites.
- `tools/ci-validation/`: hosted CI stage wrapper and evidence collection/validation tooling.

These modules remain strictly bounded: synthetic render planning never invokes TTS or grants clearance, provider execution is scoped to explicit development/test non-network controls, and review wait/resume is restricted to development/test environments. The repository also includes fixture assembly verification, PCM measurement, and a container/runtime entrypoint. These bounded components do not establish end-to-end live media production, full Build completion, publication readiness, production clearance, or completed staging/deployment proof. See [foundation operations](docs/operations.md) for database privileges, migration, backup, and restore procedures.

## Contributing

Contributors and coding agents must follow [CONTRIBUTING.md](CONTRIBUTING.md) and the [code style and review requirement](docs/code-style.md).
