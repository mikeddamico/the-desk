// G2 child process: runs ONE runCommand on a pool that has NO error listeners of its own (nothing here masks the production
// behavior under test). The child HOLDS inside the command until PostgreSQL itself shows that its checked-out backend is gone
// (observed from a separate monitor session; bounded), then reports what the command did and whether the pool recovered.
// A client error event that is unhandled would crash this process (exit code != 0): that is the defect being tested.
import { setTimeout as sleep } from "node:timers/promises";

import pg from "pg";

import { runCommand } from "../../src/runtime/command.js";

interface Spec {
  url: string;
  ownerUrl: string;
  tag: string;
  scenario:
    | "next_statement"
    | "no_more_statements"
    | "post_commit"
    | "in_flight_statement"
    | "in_flight_statement_caught";
}
const spec = JSON.parse(process.argv[2] ?? "{}") as Spec;
const app = `g2cmd_${spec.tag}`;
const pool = new pg.Pool({
  connectionString: spec.url,
  options: "-c role=desk_runtime",
  max: 1,
  application_name: app,
});
const monitor = new pg.Client({
  connectionString: spec.ownerUrl,
  application_name: `g2mon_${spec.tag}`,
});
await monitor.connect();

/** HELD, then wait (bounded) for the DATABASE to report that the command's backend no longer exists. */
async function holdUntilBackendGone(point: string): Promise<void> {
  process.stdout.write(`HELD ${point}\n`);
  const deadline = Date.now() + 30000;
  for (;;) {
    const r = await monitor.query(
      "SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name = $1",
      [app],
    );
    if ((r.rows[0] as { n: number }).n === 0) return;
    if (Date.now() > deadline) throw new Error("backend never terminated");
    await sleep(25);
  }
}

if (spec.scenario === "post_commit") {
  process.env.DESK_TEST_FAULTS = "1";
  let held = false; // only the FIRST command commit holds; the recovery command must pass through
  (globalThis as Record<symbol, unknown>)[
    Symbol.for("the-desk.a5.test-fault-hook")
  ] = async (point: string): Promise<void> => {
    if (point === "after_commit_before_return" && !held) {
      held = true;
      await holdUntilBackendGone(point);
    }
  };
}

const marker = (step: string): string =>
  `INSERT INTO g2.marker (tag, step) VALUES ('${spec.tag}', '${step}')`;

let result: string;
try {
  const outcome = await runCommand(pool, async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(918273, 1)");
    await tx.query(marker("first"));
    if (
      spec.scenario === "next_statement" ||
      spec.scenario === "no_more_statements"
    )
      await holdUntilBackendGone("in_command");
    if (
      spec.scenario === "in_flight_statement" ||
      spec.scenario === "in_flight_statement_caught"
    ) {
      // A statement that is ACTIVE on the server when the parent terminates the backend: the server's FATAL (57P01) is delivered as the
      // rejection of THIS statement. The sleep is bounded (30 s) so a failed gate cannot hold a long operation.
      process.stdout.write("HELD in_flight\n");
      if (spec.scenario === "in_flight_statement_caught") {
        try {
          await tx.query("SELECT pg_sleep(30)");
        } catch {
          // the callback swallows the rejection and returns normally: runCommand must still refuse to report success
        }
      } else {
        await tx.query("SELECT pg_sleep(30)");
      }
    }
    if (spec.scenario === "next_statement") await tx.query(marker("second"));
    return { kind: "created", record: 1 } as const;
  });
  result = `OUTCOME ${outcome.kind}`;
} catch (error) {
  const e = error as {
    name?: string;
    phase?: string;
    commitOutcome?: string;
    cause?: { message?: string; code?: string };
  };
  result = `REJECTED ${String(e.name)} phase=${String(e.phase)} commitOutcome=${String(e.commitOutcome)} cause=${String(e.cause?.message)} causeCode=${String(e.cause?.code)}`;
}
process.stdout.write(`${result}\n`);

// the pool recovers on a NEW connection and a second command runs normally
const again = await runCommand(pool, async (tx) => {
  await tx.query(marker("after_recovery"));
  return { kind: "created", record: 2 } as const;
});
process.stdout.write(`RECOVERED ${again.kind}\n`);
await pool.end();
await monitor.end();
process.stdout.write("DONE\n");
