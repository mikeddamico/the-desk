// Real child entry, bounded lifetime; no additional AI/CLI worker. Inputs contain only synthetic test identities.
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { within } from "./pg-wait.js";
export interface ChildResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  ms: number;
}
export interface ChildSpec {
  /** Test-only fixed SQL timestamp replacing the comparison clock; not a live server-clock claim. */
  clock?: string;
  hold?: string;
  throwAt?: string;
  patch?:
    | "end_fail"
    | "end_hang"
    | "flush_fail"
    | "flush_hang"
    | "late_pool_error"
    | "flush_window_first_error"
    | "release_fail";
}
export interface WaitChild {
  proc: ChildProcess;
  held: Promise<void>;
  exited: Promise<ChildResult>;
  release(): void;
  kill(): Promise<ChildResult>;
}
export function reviewEnv(
  runtime: string,
  operator?: string,
): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "",
    DESK_ENV: "test",
    DATABASE_URL: runtime.replace(/^postgres:/, "postgresql:"),
    ...(operator
      ? { OPERATOR_DATABASE_URL: operator.replace(/^postgres:/, "postgresql:") }
      : {}),
    DEPLOYED_COMMIT: "wait-test",
    LOG_LEVEL: "info",
  };
}
export function launchReview(
  mode: string,
  input: unknown,
  env: Record<string, string>,
  spec?: ChildSpec,
): WaitChild {
  const base = fileURLToPath(new URL("../../", import.meta.url));
  const target = fileURLToPath(
    new URL(
      spec ? "./review-wait-child.ts" : "../../src/cli/review-wait.ts",
      import.meta.url,
    ),
  );
  const proc = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      target,
      ...(spec ? [JSON.stringify(spec)] : []),
      mode,
      JSON.stringify(input),
    ],
    { cwd: base, env, stdio: ["pipe", "pipe", "pipe"] },
  );
  const start = Date.now();
  let stdout = "",
    stderr = "";
  let ready!: () => void;
  let refuse!: (e: Error) => void;
  const held = new Promise<void>((resolve, reject) => {
    ready = resolve;
    refuse = reject;
  });
  held.catch(() => undefined);
  proc.stdout.on("data", (data: Buffer) => {
    stdout += data.toString();
    if (stdout.includes('"test_hold":true')) ready();
  });
  proc.stderr.on("data", (data: Buffer) => {
    stderr += data.toString();
  });
  const timer = setTimeout(() => {
    refuse(new Error("child deadline"));
    proc.kill("SIGKILL");
  }, 30000);
  const exited = new Promise<ChildResult>((resolve, reject) => {
    proc.once("error", (e) => {
      clearTimeout(timer);
      refuse(e);
      reject(e);
    });
    proc.once("close", (code, signal) => {
      clearTimeout(timer);
      refuse(new Error("exit before hold"));
      resolve({ code, signal, stdout, stderr, ms: Date.now() - start });
    });
  });
  const boundedHeld = within(held, 20000, "review hold");
  boundedHeld.catch(() => undefined);
  return {
    proc,
    held: boundedHeld,
    exited,
    release: () => {
      proc.stdin.write("continue\n");
    },
    kill: async () => {
      if (proc.exitCode === null && proc.signalCode === null)
        proc.kill("SIGKILL");
      return within(exited, 10000, "review kill");
    },
  };
}
export async function runReview(
  mode: string,
  input: unknown,
  env: Record<string, string>,
  spec?: ChildSpec,
): Promise<ChildResult> {
  const c = launchReview(mode, input, env, spec);
  try {
    return await within(c.exited, 25000, "review command");
  } finally {
    await c.kill();
  }
}
