import { describe, expect, it } from "vitest";

import { scriptHash, turnAnchorMap } from "../src/identity/artifacts.js";
import { checkFixtureRequestOwnership } from "../src/identity/fixture-render-ownership.js";
import { ProfileRejected } from "../src/identity/profile-errors.js";
import { requestBaseHash } from "../src/identity/request.js";

import {
  fixtureJson,
  must,
  onlyArtifact,
  payloadOf,
  type Row,
} from "./support/fixture-v046.js";

// Regression: semantic LABELS are normalized (NFC) before uniqueness, lookup and position decisions. The two spellings are
// built from code points so no formatter can normalize the test literals. Storage UUIDs are never normalized.
const NFC = String.fromCodePoint(0xe9);
const NFD = String.fromCodePoint(0x65, 0x301);
type Obj = Record<string, unknown>;
const clone = <T>(v: T): T => structuredClone(v);
const script = (): Obj => clone(payloadOf(onlyArtifact("script_pass1")));
const brief = (): Obj => clone(payloadOf(onlyArtifact("showrunner_brief")));
const code = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    return e instanceof ProfileRejected ? e.code : (e as Error).message;
  }
  return "accepted";
};

describe("label normalization regressions", () => {
  it("uses two distinct spellings of the same label", () => {
    expect(NFC).not.toBe(NFD);
    expect(NFD.normalize("NFC")).toBe(NFC);
  });

  it("prediction candidate ids that are canonically equal are duplicates", () => {
    const s = script();
    const c = s.prediction_candidates as Obj[];
    must(c[0]).prediction_candidate_id = NFC;
    must(c[1]).prediction_candidate_id = NFD;
    expect(code(() => scriptHash(s, { brief: brief() }))).toBe(
      "prediction_duplicate_id",
    );
  });

  it("turn anchors that are canonically equal are duplicate anchors", () => {
    const s = script();
    const turns = s.turns as Obj[];
    must(turns[0]).semantic_turn_id = NFC;
    must(turns[1]).semantic_turn_id = NFD;
    expect(() => turnAnchorMap(turns)).toThrow(/Duplicate turn anchor/);
    expect(() => scriptHash(s, { brief: brief() })).toThrow(
      /Duplicate turn anchor/,
    );
  });

  it("equivalent spellings of an anchor, candidate id, participant and topic thread hash identically; they do not change shipped hashes", () => {
    const original = scriptHash(script(), { brief: brief() });
    expect(original).toBe(onlyArtifact("script_pass1").content_hash);
    const build = (spelling: string, briefSpelling: string): string => {
      const s = script();
      const b = brief();
      must(s.turns as Obj[][number]);
      const turn = must((s.turns as Obj[])[0]);
      turn.semantic_turn_id = `t${spelling}`;
      const cand = must((s.prediction_candidates as Obj[])[0]);
      cand.prediction_candidate_id = `id${spelling}`;
      const mapping = must((b.topic_thread_mappings as Obj[])[0]);
      const threadId = `thr${spelling}`;
      const target = (s.prediction_candidates as Obj[]).filter(
        (c) => c.topic_thread_id === mapping.topic_thread_id,
      );
      mapping.topic_thread_id = `thr${briefSpelling}`;
      for (const c of target) c.topic_thread_id = threadId;
      return scriptHash(s, { brief: b });
    };
    expect(build(NFC, NFC)).toBe(build(NFD, NFD));
    // Topic thread: candidate spelled NFD resolves against a Brief mapping spelled NFC (lookup is canonical).
    expect(build(NFD, NFC)).toBe(build(NFC, NFC));
    expect(build(NFC, NFC)).not.toBe(original);
  });

  it("a prediction participant label equal under NFC resolves; a different label is a conflict", () => {
    const s = script();
    const turns = s.turns as Obj[];
    const cand = must((s.prediction_candidates as Obj[])[0]);
    const turn = must(turns.find((t) => t.turn_id === cand.turn_id));
    const base = String(turn.participant_id);
    turn.participant_id = `${base}${NFC}`;
    cand.participant_id = `${base}${NFD}`;
    expect(code(() => scriptHash(s, { brief: brief() }))).toBe("accepted");
    cand.participant_id = `${base}x`;
    expect(code(() => scriptHash(s, { brief: brief() }))).toBe(
      "prediction_participant_conflict",
    );
  });
});

