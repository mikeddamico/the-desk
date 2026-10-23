// Fixed fixture Performance Direction seam, Scope A only (pure candidate grammar, Performance-owned read snapshot and admission REFUSAL,
// explicit-input pure evaluators, supplied-snapshot classification): dependent contract `performance-direction/1` (docs/g1-performance-direction.md).
// Five finite interfaces: C (strict candidate grammar, `validateDirectionCandidate`), R (a Performance-owned reader that composes the exported Claims/Writing
// primitives on ONE client it checks out itself, then `admitPerformanceAcquisition` / `refusePerformanceDirection`), E (the seven pure evaluators over explicit
// stored-shaped facts), S (`classifyDirectionRows`, supplied-snapshot examples only) and the planner. Door D (durable write, re-entry, convergence) is NOT
// designed or implemented. There is no positive admission: on the pinned chain the upstream gate is recorded as 16 pass / 2 fail (aggregate `failed`) and
// the answer is `perf_upstream_gate_failed`; even an all-pass counterfactual stays `incomplete` because H04/H13 are unconditional required gaps.
// Nothing here writes a row, advances a lifecycle state, calls a provider, a model, an auditor or the audio path, or states anything about performance
// quality, semantic correctness, SCRIPTED, READY or G1-B. The reader never nests `readGateSnapshot`, never calls `classifyGateAcquisition` and never mints
// or registers an upstream `GateAcquisition` or `GatePlan`; it mints only its own module-private `PerformanceAcquisition`.
import type { Pool, PoolClient } from "pg";

import { codePointLength } from "../fixture/code-points.js";
import { GATE_SET_VERSION } from "../fixture/derive.js";
import type { Pack } from "../fixture/pack.js";
import {
  performanceDirectionHash,
  performanceDirectionProjection,
  turnAnchorMap,
} from "../identity/artifacts.js";
import {
  canonicalJson,
  canonicalTimestamp,
  sha256,
} from "../identity/canonical-json.js";
import { fingerprint } from "../identity/fingerprints.js";
import {
  GATE_PIN,
  GATE_SNAPSHOT_STATEMENT_COUNT,
  KNOWN_TAGS,
  MARKUP_CHARS,
  classifyGateRaw,
  gateDefinitionId,
  gateRawOf,
  gateSnapshotStatements,
  isAdmittedGatePlan,
  stageGateSnapshot,
  type CoverageStatus,
  type DefinitionPin,
  type FindingClass,
  type GateAggregate,
  type GateCandidate,
  type GateClassified,
  type GatePlan,
  type GateRawSnapshot,
  type GateStaged,
  type GateStopCode,
  type GateStopRow,
  type GateStopStage,
} from "./claims-writing-gate.js";
import { faultPoint, type Row } from "./command.js";
import type { Cleanup, Statement } from "./writer-pass1.js";

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj =>
  typeof value === "object" && value !== null && !Array.isArray(value);
/** A dense array: every positional index exists (a hole is not an element and is never skipped or compacted). */
const isDenseList = (value: unknown): value is unknown[] => {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1)
    if (!Object.hasOwn(value, index)) return false;
  return true;
};
const isObjList = (value: unknown): value is Obj[] =>
  isDenseList(value) && value.every(isObj);
const isInt = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value);

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

// ---- pinned literals (inert; the frozen design values, verified at plan time and in every evaluator, never adjusted to fit) -----------------------
export const PERFORMANCE_PIN = deepFreeze({
  profile: "performance-direction/1",
  result_schema: "performance-direction-gate-result/1",
  actor_id: GATE_PIN.actor_id,
  actor_kind: "policy",
  fingerprint_stage: "performance",
  policy_version: "performance-render-0.1.4",
  direction_domain: "performance-direction-v1",
  gate_set_version: GATE_SET_VERSION,
  claims_policy_version: GATE_PIN.claims_policy_version,
  writing_policy_version: GATE_PIN.writing_policy_version,
  auditor_contract_version: "semantic-auditor-v1",
  script_hash: GATE_PIN.child_script_hash,
  claims_writing_fingerprint: GATE_PIN.fingerprint,
  foundation_member: "foundation_rows_398.json",
  foundation_sha256: GATE_PIN.member_sha256.foundation_rows,
  first_definition: 19,
});
/** The seven frozen Performance definitions in definition order (id suffix = the one-based position 19..25). */
export const PERFORMANCE_DEFINITION_KEYS = deepFreeze([
  "performance.intent_ref_integrity",
  "performance.script_binding",
  "performance.mode_intent_allowed",
  "performance.protected_nonverbal",
  "performance.overlap_protected_span",
  "performance.no_spoken_text_mutation",
  "performance.no_provider_syntax",
] as const);
export type PerformanceDefinitionKey =
  (typeof PERFORMANCE_DEFINITION_KEYS)[number];
const POSITIONS: readonly number[] = PERFORMANCE_DEFINITION_KEYS.map(
  (_, index) => PERFORMANCE_PIN.first_definition + index,
);
/** The exact fact keys (sorted) of each definition, by position 19..25. */
export const PERFORMANCE_FACT_KEYS: Readonly<
  Record<number, readonly string[]>
> = deepFreeze<Readonly<Record<number, readonly string[]>>>({
  19: [
    "examined",
    "expected_examined",
    "span_refs",
    "timing_refs",
    "turn_refs",
  ],
  20: ["examined", "expected_examined", "intents_payload", "intents_rows"],
  21: ["examined", "expected_examined", "families_present", "rule_entries"],
  22: [
    "examined",
    "expected_examined",
    "protected_context",
    "sensitivities_active",
    "sombre",
  ],
  23: [
    "examined",
    "expected_examined",
    "protected_regions_checked",
    "sensitivities_active",
  ],
  24: ["examined", "expected_examined", "script_turns_compared"],
  25: ["examined", "expected_examined", "forbidden_matches"],
});

/** The ten Scope A stop literals. The observer catalog registers exactly those that appear as literal `code:` sites below. */
export const PERFORMANCE_STOP_CODES = deepFreeze([
  "perf_grammar_invalid",
  "perf_vocabulary_unknown",
  "perf_scope_unsupported",
  "perf_binding_mismatch",
  "perf_upstream_unavailable",
  "perf_upstream_stopped",
  "perf_upstream_gate_absent",
  "perf_upstream_gate_failed",
  "perf_upstream_gate_incomplete",
  "perf_positive_branch_unimplemented",
] as const);
export type PerformanceStopCode = (typeof PERFORMANCE_STOP_CODES)[number];
/** Driver calls of one reader run: BEGIN + 145 static SELECTs + the native expected-row SELECT + COMMIT; one ROLLBACK more on a failure path. */
export const PERFORMANCE_READER_CALLS = deepFreeze({
  selects: GATE_SNAPSHOT_STATEMENT_COUNT,
  normal: GATE_SNAPSHOT_STATEMENT_COUNT + 2,
  failure_bound: GATE_SNAPSHOT_STATEMENT_COUNT + 3,
});

// ---- closed candidate vocabularies (Performance & Render v0.1.4 section 6; the supported candidate subset) --------------------------------------
export const AFFECT_VALUES: readonly string[] = deepFreeze([
  "neutral",
  "warm",
  "dry",
  "gently_amused",
  "curious",
  "skeptical",
  "incredulous",
  "frustrated",
  "disappointed",
  "joyful",
  "rueful",
  "grave",
  "restrained",
  "emphatic",
]);
export const PACE_VALUES: readonly string[] = deepFreeze([
  "slower",
  "standard",
  "quicker",
  "building",
]);
export const INTENSITY_VALUES: readonly string[] = deepFreeze([
  "restrained",
  "standard",
  "heightened",
]);
export const STRENGTH_VALUES: readonly string[] = deepFreeze([
  "light",
  "standard",
]);
export const SCOPE_TYPES: readonly string[] = deepFreeze([
  "turn",
  "program_block",
  "text_span",
]);
/** Non-verbal specimen values: consumed ONLY by gate 22 at door E; a candidate carrying `non_verbal_event` or `overlap` is an unknown identifier at door C. */
const NONVERBAL_VALUES: readonly string[] = deepFreeze([
  "breath",
  "sigh",
  "chuckle",
  "laugh",
]);
export const FAMILY_VALUES: ReadonlyMap<string, readonly string[]> = new Map([
  ["delivery_affect", AFFECT_VALUES],
  ["pace", PACE_VALUES],
  ["energy_intensity", INTENSITY_VALUES],
]);
const MODE_REGISTRY: readonly string[] = deepFreeze([
  "normal_post_event",
  "roundup",
  "sombre",
]);
const INTENT_KEYS: readonly string[] = deepFreeze([
  "scope_type",
  "scope_ref",
  "intent_type",
  "value",
  "strength",
  "timing_anchor",
]);
const TOP_KEYS: readonly string[] = deepFreeze([
  "script_hash",
  "direction_spec_version",
  "performance_intents",
]);
const ENVELOPE_KEYS: readonly string[] = deepFreeze([
  ...TOP_KEYS,
  "artifact_id",
  "performance_direction_version_id",
  "script_version_id",
  "direction_hash",
  "actor",
  "producer_run_id",
  "created_at",
  "input_fingerprint",
]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const HASH_RE = /^[0-9a-f]{64}$/u;

// ---- semantic JSON: the owned canonical-json domain (E1) ----------------------------------------------------------------------------------------
/** True iff the value belongs to the domain `canonicalJson` serializes (null, booleans, strings without lone surrogates, safe integers that are not -0, dense arrays, plain objects with NFC-unique keys, no cycles). */
export function isSemanticJson(value: unknown): boolean {
  try {
    canonicalJson(value);
    return true;
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) return false;
    throw error;
  }
}

