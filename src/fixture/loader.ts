import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";

const zipPath = resolve(
  "Lock/04_IMPLEMENTATION/The_Desk_Walking_Skeleton_Fixture_v0.4.3.zip",
);
const safeMember = /^[a-zA-Z0-9_./-]+$/;

export function loadFixtureJson(member: string): unknown {
  if (
    !safeMember.test(member) ||
    member.includes("..") ||
    !member.endsWith(".json")
  )
    throw new Error("Unsafe fixture member");
  const bytes = execFileSync("unzip", ["-p", zipPath, member], {
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(bytes.toString("utf8")) as unknown;
}

export function loadFixtureBytes(member: string): Buffer {
  if (!safeMember.test(member) || member.includes(".."))
    throw new Error("Unsafe fixture member");
  return execFileSync("unzip", ["-p", zipPath, member], {
    maxBuffer: 20 * 1024 * 1024,
  });
}

const fingerprintFile = z.object({
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

export function loadFingerprintVectors(): z.infer<typeof fingerprintFile> {
  return fingerprintFile.parse(loadFixtureJson("gate_fingerprint_inputs.json"));
}

export async function verifyPolicySources(): Promise<void> {
  const manifest = z
    .object({
      policies: z.record(
        z.string(),
        z.object({
          source_path: z.string(),
          source_sha256: z.string().regex(/^[0-9a-f]{64}$/),
        }),
      ),
    })
    .parse(loadFixtureJson("config/policy_versions.json"));
  for (const policy of Object.values(manifest.policies)) {
    const bytes = await readFile(resolve("Lock", policy.source_path));
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== policy.source_sha256)
      throw new Error(`Policy source identity mismatch: ${policy.source_path}`);
  }
}
