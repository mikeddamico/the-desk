import { describe, expect, it } from "vitest";

import { openFixturePack } from "../src/fixture/pack.js";
import { deepFreeze, type Tables } from "../src/fixture/rows.js";
import { VerifiedFixture } from "../src/fixture/snapshot.js";
import { verifyRows } from "../src/fixture/verify.js";
import { fingerprint } from "../src/identity/fingerprints.js";
import {
  consistentPack,
  editJson,
  editRows,
  list,
  must,
  obj,
  rowOf,
  type Json,
} from "./support/fixture-pack.js";

// Regressions for the A2 repair: every mutation below is accepted by pack integrity (PACK_MEMBERS is recomputed) and by
// the row-shape layer, so it reaches the verification layer. Each is checked BEFORE insertion (VerifiedFixture.fromPack) and
// against rows presented as if read back from the database (verifyRows over a mutated clone of the verified rows).
const code = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code ?? (error as Error).message;
  }
  return "accepted";
};
const verifyPack = (edit: (t: Record<string, Json[]>) => void): string =>
  code(() =>
    VerifiedFixture.fromPack(
      consistentPack((m) => {
        editRows(m, edit);
      }),
    ),
  );

const real = VerifiedFixture.fromPack(openFixturePack());
function cloneTables(): Record<string, Json[]> {
  return JSON.parse(JSON.stringify(real.rows.tables)) as Record<string, Json[]>;
}
const verifyReadBack = (edit: (t: Record<string, Json[]>) => void): string => {
  const tables = cloneTables();
  edit(tables);
  return code(() => {
    verifyRows(
      deepFreeze(tables as unknown as Tables),
      real.context,
      real.historical,
    );
  });
};

const gateStage = (t: Record<string, Json[]>, stage: string): Json =>
  must(
    t.gate_results?.find((g) => obj(g.result).fingerprint_stage === stage),
    `${stage} gate result`,
  );
const stageFingerprint = (stage: string): string =>
  must(real.context.gates[stage] as { fingerprint: string } | undefined, stage)
    .fingerprint;

const mutations: [string, string, (t: Record<string, Json[]>) => void][] = [
  [
    "a claims_writing gate result carrying the valid performance fingerprint",
    "gate_result_fingerprint_mismatch",
    (t) => {
      gateStage(t, "claims_writing").input_fingerprint =
        stageFingerprint("performance");
    },
  ],
  [
    "render_blocks[0].speaker_map[0].participant_id replaced by tully",
    "speaker_map_participant_mismatch",
    (t) => {
      obj(list(rowOf(t, "render_blocks").speaker_map)[0]).participant_id =
        "tully";
    },
  ],
  [
    "render_blocks[0].speaker_map[0].voice_profile_version_id replaced by another existing voice",
    "base_request_hash_mismatch",
    (t) => {
      const entry = obj(list(rowOf(t, "render_blocks").speaker_map)[0]);
      const other = must(
        t.voice_profile_versions?.find(
          (v) => v.voice_profile_version_id !== entry.voice_profile_version_id,
        ),
      );
      entry.voice_profile_version_id = other.voice_profile_version_id;
    },
  ],
  [
    "voice_profile_versions[0].render_fields.provider_voice_id changed (base_request_hash retained)",
    "base_request_hash_mismatch",
    (t) => {
      obj(rowOf(t, "voice_profile_versions").render_fields).provider_voice_id =
        "fixture_voice_other";
    },
  ],
];

describe("accepted invalid mutations are rejected below pack integrity", () => {
  for (const [label, expected, edit] of mutations) {
    it(`pre-insertion: ${label}`, () => {
      expect(verifyPack(edit)).toBe(expected);
    });
    it(`persisted rows after read-back: ${label}`, () => {
      expect(verifyReadBack(edit)).toBe(expected);
    });
  }

  it("the real rows pass the same read-back verification unchanged", () => {
    expect(verifyReadBack(() => undefined)).toBe("accepted");
  });
});

