// Crash-harness child: runs ONE A5.1 command with a named fault point. At that point it HOLDS (never returns) so the parent can
// observe the database fact and SIGKILL it; a normal completion of the command is reported as a failure of the scenario.
// The fault seam in production code is inert unless DESK_TEST_FAULTS=1 and a hook is registered under the shared symbol (done here).
import pg from "pg";

import { appendClaimStateEvent } from "../../src/runtime/claim-events.js";
import { persistEvidenceUnit } from "../../src/runtime/evidence.js";
import { type AuthoredReservation } from "../../src/runtime/provider.js";
import { durableAdapter, finishSucceeded } from "./a5-provider.js";
import { fixtureUnits, sliceInput } from "./a5-fixture.js";
import { executeObserved, runSliceObserved } from "./a6-observed.js";

interface Spec {
  url: string;
  tag: string;
  fault: string;
  scenario: "claim" | "slice" | "unit" | "provider";
  event?: Parameters<typeof appendClaimStateEvent>[1];
  attemptIndex?: number;
  unitIndex?: number;
  /** provider scenario: the authored reservation and the owner URL of the durable test adapter (never the runtime role). */
  reservation?: AuthoredReservation;
  ownerUrl?: string;
  lookup?: boolean;
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
if (spec.scenario === "provider" && spec.reservation && spec.ownerUrl) {
  // The adapter's own connection shares the tag, so the harness waits for it to disappear as well.
  const owner = new pg.Pool({
    connectionString: spec.ownerUrl,
    max: 2,
    application_name: `a5child_${spec.tag}`,
  });
  result = await executeObserved(
    pool,
    spec.reservation,
    durableAdapter(owner, { lookup: spec.lookup ?? true }),
    finishSucceeded(spec.reservation.provider_call_id),
  );
  await owner.end();
} else if (spec.scenario === "claim" && spec.event)
  result = await appendClaimStateEvent(pool, spec.event);
else if (spec.scenario === "unit")
  result = await persistEvidenceUnit(
    pool,
    fixtureUnits()[spec.unitIndex ?? 0] as never,
  );
else result = await runSliceObserved(pool, sliceInput(spec.attemptIndex ?? 0));
process.stdout.write(`COMPLETED_WITHOUT_FAULT ${JSON.stringify(result)}\n`);
await pool.end();
