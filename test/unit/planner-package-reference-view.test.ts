import pg from "pg";
import { describe, expect, it, vi } from "vitest";

import { evidencePackageHash } from "../../src/identity/artifacts.js";
import { canonicalJson } from "../../src/identity/canonical-json.js";
import { evidencePackageScopeHash } from "../../src/identity/layer-b.js";
import {
  assertJson,
  isJsonObject,
  type Json,
} from "../../src/runtime/command.js";
import * as moduleExports from "../../src/runtime/planner-package-reference-view.js";
import {
  PROFILE,
  projectPlannerPackageReferenceView as project,
  type PlannerPackageReferenceError,
  type PlannerPackageParserCode,
} from "../../src/runtime/planner-package-reference-view.js";
import { fixtureBytes, fixtureJson } from "../support/fixture-v046.js";

type Obj = Record<string, Json>;
function object(value: Json | undefined): Obj {
  if (!isJsonObject(value)) throw new Error("test object missing");
  return value;
}
function array(value: Json | undefined): Json[] {
  if (!Array.isArray(value)) throw new Error("test array missing");
  return value;
}
function first(value: Json | undefined): Obj {
  return object(array(value)[0]);
}
function payload(): Obj {
  return object(assertJson(fixtureJson("evidence_package.json"), "test"));
}
function manifest(p: Obj): Obj {
  return object(p.manifest);
}
function claim(p: Obj): Obj {
  return first(manifest(p).claims);
}
function evidence(p: Obj): Obj {
  return first(manifest(p).evidence);
}
function beat(p: Obj): Obj {
  return first(manifest(p).beats);
}
function ref(p: Obj): Obj {
  return first(claim(p).support_refs);
}
function bind(p: Obj): string {
  p.package_hash = evidencePackageHash(p);
  p.scope_hash = evidencePackageScopeHash(manifest(p).scope);
  return canonicalJson(p);
}
function uuid(n: number): string {
  return `aaaaaaaa-aaaa-4aaa-8aaa-${n.toString(16).padStart(12, "0")}`;
}
function good(p: Obj = payload()) {
  const result = project(bind(p));
  if (result.kind !== "projected")
    throw new Error(
      `test setup refused: ${result.code}/${result.parser_code ?? "none"}`,
    );
  return result;
}
function refusal(
  input: unknown,
  code: PlannerPackageReferenceError,
  field = "input",
  parser_code: PlannerPackageParserCode | null = null,
): void {
  const result = project(input);
  expect(result).toEqual({
    kind: "rejected",
    profile: PROFILE,
    code,
    field,
    parser_code,
  });
  expect(Object.isFrozen(result)).toBe(true);
}
// Synthetic, self-consistent structural snapshots. These do not claim persisted rights/history.
function small(): Obj {
  const p = payload(),
    m = manifest(p),
    e = evidence(p),
    c = claim(p);
  const optional = [
    "event_completed_at",
    "market_event_identity",
    "observation_order",
    "observation_set_identity",
    "observation_window",
    "permitted_quote",
    "reasoning_only",
    "source_document_date",
    "source_document_identity",
    "untrusted_injection_specimen",
    "window_identity",
    "window_order",
  ];
  for (const key of optional) Reflect.deleteProperty(e, key);
  for (const key of [
    "acquisition_ref",
    "competition_identity",
    "entity_identity",
    "language",
    "modality",
    "origin",
    "retention_class",
    "rights_policy_version",
    "source_identity",
    "source_item_identity",
    "source_modality",
    "source_role",
  ])
    e[key] = "x";
  e.locator = { x: 0 };
  e.retention_declaration = {};
  e.consumer_exposure = {
    planner: "claim_only",
    writer: "hidden",
    auditor: "hidden",
  };
  for (const key of [
    "approved_representation",
    "kind",
    "origin",
    "predicate",
    "subject_domain",
    "subject_ref",
    "value_type",
  ])
    c[key] = "x";
  c.attribution_requirement = { required: false };
  c.value = {};
  c.support_refs = [];
  c.state_event_cursor = null;
  for (const key of [
    "claims",
    "evidence",
    "beats",
    "signals",
    "context_candidates",
    "continuity",
    "silent_inputs",
    "sensitivities",
    "coverage_conditions",
    "source_attribution",
  ])
    m[key] = [];
  m.claims = [c];
  m.evidence = [e];
  m.beats = [
    {
      beat_id: "b",
      candidate_selection_score: "0",
      label: "b",
      member_claim_refs: [c.claim_id ?? "missing"],
    },
  ];
  return p;
}
function support(p: Obj, n: number): Obj {
  return {
    claim_support_id: uuid(n),
    derivation_run_id: null,
    evidence_unit_id: evidence(p).evidence_unit_id ?? null,
    external_support_identity: null,
    support_hash: evidence(p).content_hash ?? "missing",
    support_kind: "evidence",
    support_role: "supports_value",
  };
}
const EXPECTED_VIEW_JSON =
  '{"beats":[{"beat_id":"beat_control","member_claim_refs":["d1250008-0000-4000-8000-000000000001","d1250008-0000-4000-8000-000000000002","d1250008-0000-4000-8000-000000000003","d1250008-0000-4000-8000-000000000004","d1250008-0000-4000-8000-000000000007"]},{"beat_id":"beat_supporter","member_claim_refs":["d1250008-0000-4000-8000-000000000005","d1250008-0000-4000-8000-000000000006","d1250008-0000-4000-8000-000000000009"]},{"beat_id":"beat_market","member_claim_refs":["d1250008-0000-4000-8000-000000000008"]}],"claims":[{"claim_content_hash":"fbb285c68fd26f5bb5cd26b6f0179d9aa0062e30e84e47e98c8c8d14292c2aa1","claim_id":"d1250008-0000-4000-8000-000000000001","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"2239630f0ed9835266704ae1432d3b269dccfdd2d43b946a2b969aae310e9e94","state_event_cursor":null,"support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000001","derivation_run_id":null,"evidence_unit_id":"d1250007-0000-4000-8000-000000000001","external_support_identity":null,"resolution":"package_evidence","support_hash":"5dfd65df76fdcd9b3fa8b2ab730cb38712f3941875ad2ae1319d788d256bd1a3","support_kind":"evidence","support_role":"supports_value"}]},{"claim_content_hash":"55e10cb05eef3ff50b04d02b9c328bd502e7f3af840ecd774ffe7f9743408376","claim_id":"d1250008-0000-4000-8000-000000000002","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"db0710627bea350c1ca0d9c3344c951c9bb57d7740dd8c23bbc91a7060fd732f","state_event_cursor":null,"support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000002","derivation_run_id":null,"evidence_unit_id":"d1250007-0000-4000-8000-000000000002","external_support_identity":null,"resolution":"package_evidence","support_hash":"a5565030c5163db39ffd10a1cd80a07cb30559d898737d23d87fc4f029fefdb0","support_kind":"evidence","support_role":"supports_value"}]},{"claim_content_hash":"a6b3d89db355e2854bf35519496959e3b343639ff074be88202d9c10a4f74d38","claim_id":"d1250008-0000-4000-8000-000000000003","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"3de1334c7a8e5c58ba2cbdd531d6541bec7e1a7f5fc7447714b41b584af2bae4","state_event_cursor":null,"support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000003","derivation_run_id":null,"evidence_unit_id":"d1250007-0000-4000-8000-000000000003","external_support_identity":null,"resolution":"package_evidence","support_hash":"a71d542b57e7edcfe91186a9a934b0301845599b4a40f7fecb8d6e633b4b8578","support_kind":"evidence","support_role":"supports_value"}]},{"claim_content_hash":"f8bdddac5d0d10856a94121cd1dd178fd650477cbd82e338afa52cde5b228672","claim_id":"d1250008-0000-4000-8000-000000000004","effective_usage_class":"hedged_only","frozen_state":"confirmed","frozen_state_hash":"59580d5287ca5d6d8c428d73936fc442c21454be258e5b0c6d4b5209b2fca4cd","state_event_cursor":null,"support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000004","derivation_run_id":null,"evidence_unit_id":"d1250007-0000-4000-8000-000000000004","external_support_identity":null,"resolution":"package_evidence","support_hash":"98cc45be73f4be9296b343ad543d249a63fc20f6c31daf0a86b6c90eb1b8e4df","support_kind":"evidence","support_role":"supports_value"}]},{"claim_content_hash":"077522e8f69193fa36fa038ab8378b3780c49456f67ea9eb730c928da00733c5","claim_id":"d1250008-0000-4000-8000-000000000005","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"4a32d360454d615f54c7b467e95338c8cde8c9388c67919aa9bc4bcf8fa41a8e","state_event_cursor":null,"support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000005","derivation_run_id":null,"evidence_unit_id":null,"external_support_identity":"artifact:d1250005-0000-4000-8000-000000000017","resolution":"external_unverified","support_hash":"46e6a24048f151f62f9e03a66bb57ca4aae78c0281630850bc74bf9205cd4c28","support_kind":"signal","support_role":"supports_value"}]},{"claim_content_hash":"9be7ef594118c81d980d25a343ade42b6dfc2932c9a3a31eb69170584aee117d","claim_id":"d1250008-0000-4000-8000-000000000006","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"2999b750b23ef1a6c98b3b6ab029a0cf734ea6d2ca9a823f5420dce700bcfc5f","state_event_cursor":null,"support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000006","derivation_run_id":null,"evidence_unit_id":"d1250007-0000-4000-8000-000000000009","external_support_identity":null,"resolution":"package_evidence","support_hash":"413c4fc6bbce8ab3ec6704e07bfc85f7e6800b92ae8f51de1c430b65a74c6ee3","support_kind":"evidence","support_role":"supports_value"}]},{"claim_content_hash":"cabbed4a2abed81a76fa2a0d4ce7ca2232545224ffbd37ac5a01e1b56fb2063f","claim_id":"d1250008-0000-4000-8000-000000000007","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"98fa9d6b3406e2b5734cc8fcc12cdd9038e9976838d95f1d4b7f8321ecfb833e","state_event_cursor":null,"support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000007","derivation_run_id":"d1250009-0000-4000-8000-000000000001","evidence_unit_id":null,"external_support_identity":null,"resolution":"external_unverified","support_hash":"eb65fd3581e65333e7dcc68a0150e17dc8e728c8e348510b7c3ca12f2d748a88","support_kind":"derivation","support_role":"supports_value"}]},{"claim_content_hash":"d635b3253e5d2aba9cea12a2ac3495606ebac7d3d365b6b9623d613fa92e7a53","claim_id":"d1250008-0000-4000-8000-000000000008","effective_usage_class":"silent","frozen_state":"confirmed","frozen_state_hash":"4006b76c4b9ad0bd1a841ddaa5930d877c110fb821f522c45f71ae2c8ae1ffa3","state_event_cursor":null,"support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000008","derivation_run_id":null,"evidence_unit_id":"d1250007-0000-4000-8000-000000000010","external_support_identity":null,"resolution":"package_evidence","support_hash":"348f6a219bc56f3d69f86267c1669d9c672f30db7712dc88cd6a8f4ff6e1f8f4","support_kind":"evidence","support_role":"supports_value"}]},{"claim_content_hash":"92d17eee43920805daf81919b546e7be44a50915d579e4da84ff5782e828d54f","claim_id":"d1250008-0000-4000-8000-000000000009","effective_usage_class":"assertable","frozen_state":"confirmed","frozen_state_hash":"dfa61e2a799d3966fe4eccb6998b9d4925e074a04ad07724d95957d4052d8231","state_event_cursor":null,"support_refs":[{"claim_support_id":"d125000a-0000-4000-8000-000000000009","derivation_run_id":null,"evidence_unit_id":null,"external_support_identity":"artifact:d1250005-0000-4000-8000-000000000018","resolution":"external_unverified","support_hash":"2192b1ec1e126a0d7f705e69338cc5e2b457c6cd8f13136bc07f72cccdf46dd1","support_kind":"continuity","support_role":"supports_value"}]}],"evidence":[{"content_hash":"5dfd65df76fdcd9b3fa8b2ab730cb38712f3941875ad2ae1319d788d256bd1a3","evidence_unit_id":"d1250007-0000-4000-8000-000000000001","planner_exposure":"claim_only","rights_version_id":"d1250006-0000-4000-8000-000000000004"},{"content_hash":"a5565030c5163db39ffd10a1cd80a07cb30559d898737d23d87fc4f029fefdb0","evidence_unit_id":"d1250007-0000-4000-8000-000000000002","planner_exposure":"claim_only","rights_version_id":"d1250006-0000-4000-8000-000000000002"},{"content_hash":"a71d542b57e7edcfe91186a9a934b0301845599b4a40f7fecb8d6e633b4b8578","evidence_unit_id":"d1250007-0000-4000-8000-000000000003","planner_exposure":"paraphrase","rights_version_id":"d1250006-0000-4000-8000-000000000005"},{"content_hash":"98cc45be73f4be9296b343ad543d249a63fc20f6c31daf0a86b6c90eb1b8e4df","evidence_unit_id":"d1250007-0000-4000-8000-000000000004","planner_exposure":"paraphrase","rights_version_id":"d1250006-0000-4000-8000-000000000005"},{"content_hash":"bb010e8fa7d1b2925a142620f20771294db03a6077c78ab72b041a3601cd41f3","evidence_unit_id":"d1250007-0000-4000-8000-000000000005","planner_exposure":"paraphrase","rights_version_id":"d1250006-0000-4000-8000-000000000007"},{"content_hash":"290dca152f388f068d078aca310869cb6aebc6506588f9c9d06de4a5cce1d7e0","evidence_unit_id":"d1250007-0000-4000-8000-000000000006","planner_exposure":"paraphrase","rights_version_id":"d1250006-0000-4000-8000-000000000007"},{"content_hash":"3089e7a00a05ca9145a2b83edf9dc3e0fd7d1b7be70df5f5f69ffde049958e21","evidence_unit_id":"d1250007-0000-4000-8000-000000000007","planner_exposure":"paraphrase","rights_version_id":"d1250006-0000-4000-8000-000000000007"},{"content_hash":"3a462ce692fcdbdffcb3ce62810b2efbe50a1d18af3460944f46ba00623fdef5","evidence_unit_id":"d1250007-0000-4000-8000-000000000008","planner_exposure":"paraphrase","rights_version_id":"d1250006-0000-4000-8000-000000000007"},{"content_hash":"413c4fc6bbce8ab3ec6704e07bfc85f7e6800b92ae8f51de1c430b65a74c6ee3","evidence_unit_id":"d1250007-0000-4000-8000-000000000009","planner_exposure":"exact_excerpt","rights_version_id":"d1250006-0000-4000-8000-000000000006"},{"content_hash":"348f6a219bc56f3d69f86267c1669d9c672f30db7712dc88cd6a8f4ff6e1f8f4","evidence_unit_id":"d1250007-0000-4000-8000-000000000010","planner_exposure":"claim_only","rights_version_id":"d1250006-0000-4000-8000-000000000003"},{"content_hash":"3c7a7888d1ae4d5c6a40aadae89f0db9cf0732c3a22265c65ac688867c785150","evidence_unit_id":"d1250007-0000-4000-8000-000000000012","planner_exposure":"claim_only","rights_version_id":"d1250006-0000-4000-8000-000000000002"},{"content_hash":"ad8cbb012e22007db8c815249f907fbbf2039b63c83d3d9be6a222249a7ffd24","evidence_unit_id":"d1250007-0000-4000-8000-000000000013","planner_exposure":"claim_only","rights_version_id":"d1250006-0000-4000-8000-000000000002"},{"content_hash":"c5ff2da2639e0f56c53a2812dda8e435f5c7ccfd1df7fe306ace66e075652fba","evidence_unit_id":"d1250007-0000-4000-8000-000000000014","planner_exposure":"claim_only","rights_version_id":"d1250006-0000-4000-8000-000000000002"},{"content_hash":"fa9d0a653d449f5d4b599799dffcc487e04f2cc24dbcec7e0451bb102eebdc6b","evidence_unit_id":"d1250007-0000-4000-8000-000000000015","planner_exposure":"claim_only","rights_version_id":"d1250006-0000-4000-8000-000000000002"},{"content_hash":"b21989b1b1461ca40d2ce84498250648e5f03949881d9fc3e82167fbf36acba5","evidence_unit_id":"d1250007-0000-4000-8000-000000000016","planner_exposure":"claim_only","rights_version_id":"d1250006-0000-4000-8000-000000000002"}],"materialization":"reference_only","package_hash":"a8655c0e8bd72094a823b367a0c21cd665d3d99c271341286a92dbdc2ea304ab","schema":"planner-package-reference-view/1","scope_hash":"ecb1eb2b675a9e383dfe88e6311f8cc88cc97eb17183df9a8cae935d8d1f8979"}';

