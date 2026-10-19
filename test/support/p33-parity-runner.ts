// Fixed P33 transport and minimal child runner. No synchronous native call here.
import { createConnection } from "node:net";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export interface HarnessResult {
  protocol: 1;
  nonce: string;
  mode: "p33" | "complete" | "noncomplete";
  outcome: "COMPLETED" | "CONTAINED_REJECTION";
  reason: string;
  settled: true;
  noChildren: true;
  complete: true;
  reaped: { pid: number; raw: number; exit: number }[];
  controls: number[];
}
function valid(
  value: unknown,
  nonce: string,
  mode: HarnessResult["mode"],
): value is HarnessResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<HarnessResult>;
  return (
    v.protocol === 1 &&
    v.nonce === nonce &&
    v.mode === mode &&
    (v.outcome === "COMPLETED" || v.outcome === "CONTAINED_REJECTION") &&
    typeof v.reason === "string" &&
    v.settled === true &&
    v.noChildren === true &&
    v.complete === true &&
    Array.isArray(v.reaped) &&
    v.reaped.every(
      (r) =>
        Number.isSafeInteger(r.pid) &&
        Number.isSafeInteger(r.raw) &&
        Number.isInteger(r.exit),
    ) &&
    Array.isArray(v.controls) &&
    v.controls.every((p) => Number.isSafeInteger(p))
  );
}
async function request(mode: HarnessResult["mode"]): Promise<HarnessResult> {
  const path = process.env.DESK_P33_SOCKET,
    token = process.env.DESK_P33_TOKEN;
  if (!path || !token)
    throw Error("P33 prerequisite: use the guarded npm test command");
  const nonce = randomBytes(24).toString("hex");
  return new Promise((resolveResult, reject) => {
    const socket = createConnection(path);
    const chunks: Buffer[] = [];
    let size = 0,
      failed = false;
    const fail = (error: Error): void => {
      failed = true;
      socket.destroy();
      reject(error);
    };
    const timer = setTimeout(() => {
      fail(Error("P33 harness transport deadline"));
    }, 4000);
    socket.on("connect", () =>
      socket.write(JSON.stringify({ protocol: 1, mode, nonce, token }) + "\n"),
    );
    socket.on("data", (data: Buffer) => {
      size += data.length;
      if (size > 65536) fail(Error("P33 harness response bound"));
      else chunks.push(data);
    });
    socket.on("error", (error) => {
      clearTimeout(timer);
      fail(error);
    });
    socket.on("close", () => {
      clearTimeout(timer);
      if (failed) return;
      try {
        const value: unknown = JSON.parse(
          Buffer.concat(chunks).toString("utf8"),
        );
        if (!valid(value, nonce, mode))
          throw Error("P33 harness invalid or fatal response");
        resolveResult(value);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
}
export async function runP33(): Promise<void> {
  const result = await request("p33");
  if (result.outcome !== "COMPLETED")
    throw Error(`P33 harness rejection: ${result.reason}`);
}
export async function checkP33Harness(
  mode: "complete" | "noncomplete",
): Promise<HarnessResult> {
  if (process.env.DESK_P33_PROFILE !== "focused")
    throw Error("P33 controls require the focused guard profile");
  return request(mode);
}

async function childMain(): Promise<void> {
  const nonce = process.env.DESK_P33_NONCE,
    resultPath = process.env.DESK_P33_RESULT;
  if (!nonce || !resultPath) throw Error("Missing P33 child handshake");
  const { startVitest } = await import("vitest/node");
  const result = { finished: false };
  const ctx = await startVitest("test", [], {
    root: fileURLToPath(new URL("../../", import.meta.url)),
    config: false,
    watch: false,
    environment: "node",
    testTimeout: 5000,
    fileParallelism: false,
    include: ["test/support/p33-parity-child.case.ts"],
    reporters: [
      {
        onTestRunEnd(modules, errors, reason) {
          const tests = modules.flatMap((m) => [...m.children.allTests()]);
          result.finished =
            reason === "passed" &&
            errors.length === 0 &&
            modules.length === 1 &&
            modules.every((m) => m.ok()) &&
            tests.length === 1 &&
            tests[0]?.name === "P33 multidisk" &&
            tests[0].result().state === "passed";
        },
      },
    ],
  });
  await ctx.close();
  if (
    !result.finished ||
    (process.exitCode !== undefined && process.exitCode !== 0)
  )
    throw Error("P33 child/hooks/runner failed");
  const record = JSON.stringify({
    protocol: 1,
    nonce,
    case: "P33 multidisk",
    assertionsCompleted: true,
    hooksCompleted: true,
  });
  if (Buffer.byteLength(record) > 4096)
    throw Error("P33 completion record bound");
  writeFileSync(resultPath, record, { flag: "wx", mode: 0o600 });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv[2] !== "--p33-child" || process.argv.length !== 3)
    throw Error("Fixed child entrypoint only");
  await childMain();
}
