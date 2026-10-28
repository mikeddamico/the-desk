// Proposed filesystem-backed component witnesses. No database, provider or durable admission.
import { describe, expect, it } from "vitest";
import { canonicalJson, sha256 } from "../../src/identity/canonical-json.js";
import {
  connectedFixture151ArtifactHash as connectedFixture105ArtifactHash,
  connectedFixture105ArtifactHash as predecessorArtifactHash,
  connectedFixture105OperationId,
  scriptHash,
} from "../../src/identity/artifacts.js";
import {
  ACTIVE_FIXTURE_CORPUS_ID,
  PREDECESSOR_FIXTURE_CORPUS_ID,
  connectedFixture105Data,
  connectedFixture105Id,
  assertConnectedFixture105Context,
  connectedFixture105Row,
  validateConnectedFixture105Rows,
} from "../../src/runtime/connected-fixture105.js";
import {
  admitConnectedFixture105Texture,
  admitTextureAgainst,
  admitTextureStructure,
  scanTextureSurfaces,
  TextureRefusal,
} from "../../src/runtime/speech-texture.js";
import {
  checkIncidentStatus,
  evaluateConnectedFixture105Component,
  connectedFixture105ClaimsResultHash,
  isClosedConnectedFixture105ClaimsResult,
  isClosedFinding,
  isClosedResult,
  GATE_PIN,
  evaluateGateComponent,
  isOwnedGateEvaluation,
  type ComponentInputs,
} from "../../src/runtime/claims-writing-gate.js";
import {
  evaluateConnectedFixture105Performance,
  connectedFixture105PerformanceResultHash,
  isClosedConnectedFixture105PerformanceResult,
} from "../../src/runtime/performance-direction-fixture105.js";
import { evaluatePerformanceGates } from "../../src/runtime/performance-direction.js";
import type { TextureSpecimen } from "../../src/fixture/speech-texture-specimen.js";

import { connectedFixture105Data as predecessorData } from "../../src/runtime/connected-fixture105-data.js";

