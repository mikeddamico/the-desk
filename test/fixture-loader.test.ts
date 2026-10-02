import { describe, expect, it } from "vitest";

import { families } from "../src/fixture/families.js";
import { planInsertion } from "../src/fixture/order.js";
import {
  FixtureIntegrityError,
  defaultZipPath,
  openFixturePack,
  openPack,
  unzipSource,
} from "../src/fixture/pack.js";
import { FIXTURE_V046_PINS } from "../src/fixture/pins.js";
import { persistFixture } from "../src/fixture/persist.js";
import { parseFoundationRows, type Row } from "../src/fixture/rows.js";
import { VerifiedFixture } from "../src/fixture/snapshot.js";
import { FixtureVerificationError } from "../src/fixture/verify.js";
import {
  artifactOf,
  consistentPack,
  editJson,
  editRows,
  list,
  memorySource,
  must,
  obj,
  realMembers,
  rowOf,
  type Json,
} from "./support/fixture-pack.js";

const rowsMember = "foundation_rows_398.json";
const code = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code ?? (error as Error).message;
  }
  return "accepted";
};
const payloadOf = (row: Json): Json => obj(row.canonical_payload);

describe("pack integrity (D3: existing unzip tooling, pinned and bounded)", () => {
  it("opens the real pack: 133 members plus PACK_MEMBERS, hashes pinned externally", () => {
    const pack = openFixturePack();
    expect(pack.memberNames).toHaveLength(133);
    expect(pack.pins.zipSha256).toBe(
      "7e1bb1108cdd84e47269b9ab2dab20ba934fcec64d44262f86d2b505616b0747",
    );
    expect(pack.pins.packMembersSha256).toBe(
      "58a3c5e6188a91eba380c4cb4c08fbebb747513b5979ca9b3b0baab61d5b84fe",
    );
  });

  it("rejects a wrong ZIP hash, a wrong PACK_MEMBERS pin and a tampered member", () => {
    expect(
      code(() =>
        openPack(memorySource(realMembers(), { zipSha: "0".repeat(64) })),
      ),
    ).toBe("zip_sha256_mismatch");
    expect(
      code(() =>
        consistentPack(() => undefined, { packMembersSha256: "0".repeat(64) }),
      ),
    ).toBe("pack_members_sha256_mismatch");
    const tampered = realMembers();
    tampered.set(
      rowsMember,
      Buffer.concat([must(tampered.get(rowsMember)), Buffer.from(" ")]),
    );
    expect(code(() => openPack(memorySource(tampered)))).toBe(
      "member_sha256_mismatch",
    );
  });

  it("rejects a missing member, an extra member, duplicate entries and unsafe names", () => {
    const real = realMembers();
    const names = [...real.keys()];
    expect(
      code(() =>
        openPack(
          memorySource(real, {
            listing: names.filter((n) => n !== "README.md"),
          }),
        ),
      ),
    ).toBe("member_set_mismatch");
    const extra = realMembers();
    extra.set("extra.json", Buffer.from("{}"));
    expect(code(() => openPack(memorySource(extra)))).toBe(
      "member_set_mismatch",
    );
    expect(
      code(() =>
        openPack(memorySource(real, { listing: [...names, "README.md"] })),
      ),
    ).toBe("duplicate_zip_entry");
    for (const bad of ["../x", "a b", "x*", "/abs", "a/../b"])
      expect(
        code(() => openPack(memorySource(real, { listing: [...names, bad] }))),
      ).toBe("unsafe_member_name");
    const source = unzipSource(defaultZipPath());
    expect(code(() => source.read("../etc/passwd", 10))).toBe(
      "unsafe_member_name",
    );
    expect(code(() => source.read("*.json", 10))).toBe("unsafe_member_name");
  });

  it("requires exactly one active load", () => {
    const outcome = code(() =>
      consistentPack((m) => {
        editJson(m, "PACK_MEMBERS.json", (d) => {
          const other = list(d.members).find(
            (x) => x.path === "scenarios.json",
          );
          if (other) other.role = "active_load";
        });
      }),
    );
    expect(outcome).toBe("active_load_not_unique");
  });

  it("archival members are hashed for integrity but never parsed, exposed or loaded as rows", () => {
    const pack = openFixturePack();
    for (const archival of [
      "archive/ARCHIVE_ONLY_85.json",
      "archive/V2_ARCHIVED_283.json",
      "archive/i2a_source/foundation_rows.json",
      "archive/HISTORICAL_DIRECTION_10.json",
    ]) {
      expect(code(() => pack.member(archival))).toBe(
        "archival_member_not_loadable",
      );
      expect(code(() => pack.json(archival))).toBe(
        "archival_member_not_loadable",
      );
    }
    const baseline = VerifiedFixture.fromPack(pack).digest;
    // Garbage and injected "rows" in archival members (consistent hashes) change nothing: they are not parsed or inserted.
    const poisoned = consistentPack((m) => {
      m.set("archive/ARCHIVE_ONLY_85.json", Buffer.from("not json at all"));
      m.set(
        "archive/i2a_source/foundation_rows.json",
        Buffer.from(
          JSON.stringify({ tables: { accounts: [{ account_id: "x" }] } }),
        ),
      );
    });
    expect(VerifiedFixture.fromPack(poisoned).digest).toBe(baseline);
  });
});