describe("gate results are bound to their exact governed stage", () => {
  it("rejects a declared fingerprint_stage that disagrees with the gate definition's stage, even with that stage's own valid fingerprint", () => {
    const relabel = (t: Record<string, Json[]>): void => {
      const gate = gateStage(t, "claims_writing");
      obj(gate.result).fingerprint_stage = "performance";
      gate.input_fingerprint = stageFingerprint("performance");
    };
    expect(verifyPack(relabel)).toBe("gate_result_stage_mismatch");
    expect(verifyReadBack(relabel)).toBe("gate_result_stage_mismatch");
  });

  it("rejects the semantic_audit fingerprint (a valid stage fingerprint) on a render gate", () => {
    const swap = (t: Record<string, Json[]>): void => {
      gateStage(t, "render").input_fingerprint =
        stageFingerprint("semantic_audit");
    };
    expect(verifyPack(swap)).toBe("gate_result_fingerprint_mismatch");
  });

  it("rejects a gate result whose attempt, definition or coverage is altered", () => {
    expect(
      verifyReadBack((t) => {
        t.gate_results = t.gate_results?.slice(1) ?? [];
      }),
    ).toBe("gate_result_missing");
  });
});

describe("stage projections are derived from rows, not from shipped records", () => {
  it("rejects a self-consistent shipped projection+fingerprint (and matching gate rows) that disagrees with the rows", () => {
    const bogus = "f".repeat(64);
    const projection = {
      ...(obj(real.context.gates.claims_writing).input_projection as Json),
      script_hash: bogus,
    };
    const forged = fingerprint("claims_writing", projection);
    const outcome = code(() =>
      VerifiedFixture.fromPack(
        consistentPack((m) => {
          editJson(m, "gate_fingerprint_inputs.json", (d) => {
            obj(d.claims_writing).input_projection = projection;
            obj(d.claims_writing).fingerprint = forged;
          });
          editRows(m, (t) => {
            for (const g of t.gate_results ?? [])
              if (obj(g.result).fingerprint_stage === "claims_writing")
                g.input_fingerprint = forged;
          });
        }),
      ),
    );
    expect(outcome).toBe("stage_projection_mismatch");
  });

  it("derives the assembly lineage from take selections: two live approved selections for one block are rejected", () => {
    expect(
      verifyReadBack((t) => {
        const superseding = must(
          t.take_selections?.find((s) => s.supersedes_selection_id !== null),
        );
        superseding.supersedes_selection_id = null;
        const rejected = must(
          t.take_selections?.find((s) => s.decision === "rejected"),
        );
        rejected.decision = "approved";
      }),
    ).toBe("selected_take_cardinality");
  });

  it("derives the READY identity from the production attempt row", () => {
    expect(
      verifyReadBack((t) => {
        const production = must(
          t.program_runs?.find((r) => r.purpose === "production"),
        );
        const attempt = must(
          t.program_run_attempts?.find(
            (a) => a.program_run_id === production.program_run_id,
          ),
        );
        attempt.attempt_id = "00000000-0000-4000-8000-0000000000aa";
      }),
    ).toBe("stage_projection_mismatch");
  });
});

describe("render request identities are rebuilt from rows and reconciled", () => {
  it("rejects a pronunciation row altered after the block hash was computed", () => {
    expect(
      verifyReadBack((t) => {
        rowOf(t, "pronunciation_renderings", 1).rendering = "North-brij";
      }),
    ).toBe("base_request_hash_mismatch");
  });

  it("rejects a turn row moved out of the block's program block (ownership against the actual script)", () => {
    const code2 = verifyReadBack((t) => {
      const entry = obj(list(rowOf(t, "render_blocks").speaker_map)[0]);
      const other = must(
        t.turns?.find(
          (x) =>
            x.turn_id !== entry.turn_id &&
            x.program_block_id !== rowOf(t, "render_blocks").program_block_id,
        ),
      );
      entry.turn_id = other.turn_id;
    });
    expect(code2).not.toBe("accepted");
  });

  it("rejects a render block bound to a different script version than the render manifest's", () => {
    expect(
      verifyReadBack((t) => {
        rowOf(t, "render_blocks").render_manifest_id =
          "00000000-0000-4000-8000-000000000000";
      }),
    ).toBe("missing_reference");
  });

  it("rejects an altered intent row that the request record carries", () => {
    expect(
      verifyReadBack((t) => {
        obj(rowOf(t, "performance_intents").intent).value = "flat";
      }),
    ).toBe("base_request_hash_mismatch");
  });
});
