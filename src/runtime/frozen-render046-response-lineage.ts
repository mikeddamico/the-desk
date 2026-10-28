// Pure reconciliation of PR36's request identities with the frozen Fixture0.4.6 response mapping.
// Reads no file, environment, database or provider. Contract: docs/frozen-render046-responses.md.
import { verifyLedger } from "../fixture/ledger.js";
import { measureCanonicalPcm } from "./audio-measurements.js";
import { isRecord, type JsonObject } from "../identity/select.js";
import type { Tables } from "../fixture/rows.js";

export type LineagePhase =
  | "invocation_context"
  | "request_plan"
  | "response_source"
  | "input_closure"
  | "mapping_shape"
  | "historical_ledger"
  | "request_identity"
  | "response_bytes"
  | "historical_evidence";

export type LineageCode =
  | "invalid_invocation"
  | "unsafe_runtime_configuration"
  | "request_plan_blocked"
  | "plan_identity_invalid"
  | "response_source_invalid"
  | "historical_rows_invalid"
  | "input_shape_invalid"
  | "mapping_shape_invalid"
  | "mapping_duplicate_identity"
  | "adapter_identity_mismatch"
  | "adapter_contract_version_mismatch"
  | "historical_ledger_mismatch"
  | "request_block_mismatch"
  | "request_identity_unmapped"
  | "response_bytes_invalid"
  | "response_bytes_mismatch"
  | "historical_evidence_mismatch"
  | "unexpected_failure";

/** The nine request identities and adapter labels the wrapper extracts from its own planner result. */
export interface PlanIdentity {
  adapter: string;
  concrete_model_identity: string;
  adapter_render_contract_version: string;
  semantic_manifest_hash: string;
  render_gate_fingerprint: string;
  requests: readonly {
    block_ordinal: number;
    program_block_id: string;
    base_request_hash: string;
  }[];
}

export interface LineageResponse {
  readonly block_ordinal: number;
  readonly program_block_id: string;
  readonly base_request_hash: string;
  readonly historical_take_index: number;
  readonly logical_request_key: string;
  readonly historical_provider_call_id: string;
  readonly historical_succeeded_event_id: string;
  readonly historical_response_artifact_id: string;
  readonly historical_audio_row_id: string;
  readonly historical_render_take_id: string;
  readonly wav: {
    readonly member_path: string;
    readonly byte_length: string;
    readonly frame_count: string;
    readonly sha256: string;
    readonly sample_rate_hz: 48000;
    readonly channels: 1;
  };
  readonly provenance: "historical_fixture_v0.4.6_synthetic_response";
  readonly relabeled_as_new_generation: false;
  readonly technical_acceptance: "not_evaluated";
}

export interface HistoricalEvidence {
  readonly rb06_take0_recorded_observation_matches_measured_bytes: true;
  readonly mechanical_validation_artifact_id: string;
}

export type ReconcileResult =
  | {
      readonly authority: "none";
      readonly status: "reconciled";
      readonly responses: readonly LineageResponse[];
      readonly historical_evidence: HistoricalEvidence;
    }
  | {
      readonly authority: "none";
      readonly status: "invalid";
      readonly code: LineageCode;
      readonly phase: LineagePhase;
    };

