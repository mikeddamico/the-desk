import { describe, expect, it } from "vitest";

import { verifyAssembly } from "../src/fixture/assembly.js";
import {
  CONSUMER_COLUMNS,
  FIXTURE_ARTIFACT_TYPE_COUNTS,
  verifyArtifactRegistry,
  verifyPackageSnapshot,
  verifyUses,
  verifyVersions,
} from "../src/fixture/bindings.js";
import { DerivationError } from "../src/fixture/derive.js";
import { families } from "../src/fixture/families.js";
import { verifyLedger, secondsText } from "../src/fixture/ledger.js";
import { verifyTypedObligations } from "../src/fixture/obligations.js";
import { openFixturePack } from "../src/fixture/pack.js";
import { FIXTURE_V046_PINS } from "../src/fixture/pins.js";
import { deepFreeze, type Tables } from "../src/fixture/rows.js";
import { VerifiedFixture } from "../src/fixture/snapshot.js";
import { FixtureVerificationError, verifyRows } from "../src/fixture/verify.js";
import { must } from "./support/claim-events.js";

// Unit proofs for the A4 row-derived checks. Every mutation below edits ROWS (the persisted representation) and expects the exact
// code of the semantic check it targets. "viaRows" runs the whole verifyRows pipeline (earlier A2/A3 checks must pass first, so the
// mutation is isolated to the new check); "direct" calls one module on a cloned row set, for defects whose coupled hashes would
// otherwise trip an earlier check first. Fixture-scoped checks are labeled in the modules.
const real = VerifiedFixture.fromPack(openFixturePack());
type T = Record<string, Record<string, unknown>[]>;
const clone = (): T => JSON.parse(JSON.stringify(real.rows.tables)) as T;
const as = (t: T): Tables => t;
const historicalId = FIXTURE_V046_PINS.historicalDirection.artifactId;

const codeOf = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    if (
      error instanceof DerivationError ||
      error instanceof FixtureVerificationError
    )
      return error.code;
    throw error;
  }
  return "accepted";
};
const viaRows = (edit: (t: T) => void): string => {
  const t = clone();
  edit(t);
  return codeOf(() => {
    verifyRows(deepFreeze(as(t)), real.context, real.historical);
  });
};
const direct = (fn: (t: Tables) => void, edit: (t: T) => void): string => {
  const t = clone();
  edit(t);
  return codeOf(() => {
    fn(as(t));
  });
};
const first = (t: T, table: string): Record<string, unknown> =>
  must(t[table]?.[0], `${table}[0]`);
const where = (
  t: T,
  table: string,
  pred: (r: Record<string, unknown>) => boolean,
) => must(t[table]?.find(pred), `${table} row`);
const artifact = (t: T, type: string): Record<string, unknown> =>
  where(t, "artifacts", (a) => a.artifact_type === type);
const payload = (row: Record<string, unknown>): Record<string, unknown> =>
  row.canonical_payload as Record<string, unknown>;
const ttsCall = (t: T): Record<string, unknown> =>
  where(t, "provider_calls", (c) => c.operation === "tts");
const eventOf = (
  t: T,
  call: Record<string, unknown>,
): Record<string, unknown> =>
  where(
    t,
    "provider_call_events",
    (e) => e.provider_call_id === call.provider_call_id,
  );

describe("the real fixture passes every A4 check (shipped snapshot = persisted rows)", () => {
  it("accepts the base rows through verifyRows", () => {
    expect(viaRows(() => undefined)).toBe("accepted");
  });
  it("secondsText is exact integer decimal arithmetic", () => {
    expect(secondsText(5040)).toBe("0.105");
    expect(secondsText(6959)).toBe("0.144979");
    expect(secondsText(6240)).toBe("0.13");
    expect(secondsText(48000)).toBe("1");
  });
});

