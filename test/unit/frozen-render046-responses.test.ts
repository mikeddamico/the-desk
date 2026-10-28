// Eighty-nine separately registered cases for the historical response-lineage seam. Expected values are typed
// literals from the reviewed Fixture0.4.6 data and the Trace, never computed by the code under test.
import { readFileSync } from "node:fs";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  performanceDirectionHash,
  scriptHash,
  turnAnchorMap,
} from "../../src/identity/artifacts.js";
import {
  asArray,
  asRecord,
  asString,
  type JsonObject,
} from "../../src/identity/select.js";
import {
  fixturePack,
  loadFixtureBytes,
  loadFixtureJson,
  loadFoundationRows,
} from "../../src/fixture/loader.js";
import { verifyLedger } from "../../src/fixture/ledger.js";
import { measureCanonicalPcm } from "../../src/runtime/audio-measurements.js";
import { planFrozenFixture046Render } from "../../src/runtime/frozen-render046.js";
import {
  parseFrozenRender046Sources,
  type FrozenRender046Sources,
} from "../../src/runtime/frozen-render046-input.js";
import {
  deriveFrozenFixture046PlanData,
  type FrozenPlanInputs,
} from "../../src/runtime/frozen-render046-plan.js";
import {
  reconcileFrozenFixture046Responses,
  type LineageCode,
  type LineagePhase,
} from "../../src/runtime/frozen-render046-response-lineage.js";
import {
  verifyFrozenFixture046ResponseLineage,
  type FrozenResponseLineageResult,
} from "../../src/runtime/frozen-render046-responses.js";

// Pass-through spies: the real functions run unless a case queues a one-time override.
vi.mock("../../src/runtime/frozen-render046.js", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../src/runtime/frozen-render046.js")
    >();
  return {
    ...actual,
    planFrozenFixture046Render: vi.fn(actual.planFrozenFixture046Render),
  };
});
vi.mock("../../src/fixture/loader.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/fixture/loader.js")>();
  return {
    ...actual,
    fixturePack: vi.fn(actual.fixturePack),
    loadFixtureBytes: vi.fn(actual.loadFixtureBytes),
    loadFixtureJson: vi.fn(actual.loadFixtureJson),
    loadFoundationRows: vi.fn(actual.loadFoundationRows),
  };
});
vi.mock("../../src/fixture/ledger.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/fixture/ledger.js")>();
  return { ...actual, verifyLedger: vi.fn(actual.verifyLedger) };
});
vi.mock("../../src/runtime/audio-measurements.js", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../src/runtime/audio-measurements.js")
    >();
  return {
    ...actual,
    measureCanonicalPcm: vi.fn(actual.measureCanonicalPcm),
  };
});

const PROFILE = "frozen-fixture046-response-lineage/1";
const INVOCATION = {
  profile: PROFILE,
  purpose: "fixture_conformance",
  environment: "test",
} as const;
const ROOT = new URL("../../", import.meta.url);
const CORPUS = "fixtures/frozen-render046-input/";

const MANIFEST_HASH =
  "60cc91566ad0571be91eae82b62c182eaccb5821fdd94854a6b16aceb71e80e5";
const GATE_FINGERPRINT =
  "68e08e41c499885f359f762514bdf1bfb1b3ac62ef36e49788db69589ebb8250";
const ZIP_SHA256 =
  "7e1bb1108cdd84e47269b9ab2dab20ba934fcec64d44262f86d2b505616b0747";
const PACK_MEMBERS_SHA256 =
  "58a3c5e6188a91eba380c4cb4c08fbebb747513b5979ca9b3b0baab61d5b84fe";
const MECHANICAL_VALIDATION_ID = "b15c0057-e4d9-4874-b863-80303ae41c33";
const PROGRAM_BLOCK_IDS = [
  "cbe4f84a-85e8-4720-861f-ed11f39fbc84",
  "c3df1781-d7e5-44e3-b33e-401f766dd80b",
  "479c96f1-0cc6-4e9d-a111-e8b44283c56e",
  "71d90cda-d830-400b-a85f-23b322cea6ea",
  "8bec3a45-6db4-4189-b57a-ef6767538a19",
  "b6d74c53-1961-460c-9d1f-ef02204a3942",
  "b587f46a-fd0e-4372-ab26-c9baf908b109",
  "808e22d6-795a-4cd5-9ef5-b1c9fec99b10",
  "afd6db20-2275-4352-b613-e2f7dcda0cf7",
] as const;
const BLOCK_HASHES = [
  "v1:c7bedabc83e12fda73442e449f7b3bde36c5a5f4271fddc8215144efcd7b05fa",
  "v1:a958815bba88d2a59f04cbe815fdfb7b4072fe6710d7049dc4582bfa7f053046",
  "v1:bc1ac87eae7f7523fc1361b7acb3fece65036f7118dd978e51e36e33992c3b0f",
  "v1:bb5f3d6d94a839339d60b2141711aec52deb01fc9ce7731bb6fb02e0a7f7dfdf",
  "v1:1fca0a935d7a4d613416d9c1c0d1eb1e51e491ceec647717eb65c9023e302c3e",
  "v1:c6efce12b4a517cdf422fa399beb526b3c8a4c6d6d299f77453394ada6694697",
  "v1:83b332bf1309bc4e78e2fe62352c2e2ad1eb1da0936d7865a96eae74e0002284",
  "v1:e2d4f901c684641ae6ee6834d1244f59d7adac0b1d813c4a7156931e739fa714",
  "v1:9f9041017afd7a33898b53af2cfd9a02d0204a021768fbdb5d1c4c496d8d08ea",
] as const;

