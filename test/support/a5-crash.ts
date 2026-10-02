// Crash harness (parent side): spawns the child with a named fault point, waits for the child to HOLD there, lets the caller observe a
// DATABASE fact, then SIGKILLs it. A child that completes without holding is a scenario failure, never a recovery.
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import type pg from "pg";

const childPath = fileURLToPath(new URL("./a5-child.ts", import.meta.url));

export interface Child {
  proc: ChildProcess;
  tag: string;
  held: Promise<void>;
  exited: Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
  }>;
  kill(): Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
  }>;
}

export function spawnChild(
  spec: Record<string, unknown> & { tag: string; fault: string },
): Child {
  const proc = spawn(
    process.execPath,
    ["--import", "tsx", childPath, JSON.stringify(spec)],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  let stdout = "";
  let markHeld!: () => void;
  let failHeld!: (e: Error) => void;
  const held = new Promise<void>((resolve, reject) => {
    markHeld = resolve;
    failHeld = reject;
  });
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
  const exited = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
  }>((resolve) => {
    proc.on("exit", (code, signal) => {
      failHeld(
        new Error(
          `child exited before holding: ${String(code)} ${String(signal)}`,
        ),
      );
      resolve({ code, signal, stdout });
    });
  });
  held.catch(() => undefined);
  return {
    proc,
    tag: spec.tag,
    held,
    exited,
    kill: async () => {
      proc.kill("SIGKILL");
      return exited;
    },
  };
}

/** Polls the database (bounded) until `probe` is true; never sleeps blindly. */
export async function observe(
  probe: () => Promise<boolean>,
  what: string,
  timeoutMs = 30000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probe()) return;
    await sleep(50);
  }
  throw new Error(
    `database fact not observed within ${String(timeoutMs)} ms: ${what}`,
  );
}

export const childBackends = async (
  observer: pg.Pool,
  database: string,
  tag: string,
): Promise<number[]> =>
  (
    await observer.query(
      "SELECT pid FROM pg_stat_activity WHERE datname = $1 AND application_name = $2",
      [database, `a5child_${tag}`],
    )
  ).rows.map((r: { pid: number }) => r.pid);
