import {
  ConnectedFixture105Refusal,
  connectedFixture105Data,
  connectedFixture105ResourceIdentity,
  connectedFixture105Id,
} from "./connected-fixture105-data.js";
export {
  ConnectedFixture105Refusal,
  connectedFixture105Data,
  connectedFixture105ResourceIdentity,
  connectedFixture105Id,
  type ConnectedFixture105Data,
} from "./connected-fixture105-data.js";
import * as fixtureFs from "node:fs";
import * as fixturePath from "node:path";
import * as fixtureCrypto from "node:crypto";
// Fixed disclosed evaluation fixture; never a generic loader or live admission.
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  openSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  lstatSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { loadConfig, type Config } from "../config.js";

import {
  scriptHash,
  connectedFixture105ArtifactHash,
} from "../identity/artifacts.js";
import { freezeClaims } from "../knowledge/claim-log.js";
import type { UsageClass } from "../knowledge/claim-state.js";
import { createProgramRun, createProgramAttempt } from "./program.js";
import { bindPackage } from "./package.js";
import {
  evaluateConnectedFixture105Component,
  connectedFixture105ClaimsResultHash,
  recordConnectedFixture105Claims,
  GATE_DEFINITION_KEYS,
  type ComponentInputs,
  type ComponentEvaluation,
} from "./claims-writing-gate.js";
import {
  evaluateConnectedFixture105Performance,
  connectedFixture105PerformanceResultHash,
  recordConnectedFixture105Performance,
} from "./performance-direction-fixture105.js";
import {
  validateDirectionCandidate,
  PERFORMANCE_DEFINITION_KEYS,
  type PerformanceEvaluation,
} from "./performance-direction.js";
import { fingerprint } from "../identity/fingerprints.js";
import { connectedFixture105OperationId } from "../identity/artifacts.js";
import { canonicalJson, sha256 } from "../identity/canonical-json.js";
import {
  runCommand,
  commandCleanupErrors,
  CommandConnectionError,
  faultPoint,
  type Tx,
  type Outcome,
  type Json,
} from "./command.js";
import {
  persistConnectedFixture105Package,
  type AuthoredPackage,
  type PersistPackageOptions,
} from "./package.js";