// The only response members this operation may select. Mapping paths are compared with this list, never opened.
const WAV_PATHS: readonly string[] = [
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
const UUID_FORM =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH_FORM = /^[0-9a-f]{64}$/;
const REQUEST_HASH_FORM = /^v1:[0-9a-f]{64}$/;
const LOGICAL_KEY_FORM = /^v1:[0-9a-f]{64}:[01]$/;
const ENTRY_KEYS = [
  "adapter",
  "adapter_render_contract_version",
  "audio_row_id",
  "base_request_hash",
  "concrete_model_identity",
  "intentional_take_index",
  "logical_request_key",
  "provider_call_id",
  "receipt",
  "render_take_id",
  "response_artifact_id",
  "succeeded_event_id",
  "wav_byte_length",
  "wav_frames",
  "wav_member_path",
  "wav_sha256",
] as const;
const RECEIPT_KEYS = [
  "basis",
  "claims_audible_performance_fidelity",
  "kind",
  "live_provider_contacted",
  "predecessor_receipt_relabeled_as_new_generation",
  "source_bytes_provenance",
  "synthetic",
] as const;
// Shipped historical receipt text, compared verbatim so a relabel is a refusal.
const RECEIPT_BASIS =
  "P&R 20.1: explicit frozen request-to-response mapping; identical WAV bytes are not evidence of the corrected performance";
const RECEIPT_PROVENANCE =
  "predecessor Fixture v0.4.4 WAV member, byte-identical, preserved in I2A authored/fixture_audio";
const ADAPTER = "fixture_tts";
const MODEL = "fixture-model-1.0";
// verifyLedger never inspects the adapter render-contract version, so it is checked here.
const ADAPTER_CONTRACT_VERSION = "fixture-adapter-contract-v2";
// Synthetic Fixture0.4.6 test setting recorded in the rb06 mechanical-validation evidence; not a product speaking-rate rule.
const RB06_RECORDED_MINIMUM_FRAMES = 6959;
const RECORDED_COMPARISON_RULE = "observed_frames < minimum_required_frames";
const RECORDED_OBSERVATION_METHOD =
  "RIFF data-chunk length / block_align from raw bytes";
const MAX_NODES = 100_000;
const MAX_DEPTH = 16;

class Refusal extends Error {
  constructor(
    readonly code: LineageCode,
    readonly phase: LineagePhase,
  ) {
    super(code);
  }
}

function refuse(code: LineageCode, phase: LineagePhase): never {
  throw new Refusal(code, phase);
}

/** Own data values of an ordinary object with exactly `keys`; accessors are never invoked. */
function exactData(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return undefined;
  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length) return undefined;
  const data: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) return undefined;
    data[key] = descriptor.value;
  }
  return data;
}

/** Own element values of a dense ordinary array; holes, extra properties and accessors are refused. */
function denseData(value: unknown): unknown[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (Reflect.getPrototypeOf(value) !== Array.prototype) return undefined;
  const own = Reflect.ownKeys(value);
  if (own.length !== value.length + 1) return undefined;
  const elements: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor)) return undefined;
    elements.push(descriptor.value);
  }
  return elements;
}

// One budget covers the whole input bundle. Counting convention: the bundle itself is the root node at depth 0; every
// object, array and scalar below it counts once per occurrence at its depth. The `bytes` slot of an admitted WAV record
// is a single leaf node whose contents are never traversed (the measurer owns byte refusals).
interface Budget {
  nodes: number;
}

/** Counts one node at `depth`; false once the whole-bundle node or depth limit is exceeded. */
function charge(budget: Budget, depth: number): boolean {
  budget.nodes++;
  return budget.nodes <= MAX_NODES && depth <= MAX_DEPTH;
}

/** True when `value` is JSON-like plain data within the shared budget. Not hostile-process isolation. */
function isPlainData(value: unknown, budget: Budget, depth: number): boolean {
  if (!charge(budget, depth)) return false;
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) {
    // Every element is at least one node, so an oversized array is refused before any element is copied.
    if (budget.nodes + value.length > MAX_NODES) return false;
    const elements = denseData(value);
    if (elements === undefined) return false;
    return elements.every((element) => isPlainData(element, budget, depth + 1));
  }
  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value);
  if (budget.nodes + keys.length > MAX_NODES) return false;
  for (const key of keys) {
    if (typeof key !== "string") return false;
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) return false;
    if (!isPlainData(descriptor.value, budget, depth + 1)) return false;
  }
  return true;
}

interface ValidEntry {
  raw: JsonObject;
  adapter: string;
  adapterContractVersion: string;
  audioRowId: string;
  baseRequestHash: string;
  concreteModelIdentity: string;
  takeIndex: number;
  logicalRequestKey: string;
  providerCallId: string;
  renderTakeId: string;
  responseArtifactId: string;
  succeededEventId: string;
  byteLength: number;
  frames: number;
  path: string;
  sha256: string;
}

