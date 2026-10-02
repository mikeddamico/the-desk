// Row-derived identities for the fixture load (A2 repair). Everything here is computed from ACTUAL rows (shipped snapshot
// before insertion, persisted rows after read-back) and recomputed upstream identities. The shipped projections, request
// records and fingerprints are only COMPARISON TARGETS: they never supply a hash, id, binding or row-backed field.
// Fields no row can supply (gate-set label, model/adapter identities, generation settings, scene config, text-transform
// names, pronunciation offsets, the context recipe label) are taken from the shipped record and are the only
// shipped-sourced inputs; each is named below.
import { canonicalJson } from "../identity/canonical-json.js";
import { fingerprint, type StageName } from "../identity/fingerprints.js";
import { checkFixtureRequestOwnership } from "../identity/fixture-render-ownership.js";
import { requestBaseHash, voiceRenderIdentity } from "../identity/request.js";
import type { Row, Tables } from "./rows.js";

type Obj = Record<string, unknown>;

export class DerivationError extends Error {
  readonly code: string;
  constructor(code: string, detail = "") {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "DerivationError";
    this.code = code;
  }
}

const str = (v: unknown): string => String(v);
function fail(code: string, detail = ""): never {
  throw new DerivationError(code, detail);
}
function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null)
    return fail("missing_reference", what);
  return value;
}
function same(
  code: string,
  actual: unknown,
  expected: unknown,
  detail = "",
): void {
  if (canonicalJson(actual) !== canonicalJson(expected)) fail(code, detail);
}
const rowsOf = (tables: Tables, name: string): readonly Row[] =>
  tables[name] ?? [];
function indexBy(rows: readonly Row[], key: string): Map<string, Row> {
  const map = new Map<string, Row>();
  for (const row of rows) {
    const id = str(row[key]);
    if (map.has(id)) fail("duplicate_row_key", `${key}=${id}`);
    map.set(id, row);
  }
  return map;
}

/** Fixture label for the gate set. No row carries it, so it is the one pinned constant (all six shipped projections must agree). */
export const GATE_SET_VERSION = "build2-gates-v1";

export const stageOrder: readonly StageName[] = [
  "claims_writing",
  "performance",
  "semantic_audit",
  "render",
  "assembly",
  "ready_candidate",
];

/** Gate definitions are governed by their key prefix: exactly one stage per gate key (publication gates carry no fixture result). */
export function governedStage(gateKey: string): StageName | undefined {
  const family = gateKey.split(".", 1)[0];
  switch (family) {
    case "claims":
    case "writing":
      return "claims_writing";
    case "performance":
      return "performance";
    case "render":
      return "render";
    case "assembly":
      return "assembly";
    default:
      return undefined;
  }
}

export interface StageInputs {
  tables: Tables;
  /** Recomputed (never shipped) artifact identities. */
  hashes: {
    brief: string;
    package: string;
    pass2Script: string;
    direction: string;
    renderManifest: string;
    assemblyRecipe: string;
    masterAssemblyMap: string;
  };
  policyVersions: Record<string, string>; // policy name -> version_id (shipped policy map; hashes bound separately)
  productionAttempt: Row;
  boundConfigHash: string;
}

export interface DerivedStages {
  projections: Record<StageName, Obj>;
  fingerprints: Record<StageName, string>;
}

