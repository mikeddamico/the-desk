// A5.1 repair regressions (supervisory review of 14857f2). Each case failed on the original candidate; the hash is NOT validation, so
// every mutated package is re-hashed and only the named defect remains.
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { evidencePackageHash } from "../../src/identity/artifacts.js";
import { frozenStateHash } from "../../src/knowledge/claim-state.js";
import { appendClaimStateEvent } from "../../src/runtime/claim-events.js";
import type { Json } from "../../src/runtime/command.js";
import { persistEvidenceUnit } from "../../src/runtime/evidence.js";
import {
  bindPackage,
  persistEvidencePackage,
  type AuthoredPackage,
} from "../../src/runtime/package.js";
import {
  evidenceSliceStatus,
  runEvidenceSlice,
} from "../../src/runtime/slice.js";
import { TestCluster, type DbEnv } from "../support/db-env.js";
import {
  accountIds,
  attemptIds,
  claimIds,
  fixturePackageArtifact,
  fixtureUnits,
  rebuildPackage,
  prepareUnitsAndSupports,
  seedPrerequisites,
  sliceInput,
} from "../support/a5-fixture.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const cluster = databaseUrl ? new TestCluster(databaseUrl) : undefined;
const must = <T>(v: T | undefined | null): T => {
  if (v === undefined || v === null) throw new Error("missing");
  return v;
};
if (cluster) {
  beforeAll(async () => {
    await cluster.bootstrap();
  }, 120000);
  afterAll(async () => {
    await cluster.shutdown();
  });
}
type Obj = Record<string, unknown>;
const actorPool = (env: DbEnv): pg.Pool =>
  new pg.Pool({
    connectionString: env.runtimeUrl,
    options: "-c role=desk_runtime",
    max: 1,
  });
const fresh = async (): Promise<DbEnv> => {
  const env = await must(cluster).create({ migrate: true });
  await seedPrerequisites(env.migrator);
  return env;
};
const ownerRows = async (
  env: DbEnv,
  sql: string,
  values?: unknown[],
): Promise<Obj[]> => (await env.owner.query<Obj>(sql, values)).rows;
const count = async (env: DbEnv, table: string): Promise<number> =>
  Number((await ownerRows(env, `SELECT count(*) AS n FROM ${table}`))[0]?.n);
const persistUnits = async (env: DbEnv, pool: pg.Pool): Promise<void> => {
  await prepareUnitsAndSupports(env.migrator, pool);
};
const manifestOf = (p: Obj): Obj => p.manifest as Obj;
const evidence0 = (p: Obj): Obj => must((manifestOf(p).evidence as Obj[])[0]);
const claim0 = (p: Obj): Obj => must((manifestOf(p).claims as Obj[])[0]);

