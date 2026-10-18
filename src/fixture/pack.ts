// Pack reader and integrity (Fixture v0.4.6). External unzip remains the listing/fallback tool.
// The reviewed optional member path indexes only the exact immutable container; it is not a general ZIP decoder.
// Every read is bounded by the size PACK_MEMBERS declares; names are validated against a strict allow-list before they reach
// `unzip` (no glob characters, no traversal); the ZIP hash and PACK_MEMBERS hash are external pins. Archival members may be
// hashed for pack integrity, but their bytes are never made available for parsing (see `Pack.member`).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readSync,
  Stats,
  statSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { crc32, inflateRawSync } from "node:zlib";

import { z } from "zod";

import {
  FIXTURE_V046_PINS,
  FIXTURE_ZIP_RELATIVE_PATH,
  type FixturePins,
} from "./pins.js";

export class FixtureIntegrityError extends Error {
  readonly code: string;
  constructor(code: string, detail = "") {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "FixtureIntegrityError";
    this.code = code;
  }
}

const safeName = /^[A-Za-z0-9_][A-Za-z0-9_./-]*$/;
const MAX_ZIP_BYTES = 32 * 1024 * 1024;
const MAX_TOTAL_MEMBER_BYTES = 64 * 1024 * 1024;
const MAX_PACK_MEMBERS = 512;
const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

// Private activation literals must never follow mutable exported or caller pins.
const OPTIONAL_ZIP_BYTES = 832024;
const OPTIONAL_ZIP_SHA256 =
  "7e1bb1108cdd84e47269b9ab2dab20ba934fcec64d44262f86d2b505616b0747";
const OPTIONAL_CD_START = 820847;
const OPTIONAL_CD_END = 832002;
const OPTIONAL_ENTRY_COUNT = 134;
const OPTIONAL_OUTPUT_BOUND = 4603085;
const OPTIONAL_READ_ATTEMPTS = 832025;
const extractionOwn = Object.getOwnPropertyDescriptor;
const extractionPrototype = Object.getPrototypeOf;
const extractionApply = Reflect.apply;
const extractionStatsPrototype = Stats.prototype;
const extractionBufferPrototype = Buffer.prototype as Buffer;
const extractionIsBuffer = extractionOwn(Buffer, "isBuffer")?.value as (
  value: unknown,
) => unknown;
const extractionAlloc = extractionOwn(Buffer, "alloc")?.value as (
  size: number,
) => Buffer;
const extractionClose: (fd: number) => unknown = closeSync;
const ExtractionUint8Array = Uint8Array;
const extractionTypedPrototype = extractionPrototype(
  Uint8Array.prototype,
) as object;
const extractionSet = extractionOwn(extractionTypedPrototype, "set")?.value as (
  this: unknown,
  ...args: unknown[]
) => unknown;
const extractionLength = (
  extractionOwn(extractionTypedPrototype, "byteLength") as
    | { get?: unknown }
    | undefined
)?.get;
const extractionBacking = (
  extractionOwn(extractionTypedPrototype, "buffer") as
    | { get?: unknown }
    | undefined
)?.get;
const extractionOffset = (
  extractionOwn(extractionTypedPrototype, "byteOffset") as
    | { get?: unknown }
    | undefined
)?.get;
const extractionRead16 = extractionOwn(
  extractionBufferPrototype,
  "readUInt16LE",
)?.value as (this: Buffer, offset: number) => unknown;
const extractionRead32 = extractionOwn(
  extractionBufferPrototype,
  "readUInt32LE",
)?.value as (this: Buffer, offset: number) => unknown;
const extractionSubarray = extractionOwn(extractionBufferPrototype, "subarray")
  ?.value as (this: Buffer, start: number, end: number) => unknown;
const extractionString = extractionOwn(extractionBufferPrototype, "toString")
  ?.value as (this: Buffer, encoding: string) => unknown;

