// A5.1 evidence-unit persistence (Evidence Package 24.1, Hashing 12.2).
// Identity is the AUTHORED evidence_unit_id. Same UUID + identical immutable record converges; same UUID with any changed
// immutable datum conflicts; different UUIDs stay distinct even with equal body hashes. There is no ON CONFLICT(content_hash) and no
// body-hash lookup anywhere. The body hash is recomputed (A1 evidenceBodyHash) and must equal the supplied hash.
//
// Provenance limit (named, not hidden): the selected provenance/locator snapshot has NO durable column. Row convergence and snapshot
// verification are therefore reported separately: `snapshot.status` is "verified" only when the snapshot was compared against the
// manifest entry of an EXPLICITLY identified persisted package (by package hash), otherwise "not_supplied" or "unverifiable".
// Only `row_and_snapshot_verified` may be read as the full Evidence 24.1 immutable-request comparison; this tranche does not claim
// full 24.1 completion.
import type { Pool } from "pg";

import { canonicalJson, normalizeString } from "../identity/canonical-json.js";
import { evidenceBodyHash } from "../identity/domains.js";
import {
  assertJson,
  emitPreflight,
  isJsonObject,
  isUnique,
  Rejection,
  requireHex64,
  requireTimestamp,
  requireUuid,
  rethrow,
  runCommand,
  utcText,
  type Json,
  type Outcome,
  type Row,
  type Tx,
} from "./command.js";
import { peek, type CommandContext, type CommandTrace } from "./observe.js";
import { readStoredPackageByHash } from "./package.js";

export interface AuthoredRights {
  rights_version_id: string;
  source_identity: string;
  policy: Json;
  created_at: string;
}
export interface AuthoredEvidenceUnit {
  evidence_unit_id: string;
  evidence_type: string;
  usage_class: string;
  /** The NFC body (stored as a jsonb string). */
  canonical_content: string;
  content_hash: string;
  rights_version_id: string;
  supersedes_evidence_unit_id: string | null;
  created_at: string;
}
/** The governed snapshot fields of a package evidence entry. */
export interface ProvenanceSnapshot {
  evidence_unit_id: string;
  acquisition_ref: string;
  source_identity: string;
  source_item_identity: string;
  locator: Json;
}
export interface PersistEvidenceUnitInput {
  unit: AuthoredEvidenceUnit;
  rights: AuthoredRights;
  snapshot?: ProvenanceSnapshot;
  /** The persisted package (by governed package hash) whose manifest entry the snapshot is compared against. */
  verifySnapshotAgainstPackageHash?: string;
}
export type SnapshotStatus =
  | { status: "not_supplied" }
  | { status: "unverifiable"; reason: string }
  | { status: "verified"; package_hash: string };
export interface StoredEvidenceUnit {
  unit: AuthoredEvidenceUnit;
  rights: AuthoredRights;
  snapshot: SnapshotStatus;
  /** "row_and_snapshot_verified" is the only value that covers the whole 24.1 record; everything else is row-level only. */
  comparison: "row_and_snapshot_verified" | "row_only";
}

const EVIDENCE_TYPES = [
  "fact",
  "quote",
  "observation",
  "analysis",
  "sentiment",
  "texture",
  "rumor",
  "prediction",
  "context",
];
const USAGE_CLASSES = ["assertable", "hedged_only", "silent"];

const unitSelect = (extra = ""): string =>
  `SELECT evidence_unit_id::text, content_hash, evidence_type, usage_class, canonical_content, rights_version_id::text,
          supersedes_evidence_unit_id::text, ${utcText("created_at")} AS created_at${extra} FROM evidence_units`;
const rightsSelect = (extra = ""): string =>
  `SELECT rights_version_id::text, source_identity, policy, ${utcText("created_at")} AS created_at${extra} FROM rights_versions`;

