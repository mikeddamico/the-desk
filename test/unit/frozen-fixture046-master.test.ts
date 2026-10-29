// Sixteen named cases. Fake Docker results exercise control flow, never fidelity.
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  beforeAll,
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as loader from "../../src/fixture/loader.js";
import * as identities from "../../src/identity/artifacts.js";
import * as fingerprints from "../../src/identity/fingerprints.js";
import { canonicalJson } from "../../src/identity/canonical-json.js";
import type { Tables } from "../../src/fixture/rows.js";
import type { FrozenMasterResult } from "../../src/runtime/frozen-fixture046-master.js";

vi.mock("node:child_process", async (original) => {
  const actual = await original<typeof import("node:child_process")>();
  return { ...actual, spawn: vi.fn(actual.spawn) };
});
vi.mock("../../src/fixture/loader.js", async (original) => {
  const actual = await original<typeof import("../../src/fixture/loader.js")>();
  return {
    ...actual,
    fixturePack: vi.fn(actual.fixturePack),
    loadFoundationRows: vi.fn(actual.loadFoundationRows),
    loadFixtureJson: vi.fn(actual.loadFixtureJson),
    loadFixtureBytes: vi.fn(actual.loadFixtureBytes),
  };
});
vi.mock("../../src/identity/artifacts.js", async (original) => {
  const actual =
    await original<typeof import("../../src/identity/artifacts.js")>();
  return {
    ...actual,
    masterAssemblyMapHash: vi.fn(actual.masterAssemblyMapHash),
  };
});
vi.mock("../../src/identity/fingerprints.js", async (original) => {
  const actual =
    await original<typeof import("../../src/identity/fingerprints.js")>();
  return { ...actual, fingerprint: vi.fn(actual.fingerprint) };
});
vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof import("node:fs/promises")>();
  return {
    ...actual,
    open: vi.fn(actual.open),
    mkdir: vi.fn(actual.mkdir),
    lstat: vi.fn(actual.lstat),
    readFile: vi.fn(actual.readFile),
  };
});
const INVOCATION = {
  profile: "frozen-fixture046-master-construction/1",
  purpose: "fixture_conformance",
  environment: "test",
};
const NAMES = [
  "rb01_take0.wav",
  "rb02_take0.wav",
  "sting.wav",
  "rb03_take0.wav",
  "rb04_take0.wav",
  "rb05_take0.wav",
  "rb06_take1.wav",
  "rb07_take0.wav",
  "rb08_take0.wav",
  "rb09_take0.wav",
];
const MASTER_HASH =
  "a7ecd855ef8a9100b4252fadfadf366efb866b72a060e9484f64002568354d73";
const MAP_HASH =
  "1235990a2aa5917fc4189aee646c04fa988722688f453eaa5b36699fd8fa6b67";
const RECIPE_HASH =
  "2006b38cd0f3461944c0aa7f28c80b25af0ffa9cf3b530d7fd61655ca8b5141f";
const ASSEMBLY_HASH =
  "302b5e4a143b499cf0a392c78638c6a7da889522cb9caa654b269fd87859487c";
let rows: Tables;
let recipe: Record<string, unknown>;
let expected: Buffer;
let runtimeImage: string;
let construct: typeof import("../../src/runtime/frozen-fixture046-master.js").constructFrozenFixture046Master;
const roots = new Set<string>();
let fake = {
  work: "",
  mode: "normal",
  starts: 0,
  stateReads: 0,
  kills: 0,
  streamFaultHandled: false,
  readFaultInjected: false,
  output: Buffer.alloc(0),
  image: "",
};
let startSignal: (() => void) | undefined;
let reachedStart: Promise<void>;
let realSpawn: typeof spawn;
let realExecution = false;
let savedEnv: Record<string, string | undefined> = {};

