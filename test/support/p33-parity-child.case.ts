import { revisedLegacyRead } from "./legacy-native-kill-v1-reference.js";
// P33 only: no primary corpus import or native extraction during collection.
import { afterEach, expect, it, vi } from "vitest";
import { Buffer } from "node:buffer";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
const apply = Reflect.apply;
const own = Object.getOwnPropertyDescriptor;
const define = Object.defineProperty;
const N = 832024;
const sha = (bytes: Uint8Array): string =>
  crypto.createHash("sha256").update(bytes).digest("hex");
const directories: string[] = [];
const restorers: (() => void)[] = [];
const realFds = new Set<number>();
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
const typed = Object.getPrototypeOf(Uint8Array.prototype) as object;
const nativeAlloc = method(Buffer, "alloc");
const nativeSet = method(typed, "set");
const backingGetter = (own(typed, "buffer") as { get?: unknown } | undefined)
  ?.get;
function backing(bytes: object): unknown {
  if (typeof backingGetter !== "function")
    throw Error("original typed-array backing getter unavailable");
  return apply(backingGetter, bytes, []) as unknown;
}

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

async function subject() {
  let normalizationWindow = false;
  const trace = {
    a: 0,
    o: 0,
    c: 0,
    l: 0,
    z: 0,
    allocations: 0,
    copies: 0,
    crc: 0,
    hashes: 0,
    events: [] as string[],
    capture: undefined as Buffer | undefined,
    normalized: undefined as Buffer | undefined,
  };
  patchMethod(Buffer, "alloc", (...args: unknown[]): unknown => {
    const result: unknown = apply(nativeAlloc, Buffer, args);
    if (args[0] === N + 1 && trace.o > trace.c && Buffer.isBuffer(result))
      trace.capture = result;
    if (normalizationWindow && args[0] !== N + 1 && Buffer.isBuffer(result)) {
      trace.allocations++;
      trace.events.push("allocate");
      trace.normalized = result;
    }
    return result;
  });
  patchMethod(
    typed,
    "set",
    function (this: unknown, ...args: unknown[]): unknown {
      if (this === trace.normalized && trace.normalized !== undefined) {
        trace.copies++;
        trace.events.push("copy");
      }
      return apply(nativeSet, this, args);
    },
  );
  vi.doMock("node:fs", async () => {
    const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
    return exportsWith(actual, {
      openSync(...args: unknown[]): unknown {
        trace.a++;
        trace.events.push("open");
        const fd: unknown = apply(actual.openSync, actual, args);
        if (
          typeof fd === "number" &&
          Number.isSafeInteger(fd) &&
          fd >= 0 &&
          fd <= 0x7fffffff
        ) {
          trace.o++;
          realFds.add(fd);
        }
        return fd;
      },
      closeSync(fd: number): void {
        trace.c++;
        trace.events.push("close");
        actual.closeSync(fd);
        realFds.delete(fd);
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
              trace.hashes++;
              trace.events.push("hash");
            }
            return apply(update, hash, values);
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
        trace.z++;
        trace.events.push("inflate");
        const result: unknown = apply(actual.inflateRawSync, actual, args);
        normalizationWindow = true;
        return result;
      },
      crc32(...args: unknown[]): unknown {
        normalizationWindow = false;
        trace.crc++;
        trace.events.push("crc");
        return apply(actual.crc32, actual, args);
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
        }
        return apply(actual.execFileSync, actual, args) as unknown;
      },
    });
  });
  return { module: await import("../../src/fixture/pack.js"), trace };
}

it("P33 multidisk", async () => {
  const bytes = wire([STORED], 1);
  expect(sha(bytes)).toBe(
    "523320d8f338525c70f462b1e2d71f14f6d39e3e065a73bd63c54c185fbc6ab6",
  );
  const repaired = Buffer.from(bytes);
  repaired.writeUInt16LE(0, 35 + 34);
  repaired.writeUInt16LE(0, 86 + 4);
  repaired.writeUInt16LE(0, 86 + 6);
  expect(repaired).toEqual(S);
  const directory = fs.mkdtempSync(join(tmpdir(), "desk-extraction-parity-"));
  directories.push(directory);
  const path = join(directory, "fixture.zip");
  fs.writeFileSync(path, bytes, { flag: "wx" });
  const s = await subject();
  const actual = snapshot(() => s.module.unzipSource(path).read("a.txt", 0));
  const expected = snapshot(() => revisedLegacyRead(path, "a.txt", 0));
  expect(actual).toEqual(expected);
  expect([s.trace.a, s.trace.o, s.trace.c, s.trace.l, s.trace.z]).toEqual([
    0, 0, 0, 1, 0,
  ]);
  expect([s.trace.allocations, s.trace.copies, s.trace.crc]).toEqual([0, 0, 0]);
  if (s.trace.c && s.trace.l)
    expect(s.trace.events.indexOf("close")).toBeLessThan(
      s.trace.events.indexOf("legacy"),
    );
  if (s.trace.hashes)
    expect(s.trace.events.indexOf("close")).toBeLessThan(
      s.trace.events.indexOf("hash"),
    );
});
