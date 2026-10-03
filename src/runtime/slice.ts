// A5.1 bounded workflow slice: S1 evidence units -> S2 evidence package -> S3 attempt binding.
// This is ONE bounded slice over three convergent commands; it does not complete Completion A. The checkpoints are the committed
// rows themselves; re-entry after a crash or a lost acknowledgement is "run the slice again": finished steps converge and the first
// unfinished step proceeds. A changed input at any step is a conflict and stops the slice. The attempt is a PRECONDITION (an existing
// PENDING attempt). The actual unfinished coverage is named in docs/a5-1-durable-commands.md: provider reservation/outcome and the
// duplicate-paid-work guard (Done-when 10, A5.2), run/attempt creation and lifecycle transitions, and the Build 2 path after binding.
import type { Pool } from "pg";

import { canonicalJson } from "../identity/canonical-json.js";
import {
  faultPoint,
  Rejection,
  requireUuid,
  type Outcome,
  type Tx,
} from "./command.js";
import {
  compareSnapshotToPackage,
  persistEvidenceUnit,
  rightsDifference,
  unitDifference,
  type PersistEvidenceUnitInput,
} from "./evidence.js";
import {
  peek,
  readContext,
  readAttemptRun,
  safeEmit,
  stageContext,
  type AttemptRun,
  type ObserverContext,
} from "./observe.js";
import {
  bindPackage,
  parsePackage,
  persistEvidencePackage,
  readStoredPackageByHash,
  type AuthoredPackage,
} from "./package.js";

export interface SliceInput {
  attemptId: string;
  units: PersistEvidenceUnitInput[];
  pkg: AuthoredPackage;
}
export interface StepResult {
  step:
    | "S1_evidence_unit"
    | "S2_evidence_package"
    | "S2_snapshot_verification"
    | "S3_binding";
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
  /**
   * `verified`: every supplied governed snapshot was durably compared against the persisted package (by its governed hash).
   * `not_supplied`: no unit carried a snapshot (row-only; no claim of full Evidence 24.1 provenance verification).
   * `partial`: some units carried none.
   */
  snapshotVerification?: "verified" | "not_supplied" | "partial";
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

function preflight(input: SliceInput): {
  unitIds: string[];
  packageHash: string;
} {
  requireUuid(input.attemptId, "attemptId");
  const parsed = parsePackage(input.pkg);
  const unitIds = input.units.map((u) => u.unit.evidence_unit_id);
  if (new Set(unitIds).size !== unitIds.length)
    throw new Rejection("slice_unit_duplicate");
  const entries = new Map(parsed.evidence.map((e) => [e.evidence_unit_id, e]));
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
    // a supplied governed snapshot must agree with THIS supplied package's entry (before anything is written)
    const snap = u.snapshot;
    if (
      snap &&
      (snap.acquisition_ref !== e.raw.acquisition_ref ||
        snap.source_identity !== e.raw.source_identity ||
        snap.source_item_identity !== e.raw.source_item_identity ||
        canonicalJson(snap.locator) !== canonicalJson(e.locator))
    )
      throw new Rejection(
        "slice_snapshot_package_entry_mismatch",
        u.unit.evidence_unit_id,
      );
  }
  return { unitIds, packageHash: parsed.hash };
}

/**
 * Observed workflow entry point. `context` is REQUIRED and validated at runtime (a declared correlation id and observer; the observer
 * may still be a no-op, so this proves a declared context, not that logs are produced). The run id is DERIVED from the attempt row.
 * Every step's command emits its own event (with its own durability); this function adds ONE `workflow.completed` event carrying fixed
 * COUNTS and the stopping step: no unbounded list, no subjects, no codes outside the known set.
 */
export async function runEvidenceSlice(
  pool: Pool,
  input: SliceInput,
  context: ObserverContext,
): Promise<SliceResult> {
  const rc = readContext(context);
  if (!rc.ok) {
    const stopped: StepResult = {
      step: "S1_evidence_unit",
      subject: "context",
      outcome: "rejected",
      code: "observer_context_invalid",
    };
    return { complete: false, steps: [stopped], stoppedAt: stopped };
  }
  const base = rc.context; // a plain snapshot: no property of the caller's object is read again
  const startedAt = performance.now();
  const attemptRaw = peek(() => input.attemptId);
  const attemptId = typeof attemptRaw === "string" ? attemptRaw : undefined;
  const run = await readAttemptRun(pool, attemptId);
  const emit = (facts: Record<string, unknown>): void => {
    safeEmit(() => {
      // fixed workflow-level stage: it does not claim the slice stopped at S1 (the stopping step is its own field)
      const c = stageContext(base, "evidence_slice", attemptId, run);
      return {
        observer: base.observer,
        event: {
          event: "workflow.completed",
          workflow: "evidence_slice.run",
          stage: c.stage,
          correlation_id: c.correlationId,
          run_id: c.runId,
          run_id_status: c.runIdStatus,
          attempt_id: c.attemptId,
          duration_ms: performance.now() - startedAt,
          ...facts,
        },
      };
    });
  };
  let result: SliceResult;
  try {
    result = await sliceCore(pool, input, base, attemptId, run);
  } catch (error) {
    emit({
      outcome: "error",
      error_class: error instanceof Rejection ? "Rejection" : "unclassified",
    });
    throw error;
  }
  const count = (k: string): number =>
    result.steps.filter((x) => x.outcome === k).length;
  emit({
    status: result.complete ? "complete" : "stopped",
    complete: result.complete,
    steps_total: result.steps.length,
    steps_created: count("created"),
    steps_converged: count("converged"),
    steps_held_by_other: count("held_by_other"),
    steps_conflict: count("conflict"),
    steps_rejected: count("rejected"),
    ...(result.stoppedAt
      ? {
          stopped_step: result.stoppedAt.step,
          stopped_outcome: result.stoppedAt.outcome,
          stopped_code: result.stoppedAt.code,
        }
      : {}),
  });
  return result;
}

