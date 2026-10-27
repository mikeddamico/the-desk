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
    // Each prior visit can add at most one own key. Keep the exact key-count
    // bound near the limit without repeatedly enumerating the growing graph.
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

async function childMain(): Promise<void> {
  const nonce = process.env.DESK_P33_NONCE,
    resultPath = process.env.DESK_P33_RESULT;
  if (!nonce || !resultPath) throw Error("Missing P33 child handshake");
  if (!/^[0-9a-f]{48}$/u.test(nonce)) throw Error("Invalid P33 child nonce");
  const execution = fixtureExecutionRoot(
    fileURLToPath(new URL("../../", import.meta.url)).replace(/\/$/u, ""),
  );
  const { startVitest } = await import("vitest/node");
  const result = { finished: false };
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
  await ctx.close();
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
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv[2] !== "--p33-child" || process.argv.length !== 3)
    throw Error("Fixed child entrypoint only");
  await childMain();
}
