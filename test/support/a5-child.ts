// Crash-harness child: runs ONE A5.1 command with a named fault point. At that point it HOLDS (never returns) so the parent can
// observe the database fact and SIGKILL it; a normal completion of the command is reported as a failure of the scenario.
// The fault seam in production code is inert unless DESK_TEST_FAULTS=1 and a hook is registered under the shared symbol (done here).
import pg from "pg";

import { appendClaimStateEvent } from "../../src/runtime/claim-events.js";
import { persistEvidenceUnit } from "../../src/runtime/evidence.js";
import { runEvidenceSlice } from "../../src/runtime/slice.js";
import { fixtureUnits, sliceInput } from "./a5-fixture.js";

interface Spec {
  url: string;
  tag: string;
  fault: string;
  scenario: "claim" | "slice" | "unit";
  event?: Parameters<typeof appendClaimStateEvent>[1];
  attemptIndex?: number;
  unitIndex?: number;
}
const spec = JSON.parse(process.argv[2] ?? "{}") as Spec;
process.env.DESK_TEST_FAULTS = "1";
(globalThis as Record<symbol, unknown>)[
  Symbol.for("the-desk.a5.test-fault-hook")
] = async (point: string): Promise<void> => {
  if (point === spec.fault) {
    process.stdout.write(`HELD ${point}\n`);
    await new Promise<never>(() => undefined); // held until killed
  }
};
const pool = new pg.Pool({
  connectionString: spec.url,
  options: "-c role=desk_runtime",
  max: 2,
  application_name: `a5child_${spec.tag}`,
});
let result: unknown;
if (spec.scenario === "claim" && spec.event)
  result = await appendClaimStateEvent(pool, spec.event);
else if (spec.scenario === "unit")
  result = await persistEvidenceUnit(
    pool,
    fixtureUnits()[spec.unitIndex ?? 0] as never,
  );
else result = await runEvidenceSlice(pool, sliceInput(spec.attemptIndex ?? 0));
process.stdout.write(`COMPLETED_WITHOUT_FAULT ${JSON.stringify(result)}\n`);
await pool.end();