function extractionMiss(): never {
  // This value is discarded by optionalMember; it is never a public reader error.
  throw Error("optional member miss");
}
function extractionInteger(value: unknown, maximum: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= maximum
  );
}
function extractionData(value: object, key: string): unknown {
  const descriptor = extractionOwn(value, key);
  if (!descriptor || !("value" in descriptor)) extractionMiss();
  return descriptor.value as unknown;
}
function extractionStats(value: unknown): void {
  if (
    typeof value !== "object" ||
    value === null ||
    extractionPrototype(value) !== extractionStatsPrototype
  )
    extractionMiss();
  const mode = extractionData(value, "mode");
  const size = extractionData(value, "size");
  if (
    !extractionInteger(mode, 0xffffffff) ||
    (mode & 0xf000) !== 0x8000 ||
    !extractionInteger(size, OPTIONAL_ZIP_BYTES) ||
    size !== OPTIONAL_ZIP_BYTES
  )
    extractionMiss();
}
interface ExtractionView {
  bytes: Buffer;
  backing: ArrayBufferLike;
  offset: number;
}
function extractionView(value: unknown, length: number): ExtractionView {
  if (
    extractionIsBuffer(value) !== true ||
    extractionPrototype(value) !== extractionBufferPrototype ||
    typeof extractionLength !== "function" ||
    typeof extractionBacking !== "function" ||
    typeof extractionOffset !== "function"
  )
    extractionMiss();
  const actualLength: unknown = extractionApply(extractionLength, value, []);
  const backing: unknown = extractionApply(extractionBacking, value, []);
  const offset: unknown = extractionApply(extractionOffset, value, []);
  if (
    actualLength !== length ||
    !extractionInteger(offset, Number.MAX_SAFE_INTEGER) ||
    !Number.isSafeInteger(offset + length) ||
    typeof backing !== "object" ||
    backing === null
  )
    extractionMiss();
  // The selected intrinsic getter supplies ArrayBufferLike storage. The selected
  // constructor below checks its internal span; this is not hostile-native proof.
  return {
    bytes: value as Buffer,
    backing: backing as ArrayBufferLike,
    offset,
  };
}
function extractionSpan(
  bytes: Buffer,
  start: number,
  length: number,
  end: number,
): Buffer {
  if (
    !extractionInteger(start, end) ||
    !extractionInteger(length, end) ||
    !Number.isSafeInteger(start + length) ||
    start + length > end
  )
    extractionMiss();
  const result: unknown = extractionApply(extractionSubarray, bytes, [
    start,
    start + length,
  ]);
  return extractionView(result, length).bytes;
}
function extractionField(
  bytes: Buffer,
  offset: number,
  width: 2 | 4,
  end: number,
): number {
  if (!extractionInteger(offset, end) || offset + width > end) extractionMiss();
  const result: unknown = extractionApply(
    width === 2 ? extractionRead16 : extractionRead32,
    bytes,
    [offset],
  );
  if (!extractionInteger(result, width === 2 ? 0xffff : 0xffffffff))
    extractionMiss();
  return result;
}
function extractionName(bytes: Buffer, length: number): string {
  const view = extractionView(bytes, length);
  const internal = new ExtractionUint8Array(view.backing, view.offset, length);
  for (const byte of internal) if (byte > 0x7f) extractionMiss();
  const result: unknown = extractionApply(extractionString, bytes, ["ascii"]);
  if (
    typeof result !== "string" ||
    !safeName.test(result) ||
    result.split("/").includes("..")
  )
    extractionMiss();
  return result;
}
interface ExtractionMember {
  offset: number;
  name: string;
  nameBytes: number;
  compressed: number;
  uncompressed: number;
  crc: number;
}
function extractionMember(bytes: Buffer, requested: string): ExtractionMember {
  const word = (offset: number): number =>
    extractionField(bytes, offset, 2, OPTIONAL_ZIP_BYTES);
  const dword = (offset: number): number =>
    extractionField(bytes, offset, 4, OPTIONAL_ZIP_BYTES);
  if (
    dword(OPTIONAL_CD_END) !== 0x06054b50 ||
    word(OPTIONAL_CD_END + 4) !== 0 ||
    word(OPTIONAL_CD_END + 6) !== 0 ||
    word(OPTIONAL_CD_END + 8) !== OPTIONAL_ENTRY_COUNT ||
    word(OPTIONAL_CD_END + 10) !== OPTIONAL_ENTRY_COUNT ||
    dword(OPTIONAL_CD_END + 12) !== 11155 ||
    dword(OPTIONAL_CD_END + 16) !== OPTIONAL_CD_START ||
    word(OPTIONAL_CD_END + 20) !== 0 ||
    OPTIONAL_CD_END + 22 !== OPTIONAL_ZIP_BYTES
  )
    extractionMiss();
  let position = OPTIONAL_CD_START;
  let selected: ExtractionMember | undefined;
  for (let index = 0; index < OPTIONAL_ENTRY_COUNT; index++) {
    if (position + 46 > OPTIONAL_CD_END) extractionMiss();
    if (
      dword(position) !== 0x02014b50 ||
      word(position + 6) !== 20 ||
      word(position + 8) !== 0 ||
      word(position + 10) !== 8 ||
      word(position + 30) !== 0 ||
      word(position + 32) !== 0 ||
      word(position + 34) !== 0
    )
      extractionMiss();
    const nameBytes = word(position + 28);
    if (nameBytes === 0) extractionMiss();
    const name = extractionName(
      extractionSpan(bytes, position + 46, nameBytes, OPTIONAL_CD_END),
      nameBytes,
    );
    const crc = dword(position + 16);
    const compressed = dword(position + 20);
    const uncompressed = dword(position + 24);
    const offset = dword(position + 42);
    if (name === requested) {
      if (selected) extractionMiss();
      selected = { offset, name, nameBytes, compressed, uncompressed, crc };
    }
    position += 46 + nameBytes;
  }
  if (position !== OPTIONAL_CD_END || !selected) extractionMiss();
  const local = selected.offset;
  if (local + 30 > OPTIONAL_CD_START) extractionMiss();
  if (
    dword(local) !== 0x04034b50 ||
    word(local + 4) !== 20 ||
    word(local + 6) !== 0 ||
    word(local + 8) !== 8 ||
    dword(local + 14) !== selected.crc ||
    dword(local + 18) !== selected.compressed ||
    dword(local + 22) !== selected.uncompressed ||
    word(local + 26) !== selected.nameBytes ||
    word(local + 28) !== 0 ||
    extractionName(
      extractionSpan(bytes, local + 30, selected.nameBytes, OPTIONAL_CD_START),
      selected.nameBytes,
    ) !== selected.name
  )
    extractionMiss();
  extractionSpan(
    bytes,
    local + 30 + selected.nameBytes,
    selected.compressed,
    OPTIONAL_CD_START,
  );
  return selected;
}
function optionalMember(
  zipPath: string,
  name: string,
  maxBytes: number,
): Buffer | undefined {
  try {
    if (
      typeof zipPath !== "string" ||
      typeof name !== "string" ||
      !extractionInteger(maxBytes, 67108864)
    )
      return undefined;
    const rdonly = extractionData(constants, "O_RDONLY");
    const nofollow = extractionData(constants, "O_NOFOLLOW");
    const nonblock = extractionData(constants, "O_NONBLOCK");
    if (
      rdonly !== 0 ||
      !extractionInteger(nofollow, 0x7fffffff) ||
      nofollow === 0 ||
      !extractionInteger(nonblock, 0x7fffffff) ||
      nonblock === 0 ||
      (nofollow & nonblock) !== 0
    )
      return undefined;
    extractionStats(lstatSync(zipPath));
    let owned: number | undefined;
    let captured: ExtractionView;
    try {
      const fd: unknown = openSync(zipPath, rdonly | nofollow | nonblock);
      if (!extractionInteger(fd, 0x7fffffff)) extractionMiss();
      owned = fd;
      extractionStats(fstatSync(fd));
      const allocation: unknown = extractionApply(extractionAlloc, Buffer, [
        OPTIONAL_ZIP_BYTES + 1,
      ]);
      captured = extractionView(allocation, OPTIONAL_ZIP_BYTES + 1);
      let position = 0;
      let attempts = 0;
      const read = (request: number): number => {
        if (attempts >= OPTIONAL_READ_ATTEMPTS) extractionMiss();
        attempts++;
        const count: unknown = readSync(
          fd,
          captured.bytes,
          position,
          request,
          position,
        );
        if (!extractionInteger(count, request)) extractionMiss();
        return count;
      };
      while (position < OPTIONAL_ZIP_BYTES) {
        const count = read(Math.min(65536, OPTIONAL_ZIP_BYTES - position));
        if (count === 0) extractionMiss();
        position += count;
      }
      if (read(1) !== 0) extractionMiss();
    } finally {
      if (owned !== undefined) {
        const fd = owned;
        owned = undefined;
        const closed = extractionClose(fd);
        if (closed !== undefined) extractionMiss();
      }
    }
    const archive = extractionSpan(
      captured.bytes,
      0,
      OPTIONAL_ZIP_BYTES,
      OPTIONAL_ZIP_BYTES + 1,
    );
    const digest: unknown = sha256(archive);
    if (typeof digest !== "string" || digest !== OPTIONAL_ZIP_SHA256)
      return undefined;
    const member = extractionMember(archive, name);
    const size = member.uncompressed;
    if (size > OPTIONAL_OUTPUT_BOUND || size > maxBytes + 1) return undefined;
    const compressed = extractionSpan(
      archive,
      member.offset + 30 + member.nameBytes,
      member.compressed,
      OPTIONAL_CD_START,
    );
    const decoded: unknown = inflateRawSync(compressed, {
      chunkSize: 16384,
      maxOutputLength: size === 0 ? 1 : size,
    });
    const input = extractionView(decoded, size);
    if (input.backing === captured.backing) return undefined;
    const internal = new ExtractionUint8Array(
      input.backing,
      input.offset,
      size,
    );
    const allocation: unknown = extractionApply(extractionAlloc, Buffer, [
      size,
    ]);
    const normalized = extractionView(allocation, size);
    const separate = (view: ExtractionView): boolean =>
      view.offset === 0 &&
      view.backing !== captured.backing &&
      view.backing !== input.backing;
    if (!separate(normalized)) return undefined;
    const copied: unknown = extractionApply(extractionSet, normalized.bytes, [
      internal,
      0,
    ]);
    if (
      copied !== undefined ||
      !separate(extractionView(normalized.bytes, size))
    )
      return undefined;
    const checksum: unknown = crc32(normalized.bytes);
    if (!extractionInteger(checksum, 0xffffffff) || checksum !== member.crc)
      return undefined;
    return normalized.bytes;
  } catch {
    // All recoverable candidate errors are unreflected routing misses. The legacy
    // operation below alone retains its original public return/catch behavior.
    return undefined;
  }
}

