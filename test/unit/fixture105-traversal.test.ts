/** Private production functions are extracted verbatim into an isolated realm; no production test export/reset. */
import { describe, expect, it, vi } from "vitest";
import pg from "pg";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { tmpdir } from "node:os";
import { runInNewContext } from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ConnectedFixture105Refusal,
  connectedFixture105Data,
  connectedFixture105ResourceIdentity,
} from "../../src/runtime/connected-fixture151-data.js";
import ts from "typescript";
import { canonicalTimestamp } from "../../src/identity/canonical-json.js";

// Reuse the existing closed extraction seam: declarations only, no native module imports or DB setup.
async function nativeCallbackSelftest(): Promise<void> {
  const native = fs.readFileSync(new URL("../integration/connected-fixture105.test.ts", import.meta.url), "utf8");
  const syntax = ts.createSourceFile("native.ts", native, ts.ScriptTarget.Latest, true);
  const functions = new Set([
    "retainTestCleanup", "withTestCleanup", "driverQuery", "rawDriverQuery",
    "observedPromiseCall", "driverPromiseThen", "commitWitness", "targetUnknown",
    "targetData", "targetInt", "targetSupplement", "maintenanceStamp",
    "captureMaintenance", "observeMaintenance",
  ]);
  const constants = new Set([
    "cleanupFailures", "TARGET_PREFIX", "TARGET_OBSERVER_CAP", "TARGET_SCOPES", "MAINTENANCE_SQL",
  ]);
  const declarations = syntax.statements.filter((node) => {
    if (ts.isFunctionDeclaration(node)) return functions.has(node.name?.text ?? "");
    if (ts.isClassDeclaration(node)) return node.name?.text === "TargetObserver";
    return ts.isVariableStatement(node) && node.declarationList.declarations.every(
      (entry) => ts.isIdentifier(entry.name) && constants.has(entry.name.text),
    );
  });
  expect(declarations).toHaveLength(functions.size + constants.size + 1);
  const javascript = ts.transpileModule(
    declarations.map((node) => node.getFullText(syntax)).join("\n") +
      "\nglobalThis.callbackSelftest = () => TargetObserver.selftest();",
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  const realm: Record<string, unknown> = {
    pg, expect, vi, process, Buffer, Promise, EventEmitter, canonicalTimestamp,
  };
  const original = Object.getOwnPropertyDescriptor(pg.Client.prototype, "query");
  try {
    runInNewContext(javascript, realm, { timeout: 1000 });
    const selftest: unknown = realm.callbackSelftest;
    if (typeof selftest !== "function") throw new Error("native callback selftest entry missing");
    await (selftest as () => Promise<void>)();
  } finally {
    expect(Object.getOwnPropertyDescriptor(pg.Client.prototype, "query")).toEqual(original);
  }
}

type Graph = (
  base: string,
  kind: "source" | "tools",
) => Record<string, unknown>;
type Hook = (
  name: string,
  args: readonly unknown[],
  next: () => unknown,
) => unknown;
const sourcePath = new URL(
  "../../src/runtime/connected-fixture105.ts",
  import.meta.url,
);
const source = fs.readFileSync(sourcePath, "utf8");
const parsed = ts.createSourceFile(
  "host.ts",
  source,
  ts.ScriptTarget.Latest,
  true,
);
const selected = parsed.statements.filter((node) => {
  if (ts.isFunctionDeclaration(node))
    return [
      "fixtureAbsolute",
      "fixtureOpen",
      "fixtureRawHash",
      "fixtureGraph",
    ].includes(node.name?.text ?? "");
  return (
    ts.isVariableStatement(node) &&
    node.declarationList.declarations.every(
      (decl) =>
        ts.isIdentifier(decl.name) && decl.name.text.startsWith("fixtureGraph"),
    )
  );
});
const code = ts.transpileModule(
  selected.map((node) => node.getText(parsed)).join("\n") + "\nfixtureGraph;",
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2024,
      module: ts.ModuleKind.None,
    },
  },
).outputText;
interface Acquisition {
  ordinal: number;
  fd: number;
  path: string;
  closeAttempts: number;
  settled: boolean;
}
interface World {
  root: string;
  base: string;
  leaf: string;
  calls: { name: string; args: readonly unknown[] }[];
  held: Map<number, string>;
  acquisitions: Acquisition[];
  active: Map<number, Acquisition>;
  unexpectedCloses: number[];
  opened: (fd: number, name: string) => void;
  facade: typeof fs;
  hook: Hook;
  graph: Graph;
  realm: () => Graph;
}
function world(work: (world: World) => void): void {
  const root = fs.mkdtempSync(path.join(tmpdir(), "fixture105-traversal-"));
  const identity = fs.lstatSync(root);
  const base = path.join(root, "shared", "bound");
  fs.mkdirSync(path.join(base, "nested"), { recursive: true, mode: 0o700 });
  const leaf = path.join(base, "nested", "leaf");
  fs.writeFileSync(leaf, "fresh governed bytes", { mode: 0o600 });
  const calls: World["calls"] = [];
  const held = new Map<number, string>();
  const acquisitions: Acquisition[] = [];
  const active = new Map<number, Acquisition>();
  const unexpectedCloses: number[] = [];
  const opened = (fd: number, name: string): void => {
    const entry = {
      ordinal: acquisitions.length + 1,
      fd,
      path: name,
      closeAttempts: 0,
      settled: false,
    };
    acquisitions.push(entry);
    active.set(fd, entry);
    held.set(fd, name);
  };
  const current: World = {
    root,
    base,
    leaf,
    calls,
    held,
    acquisitions,
    active,
    unexpectedCloses,
    opened,
    facade: fs,
    hook: (_name, _args, next) => next(),
    graph: () => ({}),
    realm: () => () => ({}),
  };
  const facade = new Proxy(fs, {
    get(target, name) {
      const original: unknown = Reflect.get(target, name);
      if (typeof original !== "function") return original;
      return (...args: unknown[]): unknown => {
        const label = String(name);
        if (calls.length < 4096) calls.push({ name: label, args });
        if (label === "closeSync" && typeof args[0] === "number") {
          const entry = active.get(args[0]);
          if (entry) entry.closeAttempts++;
          else if (unexpectedCloses.length < 4096)
            unexpectedCloses.push(args[0]);
        }
        return current.hook(label, args, () => {
          const value: unknown = Reflect.apply(original, target, args);
          if (label === "openSync" && typeof value === "number")
            opened(value, fs.realpathSync(`/proc/self/fd/${String(value)}`));
          if (label === "closeSync" && typeof args[0] === "number") {
            const entry = active.get(args[0]);
            if (entry) entry.settled = true;
            active.delete(args[0]);
            held.delete(args[0]);
          }
          return value;
        });
      };
    },
  });
  current.facade = facade;
  current.realm = () => {
    const graph: unknown = runInNewContext(
      code,
      {
        fixtureFs: facade,
        fixturePath: path,
        fixtureCrypto: crypto,
        process,
        Buffer,
      },
      { timeout: 1000 },
    );
    if (typeof graph !== "function")
      throw new Error("private graph extraction failed");
    return graph as Graph;
  };
  current.graph = current.realm();
  try {
    work(current);
  } finally {
    // An injected pre-close fault deliberately leaves owned descriptors; no production reset is used.
    for (const fd of held.keys()) fs.closeSync(fd);
    const actual = fs.lstatSync(root);
    expect([actual.dev, actual.ino, actual.uid]).toEqual([
      identity.dev,
      identity.ino,
      process.getuid?.(),
    ]);
    fs.rmSync(root, { recursive: true });
  }
}
function targetFd(w: World, value: unknown, target = w.leaf): boolean {
  return typeof value === "number" && w.held.get(value) === target;
}
function statChange(
  value: unknown,
  key: string,
  replacement: number | bigint,
): unknown {
  if (typeof value !== "object" || value === null)
    throw new Error("stat object required");
  return new Proxy(value, {
    get(object, name): unknown {
      return name === key ? replacement : Reflect.get(object, name);
    },
  });
}
function failure(work: () => unknown): unknown {
  try {
    work();
  } catch (error) {
    return error;
  }
  throw new Error("expected refusal");
}
function refused(w: World, message?: string): void {
  if (message) expect(() => w.graph(w.base, "source")).toThrow(message);
  else expect(() => w.graph(w.base, "source")).toThrow();
  expect(w.held.size).toBe(0);
}
function oracle(base: string, kind: "source" | "tools"): unknown {
  const result = spawnSync(
    "/usr/bin/python3",
    [
      "-I",
      "-B",
      "-c",
      "import json,runpy,sys;ci=runpy.run_path('tools/ci-validation/ci.py',run_name='parity_oracle');print(json.dumps(ci['fixture_graph'](sys.argv[1],sys.argv[2]),sort_keys=True))",
      base,
      kind,
    ],
    {
      cwd: new URL("../../", import.meta.url),
      timeout: 1000,
      maxBuffer: 262144,
      env: {
        PATH: "/usr/bin:/bin",
        LANG: "C.UTF-8",
        LC_ALL: "C.UTF-8",
        TZ: "UTC",
      },
    },
  );
  expect(result.status).toBe(0);
  expect(result.stderr.length).toBe(0);
  return JSON.parse(result.stdout.toString()) as unknown;
}
function duringRead(w: World, mutate: () => void): void {
  let fired = false;
  w.hook = (name, args, next) => {
    const value = next();
    if (!fired && name === "readFileSync" && targetFd(w, args[0])) {
      fired = true;
      mutate();
    }
    return value;
  };
}

