// Crash harness (parent side): spawns the child with a named fault point, waits (BOUNDED) for the child to HOLD there, lets the caller
// observe a DATABASE fact, then SIGKILLs it. A child that completes without holding, exits early, fails to spawn or never reaches the
// fault point is a scenario failure, never a recovery; `withChild` always kills the child and waits for its backends to disappear.
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import type pg from "pg";

const childPath = fileURLToPath(new URL("./a5-child.ts", import.meta.url));

export interface ChildExit {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
}
export interface Child {
  proc: ChildProcess;
  tag: string;
  /** Resolves when the child reports it is held at the fault point; rejects on completion, early exit, spawn error or timeout. */
  held: Promise<void>;
  exited: Promise<ChildExit>;
  kill(timeoutMs?: number): Promise<ChildExit>;
}

export function spawnChild(
  spec: Record<string, unknown> & { tag: string; fault: string },
  holdTimeoutMs = 30000,
): Child {
  const proc = spawn(
    process.execPath,
    ["--import", "tsx", childPath, JSON.stringify(spec)],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let stdout = "";
  let markHeld!: () => void;
  let failHeld!: (e: Error) => void;
  const held = new Promise<void>((resolve, reject) => {
    markHeld = resolve;
    failHeld = reject;
  });
  held.catch(() => undefined);
  const timer = setTimeout(() => {
    failHeld(
      new Error(
        `child did not reach fault point '${spec.fault}' within ${String(holdTimeoutMs)} ms`,
      ),
    );
  }, holdTimeoutMs);
  proc.stdout.on("data", (d: Buffer) => {
    stdout += d.toString();
    if (stdout.includes("HELD ")) markHeld();
    if (stdout.includes("COMPLETED_WITHOUT_FAULT"))
      failHeld(
        new Error(
          `child completed without reaching the fault point: ${stdout}`,
        ),
      );
  });
  proc.stderr.on("data", (d: Buffer) => {
    stdout += `[stderr] ${d.toString()}`;
  });
  proc.on("error", (error) => {
    failHeld(error);
  });
  const exited = new Promise<ChildExit>((resolve) => {
    proc.on("exit", (code, signal) => {
      clearTimeout(timer);
      failHeld(
        new Error(
          `child exited before holding: ${String(code)} ${String(signal)}`,
        ),
      );
      resolve({ code, signal, stdout });
    });
    proc.on("error", () => {
      clearTimeout(timer);
      resolve({ code: null, signal: null, stdout });
    });
  });
  return {
    proc,
    tag: spec.tag,
    held,
    exited,
    kill: async (timeoutMs = 10000) => {
      if (proc.exitCode === null && proc.signalCode === null)
        proc.kill("SIGKILL");
      await awaitExit(proc, timeoutMs, `child '${spec.tag}' after SIGKILL`);
      return bounded(exited, timeoutMs, `child '${spec.tag}' exit record`);
    },
  };
}

/** Rejects if `promise` does not settle within `ms` (the pending promise is abandoned; callers own cleanup). */
export async function bounded<T>(
  promise: Promise<T>,
  ms: number,
  what: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${what} did not complete within ${String(ms)} ms`));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Polls (bounded) until `probe` is true; never sleeps blindly. EACH probe is itself bounded by the time that remains, so a hung
 * database query cannot defeat the advertised timeout.
 */
export async function observe(
  probe: () => Promise<boolean>,
  what: string,
  timeoutMs = 30000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    let ok: boolean;
    try {
      ok = await bounded(probe(), remaining, `probe for '${what}'`);
    } catch (error) {
      throw new Error(
        `database fact not observed within ${String(timeoutMs)} ms: ${what} (${error instanceof Error ? error.message : String(error)})`,
        { cause: error },
      );
    }
    if (ok) return;
    await sleep(50);
  }
  throw new Error(
    `database fact not observed within ${String(timeoutMs)} ms: ${what}`,
  );
}

/** Waits (bounded) for a process to exit; fails clearly on non-exit. */
export async function awaitExit(
  proc: Pick<ChildProcess, "once" | "exitCode" | "signalCode" | "pid">,
  ms: number,
  what: string,
): Promise<void> {
  if (proc.exitCode !== null || proc.signalCode !== null) return;
  await bounded(
    new Promise<void>((resolve) => {
      proc.once("exit", () => {
        resolve();
      });
    }),
    ms,
    `${what} (pid ${String(proc.pid)}) exit`,
  ).catch((error: unknown) => {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}: the process did not exit`,
    );
  });
}

export const childBackends = async (
  observer: pg.Pool,
  database: string,
  tag: string,
): Promise<number[]> =>
  (
    await observer.query<{ pid: number }>(
      "SELECT pid FROM pg_stat_activity WHERE datname = $1 AND application_name = $2",
      [database, `a5child_${tag}`],
    )
  ).rows.map((r) => r.pid);

/**
 * Runs `body` with a held child. Whatever happens in `body` (including a failed observation or a failed assertion), the child is
 * SIGKILLed (bounded wait), and its backends are waited out (bounded) before the error, if any, propagates. The ORIGINAL failure is
 * always retained; if cleanup also fails the original error is rethrown with the cleanup diagnostics appended (and as `cause`).
 * Returns the child's exit for the caller's SIGKILL assertions.
 */
export async function withChild(
  observer: pg.Pool,
  database: string,
  spec: Record<string, unknown> & { tag: string; fault: string },
  body: (child: Child) => Promise<void>,
  holdTimeoutMs = 30000,
  cleanupTimeoutMs = 15000,
): Promise<ChildExit> {
  const child = spawnChild(spec, holdTimeoutMs);
  let failure: unknown;
  const cleanup: string[] = [];
  try {
    await child.held;
    await body(child);
  } catch (error) {
    failure = error;
  }
  let exit: ChildExit = { code: null, signal: null, stdout: "" };
  try {
    exit = await child.kill(cleanupTimeoutMs);
  } catch (error) {
    cleanup.push(error instanceof Error ? error.message : String(error));
  }
  try {
    await observe(
      async () =>
        (await childBackends(observer, database, spec.tag)).length === 0,
      `child '${spec.tag}' backends released`,
      cleanupTimeoutMs,
    );
  } catch (error) {
    cleanup.push(error instanceof Error ? error.message : String(error));
  }
  if (failure !== undefined) {
    const original =
      failure instanceof Error ? failure.message : JSON.stringify(failure);
    if (cleanup.length === 0)
      throw failure instanceof Error ? failure : new Error(original);
    throw new Error(
      `${original}; cleanup diagnostics: ${cleanup.join(" | ")}`,
      { cause: failure },
    );
  }
  if (cleanup.length > 0)
    throw new Error(`cleanup failed: ${cleanup.join(" | ")}`);
  return exit;
}
