/** Fixed synthetic admission predicates and parsers; never a persisted gate or lifecycle authority. */
import { createHash } from "node:crypto";
import { types } from "node:util";
import { canonicalJson, domainHash } from "../identity/canonical-json.js";
import {
  assemblyRecipeHash,
  masterAssemblyMapHash,
} from "../identity/artifacts.js";
import { fingerprint } from "../identity/fingerprints.js";
import { measureCanonicalPcm } from "./audio-measurements.js";

export type Data = Record<string, unknown>;
export type Code =
  | "invalid_invocation"
  | "unsafe_settings"
  | "source_identity_invalid"
  | "source_read_failed"
  | "context_invalid"
  | "validation_policy_missing"
  | "policy_invalid"
  | "profile_invalid"
  | "canonical_audio_invalid"
  | "audio_resource_limit"
  | "hash_mismatch"
  | "duration_below_configured_minimum"
  | "duration_above_configured_maximum"
  | "planned_duration_mismatch"
  | "input_binding_invalid"
  | "selection_binding_invalid"
  | "recipe_mismatch"
  | "map_mismatch"
  | "block_order_mismatch"
  | "assembly_fingerprint_mismatch"
  | "executable_identity_invalid"
  | "inspection_launch_failed"
  | "inspection_timeout"
  | "inspection_output_limit"
  | "inspection_failed"
  | "decode_output_invalid"
  | "decoded_bytes_mismatch"
  | "loudness_unmeasurable"
  | "loudness_output_invalid"
  | "loudness_out_of_range"
  | "silence_policy_invalid"
  | "unexplained_silence"
  | "subject_changed"
  | "fingerprint_changed"
  | "cleanup_pending";
export type Phase =
  | "invocation"
  | "source"
  | "format"
  | "duration"
  | "map_inputs"
  | "executable"
  | "inspection"
  | "loudness"
  | "silence"
  | "freshness"
  | "cleanup";