interface ExpectedResponse {
  file: string;
  ordinal: number;
  take: number;
  bytes: string;
  frames: string;
  sha: string;
  call: string;
  event: string;
  artifact: string;
  audio: string;
  takeId: string;
}
// Ten historical responses, in (block ordinal, take index) order.
const EXPECTED: readonly ExpectedResponse[] = [
  {
    file: "rb01_take0",
    ordinal: 1,
    take: 0,
    bytes: "10124",
    frames: "5040",
    sha: "3f1c01bcefce4f3100bc1ee24b8a6ddeb2c5d91fd6794313d4211f8e41ca48a2",
    call: "89623913-16e4-4476-9a41-9064531de896",
    event: "460a28a7-abe8-454b-9adb-020bfa878fc2",
    artifact: "66666666-6666-4666-8666-000000000101",
    audio: "88888888-8888-4888-8888-000000000001",
    takeId: "5765fcec-6881-4f9a-afb3-9214b400f497",
  },
  {
    file: "rb02_take0",
    ordinal: 2,
    take: 0,
    bytes: "10604",
    frames: "5280",
    sha: "86539dffd53c4c850341bf2305fbc8be1739bfab9c35ed40fd16f370f55b3457",
    call: "c2171bf3-1d44-40c9-8396-6921aa42993f",
    event: "fc749e97-49c3-4ac7-a774-72561e57accd",
    artifact: "66666666-6666-4666-8666-000000000102",
    audio: "88888888-8888-4888-8888-000000000002",
    takeId: "6cb56ce2-a796-467b-93cb-293847c78bfb",
  },
  {
    file: "rb03_take0",
    ordinal: 3,
    take: 0,
    bytes: "11084",
    frames: "5520",
    sha: "5f525430ca705638a777681b78b5dd55cbfcc2296c90d6516a2ed160f773e7fc",
    call: "fe0f051e-8f55-4c24-b6ae-e54ff1c3ca26",
    event: "6e7046c3-2422-4b69-8bdf-d4b3a4565b20",
    artifact: "66666666-6666-4666-8666-000000000103",
    audio: "88888888-8888-4888-8888-000000000003",
    takeId: "1a6e721c-6707-452c-ba70-63317323fd4d",
  },
  {
    file: "rb04_take0",
    ordinal: 4,
    take: 0,
    bytes: "11564",
    frames: "5760",
    sha: "85d473ba49ebac91577f0cb1604ead4726e3b50e21bea34089da2192910888e8",
    call: "8f91c8a2-b737-43c6-81a1-a020b483399a",
    event: "31afe9be-9c56-4717-a2c4-45e257109c62",
    artifact: "66666666-6666-4666-8666-000000000104",
    audio: "88888888-8888-4888-8888-000000000004",
    takeId: "76ad5960-9799-4f17-883d-53d73ece65a4",
  },
  {
    file: "rb05_take0",
    ordinal: 5,
    take: 0,
    bytes: "12044",
    frames: "6000",
    sha: "91b52c4079cea3c583acd2d073d7b36ab261ff7020e150ae8820851b329d0aa3",
    call: "778a9c2b-8f9c-41d7-b28f-ea647d539213",
    event: "052e08d8-707f-4dec-a739-6abd671b8d2c",
    artifact: "66666666-6666-4666-8666-000000000105",
    audio: "88888888-8888-4888-8888-000000000005",
    takeId: "0f1a0a9b-db19-40ef-bdac-e43d33114bff",
  },
  {
    file: "rb06_take0",
    ordinal: 6,
    take: 0,
    bytes: "12524",
    frames: "6240",
    sha: "0a925157909b6c2be63eec69a244a5800fa42dc7720cb02d45b05b36f6546f01",
    call: "53745adf-5b66-4e73-a8c1-0d484f7751e5",
    event: "0d1be042-f9ed-4b1e-9cef-7e78823cf238",
    artifact: "66666666-6666-4666-8666-000000000106",
    audio: "88888888-8888-4888-8888-000000000006",
    takeId: "8473f24b-4032-45f8-bb9d-af191b8aad5a",
  },
  {
    file: "rb06_take1",
    ordinal: 6,
    take: 1,
    bytes: "13962",
    frames: "6959",
    sha: "e53350354b75007ea4c65783e4d84bbe0398b5180a59d6a325ed183a82061459",
    call: "18024cbd-c455-4cae-a90b-b0a0bd880583",
    event: "b5f3b8da-fa99-4c68-bff7-bfc29dadcfce",
    artifact: "66666666-6666-4666-8666-000000000107",
    audio: "88888888-8888-4888-8888-000000000007",
    takeId: "52c18d60-8d21-4d5e-aac7-f84fd8380752",
  },
  {
    file: "rb07_take0",
    ordinal: 7,
    take: 0,
    bytes: "13004",
    frames: "6480",
    sha: "aaedcdf78ff592e67a0482ce2165194ffe735ad9a7720c978e39154fa7b0b055",
    call: "33528f68-3198-47dc-968e-923fa1896f15",
    event: "ac44db71-f029-4433-865b-cf13666eaae2",
    artifact: "66666666-6666-4666-8666-000000000108",
    audio: "88888888-8888-4888-8888-000000000008",
    takeId: "ac2dd448-20b4-4c71-acd6-6efc1e961dbc",
  },
  {
    file: "rb08_take0",
    ordinal: 8,
    take: 0,
    bytes: "13484",
    frames: "6720",
    sha: "27e6913070a1826de1312bb49c5d9ad2bd580f079df47e148b77965bfa59f8d2",
    call: "f425519d-1c97-40a1-b103-9ffc9e43eeb7",
    event: "ea1e5d39-c297-4695-8b70-1c9c7d543dd7",
    artifact: "66666666-6666-4666-8666-000000000109",
    audio: "88888888-8888-4888-8888-000000000009",
    takeId: "b7a3ac7d-224b-4603-b97d-b566ce20f015",
  },
  {
    file: "rb09_take0",
    ordinal: 9,
    take: 0,
    bytes: "13964",
    frames: "6960",
    sha: "842b7b033dcdd3a40326dcc78029b966f025a30ec7941f21d8aa98de99ddbf06",
    call: "32d92fdd-dc12-47fb-8bab-e2e9c25c2371",
    event: "82ba6e97-e720-491a-9bc7-54b4c7edf7f8",
    artifact: "66666666-6666-4666-8666-000000000110",
    audio: "88888888-8888-4888-8888-000000000010",
    takeId: "81272d4e-61f4-433f-a4c7-f697fd90766e",
  },
];

function at<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) throw new Error("missing test entry");
  return value;
}
function expectedResponses() {
  return EXPECTED.map((item) => {
    const hash = at(BLOCK_HASHES, item.ordinal - 1);
    return {
      block_ordinal: item.ordinal,
      program_block_id: at(PROGRAM_BLOCK_IDS, item.ordinal - 1),
      base_request_hash: hash,
      historical_take_index: item.take,
      logical_request_key: `${hash}:${String(item.take)}`,
      historical_provider_call_id: item.call,
      historical_succeeded_event_id: item.event,
      historical_response_artifact_id: item.artifact,
      historical_audio_row_id: item.audio,
      historical_render_take_id: item.takeId,
      wav: {
        member_path: `fixture_audio/${item.file}.wav`,
        byte_length: item.bytes,
        frame_count: item.frames,
        sha256: item.sha,
        sample_rate_hz: 48000,
        channels: 1,
      },
      provenance: "historical_fixture_v0.4.6_synthetic_response",
      relabeled_as_new_generation: false,
      technical_acceptance: "not_evaluated",
    };
  });
}
function expectedPass() {
  return {
    status: "fixture_response_lineage_pass",
    profile: PROFILE,
    historical_synthetic_verification: true,
    non_clearance: {
      provider_call_authority: false,
      new_take_allocated: false,
      reroll_authorized: false,
      take_selection: false,
      assembly: false,
      ready: false,
      semantic_clearance: false,
      production_clearance: false,
      generated_audio: false,
      speech_fidelity_claimed: false,
      product_duration_claimed: false,
    },
    plan_binding: {
      semantic_manifest_hash: MANIFEST_HASH,
      render_gate_fingerprint: GATE_FINGERPRINT,
      request_count: 9,
    },
    source_receipt: {
      snapshot: "process_cached_verified_pack",
      zip_sha256: ZIP_SHA256,
      pack_members_sha256: PACK_MEMBERS_SHA256,
    },
    responses: expectedResponses(),
    historical_evidence: {
      rb06_take0_recorded_observation_matches_measured_bytes: true,
      mechanical_validation_artifact_id: MECHANICAL_VALIDATION_ID,
    },
  };
}

interface Fresh {
  plan: JsonObject & { requests: JsonObject[] };
  mapping: { entries: JsonObject[] };
  tables: Record<string, JsonObject[]>;
  wavs: { path: string; bytes: Buffer }[];
}
let basePlanned: JsonObject;
let baseMapping: { entries: JsonObject[] };
let baseTables: Record<string, JsonObject[]>;
let baseWavs: { path: string; bytes: Buffer }[];
let masterBytes: Buffer;
let first: FrozenResponseLineageResult;
let second: FrozenResponseLineageResult;
let setup: {
  fixturePackResults: unknown[];
  jsonNames: unknown[];
  rowCalls: number;
  bytesNames: unknown[];
};