describe("actual-package reference-only View", () => {
  it("exports only the closed runtime API", () => {
    expect(Object.keys(moduleExports).sort()).toEqual([
      "PROFILE",
      "projectPlannerPackageReferenceView",
    ]);
  });
  it("matches the complete independent literal fixture View and all three identity levels", () => {
    const p = payload(),
      before = canonicalJson(p),
      result = project(before);
    expect(result.kind).toBe("projected");
    if (result.kind !== "projected") throw new Error("fixture refused");
    expect(before.length).toBe(40713);
    expect(result.observation).toEqual({
      source_text_utf8_bytes: "40713",
      source_text_sha256:
        "62a5d00b86a7bd3661ff2b2542fdd1f31051c981098f519aa0965747a1c51ee5",
    });
    expect(result.view.package_hash).toBe(
      "a8655c0e8bd72094a823b367a0c21cd665d3d99c271341286a92dbdc2ea304ab",
    );
    expect(result.view.scope_hash).toBe(
      "ecb1eb2b675a9e383dfe88e6311f8cc88cc97eb17183df9a8cae935d8d1f8979",
    );
    expect(result.canonical_json).toBe(EXPECTED_VIEW_JSON);
    expect(result.view).toEqual(JSON.parse(EXPECTED_VIEW_JSON));
    expect(result.view_sha256).toBe(
      "1d04cc0a7722a51678d04932feb13e87be5ffaaacb3a36a45eb664ff3772d578",
    );
    expect(result.view.claims).toHaveLength(9);
    expect(result.view.evidence).toHaveLength(15);
    expect(result.view.beats).toHaveLength(3);
    const refs = result.view.claims.flatMap((c) => c.support_refs);
    expect(refs).toHaveLength(9);
    expect(
      refs.filter((r) => r.resolution === "external_unverified"),
    ).toHaveLength(3);
    expect(canonicalJson(p)).toBe(before);
    refusal(
      fixtureBytes("evidence_package.json").toString("utf8"),
      "input_text_noncanonical",
    );
  });
  it("keeps envelope observation distinct from semantic package/View identity", () => {
    const p = payload(),
      a = good(p);
    p.created_at = "2026-10-10T00:00:00Z";
    p.id = uuid(9000);
    const b = good(p);
    expect(b.observation.source_text_sha256).not.toBe(
      a.observation.source_text_sha256,
    );
    expect(b.view).toEqual(a.view);
    expect(b.view_sha256).toBe(a.view_sha256);
    manifest(p).availability = { changed: "not emitted" };
    const c = good(p);
    expect(c.view.package_hash).not.toBe(a.view.package_hash);
    expect(c.view_sha256).not.toBe(a.view_sha256);
    expect(c.view.claims).toEqual(a.view.claims);
    expect(c.view.evidence).toEqual(a.view.evidence);
    expect(c.view.beats).toEqual(a.view.beats);
  });
  it("binds same-length omitted content and refuses stale digests", () => {
    const p = small(),
      a = good(p);
    claim(p).approved_representation = "y";
    refusal(
      canonicalJson(p),
      "parser_rejected",
      "package",
      "package_hash_field_mismatch",
    );
    const b = good(p);
    expect(b.view.claims).toEqual(a.view.claims);
    expect(b.view_sha256).not.toBe(a.view_sha256);
    p.scope_hash = "0".repeat(64);
    refusal(
      canonicalJson(p),
      "parser_rejected",
      "package",
      "package_scope_hash_mismatch",
    );
  });
  it("returns fresh recursively frozen ordinary objects, cursor and arrays without input aliases", () => {
    const p = small();
    claim(p).state_event_cursor = {
      claim_state_event_id: uuid(10),
      event_sequence: 2147483647,
    };
    claim(p).support_refs = [support(p, 20)];
    bind(p);
    const before = canonicalJson(p),
      a = good(p),
      b = good(p);
    const visit = (v: unknown): void => {
      if (typeof v !== "object" || v === null) return;
      expect(Object.isFrozen(v)).toBe(true);
      expect(Object.getPrototypeOf(v)).toBe(
        Array.isArray(v) ? Array.prototype : Object.prototype,
      );
      for (const child of Object.values(v)) visit(child);
    };
    visit(a);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a.view.claims[0]).not.toBe(b.view.claims[0]);
    expect(a.view.claims[0]?.state_event_cursor).not.toBe(
      claim(p).state_event_cursor,
    );
    expect(canonicalJson(p)).toBe(before);
    object(claim(p).state_event_cursor).event_sequence = 1;
    array(beat(p).member_claim_refs).push(uuid(99));
    expect(a.view.claims[0]?.state_event_cursor?.event_sequence).toBe(
      2147483647,
    );
    expect(a.view.beats[0]?.member_claim_refs).toHaveLength(1);
    expect(() => {
      Object.defineProperty(a.view, "extra", { value: true });
    }).toThrow(TypeError);
  });
  it("performs no connect/query calls during projection or refusal", () => {
    const client = vi.spyOn(pg.Client.prototype, "connect"),
      query = vi.spyOn(pg.Client.prototype, "query"),
      pool = vi.spyOn(pg.Pool.prototype, "connect");
    try {
      good();
      refusal(null, "input_type_invalid");
      expect(client).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
      expect(pool).not.toHaveBeenCalled();
    } finally {
      client.mockRestore();
      query.mockRestore();
      pool.mockRestore();
    }
  });
});

