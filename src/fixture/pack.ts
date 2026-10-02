// Pack reader and integrity (Fixture v0.4.6). Existing `unzip` tooling is retained (no custom ZIP parser, no dependency).
// Every read is bounded by the size PACK_MEMBERS declares; names are validated against a strict allow-list before they reach
// `unzip` (no glob characters, no traversal); the ZIP hash and PACK_MEMBERS hash are external pins. Archival members may be
// hashed for pack integrity, but their bytes are never made available for parsing (see `Pack.member`).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

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

export interface PackSource {
  /** Entry names exactly as stored. */
  listing(): string[];
  /** Bytes of one entry; must not return more than `maxBytes` (callers treat more as an error). */
  read(name: string, maxBytes: number): Buffer;
  /** SHA-256 of the whole container, when the source is a file (checked against the pin). */
  containerSha256?(): string;
}

/** The existing tooling: `unzip -Z1` for names, `unzip -p` for bytes, with a hard `maxBuffer`. */
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
