// Verifies PR36's original request identities against the frozen Fixture0.4.6 synthetic responses.
// Historical verification only: no TTS, provider, database, take allocation or clearance.
// Contract and limits: docs/frozen-render046-responses.md.
import { planFrozenFixture046Render } from "./frozen-render046.js";
import {
  reconcileFrozenFixture046Responses,
  type HistoricalEvidence,
  type LineageCode,
  type LineagePhase,
  type LineageResponse,
  type PlanIdentity,
} from "./frozen-render046-response-lineage.js";
import {
  fixturePack,
  loadFixtureBytes,
  loadFixtureJson,
  loadFoundationRows,
} from "../fixture/loader.js";
import { FIXTURE_V046_PINS } from "../fixture/pins.js";
import type { Tables } from "../fixture/rows.js";

const PROFILE = "frozen-fixture046-response-lineage/1" as const;
const PLANNER_PROFILE = "frozen-fixture046-render-planning/1" as const;
const MAPPING_MEMBER = "fixture_persistence_conformance.json";
// The only response members this operation reads. The core repeats this list to reject any other set.
const WAV_MEMBERS: readonly string[] = [
  "fixture_audio/rb01_take0.wav",
  "fixture_audio/rb02_take0.wav",
  "fixture_audio/rb03_take0.wav",
  "fixture_audio/rb04_take0.wav",
  "fixture_audio/rb05_take0.wav",
  "fixture_audio/rb06_take0.wav",
  "fixture_audio/rb06_take1.wav",
  "fixture_audio/rb07_take0.wav",
  "fixture_audio/rb08_take0.wav",
  "fixture_audio/rb09_take0.wav",
];
const INVOCATION_KEYS = ["profile", "purpose", "environment"] as const;
const UUID_FORM =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH_FORM = /^[0-9a-f]{64}$/;
const REQUEST_HASH_FORM = /^v1:[0-9a-f]{64}$/;
const PLANNED_COUNT = 9;

export interface FrozenResponseLineageInvocation {
  profile: typeof PROFILE;
  purpose: "fixture_conformance";
  environment: "test";
}

export type FrozenResponseLineageResult =
  | {
      readonly status: "blocked";
      readonly profile: typeof PROFILE;
      readonly code: LineageCode;
      readonly phase: LineagePhase;
    }
  | {
      readonly status: "fixture_response_lineage_pass";
      readonly profile: typeof PROFILE;
      readonly historical_synthetic_verification: true;
      readonly non_clearance: {
        readonly provider_call_authority: false;
        readonly new_take_allocated: false;
        readonly reroll_authorized: false;
        readonly take_selection: false;
        readonly assembly: false;
        readonly ready: false;
        readonly semantic_clearance: false;
        readonly production_clearance: false;
        readonly generated_audio: false;
        readonly speech_fidelity_claimed: false;
        readonly product_duration_claimed: false;
      };
      readonly plan_binding: {
        readonly semantic_manifest_hash: string;
        readonly render_gate_fingerprint: string;
        readonly request_count: 9;
      };
      readonly source_receipt: {
        readonly snapshot: "process_cached_verified_pack";
        readonly zip_sha256: string;
        readonly pack_members_sha256: string;
      };
      readonly responses: readonly LineageResponse[];
      readonly historical_evidence: HistoricalEvidence;
    };

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function blocked(
  code: LineageCode,
  phase: LineagePhase,
): FrozenResponseLineageResult {
  return deepFreeze({
    status: "blocked" as const,
    profile: PROFILE,
    code,
    phase,
  });
}

function safeRuntimeConfiguration(): boolean {
  // Narrow read of the existing src/config.ts setting names; not loadConfig, not credentials, not an injected environment.
  return (
    process.env.DESK_ENV === "test" &&
    process.env.PROVIDERS_ENABLED === "false" &&
    process.env.GENERATION_KILL_SWITCH === "true"
  );
}

