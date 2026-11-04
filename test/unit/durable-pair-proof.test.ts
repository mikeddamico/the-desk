/** Actual proposed CLI, isolated runtime; no live writer, credential or network use. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as promises from "node:fs/promises";
const calls = vi.hoisted(() => ({
  store: vi.fn(),
  read: vi.fn(),
  reconcile: vi.fn(),
}));
vi.mock("../../src/runtime/durable-pair.js", () => ({
  storeDurableSyntheticPair: calls.store,
  readDurableSyntheticPair: calls.read,
  reconcileDurableSyntheticPair: calls.reconcile,
}));
vi.mock("node:fs", async (original) => {
  const actual = await original<typeof import("node:fs")>();
  return { ...actual, writeSync: vi.fn(actual.writeSync) };
});
vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof import("node:fs/promises")>();
  return {
    ...actual,
    lstat: vi.fn(() =>
      Promise.reject(
        Object.assign(new Error("test-owned missing directory"), {
          code: "ENOENT",
        }),
      ),
    ),
  };
});
const originalArgv = [...process.argv];
const originalExit = process.exitCode;
const originalDirectory = process.env.DESK_DURABLE_PAIR_DIAGNOSTICS_DIR;
let stdout: string[] = [];
let stderr: string[] = [];
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  stdout = [];
  stderr = [];
  process.exitCode = undefined;
  delete process.env.DESK_DURABLE_PAIR_DIAGNOSTICS_DIR;
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    stdout.push(String(chunk));
    return true;
  });
  vi.mocked(fs.writeSync).mockImplementation((fd: number, data: unknown) => {
    expect(fd).toBe(2);
    stderr.push(String(data));
    return Buffer.byteLength(String(data));
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  process.argv = originalArgv;
  process.exitCode = originalExit;
  if (originalDirectory === undefined)
    delete process.env.DESK_DURABLE_PAIR_DIAGNOSTICS_DIR;
  else process.env.DESK_DURABLE_PAIR_DIAGNOSTICS_DIR = originalDirectory;
});
const operation = "b6200001-0000-4000-8000-000000000001";
const timestamp = "2026-11-03T00:00:00.000000Z";
async function run(args: string[]): Promise<unknown> {
  process.argv = ["node", "durable-pair-proof.js", ...args];
  await import("../../src/tools/durable-pair-proof.js");
  expect(stdout).toHaveLength(1);
  const text = stdout[0];
  if (text === undefined) throw new Error("missing CLI output");
  const result: unknown = JSON.parse(text);
  return result;
}
it.each([["bogus"], ["write"], ["read", operation, "extra"], ["reconcile"]])(
  "preentry refusal %j",
  async (...args) => {
    const result = await run(args);
    expect(result).toMatchObject({
      status: "stopped",
      code: "invalid_invocation",
      phase: "invocation",
      operation_id: null,
      sql_outcome: "not_started",
      storage_outcome: "not_started",
      cleanup: "not_started",
    });
    expect(process.exitCode).toBe(1);
    expect(calls.store).not.toHaveBeenCalled();
    expect(calls.read).not.toHaveBeenCalled();
    expect(calls.reconcile).not.toHaveBeenCalled();
    expect(stderr).toEqual([]);
  },
);
it.each(["write", "read", "reconcile"])(
  "success preserves canonical output for %s",
  async (mode) => {
    const value = { status: "successful_result", z: 3, a: 1 };
    calls.store.mockResolvedValue(value);
    calls.read.mockResolvedValue(value);
    calls.reconcile.mockResolvedValue(value);
    expect(
      await run(
        mode === "write" ? [mode, operation, timestamp] : [mode, operation],
      ),
    ).toEqual(value);
    expect(stdout[0]).toBe('{"a":1,"status":"successful_result","z":3}\n');
    expect(process.exitCode).toBeUndefined();
    expect(stderr).toEqual([]);
  },
);
it("stopped result preserves failure exit and payload", async () => {
  const value = {
    status: "stopped",
    code: "storage_timeout",
    phase: "readback",
  };
  calls.store.mockResolvedValue(value);
  expect(await run(["write", operation, timestamp])).toEqual(value);
  expect(process.exitCode).toBe(1);
});
it("runtime throw preserves original postentry stop", async () => {
  calls.store.mockRejectedValue(new Error("SECRET_TOKEN"));
  expect(await run(["write", operation, timestamp])).toMatchObject({
    status: "stopped",
    code: "unexpected_failure",
    phase: "sql",
    operation_id: operation,
    cleanup: "pending",
    sql_outcome: "unknown",
  });
  expect(process.exitCode).toBe(1);
  expect(stdout.join("")).not.toContain("SECRET_TOKEN");
});
it("serialization failure preserves original postentry stop", async () => {
  const cyclic: Record<string, unknown> = { status: "success" };
  cyclic.self = cyclic;
  calls.read.mockResolvedValue(cyclic);
  expect(await run(["read", operation])).toMatchObject({
    code: "unexpected_failure",
    phase: "readback",
    operation_id: operation,
  });
  expect(process.exitCode).toBe(1);
});
it.each([false, true])(
  "sink failure preserves stopped output; report failure=%s",
  async (reportFails) => {
    process.env.DESK_DURABLE_PAIR_DIAGNOSTICS_DIR =
      "/test-owned-missing-diagnostic-directory";
    if (reportFails)
      vi.mocked(fs.writeSync).mockImplementation(() => {
        throw new Error("EPIPE SECRET_TOKEN");
      });
    const value = { status: "stopped", code: "storage_timeout" };
    calls.store.mockResolvedValue(value);
    expect(await run(["write", operation, timestamp])).toEqual(value);
    expect(process.exitCode).toBe(1);
    expect(promises.lstat).toHaveBeenCalled();
    if (!reportFails)
      expect(stderr).toEqual([
        '{"profile":"durable-pair-diagnostics-persistence/1","status":"failed"}\n',
      ]);
    expect(stdout.join("")).not.toContain("SECRET_TOKEN");
  },
);
it("sink and report failure cannot turn success into failure", async () => {
  process.env.DESK_DURABLE_PAIR_DIAGNOSTICS_DIR =
    "/test-owned-missing-diagnostic-directory";
  vi.mocked(fs.writeSync).mockImplementation(() => {
    throw new Error("EPIPE");
  });
  calls.store.mockResolvedValue({ status: "success" });
  expect(await run(["write", operation, timestamp])).toEqual({
    status: "success",
  });
  expect(process.exitCode).toBeUndefined();
});
