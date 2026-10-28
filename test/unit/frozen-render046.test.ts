// Forty separately registered component cases. No subprocess, DB, provider or fixture loader.
// Frozen output oracles are read by this test harness ONLY, and only after runtime derivation.
import { readFileSync } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { canonicalJson, sha256 } from "../../src/identity/canonical-json.js";
import {
  scriptHash,
  performanceDirectionHash,
  turnAnchorMap,
  renderManifestProjection,
} from "../../src/identity/artifacts.js";
import { fingerprint } from "../../src/identity/fingerprints.js";
import { renderContextHash } from "../../src/identity/layer-b.js";
import { checkFixtureRequestOwnership } from "../../src/identity/fixture-render-ownership.js";
import {
  requestBaseHash,
  selectBaseRequestProjection,
} from "../../src/identity/request.js";
import {
  asArray,
  asRecord,
  asString,
  type JsonObject,
} from "../../src/identity/select.js";
import * as publicModule from "../../src/runtime/frozen-render046.js";
import * as planModule from "../../src/runtime/frozen-render046-plan.js";
import { parseFrozenRender046Sources } from "../../src/runtime/frozen-render046-input.js";
import type {
  FrozenRenderPlanningInvocation,
  FrozenRenderPlanningResult,
} from "../../src/runtime/frozen-render046.js";
import type {
  FrozenPlanInputs,
  FrozenPlanData,
  StructuralCode,
} from "../../src/runtime/frozen-render046-plan.js";

type FaultKind =
  | "missing"
  | "symlink"
  | "directory"
  | "fifo"
  | "replace"
  | "short"
  | "bound"
  | "eof"
  | "extra_eof"
  | "read_error"
  | "open_error"
  | "close_error"
  | "metadata"
  | "oversize"
  | "undersize";
interface Fault {
  path: string;
  kind: FaultKind;
  bytes?: Buffer;
}
const io = vi.hoisted(() => ({
  fault: null as Fault | null,
  opened: [] as string[],
  closed: [] as string[],
  attempts: [] as string[],
  reads: 0,
  denyOracles: false,
  changeFlagsOnLastClose: false,
}));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  const selected = (path: string): Fault | null =>
    io.fault && path.endsWith(io.fault.path) ? io.fault : null;
  return {
    ...actual,
    lstat: vi.fn(async (path: Parameters<typeof actual.lstat>[0]) => {
      const name = String(path),
        fault = selected(name);
      io.attempts.push(name);
      if (
        io.denyOracles &&
        /\.zip$|render_manifest|render_request_projections|foundation_rows|gate_fingerprint_inputs|\.wav$/i.test(
          name,
        )
      )
        throw new Error("test oracle access poisoned");
      if (fault?.kind === "missing") throw new Error("test missing source");
      const stat = await actual.lstat(path);
      if (fault?.kind === "symlink") {
        stat.isSymbolicLink = () => true;
        stat.isFile = () => false;
      }
      if (fault?.kind === "directory" || fault?.kind === "fifo")
        stat.isFile = () => false;
      if (fault?.kind === "oversize") stat.size++;
      if (fault?.kind === "undersize") stat.size--;
      if (fault?.kind === "replace" && fault.bytes)
        stat.size = fault.bytes.length;
      return stat;
    }),
    open: vi.fn(async (...args: Parameters<typeof actual.open>) => {
      const name = String(args[0]),
        fault = selected(name);
      if (fault?.kind === "open_error") throw new Error("test open failure");
      const handle = await actual.open(...args);
      io.opened.push(name);
      let stats = 0;
      return {
        stat: async () => {
          const stat = await handle.stat();
          if (fault?.kind === "metadata" && ++stats === 2) stat.mtimeMs++;
          return stat;
        },
        read: async (
          buffer: Buffer,
          offset: number,
          length: number,
          position: number,
        ) => {
          io.reads++;
          if (fault?.kind === "read_error")
            throw new Error("test read failure");
          if (fault?.kind === "eof") return { bytesRead: 0, buffer };
          if (fault?.kind === "extra_eof" && length === 1) {
            buffer[offset] = 1;
            return { bytesRead: 1, buffer };
          }
          if (fault?.kind === "replace" && fault.bytes) {
            const count = Math.max(
              0,
              Math.min(length, fault.bytes.length - position),
            );
            fault.bytes.copy(buffer, offset, position, position + count);
            return { bytesRead: count, buffer };
          }
          return handle.read(
            buffer,
            offset,
            fault?.kind === "short"
              ? Math.min(length, 2048)
              : fault?.kind === "bound"
                ? 1
                : length,
            position,
          );
        },
        close: async () => {
          await handle.close();
          io.closed.push(name);
          if (fault?.kind === "close_error")
            throw new Error("test close failure");
          if (
            io.changeFlagsOnLastClose &&
            name.endsWith(
              "The_Desk_Writing_Build_1-2_Fixture_Profile_Addendum_v0.2.md",
            )
          )
            process.env.PROVIDERS_ENABLED = "true";
        },
      } as unknown as FileHandle;
    }),
  };
});

