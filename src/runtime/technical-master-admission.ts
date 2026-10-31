/** Complete test-policy admission for captured fixed fixtures; never a durable gate or lifecycle transition. */
import { canonicalJson, domainHash } from "../identity/canonical-json.js";
import { deepFreeze } from "../fixture/rows.js";
import {
  acquireSubject,
  assertAcquired,
  type Acquired,
} from "./technical-master-acquisition.js";
import { inspectMaster } from "./technical-master-inspection.js";
import {
  capture,
  object,
  keys,
  demand,
  TechnicalRefusal,
  checkPolicy,
  measureSubject,
  checkDuration,
  checkMap,
  identities,
  checkDecode,
  parseLoudness,
  checkLoudness,
  checkSilence,
  type Subject,
  type Data,
  type Phase,
  type Code,
} from "./technical-master-checks.js";

const PROFILE = "technical-master-admission/1";
let inFlight = false;
const retainedCaptures = new WeakSet<object>();
export interface RetainedTechnicalMaster {
  readonly acquired: Acquired;
  readonly observation: Readonly<Data>;
  recheck(): Promise<void>;
  release(): Promise<void>;
}
/** Internal writer ownership, never acceptance of a caller-built pass or bytes. */
export function assertRetainedTechnicalMaster(
  value: RetainedTechnicalMaster,
): void {
  demand(retainedCaptures.has(value), "source_identity_invalid", "source");
}
const nonClearance = {
  authoritative_gate_result: false,
  lifecycle_validated: false,
  persisted: false,
  ready: false,
  production: false,
  semantic: false,
  provider: false,
  selection: false,
} as const;
type CheckName =
  | "format"
  | "duration"
  | "map_inputs"
  | "decode"
  | "loudness"
  | "silence"
  | "freshness";
type CheckState = "pass" | "fail" | "not_run";
interface ResultBasis {
  profile: typeof PROFILE;
  candidate_scope: Subject["scope"];
  input_fingerprint: string | null;
  subject_basis: "captured_snapshots";
  snapshot_lifetime: "evaluation_only";
  authority: "none";
  synthetic_only: true;
  non_clearance: typeof nonClearance;
}
export type TechnicalMasterResult = Readonly<
  ResultBasis &
    (
      | {
          status: "synthetic_technical_policy_pass";
          cleanup: "complete";
          checks: Readonly<Record<CheckName, CheckState>>;
          measurements: Readonly<Data>;
        }
      | {
          status: "refused";
          code: Code;
          phase: Phase;
          cleanup: "not_started" | "complete" | "pending";
          checks: Readonly<Record<CheckName, CheckState>>;
        }
    )
>;
function settings(): boolean {
  return (
    process.env.DESK_ENV === "test" &&
    process.env.PROVIDERS_ENABLED === "false" &&
    process.env.GENERATION_KILL_SWITCH === "true"
  );
}
/**
 * Acquires only the two declared fixture subjects, inspects actual PCM in the pinned runtime and applies every test predicate.
 * The result describes captured snapshots only. No caller file/policy/runner is accepted; later use requires fresh readback.
 */
export async function evaluateTechnicalMaster(
  input: unknown,
): Promise<TechnicalMasterResult> {
  const result = await evaluateOwned(input, false);
  if ("acquired" in result) throw new Error("unexpected retained assessment");
  return result;
}

/** Fixed positive-only acquisition for the private durable writer; retains the existing latch until release. */
export async function retainAssessedSyntheticMaster(
  acquired: Acquired,
): Promise<RetainedTechnicalMaster> {
  assertAcquired(acquired);
  demand(
    acquired.subject.scope === "synthetic60-positive",
    "source_identity_invalid",
    "source",
  );
  const result = await evaluateOwned(
    {
      profile: PROFILE,
      candidate_scope: "synthetic60-positive",
      purpose: "evaluation",
      environment: "test",
    },
    true,
    acquired,
  );
  if (!("acquired" in result)) {
    if (result.status === "refused")
      throw new TechnicalRefusal(
        result.code,
        result.phase,
        result.cleanup === "pending",
      );
    throw new TechnicalRefusal("inspection_failed", "inspection");
  }
  return result;
}

