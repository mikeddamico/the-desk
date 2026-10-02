// A5.1 Evidence Package persistence and binding (Evidence Package 5.1, 9, 9.3, 10, 23-24; Foundation 001 `bind_evidence_package`).
// Package identity is the governed PACKAGE hash (A1 evidencePackageHash = hash of the manifest ONLY, so execution metadata such as
// created_at / frozen_at / selector_run_id / artifact ids never participates and a package may be reused by hash). Evidence identity
// is the authored evidence UUID; body hashes are never an identity here.
// The hash is NOT validation. Before a package is persisted, reused, completed or bound it is validated against the active profile
// (package-profile.ts: schema labels, required fields and types, references) and reconciled with the persisted rows: evidence entries
// against unit and rights rows, claim entries against the claim rows through the accepted A3 frozen-entry verifier (initial fields,
// explicit cursor/prefix, frozen state and hash), each SELECTED support ref against its own claim_supports row and exact target hash (not against every current row of the claim). One
// normalized payload representation is hashed, compared and stored. No selection, scoring, scope or eligibility policy is implemented.
import type { Pool } from "pg";

import { canonicalJson, normalizeString } from "../identity/canonical-json.js";
import { evidenceBodyHash } from "../identity/domains.js";
import { supportHashFor } from "../identity/knowledge.js";
import { readClaimLogs } from "../knowledge/claim-log.js";
import { ClaimStateError } from "../knowledge/claim-state.js";
import { verifyFrozenEntry } from "../knowledge/state-cursor.js";
import {
  isJsonObject,
  isUnique,
  Rejection,
  requireUuid,
  rethrow,
  runCommand,
  type DbError,
  type Json,
  type Outcome,
  type Row,
  type Tx,
} from "./command.js";
import {
  parseArtifactFields,
  parsePayload,
  type ParsedPackage,
} from "./package-profile.js";

export { parsePayload } from "./package-profile.js";

export interface AuthoredPackage {
  artifact_id: string;
  evidence_package_id: string;
  /** artifacts.schema_version has no default: the caller supplies the profile's governed label (see ARTIFACT_SCHEMA_LABELS). */
  schema_version: string;
  /** The whole artifact payload; `manifest` is what is hashed. */
  canonical_payload: Json;
  storage_uri: string | null;
  byte_size: number | null;
  created_at: string;
}
export interface PackageVerification {
  verified: string[];
  /** Named limits of what the accepted A3 verifier could not independently reproduce (for example the frozen-time usage ceiling). */
  limits: string[];
}
export interface StoredPackage {
  artifact_id: string;
  evidence_package_id: string;
  package_hash: string;
  /** True when an existing package was returned by governed hash (the request's own ids were not used). */
  reused: boolean;
  /** True when a typed package row was added to an artifact another writer had already stored. */
  completed_existing_artifact: boolean;
  verification: PackageVerification;
}
export interface PersistPackageOptions {
  /** The evidence unit ids the package must contain EXACTLY (the slice's units). */
  expectedUnitIds?: readonly string[];
}

/** Pure request validation (no database): artifact row fields, id agreement, then the governed payload profile. */
export function parsePackage(pkg: AuthoredPackage): ParsedPackage {
  requireUuid(pkg.evidence_package_id, "evidence_package_id");
  parseArtifactFields(pkg);
  const parsed = parsePayload(pkg.canonical_payload);
  if (parsed.payload.artifact_id !== pkg.artifact_id)
    throw new Rejection("package_artifact_id_mismatch");
  if (parsed.payload.id !== pkg.evidence_package_id)
    throw new Rejection("package_id_mismatch");
  return parsed;
}

/**
 * The ACTIVE bounded fixture representation of a claim subject: every persisted claim carries `subject = {"entity_ref": <string>}`
 * and the package freezes it as `subject_ref`. This is not a universal subject mapper: any other persisted shape is refused.
 */
