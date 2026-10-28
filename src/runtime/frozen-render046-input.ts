// Owned read-only INPUT acquisition. No ZIP, row loader, expected outputs or authority capability.
// Frozen contract02; the public wrapper alone admits the exact synthetic seed.
import { constants, type Stats } from "node:fs";
import { lstat, open, type FileHandle } from "node:fs/promises";
import { canonicalJson, sha256 } from "../identity/canonical-json.js";
import {
  asArray,
  asInteger,
  asNonBlankString,
  asRecord,
  requireExactKeys,
  type JsonObject,
} from "../identity/select.js";

export interface SourceIdentity {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}
export type AcquisitionCode =
  | "source_missing"
  | "source_not_regular"
  | "source_size_mismatch"
  | "source_metadata_changed"
  | "source_read_failed"
  | "source_read_bound_exceeded"
  | "source_hash_mismatch"
  | "source_utf8_invalid"
  | "source_json_invalid"
  | "source_shape_invalid"
  | "source_binding_invalid";
export class FrozenInputRejected extends Error {
  constructor(readonly code: AcquisitionCode) {
    super(code);
    this.name = "FrozenInputRejected";
  }
}
// Complete fixed module-relative allowlist. No caller paths or policy-supplied path opens.
const INPUT_PINS: readonly SourceIdentity[] = [
  {
    path: "fixtures/frozen-render046-input/evidence_package.json",
    bytes: 54034,
    sha256: "bd9f5ff68156d6c03184c0e6d2f1acccc35bbb0c0223ab4ab611fb9378ba05f9",
  },
  {
    path: "fixtures/frozen-render046-input/showrunner_brief.json",
    bytes: 13206,
    sha256: "5a2b120d3c2e49f6b00c69afde6cac0405d4c5fc5e85b83884ef015c42309ad9",
  },
  {
    path: "fixtures/frozen-render046-input/script_pass2.json",
    bytes: 15122,
    sha256: "4d7f3ae6c0039098c0a3f73d8a4cd8c26040259cac4001de9b42d8f9aeb60cc7",
  },
  {
    path: "fixtures/frozen-render046-input/performance_direction_corrected.json",
    bytes: 3709,
    sha256: "9a17f23439a9aaeeb1eb8b70678db791b2820ffaf4286581a0d441509e7e38ff",
  },
  {
    path: "fixtures/frozen-render046-input/audit_result.json",
    bytes: 1006,
    sha256: "d956658e95a74f794035e44cee3ad808e1e7086bb104846c809852f96286ede5",
  },
  {
    path: "fixtures/frozen-render046-input/config/show_config_version.json",
    bytes: 1188,
    sha256: "2024e994b1fb6d772f04dd604d589fd2155015197591f9505ebd9ab0e646b5a7",
  },
  {
    path: "fixtures/frozen-render046-input/config/policy_versions.json",
    bytes: 5005,
    sha256: "5d02892aeb53f8236e437a3728e383beb5d0534c85760072ea5c3a32e36c6b18",
  },
  {
    path: "fixtures/frozen-render046-input/INPUT-SUPPORT.json",
    bytes: 5595,
    sha256: "3636b742f5a5506a9a03afc172daea0f92805b62c4cb942743b026a6c6072ca2",
  },
];
const SOURCE_PINS: readonly SourceIdentity[] = [
  {
    path: "Lock/01_ARCHITECTURE_AND_ADRS/The_Desk_ADR_003A_BUILD_1_2_READY_and_Repair_Attempt_Semantics.md",
    bytes: 3116,
    sha256: "24d285344f29316d83929857c167891b082e83ee0923b11dc3a1b4f7e35cc89b",
  },
  {
    path: "Lock/02_ACTIVE_SPECS/The_Desk_Claims_Policy_v0.1.2.md",
    bytes: 52219,
    sha256: "d62323da55dea8f0aa0754ead2fb27efd435e744c600215a9de71a712afaa9ed",
  },
  {
    path: "Lock/02_ACTIVE_SPECS/The_Desk_Performance_and_Render_v0.1.4.md",
    bytes: 74661,
    sha256: "959474f6f90668b0c5d76e2bd4deafdb9cb52e8df706e469dc9d4b7b088381dc",
  },
  {
    path: "Lock/02_ACTIVE_SPECS/The_Desk_Evidence_Package_v0.2.2.md",
    bytes: 48965,
    sha256: "f12582a70cd9223fdd05dbabf8bf2fbddfe11816ab4c1925d24e24c8051e71ea",
  },
  {
    path: "Lock/04_IMPLEMENTATION/The_Desk_Hashing_Fingerprints_and_Text_Spans_v0.1.5.md",
    bytes: 72302,
    sha256: "a78ac9478b8ee9a55caae21ba07fd1106e110ba6cd30de807181cd4a15a10e89",
  },
  {
    path: "Lock/02_ACTIVE_SPECS/The_Desk_Operator_Repair_v0.1.1.md",
    bytes: 8297,
    sha256: "4754180431d65e9c4e66bbb1af4c4036830651b86d0eaef1c1a57bcb11c9d686",
  },
  {
    path: "Lock/02_ACTIVE_SPECS/The_Desk_Showrunner_Planning_v0.1.3.md",
    bytes: 47659,
    sha256: "8a658b976a3c9d73bb2e039655ab4016af867b919d906bbc07aef286555b7367",
  },
  {
    path: "Lock/02_ACTIVE_SPECS/The_Desk_Writing_Craft_and_Invisible_Comprehension_v0.1.md",
    bytes: 22315,
    sha256: "07b9cc27d2e20882c8890aec8c5432044aa9d5b295b7ac166e9e99beec30ad04",
  },
  {
    path: "Lock/02_ACTIVE_SPECS/The_Desk_Writing_Build_1-2_Fixture_Profile_Addendum_v0.1.md",
    bytes: 9920,
    sha256: "79ea43076b0b5ca68916f8e12ac3457e48c6ad31a9bf5f1c47034fcb1de7f55f",
  },
  {
    path: "Lock/02_ACTIVE_SPECS/The_Desk_Writing_Spec_v0.2.3.md",
    bytes: 64515,
    sha256: "62f2a4c5424a39ee445929a47c2ffea070eb3ded40767876ae328fe2dcc42bda",
  },
  {
    path: "Lock/02_ACTIVE_SPECS/The_Desk_Character_Bible_v0.1.4.md",
    bytes: 31111,
    sha256: "5e38c5163ffee8757e38fce14a1919caf000f7e2f7c3159b949351d6962b313c",
  },
  {
    path: "AGENTS.md",
    bytes: 3188,
    sha256: "4e010f04ade5c7786dbfa0c44aba368b2b8e42149cca1f3fb8cfa50d97232480",
  },
  {
    path: "Lock/00_INDEX/ACTIVE_SPECS_LOCKED_v1.2.7.md",
    bytes: 14069,
    sha256: "5553a263a3d6b376a732564fb8cb502f65b6643cd05252a5382e349d52341a86",
  },
  {
    path: "Lock/00_INDEX/The_Desk_FINAL_LOCK_README_v1.2.7.md",
    bytes: 4931,
    sha256: "1a7a6417da060c63ea1b769fc10f242d1097ebb74bae0e034bbd3d01ef4408f2",
  },
  {
    path: "Lock/00_INDEX/The_Desk_FINAL_LOCK_Activation_Record_v1.2.7.md",
    bytes: 8513,
    sha256: "f13f1fea66d8a6ac86bc3b075ffb81f52d8b535b1ba282c1c5c28184f82ae550",
  },
  {
    path: "Lock/04_IMPLEMENTATION/The_Desk_Walking_Skeleton_Coding_Handoff_v0.5.5.md",
    bytes: 43959,
    sha256: "9d59c2e90fbddacfb23d6e1ba13ea2d72cdb6ce93502d179d06705125f48197c",
  },
  {
    path: "Lock/04_IMPLEMENTATION/The_Desk_Walking_Skeleton_Contract_Trace_v0.5.5.md",
    bytes: 54361,
    sha256: "fbc0b0374400932b04c52a5369c90ba98251384085563dbfeffc1d26a037183d",
  },
  {
    path: "Lock/04_IMPLEMENTATION/The_Desk_Hashing_Fingerprints_and_Text_Spans_v0.1.6.md",
    bytes: 83832,
    sha256: "ba5ee5c6aaa7c8233a3bd03a066095600dd9ff3849903aed20b8130f75650ca8",
  },
  {
    path: "Lock/02_ACTIVE_SPECS/The_Desk_Writing_Build_1-2_Fixture_Profile_Addendum_v0.2.md",
    bytes: 26145,
    sha256: "14c49df3a0a1328d2ba61c0ff137cf4fdb37867a34811f065073d123814aa75c",
  },
];

