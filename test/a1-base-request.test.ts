import { describe, expect, it } from "vitest";

import {
  baseRequestHash,
  projectBaseRequest,
} from "../src/identity/fingerprints.js";
import {
  checkFixtureRequestOwnership,
  RequestRejected,
} from "../src/identity/fixture-render-ownership.js";
import { ProfileRejected } from "../src/identity/profile-errors.js";
import {
  requestBaseHash,
  selectBaseRequestProjection,
  voiceRenderIdentity,
} from "../src/identity/request.js";

import {
  applyMutations,
  fixtureJson,
  fixtureMappingKeys,
  must,
  type Mutation,
  type Row,
} from "./support/fixture-v046.js";

interface Vector {
  id: string;
  class: string;
  description: string;
  base_block?: number;
  take_index?: number;
  mutations: Mutation[];
  expect: { relation: string; hash?: string; error?: string };
  mechanical_sensitivity?: {
    ownership_error: string;
    paired_rejection_vector: string;
  };
}
const file = fixtureJson("base_request_hash_conformance.json") as {
  baseline: {
    hash: string;
    input_record: Row;
    projection: Row;
    block_sequence: number;
  };
  script_context: { program_block_order: string[]; turns: Row[] };
  actual_blocks: {
    expected_hash: string;
    input_record: Row;
    render_block_sequence: number;
  }[];
  vectors: Vector[];
};
// Hashing v0.1.5 7.1: one active grouping rule (UUID-free rendering identity); there is no caller-selectable candidate.
const conditionalHash = requestBaseHash;
const conditionalProjection = selectBaseRequestProjection;
const baseline = file.baseline;
const context = file.script_context;
const mapping = fixtureMappingKeys();
const blockRecords = new Map(
  file.actual_blocks.map((b) => [b.render_block_sequence, b.input_record]),
);

