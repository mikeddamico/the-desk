// Row-to-payload bindings (A4): package snapshot, artifact registry and consumers, script claim/evidence uses, version rows.
// Owners: Evidence Package v0.2.2 (frozen package; selected support/rights snapshots), Claims v0.1.2 (4.3 supports, 4.5 explicit
// turn_claim_use, 22 deterministic gates), Hashing v0.1.5 section 14.1 (35-artifact registry, "every registry row needs a
// resolvable consumer") and the Handoff minimum persistent objects. Fixture-scoped counts and the use-mode/class mapping (see
// claimUseModeViolation) are labeled where they appear. Gate RE-EXECUTION stays in the later workflow tranche (GA-1): these helpers verify
// row/payload relationships only.
import { codePointLength } from "./code-points.js";
import {
  without,
  fail,
  indexBy,
  isObj,
  list,
  must,
  obj,
  rowsOf,
  same,
  str,
  type Obj,
} from "./check-util.js";
import type { Row, Tables } from "./rows.js";

const artifactOf = (tables: Tables, type: string): Row =>
  must(
    rowsOf(tables, "artifacts").find((a) => a.artifact_type === type),
    type,
  );
const payloadOf = (row: Row): Obj =>
  obj(row.canonical_payload, "artifact payload");

// ---------------------------------------------------------------------------------------------------------------- package
/** The frozen package's claim and evidence entries against the durable claim, support, evidence and rights rows. */
export function verifyPackageSnapshot(tables: Tables): void {
  const manifest = obj(
    payloadOf(artifactOf(tables, "evidence_package")).manifest,
    "manifest",
  );
  const claims = indexBy(rowsOf(tables, "claims"), "claim_id");
  const entries = list(manifest.claims, "manifest claims").map((c) =>
    obj(c, "claim entry"),
  );
  // unique AND complete membership against the durable rows (counts alone would pass a duplicated entry)
  const entryIds = entries.map((e) => str(e.claim_id));
  if (new Set(entryIds).size !== entryIds.length)
    fail("package_claim_duplicate");
  for (const id of entryIds)
    if (!claims.has(id)) fail("package_claim_unknown", id);
  for (const id of claims.keys())
    if (!entryIds.includes(id)) fail("package_claim_omitted", id);
  for (const entry of entries) {
    const id = str(entry.claim_id);
    const row = must(claims.get(id), `claim ${id}`);
    if (
      entry.kind !== row.claim_kind ||
      entry.origin !== row.origin ||
      entry.subject_domain !== row.subject_domain ||
      entry.predicate !== row.predicate
    )
      fail("package_claim_fields", id);
    same("package_claim_value", entry.value, row.value, id);
    const cols = [
      "claim_support_id",
      "derivation_run_id",
      "evidence_unit_id",
      "external_support_identity",
      "support_hash",
      "support_kind",
      "support_role",
    ] as const;
    const want = rowsOf(tables, "claim_supports")
      .filter((s) => s.claim_id === row.claim_id)
      .map((s) => Object.fromEntries(cols.map((k) => [k, s[k]])))
      .sort((a, b) =>
        str(a.claim_support_id).localeCompare(str(b.claim_support_id)),
      );
    const got = list(entry.support_refs, "support_refs")
      .map((r) => obj(r, "support ref"))
      .map((r) => Object.fromEntries(cols.map((k) => [k, r[k]])))
      .sort((a, b) =>
        str(a.claim_support_id).localeCompare(str(b.claim_support_id)),
      );
    same("package_support_snapshot", got, want, id);
  }
  const units = indexBy(rowsOf(tables, "evidence_units"), "evidence_unit_id");
  const rights = indexBy(
    rowsOf(tables, "rights_versions"),
    "rights_version_id",
  );
  const evidence = list(manifest.evidence, "manifest evidence").map((e) =>
    obj(e, "evidence entry"),
  );
  const evidenceIds = evidence.map((e) => str(e.evidence_unit_id));
  if (new Set(evidenceIds).size !== evidenceIds.length)
    fail("package_evidence_duplicate");
  for (const id of evidenceIds)
    if (!units.has(id)) fail("package_evidence_unknown", id);
  for (const id of units.keys())
    if (!evidenceIds.includes(id)) fail("package_evidence_omitted", id);
  for (const e of evidence) {
    const id = str(e.evidence_unit_id);
    const unit = must(units.get(id), `evidence ${id}`);
    const right = must(
      rights.get(str(unit.rights_version_id)),
      `rights of ${id}`,
    );
    const policy = obj(right.policy, "rights policy");
    if (
      e.content_hash !== unit.content_hash ||
      e.evidence_type !== unit.evidence_type ||
      e.rights_version_id !== unit.rights_version_id ||
      !list(
        policy.covered_source_identities,
        "covered_source_identities",
      ).includes(e.source_identity)
    )
      fail("package_evidence_fields", id);
    // The package may only RESTRICT what the rights version allows: a permission is never granted beyond the rights policy and each
    // consumer's exposure is one of the levels the rights version's ceiling lists for that consumer.
    if (
      (e.quote_permission === true && policy.quotation_permission !== true) ||
      (e.paraphrase_permission === true &&
        policy.paraphrase_permission !== true)
    )
      fail("package_evidence_permission_exceeds_rights", id);
    const ceiling = obj(policy.consumer_exposure_ceiling, "exposure ceiling");
    const exposure = obj(e.consumer_exposure, "consumer_exposure");
    for (const consumer of Object.keys(exposure)) {
      const levels = list(ceiling[consumer], `ceiling ${consumer}`);
      if (!levels.includes(exposure[consumer]))
        fail("package_evidence_exposure_exceeds_rights", `${id} ${consumer}`);
    }
  }
}

