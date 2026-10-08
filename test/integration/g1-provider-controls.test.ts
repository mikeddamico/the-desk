import { createHash, randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import type pg from "pg";
import { afterAll, beforeAll, afterEach, describe, expect, it } from "vitest";
import {
  executeProviderCall,
  lookupProviderCall,
  reconcileProviderCall,
  reserveProviderCall,
} from "../../src/runtime/provider.js";
import {
  durableAdapter,
  finishSucceeded,
  invocationCount,
  nonNetworkControls,
  providerEnv,
  reservation,
  type ProviderEnv,
} from "../support/a5-provider.js";
import { capturingContext, noopContext } from "../support/a6-observed.js";
import { TestCluster } from "../support/db-env.js";
import { g1Child } from "../support/g1-provider-process.js";
import { observe } from "../support/a5-crash.js";
import { Rejection } from "../../src/runtime/command.js";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
const hook = Symbol.for("the-desk.a5.test-fault-hook");
// D's exact two-int installation arbitration key; test observation only, no lock acquisition.
const D_HOLDER_SQL = `SELECT a.pid FROM pg_stat_activity a JOIN pg_locks l USING(pid)
  WHERE a.datname=$1 AND a.application_name=$2 AND a.state='idle in transaction'
    AND a.backend_xid IS NOT NULL AND a.xact_start IS NOT NULL
    AND l.database=a.datid AND l.granted AND l.locktype='advisory'
    AND l.mode='ExclusiveLock' AND l.classid=182736456 AND l.objid=1 AND l.objsubid=2`;
const D_WAITER_SQL = `SELECT a.pid,a.application_name,pg_blocking_pids(a.pid) AS blockers
  FROM pg_stat_activity a JOIN pg_locks l USING(pid)
  WHERE a.datname=$1 AND a.application_name=ANY($2::text[]) AND a.pid<>$3
    AND a.state='active' AND a.wait_event_type='Lock' AND a.wait_event='advisory'
    AND l.database=a.datid AND NOT l.granted AND l.locktype='advisory'
    AND l.mode='ExclusiveLock' AND l.classid=182736456 AND l.objid=1 AND l.objsubid=2
    AND $3=ANY(pg_blocking_pids(a.pid))`;

afterEach(() => {
  Reflect.deleteProperty(globalThis, hook);
  delete process.env.DESK_TEST_FAULTS;
});

async function snapshot(owner: pg.Pool, includeLedger = true): Promise<string> {
  const tables = await owner.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  );
  const rows: unknown[] = [];
  for (const { tablename } of tables.rows) {
    if (
      !includeLedger &&
      ["provider_calls", "provider_call_events"].includes(tablename)
    )
      continue;
    const value = await owner.query<{ value: string }>(
      `SELECT coalesce(jsonb_agg(jsonb_build_object('value',to_jsonb(t),'xmin',t.xmin::text,'ctid',t.ctid::text) ORDER BY to_jsonb(t)::text),'[]')::text AS value FROM "${tablename}" t`,
    );
    rows.push([tablename, value.rows[0]?.value]);
  }
  return JSON.stringify(rows);
}

function instrumentPool(
  pool: pg.Pool,
  query: (text: unknown, native: () => Promise<unknown>) => Promise<unknown>,
  release?: () => void,
  counts?: { connect: number; clientQuery: number; poolQuery: number },
): pg.Pool {
  return new Proxy(pool, {
    get(target, key) {
      if (key === "connect")
        return async () => {
          if (counts) counts.connect++;
          const client = await target.connect();
          return new Proxy(client, {
            get(connection, name) {
              if (name === "query")
                return (...args: unknown[]) => {
                  if (counts) counts.clientQuery++;
                  return query(args[0], () =>
                    Promise.resolve(
                      Reflect.apply(
                        Reflect.get(connection, "query"),
                        connection,
                        args,
                      ),
                    ),
                  );
                };
              if (name === "release")
                return (...args: unknown[]) => {
                  Reflect.apply(
                    Reflect.get(connection, "release"),
                    connection,
                    args,
                  );
                  release?.();
                };
              const value: unknown = Reflect.get(connection, name, connection);
              return typeof value === "function"
                ? (...args: unknown[]): unknown =>
                    Reflect.apply(value, connection, args)
                : value;
            },
          });
        };
      if (key === "query")
        return (...args: unknown[]): unknown => {
          if (counts) counts.poolQuery++;
          return Reflect.apply(Reflect.get(target, "query"), target, args);
        };
      const value: unknown = Reflect.get(target, key, target);
      return typeof value === "function"
        ? (...args: unknown[]): unknown => Reflect.apply(value, target, args)
        : value;
    },
  });
}

