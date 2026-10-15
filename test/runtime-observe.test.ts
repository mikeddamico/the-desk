import { nonNetworkControls } from "./support/a5-provider.js";
// G3-prep: the command event projection, the single emission point in runCommand (scripted client, NOT real-PostgreSQL evidence),
// and the bounded noninterference contract. Real-PostgreSQL / real-pino proofs are in test/integration/a6-command-observability.test.ts.
import { EventEmitter } from "node:events";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

import pg from "pg";
import type { Pool } from "pg";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

import { commandObserver } from "../src/logging.js";
import {
  commandCleanupErrors,
  emitPreflight,
  runCommand,
  type Outcome,
} from "../src/runtime/command.js";
import {
  contextProblem,
  KNOWN_OUTCOME_CODES,
  projectEvent,
  readAttemptRun,
  safeEmit,
  type CommandEvent,
  type CommandTrace,
} from "../src/runtime/observe.js";
import {
  executeProviderCall,
  reconcileProviderCall,
} from "../src/runtime/provider.js";
import { runEvidenceSlice } from "../src/runtime/slice.js";

const U1 = "d1250007-0000-4000-8000-000000000011";
const HASH = "16c2b0ba472b17e10a395c3aa1800011a4997a26865021c5e75bd5361792da10";

// ---------------------------------------------------------------------------------------------------------------------------------
describe("projectEvent: a flat projection of validated values", () => {
  const base = {
    event: "command.completed",
    command: "evidence_unit.persist",
    stage: "standalone",
    correlation_id: randomUUID(),
    outcome: "created",
    duration_ms: 3.4,
  };

  it("certified reconcile reasons remain closed safe diagnostics; arbitrary canary reason is omitted", () => {
    for (const reason of [
      "provider_sim_receipt_invalid",
      "provider_sim_receipt_unattributed",
      "provider_sim_receipt_binding_invalid",
    ] as const) {
      const event = projectEvent({
        event: "workflow.completed",
        workflow: "provider_call.reconcile",
        stage: "standalone",
        correlation_id: randomUUID(),
        reconcile_reason: reason,
        detail: "RECONCILE_PROTECTED_CANARY",
        result: { body: "RECONCILE_PROTECTED_CANARY" },
      });
      expect(event.reconcile_reason).toBe(reason);
      expect(JSON.stringify(event)).not.toContain("CANARY");
    }
    expect(
      projectEvent({ ...base, reconcile_reason: "RECONCILE_PROTECTED_CANARY" }),
    ).not.toHaveProperty("reconcile_reason");
  });

  it("picks keys only: bodies, details, usage, messages and unknown keys never appear", () => {
    const e = projectEvent({
      ...base,
      canonical_content: "CANARY-BODY",
      event_payload: { secret: "CANARY-PAYLOAD" },
      usage: { tokens: 1 },
      detail: "differs in canonical_content CANARY-DETAIL",
      message: "INSERT INTO evidence_units CANARY-SQL",
      err: new Error("CANARY-ERR"),
      response_reference: "CANARY-REF",
    });
    const text = JSON.stringify(e);
    for (const c of ["CANARY", "INSERT INTO"]) expect(text).not.toContain(c);
    expect(Object.keys(e).sort()).toEqual(
      [
        "command",
        "correlation_id",
        "duration_ms",
        "event",
        "outcome",
        "stage",
      ].sort(),
    );
    expect(e.duration_ms).toBe(3);
  });

  it("validates every VALUE: invalid ids, hashes, keys, stages and enums are omitted, never echoed", () => {
    const e = projectEvent({
      ...base,
      stage: "not-a-stage with a secret",
      outcome: "boom",
      attempt_id: "not-a-uuid",
      evidence_unit_id: "x".repeat(500),
      claim_id: U1.toUpperCase(),
      package_hash: "abc",
      logical_request_key: "arbitrary text with a secret",
      error_class: "Error: body leaked in a name",
      connection: {
        phase: "commit",
        commit_outcome: "unknown",
        sqlstate: "42P01",
      },
      run_id_status: "whatever",
      correlation_id: "also not a uuid",
    });
    expect(e.stage).toBe("standalone");
    expect(e.outcome).toBe("error");
    for (const k of [
      "attempt_id",
      "evidence_unit_id",
      "claim_id",
      "package_hash",
      "logical_request_key",
      "error_class",
      "run_id_status",
    ])
      expect(e).not.toHaveProperty(k);
    expect(e.connection).toEqual({
      phase: "commit",
      commit_outcome: "unknown",
    }); // sqlstate other than 57P01 is dropped
    expect(e.correlation_id).toBe("invalid");
    expect(JSON.stringify(e)).not.toContain("secret");
    // valid values pass
    const ok = projectEvent({
      ...base,
      evidence_unit_id: U1,
      package_hash: HASH,
      logical_request_key: `v1:${HASH}:2`,
      connection: {
        phase: "rollback",
        commit_outcome: "not_attempted",
        sqlstate: "57P01",
      },
    });
    expect(ok).toMatchObject({
      evidence_unit_id: U1,
      package_hash: HASH,
      logical_request_key: `v1:${HASH}:2`,
    });
    expect(ok.connection).toEqual({
      phase: "rollback",
      commit_outcome: "not_attempted",
      sqlstate: "57P01",
    });
  });

  it("the projection is IDEMPOTENT (the logger adapter re-projects): omitted unknown values keep their *_known:false markers", () => {
    const first = projectEvent({
      ...base,
      provider: "sk-live-SECRET",
      operation: "do_secret_thing",
      code: "differs in body CANARY",
    });
    expect(first).toMatchObject({
      provider_known: false,
      operation_known: false,
      code_known: false,
    });
    expect(projectEvent(first as unknown as Record<string, unknown>)).toEqual(
      first,
    );
    const known = projectEvent({
      ...base,
      provider: "fixture_tts",
      operation: "tts",
      code: "rights",
    });
    expect(projectEvent(known as unknown as Record<string, unknown>)).toEqual(
      known,
    );
  });

  it("provider/operation are finite known allowlists: unknown values are omitted with known:false (a secret is never echoed)", () => {
    const unknown = projectEvent({
      ...base,
      provider: "sk-live-SECRET",
      operation: "do_secret_thing",
    });
    expect(unknown).not.toHaveProperty("provider");
    expect(unknown).not.toHaveProperty("operation");
    expect(unknown.provider_known).toBe(false);
    expect(unknown.operation_known).toBe(false);
    expect(JSON.stringify(unknown)).not.toContain("SECRET");
    const known = projectEvent({
      ...base,
      provider: "fixture_tts",
      operation: "tts",
    });
    expect(known).toMatchObject({
      provider: "fixture_tts",
      provider_known: true,
      operation: "tts",
      operation_known: true,
    });
  });

  it("codes: a known code passes, an unknown code is omitted with code_known:false", () => {
    expect(
      projectEvent({ ...base, code: "reservation_fields_differ" }),
    ).toMatchObject({
      code: "reservation_fields_differ",
      code_known: true,
    });
    const e = projectEvent({
      ...base,
      code: "differs in body CANARY; DROP TABLE x",
    });
    expect(e).not.toHaveProperty("code");
    expect(e.code_known).toBe(false);
    expect(JSON.stringify(e)).not.toContain("CANARY");
  });

  it("workflow events carry fixed counts only (no list), and no committed flag", () => {
    const e = projectEvent({
      event: "workflow.completed",
      workflow: "evidence_slice.run",
      stage: "S1_evidence_unit",
      correlation_id: randomUUID(),
      status: "stopped",
      complete: false,
      steps_total: 4,
      steps_created: 1,
      steps_converged: 2,
      steps_conflict: 1,
      stopped_step: "S3_binding",
      stopped_outcome: "conflict",
      stopped_code: "attempt_bound_to_other_package",
      steps: [{ subject: "CANARY" }],
      // TRANSACTION facts offered on a workflow event (malformed input): all must be dropped
      durability: "committed",
      connection: {
        phase: "commit",
        commit_outcome: "unknown",
        sqlstate: "57P01",
      },
      cleanup_failures: 2,
      duration_ms: 1,
    });
    expect(e).not.toHaveProperty("steps");
    expect(e).not.toHaveProperty("durability"); // a workflow has no single committed flag
    expect(e).not.toHaveProperty("connection");
    expect(e).not.toHaveProperty("cleanup_failures");
    expect(JSON.stringify(e)).not.toContain("CANARY");
    expect(e).toMatchObject({
      steps_total: 4,
      stopped_step: "S3_binding",
      stopped_code: "attempt_bound_to_other_package",
    });
  });

  it("never throws on adversarial input", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const weird: Record<string, unknown>[] = [
      {},
      {
        duration_ms: Symbol("x"),
        outcome: circular,
        stage: 5n,
        code: circular,
      },
      { duration_ms: NaN, run_id: {}, connection: "x", steps_total: -1 },
      { connection: null, provider: circular, operational_try_number: 1e308 },
    ];
    for (const raw of weird) expect(() => projectEvent(raw)).not.toThrow();
  });
});