describe("active-load shape (Trace v0.5.5 section 10)", () => {
  const open = (
    edit: (t: Record<string, Json[]>) => void,
    pins = {},
  ): ReturnType<typeof consistentPack> =>
    consistentPack((m) => {
      editRows(m, edit);
    }, pins);

  it("parses 398 rows in 40 families, 36 artifacts = 35 current + 1 historical, zero claim events", () => {
    const rows = parseFoundationRows(openFixturePack());
    expect(Object.keys(rows.tables)).toHaveLength(40);
    expect(Object.values(rows.tables).reduce((n, r) => n + r.length, 0)).toBe(
      398,
    );
    expect(rows.tables.artifacts).toHaveLength(36);
    expect(rows.tables.claim_state_events).toHaveLength(0);
    expect(rows.tables.turns).toHaveLength(51);
    expect(Object.isFrozen(must(rows.tables.artifacts)[0])).toBe(true);
  });

  it("rejects a missing family, a wrong count, a non-v4 key, an unknown or missing column and a duplicate key", () => {
    expect(
      code(() =>
        parseFoundationRows(
          open((t) => Reflect.deleteProperty(t, "voice_profiles")),
        ),
      ),
    ).toBe("family_set_mismatch");
    expect(
      code(() => parseFoundationRows(open((t) => t.accounts?.pop()))),
    ).toBe("family_count_mismatch");
    expect(
      code(() =>
        parseFoundationRows(
          open((t) => {
            rowOf(t, "accounts").account_id =
              "d1250001-0000-5000-8000-000000000002";
          }),
        ),
      ),
    ).toBe("primary_key_not_v4_uuid");
    expect(
      code(() =>
        parseFoundationRows(
          open((t) => {
            rowOf(t, "accounts").extra = 1;
          }),
        ),
      ),
    ).toBe("row_columns_mismatch");
    expect(
      code(() =>
        parseFoundationRows(
          open((t) =>
            Reflect.deleteProperty(rowOf(t, "accounts"), "display_name"),
          ),
        ),
      ),
    ).toBe("row_columns_mismatch");
    expect(
      code(() =>
        parseFoundationRows(
          open((t) => {
            rowOf(t, "accounts", 1).account_id = rowOf(
              t,
              "accounts",
            ).account_id;
          }),
        ),
      ),
    ).toBe("duplicate_primary_key");
  });

  it("rejects a claim event even when the pinned counts are changed to match", () => {
    const family = must(families.find((f) => f.table === "claim_state_events"));
    const row: Row = Object.fromEntries(family.columns.map((c) => [c, null]));
    row.claim_state_event_id = "d1250099-0000-4000-8000-000000000001";
    const pack = open(
      (t) => {
        t.claim_state_events = [row];
      },
      {
        familyCounts: {
          ...FIXTURE_V046_PINS.familyCounts,
          claim_state_events: 1,
        },
        totalRows: 399,
      },
    );
    expect(code(() => parseFoundationRows(pack))).toBe("claim_events_not_zero");
  });

  it("a renamed historical artifact breaks the 35 + 1 split", () => {
    const pack = open((t) => {
      const hist = must(
        t.artifacts?.find(
          (a) =>
            a.artifact_id === FIXTURE_V046_PINS.historicalDirection.artifactId,
        ),
      );
      hist.artifact_id = "d1250005-0000-4000-8000-0000000000aa";
    });
    expect(code(() => parseFoundationRows(pack))).toBe(
      "artifact_split_mismatch",
    );
  });
});

