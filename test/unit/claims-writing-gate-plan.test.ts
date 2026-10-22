// Claims/Writing gate seam (unit, database-free): every predicate has a coherent local negative on `ComponentInputs`, every pinned literal
// is recomputed with the real helpers, and the writer and orchestrator run over ONE narrow scripted SQL router that simulates the
// `gate_results` table (no database, provider, network or live model). Nested witnesses are uncounted subcases of the 30 grouped cases;
// the last case asserts the counted doors (real builds, runs, API-level pack opens and scripted driver calls) literally.
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";

import type { Pool } from "pg";
import { describe, expect, it } from "vitest";

import { codePointLength } from "../../src/fixture/code-points.js";
import { openFixturePack } from "../../src/fixture/pack.js";
import { TEXTURE_SPECIMEN } from "../../src/fixture/speech-texture-specimen.js";
import { scriptHash } from "../../src/identity/artifacts.js";
import { canonicalJson, sha256 } from "../../src/identity/canonical-json.js";
import { fingerprint } from "../../src/identity/fingerprints.js";
import { derivationOutputHash } from "../../src/identity/knowledge.js";
import { frozenStateHash } from "../../src/knowledge/claim-state.js";
import { CommandConnectionError } from "../../src/runtime/command.js";
import {
  COVERAGE_IDS,
  GATE_DEFINITION_KEYS,
  GATE_NOT_PROVEN,
  GATE_PIN,
  GATE_SNAPSHOT_STATEMENT_COUNT,
  GATE_STATIC_STATEMENT_COUNT,
  GATE_STOP_CODES,
  GATE_SURFACES,
  GATE_GATES_NOT_RUN,
  VIOLATION_CODES,
  WARNING_CODES,
  aggregateOf,
  buildGateProjection,
  candidateOf,
  checkDerivationMetadata,
  checkPreconditions,
  classifyGateAcquisition,
  classifyGateRaw,
  classifyNumerals,
  deriveGateId,
  deriveGateOwners,
  evaluateGateComponent,
  evaluateWritingChecks,
  expectedComparisonStatement,
  gateDefinitionId,
  gateFingerprint,
  gateRawOf,
  gateSnapshotStatements,
  gateStopOf,
  initialGateContext,
  isAdmittedGatePlan,
  isClosedFinding,
  isClosedResult,
  isComponentEvaluation,
  isGateAcquisition,
  isOwnedGateEvaluation,
  numeralTokens,
  numberWords,
  ownedRowsOf,
  parseGateFacts,
  planClaimsWritingGate,
  produceGateEvaluation,
  projectGateCounts,
  quotedPhraseSpans,
  readGateSnapshot,
  recordClaimsWritingGate,
  recordedOf,
  rewriteShift,
  runClaimsWritingGate,
  scanGateSurfaces,
  silentValueForms,
  softWarnings,
  stageGateSnapshot,
  type ComponentEvaluation,
  type ComponentInputs,
  type GateAcquisition,
  type GateFacts,
  type GatePlan,
  type GatePlanInputs,
  type GateRawSnapshot,
  type OwnedEvaluation,
} from "../../src/runtime/claims-writing-gate.js";
import { PASS1_OWNED, criticOwned } from "../../src/runtime/craft-critic.js";
import { revisionOwned } from "../../src/runtime/craft-revision.js";
import {
  TEXTURE_REWRITE_TABLE,
  textureOwned,
  textureSnapshotStatements,
  type TextureState,
} from "../../src/runtime/speech-texture.js";
import {
  PASS1_PIN,
  RESERVATION_FIELDS,
  countTables,
  sameJson,
  stringLeaves,
  utcMicros,
  type PlannedRow,
} from "../../src/runtime/writer-pass1.js";

type Obj = Record<string, unknown>;
const T = 120000; // the real factory, the pack and several plans per case
const defined = <V>(value: V | undefined): V => {
  if (value === undefined) throw new Error("expected a defined value");
  return value;
};
const records = (value: unknown): Obj[] =>
  Array.isArray(value) ? (value as Obj[]) : [];
const strs = (value: unknown): string[] =>
  Array.isArray(value) ? (value as string[]) : [];

// ---- the pinned oracles, authored from the design records (never computed from the module under test) ---------------------------------------
const ATTEMPT = "e5aaee76-ec19-4917-b293-24a0435b3a92";
const CHILD_HASH =
  "776eefadaa96ae3ef0030e48d15184ac1aa49032695d6e84f03b2ce9f6084fe0";
const PARENT_HASH =
  "4a927ad9cd612aa0f2f57ed52273061abcfe8f1ba8d8f864ca2a25907c517b00";
const FINGERPRINT =
  "1be8aaa9d5ac8a5086542065d55275e018eefba78cc0a934c22171d32f76a5ba";
const FROZEN_CONTROL =
  "000b3e1ecad111bf2111e28a406601c790ea92ef1fceb1ec4419d7bb739ab9d7";
const STALE_CONTROLS = {
  parent_bound:
    "7e4a9e495ee27aedbbc7c9b376c014a558d7b0b713d55c6c5ca5de0d10dcc2d2",
  claims_policy:
    "900db1b0a9fb6b9aa5251b82c6d6d1e9573fea360245502e62b624e20f86a1a5",
  writing_policy:
    "3345214c62fac0335b2805dfe146859f7d0d9e41c4b09c13e5751969669f9cd6",
  gate_set: "de53cbb14f41a052f25771190a2c4e6cd8a7c32f36f59404a779c5b4e9e678f6",
};
const BRIEF_HASH =
  "36fb22d03300206d3181959a100f2911c2b27d9ff72379f21831d32a4bd5c475";
const PACKAGE_HASH =
  "a8655c0e8bd72094a823b367a0c21cd665d3d99c271341286a92dbdc2ea304ab";
const RESULT_IDS: readonly string[] = [
  "23e61246-eb48-45d1-b74d-85d105a71d85",
  "5925b4fe-b355-4dc5-bdb3-148f1b59997c",
  "679628bd-c726-41a6-8761-eb56ad4fb97a",
  "17131999-49bb-428c-b366-96aed2ba8035",
  "243ebc65-9250-4202-ad12-b482b2187a55",
  "11098677-1d2b-4030-834a-4629baeb9de0",
  "c2621bac-07db-4407-8b47-a4935c1372b7",
  "7374b8ae-f7ab-446e-adb1-59e900431ac9",
  "a4df5a40-9af6-4d1c-8b1f-ed41abadd674",
  "68f6ae95-7a08-4d86-b763-23c7a456376a",
  "3d007d27-b039-4c35-9760-e88700c703c6",
  "4ac1eaa5-c46d-4610-9b15-8551ba16e6b0",
  "bf4800ae-b302-433f-a48f-2f6aa50411cb",
  "dad655ea-5019-4db4-a597-fad134e43412",
  "c6f4bb19-6a2b-4079-821e-2ee5efa59f15",
  "ffc018b0-5ca1-485c-a26c-4d130fdaf4a2",
  "d222a3d3-219e-40d6-9662-a53ea1616fde",
  "6dbbc938-42e4-41db-ab7c-48eeda0867ba",
];
/** The derived expectation of the pinned chain (source-derived, not observed): the definitions that fail and their findings. */
const EXPECTED_FACTS: readonly Obj[] = [
  {
    examined: 15,
    expected_examined: 15,
    claim_uses: 12,
    evidence_uses: 3,
    package_claims: 9,
    package_evidence: 16,
  },
  {
    examined: 15,
    expected_examined: 15,
    asserted: 9,
    hedged: 1,
    attributed: 2,
    relied_on_silent: 0,
    quoted: 1,
    paraphrased: 2,
  },
  {
    examined: 3,
    expected_examined: 3,
    silent_claims: 1,
    silent_claim_uses: 0,
    silent_evidence_units: 2,
    silent_evidence_uses: 0,
    turns_scanned: 17,
    silent_value_matches: 0,
    withheld_run_matches: 0,
  },
  {
    examined: 18,
    expected_examined: 18,
    supported: 13,
    no_finding_context: 3,
    violations: 1,
    proof_gaps: 1,
  },
  {
    examined: 1,
    expected_examined: 1,
    quoted_uses: 1,
    metalinguistic_mentions: 1,
    quote_pairs_seen: 2,
  },
  {
    examined: 2,
    expected_examined: 2,
    paraphrased_uses: 2,
    overlap_matches: 0,
    guard_run_cp: 24,
  },
  {
    examined: 3,
    expected_examined: 3,
    prefix_matches: 3,
    quoted_speaker_fields_available: 0,
  },
  { examined: 8, expected_examined: 8, confirmed: 8 },
  { examined: 1, expected_examined: 1 },
  {
    examined: 1,
    expected_examined: 1,
    input_refs: 5,
    window_matches: 5,
    desk_derived_uses: 2,
    metadata_checks_passed: 1,
  },
  { examined: 2, expected_examined: 2, incident_claims: 0 },
  { examined: 15, expected_examined: 15, shifted_spans: 2 },
  {
    examined: 17,
    expected_examined: 17,
    roster_members: 3,
    profile_versions_bound: 3,
  },
  { examined: 17, expected_examined: 17, brief_blocks: 9 },
  {
    examined: 9,
    expected_examined: 9,
    template_required_slots: 9,
    optional_slots_omitted: 1,
    blocks_with_turns: 9,
  },
  {
    examined: 17,
    expected_examined: 17,
    character_classes_seen: 7,
    forbidden_matches: 0,
    respelling_matches: 0,
  },
  {
    examined: 17,
    expected_examined: 17,
    changed_turns: 8,
    rewrite_rows: 9,
    uses: 15,
    net_cp_delta: -5,
  },
  {
    examined: 1,
    expected_examined: 1,
    missing_refs: 0,
    forbidden_refs_serialized: 0,
    budget_within_limit: 1,
    serialized_hash_bound: 1,
    silent_claim_excluded: 1,
  },
];
const CREATED_AT = "2026-10-21T12:00:10Z";
const INV = {
  attempt_id: ATTEMPT,
  pass1: {
    started_at: "2026-10-21T11:59:58Z",
    ended_at: "2026-10-21T11:59:59Z",
    created_at: "2026-10-21T12:00:00Z",
  },
  critic: {
    started_at: "2026-10-21T12:00:01Z",
    ended_at: "2026-10-21T12:00:02Z",
    created_at: "2026-10-21T12:00:03Z",
  },
  revision: {
    started_at: "2026-10-21T12:00:04Z",
    ended_at: "2026-10-21T12:00:05Z",
    created_at: "2026-10-21T12:00:06Z",
  },
  started_at: "2026-10-21T12:00:07Z",
  ended_at: "2026-10-21T12:00:08Z",
  created_at: "2026-10-21T12:00:09Z",
};
const GATE_INV = { texture: INV, created_at: CREATED_AT };

// ---- the counted doors -----------------------------------------------------------------------------------------------------------------------------
const CALLS = { plan: 0, run: 0, builds: 0, queries: 0 };
const planG = (
  kind: "real" | "seamed" | "early",
  invocation: unknown,
  inputs?: GatePlanInputs,
): ReturnType<typeof planClaimsWritingGate> => {
  CALLS.plan += 1;
  if (kind === "real") CALLS.builds += 1;
  return planClaimsWritingGate(invocation, inputs);
};
const runG = (
  kind: "real" | "seamed",
  pool: Pool,
  invocation: unknown,
  inputs?: GatePlanInputs,
): ReturnType<typeof runClaimsWritingGate> => {
  CALLS.run += 1;
  if (kind === "real") CALLS.builds += 1;
  return runClaimsWritingGate(pool, invocation, inputs);
};

// ---- the shared fixtures: ONE real pack open, ONE real texture build (4 upstream opens) ----------------------------------------------------
const PACK = openFixturePack();
const PLANNED = planG("real", GATE_INV, { pack: PACK });
if (PLANNED.kind !== "planned") throw new Error("the pinned chain must plan");
const PLAN: GatePlan = PLANNED.plan;
const UP = PLAN.texture.revision.critic.upstream;
const TABLES = (
  PACK.json("foundation_rows_398.json") as { tables: Record<string, Obj[]> }
).tables;
const table = (name: string): Obj[] => defined(TABLES[name]);
const pick = (row: Obj, keys: readonly string[]): Obj => {
  const out: Obj = {};
  for (const key of keys) out[key] = row[key];
  return out;
};
const PACKAGE_PAYLOAD = PACK.json("evidence_package.json") as { manifest: Obj };
/** The nine factual results exactly as the snapshot statements return them, projected from the verified pack tables. */
const FACTS: GateFacts = {
  rights: table("rights_versions")
    .filter((row) =>
      [GATE_PIN.paraphrase_rights_id, GATE_PIN.quote_rights_id].includes(
        String(row.rights_version_id),
      ),
    )
    .map((row) => pick(row, ["rights_version_id", "policy"])),
  supports: table("claim_supports").map((row) =>
    pick(row, [
      "claim_support_id",
      "claim_id",
      "support_kind",
      "support_role",
      "evidence_unit_id",
      "derivation_run_id",
      "external_support_identity",
      "support_hash",
    ]),
  ),
  derivation: pick(defined(table("derivation_runs")[0]), [
    "derivation_run_id",
    "rule_version",
    "parameters",
    "output",
    "exact_input_refs",
    "output_hash",
  ]),
  carriers: table("artifacts")
    .filter((row) =>
      [GATE_PIN.signal_carrier_id, GATE_PIN.continuity_carrier_id].includes(
        String(row.artifact_id),
      ),
    )
    .map((row) =>
      pick(row, [
        "artifact_id",
        "artifact_type",
        "content_hash",
        "canonical_payload",
      ]),
    ),
  events: [],
  claims: table("claims").map((row) =>
    pick(row, [
      "claim_id",
      "content_hash",
      "claim_kind",
      "initial_status",
      "initial_usage_class",
    ]),
  ),
  pronunciations: table("pronunciations").map((row) =>
    pick(row, [
      "pronunciation_id",
      "canonical_text",
      "entity_identity",
      "canonical_version",
    ]),
  ),
  renderings: table("pronunciation_renderings").map((row) =>
    pick(row, [
      "pronunciation_rendering_id",
      "pronunciation_id",
      "provider",
      "rendering",
      "version",
      "voice_profile_version_id",
    ]),
  ),
  evidence: table("evidence_units").map((row) =>
    pick(row, [
      "evidence_unit_id",
      "content_hash",
      "usage_class",
      "rights_version_id",
    ]),
  ),
};
const plannedRows = (rows: readonly PlannedRow[], name: string): Obj[] =>
  rows
    .filter((item) => item.spec.table === name)
    .map((item) => ({ ...item.row }));
const INPUTS: ComponentInputs = {
  C: PLAN.texture.script_payload,
  K: PLAN.texture.revision.script_payload,
  rows: {
    version: defined(plannedRows(PLAN.texture.t3, "script_versions")[0]),
    turns: plannedRows(PLAN.texture.t3, "turns"),
    claim_uses: plannedRows(PLAN.texture.t3, "turn_claim_uses"),
    evidence_uses: plannedRows(PLAN.texture.t3, "turn_evidence_uses"),
  },
  pkg: PACKAGE_PAYLOAD.manifest,
  brief: UP.brief,
  writer: defined(UP.t1[0]).row.canonical_payload as Obj,
  context: defined(UP.t1[1]).row.canonical_payload as Obj,
  facts: FACTS,
  statics: PLAN.statics,
  originals: UP.originals,
  rewrites: TEXTURE_REWRITE_TABLE,
  parent_artifact_hash: PARENT_HASH,
};

// ---- the witness protocol ------------------------------------------------------------------------------------------------------------------------
/** A mutable deep copy of the component inputs (the only thing a witness ever edits). */
interface Work {
  C: Obj;
  K: Obj;
  rows: { version: Obj; turns: Obj[]; claim_uses: Obj[]; evidence_uses: Obj[] };
  pkg: Obj;
  brief: Obj;
  writer: Obj;
  context: Obj;
  facts: {
    rights: Obj[];
    supports: Obj[];
    derivation: Obj;
    carriers: Obj[];
    events: Obj[];
    claims: Obj[];
    pronunciations: Obj[];
    renderings: Obj[];
    evidence: Obj[];
  };
  statics: Obj;
  originals: string[];
  rewrites: Obj[];
  parent_artifact_hash: string;
}
const fresh = (): Work => structuredClone(INPUTS) as unknown as Work;
const evaluate = (work: Work): ComponentEvaluation =>
  evaluateGateComponent(work as unknown as ComponentInputs);
const DEF = GATE_DEFINITION_KEYS.map((key) => key.split(".")[1] ?? key);
interface Where {
  anchor?: string;
  span?: readonly [number, number];
  idx?: number;
  ref?: string;
  upstream?: string;
  field?: string;
}
const describe1 = (where: Where): string =>
  [
    where.anchor ?? "",
    where.span !== undefined
      ? `[${String(where.span[0])},${String(where.span[1])}]`
      : "",
    where.idx !== undefined ? `#${String(where.idx)}` : "",
    where.ref !== undefined ? `~${where.ref}` : "",
    where.upstream !== undefined ? `^${where.upstream}` : "",
    where.field !== undefined ? `/${where.field}` : "",
  ].join("");
/** `definition:code location` of one finding: the comparable form every witness asserts. */
const fx = (definition: number, code: string, where: Where = {}): string =>
  `${DEF[definition - 1] ?? "?"}:${code} ${describe1(where)}`.trimEnd();
const flat = (evaluation: ComponentEvaluation): string[] =>
  evaluation.rows.flatMap((row, index) =>
    row.findings.map((item) =>
      fx(index + 1, item.code, {
        ...(item.anchor !== undefined ? { anchor: item.anchor } : {}),
        ...(item.span !== undefined ? { span: item.span } : {}),
        ...(item.use_index !== undefined ? { idx: item.use_index } : {}),
        ...(item.ref !== undefined ? { ref: item.ref } : {}),
        ...(item.upstream_code !== undefined
          ? { upstream: item.upstream_code }
          : {}),
        ...(item.field !== undefined ? { field: item.field } : {}),
      }),
    ),
  );
/** B0: the derived baseline of the pinned chain at the component boundary. */
const BASE_FLAT: readonly string[] = [
  fx(4, "precise_duration_unsupported", { anchor: "t04", span: [136, 139] }),
  fx(4, "duration_context_unresolved", { anchor: "t08", span: [127, 130] }),
  fx(10, "required_proof_not_established", {
    ref: "derivation_count_reexecution",
  }),
];
interface Spec {
  readonly id: string;
  /** reads the intended value (proof that the mutation changed it) */
  readonly read: (work: Work) => unknown;
  /** applies one named coherent mutation and returns its undo */
  readonly edit: (work: Work) => () => void;
  /** exact findings that must appear (the named primary) */
  readonly primary: readonly string[];
  /** definition numbers (1-based) whose result may differ from the baseline; every other definition must equal it; null: not asserted */
  readonly families: readonly number[] | null;
  readonly absent?: readonly string[];
  readonly warnings?: readonly string[];
  /** extra assertions on the mutated working copy and its evaluation (before the undo) */
  readonly after?: (work: Work, evaluated: ComponentEvaluation) => void;
}
function witness(spec: Spec): ComponentEvaluation {
  const work = fresh();
  const base = evaluate(work);
  expect(flat(base), `${spec.id} baseline`).toEqual([...BASE_FLAT]);
  const before = structuredClone(spec.read(work));
  const undo = spec.edit(work);
  const after = spec.read(work);
  expect(after, `${spec.id} changed the intended value`).not.toEqual(before);
  const evaluated = evaluate(work);
  const found = flat(evaluated);
  for (const item of spec.primary)
    expect(found, `${spec.id} primary`).toContain(item);
  for (const item of spec.absent ?? [])
    expect(found, `${spec.id} absent`).not.toContain(item);
  if (spec.families !== null)
    evaluated.rows.forEach((row, index) => {
      if (!(spec.families ?? []).includes(index + 1))
        expect(
          row,
          `${spec.id} unchanged definition ${String(index + 1)}`,
        ).toEqual(base.rows[index]);
    });
  for (const item of spec.warnings ?? [])
    expect(
      evaluated.warnings.map(
        (warning) =>
          `${warning.code}${warning.anchor !== undefined ? ` ${warning.anchor}` : ""}`,
      ),
      `${spec.id} warning`,
    ).toContain(item);
  spec.after?.(work, evaluated);
  undo();
  expect(spec.read(work), `${spec.id} undo restores the value`).toEqual(before);
  expect(work, `${spec.id} undo restores the whole working copy`).toEqual(
    fresh(),
  );
  expect(evaluate(work), `${spec.id} re-evaluation after undo`).toEqual(base);
  return evaluated;
}
const turnOf = (work: Work, anchor: string): Obj =>
  defined(
    records(work.C.turns).find((turn) => turn.semantic_turn_id === anchor),
  );
const turnRow = (work: Work, anchor: string): Obj => {
  const id = turnOf(work, anchor).turn_id;
  return defined(work.rows.turns.find((row) => row.turn_id === id));
};
/** Replaces text inside one turn in the payload and the relational row (no use span may be pushed out of range; the caller keeps edits outside spans). */
const setText = (
  work: Work,
  anchor: string,
  change: (text: string) => string,
): (() => void) => {
  const turn = turnOf(work, anchor);
  const row = turnRow(work, anchor);
  const old = String(turn.spoken_text);
  const text = change(old);
  expect(text).not.toBe(old);
  turn.spoken_text = text;
  row.spoken_text = text;
  return () => {
    turn.spoken_text = old;
    row.spoken_text = old;
  };
};
const replaceOnce = (text: string, from: string, to: string): string => {
  expect(text.split(from).length, `exactly one "${from}"`).toBe(2);
  return text.replace(from, () => to);
};
const claimUse = (work: Work, index: number): Obj =>
  defined(records(work.C.turn_claim_uses)[index]);