async function sliceCore(
  pool: Pool,
  input: SliceInput,
  base: ObserverContext,
  attemptId: string | undefined,
  run: AttemptRun | undefined,
): Promise<SliceResult> {
  const ctx = (
    stage: "S1_evidence_unit" | "S2_evidence_package" | "S3_binding",
  ) => stageContext(base, stage, attemptId, run);
  const steps: StepResult[] = [];
  let unitIds: string[];
  let packageHash: string;
  try {
    ({ unitIds, packageHash } = preflight(input));
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
    const o = await persistEvidenceUnit(
      pool,
      {
        ...u,
        ...(u.snapshot
          ? { verifySnapshotAgainstPackageHash: packageHash }
          : {}),
      },
      ctx("S1_evidence_unit"),
    );
    const s = record("S1_evidence_unit", u.unit.evidence_unit_id, o);
    steps.push(s);
    if (o.kind !== "created" && o.kind !== "converged") return stop(s);
  }
  await faultPoint("after_s1");
  const pk = await persistEvidencePackage(pool, input.pkg, {
    expectedUnitIds: unitIds,
    context: ctx("S2_evidence_package"),
  });
  const s2 = record("S2_evidence_package", input.pkg.artifact_id, pk);
  steps.push(s2);
  if (pk.kind !== "created" && pk.kind !== "converged") return stop(s2);
  // The package is now durable: verify every supplied snapshot against ITS governed hash (also on re-entry).
  const supplied = input.units.filter((u) => u.snapshot);
  for (const u of supplied) {
    const snap = u.snapshot;
    if (!snap) continue;
    const v = await compareSnapshotToPackage(
      { query: (t, p) => pool.query(t, p) },
      snap,
      packageHash,
    );
    const ok = "status" in v && v.status === "verified";
    const sv: StepResult = {
      step: "S2_snapshot_verification",
      subject: u.unit.evidence_unit_id,
      outcome: ok ? "converged" : "conflict",
      ...(ok
        ? {}
        : {
            code:
              "conflict" in v ? "provenance_snapshot" : "snapshot_unverified",
          }),
    };
    steps.push(sv);
    if (!ok) return stop(sv);
  }
  await faultPoint("after_package_commit");
  // Bind the STORED package id (a package reused by hash keeps its original ids).
  const bound = await bindPackage(pool, {
    attemptId: input.attemptId,
    evidencePackageId: pk.record.evidence_package_id,
    expectedUnitIds: unitIds,
    context: ctx("S3_binding"),
  });
  const s3 = record("S3_binding", input.attemptId, bound);
  steps.push(s3);
  if (bound.kind !== "created" && bound.kind !== "converged") return stop(s3);
  await faultPoint("after_bind_commit");
  return {
    complete: true,
    steps,
    evidencePackageId: pk.record.evidence_package_id,
    snapshotVerification:
      supplied.length === 0
        ? "not_supplied"
        : supplied.length === input.units.length
          ? "verified"
          : "partial",
  };
}

export interface SliceStatus {
  units: Record<string, "identical" | "missing" | "differs">;
  package:
    | "persisted_by_hash"
    | "absent"
    | "manifest_differs"
    | "stored_invalid";
  binding:
    | "bound_to_package"
    | "unbound"
    | "bound_to_other"
    | "attempt_missing";
  /** Per unit: the supplied snapshot against the persisted package identified by the supplied package's governed hash. */
  snapshots: Record<
    string,
    "verified" | "unverifiable" | "conflict" | "not_supplied"
  >;
  complete: boolean;
}

/** Read-only derivation of completion from the committed rows (no write, no lock). */
export async function evidenceSliceStatus(
  pool: Pool,
  input: SliceInput,
): Promise<SliceStatus> {
  const { packageHash } = preflight(input);
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
  const snapshots: SliceStatus["snapshots"] = {};
  for (const u of input.units) {
    if (!u.snapshot) {
      snapshots[u.unit.evidence_unit_id] = "not_supplied";
      continue;
    }
    const v = await compareSnapshotToPackage(tx, u.snapshot, packageHash);
    snapshots[u.unit.evidence_unit_id] =
      "conflict" in v
        ? "conflict"
        : v.status === "verified"
          ? "verified"
          : "unverifiable";
  }
  const parsed = parsePackage(input.pkg);
  // the package identified by the supplied package's governed hash, validated AS STORED (never completed from a manifest match alone)
  const stored = await readStoredPackageByHash(tx, parsed.hash);
  const pkgState: SliceStatus["package"] =
    stored.state === "absent"
      ? "absent"
      : stored.state === "invalid"
        ? "stored_invalid"
        : canonicalJson(stored.parsed.manifest) ===
            canonicalJson(parsed.manifest)
          ? "persisted_by_hash"
          : "manifest_differs";
  const prow =
    stored.state === "valid" ? { id: stored.evidence_package_id } : undefined;
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
    snapshots,
    complete:
      Object.values(units).every((s) => s === "identical") &&
      Object.values(snapshots).every(
        (s) => s === "verified" || s === "not_supplied",
      ) &&
      pkgState === "persisted_by_hash" &&
      binding === "bound_to_package",
  };
}
