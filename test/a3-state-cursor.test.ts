import { describe, expect, it } from "vitest";

import {
  ClaimStateError,
  frozenStateHash,
  parseClaimStateEvent,
  type ClaimStateEvent,
  type UsageClass,
} from "../src/knowledge/claim-state.js";
import { LexicalNumber } from "../src/knowledge/lexical-json.js";
import {
  checkCursor,
  freezeClaimPrefix,
  parseStateCursor,
  verifyFrozenEntry,
  type FrozenCeiling,
} from "../src/knowledge/state-cursor.js";
import {
  claimWithUsage,
  event,
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
const claim = claimWithUsage("assertable");
const other = claimWithUsage("hedged_only");
const mk = (type: string, seq: number, usage?: string, c = claim) =>
  event({ type, seq, claim: c.claim_id, ...(usage ? { usage } : {}) });
const cur = (e: ClaimStateEvent): Record<string, unknown> => ({
  claim_state_event_id: e.claim_state_event_id,
  event_sequence: e.event_sequence,
});

describe("cursor shape", () => {
  it("accepts null and exactly the two-key form", () => {
    expect(parseStateCursor(null)).toBeNull();
    expect(
      parseStateCursor({ claim_state_event_id: uuid(1), event_sequence: 3 }),
    ).toEqual({
      claim_state_event_id: uuid(1),
      event_sequence: 3,
    });
  });

  it("rejects extra/missing keys, non-objects, wrong sequence types and ranges", () => {
    const id = uuid(1);
    expect(
      code(() =>
        parseStateCursor({ claim_state_event_id: id, event_sequence: 1, x: 1 }),
      ),
    ).toBe("cursor_shape");
    expect(code(() => parseStateCursor({ claim_state_event_id: id }))).toBe(
      "cursor_shape",
    );
    expect(code(() => parseStateCursor([]))).toBe("cursor_shape");
    expect(code(() => parseStateCursor(undefined))).toBe("cursor_shape");
    expect(
      code(() =>
        parseStateCursor({ claim_state_event_id: 5, event_sequence: 1 }),
      ),
    ).toBe("cursor_shape");
    for (const bad of [
      true,
      "1",
      1.5,
      -0,
      new LexicalNumber("1.0", "non_integer_lexeme"),
    ])
      expect(
        code(() =>
          parseStateCursor({ claim_state_event_id: id, event_sequence: bad }),
        ),
      ).toBe("cursor_sequence_type");
    expect(
      code(() =>
        parseStateCursor({
          claim_state_event_id: id,
          event_sequence: new LexicalNumber(
            "9007199254740993",
            "unsafe_integer",
          ),
        }),
      ),
    ).toBe("cursor_sequence_out_of_range");
    expect(
      code(() =>
        parseStateCursor({ claim_state_event_id: id, event_sequence: 0 }),
      ),
    ).toBe("cursor_sequence_not_positive");
    expect(
      code(() =>
        parseStateCursor({
          claim_state_event_id: id,
          event_sequence: 2147483648,
        }),
      ),
    ).toBe("cursor_sequence_out_of_range");
  });
});

describe("checkCursor (Evidence Package 9.3)", () => {
  const e1 = mk("contest", 1);
  const e2 = mk("confirm", 2);
  const e3 = mk("usage_change", 3, "silent");
  const log = [e1, e2, e3];
  const run = (args: Partial<Parameters<typeof checkCursor>[0]>): string =>
    code(() => {
      checkCursor({
        claimId: claim.claim_id,
        cursor: cur(e2),
        accepted: log,
        visible: [e1, e2],
        prefix: [e1, e2],
        ...args,
      });
    });

  it("accepts the exact last visible event with the exact prefix, and stays valid after a later event", () => {
    expect(run({})).toBe("accepted");
    expect(run({ cursor: cur(e3), visible: log, prefix: log })).toBe(
      "accepted",
    );
  });

  it("null binds only an empty visible set and empty prefix", () => {
    expect(run({ cursor: null, visible: [], prefix: [] })).toBe("accepted");
    expect(run({ cursor: null, visible: [e1], prefix: [] })).toBe(
      "null_cursor_with_visible_events",
    );
    expect(run({ cursor: null, visible: [], prefix: [e1] })).toBe(
      "null_cursor_with_nonempty_prefix",
    );
  });

  it("rejects an omitted prefix event, an older cursor, a future cursor and a cursor over empty visibility", () => {
    expect(run({ prefix: [e2] })).toBe("omitted_prefix_event");
    expect(run({ cursor: cur(e1), prefix: [e1] })).toBe(
      "cursor_older_than_visible_event",
    );
    expect(run({ cursor: cur(e3) })).toBe("cursor_not_in_visible_set");
    expect(run({ visible: [], prefix: [] })).toBe(
      "cursor_with_empty_visibility",
    );
  });

  it("rejects wrong-claim, unknown and sequence-mismatched cursors", () => {
    const foreign = mk("confirm", 1, undefined, other);
    expect(run({ accepted: [...log, foreign], cursor: cur(foreign) })).toBe(
      "cursor_wrong_claim",
    );
    expect(
      run({ cursor: { claim_state_event_id: uuid(999), event_sequence: 2 } }),
    ).toBe("cursor_event_unknown");
    expect(run({ cursor: { ...cur(e2), event_sequence: 1 } })).toBe(
      "cursor_sequence_mismatch",
    );
  });

  it("rejects visible sets and prefixes that omit, repeat or alter accepted rows", () => {
    const altered = parseClaimStateEvent({
      ...rawEvent({ type: "expire", seq: 1, claim: claim.claim_id }),
      claim_state_event_id: e1.claim_state_event_id,
    });
    expect(run({ visible: [e2], prefix: [e2] })).toBe(
      "visible_omits_accepted_event",
    );
    expect(run({ visible: [altered, e2] })).toBe(
      "visible_row_not_an_accepted_row",
    );
    expect(run({ visible: [e1, e2, e2] })).toBe("duplicate_visible_row");
    expect(run({ prefix: [e1, e1, e2] })).toBe("duplicate_prefix_row");
    expect(run({ prefix: [altered, e2] })).toBe(
      "prefix_row_differs_from_visible",
    );
    expect(run({ visible: [mk("confirm", 1, undefined, other)] })).toBe(
      "visible_row_not_claim_local",
    );
  });
});

describe("freezeClaimPrefix", () => {
  it("freezes from the visible log: cursor is its last event, or null", () => {
    expect(freezeClaimPrefix(claim, [], "assertable")).toMatchObject({
      state_event_cursor: null,
      frozen_state: "confirmed",
    });
    const log = [mk("contest", 1), mk("usage_change", 4, "silent")];
    const entry = freezeClaimPrefix(claim, [...log].reverse(), "assertable");
    expect(entry.state_event_cursor).toEqual({
      claim_state_event_id: log[1]?.claim_state_event_id,
      event_sequence: 4,
    });
    expect(entry).toMatchObject({
      frozen_state: "contested",
      reduced_usage_class: "silent",
      effective_usage_class: "silent",
    });
    expect(entry.frozen_state_hash).toBe(
      frozenStateHash(claim.content_hash, {
        state: "contested",
        reduced_usage_class: "silent",
        effective_usage_class: "silent",
      }),
    );
  });

  it("applies the supplied frozen-time ceiling and creates no event", () => {
    const entry = freezeClaimPrefix(claim, [], "hedged_only");
    expect(entry).toMatchObject({
      reduced_usage_class: "assertable",
      effective_usage_class: "hedged_only",
    });
  });
});

describe("verifyFrozenEntry: frozen consistency, live difference and ceilings", () => {
  const e1 = mk("contest", 1);
  const e2 = mk("confirm", 2);
  const frozen = freezeClaimPrefix(claim, [e1, e2], "hedged_only"); // frozen-time ceiling was hedged_only
  const verify = (
    args: {
      entry?: unknown;
      live?: unknown[];
      frozenCeiling?: FrozenCeiling;
      currentCeiling?: UsageClass;
    } = {},
  ) =>
    verifyFrozenEntry({
      entry: "entry" in args ? args.entry : frozen,
      claim,
      liveEvents: args.live ?? [e1, e2],
      frozenCeiling: args.frozenCeiling ?? "hedged_only",
      currentCeiling: args.currentCeiling ?? "hedged_only",
    });

  it("verifies a consistent entry against the independently supplied frozen-time ceiling, with no live difference", () => {
    const result = verify();
    expect(result.materialDifference).toBe(false);
    expect(result.liveEventsAfterCursor).toBe(0);
    expect(result.verified.join("|")).toContain(
      "independently supplied frozen-time ceiling",
    );
  });

  it("a later append is a material live difference and does not invalidate the historical entry", () => {
    const later = mk("usage_change", 3, "silent");
    const result = verify({ live: [e1, e2, later] });
    expect(result.materialDifference).toBe(true);
    expect(result.liveEventsAfterCursor).toBe(1);
    expect(result.live).toMatchObject({ reduced_usage_class: "silent" });
  });

  it("a stricter CURRENT permission is a material live difference and does not invalidate the historical entry", () => {
    const result = verify({ currentCeiling: "silent" });
    expect(result.materialDifference).toBe(true);
    expect(result.live.effective_usage_class).toBe("silent");
    expect(result.verified.length).toBeGreaterThan(3);
  });

  it("a wrong frozen-time ceiling is detected: the entry's effective usage is NOT trusted to define it (non-circular)", () => {
    expect(code(() => verify({ frozenCeiling: "assertable" }))).toBe(
      "entry_effective_usage_mismatch",
    );
    expect(code(() => verify({ frozenCeiling: "silent" }))).toBe(
      "entry_effective_usage_mismatch",
    );
  });

  it("unavailable historical permission input is reported as an explicit limit, never inferred", () => {
    const result = verify({ frozenCeiling: { unavailable: true } });
    expect(result.limits.join("|")).toContain("frozen_ceiling_unavailable");
    expect(result.verified.join("|")).not.toContain(
      "independently supplied frozen-time ceiling",
    );
    // An internally consistent entry that dropped the frozen-time restriction passes ONLY while the ceiling is unavailable (the
    // limit); the same entry fails as soon as the independent frozen-time ceiling is supplied.
    const weaker = {
      ...frozen,
      effective_usage_class: "assertable",
      frozen_state_hash: frozenStateHash(claim.content_hash, {
        state: "confirmed",
        reduced_usage_class: "assertable",
        effective_usage_class: "assertable",
      }),
    };
    expect(
      verify({
        entry: weaker,
        frozenCeiling: { unavailable: true },
      }).limits.join("|"),
    ).toContain("frozen_ceiling_unavailable");
    expect(code(() => verify({ entry: weaker }))).toBe(
      "entry_effective_usage_mismatch",
    );
    // Even without the ceiling the reduced usage bounds the effective class from below.
    const silentLog = [e1, mk("usage_change", 2, "silent")];
    const silentEntry = freezeClaimPrefix(claim, silentLog, "assertable");
    const lax = {
      ...silentEntry,
      effective_usage_class: "assertable",
      frozen_state_hash: frozenStateHash(claim.content_hash, {
        state: "contested",
        reduced_usage_class: "silent",
        effective_usage_class: "assertable",
      }),
    };
    expect(
      code(() =>
        verify({
          entry: lax,
          live: silentLog,
          frozenCeiling: { unavailable: true },
        }),
      ),
    ).toBe("entry_effective_less_strict_than_reduced");
  });

  it("always names the historical-visibility limit: completeness at the freeze instant is not provable from a cursor", () => {
    expect(verify().limits[0]).toContain("historical_visibility_unprovable");
    const nullEntry = freezeClaimPrefix(claim, [], "assertable");
    const withLater = verify({
      entry: nullEntry,
      live: [e1],
      frozenCeiling: "assertable",
      currentCeiling: "assertable",
    });
    expect(withLater.verified.join("|")).toContain(
      "null cursor binds the empty prefix",
    );
    expect(withLater.materialDifference).toBe(true);
    expect(withLater.limits[0]).toContain("historical_visibility_unprovable");
  });

  it("detects cursor mismatches and changed resulting state or usage", () => {
    const withCursor = (c: unknown): unknown => ({
      ...frozen,
      state_event_cursor: c,
    });
    expect(
      code(() =>
        verify({
          entry: withCursor({
            claim_state_event_id: uuid(999),
            event_sequence: 2,
          }),
        }),
      ),
    ).toBe("cursor_event_unknown");
    expect(
      code(() =>
        verify({
          entry: withCursor({
            claim_state_event_id: e2.claim_state_event_id,
            event_sequence: 1,
          }),
        }),
      ),
    ).toBe("cursor_sequence_mismatch");
    const contested = freezeClaimPrefix(claim, [e1], "hedged_only");
    expect(
      code(() =>
        verify({
          entry: { ...contested, state_event_cursor: null },
          live: [e1],
        }),
      ),
    ).toBe("entry_reduction_mismatch");
    expect(
      code(() =>
        verify({
          entry: withCursor({
            claim_state_event_id: e1.claim_state_event_id,
            event_sequence: 1,
          }),
        }),
      ),
    ).toBe("entry_reduction_mismatch");
    for (const patch of [
      { frozen_state: "expired" },
      { reduced_usage_class: "silent" },
      { effective_usage_class: "silent" },
      { frozen_state_hash: "0".repeat(64) },
      { claim_content_hash: "1".repeat(64) },
      { initial_status: "expired" },
      { claim_id: other.claim_id },
    ])
      expect(
        code(() => verify({ entry: { ...frozen, ...patch } })),
        JSON.stringify(patch),
      ).not.toBe("accepted");
    expect(
      code(() =>
        verify({ entry: { ...frozen, frozen_state_hash: undefined } }),
      ),
    ).toBe("entry_state_hash_mismatch");
  });

  it("tamper characterization: the frozen hash is NOT a proof of event history", () => {
    // reason, actor and timestamp are outside the three-field state hash and the cursor only names the last event
    const reasonOnly = parseClaimStateEvent({
      ...rawEvent({
        type: "contest",
        seq: 1,
        claim: claim.claim_id,
        reason: "rewritten",
        at: "1999-01-01T00:00:00Z",
      }),
      claim_state_event_id: e1.claim_state_event_id,
    });
    expect(verify({ live: [reasonOnly, e2] }).materialDifference).toBe(false); // undetected
    // an intermediate event replaced by another that preserves the final reduction is also undetected
    const intermediate = parseClaimStateEvent({
      ...rawEvent({ type: "demote", seq: 1, claim: claim.claim_id }),
      claim_state_event_id: e1.claim_state_event_id,
    });
    expect(verify({ live: [intermediate, e2] }).materialDifference).toBe(false); // undetected
    // whereas a change to the resulting state, the cursor event or the sequence IS detected
    const changesResult = parseClaimStateEvent({
      ...rawEvent({ type: "tombstone", seq: 2, claim: claim.claim_id }),
      claim_state_event_id: e2.claim_state_event_id,
    });
    expect(code(() => verify({ live: [e1, changesResult] }))).toBe(
      "entry_reduction_mismatch",
    );
    const moved = parseClaimStateEvent({
      ...rawEvent({ type: "confirm", seq: 3, claim: claim.claim_id }),
      claim_state_event_id: e2.claim_state_event_id,
    });
    expect(code(() => verify({ live: [e1, moved] }))).toBe(
      "cursor_sequence_mismatch",
    );
  });

  it("rejects malformed entries and logs", () => {
    expect(code(() => verify({ entry: null }))).toBe("entry_shape");
    expect(code(() => verify({ entry: { claim_id: claim.claim_id } }))).toBe(
      "entry_shape",
    );
    expect(code(() => verify({ live: [mk("confirm", 2)] }))).toBe(
      "log_first_sequence_not_one",
    );
    expect(
      code(() => verify({ live: [mk("confirm", 1, undefined, other)] })),
    ).toBe("event_wrong_claim");
  });
});
