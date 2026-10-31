/** Fixed private PUT/GET transport; owns snapshots and requests, never retries an uncertain write. */
import { Agent } from "node:https";
import { IncomingMessage } from "node:http";
import { checkServerIdentity } from "node:tls";
import { Readable, Transform } from "node:stream";
import { SignatureV4, clearCredentialCache } from "@smithy/signature-v4";
import { HttpRequest } from "@smithy/core/transport";
import { Sha256Node } from "@smithy/core/checksum";
import type {
  Checksum,
  ChecksumConstructor,
  SourceData,
  HttpRequest as SignedHttpRequest,
} from "@smithy/types";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { r2Credentials, type RegisteredPair } from "./durable-pair-binding.js";
import {
  PairRefusal,
  requirePair,
  keyFor,
  type FileName,
  type ObjectIdentity,
} from "./durable-pair-contract.js";
import { sha } from "./technical-master-checks.js";

const discardLog = (): void => undefined;
const NO_LOGGER = {
  debug: discardLog,
  info: discardLog,
  warn: discardLog,
  error: discardLog,
};
const EMPTY = Buffer.alloc(0);
let pendingClient = false;

/** Retains only request-owned replay keys; reset constructs a fresh pinned delegate. */
function requestChecksums(): {
  constructor: ChecksumConstructor;
  close: () => void;
} {
  let open = true;
  const instances = new Set<OwnedChecksum>();
  class OwnedChecksum implements Checksum {
    readonly digestLength = 32;
    private original: Uint8Array | undefined;
    private argument: Uint8Array | undefined;
    private delegate: Checksum | undefined;
    private busy = false;
    constructor(secret?: SourceData) {
      requirePair(open, "cleanup_pending", "cleanup");
      if (secret !== undefined) {
        const bytes =
          typeof secret === "string"
            ? Buffer.from(secret, "utf8")
            : ArrayBuffer.isView(secret)
              ? new Uint8Array(
                  secret.buffer,
                  secret.byteOffset,
                  secret.byteLength,
                )
              : new Uint8Array(secret);
        // SigV4 prepends four ASCII AWS4 bytes to the admitted 4096-byte secret.
        requirePair(bytes.byteLength <= 4100, "resource_limit", "binding");
        this.original = Uint8Array.from(bytes);
      }
      instances.add(this);
      this.reconstruct();
    }
    private reconstruct(): void {
      this.argument?.fill(0);
      this.argument =
        this.original === undefined
          ? undefined
          : Uint8Array.from(this.original);
      // An empty typed array is a defined HMAC key, unlike a falsey empty string.
      this.delegate =
        this.argument === undefined
          ? new Sha256Node()
          : new Sha256Node(this.argument);
    }
    private current(): Checksum {
      requirePair(
        open && !this.busy && this.delegate,
        "cleanup_pending",
        "cleanup",
      );
      return this.delegate;
    }
    update(bytes: Uint8Array): void {
      this.current().update(bytes);
    }
    async digest(): Promise<Uint8Array> {
      const delegate = this.current();
      this.busy = true;
      try {
        return Uint8Array.from(await delegate.digest());
      } finally {
        this.busy = false;
        if (!open) this.release();
      }
    }
    reset(): void {
      this.current();
      this.reconstruct();
    }
    release(): void {
      // Closing the owner revokes authority immediately, but a pending delegate
      // still owns its key views until digest's terminal finally releases them.
      if (this.busy) return;
      this.original?.fill(0);
      this.argument?.fill(0);
      this.original = undefined;
      this.argument = undefined;
      this.delegate = undefined;
      instances.delete(this);
    }
  }
  return {
    constructor: OwnedChecksum,
    close() {
      open = false;
      for (const instance of instances) instance.release();
    },
  };
}