describe("pre-insertion verification with the accepted A1 modules", () => {
  const verify = (mutate: (m: Map<string, Buffer>) => void): string =>
    code(() => VerifiedFixture.fromPack(consistentPack(mutate)));
  /** Edit the stored artifact payload AND the shipped member copy, so only the A1 layer can object. */
  const bothCopies = (
    m: Map<string, Buffer>,
    type: string,
    member: string,
    edit: (payload: Json) => void,
  ): void => {
    editRows(m, (t) => {
      edit(payloadOf(artifactOf(t, type)));
    });
    editJson(m, member, edit);
  };

  it("accepts the real fixture; identical semantic anchors in the three script versions are legitimate (scoped per script)", () => {
    const fixture = VerifiedFixture.fromPack(openFixturePack());
    expect(must(fixture.rows.tables.turns)).toHaveLength(51);
    const scripts = must(fixture.rows.tables.artifacts).filter((a) =>
      String(a.artifact_type).startsWith("script_"),
    );
    const anchorSets = scripts.map(
      (s) =>
        new Set(
          list(payloadOf(s).turns).map((t) => String(t.semantic_turn_id)),
        ),
    );
    expect(anchorSets.map((s) => s.size)).toEqual([17, 17, 17]);
    for (const anchor of must(anchorSets[0])) {
      expect(must(anchorSets[1]).has(anchor)).toBe(true);
      expect(must(anchorSets[2]).has(anchor)).toBe(true);
    }
  });

  it("rejects a tampered claim hash, a shipped-copy mismatch, a tampered WAV and a wrong stage fingerprint", () => {
    expect(
      verify((m) => {
        editRows(m, (t) => {
          rowOf(t, "claims").content_hash = "0".repeat(64);
        });
      }),
    ).toBe("claim_hash_mismatch");
    expect(
      verify((m) => {
        editRows(m, (t) => {
          payloadOf(artifactOf(t, "writer_view")).locale = "xx";
        });
      }),
    ).toBe("artifact_payload_copy_mismatch");
    expect(
      verify((m) => {
        const name = must(
          [...m.keys()].find((n) => n.endsWith("rb01_take0.wav")),
        );
        m.set(name, Buffer.concat([must(m.get(name)), Buffer.from([0])]));
      }),
    ).toBe("audio_member_hash_mismatch");
    expect(
      verify((m) => {
        editJson(m, "gate_fingerprint_inputs.json", (d) => {
          obj(d.claims_writing).fingerprint = "0".repeat(64);
        });
      }),
    ).toBe("stage_fingerprint_mismatch");
  });

  it("rejects A1-profile violations that survive consistent re-hashing of the pack (retention_class exposed to the writer)", () => {
    const outcome = verify((m) => {
      bothCopies(m, "writer_view", "writer_view.json", (p) => {
        must(list(p.selected_evidence)[0]).retention_class = "fixture_retained";
      });
    });
    expect(outcome).toBe("writer_view_evidence_keys");
  });

  it("rejects canonically-duplicate semantic anchors inside one script version (NFC/NFD spellings)", () => {
    const nfc = String.fromCodePoint(0xe9);
    const nfd = String.fromCodePoint(0x65, 0x301);
    const outcome = verify((m) => {
      bothCopies(m, "script_pass1", "script_pass1.json", (p) => {
        const turns = list(p.turns);
        must(turns[0]).semantic_turn_id = nfc;
        must(turns[1]).semantic_turn_id = nfd;
      });
    });
    expect(outcome).toMatch(/Duplicate turn anchor/);
  });

  it("historical disposition: pinned identity only, null with its disposition, never accepted as current", () => {
    const id = FIXTURE_V046_PINS.historicalDirection.artifactId;
    expect(
      verify((m) => {
        editRows(m, (t) => {
          must(t.artifacts?.find((a) => a.artifact_id === id)).content_hash =
            "0".repeat(64);
        });
      }),
    ).toBe("historical_identity_mismatch");
    const fill = (p: Json): void => {
      p.input_fingerprint = "a".repeat(64);
    };
    expect(
      verify((m) => {
        editRows(m, (t) => {
          fill(payloadOf(must(t.artifacts?.find((a) => a.artifact_id === id))));
        });
        editJson(m, "performance_direction.json", fill);
      }),
    ).toBe("historical_null_disposition_violated");
  });

  it("the verified snapshot is deep-frozen and digest-checked; verification cannot be bypassed by a caller report", async () => {
    const fixture = VerifiedFixture.fromPack(openFixturePack());
    const accounts = must(fixture.rows.tables.accounts);
    expect(() => {
      rowOf({ accounts: [...accounts] }, "accounts").display_name = "changed";
    }).toThrow(TypeError);
    expect(() => {
      (accounts as Row[]).push({});
    }).toThrow(TypeError);
    expect(() => {
      fixture.assertUnchanged();
    }).not.toThrow();
    // persistFixture takes a pack and verifies it itself: a tampered pack fails verification before any pool use.
    const pool = {
      connect: () => {
        throw new Error("pool touched");
      },
    } as never;
    const tampered = consistentPack((m) => {
      editRows(m, (t) => {
        rowOf(t, "claims").content_hash = "0".repeat(64);
      });
    });
    await expect(persistFixture(pool, tampered)).rejects.toBeInstanceOf(
      FixtureVerificationError,
    );
  });

  it("FixtureIntegrityError carries a stable code", () => {
    expect(new FixtureIntegrityError("x").code).toBe("x");
  });
});

