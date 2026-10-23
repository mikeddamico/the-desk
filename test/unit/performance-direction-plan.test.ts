// Performance Direction seam, Scope A (unit, database-free): the strict candidate grammar, the Performance-owned reader and its refusal over ONE narrow
// scripted SQL router (no database, provider, network or live model), the seven explicit-input pure evaluators with the closed result profile, the
// supplied-snapshot classifier and the pure fingerprint arithmetic. Twenty grouped cases (PU01-PU20); nested witnesses are uncounted subcases. ONE real pack
// open and ONE real chain plan (4 upstream opens) are shared by every case: no case opens a pack. Expected values are authored from the design record
// (never read from the implementation). Nothing here is a model result, a performance-quality claim or a statement about audit readiness. The last case
// asserts the counted doors (API opens, plan builds, member reads and scripted driver calls: 1,571, decomposed there) literally.
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";

import type { Pool } from "pg";
import { describe, expect, it } from "vitest";

import { openFixturePack, type Pack } from "../../src/fixture/pack.js";
import {
  performanceDirectionHash,
  semanticAuditResultHash,
  turnAnchorMap,
} from "../../src/identity/artifacts.js";
import { domainHash } from "../../src/identity/canonical-json.js";
import { fingerprint } from "../../src/identity/fingerprints.js";
import { ProfileRejected } from "../../src/identity/profile-errors.js";
import {
  GATE_PIN,
  GATE_SNAPSHOT_STATEMENT_COUNT,
  GATE_STOP_CODES,
  aggregateOf,
  classifyGateAcquisition,
  classifyGateRaw,
  evaluateGateComponent,
  evaluateWritingChecks,
  expectedComparisonStatement,
  gateDefinitionId,
  gateRawOf,
  gateSnapshotStatements,
  isGateAcquisition,
  ownedRowsOf,
  planClaimsWritingGate,
  stageGateSnapshot,
  type ComponentInputs,
  type GateClassified,
  type GateFacts,
  type GatePlan,
  type OwnedEvaluation,
} from "../../src/runtime/claims-writing-gate.js";
import { PASS1_OWNED, criticOwned } from "../../src/runtime/craft-critic.js";
import { revisionOwned } from "../../src/runtime/craft-revision.js";
import { KNOWN_OUTCOME_CODES } from "../../src/runtime/observe.js";
import {
  AFFECT_VALUES,
  INTENSITY_VALUES,
  PACE_VALUES,
  PERFORMANCE_DEFINITION_KEYS,
  PERFORMANCE_FACT_KEYS,
  PERFORMANCE_PIN,
  PERFORMANCE_READER_CALLS,
  PERFORMANCE_STOP_CODES,
  STRENGTH_VALUES,
  admissionOf,
  auditInput,
  auditInputFingerprint,
  classifyDirectionRows,
  classifyPerformanceAcquisition,
  evaluatePerformanceGate,
  evaluatePerformanceGates,
  isAdmittedPerformancePlan,
  isClosedPerformanceResult,
  isPerformanceAcquisition,
  isSemanticJson,
  performanceAggregateOf,
  performanceFingerprint,
  planPerformanceDirection,
  readPerformanceSnapshot,
  refusePerformanceDirection,
  sortPerformanceFindings,
  validateDirectionCandidate,
  type DirectionRowPins,
  type DirectionRows,
  type DirectionScript,
  type PerformanceAcquisition,
  type PerformanceFinding,
  type PerformancePlan,
} from "../../src/runtime/performance-direction.js";
import {
  TEXTURE_REWRITE_TABLE,
  textureOwned,
  type TextureState,
} from "../../src/runtime/speech-texture.js";
import {
  PASS1_PIN,
  RESERVATION_FIELDS,
  countTables,
  sameJson,
  utcMicros,
  type PlannedRow,
} from "../../src/runtime/writer-pass1.js";

type Obj = Record<string, unknown>;
const T = 120000; // the shared real plan and scripted routers
const defined = <V>(value: V | undefined): V => {
  if (value === undefined) throw new Error("expected a defined value");
  return value;
};
const records = (value: unknown): Obj[] =>
  Array.isArray(value) ? (value as Obj[]) : [];
const pick = (row: Obj, keys: readonly string[]): Obj => {
  const out: Obj = {};
  for (const key of keys) out[key] = row[key];
  return out;
};

// ---- the pinned oracles, authored from the design records (never computed from the module under test) ---------------------------------------
const ATTEMPT = "e5aaee76-ec19-4917-b293-24a0435b3a92";
const CHILD_HASH =
  "776eefadaa96ae3ef0030e48d15184ac1aa49032695d6e84f03b2ce9f6084fe0";
const CHILD_VERSION = "063cbf1b-c4fa-4254-a63b-343dfd494787";
const PARENT_VERSION = "ee585057-e51a-4dda-9bf9-52ce6c9c683e";
const FINGERPRINT =
  "1be8aaa9d5ac8a5086542065d55275e018eefba78cc0a934c22171d32f76a5ba";
const BRIEF_HASH =
  "36fb22d03300206d3181959a100f2911c2b27d9ff72379f21831d32a4bd5c475";
const PACKAGE_HASH =
  "a8655c0e8bd72094a823b367a0c21cd665d3d99c271341286a92dbdc2ea304ab";
const SPEC = "performance-render-0.1.4";
const UNKNOWN = "00000000-0000-4000-8000-0000000000aa";
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
/** Inert derivation literals (design record Part 5; hypothetical specimens bound to the current script hash, none is an approval). */
const SYN = {
  E0: {
    hash: "f9ee63b51bbf44354d911a739f8378913a383d12d5eebd08a83ff7b2ecc42885",
    performance:
      "3ae205ed9e3d80a4944d0e4ac74b1b248011b6dbf231823df82a329db35ddd4e",
    audit: "ea784112e47f952ae516165f395f948a4617bb73d38b546e4584186b4158e533",
  },
  S1: {
    hash: "c37fcbd371db7c922c1277546dcab5abaecbccfc6f3f3fefad9a3d84791a04a8",
    performance:
      "0d0f964294b8f91af02779eac3c0bc6fd492d714f551047c3218cc6fca496554",
    audit: "c6259f7937731300f6effa6ddf68e6fa85c0dccefeb1ac166d43692b4e976d6a",
  },
  S2: {
    hash: "6cc9ec2e5c2538efaaf48ce495e0f1ba9fa531040c3faf4c6c0370afccc4947b",
    performance:
      "6b8f8f9333f2c9a970403174ae369f70235322750069032faa6dc3ee6257c2f0",
    audit: "4b7fbeb91a1e5ecbfd2e8908dded018c48474b0f7cb68f2e97c0abc2e94e7895",
  },
};
const HIST = {
  direction: "177b9d58cc787b21440170b945aedbe27856c8498097315b0078fed0e4e4ba08",
  performance:
    "d2aab44ebaa4c6e3b36453cc583a982ba19956a553b6c0291d196782361ef525",
  audit: "fef4b240055df690424b35577788004039a2d6f9926789545c9f66857e8eeb1a",
};

// ---- the counted doors ------------------------------------------------------------------------------------------------------------------------------
// ONE API-level pack open here + ONE real chain plan, which opens the pack four times itself (1 + 4 = 5 API opens for the whole file).
const CALLS = { opens: 0, chainBuilds: 0 };
const DRIVER = { calls: 0 };
const MEMBER_LOG: string[] = [];
CALLS.opens += 1;
const PACK = openFixturePack();
const SPY_PACK: Pack = {
  pins: PACK.pins,
  member: (name: string): Buffer => {
    MEMBER_LOG.push(name);
    return PACK.member(name);
  },
  json: (name: string): unknown => PACK.json(name),
  roles: PACK.roles,
  memberNames: PACK.memberNames,
};
CALLS.chainBuilds += 1;
const PLANNED = planClaimsWritingGate(GATE_INV, { pack: PACK });
if (PLANNED.kind !== "planned") throw new Error("the pinned chain must plan");
const PLAN: GatePlan = PLANNED.plan;
const MEMBER_READS_BEFORE = MEMBER_LOG.length;
const PPLAN: PerformancePlan = planPerformanceDirection({
  gatePlan: PLAN,
  pack: SPY_PACK,
});
const PERFORMANCE_PLAN_READS = MEMBER_LOG.slice(MEMBER_READS_BEFORE);
const UP = PLAN.texture.revision.critic.upstream;
const TABLES = (
  PACK.json("foundation_rows_398.json") as { tables: Record<string, Obj[]> }
).tables;
const table = (name: string): Obj[] => defined(TABLES[name]);
const PACKAGE_PAYLOAD = PACK.json("evidence_package.json") as {
  manifest: Obj;
};

// ---- the final script facts shared by the doors ----------------------------------------------------------------------------------------------------
const CHILD = PLAN.texture.script_payload;
const TURNS = records(CHILD.turns);
const plannedRows = (rows: readonly PlannedRow[], name: string): Obj[] =>
  rows
    .filter((item) => item.spec.table === name)
    .map((item) => ({ ...item.row }));
const SEQUENCE = new Map(
  plannedRows(PLAN.texture.t3, "turns").map((row, index) => [
    String(row.turn_id),
    typeof row.sequence === "number" ? row.sequence : index + 1,
  ]),
);
const ANCHORS = turnAnchorMap(TURNS);
const TURN_OF = new Map(
  TURNS.map((turn) => [String(turn.semantic_turn_id), String(turn.turn_id)]),
);
const uuid = (anchor: string): string => defined(TURN_OF.get(anchor));
const SCRIPT_C: DirectionScript = {
  script_hash: CHILD_HASH,
  turns: TURNS.map((turn) => ({
    turn_id: String(turn.turn_id),
    semantic_turn_id: String(turn.semantic_turn_id),
  })),
};
const SCRIPT_E: Obj = {
  recomputed_hash: CHILD_HASH,
  version_id: CHILD_VERSION,
  turns: TURNS.map((turn, index) => ({
    turn_id: turn.turn_id,
    semantic_turn_id: turn.semantic_turn_id,
    sequence: SEQUENCE.get(String(turn.turn_id)) ?? index + 1,
    text: turn.spoken_text,
  })),
  claim_uses: records(CHILD.turn_claim_uses).map((use) => ({
    id: use.turn_claim_use_id,
    turn_id: use.turn_id,
    span_start: use.span_start,
    span_end: use.span_end,
    use_mode: use.use_mode,
  })),
  evidence_uses: records(CHILD.turn_evidence_uses).map((use) => ({
    id: use.turn_evidence_use_id,
    turn_id: use.turn_id,
    span_start: use.span_start,
    span_end: use.span_end,
    use_mode: use.use_mode,
  })),
};
const mk = (
  anchor: string,
  type: string,
  value: unknown,
  strength = "standard",
  timing: string | null = null,
): Obj => ({
  scope_type: "turn",
  scope_ref: uuid(anchor),
  intent_type: type,
  value,
  strength,
  timing_anchor: timing === null ? null : uuid(timing),
});
const candidateOf = (intents: unknown[]): Obj => ({
  script_hash: CHILD_HASH,
  direction_spec_version: SPEC,
  performance_intents: intents,
});
const B0 = [
  mk("t05", "delivery_affect", "curious"),
  mk("t09", "pace", "slower"),
];

// ---- the nine factual results exactly as the snapshot statements return them, projected from the verified pack tables ----------------------------
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
  parent_artifact_hash: GATE_PIN.parent_script_hash,
};

// ---- the scripted database: one narrow SQL router that simulates the gate snapshot (read-only; no write path exists in this scope) ---------------
const CP = PLAN.texture.revision.critic;
const RP = PLAN.texture.revision;
const TP = PLAN.texture;
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
    return name === "gate_results" ? base - 31 + this.rows.size : base;
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
class ScriptClient extends EventEmitter {
  readonly queries: string[] = [];
  readonly releases: unknown[] = [];
  releaseThrows: Error | undefined;
  poolListener = (): void => undefined;
  results: Obj[][] = [];
  next = 0;
  view: ReadonlyMap<string, StoredRow> = new Map();
  constructor(private readonly pool: ScriptPool) {
    super();
  }
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }> {
    this.queries.push(text);
    DRIVER.calls += 1;
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
      this.view = new Map([...db.rows].map(([id, row]) => [id, { ...row }]));
      this.results = staticResults(db, this.view);
      this.pool.mutate?.(this.results);
      this.next = 0;
      return [];
    }
    if (text === "COMMIT" || text === "ROLLBACK") return [];
    if (text === EXPECTED_TEXT) return flagRows(this.view, values ?? []);
    if (this.next < this.results.length) return this.results[this.next++] ?? [];
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
  hook: ((call: Call, client: ScriptClient) => void) | undefined;
  mutate: ((results: Obj[][]) => void) | undefined;
  onClient: ((client: ScriptClient) => void) | undefined;
  constructor(readonly db: GateDb = new GateDb()) {}
  connect(): Promise<ScriptClient> {
    this.connects += 1;
    if (this.connectError !== undefined)
      return Promise.reject(this.connectError);
    const client = new ScriptClient(this);
    this.onClient?.(client);
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
/** A pool that fails on any use (zero-I/O assertions). */
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
const FAULT_HOOK = Symbol.for("the-desk.a5.test-fault-hook");
/** Installs the test fault hook for ONE awaited function and restores the previous hook and flag (inert otherwise). */
const withFaults = async <S>(
  hook: (point: string) => unknown,
  fn: () => Promise<S>,
): Promise<S> => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, FAULT_HOOK);
  const flag = process.env.DESK_TEST_FAULTS;
  process.env.DESK_TEST_FAULTS = "1";
  Object.defineProperty(globalThis, FAULT_HOOK, {
    configurable: true,
    value: async (point: string): Promise<void> => {
      await hook(point);
    },
  });
  try {
    return await fn();
  } finally {
    if (previous) Object.defineProperty(globalThis, FAULT_HOOK, previous);
    else Reflect.deleteProperty(globalThis, FAULT_HOOK);
    if (flag === undefined) delete process.env.DESK_TEST_FAULTS;
    else process.env.DESK_TEST_FAULTS = flag;
  }
};
/** The eighteen owned rows of the pinned chain exactly as the single database writer would store them. */
const OWNED_STORED: StoredRow[] = ownedRowsOf(
  PLAN,
  evaluateGateComponent(INPUTS).rows,
).map(storedOf);
/** The single legitimate normal-path scripted acquisition of the file (148 driver calls, counted once, shared by PU01 and PU18). */
let NORMAL:
  | Promise<{ pool: ScriptPool; acquisition: PerformanceAcquisition }>
  | undefined;
const normalRead = (): Promise<{
  pool: ScriptPool;
  acquisition: PerformanceAcquisition;
}> => {
  NORMAL ??= (async () => {
    const pool = new ScriptPool();
    const read = await readPerformanceSnapshot(asPool(pool), PPLAN);
    if (!read.ok) throw new Error("the scripted acquisition failed");
    return { pool, acquisition: read.acquisition };
  })();
  return NORMAL;
};
/** A pure raw view of the scripted database (no driver call): staged candidate, native flags simulated, raw snapshot. */
const classifyPure = (db: GateDb): GateClassified => {
  const view = new Map([...db.rows].map(([id, row]) => [id, { ...row }]));
  const staged = stageGateSnapshot(PLAN, staticResults(db, view));
  const flags = flagRows(view, staged.statement.values);
  return classifyGateRaw(
    gateRawOf(staged, flags),
    PLAN,
    staged.candidate,
    "preflight",
  );
};