function record(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}
function cloneRows(): Record<string, Record<string, unknown>[]> {
  return JSON.parse(JSON.stringify(rows)) as Record<
    string,
    Record<string, unknown>[]
  >;
}
function altered(
  change: (tables: Record<string, Record<string, unknown>[]>) => void,
): void {
  const copy = cloneRows();
  change(copy);
  vi.mocked(loader.loadFoundationRows).mockReturnValueOnce({
    profile: "fixture-load-398",
    tables: copy,
  });
}
async function call(): Promise<FrozenMasterResult> {
  const result = await construct(INVOCATION);
  if (result.status === "fixture_master_construction_pass")
    roots.add(dirname(result.candidate_directory));
  else if (result.owned_root && !realExecution) roots.add(result.owned_root);
  return result;
}
function blocked(result: FrozenMasterResult, code?: string): void {
  expect(result.status).toBe("blocked");
  if (result.status === "blocked" && code) expect(result.code).toBe(code);
  expect(fake.starts).toBe(0);
}
function fakeSpawn(...parameters: unknown[]): ReturnType<typeof spawn> {
  const args = (parameters[1] as string[]).slice(1);
  const child = new EventEmitter();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let closed = false;
  const finish = (code: number | null): void => {
    if (closed) return;
    closed = true;
    stdout.end();
    stderr.end();
    setImmediate(() => {
      child.emit("close", code);
    });
  };
  Object.assign(child, {
    stdout,
    stderr,
    stdin: null,
    kill: () => {
      queueMicrotask(() => {
        finish(0);
      });
      return true;
    },
  });
  if (fake.mode === "setup" && args[0] === "start") {
    const original = stdout.on.bind(stdout);
    stdout.on = ((event: string, listener: (...values: unknown[]) => void) => {
      if (event === "readable") throw new Error("fixed setup fault");
      return original(event, listener);
    }) as typeof stdout.on;
  }
  if (fake.mode === "stream_read" && args[0] === "start") {
    const originalRead = stdout.read.bind(stdout);
    stdout.read = ((size?: number) => {
      if (size !== undefined && size > 0) {
        fake.readFaultInjected = true;
        throw new Error("fixed read fault");
      }
      return originalRead(size) as unknown;
    }) as typeof stdout.read;
  }
  queueMicrotask(() => {
    void (async () => {
      if (fake.mode === "spawn" && args[0] === "create") {
        child.emit("error", new Error("fixed spawn fault"));
        finish(null);
        return;
      }
      if (args[0] === "image") stdout.write(fake.image + "\n");
      if (args[0] === "create") {
        const mount = args.find(
          (value) =>
            value.startsWith("type=bind,src=") && value.endsWith(",dst=/work"),
        );
        fake.work =
          mount?.slice("type=bind,src=".length, -",dst=/work".length) ?? "";
        stdout.write("f".repeat(64) + "\n");
      }
      if (args[0] === "start") {
        fake.starts++;
        startSignal?.();
        if (fake.mode === "deadline") return;
        if (fake.mode === "stream_read") {
          stdout.write("fixed read sentinel");
          return;
        }
        if (fake.mode === "stream_error") {
          fake.streamFaultHandled = stderr.listenerCount("error") > 0;
          stderr.emit("error", new Error("fixed stream fault"));
          return;
        }
        if (fake.mode === "cap") {
          stderr.write(Buffer.alloc(1048577));
          return;
        }
        if (fake.mode === "nonzero" || fake.mode === "nonzero_cleanup") {
          finish(1);
          return;
        }
        if (fake.mode !== "setup")
          await fs.writeFile(join(fake.work, "master.wav"), fake.output, {
            flag: "wx",
          });
      }
      if (args[0] === "kill") fake.kills++;
      if (args[0] === "inspect") {
        fake.stateReads++;
        const running = fake.mode === "attach_running" && fake.kills === 0;
        const nonzero =
          fake.mode === "terminal_nonzero" ||
          (fake.mode === "late_nonzero" && fake.stateReads >= 3);
        stdout.write(
          JSON.stringify({
            Status: running ? "running" : "exited",
            Running: running,
            Pid: running ? 7312 : 0,
            ExitCode: nonzero ? 17 : 0,
            Error: "",
            OOMKilled: false,
          }),
        );
      }
      if (args[0] === "wait") stdout.write("0\n");
      if (
        args[0] === "rm" &&
        (fake.mode === "cleanup" || fake.mode === "nonzero_cleanup")
      ) {
        finish(1);
        return;
      }
      finish(0);
    })().catch((error: unknown) => {
      child.emit("error", error);
      finish(1);
    });
  });
  return child as unknown as ReturnType<typeof spawn>;
}

