import { describe, expect, it } from "vitest";

import { openFixturePack } from "../src/fixture/pack.js";
import { deepFreeze, type Tables } from "../src/fixture/rows.js";
import { VerifiedFixture } from "../src/fixture/snapshot.js";
import { FixtureVerificationError, verifyRows } from "../src/fixture/verify.js";
import { rawEvent, must } from "./support/claim-events.js";

// A2 verifier integration (A3): the load-time verifier now reduces the PERSISTED claim events and checks each manifest claim
// entry (cursor, status, reduced/effective usage) with the reducer. The base load carries zero events; these tests inject rows
// into a clone of the verified rows, exactly as read-back rows would look, and pin the resulting codes.
const real = VerifiedFixture.fromPack(openFixturePack());
const clone = (): Record<string, Record<string, unknown>[]> =>
  JSON.parse(JSON.stringify(real.rows.tables)) as Record<
    string,
    Record<string, unknown>[]
  >;
const verify = (tables: Record<string, Record<string, unknown>[]>): string => {
  try {
    verifyRows(
      deepFreeze(tables as unknown as Tables),
      real.context,
      real.historical,
    );
  } catch (error) {
    if (error instanceof FixtureVerificationError) return error.code;
    throw error;
  }
  return "accepted";
};

describe("A2 verifier with the A3 reducer", () => {
  it("accepts the base rows: zero events, nine null cursors, states reproduced by reduction", () => {
    expect(verify(clone())).toBe("accepted");
  });

  it("a persisted claim event changes the reduced state, so the load-time package comparison rejects it (events are post-load only)", () => {
    const tables = clone();
    const claim = must(tables.claims?.[0]);
    tables.claim_state_events = [
      rawEvent({ type: "contest", seq: 1, claim: String(claim.claim_id) }),
    ];
    expect(verify(tables)).toBe("package_frozen_state_mismatch");
  });

  it("reducer validation failures surface as verification errors with the reducer's code", () => {
    const tables = clone();
    const claim = must(tables.claims?.[0]);
    tables.claim_state_events = [
      rawEvent({ type: "contest", seq: 3, claim: String(claim.claim_id) }),
    ];
    expect(verify(tables)).toBe("log_first_sequence_not_one");
    const second = clone();
    second.claim_state_events = [
      {
        ...rawEvent({
          type: "frozen_snapshot",
          seq: 1,
          claim: String(claim.claim_id),
        }),
      },
    ];
    expect(verify(second)).toBe("invalid_payload");
  });
});