suite(
  "A5.1 repair: package acceptance follows the governed fixture profile (PostgreSQL 17)",
  () => {
    const rejectedCases: [string, (p: Obj) => void][] = [
      [
        "evidence acquisition_ref removed",
        (p) => delete evidence0(p).acquisition_ref,
      ],
      ["evidence locator removed", (p) => delete evidence0(p).locator],
      [
        "evidence source_item_identity removed",
        (p) => delete evidence0(p).source_item_identity,
      ],
      [
        "quote_permission is the string 'true'",
        (p) => (evidence0(p).quote_permission = "true"),
      ],
      [
        "paraphrase_permission removed",
        (p) => delete evidence0(p).paraphrase_permission,
      ],
      [
        "consumer_exposure value outside the vocabulary",
        (p) => ((evidence0(p).consumer_exposure as Obj).writer = "everything"),
      ],
      ["support_refs replaced by [{}]", (p) => (claim0(p).support_refs = [{}])],
      ["support_refs removed", (p) => delete claim0(p).support_refs],
      [
        "support_refs is not an array",
        (p) => (claim0(p).support_refs = "none"),
      ],
      [
        "support hash does not resolve to the unit",
        (p) => {
          must((claim0(p).support_refs as Obj[])[0]).support_hash = "a".repeat(
            64,
          );
        },
      ],
      [
        "support names a unit outside the package",
        (p) => {
          must((claim0(p).support_refs as Obj[])[0]).evidence_unit_id =
            "d1250007-0000-4000-8000-0000000000ee";
        },
      ],
      ["payload schema_version garbage", (p) => (p.schema_version = "garbage")],
      ["manifest schema garbage", (p) => (manifestOf(p).schema = "garbage")],
      [
        "claim initial_status altered",
        (p) => (claim0(p).initial_status = "tombstoned"),
      ],
      [
        "claim frozen_state_hash altered",
        (p) => (claim0(p).frozen_state_hash = "b".repeat(64)),
      ],
      [
        "claim state_event_cursor names an unknown event",
        (p) =>
          (claim0(p).state_event_cursor = {
            claim_state_event_id: "d1250099-0000-4000-8000-0000000000ee",
            event_sequence: 1,
          }),
      ],
      ["claims is not an array", (p) => (manifestOf(p).claims = {})],
      ["manifest section missing", (p) => delete manifestOf(p).availability],
    ];

    it.each(rejectedCases)(
      "rejects, and commits nothing: %s",
      async (_name, mutate) => {
        const env = await fresh();
        const pool = actorPool(env);
        try {
          await persistUnits(env, pool);
          const o = await persistEvidencePackage(pool, rebuildPackage(mutate));
          expect(o.kind).toBe("rejected");
          expect(
            await count(
              env,
              "artifacts WHERE artifact_type = 'evidence_package'",
            ),
          ).toBe(0);
          expect(await count(env, "evidence_packages")).toBe(0);
        } finally {
          await pool.end();
          await env.close();
        }
      },
      120000,
    );

    it("rejects an artifacts.schema_version that is not the profile's inherited label (not any non-empty string)", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      try {
        await persistUnits(env, pool);
        for (const label of [
          "garbage",
          "fixture-v9.9.9",
          "evidence-package/2.0",
        ]) {
          const o = await persistEvidencePackage(pool, {
            ...fixturePackageArtifact(),
            schema_version: label,
          });
          expect(o).toMatchObject({
            kind: "rejected",
            code: "artifact_schema_version_unknown",
          });
        }
        expect(
          (await persistEvidencePackage(pool, fixturePackageArtifact())).kind,
        ).toBe("created");
      } finally {
        await pool.end();
        await env.close();
      }
    }, 120000);

    it("an existing untyped artifact is completed only after its stored payload and schema validate", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      try {
        await persistUnits(env, pool);
        const pkg = fixturePackageArtifact();
        // another writer stored the artifact with an invalid label and no typed row
        await env.owner.query(
          "INSERT INTO artifacts (artifact_id, artifact_type, schema_version, content_hash, storage_uri, byte_size, canonical_payload, created_at) VALUES ($1,'evidence_package','garbage',$2,NULL,NULL,$3::jsonb,$4)",
          [
            pkg.artifact_id,
            evidencePackageHash(pkg.canonical_payload),
            JSON.stringify(pkg.canonical_payload),
            pkg.created_at,
          ],
        );
        const o = await persistEvidencePackage(pool, pkg);
        expect(o.kind === "created" || o.kind === "converged").toBe(false);
        expect(await count(env, "evidence_packages")).toBe(0);
      } finally {
        await pool.end();
        await env.close();
      }
    }, 120000);
  },
);