/** Validates the request and returns its NORMALIZED form: the one representation that is compared and stored. */
function validate(raw: PersistEvidenceUnitInput): PersistEvidenceUnitInput {
  const { unit } = raw;
  const rights = raw.rights;
  requireUuid(unit.evidence_unit_id, "evidence_unit_id");
  requireUuid(unit.rights_version_id, "unit.rights_version_id");
  requireUuid(rights.rights_version_id, "rights.rights_version_id");
  if (unit.supersedes_evidence_unit_id !== null)
    requireUuid(
      unit.supersedes_evidence_unit_id,
      "supersedes_evidence_unit_id",
    );
  if (unit.supersedes_evidence_unit_id === unit.evidence_unit_id)
    throw new Rejection("self_supersession");
  if (unit.rights_version_id !== rights.rights_version_id)
    throw new Rejection(
      "unit_rights_identity_mismatch",
      "the unit names a rights version other than the supplied rights record",
    );
  if (!EVIDENCE_TYPES.includes(unit.evidence_type))
    throw new Rejection("invalid_evidence_type");
  if (!USAGE_CLASSES.includes(unit.usage_class))
    throw new Rejection("invalid_usage_class");
  if (typeof unit.canonical_content !== "string")
    throw new Rejection("invalid_body");
  if (normalizeString(unit.canonical_content) !== unit.canonical_content)
    throw new Rejection("body_not_nfc");
  requireHex64(unit.content_hash, "content_hash");
  if (evidenceBodyHash(unit.canonical_content) !== unit.content_hash)
    throw new Rejection("body_hash_mismatch");
  requireTimestamp(unit.created_at, "unit.created_at");
  requireTimestamp(rights.created_at, "rights.created_at");
  if (
    typeof rights.source_identity !== "string" ||
    rights.source_identity === ""
  )
    throw new Rejection("invalid_source_identity");
  const policy = assertJson(rights.policy, "rights.policy");
  if (!isJsonObject(policy))
    throw new Rejection(
      "rights_policy_not_object",
      "a rights policy is a JSON object",
    );
  const input: PersistEvidenceUnitInput = {
    ...raw,
    rights: { ...rights, policy },
    ...(raw.snapshot
      ? {
          snapshot: {
            ...raw.snapshot,
            locator: assertJson(raw.snapshot.locator, "snapshot.locator"),
          },
        }
      : {}),
  };
  const s = input.snapshot;
  if (s) {
    if (s.evidence_unit_id !== unit.evidence_unit_id)
      throw new Rejection("snapshot_unit_mismatch");
    for (const k of [
      "acquisition_ref",
      "source_identity",
      "source_item_identity",
    ] as const)
      if (typeof s[k] !== "string" || s[k] === "")
        throw new Rejection("invalid_snapshot", k);
    const covered = policy.covered_source_identities;
    if (!Array.isArray(covered) || !covered.includes(s.source_identity))
      throw new Rejection(
        "snapshot_source_not_covered_by_rights",
        s.source_identity,
      );
  }
  if (input.verifySnapshotAgainstPackageHash !== undefined) {
    requireHex64(input.verifySnapshotAgainstPackageHash, "package hash");
    if (!s) throw new Rejection("snapshot_required_for_verification");
  }
  return input;
}

export async function rightsDifference(
  tx: Tx,
  rights: AuthoredRights,
): Promise<{ found: boolean; differs: string[] }> {
  const r = await tx.query(
    `${rightsSelect(`, (source_identity = $2) AS same_source, (policy = $3::jsonb) AS same_policy,
       (created_at = $4::timestamptz) AS same_time`)} WHERE rights_version_id = $1::uuid`,
    [
      rights.rights_version_id,
      rights.source_identity,
      JSON.stringify(rights.policy),
      rights.created_at,
    ],
  );
  const row = r.rows[0];
  if (!row) return { found: false, differs: [] };
  return {
    found: true,
    differs: [
      row.same_source !== true && "rights_source_identity",
      row.same_policy !== true && "rights_policy",
      row.same_time !== true && "rights_created_at",
    ].filter((x): x is string => typeof x === "string"),
  };
}

function storedRights(row: Row): AuthoredRights {
  return {
    rights_version_id: row.rights_version_id as string,
    source_identity: row.source_identity as string,
    policy: row.policy as Json,
    created_at: row.created_at as string,
  };
}
const storedUnit = (row: Row): AuthoredEvidenceUnit => ({
  evidence_unit_id: row.evidence_unit_id as string,
  evidence_type: row.evidence_type as string,
  usage_class: row.usage_class as string,
  canonical_content: row.canonical_content as string,
  content_hash: row.content_hash as string,
  rights_version_id: row.rights_version_id as string,
  supersedes_evidence_unit_id: row.supersedes_evidence_unit_id as string | null,
  created_at: row.created_at as string,
});