// ---- door C: strict candidate grammar ----------------------------------------------------------------------------------------------------------
export interface DirectionScript {
  readonly script_hash: string;
  readonly turns: readonly {
    readonly turn_id: string;
    readonly semantic_turn_id: string;
  }[];
}
export type CandidateCode =
  | "perf_grammar_invalid"
  | "perf_vocabulary_unknown"
  | "perf_scope_unsupported"
  | "perf_binding_mismatch";
export interface CandidateRefusal {
  readonly kind: "refused";
  readonly stage: "candidate";
  readonly code: CandidateCode;
  readonly writes_attempted: 0;
  readonly reason?: string;
  readonly field?: string;
}
export interface CandidateAdmitted {
  readonly kind: "admitted";
  readonly direction_hash: string;
  readonly projection: Obj;
  readonly intents: number;
}
const INVALID_SCRIPT = "a bound script with unique turn anchors is required";
const grammarInvalid = (reason: string): CandidateRefusal =>
  deepFreeze<CandidateRefusal>({
    kind: "refused",
    stage: "candidate",
    code: "perf_grammar_invalid",
    writes_attempted: 0,
    reason,
  });
const vocabularyUnknown = (field: string, reason?: string): CandidateRefusal =>
  deepFreeze<CandidateRefusal>({
    kind: "refused",
    stage: "candidate",
    code: "perf_vocabulary_unknown",
    writes_attempted: 0,
    field,
    ...(reason !== undefined ? { reason } : {}),
  });
const scopeUnsupported = (reason: string): CandidateRefusal =>
  deepFreeze<CandidateRefusal>({
    kind: "refused",
    stage: "candidate",
    code: "perf_scope_unsupported",
    writes_attempted: 0,
    reason,
  });
const bindingMismatch = (reason: string): CandidateRefusal =>
  deepFreeze<CandidateRefusal>({
    kind: "refused",
    stage: "candidate",
    code: "perf_binding_mismatch",
    writes_attempted: 0,
    reason,
  });
function anchorsOf(script: DirectionScript): Map<string, string> {
  if (!isObj(script) || typeof script.script_hash !== "string")
    throw new TypeError(INVALID_SCRIPT);
  try {
    return turnAnchorMap(script.turns);
  } catch (error) {
    if (error instanceof TypeError) throw new TypeError(INVALID_SCRIPT);
    throw error;
  }
}
/**
 * The producer-supplied candidate against the bound final script. Order (first failure wins, each pass over the whole candidate before the next):
 * (1) semantic JSON, (2) exact keys, (3) types, (4) vocabulary, (5) scope/family support, (6) timing/shape, (7) script/spec binding, (8) turn binding.
 * Array order is identity: nothing is sorted and there is no duplicate rule. The result carries only closed, positional facts.
 */
export function validateDirectionCandidate(
  candidate: unknown,
  script: DirectionScript,
): CandidateAdmitted | CandidateRefusal {
  const anchors = anchorsOf(script);
  if (!isSemanticJson(candidate)) return grammarInvalid("not_semantic_json");
  if (!isObj(candidate)) return grammarInvalid("type");
  for (const key of TOP_KEYS)
    if (!Object.hasOwn(candidate, key)) return grammarInvalid("missing_key");
  if (Object.keys(candidate).some((key) => !TOP_KEYS.includes(key)))
    return grammarInvalid("unknown_key");
  const intents = candidate.performance_intents;
  if (Array.isArray(intents))
    for (const intent of intents) {
      if (!isObj(intent)) continue;
      for (const key of INTENT_KEYS)
        if (!Object.hasOwn(intent, key)) return grammarInvalid("missing_key");
      if (Object.keys(intent).some((key) => !INTENT_KEYS.includes(key)))
        return grammarInvalid("unknown_key");
    }
  if (
    typeof candidate.script_hash !== "string" ||
    typeof candidate.direction_spec_version !== "string" ||
    !Array.isArray(intents)
  )
    return grammarInvalid("type");
  const list: Obj[] = [];
  for (const intent of intents) {
    if (!isObj(intent)) return grammarInvalid("type");
    for (const key of INTENT_KEYS.filter((name) => name !== "timing_anchor"))
      if (typeof intent[key] !== "string") return grammarInvalid("type");
    if (
      intent.timing_anchor !== null &&
      typeof intent.timing_anchor !== "string"
    )
      return grammarInvalid("type");
    list.push(intent);
  }
  for (const intent of list) {
    if (!SCOPE_TYPES.includes(intent.scope_type as string))
      return vocabularyUnknown("scope_type");
    const family = FAMILY_VALUES.get(intent.intent_type as string);
    if (family === undefined)
      return vocabularyUnknown(
        "intent_type",
        "not_in_supported_candidate_subset",
      );
    if (!family.includes(intent.value as string))
      return vocabularyUnknown("value");
    if (!STRENGTH_VALUES.includes(intent.strength as string))
      return vocabularyUnknown("strength");
  }
  for (const intent of list) {
    if (intent.scope_type === "program_block")
      return scopeUnsupported("block_turn_mapping_unowned");
    if (intent.scope_type === "text_span")
      return scopeUnsupported("text_span_ref_shape_unowned");
  }
  if (!HASH_RE.test(candidate.script_hash))
    return grammarInvalid("script_hash_shape");
  for (const intent of list) {
    if (intent.timing_anchor !== null)
      return grammarInvalid("timing_not_allowed");
    if (!UUID_RE.test(intent.scope_ref as string))
      return grammarInvalid("scope_ref_shape");
  }
  if (candidate.script_hash !== script.script_hash)
    return bindingMismatch("script_hash");
  if (candidate.direction_spec_version !== PERFORMANCE_PIN.policy_version)
    return bindingMismatch("spec_version");
  for (const intent of list)
    if (!anchors.has(intent.scope_ref as string))
      return bindingMismatch("turn_outside_script");
  return deepFreeze<CandidateAdmitted>({
    kind: "admitted",
    direction_hash: performanceDirectionHash(candidate, anchors),
    projection: performanceDirectionProjection(candidate, anchors),
    intents: list.length,
  });
}

// ---- fingerprints (pure arithmetic; computing one is NOT audit-dispatch readiness) -----------------------------------------------------------------
/** The exact four-key `performance-gate-input-v1` projection. */
export const performanceGateInput = (
  scriptHash: string,
  directionHash: string,
): Obj => ({
  script_hash: scriptHash,
  performance_direction_hash: directionHash,
  performance_policy_version: PERFORMANCE_PIN.policy_version,
  gate_set_version: PERFORMANCE_PIN.gate_set_version,
});
export const performanceFingerprint = (
  scriptHash: string,
  directionHash: string,
): string =>
  fingerprint("performance", performanceGateInput(scriptHash, directionHash));
/** The exact eight-key `audit-input-v1` projection (arithmetic only). */
export const auditInput = (inputs: {
  readonly package_hash: string;
  readonly brief_hash: string;
  readonly script_hash: string;
  readonly performance_direction_hash: string;
}): Obj => ({
  package_hash: inputs.package_hash,
  brief_hash: inputs.brief_hash,
  script_hash: inputs.script_hash,
  performance_direction_hash: inputs.performance_direction_hash,
  claims_policy_version: PERFORMANCE_PIN.claims_policy_version,
  writing_policy_version: PERFORMANCE_PIN.writing_policy_version,
  performance_policy_version: PERFORMANCE_PIN.policy_version,
  auditor_contract_version: PERFORMANCE_PIN.auditor_contract_version,
});
export const auditInputFingerprint = (
  inputs: Parameters<typeof auditInput>[0],
): string => fingerprint("semantic_audit", auditInput(inputs));