type Obj = Record<string, unknown>;
const clone = <T>(x: T): T => structuredClone(x);
function requiredAt<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) throw new Error("missing witness entry");
  return value;
}
function appendText(row: Obj, suffix: string): void {
  if (typeof row.spoken_text !== "string")
    throw new Error("missing witness text");
  row.spoken_text += suffix;
}
function specimen(): TextureSpecimen {
  return admitTextureStructure(clone(connectedFixture105Data().carrier));
}
function bindings() {
  const f = connectedFixture105Data();
  return {
    parent: clone(f.parent),
    parent_hash: String(f.parent.script_hash),
    originals: [] as string[],
  };
}
function refused(run: () => unknown, code: string, field?: string): void {
  try {
    run();
    throw new Error("expected refusal");
  } catch (error) {
    expect(error).toBeInstanceOf(TextureRefusal);
    if (!(error instanceof TextureRefusal)) throw error;
    expect(error.code).toBe(code);
    if (field !== undefined) expect(error.detail.field).toBe(field);
  }
}
function component(): ComponentInputs {
  const f = connectedFixture105Data();
  const turns = clone(f.tables.turns ?? []).filter(
    (t) => t.script_version_id === f.child.script_version_id,
  );
  const ids = new Set(turns.map((t) => t.turn_id));
  return {
    C: clone(f.child),
    K: clone(f.parent),
    rows: {
      version: clone(
        f.tables.script_versions?.find(
          (v) => v.script_version_id === f.child.script_version_id,
        ) ?? {},
      ),
      turns,
      claim_uses: clone(f.tables.turn_claim_uses ?? []).filter((u) =>
        ids.has(u.turn_id),
      ),
      evidence_uses: clone(f.tables.turn_evidence_uses ?? []).filter((u) =>
        ids.has(u.turn_id),
      ),
    },
    pkg: clone(f.pkg.manifest as Obj),
    brief: clone(f.brief),
    writer: clone(f.writer),
    context: clone(f.context),
    facts: {
      claims: clone(f.tables.claims ?? []),
      supports: clone(f.tables.claim_supports ?? []),
      events: clone(f.tables.claim_state_events ?? []),
      derivation: clone(f.tables.derivation_runs?.[0]),
      carriers: clone(f.tables.artifacts ?? []),
      rights: clone(f.tables.rights_versions ?? []),
      evidence: clone(f.tables.evidence_units ?? []),
      pronunciations: [],
      renderings: [],
    },
    statics: {
      profiles: clone(f.roster),
      template: clone(f.template),
      modes: { values: [{ id: "normal_post_event" }] },
      block_types: {
        values: (f.template.slots as Obj[]).map((s) => ({ id: s.block_type })),
      },
    },
    originals: [],
    rewrites: f.rewrites,
    parent_artifact_hash: String(f.parent.script_hash),
  };
}
function performance(): Obj {
  const f = connectedFixture105Data();
  const payload = clone(f.direction.payload as Obj);
  payload.direction_hash = f.direction.content_hash;
  const intent = (payload.performance_intents as Obj[])[0];
  if (intent === undefined) throw new Error("missing fixed intent");
  return {
    pins: {
      script_version_id: f.child.script_version_id,
      script_hash: f.child.script_hash,
    },
    payload,
    artifact: { content_hash: f.direction.content_hash },
    version_rows: [
      {
        performance_direction_version_id: f.identities["direction-version"],
        script_version_id: f.child.script_version_id,
      },
    ],
    intent_rows: [{ turn_id: intent.scope_ref, intent }],
    script: {
      recomputed_hash: f.child.script_hash,
      turns: (f.child.turns as Obj[]).map((t) => ({
        ...t,
        text: t.spoken_text,
      })),
      claim_uses: f.child.turn_claim_uses,
      evidence_uses: f.child.turn_evidence_uses,
    },
    sensitivities: [],
    mode: "normal_post_event",
  };
}
// These are projected hash-test values only, never runtime observation receipts.
function rawHash(value: unknown): string {
  return sha256(Buffer.from(canonicalJson(value), "utf8"));
}
function domainHash(domain: string, value: unknown): string {
  return sha256(Buffer.from(`${domain}\n${canonicalJson(value)}`, "utf8"));
}
function constantsOf(schema: Obj): Obj {
  const properties = schema.properties as Obj;
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([, v]) => Object.hasOwn(v as Obj, "const"))
      .map(([k, v]) => [k, (v as Obj).const]),
  );
}
function projectedArtifacts(): {
  observation: Obj;
  operation: Obj;
  audit: Obj;
} {
  const f = connectedFixture105Data();
  const obsSchema = f.schemas[0];
  const opSchema = f.schemas[1];
  const auditSchema = f.schemas[2];
  if (
    obsSchema === undefined ||
    opSchema === undefined ||
    auditSchema === undefined
  )
    throw new Error("fixed schemas missing");
  const claim = f.tables.claims?.[0];
  const artifact = f.tables.artifacts?.[0];
  if (claim === undefined || artifact === undefined)
    throw new Error("fixed rows missing");
  const subject = constantsOf((obsSchema.properties as Obj).subject as Obj);
  const observed = [connectedFixture105Row("claims", claim)];
  const observation = {
    ...constantsOf(obsSchema),
    subject,
    release_sha256: "a".repeat(64),
    observed_rows: observed,
    observed_rows_sha256: rawHash(observed),
    construction_receipt_id: "hash-test-projection-not-observed",
  };
  const claims = evaluateConnectedFixture105Component(component());
  const perf = evaluateConnectedFixture105Performance(performance());
  const base = {
    ...constantsOf(opSchema),
    subject,
    release_sha256: observation.release_sha256,
    construction_observation_sha256: connectedFixture105ArtifactHash(
      "construction",
      observation,
    ),
    actual_claims_writing_result_sha256:
      connectedFixture105ClaimsResultHash(claims),
    actual_performance_result_sha256:
      connectedFixture105PerformanceResultHash(perf),
    owned_rows: [connectedFixture105Row("artifacts", artifact)],
  };
  const operation = {
    ...base,
    operation_id: connectedFixture105OperationId(base),
  };
  const input_projection = constantsOf(
    (auditSchema.properties as Obj).input_projection as Obj,
  );
  const audit = {
    ...constantsOf(auditSchema),
    input_projection,
    input_fingerprint: domainHash("audit-input-v1", input_projection),
    operation_sha256: connectedFixture105ArtifactHash("operation", operation),
    model_run_id: null,
  };
  return { observation, operation, audit };
}
describe("connected fixture105 components", () => {
  it("admits the nonempty fixed rewrite without claiming semantic quality", () => {
    expect(admitConnectedFixture105Texture(specimen(), bindings())).toEqual(
      specimen(),
    );
  });
  it("refuses an unknown grammar field before subject faults", () => {
    refused(
      () =>
        admitConnectedFixture105Texture(
          { ...specimen(), extra: true, brief_hash: "wrong" },
          bindings(),
        ),
      "texture_field_unsupported",
    );
  });
  it("refuses non-NFC before subject binding", () => {
    const s = { ...clone(specimen()) } as Obj;
    requiredAt(s.turns as Obj[], 1).spoken_text = "Cafe\u0301.";
    refused(
      () => admitConnectedFixture105Texture(s, bindings()),
      "texture_text_not_nfc",
    );
  });
  it("refuses a substituted subject", () => {
    refused(
      () =>
        admitConnectedFixture105Texture(
          { ...specimen(), brief_hash: "wrong" },
          bindings(),
        ),
      "texture_subject_mismatch",
      "brief_hash",
    );
  });
  it("refuses missing protected turn structure", () => {
    const s = clone(specimen());
    refused(
      () =>
        admitConnectedFixture105Texture(
          { ...s, turns: s.turns.slice(0, -1) },
          bindings(),
        ),
      "texture_protected_content_changed",
      "turn_structure",
    );
  });
  it("refuses an additional changed anchor", () => {
    const s = { ...clone(specimen()) } as Obj;
    appendText(requiredAt(s.turns as Obj[], 0), " Extra.");
    refused(
      () => admitConnectedFixture105Texture(s, bindings()),
      "texture_scope_exceeded",
      "turn_scope",
    );
  });
  it("refuses a changed ordered claim relation", () => {
    const s = { ...clone(specimen()) } as Obj;
    requiredAt(s.turn_claim_uses as Obj[], 0).use_mode = "hedged";
    refused(
      () => admitConnectedFixture105Texture(s, bindings()),
      "texture_protected_content_changed",
      "claim_use",
    );
  });
  it("refuses a duplicate evidence relation", () => {
    const s = { ...clone(specimen()) } as Obj;
    const uses = s.turn_evidence_uses as Obj[];
    uses.push(clone(requiredAt(uses, 0)));
    refused(
      () => admitConnectedFixture105Texture(s, bindings()),
      "texture_protected_content_changed",
      "evidence_use",
    );
  });
  it("refuses a code-point span outside the child", () => {
    const s = { ...clone(specimen()) } as Obj;
    requiredAt(s.turn_claim_uses as Obj[], 0).span_end = 10000;
    refused(
      () => admitConnectedFixture105Texture(s, bindings()),
      "texture_span_out_of_range",
    );
  });
  it("refuses changed protected span text after valid range", () => {
    const s = { ...clone(specimen()) } as Obj;
    requiredAt(s.turn_claim_uses as Obj[], 0).span_start = 1;
    refused(
      () => admitConnectedFixture105Texture(s, bindings()),
      "texture_protected_content_changed",
      "use_span_text",
    );
  });
  it("refuses numeric change on the otherwise unannotated rewrite turn", () => {
    const s = { ...clone(specimen()) } as Obj;
    appendText(requiredAt(s.turns as Obj[], 1), " 2");
    refused(
      () => admitConnectedFixture105Texture(s, bindings()),
      "texture_protected_content_changed",
      "numeric_token",
    );
  });
  it("refuses a changed prediction after protected-text checks", () => {
    const s = { ...clone(specimen()) } as Obj;
    requiredAt(s.prediction_candidates as Obj[], 0).horizon = "another horizon";
    refused(
      () => admitConnectedFixture105Texture(s, bindings()),
      "texture_protected_content_changed",
      "prediction",
    );
  });
  it("exercises the existing full-leaf guard with a newly authored surface", () => {
    const text = "Synthetic copper umbrellas cross the silent orchard.";
    expect(scanTextureSurfaces({ specimen: { nested: [text] } }, [text])).toBe(
      "specimen",
    );
    expect(
      scanTextureSurfaces({ specimen: { nested: [text] } }, []),
    ).toBeNull();
  });
  it("refuses an unlisted rewrite after token predicates", () => {
    const s = { ...clone(specimen()) } as Obj;
    requiredAt(s.turns as Obj[], 1).spoken_text =
      "I'd pick the ordinary handle.";
    refused(
      () => admitConnectedFixture105Texture(s, bindings()),
      "texture_protected_content_changed",
      "rewrite_row",
    );
  });
  it("refuses a missing old fragment in the supplied parent", () => {
    const b = bindings();
    requiredAt(b.parent.turns as Obj[], 1).spoken_text =
      "I would pick the ordinary handle.";
    b.parent_hash = scriptHash(b.parent, {
      brief: connectedFixture105Data().brief,
    });
    b.parent.script_hash = b.parent_hash;
    const child = { ...clone(specimen()), parent_script_hash: b.parent_hash };
    refused(
      () => admitConnectedFixture105Texture(child, b),
      "texture_protected_content_changed",
      "rewrite_row",
    );
  });
  it("refuses a duplicated old fragment in the supplied parent", () => {
    const b = bindings();
    const t = requiredAt(b.parent.turns as Obj[], 1);
    t.spoken_text = `${String(t.spoken_text)} ${String(t.spoken_text)}`;
    b.parent_hash = scriptHash(b.parent, {
      brief: connectedFixture105Data().brief,
    });
    b.parent.script_hash = b.parent_hash;
    const child = { ...clone(specimen()), parent_script_hash: b.parent_hash };
    refused(
      () => admitConnectedFixture105Texture(child, b),
      "texture_protected_content_changed",
      "rewrite_row",
    );
  });
  it("does not retarget the historical Texture entrypoint", () => {
    refused(
      () => {
        admitTextureAgainst(specimen(), bindings());
      },
      "texture_scope_exceeded",
      "turn_scope",
    );
  });
  it("computes eighteen rows with retained incomplete semantic coverage", () => {
    expect(ACTIVE_FIXTURE_CORPUS_ID).toBe("connected-fixture151");
    expect(PREDECESSOR_FIXTURE_CORPUS_ID).toBe("connected-fixture105");
    const old = predecessorData();
    expect(old.pkg.id).toBe("cca1c334-d3aa-509d-bbfb-f43f7bb8d645");
    expect(old.pkg.package_hash).toBe(
      "c60a91ac6383a791011f533d4b4d2dfd428b3dbe9e15b5113f4cd60ea03c539e",
    );
    expect(connectedFixture105Data().pkg.id).not.toBe(old.pkg.id);
    const predecessor = { ...component(), pkg: clone(old.pkg.manifest as Obj) };
    expect(checkIncidentStatus(predecessor).findings).toContainEqual({
      class: "proof_gap",
      code: "incident_witness_missing",
    });
    for (const missing of ["availability", "sensitivity"] as const) {
      const changed = component();
      if (missing === "availability")
        delete (changed.pkg.availability as Obj).serious_incident;
      else changed.pkg.sensitivities = [];
      expect(checkIncidentStatus(changed).findings).toContainEqual({
        class: "proof_gap",
        code: "incident_witness_missing",
      });
    }
    const incident = component();
    const claims = incident.pkg.claims as Obj[];
    requiredAt(claims, 0).kind = "incident";
    expect(
      checkIncidentStatus(incident).findings.some(
        (f) => f.code === "incident_claim_used",
      ),
    ).toBe(true);
    const result = evaluateConnectedFixture105Component(component());
    expect(result.rows).toHaveLength(18);
    expect(result.rows.flatMap((r) => r.findings)).toEqual([]);
    expect(result.aggregate).toBe("incomplete");
    expect(result.preconditions.ok).toBe(true);
    expect(result.coverage.find((c) => c.id === "C13")?.limits).toEqual([
      "historical_visibility_unprovable",
    ]);
    expect(
      result.coverage
        .filter((c) => c.status === "not_established_required")
        .map((c) => c.id),
    ).toEqual(["H04", "H13"]);
    expect(isOwnedGateEvaluation(result)).toBe(false);
  });
  it("retains historical component factual gaps for the same unowned input", () => {
    const result = evaluateGateComponent(component());
    expect(
      result.rows
        .flatMap((r) => r.findings)
        .some((f) => f.code === "required_proof_not_established"),
    ).toBe(true);
    expect(
      result.rows.find((row) => row.key === "writing.context_complete")
        ?.findings,
    ).toContainEqual({ class: "violation", code: "context_hash_mismatch" });
    for (const variant of ["writer-and-hash", "hash-only"] as const) {
      const changed = component();
      if (variant === "writer-and-hash") {
        changed.writer.locale = "en-US";
        changed.context.serialized_input_hash = sha256(
          Buffer.from(canonicalJson(changed.writer), "utf8"),
        );
      } else changed.context.serialized_input_hash = "0".repeat(64);
      expect(
        evaluateConnectedFixture105Component(changed).rows.find(
          (row) => row.key === "writing.context_complete",
        )?.findings,
      ).toContainEqual({ class: "violation", code: "context_hash_mismatch" });
    }
  });
  it("refuses changed derivation body rather than accepting expected count", () => {
    const c = component();
    const e = c.facts.evidence.find((x) =>
      String(x.evidence_unit_id).endsWith("13"),
    );
    if (e === undefined) throw new Error("missing control body");
    e.canonical_content = "{}";
    expect(
      evaluateConnectedFixture105Component(c).rows.find(
        (r) => r.key === "claims.desk_derivation",
      )?.findings.length,
    ).toBeGreaterThan(0);
  });
  it("detects a disclosed scalar leak with the typed silent constraint", () => {
    const c = component();
    appendText(requiredAt(c.C.turns as Obj[], 0), " Calibration 17.");
    expect(
      evaluateConnectedFixture105Component(c)
        .rows.find((r) => r.key === "claims.silent_non_leak")
        ?.findings.some((f) => f.code === "silent_value_reproduced"),
    ).toBe(true);
  });
  it("runs seven Performance predicates with the nonempty fixture rule", () => {
    const result = evaluateConnectedFixture105Performance(performance());
    expect(result.rows).toHaveLength(7);
    expect(result.rows.every((r) => r.outcome === "pass")).toBe(true);
    expect(result.aggregate).toBe("complete_defined_set");
    const legacy = evaluatePerformanceGates(performance());
    for (const index of [0, 1, 3, 4, 5, 6]) {
      expect(result.rows[index]?.result.facts).toEqual(
        legacy.rows[index]?.result.facts,
      );
      expect(result.rows[index]?.result.findings).toEqual(
        legacy.rows[index]?.result.findings,
      );
    }
  });
  it("retains the old gate21 rule-set gap", () => {
    for (const families of [[undefined], [null], ["pace", null]]) {
      const input = performance();
      const payload = input.payload as Obj;
      const template = requiredAt(payload.performance_intents as Obj[], 0);
      payload.performance_intents = families.map((intent_type) => {
        const copy = { ...template };
        if (intent_type === undefined) delete copy.intent_type;
        else copy.intent_type = intent_type;
        return copy;
      });
      const row = requiredAt(
        evaluateConnectedFixture105Performance(input).rows,
        2,
      );
      expect((row.result.facts as Obj).families_present).toBe(
        new Set(families).size,
      );
      if (families.length === 2)
        expect(
          (row.result.findings as Obj[]).filter(
            (f) => f.code === "denominator_mismatch",
          ),
        ).toHaveLength(2);
    }

    // Full ordered failed-result projection: preserve the pre-split owner's
    // mode finding, both denominator findings and increasing tuple indexes.
    const failed = performance();
    failed.mode = "new_unregistered_fixture_mode";
    const payload = failed.payload as Obj;
    const first = requiredAt(payload.performance_intents as Obj[], 0);
    payload.performance_intents = [
      { ...first, value: "faster" },
      { ...first, strength: "strong" },
    ];
    failed.intent_rows = [];
    const ordinary = evaluatePerformanceGates(failed);
    const actual = evaluateConnectedFixture105Performance(failed);
    const fixed = connectedFixture105Data();
    const expectedRows = ordinary.rows.map((row, index) => ({
      ...row,
      gate_definition_id: connectedFixture105Id(
        `definition:${String(19 + index)}`,
      ),
      outcome: index === 2 ? "fail" : row.outcome,
      result: {
        ...row.result,
        actor_id: (fixed.identities.ids as Obj).actor,
        schema: "connected-fixture105-performance-result/1",
        subject_refs: [fixed.identities["direction-version"]],
        ...(index === 2
          ? {
              facts: {
                examined: 2,
                expected_examined: 1,
                families_present: 1,
                rule_entries: 1,
              },
              findings: [
                { class: "violation", code: "mode_unregistered" },
                { class: "violation", code: "denominator_mismatch" },
                { class: "violation", code: "denominator_mismatch" },
                {
                  class: "violation",
                  code: "fixture_mode_intent_forbidden",
                  intent_index: 0,
                },
                {
                  class: "violation",
                  code: "fixture_mode_intent_forbidden",
                  intent_index: 1,
                },
              ],
            }
          : {}),
      },
    }));
    const expected = {
      rows: expectedRows,
      aggregate: "failed",
      coverage: ordinary.coverage.map((row) =>
        row.id === "M01" ? { id: "M01", status: "established" } : row,
      ),
    };
    expect(actual.aggregate).toBe("failed");
    expect(canonicalJson(actual)).toBe(canonicalJson(expected));
    expect(connectedFixture105PerformanceResultHash(actual)).toBe(
      sha256(Buffer.from(canonicalJson(expected), "utf8")),
    );
    expect(
      evaluatePerformanceGates(performance()).rows[2]?.result.findings,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "mode_rule_set_absent" }),
      ]),
    );
  });
  it("refuses a forbidden mode-family tuple", () => {
    const p = performance();
    const payload = p.payload as Obj;
    requiredAt(payload.performance_intents as Obj[], 0).value = "faster";
    expect(
      evaluateConnectedFixture105Performance(p).rows[2]?.result.findings,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "fixture_mode_intent_forbidden" }),
      ]),
    );
  });
  it("refuses an empty intent escape", () => {
    const p = performance();
    (p.payload as Obj).performance_intents = [];
    p.intent_rows = [];
    expect(evaluateConnectedFixture105Performance(p).rows[2]?.outcome).toBe(
      "fail",
    );
  });
  it("requires the explicit fixed test and no-provider context", () => {
    expect(() => {
      assertConnectedFixture105Context({
        DESK_ENV: "test",
        PROVIDERS_ENABLED: "false",
      });
    }).not.toThrow();
    for (const DESK_ENV of [
      undefined,
      "development",
      "staging",
      "production",
      "unknown",
    ])
      expect(() => {
        assertConnectedFixture105Context({
          ...(DESK_ENV === undefined ? {} : { DESK_ENV }),
          PROVIDERS_ENABLED: "false",
        });
      }).toThrow("fixture_runtime_context");
  });
  it("uses finite distinct new definition identities", () => {
    expect(
      new Set(
        Array.from({ length: 25 }, (_, i) =>
          connectedFixture105Id(`definition:${String(i + 1)}`),
        ),
      ).size,
    ).toBe(25);
    expect(() => connectedFixture105Id("definition:26")).toThrow(
      "fixture_definition_identity",
    );
  });
  it("preserves full SQL values and raw canonical-row identity", () => {
    const row = connectedFixture105Data().tables.claims?.[0];
    if (row === undefined) throw new Error("missing claim");
    const envelope = connectedFixture105Row("claims", row);
    expect(JSON.parse(envelope.canonical_row)).toEqual(row);
    expect(
      validateConnectedFixture105Rows("observation", [envelope], [envelope]),
    ).toMatch(/^[0-9a-f]{64}$/u);
  });
  it("refuses payload-only fields in a SQL projection", () => {
    const row = connectedFixture105Data().tables.turn_claim_uses?.[0];
    if (row === undefined) throw new Error("missing use");
    expect(() =>
      connectedFixture105Row("turn_claim_uses", {
        ...row,
        claim_state_hash: "0".repeat(64),
      }),
    ).toThrow("fixture_sql_columns");
  });
  it("requires explicit null columns rather than omission", () => {
    const row = clone(connectedFixture105Data().tables.claims?.[0]);
    if (row === undefined) throw new Error("missing claim");
    delete row.supersedes_claim_id;
    expect(() => connectedFixture105Row("claims", row)).toThrow(
      "fixture_sql_columns",
    );
  });
  it("rejects a mismatched envelope primary key", () => {
    const row = connectedFixture105Data().tables.claims?.[0];
    if (row === undefined) throw new Error("missing claim");
    const expected = connectedFixture105Row("claims", row);
    expect(() =>
      validateConnectedFixture105Rows(
        "observation",
        [{ ...expected, primary_key: "00000000-0000-4000-8000-000000000001" }],
        [expected],
      ),
    ).toThrow("fixture_row_identity");
  });
  it("rejects canonical-row whitespace even with unchanged semantic JSON", () => {
    const row = connectedFixture105Data().tables.claims?.[0];
    if (row === undefined) throw new Error("missing claim");
    const expected = connectedFixture105Row("claims", row);
    expect(() =>
      validateConnectedFixture105Rows(
        "observation",
        [{ ...expected, canonical_row: `${expected.canonical_row} ` }],
        [expected],
      ),
    ).toThrow("fixture_row_identity");
  });
  it("rejects duplicate or reversed row populations", () => {
    const rows = (connectedFixture105Data().tables.claims ?? [])
      .map((r) => connectedFixture105Row("claims", r))
      .sort((a, b) => a.primary_key.localeCompare(b.primary_key));
    expect(() =>
      validateConnectedFixture105Rows("observation", [...rows].reverse(), rows),
    ).toThrow("fixture_row_order");
    expect(() =>
      validateConnectedFixture105Rows(
        "observation",
        [requiredAt(rows, 0), requiredAt(rows, 0)],
        [requiredAt(rows, 0), requiredAt(rows, 1)],
      ),
    ).toThrow("fixture_row_order");
  });
  it("preserves timestamp microseconds without Date coercion", () => {
    const row = connectedFixture105Data().tables.claims?.[0];
    if (row === undefined) throw new Error("missing claim");
    const exact = connectedFixture105Row("claims", {
      ...row,
      created_at: "2024-06-26T18:00:00.123456Z",
    });
    expect((JSON.parse(exact.canonical_row) as Obj).created_at).toBe(
      "2024-06-26T18:00:00.123456Z",
    );
    expect(() =>
      connectedFixture105Row("claims", {
        ...row,
        created_at: new Date("2024-06-26T18:00:00Z"),
      }),
    ).toThrow("fixture_sql_timestamp");
  });

  it("hashes the complete actual Claims result without upgrading incomplete coverage", () => {
    const result = evaluateConnectedFixture105Component(component());
    expect(result.aggregate).toBe("incomplete");
    expect(connectedFixture105ClaimsResultHash(result)).toMatch(
      /^[0-9a-f]{64}$/u,
    );
    expect(() => connectedFixture105ClaimsResultHash(clone(result))).toThrow(
      "fixture_claims_result_provenance",
    );
  });
  it("refuses a legacy Claims component as the new result identity", () => {
    expect(() =>
      connectedFixture105ClaimsResultHash(evaluateGateComponent(component())),
    ).toThrow("fixture_claims_result_provenance");
  });
  it("retains failure findings in the actual Performance digest", () => {
    const good = evaluateConnectedFixture105Performance(performance());
    const changed = performance();
    requiredAt((changed.payload as Obj).performance_intents as Obj[], 0).value =
      "faster";
    const bad = evaluateConnectedFixture105Performance(changed);
    expect(bad.aggregate).toBe("failed");
    expect(connectedFixture105PerformanceResultHash(bad)).not.toBe(
      connectedFixture105PerformanceResultHash(good),
    );
  });
  it("refuses cloned or legacy Performance results as new result provenance", () => {
    const result = evaluateConnectedFixture105Performance(performance());
    expect(() =>
      connectedFixture105PerformanceResultHash(clone(result)),
    ).toThrow("fixture_performance_result_provenance");
    expect(() =>
      connectedFixture105PerformanceResultHash(
        evaluatePerformanceGates(performance()),
      ),
    ).toThrow("fixture_performance_result_provenance");
  });
  it("keeps new Performance result identity separate from a historical result", () => {
    const result =
      evaluateConnectedFixture105Performance(performance()).rows[0]?.result;
    expect(isClosedConnectedFixture105PerformanceResult(result)).toBe(true);
    expect(
      isClosedConnectedFixture105PerformanceResult({
        ...result,
        schema: "performance-direction-gate-result/1",
      }),
    ).toBe(false);
    expect(
      isClosedConnectedFixture105PerformanceResult({
        ...result,
        subject_refs: [],
      }),
    ).toBe(false);
  });
  it("admits the new mode violation code only on its exact gate and location shape", () => {
    const p = performance();
    requiredAt((p.payload as Obj).performance_intents as Obj[], 0).value =
      "faster";
    const row = evaluateConnectedFixture105Performance(p).rows[2]?.result;
    expect(isClosedConnectedFixture105PerformanceResult(row)).toBe(true);
    expect(
      isClosedConnectedFixture105PerformanceResult({
        ...row,
        check: "performance.script_binding",
      }),
    ).toBe(false);
    const invalid = [
      { class: "violation", code: "fixture_mode_intent_forbidden" },
      ...[-1, 0.5, "0"].map((intent_index) => ({
        class: "violation",
        code: "fixture_mode_intent_forbidden",
        intent_index,
      })),
      ...["mode_unregistered", "denominator_mismatch"].map((code) => ({
        class: "violation",
        code,
        intent_index: 0,
      })),
    ];
    for (const finding of invalid)
      expect(
        isClosedConnectedFixture105PerformanceResult({
          ...row,
          findings: [finding],
        }),
      ).toBe(false);
    expect(
      isClosedConnectedFixture105PerformanceResult({
        ...row,
        findings: [
          {
            class: "violation",
            code: "fixture_mode_intent_forbidden",
            intent_index: 0,
            raw_text: "not admitted",
          },
        ],
      }),
    ).toBe(false);
  });
  it("refuses a Claims result with missing subject or legacy identity", () => {
    expect(isClosedConnectedFixture105ClaimsResult({})).toBe(false);
    expect(
      isClosedConnectedFixture105ClaimsResult({
        schema: "claims-writing-gate-result/1",
      }),
    ).toBe(false);
    const input = component();
    const failed = evaluateConnectedFixture105Component({
      ...input,
      statics: { ...input.statics, profiles: {} },
    });
    expect(connectedFixture105ClaimsResultHash(failed)).toMatch(
      /^[0-9a-f]{64}$/u,
    );
    const fixed = connectedFixture105Data();
    const results = failed.rows.map((row) => ({
      actor_id: (fixed.identities.ids as Obj).actor,
      actor_kind: "policy",
      check: row.key,
      facts: row.facts,
      findings: row.findings,
      fingerprint_stage: "claims_writing",
      schema: "connected-fixture105-claims-result/1",
      subject_refs: [fixed.identities["texture-version"]],
    }));
    expect(results.every(isClosedConnectedFixture105ClaimsResult)).toBe(true);
    const result = results.find((row) =>
      row.findings.some((finding) => Object.hasOwn(finding, "anchor")),
    );
    if (result === undefined) throw new Error("failed anchor witness missing");
    const finding = result.findings.find((item) =>
      Object.hasOwn(item, "anchor"),
    );
    if (finding === undefined) throw new Error("failed finding missing");
    const exact = { ...result, findings: [finding] };
    const anchor = finding.anchor;
    expect(anchor).toBe("estuary109_t01");
    expect(isClosedFinding(finding, result.check)).toBe(false);
    expect(isClosedFinding({ ...finding, anchor: "t01" }, result.check)).toBe(
      true,
    );
    const legacy = {
      ...exact,
      actor_id: GATE_PIN.actor_id,
      schema: GATE_PIN.result_schema,
      subject_refs: [GATE_PIN.child_script_version_id],
      findings: [{ ...finding, anchor: "t01" }],
    };
    expect(isClosedResult(legacy)).toBe(true);
    expect(isClosedResult({ ...legacy, findings: [finding] })).toBe(false);
    for (const badAnchor of ["t01", "foreign_t01", "estuary109_t99", 1, null])
      expect(
        isClosedConnectedFixture105ClaimsResult({
          ...exact,
          findings: [{ ...finding, anchor: badAnchor }],
        }),
      ).toBe(false);
    for (const badFinding of [
      { ...finding, class: "proof_gap" },
      { ...finding, code: "unknown_finding" },
      { ...finding, raw_text: "not admitted" },
      { ...finding, span: [0, "1"] },
      { ...finding, use_index: "0" },
    ])
      expect(
        isClosedConnectedFixture105ClaimsResult({
          ...exact,
          findings: [badFinding],
        }),
      ).toBe(false);
    for (const changed of [
      { ...exact, check: "unknown.check" },
      { ...exact, facts: { ...exact.facts, extra: 0 } },
      { ...exact, facts: { ...exact.facts, examined: "0" } },
      { ...exact, actor_id: GATE_PIN.actor_id },
      { ...exact, schema: GATE_PIN.result_schema },
      { ...exact, subject_refs: [] },
    ])
      expect(isClosedConnectedFixture105ClaimsResult(changed)).toBe(false);
    expect(() => connectedFixture105ClaimsResultHash(clone(failed))).toThrow(
      "fixture_claims_result_provenance",
    );
    const foreign = component();
    requiredAt(foreign.C.turns as Obj[], 0).semantic_turn_id = "foreign_t01";
    requiredAt(foreign.rows.turns, 0).semantic_turn_id = "foreign_t01";
    const offProfile = evaluateConnectedFixture105Component({
      ...foreign,
      statics: { ...foreign.statics, profiles: {} },
    });
    expect(() => connectedFixture105ClaimsResultHash(offProfile)).toThrow(
      "fixture_claims_result_shape",
    );
  });

  it("checks construction outer domain and raw row-array subdigest directly", () => {
    const { observation } = projectedArtifacts();
    const predecessorSchema = requiredAt(predecessorData().schemas, 0);
    const predecessor = {
      ...observation,
      subject: constantsOf(
        (predecessorSchema.properties as Obj).subject as Obj,
      ),
    };
    expect(predecessorArtifactHash("construction", predecessor)).toBe(
      domainHash("fixture105-construction-observation-v1", predecessor),
    );
    expect(() =>
      predecessorArtifactHash("construction", observation),
    ).toThrow();
    expect(() =>
      connectedFixture105ArtifactHash("construction", predecessor),
    ).toThrow();
    expect(connectedFixture105ArtifactHash("construction", observation)).toBe(
      domainHash("fixture105-construction-observation-v1", observation),
    );
    expect(observation.observed_rows_sha256).toBe(
      rawHash(observation.observed_rows),
    );
    expect(() =>
      connectedFixture105ArtifactHash("construction", {
        ...observation,
        observed_rows_sha256: "0".repeat(64),
      }),
    ).toThrow();
  });
  it("checks separate operation identity and complete envelope equations directly", () => {
    const { operation } = projectedArtifacts();
    const projection = Object.fromEntries(
      [
        "subject",
        "release_sha256",
        "construction_observation_sha256",
        "actual_claims_writing_result_sha256",
        "performance_direction_hash",
      ].map((key) => [key, operation[key]]),
    );
    expect(connectedFixture105OperationId(operation)).toBe(
      domainHash("fixture105-operation-identity-v1", projection),
    );
    expect(connectedFixture105ArtifactHash("operation", operation)).toBe(
      domainHash("fixture105-operation-v1", operation),
    );
    expect(connectedFixture105ArtifactHash("operation", operation)).not.toBe(
      operation.operation_id,
    );
    expect(() =>
      connectedFixture105ArtifactHash("operation", {
        ...operation,
        operation_id: "0".repeat(64),
      }),
    ).toThrow();
  });
  it("checks audit eight-key fingerprint and full audit envelope directly", () => {
    const { audit } = projectedArtifacts();
    expect(Object.keys(audit.input_projection as Obj)).toHaveLength(8);
    expect(connectedFixture105ArtifactHash("audit", audit)).toBe(
      domainHash("connected-fixture105-audit-stub-v1", audit),
    );
    expect(audit.input_fingerprint).toBe(
      domainHash("audit-input-v1", audit.input_projection),
    );
    expect(() =>
      connectedFixture105ArtifactHash("audit", {
        ...audit,
        input_fingerprint: "0".repeat(64),
      }),
    ).toThrow();
  });
  it("rejects fourth-profile fields and mismatched linked row digest bytes", () => {
    const { observation, operation, audit } = projectedArtifacts();
    expect(() =>
      connectedFixture105ArtifactHash("construction", {
        ...observation,
        extra: true,
      }),
    ).toThrow();
    expect(() =>
      connectedFixture105ArtifactHash("operation", {
        ...operation,
        schema: "other/1",
      }),
    ).toThrow();
    expect(() =>
      connectedFixture105ArtifactHash("audit", {
        ...audit,
        model_run_id: "00000000-0000-4000-8000-000000000001",
      }),
    ).toThrow();
    const rows = clone(observation.observed_rows as Obj[]);
    requiredAt(rows, 0).row_sha256 = "0".repeat(64);
    expect(() =>
      connectedFixture105ArtifactHash("construction", {
        ...observation,
        observed_rows: rows,
        observed_rows_sha256: rawHash(rows),
      }),
    ).toThrow();
  });
  it("rejects genuine semantic promotion of a fixture operation at the existing schema boundary", () => {
    const { operation } = projectedArtifacts();
    expect(() =>
      connectedFixture105ArtifactHash("operation", {
        ...operation,
        genuine_semantic_admission: true,
      }),
    ).toThrow();
  });
  it("rejects render promotion of a fixture audit at the existing schema boundary", () => {
    const { audit } = projectedArtifacts();
    expect(() =>
      connectedFixture105ArtifactHash("audit", {
        ...audit,
        render_allowed: true,
      }),
    ).toThrow();
  });
  it("rejects an added READY transition field in the closed fixture operation", () => {
    const { operation } = projectedArtifacts();
    expect(() =>
      connectedFixture105ArtifactHash("operation", {
        ...operation,
        attempt_state: "READY",
      }),
    ).toThrow();
  });
  it("retains full actual Claims and Performance projections in raw digests", () => {
    const c = evaluateConnectedFixture105Component(component());
    const p = evaluateConnectedFixture105Performance(performance());
    expect(connectedFixture105ClaimsResultHash(c)).toBe(
      rawHash({
        rows: c.rows,
        aggregate: c.aggregate,
        warnings: c.warnings,
        coverage: c.coverage,
        preconditions: c.preconditions,
      }),
    );
    expect(connectedFixture105PerformanceResultHash(p)).toBe(
      rawHash({ rows: p.rows, aggregate: p.aggregate, coverage: p.coverage }),
    );
    expect(connectedFixture105ClaimsResultHash(c)).not.toBe(
      domainHash("fixture105-operation-v1", c),
    );
  });
  it("reaches the fixed sibling full-leaf step11 guard before final equality", () => {
    const child = specimen();
    const text = child.turns[1]?.spoken_text;
    if (text === undefined) throw new Error("missing new fiction");
    expect(Array.from(text).length).toBeGreaterThanOrEqual(24);
    refused(
      () =>
        admitConnectedFixture105Texture(child, {
          ...bindings(),
          originals: [text],
        }),
      "texture_withheld_text_relocated",
    );
  });
  it("reports quoted-text before an additional hedge defect", () => {
    const child = { ...clone(specimen()) } as Obj;
    requiredAt(child.turns as Obj[], 1).spoken_text =
      "I'd choose the 'ordinary' handle, reportedly.";
    refused(
      () => admitConnectedFixture105Texture(child, bindings()),
      "texture_protected_content_changed",
      "quoted_text",
    );
  });
  it("reaches hedge cue without a prior numeric or quote change", () => {
    const child = { ...clone(specimen()) } as Obj;
    requiredAt(child.turns as Obj[], 1).spoken_text =
      "I'd choose the ordinary handle, reportedly.";
    refused(
      () => admitConnectedFixture105Texture(child, bindings()),
      "texture_protected_content_changed",
      "hedge_cue",
    );
  });
  it("reaches negation balance without an earlier protected-token defect", () => {
    const child = { ...clone(specimen()) } as Obj;
    requiredAt(child.turns as Obj[], 1).spoken_text =
      "I'd never choose the ordinary handle.";
    refused(
      () => admitConnectedFixture105Texture(child, bindings()),
      "texture_protected_content_changed",
      "negation_balance",
    );
  });
  it("reaches punctuation class with numeric quote hedge and negation unchanged", () => {
    const child = { ...clone(specimen()) } as Obj;
    requiredAt(child.turns as Obj[], 1).spoken_text =
      "I'd choose the ordinary handle. ☂";
    refused(
      () => admitConnectedFixture105Texture(child, bindings()),
      "texture_protected_content_changed",
      "punctuation_class",
    );
  });
  it("prioritizes NFC over changed subject and protected structure", () => {
    const child = { ...clone(specimen()) } as Obj;
    child.brief_hash = "wrong";
    requiredAt(child.turns as Obj[], 1).spoken_text = "Cafe\u0301";
    refused(
      () => admitConnectedFixture105Texture(child, bindings()),
      "texture_text_not_nfc",
    );
  });
  it("rejects caller rewrite-table and profile substitution at closed grammar", () => {
    refused(
      () =>
        admitConnectedFixture105Texture(
          { ...specimen(), rewrite_table: [] },
          bindings(),
        ),
      "texture_field_unsupported",
    );
    refused(
      () =>
        admitConnectedFixture105Texture(
          { ...specimen(), schema: "caller-profile/1" },
          bindings(),
        ),
      "texture_specimen_invalid",
      "schema",
    );
  });
  it("refuses changed roster instead of retaining the new factual extension", () => {
    const c = component();
    const changed = { ...c, statics: { ...c.statics, profiles: {} } };
    expect(
      evaluateConnectedFixture105Component(changed).coverage.find(
        (row) => row.id === "H01",
      )?.status,
    ).not.toBe("established");
  });
  it("refuses a rights ceiling substitution at the actual precondition", () => {
    const c = component();
    const row = c.facts.rights[0];
    if (row === undefined) throw new Error("rights missing");
    row.policy = {};
    expect(evaluateConnectedFixture105Component(c).preconditions.ok).toBe(
      false,
    );
  });
});
