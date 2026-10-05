// A5.2 provider commands: reservation / outcome / reconcile / execute semantics on disposable PostgreSQL 17 (desk_runtime role,
// independent single-connection pools). Concurrency and crash proofs are in a5-2-provider-concurrency.test.ts.
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  lookupProviderCall,
  recordProviderOutcome,
  reserveProviderCall,
  type AuthoredReservation,
} from "../../src/runtime/provider.js";
import { TestCluster } from "../support/db-env.js";
import {
  durableAdapter,
  finishSucceeded,
  hex,
  invocationCount,
  outcome,
  providerEnv,
  reservation,
  STARTED,
  type ProviderEnv,
} from "../support/a5-provider.js";
import { accountIds } from "../support/a5-fixture.js";
import { within } from "../support/pg-wait.js";
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
const must = <T>(v: T | undefined | null): T => {
  if (v === undefined || v === null) throw new Error("missing");
  return v;
};

suite(
  "A5.2 reservation (P&R 25-27, Foundation UNIQUE(logical_request_key, try))",
  () => {
    it("created, then an identical retry converges on the STORED row; microsecond started_at survives", async () => {
      const pool = pe.runtime();
      const r = reservation(pe.attempt, {
        started_at: "2026-01-01T00:00:00.123456Z",
      });
      const before = await pe.providerCalls();
      const a = await reserveProviderCall(pool, r);
      expect(a.kind).toBe("created");
      const b = await reserveProviderCall(pool, r);
      expect(b.kind).toBe("converged");
      if (a.kind === "created" && b.kind === "converged") {
        expect(b.record.reservation).toEqual(a.record.reservation);
        expect(b.record.reservation.started_at).toBe(
          "2026-01-01T00:00:00.123456Z",
        );
        expect(b.record.outcome).toBeNull();
      }
      expect(await pe.providerCalls()).toBe(before + 1);
    });

    it("an offset spelling of the SAME instant converges (SQL timestamptz equality, not a string comparison)", async () => {
      const pool = pe.runtime();
      const r = reservation(pe.attempt);
      expect((await reserveProviderCall(pool, r)).kind).toBe("created");
      const same = await reserveProviderCall(pool, {
        ...r,
        started_at: "2026-01-01T01:00:00.000000+01:00",
      });
      expect(same.kind).toBe("converged");
    });

    const changes: [
      keyof AuthoredReservation,
      (r: AuthoredReservation) => unknown,
    ][] = [
      ["attempt_id", () => pe.otherAttempt],
      ["provider", () => "other_provider"],
      ["operation", () => "other_operation"],
      ["model_identifier", () => "other-model"],
      ["request_fingerprint", () => hex("different")],
      ["logical_request_key", () => "a-different-key"],
      ["operational_try_number", () => 2],
      ["intentional_take_index", () => 0],
      ["retry_of_provider_call_id", () => randomUUID()],
      ["reroll_of_provider_call_id", () => randomUUID()],
      ["reroll_trigger_id", () => randomUUID()],
      ["started_at", () => "2026-01-01T00:00:00.000001Z"],
    ];
    it.each(changes)(
      "same authored id with a changed %s is a conflict and writes nothing",
      async (field, change) => {
        const pool = pe.runtime();
        const r = reservation(pe.attempt);
        expect((await reserveProviderCall(pool, r)).kind).toBe("created");
        const before = await pe.providerCalls();
        const o = await reserveProviderCall(pool, {
          ...r,
          [field]: change(r),
        });
        expect(o.kind).toBe("conflict");
        if (o.kind === "conflict") {
          expect(o.code).toBe("reservation_fields_differ");
          expect(o.detail).toContain(field);
        }
        expect(await pe.providerCalls()).toBe(before);
      },
    );

    it("a different authored id at an existing (key, try) is held_by_other, with the holder's durable outcome when there is one", async () => {
      const pool = pe.runtime();
      const r = reservation(pe.attempt);
      expect((await reserveProviderCall(pool, r)).kind).toBe("created");
      const rival = { ...r, provider_call_id: randomUUID() };
      const held = await reserveProviderCall(pool, rival);
      expect(held.kind).toBe("held_by_other");
      if (held.kind === "held_by_other") {
        expect(held.record.reservation.provider_call_id).toBe(
          r.provider_call_id,
        );
        expect(held.record.outcome).toBeNull();
      }
      expect(
        (await recordProviderOutcome(pool, outcome(r.provider_call_id))).kind,
      ).toBe("created");
      const heldWithOutcome = await reserveProviderCall(pool, rival);
      expect(heldWithOutcome.kind).toBe("held_by_other");
      if (heldWithOutcome.kind === "held_by_other")
        expect(heldWithOutcome.record.outcome?.event_type).toBe("succeeded");
      expect(
        (
          await pe.rows(
            "SELECT 1 FROM provider_calls WHERE provider_call_id = $1",
            [rival.provider_call_id],
          )
        ).length,
      ).toBe(0);
    });

    it("the same authored id at a DIFFERENT (key, try) than stored is a conflict, not a second reservation", async () => {
      const pool = pe.runtime();
      const r = reservation(pe.attempt);
      expect((await reserveProviderCall(pool, r)).kind).toBe("created");
      const moved = await reserveProviderCall(pool, {
        ...r,
        logical_request_key: "another-slot",
      });
      expect(moved.kind).toBe("conflict");
    });

    it("rejects malformed requests before any database work", async () => {
      const never = {
        connect: () => {
          throw new Error("must not connect");
        },
      } as never;
      const ok = reservation(pe.attempt);
      const cases: [Partial<AuthoredReservation>, string][] = [
        [{ provider_call_id: "nope" }, "invalid_uuid"],
        [{ request_fingerprint: "xyz" }, "invalid_hash"],
        [{ logical_request_key: "" }, "invalid_string"],
        [{ operational_try_number: 0 }, "invalid_integer"],
        [{ operational_try_number: 1.5 }, "invalid_integer"],
        [{ intentional_take_index: -1 }, "invalid_integer"],
        [{ started_at: "2026-01-01T00:00:00.1234567Z" }, "timestamp_precision"],
        [{ started_at: "2026-01-01 00:00:00" }, "invalid_timestamp"],
        [{ started_at: "2026-02-30T00:00:00Z" }, "invalid_timestamp"],
      ];
      for (const [over, code] of cases) {
        const o = await reserveProviderCall(never, { ...ok, ...over });
        expect(o).toMatchObject({ kind: "rejected", code });
      }
    });

    it("unknown attempt / nonexistent retry target are rejected by the database, nothing written", async () => {
      const pool = pe.runtime();
      const before = await pe.providerCalls();
      const a = await reserveProviderCall(pool, reservation(randomUUID()));
      expect(a).toMatchObject({ kind: "rejected", sqlstate: "23503" });
      const b = await reserveProviderCall(
        pool,
        reservation(pe.attempt, {
          operational_try_number: 2,
          retry_of_provider_call_id: randomUUID(),
        }),
      );
      expect(b.kind).toBe("rejected");
      expect(await pe.providerCalls()).toBe(before);
    });
  },
);

