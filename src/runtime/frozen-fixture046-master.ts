// Fixed synthetic Fixture 0.4.6 construction only. No provider, storage or lifecycle authority.
// Contract: docs/frozen-fixture046-master.md. The shipped master/map are never requested here.
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { types } from "node:util";
import { canonicalJson } from "../identity/canonical-json.js";
import {
  assemblyRecipeHash,
  masterAssemblyMapHash,
} from "../identity/artifacts.js";
import { fingerprint } from "../identity/fingerprints.js";
import {
  asRecord,
  asArray,
  asString,
  type JsonObject,
} from "../identity/select.js";
import {
  fixturePack,
  loadFixtureJson,
  loadFixtureBytes,
  loadFoundationRows,
} from "../fixture/loader.js";
import { FIXTURE_V046_PINS } from "../fixture/pins.js";
import { verifyLedger } from "../fixture/ledger.js";
import { deepFreeze, type Tables, type Row } from "../fixture/rows.js";
import { measureCanonicalPcm } from "./audio-measurements.js";
import { planFrozenFixture046Render } from "./frozen-render046.js";
import {
  reconcileFrozenFixture046Responses,
  type PlanIdentity,
} from "./frozen-render046-response-lineage.js";

const PROFILE = "frozen-fixture046-master-construction/1" as const;
const PLANNER_PROFILE = "frozen-fixture046-render-planning/1" as const;
const INVOCATION_KEYS = ["profile", "purpose", "environment"] as const;
const UUID_FORM =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH_FORM = /^[0-9a-f]{64}$/;
const REQUEST_HASH_FORM = /^v1:[0-9a-f]{64}$/;
const PLANNED_COUNT = 9;
const CAP = 1048576;
const MASTER_HASH =
  "a7ecd855ef8a9100b4252fadfadf366efb866b72a060e9484f64002568354d73";
const RECIPE_HASH =
  "2006b38cd0f3461944c0aa7f28c80b25af0ffa9cf3b530d7fd61655ca8b5141f";
const MAP_HASH =
  "1235990a2aa5917fc4189aee646c04fa988722688f453eaa5b36699fd8fa6b67";
const ASSEMBLY_HASH =
  "302b5e4a143b499cf0a392c78638c6a7da889522cb9caa654b269fd87859487c";
const STING_HASH =
  "200e650736e88c18fdfa356473e8fc376b6e3d80f8f35639bc0d70e844643c09";
const LOCK_HASH =
  "b15c3dd040f41e9a60c9dc127a38003a2fc9083808f1c4cb1ec20f07cfa16485";
const EXECUTION_HASH =
  "46705afa025f02bebf7248c78fed648408cf156ab791102d77c47287893e91a7";
const TOOLCHAIN = new URL(
  "../../fixtures/frozen-master046-toolchain/",
  import.meta.url,
);
const REGISTRATION = "/tmp/the-desk-fixture046-runtime/receipt.json";
const WAV_MEMBERS = [
  "rb01_take0.wav",
  "rb02_take0.wav",
  "rb03_take0.wav",
  "rb04_take0.wav",
  "rb05_take0.wav",
  "rb06_take0.wav",
  "rb06_take1.wav",
  "rb07_take0.wav",
  "rb08_take0.wav",
  "rb09_take0.wav",
].map((name) => "fixture_audio/" + name);
let inFlight = false;

type Phase =
  | "invocation"
  | "initial_settings"
  | "request_plan"
  | "source"
  | "selection"
  | "recipe"
  | "bytes"
  | "executable"
  | "execution"
  | "measurement"
  | "pair"
  | "final_settings"
  | "publish";
type Code =
  | "invalid_invocation"
  | "unsafe_runtime_configuration"
  | "construction_busy"
  | "request_plan_blocked"
  | "plan_identity_invalid"
  | "source_identity_invalid"
  | "source_read_failed"
  | "historical_rows_invalid"
  | "historical_ledger_invalid"
  | "request_binding_invalid"
  | "selection_admission_invalid"
  | "historical_ids_invalid"
  | "recipe_identity_invalid"
  | "ordered_inputs_invalid"
  | "response_lineage_invalid"
  | "static_bytes_invalid"
  | "execution_profile_unavailable"
  | "executable_identity_invalid"
  | "execution_start_failed"
  | "execution_output_limit"
  | "execution_timed_out"
  | "execution_failed"
  | "master_bytes_invalid"
  | "master_content_mismatch"
  | "map_derivation_invalid"
  | "map_identity_mismatch"
  | "assembly_fingerprint_mismatch"
  | "pair_invalid"
  | "destination_collision"
  | "candidate_stage_failed"
  | "publication_failed"
  | "unexpected_failure";
