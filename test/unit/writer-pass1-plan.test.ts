// Unit tests of the fixed writer Pass-1 plan, admission, mapping and stop-mapping logic (DB-free). They call the real
// `buildFixtureWriterInput()` (the inherited native extraction path), the real repository identity helpers and real error instances.
// Every negative is a one-field mutation of a passing case: the positive control is asserted first, the named first error and its stage
// are asserted, and the repair (undoing the mutation) is asserted to succeed again. Literals below are the independently derived design
// values; they are never adjusted to fit the implementation.
import { EventEmitter } from "node:events";

import type { Pool } from "pg";
import { beforeAll, describe, expect, it } from "vitest";

import { openFixturePack } from "../../src/fixture/pack.js";
import {
  PASS1_SPECIMEN,
  PASS1_SPECIMEN_CANONICAL_SHA256,
} from "../../src/fixture/writer-pass1-specimen.js";
import {
  evidencePackageHash,
  scriptHash,
  scriptProjection,
  showrunnerBriefHash,
  writerContextManifestHash,
  writerViewHash,
} from "../../src/identity/artifacts.js";
import {
  canonicalBytes,
  domainHash,
  sha256,
} from "../../src/identity/canonical-json.js";
import { governedDomainHash } from "../../src/identity/domains.js";
import {
  assertCompletePromptManifestPayload,
  modelSemanticInputHash,
  promptManifestArtifactHash,
} from "../../src/identity/prompt-manifest.js";
import {
  CommandConnectionError,
  runCommand,
} from "../../src/runtime/command.js";
import { KNOWN_OUTCOME_CODES } from "../../src/runtime/observe.js";
import { ProviderExecutionError } from "../../src/runtime/provider.js";
import type { ExecuteResult } from "../../src/runtime/provider.js";
import {
  FixtureWriterInputFault,
  buildFixtureWriterInput,
  type FixtureWriterInputResult,
} from "../../src/runtime/writer-fixture-input.js";
import {
  PASS1_PIN,
  PROVIDER_FIELDS,
  REQUEST_RECIPE,
  TABLE_SPECS,
  bareStop,
  buildPromptManifest,
  checkManifestPair,
  checkRightsPolicy,
  classifyExecuteResult,
  classifyPass1Snapshot,
  compareStored,
  derivePass1Id,
  executeWriterPass1Call,
  initialContext,
  instantMicros,
  isAdmittedPlan,
  mergeDurable,
  mergeFact,
  planWriterPass1,
  readPass1Snapshot,
  reconcileScriptRows,
  recordWriterPass1Lineage,
  renderWriterPass1Request,
  requestMatchesPin,
  sameInstant,
  sameJson,
  scanForWithheld,
  sharesRun,
  snapshotFailureRow,
  stageWriterPass1Inputs,
  stopFrom,
  stopRowForThrown,
  utcMicros,
  verifyDurableProvider,
  type Context,
  type Durable,
  type Pass1Plan,
  type Pass1Stopped,
  type PlannedRow,
  type RawSnapshot,
  type StopCode,
} from "../../src/runtime/writer-pass1.js";

type Obj = Record<string, unknown>;
const T = 120000; // the real factory, the pack and several plans per case
const INV = {
  attempt_id: "e5aaee76-ec19-4917-b293-24a0435b3a92",
  started_at: "2026-10-20T00:00:00Z",
  ended_at: "2026-10-20T00:00:01Z",
  created_at: "2026-10-20T00:00:02Z",
};
// the same two instants and the creation time written with offsets and six fractional digits
const INV_OFFSET = {
  attempt_id: INV.attempt_id,
  started_at: "2026-10-20T02:00:00.500000+02:00",
  ended_at: "2026-10-19T19:00:01.250000-05:00",
  created_at: "2026-10-20T00:00:02.000001+00:00",
};
const ANCHORS = Array.from({ length: 17 }, (_, i) =>
  `t${String(i + 1).padStart(2, "0")}`,
);
const C8 = "d1250008-0000-4000-8000-000000000008";
const E11 = "d1250007-0000-4000-8000-000000000011";
const E03 = "d1250007-0000-4000-8000-000000000003";
const E04 = "d1250007-0000-4000-8000-000000000004";
const C4 = "d1250008-0000-4000-8000-000000000004";
const C3 = "d1250008-0000-4000-8000-000000000003";
const PERMITTED_ORIGINALS = [1, 2, 5, 6, 7, 9].map(
  (n) => `d1250008-0000-4000-8000-00000000000${String(n)}`,
);
const R005 = "d1250006-0000-4000-8000-000000000005";
const UNKNOWN4: Durable = {
  t1: "unknown",
  reservation: "unknown",
  outcome: "unknown",
  lineage: "unknown",
};
const NONE4: Durable = {
  t1: "none_observed",
  reservation: "none_observed",
  outcome: "none_observed",
  lineage: "none_observed",
};
const PRESENT4: Durable = {
  t1: "present",
  reservation: "present",
  outcome: "present",
  lineage: "present",
};
// The 40 derived ids of the design packet (independently derived; `proposed/derived-ids.json`).
const EXPECTED_IDS: Readonly<Record<string, string>> = {
  "artifact:writer_view_v2": "5a290685-a66e-444b-94aa-ce8843b295fe",
  "artifact:writer_context_manifest_v2": "730e7ef5-22bf-4bd1-8f34-532ed7fc47af",
  "artifact:prompt_manifest_2": "a8e36084-403b-4d60-8468-2ceb7a133f5b",
  "artifact:script_pass1": "c392b9c1-57ac-4d12-ac9b-56665f102c40",
  prompt_manifest: "4b7b9fce-f2a2-4597-ba67-1383914294c4",
  provider_call: "0fdc9bff-feff-4df6-b860-342c8586c19b",
  model_run: "2f3381df-640c-43d1-9f8f-85946e9bf833",
  script_version: "b0848965-f388-46bd-8615-221a8c4e6af7",
  "turn:t01": "73b1a741-bd93-4ca9-922b-3a69fb09e93a",
  "turn:t02": "f8330400-a196-4b0d-961f-9d6b93016ede",
  "turn:t03": "a3872c32-c1a2-4635-8747-1bc4f62410d3",
  "turn:t04": "36b51d03-0e78-490d-aafd-e27c42f787d5",
  "turn:t05": "a39843f5-b76e-440b-ae4f-f0b6b23b953a",
  "turn:t06": "9dd7c015-562a-4a40-b5ea-d77d7f299329",
  "turn:t07": "3ef4821e-22ec-4546-9df4-2b08717571a6",
  "turn:t08": "c7e188a8-6b6b-4cd8-9a75-635da88ae23d",
  "turn:t09": "004df251-ddc3-43ce-8c98-b9d21fc561c4",
  "turn:t10": "9797271b-07b2-4e20-a360-48ab31712d2a",
  "turn:t11": "7753d311-6336-44c6-a0ea-8ce61bdad932",
  "turn:t12": "f9dc7cba-d7ef-49ca-9f52-9c1efda95dd9",
  "turn:t13": "8e79ebb0-8fb0-4eb4-ab4a-c8ccda29ba92",
  "turn:t14": "f176cc61-93d2-486d-967e-fc9d4aefee7d",
  "turn:t15": "83ca6355-d90b-4dff-b67d-ba4374214ed4",
  "turn:t16": "4304c3b9-22ed-47af-abf7-e05afb7a5b6f",
  "turn:t17": "d2850ee6-0ad6-4c26-85e7-3b5b8018eb9d",
  "turn_claim_use:t04:01:asserted:0": "2f93dff0-159f-4c3d-a7d7-1e97067f75cf",
  "turn_claim_use:t04:02:asserted:109": "6da79661-8075-47e1-be13-0f0facffd824",
  "turn_claim_use:t05:07:asserted:49": "bc3f6e5c-824b-48c8-809f-82e15c0e64d4",
  "turn_claim_use:t06:03:attributed:27": "12d89987-eea0-44d7-9948-098a05f8a218",
  "turn_claim_use:t07:04:hedged:0": "16b4c5df-bd83-42ee-9ae4-1ba5d3fa0a3f",
  "turn_claim_use:t10:05:attributed:0": "e1cc2348-594d-4303-946f-bd774cfb932a",
  "turn_claim_use:t11:06:asserted:73": "4f0065e0-1799-4cb4-8168-04fa4f83a078",
  "turn_claim_use:t12:06:asserted:9": "4e171051-b489-4093-844a-80bc7790b744",
  "turn_claim_use:t13:07:asserted:0": "26890701-1ccf-4ba9-83e3-e1c1e551ea3d",
  "turn_claim_use:t14:01:asserted:4": "82f7f6fd-524e-4c5a-abd0-cf7d683c3c99",
  "turn_claim_use:t14:09:asserted:24": "3e00b668-133c-42e8-b2c8-d307fa89b722",
  "turn_claim_use:t17:01:asserted:26": "d9d1eb4c-1d0a-4f37-a1a0-292cb5590343",
  "turn_evidence_use:t06:03:paraphrased:27":
    "7e7533b7-33f8-4145-afcb-36e194fd9ce1",
  "turn_evidence_use:t07:04:paraphrased:0":
    "e648fbc6-842a-4557-8108-0cfd9f7fa47a",
  "turn_evidence_use:t11:09:quoted:73": "94c8f0d4-4e45-4aa3-a6bc-f088b870b8ed",
};

interface MTurn {
  semantic_turn_id: string;
  sequence: number;
  program_block_id: string;
  participant_id: string;
  spoken_text: string;
  [key: string]: unknown;
}
interface MUse {
  semantic_turn_id: string;
  claim_id?: string;
  evidence_unit_id?: string;
  use_mode: string;
  span_start: number;
  span_end: number;
  claim_state_hash?: string;
  rights_policy_version?: string;
}
interface MPrediction {
  prediction_candidate_id: string;
  semantic_turn_id: string;
  participant_id: string;
  prediction_text: string;
  horizon: string;
  topic_thread_id: string;
}
interface MSpec {
  schema: string;
  script_phase: string;
  revision_reason: string;
  purpose: string;
  writing_policy_version: string;
  brief_hash: string;
  package_hash: string;
  program_block_refs: string[];
  turns: MTurn[];
  turn_claim_uses: MUse[];
  turn_evidence_uses: MUse[];
  prediction_candidates: MPrediction[];
  [key: string]: unknown;
}
const clone = (): MSpec =>
  JSON.parse(JSON.stringify(PASS1_SPECIMEN)) as MSpec;
const turnOf = (spec: MSpec, anchor: string): MTurn => {
  const turn = spec.turns.find((t) => t.semantic_turn_id === anchor);
  if (!turn) throw new Error(`no turn ${anchor}`);
  return turn;
};
const claimUse = (spec: MSpec, claim: string): MUse => {
  const use = spec.turn_claim_uses.find((u) => u.claim_id === claim);
  if (!use) throw new Error(`no claim use ${claim}`);
  return use;
};
const evidenceUse = (spec: MSpec, unit: string): MUse => {
  const use = spec.turn_evidence_uses.find((u) => u.evidence_unit_id === unit);
  if (!use) throw new Error(`no evidence use ${unit}`);
  return use;
};

