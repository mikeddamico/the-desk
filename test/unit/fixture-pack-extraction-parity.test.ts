// Independent primary DATA and literal original extraction precede subject import.
// ROOT126C +126E +F1 / ROOT126G; Mike's exact mechanism approval: 2026-10-17 17:21:17 EDT.
import { afterEach, describe, expect, it, vi } from "vitest";
import { runP33 } from "../support/p33-parity-runner.js";
import { Buffer } from "node:buffer";
import * as child from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { FIXTURE_V046_PINS } from "../../src/fixture/pins.js";
import type { FixturePins } from "../../src/fixture/pins.js";
import type { PackSource } from "../../src/fixture/pack.js";

const N = 832024;
const H = "7e1bb1108cdd84e47269b9ab2dab20ba934fcec64d44262f86d2b505616b0747";
const MH = "58a3c5e6188a91eba380c4cb4c08fbebb747513b5979ca9b3b0baab61d5b84fe";
const INVENTORY = "ARTIFACT_INVENTORY.json";
const ZIP = fileURLToPath(
  new URL(
    "../../Lock/04_IMPLEMENTATION/The_Desk_Walking_Skeleton_Fixture_v0.4.6.zip",
    import.meta.url,
  ),
);
const SUBJECT = "../../src/fixture/pack.js";
const sha = (bytes: Uint8Array): string =>
  crypto.createHash("sha256").update(bytes).digest("hex");
const apply = Reflect.apply;
const own = Object.getOwnPropertyDescriptor;
const define = Object.defineProperty;
type NativeMethod = (this: unknown, ...args: unknown[]) => unknown;
function method(target: object, key: string): NativeMethod {
  const descriptor = own(target, key);
  if (
    !descriptor ||
    !("value" in descriptor) ||
    typeof descriptor.value !== "function"
  )
    throw Error("original native method DATA missing");
  return descriptor.value as NativeMethod;
}
const bufferPrototype = Buffer.prototype as Buffer;
const typed = Object.getPrototypeOf(Uint8Array.prototype) as object;
const nativeAlloc = method(Buffer, "alloc");
const nativeSet = method(typed, "set");
const native16 = method(bufferPrototype, "readUInt16LE");
const native32 = method(bufferPrototype, "readUInt32LE");
const backingGetter = (own(typed, "buffer") as { get?: unknown } | undefined)
  ?.get;
function backing(bytes: object): unknown {
  if (typeof backingGetter !== "function")
    throw Error("original typed-array backing getter unavailable");
  return apply(backingGetter, bytes, []) as unknown;
}

class OriginalFixtureIntegrityError extends Error {
  readonly code: string;
  constructor(code: string, detail = "") {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "FixtureIntegrityError";
    this.code = code;
  }
}
// Literal original per-member algorithm, independently bound to original reader
// 7268 /3e14621f888f2d10e5618833fa93d34e2685c64c1298ca070d0bcc550a52a793.
function originalRead(path: string, name: string, maxBytes: number): Buffer {
  if (
    !/^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(name) ||
    name.split("/").includes("..")
  )
    throw new OriginalFixtureIntegrityError("unsafe_member_name", name);
  try {
    return child.execFileSync("unzip", ["-p", path, name], {
      maxBuffer: maxBytes + 1,
    });
  } catch (error) {
    throw new OriginalFixtureIntegrityError(
      "member_read_failed",
      `${name}: ${(error as Error).message.slice(0, 120)}`,
    );
  }
}
interface Declared {
  path: string;
  bytes: number;
  sha256: string;
  role: string;
}
interface Manifest {
  pack_format: string;
  active_load: string;
  archival_roles_never_loaded: string[];
  member_count_excluding_this_file: number;
  members: Declared[];
}
interface Golden {
  name: string;
  bytes: Buffer;
  sha256: string;
}
const PRIMARY = fs.readFileSync(ZIP);
expect(PRIMARY.length).toBe(N);
expect(sha(PRIMARY)).toBe(H);
const MANIFEST_BYTES = originalRead(ZIP, "PACK_MEMBERS.json", 4194304);
expect(MANIFEST_BYTES.length).toBe(54308);
expect(sha(MANIFEST_BYTES)).toBe(MH);
const MANIFEST = JSON.parse(MANIFEST_BYTES.toString("utf8")) as Manifest;
expect(MANIFEST.members).toHaveLength(133);
expect(MANIFEST.member_count_excluding_this_file).toBe(133);
const GOLDENS: Golden[] = [
  { name: "PACK_MEMBERS.json", bytes: MANIFEST_BYTES, sha256: MH },
];
for (const row of MANIFEST.members) {
  const bytes = originalRead(ZIP, row.path, row.bytes);
  expect(bytes.length).toBe(row.bytes);
  expect(sha(bytes)).toBe(row.sha256);
  GOLDENS.push({ name: row.path, bytes, sha256: row.sha256 });
}
expect(new Set(GOLDENS.map((g) => g.name)).size).toBe(134);
expect(MANIFEST.members[0]).toEqual({
  path: INVENTORY,
  bytes: 16352,
  mode: "0644",
  purpose:
    "member/artifact inventory of the active load (36 artifacts -> member, container locator, path class)",
  referenced_by: [],
  sha256: "7267b1018512f490ef132868a826bc4552af9795fd7d268c67982ac83f824dd7",
  role: "inventory",
});
expect(MANIFEST.members[1]).toEqual({
  path: "README.md",
  bytes: 12497,
  mode: "0644",
  purpose: "candidate README (no checksum of any member or of the ZIP)",
  referenced_by: [],
  sha256: "7866f6954c05d4bc03a08c59d2acdb39a657861cca777444d80946550e1a99f8",
  role: "readme",
});
function golden(name = INVENTORY): Golden {
  const value = GOLDENS.find((g) => g.name === name);
  if (!value) throw Error("independent golden name missing");
  return value;
}

