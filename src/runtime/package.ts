// A5.1 Evidence Package persistence and binding (Evidence Package 5.1, 23-24; Foundation 001 `bind_evidence_package`).
// Package identity is the governed PACKAGE hash (A1 evidencePackageHash = hash of the manifest ONLY, so execution metadata such as
// created_at / frozen_at / selector_run_id / artifact ids never participates and a package may be reused by hash). Evidence identity
// is the authored evidence UUID; body hashes are never an identity here.
// The hash is NOT validation: before a package is accepted or bound its evidence entries are checked against the persisted unit and
// rights rows, its claim entries against the persisted claim rows, and (when the caller names the slice's units) its evidence set must
// equal that set exactly.
import type { Pool } from "pg";

import { evidencePackageHash } from "../identity/artifacts.js";
import {
  assertJson,
  isUnique,
  Rejection,
  requireHex64,
  requireTimestamp,
  requireUuid,
  rethrow,
  runCommand,
  type DbError,
  type Json,
  type Outcome,
  type Row,
  type Tx,
} from "./command.js";

export interface AuthoredPackage {
  artifact_id: string;
  evidence_package_id: string;
  /** artifacts.schema_version is NOT NULL and has no default: the caller supplies the governed value (the fixture uses its own). */
  schema_version: string;
  /** The whole artifact payload; `manifest` is what is hashed. */
  canonical_payload: Json;
  storage_uri: string | null;
  byte_size: number | null;
  created_at: string;
}
export interface StoredPackage {
  artifact_id: string;
  evidence_package_id: string;
  package_hash: string;
  /** True when an existing package was returned by governed hash (the request's own ids were not used). */
  reused: boolean;
  /** True when a typed package row was added to an artifact another writer had already stored. */
  completed_existing_artifact: boolean;
}
export interface PersistPackageOptions {
  /** The evidence unit ids the package must contain EXACTLY (the slice's units). */
  expectedUnitIds?: readonly string[];
}

interface Parsed {
  hash: string;
  manifest: Record<string, Json>;
  evidence: Record<string, Json>[];
  claims: Record<string, Json>[];
}
const isObj = (v: unknown): v is Record<string, Json> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Pure request validation (no database). */
export function parsePackage(pkg: AuthoredPackage): Parsed {
  requireUuid(pkg.artifact_id, "artifact_id");
  requireUuid(pkg.evidence_package_id, "evidence_package_id");
  if (typeof pkg.schema_version !== "string" || pkg.schema_version === "")
    throw new Rejection("invalid_schema_version");
  if (pkg.storage_uri !== null && typeof pkg.storage_uri !== "string")
    throw new Rejection("invalid_storage_uri");
  if (
    pkg.byte_size !== null &&
    (!Number.isSafeInteger(pkg.byte_size) || pkg.byte_size < 0)
  )
    throw new Rejection("invalid_byte_size");
  requireTimestamp(pkg.created_at, "artifact.created_at");
  const payload = assertJson(pkg.canonical_payload, "canonical_payload");
  if (isObj(payload)) {
    if (
      payload.artifact_id !== undefined &&
      payload.artifact_id !== pkg.artifact_id
    )
      throw new Rejection("package_artifact_id_mismatch");
    if (payload.id !== undefined && payload.id !== pkg.evidence_package_id)
      throw new Rejection("package_id_mismatch");
  }
  return parsePayload(payload);
}

/** Manifest-level validation of a stored or authored artifact payload. */
export function parsePayload(payload: Json): Parsed {
  if (!isObj(payload) || !isObj(payload.manifest))
    throw new Rejection("package_manifest_missing");
  const hash = evidencePackageHash(payload);
  if (payload.package_hash !== undefined && payload.package_hash !== hash)
    throw new Rejection("package_hash_field_mismatch");
  const evidence = payload.manifest.evidence;
  const claims = payload.manifest.claims;
  if (!Array.isArray(evidence) || !evidence.every(isObj))
    throw new Rejection("package_evidence_missing");
  if (!Array.isArray(claims) || !claims.every(isObj))
    throw new Rejection("package_claims_missing");
  const eIds = evidence.map((e) =>
    requireUuid(e.evidence_unit_id, "evidence entry"),
  );
  if (new Set(eIds).size !== eIds.length)
    throw new Rejection("package_evidence_duplicate");
  const cIds = claims.map((c) => requireUuid(c.claim_id, "claim entry"));
  if (new Set(cIds).size !== cIds.length)
    throw new Rejection("package_claim_duplicate");
  for (const c of claims)
    requireHex64(c.claim_content_hash, "claim_content_hash");
  return { hash, manifest: payload.manifest, evidence, claims };
}