const SOURCE_KEYS = {
  evidence_package: [
    "artifact_id",
    "created_at",
    "frozen_at",
    "id",
    "manifest",
    "package_hash",
    "schema_version",
    "scope_hash",
    "selector_run_id",
  ],
  brief: [
    "artifact_id",
    "attempt_id",
    "brief_hash",
    "central_question",
    "comprehension_targets",
    "context_selections",
    "continuity_instructions",
    "created_at",
    "evidence_package_id",
    "feature_selections",
    "known_gaps",
    "orientation_job",
    "package_hash",
    "planner_model_run_id",
    "planning_exclusions",
    "planning_policy_version",
    "program_blocks",
    "program_run_id",
    "programming_constraints",
    "purpose",
    "revision_parent_id",
    "revision_reason",
    "rundown_template_version_id",
    "runtime_target",
    "selected_beats",
    "selected_mode",
    "show_version",
    "showrunner_brief_version_id",
    "topic_thread_mappings",
  ],
  script: [
    "artifact_id",
    "attempt_id",
    "brief_hash",
    "created_at",
    "evidence_package_id",
    "package_hash",
    "prediction_candidates",
    "program_block_refs",
    "program_run_id",
    "purpose",
    "revision_parent_content_identity",
    "revision_parent_id",
    "revision_reason",
    "script_hash",
    "script_phase",
    "script_version_id",
    "showrunner_brief_version_id",
    "turn_claim_uses",
    "turn_evidence_uses",
    "turns",
    "writer_model_run_id",
    "writing_policy_version",
  ],
  direction: [
    "actor",
    "artifact_id",
    "correction_operation",
    "created_at",
    "direction_hash",
    "direction_spec_version",
    "input_fingerprint",
    "performance_direction_version_id",
    "performance_intents",
    "producer_run_id",
    "script_hash",
    "script_version_id",
  ],
  show_config: [
    "canonical_payload",
    "config_hash",
    "created_at",
    "parent_version_id",
    "pre_publish_review_required",
    "schema_version",
    "show_config_version_id",
    "show_id",
    "version_number",
  ],
} as const;