// ---- the planner: an admitted gate plan plus the seven definition pins (one pinned member read) -----------------------------------------------------
export interface PerformancePlan {
  readonly gate: GatePlan;
  readonly definitions: readonly DefinitionPin[];
  readonly policy_version: string;
  readonly gate_set_version: string;
}
const ADMITTED_PERFORMANCE_PLANS = new WeakSet<object>();
export const isAdmittedPerformancePlan = (
  plan: unknown,
): plan is PerformancePlan =>
  typeof plan === "object" &&
  plan !== null &&
  ADMITTED_PERFORMANCE_PLANS.has(plan);
const PLAN_SHAPE =
  "planPerformanceDirection requires exactly { gatePlan, pack }";
const PLAN_PIN =
  "the pinned foundation rows do not carry the seven Performance definitions";
const NEED_PLAN = "an admitted performance plan is required";
/**
 * Pure planning: `{ gatePlan, pack }` only (no invocation, no timestamp, no attempt id: the admitted gate plan already pins the host attempt, script,
 * package, Brief, policies and fingerprint). Reads ONE pinned member (`foundation_rows_398.json`, SHA-256 re-checked) for the seven definition pins.
 * A wrong shape, a non-admitted plan or a pin mismatch is a constant-text programmer error before any later use.
 */
export function planPerformanceDirection(input: {
  readonly gatePlan: GatePlan;
  readonly pack: Pack;
}): PerformancePlan {
  if (
    !isObj(input) ||
    Object.keys(input).length !== 2 ||
    !Object.hasOwn(input, "gatePlan") ||
    !Object.hasOwn(input, "pack")
  )
    throw new TypeError(PLAN_SHAPE);
  const { gatePlan, pack } = input;
  if (
    !isAdmittedGatePlan(gatePlan) ||
    !isObj(pack) ||
    typeof (pack as { member?: unknown }).member !== "function"
  )
    throw new TypeError(PLAN_SHAPE);
  const bytes = pack.member(PERFORMANCE_PIN.foundation_member);
  if (sha256(bytes) !== PERFORMANCE_PIN.foundation_sha256)
    throw new TypeError(PLAN_PIN);
  const parsed: unknown = JSON.parse(bytes.toString("utf8"));
  const tables = isObj(parsed) && isObj(parsed.tables) ? parsed.tables : {};
  const rows = Array.isArray(tables.gate_definitions)
    ? tables.gate_definitions.filter(isObj)
    : [];
  const definitions: DefinitionPin[] = POSITIONS.map((position, index) => {
    const id = gateDefinitionId(position);
    const key = PERFORMANCE_DEFINITION_KEYS[index];
    const row = rows.find((item) => item.gate_definition_id === id);
    if (
      key === undefined ||
      row === undefined ||
      row.gate_name !== key ||
      row.version !== "1" ||
      !isObj(row.definition) ||
      row.definition.gate_key !== key ||
      row.definition.gate_version !== "1" ||
      row.definition.default_severity !== "block" ||
      row.definition.gate_class !== "deterministic_blocking" ||
      row.definition.policy !== "active_spec"
    )
      throw new TypeError(PLAN_PIN);
    return {
      gate_definition_id: id,
      gate_name: key,
      version: "1",
      definition: row.definition,
    };
  });
  const plan: PerformancePlan = deepFreeze({
    gate: gatePlan,
    definitions,
    policy_version: PERFORMANCE_PIN.policy_version,
    gate_set_version: PERFORMANCE_PIN.gate_set_version,
  });
  ADMITTED_PERFORMANCE_PLANS.add(plan);
  return plan;
}

// ---- door R: the Performance-owned read snapshot ---------------------------------------------------------------------------------------------------
/** A successful read: minted only by `readPerformanceSnapshot` after COMMIT and release succeeded; it is NOT an upstream `GateAcquisition`. */
export interface PerformanceAcquisition {
  readonly plan: PerformancePlan;
  readonly raw: GateRawSnapshot;
  readonly candidate: GateCandidate;
}
const ACQUISITIONS = new WeakSet<object>();
export const isPerformanceAcquisition = (
  value: unknown,
): value is PerformanceAcquisition =>
  typeof value === "object" && value !== null && ACQUISITIONS.has(value);
export type PerformanceSnapshotRead =
  | { readonly ok: true; readonly acquisition: PerformanceAcquisition }
  | { readonly ok: false; readonly cleanup: Cleanup };
/**
 * ONE checked-out `REPEATABLE READ READ ONLY` transaction with ZERO additional Performance statements: the 145 static SELECTs of the unchanged gate
 * snapshot, the private staging, the one native expected-row SELECT, COMMIT, and release before anything is returned (146 SELECTs + BEGIN + COMMIT =
 * 148 driver calls; one ROLLBACK more on a failure path). A failed connect acquired nothing; after a successful checkout exactly one `release(true)` is
 * attempted on every path and one ROLLBACK only on a failure or held-throwable path; errors are counted, never retried. A held fault hook throwable or
 * an unowned exception from staging propagates with its original identity after the bounded cleanup.
 */
export async function readPerformanceSnapshot(
  pool: Pool,
  plan: PerformancePlan,
): Promise<PerformanceSnapshotRead> {
  if (!isAdmittedPerformancePlan(plan)) throw new TypeError(NEED_PLAN);
  const statements: Statement[] = gateSnapshotStatements(plan.gate);
  const results: Row[][] = [];
  let failed = false as boolean;
  let thrown = undefined as { readonly error: unknown } | undefined;
  let staged: GateStaged | undefined;
  let flags: Row[] = [];
  let cleanup = 0;
  const onError = (): void => {
    failed = true;
  };
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
  } catch {
    failed = true;
  }
  if (client) {
    client.on("error", onError);
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    } catch {
      failed = true;
    }
    for (let i = 0; i < statements.length && !failed && !thrown; i += 1) {
      const statement = statements[i];
      if (!statement) break;
      try {
        results.push(
          (await client.query<Row>(statement.text, statement.values)).rows,
        );
      } catch {
        failed = true;
      }
      if (i === 0 && !failed) {
        try {
          await faultPoint("performance_direction_admission_after_first_read");
        } catch (error) {
          thrown = { error };
        }
      }
    }
    if (!failed && !thrown) {
      try {
        staged = stageGateSnapshot(plan.gate, results);
      } catch (error) {
        thrown = { error };
      }
    }
    if (!failed && !thrown && staged) {
      try {
        flags = (
          await client.query<Row>(
            staged.statement.text,
            staged.statement.values,
          )
        ).rows;
      } catch {
        failed = true;
      }
    }
    if (!failed && !thrown) {
      try {
        await client.query("COMMIT");
      } catch {
        failed = true;
      }
    }
    if (failed || thrown) {
      try {
        await client.query("ROLLBACK");
      } catch {
        cleanup += 1;
      }
    }
    try {
      client.release(true);
    } catch {
      cleanup += 1;
      failed = true;
    }
    client.removeListener("error", onError);
  }
  if (thrown) throw thrown.error;
  if (failed || !staged)
    return { ok: false, cleanup: { attached_errors: cleanup, complete: true } };
  const acquisition: PerformanceAcquisition = deepFreeze({
    plan,
    raw: gateRawOf(staged, flags),
    candidate: staged.candidate,
  });
  ACQUISITIONS.add(acquisition);
  return { ok: true, acquisition };
}

// ---- admission: the refusal algebra over closed enums --------------------------------------------------------------------------------------------
export type PerformanceUpstream =
  | { readonly class: "unavailable" }
  | {
      readonly class: "stop";
      readonly code: GateStopCode;
      readonly stage: GateStopStage;
      readonly verified?: NonNullable<GateStopRow["verified"]>;
    }
  | { readonly class: "state"; readonly gate_state: 0 }
  | {
      readonly class: "state";
      readonly gate_state: 18;
      readonly aggregate: GateAggregate;
    };
export type AdmissionCode =
  | "perf_upstream_unavailable"
  | "perf_upstream_stopped"
  | "perf_upstream_gate_absent"
  | "perf_upstream_gate_failed"
  | "perf_upstream_gate_incomplete"
  | "perf_positive_branch_unimplemented";
