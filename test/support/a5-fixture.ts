// Test support for A5.1: seeds the fixture's PREREQUISITE rows (accounts, show, configs, runs, attempts, claims) into a migrated
// database and builds slice inputs from the shipped Fixture v0.4.6 evidence/rights/package rows. The evidence units, rights
// versions, package artifact, package row and binding are exactly what the A5.1 commands must create, so they are not seeded.
import type pg from "pg";

const must = <T>(v: T | undefined | null): T => {
  if (v === undefined || v === null) throw new Error("missing");
  return v;
};

import { loadFoundationRows } from "../../src/fixture/loader.js";
import { evidencePackageHash } from "../../src/identity/artifacts.js";
import { evidencePackageScopeHash } from "../../src/identity/layer-b.js";
import { families } from "../../src/fixture/families.js";
import type { Json } from "../../src/runtime/command.js";
import {
  persistEvidenceUnit,
  type PersistEvidenceUnitInput,
} from "../../src/runtime/evidence.js";
import type { AuthoredPackage } from "../../src/runtime/package.js";
import type { SliceInput } from "../../src/runtime/slice.js";

type Obj = Record<string, unknown>;
const tables = (): Record<string, Obj[]> =>
  loadFoundationRows().tables as unknown as Record<string, Obj[]>;

export const SEED_ORDER = [
  "accounts",
  "shows",
  "show_config_versions",
  "program_runs",
  "program_run_attempts",
  "claims",
];

