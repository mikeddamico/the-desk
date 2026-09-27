# The Desk — Build 1 Foundation

Foundation implementation for FINAL LOCK v1.2.3: Node.js 24/strict TypeScript, explicit validated configuration, structured redacted logging, PostgreSQL forward migrations and least-privilege roles, immutable editorial lineage, canonical identity primitives, and Frozen Walking-Skeleton Fixture v0.4.3 conformance.

## Local checks

```bash
nvm use
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run build
npm test
```

Database integration tests require a disposable PostgreSQL database:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/the_desk_test npm run test:integration
```

Copy `.env.example` to an ignored `.env` only for local shell tooling; the application does not silently load files or infer an environment. Migration/schema credentials and runtime credentials must be distinct.

## Direct dependencies

- `pg`: the required thin parameterized PostgreSQL connection layer; no ORM is introduced.
- `zod`: runtime validation at configuration and frozen-fixture trust boundaries.
- `pino`: small mature structured logger with path-based redaction.

TypeScript, ESLint, Prettier, Vitest, and `tsx` are development-only compiler/quality/test/CLI tooling. No queue, cache, workflow vendor, ORM, web framework, or additional datastore is introduced.

## Scope

This tranche deliberately does not implement workflow execution, leases, retries/scheduling, READY wait/resume execution, repairs, live providers, audio assembly, publication, ingest, commissioning, retrieval, or a web UI. It stores the locked identities and lineage needed by Builds 1–2 without making mutable projections provenance targets. See [foundation operations](docs/operations.md) for deployment, privileges, migration, backup, and restore procedures.