export interface FrozenRender046Sources {
  evidence_package: JsonObject;
  brief: JsonObject;
  script: JsonObject;
  direction: JsonObject;
  show_config: JsonObject;
  support: JsonObject;
}
export interface AcquiredFrozenRender046 {
  readonly authority: "none";
  readonly sources: FrozenRender046Sources;
  readonly audit_seed: JsonObject;
  readonly source_receipt: readonly SourceIdentity[];
}

function shape(): never {
  throw new FrozenInputRejected("source_shape_invalid");
}
function exact(value: unknown, keys: readonly string[]): JsonObject {
  return requireExactKeys(value, keys, "frozen source");
}
function rows(value: unknown, count: number): JsonObject[] {
  const items = asArray(value, "source rows");
  if (items.length !== count) shape();
  return items.map((item) => asRecord(item, "source row"));
}
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function uuid(value: unknown): void {
  if (typeof value !== "string" || !uuidPattern.test(value)) shape();
}
function positive(value: unknown): void {
  if (asInteger(value, "version") < 1) shape();
}
function strings(record: JsonObject, keys: readonly string[]): void {
  for (const key of keys) asNonBlankString(record[key], key);
}

/** Copy plain JSON DATA without getters, prototypes, symbols, cycles or caller aliases.
 * The finite bounds cover this declared input, not hostile native objects/processes. */