describe("provider ledger, take chain and request-to-WAV mapping", () => {
  const cases: [string, (t: T) => void, string][] = [
    [
      "a terminal event with cost 0 instead of the exact fixture text 0.0000",
      (t) => {
        first(t, "provider_call_events").actual_cost = "0";
      },
      "ledger_event_cost",
    ],
    [
      "a non-USD currency",
      (t) => {
        first(t, "provider_call_events").currency = "EUR";
      },
      "ledger_event_cost",
    ],
    [
      "a second try number",
      (t) => {
        first(t, "provider_calls").operational_try_number = 2;
      },
      "ledger_not_try_one",
    ],
    [
      "a TTS model identity other than the fixture model",
      (t) => {
        ttsCall(t).model_identifier = "other-model";
      },
      "ledger_tts_model_identity",
    ],
    [
      "a generated_seconds that is not the exact decimal of the take's frames",
      (t) => {
        const e = eventOf(t, ttsCall(t));
        (e.usage as Record<string, unknown>).generated_seconds = "0.106";
      },
      "ledger_generated_seconds",
    ],
    [
      "a model event that contacted an external provider",
      (t) => {
        const call = where(t, "provider_calls", (c) => c.operation !== "tts");
        (
          eventOf(t, call).usage as Record<string, unknown>
        ).external_provider_contacted = true;
      },
      "ledger_event_usage",
    ],
    [
      "a wrong intentional take index",
      (t) => {
        ttsCall(t).intentional_take_index = 7;
      },
      "ledger_take_request_binding",
    ],
    [
      "a reroll trigger with another failure code",
      (t) => {
        first(t, "reroll_triggers").failure_code = "other_failure";
      },
      "reroll_causal_chain",
    ],
    [
      "an approval that does not supersede the rejection",
      (t) => {
        where(
          t,
          "take_selections",
          (s) => s.supersedes_selection_id !== null,
        ).supersedes_selection_id = null;
      },
      "reroll_selection_chain",
    ],
    [
      "an approval stamped before the rerolled call started (causal order)",
      (t) => {
        const rejected = where(
          t,
          "take_selections",
          (x) => x.decision === "rejected",
        );
        where(
          t,
          "take_selections",
          (x) =>
            x.decision === "approved" && x.supersedes_selection_id !== null,
        ).created_at = new Date(
          Date.parse(String(rejected.created_at)) + 500,
        ).toISOString();
      },
      "reroll_causal_timestamps",
    ],
    [
      "a reservation that starts after its terminal event",
      (t) => {
        const call = ttsCall(t);
        call.started_at = "2030-01-01T00:00:00Z";
      },
      "ledger_event_before_reservation",
    ],
  ];
  for (const [label, edit, expected] of cases)
    it(`rejects ${label}`, () => {
      expect(viaRows(edit)).toBe(expected);
    });

  it("rejects a take index that no longer matches the call's logical request key (direct: lineage would also move)", () => {
    expect(
      direct(
        (t) => {
          verifyLedger(t, real.context.mapping);
        },
        (t) => {
          first(t, "render_takes").take_index = 5;
        },
      ),
    ).toBe("ledger_take_request_binding");
  });

  it("rejects a mechanical-validation artifact whose bound audio is not the rejected take's (direct: the payload is hashed)", () => {
    expect(
      direct(
        (t) => {
          verifyLedger(t, real.context.mapping);
        },
        (t) => {
          payload(artifact(t, "mechanical_validation")).audio_sha256 =
            "0".repeat(64);
        },
      ),
    ).toBe("reroll_validation_bindings");
  });

  it("rejects a shipped mapping entry that disagrees with the rows (the shipped file is only a comparison target)", () => {
    const mapping = JSON.parse(JSON.stringify(real.context.mapping)) as Record<
      string,
      unknown
    >[];
    must(mapping[0]).wav_sha256 = "f".repeat(64);
    expect(
      codeOf(() => {
        verifyLedger(real.rows.tables, mapping);
      }),
    ).toBe("mapping_row_binding");
    const short = mapping.slice(1);
    expect(
      codeOf(() => {
        verifyLedger(real.rows.tables, short);
      }),
    ).toBe("mapping_entry_count");
  });

  it("rows win over the mapping: a changed row is caught even when the shipped mapping is untouched", () => {
    expect(
      direct(
        (t) => {
          verifyLedger(t, real.context.mapping);
        },
        (t) => {
          where(
            t,
            "audio_artifacts",
            (a) => a.artifact_id === first(t, "render_takes").audio_artifact_id,
          ).audio_sha256 = "1".repeat(64);
        },
      ),
    ).toBe("mapping_row_binding");
  });
});

