// G2 on real PostgreSQL 17: the checked-out backend is terminated by the DATABASE (pg_terminate_backend) while a command holds it.
// The child process has no error listener of its own, so an unhandled client error crashes it (exit != 0). Facts are observed in
// PostgreSQL (pg_stat_activity, pg_locks, the marker table); every wait is bounded; the child is always killed in `finally`.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runCommand } from "../../src/runtime/command.js";
import { TestCluster, type DbEnv } from "../support/db-env.js";
import { bounded, observe } from "../support/a5-crash.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const cluster = databaseUrl ? new TestCluster(databaseUrl) : undefined;
let env: DbEnv;
let ownerUrl = "";
const childPath = fileURLToPath(
  new URL("../support/g2-child.ts", import.meta.url),
);
if (cluster && databaseUrl) {
  beforeAll(async () => {
    await cluster.bootstrap();
    env = await cluster.create({ migrate: true });
    const url = new URL(databaseUrl);
    url.pathname = `/${env.name}`;
    ownerUrl = url.toString();
    await env.owner.query(`CREATE SCHEMA g2;
      CREATE TABLE g2.marker (id serial PRIMARY KEY, tag text NOT NULL, step text NOT NULL);
      GRANT USAGE ON SCHEMA g2 TO desk_runtime; GRANT INSERT, SELECT ON g2.marker TO desk_runtime;
      GRANT USAGE ON SEQUENCE g2.marker_id_seq TO desk_runtime;`);
  }, 180000);
  afterAll(async () => {
    await env.close();
    await cluster.shutdown();
    if (secondaryCleanupFailures.length > 0)
      throw new Error(
        `secondary cleanup failures: ${secondaryCleanupFailures.join(" | ")}`,
      );
  });
}

interface ChildResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
}
/** The child's raw exit record and merged stdout/stderr (an unhandled client error prints its trace here). */
const exitRecord = (out: ChildResult): string =>
  `child exit record: code=${String(out.code)} signal=${String(out.signal)}; stdout+stderr: ${out.stdout}`;
const rows = async (sql: string, values?: unknown[]) =>
  (await env.owner.query(sql, values)).rows as Record<string, unknown>[];
const backends = async (tag: string): Promise<number> =>
  (
    await rows(
      "SELECT pid FROM pg_stat_activity WHERE datname = $1 AND application_name LIKE $2",
      [env.name, `g2%_${tag}`],
    )
  ).length;

/** Secondary cleanup failures that could not be attached to a primary failure; checked in afterAll so none is ever lost. */
const secondaryCleanupFailures: string[] = [];

/**
 * Cleanup of ONE child: every step is ALWAYS attempted, in order, whatever an earlier step did; failures are collected and RETURNED
 * (this function never throws), so the caller decides what to surface only after all cleanup has run.
 *  1. SIGKILL the child if it is still running;
 *  2. terminate ONLY this child's command backend (its application_name): a statement still sleeping on the server (the in-flight
 *     scenarios) would otherwise outlive the killed child until its bounded sleep ends;
 *  3. wait (bounded) for the child process to be reaped;
 *  4. wait (bounded) until PostgreSQL shows none of the child's backends.
 */
async function cleanUpG2Child(
  proc: ReturnType<typeof spawn>,
  exited: Promise<ChildResult>,
  tag: string,
): Promise<Error[]> {
  const failures: Error[] = [];
  const step = async (what: string, run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (e) {
      failures.push(
        new Error(
          `cleanup step '${what}' failed: ${e instanceof Error ? e.message : String(e)}`,
          { cause: e },
        ),
      );
    }
  };
  await step("kill child", () => {
    if (proc.exitCode === null && proc.signalCode === null)
      proc.kill("SIGKILL");
    return Promise.resolve();
  });
  await step(`terminate g2cmd_${tag} backend`, () =>
    env.owner.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND application_name = $2",
      [env.name, `g2cmd_${tag}`],
    ),
  );
  await step("child reaped", () => bounded(exited, 10000, "child reaped"));
  await step(`child '${tag}' backends released`, () =>
    observe(
      async () => (await backends(tag)) === 0,
      `child '${tag}' backends released`,
      15000,
    ),
  );
  return failures;
}