/** Derives all six stage projections from rows and recomputed upstream identities, in dependency order. */
export function deriveStages(input: StageInputs): DerivedStages {
  const { tables, hashes, policyVersions } = input;
  const policy = (name: string): string =>
    must(policyVersions[name], `policy ${name}`);
  const claims = policy("claims_policy");
  const writing = policy("writing_policy");
  const performance = policy("direction_spec");

  const audits = rowsOf(tables, "audit_runs");
  const auditVersions = new Set(audits.map((a) => str(a.auditor_version)));
  if (auditVersions.size !== 1)
    fail("audit_contract_version_ambiguous", [...auditVersions].join(","));
  const [auditorVersion] = [...auditVersions];

  const maps = rowsOf(tables, "master_assembly_maps");
  const [map, ...extraMaps] = maps;
  if (!map || extraMaps.length > 0) fail("master_assembly_map_cardinality");
  const audioByRow = indexBy(
    rowsOf(tables, "audio_artifacts"),
    "audio_artifact_id",
  );
  const master = must(
    audioByRow.get(str(map.master_audio_artifact_id)),
    "master audio",
  );
  const artifactsById = indexBy(rowsOf(tables, "artifacts"), "artifact_id");
  const masterArtifact = must(
    artifactsById.get(str(master.artifact_id)),
    "master audio artifact",
  );
  if (masterArtifact.content_hash !== master.audio_sha256)
    fail("master_audio_hash_mismatch");

  // selected take lineage: the non-superseded approved selection of every render block, in render-block sequence order
  const takes = indexBy(rowsOf(tables, "render_takes"), "render_take_id");
  const selections = rowsOf(tables, "take_selections");
  const superseded = new Set(
    selections
      .map((s) => s.supersedes_selection_id)
      .filter((v) => v !== null && v !== undefined)
      .map(str),
  );
  const lineage: Obj[] = [];
  for (const block of [...rowsOf(tables, "render_blocks")].sort(
    (a, b) => Number(a.sequence) - Number(b.sequence),
  )) {
    const live = selections.filter(
      (s) =>
        s.render_block_id === block.render_block_id &&
        s.decision === "approved" &&
        !superseded.has(str(s.take_selection_id)),
    );
    const [selection, ...rest] = live;
    if (!selection || rest.length > 0)
      fail("selected_take_cardinality", str(block.render_block_id));
    const take = must(
      takes.get(str(selection.render_take_id)),
      "selected take",
    );
    if (take.render_block_id !== block.render_block_id)
      fail("selected_take_block_mismatch", str(selection.take_selection_id));
    const audioArtifact = must(
      artifactsById.get(str(take.audio_artifact_id)),
      "take audio artifact",
    );
    const audio = rowsOf(tables, "audio_artifacts").find(
      (a) => a.artifact_id === take.audio_artifact_id,
    );
    if (!audio || audio.audio_sha256 !== audioArtifact.content_hash)
      fail("take_audio_hash_mismatch", str(take.render_take_id));
    lineage.push({
      audio_sha256: audio.audio_sha256,
      render_block_id: block.render_block_id,
      render_take_id: take.render_take_id,
      take_index: take.take_index,
      take_selection_id: selection.take_selection_id,
    });
  }

  const reviewGate = rowsOf(tables, "gate_definitions").find(
    (d) =>
      (d.definition as Obj | undefined)?.gate_key ===
      "publication.pre_publish_review",
  );

  const projections = {} as Record<StageName, Obj>;
  const fingerprints = {} as Record<StageName, string>;
  const put = (stage: StageName, projection: Obj): void => {
    projections[stage] = projection;
    fingerprints[stage] = fingerprint(stage, projection);
  };
  put("claims_writing", {
    brief_hash: hashes.brief,
    claims_policy_version: claims,
    gate_set_version: GATE_SET_VERSION,
    package_hash: hashes.package,
    script_hash: hashes.pass2Script,
    writing_policy_version: writing,
  });
  put("performance", {
    gate_set_version: GATE_SET_VERSION,
    performance_direction_hash: hashes.direction,
    performance_policy_version: performance,
    script_hash: hashes.pass2Script,
  });
  put("semantic_audit", {
    auditor_contract_version: auditorVersion,
    brief_hash: hashes.brief,
    claims_policy_version: claims,
    package_hash: hashes.package,
    performance_direction_hash: hashes.direction,
    performance_policy_version: performance,
    script_hash: hashes.pass2Script,
    writing_policy_version: writing,
  });
  put("render", {
    audit_input_fingerprint: fingerprints.semantic_audit,
    gate_set_version: GATE_SET_VERSION,
    render_manifest_hash: hashes.renderManifest,
    render_policy_version: performance,
  });
  put("assembly", {
    assembly_policy_version: performance,
    assembly_recipe_hash: hashes.assemblyRecipe,
    gate_set_version: GATE_SET_VERSION,
    master_assembly_map_hash: hashes.masterAssemblyMap,
    selected_take_lineage: lineage,
  });
  const run = must(
    rowsOf(tables, "program_runs").find(
      (r) => r.program_run_id === input.productionAttempt.program_run_id,
    ),
    "production run",
  );
  put("ready_candidate", {
    assembly_gate_fingerprint: fingerprints.assembly,
    attempt_id: input.productionAttempt.attempt_id,
    gate_set_version: GATE_SET_VERSION,
    master_artifact_id: masterArtifact.artifact_id,
    master_audio_sha256: master.audio_sha256,
    program_run_id: run.program_run_id,
    review_gate_version: must(reviewGate, "pre-publish review gate").version,
    show_config_version_hash: input.boundConfigHash,
  });
  return { projections, fingerprints };
}