// ---- door E helpers ------------------------------------------------------------------------------------------------------------------------------
interface Facts {
  pins: Obj;
  payload: Obj;
  version_rows: Obj[];
  artifact: Obj;
  intent_rows: Obj[];
  script: Obj;
  mode: string;
  sensitivities: Obj[];
}
const IID = (n: number): string =>
  `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;
const V0 = "00000000-0000-4000-8000-0000000002a1";
const A0 = "00000000-0000-4000-8000-0000000002a2";
/** Stored-shaped facts for a list of six-key intents; the stored direction hash is recomputed with the owned helper where the references resolve. */
function factsFor(
  intents: Obj[],
  opts: { mode?: string; sensitivities?: Obj[] } = {},
): Facts {
  const direction = {
    script_hash: CHILD_HASH,
    direction_spec_version: SPEC,
    performance_intents: intents,
  };
  let hash: string;
  try {
    hash = performanceDirectionHash(direction, ANCHORS);
  } catch {
    hash = "0".repeat(64);
  }
  return structuredClone({
    pins: { script_version_id: CHILD_VERSION, script_hash: CHILD_HASH },
    payload: {
      ...direction,
      performance_intents: intents.map((intent, n) => ({
        ...intent,
        performance_intent_id: IID(n),
      })),
      direction_hash: hash,
    },
    version_rows: [
      {
        performance_direction_version_id: V0,
        artifact_id: A0,
        script_version_id: CHILD_VERSION,
      },
    ],
    artifact: {
      artifact_id: A0,
      artifact_type: "performance_direction",
      content_hash: hash,
    },
    intent_rows: intents.map((intent, n) => ({
      performance_intent_id: IID(n),
      performance_direction_version_id: V0,
      turn_id: intent.scope_ref,
      intent: { ...intent },
    })),
    script: SCRIPT_E,
    mode: opts.mode ?? "normal_post_event",
    sensitivities: opts.sensitivities ?? [{ state: "none" }],
  });
}
const where = (item: Obj): string => {
  const intentIndex = item.intent_index as number | undefined;
  return [
    intentIndex !== undefined ? `#${String(intentIndex)}` : "",
    typeof item.side === "string" ? `:${item.side}` : "",
    typeof item.use_kind === "string"
      ? `:${item.use_kind}${String(item.use_index)}`
      : "",
    typeof item.reference === "string" ? `~${item.reference}` : "",
  ].join("");
};
const row = (facts: Facts, position: number) =>
  evaluatePerformanceGate(facts, position);
const found = (facts: Facts, position: number): string[] =>
  (row(facts, position).result.findings as Obj[]).map(
    (item) => `${String(item.code)}${where(item)}`,
  );
const payloadIntent = (facts: Facts, index: number): Obj =>
  defined(records(facts.payload.performance_intents)[index]);
const rowOf = (facts: Facts, index: number): Obj =>
  defined(facts.intent_rows[index]);
const rowIntent = (facts: Facts, index: number): Obj =>
  rowOf(facts, index).intent as Obj;
const turnFacts = (facts: Facts): Obj[] => records(facts.script.turns);
const overlap = (
  foreground: string,
  background: string,
  value: Obj = {},
  scope?: string,
): Obj => ({
  scope_type: "turn",
  scope_ref: scope ?? uuid(foreground),
  intent_type: "overlap",
  value: { placement: "middle", duration_class: "brief", ...value },
  strength: "standard",
  timing_anchor: background.startsWith("00000000")
    ? background
    : uuid(background),
});
const cmpUse = (a: Obj, b: Obj): number => {
  const seq = (use: Obj): number => SEQUENCE.get(String(use.turn_id)) ?? 0;
  if (seq(a) !== seq(b)) return seq(a) - seq(b);
  if (a.span_start !== b.span_start)
    return Number(a.span_start) - Number(b.span_start);
  if (a.span_end !== b.span_end) return Number(a.span_end) - Number(b.span_end);
  return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
};
const EVIDENCE = records(SCRIPT_E.evidence_uses).sort(cmpUse);
const CLAIMS = records(SCRIPT_E.claim_uses).sort(cmpUse);
const QUOTE_AT = EVIDENCE.findIndex((use) => use.use_mode === "quoted");
const ATTR_AT = CLAIMS.findIndex((use) => use.use_mode === "attributed");
const HEDGE_AT = CLAIMS.findIndex((use) => use.use_mode === "hedged");
const QUOTE = defined(EVIDENCE[QUOTE_AT]);
const ATTRIBUTED = defined(CLAIMS[ATTR_AT]);
const HEDGED = defined(CLAIMS[HEDGE_AT]);
const anchorOfTurn = (id: unknown): string => defined(ANCHORS.get(String(id)));
const PROTECTED_TURNS = new Set(
  [
    ...EVIDENCE.filter((use) => use.use_mode === "quoted"),
    ...CLAIMS.filter(
      (use) => use.use_mode === "attributed" || use.use_mode === "hedged",
    ),
  ].map((use) => String(use.turn_id)),
);
const CLEAN = [...TURN_OF.entries()]
  .filter(([, id]) => !PROTECTED_TURNS.has(id))
  .map(([anchor]) => anchor);
const cpLength = (turnId: unknown): number =>
  Array.from(
    (
      (turnFacts({ script: SCRIPT_E } as unknown as Facts).find(
        (turn) => turn.turn_id === turnId,
      )?.text as string | undefined) ?? ""
    ).normalize("NFC"),
  ).length;