async function evaluateOwned(
  input: unknown,
  retainCapture: boolean,
  provided?: Acquired,
): Promise<TechnicalMasterResult | RetainedTechnicalMaster> {
  let scope: Subject["scope"] = "synthetic60-positive";
  const checks: Record<CheckName, CheckState> = {
    format: "not_run",
    duration: "not_run",
    map_inputs: "not_run",
    decode: "not_run",
    loudness: "not_run",
    silence: "not_run",
    freshness: "not_run",
  };
  let phase: Phase = "invocation";
  let acquired: Acquired | undefined;
  let inputFingerprint: string | null = null;
  let holdsLatch = false;
  let primary: unknown;
  let cleanupPending = false;
  let measurements: Data | undefined;
  let retained = false;
  try {
    let invocation: Data;
    try {
      invocation = object(capture(input));
    } catch {
      throw new TechnicalRefusal("invalid_invocation", "invocation");
    }
    keys(
      invocation,
      ["profile", "candidate_scope", "purpose", "environment"],
      "invalid_invocation",
    );
    demand(
      invocation.profile === PROFILE &&
        invocation.purpose === "evaluation" &&
        invocation.environment === "test" &&
        (invocation.candidate_scope === "synthetic60-positive" ||
          invocation.candidate_scope === "frozen046-negative"),
      "invalid_invocation",
      phase,
    );
    scope = invocation.candidate_scope;
    demand(settings(), "unsafe_settings", phase);
    if (inFlight)
      throw new TechnicalRefusal("cleanup_pending", "cleanup", true);
    inFlight = true;
    holdsLatch = true;
    phase = "source";
    acquired = provided ?? (await acquireSubject(scope));
    const subject = acquired.subject;
    checkPolicy(subject);
    phase = "format";
    const measured = measureSubject(subject);
    checks.format = "pass";
    phase = "duration";
    checkDuration(subject, measured.frames);
    checks.duration = "pass";
    phase = "map_inputs";
    checkMap(subject, measured.frames);
    checks.map_inputs = "pass";
    const projection = identities(subject);
    inputFingerprint = domainHash(
      "technical-master-validation-input-v1",
      projection,
    );
    phase = "inspection";
    const observed = await inspectMaster(acquired);
    const decoded = checkDecode(
      observed.stdout,
      observed.hashFile,
      subject.master.subarray(44),
    );
    checks.decode = "pass";
    phase = "loudness";
    const loudness = parseLoudness(observed.stderr);
    checkLoudness(subject.policy, loudness);
    checks.loudness = "pass";
    phase = "silence";
    const silence = checkSilence(subject);
    checks.silence = "pass";
    phase = "freshness";
    await acquired.recheck();
    demand(
      canonicalJson(identities(subject)) === canonicalJson(projection),
      "fingerprint_changed",
      phase,
    );
    demand(settings(), "unsafe_settings", phase);
    checks.freshness = "pass";
    measurements = {
      master_sha256: measured.hash,
      master_bytes: String(measured.bytes),
      master_frames: String(measured.frames),
      decoded_pcm_sha256: decoded.hash,
      decoded_bytes: decoded.bytes,
      decoded_frames: decoded.frames,
      integrated_decilufs: String(loudness),
      longest_unexplained_frames: silence.frames,
      longest_unexplained_span: silence.span,
    };
    retained = retainCapture;
  } catch (error) {
    primary = error;
    cleanupPending = error instanceof TechnicalRefusal && error.cleanupPending;
    if (
      phase === "format" ||
      phase === "duration" ||
      phase === "map_inputs" ||
      phase === "loudness" ||
      phase === "silence" ||
      phase === "freshness"
    )
      checks[phase] = "fail";
    if (phase === "inspection") checks.decode = "fail";
  } finally {
    if (acquired && !retained) {
      try {
        await acquired.cleanup();
      } catch {
        cleanupPending = true;
      }
    }
    if (holdsLatch && !cleanupPending && !retained) inFlight = false;
  }
  const common: ResultBasis = {
    profile: PROFILE,
    candidate_scope: scope,
    input_fingerprint: inputFingerprint,
    subject_basis: "captured_snapshots",
    snapshot_lifetime: "evaluation_only",
    authority: "none",
    synthetic_only: true,
    non_clearance: nonClearance,
  };
  if (primary || cleanupPending || !measurements) {
    const refusal = primary instanceof TechnicalRefusal ? primary : undefined;
    return deepFreeze({
      ...common,
      status: "refused",
      code:
        refusal?.code ??
        (cleanupPending
          ? "cleanup_pending"
          : phase === "source"
            ? "source_read_failed"
            : phase === "invocation"
              ? "invalid_invocation"
              : "inspection_failed"),
      phase: refusal?.phase ?? phase,
      cleanup: cleanupPending
        ? "pending"
        : holdsLatch
          ? "complete"
          : "not_started",
      checks,
    });
  }
  if (retained && acquired) {
    const captured = acquired;
    let released = false;
    const lease: RetainedTechnicalMaster = Object.freeze({
      acquired: captured,
      observation: deepFreeze({
        schema: "durable-pair-assessment-observation/1",
        profile: PROFILE,
        candidate_scope: scope,
        input_fingerprint: inputFingerprint,
        checks,
        measurements,
        authority: "none",
        synthetic_only: true,
      }),
      async recheck() {
        demand(!released && settings(), "unsafe_settings", "freshness");
        await captured.recheck();
      },
      async release() {
        if (released)
          throw new TechnicalRefusal("cleanup_pending", "cleanup", true);
        await captured.cleanup();
        released = true;
        retainedCaptures.delete(lease);
        inFlight = false;
      },
    });
    retainedCaptures.add(lease);
    return lease;
  }
  return deepFreeze({
    ...common,
    status: "synthetic_technical_policy_pass",
    cleanup: "complete",
    checks,
    measurements,
  });
}
