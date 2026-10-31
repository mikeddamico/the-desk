/** Controlled pure/local adapters only. This file never establishes real R2/Postgres durability or acoustic acceptance. */
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import * as fs from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { IncomingMessage } from "node:http";
import { EventEmitter } from "node:events";
import { TLSSocket } from "node:tls";
import { Socket } from "node:net";
import pg from "pg";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  acquireSubject,
  type Acquired,
} from "../../src/runtime/technical-master-acquisition.js";
import * as admission from "../../src/runtime/technical-master-admission.js";
import * as binding from "../../src/runtime/durable-pair-binding.js";
import * as sql from "../../src/runtime/durable-pair-sql.js";
import * as r2 from "../../src/runtime/durable-pair-r2.js";
import {
  PairRefusal,
  jsonBytes,
  requestFor,
  requestHash,
  receiptFor,
  receiptHash,
  parsePairJson,
  parseReceiptEnvelope,
  UPLOAD_ORDER,
  type PairReceipt,
  type ObjectIdentity,
} from "../../src/runtime/durable-pair-contract.js";
import {
  sha,
  object,
  type Data,
} from "../../src/runtime/technical-master-checks.js";

vi.mock(
  "../../src/runtime/technical-master-acquisition.js",
  async (original) => {
    const actual =
      await original<
        typeof import("../../src/runtime/technical-master-acquisition.js")
      >();
    return { ...actual, acquireSubject: vi.fn(actual.acquireSubject) };
  },
);
vi.mock("../../src/runtime/technical-master-admission.js", async (original) => {
  const actual =
    await original<
      typeof import("../../src/runtime/technical-master-admission.js")
    >();
  return {
    ...actual,
    retainAssessedSyntheticMaster: vi.fn(),
    assertRetainedTechnicalMaster: vi.fn(),
  };
});
vi.mock("../../src/runtime/durable-pair-binding.js", async (original) => {
  const actual =
    await original<
      typeof import("../../src/runtime/durable-pair-binding.js")
    >();
  return {
    ...actual,
    registeredPair: vi.fn(),
    pairSettings: vi.fn(actual.pairSettings),
    databasePassword: vi.fn(() => "test-only-not-a-credential"),
    r2Credentials: vi.fn(() => ({
      accessKeyId: "TESTONLYID",
      secretAccessKey: "test-only-key",
    })),
  };
});
vi.mock("../../src/runtime/durable-pair-sql.js", () => ({
  readPairReceipt: vi.fn(),
  preflightPairRows: vi.fn(),
  commitPairRows: vi.fn(),
}));
vi.mock("../../src/runtime/durable-pair-r2.js", () => ({
  putPairObject: vi.fn(),
  getPairObject: vi.fn(),
}));
vi.mock("pg", async (original) => {
  const actual = await original<typeof import("pg")>();
  return { ...actual, default: { ...actual.default, Pool: vi.fn() } };
});
vi.mock("node:tls", async (original) => {
  const actual = await original<typeof import("node:tls")>();
  return {
    ...actual,
    TLSSocket: class {
      encrypted = true;
      authorized = true;
      getPeerCertificate() {
        return { subjectaltname: "DNS:database-binding-vector.invalid" };
      }
    },
  };
});

const LITERALS = new URL(
  "../../fixtures/durable-pair/vectors.json",
  import.meta.url,
);
const operation = "b6200001-0000-4000-8000-000000000001";
const timestamp = "2026-10-29T00:00:00.000000Z";
let service: typeof import("../../src/runtime/durable-pair.js");
let PairFailure: typeof PairRefusal = PairRefusal;
let registration: binding.RegisteredPair;
let vectors: Data;
let namespace = "";
let namespaceIdentity: { dev: number; ino: number };
let committed: PairReceipt | null;
let objects: Map<string, Buffer>;
let events: string[];
let released: number;
const originalEnv = {
  DESK_ENV: process.env.DESK_ENV,
  PROVIDERS_ENABLED: process.env.PROVIDERS_ENABLED,
  GENERATION_KILL_SWITCH: process.env.GENERATION_KILL_SWITCH,
};

