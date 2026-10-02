import { describe, expect, it } from "vitest";

import {
  ClaimStateError,
  MAX_EVENT_SEQUENCE,
  assertAcceptedLogShape,
  frozenStateHash,
  parseClaimStateEvent,
  reduceClaimState,
  sameEvent,
  type UsageClass,
} from "../src/knowledge/claim-state.js";
import { LexicalNumber } from "../src/knowledge/lexical-json.js";
import {
  claimWithUsage,
  event,
  fixtureClaims,
  rawEvent,
  uuid,
} from "./support/claim-events.js";

const code = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    if (error instanceof ClaimStateError) return error.code;
    throw error;
  }
  return "accepted";
};
const assertable = claimWithUsage("assertable");
const hedged = claimWithUsage("hedged_only");
const silent = claimWithUsage("silent");
const reduce = (
  claim: typeof assertable,
  events: readonly unknown[],
  ceiling: UsageClass = "assertable",
  through?: number,
) =>
  reduceClaimState(claim, events, {
    ceiling,
    ...(through === undefined ? {} : { through }),
  });
const mk = (
  claim: typeof assertable,
  type: string,
  seq: number,
  usage?: string,
  at?: string,
) =>
  event({
    type,
    seq,
    claim: claim.claim_id,
    ...(usage ? { usage } : {}),
    ...(at ? { at } : {}),
  });

describe("reducer table (Claims 4.4.1)", () => {
  it("no events: reduction starts and ends at the initial fields", () => {
    for (const claim of fixtureClaims())
      expect(reduce(claim, [])).toEqual({
        state: claim.initial_status,
        reduced_usage_class: claim.initial_usage_class,
        effective_usage_class: claim.initial_usage_class,
      });
  });

  it("each status event sets its status and preserves usage", () => {
    const expected = {
      confirm: "confirmed",
      contest: "contested",
      demote: "demoted",
      supersede: "superseded",
      expire: "expired",
      tombstone: "tombstoned",
    } as const;
    for (const [type, state] of Object.entries(expected))
      expect(reduce(hedged, [mk(hedged, type, 1)])).toEqual({
        state,
        reduced_usage_class: "hedged_only",
        effective_usage_class: "hedged_only",
      });
  });

  it("usage_change applies the explicit usage_class and preserves status, even a restrictive one", () => {
    const contested = [
      mk(assertable, "contest", 1),
      mk(assertable, "usage_change", 2, "silent"),
    ];
    expect(reduce(assertable, contested)).toMatchObject({
      state: "contested",
      reduced_usage_class: "silent",
    });
    // usage_change may also relax the underlying usage; the strictest rule is then the explicit ceiling's job
    expect(
      reduce(silent, [mk(silent, "usage_change", 1, "assertable")]),
    ).toMatchObject({ reduced_usage_class: "assertable" });
  });

  it("confirm cannot silently promote usage", () => {
    expect(
      reduce(silent, [mk(silent, "contest", 1), mk(silent, "confirm", 2)]),
    ).toMatchObject({ state: "confirmed", reduced_usage_class: "silent" });
  });

  it("effective usage is never less restrictive than the explicit ceiling", () => {
    expect(reduce(assertable, [], "hedged_only")).toMatchObject({
      reduced_usage_class: "assertable",
      effective_usage_class: "hedged_only",
    });
    expect(reduce(silent, [], "hedged_only")).toMatchObject({
      effective_usage_class: "silent",
    });
    for (const ceiling of ["assertable", "hedged_only", "silent"] as const)
      for (const claim of [assertable, hedged, silent]) {
        const rank = ["assertable", "hedged_only", "silent"];
        const out = reduce(claim, [], ceiling);
        expect(rank.indexOf(out.effective_usage_class)).toBe(
          Math.max(
            rank.indexOf(String(claim.initial_usage_class)),
            rank.indexOf(ceiling),
          ),
        );
      }
  });

  it("the ceiling is a required input and never inferred", () => {
    expect(
      code(() =>
        reduceClaimState(
          assertable,
          [],
          {} as unknown as { ceiling: "silent" },
        ),
      ),
    ).toBe("invalid_ceiling");
    expect(
      code(() =>
        reduceClaimState(assertable, [], { ceiling: "loud" as UsageClass }),
      ),
    ).toBe("invalid_ceiling");
  });

  it("through-sequence reduces a prefix without replacing log validation", () => {
    const log = [
      mk(assertable, "contest", 1),
      mk(assertable, "usage_change", 2, "silent"),
    ];
    expect(reduce(assertable, log, "assertable", 1)).toMatchObject({
      state: "contested",
      reduced_usage_class: "assertable",
    });
    for (const bad of [0, -1, 1.5, Number.NaN])
      expect(code(() => reduce(assertable, log, "assertable", bad))).toBe(
        "invalid_through",
      );
    // the whole supplied log is still validated: a log that does not start at 1 is rejected even for a small `through`
    expect(
      code(() =>
        reduce(assertable, [mk(assertable, "contest", 2)], "assertable", 1),
      ),
    ).toBe("log_first_sequence_not_one");
  });

  it("validates the claim's initial fields", () => {
    expect(
      code(() =>
        reduceClaimState(
          {
            claim_id: assertable.claim_id,
            initial_status: "usage_changed",
            initial_usage_class: "assertable",
          },
          [],
          { ceiling: "assertable" },
        ),
      ),
    ).toBe("invalid_initial_status");
    expect(
      code(() =>
        reduceClaimState(
          {
            claim_id: assertable.claim_id,
            initial_status: "confirmed",
            initial_usage_class: "loud",
          },
          [],
          { ceiling: "assertable" },
        ),
      ),
    ).toBe("invalid_initial_usage_class");
  });
});