/** The handler destroys external agents too; share one underlying destroy attempt. */
class OwnedAgent extends Agent {
  destroyAttempted = false;
  override destroy(): void {
    if (this.destroyAttempted) return;
    this.destroyAttempted = true;
    super.destroy();
  }
}
interface HeaderFacts {
  length: number | undefined;
  encoding: string | undefined;
  transfer: string | undefined;
}
function responseHeaders(
  source: IncomingMessage,
  headers: Record<string, string>,
): HeaderFacts {
  const raw = source.rawHeaders;
  requirePair(
    Array.isArray(raw) && raw.length % 2 === 0 && raw.length <= 256,
    "storage_response_invalid",
    "readback",
  );
  const collected = new Map<string, string[]>();
  let size = 0;
  for (let index = 0; index < raw.length; index += 2) {
    const name = raw[index];
    const value = raw[index + 1];
    requirePair(
      typeof name === "string" && typeof value === "string",
      "storage_response_invalid",
      "readback",
    );
    size += Buffer.byteLength(name) + Buffer.byteLength(value);
    requirePair(
      size <= 16384 &&
        /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) &&
        Array.from(value).every((character) => {
          const code = character.charCodeAt(0);
          return code === 9 || (code >= 32 && code !== 127);
        }),
      "storage_response_invalid",
      "readback",
    );
    const trimmed = value.replace(/^[ \t]+|[ \t]+$/g, "");
    requirePair(
      !trimmed.includes("\t"),
      "storage_response_invalid",
      "readback",
    );
    const lower = name.toLowerCase();
    collected.set(lower, [...(collected.get(lower) ?? []), trimmed]);
  }
  for (const name of [
    "content-length",
    "content-encoding",
    "transfer-encoding",
    "location",
  ]) {
    const values = collected.get(name) ?? [];
    requirePair(
      values.length <= 1 &&
        (values.length === 0
          ? headers[name] === undefined
          : headers[name]?.replace(/^[ \t]+|[ \t]+$/g, "") === values[0]),
      "storage_response_invalid",
      "readback",
    );
  }
  const lengthText = collected.get("content-length")?.[0];
  const transfer = collected.get("transfer-encoding")?.[0];
  requirePair(
    lengthText === undefined || /^(0|[1-9][0-9]*)$/.test(lengthText),
    "storage_response_invalid",
    "readback",
  );
  const length = lengthText === undefined ? undefined : Number(lengthText);
  requirePair(
    (length === undefined || Number.isSafeInteger(length)) &&
      (transfer === undefined || transfer === "chunked") &&
      !(length !== undefined && transfer !== undefined),
    "storage_response_invalid",
    "readback",
  );
  return { length, encoding: collected.get("content-encoding")?.[0], transfer };
}

