import pg from "pg";
import {
  executeProviderCall,
  reconcileProviderCall,
  type SideEffectAdapter,
  type ProviderRequest,
} from "../../src/runtime/provider.js";
import {
  invocationHash,
  type FinalReceipt,
  type ReceiptPacket,
} from "../../src/runtime/provider-admission.js";
import { randomUUID } from "node:crypto";
import {
  SimulationEvidence,
  invocationObservation,
  receiptPacket,
} from "./g1-provider-admission-receipt.js";
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
const simulationEvidence = spec.simulation
  ? new SimulationEvidence(owner)
  : undefined;
const simulationAdapter: SideEffectAdapter<ReceiptPacket> = {
  async perform(request: ProviderRequest) {
    if (!simulationEvidence || !request.admission)
      throw new Error("test_simulation_missing");
    const io = invocationObservation(
      request.admission.certificate,
      request.admission.request,
    );
    await simulationEvidence.append(io);
    if (spec.simulation?.holdAfterInvocation) {
      process.stdout.write("HELD_INVOCATION\n");
      await new Promise<void>((resolve) => {
        process.once("message", () => {
          resolve();
        });
      });
    }
    const fr: FinalReceipt = {
      schema: "g1-sim-final-receipt/1",
      receipt_id: randomUUID(),
      kind: "final_accounting",
      invocation_observation_hash: invocationHash(io),
      attribution: io.attribution,
      consumption: io.consumption,
      work_ended: true,
      observed_output_bytes: 1,
      price_status: "known_final",
      event: {
        provider_call_id: request.provider_call_id,
        event_type: "succeeded",
        ended_at: "2026-10-06T00:00:01.000001Z",
        usage: { input_bytes: io.consumption.input_bytes, output_bytes: 1 },
        actual_cost: "0.02",
        currency: "USD",
        response_artifact_id: null,
        response_reference: null,
      },
    };
    await simulationEvidence.append(fr);
    return receiptPacket(io, fr);
  },
  async lookup(request: ProviderRequest) {
    if (!simulationEvidence) throw new Error("test_simulation_missing");
    const result = await simulationEvidence.retrieve(request.provider_call_id);
    return result
      ? {
          provider_call_id: request.provider_call_id,
          logical_request_key: request.logical_request_key,
          request_fingerprint: request.request_fingerprint,
          result,
        }
      : undefined;
  },
};
const unusedSimulationFinish = () => {
  throw new Error("UNUSED_CERTIFIED_FINISH_CANARY");
};
try {
  const result = spec.simulation
    ? spec.simulation.reconcile
      ? await reconcileProviderCall(
          pool,
          {
            providerCallId: spec.reservation.provider_call_id,
            adapter: simulationAdapter,
            finish: unusedSimulationFinish,
          },
          noopContext(),
        )
      : await executeProviderCall(
          pool,
          spec.reservation,
          simulationAdapter,
          unusedSimulationFinish,
          noopContext(),
          {
            ...nonNetworkControls({
              PROVIDER_CALL_TIMEOUT_MS: spec.timeoutMs ?? 30000,
            }),
            simulation_admission: spec.simulation.invocation,
          },
        )
    : await executeProviderCall(
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
        nonNetworkControls({
          PROVIDER_CALL_TIMEOUT_MS: spec.timeoutMs ?? 30000,
        }),
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