describe("phase priorities and primitive/native boundaries", () => {
  it.each([
    null,
    undefined,
    true,
    1,
    1n,
    Symbol("input"),
    [],
    {},
    () => 0,
    new String("null"),
  ])("rejects a nonprimitive string without coercion %#", (input) => {
    refusal(input, "input_type_invalid");
  });
  it("never reflects/coerces a hostile object or Proxy", () => {
    let calls = 0;
    const fail = () => {
      calls++;
      throw new Error("caller code");
    };
    const value = new Proxy(
      {
        get valueOf() {
          return fail;
        },
        get toJSON() {
          return fail;
        },
        get [Symbol.toPrimitive]() {
          return fail;
        },
      },
      {
        get: fail,
        getPrototypeOf: fail,
        ownKeys: fail,
        getOwnPropertyDescriptor: fail,
      },
    );
    refusal(value, "input_type_invalid");
    expect(calls).toBe(0);
  });
  it.each([
    ["", "input_text_empty"],
    ["\ud800", "input_unicode_invalid"],
    ["\udc00", "input_unicode_invalid"],
    ["[", "input_json_invalid"],
    ["{]", "input_json_invalid"],
    ["-0", "input_semantic_json_invalid"],
    ["1.5", "input_semantic_json_invalid"],
    ["9007199254740992", "input_semantic_json_invalid"],
    ["1e309", "input_semantic_json_invalid"],
    ['"\\ud800"', "input_semantic_json_invalid"],
    ['"\\udc00"', "input_semantic_json_invalid"],
    ['{"\\ud800":0}', "input_semantic_json_invalid"],
    ['{"e\\u0301":0,"é":1}', "input_semantic_json_invalid"],
    ['{"a":1.5,"e\\u0301":0,"é":1}', "input_semantic_json_invalid"],
    ['{"a":0,"a":0}', "input_text_noncanonical"],
    [" null", "input_text_noncanonical"],
    ["1.0", "input_text_noncanonical"],
    ["1e0", "input_text_noncanonical"],
    ['"\\u0061"', "input_text_noncanonical"],
    ['"e\\u0301"', "input_text_noncanonical"],
    ['{"b":0,"a":0}', "input_text_noncanonical"],
  ] as const)("maps literal %s to %s", (input, code) => {
    refusal(input, code);
  });
  it("keeps null and valid scalar rejection at inherited parser boundary", () => {
    for (const input of ["null", "true", "0", '"😀"', "[]"])
      refusal(input, "parser_rejected", "package", "package_payload_shape");
  });
  it("allows escaped quotes/brackets inside strings without counting them as containers", () => {
    refusal(
      JSON.stringify('[{\\"}]'.repeat(100)),
      "parser_rejected",
      "package",
      "package_payload_shape",
    );
  });
  it("enforces UTF16 first, then surrogate, then UTF8 length at exact one-MiB boundary", () => {
    refusal(
      '"' + "x".repeat(1048574) + '"',
      "parser_rejected",
      "package",
      "package_payload_shape",
    );
    refusal('"' + "x".repeat(1048575) + '"', "input_resource_limit");
    refusal("x".repeat(1048576) + "\ud800", "input_resource_limit");
    refusal(
      '"' + "é".repeat(524287) + '"',
      "parser_rejected",
      "package",
      "package_payload_shape",
    );
    refusal('"' + "é".repeat(524287) + 'a"', "input_resource_limit");
    refusal('"' + "é".repeat(524287) + '\ud800"', "input_unicode_invalid");
  });
  it("uses exact container depth32/33 and value/key node16384/16385 limits", () => {
    refusal(
      "[".repeat(32) + "0" + "]".repeat(32),
      "parser_rejected",
      "package",
      "package_payload_shape",
    );
    refusal("[".repeat(33) + "0" + "]".repeat(33), "input_resource_limit");
    refusal("[".repeat(33), "input_resource_limit");
    refusal(
      "[" + Array(16383).fill("null").join(",") + "]",
      "parser_rejected",
      "package",
      "package_payload_shape",
    );
    refusal(
      "[" + Array(16384).fill("null").join(",") + "]",
      "input_resource_limit",
    );
    const keys = Object.fromEntries(
      Array.from({ length: 8191 }, (_, i) => [String(i), null]),
    );
    refusal(canonicalJson({ ...keys, last: [] }), "input_resource_limit");
    refusal(
      canonicalJson(keys),
      "parser_rejected",
      "package",
      "package_field_missing",
    );
  });
  it("propagates unexpected internal/native TypeError and restores the exact descriptor", () => {
    const saved = Object.getOwnPropertyDescriptor(
      String.prototype,
      "normalize",
    );
    if (!saved) throw new Error("native descriptor absent");
    const failure = new TypeError("controlled internal error");
    try {
      Object.defineProperty(String.prototype, "normalize", {
        ...saved,
        value: () => {
          throw failure;
        },
      });
      expect(() => project('"valid"')).toThrow(failure);
      expect(() => project('{"a":0}')).toThrow(failure);
    } finally {
      Object.defineProperty(String.prototype, "normalize", saved);
    }
    expect(
      Object.getOwnPropertyDescriptor(String.prototype, "normalize"),
    ).toEqual(saved);
    good();
  });
});