const claimRow = (work: Work, use: Obj): Obj =>
  defined(
    work.rows.claim_uses.find(
      (row) => row.turn_claim_use_id === use.turn_claim_use_id,
    ),
  );
const evidenceUse = (work: Work, index: number): Obj =>
  defined(records(work.C.turn_evidence_uses)[index]);
const evidenceRow = (work: Work, use: Obj): Obj =>
  defined(
    work.rows.evidence_uses.find(
      (row) => row.turn_evidence_use_id === use.turn_evidence_use_id,
    ),
  );
/** Edits fields of a claim use in the payload and its relational row (columns the row has), returning the undo. */
const patchClaimUse = (work: Work, index: number, patch: Obj): (() => void) => {
  const use = claimUse(work, index);
  const row = claimRow(work, use);
  const oldUse: Obj = {};
  const oldRow: Obj = {};
  for (const [key, value] of Object.entries(patch)) {
    oldUse[key] = use[key];
    use[key] = value;
    if (key in row) {
      oldRow[key] = row[key];
      row[key] = value;
    }
  }
  return () => {
    Object.assign(use, oldUse);
    Object.assign(row, oldRow);
  };
};
const patchEvidenceUse = (
  work: Work,
  index: number,
  patch: Obj,
): (() => void) => {
  const use = evidenceUse(work, index);
  const row = evidenceRow(work, use);
  const oldUse: Obj = {};
  const oldRow: Obj = {};
  for (const [key, value] of Object.entries(patch)) {
    oldUse[key] = use[key];
    use[key] = value;
    if (key in row) {
      oldRow[key] = row[key];
      row[key] = value;
    }
  }
  return () => {
    Object.assign(use, oldUse);
    Object.assign(row, oldRow);
  };
};
const claimOf = (work: Work, suffix: string): Obj =>
  defined(
    records(work.pkg.claims).find((claim) =>
      String(claim.claim_id).endsWith(suffix),
    ),
  );
const flip = (hash: string): string =>
  `${hash.startsWith("0") ? "1" : "0"}${hash.slice(1)}`;
const setKey = (target: Obj, key: string, value: unknown): (() => void) => {
  const old = target[key];
  target[key] = value;
  return () => {
    target[key] = old;
  };
};
const chain =
  (...undos: (() => void)[]): (() => void) =>
  () => {
    for (const undo of [...undos].reverse()) undo();
  };
const GAZ_CLEAN = /^[A-Za-z ]{24}$/u;
const FORBIDDEN_WORDS =
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|could|may|might|suggests|reports|reportedly|apparently|pending|not|no|never|nothing|none|yet|said|says|told|tells|called|calls|wrote)\b/iu;
/** A 24-code-point run of a withheld original made of letters and spaces only, with no number word, hedge cue, negation or attribution verb. Never printed. */
const cleanRun = (): string => {
  for (const source of UP.originals) {
    const chars = Array.from(source);
    for (let i = 0; i + 24 <= chars.length; i += 1) {
      const run = chars.slice(i, i + 24).join("");
      if (GAZ_CLEAN.test(run) && !FORBIDDEN_WORDS.test(run)) return run;
    }
  }
  throw new Error("no clean run");
};
const UNKNOWN_ID = "00000000-0000-4000-8000-0000000000aa";
/** The two CP04 replacements: same-length, number-free fragments, each occurring exactly once in its intended parent and child turn. */
const CP04_REPLACEMENTS: readonly (readonly [string, string, string])[] = [
  ["t04", "ten minutes that still felt", "the stretch that still felt"],
  ["t08", "the last ten minutes feel", "the closing stretch feels"],
];
/** CP04: independent synthetic component fixture, parent and child reworded with same-length number-free fragments (never persistable). */
const syntheticPositive = (): Work => {
  const synthetic = fresh();
  for (const [anchor, from, to] of CP04_REPLACEMENTS) {
    for (const payload of [synthetic.C, synthetic.K]) {
      const turn = defined(
        records(payload.turns).find((item) => item.semantic_turn_id === anchor),
      );
      turn.spoken_text = replaceOnce(String(turn.spoken_text), from, to);
    }
    const row = turnRow(synthetic, anchor);
    row.spoken_text = replaceOnce(String(row.spoken_text), from, to);
  }
  return synthetic;
};
const PRESENT3 = {
  pass1: "present",
  critic: "present",
  revision: "present",
} as const;

// ---- the scripted database: one narrow SQL router that simulates `gate_results` and the texture snapshot (T0-T4) -----------------------------
const CP = PLAN.texture.revision.critic;
const RP = PLAN.texture.revision;
const TP = PLAN.texture;
const DRIVER = { calls: 0 };
const DRIVER_LOG: string[] = [];
interface StoredRow {
  gate_result_id: string;
  gate_definition_id: string;
  attempt_id: string;
  input_fingerprint: string;
  outcome: string;
  result: Obj;
  created_at: string;
}
const eqFlags = (planned: PlannedRow): Obj => {
  const out: Obj = { ...planned.row };
  for (const column of planned.spec.cols) out[`eq_${column.name}`] = true;
  return out;
};
const callRowFor = (reservation: object): Obj => {
  const source = reservation as Obj;
  const out: Obj = {};
  for (const field of RESERVATION_FIELDS) out[field] = source[field];
  return {
    ...out,
    started_at: utcMicros(String(source.started_at)),
    admitted_at: null,
    reserved_cost_upper_bound: null,
    admission_currency: null,
    admission_policy_hash: null,
    admission_certificate: null,
    admission_certificate_hash: null,
  };
};
const eventRowFor = (endedAt: string, reference: string): Obj => ({
  event_type: "succeeded",
  ended_at: utcMicros(endedAt),
  usage_eq: true,
  actual_cost_zero: true,
  currency: "USD",
  response_artifact_id: null,
  response_reference: reference,
  recorded_at: null,
  admission_settlement: null,
});
const HOST_ROW: Obj = {
  attempt_id: PASS1_PIN.host.attempt_id,
  program_run_id: PASS1_PIN.host.program_run_id,
  attempt_state: "PENDING",
  attempt_publication_enabled: false,
  show_config_version_id: PASS1_PIN.host.show_config_version_id,
  evidence_package_id: PASS1_PIN.host.evidence_package_id,
  parent_attempt_id: null,
  repair_plan_id: null,
  purpose: "evaluation",
  run_state: "PENDING",
  run_publication_enabled: false,
  run_show_config_version_id: PASS1_PIN.host.show_config_version_id,
};
const REVISION_CHILD: Obj = {
  script_version_id: RP.ids.script_version_id,
  revision_parent_id: UP.ids.script_version_id,
};
const TEXTURE_CHILD: Obj = {
  script_version_id: TP.ids.script_version_id,
  revision_parent_id: RP.ids.script_version_id,
};
class GateDb {
  readonly rows = new Map<string, StoredRow>();
  textureState: TextureState = 4;
  /** gate rows of the second fixture attempt plus any other host-unrelated rows (the count only) */
  otherRows = 31;
  readonly definitions = new Map(
    PLAN.definitions.map((pin) => [
      pin.gate_definition_id,
      {
        gate_name: pin.gate_name,
        version: pin.version,
        definition: structuredClone(pin.definition),
      },
    ]),
  );
  constructor(owned: readonly StoredRow[] = []) {
    for (const row of PLAN.historical)
      this.rows.set(row.gate_result_id, { ...row });
    for (const row of owned) this.rows.set(row.gate_result_id, { ...row });
  }
  expectedCount(name: string): number {
    const base =
      (UP.fixture_counts[name] ?? 0) +
      (PASS1_OWNED[name] ?? 0) +
      (criticOwned(4)[name] ?? 0) +
      (revisionOwned(4)[name] ?? 0) +
      (textureOwned(this.textureState)[name] ?? 0);
    return name === "gate_results"
      ? base - 31 + this.rows.size + (this.otherRows - 31)
      : base;
  }
}
const storedOf = (row: OwnedEvaluation["rows"][number]): StoredRow => ({
  gate_result_id: row.gate_result_id,
  gate_definition_id: row.gate_definition_id,
  attempt_id: row.attempt_id,
  input_fingerprint: row.input_fingerprint,
  outcome: row.outcome,
  result: structuredClone(row.result),
  created_at: row.created_at,
});
const textureResults = (db: GateDb): Obj[][] => {
  const state = db.textureState;
  const rows = (list: readonly PlannedRow[], on: boolean): Obj[][] =>
    list.map((item) => (on ? [eqFlags(item)] : []));
  const budget: Obj[] = [
    REVISION_CHILD,
    ...(state >= 4 ? [TEXTURE_CHILD] : []),
  ];
  const rights = defined(
    FACTS.rights.find(
      (row) => row.rights_version_id === GATE_PIN.paraphrase_rights_id,
    ),
  );
  return [
    [HOST_ROW],
    [
      {
        showrunner_brief_version_id: PASS1_PIN.host.showrunner_brief_version_id,
        artifact_id: PASS1_PIN.host.brief_artifact_id,
        attempt_id: PASS1_PIN.host.attempt_id,
        evidence_package_id: PASS1_PIN.host.evidence_package_id,
        revision_parent_id: null,
        payload: UP.brief,
      },
    ],
    [
      {
        evidence_package_id: PASS1_PIN.host.evidence_package_id,
        artifact_id: PASS1_PIN.host.package_artifact_id,
        package_hash: UP.script_payload.package_hash,
        payload: PACKAGE_PAYLOAD,
      },
    ],
    UP.claims.map((item) => ({ ...item })),
    UP.evidence.map((item) => ({ ...item })),
    [
      {
        rights_version_id: GATE_PIN.paraphrase_rights_id,
        policy: rights.policy,
      },
    ],
    ...rows([...UP.t1, ...UP.t3], true),
    [callRowFor(UP.reservation)],
    [eventRowFor(UP.invocation.ended_at, UP.response_reference)],
    ...rows([...CP.t1, ...CP.t3], true),
    [callRowFor(CP.reservation)],
    [eventRowFor(CP.invocation.ended_at, CP.response_reference)],
    ...rows([...RP.t1, ...RP.t3], true),
    [callRowFor(RP.reservation)],
    [eventRowFor(RP.invocation.ended_at, RP.response_reference)],
    budget,
    ...rows(TP.t1, state >= 1),
    ...rows(TP.t3, state >= 4),
    state >= 2 ? [callRowFor(TP.reservation)] : [],
    state >= 3
      ? [eventRowFor(TP.invocation.ended_at, TP.response_reference)]
      : [],
    budget,
    countTables(UP).map((name) => ({ t: name, n: db.expectedCount(name) })),
  ];
};
const definitionRows = (db: GateDb, values: readonly unknown[]): Obj[] => {
  const [ids, names, versions, definitions] = values as [
    string[],
    string[],
    string[],
    string[],
  ];
  return ids.map((id, index) => {
    const stored = db.definitions.get(id);
    return {
      gate_definition_id: id,
      present: stored !== undefined,
      eq_gate_name: stored?.gate_name === names[index],
      eq_version: stored?.version === versions[index],
      eq_definition: sameJson(
        stored?.definition,
        JSON.parse(definitions[index] ?? "null"),
      ),
    };
  });
};
const hostRowsOf = (view: ReadonlyMap<string, StoredRow>): Obj[] =>
  [...view.values()]
    .sort((a, b) => (a.gate_result_id < b.gate_result_id ? -1 : 1))
    .map((row) =>
      pick(row as unknown as Obj, [
        "gate_result_id",
        "gate_definition_id",
        "input_fingerprint",
      ]),
    );
const flagRows = (
  view: ReadonlyMap<string, StoredRow>,
  values: readonly unknown[],
): Obj[] => {
  const [ns, ids, defs, attempts, prints, outcomes, results, created] =
    values as [
      number[],
      string[],
      string[],
      string[],
      string[],
      string[],
      string[],
      string[],
    ];
  return ns.map((n, index) => {
    const stored = view.get(ids[index] ?? "");
    return {
      n,
      present: stored !== undefined,
      eq_gate_definition_id: stored?.gate_definition_id === defs[index],
      eq_attempt_id: stored?.attempt_id === attempts[index],
      eq_input_fingerprint: stored?.input_fingerprint === prints[index],
      eq_outcome: stored?.outcome === outcomes[index],
      eq_result: sameJson(stored?.result, JSON.parse(results[index] ?? "null")),
      eq_created_at:
        stored !== undefined &&
        utcMicros(stored.created_at) === utcMicros(created[index] ?? ""),
    };
  });
};
/** The 145 static results of one snapshot of the scripted database (statement order of `gateSnapshotStatements`). */
const staticResults = (
  db: GateDb,
  view: ReadonlyMap<string, StoredRow>,
): Obj[][] => {
  const statements = gateSnapshotStatements(PLAN);
  return [
    ...textureResults(db),
    definitionRows(db, defined(statements[134]).values),
    hostRowsOf(view),
    FACTS.rights.map((row) => ({ ...row })),
    FACTS.supports.map((row) => ({ ...row })),
    FACTS.derivation === undefined ? [] : [{ ...FACTS.derivation }],
    FACTS.carriers.map((row) => ({ ...row })),
    [],
    FACTS.claims.map((row) => ({ ...row })),
    FACTS.pronunciations.map((row) => ({ ...row })),
    FACTS.renderings.map((row) => ({ ...row })),
    FACTS.evidence.map((row) => ({ ...row })),
  ];
};
const EXPECTED_TEXT = expectedComparisonStatement([]).text;
interface Call {
  readonly ordinal: number;
  readonly text: string;
  readonly values: unknown[] | undefined;
}
const withCode = (message: string, code: string): Error =>
  Object.assign(new Error(message), { code });
class ScriptClient extends EventEmitter {
  readonly queries: string[] = [];
  readonly releases: unknown[] = [];
  releaseThrows: Error | undefined;
  poolListener = (): void => undefined;
  mode: "idle" | "snapshot" | "write" = "idle";
  results: Obj[][] = [];
  next = 0;
  view: ReadonlyMap<string, StoredRow> = new Map();
  readonly pending = new Map<string, StoredRow>();
  inserts = 0;
  constructor(private readonly pool: ScriptPool) {
    super();
  }
  merged(): Map<string, StoredRow> {
    return new Map([...this.pool.db.rows, ...this.pending]);
  }
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }> {
    this.queries.push(text);
    DRIVER.calls += 1;
    DRIVER_LOG.push(text);
    try {
      this.pool.hook?.({ ordinal: this.queries.length, text, values }, this);
      return Promise.resolve({ rows: this.serve(text, values) });
    } catch (error) {
      return Promise.reject(
        error instanceof Error ? error : new Error("scripted failure"),
      );
    }
  }
  private serve(text: string, values: unknown[] | undefined): unknown[] {
    const db = this.pool.db;
    if (text.startsWith("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")) {
      this.mode = "snapshot";
      this.view = new Map([...db.rows].map(([id, row]) => [id, { ...row }]));
      this.results = staticResults(db, this.view);
      this.next = 0;
      return [];
    }
    if (text.startsWith("BEGIN ISOLATION LEVEL READ COMMITTED")) {
      this.mode = "write";
      return [];
    }
    if (text === "COMMIT") {
      if (this.mode === "write")
        for (const [id, row] of this.pending) db.rows.set(id, row);
      this.pending.clear();
      return [];
    }
    if (text === "ROLLBACK") {
      this.pending.clear();
      return [];
    }
    if (this.mode === "snapshot") {
      if (text === EXPECTED_TEXT) return flagRows(this.view, values ?? []);
      return this.results[this.next++] ?? [];
    }
    if (this.mode === "write") {
      if (text.includes("current_setting('transaction_isolation')"))
        return [{ level: "read committed" }];
      if (text.includes("pg_advisory_xact_lock")) return [];
      if (text.startsWith("SELECT a.attempt_id::text AS attempt_id"))
        return [HOST_ROW];
      if (
        text.includes(
          "FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[])",
        )
      )
        return definitionRows(db, values ?? []);
      if (text.includes("FROM gate_results WHERE attempt_id"))
        return hostRowsOf(this.merged());
      if (text === EXPECTED_TEXT) return flagRows(this.merged(), values ?? []);
      if (text.includes("LEFT JOIN artifacts p ON"))
        return [
          {
            script_version_id: GATE_PIN.child_script_version_id,
            artifact_id: GATE_PIN.child_script_artifact_id,
            revision_parent_id: GATE_PIN.parent_script_version_id,
            revision_parent_content_identity: PARENT_HASH,
            child_hash: CHILD_HASH,
            parent_hash: PARENT_HASH,
          },
        ];
      if (/^(SAVEPOINT|RELEASE SAVEPOINT|ROLLBACK TO SAVEPOINT)\b/u.test(text))
        return [];
      if (text.startsWith("INSERT INTO gate_results")) {
        const [id, definition, attempt, print, outcome, result, createdAt] =
          (values ?? []) as string[];
        this.inserts += 1;
        this.pending.set(String(id), {
          gate_result_id: String(id),
          gate_definition_id: String(definition),
          attempt_id: String(attempt),
          input_fingerprint: String(print),
          outcome: String(outcome),
          result: JSON.parse(String(result)) as Obj,
          created_at: String(createdAt),
        });
        return [];
      }
    }
    this.pool.unexpected.push(text);
    throw new Error(`unscripted SQL: ${text.slice(0, 60)}`);
  }
  release(argument?: unknown): void {
    this.on("error", this.poolListener); // pg-pool re-attaches its own listener first
    this.releases.push(argument);
    if (this.releaseThrows) throw this.releaseThrows;
  }
}
class ScriptPool {
  readonly clients: ScriptClient[] = [];
  readonly unexpected: string[] = [];
  connects = 0;
  connectError: Error | undefined;
  /** fails the nth `connect()` (one-based) */
  failConnectAt: number | undefined;
  hook: ((call: Call, client: ScriptClient) => void) | undefined;
  constructor(readonly db: GateDb = new GateDb()) {}
  connect(): Promise<ScriptClient> {
    this.connects += 1;
    if (this.connectError !== undefined || this.failConnectAt === this.connects)
      return Promise.reject(this.connectError ?? new Error("connect failed"));
    const client = new ScriptClient(this);
    this.clients.push(client);
    return Promise.resolve(client);
  }
  total(): number {
    return this.clients.reduce((sum, client) => sum + client.queries.length, 0);
  }
  all(): string[] {
    return this.clients.flatMap((client) => client.queries);
  }
}
const asPool = (pool: ScriptPool): Pool => pool as unknown as Pool;
/** A pool that fails on any use (zero-query assertions). */
class ForbiddenPool {
  uses = 0;
  connect(): Promise<never> {
    this.uses += 1;
    return Promise.reject(new Error("the pool must not be used"));
  }
  query(): Promise<never> {
    this.uses += 1;
    return Promise.reject(new Error("the pool must not be used"));
  }
}
const forbidden = (): { pool: Pool; uses: () => number } => {
  const pool = new ForbiddenPool();
  return { pool: pool as unknown as Pool, uses: () => pool.uses };
};
/** The one legitimate owned evaluation of the file: a single scripted successful acquisition (148 driver calls, counted once). */
let OWNED_PROMISE: Promise<OwnedEvaluation> | undefined;
const ownedEvaluation = (): Promise<OwnedEvaluation> => {
  OWNED_PROMISE ??= (async () => {
    const pool = new ScriptPool();
    const read = await readGateSnapshot(asPool(pool), PLAN, "preflight");
    if (!read.ok) throw new Error("the scripted acquisition failed");
    expect(pool.total()).toBe(148);
    const produced = produceGateEvaluation(read.acquisition);
    if (produced.kind !== "evaluated")
      throw new Error("the scripted acquisition did not evaluate");
    return produced.evaluation;
  })();
  return OWNED_PROMISE;
};
/** A pure raw view of the scripted database (no driver call): static results, staged candidate, native flags simulated, raw snapshot. */
const rawOf = (
  db: GateDb,
  mutate?: (results: Obj[][]) => void,
): {
  raw: GateRawSnapshot;
  candidate: ReturnType<typeof candidateOf>;
  flags: Obj[];
} => {
  const view = new Map([...db.rows].map(([id, row]) => [id, { ...row }]));
  const results = staticResults(db, view);
  mutate?.(results);
  const staged = stageGateSnapshot(PLAN, results);
  const flags = flagRows(view, staged.statement.values);
  return { raw: gateRawOf(staged, flags), candidate: staged.candidate, flags };
};
const classify = (
  db: GateDb,
  mode: "preflight" | "final" = "preflight",
  mutate?: (results: Obj[][]) => void,
): ReturnType<typeof classifyGateRaw> => {
  const { raw, candidate } = rawOf(db, mutate);
  return classifyGateRaw(raw, PLAN, candidate, mode);
};
const stopRow = (
  result: ReturnType<typeof classifyGateRaw>,
): { code: string; detail: Obj } => {
  if (result.kind !== "stop") throw new Error("expected a stop");
  return { code: result.row.code, detail: { ...result.row.detail } };
};
/** The eighteen rows of the pinned chain exactly as the single database writer would store them. */
const OWNED_STORED: StoredRow[] = ownedRowsOf(
  PLAN,
  evaluateGateComponent(INPUTS).rows,
).map(storedOf);

