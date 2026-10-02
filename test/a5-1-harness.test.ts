// Crash-harness controls (no database): every wait is bounded and failures are reported clearly.
import { EventEmitter } from "node:events";

import type pg from "pg";
import { describe, expect, it } from "vitest";

import { awaitExit, observe, withChild } from "./support/a5-crash.js";

describe("A5.1 crash harness is bounded", () => {
  it("observe: a probe that never returns cannot defeat the advertised timeout", async () => {
    const t0 = Date.now();
    await expect(
      observe(() => new Promise<boolean>(() => undefined), "hung probe", 600),
    ).rejects.toThrow(/database fact not observed within 600 ms: hung probe/);
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it("observe: a false fact fails at the bound; a true fact returns", async () => {
    await expect(
      observe(() => Promise.resolve(false), "never", 300),
    ).rejects.toThrow(/not observed/);
    await observe(() => Promise.resolve(true), "immediately", 300);
  });

  it("awaitExit: a process that does not exit fails clearly within the bound", async () => {
    const fake = Object.assign(new EventEmitter(), {
      exitCode: null,
      signalCode: null,
      pid: 4242,
    });
    const t0 = Date.now();
    await expect(
      awaitExit(
        fake as unknown as Parameters<typeof awaitExit>[0],
        400,
        "fake child",
      ),
    ).rejects.toThrow(
      /fake child \(pid 4242\) exit did not complete within 400 ms.*did not exit/,
    );
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it("withChild: the original failure is retained with cleanup diagnostics when cleanup also fails (hung observer query)", async () => {
    const hungObserver = {
      query: () => new Promise<never>(() => undefined),
    } as unknown as pg.Pool;
    const t0 = Date.now();
    const error = await withChild(
      hungObserver,
      "no_such_database",
      {
        url: "postgresql://127.0.0.1:1/none",
        tag: "hh",
        fault: "never",
        scenario: "unit",
        unitIndex: 0,
      },
      () => Promise.resolve(),
      15000,
      1500,
    ).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    // the child could not reach its fault point (it fails to connect or completes): that ORIGINAL failure is first ...
    expect(message).toMatch(
      /child (exited before holding|completed without reaching|did not reach)|ECONNREFUSED|connect/i,
    );
    // ... and the cleanup failure (the observer query never returned) is reported as diagnostics, within the bounds
    expect(message).toContain("cleanup diagnostics");
    expect(message).toMatch(/backends released/);
    expect(Date.now() - t0).toBeLessThan(20000);
  }, 30000);
});