// ----------------------------------------------------------------------------------------------------- registry + consumers
/** FIXTURE-SCOPED Hashing 14.1 registry: 35 current artifacts + 1 retained historical direction, by artifact_type. */
export const FIXTURE_ARTIFACT_TYPE_COUNTS: Readonly<Record<string, number>> = {
  showrunner_brief: 1,
  script_pass1: 1,
  script_craft_revision: 1,
  script_pass2: 1,
  writing_craft_review: 1,
  prompt_manifest_1: 1,
  prompt_manifest_2: 1,
  prompt_manifest_3: 1,
  prompt_manifest_4: 1,
  prompt_manifest_5: 1,
  "audio/render_take": 10,
  "audio/static_asset": 1,
  "audio/clean_master": 1,
  evidence_package: 1,
  performance_direction: 2,
  semantic_audit_result: 1,
  render_manifest: 1,
  assembly_recipe: 1,
  master_assembly_map: 1,
  tenor_support: 1,
  continuity_support: 1,
  writer_view: 1,
  writer_context_manifest: 1,
  mechanical_validation: 1,
  revalidation_snapshot: 1,
  revalidation_result: 1,
};

const MODEL_OUTPUTS = [
  "showrunner_brief",
  "script_pass1",
  "script_craft_revision",
  "script_pass2",
  "writing_craft_review",
];
const AUDIO = ["audio/render_take", "audio/static_asset", "audio/clean_master"];
const SCRIPTS = ["script_pass1", "script_craft_revision", "script_pass2"];
const MANIFESTS = [
  "prompt_manifest_1",
  "prompt_manifest_2",
  "prompt_manifest_3",
  "prompt_manifest_4",
  "prompt_manifest_5",
];

/**
 * Governed consumer relations: (column) -> artifact kinds that column may legitimately reference. A reference to the wrong kind is
 * a failure; an incidental string never counts. Not a generic DAG policy: it is the list of durable owners in Hashing 14.1.
 */
export const CONSUMER_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  "evidence_packages.artifact_id": ["evidence_package"],
  "showrunner_brief_versions.artifact_id": ["showrunner_brief"],
  "script_versions.artifact_id": SCRIPTS,
  "performance_direction_versions.artifact_id": ["performance_direction"],
  "render_manifests.artifact_id": ["render_manifest"],
  "assembly_recipes.artifact_id": ["assembly_recipe"],
  "master_assembly_maps.artifact_id": ["master_assembly_map"],
  "prompt_manifests.artifact_id": MANIFESTS,
  "model_runs.output_artifact_id": MODEL_OUTPUTS,
  "audit_runs.result_artifact_id": ["semantic_audit_result"],
  "audio_artifacts.artifact_id": AUDIO,
  "render_takes.audio_artifact_id": ["audio/render_take"],
  "provider_call_events.response_artifact_id": [
    ...MODEL_OUTPUTS,
    "audio/render_take",
  ],
  "reroll_triggers.validation_artifact_id": ["mechanical_validation"],
  "artifacts.parent_artifact_id": SCRIPTS,
  "artifacts.supersedes_artifact_id": ["performance_direction"],
};
const EXTERNAL_SUPPORT = ["tenor_support", "continuity_support"];
/** Ordered input artifacts of a prompt manifest: governed inputs, never audio or other manifests. */
const MANIFEST_INPUTS = [
  ...MODEL_OUTPUTS,
  "evidence_package",
  "writer_view",
  "writer_context_manifest",
  "performance_direction",
  "semantic_audit_result",
];