interface ParserCase {
  code: PlannerPackageParserCode;
  mutate: (p: Obj) => void;
  rehash?: boolean;
}
const parserCases: ParserCase[] = [
  {
    code: "invalid_uuid",
    mutate: (p) => {
      p.artifact_id = null;
    },
  },
  {
    code: "invalid_hash",
    mutate: (p) => {
      evidence(p).content_hash = "bad";
    },
    rehash: true,
  },
  {
    code: "invalid_timestamp",
    mutate: (p) => {
      p.created_at = "2026-02-30T00:00:00Z";
    },
  },
  {
    code: "timestamp_precision",
    mutate: (p) => {
      p.created_at = "2026-01-01T00:00:00.1234567Z";
    },
  },
  {
    code: "package_field_missing",
    mutate: (p) => {
      Reflect.deleteProperty(p, "id");
    },
  },
  {
    code: "package_field_unknown_field",
    mutate: (p) => {
      p.extra = true;
    },
  },
  {
    code: "package_field_type",
    mutate: (p) => {
      p.selector_run_id = null;
    },
  },
  {
    code: "package_schema_unknown",
    mutate: (p) => {
      p.schema_version = "other";
    },
  },
  {
    code: "package_manifest_missing",
    mutate: (p) => {
      p.manifest = null;
    },
  },
  {
    code: "package_manifest_section_missing",
    mutate: (p) => {
      Reflect.deleteProperty(manifest(p), "beats");
    },
  },
  {
    code: "package_manifest_section_unknown_field",
    mutate: (p) => {
      manifest(p).extra = true;
    },
  },
  {
    code: "package_manifest_section_type",
    mutate: (p) => {
      manifest(p).beats = null;
    },
  },
  {
    code: "package_hash_field_mismatch",
    mutate: (p) => {
      p.package_hash = "0".repeat(64);
    },
  },
  {
    code: "package_scope_invalid",
    mutate: (p) => {
      object(manifest(p).scope).scope_type = "other";
      p.package_hash = evidencePackageHash(p);
    },
  },
  {
    code: "package_scope_hash_mismatch",
    mutate: (p) => {
      p.scope_hash = "0".repeat(64);
    },
  },
  {
    code: "package_evidence_shape",
    mutate: (p) => {
      array(manifest(p).evidence)[0] = null;
    },
    rehash: true,
  },
  {
    code: "package_evidence_field_missing",
    mutate: (p) => {
      Reflect.deleteProperty(evidence(p), "language");
    },
    rehash: true,
  },
  {
    code: "package_evidence_field_unknown_field",
    mutate: (p) => {
      evidence(p).extra = true;
    },
    rehash: true,
  },
  {
    code: "package_evidence_field_type",
    mutate: (p) => {
      evidence(p).language = null;
    },
    rehash: true,
  },
  {
    code: "package_evidence_exposure_shape",
    mutate: (p) => {
      object(evidence(p).consumer_exposure).planner = "other";
    },
    rehash: true,
  },
  {
    code: "package_evidence_locator_unit",
    mutate: (p) => {
      object(evidence(p).locator).evidence_unit_id = uuid(7000);
    },
    rehash: true,
  },
  {
    code: "package_evidence_duplicate",
    mutate: (p) => {
      array(manifest(p).evidence).push(structuredClone(evidence(p)));
    },
    rehash: true,
  },
  {
    code: "package_claim_shape",
    mutate: (p) => {
      array(manifest(p).claims)[0] = null;
    },
    rehash: true,
  },
  {
    code: "package_claim_field_missing",
    mutate: (p) => {
      Reflect.deleteProperty(claim(p), "predicate");
    },
    rehash: true,
  },
  {
    code: "package_claim_field_unknown_field",
    mutate: (p) => {
      claim(p).extra = true;
    },
    rehash: true,
  },
  {
    code: "package_claim_field_type",
    mutate: (p) => {
      claim(p).predicate = null;
    },
    rehash: true,
  },
  {
    code: "package_claim_cursor_shape",
    mutate: (p) => {
      claim(p).state_event_cursor = {
        claim_state_event_id: uuid(1),
        event_sequence: 0,
      };
    },
    rehash: true,
  },
  {
    code: "package_support_refs_missing",
    mutate: (p) => {
      claim(p).support_refs = null;
    },
    rehash: true,
  },
  {
    code: "package_support_ref_missing",
    mutate: (p) => {
      Reflect.deleteProperty(ref(p), "support_hash");
    },
    rehash: true,
  },
  {
    code: "package_support_ref_unknown_field",
    mutate: (p) => {
      ref(p).extra = true;
    },
    rehash: true,
  },
  {
    code: "package_support_ref_shape",
    mutate: (p) => {
      ref(p).support_role = "other";
    },
    rehash: true,
  },
  {
    code: "package_support_ref_duplicate",
    mutate: (p) => {
      array(claim(p).support_refs).push(structuredClone(ref(p)));
    },
    rehash: true,
  },
  {
    code: "package_claim_duplicate",
    mutate: (p) => {
      array(manifest(p).claims).push(structuredClone(claim(p)));
    },
    rehash: true,
  },
  {
    code: "package_reference_shape",
    mutate: (p) => {
      manifest(p).silent_inputs = [null];
    },
    rehash: true,
  },
  {
    code: "package_reference_unresolved",
    mutate: (p) => {
      array(beat(p).member_claim_refs).push(uuid(7000));
    },
    rehash: true,
  },
];
describe("unchanged parser priority and safe classifications", () => {
  it.each(parserCases)(
    "retains exact $code with uniform package field",
    ({ code, mutate, rehash }) => {
      const p = payload();
      mutate(p);
      refusal(
        rehash ? bind(p) : canonicalJson(p),
        "parser_rejected",
        "package",
        code,
      );
    },
  );
  it("preserves source first-error order for competing defects", () => {
    const p = payload();
    Reflect.deleteProperty(p, "id");
    p.extra = true;
    refusal(
      canonicalJson(p),
      "parser_rejected",
      "package",
      "package_field_missing",
    );
    const q = payload();
    evidence(q).language = null;
    ref(q).support_hash = null;
    q.package_hash = "0".repeat(64);
    refusal(
      canonicalJson(q),
      "parser_rejected",
      "package",
      "package_hash_field_mismatch",
    );
    refusal(
      bind(q),
      "parser_rejected",
      "package",
      "package_evidence_field_type",
    );
  });
  it.each([
    null,
    0,
    -1,
    2147483648,
    "1",
    { claim_state_event_id: uuid(1), event_sequence: 1, extra: true },
  ])("rejects malformed cursor or out-of-range sequence %#", (v) => {
    const p = small();
    claim(p).state_event_cursor =
      typeof v === "object" && v !== null
        ? v
        : { claim_state_event_id: uuid(1), event_sequence: v };
    refusal(
      bind(p),
      "parser_rejected",
      "package",
      "package_claim_cursor_shape",
    );
  });
  it("allows nullable speaker/event and null cursor but does not invent a generic null rule", () => {
    const p = small();
    evidence(p).speaker_identity = null;
    evidence(p).event_identity = null;
    expect(good(p).view.claims[0]?.state_event_cursor).toBeNull();
    claim(p).value = null;
    refusal(bind(p), "parser_rejected", "package", "package_claim_field_type");
  });
  it.each(["silent_inputs", "context_candidates", "beats"])(
    "checks inherited %s structural references",
    (section) => {
      const p = small();
      manifest(p)[section] = [
        section === "beats"
          ? { member_claim_refs: [uuid(7000)] }
          : section === "silent_inputs"
            ? { claim_id: uuid(7000), support_refs: [] }
            : { claim_id: uuid(7000) },
      ];
      refusal(
        bind(p),
        "parser_rejected",
        "package",
        "package_reference_unresolved",
      );
    },
  );
});