class BoundedHandler extends NodeHttpHandler {
  source: IncomingMessage | Readable | undefined;
  capped: Transform | undefined;
  facts: HeaderFacts | undefined;
  sourceEnded = false;
  sourceClosed = false;
  sourceAborted = false;
  sourceFault: unknown;
  dispatches = 0;
  cleanupFault = false;
  private sourceDestroyAttempted = false;
  private cappedDestroyAttempted = false;
  constructor(
    agent: OwnedAgent,
    private readonly maxBytes: number,
    private readonly method: "GET" | "PUT",
  ) {
    super({
      httpsAgent: agent,
      connectionTimeout: 5000,
      requestTimeout: 15000,
      socketTimeout: 15000,
      throwOnRequestTimeout: true,
      logger: NO_LOGGER,
    });
  }
  override async handle(
    ...args: Parameters<NodeHttpHandler["handle"]>
  ): Promise<Awaited<ReturnType<NodeHttpHandler["handle"]>>> {
    requirePair(
      ++this.dispatches === 1,
      "storage_response_invalid",
      "readback",
    );
    const result = await super.handle(...args);
    const source: unknown = result.response.body;
    // Own the returned stream before any header/type predicate can throw.
    if (source instanceof Readable) {
      this.source = source;
      this.sourceEnded = source.readableEnded;
      this.sourceClosed = source.closed;
      source.once("error", (error: unknown) => {
        const fault =
          error instanceof PairRefusal
            ? error
            : source instanceof IncomingMessage &&
                (!source.complete || source.readableAborted)
              ? new PairRefusal("storage_readback_invalid", "readback")
              : error;
        this.sourceFault ??= fault;
        this.closeStream(
          "capped",
          fault instanceof Error ? fault : new Error("response stream failed"),
        );
      });
      source.once("end", () => {
        this.sourceEnded = true;
      });
      source.once("aborted", () => {
        this.sourceAborted = true;
        this.closeStream(
          "capped",
          new PairRefusal("storage_readback_invalid", "readback"),
        );
      });
      source.once("close", () => {
        this.sourceClosed = true;
        if (!this.sourceEnded)
          this.closeStream(
            "capped",
            new PairRefusal("storage_readback_invalid", "readback"),
          );
      });
    }
    requirePair(
      source instanceof IncomingMessage,
      "storage_response_invalid",
      "readback",
    );
    this.facts = responseHeaders(source, result.response.headers);
    requirePair(
      Number.isInteger(result.response.statusCode) &&
        result.response.statusCode >= 200 &&
        result.response.statusCode <= 599,
      "storage_response_invalid",
      "readback",
    );
    const maximum =
      this.method === "GET" && result.response.statusCode === 200
        ? this.maxBytes
        : 65536;
    let count = 0;
    const capped = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        if (!Buffer.isBuffer(chunk) || chunk.length > 65536)
          callback(new PairRefusal("resource_limit", "readback"));
        else if ((count += chunk.length) > maximum)
          callback(new PairRefusal("storage_readback_invalid", "readback"));
        else callback(null, chunk);
      },
    });
    this.capped = capped;
    capped.once("error", (error) => {
      this.closeStream("source", error);
    });
    if (this.sourceFault)
      throw this.sourceFault instanceof Error
        ? this.sourceFault
        : new PairRefusal("storage_response_invalid", "readback");
    // Events can precede the handler handoff or happen during header reads.
    // Own/listen first, then refuse terminal flags immediately before piping.
    // The legacy aborted flag is observed only as additional refusal evidence;
    // supported readableAborted/destroyed/end state remains independently checked.
    requirePair(
      !this.sourceAborted &&
        !Reflect.get(source, "aborted") &&
        !source.readableAborted &&
        (!(this.sourceClosed || source.closed || source.destroyed) ||
          (this.sourceEnded && source.readableEnded && source.complete)),
      "storage_readback_invalid",
      "readback",
    );
    result.response.body = source.pipe(capped);
    return result;
  }
  complete(): boolean {
    return (
      this.source instanceof IncomingMessage &&
      this.source.complete &&
      !this.source.readableAborted &&
      !this.sourceAborted &&
      this.sourceEnded &&
      this.sourceFault === undefined
    );
  }
  closeStream(which: "source" | "capped", error?: Error): void {
    const stream = this[which];
    const attempted =
      which === "source"
        ? this.sourceDestroyAttempted
        : this.cappedDestroyAttempted;
    if (!stream || stream.destroyed || attempted) return;
    if (which === "source") this.sourceDestroyAttempted = true;
    else this.cappedDestroyAttempted = true;
    try {
      stream.destroy(error);
    } catch {
      this.cleanupFault = true;
    }
  }
}
function pending(
  agent: OwnedAgent | undefined,
  handler: BoundedHandler | undefined,
): boolean {
  return (
    (agent !== undefined &&
      (Object.values(agent.sockets).some(
        (sockets) => (sockets?.length ?? 0) > 0,
      ) ||
        Object.values(agent.freeSockets).some(
          (sockets) => (sockets?.length ?? 0) > 0,
        ) ||
        Object.values(agent.requests).some(
          (requests) => (requests?.length ?? 0) > 0,
        ))) ||
    (handler?.source !== undefined && !handler.source.closed) ||
    (handler?.capped !== undefined && !handler.capped.closed)
  );
}
function unsignedRequest(
  registration: RegisteredPair,
  operation: string,
  name: FileName,
  body: Buffer | undefined,
): HttpRequest {
  const origin = registration.storage.endpoint_origin;
  const bucket = registration.storage.bucket;
  const key = keyFor(registration.storage, operation, name);
  requirePair(
    /^https:\/\/[0-9a-f]{32}\.r2\.cloudflarestorage\.com$/.test(origin) &&
      /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) &&
      /^[a-z0-9][a-z0-9/_-]{0,127}$/.test(registration.storage.prefix) &&
      !registration.storage.prefix.includes("//") &&
      !registration.storage.prefix.endsWith("/") &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        operation,
      ),
    "binding_unavailable",
    "binding",
  );
  const hostname = new URL(origin).hostname;
  const path = "/" + bucket + "/" + key;
  requirePair(
    /^\/[A-Za-z0-9_./-]+$/.test(path) &&
      !path
        .split("/")
        .some(
          (part, index) =>
            index > 0 && (part === "" || part === "." || part === ".."),
        ),
    "binding_unavailable",
    "binding",
  );
  const headers: Record<string, string> = {
    host: hostname,
    "x-amz-content-sha256": sha(body ?? EMPTY),
  };
  if (body !== undefined) {
    headers["content-length"] = String(body.length);
    headers["content-type"] = name.endsWith(".wav")
      ? "application/octet-stream"
      : "application/json";
    headers["cache-control"] = "private,no-store";
    headers["if-none-match"] = "*";
  }
  return new HttpRequest({
    protocol: "https:",
    hostname,
    method: body === undefined ? "GET" : "PUT",
    path,
    query: {},
    headers,
    ...(body === undefined ? {} : { body }),
  });
}
function checkSignature(
  original: HttpRequest,
  signed: SignedHttpRequest,
  date: Date,
  id: string,
): void {
  const stamp = date.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const names = [...Object.keys(original.headers), "x-amz-date"].sort();
  const authorization = signed.headers.authorization;
  const prefix = `AWS4-HMAC-SHA256 Credential=${id}/${stamp.slice(0, 8)}/auto/s3/aws4_request, SignedHeaders=${names.join(";")}, Signature=`;
  requirePair(
    original.body === undefined ||
      (Buffer.isBuffer(signed.body) &&
        sha(signed.body) === original.headers["x-amz-content-sha256"]),
    "storage_response_invalid",
    "readback",
  );
  requirePair(
    signed.method === original.method &&
      signed.protocol === "https:" &&
      signed.hostname === original.hostname &&
      signed.path === original.path &&
      signed.port === undefined &&
      signed.username === undefined &&
      signed.password === undefined &&
      signed.fragment === undefined &&
      Object.keys(signed.query ?? {}).length === 0 &&
      signed.body === original.body &&
      signed.headers["x-amz-date"] === stamp &&
      Object.keys(signed.headers).sort().join(";") ===
        [...names, "authorization"].sort().join(";") &&
      Object.entries(original.headers).every(
        ([name, value]) => signed.headers[name] === value,
      ) &&
      typeof authorization === "string" &&
      authorization.startsWith(prefix) &&
      /^[0-9a-f]{64}$/.test(authorization.slice(prefix.length)),
    "storage_response_invalid",
    "readback",
  );
}

