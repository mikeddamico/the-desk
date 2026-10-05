// Test wrapper invokes the real entry. Acknowledgment holds are not actual network-packet-loss simulation.
import pg from "pg";
import pino from "pino";
import { Rejection } from "../../src/runtime/command.js";
import { reviewWaitMain } from "../../src/cli/review-wait.js";
import type { ChildSpec } from "./review-wait-process.js";
const spec = JSON.parse(process.argv[2] ?? "{}") as ChildSpec;
const hold = async (): Promise<void> => {
  process.stdout.write(`${JSON.stringify({ test_hold: true })}\n`);
  await new Promise<void>((resolve) =>
    process.stdin.once("data", () => {
      resolve();
    }),
  );
};
process.env.DESK_TEST_FAULTS = "1";
(globalThis as Record<symbol, unknown>)[
  Symbol.for("the-desk.a5.test-fault-hook")
] = async (point: string): Promise<void> => {
  if (point === spec.throwAt) throw new Error("FIRST_SECRET_CANARY");
  if (point === spec.hold) await hold();
};
if (spec.clock) {
  const clock = spec.clock;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(clock))
    throw new Error("invalid clock control");
  // SQL comparison still executes in real PG, without a JS Date or fabricated elapsed boolean.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const original = pg.Client.prototype.query;
  (
    pg.Client.prototype as unknown as { query: (...args: unknown[]) => unknown }
  ).query = function (this: pg.Client, ...args: unknown[]): unknown {
    if (
      typeof args[0] === "string" &&
      args[0].includes(" AS elapsed") &&
      args[0].includes("clock_timestamp()")
    ) {
      args[0] = args[0].replace("clock_timestamp()", `'${clock}'::timestamptz`);
      process.stdout.write(`${JSON.stringify({ sql_clock_control: true })}\n`);
    }
    return Reflect.apply(original, this, args) as unknown;
  };
}
if (spec.hold === "commit_ack") {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const original = pg.Client.prototype.query;
  (
    pg.Client.prototype as unknown as { query: (...args: unknown[]) => unknown }
  ).query = function (this: pg.Client, ...args: unknown[]): unknown {
    const result: unknown = Reflect.apply(original, this, args);
    return args[0] === "COMMIT"
      ? Promise.resolve(result).then(async (value) => {
          await hold();
          return value;
        })
      : result;
  };
}
if (
  spec.patch === "end_fail" ||
  spec.patch === "end_hang" ||
  spec.patch === "late_pool_error"
) {
  (pg.Pool.prototype as { end: () => Promise<void> }).end = function (
    this: pg.Pool,
  ): Promise<void> {
    if (spec.patch === "end_fail")
      return Promise.reject(new Error("SECOND_SECRET_CANARY"));
    if (spec.patch === "late_pool_error")
      setTimeout(() => {
        this.emit("error", new Error("LATE_SECRET_CANARY"));
        process.stdout.write(
          `${JSON.stringify({ late_pool_error_emitted: true })}\n`,
        );
      }, 5500);
    return new Promise<void>(() => undefined);
  };
}
if (
  spec.patch === "flush_fail" ||
  spec.patch === "flush_hang" ||
  spec.patch === "late_pool_error"
) {
  const original = pino.destination.bind(pino);
  pino.destination = (...args: Parameters<typeof pino.destination>) => {
    const sink = original(...args);
    sink.flush = (callback?: (error?: Error) => void): void => {
      if (spec.patch === "flush_fail")
        callback?.(new Error("SECOND_SECRET_CANARY"));
    };
    return sink;
  };
}
if (spec.patch === "flush_window_first_error") {
  let emitAfterEnd: (() => void) | undefined;
  // A real successful pool shutdown, then first error strictly inside a delayed successful flush.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalEnd = pg.Pool.prototype.end;
  (pg.Pool.prototype as { end: () => Promise<void> }).end = async function (
    this: pg.Pool,
  ): Promise<void> {
    (await Reflect.apply(originalEnd, this, [])) as unknown;
    emitAfterEnd = () => {
      this.emit(
        "error",
        new Rejection("review_role_denied", "FIRST_SECRET_CANARY"),
      );
    };
    process.stdout.write(`${JSON.stringify({ pool_end_completed: true })}\n`);
  };
  const originalDestination = pino.destination.bind(pino);
  pino.destination = (...args: Parameters<typeof pino.destination>) => {
    const sink = originalDestination(...args);
    sink.flush = (callback?: (error?: Error) => void): void => {
      setTimeout(() => {
        if (!emitAfterEnd) {
          callback?.(new Error("shutdown control failed"));
          return;
        }
        emitAfterEnd();
        process.stdout.write(
          `${JSON.stringify({ first_error_during_flush: true, flush_resolved: true })}\n`,
        );
        callback?.();
      }, 50);
    };
    return sink;
  };
}
if (spec.patch === "release_fail") {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const original = pg.Pool.prototype.connect;
  (
    pg.Pool.prototype as unknown as { connect: (...args: unknown[]) => unknown }
  ).connect = function (this: pg.Pool, ...args: unknown[]): unknown {
    const result: unknown = Reflect.apply(original, this, args);
    if (args.length) return result;
    return Promise.resolve(result).then((value) => {
      const client = value as pg.PoolClient;
      const release = client.release.bind(client);
      client.release = (destroy?: boolean | Error): void => {
        release(destroy);
        throw new Error(
          spec.throwAt ? "SECOND_SECRET_CANARY" : "FIRST_SECRET_CANARY",
        );
      };
      return client;
    });
  };
}
try {
  await reviewWaitMain(process.argv.slice(3), process.env);
} catch (error) {
  process.exitCode = 1;
  if (
    spec.throwAt ||
    spec.patch === "flush_window_first_error" ||
    spec.patch === "release_fail"
  )
    process.stdout.write(
      `${JSON.stringify({ first_error_retained: error instanceof Error && (error.message === "FIRST_SECRET_CANARY" || (error instanceof Rejection && error.code === "review_role_denied" && error.message === "review_role_denied: FIRST_SECRET_CANARY")) })}\n`,
    );
}
process.exit(process.exitCode ?? 0);