suite("G1-A real PostgreSQL controlled non-network execution", () => {
  const cluster = url ? new TestCluster(url) : undefined;
  beforeAll(async () => {
    await cluster?.bootstrap();
  }, 120000);
  afterAll(async () => {
    await cluster?.shutdown();
  }, 120000);
  async function scenario(
    body: (pe: ProviderEnv, pool: pg.Pool) => Promise<void>,
  ) {
    if (!url || !cluster) throw new Error("real PG required");
    const pe = await providerEnv(cluster, url);
    try {
      await body(pe, pe.runtime());
    } finally {
      await pe.close();
    }
  }

  it.each([
    [undefined, "provider_admission_unavailable"],
    [
      { ...nonNetworkControls(), mode: "live" },
      "provider_admission_unavailable",
    ],
    [
      { ...nonNetworkControls(), DESK_ENV: "production" },
      "provider_execution_disabled",
    ],
    [
      { ...nonNetworkControls(), DESK_ENV: "staging" },
      "provider_execution_disabled",
    ],
    [
      { ...nonNetworkControls(), PROVIDERS_ENABLED: true },
      "provider_execution_disabled",
    ],
    [
      { ...nonNetworkControls(), GENERATION_KILL_SWITCH: true },
      "provider_execution_disabled",
    ],
    [
      { ...nonNetworkControls(), PROVIDER_CALL_TIMEOUT_MS: 0 },
      "provider_controls_invalid",
    ],
    [
      { ...nonNetworkControls(), PROVIDER_CALL_TIMEOUT_MS: 1.5 },
      "provider_controls_invalid",
    ],
    [
      { ...nonNetworkControls(), PROVIDER_CALL_TIMEOUT_MS: Infinity },
      "provider_controls_invalid",
    ],
  ])(
    "new controls %j refuse without any protected write/effect",
    async (controls, code) => {
      await scenario(async (pe, pool) => {
        const before = await snapshot(pe.env.owner);
        const request = reservation(pe.attempt);
        const result = await executeProviderCall(
          pool,
          request,
          durableAdapter(pe.env.owner, { lookup: true }),
          finishSucceeded(request.provider_call_id),
          noopContext(),
          controls,
        );
        expect(result).toMatchObject({ status: "rejected", result: { code } });
        expect(await snapshot(pe.env.owner)).toBe(before);
        expect(await invocationCount(pe.env.owner)).toBe(0);
      });
    },
    120000,
  );

  it("rejects control accessors and exotic enum values without invoking/stringifying them", async () => {
    await scenario(async (pe, pool) => {
      let consumed = 0;
      const accessor = {
        ...nonNetworkControls(),
        get DESK_ENV() {
          consumed++;
          throw new Error("CONTROL_CANARY");
        },
      };
      const coercion = {
        ...nonNetworkControls(),
        DESK_ENV: {
          toString() {
            consumed++;
            throw new Error("COERCION_CANARY");
          },
        },
      };
      const before = await snapshot(pe.env.owner);
      for (const controls of [accessor, coercion]) {
        const request = reservation(pe.attempt);
        expect(
          await executeProviderCall(
            pool,
            request,
            durableAdapter(pe.env.owner, { lookup: false }),
            finishSucceeded(request.provider_call_id),
            noopContext(),
            controls,
          ),
        ).toMatchObject({
          status: "rejected",
          result: { code: "provider_controls_invalid" },
        });
      }
      expect(consumed).toBe(0);
      expect(await snapshot(pe.env.owner)).toBe(before);
      expect(await invocationCount(pe.env.owner)).toBe(0);
    });
  }, 120000);

  it("completed recovery ignores missing/disabled controls; historical unfinished/held rows never authorize perform", async () => {
    await scenario(async (pe, pool) => {
      const request = reservation(pe.attempt);
      const adapter = durableAdapter(pe.env.owner, { lookup: true });
      expect(
        (
          await executeProviderCall(
            pool,
            request,
            adapter,
            finishSucceeded(request.provider_call_id),
            noopContext(),
            nonNetworkControls(),
          )
        ).status,
      ).toBe("performed");
      const before = await snapshot(pe.env.owner);
      for (const controls of [
        undefined,
        { ...nonNetworkControls(), GENERATION_KILL_SWITCH: true },
      ])
        expect(
          (
            await executeProviderCall(
              pool,
              request,
              adapter,
              finishSucceeded(request.provider_call_id),
              noopContext(),
              controls,
            )
          ).status,
        ).toBe("completed");
      expect(await snapshot(pe.env.owner)).toBe(before);
      expect(await invocationCount(pe.env.owner)).toBe(1);
      const unfinished = reservation(pe.attempt);
      expect((await reserveProviderCall(pool, unfinished)).kind).toBe(
        "created",
      );
      const pending = await snapshot(pe.env.owner);
      expect(
        await executeProviderCall(
          pool,
          unfinished,
          adapter,
          finishSucceeded(unfinished.provider_call_id),
          noopContext(),
        ),
      ).toMatchObject({
        status: "unfinished",
        reason: "converged_without_outcome",
      });
      expect(
        await executeProviderCall(
          pool,
          { ...unfinished, provider_call_id: randomUUID() },
          adapter,
          finishSucceeded(unfinished.provider_call_id),
          noopContext(),
          nonNetworkControls(),
        ),
      ).toMatchObject({ status: "unfinished", reason: "held_by_other" });
      expect(
        (
          await executeProviderCall(
            pool,
            { ...unfinished, provider: "changed" },
            adapter,
            finishSucceeded(unfinished.provider_call_id),
            noopContext(),
            nonNetworkControls(),
          )
        ).status,
      ).toBe("conflict");
      expect(await snapshot(pe.env.owner)).toBe(pending);
      expect(await invocationCount(pe.env.owner)).toBe(1);
    });
  }, 120000);

  it.each(["resolve", "reject"])(
    "actual elapsed timeout consumes late %s with no outcome/SQL/unhandled rejection",
    async (kind) => {
      await scenario(async (pe, pool) => {
        const request = reservation(pe.attempt);
        const adapter = durableAdapter(pe.env.owner, { lookup: true });
        let completed = false;
        let finishCalls = 0;
        let sqlCount = 0;
        const observedPool = instrumentPool(pool, async (_text, native) => {
          sqlCount++;
          return native();
        });
        const unhandled: unknown[] = [];
        const onUnhandled = (error: unknown) => {
          unhandled.push(error);
        };
        process.on("unhandledRejection", onUnhandled);
        const protectedBefore = await snapshot(pe.env.owner, false);
        try {
          const start = performance.now();
          const result = await executeProviderCall(
            observedPool,
            request,
            {
              ...adapter,
              async perform(req) {
                const value = await adapter.perform(req);
                await sleep(90);
                completed = true;
                if (kind === "reject") throw new Error("LATE_PROVIDER_CANARY");
                return value;
              },
            },
            (value) => {
              finishCalls++;
              return finishSucceeded(request.provider_call_id)(value);
            },
            noopContext(),
            nonNetworkControls({ PROVIDER_CALL_TIMEOUT_MS: 20 }),
          );
          expect(performance.now() - start).toBeGreaterThanOrEqual(20);
          expect(result).toMatchObject({
            status: "ambiguous",
            code: "provider_observation_timeout",
          });
          expect(await invocationCount(pe.env.owner)).toBe(1);
          const timedOut = await snapshot(pe.env.owner);
          const queriesAtTimeout = sqlCount;
          await sleep(150);
          expect(sqlCount).toBe(queriesAtTimeout);
          expect(completed).toBe(true);
          expect(finishCalls).toBe(0);
          expect(unhandled).toEqual([]);
          expect(await snapshot(pe.env.owner)).toBe(timedOut);
          expect(await snapshot(pe.env.owner, false)).toBe(protectedBefore);
          expect(
            (await lookupProviderCall(pool, request.provider_call_id))?.outcome,
          ).toBeNull();
          expect(
            (
              await executeProviderCall(
                pool,
                request,
                adapter,
                finishSucceeded(request.provider_call_id),
                noopContext(),
                nonNetworkControls(),
              )
            ).status,
          ).toBe("unfinished");
          expect(await invocationCount(pe.env.owner)).toBe(1);
          expect(JSON.stringify(result)).not.toContain("CANARY");
          expect(
            (
              await reconcileProviderCall(
                pool,
                {
                  providerCallId: request.provider_call_id,
                  adapter,
                  finish: finishSucceeded(request.provider_call_id),
                },
                noopContext(),
              )
            ).status,
          ).toBe("performed");
          expect(await pe.events()).toBe(1);
          expect(await invocationCount(pe.env.owner)).toBe(1);
        } finally {
          process.off("unhandledRejection", onUnhandled);
        }
      });
    },
    120000,
  );

  it.each(["resolve", "reject"])(
    "returns timeout while durable perform remains explicitly gated, then consumes late %s without any DB entry",
    async (kind) => {
      await scenario(async (pe, pool) => {
        const request = reservation(pe.attempt);
        const adapter = durableAdapter(pe.env.owner, { lookup: true });
        const counts = { connect: 0, clientQuery: 0, poolQuery: 0 };
        const observedPool = instrumentPool(
          pool,
          async (_text, native) => native(),
          undefined,
          counts,
        );
        // Positive controls exercise each actual instrumentation boundary.
        await observedPool.query("SELECT 1");
        const client = await observedPool.connect();
        try {
          await client.query("SELECT 1");
        } finally {
          client.release();
        }
        expect(counts).toEqual({ connect: 1, clientQuery: 1, poolQuery: 1 });
        let release: () => void = () => {
          throw new Error("test gate not initialized");
        };
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        let effectObserved: () => void = () => {
          throw new Error("test gate not initialized");
        };
        const effect = new Promise<void>((resolve) => {
          effectObserved = resolve;
        });
        let lateObserved: () => void = () => {
          throw new Error("test gate not initialized");
        };
        const late = new Promise<void>((resolve) => {
          lateObserved = resolve;
        });
        let completed = false;
        let finishes = 0;
        const unhandled: unknown[] = [];
        const onUnhandled = (error: unknown) => {
          unhandled.push(error);
        };
        process.on("unhandledRejection", onUnhandled);
        let watchdog: ReturnType<typeof setTimeout> | undefined;
        const deadline = new Promise<never>((_resolve, reject) => {
          watchdog = setTimeout(() => {
            reject(new Error("owned pending-gate watchdog"));
          }, 5000);
        });
        const protectedBefore = await snapshot(pe.env.owner, false);
        try {
          const invocation = executeProviderCall(
            observedPool,
            request,
            {
              async perform(req) {
                const value = await adapter.perform(req);
                effectObserved();
                await gate; // Ignores abort; only this test can release the provider.
                completed = true;
                lateObserved();
                if (kind === "reject")
                  throw new Error("GATED_LATE_PROVIDER_CANARY");
                return value;
              },
            },
            (value) => {
              finishes++;
              return finishSucceeded(request.provider_call_id)(value);
            },
            noopContext(),
            nonNetworkControls({ PROVIDER_CALL_TIMEOUT_MS: 500 }),
          );
          await Promise.race([effect, deadline]);
          expect(await invocationCount(pe.env.owner)).toBe(1);
          const result = await Promise.race([invocation, deadline]);
          expect(result).toMatchObject({
            status: "ambiguous",
            code: "provider_observation_timeout",
          });
          // These assertions happen BEFORE release: elapsed rejection after completion cannot pass.
          expect(completed).toBe(false);
          expect(finishes).toBe(0);
          expect(await pe.events()).toBe(0);
          const countsAtTimeout = { ...counts };
          const timedOut = await snapshot(pe.env.owner);
          expect(await snapshot(pe.env.owner, false)).toBe(protectedBefore);
          release();
          await Promise.race([late, deadline]);
          await sleep(30); // Allow the execution handler to consume the returned value/rejection.
          expect(completed).toBe(true);
          expect(finishes).toBe(0);
          expect(counts).toEqual(countsAtTimeout);
          expect(unhandled).toEqual([]);
          expect(await pe.events()).toBe(0);
          expect(await snapshot(pe.env.owner)).toBe(timedOut);
          expect(JSON.stringify(result)).not.toContain("CANARY");
        } finally {
          release();
          if (watchdog) clearTimeout(watchdog);
          process.off("unhandledRejection", onUnhandled);
        }
      });
    },
    120000,
  );

  it("cooperative abort consumes adapter rejection without inventing a terminal event", async () => {
    await scenario(async (pe, pool) => {
      const request = reservation(pe.attempt);
      const adapter = durableAdapter(pe.env.owner, { lookup: true });
      let cooperativeAborted = false;
      const result = await executeProviderCall(
        pool,
        request,
        {
          async perform(req, signal) {
            await adapter.perform(req);
            if (!signal) throw new Error("test requires cooperative signal");
            return new Promise<never>((_resolve, reject) => {
              signal.addEventListener(
                "abort",
                () => {
                  cooperativeAborted = true;
                  reject(new Error("COOPERATIVE_CANARY"));
                },
                { once: true },
              );
            });
          },
        },
        finishSucceeded(request.provider_call_id),
        noopContext(),
        nonNetworkControls({ PROVIDER_CALL_TIMEOUT_MS: 30 }),
      );
      expect(result).toMatchObject({
        status: "ambiguous",
        code: "provider_observation_timeout",
      });
      expect(cooperativeAborted).toBe(true);
      await sleep(30);
      expect(await pe.events()).toBe(0);
      expect(await invocationCount(pe.env.owner)).toBe(1);
      expect(JSON.stringify(result)).not.toContain("CANARY");
    });
  }, 120000);

  it("checks monotonic elapsed completion even when a synchronous adapter blocks the timer callback", async () => {
    await scenario(async (pe, pool) => {
      const request = reservation(pe.attempt);
      let finishes = 0;
      let notAbortedBeforeBlock = false;
      let blocked = false;
      const adapter = durableAdapter(pe.env.owner, { lookup: true });
      const result = await executeProviderCall(
        pool,
        request,
        {
          async perform(req, signal) {
            const value = await adapter.perform(req);
            notAbortedBeforeBlock = signal?.aborted === false;
            const end = performance.now() + 130;
            while (performance.now() < end) {
              /* deliberate test-only event-loop blocking */
            }
            blocked = true;
            return value;
          },
        },
        (value) => {
          finishes++;
          return finishSucceeded(request.provider_call_id)(value);
        },
        noopContext(),
        nonNetworkControls({ PROVIDER_CALL_TIMEOUT_MS: 100 }),
      );
      expect(result).toMatchObject({
        status: "ambiguous",
        code: "provider_observation_timeout",
      });
      expect(finishes).toBe(0);
      expect(notAbortedBeforeBlock).toBe(true);
      expect(blocked).toBe(true);
      expect(await invocationCount(pe.env.owner)).toBe(1);
      expect(await pe.events()).toBe(0);
    });
  }, 120000);

  it.each([
    "before_insert",
    "uncommitted",
    "after_commit",
    "during_perform",
    "after_effect",
  ])(
    "cancellation at %s retains actual DB truth",
    async (point) => {
      await scenario(async (pe, pool) => {
        const signal = new AbortController();
        const request = reservation(pe.attempt);
        const before = await snapshot(pe.env.owner);
        const protectedBefore = await snapshot(pe.env.owner, false);
        const adapter = durableAdapter(pe.env.owner, { lookup: true });
        let abortedSignal = false;
        if (point === "before_insert") signal.abort();
        process.env.DESK_TEST_FAULTS = "1";
        (globalThis as Record<symbol, unknown>)[hook] = (name: string) => {
          if (
            (point === "uncommitted" &&
              name === "reservation_inserted_uncommitted") ||
            (point === "after_commit" && name === "after_reservation_commit") ||
            (point === "after_effect" && name === "after_side_effect")
          )
            signal.abort();
        };
        const result = await executeProviderCall(
          pool,
          request,
          {
            async perform(req, cooperative) {
              const value = await adapter.perform(req);
              if (point === "during_perform") {
                signal.abort();
                abortedSignal = cooperative?.aborted === true;
                await sleep(20);
              }
              return value;
            },
          },
          finishSucceeded(request.provider_call_id),
          noopContext(),
          nonNetworkControls({ signal: signal.signal }),
        );
        if (point === "before_insert" || point === "uncommitted") {
          expect(result).toMatchObject({
            status: "rejected",
            result: { code: "provider_execution_canceled" },
          });
          expect(await snapshot(pe.env.owner)).toBe(before);
        } else if (point === "after_commit") {
          expect(result).toMatchObject({
            status: "unfinished",
            reason: "provider_not_invoked_canceled",
          });
          expect(await pe.providerCalls()).toBe(1);
        } else {
          expect(result).toMatchObject({
            status: "ambiguous",
            code: "provider_observation_canceled",
          });
          expect(abortedSignal).toBe(point === "during_perform");
          await sleep(50);
        }
        if (
          ["after_commit", "during_perform", "after_effect"].includes(point)
        ) {
          const stored = await pe.env.owner.query(
            `SELECT provider_call_id::text, attempt_id::text, provider, operation,
              model_identifier, request_fingerprint, logical_request_key, operational_try_number,
              intentional_take_index, retry_of_provider_call_id::text, reroll_of_provider_call_id::text,
              reroll_trigger_id::text,
              to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS started_at
             FROM provider_calls WHERE provider_call_id=$1::uuid`,
            [request.provider_call_id],
          );
          expect(stored.rows).toEqual([request]);
          expect(result).toMatchObject({ reservation: request });
        }
        expect(await pe.events()).toBe(0);
        expect(await invocationCount(pe.env.owner)).toBe(
          point === "during_perform" || point === "after_effect" ? 1 : 0,
        );
        expect(await snapshot(pe.env.owner, false)).toBe(protectedBefore);
      });
    },
    120000,
  );

  it("finish accessors cannot redirect recording to a different call; plain positive receipt retains canonical fields", async () => {
    await scenario(async (pe, pool) => {
      const first = reservation(pe.attempt);
      const other = reservation(pe.attempt);
      expect((await reserveProviderCall(pool, other)).kind).toBe("created");
      const adapter = durableAdapter(pe.env.owner, { lookup: true });
      let getters = 0;
      const context = capturingContext();
      const result = await executeProviderCall(
        pool,
        first,
        adapter,
        (value) => ({
          ...finishSucceeded(first.provider_call_id)(value),
          get provider_call_id() {
            getters++;
            if (getters > 1) throw new Error("BINDING_CANARY");
            return other.provider_call_id;
          },
        }),
        context.context,
        nonNetworkControls(),
      );
      expect(result).toMatchObject({
        status: "ambiguous",
        code: "provider_finish_ambiguous",
      });
      expect(getters).toBe(0);
      expect(await pe.events()).toBe(0);
      expect(
        (await lookupProviderCall(pool, other.provider_call_id))?.outcome,
      ).toBeNull();
      expect(
        context.events.find((e) => e.workflow === "provider_call.execute"),
      ).toMatchObject({
        perform: "performed",
        outcome_record: "not_attempted",
      });
      expect(
        JSON.stringify(result) + JSON.stringify(context.events),
      ).not.toContain("CANARY");
      const normal = reservation(pe.attempt);
      const positive = await executeProviderCall(
        pool,
        normal,
        adapter,
        (value) => ({
          ...finishSucceeded(normal.provider_call_id)(value),
          actual_cost: "1.5000",
          response_reference: "canonical-internal-reference",
          usage: { exact: "kept" },
        }),
        noopContext(),
        nonNetworkControls(),
      );
      expect(positive).toMatchObject({
        status: "performed",
        outcome: {
          kind: "created",
          record: {
            actual_cost: "1.5000",
            usage: { exact: "kept" },
            response_reference: "canonical-internal-reference",
          },
        },
      });
    });
  }, 120000);

  it("takes one stable caller reservation/controls snapshot and never rereads original properties", async () => {
    await scenario(async (pe, pool) => {
      const request = reservation(pe.attempt);
      const expected = { ...request };
      let reads = 0;
      const caller = new Proxy(request, {
        get() {
          reads++;
          throw new Error("REREAD_CANARY");
        },
      });
      const controls = nonNetworkControls();
      process.env.DESK_TEST_FAULTS = "1";
      (globalThis as Record<symbol, unknown>)[hook] = (point: string) => {
        if (point === "after_reservation_commit") {
          request.provider_call_id = randomUUID();
          controls.PROVIDER_CALL_TIMEOUT_MS = 0;
        }
      };
      const context = capturingContext();
      expect(
        (
          await executeProviderCall(
            pool,
            caller,
            durableAdapter(pe.env.owner, { lookup: true }),
            finishSucceeded(expected.provider_call_id),
            context.context,
            controls,
          )
        ).status,
      ).toBe("performed");
      expect(reads).toBe(0);
      expect(
        context.events.find((e) => e.workflow === "provider_call.execute")
          ?.provider_call_id,
      ).toBe(expected.provider_call_id);
      expect(
        (await lookupProviderCall(pool, expected.provider_call_id))
          ?.reservation,
      ).toEqual(expected);
      expect(await invocationCount(pe.env.owner)).toBe(1);
    });
  }, 120000);

  it("ordinary observational query failure keeps valid domain behavior", async () => {
    await scenario(async (pe, pool) => {
      let queried = 0;
      const observationalFailure = new Proxy(pool, {
        get(target, key) {
          if (key === "query")
            return () => {
              queried++;
              throw new Error("OBSERVATION_CANARY");
            };
          const value: unknown = Reflect.get(target, key, target);
          return typeof value === "function"
            ? (...args: unknown[]): unknown =>
                Reflect.apply(value, target, args)
            : value;
        },
      });
      const context = capturingContext();
      const request = reservation(pe.attempt);
      expect(
        (
          await executeProviderCall(
            observationalFailure,
            request,
            durableAdapter(pe.env.owner, { lookup: true }),
            finishSucceeded(request.provider_call_id),
            context.context,
            nonNetworkControls(),
          )
        ).status,
      ).toBe("performed");
      expect(queried).toBe(1);
      expect(
        context.events.find((e) => e.workflow === "provider_call.execute")
          ?.run_id_status,
      ).toBe("lookup_failed");
      expect(JSON.stringify(context.events)).not.toContain("CANARY");
      expect(await invocationCount(pe.env.owner)).toBe(1);
    });
  }, 120000);

  it.each(["reserve", "record"])(
    "consumed real SQL %s canary refuses safely with exact protected rows",
    async (stage) => {
      await scenario(async (pe, pool) => {
        const canary = `SQL_PROTECTED_CANARY_${randomUUID()}`;
        const context = capturingContext();
        const before = await snapshot(pe.env.owner, false);
        const request = reservation(pe.attempt);
        let consumed = 0;
        const wrapped = instrumentPool(pool, async (text, native) => {
          if (
            typeof text === "string" &&
            (stage === "reserve"
              ? text.includes("FROM provider_calls c WHERE")
              : text.includes("INSERT INTO provider_call_events"))
          ) {
            consumed++;
            await pe.env.owner.query("SELECT $1::integer", [canary]);
          }
          return native();
        });
        let caught: unknown;
        try {
          await executeProviderCall(
            wrapped,
            request,
            durableAdapter(pe.env.owner, { lookup: true }),
            finishSucceeded(request.provider_call_id),
            context.context,
            nonNetworkControls(),
          );
        } catch (error) {
          caught = error;
        }
        expect(consumed).toBe(1);
        expect(caught).toMatchObject({
          code: "provider_execution_failed",
          stage,
          commit_state: "not_committed",
        });
        expect(caught).not.toHaveProperty("cause");
        expect(caught).not.toHaveProperty("errors");
        expect(
          JSON.stringify(caught) +
            ((caught as Error).stack ?? "") +
            JSON.stringify(context.events),
        ).not.toContain(canary);
        expect(await snapshot(pe.env.owner, false)).toBe(before);
        expect(await pe.events()).toBe(0);
        expect(await pe.providerCalls()).toBe(stage === "reserve" ? 0 : 1);
        expect(await invocationCount(pe.env.owner)).toBe(
          stage === "reserve" ? 0 : 1,
        );
        if (stage === "record")
          expect(caught).toMatchObject({
            reservation_commit_state: "committed",
          });
      });
    },
    120000,
  );

  it.each([
    "release_after_commit",
    "first_error_then_release",
    "unknown_commit",
  ])(
    "cleanup/ack %s cannot be rewritten by a mutating/failing observer",
    async (kind) => {
      await scenario(async (pe, pool) => {
        const request = reservation(pe.attempt);
        let queryFault = false;
        let releaseFault = false;
        const wrapped = instrumentPool(
          pool,
          async (text, native) => {
            if (
              kind === "first_error_then_release" &&
              text === "BEGIN ISOLATION LEVEL READ COMMITTED"
            ) {
              queryFault = true;
              throw new Rejection(
                "provider_execution_disabled",
                "FIRST_CANARY",
              );
            }
            const value = await native();
            if (kind === "unknown_commit" && text === "COMMIT") {
              queryFault = true;
              throw new Error("LOST_ACK_CANARY");
            }
            return value;
          },
          () => {
            if (kind !== "unknown_commit") {
              releaseFault = true;
              throw new Error("RELEASE_CANARY");
            }
          },
        );
        const context = noopContext();
        context.observer = (event) => {
          event.durability = "unknown";
          event.error_class = "Rejection";
          throw new Error("OBSERVER_CANARY");
        };
        let caught: unknown;
        try {
          await executeProviderCall(
            wrapped,
            request,
            durableAdapter(pe.env.owner, { lookup: true }),
            finishSucceeded(request.provider_call_id),
            context,
            nonNetworkControls(),
          );
        } catch (error) {
          caught = error;
        }
        expect(caught).toMatchObject({
          correlation_id: context.correlationId,
          stage: "reserve",
          commit_state:
            kind === "release_after_commit"
              ? "committed"
              : kind === "unknown_commit"
                ? "unknown"
                : "not_committed",
          code:
            kind === "unknown_commit"
              ? "provider_execution_commit_unknown"
              : kind === "first_error_then_release"
                ? "provider_execution_disabled"
                : "provider_execution_failed",
          error_class:
            kind === "first_error_then_release" ? "Rejection" : "unclassified",
        });
        expect(queryFault).toBe(kind !== "release_after_commit");
        expect(releaseFault).toBe(kind !== "unknown_commit");
        expect(caught).not.toHaveProperty("cause");
        expect(
          JSON.stringify(caught) + ((caught as Error).stack ?? ""),
        ).not.toContain("CANARY");
        expect(await pe.providerCalls()).toBe(
          kind === "first_error_then_release" ? 0 : 1,
        );
        expect(await invocationCount(pe.env.owner)).toBe(0);
        expect(await pe.events()).toBe(0);
      });
    },
    120000,
  );

  it("cancellation after callback decision but at COMMIT preserves committed unfinished reservation", async () => {
    await scenario(async (pe, pool) => {
      const control = new AbortController();
      const wrapped = instrumentPool(pool, async (text, native) => {
        if (text === "COMMIT") control.abort();
        return native();
      });
      const request = reservation(pe.attempt);
      expect(
        await executeProviderCall(
          wrapped,
          request,
          durableAdapter(pe.env.owner, { lookup: true }),
          finishSucceeded(request.provider_call_id),
          noopContext(),
          nonNetworkControls({ signal: control.signal }),
        ),
      ).toMatchObject({
        status: "unfinished",
        reason: "provider_not_invoked_canceled",
      });
      expect(await pe.providerCalls()).toBe(1);
      expect(await pe.events()).toBe(0);
      expect(await invocationCount(pe.env.owner)).toBe(0);
    });
  }, 120000);

  it.each(["provider", "finish"])(
    "consumed protected prompt %s error remains an owned ambiguous diagnostic",
    async (stage) => {
      await scenario(async (pe, pool) => {
        const canary = `PROMPT_CONTENT_CANARY_${randomUUID()}`;
        const manifest = randomUUID();
        const artifact = randomUUID();
        const payload = { g1_synthetic_test_prompt: canary };
        await pe.env.owner.query(
          "INSERT INTO artifacts(artifact_id,artifact_type,schema_version,content_hash,canonical_payload) VALUES($1,'g1_a_test_prompt','g1-a-test-only/1',$2,$3)",
          [
            artifact,
            createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
            payload,
          ],
        );
        await pe.env.owner.query(
          "INSERT INTO prompt_manifests(prompt_manifest_id,component_versions,rendered_request_hash,policy_source_hashes,artifact_id) VALUES($1,$2,repeat('a',64),'{}',$3)",
          [manifest, payload, artifact],
        );
        expect(
          (
            await pe.env.owner.query<{ value: string }>(
              "SELECT component_versions->>'g1_synthetic_test_prompt' AS value FROM prompt_manifests WHERE prompt_manifest_id=$1",
              [manifest],
            )
          ).rows[0]?.value,
        ).toBe(canary);
        const protectedBefore = await snapshot(pe.env.owner, false);
        const request = reservation(pe.attempt);
        const context = capturingContext();
        const adapter = durableAdapter(pe.env.owner, { lookup: true });
        let consumed = 0;
        let messageReads = 0;
        const protectedError = (content: string) => {
          const error = new Error(content);
          Object.defineProperty(error, "message", {
            get() {
              messageReads++;
              throw new Error(canary);
            },
          });
          return error;
        };
        const result = await executeProviderCall(
          pool,
          request,
          {
            async perform(req) {
              const value = await adapter.perform(req);
              const row = await pe.env.owner.query<{ value: string }>(
                "SELECT component_versions->>'g1_synthetic_test_prompt' AS value FROM prompt_manifests WHERE prompt_manifest_id=$1",
                [manifest],
              );
              const content = row.rows[0]?.value;
              if (content !== canary)
                throw new Error("protected test setup mismatch");
              if (stage === "provider") {
                consumed++;
                throw protectedError(content);
              }
              return { ...value, protectedContent: content };
            },
          },
          (value) => {
            if (stage === "finish") {
              consumed++;
              expect(value.protectedContent).toBe(canary);
              throw protectedError(value.protectedContent);
            }
            return finishSucceeded(request.provider_call_id)(value);
          },
          context.context,
          nonNetworkControls(),
        );
        expect(consumed).toBe(1);
        expect(messageReads).toBe(0);
        expect(result).toMatchObject({
          status: "ambiguous",
          code:
            stage === "provider"
              ? "provider_perform_ambiguous"
              : "provider_finish_ambiguous",
        });
        expect(
          JSON.stringify(result) + JSON.stringify(context.events),
        ).not.toContain(canary);
        expect(await snapshot(pe.env.owner, false)).toBe(protectedBefore);
        expect(await pe.events()).toBe(0);
        expect(await invocationCount(pe.env.owner)).toBe(1);
      });
    },
    120000,
  );

  it.each(["cancel", "failure_then_cancel"])(
    "finish phase %s leaves zero record attempts and preserves the first diagnostic",
    async (kind) => {
      await scenario(async (pe, pool) => {
        const control = new AbortController();
        const request = reservation(pe.attempt);
        const protectedBefore = await snapshot(pe.env.owner, false);
        const context = capturingContext();
        const result = await executeProviderCall(
          pool,
          request,
          durableAdapter(pe.env.owner, { lookup: true }),
          (value) => {
            if (kind === "failure_then_cancel") {
              try {
                throw new Error("FIRST_FINISH_CANARY");
              } finally {
                control.abort();
              }
            }
            control.abort();
            return finishSucceeded(request.provider_call_id)(value);
          },
          context.context,
          nonNetworkControls({ signal: control.signal }),
        );
        expect(result).toMatchObject({
          status: "ambiguous",
          code:
            kind === "cancel"
              ? "provider_observation_canceled"
              : "provider_finish_ambiguous",
        });
        expect(
          context.events.find((e) => e.workflow === "provider_call.execute"),
        ).toMatchObject({
          perform: "performed",
          outcome_record: "not_attempted",
        });
        expect(
          context.events.filter((e) => e.command === "provider_outcome.record"),
        ).toEqual([]);
        expect(
          JSON.stringify(result) + JSON.stringify(context.events),
        ).not.toContain("CANARY");
        expect(await pe.providerCalls()).toBe(1);
        expect(await pe.events()).toBe(0);
        expect(await invocationCount(pe.env.owner)).toBe(1);
        expect(await snapshot(pe.env.owner, false)).toBe(protectedBefore);
      });
    },
    120000,
  );

  it.each(["acknowledged", "lost_ack"])(
    "cancellation during record %s retains actual committed outcome truth",
    async (kind) => {
      await scenario(async (pe, pool) => {
        const control = new AbortController();
        const request = reservation(pe.attempt);
        const protectedBefore = await snapshot(pe.env.owner, false);
        let commits = 0;
        let enteredRecord = 0;
        const wrapped = instrumentPool(pool, async (text, native) => {
          if (
            typeof text === "string" &&
            text.includes("INSERT INTO provider_call_events")
          ) {
            enteredRecord++;
            control.abort();
          }
          const result = await native();
          if (text === "COMMIT" && ++commits === 2 && kind === "lost_ack")
            throw new Error("RECORD_ACK_CANARY");
          return result;
        });
        const context = capturingContext();
        if (kind === "acknowledged") {
          expect(
            await executeProviderCall(
              wrapped,
              request,
              durableAdapter(pe.env.owner, { lookup: true }),
              finishSucceeded(request.provider_call_id),
              context.context,
              nonNetworkControls({ signal: control.signal }),
            ),
          ).toMatchObject({
            status: "performed",
            outcome: { kind: "created" },
          });
          expect(
            context.events.find((e) => e.command === "provider_outcome.record"),
          ).toMatchObject({ durability: "committed", outcome: "created" });
        } else {
          let caught: unknown;
          try {
            await executeProviderCall(
              wrapped,
              request,
              durableAdapter(pe.env.owner, { lookup: true }),
              finishSucceeded(request.provider_call_id),
              context.context,
              nonNetworkControls({ signal: control.signal }),
            );
          } catch (error) {
            caught = error;
          }
          expect(caught).toMatchObject({
            code: "provider_execution_commit_unknown",
            stage: "record",
            commit_state: "unknown",
            reservation_commit_state: "committed",
          });
          expect(JSON.stringify(caught)).not.toContain("CANARY");
          expect(
            context.events.find((e) => e.command === "provider_outcome.record"),
          ).toMatchObject({ durability: "unknown" });
        }
        expect(enteredRecord).toBe(1);
        expect(control.signal.aborted).toBe(true);
        expect(await pe.events()).toBe(1);
        expect(await invocationCount(pe.env.owner)).toBe(1);
        expect(await snapshot(pe.env.owner, false)).toBe(protectedBefore);
        const committed = await snapshot(pe.env.owner);
        expect(
          (
            await executeProviderCall(
              pool,
              request,
              durableAdapter(pe.env.owner, { lookup: true }),
              finishSucceeded(request.provider_call_id),
              noopContext(),
            )
          ).status,
        ).toBe("completed");
        expect(await snapshot(pe.env.owner)).toBe(committed);
        expect(await invocationCount(pe.env.owner)).toBe(1);
      });
    },
    120000,
  );

  it("finite observation timer lets a child return timeout after owned DB/IPC handles close", async () => {
    await scenario(async (pe) => {
      const request = reservation(pe.attempt);
      const child = g1Child({
        runtimeUrl: pe.env.runtimeUrl,
        ownerUrl: pe.ownerUrl,
        reservation: request,
        tag: `g1_timer_${randomUUID().slice(0, 8)}`,
        neverReturn: true,
        timeoutMs: 100,
      });
      try {
        const result = await child.exited();
        expect(result.code).toBe(0);
        expect(result.signal).toBeNull();
        expect(result.stdout).toContain(
          '"code":"provider_observation_timeout"',
        );
        expect(await invocationCount(pe.env.owner)).toBe(1);
        expect(await pe.events()).toBe(0);
      } finally {
        await child.kill();
      }
    });
  }, 120000);

  it.each([
    "after_reservation_commit",
    "after_commit_before_return",
    "after_side_effect",
    "after_outcome_commit",
  ])(
    "real child SIGKILL at %s preserves creator-only recovery",
    async (fault) => {
      await scenario(async (pe, pool) => {
        const request = reservation(pe.attempt);
        const child = g1Child({
          runtimeUrl: pe.env.runtimeUrl,
          ownerUrl: pe.ownerUrl,
          reservation: request,
          tag: `g1_kill_${randomUUID().slice(0, 8)}`,
          fault,
        });
        try {
          await child.held();
          expect(await pe.providerCalls()).toBe(1);
          const completed = fault === "after_outcome_commit";
          const effected = completed || fault === "after_side_effect";
          expect(await invocationCount(pe.env.owner)).toBe(effected ? 1 : 0);
          expect(await pe.events()).toBe(completed ? 1 : 0);
          const before = await snapshot(pe.env.owner);
          const killed = await child.kill();
          expect(killed.code).toBeNull();
          expect(killed.signal).toBe("SIGKILL");
          const result = await executeProviderCall(
            pool,
            request,
            durableAdapter(pe.env.owner, { lookup: true }),
            finishSucceeded(request.provider_call_id),
            noopContext(),
            nonNetworkControls(),
          );
          expect(result.status).toBe(completed ? "completed" : "unfinished");
          expect(await snapshot(pe.env.owner)).toBe(before);
          expect(await invocationCount(pe.env.owner)).toBe(effected ? 1 : 0);
        } finally {
          await child.kill();
        }
      });
    },
    120000,
  );

  it.each(["winner_commit", "winner_rollback"])(
    "two real children observe exact D installation arbitration and %s",
    async (kind) => {
      await scenario(async (pe) => {
        const request = reservation(pe.attempt);
        const protectedBefore = await snapshot(pe.env.owner, false);
        const holderTag = `g1_holder_${randomUUID().slice(0, 8)}`;
        const holder = g1Child({
          runtimeUrl: pe.env.runtimeUrl,
          ownerUrl: pe.ownerUrl,
          reservation: request,
          tag: holderTag,
          fault: "reservation_inserted_uncommitted",
        });
        let waiter: ReturnType<typeof g1Child> | undefined;
        try {
          await holder.held();
          const holding = await pe.env.owner.query<{ pid: number }>(
            D_HOLDER_SQL,
            [pe.env.name, holderTag],
          );
          expect(holding.rowCount).toBe(1);
          const holderPid = holding.rows[0]?.pid;
          if (holderPid === undefined)
            throw new Error("expected D holder missing");
          expect(await pe.providerCalls()).toBe(0); // The holder's inserted row is not yet committed.
          const tag = `g1_waiter_${randomUUID().slice(0, 8)}`;
          waiter = g1Child({
            runtimeUrl: pe.env.runtimeUrl,
            ownerUrl: pe.ownerUrl,
            reservation: { ...request, provider_call_id: randomUUID() },
            tag,
          });
          await observe(
            async () =>
              (
                await pe.env.owner.query(D_WAITER_SQL, [
                  pe.env.name,
                  [tag],
                  holderPid,
                ])
              ).rowCount === 1,
            "G1 child exact D installation arbitration behind the named uncommitted holder",
          );
          const waiting = await pe.env.owner.query<{
            pid: number;
            application_name: string;
            blockers: number[];
          }>(D_WAITER_SQL, [pe.env.name, [tag], holderPid]);
          expect(waiting.rowCount).toBe(1);
          expect(waiting.rows[0]?.application_name).toBe(tag);
          expect(waiting.rows[0]?.blockers).toContain(holderPid);
          expect(waiting.rows[0]?.pid).not.toBe(holderPid);
          expect(waiting.rows[0]?.pid).toBeGreaterThan(0);

          if (kind === "winner_rollback") {
            const killed = await holder.kill();
            expect(killed).toMatchObject({ code: null, signal: "SIGKILL" });
            const result = await waiter.exited();
            expect(result.code).toBe(0);
            expect(result.signal).toBeNull();
            expect(result.stdout).toContain('"status":"performed"');
            expect(await pe.providerCalls()).toBe(1);
            expect(await pe.events()).toBe(1);
            expect(await invocationCount(pe.env.owner)).toBe(1);
          } else {
            holder.release();
            expect((await holder.exited()).code).toBe(0);
            const result = await waiter.exited();
            expect(result.code).toBe(0);
            expect(result.stdout).toMatch(/"status":"(unfinished|completed)"/);
            expect(await invocationCount(pe.env.owner)).toBe(1);
            expect(await pe.events()).toBe(1);
          }
          expect(await snapshot(pe.env.owner, false)).toBe(protectedBefore);
        } finally {
          await holder.kill();
          if (waiter) await waiter.kill();
        }
      });
    },
    120000,
  );
});