describe("contextProblem and readAttemptRun", () => {
  it("validates a declared context at runtime (types alone are not enforcement)", () => {
    const ok = { correlationId: randomUUID(), observer: () => undefined };
    expect(contextProblem(ok)).toBeUndefined();
    expect(contextProblem(undefined)).toBe("context_missing");
    expect(contextProblem(null)).toBe("context_missing");
    expect(contextProblem({ ...ok, correlationId: "not-a-uuid" })).toBe(
      "correlation_id_invalid",
    );
    expect(
      contextProblem({ ...ok, correlationId: "external-request-id-123" }),
    ).toBe("correlation_id_invalid");
    expect(contextProblem({ correlationId: ok.correlationId })).toBe(
      "observer_missing",
    );
    expect(contextProblem({ ...ok, observer: "log" })).toBe("observer_missing");
  });

  it("derives the run id from the row, labels a missing attempt and a failed lookup truthfully, and never throws", async () => {
    const run = randomUUID();
    const attempt = randomUUID();
    const pool = (rows: unknown[] | Error) =>
      ({
        query: vi.fn(() =>
          rows instanceof Error
            ? Promise.reject(rows)
            : Promise.resolve({ rows }),
        ),
      }) as unknown as Pick<Pool, "query"> & {
        query: ReturnType<typeof vi.fn>;
      };
    expect(await readAttemptRun(pool([{ run_id: run }]), attempt)).toEqual({
      status: "derived",
      runId: run,
    });
    expect(await readAttemptRun(pool([]), attempt)).toEqual({
      status: "attempt_not_found",
    });
    expect(await readAttemptRun(pool(new Error("db down")), attempt)).toEqual({
      status: "lookup_failed",
    });
    const untouched = pool([]);
    expect(await readAttemptRun(untouched, "not-a-uuid")).toBeUndefined();
    expect(untouched.query).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
// SCRIPTED client (NOT real-PostgreSQL evidence): exact statement/event ordering for the durability truth table.
class FakeClient extends EventEmitter {
  readonly order: string[] = [];
  releaseArg: unknown = "not released";
  releaseThrows: Error | undefined;
  script = new Map<string, () => Promise<unknown>>();
  poolListener = (): void => undefined;
  query(text: string): Promise<{ rows: unknown[] }> {
    const word = text.split(" ")[0] ?? text;
    const step = this.script.get(text);
    const done = (): { rows: unknown[] } => {
      this.order.push(`${word} resolved`);
      return {
        rows: text.includes("transaction_isolation")
          ? [{ level: "read committed" }]
          : [],
      };
    };
    if (step) return step().then(done);
    return Promise.resolve(done());
  }
  release(arg?: unknown): void {
    this.on("error", this.poolListener);
    this.releaseArg = arg;
    this.order.push("release");
    if (this.releaseThrows) throw this.releaseThrows;
  }
}
const poolOf = (c: FakeClient): Pool =>
  ({ connect: () => Promise.resolve(c) }) as unknown as Pool;
const created: Outcome<number> = { kind: "created", record: 1 };
const fatal = (): Error =>
  Object.assign(
    new Error("terminating connection due to administrator command"),
    { name: "error", code: "57P01" },
  );
const transport = (): Error => new Error("Connection terminated unexpectedly");
/** A REAL parsed server ErrorResponse (pg.DatabaseError) with a SQLSTATE and the (localized) severity pg parses from field `S`. */
const serverError = (
  code: string,
  message = "server error",
  /** `null` means the severity is MISSING (a default parameter would swallow `undefined`). */
  severity: string | null = "ERROR",
): Error =>
  Object.assign(new pg.DatabaseError(message, 0, "error"), {
    code,
    severity: severity ?? undefined,
  });
/** A Node system error (ECONNRESET, EPIPE, ...): has a `code` string but is NOT a server answer. */
const systemError = (code: string): Error =>
  Object.assign(new Error(`write ${code}`), { code, syscall: "write" });

function traced(c?: FakeClient): {
  events: CommandEvent[];
  trace: CommandTrace;
} {
  const events: CommandEvent[] = [];
  return {
    events,
    trace: {
      context: {
        correlationId: randomUUID(),
        stage: "standalone",
        observer: (e) => {
          events.push(e);
          c?.order.push("observer");
        },
      },
      command: "evidence_unit.persist",
      subject: { evidence_unit_id: U1 },
    },
  };
}

describe("runCommand emits ONE truthful event per invocation (scripted client, not real-PostgreSQL evidence)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("created: committed, emitted AFTER the COMMIT acknowledgment and AFTER release", async () => {
    const c = new FakeClient();
    const { events, trace } = traced(c);
    const out = await runCommand(
      poolOf(c),
      () => Promise.resolve(created),
      trace,
    );
    expect(out).toEqual(created);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: "command.completed",
      command: "evidence_unit.persist",
      outcome: "created",
      durability: "committed",
      evidence_unit_id: U1,
    });
    expect(c.order.indexOf("observer")).toBeGreaterThan(
      c.order.indexOf("COMMIT resolved"),
    );
    expect(c.order.indexOf("observer")).toBeGreaterThan(
      c.order.indexOf("release"),
    );
  });

  it("converged is committed; conflict and rejected are not_committed (after the ROLLBACK acknowledgment) with a known code", async () => {
    const converged = traced();
    await runCommand(
      poolOf(new FakeClient()),
      () =>
        Promise.resolve({ kind: "converged", record: 1 } as Outcome<number>),
      converged.trace,
    );
    expect(converged.events[0]).toMatchObject({
      outcome: "converged",
      durability: "committed",
    });
    for (const kind of ["conflict", "rejected"] as const) {
      const c = new FakeClient();
      const t = traced(c);
      await runCommand(
        poolOf(c),
        () =>
          Promise.resolve(
            kind === "conflict"
              ? { kind, code: "rights", stored: null, detail: "CANARY-DETAIL" }
              : { kind, code: "rights", detail: "CANARY-DETAIL" },
          ),
        t.trace,
      );
      expect(t.events[0]).toMatchObject({
        outcome: kind,
        code: "rights",
        code_known: true,
        durability: "not_committed",
      });
      expect(JSON.stringify(t.events[0])).not.toContain("CANARY");
      expect(c.order.indexOf("observer")).toBeGreaterThan(
        c.order.indexOf("ROLLBACK resolved"),
      );
    }
  });

  it("a request refused before any transaction emits one not_committed event", () => {
    const t = traced();
    emitPreflight(t.trace, "invalid_uuid");
    expect(t.events).toHaveLength(1);
    expect(t.events[0]).toMatchObject({
      outcome: "rejected",
      code: "invalid_uuid",
      durability: "not_committed",
      duration_ms: 0,
    });
    emitPreflight(undefined, "invalid_uuid"); // no trace: nothing, no error
  });

  it("connection lost BEFORE COMMIT: error / not_committed / commit_outcome not_attempted (COMMIT never sent)", async () => {
    const c = new FakeClient();
    const t = traced(c);
    const err = await runCommand(
      poolOf(c),
      () => {
        c.emit("error", transport());
        return Promise.resolve(created);
      },
      t.trace,
    ).catch((e: unknown) => e);
    expect((err as Error).name).toBe("CommandConnectionError");
    expect(t.events[0]).toMatchObject({
      outcome: "error",
      durability: "not_committed",
      error_class: "CommandConnectionError",
      connection: { phase: "before_commit", commit_outcome: "not_attempted" },
    });
    expect(c.order).not.toContain("COMMIT resolved");
  });

  it("COMMIT sent and its acknowledgment lost: durability unknown, commit_outcome unknown (event and query-first 57P01 alike)", async () => {
    const viaEvent = new FakeClient();
    viaEvent.script.set("COMMIT", () => {
      viaEvent.emit("error", transport());
      return Promise.reject(transport());
    });
    const a = traced(viaEvent);
    await runCommand(
      poolOf(viaEvent),
      () => Promise.resolve(created),
      a.trace,
    ).catch(() => undefined);
    expect(a.events[0]).toMatchObject({
      durability: "unknown",
      connection: { phase: "commit", commit_outcome: "unknown" },
    });

    const queryFirst = new FakeClient();
    queryFirst.script.set("COMMIT", () => Promise.reject(fatal()));
    const b = traced(queryFirst);
    await runCommand(
      poolOf(queryFirst),
      () => Promise.resolve(created),
      b.trace,
    ).catch(() => undefined);
    expect(b.events[0]).toMatchObject({
      durability: "unknown",
      error_class: "CommandConnectionError",
      connection: {
        phase: "commit",
        commit_outcome: "unknown",
        sqlstate: "57P01",
      },
    });
  });

  it("a 57P01 on a statement, and on a ROLLBACK, is classified by phase and never commit-unknown", async () => {
    const stmt = new FakeClient();
    stmt.script.set("SELECT work", () => Promise.reject(fatal()));
    const a = traced(stmt);
    await runCommand(
      poolOf(stmt),
      (tx) => tx.query("SELECT work").then(() => created),
      a.trace,
    ).catch(() => undefined);
    expect(a.events[0]).toMatchObject({
      durability: "not_committed",
      connection: {
        phase: "before_commit",
        commit_outcome: "not_attempted",
        sqlstate: "57P01",
      },
    });
    const rb = new FakeClient();
    rb.script.set("ROLLBACK", () => Promise.reject(fatal()));
    const b = traced(rb);
    await runCommand(
      poolOf(rb),
      () =>
        Promise.resolve({
          kind: "rejected",
          code: "rights",
        } as Outcome<number>),
      b.trace,
    ).catch(() => undefined);
    expect(b.events[0]).toMatchObject({
      durability: "not_committed",
      connection: { phase: "rollback", commit_outcome: "not_attempted" },
    });
  });

  it("an ORDINARY server error at COMMIT is not_committed (the server answered); an unclassified transport error in the commit phase is unknown", async () => {
    const server = new FakeClient();
    server.script.set("COMMIT", () =>
      Promise.reject(serverError("23514", "deferred check CANARY")),
    );
    const a = traced(server);
    await runCommand(
      poolOf(server),
      () => Promise.resolve(created),
      a.trace,
    ).catch(() => undefined);
    expect(a.events[0]).toMatchObject({
      outcome: "error",
      durability: "not_committed",
      error_class: "unclassified",
    });
    expect(JSON.stringify(a.events[0])).not.toContain("CANARY");
    const lost = new FakeClient();
    lost.script.set("COMMIT", () => Promise.reject(transport())); // no SQLSTATE, no event yet: the answer was lost
    const b = traced(lost);
    await runCommand(
      poolOf(lost),
      () => Promise.resolve(created),
      b.trace,
    ).catch(() => undefined);
    expect(b.events[0]).toMatchObject({
      durability: "unknown",
      error_class: "unclassified",
    });
  });

  it("a loss recorded around an ACKNOWLEDGED COMMIT keeps committed and the result", async () => {
    const c = new FakeClient();
    c.script.set("COMMIT", () => {
      c.emit("error", transport());
      return Promise.resolve();
    });
    const t = traced(c);
    const out = await runCommand(
      poolOf(c),
      () => Promise.resolve(created),
      t.trace,
    );
    expect(out).toEqual(created);
    expect(t.events[0]).toMatchObject({
      outcome: "created",
      durability: "committed",
    });
    expect(t.events[0]).not.toHaveProperty("error_class");
  });

  it("success whose release throws: committed, the thrown cleanup error is reported by class and count only", async () => {
    const c = new FakeClient();
    c.releaseThrows = new Error("release failed CANARY");
    const t = traced(c);
    await expect(
      runCommand(poolOf(c), () => Promise.resolve(created), t.trace),
    ).rejects.toThrow("release failed");
    expect(t.events[0]).toMatchObject({
      outcome: "created",
      durability: "committed",
      error_class: "unclassified",
      cleanup_failures: 1,
    });
    expect(JSON.stringify(t.events[0])).not.toContain("CANARY");
  });

  it("a failed command with a secondary cleanup failure: first error class, count of cleanup failures, error identity untouched", async () => {
    const c = new FakeClient();
    const first = new Error("first CANARY");
    c.script.set("ROLLBACK", () =>
      Promise.reject(new Error("rollback also failed")),
    );
    const t = traced(c);
    const err = await runCommand(
      poolOf(c),
      () => Promise.reject(first),
      t.trace,
    ).catch((e: unknown) => e);
    expect(err).toBe(first);
    expect(commandCleanupErrors(err)).toHaveLength(1);
    expect(t.events[0]).toMatchObject({
      outcome: "error",
      durability: "not_committed",
      error_class: "unclassified",
      cleanup_failures: 1,
    });
    expect(JSON.stringify(t.events[0])).not.toContain("CANARY");
  });

  it("without a trace nothing is emitted and behavior is unchanged", async () => {
    const out = await runCommand(poolOf(new FakeClient()), () =>
      Promise.resolve(created),
    );
    expect(out).toEqual(created);
  });
});

