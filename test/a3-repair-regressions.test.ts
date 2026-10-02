import { describe, expect, it } from "vitest";

import { canonicalJson } from "../src/identity/canonical-json.js";
import { readClaimLogs } from "../src/knowledge/claim-log.js";
import {
  ClaimStateError,
  parseClaimStateEvent,
  sameEvent,
  type ClaimStateEvent,
} from "../src/knowledge/claim-state.js";
import {
  LexicalNumber,
  parseLexicalJson,
} from "../src/knowledge/lexical-json.js";
import {
  checkCursor,
  parseStateCursor,
} from "../src/knowledge/state-cursor.js";
import { claimWithUsage, event, rawEvent } from "./support/claim-events.js";

// Regressions for the A3 repair: (1) runtime row validation in checkCursor, (2) the event_payload number boundary,
// (3) no invented UUID version restriction. Each fails against candidate 649acfb and passes after the repair.
const code = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    if (error instanceof ClaimStateError) return error.code;
    throw error;
  }
  return "accepted";
};
const claim = claimWithUsage("assertable");
const mk = (seq: number, type = "contest") =>
  event({ type, seq, claim: claim.claim_id });

describe("checkCursor validates rows at runtime (G28 oracle: row shape, claim locality, strict positive integer sequence)", () => {
  const e1 = mk(1);
  const e2 = mk(2, "confirm");
  const raw = (e: ClaimStateEvent): Record<string, unknown> => ({ ...e });
  const run = (over: {
    cursor?: unknown;
    accepted?: unknown[];
    visible?: unknown[];
    prefix?: unknown[];
  }): string =>
    code(() => {
      checkCursor({
        claimId: claim.claim_id,
        cursor: over.cursor ?? {
          claim_state_event_id: e2.claim_state_event_id,
          event_sequence: 2,
        },
        accepted: over.accepted ?? [raw(e1), raw(e2)],
        visible: over.visible ?? [raw(e1), raw(e2)],
        prefix: over.prefix ?? [raw(e1), raw(e2)],
      });
    });

  it("baseline: well-formed rows are accepted", () => {
    expect(run({})).toBe("accepted");
  });

  it("rejects the reproduced arrangements: sequences [1, 1.5, 2] and an intermediate negative sequence in accepted/visible/prefix", () => {
    for (const bad of [1.5, -1]) {
      const middle = { ...raw(mk(9)), event_sequence: bad };
      const rows = [raw(e1), middle, raw(e2)];
      expect(
        run({ accepted: rows, visible: rows, prefix: rows }),
        String(bad),
      ).toBe("visible_row_sequence_invalid");
    }
  });

  it("rejects a visible row with an extra key although its accepted counterpart lacks it", () => {
    const extra = { ...raw(e2), unexpected: "x" };
    expect(run({ visible: [raw(e1), extra] })).toBe(
      "visible_row_not_claim_local",
    );
  });

  const sequences: [string, unknown][] = [
    ["fractional", 1.5],
    ["boolean true", true],
    ["boolean false", false],
    ["string", "2"],
    ["zero", 0],
    ["negative", -3],
    ["negative zero", -0],
    ["NaN", Number.NaN],
    ["lexical 1.0 marker", new LexicalNumber("1.0", "non_integer_lexeme")],
    ["null", null],
  ];
  const shapes: [string, (r: Record<string, unknown>) => void][] = [
    [
      "missing actor_id",
      (r) => {
        delete r.actor_id;
      },
    ],
    [
      "missing event_payload",
      (r) => {
        delete r.event_payload;
      },
    ],
    [
      "extra key",
      (r) => {
        r.extra = 1;
      },
    ],
    [
      "foreign claim",
      (r) => {
        r.claim_id = claimWithUsage("silent").claim_id;
      },
    ],
  ];

  for (const label of ["visible", "prefix"] as const) {
    it(`${label}: every malformed sequence and shape is rejected with its ${label}_row_* code`, () => {
      for (const [name, value] of sequences) {
        const rows = [raw(e1), { ...raw(e2), event_sequence: value }];
        expect(run({ [label]: rows }), `${label} ${name}`).toBe(
          `${label}_row_sequence_invalid`,
        );
      }
      for (const [name, mutate] of shapes) {
        const bad = raw(e2);
        mutate(bad);
        expect(run({ [label]: [raw(e1), bad] }), `${label} ${name}`).toBe(
          `${label}_row_not_claim_local`,
        );
      }
      expect(run({ [label]: ["not a row", raw(e2)] })).toBe(
        `${label}_row_not_claim_local`,
      );
      expect(run({ [label]: [null] })).toBe(`${label}_row_not_claim_local`);
    });
  }

  it("accepted rows are validated too (shape, then strict sequence); a fully malformed row never reaches comparison", () => {
    for (const [name, value] of sequences)
      expect(
        run({ accepted: [raw(e1), { ...raw(e2), event_sequence: value }] }),
        name,
      ).toBe("accepted_row_sequence_invalid");
    expect(run({ accepted: [raw(e1), { ...raw(e2), extra: 1 }] })).toBe(
      "accepted_row_not_claim_local",
    );
    // an accepted row of ANOTHER claim is legitimate (the list may span claims) when its own shape is valid
    const foreign = raw(mk(1));
    foreign.claim_id = claimWithUsage("silent").claim_id;
    expect(run({ accepted: [raw(e1), raw(e2), foreign] })).toBe("accepted");
  });

  it("fully parses rows that pass the oracle checks: an invalid payload is a *_row_invalid error", () => {
    const bad = { ...raw(e2), event_payload: { reason: "x" } };
    expect(run({ visible: [raw(e1), bad] })).toBe("visible_row_invalid");
    expect(run({ prefix: [raw(e1), bad] })).toBe("prefix_row_invalid");
    expect(run({ accepted: [raw(e1), bad] })).toBe("accepted_row_invalid");
  });

  it("preserves the oracle's precedence: visible rows, visible duplicates, then prefix rows", () => {
    const badPrefix = [raw(e1), { ...raw(e2), event_sequence: 1.5 }];
    expect(
      run({ visible: [raw(e1), raw(e2), raw(e2)], prefix: badPrefix }),
    ).toBe("duplicate_visible_row");
    expect(
      run({
        visible: [raw(e1), { ...raw(e2), event_sequence: 0 }],
        prefix: badPrefix,
      }),
    ).toBe("visible_row_sequence_invalid");
    expect(run({ prefix: badPrefix })).toBe("prefix_row_sequence_invalid");
    expect(run({ prefix: [raw(e1), raw(e1)] })).toBe("duplicate_prefix_row");
  });
});