/** The shipped comparison target: every shipped projection and fingerprint must equal the row-derived one. */
export function compareShippedStages(
  derived: DerivedStages,
  shipped: Record<
    string,
    { domain?: string; fingerprint: string; input_projection: Obj } | undefined
  >,
): void {
  for (const stage of stageOrder) {
    const target = must(shipped[stage], `shipped ${stage}`);
    same(
      "stage_projection_mismatch",
      derived.projections[stage],
      target.input_projection,
      stage,
    );
    same(
      "stage_fingerprint_mismatch",
      derived.fingerprints[stage],
      target.fingerprint,
      stage,
    );
  }
}

/** Each gate result is checked against its definition's governed stage, its declared fingerprint_stage and that stage's derived fingerprint. */
export function verifyGateResults(
  tables: Tables,
  derived: DerivedStages,
): void {
  const definitions = indexBy(
    rowsOf(tables, "gate_definitions"),
    "gate_definition_id",
  );
  const attempts = new Set(
    rowsOf(tables, "program_run_attempts").map((a) => str(a.attempt_id)),
  );
  const seen = new Set<string>();
  for (const result of rowsOf(tables, "gate_results")) {
    const id = str(result.gate_result_id);
    const definition = must(
      definitions.get(str(result.gate_definition_id)),
      `gate definition for ${id}`,
    );
    const key = str((definition.definition as Obj).gate_key);
    const stage = governedStage(key);
    if (stage === undefined) fail("gate_result_stage_unmapped", `${id} ${key}`);
    if (!attempts.has(str(result.attempt_id)))
      fail("gate_result_attempt_unknown", id);
    if ((result.result as Obj).fingerprint_stage !== stage)
      fail("gate_result_stage_mismatch", `${id} ${key}`);
    if (result.input_fingerprint !== derived.fingerprints[stage])
      fail("gate_result_fingerprint_mismatch", `${id} ${key} -> ${stage}`);
    const slot = `${str(result.attempt_id)}|${str(result.gate_definition_id)}`;
    if (seen.has(slot)) fail("gate_result_duplicate", id);
    seen.add(slot);
  }
  for (const attempt of attempts)
    for (const [definitionId, definition] of definitions)
      if (
        governedStage(str((definition.definition as Obj).gate_key)) !==
          undefined &&
        !seen.has(`${attempt}|${definitionId}`)
      )
        fail("gate_result_missing", `${attempt} ${definitionId}`);
}

export interface RenderInputs {
  tables: Tables;
  pass2ScriptArtifactId: string;
  pass2Turns: readonly Obj[]; // pass-2 script payload turns (semantic anchors)
  shippedBlocks: readonly {
    render_block_sequence: number;
    input_record: Obj;
    expected_hash: string;
  }[];
  shippedScriptContext: Obj;
}

export interface ActualScriptContext {
  program_block_order: string[];
  turns: Obj[];
}

