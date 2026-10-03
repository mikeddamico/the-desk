import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { persistEvidenceUnit } from "../../src/runtime/evidence.js";
import {
  bindPackage,
  parsePackage,
  persistEvidencePackage,
} from "../../src/runtime/package.js";
import { evidenceSliceStatus } from "../../src/runtime/slice.js";
import type { Json } from "../../src/runtime/command.js";
import { TestCluster, type DbEnv } from "../support/db-env.js";
import {
  alternatePackage,
  attemptIds,
  fixturePackageArtifact,
  fixtureUnits,
  prepareUnitsAndSupports,
  rebuildPackage,
  seedPrerequisites,
  sliceInput,
} from "../support/a5-fixture.js";
import { observe, withChild } from "../support/a5-crash.js";
import { backendPid, waitForBlocked } from "../support/pg-wait.js";
import { runSliceObserved } from "../support/a6-observed.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const cluster = databaseUrl ? new TestCluster(databaseUrl) : undefined;
const must = <T>(v: T | undefined): T => {
  if (v === undefined) throw new Error("missing");
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
): Promise<Record<string, unknown>[]> =>
  (await env.owner.query<Record<string, unknown>>(sql, values)).rows;
const count = async (env: DbEnv, table: string): Promise<number> =>
  Number((await ownerRows(env, `SELECT count(*) AS n FROM ${table}`))[0]?.n);
const idle = (pool: pg.Pool): boolean =>
  pool.totalCount === pool.idleCount && pool.waitingCount === 0;
const persistUnits = async (env: DbEnv, pool: pg.Pool): Promise<void> => {
  await prepareUnitsAndSupports(env.migrator, pool);
};
/** Runs statements as the database owner with user triggers bypassed (session_replication_role = replica): simulates another writer / tampering. */
const forge = async (
  env: DbEnv,
  statements: [string, unknown[]?][],
): Promise<void> => {
  const c = await env.owner.connect();
  try {
    await c.query("SET session_replication_role = replica");
    for (const [sql, values] of statements) await c.query(sql, values);
  } finally {
    await c.query("RESET session_replication_role").catch(() => undefined);
    c.release();
  }
};
const unitIds = (): string[] =>
  fixtureUnits().map((u) => u.unit.evidence_unit_id);
const attemptBinding = async (env: DbEnv, i = 0): Promise<string | null> =>
  ((
    await ownerRows(
      env,
      "SELECT evidence_package_id::text AS b FROM program_run_attempts WHERE attempt_id = $1",
      [attemptIds()[i]],
    )
  )[0]?.b as string | undefined) ?? null;
/** The durable end state of the slice, comparable across databases. */
const endState = async (env: DbEnv): Promise<unknown> => ({
  units: (
    await env.owner.query(
      "SELECT evidence_unit_id, content_hash, evidence_type, usage_class, canonical_content, rights_version_id, supersedes_evidence_unit_id, created_at FROM evidence_units ORDER BY 1",
    )
  ).rows,
  rights: (await env.owner.query("SELECT * FROM rights_versions ORDER BY 1"))
    .rows,
  artifacts: (await env.owner.query("SELECT * FROM artifacts ORDER BY 1")).rows,
  packages: (
    await env.owner.query("SELECT * FROM evidence_packages ORDER BY 1")
  ).rows,
  binding: await attemptBinding(env),
});

