import pg from "pg";
import { executeProviderCall } from "../../src/runtime/provider.js";
import {
  durableAdapter,
  finishSucceeded,
  nonNetworkControls,
  type EffectResult,
} from "./a5-provider.js";
import { noopContext } from "./a6-observed.js";
import type { G1ChildSpec } from "./g1-provider-process.js";

let text = "";
for await (const piece of process.stdin) text += String(piece);
const spec = JSON.parse(text) as G1ChildSpec;
process.env.DESK_TEST_FAULTS = "1";
(globalThis as Record<symbol, unknown>)[
  Symbol.for("the-desk.a5.test-fault-hook")
] = async (point: string) => {
  if (point === spec.fault) {
    process.stdout.write("HELD\n");
    await new Promise<void>((resolve) => {
      process.once("message", () => {
        resolve();
      });
    });
  }
};
const pool = new pg.Pool({
  connectionString: spec.runtimeUrl,
  options: "-c role=desk_runtime",
  application_name: spec.tag,
  max: 2,
});
const owner = new pg.Pool({
  connectionString: spec.ownerUrl,
  application_name: spec.tag,
  max: 2,
});
let cleanup: Promise<void> | undefined;
function closeOwned(): Promise<void> {
  cleanup ??= Promise.all([owner.end(), pool.end()]).then(() => undefined);
  return cleanup;
}
const adapter = durableAdapter(owner, { lookup: true });
try {
  const result = await executeProviderCall(
    pool,
    spec.reservation,
    {
      async perform(request) {
        const value = await adapter.perform(request);
        if (!spec.neverReturn) return value;
        await closeOwned();
        if (process.connected) process.disconnect();
        return new Promise<EffectResult>(() => undefined);
      },
    },
    finishSucceeded(spec.reservation.provider_call_id),
    noopContext(),
    nonNetworkControls({ PROVIDER_CALL_TIMEOUT_MS: spec.timeoutMs ?? 30000 }),
  );
  process.stdout.write(`RESULT ${JSON.stringify(result)}\n`);
} catch {
  process.stdout.write("CHILD_FAILED\n");
  process.exitCode = 1;
} finally {
  // Test-owned watchdog handles arbitrary hung infrastructure; the execution API claims no pool shutdown bound.
  await closeOwned();
  if (process.connected) process.disconnect();
}
