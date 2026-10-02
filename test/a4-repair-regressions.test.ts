import { describe, expect, it } from "vitest";

import { verifyPackageSnapshot, verifyUses } from "../src/fixture/bindings.js";
import { DerivationError } from "../src/fixture/derive.js";
import { openFixturePack } from "../src/fixture/pack.js";
import type { Tables } from "../src/fixture/rows.js";
import { VerifiedFixture } from "../src/fixture/snapshot.js";
import { must } from "./support/claim-events.js";

// Semantic-helper regressions (A4 repair). These call verifyPackageSnapshot / verifyUses DIRECTLY on cloned rows: an edited package
// payload would carry a stale evidence-package hash, so these are NOT full-pipeline claims. Artifact-hash controls are separate
// and labeled. Each defect below was ACCEPTED by the reviewed candidate 2065dd0.
const real = VerifiedFixture.fromPack(openFixturePack());
type R = Record<string, unknown>;
type T = Record<string, R[]>;
const clone = (): T => JSON.parse(JSON.stringify(real.rows.tables)) as T;
const as = (t: T): Tables => t;
const code = (fn: (t: Tables) => void, edit: (t: T) => void): string => {
  const t = clone();
  edit(t);
  try {
    fn(as(t));
  } catch (error) {
    if (error instanceof DerivationError) return error.code;
    throw error;
  }
  return "accepted";
};
const art = (t: T, type: string): R =>
  must(t.artifacts?.find((a) => a.artifact_type === type));
const manifest = (t: T): { claims: R[]; evidence: R[] } =>
  (
    art(t, "evidence_package").canonical_payload as {
      manifest: { claims: R[]; evidence: R[] };
    }
  ).manifest;
const entryOf = (t: T, unit: unknown): R =>
  must(manifest(t).evidence.find((e) => e.evidence_unit_id === unit));
const useRow = (t: T, mode: string): R =>
  must(
    t.turn_evidence_uses?.find((u) => u.use_mode === mode),
    `${mode} use`,
  );
const policyOf = (t: T, unit: unknown): R => {
  const u = must(t.evidence_units?.find((x) => x.evidence_unit_id === unit));
  return must(
    t.rights_versions?.find((r) => r.rights_version_id === u.rights_version_id),
  ).policy as R;
};

describe("frozen package permissions bind every evidence use", () => {
  it("controls: the real rows are accepted by both helpers", () => {
    expect(code(verifyPackageSnapshot, () => undefined)).toBe("accepted");
    expect(code(verifyUses, () => undefined)).toBe("accepted");
  });

  it("REPRODUCTION: a paraphrased unit whose frozen entry forbids paraphrase (rights still allow it) is rejected by verifyUses", () => {
    const edit = (t: T): void => {
      entryOf(
        t,
        useRow(t, "paraphrased").evidence_unit_id,
      ).paraphrase_permission = false;
    };
    expect(code(verifyUses, edit)).toBe("uses_paraphrase_not_frozen");
    // a package that is MORE restrictive than its rights is legitimate for the snapshot helper (permissions only restrict)
    expect(code(verifyPackageSnapshot, edit)).toBe("accepted");
  });

  it("REPRODUCTION: a quoted unit whose frozen entry forbids quotation is rejected by verifyUses", () => {
    expect(
      code(verifyUses, (t) => {
        entryOf(t, useRow(t, "quoted").evidence_unit_id).quote_permission =
          false;
      }),
    ).toBe("uses_quote_not_frozen");
  });

  it("both authorities are required: frozen package AND governing rights ceiling", () => {
    // rights forbid, frozen entry (illegally) allows -> rights ceiling check still fires
    expect(
      code(verifyUses, (t) => {
        const unit = useRow(t, "paraphrased").evidence_unit_id;
        policyOf(t, unit).paraphrase_permission = false;
      }),
    ).toBe("uses_paraphrase_not_permitted");
    expect(
      code(verifyUses, (t) => {
        const unit = useRow(t, "quoted").evidence_unit_id;
        policyOf(t, unit).quotation_permission = false;
      }),
    ).toBe("uses_quote_not_permitted");
  });

  it("each use must resolve exactly ONE frozen entry with the unit's rights version", () => {
    expect(
      code(verifyUses, (t) => {
        const unit = useRow(t, "paraphrased").evidence_unit_id;
        manifest(t).evidence = manifest(t).evidence.filter(
          (e) => e.evidence_unit_id !== unit,
        );
      }),
    ).toBe("uses_evidence_not_in_package");
    expect(
      code(verifyUses, (t) => {
        const unit = useRow(t, "paraphrased").evidence_unit_id;
        manifest(t).evidence.push({ ...entryOf(t, unit) });
      }),
    ).toBe("uses_evidence_package_ambiguous");
    expect(
      code(verifyUses, (t) => {
        const unit = useRow(t, "paraphrased").evidence_unit_id;
        entryOf(t, unit).rights_version_id = must(
          t.rights_versions?.find(
            (r) => r.rights_version_id !== entryOf(t, unit).rights_version_id,
          ),
        ).rights_version_id;
      }),
    ).toBe("uses_evidence_package_rights_version");
  });

  it("allowed controls: a permitted paraphrase and a permitted quote stay accepted; a package that forbids an UNUSED permission is accepted", () => {
    expect(code(verifyUses, () => undefined)).toBe("accepted");
    expect(
      code(verifyUses, (t) => {
        const used = new Set(
          t.turn_evidence_uses?.map((u) => u.evidence_unit_id),
        );
        const spare = must(
          manifest(t).evidence.find((e) => !used.has(e.evidence_unit_id)),
        );
        spare.paraphrase_permission = false;
        spare.quote_permission = false;
      }),
    ).toBe("accepted");
  });

  it("artifact-hash control (a DIFFERENT layer): the same edit on the stored package is a hashed change in the full pipeline", async () => {
    const { verifyRows } = await import("../src/fixture/verify.js");
    const { deepFreeze } = await import("../src/fixture/rows.js");
    const t = clone();
    entryOf(
      t,
      useRow(t, "paraphrased").evidence_unit_id,
    ).paraphrase_permission = false;
    let outcome = "accepted";
    try {
      verifyRows(deepFreeze(as(t)), real.context, real.historical);
    } catch (error) {
      outcome = (error as { code?: string }).code ?? "other";
    }
    expect(outcome).toBe("artifact_hash_mismatch");
  });
});