suite(
  "A5.1 package persistence, binding and the bounded slice (PostgreSQL 17, runtime role)",
  () => {
    it("K1: package persistence by governed hash; reuse returns the existing ids even when execution metadata and authored ids differ", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      try {
        await persistUnits(env, pool);
        const pkg = fixturePackageArtifact();
        const a = await persistEvidencePackage(pool, pkg);
        expect(a.kind).toBe("created");
        const b = await persistEvidencePackage(pool, pkg);
        expect(b).toMatchObject({
          kind: "converged",
          record: { reused: true },
        });
        // same manifest, different execution metadata and different authored ids: reused by hash, original ids returned
        const meta = structuredClone(pkg);
        const payload = meta.canonical_payload as Record<string, Json>;
        payload.created_at = "2030-01-01T00:00:00Z";
        payload.frozen_at = "2030-01-01T00:00:05Z";
        payload.selector_run_id = "d1250004-0000-4000-8000-0000000000ee";
        payload.artifact_id = "d1250005-0000-4000-8000-0000000000ee";
        payload.id = "d1250004-0000-4000-8000-0000000000ee";
        meta.artifact_id = "d1250005-0000-4000-8000-0000000000ee";
        meta.evidence_package_id = "d1250004-0000-4000-8000-0000000000ee";
        const c = await persistEvidencePackage(pool, meta);
        expect(c).toMatchObject({
          kind: "converged",
          record: {
            reused: true,
            artifact_id: pkg.artifact_id,
            evidence_package_id: pkg.evidence_package_id,
          },
        });
        expect(
          await count(
            env,
            "artifacts WHERE artifact_type = 'evidence_package'",
          ),
        ).toBe(1);
        expect(await count(env, "evidence_packages")).toBe(1);
        // the package is stored exactly as authored (schema_version etc. are the caller's, not defaults)
        const row = (
          await ownerRows(
            env,
            "SELECT schema_version, storage_uri, byte_size FROM artifacts WHERE artifact_type = 'evidence_package'",
          )
        )[0];
        expect(row).toEqual({
          schema_version: pkg.schema_version,
          storage_uri: pkg.storage_uri,
          byte_size: pkg.byte_size,
        });
        expect(idle(pool)).toBe(true);
      } finally {
        await pool.end();
        await env.close();
      }
    }, 180000);

    it("K1b: concurrent persistence from independent sessions: one artifact and one package row; the loser converges; the loser's wait is observed", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      const pools = [0, 1, 2, 3].map(() => actorPool(env));
      try {
        await persistUnits(env, pool);
        const outcomes = await Promise.all(
          pools.map((p) => persistEvidencePackage(p, fixturePackageArtifact())),
        );
        expect(outcomes.filter((o) => o.kind === "created")).toHaveLength(1);
        expect(outcomes.filter((o) => o.kind === "converged")).toHaveLength(3);
        expect(
          await count(
            env,
            "artifacts WHERE artifact_type = 'evidence_package'",
          ),
        ).toBe(1);
        expect(await count(env, "evidence_packages")).toBe(1);
        expect(pools.every(idle)).toBe(true);
        // observed wait: a second session blocks on an uncommitted competitor artifact
        const env2 = await fresh();
        const p2 = actorPool(env2);
        const holder = await env2.owner.connect();
        try {
          await persistUnits(env2, p2);
          const pkg = fixturePackageArtifact();
          const hash = (outcomes[0] as { record: { package_hash: string } })
            .record.package_hash;
          await holder.query("BEGIN");
          await holder.query(
            "INSERT INTO artifacts (artifact_id, artifact_type, schema_version, content_hash, storage_uri, byte_size, canonical_payload, created_at) VALUES ($1,'evidence_package',$2,$3,NULL,NULL,$4::jsonb,$5)",
            [
              pkg.artifact_id,
              pkg.schema_version,
              hash,
              JSON.stringify(pkg.canonical_payload),
              pkg.created_at,
            ],
          );
          await holder.query(
            "INSERT INTO evidence_packages (evidence_package_id, artifact_id, package_hash) VALUES ($1,$2,$3)",
            [pkg.evidence_package_id, pkg.artifact_id, hash],
          );
          const holderPid = await backendPid(holder);
          const pending = persistEvidencePackage(p2, {
            ...pkg,
            artifact_id: "d1250005-0000-4000-8000-0000000000dd",
            evidence_package_id: "d1250004-0000-4000-8000-0000000000dd",
            canonical_payload: {
              ...(pkg.canonical_payload as object),
              artifact_id: "d1250005-0000-4000-8000-0000000000dd",
              id: "d1250004-0000-4000-8000-0000000000dd",
            },
          });
          await waitForBlocked(env2.owner, env2.name, (w) =>
            w.some((x) => x.blockers.includes(holderPid)),
          );
          await holder.query("COMMIT");
          const o = await pending;
          expect(o).toMatchObject({
            kind: "converged",
            record: { reused: true, artifact_id: pkg.artifact_id },
          });
          expect(
            await count(
              env2,
              "artifacts WHERE artifact_type = 'evidence_package'",
            ),
          ).toBe(1);
        } finally {
          holder.release();
          await p2.end();
          await env2.close();
        }
      } finally {
        await Promise.all([pool.end(), ...pools.map((p) => p.end())]);
        await env.close();
      }
    }, 240000);

    it("K1c: the winner rolls back - the waiting loser then creates the package itself", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      const holder = await env.owner.connect();
      try {
        await persistUnits(env, pool);
        const pkg = fixturePackageArtifact();
        const hash = parsePackage(pkg).hash;
        await forge(env, [
          ["DELETE FROM evidence_packages"],
          ["DELETE FROM artifacts WHERE artifact_type = 'evidence_package'"],
        ]);
        await holder.query("BEGIN");
        await holder.query(
          "INSERT INTO artifacts (artifact_id, artifact_type, schema_version, content_hash, storage_uri, byte_size, canonical_payload, created_at) VALUES ($1,'evidence_package',$2,$3,NULL,NULL,$4::jsonb,$5)",
          [
            "d1250005-0000-4000-8000-0000000000cc",
            pkg.schema_version,
            hash,
            JSON.stringify(pkg.canonical_payload),
            pkg.created_at,
          ],
        );
        const holderPid = await backendPid(holder);
        const pending = persistEvidencePackage(pool, pkg);
        await waitForBlocked(env.owner, env.name, (w) =>
          w.some((x) => x.blockers.includes(holderPid)),
        );
        await holder.query("ROLLBACK");
        expect((await pending).kind).toBe("created");
        expect(
          await count(
            env,
            "artifacts WHERE artifact_type = 'evidence_package'",
          ),
        ).toBe(1);
      } finally {
        holder.release();
        await pool.end();
        await env.close();
      }
    }, 180000);

    it("K1d: a preexisting artifact without its typed row (another writer) is completed only when its manifest matches; otherwise a conflict", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      try {
        await persistUnits(env, pool);
        const pkg = fixturePackageArtifact();
        await persistEvidencePackage(pool, pkg);
        await forge(env, [["DELETE FROM evidence_packages"]]);
        const again = await persistEvidencePackage(pool, pkg);
        expect(again).toMatchObject({
          kind: "created",
          record: {
            completed_existing_artifact: true,
            artifact_id: pkg.artifact_id,
          },
        });
        expect(
          await count(
            env,
            "artifacts WHERE artifact_type = 'evidence_package'",
          ),
        ).toBe(1);
        expect(await count(env, "evidence_packages")).toBe(1);
        // an artifact with this hash but a different stored manifest (forged by another writer) and no typed row
        await forge(env, [
          ["DELETE FROM evidence_packages"],
          [
            "UPDATE artifacts SET canonical_payload = '{\"manifest\":{\"forged\":true}}'::jsonb WHERE artifact_type = 'evidence_package'",
          ],
        ]);
        expect(await persistEvidencePackage(pool, pkg)).toMatchObject({
          kind: "conflict",
          code: "stored_package_invalid",
        });
        expect(await count(env, "evidence_packages")).toBe(0);
      } finally {
        await pool.end();
        await env.close();
      }
    }, 180000);

    it("K1e: authored ids occupied by a different record conflict (distinct from semantic-hash convergence); tamper conflicts", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      try {
        await persistUnits(env, pool);
        const pkg = fixturePackageArtifact();
        expect((await persistEvidencePackage(pool, pkg)).kind).toBe("created");
        const alt = alternatePackage(); // a different manifest (hash)
        expect(
          await persistEvidencePackage(pool, {
            ...alt,
            artifact_id: pkg.artifact_id,
            canonical_payload: {
              ...(alt.canonical_payload as object),
              artifact_id: pkg.artifact_id,
            },
          }),
        ).toMatchObject({ kind: "conflict", code: "artifact_id_occupied" });
        expect(
          await persistEvidencePackage(pool, {
            ...alt,
            evidence_package_id: pkg.evidence_package_id,
            canonical_payload: {
              ...(alt.canonical_payload as object),
              id: pkg.evidence_package_id,
            },
          }),
        ).toMatchObject({
          kind: "conflict",
          code: "evidence_package_id_occupied",
        });
        expect(
          await count(
            env,
            "artifacts WHERE artifact_type = 'evidence_package'",
          ),
        ).toBe(1);
        // K5: the stored artifact for this hash holds a different manifest (forged row; typed row present)
        await forge(env, [
          [
            "UPDATE artifacts SET canonical_payload = '{\"manifest\":{\"forged\":true}}'::jsonb WHERE artifact_type = 'evidence_package'",
          ],
        ]);
        expect(await persistEvidencePackage(pool, pkg)).toMatchObject({
          kind: "conflict",
          code: "stored_package_invalid",
        });
      } finally {
        await pool.end();
        await env.close();
      }
    }, 180000);

    it("K7: the hash is not validation - invalid references, missing rows and unrelated unit sets are rejected and commit nothing", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      try {
        const pkg = fixturePackageArtifact();
        // units not yet persisted
        expect(await persistEvidencePackage(pool, pkg)).toMatchObject({
          kind: "rejected",
          code: "package_evidence_unit_not_found",
        });
        await persistUnits(env, pool);
        const mutate = (
          fn: (m: {
            evidence: Record<string, Json>[];
            claims: Record<string, Json>[];
          }) => void,
        ) =>
          rebuildPackage((payload) => {
            fn(payload.manifest as never);
          });
        expect(
          await persistEvidencePackage(
            pool,
            mutate((m) => {
              must(m.evidence[0]).content_hash = "f".repeat(64);
            }),
          ),
        ).toMatchObject({ kind: "rejected", code: "package_evidence_fields" });
        expect(
          await persistEvidencePackage(
            pool,
            mutate((m) => {
              must(m.evidence[0]).quote_permission = true;
            }),
          ),
        ).toMatchObject({
          kind: "rejected",
          code: "package_evidence_permission_exceeds_rights",
        });
        expect(
          await persistEvidencePackage(
            pool,
            mutate((m) => {
              must(m.claims[0]).claim_id =
                "d1250008-0000-4000-8000-0000000000ff";
            }),
          ),
        ).toMatchObject({
          kind: "rejected",
          code: "package_reference_unresolved",
        });
        expect(
          await persistEvidencePackage(
            pool,
            mutate((m) => {
              must(m.claims[0]).claim_content_hash = "e".repeat(64);
            }),
          ),
        ).toMatchObject({ kind: "rejected", code: "package_claim_fields" });
        expect(
          await persistEvidencePackage(
            pool,
            mutate((m) => {
              m.evidence.shift();
            }),
          ),
        ).toMatchObject({
          kind: "rejected",
          code: "package_support_unit_not_in_package",
        });
        // the package is valid but is not the slice's unit set
        expect(
          await persistEvidencePackage(pool, pkg, {
            expectedUnitIds: unitIds().slice(1),
          }),
        ).toMatchObject({ kind: "rejected", code: "package_units_mismatch" });
        expect(
          await persistEvidencePackage(pool, { ...pkg, schema_version: "" }),
        ).toMatchObject({
          kind: "rejected",
          code: "artifact_schema_version_unknown",
        });
        expect(
          await count(
            env,
            "artifacts WHERE artifact_type = 'evidence_package'",
          ),
        ).toBe(0);
        expect(await count(env, "evidence_packages")).toBe(0);
        expect(idle(pool)).toBe(true);
      } finally {
        await pool.end();
        await env.close();
      }
    }, 180000);

    it("K4: binding - same package converges, a different package conflicts, immutability holds, unknown attempt/package rejected", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      try {
        await persistUnits(env, pool);
        const a = await persistEvidencePackage(pool, fixturePackageArtifact());
        const b = await persistEvidencePackage(pool, alternatePackage());
        const pa = (a as { record: { evidence_package_id: string } }).record
          .evidence_package_id;
        const pb = (b as { record: { evidence_package_id: string } }).record
          .evidence_package_id;
        const attempt = must(attemptIds()[0]);
        expect(
          await bindPackage(pool, {
            attemptId: attempt,
            evidencePackageId: pa,
          }),
        ).toMatchObject({ kind: "created" });
        expect(
          await bindPackage(pool, {
            attemptId: attempt,
            evidencePackageId: pa,
          }),
        ).toMatchObject({ kind: "converged" });
        expect(
          await bindPackage(pool, {
            attemptId: attempt,
            evidencePackageId: pb,
          }),
        ).toMatchObject({
          kind: "conflict",
          code: "attempt_bound_to_other_package",
        });
        expect(await attemptBinding(env)).toBe(pa);
        expect(
          await bindPackage(pool, {
            attemptId: "d1250099-0000-4000-8000-0000000000aa",
            evidencePackageId: pa,
          }),
        ).toMatchObject({ kind: "rejected", code: "attempt_not_found" });
        expect(
          await bindPackage(pool, {
            attemptId: must(attemptIds()[1]),
            evidencePackageId: "d1250099-0000-4000-8000-0000000000bb",
          }),
        ).toMatchObject({ kind: "rejected", code: "package_not_found" });
        // slice's unit set must equal the package's
        expect(
          await bindPackage(pool, {
            attemptId: must(attemptIds()[1]),
            evidencePackageId: pa,
            expectedUnitIds: unitIds().slice(1),
          }),
        ).toMatchObject({ kind: "rejected", code: "package_units_mismatch" });
        expect(await attemptBinding(env, 1)).toBeNull();
      } finally {
        await pool.end();
        await env.close();
      }
    }, 180000);

    it("K4b: two concurrent binders - the loser's wait is observed, then it re-reads after the savepoint rollback (same package converges; a different package conflicts)", async () => {
      for (const different of [false, true]) {
        const env = await fresh();
        const pool = actorPool(env);
        const holder = await env.owner.connect();
        try {
          await persistUnits(env, pool);
          const a = await persistEvidencePackage(
            pool,
            fixturePackageArtifact(),
          );
          const b = await persistEvidencePackage(pool, alternatePackage());
          const pa = (a as { record: { evidence_package_id: string } }).record
            .evidence_package_id;
          const pb = (b as { record: { evidence_package_id: string } }).record
            .evidence_package_id;
          const attempt = must(attemptIds()[0]);
          await holder.query("BEGIN"); // the winning binder, not yet committed (runtime-equivalent definer call)
          await holder.query("SET LOCAL ROLE desk_runtime");
          await holder.query("SELECT bind_evidence_package($1,$2)", [
            attempt,
            pa,
          ]);
          const holderPid = await backendPid(holder);
          const pending = bindPackage(pool, {
            attemptId: attempt,
            evidencePackageId: different ? pb : pa,
          });
          await waitForBlocked(env.owner, env.name, (w) =>
            w.some((x) => x.blockers.includes(holderPid)),
          );
          await holder.query("COMMIT");
          const o = await pending;
          if (different)
            expect(o).toMatchObject({
              kind: "conflict",
              code: "attempt_bound_to_other_package",
            });
          else expect(o.kind).toBe("converged");
          expect(await attemptBinding(env)).toBe(pa);
          expect(idle(pool)).toBe(true);
        } finally {
          holder.release();
          await pool.end();
          await env.close();
        }
      }
    }, 240000);

    it("K6 (characterization only): attempts of runs bound to different show-config versions can reference one package; no editorial eligibility is claimed", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      try {
        // two distinct show-config versions were established at creation by the test prerequisites (no mutation, no swallowed error)
        const before = await ownerRows(
          env,
          "SELECT show_config_version_id::text AS c FROM program_run_attempts ORDER BY attempt_id",
        );
        expect(new Set(before.map((r) => r.c)).size).toBe(2);
        await persistUnits(env, pool);
        const a = await persistEvidencePackage(pool, fixturePackageArtifact());
        const pa = (a as { record: { evidence_package_id: string } }).record
          .evidence_package_id;
        for (const id of attemptIds())
          expect(
            (await bindPackage(pool, { attemptId: id, evidencePackageId: pa }))
              .kind,
          ).toBe("created");
        const bound = await ownerRows(
          env,
          "SELECT evidence_package_id::text AS p, count(DISTINCT show_config_version_id)::int AS configs, count(*)::int AS attempts FROM program_run_attempts GROUP BY 1",
        );
        expect(bound).toEqual([{ p: pa, configs: 2, attempts: 2 }]);
      } finally {
        await pool.end();
        await env.close();
      }
    }, 180000);

    it("W0: an uninterrupted slice, its read-only status, and a full re-run (all converged)", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      try {
        await persistUnits(env, pool);
        const before = await evidenceSliceStatus(pool, sliceInput());
        expect(before.complete).toBe(false);
        expect(before.binding).toBe("unbound");
        const r = await runSliceObserved(pool, sliceInput());
        expect(r.complete).toBe(true);
        // units and supports pre-exist (the package needs the claims\' support rows): S1 converges; the package and the binding are created
        expect(
          r.steps.filter((s) => s.outcome === "created").map((s) => s.step),
        ).toEqual(["S2_evidence_package", "S3_binding"]);
        expect(
          r.steps
            .filter((s) => s.step === "S1_evidence_unit")
            .every((s) => s.outcome === "converged"),
        ).toBe(true);
        expect(r.snapshotVerification).toBe("verified");
        const again = await runSliceObserved(pool, sliceInput());
        expect(again.complete).toBe(true);
        expect(again.steps.every((s) => s.outcome === "converged")).toBe(true);
        expect((await evidenceSliceStatus(pool, sliceInput())).complete).toBe(
          true,
        );
        expect(idle(pool)).toBe(true);
      } finally {
        await pool.end();
        await env.close();
      }
    }, 180000);

    it("W1: re-entry after a kill at each fault point (child held until the parent observes the database fact) equals an uninterrupted run", async () => {
      const reference = await fresh();
      const refPool = actorPool(reference);
      await persistUnits(reference, refPool);
      await runSliceObserved(refPool, sliceInput());
      const expected = await endState(reference);
      await refPool.end();
      await reference.close();
      // The package's claims need their support rows, which reference the units: units and supports exist before the slice runs
      // (S1 therefore converges here; unit CREATION after a kill is covered by W1b).
      const total = unitIds().length;
      const facts: Record<string, (env: DbEnv) => Promise<boolean>> = {
        after_s1: async (env) =>
          (await count(env, "evidence_units")) === total &&
          (await count(env, "evidence_packages")) === 0,
        after_package_commit: async (env) =>
          (await count(env, "evidence_packages")) === 1 &&
          (await attemptBinding(env)) === null,
        after_bind_commit: async (env) => (await attemptBinding(env)) !== null,
      };
      for (const [fault, fact] of Object.entries(facts)) {
        const env = await fresh();
        const pool = actorPool(env);
        try {
          await persistUnits(env, pool);
          const done = await withChild(
            env.owner,
            env.name,
            {
              url: env.runtimeUrl,
              tag: fault,
              fault,
              scenario: "slice",
              attemptIndex: 0,
            },
            async () => {
              await observe(() => fact(env), `${fault}: database fact`);
            },
          );
          expect(done.signal).toBe("SIGKILL");
          expect(done.stdout).not.toContain("COMPLETED_WITHOUT_FAULT");
          // interrupted state is exactly the checkpoint the fault names
          if (fault !== "after_bind_commit")
            expect(
              (await evidenceSliceStatus(pool, sliceInput())).complete,
            ).toBe(false);
          const resumed = await runSliceObserved(pool, sliceInput());
          expect(resumed.complete).toBe(true);
          if (fault === "after_s1")
            expect(
              resumed.steps
                .filter((s) => s.step === "S1_evidence_unit")
                .every((s) => s.outcome === "converged"),
            ).toBe(true);
          if (fault === "after_package_commit")
            expect(
              resumed.steps.find((s) => s.step === "S2_evidence_package")
                ?.outcome,
            ).toBe("converged");
          if (fault === "after_bind_commit")
            expect(resumed.steps.every((s) => s.outcome === "converged")).toBe(
              true,
            );
          expect(await endState(env)).toEqual(expected);
        } finally {
          await pool.end();
          await env.close();
        }
      }
    }, 300000);

    it("W1b: unit creation survives a kill after COMMIT (lost acknowledgement): the identical resend converges", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      try {
        const first = must(fixtureUnits()[0]);
        const done = await withChild(
          env.owner,
          env.name,
          {
            url: env.runtimeUrl,
            tag: "w1b",
            fault: "after_commit_before_return",
            scenario: "unit",
            unitIndex: 0,
          },
          async () => {
            await observe(
              async () => (await count(env, "evidence_units")) === 1,
              "unit committed",
            );
          },
        );
        expect(done.signal).toBe("SIGKILL");
        expect((await persistEvidenceUnit(pool, first)).kind).toBe("converged");
        expect(await count(env, "evidence_units")).toBe(1);
      } finally {
        await pool.end();
        await env.close();
      }
    }, 120000);

    it("harness controls: a missing fault point and a failing observation terminate within bounds and release the child and its backends", async () => {
      const env = await fresh();
      try {
        // the child completes without ever reaching the named fault point: reported as a failure, never as a recovery
        const t0 = Date.now();
        await expect(
          withChild(
            env.owner,
            env.name,
            {
              url: env.runtimeUrl,
              tag: "ctl1",
              fault: "no_such_fault_point",
              scenario: "unit",
              unitIndex: 0,
            },
            () => Promise.resolve(),
            20000,
          ),
        ).rejects.toThrow(/completed without reaching the fault point/);
        expect(Date.now() - t0).toBeLessThan(25000);
        // the child IS held, but the database fact never becomes true: the observation times out, the child is killed anyway
        await expect(
          withChild(
            env.owner,
            env.name,
            {
              url: env.runtimeUrl,
              tag: "ctl2",
              fault: "after_commit_before_return",
              scenario: "unit",
              unitIndex: 1,
            },
            async () => {
              await observe(
                () => Promise.resolve(false),
                "a fact that never holds",
                1500,
              );
            },
          ),
        ).rejects.toThrow(/database fact not observed/);
        const alive = await ownerRows(
          env,
          "SELECT pid FROM pg_stat_activity WHERE datname = $1 AND application_name LIKE 'a5child_ctl%'",
          [env.name],
        );
        expect(alive).toHaveLength(0);
      } finally {
        await env.close();
      }
    }, 120000);

    it("W2: a changed input on re-entry conflicts at the first differing step and nothing is overwritten; an unrelated package is rejected before any write", async () => {
      const env = await fresh();
      const pool = actorPool(env);
      try {
        await persistUnits(env, pool);
        expect((await runSliceObserved(pool, sliceInput())).complete).toBe(
          true,
        );
        const snapshot = await endState(env);
        // changed unit datum
        const changed = sliceInput();
        must(changed.units[3]).unit.created_at = "2026-09-27T12:59:00.000001Z";
        const r1 = await runSliceObserved(pool, changed);
        expect(r1.complete).toBe(false);
        expect(r1.stoppedAt).toMatchObject({
          step: "S1_evidence_unit",
          outcome: "conflict",
          code: "created_at",
        });
        expect(await endState(env)).toEqual(snapshot);
        // a different (valid) package over the same units: S2 stores it, S3 refuses to rebind - the first binding is untouched
        const alt = sliceInput();
        alt.pkg = alternatePackage();
        const r2 = await runSliceObserved(pool, alt);
        expect(r2.stoppedAt).toMatchObject({
          step: "S3_binding",
          outcome: "conflict",
          code: "attempt_bound_to_other_package",
        });
        expect(((await endState(env)) as { binding: string }).binding).toBe(
          (snapshot as { binding: string }).binding,
        );
        // units that are not the package's units: rejected in preflight, nothing written (fresh database)
        const env2 = await fresh();
        const p2 = actorPool(env2);
        try {
          const unrelated = sliceInput();
          unrelated.units = unrelated.units.slice(1);
          const r3 = await runSliceObserved(p2, unrelated);
          expect(r3.stoppedAt).toMatchObject({
            outcome: "rejected",
            code: "slice_units_package_mismatch",
          });
          expect(await count(env2, "evidence_units")).toBe(0);
          expect(
            await count(
              env2,
              "artifacts WHERE artifact_type = 'evidence_package'",
            ),
          ).toBe(0);
          // a package that validates but whose entry disagrees with the supplied unit
          const entryMismatch = sliceInput();
          must(entryMismatch.units[0]).unit.evidence_type = "analysis";
          // (unit body/hash remain valid; the package entry says another type)
          const r4 = await runSliceObserved(p2, entryMismatch);
          expect(r4.stoppedAt).toMatchObject({
            outcome: "rejected",
            code: "slice_unit_package_entry_mismatch",
          });
          expect(await count(env2, "evidence_units")).toBe(0);
        } finally {
          await p2.end();
          await env2.close();
        }
      } finally {
        await pool.end();
        await env.close();
      }
    }, 240000);

    it("privileges: the runtime role has no UPDATE/DELETE on the A5.1 tables (no privilege change)", async () => {
      const env = await fresh();
      try {
        const r = await env.owner.query(
          `SELECT t, has_table_privilege('desk_runtime', t, 'UPDATE') AS u, has_table_privilege('desk_runtime', t, 'DELETE') AS d,
                has_table_privilege('desk_runtime', t, 'INSERT') AS i
           FROM unnest(ARRAY['evidence_units','rights_versions','artifacts','evidence_packages','claim_state_events']) AS t`,
        );
        for (const row of r.rows as { u: boolean; d: boolean; i: boolean }[]) {
          expect(row.u).toBe(false);
          expect(row.d).toBe(false);
          expect(row.i).toBe(true);
        }
      } finally {
        await env.close();
      }
    }, 120000);
  },
);
