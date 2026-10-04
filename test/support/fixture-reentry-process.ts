import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

import { bounded } from "./a5-crash.js";
import { entryEnv, type EntryRun } from "./p1-entry.js";
import type { DbEnv } from "./db-env.js";

export interface ReentryChild {
  proc: ChildProcess;
  held: Promise<void>;
  exited: Promise<EntryRun>;
  kill(): Promise<EntryRun>;
}
export const fixtureEnv = (
  db: DbEnv,
  extra: Record<string, string> = {},
): Record<string, string> =>
  entryEnv(db.runtimeUrl, {
    MIGRATION_DATABASE_URL: db.migratorUrl.replace(
      /^postgres:\/\//,
      "postgresql://",
    ),
    ...extra,
  });

export function launchReentry(
  environment: Record<string, string>,
  spec?: Record<string, string>,
  args: string[] = [],
): ReentryChild {
  const path = fileURLToPath(
    new URL(
      spec ? "./fixture-reentry-child.ts" : "../../src/cli/fixture-reentry.ts",
      import.meta.url,
    ),
  );
  const started = Date.now();
  const proc = spawn(
    process.execPath,
    ["--import", "tsx", path, ...(spec ? [JSON.stringify(spec)] : args)],
    {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      env: environment,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  let stdout = "";
  let stderr = "";
  let heldResolve!: () => void;
  let heldReject!: (error: Error) => void;
  const held = new Promise<void>((resolve, reject) => {
    heldResolve = resolve;
    heldReject = reject;
  });
  held.catch(() => undefined);
  proc.stdout.on("data", (data: Buffer) => {
    stdout += data.toString();
    if (stdout.includes('"test_hold":true')) heldResolve();
  });
  proc.stderr.on("data", (data: Buffer) => {
    stderr += data.toString();
  });
  const timer = setTimeout(() => {
    heldReject(new Error("child deadline"));
    proc.kill("SIGKILL");
  }, 45000);
  const exited = new Promise<EntryRun>((resolve, reject) => {
    proc.once("error", (error) => {
      clearTimeout(timer);
      heldReject(error);
      reject(error);
    });
    proc.once("close", (code, signal) => {
      clearTimeout(timer);
      heldReject(new Error("child exited before hold"));
      resolve({
        code,
        signal,
        stdout,
        stderr,
        ms: Date.now() - started,
        timedOut: signal === "SIGKILL",
      });
    });
  });
  const boundedHeld = bounded(held, 30000, "fixture child hold");
  boundedHeld.catch(() => undefined);
  return {
    proc,
    held: boundedHeld,
    exited,
    kill: async () => {
      if (proc.exitCode === null && proc.signalCode === null)
        proc.kill("SIGKILL");
      return bounded(exited, 10000, "fixture child exit");
    },
  };
}

export async function runReentry(
  environment: Record<string, string>,
  spec?: Record<string, string>,
  args: string[] = [],
): Promise<EntryRun> {
  const child = launchReentry(environment, spec, args);
  try {
    return await bounded(child.exited, 30000, "fixture entry");
  } finally {
    await child.kill();
  }
}