export function claimSubjectRef(subject: unknown): string {
  if (
    !isJsonObject(subject) ||
    Object.keys(subject).join() !== "entity_ref" ||
    typeof subject.entity_ref !== "string" ||
    subject.entity_ref === ""
  )
    throw new Rejection(
      "package_claim_subject_unsupported",
      "only the bounded fixture representation {entity_ref} is supported",
    );
  return subject.entity_ref;
}

const asObj = (v: unknown): Record<string, Json> | undefined =>
  isJsonObject(v) ? v : undefined;
const list = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : []);

/** The slice's units must be EXACTLY the package's evidence set (checked on request, stored, retry and race-winner paths alike). */
function assertUnitSet(p: ParsedPackage, options: PersistPackageOptions): void {
  if (!options.expectedUnitIds) return;
  const ids = p.evidence.map((e) => e.evidence_unit_id);
  if ([...ids].sort().join() !== [...options.expectedUnitIds].sort().join())
    throw new Rejection(
      "package_units_mismatch",
      "the package's evidence set differs from the slice's units",
    );
}

interface UnitRow {
  evidence_unit_id: string;
  content_hash: string;
  evidence_type: string;
  rights_version_id: string;
  canonical_content: string;
  policy: unknown;
}

/** Package entries against persisted rows. Throws {@link Rejection}; returns what the A3 verifier could and could not prove. */
async function validateReferences(
  tx: Pick<Tx, "query">,
  p: ParsedPackage,
  options: PersistPackageOptions,
): Promise<PackageVerification> {
  const ids = p.evidence.map((e) => e.evidence_unit_id);
  assertUnitSet(p, options);
  const units = await tx.query(
    `SELECT u.evidence_unit_id::text, u.content_hash, u.evidence_type, u.rights_version_id::text, u.canonical_content, r.policy
       FROM evidence_units u JOIN rights_versions r USING (rights_version_id) WHERE u.evidence_unit_id = ANY($1::uuid[])`,
    [ids],
  );
  const byId = new Map(
    (units.rows as unknown as UnitRow[]).map((r) => [r.evidence_unit_id, r]),
  );
  for (const e of p.evidence) {
    const id = e.evidence_unit_id;
    const u = byId.get(id);
    if (!u) throw new Rejection("package_evidence_unit_not_found", id);
    const policy = asObj(u.policy);
    if (!policy) throw new Rejection("rights_policy_malformed", id);
    const covered = policy.covered_source_identities;
    const ceiling = asObj(policy.consumer_exposure_ceiling);
    if (
      !Array.isArray(covered) ||
      !ceiling ||
      typeof policy.quotation_permission !== "boolean" ||
      typeof policy.paraphrase_permission !== "boolean"
    )
      throw new Rejection("rights_policy_malformed", id);
    // Hashing 12.2 (bounded fixture body profile): canonical_content is a JSON string holding the exact NFC body and content_hash is
    // SHA256(UTF8(body)). Recomputed for EVERY selected row, not only support targets, so the shared checker protects first
    // persistence, reuse, binding, snapshot verification and slice status alike.
    if (
      typeof u.canonical_content !== "string" ||
      normalizeString(u.canonical_content) !== u.canonical_content
    )
      throw new Rejection(
        typeof u.canonical_content === "string"
          ? "package_evidence_body_hash_mismatch"
          : "package_evidence_body_shape",
        id,
      );
    if (evidenceBodyHash(u.canonical_content) !== u.content_hash)
      throw new Rejection("package_evidence_body_hash_mismatch", id);
    if (
      e.content_hash !== u.content_hash ||
      e.evidence_type !== u.evidence_type ||
      e.rights_version_id !== u.rights_version_id ||
      !covered.includes(e.source_identity)
    )
      throw new Rejection("package_evidence_fields", id);
    if (
      (e.quote_permission && !policy.quotation_permission) ||
      (e.paraphrase_permission && !policy.paraphrase_permission)
    )
      throw new Rejection("package_evidence_permission_exceeds_rights", id);
    for (const [consumer, mode] of Object.entries(e.consumer_exposure))
      if (!list(ceiling[consumer]).includes(mode))
        throw new Rejection(
          "package_evidence_exposure_exceeds_rights",
          `${id} ${consumer}`,
        );
  }
  const verification: PackageVerification = { verified: [], limits: [] };
  if (p.claims.length === 0) return verification;
  let logs;
  try {
    logs = await readClaimLogs(
      tx,
      p.claims.map((c) => c.claim_id),
    );
  } catch (error) {
    if (error instanceof ClaimStateError)
      throw new Rejection(
        error.code === "claim_not_found"
          ? "package_claim_not_found"
          : "package_claim_unreadable",
        error.message,
      );
    throw error;
  }
  const limits = new Set<string>();
  const evidenceSet = new Set(ids);
  const supportRows = await tx.query(
    `SELECT claim_support_id::text, claim_id::text, support_kind, support_role, evidence_unit_id::text,
            derivation_run_id::text, external_support_identity, support_hash
       FROM claim_supports WHERE claim_id = ANY($1::uuid[])`,
    [p.claims.map((c) => c.claim_id)],
  );
  for (const [i, c] of p.claims.entries()) {
    const log = logs[i];
    if (!log) throw new Error("claim log missing");
    const row = log.claim;
    const entry = c.raw;
    if (
      c.claim_content_hash !== row.content_hash ||
      entry.kind !== row.claim_kind ||
      entry.origin !== row.origin ||
      entry.subject_domain !== row.subject_domain ||
      entry.predicate !== row.predicate ||
      canonicalJson(entry.value) !== canonicalJson(row.value)
    )
      throw new Rejection("package_claim_fields", c.claim_id);
    if (entry.subject_ref !== claimSubjectRef(row.subject))
      throw new Rejection("package_claim_subject_mismatch", c.claim_id);
    try {
      const v = verifyFrozenEntry({
        entry,
        claim: {
          claim_id: row.claim_id,
          content_hash: row.content_hash,
          initial_status: row.initial_status,
          initial_usage_class: row.initial_usage_class,
        },
        liveEvents: log.events,
        frozenCeiling: { unavailable: true },
        currentCeiling: "assertable",
      });
      for (const l of v.limits) limits.add(l);
    } catch (error) {
      if (error instanceof ClaimStateError)
        throw new Rejection(
          `package_claim_state_${error.code}`,
          `${c.claim_id}: ${error.message}`,
        );
      throw error;
    }
    // support refs: Evidence 9 freezes the SELECTED refs/hashes; Claims 4.3 defines target/role/hash validation. Neither requires
    // the selected set to equal every support row the claim has now, so a later lawful support row neither invalidates the frozen
    // package nor is demanded of it (no support-sufficiency or selection policy is inferred). Every SELECTED ref must match its own
    // persisted row for THIS claim (id, kind, role, targets, hash) and resolve to its exact target.
    const rows = supportRows.rows.filter((r) => r.claim_id === c.claim_id);
    for (const ref of c.support_refs) {
      const stored = rows.find(
        (r) => r.claim_support_id === ref.claim_support_id,
      );
      if (
        stored?.support_kind !== ref.support_kind ||
        stored.support_role !== ref.support_role ||
        stored.evidence_unit_id !== ref.evidence_unit_id ||
        stored.derivation_run_id !== ref.derivation_run_id ||
        stored.external_support_identity !== ref.external_support_identity ||
        stored.support_hash !== ref.support_hash
      )
        throw new Rejection("package_support_rows_mismatch", c.claim_id);
      await resolveSupportHash(tx, ref, byId, evidenceSet, c.claim_id);
    }
  }
  verification.verified.push(
    "evidence entries against unit and rights rows",
    "claim entries: identity, initial fields, cursor/prefix, frozen state and hash (accepted A3 verifier)",
    "support refs against claim_supports rows and their exact target hashes",
  );
  verification.limits.push(...limits);
  return verification;
}