export interface PerformanceRefusal {
  readonly kind: "refused";
  readonly stage: "admission";
  readonly code: AdmissionCode;
  readonly writes_attempted: 0;
  readonly upstream: PerformanceUpstream;
  readonly durable: { readonly performance: "not_read" };
  readonly cleanup: Cleanup;
  readonly reconciled: false;
}
const NEED_AGGREGATE = "a gate-18 classification needs its candidate aggregate";
const NEED_ACQUISITION =
  "a successful performance snapshot acquisition is required";
const copyCleanup = (cleanup: Cleanup): Cleanup => ({
  attached_errors: cleanup.attached_errors,
  complete: cleanup.complete,
});
const verifiedOf = (
  verified: NonNullable<GateStopRow["verified"]>,
): NonNullable<GateStopRow["verified"]> => ({
  ...(verified.pass1 !== undefined ? { pass1: verified.pass1 } : {}),
  ...(verified.critic !== undefined ? { critic: verified.critic } : {}),
  ...(verified.revision !== undefined ? { revision: verified.revision } : {}),
});
/** A reader that settled without an acquisition (not an upstream verdict); `cleanup` is the reader's actual settlement. */
export function unavailableRefusal(cleanup: Cleanup): PerformanceRefusal {
  return deepFreeze<PerformanceRefusal>({
    kind: "refused",
    stage: "admission",
    code: "perf_upstream_unavailable",
    writes_attempted: 0,
    upstream: { class: "unavailable" },
    durable: { performance: "not_read" },
    cleanup: copyCleanup(cleanup),
    reconciled: false,
  });
}
/**
 * The pure admission predicate over the closed enums (never over a caller aggregate in production: the aggregate is read from the reader-owned
 * candidate). A stop is forwarded verbatim (closed fields only); gate 0 is absent; gate 18 maps the aggregate; the synthetic-only complete branch is the
 * UNIMPLEMENTED positive branch. No positive admission exists.
 */
export function admissionOf(
  classified: GateClassified,
  aggregate?: GateAggregate,
): PerformanceRefusal {
  const clean: Cleanup = { attached_errors: 0, complete: true };
  if (classified.kind === "stop")
    return deepFreeze<PerformanceRefusal>({
      kind: "refused",
      stage: "admission",
      code: "perf_upstream_stopped",
      writes_attempted: 0,
      upstream: {
        class: "stop",
        code: classified.row.code,
        stage: classified.row.stage,
        ...(classified.row.verified !== undefined
          ? { verified: verifiedOf(classified.row.verified) }
          : {}),
      },
      durable: { performance: "not_read" },
      cleanup: clean,
      reconciled: false,
    });
  if (classified.gate === 0)
    return deepFreeze<PerformanceRefusal>({
      kind: "refused",
      stage: "admission",
      code: "perf_upstream_gate_absent",
      writes_attempted: 0,
      upstream: { class: "state", gate_state: 0 },
      durable: { performance: "not_read" },
      cleanup: clean,
      reconciled: false,
    });
  if (aggregate === undefined) throw new TypeError(NEED_AGGREGATE);
  const upstream: PerformanceUpstream = {
    class: "state",
    gate_state: 18,
    aggregate,
  };
  if (aggregate === "failed")
    return deepFreeze<PerformanceRefusal>({
      kind: "refused",
      stage: "admission",
      code: "perf_upstream_gate_failed",
      writes_attempted: 0,
      upstream,
      durable: { performance: "not_read" },
      cleanup: clean,
      reconciled: false,
    });
  if (aggregate === "incomplete")
    return deepFreeze<PerformanceRefusal>({
      kind: "refused",
      stage: "admission",
      code: "perf_upstream_gate_incomplete",
      writes_attempted: 0,
      upstream,
      durable: { performance: "not_read" },
      cleanup: clean,
      reconciled: false,
    });
  return deepFreeze<PerformanceRefusal>({
    kind: "refused",
    stage: "admission",
    code: "perf_positive_branch_unimplemented",
    writes_attempted: 0,
    upstream,
    durable: { performance: "not_read" },
    cleanup: clean,
    reconciled: false,
  });
}
/** Pure classification of a reader-owned acquisition: the unchanged `classifyGateRaw` over its own raw snapshot, plan and candidate. */
export function classifyPerformanceAcquisition(
  acquisition: PerformanceAcquisition,
): GateClassified {
  if (
    !isPerformanceAcquisition(acquisition) ||
    !isAdmittedPerformancePlan(acquisition.plan)
  )
    throw new TypeError(NEED_ACQUISITION);
  return classifyGateRaw(
    acquisition.raw,
    acquisition.plan.gate,
    acquisition.candidate,
    "preflight",
  );
}
/** The refusal for a reader-owned acquisition (never for a caller-built raw snapshot). */
export function admitPerformanceAcquisition(
  acquisition: PerformanceAcquisition,
): PerformanceRefusal {
  const classified = classifyPerformanceAcquisition(acquisition);
  const aggregate =
    acquisition.candidate.kind === "ready"
      ? acquisition.candidate.evaluation.aggregate
      : undefined;
  return admissionOf(classified, aggregate);
}
/** The Scope A entry: read once, classify, refuse. Writes nothing; a held throwable propagates unchanged. */
export async function refusePerformanceDirection(
  pool: Pool,
  plan: PerformancePlan,
): Promise<PerformanceRefusal> {
  if (!isAdmittedPerformancePlan(plan)) throw new TypeError(NEED_PLAN);
  const read = await readPerformanceSnapshot(pool, plan);
  if (!read.ok) return unavailableRefusal(read.cleanup);
  return admitPerformanceAcquisition(read.acquisition);
}

// ---- door E: the seven explicit-input pure evaluators and the closed result profile ----------------------------------------------------------------
export type Side = "foreground" | "background";
export type UseKind = "evidence" | "claim";
type LocationKind = "none" | "i" | "is" | "iuk" | "ref";
export interface PerformanceLocation {
  readonly intent_index?: number;
  readonly side?: Side;
  readonly use_kind?: UseKind;
  readonly use_index?: number;
  readonly reference?: "direction_envelope";
}
export interface PerformanceFinding extends PerformanceLocation {
  readonly class: FindingClass;
  readonly code: string;
}
type CodeRow = readonly [
  code: string,
  klass: FindingClass,
  locations: readonly LocationKind[],
];
const V: FindingClass = "violation";
const G: FindingClass = "proof_gap";
/** Per definition, left to right: the sort order of 4.5 (violations before proof gaps). */
const CODE_TABLE: Readonly<Record<number, readonly CodeRow[]>> = deepFreeze<
  Readonly<Record<number, readonly CodeRow[]>>
>({
  19: [
    ["intent_turn_column_mismatch", V, ["i"]],
    ["intent_turn_missing", V, ["i"]],
    ["timing_turn_missing", V, ["i"]],
    ["span_out_of_range", V, ["is"]],
    ["denominator_mismatch", V, ["none"]],
  ],
  20: [
    ["direction_script_version_mismatch", V, ["none"]],
    ["direction_script_hash_mismatch", V, ["none"]],
    ["direction_spec_version_mismatch", V, ["none"]],
    ["direction_hash_unrecomputable", V, ["none"]],
    ["direction_hash_mismatch", V, ["none"]],
    ["payload_row_mismatch", V, ["i", "none"]],
    ["denominator_mismatch", V, ["none"]],
  ],
  21: [
    ["mode_unregistered", V, ["none"]],
    ["denominator_mismatch", V, ["none"]],
    ["mode_rule_set_absent", G, ["i"]],
  ],
  22: [
    ["nonverbal_in_protected_scope", V, ["i"]],
    ["denominator_mismatch", V, ["none"]],
    ["jocular_set_unowned", G, ["i"]],
    ["sensitivity_scope_mapping_absent", G, ["i"]],
  ],
  23: [
    ["overlap_intersects_quote", V, ["iuk"]],
    ["overlap_intersects_attribution", V, ["iuk"]],
    ["overlap_intersects_qualified", V, ["iuk"]],
    ["denominator_mismatch", V, ["none"]],
    ["overlap_span_unusable", G, ["is"]],
    ["sensitivity_scope_mapping_absent", G, ["i"]],
  ],
  24: [
    ["intent_field_unknown", V, ["i", "ref"]],
    ["script_text_changed", V, ["none"]],
    ["denominator_mismatch", V, ["none"]],
  ],
  25: [
    ["provider_char_class", V, ["i", "ref"]],
    ["provider_known_tag", V, ["i", "ref"]],
    ["denominator_mismatch", V, ["none"]],
  ],
});
const codesOf = (position: number): readonly CodeRow[] => {
  const codes = CODE_TABLE[position];
  if (codes === undefined)
    throw new TypeError("unknown performance definition");
  return codes;
};
const LOCATION_KEYS: Readonly<Record<LocationKind, readonly string[]>> = {
  none: [],
  i: ["intent_index"],
  is: ["intent_index", "side"],
  iuk: ["intent_index", "side", "use_kind", "use_index"],
  ref: ["reference"],
};
const sameKeys = (
  keys: readonly string[],
  expected: readonly string[],
): boolean =>
  keys.length === expected.length &&
  expected.every((key) => keys.includes(key));