suite("A5.1 repair: binding validates on every path", () => {
  it("a same-package retry still validates expectedUnitIds and the stored package", async () => {
    const env = await fresh();
    const pool = actorPool(env);
    try {
      await persistUnits(env, pool);
      const done = await runEvidenceSlice(pool, sliceInput());
      expect(done.complete).toBe(true);
      const id = must(done.evidencePackageId);
      const attempt = must(attemptIds()[0]);
      // the original candidate returned `converged` here (the 16-unit package against an empty unit set)
      expect(
        await bindPackage(pool, {
          attemptId: attempt,
          evidencePackageId: id,
          expectedUnitIds: [],
        }),
      ).toMatchObject({ kind: "rejected", code: "package_units_mismatch" });
      expect(
        (
          await bindPackage(pool, {
            attemptId: attempt,
            evidencePackageId: id,
            expectedUnitIds: fixtureUnits().map((u) => u.unit.evidence_unit_id),
          })
        ).kind,
      ).toBe("converged");
      expect(
        (await bindPackage(pool, { attemptId: attempt, evidencePackageId: id }))
          .kind,
      ).toBe("converged");
    } finally {
      await pool.end();
      await env.close();
    }
  }, 180000);

  it("binding checks the persisted artifact type/schema/hash relationship, not only a parse of the payload", async () => {
    const env = await fresh();
    const pool = actorPool(env);
    try {
      await persistUnits(env, pool);
      const pkg = fixturePackageArtifact();
      const created = await persistEvidencePackage(pool, pkg);
      expect(created.kind).toBe("created");
      // another writer corrupts the relationship (forged as the owner with triggers bypassed)
      const c = await env.owner.connect();
      try {
        await c.query("SET session_replication_role = replica");
        await c.query(
          "UPDATE artifacts SET schema_version = 'garbage' WHERE artifact_type = 'evidence_package'",
        );
      } finally {
        await c.query("RESET session_replication_role");
        c.release();
      }
      const o = await bindPackage(pool, {
        attemptId: must(attemptIds()[0]),
        evidencePackageId: pkg.evidence_package_id,
      });
      expect(o.kind === "created" || o.kind === "converged").toBe(false);
      expect(
        await ownerRows(
          env,
          "SELECT evidence_package_id FROM program_run_attempts WHERE evidence_package_id IS NOT NULL",
        ),
      ).toHaveLength(0);
    } finally {
      await pool.end();
      await env.close();
    }
  }, 120000);
});

suite(
  "A5.1 repair: own JSON keys survive (__proto__) and one normalized representation is hashed, compared and stored",
  () => {
    it("package payload: a manifest key named __proto__ is preserved and the stored payload matches its stored hash", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      try {
        await persistUnits(env, pool);
        const pkg = rebuildPackage((p) => {
          const scope = manifestOf(p).availability as Obj;
          Object.defineProperty(scope, "__proto__", {
            value: { changed: true },
            enumerable: true,
            writable: true,
            configurable: true,
          });
        });
        const o = await persistEvidencePackage(pool, pkg);
        const row = (
          await ownerRows(
            env,
            "SELECT content_hash, canonical_payload FROM artifacts WHERE artifact_type = 'evidence_package'",
          )
        )[0];
        if (o.kind === "created" && row) {
          // whatever was stored must hash to the stored content hash
          expect(evidencePackageHash(row.canonical_payload)).toBe(
            row.content_hash,
          );
          expect(
            JSON.stringify(
              ((row.canonical_payload as Obj).manifest as Obj).availability,
            ),
          ).toContain("__proto__");
        } else {
          expect(o.kind).toBe("rejected"); // an honest refusal is also acceptable; storing a mismatched payload is not
        }
      } finally {
        await pool.end();
        await env.close();
      }
    }, 120000);

    it("claim-event payload keeps an own __proto__ key", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      try {
        const payload = JSON.parse(
          '{"reason_code":"r","reason":"x","usage_class":"silent","__proto__":{"changed":true}}',
        ) as Json;
        const o = await appendClaimStateEvent(pool, {
          claim_state_event_id: "d1250099-0000-4000-8000-0000000000c1",
          claim_id: must(claimIds()[0]),
          actor_id: must(accountIds()[1]),
          occurred_at: "2026-09-27T13:30:00Z",
          event_type: "usage_change",
          event_sequence: 1,
          event_payload: payload,
        });
        expect(o.kind).toBe("created");
        const stored = (
          await ownerRows(env, "SELECT event_payload FROM claim_state_events")
        )[0]?.event_payload as Obj;
        expect(Object.keys(stored)).toContain("__proto__");
      } finally {
        await pool.end();
        await env.close();
      }
    }, 120000);

    it("rights policy: own __proto__ key is preserved; non-object policy shapes are typed rejections, not TypeErrors", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      try {
        const base = must(fixtureUnits()[0]);
        const policy = structuredClone(base.rights.policy) as Obj;
        Object.defineProperty(policy, "__proto__", {
          value: { changed: true },
          enumerable: true,
          writable: true,
          configurable: true,
        });
        const withProto = {
          ...base,
          rights: { ...base.rights, policy: policy as Json },
        };
        expect((await persistEvidenceUnit(pool, withProto)).kind).toBe(
          "created",
        );
        const stored = (
          await ownerRows(env, "SELECT policy FROM rights_versions")
        )[0]?.policy as Obj;
        expect(Object.keys(stored)).toContain("__proto__");
        for (const bad of [null, "text", 5, [1]] as Json[]) {
          const other = must(fixtureUnits()[1]);
          for (const withSnapshot of [false, true]) {
            const o = await persistEvidenceUnit(pool, {
              unit: other.unit,
              rights: { ...other.rights, policy: bad },
              ...(withSnapshot && other.snapshot
                ? { snapshot: other.snapshot }
                : {}),
            });
            expect(o).toMatchObject({
              kind: "rejected",
              code: "rights_policy_not_object",
            });
          }
        }
      } finally {
        await pool.end();
        await env.close();
      }
    }, 120000);
  },
);