const list = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : []);

/** Package entries against the persisted unit, rights and claim rows (the same relationships the fixture verifier enforces). */
async function validateReferences(
  tx: Tx,
  p: Parsed,
  options: PersistPackageOptions,
): Promise<void> {
  const ids = p.evidence.map((e) => e.evidence_unit_id as string);
  if (options.expectedUnitIds) {
    const want = [...options.expectedUnitIds].sort().join();
    if ([...ids].sort().join() !== want)
      throw new Rejection(
        "package_units_mismatch",
        "the package's evidence set differs from the slice's units",
      );
  }
  const units = await tx.query(
    `SELECT u.evidence_unit_id::text, u.content_hash, u.evidence_type, u.rights_version_id::text, r.policy
       FROM evidence_units u JOIN rights_versions r USING (rights_version_id) WHERE u.evidence_unit_id = ANY($1::uuid[])`,
    [ids],
  );
  const byId = new Map(
    units.rows.map((r) => [r.evidence_unit_id as string, r]),
  );
  for (const e of p.evidence) {
    const id = e.evidence_unit_id as string;
    const u = byId.get(id);
    if (!u) throw new Rejection("package_evidence_unit_not_found", id);
    const policy = u.policy as Record<string, Json>;
    if (
      e.content_hash !== u.content_hash ||
      e.evidence_type !== u.evidence_type ||
      e.rights_version_id !== u.rights_version_id ||
      !list(policy.covered_source_identities).includes(
        e.source_identity ?? null,
      )
    )
      throw new Rejection("package_evidence_fields", id);
    if (
      (e.quote_permission === true && policy.quotation_permission !== true) ||
      (e.paraphrase_permission === true &&
        policy.paraphrase_permission !== true)
    )
      throw new Rejection("package_evidence_permission_exceeds_rights", id);
    const ceiling = isObj(policy.consumer_exposure_ceiling)
      ? policy.consumer_exposure_ceiling
      : {};
    const exposure = isObj(e.consumer_exposure) ? e.consumer_exposure : {};
    for (const consumer of Object.keys(exposure))
      if (!list(ceiling[consumer]).includes(exposure[consumer] ?? null))
        throw new Rejection(
          "package_evidence_exposure_exceeds_rights",
          `${id} ${consumer}`,
        );
  }
  const claimIds = p.claims.map((c) => c.claim_id as string);
  const claims = await tx.query(
    `SELECT claim_id::text, content_hash, claim_kind, origin, subject_domain, predicate FROM claims WHERE claim_id = ANY($1::uuid[])`,
    [claimIds],
  );
  const claimById = new Map(claims.rows.map((r) => [r.claim_id as string, r]));
  const evidenceSet = new Set(ids);
  for (const c of p.claims) {
    const id = c.claim_id as string;
    const row = claimById.get(id);
    if (!row) throw new Rejection("package_claim_not_found", id);
    if (
      c.claim_content_hash !== row.content_hash ||
      c.kind !== row.claim_kind ||
      c.origin !== row.origin ||
      c.subject_domain !== row.subject_domain ||
      c.predicate !== row.predicate
    )
      throw new Rejection("package_claim_fields", id);
    for (const ref of list(c.support_refs)) {
      const unit = isObj(ref) ? ref.evidence_unit_id : null;
      if (typeof unit === "string" && !evidenceSet.has(unit))
        throw new Rejection(
          "package_support_unit_not_in_package",
          `${id} ${unit}`,
        );
    }
  }
}

const NAMED = [
  "artifacts_artifact_type_content_hash_key",
  "artifacts_pkey",
  "evidence_packages_pkey",
  "evidence_packages_package_hash_key",
  "evidence_packages_artifact_id_key",
];

async function readByHash(
  tx: Tx,
  hash: string,
  manifest: Json,
): Promise<Row | undefined> {
  const r = await tx.query(
    `SELECT p.evidence_package_id::text, p.artifact_id::text, p.package_hash,
            (a.canonical_payload #> '{manifest}' = $2::jsonb) AS same_manifest
       FROM evidence_packages p JOIN artifacts a ON a.artifact_id = p.artifact_id WHERE p.package_hash = $1`,
    [hash, JSON.stringify(manifest)],
  );
  return r.rows[0];
}

