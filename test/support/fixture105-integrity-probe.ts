/** Fixed one-shot script. Module loading is outside the measured synchronous release call. */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectConnectedFixture105ReleaseIntegrityCost } from "../../src/runtime/connected-fixture105.js";

let report: Readonly<Record<string, unknown>>;
try {
  if (
    process.argv.length !== 2 ||
    resolve(process.argv[1] ?? "") !== fileURLToPath(import.meta.url) ||
    process.version !== "v24.21.0" ||
    process.platform !== "linux"
  )
    throw new Error("fixed_integrity_entry_required");
  report = inspectConnectedFixture105ReleaseIntegrityCost();
} catch {
  // The original release error propagated through the entry; this CLI boundary emits no arbitrary error payload.
  report = {
    schema: "fixture105-integrity-cost/1",
    status: "incomplete",
    authority: "none",
    reason: "entry_refused",
  };
}
let line = "FIXTURE105_INTEGRITY_COST " + JSON.stringify(report) + "\n";
if (Buffer.byteLength(line) > 16384) {
  report = {
    schema: "fixture105-integrity-cost/1",
    status: "incomplete",
    authority: "none",
    reason: "output_bound",
  };
  line = "FIXTURE105_INTEGRITY_COST " + JSON.stringify(report) + "\n";
}
process.stdout.write(line);
process.exitCode = report.status === "measured" ? 0 : 1;