async function request<T>(
  registration: RegisteredPair,
  operation: string,
  name: FileName,
  body: Buffer | undefined,
  maximum: number,
  consume: (
    response: Awaited<ReturnType<NodeHttpHandler["handle"]>>["response"],
    handler: BoundedHandler,
  ) => Promise<T>,
): Promise<T> {
  if (pendingClient) throw new PairRefusal("cleanup_pending", "cleanup", true);
  const controller = new AbortController();
  const checksums = requestChecksums();
  const deadline = performance.now() + 15000;
  let agent: OwnedAgent | undefined;
  let handler: BoundedHandler | undefined;
  let timer: NodeJS.Timeout | undefined;
  let primary: unknown;
  let value: T | undefined;
  let open = true;
  let workSettled = true;
  let signerSettled = true;
  let httpSettled = true;
  let cleanupPending = false;
  const unsettled = (): boolean =>
    !workSettled || !signerSettled || !httpSettled;
  function terminalSigner(): void {
    signerSettled = true;
    try {
      clearCredentialCache();
    } catch {
      cleanupPending = true;
      pendingClient = true;
    }
    if (!open) {
      try {
        checksums.close();
      } catch {
        cleanupPending = true;
        pendingClient = true;
      }
    }
  }
  function beforeDispatch(): void {
    requirePair(
      open && !controller.signal.aborted && performance.now() < deadline,
      "storage_timeout",
      "readback",
    );
    requirePair(!cleanupPending, "cleanup_pending", "cleanup");
  }
  try {
    const timedOut = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new PairRefusal("storage_timeout", "readback"));
      }, 15000);
    });
    const credentials = r2Credentials(registration);
    requirePair(
      Object.keys(credentials).sort().join(",") ===
        "accessKeyId,secretAccessKey" &&
        typeof credentials.accessKeyId === "string" &&
        /^[A-Za-z0-9]{1,128}$/.test(credentials.accessKeyId) &&
        typeof credentials.secretAccessKey === "string" &&
        Buffer.byteLength(credentials.secretAccessKey) > 0 &&
        Buffer.byteLength(credentials.secretAccessKey) <= 4096,
      "binding_unavailable",
      "binding",
    );
    const unsigned = unsignedRequest(registration, operation, name, body);
    const date = new Date();
    clearCredentialCache();
    const signer = new SignatureV4({
      service: "s3",
      region: "auto",
      credentials: { ...credentials },
      uriEscapePath: false,
      applyChecksum: true,
      sha256: checksums.constructor,
    });
    agent = new OwnedAgent({
      keepAlive: false,
      maxSockets: 1,
      maxTotalSockets: 1,
      maxFreeSockets: 0,
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
      checkServerIdentity,
      servername: unsigned.hostname,
      proxyEnv: process.env,
    });
    handler = new BoundedHandler(
      agent,
      maximum,
      body === undefined ? "GET" : "PUT",
    );
    const currentHandler = handler;
    workSettled = false;
    const work = (async (): Promise<T> => {
      beforeDispatch();
      const signing = signer.sign(unsigned, {
        signingDate: date,
        signableHeaders: new Set([
          ...Object.keys(unsigned.headers),
          "x-amz-date",
        ]),
      });
      signerSettled = false;
      void signing.then(terminalSigner, terminalSigner);
      const signed = await signing;
      beforeDispatch();
      checkSignature(unsigned, signed, date, credentials.accessKeyId);
      beforeDispatch();
      httpSettled = false;
      const invocation = currentHandler.handle(new HttpRequest(signed), {
        abortSignal: controller.signal,
      });
      const terminalHttp = (): void => {
        httpSettled = true;
        if (!open) {
          currentHandler.closeStream("source");
          currentHandler.closeStream("capped");
          if (currentHandler.cleanupFault) pendingClient = true;
        }
      };
      void invocation.then(terminalHttp, terminalHttp);
      const response = await invocation;
      return consume(response.response, currentHandler);
    })();
    void work.then(
      () => {
        workSettled = true;
      },
      () => {
        workSettled = true;
      },
    );
    value = await Promise.race([work, timedOut]);
  } catch (error) {
    primary =
      error instanceof PairRefusal
        ? error
        : new PairRefusal(
            controller.signal.aborted
              ? "storage_timeout"
              : "storage_response_invalid",
            "readback",
          );
  } finally {
    open = false;
    if (timer) clearTimeout(timer);
    controller.abort();
    // Keep cleanup attempts independent; the handler can also destroy its supplied Agent.
    handler?.closeStream("source");
    handler?.closeStream("capped");
    try {
      handler?.destroy();
    } catch {
      cleanupPending = true;
    }
    try {
      if (agent && !agent.destroyAttempted) agent.destroy();
    } catch {
      cleanupPending = true;
    }
    try {
      clearCredentialCache();
    } catch {
      cleanupPending = true;
    }
    try {
      checksums.close();
    } catch {
      cleanupPending = true;
    }
    const until = performance.now() + 5000;
    while (
      (unsettled() || pending(agent, handler)) &&
      performance.now() < until
    )
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 10);
      });
    cleanupPending ||=
      unsettled() || handler?.cleanupFault === true || pending(agent, handler);
    pendingClient ||= cleanupPending;
  }
  if (primary instanceof PairRefusal)
    throw new PairRefusal(
      primary.code,
      primary.phase,
      primary.pending || cleanupPending,
    );
  if (cleanupPending) throw new PairRefusal("cleanup_pending", "cleanup", true);
  return value as T;
}