function isForm(value: unknown, form: RegExp): value is string {
  return typeof value === "string" && form.test(value);
}

function isIntegerIn(
  value: unknown,
  low: number,
  high: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= low &&
    value <= high
  );
}

function validateEntry(raw: unknown): ValidEntry {
  const refuseShape = (): never =>
    refuse("mapping_shape_invalid", "mapping_shape");
  const data = exactData(raw, ENTRY_KEYS);
  if (data === undefined) return refuseShape();
  const receipt = exactData(data.receipt, RECEIPT_KEYS);
  const takeIndex = data.intentional_take_index;
  if (
    typeof data.adapter !== "string" ||
    typeof data.adapter_render_contract_version !== "string" ||
    typeof data.concrete_model_identity !== "string" ||
    !isForm(data.audio_row_id, UUID_FORM) ||
    !isForm(data.base_request_hash, REQUEST_HASH_FORM) ||
    !isIntegerIn(takeIndex, 0, 1) ||
    !isForm(data.logical_request_key, LOGICAL_KEY_FORM) ||
    !isForm(data.provider_call_id, UUID_FORM) ||
    !isForm(data.render_take_id, UUID_FORM) ||
    !isForm(data.response_artifact_id, UUID_FORM) ||
    !isForm(data.succeeded_event_id, UUID_FORM) ||
    !isIntegerIn(data.wav_byte_length, 45, 8_388_608) ||
    !isIntegerIn(data.wav_frames, 1, 4_194_282) ||
    typeof data.wav_member_path !== "string" ||
    !WAV_PATHS.includes(data.wav_member_path) ||
    !isForm(data.wav_sha256, HASH_FORM)
  )
    return refuseShape();
  if (
    receipt?.basis !== RECEIPT_BASIS ||
    receipt.claims_audible_performance_fidelity !== false ||
    receipt.kind !== "synthetic_fixture_adapter_receipt" ||
    receipt.live_provider_contacted !== false ||
    receipt.predecessor_receipt_relabeled_as_new_generation !== false ||
    receipt.source_bytes_provenance !== RECEIPT_PROVENANCE ||
    receipt.synthetic !== true
  )
    return refuseShape();
  return {
    raw: raw as JsonObject,
    adapter: data.adapter,
    adapterContractVersion: data.adapter_render_contract_version,
    audioRowId: data.audio_row_id,
    baseRequestHash: data.base_request_hash,
    concreteModelIdentity: data.concrete_model_identity,
    takeIndex,
    logicalRequestKey: data.logical_request_key,
    providerCallId: data.provider_call_id,
    renderTakeId: data.render_take_id,
    responseArtifactId: data.response_artifact_id,
    succeededEventId: data.succeeded_event_id,
    byteLength: data.wav_byte_length,
    frames: data.wav_frames,
    path: data.wav_member_path,
    sha256: data.wav_sha256,
  };
}

interface ValidInput {
  plan: PlanIdentity;
  mapping: unknown;
  tables: Tables;
  wavBytes: ReadonlyMap<string, unknown>;
}

