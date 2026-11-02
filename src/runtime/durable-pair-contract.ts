/** The one synthetic durable-pair profile. Hashes describe intent, never SQL commit or gate authority. */
import { canonicalJson, domainHash } from "../identity/canonical-json.js";
import { parseLexicalJson } from "../knowledge/lexical-json.js";
import {
  assemblyRecipeHash,
  masterAssemblyMapHash,
} from "../identity/artifacts.js";
import {
  capture,
  object,
  identities,
  checkPolicy,
  measureSubject,
  checkDuration,
  checkMap,
  checkSilence,
  checkLoudness,
  sha,
  type Data,
  type Subject,
} from "./technical-master-checks.js";

export type PairCode =
  | "invalid_invocation"
  | "unsafe_settings"
  | "binding_unavailable"
  | "source_mismatch"
  | "assessment_refused"
  | "cleanup_pending"
  | "identity_conflict"
  | "object_conflict"
  | "storage_timeout"
  | "storage_response_invalid"
  | "storage_readback_invalid"
  | "sql_conflict"
  | "sql_not_committed"
  | "sql_outcome_unknown"
  | "source_changed"
  | "resource_limit"
  | "unexpected_failure";
export type PairPhase =
  | "invocation"
  | "binding"
  | "source"
  | "assessment"
  | "upload"
  | "readback"
  | "sql"
  | "cleanup";
export class PairRefusal extends Error {
  constructor(
    readonly code: PairCode,
    readonly phase: PairPhase,
    readonly pending = false,
  ) {
    super(code);
  }
}
export function requirePair(
  value: unknown,
  code: PairCode,
  phase: PairPhase,
): asserts value {
  if (!value) throw new PairRefusal(code, phase);
}
export function same(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}
export function jsonBytes(value: unknown): Buffer {
  return Buffer.from(canonicalJson(value) + "\n");
}
export function closed(value: unknown, names: readonly string[]): Data {
  const data = object(capture(value));
  requirePair(
    same(Object.keys(data).sort(), [...names].sort()),
    "source_mismatch",
    "source",
  );
  return data;
}
export function parsePairJson(bytes: Buffer): Data {
  requirePair(bytes.length <= 65536, "resource_limit", "source");
  return object(capture(parseLexicalJson(bytes)));
}
export const MANIFEST_SHA =
  "3b2ee2b90bc7a1e1ccfc36c0cff857cce06b5134bb0f066913805af1c7241123";
export const FILES = [
  "SOURCE.json",
  "input-1.wav",
  "input-2.wav",
  "recipe.json",
  "map.json",
  "context.json",
  "policy.json",
  "profile.json",
  "assessment.json",
  "master.wav",
] as const;
export const UPLOAD_ORDER = [
  ...FILES.slice(0, -1),
  "receipt.json",
  "master.wav",
] as const;
export type FileName = (typeof FILES)[number] | "receipt.json";
export type StorageBinding = Readonly<{
  schema: string;
  environment_id: string;
  endpoint_origin: string;
  bucket: string;
  prefix: string;
  credential_reference: string;
  credential_scope_attestation: string;
  private_access_attestation: string;
  retention_attestation: string;
}>;
export type DatabaseBinding = Readonly<{
  schema: string;
  environment_id: string;
  endpoint_host: string;
  endpoint_port: string;
  database_name: string;
  schema_name: string;
  runtime_role: string;
  credential_reference: string;
  schema_identity: string;
}>;
export interface PairBindings {
  storage: StorageBinding;
  database: DatabaseBinding;
}
export interface ObjectIdentity {
  name: FileName;
  byte_length: string;
  raw_sha256: string;
}
export interface PairRows {
  artifacts: Data[];
  audio_artifacts: Data[];
  assembly_recipes: Data[];
  master_assembly_maps: Data[];
}
export interface PairRequest extends Data {
  operation_id: string;
  created_at: string;
  objects: ObjectIdentity[];
  rows: PairRows;
}
export interface PairReceipt extends Data {
  schema: "durable-pair-receipt/1";
  request: PairRequest;
  request_digest: string;
}
export function authored(
  operation: unknown,
  timestamp: unknown,
): { operation_id: string; created_at: string } {
  requirePair(
    typeof operation === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        operation,
      ),
    "invalid_invocation",
    "invocation",
  );
  requirePair(
    typeof timestamp === "string" &&
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(timestamp),
    "invalid_invocation",
    "invocation",
  );
  const milliseconds = timestamp.slice(0, 23) + "Z";
  requirePair(
    Number.isFinite(Date.parse(milliseconds)) &&
      new Date(milliseconds).toISOString() === milliseconds,
    "invalid_invocation",
    "invocation",
  );
  return { operation_id: operation, created_at: timestamp };
}
export function keyFor(
  binding: StorageBinding,
  operation: string,
  name: FileName,
): string {
  requirePair(UPLOAD_ORDER.includes(name), "source_mismatch", "source");
  return binding.prefix + "/operations/" + operation + "/" + name;
}
export function locator(
  binding: StorageBinding,
  operation: string,
  name: FileName,
): string {
  return "r2://" + binding.bucket + "/" + keyFor(binding, operation, name);
}
export function requestHash(request: PairRequest): string {
  return domainHash("durable-pair-request-v1", request);
}
export function receiptHash(receipt: PairReceipt): string {
  return domainHash("durable-pair-receipt-v1", receipt);
}
export function receiptFor(request: PairRequest): PairReceipt {
  return {
    schema: "durable-pair-receipt/1",
    request,
    request_digest: requestHash(request),
  };
}