const stored = (r: Row, extra: Partial<StoredPackage> = {}): StoredPackage => ({
  artifact_id: r.artifact_id as string,
  evidence_package_id: r.evidence_package_id as string,
  package_hash: r.package_hash as string,
  reused: false,
  completed_existing_artifact: false,
  ...extra,
});

export async function persistEvidencePackage(
  pool: Pool,
  pkg: AuthoredPackage,
  options: PersistPackageOptions = {},
): Promise<Outcome<StoredPackage>> {
  let parsed: Parsed;
  try {
    parsed = parsePackage(pkg);
    for (const id of options.expectedUnitIds ?? [])
      requireUuid(id, "expected unit");
  } catch (error) {
    if (error instanceof Rejection)
      return { kind: "rejected", code: error.code, detail: error.message };
    throw error;
  }
  const manifestJson = JSON.stringify(parsed.manifest);
  return runCommand(pool, async (tx) => {
    await validateReferences(tx, parsed, options);
    for (let round = 0; round < 3; round += 1) {
      const byHash = await readByHash(tx, parsed.hash, parsed.manifest);
      if (byHash) {
        if (byHash.same_manifest !== true)
          return {
            kind: "conflict",
            code: "manifest_differs_for_hash",
            stored: stored(byHash),
            detail: "a package with this hash stores a different manifest",
          };
        return {
          kind: "converged",
          record: stored(byHash, { reused: true }),
        };
      }
      // A preexisting artifact WITHOUT its typed package row can come from another writer. It is completed only when its manifest is
      // the request's manifest (the governed identity); anything else is a conflict, never an assumption.
      const art = await tx.query(
        `SELECT artifact_id::text, (canonical_payload #> '{manifest}' = $2::jsonb) AS same_manifest,
                EXISTS (SELECT 1 FROM evidence_packages p WHERE p.artifact_id = a.artifact_id) AS typed
           FROM artifacts a WHERE artifact_type = 'evidence_package' AND content_hash = $1`,
        [parsed.hash, manifestJson],
      );
      const existing = art.rows[0];
      if (existing) {
        // The typed row may have been committed between the two reads above (the winner writes both in one statement): re-read by
        // hash once more before calling an artifact "untyped". A typed row that stays invisible to the hash lookup is another
        // writer's inconsistent state and is a conflict.
        if (
          existing.typed === true &&
          existing.same_manifest === true &&
          round < 2
        )
          continue;
        if (existing.same_manifest !== true || existing.typed === true)
          return {
            kind: "conflict",
            code: "artifact_differs_for_hash",
            stored: existing,
            detail:
              "an artifact with this package hash exists without a matching typed package row",
          };
        const occupied = await tx.query(
          "SELECT 1 FROM evidence_packages WHERE evidence_package_id = $1::uuid",
          [pkg.evidence_package_id],
        );
        if (occupied.rows.length > 0)
          return {
            kind: "conflict",
            code: "evidence_package_id_occupied",
            stored: null,
            detail: "the authored package id belongs to a different record",
          };
        const done = await tx.attempt(
          `INSERT INTO evidence_packages (evidence_package_id, artifact_id, package_hash) VALUES ($1::uuid, $2::uuid, $3)`,
          [pkg.evidence_package_id, existing.artifact_id, parsed.hash],
        );
        if (done.ok)
          return {
            kind: "created",
            record: stored(
              {
                artifact_id: existing.artifact_id,
                evidence_package_id: pkg.evidence_package_id,
                package_hash: parsed.hash,
              },
              { completed_existing_artifact: true },
            ),
          };
        if (!isRace(done.error)) rethrow(done.error);
        continue;
      }
      const occupiedArtifact = await tx.query(
        "SELECT 1 FROM artifacts WHERE artifact_id = $1::uuid",
        [pkg.artifact_id],
      );
      const occupiedPackage = await tx.query(
        "SELECT 1 FROM evidence_packages WHERE evidence_package_id = $1::uuid",
        [pkg.evidence_package_id],
      );
      if (occupiedArtifact.rows.length > 0 || occupiedPackage.rows.length > 0)
        return {
          kind: "conflict",
          code:
            occupiedArtifact.rows.length > 0
              ? "artifact_id_occupied"
              : "evidence_package_id_occupied",
          stored: null,
          detail: "an authored id belongs to a different record",
        };
      // ONE statement writes artifact and typed row, so a unique violation on either leaves neither (no orphan artifact).
      const ins = await tx.attempt(
        `WITH a AS (
           INSERT INTO artifacts (artifact_id, artifact_type, schema_version, content_hash, storage_uri, byte_size, canonical_payload, created_at)
           VALUES ($1::uuid, 'evidence_package', $2, $3, $4, $5::bigint, $6::jsonb, $7::timestamptz) RETURNING artifact_id)
         INSERT INTO evidence_packages (evidence_package_id, artifact_id, package_hash) SELECT $8::uuid, artifact_id, $3 FROM a`,
        [
          pkg.artifact_id,
          pkg.schema_version,
          parsed.hash,
          pkg.storage_uri,
          pkg.byte_size,
          JSON.stringify(pkg.canonical_payload),
          pkg.created_at,
          pkg.evidence_package_id,
        ],
      );
      if (ins.ok)
        return {
          kind: "created",
          record: stored({
            artifact_id: pkg.artifact_id,
            evidence_package_id: pkg.evidence_package_id,
            package_hash: parsed.hash,
          }),
        };
      if (!isRace(ins.error)) rethrow(ins.error);
      // Savepoint rolled back: re-read. A hash race converges on the winner; a UUID race is caught by the occupied checks above.
    }
    throw new Error("package persistence did not settle after re-reads");
  });
}
const isRace = (e: DbError): boolean => isUnique(e, ...NAMED);