describe("closed extraction and structural resolution", () => {
  it.each(["beat_id", "candidate_selection_score", "label"])(
    "maps null nonnullable beat %s exactly",
    (key) => {
      const p = small();
      beat(p)[key] = null;
      refusal(
        bind(p),
        "profile_beat_field",
        `package.manifest.beats[0].${key}`,
      );
    },
  );
  it.each(["", " ", "x".repeat(65), "e\u0301"])(
    "rejects invalid score %#",
    (value) => {
      const p = small();
      beat(p).candidate_selection_score = value;
      const input = JSON.stringify(p);
      if (value === "e\u0301") {
        refusal(input, "input_text_noncanonical");
        return;
      }
      refusal(
        bind(p),
        "profile_beat_field",
        "package.manifest.beats[0].candidate_selection_score",
      );
    },
  );
  it.each(["", "a b", "x".repeat(65), "é"])(
    "rejects invalid beat id %#",
    (value) => {
      const p = small();
      beat(p).beat_id = value;
      refusal(
        bind(p),
        "profile_beat_field",
        "package.manifest.beats[0].beat_id",
      );
    },
  );
  it("uses UTF16 label/score bounds and native whitespace predicate", () => {
    const p = small();
    beat(p).label = "😀".repeat(128);
    beat(p).candidate_selection_score = "😀".repeat(32);
    good(p);
    beat(p).label = "😀".repeat(128) + "x";
    refusal(bind(p), "profile_beat_field", "package.manifest.beats[0].label");
    beat(p).label = "\u2003";
    refusal(bind(p), "profile_beat_field", "package.manifest.beats[0].label");
  });
  it.each(["missing", "extra"])(
    "refuses beat shape before field validation: %s",
    (mode) => {
      const p = small();
      beat(p).beat_id = null;
      if (mode === "missing") Reflect.deleteProperty(beat(p), "label");
      else beat(p).extra = 0;
      refusal(bind(p), "profile_beat_shape", "package.manifest.beats[0]");
    },
  );
  it("refuses duplicate beat/member at the later precise index", () => {
    const p = small();
    array(manifest(p).beats).push(structuredClone(beat(p)));
    refusal(
      bind(p),
      "profile_beat_duplicate",
      "package.manifest.beats[1].beat_id",
    );
    beat(p).member_claim_refs = [
      claim(p).claim_id ?? "missing",
      claim(p).claim_id ?? "missing",
    ];
    array(manifest(p).beats).pop();
    refusal(
      bind(p),
      "profile_member_duplicate",
      "package.manifest.beats[0].member_claim_refs[1]",
    );
  });
  it("allows repeated membership across distinct beats", () => {
    const p = small();
    array(manifest(p).beats).push({
      ...structuredClone(beat(p)),
      beat_id: "other",
    });
    expect(good(p).view.beats).toHaveLength(2);
  });
  it("prioritizes unresolved/hash/hidden and omits only nonreferenced hidden evidence", () => {
    const p = small();
    claim(p).support_refs = [support(p, 20)];
    ref(p).evidence_unit_id = uuid(999);
    refusal(
      bind(p),
      "profile_support_unresolved",
      "package.manifest.claims[0].support_refs[0].evidence_unit_id",
    );
    ref(p).evidence_unit_id = evidence(p).evidence_unit_id ?? null;
    ref(p).support_hash = "0".repeat(64);
    object(evidence(p).consumer_exposure).planner = "hidden";
    refusal(
      bind(p),
      "profile_support_hash_mismatch",
      "package.manifest.claims[0].support_refs[0].support_hash",
    );
    ref(p).support_hash = evidence(p).content_hash ?? "missing";
    refusal(
      bind(p),
      "profile_hidden_support",
      "package.manifest.claims[0].support_refs[0].evidence_unit_id",
    );
    claim(p).support_refs = [];
    expect(good(p).view.evidence).toHaveLength(0);
  });
  it.each([
    "evidence",
    "derivation",
    "lore",
    "signal",
    "prediction",
    "continuity",
  ])(
    "retains %s kind/all roles/nullable targets without external claims",
    (kind) => {
      const p = small();
      claim(p).support_refs = [
        "supports_value",
        "supports_attribution",
        "qualifies",
        "contradicts",
        "context_only",
      ].map((role, i) => ({
        claim_support_id: uuid(100 + i),
        derivation_run_id: kind === "derivation" ? uuid(200) : null,
        evidence_unit_id:
          kind === "evidence" ? (evidence(p).evidence_unit_id ?? null) : null,
        external_support_identity:
          kind !== "evidence" && kind !== "derivation"
            ? `artifact:${uuid(300)}`
            : null,
        support_hash: evidence(p).content_hash ?? "missing",
        support_kind: kind,
        support_role: role,
      }));
      const refs = good(p).view.claims[0]?.support_refs;
      expect(refs).toHaveLength(5);
      expect(refs?.map((r) => r.support_role)).toEqual([
        "supports_value",
        "supports_attribution",
        "qualifies",
        "contradicts",
        "context_only",
      ]);
      expect(
        refs?.every(
          (r) =>
            r.resolution ===
            (kind === "evidence" ? "package_evidence" : "external_unverified"),
        ),
      ).toBe(true);
      if (kind !== "evidence" && kind !== "derivation") {
        ref(p).external_support_identity = "source:unknown";
        refusal(
          bind(p),
          "profile_external_ref_unsupported",
          "package.manifest.claims[0].support_refs[0].external_support_identity",
        );
      }
    },
  );
  it("permits all parser statuses/usages and all nonhidden exposures without content materialization", () => {
    for (const status of [
      "confirmed",
      "contested",
      "demoted",
      "superseded",
      "expired",
      "tombstoned",
    ]) {
      const p = small();
      claim(p).frozen_state = status;
      expect(good(p).view.claims[0]?.frozen_state).toBe(status);
    }
    for (const usage of ["assertable", "hedged_only", "silent"]) {
      const p = small();
      claim(p).effective_usage_class = usage;
      expect(good(p).view.claims[0]?.effective_usage_class).toBe(usage);
    }
    for (const exposure of ["claim_only", "paraphrase", "exact_excerpt"]) {
      const p = small();
      object(evidence(p).consumer_exposure).planner = exposure;
      expect(good(p).view.evidence[0]?.planner_exposure).toBe(exposure);
    }
  });
  it.each(["evidence", "claims", "beats"])(
    "enforces %s array256/257 with otherwise valid snapshots",
    (section) => {
      const p = small(),
        m = manifest(p),
        base = first(m[section]);
      m[section] = Array.from({ length: 256 }, (_, i) => ({
        ...structuredClone(base),
        ...(section === "evidence"
          ? { evidence_unit_id: uuid(i + 1000) }
          : section === "claims"
            ? { claim_id: uuid(i + 1000) }
            : { beat_id: `b${String(i)}` }),
      }));
      if (section === "claims")
        beat(p).member_claim_refs = [
          object(array(m.claims)[0]).claim_id ?? "missing",
        ];
      good(p);
      array(m[section]).push({
        ...structuredClone(base),
        ...(section === "evidence"
          ? { evidence_unit_id: uuid(9000) }
          : section === "claims"
            ? { claim_id: uuid(9000) }
            : { beat_id: "extra" }),
      });
      refusal(bind(p), "profile_array_limit", `package.manifest.${section}`);
    },
  );
  it("enforces per-claim support256/257 independently of resource limits", () => {
    const p = small();
    claim(p).support_refs = Array.from({ length: 256 }, (_, i) =>
      support(p, i + 1000),
    );
    good(p);
    array(claim(p).support_refs).push(support(p, 9000));
    refusal(
      bind(p),
      "profile_array_limit",
      "package.manifest.claims[0].support_refs",
    );
  });
  it("allows4096 membership refs and refuses4097; member-array excess wins first", () => {
    const p = small(),
      m = manifest(p),
      base = claim(p);
    m.claims = Array.from({ length: 256 }, (_, i) => ({
      ...structuredClone(base),
      claim_id: uuid(i + 1000),
    }));
    const members = array(m.claims).map((c) => object(c).claim_id ?? "missing");
    m.beats = Array.from({ length: 16 }, (_, i) => ({
      beat_id: `b${String(i)}`,
      candidate_selection_score: "0",
      label: "b",
      member_claim_refs: members,
    }));
    good(p);
    array(m.beats).push({
      beat_id: "extra",
      candidate_selection_score: "0",
      label: "b",
      member_claim_refs: [members[0] ?? "missing"],
    });
    refusal(
      bind(p),
      "profile_reference_limit",
      "package.manifest.beats[16].member_claim_refs",
    );
    beat(p).member_claim_refs = [...members, members[0] ?? "missing"];
    refusal(
      bind(p),
      "profile_array_limit",
      "package.manifest.beats[0].member_claim_refs",
    );
  });
});
