# A5.2 provider reservation / outcome commands (bounded safety proof)

Scope: `src/runtime/provider.ts` (`reserveProviderCall`, `recordProviderOutcome`, `reconcileProviderCall`, `lookupProviderCall`,
`executeProviderCall`) over the EXISTING `provider_calls` / `provider_call_events` tables and the existing `desk_runtime` privileges.
No migration, privilege, dependency, Lock, fixture or expected-hash change; nothing here creates runs/attempts, sets retry/backoff/
timeout/ceiling defaults, or calls a real provider. This is the bounded proof for Handoff v0.5.5 Done-when 10 (a database concurrency
guard preventing duplicate paid work **in the tested model**), not real-provider exactly-once, not a runner, and Completion A remains
incomplete.

## The safety rule (supervisory correction to A5 plan r2 section 4.5)

**Only the worker whose own committed reservation command returned `created` may call `adapter.perform`.**

- `converged` (same authored id) and `held_by_other` (different authored id at the same `(logical_request_key, try)`) NEVER grant
  execution - with or without an outcome, with an identical authored id, or after a lookup that returns `not_performed`. Two recoverers
  can both observe "no outcome"; a shared reservation is not an execution lease.
- Completed identical retry returns the durable outcome and makes no call (`completed`).
- No automatic takeover, TTL/lease, implicit retryable failure, or new try from an unfinished call. The existing guard also refuses a
  retry until a `retryable_failure` outcome is durably recorded, so an unfinished reservation cannot be bypassed by a retry.
- `perform` that throws/times out => `ambiguous` (the provider may have acted). It is never turned into a retryable failure; only an
  outcome the adapter _returns_ as governed evidence is recorded by the caller's `finish`.
- Reconciliation never performs. `performed` requires adapter evidence bound to THIS reservation (call id, logical key, fingerprint);
  with an explicit `finish` it records that existing outcome (idempotent). No lookup / failed lookup / unbound evidence => `unknown`;
  `not_performed` => still unfinished.
- The reservation commits before any side effect (a separate transaction).

## Intentional availability limitation

A reservation that is created and then abandoned (the creating worker dies before recording an outcome) stays unfinished: nothing in
this tranche may perform it again, retry it, or mark it failed. Resolving such a slot needs an owner-governed decision (lease/TTL or
operator action) that is NOT supplied here. This favors never issuing a second paid call over availability.

## Identities and equality

| Item                    | Identity / comparison                                                                                                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reservation             | authored `provider_call_id`; all twelve immutable columns (attempt, provider, operation, model, fingerprint, key, try, take index, retry-of, reroll-of, trigger, `started_at`) compared IN SQL (`IS NOT DISTINCT FROM`, `timestamptz =`) |
| Slot                    | `UNIQUE(logical_request_key, operational_try_number)`; a different authored id => `held_by_other`; the same id at another slot => `conflict`                                                                                             |
| Outcome                 | one event per call (`UNIQUE(provider_call_id)`); every field compared in SQL, `usage` by `jsonb =`                                                                                                                                       |
| Retry vs take vs reroll | the EXISTING `guard_provider_history` trigger and CHECKs decide legality; rejections map to `rejected`, nothing written                                                                                                                  |
| Timestamps              | RFC 3339, `Z`/offset, 0-6 fractional digits (a 7th is rejected: PostgreSQL rounds it); compared as instants (an offset spelling of the same instant converges)                                                                           |
| Costs                   | exact decimal TEXT matching `^(0\|[1-9][0-9]*)(\.[0-9]+)?$` (<= 64 chars), never a JS number                                                                                                                                             |

Cost equality follows the actual column: `actual_cost` is `numeric`, so `1.5` and `1.50` are the same value (a converged retry returns
the STORED text; PostgreSQL keeps the first writer's scale, it does not store "lexical formatting" as identity). Differences at any
digit (e.g. `...780` vs `...789` beyond double precision) are conflicts. Exponent, sign, leading-zero, `NaN` and `Infinity` forms are
rejected, not normalized. Payload JSON uses the shared strict boundary (safe integers only, every own key preserved).

## Test-only harness (not production)

The durable side-effect adapter lives in a separate schema (`a5_2_effects`) of the disposable test database, created by test support;
`perform` inserts an invocation row on its own autocommit connection before returning, so duplicate work is counted by
`count(*)` per logical key across all workers and restarts. Crash points (`after_reservation_commit`, `after_side_effect`,
`after_outcome_commit`, `after_commit_before_return`, `reservation_inserted_uncommitted`) HOLD until the parent observes a database
fact, then SIGKILL. The fault seam is inert unless `DESK_TEST_FAULTS=1` and a hook is registered.

## Not claimed

Real-provider exactly-once (P&R 26: an ambiguous timeout without provider idempotency may bill twice and that is outside this
database-level guard); lease/TTL/takeover; production retry/backoff/timeout/ceiling values; run/attempt creation; take selection;
READY/operator flows; the generic workflow runner; Completion A.
