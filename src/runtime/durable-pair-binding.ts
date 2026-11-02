/** One deployment-owned registration. No endpoint, credential, or ownership root is selected by callers. */
import { domainHash, sha256 } from "../identity/canonical-json.js";
import {
  closed,
  jsonBytes,
  requirePair,
  type PairBindings,
} from "./durable-pair-contract.js";
import type { Data } from "./technical-master-checks.js";

export interface RegisteredPair extends PairBindings {
  namespace: {
    path: string;
    dev: number;
    ino: number;
    uid: number;
    owner_sha256: string;
  };
  databaseLogin: string;
  expectedCatalog: Data;
  migrationAttestation: {
    sha256: string;
    schema_identity: string;
    catalog_sha256: string;
  };
}
function deploymentRegistration(): RegisteredPair | null {
  // Actual literals, namespace identity and migration/TLS attestation require the separately reviewed binding release.
  return null;
}
export function pairSettings(): void {
  requirePair(
    process.env.DESK_ENV === "test" &&
      process.env.PROVIDERS_ENABLED === "false" &&
      process.env.GENERATION_KILL_SWITCH === "true",
    "unsafe_settings",
    "invocation",
  );
  requirePair(
    process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0",
    "binding_unavailable",
    "binding",
  );
}
export function registeredPair(): RegisteredPair {
  pairSettings();
  const registration = deploymentRegistration();
  requirePair(registration, "binding_unavailable", "binding");
  const storage = closed(registration.storage, [
    "schema",
    "environment_id",
    "endpoint_origin",
    "bucket",
    "prefix",
    "credential_reference",
    "credential_scope_attestation",
    "private_access_attestation",
    "retention_attestation",
  ]);
  const database = closed(registration.database, [
    "schema",
    "environment_id",
    "endpoint_host",
    "endpoint_port",
    "database_name",
    "schema_name",
    "runtime_role",
    "credential_reference",
    "schema_identity",
  ]);
  requirePair(
    storage.schema === "durable-pair-r2-binding/1" &&
      database.schema === "durable-pair-database-binding/1" &&
      ["development", "staging"].includes(
        registration.storage.environment_id,
      ) &&
      database.environment_id === storage.environment_id,
    "binding_unavailable",
    "binding",
  );
  requirePair(
    /^https:\/\/[0-9a-f]{32}\.r2\.cloudflarestorage\.com$/.test(
      registration.storage.endpoint_origin,
    ) &&
      /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(registration.storage.bucket) &&
      /^[a-z0-9][a-z0-9/_-]{0,127}$/.test(registration.storage.prefix) &&
      !registration.storage.prefix.endsWith("/") &&
      !registration.storage.prefix.includes("//"),
    "binding_unavailable",
    "binding",
  );
  requirePair(
    registration.storage.credential_reference === "durable-pair-r2-runtime" &&
      registration.database.credential_reference ===
        "durable-pair-db-runtime" &&
      database.schema_name === "public" &&
      database.runtime_role === "desk_runtime" &&
      /^[1-9][0-9]{0,4}$/.test(registration.database.endpoint_port) &&
      Number(database.endpoint_port) <= 65535,
    "binding_unavailable",
    "binding",
  );
  requirePair(
    [
      storage.credential_scope_attestation,
      storage.private_access_attestation,
      storage.retention_attestation,
      database.schema_identity,
      registration.namespace.owner_sha256,
      registration.migrationAttestation.sha256,
      registration.migrationAttestation.catalog_sha256,
    ].every(
      (hash) => typeof hash === "string" && /^[0-9a-f]{64}$/.test(hash),
    ) &&
      registration.migrationAttestation.schema_identity ===
        database.schema_identity,
    "binding_unavailable",
    "binding",
  );
  requirePair(
    registration.namespace.path === "/tmp/the-desk-durable-pair-operations" &&
      registration.namespace.uid === process.getuid?.() &&
      Number.isSafeInteger(registration.namespace.dev) &&
      Number.isSafeInteger(registration.namespace.ino),
    "binding_unavailable",
    "binding",
  );
  // The approved migration/schema attestation includes this exact finite runtime catalog, including relation identities.
  const catalog = closed(registration.expectedCatalog, [
    "columns",
    "constraints",
    "triggers",
    "privileges",
    "relations",
  ]);
  // Checksum of the exact canonical UTF-8 catalog profile plus LF, inside the existing source-owned attestation.
  requirePair(
    registration.migrationAttestation.catalog_sha256 ===
      sha256(jsonBytes(catalog)),
    "binding_unavailable",
    "binding",
  );
  const relations = catalog.relations;
  const names = [
    "artifacts",
    "assembly_recipes",
    "audio_artifacts",
    "master_assembly_maps",
  ];
  requirePair(
    Array.isArray(relations) && relations.length === names.length,
    "binding_unavailable",
    "binding",
  );
  const oids = new Set<string>();
  for (const [index, value] of relations.entries()) {
    requirePair(
      Array.isArray(value) &&
        value.length === 3 &&
        value[0] === "public" &&
        value[1] === names[index] &&
        typeof value[2] === "string" &&
        /^[1-9][0-9]{0,9}$/.test(value[2]) &&
        Number(value[2]) <= 4294967295,
      "binding_unavailable",
      "binding",
    );
    oids.add(value[2]);
  }
  requirePair(oids.size === names.length, "binding_unavailable", "binding");
  // Evaluate both complete domains now; no omitted source/attestation field is accepted.
  domainHash("durable-pair-storage-binding-v1", storage);
  domainHash("durable-pair-database-binding-v1", database);
  return registration;
}
export function r2Credentials(registration: RegisteredPair): {
  accessKeyId: string;
  secretAccessKey: string;
} {
  requirePair(
    registration.storage.credential_reference === "durable-pair-r2-runtime",
    "binding_unavailable",
    "binding",
  );
  const accessKeyId = process.env.DESK_DURABLE_PAIR_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.DESK_DURABLE_PAIR_R2_SECRET_ACCESS_KEY;
  requirePair(accessKeyId && secretAccessKey, "binding_unavailable", "binding");
  return { accessKeyId, secretAccessKey };
}
export function databasePassword(registration: RegisteredPair): string {
  requirePair(
    registration.database.credential_reference === "durable-pair-db-runtime",
    "binding_unavailable",
    "binding",
  );
  const password = process.env.DESK_DURABLE_PAIR_DB_PASSWORD;
  requirePair(password, "binding_unavailable", "binding");
  return password;
}
