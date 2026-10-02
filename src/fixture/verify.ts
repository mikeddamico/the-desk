// Pure verification of the active load with the accepted A1 identity modules (no filesystem, no database).
// `buildContext` collects the shipped (non-row) evidence from the verified pack once; `verifyRows` then checks a row set
// against it. The SAME function verifies the shipped snapshot before insertion and the rows read back from the database
// after insertion, so persistence is proved by recomputation over persisted rows, not by re-reading expected records.
// The independent dependency-chain derivation stays in test/a1-dependency-chain.test.ts and is not replaced by this file.
import {
  assemblyRecipeHash,
  evidencePackageHash,
  masterAssemblyMapHash,
  mechanicalValidationResultHash,
  performanceDirectionHash,
  renderManifestHash,
  revalidationResultHash,
  revalidationSnapshotHash,
  scriptHash,
  semanticAuditResultHash,
  serializedWriterInputHash,
  showrunnerBriefHash,
  turnAnchorMap,
  writerContextManifestHash,
  writerViewHash,
  writingCraftReviewHash,
} from "../identity/artifacts.js";
import { verifyAddendumBindings } from "../identity/addendum-binding.js";
import { canonicalJson } from "../identity/canonical-json.js";
import { evidenceBodyHash, rawBytesHash } from "../identity/domains.js";
import {
  claimContentHash,
  claimFrozenStateHash,
  derivationOutputHash,
  fixtureSupportObjectHash,
  supportHashFor,
} from "../identity/knowledge.js";
import {
  assertCurrentInputFingerprint,
  assertHistoricalProducerNull,
  correctionInputFingerprintFromBytes,
  evidencePackageScopeHash,
} from "../identity/layer-b.js";
import {
  assertCompletePromptManifestPayload,
  modelSemanticInputHash,
  promptManifestArtifactHash,
  reconcileTypedManifestFields,
} from "../identity/prompt-manifest.js";
import { showConfigVersionHash } from "../identity/show-config.js";
import {
  DerivationError,
  compareShippedStages,
  deriveStages,
  verifyGateResults,
  verifyRenderRequests,
} from "./derive.js";
import type { Pack } from "./pack.js";
import type { Row, Tables } from "./rows.js";

export class FixtureVerificationError extends Error {
  readonly code: string;
  constructor(code: string, detail = "") {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "FixtureVerificationError";
    this.code = code;
  }
}

type Obj = Record<string, unknown>;
const str = (v: unknown): string => String(v);
function expectEqual(
  code: string,
  actual: unknown,
  expected: unknown,
  detail = "",
): void {
  if (canonicalJson(actual) !== canonicalJson(expected))
    throw new FixtureVerificationError(code, detail);
}
function asVerificationError(error: unknown): unknown {
  return error instanceof DerivationError
    ? new FixtureVerificationError(error.code, error.message)
    : error;
}
function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null)
    throw new FixtureVerificationError("missing_reference", what);
  return value;
}

export interface FixtureContext {
  /** Raw bytes of the shipped actual-block records etc. are parsed once from verified, non-archival members. */
  blocks: {
    render_block_sequence: number;
    input_record: Obj;
    expected_hash: string;
  }[];
  scriptContext: { program_block_order: string[]; turns: Obj[] };
  specimens: Map<string, string>; // prompt_manifest_id -> exact request text
  gates: Record<
    string,
    { domain: string; fingerprint: string; input_projection: Obj }
  >;
  policyMap: Obj;
  addendumBytes: Buffer;
  frozenCorrectionBytes: Buffer;
  recordV2Bytes: Buffer;
  audioSha: Map<string, string>; // storage_uri -> sha256 of the shipped WAV member
  memberPayload: (storageUri: string) => unknown; // shipped JSON member copy (non-archival)
  containerPayloads: Map<string, unknown>; // artifact_id -> payload from the shared containers
}