export async function seedPrerequisites(migrator: pg.Pool): Promise<void> {
  const t = tables();
  const client = await migrator.connect();
  try {
    await client.query("BEGIN");
    for (const name of SEED_ORDER) {
      const family = families.find((f) => f.table === name);
      if (!family) throw new Error(`no family ${name}`);
      for (const row of t[name] ?? []) {
        const r: Obj = { ...row };
        if (name === "program_run_attempts") {
          r.evidence_package_id = null;
          // two DISTINCT show-config versions exist at creation (attempt immutability is never weakened): the second attempt is
          // bound to the other version
          const second = (t.program_run_attempts ?? [])[1];
          if (second && r.attempt_id === second.attempt_id)
            r.show_config_version_id = otherConfigId(
              t,
              String(r.show_config_version_id),
            );
        }
        const cols = family.columns;
        await client.query(
          `INSERT INTO "${name}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map((_, i) => `$${String(i + 1)}`).join(",")})`,
          cols.map((c) =>
            family.jsonb.includes(c) && r[c] !== null && r[c] !== undefined
              ? JSON.stringify(r[c])
              : r[c],
          ),
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const otherConfigId = (t: Record<string, Obj[]>, not: string): string =>
  String(
    must(
      (t.show_config_versions ?? []).find(
        (c) => String(c.show_config_version_id) !== not,
      ),
    ).show_config_version_id,
  );

/**
 * Inserts the rows a package's support refs resolve to (derivation runs, signal/continuity carrier artifacts) and the claim_supports
 * rows themselves. claim_supports reference evidence units by FK, so the units must already be persisted (by the A5.1 commands).
 */
export async function seedSupports(migrator: pg.Pool): Promise<void> {
  const t = tables();
  const carrierIds = new Set(
    (t.claim_supports ?? [])
      .map(
        (s) =>
          ((s.external_support_identity as string | null) ?? "").split(":")[1],
      )
      .filter((x): x is string => typeof x === "string" && x !== ""),
  );
  const client = await migrator.connect();
  try {
    await client.query("BEGIN");
    const plan: [string, Obj[]][] = [
      ["derivation_runs", t.derivation_runs ?? []],
      [
        "artifacts",
        (t.artifacts ?? []).filter((a) =>
          carrierIds.has(String(a.artifact_id)),
        ),
      ],
      ["claim_supports", t.claim_supports ?? []],
    ];
    for (const [name, rows] of plan) {
      const family = must(families.find((f) => f.table === name));
      for (const r of rows) {
        const cols = family.columns;
        await client.query(
          `INSERT INTO "${name}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map((_, i) => `$${String(i + 1)}`).join(",")})`,
          cols.map((c) =>
            family.jsonb.includes(c) && r[c] !== null && r[c] !== undefined
              ? JSON.stringify(r[c])
              : r[c],
          ),
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export const attemptIds = (): string[] =>
  (tables().program_run_attempts ?? []).map((a) => String(a.attempt_id));
export const claimIds = (): string[] =>
  (tables().claims ?? []).map((c) => String(c.claim_id));
export const accountIds = (): string[] =>
  (tables().accounts ?? []).map((a) => String(a.account_id));

/** The fixture package payload (deep copy). */
export const fixturePackagePayload = (): Obj => {
  const a = (tables().artifacts ?? []).find(
    (x) => x.artifact_type === "evidence_package",
  );
  return structuredClone(must(a).canonical_payload) as Obj;
};
export const fixturePackageArtifact = (): AuthoredPackage => {
  const a = must(
    (tables().artifacts ?? []).find(
      (x) => x.artifact_type === "evidence_package",
    ),
  );
  return {
    artifact_id: String(a.artifact_id),
    evidence_package_id: String(
      (tables().evidence_packages ?? [])[0]?.evidence_package_id,
    ),
    schema_version: String(a.schema_version),
    canonical_payload: structuredClone(a.canonical_payload) as Json,
    storage_uri: (a.storage_uri as string | null) ?? null,
    byte_size: (a.byte_size as number | null) ?? null,
    created_at: String(a.created_at),
  };
};

/** Units in supersession-safe order, each with its rights row and the package entry's governed snapshot. */
export function fixtureUnits(): PersistEvidenceUnitInput[] {
  const t = tables();
  const rights = new Map(
    (t.rights_versions ?? []).map((r) => [String(r.rights_version_id), r]),
  );
  const entries = new Map(
    (fixturePackagePayload().manifest as { evidence: Obj[] }).evidence.map(
      (e) => [String(e.evidence_unit_id), e],
    ),
  );
  const pending = [...(t.evidence_units ?? [])];
  const ordered: Obj[] = [];
  const done = new Set<string>();
  while (pending.length > 0) {
    const i = pending.findIndex(
      (u) =>
        u.supersedes_evidence_unit_id === null ||
        done.has(u.supersedes_evidence_unit_id as string),
    );
    if (i < 0) throw new Error("supersession cycle");
    const [u] = pending.splice(i, 1) as [Obj];
    ordered.push(u);
    done.add(String(u.evidence_unit_id));
  }
  return ordered.map((u) => {
    const r = must(rights.get(String(u.rights_version_id)));
    const e = must(entries.get(String(u.evidence_unit_id)));
    return {
      unit: {
        evidence_unit_id: String(u.evidence_unit_id),
        evidence_type: String(u.evidence_type),
        usage_class: String(u.usage_class),
        canonical_content: String(u.canonical_content),
        content_hash: String(u.content_hash),
        rights_version_id: String(u.rights_version_id),
        supersedes_evidence_unit_id:
          (u.supersedes_evidence_unit_id as string | null) ?? null,
        created_at: String(u.created_at),
      },
      rights: {
        rights_version_id: String(r.rights_version_id),
        source_identity: String(r.source_identity),
        policy: r.policy as Json,
        created_at: String(r.created_at),
      },
      snapshot: {
        evidence_unit_id: String(u.evidence_unit_id),
        acquisition_ref: String(e.acquisition_ref),
        source_identity: String(e.source_identity),
        source_item_identity: String(e.source_item_identity),
        locator: e.locator as Json,
      },
    };
  });
}

export const sliceInput = (attemptIndex = 0): SliceInput => ({
  attemptId: must(attemptIds()[attemptIndex]),
  units: fixtureUnits(),
  pkg: fixturePackageArtifact(),
});

/** A second, valid, different package over the same units: one manifest label changed (a different governed hash), own ids. */
export function alternatePackage(): AuthoredPackage {
  const artifact_id = "d1250005-0000-4000-8000-0000000000a1";
  const evidence_package_id = "d1250004-0000-4000-8000-0000000000a1";
  return rebuildPackage(
    (payload) => {
      const beats = (payload.manifest as { beats: { label: string }[] }).beats;
      if (beats[0]) beats[0].label = "alternate label";
      payload.artifact_id = artifact_id;
      payload.id = evidence_package_id;
    },
    { artifact_id, evidence_package_id },
  );
}

/**
 * A package built from the fixture payload with `mutate` applied to the (deep-copied) artifact payload, with `package_hash` and
 * `scope_hash` recomputed so the mutation under test is the ONLY defect (the hash is not schema validation).
 */
export function rebuildPackage(
  mutate: (payload: Obj) => void,
  artifact: Partial<AuthoredPackage> = {},
): AuthoredPackage {
  const base = fixturePackageArtifact();
  const payload = structuredClone(base.canonical_payload) as Obj;
  mutate(payload);
  payload.package_hash = evidencePackageHash(payload);
  payload.scope_hash = evidencePackageScopeHash(
    (payload.manifest as Obj).scope,
  );
  return { ...base, ...artifact, canonical_payload: payload as Json };
}

/**
 * The state a package is built from in the real order: evidence units (A5.1 commands) -> claims' support rows (another owner; they
 * reference the units) -> package. Used by tests that exercise S2/S3 or the whole slice against a database whose units exist.
 */
export async function prepareUnitsAndSupports(
  migrator: pg.Pool,
  runtime: pg.Pool,
): Promise<void> {
  for (const u of fixtureUnits()) {
    const o = await persistEvidenceUnit(runtime, u);
    if (o.kind !== "created") throw new Error(`unit setup: ${o.kind}`);
  }
  await seedSupports(migrator);
}
