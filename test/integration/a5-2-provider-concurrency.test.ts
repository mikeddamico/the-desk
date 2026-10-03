// A5.2 provider safety proof (P1-P6 concurrency, recovery and crash points) on disposable PostgreSQL 17.
// Duplicate-work evidence is the DURABLE invocation table of the test adapter (separate schema), counted across workers and restarts.
// Synchronization is always a database/process fact (pg_locks, committed rows, held child), never a sleep; waits are bounded and the
// children are always SIGKILLed and their backends waited out (withChild).
import { randomUUID } from "node:crypto";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  lookupProviderCall,
  recordProviderOutcome,
  type AuthoredReservation,
  type ExecuteResult,
} from "../../src/runtime/provider.js";
import { TestCluster } from "../support/db-env.js";
import {
  durableAdapter,
  finishSucceeded,
  invocationCount,
  outcome,
  drain,
  providerEnv,
  reservation,
  scoped,
  type ProviderEnv,
} from "../support/a5-provider.js";
import { observe, withChild } from "../support/a5-crash.js";
import { waitForBlocked, within } from "../support/pg-wait.js";
import { executeObserved, reconcileObserved } from "../support/a6-observed.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const cluster = databaseUrl ? new TestCluster(databaseUrl) : undefined;
let pe: ProviderEnv;
if (cluster && databaseUrl) {
  beforeAll(async () => {
    await cluster.bootstrap();
    pe = await providerEnv(cluster, databaseUrl);
  }, 180000);
  afterAll(async () => {
    await pe.close();
    await cluster.shutdown();
  });
}

const HOOK = Symbol.for("the-desk.a5.test-fault-hook");
/** In-process gate: the FIRST caller to reach `point` parks there until `release()`; later callers pass. Always `dispose()`d. */
function gate(point: string): {
  reached: Promise<void>;
  release(): void;
  dispose(): void;
} {
  let hits = 0;
  let release!: () => void;
  let markReached!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reached = new Promise<void>((resolve) => {
    markReached = resolve;
  });
  process.env.DESK_TEST_FAULTS = "1";
  (globalThis as Record<symbol, unknown>)[HOOK] = async (name: string) => {
    if (name !== point) return;
    hits += 1;
    if (hits === 1) {
      markReached();
      await released;
    }
  };
  return {
    reached,
    release,
    dispose: () => {
      release();
      Reflect.deleteProperty(globalThis, HOOK);
      delete process.env.DESK_TEST_FAULTS;
    },
  };
}

const worker = (name: string): pg.Pool => {
  const pool = new pg.Pool({
    connectionString: pe.env.runtimeUrl,
    options: "-c role=desk_runtime",
    max: 1,
    application_name: name,
  });
  pool.on("error", () => undefined);
  // a checked-out client has no pool-level error listener; a deliberately terminated backend must not become an unhandled error
  pool.on("connect", (client) => {
    client.on("error", () => undefined);
  });
  return pool;
};
const adapter = (over = {}) =>
  durableAdapter(pe.env.owner, { lookup: true, ...over });
/** Every worker/reconciler promise started by a scenario, so a bounded cleanup can see it even after its `within` timed out. */
const inflight: Promise<unknown>[] = [];
const track = <T>(p: Promise<T>): Promise<T> => {
  p.catch(() => undefined);
  inflight.push(p);
  return p;
};
const drainable = (): Promise<unknown>[] => inflight.splice(0);
const reconcile: typeof reconcileObserved = (pool, args) =>
  track(reconcileObserved(pool, args));
const record: typeof recordProviderOutcome = (pool, o) =>
  track(recordProviderOutcome(pool, o));
const run = (pool: pg.Pool, r: AuthoredReservation): Promise<ExecuteResult> =>
  track(
    executeObserved(pool, r, adapter(), finishSucceeded(r.provider_call_id)),
  );
const count = (r: AuthoredReservation): Promise<number> =>
  invocationCount(pe.env.owner, r.logical_request_key);
const statuses = (rs: ExecuteResult[]): string[] => rs.map((r) => r.status);
const reservationRows = async (id: string): Promise<number> =>
  (
    await pe.rows("SELECT 1 FROM provider_calls WHERE provider_call_id = $1", [
      id,
    ])
  ).length;
