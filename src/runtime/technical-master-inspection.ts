/** Fixed inspection in the accepted runtime; no new tool supply or public command runner. */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import * as fs from "node:fs/promises";
import { constants, type Stats } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { canonicalJson, domainHash } from "../identity/canonical-json.js";
import {
  asRecord,
  asArray,
  asString,
  type JsonObject,
} from "../identity/select.js";
import {
  demand,
  sha,
  TechnicalRefusal as Refusal,
  type Phase,
} from "./technical-master-checks.js";
import {
  assertAcquired,
  type Acquired,
} from "./technical-master-acquisition.js";
const CAP = 1048576;
const TOOLCHAIN = new URL(
  "../../fixtures/frozen-master046-toolchain/",
  import.meta.url,
);
const REGISTRATION = "/tmp/the-desk-fixture046-runtime/receipt.json";
const LOCK_HASH =
  "b15c3dd040f41e9a60c9dc127a38003a2fc9083808f1c4cb1ec20f07cfa16485";
const EXECUTION_HASH =
  "46705afa025f02bebf7248c78fed648408cf156ab791102d77c47287893e91a7";
const INSPECTION_HASH =
  "7b2a24e57766f86379a78fa595c65baac44d53239618a27eda123522bc110dd8";
function text(value: unknown): string {
  return asString(value, "fixed inspection profile");
}
async function ownedRead(
  path: string,
  limit: number,
  expectedUid: number | undefined | "generated",
  phase: Phase,
): Promise<Buffer> {
  const code =
    phase === "executable"
      ? "executable_identity_invalid"
      : phase === "freshness"
        ? "subject_changed"
        : "decode_output_invalid";
  demand(
    expectedUid === "generated"
      ? limit === 72 &&
          phase === "inspection" &&
          path.endsWith("/work/decoded.sha256")
      : typeof expectedUid === "number" && Number.isSafeInteger(expectedUid),
    code,
    phase,
  );
  const file = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await file.stat();
    demand(
      before.isFile() &&
        before.size <= limit &&
        before.nlink === 1 &&
        (expectedUid === "generated"
          ? before.size === 72 && (before.mode & 0o022) === 0
          : before.uid === expectedUid),
      code,
      phase,
    );
    const data = Buffer.alloc(before.size + 1);
    const { bytesRead } = await file.read(data, 0, data.length, 0);
    const after = await file.stat();
    demand(
      bytesRead === before.size &&
        after.isFile() &&
        after.dev === before.dev &&
        after.ino === before.ino &&
        after.uid === before.uid &&
        after.gid === before.gid &&
        after.mode === before.mode &&
        after.nlink === before.nlink &&
        after.size === before.size &&
        after.mtimeMs === before.mtimeMs &&
        after.ctimeMs === before.ctimeMs,
      code,
      phase,
    );
    return data.subarray(0, bytesRead);
  } finally {
    await file.close();
  }
}
// Directory identity and exclusive creation provenance bind the generated output;
// namespace-local file UIDs do not authenticate an image-root writer.
async function assertOwnedDirectory(
  path: string,
  expected: Stats,
): Promise<void> {
  const actual = await fs.lstat(path);
  demand(
    actual.isDirectory() &&
      !actual.isSymbolicLink() &&
      actual.uid === process.getuid?.() &&
      (actual.mode & 0o077) === 0 &&
      actual.dev === expected.dev &&
      actual.ino === expected.ino &&
      actual.uid === expected.uid &&
      actual.gid === expected.gid &&
      actual.mode === expected.mode &&
      (await fs.realpath(path)) === path,
    "decode_output_invalid",
    "inspection",
  );
}
async function syncDirectory(path: string): Promise<void> {
  const directory = await fs.open(
    path,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}
async function exclusiveFile(path: string, bytes: Uint8Array): Promise<void> {
  const file = await fs.open(
    path,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await file.writeFile(bytes);
    await file.sync();
  } finally {
    await file.close();
  }
}
interface Binding {
  image: string;
  docker: "/usr/bin/docker" | "/usr/local/bin/docker";
  profile: JsonObject;
}
async function binding(): Promise<Binding> {
  const root = await fs.lstat("/tmp/the-desk-fixture046-runtime");
  demand(
    root.isDirectory() &&
      !root.isSymbolicLink() &&
      root.uid === process.getuid?.() &&
      (root.mode & 0o077) === 0,
    "executable_identity_invalid",
    "executable",
  );
  const registration = asRecord(
    JSON.parse(
      (
        await ownedRead(REGISTRATION, CAP, process.getuid(), "executable")
      ).toString(),
    ) as unknown,
    "runtime registration",
  );
  demand(
    Object.keys(registration).sort().join(",") ===
      [
        "schema",
        "status",
        "profile_sha256",
        "artifact_lock_sha256",
        "image_id",
        "identity_sha256",
        "docker_cli",
        "image_owned",
        "containers",
        "cleanup",
      ]
        .sort()
        .join(","),
    "executable_identity_invalid",
    "executable",
  );
  const profile = asRecord(
    JSON.parse(
      await fs.readFile(new URL("execution-profile.json", TOOLCHAIN), "utf8"),
    ) as unknown,
    "profile",
  );
  const lockRaw = await fs.readFile(new URL("artifact-lock.json", TOOLCHAIN));
  const lock = asRecord(
    JSON.parse(lockRaw.toString()) as unknown,
    "artifact lock",
  );
  demand(
    sha(lockRaw) === LOCK_HASH &&
      sha(Buffer.from(canonicalJson(profile))) === EXECUTION_HASH,
    "executable_identity_invalid",
    "executable",
  );
  const inventory = asArray(lock.installed_inventory, "inventory")
    .map((x) => asRecord(x, "inventory row"))
    .sort((a, b) =>
      text(a.package) < text(b.package)
        ? -1
        : text(a.package) > text(b.package)
          ? 1
          : 0,
    );
  const expected = {
    inventory,
    executables: lock.executables,
    libraries: lock.libraries,
    loader: lock.loader,
    version_capture_sha256: lock.version_capture_sha256,
    build_configuration_sha256: lock.build_configuration_sha256,
  };
  demand(
    registration.schema === "fixture046-runtime-registration/1" &&
      registration.status === "ready" &&
      registration.profile_sha256 === EXECUTION_HASH &&
      registration.artifact_lock_sha256 === LOCK_HASH &&
      registration.identity_sha256 ===
        sha(Buffer.from(canonicalJson(expected))) &&
      registration.cleanup === "containers_removed_image_retained",
    "executable_identity_invalid",
    "executable",
  );
  demand(
    typeof registration.image_id === "string" &&
      /^sha256:[0-9a-f]{64}$/.test(registration.image_id) &&
      (registration.docker_cli === "/usr/bin/docker" ||
        registration.docker_cli === "/usr/local/bin/docker"),
    "executable_identity_invalid",
    "executable",
  );
  return {
    image: registration.image_id,
    docker: registration.docker_cli,
    profile,
  };
}

interface CommandResult {
  exit: number | null;
  stdout: Buffer;
  stderr: Buffer;
}
class CommandFailure extends Error {
  constructor(
    readonly reason: "spawn" | "cap" | "deadline" | "reap",
    readonly cleanupPending = false,
  ) {
    super(reason);
  }
}
/** Private fixed-Docker capture; no public command runner or injected callback. */
async function docker(
  runtime: Binding,
  args: readonly string[],
  milliseconds = 10000,
  ownedContainer?: string,
): Promise<CommandResult> {
  const env = { ...process.env };
  for (const key of [
    "DOCKER_HOST",
    "DOCKER_CONTEXT",
    "DOCKER_TLS",
    "DOCKER_TLS_VERIFY",
    "DOCKER_CERT_PATH",
  ])
    Reflect.deleteProperty(env, key);
  let child: ReturnType<typeof spawn> | undefined;
  let fault: CommandFailure | undefined;
  let exit: number | null = null;
  let closed = false;
  const isClosed = (): boolean => closed;
  let pending = false;
  let resolveClose: (() => void) | undefined;
  let interrupt: (() => void) | undefined;
  const close = new Promise<void>((resolve) => {
    resolveClose = resolve;
  });
  const interrupted = new Promise<void>((resolve) => {
    interrupt = resolve;
  });
  const output: Buffer[][] = [[], []];
  const sizes = [0, 0];
  const captureLimit = ownedContainer ? CAP : 16384;
  let timer: NodeJS.Timeout | undefined;
  try {
    // Launch and every post-launch allocation/listener share this owner.
    child = spawn(
      runtime.docker,
      ["--host=unix:///var/run/docker.sock", ...args],
      {
        env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.once("close", (code) => {
      exit = code;
      closed = true;
      resolveClose?.();
    });
    child.on("error", () => {
      fault ??= new CommandFailure("spawn");
      interrupt?.();
    });
    for (const [index, stream] of [child.stdout, child.stderr].entries()) {
      if (!stream) throw new CommandFailure("spawn");
      const streamFault = (): void => {
        fault ??= new CommandFailure("spawn");
        interrupt?.();
      };
      stream.on("error", streamFault);
      stream.on("readable", () => {
        try {
          while (!fault) {
            const remaining = captureLimit - (sizes[index] ?? captureLimit);
            const value: unknown = stream.read(Math.min(65536, remaining + 1));
            if (value === null) break;
            if (!Buffer.isBuffer(value)) {
              streamFault();
              break;
            }
            if (remaining > 0 && value.length > 0) {
              output[index]?.push(Buffer.from(value.subarray(0, remaining)));
              sizes[index] =
                (sizes[index] ?? 0) + Math.min(value.length, remaining);
            }
            if (value.length > remaining) {
              fault ??= new CommandFailure("cap");
              stream.pause();
              interrupt?.();
              break;
            }
          }
        } catch {
          // Asynchronous reads and stream events use the same immutable fault
          // and termination owner as setup/deadline/capture-limit failures.
          streamFault();
        }
      });
    }
    timer = setTimeout(() => {
      fault ??= new CommandFailure("deadline");
      interrupt?.();
    }, milliseconds);
    await Promise.race([close, interrupted]);
  } catch (error) {
    fault ??=
      error instanceof CommandFailure ? error : new CommandFailure("spawn");
  } finally {
    if (timer) clearTimeout(timer);
    if (fault && ownedContainer) {
      // Never infer daemon settlement from attach-client exit. The original
      // fault stays primary even if this single termination request is uncertain.
      try {
        await docker(runtime, ["kill", "--signal", "KILL", ownedContainer]);
      } catch (error) {
        // Container settlement cannot prove this separate termination client reaped.
        if (error instanceof CommandFailure) pending ||= error.cleanupPending;
      }
    }
    if (child && !isClosed()) {
      for (const signal of ["SIGTERM", "SIGKILL"] as const) {
        try {
          child.kill(signal);
        } catch {
          pending = true;
        }
        let wait: NodeJS.Timeout | undefined;
        await Promise.race([
          close,
          new Promise<void>((resolve) => {
            wait = setTimeout(resolve, 5000);
          }),
        ]);
        if (wait) clearTimeout(wait);
        if (isClosed()) break;
      }
      if (!isClosed()) pending = true;
    }
    for (const stream of [child?.stdout, child?.stderr]) {
      try {
        stream?.destroy();
      } catch {
        pending = true;
      }
    }
  }
  if (pending) throw new CommandFailure(fault?.reason ?? "reap", true);
  if (fault) throw fault;
  return {
    exit,
    stdout: Buffer.concat(output[0] ?? []),
    stderr: Buffer.concat(output[1] ?? []),
  };
}

let pendingRoot: string | undefined;
let pendingClient = false;
interface InspectionResult {
  stdout: Buffer;
  stderr: Buffer;
  hashFile: string;
}
function terminal(state: JsonObject): boolean {
  return (
    state.Status === "exited" &&
    state.Running === false &&
    state.Pid === 0 &&
    state.Error === "" &&
    state.ExitCode === 0 &&
    state.OOMKilled === false
  );
}
/** Internal only: the acquisition brand and literal profile are checked before allocating or launching. */
export async function inspectMaster(
  acquired: Acquired,
): Promise<InspectionResult> {
  assertAcquired(acquired);
  if (pendingRoot || pendingClient)
    throw new Refusal("cleanup_pending", "cleanup", true);
  const { master, profile } = acquired.subject;
  demand(
    domainHash("technical-master-measurement-profile-v1", profile) ===
      INSPECTION_HASH,
    "profile_invalid",
    "source",
  );
  let runtime: Binding | undefined;
  let root: string | undefined;
  let work: string;
  let name = "";
  let created = false;
  let settled = false;
  let cleanupAttempted = false;
  let clientPending = false;
  let id: string | undefined;
  let primary: unknown;
  let result: InspectionResult | undefined;
  try {
    runtime = await binding();
    const inspectedImage = await docker(runtime, [
      "image",
      "inspect",
      "--format",
      "{{.Id}}",
      runtime.image,
    ]);
    demand(
      inspectedImage.exit === 0 &&
        inspectedImage.stdout.toString().trim() === runtime.image,
      "executable_identity_invalid",
      "executable",
    );
    root = await fs.mkdtemp(join(tmpdir(), "the-desk-mva-"));
    pendingRoot = root;
    work = join(root, "work");
    name = "desk-mva-" + randomBytes(16).toString("hex");
    const rootInfo = await fs.lstat(root);
    demand(
      rootInfo.isDirectory() &&
        !rootInfo.isSymbolicLink() &&
        rootInfo.uid === process.getuid?.() &&
        (rootInfo.mode & 0o077) === 0 &&
        (await fs.realpath(root)) === root,
      "inspection_launch_failed",
      "inspection",
    );
    await exclusiveFile(
      join(root, "OWNER.json"),
      Buffer.from(
        canonicalJson({
          schema: "technical-master-inspection-owner/1",
          name,
          work: "work",
          profile_sha256: INSPECTION_HASH,
        }) + "\n",
      ),
    );
    await fs.mkdir(work, { mode: 0o700 });
    const workInfo = await fs.lstat(work);
    await assertOwnedDirectory(work, workInfo);
    await exclusiveFile(join(work, "master.wav"), master);
    await syncDirectory(work);
    await acquired.recheck();
    const stagedHash = sha(master);
    demand(
      sha(
        await ownedRead(
          join(work, "master.wav"),
          8388608,
          process.getuid(),
          "freshness",
        ),
      ) === stagedHash &&
        canonicalJson(await fs.readdir(work)) === canonicalJson(["master.wav"]),
      "subject_changed",
      "freshness",
    );
    await assertOwnedDirectory(root, rootInfo);
    await assertOwnedDirectory(work, workInfo);
    const args = [
      "create",
      "--name",
      name,
      "--platform",
      "linux/amd64",
      "--pull",
      "never",
      "--network",
      "none",
      "--log-driver",
      "none",
      "--read-only",
      "--ulimit",
      "core=0:0",
      "--ulimit",
      "fsize=16384:16384",
      "--workdir",
      "/work",
    ];
    for (const key of [
      "HTTP_PROXY",
      "HTTPS_PROXY",
      "ALL_PROXY",
      "NO_PROXY",
      "http_proxy",
      "https_proxy",
      "all_proxy",
      "no_proxy",
    ])
      args.push("--env", key + "=");
    args.push(
      "--mount",
      `type=bind,src=${work},dst=/work`,
      "--mount",
      `type=bind,src=${join(work, "master.wav")},dst=/work/master.wav,readonly`,
      runtime.image,
      "/usr/bin/env",
      "-i",
      "PATH=/usr/bin:/bin",
      "LC_ALL=C",
      "TZ=UTC",
      "/usr/bin/timeout",
      "--signal=TERM",
      "--kill-after=20s",
      "120s",
      ...asArray(profile.argv, "inspection argv").map(text),
    );
    const deadline = performance.now() + 180000;
    created = true;
    const creation = await docker(runtime, args);
    demand(
      creation.exit === 0 &&
        /^[0-9a-f]{64}$/.test(creation.stdout.toString().trim()),
      "inspection_launch_failed",
      "inspection",
    );
    id = creation.stdout.toString().trim();
    const attached = await docker(
      runtime,
      ["start", "--attach", id],
      Math.max(1, deadline - performance.now()),
      id,
    );
    demand(attached.exit === 0, "inspection_failed", "inspection");
    const state = await docker(runtime, [
      "inspect",
      "--format",
      "{{json .State}}",
      id,
    ]);
    demand(
      state.exit === 0 &&
        terminal(
          asRecord(JSON.parse(state.stdout.toString()) as unknown, "state"),
        ),
      "inspection_failed",
      "inspection",
    );
    const wait = await docker(runtime, ["wait", id]);
    demand(
      wait.exit === 0 && wait.stdout.toString().trim() === "0",
      "inspection_failed",
      "inspection",
    );
    const final = await docker(runtime, [
      "inspect",
      "--format",
      "{{json .State}}",
      id,
    ]);
    demand(
      final.exit === 0 &&
        terminal(
          asRecord(JSON.parse(final.stdout.toString()) as unknown, "state"),
        ),
      "inspection_failed",
      "inspection",
    );
    cleanupAttempted = true;
    const removed = await docker(runtime, ["rm", id]);
    demand(removed.exit === 0, "inspection_failed", "inspection");
    settled = true;
    await assertOwnedDirectory(root, rootInfo);
    await assertOwnedDirectory(work, workInfo);
    demand(
      canonicalJson((await fs.readdir(work)).sort()) ===
        canonicalJson(["decoded.sha256", "master.wav"]),
      "inspection_failed",
      "inspection",
    );
    demand(
      sha(
        await ownedRead(
          join(work, "master.wav"),
          8388608,
          process.getuid(),
          "freshness",
        ),
      ) === stagedHash && sha(master) === stagedHash,
      "subject_changed",
      "freshness",
    );
    // Only this absent-before-launch basename was writable by the fixed admitted
    // container. Read it after positive settlement/removal, with private directory
    // identity intact; its observed UID/GID are namespace-local metadata.
    const hashFile = await ownedRead(
      join(work, "decoded.sha256"),
      72,
      "generated",
      "inspection",
    );
    demand(hashFile.length === 72, "decode_output_invalid", "inspection");
    await assertOwnedDirectory(root, rootInfo);
    await assertOwnedDirectory(work, workInfo);
    demand(
      canonicalJson((await fs.readdir(work)).sort()) ===
        canonicalJson(["decoded.sha256", "master.wav"]),
      "decode_output_invalid",
      "inspection",
    );
    result = {
      stdout: attached.stdout,
      stderr: attached.stderr,
      hashFile: hashFile.toString("ascii"),
    };
  } catch (error) {
    if (error instanceof CommandFailure) {
      clientPending = error.cleanupPending;
      primary = new Refusal(
        error.reason === "cap"
          ? "inspection_output_limit"
          : error.reason === "deadline"
            ? "inspection_timeout"
            : "inspection_launch_failed",
        "inspection",
        clientPending,
      );
    } else primary = error;
  } finally {
    if (created && runtime && !settled && !cleanupAttempted) {
      try {
        const target = id ?? name;
        const state = await docker(runtime, [
          "inspect",
          "--format",
          "{{json .State}}",
          target,
        ]);
        demand(state.exit === 0, "cleanup_pending", "cleanup");
        let value = asRecord(
          JSON.parse(state.stdout.toString()) as unknown,
          "state",
        );
        if (value.Running === true)
          demand(
            (await docker(runtime, ["kill", "--signal", "KILL", target]))
              .exit === 0,
            "cleanup_pending",
            "cleanup",
          );
        if (value.Status !== "created")
          demand(
            (await docker(runtime, ["wait", target])).exit === 0,
            "cleanup_pending",
            "cleanup",
          );
        const final = await docker(runtime, [
          "inspect",
          "--format",
          "{{json .State}}",
          target,
        ]);
        demand(final.exit === 0, "cleanup_pending", "cleanup");
        value = asRecord(
          JSON.parse(final.stdout.toString()) as unknown,
          "state",
        );
        demand(
          value.Running === false &&
            value.Pid === 0 &&
            value.Error === "" &&
            (value.Status === "created" || value.Status === "exited"),
          "cleanup_pending",
          "cleanup",
        );
        demand(
          (await docker(runtime, ["rm", target])).exit === 0,
          "cleanup_pending",
          "cleanup",
        );
        settled = true;
      } catch {
        /* The primary refusal remains primary; the owned root stays latched. */
      }
    }
    if (clientPending) pendingClient = true;
    if (root && (!created || settled) && !clientPending) {
      try {
        await fs.rm(root, { recursive: true });
        pendingRoot = undefined;
      } catch {
        /* Preserve pending ownership. */
      }
    }
  }
  if (pendingRoot || pendingClient)
    throw new Refusal(
      primary instanceof Refusal ? primary.code : "inspection_failed",
      primary instanceof Refusal ? primary.phase : "inspection",
      true,
    );
  if (primary)
    throw primary instanceof Error
      ? primary
      : new Refusal("inspection_failed", "inspection");
  demand(result, "inspection_failed", "inspection");
  return result;
}