describe("package membership is unique and complete", () => {
  it("REPRODUCTION: a duplicated evidence entry (evidence[1] := copy of evidence[0]) is rejected", () => {
    expect(
      code(verifyPackageSnapshot, (t) => {
        const m = manifest(t);
        m.evidence[1] = { ...must(m.evidence[0]) };
      }),
    ).toBe("package_evidence_duplicate");
  });
  it("REPRODUCTION: a duplicated claim entry is rejected", () => {
    expect(
      code(verifyPackageSnapshot, (t) => {
        const m = manifest(t);
        m.claims[1] = { ...must(m.claims[0]) };
      }),
    ).toBe("package_claim_duplicate");
  });
  it("an entry naming no durable row is rejected, and so is an omitted durable row", () => {
    expect(
      code(verifyPackageSnapshot, (t) => {
        must(manifest(t).evidence[0]).evidence_unit_id =
          "d1250007-0000-4000-8000-0000000000ff";
      }),
    ).toBe("package_evidence_unknown");
    expect(
      code(verifyPackageSnapshot, (t) => {
        manifest(t).evidence.pop();
      }),
    ).toBe("package_evidence_omitted");
    expect(
      code(verifyPackageSnapshot, (t) => {
        must(manifest(t).claims[0]).claim_id =
          "d1250008-0000-4000-8000-0000000000ff";
      }),
    ).toBe("package_claim_unknown");
    expect(
      code(verifyPackageSnapshot, (t) => {
        manifest(t).claims.pop();
      }),
    ).toBe("package_claim_omitted");
  });
  it("controls: a reordered package is still exact membership; extra manifest keys are not membership", () => {
    expect(
      code(verifyPackageSnapshot, (t) => {
        manifest(t).evidence.reverse();
        manifest(t).claims.reverse();
      }),
    ).toBe("accepted");
  });
});