/** Actual IncomingMessage shape with no connected socket; transport still owns framing and closure. */
function responseMessage(
  chunks: Buffer[],
  complete = true,
  stalled = false,
): IncomingMessage {
  const source = new IncomingMessage(new Socket());
  const length = String(Buffer.concat(chunks).length);
  source.rawHeaders = ["content-length", length];
  source.headers = { "content-length": length };
  source._read = () => {
    if (stalled) return;
    source._read = () => undefined;
    for (const chunk of chunks) source.push(chunk);
    source.complete = complete;
    source.push(null);
  };
  return source;
}
function objectKey(id: string, name: string): string {
  return id + "/" + name;
}
async function fakePut(
  _registration: binding.RegisteredPair,
  id: string,
  name: string,
  bytes: Buffer,
): Promise<"created" | "occupied"> {
  await Promise.resolve();
  events.push("put:" + name);
  const key = objectKey(id, name);
  if (objects.has(key)) return "occupied";
  objects.set(key, Buffer.from(bytes));
  return "created";
}
async function fakeGet(
  _registration: binding.RegisteredPair,
  id: string,
  expected: ObjectIdentity,
): Promise<Buffer> {
  await Promise.resolve();
  events.push("get:" + expected.name);
  const bytes = objects.get(objectKey(id, expected.name));
  if (
    bytes?.length !== Number(expected.byte_length) ||
    sha(bytes) !== expected.raw_sha256
  )
    throw new PairFailure("storage_readback_invalid", "readback");
  return Buffer.from(bytes);
}
beforeEach(async () => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.resetModules();
  PairFailure = (await import("../../src/runtime/durable-pair-contract.js"))
    .PairRefusal;
  process.env.DESK_ENV = "test";
  process.env.PROVIDERS_ENABLED = "false";
  process.env.GENERATION_KILL_SWITCH = "true";
  vectors = object(JSON.parse(await fs.readFile(LITERALS, "utf8")) as unknown);
  namespace = await fs.mkdtemp(join(tmpdir(), "desk-durable-test-"));
  await fs.writeFile(join(namespace, "OWNER.json"), "fixed-test-owner\n", {
    mode: 0o600,
    flag: "wx",
  });
  const info = await fs.lstat(namespace);
  namespaceIdentity = { dev: info.dev, ino: info.ino };
  const expectedCatalog = {
    columns: [],
    constraints: [],
    triggers: [],
    privileges: [],
    relations: [
      ["public", "artifacts", "101"],
      ["public", "assembly_recipes", "102"],
      ["public", "audio_artifacts", "103"],
      ["public", "master_assembly_maps", "104"],
    ],
  };
  registration = {
    storage: vectors.storage_binding as binding.RegisteredPair["storage"],
    database: vectors.database_binding as binding.RegisteredPair["database"],
    namespace: {
      path: namespace,
      dev: info.dev,
      ino: info.ino,
      uid: info.uid,
      owner_sha256: sha(Buffer.from("fixed-test-owner\n")),
    },
    databaseLogin: "desk_test_login",
    expectedCatalog,
    migrationAttestation: {
      sha256: "0".repeat(64),
      schema_identity: "0".repeat(64),
      catalog_sha256: sha(jsonBytes(expectedCatalog)),
    },
  };
  committed = null;
  objects = new Map();
  events = [];
  released = 0;
  const actualAcquisition = await vi.importActual<
    typeof import("../../src/runtime/technical-master-acquisition.js")
  >("../../src/runtime/technical-master-acquisition.js");
  vi.mocked(acquireSubject).mockReset();
  vi.mocked(acquireSubject).mockImplementation(
    actualAcquisition.acquireSubject,
  );
  const actualBinding = await vi.importActual<typeof binding>(
    "../../src/runtime/durable-pair-binding.js",
  );
  vi.mocked(binding.pairSettings).mockImplementation(
    actualBinding.pairSettings,
  );
  vi.mocked(binding.registeredPair).mockReturnValue(registration);
  vi.mocked(sql.readPairReceipt).mockImplementation(() =>
    Promise.resolve(committed),
  );
  vi.mocked(sql.preflightPairRows).mockImplementation(() => {
    events.push("preflight");
    return Promise.resolve();
  });
  vi.mocked(sql.commitPairRows).mockImplementation(
    async (_registered, receipt) => {
      await Promise.resolve();
      events.push("commit");
      committed = structuredClone(receipt);
      return { kind: "created", cleanupPending: false };
    },
  );
  vi.mocked(admission.retainAssessedSyntheticMaster).mockImplementation(
    async (acquired: Acquired) => {
      await Promise.resolve();
      events.push("assessment");
      return {
        acquired,
        observation: object(vectors.observation),
        recheck: acquired.recheck,
        async release() {
          released++;
          await acquired.cleanup();
        },
      };
    },
  );
  vi.mocked(admission.assertRetainedTechnicalMaster).mockImplementation(
    () => undefined,
  );
  vi.mocked(r2.putPairObject).mockImplementation(fakePut);
  vi.mocked(r2.getPairObject).mockImplementation(fakeGet);
  service = await import("../../src/runtime/durable-pair.js");
});
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) Reflect.deleteProperty(process.env, name);
    else process.env[name] = value;
  }
  // Only this test-created mocked namespace is removed; a fake pending state is not proof of production settlement.
  const info = await fs.lstat(namespace);
  expect({ dev: info.dev, ino: info.ino }).toEqual(namespaceIdentity);
  expect(info.isSymbolicLink()).toBe(false);
  await fs.rm(namespace, { recursive: true });
});