suite("A5.2 outcome (one event per call; costs are exact decimal text)", () => {
  const reserved = async (): Promise<AuthoredReservation> => {
    const r = reservation(pe.attempt);
    expect((await reserveProviderCall(pe.runtime(), r)).kind).toBe("created");
    return r;
  };

  it("created, identical retry converged, every changed field conflicts, one event per call", async () => {
    const pool = pe.runtime();
    const r = await reserved();
    const o = outcome(r.provider_call_id, {
      ended_at: "2026-01-01T00:00:01.654321Z",
      usage: { tokens: 3, nested: { b: 1, a: 2 } },
      response_reference: "ref",
    });
    expect((await recordProviderOutcome(pool, o)).kind).toBe("created");
    expect(
      (
        await recordProviderOutcome(pool, {
          ...o,
          usage: { nested: { a: 2, b: 1 }, tokens: 3 },
        })
      ).kind,
    ).toBe("converged");
    const art = randomUUID();
    await pe.rows(
      "INSERT INTO artifacts (artifact_id, artifact_type, schema_version, content_hash) VALUES ($1, 'technical_validation', 'test', $2)",
      [art, hex(art)],
    );
    const diffs: Partial<typeof o>[] = [
      { event_type: "terminal_failure" },
      { event_type: "retryable_failure" },
      { ended_at: "2026-01-01T00:00:01.654322Z" },
      { usage: { tokens: 4 } },
      { actual_cost: "0.0124" },
      { actual_cost: null, currency: null },
      { currency: "EUR" },
      { response_artifact_id: art },
      { response_reference: "ref2" },
      { response_reference: null },
    ];
    for (const d of diffs) {
      const c = await recordProviderOutcome(pool, { ...o, ...d });
      expect(c).toMatchObject({ kind: "conflict", code: "outcome_differs" });
    }
    expect(
      await pe.rows(
        "SELECT 1 FROM provider_call_events WHERE provider_call_id = $1",
        [r.provider_call_id],
      ),
    ).toHaveLength(1);
  });

  it("a cost is compared as a NUMERIC value: 1.5 = 1.50, high-precision differences are visible, the stored text is returned", async () => {
    const pool = pe.runtime();
    const r = await reserved();
    const first = await recordProviderOutcome(
      pool,
      outcome(r.provider_call_id, {
        actual_cost: "12345678901234567890.123456789",
      }),
    );
    expect(first).toMatchObject({
      kind: "created",
      record: { actual_cost: "12345678901234567890.123456789" },
    });
    // a JS float would call these equal; the numeric column does not
    expect(
      (
        await recordProviderOutcome(
          pool,
          outcome(r.provider_call_id, {
            actual_cost: "12345678901234567890.123456780",
          }),
        )
      ).kind,
    ).toBe("conflict");
    const r2 = await reserved();
    expect(
      (
        await recordProviderOutcome(
          pool,
          outcome(r2.provider_call_id, { actual_cost: "1.5" }),
        )
      ).kind,
    ).toBe("created");
    const same = await recordProviderOutcome(
      pool,
      outcome(r2.provider_call_id, { actual_cost: "1.50" }),
    );
    expect(same).toMatchObject({
      kind: "converged",
      record: { actual_cost: "1.5" },
    }); // stored text, NOT the request's lexical form
    expect(
      (
        await recordProviderOutcome(
          pool,
          outcome(r2.provider_call_id, { actual_cost: "1.500000000000000001" }),
        )
      ).kind,
    ).toBe("conflict");
  });

  it("rejects lexical forms the contract does not admit, JS numbers and unpaired cost/currency", async () => {
    const pool = pe.runtime();
    const r = await reserved();
    const bad: Partial<ReturnType<typeof outcome>>[] = [
      { actual_cost: "1e2" },
      { actual_cost: "+1" },
      { actual_cost: "-1" },
      { actual_cost: "01" },
      { actual_cost: "1." },
      { actual_cost: ".5" },
      { actual_cost: " 1" },
      { actual_cost: "NaN" },
      { actual_cost: "Infinity" },
      { actual_cost: 0.1 as unknown as string },
      { currency: "usd" },
      { currency: null },
      { actual_cost: null },
      { usage: [] as never },
      { usage: { x: 0.5 } },
      { event_type: "done" as never },
      { ended_at: "2026-01-01T00:00:00.1234567Z" },
    ];
    for (const b of bad) {
      const o = await recordProviderOutcome(
        pool,
        outcome(r.provider_call_id, b),
      );
      expect(o.kind, JSON.stringify(b)).toBe("rejected");
    }
    expect(
      await pe.rows(
        "SELECT 1 FROM provider_call_events WHERE provider_call_id = $1",
        [r.provider_call_id],
      ),
    ).toHaveLength(0);
  });

  it("an outcome before its reservation, or for no reservation, is rejected and nothing is written", async () => {
    const pool = pe.runtime();
    const r = await reserved();
    const early = await recordProviderOutcome(
      pool,
      outcome(r.provider_call_id, { ended_at: "2025-12-31T23:59:59.999999Z" }),
    );
    expect(early).toMatchObject({ kind: "rejected", code: "guard_rejected" });
    expect(
      (await recordProviderOutcome(pool, outcome(randomUUID()))).kind,
    ).toBe("rejected");
    // the exact started_at instant is allowed (ended_at >= started_at)
    expect(
      (
        await recordProviderOutcome(
          pool,
          outcome(r.provider_call_id, { ended_at: STARTED }),
        )
      ).kind,
    ).toBe("created");
  });

  it("two concurrent DIFFERENT outcomes for one call: exactly one is stored, the other conflicts", async () => {
    const r = await reserved();
    const [a, b] = await within(
      Promise.all([
        recordProviderOutcome(
          pe.runtime(),
          outcome(r.provider_call_id, { event_type: "succeeded" }),
        ),
        recordProviderOutcome(
          pe.runtime(),
          outcome(r.provider_call_id, { event_type: "terminal_failure" }),
        ),
      ]),
      30000,
      "concurrent outcome writers",
    );
    expect([a.kind, b.kind].sort()).toEqual(["conflict", "created"]);
    expect(
      await pe.rows(
        "SELECT 1 FROM provider_call_events WHERE provider_call_id = $1",
        [r.provider_call_id],
      ),
    ).toHaveLength(1);
  });
});