// ---- independent oracles authored from the design records -----------------------------------------------------------------------------------
/** Independent copy of the id recipe (SHA-256 of namespace + LF + label, first 16 bytes, version nibble 4, variant 10). */
const idOf = (label: string): string => {
  const bytes = Buffer.from(
    sha256(
      Buffer.from(`the-desk.claims-writing-gate.id/1\n${label}`, "utf8"),
    ).slice(0, 32),
    "hex",
  );
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const MEMBER_SHA: Record<string, string> = {
  "config/participant_profiles.json":
    "86fc33c6c4d9bb6c1226f4774815341716a677d8a04bfacea997658087440b61",
  "config/rundown_template_post_event_launch_v2.json":
    "4c74bc6563680d907233921333a6528463ec5819a2375786ba77efbb15e3a9f6",
  "config/episode_modes.json":
    "b03b3889cdc1b1facf4be77d76e2212d3d166f7e406c589aae8a9e8bf1d06586",
  "config/block_types.json":
    "a6db53ee315437200bfadd76c988860512a9a36588e865dd8d78581c32dcfbb7",
  "foundation_rows_398.json":
    "a27f4381bd6449bfb656c6431b56115a932e05c82791696fc293c701c0a58a7e",
  "config/policy_versions.json":
    "5d02892aeb53f8236e437a3728e383beb5d0534c85760072ea5c3a32e36c6b18",
  "evidence_package.json":
    "bd9f5ff68156d6c03184c0e6d2f1acccc35bbb0c0223ab4ab611fb9378ba05f9",
};
/** The 18 numeral tokens of the child, authored from the derivation record (anchor, token, start, end, class, outcome). */
const NUMERAL_ORACLE: readonly (readonly [
  string,
  string,
  number,
  number,
  string,
  string,
])[] = [
  ["t04", "2-1", 16, 19, "scoreline", "supported"],
  ["t04", "43", 109, 111, "percent", "supported"],
  ["t04", "ten", 136, 139, "duration_past_event", "violation"],
  ["t05", "80th", 89, 93, "after_minute", "supported"],
  ["t05", "3", 104, 105, "count", "supported"],
  ["t05", "5", 120, 121, "sample_size", "supported"],
  ["t06", "5-4-1", 84, 89, "formation", "supported"],
  ["t07", "One", 0, 3, "source_credit_one", "supported"],
  ["t08", "ten", 127, 130, "duration_conditional_generic", "proof_gap"],
  ["t10", "four", 7, 11, "observation_count", "supported"],
  ["t11", "ten", 83, 86, "quoted_phrase_member", "no_finding"],
  ["t12", "One", 9, 12, "source_credit_one", "supported"],
  ["t12", "2019", 56, 60, "attested_since_year", "supported"],
  ["t13", "Three", 67, 72, "count", "supported"],
  ["t13", "five", 93, 97, "sample_size", "supported"],
  ["t14", "one", 99, 102, "deictic_one", "no_finding"],
  ["t15", "ten", 72, 75, "duration_prospective_prediction", "no_finding"],
  ["t17", "2-1", 25, 28, "scoreline", "supported"],
];
const classes = (work: Work, anchor: string, near?: string): string[] =>
  classifyNumerals(work as unknown as ComponentInputs)
    .filter(
      (item) =>
        item.anchor === anchor &&
        (near === undefined || near.includes(item.token)),
    )
    .map((item) => `${item.token}|${item.klass}|${item.code ?? item.outcome}`);

describe("claims/writing gate seam: plan, evaluators, scripted writer and orchestrator (unit)", () => {
  it(
    "GU01 pinned literals recomputed: owners, fingerprint and its five controls, 18 definition ids, 18 result ids, specimen and script hashes",
    () => {
      const policies = PACK.json("config/policy_versions.json") as Obj;
      const owners = deriveGateOwners(
        {
          manifest: PLAN.texture.manifest,
          script_payload: PLAN.texture.script_payload,
          brief: UP.brief,
          package: PACKAGE_PAYLOAD,
        },
        policies,
      );
      expect("mismatch" in owners).toBe(false);
      expect(owners).toEqual({
        package_hash: PACKAGE_HASH,
        brief_hash: BRIEF_HASH,
        script_hash: CHILD_HASH,
        claims_policy_version: "claims-0.1.2",
        writing_policy_version: "writing-0.2.3",
        gate_set_version: "build2-gates-v1",
      });
      const projection = buildGateProjection(
        owners as ReturnType<typeof buildGateProjection>,
      );
      expect(Object.keys(projection).sort()).toEqual([
        "brief_hash",
        "claims_policy_version",
        "gate_set_version",
        "package_hash",
        "script_hash",
        "writing_policy_version",
      ]);
      expect(Buffer.byteLength(canonicalJson(projection), "utf8")).toBe(361);
      expect(gateFingerprint(projection)).toBe(FINGERPRINT);
      expect(PLAN.fingerprint).toBe(FINGERPRINT);
      expect(GATE_PIN.fingerprint).toBe(FINGERPRINT);
      // the frozen historical projection reproduces the loaded `000b3e1e` fingerprint (control of the recipe itself)
      const frozen = (
        PACK.json("gate_fingerprint_inputs.json") as Record<
          string,
          { input_projection: unknown; fingerprint: string }
        >
      ).claims_writing;
      expect(
        fingerprint("claims_writing", defined(frozen).input_projection),
      ).toBe(FROZEN_CONTROL);
      expect(defined(frozen).fingerprint).toBe(FROZEN_CONTROL);
      // the four stale controls: each differs from the current fingerprint in exactly the stated source
      const variants: [string, Record<string, string>][] = [
        ["parent_bound", { script_hash: PARENT_HASH }],
        ["claims_policy", { claims_policy_version: "claims-0.1.1" }],
        ["writing_policy", { writing_policy_version: "writing-0.2.2" }],
        ["gate_set", { gate_set_version: "build2-gates-v2" }],
      ];
      for (const [name, patch] of variants)
        expect(gateFingerprint({ ...projection, ...patch }), name).toBe(
          STALE_CONTROLS[name as keyof typeof STALE_CONTROLS],
        );
      // 18 definition ids: the frozen pattern, the plan, and the loaded definition rows
      const loaded = new Map(
        table("gate_definitions").map((row) => [
          String(row.gate_definition_id),
          row,
        ]),
      );
      GATE_DEFINITION_KEYS.forEach((key, index) => {
        const id = `d1250019-0000-4000-8000-0000000000${String(index + 1).padStart(2, "0")}`;
        expect(gateDefinitionId(index + 1)).toBe(id);
        expect(defined(PLAN.definitions[index]).gate_definition_id).toBe(id);
        expect(defined(loaded.get(id)).gate_name).toBe(key);
        expect(defined(PLAN.definitions[index]).definition).toEqual(
          defined(loaded.get(id)).definition,
        );
      });
      // 18 planned result ids: literals, the plan, the exported derivation and an independent copy of the recipe
      expect(PLAN.result_ids).toEqual([...RESULT_IDS]);
      GATE_DEFINITION_KEYS.forEach((_, index) => {
        const label = `gate_result:${FINGERPRINT}:${gateDefinitionId(index + 1)}`;
        expect(deriveGateId(label)).toBe(RESULT_IDS[index]);
        expect(idOf(label)).toBe(RESULT_IDS[index]);
      });
      // specimen and script identities, and the 31 historical rows of the host attempt
      expect(PLAN.texture.specimen_canonical_sha256).toBe(
        "26473b55f9dfe00f17b75a16c82c4084fee5a98d61524d99a3e9c0f0b67b5359",
      );
      expect(PLAN.texture.script_hash).toBe(CHILD_HASH);
      expect(PLAN.texture.parent_script_hash).toBe(PARENT_HASH);
      expect(PLAN.texture.revision.script_hash).toBe(PARENT_HASH);
      expect(TEXTURE_SPECIMEN.parent_script_hash).toBe(PARENT_HASH);
      expect(PLAN.texture.invocation.attempt_id).toBe(ATTEMPT);
      expect(PLAN.historical).toHaveLength(31);
      expect(
        PLAN.historical.filter((row) =>
          row.input_fingerprint.startsWith("000b3e1e"),
        ),
      ).toHaveLength(18);
      expect(PLAN.created_at).toBe(CREATED_AT);
      expect(isAdmittedGatePlan(PLAN)).toBe(true);
      expect(Object.isFrozen(PLAN)).toBe(true);
      // the seven static members are re-hashed against independent literals
      for (const [name, sha] of Object.entries(MEMBER_SHA))
        expect(sha256(PACK.member(name)), name).toBe(sha);
      expect(Object.values(GATE_PIN.member_sha256).sort()).toEqual(
        Object.values(MEMBER_SHA).sort(),
      );
    },
    T,
  );

  it(
    "GU02 planner admission: invalid invocations, foreign and conflicting plan inputs, seam equality, texture stops, owner derivation",
    () => {
      // 3 invalid invocations (early refusals: no native open)
      for (const bad of [
        "not an object",
        { texture: INV },
        { texture: INV, created_at: "2026-10-21T12:00:08Z" },
      ]) {
        const result = planG("early", bad, {
          texturePlan: PLAN.texture,
          pack: PACK,
        });
        expect(result).toEqual(
          gateStopOf(initialGateContext(), "input", "gate_invocation_invalid"),
        );
      }
      // a foreign plan is a programmer error (sync TypeError, zero I/O); plan and inputs together are refused
      expect(() =>
        planG("early", GATE_INV, { texturePlan: {} as never, pack: PACK }),
      ).toThrow(new TypeError("an admitted texture plan is required"));
      expect(() =>
        planG("early", GATE_INV, {
          texturePlan: PLAN.texture,
          textureInputs: {},
          pack: PACK,
        }),
      ).toThrow(TypeError);
      // seam equality: reusing the admitted texture plan yields an equal gate plan; a different texture invocation is an identity mismatch
      const seamed = planG("seamed", GATE_INV, {
        texturePlan: PLAN.texture,
        pack: PACK,
      });
      if (seamed.kind !== "planned") throw new Error("the seam must plan");
      expect(seamed.plan).toEqual(PLAN);
      expect(seamed.plan).not.toBe(PLAN);
      const other = planG(
        "seamed",
        {
          texture: { ...INV, created_at: "2026-10-21T12:00:09.5Z" },
          created_at: CREATED_AT,
        },
        { texturePlan: PLAN.texture, pack: PACK },
      );
      expect(other).toEqual(
        gateStopOf(
          initialGateContext(),
          "input",
          "gate_input_identity_mismatch",
        ),
      );
      // a fake pack member is refused at the static re-hash
      const fakePack = {
        ...PACK,
        member: (name: string): Buffer =>
          name === "config/block_types.json"
            ? Buffer.from("{}")
            : PACK.member(name),
      };
      expect(
        planG("seamed", GATE_INV, {
          texturePlan: PLAN.texture,
          pack: fakePack,
        }),
      ).toEqual(
        gateStopOf(initialGateContext(), "input", "gate_static_input_mismatch"),
      );
      // M40b: the same duplicate-anchor specimen through the unchanged texture planner (a real build) stops with the texture's first refusal
      const duplicate = structuredClone(TEXTURE_SPECIMEN) as unknown as {
        turns: Obj[];
      };
      defined(duplicate.turns[2]).semantic_turn_id = "t02";
      expect(
        planG("real", GATE_INV, {
          textureInputs: { specimen: duplicate },
          pack: PACK,
        }),
      ).toEqual(
        gateStopOf(initialGateContext(), "input", "gate_texture_plan_stopped", {
          upstream_code: "texture_protected_content_changed",
          field: "turn_structure",
        }),
      );
      // CP04: the labelled synthetic child (a different script hash) can never be planned (a real build)
      const synthetic = structuredClone(TEXTURE_SPECIMEN) as unknown as {
        turns: Obj[];
      };
      defined(synthetic.turns[3]).spoken_text = String(
        defined(synthetic.turns[3]).spoken_text,
      ).replace("ten minutes that still felt", "the stretch that still felt");
      const refused = planG("real", GATE_INV, {
        textureInputs: { specimen: synthetic },
        pack: PACK,
      });
      expect(refused.kind).toBe("stopped");
      expect(refused.kind === "stopped" ? refused.code : "").toBe(
        "gate_texture_plan_stopped",
      );
      // M48: deriveGateOwners names the first disagreeing source (five supplied sources) and a stale gate-set projection is a stale fingerprint
      const policies = PACK.json("config/policy_versions.json") as Obj;
      const parts = (): {
        manifest: Obj;
        script_payload: Obj;
        brief: Obj;
        package: Obj;
      } =>
        structuredClone({
          manifest: PLAN.texture.manifest,
          script_payload: PLAN.texture.script_payload,
          brief: UP.brief,
          package: PACKAGE_PAYLOAD,
        });
      const subcases: [
        string,
        (p: ReturnType<typeof parts>) => void,
        string,
      ][] = [
        [
          "script",
          (p) => (p.script_payload.script_hash = PARENT_HASH),
          "script",
        ],
        [
          "claims_policy",
          (p) =>
            ((p.manifest.component_versions as Obj).claims_policy =
              "claims-0.1.1"),
          "claims_policy",
        ],
        [
          "writing_policy",
          (p) =>
            ((p.manifest.component_versions as Obj).writing_policy =
              "writing-0.2.2"),
          "writing_policy",
        ],
        [
          "package",
          (p) => (p.script_payload.package_hash = flip(PACKAGE_HASH)),
          "package",
        ],
        [
          "brief",
          (p) => (p.script_payload.brief_hash = flip(BRIEF_HASH)),
          "brief",
        ],
      ];
      for (const [name, edit, expected] of subcases) {
        const copy = parts();
        edit(copy);
        expect(deriveGateOwners(copy, policies), name).toEqual({
          mismatch: expected,
        });
      }
      expect(
        gateFingerprint({
          package_hash: PACKAGE_HASH,
          brief_hash: BRIEF_HASH,
          script_hash: CHILD_HASH,
          claims_policy_version: "claims-0.1.2",
          writing_policy_version: "writing-0.2.3",
          gate_set_version: "build2-gates-v2",
        }),
      ).toBe(STALE_CONTROLS.gate_set);
    },
    T,
  );

  it(
    "GU03 six-field projection: exact keys, no seventh key, every source changes the fingerprint, owner equality sources",
    () => {
      const owners = {
        package_hash: PACKAGE_HASH,
        brief_hash: BRIEF_HASH,
        script_hash: CHILD_HASH,
        claims_policy_version: "claims-0.1.2",
        writing_policy_version: "writing-0.2.3",
        gate_set_version: "build2-gates-v1",
      };
      expect(buildGateProjection(owners)).toEqual(owners);
      expect(() =>
        buildGateProjection({ ...owners, extra: "x" } as never),
      ).toThrow(TypeError);
      expect(() =>
        buildGateProjection({ ...owners, package_hash: 7 } as never),
      ).toThrow(TypeError);
      const { gate_set_version: dropped, ...missing } = owners;
      expect(dropped).toBe("build2-gates-v1");
      expect(() => buildGateProjection(missing as never)).toThrow(TypeError);
      const seen = new Set<string>([FINGERPRINT]);
      for (const [key, value] of Object.entries(owners)) {
        const changed = key.endsWith("_hash") ? flip(value) : `${value}x`;
        seen.add(gateFingerprint({ ...owners, [key]: changed }));
      }
      expect(seen.size).toBe(7); // the current fingerprint and six distinct single-source variants
      // owner sources agree: the prompt manifest, the policy-version map, the stored payload and the imported gate-set constant
      const versions = PLAN.texture.manifest.component_versions as Obj;
      const policies = (
        PACK.json("config/policy_versions.json") as {
          policies: Record<string, { version_id: string }>;
        }
      ).policies;
      expect(versions.claims_policy).toBe(
        defined(policies.claims_policy).version_id,
      );
      expect(versions.writing_policy).toBe(
        defined(policies.writing_policy).version_id,
      );
      expect(PLAN.texture.script_payload.writing_policy_version).toBe(
        "writing-0.2.3",
      );
      expect(GATE_PIN.gate_set_version).toBe("build2-gates-v1");
      expect(PLAN.owners).toEqual(owners);
      expect(PLAN.texture.script_payload.package_hash).toBe(PACKAGE_HASH);
      expect(PLAN.texture.script_payload.brief_hash).toBe(BRIEF_HASH);
    },
    T,
  );

  it(
    "GU04 typed numeral normalizer against an independent oracle: 18 tokens ⇒ 13 supported / 3 no-finding / 1 violation / 1 proof gap, role and form controls",
    () => {
      const classified = classifyNumerals(INPUTS);
      expect(
        classified.map((item) => [
          item.anchor,
          item.token,
          item.start,
          item.end,
          item.klass,
          item.outcome,
        ]),
      ).toEqual(NUMERAL_ORACLE.map((item) => [...item]));
      const counts = (outcome: string): number =>
        classified.filter((item) => item.outcome === outcome).length;
      expect([
        counts("supported"),
        counts("no_finding"),
        counts("violation"),
        counts("proof_gap"),
      ]).toEqual([13, 3, 1, 1]);
      expect(
        classified
          .filter((item) => item.code !== undefined)
          .map((item) => item.code),
      ).toEqual([
        "precise_duration_unsupported",
        "duration_context_unresolved",
      ]);
      // the closed grammar: decimal, hyphen compound, ordinal, cardinal word (case-insensitive, word-bounded)
      expect(
        numeralTokens("43.5 and 2-1-0 and 80th and Ten and none one").map(
          (item) => item.text,
        ),
      ).toEqual(["43.5", "2-1-0", "80th", "Ten", "one"]);
      // nine role-order and form controls, each a single edit of a pinned turn
      const control = (
        anchor: string,
        from: string,
        to: string,
        near: string,
      ): string[] => {
        const work = fresh();
        setText(work, anchor, (text) => replaceOnce(text, from, to));
        return classes(work, anchor, near);
      };
      expect(control("t04", "won 2-1.", "won 1-2.", "1-2")).toEqual([
        "1-2|scoreline|numeral_role_order_mismatch",
      ]);
      expect(control("t06", "5-4-1", "1-4-5", "1-4-5")).toEqual([
        "1-4-5|formation|numeral_role_order_mismatch",
      ]);
      expect(
        control(
          "t13",
          "Three late concessions in five",
          "Five late concessions in three",
          "Five three",
        ),
      ).toEqual([
        "Five|count|numeral_role_order_mismatch",
        "three|sample_size|numeral_role_order_mismatch",
      ]);
      expect(
        control("t05", "3 of their last 5", "5 of their last 3", "5 3"),
      ).toEqual([
        "5|count|numeral_role_order_mismatch",
        "3|sample_size|numeral_role_order_mismatch",
      ]);
      expect(control("t04", "43 percent", "34 percent", "34")).toEqual([
        "34|percent|numeral_role_order_mismatch",
      ]);
      expect(control("t12", "2019", "2020", "2020")).toEqual([
        "2020|attested_since_year|numeral_role_order_mismatch",
      ]);
      expect(control("t10", "four", "five", "five")).toEqual([
        "five|observation_count|numeral_role_order_mismatch",
      ]);
      expect(control("t04", "won 2-1.", "won 2-1-0.", "2-1-0")).toEqual([
        "2-1-0|unclassified_numeral|numeral_form_unclassified",
      ]);
      expect(control("t04", "43 percent", "43.5 percent", "43.5")).toEqual([
        "43.5|unclassified_numeral|numeral_form_unclassified",
      ]);
      // exact frames and plain forms: a decimal or compound count and a nonmatching frame fail closed (no prefix truncation, no token-count inference)
      const widened = (
        anchor: string,
        from: string,
        to: string,
        near: string,
      ): string[] => {
        const work = fresh();
        const baseline = structuredClone(work);
        const baselineClasses = classes(work, anchor, near);
        const textBefore = String(turnOf(work, anchor).spoken_text);
        const use = claimUse(work, 2); // the t05 count window [49,136]
        expect(use.semantic_turn_id).toBe("t05");
        const spanBefore = Number(use.span_end);
        const undoText = setText(work, anchor, (text) =>
          replaceOnce(text, from, to),
        );
        const delta = codePointLength(to) - codePointLength(from); // signed: the nonmatching-frame edit shortens the text
        const undoSpan = patchClaimUse(work, 2, {
          span_end: spanBefore + delta,
        });
        // the changed text and the intended signed span relation, in the payload and in its relational row
        expect(String(turnOf(work, anchor).spoken_text)).not.toBe(textBefore);
        expect(
          codePointLength(String(turnOf(work, anchor).spoken_text)) -
            codePointLength(textBefore),
        ).toBe(delta);
        expect(Number(use.span_end)).toBe(spanBefore + delta);
        expect(Number(claimRow(work, use).span_end)).toBe(spanBefore + delta);
        const mutated = classes(work, anchor, near);
        undoSpan();
        undoText();
        expect(work, "undo restores the whole working copy").toEqual(baseline);
        expect(
          classes(work, anchor, near),
          "undo restores the classification",
        ).toEqual(baselineClasses);
        return mutated;
      };
      expect(
        widened("t05", "3 of their last 5", "3.5 of their last 5", "3.5 5"),
      ).toEqual([
        "3.5|unclassified_numeral|numeral_form_unclassified",
        "5|unclassified_numeral|numeral_form_unclassified",
      ]);
      expect(
        widened("t05", "3 of their last 5", "3-4 of their last 5", "3-4 5"),
      ).toEqual([
        "3-4|unclassified_numeral|numeral_form_unclassified",
        "5|unclassified_numeral|numeral_form_unclassified",
      ]);
      expect(
        widened("t05", "league matches", "league games", "80th 3 5"),
      ).toEqual([
        "80th|unclassified_numeral|numeral_form_unclassified",
        "3|unclassified_numeral|numeral_form_unclassified",
        "5|unclassified_numeral|numeral_form_unclassified",
      ]);
      // the source credit needs a sentence start: a same-length comma prefix keeps the use span but loses the context; t07 and t12 are unchanged at their real starts
      expect(control("t12", "Exactly. One", "Exactly, One", "One")).toEqual([
        "One|unclassified_numeral|numeral_form_unclassified",
      ]);
      // a plain-integer duration reaches the same proofs as the cardinal word: coherent text and prediction ⇒ prospective; text alone ⇒ unclassified
      const ten = (text: string): string => {
        expect(text.match(/\bten\b/gu), "exactly one `ten`").toHaveLength(1);
        return text.replace(/\bten\b/u, "10");
      };
      const digitDuration = (alsoPrediction: boolean): string[] => {
        const work = fresh();
        setText(work, "t15", ten);
        if (alsoPrediction) {
          const candidate = defined(
            records(work.C.prediction_candidates).find((item) =>
              /\bten\b/u.exec(String(item.prediction_text)),
            ),
          );
          candidate.prediction_text = ten(String(candidate.prediction_text));
        }
        return classes(work, "t15", "10");
      };
      expect(digitDuration(true)).toEqual([
        "10|duration_prospective_prediction|no_finding",
      ]);
      expect(digitDuration(false)).toEqual([
        "10|duration_unclassified|duration_context_unclassified",
      ]);
      expect(numberWords(58)).toBe("fifty-eight");
      expect(silentValueForms(claimOf(fresh(), "08"))).toEqual([
        "0.58",
        "58",
        "fifty-eight",
        "fifty eight",
      ]);
    },
    T,
  );

  // ---- checks 1-2 ----------------------------------------------------------------------------------------------------------------------------------
  it(
    "GU05 checks 1-2 presence and use permission: M1 unknown claim, M2 state-hash flip, M3 hedge control, M4 unknown evidence mode",
    () => {
      witness({
        id: "M1",
        read: (w) => claimUse(w, 11).claim_id,
        edit: (w) => setKey(claimUse(w, 11), "claim_id", UNKNOWN_ID),
        primary: [
          fx(1, "claim_unresolved", { anchor: "t17", idx: 11 }),
          fx(1, "use_row_payload_mismatch", { anchor: "t17", idx: 11 }),
          fx(4, "numeral_support_not_authorized", {
            anchor: "t17",
            span: [25, 28],
          }),
          fx(12, "use_tuple_changed", { anchor: "t17", idx: 11 }),
        ],
        families: [1, 4, 8, 12, 17],
      });
      witness({
        id: "M2",
        read: (w) => claimUse(w, 4).claim_state_hash,
        edit: (w) =>
          setKey(
            claimUse(w, 4),
            "claim_state_hash",
            flip(String(claimUse(w, 4).claim_state_hash)),
          ),
        primary: [
          fx(1, "claim_state_hash_mismatch", { anchor: "t07", idx: 4 }),
          fx(8, "frozen_state_hash_recomputed_mismatch", {
            anchor: "t07",
            idx: 4,
          }),
          fx(12, "use_tuple_changed", { anchor: "t07", idx: 4 }),
        ],
        families: [1, 8, 12, 17],
      });
      witness({
        id: "M3",
        read: (w) => [
          claimUse(w, 4).use_mode,
          claimRow(w, claimUse(w, 4)).use_mode,
        ],
        edit: (w) => patchClaimUse(w, 4, { use_mode: "asserted" }),
        primary: [
          fx(2, "mode_illegal_for_class", { anchor: "t07", idx: 4 }),
          fx(7, "attribution_mode_illegal", { anchor: "t07", idx: 4 }),
          fx(12, "use_tuple_changed", { anchor: "t07", idx: 4 }),
        ],
        families: [2, 7, 12, 17],
      });
      witness({
        id: "M4",
        read: (w) => [
          evidenceUse(w, 0).use_mode,
          evidenceRow(w, evidenceUse(w, 0)).use_mode,
        ],
        edit: (w) => patchEvidenceUse(w, 0, { use_mode: "summarized" }),
        primary: [
          fx(2, "evidence_mode_unknown", { anchor: "t06", idx: 12 }),
          fx(6, "denominator_mismatch"),
          fx(12, "use_tuple_changed", { anchor: "t06", idx: 12 }),
        ],
        families: [2, 6, 12, 17],
      });
      // exact relational correspondence, per kind and independently in presence and the diff lock: an extra row with no payload mate carries
      // no location; a same-count field difference is located at its use
      witness({
        id: "M1b",
        read: (w) => w.rows.claim_uses.length,
        edit: (w) => {
          w.rows.claim_uses.push({
            ...defined(w.rows.claim_uses[0]),
            turn_claim_use_id: "ffffffff-ffff-4fff-8fff-ffffffffff02",
          });
          return () => {
            w.rows.claim_uses.pop();
          };
        },
        primary: [
          fx(1, "use_row_payload_mismatch"),
          fx(17, "row_payload_mismatch"),
        ],
        families: [1, 17],
      });
      witness({
        id: "M1c",
        read: (w) => claimRow(w, claimUse(w, 5)).span_end,
        edit: (w) => {
          const row = claimRow(w, claimUse(w, 5));
          return setKey(row, "span_end", Number(row.span_end) + 1);
        },
        primary: [
          fx(1, "use_row_payload_mismatch", { anchor: "t10", idx: 5 }),
          fx(17, "row_payload_mismatch"),
        ],
        families: [1, 17],
      });
      witness({
        id: "M1d",
        read: (w) => evidenceRow(w, evidenceUse(w, 0)).span_end,
        edit: (w) => {
          const row = evidenceRow(w, evidenceUse(w, 0));
          return setKey(row, "span_end", Number(row.span_end) + 1);
        },
        primary: [
          fx(1, "use_row_payload_mismatch", { anchor: "t06", idx: 12 }),
          fx(17, "row_payload_mismatch"),
        ],
        families: [1, 17],
      });
    },
    T,
  );

  // ---- check 3 ---------------------------------------------------------------------------------------------------------------------------------------
  it(
    "GU06 check 3 silent non-leak: M5 reproduced value form, M6 reliance on the silent claim",
    () => {
      witness({
        id: "M5",
        read: (w) => turnOf(w, "t05").spoken_text,
        edit: (w) => setText(w, "t05", (text) => `${text} 0.58`),
        primary: [
          fx(3, "silent_value_reproduced", { anchor: "t05", span: [182, 186] }),
          fx(4, "numeral_form_unclassified", {
            anchor: "t05",
            span: [182, 186],
          }),
          fx(4, "denominator_mismatch"),
        ],
        families: [3, 4, 17],
      });
      witness({
        id: "M6",
        read: (w) => [
          records(w.C.turn_claim_uses).length,
          w.rows.claim_uses.length,
        ],
        edit: (w) => {
          const silent = claimOf(w, "08");
          const t03 = turnOf(w, "t03");
          const use: Obj = {
            turn_claim_use_id: "ffffffff-ffff-4fff-8fff-ffffffffff01",
            turn_id: t03.turn_id,
            semantic_turn_id: "t03",
            claim_id: silent.claim_id,
            use_mode: "relied_on_silent",
            span_start: 0,
            span_end: 5,
            claim_state_hash: silent.frozen_state_hash,
          };
          const row: Obj = pick(use, [
            "turn_claim_use_id",
            "turn_id",
            "claim_id",
            "use_mode",
            "span_start",
            "span_end",
          ]);
          records(w.C.turn_claim_uses).push(use);
          w.rows.claim_uses.push(row);
          return () => {
            records(w.C.turn_claim_uses).pop();
            w.rows.claim_uses.pop();
          };
        },
        primary: [
          fx(3, "silent_claim_used", { anchor: "t03", idx: 12 }),
          fx(1, "denominator_mismatch"),
          fx(2, "denominator_mismatch"),
          fx(8, "denominator_mismatch"),
          fx(12, "denominator_mismatch"),
        ],
        families: [1, 2, 3, 8, 12, 17],
      });
    },
    T,
  );

  // ---- check 4 ---------------------------------------------------------------------------------------------------------------------------------------
  it(
    "GU07 check 4 value support: M7-M14 role/order, form, authorised relation, existential credit and deictic boundaries; CP04 component positive",
    () => {
      const mismatch = "numeral_role_order_mismatch";
      witness({
        id: "M7",
        read: (w) => turnOf(w, "t04").spoken_text,
        edit: (w) =>
          setText(w, "t04", (text) =>
            replaceOnce(text, "won 2-1.", "won 1-2."),
          ),
        primary: [
          fx(4, mismatch, { anchor: "t04", span: [16, 19] }),
          fx(12, "span_text_changed", { anchor: "t04", idx: 0 }),
        ],
        families: [4, 12, 17],
      });
      witness({
        id: "M8",
        read: (w) => turnOf(w, "t06").spoken_text,
        edit: (w) =>
          setText(w, "t06", (text) => replaceOnce(text, "5-4-1", "1-4-5")),
        primary: [
          fx(4, mismatch, { anchor: "t06", span: [84, 89] }),
          fx(12, "span_text_changed", { anchor: "t06", idx: 3 }),
          fx(12, "span_text_changed", { anchor: "t06", idx: 12 }),
        ],
        families: [4, 12, 17],
      });
      witness({
        id: "M9",
        read: (w) => turnOf(w, "t13").spoken_text,
        edit: (w) =>
          setText(w, "t13", (text) =>
            replaceOnce(
              text,
              "Three late concessions in five",
              "Five late concessions in three",
            ),
          ),
        primary: [
          fx(4, mismatch, { anchor: "t13", span: [67, 71] }),
          fx(4, mismatch, { anchor: "t13", span: [92, 97] }),
          fx(12, "span_text_changed", { anchor: "t13", idx: 8 }),
        ],
        families: [4, 12, 17],
      });
      witness({
        id: "M10a",
        read: (w) => turnOf(w, "t04").spoken_text,
        edit: (w) =>
          setText(w, "t04", (text) =>
            replaceOnce(text, "43 percent", "34 percent"),
          ),
        primary: [
          fx(4, mismatch, { anchor: "t04", span: [109, 111] }),
          fx(12, "span_text_changed", { anchor: "t04", idx: 1 }),
        ],
        families: [4, 12, 17],
      });
      witness({
        id: "M10b",
        read: (w) => turnOf(w, "t12").spoken_text,
        edit: (w) =>
          setText(w, "t12", (text) => replaceOnce(text, "2019", "2020")),
        primary: [
          fx(4, mismatch, { anchor: "t12", span: [56, 60] }),
          fx(12, "span_text_changed", { anchor: "t12", idx: 7 }),
        ],
        families: [4, 12, 17],
      });
      witness({
        id: "M10c",
        read: (w) => turnOf(w, "t10").spoken_text,
        edit: (w) =>
          setText(w, "t10", (text) =>
            replaceOnce(text, "four supporter", "five supporter"),
          ),
        primary: [
          fx(4, mismatch, { anchor: "t10", span: [7, 11] }),
          fx(12, "span_text_changed", { anchor: "t10", idx: 5 }),
          fx(7, "attribution_prefix_missing", { anchor: "t10", idx: 5 }),
        ],
        families: [4, 7, 12, 17],
      });
      witness({
        id: "M11",
        read: (w) => turnOf(w, "t04").spoken_text,
        edit: (w) =>
          setText(w, "t04", (text) =>
            replaceOnce(text, "won 2-1.", "won 2.1."),
          ),
        primary: [
          fx(4, "numeral_form_unclassified", { anchor: "t04", span: [16, 19] }),
          fx(12, "span_text_changed", { anchor: "t04", idx: 0 }),
        ],
        families: [4, 12, 17],
      });
      witness({
        id: "M12",
        read: (w) => records(claimOf(w, "01").support_refs)[0]?.support_role,
        edit: (w) =>
          setKey(
            defined(records(claimOf(w, "01").support_refs)[0]),
            "support_role",
            "context_only",
          ),
        primary: [
          fx(4, "numeral_support_not_authorized", {
            anchor: "t04",
            span: [16, 19],
          }),
          fx(4, "numeral_support_not_authorized", {
            anchor: "t17",
            span: [25, 28],
          }),
        ],
        families: [4],
      });
      witness({
        id: "M13",
        read: (w) => records(claimOf(w, "06").support_refs).length,
        edit: (w) => {
          const unit = defined(
            records(w.pkg.evidence).find((entry) =>
              String(entry.evidence_unit_id).endsWith("09"),
            ),
          );
          const refs = records(claimOf(w, "06").support_refs);
          refs.push({
            claim_support_id: "d125000a-0000-4000-8000-0000000000ff",
            derivation_run_id: null,
            evidence_unit_id: unit.evidence_unit_id,
            external_support_identity: null,
            support_hash: unit.content_hash,
            support_kind: "evidence",
            support_role: "supports_value",
          });
          return () => {
            refs.pop();
          };
        },
        primary: [
          fx(4, "source_credit_cardinality_mismatch", {
            anchor: "t12",
            span: [9, 12],
          }),
        ],
        families: [4],
      });
      witness({
        id: "M14",
        read: (w) => turnOf(w, "t14").spoken_text,
        edit: (w) =>
          setText(w, "t14", (text) =>
            replaceOnce(text, "this one doesn't", "only one doesn't"),
          ),
        primary: [
          fx(4, "numeral_form_unclassified", {
            anchor: "t14",
            span: [99, 102],
          }),
        ],
        families: [4, 17],
      });
      // CP04: a labelled, independently authored synthetic COMPONENT fixture (parent and child both reworded with same-length number-free
      // fragments; its script hash is not the admitted one, the planner refuses it in GU02). Its only claim is that definition 04 passes.
      const numerals = (payload: Obj): number =>
        records(payload.turns).reduce(
          (sum, turn) => sum + numeralTokens(String(turn.spoken_text)).length,
          0,
        );
      for (const [anchor, from, to] of CP04_REPLACEMENTS) {
        expect(
          codePointLength(from),
          `${anchor} equal replacement lengths`,
        ).toBe(codePointLength(to));
        for (const payload of [INPUTS.C, INPUTS.K]) {
          const turn = defined(
            records(payload.turns).find(
              (item) => item.semantic_turn_id === anchor,
            ),
          );
          expect(
            String(turn.spoken_text).split(from),
            `${anchor} replaced fragment occurs exactly once`,
          ).toHaveLength(2);
        }
        expect(
          numeralTokens(to),
          `${anchor} replacement carries no numeral`,
        ).toEqual([]);
      }
      const synthetic = syntheticPositive();
      // the parent denominator is established independently of the evaluator: 18 pinned tokens minus the two replaced `ten`s
      expect(numerals(INPUTS.K)).toBe(18);
      expect(numerals(synthetic.K)).toBe(16);
      expect(numerals(synthetic.C)).toBe(16);
      for (const [anchor] of CP04_REPLACEMENTS)
        expect(
          codePointLength(String(turnOf(synthetic, anchor).spoken_text)),
          `${anchor} length unchanged`,
        ).toBe(codePointLength(String(turnOf(fresh(), anchor).spoken_text)));
      const positive = evaluate(synthetic).rows[3];
      expect(defined(positive).findings).toEqual([]);
      expect(defined(positive).facts).toEqual({
        examined: 16,
        expected_examined: 16,
        supported: 13,
        no_finding_context: 3,
        violations: 0,
        proof_gaps: 0,
      });
      expect(scriptHash(synthetic.C, { brief: synthetic.brief })).not.toBe(
        CHILD_HASH,
      );
    },
    T,
  );

  // ---- checks 5-6 ------------------------------------------------------------------------------------------------------------------------------------
  it(
    "GU08 checks 5-6 quote and paraphrase permission: M15-M18 incl. the genuine third-party quotation boundary",
    () => {
      witness({
        id: "M15",
        read: (w) => turnOf(w, "t11").spoken_text,
        edit: (w) =>
          setText(w, "t11", (text) =>
            replaceOnce(text, "'the long ten'", "'the long nit'"),
          ),
        primary: [
          fx(5, "quote_text_not_approved_representation", {
            anchor: "t11",
            idx: 14,
          }),
          fx(4, "denominator_mismatch"),
          fx(12, "span_text_changed", { anchor: "t11", idx: 6 }),
          fx(12, "span_text_changed", { anchor: "t11", idx: 14 }),
        ],
        families: [4, 5, 12, 17],
      });
      witness({
        id: "M16",
        read: (w) =>
          defined(
            records(w.pkg.evidence).find((entry) =>
              String(entry.evidence_unit_id).endsWith("09"),
            ),
          ).quote_permission,
        edit: (w) =>
          setKey(
            defined(
              records(w.pkg.evidence).find((entry) =>
                String(entry.evidence_unit_id).endsWith("09"),
              ),
            ),
            "quote_permission",
            false,
          ),
        // an unapproved quotation grants no numeric context: the `ten` inside it is refused fail-closed by definition 04
        primary: [
          fx(5, "quote_not_permitted", { anchor: "t11", idx: 14 }),
          fx(4, "numeral_form_unclassified", { anchor: "t11", span: [83, 86] }),
        ],
        families: [4, 5],
      });
      const phrase = defined(
        quotedPhraseSpans(String(turnOf(fresh(), "t01").spoken_text))[0],
      );
      witness({
        id: "M17",
        read: (w) => turnOf(w, "t01").spoken_text,
        edit: (w) =>
          setText(w, "t01", (text) =>
            replaceOnce(
              text,
              "the phrase 'comfortable lead'",
              "he told us 'comfortable lead'",
            ),
          ),
        primary: [
          fx(5, "quote_without_use", {
            anchor: "t01",
            span: [phrase.start, phrase.end],
          }),
        ],
        families: [5, 17],
      });
      const run = cleanRun();
      witness({
        id: "M18",
        read: (w) => turnOf(w, "t06").spoken_text,
        edit: (w) =>
          setText(w, "t06", (text) => {
            const chars = Array.from(text);
            chars.splice(100, 24, ...Array.from(run));
            return chars.join("");
          }),
        primary: [
          fx(6, "overlap_run_24", { anchor: "t06", idx: 12 }),
          fx(3, "withheld_run_present", { anchor: "t06" }),
        ],
        families: [3, 6, 12, 17],
        warnings: ["overlap_run_24_unquoted t06"],
      });
    },
    T,
  );

  // ---- check 7 and the soft access phrase -----------------------------------------------------------------------------------------------------------
  it(
    "GU09 check 7 speaker attribution and the soft access phrase: M19 prefix, M20 mode, M21 lexical access phrase warns only",
    () => {
      witness({
        id: "M19",
        read: (w) => turnOf(w, "t06").spoken_text,
        edit: (w) =>
          setText(w, "t06", (text) =>
            replaceOnce(
              text,
              "The North Coast Gazette reports",
              "The Local Coast Gazette reports",
            ),
          ),
        primary: [
          fx(7, "attribution_prefix_missing", { anchor: "t06", idx: 3 }),
          fx(12, "span_text_changed", { anchor: "t06", idx: 3 }),
          fx(12, "span_text_changed", { anchor: "t06", idx: 12 }),
        ],
        families: [7, 12, 17],
      });
      witness({
        id: "M20",
        read: (w) => claimUse(w, 3).use_mode,
        edit: (w) => patchClaimUse(w, 3, { use_mode: "asserted" }),
        primary: [
          fx(7, "attribution_mode_illegal", { anchor: "t06", idx: 3 }),
          fx(12, "use_tuple_changed", { anchor: "t06", idx: 3 }),
        ],
        families: [2, 7, 12, 17],
      });
      const soft = witness({
        id: "M21",
        read: (w) => turnOf(w, "t09").spoken_text,
        edit: (w) =>
          setText(w, "t09", (text) =>
            replaceOnce(text, "So the useful ", "we can confirm"),
          ),
        primary: [],
        families: [17],
        warnings: ["lexical_access_phrase t09"],
      });
      expect(soft.aggregate).toBe("failed"); // a lexical phrase is a warning, never a hard failure
      expect(soft.coverage.find((entry) => entry.id === "W01")?.status).toBe(
        "soft_probe_fired",
      );
    },
    T,
  );

  // ---- checks 8-9 ------------------------------------------------------------------------------------------------------------------------------------
  it(
    "GU10 checks 8-9 claim state and program history: M22 coherent supersession, M23 withdrawn continuity",
    () => {
      witness({
        id: "M22",
        read: (w) => [
          claimOf(w, "01").frozen_state,
          claimOf(w, "01").frozen_state_hash,
        ],
        edit: (w) => {
          const entry = claimOf(w, "01");
          const hash = frozenStateHash(String(entry.claim_content_hash), {
            state: "superseded",
            reduced_usage_class: "assertable",
            effective_usage_class: "assertable",
          });
          return chain(
            setKey(entry, "frozen_state", "superseded"),
            setKey(entry, "frozen_state_hash", hash),
            ...[0, 9, 11].map((index) =>
              patchClaimUse(w, index, { claim_state_hash: hash }),
            ),
          );
        },
        primary: [
          fx(8, "claim_state_not_assertable", { anchor: "t04", idx: 0 }),
          fx(12, "use_tuple_changed", { anchor: "t04", idx: 0 }),
          fx(12, "use_tuple_changed", { anchor: "t14", idx: 9 }),
          fx(12, "use_tuple_changed", { anchor: "t17", idx: 11 }),
        ],
        absent: [
          fx(8, "frozen_state_hash_recomputed_mismatch", {
            anchor: "t04",
            idx: 0,
          }),
        ],
        families: [8, 12, 17],
      });
      witness({
        id: "M23",
        read: (w) => records(w.pkg.continuity)[0]?.withdrawn,
        edit: (w) =>
          setKey(defined(records(w.pkg.continuity)[0]), "withdrawn", true),
        primary: [
          fx(9, "continuity_withdrawn_or_draft", { anchor: "t14", idx: 10 }),
        ],
        families: [9],
      });
    },
    T,
  );

  // ---- checks 10-11 ----------------------------------------------------------------------------------------------------------------------------------
  it(
    "GU11 checks 10-11 desk derivation and incident status: M24-M27 incl. four metadata subcases; the metadata check is consistent on the pinned inputs",
    () => {
      expect(checkDerivationMetadata(INPUTS)).toEqual({
        consistent: true,
        findings: [],
      });
      witness({
        id: "M24",
        read: (w) => [
          w.facts.derivation.output,
          w.facts.derivation.output_hash,
        ],
        edit: (w) => {
          const run = w.facts.derivation;
          const output = { ...(run.output as Obj), count: 4 };
          const hash = derivationOutputHash(output);
          const stored = w.facts.supports.filter(
            (row) => row.derivation_run_id === run.derivation_run_id,
          );
          const refs = records(claimOf(w, "07").support_refs).filter(
            (ref) => ref.support_kind === "derivation",
          );
          return chain(
            setKey(run, "output", output),
            setKey(run, "output_hash", hash),
            ...stored.map((row) => setKey(row, "support_hash", hash)),
            ...refs.map((ref) => setKey(ref, "support_hash", hash)),
          );
        },
        primary: [fx(10, "derivation_output_mismatch")],
        families: [10],
        after: (w) => {
          expect(checkPreconditions(w as unknown as ComponentInputs).ok).toBe(
            true,
          ); // coherent: the support identity still verifies
        },
      });
      const subcases: [
        string,
        (w: Work) => unknown,
        (w: Work) => () => void,
      ][] = [
        [
          "derivation_rule_mismatch",
          (w) => w.facts.derivation.rule_version,
          (w) =>
            setKey(
              w.facts.derivation,
              "rule_version",
              "late-concession-count/v2",
            ),
        ],
        [
          "derivation_parameters_mismatch",
          (w) => (w.facts.derivation.parameters as Obj).after_minute,
          (w) =>
            setKey(w.facts.derivation.parameters as Obj, "after_minute", 75),
        ],
        [
          "derivation_window_mismatch",
          (w) =>
            records(w.facts.derivation.exact_input_refs).map(
              (ref) => (ref.selected_provenance as Obj).window_order,
            ),
          (w) => {
            const first = records(w.facts.derivation.exact_input_refs).map(
              (ref) => ref.selected_provenance as Obj,
            );
            const a = defined(first[0]);
            const b = defined(first[1]);
            return chain(
              setKey(a, "window_order", 2),
              setKey(b, "window_order", 1),
            );
          },
        ],
        [
          "derivation_window_mismatch",
          (w) =>
            (
              defined(records(w.facts.derivation.exact_input_refs)[0])
                .window_proof as Obj
            ).as_of,
          (w) =>
            setKey(
              defined(records(w.facts.derivation.exact_input_refs)[0])
                .window_proof as Obj,
              "as_of",
              "2026-09-27T12:58:00Z",
            ),
        ],
      ];
      subcases.forEach(([code, read, edit], index) =>
        witness({
          id: `M25${"abcd"[index] ?? "?"}`,
          read,
          edit,
          primary: [fx(10, code)],
          families: [10],
          after: (w) => {
            expect(checkPreconditions(w as unknown as ComponentInputs).ok).toBe(
              true,
            ); // metadata only: output and hash untouched
          },
        }),
      );
      witness({
        id: "M26",
        read: (w) => claimOf(w, "02").kind,
        edit: (w) => setKey(claimOf(w, "02"), "kind", "incident"),
        primary: [fx(11, "incident_claim_used", { anchor: "t04", idx: 1 })],
        families: [11],
      });
      witness({
        id: "M27",
        read: (w) => [w.pkg.availability, w.pkg.sensitivities],
        edit: (w) => {
          const availability = w.pkg.availability as Obj;
          const incident = availability.serious_incident;
          const sensitivities = w.pkg.sensitivities;
          delete availability.serious_incident;
          w.pkg.sensitivities = [];
          return () => {
            availability.serious_incident = incident;
            w.pkg.sensitivities = sensitivities;
          };
        },
        primary: [fx(11, "incident_witness_missing")],
        families: [11],
      });
    },
    T,
  );

  // ---- check 12 ---------------------------------------------------------------------------------------------------------------------------------------
  it(
    "GU12 check 12 span integrity: M28 shifted span, M29 swapped use tuples",
    () => {
      witness({
        id: "M28",
        read: (w) => [claimUse(w, 0).span_start, claimUse(w, 0).span_end],
        edit: (w) => patchClaimUse(w, 0, { span_start: 1, span_end: 20 }),
        primary: [
          fx(12, "span_text_changed", { anchor: "t04", idx: 0 }),
          fx(12, "span_shift_mismatch", { anchor: "t04", idx: 0 }),
        ],
        families: [12, 17],
      });
      witness({
        id: "M29",
        read: (w) => [claimUse(w, 0).claim_id, claimUse(w, 1).claim_id],
        edit: (w) => {
          const a = claimUse(w, 0);
          const b = claimUse(w, 1);
          const swap = {
            claim_id: b.claim_id,
            claim_state_hash: b.claim_state_hash,
          };
          const other = {
            claim_id: a.claim_id,
            claim_state_hash: a.claim_state_hash,
          };
          return chain(patchClaimUse(w, 0, swap), patchClaimUse(w, 1, other));
        },
        primary: [
          fx(12, "use_tuple_changed", { anchor: "t04", idx: 0 }),
          fx(12, "use_tuple_changed", { anchor: "t04", idx: 1 }),
          fx(4, "numeral_form_unclassified", { anchor: "t04", span: [16, 19] }),
          fx(4, "numeral_form_unclassified", {
            anchor: "t04",
            span: [109, 111],
          }),
        ],
        families: [4, 12, 17],
      });
    },
    T,
  );

  // ---- preconditions 13 and 14 ------------------------------------------------------------------------------------------------------------------------
  it(
    "GU13 preconditions 13-14: M22b hash not recomputed, M24b support hash untouched, support-hash corruption; stop shape and zero rows",
    () => {
      const pinned = checkPreconditions(INPUTS);
      expect(pinned).toEqual({
        ok: true,
        claims13: {
          verified: 9,
          events: 0,
          limits: [
            "historical_visibility_unprovable",
            "frozen_ceiling_unavailable",
          ],
        },
        claims14: { verified: 9 },
      });
      const check = (edit: (work: Work) => void): unknown => {
        const work = fresh();
        edit(work);
        return checkPreconditions(work as unknown as ComponentInputs);
      };
      // M22b: the state changes but the frozen hash and the use hashes are not recomputed
      expect(
        check((w) => (claimOf(w, "01").frozen_state = "superseded")),
      ).toEqual({ ok: false, check: 13 });
      // M24b: the derivation output changes while the support hash stays untouched
      expect(
        check(
          (w) =>
            (w.facts.derivation.output = {
              ...(w.facts.derivation.output as Obj),
              count: 4,
            }),
        ),
      ).toEqual({
        ok: false,
        check: 14,
      });
      // support-hash corruption in the stored supports and in the stored evidence body hash
      expect(
        check(
          (w) =>
            (defined(w.facts.supports[0]).support_hash = flip(
              String(defined(w.facts.supports[0]).support_hash),
            )),
        ),
      ).toEqual({
        ok: false,
        check: 14,
      });
      expect(
        check(
          (w) =>
            (defined(w.facts.evidence[0]).content_hash = flip(
              String(defined(w.facts.evidence[0]).content_hash),
            )),
        ),
      ).toEqual({
        ok: false,
        check: 14,
      });
      // precedence: check 13 is reported before check 14 when both defects exist
      expect(
        check((w) => {
          claimOf(w, "01").frozen_state = "superseded";
          defined(w.facts.supports[0]).support_hash = flip(
            String(defined(w.facts.supports[0]).support_hash),
          );
        }),
      ).toEqual({ ok: false, check: 13 });
      // production boundary: the same defects through the staged candidate stop with `gate_precondition_failed` and no row exists to write
      const db = new GateDb();
      const staged14 = classify(db, "preflight", (results) => {
        const row = defined(defined(results[137])[0]);
        row.support_hash = flip(String(row.support_hash));
      });
      expect(stopRow(staged14)).toEqual({
        code: "gate_precondition_failed",
        detail: { check: 14 },
      });
      const staged13 = classify(db, "preflight", (results) => {
        const row = defined(defined(results[141])[0]);
        row.initial_status = "contested";
      });
      expect(stopRow(staged13)).toEqual({
        code: "gate_precondition_failed",
        detail: { check: 13 },
      });
      if (staged14.kind !== "stop") throw new Error("expected a stop");
      const stop = gateStopOf(
        initialGateContext(),
        staged14.row.stage,
        staged14.row.code,
        staged14.row.detail,
      );
      expect(stop).toEqual({
        kind: "stopped",
        stage: "evaluation",
        code: "gate_precondition_failed",
        writes_attempted: false,
        upstream: { pass1: "unknown", critic: "unknown", revision: "unknown" },
        durable: { gate: "unknown", texture: "unknown" },
        reconciled: false,
        cleanup: { attached_errors: 0, complete: true },
        check: 14,
      });
      const { raw, candidate } = rawOf(db, (results) => {
        const row = defined(defined(results[137])[0]);
        row.support_hash = flip(String(row.support_hash));
      });
      expect(candidate).toEqual({
        kind: "stop",
        code: "gate_precondition_failed",
        check: 14,
      });
      expect(raw.expected).toBe("history"); // no owned value was synthesised to continue
    },
    T,
  );

  // ---- Writing H1-H3 ---------------------------------------------------------------------------------------------------------------------------------
  it(
    "GU14 H1-H3 participant validity, planned block membership and required blocks: M30-M32",
    () => {
      witness({
        id: "M30",
        read: (w) => turnOf(w, "t02").participant_id,
        edit: (w) =>
          chain(
            setKey(turnOf(w, "t02"), "participant_id", "pat"),
            setKey(turnRow(w, "t02"), "participant_id", "pat"),
          ),
        primary: [fx(13, "participant_not_in_roster", { anchor: "t02" })],
        families: [13, 17],
      });
      witness({
        id: "M31",
        read: (w) => turnOf(w, "t05").program_block_id,
        edit: (w) =>
          chain(
            setKey(turnOf(w, "t05"), "program_block_id", UNKNOWN_ID),
            setKey(turnRow(w, "t05"), "program_block_id", UNKNOWN_ID),
          ),
        primary: [
          fx(14, "turn_block_detached", { anchor: "t05" }),
          fx(15, "block_unplanned", { anchor: "t05" }),
        ],
        families: [14, 15, 17],
      });
      witness({
        id: "M32a",
        read: (w) => w.C.program_block_refs,
        edit: (w) =>
          setKey(
            w.C,
            "program_block_refs",
            strs(w.C.program_block_refs).slice(0, -1),
          ),
        primary: [fx(15, "block_missing")],
        families: [15, 17],
      });
      witness({
        id: "M32b",
        read: (w) => w.C.program_block_refs,
        edit: (w) => {
          const refs = strs(w.C.program_block_refs);
          return setKey(w.C, "program_block_refs", [
            defined(refs[1]),
            defined(refs[0]),
            ...refs.slice(2),
          ]);
        },
        primary: [fx(15, "block_order_mismatch")],
        families: [15, 17],
      });
    },
    T,
  );

  // ---- Writing H11, H12, H16 -------------------------------------------------------------------------------------------------------------------------
  it(
    "GU15 H11/H12/H16 provider markup, pronunciation respelling and writer-context completeness: M33-M35",
    () => {
      const t09 = String(turnOf(fresh(), "t09").spoken_text);
      const at = t09.indexOf("Whatever the");
      witness({
        id: "M33",
        read: (w) => turnOf(w, "t09").spoken_text,
        edit: (w) =>
          setText(w, "t09", (text) =>
            replaceOnce(text, "Whatever the", "[laughing] x"),
          ),
        primary: [
          fx(16, "provider_char_class", { anchor: "t09", span: [at, at + 1] }),
          fx(16, "provider_char_class", {
            anchor: "t09",
            span: [at + 9, at + 10],
          }),
          fx(16, "provider_known_tag", { anchor: "t09", span: [at, at + 10] }),
        ],
        families: [16, 17],
      });
      const t03 = String(turnOf(fresh(), "t03").spoken_text);
      const name = t03.indexOf("Northbridge");
      witness({
        id: "M34",
        read: (w) => [
          turnOf(w, "t03").spoken_text,
          defined(w.facts.renderings[1]).rendering,
        ],
        edit: (w) =>
          chain(
            setText(w, "t03", (text) =>
              replaceOnce(text, "Northbridge", "Nawthbridge"),
            ),
            setKey(defined(w.facts.renderings[1]), "rendering", "Nawthbridge"),
          ),
        primary: [
          fx(16, "pronunciation_respelling_present", {
            anchor: "t03",
            span: [name, name + 11],
          }),
        ],
        families: [16, 17],
      });
      const limit = (w: Work): number => Number(w.context.model_context_limit);
      witness({
        id: "M35a",
        read: (w) => w.context.estimated_input_tokens,
        edit: (w) =>
          setKey(
            w.context,
            "estimated_input_tokens",
            limit(w) - Number(w.context.reserved_output_tokens) + 1,
          ),
        primary: [fx(18, "context_budget_exceeded")],
        families: [18],
      });
      witness({
        id: "M35b",
        read: (w) => (w.context.completeness_check as Obj).missing_refs,
        edit: (w) =>
          setKey(w.context.completeness_check as Obj, "missing_refs", ["x"]),
        primary: [fx(18, "context_incomplete")],
        families: [18],
      });
      witness({
        id: "M35c",
        read: (w) => w.context.serialized_input_hash,
        edit: (w) =>
          setKey(
            w.context,
            "serialized_input_hash",
            flip(String(w.context.serialized_input_hash)),
          ),
        primary: [fx(18, "context_hash_mismatch")],
        families: [18],
      });
    },
    T,
  );

  // ---- diff lock: structure and lineage ----------------------------------------------------------------------------------------------------------------
  it(
    "GU16 diff-lock structure: M36-M42 incl. the duplicate-anchor boundary (unrecomputable hash, not a fabricated mismatch)",
    () => {
      const scope = fx(17, "texture_admission_refused", {
        upstream: "texture_scope_exceeded",
        field: "turn_scope",
      });
      witness({
        id: "M36",
        read: (w) => turnOf(w, "t02").spoken_text,
        edit: (w) =>
          setText(w, "t02", () =>
            String(
              defined(
                records(w.K.turns).find(
                  (turn) => turn.semantic_turn_id === "t02",
                ),
              ).spoken_text,
            ),
          ),
        primary: [
          fx(17, "rewrite_row_mismatch", { anchor: "t02" }),
          fx(17, "child_hash_mismatch"),
          scope,
        ],
        families: [17],
      });
      witness({
        id: "M37",
        read: (w) => turnOf(w, "t03").spoken_text,
        edit: (w) => setText(w, "t03", (text) => `${text} Indeed`),
        primary: [
          fx(17, "scope_exceeded", { anchor: "t03" }),
          fx(17, "child_hash_mismatch"),
          scope,
        ],
        families: [17],
      });
      witness({
        id: "M38",
        read: (w) => [
          turnOf(w, "t01").participant_id,
          turnOf(w, "t02").participant_id,
        ],
        edit: (w) => {
          const one = turnOf(w, "t01");
          const two = turnOf(w, "t02");
          const a = String(one.participant_id);
          const b = String(two.participant_id);
          return chain(
            setKey(one, "participant_id", b),
            setKey(two, "participant_id", a),
            setKey(turnRow(w, "t01"), "participant_id", b),
            setKey(turnRow(w, "t02"), "participant_id", a),
          );
        },
        primary: [
          fx(17, "turn_structure_changed", { anchor: "t01" }),
          fx(17, "turn_structure_changed", { anchor: "t02" }),
          fx(17, "child_hash_mismatch"),
          fx(17, "texture_admission_refused", {
            upstream: "texture_protected_content_changed",
            field: "turn_structure",
          }),
        ],
        families: [17],
      });
      witness({
        id: "M39",
        read: (w) => [
          records(w.C.turns).length,
          records(w.C.turn_claim_uses).length,
          w.rows.turns.length,
          w.rows.claim_uses.length,
        ],
        edit: (w) => {
          const turns = records(w.C.turns);
          const uses = records(w.C.turn_claim_uses);
          const turn = defined(turns.pop());
          const use = defined(uses.pop());
          const row = defined(w.rows.turns.pop());
          const useRow = defined(w.rows.claim_uses.pop());
          return () => {
            turns.push(turn);
            uses.push(use);
            w.rows.turns.push(row);
            w.rows.claim_uses.push(useRow);
          };
        },
        primary: [
          fx(17, "turn_structure_changed"),
          fx(17, "claim_use_changed", { anchor: "t17", idx: 11 }),
          fx(17, "child_hash_mismatch"),
          fx(17, "texture_admission_refused", {
            upstream: "texture_protected_content_changed",
            field: "turn_structure",
          }),
        ],
        // removing t17 and its use changes the denominators and the turn-based families; every other definition stays equal to the baseline
        families: [1, 2, 3, 4, 12, 13, 14, 15, 16, 17],
      });
      witness({
        id: "M40",
        // the designated turn is read by its stable position: after the rename no turn answers to `t03`
        read: (w) => defined(records(w.C.turns)[2]).semantic_turn_id,
        edit: (w) =>
          setKey(defined(records(w.C.turns)[2]), "semantic_turn_id", "t02"),
        primary: [
          fx(17, "child_hash_unrecomputable"),
          fx(17, "turn_structure_changed", { anchor: "t03" }),
          fx(17, "texture_admission_refused", {
            upstream: "texture_protected_content_changed",
            field: "turn_structure",
          }),
        ],
        absent: [fx(17, "child_hash_mismatch")],
        families: [17],
      });
      witness({
        id: "M41",
        read: (w) => turnOf(w, "t01").turn_id,
        edit: (w) => {
          const parentId = defined(records(w.K.turns)[0]).turn_id;
          // both the payload turn and its relational row are captured BEFORE either is edited (the row lookup keys on the id being replaced)
          const turn = turnOf(w, "t01");
          const row = turnRow(w, "t01");
          return chain(
            setKey(turn, "turn_id", parentId),
            setKey(row, "turn_id", parentId),
          );
        },
        primary: [fx(17, "turn_id_reused", { anchor: "t01" })],
        absent: [fx(17, "child_hash_mismatch")],
        families: [17],
      });
      witness({
        id: "M42",
        read: (w) => w.C.revision_parent_content_identity,
        edit: (w) =>
          setKey(w.C, "revision_parent_content_identity", flip(PARENT_HASH)),
        primary: [
          fx(17, "parent_identity_mismatch"),
          fx(17, "child_hash_mismatch"),
          fx(17, "texture_admission_refused", {
            upstream: "texture_subject_mismatch",
            field: "parent_script_hash",
          }),
        ],
        families: [17],
      });
    },
    T,
  );

  // ---- diff lock: tokens, predictions and lineage ---------------------------------------------------------------------------------------------------------
  it(
    "GU17 diff-lock tokens, predictions and lineage: M43-M47 incl. the hedge and prediction controls",
    () => {
      witness({
        id: "M43",
        read: (w) => turnOf(w, "t07").spoken_text,
        edit: (w) =>
          setText(w, "t07", (text) =>
            replaceOnce(text, "time could have", "time might have"),
          ),
        primary: [
          fx(17, "lexical_hedge_changed", { anchor: "t07" }),
          fx(17, "rewrite_row_mismatch", { anchor: "t07" }),
          fx(17, "child_hash_mismatch"),
          fx(12, "span_text_changed", { anchor: "t07", idx: 4 }),
          fx(12, "span_text_changed", { anchor: "t07", idx: 13 }),
          fx(17, "texture_admission_refused", {
            upstream: "texture_protected_content_changed",
            field: "use_span_text",
          }),
        ],
        families: [12, 17],
      });
      witness({
        id: "M44",
        read: (w) => turnOf(w, "t05").spoken_text,
        edit: (w) =>
          setText(w, "t05", (text) =>
            replaceOnce(text, "It's not yet", "It's now yet"),
          ),
        primary: [
          fx(17, "lexical_negation_changed", { anchor: "t05" }),
          fx(17, "lexical_hedge_changed", { anchor: "t05" }),
          fx(17, "rewrite_row_mismatch", { anchor: "t05" }),
          fx(17, "child_hash_mismatch"),
          fx(17, "texture_admission_refused", {
            upstream: "texture_protected_content_changed",
            field: "hedge_cue",
          }),
        ],
        families: [17],
      });
      const t17 = codePointLength(String(turnOf(fresh(), "t17").spoken_text));
      witness({
        id: "M45",
        read: (w) => turnOf(w, "t17").spoken_text,
        edit: (w) => setText(w, "t17", (text) => `${text}!`),
        primary: [
          fx(17, "punctuation_class_added", {
            anchor: "t17",
            span: [t17, t17 + 1],
          }),
          fx(17, "rewrite_row_mismatch", { anchor: "t17" }),
          fx(17, "child_hash_mismatch"),
          fx(17, "texture_admission_refused", {
            upstream: "texture_protected_content_changed",
            field: "punctuation_class",
          }),
        ],
        // the added `!` is a new character class: the provider-markup count of classes seen grows from 7 to 8 without any forbidden-markup finding
        families: [16, 17],
      });
      witness({
        id: "M46",
        read: (w) =>
          defined(records(w.C.prediction_candidates)[0]).prediction_text,
        edit: (w) => {
          const candidate = defined(records(w.C.prediction_candidates)[0]);
          return setKey(
            candidate,
            "prediction_text",
            replaceOnce(
              String(candidate.prediction_text),
              "is dull on",
              "is dumb on",
            ),
          );
        },
        primary: [
          fx(17, "prediction_changed", { anchor: "t15" }),
          fx(17, "child_hash_mismatch"),
          fx(17, "texture_admission_refused", {
            upstream: "texture_protected_content_changed",
            field: "prediction",
          }),
        ],
        families: [17],
      });
      witness({
        id: "M47a",
        read: (w) => w.rows.version.revision_parent_id,
        edit: (w) =>
          setKey(
            w.rows.version,
            "revision_parent_id",
            flip(String(w.rows.version.revision_parent_id)),
          ),
        primary: [fx(17, "relational_parent_mismatch")],
        families: [17],
      });
      witness({
        id: "M47b",
        read: (w) => defined(w.rewrites[3]).new,
        edit: (w) =>
          setKey(
            defined(w.rewrites[3]),
            "new",
            `${String(defined(w.rewrites[3]).new)}!`,
          ),
        primary: [
          fx(17, "rewrite_table_unpinned"),
          fx(17, "rewrite_row_mismatch", { anchor: "t08" }),
        ],
        families: [17],
      });
      // a changed tuple no longer hides an independently testable range, text or re-anchor defect when both mates exist
      witness({
        id: "M47c",
        read: (w) => [
          claimUse(w, 0).claim_state_hash,
          claimUse(w, 0).span_start,
          claimUse(w, 0).span_end,
        ],
        edit: (w) =>
          patchClaimUse(w, 0, {
            claim_state_hash: flip(String(claimUse(w, 0).claim_state_hash)),
            span_start: 1,
            span_end: 19,
          }),
        primary: [
          fx(17, "claim_use_changed", { anchor: "t04", idx: 0 }),
          fx(17, "span_text_changed", { anchor: "t04", idx: 0 }),
          fx(17, "span_reanchor_mismatch", { anchor: "t04", idx: 0 }),
          fx(12, "use_tuple_changed", { anchor: "t04", idx: 0 }),
        ],
        families: [1, 4, 8, 12, 17],
      });
    },
    T,
  );

  // ---- the exact finite delta ---------------------------------------------------------------------------------------------------------------------------
  it(
    "GU18 the exact finite delta: 9 rows over 8 anchors, net −5 code points, shifts t13 −1 and t17 −1, nine byte-identical turns (independent oracle)",
    () => {
      const parent = new Map(
        records(INPUTS.K.turns).map((turn) => [
          String(turn.semantic_turn_id),
          String(turn.spoken_text),
        ]),
      );
      const child = new Map(
        records(INPUTS.C.turns).map((turn) => [
          String(turn.semantic_turn_id),
          String(turn.spoken_text),
        ]),
      );
      // oracle authored from the design record: [anchor, parent length, child length]
      const lengths: [string, number, number][] = [
        ["t02", 60, 58],
        ["t05", 182, 181],
        ["t07", 200, 196],
        ["t08", 264, 270],
        ["t09", 104, 103],
        ["t13", 153, 151],
        ["t14", 251, 250],
        ["t17", 167, 166],
      ];
      for (const [anchor, before, after] of lengths) {
        expect(
          codePointLength(defined(parent.get(anchor))),
          `${anchor} parent`,
        ).toBe(before);
        expect(
          codePointLength(defined(child.get(anchor))),
          `${anchor} child`,
        ).toBe(after);
      }
      expect(
        lengths.reduce((sum, [, before, after]) => sum + after - before, 0),
      ).toBe(-5);
      const identical = [
        "t01",
        "t03",
        "t04",
        "t06",
        "t10",
        "t11",
        "t12",
        "t15",
        "t16",
      ];
      for (const anchor of identical)
        expect(child.get(anchor), anchor).toBe(parent.get(anchor));
      expect(
        [...child.keys()].filter(
          (anchor) => child.get(anchor) !== parent.get(anchor),
        ),
      ).toEqual(lengths.map(([anchor]) => anchor));
      // nine rewrite rows over eight anchors, each applied exactly once to the parent text
      expect(TEXTURE_REWRITE_TABLE.map((row) => row.anchor)).toEqual([
        "t02",
        "t05",
        "t07",
        "t08",
        "t09",
        "t13",
        "t13",
        "t14",
        "t17",
      ]);
      expect(TEXTURE_REWRITE_TABLE.map((row) => row.kind)).toEqual([
        "contraction",
        "contraction",
        "contraction",
        "concession_beat",
        "contraction",
        "contraction",
        "contraction",
        "contraction",
        "contraction",
      ]);
      for (const [anchor] of lengths) {
        let text = defined(parent.get(anchor));
        for (const row of TEXTURE_REWRITE_TABLE.filter(
          (item) => item.anchor === anchor,
        )) {
          expect(text.split(row.old), `${anchor} old once`).toHaveLength(2);
          text = text.replace(row.old, () => row.new);
        }
        expect(text, anchor).toBe(child.get(anchor));
      }
      // use spans: [parent, child] pairs authored from the design record (only t13 and t17 move, by one code point)
      const spans: [number, number, number, number][] = [
        [0, 19, 0, 19],
        [109, 130, 109, 130],
        [49, 136, 49, 136],
        [27, 144, 27, 144],
        [0, 168, 0, 168],
        [0, 96, 0, 96],
        [73, 87, 73, 87],
        [9, 60, 9, 60],
        [68, 98, 67, 97],
        [4, 11, 4, 11],
        [24, 88, 24, 88],
        [26, 29, 25, 28],
      ];
      const parentUses = records(INPUTS.K.turn_claim_uses);
      const childUses = records(INPUTS.C.turn_claim_uses);
      spans.forEach(([ps, pe, cs, ce], index) => {
        expect(
          [
            defined(parentUses[index]).span_start,
            defined(parentUses[index]).span_end,
          ],
          `parent ${String(index)}`,
        ).toEqual([ps, pe]);
        expect(
          [
            defined(childUses[index]).span_start,
            defined(childUses[index]).span_end,
          ],
          `child ${String(index)}`,
        ).toEqual([cs, ce]);
        const anchor = String(defined(parentUses[index]).semantic_turn_id);
        expect(
          ps +
            rewriteShift(
              defined(parent.get(anchor)),
              anchor,
              ps,
              TEXTURE_REWRITE_TABLE,
            ),
          `start ${String(index)}`,
        ).toBe(cs);
        expect(
          pe +
            rewriteShift(
              defined(parent.get(anchor)),
              anchor,
              pe,
              TEXTURE_REWRITE_TABLE,
            ),
          `end ${String(index)}`,
        ).toBe(ce);
      });
      // the evaluator derives the same facts
      expect(defined(evaluate(fresh()).rows[16]).facts).toEqual(
        EXPECTED_FACTS[16],
      );
      expect(defined(evaluate(fresh()).rows[16]).findings).toEqual([]);
    },
    T,
  );

  // ---- P0 ----------------------------------------------------------------------------------------------------------------------------------------------------
  it(
    "GU19 P0: a denominator derived from the parent, witness absence, and historical rows never a current pass",
    () => {
      const control = witness({
        id: "M49",
        read: (w) => [
          records(w.C.turn_claim_uses).length,
          w.rows.claim_uses.length,
        ],
        edit: (w) => {
          const uses = records(w.C.turn_claim_uses);
          const use = defined(uses.pop());
          const row = defined(w.rows.claim_uses.pop());
          return () => {
            uses.push(use);
            w.rows.claim_uses.push(row);
          };
        },
        primary: [
          fx(1, "denominator_mismatch"),
          fx(2, "denominator_mismatch"),
          fx(12, "denominator_mismatch"),
          fx(12, "use_tuple_changed", { anchor: "t17", idx: 11 }),
          fx(4, "numeral_form_unclassified", { anchor: "t17", span: [25, 28] }),
        ],
        families: [1, 2, 4, 12, 17],
      });
      for (const index of [0, 1, 11])
        expect(
          defined(control.rows[index]).findings.length,
          `def ${String(index + 1)} fails`,
        ).toBeGreaterThan(0);
      // witness absence: with both incident witnesses gone the definition cannot pass (a proof gap, never a pass)
      const bare = fresh();
      (bare.pkg.availability as Obj).serious_incident = undefined;
      bare.pkg.sensitivities = [];
      const incident = defined(evaluate(bare).rows[10]);
      expect(
        incident.findings.map((item) => `${item.class}:${item.code}`),
      ).toEqual(["proof_gap:incident_witness_missing"]);
      // the loaded historical rows (fingerprint 000b3e1e…) are history, never a current pass: with only those rows the gate state is 0
      const history = classify(new GateDb());
      expect(history).toEqual({ kind: "state", gate: 0, texture: 4 });
      expect(
        PLAN.historical.every((row) => row.input_fingerprint !== FINGERPRINT),
      ).toBe(true);
    },
    T,
  );

  // ---- soft warnings -------------------------------------------------------------------------------------------------------------------------------------
  it(
    "GU20 soft warnings: W1, W4, W6 and W12 fire on crafted input and never fail the gate; eight probes stay not established",
    () => {
      expect(softWarnings(INPUTS)).toEqual([]);
      const baseline = evaluateWritingChecks(INPUTS).coverage;
      const status = (id: string): string | undefined =>
        baseline.find((entry) => entry.id === id)?.status;
      for (const id of ["W01", "W04", "W06", "W12"])
        expect(status(id), id).toBe("soft_probe_clear");
      expect(
        baseline
          .filter((entry) => entry.status === "soft_probe_not_established")
          .map((entry) => entry.id),
      ).toEqual(["W02", "W03", "W05", "W07", "W08", "W09", "W10", "W11"]);
      expect(baseline.find((entry) => entry.id === "W02")?.limits).toEqual([
        "no_threshold",
      ]);
      expect(baseline.find((entry) => entry.id === "W09")?.limits).toEqual([
        "semantic",
      ]);
      const fired = witness({
        id: "M50",
        read: (w) => [
          turnOf(w, "t01").spoken_text,
          turnOf(w, "t02").spoken_text,
          turnOf(w, "t16").spoken_text,
        ],
        edit: (w) =>
          chain(
            setText(w, "t01", (text) =>
              replaceOnce(text, "I have a small", "Right have a small"),
            ),
            setText(w, "t02", (text) => `Right. ${text}`),
            setText(w, "t16", (text) => `${text} The key takeaway.`),
          ),
        primary: [],
        families: [17],
        warnings: ["lexical_opener_repeat t03", "lexical_signposting t16"],
      });
      expect(fired.aggregate).toBe("failed");
      expect(fired.coverage.find((entry) => entry.id === "W04")?.status).toBe(
        "soft_probe_fired",
      );
      expect(fired.coverage.find((entry) => entry.id === "W12")?.status).toBe(
        "soft_probe_fired",
      );
      expect(new Set(WARNING_CODES).size).toBe(4);
    },
    T,
  );

  // ---- aggregate algebra ----------------------------------------------------------------------------------------------------------------------------------
  it(
    "GU21 aggregate algebra: disjoint and exhaustive truth table; gaps retained; complete_defined_set unreachable on the pinned chain",
    () => {
      const violation = {
        class: "violation",
        code: "span_text_changed",
      } as const;
      const gap = {
        class: "proof_gap",
        code: "required_proof_not_established",
      } as const;
      const required = {
        id: "H04",
        status: "not_established_required",
      } as const;
      const clear = { id: "W01", status: "soft_probe_clear" } as const;
      for (const hasViolation of [false, true])
        for (const hasGap of [false, true])
          for (const hasRequired of [false, true]) {
            const findings = [
              ...(hasViolation ? [violation] : []),
              ...(hasGap ? [gap] : []),
            ];
            const coverage = [clear, ...(hasRequired ? [required] : [])];
            const expected = hasViolation
              ? "failed"
              : hasGap || hasRequired
                ? "incomplete"
                : "complete_defined_set";
            expect(
              aggregateOf(findings, coverage),
              `${String(hasViolation)}/${String(hasGap)}/${String(hasRequired)}`,
            ).toBe(expected);
          }
      // only `not_established_required` counts as a coverage gap
      for (const status of [
        "established",
        "established_with_limits",
        "inapplicable_witnessed",
        "deferred_semantic",
        "soft_probe_clear",
        "soft_probe_fired",
        "soft_probe_not_established",
      ] as const)
        expect(aggregateOf([], [{ id: "H04", status }])).toBe(
          "complete_defined_set",
        );
      // the pinned chain: failed (violation), gaps retained. The full CP04 copy below is failed too (its frozen-hash diff lock still applies); the
      // incomplete branch is demonstrated separately by the nonviolating algebra over the retained gaps
      const pinned = evaluate(fresh());
      expect(pinned.aggregate).toBe("failed");
      expect(
        pinned.rows.map((row) => (row.findings.length === 0 ? "pass" : "fail")),
      ).toEqual(
        RESULT_IDS.map((_, index) =>
          index === 3 || index === 9 ? "fail" : "pass",
        ),
      );
      // CP04 is a component experiment, never a whole-gate result: its child text changed while the frozen declared hash stayed, so the diff lock
      // necessarily reports a violation and the aggregate is failed (not incomplete, not complete); it is not an admitted or green result
      const repaired = evaluate(syntheticPositive());
      expect(repaired.aggregate).toBe("failed");
      expect(
        defined(repaired.rows[16]).findings.map((item) => item.code),
      ).toContain("child_hash_mismatch");
      expect(defined(repaired.rows[3]).findings).toEqual([]);
      // the incomplete branch is shown with the pinned algebra over explicitly nonviolating findings: the retained proof gaps and the required coverage gaps
      const gaps = pinned.rows
        .flatMap((row) => row.findings)
        .filter((item) => item.class === "proof_gap");
      expect(gaps.map((item) => item.code)).toEqual([
        "duration_context_unresolved",
        "required_proof_not_established",
      ]);
      expect(aggregateOf(gaps, pinned.coverage)).toBe("incomplete");
      expect(aggregateOf([], pinned.coverage)).toBe("incomplete");
      expect(
        pinned.coverage
          .filter((entry) => entry.status === "not_established_required")
          .map((entry) => entry.id),
      ).toEqual(["H04", "H13"]);
    },
    T,
  );

  // ---- planned rows and evaluation ownership ----------------------------------------------------------------------------------------------------------
  const DEF04 = JSON.parse(
    '{"actor_id":"d1250001-0000-4000-8000-000000000002","actor_kind":"policy","check":"claims.value_support","facts":{"examined":18,"expected_examined":18,"no_finding_context":3,"proof_gaps":1,"supported":13,"violations":1},"findings":[{"anchor":"t04","class":"violation","code":"precise_duration_unsupported","span":[136,139]},{"anchor":"t08","class":"proof_gap","code":"duration_context_unresolved","span":[127,130]}],"fingerprint_stage":"claims_writing","schema":"claims-writing-gate-result/1","subject_refs":["063cbf1b-c4fa-4254-a63b-343dfd494787"]}',
  ) as Obj;
  const DEF10 = JSON.parse(
    '{"actor_id":"d1250001-0000-4000-8000-000000000002","actor_kind":"policy","check":"claims.desk_derivation","facts":{"desk_derived_uses":2,"examined":1,"expected_examined":1,"input_refs":5,"metadata_checks_passed":1,"window_matches":5},"findings":[{"class":"proof_gap","code":"required_proof_not_established","ref":"derivation_count_reexecution"}],"fingerprint_stage":"claims_writing","schema":"claims-writing-gate-result/1","subject_refs":["063cbf1b-c4fa-4254-a63b-343dfd494787"]}',
  ) as Obj;
  const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
  const VOCABULARY = new Set<string>([
    "actor_id",
    "actor_kind",
    "check",
    "facts",
    "findings",
    "fingerprint_stage",
    "schema",
    "subject_refs",
    "policy",
    "claims_writing",
    GATE_PIN.result_schema,
    "class",
    "code",
    "anchor",
    "span",
    "use_index",
    "ref",
    "upstream_code",
    "field",
    "violation",
    "proof_gap",
    "derivation_count_reexecution",
    ...VIOLATION_CODES,
    "duration_context_unresolved",
    "incident_witness_missing",
    "required_proof_not_established",
    ...GATE_DEFINITION_KEYS,
    ...Object.keys(
      EXPECTED_FACTS.reduce<Obj>((all, facts) => ({ ...all, ...facts }), {}),
    ),
  ]);
  const closedLeaf = (leaf: string): boolean =>
    VOCABULARY.has(leaf) ||
    UUID.test(leaf) ||
    /^t(?:0[1-9]|1[0-7])$/u.test(leaf);

  it(
    "GU22 planned rows and evaluation ownership: 18 derived rows, closed 8-key result, closed vocabularies, no text, substitution refused with zero queries",
    async () => {
      const evaluation = evaluateGateComponent(INPUTS);
      const rows = ownedRowsOf(PLAN, evaluation.rows);
      expect(rows).toHaveLength(18);
      rows.forEach((row, index) => {
        expect(row.gate_result_id).toBe(RESULT_IDS[index]);
        expect(row.gate_definition_id).toBe(gateDefinitionId(index + 1));
        expect(row.attempt_id).toBe(ATTEMPT);
        expect(row.input_fingerprint).toBe(FINGERPRINT);
        expect(row.created_at).toBe(CREATED_AT);
        expect(row.outcome).toBe(index === 3 || index === 9 ? "fail" : "pass");
        expect(Object.keys(row.result).sort()).toEqual([
          "actor_id",
          "actor_kind",
          "check",
          "facts",
          "findings",
          "fingerprint_stage",
          "schema",
          "subject_refs",
        ]);
        expect(isClosedResult(row.result), row.key).toBe(true);
        expect(row.result.check).toBe(GATE_DEFINITION_KEYS[index]);
        expect(row.result.facts, row.key).toEqual(EXPECTED_FACTS[index]);
        for (const leaf of stringLeaves(row.result))
          expect(closedLeaf(leaf), `${row.key}: ${leaf}`).toBe(true);
      });
      expect(defined(rows[3]).result).toEqual(DEF04);
      expect(defined(rows[9]).result).toEqual(DEF10);
      expect(scanGateSurfaces({ rows }, UP.originals)).toBeNull();
      // closure: any other key, a non-integer fact, an unknown code, a mismatched class or a foreign subject is refused
      const good = defined(rows[3]).result;
      expect(isClosedResult({ ...good, extra: 1 })).toBe(false);
      expect(isClosedResult({ ...good, facts: { examined: 1.5 } })).toBe(false);
      expect(isClosedResult({ ...good, subject_refs: ["x"] })).toBe(false);
      expect(
        isClosedFinding(
          { class: "violation", code: "not_a_code" },
          "claims.presence",
        ),
      ).toBe(false);
      expect(
        isClosedFinding(
          { class: "proof_gap", code: "span_text_changed" },
          "claims.span_integrity",
        ),
      ).toBe(false);
      expect(
        isClosedFinding(
          { class: "violation", code: "span_text_changed", message: "x" },
          "claims.span_integrity",
        ),
      ).toBe(false);
      // the inner schemas are exact per definition: fact keys, finding codes and location variants
      const facts = good.facts as Obj;
      const withFacts = (replacement: Obj): Obj => ({
        ...good,
        facts: replacement,
      });
      expect(isClosedResult(withFacts({}))).toBe(false);
      expect(isClosedResult(withFacts({ ...facts, undeclared_key: 1 }))).toBe(
        false,
      );
      expect(
        isClosedResult(
          withFacts(
            Object.fromEntries(
              Object.entries(facts).filter(([key]) => key !== "supported"),
            ),
          ),
        ),
      ).toBe(false);
      const reexecution = {
        class: "proof_gap",
        code: "required_proof_not_established",
        ref: "derivation_count_reexecution",
      };
      expect(isClosedFinding(reexecution, "claims.desk_derivation")).toBe(true);
      expect(isClosedFinding(reexecution, "claims.value_support")).toBe(false); // a known code under the wrong definition
      expect(
        isClosedFinding(
          { class: "proof_gap", code: "required_proof_not_established" },
          "claims.desk_derivation",
        ),
      ).toBe(false); // mandatory ref missing
      expect(
        isClosedFinding(
          { class: "violation", code: "denominator_mismatch" },
          "claims.presence",
        ),
      ).toBe(true);
      expect(
        isClosedFinding(
          { class: "violation", code: "denominator_mismatch", anchor: "t01" },
          "claims.presence",
        ),
      ).toBe(false); // extraneous location
      expect(
        isClosedFinding(
          {
            class: "violation",
            code: "span_text_changed",
            anchor: "t01",
            span: [0, 1],
            use_index: 0,
          },
          "claims.span_integrity",
        ),
      ).toBe(false);
      expect(
        isClosedFinding(
          {
            class: "violation",
            code: "span_text_changed",
            anchor: "t01",
            use_index: 0,
          },
          "claims.span_integrity",
        ),
      ).toBe(true);
      expect(
        isClosedFinding(
          { class: "violation", code: "use_row_payload_mismatch" },
          "claims.presence",
        ),
      ).toBe(true); // an extra row with no payload mate
      expect(
        isClosedFinding(
          {
            class: "violation",
            code: "use_row_payload_mismatch",
            anchor: "t01",
          },
          "claims.presence",
        ),
      ).toBe(false);
      expect(
        isClosedFinding(
          { class: "violation", code: "texture_admission_refused" },
          "writing.diff_lock",
        ),
      ).toBe(false);
      expect(
        isClosedFinding(
          {
            class: "violation",
            code: "texture_admission_refused",
            upstream_code: "texture_scope_exceeded",
            field: "turn_scope",
          },
          "writing.diff_lock",
        ),
      ).toBe(true);
      // own fields and own table entries only: inherited names, inherited or missing discriminants and invalid definitions are rejected (false, never a throw)
      const denominator = { class: "violation", code: "denominator_mismatch" };
      expect(isClosedFinding(denominator, "claims.presence")).toBe(true);
      for (const inherited of [
        "constructor",
        "toString",
        "__proto__",
        "hasOwnProperty",
      ]) {
        expect(
          isClosedFinding(
            { class: "violation", code: inherited },
            "claims.presence",
          ),
          inherited,
        ).toBe(false);
        expect(
          isClosedResult({
            ...good,
            findings: [{ class: "violation", code: inherited }],
          }),
          inherited,
        ).toBe(false);
        expect(
          isClosedFinding(denominator, inherited as never),
          `definition ${inherited}`,
        ).toBe(false);
      }
      for (const invalid of [
        undefined,
        7,
        {},
        "claims.unknown",
        "writing.diff_lock ",
      ])
        expect(
          isClosedFinding(denominator, invalid as never),
          "invalid definition",
        ).toBe(false);
      expect(
        isClosedFinding(Object.create(denominator) as Obj, "claims.presence"),
        "both discriminants inherited",
      ).toBe(false);
      expect(
        isClosedFinding(
          Object.assign(
            Object.create({ code: "denominator_mismatch" }) as Obj,
            { class: "violation" },
          ),
          "claims.presence",
        ),
        "inherited code",
      ).toBe(false);
      expect(
        isClosedFinding(
          Object.assign(Object.create({ class: "violation" }) as Obj, {
            code: "denominator_mismatch",
          }),
          "claims.presence",
        ),
        "inherited class",
      ).toBe(false);
      expect(
        isClosedFinding({ class: "violation" }, "claims.presence"),
        "missing code",
      ).toBe(false);
      expect(
        isClosedFinding({ code: "denominator_mismatch" }, "claims.presence"),
        "missing class",
      ).toBe(false);
      expect(
        isClosedFinding(
          Object.assign(Object.create({ anchor: "t01", use_index: 0 }) as Obj, {
            class: "violation",
            code: "use_turn_unresolved",
          }),
          "claims.presence",
        ),
        "inherited location keys",
      ).toBe(false);
      // ownership: one scripted successful acquisition (148 driver calls, counted once) mints the only legitimate token
      const owned = await ownedEvaluation();
      expect(isOwnedGateEvaluation(owned)).toBe(true);
      expect(owned.plan).toBe(PLAN);
      expect(owned.rows).toEqual(rows);
      expect(owned.aggregate).toBe("failed");
      expect(Object.isFrozen(owned)).toBe(true);
      expect(isComponentEvaluation(evaluation)).toBe(true);
      expect(isOwnedGateEvaluation(evaluation)).toBe(false);
      const secondPlan = planG(
        "seamed",
        { texture: INV, created_at: "2026-10-21T12:00:11Z" },
        { texturePlan: PLAN.texture, pack: PACK },
      );
      if (secondPlan.kind !== "planned")
        throw new Error("the second plan must be admitted");
      const substitutions: [string, unknown, GatePlan][] = [
        [
          "a plain object",
          {
            plan: PLAN,
            rows: owned.rows,
            aggregate: "complete_defined_set",
            warnings: [],
            coverage: [],
            preconditions: owned.preconditions,
          },
          PLAN,
        ],
        ["a component evaluation", evaluation, PLAN],
        [
          "a frozen structural clone of an owned evaluation",
          Object.freeze(structuredClone(owned)),
          PLAN,
        ],
        ["an owned evaluation of a different plan", owned, secondPlan.plan],
      ];
      for (const [name, value, plan] of substitutions) {
        const guard = forbidden();
        await expect(
          recordClaimsWritingGate(guard.pool, plan, value as OwnedEvaluation),
          name,
        ).rejects.toThrow(
          new TypeError("an owned evaluation of this plan is required"),
        );
        expect(guard.uses(), name).toBe(0);
      }
      // a caller-built raw snapshot, a forged acquisition and a failed acquisition never mint write authority
      const { raw, candidate } = rawOf(new GateDb());
      const forged = { point: "preflight", plan: PLAN, raw, candidate };
      expect(isGateAcquisition(forged)).toBe(false);
      expect(() =>
        produceGateEvaluation(forged as unknown as GateAcquisition),
      ).toThrow(TypeError);
      expect(() =>
        classifyGateAcquisition(
          forged as unknown as GateAcquisition,
          "preflight",
        ),
      ).toThrow(TypeError);
      expect(
        isOwnedGateEvaluation(
          classifyGateRaw(raw, PLAN, candidate, "preflight"),
        ),
      ).toBe(false);
      const refusing = new ScriptPool();
      refusing.connectError = new Error("connect failed");
      const failed = await readGateSnapshot(
        asPool(refusing),
        PLAN,
        "preflight",
      );
      expect(failed).toEqual({
        ok: false,
        cleanup: { attached_errors: 0, complete: true },
      });
      expect(refusing.total()).toBe(0);
      await expect(
        readGateSnapshot(forbidden().pool, {} as GatePlan, "preflight"),
      ).rejects.toThrow(TypeError);
    },
    T,
  );

  // ---- the fixed statements -----------------------------------------------------------------------------------------------------------------------------
  it(
    "GU23 the fixed snapshot: 145 static read-only SELECTs plus one private native comparison (146; 148 driver calls), order, parameters, count projection",
    () => {
      const statements = gateSnapshotStatements(PLAN);
      expect(statements).toHaveLength(145);
      expect(GATE_STATIC_STATEMENT_COUNT).toBe(145);
      expect(GATE_SNAPSHOT_STATEMENT_COUNT).toBe(146);
      expect(statements.slice(0, 134)).toEqual(
        textureSnapshotStatements(PLAN.texture),
      );
      for (const statement of statements) {
        expect(statement.text.trimStart().startsWith("SELECT")).toBe(true);
        expect(
          /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|GRANT|LOCK)\b/u.test(
            statement.text,
          ),
        ).toBe(false);
      }
      const claimIds = UP.claims.map((item) => item.claim_id);
      expect(claimIds).toHaveLength(9);
      const [
        definitions,
        hostRows,
        rights,
        supports,
        derivation,
        carriers,
        events,
        claims,
        pronunciations,
        renderings,
        evidence,
      ] = statements.slice(134).map((statement) => statement.values);
      expect(defined(definitions)).toHaveLength(4);
      expect((defined(definitions)[0] as string[]).length).toBe(18);
      expect(
        (defined(definitions)[3] as string[]).map(
          (text) => JSON.parse(text) as Obj,
        ),
      ).toEqual(PLAN.definitions.map((item) => item.definition));
      expect(hostRows).toEqual([ATTEMPT]);
      expect(rights).toEqual([
        [GATE_PIN.paraphrase_rights_id, GATE_PIN.quote_rights_id],
      ]);
      expect(supports).toEqual([claimIds]);
      expect(derivation).toEqual([GATE_PIN.derivation_run_id]);
      expect(carriers).toEqual([
        [GATE_PIN.signal_carrier_id, GATE_PIN.continuity_carrier_id],
      ]);
      expect(events).toEqual([claimIds]);
      expect(claims).toEqual([claimIds]);
      expect(pronunciations).toEqual([]);
      expect(renderings).toEqual([]);
      expect(evidence).toEqual([
        UP.evidence.map((item) => item.evidence_unit_id),
      ]);
      expect(UP.evidence).toHaveLength(16);
      // the native comparison: 31 historical + 18 owned expected rows (49) or the 31 alone; eight parallel arrays, every column, jsonb as text
      const rows = ownedRowsOf(PLAN, evaluateGateComponent(INPUTS).rows);
      const full = expectedComparisonStatement([...PLAN.historical, ...rows]);
      expect(full.text).toBe(EXPECTED_TEXT);
      expect(full.values).toHaveLength(8);
      for (const list of full.values)
        expect(list as unknown[]).toHaveLength(49);
      expect((full.values[0] as number[])[48]).toBe(49);
      expect((full.values[1] as string[]).slice(0, 31)).toEqual(
        PLAN.historical.map((row) => row.gate_result_id),
      );
      expect((full.values[1] as string[]).slice(31)).toEqual([...RESULT_IDS]);
      expect(JSON.parse((full.values[6] as string[])[34] ?? "null")).toEqual(
        DEF04,
      );
      const history = expectedComparisonStatement(PLAN.historical);
      for (const list of history.values)
        expect(list as unknown[]).toHaveLength(31);
      expect(/\b(?:INSERT|UPDATE|DELETE)\b/u.test(full.text)).toBe(false);
      // the count projection subtracts exactly the owned rows from `gate_results` and nothing else
      const db = new GateDb(OWNED_STORED);
      const staged = stageGateSnapshot(PLAN, staticResults(db, db.rows));
      const counts = new Map(
        staged.texture.counts.map((row) => [String(row.t), row.n]),
      );
      expect(counts.get("gate_results")).toBe(62 + 18);
      const projected = projectGateCounts(staged.texture, 18);
      const after = new Map(
        projected.counts.map((row) => [String(row.t), row.n]),
      );
      expect(after.get("gate_results")).toBe(62);
      for (const [name, n] of counts)
        if (name !== "gate_results") expect(after.get(name), name).toBe(n);
      expect(projectGateCounts(staged.texture, 0)).toBe(staged.texture);
      expect(
        staged.texture.counts.find((row) => row.t === "gate_results")?.n,
      ).toBe(80); // the input is not mutated
      // the fact parser: nine results in, the same nine facts out; a wrong shape is a shape error, never a default
      const results = staticResults(new GateDb(), new GateDb().rows);
      const facts = parseGateFacts(results.slice(136), PLAN);
      expect(facts.claims).toHaveLength(9);
      expect(facts.supports).toHaveLength(9);
      expect(facts.evidence).toHaveLength(16);
      expect(facts.carriers).toHaveLength(2);
      expect(facts.rights).toHaveLength(2);
      expect(() => parseGateFacts(results.slice(136, 144), PLAN)).toThrow();
      expect(() =>
        parseGateFacts(
          [...results.slice(136, 141), [], ...results.slice(142)],
          PLAN,
        ),
      ).toThrow();
    },
    T,
  );

  // ---- the classifier --------------------------------------------------------------------------------------------------------------------------------------
  it(
    "GU24 classifier: G0/G18, owned 1-17, history, owned conflict by column, stale, foreign, definition drift, precedence, texture states and projection strictness",
    () => {
      expect(classify(new GateDb())).toEqual({
        kind: "state",
        gate: 0,
        texture: 4,
      });
      expect(classify(new GateDb(OWNED_STORED))).toEqual({
        kind: "state",
        gate: 18,
        texture: 4,
      });
      expect(classify(new GateDb(OWNED_STORED), "final")).toEqual({
        kind: "state",
        gate: 18,
        texture: 4,
      });
      expect(stopRow(classify(new GateDb(), "final")).code).toBe(
        "gate_final_state_mismatch",
      );
      // owned rows 1..17: refused, never repaired
      for (let k = 1; k <= 17; k += 1)
        expect(
          stopRow(classify(new GateDb(OWNED_STORED.slice(0, k)))),
          `k=${String(k)}`,
        ).toEqual({
          code: "gate_unexpected_state",
          detail: { conflict: { row: "gate_results", kind: "owned_partial" } },
        });
      // history missing / tampered (any column of a historical row)
      const first = defined(PLAN.historical[0]);
      const missing = new GateDb();
      missing.rows.delete(first.gate_result_id);
      expect(stopRow(classify(missing)).code).toBe("gate_history_mismatch");
      for (const edit of [
        (row: StoredRow) => (row.outcome = "fail"),
        (row: StoredRow) => (row.result = { ...row.result, changed: true }),
        (row: StoredRow) => (row.created_at = "2026-09-27T13:06:01Z"),
        (row: StoredRow) =>
          (row.input_fingerprint = STALE_CONTROLS.parent_bound),
      ]) {
        const tampered = new GateDb();
        edit(defined(tampered.rows.get(first.gate_result_id)));
        expect(stopRow(classify(tampered)).code).toBe("gate_history_mismatch");
      }
      // owned conflict: a planned id present with any column unequal (including the retained created_at)
      const conflicts: ((row: StoredRow) => void)[] = [
        (row) => (row.outcome = row.outcome === "pass" ? "fail" : "pass"),
        (row) => (row.result = { ...row.result, facts: { examined: 0 } }),
        (row) => (row.created_at = "2026-10-21T12:00:11Z"),
        (row) => (row.input_fingerprint = STALE_CONTROLS.parent_bound),
        (row) => (row.gate_definition_id = gateDefinitionId(18)),
        (row) => (row.attempt_id = "6fc595be-0000-4000-8000-000000000001"),
      ];
      for (const edit of conflicts) {
        const stored = OWNED_STORED.map((row) => structuredClone(row));
        edit(defined(stored[0]));
        expect(stopRow(classify(new GateDb(stored)))).toEqual({
          code: "gate_result_conflict",
          detail: {
            conflict: {
              row: "gate_results",
              kind: "same_id_different_content",
            },
          },
        });
      }
      // stale (a claims/writing definition at another fingerprint) and foreign (unknown id at F, or any unknown host row)
      const stray = (over: Partial<StoredRow>): StoredRow => ({
        gate_result_id: "00000000-0000-4000-8000-0000000000f1",
        gate_definition_id: gateDefinitionId(1),
        attempt_id: ATTEMPT,
        input_fingerprint: STALE_CONTROLS.parent_bound,
        outcome: "pass",
        result: {},
        created_at: CREATED_AT,
        ...over,
      });
      expect(stopRow(classify(new GateDb([stray({})]))).code).toBe(
        "gate_result_stale",
      );
      expect(
        stopRow(
          classify(new GateDb([stray({ input_fingerprint: FINGERPRINT })])),
        ).code,
      ).toBe("gate_result_foreign");
      expect(
        stopRow(
          classify(
            new GateDb([
              stray({
                gate_definition_id: "d1250019-0000-4000-8000-000000000031",
              }),
            ]),
          ),
        ).code,
      ).toBe("gate_result_foreign");
      // definition drift: each field of the complete definition, the name, the version and a missing row
      for (const field of [
        "default_severity",
        "gate_class",
        "policy",
        "gate_key",
      ]) {
        const db = new GateDb();
        const definition = defined(
          db.definitions.get(gateDefinitionId(4)),
        ).definition;
        definition[field] = `${String(definition[field])}-drift`;
        expect(stopRow(classify(db)).code, field).toBe(
          "gate_definitions_mismatch",
        );
      }
      const renamed = new GateDb();
      defined(renamed.definitions.get(gateDefinitionId(2))).gate_name =
        "claims.renamed";
      expect(stopRow(classify(renamed)).code).toBe("gate_definitions_mismatch");
      const versioned = new GateDb();
      defined(versioned.definitions.get(gateDefinitionId(2))).version = "2";
      expect(stopRow(classify(versioned)).code).toBe(
        "gate_definitions_mismatch",
      );
      const absent = new GateDb();
      absent.definitions.delete(gateDefinitionId(18));
      expect(stopRow(classify(absent)).code).toBe("gate_definitions_mismatch");
      // multi-defect precedence: definitions, history, mapping/precondition, owned conflict, stale, foreign, owned partial
      const stacked = new GateDb(
        OWNED_STORED.slice(0, 3).map((row) => structuredClone(row)),
      );
      const code = (): string => stopRow(classify(stacked)).code;
      defined(stacked.definitions.get(gateDefinitionId(1))).version = "9";
      defined(stacked.rows.get(first.gate_result_id)).outcome = "fail";
      stacked.rows.set(stray({}).gate_result_id, stray({}));
      stacked.rows.set(
        "00000000-0000-4000-8000-0000000000f2",
        stray({
          gate_result_id: "00000000-0000-4000-8000-0000000000f2",
          input_fingerprint: FINGERPRINT,
        }),
      );
      defined(stacked.rows.get(RESULT_IDS[0] ?? "")).outcome = "fail";
      expect(code()).toBe("gate_definitions_mismatch");
      defined(stacked.definitions.get(gateDefinitionId(1))).version = "1";
      expect(code()).toBe("gate_history_mismatch");
      defined(stacked.rows.get(first.gate_result_id)).outcome = "pass";
      expect(code()).toBe("gate_result_conflict");
      defined(stacked.rows.get(RESULT_IDS[0] ?? "")).outcome = defined(
        OWNED_STORED[0],
      ).outcome;
      expect(code()).toBe("gate_result_stale");
      stacked.rows.delete(stray({}).gate_result_id);
      expect(code()).toBe("gate_result_foreign");
      stacked.rows.delete("00000000-0000-4000-8000-0000000000f2");
      expect(code()).toBe("gate_unexpected_state");
      // the texture state: incomplete texture is reported, not completed
      for (const state of [0, 1, 2, 3] as const) {
        const db = new GateDb();
        db.textureState = state;
        expect(stopRow(classify(db)), `T${String(state)}`).toEqual({
          code: "gate_texture_incomplete",
          detail: { texture_state: state },
        });
      }
      // projection strictness: only exact owned rows are subtracted; unrelated drift stays the texture classifier's own stop
      const drift = new GateDb(OWNED_STORED);
      drift.otherRows += 1;
      expect(stopRow(classify(drift))).toEqual({
        code: "gate_upstream_stopped",
        detail: { upstream_code: "texture_unexpected_state" },
      });
      const fewer = new GateDb();
      fewer.otherRows -= 1;
      expect(stopRow(classify(fewer)).detail).toEqual({
        upstream_code: "texture_unexpected_state",
      });
      expect(
        stopRow(
          classify(new GateDb(), "preflight", (results) => {
            const counts = defined(results[133]);
            const row = defined(counts.find((item) => item.t === "claims"));
            row.n = Number(row.n) + 1;
          }),
        ).detail,
      ).toEqual({ upstream_code: "texture_unexpected_state" });
      // a failed classification never carries a candidate row into a token
      const { raw, candidate } = rawOf(new GateDb(OWNED_STORED.slice(0, 5)));
      expect(candidate.kind).toBe("ready");
      expect(
        isOwnedGateEvaluation(
          classifyGateRaw(raw, PLAN, candidate, "preflight"),
        ),
      ).toBe(false);
    },
    T,
  );

  // ---- stop and return shapes -------------------------------------------------------------------------------------------------------------------------
  it(
    "GU25 stop and return shapes: 20 closed codes, exact key sets, no message or cause, the recorded summary and the coverage register (H01 included)",
    () => {
      expect(GATE_STOP_CODES).toHaveLength(20);
      expect(new Set(GATE_STOP_CODES).size).toBe(20);
      const base = [
        "cleanup",
        "code",
        "durable",
        "kind",
        "reconciled",
        "stage",
        "upstream",
        "writes_attempted",
      ];
      for (const code of GATE_STOP_CODES) {
        const stop = gateStopOf(initialGateContext(), "preconditions", code);
        expect(Object.keys(stop).sort(), code).toEqual(base);
        expect(stop).toEqual({
          kind: "stopped",
          stage: "preconditions",
          code,
          writes_attempted: false,
          upstream: {
            pass1: "unknown",
            critic: "unknown",
            revision: "unknown",
          },
          durable: { gate: "unknown", texture: "unknown" },
          reconciled: false,
          cleanup: { attached_errors: 0, complete: true },
        });
        expect(Object.isFrozen(stop)).toBe(true);
        expect(JSON.stringify(stop)).not.toMatch(
          /message|cause|SELECT|INSERT|postgres/iu,
        );
      }
      const detailed = gateStopOf(
        {
          w: true,
          gate: "none_observed",
          texture: "present",
          u: { pass1: "present", critic: "present", revision: "present" },
        },
        "record",
        "gate_command_connection",
        { connection: { phase: "commit", commit_outcome: "unknown" } },
        { attached_errors: 2, complete: true },
        { gate: "unknown" },
      );
      expect(detailed).toEqual({
        kind: "stopped",
        stage: "record",
        code: "gate_command_connection",
        writes_attempted: true,
        upstream: { pass1: "present", critic: "present", revision: "present" },
        durable: { gate: "unknown", texture: "present" },
        reconciled: false,
        cleanup: { attached_errors: 2, complete: true },
        connection: { phase: "commit", commit_outcome: "unknown" },
      });
      // `present` survives a later failure; `unknown` wins over `none_observed`
      expect(
        gateStopOf(
          { w: true, gate: "present", texture: "present", u: PRESENT3 },
          "final_check",
          "gate_snapshot_failed",
          {},
          undefined,
          { gate: "unknown" },
        ).durable,
      ).toEqual({ gate: "present", texture: "present" });
      // the recorded summary of the pinned chain (derived expectation)
      const rows = ownedRowsOf(PLAN, evaluateGateComponent(INPUTS).rows);
      const evaluation = evaluateGateComponent(INPUTS);
      expect(evaluation.coverage.map((entry) => entry.id)).toEqual([
        ...COVERAGE_IDS,
      ]);
      const coverage = (id: string): unknown =>
        evaluation.coverage.find((entry) => entry.id === id);
      expect(coverage("C13")).toEqual({
        id: "C13",
        status: "established_with_limits",
        limits: [
          "historical_visibility_unprovable",
          "frozen_ceiling_unavailable",
        ],
      });
      expect(coverage("C14")).toEqual({ id: "C14", status: "established" });
      expect(coverage("H01")).toEqual({
        id: "H01",
        status: "established_with_limits",
        limits: ["show_roster_document_absent"],
      });
      expect(coverage("H04")).toEqual({
        id: "H04",
        status: "not_established_required",
        limits: ["nonnumeric_unmarked_factual_content"],
      });
      expect(coverage("H13")).toEqual({
        id: "H13",
        status: "not_established_required",
        limits: ["mode_forbidden_rule_set_absent"],
      });
      expect(coverage("H14")).toEqual({
        id: "H14",
        status: "inapplicable_witnessed",
      });
      expect(coverage("X01")).toEqual({
        id: "X01",
        status: "deferred_semantic",
        limits: ["semantic"],
      });
      expect(evaluation.warnings).toEqual([]);
      expect(evaluation.preconditions.ok).toBe(true);
      expect(rows).toHaveLength(18);
      expect([...GATE_GATES_NOT_RUN]).toEqual([
        "implied_access_lint",
        "semantic_audit",
        "performance_direction",
        "performance_gate",
        "render_*",
        "assembly_*",
        "ready_*",
      ]);
      expect(GATE_NOT_PROVEN).toContain("claims_writing_acceptance");
      expect(GATE_NOT_PROVEN).toContain("derivation_count_reexecution");
      expect(GATE_SURFACES).toEqual([
        "rows",
        "warnings",
        "coverage",
        "stop",
        "summary",
      ]);
    },
    T,
  );

  // ---- the writer through the scripted router ---------------------------------------------------------------------------------------------------------
  const LEDGER = { gu26: 0, gu27: 0 };
  const WRITE_CONTEXT = { ...initialGateContext(), w: true };
  const boom = (code: string, message: string): Error =>
    withCode(message, code);

  it(
    "GU26 writer through a scripted router, 9 subcases: create 65, converged 9, conflict 9, unnamed SQL error 25, connect rejection 0, loss at 30, COMMIT lost 65, ordinary COMMIT error 66, release failure 65",
    async () => {
      const owned = await ownedEvaluation();
      const record = (
        pool: ScriptPool,
      ): ReturnType<typeof recordClaimsWritingGate> =>
        recordClaimsWritingGate(asPool(pool), PLAN, owned);
      // 1: create — 8 prefix statements, 18 x (SAVEPOINT, INSERT, RELEASE), 2 reconcile reads, COMMIT
      const create = new ScriptPool();
      expect(await record(create)).toEqual({ kind: "created" });
      expect(create.total()).toBe(65);
      LEDGER.gu26 += create.total();
      const log = create.all();
      expect(log[0]).toBe("BEGIN ISOLATION LEVEL READ COMMITTED");
      expect(log[1]).toBe(
        "SELECT current_setting('transaction_isolation') AS level",
      );
      expect(log[2]).toContain("pg_advisory_xact_lock");
      expect(log[64]).toBe("COMMIT");
      expect(
        log.filter((text) => text.startsWith("INSERT INTO gate_results")),
      ).toHaveLength(18);
      expect(
        log.filter((text) => text.startsWith("SAVEPOINT sp_")),
      ).toHaveLength(18);
      expect(
        log.filter((text) => text.startsWith("RELEASE SAVEPOINT sp_")),
      ).toHaveLength(18);
      expect(log.slice(8, 11).map((text) => text.split(" ")[0])).toEqual([
        "SAVEPOINT",
        "INSERT",
        "RELEASE",
      ]);
      expect(create.db.rows.size).toBe(49);
      expect(create.unexpected).toEqual([]);
      expect(defined(create.db.rows.get(RESULT_IDS[3] ?? "")).result).toEqual(
        DEF04,
      );
      expect(defined(create.db.rows.get(RESULT_IDS[9] ?? "")).result).toEqual(
        DEF10,
      );
      // 2: converged — the complete prefix, then COMMIT
      const converged = new ScriptPool(new GateDb(OWNED_STORED));
      expect(await record(converged)).toEqual({ kind: "converged" });
      expect(converged.total()).toBe(9);
      LEDGER.gu26 += converged.total();
      expect(converged.all()[8]).toBe("COMMIT");
      expect(converged.all().some((text) => text.startsWith("INSERT"))).toBe(
        false,
      );
      // 3: conflict — the complete prefix, then ROLLBACK; nothing is written
      const other = OWNED_STORED.map((row) => structuredClone(row));
      defined(other[0]).outcome = "fail";
      const conflict = new ScriptPool(new GateDb(other));
      expect(await record(conflict)).toEqual(
        gateStopOf(WRITE_CONTEXT, "record", "gate_result_conflict", {
          conflict: { row: "gate_results", kind: "same_id_different_content" },
        }),
      );
      expect(conflict.total()).toBe(9);
      LEDGER.gu26 += conflict.total();
      expect(conflict.all()[8]).toBe("ROLLBACK");
      expect(conflict.db.rows.size).toBe(49);
      // 4: an unnamed SQL error at the 5th insert propagates (through the command helper's projection) after the savepoint and outer cleanup
      const failing = new ScriptPool();
      let inserts = 0;
      failing.hook = (call): void => {
        if (call.text.startsWith("INSERT INTO gate_results")) {
          inserts += 1;
          if (inserts === 5) throw boom("XX000", "insert failed");
        }
      };
      const insertError: unknown = await record(failing).catch(
        (error: unknown) => error,
      );
      expect(insertError).toBeInstanceOf(Error);
      expect(insertError).not.toBeInstanceOf(CommandConnectionError);
      expect(insertError).toMatchObject({
        message: "insert failed",
        code: "XX000",
      });
      expect(failing.total()).toBe(25);
      LEDGER.gu26 += failing.total();
      expect(failing.all().slice(21)).toEqual([
        failing.all()[21],
        "ROLLBACK TO SAVEPOINT sp_5",
        "RELEASE SAVEPOINT sp_5",
        "ROLLBACK",
      ]);
      expect(failing.db.rows.size).toBe(31);
      // 5: a rejected connect() acquired nothing: the original error, zero driver calls
      const refused = new ScriptPool();
      const connectError = new Error("connect failed");
      refused.connectError = connectError;
      await expect(record(refused)).rejects.toBe(connectError);
      expect(refused.total()).toBe(0);
      // 6: a lost session before COMMIT (statement 30) is owned: not_attempted, no cleanup ROLLBACK on the lost session, client destroyed
      const lost = new ScriptPool();
      lost.hook = (call): void => {
        if (call.ordinal === 30)
          throw boom(
            "57P01",
            "terminating connection due to administrator command",
          );
      };
      expect(await record(lost)).toEqual(
        gateStopOf(
          WRITE_CONTEXT,
          "record",
          "gate_command_connection",
          {
            connection: {
              phase: "before_commit",
              commit_outcome: "not_attempted",
            },
          },
          { attached_errors: 0, complete: true },
          { gate: "unknown" },
        ),
      );
      expect(lost.total()).toBe(30);
      LEDGER.gu26 += lost.total();
      expect(lost.all().includes("ROLLBACK")).toBe(false);
      expect(defined(lost.clients[0]).releases).toEqual([true]);
      // 7: COMMIT sent and its acknowledgment lost: unknown, never assumed committed or rolled back
      const commitLost = new ScriptPool();
      commitLost.hook = (call): void => {
        if (call.text === "COMMIT")
          throw boom(
            "57P01",
            "terminating connection due to administrator command",
          );
      };
      expect(await record(commitLost)).toEqual(
        gateStopOf(
          WRITE_CONTEXT,
          "record",
          "gate_command_connection",
          { connection: { phase: "commit", commit_outcome: "unknown" } },
          { attached_errors: 0, complete: true },
          { gate: "unknown" },
        ),
      );
      expect(commitLost.total()).toBe(65);
      LEDGER.gu26 += commitLost.total();
      // 8: an ordinary COMMIT error is unowned: the raw error, the outer cleanup ROLLBACK, no durability claim
      const commitError = new ScriptPool();
      const ordinary = boom("XX001", "commit failed");
      commitError.hook = (call): void => {
        if (call.text === "COMMIT") throw ordinary;
      };
      await expect(record(commitError)).rejects.toBe(ordinary);
      expect(commitError.total()).toBe(66);
      LEDGER.gu26 += commitError.total();
      expect(commitError.all()[65]).toBe("ROLLBACK");
      // 9: COMMIT acknowledged, then release throws: the raw release error although the rows are durable
      const releaseFails = new ScriptPool();
      const releaseError = new Error("release failed");
      releaseFails.hook = (call, client): void => {
        if (call.ordinal === 1) client.releaseThrows = releaseError;
      };
      await expect(record(releaseFails)).rejects.toBe(releaseError);
      expect(releaseFails.total()).toBe(65);
      LEDGER.gu26 += releaseFails.total();
      expect(releaseFails.db.rows.size).toBe(49);
      expect(LEDGER.gu26).toBe(334);
    },
    T,
  );

  // ---- the orchestrator ------------------------------------------------------------------------------------------------------------------------------
  it(
    "GU27 orchestrator over the scripted router, 9 runs: O1 create (unseamed, 361), O2 converge, O3 release-only snapshot failure, O4 stranded T2, O5 owned partial, O6 stale row, O7 failed write, O8 COMMIT lost, O9 final snapshot connect failure",
    async () => {
      const seamed = { texturePlan: PLAN.texture, pack: PACK };
      const present = {
        pass1: "present",
        critic: "present",
        revision: "present",
      } as const;
      const initial = initialGateContext();
      // O1: the unseamed production path (one real texture build); preflight 148 + write 65 + final 148
      const o1 = new ScriptPool();
      const created = await runG("real", asPool(o1), GATE_INV, { pack: PACK });
      expect(o1.total()).toBe(361);
      LEDGER.gu27 += o1.total();
      expect(created.kind).toBe("recorded");
      if (created.kind !== "recorded") throw new Error("O1 must record");
      expect(created.convergence).toBe("created");
      expect(created.aggregate).toBe("failed");
      expect(created.counts).toEqual({
        rows_recorded: 18,
        definitions_passed: 16,
        definitions_failed: 2,
      });
      expect(
        created.rows.map((row) => [row.gate_result_id, row.outcome]),
      ).toEqual(
        RESULT_IDS.map((id, index) => [
          id,
          index === 3 || index === 9 ? "fail" : "pass",
        ]),
      );
      expect(created.rows[3]).toMatchObject({
        key: "claims.value_support",
        violations: 1,
        proof_gaps: 1,
      });
      expect(created.rows[9]).toMatchObject({
        key: "claims.desk_derivation",
        violations: 0,
        proof_gaps: 1,
      });
      expect(created.identities).toEqual({
        fingerprint: FINGERPRINT,
        script_hash: CHILD_HASH,
        parent_script_hash: PARENT_HASH,
        script_version_id: GATE_PIN.child_script_version_id,
        attempt_id: ATTEMPT,
      });
      expect(created.durable).toEqual({ gate: "present", texture: "present" });
      expect(created.reconciled).toBe(true);
      expect(created.preconditions).toEqual({
        claims13: {
          verified: 9,
          events: 0,
          limits: [
            "historical_visibility_unprovable",
            "frozen_ceiling_unavailable",
          ],
        },
        claims14: { verified: 9 },
      });
      expect(created.warnings).toEqual([]);
      expect(
        created.coverage
          .filter((entry) => entry.status === "not_established_required")
          .map((entry) => entry.id),
      ).toEqual(["H04", "H13"]);
      expect([...created.gates_not_run]).toEqual([...GATE_GATES_NOT_RUN]);
      expect([...created.not_proven]).toEqual([...GATE_NOT_PROVEN]);
      expect(o1.db.rows.size).toBe(49);
      expect(defined(o1.db.rows.get(RESULT_IDS[3] ?? "")).result).toEqual(
        DEF04,
      );
      expect(o1.all().filter((text) => text.startsWith("INSERT"))).toHaveLength(
        18,
      );
      // O2: re-entry with the 18 rows present converges: one snapshot, no write, no final snapshot
      const o2 = new ScriptPool(new GateDb(OWNED_STORED));
      const converged = await runG("seamed", asPool(o2), GATE_INV, seamed);
      expect(o2.total()).toBe(148);
      LEDGER.gu27 += o2.total();
      expect(converged.kind).toBe("recorded");
      expect(converged.kind === "recorded" ? converged.convergence : "").toBe(
        "converged",
      );
      expect(o2.clients).toHaveLength(1);
      expect(o2.all().some((text) => text.startsWith("INSERT"))).toBe(false);
      // O3: a release-only failure after the 148th driver call: the snapshot is discarded, cleanup is counted, nothing is minted
      const o3 = new ScriptPool();
      o3.hook = (call, client): void => {
        if (call.ordinal === 1)
          client.releaseThrows = new Error("release failed");
      };
      expect(await runG("seamed", asPool(o3), GATE_INV, seamed)).toEqual(
        gateStopOf(
          initial,
          "preconditions",
          "gate_snapshot_failed",
          {},
          { attached_errors: 1, complete: true },
        ),
      );
      expect(o3.total()).toBe(148);
      LEDGER.gu27 += o3.total();
      expect(o3.all().includes("ROLLBACK")).toBe(false);
      expect(defined(o3.clients[0]).releases).toEqual([true]);
      // O4: a stranded T2 is reported, never completed
      const stranded = new GateDb();
      stranded.textureState = 2;
      const o4 = new ScriptPool(stranded);
      expect(await runG("seamed", asPool(o4), GATE_INV, seamed)).toEqual(
        gateStopOf(initial, "preconditions", "gate_texture_incomplete", {
          texture_state: 2,
        }),
      );
      expect(o4.total()).toBe(148);
      LEDGER.gu27 += o4.total();
      // O5: a partial owned set is refused, never repaired
      const o5 = new ScriptPool(new GateDb(OWNED_STORED.slice(0, 5)));
      expect(await runG("seamed", asPool(o5), GATE_INV, seamed)).toEqual(
        gateStopOf(initial, "preconditions", "gate_unexpected_state", {
          conflict: { row: "gate_results", kind: "owned_partial" },
        }),
      );
      expect(o5.total()).toBe(148);
      LEDGER.gu27 += o5.total();
      // O6: a row at the parent-bound fingerprint is stale
      const o6 = new ScriptPool(
        new GateDb([
          {
            gate_result_id: "00000000-0000-4000-8000-0000000000f1",
            gate_definition_id: gateDefinitionId(1),
            attempt_id: ATTEMPT,
            input_fingerprint: STALE_CONTROLS.parent_bound,
            outcome: "pass",
            result: {},
            created_at: CREATED_AT,
          },
        ]),
      );
      expect(await runG("seamed", asPool(o6), GATE_INV, seamed)).toEqual(
        gateStopOf(initial, "preconditions", "gate_result_stale", {
          conflict: { row: "gate_results", kind: "stale_fingerprint" },
        }),
      );
      expect(o6.total()).toBe(148);
      LEDGER.gu27 += o6.total();
      // O7: an unnamed SQL error during the write propagates unchanged in meaning; the preflight snapshot was read first
      const o7 = new ScriptPool();
      let inserts = 0;
      o7.hook = (call): void => {
        if (call.text.startsWith("INSERT INTO gate_results")) {
          inserts += 1;
          if (inserts === 5) throw boom("XX000", "insert failed");
        }
      };
      await expect(
        runG("seamed", asPool(o7), GATE_INV, seamed),
      ).rejects.toMatchObject({ message: "insert failed", code: "XX000" });
      expect(o7.total()).toBe(173);
      LEDGER.gu27 += o7.total();
      expect(o7.db.rows.size).toBe(31);
      // O8: COMMIT sent and its acknowledgment lost: unknown durability, no final snapshot, no inference
      const o8 = new ScriptPool();
      o8.hook = (call, client): void => {
        if (call.text === "COMMIT" && client.mode === "write")
          throw boom(
            "57P01",
            "terminating connection due to administrator command",
          );
      };
      expect(await runG("seamed", asPool(o8), GATE_INV, seamed)).toEqual(
        gateStopOf(
          { w: true, gate: "none_observed", texture: "present", u: present },
          "record",
          "gate_command_connection",
          { connection: { phase: "commit", commit_outcome: "unknown" } },
          { attached_errors: 0, complete: true },
          { gate: "unknown" },
        ),
      );
      expect(o8.total()).toBe(213);
      LEDGER.gu27 += o8.total();
      // O9: the acknowledged create is retained when the final snapshot cannot even connect
      const o9 = new ScriptPool();
      o9.failConnectAt = 3;
      expect(await runG("seamed", asPool(o9), GATE_INV, seamed)).toEqual(
        gateStopOf(
          { w: true, gate: "present", texture: "present", u: present },
          "final_check",
          "gate_snapshot_failed",
          {},
          { attached_errors: 0, complete: true },
        ),
      );
      expect(o9.total()).toBe(213);
      LEDGER.gu27 += o9.total();
      expect(o9.db.rows.size).toBe(49);
      expect(LEDGER.gu27).toBe(1700);
    },
    T,
  );

  // ---- the withheld-text guard ------------------------------------------------------------------------------------------------------------------------
  it(
    "GU28 withheld-text guard: a 24-code-point original run is found on every output surface, keys included, in the fixed order; constant error messages",
    async () => {
      const original = defined(UP.originals[0]);
      const run = Array.from(original).slice(0, 24).join("");
      const shorter = Array.from(original).slice(0, 23).join("");
      expect(Array.from(run)).toHaveLength(24);
      for (const surface of GATE_SURFACES) {
        expect(
          scanGateSurfaces(
            { [surface]: { note: [`x ${run} y`] } },
            UP.originals,
          ),
          surface,
        ).toBe(surface);
        expect(
          scanGateSurfaces({ [surface]: { [run]: 1 } }, UP.originals),
          `${surface} key`,
        ).toBe(surface);
        expect(
          scanGateSurfaces({ [surface]: { note: shorter } }, UP.originals),
          `${surface} short`,
        ).toBeNull();
      }
      expect(
        scanGateSurfaces({ summary: run, warnings: run }, UP.originals),
      ).toBe("warnings");
      expect(scanGateSurfaces({}, UP.originals)).toBeNull();
      // the real surfaces of the pinned chain carry no run: rows, warnings, coverage and the summary
      const owned = await ownedEvaluation();
      expect(
        scanGateSurfaces(
          {
            rows: owned.rows,
            warnings: owned.warnings,
            coverage: owned.coverage,
            summary: recordedOf(owned, "created"),
            stop: gateStopOf(
              initialGateContext(),
              "record",
              "gate_result_conflict",
            ),
          },
          UP.originals,
        ),
      ).toBeNull();
      // programmer errors carry constant text, never data
      const forbiddenPool = forbidden();
      for (const attempt of [
        () =>
          recordClaimsWritingGate(forbiddenPool.pool, {} as GatePlan, owned),
        () =>
          recordClaimsWritingGate(
            forbiddenPool.pool,
            PLAN,
            {} as OwnedEvaluation,
          ),
        () => readGateSnapshot(forbiddenPool.pool, {} as GatePlan, "preflight"),
      ])
        await expect(attempt()).rejects.toThrow(
          /^an? (?:owned evaluation of this plan|admitted gate plan) is required$/u,
        );
      expect(forbiddenPool.uses()).toBe(0);
    },
    T,
  );

  // ---- zero provider -----------------------------------------------------------------------------------------------------------------------------------
  it(
    "GU29 zero provider: no provider execution or provider/model write; every INSERT targets gate_results; the unchanged reads of provider rows are allowed",
    () => {
      const log = DRIVER_LOG;
      expect(log.length).toBeGreaterThan(2000);
      const writes = log.filter((text) =>
        /^\s*(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|CREATE|ALTER|DROP)\b/iu.test(
          text,
        ),
      );
      expect(writes.length).toBeGreaterThan(0);
      for (const text of writes)
        expect(
          text.startsWith("INSERT INTO gate_results"),
          text.slice(0, 40),
        ).toBe(true);
      expect(
        log.some((text) =>
          /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:provider_calls|provider_call_events|model_runs)\b/iu.test(
            text,
          ),
        ),
      ).toBe(false);
      // the unchanged texture snapshot legitimately SELECTs those rows
      expect(log.some((text) => /\bFROM provider_calls\b/u.test(text))).toBe(
        true,
      );
      expect(
        log.some((text) => /\bFROM provider_call_events\b/u.test(text)),
      ).toBe(true);
      const source = readFileSync(
        new URL("../../src/runtime/claims-writing-gate.ts", import.meta.url),
        "utf8",
      );
      expect(source).not.toMatch(
        /executeProviderCall|\.\/provider\.js|\bfetch\(|https?:\/\/|child_process/u,
      );
    },
    T,
  );

  // ---- the counted doors -----------------------------------------------------------------------------------------------------------------------------
  it(
    "GU30 totals asserted at the doors: real builds 4, gate runs 9, planner doors 12, API-level pack opens 17, scripted driver calls 2,182 (148 + 334 + 1,700)",
    () => {
      expect(CALLS.builds).toBe(4); // PLAN, the duplicate-anchor specimen, the synthetic child, and the unseamed O1
      expect(CALLS.run).toBe(9);
      expect(CALLS.plan).toBe(12); // PLAN, ten GU02 doors, the second plan of GU22 (the nine runs plan internally)
      expect(1 + 4 * CALLS.builds).toBe(17); // one PACK open plus four upstream opens per real texture build (API calls, not native processes)
      expect(LEDGER.gu26).toBe(334);
      expect(LEDGER.gu27).toBe(1700);
      expect(DRIVER.calls).toBe(148 + 334 + 1700);
      expect(DRIVER.calls).toBe(2182);
      expect(DRIVER_LOG).toHaveLength(2182);
    },
    T,
  );
});