export type FrozenMasterResult =
  | Readonly<{
      status: "blocked";
      profile: typeof PROFILE;
      code: Code;
      phase: Phase;
      cleanup: "not_started" | "complete" | "pending";
      owned_root: string | null;
    }>
  | Readonly<{
      status: "fixture_master_construction_pass";
      profile: typeof PROFILE;
      authority: "none";
      synthetic_placeholder: true;
      candidate_directory: string;
      cleanup_owner: "invoking_test";
      non_clearance: Readonly<
        Record<
          | "technical_validation"
          | "semantic_clearance"
          | "ready"
          | "production_clearance"
          | "provider_authority"
          | "selection_authority"
          | "persisted",
          false
        >
      >;
      receipt: Readonly<JsonObject>;
    }>;
class Refusal extends Error {
  constructor(
    readonly code: Code,
    readonly phase: Phase,
  ) {
    super(code);
  }
}
function demand(
  condition: unknown,
  code: Code,
  phase: Phase,
): asserts condition {
  if (!condition) throw new Refusal(code, phase);
}
function sha(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
function safeRuntimeConfiguration(): boolean {
  return (
    process.env.DESK_ENV === "test" &&
    process.env.PROVIDERS_ENABLED === "false" &&
    process.env.GENERATION_KILL_SWITCH === "true"
  );
}
function isValidInvocation(value: unknown): boolean {
  if (
    types.isProxy(value) ||
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  )
    return false;
  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  if (Reflect.ownKeys(value).length !== 3) return false;
  const data: Record<string, unknown> = {};
  for (const key of INVOCATION_KEYS) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable)
      return false;
    data[key] = descriptor.value;
  }
  return (
    data.profile === PROFILE &&
    data.purpose === "fixture_conformance" &&
    data.environment === "test"
  );
}

// Local extraction deliberately leaves the PR38 private API unchanged.
function ownValue(source: unknown, key: string): unknown {
  if (typeof source !== "object" || source === null) return undefined;
  const descriptor = Reflect.getOwnPropertyDescriptor(source, key);
  if (descriptor === undefined || !("value" in descriptor)) return undefined;
  return descriptor.value;
}

/** The nine own elements of a dense array carrier; undefined for anything else (holes, extras, other lengths). */
function nineItems(value: unknown): unknown[] | undefined {
  if (!Array.isArray(value) || value.length !== PLANNED_COUNT) return undefined;
  if (Reflect.getPrototypeOf(value) !== Array.prototype) return undefined;
  if (Reflect.ownKeys(value).length !== PLANNED_COUNT + 1) return undefined;
  const items: unknown[] = [];
  for (let index = 0; index < PLANNED_COUNT; index++) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor)) return undefined;
    items.push(descriptor.value);
  }
  return items;
}

function isForm(value: unknown, form: RegExp): value is string {
  return typeof value === "string" && form.test(value);
}

/**
 * Extracts the nine request identities from the planner result this invocation obtained itself. Only the planner's
 * exact synthetic success carrier is accepted, with identity forms checked here so a malformed carrier is refused
 * before any archive read; the pure core repeats the form checks for its own separately callable input. The planner's
 * source admission is not repeated and no caller-supplied eleven-field projection is ever read.
 */
function extractPlanIdentity(planned: unknown): PlanIdentity | undefined {
  if (
    ownValue(planned, "status") !== "fixture_render_planning_pass" ||
    ownValue(planned, "profile") !== PLANNER_PROFILE ||
    ownValue(planned, "fixture_stub") !== true ||
    ownValue(planned, "semantic_clearance") !== false ||
    ownValue(planned, "production_clearance") !== false
  )
    return undefined;
  const requests = nineItems(ownValue(planned, "requests"));
  const manifest = ownValue(planned, "semantic_manifest");
  const blocks = nineItems(ownValue(manifest, "render_blocks"));
  if (requests === undefined || blocks === undefined) return undefined;
  const adapter = ownValue(ownValue(blocks[0], "provider"), "provider");
  const model = ownValue(
    ownValue(blocks[0], "provider"),
    "concrete_model_identity",
  );
  const sameProvider = blocks.every(
    (block) =>
      ownValue(ownValue(block, "provider"), "provider") === adapter &&
      ownValue(ownValue(block, "provider"), "concrete_model_identity") ===
        model,
  );
  const version = ownValue(manifest, "adapter_contract_version");
  const manifestHash = ownValue(planned, "semantic_manifest_hash");
  const gateFingerprint = ownValue(planned, "render_gate_fingerprint");
  if (
    !sameProvider ||
    typeof adapter !== "string" ||
    typeof model !== "string" ||
    typeof version !== "string" ||
    !isForm(manifestHash, HASH_FORM) ||
    !isForm(gateFingerprint, HASH_FORM)
  )
    return undefined;
  const identities: PlanIdentity["requests"][number][] = [];
  for (const [index, request] of requests.entries()) {
    const programBlockId = ownValue(request, "program_block_id");
    const baseRequestHash = ownValue(request, "base_request_hash");
    if (
      !isForm(programBlockId, UUID_FORM) ||
      !isForm(baseRequestHash, REQUEST_HASH_FORM)
    )
      return undefined;
    identities.push({
      block_ordinal: index + 1,
      program_block_id: programBlockId,
      base_request_hash: baseRequestHash,
    });
  }
  return {
    adapter,
    concrete_model_identity: model,
    adapter_render_contract_version: version,
    semantic_manifest_hash: manifestHash,
    render_gate_fingerprint: gateFingerprint,
    requests: identities,
  };
}