export function verifyArtifactRegistry(
  tables: Tables,
  historicalArtifactId: string,
  frozenReadyFingerprint?: string,
): void {
  const artifacts = indexBy(rowsOf(tables, "artifacts"), "artifact_id");
  const counts = new Map<string, number>();
  for (const a of artifacts.values())
    counts.set(
      str(a.artifact_type),
      (counts.get(str(a.artifact_type)) ?? 0) + 1,
    );
  same(
    "registry_type_counts",
    Object.fromEntries([...counts].sort()),
    Object.fromEntries(Object.entries(FIXTURE_ARTIFACT_TYPE_COUNTS).sort()),
  );
  const used = new Map<string, string[]>();
  const use = (id: unknown, why: string, kinds: readonly string[]): void => {
    const target = must(artifacts.get(str(id)), `${why} -> ${str(id)}`);
    if (!kinds.includes(str(target.artifact_type)))
      fail("consumer_kind_mismatch", `${why} -> ${str(target.artifact_type)}`);
    (used.get(str(id)) ?? used.set(str(id), []).get(str(id)))?.push(why);
  };
  for (const [column, kinds] of Object.entries(CONSUMER_COLUMNS)) {
    const [table, name] = column.split(".") as [string, string];
    for (const row of rowsOf(tables, table))
      if (row[name] !== null && row[name] !== undefined)
        use(row[name], column, kinds);
  }
  for (const s of rowsOf(tables, "claim_supports")) {
    const ext = s.external_support_identity;
    if (typeof ext === "string") {
      if (!/^artifact:[0-9a-f-]{36}$/.test(ext))
        fail("consumer_external_identity_form", ext);
      use(
        ext.slice("artifact:".length),
        "claim_supports.external_support_identity",
        EXTERNAL_SUPPORT,
      );
    }
  }
  for (const a of artifacts.values()) {
    const inputs = payloadOf(a).ordered_input_artifacts;
    if (MANIFESTS.includes(str(a.artifact_type)) && Array.isArray(inputs))
      for (const i of inputs)
        use(
          obj(i, "input").artifact_id,
          `manifest-input:${str(a.artifact_type)}`,
          MANIFEST_INPUTS,
        );
  }
  // revalidation interface objects: governed consumers are the gate-result refs and the result payload's snapshot edge
  const snapshot = artifactOf(tables, "revalidation_snapshot");
  const result = artifactOf(tables, "revalidation_result");
  const refs = rowsOf(tables, "gate_results")
    .map((g) => obj(g.result, "gate result").fixture_revalidation_refs)
    .filter(isObj);
  for (const r of refs) {
    use(
      r.snapshot_artifact_id,
      "gate_results.fixture_revalidation_refs.snapshot",
      ["revalidation_snapshot"],
    );
    use(r.result_artifact_id, "gate_results.fixture_revalidation_refs.result", [
      "revalidation_result",
    ]);
  }
  const rp = payloadOf(result);
  use(rp.snapshot_artifact_id, "revalidation_result.snapshot_artifact_id", [
    "revalidation_snapshot",
  ]);
  if (
    rp.snapshot_artifact_id !== snapshot.artifact_id ||
    rp.snapshot_hash !== snapshot.content_hash
  )
    fail("revalidation_snapshot_edge");
  if (
    frozenReadyFingerprint !== undefined &&
    rp.ready_candidate_fingerprint !== frozenReadyFingerprint
  )
    fail("revalidation_candidate_binding");
  for (const id of artifacts.keys())
    if (!used.has(id))
      fail(
        "orphan_artifact",
        `${id} (${str(must(artifacts.get(id), "a").artifact_type)})`,
      );
  // the retained historical direction is consumed only as the superseded predecessor
  if (
    !(used.get(historicalArtifactId) ?? []).includes(
      "artifacts.supersedes_artifact_id",
    )
  )
    fail("historical_not_superseded");
}