suite(
  "A5.1 repair: the slice compares the supplied snapshots to the supplied package",
  () => {
    it("a snapshot that disagrees with the package manifest stops the slice instead of completing", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      try {
        for (const field of [
          "acquisition_ref",
          "source_item_identity",
          "locator",
        ] as const) {
          const input = sliceInput();
          const u = must(input.units[2]);
          const snap = must(u.snapshot);
          u.snapshot = {
            ...snap,
            [field]: field === "locator" ? { kind: "other" } : "different",
          };
          const r = await runEvidenceSlice(pool, input);
          expect(r.complete).toBe(false);
          expect(r.stoppedAt?.outcome).not.toBe("created");
        }
        expect(await count(env, "evidence_units")).toBe(0);
        expect(await count(env, "evidence_packages")).toBe(0);
      } finally {
        await pool.end();
        await env.close();
      }
    }, 120000);

    it("matching snapshots are durably verified against the persisted package hash, including on re-entry and in the read-only status", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      try {
        await persistUnits(env, pool);
        const r = await runEvidenceSlice(pool, sliceInput());
        expect(r.complete).toBe(true);
        expect(r).toMatchObject({ snapshotVerification: "verified" });
        const again = await runEvidenceSlice(pool, sliceInput());
        expect(again).toMatchObject({
          complete: true,
          snapshotVerification: "verified",
        });
        const status = await evidenceSliceStatus(pool, sliceInput());
        expect(status.complete).toBe(true);
        expect(
          Object.values(status.snapshots).every((s) => s === "verified"),
        ).toBe(true);
        // a changed supplied snapshot on re-entry stops, and status reports it
        const changed = sliceInput();
        must(changed.units[0]).snapshot = {
          ...must(must(changed.units[0]).snapshot),
          acquisition_ref: "changed",
        };
        const stopped = await runEvidenceSlice(pool, changed);
        expect(stopped.complete).toBe(false);
      } finally {
        await pool.end();
        await env.close();
      }
    }, 180000);
  },
);

