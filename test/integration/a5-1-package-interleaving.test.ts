// A5.1 latent-defect regression (found in A5.2 review): persistEvidencePackage decided "authored id occupied by a DIFFERENT record"
// from a READ COMMITTED lookup that can see an IDENTICAL governed winner committed AFTER the semantic (hash) lookups. Each test commits
// the winner through an independent session at an exact statement boundary of the loser's transaction (a thin client wrapper runs the
// winner BEFORE the named statement is sent) - deterministic, no sleeps, no reruns. Unrelated occupied-id negatives stay conflicts.
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { persistEvidencePackage } from "../../src/runtime/package.js";
import { TestCluster, type DbEnv } from "../support/db-env.js";
import {
  alternatePackage,
  fixturePackageArtifact,
  prepareUnitsAndSupports,
  seedPrerequisites,
} from "../support/a5-fixture.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const cluster = databaseUrl ? new TestCluster(databaseUrl) : undefined;
if (cluster) {
  beforeAll(async () => {
    await cluster.bootstrap();
  }, 120000);
  afterAll(async () => {
    await cluster.shutdown();
  });
}
const must = <T>(v: T | undefined): T => {
  if (v === undefined) throw new Error("missing");
  return v;
};
const runtimePool = (env: DbEnv): pg.Pool =>
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
const count = async (env: DbEnv, table: string): Promise<number> =>
  Number(
    (await env.owner.query<{ n: string }>(`SELECT count(*) AS n FROM ${table}`))
      .rows[0]?.n,
  );

/**
 * A pool whose pinned client runs `beforeStatement()` ONCE immediately before the FIRST statement whose text contains `marker` is
 * sent (the statement then sees whatever the hook committed). Only `connect()` is intercepted; everything else is the real pool.
 */
function boundary(
  pool: pg.Pool,
  marker: string,
  beforeStatement: () => Promise<void>,
): { pool: pg.Pool; fired(): number } {
  let fired = 0;
  const wrapped = new Proxy(pool, {
    get(target, prop) {
      if (prop !== "connect") {
        const v = Reflect.get(target, prop) as unknown;
        return typeof v === "function"
          ? ((v as (...a: unknown[]) => unknown).bind(target) as unknown)
          : v;
      }
      return async () => {
        const client = await target.connect();
        return new Proxy(client, {
          get(c, cp) {
            if (cp === "query")
              return async (text: unknown, ...rest: unknown[]) => {
                if (
                  fired === 0 &&
                  typeof text === "string" &&
                  text.includes(marker)
                ) {
                  fired += 1;
                  await beforeStatement();
                }
                return (c.query as (...a: unknown[]) => Promise<unknown>)(
                  text,
                  ...rest,
                );
              };
            const v = Reflect.get(c, cp) as unknown;
            return typeof v === "function"
              ? ((v as (...a: unknown[]) => unknown).bind(c) as unknown)
              : v;
          },
        });
      };
    },
  });
  return { pool: wrapped, fired: () => fired };
}

const ARTIFACT_ID_LOOKUP = "SELECT 1 FROM artifacts WHERE artifact_id";
const PACKAGE_ID_LOOKUP =
  "SELECT 1 FROM evidence_packages WHERE evidence_package_id";

suite(
  "A5.1 persistEvidencePackage: an identical winner committed across a read boundary converges",
  () => {
    const scenario = async (
      name: string,
      marker: string,
      orphanFirst: boolean,
    ): Promise<void> => {
      const env = await fresh();
      const loserPool = runtimePool(env);
      const winnerPool = runtimePool(env);
      try {
        await prepareUnitsAndSupports(env.migrator, loserPool);
        const pkg = fixturePackageArtifact();
        if (orphanFirst) {
          // a real orphan: the artifact exists WITHOUT its typed row (another writer), exactly as the existing completion path expects
          expect((await persistEvidencePackage(winnerPool, pkg)).kind).toBe(
            "created",
          );
          const c = await env.owner.connect();
          try {
            await c.query("SET session_replication_role = replica");
            await c.query("DELETE FROM evidence_packages");
          } finally {
            await c
              .query("RESET session_replication_role")
              .catch(() => undefined);
            c.release();
          }
        }
        const winnerOutcome: { kind?: string } = {};
        const b = boundary(loserPool, marker, async () => {
          winnerOutcome.kind = (
            await persistEvidencePackage(winnerPool, pkg)
          ).kind; // committed (its own transaction) BEFORE the loser's occupied-id statement is sent
        });
        const loser = await persistEvidencePackage(b.pool, pkg);
        expect(b.fired(), `${name}: boundary reached`).toBe(1);
        expect(winnerOutcome.kind).toBe("created");
        expect(loser.kind, `${name}: ${JSON.stringify(loser)}`).toBe(
          "converged",
        );
        if (loser.kind === "converged") {
          expect(loser.record.reused).toBe(true);
          expect(loser.record.artifact_id).toBe(pkg.artifact_id);
          expect(loser.record.evidence_package_id).toBe(
            pkg.evidence_package_id,
          );
        }
        expect(
          await count(
            env,
            "artifacts WHERE artifact_type = 'evidence_package'",
          ),
        ).toBe(1);
        expect(await count(env, "evidence_packages")).toBe(1);
      } finally {
        await Promise.all([loserPool.end(), winnerPool.end()]);
        await env.close();
      }
    };

    it("artifact-id window: the winner commits after both semantic lookups, before the occupied-artifact read", async () => {
      await scenario("artifact window", ARTIFACT_ID_LOOKUP, false);
    }, 180000);

    it("package-id window: the winner commits after the artifact-id read, before the occupied-package read", async () => {
      await scenario("package-id window", PACKAGE_ID_LOOKUP, false);
    }, 180000);

    it("orphan-completion window: the winner completes the same orphan artifact before the occupied-package read", async () => {
      await scenario("orphan window", PACKAGE_ID_LOOKUP, true);
    }, 180000);

    it("unrelated occupied ids stay conflicts even at the same boundaries (no winner for this hash exists)", async () => {
      const env = await fresh();
      const pool = runtimePool(env);
      try {
        await prepareUnitsAndSupports(env.migrator, pool);
        const pkg = fixturePackageArtifact();
        expect((await persistEvidencePackage(pool, pkg)).kind).toBe("created");
        const alt = alternatePackage(); // a DIFFERENT governed hash
        const asArtifact = {
          ...alt,
          artifact_id: pkg.artifact_id,
          canonical_payload: {
            ...(alt.canonical_payload as object),
            artifact_id: pkg.artifact_id,
          },
        };
        expect(await persistEvidencePackage(pool, asArtifact)).toMatchObject({
          kind: "conflict",
          code: "artifact_id_occupied",
        });
        const asPackage = {
          ...alt,
          evidence_package_id: pkg.evidence_package_id,
          canonical_payload: {
            ...(alt.canonical_payload as object),
            id: pkg.evidence_package_id,
          },
        };
        expect(await persistEvidencePackage(pool, asPackage)).toMatchObject({
          kind: "conflict",
          code: "evidence_package_id_occupied",
        });
        expect(
          await count(
            env,
            "artifacts WHERE artifact_type = 'evidence_package'",
          ),
        ).toBe(1);
        expect(await count(env, "evidence_packages")).toBe(1);
      } finally {
        await pool.end();
        await env.close();
      }
    }, 180000);
  },
);