/** Exact own data properties only; an accessor is never invoked and caller literals never establish the environment. */
function isValidInvocation(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const own = Reflect.ownKeys(value);
  if (own.length !== INVOCATION_KEYS.length) return false;
  const data: Record<string, unknown> = {};
  for (const key of INVOCATION_KEYS) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) return false;
    if (descriptor.enumerable !== true) return false;
    data[key] = descriptor.value;
  }
  return (
    data.profile === PROFILE &&
    data.purpose === "fixture_conformance" &&
    data.environment === "test"
  );
}

function ownValue(source: unknown, key: string): unknown {
  if (typeof source !== "object" || source === null) return undefined;
  const descriptor = Reflect.getOwnPropertyDescriptor(source, key);
  if (descriptor === undefined || !("value" in descriptor)) return undefined;
  return descriptor.value;
}

/** The nine own elements of a dense array carrier; undefined for anything else (holes, extras, other lengths). */
function nineItems(value: unknown): unknown[] | undefined {
  if (!Array.isArray(value) || value.length !== PLANNED_COUNT) return undefined;
  if (Reflect.getPrototypeOf(value) !== Array.prototype) return undefined;
  if (Reflect.ownKeys(value).length !== PLANNED_COUNT + 1) return undefined;
  const items: unknown[] = [];
  for (let index = 0; index < PLANNED_COUNT; index++) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor)) return undefined;
    items.push(descriptor.value);
  }
  return items;
}

function isForm(value: unknown, form: RegExp): value is string {
  return typeof value === "string" && form.test(value);
}

/**
 * Extracts the nine request identities from the planner result this invocation obtained itself. Only the planner's
 * exact synthetic success carrier is accepted, with identity forms checked here so a malformed carrier is refused
 * before any archive read; the pure core repeats the form checks for its own separately callable input. The planner's
 * source admission is not repeated and no caller-supplied eleven-field projection is ever read.
 */
function extractPlanIdentity(planned: unknown): PlanIdentity | undefined {
  if (
    ownValue(planned, "status") !== "fixture_render_planning_pass" ||
    ownValue(planned, "profile") !== PLANNER_PROFILE ||
    ownValue(planned, "fixture_stub") !== true ||
    ownValue(planned, "semantic_clearance") !== false ||
    ownValue(planned, "production_clearance") !== false
  )
    return undefined;
  const requests = nineItems(ownValue(planned, "requests"));
  const manifest = ownValue(planned, "semantic_manifest");
  const blocks = nineItems(ownValue(manifest, "render_blocks"));
  if (requests === undefined || blocks === undefined) return undefined;
  const adapter = ownValue(ownValue(blocks[0], "provider"), "provider");
  const model = ownValue(
    ownValue(blocks[0], "provider"),
    "concrete_model_identity",
  );
  const sameProvider = blocks.every(
    (block) =>
      ownValue(ownValue(block, "provider"), "provider") === adapter &&
      ownValue(ownValue(block, "provider"), "concrete_model_identity") ===
        model,
  );
  const version = ownValue(manifest, "adapter_contract_version");
  const manifestHash = ownValue(planned, "semantic_manifest_hash");
  const gateFingerprint = ownValue(planned, "render_gate_fingerprint");
  if (
    !sameProvider ||
    typeof adapter !== "string" ||
    typeof model !== "string" ||
    typeof version !== "string" ||
    !isForm(manifestHash, HASH_FORM) ||
    !isForm(gateFingerprint, HASH_FORM)
  )
    return undefined;
  const identities: PlanIdentity["requests"][number][] = [];
  for (const [index, request] of requests.entries()) {
    const programBlockId = ownValue(request, "program_block_id");
    const baseRequestHash = ownValue(request, "base_request_hash");
    if (
      !isForm(programBlockId, UUID_FORM) ||
      !isForm(baseRequestHash, REQUEST_HASH_FORM)
    )
      return undefined;
    identities.push({
      block_ordinal: index + 1,
      program_block_id: programBlockId,
      base_request_hash: baseRequestHash,
    });
  }
  return {
    adapter,
    concrete_model_identity: model,
    adapter_render_contract_version: version,
    semantic_manifest_hash: manifestHash,
    render_gate_fingerprint: gateFingerprint,
    requests: identities,
  };
}

