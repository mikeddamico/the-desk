import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import * as fs from "node:fs/promises";
import type { Stats } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import * as crypto from "node:crypto";
import {
  canonicalJson,
  domainHash,
} from "../../src/identity/canonical-json.js";
import { acquireSubject } from "../../src/runtime/technical-master-acquisition.js";
import { evaluateTechnicalMaster } from "../../src/runtime/technical-master-admission.js";
import { inspectMaster } from "../../src/runtime/technical-master-inspection.js";
import * as inspection from "../../src/runtime/technical-master-inspection.js";
import {
  capture,
  object,
  integer,
  rational,
  checkPolicy,
  measureSubject,
  checkDuration,
  identities,
  checkMap,
  checkDecode,
  parseLoudness,
  checkLoudness,
  checkSilence,
  sha,
  type Subject,
} from "../../src/runtime/technical-master-checks.js";

vi.mock("node:child_process", async (original) => {
  const actual = await original<typeof import("node:child_process")>();
  return { ...actual, spawn: vi.fn(actual.spawn) };
});
vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof import("node:fs/promises")>();
  return {
    ...actual,
    open: vi.fn(actual.open),
    mkdtemp: vi.fn(actual.mkdtemp),
  };
});
vi.mock("node:crypto", async (original) => {
  const actual = await original<typeof import("node:crypto")>();
  return { ...actual, randomBytes: vi.fn(actual.randomBytes) };
});
const pure = process.env.DESK_P33_PROFILE === "technical-master-pure";
const invocation = {
  profile: "technical-master-admission/1",
  candidate_scope: "synthetic60-positive",
  purpose: "evaluation",
  environment: "test",
};
const gatePin =
  "6c3a34c8a16a5e883d34f9016b36c0931daafb67e66a1b7dcf286dbf5fa06fa7";
const root = new URL(
  "../../fixtures/technical-master-admission/",
  import.meta.url,
);
const savedEnv = {
  DESK_ENV: process.env.DESK_ENV,
  PROVIDERS_ENABLED: process.env.PROVIDERS_ENABLED,
  GENERATION_KILL_SWITCH: process.env.GENERATION_KILL_SWITCH,
};
let subject: Subject;
beforeEach(async () => {
  vi.clearAllMocks();
  subject = (await acquireSubject("synthetic60-positive")).subject;
  process.env.DESK_ENV = "test";
  process.env.PROVIDERS_ENABLED = "false";
  process.env.GENERATION_KILL_SWITCH = "true";
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) Reflect.deleteProperty(process.env, key);
    else process.env[key] = value;
  }
});
function fingerprint(): string {
  return domainHash(
    "technical-master-validation-input-v1",
    identities(subject),
  );
}
function summary(value = "-20.0"): Buffer {
  return Buffer.from(
    `[Parsed_ebur128_1 @ 0xabc] Summary:\n\n  Integrated loudness:\n    I:         ${value} LUFS\n    Threshold: -30.0 LUFS\n\n  Loudness range:\n    LRA:         0.0 LU\n    Threshold: -40.0 LUFS\n    LRA low:   -20.0 LUFS\n    LRA high:  -20.0 LUFS\n`,
  );
}
// Authored parser records are mechanics controls, not an acoustic observation.
function decode(pcm: Buffer): { stdout: Buffer; hash: string } {
  const headers = [
    "#format: frame checksums",
    "#version: 1",
    "#hash: SHA256",
    "#tb 0: 1/48000",
    "#media_type 0: audio",
    "#codec_id 0: pcm_s16le",
    "#sample_rate 0: 48000",
    "#channel_layout_name 0: mono",
    "#stream#, dts,        pts, duration,     size, hash",
  ];
  return {
    stdout: Buffer.from(
      headers.join("\n") +
        `\n0, 0, 0, ${String(pcm.length / 2)}, ${String(pcm.length)}, ${sha(pcm)}\n`,
    ),
    hash: `SHA256=${sha(pcm)}\n`,
  };
}
function silent(start: number, count: number): void {
  subject.master.fill(0, 44 + start * 2, 44 + (start + count) * 2);
}