// ------------------------------------------------------------------------------------------------------------------ uses
/**
 * The explicitly documented claim-use restrictions, and nothing more (Claims Policy v0.1.2):
 * - section 11 rule 1: `silent` claims may be linked with `relied_on_silent` ONLY;
 * - section 25 required rules: `hedged_only` cannot be `asserted`.
 * Claims 22 item 2 says the four skeleton modes are legal "for the claim's frozen effective usage class" without enumerating the
 * remaining pairs, so NO other prohibition is invented here: an assertable claim may use any of the four modes, and a
 * non-spoken `relied_on_silent` link on an assertable or hedged_only claim is not forbidden by any active text. This is not an
 * exhaustive production permission engine (hedge/attribution wording, rights and exposure are not row-checkable); unresolved
 * combinations are authority gap GA-5.
 */
const SKELETON_MODES = ["asserted", "hedged", "attributed", "relied_on_silent"];
export function claimUseModeViolation(
  effectiveUsageClass: string,
  mode: string,
): string | undefined {
  if (!SKELETON_MODES.includes(mode)) return "uses_claim_mode_unknown";
  if (effectiveUsageClass === "silent" && mode !== "relied_on_silent")
    return "uses_silent_claim_mode";
  if (effectiveUsageClass === "hedged_only" && mode === "asserted")
    return "uses_hedged_only_asserted";
  return undefined;
}