function copyData(value: unknown): unknown {
  let nodes = 0;
  const ancestors = new Set<object>();
  function copy(item: unknown, depth: number): unknown {
    if (++nodes > 30000 || depth > 40) shape();
    if (
      item === null ||
      typeof item === "string" ||
      typeof item === "boolean" ||
      typeof item === "number"
    )
      return item;
    if (typeof item !== "object" || ancestors.has(item)) shape();
    if (
      !Array.isArray(item) &&
      Object.getPrototypeOf(item) !== Object.prototype &&
      Object.getPrototypeOf(item) !== null
    )
      shape();
    ancestors.add(item);
    try {
      const descriptors = Object.getOwnPropertyDescriptors(item);
      if (Reflect.ownKeys(item).some((key) => typeof key !== "string")) shape();
      if (Array.isArray(item)) {
        if (Object.keys(descriptors).length !== item.length + 1) shape();
        const result: unknown[] = [];
        for (let i = 0; i < item.length; i++) {
          const descriptor = descriptors[String(i)];
          if (!descriptor || !("value" in descriptor) || !descriptor.enumerable)
            shape();
          result.push(copy(descriptor.value, depth + 1));
        }
        return result;
      }
      const result: JsonObject = {};
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (
          !("value" in descriptor) ||
          !descriptor.enumerable ||
          key === "__proto__"
        )
          shape();
        result[key] = copy(descriptor.value, depth + 1);
      }
      return result;
    } finally {
      ancestors.delete(item);
    }
  }
  const result = copy(value, 0);
  // Existing serializer validates Unicode, safe integer numbers and canonical key collisions.
  canonicalJson(result);
  return result;
}