/** Compares an existing unit row with the request; returns the first differing field (governed order) or undefined. */
export async function unitDifference(
  tx: Tx,
  u: AuthoredEvidenceUnit,
): Promise<{ found: false } | { found: true; code?: string; row: Row }> {
  const r = await tx.query(
    `${unitSelect(`, (content_hash = $2) AS same_hash, (evidence_type = $3) AS same_type, (usage_class = $4) AS same_usage,
       (canonical_content = to_jsonb($5::text)) AS same_body, (rights_version_id = $6::uuid) AS same_rights,
       (supersedes_evidence_unit_id IS NOT DISTINCT FROM $7::uuid) AS same_supersession,
       (created_at = $8::timestamptz) AS same_time`)} WHERE evidence_unit_id = $1::uuid`,
    [
      u.evidence_unit_id,
      u.content_hash,
      u.evidence_type,
      u.usage_class,
      u.canonical_content,
      u.rights_version_id,
      u.supersedes_evidence_unit_id,
      u.created_at,
    ],
  );
  const row = r.rows[0];
  if (!row) return { found: false };
  const order: [string, string][] = [
    ["same_hash", "body_hash"],
    ["same_body", "content"],
    ["same_type", "evidence_type"],
    ["same_usage", "usage_class"],
    ["same_rights", "rights"],
    ["same_supersession", "supersession"],
    ["same_time", "created_at"],
  ];
  const first = order.find(([k]) => row[k] !== true);
  return first ? { found: true, code: first[1], row } : { found: true, row };
}

export async function persistEvidenceUnit(
  pool: Pool,
  raw: PersistEvidenceUnitInput,
  context?: CommandContext,
): Promise<Outcome<StoredEvidenceUnit>> {
  const trace: CommandTrace | undefined = context && {
    context,
    command: "evidence_unit.persist",
    subject: {
      evidence_unit_id: peek(() => raw.unit.evidence_unit_id),
      rights_version_id: peek(() => raw.unit.rights_version_id),
    },
  };
  let input: PersistEvidenceUnitInput;
  try {
    input = validate(raw);
  } catch (error) {
    if (error instanceof Rejection) {
      emitPreflight(trace, error.code);
      return { kind: "rejected", code: error.code, detail: error.message };
    }
    throw error;
  }
  const { unit, rights } = input;
  return runCommand(
    pool,
    async (tx) => {
      let existing = await unitDifference(tx, unit);
      let created = false;
      if (!existing.found) {
        // Rights first (same authored-UUID rule); every insert in a savepoint. A conflict/rejection ROLLS BACK this transaction, so
        // an incidental rights row is never committed by a command that did not succeed.
        const rr = await rightsDifference(tx, rights);
        if (rr.found && rr.differs.length > 0)
          return {
            kind: "conflict",
            code: "rights",
            stored: null,
            detail: rr.differs.join(","),
          };
        if (!rr.found) {
          const ins = await tx.attempt(
            `INSERT INTO rights_versions (rights_version_id, source_identity, policy, created_at) VALUES ($1::uuid, $2, $3::jsonb, $4::timestamptz)`,
            [
              rights.rights_version_id,
              rights.source_identity,
              JSON.stringify(rights.policy),
              rights.created_at,
            ],
          );
          if (!ins.ok) {
            if (!isUnique(ins.error, "rights_versions_pkey"))
              rethrow(ins.error);
            const again = await rightsDifference(tx, rights);
            if (again.differs.length > 0)
              return {
                kind: "conflict",
                code: "rights",
                stored: null,
                detail: again.differs.join(","),
              };
          }
        }
        const ins = await tx.attempt(
          `INSERT INTO evidence_units (evidence_unit_id, content_hash, evidence_type, usage_class, canonical_content, rights_version_id, supersedes_evidence_unit_id, created_at)
         VALUES ($1::uuid, $2, $3, $4, to_jsonb($5::text), $6::uuid, $7::uuid, $8::timestamptz)`,
          [
            unit.evidence_unit_id,
            unit.content_hash,
            unit.evidence_type,
            unit.usage_class,
            unit.canonical_content,
            unit.rights_version_id,
            unit.supersedes_evidence_unit_id,
            unit.created_at,
          ],
        );
        if (ins.ok) created = true;
        else if (isUnique(ins.error, "evidence_units_pkey")) {
          // Another worker won between the lookup and the insert; the savepoint is rolled back, so the winner is now visible.
          existing = await unitDifference(tx, unit);
          if (!existing.found)
            throw new Error("winner row not visible after unique violation");
        } else if (ins.error.code === "23503")
          return {
            kind: "rejected",
            code: "supersedes_unit_not_found",
            sqlstate: "23503",
          };
        else rethrow(ins.error);
      }
      if (!created && existing.found && existing.code)
        return {
          kind: "conflict",
          code: existing.code,
          stored: storedUnit(existing.row),
          detail: `evidence unit ${unit.evidence_unit_id} differs in ${existing.code}`,
        };
      if (!created) {
        const rr = await rightsDifference(tx, rights);
        if (!rr.found || rr.differs.length > 0)
          return {
            kind: "conflict",
            code: "rights",
            stored: null,
            detail: rr.differs.join(",") || "rights row missing",
          };
      }
      const snapshot = await snapshotStatus(tx, input);
      if (snapshot instanceof Object && "conflict" in snapshot)
        return {
          kind: "conflict",
          code: "provenance_snapshot",
          stored: null,
          detail: snapshot.conflict,
        };
      const u = await tx.query(
        `${unitSelect()} WHERE evidence_unit_id = $1::uuid`,
        [unit.evidence_unit_id],
      );
      const rg = await tx.query(
        `${rightsSelect()} WHERE rights_version_id = $1::uuid`,
        [unit.rights_version_id],
      );
      const urow = u.rows[0];
      const rrow = rg.rows[0];
      if (!urow || !rrow) throw new Error("stored rows missing after command");
      const record: StoredEvidenceUnit = {
        unit: storedUnit(urow),
        rights: storedRights(rrow),
        snapshot,
        comparison:
          snapshot.status === "verified"
            ? "row_and_snapshot_verified"
            : "row_only",
      };
      return { kind: created ? "created" : "converged", record };
    },
    trace,
  );
}

