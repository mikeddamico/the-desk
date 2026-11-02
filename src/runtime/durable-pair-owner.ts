/** Two bounded operation files under a pre-registered private namespace; no self-provisioning or cleanup of unknown roots. */
import * as fs from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { sha, object, type Data } from "./technical-master-checks.js";
import {
  PairRefusal,
  requirePair,
  closed,
  jsonBytes,
  parsePairJson,
  authored,
  UPLOAD_ORDER,
  type FileName,
  type PairReceipt,
} from "./durable-pair-contract.js";
import type { RegisteredPair } from "./durable-pair-binding.js";

export interface OperationState extends Data {
  schema: "durable-pair-owner/1";
  operation_id: string;
  created_at: string;
  phase: "before_assessment" | "assessment_started" | "storage" | "finished";
  objects: Record<FileName, "not_started" | "pending" | "verified">;
  sql: "not_started" | "pending" | "not_committed" | "committed";
}
export interface FrozenIntent {
  receipt: PairReceipt;
  assessment: Data;
}
async function privateDirectory(path: string): Promise<void> {
  const info = await fs.lstat(path);
  requirePair(
    info.isDirectory() &&
      !info.isSymbolicLink() &&
      info.uid === process.getuid?.() &&
      (info.mode & 0o077) === 0 &&
      (await fs.realpath(path)) === path,
    "cleanup_pending",
    "cleanup",
  );
}
async function sync(path: string): Promise<void> {
  const file = await fs.open(
    path,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    await file.sync();
  } finally {
    await file.close();
  }
}
async function readPrivate(path: string): Promise<Buffer> {
  const file = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await file.stat();
    requirePair(
      before.isFile() &&
        before.uid === process.getuid?.() &&
        before.nlink === 1 &&
        (before.mode & 0o077) === 0 &&
        before.size <= 65536,
      "cleanup_pending",
      "cleanup",
    );
    const bytes = Buffer.alloc(before.size + 1);
    const result = await file.read(bytes, 0, bytes.length, 0);
    const after = await file.stat();
    requirePair(
      result.bytesRead === before.size &&
        [
          "dev",
          "ino",
          "uid",
          "gid",
          "mode",
          "nlink",
          "size",
          "mtimeMs",
          "ctimeMs",
        ].every((key) => Reflect.get(before, key) === Reflect.get(after, key)),
      "cleanup_pending",
      "cleanup",
    );
    return bytes.subarray(0, result.bytesRead);
  } finally {
    await file.close();
  }
}
async function exclusive(path: string, bytes: Buffer): Promise<void> {
  requirePair(bytes.length <= 65536, "resource_limit", "source");
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
  requirePair(
    (await readPrivate(path)).equals(bytes),
    "cleanup_pending",
    "cleanup",
  );
}
async function namespace(registration: RegisteredPair): Promise<string> {
  const expected = registration.namespace;
  await privateDirectory(expected.path);
  const actual = await fs.lstat(expected.path);
  requirePair(
    actual.dev === expected.dev &&
      actual.ino === expected.ino &&
      actual.uid === expected.uid &&
      sha(await readPrivate(join(expected.path, "OWNER.json"))) ===
        expected.owner_sha256,
    "cleanup_pending",
    "cleanup",
  );
  return expected.path;
}
function stateValue(
  value: unknown,
  operation: string,
  timestamp?: string,
): OperationState {
  const state = closed(value, [
    "schema",
    "operation_id",
    "created_at",
    "phase",
    "objects",
    "sql",
  ]);
  authored(state.operation_id, state.created_at);
  requirePair(
    state.schema === "durable-pair-owner/1" &&
      state.operation_id === operation &&
      (timestamp === undefined || state.created_at === timestamp) &&
      [
        "before_assessment",
        "assessment_started",
        "storage",
        "finished",
      ].includes(String(state.phase)) &&
      ["not_started", "pending", "not_committed", "committed"].includes(
        String(state.sql),
      ),
    "identity_conflict",
    "source",
  );
  const objects = closed(state.objects, UPLOAD_ORDER);
  requirePair(
    Object.values(objects).every(
      (status) =>
        status === "not_started" ||
        status === "pending" ||
        status === "verified",
    ),
    "source_mismatch",
    "source",
  );
  return state as unknown as OperationState;
}
async function intentAt(path: string): Promise<FrozenIntent | null> {
  try {
    const value = closed(
      parsePairJson(await readPrivate(join(path, "INTENT.json"))),
      ["receipt", "assessment"],
    );
    return {
      receipt: object(value.receipt) as unknown as PairReceipt,
      assessment: object(value.assessment),
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      Reflect.get(error, "code") === "ENOENT"
    )
      return null;
    throw error;
  }
}
export interface PairOwner {
  readonly fresh: boolean;
  readonly state: OperationState;
  readonly intent: FrozenIntent | null;
  update(): Promise<void>;
  freeze(intent: FrozenIntent): Promise<void>;
  close(settled: boolean): Promise<void>;
}
export async function openPairOwner(
  registration: RegisteredPair,
  operation: string,
  timestamp: string,
): Promise<PairOwner> {
  const parent = await namespace(registration);
  const root = join(parent, operation);
  let fresh = false;
  try {
    await fs.mkdir(root, { mode: 0o700 });
    fresh = true;
  } catch (error) {
    if (
      !(
        typeof error === "object" &&
        error !== null &&
        Reflect.get(error, "code") === "EEXIST"
      )
    )
      throw error;
  }
  await privateDirectory(root);
  const allowed = ["STARTED.json", "INTENT.json", "ACTIVE"];
  requirePair(
    (await fs.readdir(root)).every((name) => allowed.includes(name)),
    "cleanup_pending",
    "cleanup",
  );
  if (fresh) {
    const objects = Object.fromEntries(
      UPLOAD_ORDER.map((name) => [name, "not_started"]),
    ) as OperationState["objects"];
    await exclusive(
      join(root, "STARTED.json"),
      jsonBytes({
        schema: "durable-pair-owner/1",
        operation_id: operation,
        created_at: timestamp,
        phase: "before_assessment",
        objects,
        sql: "not_started",
      }),
    );
    await sync(root);
    await sync(parent);
  }
  const rootIdentity = await fs.lstat(root);
  const checkRoot = async (): Promise<void> => {
    await namespace(registration);
    await privateDirectory(root);
    const current = await fs.lstat(root);
    requirePair(
      current.dev === rootIdentity.dev &&
        current.ino === rootIdentity.ino &&
        current.uid === rootIdentity.uid &&
        current.mode === rootIdentity.mode,
      "cleanup_pending",
      "cleanup",
    );
  };
  const original = await readPrivate(join(root, "STARTED.json"));
  const state = stateValue(parsePairJson(original), operation, timestamp);
  const intent = await intentAt(root);
  try {
    await fs.mkdir(join(root, "ACTIVE"), { mode: 0o700 });
  } catch {
    throw new PairRefusal("cleanup_pending", "cleanup", true);
  }
  let previous = original;
  let released = false;
  return {
    fresh,
    state,
    intent,
    async update() {
      requirePair(!released, "cleanup_pending", "cleanup");
      await checkRoot();
      stateValue(state, operation, timestamp);
      requirePair(
        (await readPrivate(join(root, "STARTED.json"))).equals(previous),
        "cleanup_pending",
        "cleanup",
      );
      const bytes = jsonBytes(state);
      await exclusive(join(root, "STARTED.next"), bytes);
      await fs.rename(join(root, "STARTED.next"), join(root, "STARTED.json"));
      await sync(root);
      previous = bytes;
    },
    async freeze(value) {
      requirePair(
        !released &&
          !intent &&
          state.phase === "assessment_started" &&
          value.receipt.request.operation_id === operation &&
          value.receipt.request.created_at === timestamp,
        "identity_conflict",
        "source",
      );
      await checkRoot();
      await exclusive(join(root, "INTENT.json"), jsonBytes(value));
      await sync(root);
    },
    async close(settled) {
      if (!settled) return;
      requirePair(!released, "cleanup_pending", "cleanup");
      await checkRoot();
      await privateDirectory(join(root, "ACTIVE"));
      requirePair(
        (await fs.readdir(join(root, "ACTIVE"))).length === 0,
        "cleanup_pending",
        "cleanup",
      );
      await fs.rmdir(join(root, "ACTIVE"));
      await sync(root);
      released = true;
    },
  };
}
/** Committed recovery also checks any authenticated saved intent; absence is not authority to remeasure. */
export async function readOptionalPairIntent(
  registration: RegisteredPair,
  operation: string,
): Promise<FrozenIntent | null> {
  const root = join(await namespace(registration), operation);
  try {
    await fs.lstat(root);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      Reflect.get(error, "code") === "ENOENT"
    )
      return null;
    throw error;
  }
  await privateDirectory(root);
  const state = stateValue(
    parsePairJson(await readPrivate(join(root, "STARTED.json"))),
    operation,
  );
  const intent = await intentAt(root);
  requirePair(
    !intent ||
      (intent.receipt.request.operation_id === operation &&
        intent.receipt.request.created_at === state.created_at),
    "identity_conflict",
    "source",
  );
  return intent;
}
/** Explicit reconciliation never writes, takes ownership, or replaces a lost frozen intent. */
export async function readPairIntent(
  registration: RegisteredPair,
  operation: string,
): Promise<FrozenIntent> {
  const intent = await readOptionalPairIntent(registration, operation);
  requirePair(intent, "cleanup_pending", "cleanup");
  return intent;
}