function fresh(): Fresh {
  return {
    plan: {
      adapter: "fixture_tts",
      concrete_model_identity: "fixture-model-1.0",
      adapter_render_contract_version: "fixture-adapter-contract-v2",
      semantic_manifest_hash: MANIFEST_HASH,
      render_gate_fingerprint: GATE_FINGERPRINT,
      requests: PROGRAM_BLOCK_IDS.map((id, index) => ({
        block_ordinal: index + 1,
        program_block_id: id,
        base_request_hash: at(BLOCK_HASHES, index),
      })),
    },
    mapping: structuredClone(baseMapping),
    tables: structuredClone(baseTables),
    wavs: baseWavs.map((wav) => ({
      path: wav.path,
      bytes: Buffer.from(wav.bytes),
    })),
  };
}
/** Independent node count: the value itself plus every descendant, with no shared code from the implementation. */
function countNodes(value: unknown): number {
  if (value === null || typeof value !== "object") return 1;
  const children: unknown[] = Array.isArray(value)
    ? (value as unknown[])
    : Object.values(value);
  return children.reduce<number>(
    (total, child) => total + countNodes(child),
    1,
  );
}
/** Declared convention: root (1) + plan + mapping + tables + wavs array (1) + per WAV record, path and bytes leaf (3). */
function bundleNodes(input: Fresh): number {
  return (
    1 +
    countNodes(input.plan) +
    countNodes(input.mapping) +
    countNodes(input.tables) +
    1 +
    3 * input.wavs.length
  );
}
function entry(input: Fresh, index: number): JsonObject {
  return at(input.mapping.entries, index);
}
function receiptOf(input: Fresh, index: number): JsonObject {
  return asRecord(entry(input, index).receipt, "receipt");
}
function wavOf(input: Fresh, index: number) {
  return at(input.wavs, index);
}
function mechanicalPayload(input: Fresh): JsonObject {
  const artifact = at(
    (input.tables.artifacts ?? []).filter(
      (row) => row.artifact_id === MECHANICAL_VALIDATION_ID,
    ),
    0,
  );
  return asRecord(artifact.canonical_payload, "payload");
}
function measurementsOf(input: Fresh): JsonObject {
  return asRecord(mechanicalPayload(input).measurements, "measurements");
}
function corrupt(input: Fresh, index: number): void {
  const bytes = wavOf(input, index).bytes;
  bytes[100] = (bytes[100] ?? 0) ^ 0xff;
}
function truncate(input: Fresh, index: number): void {
  const wav = wavOf(input, index);
  wav.bytes = wav.bytes.subarray(0, wav.bytes.length - 2);
}
function swapFields(
  input: Fresh,
  field: string,
  left: number,
  right: number,
): void {
  const a = entry(input, left);
  const b = entry(input, right);
  const held = a[field];
  a[field] = b[field];
  b[field] = held;
}
function refuses(input: unknown, code: LineageCode, phase: LineagePhase): void {
  expect(reconcileFrozenFixture046Responses(input)).toEqual({
    authority: "none",
    status: "invalid",
    code,
    phase,
  });
}
async function blocked(
  code: LineageCode,
  phase: LineagePhase,
  value: unknown = INVOCATION,
): Promise<FrozenResponseLineageResult> {
  const result = await verifyFrozenFixture046ResponseLineage(value);
  expect(result).toEqual({ status: "blocked", profile: PROFILE, code, phase });
  expect(Object.keys(result).sort()).toEqual([
    "code",
    "phase",
    "profile",
    "status",
  ]);
  return result;
}
function expectNoReads(): void {
  expect(vi.mocked(planFrozenFixture046Render)).not.toHaveBeenCalled();
  expect(vi.mocked(fixturePack)).not.toHaveBeenCalled();
  expect(vi.mocked(loadFixtureJson)).not.toHaveBeenCalled();
  expect(vi.mocked(loadFixtureBytes)).not.toHaveBeenCalled();
  expect(vi.mocked(loadFoundationRows)).not.toHaveBeenCalled();
}
function expectNoPackReads(): void {
  expect(vi.mocked(fixturePack)).not.toHaveBeenCalled();
  expect(vi.mocked(loadFixtureJson)).not.toHaveBeenCalled();
  expect(vi.mocked(loadFixtureBytes)).not.toHaveBeenCalled();
  expect(vi.mocked(loadFoundationRows)).not.toHaveBeenCalled();
}
function assertDeepFrozen(value: unknown): void {
  if (value !== null && typeof value === "object") {
    expect(Object.isFrozen(value)).toBe(true);
    for (const child of Object.values(value)) assertDeepFrozen(child);
  }
}
/** Freezes plain data deeply; the WAV byte arrays are checked separately because typed arrays cannot be frozen. */
function freezeData(value: unknown): void {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeData(child);
    Object.freeze(value);
  }
}
function stubSafeSettings(): void {
  vi.stubEnv("DESK_ENV", "test");
  vi.stubEnv("PROVIDERS_ENABLED", "false");
  vi.stubEnv("GENERATION_KILL_SWITCH", "true");
}
function sourceText(path: string): string {
  return readFileSync(new URL(path, ROOT), "utf8");
}

/** Independently assembled PR36 sources, used only to derive a one-word-mutated plan (case G2). */
function json(path: string): JsonObject {
  return asRecord(
    JSON.parse(readFileSync(new URL(CORPUS + path, ROOT), "utf8")) as unknown,
    "test JSON",
  );
}
function objects(value: unknown): JsonObject[] {
  return asArray(value, "records").map((item) => asRecord(item, "record"));
}
function planInputs(sources: FrozenRender046Sources): FrozenPlanInputs {
  const turns = objects(sources.script.turns);
  const blocks = objects(sources.brief.program_blocks);
  const voiceIds = [
    "d125001c-0000-4000-8000-000000000001",
    "d125001c-0000-4000-8000-000000000002",
    "d125001c-0000-4000-8000-000000000003",
  ];
  const voices = ["tully", "gaz", "simon"].map((participant, index) => ({
    participant_id: participant,
    voice_profile_version_id: at(voiceIds, index),
  }));
  const spans = [
    ["t03", 62, 73],
    ["t04", 0, 11],
    ["t05", 49, 60],
    ["t06", 59, 70],
    ["t07", 125, 136],
    ["t14", 151, 162],
  ] as const;
  return {
    sources,
    selections: {
      voices,
      blocks: blocks.map((block, index) => ({
        program_block_id: asString(block.program_block_id, "block"),
        turn_ids: turns
          .filter((turn) => turn.program_block_id === block.program_block_id)
          .map((turn) => asString(turn.turn_id, "turn")),
        context_recipe_version: index === 0 ? "C0-v1" : "C2-v1",
        context_turn_ids:
          index === 0
            ? []
            : [
                asString(
                  turns
                    .filter(
                      (turn) =>
                        turn.program_block_id ===
                        blocks[index - 1]?.program_block_id,
                    )
                    .at(-1)?.turn_id,
                  "context turn",
                ),
              ],
      })),
      mentions: spans.map(([anchor, start, end]) => {
        const turn = asRecord(
          turns.find((candidate) => candidate.semantic_turn_id === anchor),
          "mention turn",
        );
        return {
          turn_id: asString(turn.turn_id, "mention"),
          start_offset: start,
          end_offset: end,
          pronunciation_id: "d125001d-0000-4000-8000-000000000002",
          pronunciation_rendering_id:
            turn.participant_id === "tully"
              ? "d125001e-0000-4000-8000-000000000002"
              : "d125001e-0000-4000-8000-000000000003",
        };
      }),
    },
    mechanics: {
      provider: "fixture_tts",
      concrete_model_identity: "fixture-model-1.0",
      adapter_render_contract_version: "fixture-adapter-contract-v2",
      provider_capability_version: "fixture-provider-capability-v1",
      render_policy_version: "performance-render-0.1.4",
      show_render_config_version: "postmatch-fixture-v4",
      resolved_generation_settings: {
        temperature: "0.7",
        format: "wav",
        sample_rate_hz: 48000,
        channels: 1,
      },
      scene_config: {
        scene_version: "fixture-scene-v1",
        description: "studio sports analysis",
      },
      named_text_transform_versions: [
        "literal-text-escape/v1",
        "pronunciation-apply/v1",
      ],
    },
  };
}
function mutatedPlanRequests(): JsonObject[] {
  const sources = parseFrozenRender046Sources({
    evidence_package: json("evidence_package.json"),
    brief: json("showrunner_brief.json"),
    script: json("script_pass2.json"),
    direction: json("performance_direction_corrected.json"),
    show_config: json("config/show_config_version.json"),
    support: json("INPUT-SUPPORT.json"),
  });
  // Turn index 8 carries no pronunciation mention, so one appended word changes only request text.
  const turn = asRecord(at(asArray(sources.script.turns, "turns"), 8), "turn");
  turn.spoken_text = `${asString(turn.spoken_text, "text")} Again.`;
  sources.script.script_hash = scriptHash(sources.script, {
    brief: sources.brief,
  });
  sources.direction.script_hash = sources.script.script_hash;
  sources.direction.direction_hash = performanceDirectionHash(
    sources.direction,
    turnAnchorMap(sources.script.turns),
  );
  const derived = deriveFrozenFixture046PlanData(planInputs(sources));
  if (derived.status !== "derived") throw new Error("mutated plan blocked");
  return derived.data.requests.map((request, index) => ({
    block_ordinal: index + 1,
    program_block_id: request.program_block_id,
    base_request_hash: request.base_request_hash,
  }));
}

