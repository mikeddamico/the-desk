/** Fixed R2 single-object transport. No retries, redirects, multipart, listing, or caller URLs. */
import { Agent } from "node:https";
import { checkServerIdentity } from "node:tls";
import { Readable, Transform } from "node:stream";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
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
let pendingClient = false;

class BoundedHandler extends NodeHttpHandler {
  source: Readable | undefined;
  capped: Transform | undefined;
  constructor(
    agent: Agent,
    private readonly maxBytes: number,
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
    const result = await super.handle(...args);
    requirePair(
      result.response.body instanceof Readable,
      "storage_response_invalid",
      "readback",
    );
    const source = result.response.body;
    this.source = source;
    const maximum = result.response.statusCode >= 300 ? 65536 : this.maxBytes;
    let count = 0;
    const capped = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        count += chunk.length;
        if (chunk.length > 65536)
          callback(new PairRefusal("resource_limit", "readback"));
        else if (count > maximum)
          callback(new PairRefusal("storage_readback_invalid", "readback"));
        else callback(null, chunk);
      },
    });
    this.capped = capped;
    source.once("error", (error) => {
      capped.destroy(error);
    });
    capped.once("error", (error) => {
      source.destroy(error);
    });
    result.response.body = source.pipe(capped);
    return result;
  }
}
function pending(agent: Agent, handler: BoundedHandler): boolean {
  return (
    Object.values(agent.sockets).some(
      (sockets) => (sockets?.length ?? 0) > 0,
    ) ||
    Object.values(agent.freeSockets).some(
      (sockets) => (sockets?.length ?? 0) > 0,
    ) ||
    Object.values(agent.requests).some(
      (requests) => (requests?.length ?? 0) > 0,
    ) ||
    (handler.source !== undefined && !handler.source.closed) ||
    (handler.capped !== undefined && !handler.capped.closed)
  );
}
async function request<T>(
  registration: RegisteredPair,
  maximum: number,
  work: (client: S3Client, signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (pendingClient) throw new PairRefusal("cleanup_pending", "cleanup", true);
  const credentials = r2Credentials(registration);
  const options = {
    keepAlive: false,
    maxSockets: 1,
    maxTotalSockets: 1,
    maxFreeSockets: 0,
    minVersion: "TLSv1.2" as const,
    rejectUnauthorized: true,
    checkServerIdentity,
    servername: new URL(registration.storage.endpoint_origin).hostname,
    proxyEnv: process.env,
  };
  const agent = new Agent(options);
  const handler = new BoundedHandler(agent, maximum);
  const controller = new AbortController();
  const client = new S3Client({
    endpoint: registration.storage.endpoint_origin,
    region: "auto",
    forcePathStyle: true,
    maxAttempts: 1,
    retryMode: "standard",
    followRegionRedirects: false,
    useAccelerateEndpoint: false,
    useDualstackEndpoint: false,
    useFipsEndpoint: false,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials,
    requestHandler: handler,
    logger: NO_LOGGER,
  });
  let timer: NodeJS.Timeout | undefined;
  let primary: unknown;
  let value: T | undefined;
  let settled = false;
  const isSettled = (): boolean => settled;
  let cleanupPending = false;
  try {
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new PairRefusal("storage_timeout", "readback"));
      }, 15000);
    });
    const invocation = work(client, controller.signal);
    void invocation.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    value = await Promise.race([invocation, deadline]);
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
    if (timer) clearTimeout(timer);
    controller.abort();
    try {
      handler.source?.destroy();
      handler.capped?.destroy();
      client.destroy();
      agent.destroy();
    } catch {
      cleanupPending = true;
    }
    const until = performance.now() + 5000;
    while (
      (!isSettled() || pending(agent, handler)) &&
      performance.now() < until
    )
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 10);
      });
    cleanupPending ||= !isSettled() || pending(agent, handler);
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
/** The caller durably records pending intent before entering this function. */
export async function putPairObject(
  registration: RegisteredPair,
  operation: string,
  name: FileName,
  bytes: Buffer,
): Promise<"created" | "occupied"> {
  requirePair(
    bytes.length <= (name.endsWith(".wav") ? 5760044 : 65536),
    "resource_limit",
    "upload",
  );
  return request(registration, 65536, async (client, signal) => {
    try {
      const response = await client.send(
        new PutObjectCommand({
          Bucket: registration.storage.bucket,
          Key: keyFor(registration.storage, operation, name),
          Body: bytes,
          ContentLength: bytes.length,
          IfNoneMatch: "*",
          ContentType: name.endsWith(".wav")
            ? "application/octet-stream"
            : "application/json",
          CacheControl: "private,no-store",
        }),
        { abortSignal: signal },
      );
      requirePair(
        (response.$metadata.httpStatusCode ?? 0) >= 200 &&
          (response.$metadata.httpStatusCode ?? 0) < 300 &&
          response.$metadata.attempts === 1,
        "storage_response_invalid",
        "upload",
      );
      return "created";
    } catch (error) {
      if (typeof error === "object" && error !== null) {
        const metadata = Reflect.get(error, "$metadata") as
          | { httpStatusCode?: number; attempts?: number }
          | undefined;
        if (metadata?.httpStatusCode === 412 && metadata.attempts === 1)
          return "occupied";
      }
      throw error;
    }
  });
}
export async function getPairObject(
  registration: RegisteredPair,
  operation: string,
  expected: ObjectIdentity,
): Promise<Buffer> {
  const count = Number(expected.byte_length);
  requirePair(
    /^(0|[1-9][0-9]*)$/.test(expected.byte_length) &&
      Number.isSafeInteger(count) &&
      count <= (expected.name.endsWith(".wav") ? 5760044 : 65536),
    "resource_limit",
    "readback",
  );
  return request(registration, count, async (client, signal) => {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: registration.storage.bucket,
        Key: keyFor(registration.storage, operation, expected.name),
      }),
      { abortSignal: signal },
    );
    requirePair(
      response.$metadata.httpStatusCode === 200 &&
        response.$metadata.attempts === 1 &&
        response.ContentLength === count &&
        (response.ContentEncoding === undefined ||
          response.ContentEncoding === "identity") &&
        response.Body instanceof Readable,
      "storage_readback_invalid",
      "readback",
    );
    const bytes = Buffer.alloc(count);
    let cursor = 0;
    for await (const value of response.Body) {
      requirePair(
        Buffer.isBuffer(value) && cursor + value.length <= count,
        "storage_readback_invalid",
        "readback",
      );
      value.copy(bytes, cursor);
      cursor += value.length;
    }
    requirePair(
      cursor === count && sha(bytes) === expected.raw_sha256,
      "storage_readback_invalid",
      "readback",
    );
    return bytes;
  });
}