interface SegmentInput {
  member: string;
  bytes: Buffer;
  frames: number;
  audio: Row;
  artifactId: string;
  block: Row | null;
  take: Row | null;
  selection: Row | null;
  hash: string;
}
function only(
  rows: readonly Row[] | undefined,
  predicate: (row: Row) => boolean,
  code: Code = "historical_ids_invalid",
): Row {
  const found = (rows ?? []).filter(predicate);
  demand(found.length === 1 && found[0], code, "selection");
  return found[0];
}
function text(value: unknown): string {
  return asString(value, "fixture identity");
}
function admitSelections(
  tables: Tables,
  plan: PlanIdentity,
): { block: Row; take: Row; selection: Row }[] {
  const blocks = [...(tables.render_blocks ?? [])].sort(
    (a, b) => Number(a.sequence) - Number(b.sequence),
  );
  demand(blocks.length === 9, "request_binding_invalid", "selection");
  const selections = tables.take_selections ?? [];
  demand(
    new Set(selections.map((s) => s.take_selection_id)).size ===
      selections.length,
    "selection_admission_invalid",
    "selection",
  );
  for (const selection of selections) {
    demand(
      [
        selection.take_selection_id,
        selection.render_block_id,
        selection.render_take_id,
        selection.actor_id,
      ].every((value) => typeof value === "string" && UUID_FORM.test(value)),
      "selection_admission_invalid",
      "selection",
    );
    demand(
      selection.supersedes_selection_id === null ||
        (typeof selection.supersedes_selection_id === "string" &&
          UUID_FORM.test(selection.supersedes_selection_id)),
      "selection_admission_invalid",
      "selection",
    );
    only(
      tables.accounts,
      (a) => a.account_id === selection.actor_id,
      "selection_admission_invalid",
    );
    if (selection.supersedes_selection_id !== null) {
      const previous = only(
        selections,
        (s) => s.take_selection_id === selection.supersedes_selection_id,
        "selection_admission_invalid",
      );
      demand(
        previous.render_block_id === selection.render_block_id &&
          typeof previous.created_at === "string" &&
          typeof selection.created_at === "string" &&
          Date.parse(previous.created_at) < Date.parse(selection.created_at),
        "selection_admission_invalid",
        "selection",
      );
    }
  }
  return blocks.map((block, index) => {
    const request = plan.requests[index];
    demand(
      request &&
        block.sequence === index + 1 &&
        block.program_block_id === request.program_block_id &&
        block.base_request_hash === request.base_request_hash,
      "request_binding_invalid",
      "selection",
    );
    const own = selections.filter(
      (s) => s.render_block_id === block.render_block_id,
    );
    const referenced = new Set(own.map((s) => s.supersedes_selection_id));
    const terminals = own.filter((s) => !referenced.has(s.take_selection_id));
    demand(
      terminals.length === 1 && terminals[0]?.decision === "approved",
      "selection_admission_invalid",
      "selection",
    );
    const selection = terminals[0];
    const take = only(
      tables.render_takes,
      (t) => t.render_take_id === selection.render_take_id,
      "selection_admission_invalid",
    );
    demand(
      typeof take.technical_validation === "object" &&
        take.technical_validation !== null &&
        !Array.isArray(take.technical_validation),
      "selection_admission_invalid",
      "selection",
    );
    const validation = asRecord(
      take.technical_validation,
      "technical validation",
    );
    demand(
      take.render_block_id === block.render_block_id &&
        validation.status === "pass" &&
        validation.reason_code === null &&
        Object.keys(validation).length === 2,
      "selection_admission_invalid",
      "selection",
    );
    const call = only(
      tables.provider_calls,
      (c) => c.provider_call_id === take.provider_call_id,
      "request_binding_invalid",
    );
    demand(
      call.request_fingerprint === request.base_request_hash,
      "request_binding_invalid",
      "selection",
    );
    return { block, take, selection };
  });
}
function plain(value: unknown, depth = 0, budget = { count: 0 }): boolean {
  if (++budget.count > 100000 || depth > 16 || types.isProxy(value))
    return false;
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  const prototype = Reflect.getPrototypeOf(value);
  if (
    prototype !== Object.prototype &&
    prototype !== null &&
    prototype !== Array.prototype
  )
    return false;
  const keys = Reflect.ownKeys(value);
  if (budget.count + keys.length > 100000) return false;
  for (const key of keys) {
    if (Array.isArray(value) && key === "length") continue;
    if (typeof key !== "string") return false;
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      !("value" in descriptor) ||
      !plain(descriptor.value, depth + 1, budget)
    )
      return false;
  }
  return !Array.isArray(value) || keys.length === value.length + 1;
}