function parseSupport(value: unknown): JsonObject {
  const support = exact(value, [
    "schema",
    "source",
    "records",
    "record_pointer_ledger",
  ]);
  if (support.schema !== "frozen-fixture046-render-input-support/1") shape();
  const source = exact(support.source, ["member", "bytes", "sha256"]);
  if (
    source.member !== "foundation_rows_398.json" ||
    source.bytes !== 471514 ||
    source.sha256 !==
      "a27f4381bd6449bfb656c6431b56115a932e05c82791696fc293c701c0a58a7e"
  )
    shape();
  const counts = {
    voice_profiles: 3,
    voice_profile_versions: 3,
    pronunciations: 2,
    pronunciation_renderings: 3,
  } as const;
  const records = exact(support.records, Object.keys(counts));
  for (const profile of rows(records.voice_profiles, 3)) {
    exact(profile, ["participant_identity", "voice_profile_id"]);
    if (
      !["tully", "gaz", "simon"].includes(String(profile.participant_identity))
    )
      shape();
    uuid(profile.voice_profile_id);
  }
  for (const version of rows(records.voice_profile_versions, 3)) {
    exact(version, [
      "render_fields",
      "version",
      "voice_profile_id",
      "voice_profile_version_id",
    ]);
    positive(version.version);
    uuid(version.voice_profile_id);
    uuid(version.voice_profile_version_id);
    const fields = exact(version.render_fields, [
      "provider",
      "provider_model_compatibility",
      "provider_voice_id",
      "render_facing_design",
      "request_side_voice_controls",
    ]);
    if (
      fields.provider !== "fixture_tts" ||
      canonicalJson(fields.provider_model_compatibility) !==
        '["fixture-model-1.0"]'
    )
      shape();
    strings(fields, ["provider_voice_id", "render_facing_design"]);
    if (
      exact(fields.request_side_voice_controls, ["stability"]).stability !==
      "standard"
    )
      shape();
  }
  for (const pronunciation of rows(records.pronunciations, 2)) {
    exact(pronunciation, [
      "canonical_text",
      "canonical_version",
      "entity_identity",
      "ipa",
      "language",
      "pronunciation_id",
      "supersedes_pronunciation_id",
    ]);
    strings(pronunciation, ["canonical_text", "entity_identity", "language"]);
    positive(pronunciation.canonical_version);
    uuid(pronunciation.pronunciation_id);
    if (pronunciation.ipa !== null && typeof pronunciation.ipa !== "string")
      shape();
    if (pronunciation.supersedes_pronunciation_id !== null)
      uuid(pronunciation.supersedes_pronunciation_id);
  }
  for (const rendering of rows(records.pronunciation_renderings, 3)) {
    exact(rendering, [
      "pronunciation_id",
      "pronunciation_rendering_id",
      "provider",
      "rendering",
      "version",
      "voice_profile_version_id",
    ]);
    uuid(rendering.pronunciation_id);
    uuid(rendering.pronunciation_rendering_id);
    uuid(rendering.voice_profile_version_id);
    positive(rendering.version);
    strings(rendering, ["rendering"]);
    if (rendering.provider !== "fixture_tts") shape();
  }
  const ledger = rows(support.record_pointer_ledger, 11);
  let position = 0;
  for (const [family, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i++) {
      const entry = exact(ledger[position++], [
        "source_pointer",
        "target_pointer",
      ]);
      if (
        entry.source_pointer !== `/tables/${family}/${String(i)}` ||
        entry.target_pointer !== `/records/${family}/${String(i)}`
      )
        shape();
    }
  }
  return support;
}

/** Closed copied source parsing only; no audit admission or authority mint. */
export function parseFrozenRender046Sources(
  value: unknown,
): FrozenRender046Sources {
  try {
    const input = exact(copyData(value), [
      ...Object.keys(SOURCE_KEYS),
      "support",
    ]);
    for (const key of Object.keys(SOURCE_KEYS) as (keyof typeof SOURCE_KEYS)[])
      exact(input[key], SOURCE_KEYS[key]);
    const evidence = asRecord(input.evidence_package, "package");
    const brief = asRecord(input.brief, "brief");
    const script = asRecord(input.script, "script");
    const direction = asRecord(input.direction, "direction");
    const config = asRecord(input.show_config, "show config");
    asRecord(evidence.manifest, "package manifest");
    strings(evidence, ["id", "package_hash", "schema_version"]);
    for (const block of rows(brief.program_blocks, 9)) {
      exact(block, [
        "block_type",
        "claim_evidence_assignments",
        "context_selection_ids",
        "job",
        "participant_leads",
        "primary_question",
        "program_block_id",
        "required_cautions",
        "selected_beat_ids",
        "sequence",
        "target_duration_or_words",
        "template_slot_id",
        "topic_thread_ids",
        "transition_goal",
      ]);
      uuid(block.program_block_id);
      asInteger(block.sequence, "sequence");
    }
    for (const turn of rows(script.turns, 17)) {
      exact(turn, [
        "participant_id",
        "program_block_id",
        "semantic_turn_id",
        "sequence",
        "spoken_text",
        "turn_id",
      ]);
      uuid(turn.turn_id);
      uuid(turn.program_block_id);
      asInteger(turn.sequence, "sequence");
      strings(turn, ["participant_id", "semantic_turn_id", "spoken_text"]);
    }
    for (const [field, count, keys] of [
      [
        "turn_claim_uses",
        12,
        [
          "claim_id",
          "claim_state_hash",
          "semantic_turn_id",
          "span_end",
          "span_start",
          "turn_claim_use_id",
          "turn_id",
          "use_mode",
        ],
      ],
      [
        "turn_evidence_uses",
        3,
        [
          "evidence_unit_id",
          "rights_policy_version",
          "semantic_turn_id",
          "span_end",
          "span_start",
          "turn_evidence_use_id",
          "turn_id",
          "use_mode",
        ],
      ],
      [
        "prediction_candidates",
        2,
        [
          "horizon",
          "participant_id",
          "prediction_candidate_id",
          "prediction_text",
          "topic_thread_id",
          "turn_id",
        ],
      ],
    ] as const)
      for (const row of rows(script[field], count)) exact(row, keys);
    if (asArray(script.program_block_refs, "program block refs").length !== 9)
      shape();
    // Intent count/content belongs the explicit capability validator, not a permissive drop/filter.
    for (const intent of asArray(direction.performance_intents, "intents")) {
      const row = exact(intent, [
        "intent_type",
        "performance_intent_id",
        "scope_ref",
        "scope_type",
        "strength",
        "timing_anchor",
        "value",
      ]);
      uuid(row.performance_intent_id);
      strings(row, [
        "intent_type",
        "scope_ref",
        "scope_type",
        "strength",
        "value",
      ]);
      if (row.timing_anchor !== null) strings(row, ["timing_anchor"]);
    }
    asRecord(config.canonical_payload, "show config payload");
    return {
      evidence_package: evidence,
      brief,
      script,
      direction,
      show_config: config,
      support: parseSupport(input.support),
    };
  } catch (error) {
    if (error instanceof FrozenInputRejected) throw error;
    throw new FrozenInputRejected("source_shape_invalid");
  }
}