describe("assembly, frames and audio metadata", () => {
  const cases: [string, (t: T) => void, string][] = [
    [
      "a rounded-millisecond duration that is not the exact half-up of the frames",
      (t) => {
        first(t, "audio_artifacts").duration_ms = 999;
      },
      "audio_duration_ms",
    ],
    [
      "a frame count inconsistent with the 44-byte canonical WAV length",
      (t) => {
        payload(
          where(t, "artifacts", (a) =>
            String(a.artifact_type).startsWith("audio/"),
          ),
        ).frame_count = 5041;
      },
      "audio_byte_length",
    ],
    [
      "a recipe row whose version differs from its payload",
      (t) => {
        first(t, "assembly_recipes").version = "fixture-assembly-v9";
      },
      "recipe_row_payload",
    ],
    [
      "a master map row bound to another master audio",
      (t) => {
        first(t, "master_assembly_maps").master_audio_artifact_id = where(
          t,
          "audio_artifacts",
          (a) =>
            a.artifact_id !==
            where(
              t,
              "audio_artifacts",
              (x) =>
                x.audio_artifact_id ===
                first(t, "master_assembly_maps").master_audio_artifact_id,
            ).artifact_id,
        ).audio_artifact_id;
      },
      "map_row_payload",
    ],
    [
      "a segment whose frames overlap the next one",
      (t) => {
        const seg = (
          payload(artifact(t, "master_assembly_map")).segments as Record<
            string,
            unknown
          >[]
        )[1];
        must(seg).start_frame = 1;
      },
      "map_frame_start",
    ],
    [
      "a take selection whose segment lineage differs",
      (t) => {
        (
          payload(artifact(t, "master_assembly_map")).segments as Record<
            string,
            unknown
          >[]
        )[0] = {
          ...((
            payload(artifact(t, "master_assembly_map")).segments as Record<
              string,
              unknown
            >[]
          )[0] ?? {}),
          render_take_id: first(t, "render_takes").provider_call_id,
        };
      },
      "map_segment_lineage",
    ],
  ];
  for (const [label, edit, expected] of cases)
    it(`rejects ${label}`, () => {
      expect(direct(verifyAssembly, edit)).toBe(expected);
    });
  it("the row mutation reaches the check through the whole pipeline when no hash is coupled", () => {
    expect(
      viaRows((t) => {
        first(t, "audio_artifacts").duration_ms = 999;
      }),
    ).toBe("audio_duration_ms");
    expect(
      viaRows((t) => {
        first(t, "assembly_recipes").version = "x";
      }),
    ).toBe("recipe_row_payload");
  });
});

describe("package snapshot, rights and exposure", () => {
  it("rejects a durable support row that differs from the frozen support snapshot", () => {
    expect(
      viaRows((t) => {
        first(t, "claim_supports").support_role = "qualifies";
      }),
    ).toBe("package_support_snapshot");
  });
  it("rejects an evidence unit whose rights version differs from the snapshot", () => {
    expect(
      viaRows((t) => {
        first(t, "evidence_units").rights_version_id = where(
          t,
          "rights_versions",
          (r) =>
            r.rights_version_id !==
            first(t, "evidence_units").rights_version_id,
        ).rights_version_id;
      }),
    ).toBe("package_evidence_fields");
  });
  it("rejects a package that grants more than the rights version allows (permissions only restrict)", () => {
    expect(
      viaRows((t) => {
        const unit = first(t, "evidence_units");
        const policy = where(
          t,
          "rights_versions",
          (r) => r.rights_version_id === unit.rights_version_id,
        ).policy as Record<string, unknown>;
        policy.paraphrase_permission = false;
      }),
    ).toBe("package_evidence_permission_exceeds_rights");
  });
  it("rejects an exposure level the rights ceiling does not list for that consumer", () => {
    expect(
      viaRows((t) => {
        const unit = first(t, "evidence_units");
        const policy = where(
          t,
          "rights_versions",
          (r) => r.rights_version_id === unit.rights_version_id,
        ).policy as Record<string, unknown>;
        (policy.consumer_exposure_ceiling as Record<string, unknown>).writer = [
          "hidden",
        ];
      }),
    ).toBe("package_evidence_exposure_exceeds_rights");
  });
  it("rejects a claim row whose value differs from the snapshot (jsonb compared canonically)", () => {
    expect(
      direct(verifyPackageSnapshot, (t) => {
        first(t, "claims").value = { northbridge_goals: 9 };
      }),
    ).toBe("package_claim_value");
  });
});