// ---------------------------------------------------------------------------------------------------------------- binding
export interface BindInput {
  attemptId: string;
  evidencePackageId: string;
  /** The slice's units: when given, the package's evidence set must equal it before the binding is accepted. */
  expectedUnitIds?: readonly string[];
}
export interface BoundPackage {
  attemptId: string;
  evidencePackageId: string;
}

export async function bindPackage(
  pool: Pool,
  input: BindInput,
): Promise<Outcome<BoundPackage>> {
  try {
    requireUuid(input.attemptId, "attemptId");
    requireUuid(input.evidencePackageId, "evidencePackageId");
    for (const id of input.expectedUnitIds ?? [])
      requireUuid(id, "expected unit");
  } catch (error) {
    if (error instanceof Rejection)
      return { kind: "rejected", code: error.code, detail: error.message };
    throw error;
  }
  const { attemptId, evidencePackageId } = input;
  return runCommand(pool, async (tx) => {
    const current = async (): Promise<Row | undefined> =>
      (
        await tx.query(
          "SELECT evidence_package_id::text AS bound, state::text AS state FROM program_run_attempts WHERE attempt_id = $1::uuid",
          [attemptId],
        )
      ).rows[0];
    const decide = (bound: unknown): Outcome<BoundPackage> | undefined => {
      if (bound === evidencePackageId)
        return { kind: "converged", record: { attemptId, evidencePackageId } };
      if (typeof bound === "string")
        return {
          kind: "conflict",
          code: "attempt_bound_to_other_package",
          stored: { attemptId, evidencePackageId: bound },
          detail: "an attempt's package binding is immutable once assigned",
        };
      return undefined;
    };
    const row = await current();
    if (!row) return { kind: "rejected", code: "attempt_not_found" };
    const early = decide(row.bound);
    if (early) return early;
    const pkg = await tx.query(
      `SELECT a.canonical_payload AS payload FROM evidence_packages p JOIN artifacts a ON a.artifact_id = p.artifact_id WHERE p.evidence_package_id = $1::uuid`,
      [evidencePackageId],
    );
    const payload = pkg.rows[0]?.payload as Json | undefined;
    if (payload === undefined)
      return { kind: "rejected", code: "package_not_found" };
    if (row.state !== "PENDING")
      return { kind: "rejected", code: "attempt_not_pending" };
    // The binding is accepted only for a package that still validates against the persisted rows (and the slice's units).
    const parsed = parsePayload(payload);
    await validateReferences(tx, parsed, {
      ...(input.expectedUnitIds
        ? { expectedUnitIds: input.expectedUnitIds }
        : {}),
    });
    const bind = await tx.attempt(
      "SELECT bind_evidence_package($1::uuid, $2::uuid)",
      [attemptId, evidencePackageId],
    );
    if (bind.ok)
      return { kind: "created", record: { attemptId, evidencePackageId } };
    // A concurrent binder committed first ("missing attempt or package already bound"); the savepoint is rolled back, so re-read.
    if (bind.error.code !== "P0001") rethrow(bind.error);
    const after = await current();
    if (!after) return { kind: "rejected", code: "attempt_not_found" };
    const settled = decide(after.bound);
    if (settled) return settled;
    return rethrow(bind.error);
  });
}