const ROOT = new URL("../../", import.meta.url);
const CORPUS = "fixtures/frozen-render046-input/";
const context = {
  profile: "frozen-fixture046-render-planning/1",
  purpose: "fixture_conformance",
  environment: "test",
} as const;
const PROFILE = context.profile;
const clone = <T>(value: T): T => structuredClone(value);
function bytes(path: string): Buffer {
  return readFileSync(new URL(path, ROOT));
}
function json(path: string): JsonObject {
  return asRecord(
    JSON.parse(bytes(path).toString("utf8")) as unknown,
    "test JSON",
  );
}
function objects(value: unknown): JsonObject[] {
  return asArray(value, "test records").map((v) => asRecord(v, "test record"));
}
function text(value: unknown): string {
  return asString(value, "test text");
}
function at<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) throw new Error("missing test entry");
  return value;
}
function invoke(value: unknown = context): Promise<FrozenRenderPlanningResult> {
  return publicModule.planFrozenFixture046Render(
    value as FrozenRenderPlanningInvocation,
  );
}
async function success() {
  const result = await invoke();
  expect(result.status).toBe("fixture_render_planning_pass");
  if (result.status !== "fixture_render_planning_pass")
    throw new Error(`planner blocked: ${result.code}`);
  return result;
}
async function blocked(code: string, value: unknown = context) {
  const result = await invoke(value);
  expect(result.status).toBe("blocked");
  if (result.status !== "blocked") throw new Error("unexpected planning pass");
  expect(result.code).toBe(code);
  expect(Object.keys(result).sort()).toEqual([
    "code",
    "phase",
    "profile",
    "status",
  ]);
  expect(result.profile).toBe(PROFILE);
  return result;
}
function invalid(input: unknown, code: StructuralCode): void {
  const expected = { authority: "none", status: "invalid", code };
  expect(planModule.inspectFrozenFixture046PlanInputs(input)).toEqual(expected);
  expect(planModule.deriveFrozenFixture046PlanData(input)).toEqual(expected);
}
function derived(input: FrozenPlanInputs): FrozenPlanData {
  expect(planModule.inspectFrozenFixture046PlanInputs(input)).toEqual({
    authority: "none",
    status: "structurally_valid",
  });
  const result = planModule.deriveFrozenFixture046PlanData(input);
  expect(result.authority).toBe("none");
  if (result.status !== "derived")
    throw new Error(`pure derivation blocked: ${result.code}`);
  return result.data;
}
function recordSet(input: FrozenPlanInputs, family: string): JsonObject[] {
  return objects(asRecord(input.sources.support.records, "records")[family]);
}
function mutateRecord(
  input: FrozenPlanInputs,
  family: string,
  index: number,
): JsonObject {
  return asRecord(
    at(
      asArray(
        asRecord(input.sources.support.records, "records")[family],
        "family",
      ),
      index,
    ),
    "record",
  );
}
function scriptTurn(input: FrozenPlanInputs, index: number): JsonObject {
  return asRecord(
    at(asArray(input.sources.script.turns, "turns"), index),
    "turn",
  );
}
function refreshDirection(input: FrozenPlanInputs): void {
  input.sources.direction.direction_hash = performanceDirectionHash(
    input.sources.direction,
    turnAnchorMap(input.sources.script.turns),
  );
}
function alterBytes(member: string, edit: (value: JsonObject) => void): void {
  const original = bytes(CORPUS + member),
    value = json(CORPUS + member);
  edit(value);
  const changed = Buffer.from(JSON.stringify(value));
  io.fault = {
    path: CORPUS + member,
    kind: "replace",
    bytes:
      changed.length <= original.length
        ? Buffer.concat([
            changed,
            Buffer.alloc(original.length - changed.length, 32),
          ])
        : changed,
  };
}

