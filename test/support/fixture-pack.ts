// Test support: build modified-but-CONSISTENT packs (members changed, PACK_MEMBERS and pins recomputed) so tampering reaches
// the verification layers below pack integrity, plus raw tampering that integrity must reject.
import { createHash } from "node:crypto";

import { FIXTURE_V046_PINS, type FixturePins } from "../../src/fixture/pins.js";
import {
  defaultZipPath,
  openPack,
  unzipSource,
  type Pack,
  type PackSource,
} from "../../src/fixture/pack.js";

export type Json = Record<string, unknown>;
const sha = (b: Uint8Array): string =>
  createHash("sha256").update(b).digest("hex");

export function must<T>(value: T | undefined | null, what = "value"): T {
  if (value === undefined || value === null) throw new Error(`Missing ${what}`);
  return value;
}
export function obj(value: unknown, what = "object"): Json {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${what} is not an object`);
  return value as Json;
}
export function list(value: unknown, what = "array"): Json[] {
  if (!Array.isArray(value)) throw new Error(`${what} is not an array`);
  return value.map((v) => obj(v));
}

let members: Map<string, Buffer> | undefined;
/** Every member of the real pack (archival ones included), read once. */
export function realMembers(): Map<string, Buffer> {
  if (!members) {
    const source = unzipSource(defaultZipPath());
    members = new Map(
      source
        .listing()
        .map((name) => [name, source.read(name, 64 * 1024 * 1024)]),
    );
  }
  return new Map([...members].map(([k, v]) => [k, Buffer.from(v)]));
}

export function memorySource(
  map: Map<string, Buffer>,
  options: { listing?: string[]; zipSha?: string } = {},
): PackSource {
  const source: PackSource = {
    listing: () => options.listing ?? [...map.keys()],
    read: (name, max) => {
      const bytes = must(map.get(name), `member ${name}`);
      if (bytes.length > max + 1) throw new Error("over bound");
      return bytes;
    },
  };
  if (options.zipSha !== undefined) {
    const zip = options.zipSha;
    source.containerSha256 = () => zip;
  }
  return source;
}

export type Mutator = (members: Map<string, Buffer>) => void;

/** Applies `mutate`, rewrites PACK_MEMBERS for the changed members and returns a pack whose pins match the new bytes. */
export function consistentPack(
  mutate: Mutator,
  pinOverrides: Partial<FixturePins> = {},
): Pack {
  const map = realMembers();
  mutate(map);
  const manifest = obj(
    JSON.parse(must(map.get("PACK_MEMBERS.json")).toString("utf8")),
  );
  const updated = list(manifest.members)
    .filter((m) => map.has(String(m.path)))
    .map((m) => {
      const bytes = must(map.get(String(m.path)));
      return { ...m, bytes: bytes.length, sha256: sha(bytes) };
    });
  manifest.members = updated;
  manifest.member_count_excluding_this_file = updated.length;
  const raw = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  map.set("PACK_MEMBERS.json", raw);
  const pins: FixturePins = {
    ...FIXTURE_V046_PINS,
    packMembersSha256: sha(raw),
    ...pinOverrides,
  };
  return openPack(memorySource(map), pins);
}

export function editJson(
  map: Map<string, Buffer>,
  member: string,
  edit: (doc: Json) => void,
): void {
  const doc = obj(JSON.parse(must(map.get(member), member).toString("utf8")));
  edit(doc);
  map.set(member, Buffer.from(`${JSON.stringify(doc, null, 2)}\n`));
}

export type Tables = Record<string, Json[]>;
export function editRows(
  map: Map<string, Buffer>,
  edit: (tables: Tables) => void,
): void {
  editJson(map, "foundation_rows_398.json", (doc) => {
    edit(obj(doc.tables) as unknown as Tables);
  });
}
export const rowOf = (t: Tables, table: string, index = 0): Json =>
  must(t[table]?.[index], `${table}[${String(index)}]`);
export const artifactOf = (t: Tables, type: string): Json =>
  must(
    t.artifacts?.find((a) => a.artifact_type === type),
    type,
  );