const eventRows = async (id: string): Promise<number> =>
  (
    await pe.rows(
      "SELECT 1 FROM provider_call_events WHERE provider_call_id = $1",
      [id],
    )
  ).length;
const childSpec = (
  tag: string,
  fault: string,
  r: AuthoredReservation,
  lookup = true,
) => ({
  url: pe.env.runtimeUrl,
  ownerUrl: pe.ownerUrl,
  tag,
  fault,
  scenario: "provider" as const,
  reservation: r,
  lookup,
});

suite("A5.2 P1: simultaneous workers, one durable invocation", () => {
  it("N workers with DIFFERENT authored ids at one (key, try): exactly one performs; the rest are held_by_other and never call", async () => {
    const r = reservation(pe.attempt);
    const g = gate("reservation_inserted_uncommitted");
    const pools = Array.from({ length: 5 }, (_, i) =>
      worker(`p1d${String(i)}`),
    );
    const results: Promise<ExecuteResult>[] = [];
    await scoped(
      async () => {
        const [first, ...rest] = pools;
        if (!first) throw new Error("pools");
        results.push(run(first, r));
        await within(g.reached, 30000, "first reservation inserted");
        // the others queue BEHIND the uncommitted reservation insert: PostgreSQL itself reports the waits
        for (const p of rest)
          results.push(run(p, { ...r, provider_call_id: randomUUID() }));
        const waiting = await waitForBlocked(
          pe.env.owner,
          pe.env.name,
          (w) =>
            w.filter(
              (x) =>
                x.locktype === "transactionid" &&
                x.application_name.startsWith("p1d"),
            ).length >= rest.length,
        );
        expect(waiting.length).toBeGreaterThanOrEqual(rest.length);
        g.release();
        const done = await within(Promise.all(results), 30000, "workers");
        expect(statuses(done).filter((s) => s === "performed")).toHaveLength(1);
        for (const d of done.slice(1))
          expect(d.status === "unfinished" || d.status === "completed").toBe(
            true,
          );
        for (const d of done)
          if (d.status === "unfinished") expect(d.reason).toBe("held_by_other");
        expect(await count(r)).toBe(1);
        expect(
          (
            await pe.rows(
              "SELECT 1 FROM provider_calls WHERE logical_request_key = $1",
              [r.logical_request_key],
            )
          ).length,
        ).toBe(1);
      },
      async () => {
        g.dispose();
        return drain({
          owner: pe.env.owner,
          database: pe.env.name,
          apps: ["p1d%"],
          promises: drainable(),
          pools,
        });
      },
    );
  }, 120000);

  it("N workers with the SAME authored id: converge on one reservation; ONLY the creating commit performs", async () => {
    const r = reservation(pe.attempt);
    const g = gate("reservation_inserted_uncommitted");
    const pools = Array.from({ length: 5 }, (_, i) =>
      worker(`p1s${String(i)}`),
    );
    const results: Promise<ExecuteResult>[] = [];
    await scoped(
      async () => {
        const [first, ...rest] = pools;
        if (!first) throw new Error("pools");
        results.push(run(first, r));
        await within(g.reached, 30000, "first reservation inserted");
        for (const p of rest) results.push(run(p, r));
        await waitForBlocked(
          pe.env.owner,
          pe.env.name,
          (w) =>
            w.filter(
              (x) =>
                x.locktype === "transactionid" &&
                x.application_name.startsWith("p1s"),
            ).length >= rest.length,
        );
        g.release();
        const done = await within(Promise.all(results), 30000, "workers");
        expect(statuses(done).filter((s) => s === "performed")).toHaveLength(1);
        for (const d of done)
          if (d.status === "unfinished")
            expect(d.reason).toBe("converged_without_outcome");
        expect(await count(r)).toBe(1);
      },
      async () => {
        g.dispose();
        return drain({
          owner: pe.env.owner,
          database: pe.env.name,
          apps: ["p1s%"],
          promises: drainable(),
          pools,
        });
      },
    );
  }, 120000);

  it("original owner ALIVE (parked after its reservation commit) vs recovering workers: recoverers see 'no outcome' and still never perform; the owner performs once", async () => {
    const r = reservation(pe.attempt);
    const g = gate("after_reservation_commit");
    const owner = worker("p1o");
    const recoverers = Array.from({ length: 3 }, (_, i) =>
      worker(`p1r${String(i)}`),
    );
    let ownerRun: Promise<ExecuteResult> | undefined;
    await scoped(
      async () => {
        ownerRun = run(owner, r);
        await within(g.reached, 30000, "owner parked after commit");
        expect(await reservationRows(r.provider_call_id)).toBe(1); // committed and visible to others
        const [a, b, c] = recoverers;
        if (!a || !b || !c) throw new Error("pools");
        // two recoverers with the SAME id and one with a DIFFERENT id, simultaneously
        const rec = await within(
          Promise.all([
            run(a, r),
            run(b, r),
            run(c, { ...r, provider_call_id: randomUUID() }),
          ]),
          30000,
          "recoverers",
        );
        expect(
          rec.map((x) => (x.status === "unfinished" ? x.reason : x.status)),
        ).toEqual([
          "converged_without_outcome",
          "converged_without_outcome",
          "held_by_other",
        ]);
        // an adapter that reports "not_performed" is NOT a lease either
        const lookedUp = await reconcile(a, {
          providerCallId: r.provider_call_id,
          adapter: adapter(),
        });
        expect(lookedUp.status).toBe("not_performed");
        expect((await run(a, r)).status).toBe("unfinished");
        expect(await count(r)).toBe(0);
        g.release();
        expect((await within(ownerRun, 30000, "owner")).status).toBe(
          "performed",
        );
        expect(await count(r)).toBe(1);
        expect((await run(b, r)).status).toBe("completed");
        expect(await count(r)).toBe(1);
      },
      async () => {
        g.dispose();
        return drain({
          owner: pe.env.owner,
          database: pe.env.name,
          apps: ["p1o", "p1r%"],
          promises: drainable(),
          pools: [owner, ...recoverers],
        });
      },
    );
  }, 120000);
});