describe("bounded durable synthetic pair", () => {
  it("matches the independently frozen request and nonrecursive receipt vectors", async () => {
    const acquired = await acquireSubject("synthetic60-positive");
    const files = new Map(acquired.snapshots);
    files.set("assessment.json", jsonBytes(vectors.observation));
    const request = requestFor(operation, timestamp, files, registration);
    expect(request).toEqual(vectors.request);
    expect(requestHash(request)).toBe(vectors.request_digest);
    expect(receiptHash(receiptFor(request))).toBe(vectors.receipt_digest);
    for (const entry of vectors.mutation_vectors as Data[]) {
      const changed = structuredClone(request);
      for (const item of entry.literal_patch as Data[]) {
        const path = String(item.path).slice(1).split("/");
        let parent: unknown = changed;
        for (const key of path.slice(0, -1))
          parent = Reflect.get(parent as object, key);
        Reflect.set(parent as object, path.at(-1) ?? "", item.value);
      }
      expect(requestHash(changed)).toBe(entry.sha256);
      expect(() =>
        parseReceiptEnvelope(
          { ...receiptFor(request), request: changed },
          operation,
        ),
      ).toThrow();
    }
    await acquired.cleanup();
  });
  it("stores the complete pair then proves a fresh reader without local WAV reacquisition", async () => {
    expect(
      await service.storeDurableSyntheticPair({
        operation_id: operation,
        created_at: timestamp,
      }),
    ).toMatchObject({
      status: "durable_synthetic_pair_stored",
      authority: "none",
      cleanup: "complete",
    });
    expect(released).toBe(1);
    expect(events.indexOf("preflight")).toBeLessThan(
      events.indexOf("assessment"),
    );
    expect(
      events
        .filter((event) => event.startsWith("put:"))
        .map((event) => event.slice(4)),
    ).toEqual(UPLOAD_ORDER);
    expect(events.at(-1)).toBe("commit");
    expect(acquireSubject).toHaveBeenCalledTimes(1);
    vi.mocked(acquireSubject).mockClear();
    vi.mocked(acquireSubject).mockRejectedValueOnce(
      new Error("reader cannot substitute local WAVs"),
    );
    expect(await service.readDurableSyntheticPair(operation)).toMatchObject({
      status: "durable_synthetic_pair_readback_pass",
      authoritative_gate_result: false,
      lifecycle_validated: false,
      ready: false,
    });
    expect(acquireSubject).not.toHaveBeenCalled();
    expect(
      events.filter(
        (event) => event.startsWith("put:") || event.startsWith("get:"),
      ).length,
    ).toBe(33);
    expect(admission.retainAssessedSyntheticMaster).toHaveBeenCalledTimes(1);
  });
  it("converges identical retries and refuses changed creation time and concurrent duplicate launch", async () => {
    const results = await Promise.all([
      service.storeDurableSyntheticPair({
        operation_id: operation,
        created_at: timestamp,
      }),
      service.storeDurableSyntheticPair({
        operation_id: operation,
        created_at: timestamp,
      }),
    ]);
    expect(
      results.filter(
        (result) => result.status === "durable_synthetic_pair_stored",
      ),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "stopped"),
    ).toHaveLength(1);
    expect(
      await service.storeDurableSyntheticPair({
        operation_id: operation,
        created_at: timestamp,
      }),
    ).toMatchObject({ status: "durable_synthetic_pair_converged" });
    expect(
      await service.storeDurableSyntheticPair({
        operation_id: operation,
        created_at: "2026-10-29T00:00:01.000000Z",
      }),
    ).toMatchObject({ status: "stopped", code: "identity_conflict" });
    const intentPath = join(namespace, operation, "INTENT.json");
    const savedIntent = await fs.readFile(intentPath);
    const changedIntent = parsePairJson(savedIntent);
    object(object(changedIntent.assessment).measurements).integrated_decilufs =
      "-194";
    await fs.writeFile(intentPath, jsonBytes(changedIntent));
    expect(
      await service.storeDurableSyntheticPair({
        operation_id: operation,
        created_at: timestamp,
      }),
    ).toMatchObject({ status: "stopped", code: "identity_conflict" });
    await fs.writeFile(intentPath, savedIntent);
    expect(r2.putPairObject).toHaveBeenCalledTimes(11);
    expect(admission.retainAssessedSyntheticMaster).toHaveBeenCalledTimes(1);
  });
  it("refuses occupied wrong bytes and historical locator conflicts without overwriting or migration", async () => {
    objects.set(objectKey(operation, "SOURCE.json"), Buffer.from("wrong"));
    expect(
      await service.storeDurableSyntheticPair({
        operation_id: operation,
        created_at: timestamp,
      }),
    ).toMatchObject({ status: "stopped", code: "storage_readback_invalid" });
    expect(objects.get(objectKey(operation, "SOURCE.json"))?.toString()).toBe(
      "wrong",
    );
    expect(sql.commitPairRows).not.toHaveBeenCalled();
    const another = "b6200001-0000-4000-8000-000000000002";
    vi.mocked(sql.preflightPairRows).mockRejectedValueOnce(
      new PairFailure("identity_conflict", "sql"),
    );
    const assessments = vi.mocked(admission.retainAssessedSyntheticMaster).mock
      .calls.length;
    expect(
      await service.storeDurableSyntheticPair({
        operation_id: another,
        created_at: timestamp,
      }),
    ).toMatchObject({ status: "stopped", code: "identity_conflict" });
    expect(admission.retainAssessedSyntheticMaster).toHaveBeenCalledTimes(
      assessments,
    );
  });
  for (const [index, name] of UPLOAD_ORDER.entries()) {
    it(`retains interrupted upload ${name} as pending state and never resends an unknown outcome`, async () => {
      const id =
        "b6200001-0000-4000-8000-" + String(index + 10).padStart(12, "0");
      vi.mocked(r2.putPairObject).mockImplementation(
        async (registered, operationId, member, bytes) => {
          const result = await fakePut(registered, operationId, member, bytes);
          if (member === name)
            throw new PairFailure("storage_timeout", "upload");
          return result;
        },
      );
      expect(
        await service.storeDurableSyntheticPair({
          operation_id: id,
          created_at: timestamp,
        }),
      ).toMatchObject({ status: "stopped", storage_outcome: "unknown" });
      const calls = vi.mocked(r2.putPairObject).mock.calls.length;
      const assessments = vi.mocked(admission.retainAssessedSyntheticMaster)
        .mock.calls.length;
      expect(
        await service.storeDurableSyntheticPair({
          operation_id: id,
          created_at: timestamp,
        }),
      ).toMatchObject({ status: "stopped" });
      await service.reconcileDurableSyntheticPair(id);
      expect(r2.putPairObject).toHaveBeenCalledTimes(calls);
      expect(admission.retainAssessedSyntheticMaster).toHaveBeenCalledTimes(
        assessments,
      );
      expect(sql.commitPairRows).not.toHaveBeenCalled();
    });
  }
  it("recovers a committed operation without remeasurement and preserves unknown or acknowledged commit facts", async () => {
    vi.mocked(sql.commitPairRows).mockImplementationOnce(
      async (_registered, receipt) => {
        await Promise.resolve();
        committed = structuredClone(receipt);
        throw new PairFailure("sql_outcome_unknown", "sql");
      },
    );
    expect(
      await service.storeDurableSyntheticPair({
        operation_id: operation,
        created_at: timestamp,
      }),
    ).toMatchObject({ status: "stopped", sql_outcome: "unknown" });
    expect(
      await service.storeDurableSyntheticPair({
        operation_id: operation,
        created_at: timestamp,
      }),
    ).toMatchObject({ status: "durable_synthetic_pair_converged" });
    expect(admission.retainAssessedSyntheticMaster).toHaveBeenCalledTimes(1);
    const id = "b6200001-0000-4000-8000-000000000003";
    committed = null;
    vi.mocked(sql.commitPairRows).mockImplementationOnce(
      async (_registered, receipt) => {
        await Promise.resolve();
        committed = structuredClone(receipt);
        return { kind: "created", cleanupPending: true };
      },
    );
    expect(
      await service.storeDurableSyntheticPair({
        operation_id: id,
        created_at: timestamp,
      }),
    ).toMatchObject({
      status: "stopped",
      code: "cleanup_pending",
      sql_outcome: "committed",
      cleanup: "pending",
    });
    expect(
      await service.storeDurableSyntheticPair({
        operation_id: "b6200001-0000-4000-8000-000000000004",
        created_at: timestamp,
      }),
    ).toMatchObject({ status: "stopped", code: "cleanup_pending" });
    const calls = (): number[] =>
      [
        sql.readPairReceipt,
        sql.preflightPairRows,
        sql.commitPairRows,
        r2.getPairObject,
        r2.putPairObject,
      ].map((fn) => vi.mocked(fn).mock.calls.length);
    const afterWriter = calls();
    for (const id of [operation, "b6200001-0000-4000-8000-000000000088"]) {
      expect(await service.readDurableSyntheticPair(id)).toMatchObject({
        code: "cleanup_pending",
        phase: "cleanup",
        cleanup: "pending",
      });
      expect(await service.reconcileDurableSyntheticPair(id)).toMatchObject({
        code: "cleanup_pending",
        phase: "cleanup",
        cleanup: "pending",
      });
    }
    expect(calls()).toEqual(afterWriter);
    for (const entry of [
      "readDurableSyntheticPair",
      "reconcileDurableSyntheticPair",
    ] as const) {
      vi.resetModules();
      PairFailure = (await import("../../src/runtime/durable-pair-contract.js"))
        .PairRefusal;
      const realm = await import("../../src/runtime/durable-pair.js");
      vi.mocked(sql.readPairReceipt).mockRejectedValueOnce(
        new PairFailure("sql_outcome_unknown", "sql", true),
      );
      expect(await realm[entry](operation)).toMatchObject({
        code: "sql_outcome_unknown",
        cleanup: "pending",
      });
      const afterRead = calls();
      const other = "b6200001-0000-4000-8000-000000000089";
      expect(
        await realm.storeDurableSyntheticPair({
          operation_id: other,
          created_at: timestamp,
        }),
      ).toMatchObject({
        code: "cleanup_pending",
        phase: "cleanup",
        cleanup: "pending",
      });
      expect(await realm.readDurableSyntheticPair(other)).toMatchObject({
        code: "cleanup_pending",
        phase: "cleanup",
        cleanup: "pending",
      });
      expect(await realm.reconcileDurableSyntheticPair(other)).toMatchObject({
        code: "cleanup_pending",
        phase: "cleanup",
        cleanup: "pending",
      });
      expect(calls()).toEqual(afterRead);
    }
  });
  it("refuses corrupt deleted oversized duplicate-key and forged-context readback without writing", async () => {
    expect(
      (
        await service.storeDurableSyntheticPair({
          operation_id: operation,
          created_at: timestamp,
        })
      ).status,
    ).toBe("durable_synthetic_pair_stored");
    const saved = new Map(objects);
    for (const name of UPLOAD_ORDER) {
      objects = new Map(saved);
      const bytes = Buffer.from(
        objects.get(objectKey(operation, name)) ?? Buffer.alloc(0),
      );
      bytes[0] = (bytes[0] ?? 0) ^ 1;
      objects.set(objectKey(operation, name), bytes);
      expect((await service.readDurableSyntheticPair(operation)).status).toBe(
        "stopped",
      );
    }
    objects = new Map(saved);
    objects.delete(objectKey(operation, "master.wav"));
    expect((await service.readDurableSyntheticPair(operation)).status).toBe(
      "stopped",
    );
    expect(() => parsePairJson(Buffer.from('{"x":1,"x":1}'))).toThrow();
    expect(() => parsePairJson(Buffer.alloc(65537))).toThrow("resource_limit");
    if (!committed) throw new Error("missing stored fixture receipt");
    committed.request.attempt_id = "b6200002-0000-4000-8000-000000000001";
    expect((await service.readDurableSyntheticPair(operation)).status).toBe(
      "stopped",
    );
    expect(r2.putPairObject).toHaveBeenCalledTimes(11);
  });
  it("reuses frozen intent only for known-not-started work and holds lost intent or changed ownership", async () => {
    const ownerModule = await import("../../src/runtime/durable-pair-owner.js");
    const ownerId = "b6200001-0000-4000-8000-000000000099";
    const owner = await ownerModule.openPairOwner(
      registration,
      ownerId,
      timestamp,
    );
    const ownerPath = join(namespace, ownerId);
    await fs.chmod(ownerPath, 0o750);
    await expect(owner.update()).rejects.toMatchObject({
      code: "cleanup_pending",
    });
    await fs.chmod(ownerPath, 0o700);
    await owner.close(true);
    let checks = 0;
    vi.mocked(binding.pairSettings).mockImplementation(() => {
      if (++checks === 3) throw new PairFailure("unsafe_settings", "upload");
    });
    expect(
      (
        await service.storeDurableSyntheticPair({
          operation_id: operation,
          created_at: timestamp,
        })
      ).status,
    ).toBe("stopped");
    vi.mocked(binding.pairSettings).mockImplementation(() => undefined);
    expect(
      (
        await service.storeDurableSyntheticPair({
          operation_id: operation,
          created_at: timestamp,
        })
      ).status,
    ).toBe("durable_synthetic_pair_stored");
    expect(admission.retainAssessedSyntheticMaster).toHaveBeenCalledTimes(1);
    committed = null;
    await fs.unlink(join(namespace, operation, "INTENT.json"));
    expect(
      await service.storeDurableSyntheticPair({
        operation_id: operation,
        created_at: timestamp,
      }),
    ).toMatchObject({ status: "stopped", code: "cleanup_pending" });
    expect(admission.retainAssessedSyntheticMaster).toHaveBeenCalledTimes(1);
    const actualBinding = await vi.importActual<typeof binding>(
      "../../src/runtime/durable-pair-binding.js",
    );
    expect(() => actualBinding.registeredPair()).toThrow("binding_unavailable");
  });
  it("uses the existing SQL command owner and exact complete graph without gate or lifecycle statements", async () => {
    await service.storeDurableSyntheticPair({
      operation_id: operation,
      created_at: timestamp,
    });
    if (!committed) throw new Error("missing fixture receipt");
    const receipt = committed;
    const statements: string[] = [];
    let isolation = "read committed";
    let readOnly = "off";
    let reportedMode: "correct" | "wrong_isolation" | "writable" = "correct";
    let checkouts = 0;
    let observedCatalog = structuredClone(registration.expectedCatalog);
    const tables = new Map<string, Data[]>();
    const pool = new EventEmitter();
    const client = new EventEmitter();
    Object.assign(client, {
      connection: { stream: new TLSSocket(new Socket()) },
      release: vi.fn(),
      async query(text: string, values: unknown[] = []) {
        await Promise.resolve();
        statements.push(text);
        if (text.startsWith("BEGIN")) {
          isolation =
            text === "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"
              ? "repeatable read"
              : "read committed";
          readOnly = isolation === "repeatable read" ? "on" : "off";
        }
        if (text.startsWith("SELECT current_setting('transaction_isolation')"))
          return {
            rows: [
              {
                level:
                  reportedMode === "wrong_isolation"
                    ? "read committed"
                    : isolation,
                read_only: reportedMode === "writable" ? "off" : readOnly,
              },
            ],
          };
        if (text.startsWith("SELECT current_database"))
          return {
            rows: [
              {
                database: registration.database.database_name,
                role: "desk_runtime",
                login: registration.databaseLogin,
                version: "170000",
                encoding: "UTF8",
                ssl: true,
              },
            ],
          };
        if (text.startsWith("SELECT jsonb_build_object('columns'"))
          return { rows: [{ facts: observedCatalog }] };
        const inserted = /^INSERT INTO public\.(\w+) \(([^)]+)\)/u.exec(text);
        if (inserted) {
          const table = inserted[1] ?? "";
          const row = Object.fromEntries(
            (inserted[2] ?? "")
              .split(",")
              .map((column, index) => [column, values[index]]),
          );
          tables.set(table, [...(tables.get(table) ?? []), row]);
          return { rows: [] };
        }
        const selected =
          / FROM public\.(artifacts|audio_artifacts|assembly_recipes|master_assembly_maps) WHERE (\w+)=\$1/u.exec(
            text,
          );
        if (selected) {
          const family = selected[1] ?? "";
          const id = selected[2] ?? "";
          return {
            rows: (tables.get(family) ?? [])
              .filter(
                (row) =>
                  row[id] === values[0] ||
                  (family === "artifacts" &&
                    row.artifact_type === values[1] &&
                    row.content_hash === values[2]) ||
                  (family === "audio_artifacts" &&
                    (row.artifact_id === values[1] ||
                      row.audio_sha256 === values[2])),
              )
              .map((row) =>
                family === "artifacts"
                  ? { ...row, byte_size: String(row.byte_size) }
                  : row,
              ),
          };
        }
        return { rows: [] };
      },
    });
    Object.assign(pool, {
      async connect() {
        checkouts++;
        await Promise.resolve();
        pool.emit("connect", client);
        return client;
      },
      end() {
        return Promise.resolve();
      },
    });
    function PoolMock() {
      return pool;
    }
    vi.mocked(pg.Pool).mockImplementation(PoolMock);
    const actualSql = await vi.importActual<typeof sql>(
      "../../src/runtime/durable-pair-sql.js",
    );
    expect(await actualSql.commitPairRows(registration, receipt)).toEqual({
      kind: "created",
      cleanupPending: false,
    });
    expect(statements.slice(0, 2)).toEqual([
      "BEGIN ISOLATION LEVEL READ COMMITTED",
      "SELECT current_setting('transaction_isolation') AS level",
    ]);
    expect(tables.get("artifacts")).toHaveLength(6);
    expect(tables.get("audio_artifacts")).toHaveLength(3);
    expect(tables.get("assembly_recipes")).toHaveLength(1);
    expect(tables.get("master_assembly_maps")).toHaveLength(1);
    expect(statements).toContain("COMMIT");
    expect(
      statements.some((text) =>
        /gate_results|transition_attempt|UPDATE |DELETE /u.test(text),
      ),
    ).toBe(false);
    expect(await actualSql.commitPairRows(registration, receipt)).toEqual({
      kind: "converged",
      cleanupPending: false,
    });
    let first = statements.length;
    await actualSql.preflightPairRows(registration, receipt.request.rows);
    expect(statements.slice(first, first + 2)).toEqual([
      "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
      "SELECT current_setting('transaction_isolation') AS level,current_setting('transaction_read_only') AS read_only",
    ]);
    first = statements.length;
    expect(await actualSql.readPairReceipt(registration, operation)).toEqual(
      receipt,
    );
    expect(statements.slice(first, first + 2)).toEqual([
      "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
      "SELECT current_setting('transaction_isolation') AS level,current_setting('transaction_read_only') AS read_only",
    ]);
    expect(statements.some((text) => text.startsWith("SET TRANSACTION"))).toBe(
      false,
    );
    const domainStatements = statements.filter((text) =>
      /(?:FROM|INSERT INTO) (?:public\.)?(?:artifacts|audio_artifacts|assembly_recipes|master_assembly_maps)\b/u.test(
        text,
      ),
    );
    expect(domainStatements.length).toBeGreaterThan(0);
    expect(
      domainStatements.every((text) =>
        /(?:FROM|INSERT INTO) public\.(?:artifacts|audio_artifacts|assembly_recipes|master_assembly_maps)\b/u.test(
          text,
        ),
      ),
    ).toBe(true);
    observedCatalog = structuredClone(registration.expectedCatalog);
    const changedRelations = observedCatalog.relations as unknown[][];
    const changedRelation = changedRelations[0];
    if (!changedRelation)
      throw new Error("missing independent relation observation");
    changedRelation[2] = "999";
    await expect(
      actualSql.preflightPairRows(registration, receipt.request.rows),
    ).rejects.toMatchObject({ code: "binding_unavailable" });
    observedCatalog = structuredClone(registration.expectedCatalog);
    const commandOwner = await import("../../src/runtime/command.js");
    const unchangedCheckouts = checkouts;
    for (const mode of [null, "serializable", {}, true]) {
      await expect(
        commandOwner.runCommand(
          pool as unknown as pg.Pool,
          () => Promise.resolve({ kind: "converged", record: null }),
          undefined,
          mode as import("../../src/runtime/command.js").CommandTransactionMode,
        ),
      ).rejects.toThrow("transaction_mode_unsupported");
    }
    expect(checkouts).toBe(unchangedCheckouts);
    for (const mismatch of ["wrong_isolation", "writable"] as const) {
      reportedMode = mismatch;
      first = statements.length;
      await expect(
        actualSql.preflightPairRows(registration, receipt.request.rows),
      ).rejects.toMatchObject({ code: "sql_conflict" });
      expect(statements.slice(first)).toEqual([
        "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
        "SELECT current_setting('transaction_isolation') AS level,current_setting('transaction_read_only') AS read_only",
        "ROLLBACK",
      ]);
    }
    reportedMode = "correct";
    const stream = (
      Reflect.get(client, "connection") as { stream: { authorized: boolean } }
    ).stream;
    stream.authorized = false;
    await expect(
      actualSql.commitPairRows(registration, receipt),
    ).rejects.toMatchObject({ code: "binding_unavailable" });
    expect(statements.at(-1)).toBe("ROLLBACK");
    stream.authorized = true;
  });
  it("bounds the fixed PUT/GET transport and refuses ignored abort without retries or a new endpoint", async () => {
    const actual = await vi.importActual<typeof r2>(
      "../../src/runtime/durable-pair-r2.js",
    );
    const transportRegistration = {
      ...registration,
      storage: {
        ...registration.storage,
        endpoint_origin:
          "https://00000000000000000000000000000000.r2.cloudflarestorage.com",
      },
    };
    const payload = Buffer.from("fixed payload");
    const expected: ObjectIdentity = {
      name: "assessment.json",
      byte_length: String(payload.length),
      raw_sha256: sha(payload),
    };
    const handle = vi
      .spyOn(NodeHttpHandler.prototype, "handle")
      .mockImplementation(async (request) => {
        await Promise.resolve();
        expect(request.hostname).toBe(
          new URL(transportRegistration.storage.endpoint_origin).hostname,
        );
        expect(request.method).toBe("GET");
        return {
          response: {
            statusCode: 200,
            headers: { "content-length": String(payload.length) },
            body: responseMessage([payload]),
          },
        };
      });
    expect(
      await actual.getPairObject(transportRegistration, operation, expected),
    ).toEqual(payload);
    expect(handle).toHaveBeenCalledTimes(1);
    handle.mockImplementationOnce(async (request) => {
      await Promise.resolve();
      expect(request.method).toBe("PUT");
      expect(request.headers["if-none-match"]).toBe("*");
      expect(request.headers["content-length"]).toBe(String(payload.length));
      return {
        response: {
          statusCode: 200,
          headers: { "content-length": "0" },
          body: responseMessage([]),
        },
      };
    });
    expect(
      await actual.putPairObject(
        transportRegistration,
        operation,
        "assessment.json",
        payload,
      ),
    ).toBe("created");
    expect(handle).toHaveBeenCalledTimes(2);
    handle.mockImplementationOnce(() =>
      Promise.resolve({
        response: {
          statusCode: 302,
          headers: { location: "https://unapproved.invalid/" },
          body: responseMessage([Buffer.alloc(65537)]),
        },
      }),
    );
    await expect(
      actual.getPairObject(transportRegistration, operation, expected),
    ).rejects.toBeInstanceOf(PairFailure);
    expect(handle).toHaveBeenCalledTimes(3);
    let bodyLaunched: (() => void) | undefined;
    const bodyReached = new Promise<void>((resolve) => {
      bodyLaunched = resolve;
    });
    const stalledBody = responseMessage([], false, true);
    stalledBody.rawHeaders = ["content-length", String(payload.length)];
    stalledBody.headers = { "content-length": String(payload.length) };
    const originalRead = stalledBody._read.bind(stalledBody);
    stalledBody._read = (size) => {
      bodyLaunched?.();
      originalRead(size);
    };
    handle.mockImplementationOnce(() =>
      Promise.resolve({
        response: {
          statusCode: 200,
          headers: { "content-length": String(payload.length) },
          body: stalledBody,
        },
      }),
    );
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const stalled = actual.getPairObject(
      transportRegistration,
      operation,
      expected,
    );
    const stalledAssertion = expect(stalled).rejects.toMatchObject({
      code: "storage_timeout",
      pending: false,
    });
    await bodyReached;
    await vi.advanceTimersByTimeAsync(20001);
    await stalledAssertion;
    expect(stalledBody.destroyed).toBe(true);
    vi.useRealTimers();
    let launched: (() => void) | undefined;
    const reached = new Promise<void>((resolve) => {
      launched = resolve;
    });
    handle.mockImplementationOnce(() => {
      launched?.();
      return new Promise(() => undefined);
    });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const pending = actual.getPairObject(
      transportRegistration,
      operation,
      expected,
    );
    const assertion = expect(pending).rejects.toMatchObject({
      code: "storage_timeout",
      pending: true,
    });
    await reached;
    await vi.advanceTimersByTimeAsync(20001);
    await assertion;
    await expect(
      actual.getPairObject(transportRegistration, operation, expected),
    ).rejects.toMatchObject({ code: "cleanup_pending", pending: true });
  });
});