beforeAll(async () => {
  const actual = await vi.importActual<typeof loader>(
    "../../src/fixture/loader.js",
  );
  rows = actual.loadFoundationRows().tables;
  recipe = record(actual.loadFixtureJson("assembly_recipe.json"));
  // Independent fixed canonical RIFF header and admitted PCM, never oracle master/map.
  const pcm = Buffer.concat(
    NAMES.map((name) =>
      actual.loadFixtureBytes("fixture_audio/" + name).subarray(44),
    ),
  );
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(pcm.length + 36, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(48000, 24);
  header.writeUInt32LE(96000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  expected = Buffer.concat([header, pcm]);
  runtimeImage = record(
    JSON.parse(
      await fs.readFile(
        "/tmp/the-desk-fixture046-runtime/receipt.json",
        "utf8",
      ),
    ),
  ).image_id as string;
  realSpawn = (
    await vi.importActual<typeof import("node:child_process")>(
      "node:child_process",
    )
  ).spawn;
});
beforeEach(async () => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.resetModules();
  const actualLoader = await vi.importActual<typeof loader>(
    "../../src/fixture/loader.js",
  );
  vi.mocked(loader.fixturePack).mockImplementation(actualLoader.fixturePack);
  vi.mocked(loader.loadFoundationRows).mockImplementation(
    actualLoader.loadFoundationRows,
  );
  vi.mocked(loader.loadFixtureJson).mockImplementation(
    actualLoader.loadFixtureJson,
  );
  vi.mocked(loader.loadFixtureBytes).mockImplementation(
    actualLoader.loadFixtureBytes,
  );
  vi.mocked(identities.masterAssemblyMapHash).mockImplementation(
    (
      await vi.importActual<typeof identities>(
        "../../src/identity/artifacts.js",
      )
    ).masterAssemblyMapHash,
  );
  vi.mocked(fingerprints.fingerprint).mockImplementation(
    (
      await vi.importActual<typeof fingerprints>(
        "../../src/identity/fingerprints.js",
      )
    ).fingerprint,
  );
  const actualFs = await vi.importActual<typeof fs>("node:fs/promises");
  vi.mocked(fs.open).mockImplementation(actualFs.open);
  vi.mocked(fs.mkdir).mockImplementation(actualFs.mkdir);
  vi.mocked(fs.lstat).mockImplementation(actualFs.lstat);
  vi.mocked(fs.readFile).mockImplementation(actualFs.readFile);
  savedEnv = Object.fromEntries(
    ["DESK_ENV", "PROVIDERS_ENABLED", "GENERATION_KILL_SWITCH"].map((key) => [
      key,
      process.env[key],
    ]),
  );
  realExecution = false;
  process.env.DESK_ENV = "test";
  process.env.PROVIDERS_ENABLED = "false";
  process.env.GENERATION_KILL_SWITCH = "true";
  fake = {
    work: "",
    mode: "normal",
    starts: 0,
    stateReads: 0,
    kills: 0,
    streamFaultHandled: false,
    readFaultInjected: false,
    output: Buffer.from(expected),
    image: runtimeImage,
  };
  reachedStart = new Promise<void>((resolve) => {
    startSignal = resolve;
  });
  vi.mocked(spawn).mockImplementation(fakeSpawn);
  construct = (await import("../../src/runtime/frozen-fixture046-master.js"))
    .constructFrozenFixture046Master;
});
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) Reflect.deleteProperty(process.env, key);
    else process.env[key] = value;
  }
  for (const root of roots) await fs.rm(root, { recursive: true, force: true });
  roots.clear();
});