describe("event_payload number boundary: markers are never laundered into hashable objects", () => {
  const base = rawEvent({ type: "confirm", seq: 1, claim: claim.claim_id }); // one identity for source and native parses
  const eventText = (payloadJson: string, sequence = "1"): string => {
    return JSON.stringify({ ...base, event_payload: "@@" })
      .replace('"@@"', payloadJson)
      .replace('"event_sequence":1', `"event_sequence":${sequence}`);
  };
  const fromSource = (payloadJson: string): ClaimStateEvent =>
    parseClaimStateEvent(parseLexicalJson(eventText(payloadJson)));
  const fromNative = (payloadJson: string): ClaimStateEvent =>
    parseClaimStateEvent(JSON.parse(eventText(payloadJson)));
  const payloadWith = (value: string): string =>
    `{"reason_code":"c","reason":"r","measurement":${value}}`;

  it("integer-valued exponent and decimal forms normalize to the number they denote, equal to the native parse", () => {
    for (const [lexeme, value] of [
      ["1e0", 1],
      ["1.0", 1],
      ["1E+2", 100],
      ["-1e1", -10],
      ["0e5", 0],
      ["25.00", 25],
    ] as const) {
      const lexical = fromSource(payloadWith(lexeme));
      const native = fromNative(payloadWith(lexeme));
      expect(lexical.event_payload.measurement, lexeme).toBe(value);
      expect(typeof lexical.event_payload.measurement).toBe("number");
      expect(sameEvent(lexical, native), lexeme).toBe(true);
      expect(canonicalJson(lexical.event_payload)).toBe(
        canonicalJson(native.event_payload),
      );
    }
  });

  it("nested markers are normalized or rejected wherever they occur", () => {
    const nested = `{"reason_code":"c","reason":"r","a":[{"b":1e0},[2.0,{"c":3E0}]]}`;
    const lexical = parseClaimStateEvent(parseLexicalJson(eventText(nested)));
    expect(lexical.event_payload).toEqual({
      reason_code: "c",
      reason: "r",
      a: [{ b: 1 }, [2, { c: 3 }]],
    });
    expect(sameEvent(lexical, fromNative(nested))).toBe(true);
    for (const bad of [
      `{"reason_code":"c","reason":"r","a":[{"b":1.5}]}`,
      `{"reason_code":"c","reason":"r","a":{"b":[[1e-1]]}}`,
    ])
      expect(code(() => fromSource(bad))).toBe("invalid_payload");
  });

  it("decimals, unsafe integers, negative zero and non-finite numbers are rejected from raw source AND native sources alike", () => {
    for (const lexeme of [
      "1.5",
      "1e-1",
      "9007199254740993",
      "-9007199254740993",
      "-0.0",
      "1e400",
      "0.1",
    ]) {
      expect(
        code(() => fromSource(payloadWith(lexeme))),
        `source ${lexeme}`,
      ).toBe("invalid_payload");
      expect(
        code(() => fromNative(payloadWith(lexeme))),
        `native ${lexeme}`,
      ).toBe("invalid_payload");
    }
  });

  it("a marker object can no longer appear as an ordinary payload object (the serializer stays strict)", () => {
    const marker = parseLexicalJson('{"x":1.5}') as { x: LexicalNumber };
    expect(() => canonicalJson(marker)).toThrow(/Class instances/);
    expect(
      code(() =>
        parseClaimStateEvent({
          ...rawEvent({ type: "confirm", seq: 1, claim: claim.claim_id }),
          event_payload: {
            reason_code: "c",
            reason: "r",
            measurement: marker.x,
          },
        }),
      ),
    ).toBe("invalid_payload");
    // a plain object that merely LOOKS like a marker is just data, never a number
    const lookalike = parseClaimStateEvent({
      ...rawEvent({ type: "confirm", seq: 1, claim: claim.claim_id }),
      event_payload: {
        reason_code: "c",
        reason: "r",
        measurement: { lexeme: "1e0", kind: "non_integer_lexeme" },
      },
    });
    expect(lookalike.event_payload.measurement).toEqual({
      lexeme: "1e0",
      kind: "non_integer_lexeme",
    });
  });

  it("non-JSON payload values are rejected", () => {
    for (const bad of [undefined, () => 1, new Date(), Symbol("s"), 1n]) {
      expect(
        code(() =>
          parseClaimStateEvent({
            ...rawEvent({ type: "confirm", seq: 1, claim: claim.claim_id }),
            event_payload: { reason_code: "c", reason: "r", measurement: bad },
          }),
        ),
      ).toBe("invalid_payload");
    }
  });

  it("sequence and cursor lexical checks stay strict (not normalized)", () => {
    for (const lexeme of ["1.0", "1e0", "2.50"])
      expect(
        code(() =>
          parseClaimStateEvent(
            parseLexicalJson(eventText(payloadWith("1"), lexeme)),
          ),
        ),
        lexeme,
      ).toBe("sequence_not_integer");
    const cursor = parseLexicalJson(
      `{"claim_state_event_id":"${mk(1).claim_state_event_id}","event_sequence":1.0}`,
    );
    expect(code(() => parseStateCursor(cursor))).toBe("cursor_sequence_type");
  });

  it("the payload copy is private and prototype-safe", () => {
    const parsed = parseClaimStateEvent(
      parseLexicalJson(
        eventText(`{"reason_code":"c","reason":"r","__proto__":{"x":1}}`),
      ),
    );
    expect(Object.getPrototypeOf(parsed.event_payload)).toBe(Object.prototype);
    expect(Object.hasOwn(parsed.event_payload, "__proto__")).toBe(true);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});

describe("UUIDs are literal canonical UUIDs; no version restriction is imposed", () => {
  const v1 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
  const nil = "00000000-0000-0000-0000-000000000000";

  it("accepts any canonical lowercase UUID for event, claim and actor ids", () => {
    for (const id of [v1, nil, "d1250001-0000-4000-8000-000000000002"]) {
      const parsed = parseClaimStateEvent({
        ...rawEvent({ type: "confirm", seq: 1, claim: id, id }),
        actor_id: id,
      });
      expect(parsed.claim_state_event_id).toBe(id);
    }
  });

  it("accepts such a UUID in a cursor and in a claim request", async () => {
    expect(
      parseStateCursor({ claim_state_event_id: v1, event_sequence: 1 }),
    ).toEqual({ claim_state_event_id: v1, event_sequence: 1 });
    const outcome = await readClaimLogs(
      { query: () => Promise.resolve({ rows: [] }) },
      [v1],
    ).then(
      () => "accepted",
      (e: unknown) => (e instanceof ClaimStateError ? e.code : "other"),
    );
    expect(outcome).toBe("claim_not_found"); // not claim_request_invalid
  });

  it("still requires the canonical literal form (lowercase, hyphenated 8-4-4-4-12)", () => {
    for (const bad of [
      v1.toUpperCase(),
      v1.replaceAll("-", ""),
      `{${v1}}`,
      `urn:uuid:${v1}`,
      `${v1} `,
      "vec:r1",
      "6ba7b810-9dad-11d1-80b4-00c04fd430c",
    ]) {
      expect(
        code(() =>
          parseClaimStateEvent(
            rawEvent({
              type: "confirm",
              seq: 1,
              claim: claim.claim_id,
              id: bad,
            }),
          ),
        ),
        bad,
      ).toBe("invalid_event_identity");
      expect(
        code(() =>
          parseStateCursor({ claim_state_event_id: bad, event_sequence: 1 }),
        ),
      ).toBe("cursor_shape");
    }
  });
});