/** Conditionally writes an owned snapshot; occupied objects still require the caller's exact full readback. */
export async function putPairObject(
  registration: RegisteredPair,
  operation: string,
  name: FileName,
  bytes: Buffer,
): Promise<"created" | "occupied"> {
  if (pendingClient) throw new PairRefusal("cleanup_pending", "cleanup", true);
  requirePair(
    Buffer.isBuffer(bytes) &&
      !(bytes.buffer instanceof SharedArrayBuffer) &&
      bytes.length <= (name.endsWith(".wav") ? 5760044 : 65536),
    "resource_limit",
    "upload",
  );
  let snapshot: Buffer;
  try {
    snapshot = Buffer.from(bytes); // Copy before the first await; signing and sending share these exact bytes.
  } catch {
    throw new PairRefusal("storage_response_invalid", "readback");
  }
  return request(
    registration,
    operation,
    name,
    snapshot,
    65536,
    async (response, handler) => {
      let count = 0;
      for await (const value of response.body as Readable)
        count += (value as Buffer).length;
      requirePair(
        handler.complete() &&
          (handler.facts?.length === undefined ||
            handler.facts.length === count) &&
          (response.statusCode !== 204 || count === 0),
        "storage_response_invalid",
        "readback",
      );
      requirePair(
        (response.statusCode >= 200 && response.statusCode < 300) ||
          response.statusCode === 412,
        "storage_response_invalid",
        "readback",
      );
      return response.statusCode === 412 ? "occupied" : "created";
    },
  );
}
/** Reads complete authenticated bytes from the fixed origin; remote readback grants no gate or lifecycle authority. */
export async function getPairObject(
  registration: RegisteredPair,
  operation: string,
  expected: ObjectIdentity,
): Promise<Buffer> {
  if (pendingClient) throw new PairRefusal("cleanup_pending", "cleanup", true);
  const count = Number(expected.byte_length);
  requirePair(
    /^(0|[1-9][0-9]*)$/.test(expected.byte_length) &&
      Number.isSafeInteger(count) &&
      count <= (expected.name.endsWith(".wav") ? 5760044 : 65536),
    "resource_limit",
    "readback",
  );
  return request(
    registration,
    operation,
    expected.name,
    undefined,
    count,
    async (response, handler) => {
      if (response.statusCode !== 200) {
        for await (const value of response.body as Readable)
          requirePair(
            Buffer.isBuffer(value),
            "storage_response_invalid",
            "readback",
          );
        throw new PairRefusal("storage_response_invalid", "readback");
      }
      requirePair(
        handler.facts?.length === count &&
          handler.facts.transfer === undefined &&
          (handler.facts.encoding === undefined ||
            handler.facts.encoding === "identity"),
        "storage_readback_invalid",
        "readback",
      );
      const bytes = Buffer.alloc(count);
      let cursor = 0;
      for await (const value of response.body as Readable) {
        requirePair(
          Buffer.isBuffer(value) && cursor + value.length <= count,
          "storage_readback_invalid",
          "readback",
        );
        value.copy(bytes, cursor);
        cursor += value.length;
      }
      requirePair(
        handler.complete() &&
          cursor === count &&
          sha(bytes) === expected.raw_sha256,
        "storage_readback_invalid",
        "readback",
      );
      return bytes;
    },
  );
}
