// Test-only access to the PREDECESSOR Fixture v0.4.3 (pinned) for the "predecessor stability" assertion in
// a1-dependency-chain. The production loader targets v0.4.6 only and carries no legacy constants.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

const zipPath = resolve(
  "Lock/04_IMPLEMENTATION/The_Desk_Walking_Skeleton_Fixture_v0.4.3.zip",
);
const PIN = "f316992b5bd666b56ab3787714aa4d6e177309965e0037d8bb36357f0b27e30e";
if (createHash("sha256").update(readFileSync(zipPath)).digest("hex") !== PIN)
  throw new Error("Fixture v0.4.3 ZIP hash mismatch");

const file = z.object({
  fixture_version: z.literal("0.4.3"),
  fingerprints: z.record(
    z.string(),
    z.object({
      domain: z.string(),
      input_projection: z.record(z.string(), z.unknown()),
      expected_hash: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  ),
});

export function loadV043FingerprintVectors(): z.infer<typeof file> {
  const bytes = execFileSync("unzip", [
    "-p",
    zipPath,
    "gate_fingerprint_inputs.json",
  ]);
  return file.parse(JSON.parse(bytes.toString("utf8")));
}