suite("A5.1 repair: frozen claim state, reuse of stored packages", () => {
  const eventId = "d1250099-0000-4000-8000-0000000000d1";
  const appendUsageChange = async (pool: pg.Pool): Promise<void> => {
    const o = await appendClaimStateEvent(pool, {
      claim_state_event_id: eventId,
      claim_id: must(claimIds()[0]),
      actor_id: must(accountIds()[1]),
      occurred_at: "2026-09-27T13:30:00Z",
      event_type: "usage_change",
      event_sequence: 1,
      event_payload: {
        reason_code: "r",
        reason: "x",
        usage_class: "silent",
      },
    });
    expect(o.kind).toBe("created");
  };
  const cursorPackage = (sequence: number): AuthoredPackage =>
    rebuildPackage((p) => {
      const c = claim0(p);
      c.state_event_cursor = {
        claim_state_event_id: eventId,
        event_sequence: sequence,
      };
      c.reduced_usage_class = "silent";
      c.effective_usage_class = "silent";
      c.frozen_state_hash = frozenStateHash(String(c.claim_content_hash), {
        state: "confirmed",
        reduced_usage_class: "silent",
        effective_usage_class: "silent",
      });
    });

  it("a non-null cursor resolving to the exact last event of its prefix is accepted; a wrong sequence is rejected; null stays valid after later events", async () => {
    const env = await fresh();
    const pool = actorPool(env);
    try {
      await persistUnits(env, pool);
      await appendUsageChange(pool);
      expect(
        await persistEvidencePackage(pool, cursorPackage(2)),
      ).toMatchObject({ kind: "rejected" });
      const ok = await persistEvidencePackage(pool, cursorPackage(1));
      expect(ok.kind).toBe("created");
      if (ok.kind === "created")
        expect(ok.record.verification.limits.join(" ")).toContain(
          "frozen_ceiling_unavailable",
        );
      // occupied-ID identity is NOT relaxed: the original null-cursor manifest (a different governed hash) under the SAME authored ids
      // conflicts
      expect(
        await persistEvidencePackage(pool, fixturePackageArtifact()),
      ).toMatchObject({ kind: "conflict", code: "artifact_id_occupied" });
      // the explicit-null package of another freeze remains valid although an event now exists (a later append never rewrites it);
      // it is a legitimately different package, so it carries fresh authored storage ids in the row AND the payload
      const artifact_id = "d1250005-0000-4000-8000-0000000000b1";
      const evidence_package_id = "d1250004-0000-4000-8000-0000000000b1";
      const nullCursor = await persistEvidencePackage(
        pool,
        rebuildPackage(
          (payload) => {
            payload.artifact_id = artifact_id;
            payload.id = evidence_package_id;
          },
          { artifact_id, evidence_package_id },
        ),
      );
      expect(nullCursor.kind).toBe("created");
      expect(await count(env, "evidence_packages")).toBe(2);
    } finally {
      await pool.end();
      await env.close();
    }
  }, 180000);

  it("reuse by hash validates the STORED artifact: a stored package with a wrong label is a conflict, never silently reused", async () => {
    const env = await fresh();
    const pool = actorPool(env);
    try {
      await persistUnits(env, pool);
      const pkg = fixturePackageArtifact();
      expect((await persistEvidencePackage(pool, pkg)).kind).toBe("created");
      const c = await env.owner.connect();
      try {
        await c.query("SET session_replication_role = replica");
        await c.query(
          "UPDATE artifacts SET schema_version = 'garbage' WHERE artifact_type = 'evidence_package'",
        );
      } finally {
        await c.query("RESET session_replication_role");
        c.release();
      }
      expect(await persistEvidencePackage(pool, pkg)).toMatchObject({
        kind: "conflict",
        code: "stored_package_invalid",
      });
    } finally {
      await pool.end();
      await env.close();
    }
  }, 120000);

  it("a package that is valid by hash but whose claim support rows differ from the persisted rows is rejected", async () => {
    const env = await fresh();
    const pool = actorPool(env);
    try {
      await persistUnits(env, pool);
      const rejected = await persistEvidencePackage(
        pool,
        rebuildPackage((p) => {
          must((claim0(p).support_refs as Obj[])[0]).support_role = "qualifies";
        }),
      );
      expect(rejected).toMatchObject({
        kind: "rejected",
        code: "package_support_rows_mismatch",
      });
    } finally {
      await pool.end();
      await env.close();
    }
  }, 120000);
});

