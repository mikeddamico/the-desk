// Test support for the P1 process entry (src/cli/program-attempt.ts): runs it (or the test wrapper p1-child.ts) as a REAL child process
// with a bounded wait, and parses its stdout as pino JSON lines.
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const ENTRY = fileURLToPath(
  new URL("../../src/cli/program-attempt.ts", import.meta.url),
);
export const WRAPPER = fileURLToPath(new URL("./p1-child.ts", import.meta.url));

export interface EntryRun {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  ms: number;
  timedOut: boolean;
}
export interface WrapperSpec {
  /** Hold (never return) after the Nth acknowledged command COMMIT (existing fault seam). */
  holdOnCommit?: number;
  /** Inject a cleanup fault after the work: the logger flush or the pool shutdown fails or hangs. */
  patch?: "flush_fail" | "flush_hang" | "end_reject" | "end_hang";
}

export const entryEnv = (
  databaseUrl: string,
  extra: Record<string, string> = {},
): Record<string, string> => ({
  PATH: process.env.PATH ?? "",
  HOME: process.env.HOME ?? "",
  DESK_ENV: "test",
  // the entry's configuration schema accepts only the `postgresql:` scheme (the test cluster hands out `postgres:`)
  DATABASE_URL: databaseUrl.replace(/^postgres:\/\//, "postgresql://"),
  DEPLOYED_COMMIT: "p1-test",
  LOG_LEVEL: "info",
  ...extra,
});

function launch(
  args: string[],
  env: Record<string, string>,
  spec?: WrapperSpec,
): ChildProcess {
  const target = spec
    ? [WRAPPER, JSON.stringify(spec), ...args]
    : [ENTRY, ...args];
  return spawn(process.execPath, ["--import", "tsx", ...target], {
    cwd: REPO_ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Runs the entry to completion; a child that exceeds `timeoutMs` is SIGKILLed (only this child) and reported as timedOut. */
export function runEntry(
  args: string[],
  env: Record<string, string>,
  options: { spec?: WrapperSpec; timeoutMs?: number } = {},
): Promise<EntryRun> {
  const started = Date.now();
  const proc = launch(args, env, options.spec);
  let stdout = "";
  let stderr = "";
  proc.stdout?.on("data", (d: Buffer) => {
    stdout += d.toString();
  });
  proc.stderr?.on("data", (d: Buffer) => {
    stderr += d.toString();
  });
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, options.timeoutMs ?? 60000);
    proc.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    proc.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        code,
        signal,
        stdout,
        stderr,
        ms: Date.now() - started,
        timedOut,
      });
    });
  });
}

export interface HeldEntry {
  proc: ChildProcess;
  /** Resolves once the child printed HELD (it is parked after the Nth COMMIT); rejects on an early exit or after `holdTimeoutMs`. */
  held: Promise<void>;
  /** SIGKILLs the child and resolves with its exit record. */
  kill(): Promise<EntryRun>;
}

/** Starts the entry through the wrapper with `holdOnCommit`; the caller observes a database fact, then kills it. */
export function runEntryHeld(
  args: string[],
  env: Record<string, string>,
  holdOnCommit: number,
  holdTimeoutMs = 45000,
): HeldEntry {
  const started = Date.now();
  const proc = launch(args, env, { holdOnCommit });
  let stdout = "";
  let stderr = "";
  const exited = new Promise<EntryRun>((resolve) => {
    proc.on("close", (code, signal) => {
      resolve({
        code,
        signal,
        stdout,
        stderr,
        ms: Date.now() - started,
        timedOut: false,
      });
    });
  });
  const held = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `entry did not reach HELD within ${String(holdTimeoutMs)} ms`,
        ),
      );
    }, holdTimeoutMs);
    proc.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
      if (stdout.includes("HELD ")) {
        clearTimeout(timer);
        resolve();
      }
    });
    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    void exited.then((r) => {
      clearTimeout(timer);
      reject(
        new Error(
          `entry exited before HELD: code=${String(r.code)} stdout=${r.stdout} stderr=${r.stderr}`,
        ),
      );
    });
  });
  held.catch(() => undefined);
  return {
    proc,
    held,
    kill: async () => {
      proc.kill("SIGKILL");
      return exited;
    },
  };
}

/** Parses every non-empty stdout line as JSON (a non-JSON line fails the parse and therefore the test). */
export const jsonLines = (stdout: string): Record<string, unknown>[] =>
  stdout
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as Record<string, unknown>);