function validateInput(input: unknown): ValidInput {
  const refuseInput = (): never =>
    refuse("input_shape_invalid", "input_closure");
  const top = exactData(input, ["plan", "mapping", "tables", "wavs"]);
  if (top === undefined) return refuseInput();
  const budget: Budget = { nodes: 1 };
  if (
    !isPlainData(top.plan, budget, 1) ||
    !isPlainData(top.mapping, budget, 1) ||
    !isPlainData(top.tables, budget, 1) ||
    !isRecord(top.tables)
  )
    return refuseInput();
  const plan = exactData(top.plan, [
    "adapter",
    "concrete_model_identity",
    "adapter_render_contract_version",
    "semantic_manifest_hash",
    "render_gate_fingerprint",
    "requests",
  ]);
  if (
    plan === undefined ||
    typeof plan.adapter !== "string" ||
    typeof plan.concrete_model_identity !== "string" ||
    typeof plan.adapter_render_contract_version !== "string" ||
    !isForm(plan.semantic_manifest_hash, HASH_FORM) ||
    !isForm(plan.render_gate_fingerprint, HASH_FORM) ||
    !Array.isArray(plan.requests) ||
    plan.requests.length !== 9
  )
    return refuseInput();
  const requests = (plan.requests as unknown[]).map((request, index) => {
    const data = exactData(request, [
      "block_ordinal",
      "program_block_id",
      "base_request_hash",
    ]);
    if (
      data?.block_ordinal !== index + 1 ||
      !isForm(data.program_block_id, UUID_FORM) ||
      !isForm(data.base_request_hash, REQUEST_HASH_FORM)
    )
      return refuseInput();
    return {
      block_ordinal: index + 1,
      program_block_id: data.program_block_id,
      base_request_hash: data.base_request_hash,
    };
  });
  // The wavs array is a node at depth 1; each record, its path and its bytes slot follow at depths 2 and 3.
  if (!charge(budget, 1)) return refuseInput();
  if (!Array.isArray(top.wavs) || top.wavs.length !== WAV_PATHS.length)
    return refuseInput();
  const wavs = denseData(top.wavs);
  if (wavs === undefined) return refuseInput();
  const wavBytes = new Map<string, unknown>();
  for (const wav of wavs) {
    if (!charge(budget, 2) || !charge(budget, 3) || !charge(budget, 3))
      return refuseInput();
    const data = exactData(wav, ["path", "bytes"]);
    if (
      data === undefined ||
      typeof data.path !== "string" ||
      !WAV_PATHS.includes(data.path) ||
      wavBytes.has(data.path)
    )
      return refuseInput();
    wavBytes.set(data.path, data.bytes);
  }
  return {
    plan: {
      adapter: plan.adapter,
      concrete_model_identity: plan.concrete_model_identity,
      adapter_render_contract_version: plan.adapter_render_contract_version,
      semantic_manifest_hash: plan.semantic_manifest_hash,
      render_gate_fingerprint: plan.render_gate_fingerprint,
      requests,
    },
    mapping: top.mapping,
    tables: top.tables as Tables,
    wavBytes,
  };
}

function validateMapping(mapping: unknown, plan: PlanIdentity): ValidEntry[] {
  const container = exactData(mapping, ["entries"]);
  const rawEntries = container === undefined ? undefined : container.entries;
  if (!Array.isArray(rawEntries) || rawEntries.length !== 10)
    return refuse("mapping_shape_invalid", "mapping_shape");
  const entries = (rawEntries as unknown[]).map(validateEntry);
  const uniqueFields: readonly ((entry: ValidEntry) => string)[] = [
    (entry) => entry.providerCallId,
    (entry) => entry.succeededEventId,
    (entry) => entry.responseArtifactId,
    (entry) => entry.audioRowId,
    (entry) => entry.renderTakeId,
    (entry) => entry.logicalRequestKey,
    (entry) => entry.path,
    (entry) => entry.sha256,
  ];
  for (const select of uniqueFields)
    if (new Set(entries.map(select)).size !== entries.length)
      refuse("mapping_duplicate_identity", "mapping_shape");
  for (const entry of entries)
    if (
      entry.adapter !== ADAPTER ||
      entry.adapter !== plan.adapter ||
      entry.concreteModelIdentity !== MODEL ||
      entry.concreteModelIdentity !== plan.concrete_model_identity
    )
      refuse("adapter_identity_mismatch", "mapping_shape");
  for (const entry of entries)
    if (
      entry.adapterContractVersion !== ADAPTER_CONTRACT_VERSION ||
      entry.adapterContractVersion !== plan.adapter_render_contract_version
    )
      refuse("adapter_contract_version_mismatch", "mapping_shape");
  return entries;
}