describe("review regressions (scripted client, not real-PostgreSQL evidence)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  const quiet = (): string[] => {
    const out: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      out.push(String(chunk));
      return true;
    });
    return out;
  };

  it.each(["ECONNRESET", "EPIPE", "ETIMEDOUT"])(
    "COMMIT rejected with a Node system error %s (a `code` string, but NOT a server answer) stays unknown",
    async (code) => {
      const c = new FakeClient();
      c.script.set("COMMIT", () => Promise.reject(systemError(code)));
      const t = traced(c);
      await runCommand(
        poolOf(c),
        () => Promise.resolve(created),
        t.trace,
      ).catch(() => undefined);
      expect(t.events[0]).toMatchObject({
        durability: "unknown",
        error_class: "unclassified",
      });
    },
  );

  it.each([
    ["ERROR", "23514", "deferred constraint rejection"],
    ["ERROR", "40001", "serialization failure"],
  ])(
    "a real pg.DatabaseError severity %s SQLSTATE %s (%s) at COMMIT is a definite server rejection: not_committed",
    async (severity, code, label) => {
      const c = new FakeClient();
      c.script.set("COMMIT", () =>
        Promise.reject(serverError(code, label, severity)),
      );
      const t = traced(c);
      await runCommand(
        poolOf(c),
        () => Promise.resolve(created),
        t.trace,
      ).catch(() => undefined);
      expect(t.events[0]).toMatchObject({
        durability: "not_committed",
        error_class: "unclassified",
      });
    },
  );

  it.each([
    ["FATAL", "08006", "connection termination (class 08)"],
    ["FATAL", "57P02", "crash shutdown"],
    ["ERROR", "08006", "class 08 even with severity ERROR"],
    ["PANIC", "XX000", "PANIC"],
    [null, "23514", "missing severity"],
  ])(
    "severity %s SQLSTATE %s (%s) at COMMIT is NOT a definite rejection: unknown",
    async (severity, code, label) => {
      const c = new FakeClient();
      c.script.set("COMMIT", () =>
        Promise.reject(serverError(code, label, severity)),
      );
      const t = traced(c);
      await runCommand(
        poolOf(c),
        () => Promise.resolve(created),
        t.trace,
      ).catch(() => undefined);
      expect(t.events[0]).toMatchObject({ durability: "unknown" });
    },
  );

  it("a lookalike plain Error with a DatabaseError-like shape is not a server rejection: unknown", async () => {
    const c = new FakeClient();
    c.script.set("COMMIT", () =>
      Promise.reject(
        Object.assign(new Error("fake"), {
          name: "error",
          code: "40001",
          severity: "ERROR",
        }),
      ),
    );
    const t = traced(c);
    await runCommand(poolOf(c), () => Promise.resolve(created), t.trace).catch(
      () => undefined,
    );
    expect(t.events[0]?.durability).toBe("unknown");
  });

  it("a PRIMARY error whose `code` getter throws is rethrown unchanged: instrumentation can never replace it (the getter is reached only by instrumentation)", async () => {
    const stderr = quiet();
    const primary = Object.assign(
      new pg.DatabaseError("primary failure", 0, "error"),
      { severity: "ERROR" }, // so the server-rejection check proceeds to read `code`
    );
    Object.defineProperty(primary, "code", {
      get(): never {
        throw new Error("getter boom");
      },
    });
    const t = traced();
    const err = await runCommand(
      poolOf(new FakeClient()),
      () => Promise.reject(primary),
      t.trace,
    ).catch((e: unknown) => e);
    expect(err).toBe(primary);
    expect(t.events).toEqual([]); // the event was dropped inside the bounded path
    expect(stderr).toEqual(["command observer failed; event dropped\n"]);
  });

  it.each([
    ["observer getter", "observer"],
    ["correlationId getter", "correlationId"],
    ["runId getter", "runId"],
    ["stage getter", "stage"],
  ])(
    "a malformed trace context (%s throws) cannot change the result or the primary error",
    async (_label, prop) => {
      const stderr = quiet();
      const context = {
        correlationId: randomUUID(),
        stage: "standalone",
        observer: () => undefined,
      } as Record<string, unknown>;
      Object.defineProperty(context, prop, {
        get(): never {
          throw new Error(`${prop} boom`);
        },
        enumerable: true,
      });
      const trace = {
        context,
        command: "evidence_unit.persist",
        subject: {},
      } as unknown as CommandTrace;
      const out = await runCommand(
        poolOf(new FakeClient()),
        () => Promise.resolve(created),
        trace,
      );
      expect(out).toEqual(created);
      const first = new Error("first");
      const c = new FakeClient();
      c.script.set("ROLLBACK", () =>
        Promise.reject(new Error("rollback also failed")),
      );
      const err = await runCommand(
        poolOf(c),
        () => Promise.reject(first),
        trace,
      ).catch((e: unknown) => e);
      expect(err).toBe(first);
      expect(commandCleanupErrors(err)).toHaveLength(1);
      expect(stderr.length).toBe(2); // one fixed-text report per dropped event
    },
  );

  it("a malformed trace whose `context`, `subject` or `command` getter throws is contained too", async () => {
    const stderr = quiet();
    for (const prop of ["context", "subject", "command"]) {
      const trace = {
        context: {
          correlationId: randomUUID(),
          stage: "standalone",
          observer: () => undefined,
        },
        command: "evidence_unit.persist",
        subject: {},
      } as Record<string, unknown>;
      Object.defineProperty(trace, prop, {
        get(): never {
          throw new Error(`${prop} boom`);
        },
        enumerable: true,
      });
      const out = await runCommand(
        poolOf(new FakeClient()),
        () => Promise.resolve(created),
        trace as unknown as CommandTrace,
      );
      expect(out).toEqual(created);
    }
    expect(stderr.length).toBe(3);
  });

  it("the public logger adapter RE-PROJECTS: extra fields, invalid values and secrets in a type-cast event are not logged", () => {
    const logged: {
      level: string;
      obj: Record<string, unknown>;
      msg: unknown;
    }[] = [];
    const logger = {
      info: (obj: Record<string, unknown>, msg: unknown) =>
        logged.push({ level: "info", obj, msg }),
      warn: (obj: Record<string, unknown>, msg: unknown) =>
        logged.push({ level: "warn", obj, msg }),
      error: (obj: Record<string, unknown>, msg: unknown) =>
        logged.push({ level: "error", obj, msg }),
    } as unknown as Parameters<typeof commandObserver>[0];
    const hostile = {
      event: "command.completed",
      command: "evidence_unit.persist",
      stage: "standalone",
      correlation_id: randomUUID(),
      outcome: "created",
      durability: "committed",
      duration_ms: 2,
      canonical_content: "CANARY-BODY",
      message: "CANARY-MESSAGE",
      err: new Error("CANARY-ERR"),
      provider: "sk-live-CANARY",
      attempt_id: "not-a-uuid CANARY",
      error_class: "Error: CANARY name",
    } as unknown as CommandEvent;
    commandObserver(logger)(hostile);
    expect(logged).toHaveLength(1);
    const text = JSON.stringify(logged[0]);
    expect(text).not.toContain("CANARY");
    expect(logged[0]?.level).toBe("info");
    expect(logged[0]?.msg).toBe("command.completed");
    expect(Object.keys(logged[0]?.obj ?? {}).sort()).toEqual(
      [
        "command",
        "correlation_id",
        "duration_ms",
        "durability",
        "event",
        "outcome",
        "provider_known",
        "stage",
      ].sort(),
    );
  });

  it("the public adapter given a MALFORMED workflow event never logs a transaction durability/connection/cleanup fact, and the level is not driven by one", () => {
    const logged: { level: string; obj: Record<string, unknown> }[] = [];
    const logger = {
      info: (obj: Record<string, unknown>) =>
        logged.push({ level: "info", obj }),
      warn: (obj: Record<string, unknown>) =>
        logged.push({ level: "warn", obj }),
      error: (obj: Record<string, unknown>) =>
        logged.push({ level: "error", obj }),
    } as unknown as Parameters<typeof commandObserver>[0];
    const malformed = {
      event: "workflow.completed",
      workflow: "provider_call.execute",
      stage: "provider_execute",
      correlation_id: randomUUID(),
      status: "performed",
      reservation: "created",
      perform: "performed",
      outcome_record: "created",
      duration_ms: 3,
      // transaction facts that do not belong to a workflow (a falsely "committed" label, a lost-COMMIT detail, a cleanup count)
      durability: "committed",
      connection: {
        phase: "commit",
        commit_outcome: "unknown",
        sqlstate: "57P01",
      },
      cleanup_failures: 3,
    } as unknown as CommandEvent;
    commandObserver(logger)(malformed);
    expect(logged).toHaveLength(1);
    const obj = logged[0]?.obj ?? {};
    for (const k of ["durability", "connection", "cleanup_failures"])
      expect(obj).not.toHaveProperty(k);
    expect(obj).toMatchObject({
      workflow: "provider_call.execute",
      status: "performed",
      perform: "performed",
    });
    expect(logged[0]?.level).toBe("info"); // an input `durability: unknown` could otherwise have forced error level
    // and the same facts DO survive on a command event (command behavior preserved)
    commandObserver(logger)({
      ...(malformed as unknown as Record<string, unknown>),
      event: "command.completed",
      command: "provider_call.reserve",
      outcome: "created",
      durability: "unknown",
      connection: {
        phase: "commit",
        commit_outcome: "unknown",
        sqlstate: "57P01",
      },
      cleanup_failures: 3,
    } as unknown as CommandEvent);
    expect(logged[1]?.obj).toMatchObject({
      durability: "unknown",
      connection: {
        phase: "commit",
        commit_outcome: "unknown",
        sqlstate: "57P01",
      },
      cleanup_failures: 3,
    });
    expect(logged[1]?.level).toBe("error");
  });

  it("workflow entry points snapshot the declared context once: a throwing getter or malformed context is REFUSED before any database work (never thrown)", async () => {
    const never = {
      query: () => {
        throw new Error("must not query");
      },
      connect: () => {
        throw new Error("must not connect");
      },
    } as unknown as Pool;
    const getterContext = (prop: "correlationId" | "observer"): unknown => {
      const c = { correlationId: randomUUID(), observer: () => undefined };
      Object.defineProperty(c, prop, {
        get(): never {
          throw new Error(`${prop} boom`);
        },
      });
      return c;
    };
    for (const ctx of [
      getterContext("correlationId"),
      getterContext("observer"),
    ]) {
      const s = await runEvidenceSlice(
        never,
        { attemptId: randomUUID(), units: [], pkg: {} as never },
        ctx as never,
      );
      expect(s.stoppedAt).toMatchObject({
        outcome: "rejected",
        code: "observer_context_invalid",
      });
      const e = await executeProviderCall(
        never,
        {} as never,
        {} as never,
        (() => ({})) as never,
        ctx as never,
        nonNetworkControls(),
      );
      expect(e).toMatchObject({
        status: "rejected",
        result: { code: "observer_context_invalid" },
      });
      expect(
        await reconcileProviderCall(
          never,
          { providerCallId: randomUUID(), adapter: {} },
          ctx as never,
        ),
      ).toEqual({
        status: "unknown",
        reason: "observer_context_invalid",
      });
    }
    expect(contextProblem(getterContext("observer"))).toBe(
      "context_unreadable",
    );
  });
});

