import { describe, expect, it } from "vitest";

import { openFixturePack } from "../src/fixture/pack.js";
import { deepFreeze, type Tables } from "../src/fixture/rows.js";
import { VerifiedFixture } from "../src/fixture/snapshot.js";
import { FixtureVerificationError, verifyRows } from "../src/fixture/verify.js";
import { consistentPack, editRows } from "./support/fixture-pack.js";
import { must } from "./support/claim-events.js";

// End-to-end regressions that use ONLY the pre-A4 public pipeline (VerifiedFixture + verifyRows). Each persisted-row mutation edits
// an unhashed row column so the earlier A2/A3 checks still pass and the defect reaches the new row-derived semantic check. On the
// accepted main (before A4) every one of these mutations is ACCEPTED; after A4 each is rejected with its exact code.
const real = VerifiedFixture.fromPack(openFixturePack());
type T = Record<string, Record<string, unknown>[]>;
const run = (edit: (t: T) => void): string => {
  const t = JSON.parse(JSON.stringify(real.rows.tables)) as T;
  edit(t);
  try {
    verifyRows(
      deepFreeze(t as unknown as Tables),
      real.context,
      real.historical,
    );
  } catch (error) {
    if (error instanceof FixtureVerificationError) return error.code;
    throw error;
  }
  return "accepted";
};
const row = (t: T, table: string, i = 0): Record<string, unknown> =>
  must(t[table]?.[i], `${table}[${String(i)}]`);
const find = (
  t: T,
  table: string,
  p: (r: Record<string, unknown>) => boolean,
): Record<string, unknown> => must(t[table]?.find(p), table);
const payload = (r: Record<string, unknown>): Record<string, unknown> =>
  r.canonical_payload as Record<string, unknown>;

const cases: [string, (t: T) => void, string][] = [
  [
    "ledger: terminal event cost 0 instead of 0.0000",
    (t) => {
      row(t, "provider_call_events").actual_cost = "0";
    },
    "ledger_event_cost",
  ],
  [
    "ledger: second try number",
    (t) => {
      row(t, "provider_calls").operational_try_number = 2;
    },
    "ledger_not_try_one",
  ],
  [
    "ledger: TTS model identity",
    (t) => {
      find(t, "provider_calls", (c) => c.operation === "tts").model_identifier =
        "other";
    },
    "ledger_tts_model_identity",
  ],
  [
    "ledger: generated seconds not the exact decimal of the frames",
    (t) => {
      const c = find(t, "provider_calls", (x) => x.operation === "tts");
      (
        find(
          t,
          "provider_call_events",
          (e) => e.provider_call_id === c.provider_call_id,
        ).usage as Record<string, unknown>
      ).generated_seconds = "0.5";
    },
    "ledger_generated_seconds",
  ],
  [
    "ledger: reroll trigger failure code",
    (t) => {
      row(t, "reroll_triggers").failure_code = "x";
    },
    "reroll_causal_chain",
  ],
  [
    "ledger: approval does not supersede the rejection",
    (t) => {
      find(
        t,
        "take_selections",
        (s) => s.supersedes_selection_id !== null,
      ).supersedes_selection_id = null;
    },
    "reroll_selection_chain",
  ],
  [
    "ledger: reservation after its terminal event",
    (t) => {
      find(t, "provider_calls", (c) => c.operation === "tts").started_at =
        "2030-01-01T00:00:00Z";
    },
    "ledger_event_before_reservation",
  ],
  [
    "assembly: rounded milliseconds not the exact half-up of frames",
    (t) => {
      row(t, "audio_artifacts").duration_ms = 999;
    },
    "audio_duration_ms",
  ],
  [
    "assembly: recipe row version differs from payload",
    (t) => {
      row(t, "assembly_recipes").version = "x";
    },
    "recipe_row_payload",
  ],
  [
    "package: support role differs from the frozen snapshot",
    (t) => {
      row(t, "claim_supports").support_role = "qualifies";
    },
    "package_support_snapshot",
  ],
  [
    "package: evidence rights version differs from the snapshot",
    (t) => {
      row(t, "evidence_units").rights_version_id = find(
        t,
        "rights_versions",
        (r) =>
          r.rights_version_id !== row(t, "evidence_units").rights_version_id,
      ).rights_version_id;
    },
    "package_evidence_fields",
  ],
  [
    "package: permission granted beyond the rights policy",
    (t) => {
      const u = row(t, "evidence_units");
      (
        find(
          t,
          "rights_versions",
          (r) => r.rights_version_id === u.rights_version_id,
        ).policy as Record<string, unknown>
      ).paraphrase_permission = false;
    },
    "package_evidence_permission_exceeds_rights",
  ],
  [
    "registry: audit result pointing at a script (wrong kind)",
    (t) => {
      row(t, "audit_runs").result_artifact_id = find(
        t,
        "artifacts",
        (a) => a.artifact_type === "script_pass1",
      ).artifact_id;
    },
    "consumer_kind_mismatch",
  ],
  [
    "uses: claim-use span differs from the script payload",
    (t) => {
      row(t, "turn_claim_uses").span_end = 1000;
    },
    "uses_claim_row_payload",
  ],
  [
    "uses: evidence-use unit differs from the script payload",
    (t) => {
      row(t, "turn_evidence_uses").evidence_unit_id = find(
        t,
        "evidence_units",
        (e) =>
          e.evidence_unit_id !== row(t, "turn_evidence_uses").evidence_unit_id,
      ).evidence_unit_id;
    },
    "uses_evidence_row_payload",
  ],
  [
    "versions: program block row differs from the brief payload",
    (t) => {
      (
        row(t, "program_blocks").semantic_payload as Record<string, unknown>
      ).job = "changed";
    },
    "program_block_payload",
  ],
  [
    "versions: render manifest row audit run differs from payload",
    (t) => {
      row(t, "render_manifests").audit_run_id = find(
        t,
        "audit_runs",
        (a) => a.audit_run_id !== row(t, "render_manifests").audit_run_id,
      ).audit_run_id;
    },
    "render_manifest_row_payload",
  ],
];

describe("A4 persisted-row regressions through the public verification pipeline", () => {
  it("the unmutated rows are accepted", () => {
    expect(run(() => undefined)).toBe("accepted");
  });
  for (const [label, edit, expected] of cases)
    it(`rejects ${label}`, () => {
      expect(run(edit)).toBe(expected);
    });
  it("control: package execution timestamps outside the manifest stay excluded", () => {
    expect(
      run((t) => {
        const p = payload(
          find(t, "artifacts", (a) => a.artifact_type === "evidence_package"),
        );
        p.created_at = "2031-01-01T00:00:00Z";
        p.frozen_at = "2031-01-01T00:00:01Z";
      }),
    ).toBe("accepted");
  });
  it("control: an earlier reservation time remains causal", () => {
    expect(
      run((t) => {
        find(t, "provider_calls", (c) => c.operation === "tts").started_at =
          "2026-09-27T13:00:01Z";
      }),
    ).toBe("accepted");
  });
  it("the SHIPPED snapshot gets the same checks: a self-consistent pack whose rows break a ledger rule is rejected before insertion", () => {
    let outcome = "accepted";
    try {
      VerifiedFixture.fromPack(
        consistentPack((m) => {
          editRows(m, (t) => {
            must(t.provider_call_events?.[0]).actual_cost = "0";
          });
        }),
      );
    } catch (error) {
      outcome = (error as { code?: string }).code ?? "other";
    }
    expect(outcome).toBe("ledger_event_cost");
  });
});