async function resolveSupportHash(
  tx: Pick<Tx, "query">,
  ref: ParsedPackage["claims"][number]["support_refs"][number],
  units: Map<string, UnitRow>,
  evidenceSet: Set<string>,
  claimId: string,
): Promise<void> {
  const where = `${claimId} ${ref.claim_support_id}`;
  let expected: string;
  switch (ref.support_kind) {
    case "evidence": {
      const id = ref.evidence_unit_id;
      const unit = id === null ? undefined : units.get(id);
      if (id === null || !evidenceSet.has(id) || !unit)
        throw new Rejection("package_support_unit_not_in_package", where);
      expected = supportHashFor("evidence", {
        evidenceBody: unit.canonical_content,
      });
      break;
    }
    case "derivation": {
      const run = await tx.query(
        "SELECT output, output_hash FROM derivation_runs WHERE derivation_run_id = $1::uuid",
        [ref.derivation_run_id],
      );
      if (!run.rows[0])
        throw new Rejection("package_support_target_not_found", where);
      // Claims 4.3: a derivation support hash equals derivation_runs.output_hash (and the accepted A1 output projection agrees)
      expected = supportHashFor("derivation", {
        derivationOutput: run.rows[0].output,
      });
      if (run.rows[0].output_hash !== expected)
        throw new Rejection("package_support_hash_mismatch", where);
      break;
    }
    case "signal":
    case "continuity": {
      const m = /^artifact:([0-9a-f-]{36})$/.exec(
        ref.external_support_identity ?? "",
      );
      if (!m?.[1])
        throw new Rejection("package_support_ref_shape", `${where} identity`);
      const carrier = await tx.query(
        "SELECT canonical_payload, content_hash FROM artifacts WHERE artifact_id = $1::uuid",
        [m[1]],
      );
      if (!carrier.rows[0])
        throw new Rejection("package_support_target_not_found", where);
      // Claims 4.3: support_hash == artifacts.content_hash of that exact carrier
      if (carrier.rows[0].content_hash !== ref.support_hash)
        throw new Rejection("package_support_hash_mismatch", where);
      expected = supportHashFor(ref.support_kind, {
        carrier: carrier.rows[0].canonical_payload,
      });
      break;
    }
    default:
      // no governed support-hash rule exists for this kind: refuse rather than accept an unresolvable reference
      throw new Rejection("package_support_kind_unsupported", where);
  }
  if (expected !== ref.support_hash)
    throw new Rejection("package_support_hash_mismatch", where);
}