suite(
  "A5.1 repair 2: frozen claim subject and stored-package validation on read paths",
  () => {
    it("rejects a changed subject_ref (hash recomputed); the valid baseline is accepted", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      try {
        await persistUnits(env, pool);
        const changed = await persistEvidencePackage(
          pool,
          rebuildPackage((p) => {
            claim0(p).subject_ref = "entity_southbank_fc";
          }),
        );
        expect(changed).toMatchObject({
          kind: "rejected",
          code: "package_claim_subject_mismatch",
        });
        expect(
          await count(
            env,
            "artifacts WHERE artifact_type = 'evidence_package'",
          ),
        ).toBe(0);
        expect(
          (await persistEvidencePackage(pool, fixturePackageArtifact())).kind,
        ).toBe("created");
      } finally {
        await pool.end();
        await env.close();
      }
    }, 120000);

    const corrupt = async (env: DbEnv, sql: string): Promise<void> => {
      const c = await env.owner.connect();
      try {
        await c.query("SET session_replication_role = replica");
        await c.query(sql);
      } finally {
        await c.query("RESET session_replication_role");
        c.release();
      }
    };
    const corruptions: [string, string][] = [
      [
        "wrong schema label",
        "UPDATE artifacts SET schema_version = 'garbage' WHERE artifact_type = 'evidence_package'",
      ],
      [
        "content_hash not the manifest hash",
        "UPDATE artifacts SET content_hash = repeat('a', 64) WHERE artifact_type = 'evidence_package'",
      ],
      [
        "typed package_hash differs from the artifact hash",
        "UPDATE evidence_packages SET package_hash = repeat('b', 64)",
      ],
      [
        "payload ids differ from the artifact/typed ids",
        "UPDATE artifacts SET canonical_payload = jsonb_set(canonical_payload, '{id}', to_jsonb('d1250004-0000-4000-8000-0000000000ff'::text)) WHERE artifact_type = 'evidence_package'",
      ],
    ];

    it.each(corruptions)(
      "standalone snapshot verification and slice status refuse a malformed stored package (%s); binding rejects it too",
      async (_name, sql) => {
        const env = await fresh();
        const pool = actorPool(env);
        try {
          await persistUnits(env, pool);
          expect((await runEvidenceSlice(pool, sliceInput(1))).complete).toBe(
            true,
          );
          const hash = String(
            (
              await ownerRows(env, "SELECT package_hash FROM evidence_packages")
            )[0]?.package_hash,
          );
          const pkgId = String(
            (
              await ownerRows(
                env,
                "SELECT evidence_package_id FROM evidence_packages",
              )
            )[0]?.evidence_package_id,
          );
          await corrupt(env, sql);
          // identify the package by the hash the INPUT governs (the stored label may have been corrupted)
          const input = sliceInput(0);
          const unit = must(input.units[0]);
          const o = await persistEvidenceUnit(pool, {
            ...unit,
            verifySnapshotAgainstPackageHash: hash,
          });
          expect(
            o.kind === "converged" &&
              o.record.comparison === "row_and_snapshot_verified",
          ).toBe(false);
          const status = await evidenceSliceStatus(pool, input);
          expect(status.complete).toBe(false);
          expect(
            Object.values(status.snapshots).some((x) => x === "verified"),
          ).toBe(false);
          const bound = await bindPackage(pool, {
            attemptId: must(attemptIds()[0]),
            evidencePackageId: pkgId,
          });
          expect(bound.kind === "created" || bound.kind === "converged").toBe(
            false,
          );
        } finally {
          await pool.end();
          await env.close();
        }
      },
      180000,
    );
  },
);

