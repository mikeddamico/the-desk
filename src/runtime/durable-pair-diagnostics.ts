/** Optional private diagnostic evidence, never gate/ownership/commit authority. */
import { canonicalJson } from "../identity/canonical-json.js";
import * as fs from "node:fs/promises";
import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";
import { UPLOAD_ORDER } from "./durable-pair-contract.js";
import { transportDiagnosticSnapshot } from "./durable-pair-r2.js";

export type DiagnosticPersistence = "saved" | "not_requested" | "failed";
const STAGES = [
  "start",
  "credentials",
  "signing",
  "signed",
  "dispatch",
  "headers",
  "consumed",
  "refused",
  "cleanup",
];
const CODES = [
  "storage_timeout",
  "storage_response_invalid",
  "storage_readback_invalid",
  "resource_limit",
  "cleanup_pending",
  "binding_unavailable",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ECONNREFUSED",
  "EPIPE",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "OTHER",
];
function demand(value: unknown): asserts value {
  if (!value) throw new Error("diagnostic_invalid");
}
function integer(value: unknown, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= max
  );
}
function keys(value: object, allowed: readonly string[]): boolean {
  return Object.keys(value).every((k) => allowed.includes(k));
}
function record(value: unknown): asserts value is Record<string, unknown> {
  demand(typeof value === "object" && value !== null && !Array.isArray(value));
}
function encode(snapshot: unknown): Buffer {
  record(snapshot);
  demand(
    keys(snapshot, [
      "schema",
      "complete",
      "saturated",
      "dropped_records",
      "requests_started",
      "requests_closed",
      "records",
    ]),
  );
  demand(
    snapshot.schema === "durable-pair-transport-diagnostics/1" &&
      typeof snapshot.complete === "boolean" &&
      typeof snapshot.saturated === "boolean",
  );
  demand(
    integer(snapshot.dropped_records, 65535) &&
      integer(snapshot.requests_started, 65535) &&
      integer(snapshot.requests_closed, 65535) &&
      snapshot.requests_closed <= snapshot.requests_started,
  );
  demand(
    snapshot.saturated === snapshot.dropped_records > 0 &&
      snapshot.complete ===
        (!snapshot.saturated &&
          snapshot.requests_started === snapshot.requests_closed),
  );
  demand(Array.isArray(snapshot.records) && snapshot.records.length <= 512);
  const rows: readonly unknown[] = snapshot.records;
  for (const row of rows) {
    record(row);
    demand(
      keys(row, [
        "method",
        "object",
        "stage",
        "elapsed_ms",
        "status",
        "bytes",
        "code",
        "cleanup_pending",
      ]),
    );
    demand(
      (row.method === "PUT" || row.method === "GET") &&
        typeof row.object === "string" &&
        ((UPLOAD_ORDER as readonly string[]).includes(row.object) ||
          row.object === "OTHER") &&
        typeof row.stage === "string" &&
        STAGES.includes(row.stage) &&
        integer(row.elapsed_ms, 600000),
    );
    demand(
      row.status === undefined ||
        (integer(row.status, 599) && row.status >= 200),
    );
    demand(row.bytes === undefined || integer(row.bytes, 5760044));
    demand(
      row.code === undefined ||
        (typeof row.code === "string" && CODES.includes(row.code)),
    );
    demand(
      row.cleanup_pending === undefined ||
        typeof row.cleanup_pending === "boolean",
    );
  }
  const bytes = Buffer.from(canonicalJson(snapshot) + "\n");
  demand(bytes.length <= 131072);
  return bytes;
}
/** A configured directory must already exist and be private; no provisioning or replacement. */
export async function persistTransportDiagnostics(
  directory: string | undefined,
  snapshot: unknown,
): Promise<DiagnosticPersistence> {
  if (directory === undefined) return "not_requested";
  let dir: fs.FileHandle | undefined;
  let file: fs.FileHandle | undefined;
  let result: DiagnosticPersistence;
  try {
    demand(isAbsolute(directory) && directory.length <= 4096);
    const bytes = encode(snapshot);
    const before = await fs.lstat(directory);
    demand(
      before.isDirectory() &&
        !before.isSymbolicLink() &&
        before.uid === process.getuid?.() &&
        (before.mode & 0o077) === 0 &&
        (await fs.realpath(directory)) === directory,
    );
    dir = await fs.open(
      directory,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const held = await dir.stat();
    demand(
      held.dev === before.dev &&
        held.ino === before.ino &&
        held.uid === before.uid &&
        (held.mode & 0o077) === 0,
    );
    const anchor = `/proc/self/fd/${String(dir.fd)}`;
    const id = randomUUID();
    const temp = `${anchor}/.transport-${id}.tmp`;
    const final = `${anchor}/transport-${id}.json`;
    file = await fs.open(
      temp,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    const initial = await file.stat();
    demand(
      initial.isFile() &&
        initial.nlink === 1 &&
        initial.uid === held.uid &&
        (initial.mode & 0o077) === 0,
    );
    await file.writeFile(bytes);
    await file.sync();
    const written = await file.stat();
    demand(
      written.size === bytes.length &&
        written.nlink === 1 &&
        written.ino === initial.ino &&
        written.dev === initial.dev &&
        (written.mode & 0o077) === 0,
    );
    // Hard-link publication is atomic and cannot replace an existing destination.
    await fs.link(temp, final);
    const published = await fs.lstat(final);
    demand(
      published.ino === written.ino &&
        published.dev === written.dev &&
        published.nlink === 2,
    );
    await fs.unlink(temp);
    await dir.sync();
    const after = await fs.lstat(directory);
    const saved = await fs.lstat(final);
    demand(
      after.dev === held.dev &&
        after.ino === held.ino &&
        !after.isSymbolicLink() &&
        (after.mode & 0o077) === 0 &&
        saved.nlink === 1 &&
        saved.size === bytes.length &&
        (saved.mode & 0o077) === 0,
    );
    result = "saved";
  } catch {
    result =
      "failed"; /* Retain any private partial file as evidence; never erase uncertainty. */
  } finally {
    try {
      await file?.close();
    } catch {
      result = "failed";
    }
    try {
      await dir?.close();
    } catch {
      result = "failed";
    }
  }
  return result;
}

/** Terminal-only snapshot. SIGKILL/process loss before finally can leave no snapshot. */
export async function withTransportDiagnostics<T>(
  action: () => Promise<T>,
  directory: string | undefined,
  report: (status: DiagnosticPersistence) => void,
): Promise<T> {
  try {
    return await action();
  } finally {
    if (directory !== undefined) {
      let status: DiagnosticPersistence = "failed";
      try {
        status = await persistTransportDiagnostics(
          directory,
          transportDiagnosticSnapshot(),
        );
      } catch {
        /* Preserve the original action outcome. */
      }
      try {
        report(status);
      } catch {
        /* Reporting must not replace the action outcome. */
      }
    }
  }
}