/** Spawns the child, runs `whileHeld` once it reports HELD, always kills the child, returns its exit record. */
async function withG2Child(
  tag: string,
  scenario: string,
  whileHeld: () => Promise<void>,
): Promise<ChildResult> {
  const proc = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      childPath,
      JSON.stringify({ url: env.runtimeUrl, ownerUrl, tag, scenario }),
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let stdout = "";
  let markHeld!: () => void;
  const held = new Promise<void>((resolve) => {
    markHeld = resolve;
  });
  proc.stdout.on("data", (d: Buffer) => {
    stdout += d.toString();
    if (stdout.includes("HELD ")) markHeld();
  });
  proc.stderr.on("data", (d: Buffer) => {
    stdout += `[stderr] ${d.toString()}`;
  });
  const exited = new Promise<ChildResult>((resolve) => {
    proc.on("exit", (code, signal) => {
      resolve({ code, signal, stdout });
    });
  });
  let result: ChildResult | undefined;
  let primary: unknown;
  let failed = false;
  try {
    await bounded(
      Promise.race([
        held,
        exited.then(() =>
          Promise.reject(new Error(`child exited before holding: ${stdout}`)),
        ),
      ]),
      30000,
      "child HELD",
    );
    await whileHeld();
    result = await bounded(exited, 30000, "child exit after termination").catch(
      async (e: unknown) => {
        const activity = await rows(
          "SELECT application_name, state, wait_event FROM pg_stat_activity WHERE datname = $1",
          [env.name],
        );
        throw new Error(
          `${e instanceof Error ? e.message : String(e)} (activity: ${JSON.stringify(activity)}; child stdout: ${JSON.stringify(stdout)})`,
          { cause: e },
        );
      },
    );
  } catch (error) {
    failed = true;
    primary = error;
  }
  // All cleanup runs BEFORE anything is thrown (no throw from a finally, so reaping can never be skipped).
  const cleanup = await cleanUpG2Child(proc, exited, tag);
  if (failed) {
    // The primary failure is rethrown UNCHANGED (identity preserved, never mutated); cleanup failures are reported beside it.
    for (const f of cleanup) {
      secondaryCleanupFailures.push(`[${tag}] ${f.message}`);
      process.stderr.write(
        `[g2 secondary cleanup failure] [${tag}] ${f.message}\n`,
      );
    }
    throw primary as Error;
  }
  if (cleanup.length > 0)
    throw cleanup.length === 1
      ? must(cleanup[0])
      : new AggregateError(cleanup, `cleanup of child '${tag}' failed`);
  if (result === undefined) throw new Error("child produced no result");
  return result;
}

/** Terminates the command's checked-out backend, found by its application_name (an actual DB fact). */
const terminateCommandBackend = async (tag: string): Promise<void> => {
  await observe(
    async () =>
      (
        await rows(
          "SELECT 1 FROM pg_stat_activity WHERE datname = $1 AND application_name = $2 AND state = 'idle in transaction' AND backend_xid IS NOT NULL",
          [env.name, `g2cmd_${tag}`],
        )
      ).length === 1 ||
      (
        await rows(
          "SELECT 1 FROM pg_stat_activity WHERE datname = $1 AND application_name = $2",
          [env.name, `g2cmd_${tag}`],
        )
      ).length === 1,
    "command backend present",
    15000,
  );
  const r = await rows(
    "SELECT pg_terminate_backend(pid) AS ok FROM pg_stat_activity WHERE datname = $1 AND application_name = $2",
    [env.name, `g2cmd_${tag}`],
  );
  expect(r).toEqual([{ ok: true }]);
};
const advisoryHeld = async (): Promise<number> =>
  (
    await rows(
      "SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND classid = 918273 AND granted",
    )
  ).length;
const markers = async (tag: string): Promise<string[]> =>
  (
    await rows("SELECT step FROM g2.marker WHERE tag = $1 ORDER BY id", [tag])
  ).map((r) => r.step as string);