async function snapshotStatus(
  tx: Tx,
  input: PersistEvidenceUnitInput,
): Promise<SnapshotStatus | { conflict: string }> {
  const s = input.snapshot;
  if (!s) return { status: "not_supplied" };
  const hash = input.verifySnapshotAgainstPackageHash;
  if (hash === undefined)
    return {
      status: "unverifiable",
      reason: "no_durable_snapshot_column_and_no_package_identified",
    };
  return compareSnapshotToPackage(tx, s, hash);
}

/**
 * Compares a supplied governed snapshot with the manifest entry of the persisted package identified by its governed hash.
 * Read-only. `unverifiable` when that package is not persisted; a disagreement is reported as `{ conflict }`.
 */
export async function compareSnapshotToPackage(
  tx: Pick<Tx, "query">,
  s: ProvenanceSnapshot,
  hash: string,
): Promise<SnapshotStatus | { conflict: string }> {
  const stored = await readStoredPackageByHash(tx, hash);
  if (stored.state === "absent")
    return {
      status: "unverifiable",
      reason: "identified_package_not_persisted",
    };
  if (stored.state === "invalid")
    return {
      status: "unverifiable",
      reason: `identified_package_invalid: ${stored.detail}`,
    };
  const entries = stored.parsed.evidence.filter(
    (e) => e.evidence_unit_id === s.evidence_unit_id,
  );
  const [e] = entries;
  if (!e) throw new Rejection("snapshot_unit_not_in_identified_package");
  if (entries.length > 1) throw new Rejection("package_evidence_ambiguous");
  // the validated, normalized entry: exact text for the identities, canonical value equality for the locator
  const differs = [
    e.raw.acquisition_ref !== s.acquisition_ref && "acquisition_ref",
    e.raw.source_identity !== s.source_identity && "source_identity",
    e.raw.source_item_identity !== s.source_item_identity &&
      "source_item_identity",
    canonicalJson(e.locator) !== canonicalJson(s.locator) && "locator",
  ].filter(Boolean);
  if (differs.length > 0)
    return { conflict: `snapshot differs in ${differs.join(",")}` };
  return { status: "verified", package_hash: hash };
}
