/** Actual admission and ownership controls using only synthetic registrations and test-owned scratch. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { domainHash, sha256 } from "../../src/identity/canonical-json.js";
import {
  closed,
  jsonBytes,
  requirePair,
} from "../../src/runtime/durable-pair-contract.js";
import {
  registeredPair,
  pairSettings,
  type RegisteredPair,
} from "../../src/runtime/durable-pair-binding.js";
import { openPairOwner } from "../../src/runtime/durable-pair-owner.js";

const persistent = "/workspaces/the-desk-durable-pair-operations-v2";
const roots: string[] = [];
beforeEach(() => {
  vi.stubEnv("DESK_ENV", "test");
  vi.stubEnv("PROVIDERS_ENABLED", "false");
  vi.stubEnv("GENERATION_KILL_SWITCH", "true");
  vi.stubEnv("NODE_TLS_REJECT_UNAUTHORIZED", "1");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0))
    await fs.rm(root, { recursive: true, force: true });
});
function fixture(): RegisteredPair {
  const uid = process.getuid?.();
  if (uid === undefined) throw new Error("Unix user identity required");
  const vectors = JSON.parse(
    readFileSync(
      new URL("../../fixtures/durable-pair/vectors.json", import.meta.url),
      "utf8",
    ),
  ) as {
    storage_binding: RegisteredPair["storage"];
    database_binding: RegisteredPair["database"];
  };
  const expectedCatalog = {
    columns: [],
    constraints: [],
    triggers: [],
    privileges: [],
    relations: [
      ["public", "artifacts", "101"],
      ["public", "assembly_recipes", "102"],
      ["public", "audio_artifacts", "103"],
      ["public", "master_assembly_maps", "104"],
    ],
  };
  return {
    // Vector bindings are immutable hash inputs, not admissible deployments.
    // Override only test-local admission fields; no endpoint is contacted.
    storage: {
      ...vectors.storage_binding,
      environment_id: "development",
      endpoint_origin:
        "https://00000000000000000000000000000000.r2.cloudflarestorage.com",
      credential_reference: "durable-pair-r2-runtime",
    },
    database: {
      ...vectors.database_binding,
      environment_id: "development",
      credential_reference: "durable-pair-db-runtime",
    },
    namespace: {
      path: persistent,
      dev: 1,
      ino: 1,
      uid,
      owner_sha256: sha256(Buffer.from("test owner\n")),
    },
    databaseLogin: "desk_test_login",
    expectedCatalog,
    migrationAttestation: {
      sha256: "0".repeat(64),
      schema_identity: vectors.database_binding.schema_identity,
      catalog_sha256: sha256(jsonBytes(expectedCatalog)),
    },
  };
}
/** Same AST/transpile/VM technique as the existing private checksum control. No production export or injection hook. */
function admit(registration: RegisteredPair): RegisteredPair {
  const source = readFileSync(
    new URL("../../src/runtime/durable-pair-binding.ts", import.meta.url),
    "utf8",
  );
  const parsed = ts.createSourceFile(
    "binding.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = parsed.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) && node.name?.text === "registeredPair",
  );
  if (!declaration) throw new Error("actual registration admission missing");
  const code = ts.transpileModule(
    declaration.getText(parsed).replace(/^export\s+/u, "") +
      "\nregisteredPair();",
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2024,
        module: ts.ModuleKind.None,
      },
    },
  ).outputText;
  return runInNewContext(code, {
    pairSettings,
    deploymentRegistration: () => registration,
    requirePair,
    closed,
    jsonBytes,
    sha256,
    domainHash,
    process,
  }) as RegisteredPair;
}
it("keeps the repository deployment unregistered", () => {
  expect(() => registeredPair()).toThrow("binding_unavailable");
});
it("admits only the exact persistent registration path without opening it", () => {
  const registration = fixture();
  expect(admit(registration)).toBe(registration);
  for (const path of [
    "/tmp/the-desk-durable-pair-operations",
    "/tmp/caller-selected",
    persistent + "/",
    persistent + "/.",
    "/workspaces/caller-selected",
  ]) {
    expect(() =>
      admit({
        ...registration,
        namespace: { ...registration.namespace, path },
      }),
    ).toThrow("binding_unavailable");
  }
  for (const change of [
    { uid: registration.namespace.uid + 1 },
    { dev: NaN },
    { ino: 1.5 },
  ])
    expect(() =>
      admit({
        ...registration,
        namespace: { ...registration.namespace, ...change },
      }),
    ).toThrow("binding_unavailable");
});
it("checks actual dev, inode, uid and OWNER bytes before creating an operation", async () => {
  const root = await fs.mkdtemp(
    join(await fs.realpath(tmpdir()), "desk-namespace-test-"),
  );
  roots.push(root);
  await fs.writeFile(join(root, "OWNER.json"), "test owner\n", {
    mode: 0o600,
    flag: "wx",
  });
  const stat = await fs.lstat(root);
  const registration = fixture();
  registration.namespace = {
    ...registration.namespace,
    path: root,
    dev: stat.dev,
    ino: stat.ino,
    uid: stat.uid,
  };
  const operation = "b6200001-0000-4000-8000-000000000001";
  const timestamp = "2026-11-03T00:00:00.000000Z";
  for (const change of [
    { dev: stat.dev + 1 },
    { ino: stat.ino + 1 },
    { uid: stat.uid + 1 },
    { owner_sha256: "f".repeat(64) },
  ]) {
    await expect(
      openPairOwner(
        {
          ...registration,
          namespace: { ...registration.namespace, ...change },
        },
        operation,
        timestamp,
      ),
    ).rejects.toMatchObject({ code: "cleanup_pending" });
    expect(await fs.readdir(root)).toEqual(["OWNER.json"]);
  }
  await fs.writeFile(join(root, "OWNER.json"), "changed owner\n", {
    mode: 0o600,
  });
  await expect(
    openPairOwner(registration, operation, timestamp),
  ).rejects.toMatchObject({ code: "cleanup_pending" });
  expect(await fs.readdir(root)).toEqual(["OWNER.json"]);
  await fs.writeFile(join(root, "OWNER.json"), "test owner\n", { mode: 0o600 });
  const owner = await openPairOwner(registration, operation, timestamp);
  expect(owner.fresh).toBe(true);
  await owner.close(true);
  const missing = join(root, "missing");
  await expect(
    openPairOwner(
      {
        ...registration,
        namespace: { ...registration.namespace, path: missing },
      },
      operation,
      timestamp,
    ),
  ).rejects.toMatchObject({ code: "ENOENT" });
  expect(await fs.readdir(root)).not.toContain("missing");
});