let real: FixtureWriterInputResult;
let plan: Pass1Plan;
let wObj: Obj;
let cObj: Obj;
let brief: Obj;
let rows: Obj;
let historical: Obj;
let packagePayload: unknown;
let originals: { c3: string; c4: string };
const realBuild = (): FixtureWriterInputResult => real;
const records = (value: unknown): Obj[] =>
  Array.isArray(value)
    ? value.filter((v): v is Obj => typeof v === "object" && v !== null)
    : [];
const planWith = (specimen: unknown, invocation: unknown = INV) =>
  planWriterPass1(invocation, { build: realBuild, specimen });
const stopOf = (result: ReturnType<typeof planWriterPass1>): Pass1Stopped => {
  if (result.kind !== "stopped") throw new Error("expected a stop");
  return result;
};
const codeOf = (specimen: unknown): StopCode =>
  stopOf(planWith(specimen)).code;
/**
 * One-field mutation protocol: the positive control plans first, the mutation stops with the named first error at the admission stage
 * with nothing written and every fact unknown, and the repair (an unmutated clone) plans again.
 */
const refusal = (
  mutate: (spec: MSpec) => void,
  code: StopCode,
): Pass1Stopped => {
  expect(planWith(clone()).kind).toBe("planned");
  const spec = clone();
  mutate(spec);
  const stop = stopOf(planWith(spec));
  expect(stop.code).toBe(code);
  expect(stop.stage).toBe("admission");
  expect(stop.writes_attempted).toBe(false);
  expect(stop.durable).toEqual(UNKNOWN4);
  expect(planWith(clone()).kind).toBe("planned");
  return stop;
};

beforeAll(() => {
  real = buildFixtureWriterInput();
  if (real.kind !== "fixture_writer_input") throw new Error("factory refused");
  const data = real.data as unknown as Obj;
  wObj = data.writer_data as Obj;
  cObj = data.writer_context_manifest as Obj;
  const result = planWriterPass1(INV, { build: realBuild });
  if (result.kind !== "planned") throw new Error(`plan stopped ${result.code}`);
  plan = result.plan;
  const pack = openFixturePack();
  brief = pack.json("showrunner_brief.json") as Obj;
  rows = (pack.json("foundation_rows_398.json") as Obj).tables as Obj;
  historical = pack.json("script_pass1.json") as Obj;
  packagePayload = pack.json("evidence_package.json");
  const claim = (id: string): Obj =>
    records(rows.claims).find((c) => c.claim_id === id) ?? {};
  originals = {
    c3: String((claim(C3).value as Obj).context),
    c4: String((claim(C4).value as Obj).interpretation),
  };
}, T);

const callRow = (): Obj => ({
  provider_call_id: plan.reservation.provider_call_id,
  attempt_id: plan.reservation.attempt_id,
  provider: "fixture_stub",
  operation: "writer",
  model_identifier: "fixture_stub/writer-pass1-v2",
  request_fingerprint: plan.request_hash,
  logical_request_key: plan.reservation.logical_request_key,
  operational_try_number: 1,
  intentional_take_index: null,
  retry_of_provider_call_id: null,
  reroll_of_provider_call_id: null,
  reroll_trigger_id: null,
  started_at: utcMicros(INV.started_at),
  admitted_at: null,
  reserved_cost_upper_bound: null,
  admission_currency: null,
  admission_policy_hash: null,
  admission_certificate: null,
  admission_certificate_hash: null,
});
// the database-native flags (`usage_eq`, `actual_cost_zero`) are what the verifier reads; the decoded values are only for display
const eventRow = (): Obj => ({
  event_type: "succeeded",
  ended_at: utcMicros(INV.ended_at),
  usage_eq: true,
  actual_cost_zero: true,
  currency: "USD",
  response_artifact_id: null,
  response_reference: plan.response_reference,
  recorded_at: null,
  admission_settlement: null,
});
/** A stored row as the database returns it: decoded columns plus one native equality flag per authored column. */
const asStored = (planned: PlannedRow, over: Obj = {}): Obj => {
  const out: Obj = { ...planned.row, ...over };
  for (const c of planned.spec.cols)
    out[`eq_${c.name}`] = sameJson(out[c.name], planned.row[c.name]);
  return out;
};
const stage = (kind: "t1" | "t3", table?: string): PlannedRow[] =>
  plan[kind].filter((p) => table === undefined || p.spec.table === table);

/** One raw snapshot as the pure classifier receives it, built from the four stage bits (T1, reservation, event, T3). */
interface Bits {
  t1: boolean;
  call: boolean;
  event: boolean;
  t3: boolean;
}
interface Tweak {
  count?: Record<string, number>;
  host?: Obj;
  brief?: Obj;
  rights?: unknown;
}
const EXTRA = [
  "episodes",
  "episode_versions",
  "review_decisions",
  "repair_requests",
  "repair_plans",
  "repair_plan_decisions",
];
const bitsOf = (state: 0 | 1 | 2 | 3 | 4): Bits => ({
  t1: state >= 1,
  call: state >= 2,
  event: state >= 3,
  t3: state >= 4,
});
const rawFor = (bits: Bits, tweak: Tweak = {}): RawSnapshot => {
  const own: Record<string, Obj[]> = {};
  for (const spec of Object.values(TABLE_SPECS)) own[spec.table] = [];
  const add = (list: readonly PlannedRow[]): void => {
    for (const planned of list) own[planned.spec.table]?.push(asStored(planned));
  };
  if (bits.t1) add(plan.t1);
  if (bits.t3) add(plan.t3);
  const counts = [...Object.keys(plan.fixture_counts), ...EXTRA].map((name) => {
    const extra =
      name === "provider_calls"
        ? bits.call
          ? 1
          : 0
        : name === "provider_call_events"
          ? bits.event
            ? 1
            : 0
          : (own[name]?.length ?? 0);
    return {
      t: name,
      n: (plan.fixture_counts[name] ?? 0) + extra + (tweak.count?.[name] ?? 0),
    };
  });
  const policy = records(rows.rights_versions).find(
    (r) => r.rights_version_id === R005,
  )?.policy;
  return {
    host: {
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
      ...tweak.host,
    },
    brief: {
      showrunner_brief_version_id: PASS1_PIN.host.showrunner_brief_version_id,
      artifact_id: PASS1_PIN.host.brief_artifact_id,
      attempt_id: PASS1_PIN.host.attempt_id,
      evidence_package_id: PASS1_PIN.host.evidence_package_id,
      revision_parent_id: null,
      payload: brief,
      ...tweak.brief,
    },
    pkg: {
      evidence_package_id: PASS1_PIN.host.evidence_package_id,
      artifact_id: PASS1_PIN.host.package_artifact_id,
      package_hash: plan.script_payload.package_hash,
      payload: packagePayload,
    },
    claims: plan.claims.map((c) => ({ ...c })),
    evidence: plan.evidence.map((e) => ({ ...e })),
    rights: {
      rights_version_id: R005,
      policy: "rights" in tweak ? tweak.rights : policy,
    },
    own,
    call: bits.call ? callRow() : undefined,
    events: bits.event ? [eventRow()] : [],
    counts,
  };
};