describe("bounded noninterference: result, error and cleanup errors never change (no claim about observer duration or sink delivery)", () => {
  let stderr: string[] = [];
  const spyStderr = (): void => {
    stderr = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderr.push(String(chunk));
      return true;
    });
  };
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const withObserver = (
    observer: (e: CommandEvent) => unknown,
  ): CommandTrace => ({
    context: { correlationId: randomUUID(), stage: "standalone", observer },
    command: "evidence_unit.persist",
    subject: {},
  });

  it("a synchronously throwing observer: the result is returned unchanged and one fixed-text report is written", async () => {
    spyStderr();
    const out = await runCommand(
      poolOf(new FakeClient()),
      () => Promise.resolve(created),
      withObserver(() => {
        throw new Error("observer boom CANARY");
      }),
    );
    expect(out).toEqual(created);
    expect(stderr).toEqual(["command observer failed; event dropped\n"]);
  });

  it("an async observer that REJECTS (assignable to a void-returning type) is contained: no unhandled rejection, result unchanged", async () => {
    spyStderr();
    const unhandled: unknown[] = [];
    const listener = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", listener);
    try {
      const out = await runCommand(
        poolOf(new FakeClient()),
        () => Promise.resolve(created),
        withObserver(async () => {
          await Promise.resolve();
          throw new Error("async boom");
        }),
      );
      expect(out).toEqual(created);
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      process.off("unhandledRejection", listener);
    }
    expect(unhandled).toEqual([]);
    expect(stderr).toEqual(["command observer failed; event dropped\n"]);
  });

  it("a failing reporter (stderr.write throws) cannot affect the command", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => {
      throw new Error("stderr closed");
    });
    const out = await runCommand(
      poolOf(new FakeClient()),
      () => Promise.resolve(created),
      withObserver(() => {
        throw new Error("observer boom");
      }),
    );
    expect(out).toEqual(created);
  });

  it("with a failing observer the primary error identity and its cleanup errors are unchanged", async () => {
    spyStderr();
    const c = new FakeClient();
    c.script.set("ROLLBACK", () =>
      Promise.reject(new Error("rollback also failed")),
    );
    const first = new Error("first");
    const err = await runCommand(
      poolOf(c),
      () => Promise.reject(first),
      withObserver(() => {
        throw new Error("observer boom");
      }),
    ).catch((e: unknown) => e);
    expect(err).toBe(first);
    expect(commandCleanupErrors(err)).toHaveLength(1);
  });

  it("safeEmit contains a failure while RESOLVING the observer or building the event (throwing getters/Proxies), and drops only the event", () => {
    spyStderr();
    const observer = vi.fn();
    safeEmit(() => {
      throw new Error("resolve boom");
    });
    safeEmit(() => ({
      observer,
      event: new Proxy(
        {},
        {
          get(): never {
            throw new Error("proxy boom");
          },
        },
      ),
    }));
    expect(observer).not.toHaveBeenCalled();
    expect(stderr).toEqual([
      "command observer failed; event dropped\n",
      "command observer failed; event dropped\n",
    ]);
  });
});

