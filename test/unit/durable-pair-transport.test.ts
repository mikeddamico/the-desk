/** Fixed local transport controls; no sockets connect and no cloud credentials are read. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import { createHash } from "node:crypto";
import { IncomingMessage } from "node:http";
import { Agent } from "node:https";
import { Socket } from "node:net";
import { Transform } from "node:stream";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { HttpRequest } from "@smithy/core/transport";
import { Sha256Node, Sha256Js } from "@smithy/core/checksum";
import {
  SignatureV4,
  clearCredentialCache,
  getSigningKey,
} from "@smithy/signature-v4";
import type {
  Checksum,
  ChecksumConstructor,
  SourceData,
  HttpRequest as SignedHttpRequest,
} from "@smithy/types";
import {
  r2Credentials,
  type RegisteredPair,
} from "../../src/runtime/durable-pair-binding.js";
import {
  requirePair,
  type ObjectIdentity,
} from "../../src/runtime/durable-pair-contract.js";

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
interface Vector {
  id: string;
  service: string;
  region: string;
  host: string;
  method: string;
  path: string;
  date: string;
  access_key: string;
  secret_key: string;
  body_hex?: string;
  body_utf8?: string;
  token: string | null;
  signature: string;
}
interface Inputs {
  published: Vector[];
  fixed: {
    host: string;
    path: string;
    date: string;
    access_key: string;
    secret_key: string;
    body_hex: string;
  };
  rfc4231: {
    id: string;
    key_hex: string;
    data_hex?: string;
    data_utf8?: string;
    sha256: string;
  }[];
  crypto: {
    plain_empty: string;
    plain_abc: string;
    rfc4231_case1_key_hex: string;
    rfc4231_case1_message: string;
    rfc4231_case1_expected: string;
  };
}
const inputUrl = new URL(
  "../../fixtures/durable-pair/signing-reference-inputs.json",
  import.meta.url,
);
const inputs = JSON.parse(fs.readFileSync(inputUrl, "utf8")) as Inputs;
const operation = "b6200001-0000-4000-8000-000000000001";
const registration = {
  storage: {
    endpoint_origin: "https://" + inputs.fixed.host,
    bucket: "the-desk-development",
    prefix: "development/proof",
  },
} as RegisteredPair;
const payload = Buffer.from(inputs.fixed.body_hex, "hex");
const sources: {
  source: IncomingMessage;
  destroy: IncomingMessage["destroy"];
}[] = [];
function hash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
function expected(bytes = payload): ObjectIdentity {
  return {
    name: "assessment.json",
    byte_length: String(bytes.length),
    raw_sha256: hash(bytes),
  };
}
function reference(): {
  fixed: Record<
    "GET" | "PUT",
    { authorization: string; canonical_request: string }
  >;
  empty_key_hmac_abc: string;
} {
  const file = new URL(
    "../../fixtures/durable-pair/signing-reference-expected.json",
    import.meta.url,
  );
  if (!fs.existsSync(file))
    throw new Error(
      "independent reference calculation must be reviewed and frozen before these controls execute",
    );
  const value = JSON.parse(fs.readFileSync(file, "utf8")) as {
    input_sha256: string;
    oracle_sha256: string;
    fixed: Record<
      "GET" | "PUT",
      { authorization: string; canonical_request: string }
    >;
    empty_key_hmac_abc: string;
  };
  expect(value.input_sha256).toBe(hash(fs.readFileSync(inputUrl)));
  expect(value.oracle_sha256).toBe(
    hash(
      fs.readFileSync(
        new URL(
          "../support/durable-pair-signing-reference.py",
          import.meta.url,
        ),
      ),
    ),
  );
  return value;
}
/** Extract only the actual private checksum owner; the supplied delegate is an actual pinned public implementation. */
function checksumOwner(delegate: ChecksumConstructor): {
  constructor: ChecksumConstructor;
  close: () => void;
} {
  const source = fs.readFileSync(
    new URL("../../src/runtime/durable-pair-r2.ts", import.meta.url),
    "utf8",
  );
  const parsed = ts.createSourceFile(
    "transport.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = parsed.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) && node.name?.text === "requestChecksums",
  );
  if (!declaration) throw new Error("actual checksum owner missing");
  const code = ts.transpileModule(
    declaration.getText(parsed) + "\nrequestChecksums();",
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2024,
        module: ts.ModuleKind.None,
      },
    },
  ).outputText;
  return runInNewContext(code, {
    Sha256Node: delegate,
    requirePair,
    Buffer,
  }) as { constructor: ChecksumConstructor; close: () => void };
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
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  // Intentional nonsettlement is asserted before this test-owned cleanup, never repaired in production.
  for (const { source, destroy } of sources) {
    if (!source.closed && source.destroyed)
      Reflect.set(source, "destroyed", false);
    if (!source.closed) Reflect.apply(destroy, source, []);
  }
  sources.length = 0;
});