function orderedBlocks(tables: Tables): readonly JsonObject[] {
  const rows = tables.render_blocks ?? [];
  return [...rows].sort(
    (left, right) => Number(left.sequence) - Number(right.sequence),
  );
}

interface JoinedResponse {
  ordinal: number;
  programBlockId: string;
  entry: ValidEntry;
}

/** Responses in (block ordinal, take index) order; each plan request must match its historical block row. */
function joinRequests(
  plan: PlanIdentity,
  entries: readonly ValidEntry[],
  tables: Tables,
): JoinedResponse[] {
  const blocks = orderedBlocks(tables);
  if (blocks.length !== plan.requests.length)
    refuse("request_block_mismatch", "request_identity");
  for (const [index, request] of plan.requests.entries()) {
    const block = blocks[index];
    // The historical sequence must be exactly the integer ordinal, not merely sort into place.
    if (
      block?.program_block_id !== request.program_block_id ||
      block.sequence !== index + 1
    )
      refuse("request_block_mismatch", "request_identity");
  }
  const joined: JoinedResponse[] = [];
  for (const [index, request] of plan.requests.entries()) {
    if (blocks[index]?.base_request_hash !== request.base_request_hash)
      refuse("request_identity_unmapped", "request_identity");
    const takes = entries
      .filter((entry) => entry.baseRequestHash === request.base_request_hash)
      .sort((left, right) => left.takeIndex - right.takeIndex);
    if (takes.length === 0)
      refuse("request_identity_unmapped", "request_identity");
    for (const entry of takes)
      joined.push({
        ordinal: request.block_ordinal,
        programBlockId: request.program_block_id,
        entry,
      });
  }
  if (joined.length !== entries.length)
    refuse("request_identity_unmapped", "request_identity");
  return joined;
}

interface MeasuredResponse {
  response: LineageResponse;
  frameCount: string;
  sha256: string;
}

/** Measures one WAV once and compares it with its mapping entry; the first bad response wins. */
function measureResponse(
  item: JoinedResponse,
  bytes: unknown,
): MeasuredResponse {
  const { entry } = item;
  const measured = measureCanonicalPcm(bytes);
  if (measured.kind !== "measured")
    return refuse("response_bytes_invalid", "response_bytes");
  // Canonical decimal text only: no quantity conversion and no duration claim.
  if (
    measured.sha256 !== entry.sha256 ||
    measured.byte_length !== String(entry.byteLength) ||
    measured.frame_count !== String(entry.frames)
  )
    return refuse("response_bytes_mismatch", "response_bytes");
  return {
    frameCount: measured.frame_count,
    sha256: measured.sha256,
    response: {
      block_ordinal: item.ordinal,
      program_block_id: item.programBlockId,
      base_request_hash: entry.baseRequestHash,
      historical_take_index: entry.takeIndex,
      logical_request_key: entry.logicalRequestKey,
      historical_provider_call_id: entry.providerCallId,
      historical_succeeded_event_id: entry.succeededEventId,
      historical_response_artifact_id: entry.responseArtifactId,
      historical_audio_row_id: entry.audioRowId,
      historical_render_take_id: entry.renderTakeId,
      wav: {
        member_path: entry.path,
        byte_length: measured.byte_length,
        frame_count: measured.frame_count,
        sha256: measured.sha256,
        sample_rate_hz: 48000,
        channels: 1,
      },
      provenance: "historical_fixture_v0.4.6_synthetic_response",
      relabeled_as_new_generation: false,
      technical_acceptance: "not_evaluated",
    },
  };
}

/**
 * Ties the old rb06 truncation evidence to the measured take-0 bytes. This verifies recorded fixture evidence only:
 * it creates no validation result, acceptance, reroll or selection, and the recorded minimum is not output.
 */