describe("base request labels (related path)", () => {
  const file = fixtureJson("base_request_hash_conformance.json") as {
    script_context: { program_block_order: string[]; turns: Row[] };
    actual_blocks: { render_block_sequence: number; input_record: Row }[];
  };
  const block = (n: number): Obj =>
    clone(
      must(file.actual_blocks.find((b) => b.render_block_sequence === n))
        .input_record,
    );

  it("equivalent spellings of an application anchor and a participant label hash identically", () => {
    const rename = (turnSpelling: string, appSpelling: string): string => {
      const r = block(3);
      const turns = r.turns as Obj[];
      const apps = r.pronunciation_applications as Obj[];
      const anchors = new Set(apps.map((a) => String(a.semantic_turn_id)));
      for (const t of turns)
        if (anchors.has(String(t.semantic_turn_id)))
          t.semantic_turn_id = `${String(t.semantic_turn_id)}${turnSpelling}`;
      for (const a of apps)
        a.semantic_turn_id = `${String(a.semantic_turn_id)}${appSpelling}`;
      return requestBaseHash(r);
    };
    expect(rename(NFD, NFC)).toBe(rename(NFC, NFC));
    expect(rename(NFC, NFD)).toBe(rename(NFC, NFC));

    const participants = (
      turnSpelling: string,
      keySpelling: string,
    ): string => {
      const r = block(3);
      const voices = r.voice_versions as Record<string, Obj>;
      const old = String(must((r.turns as Obj[])[0]).participant_id);
      voices[`${old}${keySpelling}`] = must(voices[old]);
      Reflect.deleteProperty(voices, old);
      for (const t of r.turns as Obj[])
        if (t.participant_id === old)
          t.participant_id = `${old}${turnSpelling}`;
      return requestBaseHash(r);
    };
    expect(participants(NFD, NFC)).toBe(participants(NFC, NFC));
    expect(participants(NFC, NFD)).toBe(participants(NFC, NFC));
  });

  it("generated turns whose anchors differ only in spelling are rejected; two voice keys that collapse are ambiguous", () => {
    const r = block(3);
    const [first, second] = r.turns as Obj[];
    must(first).semantic_turn_id = `x${NFC}`;
    must(second).semantic_turn_id = `x${NFD}`;
    expect(code(() => requestBaseHash(r))).toBe("duplicate_turn_anchor");
    const v = block(3);
    const voices = v.voice_versions as Record<string, Obj>;
    const [name, entry] = must(Object.entries(voices)[0]);
    voices[`${name}${NFC}`] = clone(entry);
    voices[`${name}${NFD}`] = clone(entry);
    expect(code(() => requestBaseHash(v))).toBe("duplicate_voice_participant");
  });

  it("ownership validation compares anchors in canonical spelling", () => {
    const ctx = clone(file.script_context);
    const r = block(3);
    const turn = must((r.turns as Obj[])[0]);
    const anchor = String(turn.semantic_turn_id);
    const scriptTurn = must(
      ctx.turns.find((t) => t.semantic_turn_id === anchor),
    );
    scriptTurn.semantic_turn_id = `${anchor}${NFC}`;
    turn.semantic_turn_id = `${anchor}${NFD}`;
    for (const a of r.pronunciation_applications as Obj[])
      if (a.semantic_turn_id === anchor) a.semantic_turn_id = `${anchor}${NFD}`;
    for (const i of r.intents as Obj[])
      if (i.scope_ref === anchor) i.scope_ref = `${anchor}${NFD}`;
    expect(() => {
      checkFixtureRequestOwnership(r, ctx);
    }).not.toThrow();
  });
});