describe("TTS base-request nested projection (Hashing 7.1) against shipped vectors", () => {
  it("reproduces the baseline projection and hash from the resolved record", () => {
    expect(conditionalProjection(baseline.input_record)).toEqual(
      baseline.projection,
    );
    expect(conditionalHash(baseline.input_record)).toBe(baseline.hash);
    expect(
      Object.keys(conditionalProjection(baseline.input_record)),
    ).toHaveLength(11);
    expect(baseline.hash).toMatch(/^v1:[0-9a-f]{64}$/);
  });

  it("reproduces the nine actual block baselines, their stored projections and ownership", () => {
    const stored = fixtureJson("render_request_projections.json") as {
      hash_form: string;
      projections: {
        base_request_hash: string;
        projection: Row;
        render_block_sequence: number;
      }[];
    };
    expect(stored.hash_form).toBe("v1:sha256(canonical_json(projection))");
    expect(file.actual_blocks).toHaveLength(9);
    expect(stored.projections).toHaveLength(9);
    for (const block of file.actual_blocks) {
      const projection = stored.projections.find(
        (p) => p.render_block_sequence === block.render_block_sequence,
      );
      expect(
        conditionalProjection(block.input_record),
        `rb${String(block.render_block_sequence)}`,
      ).toEqual(projection?.projection);
      expect(conditionalHash(block.input_record)).toBe(block.expected_hash);
      expect(block.expected_hash).toBe(projection?.base_request_hash);
      expect(() => {
        checkFixtureRequestOwnership(block.input_record, context);
      }).not.toThrow();
    }
  });

  it("reproduces all 132 vectors (93 hash-bearing, 27 ownership-rejection, 12 closed-mapping): hashes, relations and named rejections", () => {
    expect(file.vectors).toHaveLength(132);
    const counts = new Map<string, number>();
    for (const vector of file.vectors) {
      counts.set(
        vector.id.slice(0, 2),
        (counts.get(vector.id.slice(0, 2)) ?? 0) + 1,
      );
      const base = blockRecords.get(
        vector.base_block ?? baseline.block_sequence,
      );
      if (!base) throw new Error(`No base block for ${vector.id}`);
      const baseHash = conditionalHash(base);
      const record = applyMutations(base, vector.mutations);
      const relation = vector.expect.relation;
      if (relation === "same" || relation === "different") {
        const hash = conditionalHash(record);
        expect(hash, vector.id).toBe(vector.expect.hash);
        expect(hash === baseHash ? "same" : "different", vector.id).toBe(
          relation,
        );
      } else if (relation === "reject") {
        let rejected: unknown;
        try {
          checkFixtureRequestOwnership(record, context);
        } catch (error) {
          rejected = error;
        }
        expect(rejected, vector.id).toBeInstanceOf(RequestRejected);
        expect((rejected as RequestRejected).code, vector.id).toBe(
          vector.expect.error,
        );
      } else {
        // Fixture-scoped membership against the closed mapping (support code, not production code).
        const take = Number(
          vector.take_index ??
            (relation === "known_request" ? 0 : (record.take_index ?? 0)),
        );
        const key = `${conditionalHash(record)}|${String(take)}`;
        expect(mapping.has(key), vector.id).toBe(relation === "known_request");
      }
    }
    expect(Object.fromEntries(counts)).toEqual({
      P2: 9,
      SN: 54,
      ST: 30,
      OW: 27,
      UN: 8,
      KN: 4,
    });
  });

  it("keeps take_index and non-render metadata out of the hash and never reads them", () => {
    const hash = conditionalHash(baseline.input_record);
    for (const takeIndex of [1, 7, -1, "x"])
      expect(
        conditionalHash({ ...baseline.input_record, take_index: takeIndex }),
      ).toBe(hash);
    expect(
      conditionalHash({
        ...baseline.input_record,
        admin: { z: 1 },
        output: null,
        reservation: [],
      }),
    ).toBe(hash);
    expect(() => {
      checkFixtureRequestOwnership(
        { ...baseline.input_record, take_index: -1 },
        context,
      );
    }).toThrow(/take_index_invalid/);
  });

  it("treats NFC and NFD spellings of spoken text as the same request", () => {
    const record = structuredClone(baseline.input_record) as {
      turns: { spoken_text: string }[];
    };
    const first = record.turns[0];
    if (!first) throw new Error("no turn");
    const nfd = {
      ...record,
      turns: [
        {
          ...first,
          spoken_text: first.spoken_text.normalize("NFD").replace("e", "é"),
        },
        ...record.turns.slice(1),
      ],
    };
    const nfc = {
      ...record,
      turns: [
        {
          ...first,
          spoken_text: first.spoken_text.normalize("NFC").replace("e", "é"),
        },
        ...record.turns.slice(1),
      ],
    };
    expect(conditionalHash(nfd)).toBe(conditionalHash(nfc));
  });

  it("fails by name on structurally unusable records", () => {
    const record = structuredClone(baseline.input_record) as {
      voice_versions: Row;
      turns: Row[];
    };
    expect(() =>
      conditionalProjection({ ...record, voice_versions: {} }),
    ).toThrow(/voice_binding_missing/);
    expect(() => conditionalProjection({ ...record, turns: "no" })).toThrow(
      /turns must be an array/,
    );
    const withoutScene = Object.fromEntries(
      Object.entries(baseline.input_record).filter(
        ([key]) => key !== "scene_config",
      ),
    );
    expect(() => conditionalProjection(withoutScene)).toThrow(/scene_config/);
  });

  it("leaves the existing top-level API behavior unchanged and idempotent on a selected projection", () => {
    const projection = conditionalProjection(baseline.input_record);
    expect(projectBaseRequest(projection)).toEqual(projection);
    expect(baseRequestHash(projection)).toBe(baseline.hash);
  });
});

