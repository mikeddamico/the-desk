// A5.2 request validation needs no database: a pool that refuses to connect proves nothing is attempted for a rejected request.
import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  executeProviderCall,
  recordProviderOutcome,
  reserveProviderCall,
  type AuthoredOutcome,
  type AuthoredReservation,
} from "../src/runtime/provider.js";
import { hex, outcome, reservation } from "./support/a5-provider.js";

const never = {
  connect: () => {
    throw new Error("must not connect");
  },
  query: () => {
    throw new Error("must not query");
  },
} as never;
const base = (): AuthoredReservation => reservation(randomUUID());

describe("A5.2 reservation request validation", () => {
  it.each<[Partial<AuthoredReservation>, string]>([
    [{ provider_call_id: "nope" }, "invalid_uuid"],
    [{ attempt_id: "" }, "invalid_uuid"],
    [{ retry_of_provider_call_id: "x" }, "invalid_uuid"],
    [{ request_fingerprint: hex("a").toUpperCase() }, "invalid_hash"],
    [{ provider: "" }, "invalid_string"],
    [{ operation: "" }, "invalid_string"],
    [{ logical_request_key: "" }, "invalid_string"],
    [{ operational_try_number: 0 }, "invalid_integer"],
    [{ operational_try_number: 2 ** 31 }, "invalid_integer"],
    [{ intentional_take_index: 0.5 }, "invalid_integer"],
    [{ started_at: "2026-01-01T00:00:00.1234567Z" }, "timestamp_precision"],
    [{ started_at: "2026-01-01T00:00:00" }, "invalid_timestamp"],
  ])("%j -> %s", async (over, code) => {
    expect(
      await reserveProviderCall(never, { ...base(), ...over }),
    ).toMatchObject({ kind: "rejected", code });
  });

  it("executeProviderCall rejects without calling the adapter", async () => {
    let performed = 0;
    const r = await executeProviderCall(
      never,
      { ...base(), provider: "" },
      {
        perform: () => {
          performed += 1;
          return Promise.resolve(1);
        },
      },
      () => outcome(randomUUID()),
    );
    expect(r.status).toBe("rejected");
    expect(performed).toBe(0);
  });
});

describe("A5.2 outcome request validation (exact decimal text, no JS numbers)", () => {
  const id = randomUUID();
  it.each<[Partial<AuthoredOutcome>, string]>([
    [{ actual_cost: "1e2" }, "invalid_cost"],
    [{ actual_cost: "+1" }, "invalid_cost"],
    [{ actual_cost: "-0" }, "invalid_cost"],
    [{ actual_cost: "00.5" }, "invalid_cost"],
    [{ actual_cost: "1." }, "invalid_cost"],
    [{ actual_cost: "1,5" }, "invalid_cost"],
    [{ actual_cost: "1".repeat(65) }, "invalid_cost"],
    [{ actual_cost: 0.1 as unknown as string }, "invalid_cost"],
    [{ currency: "usd" }, "invalid_currency"],
    [{ currency: null }, "cost_currency_pairing"],
    [{ actual_cost: null }, "cost_currency_pairing"],
    [{ usage: [] as never }, "invalid_json"],
    [{ usage: { n: 1.5 } }, "invalid_json"],
    [{ event_type: "ok" as never }, "invalid_event_type"],
    [{ ended_at: "2026-01-01T00:00:00.1234567Z" }, "timestamp_precision"],
  ])("%j -> %s", async (over, code) => {
    expect(await recordProviderOutcome(never, outcome(id, over))).toMatchObject(
      { kind: "rejected", code },
    );
  });
});