describe("frozen fixture046 master construction", () => {
  it("recomputes the frozen v3 recipe independently of historical IDs", () => {
    expect(identities.assemblyRecipeHash(recipe)).toBe(RECIPE_HASH);
    expect(
      identities.assemblyRecipeHash({ ...recipe, artifact_id: "different" }),
    ).toBe(RECIPE_HASH);
  });
  it("joins exactly nine approved passing takes without changing rejected history", async () => {
    const before = canonicalJson(rows);
    const result = await call();
    expect(result.status).toBe("fixture_master_construction_pass");
    if (result.status !== "fixture_master_construction_pass") return;
    const lineage = result.receipt.selected_take_lineage as Record<
      string,
      unknown
    >[];
    expect(lineage).toHaveLength(9);
    expect(lineage[5]?.take_index).toBe(1);
    for (const selected of lineage) {
      const take = rows.render_takes?.find(
        (row) => row.render_take_id === selected.render_take_id,
      );
      const providerCall = rows.provider_calls?.find(
        (row) => row.provider_call_id === take?.provider_call_id,
      );
      const block = rows.render_blocks?.find(
        (row) => row.render_block_id === selected.render_block_id,
      );
      expect(providerCall?.request_fingerprint).toBe(block?.base_request_hash);
      expect(Object.hasOwn(providerCall ?? {}, "base_request_hash")).toBe(
        false,
      );
    }
    expect(fake.kills).toBe(0);
    expect(canonicalJson(rows)).toBe(before);
    expect(Object.isFrozen(result.receipt)).toBe(true);
    expect(Object.values(result.non_clearance)).toEqual(Array(7).fill(false));
  });
  it("refuses missing rejected ambiguous and technically failed effective selections", async () => {
    const changes = [
      (t: ReturnType<typeof cloneRows>) => {
        t.take_selections?.splice(0, 1);
      },
      (t: ReturnType<typeof cloneRows>) => {
        record(t.take_selections?.[0]).decision = "rejected";
      },
      (t: ReturnType<typeof cloneRows>) => {
        const s = record(t.take_selections?.[1]);
        s.render_block_id = t.take_selections?.[0]?.render_block_id;
        s.render_take_id = t.take_selections?.[0]?.render_take_id;
      },
      (t: ReturnType<typeof cloneRows>) => {
        record(t.render_takes?.[0]).technical_validation = {
          status: "fail",
          reason_code: "unexpected_truncation",
        };
      },
    ];
    for (const change of changes) {
      altered(change);
      blocked(await call());
    }
  });
  it("refuses wrong blocks and stale planned request bindings", async () => {
    for (const key of ["program_block_id", "base_request_hash"]) {
      altered((t) => {
        record(t.render_blocks?.[0])[key] =
          key === "base_request_hash"
            ? "v1:" + "0".repeat(64)
            : "00000000-0000-4000-8000-000000000000";
      });
      blocked(await call());
    }
  });
  it("refuses dangling cross-block and cyclic supersession edges", async () => {
    for (const target of [
      "00000000-0000-4000-8000-000000000000",
      "cross",
      "self",
    ]) {
      altered((t) => {
        const first = record(t.take_selections?.[0]);
        first.supersedes_selection_id =
          target === "self"
            ? first.take_selection_id
            : target === "cross"
              ? t.take_selections?.[1]?.take_selection_id
              : target;
      });
      blocked(await call(), "selection_admission_invalid");
    }
  });
  it("refuses tampered recipe order and changed transform settings", async () => {
    const original = (
      await vi.importActual<typeof loader>("../../src/fixture/loader.js")
    ).loadFixtureJson;
    for (const change of [
      (r: Record<string, unknown>) => {
        r.ordered_audio_artifact_hashes = [
          ...(r.ordered_audio_artifact_hashes as unknown[]),
        ].reverse();
      },
      (r: Record<string, unknown>) => {
        r.fade_policy_version = "changed";
      },
    ]) {
      const modified = structuredClone(recipe);
      change(modified);
      vi.mocked(loader.loadFixtureJson).mockImplementation((member) =>
        member === "assembly_recipe.json" ? modified : original(member),
      );
      blocked(await call(), "recipe_identity_invalid");
    }
    vi.mocked(loader.loadFixtureJson).mockImplementation(original);
  });
  it("refuses swapped duplicated and misplaced ordered inputs before execution", async () => {
    const original = (
      await vi.importActual<typeof loader>("../../src/fixture/loader.js")
    ).loadFixtureJson;
    for (const order of [
      [1, 0, 2, 3, 4, 5, 6, 7, 8, 9],
      [0, 0, 2, 3, 4, 5, 6, 7, 8, 9],
      [0, 2, 1, 3, 4, 5, 6, 7, 8, 9],
    ]) {
      const hashes = recipe.ordered_audio_artifact_hashes as unknown[];
      vi.mocked(loader.loadFixtureJson).mockImplementation((member) =>
        member === "assembly_recipe.json"
          ? {
              ...recipe,
              ordered_audio_artifact_hashes: order.map((i) => hashes[i]),
            }
          : original(member),
      );
      blocked(await call());
    }
    vi.mocked(loader.loadFixtureJson).mockImplementation(original);
  });
  it("refuses substituted truncated response bytes and wrong sting", async () => {
    const original = (
      await vi.importActual<typeof loader>("../../src/fixture/loader.js")
    ).loadFixtureBytes;
    for (const mode of ["substitution", "truncation", "sting"]) {
      vi.mocked(loader.loadFixtureBytes).mockImplementation((member) => {
        const data = Buffer.from(original(member));
        if (
          member ===
          (mode === "sting"
            ? "fixture_audio/sting.wav"
            : "fixture_audio/rb01_take0.wav")
        ) {
          if (mode === "truncation") return data.subarray(0, -2);
          data[44] = (data[44] ?? 0) ^ 1;
        }
        return data;
      });
      blocked(await call());
    }
    vi.mocked(loader.loadFixtureBytes).mockImplementation(original);
  });
  it("requests only the adopted recipe mapping rows and eleven permitted WAV snapshots", async () => {
    await call();
    const requests = vi
      .mocked(loader.loadFixtureBytes)
      .mock.calls.map(([member]) => member)
      .filter((member) => member.startsWith("fixture_audio/"));
    expect(requests).toEqual(
      [
        "rb01_take0.wav",
        "rb02_take0.wav",
        "rb03_take0.wav",
        "rb04_take0.wav",
        "rb05_take0.wav",
        "rb06_take0.wav",
        "rb06_take1.wav",
        "rb07_take0.wav",
        "rb08_take0.wav",
        "rb09_take0.wav",
        "sting.wav",
      ].map((n) => "fixture_audio/" + n),
    );
    expect(
      vi
        .mocked(loader.loadFixtureJson)
        .mock.calls.some(([n]) => n === "master_assembly_map.json"),
    ).toBe(false);
    const source = readFileSync(
      new URL("../../src/runtime/frozen-fixture046-master.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(
      /\.member\(|fixture_audio\/master\.wav|loadFixtureJson\("master_assembly_map/,
    );
  });
  it("constructs the actual pinned master and derived pair twice with first-pass cleanup gating", async () => {
    realExecution = true;
    vi.mocked(spawn).mockImplementation(realSpawn);
    for (let run = 0; run < 2; run++) {
      const result = await call();
      expect(result.status).toBe("fixture_master_construction_pass");
      if (result.status !== "fixture_master_construction_pass")
        throw new Error("real construction refused");
      const master = await fs.readFile(
        join(result.candidate_directory, "master.wav"),
      );
      const map = JSON.parse(
        await fs.readFile(join(result.candidate_directory, "map.json"), "utf8"),
      ) as unknown;
      expect(master).toEqual(expected);
      expect(master.length).toBe(114282);
      expect(record(result.receipt.output)).toMatchObject({
        master_sha256: MASTER_HASH,
        master_frame_count: "57119",
        recipe_hash: RECIPE_HASH,
        map_hash: MAP_HASH,
        assembly_fingerprint: ASSEMBLY_HASH,
      });
      expect(identities.masterAssemblyMapHash(map)).toBe(MAP_HASH);
      expect(
        (record(map).segments as Record<string, unknown>[]).map((s) => [
          s.start_frame,
          s.end_frame,
        ]),
      ).toEqual([
        [0, 5040],
        [5040, 10320],
        [10320, 12720],
        [12720, 18240],
        [18240, 24000],
        [24000, 30000],
        [30000, 36959],
        [36959, 43439],
        [43439, 50159],
        [50159, 57119],
      ]);
      await fs.access(join(result.candidate_directory, "COMMITTED"));
      const root = dirname(result.candidate_directory);
      await fs.rm(root, { recursive: true });
      roots.delete(root);
    }
  }, 600000); // New two-constructor case only; existing native limits are unchanged.
  it("refuses same-length wrong content malformed header and wrong frame count", async () => {
    for (const mode of ["data", "header", "frames"]) {
      fake.output = Buffer.from(expected);
      if (mode === "frames") {
        fake.output = fake.output.subarray(0, -2);
        fake.output.writeUInt32LE(fake.output.length - 8, 4);
        fake.output.writeUInt32LE(fake.output.length - 44, 40);
      } else
        fake.output[mode === "data" ? 44 : 8] =
          (fake.output[mode === "data" ? 44 : 8] ?? 0) ^ 1;
      const result = await call();
      expect(result.status).toBe("blocked");
    }
  });
  it("refuses wrong historical references map identity and assembly fingerprint", async () => {
    altered((t) => {
      record(t.master_assembly_maps?.[0]).master_audio_artifact_id =
        "88888888-8888-4888-8888-000000000001";
    });
    blocked(await call(), "historical_ids_invalid");
    const actualMapHash = (
      await vi.importActual<typeof identities>(
        "../../src/identity/artifacts.js",
      )
    ).masterAssemblyMapHash;
    vi.mocked(identities.masterAssemblyMapHash).mockImplementationOnce(
      (map) => {
        const changed = structuredClone(record(map));
        const first = (changed.segments as Record<string, unknown>[])[0];
        if (!first) throw new Error("missing independent segment");
        first.start_frame = 1;
        return actualMapHash(changed);
      },
    );
    expect(await call()).toMatchObject({ code: "map_identity_mismatch" });
    vi.mocked(identities.masterAssemblyMapHash).mockReturnValueOnce(
      "0".repeat(64),
    );
    expect((await call()).status).toBe("blocked");
    const original = (
      await vi.importActual<typeof fingerprints>(
        "../../src/identity/fingerprints.js",
      )
    ).fingerprint;
    vi.mocked(fingerprints.fingerprint).mockImplementation(
      (stage, projection) =>
        stage === "assembly" ? "0".repeat(64) : original(stage, projection),
    );
    expect((await call()).status).toBe("blocked");
  });
  it("refuses unavailable registration wrong image identity and wrong argv identity", async () => {
    const actualFs = await vi.importActual<typeof fs>("node:fs/promises");
    vi.mocked(fs.lstat).mockImplementation(async (path, ...options) => {
      if (path === "/tmp/the-desk-fixture046-runtime")
        throw new Error("missing fixed profile");
      return actualFs.lstat(path, ...options);
    });
    try {
      blocked(await call(), "execution_profile_unavailable");
    } finally {
      vi.mocked(fs.lstat).mockImplementation(actualFs.lstat);
    }
    fake.image = "sha256:" + "0".repeat(64);
    blocked(await call(), "executable_identity_invalid");
    fake.image = runtimeImage;
    const original = (await vi.importActual<typeof fs>("node:fs/promises"))
      .readFile;
    vi.mocked(fs.readFile).mockImplementation(async (path, ...args) =>
      (typeof path === "string" ||
        path instanceof URL ||
        Buffer.isBuffer(path)) &&
      path.toString().endsWith("execution-profile.json")
        ? JSON.stringify({ argv: ["changed"] })
        : original(path, ...args),
    );
    blocked(await call(), "execution_profile_unavailable");
    vi.mocked(fs.readFile).mockImplementation(original);
    fake.image = "x".repeat(16385);
    blocked(await call(), "executable_identity_invalid");
  });
  it("preserves failure through launch setup nonzero cap and deadline cleanup", async () => {
    for (const mode of [
      "spawn",
      "setup",
      "stream_read",
      "stream_error",
      "nonzero",
      "attach_running",
      "terminal_nonzero",
      "late_nonzero",
      "cap",
      "deadline",
    ]) {
      fake.mode = mode;
      fake.starts = 0;
      fake.stateReads = 0;
      fake.kills = 0;
      fake.streamFaultHandled = false;
      fake.readFaultInjected = false;
      if (mode === "deadline") {
        reachedStart = new Promise<void>((resolve) => {
          startSignal = resolve;
        });
        vi.useFakeTimers({
          toFake: ["setTimeout", "clearTimeout", "performance"],
        });
        const pending = call();
        await reachedStart;
        await vi.advanceTimersByTimeAsync(180001);
        expect(await pending).toMatchObject({
          code: "execution_timed_out",
          cleanup: "complete",
        });
        vi.useRealTimers();
      } else
        expect(await call()).toMatchObject({
          code:
            mode === "cap"
              ? "execution_output_limit"
              : [
                    "nonzero",
                    "attach_running",
                    "terminal_nonzero",
                    "late_nonzero",
                  ].includes(mode)
                ? "execution_failed"
                : "execution_start_failed",
          cleanup: "complete",
        });
      if (mode === "attach_running") expect(fake.kills).toBe(1);
      if (mode === "stream_error") expect(fake.streamFaultHandled).toBe(true);
      if (mode === "stream_read") expect(fake.readFaultInjected).toBe(true);
    }
  }, 120000);
  it("prevents partial pair release collision overwrite and uncertain publication success", async () => {
    const originalOpen = (await vi.importActual<typeof fs>("node:fs/promises"))
      .open;
    vi.spyOn(fs, "open").mockImplementation(async (path, ...args) => {
      if (String(path).endsWith("/map.json"))
        throw new Error("fixed staging fault");
      return originalOpen(path, ...args);
    });
    expect((await call()).status).toBe("blocked");
    vi.mocked(fs.open).mockImplementation(originalOpen);
    const originalMkdir = (await vi.importActual<typeof fs>("node:fs/promises"))
      .mkdir;
    vi.spyOn(fs, "mkdir").mockImplementation(async (path, ...args) => {
      if (String(path).endsWith("/candidate")) {
        await originalMkdir(path);
        throw Object.assign(new Error("collision"), { code: "EEXIST" });
      }
      return originalMkdir(path, ...args);
    });
    expect((await call()).status).toBe("blocked");
    vi.mocked(fs.mkdir).mockImplementation(originalMkdir);
    vi.spyOn(fs, "mkdir").mockImplementation(async (path, ...args) => {
      if (String(path).endsWith("/COMMITTED"))
        throw new Error("uncertain marker");
      return originalMkdir(path, ...args);
    });
    const failed = await call();
    expect(failed).toMatchObject({
      status: "blocked",
      code: "publication_failed",
      cleanup: "pending",
    });
    expect(await construct(INVOCATION)).toMatchObject({
      code: "construction_busy",
    });
  });
  it("keeps first-error precedence and holds the latch through incomplete cleanup", async () => {
    process.env.DESK_ENV = "production";
    expect(await construct({})).toMatchObject({ code: "invalid_invocation" });
    process.env.DESK_ENV = "test";
    altered((t) => {
      record(t.take_selections?.[0]).decision = "rejected";
    });
    const originalBytes = (
      await vi.importActual<typeof loader>("../../src/fixture/loader.js")
    ).loadFixtureBytes;
    vi.mocked(loader.loadFixtureBytes).mockImplementation((n) =>
      n === "fixture_audio/rb01_take0.wav"
        ? Buffer.alloc(44)
        : originalBytes(n),
    );
    blocked(await call(), "selection_admission_invalid");
    vi.mocked(loader.loadFixtureBytes).mockImplementation(originalBytes);
    const originalHash = (
      await vi.importActual<typeof identities>(
        "../../src/identity/artifacts.js",
      )
    ).masterAssemblyMapHash;
    vi.mocked(identities.masterAssemblyMapHash).mockImplementationOnce(() => {
      process.env.GENERATION_KILL_SWITCH = "false";
      return "0".repeat(64);
    });
    expect(await call()).toMatchObject({ code: "map_identity_mismatch" });
    process.env.GENERATION_KILL_SWITCH = "true";
    vi.mocked(identities.masterAssemblyMapHash).mockImplementationOnce(
      (map) => {
        const hash = originalHash(map);
        process.env.GENERATION_KILL_SWITCH = "false";
        return hash;
      },
    );
    expect(await call()).toMatchObject({
      code: "unsafe_runtime_configuration",
      phase: "final_settings",
    });
    process.env.GENERATION_KILL_SWITCH = "true";
    fake.mode = "nonzero_cleanup";
    const failed = await call();
    expect(failed).toMatchObject({
      status: "blocked",
      code: "execution_failed",
    });
    if (failed.status === "blocked") expect(failed.cleanup).toBe("pending");
    expect(await construct(INVOCATION)).toMatchObject({
      code: "construction_busy",
    });
  });
});