/** Independently assembled source refs/config; no output objects and no admission claim. */
function fixtureInput(): FrozenPlanInputs {
  const sources = parseFrozenRender046Sources({
    evidence_package: json(CORPUS + "evidence_package.json"),
    brief: json(CORPUS + "showrunner_brief.json"),
    script: json(CORPUS + "script_pass2.json"),
    direction: json(CORPUS + "performance_direction_corrected.json"),
    show_config: json(CORPUS + "config/show_config_version.json"),
    support: json(CORPUS + "INPUT-SUPPORT.json"),
  });
  const turns = objects(sources.script.turns),
    blocks = objects(sources.brief.program_blocks);
  const voiceIds = [
    "d125001c-0000-4000-8000-000000000001",
    "d125001c-0000-4000-8000-000000000002",
    "d125001c-0000-4000-8000-000000000003",
  ];
  const voices = ["tully", "gaz", "simon"].map((participant_id, i) => ({
    participant_id,
    voice_profile_version_id: at(voiceIds, i),
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
      blocks: blocks.map((block, i) => ({
        program_block_id: text(block.program_block_id),
        turn_ids: turns
          .filter((t) => t.program_block_id === block.program_block_id)
          .map((t) => text(t.turn_id)),
        context_recipe_version: i === 0 ? "C0-v1" : "C2-v1",
        context_turn_ids:
          i === 0
            ? []
            : [
                text(
                  turns
                    .filter(
                      (t) =>
                        t.program_block_id === blocks[i - 1]?.program_block_id,
                    )
                    .at(-1)?.turn_id,
                ),
              ],
      })),
      mentions: spans.map(([anchor, start, end]) => {
        const turn = asRecord(
          turns.find((t) => t.semantic_turn_id === anchor),
          "mention turn",
        );
        return {
          turn_id: text(turn.turn_id),
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

/** Test-only exact-root ZIP member reader: no shell or runtime loader and no archive suffix matching.
 * Fixed four JSON oracles/inputs; ZIP and selected lengths are checked before bounded inflate. */
function frozenMember(
  name:
    | "render_manifest.json"
    | "render_request_projections.json"
    | "gate_fingerprint_inputs.json"
    | "foundation_rows_398.json"
    | "evidence_package.json"
    | "showrunner_brief.json"
    | "script_pass2.json"
    | "performance_direction_corrected.json"
    | "audit_result.json"
    | "config/show_config_version.json"
    | "config/policy_versions.json",
): Buffer {
  const archive = bytes(
    "Lock/04_IMPLEMENTATION/The_Desk_Walking_Skeleton_Fixture_v0.4.6.zip",
  );
  expect(archive.length).toBe(832024);
  expect(sha256(archive)).toBe(
    "7e1bb1108cdd84e47269b9ab2dab20ba934fcec64d44262f86d2b505616b0747",
  );
  const end = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error("missing frozen ZIP directory");
  const count = archive.readUInt16LE(end + 10);
  let cursor = archive.readUInt32LE(end + 16);
  if (count > 2048) throw new Error("unexpected frozen ZIP cardinality");
  let found: Buffer | undefined;
  for (let i = 0; i < count; i++) {
    if (archive.readUInt32LE(cursor) !== 0x02014b50)
      throw new Error("bad central entry");
    const method = archive.readUInt16LE(cursor + 10),
      compressed = archive.readUInt32LE(cursor + 20),
      expanded = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28),
      extra = archive.readUInt16LE(cursor + 30),
      comment = archive.readUInt16LE(cursor + 32),
      local = archive.readUInt32LE(cursor + 42);
    const filename = archive
      .subarray(cursor + 46, cursor + 46 + nameLength)
      .toString("utf8");
    if (filename === name) {
      if (
        found ||
        expanded > 600000 ||
        archive.readUInt32LE(local) !== 0x04034b50
      )
        throw new Error("invalid exact oracle member");
      const start =
        local +
        30 +
        archive.readUInt16LE(local + 26) +
        archive.readUInt16LE(local + 28);
      const data = archive.subarray(start, start + compressed);
      found =
        method === 0
          ? Buffer.from(data)
          : method === 8
            ? inflateRawSync(data, { maxOutputLength: 600000 })
            : undefined;
      if (found?.length !== expanded)
        throw new Error("unsupported frozen member");
    }
    cursor += 46 + nameLength + extra + comment;
  }
  if (!found) throw new Error("exact root oracle member absent");
  return found;
}
function oracle(
  name:
    | "render_manifest.json"
    | "render_request_projections.json"
    | "gate_fingerprint_inputs.json"
    | "foundation_rows_398.json",
): JsonObject {
  return asRecord(
    JSON.parse(frozenMember(name).toString("utf8")) as unknown,
    "oracle",
  );
}
function assertDeepFrozen(value: unknown): void {
  if (value !== null && typeof value === "object") {
    expect(Object.isFrozen(value)).toBe(true);
    for (const child of Object.values(value)) assertDeepFrozen(child);
  }
}

beforeEach(() => {
  io.fault = null;
  io.opened = [];
  io.closed = [];
  io.attempts = [];
  io.reads = 0;
  io.denyOracles = false;
  io.changeFlagsOnLastClose = false;
  vi.stubEnv("DESK_ENV", "test");
  vi.stubEnv("PROVIDERS_ENABLED", "false");
  vi.stubEnv("GENERATION_KILL_SWITCH", "true");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("original Frozen Fixture046 synthetic render planning", () => {
  it("01 original seed success and full semantic manifest equality", async () => {
    const result = await success();
    const expected = oracle("render_manifest.json"); // AFTER derivation, never passed to runtime.
    expect(canonicalJson(result.semantic_manifest)).toBe(
      canonicalJson(renderManifestProjection(expected)),
    );
    expect(result.semantic_manifest_hash).toBe(
      "60cc91566ad0571be91eae82b62c182eaccb5821fdd94854a6b16aceb71e80e5",
    );
    expect(result.fixture_stub).toBe(true);
    expect(result.semantic_clearance).toBe(false);
    expect(result.production_clearance).toBe(false);
    expect(result.planning_checks.map((c) => c.check)).toEqual([
      "program_block_boundary",
      "speaker_map_complete",
      "pronunciation_freshness",
      "base_hash_projection_valid",
    ]);
  });
  it("02 all nine independently computed request projections and base hashes", async () => {
    const result = await success();
    const expected = objects(
      oracle("render_request_projections.json").projections,
    );
    expect(result.requests).toHaveLength(9);
    expect(expected).toHaveLength(9);
    for (const [i, request] of result.requests.entries()) {
      expect(Object.keys(request.projection)).toHaveLength(11);
      expect(canonicalJson(request.projection)).toBe(
        canonicalJson(at(expected, i).projection),
      );
      expect(request.base_request_hash).toBe(at(expected, i).base_request_hash);
    }
  });
  it("03 audit and render stage fingerprints independently reproduced", async () => {
    const result = await success(),
      expected = oracle("gate_fingerprint_inputs.json");
    expect(fingerprint("semantic_audit", result.audit_input_projection)).toBe(
      "fef4b240055df690424b35577788004039a2d6f9926789545c9f66857e8eeb1a",
    );
    expect(result.audit_input_projection).toEqual(
      asRecord(expected.semantic_audit, "audit stage").input_projection,
    );
    expect(fingerprint("render", result.render_gate_projection)).toBe(
      "68e08e41c499885f359f762514bdf1bfb1b3ac62ef36e49788db69589ebb8250",
    );
    expect(result.render_gate_projection).toEqual(
      asRecord(expected.render, "render stage").input_projection,
    );
    expect(result.audit_seed.raw_sha256).toBe(
      sha256(bytes(CORPUS + "audit_result.json")),
    );
  });
  it("04 deterministic repeated invocation, deep immutability and actual flag recheck", async () => {
    const a = await success(),
      b = await success();
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(a).not.toBe(b);
    assertDeepFrozen(a);
    expect(() =>
      Object.assign(a.semantic_manifest.render_blocks[0] ?? {}, {
        provider: "live",
      }),
    ).toThrow();
    io.changeFlagsOnLastClose = true;
    expect((await blocked("unsafe_runtime_configuration")).phase).toBe(
      "invocation_context",
    );
    expect(io.closed).toEqual(io.opened);
  });
  it("05 output oracles poisoned and unavailable to runtime without changing derivation", async () => {
    io.denyOracles = true;
    const result = await success();
    expect(result.semantic_manifest_hash).toBe(
      "60cc91566ad0571be91eae82b62c182eaccb5821fdd94854a6b16aceb71e80e5",
    );
    expect(
      io.attempts.every(
        (p) =>
          !/\.zip$|render_manifest|render_request_projections|foundation_rows|\.wav$/.test(
            p,
          ),
      ),
    ).toBe(true);
  });
  it("06 no forbidden I/O, imports, DB, provider execution or WAV path", async () => {
    const result = await success();
    expect(io.opened).toHaveLength(27);
    expect(new Set(io.opened).size).toBe(27);
    expect(io.closed).toEqual(io.opened);
    expect(
      io.opened.every(
        (p) =>
          p.includes(CORPUS) ||
          p.includes("/Lock/") ||
          p.endsWith("/AGENTS.md"),
      ),
    ).toBe(true);
    for (const name of [
      "frozen-render046.ts",
      "frozen-render046-input.ts",
      "frozen-render046-plan.ts",
    ]) {
      const source = bytes("src/runtime/" + name).toString("utf8");
      expect(source).not.toMatch(
        /from ["'](?:pg|.*(?:\/provider|\/db\/|\/fixture\/|child_process|node:net|node:https?))["']/,
      );
      expect(source).not.toMatch(
        /fetch\(|writeFile|appendFile|createWriteStream|randomUUID|verifyFixture|deriveStages/,
      );
    }
    expect(JSON.stringify(result)).not.toMatch(
      /take_index|render_take_id|provider_call_id|render_manifest_id|render_block_id|audio_sha256/,
    );
  });
  it("07 exact input-only copies and eleven original source-pointer equalities", async () => {
    const result = await success();
    for (const name of [
      "evidence_package.json",
      "showrunner_brief.json",
      "script_pass2.json",
      "performance_direction_corrected.json",
      "audit_result.json",
      "config/show_config_version.json",
      "config/policy_versions.json",
    ] as const)
      expect(bytes(CORPUS + name)).toEqual(frozenMember(name));
    const support = json(CORPUS + "INPUT-SUPPORT.json"),
      carrier = oracle("foundation_rows_398.json");
    const traverse = (root: unknown, pointer: string): unknown =>
      pointer
        .split("/")
        .slice(1)
        .reduce<unknown>(
          (current, part) =>
            Array.isArray(current)
              ? current[Number(part)]
              : asRecord(current, "pointer")[part],
          root,
        );
    const ledger = objects(support.record_pointer_ledger);
    expect(ledger).toHaveLength(11);
    for (const entry of ledger)
      expect(traverse(support, text(entry.target_pointer))).toEqual(
        traverse(carrier, text(entry.source_pointer)),
      );
    expect(Object.keys(asRecord(support.records, "records"))).toEqual([
      "voice_profiles",
      "voice_profile_versions",
      "pronunciations",
      "pronunciation_renderings",
    ]);
    for (const identity of result.source_receipt) {
      expect(bytes(identity.path).length).toBe(identity.bytes);
      expect(sha256(bytes(identity.path))).toBe(identity.sha256);
    }
  });
  it("08 literal source UUID resolution and no new output UUID allocation", async () => {
    const result = await success(),
      input = fixtureInput();
    expect(
      result.semantic_manifest.render_blocks.flatMap((b) => b.ordered_turn_ids),
    ).toEqual(objects(input.sources.script.turns).map((t) => t.turn_id));
    expect(
      new Set(
        result.semantic_manifest.render_blocks.flatMap((b) =>
          b.speaker_map.map((s) => s.voice_profile_version_id),
        ),
      ),
    ).toEqual(
      new Set(input.selections.voices.map((v) => v.voice_profile_version_id)),
    );
    expect(result.subjects.script_version_id).toBe(
      "b9a7be59-70b8-45ae-bb38-190c3b8ab94c",
    );
    for (const b of result.semantic_manifest.render_blocks)
      expect(Object.keys(b)).toHaveLength(10);
    expect(Object.keys(result.semantic_manifest)).toHaveLength(8);
  });
  it("09 C0 and all eight C2 exact adjacent boundary derivations", async () => {
    const result = await success(),
      turns = objects(fixtureInput().sources.script.turns),
      byId = new Map(turns.map((t) => [t.turn_id, t]));
    const boundaries = [
      [],
      ["t02"],
      ["t03"],
      ["t05"],
      ["t08"],
      ["t09"],
      ["t13"],
      ["t14"],
      ["t16"],
    ];
    for (const [i, block] of result.semantic_manifest.render_blocks.entries()) {
      const resolved = block.resolved_context_refs.turn_ids.map((id) =>
        asRecord(byId.get(id), "context"),
      );
      expect(resolved.map((t) => t.semantic_turn_id)).toEqual(
        at(boundaries, i),
      );
      expect(block.context_recipe_version).toBe(i === 0 ? "C0-v1" : "C2-v1");
      expect(block.resolved_context_refs.context_hash).toBe(
        renderContextHash({
          recipe_version: block.context_recipe_version,
          turns: resolved,
        }),
      );
    }
  });
  it("10 six exact pronunciation applications and first-occurrence grouping order", async () => {
    const result = await success();
    const entries = result.requests.flatMap((r) =>
      objects(r.projection.applied_pronunciation_rendering_versions),
    );
    const spans = entries.flatMap((entry) =>
      objects(entry.applications).map((a) => [
        a.semantic_turn_id,
        a.start_offset,
        a.end_offset,
      ]),
    );
    expect(spans).toEqual([
      ["t03", 62, 73],
      ["t04", 0, 11],
      ["t05", 49, 60],
      ["t06", 59, 70],
      ["t07", 125, 136],
      ["t14", 151, 162],
    ]);
    expect(entries.map((e) => e.participant_id)).toEqual([
      "tully",
      "tully",
      "gaz",
      "tully",
      "gaz",
      "tully",
    ]);
    expect(
      entries.every(
        (e) =>
          e.canonical_version === 2 &&
          e.rendering_version === 2 &&
          e.render_text === "North-bridge",
      ),
    ).toBe(true);
    expect(
      at(result.semantic_manifest.render_blocks, 2)
        .applied_pronunciation_rendering_ids,
    ).toEqual([
      "d125001e-0000-4000-8000-000000000002",
      "d125001e-0000-4000-8000-000000000003",
    ]);
  });
  it("11 audit byte drift is rejected before admission", async () => {
    alterBytes("audit_result.json", (seed) => {
      seed.created_at = "2026-09-27T13:08:01Z";
    });
    expect((await blocked("source_hash_mismatch")).phase).toBe(
      "acquisition_source_identity",
    );
  });
  it("12 arbitrary caller-supplied pass and extra keys are rejected before I/O", async () => {
    await blocked("invalid_invocation", {
      ...context,
      audit: { result: "pass", fixture_stub: true },
    });
    await blocked("invalid_invocation", { ...context, auditPassed: true });
    expect(io.attempts).toEqual([]);
  });
  it("13 altered audit kind, version, result and fixture flag all fail raw admission", async () => {
    for (const [key, value] of [
      ["auditor_kind", "genuine_semantic_auditor"],
      ["auditor_version", "semantic-auditor-v2"],
      ["result", "fail"],
      ["fixture_stub", false],
    ] as const) {
      alterBytes("audit_result.json", (seed) => {
        seed[key] = value;
      });
      await blocked("source_hash_mismatch");
    }
  });
  it("14 script byte and spoken-text drift are rejected", async () => {
    alterBytes("script_pass2.json", (script) => {
      asRecord(at(asArray(script.turns, "turns"), 0), "turn").spoken_text =
        "Altered original subject";
    });
    await blocked("source_hash_mismatch");
  });
  it("15 corrected-direction drift and predecessor substitution are refused", async () => {
    alterBytes("performance_direction_corrected.json", (d) => {
      d.producer_run_id = "changed";
    });
    await blocked("source_hash_mismatch");
    alterBytes("performance_direction_corrected.json", (d) => {
      d.performance_direction_version_id =
        "d1250016-0000-4000-8000-000000000001";
      const intent = asRecord(
        at(asArray(d.performance_intents, "intents"), 5),
        "pace",
      );
      intent.value = "measured";
    });
    await blocked("source_hash_mismatch");
  });
  it("16 show-config content drift is refused even with the unchanged show-render label", async () => {
    alterBytes("config/show_config_version.json", (c) => {
      asRecord(
        c.canonical_payload,
        "config",
      ).pre_publish_review_timeout_seconds = 3601;
    });
    await blocked("source_hash_mismatch");
    expect(fixtureInput().mechanics.show_render_config_version).toBe(
      "postmatch-fixture-v4",
    );
  });
  it("17 frozen policy map and original authority-source byte drift fail closed", async () => {
    alterBytes("config/policy_versions.json", (p) => {
      asRecord(
        asRecord(p.policies, "policies").hashing_contract,
        "binding",
      ).source_sha256 = "0".repeat(64);
    });
    await blocked("source_hash_mismatch");
    const path =
        "Lock/04_IMPLEMENTATION/The_Desk_Hashing_Fingerprints_and_Text_Spans_v0.1.5.md",
      changed = Buffer.from(bytes(path));
    changed[0] = 33;
    io.fault = { path, kind: "replace", bytes: changed };
    await blocked("source_hash_mismatch");
  });
  it("18 package input drift is refused", async () => {
    alterBytes("evidence_package.json", (p) => {
      p.selector_run_id = "changed";
    });
    await blocked("source_hash_mismatch");
  });
  it("19 Brief input drift is refused", async () => {
    alterBytes("showrunner_brief.json", (b) => {
      b.central_question = "Changed editorial subject";
    });
    await blocked("source_hash_mismatch");
  });
  it("20 cross-block generated turns fail the real ownership validator", () => {
    const input = fixtureInput();
    at(input.selections.blocks, 0).turn_ids.push(
      text(scriptTurn(input, 2).turn_id),
    );
    invalid(input, "cross_program_block");
  });
  it("21 duplicate, reordered and unresolved turn anchors are refused", () => {
    let input = fixtureInput();
    scriptTurn(input, 1).semantic_turn_id = "t01";
    invalid(input, "duplicate_turn_anchor");
    input = fixtureInput();
    const turns = asArray(input.sources.script.turns, "turns");
    [turns[0], turns[1]] = [turns[1], turns[0]];
    invalid(input, "turn_topology_invalid");
    input = fixtureInput();
    at(input.selections.blocks, 0).turn_ids[0] =
      "00000000-0000-4000-8000-000000000000";
    invalid(input, "anchor_not_in_bound_script");
    input = fixtureInput();
    at(input.selections.blocks, 0).turn_ids.reverse();
    invalid(input, "turn_order_not_script_order");
  });
  it("22 missing speaker binding is rejected by the helper, not a raw pin", () => {
    const input = fixtureInput();
    input.selections.voices.splice(2, 1);
    invalid(input, "voice_binding_missing");
  });
  it("23 wrong participant to immutable-voice binding is refused", () => {
    const input = fixtureInput(),
      a = at(input.selections.voices, 0),
      b = at(input.selections.voices, 1);
    [a.voice_profile_version_id, b.voice_profile_version_id] = [
      b.voice_profile_version_id,
      a.voice_profile_version_id,
    ];
    invalid(input, "voice_binding_mismatch");
  });
  it("24 incompatible model and voice source are refused", () => {
    const input = fixtureInput();
    input.mechanics.concrete_model_identity = "incompatible-model";
    invalid(input, "voice_model_incompatible");
    const other = fixtureInput();
    asRecord(
      mutateRecord(other, "voice_profile_versions", 0).render_fields,
      "voice",
    ).provider_model_compatibility = ["incompatible-model"];
    invalid(other, "source_shape_invalid");
  });
  it("25 stale canonical rendering and mismatched derivation are refused", () => {
    let input = fixtureInput();
    Object.assign(at(input.selections.mentions, 0), {
      pronunciation_id: "d125001d-0000-4000-8000-000000000001",
      pronunciation_rendering_id: "d125001e-0000-4000-8000-000000000001",
    });
    invalid(input, "pronunciation_stale");
    input = fixtureInput();
    at(input.selections.mentions, 0).pronunciation_rendering_id =
      "d125001e-0000-4000-8000-000000000001";
    invalid(input, "pronunciation_not_derived_from_applied_canonical");
  });
  it("26 ambiguous canonical lineage, duplicate version and invalid predecessor are refused", () => {
    let input = fixtureInput();
    mutateRecord(input, "pronunciations", 1).supersedes_pronunciation_id = null;
    invalid(input, "pronunciation_lineage_ambiguous");
    input = fixtureInput();
    mutateRecord(input, "pronunciations", 1).canonical_version = 1;
    invalid(input, "pronunciation_lineage_ambiguous");
    input = fixtureInput();
    mutateRecord(input, "pronunciations", 1).supersedes_pronunciation_id =
      "d125001d-0000-4000-8000-000000000002";
    invalid(input, "pronunciation_lineage_ambiguous");
  });
  it("27 wrong pronunciation-rendering voice and provider are refused", () => {
    const input = fixtureInput();
    at(input.selections.mentions, 0).pronunciation_rendering_id =
      "d125001e-0000-4000-8000-000000000003";
    invalid(input, "pronunciation_wrong_voice");
    const other = fixtureInput();
    mutateRecord(other, "pronunciation_renderings", 1).provider = "live_tts";
    invalid(other, "source_shape_invalid");
  });
  it("28 wrong NFC code-point spans and non-final-script UUIDs are refused", () => {
    let input = fixtureInput();
    at(input.selections.mentions, 0).start_offset++;
    invalid(input, "pronunciation_span_mismatch");
    input = fixtureInput();
    at(input.selections.mentions, 0).turn_id =
      "d1250015-0000-4000-8000-000000000003";
    invalid(input, "anchor_not_in_bound_script");
    input = fixtureInput();
    const turn = scriptTurn(input, 2);
    turn.spoken_text = "😀" + text(turn.spoken_text);
    input.sources.script.script_hash = scriptHash(input.sources.script, {
      brief: input.sources.brief,
    });
    input.sources.direction.script_hash = input.sources.script.script_hash;
    refreshDirection(input);
    invalid(input, "pronunciation_span_mismatch");
  });
  it("29 wrong C2, nonadjacent and self-block context fail real ownership", () => {
    let input = fixtureInput();
    at(input.selections.blocks, 2).context_turn_ids = [
      text(scriptTurn(input, 1).turn_id),
    ];
    invalid(input, "context_not_final_turn_of_preceding_block");
    input = fixtureInput();
    at(input.selections.blocks, 2).context_turn_ids = [
      text(scriptTurn(input, 3).turn_id),
    ];
    invalid(input, "context_from_own_block");
    input = fixtureInput();
    at(input.selections.blocks, 1).context_turn_ids = [];
    invalid(input, "context_not_exactly_one_preceding_turn");
    input = fixtureInput();
    at(input.selections.blocks, 0).context_turn_ids = [
      text(scriptTurn(input, 0).turn_id),
    ];
    invalid(input, "context_recipe_c0_not_empty");
    input = fixtureInput();
    at(input.selections.blocks, 1).context_recipe_version = "C1-v1";
    invalid(input, "context_recipe_unknown");
  });
  it("30 unsupported capability and every added/changed intent are rejected, never dropped", () => {
    for (const [key, value] of [
      ["intent_type", "overlap"],
      ["intent_type", "nonverbal_event"],
      ["intent_type", "pause"],
      ["intent_type", "emphasis"],
      ["value", "furious"],
      ["strength", "extreme"],
      ["scope_type", "program_block"],
      ["timing_anchor", "fa1950ac-07d3-4c37-bc68-f667ed9e27c8"],
    ] as const) {
      const input = fixtureInput();
      asRecord(
        at(asArray(input.sources.direction.performance_intents, "intents"), 0),
        "intent",
      )[key] = value;
      refreshDirection(input);
      invalid(input, "unsupported_capability");
    }
    let input = fixtureInput();
    const intents = asArray(
      input.sources.direction.performance_intents,
      "intents",
    );
    intents.push(clone(at(intents, 0)));
    refreshDirection(input);
    invalid(input, "unsupported_capability");
    input = fixtureInput();
    asArray(input.sources.direction.performance_intents, "intents").pop();
    refreshDirection(input);
    invalid(input, "unsupported_capability");
    input = fixtureInput();
    input.mechanics.resolved_generation_settings.format = "mp3";
    invalid(input, "unsupported_capability");
    input = fixtureInput();
    input.mechanics.resolved_generation_settings.channels = 2;
    invalid(input, "unsupported_capability");
    input = fixtureInput();
    input.mechanics.named_text_transform_versions.reverse();
    invalid(input, "unsupported_capability");
  });
  it("31 changed derived projection is detected by comparison and never replaced by oracle", () => {
    const input = fixtureInput();
    asRecord(
      mutateRecord(input, "voice_profile_versions", 0).render_fields,
      "voice",
    ).render_facing_design = "Different render-affecting design";
    const actual = derived(input),
      expected = objects(oracle("render_request_projections.json").projections);
    expect(at(actual.requests, 0).base_request_hash).toBe(
      at(expected, 0).base_request_hash,
    );
    expect(at(actual.requests, 1).base_request_hash).not.toBe(
      at(expected, 1).base_request_hash,
    );
    expect(canonicalJson(at(actual.requests, 1).projection)).toContain(
      "Different render-affecting design",
    );
    expect(actual.semantic_manifest_hash).not.toBe(
      "60cc91566ad0571be91eae82b62c182eaccb5821fdd94854a6b16aceb71e80e5",
    );
    expect(Object.keys(actual)).not.toContain("admission");
  });
  it("32 non-render metadata and take-index stability remain primitive-only evidence", () => {
    const input = fixtureInput(),
      turn = scriptTurn(input, 16),
      version = at(recordSet(input, "voice_profile_versions"), 0);
    const voice = {
      ...asRecord(version.render_fields, "voice"),
      version: version.version,
      voice_profile_version_id: version.voice_profile_version_id,
    };
    const record = {
      turns: [
        { ...turn, voice_profile_version_id: voice.voice_profile_version_id },
      ],
      voice_versions: { tully: voice },
      context: { recipe_version: "C2-v1", turns: [scriptTurn(input, 15)] },
      intents: [],
      pronunciation_applications: [],
      ...input.mechanics,
      take_index: 0,
    };
    checkFixtureRequestOwnership(record, {
      program_block_order: input.selections.blocks.map(
        (b) => b.program_block_id,
      ),
      turns: input.sources.script.turns,
    });
    const original = requestBaseHash(record);
    expect(
      requestBaseHash({
        ...record,
        take_index: 99,
        qa_note: "not render content",
        created_at: "later",
      }),
    ).toBe(original);
    expect(selectBaseRequestProjection({ ...record, take_index: 99 })).toEqual(
      selectBaseRequestProjection(record),
    );
    invalid({ ...input, take_index: 99 }, "projection_invalid"); // No planning take override.
  });
  it("33 PR35 nineteen-turn/not-established continuation subject is refused", async () => {
    const script = json("fixtures/connected-fixture151/TEXTURE-SCRIPT.json");
    expect(asArray(script.turns, "turns")).toHaveLength(19);
    await blocked("invalid_invocation", {
      ...context,
      continuation: {
        corpus_id: "connected-fixture151",
        semantic_acceptance: "not_established",
        render_allowed: false,
      },
      script,
    });
    const input = fixtureInput();
    input.sources.script = script;
    invalid(input, "source_shape_invalid");
    io.fault = {
      path: CORPUS + "script_pass2.json",
      kind: "replace",
      bytes: Buffer.from(JSON.stringify(script)),
    };
    const result = await invoke();
    expect(result.status).toBe("blocked");
    if (result.status === "blocked")
      expect(["source_size_mismatch", "source_hash_mismatch"]).toContain(
        result.code,
      );
  });
  it("34 PR33/34 failed evaluated subject and supplied failed assessment are refused", async () => {
    const script = json("fixtures/connected-fixture105/TEXTURE-SCRIPT.json");
    await blocked("invalid_invocation", {
      ...context,
      subject: script,
      audit: {
        result: "fail",
        fixture_stub: true,
        semantic_acceptance: "not_established",
      },
    });
    const input = fixtureInput();
    input.sources.script = script;
    invalid(input, "source_shape_invalid");
    alterBytes("audit_result.json", (seed) => {
      seed.result = "fail";
      seed.input_projection = { script_hash: script.script_hash };
    });
    await blocked("source_hash_mismatch");
  });
  it("35 genuine audit, production context and actual unsafe/missing runtime settings are refused", async () => {
    await blocked("invalid_invocation", { ...context, purpose: "production" });
    await blocked("invalid_invocation", {
      ...context,
      environment: "production",
    });
    await blocked("invalid_invocation", {
      ...context,
      profile: "connected-fixture105",
    });
    await blocked("invalid_invocation", {
      ...context,
      auditor_kind: "genuine_semantic_auditor",
    });
    for (const [key, good, bad] of [
      ["DESK_ENV", "test", "production"],
      ["PROVIDERS_ENABLED", "false", "true"],
      ["GENERATION_KILL_SWITCH", "true", "false"],
    ] as const) {
      for (const value of [undefined, bad, good.toUpperCase()]) {
        vi.stubEnv(key, value);
        await blocked("unsafe_runtime_configuration");
      }
      vi.stubEnv(key, good);
    }
    expect(io.attempts).toEqual([]);
  });
  it("36 no exported mint/finalize or forged/cloned admission route exists", async () => {
    expect(Object.keys(publicModule)).toEqual(["planFrozenFixture046Render"]);
    expect(Object.keys(planModule).sort()).toEqual([
      "deriveFrozenFixture046PlanData",
      "inspectFrozenFixture046PlanInputs",
    ]);
    const data = derived(fixtureInput()),
      genuineLooking = { result: "pass", auditPassed: true, admission: {} };
    for (const extra of [
      genuineLooking,
      clone(genuineLooking),
      { capability: {} },
      { plan: data },
      { plan: clone(data) },
    ])
      await blocked("invalid_invocation", { ...context, ...extra });
    await blocked("invalid_invocation", clone(await success()));
  });
  it("37 missing, symlink, directory and FIFO source paths are refused before opening", async () => {
    for (const kind of ["missing", "symlink", "directory", "fifo"] as const) {
      io.fault = { path: CORPUS + "evidence_package.json", kind };
      await blocked(
        kind === "missing" ? "source_missing" : "source_not_regular",
      );
    }
    expect(io.opened).toEqual([]);
  });
  it("38 finite over/undersize, short-read, EOF, read-error refusal and descriptor closure", async () => {
    const path = CORPUS + "evidence_package.json";
    for (const [kind, code] of [
      ["oversize", "source_size_mismatch"],
      ["undersize", "source_size_mismatch"],
      ["eof", "source_size_mismatch"],
      ["extra_eof", "source_size_mismatch"],
      ["read_error", "source_read_failed"],
      ["open_error", "source_read_failed"],
      ["close_error", "source_read_failed"],
      ["metadata", "source_metadata_changed"],
      ["bound", "source_read_bound_exceeded"],
    ] as const) {
      io.fault = { path, kind };
      const before = io.reads;
      await blocked(code);
      expect(io.reads - before).toBeLessThanOrEqual(65);
      expect(io.closed).toEqual(io.opened);
    }
    io.fault = { path, kind: "short" };
    await success();
    expect(io.closed).toEqual(io.opened);
  });
  it("39 malformed UTF8/JSON bytes and unknown/missing source fields are refused", async () => {
    for (const first of [0xff, 0x21]) {
      const changed = Buffer.from(bytes(CORPUS + "evidence_package.json"));
      changed[0] = first;
      io.fault = {
        path: CORPUS + "evidence_package.json",
        kind: "replace",
        bytes: changed,
      };
      await blocked("source_hash_mismatch"); // Byte admission precedes decoding; malformed content never reaches parsing.
    }
    let input = fixtureInput();
    input.sources.script.unknown = "not allowed";
    invalid(input, "source_shape_invalid");
    input = fixtureInput();
    delete input.sources.script.turns;
    invalid(input, "source_shape_invalid");
    input = fixtureInput();
    mutateRecord(input, "voice_profile_versions", 0).unknown = "not allowed";
    invalid(input, "source_shape_invalid");
    input = fixtureInput();
    delete mutateRecord(input, "pronunciations", 1).language;
    invalid(input, "source_shape_invalid");
    input = fixtureInput();
    asRecord(
      at(asArray(input.sources.support.record_pointer_ledger, "ledger"), 0),
      "entry",
    ).source_pointer = "/tables/render_blocks/0";
    invalid(input, "source_shape_invalid");
    expect(() => parseFrozenRender046Sources("not an object")).toThrow();
  });
  it("40 no partial success after last-block ownership or returned projection failure", async () => {
    const input = fixtureInput();
    at(input.selections.blocks, 8).context_turn_ids = [
      ...at(input.selections.blocks, 8).turn_ids,
    ];
    invalid(input, "context_from_own_block");
    const data = derived(fixtureInput());
    at(data.requests, 8).base_request_hash = "v1:" + "0".repeat(64);
    vi.spyOn(planModule, "deriveFrozenFixture046PlanData").mockReturnValue({
      authority: "none",
      status: "derived",
      data,
    });
    expect((await blocked("derived_binding_mismatch")).phase).toBe(
      "projections_hashes",
    );
  });
});