describe("artifact registry and valid durable consumers", () => {
  const reg = (t: Tables): void => {
    verifyArtifactRegistry(t, historicalId);
  };
  it("the declared consumer columns cover every foreign key to artifacts in the schema graph (no silently skipped column)", () => {
    const fks = families.flatMap((f) =>
      f.foreignKeys
        .filter((k) => k.refTable === "artifacts")
        .map((k) => `${f.table}.${k.columns.join(",")}`),
    );
    const declared = Object.keys(CONSUMER_COLUMNS);
    for (const fk of fks) expect(declared, fk).toContain(fk);
    expect(
      Object.values(FIXTURE_ARTIFACT_TYPE_COUNTS).reduce((a, b) => a + b, 0),
    ).toBe(36);
  });
  it("accepts the real registry including the revalidation snapshot edge", () => {
    expect(direct(reg, () => undefined)).toBe("accepted");
  });
  it("rejects a reference to the wrong artifact KIND (an audit result pointing at a script)", () => {
    expect(
      viaRows((t) => {
        first(t, "audit_runs").result_artifact_id = artifact(
          t,
          "script_pass1",
        ).artifact_id;
      }),
    ).toBe("consumer_kind_mismatch");
  });
  it("rejects a gate-result revalidation ref that resolves to the wrong kind", () => {
    expect(
      direct(reg, (t) => {
        for (const g of t.gate_results ?? []) {
          const refs = (g.result as Record<string, unknown>)
            .fixture_revalidation_refs as Record<string, unknown> | undefined;
          if (refs)
            refs.snapshot_artifact_id = artifact(
              t,
              "revalidation_result",
            ).artifact_id;
        }
      }),
    ).toBe("consumer_kind_mismatch");
  });
  it("rejects an orphan: the revalidation result is consumed only through the gate-result refs", () => {
    expect(
      direct(reg, (t) => {
        for (const g of t.gate_results ?? []) {
          const refs = (g.result as Record<string, unknown>)
            .fixture_revalidation_refs as Record<string, unknown> | undefined;
          if (refs) delete refs.result_artifact_id;
        }
      }),
    ).toBe("missing_reference");
  });
  it("requires the revalidation_result payload's snapshot edge (snapshot_artifact_id and snapshot_hash)", () => {
    expect(
      direct(reg, (t) => {
        payload(artifact(t, "revalidation_result")).snapshot_hash = "0".repeat(
          64,
        );
      }),
    ).toBe("revalidation_snapshot_edge");
    expect(
      direct(reg, (t) => {
        payload(artifact(t, "revalidation_result")).snapshot_artifact_id =
          artifact(t, "revalidation_result").artifact_id;
      }),
    ).toBe("consumer_kind_mismatch");
  });
  it("rejects wrong per-type counts (fixture-scoped registry arithmetic)", () => {
    expect(
      direct(reg, (t) => {
        artifact(t, "writer_view").artifact_type = "tenor_support";
      }),
    ).toBe("registry_type_counts");
  });
  it("incidental strings are not consumers: an external support identity naming a non-support artifact is rejected", () => {
    expect(
      direct(reg, (t) => {
        const s = where(
          t,
          "claim_supports",
          (r) => typeof r.external_support_identity === "string",
        );
        s.external_support_identity = `artifact:${String(artifact(t, "writer_view").artifact_id)}`;
      }),
    ).toBe("consumer_kind_mismatch");
  });
});

