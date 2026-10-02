// A5.1 bounded workflow slice: S1 evidence units -> S2 evidence package -> S3 attempt binding.
// This is ONE slice over three convergent commands, NOT the minimal durable workflow/command runner: there is no scheduler, step
// registry or generic checkpoint store. The checkpoints are the committed rows themselves; re-entry after a crash or a lost
// acknowledgement is "run the slice again": finished steps converge and the first unfinished step proceeds. A changed input at any
// step is a conflict and stops the slice. The attempt is a PRECONDITION (an existing PENDING attempt); run/attempt creation,
// lifecycle transitions, READY, gates and provider work are not part of it.
import type { Pool } from "pg";

import {
  faultPoint,
  Rejection,
  requireUuid,
  type Outcome,
  type Tx,
} from "./command.js";
import {
  persistEvidenceUnit,
  rightsDifference,
  unitDifference,
  type PersistEvidenceUnitInput,
} from "./evidence.js";
import {
  bindPackage,
  parsePackage,
  persistEvidencePackage,
  type AuthoredPackage,
} from "./package.js";

export interface SliceInput {
  attemptId: string;
  units: PersistEvidenceUnitInput[];
  pkg: AuthoredPackage;
}
export interface StepResult {
  step: "S1_evidence_unit" | "S2_evidence_package" | "S3_binding";
  subject: string;
  outcome: Outcome<unknown>["kind"];
  code?: string;
}
export interface SliceResult {
  complete: boolean;
  steps: StepResult[];
  /** The step that stopped the slice (conflict/rejected), if any. */
  stoppedAt?: StepResult;
  evidencePackageId?: string;
}

const record = (
  step: StepResult["step"],
  subject: string,
  o: Outcome<unknown>,
): StepResult => ({
  step,
  subject,
  outcome: o.kind,
  ...("code" in o ? { code: o.code } : {}),
});

function preflight(input: SliceInput): string[] {
  requireUuid(input.attemptId, "attemptId");
  const parsed = parsePackage(input.pkg);
  const unitIds = input.units.map((u) => u.unit.evidence_unit_id);
  if (new Set(unitIds).size !== unitIds.length)
    throw new Rejection("slice_unit_duplicate");
  const entries = new Map(
    parsed.evidence.map((e) => [e.evidence_unit_id as string, e]),
  );
  if ([...unitIds].sort().join() !== [...entries.keys()].sort().join())
    throw new Rejection(
      "slice_units_package_mismatch",
      "the package's evidence set is not the slice's unit set",
    );
  for (const u of input.units) {
    const e = entries.get(u.unit.evidence_unit_id);
    if (
      e?.content_hash !== u.unit.content_hash ||
      e.evidence_type !== u.unit.evidence_type ||
      e.rights_version_id !== u.unit.rights_version_id
    )
      throw new Rejection(
        "slice_unit_package_entry_mismatch",
        u.unit.evidence_unit_id,
      );
  }
  return unitIds;
}

export async function runEvidenceSlice(
  pool: Pool,
  input: SliceInput,
): Promise<SliceResult> {
  const steps: StepResult[] = [];
  let unitIds: string[];
  try {
    unitIds = preflight(input);
  } catch (error) {
    if (error instanceof Rejection) {
      const stopped: StepResult = {
        step: "S1_evidence_unit",
        subject: "preflight",
        outcome: "rejected",
        code: error.code,
      };
      return { complete: false, steps: [stopped], stoppedAt: stopped };
    }
    throw error;
  }
  const stop = (s: StepResult): SliceResult => ({
    complete: false,
    steps,
    stoppedAt: s,
  });
  for (const u of input.units) {
    const o = await persistEvidenceUnit(pool, u);
    const s = record("S1_evidence_unit", u.unit.evidence_unit_id, o);
    steps.push(s);
    if (o.kind !== "created" && o.kind !== "converged") return stop(s);
  }
  await faultPoint("after_s1");
  const pk = await persistEvidencePackage(pool, input.pkg, {
    expectedUnitIds: unitIds,
  });
  const s2 = record("S2_evidence_package", input.pkg.artifact_id, pk);
  steps.push(s2);
  if (pk.kind !== "created" && pk.kind !== "converged") return stop(s2);
  await faultPoint("after_package_commit");
  // Bind the STORED package id (a package reused by hash keeps its original ids).
  const bound = await bindPackage(pool, {
    attemptId: input.attemptId,
    evidencePackageId: pk.record.evidence_package_id,
    expectedUnitIds: unitIds,
  });
  const s3 = record("S3_binding", input.attemptId, bound);
  steps.push(s3);
  if (bound.kind !== "created" && bound.kind !== "converged") return stop(s3);
  await faultPoint("after_bind_commit");
  return {
    complete: true,
    steps,
    evidencePackageId: pk.record.evidence_package_id,
  };
}

export interface SliceStatus {
  units: Record<string, "identical" | "missing" | "differs">;
  package: "persisted_by_hash" | "absent" | "manifest_differs";
  binding:
    | "bound_to_package"
    | "unbound"
    | "bound_to_other"
    | "attempt_missing";
  complete: boolean;
}

/** Read-only derivation of completion from the committed rows (no write, no lock). */
export async function evidenceSliceStatus(
  pool: Pool,
  input: SliceInput,
): Promise<SliceStatus> {
  preflight(input);
  const tx: Pick<Tx, "query"> = { query: (t, v) => pool.query(t, v) };
  const units: SliceStatus["units"] = {};
  for (const u of input.units) {
    const d = await unitDifference(tx as Tx, u.unit);
    const r = await rightsDifference(tx as Tx, u.rights);
    units[u.unit.evidence_unit_id] = !d.found
      ? "missing"
      : d.code || !r.found || r.differs.length > 0
        ? "differs"
        : "identical";
  }
  const parsed = parsePackage(input.pkg);
  const pk = await pool.query(
    `SELECT p.evidence_package_id::text AS id, (a.canonical_payload #> '{manifest}' = $2::jsonb) AS same
       FROM evidence_packages p JOIN artifacts a ON a.artifact_id = p.artifact_id WHERE p.package_hash = $1`,
    [parsed.hash, JSON.stringify(parsed.manifest)],
  );
  const prow = pk.rows[0] as { id: string; same: boolean } | undefined;
  const pkgState: SliceStatus["package"] = !prow
    ? "absent"
    : prow.same
      ? "persisted_by_hash"
      : "manifest_differs";
  const at = await pool.query(
    "SELECT evidence_package_id::text AS bound FROM program_run_attempts WHERE attempt_id = $1::uuid",
    [input.attemptId],
  );
  const arow = at.rows[0] as { bound: string | null } | undefined;
  const binding: SliceStatus["binding"] = !arow
    ? "attempt_missing"
    : arow.bound === null
      ? "unbound"
      : arow.bound === prow?.id
        ? "bound_to_package"
        : "bound_to_other";
  return {
    units,
    package: pkgState,
    binding,
    complete:
      Object.values(units).every((s) => s === "identical") &&
      pkgState === "persisted_by_hash" &&
      binding === "bound_to_package",
  };
}