export interface PackSource {
  /** Entry names exactly as stored. */
  listing(): string[];
  /** Bytes of one entry; must not return more than `maxBytes` (callers treat more as an error). */
  read(name: string, maxBytes: number): Buffer;
  /** SHA-256 of the whole container, when the source is a file (checked against the pin). */
  containerSha256?(): string;
}

/** External listing/fallback plus the reviewed exact-container optional member path. */
export function unzipSource(zipPath: string): PackSource {
  const assertName = (name: string): void => {
    if (!safeName.test(name) || name.split("/").includes(".."))
      throw new FixtureIntegrityError("unsafe_member_name", name);
  };
  return {
    containerSha256: () => {
      if (statSync(zipPath).size > MAX_ZIP_BYTES)
        throw new FixtureIntegrityError("zip_too_large");
      return sha256(readFileSync(zipPath));
    },
    listing: () =>
      execFileSync("unzip", ["-Z1", zipPath], { maxBuffer: 1024 * 1024 })
        .toString("utf8")
        .split("\n")
        .filter((line) => line.length > 0),
    read: (name, maxBytes) => {
      assertName(name);
      try {
        const optional = optionalMember(zipPath, name, maxBytes);
        if (optional !== undefined) return optional;
        return execFileSync("unzip", ["-p", zipPath, name], {
          maxBuffer: maxBytes + 1,
        });
      } catch (error) {
        throw new FixtureIntegrityError(
          "member_read_failed",
          `${name}: ${(error as Error).message.slice(0, 120)}`,
        );
      }
    },
  };
}

