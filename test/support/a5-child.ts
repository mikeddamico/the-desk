// Crash-harness child: runs ONE A5.1 command with a named fault point. At that point it HOLDS (never returns) so the parent can
// observe the database fact and SIGKILL it; a normal completion of the command is reported as a failure of the scenario.
import pg from "pg";

import { appendClaimStateEvent } from "../../src/runtime/claim-events.js";
import { faultHooks } from "../../src/runtime/command.js";
import { runEvidenceSlice } from "../../src/runtime/slice.js";
import { sliceInput } from "./a5-fixture.js";

interface Spec {
  url: string;
  tag: string;
  fault: string;
  scenario: "claim" | "slice";
  event?: Parameters<typeof appendClaimStateEvent>[1];
  attemptIndex?: number;
}
const spec = JSON.parse(process.argv[2] ?? "{}") as Spec;
const pool = new pg.Pool({
  connectionString: spec.url,
  options: "-c role=desk_runtime",
  max: 2,
  application_name: `a5child_${spec.tag}`,
});
faultHooks.at = async (point) => {
  if (point === spec.fault) {
    process.stdout.write(`HELD ${point}\n`);
    await new Promise<never>(() => undefined); // held until killed
  }
};
const result =
  spec.scenario === "claim" && spec.event
    ? await appendClaimStateEvent(pool, spec.event)
    : await runEvidenceSlice(pool, sliceInput(spec.attemptIndex ?? 0));
process.stdout.write(`COMPLETED_WITHOUT_FAULT ${JSON.stringify(result)}\n`);
await pool.end();
