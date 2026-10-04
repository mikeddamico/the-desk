// Test wrapper for the P1 process entry. It runs the REAL entry (imported after the test-only setup below) as the same process:
//  - holdOnCommit N: installs a hook under the existing fault seam (inert unless DESK_TEST_FAULTS=1 AND a hook is registered, both done only
//    here) that parks the process after the Nth acknowledged command COMMIT, so a parent can observe the database fact and SIGKILL it;
//  - patch: injects a cleanup fault (the logger flush or the pool shutdown fails or never completes) AFTER the work, without touching
//    the entry's source.
// argv: [node, this file, <spec json>, ...entry args]
import pg from "pg";
import pino from "pino";

import { ENTRY } from "./p1-entry.js";
import type { WrapperSpec } from "./p1-entry.js";

const spec = JSON.parse(process.argv[2] ?? "{}") as WrapperSpec;
process.argv = [process.argv[0] ?? "node", ENTRY, ...process.argv.slice(3)];

if (spec.holdOnCommit !== undefined) {
  process.env.DESK_TEST_FAULTS = "1";
  let commits = 0;
  (globalThis as Record<symbol, unknown>)[
    Symbol.for("the-desk.a5.test-fault-hook")
  ] = async (point: string): Promise<void> => {
    if (point !== "after_commit_before_return") return;
    commits += 1;
    if (commits === spec.holdOnCommit) {
      process.stdout.write(`HELD ${String(commits)}\n`);
      await new Promise<never>(() => undefined); // parked until killed
    }
  };
}

if (spec.patch === "flush_fail" || spec.patch === "flush_hang") {
  const original = pino.destination.bind(pino);
  pino.destination = (...args: Parameters<typeof pino.destination>) => {
    const destination = original(...args);
    destination.flush = (callback?: (error?: Error) => void): void => {
      if (spec.patch === "flush_fail")
        callback?.(new Error("INJECTED_FLUSH_FAILURE_CANARY"));
      // flush_hang: the callback is never called
    };
    return destination;
  };
}
if (spec.patch === "end_reject" || spec.patch === "end_hang") {
  (pg.Pool.prototype as { end: () => Promise<void> }).end = () =>
    spec.patch === "end_reject"
      ? Promise.reject(new Error("INJECTED_END_FAILURE_CANARY"))
      : new Promise<void>(() => undefined);
}

await import(ENTRY);