/** The bound script's context from actual rows: pass-2 turn rows joined to the payload's semantic anchors. */
export function actualScriptContext(input: RenderInputs): ActualScriptContext {
  const { tables } = input;
  const version = must(
    rowsOf(tables, "script_versions").find(
      (s) => s.artifact_id === input.pass2ScriptArtifactId,
    ),
    "pass-2 script version",
  );
  const anchors = new Map(
    input.pass2Turns.map((t) => [str(t.turn_id), str(t.semantic_turn_id)]),
  );
  const turns = rowsOf(tables, "turns")
    .filter((t) => t.script_version_id === version.script_version_id)
    .sort((a, b) => Number(a.sequence) - Number(b.sequence))
    .map((t) => ({
      participant_id: t.participant_id,
      program_block_id: t.program_block_id,
      semantic_turn_id: must(
        anchors.get(str(t.turn_id)),
        `semantic anchor of ${str(t.turn_id)}`,
      ),
      sequence: t.sequence,
      spoken_text: t.spoken_text,
      turn_id: t.turn_id,
    }));
  if (turns.length !== anchors.size) fail("script_turn_anchor_mismatch");
  const order = [...rowsOf(tables, "program_blocks")]
    .sort((a, b) => Number(a.sequence) - Number(b.sequence))
    .map((b) => str(b.program_block_id));
  return { program_block_order: order, turns };
}

const compareKeys = [
  "participant_id",
  "program_block_id",
  "semantic_turn_id",
  "sequence",
  "spoken_text",
  "turn_id",
] as const;
function pick(row: Obj, keys: readonly string[]): Obj {
  return Object.fromEntries(keys.map((k) => [k, row[k]]));
}

/**
 * Rebuilds each block's resolved request record from the render-block, speaker-map, turn, voice, pronunciation,
 * intent and script rows; checks ownership against the ACTUAL bound script; hashes the REBUILT record and requires it to
 * equal the stored render_blocks.base_request_hash; and explicitly reconciles the shipped record's row-backed fields.
 */