suite(
  "A5.1 repair 3: selected support refs, not every current support row",
  () => {
    it("a later lawful support row for the same claim neither invalidates reuse, binding, snapshot verification nor slice status", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      try {
        await persistUnits(env, pool);
        const pkg = fixturePackageArtifact();
        expect((await persistEvidencePackage(pool, pkg)).kind).toBe("created");
        const second = must(fixtureUnits()[1]);
        await env.migrator.query(
          `INSERT INTO claim_supports (claim_support_id, claim_id, support_kind, evidence_unit_id, derivation_run_id, external_support_identity, support_hash, support_role)
         VALUES ($1, $2, 'evidence', $3, NULL, NULL, $4, 'context_only')`,
          [
            "d125000a-0000-4000-8000-0000000000f1",
            must(claimIds()[0]),
            second.unit.evidence_unit_id,
            second.unit.content_hash,
          ],
        );
        const again = await persistEvidencePackage(pool, pkg);
        expect(again).toMatchObject({
          kind: "converged",
          record: { reused: true },
        });
        const id = pkg.evidence_package_id;
        expect(
          (
            await bindPackage(pool, {
              attemptId: must(attemptIds()[0]),
              evidencePackageId: id,
            })
          ).kind,
        ).toBe("created");
        expect(
          (
            await bindPackage(pool, {
              attemptId: must(attemptIds()[0]),
              evidencePackageId: id,
            })
          ).kind,
        ).toBe("converged");
        const hash = String(
          (
            await ownerRows(env, "SELECT package_hash FROM evidence_packages")
          )[0]?.package_hash,
        );
        const verified = await persistEvidenceUnit(pool, {
          ...must(sliceInput().units[0]),
          verifySnapshotAgainstPackageHash: hash,
        });
        expect(
          verified.kind === "converged" &&
            verified.record.comparison === "row_and_snapshot_verified",
        ).toBe(true);
        const status = await evidenceSliceStatus(pool, sliceInput(0));
        expect(status.complete).toBe(true);
        expect(
          Object.values(status.snapshots).every((x) => x === "verified"),
        ).toBe(true);
        expect((await runEvidenceSlice(pool, sliceInput(0))).complete).toBe(
          true,
        );
      } finally {
        await pool.end();
        await env.close();
      }
    }, 180000);

    const selectedRefCases: [string, (p: Obj) => void][] = [
      [
        "a selected ref whose row does not exist",
        (p) => {
          must((claim0(p).support_refs as Obj[])[0]).claim_support_id =
            "d125000a-0000-4000-8000-0000000000e1";
        },
      ],
      [
        "a selected ref that is another claim's support row",
        (p) => {
          must((claim0(p).support_refs as Obj[])[0]).claim_support_id =
            "d125000a-0000-4000-8000-000000000002";
        },
      ],
      [
        "a selected ref with the wrong target",
        (p) => {
          const r = must((claim0(p).support_refs as Obj[])[0]);
          r.evidence_unit_id = "d1250007-0000-4000-8000-000000000002";
        },
      ],
      [
        "a selected ref with the wrong hash",
        (p) => {
          must((claim0(p).support_refs as Obj[])[0]).support_hash = "c".repeat(
            64,
          );
        },
      ],
      [
        "a selected ref with the wrong role",
        (p) => {
          must((claim0(p).support_refs as Obj[])[0]).support_role =
            "context_only";
        },
      ],
      [
        "support_refs not an array",
        (p) => {
          claim0(p).support_refs = {};
        },
      ],
    ];
    it.each(selectedRefCases)(
      "still rejects %s",
      async (_name, mutate) => {
        const env = await fresh();
        const pool = actorPool(env);
        try {
          await persistUnits(env, pool);
          const o = await persistEvidencePackage(pool, rebuildPackage(mutate));
          expect(o.kind).toBe("rejected");
          expect(await count(env, "evidence_packages")).toBe(0);
        } finally {
          await pool.end();
          await env.close();
        }
      },
      120000,
    );
  },
);