function statObservation(value: Stats) {
  return {
    dev: value.dev,
    ino: value.ino,
    uid: value.uid,
    gid: value.gid,
    mode: value.mode,
    nlink: value.nlink,
    size: value.size,
    mtime_ms: value.mtimeMs,
    ctime_ms: value.ctimeMs,
    regular: value.isFile(),
    directory: value.isDirectory(),
  };
}
// Only the two genuine cases emit these fixed, bounded observational records.
async function emitObservation(
  marker: string,
  value: unknown,
  limit: number,
): Promise<void> {
  const record = marker + " " + JSON.stringify(value) + "\n";
  if (Buffer.byteLength(record, "utf8") > limit)
    throw new Error("technical master evidence record exceeds its bound");
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(record, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
async function emitTypedResult(
  caseName: string,
  scope: string,
  result: Awaited<ReturnType<typeof evaluateTechnicalMaster>>,
  observationStatus: string,
): Promise<void> {
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > 8192)
    throw new Error("technical master typed result exceeds 8 KiB");
  await emitObservation(
    "TECHNICAL_MASTER_TYPED_RESULT_V1",
    {
      case_name: caseName,
      source_scope: scope,
      observation_status: observationStatus,
      result,
    },
    9216,
  );
}
describe("technical master admission", () => {
  it.skipIf(pure)(
    "admits the distinct positive fixture only after actual pinned inspection",
    async () => {
      const caseName =
        "admits the distinct positive fixture only after actual pinned inspection";
      const genuine = inspection.inspectMaster;
      const actualFs = await vi.importActual<typeof fs>("node:fs/promises");
      const genuineOpen = actualFs.open;
      const savedOpenImplementation = vi
        .mocked(fs.open)
        .getMockImplementation();
      const descriptorStats: ReturnType<typeof statObservation>[] = [];
      let readCount = 0;
      let readBytes: number | null = null;
      let readRequested: number | null = null;
      let observationFailed = false;
      const readObservation = (): {
        count: number;
        bytes: number | null;
        requested: number | null;
        failed: boolean;
      } => ({
        count: readCount,
        bytes: readBytes,
        requested: readRequested,
        failed: observationFailed,
      });
      const restoreMethods: (() => boolean)[] = [];
      const directories: {
        root: ReturnType<typeof statObservation>;
        work: ReturnType<typeof statObservation>;
        canonical: boolean;
        exact_names: boolean;
      }[] = [];
      const openSpy = vi.spyOn(fs, "open").mockImplementation(async function (
        this: unknown,
        ...args
      ) {
        const file = await genuineOpen.apply(this, args);
        const path = args[0];
        if (
          typeof path !== "string" ||
          !path.startsWith(join(tmpdir(), "the-desk-mva-")) ||
          !path.endsWith("/work/decoded.sha256")
        )
          return file;
        const workPath = dirname(path);
        const rootPath = dirname(workPath);
        const observeDirectories = async (): Promise<void> => {
          try {
            if (directories.length >= 2) return;
            directories.push({
              root: statObservation(await actualFs.lstat(rootPath)),
              work: statObservation(await actualFs.lstat(workPath)),
              canonical:
                (await actualFs.realpath(rootPath)) === rootPath &&
                (await actualFs.realpath(workPath)) === workPath,
              exact_names:
                canonicalJson((await actualFs.readdir(workPath)).sort()) ===
                canonicalJson(["decoded.sha256", "master.wav"]),
            });
          } catch {
            observationFailed = true;
          }
        };
        await observeDirectories();
        const originalStat: unknown = Reflect.get(file, "stat");
        const originalRead: unknown = Reflect.get(file, "read");
        if (
          typeof originalStat !== "function" ||
          typeof originalRead !== "function"
        ) {
          observationFailed = true;
          return file;
        }
        const statDescriptor = Reflect.getOwnPropertyDescriptor(file, "stat");
        const readDescriptor = Reflect.getOwnPropertyDescriptor(file, "read");
        restoreMethods.push(() =>
          statDescriptor
            ? Reflect.defineProperty(file, "stat", statDescriptor)
            : Reflect.deleteProperty(file, "stat"),
        );
        restoreMethods.push(() =>
          readDescriptor
            ? Reflect.defineProperty(file, "read", readDescriptor)
            : Reflect.deleteProperty(file, "read"),
        );
        try {
          Reflect.defineProperty(file, "stat", {
            configurable: true,
            writable: true,
            value: async function (this: unknown, ...statArgs: unknown[]) {
              const result: unknown = await Reflect.apply(
                originalStat,
                this,
                statArgs,
              );
              try {
                if (descriptorStats.length < 2)
                  descriptorStats.push(statObservation(result as Stats));
                if (descriptorStats.length === 2) await observeDirectories();
              } catch {
                observationFailed = true;
              }
              return result;
            },
          });
          Reflect.defineProperty(file, "read", {
            configurable: true,
            writable: true,
            value: async function (this: unknown, ...readArgs: unknown[]) {
              readCount++;
              if (typeof readArgs[2] === "number") readRequested = readArgs[2];
              const result: unknown = await Reflect.apply(
                originalRead,
                this,
                readArgs,
              );
              try {
                readBytes = (result as { bytesRead: number }).bytesRead;
              } catch {
                observationFailed = true;
              }
              return result;
            },
          });
        } catch {
          observationFailed = true;
        }
        return file;
      });
      let observation: Awaited<ReturnType<typeof genuine>> | undefined;
      let inspectionCount = 0;
      const spy = vi
        .spyOn(inspection, "inspectMaster")
        .mockImplementation(async function (this: unknown, acquired) {
          inspectionCount++;
          const actual = await genuine.call(this, acquired);
          observation = actual;
          return actual;
        });
      let restorationFailed: boolean;
      try {
        const result = await evaluateTechnicalMaster(invocation);
        const observationStatus = observation
          ? "returned"
          : "unavailable_before_return";
        await emitTypedResult(
          caseName,
          "synthetic60-positive",
          result,
          observationStatus,
        );
        const before = descriptorStats[0];
        const after = descriptorStats[1];
        const stableFields = [
          "dev",
          "ino",
          "uid",
          "gid",
          "mode",
          "nlink",
          "size",
          "mtime_ms",
          "ctime_ms",
        ] as const;
        const directoryFields = ["dev", "ino", "uid", "gid", "mode"] as const;
        const firstDirectories = directories[0];
        const lastDirectories = directories[1];
        const ownerProvenance =
          directories.length === 2 &&
          directories.every(
            (entry) =>
              entry.canonical &&
              entry.exact_names &&
              [entry.root, entry.work].every(
                (dir) =>
                  dir.directory &&
                  dir.uid === process.getuid?.() &&
                  (dir.mode & 0o077) === 0,
              ),
          ) &&
          firstDirectories !== undefined &&
          lastDirectories !== undefined &&
          directoryFields.every(
            (field) =>
              firstDirectories.root[field] === lastDirectories.root[field] &&
              firstDirectories.work[field] === lastDirectories.work[field],
          );
        const readSnapshot = readObservation();
        const generatedHashRead = {
          descriptor_stats: descriptorStats,
          directory_observations: directories,
          read_count: readSnapshot.count,
          requested_bytes: readSnapshot.requested,
          returned_bytes: readSnapshot.bytes,
          accepted_file_limit_bytes: 72,
          observations_complete:
            descriptorStats.length === 2 && directories.length === 2,
          observation_failed: readSnapshot.failed,
          predicates: {
            regular:
              before?.regular === true &&
              (after === undefined || after.regular),
            single_link:
              before?.nlink === 1 && (after === undefined || after.nlink === 1),
            size:
              before?.size === 72 && (after === undefined || after.size === 72),
            private_mode:
              before !== undefined &&
              (before.mode & 0o022) === 0 &&
              (after === undefined || (after.mode & 0o022) === 0),
            owner_provenance: ownerProvenance,
            stable:
              before !== undefined &&
              after !== undefined &&
              stableFields.every((field) => before[field] === after[field]),
            expected_length:
              readSnapshot.count === 1 && readSnapshot.bytes === 72,
          },
        };
        if (observation) {
          const hashBytes = Buffer.from(observation.hashFile, "utf8");
          if (
            observation.stdout.length > 1048576 ||
            observation.stderr.length > 1048576 ||
            hashBytes.length !== 72
          )
            throw new Error(
              "technical master inspection evidence exceeds its stream/hash bounds",
            );
          await emitObservation(
            "TECHNICAL_MASTER_RAW_INSPECTION_V1",
            {
              case_name: caseName,
              source_scope: "synthetic60-positive",
              observation_status: observationStatus,
              stdout_base64: observation.stdout.toString("base64"),
              stderr_base64: observation.stderr.toString("base64"),
              hashFile: observation.hashFile,
              generated_hash_read: generatedHashRead,
              stdout_bytes: observation.stdout.length,
              stderr_bytes: observation.stderr.length,
              hash_file_bytes: hashBytes.length,
              stdout_sha256: sha(observation.stdout),
              stderr_sha256: sha(observation.stderr),
              hash_file_sha256: sha(hashBytes),
            },
            3145728,
          );
        } else {
          await emitObservation(
            "TECHNICAL_MASTER_RAW_INSPECTION_V1",
            {
              case_name: caseName,
              source_scope: "synthetic60-positive",
              observation_status: observationStatus,
              generated_hash_read: generatedHashRead,
            },
            3145728,
          );
        }
        if (
          readSnapshot.failed ||
          (observation !== undefined &&
            (descriptorStats.length !== 2 ||
              directories.length !== 2 ||
              readSnapshot.count !== 1))
        )
          throw new Error("generated hash metadata observation failed");
        if (
          inspectionCount > 0 ||
          result.status === "synthetic_technical_policy_pass"
        )
          expect(inspectionCount).toBe(1);
        expect(result).toMatchObject({
          status: "synthetic_technical_policy_pass",
          input_fingerprint: gatePin,
          authority: "none",
          cleanup: "complete",
          subject_basis: "captured_snapshots",
        });
        expect(Object.values(object(result.non_clearance))).toEqual(
          Array(8).fill(false),
        );
        expect(Object.isFrozen(result)).toBe(true);
        expect(Object.values(object(result.checks))).toEqual(
          Array(7).fill("pass"),
        );
      } finally {
        let restored = true;
        for (const restore of restoreMethods) {
          try {
            if (!restore()) restored = false;
          } catch {
            restored = false;
          }
        }
        try {
          openSpy.mockRestore();
          vi.mocked(fs.open).mockImplementation(
            savedOpenImplementation ?? genuineOpen,
          );
        } finally {
          spy.mockRestore();
        }
        restorationFailed = !restored;
      }
      if (restorationFailed)
        throw new Error("generated hash observation restoration failed");
    },
    300000,
  );
  it.skipIf(pure)(
    "refuses the actual old v3 master before launching inspection",
    async () => {
      const result = await evaluateTechnicalMaster({
        ...invocation,
        candidate_scope: "frozen046-negative",
      });
      await emitTypedResult(
        "refuses the actual old v3 master before launching inspection",
        "frozen046-negative",
        result,
        "not_requested_before_duration_refusal",
      );
      expect(result).toMatchObject({
        status: "refused",
        code: "duration_below_configured_minimum",
        phase: "duration",
        cleanup: "complete",
        checks: { format: "pass", duration: "fail", decode: "not_run" },
      });
      const launches = vi
        .mocked(spawn)
        .mock.calls.filter(([, args]) => args.includes("-err_detect"));
      expect(launches).toHaveLength(0);
    },
    300000,
  );
  it("rejects missing policy invalid identity and noncanonical captured values", async () => {
    for (const key of Object.keys(subject.policy)) {
      const changed = { ...subject, policy: { ...subject.policy } };
      Reflect.deleteProperty(changed.policy, key);
      expect(() => {
        checkPolicy(changed);
      }).toThrow();
    }
    for (const value of ["00", "+1", "1e2", " 1", "-0", "1.0", 1, NaN])
      expect(() => integer(value)).toThrow();
    for (const value of [
      { numerator: "2", denominator: "2" },
      { numerator: "0", denominator: "2" },
      { numerator: "1", denominator: "0" },
    ])
      expect(() => rational(value)).toThrow();
    let invoked = false;
    expect(() =>
      capture({
        get x() {
          invoked = true;
          return 1;
        },
      }),
    ).toThrow();
    expect(invoked).toBe(false);
    expect(() => capture(new Proxy({}, {}))).toThrow();
    subject.context.extra = true;
    expect(() => {
      checkPolicy(subject);
    }).toThrow();
    Reflect.deleteProperty(subject.context, "extra");
    subject.profile.control_seconds = 9;
    expect(() => {
      checkPolicy(subject);
    }).toThrow("profile_invalid");
    const originalOpen = (await vi.importActual<typeof fs>("node:fs/promises"))
      .open;
    const sourcePath = new URL("SOURCE.json", root).toString();
    const original = await fs.readFile(new URL("SOURCE.json", root));
    const duplicate = Buffer.from(
      original.toString().replace("{", '{"schema":"duplicate",'),
    );
    for (const mode of ["duplicate", "oversize"]) {
      let reads = 0;
      vi.mocked(fs.open).mockImplementation(async (...args) => {
        const file = await originalOpen(...args);
        if (args[0].toString() !== sourcePath) return file;
        const info = await file.stat();
        Reflect.defineProperty(file, "stat", {
          value: () =>
            Promise.resolve({
              dev: info.dev,
              ino: info.ino,
              uid: info.uid,
              gid: info.gid,
              mode: info.mode,
              nlink: info.nlink,
              mtimeMs: info.mtimeMs,
              ctimeMs: info.ctimeMs,
              size: mode === "oversize" ? 262145 : duplicate.length,
              isFile: () => true,
            }),
        });
        Reflect.defineProperty(file, "read", {
          value: (buffer: Buffer) => {
            reads++;
            duplicate.copy(buffer);
            return Promise.resolve({ bytesRead: duplicate.length, buffer });
          },
        });
        return file;
      });
      try {
        await expect(acquireSubject("synthetic60-positive")).rejects.toThrow(
          mode === "oversize"
            ? "source_read_failed"
            : "source_identity_invalid",
        );
        expect(reads).toBe(mode === "oversize" ? 0 : 1);
      } finally {
        vi.mocked(fs.open).mockImplementation(originalOpen);
      }
    }
  });
  it("uses exact duration bands rational targets and inclusive frame tolerances", () => {
    for (const [seconds, frames] of [
      [60, 2880000n],
      [330, 15840000n],
    ] as const) {
      subject.context.planned_runtime = {
        numerator: String(seconds),
        denominator: "1",
      };
      expect(() => {
        checkDuration(subject, frames);
      }).not.toThrow();
    }
    expect(() => {
      checkDuration(subject, 2879999n);
    }).toThrow("duration_below_configured_minimum");
    expect(() => {
      checkDuration(subject, 15840001n);
    }).toThrow("duration_above_configured_maximum");
    subject.context.planned_runtime = { numerator: "61", denominator: "1" };
    subject.policy.planned_tolerance_frames = "1";
    for (const frames of [2927999n, 2928001n])
      expect(() => {
        checkDuration(subject, frames);
      }).not.toThrow();
    for (const frames of [2927998n, 2928002n])
      expect(() => {
        checkDuration(subject, frames);
      }).toThrow("planned_duration_mismatch");
  });
  it("rejects malformed audio resource overflow and changed captures", async () => {
    const original = subject.master;
    for (const data of [
      original.subarray(0, -1),
      Buffer.concat([original, Buffer.from([0])]),
      Buffer.alloc(44),
    ]) {
      subject.master = data;
      expect(() => measureSubject(subject)).toThrow();
    }
    // Refuse the oversized descriptor shape before any byte access or enlarged allocation.
    subject.master = { length: 8388609 } as Buffer;
    expect(() => measureSubject(subject)).toThrow("audio_resource_limit");
    subject.master = original;
    const firstInput = subject.inputs[0];
    if (!firstInput) throw new Error("missing fixed input");
    subject.inputs = [firstInput, firstInput, firstInput];
    expect(() => {
      measureSubject(subject);
    }).toThrow("audio_resource_limit");

    const acquired = await acquireSubject("synthetic60-positive");
    acquired.subject.master[44] = (acquired.subject.master[44] ?? 0) ^ 1;
    await expect(acquired.recheck()).rejects.toThrow("subject_changed");
  });
  it("requires exact complete framehash and whole decoded payload identity", () => {
    const pcm = Buffer.from([1, 0, 2, 0]);
    const good = decode(pcm);
    expect(checkDecode(good.stdout, good.hash, pcm)).toMatchObject({
      bytes: "4",
      frames: "2",
    });
    const text = good.stdout.toString();
    for (const changed of [
      text.replace("#tb 0: 1/48000", "#tb 0: 1/24000"),
      text.replace("#version: 1\n", ""),
      text.replace("#hash: SHA256", "#hash: SHA256\n#hash: SHA256"),
      text.replace("0, 0, 0, 2, 4,", "1, 0, 0, 2, 4,"),
      text.replace("0, 0, 0, 2, 4,", "0, 1, 1, 2, 4,"),
      text.replace("0, 0, 0, 2, 4,", "0, 0, 0, 1, 3,"),
      text.slice(0, -1),
      text + (text.split("\n").at(-2) ?? "") + "\n",
    ])
      expect(() => checkDecode(Buffer.from(changed), good.hash, pcm)).toThrow();
    for (const changed of [
      "",
      good.hash + good.hash,
      good.hash.replace(/.$/s, ""),
      "SHA256=" + "0".repeat(64) + "\n",
    ])
      expect(() => checkDecode(good.stdout, changed, pcm)).toThrow();
    expect(() =>
      checkDecode(good.stdout, good.hash, Buffer.from([2, 0, 1, 0])),
    ).toThrow();
  });
  it("recomputes selected recipe and Assembly bindings without historical approvals", () => {
    expect(fingerprint()).toBe(gatePin);
    const selected = subject.inputs[0];
    if (!selected) throw new Error("missing fixed source");
    selected.record.render_take_id = "b6100012-0000-4000-8000-000000000099";
    expect(() => {
      checkMap(subject, 2880000n);
    }).toThrow("input_binding_invalid");
    selected.record.render_take_id = object(
      (subject.map.segments as unknown[])[0],
    ).render_take_id;
    subject.inputs.reverse();
    expect(() => {
      checkMap(subject, 2880000n);
    }).toThrow();
    subject.inputs.reverse();
    subject.gateSet = "caller-fake-Assembly";
    expect(fingerprint()).not.toBe(gatePin);
    expect(subject.lineage.every((row) => row.take_index === 0)).toBe(true);
  });
  it("binds required block order independently of map intervals", () => {
    const original = canonicalJson(subject.map);
    (subject.context.required_program_blocks as unknown[]).reverse();
    expect(() => {
      checkMap(subject, 2880000n);
    }).toThrow("block_order_mismatch");
    (subject.context.required_program_blocks as unknown[]).reverse();
    const segments = subject.map.segments as unknown[];
    object(segments[1]).end_frame = 2880001;
    expect(() => {
      checkMap(subject, 2880000n);
    }).toThrow("map_mismatch");
    subject.map = object(JSON.parse(original) as unknown);
    (subject.map.segments as unknown[]).pop();
    expect(() => {
      checkMap(subject, 2880000n);
    }).toThrow("map_mismatch");
  });
  it("parses only the complete unique final loudness summary at declared precision", () => {
    for (const [literal, expected] of [
      ["-30.0", -300n],
      ["-10.0", -100n],
    ] as const) {
      expect(parseLoudness(summary(literal))).toBe(expected);
      expect(() => {
        checkLoudness(subject.policy, expected);
      }).not.toThrow();
    }
    for (const value of [-301n, -99n])
      expect(() => {
        checkLoudness(subject.policy, value);
      }).toThrow("loudness_out_of_range");
    for (const bytes of [
      Buffer.alloc(0),
      Buffer.concat([summary(), summary()]),
      summary().subarray(0, -1),
      Buffer.from(summary().toString().replace("-20.0 LUFS", "nan LUFS")),
      Buffer.from(summary().toString().replace("Summary:", "Summary: extra")),
      Buffer.concat([summary(), Buffer.from("extra\n")]),
      Buffer.from(summary().toString().replace("-20.0 LUFS", "-20e0 LUFS")),
    ])
      expect(() => parseLoudness(bytes)).toThrow();
    expect(
      parseLoudness(
        Buffer.concat([Buffer.from("bounded prior periodic log\n"), summary()]),
      ),
    ).toBe(-200n);
  });
  it("measures half-open explained silence without joining original timeline runs", () => {
    const original = Buffer.from(subject.master);
    for (const start of [0, 10000, 2880000 - 2401]) {
      subject.master = Buffer.from(original);
      silent(start, 2400);
      expect(checkSilence(subject).frames).toBe("2400");
      silent(start, 2401);
      expect(() => checkSilence(subject)).toThrow("unexplained_silence");
    }
    subject.master = Buffer.from(original);
    silent(2880000 - 2400, 2400);
    expect(checkSilence(subject).frames).toBe("2400");
    subject.master = Buffer.from(original);
    silent(2880000 - 2401, 2401);
    expect(() => {
      checkSilence(subject);
    }).toThrow("unexplained_silence");
    subject.master = Buffer.from(original);
    silent(0, 4801);
    const intervals = [{ start_frame: "2400", end_frame: "2401" }];
    object(subject.policy.silence).explained_intervals = intervals;
    subject.context.explained_silence_intervals = intervals;
    expect(checkSilence(subject)).toMatchObject({
      frames: "2400",
      span: { start_frame: "0", end_frame: "2400" },
    });
    for (const bad of [
      [{ start_frame: "1", end_frame: "1" }],
      [{ start_frame: "2", end_frame: "1" }],
      [{ start_frame: "0", end_frame: "2880001" }],
      [...intervals, ...intervals],
      Array.from({ length: 17 }, (_, i) => ({
        start_frame: String(i * 2),
        end_frame: String(i * 2 + 1),
      })),
    ]) {
      object(subject.policy.silence).explained_intervals = bad;
      subject.context.explained_silence_intervals = bad;
      expect(() => checkSilence(subject)).toThrow();
    }
    subject.context.explained_silence_intervals = [];
    object(subject.policy.silence).explained_intervals = intervals;
    expect(() => checkSilence(subject)).toThrow("silence_policy_invalid");
  });
  it("matches independent canonical vectors and makes stale mutated identities unusable", async () => {
    const canonicalFilePins = {
      "context.json":
        "aff958362c5a40a2af7899821627521c5722cfaac902b46373eda18ed61fd9fc",
      "map.json":
        "0ac6f83cdedc43add2f0f51906901457bfa6d5c400933e3c0594b1da931cf4a9",
      "policy.json":
        "51cdf7c9377a05cd5360e81f1a8c511bc3c12505da40d0d329e8ae2755052e9c",
      "profile.json":
        "f5eaa2e3c7294030e78bfced2c5f7e983142fb95679a840930289aa5252fbfae",
      "recipe.json":
        "06a1cca7f09736cf1b58006f79a7c25381bb278d439bf62266c2b9e604ab84e2",
      "SOURCE.json":
        "af3dbc7ed4e8998f92dec9606e4922c85852d098453a4d859ef2a86b93a34706",
    };
    const formatterIgnore = (
      await fs.readFile(
        new URL("../../.prettierignore", import.meta.url),
        "utf8",
      )
    ).split(/\r?\n/u);
    expect(
      sha(await fs.readFile(new URL("SOURCE-FILE-MANIFEST.json", root))),
    ).toBe("3b2ee2b90bc7a1e1ccfc36c0cff857cce06b5134bb0f066913805af1c7241123");
    for (const [name, pin] of Object.entries(canonicalFilePins)) {
      const bytes = await fs.readFile(new URL(name, root));
      expect(sha(bytes)).toBe(pin);
      expect(bytes.toString("utf8")).toBe(
        canonicalJson(JSON.parse(bytes.toString("utf8")) as unknown) + "\n",
      );
      expect(formatterIgnore).toContain(
        "fixtures/technical-master-admission/" + name,
      );
    }
    const packet = object(
      JSON.parse(
        await fs.readFile(new URL("LITERALS-AND-VECTORS.json", root), "utf8"),
      ) as unknown,
    );
    const vectors = object(packet.vectors);
    for (const value of Object.values(vectors)) {
      const vector = object(value);
      if (typeof vector.domain === "string")
        expect(domainHash(vector.domain, vector.projection)).toBe(
          vector.sha256,
        );
    }
    const mutations = packet.mutations;
    if (!Array.isArray(mutations))
      throw new Error("missing frozen mutation inventory");
    const changes: Record<string, (candidate: Subject) => void> = {
      "block-order": (candidate) => {
        (candidate.context.required_program_blocks as unknown[]).reverse();
      },
      "selection-authority": (candidate) => {
        object(candidate.context.selection_authority).source_sha256 =
          "0".repeat(64);
      },
      "config-source": (candidate) => {
        object(candidate.context.runtime_source).source_sha256 = "1".repeat(64);
      },
      "planned-runtime": (candidate) => {
        object(candidate.context.planned_runtime).numerator = "61";
      },
      "policy-target": (candidate) => {
        object(candidate.policy.loudness).target_decilufs = "-201";
      },
      "inspection-profile": (candidate) => {
        candidate.profile.control_seconds = 9;
      },
      "selection-identity": (candidate) => {
        const first = candidate.inputs[0];
        if (!first) throw new Error("missing first source");
        first.record.take_selection_id = "b6100013-0000-4000-8000-000000000009";
      },
      "actual-master-byte-44-xor-1": (candidate) => {
        candidate.master[44] = (candidate.master[44] ?? 0) ^ 1;
      },
    };
    expect(mutations.map((value: unknown) => object(value).name)).toEqual(
      Object.keys(changes),
    );
    for (const value of mutations) {
      const mutation = object(value);
      const acquired = await acquireSubject("synthetic60-positive");
      const change = changes[String(mutation.name)];
      if (!change) throw new Error("unregistered frozen mutation");
      change(acquired.subject);
      const projection = identities(acquired.subject);
      const actualGate = domainHash(
        "technical-master-validation-input-v1",
        projection,
      );
      expect(actualGate).toBe(mutation.gate_hash);
      expect(actualGate).not.toBe(gatePin);
      expect(
        "technical-master-validation-input-v1\n" + canonicalJson(projection),
      ).toBe(mutation.gate_preimage);
      if (mutation.name === "actual-master-byte-44-xor-1") {
        expect(projection.master_audio_sha256).toBe(
          mutation.changed_master_sha256,
        );
        await expect(acquired.recheck()).rejects.toThrow("subject_changed");
      } else {
        const domain = String(mutation.canonical_preimage).split("\n")[0];
        const field =
          domain === "technical-master-context-v1"
            ? "context_digest"
            : domain === "technical-master-policy-v1"
              ? "validation_policy_sha256"
              : domain === "technical-master-measurement-profile-v1"
                ? "measurement_profile_sha256"
                : "selected_inputs_digest";
        expect(projection[field]).toBe(mutation.changed_hash);
        await expect(acquired.recheck()).rejects.toThrow("fingerprint_changed");
      }
    }
    expect(
      (await evaluateTechnicalMaster({ ...invocation, extra: true })).status,
    ).toBe("refused");
    expect(
      await evaluateTechnicalMaster({ ...invocation, policy: subject.policy }),
    ).toMatchObject({ status: "refused", authority: "none" });
  });
  it("preserves primary failure and ownership through fixed inspection faults", async () => {
    let mode = "nonzero";
    let killed = false;
    let waitReads = 0;
    let started: (() => void) | undefined;
    let reads = 0;
    let pendingStarted: (() => void) | undefined;
    let work = "";
    let removals = 0;
    const fake = (...parameters: unknown[]): ReturnType<typeof spawn> => {
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
        kill: () => {
          if (
            (mode === "preflight_pending" && args[0] === "image") ||
            (mode === "nested_pending" && args[0] === "kill")
          )
            return true;
          finish(0);
          return true;
        },
      });
      if (mode === "setup" && args[0] === "start") {
        const on = stdout.on.bind(stdout);
        stdout.on = ((
          event: string,
          listener: (...values: unknown[]) => void,
        ) => {
          if (event === "readable") throw new Error("fixed setup fault");
          return on(event, listener);
        }) as typeof stdout.on;
      }
      if (mode === "read" && args[0] === "start") {
        const read = stdout.read.bind(stdout);
        stdout.read = ((size?: number) => {
          if (size !== undefined && size > 0) {
            reads++;
            throw new Error("fixed read fault");
          }
          return read(size) as unknown;
        }) as typeof stdout.read;
      }
      queueMicrotask(() => {
        void (async () => {
          if (
            (mode === "preflight_pending" && args[0] === "image") ||
            (mode === "nested_pending" && args[0] === "kill")
          ) {
            pendingStarted?.();
            child.emit("error", new Error("fixed unreaped client"));
            return;
          }
          if (args[0] === "image") {
            const image = args.at(-1);
            if (typeof image !== "string")
              throw new Error("missing fixed inspection image");
            stdout.write(image + "\n");
          }
          if (args[0] === "create") {
            const mount = args.find(
              (value) =>
                value.startsWith("type=bind,src=") &&
                value.endsWith(",dst=/work"),
            );
            work =
              mount?.slice("type=bind,src=".length, -",dst=/work".length) ?? "";
            stdout.write("f".repeat(64) + "\n");
          }
          if (args[0] === "kill") killed = true;
          if (args[0] === "start") {
            started?.();
            if (mode === "deadline") return;
            if (mode === "read") {
              stdout.write("fixed read fault sentinel");
              return;
            }
            if (mode === "spawn") {
              child.emit("error", new Error("fixed spawn fault"));
              finish(null);
              return;
            }
            if (mode === "stream" || mode === "nested_pending") {
              stderr.emit("error", new Error("fixed stream fault"));
              return;
            }
            if (mode === "cap") {
              stderr.write(Buffer.alloc(1048577));
              return;
            }
            if (["nonzero", "cleanup"].includes(mode)) {
              finish(17);
              return;
            }
          }
          if (args[0] === "start" && mode === "shape")
            await fs.writeFile(
              work + "/decoded.sha256",
              "SHA256=" + "0".repeat(64) + "\n",
              { flag: "wx", mode: 0o600 },
            );
          if (args[0] === "rm") removals++;
          if (args[0] === "inspect")
            stdout.write(
              JSON.stringify({
                Status: "exited",
                Running: false,
                Pid: 0,
                Error: "",
                ExitCode: mode === "terminal" ? 17 : 0,
                OOMKilled: mode === "oom" && !killed,
              }),
            );
          if (args[0] === "wait") {
            waitReads++;
            stdout.write("0\n");
            if (mode === "wait" && waitReads === 1) {
              finish(1);
              return;
            }
          }
          if (args[0] === "rm" && mode === "cleanup") {
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
    };
    vi.mocked(spawn).mockImplementation(fake);
    for (mode of [
      "spawn",
      "setup",
      "stream",
      "read",
      "nonzero",
      "cap",
      "oom",
      "terminal",
      "wait",
      "deadline",
      "cleanup",
    ]) {
      killed = false;
      waitReads = 0;
      const acquired = await acquireSubject("synthetic60-positive");
      if (mode === "deadline") {
        const reached = new Promise<void>((resolve) => {
          started = resolve;
        });
        vi.useFakeTimers({
          toFake: ["setTimeout", "clearTimeout", "performance"],
        });
        const pending = inspectMaster(acquired);
        const assertion = expect(pending).rejects.toThrow("inspection_timeout");
        await reached;
        await vi.advanceTimersByTimeAsync(180001);
        await assertion;
        vi.useRealTimers();
        started = undefined;
      } else {
        const expected = ["spawn", "setup", "stream", "read"].includes(mode)
          ? "inspection_launch_failed"
          : mode === "cap"
            ? "inspection_output_limit"
            : "inspection_failed";
        await expect(inspectMaster(acquired)).rejects.toMatchObject({
          code: expected,
          cleanupPending: mode === "cleanup",
        });
      }
      if (mode === "read") expect(reads).toBeGreaterThan(0);
      expect(
        vi.mocked(spawn).mock.calls.some(([, args]) => args.includes("start")),
      ).toBe(true);
    }
    await expect(
      inspectMaster(await acquireSubject("synthetic60-positive")),
    ).rejects.toThrow("cleanup_pending");

    // Each permanent-latch regression gets a separate module realm; production has no reset.
    for (mode of ["preflight_pending", "nested_pending"]) {
      vi.resetModules();
      const evaluator = await import(
        "../../src/runtime/technical-master-admission.js"
      );
      vi.mocked(spawn).mockImplementation(fake);
      removals = 0;
      const reached = new Promise<void>((resolve) => {
        pendingStarted = resolve;
      });
      vi.useFakeTimers({
        toFake: ["setTimeout", "clearTimeout", "performance"],
      });
      const pending = evaluator.evaluateTechnicalMaster(invocation);
      await reached;
      await vi.advanceTimersByTimeAsync(10001);
      const result = await pending;
      vi.useRealTimers();
      pendingStarted = undefined;
      expect(result).toMatchObject({
        status: "refused",
        code: "inspection_launch_failed",
        phase: "inspection",
        cleanup: "pending",
        authority: "none",
      });
      expect(removals).toBe(mode === "nested_pending" ? 1 : 0);
      const launches = vi.mocked(spawn).mock.calls.length;
      expect(await evaluator.evaluateTechnicalMaster(invocation)).toMatchObject(
        { status: "refused", code: "cleanup_pending", cleanup: "pending" },
      );
      expect(vi.mocked(spawn).mock.calls.length).toBe(launches);
    }
    vi.resetModules();
    mode = "precreate";
    const precreateEvaluator = await import(
      "../../src/runtime/technical-master-admission.js"
    );
    vi.mocked(spawn).mockImplementation(fake);
    vi.mocked(crypto.randomBytes).mockImplementationOnce(() => {
      throw new Error("fixed pre-create setup failure");
    });
    const precreate =
      await precreateEvaluator.evaluateTechnicalMaster(invocation);
    expect(precreate).toMatchObject({
      status: "refused",
      code: "inspection_failed",
      cleanup: "complete",
    });
    const allocation = vi.mocked(fs.mkdtemp).mock.results.at(-1);
    if (allocation?.type !== "return")
      throw new Error("missing owned scratch allocation");
    const allocated: unknown = await allocation.value;
    if (typeof allocated !== "string")
      throw new Error("unexpected scratch path");
    await expect(fs.lstat(allocated)).rejects.toMatchObject({ code: "ENOENT" });
    mode = "nonzero";
    expect(
      await precreateEvaluator.evaluateTechnicalMaster(invocation),
    ).toMatchObject({
      status: "refused",
      code: "inspection_failed",
      cleanup: "complete",
    });

    const originalOpen = (await vi.importActual<typeof fs>("node:fs/promises"))
      .open;
    const shapes = [
      ["registration", "uid", "before"],
      ["master", "uid", "before"],
      ...[
        "dev",
        "uid",
        "gid",
        "mode",
        "nlink",
        "size",
        "mtimeMs",
        "ctimeMs",
      ].map((field) => ["master", field, "after"]),
      ["decoded", "uid", "before"],
      ["decoded", "mode", "before"],
      ["decoded", "nlink", "before"],
      ["decoded", "size", "before"],
      ["decoded", "regular", "before"],
      ["decoded", "read", "after"],
      ...[
        "dev",
        "uid",
        "gid",
        "mode",
        "nlink",
        "size",
        "mtimeMs",
        "ctimeMs",
      ].map((field) => ["decoded", field, "after"]),
    ];
    for (const [target, field, when] of shapes) {
      vi.resetModules();
      const evaluator = await import(
        "../../src/runtime/technical-master-admission.js"
      );
      vi.mocked(spawn).mockImplementation(fake);
      mode = "shape";
      let faults = 0;
      vi.mocked(fs.open).mockImplementation(async (...args) => {
        const file = await originalOpen(...args);
        const path = args[0].toString();
        const decoded =
          path.includes("the-desk-mva-") && path.endsWith("/decoded.sha256");
        const matched =
          target === "decoded"
            ? decoded
            : target === "registration"
              ? path === "/tmp/the-desk-fixture046-runtime/receipt.json"
              : path.includes("the-desk-mva-") && path.endsWith("/master.wav");
        if (!matched && !decoded) return file;
        const stat = file.stat.bind(file);
        let observations = 0;
        Reflect.defineProperty(file, "stat", {
          value: async () => {
            const info = await stat();
            const reported = {
              dev: info.dev,
              ino: info.ino,
              nlink: info.nlink,
              size: info.size,
              mtimeMs: info.mtimeMs,
              ctimeMs: info.ctimeMs,
              uid: decoded ? 0 : info.uid,
              gid: info.gid,
              mode: info.mode,
              isFile: () => true,
            };
            observations++;
            if (
              matched &&
              field !== "read" &&
              observations === (when === "before" ? 1 : 2)
            ) {
              if (field === "regular") {
                reported.isFile = () => false;
                faults++;
                return reported;
              }
              if (field === "mode" && when === "before") {
                reported.mode |= 0o022;
                faults++;
                return reported;
              }
              if (!field) throw new Error("missing fixed shape field");
              const value = Reflect.get(reported, field) as unknown;
              if (typeof value !== "number")
                throw new Error("invalid stat fixture");
              Reflect.set(reported, field, value + 1);
              faults++;
            }
            return reported;
          },
        });
        if (matched && field === "read") {
          const read = file.read.bind(file);
          Reflect.defineProperty(file, "read", {
            value: async function (this: unknown, ...readArgs: unknown[]) {
              const result: unknown = await Reflect.apply(read, this, readArgs);
              Reflect.set(result as object, "bytesRead", 71);
              faults++;
              return result;
            },
          });
        }
        return file;
      });
      try {
        const result = await evaluator.evaluateTechnicalMaster(invocation);
        expect(result).toMatchObject({
          status: "refused",
          cleanup: "complete",
          code:
            target === "registration"
              ? "executable_identity_invalid"
              : target === "master"
                ? "subject_changed"
                : "decode_output_invalid",
        });
        expect(faults).toBe(1);
      } finally {
        vi.mocked(fs.open).mockImplementation(originalOpen);
      }
    }
    // Stable namespace-local identifiers are observations, not root authentication.
    for (const visibleUid of [0, 65534]) {
      vi.resetModules();
      const driver = await import(
        "../../src/runtime/technical-master-inspection.js"
      );
      const acquisition = await import(
        "../../src/runtime/technical-master-acquisition.js"
      );
      vi.mocked(spawn).mockImplementation(fake);
      mode = "shape";
      let statCount = 0;
      vi.mocked(fs.open).mockImplementation(async (...args) => {
        const file = await originalOpen(...args);
        const path = args[0].toString();
        if (
          !path.includes("the-desk-mva-") ||
          !path.endsWith("/decoded.sha256")
        )
          return file;
        const stat = file.stat.bind(file);
        Reflect.defineProperty(file, "stat", {
          value: async () => {
            const info = await stat();
            info.uid = visibleUid;
            info.gid = visibleUid;
            statCount++;
            return info;
          },
        });
        return file;
      });
      try {
        const result = await driver.inspectMaster(
          await acquisition.acquireSubject("synthetic60-positive"),
        );
        expect(result.hashFile).toBe("SHA256=" + "0".repeat(64) + "\n");
        expect(statCount).toBe(2);
      } finally {
        vi.mocked(fs.open).mockImplementation(originalOpen);
      }
    }
    const originalLstat = (await vi.importActual<typeof fs>("node:fs/promises"))
      .lstat;
    for (const target of ["root", "work"])
      for (const field of ["ino", "mode"]) {
        vi.resetModules();
        const evaluator = await import(
          "../../src/runtime/technical-master-admission.js"
        );
        vi.mocked(spawn).mockImplementation(fake);
        mode = "shape";
        removals = 0;
        let faults = 0;
        const lstatSpy = vi
          .spyOn(fs, "lstat")
          .mockImplementation(async (...args) => {
            const info = await originalLstat(...args);
            const targetPath =
              target === "work" ? work : work.slice(0, -"/work".length);
            if (removals > 0 && args[0].toString() === targetPath) {
              if (typeof info.ino !== "number" || typeof info.mode !== "number")
                throw new Error(
                  "fixed directory control requires numeric stat",
                );
              if (field === "ino") info.ino += 1;
              else info.mode |= 0o077;
              faults++;
            }
            return info;
          });
        try {
          const result = await evaluator.evaluateTechnicalMaster(invocation);
          expect(result).toMatchObject({
            status: "refused",
            code: "decode_output_invalid",
            cleanup: "complete",
          });
          expect(faults).toBe(1);
        } finally {
          lstatSpy.mockRestore();
        }
      }
    expect(
      vi
        .mocked(spawn)
        .mock.calls.every(
          ([command]) =>
            typeof command === "string" && command.endsWith("docker"),
        ),
    ).toBe(true);
  }, 120000);
});
