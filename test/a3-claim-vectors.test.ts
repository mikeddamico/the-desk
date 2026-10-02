import { describe, expect, it } from "vitest";

import { loadClaimEventConformance } from "../src/fixture/loader.js";
import { reduceClaimState } from "../src/knowledge/claim-state.js";
import { LexicalNumber } from "../src/knowledge/lexical-json.js";
import { checkCursor } from "../src/knowledge/state-cursor.js";
import { event, fixtureClaims, must } from "./support/claim-events.js";
import {
  SelectorError,
  runVector,
  vectorUuid,
  type VectorClaim,
} from "./support/claim-vector-harness.js";

type Obj = Record<string, unknown>;
const document = loadClaimEventConformance() as unknown as {
  claims: Record<string, VectorClaim>;
  counts: { vectors: number };
  vectors: Obj[];
};
const claims = document.claims;
const byId = (id: string): Obj => {
  const found = document.vectors.find((v) => v.id === id);
  if (!found) throw new Error(`no vector ${id}`);
  return found;
};
const clone = <T>(v: T): T => structuredClone(v);
const stepsOf = (v: Obj): Obj[] => v.steps as Obj[];
const step = (v: Obj, index: number): Obj => {
  const found = stepsOf(v)[index];
  if (!found) throw new Error(`no step ${String(index)}`);
  return found;
};

describe("the 58 shipped claim-event vectors, run through production reduce/hash/cursor code", () => {
  it("has the pinned shape: 58 vectors, 11 classes, 156 steps", () => {
    expect(document.vectors).toHaveLength(58);
    expect(document.counts.vectors).toBe(58);
    const classes = new Map<string, number>();
    for (const v of document.vectors)
      classes.set(String(v.class), (classes.get(String(v.class)) ?? 0) + 1);
    expect(Object.fromEntries(classes)).toEqual({
      reduce_base: 2,
      reduce_status: 6,
      reduce_usage: 4,
      order_independence: 5,
      same_time_same_type: 1,
      append_reject: 11,
      retry_duplicate_transition: 4,
      cursor_freeze: 10,
      frozen_cursor: 11,
      sequence_rules: 1,
      post_freeze: 3,
    });
    const ops = new Map<string, number>();
    for (const v of document.vectors)
      for (const s of stepsOf(v))
        ops.set(String(s.op), (ops.get(String(s.op)) ?? 0) + 1);
    expect(Object.fromEntries(ops)).toEqual({
      append: 95,
      reduce: 29,
      cursor: 25,
      snapshot: 6,
      frozen_hash: 1,
    });
  });

  it("every vector produces exactly its shipped expectation, in vector error precedence", () => {
    const failures: string[] = [];
    for (const v of document.vectors) {
      const outcome = runVector(v, claims);
      if (!outcome.ok) failures.push(`${outcome.id}: ${outcome.failure ?? ""}`);
    }
    expect(failures).toEqual([]);
  });

  it("exercises every distinct string expectation the file declares (25 reject codes and the ok outcomes)", () => {
    const declared = new Set<string>();
    for (const v of document.vectors)
      for (const s of stepsOf(v))
        if (typeof s.expect === "string") declared.add(s.expect);
    const exercised = new Set<string>();
    for (const v of document.vectors)
      for (const e of runVector(v, claims).expectations) exercised.add(e);
    for (const e of declared) expect(exercised.has(e), e).toBe(true);
    expect([...declared].filter((e) => e.startsWith("reject:"))).toHaveLength(
      25,
    );
  });

  it("CE-G05 step 2 reaches production through the lexical marker (cursor event_sequence 1.0)", () => {
    const step = stepsOf(byId("CE-G05"))[2];
    const cursor = step?.cursor as Obj;
    expect(cursor.event_sequence).toBeInstanceOf(LexicalNumber);
    expect(step?.expect).toBe("reject:cursor_sequence_type");
    expect(runVector(byId("CE-G05"), claims).ok).toBe(true);
  });

  it("translates symbolic vec:* ids only inside the harness, deterministically", () => {
    expect(vectorUuid("vec:r1")).toBe(vectorUuid("vec:r1"));
    expect(vectorUuid("vec:r1")).not.toBe(vectorUuid("vec:r2"));
    expect(String(vectorUuid("vec:r1"))).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8/,
    );
    const real = "d1250008-0000-4000-8000-000000000001";
    expect(vectorUuid(real)).toBe(real);
  });
});