/** Reconstruct only from actual downloaded buffers and independently pinned SOURCE, never local WAV substitutes. */
export function storedSubject(files: ReadonlyMap<string, Buffer>): Subject {
  const get = (name: string): Buffer => {
    const bytes = files.get(name);
    requirePair(bytes, "source_mismatch", "source");
    return bytes;
  };
  const source = parsePairJson(get("SOURCE.json"));
  const selections = source.selection_records;
  const inputs = source.selected_inputs;
  requirePair(
    Array.isArray(selections) && Array.isArray(inputs) && inputs.length === 2,
    "source_mismatch",
    "source",
  );
  return {
    scope: "synthetic60-positive",
    master: get("master.wav"),
    inputs: inputs.map((record, index) => ({
      record: object(record),
      bytes: get("input-" + String(index + 1) + ".wav"),
    })),
    recipe: parsePairJson(get("recipe.json")),
    map: parsePairJson(get("map.json")),
    context: parsePairJson(get("context.json")),
    policy: parsePairJson(get("policy.json")),
    profile: parsePairJson(get("profile.json")),
    lineage: selections.map((value) => {
      const selection = object(value);
      requirePair(
        selection.authority === "authored-synthetic-selection/1" &&
          selection.decision === "selected_for_synthetic_test" &&
          selection.take_index === 0,
        "source_mismatch",
        "source",
      );
      return {
        render_block_id: selection.render_block_id,
        take_selection_id: selection.take_selection_id,
        render_take_id: selection.render_take_id,
        take_index: selection.take_index,
        audio_sha256: selection.audio_sha256,
      };
    }),
    assemblyPolicy: "performance-render-0.1.4",
    gateSet: "technical-master-positive-test-gates-1",
  };
}
export function verifyFixedFiles(
  files: ReadonlyMap<string, Buffer>,
  manifest: Data,
  withObservation = true,
): void {
  let total = 0;
  for (const name of FILES) {
    if (!withObservation && name === "assessment.json") continue;
    const bytes = files.get(name);
    requirePair(bytes, "source_mismatch", "source");
    total += bytes.length;
    requirePair(
      bytes.length <= (name.endsWith(".wav") ? 5760044 : 65536) &&
        total <= 12 * 1024 * 1024,
      "resource_limit",
      "source",
    );
    if (name !== "assessment.json") {
      const pin = closed(manifest[name], ["bytes", "raw_sha256"]);
      requirePair(
        bytes.length === pin.bytes && sha(bytes) === pin.raw_sha256,
        "source_mismatch",
        "source",
      );
    }
  }
}
export function verifyObservation(subject: Subject, value: unknown): Data {
  const observation = closed(value, [
    "schema",
    "profile",
    "candidate_scope",
    "input_fingerprint",
    "checks",
    "measurements",
    "authority",
    "synthetic_only",
  ]);
  requirePair(
    observation.schema === "durable-pair-assessment-observation/1" &&
      observation.profile === "technical-master-admission/1" &&
      observation.candidate_scope === "synthetic60-positive" &&
      observation.authority === "none" &&
      observation.synthetic_only === true,
    "assessment_refused",
    "assessment",
  );
  const checks = closed(observation.checks, [
    "format",
    "duration",
    "map_inputs",
    "decode",
    "loudness",
    "silence",
    "freshness",
  ]);
  requirePair(
    Object.values(checks).every((state) => state === "pass"),
    "assessment_refused",
    "assessment",
  );
  checkPolicy(subject);
  const measured = measureSubject(subject);
  checkDuration(subject, measured.frames);
  checkMap(subject, measured.frames);
  requirePair(
    observation.input_fingerprint ===
      domainHash("technical-master-validation-input-v1", identities(subject)),
    "source_changed",
    "readback",
  );
  const measurements = closed(observation.measurements, [
    "master_sha256",
    "master_bytes",
    "master_frames",
    "decoded_pcm_sha256",
    "decoded_bytes",
    "decoded_frames",
    "integrated_decilufs",
    "longest_unexplained_frames",
    "longest_unexplained_span",
  ]);
  const silence = checkSilence(subject);
  requirePair(
    typeof measurements.integrated_decilufs === "string" &&
      /^(?:0|-?[1-9][0-9]*)$/.test(measurements.integrated_decilufs),
    "assessment_refused",
    "assessment",
  );
  checkLoudness(subject.policy, BigInt(measurements.integrated_decilufs));
  requirePair(
    same(measurements, {
      master_sha256: measured.hash,
      master_bytes: String(measured.bytes),
      master_frames: String(measured.frames),
      decoded_pcm_sha256: sha(subject.master.subarray(44)),
      decoded_bytes: String(subject.master.length - 44),
      decoded_frames: String(measured.frames),
      integrated_decilufs: measurements.integrated_decilufs,
      longest_unexplained_frames: silence.frames,
      longest_unexplained_span: silence.span,
    }),
    "assessment_refused",
    "assessment",
  );
  let cursor = 44;
  for (const input of subject.inputs) {
    requirePair(
      subject.master
        .subarray(cursor, cursor + input.bytes.length - 44)
        .equals(input.bytes.subarray(44)),
      "source_mismatch",
      "readback",
    );
    cursor += input.bytes.length - 44;
  }
  requirePair(cursor === subject.master.length, "source_mismatch", "readback");
  return observation;
}
export function graphFor(
  operation: string,
  timestamp: string,
  files: ReadonlyMap<string, Buffer>,
  binding: StorageBinding,
): PairRows {
  const source = parsePairJson(files.get("SOURCE.json") ?? Buffer.alloc(0));
  const subject = storedSubject(files);
  const artifacts: Data[] = [];
  const audio: Data[] = [];
  const inputs = source.selected_inputs as Data[];
  const records = [
    ...inputs,
    {
      artifact_id: source.master_artifact_id,
      audio_artifact_id: source.master_audio_artifact_id,
      audio_sha256: object(source.expected_master).sha256,
      frame_count: "2880000",
    },
  ];
  const artifact = (
    id: unknown,
    type: string,
    schema: string,
    hash: string,
    name: FileName,
    payload: Data,
  ): Data => ({
    artifact_id: id,
    artifact_type: type,
    schema_version: schema,
    content_hash: hash,
    storage_uri: locator(binding, operation, name),
    byte_size: files.get(name)?.length,
    canonical_payload: payload,
    parent_artifact_id: null,
    supersedes_artifact_id: null,
    created_at: timestamp,
  });
  for (const [index, record] of records.entries()) {
    const name: FileName =
      index === 2 ? "master.wav" : index === 0 ? "input-1.wav" : "input-2.wav";
    const bytes = files.get(name);
    requirePair(bytes, "source_mismatch", "source");
    artifacts.push(
      artifact(
        record.artifact_id,
        index === 2 ? "audio/clean_master" : "audio/synthetic_input",
        "synthetic-audio-provenance/1",
        sha(bytes),
        name,
        {
          schema: "synthetic-audio-provenance/1",
          source_manifest_sha256: MANIFEST_SHA,
          source_file: name,
          synthetic_only: true,
          selection_authority: "authored-synthetic-selection/1",
          frame_count: record.frame_count,
          sample_rate_hz: 48000,
          channels: 1,
          sample_format: "s16le",
        },
      ),
    );
    audio.push({
      audio_artifact_id: record.audio_artifact_id,
      artifact_id: record.artifact_id,
      audio_sha256: sha(bytes),
      duration_ms: index === 2 ? 60000 : 30000,
    });
  }
  const recipeId = "b6100001-0000-4000-8000-000000000005";
  artifacts.push(
    artifact(
      recipeId,
      "assembly_recipe",
      "technical-master-positive-fixture-1",
      assemblyRecipeHash(subject.recipe),
      "recipe.json",
      subject.recipe,
    ),
  );
  artifacts.push(
    artifact(
      source.map_artifact_id,
      "master_assembly_map",
      "technical-master-positive-fixture-1",
      masterAssemblyMapHash(subject.map),
      "map.json",
      subject.map,
    ),
  );
  return {
    artifacts,
    audio_artifacts: audio,
    assembly_recipes: [
      {
        assembly_recipe_id: source.recipe_id,
        artifact_id: recipeId,
        version: subject.recipe.assembly_recipe_version,
      },
    ],
    master_assembly_maps: [
      {
        master_assembly_map_id: source.map_id,
        artifact_id: source.map_artifact_id,
        assembly_recipe_id: source.recipe_id,
        master_audio_artifact_id: source.master_audio_artifact_id,
      },
    ],
  };
}
export function requestFor(
  operation: string,
  timestamp: string,
  files: ReadonlyMap<string, Buffer>,
  bindings: PairBindings,
): PairRequest {
  authored(operation, timestamp);
  const subject = storedSubject(files);
  const observation = parsePairJson(
    files.get("assessment.json") ?? Buffer.alloc(0),
  );
  verifyObservation(subject, observation);
  const identity = identities(subject);
  return {
    schema: "durable-pair-request/1",
    operation_id: operation,
    created_at: timestamp,
    candidate_scope: "synthetic60-positive",
    attempt_id: null,
    show_config_version_hash: null,
    source_manifest_sha256: MANIFEST_SHA,
    storage_binding_digest: domainHash(
      "durable-pair-storage-binding-v1",
      bindings.storage,
    ),
    database_binding_digest: domainHash(
      "durable-pair-database-binding-v1",
      bindings.database,
    ),
    context_digest: identity.context_digest,
    policy_digest: identity.validation_policy_sha256,
    inspection_profile_digest: identity.measurement_profile_sha256,
    selected_inputs_digest: identity.selected_inputs_digest,
    assembly_fingerprint: identity.assembly_gate_fingerprint,
    technical_input_fingerprint: observation.input_fingerprint,
    objects: FILES.map((name) => {
      const bytes = files.get(name);
      requirePair(bytes, "source_mismatch", "source");
      return {
        name,
        byte_length: String(bytes.length),
        raw_sha256: sha(bytes),
      };
    }),
    rows: graphFor(operation, timestamp, files, bindings.storage),
  };
}
export function receiptRow(
  receipt: PairReceipt,
  storage: StorageBinding,
): Data {
  return {
    artifact_id: receipt.request.operation_id,
    artifact_type: "durable_pair_operation",
    schema_version: "durable-pair-receipt/1",
    content_hash: receiptHash(receipt),
    storage_uri: locator(storage, receipt.request.operation_id, "receipt.json"),
    byte_size: jsonBytes(receipt).length,
    canonical_payload: receipt,
    parent_artifact_id: null,
    supersedes_artifact_id: null,
    created_at: receipt.request.created_at,
  };
}