const locationKindOf = (location: object): LocationKind | undefined =>
  (Object.keys(LOCATION_KEYS) as LocationKind[]).find((kind) =>
    sameKeys(Object.keys(location), LOCATION_KEYS[kind]),
  );
function finding(
  position: number,
  code: string,
  location: PerformanceLocation = {},
): PerformanceFinding {
  const spec = codesOf(position).find((item) => item[0] === code);
  const kind = locationKindOf(location);
  if (spec === undefined || kind === undefined || !spec[2].includes(kind))
    throw new TypeError("a performance finding must match its closed code row");
  return { class: spec[1], code, ...location };
}
const SIDE_ORDER: Readonly<Record<string, number>> = {
  foreground: 0,
  background: 1,
};
const KIND_ORDER: Readonly<Record<string, number>> = { evidence: 0, claim: 1 };
const orderOf = (
  table: Readonly<Record<string, number>>,
  key?: string,
): number => (key === undefined ? -1 : (table[key] ?? 99));
/** Deterministic order (4.5): class, code position, intent_index, side, use_kind, use_index, reference; absent components first. */
export function sortPerformanceFindings(
  position: number,
  list: readonly PerformanceFinding[],
): PerformanceFinding[] {
  const codes = codesOf(position).map((item) => item[0]);
  const compare = (a: PerformanceFinding, b: PerformanceFinding): number => {
    const parts: [number, number][] = [
      [a.class === "violation" ? 0 : 1, b.class === "violation" ? 0 : 1],
      [codes.indexOf(a.code), codes.indexOf(b.code)],
      [a.intent_index ?? -1, b.intent_index ?? -1],
      [orderOf(SIDE_ORDER, a.side), orderOf(SIDE_ORDER, b.side)],
      [orderOf(KIND_ORDER, a.use_kind), orderOf(KIND_ORDER, b.use_kind)],
      [a.use_index ?? -1, b.use_index ?? -1],
    ];
    for (const [left, right] of parts) if (left !== right) return left - right;
    const ra = a.reference ?? "";
    const rb = b.reference ?? "";
    return ra < rb ? -1 : ra > rb ? 1 : 0;
  };
  return [...list].sort(compare);
}

export interface PerformanceRow {
  readonly key: PerformanceDefinitionKey;
  readonly gate_definition_id: string;
  readonly outcome: "pass" | "fail";
  readonly result: Obj;
}
export interface PerformanceCoverageEntry {
  readonly id: string;
  readonly status: CoverageStatus;
  readonly limit?: string;
}
export interface PerformanceEvaluation {
  readonly rows: readonly PerformanceRow[];
  readonly aggregate: GateAggregate;
  readonly coverage: readonly PerformanceCoverageEntry[];
}
/** (A1) failed iff any violation; (A2) else incomplete iff any proof gap or any required coverage gap; (A3) else complete_defined_set (authorises nothing). */
export function performanceAggregateOf(
  findings: readonly { readonly class: FindingClass }[],
  coverage: readonly { readonly status: CoverageStatus }[],
): GateAggregate {
  if (findings.some((item) => item.class === "violation")) return "failed";
  if (
    findings.some((item) => item.class === "proof_gap") ||
    coverage.some((item) => item.status === "not_established_required")
  )
    return "incomplete";
  return "complete_defined_set";
}