beforeAll(async () => {
  stubSafeSettings();
  first = await verifyFrozenFixture046ResponseLineage(INVOCATION);
  second = await verifyFrozenFixture046ResponseLineage(INVOCATION);
  setup = {
    fixturePackResults: vi
      .mocked(fixturePack)
      .mock.results.map((item): unknown => item.value),
    jsonNames: vi.mocked(loadFixtureJson).mock.calls.map((call) => call[0]),
    rowCalls: vi.mocked(loadFoundationRows).mock.calls.length,
    bytesNames: vi.mocked(loadFixtureBytes).mock.calls.map((call) => call[0]),
  };
  const planned: unknown = await vi.mocked(planFrozenFixture046Render).mock
    .results[0]?.value;
  basePlanned = structuredClone(asRecord(planned, "planned"));
  baseMapping = structuredClone(
    vi.mocked(loadFixtureJson).mock.results[0]?.value as {
      entries: JsonObject[];
    },
  );
  baseTables = structuredClone(
    (
      vi.mocked(loadFoundationRows).mock.results[0]?.value as {
        tables: Record<string, JsonObject[]>;
      }
    ).tables,
  );
  baseWavs = vi
    .mocked(loadFixtureBytes)
    .mock.calls.slice(0, 10)
    .map((call, index) => ({
      path: call[0],
      bytes: Buffer.from(
        vi.mocked(loadFixtureBytes).mock.results[index]?.value as Buffer,
      ),
    }));
  // Test-only control for case H4. It is read after the wrapper's twelve selections were recorded above and is not a
  // runtime response selection.
  masterBytes = Buffer.from(loadFixtureBytes("fixture_audio/master.wav"));
});
function baselineRows(): ReturnType<typeof loadFoundationRows> {
  return { profile: "baseline", tables: structuredClone(baseTables) };
}
beforeEach(() => {
  // mockReset restores each pass-through spy to the real function and clears calls and queued one-time overrides.
  vi.mocked(verifyLedger).mockReset();
  vi.mocked(measureCanonicalPcm).mockReset();
  for (const spy of [
    vi.mocked(planFrozenFixture046Render),
    vi.mocked(fixturePack),
    vi.mocked(loadFixtureBytes),
    vi.mocked(loadFixtureJson),
    vi.mocked(loadFoundationRows),
  ])
    spy.mockReset();
  // Only the two shared setup invocations are real planner and pack runs. These defaults replay the captured
  // baseline for later wrapper cases; the pure reconciler, ledger and measurer stay real.
  vi.mocked(planFrozenFixture046Render).mockImplementation(() =>
    Promise.resolve(structuredClone(basePlanned) as never),
  );
  vi.mocked(fixturePack).mockImplementation(
    () => setup.fixturePackResults[0] as ReturnType<typeof fixturePack>,
  );
  vi.mocked(loadFixtureJson).mockImplementation((member) => {
    if (member !== "fixture_persistence_conformance.json")
      throw new Error("unexpected member");
    return structuredClone(baseMapping);
  });
  vi.mocked(loadFixtureBytes).mockImplementation((member) => {
    if (member === "fixture_audio/master.wav") return Buffer.from(masterBytes);
    const wav = baseWavs.find((candidate) => candidate.path === member);
    if (wav === undefined) throw new Error("unexpected member");
    return Buffer.from(wav.bytes);
  });
  vi.mocked(loadFoundationRows).mockImplementation(baselineRows);
  stubSafeSettings();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("A. oracle and positive results (real planner and pack)", () => {
  it("A1 full result equals the separately recorded literals for all ten responses", () => {
    expect(first).toEqual(expectedPass());
  });
  it("A2 the planner's nine request identities equal the literals and rb06 shares one hash across two responses", () => {
    const requests = asArray(basePlanned.requests, "requests").map((item) =>
      asRecord(item, "request"),
    );
    expect(
      requests.map((request) => ({
        program_block_id: request.program_block_id,
        base_request_hash: request.base_request_hash,
      })),
    ).toEqual(
      PROGRAM_BLOCK_IDS.map((id, index) => ({
        program_block_id: id,
        base_request_hash: at(BLOCK_HASHES, index),
      })),
    );
    if (first.status !== "fixture_response_lineage_pass")
      throw new Error("expected pass");
    const rb06 = first.responses.filter((item) => item.block_ordinal === 6);
    expect(rb06.map((item) => item.historical_take_index)).toEqual([0, 1]);
    expect(new Set(rb06.map((item) => item.base_request_hash)).size).toBe(1);
  });
  it("A3 two consecutive results are equal, deeply frozen and survive a JSON round trip", () => {
    expect(second).toEqual(first);
    assertDeepFrozen(first);
    expect(JSON.parse(JSON.stringify(first)) as unknown).toEqual(first);
  });
  it("A4 non-clearance flags and provenance are exact and no diagnostic or threshold keys appear", () => {
    const text = JSON.stringify(first);
    for (const forbidden of [
      "diagnostics",
      "below_test_min_frames",
      "minimum_required_frames",
      "technical_validation",
      "decision",
    ])
      expect(text).not.toContain(forbidden);
    if (first.status !== "fixture_response_lineage_pass")
      throw new Error("expected pass");
    const nonClearanceValues: unknown[] = Object.values(first.non_clearance);
    expect(nonClearanceValues.every((value) => value === false)).toBe(true);
    expect(first.responses).toHaveLength(10);
    for (const response of first.responses) {
      expect(response.technical_acceptance).toBe("not_evaluated");
      expect(response.relabeled_as_new_generation).toBe(false);
      expect(response.provenance).toBe(
        "historical_fixture_v0.4.6_synthetic_response",
      );
    }
  });
  it("A5 the rb06 historical evidence is verified and both rb06 responses are present with the recorded frames", () => {
    if (first.status !== "fixture_response_lineage_pass")
      throw new Error("expected pass");
    expect(first.historical_evidence).toEqual({
      rb06_take0_recorded_observation_matches_measured_bytes: true,
      mechanical_validation_artifact_id: MECHANICAL_VALIDATION_ID,
    });
    const frames = first.responses
      .filter((item) => item.block_ordinal === 6)
      .map((item) => item.wav.frame_count);
    expect(frames).toEqual(["6240", "6959"]);
  });
  it("A6 control: every response is below the C0 12,000-frame diagnostic yet the result still passes", () => {
    for (const wav of baseWavs) {
      const measured = measureCanonicalPcm(wav.bytes);
      if (measured.kind !== "measured") throw new Error("expected measured");
      expect(measured.diagnostics).toContain("below_test_min_frames");
    }
    expect(first.status).toBe("fixture_response_lineage_pass");
  });
});

describe("B. invocation and settings refuse before any read", () => {
  it("B1 a supplied receipt key is an invalid invocation with zero reads", async () => {
    await blocked("invalid_invocation", "invocation_context", {
      ...INVOCATION,
      receipt: { status: "fixture_response_lineage_pass" },
    });
    expectNoReads();
  });
  it("B2 a missing key is an invalid invocation with zero reads", async () => {
    await blocked("invalid_invocation", "invocation_context", {
      profile: PROFILE,
      purpose: "fixture_conformance",
    });
    expectNoReads();
  });
  it("B3 a wrong literal is an invalid invocation with zero reads", async () => {
    await blocked("invalid_invocation", "invocation_context", {
      ...INVOCATION,
      purpose: "production",
    });
    expectNoReads();
  });
  it("B4 an accessor property is refused without invoking its getter", async () => {
    const getter = vi.fn(() => "test");
    const value = { profile: PROFILE, purpose: "fixture_conformance" };
    Object.defineProperty(value, "environment", {
      get: getter,
      enumerable: true,
    });
    await blocked("invalid_invocation", "invocation_context", value);
    expect(getter).not.toHaveBeenCalled();
    expectNoReads();
  });
  it("B5 a symbol key is an invalid invocation with zero reads", async () => {
    await blocked("invalid_invocation", "invocation_context", {
      ...INVOCATION,
      [Symbol("extra")]: true,
    });
    expectNoReads();
  });
  it("B6 non-object, array and non-ordinary prototype arguments are invalid invocations with zero reads", async () => {
    class Invocation {
      profile = PROFILE;
      purpose = "fixture_conformance";
      environment = "test";
    }
    for (const value of [
      null,
      "text",
      [],
      Object.create(INVOCATION) as unknown,
      new Invocation(),
    ])
      await blocked("invalid_invocation", "invocation_context", value);
    expectNoReads();
  });
  it("B7 a wrong DESK_ENV is unsafe with zero reads", async () => {
    vi.stubEnv("DESK_ENV", "development");
    await blocked("unsafe_runtime_configuration", "invocation_context");
    expectNoReads();
  });
  it("B8 PROVIDERS_ENABLED true is unsafe with zero reads", async () => {
    vi.stubEnv("PROVIDERS_ENABLED", "true");
    await blocked("unsafe_runtime_configuration", "invocation_context");
    expectNoReads();
  });
  it("B9 GENERATION_KILL_SWITCH false is unsafe with zero reads", async () => {
    vi.stubEnv("GENERATION_KILL_SWITCH", "false");
    await blocked("unsafe_runtime_configuration", "invocation_context");
    expectNoReads();
  });
  it("B10 a differently cased DESK_ENV is unsafe with zero reads", async () => {
    vi.stubEnv("DESK_ENV", "Test");
    await blocked("unsafe_runtime_configuration", "invocation_context");
    expectNoReads();
  });
  it("B11 settings changed during acquisition are caught by the final re-observation", async () => {
    vi.mocked(loadFoundationRows).mockImplementationOnce(() => {
      vi.stubEnv("GENERATION_KILL_SWITCH", "false");
      return baselineRows();
    });
    await blocked("unsafe_runtime_configuration", "invocation_context");
  });
});

describe("C. planner stage", () => {
  it("C1 a blocked planner result is request_plan_blocked before any pack read", async () => {
    vi.mocked(planFrozenFixture046Render).mockResolvedValueOnce({
      status: "blocked",
      profile: "frozen-fixture046-render-planning/1",
      code: "source_hash_mismatch",
      phase: "acquisition_source_identity",
    });
    await blocked("request_plan_blocked", "request_plan");
    expectNoPackReads();
  });
  it("C2 a planner result that is not the exact synthetic pass carrier is plan_identity_invalid before any pack read", async () => {
    const specimens: ((planned: JsonObject) => void)[] = [
      (planned) => {
        asArray(planned.requests, "requests").pop();
      },
      (planned) => {
        planned.status = "fixture_render_planning_other";
      },
      (planned) => {
        planned.profile = "frozen-fixture046-render-planning/2";
      },
      (planned) => {
        planned.fixture_stub = false;
      },
      (planned) => {
        planned.semantic_clearance = true;
      },
      (planned) => {
        planned.production_clearance = true;
      },
      (planned) => {
        asRecord(
          asArray(planned.requests, "requests")[0],
          "request",
        ).program_block_id = "not-a-uuid";
      },
      (planned) => {
        asRecord(
          asArray(planned.requests, "requests")[3],
          "request",
        ).base_request_hash = "0".repeat(64);
      },
      (planned) => {
        planned.semantic_manifest_hash = "Z".repeat(64);
      },
      (planned) => {
        planned.render_gate_fingerprint = "abc";
      },
      (planned) => {
        Reflect.deleteProperty(asArray(planned.requests, "requests"), "3");
      },
      (planned) => {
        const manifest = asRecord(planned.semantic_manifest, "manifest");
        Reflect.deleteProperty(asArray(manifest.render_blocks, "blocks"), "2");
      },
      (planned) => {
        Object.setPrototypeOf(asArray(planned.requests, "requests"), null);
      },
      (planned) => {
        const manifest = asRecord(planned.semantic_manifest, "manifest");
        Object.setPrototypeOf(asArray(manifest.render_blocks, "blocks"), null);
      },
    ];
    for (const edit of specimens) {
      const planned = structuredClone(basePlanned);
      edit(planned);
      vi.mocked(planFrozenFixture046Render).mockResolvedValueOnce(
        planned as never,
      );
      await blocked("plan_identity_invalid", "request_plan");
      expectNoPackReads();
    }
  });
});

describe("D. pure input closure", () => {
  it("D1 an unexpected top-level key is input_shape_invalid", () => {
    const input: unknown = { ...fresh(), extra: 1 };
    refuses(input, "input_shape_invalid", "input_closure");
  });
  it("D2 an accessor in the input is refused without invoking its getter", () => {
    const input = fresh();
    const getter = vi.fn(() => []);
    Object.defineProperty(input.mapping, "entries", {
      get: getter,
      enumerable: true,
    });
    refuses(input, "input_shape_invalid", "input_closure");
    expect(getter).not.toHaveBeenCalled();
  });
  it("D3 a sparse mapping entries array is input_shape_invalid", () => {
    const input = fresh();
    Reflect.deleteProperty(input.mapping.entries, "3");
    refuses(input, "input_shape_invalid", "input_closure");
  });
  it("D4 exotic table values are refused and the root-relative depth 16 and 100,000-node bounds admit equality and refuse excess", () => {
    class Row {
      artifact_id = "x";
    }
    const withMap = fresh();
    withMap.tables.artifacts = new Map() as never;
    refuses(withMap, "input_shape_invalid", "input_closure");
    const withClass = fresh();
    withClass.tables.artifacts = [new Row() as never];
    refuses(withClass, "input_shape_invalid", "input_closure");
    const withSymbol = fresh();
    const row = at(withSymbol.tables.artifacts ?? [], 0);
    Object.defineProperty(row, Symbol("s"), { value: 1, enumerable: true });
    refuses(withSymbol, "input_shape_invalid", "input_closure");
    // Bounds: the bundle is the depth-0 root and every node counts once. tables is depth 1, accounts depth 2, its
    // first row depth 3, so a probe on that row starts at depth 4. Inert probe data leaves the identities unchanged.
    const probeRow = (input: Fresh): JsonObject =>
      at(input.tables.accounts ?? [], 0);
    const chain = (levels: number): JsonObject => {
      let node: JsonObject = {};
      for (let level = 1; level < levels; level++) node = { next: node };
      return node;
    };
    const ledgerCalls = () => vi.mocked(verifyLedger).mock.calls.length;
    const atDepthLimit = fresh();
    probeRow(atDepthLimit).review_probe = chain(13);
    expect(reconcileFrozenFixture046Responses(atDepthLimit).status).toBe(
      "reconciled",
    );
    expect(ledgerCalls()).toBe(1);
    vi.mocked(verifyLedger).mockClear();
    const pastDepthLimit = fresh();
    probeRow(pastDepthLimit).review_probe = chain(14);
    refuses(pastDepthLimit, "input_shape_invalid", "input_closure");
    expect(ledgerCalls()).toBe(0);
    const baseNodes = bundleNodes(fresh());
    const atNodeLimit = fresh();
    probeRow(atNodeLimit).review_probe = new Array<number>(
      100_000 - baseNodes - 1,
    ).fill(0);
    expect(bundleNodes(atNodeLimit)).toBe(100_000);
    expect(reconcileFrozenFixture046Responses(atNodeLimit).status).toBe(
      "reconciled",
    );
    expect(ledgerCalls()).toBe(1);
    vi.mocked(verifyLedger).mockClear();
    const pastNodeLimit = fresh();
    probeRow(pastNodeLimit).review_probe = new Array<number>(
      100_000 - baseNodes,
    ).fill(0);
    expect(bundleNodes(pastNodeLimit)).toBe(100_001);
    refuses(pastNodeLimit, "input_shape_invalid", "input_closure");
    expect(ledgerCalls()).toBe(0);
  });
  it("D5 a WAV set missing one literal name is input_shape_invalid", () => {
    const input = fresh();
    input.wavs.pop();
    refuses(input, "input_shape_invalid", "input_closure");
  });
  it("D6 a WAV set repeating one name is input_shape_invalid", () => {
    const input = fresh();
    wavOf(input, 1).path = wavOf(input, 0).path;
    refuses(input, "input_shape_invalid", "input_closure");
  });
  it("D7 a plan with eight requests is input_shape_invalid", () => {
    const input = fresh();
    input.plan.requests.pop();
    refuses(input, "input_shape_invalid", "input_closure");
  });
  it("D8 a plan with ten requests is input_shape_invalid", () => {
    const input = fresh();
    input.plan.requests.push(structuredClone(at(input.plan.requests, 8)));
    refuses(input, "input_shape_invalid", "input_closure");
  });
  it("D9 a reconciled result is authority none and carries no clearance or selection fields", () => {
    const result = reconcileFrozenFixture046Responses(fresh());
    expect(result.authority).toBe("none");
    expect(result.status).toBe("reconciled");
    expect(Object.keys(result).sort()).toEqual([
      "authority",
      "historical_evidence",
      "responses",
      "status",
    ]);
  });
});

describe("E. mapping shape and adapter identity", () => {
  const shape = (input: Fresh) => {
    refuses(input, "mapping_shape_invalid", "mapping_shape");
  };
  it("E1 nine entries is mapping_shape_invalid", () => {
    const input = fresh();
    input.mapping.entries.pop();
    shape(input);
  });
  it("E2 eleven entries is mapping_shape_invalid", () => {
    const input = fresh();
    input.mapping.entries.push(structuredClone(entry(input, 0)));
    shape(input);
  });
  it("E3 an unknown key in an entry is mapping_shape_invalid", () => {
    const input = fresh();
    entry(input, 2).extra = 1;
    shape(input);
  });
  it("E4 a string frame count is mapping_shape_invalid", () => {
    const input = fresh();
    entry(input, 2).wav_frames = "5520";
    shape(input);
  });
  it("E5 a malformed provider call UUID is mapping_shape_invalid", () => {
    const input = fresh();
    entry(input, 2).provider_call_id = "not-a-uuid";
    shape(input);
  });
  it("E6 a base hash without the v1 prefix is mapping_shape_invalid", () => {
    const input = fresh();
    entry(input, 2).base_request_hash = at(BLOCK_HASHES, 2).slice(3);
    shape(input);
  });
  it("E7 a take index of 2 is mapping_shape_invalid", () => {
    const input = fresh();
    entry(input, 2).intentional_take_index = 2;
    shape(input);
  });
  it("E8 a fractional take index is mapping_shape_invalid", () => {
    const input = fresh();
    entry(input, 2).intentional_take_index = 1.5;
    shape(input);
  });
  it("E9 a mapped path outside the ten literal names (sting) is mapping_shape_invalid", () => {
    const input = fresh();
    entry(input, 2).wav_member_path = "fixture_audio/sting.wav";
    shape(input);
  });
  it("E10 a receipt missing a key is mapping_shape_invalid", () => {
    const input = fresh();
    Reflect.deleteProperty(receiptOf(input, 2), "basis");
    shape(input);
  });
  it("E11 a receipt with an extra key is mapping_shape_invalid", () => {
    const input = fresh();
    receiptOf(input, 2).extra = true;
    shape(input);
  });
  it("E12 a receipt that is not synthetic is mapping_shape_invalid", () => {
    const input = fresh();
    receiptOf(input, 2).synthetic = false;
    shape(input);
  });
  it("E13 a receipt claiming live provider contact is mapping_shape_invalid", () => {
    const input = fresh();
    receiptOf(input, 2).live_provider_contacted = true;
    shape(input);
  });
  it("E14 a receipt relabeling a predecessor as new generation is mapping_shape_invalid", () => {
    const input = fresh();
    receiptOf(input, 2).predecessor_receipt_relabeled_as_new_generation = true;
    shape(input);
  });
  it("E15 a receipt claiming audible performance fidelity is mapping_shape_invalid", () => {
    const input = fresh();
    receiptOf(input, 2).claims_audible_performance_fidelity = true;
    shape(input);
  });
  it("E16 a changed receipt kind is mapping_shape_invalid", () => {
    const input = fresh();
    receiptOf(input, 2).kind = "live_adapter_receipt";
    shape(input);
  });
  it("E17 a changed receipt basis is mapping_shape_invalid", () => {
    const input = fresh();
    receiptOf(input, 2).basis = "regenerated from the corrected request";
    shape(input);
  });
  it("E18 a changed receipt source provenance is mapping_shape_invalid", () => {
    const input = fresh();
    receiptOf(input, 2).source_bytes_provenance = "newly generated";
    shape(input);
  });
  it("E19 a duplicate provider call id is mapping_duplicate_identity", () => {
    const input = fresh();
    entry(input, 3).provider_call_id = entry(input, 2).provider_call_id;
    refuses(input, "mapping_duplicate_identity", "mapping_shape");
  });
  it("E20 a duplicate WAV member path is mapping_duplicate_identity", () => {
    const input = fresh();
    entry(input, 3).wav_member_path = entry(input, 2).wav_member_path;
    refuses(input, "mapping_duplicate_identity", "mapping_shape");
  });
  it("E21 a different adapter is adapter_identity_mismatch", () => {
    const input = fresh();
    entry(input, 4).adapter = "other_tts";
    refuses(input, "adapter_identity_mismatch", "mapping_shape");
  });
  it("E22 a different concrete model is adapter_identity_mismatch", () => {
    const input = fresh();
    entry(input, 4).concrete_model_identity = "fixture-model-2.0";
    refuses(input, "adapter_identity_mismatch", "mapping_shape");
  });
  it("E23 a stale mapping adapter render-contract version is adapter_contract_version_mismatch", () => {
    const input = fresh();
    entry(input, 4).adapter_render_contract_version =
      "fixture-adapter-contract-v1";
    refuses(input, "adapter_contract_version_mismatch", "mapping_shape");
  });
  it("E24 a stale plan adapter render-contract version is adapter_contract_version_mismatch", () => {
    const input = fresh();
    input.plan.adapter_render_contract_version = "fixture-adapter-contract-v1";
    refuses(input, "adapter_contract_version_mismatch", "mapping_shape");
  });
  it("E25 priority: a shape defect in entry 2 beats a ledger defect in entry 5", () => {
    const input = fresh();
    entry(input, 1).extra = 1;
    entry(input, 4).base_request_hash = `v1:${"0".repeat(64)}`;
    shape(input);
  });
});

describe("F. unchanged ledger reconciliation", () => {
  const ledger = (input: Fresh) => {
    refuses(input, "historical_ledger_mismatch", "historical_ledger");
  };
  it("F1 swapping WAV member paths between two entries is historical_ledger_mismatch", () => {
    const input = fresh();
    swapFields(input, "wav_member_path", 0, 1);
    ledger(input);
  });
  it("F2 swapping response artifact ids between two entries is historical_ledger_mismatch", () => {
    const input = fresh();
    swapFields(input, "response_artifact_id", 0, 1);
    ledger(input);
  });
  it("F3 swapping provider call ids between two entries is historical_ledger_mismatch", () => {
    const input = fresh();
    swapFields(input, "provider_call_id", 0, 1);
    ledger(input);
  });
  it("F4 a valid-form logical key with the wrong take spelling is historical_ledger_mismatch", () => {
    const input = fresh();
    entry(input, 0).logical_request_key = `${at(BLOCK_HASHES, 0)}:1`;
    ledger(input);
  });
  it("F5 a stale mapping hash of valid form is historical_ledger_mismatch", () => {
    const input = fresh();
    entry(input, 2).base_request_hash = `v1:${"0".repeat(64)}`;
    ledger(input);
  });
  it("F6 relabeling rb06 take 1 as index 0 is historical_ledger_mismatch", () => {
    const input = fresh();
    entry(input, 6).intentional_take_index = 0;
    ledger(input);
  });
  it("F7 swapping the take indices between the rb06 entries is historical_ledger_mismatch", () => {
    const input = fresh();
    swapFields(input, "intentional_take_index", 5, 6);
    ledger(input);
  });
  it("F8 a changed render_blocks row hash is historical_ledger_mismatch", () => {
    const input = fresh();
    at(input.tables.render_blocks ?? [], 0).base_request_hash =
      `v1:${"0".repeat(64)}`;
    ledger(input);
  });
  it("F9 consistently altered mapping frames and byte length are historical_ledger_mismatch", () => {
    const input = fresh();
    entry(input, 0).wav_frames = 5041;
    entry(input, 0).wav_byte_length = 10126;
    ledger(input);
  });
  it("F10 priority: a ledger defect beats a corrupted WAV byte", () => {
    const input = fresh();
    swapFields(input, "wav_member_path", 0, 1);
    corrupt(input, 4);
    ledger(input);
  });
});

describe("G. plan to historical block join", () => {
  it("G1 an unknown plan hash is request_identity_unmapped", () => {
    const input = fresh();
    at(input.plan.requests, 2).base_request_hash = `v1:${"1".repeat(64)}`;
    refuses(input, "request_identity_unmapped", "request_identity");
  });
  it("G2 a plan derived from one mutated source word is request_identity_unmapped", () => {
    const input = fresh();
    const mutated = mutatedPlanRequests();
    expect(
      mutated.some(
        (request, index) =>
          request.base_request_hash !== at(BLOCK_HASHES, index),
      ),
    ).toBe(true);
    input.plan.requests = mutated;
    refuses(input, "request_identity_unmapped", "request_identity");
  });
  it("G3 plan hashes swapped between blocks 3 and 4 are request_identity_unmapped", () => {
    const input = fresh();
    const left = at(input.plan.requests, 2);
    const right = at(input.plan.requests, 3);
    const held = left.base_request_hash;
    left.base_request_hash = right.base_request_hash;
    right.base_request_hash = held;
    refuses(input, "request_identity_unmapped", "request_identity");
  });
  it("G4 swapped program block ids and a non-integer historical sequence are request_block_mismatch", () => {
    const input = fresh();
    const left = at(input.plan.requests, 0);
    const right = at(input.plan.requests, 1);
    const held = left.program_block_id;
    left.program_block_id = right.program_block_id;
    right.program_block_id = held;
    refuses(input, "request_block_mismatch", "request_identity");
    // A sequence that still sorts into place but is not the exact integer ordinal 3 is also refused.
    const sequenceOf = (input: Fresh): JsonObject =>
      at(
        (input.tables.render_blocks ?? []).filter((row) => row.sequence === 3),
        0,
      );
    const fractional = fresh();
    sequenceOf(fractional).sequence = 3.5;
    refuses(fractional, "request_block_mismatch", "request_identity");
    const spelled = fresh();
    sequenceOf(spelled).sequence = "3";
    refuses(spelled, "request_block_mismatch", "request_identity");
  });
  it("G5 reordered plan ordinals are input_shape_invalid at closure, not a row join", () => {
    const input = fresh();
    const left = at(input.plan.requests, 0);
    const right = at(input.plan.requests, 1);
    const held = left.block_ordinal;
    left.block_ordinal = right.block_ordinal;
    right.block_ordinal = held;
    refuses(input, "input_shape_invalid", "input_closure");
  });
});

describe("H. shipped bytes and historical evidence", () => {
  it("H1 one flipped data byte is response_bytes_mismatch", () => {
    const input = fresh();
    corrupt(input, 3);
    refuses(input, "response_bytes_mismatch", "response_bytes");
  });
  it("H2 a WAV truncated by two bytes is response_bytes_invalid", () => {
    const input = fresh();
    truncate(input, 3);
    refuses(input, "response_bytes_invalid", "response_bytes");
  });
  it("H3 swapped rb06 take bytes are response_bytes_mismatch", () => {
    const input = fresh();
    const left = wavOf(input, 5);
    const right = wavOf(input, 6);
    const held = left.bytes;
    left.bytes = right.bytes;
    right.bytes = held;
    refuses(input, "response_bytes_mismatch", "response_bytes");
  });
  it("H4 the clean-master bytes presented as rb01 are response_bytes_mismatch", () => {
    const input = fresh();
    wavOf(input, 0).bytes = Buffer.from(masterBytes);
    refuses(input, "response_bytes_mismatch", "response_bytes");
  });
  it("H5 bytes that are not a byte array are response_bytes_invalid", () => {
    const input = fresh();
    wavOf(input, 0).bytes = "not bytes" as never;
    refuses(input, "response_bytes_invalid", "response_bytes");
  });
  it("H6 a wrong recorded observed frame count is historical_evidence_mismatch", () => {
    const input = fresh();
    measurementsOf(input).observed_frames = 6241;
    refuses(input, "historical_evidence_mismatch", "historical_evidence");
  });
  it("H7 a wrong recorded minimum is historical_evidence_mismatch", () => {
    const input = fresh();
    measurementsOf(input).minimum_required_frames = 6000;
    refuses(input, "historical_evidence_mismatch", "historical_evidence");
  });
  it("H8 a relabeled comparison rule or observation method is historical_evidence_mismatch", () => {
    const rule = fresh();
    measurementsOf(rule).comparison_rule = "observed_frames <= minimum";
    refuses(rule, "historical_evidence_mismatch", "historical_evidence");
    const method = fresh();
    measurementsOf(method).observation_method = "header field";
    refuses(method, "historical_evidence_mismatch", "historical_evidence");
  });
  it("H9 a recorded threshold that is not marked synthetic is historical_evidence_mismatch", () => {
    const input = fresh();
    measurementsOf(input).synthetic_fixture_threshold = false;
    refuses(input, "historical_evidence_mismatch", "historical_evidence");
  });
  it("H10 an extra key in the recorded measurements is historical_evidence_mismatch", () => {
    const input = fresh();
    measurementsOf(input).extra = true;
    refuses(input, "historical_evidence_mismatch", "historical_evidence");
  });
  it("H11 priority: the first bad response wins and byte refusals precede the evidence check", () => {
    const withEvidence = fresh();
    corrupt(withEvidence, 0);
    measurementsOf(withEvidence).observed_frames = 6241;
    refuses(withEvidence, "response_bytes_mismatch", "response_bytes");
    const corruptThenTruncated = fresh();
    corrupt(corruptThenTruncated, 0);
    truncate(corruptThenTruncated, 1);
    refuses(corruptThenTruncated, "response_bytes_mismatch", "response_bytes");
    const truncatedThenCorrupt = fresh();
    truncate(truncatedThenCorrupt, 0);
    corrupt(truncatedThenCorrupt, 1);
    refuses(truncatedThenCorrupt, "response_bytes_invalid", "response_bytes");
  });
});

describe("I. acquisition, sanitization and source surface", () => {
  const SECRET = "SENTINEL-SECRET-DO-NOT-REFLECT";
  it("I1 a pack open fault is response_source_invalid with exactly the closed keys and no reflected text", async () => {
    vi.mocked(fixturePack).mockImplementationOnce(() => {
      throw new Error(SECRET);
    });
    const result = await blocked("response_source_invalid", "response_source");
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });
  it("I2 a mapping parse fault is response_source_invalid", async () => {
    vi.mocked(loadFixtureJson).mockImplementationOnce(() => {
      throw new Error(SECRET);
    });
    const result = await blocked("response_source_invalid", "response_source");
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });
  it("I3 a WAV member read fault is response_source_invalid", async () => {
    vi.mocked(loadFixtureBytes).mockImplementationOnce(() => {
      throw new Error(SECRET);
    });
    const result = await blocked("response_source_invalid", "response_source");
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });
  it("I4 a row load fault is historical_rows_invalid at response_source", async () => {
    vi.mocked(loadFoundationRows).mockImplementationOnce(() => {
      throw new Error(SECRET);
    });
    const result = await blocked("historical_rows_invalid", "response_source");
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });
  it("I5 any verifyLedger exception is historical_ledger_mismatch with no reflected text", async () => {
    vi.mocked(verifyLedger).mockImplementationOnce(() => {
      throw new Error(SECRET);
    });
    const result = await blocked(
      "historical_ledger_mismatch",
      "historical_ledger",
    );
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });
  it("I6 a measurer exception is unexpected_failure at response_bytes", async () => {
    vi.mocked(measureCanonicalPcm).mockImplementationOnce(() => {
      throw new Error(SECRET);
    });
    const result = await blocked("unexpected_failure", "response_bytes");
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });
  it("I7 a planner exception is unexpected_failure at request_plan with zero pack reads", async () => {
    vi.mocked(planFrozenFixture046Render).mockRejectedValueOnce(
      new Error(SECRET),
    );
    const result = await blocked("unexpected_failure", "request_plan");
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expectNoPackReads();
  });
  it("I8 two real invocations select the twelve member names exactly once per call over the same cached pack; the master read is a separate test control", () => {
    const mappingName = "fixture_persistence_conformance.json";
    const wavNames = EXPECTED.map((item) => `fixture_audio/${item.file}.wav`);
    expect(setup.jsonNames).toEqual([mappingName, mappingName]);
    expect(setup.rowCalls).toBe(2);
    expect(setup.bytesNames).toEqual([...wavNames, ...wavNames]);
    expect(setup.bytesNames).not.toContain("fixture_audio/master.wav");
    const selected =
      setup.jsonNames.length + setup.rowCalls + setup.bytesNames.length;
    expect(selected).toBe(24);
    const [openOne, openTwo] = setup.fixturePackResults;
    expect(openOne).toBeDefined();
    expect(openOne).toBe(openTwo);
  });
  it("I9 runtime imports, runtime exports and environment reads match the permitted allow-lists", () => {
    const runtimeImports = (text: string): string[] =>
      [...text.matchAll(/^import\s+(?!type\b)[^;]*?from\s+"([^"]+)";/gm)].map(
        (match) => match[1] ?? "",
      );
    const runtimeExports = (text: string): string[] =>
      [
        ...text.matchAll(
          /^export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/gm,
        ),
      ].map((match) => match[1] ?? "");
    const core = sourceText("src/runtime/frozen-render046-response-lineage.ts");
    const wrapper = sourceText("src/runtime/frozen-render046-responses.ts");
    expect(runtimeImports(core).sort()).toEqual(
      [
        "../fixture/ledger.js",
        "./audio-measurements.js",
        "../identity/select.js",
      ].sort(),
    );
    expect(runtimeImports(wrapper).sort()).toEqual(
      [
        "./frozen-render046.js",
        "./frozen-render046-response-lineage.js",
        "../fixture/loader.js",
        "../fixture/pins.js",
      ].sort(),
    );
    expect(runtimeExports(core)).toEqual([
      "reconcileFrozenFixture046Responses",
    ]);
    expect(runtimeExports(wrapper)).toEqual([
      "verifyFrozenFixture046ResponseLineage",
    ]);
    for (const text of [core, wrapper]) {
      expect(text).not.toMatch(/\bimport\(/);
      expect(text).not.toMatch(/^export\s*(\{|\*)/m);
      for (const specifier of runtimeImports(text))
        expect(specifier).not.toMatch(/provider|child_process|node:|db|pg/);
    }
    expect(core).not.toContain("process.env");
    const settings = new Set(
      [...wrapper.matchAll(/process\.env\.(\w+)/g)].map(
        (match) => match[1] ?? "",
      ),
    );
    expect([...settings].sort()).toEqual([
      "DESK_ENV",
      "GENERATION_KILL_SWITCH",
      "PROVIDERS_ENABLED",
    ]);
  });
  it("I10 the pure core does not mutate deeply frozen inputs", () => {
    const input = fresh();
    freezeData(input.plan);
    freezeData(input.mapping);
    freezeData(input.tables);
    const before = input.wavs.map((wav) => Buffer.from(wav.bytes));
    const result = reconcileFrozenFixture046Responses(input);
    expect(result.status).toBe("reconciled");
    input.wavs.forEach((wav, index) => {
      expect(wav.bytes.equals(at(before, index))).toBe(true);
    });
  });
});