describe("insertion planning (pure, derived from the declared foreign-key graph)", () => {
  const rows = parseFoundationRows(openFixturePack()).tables;
  const plan = planInsertion(rows);
  const position = new Map(plan.map((p, i) => [p.row, i]));
  const at = (r: Row | undefined): number => must(position.get(must(r)));

  it("orders all 398 rows so every foreign-key parent (composite targets included) precedes its child", () => {
    expect(plan).toHaveLength(398);
    for (const family of families)
      for (const row of rows[family.table] ?? [])
        for (const fk of family.foreignKeys) {
          if (fk.columns.some((c) => row[c] === null)) continue;
          const parent = rows[fk.refTable]?.find((r) =>
            fk.refColumns.every((rc, i) => r[rc] === row[must(fk.columns[i])]),
          );
          expect(parent, `${family.table}->${fk.refTable}`).toBeDefined();
          expect(at(parent)).toBeLessThan(at(row));
        }
  });

  it("resolves the reroll cycle by row and honours the trigger-level dependencies", () => {
    const trigger = must(rows.reroll_triggers?.[0]);
    const events = must(rows.provider_call_events);
    const calls = must(rows.provider_calls);
    const sourceEvent = must(
      events.find(
        (e) =>
          e.provider_call_id === trigger.source_provider_call_id &&
          e.event_type === "succeeded",
      ),
    );
    const rerollCall = must(
      calls.find((c) => c.reroll_trigger_id === trigger.reroll_trigger_id),
    );
    const sourceCall = must(
      calls.find((c) => c.provider_call_id === trigger.source_provider_call_id),
    );
    expect(at(sourceCall)).toBeLessThan(at(sourceEvent));
    expect(at(sourceEvent)).toBeLessThan(at(trigger));
    expect(at(trigger)).toBeLessThan(at(rerollCall));
    for (const take of must(rows.render_takes)) {
      const event = must(
        events.find(
          (e) =>
            e.provider_call_id === take.provider_call_id &&
            e.event_type === "succeeded",
        ),
      );
      expect(at(event)).toBeLessThan(at(take));
    }
  });

  it("rejects dangling references, references to unloaded tables and dependency cycles", () => {
    expect(code(() => planInsertion({ ...rows, shows: [] }))).toBe(
      "dangling_reference",
    );
    const cycle = [
      {
        table: "a",
        primaryKey: ["id"],
        columns: ["id", "b"],
        jsonb: [],
        foreignKeys: [{ columns: ["b"], refTable: "b", refColumns: ["id"] }],
      },
      {
        table: "b",
        primaryKey: ["id"],
        columns: ["id", "a"],
        jsonb: [],
        foreignKeys: [{ columns: ["a"], refTable: "a", refColumns: ["id"] }],
      },
    ];
    expect(
      code(() =>
        planInsertion({ a: [{ id: 1, b: 2 }], b: [{ id: 2, a: 1 }] }, cycle),
      ),
    ).toBe("dependency_cycle");
    const external = [
      {
        table: "a",
        primaryKey: ["id"],
        columns: ["id", "x"],
        jsonb: [],
        foreignKeys: [
          { columns: ["x"], refTable: "repair_plans", refColumns: ["id"] },
        ],
      },
    ];
    expect(code(() => planInsertion({ a: [{ id: 1, x: 5 }] }, external))).toBe(
      "reference_to_unloaded_table",
    );
  });
});