suite(
  "A5.2 existing chain legality (operational retry vs intentional take/reroll)",
  () => {
    const tts = (
      n: number,
      fp: string,
      over: Partial<AuthoredReservation> = {},
    ): AuthoredReservation =>
      reservation(pe.attempt, {
        operation: "tts",
        request_fingerprint: `v1:${fp}`,
        logical_request_key: `v1:${fp}:${String(n)}`,
        intentional_take_index: n,
        ...over,
      });
    const reserve = async (r: AuthoredReservation) =>
      reserveProviderCall(pe.runtime(), r);
    const finish = async (
      id: string,
      type: "succeeded" | "retryable_failure" | "terminal_failure",
    ): Promise<void> => {
      expect(
        (
          await recordProviderOutcome(
            pe.runtime(),
            outcome(id, { event_type: type }),
          )
        ).kind,
      ).toBe("created");
    };

    it("retry is legal ONLY after a recorded retryable_failure with unchanged identity; take index stays", async () => {
      const first = reservation(pe.attempt);
      expect((await reserve(first)).kind).toBe("created");
      const retry = (
        over: Partial<AuthoredReservation> = {},
      ): AuthoredReservation =>
        reservation(pe.attempt, {
          request_fingerprint: first.request_fingerprint,
          logical_request_key: first.logical_request_key,
          operational_try_number: 2,
          retry_of_provider_call_id: first.provider_call_id,
          ...over,
        });
      const before = await pe.providerCalls();
      // unfinished call: never an implicit retryable failure
      expect(await reserve(retry())).toMatchObject({
        kind: "rejected",
        code: "guard_rejected",
      });
      await finish(first.provider_call_id, "terminal_failure");
      expect((await reserve(retry())).kind).toBe("rejected");
      expect(await pe.providerCalls()).toBe(before);

      const second = reservation(pe.attempt);
      expect((await reserve(second)).kind).toBe("created");
      await finish(second.provider_call_id, "succeeded");
      expect(
        (
          await reserve({
            ...retry({
              request_fingerprint: second.request_fingerprint,
              logical_request_key: second.logical_request_key,
              retry_of_provider_call_id: second.provider_call_id,
            }),
          })
        ).kind,
      ).toBe("rejected");

      const third = reservation(pe.attempt);
      expect((await reserve(third)).kind).toBe("created");
      await finish(third.provider_call_id, "retryable_failure");
      const mk = (
        over: Partial<AuthoredReservation> = {},
      ): AuthoredReservation =>
        reservation(pe.attempt, {
          request_fingerprint: third.request_fingerprint,
          logical_request_key: third.logical_request_key,
          operational_try_number: 2,
          retry_of_provider_call_id: third.provider_call_id,
          ...over,
        });
      // changed identity on an otherwise legal retry
      for (const bad of [
        { provider: "other" },
        { operation: "other" },
        { model_identifier: "other" },
        { attempt_id: pe.otherAttempt },
      ] as Partial<AuthoredReservation>[])
        expect((await reserve(mk(bad))).kind, JSON.stringify(bad)).toBe(
          "rejected",
        );
      expect((await reserve(mk({ operational_try_number: 3 }))).kind).toBe(
        "rejected",
      ); // skipped a try
      // try 1 at the SAME slot is simply held by the first call; try 1 WITH a retry link at a fresh slot violates the CHECK
      expect((await reserve(mk({ operational_try_number: 1 }))).kind).toBe(
        "held_by_other",
      );
      expect(
        (
          await reserve(
            mk({
              operational_try_number: 1,
              logical_request_key: hex(randomUUID()),
            }),
          )
        ).kind,
      ).toBe("rejected");
      expect(
        (await reserve(mk({ retry_of_provider_call_id: null }))).kind,
      ).toBe("rejected"); // try 2 without retry link
      const legal = mk();
      expect((await reserve(legal)).kind).toBe("created");
      expect((await reserve(legal)).kind).toBe("converged");
      // a second authored id retrying the same prior call holds the same slot
      expect((await reserve(mk())).kind).toBe("held_by_other");
    });

    it("an intentional take index > 0 needs a durable reroll trigger; retry never changes the take index", async () => {
      const fp = hex(randomUUID());
      const take0 = tts(0, fp);
      expect((await reserve(take0)).kind).toBe("created");
      await finish(take0.provider_call_id, "succeeded");
      // new take without trigger
      expect(await reserve(tts(1, fp))).toMatchObject({
        kind: "rejected",
        code: "guard_rejected",
      });
      // trigger created by the database owner (the operator/policy path is outside this tranche)
      const artifact = randomUUID();
      await pe.rows(
        "INSERT INTO artifacts (artifact_id, artifact_type, schema_version, content_hash) VALUES ($1, 'technical_validation', 'test', $2)",
        [artifact, hex(artifact)],
      );
      const trigger = randomUUID();
      await pe.env.migrator.query(
        `INSERT INTO reroll_triggers (reroll_trigger_id, source_provider_call_id, base_request_hash, take_index, trigger_kind, failure_code, policy_version, validation_artifact_id, actor_id)
       VALUES ($1, $2, $3, 1, 'mechanical_failure', 'too_short', 'p1', $4, $5)`,
        [
          trigger,
          take0.provider_call_id,
          `v1:${fp}`,
          artifact,
          must(accountIds()[0]),
        ],
      );
      const rerolled = tts(1, fp, {
        reroll_of_provider_call_id: take0.provider_call_id,
        reroll_trigger_id: trigger,
      });
      // a reroll that disagrees with its durable trigger
      expect(
        (
          await reserve({
            ...rerolled,
            provider_call_id: randomUUID(),
            operation: "tts",
            model_identifier: "other",
          })
        ).kind,
      ).toBe("rejected");
      expect(
        (
          await reserve({
            ...rerolled,
            provider_call_id: randomUUID(),
            intentional_take_index: 2,
            logical_request_key: `v1:${fp}:2`,
          })
        ).kind,
      ).toBe("rejected");
      expect((await reserve(rerolled)).kind).toBe("created");
      expect((await reserve(rerolled)).kind).toBe("converged");
      // take 0 is untouched and its outcome stays single
      expect(
        (await lookupProviderCall(pe.runtime(), take0.provider_call_id))
          ?.outcome?.event_type,
      ).toBe("succeeded");
      // an operational retry of the take-1 call must keep take index 1: changing it is rejected
      await finish(rerolled.provider_call_id, "retryable_failure");
      const retryChangedTake = tts(2, fp, {
        operational_try_number: 2,
        retry_of_provider_call_id: rerolled.provider_call_id,
        logical_request_key: rerolled.logical_request_key,
      });
      expect((await reserve(retryChangedTake)).kind).toBe("rejected");
      const retryOk = tts(1, fp, {
        operational_try_number: 2,
        retry_of_provider_call_id: rerolled.provider_call_id,
        reroll_of_provider_call_id: null,
        reroll_trigger_id: null,
      });
      // an operational retry of a take-1 call is legal and keeps take index 1 (the existing guard demands unchanged identity only)
      expect((await reserve(retryOk)).kind).toBe("created");
    });
  },
);