const INVALID_FACTS = "performance stored facts are malformed";
const NOT_SEMANTIC = "performance stored facts are not semantic JSON";
interface Turn {
  readonly sequence: number;
  readonly length: number;
}
interface Use {
  readonly turn_id: string;
  readonly start: number;
  readonly end: number;
  readonly mode: string;
}
interface View {
  readonly pins: Obj;
  readonly payload: Obj;
  readonly intents: readonly Obj[];
  readonly rows: readonly Obj[];
  readonly versionRows: readonly Obj[];
  readonly artifact: Obj;
  readonly script: Obj;
  readonly scriptTurns: readonly Obj[];
  readonly turns: ReadonlyMap<string, Turn>;
  readonly evidence: readonly Use[];
  readonly claims: readonly Use[];
  readonly mode: string;
  readonly active: number;
}
function sortedUses(
  list: readonly Obj[],
  turns: ReadonlyMap<string, Turn>,
): Use[] {
  const keyed = list.map((item) => {
    const turn_id = typeof item.turn_id === "string" ? item.turn_id : "";
    return {
      use: {
        turn_id,
        start: isInt(item.span_start) ? item.span_start : Number.NaN,
        end: isInt(item.span_end) ? item.span_end : Number.NaN,
        mode: typeof item.use_mode === "string" ? item.use_mode : "",
      },
      sequence: turns.get(turn_id)?.sequence ?? Number.MAX_SAFE_INTEGER,
      id: typeof item.id === "string" ? item.id : "",
    };
  });
  const num = (value: number): number =>
    Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
  keyed.sort((a, b) => {
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    if (num(a.use.start) !== num(b.use.start))
      return num(a.use.start) - num(b.use.start);
    if (num(a.use.end) !== num(b.use.end))
      return num(a.use.end) - num(b.use.end);
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return keyed.map((item) => item.use);
}
/** The E-door precondition: structural programmer errors and non-semantic-JSON values are constant-text TypeErrors BEFORE any row or finding exists. */
function viewOf(facts: unknown): View {
  if (!isObj(facts)) throw new TypeError(INVALID_FACTS);
  const {
    pins,
    payload,
    version_rows,
    artifact,
    intent_rows,
    script,
    sensitivities,
  } = facts;
  if (!isObj(pins) || !isObj(payload) || !isObj(artifact) || !isObj(script))
    throw new TypeError(INVALID_FACTS);
  const intents = payload.performance_intents;
  if (!isObjList(intents)) throw new TypeError(INVALID_FACTS);
  if (
    !isObjList(version_rows) ||
    !isObjList(intent_rows) ||
    !isObjList(sensitivities) ||
    !isObjList(script.turns) ||
    !isObjList(script.claim_uses) ||
    !isObjList(script.evidence_uses)
  )
    throw new TypeError(INVALID_FACTS);
  if (
    !isSemanticJson(payload) ||
    !isSemanticJson(artifact) ||
    !version_rows.every((row) => isSemanticJson(row)) ||
    !intent_rows.every(
      (row) => !Object.hasOwn(row, "intent") || isSemanticJson(row.intent),
    )
  )
    throw new TypeError(NOT_SEMANTIC);
  const turns = new Map<string, Turn>();
  for (const turn of script.turns)
    if (typeof turn.turn_id === "string")
      turns.set(turn.turn_id, {
        sequence: isInt(turn.sequence)
          ? turn.sequence
          : Number.MAX_SAFE_INTEGER,
        length: codePointLength(
          (typeof turn.text === "string" ? turn.text : "").normalize("NFC"),
        ),
      });
  return {
    pins,
    payload,
    intents,
    rows: intent_rows,
    versionRows: version_rows,
    artifact,
    script,
    scriptTurns: script.turns,
    turns,
    evidence: sortedUses(script.evidence_uses, turns),
    claims: sortedUses(script.claim_uses, turns),
    mode: typeof facts.mode === "string" ? facts.mode : "",
    active: sensitivities.filter((item) => item.state !== "none").length,
  };
}
const rowIntent = (row: Obj): Obj => (isObj(row.intent) ? row.intent : {});
/** `{start,end}` with exactly those two keys, safe integers, 0 <= start < end <= length (zero-based half-open code points over NFC text). */
function validSpan(
  value: unknown,
  length: number,
): readonly [number, number] | undefined {
  if (!isObj(value) || !sameKeys(Object.keys(value), ["start", "end"]))
    return undefined;
  const { start, end } = value;
  if (!isInt(start) || !isInt(end)) return undefined;
  if (start < 0 || start >= end || end > length) return undefined;
  return [start, end];
}
interface Outcome {
  readonly facts: Readonly<Record<string, number>>;
  readonly findings: readonly PerformanceFinding[];
}
const denominator = (
  position: number,
  examined: number,
  expected: number,
): PerformanceFinding[] =>
  examined === expected ? [] : [finding(position, "denominator_mismatch")];

function gate19(v: View): Outcome {
  const found: PerformanceFinding[] = [];
  let turnRefs = 0;
  let timingRefs = 0;
  let spanRefs = 0;
  v.rows.forEach((row, index) => {
    const intent = rowIntent(row);
    const scopeRef = intent.scope_ref;
    if (
      !(
        typeof row.turn_id === "string" &&
        typeof scopeRef === "string" &&
        row.turn_id === scopeRef
      )
    )
      found.push(
        finding(19, "intent_turn_column_mismatch", { intent_index: index }),
      );
    if (intent.scope_type !== "turn") return;
    turnRefs += 1;
    const foreground =
      typeof scopeRef === "string" ? v.turns.get(scopeRef) : undefined;
    if (foreground === undefined)
      found.push(finding(19, "intent_turn_missing", { intent_index: index }));
    const timing = intent.timing_anchor;
    let background: Turn | undefined;
    if (timing !== undefined && timing !== null) {
      timingRefs += 1;
      background = typeof timing === "string" ? v.turns.get(timing) : undefined;
      if (background === undefined)
        found.push(finding(19, "timing_turn_missing", { intent_index: index }));
    }
    if (intent.intent_type === "overlap" && isObj(intent.value)) {
      const sides: [Side, string, Turn | undefined][] = [
        ["foreground", "foreground_span", foreground],
        ["background", "background_span", background],
      ];
      for (const [side, key, turn] of sides) {
        if (!Object.hasOwn(intent.value, key)) continue;
        spanRefs += 1;
        if (
          turn !== undefined &&
          validSpan(intent.value[key], turn.length) === undefined
        )
          found.push(
            finding(19, "span_out_of_range", { intent_index: index, side }),
          );
      }
    }
  });
  found.push(...denominator(19, v.rows.length, v.intents.length));
  return {
    facts: {
      examined: v.rows.length,
      expected_examined: v.intents.length,
      span_refs: spanRefs,
      timing_refs: timingRefs,
      turn_refs: turnRefs,
    },
    findings: found,
  };
}
const selection = (source: Obj): string =>
  canonicalJson(
    INTENT_KEYS.map((key) =>
      Object.hasOwn(source, key) ? [1, source[key]] : [0],
    ),
  );
function recomputedHash(v: View): string | undefined {
  try {
    return performanceDirectionHash(v.payload, turnAnchorMap(v.scriptTurns));
  } catch (error) {
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}
function gate20(v: View): Outcome {
  const found: PerformanceFinding[] = [];
  const pins = v.pins;
  const recomputed = v.script.recomputed_hash;
  if (
    v.versionRows.some(
      (row) => row.script_version_id !== pins.script_version_id,
    )
  )
    found.push(finding(20, "direction_script_version_mismatch"));
  if (
    typeof v.payload.script_hash !== "string" ||
    v.payload.script_hash !== recomputed ||
    recomputed !== pins.script_hash
  )
    found.push(finding(20, "direction_script_hash_mismatch"));
  if (v.payload.direction_spec_version !== PERFORMANCE_PIN.policy_version)
    found.push(finding(20, "direction_spec_version_mismatch"));
  const hash = recomputedHash(v);
  if (hash === undefined)
    found.push(finding(20, "direction_hash_unrecomputable"));
  else if (
    v.payload.direction_hash !== hash ||
    v.artifact.content_hash !== hash
  )
    found.push(finding(20, "direction_hash_mismatch"));
  const common = Math.min(v.intents.length, v.rows.length);
  for (let index = 0; index < common; index += 1) {
    const payloadIntent = v.intents[index] ?? {};
    const row = v.rows[index] ?? {};
    if (
      selection(payloadIntent) !== selection(rowIntent(row)) ||
      payloadIntent.scope_ref !== row.turn_id
    )
      found.push(finding(20, "payload_row_mismatch", { intent_index: index }));
  }
  if (v.intents.length !== v.rows.length)
    found.push(finding(20, "payload_row_mismatch"));
  found.push(...denominator(20, v.versionRows.length, 1));
  return {
    facts: {
      examined: v.versionRows.length,
      expected_examined: 1,
      intents_payload: v.intents.length,
      intents_rows: v.rows.length,
    },
    findings: found,
  };
}
function gate21(v: View): Outcome {
  const found: PerformanceFinding[] = [];
  if (!MODE_REGISTRY.includes(v.mode))
    found.push(finding(21, "mode_unregistered"));
  else
    v.intents.forEach((_, index) =>
      found.push(finding(21, "mode_rule_set_absent", { intent_index: index })),
    );
  found.push(...denominator(21, v.intents.length, v.rows.length));
  const families = new Set(
    v.intents
      .map((intent) => intent.intent_type)
      .filter((type): type is string => typeof type === "string"),
  );
  return {
    facts: {
      examined: v.intents.length,
      expected_examined: v.rows.length,
      families_present: families.size,
      rule_entries: 0,
    },
    findings: found,
  };
}
/** 1: non-verbal laugh/chuckle (K1); 2: heightened energy_intensity (K2); 0: neither. */
const kindOf = (intent: Obj): 0 | 1 | 2 => {
  if (
    intent.intent_type === "non_verbal_event" &&
    (intent.value === "laugh" || intent.value === "chuckle")
  )
    return 1;
  if (
    intent.intent_type === "energy_intensity" &&
    intent.value === "heightened"
  )
    return 2;
  return 0;
};
function gate22(v: View): Outcome {
  const found: PerformanceFinding[] = [];
  const sombre = v.mode === "sombre";
  let examined = 0;
  v.intents.forEach((intent, index) => {
    const kind = kindOf(intent);
    if (kind === 0) return;
    examined += 1;
    const at = { intent_index: index };
    if (kind === 1) {
      if (sombre) found.push(finding(22, "nonverbal_in_protected_scope", at));
      else if (v.active > 0)
        found.push(finding(22, "sensitivity_scope_mapping_absent", at));
      return;
    }
    if (sombre || v.active > 0)
      found.push(finding(22, "jocular_set_unowned", at));
    if (v.active > 0)
      found.push(finding(22, "sensitivity_scope_mapping_absent", at));
  });
  const expected = v.rows.filter((row) => kindOf(rowIntent(row)) !== 0).length;
  found.push(...denominator(22, examined, expected));
  return {
    facts: {
      examined,
      expected_examined: expected,
      protected_context: sombre || v.active > 0 ? 1 : 0,
      sensitivities_active: v.active,
      sombre: sombre ? 1 : 0,
    },
    findings: found,
  };
}
const OVERLAP_CODES: Readonly<Record<string, string>> = {
  quoted: "overlap_intersects_quote",
  attributed: "overlap_intersects_attribution",
  hedged: "overlap_intersects_qualified",
};
function gate23(v: View): Outcome {
  const found: PerformanceFinding[] = [];
  let checked = 0;
  let examined = 0;
  v.intents.forEach((intent, index) => {
    if (intent.intent_type !== "overlap") return;
    examined += 1;
    const value = isObj(intent.value) ? intent.value : {};
    const sides: [Side, string, unknown][] = [
      ["foreground", "foreground_span", intent.scope_ref],
      ["background", "background_span", intent.timing_anchor],
    ];
    for (const [side, key, turnId] of sides) {
      const turn = typeof turnId === "string" ? v.turns.get(turnId) : undefined;
      if (turn === undefined) continue; // an unresolvable turn contributes no regions (gate 19 reports it)
      let region: readonly [number, number] = [0, turn.length];
      if (Object.hasOwn(value, key)) {
        const span = validSpan(value[key], turn.length);
        if (span === undefined) {
          found.push(
            finding(23, "overlap_span_unusable", { intent_index: index, side }),
          );
          continue; // no whole-turn region is substituted and no intersection is inferred
        }
        region = span;
      }
      const groups: [UseKind, readonly Use[]][] = [
        ["evidence", v.evidence],
        ["claim", v.claims],
      ];
      for (const [use_kind, list] of groups)
        list.forEach((use, use_index) => {
          if (use.turn_id !== turnId) return;
          const code = Object.hasOwn(OVERLAP_CODES, use.mode)
            ? OVERLAP_CODES[use.mode]
            : undefined;
          const protectedUse =
            code !== undefined &&
            (use_kind === "evidence"
              ? use.mode === "quoted"
              : use.mode !== "quoted");
          if (!protectedUse || code === undefined) return;
          checked += 1;
          if (
            Number.isSafeInteger(use.start) &&
            Number.isSafeInteger(use.end) &&
            region[0] < use.end &&
            use.start < region[1]
          )
            found.push(
              finding(23, code, {
                intent_index: index,
                side,
                use_kind,
                use_index,
              }),
            );
        });
    }
    if (v.active > 0)
      found.push(
        finding(23, "sensitivity_scope_mapping_absent", {
          intent_index: index,
        }),
      );
  });
  const expected = v.rows.filter(
    (row) => rowIntent(row).intent_type === "overlap",
  ).length;
  found.push(...denominator(23, examined, expected));
  return {
    facts: {
      examined,
      expected_examined: expected,
      protected_regions_checked: checked,
      sensitivities_active: v.active,
    },
    findings: found,
  };
}
const PAYLOAD_INTENT_KEYS: readonly string[] = [
  ...INTENT_KEYS,
  "performance_intent_id",
];
function gate24(v: View): Outcome {
  const found: PerformanceFinding[] = [];
  const count = Math.max(v.intents.length, v.rows.length);
  for (let index = 0; index < count; index += 1) {
    const fromPayload = v.intents[index];
    const fromRow = v.rows[index];
    const unknown =
      (fromPayload !== undefined &&
        Object.keys(fromPayload).some(
          (key) => !PAYLOAD_INTENT_KEYS.includes(key),
        )) ||
      (fromRow !== undefined &&
        isObj(fromRow.intent) &&
        Object.keys(fromRow.intent).some((key) => !INTENT_KEYS.includes(key)));
    if (unknown)
      found.push(finding(24, "intent_field_unknown", { intent_index: index }));
  }
  if (Object.keys(v.payload).some((key) => !ENVELOPE_KEYS.includes(key)))
    found.push(
      finding(24, "intent_field_unknown", { reference: "direction_envelope" }),
    );
  if (v.script.recomputed_hash !== v.pins.script_hash)
    found.push(finding(24, "script_text_changed"));
  found.push(...denominator(24, v.intents.length, v.rows.length));
  return {
    facts: {
      examined: v.intents.length,
      expected_examined: v.rows.length,
      script_turns_compared: v.scriptTurns.length,
    },
    findings: found,
  };
}
const KEY_TABLE: ReadonlySet<string> = new Set([
  ...ENVELOPE_KEYS,
  ...INTENT_KEYS,
  "performance_intent_id",
  "placement",
  "duration_class",
  "foreground_span",
  "background_span",
  "start",
  "end",
]);
const VALUE_VOCABULARY: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["scope_type", new Set(SCOPE_TYPES)],
  [
    "intent_type",
    new Set([...FAMILY_VALUES.keys(), "non_verbal_event", "overlap"]),
  ],
  [
    "value",
    new Set([
      ...AFFECT_VALUES,
      ...PACE_VALUES,
      ...INTENSITY_VALUES,
      ...NONVERBAL_VALUES,
    ]),
  ],
  ["strength", new Set(STRENGTH_VALUES)],
  ["placement", new Set(["beginning", "middle", "end"])],
  ["duration_class", new Set(["brief", "short"])],
]);
const UUID_KEYS: ReadonlySet<string> = new Set([
  "scope_ref",
  "timing_anchor",
  "performance_intent_id",
  "artifact_id",
  "performance_direction_version_id",
  "script_version_id",
  "producer_run_id",
]);
const HASH_KEYS: ReadonlySet<string> = new Set([
  "script_hash",
  "direction_hash",
  "input_fingerprint",
]);
const isTimestamp = (text: string): boolean => {
  try {
    canonicalTimestamp(text);
    return true;
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
};
function governedValue(
  owner: string | undefined,
  text: string,
  pins: Obj,
): boolean {
  if (owner === undefined) return false;
  if (VALUE_VOCABULARY.get(owner)?.has(text) === true) return true;
  if (owner === "direction_spec_version")
    return text === PERFORMANCE_PIN.policy_version;
  if (owner === "actor" && text === pins.actor) return true;
  if (owner === "producer_run_id" && text === pins.producer_run_id) return true;
  if (UUID_KEYS.has(owner) && UUID_RE.test(text)) return true;
  if (HASH_KEYS.has(owner) && HASH_RE.test(text)) return true;
  return owner === "created_at" && isTimestamp(text);
}
interface Leaf {
  readonly text: string;
  readonly location: PerformanceLocation;
}
/** Recursive walk of one value: every object key and every string value is a leaf; governed leaves are counted and excluded, the rest are free leaves. */
function walk(
  node: unknown,
  owner: string | undefined,
  location: PerformanceLocation,
  pins: Obj,
  free: Leaf[],
  counter: { governed: number },
): void {
  if (typeof node === "string") {
    if (governedValue(owner, node, pins)) counter.governed += 1;
    else free.push({ text: node, location });
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) walk(item, owner, location, pins, free, counter);
    return;
  }
  if (!isObj(node)) return;
  for (const [key, child] of Object.entries(node)) {
    if (KEY_TABLE.has(key)) counter.governed += 1;
    else free.push({ text: key, location });
    walk(child, key, location, pins, free, counter);
  }
}
/** The independent universe: the leaf count of the CANONICAL serialization (keys plus string values). */
function serializedLeaves(value: unknown): number {
  const count = (node: unknown): number => {
    if (typeof node === "string") return 1;
    if (Array.isArray(node))
      return node.reduce<number>((sum, item) => sum + count(item), 0);
    if (isObj(node))
      return Object.entries(node).reduce<number>(
        (sum, [, child]) => sum + 1 + count(child),
        0,
      );
    return 0;
  };
  return count(JSON.parse(canonicalJson(value)) as unknown);
}
function gate25(v: View): Outcome {
  const free: Leaf[] = [];
  const counter = { governed: 0 };
  const envelope: PerformanceLocation = { reference: "direction_envelope" };
  for (const [key, child] of Object.entries(v.payload)) {
    if (KEY_TABLE.has(key)) counter.governed += 1;
    else free.push({ text: key, location: envelope });
    if (key === "performance_intents" && Array.isArray(child))
      child.forEach((item, index) =>
        walk(item, key, { intent_index: index }, v.pins, free, counter),
      );
    else walk(child, key, envelope, v.pins, free, counter);
  }
  v.rows.forEach((row, index) => {
    if (Object.hasOwn(row, "intent"))
      walk(
        row.intent,
        undefined,
        { intent_index: index },
        v.pins,
        free,
        counter,
      );
  });
  const found: PerformanceFinding[] = [];
  for (const leaf of free) {
    for (const char of Array.from(leaf.text))
      if (MARKUP_CHARS.has(char))
        found.push(finding(25, "provider_char_class", leaf.location));
    for (const tag of KNOWN_TAGS) {
      const re = new RegExp(tag.source, tag.flags);
      for (let m = re.exec(leaf.text); m !== null; m = re.exec(leaf.text)) {
        found.push(finding(25, "provider_known_tag", leaf.location));
        if (m[0].length === 0) re.lastIndex += 1;
      }
    }
  }
  const forbidden = found.length;
  const total =
    serializedLeaves(v.payload) +
    v.rows.reduce(
      (sum, row) =>
        sum + (Object.hasOwn(row, "intent") ? serializedLeaves(row.intent) : 0),
      0,
    );
  found.push(...denominator(25, free.length, total - counter.governed));
  return {
    facts: {
      examined: free.length,
      expected_examined: total - counter.governed,
      forbidden_matches: forbidden,
    },
    findings: found,
  };
}
const EVALUATORS: Readonly<Record<number, (view: View) => Outcome>> = {
  19: gate19,
  20: gate20,
  21: gate21,
  22: gate22,
  23: gate23,
  24: gate24,
  25: gate25,
};
function rowOf(v: View, position: number): PerformanceRow {
  const evaluate = EVALUATORS[position];
  const key =
    PERFORMANCE_DEFINITION_KEYS[position - PERFORMANCE_PIN.first_definition];
  if (evaluate === undefined || key === undefined)
    throw new TypeError("unknown performance definition");
  const outcome = evaluate(v);
  const findings = sortPerformanceFindings(position, outcome.findings);
  const facts: Record<string, number> = {};
  for (const name of PERFORMANCE_FACT_KEYS[position] ?? [])
    facts[name] = outcome.facts[name] ?? 0;
  const versionId = v.versionRows[0]?.performance_direction_version_id;
  return deepFreeze<PerformanceRow>({
    key,
    gate_definition_id: gateDefinitionId(position),
    outcome: findings.length === 0 ? "pass" : "fail",
    result: {
      actor_id: PERFORMANCE_PIN.actor_id,
      actor_kind: PERFORMANCE_PIN.actor_kind,
      check: key,
      facts,
      findings,
      fingerprint_stage: PERFORMANCE_PIN.fingerprint_stage,
      schema: PERFORMANCE_PIN.result_schema,
      subject_refs: typeof versionId === "string" ? [versionId] : [],
    },
  });
}
/** ONE definition (19..25) over explicit stored-shaped facts: the component proof of that definition only. */
export function evaluatePerformanceGate(
  facts: unknown,
  position: number,
): PerformanceRow {
  return rowOf(viewOf(facts), position);
}
/** The returned (never durable) coverage register of the pure evaluation. */
function coverageOf(v: View): PerformanceCoverageEntry[] {
  return [
    {
      id: "M01",
      status:
        v.intents.length === 0
          ? "inapplicable_witnessed"
          : "not_established_required",
      ...(v.intents.length === 0
        ? {}
        : { limit: "mode_forbidden_rule_set_absent" }),
    },
    {
      id: "S01",
      status:
        v.active === 0 ? "inapplicable_witnessed" : "not_established_required",
      ...(v.active === 0 ? {} : { limit: "sensitivity_span_mapping_absent" }),
    },
    {
      id: "B01",
      status: "established_with_limits",
      limit: "block_span_scope_unsupported",
    },
    {
      id: "Q01",
      status: "established_with_limits",
      limit: "attribution_phrase_position_unowned",
    },
    {
      id: "Q02",
      status: "established_with_limits",
      limit: "qualified_span_proxy_only",
    },
    { id: "T01", status: "deferred_semantic" },
    { id: "T02", status: "deferred_semantic" },
    { id: "A01", status: "deferred_semantic" },
  ];
}
/** All seven definitions over explicit facts, plus the returned aggregate. A `complete_defined_set` here authorises nothing and admits nothing. */
export function evaluatePerformanceGates(
  facts: unknown,
): PerformanceEvaluation {
  const view = viewOf(facts);
  const rows = POSITIONS.map((position) => rowOf(view, position));
  const coverage = coverageOf(view);
  const findings = rows.flatMap(
    (row) => row.result.findings as PerformanceFinding[],
  );
  return deepFreeze<PerformanceEvaluation>({
    rows,
    aggregate: performanceAggregateOf(findings, coverage),
    coverage,
  });
}

/** The closed-profile validator: exactly the eight keys, the declared fact keys (safe non-negative integers) and one accepted location variant per code. */
export function isClosedPerformanceResult(value: unknown): boolean {
  if (
    !isObj(value) ||
    !sameKeys(Object.keys(value), [
      "actor_id",
      "actor_kind",
      "check",
      "facts",
      "findings",
      "fingerprint_stage",
      "schema",
      "subject_refs",
    ])
  )
    return false;
  const index = PERFORMANCE_DEFINITION_KEYS.findIndex(
    (key) => key === value.check,
  );
  if (
    index < 0 ||
    value.actor_id !== PERFORMANCE_PIN.actor_id ||
    value.actor_kind !== PERFORMANCE_PIN.actor_kind ||
    value.fingerprint_stage !== PERFORMANCE_PIN.fingerprint_stage ||
    value.schema !== PERFORMANCE_PIN.result_schema
  )
    return false;
  const position = PERFORMANCE_PIN.first_definition + index;
  const facts = value.facts;
  const factKeys = PERFORMANCE_FACT_KEYS[position] ?? [];
  if (
    !isObj(facts) ||
    !sameKeys(Object.keys(facts), factKeys) ||
    !factKeys.every((key) => {
      const entry = facts[key];
      return isInt(entry) && entry >= 0;
    })
  )
    return false;
  if (
    !isDenseList(value.subject_refs) ||
    value.subject_refs.length > 1 ||
    !value.subject_refs.every((item) => typeof item === "string")
  )
    return false;
  if (!isDenseList(value.findings)) return false;
  return value.findings.every((item: unknown) => {
    if (!isObj(item) || typeof item.code !== "string") return false;
    const spec = codesOf(position).find((row) => row[0] === item.code);
    if (spec === undefined || item.class !== spec[1]) return false;
    const location: Obj = Object.fromEntries(
      Object.entries(item).filter(
        ([name]) => name !== "class" && name !== "code",
      ),
    );
    const kind = locationKindOf(location);
    if (kind === undefined || !spec[2].includes(kind)) return false;
    // every own location field of the selected variant must carry its declared value (an own key holding `undefined` is a missing value, not an absent key)
    return Object.entries(location).every(([name, entry]) => {
      switch (name) {
        case "intent_index":
        case "use_index":
          return isInt(entry) && entry >= 0;
        case "side":
          return entry === "foreground" || entry === "background";
        case "use_kind":
          return entry === "evidence" || entry === "claim";
        case "reference":
          return entry === "direction_envelope";
        default:
          return false;
      }
    });
  });
}

// ---- door S: supplied-snapshot classification (pure EXAMPLES; not convergence, re-entry or a database read) ---------------------------------------
export interface DirectionRows {
  readonly artifacts: readonly Obj[];
  readonly versions: readonly Obj[];
  readonly intents: readonly Obj[];
  readonly gate_results: readonly Obj[];
}
export interface DirectionRowPins {
  /** The complete expected carrier: one artifact, one version, N intents, seven Performance gate rows. */
  readonly expected: DirectionRows;
  readonly script_version_id: string;
  /** The expected four-key Performance fingerprint of the expected carrier. */
  readonly fingerprint: string;
  readonly historical: {
    readonly artifact_ids: readonly string[];
    readonly version_ids: readonly string[];
    readonly gate_result_ids: readonly string[];
  };
}
export type DirectionRowClass =
  | "none"
  | "exact"
  | "partial"
  | "conflict"
  | "stale"
  | "foreign"
  | "historical";
/**
 * A labelled classification of a SUPPLIED list of rows (priority: conflict, stale, foreign, partial, then exact; with nothing but historical rows
 * `historical`, with nothing at all `none`). It proves nothing about a database, a write, a re-entry or a final check: that contract is deferred.
 */
export function classifyDirectionRows(
  snapshot: DirectionRows,
  pins: DirectionRowPins,
): DirectionRowClass {
  const expectedVersion: Obj = pins.expected.versions[0] ?? {};
  const expectedArtifact: Obj = pins.expected.artifacts[0] ?? {};
  const expectedDefinitions = new Set(
    pins.expected.gate_results.map((row) => row.gate_definition_id),
  );
  const tables: [keyof DirectionRows, string, readonly string[]][] = [
    ["artifacts", "artifact_id", pins.historical.artifact_ids],
    [
      "versions",
      "performance_direction_version_id",
      pins.historical.version_ids,
    ],
    ["intents", "performance_intent_id", []],
    ["gate_results", "gate_result_id", pins.historical.gate_result_ids],
  ];
  let conflict = false;
  let stale = false;
  let foreign = false;
  let extras = false;
  let matched = 0;
  let historical = 0;
  const satisfied = new Set<string>();
  for (const [table, idKey, historicalIds] of tables) {
    const expectedById = new Map<string, string>(
      pins.expected[table].map((row): [string, string] => [
        String(row[idKey]),
        canonicalJson(row),
      ]),
    );
    for (const row of snapshot[table]) {
      const id = String(row[idKey]);
      if (historicalIds.includes(id)) {
        historical += 1;
        continue;
      }
      const wanted = expectedById.get(id);
      if (wanted !== undefined) {
        // each expected identity is satisfied once per table: a repeat is a duplicate extra, never a second satisfied expected row
        if (canonicalJson(row) !== wanted) conflict = true;
        else if (satisfied.has(`${table}|${id}`)) extras = true;
        else {
          satisfied.add(`${table}|${id}`);
          matched += 1;
        }
        continue;
      }
      if (table === "artifacts") {
        if (row.artifact_type === "performance_direction") {
          if (row.content_hash !== expectedArtifact.content_hash) stale = true;
          else foreign = true;
        }
      } else if (table === "versions") {
        if (row.script_version_id === pins.script_version_id) foreign = true;
      } else if (table === "intents") {
        if (
          row.performance_direction_version_id ===
          expectedVersion.performance_direction_version_id
        )
          extras = true;
      } else if (expectedDefinitions.has(row.gate_definition_id)) {
        if (row.input_fingerprint !== pins.fingerprint) stale = true;
        else foreign = true;
      }
    }
  }
  const total = tables.reduce(
    (sum, [table]) => sum + pins.expected[table].length,
    0,
  );
  if (conflict) return "conflict";
  if (stale) return "stale";
  if (foreign) return "foreign";
  if (extras || (matched > 0 && matched < total)) return "partial";
  if (matched === total && total > 0) return "exact";
  return historical > 0 ? "historical" : "none";
}