export function verifyUses(tables: Tables): void {
  const manifest = obj(
    payloadOf(artifactOf(tables, "evidence_package")).manifest,
    "manifest",
  );
  const frozen = new Map(
    list(manifest.claims, "claims").map((c) => [
      str(obj(c, "c").claim_id),
      obj(c, "c"),
    ]),
  );
  const packageEvidence = list(manifest.evidence, "manifest evidence").map(
    (e) => obj(e, "evidence entry"),
  );
  const units = indexBy(rowsOf(tables, "evidence_units"), "evidence_unit_id");
  const rights = indexBy(
    rowsOf(tables, "rights_versions"),
    "rights_version_id",
  );
  const turns = indexBy(rowsOf(tables, "turns"), "turn_id");
  const claimRows = rowsOf(tables, "turn_claim_uses");
  const evidenceRows = rowsOf(tables, "turn_evidence_uses");
  let claimSeen = 0;
  let evidenceSeen = 0;
  for (const sv of rowsOf(tables, "script_versions")) {
    const artifact = must(
      rowsOf(tables, "artifacts").find((a) => a.artifact_id === sv.artifact_id),
      "script artifact",
    );
    const payload = payloadOf(artifact);
    const payloadTurns = new Map(
      list(payload.turns, "turns").map((t) => [
        str(obj(t, "t").turn_id),
        obj(t, "t"),
      ]),
    );
    const mine = (r: Row): boolean =>
      turns.get(str(r.turn_id))?.script_version_id === sv.script_version_id;
    const check = (
      kind: "claim" | "evidence",
      rows: readonly Row[],
      items: unknown[],
      idCol: string,
      refCol: string,
    ): void => {
      const own = rows.filter(mine);
      if (own.length !== items.length)
        fail(`uses_${kind}_count`, str(sv.script_version_id));
      const byId = indexBy(own, idCol);
      for (const raw of items) {
        const item = obj(raw, "use item");
        const row = must(
          byId.get(str(item[idCol])),
          `${kind} use ${str(item[idCol])}`,
        );
        if (
          row.turn_id !== item.turn_id ||
          row[refCol] !== item[refCol] ||
          row.use_mode !== item.use_mode ||
          row.span_start !== item.span_start ||
          row.span_end !== item.span_end
        )
          fail(`uses_${kind}_row_payload`, str(item[idCol]));
        const turn = must(payloadTurns.get(str(row.turn_id)), "payload turn");
        if (turn.semantic_turn_id !== item.semantic_turn_id)
          fail(`uses_${kind}_anchor`, str(item[idCol]));
        const text = str(
          must(turns.get(str(row.turn_id)), "turn row").spoken_text,
        );
        const start = row.span_start as number;
        const end = row.span_end as number;
        if (
          !(
            Number.isInteger(start) &&
            Number.isInteger(end) &&
            start >= 0 &&
            end > start &&
            end <= codePointLength(text)
          )
        )
          fail(`uses_${kind}_span`, str(item[idCol]));
        if (kind === "claim") {
          const entry = must(frozen.get(str(row.claim_id)), "frozen claim");
          if (item.claim_state_hash !== entry.frozen_state_hash)
            fail("uses_claim_state_hash", str(item[idCol]));
          const violation = claimUseModeViolation(
            str(entry.effective_usage_class),
            str(row.use_mode),
          );
          if (violation) fail(violation, str(item[idCol]));
        } else {
          const unit = must(
            units.get(str(row.evidence_unit_id)),
            "evidence unit",
          );
          const policy = obj(
            must(rights.get(str(unit.rights_version_id)), "rights").policy,
            "policy",
          );
          if (item.rights_policy_version !== unit.rights_version_id)
            fail("uses_evidence_rights_version", str(item[idCol]));
          // the use must resolve exactly ONE frozen package entry, with the unit's rights version
          const matches = packageEvidence.filter(
            (e) => e.evidence_unit_id === row.evidence_unit_id,
          );
          if (matches.length === 0)
            fail("uses_evidence_not_in_package", str(item[idCol]));
          if (matches.length > 1)
            fail("uses_evidence_package_ambiguous", str(item[idCol]));
          const entry = must(matches[0], "package evidence entry");
          if (entry.rights_version_id !== unit.rights_version_id)
            fail("uses_evidence_package_rights_version", str(item[idCol]));
          // Claims 11 rule 2: silent claims must not have quoted/paraphrased evidence uses (direct reading: evidence that
          // supports a frozen-silent claim is never quoted or paraphrased)
          const supportsSilent = rowsOf(tables, "claim_supports").some(
            (support) =>
              support.evidence_unit_id === row.evidence_unit_id &&
              frozen.get(str(support.claim_id))?.effective_usage_class ===
                "silent",
          );
          if (supportsSilent)
            fail("uses_silent_support_evidence_used", str(item[idCol]));
          // quotation / paraphrase must be allowed by BOTH the frozen package entry AND the governing rights ceiling
          if (row.use_mode === "quoted") {
            if (entry.quote_permission !== true)
              fail("uses_quote_not_frozen", str(item[idCol]));
            if (policy.quotation_permission !== true)
              fail("uses_quote_not_permitted", str(item[idCol]));
          }
          if (row.use_mode === "paraphrased") {
            if (entry.paraphrase_permission !== true)
              fail("uses_paraphrase_not_frozen", str(item[idCol]));
            if (policy.paraphrase_permission !== true)
              fail("uses_paraphrase_not_permitted", str(item[idCol]));
          }
        }
      }
      if (kind === "claim") claimSeen += own.length;
      else evidenceSeen += own.length;
    };
    check(
      "claim",
      claimRows,
      list(payload.turn_claim_uses, "turn_claim_uses"),
      "turn_claim_use_id",
      "claim_id",
    );
    check(
      "evidence",
      evidenceRows,
      list(payload.turn_evidence_uses, "turn_evidence_uses"),
      "turn_evidence_use_id",
      "evidence_unit_id",
    );
  }
  if (claimSeen !== claimRows.length || evidenceSeen !== evidenceRows.length)
    fail("uses_rows_unbound");
}

