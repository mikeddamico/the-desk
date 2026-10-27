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
export const ACTIVE_FIXTURE_CORPUS_ID = "connected-fixture151";
export const PREDECESSOR_FIXTURE_CORPUS_ID = "connected-fixture105";
const RESOURCE_PINS = {
  "SUCCESSOR-PROVENANCE.json":
    "3f3ef89236214a5b0073fec3624fbd1a7525b58662322edeafda9b485621fb9b",
  "SUBSTANTIVE-SCRIPT.json":
    "03565e05aef7844cf95f780ed1214e965d422e0062394b348439755ee7646b99",
  "TEXTURE-SCRIPT.json":
    "7c8825ae9def1aab4bcc5f26335522bd2ec9ab4beb59ab12468b8e99864117d4",
  "TEXTURE-CARRIER.json":
    "f708cff5839bf1481dfddb54001120e071c0fb1f04d2818e2ea2966ff72c8ec9",
  "TEXTURE-REWRITE.json":
    "11570879b14c1e121291969449e00d512f0772b6102d2531581e0fdda4a1d88a",
  "BRIEF.json":
    "acdc70d328eb951893235c1e1f1585f86bbad142b6e0335114a8f8d117c827f2",
  "PACKAGE.json":
    "c3719afc932d896f197ba5706a07e507179d7300d800ee97dcbaca426baff029",
  "ROSTER.json":
    "d19efa5376c7228d4ffff75867cb03541e0f31e1e063a85326dab5b3bc92a731",
  "TEMPLATE.json":
    "0a4b53e7ebb1f4a7f93c3fb67be21778c0d961e261a5913854c19923697012a0",
  "WRITER-VIEW-EXPECTED.json":
    "cc86d613e628baa2f65b310642df6597ed1d3638cdb976041ecdc89bfa486a9d",
  "CONTEXT-EXPECTED.json":
    "b76dce2acd4e513744ba8f31d6cd4bc2ebbea552d9162fbf505f97296f02b3a0",
  "AUTHORED-NORMALIZED-ROWS.json":
    "eb7fa39e6bc7618bfdcfabbe8685b10cb06e3d4aeb30b8c8ca9deacd51350bdc",
  "CEILING-EXPECTATIONS.json":
    "a4b3c728f675e5e4883ca8259808b49ddb19f43314114bc5948c63181c71d829",
  "FIVE-MATCH-INPUTS.json":
    "653ce59bbcbc5df0ab68eb930c5c577d2eebf5a2ccbcf007584801afb447f45d",
  "DIRECTION-EXPECTED.json":
    "9a2185dac5cefc7b1801f4750867f5b94ccc32db5c538b20e1b6db0ff3f69586",
  "IDENTITIES.json":
    "dd6c596787fd13c337506821992d75a1eeb64ce76a3046e9ec822058ebad33e0",
  "SQL-COLUMN-MAP.json":
    "12fe0433bb53dadbe1e6e372f7a8c3f2dca71411dab148a257b04fced196c425",
  "SCHEMA-construction-observation.json":
    "ccbbf98c3cd5d0cad7cb0af2846889f935ac674dc8a75fe6e862ede78a9263db",
  "SCHEMA-operation.json":
    "589d304ae1290052c2b8bd3d76d3fb51d20f35df915b8950f8c1ee9375f36890",
  "SCHEMA-audit.json":
    "6a80d1c156e73c77f1e81fe101ade9b256fb860633b0bac4950d5bd159c3e4d7",
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
      new URL(`../../fixtures/connected-fixture151/${name}`, import.meta.url),
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
  const provenance = at("SUCCESSOR-PROVENANCE.json");
  if (
    provenance.active_corpus !== ACTIVE_FIXTURE_CORPUS_ID ||
    provenance.predecessor_corpus !== PREDECESSOR_FIXTURE_CORPUS_ID ||
    pkg.id !== "fabfeb44-c361-5e82-9b8f-3a960d211cfa" ||
    pkg.artifact_id !== "0cf73158-6dbc-50e9-b604-578a49ccab9f" ||
    pkg.package_hash !==
      "288664c91f63508197091e4d2522a62962e6c8eb8484e7f4359dc1d2be01b8ae" ||
    provenance.active_package_id !== pkg.id ||
    provenance.active_package_hash !== pkg.package_hash
  )
    throw new ConnectedFixture105Refusal("fixture_semantic_identity");
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
