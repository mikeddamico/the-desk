/** Six real frozen semantic projections; no fixture ROOT or program/provider/SQL effect. */
import assert from "node:assert/strict";
import { loadFingerprintVectors } from "../../src/fixture/loader.js";
import {
  fingerprint,
  stageDomains,
  type StageName,
} from "../../src/identity/fingerprints.js";

assert.equal(process.argv.length, 2);
assert.equal(process.version, "v24.21.0");
assert.ok(["/tmp/d", "/tmp/e"].includes(process.cwd()));
assert.equal(process.env.NODE_PATH, undefined);
const vectors = loadFingerprintVectors();
assert.deepEqual(Object.keys(vectors).sort(), Object.keys(stageDomains).sort());
const fingerprints: Record<string, string> = {};
for (const [stage, row] of Object.entries(vectors)) {
  assert.equal(row.domain, stageDomains[stage as StageName]);
  const actual = fingerprint(stage as StageName, row.input_projection);
  assert.equal(actual, row.fingerprint);
  assert.throws(() =>
    fingerprint(stage as StageName, {
      ...row.input_projection,
      execution_provenance: {
        profile:
          process.cwd() === "/tmp/d"
            ? "desk-full-build/1"
            : "desk-evaluation-runtime/1",
      },
    }),
  );
  fingerprints[stage] = actual;
}
process.stdout.write(
  JSON.stringify({
    schema: "ci-semantic-identity-witness/1",
    role: process.cwd() === "/tmp/d" ? "build" : "evaluation",
    fingerprints,
    compared_to_frozen_vectors: true,
    extra_provenance_field_refused: true,
    admission: false,
  }) + "\n",
);
