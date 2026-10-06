import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bounded } from "./a5-crash.js";
import type { AuthoredReservation } from "../../src/runtime/provider.js";
import type { Invocation } from "../../src/runtime/provider-admission.js";

export interface G1ChildSpec {
  runtimeUrl: string;
  ownerUrl: string;
  reservation: AuthoredReservation;
  tag: string;
  fault?: string;
  neverReturn?: boolean;
  timeoutMs?: number;
  simulation?: {
    invocation: Invocation;
    holdAfterInvocation?: boolean;
    reconcile?: boolean;
  };
}

export function g1Child(spec: G1ChildSpec) {
  const child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      fileURLToPath(new URL("./g1-provider-child.ts", import.meta.url)),
    ],
    { stdio: ["pipe", "pipe", "pipe", "ipc"] },
  );
  if (!child.stdin || !child.stdout || !child.stderr)
    throw new Error("G1 child pipes unavailable");
  let stdout = "";
  let stderr = "";
  let heldResolve!: () => void;
  let heldReject!: (error: Error) => void;
  const held = new Promise<void>((resolve, reject) => {
    heldResolve = resolve;
    heldReject = reject;
  });
  held.catch(() => undefined);
  child.stdout.on("data", (data: Buffer) => {
    stdout += data.toString();
    if (stdout.includes("HELD")) heldResolve();
  });
  child.stderr.on("data", (data: Buffer) => {
    stderr += data.toString();
  });
  const exited = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    child.on("error", (error) => {
      heldReject(error);
      reject(error);
    });
    child.on("close", (code, signal) => {
      heldReject(new Error("child closed before hold"));
      resolve({ code, signal, stdout, stderr });
    });
  });
  const watchdog = setTimeout(() => {
    child.kill("SIGKILL");
  }, 30000);
  void exited.then(
    () => {
      clearTimeout(watchdog);
    },
    () => {
      clearTimeout(watchdog);
    },
  );
  child.stdin.end(JSON.stringify(spec));
  return {
    held: () => bounded(held, 20000, "G1 child hold"),
    exited: () => bounded(exited, 30000, "G1 child exit"),
    release: () => child.send("CONTINUE"),
    async kill() {
      child.kill("SIGKILL");
      return bounded(exited, 5000, "G1 child killed");
    },
  };
}