describe("performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit)", () => {
  it(
    "PU01 forged_and_foreign_plans_and_acquisitions_refuse_before_io",
    async () => {
      // a performance plan is admitted only by the planner; a gate plan, a plain object and a structural clone are not
      expect(isAdmittedPerformancePlan(PPLAN)).toBe(true);
      expect(Object.isFrozen(PPLAN)).toBe(true);
      expect(PPLAN.gate).toBe(PLAN);
      expect(PPLAN.definitions).toHaveLength(7);
      expect(PPLAN.definitions.map((pin) => pin.gate_definition_id)).toEqual(
        [19, 20, 21, 22, 23, 24, 25].map(
          (n) => `d1250019-0000-4000-8000-0000000000${String(n)}`,
        ),
      );
      expect(PPLAN.definitions.map((pin) => pin.gate_name)).toEqual([
        ...PERFORMANCE_DEFINITION_KEYS,
      ]);
      expect(PPLAN.definitions.every((pin) => pin.version === "1")).toBe(true);
      // the planner read exactly one pinned member
      expect(PERFORMANCE_PLAN_READS).toEqual(["foundation_rows_398.json"]);
      const forgeries: [string, unknown][] = [
        ["a plain object", {}],
        ["a gate plan", PLAN],
        ["a structural clone", structuredClone(PPLAN)],
        ["a shallow copy", { ...PPLAN }],
      ];
      for (const [name, plan] of forgeries) {
        expect(isAdmittedPerformancePlan(plan), name).toBe(false);
        const guard = forbidden();
        await expect(
          readPerformanceSnapshot(guard.pool, plan as PerformancePlan),
          name,
        ).rejects.toThrow(
          new TypeError("an admitted performance plan is required"),
        );
        await expect(
          refusePerformanceDirection(guard.pool, plan as PerformancePlan),
          name,
        ).rejects.toThrow(TypeError);
        expect(guard.uses(), name).toBe(0);
      }
      // the planner's own shape errors are constant-text programmer errors
      const shape = new TypeError(
        "planPerformanceDirection requires exactly { gatePlan, pack }",
      );
      for (const bad of [
        {},
        { gatePlan: PLAN },
        { gatePlan: PLAN, pack: SPY_PACK, extra: 1 },
        { gatePlan: {}, pack: SPY_PACK },
        { gatePlan: PLAN, pack: {} },
        { gatePlan: PLAN, pack: null },
        null,
        [],
      ])
        expect(() =>
          planPerformanceDirection(
            bad as unknown as Parameters<typeof planPerformanceDirection>[0],
          ),
        ).toThrow(shape);
      // a pack whose foundation member is not the pinned bytes is refused (no definition is trusted from unpinned bytes)
      const tampered: Pack = {
        ...SPY_PACK,
        member: (name: string): Buffer =>
          name === "foundation_rows_398.json"
            ? Buffer.from("{}", "utf8")
            : PACK.member(name),
      };
      expect(() =>
        planPerformanceDirection({ gatePlan: PLAN, pack: tampered }),
      ).toThrow(TypeError);
      // acquisitions: only the reader mints one; a caller-built value, a GateAcquisition-shaped value and a clone never classify
      const { pool, acquisition } = await normalRead();
      expect(pool.total()).toBe(PERFORMANCE_READER_CALLS.normal);
      expect(isPerformanceAcquisition(acquisition)).toBe(true);
      expect(isGateAcquisition(acquisition)).toBe(false);
      expect(Object.isFrozen(acquisition)).toBe(true);
      const shaped = {
        point: "preflight",
        plan: PLAN,
        raw: acquisition.raw,
        candidate: acquisition.candidate,
      };
      for (const [name, value] of [
        [
          "a plain object",
          {
            plan: PPLAN,
            raw: acquisition.raw,
            candidate: acquisition.candidate,
          },
        ],
        ["a GateAcquisition-shaped object", shaped],
        ["a structural clone", structuredClone(acquisition)],
      ] as [string, unknown][]) {
        expect(isPerformanceAcquisition(value), name).toBe(false);
        expect(() =>
          classifyPerformanceAcquisition(value as PerformanceAcquisition),
        ).toThrow(TypeError);
      }
      expect(() =>
        classifyGateAcquisition(acquisition as never, "preflight"),
      ).toThrow(TypeError);
      // W-L1: the module has no write statement and no producer, provider, model, audit or lifecycle import; it never nests the upstream reader
      const source = readFileSync(
        "src/runtime/performance-direction.ts",
        "utf8",
      )
        .replace(/\/\*[\s\S]*?\*\//gu, "")
        .replace(/^\s*\/\/.*$/gmu, "");
      expect(
        /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE)\b/u.test(source),
      ).toBe(false);
      expect(
        /\breadGateSnapshot\b|\bclassifyGateAcquisition\b|\bGateAcquisition\b/u.test(
          source,
        ),
      ).toBe(false);
      const imports = [...source.matchAll(/from "([^"]+)"/gu)].map(
        (match) => match[1],
      );
      expect(imports.sort()).toEqual(
        [
          "../fixture/code-points.js",
          "../fixture/derive.js",
          "../fixture/pack.js",
          "../identity/artifacts.js",
          "../identity/canonical-json.js",
          "../identity/fingerprints.js",
          "./claims-writing-gate.js",
          "./command.js",
          "./writer-pass1.js",
          "pg",
        ].sort(),
      );
      // the ten stop literals are exactly the literal `code:` sites the observer scanner reads, and each is registered
      const sites = [...source.matchAll(/\bcode:\s*"([a-z0-9_]+)"/gu)].map(
        (match) => match[1],
      );
      expect([...new Set(sites)].sort()).toEqual(
        [...PERFORMANCE_STOP_CODES].sort(),
      );
      for (const code of PERFORMANCE_STOP_CODES)
        expect(KNOWN_OUTCOME_CODES.has(code), code).toBe(true);
      expect(PERFORMANCE_STOP_CODES).toHaveLength(10);
      expect(PERFORMANCE_STOP_CODES).not.toContain("perf_invocation_invalid");
    },
    T,
  );

  it(
    "PU02 admission_algebra_over_closed_enums_and_exported_h04_h13_witness",
    async () => {
      const keys = (value: object): string[] => Object.keys(value).sort();
      // every upstream stop code and stage is forwarded verbatim as a closed arm
      for (const code of GATE_STOP_CODES) {
        const refusal = admissionOf({
          kind: "stop",
          row: { stage: "preconditions", code, detail: {} },
        });
        expect(refusal.code).toBe("perf_upstream_stopped");
        expect(refusal.upstream).toEqual({
          class: "stop",
          code,
          stage: "preconditions",
        });
        expect(keys(refusal)).toEqual(
          [
            "cleanup",
            "code",
            "durable",
            "kind",
            "reconciled",
            "stage",
            "upstream",
            "writes_attempted",
          ].sort(),
        );
        expect(refusal).toMatchObject({
          kind: "refused",
          stage: "admission",
          writes_attempted: 0,
          durable: { performance: "not_read" },
          cleanup: { attached_errors: 0, complete: true },
          reconciled: false,
        });
        expect(Object.isFrozen(refusal)).toBe(true);
      }
      const verified = admissionOf({
        kind: "stop",
        row: {
          stage: "evaluation",
          code: "gate_upstream_stopped",
          detail: { upstream_code: "texture_wrong_state" as never },
          verified: { pass1: true, revision: false },
        },
      });
      expect(verified.upstream).toEqual({
        class: "stop",
        code: "gate_upstream_stopped",
        stage: "evaluation",
        verified: { pass1: true, revision: false },
      });
      const unverified = admissionOf({
        kind: "stop",
        row: {
          stage: "preconditions",
          code: "gate_history_mismatch",
          detail: {},
        },
      });
      expect(Object.hasOwn(unverified.upstream, "verified")).toBe(false);
      // gate 0, and gate 18 over every aggregate (the synthetic complete value is the unimplemented positive branch)
      expect(admissionOf({ kind: "state", gate: 0, texture: 4 })).toMatchObject(
        {
          code: "perf_upstream_gate_absent",
          upstream: { class: "state", gate_state: 0 },
        },
      );
      const eighteen = { kind: "state", gate: 18, texture: 4 } as const;
      expect(admissionOf(eighteen, "failed")).toMatchObject({
        code: "perf_upstream_gate_failed",
        upstream: { class: "state", gate_state: 18, aggregate: "failed" },
      });
      expect(admissionOf(eighteen, "incomplete")).toMatchObject({
        code: "perf_upstream_gate_incomplete",
        upstream: { class: "state", gate_state: 18, aggregate: "incomplete" },
      });
      expect(admissionOf(eighteen, "complete_defined_set")).toMatchObject({
        code: "perf_positive_branch_unimplemented",
        upstream: {
          class: "state",
          gate_state: 18,
          aggregate: "complete_defined_set",
        },
      });
      expect(() => admissionOf(eighteen)).toThrow(TypeError);
      // W-A4: H04 and H13 are unconditional required gaps in the exported writing evaluation, so even an all-pass counterfactual is incomplete
      const writing = evaluateWritingChecks(INPUTS);
      const required = writing.coverage
        .filter((item) => item.status === "not_established_required")
        .map((item) => item.id);
      expect(required).toContain("H04");
      expect(required).toContain("H13");
      expect(aggregateOf([], writing.coverage)).toBe("incomplete");
      expect(aggregateOf([], [])).toBe("complete_defined_set"); // synthetic only: unreachable with the real coverage register
      // the current chain: the real scripted acquisition is ready, aggregate failed, 16 pass / 2 fail
      const { acquisition } = await normalRead();
      expect(acquisition.candidate.kind).toBe("ready");
      if (acquisition.candidate.kind !== "ready") return;
      expect(acquisition.candidate.evaluation.aggregate).toBe("failed");
      const owned = ownedRowsOf(PLAN, acquisition.candidate.evaluation.rows);
      expect(owned.filter((item) => item.outcome === "pass")).toHaveLength(16);
      expect(
        owned.filter((item) => item.outcome === "fail").map((item) => item.key),
      ).toEqual(["claims.value_support", "claims.desk_derivation"]);
      expect(classifyPerformanceAcquisition(acquisition)).toEqual({
        kind: "state",
        gate: 0,
        texture: 4,
      });
    },
    T,
  );

  it(
    "PU03 candidate_grammar_keys_and_types",
    () => {
      const base = (): Obj => structuredClone(candidateOf(B0));
      const check = (candidate: unknown) =>
        validateDirectionCandidate(candidate, SCRIPT_C);
      const refusal = (candidate: unknown): Obj => {
        const result = check(candidate);
        if (result.kind !== "refused") throw new Error("expected a refusal");
        return result as unknown as Obj;
      };
      const ok = check(base());
      expect(ok.kind).toBe("admitted");
      // W-C1 and the missing-key family
      const noHash = base();
      delete noHash.script_hash;
      expect(refusal(noHash)).toMatchObject({
        code: "perf_grammar_invalid",
        reason: "missing_key",
        stage: "candidate",
        writes_attempted: 0,
      });
      const noStrength = base();
      delete defined(records(noStrength.performance_intents)[0]).strength;
      expect(refusal(noStrength)).toMatchObject({ reason: "missing_key" });
      // W-C15: director_note, rationale_code and text are unknown keys (three cases), at the direction and at the intent
      for (const key of ["director_note", "rationale_code", "text"]) {
        const direction = base();
        direction[key] = "x";
        expect(refusal(direction), `${key} on the direction`).toMatchObject({
          code: "perf_grammar_invalid",
          reason: "unknown_key",
        });
        const intent = base();
        defined(records(intent.performance_intents)[0])[key] = "x";
        expect(refusal(intent), `${key} on an intent`).toMatchObject({
          reason: "unknown_key",
        });
      }
      // types
      for (const [name, mutate] of [
        ["a non-array intents", (c: Obj) => (c.performance_intents = {})],
        ["a numeric hash", (c: Obj) => (c.script_hash = 3)],
        ["a non-record element", (c: Obj) => (c.performance_intents = [1])],
        [
          "a numeric value",
          (c: Obj) => (defined(records(c.performance_intents)[0]).value = 3),
        ],
        [
          "a non-string strength",
          (c: Obj) =>
            (defined(records(c.performance_intents)[0]).strength = null),
        ],
        [
          "a numeric timing anchor",
          (c: Obj) =>
            (defined(records(c.performance_intents)[0]).timing_anchor = 4),
        ],
      ] as [string, (c: Obj) => unknown][]) {
        const candidate = base();
        mutate(candidate);
        expect(refusal(candidate), name).toMatchObject({
          code: "perf_grammar_invalid",
          reason: "type",
        });
      }
      for (const candidate of [null, [], "x", 4])
        expect(refusal(candidate), String(candidate)).toMatchObject({
          reason: "type",
        });
      // W-C17 corrected (E1): (a) a safe-integer value passes semantic JSON and keys and is a TYPE refusal; (b) a float and (c) a duplicate NFC key stop at the FIRST check
      const safeInteger = base();
      defined(records(safeInteger.performance_intents)[1]).value = 3;
      expect(refusal(safeInteger)).toMatchObject({ reason: "type" });
      const float = base();
      defined(records(float.performance_intents)[1]).value = 0.5;
      expect(refusal(float)).toMatchObject({ reason: "not_semantic_json" });
      const duplicate = base();
      Object.assign(defined(records(duplicate.performance_intents)[0]), {
        é: 1,
        é: 2,
      });
      expect(refusal(duplicate)).toMatchObject({ reason: "not_semantic_json" });
      // the semantic-JSON check precedes every other check, including a missing key and an unknown key
      const early = base();
      delete early.script_hash;
      early.diagnostic = 0.5;
      expect(refusal(early)).toMatchObject({ reason: "not_semantic_json" });
      const minusZero = base();
      defined(records(minusZero.performance_intents)[0]).value = -0;
      expect(refusal(minusZero)).toMatchObject({ reason: "not_semantic_json" });
      const lone = base();
      defined(records(lone.performance_intents)[0]).value = "\ud800";
      expect(refusal(lone)).toMatchObject({ reason: "not_semantic_json" });
      const cycle = base();
      cycle.self = cycle;
      expect(refusal(cycle)).toMatchObject({ reason: "not_semantic_json" });
      expect(isSemanticJson(base())).toBe(true);
      expect(isSemanticJson(undefined)).toBe(false);
      // a malformed bound script is a programmer error, not a refusal
      expect(() =>
        validateDirectionCandidate(base(), {
          script_hash: CHILD_HASH,
          turns: [
            { turn_id: "a", semantic_turn_id: "t01" },
            { turn_id: "b", semantic_turn_id: "t01" },
          ],
        }),
      ).toThrow(
        new TypeError("a bound script with unique turn anchors is required"),
      );
      // the empty direction is valid and preferred
      expect(check(candidateOf([])).kind).toBe("admitted");
    },
    T,
  );

  it(
    "PU04 candidate_vocabulary_and_supported_subset",
    () => {
      const refusal = (intent: Obj): Obj => {
        const result = validateDirectionCandidate(
          candidateOf([intent]),
          SCRIPT_C,
        );
        if (result.kind !== "refused") throw new Error("expected a refusal");
        return result as unknown as Obj;
      };
      const base = mk("t05", "delivery_affect", "curious");
      // W-C8: an unknown scope type
      expect(refusal({ ...base, scope_type: "word" })).toMatchObject({
        code: "perf_vocabulary_unknown",
        field: "scope_type",
      });
      // W-C9..C11: every other intent identifier is unknown at this interface, including the conditional specimen shapes and unassigned ones
      for (const type of [
        "energy",
        "intensity",
        "measured",
        "pause",
        "emphasis",
        "non_verbal_event",
        "overlap",
        "",
      ])
        expect(refusal({ ...base, intent_type: type }), type).toMatchObject({
          code: "perf_vocabulary_unknown",
          field: "intent_type",
          reason: "not_in_supported_candidate_subset",
        });
      // W-C12..C14: values and strengths outside their closed sets; HIST pace `measured` is the one source-observed out-of-vocabulary value
      expect(refusal({ ...base, value: "sarcastic" })).toMatchObject({
        field: "value",
      });
      expect(refusal(mk("t05", "pace", "measured"))).toMatchObject({
        code: "perf_vocabulary_unknown",
        field: "value",
      });
      expect(refusal({ ...base, value: "slower" })).toMatchObject({
        field: "value",
      }); // a pace value is not an affect value
      expect(refusal({ ...base, strength: "heavy" })).toMatchObject({
        field: "strength",
      });
      // the closed sets are exactly the complete supported subset: every member is admitted
      expect(AFFECT_VALUES).toHaveLength(14);
      expect(PACE_VALUES).toHaveLength(4);
      expect(INTENSITY_VALUES).toHaveLength(3);
      expect([...STRENGTH_VALUES]).toEqual(["light", "standard"]);
      const families: [string, readonly string[]][] = [
        ["delivery_affect", AFFECT_VALUES],
        ["pace", PACE_VALUES],
        ["energy_intensity", INTENSITY_VALUES],
      ];
      for (const [type, values] of families)
        for (const value of values)
          for (const strength of STRENGTH_VALUES)
            expect(
              validateDirectionCandidate(
                candidateOf([mk("t05", type, value, strength)]),
                SCRIPT_C,
              ).kind,
              `${type}/${value}/${strength}`,
            ).toBe("admitted");
      // precedence inside the vocabulary pass: scope type, intent type, value, strength (the first failing field wins)
      expect(
        refusal({
          ...base,
          scope_type: "word",
          intent_type: "pause",
          value: "x",
          strength: "y",
        }),
      ).toMatchObject({ field: "scope_type" });
      expect(
        refusal({ ...base, intent_type: "pause", value: "x", strength: "y" }),
      ).toMatchObject({ field: "intent_type" });
      expect(refusal({ ...base, value: "x", strength: "y" })).toMatchObject({
        field: "value",
      });
    },
    T,
  );

  it(
    "PU05 candidate_scope_shape_and_binding_refusals",
    () => {
      const run = (candidate: unknown) =>
        validateDirectionCandidate(candidate, SCRIPT_C) as unknown as Obj;
      const withIntent = (patch: Obj, top: Obj = {}): Obj => ({
        ...candidateOf([{ ...mk("t05", "pace", "slower"), ...patch }]),
        ...top,
      });
      // W-C6, W-C7: recognised and unsupported scopes (no implicit fan-out, no nullable workaround)
      expect(run(withIntent({ scope_type: "program_block" }))).toMatchObject({
        code: "perf_scope_unsupported",
        reason: "block_turn_mapping_unowned",
      });
      expect(run(withIntent({ scope_type: "text_span" }))).toMatchObject({
        code: "perf_scope_unsupported",
        reason: "text_span_ref_shape_unowned",
      });
      // W-C16 and shape
      expect(run(withIntent({ timing_anchor: uuid("t06") }))).toMatchObject({
        code: "perf_grammar_invalid",
        reason: "timing_not_allowed",
      });
      expect(run(withIntent({ scope_ref: "t05" }))).toMatchObject({
        reason: "scope_ref_shape",
      });
      expect(
        run(withIntent({ scope_ref: uuid("t05").toUpperCase() })),
      ).toMatchObject({
        reason: "scope_ref_shape",
      });
      expect(run(withIntent({}, { script_hash: "abc" }))).toMatchObject({
        reason: "script_hash_shape",
      });
      // W-C2, W-C3: binding (the script and the spec version)
      expect(
        run(withIntent({}, { script_hash: "a".repeat(64) })),
      ).toMatchObject({
        code: "perf_binding_mismatch",
        reason: "script_hash",
      });
      expect(
        run(
          withIntent(
            {},
            { direction_spec_version: "performance-render-0.1.3" },
          ),
        ),
      ).toMatchObject({
        code: "perf_binding_mismatch",
        reason: "spec_version",
      });
      // W-C4, W-C5: a turn outside the bound final script, including a turn of the PARENT revision
      expect(run(withIntent({ scope_ref: UNKNOWN }))).toMatchObject({
        code: "perf_binding_mismatch",
        reason: "turn_outside_script",
      });
      const parentTurn = String(
        defined(
          records(PLAN.texture.revision.script_payload.turns).find(
            (turn) =>
              !TURN_OF.has(String(turn.semantic_turn_id)) ||
              uuid(String(turn.semantic_turn_id)) !== turn.turn_id,
          ),
        ).turn_id,
      );
      expect(run(withIntent({ scope_ref: parentTurn }))).toMatchObject({
        reason: "turn_outside_script",
      });
      // the earlier pass wins: an unsupported scope with a bad hash is the scope refusal; vocabulary beats scope
      expect(
        run(
          withIntent(
            { scope_type: "program_block" },
            { script_hash: "a".repeat(64) },
          ),
        ),
      ).toMatchObject({ code: "perf_scope_unsupported" });
      expect(
        run(withIntent({ scope_type: "program_block", intent_type: "pause" })),
      ).toMatchObject({ code: "perf_vocabulary_unknown" });
      // W-C18 controls: reordering and a repeated (scope_ref, intent_type) are accepted; order is identity, so the hash differs after a reorder
      const forward = validateDirectionCandidate(candidateOf(B0), SCRIPT_C);
      const reversed = validateDirectionCandidate(
        candidateOf([...B0].reverse()),
        SCRIPT_C,
      );
      expect(forward.kind).toBe("admitted");
      expect(reversed.kind).toBe("admitted");
      if (forward.kind !== "admitted" || reversed.kind !== "admitted") return;
      expect(forward.direction_hash).not.toBe(reversed.direction_hash);
      const twice = validateDirectionCandidate(
        candidateOf([
          mk("t05", "pace", "slower"),
          mk("t05", "pace", "quicker"),
        ]),
        SCRIPT_C,
      );
      expect(twice.kind).toBe("admitted");
    },
    T,
  );

  it(
    "PU06 projection_hash_order_and_envelope_stability",
    () => {
      const admitted = validateDirectionCandidate(candidateOf(B0), SCRIPT_C);
      if (admitted.kind !== "admitted") throw new Error("B0 must be admitted");
      // SYN-S1: the projection resolves turn refs to semantic anchors and the hash equals the inert derivation literal
      expect(admitted.direction_hash).toBe(SYN.S1.hash);
      expect(admitted.intents).toBe(2);
      expect(admitted.projection).toEqual({
        script_hash: CHILD_HASH,
        direction_spec_version: SPEC,
        performance_intents: [
          {
            scope_type: "turn",
            scope_ref: "t05",
            intent_type: "delivery_affect",
            value: "curious",
            strength: "standard",
            timing_anchor: null,
          },
          {
            scope_type: "turn",
            scope_ref: "t09",
            intent_type: "pace",
            value: "slower",
            strength: "standard",
            timing_anchor: null,
          },
        ],
      });
      expect(
        validateDirectionCandidate(candidateOf([]), SCRIPT_C),
      ).toMatchObject({ kind: "admitted", direction_hash: SYN.E0.hash });
      // W-P1: envelope fields and an extra key outside the selected six never change the hash
      const direction = candidateOf(B0);
      const stored = {
        ...direction,
        performance_intents: B0.map((intent, n) => ({
          ...intent,
          performance_intent_id: IID(n),
          rationale_code: "x",
        })),
        artifact_id: A0,
        performance_direction_version_id: V0,
        script_version_id: CHILD_VERSION,
        actor: "fixture",
        producer_run_id: IID(9),
        created_at: CREATED_AT,
        input_fingerprint: "f".repeat(64),
        direction_hash: "0".repeat(64),
        diagnostic: "anything",
      };
      expect(performanceDirectionHash(stored, ANCHORS)).toBe(SYN.S1.hash);
      // W-P2: a change to value, strength, scope_ref, timing_anchor, intent_type or script_hash changes the hash
      const hashOf = (intents: Obj[], script_hash = CHILD_HASH): string =>
        performanceDirectionHash(
          { ...candidateOf(intents), script_hash },
          ANCHORS,
        );
      const baseIntent = defined(B0[0]);
      const changed: [string, Obj][] = [
        ["value", { ...baseIntent, value: "warm" }],
        ["strength", { ...baseIntent, strength: "light" }],
        ["scope_ref", { ...baseIntent, scope_ref: uuid("t06") }],
        ["timing_anchor", { ...baseIntent, timing_anchor: uuid("t06") }],
        ["intent_type", { ...baseIntent, intent_type: "pace" }],
      ];
      for (const [name, intent] of changed)
        expect(hashOf([intent, defined(B0[1])]), name).not.toBe(SYN.S1.hash);
      expect(hashOf(B0, "b".repeat(64))).not.toBe(SYN.S1.hash);
      // key order inside an intent is irrelevant
      const reordered = Object.fromEntries(
        Object.entries(baseIntent).reverse(),
      );
      expect(hashOf([reordered, defined(B0[1])])).toBe(SYN.S1.hash);
      // W-P3: array order is identity
      expect(hashOf([...B0].reverse())).not.toBe(SYN.S1.hash);
      // the owned helper itself rejects a reference outside the bound script
      expect(() =>
        performanceDirectionHash(
          candidateOf(
            [mk("t05", "pace", "slower", "standard")].map((i) => ({
              ...i,
              scope_ref: UNKNOWN,
            })),
          ),
          ANCHORS,
        ),
      ).toThrow(TypeError);
    },
    T,
  );

  it(
    "PU07 fingerprints_domain_separation_and_historical_and_synthetic_literals",
    () => {
      const policy = (hash: string): string =>
        performanceFingerprint(CHILD_HASH, hash);
      const audit = (hash: string): string =>
        auditInputFingerprint({
          package_hash: PACKAGE_HASH,
          brief_hash: BRIEF_HASH,
          script_hash: CHILD_HASH,
          performance_direction_hash: hash,
        });
      // W-P7: the inert derivation literals reproduce (SYN-E0, SYN-S1, SYN-S2); labelled arithmetic, never an approval
      for (const [name, literal] of Object.entries(SYN)) {
        expect(policy(literal.hash), name).toBe(literal.performance);
        expect(audit(literal.hash), name).toBe(literal.audit);
      }
      // SYN-S2 is a CONDITIONAL specimen (overlap + non-verbal): hashing does not admit it.
      // Its overlap value is an object, so the whole-candidate type pass refuses before vocabulary.
      const conditional = candidateOf([
        overlap("t03", "t04"),
        mk("t12", "non_verbal_event", "breath", "light"),
      ]);
      expect(performanceDirectionHash(conditional, ANCHORS)).toBe(SYN.S2.hash);
      expect(validateDirectionCandidate(conditional, SCRIPT_C)).toEqual({
        kind: "refused",
        stage: "candidate",
        code: "perf_grammar_invalid",
        writes_attempted: 0,
        reason: "type",
      });
      // HIST: the historical corrected direction fingerprints equal the loaded vectors; they are conformance examples, not approvals of this script
      const frozen = PACK.json("gate_fingerprint_inputs.json") as Record<
        string,
        { input_projection: Obj; fingerprint: string }
      >;
      const historicalPerformance = defined(frozen.performance);
      const historicalAudit = defined(frozen.semantic_audit);
      expect(
        fingerprint("performance", historicalPerformance.input_projection),
      ).toBe(HIST.performance);
      expect(historicalPerformance.fingerprint).toBe(HIST.performance);
      expect(
        historicalPerformance.input_projection.performance_direction_hash,
      ).toBe(HIST.direction);
      expect(
        fingerprint("semantic_audit", historicalAudit.input_projection),
      ).toBe(HIST.audit);
      expect(historicalAudit.fingerprint).toBe(HIST.audit);
      // W-P4: a stale gate-set or policy changes the four-key fingerprint; all three differ
      const projection = {
        script_hash: CHILD_HASH,
        performance_direction_hash: SYN.S1.hash,
        performance_policy_version: SPEC,
        gate_set_version: PERFORMANCE_PIN.gate_set_version,
      };
      expect(fingerprint("performance", projection)).toBe(SYN.S1.performance);
      const staleGate = fingerprint("performance", {
        ...projection,
        gate_set_version: "build2-gates-v2",
      });
      const stalePolicy = fingerprint("performance", {
        ...projection,
        performance_policy_version: "performance-render-0.1.3",
      });
      expect(new Set([SYN.S1.performance, staleGate, stalePolicy]).size).toBe(
        3,
      );
      // W-P5: a missing or extra key is a TypeError from the exact-key check; a non-hash value is refused
      const missing: Obj = { ...projection };
      delete missing.gate_set_version;
      expect(() => fingerprint("performance", missing)).toThrow(TypeError);
      expect(() =>
        fingerprint("performance", { ...projection, extra: "x" }),
      ).toThrow(TypeError);
      expect(() => performanceFingerprint(CHILD_HASH, "not-a-hash")).toThrow(
        TypeError,
      );
      expect(
        Object.keys(
          auditInput({
            package_hash: PACKAGE_HASH,
            brief_hash: BRIEF_HASH,
            script_hash: CHILD_HASH,
            performance_direction_hash: SYN.S1.hash,
          }),
        ).sort(),
      ).toEqual([
        "auditor_contract_version",
        "brief_hash",
        "claims_policy_version",
        "package_hash",
        "performance_direction_hash",
        "performance_policy_version",
        "script_hash",
        "writing_policy_version",
      ]);
      // W-P6: domain separation (the same projection under the two domains hashes differently); the unchanged claims/writing fingerprint is not touched
      expect(domainHash("performance-gate-input-v1", projection)).not.toBe(
        domainHash("audit-input-v1", projection),
      );
      expect(PLAN.fingerprint).toBe(FINGERPRINT);
      expect(PERFORMANCE_PIN.claims_writing_fingerprint).toBe(FINGERPRINT);
      expect(PERFORMANCE_PIN.script_hash).toBe(CHILD_HASH);
      expect(PERFORMANCE_PIN.policy_version).toBe(SPEC);
      expect(PERFORMANCE_PIN.gate_set_version).toBe("build2-gates-v1");
    },
    T,
  );

  it(
    "PU08 gate19_intent_ref_integrity_pure_door",
    () => {
      const clean = factsFor(B0);
      const base = row(clean, 19);
      expect(base.outcome).toBe("pass");
      expect(base.result.facts).toEqual({
        examined: 2,
        expected_examined: 2,
        span_refs: 0,
        timing_refs: 0,
        turn_refs: 2,
      });
      expect(row(clean, 19).gate_definition_id).toBe(gateDefinitionId(19));
      // W-T1: stored scope_ref and turn_id both a valid UUID outside the script (door E only; door C refuses this earlier as W-C4)
      const outside = factsFor(B0);
      rowOf(outside, 0).turn_id = UNKNOWN;
      rowIntent(outside, 0).scope_ref = UNKNOWN;
      expect(found(outside, 19)).toEqual(["intent_turn_missing#0"]);
      // W-T3: the turn_id column differs from the stored scope_ref
      const column = factsFor(B0);
      rowOf(column, 0).turn_id = uuid("t07");
      expect(found(column, 19)).toEqual(["intent_turn_column_mismatch#0"]);
      // W-T2: a timing anchor outside the script (conditional overlap specimen)
      const timing = factsFor([overlap("t03", UNKNOWN)]);
      expect(found(timing, 19)).toEqual(["timing_turn_missing#0"]);
      expect(row(timing, 19).result.facts).toMatchObject({
        timing_refs: 1,
        turn_refs: 1,
        span_refs: 0,
      });
      // W-T4: a span end beyond the CODE-POINT length of an astral-character turn (the UTF-16 length would admit it)
      const astral = factsFor([
        overlap("t03", "t04", { foreground_span: { start: 0, end: 7 } }),
      ]);
      const text = "\u{1d4b3}".repeat(5);
      expect(text.length).toBe(10);
      expect(Array.from(text)).toHaveLength(5);
      defined(
        turnFacts(astral).find((turn) => turn.semantic_turn_id === "t03"),
      ).text = text;
      expect(found(astral, 19)).toEqual(["span_out_of_range#0:foreground"]);
      expect(row(astral, 19).result.facts).toMatchObject({ span_refs: 1 });
      const inside = factsFor([
        overlap("t03", "t04", { foreground_span: { start: 0, end: 5 } }),
      ]);
      defined(
        turnFacts(inside).find((turn) => turn.semantic_turn_id === "t03"),
      ).text = text;
      expect(found(inside, 19)).toEqual([]);
      // an unresolvable turn makes its span unevaluable (the missing-turn finding stands alone)
      const unresolved = factsFor([
        overlap(
          "t03",
          "t04",
          { foreground_span: { start: 0, end: 1 } },
          UNKNOWN,
        ),
      ]);
      expect(found(unresolved, 19)).toEqual(["intent_turn_missing#0"]);
      // W-T5: N_r != N_p (a stored row dropped) is a denominator mismatch here and in 20, 21 and 24
      const dropped = factsFor(B0);
      dropped.intent_rows.pop();
      expect(found(dropped, 19)).toEqual(["denominator_mismatch"]);
      expect(found(dropped, 20)).toContain("payload_row_mismatch");
      expect(found(dropped, 21)).toEqual([
        "denominator_mismatch",
        "mode_rule_set_absent#0",
        "mode_rule_set_absent#1",
      ]);
      expect(found(dropped, 24)).toEqual(["denominator_mismatch"]);
      // a non-turn scope row is not evaluated by this definition (block and span shapes are the documented coverage limit B01)
      const block = factsFor(B0);
      rowIntent(block, 0).scope_type = "program_block";
      expect(found(block, 19)).toEqual([]);
      expect(row(block, 19).result.facts).toMatchObject({ turn_refs: 1 });
    },
    T,
  );

  it(
    "PU09 gate20_script_binding_pure_door",
    () => {
      const clean = factsFor(B0);
      expect(row(clean, 20).outcome).toBe("pass");
      expect(row(clean, 20).result.facts).toEqual({
        examined: 1,
        expected_examined: 1,
        intents_payload: 2,
        intents_rows: 2,
      });
      expect(clean.payload.direction_hash).toBe(SYN.S1.hash);
      // W-S1: the version row bound to the PARENT script version
      const parent = factsFor(B0);
      parent.version_rows[0] = {
        ...defined(parent.version_rows[0]),
        script_version_id: PARENT_VERSION,
      };
      expect(found(parent, 20)).toEqual(["direction_script_version_mismatch"]);
      // W-S2: the script-hash field absent (E door: a missing field, not a missing entity), and a historical-looking hash
      const absent = factsFor(B0);
      delete absent.payload.script_hash;
      expect(found(absent, 20)).toEqual([
        "direction_script_hash_mismatch",
        "direction_hash_unrecomputable",
      ]);
      const historical = factsFor(B0);
      historical.payload.script_hash = `883cbe12${"0".repeat(56)}`;
      expect(found(historical, 20)).toEqual([
        "direction_script_hash_mismatch",
        "direction_hash_mismatch",
      ]);
      const nonString = factsFor(B0);
      nonString.payload.script_hash = 4;
      expect(found(nonString, 20)).toContain("direction_script_hash_mismatch");
      // the recomputed script hash differing from the pin is also a script-hash mismatch here (and script_text_changed in 24)
      const changed = factsFor(B0);
      changed.script = { ...changed.script, recomputed_hash: "c".repeat(64) };
      expect(found(changed, 20)).toContain("direction_script_hash_mismatch");
      // W-S3: the spec version
      const spec = factsFor(B0);
      spec.payload.direction_spec_version = "performance-render-0.1.3";
      expect(found(spec, 20)).toEqual([
        "direction_spec_version_mismatch",
        "direction_hash_mismatch",
      ]);
      // W-S4: an altered stored hash, and an altered artifact content hash (two cases)
      const hash = factsFor(B0);
      hash.payload.direction_hash = `1${String(hash.payload.direction_hash).slice(1)}`;
      expect(found(hash, 20)).toEqual(["direction_hash_mismatch"]);
      const content = factsFor(B0);
      content.artifact.content_hash = `1${String(content.artifact.content_hash).slice(1)}`;
      expect(found(content, 20)).toEqual(["direction_hash_mismatch"]);
      const missingHash = factsFor(B0);
      delete missingHash.payload.direction_hash;
      expect(found(missingHash, 20)).toEqual(["direction_hash_mismatch"]);
      // W-S5: a scope UUID that cannot be resolved through the supplied turn map (only a TypeError is caught)
      const unresolvable = factsFor(B0);
      payloadIntent(unresolvable, 0).scope_ref = UNKNOWN;
      rowOf(unresolvable, 0).turn_id = UNKNOWN;
      rowIntent(unresolvable, 0).scope_ref = UNKNOWN;
      expect(found(unresolvable, 20)).toEqual([
        "direction_hash_unrecomputable",
      ]);
      // a positional payload/row difference, and the count difference
      const positional = factsFor(B0);
      payloadIntent(positional, 1).value = "quicker";
      expect(found(positional, 20)).toEqual([
        "direction_hash_mismatch",
        "payload_row_mismatch#1",
      ]);
      const idOnly = factsFor(B0);
      payloadIntent(idOnly, 0).performance_intent_id = IID(77);
      expect(found(idOnly, 20)).toEqual([]);
      // the plan expects exactly one version row
      const two = factsFor(B0);
      two.version_rows.push({ ...defined(two.version_rows[0]) });
      expect(found(two, 20)).toEqual(["denominator_mismatch"]);
      const none = factsFor(B0);
      none.version_rows = [];
      expect(found(none, 20)).toEqual(["denominator_mismatch"]);
      expect(row(none, 20).result.subject_refs).toEqual([]);
      expect(row(clean, 20).result.subject_refs).toEqual([V0]);
    },
    T,
  );

  it(
    "PU10 gate21_mode_intent_allowed_pure_door",
    () => {
      // W-M1: a registered mode with intents is a proof gap per intent (the mode-by-family table is unowned): a proof-gap-only row is still `fail`
      const base = factsFor(B0);
      const failed = row(base, 21);
      expect(failed.outcome).toBe("fail");
      expect(found(base, 21)).toEqual([
        "mode_rule_set_absent#0",
        "mode_rule_set_absent#1",
      ]);
      expect(
        (failed.result.findings as Obj[]).every(
          (item) => item.class === "proof_gap",
        ),
      ).toBe(true);
      expect(failed.result.facts).toEqual({
        examined: 2,
        expected_examined: 2,
        families_present: 2,
        rule_entries: 0,
      });
      for (const mode of ["roundup", "sombre"])
        expect(found(factsFor(B0, { mode }), 21), mode).toEqual([
          "mode_rule_set_absent#0",
          "mode_rule_set_absent#1",
        ]);
      // W-M2: an unregistered mode (no gap findings are layered on top)
      for (const mode of ["weekly", "", "SOMBRE"])
        expect(found(factsFor(B0, { mode }), 21), mode).toEqual([
          "mode_unregistered",
        ]);
      // W-M3: the empty direction is a truthful vacuous pass recorded with its zero counts
      const empty = factsFor([]);
      expect(row(empty, 21).outcome).toBe("pass");
      expect(row(empty, 21).result.facts).toEqual({
        examined: 0,
        expected_examined: 0,
        families_present: 0,
        rule_entries: 0,
      });
      // distinct families are counted once each
      const repeated = factsFor([
        mk("t01", "pace", "slower"),
        mk("t02", "pace", "quicker"),
        mk("t03", "energy_intensity", "standard"),
      ]);
      expect(row(repeated, 21).result.facts).toMatchObject({
        families_present: 2,
        examined: 3,
      });
    },
    T,
  );

  it(
    "PU11 gate22_protected_nonverbal_pure_door",
    () => {
      const laugh = (value: string): Obj =>
        mk("t12", "non_verbal_event", value, "light");
      const heightened = mk("t06", "energy_intensity", "heightened");
      const active = [{ state: "none" }, { state: "active" }];
      // W-N1: sombre + K1 (laugh, chuckle: two cases) is a violation
      for (const value of ["laugh", "chuckle"]) {
        const f = factsFor([laugh(value)], { mode: "sombre" });
        expect(found(f, 22), value).toEqual(["nonverbal_in_protected_scope#0"]);
        expect(row(f, 22).result.facts).toEqual({
          examined: 1,
          expected_examined: 1,
          protected_context: 1,
          sensitivities_active: 0,
          sombre: 1,
        });
      }
      // W-N2: sombre + K2 heightened with no active sensitivity: one proof gap
      expect(found(factsFor([heightened], { mode: "sombre" }), 22)).toEqual([
        "jocular_set_unowned#0",
      ]);
      // W-N3: sombre + K2 + one active sensitivity: both gaps
      expect(
        found(
          factsFor([heightened], { mode: "sombre", sensitivities: active }),
          22,
        ),
      ).toEqual([
        "jocular_set_unowned#0",
        "sensitivity_scope_mapping_absent#0",
      ]);
      // W-N4 (the closed branch): normal mode + K2 + one active sensitivity emits BOTH proof gaps and no violation; the row is `fail`
      const n4 = factsFor([heightened], { sensitivities: active });
      expect(found(n4, 22)).toEqual([
        "jocular_set_unowned#0",
        "sensitivity_scope_mapping_absent#0",
      ]);
      expect(row(n4, 22).outcome).toBe("fail");
      expect(
        (row(n4, 22).result.findings as Obj[]).some(
          (item) => item.class === "violation",
        ),
      ).toBe(false);
      expect(row(n4, 22).result.facts).toMatchObject({
        protected_context: 1,
        sensitivities_active: 1,
        sombre: 0,
      });
      // W-N5: the contrasting control
      const n5 = factsFor([heightened]);
      expect(found(n5, 22)).toEqual([]);
      expect(row(n5, 22).outcome).toBe("pass");
      expect(row(n5, 22).result.facts).toMatchObject({
        examined: 1,
        protected_context: 0,
      });
      // W-N6: normal + an active sensitivity + K1
      expect(
        found(factsFor([laugh("laugh")], { sensitivities: active }), 22),
      ).toEqual(["sensitivity_scope_mapping_absent#0"]);
      // W-N7: breath, sigh, other intensities, affect and pace are never examined by this definition, even under sombre
      const unexamined = factsFor(
        [
          laugh("breath"),
          laugh("sigh"),
          mk("t01", "energy_intensity", "restrained"),
          mk("t02", "energy_intensity", "standard"),
          mk("t03", "delivery_affect", "grave"),
          mk("t04", "pace", "building"),
        ],
        { mode: "sombre", sensitivities: active },
      );
      expect(found(unexamined, 22)).toEqual([]);
      expect(row(unexamined, 22).result.facts).toMatchObject({
        examined: 0,
        expected_examined: 0,
      });
      // a K1 payload intent whose stored row is not K1 is a denominator mismatch
      const split = factsFor([laugh("laugh")], { mode: "sombre" });
      rowIntent(split, 0).value = "breath";
      expect(found(split, 22)).toEqual([
        "nonverbal_in_protected_scope#0",
        "denominator_mismatch",
      ]);
    },
    T,
  );

  it(
    "PU12 gate23_overlap_protected_span_pure_door",
    () => {
      expect(QUOTE_AT).toBeGreaterThanOrEqual(0);
      expect(ATTR_AT).toBeGreaterThanOrEqual(0);
      expect(HEDGE_AT).toBeGreaterThanOrEqual(0);
      expect(CLEAN.length).toBeGreaterThanOrEqual(3);
      const quoteTurn = anchorOfTurn(QUOTE.turn_id);
      const attributedTurn = anchorOfTurn(ATTRIBUTED.turn_id);
      const hedgedTurn = anchorOfTurn(HEDGED.turn_id);
      const [clean1, clean2] = [defined(CLEAN[0]), defined(CLEAN[1])];
      const active = [{ state: "none" }, { state: "active" }];
      // the base: no overlap intents is a vacuous pass with zero counts
      const none = factsFor(B0);
      expect(found(none, 23)).toEqual([]);
      expect(row(none, 23).result.facts).toEqual({
        examined: 0,
        expected_examined: 0,
        protected_regions_checked: 0,
        sensitivities_active: 0,
      });
      // W-O1: an absent span is the whole turn: a quoted evidence use is hit (L-iuk foreground, evidence, use_index in the sorted use order)
      const o1 = factsFor([overlap(quoteTurn, clean1)]);
      expect(found(o1, 23)).toContain(
        `overlap_intersects_quote#0:foreground:evidence${String(QUOTE_AT)}`,
      );
      expect(
        (row(o1, 23).result.facts as Obj).protected_regions_checked,
      ).toBeGreaterThanOrEqual(1);
      // W-O2: a background span intersecting an attributed claim use
      const o2 = factsFor([
        overlap(clean1, attributedTurn, {
          background_span: {
            start: Number(ATTRIBUTED.span_start),
            end: Number(ATTRIBUTED.span_start) + 1,
          },
        }),
      ]);
      expect(found(o2, 23)).toContain(
        `overlap_intersects_attribution#0:background:claim${String(ATTR_AT)}`,
      );
      // W-O3: a span intersecting a hedged (materially qualified) claim use
      const o3 = factsFor([
        overlap(clean1, hedgedTurn, {
          background_span: {
            start: Number(HEDGED.span_start),
            end: Number(HEDGED.span_start) + 1,
          },
        }),
      ]);
      expect(found(o3, 23)).toContain(
        `overlap_intersects_qualified#0:background:claim${String(HEDGE_AT)}`,
      );
      // W-O4: half-open adjacency: a span ending exactly where the protected use starts (or starting exactly where it ends) does not intersect; one code point inside does
      const start = Number(QUOTE.span_start);
      const end = Number(QUOTE.span_end);
      const length = cpLength(QUOTE.turn_id);
      const hit = `overlap_intersects_quote#0:foreground:evidence${String(QUOTE_AT)}`;
      if (start > 0) {
        expect(
          found(
            factsFor([
              overlap(quoteTurn, clean1, {
                foreground_span: { start: start - 1, end: start },
              }),
            ]),
            23,
          ),
        ).not.toContain(hit);
        expect(
          found(
            factsFor([
              overlap(quoteTurn, clean1, {
                foreground_span: { start: start - 1, end: start + 1 },
              }),
            ]),
            23,
          ),
        ).toContain(hit);
      } else {
        expect(length).toBeGreaterThan(end);
        expect(
          found(
            factsFor([
              overlap(quoteTurn, clean1, {
                foreground_span: { start: end, end: end + 1 },
              }),
            ]),
            23,
          ),
        ).not.toContain(hit);
        expect(
          found(
            factsFor([
              overlap(quoteTurn, clean1, {
                foreground_span: { start: end - 1, end: end + 1 },
              }),
            ]),
            23,
          ),
        ).toContain(hit);
      }
      // W-O5: an active sensitivity adds one proof gap per overlap intent
      const o5 = factsFor([overlap(clean1, clean2)], { sensitivities: active });
      expect(found(o5, 23)).toEqual(["sensitivity_scope_mapping_absent#0"]);
      expect(row(o5, 23).outcome).toBe("fail");
      // E2: an invalid PRESENT span emits overlap_span_unusable, performs NO comparison for that side and never fabricates an intersection
      for (const span of [
        { start: length + 1, end: length + 2 },
        { start: 3, end: 3 },
        { start: 4, end: 2 },
        { start: -1, end: 2 },
        { start: "a", end: 2 },
        { start: 0, end: 1, extra: true },
        "x",
        null,
      ]) {
        const f = factsFor([
          overlap(quoteTurn, clean1, { foreground_span: span }),
        ]);
        const findings = found(f, 23);
        expect(findings, JSON.stringify(span)).toContain(
          "overlap_span_unusable#0:foreground",
        );
        expect(
          findings.some((item) =>
            item.startsWith("overlap_intersects_quote#0:foreground"),
          ),
          JSON.stringify(span),
        ).toBe(false);
        expect(findings.indexOf("overlap_span_unusable#0:foreground")).toBe(
          findings.length -
            1 -
            findings.filter((item) => item.startsWith("sensitivity")).length,
        );
      }
      // the counterexample of the addendum: gate 19 reports span_out_of_range for the same span, gate 23 reports the gap and NOT the whole-turn intersection
      const e2 = factsFor([
        overlap(quoteTurn, clean1, {
          foreground_span: { start: length + 1, end: length + 2 },
        }),
      ]);
      expect(found(e2, 19)).toEqual(["span_out_of_range#0:foreground"]);
      expect(found(e2, 23)).toEqual(["overlap_span_unusable#0:foreground"]);
      // an invalid-only row is a proof-gap-only fail (never a fabricated violation) and its aggregate piece is `incomplete`
      expect(row(e2, 23).outcome).toBe("fail");
      expect(
        (row(e2, 23).result.findings as Obj[]).every(
          (item) => item.class === "proof_gap",
        ),
      ).toBe(true);
      expect(row(e2, 23).result.facts).toMatchObject({
        protected_regions_checked: 0,
      });
      // a valid other side is still evaluated normally
      const both = factsFor([
        overlap(quoteTurn, attributedTurn, {
          foreground_span: { start: length + 1, end: length + 2 },
        }),
      ]);
      expect(found(both, 23)).toContain("overlap_span_unusable#0:foreground");
      expect(found(both, 23)).toContain(
        `overlap_intersects_attribution#0:background:claim${String(ATTR_AT)}`,
      );
      // an unresolvable turn contributes no regions and no unusable gap (the missing turn is gate 19's finding)
      const gone = factsFor([
        overlap(
          clean1,
          clean2,
          { foreground_span: { start: 9, end: 1 } },
          UNKNOWN,
        ),
      ]);
      expect(found(gone, 23)).toEqual([]);
      expect(found(gone, 19)).toContain("intent_turn_missing#0");
      // R3: a use mode that is merely an INHERITED object key (`toString`, `constructor`) is an unprotected mode: no comparison, no finding, no throw
      for (const mode of ["toString", "constructor"]) {
        const claimed = factsFor([
          overlap(clean1, hedgedTurn, {
            background_span: {
              start: Number(HEDGED.span_start),
              end: Number(HEDGED.span_start) + 1,
            },
          }),
        ]);
        defined(
          records(claimed.script.claim_uses).find(
            (item) => item.id === HEDGED.id,
          ),
        ).use_mode = mode;
        expect(
          () => evaluatePerformanceGate(claimed, 23),
          `claim ${mode}`,
        ).not.toThrow();
        expect(found(claimed, 23), `claim ${mode}`).toEqual(
          found(o3, 23).filter(
            (item) =>
              item !==
              `overlap_intersects_qualified#0:background:claim${String(HEDGE_AT)}`,
          ),
        );
        expect(
          (row(claimed, 23).result.facts as Obj).protected_regions_checked,
          `claim ${mode}`,
        ).toBe(
          Number((row(o3, 23).result.facts as Obj).protected_regions_checked) -
            1,
        );
        const quoted = factsFor([overlap(quoteTurn, clean1)]);
        defined(
          records(quoted.script.evidence_uses).find(
            (item) => item.id === QUOTE.id,
          ),
        ).use_mode = mode;
        expect(
          () => evaluatePerformanceGate(quoted, 23),
          `evidence ${mode}`,
        ).not.toThrow();
        expect(found(quoted, 23), `evidence ${mode}`).toEqual(
          found(o1, 23).filter((item) => item !== hit),
        );
        expect(
          (row(quoted, 23).result.facts as Obj).protected_regions_checked,
          `evidence ${mode}`,
        ).toBe(
          Number((row(o1, 23).result.facts as Obj).protected_regions_checked) -
            1,
        );
      }
      // E2 (T4), the literal accepted specimen: a ten-code-point turn with a quoted evidence use [0,1) and an invalid requested side [11,12)
      const quotedTurn = (text: string, span: Obj): Facts => {
        const f = factsFor([
          overlap(clean1, clean2, { foreground_span: span }),
        ]);
        const turn = defined(
          turnFacts(f).find((item) => item.semantic_turn_id === clean1),
        );
        turn.text = text;
        records(f.script.evidence_uses).push({
          id: IID(88),
          turn_id: turn.turn_id,
          span_start: 0,
          span_end: 1,
          use_mode: "quoted",
        });
        return f;
      };
      const ten = quotedTurn("abcdefghij", { start: 11, end: 12 });
      expect(found(ten, 19)).toEqual(["span_out_of_range#0:foreground"]);
      expect(found(ten, 23)).toEqual(["overlap_span_unusable#0:foreground"]);
      expect(
        found(ten, 23).some((item) =>
          item.startsWith("overlap_intersects_quote"),
        ),
      ).toBe(false);
      expect((row(ten, 23).result.facts as Obj).protected_regions_checked).toBe(
        0,
      ); // the skipped side performs no comparison at all
      // aggregate meaning stays exact: gate 23 alone is a proof-gap-only fail whose isolated algebra is incomplete; the full seven-row evaluation containing gate 19's genuine violation is failed
      expect(
        performanceAggregateOf(
          row(ten, 23).result.findings as PerformanceFinding[],
          [],
        ),
      ).toBe("incomplete");
      expect(evaluatePerformanceGates(ten).aggregate).toBe("failed");
      // the astral-code-point specimen extended to gate 23: 5 code points = 10 UTF-16 units, so [6,7) would pass a UTF-16 length check but is unusable by code point
      const astralText = "\u{1d4b3}".repeat(5);
      expect(found(quotedTurn(astralText, { start: 6, end: 7 }), 23)).toEqual([
        "overlap_span_unusable#0:foreground",
      ]);
      expect(found(quotedTurn(astralText, { start: 6, end: 7 }), 19)).toEqual([
        "span_out_of_range#0:foreground",
      ]);
      expect(found(quotedTurn(astralText, { start: 1, end: 2 }), 23)).toEqual(
        [],
      ); // adjacent to the quoted [0,1): half-open, no intersection
      expect(found(quotedTurn(astralText, { start: 0, end: 1 }), 23)).toEqual([
        "overlap_intersects_quote#0:foreground:evidence" +
          String(
            records(
              quotedTurn(astralText, { start: 0, end: 1 }).script.evidence_uses,
            )
              .sort(cmpUse)
              .findIndex((item) => item.id === IID(88)),
          ),
      ]);
      // a payload overlap without a matching stored overlap row is a denominator mismatch
      const mismatch = factsFor([overlap(clean1, clean2)]);
      rowIntent(mismatch, 0).intent_type = "pace";
      expect(found(mismatch, 23)).toEqual(["denominator_mismatch"]);
    },
    T,
  );

  it(
    "PU13 gate24_no_spoken_text_mutation_pure_door",
    () => {
      const clean = factsFor(B0);
      expect(row(clean, 24).outcome).toBe("pass");
      expect(row(clean, 24).result.facts).toEqual({
        examined: 2,
        expected_examined: 2,
        script_turns_compared: 17,
      });
      // W-X1: a stored intent with an extra key (payload side and row side), and an envelope key outside the closed set (the historical shape)
      const inPayload = factsFor(B0);
      payloadIntent(inPayload, 0).text = "plain";
      expect(found(inPayload, 24)).toEqual(["intent_field_unknown#0"]);
      const inRow = factsFor(B0);
      rowIntent(inRow, 1).text = "plain";
      expect(found(inRow, 24)).toEqual(["intent_field_unknown#1"]);
      const rationale = factsFor(B0);
      payloadIntent(rationale, 0).rationale_code = "x";
      expect(found(rationale, 24)).toEqual(["intent_field_unknown#0"]);
      const envelope = factsFor(B0);
      envelope.payload.correction_operation = "measured_to_slower";
      expect(found(envelope, 24)).toEqual([
        "intent_field_unknown~direction_envelope",
      ]);
      // an extra intent key on both sides of one index is one finding for that index
      const both = factsFor(B0);
      payloadIntent(both, 0).text = "plain";
      rowIntent(both, 0).text = "plain";
      expect(found(both, 24)).toEqual(["intent_field_unknown#0"]);
      // the performance_intent_id key and the whole closed envelope are allowed
      const allowed = factsFor(B0);
      Object.assign(allowed.payload, {
        artifact_id: A0,
        performance_direction_version_id: V0,
        script_version_id: CHILD_VERSION,
        actor: "fixture",
        producer_run_id: IID(5),
        created_at: CREATED_AT,
        input_fingerprint: "e".repeat(64),
      });
      expect(found(allowed, 24)).toEqual([]);
      // W-X2: the recomputed script hash differs from the pin
      const text = factsFor(B0);
      text.script = { ...text.script, recomputed_hash: "d".repeat(64) };
      expect(found(text, 24)).toEqual(["script_text_changed"]);
      expect(found(text, 20)).toContain("direction_script_hash_mismatch");
      // the denominator
      const dropped = factsFor(B0);
      dropped.intent_rows.pop();
      expect(found(dropped, 24)).toEqual(["denominator_mismatch"]);
    },
    T,
  );

  it(
    "PU14 gate25_no_provider_syntax_pure_door",
    () => {
      // W-Y3 control first: governed tokens (vocabulary members, canonical UUIDs, hashes) are never linted (`_` is a markup character)
      const control = factsFor([
        mk("t02", "delivery_affect", "gently_amused"),
        mk("t03", "energy_intensity", "restrained", "light"),
      ]);
      expect(found(control, 25)).toEqual([]);
      expect(row(control, 25).result.facts).toEqual({
        examined: 0,
        expected_examined: 0,
        forbidden_matches: 0,
      });
      expect(row(factsFor(B0), 25).outcome).toBe("pass");
      // W-Y1: three provider-syntax values under an extra key inside intent 0: the known-tag finding is located at L-i, and gate 24 reports the unknown field
      const cases: [string, string[]][] = [
        [
          "[laughs]",
          [
            "provider_char_class#0",
            "provider_char_class#0",
            "provider_known_tag#0",
          ],
        ],
        [
          "<break>",
          [
            "provider_char_class#0",
            "provider_char_class#0",
            "provider_known_tag#0",
          ],
        ],
        ["style=whisper", ["provider_char_class#0", "provider_known_tag#0"]],
      ];
      for (const [value, expected] of cases) {
        const f = factsFor(B0);
        payloadIntent(f, 0).text = value;
        expect(found(f, 25), value).toEqual(expected);
        expect(found(f, 24), value).toEqual(["intent_field_unknown#0"]);
        expect(row(f, 25).result.facts).toMatchObject({
          forbidden_matches: expected.length,
          examined: 2,
          expected_examined: 2,
        });
      }
      // W-Y2: a free leaf containing `|` in the envelope is located at L-ref `direction_envelope`
      const envelope = factsFor(B0);
      envelope.payload.diagnostic = "a|b";
      expect(found(envelope, 25)).toEqual([
        "provider_char_class~direction_envelope",
      ]);
      expect(found(envelope, 24)).toEqual([
        "intent_field_unknown~direction_envelope",
      ]);
      // a free leaf with no markup is not provider syntax (it is an unknown field for gate 24 only)
      const plain = factsFor(B0);
      plain.payload.diagnostic = "ok";
      expect(found(plain, 25)).toEqual([]);
      expect(row(plain, 25).result.facts).toEqual({
        examined: 2,
        expected_examined: 2,
        forbidden_matches: 0,
      });
      // the lint reuses the exported accepted lists, applied to free leaves only
      expect(MARKUP_SAMPLE.every((char) => /[^\p{L}\p{N}]/u.test(char))).toBe(
        true,
      );
      const keyed = factsFor(B0);
      keyed.payload.bad_key = 1;
      expect(
        found(keyed, 25).every(
          (item) => item === "provider_char_class~direction_envelope",
        ),
      ).toBe(true);
      expect(found(keyed, 25)).toHaveLength(1);
      // a UUID-shaped value under a free key is a free leaf and trips the accepted known-tag list
      const uuidFree = factsFor(B0);
      uuidFree.payload.note = IID(3);
      expect(found(uuidFree, 25)).toEqual([
        "provider_known_tag~direction_envelope",
      ]);
    },
    T,
  );

  it(
    "PU15 result_profile_closure_ordering_and_denominators",
    () => {
      const emit = (facts: Facts, position: number, code: string): void => {
        const result = row(facts, position).result;
        expect(
          (result.findings as Obj[]).map((item) => item.code),
          `${String(position)}:${code}`,
        ).toContain(code);
        expect(
          isClosedPerformanceResult(result),
          `${String(position)}:${code}`,
        ).toBe(true);
      };
      const active = [{ state: "none" }, { state: "active" }];
      const [clean1, clean2] = [defined(CLEAN[0]), defined(CLEAN[1])];
      const heightened = mk("t06", "energy_intensity", "heightened");
      const laugh = mk("t12", "non_verbal_event", "laugh", "light");
      const quoteTurn = anchorOfTurn(QUOTE.turn_id);
      const attributedTurn = anchorOfTurn(ATTRIBUTED.turn_id);
      const hedgedTurn = anchorOfTurn(HEDGED.turn_id);
      // W-F1 (i): every input-reachable code of the code table is emitted by a mutation of F0 through the pure evaluators and accepted by the validator
      const dropped = factsFor(B0);
      dropped.intent_rows.pop();
      const outside = factsFor(B0);
      rowOf(outside, 0).turn_id = UNKNOWN;
      rowIntent(outside, 0).scope_ref = UNKNOWN;
      const column = factsFor(B0);
      rowOf(column, 0).turn_id = uuid("t07");
      emit(column, 19, "intent_turn_column_mismatch");
      emit(outside, 19, "intent_turn_missing");
      emit(factsFor([overlap("t03", UNKNOWN)]), 19, "timing_turn_missing");
      emit(
        factsFor([
          overlap("t03", "t04", { background_span: { start: 5, end: 5 } }),
        ]),
        19,
        "span_out_of_range",
      );
      emit(dropped, 19, "denominator_mismatch");
      const versions = factsFor(B0);
      versions.version_rows[0] = {
        ...defined(versions.version_rows[0]),
        script_version_id: PARENT_VERSION,
      };
      emit(versions, 20, "direction_script_version_mismatch");
      const scriptHash = factsFor(B0);
      scriptHash.payload.script_hash = "a".repeat(64);
      emit(scriptHash, 20, "direction_script_hash_mismatch");
      const spec = factsFor(B0);
      spec.payload.direction_spec_version = "performance-render-0.1.3";
      emit(spec, 20, "direction_spec_version_mismatch");
      const unrecomputable = factsFor(B0);
      delete unrecomputable.payload.script_hash;
      emit(unrecomputable, 20, "direction_hash_unrecomputable");
      const hash = factsFor(B0);
      hash.payload.direction_hash = "9".repeat(64);
      emit(hash, 20, "direction_hash_mismatch");
      const positional = factsFor(B0);
      payloadIntent(positional, 1).value = "quicker";
      emit(positional, 20, "payload_row_mismatch");
      emit(dropped, 20, "payload_row_mismatch");
      const twoVersions = factsFor(B0);
      twoVersions.version_rows.push({
        ...defined(twoVersions.version_rows[0]),
      });
      emit(twoVersions, 20, "denominator_mismatch");
      emit(factsFor(B0, { mode: "weekly" }), 21, "mode_unregistered");
      emit(dropped, 21, "denominator_mismatch");
      emit(factsFor(B0), 21, "mode_rule_set_absent");
      emit(
        factsFor([laugh], { mode: "sombre" }),
        22,
        "nonverbal_in_protected_scope",
      );
      const split = factsFor([laugh], { mode: "sombre" });
      rowIntent(split, 0).value = "breath";
      emit(split, 22, "denominator_mismatch");
      emit(
        factsFor([heightened], { mode: "sombre" }),
        22,
        "jocular_set_unowned",
      );
      emit(
        factsFor([laugh], { sensitivities: active }),
        22,
        "sensitivity_scope_mapping_absent",
      );
      emit(
        factsFor([overlap(quoteTurn, clean1)]),
        23,
        "overlap_intersects_quote",
      );
      emit(
        factsFor([overlap(clean1, attributedTurn)]),
        23,
        "overlap_intersects_attribution",
      );
      emit(
        factsFor([overlap(clean1, hedgedTurn)]),
        23,
        "overlap_intersects_qualified",
      );
      const overlapSplit = factsFor([overlap(clean1, clean2)]);
      rowIntent(overlapSplit, 0).intent_type = "pace";
      emit(overlapSplit, 23, "denominator_mismatch");
      emit(
        factsFor([
          overlap(clean1, clean2, { foreground_span: { start: 2, end: 1 } }),
        ]),
        23,
        "overlap_span_unusable",
      );
      emit(
        factsFor([overlap(clean1, clean2)], { sensitivities: active }),
        23,
        "sensitivity_scope_mapping_absent",
      );
      const field = factsFor(B0);
      payloadIntent(field, 0).text = "x";
      emit(field, 24, "intent_field_unknown");
      const envelopeField = factsFor(B0);
      envelopeField.payload.extra = "x";
      emit(envelopeField, 24, "intent_field_unknown");
      const changed = factsFor(B0);
      changed.script = { ...changed.script, recomputed_hash: "d".repeat(64) };
      emit(changed, 24, "script_text_changed");
      emit(dropped, 24, "denominator_mismatch");
      const markup = factsFor(B0);
      markup.payload.diagnostic = "[laughs]";
      emit(markup, 25, "provider_char_class");
      emit(markup, 25, "provider_known_tag");
      // gate 25's denominator guard is an implementation invariant (E3): it is NOT evaluator-reachable. Its agreement is asserted independently,
      // and the closed code and its L-none location are demonstrated by a DIRECT result-validator specimen (not an evaluator emission).
      for (const facts of [factsFor(B0), markup, factsFor([])]) {
        const f = row(facts, 25).result.facts as Obj;
        expect(f.examined).toBe(f.expected_examined);
      }
      const extra = factsFor(B0);
      extra.payload.alpha = "beta";
      extra.payload.gamma = ["delta", "epsilon"];
      // an independent oracle: exactly five free string leaves (alpha, beta, gamma, delta, epsilon), authored from the specimen and not from the evaluator
      expect(row(extra, 25).result.facts).toMatchObject({
        examined: 5,
        expected_examined: 5,
      });
      const specimen: Obj = {
        actor_id: PERFORMANCE_PIN.actor_id,
        actor_kind: "policy",
        check: "performance.no_provider_syntax",
        facts: { examined: 1, expected_examined: 2, forbidden_matches: 0 },
        findings: [{ class: "violation", code: "denominator_mismatch" }],
        fingerprint_stage: "performance",
        schema: "performance-direction-gate-result/1",
        subject_refs: [V0],
      };
      expect(isClosedPerformanceResult(specimen)).toBe(true);
      // W-F4: a denominator mismatch is produced by natural input mutations of 19, 20, 21, 22, 23 and 24
      expect(found(dropped, 19)).toContain("denominator_mismatch");
      expect(found(twoVersions, 20)).toContain("denominator_mismatch");
      expect(found(dropped, 21)).toContain("denominator_mismatch");
      expect(found(split, 22)).toContain("denominator_mismatch");
      expect(found(overlapSplit, 23)).toContain("denominator_mismatch");
      expect(found(dropped, 24)).toContain("denominator_mismatch");
      // W-F2: the validator rejects a code of another definition, a wrong location key, an undeclared or invalid fact, a bad reference and any extra key
      const good = row(markup, 25).result;
      expect(isClosedPerformanceResult(good)).toBe(true);
      const variant = (patch: Obj): Obj => ({
        ...structuredClone(good),
        ...patch,
      });
      const finding = (item: Obj): Obj[] => [item];
      const rejects: [string, Obj][] = [
        ["an extra key", variant({ extra: 1 })],
        ["a wrong schema", variant({ schema: "claims-writing-gate-result/1" })],
        ["a wrong actor", variant({ actor_id: "x" })],
        ["a wrong stage", variant({ fingerprint_stage: "claims_writing" })],
        ["an unknown check", variant({ check: "performance.other" })],
        [
          "a code of another definition",
          variant({
            findings: finding({
              class: "violation",
              code: "intent_turn_missing",
              intent_index: 0,
            }),
          }),
        ],
        [
          "a wrong class",
          variant({
            findings: finding({
              class: "proof_gap",
              code: "provider_char_class",
              intent_index: 0,
            }),
          }),
        ],
        [
          "a wrong location key",
          variant({
            findings: finding({
              class: "violation",
              code: "provider_char_class",
              anchor: "t01",
            }),
          }),
        ],
        [
          "a location of another variant",
          variant({
            findings: finding({
              class: "violation",
              code: "provider_char_class",
              intent_index: 0,
              side: "foreground",
            }),
          }),
        ],
        [
          "a bad reference",
          variant({
            findings: finding({
              class: "violation",
              code: "provider_char_class",
              reference: "other",
            }),
          }),
        ],
        [
          "a bad side",
          variant({
            findings: finding({
              class: "violation",
              code: "provider_char_class",
              intent_index: 0,
              side: "left",
            }),
          }),
        ],
        [
          "a negative index",
          variant({
            findings: finding({
              class: "violation",
              code: "provider_char_class",
              intent_index: -1,
            }),
          }),
        ],
        [
          "an undeclared fact key",
          variant({ facts: { ...(good.facts as Obj), invented: 1 } }),
        ],
        ["a missing fact key", variant({ facts: { examined: 1 } })],
        [
          "a negative fact",
          variant({
            facts: { examined: -1, expected_examined: 0, forbidden_matches: 0 },
          }),
        ],
        [
          "a non-integer fact",
          variant({
            facts: {
              examined: 0.5,
              expected_examined: 0,
              forbidden_matches: 0,
            },
          }),
        ],
        ["two subject refs", variant({ subject_refs: [V0, A0] })],
        ["a non-array findings", variant({ findings: {} })],
        // R2: an own required location key holding `undefined` is a missing value, and a hole in a result array is not an element
        [
          "an own undefined reference",
          variant({
            findings: finding({
              class: "violation",
              code: "provider_char_class",
              reference: undefined,
            }),
          }),
        ],
        [
          "a sparse findings list",
          variant({ findings: new Array<unknown>(1) }),
        ],
        [
          "a sparse subject_refs list",
          variant({ subject_refs: new Array<unknown>(1) }),
        ],
        [
          "an own undefined intent_index",
          {
            ...structuredClone(row(outside, 19).result),
            findings: finding({
              class: "violation",
              code: "intent_turn_missing",
              intent_index: undefined,
            }),
          },
        ],
        [
          "an own undefined side",
          {
            ...structuredClone(
              row(
                factsFor([
                  overlap("t03", "t04", {
                    background_span: { start: 5, end: 5 },
                  }),
                ]),
                19,
              ).result,
            ),
            findings: finding({
              class: "violation",
              code: "span_out_of_range",
              intent_index: 0,
              side: undefined,
            }),
          },
        ],
      ];
      for (const [name, value] of rejects)
        expect(isClosedPerformanceResult(value), name).toBe(false);
      for (const bad of [null, [], "x", 3])
        expect(isClosedPerformanceResult(bad)).toBe(false);
      expect(PERFORMANCE_FACT_KEYS[25]).toEqual([
        "examined",
        "expected_examined",
        "forbidden_matches",
      ]);
      // W-F3: findings shuffled before sorting come back in the deterministic order (class, code position, index, side, use kind/index, reference)
      const noisy = factsFor([overlap(quoteTurn, attributedTurn)], {
        sensitivities: active,
      });
      const noisyFindings = row(noisy, 23).result
        .findings as PerformanceFinding[];
      expect(noisyFindings.length).toBeGreaterThan(2);
      const shuffled = [...noisyFindings].reverse();
      expect(shuffled).not.toEqual(noisyFindings);
      expect(sortPerformanceFindings(23, shuffled)).toEqual(noisyFindings);
      const multi = row(markup, 25).result.findings as PerformanceFinding[];
      expect(sortPerformanceFindings(25, [...multi].reverse())).toEqual(multi);
      // E1 (door E): a non-semantic-JSON value throws a constant-text TypeError BEFORE any row or finding exists
      const notSemantic = new TypeError(
        "performance stored facts are not semantic JSON",
      );
      const mutate = (apply: (facts: Facts) => void): Facts => {
        const f = factsFor(B0);
        apply(f);
        return f;
      };
      const poisons: [string, Facts][] = [
        ["a float", mutate((f) => (f.payload.diagnostic = 0.5))],
        ["a negative zero", mutate((f) => (f.payload.diagnostic = -0))],
        [
          "an unpaired surrogate",
          mutate((f) => (f.payload.diagnostic = "\ud800")),
        ],
        [
          "a duplicate NFC key pair",
          mutate((f) => Object.assign(f.payload, { é: 1, é: 2 })),
        ],
        ["a cyclic object", mutate((f) => (f.payload.self = f.payload))],
        [
          "a float in a stored intent",
          mutate((f) => (rowIntent(f, 0).value = 0.5)),
        ],
        [
          "a float in the artifact",
          mutate((f) => (f.artifact.diagnostic = 0.5)),
        ],
        [
          "a float in a version row",
          mutate((f) => (defined(f.version_rows[0]).diagnostic = 0.5)),
        ],
      ];
      for (const [name, facts] of poisons) {
        expect(() => evaluatePerformanceGates(facts), name).toThrow(
          notSemantic,
        );
        expect(() => evaluatePerformanceGate(facts, 24), name).toThrow(
          notSemantic,
        );
      }
      // ... and the same payload with an ordinary string produces gate 24's envelope finding
      const ordinary = mutate((f) => (f.payload.diagnostic = "ok"));
      expect(found(ordinary, 24)).toEqual([
        "intent_field_unknown~direction_envelope",
      ]);
      // structural programmer errors are constant-text TypeErrors too
      const malformed = new TypeError("performance stored facts are malformed");
      for (const bad of [
        null,
        [],
        {},
        { ...factsFor(B0), payload: [] },
        { ...factsFor(B0), payload: { performance_intents: {} } },
        { ...factsFor(B0), payload: { performance_intents: [1] } },
        { ...factsFor(B0), intent_rows: {} },
        { ...factsFor(B0), sensitivities: [1] },
        { ...factsFor(B0), script: { turns: [] } },
      ])
        expect(() => evaluatePerformanceGates(bad)).toThrow(malformed);
      expect(() => evaluatePerformanceGate(factsFor(B0), 26)).toThrow(
        TypeError,
      );
      // R1: a SPARSE supplied record collection is a structural precondition failure before any row or finding (a hole is never skipped, compacted or replaced by an empty record)
      const sparseOf = (apply: (facts: Facts) => void): Facts => {
        const f = factsFor([]);
        apply(f);
        return f;
      };
      const sparse: [string, Facts][] = [
        [
          "a one-slot version_rows",
          sparseOf((f) => (f.version_rows = new Array<Obj>(1))),
        ],
        [
          "a one-slot intent_rows",
          sparseOf((f) => (f.intent_rows = new Array<Obj>(1))),
        ],
        [
          "a one-slot sensitivities",
          sparseOf((f) => (f.sensitivities = new Array<Obj>(1))),
        ],
        [
          "a one-slot payload intents",
          sparseOf((f) => (f.payload.performance_intents = new Array<Obj>(1))),
        ],
        [
          "a one-slot script turns",
          sparseOf(
            (f) => (f.script = { ...f.script, turns: new Array<Obj>(1) }),
          ),
        ],
        [
          "a one-slot claim uses",
          sparseOf(
            (f) => (f.script = { ...f.script, claim_uses: new Array<Obj>(1) }),
          ),
        ],
        [
          "a one-slot evidence uses",
          sparseOf(
            (f) =>
              (f.script = { ...f.script, evidence_uses: new Array<Obj>(1) }),
          ),
        ],
      ];
      for (const [name, facts] of sparse) {
        expect(() => evaluatePerformanceGates(facts), name).toThrow(malformed);
        expect(() => evaluatePerformanceGate(facts, 20), name).toThrow(
          malformed,
        );
      }
    },
    T,
  );

  it(
    "PU16 aggregate_and_row_outcome_algebra_including_proof_gap_only_fail",
    () => {
      // the local algebra equals the accepted one on the whole grid (A1 failed, A2 incomplete, A3 complete_defined_set)
      const findingsGrid: ("violation" | "proof_gap")[][] = [
        [],
        ["proof_gap"],
        ["violation"],
        ["proof_gap", "violation"],
      ];
      const coverageGrid = [
        [],
        [{ status: "not_established_required" }],
        [{ status: "established_with_limits" }],
        [{ status: "deferred_semantic" }],
      ] as const;
      for (const classes of findingsGrid)
        for (const coverage of coverageGrid) {
          const findings = classes.map((klass) => ({ class: klass }));
          expect(
            performanceAggregateOf(findings, coverage),
            JSON.stringify([classes, coverage]),
          ).toBe(
            aggregateOf(
              findings as unknown as Parameters<typeof aggregateOf>[0],
              coverage as unknown as Parameters<typeof aggregateOf>[1],
            ),
          );
        }
      // 4.8 derived expectations on pinned specimens (door E; hypothetical, not approvals)
      const empty = evaluatePerformanceGates(factsFor([]));
      expect(empty.rows.map((item) => item.outcome)).toEqual(
        Array<string>(7).fill("pass"),
      );
      expect(empty.aggregate).toBe("complete_defined_set"); // for this evaluation only; it authorises nothing and the upstream refusal is unaffected
      expect(empty.rows[1]?.result.facts).toMatchObject({ examined: 1 });
      expect(empty.rows[5]?.result.facts).toMatchObject({
        script_turns_compared: 17,
      });
      expect(
        empty.coverage.filter(
          (item) => item.status === "not_established_required",
        ),
      ).toEqual([]);
      const historical = [
        mk("t01", "energy_intensity", "restrained"),
        mk("t02", "delivery_affect", "warm", "light"),
        mk("t04", "pace", "slower"),
        mk("t08", "delivery_affect", "dry"),
        mk("t13", "energy_intensity", "standard", "light"),
        mk("t14", "pace", "quicker"),
        mk("t16", "delivery_affect", "grave"),
        mk("t17", "energy_intensity", "heightened"),
      ];
      const eight = evaluatePerformanceGates(factsFor(historical));
      expect(eight.rows.map((item) => item.outcome)).toEqual([
        "pass",
        "pass",
        "fail",
        "pass",
        "pass",
        "pass",
        "pass",
      ]);
      const gaps = eight.rows[2]?.result.findings as Obj[];
      expect(gaps).toHaveLength(8);
      expect(
        gaps.every(
          (item) =>
            item.code === "mode_rule_set_absent" && item.class === "proof_gap",
        ),
      ).toBe(true);
      expect(eight.aggregate).toBe("incomplete"); // a proof-gap-only fail row plus the required M01 gap
      expect(eight.coverage.find((item) => item.id === "M01")).toMatchObject({
        status: "not_established_required",
        limit: "mode_forbidden_rule_set_absent",
      });
      const violated = evaluatePerformanceGates(
        factsFor([mk("t12", "non_verbal_event", "laugh", "light")], {
          mode: "sombre",
        }),
      );
      expect(violated.rows[3]?.outcome).toBe("fail");
      expect(violated.aggregate).toBe("failed");
      const gapped = evaluatePerformanceGates(
        factsFor([mk("t06", "energy_intensity", "heightened")], {
          sensitivities: [{ state: "none" }, { state: "active" }],
        }),
      );
      expect(gapped.rows[3]?.outcome).toBe("fail");
      expect(
        (gapped.rows[3]?.result.findings as Obj[]).map((item) => item.code),
      ).toEqual(["jocular_set_unowned", "sensitivity_scope_mapping_absent"]);
      expect(gapped.aggregate).toBe("incomplete");
      expect(gapped.coverage.find((item) => item.id === "S01")).toMatchObject({
        status: "not_established_required",
      });
      const control = evaluatePerformanceGates(
        factsFor([mk("t06", "energy_intensity", "heightened")]),
      );
      expect(control.rows[3]?.outcome).toBe("pass");
      // the evaluation is closed: seven rows in definition order, ids 19..25, every result accepted by the validator
      for (const evaluation of [empty, eight, violated, gapped, control]) {
        expect(evaluation.rows.map((item) => item.gate_definition_id)).toEqual(
          [19, 20, 21, 22, 23, 24, 25].map((n) => gateDefinitionId(n)),
        );
        expect(evaluation.rows.map((item) => item.key)).toEqual([
          ...PERFORMANCE_DEFINITION_KEYS,
        ]);
        for (const item of evaluation.rows) {
          expect(isClosedPerformanceResult(item.result)).toBe(true);
          expect(item.outcome).toBe(
            (item.result.findings as Obj[]).length === 0 ? "pass" : "fail",
          );
          expect(Object.isFrozen(item)).toBe(true);
        }
        expect(evaluation.coverage.map((item) => item.id)).toEqual([
          "M01",
          "S01",
          "B01",
          "Q01",
          "Q02",
          "T01",
          "T02",
          "A01",
        ]);
      }
      expect(empty.coverage.find((item) => item.id === "T01")?.status).toBe(
        "deferred_semantic",
      );
    },
    T,
  );

  it(
    "PU17 supplied_snapshot_classification_examples_not_convergence",
    () => {
      const evaluation = evaluatePerformanceGates(factsFor(B0));
      const direction = SYN.S1.hash;
      const expected: DirectionRows = {
        artifacts: [
          {
            artifact_id: A0,
            artifact_type: "performance_direction",
            content_hash: direction,
          },
        ],
        versions: [
          {
            performance_direction_version_id: V0,
            artifact_id: A0,
            script_version_id: CHILD_VERSION,
          },
        ],
        intents: B0.map((intent, n) => ({
          performance_intent_id: IID(n),
          performance_direction_version_id: V0,
          ...intent,
        })),
        gate_results: evaluation.rows.map((item, n) => ({
          gate_result_id: IID(40 + n),
          gate_definition_id: item.gate_definition_id,
          attempt_id: ATTEMPT,
          input_fingerprint: SYN.S1.performance,
          outcome: item.outcome,
          result: item.result,
        })),
      };
      const performanceIds = new Set(
        [19, 20, 21, 22, 23, 24, 25].map((n) => gateDefinitionId(n)),
      );
      const historicalRows = PLAN.historical.filter((item) =>
        performanceIds.has(item.gate_definition_id),
      );
      expect(historicalRows).toHaveLength(7); // the pinned historical Performance rows (fingerprint d2aab44e...) already inside the 31
      const historicalArtifacts = table("artifacts")
        .filter((item) => item.artifact_type === "performance_direction")
        .map((item) => String(item.artifact_id));
      const historicalVersions = table("performance_direction_versions").map(
        (item) => String(item.performance_direction_version_id),
      );
      expect(historicalArtifacts.length).toBeGreaterThan(0);
      expect(historicalVersions.length).toBeGreaterThan(0);
      const pins: DirectionRowPins = {
        expected,
        script_version_id: CHILD_VERSION,
        fingerprint: SYN.S1.performance,
        historical: {
          artifact_ids: historicalArtifacts,
          version_ids: historicalVersions,
          gate_result_ids: historicalRows.map((item) => item.gate_result_id),
        },
      };
      const empty: DirectionRows = {
        artifacts: [],
        versions: [],
        intents: [],
        gate_results: [],
      };
      const withRows = (
        patch: Partial<Record<keyof DirectionRows, readonly Obj[]>>,
      ): DirectionRows => ({ ...empty, ...patch });
      const full = structuredClone(expected);
      const histRows = historicalRows.map((item) => ({ ...item }));
      const histArtifacts = table("artifacts").filter((item) =>
        historicalArtifacts.includes(String(item.artifact_id)),
      );
      const histVersions = table("performance_direction_versions");
      const classify = (snapshot: DirectionRows) =>
        classifyDirectionRows(snapshot, pins);
      // W-R1 none; W-R2 exact (1 artifact + 1 version + N intents + 7 gate rows, historical rows tolerated); W-R7 historical
      expect(classify(empty)).toBe("none");
      expect(classify(full)).toBe("exact");
      expect(
        classify({
          ...full,
          gate_results: [...full.gate_results, ...histRows],
          artifacts: [...full.artifacts, ...histArtifacts],
          versions: [...full.versions, ...histVersions],
        }),
      ).toBe("exact");
      expect(
        classify(
          withRows({
            gate_results: histRows,
            artifacts: histArtifacts,
            versions: histVersions,
          }),
        ),
      ).toBe("historical");
      // W-R3 partial: an artifact without its version; the intent count differing from N; 1-6 gate rows
      expect(classify(withRows({ artifacts: full.artifacts }))).toBe("partial");
      expect(classify({ ...full, intents: full.intents.slice(1) })).toBe(
        "partial",
      );
      for (let count = 1; count <= 6; count += 1)
        expect(
          classify(
            withRows({ gate_results: full.gate_results.slice(0, count) }),
          ),
          String(count),
        ).toBe("partial");
      expect(
        classify({
          ...full,
          intents: [
            ...full.intents,
            {
              performance_intent_id: IID(60),
              performance_direction_version_id: V0,
            },
          ],
        }),
      ).toBe("partial");
      // W-R4 conflict: a derived id with different content
      expect(
        classify({
          ...full,
          gate_results: full.gate_results.map((item, n) =>
            n === 2 ? { ...item, outcome: "pass" } : item,
          ),
        }),
      ).toBe("conflict");
      expect(
        classify({
          ...full,
          versions: [{ ...defined(full.versions[0]), artifact_id: IID(70) }],
        }),
      ).toBe("conflict");
      // W-R5 stale: another direction hash, another fingerprint
      const otherArtifact = {
        artifact_id: IID(71),
        artifact_type: "performance_direction",
        content_hash: SYN.E0.hash,
      };
      expect(
        classify({ ...full, artifacts: [...full.artifacts, otherArtifact] }),
      ).toBe("stale");
      const staleRow = {
        ...defined(full.gate_results[0]),
        gate_result_id: IID(72),
        input_fingerprint: SYN.E0.performance,
      };
      expect(
        classify({ ...full, gate_results: [...full.gate_results, staleRow] }),
      ).toBe("stale");
      // W-R6 foreign: a second direction for the final script; an unknown row for definitions 19-25 at the expected fingerprint
      const secondVersion = {
        performance_direction_version_id: IID(73),
        artifact_id: IID(74),
        script_version_id: CHILD_VERSION,
      };
      expect(
        classify({ ...full, versions: [...full.versions, secondVersion] }),
      ).toBe("foreign");
      const foreignRow = {
        ...defined(full.gate_results[0]),
        gate_result_id: IID(75),
      };
      expect(
        classify({ ...full, gate_results: [...full.gate_results, foreignRow] }),
      ).toBe("foreign");
      expect(
        classify({
          ...full,
          artifacts: [
            ...full.artifacts,
            { ...otherArtifact, content_hash: direction },
          ],
        }),
      ).toBe("foreign");
      // priority: conflict beats stale beats foreign beats partial
      const conflicted = full.gate_results.map((item, n) =>
        n === 0 ? { ...item, outcome: "fail" } : item,
      );
      expect(
        classify({
          ...full,
          gate_results: [...conflicted, staleRow],
          versions: [...full.versions, secondVersion],
        }),
      ).toBe("conflict");
      expect(
        classify({
          ...full,
          gate_results: [...full.gate_results, staleRow],
          versions: [...full.versions, secondVersion],
        }),
      ).toBe("stale");
      expect(
        classify({
          ...full,
          versions: [...full.versions, secondVersion],
          intents: full.intents.slice(1),
        }),
      ).toBe("foreign");
      // R4: each expected identity is satisfied ONCE per table; a repeat is a duplicate extra, never a second satisfied expected row
      const firstIntent = defined(full.intents[0]);
      expect(classify({ ...full, intents: [firstIntent, firstIntent] })).toBe(
        "partial",
      ); // duplicate compensation: A,A in place of A,B
      expect(
        classify({ ...full, intents: [...full.intents, firstIntent] }),
      ).toBe("partial"); // a complete carrier plus one duplicate
      expect(
        classify({
          ...full,
          gate_results: [...full.gate_results, defined(full.gate_results[3])],
        }),
      ).toBe("partial");
      expect(
        classify({
          ...full,
          intents: [
            ...full.intents,
            { ...firstIntent, intent: { changed: true } },
          ],
        }),
      ).toBe("conflict"); // same id, unequal content
      // a version of ANOTHER script is not this snapshot's concern
      expect(
        classify({
          ...full,
          versions: [
            ...full.versions,
            { ...secondVersion, script_version_id: PARENT_VERSION },
          ],
        }),
      ).toBe("exact");
      // these are supplied-snapshot examples: no pool, driver call or write is involved
      expect(DRIVER.calls).toBeGreaterThanOrEqual(0);
    },
    T,
  );

  it(
    "PU18 performance_reader_normal_path_order_and_failure_settlement_bounds",
    async () => {
      const statements = gateSnapshotStatements(PLAN);
      expect(statements).toHaveLength(145);
      expect(GATE_SNAPSHOT_STATEMENT_COUNT).toBe(146);
      expect(PERFORMANCE_READER_CALLS).toEqual({
        selects: 146,
        normal: 148,
        failure_bound: 149,
      });
      const begin = "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY";
      const run = async (
        setup: (pool: ScriptPool) => void,
      ): Promise<{
        pool: ScriptPool;
        result: Awaited<ReturnType<typeof readPerformanceSnapshot>>;
      }> => {
        const pool = new ScriptPool();
        setup(pool);
        const result = await readPerformanceSnapshot(asPool(pool), PPLAN);
        expect(pool.unexpected).toEqual([]);
        return { pool, result };
      };
      const failAt =
        (ordinal: number, text?: string) =>
        (pool: ScriptPool): void => {
          pool.hook = (call) => {
            if (
              call.ordinal === ordinal &&
              (text === undefined || call.text === text)
            )
              throw new Error("injected failure");
          };
        };
      const closed = (cleanup: number) => ({
        ok: false,
        cleanup: { attached_errors: cleanup, complete: true },
      });
      const releases = (pool: ScriptPool): unknown[][] =>
        pool.clients.map((client) => client.releases);
      // R1 normal path: BEGIN, 145 static SELECTs in the exact upstream order, the one native expected-row SELECT, COMMIT; one release(true); 148 calls
      const normal = await normalRead();
      const texts = normal.pool.all();
      expect(texts).toHaveLength(148);
      expect(texts[0]).toBe(begin);
      expect(texts.slice(1, 146)).toEqual(
        statements.map((statement) => statement.text),
      );
      expect(texts[146]).toBe(expectedComparisonStatement([]).text);
      expect(texts[147]).toBe("COMMIT");
      expect(texts.includes("ROLLBACK")).toBe(false);
      expect(releases(normal.pool)).toEqual([[true]]);
      expect(normal.pool.connects).toBe(1);
      expect(normal.acquisition.plan).toBe(PPLAN);
      expect(normal.acquisition.candidate.kind).toBe("ready");
      expect(normal.acquisition.raw.expected).toBe("full");
      expect(normal.acquisition.raw.flags).toHaveLength(49);
      // R2 connect rejected: nothing acquired, no ROLLBACK, no release
      const r2 = await run(
        (pool) => (pool.connectError = new Error("connect failed")),
      );
      expect(r2.result).toEqual(closed(0));
      expect(r2.pool.total()).toBe(0);
      expect(releases(r2.pool)).toEqual([]);
      // R3 BEGIN fails: BEGIN, ROLLBACK; one release
      const r3 = await run(failAt(1));
      expect(r3.result).toEqual(closed(0));
      expect(r3.pool.total()).toBe(2);
      expect(r3.pool.all()).toEqual([begin, "ROLLBACK"]);
      expect(releases(r3.pool)).toEqual([[true]]);
      // R4 statement 0 fails: BEGIN, the attempt, ROLLBACK
      const r4 = await run(failAt(2));
      expect(r4.result).toEqual(closed(0));
      expect(r4.pool.total()).toBe(3);
      // R5 statement 72 fails: BEGIN + 73 attempts + ROLLBACK
      const r5 = await run(failAt(74));
      expect(r5.result).toEqual(closed(0));
      expect(r5.pool.total()).toBe(75);
      expect(r5.pool.all()[74]).toBe("ROLLBACK");
      // R6 statement 144 fails: BEGIN + 145 attempts + ROLLBACK
      const r6 = await run(failAt(146));
      expect(r6.result).toEqual(closed(0));
      expect(r6.pool.total()).toBe(147);
      // R7 the native expected-row SELECT fails: BEGIN + 145 + 1 + ROLLBACK
      const r7 = await run(failAt(147));
      expect(r7.result).toEqual(closed(0));
      expect(r7.pool.total()).toBe(148);
      // R8 COMMIT fails: the failure bound (149 = 148 + one ROLLBACK)
      const r8 = await run(failAt(148, "COMMIT"));
      expect(r8.result).toEqual(closed(0));
      expect(r8.pool.total()).toBe(PERFORMANCE_READER_CALLS.failure_bound);
      expect(r8.pool.all()[148]).toBe("ROLLBACK");
      expect(releases(r8.pool)).toEqual([[true]]);
      // R9 the fault hook throws after the first read: the throwable is held, ROLLBACK + release, then rethrown UNCHANGED
      const boom = new Error("injected fault");
      const r9pool = new ScriptPool();
      await withFaults(
        (point) => {
          expect(point).toBe(
            "performance_direction_admission_after_first_read",
          );
          throw boom;
        },
        async () => {
          await expect(
            readPerformanceSnapshot(asPool(r9pool), PPLAN),
          ).rejects.toBe(boom);
        },
      );
      expect(r9pool.total()).toBe(3);
      expect(r9pool.all()[2]).toBe("ROLLBACK");
      expect(releases(r9pool)).toEqual([[true]]);
      // the fault point is inert without the flag (the normal run above never called a hook)
      expect(process.env.DESK_TEST_FAULTS).not.toBe("1");
      // R10 an unowned throwable from staging propagates with its identity after the bounded cleanup (BEGIN + 145 + ROLLBACK)
      const unowned = new Error("unowned staging failure");
      const r10pool = new ScriptPool();
      r10pool.mutate = (results) => {
        results[144] = new Proxy([], {
          get: () => {
            throw unowned;
          },
        });
      };
      await expect(
        readPerformanceSnapshot(asPool(r10pool), PPLAN),
      ).rejects.toBe(unowned);
      expect(r10pool.total()).toBe(147);
      expect(r10pool.all()[146]).toBe("ROLLBACK");
      expect(releases(r10pool)).toEqual([[true]]);
      // R11 statement 0 fails and the ROLLBACK itself fails: counted, never retried
      const r11 = await run((pool) => {
        pool.hook = (call) => {
          if (call.ordinal === 2 || call.text === "ROLLBACK")
            throw new Error("injected failure");
        };
      });
      expect(r11.result).toEqual(closed(1));
      expect(r11.pool.total()).toBe(3);
      expect(releases(r11.pool)).toEqual([[true]]);
      // R12 normal, then release throws: a failed settlement with no acquisition and no invented extra query
      const r12 = await run((pool) => {
        pool.onClient = (client) => {
          client.releaseThrows = new Error("release failed");
        };
      });
      expect(r12.result).toEqual(closed(1));
      expect(r12.pool.total()).toBe(148);
      expect(r12.pool.all().includes("ROLLBACK")).toBe(false);
      // R13 a connection error EVENT after the reader attached its listener (emitted from the hook at ordinal 2, the first SELECT; the hook does not throw):
      // BEGIN, the first SELECT, ROLLBACK (three calls), no acquisition, closed cleanup, one release(true); the reader listener is detached, the pool's stays
      const evented = await run((pool) => {
        pool.hook = (call, client) => {
          if (call.ordinal === 2)
            client.emit("error", new Error("socket lost"));
        };
      });
      expect(evented.result).toEqual(closed(0));
      expect(evented.pool.total()).toBe(3);
      expect(evented.pool.all()[0]).toBe(begin);
      expect(evented.pool.all()[2]).toBe("ROLLBACK");
      expect(releases(evented.pool)).toEqual([[true]]);
      const socketClient = defined(evented.pool.clients[0]);
      expect(socketClient.listeners("error")).toEqual([
        socketClient.poolListener,
      ]);
    },
    T,
  );

  it(
    "PU19 admission_refusals_through_the_scripted_reader_zero_effects",
    async () => {
      const clean = { attached_errors: 0, complete: true };
      const refuse = async (
        db: GateDb,
      ): Promise<{
        refusal: Awaited<ReturnType<typeof refusePerformanceDirection>>;
        pool: ScriptPool;
      }> => {
        const pool = new ScriptPool(db);
        const refusal = await refusePerformanceDirection(asPool(pool), PPLAN);
        expect(pool.total()).toBe(PERFORMANCE_READER_CALLS.normal);
        expect(pool.unexpected).toEqual([]);
        // zero effects: no statement other than a read-only SELECT, BEGIN and COMMIT was ever sent
        for (const text of pool.all())
          expect(
            /^(?:SELECT|BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY$|COMMIT$)/u.test(
              text.trimStart(),
            ),
            text.slice(0, 40),
          ).toBe(true);
        expect(refusal).toMatchObject({
          kind: "refused",
          stage: "admission",
          writes_attempted: 0,
          durable: { performance: "not_read" },
          cleanup: clean,
          reconciled: false,
        });
        return { refusal, pool };
      };
      // W-A1: the gate rows are absent (only the 31 historical rows)
      const absent = new GateDb();
      const first = await refuse(absent);
      expect(first.refusal.code).toBe("perf_upstream_gate_absent");
      expect(first.refusal.upstream).toEqual({ class: "state", gate_state: 0 });
      expect(classifyPure(absent)).toEqual({
        kind: "state",
        gate: 0,
        texture: 4,
      });
      // W-A2 (scripted twin of the required integration case): the 18 owned rows equal to the candidate rows, content 16 pass / 2 fail
      const recorded = new GateDb(OWNED_STORED);
      expect(
        OWNED_STORED.filter((item) => item.outcome === "pass"),
      ).toHaveLength(16);
      expect(
        OWNED_STORED.filter((item) => item.outcome === "fail"),
      ).toHaveLength(2);
      const second = await refuse(recorded);
      expect(second.refusal.code).toBe("perf_upstream_gate_failed");
      expect(second.refusal.upstream).toEqual({
        class: "state",
        gate_state: 18,
        aggregate: "failed",
      });
      expect(classifyPure(recorded)).toEqual({
        kind: "state",
        gate: 18,
        texture: 4,
      });
      // W-A3: an upstream stop is carried verbatim and equals the code classifyGateRaw returns over the SAME captured raw
      const stranded = new GateDb();
      stranded.textureState = 2;
      const third = await refuse(stranded);
      const expectedStop = classifyPure(stranded);
      expect(expectedStop.kind).toBe("stop");
      if (expectedStop.kind !== "stop") return;
      expect(expectedStop.row.code).toBe("gate_texture_incomplete");
      expect(third.refusal.code).toBe("perf_upstream_stopped");
      expect(third.refusal.upstream).toEqual({
        class: "stop",
        code: expectedStop.row.code,
        stage: expectedStop.row.stage,
      });
      const mismatched = new GateDb();
      const definition = defined(
        mismatched.definitions.get(gateDefinitionId(1)),
      );
      definition.version = "9";
      const fourth = await refuse(mismatched);
      const expectedMismatch = classifyPure(mismatched);
      expect(expectedMismatch.kind).toBe("stop");
      if (expectedMismatch.kind !== "stop") return;
      expect(fourth.refusal.code).toBe("perf_upstream_stopped");
      expect(fourth.refusal.upstream).toEqual({
        class: "stop",
        code: expectedMismatch.row.code,
        stage: expectedMismatch.row.stage,
      });
      expect(expectedMismatch.row.code).toBe("gate_definitions_mismatch");
      // unchanged scripted-map preservation only (the scripted database objects were never written by any of the four reads above). This does NOT repeat
      // a reader: PI04 in the integration file is the actual repeated-reader idempotence witness.
      expect(recorded.rows.size).toBe(31 + 18);
      expect(absent.rows.size).toBe(31);
      // a reader failure is `perf_upstream_unavailable` carrying the reader's own settlement, never an upstream verdict
      const failing = new ScriptPool();
      failing.hook = (call) => {
        if (call.ordinal === 2 || call.text === "ROLLBACK")
          throw new Error("injected failure");
      };
      const unavailable = await refusePerformanceDirection(
        asPool(failing),
        PPLAN,
      );
      expect(unavailable).toMatchObject({
        code: "perf_upstream_unavailable",
        upstream: { class: "unavailable" },
        cleanup: { attached_errors: 1, complete: true },
        writes_attempted: 0,
      });
    },
    T,
  );

  it(
    "PU20 audit_boundary_and_pure_fingerprint_arithmetic_not_readiness",
    () => {
      // W-U1: the semantic-audit carrier accepts only empty findings; a non-empty list is rejected by the existing helper
      const projection = auditInput({
        package_hash: PACKAGE_HASH,
        brief_hash: BRIEF_HASH,
        script_hash: CHILD_HASH,
        performance_direction_hash: SYN.S1.hash,
      });
      const result = {
        auditor_kind: "fixture_stub_semantic_auditor",
        auditor_version: "semantic-auditor-v1",
        input_projection: projection,
        input_fingerprint: SYN.S1.audit,
        result: "pass",
        findings: [] as unknown[],
        fixture_stub: true,
      };
      expect(semanticAuditResultHash(result)).toMatch(/^[0-9a-f]{64}$/u);
      let rejected: unknown;
      try {
        semanticAuditResultHash({ ...result, findings: [{ code: "x" }] });
      } catch (error) {
        rejected = error;
      }
      expect(rejected).toBeInstanceOf(ProfileRejected);
      expect((rejected as ProfileRejected).code).toBe(
        "audit_findings_unsupported",
      );
      // W-U2: the eight-key audit-input fingerprint of SYN-E0, SYN-S1 and SYN-S2 is pure arithmetic and succeeds; it is NOT audit-dispatch readiness
      for (const literal of Object.values(SYN))
        expect(
          auditInputFingerprint({
            package_hash: PACKAGE_HASH,
            brief_hash: BRIEF_HASH,
            script_hash: CHILD_HASH,
            performance_direction_hash: literal.hash,
          }),
        ).toBe(literal.audit);
      // no runtime-ready authority is minted by anything in this scope: the current upstream is a refusal, and a synthetic complete aggregate stays unimplemented
      expect(
        admissionOf(
          { kind: "state", gate: 18, texture: 4 },
          "complete_defined_set",
        ).code,
      ).toBe("perf_positive_branch_unimplemented");
      // the counted doors, literally: one API-level open here plus four inside the one real chain plan (5 for the file), one real plan build, one
      // pinned-member read by the Performance planner, and the scripted driver calls (no database). Source-derived decomposition (all-assertions-reached route):
      // R1-R12 with the shared normal acquisition counted once = 973 (5 staging evaluations, one attempted throwing stage); the repaired socket-event witness R13 = 3
      // (0 staging); the four PU19 full refusal reads = 4 x 148 = 592 (4 staging); the PU19 unavailable read with a failed rollback = 3 (0 staging). Total 1,571
      // scripted calls and 9 scripted-reader staging evaluations; the four direct `classifyPure` calls add 4 further `stageGateSnapshot` invocations and no SQL, so 13
      // staging invocations in all. The module-level `evaluateGateComponent` and PU02's `evaluateWritingChecks` are pure calls, not stages.
      expect(CALLS.opens).toBe(1);
      expect(CALLS.chainBuilds).toBe(1);
      expect(PERFORMANCE_PLAN_READS).toEqual(["foundation_rows_398.json"]);
      expect(CALLS.opens + 4).toBe(5);
      expect(DRIVER.calls).toBe(973 + 3 + 592 + 3);
      expect(DRIVER.calls).toBe(1571);
    },
    T,
  );
});

/** Sample of the exported markup characters (a sanity anchor only: the lint reuses the accepted exported lists unchanged). */
const MARKUP_SAMPLE: readonly string[] = Array.from('[]<>{}|="`~^\\_');