// -------------------------------------------------------------------------------------------------------------- versions
export function verifyVersions(tables: Tables): void {
  const artifacts = indexBy(rowsOf(tables, "artifacts"), "artifact_id");
  const brief = artifactOf(tables, "showrunner_brief");
  const briefPayload = payloadOf(brief);
  const [bv, ...moreBriefs] = rowsOf(tables, "showrunner_brief_versions");
  if (!bv || moreBriefs.length > 0 || bv.artifact_id !== brief.artifact_id)
    fail("brief_version_row");
  const pkgRow = must(
    rowsOf(tables, "evidence_packages").find(
      (p) => p.evidence_package_id === bv.evidence_package_id,
    ),
    "brief package",
  );
  if (pkgRow.package_hash !== briefPayload.package_hash)
    fail("brief_version_package");
  // brief-owned program blocks
  const payloadBlocks = list(briefPayload.program_blocks, "brief blocks").map(
    (b) => obj(b, "block"),
  );
  const blockRows = rowsOf(tables, "program_blocks").filter(
    (b) => b.showrunner_brief_version_id === bv.showrunner_brief_version_id,
  );
  if (
    blockRows.length !== payloadBlocks.length ||
    blockRows.length !== rowsOf(tables, "program_blocks").length
  )
    fail("program_block_count");
  for (const pb of payloadBlocks) {
    const row = must(
      blockRows.find((r) => r.program_block_id === pb.program_block_id),
      `block ${str(pb.program_block_id)}`,
    );
    const rest = without(pb, ["block_type", "program_block_id", "sequence"]);
    const { block_type, sequence } = pb;
    if (row.block_type !== block_type || row.sequence !== sequence)
      fail("program_block_fields", str(pb.program_block_id));
    same(
      "program_block_payload",
      row.semantic_payload,
      rest,
      str(pb.program_block_id),
    );
  }
  // scripts: version rows, parent identity
  const versions = rowsOf(tables, "script_versions");
  for (const sv of versions) {
    const artifact = must(
      artifacts.get(str(sv.artifact_id)),
      "script artifact",
    );
    const p = payloadOf(artifact);
    if (
      p.script_version_id !== sv.script_version_id ||
      p.showrunner_brief_version_id !== sv.showrunner_brief_version_id ||
      sv.showrunner_brief_version_id !== bv.showrunner_brief_version_id ||
      p.attempt_id !== sv.attempt_id ||
      (p.revision_parent_id ?? null) !== sv.revision_parent_id ||
      (p.revision_parent_content_identity ?? null) !==
        sv.revision_parent_content_identity
    )
      fail("script_version_row_payload", str(sv.script_version_id));
    if (sv.revision_parent_id !== null) {
      const parent = must(
        versions.find((v) => v.script_version_id === sv.revision_parent_id),
        "parent version",
      );
      if (
        sv.revision_parent_content_identity !==
        must(artifacts.get(str(parent.artifact_id)), "parent artifact")
          .content_hash
      )
        fail("script_parent_identity", str(sv.script_version_id));
    }
  }
  // performance direction version, intents
  const dv = must(
    rowsOf(tables, "performance_direction_versions")[0],
    "direction version",
  );
  const dirArtifact = must(
    artifacts.get(str(dv.artifact_id)),
    "direction artifact",
  );
  const dp = payloadOf(dirArtifact);
  const sv = must(
    versions.find((v) => v.script_version_id === dv.script_version_id),
    "direction script",
  );
  if (
    rowsOf(tables, "performance_direction_versions").length !== 1 ||
    dirArtifact.artifact_type !== "performance_direction" ||
    dp.performance_direction_version_id !==
      dv.performance_direction_version_id ||
    dp.script_version_id !== dv.script_version_id ||
    dp.script_hash !==
      must(artifacts.get(str(sv.artifact_id)), "script").content_hash
  )
    fail("direction_version_row_payload");
  const intents = list(dp.performance_intents, "intents").map((i) =>
    obj(i, "intent"),
  );
  const intentRows = rowsOf(tables, "performance_intents");
  if (intents.length !== intentRows.length) fail("intent_count");
  for (const i of intents) {
    const row = must(
      intentRows.find(
        (r) => r.performance_intent_id === i.performance_intent_id,
      ),
      "intent row",
    );
    const rest = without(i, ["performance_intent_id"]);
    if (
      row.performance_direction_version_id !==
      dv.performance_direction_version_id
    )
      fail("intent_direction_binding", str(i.performance_intent_id));
    same("intent_row_payload", row.intent, rest, str(i.performance_intent_id));
    if (i.scope_type === "turn" && row.turn_id !== i.scope_ref)
      fail("intent_turn_binding", str(i.performance_intent_id));
  }
  // render manifest / audit rows
  const rm = must(rowsOf(tables, "render_manifests")[0], "render manifest row");
  const rp = payloadOf(
    must(artifacts.get(str(rm.artifact_id)), "render manifest artifact"),
  );
  if (
    rp.render_manifest_id !== rm.render_manifest_id ||
    rp.script_version_id !== rm.script_version_id ||
    rp.performance_direction_version_id !==
      rm.performance_direction_version_id ||
    rp.audit_run_id !== rm.audit_run_id
  )
    fail("render_manifest_row_payload");
}