export class TechnicalRefusal extends Error {
  constructor(
    readonly code: Code,
    readonly phase: Phase,
    readonly cleanupPending = false,
  ) {
    super(code);
  }
}
export function demand(
  value: unknown,
  code: Code,
  phase: Phase,
): asserts value {
  if (!value) throw new TechnicalRefusal(code, phase);
}
export function sha(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
/** Capture own data without invoking accessors or coercions before canonical serialization. */
export function capture(
  value: unknown,
  depth = 0,
  budget = { nodes: 0 },
): unknown {
  demand(
    ++budget.nodes <= 100000 && depth <= 16 && !types.isProxy(value),
    "context_invalid",
    "source",
  );
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    demand(
      value.length <= 65536 && /^[\x20-\x7e]*$/.test(value),
      "context_invalid",
      "source",
    );
    return value;
  }
  if (typeof value === "number") {
    demand(
      Number.isSafeInteger(value) && !Object.is(value, -0),
      "context_invalid",
      "source",
    );
    return value;
  }
  demand(typeof value === "object", "context_invalid", "source");
  const array = Array.isArray(value);
  const prototype = Reflect.getPrototypeOf(value);
  demand(
    prototype === (array ? Array.prototype : Object.prototype) ||
      (!array && prototype === null),
    "context_invalid",
    "source",
  );
  const keys = Reflect.ownKeys(value);
  demand(keys.length + budget.nodes <= 100000, "context_invalid", "source");
  const entries: [string, unknown][] = [];
  for (const key of keys) {
    if (array && key === "length") continue;
    demand(typeof key === "string", "context_invalid", "source");
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    demand(
      descriptor && "value" in descriptor && descriptor.enumerable,
      "context_invalid",
      "source",
    );
    entries.push([key, capture(descriptor.value, depth + 1, budget)]);
  }
  if (array) {
    demand(
      entries.length === value.length &&
        entries.every(([key], i) => key === String(i)),
      "context_invalid",
      "source",
    );
    return entries.map(([, item]) => item);
  }
  return Object.fromEntries(entries);
}
export function object(value: unknown): Data {
  demand(
    typeof value === "object" && value !== null && !Array.isArray(value),
    "context_invalid",
    "source",
  );
  return value as Data;
}
export function keys(
  value: Data,
  expected: readonly string[],
  code: Code = "context_invalid",
): void {
  demand(
    Object.keys(value).sort().join("\n") === [...expected].sort().join("\n"),
    code,
    "source",
  );
}
export function integer(value: unknown): bigint {
  demand(
    typeof value === "string" &&
      value.length <= 36 &&
      /^(0|[1-9][0-9]{0,35})$/.test(value),
    "context_invalid",
    "source",
  );
  return BigInt(value);
}
export function rational(value: unknown): {
  numerator: bigint;
  denominator: bigint;
} {
  const record = object(value);
  keys(record, ["numerator", "denominator"]);
  const numerator = integer(record.numerator);
  const denominator = integer(record.denominator);
  let a = numerator;
  let b = denominator;
  while (b) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  demand(denominator > 0n && a === 1n, "context_invalid", "source");
  return { numerator, denominator };
}
export interface Subject {
  scope: "synthetic60-positive" | "frozen046-negative";
  master: Buffer;
  inputs: { bytes: Buffer; record: Data }[];
  recipe: Data;
  map: Data;
  context: Data;
  policy: Data;
  profile: Data;
  lineage: Data[];
  assemblyPolicy: string;
  gateSet: string;
}
export function checkPolicy(subject: Subject): void {
  demand(
    ["distribution", "loudness", "silence"].every((section) =>
      Object.hasOwn(subject.policy, section),
    ),
    "validation_policy_missing",
    "source",
  );
  const context = object(capture(subject.context));
  keys(context, [
    "schema",
    "candidate_scope",
    "source_identity",
    "required_program_blocks",
    "selection_authority",
    "runtime_source",
    "planned_runtime",
    "configured_runtime_bounds",
    "explained_silence_intervals",
  ]);
  demand(
    context.schema === "technical-master-context/1" &&
      context.candidate_scope === subject.scope,
    "context_invalid",
    "source",
  );
  const blocks = context.required_program_blocks;
  demand(
    Array.isArray(blocks) &&
      blocks.length > 0 &&
      blocks.length <= 9 &&
      new Set(blocks).size === blocks.length &&
      blocks.every(
        (id) =>
          typeof id === "string" &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
            id,
          ),
      ),
    "context_invalid",
    "source",
  );
  const synthetic = subject.scope === "synthetic60-positive";
  const sourcePin = synthetic
    ? "af3dbc7ed4e8998f92dec9606e4922c85852d098453a4d859ef2a86b93a34706"
    : "7e1bb1108cdd84e47269b9ab2dab20ba934fcec64d44262f86d2b505616b0747";
  const source = object(context.source_identity);
  const selection = object(context.selection_authority);
  const runtime = object(context.runtime_source);
  keys(
    source,
    synthetic
      ? ["kind", "id", "sha256"]
      : ["kind", "id", "sha256", "rows_sha256", "mapping_sha256"],
  );
  keys(
    selection,
    synthetic
      ? ["kind", "source_sha256"]
      : ["kind", "source_sha256", "rows_sha256"],
  );
  keys(
    runtime,
    synthetic
      ? ["kind", "source_sha256"]
      : [
          "kind",
          "show_config_version_hash",
          "show_config_member_sha256",
          "brief_hash",
        ],
  );
  demand(
    source.sha256 === sourcePin &&
      source.kind === (synthetic ? "synthetic_source" : "frozen046_pack") &&
      source.id ===
        (synthetic ? "technical-master-positive-source/1" : "fixture-0.4.6") &&
      selection.kind ===
        (synthetic ? "authored_synthetic" : "historical_fixture") &&
      selection.source_sha256 === source.sha256 &&
      runtime.kind ===
        (synthetic ? "synthetic_runtime" : "frozen_show_config") &&
      (!synthetic || runtime.source_sha256 === source.sha256),
    "context_invalid",
    "source",
  );
  for (const record of [source, selection, runtime])
    for (const [key, value] of Object.entries(record))
      if (key.endsWith("sha256") || key.endsWith("hash"))
        demand(
          typeof value === "string" && /^[0-9a-f]{64}$/.test(value),
          "context_invalid",
          "source",
        );
  demand(
    domainHash(
      "technical-master-measurement-profile-v1",
      capture(subject.profile),
    ) === "7b2a24e57766f86379a78fa595c65baac44d53239618a27eda123522bc110dd8",
    "profile_invalid",
    "source",
  );
  const policy = object(capture(subject.policy));
  keys(
    policy,
    [
      "schema",
      "policy_source_id",
      "test_only",
      "planned_tolerance_frames",
      "map_tolerance_frames",
      "distribution",
      "loudness",
      "silence",
    ],
    "policy_invalid",
  );
  demand(
    policy.schema === "technical-master-test-policy/1" &&
      policy.policy_source_id === "technical-master-plumbing-policy-1" &&
      policy.test_only === true,
    "policy_invalid",
    "source",
  );
  integer(policy.planned_tolerance_frames);
  demand(policy.map_tolerance_frames === "0", "policy_invalid", "source");
  demand(
    canonicalJson(policy.distribution) ===
      canonicalJson({
        container: "wav",
        codec: "pcm_s16le",
        sample_rate_hz: 48000,
        channels: 1,
        bits_per_sample: 16,
      }),
    "policy_invalid",
    "source",
  );
  const loudness = object(policy.loudness);
  keys(
    loudness,
    ["metric", "dualmono", "target_decilufs", "tolerance_decilu"],
    "policy_invalid",
  );
  demand(
    loudness.metric === "ffmpeg-5.1.9-ebur128-integrated-decilu/1" &&
      loudness.dualmono === false &&
      typeof loudness.target_decilufs === "string" &&
      /^(0|-?[1-9][0-9]{0,4})$/.test(loudness.target_decilufs),
    "policy_invalid",
    "source",
  );
  integer(loudness.tolerance_decilu);
  const silence = object(policy.silence);
  keys(
    silence,
    [
      "absolute_sample_threshold",
      "max_unexplained_frames",
      "explained_intervals",
    ],
    "policy_invalid",
  );
  demand(
    integer(silence.absolute_sample_threshold) <= 32768n,
    "silence_policy_invalid",
    "source",
  );
  integer(silence.max_unexplained_frames);
  demand(
    canonicalJson(silence.explained_intervals) ===
      canonicalJson(subject.context.explained_silence_intervals),
    "silence_policy_invalid",
    "source",
  );
  rational(subject.context.planned_runtime);
  const bounds = object(subject.context.configured_runtime_bounds);
  keys(bounds, ["min_seconds", "max_seconds"]);
  demand(
    integer(bounds.min_seconds) <= integer(bounds.max_seconds),
    "context_invalid",
    "source",
  );
}
export function measureSubject(subject: Subject): {
  frames: bigint;
  bytes: bigint;
  hash: string;
} {
  demand(
    subject.inputs.length > 0 &&
      subject.inputs.length <= 10 &&
      subject.inputs.every((input) => input.bytes.length <= 8388608) &&
      subject.master.length <= 8388608 &&
      subject.inputs.reduce(
        (sum, input) => sum + input.bytes.length,
        subject.master.length,
      ) <= 12582912,
    "audio_resource_limit",
    "format",
  );
  const measured = measureCanonicalPcm(subject.master);
  demand(
    measured.kind === "measured" && measured.frame_count !== "0",
    "canonical_audio_invalid",
    "format",
  );
  return {
    frames: BigInt(measured.frame_count),
    bytes: BigInt(measured.byte_length),
    hash: measured.sha256,
  };
}
export function checkDuration(subject: Subject, frames: bigint): void {
  const bounds = object(subject.context.configured_runtime_bounds);
  demand(
    frames >= integer(bounds.min_seconds) * 48000n,
    "duration_below_configured_minimum",
    "duration",
  );
  demand(
    frames <= integer(bounds.max_seconds) * 48000n,
    "duration_above_configured_maximum",
    "duration",
  );
  const planned = rational(subject.context.planned_runtime);
  const difference = frames * planned.denominator - planned.numerator * 48000n;
  demand(
    (difference < 0n ? -difference : difference) <=
      integer(subject.policy.planned_tolerance_frames) * planned.denominator,
    "planned_duration_mismatch",
    "duration",
  );
}
export function identities(subject: Subject): Data {
  const measured = measureSubject(subject);
  const recipeHash = assemblyRecipeHash(subject.recipe);
  const mapHash = masterAssemblyMapHash(subject.map);
  const assembly = fingerprint("assembly", {
    selected_take_lineage: subject.lineage,
    assembly_recipe_hash: recipeHash,
    master_assembly_map_hash: mapHash,
    assembly_policy_version: subject.assemblyPolicy,
    gate_set_version: subject.gateSet,
  });
  return {
    validation_contract_version: "technical-master-admission-1",
    candidate_scope: subject.scope,
    master_audio_sha256: measured.hash,
    master_byte_length: String(measured.bytes),
    master_frame_count: String(measured.frames),
    master_assembly_map_hash: mapHash,
    assembly_recipe_hash: recipeHash,
    assembly_gate_fingerprint: assembly,
    selected_inputs_digest: domainHash("technical-master-selected-inputs-v1", {
      schema: "technical-master-selected-inputs/1",
      inputs: subject.inputs.map((input) => input.record),
    }),
    context_digest: domainHash("technical-master-context-v1", subject.context),
    validation_policy_sha256: domainHash(
      "technical-master-policy-v1",
      subject.policy,
    ),
    measurement_profile_sha256: domainHash(
      "technical-master-measurement-profile-v1",
      subject.profile,
    ),
  };
}
export function checkMap(subject: Subject, frames: bigint): void {
  const map = subject.map;
  const hashes: string[] = [];
  let cursor = 0n;
  demand(
    Array.isArray(map.segments) &&
      map.segments.length === subject.inputs.length,
    "map_mismatch",
    "map_inputs",
  );
  const seen = new Set<string>();
  const speech: Data[] = [];
  for (const [index, input] of subject.inputs.entries()) {
    keys(
      input.record,
      [
        "kind",
        "audio_artifact_id",
        "artifact_id",
        "audio_sha256",
        "render_block_id",
        "render_take_id",
        "take_selection_id",
        "program_block_id",
        "byte_length",
        "frame_count",
      ],
      "input_binding_invalid",
    );
    for (const key of [
      "audio_artifact_id",
      "artifact_id",
      "render_block_id",
      "render_take_id",
      "take_selection_id",
      "program_block_id",
    ]) {
      const value = input.record[key];
      demand(
        (input.record.kind === "static" &&
          value === null &&
          !["audio_artifact_id", "artifact_id"].includes(key)) ||
          (typeof value === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
              value,
            )),
        "input_binding_invalid",
        "map_inputs",
      );
    }
    integer(input.record.byte_length);
    integer(input.record.frame_count);
    const measured = measureCanonicalPcm(input.bytes);
    demand(
      measured.kind === "measured" &&
        measured.sha256 === input.record.audio_sha256 &&
        measured.byte_length === input.record.byte_length &&
        measured.frame_count === input.record.frame_count,
      "input_binding_invalid",
      "map_inputs",
    );
    const segment = object(map.segments[index]);
    for (const key of [
      "kind",
      "audio_artifact_id",
      "artifact_id",
      "audio_sha256",
      "render_block_id",
      "render_take_id",
      "take_selection_id",
      "program_block_id",
    ])
      demand(
        segment[key] === input.record[key],
        "input_binding_invalid",
        "map_inputs",
      );
    const id = String(input.record.artifact_id);
    demand(!seen.has(id), "input_binding_invalid", "map_inputs");
    seen.add(id);
    demand(
      segment.start_frame === Number(cursor) &&
        object(segment.join_metadata).gap_frames === 0,
      "map_mismatch",
      "map_inputs",
    );
    cursor += BigInt(measured.frame_count);
    demand(segment.end_frame === Number(cursor), "map_mismatch", "map_inputs");
    hashes.push(measured.sha256);
    if (segment.kind === "speech") speech.push(segment);
  }
  const expectedBlocks = subject.context.required_program_blocks;
  demand(
    Array.isArray(expectedBlocks) &&
      new Set(expectedBlocks).size === expectedBlocks.length,
    "block_order_mismatch",
    "map_inputs",
  );
  demand(
    canonicalJson(speech.map((segment) => segment.program_block_id)) ===
      canonicalJson(expectedBlocks),
    "block_order_mismatch",
    "map_inputs",
  );
  demand(
    canonicalJson(map.program_block_offsets) ===
      canonicalJson(
        speech.map((segment) => ({
          program_block_id: segment.program_block_id,
          start_frame: segment.start_frame,
          end_frame: segment.end_frame,
        })),
      ),
    "map_mismatch",
    "map_inputs",
  );
  demand(
    cursor === frames &&
      map.master_audio_hash === sha(subject.master) &&
      map.sample_rate_hz === 48000 &&
      map.assembly_recipe_hash === assemblyRecipeHash(subject.recipe),
    "map_mismatch",
    "map_inputs",
  );
  demand(
    canonicalJson(hashes) ===
      canonicalJson(subject.recipe.ordered_audio_artifact_hashes) &&
      canonicalJson(hashes) === canonicalJson(map.selected_audio_hashes),
    "recipe_mismatch",
    "map_inputs",
  );
  demand(
    subject.lineage.length === speech.length,
    "selection_binding_invalid",
    "map_inputs",
  );
  for (const [index, segment] of speech.entries()) {
    const line = subject.lineage[index];
    demand(line, "selection_binding_invalid", "map_inputs");
    keys(
      line,
      [
        "render_block_id",
        "take_selection_id",
        "render_take_id",
        "take_index",
        "audio_sha256",
      ],
      "selection_binding_invalid",
    );
    demand(
      typeof line.take_index === "number" &&
        Number.isSafeInteger(line.take_index) &&
        line.take_index >= 0,
      "selection_binding_invalid",
      "map_inputs",
    );
    demand(
      [
        "render_block_id",
        "render_take_id",
        "take_selection_id",
        "audio_sha256",
      ].every((key) => line[key] === segment[key]),
      "selection_binding_invalid",
      "map_inputs",
    );
  }
}
/** Require complete framehash coverage and independently check each decoded packet and whole PCM hash. */
export function checkDecode(
  stdout: Buffer,
  hashFile: string,
  pcm: Buffer,
): { bytes: string; frames: string; hash: string } {
  demand(
    stdout.length <= 1048576 &&
      stdout.every((byte) => byte === 10 || (byte >= 32 && byte <= 126)) &&
      stdout.at(-1) === 10,
    "decode_output_invalid",
    "inspection",
  );
  const lines = stdout.toString("ascii").slice(0, -1).split("\n");
  const headers = [
    "#format: frame checksums",
    "#version: 1",
    "#hash: SHA256",
    "#tb 0: 1/48000",
    "#media_type 0: audio",
    "#codec_id 0: pcm_s16le",
    "#sample_rate 0: 48000",
    "#channel_layout_name 0: mono",
    "#stream#, dts,        pts, duration,     size, hash",
  ];
  demand(
    lines.length > headers.length &&
      lines.length <= headers.length + 4096 &&
      headers.every((line, i) => lines[i] === line),
    "decode_output_invalid",
    "inspection",
  );
  let offset = 0;
  for (const line of lines.slice(headers.length)) {
    demand(line.length <= 1024, "decode_output_invalid", "inspection");
    const fields = line.split(", ");
    demand(fields.length === 6, "decode_output_invalid", "inspection");
    const numbers = fields.slice(0, 5).map((field) => {
      demand(
        /^ *(0|[1-9][0-9]{0,19})$/.test(field),
        "decode_output_invalid",
        "inspection",
      );
      return BigInt(field.trimStart());
    });
    const [stream, dts, pts, duration, size] = numbers;
    demand(
      stream === 0n &&
        dts === BigInt(offset / 2) &&
        pts === dts &&
        duration !== undefined &&
        duration > 0n &&
        size !== undefined &&
        size > 0n &&
        size % 2n === 0n &&
        duration === size / 2n &&
        size <= BigInt(pcm.length - offset),
      "decoded_bytes_mismatch",
      "inspection",
    );
    const hash = fields[5];
    demand(
      hash &&
        /^[0-9a-f]{64}$/.test(hash) &&
        sha(pcm.subarray(offset, offset + Number(size))) === hash,
      "decoded_bytes_mismatch",
      "inspection",
    );
    offset += Number(size);
  }
  demand(
    offset === pcm.length &&
      /^SHA256=[0-9a-f]{64}\n$/.test(hashFile) &&
      hashFile.length === 72 &&
      hashFile.slice(7, -1) === sha(pcm),
    "decoded_bytes_mismatch",
    "inspection",
  );
  return {
    bytes: String(offset),
    frames: String(offset / 2),
    hash: hashFile.slice(7, -1),
  };
}
export function parseLoudness(stderr: Buffer): bigint {
  demand(
    stderr.length <= 1048576 && stderr.at(-1) === 10 && !stderr.includes(0),
    "loudness_output_invalid",
    "loudness",
  );
  const lines = stderr.toString("utf8").split("\n");
  demand(
    lines.every((line) => line.length <= 1024),
    "loudness_output_invalid",
    "loudness",
  );
  const markers = lines.flatMap((line, i) =>
    line.includes("Summary:") ? [i] : [],
  );
  demand(markers.length === 1, "loudness_output_invalid", "loudness");
  const index = markers[0];
  demand(
    index !== undefined &&
      /^\[Parsed_ebur128_1 @ 0x[0-9a-f]{1,16}\] Summary:$/.test(
        lines[index] ?? "",
      ),
    "loudness_output_invalid",
    "loudness",
  );
  const block = lines.slice(index + 1);
  const labels = [
    "",
    "  Integrated loudness:",
    "    I:",
    "    Threshold:",
    "",
    "  Loudness range:",
    "    LRA:",
    "    Threshold:",
    "    LRA low:",
    "    LRA high:",
    "",
  ];
  demand(block.length === labels.length, "loudness_output_invalid", "loudness");
  const values: bigint[] = [];
  for (const [i, label] of labels.entries()) {
    const line = block[i] ?? "";
    if (!label.endsWith(":") || i === 1 || i === 5) {
      demand(line === label, "loudness_output_invalid", "loudness");
      continue;
    }
    const unit = i === 6 ? "LU" : "LUFS";
    demand(line.startsWith(label), "loudness_output_invalid", "loudness");
    const value = line.slice(label.length);
    demand(
      !/\b(?:inf|nan)\b/i.test(value),
      "loudness_unmeasurable",
      "loudness",
    );
    const match = new RegExp(
      "^ +(-?(?:0|[1-9][0-9]{0,2}))\\.([0-9]) " + unit + "$",
    ).exec(value);
    demand(match, "loudness_output_invalid", "loudness");
    const negative = match[1]?.startsWith("-");
    const amount =
      BigInt((match[1] ?? "").replace("-", "")) * 10n + BigInt(match[2] ?? "0");
    const number = negative ? -amount : amount;
    demand(
      number >= (i === 6 ? 0n : -1200n) && number <= (i === 6 ? 1200n : 100n),
      "loudness_output_invalid",
      "loudness",
    );
    values.push(number);
  }
  demand(
    values.length === 6 &&
      values[4] !== undefined &&
      values[5] !== undefined &&
      values[4] <= values[5],
    "loudness_output_invalid",
    "loudness",
  );
  return values[0] ?? 0n;
}
export function checkLoudness(policy: Data, measured: bigint): void {
  const loudness = object(policy.loudness);
  const target = BigInt(String(loudness.target_decilufs));
  const difference = measured - target;
  demand(
    (difference < 0n ? -difference : difference) <=
      integer(loudness.tolerance_decilu),
    "loudness_out_of_range",
    "loudness",
  );
}
export function checkSilence(subject: Subject): {
  frames: string;
  span: { start_frame: string; end_frame: string } | null;
} {
  const policy = object(subject.policy.silence);
  const frames = (subject.master.length - 44) / 2;
  const intervals = policy.explained_intervals;
  demand(
    Array.isArray(intervals) &&
      intervals.length <= 16 &&
      canonicalJson(intervals) ===
        canonicalJson(subject.context.explained_silence_intervals),
    "silence_policy_invalid",
    "silence",
  );
  let priorEnd = 0;
  const spans = intervals.map((value) => {
    const interval = object(value);
    keys(interval, ["start_frame", "end_frame"], "silence_policy_invalid");
    const start = Number(integer(interval.start_frame));
    const end = Number(integer(interval.end_frame));
    demand(
      start >= priorEnd && end > start && end <= frames,
      "silence_policy_invalid",
      "silence",
    );
    priorEnd = end;
    return [start, end] as const;
  });
  const threshold = integer(policy.absolute_sample_threshold);
  let current = 0;
  let longest = 0;
  let start = 0;
  let activeInterval = 0;
  for (let frame = 0; frame < frames; frame++) {
    while (spans[activeInterval] && frame >= (spans[activeInterval]?.[1] ?? 0))
      activeInterval++;
    const span = spans[activeInterval];
    const explained = span !== undefined && frame >= span[0] && frame < span[1];
    const silent =
      BigInt(Math.abs(subject.master.readInt16LE(44 + frame * 2))) <= threshold;
    current = silent && !explained ? current + 1 : 0;
    if (current > longest) {
      longest = current;
      start = frame + 1 - current;
    }
  }
  demand(
    BigInt(longest) <= integer(policy.max_unexplained_frames),
    "unexplained_silence",
    "silence",
  );
  return {
    frames: String(longest),
    span: longest
      ? { start_frame: String(start), end_frame: String(start + longest) }
      : null,
  };
}