async function ownedRead(path: string, limit: number): Promise<Buffer> {
  const file = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await file.stat();
    if (!before.isFile() || before.size > limit || before.nlink !== 1)
      throw new Error("owned file invalid");
    const data = Buffer.alloc(before.size + 1);
    const { bytesRead } = await file.read(data, 0, data.length, 0);
    const after = await file.stat();
    if (
      bytesRead !== before.size ||
      after.size !== before.size ||
      after.ino !== before.ino
    )
      throw new Error("owned file changed");
    return data.subarray(0, bytesRead);
  } finally {
    await file.close();
  }
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
    "execution_profile_unavailable",
    "executable",
  );
  const registration = asRecord(
    JSON.parse((await ownedRead(REGISTRATION, CAP)).toString()) as unknown,
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
    "execution_profile_unavailable",
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
      } catch {
        /* The caller's wait/inspect remains the positive proof. */
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

interface OwnedExecution {
  runtime: Binding;
  id?: string;
  name: string;
  created: boolean;
  settled: boolean;
  cleanupAttempted: boolean;
  clientPending: boolean;
}
function terminalSuccess(state: JsonObject): boolean {
  return (
    state.Status === "exited" &&
    state.Running === false &&
    state.Pid === 0 &&
    state.Error === "" &&
    state.ExitCode === 0 &&
    state.OOMKilled === false
  );
}
async function settle(
  owner: OwnedExecution,
  successful = false,
): Promise<void> {
  const target = owner.id ?? owner.name;
  if (!owner.created) return;
  if (!successful) owner.cleanupAttempted = true;
  const inspected = await docker(owner.runtime, [
    "inspect",
    "--format",
    "{{json .State}}",
    target,
  ]);
  demand(inspected.exit === 0, "execution_failed", "execution");
  let state = asRecord(
    JSON.parse(inspected.stdout.toString()) as unknown,
    "container state",
  );
  if (successful)
    demand(terminalSuccess(state), "execution_failed", "execution");
  if (
    state.Status === "created" &&
    state.Running === false &&
    state.Pid === 0
  ) {
    const removed = await docker(owner.runtime, ["rm", target]);
    demand(removed.exit === 0, "execution_failed", "execution");
    owner.settled = true;
    return;
  }
  if (state.Running === true) {
    demand(!successful, "execution_failed", "execution");
    const killed = await docker(owner.runtime, [
      "kill",
      "--signal",
      "KILL",
      target,
    ]);
    demand(killed.exit === 0, "execution_failed", "execution");
  }
  const waited = await docker(owner.runtime, ["wait", target]);
  demand(
    waited.exit === 0 &&
      (!successful || waited.stdout.toString().trim() === "0"),
    "execution_failed",
    "execution",
  );
  const final = await docker(owner.runtime, [
    "inspect",
    "--format",
    "{{json .State}}",
    target,
  ]);
  demand(final.exit === 0, "execution_failed", "execution");
  state = asRecord(
    JSON.parse(final.stdout.toString()) as unknown,
    "container state",
  );
  demand(
    state.Status === "exited" &&
      state.Running === false &&
      state.Pid === 0 &&
      state.Error === "",
    "execution_failed",
    "execution",
  );
  if (successful)
    demand(terminalSuccess(state), "execution_failed", "execution");
  owner.cleanupAttempted = true;
  const removed = await docker(owner.runtime, ["rm", target]);
  demand(removed.exit === 0, "execution_failed", "execution");
  owner.settled = true;
}
async function execute(
  owner: OwnedExecution,
  work: string,
  names: readonly string[],
): Promise<JsonObject> {
  const { runtime } = owner;
  let inspected: CommandResult;
  try {
    inspected = await docker(runtime, [
      "image",
      "inspect",
      "--format",
      "{{.Id}}",
      runtime.image,
    ]);
  } catch (error) {
    if (error instanceof CommandFailure)
      owner.clientPending ||= error.cleanupPending;
    throw new Refusal("executable_identity_invalid", "executable");
  }
  demand(
    inspected.exit === 0 &&
      inspected.stdout.toString().trim() === runtime.image,
    "executable_identity_invalid",
    "executable",
  );
  const args = [
    "create",
    "--name",
    owner.name,
    "--platform",
    "linux/amd64",
    "--pull",
    "never",
    "--network",
    "none",
    "--log-driver",
    "none",
    "--read-only",
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
  args.push("--mount", `type=bind,src=${work},dst=/work`);
  for (const name of [...names, "inputs.ffconcat"])
    args.push(
      "--mount",
      `type=bind,src=${join(work, name)},dst=/work/${name},readonly`,
    );
  args.push(
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
    ...asArray(runtime.profile.argv, "argv").map(text),
  );
  const deadline = performance.now() + 180000;
  owner.created = true; // Registered intent covers an uncertain create acknowledgement.
  try {
    const created = await docker(runtime, args);
    demand(
      created.exit === 0 &&
        /^[0-9a-f]{64}$/.test(created.stdout.toString().trim()),
      "execution_start_failed",
      "execution",
    );
    owner.id = created.stdout.toString().trim();
    const ran = await docker(
      runtime,
      ["start", "--attach", owner.id],
      Math.max(1, deadline - performance.now()),
      owner.id,
    );
    demand(ran.exit === 0, "execution_failed", "execution");
    const stateResult = await docker(runtime, [
      "inspect",
      "--format",
      "{{json .State}}",
      owner.id,
    ]);
    demand(stateResult.exit === 0, "execution_failed", "execution");
    const state = asRecord(
      JSON.parse(stateResult.stdout.toString()) as unknown,
      "state",
    );
    demand(terminalSuccess(state), "execution_failed", "execution");
    await settle(owner, true);
    return {
      profile: "fixture046-ffmpeg-execution/1",
      profile_sha256: EXECUTION_HASH,
      image_id: runtime.image,
      container_id: owner.id,
      executable_sha256: runtime.profile.executable_sha256,
      version: runtime.profile.version,
      build_configuration_sha256: runtime.profile.build_configuration_sha256,
      platform: "linux/amd64",
      argv: runtime.profile.argv,
      exit_code: 0,
      stdout_bytes: String(ran.stdout.length),
      stderr_bytes: String(ran.stderr.length),
      settlement: "container_stopped_removed_and_attach_client_reaped",
    };
  } catch (error) {
    if (error instanceof CommandFailure) {
      owner.clientPending ||= error.cleanupPending;
      throw new Refusal(
        error.reason === "cap"
          ? "execution_output_limit"
          : error.reason === "deadline"
            ? "execution_timed_out"
            : "execution_start_failed",
        "execution",
      );
    }
    throw error;
  }
}

/** Construct the one frozen pair from admitted response snapshots; never a clearance or persistent write. */
export async function constructFrozenFixture046Master(
  input: unknown,
): Promise<FrozenMasterResult> {
  let phase: Phase = "invocation";
  let root: string | undefined;
  let owner: OwnedExecution | undefined;
  let holdsLatch = false;
  let publicationUncertain = false;
  try {
    demand(isValidInvocation(input), "invalid_invocation", phase);
    phase = "initial_settings";
    demand(safeRuntimeConfiguration(), "unsafe_runtime_configuration", phase);
    demand(!inFlight, "construction_busy", phase);
    inFlight = true;
    holdsLatch = true;
    phase = "request_plan";
    const planned: unknown = await planFrozenFixture046Render({
      profile: PLANNER_PROFILE,
      purpose: "fixture_conformance",
      environment: "test",
    });
    demand(
      ownValue(planned, "status") !== "blocked",
      "request_plan_blocked",
      phase,
    );
    const plan = extractPlanIdentity(planned);
    demand(plan, "plan_identity_invalid", phase);
    phase = "source";
    try {
      const pack = fixturePack();
      demand(
        pack.pins.zipSha256 === FIXTURE_V046_PINS.zipSha256 &&
          pack.pins.packMembersSha256 === FIXTURE_V046_PINS.packMembersSha256,
        "source_identity_invalid",
        phase,
      );
    } catch {
      throw new Refusal("source_identity_invalid", phase);
    }
    let mapping: unknown;
    let recipe: JsonObject;
    let tables: Tables;
    const wavs: { path: string; bytes: Buffer }[] = [];
    let sting: Buffer;
    try {
      mapping = loadFixtureJson("fixture_persistence_conformance.json");
      tables = loadFoundationRows().tables;
      recipe = asRecord(loadFixtureJson("assembly_recipe.json"), "recipe");
      for (const path of WAV_MEMBERS)
        wavs.push({ path, bytes: Buffer.from(loadFixtureBytes(path)) });
      sting = Buffer.from(loadFixtureBytes("fixture_audio/sting.wav"));
    } catch {
      throw new Refusal("source_read_failed", phase);
    }
    phase = "selection";
    demand(
      plain(tables) && plain(mapping) && plain(recipe),
      "historical_rows_invalid",
      phase,
    );
    try {
      verifyLedger(
        tables,
        asArray(asRecord(mapping, "mapping").entries, "mapping entries").map(
          (entry) => asRecord(entry, "entry"),
        ),
      );
    } catch {
      throw new Refusal("historical_ledger_invalid", phase);
    }
    const selected = admitSelections(tables, plan);
    const recipeRow = only(tables.assembly_recipes, () => true);
    const mapRow = only(tables.master_assembly_maps, () => true);
    const masterAudio = only(
      tables.audio_artifacts,
      (a) => a.audio_artifact_id === mapRow.master_audio_artifact_id,
    );
    // Only these two master-audio fields are consumed. No stored hash, size,
    // duration or map payload enters construction or interval derivation.
    const masterAudioId = text(masterAudio.audio_artifact_id);
    const masterArtifactId = text(masterAudio.artifact_id);
    demand(
      recipeRow.assembly_recipe_id === "d1250023-0000-4000-8000-000000000001" &&
        recipeRow.artifact_id === "d1250005-0000-4000-8000-000000000015" &&
        mapRow.master_assembly_map_id ===
          "6a72fa3e-298b-4086-84dc-e8d931e61946" &&
        mapRow.artifact_id === "7754d030-5a38-4f6b-a2cd-66aacea66e90" &&
        masterAudioId === "88888888-8888-4888-8888-000000000012" &&
        masterArtifactId === "66666666-6666-4666-8666-000000000112" &&
        mapRow.assembly_recipe_id === recipeRow.assembly_recipe_id,
      "historical_ids_invalid",
      phase,
    );
    demand(
      only(tables.artifacts, (a) => a.artifact_id === masterArtifactId)
        .artifact_type === "audio/clean_master",
      "historical_ids_invalid",
      phase,
    );
    phase = "recipe";
    const recipeArtifact = only(
      tables.artifacts,
      (a) => a.artifact_id === recipeRow.artifact_id,
    );
    demand(
      recipe.assembly_recipe_id === recipeRow.assembly_recipe_id &&
        recipe.artifact_id === recipeRow.artifact_id &&
        recipeRow.version === "fixture-assembly-v3" &&
        recipe.assembly_recipe_version === recipeRow.version &&
        assemblyRecipeHash(recipe) === RECIPE_HASH &&
        recipe.assembly_recipe_hash === RECIPE_HASH &&
        assemblyRecipeHash(recipeArtifact.canonical_payload) === RECIPE_HASH,
      "recipe_identity_invalid",
      phase,
    );
    const ordered = asArray(
      recipe.ordered_audio_artifact_hashes,
      "ordered hashes",
    ).map(text);
    const speechHashes = selected.map(({ take }) =>
      text(
        only(
          tables.audio_artifacts,
          (a) => a.artifact_id === take.audio_artifact_id,
        ).audio_sha256,
      ),
    );
    demand(
      ordered.length === 10 &&
        ordered[2] === STING_HASH &&
        canonicalJson(asArray(recipe.static_asset_hashes, "static hashes")) ===
          canonicalJson([STING_HASH]) &&
        canonicalJson(ordered.filter((_, index) => index !== 2)) ===
          canonicalJson(speechHashes) &&
        new Set(speechHashes).size === 9,
      "ordered_inputs_invalid",
      phase,
    );
    phase = "bytes";
    const reconciled = reconcileFrozenFixture046Responses({
      plan,
      mapping,
      tables,
      wavs,
    });
    demand(
      (reconciled.authority as unknown) === "none" &&
        reconciled.status === "reconciled",
      "response_lineage_invalid",
      phase,
    );
    const staticMeasured = measureCanonicalPcm(sting);
    demand(
      staticMeasured.kind === "measured" &&
        staticMeasured.sha256 === STING_HASH &&
        staticMeasured.frame_count === "2400" &&
        staticMeasured.byte_length === "4844",
      "static_bytes_invalid",
      phase,
    );
    const parts: SegmentInput[] = selected.map(({ block, take, selection }) => {
      const response = reconciled.responses.find(
        (r) => r.historical_render_take_id === take.render_take_id,
      );
      demand(response, "response_lineage_invalid", phase);
      const bytes = wavs.find(
        (w) => w.path === response.wav.member_path,
      )?.bytes;
      demand(bytes, "response_lineage_invalid", phase);
      return {
        block,
        take,
        selection,
        bytes,
        member: response.wav.member_path,
        frames: Number(response.wav.frame_count),
        artifactId: text(take.audio_artifact_id),
        audio: only(
          tables.audio_artifacts,
          (a) => a.audio_artifact_id === response.historical_audio_row_id,
        ),
        hash: response.wav.sha256,
      };
    });
    const staticAudio = only(
      tables.audio_artifacts,
      (a) => a.audio_sha256 === STING_HASH,
    );
    parts.splice(2, 0, {
      member: "fixture_audio/sting.wav",
      bytes: sting,
      frames: 2400,
      hash: STING_HASH,
      artifactId: text(staticAudio.artifact_id),
      audio: staticAudio,
      block: null,
      take: null,
      selection: null,
    });
    phase = "executable";
    let runtime: Binding;
    try {
      runtime = await binding();
    } catch (error) {
      if (error instanceof Refusal) throw error;
      throw new Refusal("execution_profile_unavailable", phase);
    }
    root = await fs.mkdtemp(join(tmpdir(), "the-desk-fixture046-assembly-"));
    const identity = await fs.lstat(root);
    demand(
      identity.isDirectory() &&
        !identity.isSymbolicLink() &&
        identity.uid === process.getuid?.() &&
        (identity.mode & 0o077) === 0 &&
        (await fs.realpath(root)) === root,
      "execution_start_failed",
      "execution",
    );
    await exclusiveFile(
      join(root, "OWNER.json"),
      Buffer.from(
        canonicalJson({
          profile: PROFILE,
          owner: "invoking_test",
          recipe_hash: RECIPE_HASH,
          work: "work",
          candidate: "candidate",
        }) + "\n",
      ),
    );
    const work = join(root, "work");
    await fs.mkdir(work, { mode: 0o700 });
    const names = parts.map((part) => basename(part.member));
    demand(
      names.every((name) => /^(?:rb0[1-9]_take[01]|sting)\.wav$/.test(name)),
      "ordered_inputs_invalid",
      "recipe",
    );
    for (const [index, part] of parts.entries())
      await exclusiveFile(join(work, text(names[index])), part.bytes);
    await exclusiveFile(
      join(work, "inputs.ffconcat"),
      Buffer.from(
        "ffconcat version 1.0\n" +
          names.map((name) => `file '${name}'\n`).join(""),
      ),
    );
    owner = {
      runtime,
      name: "desk-" + basename(root),
      created: false,
      settled: false,
      cleanupAttempted: false,
      clientPending: false,
    };
    phase = "execution";
    const execution = await execute(owner, work, names);
    phase = "measurement";
    let master: Buffer;
    try {
      master = await ownedRead(join(work, "master.wav"), 114282);
    } catch {
      throw new Refusal("master_bytes_invalid", phase);
    }
    const measured = measureCanonicalPcm(master);
    demand(
      measured.kind === "measured" &&
        measured.byte_length === "114282" &&
        measured.frame_count === "57119",
      "master_bytes_invalid",
      phase,
    );
    demand(measured.sha256 === MASTER_HASH, "master_content_mismatch", phase);
    let byteCursor = 44;
    for (const part of parts) {
      demand(
        master
          .subarray(byteCursor, byteCursor + part.bytes.length - 44)
          .equals(part.bytes.subarray(44)),
        "master_content_mismatch",
        phase,
      );
      byteCursor += part.bytes.length - 44;
    }
    demand(byteCursor === master.length, "master_content_mismatch", phase);
    let cursor = 0;
    const segments = parts.map((part) => {
      const start = cursor;
      cursor += part.frames;
      return {
        kind: part.block ? "speech" : "static",
        audio_artifact_id: part.audio.audio_artifact_id,
        artifact_id: part.artifactId,
        audio_sha256: part.hash,
        render_block_id: part.block?.render_block_id ?? null,
        render_take_id: part.take?.render_take_id ?? null,
        take_selection_id: part.selection?.take_selection_id ?? null,
        program_block_id: part.block?.program_block_id ?? null,
        start_frame: start,
        end_frame: cursor,
        join_metadata: part.block
          ? { gap_frames: 0, method: "pcm-copy-concat" }
          : {
              gap_frames: 0,
              method: "pcm-copy-concat",
              placement: "between program blocks 2 and 3",
              preceding_program_block_id: parts[1]?.block?.program_block_id,
              following_program_block_id: parts[3]?.block?.program_block_id,
            },
      };
    });
    demand(
      cursor === 57119 && segments.length === 10,
      "map_derivation_invalid",
      phase,
    );
    const map: JsonObject = {
      assembly_recipe_id: recipeRow.assembly_recipe_id,
      assembly_recipe_hash: RECIPE_HASH,
      master_audio_artifact_id: masterAudioId,
      master_artifact_id: masterArtifactId,
      master_audio_hash: measured.sha256,
      sample_rate_hz: 48000,
      selected_audio_hashes: parts.map((part) => part.hash),
      segments,
      program_block_offsets: segments
        .filter((segment) => segment.kind === "speech")
        .map((segment) => ({
          program_block_id: segment.program_block_id,
          start_frame: segment.start_frame,
          end_frame: segment.end_frame,
        })),
      timing_method: "exact cumulative PCM frames",
      timing_confidence: "exact concatenation; no turn timings",
      master_assembly_map_id: mapRow.master_assembly_map_id,
      artifact_id: mapRow.artifact_id,
    };
    phase = "pair";
    const mapHash = masterAssemblyMapHash(map);
    demand(mapHash === MAP_HASH, "map_identity_mismatch", phase);
    map.master_assembly_map_hash = mapHash;
    const lineage = selected.map(({ block, take, selection }, index) => ({
      render_block_id: block.render_block_id,
      take_selection_id: selection.take_selection_id,
      render_take_id: take.render_take_id,
      take_index: take.take_index,
      audio_sha256: speechHashes[index],
    }));
    const assembly = fingerprint("assembly", {
      selected_take_lineage: lineage,
      assembly_recipe_hash: RECIPE_HASH,
      master_assembly_map_hash: mapHash,
      assembly_policy_version: "performance-render-0.1.4",
      gate_set_version: "build2-gates-v1",
    });
    demand(assembly === ASSEMBLY_HASH, "assembly_fingerprint_mismatch", phase);
    const receipt: JsonObject = {
      profile: "fixture046-master-construction-receipt/1",
      source: {
        snapshot: "process_cached_verified_pack",
        zip_sha256: FIXTURE_V046_PINS.zipSha256,
        pack_members_sha256: FIXTURE_V046_PINS.packMembersSha256,
        rows_sha256:
          "a27f4381bd6449bfb656c6431b56115a932e05c82791696fc293c701c0a58a7e",
        mapping_sha256:
          "963d8f5ae5c8d07350dcd39b0da4866cf137b223f736fe5f42ed8d57e803c30a",
        recipe_member_sha256:
          "5a7917106105ed8540ebe593a1bbc9acd2da45b880113e63046a43c00869ab42",
      },
      plan: {
        semantic_manifest_hash: plan.semantic_manifest_hash,
        render_gate_fingerprint: plan.render_gate_fingerprint,
      },
      selected_take_lineage: lineage,
      inputs: parts.map((part) => ({
        member: part.member,
        sha256: part.hash,
        byte_length: String(part.bytes.length),
        frame_count: String(part.frames),
      })),
      execution,
      output: {
        recipe_id: recipeRow.assembly_recipe_id,
        recipe_hash: RECIPE_HASH,
        map_id: mapRow.master_assembly_map_id,
        map_artifact_id: mapRow.artifact_id,
        map_hash: mapHash,
        master_audio_artifact_id: masterAudioId,
        master_artifact_id: masterArtifactId,
        master_sha256: measured.sha256,
        master_byte_length: measured.byte_length,
        master_frame_count: measured.frame_count,
        assembly_fingerprint: assembly,
      },
      provenance: {
        inputs: "historical_fixture_v0.4.6_synthetic_response",
        response_basis:
          "P&R 20.1: explicit frozen request-to-response mapping; identical WAV bytes are not evidence of the corrected performance",
        input_bytes_provenance:
          "predecessor Fixture v0.4.4 WAV member, byte-identical, preserved in I2A authored/fixture_audio",
        output: "constructed_from_verified_frozen_inputs",
        relabeled_as_new_generation: false,
      },
    };
    const candidate = join(root, "candidate");
    try {
      await fs.mkdir(candidate, { mode: 0o700 });
    } catch (error) {
      throw new Refusal(
        ownValue(error, "code") === "EEXIST"
          ? "destination_collision"
          : "candidate_stage_failed",
        phase,
      );
    }
    const mapBytes = Buffer.from(canonicalJson(map) + "\n");
    const receiptBytes = Buffer.from(canonicalJson(receipt) + "\n");
    try {
      await exclusiveFile(join(candidate, "master.wav"), master);
      await exclusiveFile(join(candidate, "map.json"), mapBytes);
      await exclusiveFile(
        join(candidate, "construction-receipt.json"),
        receiptBytes,
      );
      demand(
        (await ownedRead(join(candidate, "master.wav"), 114282)).equals(
          master,
        ) &&
          (await ownedRead(join(candidate, "map.json"), CAP)).equals(
            mapBytes,
          ) &&
          (
            await ownedRead(join(candidate, "construction-receipt.json"), CAP)
          ).equals(receiptBytes),
        "pair_invalid",
        phase,
      );
      await fs.rm(work, { recursive: true });
      await syncDirectory(candidate);
      await syncDirectory(root);
    } catch (error) {
      if (error instanceof Refusal) throw error;
      throw new Refusal("candidate_stage_failed", phase);
    }
    const result: FrozenMasterResult = deepFreeze({
      status: "fixture_master_construction_pass",
      profile: PROFILE,
      authority: "none",
      synthetic_placeholder: true,
      candidate_directory: candidate,
      cleanup_owner: "invoking_test",
      non_clearance: {
        technical_validation: false,
        semantic_clearance: false,
        ready: false,
        production_clearance: false,
        provider_authority: false,
        selection_authority: false,
        persisted: false,
      },
      receipt,
    } as const);
    phase = "final_settings";
    demand(safeRuntimeConfiguration(), "unsafe_runtime_configuration", phase);
    phase = "publish";
    publicationUncertain = true;
    try {
      await fs.mkdir(join(candidate, "COMMITTED"), { mode: 0o700 });
    } catch (error) {
      throw new Refusal(
        ownValue(error, "code") === "EEXIST"
          ? "destination_collision"
          : "publication_failed",
        phase,
      );
    }
    publicationUncertain = false;
    inFlight = false; // Ownership of the committed root transfers to the test.
    return result;
  } catch (error) {
    let clean = !publicationUncertain && owner?.clientPending !== true;
    if (owner?.created && !owner.settled) {
      if (owner.cleanupAttempted) clean = false;
      else {
        try {
          await settle(owner);
        } catch {
          clean = false;
        }
      }
    }
    if (root && clean) {
      try {
        await fs.rm(root, { recursive: true });
      } catch {
        clean = false;
      }
    }
    if (holdsLatch && clean) inFlight = false;
    return deepFreeze({
      status: "blocked",
      profile: PROFILE,
      code: error instanceof Refusal ? error.code : "unexpected_failure",
      phase: error instanceof Refusal ? error.phase : phase,
      cleanup: clean ? (root ? "complete" : "not_started") : "pending",
      owned_root: clean ? null : (root ?? null),
    } as const);
  }
}