describe("turn claim/evidence uses, spans and frozen usage classes", () => {
  it("rejects a use row that differs from the script payload item", () => {
    expect(
      viaRows((t) => {
        first(t, "turn_claim_uses").span_end = 1000;
      }),
    ).toBe("uses_claim_row_payload");
    expect(
      viaRows((t) => {
        first(t, "turn_evidence_uses").evidence_unit_id = where(
          t,
          "evidence_units",
          (e) =>
            e.evidence_unit_id !==
            first(t, "turn_evidence_uses").evidence_unit_id,
        ).evidence_unit_id;
      }),
    ).toBe("uses_evidence_row_payload");
  });
  const both =
    (
      edit: (
        row: Record<string, unknown>,
        item: Record<string, unknown>,
      ) => void,
      key: "turn_claim_uses" | "turn_evidence_uses",
    ) =>
    (t: T): void => {
      const row = first(t, key);
      const id =
        key === "turn_claim_uses"
          ? "turn_claim_use_id"
          : "turn_evidence_use_id";
      const sv = where(
        t,
        "script_versions",
        (s) =>
          s.script_version_id ===
          where(t, "turns", (x) => x.turn_id === row.turn_id).script_version_id,
      );
      const item = (
        payload(where(t, "artifacts", (a) => a.artifact_id === sv.artifact_id))[
          key
        ] as Record<string, unknown>[]
      ).find((i) => i[id] === row[id]);
      edit(row, must(item));
    };
  it("rejects a span outside the turn's code-point text (row and payload edited together, direct)", () => {
    expect(
      direct(
        verifyUses,
        both((r, i) => {
          r.span_end = 99999;
          i.span_end = 99999;
        }, "turn_claim_uses"),
      ),
    ).toBe("uses_claim_span");
    expect(
      direct(
        verifyUses,
        both((r, i) => {
          r.span_start = 5;
          r.span_end = 5;
          i.span_start = 5;
          i.span_end = 5;
        }, "turn_claim_uses"),
      ),
    ).toBe("uses_claim_span");
  });
  it("an unknown use mode is rejected; the documented per-class restrictions are tested in a4-repair-regressions (silent-only relied_on_silent, no asserted hedged_only), and no further prohibition is imposed", () => {
    expect(
      direct(
        verifyUses,
        both((r, i) => {
          r.use_mode = "shouted";
          i.use_mode = "shouted";
        }, "turn_claim_uses"),
      ),
    ).toBe("uses_claim_mode_unknown");
  });
  it("rejects a claim_state_hash that is not the package's frozen-state hash", () => {
    expect(
      direct(
        verifyUses,
        both((_r, i) => {
          i.claim_state_hash = "0".repeat(64);
        }, "turn_claim_uses"),
      ),
    ).toBe("uses_claim_state_hash");
  });
  it("rejects quotation/paraphrase beyond the evidence unit's rights policy", () => {
    expect(
      direct(verifyUses, (t) => {
        const row = where(
          t,
          "turn_evidence_uses",
          (r) => r.use_mode === "paraphrased",
        );
        const unit = where(
          t,
          "evidence_units",
          (u) => u.evidence_unit_id === row.evidence_unit_id,
        );
        (
          where(
            t,
            "rights_versions",
            (r) => r.rights_version_id === unit.rights_version_id,
          ).policy as Record<string, unknown>
        ).paraphrase_permission = false;
      }),
    ).toBe("uses_paraphrase_not_permitted");
    // the frozen package entry forbids quotation for this unit, so the frozen restriction is reported first; the rights-ceiling
    // check on its own is exercised in a4-repair-regressions ("both authorities are required")
    expect(
      direct(
        verifyUses,
        both((r, i) => {
          r.use_mode = "quoted";
          i.use_mode = "quoted";
        }, "turn_evidence_uses"),
      ),
    ).toBe("uses_quote_not_frozen");
  });
  it("rejects an evidence use whose rights version is not the unit's", () => {
    expect(
      direct(
        verifyUses,
        both((_r, i) => {
          i.rights_policy_version = "d1250006-0000-4000-8000-0000000000ff";
        }, "turn_evidence_uses"),
      ),
    ).toBe("uses_evidence_rights_version");
  });
});

