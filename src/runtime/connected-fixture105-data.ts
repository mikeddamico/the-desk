// Fixed resource data only. Capability ownership remains in connected-fixture105.ts.
import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import {
  evidencePackageHash,
  scriptHash,
  showrunnerBriefHash,
} from "../identity/artifacts.js";
import { canonicalJson, sha256 } from "../identity/canonical-json.js";
import type { TextureRewriteRow } from "./speech-texture.js";

type Obj = Record<string, unknown>;
const RESOURCE_PINS = {
  "SUBSTANTIVE-SCRIPT.json":
    "aa748d08a4b65508524d05b3389d58e0ae4c72cb8100dc5d2707f077d3d23d2e",
  "TEXTURE-SCRIPT.json":
    "8d364ea384d12c65ece79ea9ef7dc9e44d1faa1afdc1ccfc5f7a02f4ecc569c9",
  "TEXTURE-CARRIER.json":
    "e469f3d9ba73449aa9e90d2c2b3a80167d9f7a2aeff9553f06a88360e51d74f1",
  "TEXTURE-REWRITE.json":
    "11570879b14c1e121291969449e00d512f0772b6102d2531581e0fdda4a1d88a",
  "BRIEF.json":
    "c209150cbd949ebc2abecf07341b87b7f45427aebaf55ab411b0841671d2f50c",
  "PACKAGE.json":
    "32c130c701fe801d04f056311f41b5d23bb5b09113ebe9d47d0811c097965dc7",
  "ROSTER.json":
    "d19efa5376c7228d4ffff75867cb03541e0f31e1e063a85326dab5b3bc92a731",
  "TEMPLATE.json":
    "0a4b53e7ebb1f4a7f93c3fb67be21778c0d961e261a5913854c19923697012a0",
  "WRITER-VIEW-EXPECTED.json":
    "85f180d842c37ad2f0c7ccf459c682da382e8fd9a021e1c3d6aa2f0f3bcb2781",
  "CONTEXT-EXPECTED.json":
    "ba5bf28a24c2d7391b4414fbe4abb6033f44eb70f2d17e338814d8f27f322dad",
  "AUTHORED-NORMALIZED-ROWS.json":
    "069334f71317a2550ef82270d44e926d91c7875e02d92d527cab1009acf4385d",
  "CEILING-EXPECTATIONS.json":
    "a4b3c728f675e5e4883ca8259808b49ddb19f43314114bc5948c63181c71d829",
  "FIVE-MATCH-INPUTS.json":
    "653ce59bbcbc5df0ab68eb930c5c577d2eebf5a2ccbcf007584801afb447f45d",
  "DIRECTION-EXPECTED.json":
    "55bffb51098f139d82f4bf4d2de4d790f098b04eeba37d6afb43ea6854d04170",
  "IDENTITIES.json":
    "c0b7be43e0b8fcb0e38eabb4779c52162f5ee8f668cd919a4839e9f3db92b5b0",
  "SQL-COLUMN-MAP.json":
    "e7017e8bd6dfab104a12afb15b36a2cb5836ff02f99c727ee31329c525cd297f",
  "SCHEMA-construction-observation.json":
    "98049b18228f41e785708510b5b21315c425afd20788bd4e0457342ddf10e3e4",
  "SCHEMA-operation.json":
    "4837efd8695108148adbdd323396733d4ae3dd11ce655cf03f98382535910f08",
  "SCHEMA-audit.json":
    "14efc982bb4d7dca45d72e310afe238ec5ff9897c908659cbd84dcc76883372b",
} as const;
export class ConnectedFixture105Refusal extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ConnectedFixture105Refusal";
  }
}
function obj(value: unknown): Obj {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new ConnectedFixture105Refusal("fixture_shape");
  return value as Obj;
}
function objects(value: unknown): Obj[] {
  if (!Array.isArray(value))
    throw new ConnectedFixture105Refusal("fixture_array");
  return value.map(obj);
}
function frozen<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) frozen(child);
    Object.freeze(value);
  }
  return value;
}
export interface ConnectedFixture105Data {
  readonly parent: Obj;
  readonly child: Obj;
  readonly carrier: Obj;
  readonly rewrites: readonly TextureRewriteRow[];
  readonly brief: Obj;
  readonly pkg: Obj;
  readonly roster: Obj;
  readonly template: Obj;
  readonly writer: Obj;
  readonly context: Obj;
  readonly tables: Readonly<Record<string, readonly Obj[]>>;
  readonly ceilings: readonly Obj[];
  readonly matches: readonly Obj[];
  readonly direction: Obj;
  readonly identities: Obj;
  readonly sql: readonly Obj[];
  readonly schemas: readonly Obj[];
}
let cached: ConnectedFixture105Data | undefined;
/** No caller path/alias; exact source bytes, regular non-symlink leaves, bounded reads. */
export function connectedFixture105Data(): ConnectedFixture105Data {
  if (cached !== undefined) return cached;
  const values = new Map<string, unknown>();
  for (const [name, digest] of Object.entries(RESOURCE_PINS)) {
    const path = fileURLToPath(
      new URL(`../../fixtures/connected-fixture105/${name}`, import.meta.url),
    );
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const before = fstatSync(fd);
      if (!before.isFile() || before.size > 262144)
        throw new ConnectedFixture105Refusal("fixture_resource_bound");
      const bytes = readFileSync(fd);
      const after = fstatSync(fd);
      if (
        bytes.length !== before.size ||
        before.dev !== after.dev ||
        before.ino !== after.ino ||
        before.mtimeMs !== after.mtimeMs ||
        sha256(bytes) !== digest
      )
        throw new ConnectedFixture105Refusal("fixture_resource_identity");
      values.set(
        name,
        JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        ) as unknown,
      );
    } finally {
      closeSync(fd);
    }
  }
  const at = (name: string): Obj => obj(values.get(name));
  const parent = at("SUBSTANTIVE-SCRIPT.json");
  const child = at("TEXTURE-SCRIPT.json");
  const brief = at("BRIEF.json");
  const pkg = at("PACKAGE.json");
  if (
    scriptHash(parent, { brief }) !== parent.script_hash ||
    scriptHash(child, { brief }) !== child.script_hash ||
    showrunnerBriefHash(brief) !== brief.brief_hash ||
    evidencePackageHash(pkg) !== pkg.package_hash
  )
    throw new ConnectedFixture105Refusal("fixture_semantic_identity");
  const tables = Object.fromEntries(
    Object.entries(obj(at("AUTHORED-NORMALIZED-ROWS.json").tables)).map(
      ([k, v]) => [k, objects(v)],
    ),
  );
  const rewrites = objects(at("TEXTURE-REWRITE.json").ordered_rewrites).map(
    (r): TextureRewriteRow => {
      if (
        typeof r.anchor !== "string" ||
        typeof r.old !== "string" ||
        typeof r.new !== "string" ||
        (r.kind !== "contraction" && r.kind !== "concession_beat")
      )
        throw new ConnectedFixture105Refusal("fixture_rewrite_shape");
      return { anchor: r.anchor, old: r.old, new: r.new, kind: r.kind };
    },
  );
  cached = frozen({
    parent,
    child,
    carrier: at("TEXTURE-CARRIER.json"),
    rewrites,
    brief,
    pkg,
    roster: at("ROSTER.json"),
    template: at("TEMPLATE.json"),
    writer: at("WRITER-VIEW-EXPECTED.json"),
    context: at("CONTEXT-EXPECTED.json"),
    tables,
    ceilings: objects(values.get("CEILING-EXPECTATIONS.json")),
    matches: objects(values.get("FIVE-MATCH-INPUTS.json")),
    direction: at("DIRECTION-EXPECTED.json"),
    identities: at("IDENTITIES.json"),
    sql: objects(at("SQL-COLUMN-MAP.json").tables),
    schemas: [
      at("SCHEMA-construction-observation.json"),
      at("SCHEMA-operation.json"),
      at("SCHEMA-audit.json"),
    ],
  });
  return cached;
}
export function connectedFixture105ResourceIdentity(): string {
  return sha256(Buffer.from(canonicalJson(RESOURCE_PINS), "utf8"));
}

/** Fixed definition identities, disjoint from the historical gate set. */
export function connectedFixture105Id(label: `definition:${string}`): string {
  const position = Number(label.slice("definition:".length));
  if (
    !Number.isInteger(position) ||
    position < 1 ||
    position > 25 ||
    label !== `definition:${String(position)}`
  )
    throw new ConnectedFixture105Refusal("fixture_definition_identity");
  const h = sha256(
    Buffer.from(`the-desk.connected-fixture105.definition/1\n${label}`, "utf8"),
  );
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