describe("ordering is by event_sequence only", () => {
  const permutations = <T>(items: T[]): T[][] =>
    items.length <= 1
      ? [items]
      : items.flatMap((item, i) =>
          permutations([...items.slice(0, i), ...items.slice(i + 1)]).map(
            (rest) => [item, ...rest],
          ),
        );

  it("every input permutation reduces identically, with timestamps running opposite to sequences and ties", () => {
    const log = [
      mk(assertable, "expire", 1, undefined, "2026-09-27T13:30:05Z"),
      mk(assertable, "confirm", 2, undefined, "2026-09-27T13:30:04Z"),
      mk(assertable, "usage_change", 4, "silent", "2026-09-27T13:30:04Z"),
      mk(assertable, "usage_change", 7, "hedged_only", "2000-01-01T00:00:00Z"),
      mk(assertable, "contest", 9, undefined, "2026-09-27T13:30:04Z"),
    ];
    const expected = reduce(assertable, log);
    expect(expected).toMatchObject({
      state: "contested",
      reduced_usage_class: "hedged_only",
    });
    for (const order of permutations(log))
      expect(reduce(assertable, order)).toEqual(expected);
    // UUID order and JSON order are not inputs either
    const byUuidDesc = [...log].sort((a, b) =>
      b.claim_state_event_id.localeCompare(a.claim_state_event_id),
    );
    expect(reduce(assertable, byUuidDesc)).toEqual(expected);
  });

  it("two accepted events with the same claim, occurred_at and event_type but distinct identities are distinct events", () => {
    const at = "2026-09-27T13:30:00Z";
    const log = [
      mk(assertable, "usage_change", 1, "hedged_only", at),
      mk(assertable, "usage_change", 2, "silent", at),
    ];
    expect(log[0]?.claim_state_event_id).not.toBe(log[1]?.claim_state_event_id);
    expect(reduce(assertable, log)).toMatchObject({
      reduced_usage_class: "silent",
    });
    expect(reduce(assertable, [...log].reverse())).toMatchObject({
      reduced_usage_class: "silent",
    });
  });

  it("allows gaps above the accepted maximum and rejects duplicates, a late start and foreign claims", () => {
    expect(
      code(() =>
        reduce(assertable, [
          mk(assertable, "contest", 1),
          mk(assertable, "confirm", 5),
        ]),
      ),
    ).toBe("accepted");
    expect(
      code(() =>
        reduce(assertable, [
          mk(assertable, "contest", 1),
          mk(assertable, "confirm", 1),
        ]),
      ),
    ).toBe("duplicate_sequence");
    expect(code(() => reduce(assertable, [mk(assertable, "contest", 3)]))).toBe(
      "log_first_sequence_not_one",
    );
    expect(code(() => reduce(assertable, [mk(hedged, "contest", 1)]))).toBe(
      "event_wrong_claim",
    );
    const dup = mk(assertable, "contest", 1);
    expect(
      code(() =>
        assertAcceptedLogShape(assertable.claim_id, [
          dup,
          { ...dup, event_sequence: 2 },
        ]),
      ),
    ).toBe("duplicate_event_identity");
  });
});