suite(
  "A5.2 executeObserved safety (only the creating commit may perform)",
  () => {
    const adapter = (over = {}) =>
      durableAdapter(pe.env.owner, { lookup: true, ...over });

    it("created: reserves, performs exactly once, records the outcome; an identical re-run returns the durable outcome without a call", async () => {
      const pool = pe.runtime();
      const r = reservation(pe.attempt);
      const first = await executeObserved(
        pool,
        r,
        adapter(),
        finishSucceeded(r.provider_call_id),
      );
      expect(first.status).toBe("performed");
      expect(await invocationCount(pe.env.owner, r.logical_request_key)).toBe(
        1,
      );
      const again = await executeObserved(
        pool,
        r,
        adapter(),
        finishSucceeded(r.provider_call_id),
      );
      expect(again.status).toBe("completed");
      if (again.status === "completed")
        expect(again.outcome.actual_cost).toBe("0.0123");
      expect(await invocationCount(pe.env.owner, r.logical_request_key)).toBe(
        1,
      );
    });

    it("perform that throws is AMBIGUOUS: nothing recorded, no retryable failure invented, a re-run does not call again", async () => {
      const pool = pe.runtime();
      const r = reservation(pe.attempt);
      const a = await executeObserved(
        pool,
        r,
        adapter({ throwAfterEffect: true }),
        finishSucceeded(r.provider_call_id),
      );
      expect(a).toMatchObject({
        status: "ambiguous",
        code: "provider_perform_ambiguous",
      });
      expect(await pe.events()).toBe(await pe.events());
      expect(
        (await lookupProviderCall(pool, r.provider_call_id))?.outcome,
      ).toBeNull();
      const rerun = await executeObserved(
        pool,
        r,
        adapter(),
        finishSucceeded(r.provider_call_id),
      );
      expect(rerun).toMatchObject({
        status: "unfinished",
        reason: "converged_without_outcome",
      });
      const rival = await executeObserved(
        pool,
        { ...r, provider_call_id: randomUUID() },
        adapter(),
        finishSucceeded(r.provider_call_id),
      );
      expect(rival).toMatchObject({
        status: "unfinished",
        reason: "held_by_other",
      });
      // the unfinished call can neither be retried nor taken over
      expect(
        (
          await reserveProviderCall(
            pool,
            reservation(pe.attempt, {
              request_fingerprint: r.request_fingerprint,
              logical_request_key: r.logical_request_key,
              operational_try_number: 2,
              retry_of_provider_call_id: r.provider_call_id,
            }),
          )
        ).kind,
      ).toBe("rejected");
      expect(await invocationCount(pe.env.owner, r.logical_request_key)).toBe(
        1,
      );
    });

    it("converged-with-no-outcome NEVER grants execution, even with a lookup that says not_performed (blocked recovery issues no call)", async () => {
      const pool = pe.runtime();
      const r = reservation(pe.attempt);
      expect((await reserveProviderCall(pool, r)).kind).toBe("created"); // owner reserved, then 'died' before performing
      for (let i = 0; i < 3; i += 1) {
        const rec = await executeObserved(
          pool,
          r,
          adapter(),
          finishSucceeded(r.provider_call_id),
        );
        expect(rec.status).toBe("unfinished");
      }
      const looked = await reconcileObserved(pool, {
        providerCallId: r.provider_call_id,
        adapter: adapter(),
      });
      expect(looked.status).toBe("not_performed");
      expect(
        (
          await executeObserved(
            pool,
            r,
            adapter(),
            finishSucceeded(r.provider_call_id),
          )
        ).status,
      ).toBe("unfinished");
      expect(await invocationCount(pe.env.owner, r.logical_request_key)).toBe(
        0,
      );
    });

    it("changed fields conflict and rejected requests never call the adapter", async () => {
      const pool = pe.runtime();
      const r = reservation(pe.attempt);
      await executeObserved(
        pool,
        r,
        adapter(),
        finishSucceeded(r.provider_call_id),
      );
      const c = await executeObserved(
        pool,
        { ...r, model_identifier: "x" },
        adapter(),
        finishSucceeded(r.provider_call_id),
      );
      expect(c.status).toBe("conflict");
      const bad = reservation(pe.attempt, { request_fingerprint: "bad" });
      expect(
        (
          await executeObserved(
            pool,
            bad,
            adapter(),
            finishSucceeded(bad.provider_call_id),
          )
        ).status,
      ).toBe("rejected");
      expect(await invocationCount(pe.env.owner, bad.logical_request_key)).toBe(
        0,
      );
      expect(await invocationCount(pe.env.owner, r.logical_request_key)).toBe(
        1,
      );
    });

    it("a finish that disagrees with the reservation is not recorded against another call", async () => {
      const pool = pe.runtime();
      const r = reservation(pe.attempt);
      const res = await executeObserved(
        pool,
        r,
        adapter(),
        finishSucceeded(randomUUID()),
      );
      expect(res).toMatchObject({
        status: "performed",
        outcome: { kind: "rejected", code: "outcome_binding_mismatch" },
      });
      expect(
        (await lookupProviderCall(pool, r.provider_call_id))?.outcome,
      ).toBeNull();
    });
  },
);

