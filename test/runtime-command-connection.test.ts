// runCommand checked-out-client error handling (G2) with a scripted pool/client: listener lifetime and ordering, first-diagnostic
// retention, no false success, COMMIT acknowledgment loss reported as `unknown` without replay, and unchanged server-error behavior.
import { EventEmitter } from "node:events";

import type { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";

import {
  CommandConnectionError,
  commandCleanupErrors,
  runCommand,
  type Outcome,
} from "../src/runtime/command.js";

class FakeClient extends EventEmitter {
  readonly log: string[] = [];
  /** every statement text, in order (the first-word `log` cannot tell ROLLBACK from ROLLBACK TO SAVEPOINT) */
  readonly statements: string[] = [];
  releaseArg: unknown = "not released";
  /** statement text -> action; default resolves with no rows */
  script = new Map<string, () => Promise<unknown>>();
  poolListener = (): void => undefined;
  query(text: string): Promise<{ rows: unknown[] }> {
    this.statements.push(text);
    this.log.push(text.split(" ")[0] ?? text);
    const step = this.script.get(text);
    if (step) return step().then(() => ({ rows: [] }));
    return Promise.resolve({
      rows: text.includes("transaction_isolation")
        ? [{ level: "read committed" }]
        : [],
    });
  }
  releaseThrows: Error | undefined;
  /** simulates a release that throws BEFORE the pool re-attaches its listener (double release / a non-pg-pool pool) */
  releaseThrowsEarly: Error | undefined;
  release(arg?: unknown): void {
    if (this.releaseThrowsEarly) throw this.releaseThrowsEarly;
    // pg-pool `_release`: re-attaches ITS listener first
    this.on("error", this.poolListener);
    this.releaseArg = arg;
    this.log.push("RELEASE");
    if (this.releaseThrows) throw this.releaseThrows;
  }
}
const poolOf = (client: FakeClient): Pool =>
  ({ connect: () => Promise.resolve(client) }) as unknown as Pool;
const created: Outcome<number> = { kind: "created", record: 1 };
const connectionFailure = (): Error =>
  new Error("Connection terminated unexpectedly");

describe("runCommand connection-error handling", () => {
  afterEach(() => {
    delete process.env.DESK_TEST_FAULTS;
    Reflect.deleteProperty(
      globalThis,
      Symbol.for("the-desk.a5.test-fault-hook"),
    );
  });

  it("attaches its listener right after checkout, removes it only after release, and leaves no listener behind on healthy reuse", async () => {
    const c = new FakeClient();
    let during = -1;
    for (let i = 0; i < 20; i += 1) {
      const baseline = c.listenerCount("error");
      const out = await runCommand(poolOf(c), () => {
        during = c.listenerCount("error");
        return Promise.resolve(created);
      });
      expect(out.kind).toBe("created");
      expect(c.listenerCount("error")).toBe(baseline + 1); // the fake pool's own listener re-added per release
      c.removeListener("error", c.poolListener); // the real pool removes it again at the next checkout
      expect(c.listenerCount("error")).toBe(baseline);
    }
    expect(during).toBe(1); // exactly the scoped listener while checked out
    expect(c.releaseArg).toBeUndefined(); // healthy client is returned, not destroyed
  });

  it("an error emitted mid-command rejects with the FIRST error as cause, never reports success, issues no COMMIT and destroys the client", async () => {
    const c = new FakeClient();
    const first = connectionFailure();
    const failure = runCommand(poolOf(c), () => {
      c.emit("error", first);
      c.emit("error", new Error("a later symptom"));
      return Promise.resolve(created); // fn swallows the symptom and returns normally: must NOT become a success
    });
    await expect(failure).rejects.toBeInstanceOf(CommandConnectionError);
    const error = (await failure.catch(
      (e: unknown) => e,
    )) as CommandConnectionError;
    expect(error.cause).toBe(first);
    expect(error.phase).toBe("before_commit");
    expect(error.commitOutcome).toBe("not_attempted");
    expect(c.log).not.toContain("COMMIT");
    expect(c.log).not.toContain("ROLLBACK"); // a dead connection is not asked to roll back
    expect(c.releaseArg).toBe(true);
    // the scoped listener is gone and the pool's listener took over (never a window with none)
    expect(c.listeners("error")).toEqual([c.poolListener]);
  });

  it("a statement failing after the connection error surfaces the connection failure, not the follow-on symptom", async () => {
    const c = new FakeClient();
    const first = connectionFailure();
    const err = (await runCommand(poolOf(c), async () => {
      c.emit("error", first);
      await Promise.reject(
        new Error(
          "Client has encountered a connection error and is not queryable",
        ),
      );
      return created;
    }).catch((e: unknown) => e)) as CommandConnectionError;
    expect(err).toBeInstanceOf(CommandConnectionError);
    expect(err.cause).toBe(first);
  });

  it("COMMIT whose acknowledgment is lost is reported as commit/unknown, is never replayed, and the client is destroyed", async () => {
    const c = new FakeClient();
    const first = connectionFailure();
    c.script.set("COMMIT", () => {
      c.emit("error", first);
      return Promise.reject(first);
    });
    const err = (await runCommand(poolOf(c), () =>
      Promise.resolve(created),
    ).catch((e: unknown) => e)) as CommandConnectionError;
    expect(err).toBeInstanceOf(CommandConnectionError);
    expect(err.phase).toBe("commit");
    expect(err.commitOutcome).toBe("unknown");
    expect(err.cause).toBe(first);
    expect(c.log.filter((l) => l === "COMMIT")).toHaveLength(1);
    expect(c.releaseArg).toBe(true);
  });

  it("a connection error AFTER a successful COMMIT keeps the durable outcome and only costs the connection", async () => {
    const c = new FakeClient();
    process.env.DESK_TEST_FAULTS = "1";
    (globalThis as Record<symbol, unknown>)[
      Symbol.for("the-desk.a5.test-fault-hook")
    ] = (point: string): Promise<void> => {
      if (point === "after_commit_before_return")
        c.emit("error", connectionFailure());
      return Promise.resolve();
    };
    const out = await runCommand(poolOf(c), () => Promise.resolve(created));
    expect(out).toEqual(created);
    expect(c.log.filter((l) => l === "COMMIT")).toHaveLength(1);
    expect(c.releaseArg).toBe(true);
  });

  it("a SERVER error at COMMIT (no connection error) is rethrown unchanged and still destroys the client (previous behavior)", async () => {
    const c = new FakeClient();
    const serverError = Object.assign(new Error("deferred check failed"), {
      code: "23514",
    });
    c.script.set("COMMIT", () => Promise.reject(serverError));
    await expect(
      runCommand(poolOf(c), () => Promise.resolve(created)),
    ).rejects.toBe(serverError);
    expect(c.releaseArg).toBe(true);
  });

  it("a returned rejected/conflict outcome still rolls back and releases the healthy client", async () => {
    const c = new FakeClient();
    const out = await runCommand(poolOf(c), () =>
      Promise.resolve({ kind: "rejected", code: "x" } as Outcome<number>),
    );
    expect(out.kind).toBe("rejected");
    expect(c.log).toContain("ROLLBACK");
    expect(c.releaseArg).toBeUndefined();
  });

  it("ROLLBACK acknowledgment lost on a non-committing outcome is phase=rollback / not_attempted: no COMMIT was ever sent", async () => {
    const c = new FakeClient();
    const first = connectionFailure();
    c.script.set("ROLLBACK", () => {
      c.emit("error", first);
      return Promise.reject(first);
    });
    const err = (await runCommand(poolOf(c), () =>
      Promise.resolve({
        kind: "conflict",
        code: "x",
        stored: null,
        detail: "",
      } as Outcome<number>),
    ).catch((e: unknown) => e)) as CommandConnectionError;
    expect(err).toBeInstanceOf(CommandConnectionError);
    expect(err.phase).toBe("rollback");
    expect(err.commitOutcome).toBe("not_attempted");
    expect(err.cause).toBe(first);
    expect(c.log).not.toContain("COMMIT");
    expect(c.log.filter((l) => l === "ROLLBACK")).toHaveLength(1); // not repeated by the cleanup
    expect(c.releaseArg).toBe(true);
    expect(c.listeners("error")).toEqual([c.poolListener]);
  });

  it("cleanup failures never replace the first error: they are attached as cleanupErrors", async () => {
    const c = new FakeClient();
    const first = new Error("first failure");
    c.script.set("ROLLBACK", () =>
      Promise.reject(new Error("rollback also failed")),
    );
    c.releaseThrows = new Error("release also failed");
    const err = (await runCommand(poolOf(c), () => Promise.reject(first)).catch(
      (e: unknown) => e,
    )) as Error;
    expect(err).toBe(first);
    expect(commandCleanupErrors(err).map((e) => (e as Error).message)).toEqual([
      "rollback also failed",
      "release also failed",
    ]);
    expect(c.releaseArg).toBe(true);
    expect(c.listeners("error")).toEqual([c.poolListener]); // listener removed even though release threw
  });

  it("a first CONNECTION failure stays the cause when later cleanup also fails", async () => {
    const c = new FakeClient();
    const first = connectionFailure();
    c.releaseThrows = new Error("release also failed");
    const err = (await runCommand(poolOf(c), () => {
      c.emit("error", first);
      return Promise.resolve(created);
    }).catch((e: unknown) => e)) as CommandConnectionError;
    expect(err.cause).toBe(first);
    expect(commandCleanupErrors(err).map((e) => (e as Error).message)).toEqual([
      "release also failed",
    ]);
  });

  it("on the success path a failing release is surfaced, not hidden", async () => {
    const c = new FakeClient();
    c.releaseThrows = new Error("release failed");
    await expect(
      runCommand(poolOf(c), () => Promise.resolve(created)),
    ).rejects.toThrow("release failed");
  });

  it("a FROZEN first error is rethrown untouched: recording cleanup failures cannot throw or mask it", async () => {
    const c = new FakeClient();
    const first = Object.freeze(new Error("frozen first failure"));
    c.script.set("ROLLBACK", () =>
      Promise.reject(new Error("rollback also failed")),
    );
    const err = await runCommand(poolOf(c), () => Promise.reject(first)).catch(
      (e: unknown) => e,
    );
    expect(err).toBe(first);
    expect(Object.isFrozen(err)).toBe(true);
    expect(commandCleanupErrors(err).map((e) => (e as Error).message)).toEqual([
      "rollback also failed",
    ]);
  });

  it("a NON-OBJECT first failure keeps its cleanup failures in an AggregateError (nothing swallowed)", async () => {
    const c = new FakeClient();
    c.script.set("ROLLBACK", () =>
      Promise.reject(new Error("rollback also failed")),
    );
    const nonError: unknown = "plain string failure"; // deliberately not an Error
    const err = (await runCommand(poolOf(c), () =>
      Promise.reject(nonError as Error),
    ).catch((e: unknown) => e)) as AggregateError;
    expect(err).toBeInstanceOf(AggregateError);
    expect(err.errors[0]).toBe("plain string failure");
    expect((err.errors[1] as Error).message).toBe("rollback also failed");
  });

  it("if release throws BEFORE the pool re-attached its listener, the scoped listener stays: no unhandled-error window", async () => {
    const c = new FakeClient();
    c.releaseThrowsEarly = new Error("release failed early");
    const err = (await runCommand(poolOf(c), () =>
      Promise.reject(new Error("first")),
    ).catch((e: unknown) => e)) as Error;
    expect(err.message).toBe("first");
    expect(
      commandCleanupErrors(err).map((e) => (e as Error).message),
    ).toContain("release failed early");
    expect(c.listenerCount("error")).toBe(1); // ours is the last-resort listener
    expect(() => c.emit("error", new Error("late client error"))).not.toThrow(); // an EventEmitter with no listener would throw
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
// SCRIPTED-CLIENT tests (NOT real-PostgreSQL evidence). They pin the exact ORDER that a real server cannot be made to produce
// deterministically for COMMIT: a termination FATAL (57P01) delivered as the in-flight query's rejection with NO client error event.
// [REGRESSION] = expected to FAIL on accepted main 85210d0 and pass with the repair; [CONTROL] = expected to pass on both.
describe("runCommand 57P01 delivered as a query rejection (scripted client, not real-PostgreSQL evidence)", () => {
  const shutdown = (): Error =>
    Object.assign(
      new Error("terminating connection due to administrator command"),
      { name: "error", code: "57P01", severity: "FATAL" },
    );
  const coded = (code: string, message = "server error"): Error =>
    Object.assign(new Error(message), { name: "error", code });
  const statements = (c: FakeClient): string[] => c.statements;
  const classified = async (
    c: FakeClient,
    fn: Parameters<typeof runCommand<number>>[1],
  ): Promise<CommandConnectionError> => {
    const e = await runCommand(poolOf(c), fn).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(CommandConnectionError);
    return e as CommandConnectionError;
  };

  it("[REGRESSION] COMMIT rejected with 57P01 and no event: commit/unknown, first cause retained, one COMMIT, no cleanup ROLLBACK, client destroyed", async () => {
    const c = new FakeClient();
    const fatal = shutdown();
    c.script.set("COMMIT", () => Promise.reject(fatal));
    const err = await classified(c, () => Promise.resolve(created));
    expect(err.phase).toBe("commit");
    expect(err.commitOutcome).toBe("unknown");
    expect(err.cause).toBe(fatal);
    expect(statements(c).filter((s) => s === "COMMIT")).toHaveLength(1);
    expect(statements(c).some((s) => s.startsWith("ROLLBACK"))).toBe(false);
    expect(c.releaseArg).toBe(true);
  });

  it("[REGRESSION] a statement rejected with 57P01: before_commit/not_attempted, no COMMIT and no cleanup ROLLBACK", async () => {
    const c = new FakeClient();
    const fatal = shutdown();
    c.script.set("SELECT work", () => Promise.reject(fatal));
    const err = await classified(c, (tx) =>
      tx.query("SELECT work").then(() => created),
    );
    expect(err.phase).toBe("before_commit");
    expect(err.commitOutcome).toBe("not_attempted");
    expect(err.cause).toBe(fatal);
    expect(statements(c)).not.toContain("COMMIT");
    expect(statements(c).some((s) => s.startsWith("ROLLBACK"))).toBe(false);
    expect(c.releaseArg).toBe(true);
  });

  it("[REGRESSION] CALLER CATCHES the 57P01 and returns success: still rejected before COMMIT, COMMIT never sent", async () => {
    const c = new FakeClient();
    const fatal = shutdown();
    c.script.set("SELECT work", () => Promise.reject(fatal));
    const err = await classified(c, async (tx) => {
      try {
        await tx.query("SELECT work");
      } catch {
        // swallowed: the callback reports success
      }
      return created;
    });
    expect(err.phase).toBe("before_commit");
    expect(err.commitOutcome).toBe("not_attempted");
    expect(err.cause).toBe(fatal);
    expect(statements(c)).not.toContain("COMMIT");
  });

  it("[REGRESSION] tx.attempt: a fatal statement is not masked by ROLLBACK TO SAVEPOINT", async () => {
    const c = new FakeClient();
    const fatal = shutdown();
    c.script.set("INSERT x", () => Promise.reject(fatal));
    const err = await classified(c, async (tx) => {
      await tx.attempt("INSERT x");
      return created;
    });
    expect(err.phase).toBe("before_commit");
    expect(err.cause).toBe(fatal);
    expect(
      statements(c).some((s) => s.startsWith("ROLLBACK TO SAVEPOINT")),
    ).toBe(false);
    expect(statements(c)).not.toContain("COMMIT");
    expect(c.releaseArg).toBe(true);
  });

  it("[REGRESSION] ROLLBACK of a non-committing outcome rejected with 57P01: rollback/not_attempted; BEGIN rejected: before_commit", async () => {
    const c = new FakeClient();
    const fatal = shutdown();
    c.script.set("ROLLBACK", () => Promise.reject(fatal));
    const err = await classified(c, () =>
      Promise.resolve({
        kind: "conflict",
        code: "x",
        stored: null,
        detail: "",
      } as Outcome<number>),
    );
    expect(err.phase).toBe("rollback");
    expect(err.commitOutcome).toBe("not_attempted");
    expect(err.cause).toBe(fatal);
    expect(statements(c)).not.toContain("COMMIT");
    const b = new FakeClient();
    const beginFatal = shutdown();
    b.script.set("BEGIN ISOLATION LEVEL READ COMMITTED", () =>
      Promise.reject(beginFatal),
    );
    const e2 = await classified(b, () => Promise.resolve(created));
    expect(e2.phase).toBe("before_commit");
    expect(e2.cause).toBe(beginFatal);
    expect(b.releaseArg).toBe(true);
  });

  it("[REGRESSION] cause retention, rejection first: a later transport event never replaces the 57P01 or its phase", async () => {
    const c = new FakeClient();
    const fatal = shutdown();
    c.script.set("SELECT work", () => Promise.reject(fatal));
    const err = await classified(c, async (tx) => {
      try {
        await tx.query("SELECT work");
      } finally {
        c.emit("error", new Error("Connection terminated unexpectedly")); // the transport event arrives AFTER the rejection
      }
      return created;
    });
    expect(err.cause).toBe(fatal);
    expect(err.phase).toBe("before_commit");
  });

  it("[CONTROL] cause retention, event first: a later 57P01 never replaces the first event or its phase", async () => {
    const c = new FakeClient();
    const transport = new Error("Connection terminated unexpectedly");
    c.script.set("SELECT work", () => Promise.reject(shutdown()));
    const err = await classified(c, async (tx) => {
      c.emit("error", transport);
      await tx.query("SELECT work");
      return created;
    });
    expect(err.cause).toBe(transport);
    expect(err.phase).toBe("before_commit");
  });

  it("[CONTROL] an ACKNOWLEDGED COMMIT keeps its outcome even if a loss was recorded during the commit phase", async () => {
    const c = new FakeClient();
    c.script.set("COMMIT", () => {
      c.emit("error", new Error("Connection terminated unexpectedly")); // recorded in the commit phase, before COMMIT's continuation
      return Promise.resolve();
    });
    const out = await runCommand(poolOf(c), () => Promise.resolve(created));
    expect(out).toEqual(created);
    expect(statements(c).filter((s) => s === "COMMIT")).toHaveLength(1);
    expect(c.releaseArg).toBe(true); // the connection is destroyed, the result is kept
  });

  it("[CONTROL] ordinary SQL errors are preserved: COMMIT 23514/40001 are rethrown as the same raw object; attempt 23505 still recovers via the savepoint", async () => {
    for (const code of ["23514", "40001"]) {
      const c = new FakeClient();
      const raw = coded(code);
      c.script.set("COMMIT", () => Promise.reject(raw));
      await expect(
        runCommand(poolOf(c), () => Promise.resolve(created)),
      ).rejects.toBe(raw);
    }
    const c = new FakeClient();
    const dup = coded("23505", "duplicate key");
    c.script.set("INSERT x", () => Promise.reject(dup));
    const out = await runCommand(poolOf(c), async (tx) => {
      const r = await tx.attempt("INSERT x");
      expect(r.ok).toBe(false);
      return created;
    });
    expect(out).toEqual(created);
    expect(
      statements(c).some((s) => s.startsWith("ROLLBACK TO SAVEPOINT")),
    ).toBe(true);
  });

  it.each(["57P02", "57P03", "57P04", "57P05", "57014", "08006"])(
    "[CONTROL] %s is NOT classified in this tranche (unchanged raw handling; unaddressed scope, not a claim that raw handling is correct or safe)",
    async (code) => {
      const c = new FakeClient();
      const raw = coded(code);
      c.script.set("COMMIT", () => Promise.reject(raw));
      await expect(
        runCommand(poolOf(c), () => Promise.resolve(created)),
      ).rejects.toBe(raw);
    },
  );

  it("[CONTROL] a cleanup failure stays secondary: an ordinary original error is kept even if the cleanup ROLLBACK is a 57P01", async () => {
    const c = new FakeClient();
    const original = new Error("ordinary failure");
    const fatal = shutdown();
    c.script.set("ROLLBACK", () => Promise.reject(fatal));
    const err = await runCommand(poolOf(c), () =>
      Promise.reject(original),
    ).catch((e: unknown) => e);
    expect(err).toBe(original);
    expect(commandCleanupErrors(err)).toEqual([fatal]);
    expect(c.releaseArg).toBe(true);
  });
});
