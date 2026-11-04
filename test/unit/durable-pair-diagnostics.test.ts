/** Offline metadata controls. No sockets connect and no credentials are read. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { HttpRequest } from "@smithy/core/transport";
import { clearCredentialCache } from "@smithy/signature-v4";
import {
  r2Credentials,
  type RegisteredPair,
} from "../../src/runtime/durable-pair-binding.js";
import type { TransportDiagnosticSnapshot } from "../../src/runtime/durable-pair-r2.js";

vi.mock("../../src/runtime/durable-pair-binding.js", async (original) => {
  const actual =
    await original<
      typeof import("../../src/runtime/durable-pair-binding.js")
    >();
  return {
    ...actual,
    r2Credentials: vi.fn(() => ({
      accessKeyId: "TESTONLYID",
      secretAccessKey: "test-only-not-a-credential",
    })),
  };
});
vi.mock("@smithy/signature-v4", async (original) => {
  const actual = await original<typeof import("@smithy/signature-v4")>();
  return {
    ...actual,
    clearCredentialCache: vi.fn(actual.clearCredentialCache),
  };
});
vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof import("node:fs/promises")>();
  return { ...actual, link: vi.fn(actual.link) };
});
const operation = "b6200001-0000-4000-8000-000000000001";
const registration = {
  storage: {
    endpoint_origin:
      "https://00000000000000000000000000000000.r2.cloudflarestorage.com",
    bucket: "test-bucket",
    prefix: "development/proof",
  },
} as RegisteredPair;
const payload = Buffer.from("offline transport bytes");
const sources: {
  source: IncomingMessage;
  destroy: IncomingMessage["destroy"];
}[] = [];
const roots: string[] = [];
async function scratch(): Promise<string> {
  const root = await fs.mkdtemp(
    join(await fs.realpath(tmpdir()), "desk-diagnostics-test-"),
  );
  roots.push(root);
  return root;
}
function hash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
function message(
  status = 200,
  chunks: Buffer[] = [payload],
  raw: string[] = ["content-length", String(Buffer.concat(chunks).length)],
  complete = true,
  stalled = false,
): IncomingMessage {
  const source = new IncomingMessage(new Socket());
  source.statusCode = status;
  source.rawHeaders = raw;
  source.headers = Object.fromEntries(
    Array.from({ length: raw.length / 2 }, (_value, index) => [
      (raw[index * 2] ?? "").toLowerCase(),
      raw[index * 2 + 1] ?? "",
    ]),
  );
  source._read = () => {
    if (stalled) return;
    source._read = () => undefined;
    for (const chunk of chunks) source.push(chunk);
    source.complete = complete;
    source.push(null);
  };
  sources.push({ source, destroy: source.destroy.bind(source) });
  return source;
}
function handleResponses(
  response: (request: HttpRequest) => IncomingMessage = () => message(),
) {
  return vi
    .spyOn(NodeHttpHandler.prototype, "handle")
    .mockImplementation(async function (this: NodeHttpHandler, request) {
      // Exercise real external-Agent adoption/destruction without issuing an HTTP request.
      const config = await (Reflect.get(
        this,
        "configProvider",
      ) as Promise<unknown>);
      Reflect.set(this, "config", config);
      const source = response(request);
      return {
        response: {
          statusCode: source.statusCode ?? -1,
          headers: source.headers as Record<string, string>,
          body: source,
        },
      };
    });
}
beforeEach(async () => {
  const actualFs =
    await vi.importActual<typeof import("node:fs/promises")>(
      "node:fs/promises",
    );
  vi.mocked(fs.link).mockReset().mockImplementation(actualFs.link);
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.resetModules();
  const sdk = await vi.importActual<typeof import("@smithy/signature-v4")>(
    "@smithy/signature-v4",
  );
  vi.mocked(clearCredentialCache)
    .mockReset()
    .mockImplementation(sdk.clearCredentialCache);
  sdk.clearCredentialCache();
  vi.mocked(r2Credentials).mockReset().mockReturnValue({
    accessKeyId: "TESTONLYID",
    secretAccessKey: "test-only-not-a-credential",
  });
});
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  // Intentional nonsettlement is asserted before this test-owned cleanup, never repaired in production.
  for (const { source, destroy } of sources) {
    if (!source.closed && source.destroyed)
      Reflect.set(source, "destroyed", false);
    if (!source.closed) Reflect.apply(destroy, source, []);
  }
  sources.length = 0;
  for (const root of roots.splice(0))
    await fs.rm(root, { recursive: true, force: true });
});

describe("bounded stage diagnostics", () => {
  it("T14 preserves outcomes and emits bounded redacted method-specific metadata", async () => {
    vi.spyOn(Socket.prototype, "connect").mockImplementation(() => {
      throw new Error("offline_socket_forbidden");
    });
    const transport = await import("../../src/runtime/durable-pair-r2.js");
    const { UPLOAD_ORDER } = await import(
      "../../src/runtime/durable-pair-contract.js"
    );
    const bytes = Buffer.alloc(2880044, 0x5a);
    let mode: "PUT" | "GET" = "PUT";
    const h = handleResponses((request) => {
      expect(request.method).toBe(mode);
      if (mode === "PUT") return message(200, []);
      const chunks: Buffer[] = [];
      for (let i = 0; i < bytes.length; i += 32768)
        chunks.push(bytes.subarray(i, i + 32768));
      return message(200, chunks);
    });
    await expect(
      transport.putPairObject(registration, operation, "input-1.wav", bytes),
    ).resolves.toBe("created");
    mode = "GET";
    const result = await transport.getPairObject(registration, operation, {
      name: "input-1.wav",
      byte_length: String(bytes.length),
      raw_sha256: hash(bytes),
    });
    expect(result.equals(bytes)).toBe(true);
    expect(h).toHaveBeenCalledTimes(2);
    let rows = transport.transportDiagnostics();
    for (const method of ["PUT", "GET"])
      expect(
        rows.filter((r) => r.method === method).map((r) => r.stage),
      ).toEqual([
        "start",
        "credentials",
        "signing",
        "signed",
        "dispatch",
        "headers",
        "consumed",
        "cleanup",
      ]);
    expect(
      rows.find((r) => r.method === "GET" && r.stage === "consumed")?.bytes,
    ).toBe(bytes.length);
    h.mockRestore();
    handleResponses(() => {
      throw Object.assign(
        new Error("SECRET_TOKEN https://private.invalid/private-path"),
        { code: "ECONNRESET" },
      );
    });
    await expect(
      transport.putPairObject(
        registration,
        operation,
        "SOURCE.json",
        Buffer.alloc(1),
      ),
    ).rejects.toMatchObject({ code: "storage_response_invalid" });
    rows = transport.transportDiagnostics();
    expect(rows.find((r) => r.stage === "refused")?.code).toBe("ECONNRESET");
    const text = JSON.stringify(rows);
    for (const denied of [
      "SECRET_TOKEN",
      "private.invalid",
      "TESTONLYID",
      "test-only-not-a-credential",
      operation,
      "authorization",
      "https://",
    ])
      expect(text.includes(denied)).toBe(false);
    for (const row of rows)
      expect(
        Object.keys(row).every((k) =>
          [
            "method",
            "object",
            "stage",
            "elapsed_ms",
            "status",
            "bytes",
            "code",
            "cleanup_pending",
          ].includes(k),
        ),
      ).toBe(true);
    for (const name of UPLOAD_ORDER) {
      await expect(
        transport.putPairObject(registration, operation, name, Buffer.alloc(1)),
      ).rejects.toMatchObject({ code: "storage_response_invalid" });
      const last = transport.transportDiagnostics().at(-1);
      expect(last?.object).toBe(name);
      expect(last?.stage).toBe("cleanup");
    }
    const complete = transport.transportDiagnosticSnapshot();
    expect(complete.complete).toBe(true);
    expect(complete.saturated).toBe(false);
    expect(complete.requests_started).toBe(complete.requests_closed);
    // Snapshots cannot mutate internal retained records.
    const first = rows[0];
    if (first === undefined) throw new Error("diagnostic record missing");
    Reflect.set(first, "object", "SECRET_TOKEN");
    expect(JSON.stringify(transport.transportDiagnostics())).not.toContain(
      "SECRET_TOKEN",
    );
    for (let i = 0; i < 80; i++)
      await expect(
        transport.putPairObject(
          registration,
          operation,
          "SOURCE.json",
          Buffer.alloc(1),
        ),
      ).rejects.toMatchObject({ code: "storage_response_invalid" });
    expect(transport.transportDiagnostics().length).toBe(512);
    const saturated = transport.transportDiagnosticSnapshot();
    expect(saturated.saturated).toBe(true);
    expect(saturated.complete).toBe(false);
    expect(saturated.dropped_records).toBeGreaterThan(0);
    expect(saturated.requests_closed).toBe(saturated.requests_started);
  }, 30000);
});

describe("terminal private snapshot integration", () => {
  it("T15 atomically persists private metadata and preserves action outcomes", async () => {
    const root = await scratch();
    const { persistTransportDiagnostics, withTransportDiagnostics } =
      await import("../../src/runtime/durable-pair-diagnostics.js");
    const { transportDiagnosticSnapshot } = await import(
      "../../src/runtime/durable-pair-r2.js"
    );
    const snapshot = transportDiagnosticSnapshot();
    expect(await persistTransportDiagnostics(undefined, snapshot)).toBe(
      "not_requested",
    );
    expect(await persistTransportDiagnostics(root, snapshot)).toBe("saved");
    const names = await fs.readdir(root);
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/^transport-[0-9a-f-]{36}\.json$/);
    const name = names[0];
    if (name === undefined) throw new Error("missing diagnostic file");
    const p = join(root, name);
    const stat = await fs.lstat(p);
    expect(stat.mode & 0o777).toBe(0o600);
    expect(stat.nlink).toBe(1);
    expect(JSON.parse(await fs.readFile(p, "utf8"))).toEqual(snapshot);
    const evil = { ...snapshot, credentials: "SECRET_TOKEN" };
    expect(await persistTransportDiagnostics(root, evil)).toBe("failed");
    expect(await fs.readdir(root)).toHaveLength(1);
    const symlink = join(root, "link");
    await fs.symlink(root, symlink);
    expect(await persistTransportDiagnostics(symlink, snapshot)).toBe("failed");
    const missing = root + "/not-provisioned";
    expect(await persistTransportDiagnostics(missing, snapshot)).toBe("failed");
    const statuses: string[] = [];
    const value = Object.freeze({ status: "stopped", code: "storage_timeout" });
    const priorExit = process.exitCode;
    process.exitCode = 1;
    try {
      expect(
        await withTransportDiagnostics(
          () => Promise.resolve(value),
          missing,
          (s) => statuses.push(s),
        ),
      ).toBe(value);
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = priorExit;
    }
    expect(statuses).toEqual(["failed"]);
    const error = Object.assign(new Error("original SECRET_TOKEN"), {
      code: "ECONNRESET",
    });
    await expect(
      withTransportDiagnostics(
        () => Promise.reject(error),
        missing,
        () => {
          throw Error("report_failure");
        },
      ),
    ).rejects.toBe(error);
    const success = Object.freeze({ status: "success" });
    expect(
      await withTransportDiagnostics(
        () => Promise.resolve(success),
        root,
        (s) => statuses.push(s),
      ),
    ).toBe(success);
    expect(statuses.at(-1)).toBe("saved");
    expect(
      await withTransportDiagnostics(
        () => Promise.resolve(success),
        undefined,
        () => {
          throw Error("must_not_report");
        },
      ),
    ).toBe(success);
    await fs.unlink(symlink);
    for (const n of await fs.readdir(root)) {
      const text = await fs.readFile(join(root, n), "utf8");
      expect(text).not.toContain("SECRET_TOKEN");
      expect(text).not.toContain("credential");
    }
  }, 30000);
});

it("retains refusal metadata when error.code is a throwing accessor", async () => {
  vi.spyOn(Socket.prototype, "connect").mockImplementation(() => {
    throw new Error("offline_socket_forbidden");
  });
  const transport = await import("../../src/runtime/durable-pair-r2.js");
  const error = new Error("SECRET_TOKEN");
  Object.defineProperty(error, "code", {
    get() {
      throw new Error("SECRET_GETTER");
    },
  });
  handleResponses(() => {
    throw error;
  });
  await expect(
    transport.putPairObject(
      registration,
      operation,
      "SOURCE.json",
      Buffer.alloc(1),
    ),
  ).rejects.toMatchObject({ code: "storage_response_invalid" });
  const snapshot = transport.transportDiagnosticSnapshot();
  expect(
    snapshot.records.filter((row) => row.stage === "refused"),
  ).toHaveLength(1);
  expect(snapshot.records.find((row) => row.stage === "refused")?.code).toBe(
    "OTHER",
  );
  expect(snapshot.records.at(-1)?.stage).toBe("cleanup");
  expect(snapshot.complete).toBe(true);
  expect(snapshot.requests_started).toBe(1);
  expect(snapshot.requests_closed).toBe(1);
  expect(snapshot.dropped_records).toBe(0);
  expect(JSON.stringify(snapshot)).not.toContain("SECRET");
});

it("rejects malformed and oversized metadata before creating files", async () => {
  const root = await scratch();
  const { persistTransportDiagnostics } = await import(
    "../../src/runtime/durable-pair-diagnostics.js"
  );
  const { transportDiagnosticSnapshot } = await import(
    "../../src/runtime/durable-pair-r2.js"
  );
  const snapshot = transportDiagnosticSnapshot();
  const row = {
    method: "GET",
    object: "SOURCE.json",
    stage: "cleanup",
    elapsed_ms: 0,
  };
  const invalid: unknown[] = [
    null,
    { ...snapshot, schema: "unknown" },
    { ...snapshot, complete: false },
    { ...snapshot, requests_closed: 1 },
    { ...snapshot, requests_started: 65536 },
    { ...snapshot, dropped_records: -1 },
    { ...snapshot, records: Array.from({ length: 513 }, () => row) },
    { ...snapshot, records: [{ ...row, code: "X".repeat(131073) }] },
    ...[
      { method: "DELETE" },
      { object: "private/path" },
      { stage: "unknown" },
      { elapsed_ms: NaN },
      { elapsed_ms: 600001 },
      { status: 199 },
      { status: 600 },
      { bytes: 5760045 },
      { cleanup_pending: "true" },
      { authorization: "SECRET_TOKEN" },
    ].map((change) => ({ ...snapshot, records: [{ ...row, ...change }] })),
  ];
  for (const candidate of invalid) {
    expect(
      await persistTransportDiagnostics(
        root,
        candidate as TransportDiagnosticSnapshot,
      ),
    ).toBe("failed");
    expect(await fs.readdir(root)).toEqual([]);
  }
});

it("rejects noncanonical, relative, nonprivate and missing sink directories", async () => {
  const root = await scratch();
  const { persistTransportDiagnostics } = await import(
    "../../src/runtime/durable-pair-diagnostics.js"
  );
  const { transportDiagnosticSnapshot } = await import(
    "../../src/runtime/durable-pair-r2.js"
  );
  const snapshot = transportDiagnosticSnapshot();
  for (const directory of [
    root + "/.",
    root + "/",
    "relative-sink",
    root + "/missing",
    "/".repeat(4097),
  ])
    expect(await persistTransportDiagnostics(directory, snapshot)).toBe(
      "failed",
    );
  await fs.chmod(root, 0o750);
  expect(await persistTransportDiagnostics(root, snapshot)).toBe("failed");
  await fs.chmod(root, 0o700);
  expect(await fs.readdir(root)).toEqual([]);
});

it("never overwrites a colliding destination or changes the action result", async () => {
  const root = await scratch();
  const actual =
    await vi.importActual<typeof import("node:fs/promises")>(
      "node:fs/promises",
    );
  const existing = Buffer.from("existing private evidence\n");
  let destination = "";
  vi.mocked(fs.link).mockImplementation(async (source, target) => {
    const name = String(target).split("/").at(-1);
    if (name === undefined) throw new Error("missing collision filename");
    destination = join(root, name);
    await actual.writeFile(destination, existing, { flag: "wx", mode: 0o600 });
    return actual.link(source, target);
  });
  const { withTransportDiagnostics } = await import(
    "../../src/runtime/durable-pair-diagnostics.js"
  );
  const value = Object.freeze({ status: "success" });
  const statuses: string[] = [];
  expect(
    await withTransportDiagnostics(
      () => Promise.resolve(value),
      root,
      (status) => statuses.push(status),
    ),
  ).toBe(value);
  expect(statuses).toEqual(["failed"]);
  expect(destination).not.toBe("");
  expect(await fs.readFile(destination)).toEqual(existing);
  const names = await fs.readdir(root);
  expect(names).toHaveLength(2);
  expect(
    names.some(
      (name) => name.startsWith(".transport-") && name.endsWith(".tmp"),
    ),
  ).toBe(true);
});