export function buildContext(pack: Pack): FixtureContext {
  const base = pack.json("base_request_hash_conformance.json") as Obj;
  const requests = (
    pack.json("fixture_model_requests.json") as { requests: Obj[] }
  ).requests;
  const policyMap = pack.json("config/policy_versions.json") as Obj;
  const policies = policyMap.policies as Record<string, Obj>;
  const addendum = must(
    policies.writing_fixture_profile_addendum,
    "addendum policy",
  );
  const containers = new Map<string, unknown>();
  for (const [member, key] of [
    ["prompt_payloads.json", "manifests"],
    ["support_payloads.json", "artifacts"],
  ] as const)
    for (const entry of (pack.json(member) as Record<string, Obj[]>)[key] ?? [])
      containers.set(str(entry.artifact_id), entry.canonical_payload);
  const audioSha = new Map<string, string>();
  for (const name of pack.memberNames)
    if (name.startsWith("fixture_audio/"))
      audioSha.set(name, rawBytesHash(pack.member(name)));
  return {
    blocks: base.actual_blocks as FixtureContext["blocks"],
    scriptContext: base.script_context as FixtureContext["scriptContext"],
    specimens: new Map(
      requests.map((r) => [str(r.prompt_manifest_id), str(r.rendered_request)]),
    ),
    gates: pack.json("gate_fingerprint_inputs.json") as FixtureContext["gates"],
    policyMap,
    addendumBytes: pack.member(str(addendum.shipped_at)),
    frozenCorrectionBytes: pack.member(
      "provenance/frozen/correction_input_projection.json",
    ),
    recordV2Bytes: pack.member(
      "provenance/frozen/technical_resolution_record_v2.md",
    ),
    audioSha,
    memberPayload: (uri) => pack.json(uri),
    containerPayloads: containers,
  };
}

/** Pre-insertion only: the stored payload copies equal the shipped member/container copies and WAV bytes. */
export function verifyShippedCopies(tables: Tables, ctx: FixtureContext): void {
  for (const a of tables.artifacts ?? []) {
    const uri = str(a.storage_uri);
    if (uri.startsWith("fixture_audio/")) {
      if (ctx.audioSha.get(uri) !== a.content_hash)
        throw new FixtureVerificationError(
          "audio_member_hash_mismatch",
          str(a.artifact_id),
        );
      continue;
    }
    const shipped = ctx.containerPayloads.has(str(a.artifact_id))
      ? ctx.containerPayloads.get(str(a.artifact_id))
      : ctx.memberPayload(uri);
    expectEqual(
      "artifact_payload_copy_mismatch",
      a.canonical_payload,
      shipped,
      `${str(a.artifact_type)} ${str(a.artifact_id)}`,
    );
  }
}

