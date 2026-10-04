// Real entry, with test-only holds and cleanup faults. No alternative fixture or production seam is introduced.
import pg from "pg";
import pino from "pino";

import { fixtureReentryMain } from "../../src/cli/fixture-reentry.js";

interface Spec {
  hold?: string;
  patch?:
    | "end_hang"
    | "end_fail"
    | "flush_hang"
    | "flush_fail"
    | "release_event"
    | "release_throw"
    | "late_pool_error";
}
const spec = JSON.parse(process.argv[2] ?? "{}") as Spec;
const hold = async (): Promise<void> => {
  process.stdout.write(`${JSON.stringify({ test_hold: true })}\n`);
  await new Promise<void>((resolve) =>
    process.stdin.once("data", () => {
      resolve();
    }),
  );
};
if (spec.hold) {
  process.env.DESK_TEST_FAULTS = "1";
  (globalThis as Record<symbol, unknown>)[
    Symbol.for("the-desk.a5.test-fault-hook")
  ] = async (point: string): Promise<void> => {
    if (point === spec.hold) await hold();
  };
}
// Park after PostgreSQL acknowledged COMMIT to the driver, but BEFORE the command receives that acknowledgment. The parent
// independently observes committed rows, then SIGKILLs this process: no command success or setup-complete event was returned.
if (spec.hold === "commit_ack") {
  // Reflect.apply below deliberately preserves each receiver.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const original = pg.Client.prototype.query;
  const prototype = pg.Client.prototype as unknown as {
    query: (...args: unknown[]) => unknown;
  };
  prototype.query = function (this: pg.Client, ...args: unknown[]): unknown {
    const result: unknown = Reflect.apply(original, this, args);
    if (args[0] === "COMMIT")
      return Promise.resolve(result).then(async (value: unknown) => {
        await hold();
        return value;
      });
    return result;
  };
}
if (spec.patch === "end_hang" || spec.patch === "end_fail") {
  (pg.Pool.prototype as { end: () => Promise<void> }).end = () =>
    spec.patch === "end_fail"
      ? Promise.reject(new Error("CLEANUP_SECRET_CANARY"))
      : new Promise<void>(() => undefined);
}
if (spec.patch === "late_pool_error") {
  (pg.Pool.prototype as { end: () => Promise<void> }).end = function (
    this: pg.Pool,
  ): Promise<void> {
    if (this.options.max === 1)
      return Promise.reject(new Error("FIRST_SECRET_CANARY"));
    setTimeout(() => {
      this.emit("error", new Error("SECOND_SECRET_CANARY"));
      process.stdout.write(
        `${JSON.stringify({ late_pool_error_emitted: true })}\n`,
      );
    }, 5500);
    return new Promise<void>(() => undefined);
  };
}
if (
  spec.patch === "flush_hang" ||
  spec.patch === "flush_fail" ||
  spec.patch === "late_pool_error"
) {
  const original = pino.destination.bind(pino);
  pino.destination = (...args: Parameters<typeof pino.destination>) => {
    const destination = original(...args);
    destination.flush = (callback?: (error?: Error) => void): void => {
      if (spec.patch === "flush_fail")
        callback?.(new Error("CLEANUP_SECRET_CANARY"));
    };
    return destination;
  };
}
if (spec.patch === "release_event" || spec.patch === "release_throw") {
  // Reflect.apply below deliberately preserves each receiver.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const original = pg.Pool.prototype.connect;
  // No pool.query in the setup path; patch only its promise checkout, leaving runtime preflight's callback checkout untouched.
  const prototype = pg.Pool.prototype as unknown as {
    connect: (...args: unknown[]) => unknown;
  };
  prototype.connect = function (this: pg.Pool, ...args: unknown[]): unknown {
    const result: unknown = Reflect.apply(original, this, args);
    if (args.length !== 0 || this.options.max !== 1) return result;
    return Promise.resolve(result).then((value: unknown) => {
      const client = value as pg.PoolClient;
      const release = client.release.bind(client);
      client.release = (destroy?: boolean | Error): void => {
        if (spec.patch === "release_event")
          client.emit("error", new Error("FIRST_SECRET_CANARY"));
        release(destroy);
        throw new Error(
          spec.patch === "release_throw"
            ? "FIRST_SECRET_CANARY"
            : "SECOND_SECRET_CANARY",
        );
      };
      return client;
    });
  };
}
let code = 0;
try {
  await fixtureReentryMain([], process.env);
} catch (error) {
  code = 1;
  if (
    spec.patch === "release_event" ||
    spec.patch === "release_throw" ||
    spec.patch === "late_pool_error"
  )
    process.stdout.write(
      `${JSON.stringify({ first_error_retained: error instanceof Error && error.message === "FIRST_SECRET_CANARY" })}\n`,
    );
}
process.exit(code);