/** Authentic existing binding owner on a private source copy; no hosted identity, SQL or caller pass. */
function boundRelease(w: World): {
  release: () => unknown;
  graph: Graph;
  root: () => unknown;
  bindingRoot: string;
  witness: string;
} {
  const checkout = path.join(w.root, "release-checkout");
  const ciBase = path.join(w.root, "release-ci");
  const prepared = spawnSync(
    "/usr/bin/python3",
    [
      "-I",
      "-B",
      "-c",
      [
        "import json,os,pathlib,runpy,shutil,stat,sys",
        "actual=pathlib.Path.cwd();checkout=pathlib.Path(sys.argv[1]);base=pathlib.Path(sys.argv[2])",
        "ci=runpy.run_path(str(actual/'tools/ci-validation/ci.py'),run_name='release_binding_owner')",
        "checkout.mkdir(mode=0o700);base.mkdir(mode=0o700)",
        "for name in ('tmp','evidence','home'):(base/name).mkdir(mode=0o700)",
        "names=set(ci['FIXTURE_OWNER_PATHS'])|{'fixtures/connected-fixture151/'+name for name in ci['FIXTURE_RESOURCE_NAMES']}",
        "for name in sorted(names):\n p=checkout/name;p.parent.mkdir(mode=0o700,parents=True,exist_ok=True);shutil.copyfile(actual/name,p);p.chmod(stat.S_IMODE((actual/name).stat().st_mode))",
        "(checkout/'node_modules').mkdir(mode=0o700)",
        "tool=checkout/'node_modules/inert-tooling-witness.js';tool.write_text('// inert tooling bytes; never executed\\n');tool.chmod(0o600)",
        "witness=checkout/'graph-only-bound-witness.txt';witness.write_text('original bound graph bytes');witness.chmod(0o600)",
        "binding=ci['fixture_prepare'](base,checkout)",
        "print(json.dumps(binding,separators=(',',':')))",
      ].join("\n"),
      checkout,
      ciBase,
    ],
    {
      cwd: new URL("../../", import.meta.url),
      timeout: 1000,
      maxBuffer: 65536,
      env: {
        PATH: "/usr/bin:/bin",
        LANG: "C.UTF-8",
        LC_ALL: "C.UTF-8",
        TZ: "UTC",
      },
    },
  );
  expect(prepared.status).toBe(0);
  expect(prepared.stderr.length).toBe(0);
  const binding: unknown = JSON.parse(prepared.stdout.toString());
  if (
    typeof binding !== "object" ||
    binding === null ||
    typeof Reflect.get(binding, "root") !== "string"
  )
    throw new Error("binding owner did not return a root");
  const bindingRoot: string = Reflect.get(binding, "root") as string;
  const names = new Set([
    "fixtureObject",
    "fixtureKeys",
    "fixtureRawHash",
    "fixtureJson",
    "fixtureAbsolute",
    "fixtureOpen",
    "fixtureIdentity",
    "fixtureRead",
    "fixtureStable",
    "fixtureSame",
    "fixtureGraph",
    "fixtureTempObservation",
    "fixtureExecutionRoot",
    "obj",
    "objects",
    "frozen",
    "exactKeys",
    "jsonBytes",
    "fixedSubject",
    "readRelease",
  ]);
  const constants = new Set([
    "HASH",
    "EFFECTS",
    "RELEASE_ID",
    "fixtureCheckout",
    "fixtureGraphCleanupPoison",
    "fixtureGraphRetainedCloses",
  ]);
  const statements = parsed.statements.filter((node) => {
    if (ts.isFunctionDeclaration(node)) return names.has(node.name?.text ?? "");
    return (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.every(
        (decl) => ts.isIdentifier(decl.name) && constants.has(decl.name.text),
      )
    );
  });
  // Keep the actual canonical owner in this realm: do not bypass its prototype checks
  // by bridging VM objects through an injected host-realm serializer.
  const canonical = ts.createSourceFile(
    "canonical-json.ts",
    fs.readFileSync(
      new URL("../../src/identity/canonical-json.ts", import.meta.url),
      "utf8",
    ),
    ts.ScriptTarget.Latest,
    true,
  );
  const canonicalNames = new Set([
    "compareCodePoints",
    "normalizeString",
    "serialize",
    "canonicalJson",
    "sha256",
  ]);
  const canonicalFunctions = canonical.statements
    .filter(
      (node) =>
        ts.isFunctionDeclaration(node) &&
        canonicalNames.has(node.name?.text ?? ""),
    )
    .map((node) => node.getText(canonical));
  // Relocate only the module URL to the actual private copy. Boundary function bodies remain production code.
  const releaseCode = ts.transpileModule(
    [
      ...canonicalFunctions,
      ...statements.map((node) => node.getText(parsed)),
    ].join("\n") +
      "\n({release:readRelease,graph:fixtureGraph,root:()=>fixtureExecutionRoot(fixtureCheckout)});",
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2024,
        module: ts.ModuleKind.CommonJS,
      },
      transformers: {
        before: [
          (context) => {
            const visit: ts.Visitor = (node) => {
              if (
                ts.isPropertyAccessExpression(node) &&
                node.name.text === "url" &&
                ts.isMetaProperty(node.expression) &&
                node.expression.keywordToken === ts.SyntaxKind.ImportKeyword
              )
                return ts.factory.createIdentifier("__fixtureModuleUrl");
              return ts.visitEachChild(node, visit, context);
            };
            return (file) => ts.visitNode(file, visit) as ts.SourceFile;
          },
        ],
      },
    },
  ).outputText;
  const aliases: Record<string, unknown> = {};
  for (const name of [
    "openSync",
    "fstatSync",
    "readFileSync",
    "closeSync",
    "constants",
  ])
    aliases[name] = Reflect.get(w.facade, name);
  const release: unknown = runInNewContext(
    releaseCode,
    {
      ...aliases,
      exports: {},
      fixtureFs: w.facade,
      fixturePath: path,
      fixtureCrypto: crypto,
      process: {
        env: {
          DESK_ENV: "test",
          PROVIDERS_ENABLED: "false",
          GENERATION_KILL_SWITCH: "true",
          DESK_FIXTURE105_BINDING: JSON.stringify(binding),
        },
        getuid: () => process.getuid?.(),
      },
      Buffer,
      URL,
      TextDecoder,
      fileURLToPath,
      __fixtureModuleUrl: pathToFileURL(
        path.join(checkout, "src/runtime/connected-fixture105.ts"),
      ).href,
      createHash: crypto.createHash,
      ConnectedFixture105Refusal,
      connectedFixture105Data,
      connectedFixture105ResourceIdentity,
    },
    { timeout: 1000 },
  );
  if (
    typeof release !== "object" ||
    release === null ||
    ["release", "graph", "root"].some(
      (name) => typeof Reflect.get(release, name) !== "function",
    )
  )
    throw new Error("private release extraction failed");
  const functions = release as {
    release: () => unknown;
    graph: Graph;
    root: () => unknown;
  };
  return {
    ...functions,
    bindingRoot,
    witness: path.join(checkout, "graph-only-bound-witness.txt"),
  };
}