/** Verifies a row set (shipped snapshot or rows read back) against the shipped context. Throws on the first failure. */
export function verifyRows(
  tables: Tables,
  ctx: FixtureContext,
  historical: { artifactId: string; contentHash: string },
): void {
  const rows = (name: string): readonly Row[] => tables[name] ?? [];
  const artifacts = rows("artifacts");
  const byId = new Map(artifacts.map((a) => [str(a.artifact_id), a]));
  const byType = (type: string): Row => {
    const hits = artifacts.filter(
      (a) =>
        a.artifact_type === type && a.artifact_id !== historical.artifactId,
    );
    const [only, ...rest] = hits;
    if (only === undefined || rest.length > 0)
      throw new FixtureVerificationError("artifact_type_cardinality", type);
    return only;
  };
  const payload = (type: string): Obj => byType(type).canonical_payload as Obj;
  const hashOf = (type: string): string => str(byType(type).content_hash);

  // ---- historical disposition (Layer B 4/5): accepted only as itself, never recomputed, never current
  const hist = must(byId.get(historical.artifactId), "historical direction");
  if (
    hist.content_hash !== historical.contentHash ||
    hist.artifact_type !== "performance_direction"
  )
    throw new FixtureVerificationError("historical_identity_mismatch");
  try {
    assertHistoricalProducerNull(hist.canonical_payload);
  } catch {
    throw new FixtureVerificationError("historical_null_disposition_violated");
  }
  let rejectedAsCurrent = false;
  try {
    assertCurrentInputFingerprint(hist.canonical_payload);
  } catch {
    rejectedAsCurrent = true;
  }
  if (!rejectedAsCurrent)
    throw new FixtureVerificationError("historical_accepted_as_current");

  // ---- knowledge layer
  const bodies = new Map(
    rows("evidence_units").map((u) => [
      str(u.evidence_unit_id),
      str(u.canonical_content),
    ]),
  );
  for (const u of rows("evidence_units"))
    expectEqual(
      "evidence_hash_mismatch",
      evidenceBodyHash(str(u.canonical_content)),
      u.content_hash,
      str(u.evidence_unit_id),
    );
  const derivation = new Map(
    rows("derivation_runs").map((d) => [str(d.derivation_run_id), d]),
  );
  for (const d of derivation.values())
    expectEqual(
      "derivation_hash_mismatch",
      derivationOutputHash(d.output),
      d.output_hash,
    );
  const claimState = new Map<string, string>();
  for (const c of rows("claims")) {
    expectEqual(
      "claim_hash_mismatch",
      claimContentHash(c),
      c.content_hash,
      str(c.claim_id),
    );
    claimState.set(
      str(c.claim_id),
      claimFrozenStateHash({
        claim_content_hash: c.content_hash,
        state: c.initial_status,
        effective_usage_class: c.initial_usage_class,
      }),
    );
  }
  for (const s of rows("claim_supports")) {
    const kind = str(s.support_kind);
    const carrier =
      kind === "signal" || kind === "continuity"
        ? byId.get(str(s.external_support_identity).split(":", 2)[1] ?? "")
        : undefined;
    const expected = supportHashFor(kind, {
      evidenceBody: s.evidence_unit_id
        ? bodies.get(str(s.evidence_unit_id))
        : undefined,
      derivationOutput: s.derivation_run_id
        ? derivation.get(str(s.derivation_run_id))?.output
        : undefined,
      carrier: carrier?.canonical_payload,
    });
    expectEqual(
      "support_hash_mismatch",
      expected,
      s.support_hash,
      str(s.claim_support_id),
    );
  }

  // ---- artifact content hashes (accepted A1 projections over the stored payloads)
  const brief = payload("showrunner_brief");
  const scripts = ["script_pass1", "script_craft_revision", "script_pass2"].map(
    byType,
  );
  const scriptHashes = scripts.map((s) =>
    scriptHash(s.canonical_payload, { brief }),
  );
  scripts.forEach((s, i) => {
    expectEqual(
      "script_hash_mismatch",
      scriptHashes[i],
      s.content_hash,
      str(s.artifact_type),
    );
  });
  const pass1Anchors = turnAnchorMap(
    (scripts[0]?.canonical_payload as Obj).turns,
  );
  const pass2Anchors = turnAnchorMap(
    (scripts[2]?.canonical_payload as Obj).turns,
  );
  const expectedArtifact: [string, string][] = [
    ["showrunner_brief", showrunnerBriefHash(brief)],
    [
      "writing_craft_review",
      writingCraftReviewHash(payload("writing_craft_review"), pass1Anchors),
    ],
    [
      "evidence_package",
      evidencePackageHash(byType("evidence_package").canonical_payload),
    ],
    ["writer_view", writerViewHash(payload("writer_view"))],
    [
      "writer_context_manifest",
      writerContextManifestHash(payload("writer_context_manifest")),
    ],
    [
      "semantic_audit_result",
      semanticAuditResultHash(payload("semantic_audit_result")),
    ],
    ["render_manifest", renderManifestHash(payload("render_manifest"))],
    ["assembly_recipe", assemblyRecipeHash(payload("assembly_recipe"))],
    [
      "master_assembly_map",
      masterAssemblyMapHash(payload("master_assembly_map")),
    ],
    [
      "mechanical_validation",
      mechanicalValidationResultHash(payload("mechanical_validation")),
    ],
    [
      "revalidation_snapshot",
      revalidationSnapshotHash(payload("revalidation_snapshot")),
    ],
    [
      "revalidation_result",
      revalidationResultHash(payload("revalidation_result")),
    ],
    ["tenor_support", fixtureSupportObjectHash(payload("tenor_support"))],
    [
      "continuity_support",
      fixtureSupportObjectHash(payload("continuity_support")),
    ],
    [
      "performance_direction",
      performanceDirectionHash(payload("performance_direction"), pass2Anchors),
    ],
  ];
  for (const [type, hash] of expectedArtifact)
    expectEqual("artifact_hash_mismatch", hash, hashOf(type), type);
  for (const a of artifacts)
    if (
      str(a.artifact_type).startsWith("audio/") &&
      a.content_hash !== undefined &&
      !/^[0-9a-f]{64}$/.test(str(a.content_hash))
    )
      throw new FixtureVerificationError(
        "audio_hash_format",
        str(a.artifact_id),
      );
  const writerSerialized = serializedWriterInputHash(payload("writer_view"));
  expectEqual(
    "serialized_input_mismatch",
    writerSerialized,
    payload("writer_context_manifest").serialized_input_hash,
  );

  // ---- artifact-to-artifact bindings
  const [pass1, craft, pass2] = scriptHashes;
  expectEqual(
    "brief_package_binding",
    payload("showrunner_brief").package_hash,
    hashOf("evidence_package"),
  );
  for (const s of scripts) {
    expectEqual(
      "script_brief_binding",
      (s.canonical_payload as Obj).brief_hash,
      hashOf("showrunner_brief"),
    );
    expectEqual(
      "script_package_binding",
      (s.canonical_payload as Obj).package_hash,
      hashOf("evidence_package"),
    );
  }
  expectEqual(
    "revision_parent_binding",
    (scripts[1]?.canonical_payload as Obj).revision_parent_content_identity,
    pass1,
  );
  expectEqual(
    "revision_parent_binding",
    (scripts[2]?.canonical_payload as Obj).revision_parent_content_identity,
    craft,
  );
  expectEqual(
    "review_subject_binding",
    payload("writing_craft_review").subject_script_hash,
    pass1,
  );
  const direction = payload("performance_direction");
  assertCurrentInputFingerprint(direction);
  expectEqual("direction_script_binding", direction.script_hash, pass2);
  expectEqual(
    "direction_supersedes_historical",
    byType("performance_direction").supersedes_artifact_id,
    historical.artifactId,
  );
  expectEqual(
    "correction_fingerprint_mismatch",
    correctionInputFingerprintFromBytes(ctx.frozenCorrectionBytes),
    direction.input_fingerprint,
  );
  const frozen = JSON.parse(ctx.frozenCorrectionBytes.toString("utf8")) as Obj;
  expectEqual("correction_script_binding", frozen.script_hash, pass2);
  expectEqual(
    "correction_record_binding",
    frozen.adjudication_record_sha256,
    rawBytesHash(ctx.recordV2Bytes),
  );
  for (const t of ["writer_view"]) {
    expectEqual(
      "writer_brief_binding",
      payload(t).brief_hash,
      hashOf("showrunner_brief"),
    );
    expectEqual(
      "writer_package_binding",
      payload(t).package_hash,
      hashOf("evidence_package"),
    );
  }
  const pkg = payload("evidence_package");
  expectEqual(
    "scope_hash_mismatch",
    evidencePackageScopeHash((pkg.manifest as Obj).scope),
    pkg.scope_hash,
  );
  for (const e of rows("evidence_packages")) {
    expectEqual(
      "package_row_hash_mismatch",
      e.package_hash,
      hashOf("evidence_package"),
    );
    expectEqual(
      "package_row_artifact_binding",
      e.artifact_id,
      byType("evidence_package").artifact_id,
    );
  }
  const manifest = pkg.manifest as { claims: Obj[]; evidence: Obj[] };
  for (const c of manifest.claims) {
    expectEqual(
      "package_claim_hash_mismatch",
      c.claim_content_hash,
      rows("claims").find((x) => x.claim_id === c.claim_id)?.content_hash,
    );
    expectEqual(
      "package_frozen_state_mismatch",
      c.frozen_state_hash,
      claimState.get(str(c.claim_id)),
    );
  }
  for (const e of manifest.evidence)
    expectEqual(
      "package_evidence_hash_mismatch",
      e.content_hash,
      rows("evidence_units").find(
        (x) => x.evidence_unit_id === e.evidence_unit_id,
      )?.content_hash,
    );

  // ---- show configuration (bounded show-config/1) and run/attempt bindings
  const configs = new Map(
    rows("show_config_versions").map((c) => [str(c.show_config_version_id), c]),
  );
  for (const c of configs.values())
    expectEqual(
      "show_config_hash_mismatch",
      showConfigVersionHash(c),
      c.config_hash,
    );
  for (const c of configs.values())
    if (c.parent_version_id !== null && !configs.has(str(c.parent_version_id)))
      throw new FixtureVerificationError("show_config_parent_missing");
  const attempts = rows("program_run_attempts");
  const productionAttempt = must(
    attempts.find((a) =>
      rows("program_runs").some(
        (r) =>
          r.program_run_id === a.program_run_id && r.purpose === "production",
      ),
    ),
    "production attempt",
  );
  const boundConfig = must(
    configs.get(str(productionAttempt.show_config_version_id)),
    "attempt config",
  );
  for (const a of attempts) {
    expectEqual(
      "attempt_package_binding",
      a.evidence_package_id,
      rows("evidence_packages")[0]?.evidence_package_id,
    );
    expectEqual("attempt_state", a.state, "PENDING");
  }

  // ---- prompt manifests, model runs, provider calls
  const manifestRows = rows("prompt_manifests");
  const bound: { role: string; row: Row; payload: Obj }[] = [];
  const semantic = new Map<string, string>();
  for (const row of manifestRows) {
    const artifact = must(byId.get(str(row.artifact_id)), "manifest artifact");
    const pl = artifact.canonical_payload as Obj;
    assertCompletePromptManifestPayload(pl);
    reconcileTypedManifestFields(row, pl);
    expectEqual(
      "manifest_hash_mismatch",
      promptManifestArtifactHash(pl),
      artifact.content_hash,
    );
    const specimen = must(
      ctx.specimens.get(str(row.prompt_manifest_id)),
      "request specimen",
    );
    expectEqual(
      "request_hash_mismatch",
      rawBytesHash(Buffer.from(specimen, "utf8")),
      row.rendered_request_hash,
    );
    for (const input of pl.ordered_input_artifacts as Obj[]) {
      const target = must(byId.get(str(input.artifact_id)), "manifest input");
      expectEqual(
        "manifest_input_hash_mismatch",
        input.content_hash,
        target.content_hash,
        str(input.artifact_id),
      );
      if (!specimen.includes(str(input.content_hash)))
        throw new FixtureVerificationError(
          "specimen_input_missing",
          str(input.artifact_id),
        );
    }
    bound.push({ role: str(pl.purpose), row, payload: pl });
    semantic.set(str(row.prompt_manifest_id), modelSemanticInputHash(row));
  }
  verifyAddendumBindings(bound, ctx.policyMap, ctx.addendumBytes);
  const calls = new Map(
    rows("provider_calls").map((c) => [str(c.provider_call_id), c]),
  );
  for (const run of rows("model_runs")) {
    expectEqual(
      "semantic_input_mismatch",
      semantic.get(str(run.prompt_manifest_id)),
      run.semantic_input_hash,
    );
    const call = must(calls.get(str(run.provider_call_id)), "model run call");
    const manifest = must(
      manifestRows.find((m) => m.prompt_manifest_id === run.prompt_manifest_id),
      "manifest",
    );
    expectEqual(
      "provider_call_fingerprint_mismatch",
      call.request_fingerprint,
      manifest.rendered_request_hash,
    );
    expectEqual(
      "provider_call_key_mismatch",
      call.logical_request_key,
      `fixture_stub:${str(call.operation)}:${str(manifest.rendered_request_hash)}`,
    );
    expectEqual(
      "model_output_artifact_missing",
      byId.has(str(run.output_artifact_id)),
      true,
    );
  }

  // ---- render requests: rebuilt from the actual render-block, speaker, turn, voice, pronunciation, intent and script rows
  const scriptArtifact = scripts[2];
  try {
    verifyRenderRequests({
      tables,
      pass2ScriptArtifactId: str(scriptArtifact?.artifact_id),
      pass2Turns: (scriptArtifact?.canonical_payload as Obj).turns as Obj[],
      shippedBlocks: ctx.blocks,
      shippedScriptContext: ctx.scriptContext,
    });
  } catch (error) {
    throw asVerificationError(error);
  }
  for (const block of rows("render_blocks"))
    if (
      !(payload("render_manifest").render_blocks as Obj[]).some(
        (b) => b.base_request_hash === block.base_request_hash,
      )
    )
      throw new FixtureVerificationError(
        "render_manifest_block_missing",
        str(block.sequence),
      );

  // ---- six stage projections derived from rows and recomputed upstream identities; shipped copies are comparison targets
  let derived;
  try {
    derived = deriveStages({
      tables,
      hashes: {
        brief: hashOf("showrunner_brief"),
        package: hashOf("evidence_package"),
        pass2Script: str(pass2),
        direction: hashOf("performance_direction"),
        renderManifest: hashOf("render_manifest"),
        assemblyRecipe: hashOf("assembly_recipe"),
        masterAssemblyMap: hashOf("master_assembly_map"),
      },
      policyVersions: Object.fromEntries(
        Object.entries(ctx.policyMap.policies as Record<string, Obj>).map(
          ([name, entry]) => [name, str(entry.version_id)],
        ),
      ),
      productionAttempt,
      boundConfigHash: str(boundConfig.config_hash),
    });
    compareShippedStages(derived, ctx.gates);
    verifyGateResults(tables, derived);
  } catch (error) {
    throw asVerificationError(error);
  }
  for (const a of rows("audit_runs"))
    expectEqual(
      "audit_fingerprint_mismatch",
      a.input_fingerprint,
      derived.fingerprints.semantic_audit,
    );

  // ---- turns per script version: anchors are unique WITHIN a script version (never globally across the 51 rows)
  const turnRows = rows("turns");
  let checkedTurns = 0;
  for (const sv of rows("script_versions")) {
    const artifact = must(byId.get(str(sv.artifact_id)), "script artifact");
    const turns = (artifact.canonical_payload as Obj).turns as Obj[];
    turnAnchorMap(turns); // throws on a duplicate (canonically-equal) anchor or turn id inside this script
    const mine = turnRows.filter(
      (t) => t.script_version_id === sv.script_version_id,
    );
    expectEqual(
      "script_turn_count_mismatch",
      mine.length,
      turns.length,
      str(sv.script_version_id),
    );
    for (const t of turns) {
      const row = must(
        mine.find((m) => m.turn_id === t.turn_id),
        "turn row",
      );
      for (const k of [
        "participant_id",
        "program_block_id",
        "spoken_text",
        "sequence",
      ])
        expectEqual(
          "turn_row_mismatch",
          row[k],
          t[k],
          `${str(t.semantic_turn_id)}.${k}`,
        );
    }
    checkedTurns += mine.length;
  }
  expectEqual("turn_rows_unbound", checkedTurns, turnRows.length);
  const distinctTurnIds = new Set(turnRows.map((t) => str(t.turn_id)));
  expectEqual(
    "revision_turn_uuid_count",
    distinctTurnIds.size,
    turnRows.length,
  );
}