function verifyHistoricalEvidence(
  tables: Tables,
  take0: MeasuredResponse,
): HistoricalEvidence {
  const refuseEvidence = (): never =>
    refuse("historical_evidence_mismatch", "historical_evidence");
  const triggers = tables.reroll_triggers ?? [];
  const trigger = triggers[0];
  if (triggers.length !== 1 || trigger === undefined) return refuseEvidence();
  const matches = (tables.artifacts ?? []).filter(
    (artifact) => artifact.artifact_id === trigger.validation_artifact_id,
  );
  const artifact = matches[0];
  if (
    matches.length !== 1 ||
    artifact?.artifact_type !== "mechanical_validation" ||
    typeof artifact.artifact_id !== "string" ||
    !isRecord(artifact.canonical_payload)
  )
    return refuseEvidence();
  // The evidence lives in the artifact's canonical_payload, not on the artifact row itself.
  const payload = artifact.canonical_payload;
  const measurements = exactData(payload.measurements, [
    "comparison_rule",
    "minimum_required_frames",
    "observation_method",
    "observed_frames",
    "synthetic_fixture_threshold",
  ]);
  if (measurements === undefined) return refuseEvidence();
  const observed = measurements.observed_frames;
  if (
    measurements.comparison_rule !== RECORDED_COMPARISON_RULE ||
    measurements.observation_method !== RECORDED_OBSERVATION_METHOD ||
    measurements.synthetic_fixture_threshold !== true ||
    measurements.minimum_required_frames !== RB06_RECORDED_MINIMUM_FRAMES ||
    !isIntegerIn(observed, 0, Number.MAX_SAFE_INTEGER) ||
    String(observed) !== take0.frameCount ||
    observed >= RB06_RECORDED_MINIMUM_FRAMES ||
    payload.take_index !== 0 ||
    payload.audio_sha256 !== take0.sha256
  )
    return refuseEvidence();
  return {
    rb06_take0_recorded_observation_matches_measured_bytes: true,
    mechanical_validation_artifact_id: artifact.artifact_id,
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * Reconciles a closed plain-data bundle: the planner's nine request identities, the response mapping, the historical
 * rows and the ten WAV copies. Pure and synchronous. Every result carries authority "none": caller-supplied data is
 * never promotable to the wrapper's public success, and a reconciled result grants nothing. Refusals are closed
 * code/phase pairs; message text from helpers is deliberately never reflected.
 */
export function reconcileFrozenFixture046Responses(
  input: unknown,
): ReconcileResult {
  let phase: LineagePhase = "input_closure";
  try {
    const valid = validateInput(input);
    phase = "mapping_shape";
    const entries = validateMapping(valid.mapping, valid.plan);
    phase = "historical_ledger";
    try {
      verifyLedger(
        valid.tables,
        entries.map((entry) => entry.raw),
      );
    } catch {
      // Ordinary ledger refusals and ledger faults share one sanitized refusal; their detail text is withheld.
      return refuse("historical_ledger_mismatch", "historical_ledger");
    }
    phase = "request_identity";
    const joined = joinRequests(valid.plan, entries, valid.tables);
    phase = "response_bytes";
    const measured: MeasuredResponse[] = [];
    for (const item of joined)
      measured.push(measureResponse(item, valid.wavBytes.get(item.entry.path)));
    phase = "historical_evidence";
    const take0Index = joined.findIndex(
      (item) => item.ordinal === 6 && item.entry.takeIndex === 0,
    );
    const take0 = measured[take0Index];
    if (take0 === undefined)
      return refuse("request_identity_unmapped", "request_identity");
    const evidence = verifyHistoricalEvidence(valid.tables, take0);
    return deepFreeze({
      authority: "none" as const,
      status: "reconciled" as const,
      responses: measured.map((item) => item.response),
      historical_evidence: evidence,
    });
  } catch (error) {
    const code = error instanceof Refusal ? error.code : "unexpected_failure";
    const where = error instanceof Refusal ? error.phase : phase;
    return deepFreeze({
      authority: "none" as const,
      status: "invalid" as const,
      code,
      phase: where,
    });
  }
}