suite("A5.2 reconciliation (evidence binding; never performs)", () => {
  const performedButUnrecorded = async (): Promise<AuthoredReservation> => {
    const r = reservation(pe.attempt);
    await executeObserved(
      pe.runtime(),
      r,
      durableAdapter(pe.env.owner, { lookup: true, throwAfterEffect: true }),
      finishSucceeded(r.provider_call_id),
    );
    expect(await invocationCount(pe.env.owner, r.logical_request_key)).toBe(1);
    return r;
  };

  it("bound evidence reports performed; an explicit finish records that existing outcome once (idempotent) and performs nothing", async () => {
    const pool = pe.runtime();
    const r = await performedButUnrecorded();
    const adapter = durableAdapter(pe.env.owner, { lookup: true });
    const plain = await reconcileObserved(pool, {
      providerCallId: r.provider_call_id,
      adapter,
    });
    expect(plain.status).toBe("performed");
    expect(
      (await lookupProviderCall(pool, r.provider_call_id))?.outcome,
    ).toBeNull(); // reconcile alone records nothing
    const rec = await reconcileObserved(pool, {
      providerCallId: r.provider_call_id,
      adapter,
      finish: (res) => finishSucceeded(r.provider_call_id)(res),
    });
    expect(rec).toMatchObject({
      status: "performed",
      recorded: { kind: "created" },
    });
    const again = await reconcileObserved(pool, {
      providerCallId: r.provider_call_id,
      adapter,
      finish: (res) => finishSucceeded(r.provider_call_id)(res),
    });
    expect(again.status).toBe("recorded");
    expect(await invocationCount(pe.env.owner, r.logical_request_key)).toBe(1);
  });

  it("no lookup, failed lookup, mismatched evidence and not_performed all leave the reservation unfinished", async () => {
    const pool = pe.runtime();
    const r = await performedButUnrecorded();
    expect(
      await reconcileObserved(pool, {
        providerCallId: r.provider_call_id,
        adapter: durableAdapter(pe.env.owner, { lookup: false }),
      }),
    ).toEqual({ status: "unknown", reason: "adapter_has_no_lookup" });
    expect(
      await reconcileObserved(pool, {
        providerCallId: r.provider_call_id,
        adapter: { lookup: () => Promise.reject(new Error("down")) },
      }),
    ).toEqual({ status: "unknown", reason: "lookup_failed" });
    for (const corrupt of ["fingerprint", "call_id"] as const)
      expect(
        await reconcileObserved(pool, {
          providerCallId: r.provider_call_id,
          adapter: durableAdapter(pe.env.owner, {
            lookup: true,
            corruptEvidence: corrupt,
          }),
          finish: finishSucceeded(r.provider_call_id),
        }),
      ).toEqual({
        status: "unknown",
        reason: "evidence_not_bound_to_reservation",
      });
    expect(
      await reconcileObserved(pool, {
        providerCallId: randomUUID(),
        adapter: { lookup: () => Promise.resolve(undefined) },
      }),
    ).toEqual({ status: "unknown", reason: "reservation_not_found" });
    expect(
      (await lookupProviderCall(pool, r.provider_call_id))?.outcome,
    ).toBeNull();
    // the evidence of one call is not accepted for another call that merely shares nothing with it
    const other = reservation(pe.attempt);
    await reserveProviderCall(pool, other);
    const stray = await reconcileObserved(pool, {
      providerCallId: other.provider_call_id,
      adapter: {
        lookup: () =>
          Promise.resolve({
            provider_call_id: r.provider_call_id,
            logical_request_key: r.logical_request_key,
            request_fingerprint: r.request_fingerprint,
            result: { invocation_id: randomUUID(), cost: "1" },
          }),
      },
    });
    expect(stray).toEqual({
      status: "unknown",
      reason: "evidence_not_bound_to_reservation",
    });
  });

  it("a finish whose outcome names another call is rejected, never recorded", async () => {
    const pool = pe.runtime();
    const r = await performedButUnrecorded();
    const res = await reconcileObserved(pool, {
      providerCallId: r.provider_call_id,
      adapter: durableAdapter(pe.env.owner, { lookup: true }),
      finish: finishSucceeded(randomUUID()),
    });
    expect(res).toMatchObject({
      status: "performed",
      recorded: { kind: "rejected", code: "outcome_binding_mismatch" },
    });
  });
});