describe("harness mutation tests (fixture conformance cases CE03-CE06 analogues)", () => {
  it("an altered expected reduction fails (CE03)", () => {
    const v = clone(byId("CE-R01"));
    (stepsOf(v)[0]?.expect as Obj).state = "expired";
    expect(runVector(v, claims).ok).toBe(false);
  });

  it("an unknown step operation is a selector failure, not a rejection (CE05)", () => {
    const v = clone(byId("CE-R03"));
    step(v, 1).op = "explode";
    expect(() => runVector(v, claims)).toThrow(SelectorError);
  });

  it("an accepted append where the vector must reject fails (CE06)", () => {
    const v = clone(byId("CE-A03"));
    step(v, 0).expect = "ok:appended";
    const outcome = runVector(v, claims);
    expect(outcome.ok).toBe(false);
    expect(outcome.failure).toContain("first_sequence_not_one");
  });

  it("a reject expectation where production accepts fails", () => {
    const v = clone(byId("CE-C03"));
    step(v, 2).expect = "reject:omitted_prefix_event";
    expect(runVector(v, claims).ok).toBe(false);
  });

  it("selector failures: unknown claim, snapshot misuse, unresolved event, unknown order/ceiling/through, missing expectation", () => {
    const cases: [string, (v: Obj) => void][] = [
      [
        "CE-R03",
        (v) => {
          step(v, 1).claim = "d1250008-0000-4000-8000-0000000000ff";
        },
      ],
      [
        "CE-F01",
        (v) => {
          step(v, 5).visible = "never_taken";
        },
      ],
      [
        "CE-F01",
        (v) => {
          step(v, 1).name = "s1";
          step(v, 4).op = "snapshot";
          step(v, 4).name = "s1";
        },
      ],
      [
        "CE-C04",
        (v) => {
          step(v, 2).prefix = ["vec:missing"];
        },
      ],
      [
        "CE-O-sequence",
        (v) => {
          step(v, 3).order = "alphabetical";
        },
      ],
      [
        "CE-R12",
        (v) => {
          step(v, 0).ceiling = "loud";
        },
      ],
      [
        "CE-RT01",
        (v) => {
          step(v, 2).through = "1";
        },
      ],
      [
        "CE-R01",
        (v) => {
          delete step(v, 0).expect;
        },
      ],
      [
        "CE-R03",
        (v) => {
          delete step(v, 0).event;
        },
      ],
    ];
    for (const [id, mutate] of cases) {
      const v = clone(byId(id));
      mutate(v);
      expect(() => runVector(v, claims), id).toThrow(SelectorError);
    }
  });

  it("through-sequence reduction does not replace cursor validation: reducing through a stale cursor works, the stale cursor is still rejected", () => {
    const claim = fixtureClaims()[0];
    if (!claim) throw new Error("no claim");
    const log = [1, 2, 3].map((seq) =>
      event({
        type: seq === 3 ? "usage_change" : "contest",
        seq,
        claim: claim.claim_id,
        ...(seq === 3 ? { usage: "silent" } : {}),
      }),
    );
    expect(
      reduceClaimState(claim, log, { ceiling: "assertable", through: 1 }),
    ).toMatchObject({ state: "contested", reduced_usage_class: "assertable" });
    expect(() => {
      checkCursor({
        claimId: claim.claim_id,
        cursor: {
          claim_state_event_id: log[0]?.claim_state_event_id,
          event_sequence: 1,
        },
        accepted: log,
        visible: log,
        prefix: [must(log[0])],
      });
    }).toThrow(/cursor_older_than_visible_event/);
  });
});