describe("voice render identity normalizes before deduplicating and sorting (repair regression)", () => {
  // Built from code points so no formatter can change which spelling a literal uses.
  const eNfc = String.fromCodePoint(0xe9);
  const eNfd = String.fromCodePoint(0x65, 0x301);
  const voice = (compatibility: string[]): Row => ({
    ...(baseline.input_record.voice_versions as Record<string, Row>).tully,
    provider_model_compatibility: compatibility,
  });

  it("uses distinct NFC and NFD spellings in this regression", () => {
    expect(eNfc).not.toBe(eNfd);
    expect(eNfd.normalize("NFC")).toBe(eNfc);
  });

  it("yields identical projections and hashes for NFC and NFD spellings of the same list", () => {
    const nfc = voiceRenderIdentity(voice([eNfc, "z"]));
    const nfd = voiceRenderIdentity(voice(["z", eNfd]));
    expect(nfd).toEqual(nfc);
    // Code-point order: "z" (U+007A) sorts before U+00E9.
    expect(nfc.provider_model_compatibility).toEqual(["z", eNfc]);
    const record = (compat: string[]): unknown => ({
      ...baseline.input_record,
      concrete_model_identity: "z",
      voice_versions: {
        ...(baseline.input_record.voice_versions as Record<string, Row>),
        tully: voice(compat),
      },
    });
    expect(conditionalHash(record([eNfd, "z"]))).toBe(
      conditionalHash(record([eNfc, "z"])),
    );
    expect(conditionalHash(record([eNfd, "z"]))).not.toBe(
      conditionalHash(record(["z"])),
    );
  });

  it("collapses equivalent duplicate spellings into the governed unique code-point-sorted list", () => {
    expect(
      voiceRenderIdentity(voice(["z", eNfd, eNfc, "z"]))
        .provider_model_compatibility,
    ).toEqual(["z", eNfc]);
    // Code-point order, not UTF-16 order: U+E000 sorts before U+1F600.
    expect(
      voiceRenderIdentity(
        voice([String.fromCodePoint(0x1f600), String.fromCodePoint(0xe000)]),
      ).provider_model_compatibility,
    ).toEqual([String.fromCodePoint(0xe000), String.fromCodePoint(0x1f600)]);
    expect(() =>
      voiceRenderIdentity(voice([String.fromCharCode(0xd800)])),
    ).toThrow(/surrogate/);
    expect(() => voiceRenderIdentity(voice([" "]))).toThrow(/nonblank/);
  });
});