export function verifyRenderRequests(input: RenderInputs): void {
  const { tables } = input;
  const script = actualScriptContext(input);
  // reconcile the shipped script context (comparison target only)
  same(
    "script_context_mismatch",
    script.turns.map((t) => pick(t, compareKeys)),
    (input.shippedScriptContext.turns as Obj[]).map((t) =>
      pick(t, compareKeys),
    ),
  );
  same(
    "script_context_mismatch",
    script.program_block_order,
    input.shippedScriptContext.program_block_order,
    "program_block_order",
  );

  const version = must(
    rowsOf(tables, "script_versions").find(
      (s) => s.artifact_id === input.pass2ScriptArtifactId,
    ),
    "pass-2 script version",
  );
  const turnRows = indexBy(
    rowsOf(tables, "turns").filter(
      (t) => t.script_version_id === version.script_version_id,
    ),
    "turn_id",
  );
  const scriptByTurn = new Map(script.turns.map((t) => [str(t.turn_id), t]));
  const voices = indexBy(
    rowsOf(tables, "voice_profile_versions"),
    "voice_profile_version_id",
  );
  const manifests = indexBy(
    rowsOf(tables, "render_manifests"),
    "render_manifest_id",
  );
  const intents = rowsOf(tables, "performance_intents");
  const renderings = indexBy(
    rowsOf(tables, "pronunciation_renderings"),
    "pronunciation_rendering_id",
  );
  const pronunciations = indexBy(
    rowsOf(tables, "pronunciations"),
    "pronunciation_id",
  );
  const blockOrder = script.program_block_order;
  const blocks = rowsOf(tables, "render_blocks");
  if (blocks.length !== input.shippedBlocks.length)
    fail("render_block_count_mismatch");
  const programBlocks = new Set(blockOrder);

  const currentPronunciation = (start: Row): Row => {
    let current = start;
    for (let hops = 0; ; hops += 1) {
      if (hops > 64)
        fail("pronunciation_chain_cycle", str(start.pronunciation_id));
      const next = rowsOf(tables, "pronunciations").find(
        (p) => p.supersedes_pronunciation_id === current.pronunciation_id,
      );
      if (!next) return current;
      current = next;
    }
  };

  for (const block of blocks) {
    const tag = `rb${str(block.sequence)}`;
    const shipped = must(
      input.shippedBlocks.find(
        (b) => b.render_block_sequence === block.sequence,
      ),
      `shipped record ${tag}`,
    );
    const manifest = must(
      manifests.get(str(block.render_manifest_id)),
      `${tag} manifest`,
    );
    if (manifest.script_version_id !== version.script_version_id)
      fail("render_block_script_binding", tag);
    if (!programBlocks.has(str(block.program_block_id)))
      fail("render_block_program_block_unknown", tag);

    // turns and speakers from the speaker map and the turn rows of the bound script
    const speakers = block.speaker_map as Obj[];
    const generated: Obj[] = [];
    const voiceByParticipant: Obj = {};
    for (const entry of speakers) {
      const turnId = str(entry.turn_id);
      const turn = must(turnRows.get(turnId), `${tag} turn ${turnId}`);
      const bound = must(
        scriptByTurn.get(turnId),
        `${tag} bound turn ${turnId}`,
      );
      if (turn.program_block_id !== block.program_block_id)
        fail("speaker_map_block_mismatch", tag);
      if (turn.participant_id !== entry.participant_id)
        fail("speaker_map_participant_mismatch", `${tag} ${turnId}`);
      const voice = must(
        voices.get(str(entry.voice_profile_version_id)),
        `${tag} voice`,
      );
      const identity = {
        ...(voice.render_fields as Obj),
        version: voice.version,
        voice_profile_id: voice.voice_profile_id,
        voice_profile_version_id: voice.voice_profile_version_id,
      };
      const participant = str(entry.participant_id);
      if (
        Object.hasOwn(voiceByParticipant, participant) &&
        canonicalJson(voiceByParticipant[participant]) !==
          canonicalJson(identity)
      )
        fail("speaker_voice_conflict", `${tag} ${participant}`);
      voiceByParticipant[participant] = identity;
      generated.push({
        participant_id: bound.participant_id,
        program_block_id: bound.program_block_id,
        semantic_turn_id: bound.semantic_turn_id,
        spoken_text: bound.spoken_text,
        turn_id: bound.turn_id,
        voice_profile_version_id: entry.voice_profile_version_id,
      });
    }
    const anchorByTurn = new Map(
      script.turns.map((t) => [str(t.turn_id), str(t.semantic_turn_id)]),
    );
    const anchorSequence = new Map(
      script.turns.map((t) => [str(t.semantic_turn_id), Number(t.sequence)]),
    );

    // intents of the bound direction for this block's turns, in script order
    const blockTurnIds = new Set(generated.map((t) => str(t.turn_id)));
    const derivedIntents = intents
      .filter(
        (i) =>
          i.performance_direction_version_id ===
            manifest.performance_direction_version_id &&
          blockTurnIds.has(str(i.turn_id)),
      )
      .map((i) => {
        const intent = i.intent as Obj;
        return {
          scope_type: intent.scope_type,
          scope_ref:
            intent.scope_type === "turn"
              ? must(
                  anchorByTurn.get(str(intent.scope_ref)),
                  `${tag} intent scope`,
                )
              : intent.scope_ref,
          intent_type: intent.intent_type,
          value: intent.value,
          strength: intent.strength,
          timing_anchor: intent.timing_anchor,
        };
      })
      .sort(
        (a, b) =>
          (anchorSequence.get(str(a.scope_ref)) ?? 0) -
            (anchorSequence.get(str(b.scope_ref)) ?? 0) ||
          (str(a.intent_type) < str(b.intent_type)
            ? -1
            : str(a.intent_type) > str(b.intent_type)
              ? 1
              : 0),
      );

    // context per recipe (the recipe LABEL is shipped; its turn comes from the bound script)
    const recipe = str((shipped.input_record.context as Obj).recipe_version);
    const position = blockOrder.indexOf(str(block.program_block_id));
    const preceding =
      position > 0
        ? script.turns
            .filter((t) => t.program_block_id === blockOrder[position - 1])
            .at(-1)
        : undefined;
    const contextTurns =
      recipe === "C2-v1" && preceding
        ? [
            {
              participant_id: preceding.participant_id,
              program_block_id: preceding.program_block_id,
              semantic_turn_id: preceding.semantic_turn_id,
              spoken_text: preceding.spoken_text,
              turn_id: preceding.turn_id,
            },
          ]
        : [];

    // pronunciation applications: row-backed fields from the pronunciation rows; placement (turn, offsets) is shipped
    const shippedApplications = (shipped.input_record
      .pronunciation_applications ?? []) as Obj[];
    const derivedApplications = shippedApplications.map((placement) => {
      const rendering = must(
        renderings.get(str(placement.pronunciation_rendering_id)),
        `${tag} rendering`,
      );
      const pronunciation = must(
        pronunciations.get(str(rendering.pronunciation_id)),
        `${tag} pronunciation`,
      );
      return {
        canonical_current_pronunciation_id:
          currentPronunciation(pronunciation).pronunciation_id,
        canonical_text: pronunciation.canonical_text,
        canonical_version: pronunciation.canonical_version,
        end_offset: placement.end_offset,
        entity_identity: pronunciation.entity_identity,
        ipa: pronunciation.ipa,
        language: pronunciation.language,
        pronunciation_id: pronunciation.pronunciation_id,
        pronunciation_rendering_id: rendering.pronunciation_rendering_id,
        provider: rendering.provider,
        render_text: rendering.rendering,
        rendering_pronunciation_id: rendering.pronunciation_id,
        rendering_version: rendering.version,
        semantic_turn_id: placement.semantic_turn_id,
        start_offset: placement.start_offset,
        voice_profile_version_id: rendering.voice_profile_version_id,
      };
    });

    const rebuilt: Obj = {
      record_schema: shipped.input_record.record_schema,
      adapter_render_contract_version:
        shipped.input_record.adapter_render_contract_version,
      concrete_model_identity: shipped.input_record.concrete_model_identity,
      resolved_generation_settings:
        shipped.input_record.resolved_generation_settings,
      scene_config: shipped.input_record.scene_config,
      named_text_transform_versions:
        shipped.input_record.named_text_transform_versions,
      take_index: shipped.input_record.take_index,
      turns: generated,
      voice_versions: voiceByParticipant,
      intents: derivedIntents,
      context: { recipe_version: recipe, turns: contextTurns },
      pronunciation_applications: derivedApplications,
    };
    try {
      checkFixtureRequestOwnership(rebuilt, script);
    } catch (error) {
      fail(
        "render_request_ownership",
        `${tag}: ${error instanceof Error ? error.message : "rejected"}`,
      );
    }
    const hash = requestBaseHash(rebuilt);
    same("base_request_hash_mismatch", hash, block.base_request_hash, tag);

    // explicit reconciliation of the shipped record against the rows (comparison target)
    same(
      "request_record_mismatch",
      hash,
      shipped.expected_hash,
      `${tag} expected hash`,
    );
    same(
      "request_record_mismatch",
      shipped.input_record.turns,
      rebuilt.turns,
      `${tag} turns`,
    );
    for (const participant of Object.keys(voiceByParticipant))
      same(
        "request_record_mismatch",
        voiceRenderIdentity(
          (shipped.input_record.voice_versions as Obj)[participant],
        ),
        voiceRenderIdentity(voiceByParticipant[participant]),
        `${tag} voice ${participant}`,
      );
    same(
      "request_record_mismatch",
      Object.keys(shipped.input_record.voice_versions as Obj).sort(),
      Object.keys(voiceByParticipant).sort(),
      `${tag} voice set`,
    );
    same(
      "request_record_mismatch",
      (shipped.input_record.intents as Obj[]).map((i) =>
        pick(i, [
          "scope_type",
          "scope_ref",
          "intent_type",
          "value",
          "strength",
          "timing_anchor",
        ]),
      ),
      derivedIntents,
      `${tag} intents`,
    );
    same(
      "request_record_mismatch",
      (shipped.input_record.context as Obj).turns,
      contextTurns,
      `${tag} context`,
    );
    same(
      "request_record_mismatch",
      shippedApplications.map((a) =>
        pick(a, Object.keys(derivedApplications[0] ?? {})),
      ),
      derivedApplications,
      `${tag} pronunciations`,
    );
  }
}