/** A scripted pool/client in the style of test/runtime-command-connection.test.ts, recording every statement and release. */
class FakeClient extends EventEmitter {
  readonly statements: string[] = [];
  readonly releases: unknown[] = [];
  readonly log: string[] = [];
  script = new Map<string, () => Promise<unknown>>();
  failOn: ((text: string) => boolean) | undefined;
  rowsFor: ((text: string) => unknown[]) | undefined;
  afterQuery: ((text: string) => void) | undefined;
  poolListener = (): void => undefined;
  releaseThrows: Error | undefined;
  query(text: string): Promise<{ rows: unknown[] }> {
    this.statements.push(text);
    this.log.push(`query ${text.split(" ")[0] ?? text}`);
    this.afterQuery?.(text);
    if (this.failOn?.(text)) return Promise.reject(new Error("statement failed"));
    const step = this.script.get(text);
    if (step) return step().then(() => ({ rows: [] }));
    if (text.includes("transaction_isolation"))
      return Promise.resolve({ rows: [{ level: "read committed" }] });
    return Promise.resolve({ rows: this.rowsFor?.(text) ?? [] });
  }
  release(arg?: unknown): void {
    this.on("error", this.poolListener); // pg-pool re-attaches its own listener first
    this.releases.push(arg);
    this.log.push("release");
    if (this.releaseThrows) throw this.releaseThrows;
  }
}
class FakePool {
  connects = 0;
  readonly queries: string[] = [];
  connectError: unknown;
  constructor(readonly client: FakeClient) {}
  connect(): Promise<FakeClient> {
    this.connects += 1;
    return this.connectError === undefined
      ? Promise.resolve(this.client)
      : Promise.reject(
          this.connectError instanceof Error
            ? this.connectError
            : new Error("connect failed"),
        );
  }
  query(text: string): Promise<{ rows: unknown[] }> {
    this.queries.push(text);
    return Promise.resolve({ rows: [] });
  }
}
const asPool = (pool: FakePool): Pool => pool as unknown as Pool;
const FAULT_HOOK = Symbol.for("the-desk.a5.test-fault-hook");
/** Installs the inert-by-default fault hook for one synchronous-or-async scope. */
const withHook = async <R>(
  hook: (point: string) => unknown,
  fn: () => Promise<R>,
): Promise<R> => {
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
const CONTROLS = {
  mode: "non_network",
  DESK_ENV: "test",
  PROVIDERS_ENABLED: false,
  GENERATION_KILL_SWITCH: false,
  PROVIDER_CALL_TIMEOUT_MS: 30000,
};
const OBSERVER = {
  correlationId: "22222222-2222-4222-8222-222222222222",
  observer: (): undefined => undefined,
};

describe("writer Pass-1 plan, admission and mapping (unit)", () => {
  it("U01 real build: the six pinned identities", () => {
    const built = buildFixtureWriterInput();
    expect(built.kind).toBe("fixture_writer_input");
    if (built.kind !== "fixture_writer_input") return;
    const data = built.data as unknown as Obj;
    const w = data.writer_data as Obj;
    const c = data.writer_context_manifest as Obj;
    const binding = data.binding as Obj;
    expect(sha256(canonicalBytes(w))).toBe(PASS1_PIN.w_raw_sha256);
    expect(domainHash("writer-view-v2", w)).toBe(PASS1_PIN.w_domain_sha256);
    expect(sha256(canonicalBytes(c))).toBe(PASS1_PIN.c_raw_sha256);
    expect(domainHash("writer-context-manifest-v2", c)).toBe(
      PASS1_PIN.c_domain_sha256,
    );
    expect((binding.representation_registry as Obj).sha256).toBe(
      PASS1_PIN.r_raw_sha256,
    );
    expect(built.identity.sha256).toBe(PASS1_PIN.a_raw_sha256);
    expect(Buffer.byteLength(built.writer_data_json, "utf8")).toBe(11788);
    expect(planWriterPass1(INV).kind).toBe("planned");
  }, T);

  it("U02 factory boundary: refusal, thrown fault, the unrelated throwable itself, nothing downstream", () => {
    expect(planWith(PASS1_SPECIMEN).kind).toBe("planned"); // positive control
    let calls = 0;
    let downstream = 0;
    // `specimen` is read only AFTER the factory boundary: a read here proves work continued past a failed factory
    const watched = (build: () => FixtureWriterInputResult) => ({
      build: () => {
        calls += 1;
        return build();
      },
      get specimen(): unknown {
        downstream += 1;
        return undefined;
      },
    });
    const refused = {
      kind: "rejected",
      profile: "writer-fixture-input/2",
      phase: 3,
      code: "reader_refused",
      field: "pack",
      reader_code: null,
      parser_code: null,
    } as unknown as FixtureWriterInputResult;
    const a = stopOf(planWriterPass1(INV, watched(() => refused)));
    expect(a.code).toBe("pass1_input_refused");
    expect(a.stage).toBe("input");
    expect(a.input).toEqual({ phase: 3, code: "reader_refused", field: "pack" });
    expect(a.writes_attempted).toBe(false);
    expect(a.durable).toEqual(UNKNOWN4);
    const b = stopOf(
      planWriterPass1(
        INV,
        watched(() => {
          throw new FixtureWriterInputFault(3);
        }),
      ),
    );
    expect(b.code).toBe("pass1_input_fault");
    expect(b.input).toEqual({ phase: 3 });
    const sentinel = new TypeError("unrelated");
    let caught: unknown;
    try {
      planWriterPass1(
        INV,
        watched(() => {
          throw sentinel;
        }),
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(sentinel); // the very same object, not a copy or a wrapper
    expect(calls).toBe(3);
    expect(downstream).toBe(0); // nothing past the factory boundary ran in any of the three
    expect(planWith(PASS1_SPECIMEN).kind).toBe("planned"); // repair
  }, T);

  it("U03 derived ids: deterministic, v4, 40 distinct, independent of every invocation form", () => {
    const found = (p: Pass1Plan): Record<string, string> => {
      const out: Record<string, string> = {
        "artifact:writer_view_v2": String(p.t1[0]?.row.artifact_id),
        "artifact:writer_context_manifest_v2": String(p.t1[1]?.row.artifact_id),
        "artifact:prompt_manifest_2": String(p.t1[2]?.row.artifact_id),
        "artifact:script_pass1": p.ids.script_artifact_id,
        prompt_manifest: p.ids.prompt_manifest_id,
        provider_call: p.ids.provider_call_id,
        model_run: p.ids.model_run_id,
        script_version: p.ids.script_version_id,
      };
      ANCHORS.forEach((anchor, index) => {
        out[`turn:${anchor}`] = p.ids.turn_ids[index] ?? "";
      });
      for (const planned of p.t3) {
        const row = planned.row;
        const tag =
          planned.spec.table === "turn_claim_uses"
            ? "turn_claim_use"
            : planned.spec.table === "turn_evidence_uses"
              ? "turn_evidence_use"
              : undefined;
        if (tag === undefined) continue;
        const targetKey = tag === "turn_claim_use" ? "claim_id" : "evidence_unit_id";
        const idKey = tag === "turn_claim_use" ? "turn_claim_use_id" : "turn_evidence_use_id";
        const anchor = ANCHORS[p.ids.turn_ids.indexOf(String(row.turn_id))] ?? "";
        out[`${tag}:${anchor}:${String(row[targetKey]).slice(-2)}:${String(row.use_mode)}:${String(row.span_start)}`] = String(row[idKey]);
      }
      return out;
    };
    expect(found(plan)).toEqual(EXPECTED_IDS);
    const values = Object.values(EXPECTED_IDS);
    expect(new Set(values).size).toBe(40);
    for (const id of values)
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    // independent of the invocation instants and of the way they are written (offset, equivalent instant, 6 fractional digits)
    for (const invocation of [
      { ...INV, started_at: "2026-11-01T01:02:03Z", ended_at: "2026-11-01T01:02:04Z", created_at: "2026-11-01T01:02:05Z" },
      INV_OFFSET,
      { ...INV, ended_at: INV.started_at }, // ended_at equal to started_at is allowed
      { ...INV, ended_at: "2026-10-20T02:00:00+02:00" }, // the same instant written with an offset
    ]) {
      const again = planWriterPass1(invocation, { build: realBuild });
      if (again.kind !== "planned") throw new Error(`plan stopped ${again.code}`);
      expect(found(again.plan)).toEqual(EXPECTED_IDS);
      expect(again.plan.reservation.started_at).toBe(invocation.started_at);
    }
    // invalid invocations stop before anything else, with the closed rejection code
    const invalid: [Obj, string][] = [
      [{ ...INV, attempt_id: "not-a-uuid" }, "invalid_uuid"],
      [{ ...INV, started_at: "2026-10-20 00:00:00" }, "invalid_timestamp"],
      [{ ...INV, created_at: "2026-10-20T00:00:02" }, "invalid_timestamp"],
      [{ ...INV, started_at: "2026-10-20T00:00:00.1234567Z" }, "timestamp_precision"],
      [{ ...INV, ended_at: "2026-10-19T23:59:59.999999Z" }, "invalid_timestamp"], // one microsecond before started_at
    ];
    for (const [invocation, code] of invalid) {
      const stop = stopOf(planWriterPass1(invocation, { build: realBuild }));
      expect(stop.code).toBe("pass1_invocation_invalid");
      expect(stop.stage).toBe("input");
      expect(stop.rejection_code).toBe(code);
    }
    // a changed script changes all 17 turn ids
    const other = "0".repeat(64);
    const changed = ANCHORS.map((a) => derivePass1Id(`turn:${other}:${a}`));
    expect(changed.every((id, i) => id !== plan.ids.turn_ids[i])).toBe(true);
  }, T);

  it("U04 request: 678 B ASCII, sorted keys, recomputed and reconstructed", () => {
    const text = plan.request_text;
    expect(Buffer.byteLength(text, "utf8")).toBe(678);
    expect(/^[\x20-\x7e]*$/.test(text)).toBe(true);
    const keys = Object.keys(JSON.parse(text) as Obj);
    expect(keys).toEqual([...keys].sort());
    expect(sha256(Buffer.from(text, "utf8"))).toBe(
      "443ebf6b5b5ad35e620086481a05294d65fc6e1f5ced80c0bb9d76e11973752b",
    );
    const refs = (plan.manifest.ordered_input_artifacts as Obj[]).map((r) => ({
      artifact_id: String(r.artifact_id),
      artifact_type: String(r.artifact_type),
      content_hash: String(r.content_hash),
    }));
    const rebuilt = renderWriterPass1Request(refs);
    expect(rebuilt.text).toBe(text);
    expect(requestMatchesPin(rebuilt)).toBe(true);
  });

  it("U05 exposure scan scope: four surfaces clean, four seeds detected, positives pinned and present", () => {
    const surfaces = {
      request: plan.request_text,
      manifest: plan.manifest,
      script_payload: plan.script_payload,
      specimen: PASS1_SPECIMEN,
    };
    const both = [originals.c3, originals.c4];
    expect(scanForWithheld(surfaces, both)).toBeNull(); // positive control
    const seed = originals.c4.slice(0, 40);
    const seeded = {
      request: `${plan.request_text}${seed}`,
      manifest: { ...plan.manifest, extra: seed },
      script_payload: { ...plan.script_payload, extra: [seed] },
      specimen: { ...clone(), extra: seed },
    };
    for (const [name, value] of Object.entries(seeded))
      expect(scanForWithheld({ ...surfaces, [name]: value }, both)).toBe(name);
    expect(scanForWithheld(surfaces, both)).toBeNull(); // repair
    // positives: the six permitted original values are carried exactly; C3/C4/E003/E004 only as the approved derivatives
    const claims = records(wObj.selected_claims);
    expect(claims).toHaveLength(8);
    for (const id of PERMITTED_ORIGINALS) {
      const inW = claims.find((c) => c.claim_id === id);
      const stored = records(rows.claims).find((c) => c.claim_id === id);
      expect(inW).toBeDefined();
      expect(stored).toBeDefined();
      expect(typeof (stored?.value as Obj | undefined)).toBe("object");
      expect(inW?.value).toEqual(stored?.value);
    }
    const approved: Record<string, string> = {
      [C3]: "The North Coast Gazette reports that training included a 5-4-1 option for Northbridge to use when closing out a match.",
      [C4]: "One specialist analysis in the package suggests Southbank's focus on the flanks after half-time could have been an intentional answer to Northbridge's narrower midfield.",
    };
    for (const [id, text] of Object.entries(approved)) {
      const inW = claims.find((c) => c.claim_id === id);
      expect(inW).toBeDefined();
      expect(inW?.value).toBeNull();
      expect(inW?.value_status).toBe("withheld_original_text_value");
      expect(inW?.approved_representation).toBe(text);
    }
    const evidence = records(wObj.selected_evidence);
    expect(evidence).toHaveLength(3);
    const authorized: Record<string, string> = {
      [E03]: "Reporting by the North Coast Gazette describes Northbridge working in training on a 5-4-1 setup for late-match situations.",
      [E04]: "Matchboard Analysis describes Southbank's focus on wide areas after the break as a possible intentional answer to Northbridge compressing midfield.",
    };
    for (const [id, text] of Object.entries(authorized)) {
      const unit = evidence.find((e) => e.evidence_unit_id === id);
      expect(unit).toBeDefined();
      expect(unit?.authorized_representation).toBe(text);
      expect(unit?.quote_permission).toBe(false);
    }
  });

  it("U06 one-character change of the instruction or template", () => {
    const refs = (plan.manifest.ordered_input_artifacts as Obj[]).map((r) => ({
      artifact_id: String(r.artifact_id),
      artifact_type: String(r.artifact_type),
      content_hash: String(r.content_hash),
    }));
    expect(requestMatchesPin(renderWriterPass1Request(refs))).toBe(true);
    for (const recipe of [
      { ...REQUEST_RECIPE, instruction: `${REQUEST_RECIPE.instruction}.` },
      { ...REQUEST_RECIPE, template_version: "writer-pass1-fixture-v3" },
    ]) {
      expect(requestMatchesPin(renderWriterPass1Request(refs, recipe))).toBe(false);
      const stop = stopOf(planWriterPass1(INV, { build: realBuild, recipe }));
      expect(stop.code).toBe("pass1_request_hash_mismatch");
      expect(stop.stage).toBe("admission");
      expect(planWriterPass1(INV, { build: realBuild, recipe: REQUEST_RECIPE }).kind).toBe("planned"); // repair
    }
  }, T);

  it("U07 manifest: sixteen keys, recomputed hash, typed reconcile, ordered refs", () => {
    const manifest = plan.manifest;
    expect(Object.keys(manifest)).toHaveLength(16);
    expect(() => assertCompletePromptManifestPayload(manifest)).not.toThrow();
    expect(promptManifestArtifactHash(manifest)).toBe(
      "0331df556dc7ea11739ef600409ec45a6ec2ee694abf8b4303c1ae19e65e683f",
    );
    const typed = {
      component_versions: manifest.component_versions,
      rendered_request_hash: plan.request_hash,
      policy_source_hashes: manifest.policy_source_hashes,
    };
    expect(checkManifestPair(typed, manifest)).toBeNull();
    const refs = manifest.ordered_input_artifacts as Obj[];
    expect(refs.map((r) => r.artifact_type)).toEqual([
      "writer_view_v2",
      "writer_context_manifest_v2",
    ]);
    expect(refs[0]?.content_hash).toBe(PASS1_PIN.w_domain_sha256);
    expect(refs[1]?.content_hash).toBe(PASS1_PIN.c_domain_sha256);
    const rebuilt = buildPromptManifest(
      refs.map((r) => ({
        artifact_id: String(r.artifact_id),
        artifact_type: String(r.artifact_type),
        content_hash: String(r.content_hash),
      })),
      plan.request_hash,
    );
    expect(sameJson(rebuilt, manifest)).toBe(true);
  });

  it("U08 a manifest or typed row that mentions addendum 0.1 or omits 0.2", () => {
    const manifest = plan.manifest;
    const typed = (versions: Obj): Obj => ({
      component_versions: versions,
      rendered_request_hash: plan.request_hash,
      policy_source_hashes: manifest.policy_source_hashes,
    });
    const versions = manifest.component_versions as Obj;
    expect(checkManifestPair(typed(versions), manifest)).toBeNull(); // positive control
    const old = { ...versions, writing_fixture_profile_addendum: "writing-fixture-profile-addendum-0.1" };
    expect(checkManifestPair(typed(old), { ...manifest, component_versions: old })).toBe("pass1_manifest_binding");
    expect(checkManifestPair(typed(versions), { ...manifest, component_versions: old })).toBe("pass1_manifest_binding");
    const { writing_fixture_profile_addendum: omitted, ...without } = versions;
    expect(omitted).toBe("writing-fixture-profile-addendum-0.2");
    expect(checkManifestPair(typed(without), { ...manifest, component_versions: without })).toBe("pass1_manifest_binding");
    expect(checkManifestPair(typed(versions), manifest)).toBeNull(); // repair
  });

  it("U09 each of the three typed fields altered", () => {
    const manifest = plan.manifest;
    const good: Obj = {
      component_versions: manifest.component_versions,
      rendered_request_hash: plan.request_hash,
      policy_source_hashes: manifest.policy_source_hashes,
    };
    expect(checkManifestPair(good, manifest)).toBeNull(); // positive control
    const variants: Obj[] = [
      { ...good, component_versions: { ...(manifest.component_versions as Obj), claims_policy: "claims-0.1.3" } },
      { ...good, rendered_request_hash: "0".repeat(64) },
      { ...good, policy_source_hashes: { ...(manifest.policy_source_hashes as Obj), claims_policy: "1".repeat(64) } },
    ];
    for (const typed of variants)
      expect(checkManifestPair(typed, manifest)).toBe("pass1_manifest_typed_mismatch");
    expect(checkManifestPair(good, manifest)).toBeNull(); // repair
  });

  it("U10 semantic-input literal and what does and does not change it", () => {
    const manifest = plan.manifest;
    const literal = "f1ff636aebda7c07eff9642614fedb6cb376ae61d689c7987bf226e11f787f73";
    expect(modelSemanticInputHash(manifest)).toBe(literal);
    expect(plan.semantic_input_hash).toBe(literal);
    const changes: Obj[] = [
      { component_versions: { ...(manifest.component_versions as Obj), writing_policy: "writing-0.2.4" } },
      { policy_source_hashes: { ...(manifest.policy_source_hashes as Obj), writing_policy: "2".repeat(64) } },
      { rendered_request_hash: "3".repeat(64) },
    ];
    for (const change of changes)
      expect(modelSemanticInputHash({ ...manifest, ...change })).not.toBe(literal);
    const same: Obj[] = [
      { provider: "other" },
      { model_identifier: "other/model" },
      { settings: { deterministic_fixture: false } },
      { retention: { ...(manifest.retention as Obj), raw_output_retention_policy: "other" } },
      { ordered_input_artifacts: [] },
    ];
    for (const change of same)
      expect(modelSemanticInputHash({ ...manifest, ...change })).toBe(literal);
  });

  it("U11 W2/C2 carriers are exactly 19 and 11 keys with recomputed domain hashes", () => {
    const [w2, c2] = plan.t1;
    expect(Object.keys(w2?.row.canonical_payload as Obj)).toHaveLength(19);
    expect(Object.keys(c2?.row.canonical_payload as Obj)).toHaveLength(11);
    expect(domainHash("writer-view-v2", w2?.row.canonical_payload)).toBe(
      "05d2d0ccd6f46cd62d9ce65f6ce79df8b7bc3670a4fb4af3fc2821cedb7735b5",
    );
    expect(domainHash("writer-context-manifest-v2", c2?.row.canonical_payload)).toBe(
      "58a54994fecae57803e15544d96901ee21d7a9b743ed242c6794b9c46bb58432",
    );
    expect(w2?.row.content_hash).toBe(PASS1_PIN.w_domain_sha256);
    expect(c2?.row.content_hash).toBe(PASS1_PIN.c_domain_sha256);
    expect(w2?.row.schema_version).toBe("writer-view/2");
    expect(c2?.row.schema_version).toBe("writer-context-manifest/2");
  });

  it("U12 the v1 helpers refuse the v2 objects (existing refusals, non-migration)", () => {
    expect(domainHash("writer-view-v2", wObj)).toBe(PASS1_PIN.w_domain_sha256); // v2 positive controls
    expect(domainHash("writer-context-manifest-v2", cObj)).toBe(PASS1_PIN.c_domain_sha256);
    expect(() => writerViewHash(wObj)).toThrow();
    expect(() => writerContextManifestHash(cObj)).toThrow();
    expect(() => governedDomainHash("writer-view-v2" as never, wObj)).toThrow();
    expect(() => governedDomainHash("writer-context-manifest-v2" as never, cObj)).toThrow();
    expect(domainHash("writer-view-v2", wObj)).toBe(PASS1_PIN.w_domain_sha256); // unchanged afterwards
  });

  it("U13 mapped canonical object through the real scriptHash", () => {
    const mapped = (id: (anchor: string) => string): Obj => ({
      brief_hash: PASS1_SPECIMEN.brief_hash,
      package_hash: PASS1_SPECIMEN.package_hash,
      writing_policy_version: PASS1_SPECIMEN.writing_policy_version,
      program_block_refs: [...PASS1_SPECIMEN.program_block_refs],
      turns: PASS1_SPECIMEN.turns.map((t) => ({ ...t, turn_id: id(t.semantic_turn_id) })),
      turn_claim_uses: PASS1_SPECIMEN.turn_claim_uses.map((u) => ({ ...u, turn_id: id(u.semantic_turn_id) })),
      turn_evidence_uses: PASS1_SPECIMEN.turn_evidence_uses.map((u) => ({ ...u, turn_id: id(u.semantic_turn_id) })),
      prediction_candidates: PASS1_SPECIMEN.prediction_candidates.map((c) => ({
        prediction_candidate_id: c.prediction_candidate_id,
        turn_id: id(c.semantic_turn_id),
        participant_id: c.participant_id,
        prediction_text: c.prediction_text,
        horizon: c.horizon,
        topic_thread_id: c.topic_thread_id,
      })),
    });
    const literal = "b18d1fcee6ccd784933fd5e19b957ae252a5c892deb3d342ca768d61cea94ae9";
    const temporary = scriptHash(mapped((a) => `tmp-turn-${a}`), { brief });
    expect(temporary).toBe(literal);
    const final = scriptHash(
      mapped((a) => plan.ids.turn_ids[ANCHORS.indexOf(a)] ?? ""),
      { brief },
    );
    expect(final).toBe(literal);
    expect(scriptHash(plan.script_payload, { brief })).toBe(literal);
    expect(plan.script_hash).toBe(literal);
    expect(sha256(canonicalBytes(PASS1_SPECIMEN))).toBe(PASS1_SPECIMEN_CANONICAL_SHA256);
    expect(plan.specimen_canonical_sha256).toBe(PASS1_SPECIMEN_CANONICAL_SHA256);
    // the object rebuilt from the relational rows hashes to the same value
    const stored = (table: string): Obj[] =>
      plan.t3.filter((p) => p.spec.table === table).map((p) => ({ ...p.row }));
    const parts = () => ({
      script_version_id: plan.ids.script_version_id,
      turns: stored("turns"),
      claim_uses: stored("turn_claim_uses"),
      evidence_uses: stored("turn_evidence_uses"),
    });
    expect(reconcileScriptRows(brief, plan.script_payload, parts(), literal)).toBe(true);
    const damaged = parts();
    damaged.turns[3] = { ...damaged.turns[3], spoken_text: "changed" };
    expect(reconcileScriptRows(brief, plan.script_payload, damaged, literal)).toBe(false);
    expect(reconcileScriptRows(brief, plan.script_payload, parts(), literal)).toBe(true); // repair
  });

  it("U14 semantic delta (exact changed paths and values) and the storage mapping, enumerated", () => {
    /** Every differing leaf path (dotted, arrays by index) between two JSON values. */
    const diff = (a: unknown, b: unknown, path = ""): [string, unknown, unknown][] => {
      if (Array.isArray(a) && Array.isArray(b)) {
        expect(b.length).toBe(a.length);
        return a.flatMap((x, i) => diff(x, b[i], `${path}.${String(i)}`));
      }
      if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
        const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
        return keys.flatMap((k) => diff((a as Obj)[k], (b as Obj)[k], `${path}.${k}`));
      }
      return a === b ? [] : [[path, a, b]];
    };
    const before = scriptProjection(historical, { brief }) as Obj;
    const after = scriptProjection(plan.script_payload, { brief }) as Obj;
    const changed = diff(before, after);
    // the whole projection (modes, state hashes, rights versions included): exactly two texts and four span ends differ
    expect(changed.map(([path]) => path)).toEqual([
      ".turn_claim_uses.3.span_end",
      ".turn_claim_uses.4.span_end",
      ".turn_evidence_uses.0.span_end",
      ".turn_evidence_uses.1.span_end",
      ".turns.5.spoken_text",
      ".turns.6.spoken_text",
    ]);
    const values = Object.fromEntries(changed.map(([path, x, y]) => [path, [x, y]]));
    expect(values[".turn_claim_uses.3.span_end"]).toEqual([118, 144]);
    expect(values[".turn_claim_uses.4.span_end"]).toEqual([159, 168]);
    expect(values[".turn_evidence_uses.0.span_end"]).toEqual([118, 144]);
    expect(values[".turn_evidence_uses.1.span_end"]).toEqual([159, 168]);
    expect(values[".turns.5.spoken_text"]?.[1]).toBe(
      "There was at least a plan. The North Coast Gazette reports that training included a 5-4-1 option for Northbridge to use when closing out a match.",
    );
    expect(values[".turns.6.spoken_text"]?.[1]).toBe(
      "One specialist analysis in the package suggests Southbank's focus on the flanks after half-time could have been an intentional answer to Northbridge's narrower midfield. Could. I would keep that word.",
    );
    // storage mapping: the 21-key envelope; exactly these top-level keys differ, every id is fresh, nothing else moves
    expect(Object.keys(plan.script_payload).sort()).toEqual(Object.keys(historical).sort());
    expect(Object.keys(plan.script_payload)).toHaveLength(21);
    const stored = diff(historical, plan.script_payload);
    const idPath = /\.(turn_id|turn_claim_use_id|turn_evidence_use_id)$/;
    const ids = stored.filter(([path]) => idPath.test(path));
    expect(ids).toHaveLength(17 + 12 + 12 + 3 + 3 + 2); // turns, claim uses (+turn refs), evidence uses (+turn refs), candidates
    const other = stored.filter(([path]) => !idPath.test(path)).map(([path]) => path);
    expect(other).toEqual([
      ".artifact_id",
      ".created_at",
      ".script_hash",
      ".script_version_id",
      ".turn_claim_uses.3.span_end",
      ".turn_claim_uses.4.span_end",
      ".turn_evidence_uses.0.span_end",
      ".turn_evidence_uses.1.span_end",
      ".turns.5.spoken_text",
      ".turns.6.spoken_text",
      ".writer_model_run_id",
    ]);
    expect(plan.script_payload.revision_parent_id).toBeNull();
    expect("revision_parent_content_identity" in plan.script_payload).toBe(false);
    expect(
      records(plan.script_payload.prediction_candidates).every((c) => "turn_id" in c && !("semantic_turn_id" in c)),
    ).toBe(true);
  });

  it("U15 the guard is live on both sides inside whole admission", () => {
    const old = records(historical.turns).find((t) => t.semantic_turn_id === "t07");
    const stop = refusal((s) => {
      turnOf(s, "t07").spoken_text = String(old?.spoken_text);
    }, "pass1_withheld_text_relocated"); // before the golden hash, with the positive control and the repair
    expect(stop.surface).toBeUndefined();
  }, T);

  it("U16 the guard threshold is exactly 24 characters", () => {
    const original = originals.c4;
    expect(sharesRun(original.slice(0, 23), original)).toBe(false);
    expect(sharesRun(original.slice(0, 24), original)).toBe(true);
    expect(sharesRun(`xx${original.slice(5, 29)}yy`, original)).toBe(true);
    expect(sharesRun(`xx${original.slice(5, 28)}yy`, original)).toBe(false);
    // passes step 6 (23 characters) and fails step 7: stated outcome, not a pass
    refusal((s) => {
      turnOf(s, "t07").spoken_text += ` ${original.slice(0, 23)}`;
    }, "pass1_script_hash_mismatch");
    // a 24-character run is caught at step 6, before the golden hash
    refusal((s) => {
      turnOf(s, "t07").spoken_text += ` ${original.slice(0, 24)}`;
    }, "pass1_withheld_text_relocated");
  }, T);

  it("U17 all uses target only W-selected ids; state hashes and rights equal W", () => {
    const claims = records(wObj.selected_claims);
    const evidence = records(wObj.selected_evidence);
    for (const use of PASS1_SPECIMEN.turn_claim_uses) {
      const claim = claims.find((c) => c.claim_id === use.claim_id);
      expect(claim?.frozen_state_hash).toBe(use.claim_state_hash);
    }
    for (const use of PASS1_SPECIMEN.turn_evidence_uses) {
      const unit = evidence.find((e) => e.evidence_unit_id === use.evidence_unit_id);
      expect(unit?.rights_policy_version).toBe(use.rights_policy_version);
    }
    expect(planWith(PASS1_SPECIMEN).kind).toBe("planned");
  }, T);

  it("U18 a use of an unselected claim", () => {
    refusal((s) => {
      claimUse(s, C4).claim_id = C8;
    }, "pass1_use_claim_not_selected");
  }, T);

  it("U19 a use of unselected evidence", () => {
    refusal((s) => {
      evidenceUse(s, E03).evidence_unit_id = E11;
    }, "pass1_use_evidence_not_selected");
  }, T);

  it("U20 a same-length claim_state_hash alteration", () => {
    refusal((s) => {
      const use = claimUse(s, C4);
      const hash = String(use.claim_state_hash);
      use.claim_state_hash = `${hash[0] === "a" ? "b" : "a"}${hash.slice(1)}`;
    }, "pass1_binding_mismatch");
  }, T);

  it("U21 spans out of range", () => {
    refusal((s) => {
      claimUse(s, C4).span_end = 100000;
    }, "pass1_span_out_of_range");
    refusal((s) => {
      const use = claimUse(s, C3);
      use.span_start = use.span_end;
    }, "pass1_span_out_of_range");
  }, T);

  it("U22 a quoted use of a paraphrase-only evidence unit", () => {
    refusal((s) => {
      evidenceUse(s, E03).use_mode = "quoted";
    }, "pass1_use_mode_not_permitted");
  }, T);

  it("U23 an asserted use of a hedged-only claim", () => {
    refusal((s) => {
      claimUse(s, C4).use_mode = "asserted";
    }, "pass1_use_mode_not_permitted");
  }, T);

  it("U24 non-NFC text passes grammar and is rejected at step 2; the NFC repair reaches step 7", () => {
    expect(planWith(clone()).kind).toBe("planned");
    const spec = clone();
    turnOf(spec, "t01").spoken_text += "é"; // non-blank string: grammar step 1 is satisfied
    const stop = stopOf(planWith(spec));
    expect(stop.code).toBe("pass1_text_not_nfc");
    expect(stop.stage).toBe("admission");
    expect(stop.code).not.toBe("pass1_specimen_invalid");
    const repaired = clone();
    turnOf(repaired, "t01").spoken_text += "é"; // NFC: steps 1-6 pass, the changed text then fails the golden hash
    expect(codeOf(repaired)).toBe("pass1_script_hash_mismatch");
    expect(planWith(clone()).kind).toBe("planned");
  }, T);

  it("U25 a turn in a block id outside the Brief", () => {
    refusal((s) => {
      turnOf(s, "t01").program_block_id = "11111111-1111-4111-8111-111111111111";
    }, "pass1_program_block_unknown");
  }, T);

  it("U26 brief_hash and package_hash must equal W", () => {
    for (const field of ["brief_hash", "package_hash"] as const)
      refusal((s) => {
        s[field] = "f".repeat(64);
      }, "pass1_binding_mismatch");
  }, T);

  it("U27 a prediction candidate on a turn outside a predictions block reaches the unchanged helper", () => {
    const stop = refusal((s) => {
      const first = s.prediction_candidates[0];
      if (!first) throw new Error("no candidate");
      first.semantic_turn_id = "t01";
      first.participant_id = turnOf(s, "t01").participant_id;
    }, "pass1_specimen_invalid");
    expect(stop.underlying).toBe("prediction_outside_prediction_block");
  }, T);

  it("U28 grammar negatives", () => {
    const mutations: ((spec: MSpec) => void)[] = [
      (s) => { turnOf(s, "t05").semantic_turn_id = "t01"; },
      (s) => { turnOf(s, "t05").sequence = 99; },
      (s) => { turnOf(s, "t05").extra = true; },
      (s) => { s.purpose = "production"; },
      (s) => { s.script_phase = "pass_2"; },
      (s) => { s.revision_reason = "craft_revision"; },
      (s) => { s.schema = "writer-pass1-specimen/2"; },
    ];
    for (const mutate of mutations)
      expect(refusal(mutate, "pass1_specimen_invalid").underlying).toBeUndefined();
  }, T);

  it("U29 a one-character same-length text change with every earlier predicate satisfied", () => {
    refusal((s) => {
      const turn = turnOf(s, "t02");
      const flipped = turn.spoken_text.startsWith("a") ? "b" : "a";
      turn.spoken_text = flipped + turn.spoken_text.slice(1);
    }, "pass1_script_hash_mismatch");
  }, T);

  it("U30 the R005 rights / provider-exposure predicate and its named stop", () => {
    const row = records(rows.rights_versions).find((r) => r.rights_version_id === R005);
    const policy = row?.policy as Obj;
    expect(checkRightsPolicy(policy)).toBe(true);
    const exposure = policy.provider_exposure as Obj;
    const { fixture_stub: removed, ...bare } = exposure;
    expect(typeof removed).toBe("string");
    const mutated: Obj[] = [
      { ...policy, provider_exposure: { ...exposure, external_providers: true } },
      { ...policy, provider_exposure: bare },
      { ...policy, consumer_exposure_ceiling: { ...(policy.consumer_exposure_ceiling as Obj), writer: ["exact_excerpt"] } },
    ];
    const state = (rights: unknown) => classifyPass1Snapshot(rawFor(bitsOf(0), { rights }), plan, "preflight");
    expect(state(policy).kind).toBe("state"); // positive control through the boundary
    for (const m of mutated) {
      expect(checkRightsPolicy(m)).toBe(false);
      const result = state(m);
      expect(result.kind).toBe("stop");
      if (result.kind !== "stop") continue;
      expect(result.row.code).toBe("pass1_rights_provider_exposure");
      expect(result.row.stage).toBe("preconditions");
      expect(result.row.writes).toBe(false);
      expect(stopFrom(initialContext(), { ...result.row, facts: {} }).writes_attempted).toBe(false);
    }
    expect(state(policy).kind).toBe("state"); // repair
  });

  it("U31 verifyDurableProvider: exact call and event, each mutation reaches its own field; instants are exact", () => {
    expect(verifyDurableProvider(callRow(), [eventRow()], plan)).toBeNull();
    const seen = new Set<string>();
    const mutate = (kind: "call" | "event", field: string, value: unknown, expected: string = field): void => {
      const call = callRow();
      const event = eventRow();
      (kind === "call" ? call : event)[field] = value;
      const found = verifyDurableProvider(call, [event], plan);
      expect(found).toBe(expected);
      seen.add(String(found));
      expect(verifyDurableProvider(callRow(), [eventRow()], plan)).toBeNull(); // repair after every mutation
    };
    const calls: [string, unknown][] = [
      ["provider_call_id", "00000000-0000-4000-8000-000000000000"],
      ["attempt_id", "6fc595be-d052-4281-a805-bce4154cb386"],
      ["provider", "fixture_tts"],
      ["operation", "tts"],
      ["model_identifier", "fixture_stub/other"],
      ["request_fingerprint", "0".repeat(64)],
      ["logical_request_key", "fixture_stub:writer:other"],
      ["operational_try_number", 2],
      ["intentional_take_index", 0],
      ["retry_of_provider_call_id", "00000000-0000-4000-8000-000000000001"],
      ["reroll_of_provider_call_id", "00000000-0000-4000-8000-000000000002"],
      ["reroll_trigger_id", "00000000-0000-4000-8000-000000000003"],
      ["started_at", utcMicros("2026-10-20T00:00:09Z")],
      ["admitted_at", "2026-10-20 00:00:00+00"],
      ["reserved_cost_upper_bound", "1"],
      ["admission_currency", "USD"],
      ["admission_policy_hash", "0".repeat(64)],
      ["admission_certificate", "{}"],
      ["admission_certificate_hash", "0".repeat(64)],
    ];
    for (const [field, value] of calls) mutate("call", field, value);
    const events: [string, unknown][] = [
      ["event_type", "terminal_failure"],
      ["ended_at", utcMicros("2026-10-20T00:00:09Z")],
      ["usage_eq", false],
      ["actual_cost_zero", false],
      ["currency", "EUR"],
      ["response_artifact_id", "00000000-0000-4000-8000-000000000004"],
      ["response_reference", "writer-pass1-specimen/1:x:y"], // malformed syntax
      ["recorded_at", "2026-10-20 00:00:00+00"],
      ["admission_settlement", "{}"],
    ];
    for (const [field, value] of events) {
      const expected = field === "usage_eq" ? "usage" : field === "actual_cost_zero" ? "actual_cost" : field;
      mutate("event", field, value, expected);
    }
    // valid grammar, wrong value: the right shape with another specimen hash, and with another script hash
    for (const wrong of [
      `writer-pass1-specimen/1:${"0".repeat(64)}:${plan.script_hash}`,
      `writer-pass1-specimen/1:${plan.specimen_canonical_sha256}:${"0".repeat(64)}`,
    ]) {
      expect(wrong).toMatch(/^writer-pass1-specimen\/1:[0-9a-f]{64}:[0-9a-f]{64}$/);
      mutate("event", "response_reference", wrong);
    }
    expect(verifyDurableProvider(callRow(), [], plan)).toBe("event_count");
    expect(verifyDurableProvider(callRow(), [eventRow(), eventRow()], plan)).toBe("event_count");
    seen.add("event_count");
    expect(verifyDurableProvider(undefined, [], plan)).toBe("provider_call_id");
    // the database-generated event primary key is not compared
    expect(verifyDurableProvider(callRow(), [{ ...eventRow(), provider_call_event_id: "any" }], plan)).toBeNull();
    expect([...seen].sort()).toEqual([...PROVIDER_FIELDS].sort());
    // exact instants: an offset-form invocation matches its UTC rendering to the microsecond and not one microsecond away
    const offset = planWriterPass1(INV_OFFSET, { build: realBuild });
    if (offset.kind !== "planned") throw new Error(`plan stopped ${offset.code}`);
    const exact = { ...callRow(), started_at: "2026-10-20T00:00:00.500000Z" };
    const done = { ...eventRow(), ended_at: "2026-10-20T00:00:01.250000Z" };
    expect(verifyDurableProvider(exact, [done], offset.plan)).toBeNull();
    expect(verifyDurableProvider({ ...exact, started_at: "2026-10-20T00:00:00.500001Z" }, [done], offset.plan)).toBe("started_at");
    expect(verifyDurableProvider(exact, [{ ...done, ended_at: "2026-10-20T00:00:01.249999Z" }], offset.plan)).toBe("ended_at");
    expect(instantMicros("2026-10-20T02:00:00.500000+02:00")).toBe(instantMicros("2026-10-20T00:00:00.5Z"));
    expect(instantMicros("2026-10-20T00:00:00.000001Z") - instantMicros("2026-10-20T00:00:00Z")).toBe(1n);
    expect(utcMicros("2026-10-19T19:00:01.250000-05:00")).toBe("2026-10-20T00:00:01.250000Z");
    expect(sameInstant("2026-10-20T00:00:00.000000Z", "2026-10-20T01:00:00+01:00")).toBe(true);
    expect(sameInstant("2026-10-20T00:00:00.000001Z", "2026-10-20T00:00:00Z")).toBe(false);
    expect(sameInstant(undefined, "2026-10-20T00:00:00Z")).toBe(false);
    // the narrow UTC-year rollover: a valid four-digit offset input equals the stored five-digit-year database text
    expect(utcMicros("9999-12-31T23:00:00-01:00")).toBe("10000-01-01T00:00:00.000000Z");
    expect(sameInstant("10000-01-01T00:00:00.000000Z", "9999-12-31T23:00:00-01:00")).toBe(true);
    expect(sameInstant("10000-01-01T00:00:00.000001Z", "9999-12-31T23:00:00-01:00")).toBe(false);
    expect(sameInstant("10000-01-01T00:00:00Z", "9999-12-31T23:59:59.999999Z")).toBe(false);
    const rolled = planWriterPass1({ ...INV_OFFSET, started_at: "9999-12-31T23:00:00-01:00", ended_at: "9999-12-31T23:00:01-01:00" }, { build: realBuild });
    if (rolled.kind !== "planned") throw new Error(`plan stopped ${rolled.code}`);
    const rolledCall = { ...callRow(), started_at: "10000-01-01T00:00:00.000000Z" };
    const rolledDone = { ...eventRow(), ended_at: "10000-01-01T00:00:01.000000Z" };
    expect(verifyDurableProvider(rolledCall, [rolledDone], rolled.plan)).toBeNull();
    expect(verifyDurableProvider({ ...rolledCall, started_at: "10000-01-01T00:00:00.000001Z" }, [rolledDone], rolled.plan)).toBe("started_at");
    expect(verifyDurableProvider(rolledCall, [{ ...rolledDone, ended_at: "10000-01-01T00:00:00.999999Z" }], rolled.plan)).toBe("ended_at");
  }, T);

  it("U32 the ExecuteResult allowlist: only three exact results proceed", () => {
    const stored = (over: Obj = {}) => ({ ...plan.reservation, started_at: utcMicros(INV.started_at), ...over });
    const outcome = { provider_call_id: plan.ids.provider_call_id, event_type: "succeeded" };
    const known = [...KNOWN_OUTCOME_CODES][0] ?? "guard_rejected";
    const r = (value: unknown): ExecuteResult => value as ExecuteResult;
    const proceeds = [
      r({ status: "performed", reservation: stored(), outcome: { kind: "created", record: outcome } }),
      r({ status: "performed", reservation: stored(), outcome: { kind: "converged", record: outcome } }),
      r({ status: "completed", reservation: stored(), outcome }),
    ];
    const convergence = proceeds.map((x) => {
      const c = classifyExecuteResult(x, plan);
      return c.kind === "proceed" ? c.convergence : "stop";
    });
    expect(convergence).toEqual(["performed", "performed", "completed"]);
    // the same reservation written with an equivalent offset instant is still this authored reservation
    expect(
      classifyExecuteResult(
        r({ status: "completed", reservation: stored({ started_at: "2026-10-20T02:00:00+02:00" }), outcome }),
        plan,
      ).kind,
    ).toBe("proceed");
    expect(
      classifyExecuteResult(
        r({ status: "completed", reservation: stored({ started_at: "2026-10-20T00:00:00.000001Z" }), outcome }),
        plan,
      ),
    ).toMatchObject({ kind: "stop", row: { code: "pass1_provider_completed_mismatch", detail: { mismatch_field: "started_at" } } });
    const stops: [ExecuteResult, StopCode][] = [
      [r({ status: "performed", reservation: stored(), outcome: { kind: "conflict", code: known, stored: null, detail: "" } }), "pass1_provider_outcome_failed"],
      [r({ status: "performed", reservation: stored(), outcome: { kind: "rejected", code: known } }), "pass1_provider_outcome_failed"],
      [r({ status: "completed", reservation: stored({ provider_call_id: "00000000-0000-4000-8000-0000000000aa" }), outcome }), "pass1_provider_completed_mismatch"],
      [r({ status: "completed", reservation: stored({ attempt_id: "6fc595be-d052-4281-a805-bce4154cb386" }), outcome }), "pass1_provider_completed_mismatch"],
      ...(["converged_without_outcome", "held_by_other", "provider_not_invoked_canceled", "provider_admission_request_mismatch"] as const).map(
        (reason): [ExecuteResult, StopCode] => [r({ status: "unfinished", reason, reservation: stored() }), "pass1_provider_unfinished"],
      ),
      ...(["provider_perform_ambiguous", "provider_finish_ambiguous", "provider_observation_timeout", "provider_observation_canceled"] as const).map(
        (code): [ExecuteResult, StopCode] => [r({ status: "ambiguous", reservation: stored(), code }), "pass1_provider_ambiguous"],
      ),
      [r({ status: "conflict", result: { kind: "conflict", code: known, stored: null, detail: "" } }), "pass1_provider_conflict"],
      [r({ status: "rejected", result: { kind: "rejected", code: known } }), "pass1_provider_rejected"],
    ];
    for (const [result, code] of stops) {
      const c = classifyExecuteResult(result, plan);
      expect(c.kind).toBe("stop");
      if (c.kind !== "stop") continue;
      expect(c.row.code).toBe(code);
      expect(c.row.stage).toBe("execute");
      expect(c.row.writes).toBe(true);
    }
    const completed = classifyExecuteResult(stops[2]?.[0] as ExecuteResult, plan);
    if (completed.kind === "stop") expect(completed.row.detail?.mismatch_field).toBe("provider_call_id");
  });

  it("U33 the row comparator: converged, conflicts by kind with a repair after each, link mismatches", () => {
    const [w2, , manifestArtifact, pm] = plan.t1;
    if (!w2 || !manifestArtifact || !pm) throw new Error("no t1 rows");
    const other = "00000000-0000-4000-8000-0000000000bb";
    const check = (planned: PlannedRow, over: Obj | undefined) =>
      compareStored(planned, over === undefined ? [] : [asStored(planned, over)]);
    expect(check(w2, {})).toEqual({ kind: "equal" });
    expect(check(w2, undefined)).toEqual({ kind: "absent" });
    const kinds: [Obj, string][] = [
      [{ content_hash: "0".repeat(64) }, "same_id_different_content"],
      [{ canonical_payload: { other: true } }, "same_id_different_content"],
      [{ artifact_type: "other_type" }, "same_id_different_content"],
      [{ schema_version: "writer-view/3" }, "metadata_mismatch"],
      [{ storage_uri: "x" }, "metadata_mismatch"],
      [{ byte_size: "5" }, "metadata_mismatch"],
      [{ parent_artifact_id: other }, "metadata_mismatch"],
      [{ supersedes_artifact_id: other }, "metadata_mismatch"],
    ];
    for (const [change, kind] of kinds) {
      expect(check(w2, change)).toEqual({ kind: "conflict", conflict: { row: "artifacts", kind } });
      expect(check(w2, {})).toEqual({ kind: "equal" }); // repair
    }
    // the same content under another id: the natural key matches, the id flag does not
    const elsewhere = { ...w2.row, artifact_id: other };
    expect(compareStored(w2, [{ ...elsewhere, eq_artifact_id: false, eq_artifact_type: true, eq_content_hash: true }])).toEqual({
      kind: "conflict",
      conflict: { row: "artifacts", kind: "different_id_same_content" },
    });
    expect(check(manifestArtifact, {}).kind).toBe("equal");
    // manifest <-> artifact link
    expect(check(pm, { artifact_id: other })).toEqual({
      kind: "conflict",
      conflict: { row: "prompt_manifests", kind: "metadata_mismatch" },
    });
    expect(
      compareStored(pm, [{ ...pm.row, prompt_manifest_id: other, eq_prompt_manifest_id: false, eq_artifact_id: true }]),
    ).toEqual({ kind: "conflict", conflict: { row: "prompt_manifests", kind: "different_id_same_content" } });
    expect(check(pm, {})).toEqual({ kind: "equal" });
    const turn = plan.t3.find((p) => p.spec.table === "turns");
    if (!turn) throw new Error("no turn");
    expect(check(turn, { spoken_text: "x" })).toEqual({
      kind: "conflict",
      conflict: { row: "turns", kind: "same_id_different_content" },
    });
    expect(check(turn, {})).toEqual({ kind: "equal" });
    // evidence is the native flag, not the decoded value: a stored row whose decoded value looks equal but whose flag is false conflicts
    expect(compareStored(turn, [{ ...turn.row, eq_turn_id: true, eq_sequence: false }])).toEqual({
      kind: "conflict",
      conflict: { row: "turns", kind: "same_id_different_content" },
    });
  });

  it("U34 finite stop-mapper subcases with real error instances; merge rule M; snapshot failures and witnesses", async () => {
    const CORRELATION = "11111111-1111-4111-8111-111111111111";
    const fresh: Context = { d: NONE4, w: true }; // a snapshot saw nothing; the call has begun writing
    const held = (over: Partial<Durable>): Context => ({ d: { ...NONE4, ...over }, w: true });
    const mapped = (error: unknown, from: "t1" | "t3" | "execute", ctx: Context): Pass1Stopped => {
      const row = stopRowForThrown(error, from);
      if (!row) throw new Error("not owned");
      return stopFrom(ctx, row);
    };
    const ALLOWED = new Set([
      "kind", "stage", "code", "writes_attempted", "durable", "cleanup", "input", "underlying", "rejection_code",
      "conflict", "mismatch_field", "provider", "provider_error", "connection", "surface",
    ]);
    const closed = (stop: Pass1Stopped): void => {
      for (const key of Object.keys(stop)) expect(ALLOWED.has(key), key).toBe(true);
      expect(Object.keys(stop.durable).sort()).toEqual(["lineage", "outcome", "reservation", "t1"]);
      expect(Object.keys(stop.cleanup).sort()).toEqual(["attached_errors", "complete"]);
      for (const key of ["provider", "provider_error", "connection", "conflict", "input"] as const) {
        const nested = stop[key];
        if (nested) for (const inner of Object.keys(nested)) expect(typeof inner).toBe("string");
      }
      const text = JSON.stringify(stop);
      for (const word of ["message", "cause", "stack", "SELECT", "postgres://", "Connection terminated", "release failed", "statement failed"])
        expect(text).not.toContain(word);
    };

    // (a) fresh before_commit / not_attempted at T1 => unknown, NOT absent; the whole closed shape
    const before = new CommandConnectionError(new Error("lost"), "before_commit");
    const a = mapped(before, "t1", fresh);
    const aExpected = {
      kind: "stopped",
      stage: "stage_inputs",
      code: "pass1_command_connection",
      writes_attempted: true,
      durable: { ...NONE4, t1: "unknown" },
      cleanup: { attached_errors: 0, complete: true },
      connection: { phase: "before_commit", commit_outcome: "not_attempted" },
    };
    expect(a).toEqual(aExpected);
    closed(a);
    // (b) the same input with prior verified presence: T1 stays present, the local fields are unchanged
    const b = mapped(before, "t1", held({ t1: "present" }));
    expect(b).toEqual({ ...aExpected, durable: { ...NONE4, t1: "present" } });
    closed(b);
    // (c) concurrent / held-by-other uncertainty: unknown, never none_observed, for the stages it names
    const heldResult = { status: "unfinished", reason: "held_by_other", reservation: { ...plan.reservation } } as unknown as ExecuteResult;
    const c = classifyExecuteResult(heldResult, plan);
    if (c.kind !== "stop") throw new Error("expected a stop");
    const cStop = stopFrom(fresh, c.row);
    expect(cStop).toEqual({
      kind: "stopped",
      stage: "execute",
      code: "pass1_provider_unfinished",
      writes_attempted: true,
      durable: { ...NONE4, reservation: "unknown", outcome: "unknown" },
      cleanup: { attached_errors: 0, complete: true },
      provider: { status: "unfinished", reason: "held_by_other" },
    });
    // (d) commit / unknown with and without prior presence; the local commit_outcome stays unknown in both
    const lost = new CommandConnectionError(new Error("ack lost"), "commit");
    const dNone = mapped(lost, "t3", fresh);
    const dHeld = mapped(lost, "t3", held({ lineage: "present" }));
    const dExpected = {
      kind: "stopped",
      stage: "lineage",
      code: "pass1_command_connection",
      writes_attempted: true,
      durable: { ...NONE4, lineage: "unknown" },
      cleanup: { attached_errors: 0, complete: true },
      connection: { phase: "commit", commit_outcome: "unknown" },
    };
    expect(dNone).toEqual(dExpected);
    expect(dHeld).toEqual({ ...dExpected, durable: { ...NONE4, lineage: "present" } });
    closed(dNone);
    closed(dHeld);
    // (e) keyed cleanup errors attached by runCommand to the actual throwable, via a scripted fake pool
    const client = new FakeClient();
    client.releaseThrows = new Error("release failed");
    const keyed = (await runCommand(asPool(new FakePool(client)), () => {
      client.emit("error", new Error("Connection terminated unexpectedly"));
      return Promise.resolve({ kind: "created", record: 1 } as const);
    }).catch((e: unknown) => e)) as CommandConnectionError;
    expect(keyed).toBeInstanceOf(CommandConnectionError);
    const e = mapped(keyed, "t1", fresh);
    expect(e).toEqual({ ...aExpected, cleanup: { attached_errors: 1, complete: true } }); // the keyed cleanup count is the only difference from (a)
    closed(e);
    // (f) a real ProviderExecutionError, with and without prior presence; its fields stay verbatim
    const unknownBoth = new ProviderExecutionError(CORRELATION, "record", undefined, "unknown", undefined, "unknown");
    const fNone = mapped(unknownBoth, "execute", fresh);
    const providerError = {
      code: "provider_execution_failed",
      stage: "record",
      commit_state: "unknown",
      reservation_commit_state: "unknown",
      error_class: "unclassified",
    };
    const fExpected = {
      kind: "stopped",
      stage: "execute",
      code: "pass1_provider_error",
      writes_attempted: true,
      durable: { ...NONE4, reservation: "unknown", outcome: "unknown" },
      cleanup: { attached_errors: null, complete: false },
      provider_error: providerError,
    };
    expect(fNone).toEqual(fExpected);
    const fHeld = mapped(unknownBoth, "execute", held({ reservation: "present", outcome: "present" }));
    expect(fHeld).toEqual({ ...fExpected, durable: { ...NONE4, reservation: "present", outcome: "present" } });
    const recordFailed = new ProviderExecutionError(CORRELATION, "record", undefined, "unknown", undefined, "committed");
    const f2 = mapped(recordFailed, "execute", fresh);
    expect(f2).toEqual({
      ...fExpected,
      durable: { ...NONE4, reservation: "present", outcome: "unknown" },
      provider_error: { ...providerError, reservation_commit_state: "committed" },
    });
    const reserveFailed = new ProviderExecutionError(CORRELATION, "reserve", undefined, "not_committed", undefined, "not_committed");
    const f3 = mapped(reserveFailed, "execute", fresh);
    // a local not_committed is not global absence: the facts stay unknown
    expect(f3).toEqual({
      ...fExpected,
      provider_error: { ...providerError, stage: "reserve", commit_state: "not_committed", reservation_commit_state: "not_committed" },
    });
    for (const result of [fNone, fHeld, f2, f3]) closed(result);
    // (g) a wrapped ProviderExecutionError never claims complete underlying cleanup evidence: through the actual boundary, with keyed
    // cleanup present on the original command error and ignored on the wrapper
    const wrappedClient = new FakeClient();
    wrappedClient.releaseThrows = new Error("release failed");
    let first = true;
    wrappedClient.afterQuery = (text) => {
      if (first && !text.startsWith("BEGIN") && !text.includes("transaction_isolation")) {
        first = false;
        wrappedClient.emit("error", new Error("Connection terminated unexpectedly"));
      }
    };
    const wrappedPool = new FakePool(wrappedClient);
    const wrapped = await executeWriterPass1Call(asPool(wrappedPool), plan, OBSERVER, CONTROLS);
    expect(wrapped.kind).toBe("stopped");
    if (wrapped.kind !== "stopped") throw new Error("expected a stop");
    // This scripted loss occurs during reserve, before COMMIT. The command event reports not_committed;
    // the standalone component still has no verified durable presence, and wrapper cleanup is incomplete.
    expect(wrapped).toEqual({
      kind: "stopped",
      stage: "execute",
      code: "pass1_provider_error",
      writes_attempted: true,
      durable: UNKNOWN4,
      cleanup: { attached_errors: null, complete: false },
      provider_error: {
        code: "provider_execution_failed",
        stage: "reserve",
        commit_state: "not_committed",
        reservation_commit_state: "not_committed",
        error_class: "CommandConnectionError",
      },
    });
    expect(wrappedClient.releases).toEqual([true]); // the original keyed throwable did carry a cleanup failure
    expect(wrappedPool.connects).toBe(1); // no retry
    closed(wrapped);
    // (h) unrelated throwables are not owned and propagate unchanged at actual T1/T3/E boundaries, without a retry
    const sentinel = new RangeError("unrelated");
    for (const call of [
      (p: Pool) => stageWriterPass1Inputs(p, plan),
      (p: Pool) => recordWriterPass1Lineage(p, plan),
    ]) {
      const pool = new FakePool(new FakeClient());
      pool.connectError = sentinel;
      let caught: unknown;
      try {
        await call(asPool(pool));
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(sentinel);
      expect(pool.connects).toBe(1);
    }
    expect(stopRowForThrown(sentinel, "t1")).toBeUndefined();
    expect(stopRowForThrown(sentinel, "t3")).toBeUndefined();
    expect(stopRowForThrown(sentinel, "execute")).toBeUndefined();
    expect(stopRowForThrown(unknownBoth, "t3")).toBeUndefined();
    // merge rule M itself
    expect(mergeFact("present", "unknown")).toBe("present");
    expect(mergeFact("none_observed", "unknown")).toBe("unknown");
    expect(mergeFact("unknown", "none_observed")).toBe("unknown");
    expect(mergeFact("none_observed", "none_observed")).toBe("none_observed");
    expect(mergeFact("unknown", "present")).toBe("present");
    expect(mergeFact("none_observed", undefined)).toBe("none_observed");
    expect(mergeDurable(PRESENT4, { t1: "unknown" })).toEqual(PRESENT4);

    // (i)-(k) snapshot failures, witnessed on the fake client: statements, release argument, listeners, discarded sentinel data
    const SENTINEL = "SENTINEL-ROW-DATA";
    interface Run {
      readonly client: FakeClient;
      readonly pool: FakePool;
      readonly read: Awaited<ReturnType<typeof readPass1Snapshot>>;
    }
    const snapshot = async (setup: (c: FakeClient) => void): Promise<Run> => {
      const c = new FakeClient();
      c.rowsFor = (text) => (text.includes("FROM program_run_attempts") ? [{ attempt_id: SENTINEL }] : []);
      setup(c);
      const pool = new FakePool(c);
      return { client: c, pool, read: await readPass1Snapshot(asPool(pool), plan) };
    };
    const BEGIN = "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY";
    const control = await snapshot(() => undefined);
    expect(control.read.ok).toBe(true); // control: a successful snapshot carries the rows it read
    if (control.read.ok) expect(control.read.raw.host?.attempt_id).toBe(SENTINEL);
    expect(control.client.statements[0]).toBe(BEGIN);
    expect(control.client.log.indexOf("query COMMIT")).toBeGreaterThan(0);
    expect(control.client.log.indexOf("query COMMIT")).toBeLessThan(control.client.log.indexOf("release"));
    expect(control.client.statements).not.toContain("ROLLBACK");
    expect(control.client.releases).toEqual([true]); // single release, always the destroying one
    expect(control.client.listeners("error")).toEqual([control.client.poolListener]); // the scoped listener is gone
    const statement = await snapshot((cl) => { cl.failOn = (t) => t.includes("FROM program_run_attempts"); });
    const commit = await snapshot((cl) => { cl.script.set("COMMIT", () => Promise.reject(new Error("commit failed"))); });
    const release = await snapshot((cl) => { cl.releaseThrows = new Error("release failed"); });
    for (const [name, run] of [["statement", statement], ["commit", commit], ["release", release]] as const) {
      expect(run.read.ok, name).toBe(false);
      expect(JSON.stringify(run.read), name).not.toContain(SENTINEL); // failed data is discarded
      expect(run.client.releases, name).toEqual([true]); // exactly one release, never a second release of the same client
      expect(run.client.listeners("error"), name).toEqual([run.client.poolListener]);
      expect(run.pool.connects, name).toBe(1);
    }
    expect(statement.client.statements).toContain("ROLLBACK");
    expect(statement.client.statements).not.toContain("COMMIT");
    expect(commit.client.statements).toContain("ROLLBACK");
    expect(release.client.statements).toContain("COMMIT"); // every read succeeded, the closing release failed: data still discarded
    expect(release.client.statements).not.toContain("ROLLBACK");
    expect(statement.read.ok ? -1 : statement.read.cleanup.attached_errors).toBe(0);
    expect(commit.read.ok ? -1 : commit.read.cleanup.attached_errors).toBe(0);
    expect(release.read.ok ? -1 : release.read.cleanup.attached_errors).toBe(1);
    // INITIAL stop: nothing known, nothing written; FINAL stop: every earlier fact and the cumulative writes are kept; never `recorded`
    const afterT3: Context = { d: PRESENT4, w: true };
    for (const run of [statement, commit, release]) {
      if (run.read.ok) throw new Error("expected a failed snapshot");
      const cleanup = run.read.cleanup;
      expect(stopFrom(initialContext(), snapshotFailureRow("preconditions", cleanup))).toEqual({
        kind: "stopped",
        stage: "preconditions",
        code: "pass1_preflight_failed",
        writes_attempted: false,
        durable: UNKNOWN4,
        cleanup,
      });
      expect(stopFrom(afterT3, snapshotFailureRow("final_check", cleanup))).toEqual({
        kind: "stopped",
        stage: "final_check",
        code: "pass1_preflight_failed",
        writes_attempted: true,
        durable: PRESENT4,
        cleanup,
      });
    }
    // a fault hook is not a driver failure: after bounded cleanup it propagates with its identity (rollback, one destroying release)
    const hookError = new RangeError("hook fault");
    const hooked = new FakeClient();
    hooked.rowsFor = (text) => (text.includes("FROM program_run_attempts") ? [{ attempt_id: SENTINEL }] : []);
    let caught: unknown;
    await withHook(
      (point) => {
        if (point === "writer_pass1_preflight_after_first_read") throw hookError;
      },
      async () => {
        try {
          await readPass1Snapshot(asPool(new FakePool(hooked)), plan);
        } catch (error) {
          caught = error;
        }
      },
    );
    expect(caught).toBe(hookError);
    expect(hooked.statements).toContain("ROLLBACK");
    expect(hooked.statements).not.toContain("COMMIT");
    expect(hooked.releases).toEqual([true]);
    expect(hooked.listeners("error")).toEqual([hooked.poolListener]);
    // a pure processing fault is not a database failure either: before any checkout it throws unchanged; after COMMIT it throws unchanged
    const processing = new TypeError("pure fault");
    const early = new FakePool(new FakeClient());
    const malformed = Object.create(plan, { claims: { value: 5 } }) as Pass1Plan;
    await expect(readPass1Snapshot(asPool(early), malformed)).rejects.toBeInstanceOf(TypeError);
    expect(early.connects).toBe(0);
    let reads = 0;
    const late = Object.create(plan, {
      t3: {
        get: () => {
          reads += 1;
          if (reads > 1) throw processing;
          return plan.t3;
        },
      },
    }) as Pass1Plan;
    const lateClient = new FakeClient();
    let thrown: unknown;
    try {
      await readPass1Snapshot(asPool(new FakePool(lateClient)), late);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(processing);
    expect(lateClient.statements).toContain("COMMIT");
    expect(lateClient.releases).toEqual([true]);
  }, T);

  it("U35 the partial-state classifier: all 16 stage vectors, run-field and host changes, foreign rows, mixed snapshots", () => {
    const classify = (raw: RawSnapshot, mode: "preflight" | "final" = "preflight") =>
      classifyPass1Snapshot(raw, plan, mode);
    const factsFor = (state: number): Durable => ({
      t1: state >= 1 ? "present" : "none_observed",
      reservation: state >= 2 ? "present" : "none_observed",
      outcome: state >= 3 ? "present" : "none_observed",
      lineage: state >= 4 ? "present" : "none_observed",
    });
    // (T1, reservation, event, T3): the five monotone vectors are accepted with their facts, the other eleven are refused
    const monotone = new Set(["0000", "1000", "1100", "1110", "1111"]);
    let accepted = 0;
    let refused = 0;
    for (let n = 0; n < 16; n += 1) {
      const bits: Bits = { t1: (n & 8) !== 0, call: (n & 4) !== 0, event: (n & 2) !== 0, t3: (n & 1) !== 0 };
      const vector = [bits.t1, bits.call, bits.event, bits.t3].map((on) => (on ? "1" : "0")).join("");
      const result = classify(rawFor(bits));
      if (monotone.has(vector)) {
        accepted += 1;
        expect(result.kind, vector).toBe("state");
        if (result.kind !== "state") continue;
        expect(result.state).toBe(vector.split("1").length - 1);
        expect(result.durable, vector).toEqual(factsFor(result.state));
      } else {
        refused += 1;
        expect(result.kind, vector).toBe("stop");
        if (result.kind !== "stop") continue;
        expect(result.row.code, vector).toBe("pass1_unexpected_state");
        expect(result.row.stage).toBe("preconditions");
        expect(result.row.writes).toBe(false);
        // the untrusted own rows give no facts: initial context + the row => every fact unknown, nothing written
        expect(stopFrom(initialContext(), { ...result.row, facts: result.row.facts }).durable).toEqual(UNKNOWN4);
      }
    }
    expect([accepted, refused]).toEqual([5, 11]);
    expect(showrunnerBriefHash(brief)).toBe(plan.script_payload.brief_hash);
    expect(evidencePackageHash(packagePayload)).toBe(plan.script_payload.package_hash);
    const unexpected = (raw: RawSnapshot): void => {
      const result = classify(raw);
      expect(result.kind).toBe("stop");
      if (result.kind === "stop") expect(result.row.code).toBe("pass1_unexpected_state");
    };
    // foreign additive row, a changed stop-boundary table, mixed-snapshot counts
    unexpected(rawFor(bitsOf(2), { count: { artifacts: 1 } }));
    unexpected(rawFor(bitsOf(2), { count: { gate_results: 1 } }));
    unexpected(rawFor(bitsOf(2), { count: { episodes: 1 } }));
    unexpected({ ...rawFor(bitsOf(0)), counts: rawFor(bitsOf(1)).counts }); // counts from one state, rows from another
    unexpected({ ...rawFor(bitsOf(1)), counts: rawFor(bitsOf(0)).counts });
    // a stored own row whose native flag says it differs (copied snapshot; the readonly input is never mutated)
    const good = rawFor(bitsOf(1));
    const artifacts = good.own.artifacts ?? [];
    const damaged: RawSnapshot = {
      ...good,
      own: { ...good.own, artifacts: [{ ...artifacts[0], eq_content_hash: false }, ...artifacts.slice(1)] },
    };
    unexpected(damaged);
    expect(classify(good).kind).toBe("state"); // the original is untouched
    // host / run / bindings / rights changes stop with their own codes (preflight) and host_changed (final); all four facts asserted
    const code = (raw: RawSnapshot, mode: "preflight" | "final") => {
      const result = classify(raw, mode);
      return result.kind === "stop" ? result : undefined;
    };
    for (const host of [
      { attempt_state: "EVIDENCE_READY" },
      { attempt_id: "6fc595be-d052-4281-a805-bce4154cb386" },
      { program_run_id: "1bb91b47-8419-4b4d-9c15-7aab856a10e5" },
      { purpose: "production" },
      { run_state: "READY" },
      { run_publication_enabled: true },
      { attempt_publication_enabled: true },
      { run_show_config_version_id: "d1250003-0000-4000-8000-000000000001" },
      { show_config_version_id: "d1250003-0000-4000-8000-000000000001" },
      { evidence_package_id: "d1250004-0000-4000-8000-000000000002" },
      { parent_attempt_id: PASS1_PIN.host.attempt_id },
      { repair_plan_id: PASS1_PIN.host.attempt_id },
    ] as Obj[]) {
      const pre = code(rawFor(bitsOf(4), { host }), "preflight");
      expect(pre?.row.code, JSON.stringify(host)).toBe("pass1_attempt_unavailable");
      expect(pre?.row.facts).toEqual(factsFor(4)); // the snapshot supports all four facts
      expect(code(rawFor(bitsOf(4), { host }), "final")?.row.code).toBe("pass1_host_changed");
    }
    expect(code({ ...rawFor(bitsOf(0)), host: undefined }, "preflight")?.row.code).toBe("pass1_attempt_unavailable");
    expect(classify(rawFor(bitsOf(4))).kind).toBe("state"); // repair: the unchanged host is accepted again
    const badBrief = rawFor(bitsOf(0), { brief: { payload: { ...brief, central_question: "changed" } } });
    expect(code(badBrief, "preflight")?.row.code).toBe("pass1_input_identity_mismatch");
    expect(code(badBrief, "final")?.row.code).toBe("pass1_host_changed");
    // the final mode accepts only the complete state
    expect(classify(rawFor(bitsOf(4)), "final").kind).toBe("state");
    const incomplete = code(rawFor(bitsOf(3)), "final");
    expect(incomplete?.row.code).toBe("pass1_unexpected_state");
    expect(incomplete?.row.stage).toBe("final_check");
    // the nine touched fixture counts of the design
    expect(
      Object.fromEntries(
        ["artifacts", "prompt_manifests", "provider_calls", "provider_call_events", "model_runs", "script_versions", "turns", "turn_claim_uses", "turn_evidence_uses"].map((t) => [t, plan.fixture_counts[t]]),
      ),
    ).toEqual({ artifacts: 36, prompt_manifests: 5, provider_calls: 15, provider_call_events: 15, model_runs: 5, script_versions: 3, turns: 51, turn_claim_uses: 36, turn_evidence_uses: 9 });
    expect(isAdmittedPlan(plan)).toBe(true);
    expect(isAdmittedPlan({ ...plan })).toBe(false);
    expect(bareStop("admission", "pass1_specimen_invalid").writes_attempted).toBe(false);
  });
});