// Fixed fixture tooling boundary; builtin reads only. Runner provenance is not hostile-user authentication.
type FixtureRootObject = Record<string, unknown>;
function fixtureObject(value: unknown): FixtureRootObject {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("fixture_root_shape");
  return value as FixtureRootObject;
}
function fixtureKeys(value: FixtureRootObject, keys: readonly string[]): void {
  if (
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    throw new Error("fixture_root_shape");
}
function fixtureRawHash(bytes: Uint8Array): string {
  return fixtureCrypto.createHash("sha256").update(bytes).digest("hex");
}
function fixtureJson(bytes: Buffer): FixtureRootObject {
  return fixtureObject(
    JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    ) as unknown,
  );
}
function fixtureAbsolute(path: string): void {
  if (
    !fixturePath.isAbsolute(path) ||
    fixturePath.normalize(path) !== path ||
    path.split("/").some((part) => part === "..")
  )
    throw new Error("fixture_root_path");
}
/** Open every ancestor by descriptor; never follow an ancestor or leaf symlink. */
function fixtureOpen(path: string, directory: boolean): number {
  fixtureAbsolute(path);
  let fd = fixtureFs.openSync(
    "/",
    fixtureFs.constants.O_RDONLY |
      fixtureFs.constants.O_DIRECTORY |
      fixtureFs.constants.O_NOFOLLOW,
  );
  try {
    const parts = path.split("/").filter(Boolean);
    for (let index = 0; index < parts.length; index++) {
      const next = fixtureFs.openSync(
        `/proc/self/fd/${String(fd)}/${String(parts[index])}`,
        fixtureFs.constants.O_RDONLY |
          fixtureFs.constants.O_NOFOLLOW |
          fixtureFs.constants.O_NONBLOCK |
          (index < parts.length - 1 || directory
            ? fixtureFs.constants.O_DIRECTORY
            : 0),
      );
      fixtureFs.closeSync(fd);
      fd = next;
    }
    return fd;
  } catch (error) {
    fixtureFs.closeSync(fd);
    throw error;
  }
}
function fixtureIdentity(
  path: string,
  privateMode: boolean,
): FixtureRootObject {
  const fd = fixtureOpen(path, true);
  try {
    const st = fixtureFs.fstatSync(fd);
    if (
      !st.isDirectory() ||
      st.uid !== process.getuid?.() ||
      (privateMode && (st.mode & 0o777) !== 0o700)
    )
      throw new Error("fixture_root_owner");
    return {
      path,
      dev: st.dev,
      ino: st.ino,
      uid: st.uid,
      mode: st.mode & 0o777,
    };
  } finally {
    fixtureFs.closeSync(fd);
  }
}
function fixtureRead(path: string, limit: number, privateMode = true): Buffer {
  const fd = fixtureOpen(path, false);
  try {
    const before = fixtureFs.fstatSync(fd);
    if (
      !before.isFile() ||
      before.nlink !== 1 ||
      before.uid !== process.getuid?.() ||
      (privateMode && (before.mode & 0o777) !== 0o600) ||
      (privateMode && before.size === 0) ||
      before.size > limit
    )
      throw new Error("fixture_root_leaf");
    const bytes = fixtureFs.readFileSync(fd);
    const after = fixtureFs.fstatSync(fd);
    if (
      bytes.length !== before.size ||
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs
    )
      throw new Error("fixture_root_changed");
    return bytes;
  } finally {
    fixtureFs.closeSync(fd);
  }
}
function fixtureStable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(fixtureStable).join(",")}]`;
  if (typeof value === "object" && value !== null)
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${fixtureStable(v)}`)
      .join(",")}}`;
  const text: unknown = JSON.stringify(value);
  if (typeof text !== "string") throw new Error("fixture_root_shape");
  return text;
}
function fixtureSame(a: unknown, b: unknown): void {
  if (fixtureStable(a) !== fixtureStable(b))
    throw new Error("fixture_root_changed");
}
function fixtureGraph(
  base: string,
  kind: "source" | "tools",
): FixtureRootObject {
  const result: FixtureRootObject = {};
  let visited = 0;
  function visit(path: string, relative: string): void {
    // Each prior visit can add at most one own key; preserve the exact bound.
    if (visited++ > 20000 && Object.keys(result).length > 20000)
      throw new Error("fixture_inventory_bound");
    const info = fixtureFs.lstatSync(path);
    if (info.isSymbolicLink()) {
      if (kind !== "tools") throw new Error("fixture_source_link");
      const target = fixtureFs.readlinkSync(path);
      const resolved = fixturePath.resolve(fixturePath.dirname(path), target);
      if (fixturePath.isAbsolute(target) || !resolved.startsWith(base + "/"))
        throw new Error("fixture_tool_link");
      result[relative] = { type: "symlink", mode: info.mode & 0o777, target };
      return;
    }
    if (info.isDirectory()) {
      const fd = fixtureOpen(path, true);
      try {
        const actual = fixtureFs.fstatSync(fd);
        if (actual.ino !== info.ino || actual.dev !== info.dev)
          throw new Error("fixture_inventory_changed");
        result[relative] = { type: "directory", mode: info.mode & 0o777 };
        for (const name of fixtureFs
          .readdirSync(`/proc/self/fd/${String(fd)}`)
          .sort()) {
          if (
            relative === "" &&
            (kind === "source"
              ? [".git", "node_modules", "dist"]
              : [".vite-temp"]
            ).includes(name)
          )
            continue;
          visit(`${path}/${name}`, relative ? `${relative}/${name}` : name);
        }
      } finally {
        fixtureFs.closeSync(fd);
      }
      return;
    }
    if (!info.isFile()) throw new Error("fixture_inventory_special");
    const bytes = fixtureRead(path, 64 * 1024 * 1024, false);
    result[relative] = {
      type: "file",
      mode: info.mode & 0o777,
      bytes: bytes.length,
      sha256: fixtureRawHash(bytes),
    };
  }
  visit(base, "");
  return result;
}
function fixtureTempObservation(
  checkout: string,
  settled: boolean,
): FixtureRootObject {
  const path = `${checkout}/node_modules/.vite-temp`;
  let info;
  try {
    info = fixtureFs.lstatSync(path);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return { absent: true };
    throw error;
  }
  if (
    !info.isDirectory() ||
    info.uid !== process.getuid?.() ||
    (info.mode & 0o777) !== 0o700
  )
    throw new Error("fixture_temp_owner");
  const identity = fixtureIdentity(path, true);
  const names = fixtureFs.readdirSync(path).sort();
  if (names.length > (settled ? 0 : 1))
    throw new Error("fixture_temp_unsettled");
  const leaves = names.map((name) => {
    if (
      !/^vitest\.config\.ts\.timestamp-[0-9]{1,16}-[0-9a-f]{0,32}\.mjs$/u.test(
        name,
      )
    )
      throw new Error("fixture_temp_name");
    const bytes = fixtureRead(`${path}/${name}`, 262144, false);
    const stat = fixtureFs.lstatSync(`${path}/${name}`);
    if (stat.mode & 0o022) throw new Error("fixture_temp_mode");
    return {
      name,
      bytes: bytes.length,
      sha256: fixtureRawHash(bytes),
      base64: bytes.toString("base64"),
    };
  });
  return { identity, leaves };
}
function fixtureExecutionRoot(checkout: string): {
  root: string;
  rootHash: string;
  marker: FixtureRootObject;
  temp: FixtureRootObject;
} {
  const raw = process.env.DESK_FIXTURE105_BINDING;
  if (raw === undefined || Buffer.byteLength(raw) > 8192)
    throw new Error("fixture_runner_binding_missing");
  const binding = fixtureObject(JSON.parse(raw) as unknown);
  fixtureKeys(binding, ["root", "root_sha256"]);
  if (
    typeof binding.root !== "string" ||
    typeof binding.root_sha256 !== "string" ||
    !/^[0-9a-f]{64}$/u.test(binding.root_sha256)
  )
    throw new Error("fixture_runner_binding_shape");
  const root = binding.root;
  fixtureAbsolute(root);
  fixtureAbsolute(checkout);
  if (
    fixturePath.basename(root) !== "desk-connected-fixture105" ||
    root === checkout ||
    root.startsWith(checkout + "/") ||
    checkout.startsWith(root + "/")
  )
    throw new Error("fixture_root_location");
  const bytes = fixtureRead(`${root}/ROOT.json`, 262144);
  if (fixtureRawHash(bytes) !== binding.root_sha256)
    throw new Error("fixture_root_pin");
  const marker = fixtureJson(bytes);
  fixtureKeys(marker, [
    "schema",
    "purpose",
    "checkout",
    "tmp",
    "root",
    "source_ledger_sha256",
    "release_sha256",
    "source_inventory_sha256",
    "tools_inventory_sha256",
  ]);
  if (
    marker.schema !== "fixture105-execution-root/1" ||
    marker.purpose !== "test_fixture105"
  )
    throw new Error("fixture_root_profile");
  fixtureSame(marker.checkout, fixtureIdentity(checkout, false));
  fixtureSame(marker.tmp, fixtureIdentity(fixturePath.dirname(root), true));
  fixtureSame(marker.root, fixtureIdentity(root, true));
  for (const directory of ["bindings", "expectations", "receipts"])
    fixtureIdentity(`${root}/${directory}`, true);
  const expectedFiles = [
    "ADOPTION.json",
    "RELEASE.json",
    "SOURCE-INVENTORY.json",
    "SOURCE-LEDGER.json",
    "TOOLS-INVENTORY.json",
  ];
  fixtureSame(fixtureFs.readdirSync(`${root}/bindings`).sort(), expectedFiles);
  for (const [name, key] of [
    ["SOURCE-LEDGER.json", "source_ledger_sha256"],
    ["RELEASE.json", "release_sha256"],
    ["SOURCE-INVENTORY.json", "source_inventory_sha256"],
    ["TOOLS-INVENTORY.json", "tools_inventory_sha256"],
  ] as const) {
    const data = fixtureRead(
      `${root}/bindings/${name}`,
      name.includes("INVENTORY") ? 4194304 : 262144,
    );
    if (fixtureRawHash(data) !== marker[key])
      throw new Error("fixture_root_binding_pin");
    if (name.includes("INVENTORY"))
      fixtureSame(
        fixtureJson(data),
        fixtureGraph(
          name.startsWith("SOURCE") ? checkout : `${checkout}/node_modules`,
          name.startsWith("SOURCE") ? "source" : "tools",
        ),
      );
  }
  const releaseBytes = fixtureRead(`${root}/bindings/RELEASE.json`, 262144);
  const ledgerBytes = fixtureRead(
    `${root}/bindings/SOURCE-LEDGER.json`,
    262144,
  );
  const adoption = fixtureJson(
    fixtureRead(`${root}/bindings/ADOPTION.json`, 262144),
  );
  fixtureSame(adoption, {
    release_id: "connected-fixture105-test-release/1",
    release_bytes: releaseBytes.length,
    release_sha256: fixtureRawHash(releaseBytes),
    ledger_bytes: ledgerBytes.length,
    ledger_sha256: fixtureRawHash(ledgerBytes),
  });
  const release = fixtureJson(releaseBytes);
  if (
    release.release_id !== adoption.release_id ||
    release.owner_source_ledger_sha256 !== adoption.ledger_sha256
  )
    throw new Error("fixture_adoption_relation");
  const temp = fixtureTempObservation(checkout, false);
  if (temp.absent !== true) {
    const created = fixtureJson(
      fixtureRead(
        `${fixturePath.dirname(fixturePath.dirname(root))}/evidence/fixture105-loader-created.json`,
        262144,
      ),
    );
    fixtureSame(temp.identity, created.identity);
  }
  const rootNames = fixtureFs.readdirSync(root);
  if (
    rootNames.some(
      (name) =>
        ![
          "ROOT.json",
          "bindings",
          "expectations",
          "receipts",
          "tool-cache",
          "RETENTION.json",
        ].includes(name),
    )
  )
    throw new Error("fixture_root_population");
  return { root, rootHash: binding.root_sha256, marker, temp };
}

type Obj = Record<string, unknown>;
/** Closed owner outcome; stored records, detail text and SQL are not error data. */
export class ConnectedFixture105OwnerRefusal extends ConnectedFixture105Refusal {
  readonly outcome: Readonly<{
    owner: string;
    kind: string;
    code: string | null;
    sqlstate: string | null;
  }>;
  constructor(
    owner:
      | "transaction"
      | "package"
      | "program_run"
      | "program_attempt"
      | "package_binding",
    outcome: Outcome<unknown>,
  ) {
    const code = "code" in outcome ? outcome.code : null;
    const sqlstate = "sqlstate" in outcome ? (outcome.sqlstate ?? null) : null;
    if (code !== null && !/^[A-Za-z0-9_.:-]{1,128}$/u.test(code))
      throw new ConnectedFixture105Refusal("fixture_owner_code_shape");
    if (sqlstate !== null && !/^[A-Z0-9]{5}$/u.test(sqlstate))
      throw new ConnectedFixture105Refusal("fixture_owner_code_shape");
    super(code ?? "fixture_owner_not_fresh");
    this.outcome = Object.freeze({ owner, kind: outcome.kind, code, sqlstate });
  }
}
export class ConnectedFixture105ClaimsFailure extends ConnectedFixture105Refusal {
  constructor(
    code: string,
    readonly receipt: Readonly<Obj>,
  ) {
    super(code);
  }
}
const SECONDARY_FAILURES = new WeakMap<object, readonly unknown[]>();
/** Preserve the primary class/object (notably CommandConnectionError). */
function withCleanup(primary: unknown, secondary: readonly unknown[]): unknown {
  const rest = secondary.filter((error) => error !== primary);
  if (rest.length === 0) return primary;
  if (typeof primary === "object" && primary !== null) {
    SECONDARY_FAILURES.set(
      primary,
      Object.freeze([
        ...new Set([...(SECONDARY_FAILURES.get(primary) ?? []), ...rest]),
      ]),
    );
    return primary;
  }
  return new AggregateError(
    [primary, ...rest],
    "fixture non-object failure and cleanup failed",
  );
}
/** Closed diagnostics only: no driver message, SQL, source body or credentials. */
export function connectedFixture105CleanupDiagnostics(
  primary: unknown,
): readonly Readonly<{ kind: string; code: string | null }>[] {
  const errors =
    typeof primary === "object" && primary !== null
      ? (SECONDARY_FAILURES.get(primary) ?? [])
      : [];
  return Object.freeze(
    errors.map((error) => {
      const value =
        typeof error === "object" && error !== null && "code" in error
          ? error.code
          : null;
      const code =
        typeof value === "string" && /^[A-Za-z0-9_.:-]{1,128}$/u.test(value)
          ? value
          : null;
      return Object.freeze({
        kind:
          error instanceof ConnectedFixture105Refusal
            ? "fixture_refusal"
            : error instanceof Error
              ? "error"
              : "unknown",
        code,
      });
    }),
  );
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
/** This checks context only; it neither proves database isolation nor mints admission. */
export function assertConnectedFixture105Context(
  environment: NodeJS.ProcessEnv,
): void {
  if (
    environment.DESK_ENV !== "test" ||
    environment.PROVIDERS_ENABLED !== "false"
  )
    throw new ConnectedFixture105Refusal("fixture_runtime_context");
}

export interface Fixture105RowEnvelope {
  readonly table: string;
  readonly primary_key: string;
  readonly canonical_row: string;
  readonly row_sha256: string;
}
const OBSERVATION_TABLES = [
  "claims",
  "claim_state_events",
  "rights_versions",
  "claim_supports",
  "evidence_units",
  "derivation_runs",
  "evidence_packages",
  "artifacts",
] as const;
const OWNED_TABLES = [
  "artifacts",
  "performance_direction_versions",
  "performance_intents",
  "gate_results",
] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const HASH = /^[0-9a-f]{64}$/u;
function exactKeys(value: Obj, keys: readonly string[]): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
function sqlValue(column: Obj, value: unknown): unknown {
  if (value === null) {
    if (column.nullable !== true || column.sql_type === "jsonb")
      throw new ConnectedFixture105Refusal("fixture_sql_null");
    return null;
  }
  switch (column.sql_type) {
    case "uuid": {
      if (typeof value !== "string" || !UUID.test(value.toLowerCase()))
        throw new ConnectedFixture105Refusal("fixture_sql_uuid");
      return value.toLowerCase();
    }
    case "integer":
    case "bigint": {
      if (typeof value === "string") {
        if (!/^-?(?:0|[1-9][0-9]*)$/u.test(value) || value === "-0")
          throw new ConnectedFixture105Refusal("fixture_sql_integer");
        const integer = BigInt(value);
        if (
          integer > BigInt(Number.MAX_SAFE_INTEGER) ||
          integer < BigInt(Number.MIN_SAFE_INTEGER)
        )
          throw new ConnectedFixture105Refusal("fixture_sql_integer");
        value = Number(integer);
      }
      if (
        typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        Object.is(value, -0)
      )
        throw new ConnectedFixture105Refusal("fixture_sql_integer");
      if (
        column.sql_type === "integer" &&
        (value < -2147483648 || value > 2147483647)
      )
        throw new ConnectedFixture105Refusal("fixture_sql_integer");
      return value;
    }
    case "boolean":
      if (typeof value !== "boolean")
        throw new ConnectedFixture105Refusal("fixture_sql_boolean");
      return value;
    case "timestamptz": {
      // Queries select UTC text with full six-digit precision; Date is refused.
      if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/u.test(value)
      )
        throw new ConnectedFixture105Refusal("fixture_sql_timestamp");
      const [whole, fraction = ""] = value.slice(0, -1).split(".");
      if (
        whole === undefined ||
        !Number.isFinite(Date.parse(`${whole}Z`)) ||
        new Date(`${whole}Z`).toISOString().slice(0, 19) !== whole
      )
        throw new ConnectedFixture105Refusal("fixture_sql_timestamp");
      const tail = fraction.replace(/0+$/u, "");
      return `${whole}${tail ? `.${tail}` : ""}Z`;
    }
    case "jsonb":
      // pg already decodes JSONB. A JSON string remains a string, never reparsed.
      canonicalJson(value);
      return value;
    case "sha256_hex":
      if (typeof value !== "string" || !HASH.test(value))
        throw new ConnectedFixture105Refusal("fixture_sql_digest");
      return value;
    case "lifecycle_state":
      if (value !== "PENDING")
        throw new ConnectedFixture105Refusal("fixture_lifecycle");
      return value;
    case "text":
      if (typeof value !== "string" || value.normalize("NFC") !== value)
        throw new ConnectedFixture105Refusal("fixture_sql_text");
      return value;
    default:
      throw new ConnectedFixture105Refusal("fixture_sql_type");
  }
}
/** Pure finite SQL projection; does not attest that any SQL read happened. */
export function connectedFixture105Row(
  table: string,
  row: Obj,
): Fixture105RowEnvelope {
  const spec = connectedFixture105Data().sql.find((s) => s.table === table);
  if (spec === undefined || typeof spec.primary_key !== "string")
    throw new ConnectedFixture105Refusal("fixture_sql_table");
  const columns = objects(spec.columns);
  const names = columns.map((c) => String(c.column));
  if (!exactKeys(row, names))
    throw new ConnectedFixture105Refusal("fixture_sql_columns");
  const decoded = Object.fromEntries(
    columns.map((c) => [String(c.column), sqlValue(c, row[String(c.column)])]),
  );
  const primary_key = decoded[spec.primary_key];
  if (typeof primary_key !== "string" || !UUID.test(primary_key))
    throw new ConnectedFixture105Refusal("fixture_sql_primary_key");
  const canonical_row = canonicalJson(decoded);
  return {
    table,
    primary_key,
    canonical_row,
    row_sha256: sha256(Buffer.from(canonical_row, "utf8")),
  };
}
/** Validation of already ordered row evidence; no sorting a malformed input into acceptance. */
export function validateConnectedFixture105Rows(
  kind: "observation" | "owned",
  input: readonly Fixture105RowEnvelope[],
  expected: readonly Fixture105RowEnvelope[],
): string {
  const order: readonly string[] =
    kind === "observation" ? OBSERVATION_TABLES : OWNED_TABLES;
  const cap = kind === "observation" ? 128 : 32;
  if (
    input.length === 0 ||
    input.length > cap ||
    input.length !== expected.length
  )
    throw new ConnectedFixture105Refusal("fixture_row_population");
  let previousTable = -1;
  let previousKey = "";
  for (const row of input) {
    if (
      !exactKeys(row as unknown as Obj, [
        "table",
        "primary_key",
        "canonical_row",
        "row_sha256",
      ])
    )
      throw new ConnectedFixture105Refusal("fixture_row_shape");
    const index = order.indexOf(row.table);
    if (
      index < previousTable ||
      index < 0 ||
      (index === previousTable && row.primary_key <= previousKey)
    )
      throw new ConnectedFixture105Refusal("fixture_row_order");
    previousTable = index;
    previousKey = row.primary_key;
    let decoded: unknown;
    try {
      decoded = JSON.parse(row.canonical_row) as unknown;
    } catch {
      throw new ConnectedFixture105Refusal("fixture_row_json");
    }
    const normalized = connectedFixture105Row(row.table, obj(decoded));
    if (canonicalJson(normalized) !== canonicalJson(row))
      throw new ConnectedFixture105Refusal("fixture_row_identity");
  }
  if (canonicalJson(input) !== canonicalJson(expected))
    throw new ConnectedFixture105Refusal("fixture_row_population");
  return sha256(Buffer.from(canonicalJson(input), "utf8"));
}

const EFFECTS = [
  "construct_fixture_subject",
  "evaluate_record_claims_writing",
  "evaluate_record_performance",
  "record_fixture_audit",
  "readback_converge",
] as const;
const RELEASE_ID = "connected-fixture105-test-release/1";
type ReleaseBinding = Readonly<{
  release: Obj;
  digest: string;
  ledgerDigest: string;
  subject: Obj;
  rootHash: string;
  root: string;
}>;
const fixtureCheckout = fileURLToPath(
  new URL("../../", import.meta.url),
).replace(/\/$/u, "");
/** Read-only preallocation boundary; does not mint or register a capability. */
export function validateConnectedFixture105ExecutionRoot(): string {
  return fixtureExecutionRoot(fixtureCheckout).root;
}
/** Runtime bindings are prepared externally by the independently bound runner. */
function bindingBytes(
  name: "RELEASE.json" | "SOURCE-LEDGER.json" | "ADOPTION.json",
): Buffer {
  const execution = fixtureExecutionRoot(fixtureCheckout);
  return fixtureRead(`${execution.root}/bindings/${name}`, 262144);
}
function jsonBytes(bytes: Buffer): Obj {
  try {
    return obj(
      JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      ) as unknown,
    );
  } catch {
    throw new ConnectedFixture105Refusal("fixture_release_shape");
  }
}
function fixedSubject(): Obj {
  const schema = connectedFixture105Data().schemas[0];
  const properties = obj(obj(obj(schema).properties).subject).properties;
  return Object.fromEntries(
    Object.entries(obj(properties)).map(([key, value]) => [
      key,
      obj(value).const,
    ]),
  );
}
function readRelease(): ReleaseBinding {
  // No user-selected pathname or object. The external adoption record is reviewed
  // deployment evidence, not authentication against a malicious filesystem owner.
  const releaseBytes = bindingBytes("RELEASE.json");
  const ledgerBytes = bindingBytes("SOURCE-LEDGER.json");
  const adoption = jsonBytes(bindingBytes("ADOPTION.json"));
  const release = jsonBytes(releaseBytes);
  const ledger = jsonBytes(ledgerBytes);
  if (
    !exactKeys(adoption, [
      "release_id",
      "release_bytes",
      "release_sha256",
      "ledger_bytes",
      "ledger_sha256",
    ]) ||
    adoption.release_id !== RELEASE_ID ||
    adoption.release_bytes !== releaseBytes.length ||
    adoption.release_sha256 !== sha256(releaseBytes) ||
    adoption.ledger_bytes !== ledgerBytes.length ||
    adoption.ledger_sha256 !== sha256(ledgerBytes)
  )
    throw new ConnectedFixture105Refusal("fixture_release_adoption");
  if (
    !exactKeys(release, [
      "release_id",
      "profile",
      "purpose",
      "environment",
      "contract_sha256",
      "fixture_manifest_sha256",
      "owner_source_ledger_sha256",
      "subject_binding",
      "allowed_effects",
    ]) ||
    release.release_id !== RELEASE_ID ||
    release.profile !== "connected-evaluation-fixture105/1" ||
    release.purpose !== "evaluation" ||
    release.environment !== "test" ||
    release.owner_source_ledger_sha256 !== sha256(ledgerBytes) ||
    canonicalJson(release.subject_binding) !== canonicalJson(fixedSubject()) ||
    canonicalJson(release.allowed_effects) !== canonicalJson(EFFECTS)
  )
    throw new ConnectedFixture105Refusal("fixture_release_binding");
  // Final ordered path list and row hashes are authored only after source review.
  if (
    !exactKeys(ledger, ["schema", "rows"]) ||
    ledger.schema !== "connected-fixture105-source-ledger/1"
  )
    throw new ConnectedFixture105Refusal("fixture_ledger_shape");
  const rows = objects(ledger.rows);
  if (rows.length === 0 || rows.length > 128)
    throw new ConnectedFixture105Refusal("fixture_ledger_bound");
  const expectedPaths = [
    "docs/connected-fixture105.md",
    "eslint.config.js",
    "fixtures/connected-fixture105/AUTHORED-NORMALIZED-ROWS.json",
    "fixtures/connected-fixture105/BRIEF.json",
    "fixtures/connected-fixture105/CANONICAL-PREIMAGES.json",
    "fixtures/connected-fixture105/CEILING-EXPECTATIONS.json",
    "fixtures/connected-fixture105/CLAIM-ROWS.json",
    "fixtures/connected-fixture105/CONFIG.json",
    "fixtures/connected-fixture105/CONNECTED-REFUSAL-WITNESSES.json",
    "fixtures/connected-fixture105/CONTEXT-EXPECTED.json",
    "fixtures/connected-fixture105/CONTEXT-RESOLUTION.json",
    "fixtures/connected-fixture105/DERIVATION-EXPECTED.json",
    "fixtures/connected-fixture105/DIRECTION-EXPECTED.json",
    "fixtures/connected-fixture105/EVENT-ROWS.json",
    "fixtures/connected-fixture105/EVIDENCE-ROWS.json",
    "fixtures/connected-fixture105/FIVE-MATCH-INPUTS.json",
    "fixtures/connected-fixture105/IDENTITIES.json",
    "fixtures/connected-fixture105/INNER-DIGEST-REFUSAL-WITNESSES.json",
    "fixtures/connected-fixture105/INNER-DIGEST-RULES.md",
    "fixtures/connected-fixture105/PACKAGE.json",
    "fixtures/connected-fixture105/PURE-REFUSAL-WITNESSES.json",
    "fixtures/connected-fixture105/RESULT-DIGEST-MAP.json",
    "fixtures/connected-fixture105/RIGHTS.json",
    "fixtures/connected-fixture105/ROSTER.json",
    "fixtures/connected-fixture105/ROW-AND-BYTE-BOUNDS.json",
    "fixtures/connected-fixture105/SCHEMA-HASH-MAPPING.json",
    "fixtures/connected-fixture105/SCHEMA-audit.json",
    "fixtures/connected-fixture105/SCHEMA-construction-observation.json",
    "fixtures/connected-fixture105/SCHEMA-operation.json",
    "fixtures/connected-fixture105/SPOKEN-TEXT.txt",
    "fixtures/connected-fixture105/SQL-COLUMN-MAP.json",
    "fixtures/connected-fixture105/SUBSTANTIVE-SCRIPT.json",
    "fixtures/connected-fixture105/SUPPORT-ROWS.json",
    "fixtures/connected-fixture105/TEMPLATE.json",
    "fixtures/connected-fixture105/TEXTURE-CARRIER.json",
    "fixtures/connected-fixture105/TEXTURE-OWNER-ADDENDUM.md",
    "fixtures/connected-fixture105/TEXTURE-REWRITE.json",
    "fixtures/connected-fixture105/TEXTURE-SCRIPT.json",
    "fixtures/connected-fixture105/WRITER-VIEW-EXPECTED.json",
    "package-lock.json",
    "package.json",
    "src/identity/artifacts.ts",
    "src/identity/domains.ts",
    "src/runtime/claims-writing-gate.ts",
    "src/runtime/connected-fixture105-data.ts",
    "src/runtime/connected-fixture105.ts",
    "src/runtime/package.ts",
    "src/runtime/performance-direction-fixture105.ts",
    "src/runtime/performance-direction.ts",
    "src/runtime/speech-texture.ts",
    "test/integration/connected-fixture105.test.ts",
    "test/support/p33-parity-runner.ts",
    "test/unit/connected-fixture105.test.ts",
    "tools/ci-validation/ci.py",
    "tools/ci-validation/run-stage.sh",
    "tools/ci-validation/test_ci.py",
    "tsconfig.build.json",
    "tsconfig.json",
    "vitest.config.ts",
  ];
  if (
    canonicalJson(rows.map((row) => row.path)) !== canonicalJson(expectedPaths)
  )
    throw new ConnectedFixture105Refusal("fixture_ledger_paths");
  const seen = new Set<string>();
  for (const row of rows) {
    if (
      !exactKeys(row, ["path", "bytes", "sha256"]) ||
      typeof row.path !== "string" ||
      (!/^(?:src|test|fixtures|docs|migrations)\/[A-Za-z0-9_./-]+$/u.test(
        row.path,
      ) &&
        ![
          "package.json",
          "package-lock.json",
          "tsconfig.json",
          "tsconfig.build.json",
          "eslint.config.js",
          "vitest.config.ts",
          "tools/ci-validation/ci.py",
          "tools/ci-validation/test_ci.py",
          "tools/ci-validation/run-stage.sh",
        ].includes(row.path)) ||
      row.path
        .split("/")
        .some((part) => part === ".." || part === "." || part === "") ||
      /(?:RELEASE|ADOPTION|SOURCE-LEDGER)\.json$/u.test(row.path) ||
      seen.has(row.path) ||
      !Number.isSafeInteger(row.bytes) ||
      typeof row.sha256 !== "string" ||
      !HASH.test(row.sha256)
    )
      throw new ConnectedFixture105Refusal("fixture_ledger_row");
    seen.add(row.path);
    const path = fileURLToPath(new URL(`../../${row.path}`, import.meta.url));
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const before = fstatSync(fd);
      if (
        !before.isFile() ||
        before.size !== row.bytes ||
        before.size > 1048576
      )
        throw new ConnectedFixture105Refusal("fixture_source_identity");
      const bytes = readFileSync(fd);
      const after = fstatSync(fd);
      if (
        bytes.length !== before.size ||
        before.ino !== after.ino ||
        before.dev !== after.dev ||
        before.mtimeMs !== after.mtimeMs ||
        sha256(bytes) !== row.sha256
      )
        throw new ConnectedFixture105Refusal("fixture_source_identity");
    } finally {
      closeSync(fd);
    }
  }
  if (
    release.fixture_manifest_sha256 !== connectedFixture105ResourceIdentity() ||
    release.contract_sha256 !==
      rows.find((row) => row.path === "docs/connected-fixture105.md")?.sha256
  )
    throw new ConnectedFixture105Refusal("fixture_release_source_link");
  const execution = fixtureExecutionRoot(fixtureCheckout);
  return frozen({
    release,
    digest: sha256(releaseBytes),
    ledgerDigest: sha256(ledgerBytes),
    subject: fixedSubject(),
    rootHash: execution.rootHash,
    root: execution.root,
  });
}

type TargetIdentity = Readonly<{
  database: string;
  database_oid: string;
  login: string;
  server_address: string | null;
  server_port: number | null;
}>;
const TARGET_SQL = `SELECT current_database() AS database, (SELECT oid::text FROM pg_database WHERE datname = current_database()) AS database_oid,
 session_user AS login, inet_server_addr()::text AS server_address, inet_server_port() AS server_port,
 current_user = 'desk_runtime' AS runtime_role,
 (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls FROM pg_roles WHERE rolname = session_user) AS elevated,
 (SELECT count(*)::integer FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()) AS other_sessions`;
function queryProjection(table: string): string {
  const spec = connectedFixture105Data().sql.find((s) => s.table === table);
  if (spec === undefined || typeof spec.primary_key !== "string")
    throw new ConnectedFixture105Refusal("fixture_sql_table");
  const columns = objects(spec.columns).map((column) => {
    const name = String(column.column);
    if (!/^[a-z_]+$/u.test(name))
      throw new ConnectedFixture105Refusal("fixture_sql_identifier");
    return column.sql_type === "timestamptz"
      ? `to_char(${name} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS ${name}`
      : name;
  });
  // Fixed pinned table/column identities; never caller SQL or a caller schema.
  if (!/^[a-z_]+$/u.test(table) || !/^[a-z_]+$/u.test(spec.primary_key))
    throw new ConnectedFixture105Refusal("fixture_sql_identifier");
  return `SELECT ${columns.join(", ")} FROM ${table}${table === "artifacts" ? " WHERE artifact_id = $1::uuid" : ""} ORDER BY ${spec.primary_key} LIMIT 129`;
}
async function readCut(
  db: Pick<Tx, "query">,
): Promise<Fixture105RowEnvelope[]> {
  const rows: Fixture105RowEnvelope[] = [];
  for (const table of OBSERVATION_TABLES) {
    const params =
      table === "artifacts"
        ? [obj(connectedFixture105Data().identities.ids)["package-artifact"]]
        : [];
    const found = await db.query(queryProjection(table), params);
    if (found.rows.length >= 129)
      throw new ConnectedFixture105Refusal("fixture_row_bound");
    rows.push(...found.rows.map((row) => connectedFixture105Row(table, row)));
  }
  return rows;
}
function expectedCut(): Fixture105RowEnvelope[] {
  const fixed = connectedFixture105Data();
  return OBSERVATION_TABLES.flatMap((table) =>
    (fixed.tables[table] ?? [])
      .filter(
        (row) =>
          table !== "artifacts" ||
          row.artifact_id === obj(fixed.identities.ids)["package-artifact"],
      )
      .map((row) => connectedFixture105Row(table, row))
      .sort((a, b) =>
        a.primary_key < b.primary_key
          ? -1
          : a.primary_key > b.primary_key
            ? 1
            : 0,
      ),
  );
}
async function insertFixedTable(
  tx: Tx,
  table: string,
  rows: readonly Obj[],
): Promise<void> {
  const fixed = connectedFixture105Data();
  const spec = fixed.sql.find((s) => s.table === table);
  if (spec === undefined)
    throw new ConnectedFixture105Refusal("fixture_sql_table");
  const columns = objects(spec.columns);
  for (const row of rows) {
    connectedFixture105Row(table, row);
    const values = columns.map((c) =>
      c.sql_type === "jsonb"
        ? canonicalJson(row[String(c.column)])
        : row[String(c.column)],
    );
    const parameters = columns.map(
      (c, index) =>
        `$${String(index + 1)}${c.sql_type === "jsonb" ? "::jsonb" : ""}`,
    );
    await tx.query(
      `INSERT INTO ${table} (${columns.map((c) => String(c.column)).join(", ")}) VALUES (${parameters.join(", ")})`,
      values,
    );
  }
}
function fixedOwnerId(
  label:
    | "observation"
    | "construction-receipt"
    | "operation"
    | "audit"
    | "audit-run",
): string {
  const digest = sha256(
    Buffer.from(`connected-fixture105-storage/1\n${label}`, "utf8"),
  );
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}
function resultId(position: number): string {
  const digest = sha256(
    Buffer.from(`connected-fixture105-result/1\n${String(position)}`, "utf8"),
  );
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}
function claimsFingerprint(): string {
  const subject = fixedSubject();
  return fingerprint("claims_writing", {
    package_hash: subject.package_hash,
    brief_hash: subject.brief_hash,
    script_hash: subject.final_script_hash,
    claims_policy_version: subject.claims_policy_version,
    writing_policy_version: subject.writing_policy_version,
    gate_set_version: subject.gate_set_version,
  });
}
function performanceFingerprint(): string {
  const subject = fixedSubject();
  return fingerprint("performance", {
    script_hash: subject.final_script_hash,
    performance_direction_hash:
      connectedFixture105Data().identities.performance_direction_hash,
    performance_policy_version: subject.performance_policy_version,
    gate_set_version: subject.gate_set_version,
  });
}
function claimsSqlRows(result: ComponentEvaluation): Obj[] {
  connectedFixture105ClaimsResultHash(result);
  const f = connectedFixture105Data();
  const ids = obj(f.identities.ids);
  return result.rows.map((row, index) => ({
    gate_result_id: resultId(index + 1),
    gate_definition_id: connectedFixture105Id(
      `definition:${String(index + 1)}`,
    ),
    attempt_id: ids.attempt,
    input_fingerprint: claimsFingerprint(),
    outcome: row.findings.length === 0 ? "pass" : "fail",
    result: {
      actor_id: ids.actor,
      actor_kind: "policy",
      check: row.key,
      facts: row.facts,
      findings: row.findings,
      fingerprint_stage: "claims_writing",
      schema: "connected-fixture105-claims-result/1",
      subject_refs: [f.identities["texture-version"]],
    },
    created_at: f.identities.authored_fiction_time,
  }));
}
function performanceSqlRows(
  result: PerformanceEvaluation,
): Record<string, Obj[]> {
  connectedFixture105PerformanceResultHash(result);
  const f = connectedFixture105Data();
  const ids = obj(f.identities.ids);
  const payload = obj(f.direction.payload);
  const intent = objects(payload.performance_intents)[0];
  if (intent === undefined)
    throw new ConnectedFixture105Refusal("fixture_intent_missing");
  const directionPayload = {
    ...payload,
    direction_hash: f.direction.content_hash,
  };
  return {
    artifacts: [
      {
        artifact_id: f.identities["direction-artifact"],
        artifact_type: "performance_direction",
        schema_version: "performance-direction/1",
        content_hash: f.direction.content_hash,
        canonical_payload: directionPayload,
        storage_uri: null,
        byte_size: Buffer.byteLength(canonicalJson(directionPayload)),
        parent_artifact_id: null,
        supersedes_artifact_id: null,
        created_at: f.identities.authored_fiction_time,
      },
    ],
    performance_direction_versions: [
      {
        performance_direction_version_id: f.identities["direction-version"],
        script_version_id: f.identities["texture-version"],
        artifact_id: f.identities["direction-artifact"],
      },
    ],
    performance_intents: [
      {
        performance_intent_id: f.identities.intent,
        performance_direction_version_id: f.identities["direction-version"],
        turn_id: intent.scope_ref,
        intent,
      },
    ],
    gate_results: result.rows.map((row, index) => ({
      gate_result_id: resultId(19 + index),
      gate_definition_id: row.gate_definition_id,
      attempt_id: ids.attempt,
      input_fingerprint: performanceFingerprint(),
      outcome: row.outcome,
      result: row.result,
      created_at: f.identities.authored_fiction_time,
    })),
  };
}
function ownedEnvelopes(
  rows: Readonly<Record<string, readonly Obj[]>>,
): Fixture105RowEnvelope[] {
  return OWNED_TABLES.flatMap((table) =>
    (rows[table] ?? [])
      .map((row) => connectedFixture105Row(table, row))
      .sort((a, b) =>
        a.primary_key < b.primary_key
          ? -1
          : a.primary_key > b.primary_key
            ? 1
            : 0,
      ),
  );
}
async function readWhole(tx: Pick<Tx, "query">, table: string): Promise<Obj[]> {
  // Full fixed table population including unexpected rows. Package-only artifact
  // filtering belongs solely to the separately defined construction cut.
  const sql = queryProjection(table).replace(
    " WHERE artifact_id = $1::uuid",
    "",
  );
  const result = await tx.query(sql);
  if (result.rows.length >= 129)
    throw new ConnectedFixture105Refusal("fixture_row_bound");
  return result.rows.map((row) =>
    obj(
      JSON.parse(connectedFixture105Row(table, row).canonical_row) as unknown,
    ),
  );
}
function exactRows(
  table: string,
  actual: readonly Obj[],
  expected: readonly Obj[],
): void {
  const canonical = (rows: readonly Obj[]) =>
    rows
      .map((row) => connectedFixture105Row(table, row))
      .sort((a, b) =>
        a.primary_key < b.primary_key
          ? -1
          : a.primary_key > b.primary_key
            ? 1
            : 0,
      );
  if (canonicalJson(canonical(actual)) !== canonicalJson(canonical(expected)))
    throw new ConnectedFixture105Refusal("fixture_owned_conflict");
}
interface FixtureSuiteTarget {
  target_hash: string;
  construction_state:
    | "intent"
    | "construction_recorded"
    | "refused_before_receipt"
    | "construction_unknown";
  later_phase: "construction" | "claims" | "direction" | "audit" | "readback";
  later_outcome: "started" | "completed" | "refused" | "unknown";
}
const FIXTURE_SUITE_TARGETS: FixtureSuiteTarget[] = [];
const FIXTURE_PRE_TARGET_FAILURES: string[] = [];
const FIXTURE_TOOL_OBSERVATIONS: FixtureRootObject[] = [];
/** Observed records only, captured by the native harness after its assertions/cleanup. */
export function connectedFixture105SuiteEvidence(): Readonly<Obj> {
  return frozen({
    schema: "fixture105-suite/1",
    targets: FIXTURE_SUITE_TARGETS.map((row) => ({ ...row })),
    pre_target_failures: [...FIXTURE_PRE_TARGET_FAILURES],
    tool_observations: [...FIXTURE_TOOL_OBSERVATIONS],
  });
}
function targetHash(target: TargetIdentity): string {
  return sha256(Buffer.from(canonicalJson(target), "utf8"));
}
function journalWrite(root: string, name: string, value: Obj): Buffer {
  fixtureIdentity(root, true);
  if (
    !/^(?:[0-9a-f]{64}\.(?:intent|terminal|claims-failure)\.json|CONSTRUCTION\.json|CLAIMS-FAILURE\.json)$/u.test(
      name,
    )
  )
    throw new ConnectedFixture105Refusal("fixture_journal_name");
  const bytes = Buffer.from(canonicalJson(value) + "\n");
  if (bytes.length > (name === "CLAIMS-FAILURE.json" ? 262144 : 16384))
    throw new ConnectedFixture105Refusal("fixture_journal_bound");
  const directory = fixtureOpen(root, true);
  try {
    const fd = openSync(
      `/proc/self/fd/${String(directory)}/${name}`,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      writeFileSync(fd, bytes);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    fsyncSync(directory);
  } finally {
    closeSync(directory);
  }
  return bytes;
}
function journalIntent(binding: ReleaseBinding, target: TargetIdentity): void {
  journalWrite(
    `${binding.root}/expectations`,
    `${targetHash(target)}.intent.json`,
    {
      schema: "fixture105-receipt-intent/1",
      target_hash: targetHash(target),
      release_sha256: binding.digest,
      subject_sha256: sha256(Buffer.from(canonicalJson(binding.subject))),
      expected_names: ["CONSTRUCTION.json"],
      state: "intent",
    },
  );
}
function journalTerminal(
  binding: ReleaseBinding,
  target: TargetIdentity,
  state: "construction_recorded" | "refused_before_receipt",
  receipt?: Buffer,
  code?: string,
): void {
  const hash = targetHash(target);
  const intent = fixtureRead(
    `${binding.root}/expectations/${hash}.intent.json`,
    16384,
  );
  journalWrite(`${binding.root}/expectations`, `${hash}.terminal.json`, {
    schema: "fixture105-receipt-terminal/1",
    target_hash: hash,
    intent_sha256: sha256(intent),
    state,
    receipts:
      receipt === undefined
        ? []
        : [
            {
              name: "CONSTRUCTION.json",
              bytes: receipt.length,
              sha256: sha256(receipt),
            },
          ],
    ...(state === "refused_before_receipt" ? { code } : {}),
  });
}
function journalReadback(
  binding: ReleaseBinding,
  target: TargetIdentity,
  receipt: Buffer,
): void {
  const hash = targetHash(target);
  const intent = fixtureRead(
    `${binding.root}/expectations/${hash}.intent.json`,
    16384,
  );
  const decoded = jsonBytes(intent);
  fixtureSame(decoded, {
    schema: "fixture105-receipt-intent/1",
    target_hash: hash,
    release_sha256: binding.digest,
    subject_sha256: sha256(Buffer.from(canonicalJson(binding.subject))),
    expected_names: ["CONSTRUCTION.json"],
    state: "intent",
  });
  fixtureSame(
    jsonBytes(
      fixtureRead(`${binding.root}/expectations/${hash}.terminal.json`, 16384),
    ),
    {
      schema: "fixture105-receipt-terminal/1",
      target_hash: hash,
      intent_sha256: sha256(intent),
      state: "construction_recorded",
      receipts: [
        {
          name: "CONSTRUCTION.json",
          bytes: receipt.length,
          sha256: sha256(receipt),
        },
      ],
    },
  );
}

function receiptRoot(target: TargetIdentity): string {
  const namespace = sha256(Buffer.from(canonicalJson(target), "utf8"));
  return `${validateConnectedFixture105ExecutionRoot()}/receipts/${namespace}`;
}
function receiptPath(target: TargetIdentity): string {
  return `${receiptRoot(target)}/CONSTRUCTION.json`;
}
function saveConstructionReceipt(
  binding: ReleaseBinding,
  observation: { payload: Obj; digest: string },
  target: TargetIdentity,
  chronology: readonly Obj[],
): void {
  const parent = `${validateConnectedFixture105ExecutionRoot()}/receipts`;
  const directory = fixtureOpen(parent, true);
  try {
    mkdirSync(`/proc/self/fd/${String(directory)}/${targetHash(target)}`, {
      mode: 0o700,
    });
    fsyncSync(directory);
  } finally {
    closeSync(directory);
  }
  const bytes = journalWrite(receiptRoot(target), "CONSTRUCTION.json", {
    schema: "fixture105-settled-construction-receipt/1",
    receipt_id: fixedOwnerId("construction-receipt"),
    release_sha256: binding.digest,
    subject: binding.subject,
    observation_sha256: observation.digest,
    target,
    commit_acknowledged: true,
    client_released: true,
    owned_pool_idle: true,
    chronology,
  });
  journalTerminal(binding, target, "construction_recorded", bytes);
}
function constructionReceiptUnchecked(
  binding: ReleaseBinding,
  observationDigest: string,
  target: TargetIdentity,
): void {
  fixtureIdentity(receiptRoot(target), true);
  const bytes = fixtureRead(receiptPath(target), 16384);
  {
    journalReadback(binding, target, bytes);
    const recorded = jsonBytes(bytes);
    const chronology = objects(recorded.chronology);
    const phases = [
      "absence",
      "insert",
      "capture",
      "freeze",
      "persist",
      "compare",
      "observation_insert_readback",
      "commit_release_settled",
    ];
    if (
      chronology.length !== phases.length ||
      chronology.some(
        (event, index) =>
          !exactKeys(event, ["phase", "elapsed_ns", "at_utc"]) ||
          event.phase !== phases[index] ||
          typeof event.elapsed_ns !== "string" ||
          !/^[0-9]+$/u.test(event.elapsed_ns) ||
          typeof event.at_utc !== "string" ||
          !Number.isFinite(Date.parse(event.at_utc)),
      )
    )
      throw new ConnectedFixture105Refusal("fixture_receipt_chronology");
    for (let index = 1; index < chronology.length; index++)
      if (
        BigInt(String(chronology[index]?.elapsed_ns)) <
        BigInt(String(chronology[index - 1]?.elapsed_ns))
      )
        throw new ConnectedFixture105Refusal("fixture_receipt_chronology");
    const expected = {
      schema: "fixture105-settled-construction-receipt/1",
      receipt_id: fixedOwnerId("construction-receipt"),
      release_sha256: binding.digest,
      subject: binding.subject,
      observation_sha256: observationDigest,
      target,
      commit_acknowledged: true,
      client_released: true,
      owned_pool_idle: true,
      chronology,
    };
    if (bytes.toString("utf8") !== canonicalJson(expected) + "\n")
      throw new ConnectedFixture105Refusal("fixture_construction_receipt");
  }
}
function constructionReceipt(
  binding: ReleaseBinding,
  observationDigest: string,
  target: TargetIdentity,
): void {
  try {
    constructionReceiptUnchecked(binding, observationDigest, target);
  } catch (error) {
    if (error instanceof ConnectedFixture105Refusal) throw error;
    throw new ConnectedFixture105Refusal(
      "fixture_construction_receipt_unavailable",
    );
  }
}
function definitionRows(): Obj[] {
  return [...GATE_DEFINITION_KEYS, ...PERFORMANCE_DEFINITION_KEYS].map(
    (key, index) => ({
      gate_definition_id: connectedFixture105Id(
        `definition:${String(index + 1)}`,
      ),
      gate_name: key,
      version: "build2-connected-fixture105-gates/1",
      definition: {
        profile: "connected-evaluation-fixture105/1",
        position: index + 1,
        check: key,
        claims_policy_version: "claims-0.1.2",
        writing_policy_version: "writing-0.2.3",
        performance_policy_version: "performance-render-0.1.4",
        rule:
          index === 20
            ? {
                version: "fixture105-normal-pace/1",
                entries: [
                  [
                    "normal_post_event",
                    "turn",
                    "pace",
                    "slower",
                    "light",
                    null,
                  ],
                ],
              }
            : null,
      },
    }),
  );
}
function componentFromRows(
  tables: Readonly<Record<string, readonly Obj[]>>,
): ComponentInputs {
  const f = connectedFixture105Data();
  const artifact = (id: unknown): Obj => {
    const row = tables.artifacts?.find((item) => item.artifact_id === id);
    if (row === undefined)
      throw new ConnectedFixture105Refusal("fixture_artifact_missing");
    return obj(row.canonical_payload);
  };
  const child = artifact(f.identities["texture-artifact"]);
  const parent = artifact(f.identities["substantive-artifact"]);
  const turns = (tables.turns ?? []).filter(
    (row) => row.script_version_id === f.identities["texture-version"],
  );
  const ids = new Set(turns.map((row) => row.turn_id));
  const version = tables.script_versions?.find(
    (row) => row.script_version_id === f.identities["texture-version"],
  );
  if (version === undefined)
    throw new ConnectedFixture105Refusal("fixture_script_missing");
  return {
    C: child,
    K: parent,
    rows: {
      version,
      turns,
      claim_uses: (tables.turn_claim_uses ?? []).filter((row) =>
        ids.has(row.turn_id),
      ),
      evidence_uses: (tables.turn_evidence_uses ?? []).filter((row) =>
        ids.has(row.turn_id),
      ),
    },
    pkg: obj(artifact(obj(f.identities.ids)["package-artifact"]).manifest),
    brief: artifact(obj(f.identities.ids)["brief-artifact"]),
    writer: f.writer,
    context: f.context,
    facts: {
      claims: tables.claims ?? [],
      supports: tables.claim_supports ?? [],
      events: tables.claim_state_events ?? [],
      derivation: tables.derivation_runs?.[0],
      carriers: (tables.artifacts ?? []).filter((row) =>
        (f.tables.artifacts ?? []).some(
          (fixed) => fixed.artifact_id === row.artifact_id,
        ),
      ),
      rights: tables.rights_versions ?? [],
      evidence: tables.evidence_units ?? [],
      pronunciations: [],
      renderings: [],
    },
    statics: {
      profiles: f.roster,
      template: f.template,
      modes: { values: [{ id: "normal_post_event" }] },
      block_types: {
        values: objects(f.template.slots).map((slot) => ({
          id: slot.block_type,
        })),
      },
    },
    originals: [],
    rewrites: f.rewrites,
    parent_artifact_hash: String(parent.script_hash),
  };
}
function performanceFacts(input: ComponentInputs): Obj {
  const f = connectedFixture105Data();
  const sourcePayload = obj(f.direction.payload);
  const intents = objects(sourcePayload.performance_intents);
  const payload: Obj = {
    ...sourcePayload,
    performance_intents: intents,
    direction_hash: f.direction.content_hash,
  };
  const intent = intents[0];
  if (intent === undefined)
    throw new ConnectedFixture105Refusal("fixture_intent_missing");
  const candidate = validateDirectionCandidate(f.direction.payload, {
    script_hash: String(input.C.script_hash),
    turns: objects(input.C.turns).map((turn) => ({
      turn_id: String(turn.turn_id),
      semantic_turn_id: String(turn.semantic_turn_id),
    })),
  });
  if (candidate.kind === "refused")
    throw new ConnectedFixture105Refusal(candidate.code);
  return {
    pins: {
      script_version_id: f.identities["texture-version"],
      script_hash: input.C.script_hash,
    },
    payload,
    artifact: { content_hash: f.direction.content_hash },
    version_rows: [
      {
        performance_direction_version_id: f.identities["direction-version"],
        script_version_id: f.identities["texture-version"],
      },
    ],
    intent_rows: [{ turn_id: intent.scope_ref, intent }],
    script: {
      recomputed_hash: scriptHash(input.C, { brief: input.brief }),
      turns: objects(input.C.turns).map((turn) => ({
        ...turn,
        text: turn.spoken_text,
      })),
      claim_uses: input.C.turn_claim_uses,
      evidence_uses: input.C.turn_evidence_uses,
    },
    sensitivities: [],
    mode: "normal_post_event",
  };
}
interface SettledEvaluation {
  readonly input: ComponentInputs;
  readonly claims: ComponentEvaluation;
  readonly performance: PerformanceEvaluation;
  readonly observation: Obj;
  readonly observationDigest: string;
}
interface FixtureContinuation105 {
  readonly kind: "connected-fixture105-continuation/1";
  readonly genuine_semantic_admission: false;
}
export interface ConnectedFixture105Result {
  readonly status: "created" | "reconciled";
  readonly operation_id: string;
  readonly operation_sha256: string;
  readonly claims: ComponentEvaluation;
  readonly performance: PerformanceEvaluation;
  readonly audit: Obj;
  readonly genuine_semantic_admission: false;
  readonly render_allowed: false;
}
export type ConnectedFixture105Reconciliation = Omit<
  ConnectedFixture105Result,
  "status" | "audit"
> & {
  readonly status: "reconciled" | "direction_durable_audit_absent";
  readonly audit: Obj | null;
};
async function insertOwnedArtifact(
  tx: Tx,
  id: string,
  profile: string,
  payload: Obj,
  digest: string,
): Promise<void> {
  const canonical = canonicalJson(payload);
  const artifactType = fixtureArtifactType(profile);
  await tx.query(
    `INSERT INTO artifacts (artifact_id,artifact_type,schema_version,content_hash,canonical_payload,storage_uri,byte_size,created_at) VALUES ($1,$2,$3,$4,$5::jsonb,NULL,$6,$7)`,
    [
      id,
      artifactType,
      profile,
      digest,
      canonical,
      Buffer.byteLength(canonical),
      connectedFixture105Data().identities.authored_fiction_time,
    ],
  );
  const found = await tx.query(
    `SELECT artifact_id::text, artifact_type, schema_version, content_hash, canonical_payload, storage_uri, byte_size FROM artifacts WHERE artifact_id=$1`,
    [id],
  );
  const expected = {
    artifact_id: id,
    artifact_type: artifactType,
    schema_version: profile,
    content_hash: digest,
    canonical_payload: payload,
    storage_uri: null,
    byte_size: Buffer.byteLength(canonical),
  };
  const row = found.rows[0];
  if (
    found.rows.length !== 1 ||
    row === undefined ||
    canonicalJson({ ...row, byte_size: Number(row.byte_size) }) !==
      canonicalJson(expected)
  )
    throw new ConnectedFixture105Refusal("fixture_artifact_readback");
}
function fixtureArtifactType(profile: string): string {
  switch (profile) {
    case "fixture105-construction-observation/1":
      return "fixture_construction_observation";
    case "fixture105-operation/1":
      return "fixture_operation";
    case "connected-fixture105-audit-stub/1":
      return "fixture_audit";
    default:
      throw new ConnectedFixture105Refusal("fixture_artifact_profile");
  }
}
function ownedArtifactRow(
  id: string,
  profile: string,
  payload: Obj,
  digest: string,
): Obj {
  return {
    artifact_id: id,
    artifact_type: fixtureArtifactType(profile),
    schema_version: profile,
    content_hash: digest,
    canonical_payload: payload,
    storage_uri: null,
    byte_size: Buffer.byteLength(canonicalJson(payload)),
    parent_artifact_id: null,
    supersedes_artifact_id: null,
    created_at: connectedFixture105Data().identities.authored_fiction_time,
  };
}
/** Host-owned context and pool. No exported pool, target object, or caller release. */
class Connected105Session {
  private readonly pool: pg.Pool;
  private target: TargetIdentity | undefined;
  private closed = false;
  private stopped = false;
  private connectionError = false;
  private readonly environment: string;
  private activeTx: Tx | undefined;
  private readonly constructionChronology: Obj[] = [];
  private readonly started = process.hrtime.bigint();
  private suiteTarget: FixtureSuiteTarget | undefined;
  private constructionPhase(phase: string): void {
    this.constructionChronology.push({
      phase,
      elapsed_ns: String(process.hrtime.bigint() - this.started),
      at_utc: new Date().toISOString(),
    });
  }
  constructor(
    private readonly config: Config,
    private readonly binding: ReleaseBinding,
  ) {
    this.environment = canonicalJson({
      DESK_ENV: config.DESK_ENV,
      PROVIDERS_ENABLED: config.PROVIDERS_ENABLED,
      DATABASE_URL: config.DATABASE_URL,
      DEPLOYED_COMMIT: config.DEPLOYED_COMMIT,
    });
    this.pool = new pg.Pool({
      connectionString: config.DATABASE_URL,
      options: "-c role=desk_runtime",
      application_name: "the-desk-connected-fixture105",
      max: 1,
      connectionTimeoutMillis: 10000,
      query_timeout: 20000,
      statement_timeout: 20000,
      idle_in_transaction_session_timeout: 30000,
    });
    this.pool.on("error", () => {
      this.connectionError = true;
    });
  }
  private current(): void {
    if (this.closed || this.stopped || this.connectionError)
      throw new ConnectedFixture105Refusal("fixture_host_closed");
    try {
      let current: Config;
      try {
        current = loadConfig();
      } catch {
        throw new ConnectedFixture105Refusal("fixture_context_changed");
      }
      if (
        current.DESK_ENV !== "test" ||
        current.PROVIDERS_ENABLED ||
        canonicalJson({
          DESK_ENV: current.DESK_ENV,
          PROVIDERS_ENABLED: current.PROVIDERS_ENABLED,
          DATABASE_URL: current.DATABASE_URL,
          DEPLOYED_COMMIT: current.DEPLOYED_COMMIT,
        }) !== this.environment
      )
        throw new ConnectedFixture105Refusal("fixture_context_changed");
      const now = readRelease();
      const observed = fixtureExecutionRoot(fixtureCheckout);
      FIXTURE_TOOL_OBSERVATIONS.push({
        root_sha256: observed.rootHash,
        temp: observed.temp,
      });
      if (FIXTURE_TOOL_OBSERVATIONS.length > 4096)
        throw new ConnectedFixture105Refusal("fixture_tool_observation_bound");
      if (
        now.digest !== this.binding.digest ||
        now.rootHash !== this.binding.rootHash ||
        now.root !== this.binding.root
      )
        throw new ConnectedFixture105Refusal("fixture_release_changed");
    } catch (error) {
      this.stopped = true;
      throw error;
    }
  }
  assertBorrow(tx: Tx, releaseDigest: string): void {
    try {
      this.current();
      if (this.activeTx !== tx || releaseDigest !== this.binding.digest)
        throw new ConnectedFixture105Refusal("fixture_package_transaction");
    } catch (error) {
      this.stopped = true;
      throw error;
    }
  }
  invalidateBorrow(): void {
    this.stopped = true;
  }
  private transactionUncertain = false;
  /** Only this host's three fixed historical owner calls use this private boundary.
   * A returned owner outcome acknowledges its command completion. A thrown owner
   * failure supplies no such acknowledgement: preserve uncertainty and the exact
   * primary object/cleanup diagnostics, rather than borrowing an earlier cut.
   */
  private async directOwnerMutation<T>(invoke: () => Promise<T>): Promise<T> {
    this.current();
    this.transactionUncertain = true;
    const outcome = await invoke();
    this.transactionUncertain = false;
    return outcome;
  }
  private async transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    this.current();
    if (this.activeTx !== undefined)
      throw new ConnectedFixture105Refusal("fixture_nested_transaction");
    this.transactionUncertain = true;
    const workState: { failed: boolean; failure: unknown } = {
      failed: false,
      failure: undefined,
    };
    let outcome: Outcome<T>;
    try {
      outcome = await runCommand<T>(
        this.pool,
        async (tx): Promise<Outcome<T>> => {
          this.activeTx = tx;
          try {
            await tx.query("SELECT pg_advisory_xact_lock(105, 1)");
            await this.targetOn(tx);
            const record = await work(tx);
            this.current();
            return { kind: "created", record };
          } catch (error) {
            workState.failed = true;
            workState.failure = error;
            throw error;
          } finally {
            this.activeTx = undefined;
          }
        },
      );
    } catch (error) {
      // runCommand preserves the work failure and attaches any failed rollback/release.
      // A COMMIT attempt cannot follow a throwing work callback. No trace label is invented.
      if (
        workState.failed &&
        error === workState.failure &&
        !(error instanceof CommandConnectionError) &&
        commandCleanupErrors(error).length === 0
      )
        this.transactionUncertain = false;
      throw error;
    }
    this.transactionUncertain = false;
    if (outcome.kind !== "created")
      throw new ConnectedFixture105OwnerRefusal("transaction", outcome);
    if (
      this.pool.totalCount !== 1 ||
      this.pool.idleCount !== 1 ||
      this.pool.waitingCount !== 0 ||
      this.connectionError
    )
      throw new ConnectedFixture105Refusal("fixture_transaction_unsettled");
    this.current();
    return outcome.record;
  }
  private async targetOn(client: Pick<Tx, "query">): Promise<void> {
    const result = await client.query(TARGET_SQL);
    const row = result.rows[0];
    const database = decodeURIComponent(
      new URL(this.config.DATABASE_URL).pathname.slice(1),
    );
    if (
      result.rows.length !== 1 ||
      row?.database !== database ||
      row.runtime_role !== true ||
      row.elevated !== false ||
      row.other_sessions !== 0 ||
      typeof row.database_oid !== "string" ||
      typeof row.login !== "string" ||
      typeof row.database !== "string" ||
      !(
        row.server_address === null || typeof row.server_address === "string"
      ) ||
      !(row.server_port === null || typeof row.server_port === "number")
    )
      throw new ConnectedFixture105Refusal("fixture_target_isolation");
    const target = {
      database: row.database,
      database_oid: row.database_oid,
      login: row.login,
      server_address: row.server_address,
      server_port: row.server_port,
    };
    if (
      this.target !== undefined &&
      canonicalJson(this.target) !== canonicalJson(target)
    )
      throw new ConnectedFixture105Refusal("fixture_target_changed");
    this.target = frozen(target);
  }
  private async persistPackage(tx: Tx): Promise<void> {
    const capability = Object.freeze({});
    const borrow: PackageBorrow = {
      owner: this,
      tx,
      releaseDigest: this.binding.digest,
      live: true,
      taken: false,
    };
    PACKAGE_BORROWS.set(capability, borrow);
    try {
      const outcome = await persistConnectedFixture105Package(capability);
      this.current();
      const fixed = connectedFixture105Data();
      const ids = obj(fixed.identities.ids);
      if (outcome.kind !== "created")
        throw new ConnectedFixture105OwnerRefusal("package", outcome);
      if (
        outcome.record.reused ||
        outcome.record.completed_existing_artifact ||
        outcome.record.artifact_id !== ids["package-artifact"] ||
        outcome.record.evidence_package_id !== ids.package ||
        outcome.record.package_hash !== fixed.identities.package_hash
      )
        throw new ConnectedFixture105Refusal("fixture_package_not_fresh");
    } finally {
      borrow.live = false;
      PACKAGE_BORROWS.delete(capability);
    }
  }
  private async constructPackage(): Promise<{ payload: Obj; digest: string }> {
    const constructed = await this.transaction(async (tx) => {
      // Complete populations, not a filtered list of expected UUIDs.
      for (const table of OBSERVATION_TABLES) {
        const found = await tx.query(
          `SELECT 1 AS present FROM ${table} LIMIT 1`,
        );
        if (found.rows.length !== 0)
          throw new ConnectedFixture105Refusal("fixture_initial_population");
      }
      this.constructionPhase("absence");
      const fixed = connectedFixture105Data();
      for (const table of [
        "rights_versions",
        "evidence_units",
        "claims",
        "claim_state_events",
        "derivation_runs",
        "claim_supports",
      ])
        await insertFixedTable(tx, table, fixed.tables[table] ?? []);
      this.constructionPhase("insert");
      const captured = await readCut(tx);
      const beforePackage = expectedCut().filter(
        (row) => row.table !== "evidence_packages" && row.table !== "artifacts",
      );
      validateConnectedFixture105Rows("observation", captured, beforePackage);
      this.constructionPhase("capture");
      const observedRights = captured
        .filter((row) => row.table === "rights_versions")
        .map((row) => obj(JSON.parse(row.canonical_row) as unknown));
      if (
        canonicalJson(observedRights) !==
        canonicalJson(fixed.tables.rights_versions)
      )
        throw new ConnectedFixture105Refusal("fixture_rights_changed");
      const ceilings: Record<string, UsageClass> = {};
      for (const row of fixed.ceilings) {
        if (
          typeof row.claim_id !== "string" ||
          (row.frozen_ceiling !== "assertable" &&
            row.frozen_ceiling !== "hedged_only" &&
            row.frozen_ceiling !== "silent")
        )
          throw new ConnectedFixture105Refusal("fixture_ceiling");
        ceilings[row.claim_id] = row.frozen_ceiling;
      }
      const frozenClaims = await freezeClaims(
        tx,
        Object.keys(ceilings),
        ceilings,
      );
      const plannedClaims = objects(obj(fixed.pkg.manifest).claims);
      if (frozenClaims.length !== plannedClaims.length)
        throw new ConnectedFixture105Refusal("fixture_freeze_count");
      for (const claim of frozenClaims) {
        const expected = plannedClaims.find(
          (row) => row.claim_id === claim.claim_id,
        );
        if (
          expected === undefined ||
          Object.entries(claim).some(
            ([key, value]) =>
              canonicalJson(expected[key]) !== canonicalJson(value),
          )
        )
          throw new ConnectedFixture105Refusal("fixture_freeze_mismatch");
      }
      this.constructionPhase("freeze");
      await this.persistPackage(tx);
      this.constructionPhase("persist");
      await faultPoint("fixture105_after_package_before_observation");
      const observed = await readCut(tx);
      const observedDigest = validateConnectedFixture105Rows(
        "observation",
        observed,
        expectedCut(),
      );
      this.constructionPhase("compare");
      const payload: Obj = {
        schema: "fixture105-construction-observation/1",
        record_kind: "actual_owner_observation",
        subject: this.binding.subject,
        release_sha256: this.binding.digest,
        observed_rows: observed,
        observed_rows_sha256: observedDigest,
        ceilings: fixed.ceilings,
        phase_order: [
          "absence",
          "insert",
          "capture",
          "freeze",
          "persist",
          "compare",
        ],
        construction_receipt_id: fixedOwnerId("construction-receipt"),
        historical_visibility_limit: "historical_visibility_unprovable",
        claim: "closed_fixture_construction_only",
      };
      const digest = connectedFixture105ArtifactHash("construction", payload);
      await insertOwnedArtifact(
        tx,
        fixedOwnerId("observation"),
        "fixture105-construction-observation/1",
        payload,
        digest,
      );
      this.constructionPhase("observation_insert_readback");
      return frozen({ payload, digest });
    });
    this.constructionPhase("commit_release_settled");
    return constructed;
  }
  private async initializeSubject(): Promise<void> {
    const f = connectedFixture105Data();
    await this.transaction(async (tx) => {
      for (const table of Object.keys(f.tables)) {
        if (table === "shows" || table === "show_config_versions") {
          // Fixed configuration is installed by test setup, never by runtime.
          const found = await tx.query(queryProjection(table));
          const expected = (f.tables[table] ?? [])
            .map((row) => connectedFixture105Row(table, row))
            .sort((a, b) =>
              a.primary_key < b.primary_key
                ? -1
                : a.primary_key > b.primary_key
                  ? 1
                  : 0,
            );
          if (
            found.rows.length >= 129 ||
            canonicalJson(
              found.rows.map((row) => connectedFixture105Row(table, row)),
            ) !== canonicalJson(expected)
          )
            throw new ConnectedFixture105Refusal("fixture_initial_population");
          continue;
        }
        if (
          (await tx.query(`SELECT 1 AS present FROM ${table} LIMIT 1`)).rows
            .length !== 0
        )
          throw new ConnectedFixture105Refusal("fixture_initial_population");
      }
      for (const table of [
        "gate_results",
        "audit_runs",
        "performance_direction_versions",
        "performance_intents",
        "render_manifests",
        "model_runs",
        "gate_definitions",
      ]) {
        if (
          (await tx.query(`SELECT 1 AS present FROM ${table} LIMIT 1`)).rows
            .length !== 0
        )
          throw new ConnectedFixture105Refusal("fixture_initial_population");
      }
      await insertFixedTable(tx, "accounts", f.tables.accounts ?? []);
    });
    const ids = obj(f.identities.ids);
    const created = String(f.identities.authored_fiction_time);
    this.current();
    const run = await this.directOwnerMutation(() =>
      createProgramRun(this.pool, {
        program_run_id: String(ids.run),
        show_id: String(ids.show),
        purpose: "evaluation",
        created_at: created,
      }),
    );
    if (run.kind !== "created")
      throw new ConnectedFixture105OwnerRefusal("program_run", run);
    this.current();
    const attempt = await this.directOwnerMutation(() =>
      createProgramAttempt(this.pool, {
        attempt_id: String(ids.attempt),
        program_run_id: String(ids.run),
        show_config_version_id: String(ids.config),
        created_at: created,
      }),
    );
    if (attempt.kind !== "created")
      throw new ConnectedFixture105OwnerRefusal("program_attempt", attempt);
    this.current();
  }
  private async installScript(): Promise<void> {
    const f = connectedFixture105Data();
    const ids = obj(f.identities.ids);
    const bound = await this.directOwnerMutation(() =>
      bindPackage(this.pool, {
        attemptId: String(ids.attempt),
        evidencePackageId: String(ids.package),
        expectedUnitIds: (f.tables.evidence_units ?? []).map((row) =>
          String(row.evidence_unit_id),
        ),
      }),
    );
    if (bound.kind !== "created")
      throw new ConnectedFixture105OwnerRefusal("package_binding", bound);
    await this.transaction(async (tx) => {
      await insertFixedTable(
        tx,
        "artifacts",
        (f.tables.artifacts ?? []).filter(
          (row) => row.artifact_id !== ids["package-artifact"],
        ),
      );
      for (const table of [
        "showrunner_brief_versions",
        "program_blocks",
        "script_versions",
        "turns",
        "turn_claim_uses",
        "turn_evidence_uses",
      ])
        await insertFixedTable(tx, table, f.tables[table] ?? []);
      for (const row of definitionRows())
        await tx.query(
          "INSERT INTO gate_definitions (gate_definition_id,gate_name,version,definition) VALUES ($1,$2,$3,$4::jsonb)",
          [
            row.gate_definition_id,
            row.gate_name,
            row.version,
            canonicalJson(row.definition),
          ],
        );
    });
  }
  private async snapshot<T>(
    work: (tx: Pick<Tx, "query">) => Promise<T>,
  ): Promise<T> {
    this.current();
    const client = await this.pool.connect();
    const errors: unknown[] = [];
    let committed = false;
    let output: { value: T } | undefined;
    const retain = (error: unknown): void => {
      if (!errors.includes(error)) errors.push(error);
    };
    const onError = (error: Error): void => {
      this.connectionError = true;
      this.stopped = true;
      retain(error);
      if (errors.length > 1) withCleanup(errors[0], [error]);
    };
    const onEnd = (): void => {
      client.removeListener("error", onError);
    };
    client.on("error", onError);
    client.once("end", onEnd);
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await this.targetOn(client);
      await faultPoint("fixture105_reader_before_work");
      output = { value: await work(client) };
      if (errors.length !== 0) throw errors[0];
      this.current();
      await client.query("COMMIT");
      committed = true;
    } catch (error) {
      retain(error); // Event and catch observations share one chronological ledger.
      if (!committed) {
        try {
          await client.query("ROLLBACK");
        } catch (rollback) {
          this.connectionError = true;
          retain(rollback);
        }
      }
    } finally {
      // Mark before invoking release; a throwing release is never retried.
      try {
        client.release(errors.length !== 0 || this.connectionError);
        // Return confirms the driver accepted ownership. A throwing release does not.
        client.removeListener("error", onError);
        client.removeListener("end", onEnd);
      } catch (release) {
        this.connectionError = true;
        retain(release);
        // Retain coverage until an actual end event if handoff is uncertain.
        // Never call release again to manufacture successful settlement.
      }
    }
    if (
      this.pool.waitingCount !== 0 ||
      this.connectionError ||
      (errors.length === 0 &&
        (this.pool.totalCount !== 1 || this.pool.idleCount !== 1)) ||
      (errors.length !== 0 && this.pool.totalCount !== 0)
    )
      retain(new ConnectedFixture105Refusal("fixture_reader_unsettled"));
    if (errors.length !== 0) {
      this.stopped = true;
      throw withCleanup(errors[0], errors);
    }
    this.current();
    if (output === undefined)
      throw new ConnectedFixture105Refusal("fixture_reader_unsettled");
    return output.value;
  }
  private async evaluateSnapshot(
    tx: Pick<Tx, "query">,
    stage: "unrecorded" | "claims" | "complete",
    allowAudit: boolean,
  ): Promise<SettledEvaluation> {
    const f = connectedFixture105Data();
    const tables: Record<string, Obj[]> = {};
    for (const table of Object.keys(f.tables))
      tables[table] = await readWhole(tx, table);
    const obsRow = tables.artifacts?.find(
      (row) => row.artifact_id === fixedOwnerId("observation"),
    );
    if (obsRow === undefined)
      throw new ConnectedFixture105Refusal("fixture_observation_missing");
    const observation = obj(obsRow.canonical_payload);
    const observationDigest = connectedFixture105ArtifactHash(
      "construction",
      observation,
    );
    if (
      observation.release_sha256 !== this.binding.digest ||
      canonicalJson(observation.subject) !==
        canonicalJson(this.binding.subject) ||
      this.target === undefined
    )
      throw new ConnectedFixture105Refusal("fixture_observation_binding");
    constructionReceipt(this.binding, observationDigest, this.target);
    const cut = await readCut(tx);
    validateConnectedFixture105Rows("observation", cut, expectedCut());
    if (canonicalJson(cut) !== canonicalJson(observation.observed_rows))
      throw new ConnectedFixture105Refusal("fixture_construction_changed");
    for (const table of Object.keys(f.tables))
      if (table !== "artifacts")
        exactRows(table, tables[table] ?? [], f.tables[table] ?? []);
    const definitions = await tx.query(
      "SELECT gate_definition_id::text,gate_name,version,definition FROM gate_definitions ORDER BY gate_definition_id LIMIT 26",
    );
    const defs = definitionRows().sort((a, b) =>
      String(a.gate_definition_id) < String(b.gate_definition_id) ? -1 : 1,
    );
    if (canonicalJson(definitions.rows) !== canonicalJson(defs))
      throw new ConnectedFixture105Refusal("fixture_definition_changed");
    for (const table of [
      "pronunciations",
      "pronunciation_renderings",
      "render_manifests",
      "model_runs",
      "provider_calls",
    ])
      if (
        (await tx.query(`SELECT 1 AS present FROM ${table} LIMIT 1`)).rows
          .length !== 0
      )
        throw new ConnectedFixture105Refusal("fixture_unexpected_runtime_rows");
    const input = componentFromRows(tables);
    const claims = evaluateConnectedFixture105Component(input);
    const performance = evaluateConnectedFixture105Performance(
      performanceFacts(input),
    );
    const gates = await readWhole(tx, "gate_results");
    exactRows(
      "gate_results",
      gates,
      stage === "unrecorded"
        ? []
        : stage === "claims"
          ? claimsSqlRows(claims)
          : [
              ...claimsSqlRows(claims),
              ...(performanceSqlRows(performance).gate_results ?? []),
            ],
    );
    const expectedArtifacts = [
      ...(f.tables.artifacts ?? []),
      ownedArtifactRow(
        fixedOwnerId("observation"),
        "fixture105-construction-observation/1",
        observation,
        observationDigest,
      ),
    ];
    const performanceRows = performanceSqlRows(performance);
    for (const table of [
      "performance_direction_versions",
      "performance_intents",
    ])
      exactRows(
        table,
        await readWhole(tx, table),
        stage === "complete" ? (performanceRows[table] ?? []) : [],
      );
    if (stage === "complete") {
      expectedArtifacts.push(...(performanceRows.artifacts ?? []));
      const operation = this.operation({
        input,
        claims,
        performance,
        observation,
        observationDigest,
      });
      expectedArtifacts.push(
        ownedArtifactRow(
          fixedOwnerId("operation"),
          "fixture105-operation/1",
          operation,
          connectedFixture105ArtifactHash("operation", operation),
        ),
      );
      if (allowAudit) {
        const audit = this.audit(operation);
        expectedArtifacts.push(
          ownedArtifactRow(
            fixedOwnerId("audit"),
            "connected-fixture105-audit-stub/1",
            audit,
            connectedFixture105ArtifactHash("audit", audit),
          ),
        );
      }
    }
    exactRows("artifacts", tables.artifacts ?? [], expectedArtifacts);
    return { input, claims, performance, observation, observationDigest };
  }
  private operation(evaluation: SettledEvaluation): Obj {
    const base = {
      schema: "fixture105-operation/1",
      record_kind: "actual_owned_operation",
      subject: this.binding.subject,
      release_sha256: this.binding.digest,
      construction_observation_sha256: evaluation.observationDigest,
      actual_claims_writing_result_sha256: connectedFixture105ClaimsResultHash(
        evaluation.claims,
      ),
      actual_performance_result_sha256:
        connectedFixture105PerformanceResultHash(evaluation.performance),
      performance_direction_hash:
        connectedFixture105Data().identities.performance_direction_hash,
      genuine_semantic_admission: false,
      required_semantic_status: {
        H04: "not_established_required",
        H13: "not_established_required",
      },
      owned_rows: ownedEnvelopes(performanceSqlRows(evaluation.performance)),
    };
    return { ...base, operation_id: connectedFixture105OperationId(base) };
  }
  private audit(operation: Obj): Obj {
    const subject = this.binding.subject;
    const input_projection = {
      package_hash: subject.package_hash,
      brief_hash: subject.brief_hash,
      script_hash: subject.final_script_hash,
      performance_direction_hash: operation.performance_direction_hash,
      claims_policy_version: subject.claims_policy_version,
      writing_policy_version: subject.writing_policy_version,
      performance_policy_version: subject.performance_policy_version,
      auditor_contract_version: "connected-fixture105-audit-stub/1",
    };
    return {
      schema: "connected-fixture105-audit-stub/1",
      kind: "fixture_stub",
      version: "connected-fixture105-audit-stub/1",
      input_projection,
      input_fingerprint: fingerprint("semantic_audit", input_projection),
      operation_sha256: connectedFixture105ArtifactHash("operation", operation),
      interface_conformance: "complete",
      semantic_acceptance: "not_established",
      model_run_id: null,
      render_allowed: false,
    };
  }
  private requireContinuation(evaluation: SettledEvaluation): void {
    const result = evaluation.claims;
    const fail = (
      code:
        | "fixture_claims_incomplete_factual_proof"
        | "fixture_required_coverage"
        | "fixture_c13_limit"
        | "fixture_roster_proof",
    ): never => {
      const projection = frozen({
        kind: "claims_continuation_failure",
        subject: this.binding.subject,
        release_sha256: this.binding.digest,
        actual_result_sha256: connectedFixture105ClaimsResultHash(result),
        reason: code,
        rows: result.rows,
        aggregate: result.aggregate,
        warnings: result.warnings,
        coverage: result.coverage,
        preconditions: result.preconditions,
      });
      const error = new ConnectedFixture105ClaimsFailure(code, projection);
      this.stopped = true;
      const bytes = Buffer.from(canonicalJson(projection) + "\n", "utf8");
      if (bytes.length > 262144 || this.target === undefined)
        throw withCleanup(error, [
          new ConnectedFixture105Refusal("fixture_failure_receipt_bound"),
        ]);
      // Private execution receipt, not a new database artifact or semantic pass.
      try {
        journalWrite(
          receiptRoot(this.target),
          "CLAIMS-FAILURE.json",
          projection,
        );
        const hash = targetHash(this.target);
        const intent = fixtureRead(
          `${this.binding.root}/expectations/${hash}.intent.json`,
          16384,
        );
        journalWrite(
          `${this.binding.root}/expectations`,
          `${hash}.claims-failure.json`,
          {
            schema: "fixture105-receipt-terminal/1",
            target_hash: hash,
            intent_sha256: sha256(intent),
            state: "construction_recorded",
            receipts: [
              {
                name: "CLAIMS-FAILURE.json",
                bytes: bytes.length,
                sha256: sha256(bytes),
              },
            ],
          },
        );
      } catch (retention) {
        throw withCleanup(error, [retention]);
      }
      throw error;
    };
    if (
      !result.preconditions.ok ||
      result.aggregate !== "incomplete" ||
      result.rows.some(
        (row) =>
          row.findings.length !== 0 ||
          row.facts.examined !== row.facts.expected_examined,
      )
    )
      fail("fixture_claims_incomplete_factual_proof");
    for (const entry of result.coverage) {
      if (
        entry.status === "not_established_required" &&
        entry.id !== "H04" &&
        entry.id !== "H13"
      )
        fail("fixture_required_coverage");
      if (
        entry.id === "C13" &&
        (!("limits" in entry) ||
          entry.limits.length !== 1 ||
          entry.limits[0] !== "historical_visibility_unprovable")
      )
        fail("fixture_c13_limit");
      if (entry.id === "H01" && "limits" in entry && entry.limits.length)
        fail("fixture_roster_proof");
    }
    if (
      evaluation.performance.aggregate !== "complete_defined_set" ||
      evaluation.performance.rows.some((row) => row.outcome !== "pass")
    )
      throw new ConnectedFixture105Refusal("fixture_performance_failed");
  }
  private async writeClaims(acquired: SettledEvaluation): Promise<void> {
    await this.transaction(async (tx) => {
      const fresh = await this.evaluateSnapshot(tx, "unrecorded", false);
      if (
        connectedFixture105ClaimsResultHash(fresh.claims) !==
        connectedFixture105ClaimsResultHash(acquired.claims)
      )
        throw new ConnectedFixture105Refusal("fixture_acquisition_changed");
      const capability = Object.freeze({});
      const borrow: EvaluationBorrow = {
        owner: this,
        tx,
        releaseDigest: this.binding.digest,
        live: true,
        taken: false,
        kind: "claims",
        claims: acquired.claims,
        rows: { gate_results: claimsSqlRows(acquired.claims) },
      };
      EVALUATION_BORROWS.set(capability, borrow);
      try {
        await recordConnectedFixture105Claims(capability);
      } finally {
        borrow.live = false;
        EVALUATION_BORROWS.delete(capability);
      }
      exactRows(
        "gate_results",
        await readWhole(tx, "gate_results"),
        claimsSqlRows(acquired.claims),
      );
    });
  }
  private async writePerformance(
    acquisition: FixtureContinuation105,
  ): Promise<void> {
    const acquired = CONTINUATIONS.get(acquisition);
    if (acquired?.owner !== this || acquired.state !== "open")
      throw new ConnectedFixture105Refusal("fixture_continuation");
    acquired.state = "consumed"; // Before any checkout; failure cannot reuse this key.
    try {
      this.current();
      this.requireContinuation(acquired.evaluation);
      await this.transaction(async (tx) => {
        const fresh = await this.evaluateSnapshot(tx, "claims", false);
        this.requireContinuation(fresh);
        if (
          connectedFixture105ClaimsResultHash(fresh.claims) !==
            connectedFixture105ClaimsResultHash(acquired.evaluation.claims) ||
          fresh.observationDigest !== acquired.evaluation.observationDigest ||
          connectedFixture105PerformanceResultHash(fresh.performance) !==
            connectedFixture105PerformanceResultHash(
              acquired.evaluation.performance,
            )
        )
          throw new ConnectedFixture105Refusal("fixture_acquisition_changed");
        const operation = this.operation(fresh);
        const capability = Object.freeze({});
        const borrow: EvaluationBorrow = {
          owner: this,
          tx,
          releaseDigest: this.binding.digest,
          live: true,
          taken: false,
          kind: "performance",
          claims: fresh.claims,
          performance: fresh.performance,
          rows: performanceSqlRows(fresh.performance),
          operation,
          operationArtifact: ownedArtifactRow(
            fixedOwnerId("operation"),
            "fixture105-operation/1",
            operation,
            connectedFixture105ArtifactHash("operation", operation),
          ),
        };
        EVALUATION_BORROWS.set(capability, borrow);
        try {
          await recordConnectedFixture105Performance(capability);
        } finally {
          borrow.live = false;
          EVALUATION_BORROWS.delete(capability);
        }
        await faultPoint("fixture105_after_performance_rows");
        await this.evaluateSnapshot(tx, "complete", false);
      });
    } finally {
      acquired.state = "closed";
    }
  }
  private async auditReadback(
    tx: Pick<Tx, "query">,
    audit: Obj,
  ): Promise<void> {
    const rows = await tx.query(
      "SELECT audit_run_id::text,attempt_id::text,input_fingerprint,auditor_kind,auditor_version,model_run_id::text,result_artifact_id::text FROM audit_runs ORDER BY audit_run_id LIMIT 2",
    );
    const expected = {
      audit_run_id: fixedOwnerId("audit-run"),
      attempt_id: obj(connectedFixture105Data().identities.ids).attempt,
      input_fingerprint: audit.input_fingerprint,
      auditor_kind: "fixture_stub",
      auditor_version: "connected-fixture105-audit-stub/1",
      model_run_id: null,
      result_artifact_id: fixedOwnerId("audit"),
    };
    if (canonicalJson(rows.rows) !== canonicalJson([expected]))
      throw new ConnectedFixture105Refusal("fixture_audit_readback");
  }
  private async writeAudit(evaluation: SettledEvaluation): Promise<void> {
    const audit = this.audit(this.operation(evaluation));
    await this.transaction(async (tx) => {
      const current = await this.evaluateSnapshot(tx, "complete", false);
      if (
        canonicalJson(this.operation(current)) !==
        canonicalJson(this.operation(evaluation))
      )
        throw new ConnectedFixture105Refusal("fixture_operation_changed");
      if (
        (await tx.query("SELECT 1 AS present FROM audit_runs LIMIT 1")).rows
          .length !== 0
      )
        throw new ConnectedFixture105Refusal("fixture_audit_foreign");
      await insertOwnedArtifact(
        tx,
        fixedOwnerId("audit"),
        "connected-fixture105-audit-stub/1",
        audit,
        connectedFixture105ArtifactHash("audit", audit),
      );
      await tx.query(
        "INSERT INTO audit_runs (audit_run_id,attempt_id,input_fingerprint,auditor_kind,auditor_version,model_run_id,result_artifact_id) VALUES ($1,$2,$3,'fixture_stub','connected-fixture105-audit-stub/1',NULL,$4)",
        [
          fixedOwnerId("audit-run"),
          obj(connectedFixture105Data().identities.ids).attempt,
          audit.input_fingerprint,
          fixedOwnerId("audit"),
        ],
      );
      await this.auditReadback(tx, audit);
      await faultPoint("fixture105_before_audit_commit");
    });
  }
  private requireTarget(): void {
    if (this.target === undefined)
      throw new ConnectedFixture105Refusal("fixture_target_missing");
  }
  async run(): Promise<ConnectedFixture105Result> {
    this.current();
    await this.snapshot(() => Promise.resolve(undefined));
    if (this.target === undefined)
      throw new ConnectedFixture105Refusal("fixture_target_missing");
    try {
      lstatSync(receiptRoot(this.target));
      throw new ConnectedFixture105Refusal("fixture_execution_already_present");
    } catch (error) {
      if (
        !(
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ENOENT"
        )
      )
        throw error;
    }
    journalIntent(this.binding, this.target);
    this.suiteTarget = {
      target_hash: targetHash(this.target),
      construction_state: "intent",
      later_phase: "construction",
      later_outcome: "started",
    };
    FIXTURE_SUITE_TARGETS.push(this.suiteTarget);
    await this.initializeSubject();
    const observation = await this.constructPackage();
    this.requireTarget();
    this.suiteTarget.construction_state = "construction_unknown";
    saveConstructionReceipt(
      this.binding,
      observation,
      this.target,
      this.constructionChronology,
    );
    this.suiteTarget.construction_state = "construction_recorded";
    this.suiteTarget.later_phase = "claims";
    await this.installScript();
    const initial = await this.snapshot((tx) =>
      this.evaluateSnapshot(tx, "unrecorded", false),
    );
    await this.writeClaims(initial);
    const recorded = await this.snapshot((tx) =>
      this.evaluateSnapshot(tx, "claims", false),
    );
    this.requireContinuation(recorded);
    const continuation: FixtureContinuation105 = Object.freeze({
      kind: "connected-fixture105-continuation/1",
      genuine_semantic_admission: false,
    });
    CONTINUATIONS.set(continuation, {
      owner: this,
      evaluation: recorded,
      state: "open",
    });
    try {
      await faultPoint("fixture105_after_acquisition");
      this.suiteTarget.later_phase = "direction";
      await this.writePerformance(continuation);
    } finally {
      const state = CONTINUATIONS.get(continuation);
      if (state !== undefined) state.state = "closed";
      CONTINUATIONS.delete(continuation);
    }
    const directed = await this.snapshot((tx) =>
      this.evaluateSnapshot(tx, "complete", false),
    );
    this.suiteTarget.later_phase = "audit";
    await this.writeAudit(directed);
    this.suiteTarget.later_phase = "readback";
    const complete = await this.complete("created");
    this.suiteTarget.later_outcome = "completed";
    return complete;
  }
  async complete(
    status: "created" | "reconciled",
  ): Promise<ConnectedFixture105Result> {
    return this.snapshot(async (tx) => {
      const evaluated = await this.evaluateSnapshot(tx, "complete", true);
      this.requireContinuation(evaluated);
      const operation = this.operation(evaluated);
      const audit = this.audit(operation);
      await this.auditReadback(tx, audit);
      return frozen({
        status,
        operation_id: String(operation.operation_id),
        operation_sha256: connectedFixture105ArtifactHash(
          "operation",
          operation,
        ),
        claims: evaluated.claims,
        performance: evaluated.performance,
        audit,
        genuine_semantic_admission: false as const,
        render_allowed: false as const,
      });
    });
  }
  async reconcile(): Promise<ConnectedFixture105Reconciliation> {
    return this.snapshot(async (tx) => {
      const rows = await tx.query(
        "SELECT audit_run_id FROM audit_runs LIMIT 2",
      );
      if (rows.rows.length > 1)
        throw new ConnectedFixture105Refusal("fixture_audit_foreign");
      const hasAudit = rows.rows.length === 1;
      const evaluated = await this.evaluateSnapshot(tx, "complete", hasAudit);
      this.requireContinuation(evaluated);
      const operation = this.operation(evaluated);
      const audit = hasAudit ? this.audit(operation) : null;
      if (audit !== null) await this.auditReadback(tx, audit);
      return frozen({
        status: hasAudit
          ? ("reconciled" as const)
          : ("direction_durable_audit_absent" as const),
        operation_id: String(operation.operation_id),
        operation_sha256: connectedFixture105ArtifactHash(
          "operation",
          operation,
        ),
        claims: evaluated.claims,
        performance: evaluated.performance,
        audit,
        genuine_semantic_admission: false as const,
        render_allowed: false as const,
      });
    });
  }
  async readConstructionCut(): Promise<readonly Fixture105RowEnvelope[]> {
    return this.snapshot(async (client) => frozen(await readCut(client)));
  }
  retainRunFailure(error: unknown): void {
    const row = this.suiteTarget;
    if (row === undefined) {
      FIXTURE_PRE_TARGET_FAILURES.push(
        error instanceof ConnectedFixture105Refusal
          ? error.code
          : "pre_target_failure",
      );
      return;
    }
    const known =
      !this.transactionUncertain &&
      !(
        error instanceof CommandConnectionError &&
        error.commitOutcome === "unknown"
      ) &&
      commandCleanupErrors(error).length === 0 &&
      (!(error instanceof ConnectedFixture105OwnerRefusal) ||
        error.outcome.kind !== "unknown");
    row.later_outcome = known ? "refused" : "unknown";
    if (row.construction_state === "intent") {
      row.construction_state = known
        ? "refused_before_receipt"
        : "construction_unknown";
      if (known && this.target !== undefined)
        journalTerminal(
          this.binding,
          this.target,
          "refused_before_receipt",
          undefined,
          error instanceof ConnectedFixture105Refusal
            ? error.code
            : "work_rolled_back",
        );
    } else if (row.construction_state === "construction_unknown")
      row.later_outcome = "unknown";
  }

  async close(): Promise<void> {
    if (this.closed)
      throw new ConnectedFixture105Refusal("fixture_host_closed");
    this.closed = true;
    await this.pool.end();
    if (
      this.pool.totalCount !== 0 ||
      this.pool.waitingCount !== 0 ||
      this.connectionError
    )
      throw new ConnectedFixture105Refusal("fixture_host_unsettled");
  }
}

/** Internal fixed host opening: configuration and adoption checks precede checkout. */
function openConnected105Session(): Connected105Session {
  let config: Config;
  try {
    config = loadConfig();
  } catch {
    throw new ConnectedFixture105Refusal("fixture_runtime_context");
  }
  if (config.DESK_ENV !== "test" || config.PROVIDERS_ENABLED)
    throw new ConnectedFixture105Refusal("fixture_runtime_context");
  const release = readRelease();
  return new Connected105Session(config, release);
}
const CONTINUATIONS = new WeakMap<
  FixtureContinuation105,
  {
    owner: Connected105Session;
    evaluation: SettledEvaluation;
    state: "open" | "consumed" | "closed";
  }
>();
/** One fixed operation. No caller subject, plan, pool, release or admission input. */
export async function runConnectedFixture105(): Promise<ConnectedFixture105Result> {
  let session: Connected105Session;
  try {
    session = openConnected105Session();
  } catch (error) {
    FIXTURE_PRE_TARGET_FAILURES.push(
      error instanceof ConnectedFixture105Refusal
        ? error.code
        : "pre_target_failure",
    );
    throw error;
  }
  let outcome:
    | { ok: true; value: ConnectedFixture105Result }
    | { ok: false; error: unknown };
  try {
    outcome = { ok: true, value: await session.run() };
  } catch (error) {
    let primary = error;
    try {
      session.retainRunFailure(error);
    } catch (retention) {
      primary = withCleanup(error, [retention]);
    }
    outcome = { ok: false, error: primary };
  }
  try {
    await session.close();
  } catch (cleanup) {
    if (!outcome.ok) throw withCleanup(outcome.error, [cleanup]);
    throw cleanup;
  }
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}
/** Explicit read-only convergence; never retries construction or a producer. */
export async function reconcileConnectedFixture105(): Promise<ConnectedFixture105Reconciliation> {
  const session = openConnected105Session();
  let outcome:
    | { ok: true; value: ConnectedFixture105Reconciliation }
    | { ok: false; error: unknown };
  try {
    outcome = { ok: true, value: await session.reconcile() };
  } catch (error) {
    outcome = { ok: false, error };
  }
  try {
    await session.close();
  } catch (cleanup) {
    if (!outcome.ok) throw withCleanup(outcome.error, [cleanup]);
    throw cleanup;
  }
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}

interface PackageBorrow {
  readonly tx: Tx;
  readonly owner: Connected105Session;
  readonly releaseDigest: string;
  live: boolean;
  taken: boolean;
}
const PACKAGE_BORROWS = new WeakMap<object, PackageBorrow>();
interface EvaluationBorrow {
  owner: Connected105Session;
  tx: Tx;
  releaseDigest: string;
  live: boolean;
  taken: boolean;
  kind: "claims" | "performance";
  claims: ComponentEvaluation;
  performance?: PerformanceEvaluation;
  rows: Readonly<Record<string, readonly Obj[]>>;
  operation?: Obj;
  operationArtifact?: Obj;
}
const EVALUATION_BORROWS = new WeakMap<object, EvaluationBorrow>();
/** Not a registration API: only private settled-acquisition paths mint keys. */
export function takeConnectedFixture105EvaluationBorrow(
  capability: object,
  kind: "claims" | "performance",
): EvaluationBorrow {
  const borrow = EVALUATION_BORROWS.get(capability);
  if (borrow === undefined)
    throw new ConnectedFixture105Refusal("fixture_evaluation_capability");
  const usable = borrow.live && !borrow.taken && borrow.kind === kind;
  borrow.taken = true;
  borrow.live = false; // Consume before any validation that can throw.
  if (!usable) {
    borrow.owner.invalidateBorrow();
    throw new ConnectedFixture105Refusal("fixture_evaluation_capability");
  }
  borrow.owner.assertBorrow(borrow.tx, borrow.releaseDigest);
  connectedFixture105ClaimsResultHash(borrow.claims);
  if (kind === "performance") {
    if (borrow.performance === undefined || borrow.operation === undefined)
      throw new ConnectedFixture105Refusal("fixture_performance_binding");
    connectedFixture105PerformanceResultHash(borrow.performance);
  }
  return borrow;
}
/** Only this host can mint. The package owner consumes once; clones cannot borrow. */
export function takeConnectedFixture105PackageBorrow(capability: object): {
  readonly tx: Tx;
  readonly pkg: AuthoredPackage;
  readonly options: PersistPackageOptions;
} {
  const borrow = PACKAGE_BORROWS.get(capability);
  if (borrow === undefined)
    throw new ConnectedFixture105Refusal("fixture_package_capability");
  const usable = borrow.live && !borrow.taken;
  borrow.taken = true;
  borrow.live = false; // Consume before any validation that can throw.
  if (!usable) {
    borrow.owner.invalidateBorrow();
    throw new ConnectedFixture105Refusal("fixture_package_capability");
  }
  borrow.owner.assertBorrow(borrow.tx, borrow.releaseDigest);
  const fixed = connectedFixture105Data();
  const artifact = fixed.tables.artifacts?.find(
    (row) => row.artifact_id === obj(fixed.identities.ids)["package-artifact"],
  );
  if (
    artifact === undefined ||
    typeof artifact.schema_version !== "string" ||
    typeof artifact.created_at !== "string" ||
    typeof artifact.byte_size !== "number" ||
    artifact.storage_uri !== null
  )
    throw new ConnectedFixture105Refusal("fixture_package_binding");
  return {
    tx: borrow.tx,
    pkg: {
      artifact_id: String(artifact.artifact_id),
      evidence_package_id: String(obj(fixed.identities.ids).package),
      schema_version: artifact.schema_version,
      canonical_payload: fixed.pkg as Json,
      storage_uri: null,
      byte_size: artifact.byte_size,
      created_at: artifact.created_at,
    },
    options: {
      expectedUnitIds: (fixed.tables.evidence_units ?? []).map((row) =>
        String(row.evidence_unit_id),
      ),
    },
  };
}