describe("pronunciation grouping (Hashing v0.1.5 7.1): rendering identity, voice resolver, structural domain", () => {
  const blockRecord = (sequence: number): Row =>
    must(
      file.actual_blocks.find((b) => b.render_block_sequence === sequence),
      `block ${String(sequence)}`,
    ).input_record;
  const appliedBlocks = file.actual_blocks.filter(
    (b) => (b.input_record.pronunciation_applications as unknown[]).length > 0,
  );
  const rejection = (fn: () => unknown): string => {
    try {
      fn();
    } catch (error) {
      return error instanceof ProfileRejected ? error.code : "other";
    }
    return "accepted";
  };

  it("four of the nine actual blocks carry pronunciation applications (six applications in total)", () => {
    expect(appliedBlocks.map((b) => b.render_block_sequence)).toEqual([
      2, 3, 4, 7,
    ]);
    expect(
      appliedBlocks.reduce(
        (n, b) =>
          n + (b.input_record.pronunciation_applications as unknown[]).length,
        0,
      ),
    ).toBe(6);
  });

  it("labels exactly the ownership-invalid hash-bearing vectors as mechanical_sensitivity and pairs each with a rejection vector", () => {
    const rejectionIds = new Map<string, string[]>();
    for (const v of file.vectors)
      if (v.expect.relation === "reject")
        rejectionIds.set(v.expect.error ?? "", [
          ...(rejectionIds.get(v.expect.error ?? "") ?? []),
          v.id,
        ]);
    const expected = new Map<string, string>();
    for (const vector of file.vectors) {
      if (
        vector.expect.relation !== "same" &&
        vector.expect.relation !== "different"
      )
        continue;
      const record = applyMutations(
        must(
          blockRecords.get(vector.base_block ?? baseline.block_sequence),
          "base",
        ),
        vector.mutations,
      );
      try {
        checkFixtureRequestOwnership(record, context);
      } catch (error) {
        expected.set(vector.id, (error as RequestRejected).code);
      }
    }
    expect(expected.size).toBe(23);
    expect(expected.has("SN015")).toBe(true);
    expect(expected.has("SN049")).toBe(true);
    const labelled = new Map(
      file.vectors
        .filter((v) => v.mechanical_sensitivity !== undefined)
        .map((v) => [v.id, v.mechanical_sensitivity?.ownership_error ?? ""]),
    );
    expect(Object.fromEntries(labelled)).toEqual(Object.fromEntries(expected));
    for (const v of file.vectors) {
      const label = v.mechanical_sensitivity;
      if (label)
        expect(rejectionIds.get(label.ownership_error), v.id).toContain(
          label.paired_rejection_vector,
        );
    }
  });

  it("a consistent pronunciation/rendering/voice UUID relabel leaves the hash unchanged on every applied block", () => {
    for (const block of appliedBlocks) {
      const record = structuredClone(block.input_record) as {
        voice_versions: Record<string, Row>;
        turns: Row[];
        pronunciation_applications: Row[];
      };
      const ids = new Map<string, string>();
      const fresh = (old: unknown): string => {
        const key = String(old);
        if (!ids.has(key))
          ids.set(
            key,
            `cf000000-0000-4000-8000-${String(ids.size + 1).padStart(12, "0")}`,
          );
        return must(ids.get(key));
      };
      for (const voice of Object.values(record.voice_versions)) {
        voice.voice_profile_version_id = fresh(voice.voice_profile_version_id);
        voice.voice_profile_id = fresh(voice.voice_profile_id);
      }
      for (const turn of record.turns)
        turn.voice_profile_version_id =
          ids.get(String(turn.voice_profile_version_id)) ??
          turn.voice_profile_version_id;
      for (const a of record.pronunciation_applications) {
        for (const key of [
          "pronunciation_id",
          "pronunciation_rendering_id",
          "rendering_pronunciation_id",
          "canonical_current_pronunciation_id",
        ])
          a[key] = fresh(a[key]);
        a.voice_profile_version_id =
          ids.get(String(a.voice_profile_version_id)) ??
          a.voice_profile_version_id;
      }
      expect(requestBaseHash(record), String(block.render_block_sequence)).toBe(
        block.expected_hash,
      );
    }
  });

  it("descending rendering UUIDs, every application permutation and a key-order shuffle leave the hash unchanged", () => {
    const block = must(
      appliedBlocks.find((b) => b.render_block_sequence === 3),
      "block 3",
    );
    const record = structuredClone(block.input_record) as {
      pronunciation_applications: Row[];
    };
    const desc = structuredClone(record);
    for (const a of desc.pronunciation_applications)
      a.pronunciation_rendering_id = `ffffffff-0000-4000-8000-${Array.from(String(a.pronunciation_rendering_id).slice(-12)).reverse().join("")}`;
    expect(requestBaseHash(desc)).toBe(block.expected_hash);
    const [x, y] = record.pronunciation_applications;
    expect(
      requestBaseHash({ ...record, pronunciation_applications: [y, x] }),
    ).toBe(block.expected_hash);
    const shuffled = Object.fromEntries(
      Object.entries({
        ...record,
        pronunciation_applications: record.pronunciation_applications.map((a) =>
          Object.fromEntries(Object.entries(a).reverse()),
        ),
      }).reverse(),
    );
    expect(requestBaseHash(shuffled)).toBe(block.expected_hash);
  });

  it("identical-content rows with fresh UUIDs merge into one entry; the same span twice is rejected", () => {
    const record = structuredClone(blockRecord(2)) as {
      pronunciation_applications: Row[];
    };
    const first = must(record.pronunciation_applications[0], "application");
    const adjacent = (extra: Row): Row => ({
      ...first,
      start_offset: Number(first.start_offset) + 1,
      end_offset: Number(first.end_offset) + 1,
      ...extra,
    });
    const shared = {
      ...record,
      pronunciation_applications: [first, adjacent({})],
    };
    const fresh = {
      ...record,
      pronunciation_applications: [
        first,
        adjacent({
          pronunciation_rendering_id: "00000000-0000-4000-8000-0000000000aa",
          pronunciation_id: "00000000-0000-4000-8000-0000000000ab",
        }),
      ],
    };
    expect(requestBaseHash(fresh)).toBe(requestBaseHash(shared));
    const entries = selectBaseRequestProjection(fresh)
      .applied_pronunciation_rendering_versions as {
      applications: unknown[];
    }[];
    expect(entries).toHaveLength(1);
    expect(entries[0]?.applications).toHaveLength(2);
    expect(
      rejection(() =>
        requestBaseHash({
          ...record,
          pronunciation_applications: [
            first,
            {
              ...first,
              pronunciation_rendering_id:
                "00000000-0000-4000-8000-0000000000ac",
            },
          ],
        }),
      ),
    ).toBe("duplicate_pronunciation_application");
  });

  it("voice resolver: unresolved, ambiguous and missing bindings are rejected by name; production ownership validation also rejects the first", () => {
    const base = structuredClone(blockRecord(3)) as {
      voice_versions: Record<string, Row>;
      pronunciation_applications: Row[];
      turns: Row[];
    };
    const unresolved = structuredClone(base);
    must(
      unresolved.pronunciation_applications[0],
      "app",
    ).voice_profile_version_id = "cf0000bb-0000-4000-8000-000000000001";
    expect(rejection(() => requestBaseHash(unresolved))).toBe(
      "unresolved_voice_reference",
    );
    expect(() => {
      checkFixtureRequestOwnership(unresolved, context);
    }).toThrow(/pronunciation_wrong_voice/);
    const ambiguous = structuredClone(base);
    const [firstVoice] = Object.values(ambiguous.voice_versions);
    ambiguous.voice_versions.zz_extra_participant = structuredClone(
      must(firstVoice, "voice"),
    );
    expect(rejection(() => requestBaseHash(ambiguous))).toBe(
      "ambiguous_voice_reference",
    );
    const missing = structuredClone(base);
    Reflect.deleteProperty(
      missing.voice_versions,
      String(must(missing.turns[0], "turn").participant_id),
    );
    expect(rejection(() => requestBaseHash(missing))).toBe(
      "voice_binding_missing",
    );
    const outside = structuredClone(base);
    must(outside.pronunciation_applications[0], "app").semantic_turn_id = "t99";
    expect(rejection(() => requestBaseHash(outside))).toBe(
      "pronunciation_application_turn_unresolved",
    );
  });

  it("a change to the rendering's own voice content changes the hash", () => {
    const base = structuredClone(blockRecord(3)) as {
      voice_versions: Record<string, Row>;
      turns: Row[];
    };
    const participant = String(must(base.turns[0], "turn").participant_id);
    const voice = must(base.voice_versions[participant], "voice");
    (voice.provider_model_compatibility as string[]).push("fixture-model-9");
    expect(requestBaseHash(base)).not.toBe(
      must(file.actual_blocks.find((b) => b.render_block_sequence === 3))
        .expected_hash,
    );
  });

  it("the projection is total over its structural domain: an ownership-invalid but well-formed record still hashes (SN015, SN049)", () => {
    for (const id of ["SN015", "SN049"]) {
      const vector = must(
        file.vectors.find((v) => v.id === id),
        id,
      );
      const record = applyMutations(
        must(
          blockRecords.get(vector.base_block ?? baseline.block_sequence),
          "base",
        ),
        vector.mutations,
      );
      expect(() => {
        checkFixtureRequestOwnership(record, context);
      }, id).toThrow(RequestRejected);
      expect(requestBaseHash(record), id).toBe(vector.expect.hash);
    }
  });
});