export function defaultZipPath(): string {
  return fileURLToPath(
    new URL(`../../${FIXTURE_ZIP_RELATIVE_PATH}`, import.meta.url),
  );
}

const packMembersSchema = z.object({
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

export interface Pack {
  readonly pins: FixturePins;
  /** Non-archival member bytes (a copy). Archival members are refused: they are evidence, never a load. */
  member(name: string): Buffer;
  /** Parsed JSON of a non-archival member. */
  json(name: string): unknown;
  readonly roles: ReadonlyMap<string, string>;
  readonly memberNames: readonly string[];
}

const isArchival = (role: string, archival: readonly string[]): boolean =>
  archival.includes(role);

/**
 * Verifies the container and every member, then returns a read-only view. Archival members are hashed (pack integrity) and
 * dropped; their bytes are never retained or parsed.
 */
export function openPack(
  source: PackSource,
  pins: FixturePins = FIXTURE_V046_PINS,
): Pack {
  const container = source.containerSha256?.();
  if (container !== undefined && container !== pins.zipSha256)
    throw new FixtureIntegrityError("zip_sha256_mismatch", container);
  const listing = source.listing();
  if (new Set(listing).size !== listing.length)
    throw new FixtureIntegrityError("duplicate_zip_entry");
  if (listing.length > MAX_PACK_MEMBERS)
    throw new FixtureIntegrityError("too_many_members");
  for (const name of listing)
    if (!safeName.test(name) || name.split("/").includes(".."))
      throw new FixtureIntegrityError("unsafe_member_name", name);
  if (!listing.includes("PACK_MEMBERS.json"))
    throw new FixtureIntegrityError("pack_members_missing");
  const rawManifest = source.read("PACK_MEMBERS.json", 4 * 1024 * 1024);
  if (sha256(rawManifest) !== pins.packMembersSha256)
    throw new FixtureIntegrityError("pack_members_sha256_mismatch");
  const manifest = packMembersSchema.parse(
    JSON.parse(rawManifest.toString("utf8")),
  );
  if (manifest.members.length !== manifest.member_count_excluding_this_file)
    throw new FixtureIntegrityError("pack_members_count_mismatch");
  const declared = new Map(manifest.members.map((m) => [m.path, m]));
  if (declared.size !== manifest.members.length)
    throw new FixtureIntegrityError("duplicate_pack_member");
  const expectedNames = new Set([...declared.keys(), "PACK_MEMBERS.json"]);
  if (
    expectedNames.size !== listing.length ||
    listing.some((name) => !expectedNames.has(name))
  )
    throw new FixtureIntegrityError("member_set_mismatch");
  const loads = manifest.members.filter((m) => m.role === "active_load");
  const [onlyLoad, ...extraLoads] = loads;
  if (
    onlyLoad === undefined ||
    extraLoads.length > 0 ||
    onlyLoad.path !== pins.activeLoadMember ||
    manifest.active_load !== pins.activeLoadMember
  )
    throw new FixtureIntegrityError("active_load_not_unique");
  let total = 0;
  const kept = new Map<string, Buffer>();
  const roles = new Map<string, string>();
  for (const member of manifest.members) {
    total += member.bytes;
    if (total > MAX_TOTAL_MEMBER_BYTES)
      throw new FixtureIntegrityError("pack_too_large");
    const bytes = source.read(member.path, member.bytes);
    if (bytes.length !== member.bytes || sha256(bytes) !== member.sha256)
      throw new FixtureIntegrityError("member_sha256_mismatch", member.path);
    roles.set(member.path, member.role);
    if (!isArchival(member.role, manifest.archival_roles_never_loaded))
      kept.set(member.path, Buffer.from(bytes));
  }
  const names = [...roles.keys()].sort();
  return {
    pins,
    roles,
    memberNames: names,
    member(name) {
      const role = roles.get(name);
      if (role === undefined)
        throw new FixtureIntegrityError("unknown_member", name);
      const bytes = kept.get(name);
      if (bytes === undefined)
        throw new FixtureIntegrityError("archival_member_not_loadable", name);
      return Buffer.from(bytes);
    },
    json(name) {
      return JSON.parse(this.member(name).toString("utf8")) as unknown;
    },
  };
}

export const openFixturePack = (zipPath = defaultZipPath()): Pack =>
  openPack(unzipSource(zipPath));