describe("fixed private durable PUT/GET transport", () => {
  it("T1 matches published independent header-signing, binary, token and S3 path vectors", async () => {
    for (const vector of inputs.published) {
      const owner = checksumOwner(Sha256Node);
      try {
        const body =
          vector.body_hex === undefined
            ? Buffer.from(vector.body_utf8 ?? "")
            : Buffer.from(vector.body_hex, "hex");
        const date = new Date(
          vector.date.replace(
            /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
            "$1-$2-$3T$4:$5:$6Z",
          ),
        );
        const signer = new SignatureV4({
          service: vector.service,
          region: vector.region,
          credentials: {
            accessKeyId: vector.access_key,
            secretAccessKey: vector.secret_key,
            ...(vector.token === null ? {} : { sessionToken: vector.token }),
          },
          sha256: owner.constructor,
          uriEscapePath: false,
        });
        const signed = await signer.sign(
          new HttpRequest({
            protocol: "https:",
            hostname: vector.host,
            method: vector.method,
            path: vector.path,
            body,
            headers: { host: vector.host },
          }),
          { signingDate: date },
        );
        expect(signed.headers.authorization?.split("Signature=")[1]).toBe(
          vector.signature,
        );
        expect(signed.headers["x-amz-security-token"]).toBe(
          vector.token ?? undefined,
        );
      } finally {
        owner.close();
        clearCredentialCache();
      }
    }
  });
  it("T2 reconstructs reset state for plain and HMAC using selected and actual fallback delegates", async () => {
    const packet = reference();
    for (const delegate of [Sha256Node, Sha256Js]) {
      const reset = vi.spyOn(delegate.prototype, "reset");
      let constructions = 0;
      const keyLengths: (number | undefined)[] = [];
      class Counted implements Checksum {
        private readonly hash: Checksum;
        constructor(key?: SourceData) {
          constructions++;
          keyLengths.push(
            key === undefined ? undefined : (key as Uint8Array).byteLength,
          );
          this.hash = new delegate(key);
        }
        update(bytes: Uint8Array): void {
          this.hash.update(bytes);
        }
        digest(): Promise<Uint8Array> {
          return this.hash.digest();
        }
        reset(): void {
          this.hash.reset();
        }
      }
      const backing = Buffer.concat([
        Buffer.from([1, 2]),
        Buffer.from(inputs.crypto.rfc4231_case1_key_hex, "hex"),
        Buffer.from([3]),
      ]);
      const keyViews = [
        "\x0b".repeat(20),
        backing.subarray(2, 22),
        new DataView(backing.buffer, backing.byteOffset + 2, 20),
        Uint8Array.from(backing.subarray(2, 22)).buffer,
      ];
      const cases = [
        { key: undefined, body: "", digest: inputs.crypto.plain_empty },
        { key: undefined, body: "abc", digest: inputs.crypto.plain_abc },
        { key: "", body: "abc", digest: packet.empty_key_hmac_abc },
        ...inputs.rfc4231.map((vector) => ({
          key: Buffer.from(vector.key_hex, "hex"),
          body:
            vector.data_hex === undefined
              ? Buffer.from(vector.data_utf8 ?? "")
              : Buffer.from(vector.data_hex, "hex"),
          digest: vector.sha256,
        })),
        ...keyViews.map((key) => ({
          key,
          body: inputs.crypto.rfc4231_case1_message,
          digest: inputs.crypto.rfc4231_case1_expected,
        })),
      ];
      for (const sample of cases) {
        const before = constructions;
        const owner = checksumOwner(Counted);
        const checksum = new owner.constructor(sample.key);
        expect(constructions).toBe(before + 1);
        checksum.update(Buffer.from("discarded prefix"));
        checksum.reset();
        checksum.update(Buffer.from(sample.body));
        expect(Buffer.from(await checksum.digest()).toString("hex")).toBe(
          sample.digest,
        );
        checksum.reset();
        checksum.reset();
        checksum.update(Buffer.from(sample.body));
        expect(Buffer.from(await checksum.digest()).toString("hex")).toBe(
          sample.digest,
        );
        expect(constructions).toBe(before + 4);
        expect(keyLengths.slice(before)).toEqual(
          Array(4).fill(
            sample.key === undefined
              ? undefined
              : typeof sample.key === "string"
                ? Buffer.byteLength(sample.key)
                : sample.key.byteLength,
          ),
        );
        owner.close();
        expect(() => {
          checksum.reset();
        }).toThrow();
        expect(() => new owner.constructor()).toThrow();
      }
      expect(reset).not.toHaveBeenCalled();
      reset.mockRestore();
    }
    const key = Buffer.from(inputs.crypto.rfc4231_case1_key_hex, "hex");
    const owner = checksumOwner(Sha256Js);
    const checksum = new owner.constructor(key);
    key.fill(1);
    for (let index = 0; index < 2; index++) {
      checksum.reset();
      checksum.update(Buffer.from(inputs.crypto.rfc4231_case1_message));
      expect(Buffer.from(await checksum.digest()).toString("hex")).toBe(
        inputs.crypto.rfc4231_case1_expected,
      );
    }
    owner.close();
    for (const delegate of [Sha256Node, Sha256Js]) {
      for (const keyed of [false, true]) {
        let releaseDigest: (() => void) | undefined;
        const gate = new Promise<void>((resolve) => {
          releaseDigest = resolve;
        });
        class Deferred implements Checksum {
          private readonly actual: Checksum;
          constructor(secret?: SourceData) {
            this.actual = new delegate(secret);
          }
          update(bytes: Uint8Array): void {
            this.actual.update(bytes);
          }
          async digest(): Promise<Uint8Array> {
            await gate;
            return this.actual.digest();
          }
          reset(): void {
            throw new Error("owned reset must reconstruct, not delegate");
          }
        }
        const heldOwner = checksumOwner(Deferred);
        const held = new heldOwner.constructor(
          keyed
            ? Buffer.from(inputs.crypto.rfc4231_case1_key_hex, "hex")
            : undefined,
        );
        held.update(
          Buffer.from(keyed ? inputs.crypto.rfc4231_case1_message : "abc"),
        );
        const original = Reflect.get(held, "original") as
          | Uint8Array
          | undefined;
        const argument = Reflect.get(held, "argument") as
          | Uint8Array
          | undefined;
        // Compare bytes in the caller's realm; retain the VM views for lifetime checks.
        const originalBytes = original && Array.from(original);
        const argumentBytes = argument && Array.from(argument);
        const pendingDigest = held.digest();
        expect(() => {
          held.reset();
        }).toThrow();
        expect(() => {
          held.update(Buffer.from("busy"));
        }).toThrow();
        await expect(held.digest()).rejects.toMatchObject({
          code: "cleanup_pending",
        });
        heldOwner.close();
        heldOwner.close();
        expect(original && Array.from(original)).toEqual(originalBytes);
        expect(argument && Array.from(argument)).toEqual(argumentBytes);
        expect(Reflect.get(held, "delegate")).toBeDefined();
        expect(() => new heldOwner.constructor()).toThrow();
        expect(() => {
          held.reset();
        }).toThrow();
        releaseDigest?.();
        expect(Buffer.from(await pendingDigest).toString("hex")).toBe(
          keyed
            ? inputs.crypto.rfc4231_case1_expected
            : inputs.crypto.plain_abc,
        );
        expect(original?.every((byte) => byte === 0) ?? true).toBe(true);
        expect(argument?.every((byte) => byte === 0) ?? true).toBe(true);
        expect(Reflect.get(held, "original")).toBeUndefined();
        expect(Reflect.get(held, "argument")).toBeUndefined();
        expect(Reflect.get(held, "delegate")).toBeUndefined();
        expect(() => {
          held.update(Buffer.from("closed"));
        }).toThrow();
        await expect(held.digest()).rejects.toMatchObject({
          code: "cleanup_pending",
        });
      }
    }
  });
  it("T3 matches frozen s3/auto wire signatures and sends each required signed header once", async () => {
    const packet = reference();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-29T00:00:00Z"));
    const transport = await import("../../src/runtime/durable-pair-r2.js");
    const handle = handleResponses((request) => {
      expect(request.path).toBe(inputs.fixed.path);
      expect(request.hostname).toBe(inputs.fixed.host);
      expect(request.query).toEqual({});
      expect(request.headers.authorization).toBe(
        packet.fixed[request.method as "GET" | "PUT"].authorization,
      );
      if (request.method === "PUT") {
        expect(request.body).toEqual(payload);
        expect(request.headers["if-none-match"]).toBe("*");
        expect(request.headers["cache-control"]).toBe("private,no-store");
        return message(201, []);
      }
      return message();
    });
    expect(
      await transport.getPairObject(registration, operation, expected()),
    ).toEqual(payload);
    expect(
      await transport.putPairObject(
        registration,
        operation,
        "assessment.json",
        payload,
      ),
    ).toBe("created");
    expect(handle).toHaveBeenCalledTimes(2);
  });
  it("T4 snapshots before asynchronous signing and rejects private body or signed-target mutation", async () => {
    const transport = await import("../../src/runtime/durable-pair-r2.js");
    const originalSign = Reflect.get(SignatureV4.prototype, "sign");
    const caller = Buffer.alloc(64, 7);
    const originalBytes = Buffer.from(caller);
    const sign = vi
      .spyOn(SignatureV4.prototype, "sign")
      .mockImplementation(async function (this: SignatureV4, request, options) {
        caller[44] = (caller[44] ?? 0) ^ 1;
        await Promise.resolve();
        const result = (await Reflect.apply(originalSign, this, [
          request,
          options,
        ])) as HttpRequest;
        caller[45] = (caller[45] ?? 0) ^ 1;
        return result;
      });
    const handle = handleResponses((request) => {
      expect(request.body).toEqual(originalBytes);
      expect(request.headers["x-amz-content-sha256"]).toBe(hash(originalBytes));
      return message(200, []);
    });
    expect(
      await transport.putPairObject(
        registration,
        operation,
        "master.wav",
        caller,
      ),
    ).toBe("created");
    expect(caller).not.toEqual(originalBytes);
    expect(handle).toHaveBeenCalledTimes(1);
    for (const mutation of ["path", "header", "body"] as const) {
      sign.mockImplementationOnce(async function (
        this: SignatureV4,
        request,
        options,
      ) {
        const result = (await Reflect.apply(originalSign, this, [
          request,
          options,
        ])) as HttpRequest;
        if (mutation === "path") result.path += "-changed";
        if (mutation === "header") result.headers["if-none-match"] = "changed";
        if (mutation === "body" && Buffer.isBuffer(result.body))
          result.body[44] = (result.body[44] ?? 0) ^ 1;
        return result;
      });
      await expect(
        transport.putPairObject(registration, operation, "master.wav", caller),
      ).rejects.toMatchObject({
        code: "storage_response_invalid",
        pending: false,
      });
      expect(handle).toHaveBeenCalledTimes(1);
    }
    sign.mockRestore();
    const changedBeforeInvocation = Buffer.from(originalBytes);
    changedBeforeInvocation[44] = (changedBeforeInvocation[44] ?? 0) ^ 1;
    handle.mockImplementationOnce((request) => {
      expect(request.body).toEqual(changedBeforeInvocation);
      expect(request.headers["x-amz-content-sha256"]).toBe(
        hash(changedBeforeInvocation),
      );
      return Promise.resolve({
        response: {
          statusCode: 200,
          headers: { "content-length": "0" },
          body: message(200, []),
        },
      });
    });
    expect(
      await transport.putPairObject(
        registration,
        operation,
        "master.wav",
        changedBeforeInvocation,
      ),
    ).toBe("created");
    handle.mockImplementationOnce(() =>
      Promise.resolve({
        response: {
          statusCode: 200,
          headers: { "content-length": "64" },
          body: message(200, [changedBeforeInvocation]),
        },
      }),
    );
    await expect(
      transport.getPairObject(registration, operation, {
        name: "master.wav",
        byte_length: "64",
        raw_sha256: hash(originalBytes),
      }),
    ).rejects.toMatchObject({
      code: "storage_readback_invalid",
      pending: false,
    });
    await expect(
      transport.putPairObject(
        registration,
        operation,
        "master.wav",
        Buffer.from(new SharedArrayBuffer(64)),
      ),
    ).rejects.toMatchObject({ code: "resource_limit" });
    expect(handle).toHaveBeenCalledTimes(3);
  });
  it("T5 owns malformed-header sources before validation and rejects ambiguous framing", async () => {
    const transport = await import("../../src/runtime/durable-pair-r2.js");
    const invalid = [
      ["content-length", "6", "Content-Length", "6"],
      ["content-length", "6", "transfer-encoding", "chunked"],
      ["content-length", "06"],
      ["content-length", "-1"],
      ["content-length", "9007199254740992"],
      [
        "content-length",
        "6",
        "content-encoding",
        "identity",
        "Content-Encoding",
        "identity",
      ],
      ["content-length", "6", "location", "one", "Location", "two"],
      ["transfer-encoding", "gzip"],
      ["transfer-encoding", "chunked", "Transfer-Encoding", "chunked"],
      ["bad name", "one"],
      ["x-test", "bad\rvalue"],
      ["x-test", "a".repeat(16385)],
      Array.from({ length: 258 }, (_value, index) => String(index)),
    ];
    const handle = handleResponses();
    for (const raw of invalid) {
      // Match raw/bag values so malformed numeric grammar reaches its own
      // predicate instead of being rejected as a raw-versus-bag mismatch.
      const source = message(200, [payload], raw);
      Object.defineProperty(source, "rawHeaders", {
        get() {
          expect(source.listenerCount("error")).toBeGreaterThan(0);
          expect(source.listenerCount("aborted")).toBeGreaterThan(0);
          expect(source.listenerCount("close")).toBeGreaterThan(0);
          return raw;
        },
      });
      handle.mockImplementationOnce(() =>
        Promise.resolve({
          response: {
            statusCode: 200,
            headers: source.headers as Record<string, string>,
            body: source,
          },
        }),
      );
      await expect(
        transport.getPairObject(registration, operation, expected()),
      ).rejects.toMatchObject({
        code: "storage_response_invalid",
        pending: false,
      });
      expect(source.destroyed).toBe(true);
      expect(source.closed).toBe(true);
    }
    const mismatch = message(200, [payload], ["content-length", "6"]);
    mismatch.headers["content-length"] = "7";
    handle.mockImplementationOnce(() =>
      Promise.resolve({
        response: {
          statusCode: 200,
          headers: mismatch.headers as Record<string, string>,
          body: mismatch,
        },
      }),
    );
    await expect(
      transport.getPairObject(registration, operation, expected()),
    ).rejects.toMatchObject({
      code: "storage_response_invalid",
      pending: false,
    });
    expect(mismatch.closed).toBe(true);
  });
  it("T6 treats complete 2xx and occupied 412 distinctly and never redirects or retries", async () => {
    const transport = await import("../../src/runtime/durable-pair-r2.js");
    const handle = handleResponses();
    for (const status of [200, 201, 204, 412]) {
      handle.mockImplementationOnce(() =>
        Promise.resolve({
          response: {
            statusCode: status,
            headers: { "content-length": "0" },
            body: message(status, []),
          },
        }),
      );
      expect(
        await transport.putPairObject(
          registration,
          operation,
          "assessment.json",
          payload,
        ),
      ).toBe(status === 412 ? "occupied" : "created");
    }
    for (const [status, chunks, complete] of [
      [204, [payload], true],
      [412, [payload], false],
    ] as const) {
      const source = message(status, [...chunks], undefined, complete);
      handle.mockImplementationOnce(() =>
        Promise.resolve({
          response: {
            statusCode: status,
            headers: source.headers as Record<string, string>,
            body: source,
          },
        }),
      );
      await expect(
        transport.putPairObject(
          registration,
          operation,
          "assessment.json",
          payload,
        ),
      ).rejects.toMatchObject({
        // The real IncomingMessage abort path preserves the typed stream
        // refusal when its HTTP message is incomplete at destruction.
        code:
          status === 412
            ? "storage_readback_invalid"
            : "storage_response_invalid",
        phase: "readback",
        pending: false,
      });
      expect(source.closed).toBe(true);
    }
    for (const status of [301, 302, 307, 308, 400, 401, 403, 404, 500, 503]) {
      const count = handle.mock.calls.length;
      handle.mockImplementationOnce(() =>
        Promise.resolve({
          response: {
            statusCode: status,
            headers: {
              "content-length": "0",
              location: "https://unapproved.invalid/",
            },
            body: message(
              status,
              [],
              [
                "content-length",
                "0",
                "location",
                "https://unapproved.invalid/",
              ],
            ),
          },
        }),
      );
      await expect(
        transport.getPairObject(registration, operation, expected()),
      ).rejects.toMatchObject({
        code: "storage_response_invalid",
        pending: false,
      });
      expect(handle.mock.calls.length).toBe(count + 1);
    }
  });
  it("T7 preserves resource_limit for a single oversized chunk and refuses aggregate or payload mismatch", async () => {
    const transport = await import("../../src/runtime/durable-pair-r2.js");
    const handle = handleResponses();
    for (const put of [false, true]) {
      handle.mockImplementationOnce(() =>
        Promise.resolve({
          response: {
            statusCode: 200,
            headers: { "content-length": "65537" },
            body: message(200, [Buffer.alloc(65537)]),
          },
        }),
      );
      const result = put
        ? transport.putPairObject(
            registration,
            operation,
            "assessment.json",
            payload,
          )
        : transport.getPairObject(registration, operation, {
            name: "master.wav",
            byte_length: "65537",
            raw_sha256: "0".repeat(64),
          });
      await expect(result).rejects.toMatchObject({
        code: "resource_limit",
        phase: "readback",
        pending: false,
      });
    }
    handle.mockImplementationOnce(() =>
      Promise.resolve({
        response: {
          statusCode: 200,
          headers: { "content-length": "65537" },
          body: message(200, [Buffer.alloc(32768), Buffer.alloc(32769)]),
        },
      }),
    );
    await expect(
      transport.putPairObject(
        registration,
        operation,
        "assessment.json",
        payload,
      ),
    ).rejects.toMatchObject({
      code: "storage_readback_invalid",
      pending: false,
    });
    for (const mode of [
      "wrong",
      "short",
      "incomplete",
      "encoding",
      "overrun",
      "early_close",
      "aborted",
    ] as const) {
      const wrong = Buffer.from(payload);
      wrong[0] = (wrong[0] ?? 0) ^ 1;
      const body =
        mode === "short"
          ? payload.subarray(1)
          : mode === "wrong"
            ? wrong
            : mode === "overrun"
              ? Buffer.concat([payload, Buffer.alloc(1)])
              : payload;
      const raw = [
        "content-length",
        String(payload.length),
        ...(mode === "encoding" ? ["content-encoding", "gzip"] : []),
      ];
      const source = message(200, [body], raw, mode !== "incomplete");
      if (mode === "early_close" || mode === "aborted")
        source._read = () => {
          if (mode === "aborted") source.emit("aborted");
          source.destroy();
        };
      handle.mockImplementationOnce(() =>
        Promise.resolve({
          response: {
            statusCode: 200,
            headers: source.headers as Record<string, string>,
            body: source,
          },
        }),
      );
      await expect(
        transport.getPairObject(registration, operation, expected()),
      ).rejects.toMatchObject({
        code: "storage_readback_invalid",
        pending: false,
      });
    }
    for (const mode of [
      "aborted_before_handoff",
      "closed_before_handoff",
      "destroyed_before_end",
    ] as const) {
      const source = message(200, [payload]);
      if (mode === "aborted_before_handoff")
        Reflect.set(source, "aborted", true);
      else {
        // Real destruction occurs before the adapter can install its listeners.
        const closed = new Promise<void>((resolve) =>
          source.once("close", resolve),
        );
        source.destroy();
        if (mode === "closed_before_handoff") await closed;
      }
      const pipe = vi.spyOn(source, "pipe");
      handle.mockImplementationOnce(() =>
        Promise.resolve({
          response: {
            statusCode: 200,
            headers: source.headers as Record<string, string>,
            body: source,
          },
        }),
      );
      await expect(
        transport.getPairObject(registration, operation, expected()),
      ).rejects.toMatchObject({
        code: "storage_readback_invalid",
        phase: "readback",
        pending: false,
      });
      expect(pipe).not.toHaveBeenCalled();
      expect(source.closed).toBe(true);
      expect(source.destroyed).toBe(true);
    }
    const live = message();
    expect(live.complete).toBe(false);
    expect(live.destroyed).toBe(false);
    handle.mockImplementationOnce(() =>
      Promise.resolve({
        response: {
          statusCode: 200,
          headers: live.headers as Record<string, string>,
          body: live,
        },
      }),
    );
    expect(
      await transport.getPairObject(registration, operation, expected()),
    ).toEqual(payload);
    expect(live.complete).toBe(true);
  });
  it("T8 keeps the deadline through body consumption and holds an ignored handler abort", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const transport = await import("../../src/runtime/durable-pair-r2.js");
    let reached: (() => void) | undefined;
    const entered = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const handle = handleResponses(() => {
      reached?.();
      return message(
        200,
        [],
        ["content-length", String(payload.length)],
        false,
        true,
      );
    });
    const result = transport.getPairObject(registration, operation, expected());
    const assertion = expect(result).rejects.toMatchObject({
      code: "storage_timeout",
      pending: false,
    });
    await entered;
    await vi.advanceTimersByTimeAsync(20001);
    await assertion;
    let pendingReached: (() => void) | undefined;
    const pendingEntered = new Promise<void>((resolve) => {
      pendingReached = resolve;
    });
    handle.mockImplementationOnce(() => {
      pendingReached?.();
      return new Promise(() => undefined);
    });
    const pending = transport.getPairObject(
      registration,
      operation,
      expected(),
    );
    const held = expect(pending).rejects.toMatchObject({
      code: "storage_timeout",
      pending: true,
    });
    await pendingEntered;
    await vi.advanceTimersByTimeAsync(20001);
    await held;
    const calls = handle.mock.calls.length;
    await expect(
      transport.putPairObject(
        registration,
        operation,
        "assessment.json",
        payload,
      ),
    ).rejects.toMatchObject({ code: "cleanup_pending", pending: true });
    expect(handle.mock.calls.length).toBe(calls);
  });
  it("T9 owns late signing through terminal cache cleanup without a late dispatch or barrier reset", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "performance", "Date"],
    });
    vi.setSystemTime(new Date("2026-10-29T00:00:00Z"));
    const sdk = await vi.importActual<typeof import("@smithy/signature-v4")>(
      "@smithy/signature-v4",
    );
    for (const terminalFault of [false, true]) {
      vi.restoreAllMocks();
      vi.resetModules();
      vi.mocked(clearCredentialCache)
        .mockReset()
        .mockImplementation(sdk.clearCredentialCache);
      sdk.clearCredentialCache();
      const transport = await import("../../src/runtime/durable-pair-r2.js");
      const handle = handleResponses();
      let reached: (() => void) | undefined;
      let release: (() => void) | undefined;
      const entered = new Promise<void>((resolve) => {
        reached = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const updates = new WeakMap<Checksum, string>();
      const prototype = Reflect.get(Sha256Node, "prototype") as Checksum;
      const originalUpdate = Reflect.get(prototype, "update");
      vi.spyOn(prototype, "update").mockImplementation(function (
        this: Checksum,
        bytes,
      ) {
        updates.set(this, Buffer.from(bytes).toString("utf8"));
        Reflect.apply(originalUpdate, this, [bytes]);
      });
      const originalDigest = Reflect.get(prototype, "digest");
      const stages: string[] = [];
      vi.spyOn(prototype, "digest").mockImplementation(async function (
        this: Checksum,
      ) {
        const text = updates.get(this);
        stages.push(
          text?.startsWith("GET\n") ? "canonical_request" : (text ?? "missing"),
        );
        const value = await Reflect.apply(originalDigest, this, []);
        // Pinned getSigningKey's final loop iteration awaits this exact HMAC
        // before assigning signingKeyCache. Service HMAC is the preceding cut.
        if (text === "aws4_request") {
          expect(stages).toEqual([
            "TESTONLYID",
            "canonical_request",
            "20261029",
            "auto",
            "s3",
            "aws4_request",
          ]);
          reached?.();
          await gate;
        }
        return value;
      });
      async function cacheProbe(): Promise<{
        key: Uint8Array;
        digests: number;
      }> {
        let digests = 0;
        class Probe implements Checksum {
          private readonly actual: Checksum;
          constructor(secret?: SourceData) {
            this.actual = new Sha256Js(secret);
          }
          update(bytes: Uint8Array): void {
            this.actual.update(bytes);
          }
          digest(): Promise<Uint8Array> {
            digests++;
            return this.actual.digest();
          }
          reset(): void {
            this.actual.reset();
          }
        }
        const key = await getSigningKey(
          Probe,
          {
            accessKeyId: "TESTONLYID",
            secretAccessKey: "test-only-not-a-credential",
          },
          "20261029",
          "auto",
          "s3",
        );
        return { key, digests };
      }
      const originalSign = Reflect.get(SignatureV4.prototype, "sign");
      let warmed: Awaited<ReturnType<typeof cacheProbe>> | undefined;
      let reused: Awaited<ReturnType<typeof cacheProbe>> | undefined;
      // Delegate exactly once. Observe the real SDK cache after the late key
      // write but before exposing signer settlement to its terminal observer.
      const signing = vi
        .spyOn(SignatureV4.prototype, "sign")
        .mockImplementationOnce(function (this: SignatureV4, ...args) {
          const observe = async (): Promise<void> => {
            warmed = await cacheProbe();
            reused = await cacheProbe();
          };
          return Reflect.apply(originalSign, this, args).then(
            async (value: SignedHttpRequest) => {
              await observe();
              return value;
            },
            async (error: unknown) => {
              await observe();
              throw error;
            },
          );
        });
      const result = transport.getPairObject(
        registration,
        operation,
        expected(),
      );
      const refused = expect(result).rejects.toMatchObject({
        code: "storage_timeout",
        pending: true,
      });
      await entered;
      await vi.advanceTimersByTimeAsync(20001);
      await refused;
      expect(handle).not.toHaveBeenCalled();
      let terminalAttempts = 0;
      vi.mocked(clearCredentialCache).mockImplementationOnce(() => {
        terminalAttempts++;
        if (terminalFault)
          throw new Error("private terminal cache cleanup fault");
        sdk.clearCredentialCache();
      });
      release?.();
      await vi.advanceTimersByTimeAsync(0);
      expect(signing).toHaveBeenCalledTimes(1);
      expect(warmed?.digests).toBe(1);
      expect(reused?.digests).toBe(1);
      expect(reused?.key).toBe(warmed?.key);
      expect(terminalAttempts).toBe(1);
      const afterTerminal = await cacheProbe();
      expect(afterTerminal.digests).toBe(terminalFault ? 1 : 5);
      expect(afterTerminal.key).toEqual(warmed?.key);
      if (!terminalFault) expect(afterTerminal.key).not.toBe(warmed?.key);
      await expect(
        transport.getPairObject(registration, operation, expected()),
      ).rejects.toMatchObject({ code: "cleanup_pending", pending: true });
      expect(handle).not.toHaveBeenCalled();
      // Fault state was asserted before this test-only cache repair.
      sdk.clearCredentialCache();
      const repaired = await cacheProbe();
      expect(repaired.digests).toBe(5);
      sdk.clearCredentialCache();
    }
    vi.restoreAllMocks();
    vi.mocked(clearCredentialCache)
      .mockReset()
      .mockImplementation(sdk.clearCredentialCache);
    const handle = handleResponses();
    vi.resetModules();
    const rejecting = await import("../../src/runtime/durable-pair-r2.js");
    let rejectSigning: ((error: Error) => void) | undefined;
    let rejectEntered: (() => void) | undefined;
    const rejectionEntered = new Promise<void>((resolve) => {
      rejectEntered = resolve;
    });
    const lateRejection = new Promise<HttpRequest>((_resolve, reject) => {
      rejectSigning = reject;
    });
    vi.spyOn(SignatureV4.prototype, "sign").mockImplementationOnce(() => {
      rejectEntered?.();
      return lateRejection;
    });
    const rejection = rejecting.getPairObject(
      registration,
      operation,
      expected(),
    );
    const normalized = expect(rejection).rejects.toMatchObject({
      code: "storage_timeout",
      pending: true,
    });
    await rejectionEntered;
    await vi.advanceTimersByTimeAsync(20001);
    await normalized;
    const beforeTerminal = vi.mocked(clearCredentialCache).mock.calls.length;
    rejectSigning?.(new Error("late private rejection"));
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.mocked(clearCredentialCache).mock.calls.length).toBeGreaterThan(
      beforeTerminal,
    );
    await expect(
      rejecting.putPairObject(
        registration,
        operation,
        "assessment.json",
        payload,
      ),
    ).rejects.toMatchObject({ code: "cleanup_pending", pending: true });
    expect(handle).not.toHaveBeenCalled();
  });
  it("T10 attempts underlying Agent cleanup once and preserves normalized primary through cleanup faults", async () => {
    const transport = await import("../../src/runtime/durable-pair-r2.js");
    const underlying = vi.spyOn(Agent.prototype, "destroy");
    handleResponses();
    expect(
      await transport.getPairObject(registration, operation, expected()),
    ).toEqual(payload);
    expect(underlying).toHaveBeenCalledTimes(1);
    const originalDestroy = Reflect.get(NodeHttpHandler.prototype, "destroy");
    vi.spyOn(NodeHttpHandler.prototype, "destroy").mockImplementationOnce(
      function (this: NodeHttpHandler) {
        Reflect.apply(originalDestroy, this, []);
        throw new Error("private cleanup detail must not escape");
      },
    );
    const wrong = { ...expected(), raw_sha256: "0".repeat(64) };
    await expect(
      transport.getPairObject(registration, operation, wrong),
    ).rejects.toMatchObject({
      code: "storage_readback_invalid",
      phase: "readback",
      pending: true,
    });
    expect(underlying).toHaveBeenCalledTimes(2);
    await expect(
      transport.putPairObject(
        registration,
        operation,
        "assessment.json",
        payload,
      ),
    ).rejects.toMatchObject({ code: "cleanup_pending", pending: true });
    expect(underlying).toHaveBeenCalledTimes(2);
    for (const mode of ["stream", "socket", "handler_before_agent"] as const) {
      vi.restoreAllMocks();
      vi.resetModules();
      vi.useFakeTimers({
        toFake: ["setTimeout", "clearTimeout", "performance"],
      });
      const isolated = await import("../../src/runtime/durable-pair-r2.js");
      let cleanupStarted: (() => void) | undefined;
      const cleanupReached = new Promise<void>((resolve) => {
        cleanupStarted = resolve;
      });
      const destroyAgent = Reflect.get(Agent.prototype, "destroy");
      const underlyingDestroy = vi
        .spyOn(Agent.prototype, "destroy")
        .mockImplementation(function (this: Agent) {
          Reflect.apply(destroyAgent, this, []);
          cleanupStarted?.();
        });
      const source = message();
      const heldSocket = new Socket();
      let heldAgent: Agent | undefined;
      const socketDestroy = vi
        .spyOn(heldSocket, "destroy")
        .mockImplementation(() => heldSocket);
      const streamDestroy =
        mode === "stream"
          ? vi.spyOn(source, "destroy").mockImplementation(() => {
              Reflect.set(source, "destroyed", true);
              return source;
            })
          : undefined;
      const dispatch = vi
        .spyOn(NodeHttpHandler.prototype, "handle")
        .mockImplementation(async function (this: NodeHttpHandler) {
          const config: unknown = await (Reflect.get(
            this,
            "configProvider",
          ) as Promise<unknown>);
          Reflect.set(this, "config", config);
          heldAgent = Reflect.get(config as object, "httpsAgent") as Agent;
          if (mode === "socket")
            Reflect.set(heldAgent.sockets, "test-only-held", [heldSocket]);
          return {
            response: {
              statusCode: 200,
              headers: source.headers as Record<string, string>,
              body: source,
            },
          };
        });
      if (mode === "handler_before_agent")
        vi.spyOn(NodeHttpHandler.prototype, "destroy").mockImplementationOnce(
          () => {
            throw new Error("before external Agent attempt");
          },
        );
      const result = isolated.getPairObject(registration, operation, wrong);
      const rejection = expect(result).rejects.toMatchObject({
        code: "storage_readback_invalid",
        pending: true,
      });
      await cleanupReached;
      await vi.advanceTimersByTimeAsync(5001);
      await rejection;
      expect(underlyingDestroy).toHaveBeenCalledTimes(1);
      if (mode === "stream") {
        expect(source.closed).toBe(false);
        expect(streamDestroy).toHaveBeenCalledTimes(1);
      }
      if (mode === "socket") {
        expect(heldAgent?.sockets["test-only-held"]).toEqual([heldSocket]);
        expect(socketDestroy).toHaveBeenCalledTimes(1);
        expect(heldSocket.destroyed).toBe(false);
      }
      await expect(
        isolated.putPairObject(
          registration,
          "b6200001-0000-4000-8000-000000000002",
          "assessment.json",
          payload,
        ),
      ).rejects.toMatchObject({ code: "cleanup_pending", pending: true });
      expect(dispatch).toHaveBeenCalledTimes(1);
      // Only test-owned cleanup after the exact pending/residual assertions; production never retries it.
      if (heldAgent)
        Reflect.deleteProperty(heldAgent.sockets, "test-only-held");
      socketDestroy.mockRestore();
      heldSocket.destroy();
      streamDestroy?.mockRestore();
    }
    for (const cut of [
      "agent_destroy_throw",
      "source_destroy_throw",
      "capped_destroy_throw",
    ] as const) {
      vi.restoreAllMocks();
      vi.resetModules();
      vi.useFakeTimers({
        toFake: ["setTimeout", "clearTimeout", "performance"],
      });
      const isolated = await import("../../src/runtime/durable-pair-r2.js");
      const source = message(200, [], ["content-length", "5"], false, true);
      let capped: Transform | undefined;
      let pipeReached: (() => void) | undefined;
      const pipeEntered = new Promise<void>((resolve) => {
        pipeReached = resolve;
      });
      let heldAgent: Agent | undefined;
      let agentAttempts = 0;
      let sourceAttempts = 0;
      let cappedAttempts = 0;
      const underlyingAgent = Reflect.get(Agent.prototype, "destroy");
      const actualSourceDestroy = source.destroy.bind(source);
      let actualCappedDestroy: Transform["destroy"] | undefined;
      const agentDestroy = vi
        .spyOn(Agent.prototype, "destroy")
        .mockImplementation(function (this: Agent) {
          agentAttempts++;
          if (cut === "agent_destroy_throw")
            throw new Error("private underlying Agent cleanup fault");
          Reflect.apply(underlyingAgent, this, []);
        });
      const sourceDestroy = vi
        .spyOn(source, "destroy")
        .mockImplementation(function (error) {
          sourceAttempts++;
          if (cut === "source_destroy_throw")
            throw new Error("private source cleanup fault");
          return actualSourceDestroy(error);
        });
      const actualPipe = source.pipe.bind(source);
      const pipe = vi
        .spyOn(source, "pipe")
        .mockImplementation((destination, options) => {
          expect(destination).toBeInstanceOf(Transform);
          pipeReached?.();
          capped = destination as unknown as Transform;
          const destroyCapped = capped.destroy.bind(capped);
          actualCappedDestroy = destroyCapped;
          vi.spyOn(capped, "destroy").mockImplementation((error) => {
            cappedAttempts++;
            if (cut === "capped_destroy_throw")
              throw new Error("private capped cleanup fault");
            return destroyCapped(error);
          });
          return Reflect.apply(actualPipe, source, [destination, options]);
        });
      const dispatch = vi
        .spyOn(NodeHttpHandler.prototype, "handle")
        .mockImplementation(async function (this: NodeHttpHandler) {
          const config = await (Reflect.get(
            this,
            "configProvider",
          ) as Promise<object>);
          Reflect.set(this, "config", config);
          heldAgent = Reflect.get(config, "httpsAgent") as Agent;
          return {
            response: {
              statusCode: 200,
              headers: source.headers as Record<string, string>,
              body: source,
            },
          };
        });
      // Header-count mismatch is the original normalized primary; no body is
      // consumed. Each cleanup fault occurs in the actual production owner.
      const result = isolated.getPairObject(
        registration,
        operation,
        expected(),
      );
      const rejection = expect(result).rejects.toMatchObject({
        code: "storage_readback_invalid",
        phase: "readback",
        pending: true,
      });
      // The pipe cut proves creation, then only bounded fake-clock settlement.
      await pipeEntered;
      await vi.advanceTimersByTimeAsync(5001);
      await rejection;
      expect(pipe).toHaveBeenCalledTimes(1);
      expect(agentAttempts).toBe(1);
      expect(sourceAttempts).toBe(1);
      expect(cappedAttempts).toBe(1);
      expect(source.closed).toBe(cut !== "source_destroy_throw");
      expect(capped?.closed).toBe(cut !== "capped_destroy_throw");
      if (!heldAgent) throw new Error("test-owned Agent observation missing");
      expect(Reflect.get(heldAgent, "destroyAttempted")).toBe(true);
      await expect(
        isolated.putPairObject(
          registration,
          "b6200001-0000-4000-8000-000000000002",
          "assessment.json",
          payload,
        ),
      ).rejects.toMatchObject({ code: "cleanup_pending", pending: true });
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(agentAttempts).toBe(1);
      expect(sourceAttempts).toBe(1);
      expect(cappedAttempts).toBe(1);
      // Only repair after every once-only attempt, remaining-owner and pending
      // assertion. Production never retries an uncertain underlying destroy.
      agentDestroy.mockRestore();
      sourceDestroy.mockRestore();
      if (cut === "agent_destroy_throw")
        Reflect.apply(underlyingAgent, heldAgent, []);
      if (!source.closed) actualSourceDestroy();
      if (capped && !capped.closed && actualCappedDestroy)
        Reflect.apply(actualCappedDestroy, capped, []);
    }
  });
  it("T11 refuses invalid binding and credentials before dispatch and normalizes native failures", async () => {
    const transport = await import("../../src/runtime/durable-pair-r2.js");
    const handle = handleResponses();
    for (const storage of [
      { ...registration.storage, endpoint_origin: "http://unapproved.invalid" },
      { ...registration.storage, prefix: "bad//prefix" },
      { ...registration.storage, prefix: "bad?query" },
    ])
      await expect(
        transport.getPairObject(
          { ...registration, storage },
          operation,
          expected(),
        ),
      ).rejects.toMatchObject({ code: "binding_unavailable", pending: false });
    for (const credentials of [
      { accessKeyId: "bad/id", secretAccessKey: "key" },
      { accessKeyId: "ID", secretAccessKey: "" },
      { accessKeyId: "ID", secretAccessKey: "key", sessionToken: "unexpected" },
    ]) {
      vi.mocked(r2Credentials).mockReturnValueOnce(credentials);
      await expect(
        transport.getPairObject(registration, operation, expected()),
      ).rejects.toMatchObject({ code: "binding_unavailable", pending: false });
    }
    expect(handle).not.toHaveBeenCalled();
    handle.mockRejectedValueOnce(new Error("private native detail"));
    const refusal: unknown = await transport
      .getPairObject(registration, operation, expected())
      .catch((error: unknown) => error);
    expect(refusal).toMatchObject({
      code: "storage_response_invalid",
      phase: "readback",
      pending: false,
      message: "storage_response_invalid",
    });
    expect(handle).toHaveBeenCalledTimes(1);
    vi.mocked(r2Credentials).mockReturnValueOnce({
      accessKeyId: "ID",
      secretAccessKey: "x".repeat(4096),
    });
    expect(
      await transport.getPairObject(registration, operation, expected()),
    ).toEqual(payload);
    expect(handle).toHaveBeenCalledTimes(2);
    const originalFrom = Reflect.get(Buffer, "from");
    const copy = vi.spyOn(Buffer, "from").mockImplementation(((
      ...args: unknown[]
    ) => {
      if (args[0] === payload)
        throw new Error("private snapshot allocation failure");
      const copied: unknown = Reflect.apply(originalFrom, Buffer, args);
      if (!Buffer.isBuffer(copied)) throw new Error("Buffer copy seam shape");
      return copied;
    }) as typeof Buffer.from);
    await expect(
      transport.putPairObject(
        registration,
        operation,
        "assessment.json",
        payload,
      ),
    ).rejects.toMatchObject({
      code: "storage_response_invalid",
      phase: "readback",
      pending: false,
    });
    copy.mockRestore();
    expect(handle).toHaveBeenCalledTimes(2);
  });
});