suite("G2 runCommand: a checked-out backend terminated by PostgreSQL", () => {
  it.each(["next_statement", "no_more_statements"])(
    "%s: the child survives, the command rejects as a connection failure with nothing committed, locks are gone and the pool recovers",
    async (scenario) => {
      const tag = `pre_${scenario}`;
      const out = await withG2Child(tag, scenario, async () => {
        // before termination the command really holds an open transaction and the advisory lock
        await observe(
          async () => (await advisoryHeld()) === 1,
          "command holds its advisory lock",
          15000,
        );
        expect(await markers(tag)).toEqual([]); // uncommitted rows are invisible
        await terminateCommandBackend(tag);
      });
      expect(out.signal, exitRecord(out)).toBeNull();
      expect(out.code, exitRecord(out)).toBe(0); // no unhandled client error took the process down
      // `next_statement` is always a pre-COMMIT failure. For `no_more_statements` the child's gate ("backend gone" seen from ANOTHER
      // session) does not tell whether the client has processed the server's FATAL before the command sends COMMIT, so exactly two
      // classifications are legitimate: lost before COMMIT was sent, or lost with COMMIT in flight. Never a raw error, never success.
      expect(out.stdout).toMatch(
        scenario === "no_more_statements"
          ? /REJECTED CommandConnectionError phase=(before_commit commitOutcome=not_attempted|commit commitOutcome=unknown) cause=.*terminat/
          : /REJECTED CommandConnectionError phase=before_commit commitOutcome=not_attempted cause=.*terminat/,
      );
      expect(out.stdout).not.toContain("OUTCOME"); // never a false success
      expect(out.stdout).toContain("RECOVERED created");
      expect(out.stdout).toContain("DONE");
      expect(await markers(tag)).toEqual(["after_recovery"]); // nothing from the failed command, one row from the recovered pool
      expect(await advisoryHeld()).toBe(0);
      expect(await backends(tag)).toBe(0);
    },
    120000,
  );

  it.each(["in_flight_statement", "in_flight_statement_caught"])(
    "%s: the backend is terminated while a statement is ACTIVE; the command rejects before COMMIT even if the callback swallowed the rejection",
    async (scenario) => {
      const tag = scenario;
      const out = await withG2Child(tag, scenario, async () => {
        // the parent's explicit gate: PostgreSQL must show THIS child's command backend actively running the bounded sleep
        await observe(
          async () =>
            (
              await rows(
                "SELECT 1 FROM pg_stat_activity WHERE datname = $1 AND application_name = $2 AND state = 'active' AND query LIKE '%pg_sleep(30)%'",
                [env.name, `g2cmd_${tag}`],
              )
            ).length === 1,
          "command backend is actively executing pg_sleep(30)",
          15000,
        );
        const r = await rows(
          "SELECT pg_terminate_backend(pid) AS ok FROM pg_stat_activity WHERE datname = $1 AND application_name = $2",
          [env.name, `g2cmd_${tag}`],
        );
        expect(r).toEqual([{ ok: true }]);
      });
      expect(out.signal, exitRecord(out)).toBeNull();
      expect(out.code, exitRecord(out)).toBe(0);
      expect(out.stdout, exitRecord(out)).toMatch(
        /REJECTED CommandConnectionError phase=before_commit commitOutcome=not_attempted cause=.*terminat/,
      );
      // the ORIGINAL cause is the server's FATAL, identified by its SQLSTATE (57P01 admin_shutdown), not merely a message
      expect(out.stdout, exitRecord(out)).toMatch(/ causeCode=57P01$/m);
      expect(out.stdout).not.toContain("OUTCOME"); // never a false success
      expect(out.stdout).toContain("RECOVERED created");
      expect(await markers(tag)).toEqual(["after_recovery"]); // the failed command committed nothing
      expect(await advisoryHeld()).toBe(0);
      expect(await backends(tag)).toBe(0);
    },
    120000,
  );

  it("post_commit: termination after COMMIT keeps the durable outcome, no replay and no duplicate side effect", async () => {
    const tag = "post_commit";
    const out = await withG2Child(tag, "post_commit", async () => {
      await observe(
        async () => (await markers(tag)).includes("first"),
        "COMMIT is durable",
        15000,
      );
      await terminateCommandBackend(tag);
    });
    expect(out.code, exitRecord(out)).toBe(0);
    expect(out.stdout).toContain("OUTCOME created"); // the committed outcome is not turned into a failure
    expect(out.stdout).toContain("RECOVERED created");
    expect(await markers(tag)).toEqual(["first", "after_recovery"]); // exactly one "first": never replayed
    expect(await advisoryHeld()).toBe(0);
  }, 120000);

  it("healthy reuse: the scoped listener does not accumulate on a real pooled client", async () => {
    const pool = new pg.Pool({
      connectionString: env.runtimeUrl,
      options: "-c role=desk_runtime",
      max: 1,
    });
    const seen: pg.PoolClient[] = [];
    pool.on("connect", (c) => seen.push(c));
    try {
      let baseline = -1;
      for (let i = 0; i < 25; i += 1) {
        await runCommand(pool, async (tx) => {
          await tx.query("SELECT 1");
          return { kind: "created", record: i } as const;
        });
        const c = seen[0];
        expect(seen).toHaveLength(1); // one physical connection reused
        if (baseline < 0) baseline = must(c).listenerCount("error");
        expect(must(c).listenerCount("error")).toBe(baseline);
      }
      expect(baseline).toBe(1); // only the pool's own idle listener while idle
    } finally {
      await bounded(pool.end(), 10000, "pool.end");
    }
  }, 60000);
});
const must = <T>(v: T | undefined): T => {
  if (v === undefined) throw new Error("missing");
  return v;
};