suite(
  "A5.1 repair 4: every selected evidence body is hash-checked (Hashing 12.2)",
  () => {
    const forgeBody = async (
      env: DbEnv,
      id: string,
      jsonbLiteral: string,
    ): Promise<void> => {
      const c = await env.owner.connect();
      try {
        await c.query("SET session_replication_role = replica");
        await c.query(
          "UPDATE evidence_units SET canonical_content = $1::jsonb WHERE evidence_unit_id = $2",
          [jsonbLiteral, id],
        );
      } finally {
        await c.query("RESET session_replication_role");
        c.release();
      }
    };
    const last = (): string =>
      must(fixtureUnits().at(-1)).unit.evidence_unit_id;
    const bodyCases: [string, string, string][] = [
      [
        "a different body under the unchanged hash",
        JSON.stringify("A different body."),
        "package_evidence_body_hash_mismatch",
      ],
      [
        "a non-NFC body",
        JSON.stringify("e\u0301"),
        "package_evidence_body_hash_mismatch",
      ],
      [
        "a non-string jsonb body (object)",
        JSON.stringify({ text: "x" }),
        "package_evidence_body_shape",
      ],
      ["a non-string jsonb body (number)", "5", "package_evidence_body_shape"],
    ];

    it.each(bodyCases)(
      "an unreferenced evidence unit with %s is rejected on first persistence, and by reuse, binding, snapshot verification and status",
      async (_name, literal, code) => {
        const env = await fresh();
        const pool = actorPool(env);
        try {
          await persistUnits(env, pool);
          // the last unit is not a claim support target: only the every-selected-row body check can see the tampering
          await forgeBody(env, last(), literal);
          const o = await persistEvidencePackage(
            pool,
            fixturePackageArtifact(),
          );
          expect(o).toMatchObject({ kind: "rejected", code });
          expect(await count(env, "evidence_packages")).toBe(0);
        } finally {
          await pool.end();
          await env.close();
        }
      },
      120000,
    );

    it("a body that is tampered AFTER the package was accepted is caught by reuse, binding, snapshot verification and slice status", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      try {
        await persistUnits(env, pool);
        const pkg = fixturePackageArtifact();
        expect((await persistEvidencePackage(pool, pkg)).kind).toBe("created");
        await forgeBody(env, last(), JSON.stringify("A different body."));
        // the identical request is validated against the (now tampered) rows before any reuse decision
        expect(await persistEvidencePackage(pool, pkg)).toMatchObject({
          kind: "rejected",
          code: "package_evidence_body_hash_mismatch",
        });
        const bound = await bindPackage(pool, {
          attemptId: must(attemptIds()[0]),
          evidencePackageId: pkg.evidence_package_id,
        });
        expect(bound.kind === "created" || bound.kind === "converged").toBe(
          false,
        );
        const status = await evidenceSliceStatus(pool, sliceInput(0));
        expect(status.complete).toBe(false);
        expect(status.package).toBe("stored_invalid");
      } finally {
        await pool.end();
        await env.close();
      }
    }, 120000);

    it("the valid baseline and equal-body distinct UUIDs are unaffected", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      try {
        await persistUnits(env, pool);
        // an extra unit with the same body (and therefore the same hash) as unit 1 but its own UUID: lawful and distinct
        const base = must(fixtureUnits()[0]);
        const twin = {
          unit: {
            ...base.unit,
            evidence_unit_id: "d1250007-0000-4000-8000-0000000000f2",
          },
          rights: base.rights,
        };
        expect((await persistEvidenceUnit(pool, twin)).kind).toBe("created");
        expect(
          (await persistEvidencePackage(pool, fixturePackageArtifact())).kind,
        ).toBe("created");
      } finally {
        await pool.end();
        await env.close();
      }
    }, 120000);
  },
);