describe("use modes: only the documented restrictions (Claims 11.1, 25), no invented ones", () => {
  const claimUse = (t: T, claimId: string): R => {
    // re-point the first claim-use row AND its script payload item at `claimId` (the frozen state hash follows the claim)
    const row = must(t.turn_claim_uses?.[0]);
    const frozen = must(manifest(t).claims.find((c) => c.claim_id === claimId));
    const sv = must(
      t.script_versions?.find(
        (s) =>
          s.script_version_id ===
          must(t.turns?.find((x) => x.turn_id === row.turn_id))
            .script_version_id,
      ),
    );
    const item = must(
      must(t.artifacts?.find((a) => a.artifact_id === sv.artifact_id))
        .canonical_payload as R & { turn_claim_uses: R[] },
    ).turn_claim_uses.find(
      (i) => i.turn_claim_use_id === row.turn_claim_use_id,
    );
    const target = must(item);
    row.claim_id = claimId;
    target.claim_id = claimId;
    target.claim_state_hash = frozen.frozen_state_hash;
    return Object.assign(row, { __item: target });
  };
  const setMode = (t: T, claimId: string, mode: string): void => {
    const row = claimUse(t, claimId);
    const item = row.__item as R;
    delete row.__item;
    row.use_mode = mode;
    item.use_mode = mode;
  };
  const claimWithClass = (cls: string): string =>
    String(
      must(real.rows.tables.claims?.find((c) => c.initial_usage_class === cls))
        .claim_id,
    );

  it("a silent claim may be linked with relied_on_silent ONLY (Claims 11.1)", () => {
    const silent = claimWithClass("silent");
    expect(
      code(verifyUses, (t) => {
        setMode(t, silent, "relied_on_silent");
      }),
    ).toBe("accepted");
    for (const mode of ["asserted", "hedged", "attributed"])
      expect(
        code(verifyUses, (t) => {
          setMode(t, silent, mode);
        }),
        mode,
      ).toBe("uses_silent_claim_mode");
  });
  it("a hedged_only claim cannot be asserted (Claims 25); hedged, attributed (and relied_on_silent, which no rule forbids) stay allowed", () => {
    const hedged = claimWithClass("hedged_only");
    expect(
      code(verifyUses, (t) => {
        setMode(t, hedged, "asserted");
      }),
    ).toBe("uses_hedged_only_asserted");
    for (const mode of ["hedged", "attributed", "relied_on_silent"])
      expect(
        code(verifyUses, (t) => {
          setMode(t, hedged, mode);
        }),
        mode,
      ).toBe("accepted");
  });
  it("no invented prohibition: an assertable claim may use any of the four skeleton modes, relied_on_silent included", () => {
    const assertable = claimWithClass("assertable");
    for (const mode of ["asserted", "hedged", "attributed", "relied_on_silent"])
      expect(
        code(verifyUses, (t) => {
          setMode(t, assertable, mode);
        }),
        mode,
      ).toBe("accepted");
  });
  it("CONTROL (structural only): an evidence unit that supports BOTH a silent claim and an independent assertable claim keeps its permitted paraphrase/quote structurally accepted", () => {
    // Source sharing alone creates no restriction. This does NOT prove the absence of semantic leakage: claim-specific evidence
    // linkage and leakage validation belong to the later owning checks (Claims 22 gates, semantic audit).
    const silent = claimWithClass("silent");
    for (const mode of ["paraphrased", "quoted"])
      expect(
        code(verifyUses, (t) => {
          const unit = must(
            t.turn_evidence_uses?.find((u) => u.use_mode === mode),
          ).evidence_unit_id;
          const existing = t.claim_supports?.filter(
            (s) => s.evidence_unit_id === unit,
          );
          expect(existing?.length).toBeGreaterThan(0); // already supports an independent (assertable) claim
          t.claim_supports?.push({
            ...must(existing?.[0]),
            claim_support_id: "d125000a-0000-4000-8000-0000000000ee",
            claim_id: silent,
          });
        }),
        mode,
      ).toBe("accepted");
  });
  it("denied-package and denied-rights regressions remain in force for the same units", () => {
    // frozen entry forbids -> rejected; rights forbid -> rejected (see 'frozen package permissions bind every evidence use')
    expect(
      code(verifyUses, (t) => {
        const unit = must(
          t.turn_evidence_uses?.find((u) => u.use_mode === "paraphrased"),
        ).evidence_unit_id;
        must(
          manifest(t).evidence.find((e) => e.evidence_unit_id === unit),
        ).paraphrase_permission = false;
      }),
    ).toBe("uses_paraphrase_not_frozen");
    expect(
      code(verifyUses, (t) => {
        const unit = must(
          t.turn_evidence_uses?.find((u) => u.use_mode === "quoted"),
        ).evidence_unit_id;
        policyOf(t, unit).quotation_permission = false;
      }),
    ).toBe("uses_quote_not_permitted");
  });
});
