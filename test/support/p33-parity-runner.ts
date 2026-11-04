const { canonicalJson } = (await import(
  new URL("../../src/identity/canonical-json.ts", import.meta.url).href
)) as typeof import("../../src/identity/canonical-json.js");
import * as fixtureFs from "node:fs";
import * as fixturePath from "node:path";
import * as fixtureCrypto from "node:crypto";
// Fixed P33 transport and minimal child runner. No synchronous native call here.
import { createConnection } from "node:net";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export interface HarnessResult {
  protocol: 1;
  nonce: string;
  mode: "p33" | "complete" | "noncomplete";
  outcome: "COMPLETED" | "CONTAINED_REJECTION";
  reason: string;
  settled: true;
  noChildren: true;
  complete: true;
  reaped: { pid: number; raw: number; exit: number }[];
  controls: number[];
}
function valid(
  value: unknown,
  nonce: string,
  mode: HarnessResult["mode"],
): value is HarnessResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<HarnessResult>;
  return (
    v.protocol === 1 &&
    v.nonce === nonce &&
    v.mode === mode &&
    (v.outcome === "COMPLETED" || v.outcome === "CONTAINED_REJECTION") &&
    typeof v.reason === "string" &&
    v.settled === true &&
    v.noChildren === true &&
    v.complete === true &&
    Array.isArray(v.reaped) &&
    v.reaped.every(
      (r) =>
        Number.isSafeInteger(r.pid) &&
        Number.isSafeInteger(r.raw) &&
        Number.isInteger(r.exit),
    ) &&
    Array.isArray(v.controls) &&
    v.controls.every((p) => Number.isSafeInteger(p))
  );
}
async function request(mode: HarnessResult["mode"]): Promise<HarnessResult> {
  const path = process.env.DESK_P33_SOCKET,
    token = process.env.DESK_P33_TOKEN;
  if (!path || !token)
    throw Error("P33 prerequisite: use the guarded npm test command");
  const nonce = randomBytes(24).toString("hex");
  return new Promise((resolveResult, reject) => {
    const socket = createConnection(path);
    const chunks: Buffer[] = [];
    let size = 0,
      failed = false;
    const fail = (error: Error): void => {
      failed = true;
      socket.destroy();
      reject(error);
    };
    const timer = setTimeout(() => {
      fail(Error("P33 harness transport deadline"));
    }, 4000);
    socket.on("connect", () =>
      socket.write(JSON.stringify({ protocol: 1, mode, nonce, token }) + "\n"),
    );
    socket.on("data", (data: Buffer) => {
      size += data.length;
      if (size > 65536) fail(Error("P33 harness response bound"));
      else chunks.push(data);
    });
    socket.on("error", (error) => {
      clearTimeout(timer);
      fail(error);
    });
    socket.on("close", () => {
      clearTimeout(timer);
      if (failed) return;
      try {
        const value: unknown = JSON.parse(
          Buffer.concat(chunks).toString("utf8"),
        );
        if (!valid(value, nonce, mode))
          throw Error("P33 harness invalid or fatal response");
        resolveResult(value);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
}
export async function runP33(): Promise<void> {
  const result = await request("p33");
  if (result.outcome !== "COMPLETED")
    throw Error(`P33 harness rejection: ${result.reason}`);
}
export async function checkP33Harness(
  mode: "complete" | "noncomplete",
): Promise<HarnessResult> {
  if (process.env.DESK_P33_PROFILE !== "focused")
    throw Error("P33 controls require the focused guard profile");
  return request(mode);
}

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
function fixtureOpen(
  path: string,
  directory: boolean,
  graphOwner?: {
    open: (path: string, flags: number) => number;
    close: (fd: number) => void;
  },
): number {
  fixtureAbsolute(path);
  if (graphOwner) {
    // The ledger owns each fresh component chain, including partial acquisition/close failures.
    let owned = graphOwner.open(
      "/",
      fixtureFs.constants.O_RDONLY |
        fixtureFs.constants.O_DIRECTORY |
        fixtureFs.constants.O_NOFOLLOW,
    );
    const parts = path.split("/").filter(Boolean);
    for (const [index, part] of parts.entries()) {
      const next = graphOwner.open(
        `/proc/self/fd/${String(owned)}/${part}`,
        fixtureFs.constants.O_RDONLY |
          fixtureFs.constants.O_NOFOLLOW |
          fixtureFs.constants.O_NONBLOCK |
          (index < parts.length - 1 || directory
            ? fixtureFs.constants.O_DIRECTORY
            : 0),
      );
      graphOwner.close(owned);
      owned = next;
    }
    return owned;
  }
  if (fixtureGraphCleanupPoison) throw new Error("fixture_inventory_changed");
  const local = new Set<number>();
  const owner = {
    open(name: string, flags: number): number {
      if (fixtureGraphCleanupPoison)
        throw new Error("fixture_inventory_changed");
      const fd = fixtureFs.openSync(name, flags);
      fixtureBoundaryOwned.set(fd, ++fixtureBoundaryOrdinal);
      local.add(fd);
      return fd;
    },
    close(fd: number): void {
      local.delete(fd);
      fixtureClose(fd);
    },
  };
  let primary: unknown,
    failed = false,
    result: number | undefined;
  try {
    result = fixtureOpen(path, directory, owner);
    local.delete(result);
  } catch (error) {
    primary = error;
    failed = true;
  }
  // Every successfully opened component is attempted once, even if a preceding
  // close is uncertain. A returned leaf remains owned until fixtureClose().
  for (const fd of [...local].reverse())
    try {
      owner.close(fd);
    } catch (error) {
      if (!failed) {
        primary = error;
        failed = true;
      }
    }
  if (failed) throw primary;
  if (result === undefined) throw new Error("fixture_inventory_changed");
  return result;
}
function fixtureClose(fd: number): void {
  const ordinal = fixtureBoundaryOwned.get(fd);
  if (ordinal === undefined) throw new Error("fixture_inventory_changed");
  fixtureBoundaryOwned.delete(fd);
  try {
    fixtureFs.closeSync(fd);
  } catch (error) {
    fixtureGraphCleanupPoison = true;
    fixtureGraphRetainedCloses.push({
      fd,
      ordinal,
      dev: undefined,
      ino: undefined,
    });
    throw error;
  }
}

function fixtureIdentity(
  path: string,
  privateMode: boolean,
): FixtureRootObject {
  const fd = fixtureOpen(path, true);
  let primaryFailed = false;
  let primary: unknown;
  let closeFailed = false;
  let closeError: unknown;
  let result: FixtureRootObject | undefined;
  try {
    const st = fixtureFs.fstatSync(fd);
    if (
      !st.isDirectory() ||
      st.uid !== process.getuid?.() ||
      (privateMode && (st.mode & 0o777) !== 0o700)
    )
      throw new Error("fixture_root_owner");
    result = {
      path,
      dev: st.dev,
      ino: st.ino,
      uid: st.uid,
      mode: st.mode & 0o777,
    };
  } catch (error) {
    primaryFailed = true;
    primary = error;
  } finally {
    try {
      fixtureClose(fd);
    } catch (error) {
      closeFailed = true;
      closeError = error;
    }
  }
  if (primaryFailed) throw primary;
  if (closeFailed) throw closeError;
  if (result === undefined) throw new Error("fixture_root_result_missing");
  return result;
}
function fixtureRead(path: string, limit: number, privateMode = true): Buffer {
  const fd = fixtureOpen(path, false);
  let primaryFailed = false;
  let primary: unknown;
  let closeFailed = false;
  let closeError: unknown;
  let result: Buffer | undefined;
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
    result = bytes;
  } catch (error) {
    primaryFailed = true;
    primary = error;
  } finally {
    try {
      fixtureClose(fd);
    } catch (error) {
      closeFailed = true;
      closeError = error;
    }
  }
  if (primaryFailed) throw primary;
  if (closeFailed) throw closeError;
  if (result === undefined) throw new Error("fixture_root_result_missing");
  return result;
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
// A close failure cannot be repaired by reusing a descriptor number in another graph.
const fixtureBoundaryOwned = new Map<number, number>();
let fixtureBoundaryOrdinal = 0;
let fixtureGraphCleanupPoison = false;
const fixtureGraphRetainedCloses: {
  fd: number;
  ordinal: number;
  dev: bigint | undefined;
  ino: bigint | undefined;
}[] = [];
function fixtureGraph(
  base: string,
  kind: "source" | "tools",
): FixtureRootObject {
  if (fixtureGraphCleanupPoison) throw new Error("fixture_inventory_changed");
  const held = new Map<
    number,
    { ordinal: number; dev?: bigint; ino?: bigint }
  >();
  let ordinal = 0;
  let visited = 0;
  const result: FixtureRootObject = {};
  const owner = {
    open(path: string, flags: number): number {
      const fd = fixtureFs.openSync(path, flags);
      held.set(fd, { ordinal: ++ordinal });
      return fd;
    },
    close(fd: number): void {
      const identity = held.get(fd);
      if (!identity) throw new Error("fixture_inventory_changed");
      held.delete(fd); // A failed close may already have recycled the descriptor number.
      try {
        fixtureFs.closeSync(fd);
      } catch (error) {
        fixtureGraphCleanupPoison = true;
        fixtureGraphRetainedCloses.push({
          fd,
          ordinal: identity.ordinal,
          dev: identity.dev,
          ino: identity.ino,
        });
        throw error;
      }
    },
  };
  function observe(fd: number, value: fixtureFs.Stats): void {
    const identity = held.get(fd);
    if (!identity) throw new Error("fixture_inventory_changed");
    if (Number.isSafeInteger(value.dev)) identity.dev = BigInt(value.dev);
    if (Number.isSafeInteger(value.ino)) identity.ino = BigInt(value.ino);
  }
  function use<T>(fd: number, work: () => T): T {
    let failed = false;
    let primary: unknown;
    let value: T | undefined;
    try {
      value = work();
    } catch (error) {
      failed = true;
      primary = error;
    }
    try {
      owner.close(fd);
    } catch (error) {
      if (!failed) {
        failed = true;
        primary = error;
      }
    }
    if (failed) throw primary;
    return value as T;
  }
  function read(path: string): Buffer {
    const fd = fixtureOpen(path, false, owner);
    return use(fd, () => {
      const before = fixtureFs.fstatSync(fd);
      observe(fd, before);
      if (
        !before.isFile() ||
        before.nlink !== 1 ||
        before.uid !== process.getuid?.() ||
        before.size > 64 * 1024 * 1024
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
    });
  }
  function visit(path: string, relative: string): void {
    // Preserve the original node/key bound and independent absolute acquisition window.
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
      const fd = fixtureOpen(path, true, owner);
      use(fd, () => {
        const actual = fixtureFs.fstatSync(fd);
        observe(fd, actual);
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
      });
      return;
    }
    if (!info.isFile()) throw new Error("fixture_inventory_special");
    const bytes = read(path);
    result[relative] = {
      type: "file",
      mode: info.mode & 0o777,
      bytes: bytes.length,
      sha256: fixtureRawHash(bytes),
    };
  }
  let failed = false;
  let primary: unknown;
  try {
    visit(base, "");
  } catch (error) {
    failed = true;
    primary = error;
  }
  for (const fd of [...held.keys()].reverse()) {
    try {
      owner.close(fd);
    } catch (error) {
      if (!failed) {
        failed = true;
        primary = error;
      }
    }
  }
  if (failed) throw primary;
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
/** Independently checks the sealed producer DAG; outer owners check live BUILD/raw/dist. */
function fixtureExecutionProvenance(
  checkout: string,
  bytes: Record<string, Buffer>,
  source: FixtureRootObject,
  tools: FixtureRootObject,
): { provenance: { bytes: number; sha256: string }; dist: unknown } {
  const objects = (value: unknown): FixtureRootObject[] => {
    if (!Array.isArray(value))
      throw new Error("fixture_execution_provenance_invalid");
    return value.map(fixtureObject);
  };
  const strings = (value: unknown): string[] => {
    if (!Array.isArray(value))
      throw new Error("fixture_execution_provenance_invalid");
    return (value as unknown[]).map((row) => {
      if (typeof row !== "string")
        throw new Error("fixture_execution_provenance_invalid");
      return row;
    });
  };
  const names = [
    "ADOPTION.json",
    "BUILD-CLOSURE.json",
    "BUILD-HIDDEN-LOCK.json",
    "BUILD-INSTALL-INVOCATION.json",
    "BUILD-INSTALL-SETTLEMENT.json",
    "BUILD-INSTALL.json",
    "BUILD-OPTIONAL-ABSENCES.json",
    "BUILD-PACKAGE-METADATA.json",
    "BUILD-PROFILE.json",
    "BUILD-SOURCE-INVENTORY.json",
    "BUILD-TOOLS-INVENTORY.json",
    "COPY-RESULT.json",
    "DIST-INVENTORY.json",
    "EVAL-CLOSURE.json",
    "EVAL-HIDDEN-LOCK.json",
    "EVAL-INSTALL-INVOCATION.json",
    "EVAL-INSTALL-SETTLEMENT.json",
    "EVAL-INSTALL.json",
    "EVAL-OPTIONAL-ABSENCES.json",
    "EVAL-PACKAGE-METADATA.json",
    "EVAL-PROFILE.json",
    "PROVENANCE.json",
    "QUALITY-SETTLEMENT.json",
    "QUALITY.json",
    "RELEASE.json",
    "SOURCE-INVENTORY.json",
    "SOURCE-LEDGER.json",
    "TOOLS-INVENTORY.json",
    "TRANSFER-SETTLEMENT.json",
    "TRANSFER.json",
  ];
  fixtureSame(Object.keys(bytes).sort(), names);
  const fail: (check?: string) => never = (check = "metadata") => {
    throw Object.assign(new Error("fixture_execution_provenance_invalid"), {
      check,
    });
  };
  const requiredBytes = (name: string): Buffer => {
    const raw = bytes[name];
    if (raw === undefined) fail();
    return raw;
  };
  if (checkout !== "/tmp/e") fail();
  const actualDirectory = (path: string): FixtureRootObject => {
    const held = new Map<number, number>();
    let ordinal = 0;
    const owner = {
      open(name: string, flags: number): number {
        if (fixtureGraphCleanupPoison)
          throw new Error("fixture_inventory_changed");
        const fd = fixtureFs.openSync(name, flags);
        held.set(fd, ++ordinal);
        return fd;
      },
      close(fd: number): void {
        const order = held.get(fd);
        if (order === undefined) throw new Error("fixture_inventory_changed");
        held.delete(fd);
        try {
          fixtureFs.closeSync(fd);
        } catch (error) {
          fixtureGraphCleanupPoison = true;
          fixtureGraphRetainedCloses.push({
            fd,
            ordinal: order,
            dev: undefined,
            ino: undefined,
          });
          throw error;
        }
      },
    };
    let primary: unknown,
      failed = false,
      result: FixtureRootObject | undefined;
    try {
      const fd = fixtureOpen(path, true, owner),
        value = fixtureFs.fstatSync(fd);
      if (
        !value.isDirectory() ||
        value.uid !== process.getuid?.() ||
        (value.mode & 511) !== 448
      )
        fail();
      result = {
        path,
        dev: value.dev,
        ino: value.ino,
        uid: value.uid,
        gid: value.gid,
        mode: value.mode & 511,
      };
    } catch (error) {
      primary = error;
      failed = true;
    }
    for (const fd of [...held.keys()].reverse())
      try {
        owner.close(fd);
      } catch (error) {
        if (!failed) {
          primary = error;
          failed = true;
        }
      }
    if (failed) throw primary;
    if (result === undefined) fail();
    return result;
  };
  const parsed: Record<string, FixtureRootObject> = {};
  const bound = (name: string): number =>
    name.includes("INVENTORY")
      ? 4194304
      : name.endsWith("-PROFILE.json") ||
          name.endsWith("-INSTALL.json") ||
          ["TRANSFER.json", "COPY-RESULT.json"].includes(name)
        ? 16384
        : name === "QUALITY.json" || name.includes("OPTIONAL-ABSENCES")
          ? 32768
          : ["PROVENANCE.json", "ADOPTION.json"].includes(name)
            ? 8192
            : 262144;
  const uniqueJson = (raw: Buffer): FixtureRootObject => {
    const text = raw.toString("utf8");
    if (!Buffer.from(text).equals(raw)) fail();
    const value = fixtureJson(raw);
    // JSON.parse first establishes the complete grammar. This token walk then
    // refuses repeated object keys, including escaped spellings of the same key.
    const frames: { object: boolean; key: boolean; names: Set<string> }[] = [];
    for (let i = 0; i < text.length; i++) {
      const token = text[i],
        frame = frames.at(-1);
      if (token === '"') {
        const start = i++;
        while (i < text.length && text[i] !== '"') {
          if (text[i] === "\\") i++;
          i++;
        }
        const key: unknown = JSON.parse(text.slice(start, i + 1));
        if (frame?.object && frame.key) {
          if (typeof key !== "string" || frame.names.has(key)) fail();
          frame.names.add(key);
          frame.key = false;
        }
      } else if (token === "{" || token === "[")
        frames.push({ object: token === "{", key: true, names: new Set() });
      else if (token === "}" || token === "]") frames.pop();
      else if (token === "," && frame?.object) frame.key = true;
    }
    return value;
  };
  const incoming = fixtureObject(
    JSON.parse(process.env.DESK_FIXTURE105_BINDING ?? "null") as unknown,
  );
  if (typeof incoming.root !== "string") fail();
  const partition = fixtureJson(
    fixtureRead(
      `${fixturePath.dirname(fixturePath.dirname(incoming.root))}/evidence/partition.json`,
      65536,
    ),
  );
  fixtureKeys(partition, [
    "schema",
    "partition",
    "identity",
    "selection",
    "counts",
    "execution",
  ]);
  if (
    partition.schema !== "ci-partition/2" ||
    !["writer", "rest"].includes(String(partition.partition)) ||
    partition.partition !== process.env.DESK_CI_PARTITION
  )
    fail();
  const canonical = (value: unknown): Buffer =>
    Buffer.from(canonicalJson(value) + "\n");
  const pin = (value: Buffer) => ({
    bytes: value.length,
    sha256: fixtureRawHash(value),
  });
  const ref = (value: unknown, name: string): void => {
    const raw = bytes[name];
    if (raw === undefined) fail();
    fixtureKeys(fixtureObject(value), ["bytes", "sha256"]);
    if (
      !Number.isSafeInteger(fixtureObject(value).bytes) ||
      (fixtureObject(value).bytes as number) < 1 ||
      (fixtureObject(value).bytes as number) > bound(name)
    )
      fail("physical_pin");
    fixtureSame(value, pin(raw));
  };
  const physicalPin = (
    value: unknown,
    maximum = 262144,
    empty = false,
  ): void => {
    const v = fixtureObject(value);
    fixtureKeys(v, ["bytes", "sha256"]);
    if (
      !Number.isSafeInteger(v.bytes) ||
      (v.bytes as number) < (empty ? 0 : 1) ||
      (v.bytes as number) > maximum ||
      typeof v.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(v.sha256)
    )
      fail("physical_pin");
  };
  const evaluationCi = fixturePath.dirname(fixturePath.dirname(incoming.root));
  if (
    fixturePath.basename(evaluationCi) !== "ci" ||
    fixturePath.basename(fixturePath.dirname(evaluationCi)) !== "evaluation"
  )
    fail("ledger_path");
  const buildCi = fixturePath.resolve(evaluationCi, "../../build/ci");
  const record = (
    name: string,
    schema: string,
    keys: string[],
  ): FixtureRootObject => {
    const raw = bytes[name];
    if (raw === undefined || raw.length === 0 || raw.length > bound(name))
      fail();
    const value = parsed[name] ?? fixtureJson(raw);
    fixtureKeys(value, keys);
    if (value.schema !== schema) fail();
    if (!name.includes("HIDDEN-LOCK"))
      fixtureSame(pin(raw), pin(canonical(value)));
    parsed[name] = value;
    return value;
  };
  for (const name of names) {
    const raw = requiredBytes(name);
    if (raw.length === 0 || raw.length > bound(name)) fail();
    const value = uniqueJson(raw);
    if (!name.includes("HIDDEN-LOCK"))
      fixtureSame(pin(raw), pin(canonical(value)));
    parsed[name] = value;
  }
  const policyPath = "fixtures/ci-evaluation-installation/INSTALL-POLICY.json";
  const qualityPath = "fixtures/ci-evaluation-installation/QUALITY-POLICY.json";
  const policyBytes = fixtureRead(`${checkout}/${policyPath}`, 65536, false);
  const qualityBytes = fixtureRead(`${checkout}/${qualityPath}`, 65536, false);
  const policy = fixtureJson(policyBytes),
    qualityPolicy = fixtureJson(qualityBytes);
  fixtureSame(policyBytes, canonical(policy));
  fixtureSame(qualityBytes, canonical(qualityPolicy));
  fixtureKeys(policy, [
    "schema",
    "producer",
    "profile",
    "manifest",
    "lock",
    "application_roots",
    "evaluation_roots",
    "build_only_roots",
    "platform_policy",
    "evaluation_install",
    "build_install",
    "evaluation_closure",
    "build_closure",
    "optional_peer_policy",
    "module_policy",
  ]);
  fixtureKeys(qualityPolicy, [
    "schema",
    "install_policy_sha256",
    "gate_order",
    "gates",
    "configuration",
    "structural_methods",
    "build_contract",
    "settlement_policy",
  ]);
  const l = fixtureRawHash(
    Buffer.concat([
      Buffer.from("THE-DESK/EVALUATION-INSTALL-POLICY/1\n"),
      policyBytes,
    ]),
  );
  const q = fixtureRawHash(
    Buffer.concat([
      Buffer.from("THE-DESK/BUILD-QUALITY-POLICY/1\n"),
      qualityBytes,
    ]),
  );
  if (
    policy.schema !== "ci-evaluation-install-policy/1" ||
    qualityPolicy.schema !== "ci-build-quality-policy/1" ||
    qualityPolicy.install_policy_sha256 !== l ||
    policy.producer !== "ci-ordinary-npm-producer/1" ||
    policy.profile !== "desk-evaluation-runtime/1"
  )
    fail();
  for (const [key, path] of [
    ["manifest", "package.json"],
    ["lock", "package-lock.json"],
  ] as const) {
    fixtureSame(
      policy[key],
      pin(fixtureRead(`${checkout}/${path}`, 262144, false)),
    );
  }
  for (const row of [source[policyPath], source[qualityPath]])
    if (fixtureObject(row).type !== "file") fail();
  fixtureSame(
    {
      bytes: fixtureObject(source[policyPath]).bytes,
      sha256: fixtureObject(source[policyPath]).sha256,
    },
    pin(policyBytes),
  );
  fixtureSame(
    {
      bytes: fixtureObject(source[qualityPath]).bytes,
      sha256: fixtureObject(source[qualityPath]).sha256,
    },
    pin(qualityBytes),
  );
  fixtureSame(
    objects(qualityPolicy.configuration).map((row) => row.path),
    [
      ".node-version",
      ".npmrc",
      ".prettierignore",
      "eslint.config.js",
      "tsconfig.build.json",
      "tsconfig.json",
      "vitest.config.ts",
    ].sort(),
  );
  for (const row of objects(qualityPolicy.configuration)) {
    fixtureKeys(row, ["path", "bytes", "sha256"]);
    if (typeof row.path !== "string") fail();
    const leaf = fixtureObject(source[row.path]);
    if (leaf.type !== "file") fail();
    fixtureSame(
      { bytes: row.bytes, sha256: row.sha256 },
      { bytes: leaf.bytes, sha256: leaf.sha256 },
    );
  }
  fixtureSame(qualityPolicy.gate_order, [
    "format",
    "lint",
    "types",
    "build",
    "structural",
  ]);
  const structuralMethods = strings(qualityPolicy.structural_methods);
  if (structuralMethods.length !== 157) fail();
  fixtureSame(structuralMethods, [...new Set(structuralMethods)].sort());
  const provenance = record("PROVENANCE.json", "ci-evaluation-provenance/1", [
    "schema",
    "source",
    "profile_policy_sha256",
    "quality_policy_sha256",
    "evaluation_profile",
    "evaluation_installation",
    "quality",
    "transfer",
    "dist_graph",
  ]);
  if (
    provenance.profile_policy_sha256 !== l ||
    provenance.quality_policy_sha256 !== q
  )
    fail();
  const identity = fixtureObject(provenance.source);
  fixtureKeys(identity, [
    "repository",
    "run_id",
    "run_attempt",
    "checkout",
    "head",
    "tree",
    "source_sha256",
  ]);
  for (const key of ["checkout", "head", "tree"])
    if (
      typeof identity[key] !== "string" ||
      !/^[0-9a-f]{40}$/u.test(identity[key])
    )
      fail();
  for (const key of ["run_id", "run_attempt"])
    if (
      typeof identity[key] !== "string" ||
      !/^[1-9][0-9]{0,19}$/u.test(identity[key])
    )
      fail();
  if (
    typeof identity.repository !== "string" ||
    !/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/u.test(
      identity.repository,
    ) ||
    typeof identity.source_sha256 !== "string" ||
    !/^[0-9a-f]{64}$/u.test(identity.source_sha256)
  )
    fail();
  for (const [key, env] of [
    ["repository", "GITHUB_REPOSITORY"],
    ["checkout", "GITHUB_SHA"],
    ["run_id", "GITHUB_RUN_ID"],
    ["run_attempt", "GITHUB_RUN_ATTEMPT"],
  ] as const) {
    if (identity[key] !== process.env[env]) fail();
  }
  const members: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(source)) {
    const row = fixtureObject(value);
    if (row.type === "file") members[path] = [row.bytes, row.sha256];
  }
  if (identity.source_sha256 !== fixtureRawHash(canonical(members))) fail();
  const expectedIdentity = fixtureObject(partition.identity);
  fixtureKeys(expectedIdentity, [
    "repository",
    "run_id",
    "run_attempt",
    "checkout",
    "head",
    "tree",
    "source_sha256",
    "profile_policy_sha256",
    "quality_policy_sha256",
  ]);
  fixtureSame(expectedIdentity, {
    ...identity,
    profile_policy_sha256: l,
    quality_policy_sha256: q,
  });
  const execution = fixtureObject(partition.execution);
  fixtureKeys(execution, ["provenance", "summary"]);
  ref(execution.provenance, "PROVENANCE.json");
  const summary = fixtureObject(execution.summary);
  fixtureKeys(summary, [
    "schema",
    "partition",
    "job",
    "identity",
    "origin",
    "producer",
    "build_profile",
    "evaluation_profile",
    "manifest",
    "lock",
    "build_installation",
    "evaluation_installation",
    "quality",
    "transfer",
    "dist",
    "quality_gates",
    "structural_methods_sha256",
    "settled",
  ]);
  if (
    summary.schema !== "ci-execution-summary/1" ||
    summary.partition !== partition.partition ||
    summary.job !== `verify-${String(partition.partition)}` ||
    summary.origin !== "transferred" ||
    summary.producer !== "ci-ordinary-npm-producer/1" ||
    summary.build_profile !== "desk-full-build/1" ||
    summary.evaluation_profile !== "desk-evaluation-runtime/1" ||
    summary.settled !== true
  )
    fail();
  fixtureSame(summary.identity, expectedIdentity);
  fixtureSame(summary.manifest, policy.manifest);
  fixtureSame(summary.lock, policy.lock);
  for (const [key, name] of [
    ["build_installation", "BUILD-INSTALL.json"],
    ["evaluation_installation", "EVAL-INSTALL.json"],
    ["quality", "QUALITY.json"],
    ["transfer", "TRANSFER.json"],
    ["dist", "DIST-INVENTORY.json"],
  ] as const)
    ref(summary[key], name);
  if (
    summary.structural_methods_sha256 !==
    fixtureRawHash(canonical(qualityPolicy.structural_methods))
  )
    fail();
  const allTests = Object.keys(source)
    .filter((name) => /^test\/.*\.test\.ts$/u.test(name))
    .sort();
  if (
    allTests.length !== 89 ||
    !allTests.includes("test/unit/p33-parity-harness.test.ts") ||
    !allTests.includes("test/unit/writer-fixture-input.test.ts")
  )
    fail();
  const selected =
    partition.partition === "writer"
      ? ["test/unit/writer-fixture-input.test.ts"]
      : allTests.filter(
          (name) =>
            name !== "test/unit/p33-parity-harness.test.ts" &&
            name !== "test/unit/writer-fixture-input.test.ts",
        );
  fixtureSame(partition.selection, selected);
  fixtureSame(
    partition.counts,
    partition.partition === "writer" ? [1, 4908, 0] : [87, 3880, 29],
  );
  const sourced = (value: FixtureRootObject): void => {
    fixtureSame(value.source, identity);
  };
  const fixedDirectory = (value: unknown, path: string): void => {
    const d = fixtureObject(value);
    fixtureKeys(d, ["path", "dev", "ino", "uid", "gid", "mode"]);
    if (d.path !== path || d.mode !== 448) fail();
    for (const key of ["dev", "ino", "uid", "gid", "mode"])
      if (!Number.isSafeInteger(d[key]) || (d[key] as number) < 0) fail();
  };
  const path = (value: unknown): string => {
    if (
      typeof value !== "string" ||
      !/^node_modules\/[A-Za-z0-9_@.+/-]{1,499}$/u.test(value) ||
      value.split("/").some((part) => ["", ".", ".."].includes(part))
    )
      return fail();
    return value;
  };
  const settled = (name: string): void => {
    const value = record(name, "ci-owned-settlement/1", [
      "schema",
      "stdout_eof",
      "stderr_eof",
      "direct_reaped",
      "group_empty",
      "discovery_complete",
      "owned_pending",
      "primary",
      "cleanup",
      "cancelled",
      "owner_raw",
    ]);
    physicalPin(value.owner_raw);
    for (const key of [
      "stdout_eof",
      "stderr_eof",
      "direct_reaped",
      "group_empty",
      "discovery_complete",
    ])
      if (value[key] !== true) fail("unsettled");
    if (
      fixtureStable(value.owned_pending) !== "[]" ||
      fixtureStable(value.cleanup) !== "[]" ||
      value.primary !== null ||
      value.cancelled !== false
    )
      fail("unsettled");
  };
  for (const prefix of ["BUILD", "EVAL"] as const) {
    const build = prefix === "BUILD",
      root = build ? "/tmp/d" : "/tmp/e";
    const sourceName = build
      ? "BUILD-SOURCE-INVENTORY.json"
      : "SOURCE-INVENTORY.json";
    const toolsName = build
      ? "BUILD-TOOLS-INVENTORY.json"
      : "TOOLS-INVENTORY.json";
    const profile = record(`${prefix}-PROFILE.json`, "ci-install-profile/1", [
      "schema",
      "profile_id",
      "producer_id",
      "source",
      "manifest",
      "lock",
      "roots",
      "omit",
      "install_argv",
      "node",
      "npm",
      "platform",
      "closure",
      "optional_absences",
    ]);
    sourced(profile);
    if (
      profile.profile_id !==
        (build ? "desk-full-build/1" : "desk-evaluation-runtime/1") ||
      profile.producer_id !== policy.producer
    )
      fail();
    fixtureSame(profile.manifest, policy.manifest);
    fixtureSame(profile.lock, policy.lock);
    const installationPolicy = fixtureObject(
      policy[build ? "build_install" : "evaluation_install"],
    );
    fixtureSame(profile.omit, installationPolicy.omit);
    fixtureSame(profile.install_argv, installationPolicy.argv);
    fixtureSame(profile.platform, { os: "linux", arch: "x64", libc: "glibc" });
    const roots = [
      ...objects(policy.application_roots),
      ...objects(policy.evaluation_roots),
      ...(build ? objects(policy.build_only_roots) : []),
    ].sort((a, b) =>
      String(a.name) < String(b.name)
        ? -1
        : String(a.name) > String(b.name)
          ? 1
          : 0,
    );
    fixtureSame(profile.roots, roots);
    for (const [tool, version] of [
      ["node", "24.21.0"],
      ["npm", "11.19.0"],
    ] as const) {
      const row = fixtureObject(profile[tool]);
      fixtureKeys(row, ["version", "executable_sha256"]);
      if (
        row.version !== version ||
        typeof row.executable_sha256 !== "string" ||
        !/^[0-9a-f]{64}$/u.test(row.executable_sha256)
      )
        fail();
    }
    ref(profile.closure, `${prefix}-CLOSURE.json`);
    fixtureSame(
      profile.closure,
      policy[build ? "build_closure" : "evaluation_closure"],
    );
    const authoredClosure = fixtureObject(
      source[`fixtures/ci-evaluation-installation/${prefix}-CLOSURE.json`],
    );
    if (authoredClosure.type !== "file") fail();
    fixtureSame(
      { bytes: authoredClosure.bytes, sha256: authoredClosure.sha256 },
      pin(requiredBytes(`${prefix}-CLOSURE.json`)),
    );
    ref(profile.optional_absences, `${prefix}-OPTIONAL-ABSENCES.json`);
    const absences = record(
      `${prefix}-OPTIONAL-ABSENCES.json`,
      "ci-install-absences/1",
      ["schema", "rows"],
    );
    const closure = record(`${prefix}-CLOSURE.json`, "ci-install-closure/1", [
      "schema",
      "roots",
      "records",
      "edges",
    ]);
    fixtureSame(closure.roots, roots);
    const records = new Map<string, FixtureRootObject>();
    for (const row of objects(closure.records)) {
      fixtureKeys(row, ["path", "record"]);
      const location = path(row.path);
      if (records.has(location)) fail();
      records.set(location, fixtureObject(row.record));
    }
    fixtureSame([...records.keys()], [...records.keys()].sort());
    const packages = record(
      `${prefix}-PACKAGE-METADATA.json`,
      "ci-installed-packages/1",
      ["schema", "rows"],
    );
    const actual = new Set<string>(),
      graph = fixtureObject(parsed[toolsName]);
    const hidden = fixtureObject(parsed[`${prefix}-HIDDEN-LOCK.json`]);
    fixtureKeys(hidden, [
      "name",
      "version",
      "lockfileVersion",
      "requires",
      "packages",
    ]);
    if (
      hidden.name !== "the-desk" ||
      hidden.version !== "0.1.0" ||
      hidden.lockfileVersion !== 3 ||
      hidden.requires !== true
    )
      fail();
    const hiddenLeaf = fixtureObject(graph[".package-lock.json"]);
    if (hiddenLeaf.type !== "file") fail();
    fixtureSame(
      { bytes: hiddenLeaf.bytes, sha256: hiddenLeaf.sha256 },
      pin(requiredBytes(`${prefix}-HIDDEN-LOCK.json`)),
    );
    const hiddenPackages = fixtureObject(hidden.packages);
    for (const row of objects(packages.rows)) {
      fixtureKeys(row, [
        "path",
        "name",
        "version",
        "package_json",
        "lock_path",
      ]);
      const location = path(row.path),
        locked = records.get(location);
      if (
        actual.has(location) ||
        !locked ||
        row.lock_path !== location ||
        row.version !== locked.version ||
        typeof row.name !== "string"
      )
        fail();
      actual.add(location);
      const file = fixtureObject(
        graph[location.slice("node_modules/".length) + "/package.json"],
      );
      physicalPin(row.package_json);
      if (file.type !== "file") fail();
      fixtureSame(row.package_json, { bytes: file.bytes, sha256: file.sha256 });
      fixtureSame(hiddenPackages[location], locked);
    }
    fixtureSame([...actual].sort(), Object.keys(hiddenPackages).sort());
    const expectedAbsences: FixtureRootObject[] = [];
    for (const [location, locked] of records) {
      if (!actual.has(location)) {
        const absentPlatform = (
          [
            ["os", "linux"],
            ["cpu", "x64"],
            ["libc", "glibc"],
          ] as const
        ).some(
          ([key, target]) =>
            Array.isArray(locked[key]) &&
            !(locked[key] as unknown[]).includes(target),
        );
        if (locked.optional !== true || !absentPlatform) fail();
        expectedAbsences.push({
          from: location,
          kind: "optionalDependencies",
          name: location,
          range: locked.version,
          reason: "incompatible_platform",
        });
      }
    }
    for (const edge of objects(closure.edges)) {
      fixtureKeys(edge, [
        "from",
        "kind",
        "name",
        "range",
        "optional",
        "followed",
        "resolved_current_path",
      ]);
      if (
        typeof edge.from !== "string" ||
        typeof edge.kind !== "string" ||
        typeof edge.name !== "string" ||
        typeof edge.range !== "string" ||
        typeof edge.optional !== "boolean" ||
        typeof edge.followed !== "boolean"
      )
        fail();
      if (!edge.followed) {
        if (!edge.optional || edge.resolved_current_path !== null) fail();
        expectedAbsences.push({
          from: edge.from,
          kind: edge.kind,
          name: edge.name,
          range: edge.range,
          reason: "absent_optional_peer",
        });
      } else if (
        typeof edge.resolved_current_path !== "string" ||
        !records.has(edge.resolved_current_path)
      )
        fail();
    }
    const absenceOrder = (
      left: FixtureRootObject,
      right: FixtureRootObject,
    ): number => {
      for (const key of ["from", "kind", "name"]) {
        const a = String(left[key]),
          b = String(right[key]);
        if (a !== b) return a < b ? -1 : 1;
      }
      return 0;
    };
    if (
      fixtureStable(absences.rows) !==
      fixtureStable(expectedAbsences.sort(absenceOrder))
    )
      fail("absence_population");
    const absent = new Set<string>();
    for (const row of objects(absences.rows)) {
      fixtureKeys(row, ["from", "kind", "name", "range", "reason"]);
      if (row.reason === "incompatible_platform") {
        const missing = records.get(path(row.from));
        if (missing?.optional !== true) fail();
        absent.add(String(row.from));
      } else if (row.reason !== "absent_optional_peer") fail();
    }
    fixtureSame(
      [...actual].sort(),
      [...records.keys()].filter((name) => !absent.has(name)).sort(),
    );
    const install = record(`${prefix}-INSTALL.json`, "ci-installation/1", [
      "schema",
      "source",
      "profile",
      "checkout",
      "modules",
      "source_graph",
      "tools_graph",
      "package_metadata",
      "hidden_lock",
      "invocation",
      "settlement",
    ]);
    sourced(install);
    fixedDirectory(install.checkout, root);
    fixedDirectory(install.modules, `${root}/node_modules`);
    if (
      !build &&
      (fixtureStable(install.checkout) !==
        fixtureStable(actualDirectory(checkout)) ||
        fixtureStable(install.modules) !==
          fixtureStable(actualDirectory(`${checkout}/node_modules`)))
    )
      fail("physical_evaluation_identity");
    for (const [key, name] of [
      ["profile", `${prefix}-PROFILE.json`],
      ["source_graph", sourceName],
      ["tools_graph", toolsName],
      ["package_metadata", `${prefix}-PACKAGE-METADATA.json`],
      ["hidden_lock", `${prefix}-HIDDEN-LOCK.json`],
      ["invocation", `${prefix}-INSTALL-INVOCATION.json`],
      ["settlement", `${prefix}-INSTALL-SETTLEMENT.json`],
    ] as const)
      ref(install[key], name);
    const invocation = record(
      `${prefix}-INSTALL-INVOCATION.json`,
      "ci-npm-invocation/1",
      [
        "schema",
        "source",
        "profile_policy_sha256",
        "argv",
        "cwd",
        "node_sha256",
        "npm_sha256",
        "environment_policy_sha256",
        "exit",
        "stdout",
        "stderr",
        "owner_raw",
      ],
    );
    sourced(invocation);
    if (
      invocation.profile_policy_sha256 !== l ||
      invocation.cwd !== root ||
      invocation.exit !== 0
    )
      fail("invocation");
    fixtureSame(
      invocation.node_sha256,
      fixtureObject(profile.node).executable_sha256,
    );
    fixtureSame(
      invocation.npm_sha256,
      fixtureObject(profile.npm).executable_sha256,
    );
    for (const key of ["stdout", "stderr"])
      physicalPin(invocation[key], 8388608, true);
    physicalPin(invocation.owner_raw);
    const invocationArgv = strings(invocation.argv),
      roleCi = build ? buildCi : evaluationCi;
    const prescribed = [
      ...strings(installationPolicy.argv),
      "--no-audit",
      "--no-fund",
      "--no-update-notifier",
      "--registry=https://registry.npmjs.org/",
      "--strict-ssl=true",
      "--fetch-retries=0",
      "--maxsockets=1",
      "--fetch-timeout=15000",
      `--cache=${roleCi}/tmp/npm-cache`,
      `--userconfig=${roleCi}/home/user.npmrc`,
      `--globalconfig=${roleCi}/home/global.npmrc`,
    ];
    if (fixtureStable(invocationArgv) !== fixtureStable(prescribed))
      fail("invocation_policy");
    if (
      invocation.environment_policy_sha256 !==
      fixtureRawHash(
        canonical({
          policy: "private-official-npm/1",
          role: build ? "build" : "evaluation",
        }),
      )
    )
      fail();
    settled(`${prefix}-INSTALL-SETTLEMENT.json`);
    fixtureSame(
      fixtureObject(parsed[`${prefix}-INSTALL-SETTLEMENT.json`]).owner_raw,
      invocation.owner_raw,
    );
  }
  const quality = record("QUALITY.json", "ci-build-quality/1", [
    "schema",
    "source",
    "build_profile",
    "build_installation",
    "policy_sha256",
    "gates",
    "dist_graph",
    "build_root",
    "settlement",
  ]);
  sourced(quality);
  fixedDirectory(quality.build_root, "/tmp/d");
  if (
    fixtureStable(quality.build_root) !==
    fixtureStable(fixtureObject(parsed["BUILD-INSTALL.json"]).checkout)
  )
    fail("quality_root_identity");
  if (quality.policy_sha256 !== q) fail();
  ref(quality.build_profile, "BUILD-PROFILE.json");
  ref(quality.build_installation, "BUILD-INSTALL.json");
  const gates = objects(quality.gates),
    expectedGates = objects(qualityPolicy.gates);
  if (gates.length !== 5 || expectedGates.length !== 5) fail();
  for (let i = 0; i < 5; i++) {
    const gate = gates[i],
      expected = expectedGates[i];
    if (gate === undefined || expected === undefined) fail();
    fixtureKeys(gate, [
      "name",
      "argv",
      "exit",
      "stdout",
      "stderr",
      "result",
      "source_before",
      "source_after",
      "tools_before",
      "tools_after",
    ]);
    const actualArgv = strings(gate.argv),
      expectedArgv = strings(expected.argv).map((argument) =>
        argument.replace("<BUILD_CI_TMP>", `${buildCi}/tmp`),
      );
    if (
      gate.name !== expected.name ||
      gate.exit !== 0 ||
      fixtureStable(actualArgv) !== fixtureStable(expectedArgv)
    )
      fail("quality_gate");
    for (const key of ["stdout", "stderr"])
      physicalPin(gate[key], 8388608, true);
    physicalPin(gate.result);
    for (const [key, name] of [
      ["source_before", "BUILD-SOURCE-INVENTORY.json"],
      ["source_after", "BUILD-SOURCE-INVENTORY.json"],
      ["tools_before", "BUILD-TOOLS-INVENTORY.json"],
      ["tools_after", "BUILD-TOOLS-INVENTORY.json"],
    ] as const)
      ref(gate[key], name);
  }
  fixtureSame(
    summary.quality_gates,
    gates.map((gate) => ({ name: gate.name, exit: 0, result: gate.result })),
  );
  ref(quality.dist_graph, "DIST-INVENTORY.json");
  ref(quality.settlement, "QUALITY-SETTLEMENT.json");
  settled("QUALITY-SETTLEMENT.json");
  const dist = record("DIST-INVENTORY.json", "ci-dist-content/1", [
    "schema",
    "rows",
    "legacy_summary",
  ]);
  const rows = fixtureObject(dist.rows);
  if (!Object.hasOwn(rows, "")) fail();
  let files = 0,
    directories = 0,
    totalbytes = 0;
  for (const [name, value] of Object.entries(rows)) {
    if (
      name &&
      (!/^[A-Za-z0-9_@.+/-]{1,512}$/u.test(name) ||
        name.split("/").some((part) => ["", ".", ".."].includes(part)))
    )
      fail();
    const row = fixtureObject(value);
    if (row.type === "directory") {
      fixtureKeys(row, ["type", "mode"]);
      directories++;
    } else {
      fixtureKeys(row, ["type", "mode", "bytes", "sha256"]);
      if (
        row.type !== "file" ||
        !Number.isSafeInteger(row.bytes) ||
        (row.bytes as number) < 0 ||
        (row.bytes as number) > 67108864 ||
        typeof row.sha256 !== "string" ||
        !/^[0-9a-f]{64}$/u.test(row.sha256)
      )
        fail();
      files++;
      totalbytes += row.bytes as number;
    }
    if (
      !Number.isSafeInteger(row.mode) ||
      (row.mode as number) < 0 ||
      (row.mode as number) > 511
    )
      fail();
  }
  const transfer = record("TRANSFER.json", "ci-build-transfer/1", [
    "schema",
    "source",
    "quality",
    "build_installation",
    "evaluation_installation",
    "producer_root",
    "consumer_root",
    "dist_graph",
    "copy_result",
    "settlement",
  ]);
  sourced(transfer);
  fixedDirectory(transfer.producer_root, "/tmp/d");
  fixedDirectory(transfer.consumer_root, "/tmp/e");
  if (
    fixtureStable(transfer.producer_root) !==
      fixtureStable(fixtureObject(parsed["BUILD-INSTALL.json"]).checkout) ||
    fixtureStable(transfer.consumer_root) !==
      fixtureStable(fixtureObject(parsed["EVAL-INSTALL.json"]).checkout)
  )
    fail("transfer_root_identity");
  for (const [key, name] of [
    ["quality", "QUALITY.json"],
    ["build_installation", "BUILD-INSTALL.json"],
    ["evaluation_installation", "EVAL-INSTALL.json"],
    ["dist_graph", "DIST-INVENTORY.json"],
    ["copy_result", "COPY-RESULT.json"],
    ["settlement", "TRANSFER-SETTLEMENT.json"],
  ] as const)
    ref(transfer[key], name);
  settled("TRANSFER-SETTLEMENT.json");
  const copy = record("COPY-RESULT.json", "ci-dist-copy/1", [
    "schema",
    "source_root",
    "destination_root",
    "source_before",
    "source_after",
    "destination_graph",
    "files",
    "directories",
    "totalbytes",
    "source_identity_before",
    "source_identity_after",
    "destination_identity_before",
    "destination_identity_after",
    "complete",
    "owner_raw",
  ]);
  fixedDirectory(copy.source_root, "/tmp/d/dist");
  fixedDirectory(copy.destination_root, "/tmp/e/dist");
  physicalPin(copy.owner_raw);
  for (const key of ["files", "directories", "totalbytes"])
    if (!Number.isSafeInteger(copy[key]) || (copy[key] as number) < 0)
      fail("copy_count_type");
  for (const key of ["source_identity_before", "source_identity_after"])
    fixedDirectory(copy[key], "/tmp/d/dist");
  for (const key of [
    "destination_identity_before",
    "destination_identity_after",
  ])
    fixedDirectory(copy[key], "/tmp/e/dist");
  for (const key of ["source_before", "source_after", "destination_graph"])
    ref(copy[key], "DIST-INVENTORY.json");
  fixtureSame(copy.source_root, copy.source_identity_before);
  fixtureSame(copy.source_root, copy.source_identity_after);
  fixtureSame(copy.destination_root, copy.destination_identity_before);
  fixtureSame(copy.destination_root, copy.destination_identity_after);
  if (
    copy.complete !== true ||
    copy.files !== files ||
    copy.directories !== directories ||
    copy.totalbytes !== totalbytes
  )
    fail("copy_counts");
  for (const [key, name] of [
    ["evaluation_profile", "EVAL-PROFILE.json"],
    ["evaluation_installation", "EVAL-INSTALL.json"],
    ["quality", "QUALITY.json"],
    ["transfer", "TRANSFER.json"],
    ["dist_graph", "DIST-INVENTORY.json"],
  ] as const)
    ref(provenance[key], name);
  fixtureSame(
    parsed["BUILD-SOURCE-INVENTORY.json"],
    parsed["SOURCE-INVENTORY.json"],
  );
  fixtureSame(parsed["SOURCE-INVENTORY.json"], source);
  fixtureSame(parsed["TOOLS-INVENTORY.json"], tools);
  return {
    provenance: pin(requiredBytes("PROVENANCE.json")),
    dist: dist.legacy_summary,
  };
}

function fixtureExecutionRoot(checkout: string): {
  root: string;
  rootHash: string;
  marker: FixtureRootObject;
  temp: FixtureRootObject;
} {
  if (fixtureGraphCleanupPoison) throw new Error("fixture_inventory_changed");
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
    "execution_provenance_sha256",
  ]);
  if (
    marker.schema !== "fixture105-execution-root/2" ||
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
    "BUILD-CLOSURE.json",
    "BUILD-HIDDEN-LOCK.json",
    "BUILD-INSTALL-INVOCATION.json",
    "BUILD-INSTALL-SETTLEMENT.json",
    "BUILD-INSTALL.json",
    "BUILD-OPTIONAL-ABSENCES.json",
    "BUILD-PACKAGE-METADATA.json",
    "BUILD-PROFILE.json",
    "BUILD-SOURCE-INVENTORY.json",
    "BUILD-TOOLS-INVENTORY.json",
    "COPY-RESULT.json",
    "DIST-INVENTORY.json",
    "EVAL-CLOSURE.json",
    "EVAL-HIDDEN-LOCK.json",
    "EVAL-INSTALL-INVOCATION.json",
    "EVAL-INSTALL-SETTLEMENT.json",
    "EVAL-INSTALL.json",
    "EVAL-OPTIONAL-ABSENCES.json",
    "EVAL-PACKAGE-METADATA.json",
    "EVAL-PROFILE.json",
    "PROVENANCE.json",
    "QUALITY-SETTLEMENT.json",
    "QUALITY.json",
    "RELEASE.json",
    "SOURCE-INVENTORY.json",
    "SOURCE-LEDGER.json",
    "TOOLS-INVENTORY.json",
    "TRANSFER-SETTLEMENT.json",
    "TRANSFER.json",
  ];
  fixtureSame(fixtureFs.readdirSync(`${root}/bindings`).sort(), expectedFiles);
  const metadata: Record<string, Buffer> = {};
  const requiredMetadata = (name: string): Buffer => {
    const raw = metadata[name];
    if (raw === undefined) throw new Error("fixture_root_binding_pin");
    return raw;
  };
  for (const name of expectedFiles)
    metadata[name] = fixtureRead(
      `${root}/bindings/${name}`,
      name.includes("INVENTORY") ? 4194304 : 262144,
    );
  for (const [name, key] of [
    ["SOURCE-LEDGER.json", "source_ledger_sha256"],
    ["RELEASE.json", "release_sha256"],
    ["SOURCE-INVENTORY.json", "source_inventory_sha256"],
    ["TOOLS-INVENTORY.json", "tools_inventory_sha256"],
    ["PROVENANCE.json", "execution_provenance_sha256"],
  ] as const) {
    if (fixtureRawHash(requiredMetadata(name)) !== marker[key])
      throw new Error("fixture_root_binding_pin");
  }
  const source = fixtureGraph(checkout, "source"),
    tools = fixtureGraph(`${checkout}/node_modules`, "tools");
  fixtureSame(fixtureJson(requiredMetadata("SOURCE-INVENTORY.json")), source);
  fixtureSame(fixtureJson(requiredMetadata("TOOLS-INVENTORY.json")), tools);
  const execution = fixtureExecutionProvenance(
    checkout,
    metadata,
    source,
    tools,
  );
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
    execution_provenance_bytes: execution.provenance.bytes,
    execution_provenance_sha256: execution.provenance.sha256,
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

async function childMain(): Promise<void> {
  const nonce = process.env.DESK_P33_NONCE,
    resultPath = process.env.DESK_P33_RESULT;
  if (!nonce || !resultPath) throw Error("Missing P33 child handshake");
  if (!/^[0-9a-f]{48}$/u.test(nonce)) throw Error("Invalid P33 child nonce");
  const phase = (name: string): void => {
    process.stderr.write(`P33_PHASE ${name} ${String(performance.now())}\n`);
  };
  phase("root_validation_begin");
  process.once("beforeExit", () => {
    phase("before_exit");
  });
  process.once("exit", () => {
    phase("exit");
  });
  const execution = fixtureExecutionRoot(
    fileURLToPath(new URL("../../", import.meta.url)).replace(/\/$/u, ""),
  );
  phase("root_validation_end");
  const vitestEntry = fileURLToPath(import.meta.resolve("vitest/node"));
  if (
    !vitestEntry.startsWith("/tmp/e/node_modules/") ||
    fixtureFs.realpathSync(vitestEntry) !== vitestEntry ||
    !fixtureFs.statSync(vitestEntry).isFile()
  )
    throw new Error("fixture_module_escape");
  const { startVitest } = await import("vitest/node");
  phase("vitest_import_end");
  const result = { finished: false };
  phase("vitest_start_begin");
  const ctx = await startVitest(
    "test",
    [],
    {
      root: fileURLToPath(new URL("../../", import.meta.url)),
      config: false,
      watch: false,
      environment: "node",
      testTimeout: 5000,
      fileParallelism: false,
      include: ["test/support/p33-parity-child.case.ts"],
      reporters: [
        {
          onTestRunEnd(modules, errors, reason) {
            phase("test_run_end");
            const tests = modules.flatMap((m) => [...m.children.allTests()]);
            result.finished =
              reason === "passed" &&
              errors.length === 0 &&
              modules.length === 1 &&
              modules.every((m) => m.ok()) &&
              tests.length === 1 &&
              tests[0]?.name === "P33 multidisk" &&
              tests[0].result().state === "passed";
          },
        },
      ],
    },
    { cacheDir: `${execution.root}/tool-cache/p33/${nonce}` },
  );
  phase("vitest_start_end");
  phase("vitest_close_begin");
  await ctx.close();
  phase("vitest_close_end");
  // Type names only, capped; no handles, paths, arguments or environment values.
  process.stderr.write(
    `P33_RESOURCES ${JSON.stringify(
      process
        .getActiveResourcesInfo()
        .slice(0, 32)
        .map((name) => name.slice(0, 64)),
    )}\n`,
  );
  if (
    !result.finished ||
    (process.exitCode !== undefined && process.exitCode !== 0)
  )
    throw Error("P33 child/hooks/runner failed");
  const record = JSON.stringify({
    protocol: 1,
    nonce,
    case: "P33 multidisk",
    assertionsCompleted: true,
    hooksCompleted: true,
  });
  if (Buffer.byteLength(record) > 4096)
    throw Error("P33 completion record bound");
  writeFileSync(resultPath, record, { flag: "wx", mode: 0o600 });
  phase("completion_written");
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv[2] !== "--p33-child" || process.argv.length !== 3)
    throw Error("Fixed child entrypoint only");
  await childMain();
}