interface ArtifactRow {
  artifact_id: string;
  artifact_type: string;
  schema_version: string;
  content_hash: string;
  storage_uri: string | null;
  byte_size: string | number | null;
  canonical_payload: unknown;
  created_text: string;
  evidence_package_id: string | null;
  package_hash: string | null;
}

/** Validates a package AS STORED (artifact type, schema label, hash relationship, payload profile, references). */
async function validateStored(
  tx: Pick<Tx, "query">,
  row: ArtifactRow,
): Promise<{ parsed: ParsedPackage; verification: PackageVerification }> {
  try {
    if (row.artifact_type !== "evidence_package")
      throw new Rejection("artifact_type_mismatch");
    parseArtifactFields({
      artifact_id: row.artifact_id,
      schema_version: row.schema_version,
      storage_uri: row.storage_uri,
      byte_size: row.byte_size === null ? null : Number(row.byte_size),
      created_at: row.created_text,
    });
    const parsed = parsePayload(row.canonical_payload);
    if (parsed.hash !== row.content_hash)
      throw new Rejection("stored_hash_mismatch");
    if (row.package_hash !== null && row.package_hash !== row.content_hash)
      throw new Rejection("stored_package_hash_mismatch");
    if (parsed.payload.artifact_id !== row.artifact_id)
      throw new Rejection("package_artifact_id_mismatch");
    if (
      row.evidence_package_id !== null &&
      parsed.payload.id !== row.evidence_package_id
    )
      throw new Rejection("package_id_mismatch");
    return { parsed, verification: await validateReferences(tx, parsed, {}) };
  } catch (error) {
    if (error instanceof Rejection)
      throw new Rejection(
        "stored_package_invalid",
        `${error.code}: ${error.message}`,
      );
    throw error;
  }
}