// ROOT72/74: private finite syntax recognition, supplementary to behavior proof.
// The TypeScript dependency boots normally; captured source text is never executed.
function unwrapScannerExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function scannerString(expression: ts.Expression): string | undefined {
  const current = unwrapScannerExpression(expression);
  return ts.isStringLiteral(current) ||
    ts.isNoSubstitutionTemplateLiteral(current)
    ? current.text
    : undefined;
}

function scannerPropertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name))
    return name.text;
  if (ts.isComputedPropertyName(name)) return scannerString(name.expression);
  return undefined;
}

function scannerCalleeName(expression: ts.Expression): string | undefined {
  const current = unwrapScannerExpression(expression);
  if (ts.isIdentifier(current)) return current.text;
  if (ts.isPropertyAccessExpression(current)) return current.name.text;
  if (ts.isElementAccessExpression(current))
    return scannerString(current.argumentExpression);
  return undefined;
}

function collectOutcomeCodeLiterals(sourceText: string): Set<string> {
  const fileName = "/SCANNER_INPUT.ts";
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2024,
    noEmit: true,
    noLib: true,
    noResolve: true,
    types: [],
  };
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2024,
    false,
    ts.ScriptKind.TS,
  );
  // Only the captured input is served. No ts.sys/default-host delegation.
  const host: ts.CompilerHost = {
    getSourceFile: (name) => (name === fileName ? sourceFile : undefined),
    getDefaultLibFileName: () => "/UNREAD_SCANNER_LIB.d.ts",
    writeFile: () => {
      throw new Error("Supplementary scanner unexpected emit");
    },
    getCurrentDirectory: () => "/",
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    fileExists: (name) => name === fileName,
    readFile: (name) => (name === fileName ? sourceText : undefined),
    directoryExists: () => false,
    getDirectories: () => [],
  };
  const program = ts.createProgram([fileName], options, host);
  if (program.getSyntacticDiagnostics(sourceFile).length !== 0)
    throw new Error("Supplementary scanner syntax failure");

  const collected = new Set<string>();
  const addLiteral = (expression: ts.Expression): void => {
    const value = scannerString(expression);
    // A whole nonempty ASCII word: unlike $, this rejects final LF/CR too.
    if (value !== undefined && value.length !== 0 && !/[^a-z0-9_]/.test(value))
      collected.add(value);
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      scannerPropertyName(node.name) === "code"
    ) {
      addLiteral(node.initializer);
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const name = scannerCalleeName(node.expression);
      if (
        name !== undefined &&
        (name.endsWith("Rejection") || name.endsWith("ClaimStateError"))
      ) {
        const first = node.arguments?.[0];
        if (first !== undefined) addLiteral(first);
      }
    }
    // Always traverse children, including non-applicable outer syntax.
    // The explicit void callback never returns a truthy early-stop value.
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return collected;
}