/** One fixed synthetic overflow subject; no physical filesystem traversal is needed for the node/key ceiling. */
function assertNodeBound(base: string): void {
  const callerUid = process.getuid?.();
  if (callerUid === undefined) throw new Error("Linux UID required");
  const uid: number = callerUid;
  const payload = Buffer.from("node-count-only\n");
  // Independently frozen with Python hashlib, not the production hash helper.
  const expectedHash =
    "22ecfa104945d31423020b3b0006a15a38fdd0cd6d3cc31689939e64f35e2d64";
  const children = Array.from(
    { length: 20002 },
    (_, index) => "child" + String(index).padStart(5, "0"),
  );
  const childIndices = new Map(children.map((name, index) => [name, index]));
  const directories = ["/"];
  for (const component of base.split("/").filter(Boolean))
    directories.push(
      path.join(directories[directories.length - 1] ?? "/", component),
    );
  const shapes = new Map<
    string,
    { numeric: object; bigint: object; directory: boolean }
  >();
  const directoryMethods = {
    isDirectory: () => true,
    isFile: () => false,
    isSymbolicLink: () => false,
  };
  const fileMethods = {
    isDirectory: () => false,
    isFile: () => true,
    isSymbolicLink: () => false,
  };
  function shape(name: string): {
    numeric: object;
    bigint: object;
    directory: boolean;
  } {
    const cached = shapes.get(name);
    if (cached) return cached;
    const index = directories.indexOf(name);
    const directory = index !== -1;
    const child = directory
      ? -1
      : (childIndices.get(path.basename(name)) ?? -1);
    if (!directory && (path.dirname(name) !== base || child === -1))
      throw new Error("unexpected synthetic entry");
    const fields = {
      dev: 1,
      ino: directory ? index + 1 : child + 1000,
      uid,
      gid: 0,
      mode: directory ? 0o40700 : 0o100600,
      nlink: directory ? 2 : 1,
      size: directory ? 0 : payload.length,
      mtimeMs: 1,
      ctimeMs: 1,
    };
    const methods = directory ? directoryMethods : fileMethods;
    const result = {
      numeric: { ...fields, ...methods },
      bigint: {
        ...Object.fromEntries(
          Object.entries(fields).map(([key, value]) => [key, BigInt(value)]),
        ),
        mtimeNs: 1000000n,
        ctimeNs: 1000000n,
        ...methods,
      },
      directory,
    };
    shapes.set(name, result);
    return result;
  }
  const descriptors = new Map<
    number,
    { name: string; closeAttempts: number; closed: boolean }
  >();
  const touched = new Set<string>();
  const openedChildren = new Map<string, number>();
  const readChildren = new Map<string, number>();
  let nextDescriptor = 1000000;
  let unregisteredCloses = 0;
  let updates = 0;
  let digests = 0;
  let hashMismatch = false;
  function descriptor(fd: number): {
    name: string;
    closeAttempts: number;
    closed: boolean;
  } {
    const found = descriptors.get(fd);
    if (!found || found.closed)
      throw new Error("synthetic descriptor is not owned");
    return found;
  }
  function logical(input: string): string {
    const match = /^\/proc\/self\/fd\/([0-9]+)(?:\/(.*))?$/u.exec(input);
    if (!match) return input;
    const owned = descriptor(Number(match[1]));
    return match[2] ? path.join(owned.name, match[2]) : owned.name;
  }
  const shapedFs = {
    constants: fs.constants,
    openSync(input: string, flags: number): number {
      const name = logical(input);
      const entry = shape(name);
      if (
        !(flags & fs.constants.O_NOFOLLOW) ||
        Boolean(flags & fs.constants.O_DIRECTORY) !== entry.directory
      )
        throw new Error("unexpected synthetic open flags");
      const fd = nextDescriptor++;
      descriptors.set(fd, { name, closeAttempts: 0, closed: false });
      if (!entry.directory)
        openedChildren.set(name, (openedChildren.get(name) ?? 0) + 1);
      return fd;
    },
    lstatSync(input: string, options?: { bigint: boolean }): object {
      const name = logical(input);
      const entry = shape(name);
      if (!entry.directory) touched.add(name);
      return options?.bigint ? entry.bigint : entry.numeric;
    },
    fstatSync(fd: number, options?: { bigint: boolean }): object {
      const entry = shape(descriptor(fd).name);
      return options?.bigint ? entry.bigint : entry.numeric;
    },
    readdirSync(input: string): string[] {
      if (logical(input) !== base)
        throw new Error("unexpected synthetic directory read");
      return [...children];
    },
    readFileSync(fd: number): Buffer {
      const name = descriptor(fd).name;
      if (shape(name).directory)
        throw new Error("synthetic directory is not a payload");
      readChildren.set(name, (readChildren.get(name) ?? 0) + 1);
      return payload;
    },
    closeSync(fd: number): void {
      const entry = descriptors.get(fd);
      if (!entry) {
        unregisteredCloses++;
        throw new Error("unregistered synthetic close");
      }
      entry.closeAttempts++;
      if (entry.closed) throw new Error("synthetic descriptor closed twice");
      entry.closed = true;
    },
  };
  // Delegate every update/digest to the real SHA implementation; observe without replacing its result.
  const observedCrypto = {
    createHash(algorithm: string) {
      const actual = crypto.createHash(algorithm);
      return {
        update(bytes: Uint8Array) {
          updates++;
          if (!Buffer.from(bytes).equals(payload)) hashMismatch = true;
          actual.update(bytes);
          return {
            digest(encoding: "hex") {
              digests++;
              const result = actual.digest(encoding);
              if (result !== expectedHash) hashMismatch = true;
              return result;
            },
          };
        },
      };
    },
  };
  const graph: unknown = runInNewContext(
    code,
    {
      fixtureFs: shapedFs,
      fixturePath: path,
      fixtureCrypto: observedCrypto,
      process,
      Buffer,
    },
    { timeout: 1000 },
  );
  if (typeof graph !== "function")
    throw new Error("private graph extraction failed");
  expect(failure(() => (graph as Graph)(base, "source"))).toMatchObject({
    message: "fixture_inventory_bound",
  });
  const completed = children
    .slice(0, 20000)
    .map((name) => path.join(base, name));
  expect([...touched]).toEqual(completed);
  expect([...openedChildren.keys()]).toEqual(completed);
  expect([...readChildren.keys()]).toEqual(completed);
  expect([...openedChildren.values()].every((count) => count === 1)).toBe(true);
  expect([...readChildren.values()].every((count) => count === 1)).toBe(true);
  expect(updates).toBe(20000);
  expect(digests).toBe(20000);
  expect(hashMismatch).toBe(false);
  expect(touched.has(path.join(base, children[20000] ?? "missing"))).toBe(
    false,
  );
  // B absolute components plus root: one initial directory chain, then a
  // separate B+2 descriptor chain for each of the 20,000 completed leaves.
  const components = base.split("/").filter(Boolean).length;
  expect(directories.length).toBe(components + 1);
  expect(descriptors.size).toBe(components + 1 + 20000 * (components + 2));
  expect(unregisteredCloses).toBe(0);
  expect(
    [...descriptors.values()].every(
      (entry) => entry.closed && entry.closeAttempts === 1,
    ),
  ).toBe(true);
}