function sameMetadata(a: Stats, b: Stats): boolean {
  return (
    a.isFile() &&
    b.isFile() &&
    a.dev === b.dev &&
    a.ino === b.ino &&
    a.size === b.size &&
    a.mtimeMs === b.mtimeMs &&
    a.ctimeMs === b.ctimeMs
  );
}
async function closePinned(handle: FileHandle): Promise<void> {
  try {
    await handle.close();
  } catch {
    throw new FrozenInputRejected("source_read_failed");
  }
}
async function readPinned(pin: SourceIdentity): Promise<Buffer> {
  const path = new URL(`../../${pin.path}`, import.meta.url);
  let before: Stats;
  try {
    before = await lstat(path);
  } catch {
    throw new FrozenInputRejected("source_missing");
  }
  if (!before.isFile() || before.isSymbolicLink())
    throw new FrozenInputRejected("source_not_regular");
  if (before.size !== pin.bytes)
    throw new FrozenInputRejected("source_size_mismatch");
  let handle;
  try {
    handle = await open(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
  } catch {
    throw new FrozenInputRejected("source_read_failed");
  }
  try {
    try {
      const opened = await handle.stat();
      if (!sameMetadata(before, opened))
        throw new FrozenInputRejected("source_metadata_changed");
      const bytes = Buffer.alloc(pin.bytes);
      let offset = 0;
      // One sequential pass, finite read calls even when a filesystem returns tiny short reads.
      for (let attempt = 0; offset < bytes.length && attempt < 64; attempt++) {
        const { bytesRead } = await handle.read(
          bytes,
          offset,
          bytes.length - offset,
          offset,
        );
        if (
          !Number.isInteger(bytesRead) ||
          bytesRead < 0 ||
          bytesRead > bytes.length - offset
        )
          throw new FrozenInputRejected("source_read_failed");
        if (bytesRead === 0)
          throw new FrozenInputRejected("source_size_mismatch");
        offset += bytesRead;
      }
      if (offset !== bytes.length)
        throw new FrozenInputRejected("source_read_bound_exceeded");
      const probe = await handle.read(Buffer.alloc(1), 0, 1, offset);
      if (probe.bytesRead !== 0)
        throw new FrozenInputRejected("source_size_mismatch");
      if (!sameMetadata(opened, await handle.stat()))
        throw new FrozenInputRejected("source_metadata_changed");
      if (sha256(bytes) !== pin.sha256)
        throw new FrozenInputRejected("source_hash_mismatch");
      return bytes;
    } finally {
      await closePinned(handle);
    }
  } catch (error) {
    if (error instanceof FrozenInputRejected) throw error;
    throw new FrozenInputRejected("source_read_failed");
  }
}
function decode(bytes: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    throw new FrozenInputRejected("source_utf8_invalid");
  }
}
function parse(bytes: Buffer): unknown {
  const text = decode(bytes);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new FrozenInputRejected("source_json_invalid");
  }
}