function missingOutcomeCodes(codes: ReadonlySet<string>): string[] {
  return [...codes].filter((code) => !KNOWN_OUTCOME_CODES.has(code)).sort();
}

describe("supplementary scanner: independent syntax and catalog canaries", () => {
  it("S1 retains genuine known and unknown literal positions and suffix calls", () => {
    const source = `
const a = {code: "rights", reason_code: "silent_usage_class"};
const b = {code: "scanner_unregistered_canary"};
new Rejection("scanner_rejection_canary", "not_first_argument");
ns.ClaimStateError("scanner_claim_canary");
new OtherRejection("scanner_suffix_canary");
`;
    const codes = collectOutcomeCodeLiterals(source);
    expect([...codes].sort()).toEqual([
      "rights",
      "scanner_claim_canary",
      "scanner_rejection_canary",
      "scanner_suffix_canary",
      "scanner_unregistered_canary",
    ]);
    expect(missingOutcomeCodes(codes)).toEqual([
      "scanner_claim_canary",
      "scanner_rejection_canary",
      "scanner_suffix_canary",
      "scanner_unregistered_canary",
    ]);
  });

  it("S2 distinguishes complete code names from all four suffix neighbors", () => {
    const source = `
const a = {reason_code:"silent_usage_class", reader_code:"outside_current_show_editorial_policy", parser_code:"audit_only_untrusted_fixture", stopped_code:"central_question"};
const b = {reason_code:"supporter_consequence", code:"scanner_unregistered_canary"};
`;
    const codes = collectOutcomeCodeLiterals(source);
    expect([...codes].sort()).toEqual(["scanner_unregistered_canary"]);
    expect(missingOutcomeCodes(codes)).toEqual(["scanner_unregistered_canary"]);
    const reasonsOnly = `
const a = {reason_code:"silent_usage_class"};
const b = {reason_code:"outside_current_show_editorial_policy"};
const c = {reason_code:"audit_only_untrusted_fixture"};
const d = {reason_code:"central_question"};
const e = {reason_code:"supporter_consequence"};
`;
    expect([...collectOutcomeCodeLiterals(reasonsOnly)]).toEqual([]);
  });

  it("S3 excludes annotations and documentary text but retains the same-value neighbor", () => {
    const nonApplicable = `
function check(code:"provenance_hash_mismatch" | "brief_hash_mismatch"):void {}
interface I {code:"provenance_hash_mismatch"}
type T = {code:"brief_hash_mismatch"};
class C {declare readonly code:"unexpected_failure";}
// code: "scanner_comment_canary"
/* new Rejection("scanner_comment_canary") */
const example = 'code: "scanner_string_canary" Rejection("scanner_string_canary")';
`;
    expect([...collectOutcomeCodeLiterals(nonApplicable)]).toEqual([]);
    const source =
      nonApplicable + 'const neighbor = {code:"provenance_hash_mismatch"};';
    const codes = collectOutcomeCodeLiterals(source);
    expect([...codes]).toEqual(["provenance_hash_mismatch"]);
    expect(missingOutcomeCodes(codes)).toEqual(["provenance_hash_mismatch"]);
  });

  it("S4 collects quoted, computed, template, wrapped and escaped property spellings", () => {
    const source = `
const a = {'code':'scanner_quote_canary', "code":\`scanner_template_canary\`};
const b = {["code"]:"scanner_computed_canary", [\`code\`]:"scanner_static_template_key_canary"};
const c = {[('code' as const)]:("scanner_wrapped_canary" as const) satisfies string};
const d = {co\\u0064e:"scanner_escaped_canary", "co\\u0064e":"scanner_escaped_canary"};
`;
    const codes = collectOutcomeCodeLiterals(source);
    expect([...codes].sort()).toEqual([
      "scanner_computed_canary",
      "scanner_escaped_canary",
      "scanner_quote_canary",
      "scanner_static_template_key_canary",
      "scanner_template_canary",
      "scanner_wrapped_canary",
    ]);
    expect(missingOutcomeCodes(codes)).toEqual([
      "scanner_computed_canary",
      "scanner_escaped_canary",
      "scanner_quote_canary",
      "scanner_static_template_key_canary",
      "scanner_template_canary",
      "scanner_wrapped_canary",
    ]);
    const escapedValue = 'const x = {code:"scanner_esc\\u0061ped_value"};';
    expect([...collectOutcomeCodeLiterals(escapedValue)]).toEqual([
      "scanner_escaped_value",
    ]);
  });

  it("S5 traverses nested applicable children and keeps static member call forms", () => {
    const source = `
new ns.Rejection(("scanner_new_canary" as const));
(ns["ClaimStateError"]!)("scanner_computed_call_canary");
Rejection("rights", {code:"scanner_nested_canary"});
Unrelated("scanner_unrelated_canary");
`;
    const codes = collectOutcomeCodeLiterals(source);
    expect([...codes].sort()).toEqual([
      "rights",
      "scanner_computed_call_canary",
      "scanner_nested_canary",
      "scanner_new_canary",
    ]);
    expect(missingOutcomeCodes(codes)).toEqual([
      "scanner_computed_call_canary",
      "scanner_nested_canary",
      "scanner_new_canary",
    ]);
  });

  it("S6 excludes dynamic values and rejects complete-word grammar violations", () => {
    const source = `
const a = {[dynamicName]:"scanner_dynamic_name_canary", code:dynamicValue};
const b = {code:\`scanner_\${dynamicValue}\`, reason_code:"scanner_reason_canary"};
const c = {code:"", code:"UPPER", code:"has-hyphen", code:"trailing_lf\\n"};
new Rejection(dynamicValue, "scanner_second_argument_canary");
`;
    const codes = collectOutcomeCodeLiterals(source);
    expect([...codes]).toEqual([]);
    expect(missingOutcomeCodes(codes)).toEqual([]);
    const otherInvalid = `
const a = {code:"trailing_cr\\r", code:"internal\\nlf", code:"non_ascii_é"};
const b = {code:"scanner_" + suffix, code:null, code:42};
ns[dynamicRejection]("scanner_dynamic_callee_canary");
ns["OtherRejection\\n"]("scanner_callee_final_lf_canary");
`;
    expect([...collectOutcomeCodeLiterals(otherInvalid)]).toEqual([]);
  });

  it("S7 throws a fixed syntax failure before collecting and recognizes the repair", () => {
    expect(() =>
      collectOutcomeCodeLiterals(
        'const broken = {code: "scanner_unregistered_canary";',
      ),
    ).toThrow(new Error("Supplementary scanner syntax failure"));
    const repaired = collectOutcomeCodeLiterals(
      'const broken = {code: "scanner_unregistered_canary"};',
    );
    expect([...repaired]).toEqual(["scanner_unregistered_canary"]);
    expect(missingOutcomeCodes(repaired)).toEqual([
      "scanner_unregistered_canary",
    ]);
  });

  it("S8 keeps private/optional terminals while external references stay inert", () => {
    const source = `
/// <reference path="/UNREAD_SCANNER_REFERENCE.ts" />
import {value} from "UNREAD_SCANNER_MODULE";
const a = {code:"scanner_unregistered_canary"};
class C { #Rejection = handler; m() { this.#Rejection("scanner_private_canary"); } }
ns?.Rejection?.("scanner_optional_canary");
`;
    const read = vi.spyOn(ts.sys, "readFile").mockImplementation(() => {
      throw new Error("Supplementary scanner unexpected system read");
    });
    const exists = vi.spyOn(ts.sys, "fileExists").mockImplementation(() => {
      throw new Error("Supplementary scanner unexpected system lookup");
    });
    const directory = vi
      .spyOn(ts.sys, "readDirectory")
      .mockImplementation(() => {
        throw new Error(
          "Supplementary scanner unexpected system directory read",
        );
      });
    const write = vi.spyOn(ts.sys, "writeFile").mockImplementation(() => {
      throw new Error("Supplementary scanner unexpected system write");
    });
    try {
      const codes = collectOutcomeCodeLiterals(source);
      expect([...codes].sort()).toEqual([
        "scanner_optional_canary",
        "scanner_private_canary",
        "scanner_unregistered_canary",
      ]);
      expect(missingOutcomeCodes(codes)).toEqual([
        "scanner_optional_canary",
        "scanner_private_canary",
        "scanner_unregistered_canary",
      ]);
      expect(read).not.toHaveBeenCalled();
      expect(exists).not.toHaveBeenCalled();
      expect(directory).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
    } finally {
      read.mockRestore();
      exists.mockRestore();
      directory.mockRestore();
      write.mockRestore();
    }
  });

  it("covers every declared value wrapper without executing a value", () => {
    const source = `
const a = {code:(("scanner_paren_canary"))};
const b = {code:("scanner_as_canary" as const)};
const c = {code:("scanner_satisfies_canary" satisfies string)};
const d = {code:(<string>"scanner_assertion_canary")};
const e = {code:("scanner_nonnull_canary"!)};
`;
    const codes = collectOutcomeCodeLiterals(source);
    expect([...codes].sort()).toEqual([
      "scanner_as_canary",
      "scanner_assertion_canary",
      "scanner_nonnull_canary",
      "scanner_paren_canary",
      "scanner_satisfies_canary",
    ]);
    expect(missingOutcomeCodes(codes)).toEqual([
      "scanner_as_canary",
      "scanner_assertion_canary",
      "scanner_nonnull_canary",
      "scanner_paren_canary",
      "scanner_satisfies_canary",
    ]);
  });

  it("covers every declared static-name and callee wrapper", () => {
    const source = `
const a = {[("code")]:"scanner_name_paren_canary"};
const b = {["code" as const]:"scanner_name_as_canary"};
const c = {["code" satisfies string]:"scanner_name_satisfies_canary"};
const d = {[(<string>"code")]:"scanner_name_assertion_canary"};
const e = {["code"!]:"scanner_name_nonnull_canary"};
(Rejection)("scanner_callee_paren_canary");
(Rejection as unknown)("scanner_callee_as_canary");
(Rejection satisfies unknown)("scanner_callee_satisfies_canary");
(<unknown>Rejection)("scanner_callee_assertion_canary");
(Rejection!)("scanner_callee_nonnull_canary");
ns[("Rejection" as const)]("scanner_member_as_canary");
ns[(<string>"ClaimStateError")]("scanner_member_assertion_canary");
ns["Rejection" satisfies string]("scanner_member_satisfies_canary");
ns["ClaimStateError"!]("scanner_member_nonnull_canary");
new OtherClaimStateError("scanner_suffix_claim_canary");
`;
    const codes = collectOutcomeCodeLiterals(source);
    expect([...codes].sort()).toEqual([
      "scanner_callee_as_canary",
      "scanner_callee_assertion_canary",
      "scanner_callee_nonnull_canary",
      "scanner_callee_paren_canary",
      "scanner_callee_satisfies_canary",
      "scanner_member_as_canary",
      "scanner_member_assertion_canary",
      "scanner_member_nonnull_canary",
      "scanner_member_satisfies_canary",
      "scanner_name_as_canary",
      "scanner_name_assertion_canary",
      "scanner_name_nonnull_canary",
      "scanner_name_paren_canary",
      "scanner_name_satisfies_canary",
      "scanner_suffix_claim_canary",
    ]);
    expect(missingOutcomeCodes(codes)).toEqual([
      "scanner_callee_as_canary",
      "scanner_callee_assertion_canary",
      "scanner_callee_nonnull_canary",
      "scanner_callee_paren_canary",
      "scanner_callee_satisfies_canary",
      "scanner_member_as_canary",
      "scanner_member_assertion_canary",
      "scanner_member_nonnull_canary",
      "scanner_member_satisfies_canary",
      "scanner_name_as_canary",
      "scanner_name_assertion_canary",
      "scanner_name_nonnull_canary",
      "scanner_name_paren_canary",
      "scanner_name_satisfies_canary",
      "scanner_suffix_claim_canary",
    ]);
  });

  it("keeps mixed nested unknown neighbors despite duplicates and irrelevant outers", () => {
    const source = `
Unrelated({code:"scanner_mixed_nested_canary"});
const a = {code:"rights", reason_code:"silent_usage_class"};
new OtherClaimStateError("scanner_mixed_suffix_canary", {code:"scanner_mixed_nested_canary"});
const b = {code:"scanner_unregistered_canary", code:"scanner_unregistered_canary"};
const c = {code:"scanner_mixed_neighbor_canary", example:'code: "scanner_string_canary"'};
`;
    const codes = collectOutcomeCodeLiterals(source);
    expect([...codes].sort()).toEqual([
      "rights",
      "scanner_mixed_neighbor_canary",
      "scanner_mixed_nested_canary",
      "scanner_mixed_suffix_canary",
      "scanner_unregistered_canary",
    ]);
    expect(missingOutcomeCodes(codes)).toEqual([
      "scanner_mixed_neighbor_canary",
      "scanner_mixed_nested_canary",
      "scanner_mixed_suffix_canary",
      "scanner_unregistered_canary",
    ]);
  });

  it("does not silently expand into class fields, local constants or assignments", () => {
    const source = `
class C { code = "scanner_class_field_canary"; m() { return {code:"scanner_method_neighbor_canary"}; } }
const code: string = "scanner_local_const_canary";
object.code = "scanner_assignment_canary";
`;
    const codes = collectOutcomeCodeLiterals(source);
    expect([...codes]).toEqual(["scanner_method_neighbor_canary"]);
    expect(missingOutcomeCodes(codes)).toEqual([
      "scanner_method_neighbor_canary",
    ]);
  });

  it("retains known collection through multiline and comment-separated syntax", () => {
    const source = `
const a = {
  code /* key */ : /* value */ "rights"
};
new /* class */ Rejection /* call */ (
  /* first */ "scanner_spacing_canary",
  "scanner_second_argument_canary"
);
`;
    const codes = collectOutcomeCodeLiterals(source);
    expect([...codes].sort()).toEqual(["rights", "scanner_spacing_canary"]);
    expect(missingOutcomeCodes(codes)).toEqual(["scanner_spacing_canary"]);
  });

  it("keeps documentary labels unknown and private payloads absent from projection", () => {
    const base = {
      event: "workflow.completed",
      workflow: "evidence_slice.run",
      stage: "S1_evidence_unit",
      correlation_id: U1,
      status: "stopped",
      stopped_step: "S3_binding",
      stopped_outcome: "conflict",
    };
    const known = projectEvent({
      ...base,
      code: "rights",
      stopped_code: "rights",
    });
    expect(known).toMatchObject({
      code: "rights",
      code_known: true,
      stopped_code: "rights",
    });
    for (const label of [
      "silent_usage_class",
      "outside_current_show_editorial_policy",
      "audit_only_untrusted_fixture",
      "central_question",
      "supporter_consequence",
    ]) {
      expect(KNOWN_OUTCOME_CODES.has(label)).toBe(false);
      const projected = projectEvent({
        ...base,
        code: label,
        stopped_code: label,
        message: "SCANNER_PROTECTED_CANARY",
        detail: "SCANNER_PROTECTED_CANARY",
        path: "SCANNER_PROTECTED_CANARY",
        payload: { body: "SCANNER_PROTECTED_CANARY" },
      });
      expect(projected).not.toHaveProperty("code");
      expect(projected.code_known).toBe(false);
      expect(projected).not.toHaveProperty("stopped_code");
      for (const field of ["message", "detail", "path", "payload"])
        expect(projected).not.toHaveProperty(field);
      expect(JSON.stringify(projected)).not.toContain(
        "SCANNER_PROTECTED_CANARY",
      );
    }
  });
});

describe("supplementary drift check (NOT the proof): syntax-scoped code literals in src/ are in the known set", () => {
  it("every collected object-code or suffix-named call/new literal is a member of KNOWN_OUTCOME_CODES", () => {
    const missing = new Set<string>();
    for (const dir of ["src/runtime", "src/knowledge"])
      for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
        const text = readFileSync(`${dir}/${f}`, "utf8");
        for (const code of collectOutcomeCodeLiterals(text)) {
          if (!KNOWN_OUTCOME_CODES.has(code)) missing.add(`${f}:${code}`);
        }
      }
    expect([...missing]).toEqual([]);
  });
});