const artifactSelect = `SELECT a.artifact_id::text, a.artifact_type, a.schema_version, a.content_hash, a.storage_uri, a.byte_size,
       a.canonical_payload, to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_text,
       p.evidence_package_id::text, p.package_hash
  FROM artifacts a LEFT JOIN evidence_packages p ON p.artifact_id = a.artifact_id`;

export type StoredPackageState =
  | { state: "absent" }
  | { state: "invalid"; detail: string }
  | {
      state: "valid";
      parsed: ParsedPackage;
      artifact_id: string;
      evidence_package_id: string;
    };

/**
 * Read-only: the ONE package explicitly identified by its governed hash, validated as stored (artifact type and schema label, payload
 * profile, recomputed manifest hash, artifact / typed row / hash / id relationships, references). No other package is scanned. A
 * package that does not validate is `invalid`; callers must not report verified or complete from its manifest alone.
 */
export async function readStoredPackageByHash(
  tx: Pick<Tx, "query">,
  hash: string,
): Promise<StoredPackageState> {
  const row = (
    await tx.query(`${artifactSelect} WHERE p.package_hash = $1`, [hash])
  ).rows[0] as ArtifactRow | undefined;
  if (!row) return { state: "absent" };
  try {
    const v = await validateStored(tx, row);
    if (v.parsed.hash !== hash)
      throw new Rejection("stored_hash_mismatch", "identified hash differs");
    return {
      state: "valid",
      parsed: v.parsed,
      artifact_id: row.artifact_id,
      evidence_package_id: String(row.evidence_package_id),
    };
  } catch (error) {
    if (error instanceof Rejection)
      return { state: "invalid", detail: error.message };
    throw error;
  }
}

const NAMED = [
  "artifacts_artifact_type_content_hash_key",
  "artifacts_pkey",
  "evidence_packages_pkey",
  "evidence_packages_package_hash_key",
  "evidence_packages_artifact_id_key",
];
const isRace = (e: DbError): boolean => isUnique(e, ...NAMED);

const stored = (
  r: { artifact_id: string; evidence_package_id: string; package_hash: string },
  verification: PackageVerification,
  extra: Partial<StoredPackage> = {},
): StoredPackage => ({
  artifact_id: r.artifact_id,
  evidence_package_id: r.evidence_package_id,
  package_hash: r.package_hash,
  reused: false,
  completed_existing_artifact: false,
  verification,
  ...extra,
});