const directories: string[] = [];
function owned(bytes: Buffer = PRIMARY): string {
  const directory = fs.mkdtempSync(join(tmpdir(), "desk-extraction-parity-"));
  directories.push(directory);
  const path = join(directory, "fixture.zip");
  fs.writeFileSync(path, bytes, { flag: "wx" });
  return path;
}
const restorers: (() => void)[] = [];
const realFds = new Set<number>();
function patchMethod(target: object, key: string, value: unknown): void {
  const descriptor = own(target, key);
  if (!descriptor || !("value" in descriptor))
    throw Error("original method DATA descriptor missing");
  define(target, key, { ...descriptor, value });
  restorers.push(() => define(target, key, descriptor));
}
function exportsWith(actual: object, changes: Record<string, unknown>): object {
  const descriptors: PropertyDescriptorMap =
    Object.getOwnPropertyDescriptors(actual);
  for (const [key, value] of Object.entries(changes)) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor))
      throw Error("actual module export missing");
    descriptors[key] = { ...descriptor, value };
  }
  return Object.create(
    Object.getPrototypeOf(actual) as object | null,
    descriptors,
  ) as object;
}
interface Reads {
  offset: number;
  request: number;
  position: number;
  delegated: number;
  count: unknown;
}
interface Trace {
  a: number;
  o: number;
  c: number;
  l: number;
  z: number;
  allocations: number;
  copies: number;
  crc: number;
  hashes: number;
  originalInflates: number;
  originalCrc: number;
  fieldHits: number;
  events: string[];
  reads: Reads[];
  capture: Buffer | undefined;
  normalized: Buffer | undefined;
  decoded: unknown;
  crcInput: unknown;
}
interface Controls {
  flags?: (value: typeof fs.constants) => object;
  lstat?: (value: fs.Stats) => unknown;
  fstat?: (value: fs.Stats) => unknown;
  afterFstat?: () => void;
  open?: () => unknown;
  fdZero?: boolean;
  read?: (value: number, ordinal: number) => unknown;
  short?: boolean;
  close?: () => unknown;
  afterClose?: () => void;
  digest?: (value: string) => unknown;
  field?: { width: 2 | 4; offset: number; result: () => unknown };
  inflateBefore?: () => unknown;
  inflateAfter?: (value: Buffer, trace: Trace) => unknown;
  allocation?: (value: Buffer, trace: Trace) => unknown;
  copy?: (value: unknown) => unknown;
  afterCopy?: (value: Buffer) => void;
  span?: boolean;
  crc?: (value: number, trace: Trace) => unknown;
  legacy?: () => unknown;
  publicPin?: boolean;
  sentinel?: boolean;
}
async function subject(controls: Controls = {}): Promise<{
  module: typeof import("../../src/fixture/pack.js");
  trace: Trace;
}> {
  let normalizationWindow = false;
  const trace: Trace = {
    a: 0,
    o: 0,
    c: 0,
    l: 0,
    z: 0,
    allocations: 0,
    copies: 0,
    crc: 0,
    hashes: 0,
    originalInflates: 0,
    originalCrc: 0,
    fieldHits: 0,
    events: [],
    reads: [],
    capture: undefined,
    normalized: undefined,
    decoded: undefined,
    crcInput: undefined,
  };
  patchMethod(Buffer, "alloc", function (...args: unknown[]): unknown {
    const result: unknown = apply(nativeAlloc, Buffer, args);
    if (args[0] === N + 1 && trace.o > trace.c && Buffer.isBuffer(result)) {
      trace.capture = result;
      if (controls.sentinel) result[N] = 0xa5;
    }
    if (normalizationWindow && args[0] !== N + 1 && Buffer.isBuffer(result)) {
      trace.allocations++;
      trace.events.push("allocate");
      const replacement = controls.allocation
        ? controls.allocation(result, trace)
        : result;
      if (Buffer.isBuffer(replacement)) trace.normalized = replacement;
      return replacement;
    }
    return result;
  });
  patchMethod(
    typed,
    "set",
    function (this: unknown, ...args: unknown[]): unknown {
      const selected =
        this === trace.normalized && trace.normalized !== undefined;
      if (selected) {
        trace.copies++;
        trace.events.push("copy");
      }
      const value: unknown = apply(nativeSet, this, args);
      if (selected && trace.normalized) controls.afterCopy?.(trace.normalized);
      return selected && controls.copy ? controls.copy(value) : value;
    },
  );
  if (controls.span) {
    const original = method(bufferPrototype, "subarray");
    patchMethod(
      bufferPrototype,
      "subarray",
      function (this: Buffer, ...args: unknown[]): unknown {
        if (
          trace.hashes === 1 &&
          trace.z === 0 &&
          trace.capture &&
          backing(this) === backing(trace.capture)
        ) {
          trace.fieldHits++;
          throw Error("reached private span control");
        }
        return apply(original, this, args);
      },
    );
  }
  for (const width of [2, 4] as const) {
    const key = width === 2 ? "readUInt16LE" : "readUInt32LE";
    const original = width === 2 ? native16 : native32;
    patchMethod(
      bufferPrototype,
      key,
      function (this: unknown, ...args: unknown[]): unknown {
        const value: unknown = apply(original, this, args);
        if (
          controls.field &&
          trace.hashes === 1 &&
          trace.z === 0 &&
          trace.capture &&
          backing(this as object) === backing(trace.capture) &&
          controls.field.width === width &&
          args[0] === controls.field.offset
        ) {
          trace.fieldHits++;
          return controls.field.result();
        }
        return value;
      },
    );
  }
  vi.doMock("node:fs", async () => {
    const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
    return exportsWith(actual, {
      constants: controls.flags
        ? controls.flags(actual.constants)
        : actual.constants,
      lstatSync(...args: unknown[]): unknown {
        const value = apply(actual.lstatSync, actual, args) as fs.Stats;
        return controls.lstat ? controls.lstat(value) : value;
      },
      openSync(...args: unknown[]): unknown {
        trace.a++;
        trace.events.push("open");
        const value: unknown = controls.fdZero
          ? 0
          : controls.open
            ? controls.open()
            : apply(actual.openSync, actual, args);
        if (
          typeof value === "number" &&
          Number.isSafeInteger(value) &&
          value >= 0 &&
          value <= 0x7fffffff
        ) {
          trace.o++;
          if (!controls.fdZero && !controls.open) realFds.add(value);
        }
        return value;
      },
      fstatSync(...args: unknown[]): unknown {
        trace.events.push("fstat");
        const value = controls.fdZero
          ? actual.lstatSync(ZIP)
          : (apply(actual.fstatSync, actual, args) as fs.Stats);
        controls.afterFstat?.();
        return controls.fstat ? controls.fstat(value) : value;
      },
      readSync(
        fd: number,
        buffer: Buffer,
        offset: number,
        request: number,
        position: number,
      ): unknown {
        const ordinal = trace.reads.length;
        const delegated =
          controls.short && ordinal < 3
            ? Math.min(request, [1, 7, 31][ordinal] ?? request)
            : request;
        let count: number;
        if (controls.fdZero) {
          count = Math.max(0, Math.min(delegated, N - position));
          apply(nativeSet, buffer, [
            PRIMARY.subarray(position, position + count),
            offset,
          ]);
        } else count = actual.readSync(fd, buffer, offset, delegated, position);
        const entry: Reads = { offset, request, position, delegated, count };
        trace.reads.push(entry);
        trace.events.push("read");
        const value = controls.read ? controls.read(count, ordinal) : count;
        entry.count = value;
        return value;
      },
      closeSync(fd: number): unknown {
        trace.c++;
        trace.events.push("close");
        if (!controls.fdZero) {
          actual.closeSync(fd);
          realFds.delete(fd);
        }
        controls.afterClose?.();
        return controls.close ? controls.close() : undefined;
      },
    });
  });
  vi.doMock("node:crypto", async () => {
    const actual =
      await vi.importActual<typeof import("node:crypto")>("node:crypto");
    return exportsWith(actual, {
      createHash(...args: unknown[]): unknown {
        const hash = apply(actual.createHash, actual, args) as crypto.Hash;
        const update = hash.update.bind(hash);
        const digest = hash.digest.bind(hash);
        let selected = false;
        define(hash, "update", {
          configurable: true,
          value(...values: unknown[]): unknown {
            const bytes = values[0];
            if (
              Buffer.isBuffer(bytes) &&
              bytes.length === N &&
              trace.capture &&
              backing(bytes) === backing(trace.capture)
            ) {
              selected = true;
              trace.hashes++;
              trace.events.push("hash");
            }
            return apply(update, hash, values) as unknown;
          },
        });
        define(hash, "digest", {
          configurable: true,
          value(...values: unknown[]): unknown {
            const result: unknown = apply(digest, hash, values);
            return selected && controls.digest
              ? controls.digest(result as string)
              : result;
          },
        });
        return hash;
      },
    });
  });
  vi.doMock("node:zlib", async () => {
    const actual =
      await vi.importActual<typeof import("node:zlib")>("node:zlib");
    return exportsWith(actual, {
      inflateRawSync(...args: unknown[]): unknown {
        normalizationWindow = false;
        trace.normalized = undefined;
        trace.z++;
        trace.events.push("inflate");
        if (controls.inflateBefore) return controls.inflateBefore();
        trace.originalInflates++;
        const result = apply(actual.inflateRawSync, actual, args) as Buffer;
        trace.decoded = result;
        const returned = controls.inflateAfter
          ? controls.inflateAfter(result, trace)
          : result;
        normalizationWindow = true;
        return returned;
      },
      crc32(...args: unknown[]): unknown {
        normalizationWindow = false;
        trace.crc++;
        trace.events.push("crc");
        trace.crcInput = args[0];
        trace.originalCrc++;
        const value = apply(actual.crc32, actual, args) as number;
        return controls.crc ? controls.crc(value, trace) : value;
      },
    });
  });
  vi.doMock("node:child_process", async () => {
    const actual =
      await vi.importActual<typeof import("node:child_process")>(
        "node:child_process",
      );
    return exportsWith(actual, {
      execFileSync(...args: unknown[]): unknown {
        if (
          args[0] === "unzip" &&
          Array.isArray(args[1]) &&
          args[1][0] === "-p"
        ) {
          normalizationWindow = false;
          trace.l++;
          trace.events.push("legacy");
          if (controls.legacy) return controls.legacy();
        }
        return apply(actual.execFileSync, actual, args) as unknown;
      },
    });
  });
  if (controls.publicPin)
    vi.doMock("../../src/fixture/pins.js", async () => {
      const actual = await vi.importActual<
        typeof import("../../src/fixture/pins.js")
      >("../../src/fixture/pins.js");
      const originalZip = actual.FIXTURE_V046_PINS.zipSha256;
      actual.FIXTURE_V046_PINS.zipSha256 = "0".repeat(64);
      trace.events.push(
        "public_pin:" + originalZip + "=>" + actual.FIXTURE_V046_PINS.zipSha256,
      );
      restorers.push(() => {
        actual.FIXTURE_V046_PINS.zipSha256 = originalZip;
      });
      return actual;
    });
  const module = (await import(
    SUBJECT
  )) as typeof import("../../src/fixture/pack.js");
  return { module, trace };
}
const profiles = {
  N: [0, 0, 0, 0, 0],
  L: [0, 0, 0, 1, 0],
  O: [1, 0, 0, 1, 0],
  C: [1, 1, 1, 1, 0],
  Z: [1, 1, 1, 1, 1],
  F: [1, 1, 1, 0, 1],
} as const;
function counts(
  trace: Trace,
  profile: keyof typeof profiles,
  stages: readonly number[] = profile === "F" ? [1, 1, 1] : [0, 0, 0],
): void {
  expect([trace.a, trace.o, trace.c, trace.l, trace.z]).toEqual(
    profiles[profile],
  );
  expect([trace.allocations, trace.copies, trace.crc]).toEqual(stages);
  if (trace.c && trace.l)
    expect(trace.events.indexOf("close")).toBeLessThan(
      trace.events.indexOf("legacy"),
    );
  if (trace.hashes)
    expect(trace.events.indexOf("close")).toBeLessThan(
      trace.events.indexOf("hash"),
    );
}
function exact(bytes: Buffer, g = golden()): void {
  expect(Buffer.isBuffer(bytes)).toBe(true);
  expect(Object.getPrototypeOf(bytes)).toBe(bufferPrototype);
  expect(Buffer.compare(bytes, g.bytes)).toBe(0);
  expect(bytes.length).toBe(g.bytes.length);
  expect(sha(bytes)).toBe(g.sha256);
}
function snapshot(action: () => Buffer): unknown {
  try {
    return { bytes: action() };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return {
      name: error.name,
      message: error.message,
      code: (error as Error & { code?: string }).code,
    };
  }
}
function dataStat(
  stats: fs.Stats,
  key: "mode" | "size",
  value: unknown,
): fs.Stats {
  const copy = Object.create(
    Object.getPrototypeOf(stats) as object,
    Object.getOwnPropertyDescriptors(stats),
  ) as fs.Stats;
  define(copy, key, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
  return copy;
}
afterEach(() => {
  const leaked = realFds.size;
  for (const fd of realFds) fs.closeSync(fd);
  realFds.clear();
  while (restorers.length) restorers.pop()?.();
  vi.resetAllMocks();
  vi.restoreAllMocks();
  for (const path of [
    "node:fs",
    "node:crypto",
    "node:zlib",
    "node:child_process",
    "../../src/fixture/pins.js",
  ])
    vi.doUnmock(path);
  vi.resetModules();
  for (const directory of directories.splice(0))
    fs.rmSync(directory, { recursive: true });
  expect(leaked).toBe(0);
});

describe("P01 all 134 independent primary members", () => {
  for (const g of GOLDENS)
    it(g.name, async () => {
      const s = await subject();
      const bytes = s.module.unzipSource(ZIP).read(g.name, g.bytes.length);
      exact(bytes, g);
      counts(s.trace, "F");
      expect(s.trace.originalInflates).toBe(1);
      expect(s.trace.originalCrc).toBe(1);
      expect(s.trace.crcInput).toBe(s.trace.normalized);
      expect(s.trace.events.indexOf("copy")).toBeLessThan(
        s.trace.events.indexOf("crc"),
      );
      expect(backing(bytes)).not.toBe(
        backing(s.trace.capture ?? Buffer.alloc(0)),
      );
      expect(bytes).not.toBe(g.bytes);
      expect(s.trace.reads.at(-1)).toEqual({
        offset: N,
        request: 1,
        position: N,
        delegated: 1,
        count: 0,
      });
    });
});

// Independent alternate-wire DATA; never generated from candidate output.
interface WireEntry {
  name: Buffer;
  method: number;
  flags: number;
  crc: number;
  compressed: Buffer;
  size: number;
  descriptor?: boolean;
  zip64?: boolean;
}
function wire(entries: WireEntry[], disk = 0): Buffer {
  const locals: Buffer[] = [],
    centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const extra = entry.zip64
      ? Buffer.from("0100100000000000000000000000000000000000", "hex")
      : Buffer.alloc(0);
    const local = Buffer.alloc(30 + entry.name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(entry.flags, 6);
    local.writeUInt16LE(entry.method, 8);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(entry.crc, 14);
    local.writeUInt32LE(entry.compressed.length, 18);
    local.writeUInt32LE(entry.size, 22);
    local.writeUInt16LE(entry.name.length, 26);
    entry.name.copy(local, 30);
    const central = Buffer.alloc(46 + entry.name.length + extra.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(entry.flags, 8);
    central.writeUInt16LE(entry.method, 10);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(entry.crc, 16);
    central.writeUInt32LE(
      entry.zip64 ? 0xffffffff : entry.compressed.length,
      20,
    );
    central.writeUInt32LE(entry.zip64 ? 0xffffffff : entry.size, 24);
    central.writeUInt16LE(entry.name.length, 28);
    central.writeUInt16LE(extra.length, 30);
    central.writeUInt16LE(disk, 34);
    central.writeUInt32LE(offset, 42);
    entry.name.copy(central, 46);
    extra.copy(central, 46 + entry.name.length);
    const descriptor = entry.descriptor ? Buffer.alloc(12) : Buffer.alloc(0);
    if (entry.descriptor) {
      descriptor.writeUInt32LE(entry.crc, 0);
      descriptor.writeUInt32LE(entry.compressed.length, 4);
      descriptor.writeUInt32LE(entry.size, 8);
    }
    locals.push(local, entry.compressed, descriptor);
    centrals.push(central);
    offset += local.length + entry.compressed.length + descriptor.length;
  }
  const directory = Buffer.concat(centrals),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(disk, 4);
  end.writeUInt16LE(disk, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
const STORED: WireEntry = {
  name: Buffer.from("a.txt"),
  method: 0,
  flags: 0,
  crc: 0,
  compressed: Buffer.alloc(0),
  size: 0,
};
const S = wire([STORED]);
expect(S.length).toBe(108);
const DEFLATED: WireEntry = {
  name: Buffer.from("foundation_rows_398.json"),
  method: 8,
  flags: 0,
  crc: 0x14b50923,
  compressed: Buffer.from(PRIMARY.subarray(462057, 518717)),
  size: 471514,
};
const D = wire([DEFLATED]);
expect(D.length).toBe(56806);
const DUPLICATE = wire([STORED, STORED]);
expect(DUPLICATE.length).toBe(194);
const UNICODE = wire([{ ...STORED, name: Buffer.from("é.txt"), flags: 0x800 }]);
const DESCRIPTOR = wire([{ ...STORED, flags: 8, descriptor: true }]);
const MULTIDISK = wire([STORED], 1),
  ZIP64 = wire([{ ...STORED, zip64: true }]);
const ENCRYPTED_CONTROL = wire([{ ...STORED, flags: 1 }]);
const CORRUPT_D = Buffer.from(D);
CORRUPT_D[54] = (CORRUPT_D[54] ?? 0) ^ 1;
const BAD_CRC_D = Buffer.from(D);
BAD_CRC_D.writeUInt32LE(0x14b50922, 56714 + 16);
const XOR_PRIMARY = Buffer.from(PRIMARY);
XOR_PRIMARY[0] = (XOR_PRIMARY[0] ?? 0) ^ 1;
const box = (value: number): unknown => Reflect.construct(Number, [value]);
const INV = golden(),
  SOURCE = golden("foundation_rows_398.json");
const TARGET_LOCAL = PRIMARY.indexOf(Buffer.from(INVENTORY)) - 30;
expect(TARGET_LOCAL).toBeGreaterThanOrEqual(0);
expect(PRIMARY.readUInt32LE(TARGET_LOCAL)).toBe(0x04034b50);

interface ReadVector {
  id: string;
  controls?: (path: string) => Controls;
  bytes?: Buffer;
  name?: string;
  max?: unknown;
  profile: keyof typeof profiles;
  stages?: readonly number[];
  check?: (trace: Trace) => void;
}
function readVector(vector: ReadVector): void {
  it(vector.id, async () => {
    if (vector.id === "P33 multidisk") {
      await runP33();
      return;
    }
    const path = owned(vector.bytes),
      name = vector.name ?? INVENTORY;
    const maximum = (
      vector.max === undefined
        ? (GOLDENS.find((g) => g.name === name) ?? INV).bytes.length
        : vector.max
    ) as number;
    const s = await subject(vector.controls?.(path) ?? {});
    const actual = snapshot(() =>
      s.module.unzipSource(path).read(name, maximum),
    );
    // The baseline observes the same then-current path after deliberate mutations.
    const expected = snapshot(() => originalRead(path, name, maximum));
    expect(actual).toEqual(expected);
    counts(s.trace, vector.profile, vector.stages);
    vector.check?.(s.trace);
  });
}
describe("P02 sentinel for all independent members", () => {
  for (const g of GOLDENS)
    if (g.bytes.length > 0)
      readVector({
        id: g.name,
        name: g.name,
        max: g.bytes.length - 1,
        profile: "F",
      });
});
describe("P03-P09 bounds, name-first and private identity", () => {
  readVector({
    id: "P03 below sentinel",
    name: SOURCE.name,
    max: SOURCE.bytes.length - 2,
    profile: "C",
  });
  readVector({ id: "P03 real repair", name: SOURCE.name, profile: "F" });
  readVector({
    id: "P04 stored empty",
    bytes: S,
    name: "a.txt",
    max: 0,
    profile: "L",
  });
  for (const [index, max] of [
    -1,
    0.5,
    NaN,
    Infinity,
    67108865,
    "1",
    box(0),
  ].entries())
    readVector({ id: "P05 invalid bound " + String(index), max, profile: "L" });
  readVector({ id: "P05 bound repair", profile: "F" });
  const blocked = (): never => {
    throw Error("blocked probe");
  };
  readVector({
    id: "P06 unsafe first",
    name: "../x",
    max: -1,
    controls: () => ({ lstat: blocked }),
    profile: "N",
  });
  readVector({
    id: "P06 repaired name",
    max: -1,
    controls: () => ({ lstat: blocked }),
    profile: "L",
  });
  readVector({
    id: "P06 repaired bound, still blocked",
    max: 16352,
    controls: () => ({ lstat: blocked }),
    profile: "L",
  });
  readVector({ id: "P06 real probe repair", max: 16352, profile: "F" });
  readVector({ id: "P07 missing member", name: "missing.txt", profile: "C" });
  readVector({ id: "P07 name repair", profile: "F" });
  readVector({
    id: "P08 exported pin override",
    controls: () => ({ publicPin: true }),
    profile: "F",
    check: (trace) => {
      expect(
        trace.events.filter((event) => event.startsWith("public_pin:")),
      ).toEqual(["public_pin:" + H + "=>" + "0".repeat(64)]);
    },
  });
  readVector({ id: "P08 export repair", profile: "F" });
  it("P09 caller pin refusal before listing then real full repair", async () => {
    const s = await subject();
    let listings = 0;
    const source = s.module.unzipSource(ZIP);
    const wrapped: PackSource = {
      ...source,
      listing() {
        listings++;
        return source.listing();
      },
    };
    expect(() =>
      s.module.openPack(wrapped, {
        ...FIXTURE_V046_PINS,
        zipSha256: "0".repeat(64),
      }),
    ).toThrow("zip_sha256_mismatch");
    expect(listings).toBe(0);
    counts(s.trace, "N");
    const pack = s.module.openPack(wrapped, FIXTURE_V046_PINS);
    expect(listings).toBe(1);
    expect(pack.memberNames).toHaveLength(133);
    expect([s.trace.a, s.trace.o, s.trace.c, s.trace.l, s.trace.z]).toEqual([
      134, 134, 134, 0, 134,
    ]);
    expect([s.trace.allocations, s.trace.copies, s.trace.crc]).toEqual([
      134, 134, 134,
    ]);
    expect(pack.member(SOURCE.name)).toEqual(SOURCE.bytes);
    expect(() => pack.member("missing.txt")).toThrow("unknown_member");
    for (const member of MANIFEST.members.filter((m) =>
      MANIFEST.archival_roles_never_loaded.includes(m.role),
    ))
      expect(() => pack.member(member.path)).toThrow(
        "archival_member_not_loadable",
      );
  });
});
describe("P10-P17 capture protocol", () => {
  for (const key of ["O_RDONLY", "O_NOFOLLOW", "O_NONBLOCK"]) {
    for (const [label, value] of [
      ["missing", undefined],
      ["string", "0"],
      ["negative", -1],
      ["fractional", 0.5],
    ] as const)
      readVector({
        id: "P10 " + key + " " + label,
        controls: () => ({
          flags: (actual) => {
            const descriptors = Object.getOwnPropertyDescriptors(actual);
            if (label === "missing") Reflect.deleteProperty(descriptors, key);
            else descriptors[key] = { configurable: true, value };
            return Object.create(null, descriptors) as object;
          },
        }),
        profile: "L",
      });
    let getters = 0;
    readVector({
      id: "P10 " + key + " accessor",
      controls: () => ({
        flags: (actual) => {
          const descriptors = Object.getOwnPropertyDescriptors(actual);
          descriptors[key] = {
            configurable: true,
            get() {
              getters++;
              throw Error("flag getter");
            },
          };
          return Object.create(null, descriptors) as object;
        },
      }),
      profile: "L",
      check: () => {
        expect(getters).toBe(0);
      },
    });
  }
  readVector({
    id: "P10 actual flags including O_RDONLY zero repair",
    profile: "F",
  });
  for (const [label, control] of [
    [
      "throw",
      () => {
        throw Error("lstat");
      },
    ],
    ["nonregular", (stats: fs.Stats) => dataStat(stats, "mode", 0x4000)],
    ["size-minus", (stats: fs.Stats) => dataStat(stats, "size", N - 1)],
    ["size-plus", (stats: fs.Stats) => dataStat(stats, "size", N + 1)],
  ] as const)
    readVector({
      id: "P11 " + label,
      controls: () => ({ lstat: control }),
      profile: "L",
    });
  readVector({ id: "P11 real repair", profile: "F" });
  for (const [index, value] of [
    -1,
    2147483648,
    0.5,
    NaN,
    "0",
    box(0),
  ].entries())
    readVector({
      id: "P12 invalid fd " + String(index),
      controls: () => ({ open: () => value }),
      profile: "O",
    });
  readVector({
    id: "P12 open throw",
    controls: () => ({
      open: () => {
        throw Error("open");
      },
    }),
    profile: "O",
  });
  readVector({ id: "P12 real repair", profile: "F" });
  readVector({
    id: "P13 controlled fd-zero protocol, no real stdin operation",
    controls: () => ({ fdZero: true }),
    profile: "F",
  });
  readVector({ id: "P13 actual delegate repair", profile: "F" });
  for (const [label, control] of [
    [
      "throw",
      () => {
        throw Error("fstat");
      },
    ],
    ["mode", (stats: fs.Stats) => dataStat(stats, "mode", 0x4000)],
    ["size", (stats: fs.Stats) => dataStat(stats, "size", N + 1)],
  ] as const)
    readVector({
      id: "P14 " + label,
      controls: () => ({ fstat: control }),
      profile: "C",
    });
  readVector({ id: "P14 real repair", profile: "F" });
  for (const [index, value] of [-1, 65537, 0.5, NaN, "1", box(0)].entries())
    readVector({
      id: "P15 invalid count " + String(index),
      controls: () => ({ read: () => value }),
      profile: "C",
      check: (t) => {
        expect(t.reads).toHaveLength(1);
        expect(t.hashes).toBe(0);
      },
    });
  readVector({ id: "P15 real repair", profile: "F" });
  readVector({
    id: "P16 real truncate after fstat",
    controls: (path) => ({
      afterFstat: () => {
        fs.truncateSync(path, N - 1);
      },
    }),
    profile: "C",
    check: (t) => {
      expect(t.reads.at(-1)?.count).toBe(0);
      expect(t.hashes).toBe(0);
    },
  });
  readVector({ id: "P16 restore primary", profile: "F" });
  readVector({
    id: "P17 real append after fstat",
    controls: (path) => ({
      afterFstat: () => {
        fs.appendFileSync(path, Buffer.from([0]));
      },
    }),
    profile: "C",
    check: (t) => {
      expect(t.reads.at(-1)).toEqual({
        offset: N,
        position: N,
        request: 1,
        delegated: 1,
        count: 1,
      });
      expect(t.hashes).toBe(0);
    },
  });
  readVector({ id: "P17 restore primary", profile: "F" });
});
describe("P18-P23 short reads, cleanup, identity and reached fields", () => {
  readVector({
    id: "P18 real short-read protocol F1",
    controls: () => ({ short: true }),
    profile: "F",
    check: (t) => {
      expect(
        t.reads
          .slice(0, 3)
          .map((r) => [r.offset, r.request, r.position, r.delegated, r.count]),
      ).toEqual([
        [0, 65536, 0, 1, 1],
        [1, 65536, 1, 7, 7],
        [8, 65536, 8, 31, 31],
      ]);
      for (const row of t.reads.slice(3, -1)) {
        expect(row.request).toBe(Math.min(65536, N - row.position));
        expect(row.delegated).toBe(row.request);
        expect(row.count).toBe(row.request);
      }
      expect(t.reads.at(-1)).toEqual({
        offset: N,
        request: 1,
        position: N,
        delegated: 1,
        count: 0,
      });
      expect(t.hashes).toBe(1);
    },
  });
  readVector({ id: "P18 real-delegate repair", profile: "F" });
  // P19 SOURCE REVIEW ONLY: attempts >=832025 is checked before increment/read.
  // State832024 allows the terminal EOF and reaches832025, which forbids another
  // call. Positive counts advance; zero/invalid/throw exits. No failed-call retry.
  // No seeded counter, changed cap, source rewrite or dynamic terminal-cap claim.
  readVector({
    id: "P20 real close once then throw",
    controls: () => ({
      close: () => {
        throw Error("after actual close");
      },
    }),
    profile: "C",
    check: (t) => {
      expect(t.hashes).toBe(0);
    },
  });
  readVector({
    id: "P20 real close malformed return",
    controls: () => ({ close: () => 1 }),
    profile: "C",
    check: (t) => {
      expect(t.hashes).toBe(0);
    },
  });
  readVector({ id: "P20 real close repair", profile: "F" });
  readVector({
    id: "P21 excluded dirty sentinel",
    controls: () => ({ sentinel: true }),
    profile: "F",
    check: (t) => {
      expect(t.capture?.[N]).toBe(0xa5);
      expect(t.hashes).toBe(1);
    },
  });
  readVector({
    id: "P22 same-size byte0 XOR1",
    bytes: XOR_PRIMARY,
    profile: "C",
    check: (t) => {
      expect(t.hashes).toBe(1);
    },
  });
  for (const [label, digest] of [
    ["wrong", () => "0".repeat(64)],
    ["boxed", () => box(0)],
    ["nonstring", () => 0],
    [
      "throw",
      () => {
        throw Error("digest");
      },
    ],
  ] as const)
    readVector({
      id: "P22 digest " + label,
      controls: () => ({ digest }),
      profile: "C",
      check: (t) => {
        expect(t.hashes).toBe(1);
      },
    });
  readVector({ id: "P22 real hash repair", profile: "F" });
  for (const [label, width, offset] of [
    ["EOCD", 4, 832002],
    ["central", 2, 820855],
    ["local", 2, TARGET_LOCAL + 6],
  ] as const) {
    readVector({
      id: "P23 reached " + label + " miss",
      controls: () => ({
        field: { width, offset, result: () => (label === "EOCD" ? 0 : 1) },
      }),
      profile: "C",
      check: (t) => {
        expect(t.fieldHits).toBe(1);
        expect(t.hashes).toBe(1);
      },
    });
    readVector({
      id: "P23 reached " + label + " throw",
      controls: () => ({
        field: {
          width,
          offset,
          result: () => {
            throw Error("field");
          },
        },
      }),
      profile: "C",
      check: (t) => {
        expect(t.fieldHits).toBe(1);
      },
    });
  }
  readVector({
    id: "P23 reached post-hash view throw",
    controls: () => ({ span: true }),
    profile: "C",
    check: (t) => {
      expect(t.fieldHits).toBe(1);
    },
  });
  readVector({ id: "P23 real field/view repair", profile: "F" });
});
describe("P24-P27 output admission and normalized CRC", () => {
  for (const [label, inflateBefore] of [
    [
      "throw",
      () => {
        throw Error("inflate");
      },
    ],
    ["nonBuffer", () => new Uint8Array(INV.bytes.length)],
  ] as const)
    readVector({
      id: "P24 " + label,
      controls: () => ({ inflateBefore }),
      profile: "Z",
      stages: [0, 0, 0],
    });
  readVector({
    id: "P24 wrong intrinsic length",
    controls: () => ({ inflateAfter: () => Buffer.from([0]) }),
    profile: "Z",
    stages: [0, 0, 0],
  });
  readVector({
    id: "P24 capture alias",
    controls: () => ({
      inflateAfter: (_value, t) => t.capture?.subarray(0, INV.bytes.length),
    }),
    profile: "Z",
    stages: [0, 0, 0],
  });
  readVector({ id: "P24 real inflate repair", profile: "F" });
  for (const [index, value] of [-1, 4294967296, 0.5, "0", box(0)].entries())
    readVector({
      id: "P25 malformed CRC " + String(index),
      controls: () => ({ crc: () => value }),
      profile: "Z",
      stages: [1, 1, 1],
    });
  readVector({
    id: "P25 wrong unsigned CRC",
    controls: () => ({ crc: (value) => (value ^ 1) >>> 0 }),
    profile: "Z",
    stages: [1, 1, 1],
  });
  readVector({
    id: "P25 CRC throw",
    controls: () => ({
      crc: () => {
        throw Error("crc");
      },
    }),
    profile: "Z",
    stages: [1, 1, 1],
  });
  readVector({ id: "P25 real CRC repair", profile: "F" });
  readVector({
    id: "P26 allocation throw",
    controls: () => ({
      allocation: () => {
        throw Error("alloc");
      },
    }),
    profile: "Z",
    stages: [1, 0, 0],
  });
  readVector({
    id: "P26 allocation malformed",
    controls: () => ({ allocation: () => new Uint8Array(INV.bytes.length) }),
    profile: "Z",
    stages: [1, 0, 0],
  });
  readVector({
    id: "P26 allocation decoder alias",
    controls: () => ({ allocation: (_value, t) => t.decoded }),
    profile: "Z",
    stages: [1, 0, 0],
  });
  readVector({
    id: "P26 copy throw",
    controls: () => ({
      copy: () => {
        throw Error("copy");
      },
    }),
    profile: "Z",
    stages: [1, 1, 0],
  });
  readVector({
    id: "P26 copy malformed return",
    controls: () => ({ copy: () => 1 }),
    profile: "Z",
    stages: [1, 1, 0],
  });
  readVector({
    id: "P26 post-copy prototype rejection",
    controls: () => ({
      afterCopy: (bytes) => {
        Object.setPrototypeOf(bytes, Uint8Array.prototype);
      },
    }),
    profile: "Z",
    stages: [1, 1, 0],
  });
  readVector({ id: "P26 real normalization repair", profile: "F" });
  it("P27 named carrier getters0, fresh normalized CRC input", async () => {
    let getters = 0;
    const keys = [
      "length",
      "byteLength",
      "buffer",
      "byteOffset",
      "copy",
      "retained",
    ];
    const s = await subject({
      inflateAfter: (bytes, t) => {
        define(bytes, "archiveCarrier", {
          value: t.capture,
          configurable: true,
        });
        for (const key of keys)
          define(bytes, key, {
            configurable: true,
            get() {
              getters++;
              throw Error("carrier getter");
            },
          });
        return bytes;
      },
    });
    const bytes = s.module.unzipSource(ZIP).read(INVENTORY, INV.bytes.length);
    exact(bytes);
    counts(s.trace, "F");
    expect(getters).toBe(0);
    expect(s.trace.originalInflates).toBe(1);
    expect(s.trace.originalCrc).toBe(1);
    expect(s.trace.crcInput).toBe(bytes);
    for (const key of [...keys, "archiveCarrier"])
      expect(own(bytes, key)).toBeUndefined();
    expect(backing(bytes)).not.toBe(
      backing(s.trace.capture ?? Buffer.alloc(0)),
    );
    expect(backing(bytes)).not.toBe(backing(s.trace.decoded as object));
  });
  readVector({ id: "P27 real carrier repair", profile: "F" });
});
describe("P28-P37 legacy formats, freshness and discarded faults", () => {
  for (const [id, bytes, name, max] of [
    ["P28 Deflate", D, SOURCE.name, SOURCE.bytes.length],
    ["P29 descriptor", DESCRIPTOR, "a.txt", 0],
    ["P30 compressed corruption", CORRUPT_D, SOURCE.name, SOURCE.bytes.length],
    ["P30 truncated", D.subarray(0, -1), SOURCE.name, SOURCE.bytes.length],
    ["P30 central CRC", BAD_CRC_D, SOURCE.name, SOURCE.bytes.length],
    ["P31 duplicate", DUPLICATE, "a.txt", 0],
    ["P32 ASCII against Unicode", UNICODE, "a.txt", 0],
    ["P33 multidisk", MULTIDISK, "a.txt", 0],
    ["P34 ZIP64", ZIP64, "a.txt", 0],
  ] as const)
    readVector({ id, bytes, name, max, profile: "L" });
  readVector({
    id: "P32 direct nonASCII first",
    bytes: UNICODE,
    name: "é.txt",
    max: 0,
    profile: "N",
  });
  for (const [id, bytes, code] of [
    ["P31", DUPLICATE, "duplicate_zip_entry"],
    ["P32", UNICODE, "unsafe_member_name"],
  ] as const)
    it(id + " listing refusal before missing manifest", async () => {
      const path = owned(bytes),
        pin = { ...FIXTURE_V046_PINS, zipSha256: sha(bytes) };
      const s = await subject();
      expect(() => s.module.openPack(s.module.unzipSource(path), pin)).toThrow(
        code,
      );
      counts(s.trace, "N");
    });
  it("P35 delegation-only encryption control, no native acceptance claim", async () => {
    const path = owned(ENCRYPTED_CONTROL),
      failure = Error("controlled noninteractive legacy outcome");
    const s = await subject({
      legacy: () => {
        throw failure;
      },
    });
    expect(snapshot(() => s.module.unzipSource(path).read("a.txt", 0))).toEqual(
      {
        name: "FixtureIntegrityError",
        code: "member_read_failed",
        message: "member_read_failed: a.txt: " + failure.message.slice(0, 120),
      },
    );
    counts(s.trace, "L");
  });
  readVector({
    id: "P28-P35 original-primary real-delegate repair",
    profile: "F",
  });
  it("P36 same source sees primary to S to primary", async () => {
    const path = owned(),
      s = await subject(),
      source = s.module.unzipSource(path);
    exact(source.read(INVENTORY, 16352));
    counts(s.trace, "F");
    fs.writeFileSync(path, S);
    expect(snapshot(() => source.read(INVENTORY, 16352))).toEqual(
      snapshot(() => originalRead(path, INVENTORY, 16352)),
    );
    expect([s.trace.a, s.trace.o, s.trace.c, s.trace.l, s.trace.z]).toEqual([
      1, 1, 1, 1, 1,
    ]);
    fs.writeFileSync(path, PRIMARY);
    exact(source.read(INVENTORY, 16352));
    expect([s.trace.a, s.trace.o, s.trace.c, s.trace.l, s.trace.z]).toEqual([
      2, 2, 2, 1, 2,
    ]);
  });
  readVector({
    id: "P36 fallback reopens after close/path replacement",
    bytes: XOR_PRIMARY,
    controls: (path) => ({
      afterClose: () => {
        fs.writeFileSync(path, PRIMARY);
      },
    }),
    profile: "C",
    check: (t) => {
      expect(t.hashes).toBe(1);
    },
  });
  readVector({ id: "P36 real path/delegate repair", profile: "F" });
  for (const stage of ["lstat", "read", "inflate"] as const) {
    it("P37 discarded " + stage + " getters0, legacy wrapping120", async () => {
      let getters = 0;
      const discarded = Object.create(null) as object;
      for (const key of ["message", "cause"])
        define(discarded, key, {
          get() {
            getters++;
            throw Error("discarded getter");
          },
        });
      const fail = (): never => {
        throw discarded as Error;
      };
      const control: Controls =
        stage === "lstat"
          ? { lstat: fail }
          : stage === "read"
            ? { read: fail }
            : { inflateBefore: fail };
      const s = await subject({
        ...control,
        legacy: () => {
          throw Error("L".repeat(140));
        },
      });
      expect(
        snapshot(() => s.module.unzipSource(ZIP).read(INVENTORY, 16352)),
      ).toEqual({
        name: "FixtureIntegrityError",
        code: "member_read_failed",
        message: "member_read_failed: " + INVENTORY + ": " + "L".repeat(120),
      });
      counts(
        s.trace,
        stage === "lstat" ? "L" : stage === "read" ? "C" : "Z",
        [0, 0, 0],
      );
      expect(getters).toBe(0);
    });
    readVector({
      id: "P37 " + stage + " restore legacy only",
      controls: () =>
        stage === "lstat"
          ? {
              lstat: () => {
                throw Error("probe");
              },
            }
          : stage === "read"
            ? {
                read: () => {
                  throw Error("probe");
                },
              }
            : {
                inflateBefore: () => {
                  throw Error("probe");
                },
              },
      profile: stage === "lstat" ? "L" : stage === "read" ? "C" : "Z",
      stages: [0, 0, 0],
    });
    readVector({ id: "P37 " + stage + " restore candidate", profile: "F" });
  }
});
describe("P39 selected Stats DATA/prototype/u32 admission", () => {
  for (const stage of ["lstat", "fstat"] as const) {
    const profile = stage === "lstat" ? "L" : "C";
    for (const [index, mode] of [
      -1,
      4295000064,
      0.5,
      NaN,
      Infinity,
      "32768",
      box(32768),
    ].entries())
      readVector({
        id: "P39 " + stage + " mode " + String(index),
        controls: () => ({
          [stage]: (stats: fs.Stats) => dataStat(stats, "mode", mode),
        }),
        profile,
      });
    for (const key of ["mode", "size"] as const) {
      let getters = 0;
      readVector({
        id: "P39 " + stage + " own " + key + " accessor",
        controls: () => ({
          [stage]: (stats: fs.Stats) => {
            const copy = dataStat(stats, key, 0);
            define(copy, key, {
              configurable: true,
              get() {
                getters++;
                throw Error("Stats getter");
              },
            });
            return copy;
          },
        }),
        profile,
        check: () => {
          expect(getters).toBe(0);
        },
      });
    }
    readVector({
      id: "P39 " + stage + " wrong prototype/inherited fields",
      controls: () => ({
        [stage]: (stats: fs.Stats) => Object.create(stats) as object,
      }),
      profile,
    });
    readVector({ id: "P39 " + stage + " real Stats repair", profile: "F" });
  }
});

// Literal original schema/order/retention oracle, bound to reader3e14621f... .
// These test-owned sources isolate reader priority, never writer parents.
const originalSchema = z.object({
  pack_format: z.literal("desk-fixture-pack-members/1"),
  active_load: z.string(),
  archival_roles_never_loaded: z.array(z.string()),
  member_count_excluding_this_file: z.number().int(),
  members: z.array(
    z.object({
      path: z.string(),
      bytes: z.number().int().nonnegative(),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
      role: z.string(),
    }),
  ),
});
interface ObservedPack {
  memberNames: readonly string[];
  roles: ReadonlyMap<string, string>;
  member(name: string): Buffer;
}
function originalOpenPack(source: PackSource, pins: FixturePins): ObservedPack {
  const container = source.containerSha256?.();
  if (container !== undefined && container !== pins.zipSha256)
    throw new OriginalFixtureIntegrityError("zip_sha256_mismatch", container);
  const listing = source.listing();
  if (new Set(listing).size !== listing.length)
    throw new OriginalFixtureIntegrityError("duplicate_zip_entry");
  if (listing.length > 512)
    throw new OriginalFixtureIntegrityError("too_many_members");
  for (const name of listing)
    if (
      !/^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(name) ||
      name.split("/").includes("..")
    )
      throw new OriginalFixtureIntegrityError("unsafe_member_name", name);
  if (!listing.includes("PACK_MEMBERS.json"))
    throw new OriginalFixtureIntegrityError("pack_members_missing");
  const raw = source.read("PACK_MEMBERS.json", 4194304);
  if (sha(raw) !== pins.packMembersSha256)
    throw new OriginalFixtureIntegrityError("pack_members_sha256_mismatch");
  const manifest = originalSchema.parse(JSON.parse(raw.toString("utf8")));
  if (manifest.members.length !== manifest.member_count_excluding_this_file)
    throw new OriginalFixtureIntegrityError("pack_members_count_mismatch");
  const declared = new Map(manifest.members.map((m) => [m.path, m]));
  if (declared.size !== manifest.members.length)
    throw new OriginalFixtureIntegrityError("duplicate_pack_member");
  const expected = new Set([...declared.keys(), "PACK_MEMBERS.json"]);
  if (
    expected.size !== listing.length ||
    listing.some((name) => !expected.has(name))
  )
    throw new OriginalFixtureIntegrityError("member_set_mismatch");
  const [onlyLoad, ...extraLoads] = manifest.members.filter(
    (m) => m.role === "active_load",
  );
  if (
    onlyLoad === undefined ||
    extraLoads.length > 0 ||
    onlyLoad.path !== pins.activeLoadMember ||
    manifest.active_load !== pins.activeLoadMember
  )
    throw new OriginalFixtureIntegrityError("active_load_not_unique");
  let total = 0;
  const kept = new Map<string, Buffer>(),
    roles = new Map<string, string>();
  for (const member of manifest.members) {
    total += member.bytes;
    if (total > 67108864)
      throw new OriginalFixtureIntegrityError("pack_too_large");
    const bytes = source.read(member.path, member.bytes);
    if (bytes.length !== member.bytes || sha(bytes) !== member.sha256)
      throw new OriginalFixtureIntegrityError(
        "member_sha256_mismatch",
        member.path,
      );
    roles.set(member.path, member.role);
    if (!manifest.archival_roles_never_loaded.includes(member.role))
      kept.set(member.path, Buffer.from(bytes));
  }
  return {
    memberNames: [...roles.keys()].sort(),
    roles,
    member(name) {
      if (roles.get(name) === undefined)
        throw new OriginalFixtureIntegrityError("unknown_member", name);
      const bytes = kept.get(name);
      if (bytes === undefined)
        throw new OriginalFixtureIntegrityError(
          "archival_member_not_loadable",
          name,
        );
      return Buffer.from(bytes);
    },
  };
}
interface CompoundStage {
  label: string;
  manifest: Buffer;
  manifestHash: string;
  zipHash: string;
  listing: string[];
  badInventory: boolean;
  code: string | undefined;
  reads: string[];
  listings: number;
}
const allReads = GOLDENS.map((g) => g.name),
  originalListing = [...allReads];
const brokenInventory = Buffer.from(INV.bytes);
brokenInventory[0] = (brokenInventory[0] ?? 0) ^ 1;
function manifestData(change: (manifest: Manifest) => void): Buffer {
  const value = JSON.parse(MANIFEST_BYTES.toString("utf8")) as Manifest;
  change(value);
  return Buffer.from(JSON.stringify(value), "utf8");
}
function firstMember(manifest: Manifest, index: number): Declared {
  const row = manifest.members[index];
  if (!row) throw Error("independent primary manifest row missing");
  return row;
}
const COUNT_BAD = manifestData((m) => {
  m.member_count_excluding_this_file = 134;
});
const COUNT_FIXED = manifestData((m) => {
  m.member_count_excluding_this_file = 133;
});
const ROLE_BAD = manifestData((m) => {
  firstMember(m, 0).role = "active_load";
});
const ROLE_FIXED = manifestData((m) => {
  firstMember(m, 0).role = "inventory";
});
const FIRST_OVERFLOW = manifestData((m) => {
  firstMember(m, 0).bytes = 67108865;
});
const FIRST_FIXED = manifestData((m) => {
  firstMember(m, 0).bytes = 16352;
});
const SECOND_OVERFLOW = manifestData((m) => {
  firstMember(m, 1).bytes = 67108865;
});
const SECOND_FIXED = manifestData((m) => {
  firstMember(m, 1).bytes = 12497;
});
// All recipes/digests are independent DATA established before candidate import.
function compoundStage(
  label: string,
  changes: Partial<CompoundStage> = {},
): CompoundStage {
  return {
    label,
    manifest: MANIFEST_BYTES,
    manifestHash: MH,
    zipHash: H,
    listing: originalListing,
    badInventory: false,
    code: undefined,
    reads: allReads,
    listings: 1,
    ...changes,
  };
}
const COMPOUNDS: { id: string; stages: CompoundStage[] }[] = [
  {
    id: "B",
    stages: [
      compoundStage("wrong pin wins", {
        zipHash: "0".repeat(64),
        listing: [...originalListing, INVENTORY],
        code: "zip_sha256_mismatch",
        reads: [],
        listings: 0,
      }),
      compoundStage("repair pin exposes duplicate", {
        listing: [...originalListing, INVENTORY],
        code: "duplicate_zip_entry",
        reads: [],
      }),
      compoundStage("remove duplicate"),
    ],
  },
  {
    id: "C",
    stages: [
      compoundStage("bad manifest hash wins", {
        manifest: Buffer.from("{"),
        code: "pack_members_sha256_mismatch",
        reads: ["PACK_MEMBERS.json"],
      }),
      compoundStage("repair hash exposes JSON syntax", {
        manifest: Buffer.from("{"),
        manifestHash: sha(Buffer.from("{")),
        code: "SyntaxError",
        reads: ["PACK_MEMBERS.json"],
      }),
      compoundStage("restore primary manifest and pin"),
    ],
  },
  {
    id: "D",
    stages: [
      compoundStage("count before inventory hash", {
        manifest: COUNT_BAD,
        manifestHash: sha(COUNT_BAD),
        badInventory: true,
        code: "pack_members_count_mismatch",
        reads: ["PACK_MEMBERS.json"],
      }),
      compoundStage("repair count exposes inventory hash", {
        manifest: COUNT_FIXED,
        manifestHash: sha(COUNT_FIXED),
        badInventory: true,
        code: "member_sha256_mismatch",
        reads: ["PACK_MEMBERS.json", INVENTORY],
      }),
      compoundStage("restore payload", {
        manifest: COUNT_FIXED,
        manifestHash: sha(COUNT_FIXED),
      }),
    ],
  },
  {
    id: "E",
    stages: [
      compoundStage("set before inventory hash", {
        listing: [...originalListing, "extra.txt"],
        badInventory: true,
        code: "member_set_mismatch",
        reads: ["PACK_MEMBERS.json"],
      }),
      compoundStage("remove extra exposes inventory hash", {
        badInventory: true,
        code: "member_sha256_mismatch",
        reads: ["PACK_MEMBERS.json", INVENTORY],
      }),
      compoundStage("restore payload"),
    ],
  },
  {
    id: "F",
    stages: [
      compoundStage("active uniqueness before inventory hash", {
        manifest: ROLE_BAD,
        manifestHash: sha(ROLE_BAD),
        badInventory: true,
        code: "active_load_not_unique",
        reads: ["PACK_MEMBERS.json"],
      }),
      compoundStage("repair role exposes inventory hash", {
        manifest: ROLE_FIXED,
        manifestHash: sha(ROLE_FIXED),
        badInventory: true,
        code: "member_sha256_mismatch",
        reads: ["PACK_MEMBERS.json", INVENTORY],
      }),
      compoundStage("restore payload", {
        manifest: ROLE_FIXED,
        manifestHash: sha(ROLE_FIXED),
      }),
    ],
  },
  {
    id: "G",
    stages: [
      compoundStage("own overflow before own read", {
        manifest: FIRST_OVERFLOW,
        manifestHash: sha(FIRST_OVERFLOW),
        badInventory: true,
        code: "pack_too_large",
        reads: ["PACK_MEMBERS.json"],
      }),
      compoundStage("repair declaration exposes inventory hash", {
        manifest: FIRST_FIXED,
        manifestHash: sha(FIRST_FIXED),
        badInventory: true,
        code: "member_sha256_mismatch",
        reads: ["PACK_MEMBERS.json", INVENTORY],
      }),
      compoundStage("restore payload", {
        manifest: FIRST_FIXED,
        manifestHash: sha(FIRST_FIXED),
      }),
    ],
  },
  {
    id: "H",
    stages: [
      compoundStage("earlier hash before later overflow", {
        manifest: SECOND_OVERFLOW,
        manifestHash: sha(SECOND_OVERFLOW),
        badInventory: true,
        code: "member_sha256_mismatch",
        reads: ["PACK_MEMBERS.json", INVENTORY],
      }),
      compoundStage("repair inventory exposes later overflow", {
        manifest: SECOND_OVERFLOW,
        manifestHash: sha(SECOND_OVERFLOW),
        code: "pack_too_large",
        reads: ["PACK_MEMBERS.json", INVENTORY],
      }),
      compoundStage("restore README declaration", {
        manifest: SECOND_FIXED,
        manifestHash: sha(SECOND_FIXED),
      }),
    ],
  },
];
function composed(stage: CompoundStage): {
  source: PackSource;
  reads: string[];
  manifestBounds: number[];
  listingCalls: () => number;
} {
  const reads: string[] = [],
    manifestBounds: number[] = [];
  let listings = 0;
  return {
    reads,
    manifestBounds,
    listingCalls: () => listings,
    source: {
      containerSha256: () => H,
      listing() {
        listings++;
        return [...stage.listing];
      },
      read(name, maximum) {
        reads.push(name);
        if (name === "PACK_MEMBERS.json") {
          manifestBounds.push(maximum);
          return Buffer.from(stage.manifest);
        }
        const bytes =
          name === INVENTORY && stage.badInventory
            ? brokenInventory
            : golden(name).bytes;
        return Buffer.from(bytes);
      },
    },
  };
}
function observePack(action: () => ObservedPack): unknown {
  let pack: ObservedPack;
  try {
    pack = action();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    if (
      !(error instanceof OriginalFixtureIntegrityError) &&
      error.name !== "FixtureIntegrityError" &&
      !(error instanceof SyntaxError)
    )
      throw error;
    return {
      name: error.name,
      code: (error as Error & { code?: string }).code,
      message: error.message,
    };
  }
  // Admission capture ended: every success/member/role/ownership assertion is outside it.
  expect(pack.memberNames).toEqual(MANIFEST.members.map((m) => m.path).sort());
  expect([...pack.roles]).toEqual(
    MANIFEST.members.map((m) => [m.path, m.role]),
  );
  for (const row of MANIFEST.members) {
    if (MANIFEST.archival_roles_never_loaded.includes(row.role))
      expect(() => pack.member(row.path)).toThrow(
        "archival_member_not_loadable",
      );
    else {
      const bytes = pack.member(row.path);
      exact(bytes, golden(row.path));
      if (bytes.length) bytes[0] = (bytes[0] ?? 0) ^ 1;
      exact(pack.member(row.path), golden(row.path));
    }
  }
  expect(() => pack.member("missing.txt")).toThrow("unknown_member");
  return { admitted: true };
}
describe("P38 finite ordered compounds A-H against original oracle", () => {
  it("A unsafe name, empty archive, restored primary", async () => {
    const path = owned(Buffer.alloc(0)),
      s = await subject(),
      source = s.module.unzipSource(path);
    expect(snapshot(() => source.read("../x", 16352))).toEqual(
      snapshot(() => originalRead(path, "../x", 16352)),
    );
    counts(s.trace, "N");
    expect(snapshot(() => source.read(INVENTORY, 16352))).toEqual(
      snapshot(() => originalRead(path, INVENTORY, 16352)),
    );
    counts(s.trace, "L");
    fs.writeFileSync(path, PRIMARY);
    exact(source.read(INVENTORY, 16352));
    expect([s.trace.a, s.trace.o, s.trace.c, s.trace.l, s.trace.z]).toEqual([
      1, 1, 1, 1, 1,
    ]);
    expect([s.trace.allocations, s.trace.copies, s.trace.crc]).toEqual([
      1, 1, 1,
    ]);
  });
  for (const recipe of COMPOUNDS)
    it(recipe.id + " complete ordered repairs", async () => {
      const expected = recipe.stages.map((stage) => {
        const data = composed(stage);
        const outcome = observePack(() =>
          originalOpenPack(data.source, {
            ...FIXTURE_V046_PINS,
            zipSha256: stage.zipHash,
            packMembersSha256: stage.manifestHash,
          }),
        );
        expect(data.manifestBounds).toEqual(
          stage.reads.includes("PACK_MEMBERS.json") ? [4194304] : [],
        );
        return {
          outcome,
          reads: data.reads,
          listings: data.listingCalls(),
          manifestBounds: data.manifestBounds,
        };
      });
      const s = await subject();
      for (const [index, stage] of recipe.stages.entries()) {
        const data = composed(stage);
        const outcome = observePack(() =>
          s.module.openPack(data.source, {
            ...FIXTURE_V046_PINS,
            zipSha256: stage.zipHash,
            packMembersSha256: stage.manifestHash,
          }),
        );
        expect({
          outcome,
          reads: data.reads,
          listings: data.listingCalls(),
          manifestBounds: data.manifestBounds,
        }).toEqual(expected[index]);
        expect(data.reads).toEqual(stage.reads);
        expect(data.listingCalls()).toBe(stage.listings);
        expect(data.manifestBounds).toEqual(
          stage.reads.includes("PACK_MEMBERS.json") ? [4194304] : [],
        );
        if (stage.code === undefined)
          expect(outcome).toEqual({ admitted: true });
        else if (stage.code === "SyntaxError")
          expect(outcome).toMatchObject({
            name: "SyntaxError",
            code: undefined,
          });
        else
          expect(outcome).toMatchObject({
            name: "FixtureIntegrityError",
            code: stage.code,
          });
        if (stage.code === "member_sha256_mismatch")
          expect(outcome).toMatchObject({
            message: "member_sha256_mismatch: " + INVENTORY,
          });
      }
      // Synthetic sources deliberately do not count as extraction-route entries.
      counts(s.trace, "N");
    });
});