describe("version rows, brief-owned program blocks, intents and manifests", () => {
  it("rejects a program block row that differs from the brief payload (brief-owned blocks)", () => {
    expect(
      viaRows((t) => {
        (
          first(t, "program_blocks").semantic_payload as Record<string, unknown>
        ).job = "changed";
      }),
    ).toBe("program_block_payload");
    expect(
      direct(verifyVersions, (t) => {
        first(t, "program_blocks").sequence = 42;
      }),
    ).toBe("program_block_fields");
  });
  it("rejects a script version row whose parent identity is not the parent's content hash", () => {
    expect(
      direct(verifyVersions, (t) => {
        where(
          t,
          "script_versions",
          (s) => s.revision_parent_id !== null,
        ).revision_parent_content_identity = "0".repeat(64);
      }),
    ).toBe("script_version_row_payload");
  });
  it("rejects an intent row that differs from the direction payload (direct: the request rebuild would also notice)", () => {
    expect(
      direct(verifyVersions, (t) => {
        (
          first(t, "performance_intents").intent as Record<string, unknown>
        ).value = "flat";
      }),
    ).toBe("intent_row_payload");
  });
  it("rejects a render manifest row whose audit run differs from its payload", () => {
    expect(
      viaRows((t) => {
        first(t, "render_manifests").audit_run_id = where(
          t,
          "audit_runs",
          (a) => a.audit_run_id !== first(t, "render_manifests").audit_run_id,
        ).audit_run_id;
      }),
    ).toBe("render_manifest_row_payload");
  });
  it("rejects a direction version row bound to a script other than the payload's", () => {
    expect(
      direct(verifyVersions, (t) => {
        first(t, "performance_direction_versions").script_version_id = where(
          t,
          "script_versions",
          (s) =>
            s.script_version_id !==
            first(t, "performance_direction_versions").script_version_id,
        ).script_version_id;
      }),
    ).toBe("direction_version_row_payload");
  });
});

describe("typed obligations: field-specific format, declared values, exact null classes", () => {
  const ob = (edit: (t: T) => void): string =>
    direct((t) => {
      verifyTypedObligations(t, real.context.obligations, {
        artifactId: historicalId,
      });
    }, edit);
  it("accepts the base rows against the 178 declared typed entries, 279 nested locations and the subsidiary records", () => {
    expect(ob(() => undefined)).toBe("accepted");
    expect(real.context.obligations.typed).toHaveLength(178);
    expect(real.context.obligations.nested).toHaveLength(279);
  });
  it("is field-specific, not a blanket hex rule: tagged TTS identities are valid as v1: and invalid as bare hex, model identities the reverse", () => {
    expect(
      ob((t) => {
        const c = ttsCall(t);
        c.request_fingerprint = String(c.request_fingerprint).slice(3);
      }),
    ).toBe("obligation_value_mismatch");
    expect(
      ob((t) => {
        const c = where(t, "provider_calls", (x) => x.operation !== "tts");
        c.request_fingerprint = `v1:${String(c.request_fingerprint)}`;
      }),
    ).toBe("obligation_value_mismatch");
    expect(
      ob((t) => {
        const c = ttsCall(t);
        c.logical_request_key = String(c.request_fingerprint);
      }),
    ).toBe("obligation_value_mismatch");
  });
  it("rejects malformed values even where the declaration is absent (format of every row of a typed column)", () => {
    expect(
      ob((t) => {
        const a = where(t, "artifacts", (x) =>
          String(x.artifact_type).startsWith("audio/"),
        );
        a.content_hash = String(a.content_hash).toUpperCase();
      }),
    ).toBe("obligation_format");
  });
  it("accepts the v0.4.6 changes only through the transition inventory: an unexplained different value fails", () => {
    expect(
      ob((t) => {
        where(
          t,
          "prompt_manifests",
          (m) =>
            m.rendered_request_hash ===
            real.context.obligations.transition.get(
              "2284a7b34f01fdb06329b76923b62a12bd33ba51632633e382203024a0e65756",
            ),
        ).rendered_request_hash = "a".repeat(64);
      }),
    ).toBe("obligation_value_mismatch");
    expect(real.context.obligations.transition.size).toBeGreaterThan(5);
  });
  it("nulls are permitted only at declared exact locations, never by leaf name", () => {
    expect(
      ob((t) => {
        payload(artifact(t, "writer_view")).extra_hash = null;
      }),
    ).toBe("obligation_undeclared_hashlike_null");
    expect(
      ob((t) => {
        const m = (
          payload(artifact(t, "evidence_package")).manifest as Record<
            string,
            unknown
          >
        ).claims as Record<string, unknown>[];
        (must(m[0]).support_refs as Record<string, unknown>[])[0] = {
          ...((must(m[0]).support_refs as Record<string, unknown>[])[0] ?? {}),
          external_support_identity: "artifact:x",
        };
      }),
    ).toBe("obligation_nested_null");
    expect(
      ob((t) => {
        first(t, "script_versions").revision_parent_content_identity =
          "0".repeat(64);
      }),
    ).toBe("obligation_parent_pair");
  });
  it("keeps the exact historical row/path disposition: a non-null historical input_fingerprint, or a null current one, is rejected", () => {
    expect(
      ob((t) => {
        payload(
          where(t, "artifacts", (a) => a.artifact_id === historicalId),
        ).input_fingerprint = "0".repeat(64);
      }),
    ).toBe("obligation_historical_disposition");
    expect(
      ob((t) => {
        payload(
          where(
            t,
            "artifacts",
            (a) =>
              a.artifact_type === "performance_direction" &&
              a.artifact_id !== historicalId,
          ),
        ).input_fingerprint = "0".repeat(64);
      }),
    ).toBe("obligation_nested_value");
  });
  it("format validation is separate from recomputation: a well-formed wrong hash passes FORMAT here and is caught by the A1 recomputation", () => {
    const wrong = "0".repeat(64);
    expect(
      viaRows((t) => {
        first(t, "claims").content_hash = wrong;
      }),
    ).toBe("claim_hash_mismatch"); // recomputation (A1)
    expect(
      ob((t) => {
        first(t, "claims").content_hash = wrong;
      }),
    ).toBe("obligation_value_mismatch"); // declared value, correct format
  });
});