suite(
  "A5.2 P2-P4: SIGKILL at each crash point, recovery without a second call",
  () => {
    it("P2 kill after the reservation commit (no side effect yet): N recoverers, same and different ids, never perform; stays unfinished", async () => {
      const r = reservation(pe.attempt);
      const done = await withChild(
        pe.env.owner,
        pe.env.name,
        childSpec("p2", "after_reservation_commit", r),
        async () => {
          await observe(
            async () => (await reservationRows(r.provider_call_id)) === 1,
            "reservation committed",
          );
          expect(await count(r)).toBe(0);
          expect(await eventRows(r.provider_call_id)).toBe(0);
        },
      );
      expect(done.signal).toBe("SIGKILL");
      expect(done.stdout).not.toContain("COMPLETED_WITHOUT_FAULT");
      const pools = Array.from({ length: 4 }, (_, i) =>
        worker(`p2r${String(i)}`),
      );
      await scoped(
        async () => {
          const rec = await within(
            Promise.all(
              pools.map((p, i) =>
                run(p, i < 2 ? r : { ...r, provider_call_id: randomUUID() }),
              ),
            ),
            30000,
            "recoverers",
          );
          expect(
            rec.map((x) => (x.status === "unfinished" ? x.reason : x.status)),
          ).toEqual([
            "converged_without_outcome",
            "converged_without_outcome",
            "held_by_other",
            "held_by_other",
          ]);
          expect(await count(r)).toBe(0);
          expect(await eventRows(r.provider_call_id)).toBe(0);
          // lookup says "not performed", no lookup says "unknown": both stay unfinished and nothing is invented
          const p = must(pools[0]);
          expect(
            (
              await reconcile(p, {
                providerCallId: r.provider_call_id,
                adapter: adapter(),
              })
            ).status,
          ).toBe("not_performed");
          expect(
            await reconcile(p, {
              providerCallId: r.provider_call_id,
              adapter: durableAdapter(pe.env.owner, { lookup: false }),
            }),
          ).toEqual({ status: "unknown", reason: "adapter_has_no_lookup" });
          // no automatic takeover: neither a retry try nor an implicit failure exists
          expect(
            await pe.rows(
              "SELECT 1 FROM provider_calls WHERE logical_request_key = $1",
              [r.logical_request_key],
            ),
          ).toHaveLength(1);
          expect(await count(r)).toBe(0);
        },
        async () => {
          return drain({
            owner: pe.env.owner,
            database: pe.env.name,
            apps: ["p2r%"],
            promises: drainable(),
            pools,
          });
        },
      );
    }, 120000);

    it("lost acknowledgement of the reservation commit: the identical request converges without a call", async () => {
      const r = reservation(pe.attempt);
      const done = await withChild(
        pe.env.owner,
        pe.env.name,
        childSpec("p2b", "after_commit_before_return", r),
        async () => {
          await observe(
            async () => (await reservationRows(r.provider_call_id)) === 1,
            "reservation committed",
          );
        },
      );
      expect(done.signal).toBe("SIGKILL");
      const p = worker("p2b-r");
      await scoped(
        async () => {
          expect(await run(p, r)).toMatchObject({
            status: "unfinished",
            reason: "converged_without_outcome",
          });
          expect(await count(r)).toBe(0);
        },
        async () => {
          return drain({
            owner: pe.env.owner,
            database: pe.env.name,
            apps: ["p2b-r"],
            promises: drainable(),
            pools: [p],
          });
        },
      );
    }, 120000);

    it.each([true, false])(
      "P3 kill after the DURABLE side effect, before the outcome (adapter lookup=%s): recovery never calls again",
      async (lookup) => {
        const r = reservation(pe.attempt);
        const done = await withChild(
          pe.env.owner,
          pe.env.name,
          childSpec(`p3${lookup ? "l" : "n"}`, "after_side_effect", r, lookup),
          async () => {
            await observe(
              async () => (await count(r)) === 1,
              "durable invocation row",
            );
            expect(await eventRows(r.provider_call_id)).toBe(0);
          },
        );
        expect(done.signal).toBe("SIGKILL");
        const pools = [worker("p3a"), worker("p3b"), worker("p3c")];
        await scoped(
          async () => {
            const [a, b, c] = pools as [pg.Pool, pg.Pool, pg.Pool];
            const rec = await within(
              Promise.all([
                run(a, r),
                run(b, r),
                run(c, { ...r, provider_call_id: randomUUID() }),
              ]),
              30000,
              "recoverers",
            );
            expect(
              rec.map((x) => (x.status === "unfinished" ? x.reason : x.status)),
            ).toEqual([
              "converged_without_outcome",
              "converged_without_outcome",
              "held_by_other",
            ]);
            expect(await count(r)).toBe(1);
            const target = durableAdapter(pe.env.owner, { lookup });
            if (!lookup) {
              expect(
                await reconcile(a, {
                  providerCallId: r.provider_call_id,
                  adapter: target,
                  finish: finishSucceeded(r.provider_call_id),
                }),
              ).toEqual({ status: "unknown", reason: "adapter_has_no_lookup" });
              expect(await eventRows(r.provider_call_id)).toBe(0);
              expect((await run(a, r)).status).toBe("unfinished");
              expect(await count(r)).toBe(1);
              return;
            }
            // simultaneous reconcilers record the SAME existing outcome: one event, nobody performs
            const recorded = await within(
              Promise.all(
                pools.slice(0, 2).map((p) =>
                  reconcile(p, {
                    providerCallId: r.provider_call_id,
                    adapter: target,
                    finish: finishSucceeded(r.provider_call_id),
                  }),
                ),
              ),
              30000,
              "reconcilers",
            );
            for (const x of recorded)
              expect(x.status === "performed" || x.status === "recorded").toBe(
                true,
              );
            expect(await eventRows(r.provider_call_id)).toBe(1);
            expect((await run(c, r)).status).toBe("completed");
            expect(await count(r)).toBe(1);
          },
          async () => {
            return drain({
              owner: pe.env.owner,
              database: pe.env.name,
              apps: ["p3%"],
              promises: drainable(),
              pools,
            });
          },
        );
      },
      120000,
    );

    it("P4 kill after the outcome commit (lost acknowledgement): identical retry returns the durable outcome; differing outcomes conflict; one event", async () => {
      const r = reservation(pe.attempt);
      const done = await withChild(
        pe.env.owner,
        pe.env.name,
        childSpec("p4", "after_outcome_commit", r),
        async () => {
          await observe(
            async () => (await eventRows(r.provider_call_id)) === 1,
            "outcome committed",
          );
        },
      );
      expect(done.signal).toBe("SIGKILL");
      const p = worker("p4r");
      await scoped(
        async () => {
          const again = await run(p, r);
          expect(again.status).toBe("completed");
          const stored = must(
            await lookupProviderCall(p, r.provider_call_id),
          ).outcome;
          expect(stored?.actual_cost).toBe("0.0123");
          expect((await record(p, { ...must(stored) })).kind).toBe("converged");
          expect(
            (
              await record(
                p,
                outcome(r.provider_call_id, { event_type: "terminal_failure" }),
              )
            ).kind,
          ).toBe("conflict");
          expect(
            (
              await record(p, {
                ...must(stored),
                actual_cost: "0.0124",
              })
            ).kind,
          ).toBe("conflict");
          expect(await eventRows(r.provider_call_id)).toBe(1);
          expect(await count(r)).toBe(1);
        },
        async () => {
          return drain({
            owner: pe.env.owner,
            database: pe.env.name,
            apps: ["p4r"],
            promises: drainable(),
            pools: [p],
          });
        },
      );
    }, 120000);

    it("kill while the reservation insert is UNCOMMITTED: a queued worker (observed waiting in pg_locks) then becomes the creator and performs once", async () => {
      const r = reservation(pe.attempt);
      const rival = { ...r, provider_call_id: randomUUID() };
      const p = worker("p5w");
      let queued: Promise<ExecuteResult> | undefined;
      await scoped(
        async () => {
          const done = await withChild(
            pe.env.owner,
            pe.env.name,
            childSpec("p5", "reservation_inserted_uncommitted", r),
            async () => {
              // the child holds an open transaction with an assigned xid and its row is invisible to everyone else
              await observe(
                async () =>
                  (
                    await pe.rows(
                      "SELECT 1 FROM pg_stat_activity WHERE application_name = 'a5child_p5' AND state = 'idle in transaction' AND backend_xid IS NOT NULL",
                    )
                  ).length === 1,
                "child holds an uncommitted reservation",
              );
              expect(await reservationRows(r.provider_call_id)).toBe(0);
              queued = run(p, rival);
              await waitForBlocked(pe.env.owner, pe.env.name, (w) =>
                w.some(
                  (x) =>
                    x.application_name === "p5w" &&
                    x.locktype === "transactionid",
                ),
              );
              expect(await count(r)).toBe(0);
            },
          );
          expect(done.signal).toBe("SIGKILL");
          const res = await within(must(queued), 30000, "queued worker");
          expect(res.status).toBe("performed");
          expect(await reservationRows(r.provider_call_id)).toBe(0); // the killed child's reservation never existed
          expect(await reservationRows(rival.provider_call_id)).toBe(1);
          expect(await count(r)).toBe(1);
        },
        async () => {
          return drain({
            owner: pe.env.owner,
            database: pe.env.name,
            apps: ["p5w"],
            promises: drainable(),
            pools: [p],
          });
        },
      );
    }, 120000);
  },
);