export function parseReceiptEnvelope(
  value: unknown,
  operation: string,
): PairReceipt {
  const receipt = closed(value, ["schema", "request", "request_digest"]);
  const request = closed(receipt.request, [
    "schema",
    "operation_id",
    "created_at",
    "candidate_scope",
    "attempt_id",
    "show_config_version_hash",
    "source_manifest_sha256",
    "storage_binding_digest",
    "database_binding_digest",
    "context_digest",
    "policy_digest",
    "inspection_profile_digest",
    "selected_inputs_digest",
    "assembly_fingerprint",
    "technical_input_fingerprint",
    "objects",
    "rows",
  ]);
  authored(request.operation_id, request.created_at);
  requirePair(
    receipt.schema === "durable-pair-receipt/1" &&
      request.schema === "durable-pair-request/1" &&
      request.operation_id === operation &&
      request.candidate_scope === "synthetic60-positive" &&
      request.attempt_id === null &&
      request.show_config_version_hash === null &&
      request.source_manifest_sha256 === MANIFEST_SHA &&
      Array.isArray(request.objects) &&
      request.objects.length === FILES.length,
    "source_mismatch",
    "source",
  );
  let total = jsonBytes(receipt).length;
  for (const [index, item] of request.objects.entries()) {
    const entry = closed(item, ["name", "byte_length", "raw_sha256"]);
    requirePair(
      entry.name === FILES[index] &&
        typeof entry.byte_length === "string" &&
        /^(0|[1-9][0-9]*)$/.test(entry.byte_length) &&
        typeof entry.raw_sha256 === "string" &&
        /^[0-9a-f]{64}$/.test(entry.raw_sha256),
      "source_mismatch",
      "source",
    );
    const maximum = String(entry.name).endsWith(".wav") ? 5760044 : 65536;
    requirePair(
      Number(entry.byte_length) <= maximum,
      "resource_limit",
      "source",
    );
    total += Number(entry.byte_length);
  }
  requirePair(
    total <= 12 * 1024 * 1024 &&
      jsonBytes(receipt).length <= 65536 &&
      receipt.request_digest ===
        requestHash(request as unknown as PairReceipt["request"]),
    "source_mismatch",
    "source",
  );
  const rows = closed(request.rows, [
    "artifacts",
    "audio_artifacts",
    "assembly_recipes",
    "master_assembly_maps",
  ]);
  requirePair(
    Array.isArray(rows.artifacts) &&
      rows.artifacts.length === 5 &&
      Array.isArray(rows.audio_artifacts) &&
      rows.audio_artifacts.length === 3 &&
      Array.isArray(rows.assembly_recipes) &&
      rows.assembly_recipes.length === 1 &&
      Array.isArray(rows.master_assembly_maps) &&
      rows.master_assembly_maps.length === 1,
    "source_mismatch",
    "source",
  );
  return receipt as unknown as PairReceipt;
}