/**
 * Verifies, for the original seventeen-turn Fixture0.4.6 subject, that the nine independently derived render requests
 * reconcile to the ten frozen historical synthetic responses and their shipped WAV bytes.
 *
 * The argument must be exactly the three-key invocation (own data properties only); a receipt, hash or path is never
 * accepted. The planner is called here and reads its fixed sources; response members are read only through the
 * existing process-cached verified fixture pack, so the receipt describes that cached snapshot, not a fresh disk read.
 * Settings are read before acquisition and again before success. The result is deeply frozen, serializable,
 * synthetic and historical: it generates no audio, allocates no take, authorizes no provider call, selection,
 * assembly or READY, and is not technical acceptance. Blocked results are exactly status/profile/code/phase with
 * detail text deliberately withheld.
 */
export async function verifyFrozenFixture046ResponseLineage(
  input: unknown,
): Promise<FrozenResponseLineageResult> {
  let phase: LineagePhase = "invocation_context";
  try {
    if (!isValidInvocation(input)) return blocked("invalid_invocation", phase);
    if (!safeRuntimeConfiguration())
      return blocked("unsafe_runtime_configuration", phase);

    phase = "request_plan";
    // The planner result is data to tie to pinned history, never a permission supplied by the caller.
    const planned: unknown = await planFrozenFixture046Render({
      profile: PLANNER_PROFILE,
      purpose: "fixture_conformance",
      environment: "test",
    });
    if (ownValue(planned, "status") === "blocked")
      return blocked("request_plan_blocked", phase);
    const plan = extractPlanIdentity(planned);
    if (plan === undefined) return blocked("plan_identity_invalid", phase);

    phase = "response_source";
    let mapping: unknown;
    const wavs: { path: string; bytes: Uint8Array }[] = [];
    try {
      // Opens, or reuses, the process-cached verified pack so a pack fault is refused before any member read.
      fixturePack();
      mapping = loadFixtureJson(MAPPING_MEMBER);
      for (const path of WAV_MEMBERS)
        wavs.push({ path, bytes: loadFixtureBytes(path) });
    } catch {
      // Any pack, mapping or WAV read fault is one sanitized refusal; detail text is not inspected.
      return blocked("response_source_invalid", phase);
    }
    let tables: Tables;
    try {
      tables = loadFoundationRows().tables;
    } catch {
      return blocked("historical_rows_invalid", phase);
    }

    const reconciled = reconcileFrozenFixture046Responses({
      plan,
      mapping,
      tables,
      wavs,
    });
    if (reconciled.status === "invalid")
      return blocked(reconciled.code, reconciled.phase);

    // Settings may change during acquisition, so success is released only after observing them again.
    phase = "invocation_context";
    if (!safeRuntimeConfiguration())
      return blocked("unsafe_runtime_configuration", phase);
    return deepFreeze({
      status: "fixture_response_lineage_pass" as const,
      profile: PROFILE,
      historical_synthetic_verification: true as const,
      non_clearance: {
        provider_call_authority: false as const,
        new_take_allocated: false as const,
        reroll_authorized: false as const,
        take_selection: false as const,
        assembly: false as const,
        ready: false as const,
        semantic_clearance: false as const,
        production_clearance: false as const,
        generated_audio: false as const,
        speech_fidelity_claimed: false as const,
        product_duration_claimed: false as const,
      },
      plan_binding: {
        semantic_manifest_hash: plan.semantic_manifest_hash,
        render_gate_fingerprint: plan.render_gate_fingerprint,
        request_count: 9 as const,
      },
      source_receipt: {
        snapshot: "process_cached_verified_pack" as const,
        zip_sha256: FIXTURE_V046_PINS.zipSha256,
        pack_members_sha256: FIXTURE_V046_PINS.packMembersSha256,
      },
      responses: [...reconciled.responses],
      historical_evidence: { ...reconciled.historical_evidence },
    });
  } catch {
    // Unexpected faults outside the listed boundary catches never become success and are never reflected.
    return blocked("unexpected_failure", phase);
  }
}