describe("event validation", () => {
  const base = (): Record<string, unknown> =>
    rawEvent({ type: "confirm", seq: 1, claim: assertable.claim_id });
  const parse = (edit: (e: Record<string, unknown>) => void): string => {
    const raw = base();
    edit(raw);
    return code(() => parseClaimStateEvent(raw));
  };

  it("accepts a valid row, a pg-style Date and an offset timestamp, normalizing the instant", () => {
    expect(parse(() => undefined)).toBe("accepted");
    const date = parseClaimStateEvent({
      ...base(),
      occurred_at: new Date("2026-09-27T13:30:00Z"),
    });
    const offset = parseClaimStateEvent({
      ...base(),
      occurred_at: "2026-09-27T14:30:00+01:00",
    });
    expect(date.occurred_at).toBe("2026-09-27T13:30:00.000Z");
    expect(
      sameEvent(
        { ...date, claim_state_event_id: "x" },
        { ...offset, claim_state_event_id: "x" },
      ),
    ).toBe(true);
  });

  it("rejects bad shapes, identities and times", () => {
    expect(
      parse((e) => {
        delete e.actor_id;
      }),
    ).toBe("invalid_event_shape");
    expect(
      parse((e) => {
        e.extra = 1;
      }),
    ).toBe("invalid_event_shape");
    expect(code(() => parseClaimStateEvent(null))).toBe("invalid_event_shape");
    expect(
      parse((e) => {
        e.claim_state_event_id = "vec:r1";
      }),
    ).toBe("invalid_event_identity");
    expect(
      parse((e) => {
        e.claim_id = uuid(1).toUpperCase();
      }),
    ).toBe("invalid_event_identity");
    expect(
      parse((e) => {
        e.occurred_at = "2026-09-27T13:30:00";
      }),
    ).toBe("invalid_occurred_at");
    expect(
      parse((e) => {
        e.occurred_at = "not a time";
      }),
    ).toBe("invalid_occurred_at");
  });

  it("rejects unknown types (including frozen_snapshot) and missing, blank or non-string reasons", () => {
    expect(
      parse((e) => {
        e.event_type = "frozen_snapshot";
      }),
    ).toBe("invalid_payload");
    expect(
      parse((e) => {
        e.event_type = "usage_changed";
      }),
    ).toBe("invalid_payload");
    expect(
      parse((e) => {
        e.event_payload = {};
      }),
    ).toBe("invalid_payload");
    expect(
      parse((e) => {
        e.event_payload = { reason_code: "x", reason: "  " };
      }),
    ).toBe("invalid_payload");
    expect(
      parse((e) => {
        e.event_payload = { reason_code: 1, reason: "x" };
      }),
    ).toBe("invalid_payload");
    expect(
      parse((e) => {
        e.event_payload = [];
      }),
    ).toBe("invalid_payload");
  });

  it("usage_change needs a valid usage_class; other keys such as permission_evidence are accepted", () => {
    expect(
      parse((e) => {
        e.event_type = "usage_change";
      }),
    ).toBe("invalid_payload");
    expect(
      parse((e) => {
        e.event_type = "usage_change";
        e.event_payload = {
          reason_code: "x",
          reason: "y",
          usage_class: "loud",
        };
      }),
    ).toBe("invalid_payload");
    expect(
      parse((e) => {
        e.event_type = "usage_change";
        e.event_payload = {
          reason_code: "x",
          reason: "y",
          usage_class: "silent",
          permission_evidence: { source: "s" },
        };
      }),
    ).toBe("accepted");
  });

  it("rejects sequences that are not strict positive int4 integers", () => {
    for (const bad of [
      true,
      false,
      "1",
      1.5,
      Number.NaN,
      null,
      -0,
      new LexicalNumber("1.0", "non_integer_lexeme"),
      new LexicalNumber("9007199254740993", "unsafe_integer"),
    ])
      expect(
        parse((e) => {
          e.event_sequence = bad;
        }),
        typeof bad,
      ).toBe("sequence_not_integer");
    for (const bad of [0, -1])
      expect(
        parse((e) => {
          e.event_sequence = bad;
        }),
      ).toBe("sequence_not_positive");
    expect(
      parse((e) => {
        e.event_sequence = MAX_EVENT_SEQUENCE;
      }),
    ).toBe("accepted");
    expect(
      parse((e) => {
        e.event_sequence = MAX_EVENT_SEQUENCE + 1;
      }),
    ).toBe("sequence_out_of_range");
  });

  it("returns frozen rows with a private payload copy", () => {
    const raw = base();
    const parsed = parseClaimStateEvent(raw);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.event_payload)).toBe(true);
    (raw.event_payload as Record<string, unknown>).reason = "mutated";
    expect(parsed.event_payload.reason).toBe("test event");
  });
});

describe("frozen-state identity", () => {
  it("hashes exactly the three-field projection: actor, time, reason and cursor never enter it", () => {
    const reduced = reduce(assertable, [mk(assertable, "contest", 1)]);
    const hash = frozenStateHash(assertable.content_hash, reduced);
    const noisy = reduce(assertable, [
      event({
        type: "contest",
        seq: 1,
        claim: assertable.claim_id,
        at: "2001-01-01T00:00:00Z",
        reason: "something else entirely",
      }),
    ]);
    expect(frozenStateHash(assertable.content_hash, noisy)).toBe(hash);
    expect(
      frozenStateHash(assertable.content_hash, reduce(assertable, [])),
    ).not.toBe(hash);
  });
});