/** Fresh fixed owned inputs, with raw identity checked BEFORE JSON decoding. Data only. */
export async function acquireFrozenRender046Inputs(): Promise<AcquiredFrozenRender046> {
  const inputs: unknown[] = [];
  for (const pin of INPUT_PINS) inputs.push(parse(await readPinned(pin)));
  for (const pin of SOURCE_PINS) decode(await readPinned(pin));
  const [
    evidence_package,
    brief,
    script,
    direction,
    audit,
    show_config,
    policies,
    support,
  ] = inputs;
  const sources = parseFrozenRender046Sources({
    evidence_package,
    brief,
    script,
    direction,
    show_config,
    support,
  });
  let seed: JsonObject;
  try {
    seed = exact(audit, [
      "artifact_id",
      "audit_run_id",
      "auditor_kind",
      "auditor_version",
      "created_at",
      "findings",
      "fixture_stub",
      "input_fingerprint",
      "input_projection",
      "result",
    ]);
    const map = exact(policies, [
      "config_version",
      "policies",
      "source_binding_rule",
      "status",
      "supporting_authority",
    ]);
    const bindings = asRecord(map.policies, "policy bindings");
    exact(bindings, [
      "autonomous_operation_policy",
      "claims_policy",
      "direction_spec",
      "evidence_package_spec",
      "hashing_contract",
      "operator_repair_policy",
      "planning_policy",
      "writing_craft_policy",
      "writing_fixture_profile_addendum",
      "writing_policy",
    ]);
    const supporting = exact(map.supporting_authority, ["character_bible"]);
    const selected = [...Object.values(bindings), supporting.character_bible];
    for (const [i, value] of selected.entries()) {
      const row = asRecord(value, "policy source");
      exact(
        row,
        i === 10
          ? ["role", "shipped_at", "source_path", "source_sha256", "version_id"]
          : ["shipped_at", "source_path", "source_sha256", "version_id"],
      );
      const pin = SOURCE_PINS.find(
        (candidate) => candidate.path === `Lock/${String(row.source_path)}`,
      );
      if (
        !pin ||
        pin.sha256 !== row.source_sha256 ||
        row.shipped_at !== `authority/${String(row.source_path)}`
      )
        throw new FrozenInputRejected("source_binding_invalid");
    }
    if (
      asRecord(bindings.claims_policy, "claims").version_id !==
        "claims-0.1.2" ||
      asRecord(bindings.writing_policy, "writing").version_id !==
        "writing-0.2.3" ||
      asRecord(bindings.direction_spec, "performance").version_id !==
        "performance-render-0.1.4" ||
      asRecord(bindings.hashing_contract, "historical hashing").version_id !==
        "hash-fingerprint-span-0.1.5"
    )
      throw new FrozenInputRejected("source_binding_invalid");
  } catch (error) {
    if (error instanceof FrozenInputRejected) throw error;
    throw new FrozenInputRejected("source_shape_invalid");
  }
  return {
    authority: "none",
    sources,
    audit_seed: seed,
    source_receipt: [...INPUT_PINS, ...SOURCE_PINS].map((pin) => ({ ...pin })),
  };
}
