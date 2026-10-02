// Production fixture loader (Fixture v0.4.6, FINAL LOCK v1.2.6). Replaces the v0.4.3 loader: every read goes through the
// pinned and verified pack (pack.ts). Row parsing, verification and persistence live in rows.ts / snapshot.ts / persist.ts.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { openFixturePack, type Pack } from "./pack.js";
import { parseFoundationRows, type FixtureRows } from "./rows.js";

let cached: Pack | undefined;
/** The verified pack, opened once per process (verification hashes every member). */
export function fixturePack(): Pack {
  cached ??= openFixturePack();
  return cached;
}

export function loadFixtureJson(member: string): unknown {
  return fixturePack().json(member);
}

export function loadFixtureBytes(member: string): Buffer {
  return fixturePack().member(member);
}

export function loadFoundationRows(): FixtureRows {
  return parseFoundationRows(fixturePack());
}

const fingerprintFile = z.record(
  z.string(),
  z.object({
    domain: z.string(),
    input_projection: z.record(z.string(), z.unknown()),
    fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  }),
);

/** The six shipped stage-fingerprint projections of Fixture v0.4.6 (`gate_fingerprint_inputs.json`). */
export function loadFingerprintVectors(): z.infer<typeof fingerprintFile> {
  return fingerprintFile.parse(loadFixtureJson("gate_fingerprint_inputs.json"));
}

const policyMap = z.object({
  policies: z.record(
    z.string(),
    z.object({
      source_path: z.string(),
      shipped_at: z.string(),
      source_sha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  ),
});

/** Every pinned policy source: the Lock file, the pack's shipped copy and the pinned hash must all agree. */
export async function verifyPolicySources(): Promise<void> {
  const manifest = policyMap.parse(
    loadFixtureJson("config/policy_versions.json"),
  );
  const lockRoot = fileURLToPath(new URL("../../Lock/", import.meta.url));
  for (const policy of Object.values(manifest.policies)) {
    const lockBytes = await readFile(`${lockRoot}${policy.source_path}`);
    const actual = createHash("sha256").update(lockBytes).digest("hex");
    if (actual !== policy.source_sha256)
      throw new Error(`Policy source identity mismatch: ${policy.source_path}`);
    if (!lockBytes.equals(loadFixtureBytes(policy.shipped_at)))
      throw new Error(
        `Shipped policy copy differs from Lock: ${policy.source_path}`,
      );
  }
}