export async function persistEvidencePackage(
  pool: Pool,
  pkg: AuthoredPackage,
  options: PersistPackageOptions = {},
): Promise<Outcome<StoredPackage>> {
  let parsed: ParsedPackage;
  try {
    parsed = parsePackage(pkg);
    for (const id of options.expectedUnitIds ?? [])
      requireUuid(id, "expected unit");
  } catch (error) {
    if (error instanceof Rejection)
      return { kind: "rejected", code: error.code, detail: error.message };
    throw error;
  }
  const payloadJson = JSON.stringify(parsed.payload);
  return runCommand(pool, async (tx) => {
    const requestVerification = await validateReferences(tx, parsed, options);
    for (let round = 0; round < 3; round += 1) {
      // 1. an existing typed package with this governed hash: reuse after validating what is stored
      const byHash = (
        await tx.query(`${artifactSelect} WHERE p.package_hash = $1`, [
          parsed.hash,
        ])
      ).rows[0] as ArtifactRow | undefined;
      if (byHash) {
        let validated;
        try {
          validated = await validateStored(tx, byHash);
        } catch (error) {
          if (error instanceof Rejection)
            return {
              kind: "conflict",
              code: error.code,
              stored: byHash.artifact_id,
              detail: error.message,
            };
          throw error;
        }
        if (
          canonicalJson(validated.parsed.manifest) !==
          canonicalJson(parsed.manifest)
        )
          return {
            kind: "conflict",
            code: "manifest_differs_for_hash",
            stored: byHash.artifact_id,
            detail: "a package with this hash stores a different manifest",
          };
        return {
          kind: "converged",
          record: stored(
            {
              artifact_id: byHash.artifact_id,
              evidence_package_id: String(byHash.evidence_package_id),
              package_hash: parsed.hash,
            },
            validated.verification,
            { reused: true },
          ),
        };
      }
      // 2. a preexisting artifact WITHOUT its typed row (another writer): completed only after its ACTUAL stored payload, schema
      //    label and references validate and it carries the request's manifest and package id
      const existing = (
        await tx.query(
          `${artifactSelect} WHERE a.artifact_type = 'evidence_package' AND a.content_hash = $1`,
          [parsed.hash],
        )
      ).rows[0] as ArtifactRow | undefined;
      if (existing) {
        // the typed row may have been committed between the two reads (the winner writes both in one statement): re-read once more
        if (existing.evidence_package_id !== null && round < 2) continue;
        if (existing.evidence_package_id !== null)
          return {
            kind: "conflict",
            code: "artifact_differs_for_hash",
            stored: existing.artifact_id,
            detail:
              "the artifact carries a typed row for a different package hash",
          };
        let validated;
        try {
          validated = await validateStored(tx, existing);
        } catch (error) {
          if (error instanceof Rejection)
            return {
              kind: "conflict",
              code: "stored_package_invalid",
              stored: existing.artifact_id,
              detail: error.message,
            };
          throw error;
        }
        if (
          canonicalJson(validated.parsed.manifest) !==
            canonicalJson(parsed.manifest) ||
          validated.parsed.payload.id !== pkg.evidence_package_id
        )
          return {
            kind: "conflict",
            code: "artifact_differs_for_hash",
            stored: existing.artifact_id,
            detail: "stored manifest or package id differs from the request",
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
              validated.verification,
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
          payloadJson,
          pkg.created_at,
          pkg.evidence_package_id,
        ],
      );
      if (ins.ok)
        return {
          kind: "created",
          record: stored(
            {
              artifact_id: pkg.artifact_id,
              evidence_package_id: pkg.evidence_package_id,
              package_hash: parsed.hash,
            },
            requestVerification,
          ),
        };
      if (!isRace(ins.error)) rethrow(ins.error);
      // Savepoint rolled back: re-read. A hash race converges on the winner; a UUID race is caught by the occupied checks above.
    }
    throw new Error("package persistence did not settle after re-reads");
  });
}

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
    // The requested package is validated BEFORE any decision, so a same-package retry and a race-winner convergence are validated
    // exactly like a first binding (artifact type, schema label, hash relationship, payload profile, references, slice unit set).
    const pkg = (
      await tx.query(
        `${artifactSelect} WHERE p.evidence_package_id = $1::uuid`,
        [evidencePackageId],
      )
    ).rows[0] as ArtifactRow | undefined;
    if (!pkg) return { kind: "rejected", code: "package_not_found" };
    const validated = await validateStored(tx, pkg);
    assertUnitSet(validated.parsed, {
      ...(input.expectedUnitIds
        ? { expectedUnitIds: input.expectedUnitIds }
        : {}),
    });
    const early = decide(row.bound);
    if (early) return early;
    if (row.state !== "PENDING")
      return { kind: "rejected", code: "attempt_not_pending" };
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