describe("exclusion controls tied to the owning projections", () => {
  it("package execution timestamps and every non-manifest field stay outside evidence-package-v2; manifest content moves it", async () => {
    const { evidencePackageHash } = await import(
      "../src/identity/artifacts.js"
    );
    const pkg = payload(artifact(clone(), "evidence_package"));
    const before = evidencePackageHash(pkg);
    for (const key of Object.keys(pkg).filter((k) => k !== "manifest")) {
      const edited = {
        ...pkg,
        [key]: typeof pkg[key] === "string" ? `${pkg[key]}x` : pkg[key],
      };
      expect(evidencePackageHash(edited), key).toBe(before);
    }
    const moved = JSON.parse(JSON.stringify(pkg)) as {
      manifest: { claims: { approved_representation: string }[] };
    };
    must(moved.manifest.claims[0]).approved_representation += "!";
    expect(evidencePackageHash(moved)).not.toBe(before);
    // and the whole pipeline accepts changed execution timestamps outside the manifest
    expect(
      viaRows((t) => {
        const p = payload(artifact(t, "evidence_package"));
        p.created_at = "2031-01-01T00:00:00Z";
        p.frozen_at = "2031-01-01T00:00:01Z";
      }),
    ).toBe("accepted");
  });
  it("measured per owning projection: script revision_reason and created_at are excluded from script-v2, brief/package bindings are hashed", async () => {
    const { scriptHash } = await import("../src/identity/artifacts.js");
    const t = clone();
    const brief = payload(artifact(t, "showrunner_brief"));
    const s2 = payload(artifact(t, "script_pass2"));
    const base = scriptHash(s2, { brief });
    expect(
      scriptHash(
        { ...s2, revision_reason: `${String(s2.revision_reason)} (edited)` },
        { brief },
      ),
    ).toBe(base);
    expect(
      scriptHash({ ...s2, created_at: "2031-01-01T00:00:00Z" }, { brief }),
    ).toBe(base);
    expect(
      scriptHash({ ...s2, package_hash: "0".repeat(64) }, { brief }),
    ).not.toBe(base);
  });
  it("ledger causal timestamps are NOT hashed but are independently checked by the fixture ledger rules", () => {
    expect(
      viaRows((t) => {
        const c = ttsCall(t);
        c.started_at = "2026-09-27T13:00:01Z";
      }),
    ).toBe("accepted"); // an earlier reservation stays causal
    expect(
      viaRows((t) => {
        const e = eventOf(t, ttsCall(t));
        e.ended_at = "2026-09-27T13:00:00Z";
      }),
    ).toBe("ledger_event_before_reservation");
  });
});