describe("fixture105 fresh component traversal", () => {
  it("V1 matches independent Python inventories and freshly reads every included leaf", () => {
    for (const kind of ["source", "tools"] as const)
      world((w) => {
        for (const excluded of kind === "source"
          ? [".git", "node_modules", "dist"]
          : [".vite-temp"]) {
          fs.mkdirSync(path.join(w.base, excluded));
          fs.writeFileSync(path.join(w.base, excluded, "ignored"), "excluded");
        }
        if (kind === "tools")
          fs.symlinkSync("nested/leaf", path.join(w.base, "link"));
        const expected = oracle(w.base, kind);
        expect(w.graph(w.base, kind)).toEqual(expected);
        expect(
          w.calls.filter((event) => event.name === "readFileSync"),
        ).toHaveLength(1);
        expect(w.held.size).toBe(0);
        w.calls.length = 0;
        expect(w.graph(w.base, kind)).toEqual(expected);
        expect(
          w.calls.filter((event) => event.name === "readFileSync"),
        ).toHaveLength(1);
        expect(w.held.size).toBe(0);
      });
  });
  it("V2 preserves source and tools symlink rules without opening link targets", () => {
    for (const [target, kind, accepts] of [
      ["nested/leaf", "source", false],
      ["/etc/passwd", "tools", false],
      ["../../escape", "tools", false],
      ["link2", "tools", true],
    ] as const)
      world((w) => {
        fs.symlinkSync(target, path.join(w.base, "link"));
        fs.symlinkSync("nested/leaf", path.join(w.base, "link2"));
        if (accepts)
          expect(w.graph(w.base, kind)).toEqual(oracle(w.base, kind));
        else
          expect(() => w.graph(w.base, kind)).toThrow(
            kind === "source" ? "fixture_source_link" : "fixture_tool_link",
          );
        expect(
          w.calls.filter(
            (event) =>
              event.name === "openSync" &&
              String(event.args[0]).endsWith("/link"),
          ),
        ).toHaveLength(0);
        expect(w.held.size).toBe(0);
      });
  });
  it("V3 refuses links, hardlinks, wrong UID and special entries before outside reads", () => {
    for (const mode of [
      "file_link",
      "directory_link",
      "hardlink",
      "uid",
      "special",
    ])
      world((w) => {
        let changed = false;
        w.hook = (name, args, next) => {
          if (
            !changed &&
            name === "openSync" &&
            String(args[0]).endsWith(
              mode === "directory_link" ? "/nested" : "/leaf",
            )
          ) {
            changed = true;
            const target =
              mode === "directory_link" ? path.dirname(w.leaf) : w.leaf;
            if (mode.endsWith("link") && mode !== "hardlink") {
              fs.renameSync(target, target + "-saved");
              fs.symlinkSync("/etc", target);
            }
            if (mode === "hardlink") fs.linkSync(w.leaf, w.leaf + "-hard");
          }
          const value = next();
          if (name === "fstatSync" && targetFd(w, args[0]) && mode === "uid")
            return statChange(
              value,
              "uid",
              typeof Reflect.get(Object(value), "uid") === "bigint"
                ? 99999n
                : 99999,
            );
          if (
            name === "lstatSync" &&
            String(args[0]).endsWith("/leaf") &&
            mode === "special" &&
            typeof value === "object" &&
            value !== null
          )
            return new Proxy(value, {
              get(object, key): unknown {
                return key === "isFile" ||
                  key === "isDirectory" ||
                  key === "isSymbolicLink"
                  ? () => false
                  : Reflect.get(object, key);
              },
            });
          return value;
        };
        refused(w);
        expect(
          w.calls.filter((event) => event.name === "readFileSync"),
        ).toHaveLength(0);
      });
  });
  it("V4 refuses substituted symlinks at each fresh component acquisition", () => {
    for (const component of ["leaf", "subtree", "base", "ancestor"])
      world((w) => {
        const target =
          component === "leaf"
            ? w.leaf
            : component === "subtree"
              ? path.dirname(w.leaf)
              : component === "base"
                ? w.base
                : path.dirname(w.base);
        let cut = false;
        w.hook = (name, args, next) => {
          if (
            !cut &&
            name === "openSync" &&
            String(args[0]).endsWith("/" + path.basename(target))
          ) {
            cut = true;
            fs.renameSync(target, target + "-saved");
            fs.symlinkSync("/etc", target);
          }
          return next();
        };
        refused(w);
        expect(cut).toBe(true);
        expect(
          w.calls.filter((event) => event.name === "readFileSync"),
        ).toHaveLength(0);
      });
    world((w) => {
      let cut = false;
      w.hook = (name, args, next) => {
        if (
          !cut &&
          name === "openSync" &&
          String(args[0]).endsWith("/nested")
        ) {
          cut = true;
          fs.cpSync(path.dirname(w.leaf), path.dirname(w.leaf) + "-copy", {
            recursive: true,
          });
          fs.renameSync(path.dirname(w.leaf), path.dirname(w.leaf) + "-saved");
          fs.renameSync(path.dirname(w.leaf) + "-copy", path.dirname(w.leaf));
        }
        return next();
      };
      refused(w, "fixture_inventory_changed");
      expect(cut).toBe(true);
    });
  });
  it("V5 accepts restored shared churn and observes fresh permission failure after an earlier leaf", () => {
    world((w) => {
      duringRead(w, () => {
        const parent = path.dirname(w.base);
        fs.mkdirSync(path.join(parent, "sibling"));
        fs.rmdirSync(path.join(parent, "sibling"));
        fs.renameSync(parent, parent + "-saved");
        fs.renameSync(parent + "-saved", parent);
      });
      expect(w.graph(w.base, "source")).toEqual(oracle(w.base, "source"));
      expect(w.held.size).toBe(0);
    });
    world((w) => {
      fs.writeFileSync(w.leaf + "2", "second", { mode: 0o600 });
      const primary = Object.assign(
        new Error("fresh ancestor permission failure"),
        { code: "EACCES" },
      );
      let completedReads = 0;
      let cut = false;
      w.hook = (name, args, next) => {
        if (
          completedReads === 1 &&
          name === "openSync" &&
          String(args[0]).endsWith("/shared")
        ) {
          cut = true;
          throw primary;
        }
        const value = next();
        if (name === "readFileSync" && targetFd(w, args[0])) completedReads++;
        return value;
      };
      expect(failure(() => w.graph(w.base, "source"))).toBe(primary);
      expect(cut).toBe(true);
      expect(completedReads).toBe(1);
      expect(w.held.size).toBe(0);
    });
  });
  it("V6 preserves original numeric leaf read stability without claiming whole-graph snapshots", () => {
    for (const field of ["dev", "ino", "mtimeMs", "ctimeMs"])
      world((w) => {
        let read = false;
        w.hook = (name, args, next) => {
          const value = next();
          if (name === "readFileSync" && targetFd(w, args[0])) read = true;
          if (read && name === "fstatSync" && targetFd(w, args[0]))
            return statChange(
              value,
              field,
              Number(Reflect.get(Object(value), field)) + 1,
            );
          return value;
        };
        refused(w, "fixture_root_changed");
      });
    world((w) => {
      expect(w.graph(w.base, "source")).toEqual(oracle(w.base, "source"));
      expect(w.held.size).toBe(0);
    });
  });
  it("V7 preserves native errors and refuses short, growing, oversized and over-bound graphs", () => {
    for (const syscall of [
      "openSync",
      "lstatSync",
      "readFileSync",
      "readlinkSync",
      "readdirSync",
    ])
      world((w) => {
        const original = Object.assign(new Error("fixed syscall failure"), {
          code: "EACCES",
        });
        if (syscall === "readlinkSync")
          fs.symlinkSync("nested/leaf", path.join(w.base, "link"));
        let fired = false;
        w.hook = (name, _args, next) => {
          if (!fired && name === syscall) {
            fired = true;
            throw original;
          }
          return next();
        };
        expect(
          failure(() =>
            w.graph(w.base, syscall === "readlinkSync" ? "tools" : "source"),
          ),
        ).toBe(original);
        expect(w.held.size).toBe(0);
      });
    for (const mode of ["short", "growing", "oversized", "nodes"])
      world((w) => {
        if (mode === "nodes") {
          assertNodeBound(w.base);
          expect(w.held.size).toBe(0);
          return;
        }
        w.hook = (name, args, next) => {
          const value = next();
          if (name === "readFileSync" && targetFd(w, args[0])) {
            if (mode === "short" && Buffer.isBuffer(value))
              return value.subarray(1);
            if (mode === "growing") fs.appendFileSync(w.leaf, "growth");
          }
          if (
            mode === "oversized" &&
            name === "fstatSync" &&
            targetFd(w, args[0])
          )
            return statChange(
              value,
              "size",
              typeof Reflect.get(Object(value), "size") === "bigint"
                ? 67108865n
                : 67108865,
            );
          return value;
        };
        refused(w, mode === "nodes" ? "fixture_inventory_bound" : undefined);
      });
  });
  it("V8 accounts for every acquired descriptor before harness cleanup and preserves primary errors", () => {
    function ownership(w: World, uncertain: Set<Acquisition>): void {
      // Assertions run before world() finally can settle intentionally injected residuals.
      expect(w.unexpectedCloses).toEqual([]);
      for (const acquired of w.acquisitions) {
        expect(
          acquired.closeAttempts,
          "acquisition " + String(acquired.ordinal),
        ).toBe(1);
        expect(acquired.settled).toBe(!uncertain.has(acquired));
      }
      expect(
        [...w.active.values()]
          .map((entry) => entry.ordinal)
          .sort((a, b) => a - b),
      ).toEqual(
        [...uncertain].map((entry) => entry.ordinal).sort((a, b) => a - b),
      );
      expect([...w.held.keys()].sort((a, b) => a - b)).toEqual(
        [...uncertain].map((entry) => entry.fd).sort((a, b) => a - b),
      );
    }
    function poisoned(w: World): void {
      const calls = w.calls.length;
      const opened = w.acquisitions.length;
      expect(() => w.graph(w.base, "source")).toThrow(
        "fixture_inventory_changed",
      );
      expect(w.calls.length).toBe(calls);
      expect(w.acquisitions.length).toBe(opened);
    }
    for (const primary of [true, false])
      for (const closeCount of [1, 2])
        world((w) => {
          const first = new Error("primary read");
          const close = new Error("uncertain close");
          const secondaryClose = new Error("secondary close");
          const uncertain = new Set<Acquisition>();
          let remaining = closeCount;
          let reachedRead = false;
          w.hook = (name, args, next) => {
            if (name === "readFileSync" && targetFd(w, args[0])) {
              reachedRead = true;
              if (primary) throw first;
            }
            if (reachedRead && name === "closeSync" && remaining-- > 0) {
              const acquired = w.active.get(Number(args[0]));
              if (!acquired) throw new Error("fault target not owned");
              const closeFailure =
                uncertain.size === 0 ? close : secondaryClose;
              uncertain.add(acquired);
              throw closeFailure;
            }
            return next();
          };
          expect(failure(() => w.graph(w.base, "source"))).toBe(
            primary ? first : close,
          );
          expect(uncertain.size).toBe(closeCount);
          expect([...uncertain].map((entry) => entry.path)).toEqual(
            [w.leaf, path.dirname(w.leaf)].slice(0, closeCount),
          );
          ownership(w, uncertain);
          poisoned(w);
          ownership(w, uncertain);
        });
    for (const phase of [
      "first_open",
      "partial_initial_ancestry",
      "first_post_open_stat",
      "partial_child_chain_open",
      "partial_child_chain_close",
    ] as const)
      world((w) => {
        const original = new Error(phase);
        const uncertain = new Set<Acquisition>();
        let rootOpens = 0;
        let initialOpens = 0;
        let childOpens = 0;
        let injected = false;
        w.hook = (name, args, next) => {
          if (name === "openSync") {
            if (args[0] === "/") rootOpens++;
            if (rootOpens === 1) initialOpens++;
            else childOpens++;
            if (
              !injected &&
              ((phase === "first_open" && initialOpens === 1) ||
                (phase === "partial_initial_ancestry" && initialOpens === 3) ||
                (phase === "partial_child_chain_open" && childOpens === 3))
            ) {
              injected = true;
              throw original;
            }
          }
          if (
            !injected &&
            phase === "first_post_open_stat" &&
            name === "fstatSync"
          ) {
            expect(w.acquisitions.length).toBe(
              w.base.split("/").filter(Boolean).length + 1,
            );
            expect(w.active.size).toBe(1);
            injected = true;
            throw original;
          }
          if (
            !injected &&
            phase === "partial_child_chain_close" &&
            rootOpens === 2 &&
            name === "closeSync"
          ) {
            expect(childOpens).toBe(2);
            const acquired = w.active.get(Number(args[0]));
            if (!acquired)
              throw new Error("fresh component close target not owned");
            expect(acquired.path).toBe("/");
            uncertain.add(acquired);
            injected = true;
            throw original;
          }
          return next();
        };
        expect(
          failure(() => w.graph(w.base, "source")),
          phase,
        ).toBe(original);
        expect(injected, phase).toBe(true);
        if (phase === "partial_initial_ancestry")
          expect(w.acquisitions).toHaveLength(2);
        if (phase === "first_post_open_stat")
          expect(w.acquisitions.length).toBe(
            w.base.split("/").filter(Boolean).length + 1,
          );
        if (phase === "partial_child_chain_open") expect(childOpens).toBe(3);
        ownership(w, uncertain);
        if (uncertain.size) {
          poisoned(w);
          ownership(w, uncertain);
        }
      });
    world((w) => {
      const bound = boundRelease(w);
      const primary = new Error(
        "uncertain component close before root or release",
      );
      let injected = false;
      w.hook = (name, _args, next) => {
        if (name === "closeSync" && !injected) {
          injected = true;
          throw primary;
        }
        return next();
      };
      expect(failure(() => bound.graph(w.base, "source"))).toBe(primary);
      expect(injected).toBe(true);
      const uncertain = new Set(
        w.acquisitions.filter((entry) => !entry.settled),
      );
      expect(uncertain.size).toBe(1);
      ownership(w, uncertain);
      for (const invoke of [
        () => bound.graph(w.base, "source"),
        bound.root,
        bound.release,
      ]) {
        const count = w.calls.length;
        const acquired = w.acquisitions.length;
        expect(failure(invoke)).toMatchObject({
          message: "fixture_inventory_changed",
        });
        expect(w.calls.length).toBe(count);
        expect(w.acquisitions.length).toBe(acquired);
        ownership(w, uncertain);
      }
    });
  });
  it("V9 runs genuine release root comparisons across an internal cut and a subsequent call", () => {
    world((w) => {
      const before = w.graph(w.base, "source");
      fs.writeFileSync(w.leaf, "different governed bytes");
      w.calls.length = 0;
      expect(w.graph(w.base, "source")).not.toEqual(before);
      expect(
        w.calls.filter((event) => event.name === "readFileSync"),
      ).toHaveLength(1);
      expect(w.held.size).toBe(0);
    });
    for (const cut of [
      "between_root_scans",
      "after_completed_release",
    ] as const)
      world((w) => {
        const bound = boundRelease(w);
        let rootTailReads = 0;
        let releaseReads = 0;
        let mutationCut: number | undefined;
        let changed = false;
        let freshReads = 0;
        const rootReads: number[] = [];
        w.hook = (name, args, next) => {
          const value = next();
          if (name === "readFileSync" && targetFd(w, args[0], bound.witness)) {
            freshReads++;
            rootReads.push(rootTailReads);
          }
          if (name === "readdirSync" && args[0] === bound.bindingRoot)
            rootTailReads++;
          if (
            name === "readFileSync" &&
            targetFd(
              w,
              args[0],
              path.join(bound.bindingRoot, "bindings/RELEASE.json"),
            )
          ) {
            releaseReads++;
            // The first root reads RELEASE twice; this third read is readRelease itself,
            // after that genuine root call returned and before its second fresh check.
            if (cut === "between_root_scans" && releaseReads === 3) {
              expect(rootTailReads).toBe(1);
              mutationCut = freshReads;
              fs.writeFileSync(bound.witness, "mutated bound graph bytes", {
                mode: 0o600,
              });
              changed = true;
            }
          }
          return value;
        };
        if (cut === "after_completed_release") {
          expect(bound.release()).toHaveProperty(
            "binding.root",
            bound.bindingRoot,
          );
          expect(rootTailReads).toBe(2);
          expect(freshReads).toBe(2);
          mutationCut = freshReads;
          fs.writeFileSync(bound.witness, "mutated bound graph bytes", {
            mode: 0o600,
          });
          changed = true;
        }
        const refusal = failure(bound.release);
        expect(refusal).toMatchObject({ message: "fixture_root_changed" });
        expect(changed).toBe(true);
        expect(releaseReads).toBe(cut === "between_root_scans" ? 4 : 6);
        expect(mutationCut).toBeDefined();
        expect(freshReads).toBe((mutationCut ?? -1) + 1);
        expect(rootTailReads).toBe(cut === "between_root_scans" ? 1 : 2);
        expect(rootReads).toEqual(
          cut === "between_root_scans" ? [0, 1] : [0, 1, 2],
        );
        expect(w.held.size).toBe(0);
        expect(w.unexpectedCloses).toEqual([]);
      });
    // The actual await/context mutation witness remains in the unchanged native suite;
    // this group exercises synchronous release filesystem cuts, not an across-await filesystem claim.
  });
  it("V10 independently opens the complete absolute chain for every directory and file", async () => {
    world((w) => {
      for (let index = 0; index < 3; index++)
        fs.writeFileSync(w.leaf + String(index), "fresh", { mode: 0o600 });
      w.graph(w.base, "source");
      const roots = w.acquisitions.filter((entry) => entry.path === "/");
      expect(roots).toHaveLength(6); // Two directories and four leaves, each with its own root acquisition.
      const expected = [
        w.base,
        path.dirname(w.leaf),
        w.leaf,
        w.leaf + "0",
        w.leaf + "1",
        w.leaf + "2",
      ];
      const chains: string[][] = [];
      for (const acquired of w.acquisitions) {
        if (acquired.path === "/") chains.push([]);
        chains.at(-1)?.push(acquired.path);
      }
      expect(chains).toEqual(
        expected.map((target) => {
          const parts = target.split("/").filter(Boolean);
          return [
            "/",
            ...parts.map(
              (_part, index) => "/" + parts.slice(0, index + 1).join("/"),
            ),
          ];
        }),
      );
      expect(
        w.acquisitions.every(
          (entry) => entry.closeAttempts === 1 && entry.settled,
        ),
      ).toBe(true);
      expect(w.held.size).toBe(0);
      expect(w.unexpectedCloses).toEqual([]);
    });
    await nativeCallbackSelftest();
  });
});