const must = <T>(v: T | undefined | null): T => {
  if (v === undefined || v === null) throw new Error("missing");
  return v;
};

suite(
  "A5.2 test cleanup is bounded and keeps the original diagnostic (failed-observation / non-settling worker path)",
  () => {
    /** An uncommitted competing reservation held by the owner session: any worker for the same slot blocks behind it. */
    const holdSlot = async (
      r: AuthoredReservation,
    ): Promise<{ holder: pg.PoolClient; release(): Promise<void> }> => {
      const holder = await pe.env.owner.connect();
      await holder.query("BEGIN");
      await holder.query(
        `INSERT INTO provider_calls (provider_call_id, attempt_id, provider, operation, model_identifier, request_fingerprint,
         logical_request_key, operational_try_number, started_at)
       VALUES ($1, $2, 'p', 'o', 'm', $3, $4, 1, now())`,
        [
          randomUUID(),
          r.attempt_id,
          r.request_fingerprint,
          r.logical_request_key,
        ],
      );
      return {
        holder,
        release: async () => {
          await holder.query("ROLLBACK").catch(() => undefined);
          holder.release();
        },
      };
    };

    it("a worker that never settles is terminated by the bounded drain and its pool is released", async () => {
      const r = reservation(pe.attempt);
      const held = await holdSlot(r);
      const pool = worker("cl1");
      try {
        const pending = run(pool, r);
        pending.catch(() => undefined);
        await waitForBlocked(pe.env.owner, pe.env.name, (w) =>
          w.some((x) => x.application_name === "cl1"),
        );
        // the bounded wait itself rejects: the worker is genuinely non-settling
        await expect(within(pending, 300, "blocked worker")).rejects.toThrow(
          /did not settle/,
        );
        const started = Date.now();
        const diagnostics = await drain({
          owner: pe.env.owner,
          database: pe.env.name,
          apps: ["cl1"],
          promises: [pending],
          pools: [pool],
          settleMs: 500,
          endMs: 5000,
        });
        expect(Date.now() - started).toBeLessThan(15000);
        expect(diagnostics.join(" | ")).toContain("backends were terminated");
        expect(diagnostics.join(" | ")).not.toContain(
          "still pending after backend",
        );
        await expect(pending).rejects.toThrow();
        expect((pool as unknown as { ended: boolean }).ended).toBe(true);
      } finally {
        await held.release();
      }
    }, 60000);

    it("scoped keeps the ORIGINAL failure (a failed observation) and appends cleanup diagnostics", async () => {
      const r = reservation(pe.attempt);
      const held = await holdSlot(r);
      const pool = worker("cl2");
      let pending: Promise<ExecuteResult> | undefined;
      try {
        const failure = scoped(
          async () => {
            pending = run(pool, r);
            pending.catch(() => undefined);
            await waitForBlocked(pe.env.owner, pe.env.name, (w) =>
              w.some((x) => x.application_name === "cl2"),
            );
            // the expected database fact never appears: bounded observation fails while the worker is still blocked
            await observe(
              async () => (await count(r)) === 1,
              "invocation row",
              400,
            );
          },
          () =>
            drain({
              owner: pe.env.owner,
              database: pe.env.name,
              apps: ["cl2"],
              promises: pending ? [pending] : [],
              pools: [pool],
              settleMs: 500,
            }),
        );
        await expect(failure).rejects.toThrow(
          /database fact not observed within 400 ms: invocation row; cleanup diagnostics: .*backends were terminated/,
        );
      } finally {
        await held.release();
      }
    }, 60000);

    it("late pool.end with NO tracked promises: a checked-out worker client is terminated, released and the original failure is kept", async () => {
      // an untracked session (no promise to settle) that never returns its client: pool.end() cannot complete by itself
      const pool = worker("cl3");
      let client: pg.PoolClient | undefined;
      const failure = scoped(
        async () => {
          client = await pool.connect();
          await client.query("SELECT 1");
          await observe(
            () => Promise.resolve(false),
            "a fact that never appears",
            300,
          );
        },
        () =>
          drain({
            owner: pe.env.owner,
            database: pe.env.name,
            apps: ["cl3"],
            promises: drainable(), // empty: nothing tracked is pending
            pools: [pool],
            settleMs: 300,
            endMs: 600,
          }),
      );
      await expect(failure).rejects.toThrow(
        /database fact not observed within 300 ms: a fact that never appears; cleanup diagnostics: pool\.end exceeded 600 ms; scoped backends were terminated/,
      );
      // the session itself is gone (the guarantee); the pool keeps the leaked client until its owner releases it
      const left = await pe.rows(
        "SELECT 1 FROM pg_stat_activity WHERE datname = $1 AND application_name = 'cl3'",
        [pe.env.name],
      );
      expect(left).toHaveLength(0);
      client?.release(true);
      await observe(
        () => Promise.resolve((pool as unknown as { ended: boolean }).ended),
        "pool ended after the leaked client was released",
        5000,
      );
    }, 60000);
  },
);
