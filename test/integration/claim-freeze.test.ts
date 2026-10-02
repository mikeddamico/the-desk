import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { allTables } from "../../src/fixture/families.js";
import {
  fixturePack,
  loadClaimEventConformance,
} from "../../src/fixture/loader.js";
import { persistFixture } from "../../src/fixture/persist.js";
import {
  ClaimStateError,
  sameEvent,
  type ClaimStateEvent,
} from "../../src/knowledge/claim-state.js";
import {
  freezeClaims,
  readClaimLogs,
  type Queryable,
} from "../../src/knowledge/claim-log.js";
import {
  parseLexicalJson,
  LexicalNumber,
} from "../../src/knowledge/lexical-json.js";
import {
  freezeClaimPrefix,
  parseStateCursor,
  verifyFrozenEntry,
} from "../../src/knowledge/state-cursor.js";
import { TestCluster, type DbEnv } from "../support/db-env.js";
import { ACTOR, must } from "../support/claim-events.js";
import {
  OfflineClaimLog,
  runVector,
  translateRow,
  type VectorClaim,
} from "../support/claim-vector-harness.js";
import { backendPid, waitForBlocked, within } from "../support/pg-wait.js";

// PostgreSQL integration for the A3 claim reducer and prefix freeze (disposable PostgreSQL 17, independent sessions).
// Synchronization is database-observed (pg_locks / pg_blocking_pids / pg_backend_pid) and bounded; there are no sleeps and no
// pool serialization used as proof: every actor owns its own single-connection pool and backend.
const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const cluster = databaseUrl ? new TestCluster(databaseUrl) : undefined;
const evidenceDir = process.env.A3_EVIDENCE_DIR;
const observations: Record<string, unknown> = {};

const ASSERTABLE = "d1250008-0000-4000-8000-000000000001";
const HEDGED = "d1250008-0000-4000-8000-000000000004";
const SILENT = "d1250008-0000-4000-8000-000000000008";
const MIGRATION_CLAIM_LOCK_CLASS = 182736452;
const CLAIM_IDS = Array.from(
  { length: 9 },
  (_, i) => `d1250008-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
);
const ceilings = (
  value: "assertable" | "hedged_only" | "silent" = "assertable",
): Record<string, "assertable" | "hedged_only" | "silent"> =>
  Object.fromEntries(CLAIM_IDS.map((id) => [id, value]));

const theCluster = (): TestCluster => must(cluster);
async function loaded(): Promise<DbEnv> {
  const env = await theCluster().create({ migrate: true });
  await persistFixture(env.migrator);
  return env;
}
const actorPool = (env: DbEnv): pg.Pool =>
  new pg.Pool({
    connectionString: env.runtimeUrl,
    options: "-c role=desk_runtime",
    max: 1,
  });
const insertSql =
  "INSERT INTO claim_state_events(claim_state_event_id, claim_id, event_type, event_payload, actor_id, occurred_at, event_sequence) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)";
const insertValues = (e: {
  id: string;
  claim: string;
  type: string;
  seq: number;
  usage?: string;
  at?: string;
  reason?: string;
}): unknown[] => [
  e.id,
  e.claim,
  e.type,
  JSON.stringify({
    reason_code: "synthetic_it",
    reason: e.reason ?? "integration event",
    ...(e.usage ? { usage_class: e.usage } : {}),
  }),
  ACTOR,
  e.at ?? "2026-09-27T13:30:00Z",
  e.seq,
];
const ev = (
  claim: string,
  seq: number,
  type = "confirm",
  usage?: string,
  at?: string,
): Parameters<typeof insertValues>[0] => ({
  id: randomUUID(),
  claim,
  type,
  seq,
  ...(usage ? { usage } : {}),
  ...(at ? { at } : {}),
});
const sqlstate = (error: unknown): string =>
  (error as { code?: string }).code ?? "no-code";
async function tryInsert(
  db: Queryable,
  e: Parameters<typeof insertValues>[0],
): Promise<string> {
  try {
    await db.query(insertSql, insertValues(e));
    return "ok";
  } catch (error) {
    return sqlstate(error);
  }
}
const rowCounts = async (db: pg.Pool): Promise<Record<string, number>> =>
  Object.fromEntries(
    await Promise.all(
      allTables.map(
        async (t) =>
          [
            t,
            Number(
              (
                await db.query<{ n: string }>(
                  `SELECT count(*) AS n FROM "${t}"`,
                )
              ).rows[0]?.n,
            ),
          ] as const,
      ),
    ),
  );
const spy = (pool: Queryable): { db: Queryable; statements: string[] } => {
  const statements: string[] = [];
  return {
    statements,
    db: {
      query: (text, values) => {
        statements.push(text);
        return pool.query(text, values);
      },
    },
  };
};
const claimOf = async (db: Queryable, id: string) => {
  const [log] = await readClaimLogs(db, [id]);
  return must(log);
};

suite("claim reducer and prefix freeze (A3) on PostgreSQL", () => {
  beforeAll(async () => {
    await cluster?.bootstrap();
  }, 60000);
  afterAll(async () => {
    if (evidenceDir) {
      await mkdir(evidenceDir, { recursive: true });
      await writeFile(
        join(evidenceDir, "integration-observations.json"),
        `${JSON.stringify(observations, null, 2)}\n`,
      );
    }
    await cluster?.shutdown();
  }, 60000);

  it("freezes all nine claims from ONE statement, reproduces the shipped package entries and writes nothing", async () => {
    const env = await loaded();
    const before = await rowCounts(env.owner);
    const { db, statements } = spy(env.runtime);
    const entries = await freezeClaims(db, CLAIM_IDS, ceilings());
    expect(statements).toHaveLength(1); // no separate claim-row query
    expect(statements[0]).toMatch(
      /FROM claims c\s+LEFT JOIN claim_state_events e/,
    );
    expect(entries).toHaveLength(9);
    const pkg = (
      await env.owner.query<{
        canonical_payload: { manifest: { claims: Record<string, unknown>[] } };
      }>(
        "SELECT canonical_payload FROM artifacts WHERE artifact_type = 'evidence_package'",
      )
    ).rows[0];
    const manifest = must(pkg).canonical_payload.manifest.claims;
    for (const entry of entries) {
      const shipped = must(manifest.find((c) => c.claim_id === entry.claim_id));
      for (const key of [
        "claim_content_hash",
        "initial_status",
        "initial_usage_class",
        "state_event_cursor",
        "frozen_state",
        "reduced_usage_class",
        "effective_usage_class",
        "frozen_state_hash",
      ] as const)
        expect(entry[key], `${entry.claim_id} ${key}`).toEqual(shipped[key]);
      expect(entry.state_event_cursor).toBeNull();
    }
    expect(await rowCounts(env.owner)).toEqual(before); // freeze creates no event and writes nothing
    observations.singleStatementFreeze = {
      statements: statements.length,
      claims: entries.length,
    };
  }, 120000);

  it("preserves claims with zero events, rejects missing and duplicate requests and requires a ceiling per claim", async () => {
    const env = await loaded();
    const logs = await readClaimLogs(env.runtime, CLAIM_IDS);
    expect(logs.map((l) => l.claim.claim_id)).toEqual(CLAIM_IDS);
    expect(logs.every((l) => l.events.length === 0)).toBe(true);
    const code = async (p: Promise<unknown>): Promise<string> => {
      try {
        await p;
      } catch (e) {
        return e instanceof ClaimStateError ? e.code : "other";
      }
      return "accepted";
    };
    expect(
      await code(readClaimLogs(env.runtime, [ASSERTABLE, randomUUID()])),
    ).toBe("claim_not_found");
    expect(
      await code(readClaimLogs(env.runtime, [ASSERTABLE, ASSERTABLE])),
    ).toBe("claim_request_invalid");
    expect(await code(readClaimLogs(env.runtime, []))).toBe(
      "claim_request_invalid",
    );
    expect(await code(readClaimLogs(env.runtime, ["not-a-uuid"]))).toBe(
      "claim_request_invalid",
    );
    expect(
      await code(
        freezeClaims(env.runtime, [ASSERTABLE, HEDGED], {
          [ASSERTABLE]: "assertable",
        }),
      ),
    ).toBe("ceiling_missing");
    expect(
      await code(
        freezeClaims(env.runtime, [ASSERTABLE], {
          [ASSERTABLE]: "assertable",
          [HEDGED]: "silent",
        }),
      ),
    ).toBe("ceiling_for_unrequested_claim");
    expect(
      await code(
        freezeClaims(env.runtime, [ASSERTABLE], {
          [ASSERTABLE]: "loud" as "silent",
        }),
      ),
    ).toBe("ceiling_missing");
  }, 120000);

  it("recomputes and compares the stored claim content hash (a tampered immutable claim is rejected)", async () => {
    const env = await loaded();
    const tamper = await env.owner.connect();
    try {
      await tamper.query("SET session_replication_role = replica"); // superuser-only bypass of the immutability trigger
      await tamper.query(
        "UPDATE claims SET predicate = 'tampered' WHERE claim_id = $1",
        [HEDGED],
      );
    } finally {
      tamper.release();
    }
    const outcome = await readClaimLogs(env.runtime, [ASSERTABLE, HEDGED]).then(
      () => "accepted",
      (e: unknown) => (e instanceof ClaimStateError ? e.code : "other"),
    );
    expect(outcome).toBe("claim_content_hash_mismatch");
  }, 120000);

  it("works at READ COMMITTED and at REPEATABLE READ READ ONLY and sees one consistent snapshot", async () => {
    const env = await loaded();
    const client = await env.runtime.connect();
    try {
      for (const level of ["READ COMMITTED", "REPEATABLE READ READ ONLY"]) {
        await client.query(`BEGIN ISOLATION LEVEL ${level}`);
        const entries = await freezeClaims(client, CLAIM_IDS, ceilings());
        await client.query("COMMIT");
        expect(entries).toHaveLength(9);
      }
    } finally {
      client.release();
    }
  }, 120000);

  it("isolated usage-change scenario: the old entry stays consistent while live state differs; a fresh freeze names the event", async () => {
    const env = await loaded();
    const scenario = (
      fixturePack().json("scenarios.json") as {
        scenarios: {
          usage_change: {
            rows: { claim_state_events: Record<string, unknown>[] };
          };
        };
      }
    ).scenarios.usage_change.rows.claim_state_events[0];
    const row = must(scenario);
    expect(row.claim_id).toBe(HEDGED);
    const [oldEntry] = await freezeClaims(env.runtime, [HEDGED], {
      [HEDGED]: "assertable",
    });
    expect(must(oldEntry).state_event_cursor).toBeNull();
    await env.runtime.query(insertSql, [
      row.claim_state_event_id,
      row.claim_id,
      row.event_type,
      JSON.stringify(row.event_payload),
      row.actor_id,
      row.occurred_at,
      row.event_sequence,
    ]);
    const live = await claimOf(env.runtime, HEDGED);
    const result = verifyFrozenEntry({
      entry: oldEntry,
      claim: live.claim,
      liveEvents: live.events,
      frozenCeiling: "assertable",
      currentCeiling: "assertable",
    });
    expect(result.materialDifference).toBe(true);
    expect(result.live).toMatchObject({
      state: "confirmed",
      reduced_usage_class: "silent",
      effective_usage_class: "silent",
    });
    expect(result.liveEventsAfterCursor).toBe(1);
    const [fresh] = await freezeClaims(env.runtime, [HEDGED], {
      [HEDGED]: "assertable",
    });
    expect(must(fresh).state_event_cursor).toEqual({
      claim_state_event_id: row.claim_state_event_id,
      event_sequence: 1,
    });
    expect(must(fresh).frozen_state).toBe("confirmed");
    expect(must(fresh).effective_usage_class).toBe("silent");
    expect(must(fresh).frozen_state_hash).not.toBe(
      must(oldEntry).frozen_state_hash,
    );
  }, 120000);

  it("a stricter CURRENT permission is a material live difference and leaves the historical entry valid (separate ceilings)", async () => {
    const env = await loaded();
    const [entry] = await freezeClaims(env.runtime, [ASSERTABLE], {
      [ASSERTABLE]: "assertable",
    });
    const live = await claimOf(env.runtime, ASSERTABLE);
    const same = verifyFrozenEntry({
      entry,
      claim: live.claim,
      liveEvents: live.events,
      frozenCeiling: "assertable",
      currentCeiling: "assertable",
    });
    expect(same.materialDifference).toBe(false);
    const stricter = verifyFrozenEntry({
      entry,
      claim: live.claim,
      liveEvents: live.events,
      frozenCeiling: "assertable",
      currentCeiling: "silent",
    });
    expect(stricter.materialDifference).toBe(true);
    expect(stricter.verified).toEqual(same.verified);
  }, 120000);

  it("accepts gaps above the maximum and a later append with an earlier occurred_at; rejects the unused earlier gap; the old prefix is unchanged", async () => {
    const env = await loaded();
    expect(await tryInsert(env.runtime, ev(ASSERTABLE, 1, "contest"))).toBe(
      "ok",
    );
    const [frozen1] = await freezeClaims(env.runtime, [ASSERTABLE], {
      [ASSERTABLE]: "assertable",
    });
    expect(await tryInsert(env.runtime, ev(ASSERTABLE, 5, "confirm"))).toBe(
      "ok",
    );
    expect(await tryInsert(env.runtime, ev(ASSERTABLE, 3, "demote"))).toBe(
      "23514",
    ); // unused gap below the maximum
    expect(
      await tryInsert(
        env.runtime,
        ev(ASSERTABLE, 6, "usage_change", "silent", "2000-01-01T00:00:00Z"),
      ),
    ).toBe("ok");
    const live = await claimOf(env.runtime, ASSERTABLE);
    expect(live.events.map((e) => e.event_sequence)).toEqual([1, 5, 6]);
    const verified = verifyFrozenEntry({
      entry: frozen1,
      claim: live.claim,
      liveEvents: live.events,
      frozenCeiling: "assertable",
      currentCeiling: "assertable",
    });
    expect(verified.liveEventsAfterCursor).toBe(2);
    expect(verified.materialDifference).toBe(true);
    const [again] = await freezeClaims(env.runtime, [ASSERTABLE], {
      [ASSERTABLE]: "assertable",
    });
    expect(must(again).state_event_cursor?.event_sequence).toBe(6);
    expect(must(again)).toMatchObject({
      frozen_state: "confirmed",
      reduced_usage_class: "silent",
    });
  }, 120000);

  it("differential: sequence-rule vectors agree with the REAL append guard (accept/reject and SQLSTATE); payload rules are application-side only", async () => {
    const env = await loaded();
    const doc = loadClaimEventConformance() as unknown as {
      claims: Record<string, VectorClaim>;
      vectors: { id: string; steps: Record<string, unknown>[] }[];
    };
    const sequenceRule = new Set([
      "first_sequence_not_one",
      "duplicate_sequence",
      "not_monotonic",
      "sequence_not_positive",
    ]);
    const table: {
      vector: string;
      model: string;
      database: string;
      eventType?: unknown;
    }[] = [];
    const client = await env.runtime.connect();
    try {
      for (const vector of doc.vectors) {
        if (!vector.steps.some((s) => s.op === "append")) continue;
        const model = new OfflineClaimLog(doc.claims);
        await client.query("BEGIN"); // READ COMMITTED; rolled back so every vector starts from the empty log
        try {
          for (const step of vector.steps) {
            if (step.op !== "append") continue;
            const raw = translateRow(step.event) as Record<string, unknown>;
            let verdict: string;
            try {
              verdict = `ok:${model.append(step.event)}`;
            } catch (e) {
              verdict = `reject:${(e as { code?: string }).code ?? "other"}`;
            }
            const dbRow = [
              raw.claim_state_event_id,
              raw.claim_id,
              raw.event_type,
              JSON.stringify(raw.event_payload),
              raw.actor_id,
              raw.occurred_at,
              raw.event_sequence,
            ];
            const representable =
              typeof raw.event_sequence === "number" &&
              Number.isSafeInteger(raw.event_sequence) &&
              typeof raw.event_type === "string";
            if (!representable) {
              table.push({
                vector: vector.id,
                model: verdict,
                database: "not-representable (sequence type)",
              });
              continue;
            }
            const code = verdict.startsWith("reject:") ? verdict.slice(7) : "";
            const comparable =
              verdict.startsWith("ok:") || sequenceRule.has(code);
            await client.query("SAVEPOINT step");
            let database = "ok";
            try {
              await client.query(insertSql, dbRow);
            } catch (e) {
              database = sqlstate(e);
            }
            if (comparable) {
              if (verdict === "ok:appended")
                expect(
                  database,
                  `${vector.id} ${JSON.stringify(step.event)}`,
                ).toBe("ok");
              else if (verdict === "ok:converged")
                expect(database).not.toBe("ok"); // the database cannot converge (A5)
              else expect(database, `${vector.id} ${code}`).toBe("23514");
              if (database === "ok")
                await client.query("RELEASE SAVEPOINT step");
              else await client.query("ROLLBACK TO SAVEPOINT step");
            } else {
              await client.query("ROLLBACK TO SAVEPOINT step"); // probe only: model rejected for a non-sequence reason
            }
            table.push({
              vector: vector.id,
              model: verdict,
              database,
              eventType: raw.event_type,
            });
          }
        } finally {
          await client.query("ROLLBACK");
        }
      }
    } finally {
      client.release();
    }
    // Payload rules are NOT database constraints (the application validator must reject them before insert); the event_type
    // vocabulary IS a CHECK constraint.
    const payloadProbes = table.filter(
      (t) => t.model === "reject:invalid_payload",
    );
    expect(payloadProbes.length).toBeGreaterThanOrEqual(4);
    for (const probe of payloadProbes)
      expect(probe.database, probe.vector).toBe(
        probe.eventType === "frozen_snapshot" ? "23514" : "ok",
      );
    expect(
      payloadProbes.filter((p) => p.database === "ok").length,
    ).toBeGreaterThanOrEqual(3);
    observations.differentialAppend = table;
    expect(await rowCounts(env.owner).then((c) => c.claim_state_events)).toBe(
      0,
    );
  }, 180000);

  it("retry characterization (A5 NOT resolved): the database rejects retried identities, never converges, and appends no duplicate", async () => {
    const env = await loaded();
    const first = ev(HEDGED, 1, "usage_change", "silent");
    expect(await tryInsert(env.runtime, first)).toBe("ok");
    const identical = await tryInsert(env.runtime, first);
    const nextSequence = await tryInsert(env.runtime, { ...first, seq: 2 });
    const conflicting = await tryInsert(env.runtime, {
      ...first,
      usage: "hedged_only",
    });
    const distinct = await tryInsert(
      env.runtime,
      ev(HEDGED, 2, "usage_change", "silent"),
    );
    observations.retryCharacterization = {
      identical,
      nextSequence,
      conflicting,
      distinct,
    };
    expect(identical).toBe("23514"); // same sequence: guard rejects (no convergence)
    expect(nextSequence).toBe("23505"); // same authored id under the next sequence: primary key rejects it
    expect(conflicting).toBe("23514");
    expect(distinct).toBe("ok"); // distinct identities are distinct events
    const live = await claimOf(env.runtime, HEDGED);
    expect(live.events).toHaveLength(2);
  }, 120000);

  it("an uncommitted appender is a lock HOLDER; a second appender is observed WAITING in PostgreSQL; a separate freeze returns the committed prefix; the old entry stays consistent", async () => {
    const env = await loaded();
    const [poolA, poolB, poolR] = [
      actorPool(env),
      actorPool(env),
      actorPool(env),
    ];
    const [a, b] = [await poolA.connect(), await poolB.connect()];
    try {
      expect(await tryInsert(poolR, ev(HEDGED, 1, "contest"))).toBe("ok");
      const [entry1] = await freezeClaims(poolR, [HEDGED], {
        [HEDGED]: "assertable",
      });
      expect(must(entry1).state_event_cursor?.event_sequence).toBe(1);
      const [pidA, pidB, pidR] = [
        await backendPid(a),
        await backendPid(b),
        await backendPid(poolR),
      ];
      expect(new Set([pidA, pidB, pidR]).size).toBe(3);

      await a.query("BEGIN");
      const e2 = ev(HEDGED, 2, "usage_change", "silent");
      await a.query(insertSql, insertValues(e2)); // uncommitted: holds the per-claim advisory lock
      const held = await env.owner.query<{ granted: boolean; classid: number }>(
        "SELECT granted, classid::int AS classid FROM pg_locks WHERE pid = $1 AND locktype = 'advisory'",
        [pidA],
      );
      expect(
        held.rows.some(
          (r) => r.granted && r.classid === MIGRATION_CLAIM_LOCK_CLASS,
        ),
      ).toBe(true);
      const waitingNow = await env.owner.query(
        "SELECT 1 FROM pg_locks WHERE pid = $1 AND NOT granted",
        [pidA],
      );
      expect(waitingNow.rowCount).toBe(0); // the holder is not itself waiting

      // a SEPARATE reader returns the committed prefix while the next event is uncommitted, without blocking
      const [during] = await within(
        freezeClaims(poolR, [HEDGED], { [HEDGED]: "assertable" }),
        20000,
        "freeze during uncommitted append",
      );
      expect(must(during).state_event_cursor?.event_sequence).toBe(1);

      // a second appender blocks on the same claim lock; PostgreSQL reports it waiting on A
      await b.query("BEGIN");
      const e3 = ev(HEDGED, 3, "confirm");
      const pending = b
        .query(insertSql, insertValues(e3))
        .then(() => "ok", sqlstate);
      const [waiter] = await waitForBlocked(env.owner, env.name, (found) =>
        found.some(
          (w) =>
            w.pid === pidB &&
            w.locktype === "advisory" &&
            w.blockers.includes(pidA),
        ),
      );
      expect(waiter?.pid).toBe(pidB);
      expect(waiter?.classid).toBe(MIGRATION_CLAIM_LOCK_CLASS);
      const [whileWaiting] = await within(
        freezeClaims(poolR, [HEDGED], { [HEDGED]: "assertable" }),
        20000,
        "freeze while a waiter is queued",
      );
      expect(must(whileWaiting).state_event_cursor?.event_sequence).toBe(1);

      await a.query("COMMIT");
      expect(await within(pending, 30000, "second appender")).toBe("ok"); // seq 3 > committed max 2
      await b.query("COMMIT");

      const live = await claimOf(poolR, HEDGED);
      expect(live.events.map((e) => e.event_sequence)).toEqual([1, 2, 3]);
      const verified = verifyFrozenEntry({
        entry: entry1,
        claim: live.claim,
        liveEvents: live.events,
        frozenCeiling: "assertable",
        currentCeiling: "assertable",
      });
      expect(verified.materialDifference).toBe(true);
      expect(verified.liveEventsAfterCursor).toBe(2);
      const [after] = await freezeClaims(poolR, [HEDGED], {
        [HEDGED]: "assertable",
      });
      expect(must(after).state_event_cursor?.event_sequence).toBe(3);
      observations.holderAndWaiter = {
        holder: pidA,
        waiter: pidB,
        reader: pidR,
        waiterLock: {
          locktype: waiter?.locktype,
          classid: waiter?.classid,
          blockers: waiter?.blockers,
        },
        cursorDuring: 1,
        cursorAfter: 3,
      };
    } finally {
      await a.query("ROLLBACK").catch(() => undefined);
      await b.query("ROLLBACK").catch(() => undefined);
      a.release();
      b.release();
      await Promise.all([poolA.end(), poolB.end(), poolR.end()]);
    }
  }, 240000);

  it("a second appender racing the SAME sequence waits behind the holder and is rejected after the holder commits", async () => {
    const env = await loaded();
    const [poolA, poolB] = [actorPool(env), actorPool(env)];
    const [a, b] = [await poolA.connect(), await poolB.connect()];
    try {
      const [pidA, pidB] = [await backendPid(a), await backendPid(b)];
      await a.query("BEGIN");
      await a.query(insertSql, insertValues(ev(ASSERTABLE, 1, "contest")));
      await b.query("BEGIN");
      const pending = b
        .query(insertSql, insertValues(ev(ASSERTABLE, 1, "expire")))
        .then(() => "ok", sqlstate);
      await waitForBlocked(env.owner, env.name, (found) =>
        found.some(
          (w) =>
            w.pid === pidB &&
            w.locktype === "advisory" &&
            w.blockers.includes(pidA),
        ),
      );
      await a.query("COMMIT");
      expect(await within(pending, 30000, "racing appender")).toBe("23514");
      await b.query("ROLLBACK");
      const live = await claimOf(env.runtime, ASSERTABLE); // a, b are checked out of their max-1 pools
      expect(live.events.map((e) => e.event_type)).toEqual(["contest"]);
    } finally {
      await a.query("ROLLBACK").catch(() => undefined);
      await b.query("ROLLBACK").catch(() => undefined);
      a.release();
      b.release();
      await Promise.all([poolA.end(), poolB.end()]);
    }
  }, 240000);

  it("concurrent appenders with continuous freezes: every freeze is an exact sequence-prefix of the final log", async () => {
    const env = await loaded();
    const appenders = Array.from({ length: 4 }, () => actorPool(env));
    const reader = actorPool(env);
    const perAppender = 6;
    const flag = { done: false };
    const freezes: {
      visible: readonly ClaimStateEvent[];
      cursor: number | null;
    }[] = [];
    let collisions = 0;
    try {
      const append = async (pool: pg.Pool): Promise<void> => {
        for (let i = 0; i < perAppender; i += 1) {
          for (let attempt = 0; attempt < 400; attempt += 1) {
            const max = Number(
              (
                await pool.query<{ n: string }>(
                  "SELECT coalesce(max(event_sequence), 0) AS n FROM claim_state_events WHERE claim_id = $1",
                  [SILENT],
                )
              ).rows[0]?.n,
            );
            const outcome = await tryInsert(
              pool,
              ev(SILENT, max + 1, i % 2 === 0 ? "contest" : "confirm"),
            );
            if (outcome === "ok") break;
            if (outcome !== "23514") throw new Error(`unexpected ${outcome}`);
            collisions += 1;
            if (attempt === 399) throw new Error("append starved");
          }
        }
      };
      const freezer = (async (): Promise<void> => {
        while (!flag.done) {
          const [log] = await readClaimLogs(reader, [SILENT]);
          const entry = freezeClaimPrefix(
            must(log).claim,
            must(log).events,
            "assertable",
          );
          freezes.push({
            visible: must(log).events,
            cursor: entry.state_event_cursor?.event_sequence ?? null,
          });
        }
      })();
      await within(
        Promise.all(appenders.map(append)).finally(() => {
          flag.done = true;
        }),
        120000,
        "appenders",
      );
      await within(freezer, 30000, "freezer");
      const final = await claimOf(reader, SILENT);
      expect(final.events).toHaveLength(4 * perAppender);
      const sequences = final.events.map((e) => e.event_sequence);
      expect(sequences).toEqual([...sequences].sort((x, y) => x - y));
      expect(new Set(sequences).size).toBe(sequences.length);
      expect(freezes.length).toBeGreaterThan(0);
      for (const f of freezes) {
        const expected = final.events.filter(
          (e) => e.event_sequence <= (f.cursor ?? 0),
        );
        expect(f.visible).toHaveLength(expected.length);
        f.visible.forEach((row, i) => {
          expect(sameEvent(row, must(expected[i]))).toBe(true);
        });
      }
      observations.concurrentStress = {
        appenders: 4,
        perAppender,
        finalEvents: final.events.length,
        freezes: freezes.length,
        appendCollisionsRetried: collisions,
      };
    } finally {
      flag.done = true;
      await Promise.all([...appenders, reader].map((p) => p.end()));
    }
  }, 300000);

  it("tamper characterization over real rows: cursor/state changes are detected; reason-only and reduction-preserving edits are NOT (the hash is not a history proof)", async () => {
    const env = await loaded();
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const seed: [number, string, string | undefined][] = [
      [1, "contest", undefined],
      [2, "confirm", undefined],
      [3, "usage_change", "silent"],
    ];
    for (const [i, [seq, type, usage]] of seed.entries())
      await env.runtime.query(
        insertSql,
        insertValues({
          id: must(ids[i]),
          claim: HEDGED,
          type,
          seq,
          ...(usage ? { usage } : {}),
        }),
      );
    const [entry] = await freezeClaims(env.runtime, [HEDGED], {
      [HEDGED]: "assertable",
    });
    const verify = async (): Promise<string> => {
      const live = await claimOf(env.runtime, HEDGED);
      try {
        return verifyFrozenEntry({
          entry,
          claim: live.claim,
          liveEvents: live.events,
          frozenCeiling: "assertable",
          currentCeiling: "assertable",
        }).materialDifference
          ? "consistent;live-differs"
          : "consistent;no-difference";
      } catch (e) {
        return e instanceof ClaimStateError ? e.code : "other";
      }
    };
    const tamper = async (sql: string, values: unknown[]): Promise<void> => {
      const c = await env.owner.connect();
      try {
        await c.query("SET session_replication_role = replica"); // superuser-only bypass of immutability and the append guard
        await c.query(sql, values);
      } finally {
        c.release();
      }
    };
    expect(await verify()).toBe("consistent;no-difference");
    await tamper(
      "UPDATE claim_state_events SET event_payload = jsonb_set(event_payload, '{reason}', '\"rewritten\"'), occurred_at = '1999-01-01T00:00:00Z' WHERE claim_state_event_id = $1",
      [ids[0]],
    );
    const reasonOnly = await verify();
    expect(reasonOnly).toBe("consistent;no-difference"); // NOT detected
    await tamper(
      "UPDATE claim_state_events SET event_type = 'demote' WHERE claim_state_event_id = $1",
      [ids[0]],
    );
    const intermediate = await verify();
    expect(intermediate).toBe("consistent;no-difference"); // intermediate edit overridden by event 2: NOT detected
    await tamper(
      "UPDATE claim_state_events SET event_payload = jsonb_set(event_payload, '{usage_class}', '\"hedged_only\"') WHERE claim_state_event_id = $1",
      [ids[2]],
    );
    expect(await verify()).toBe("entry_reduction_mismatch"); // changed resulting usage: detected
    await tamper(
      "UPDATE claim_state_events SET event_sequence = 4 WHERE claim_state_event_id = $1",
      [ids[2]],
    );
    expect(await verify()).toBe("cursor_sequence_mismatch"); // cursor/sequence disagreement: detected
    observations.tamperCharacterization = {
      reasonOnlyEdit: reasonOnly,
      reductionPreservingIntermediateEdit: intermediate,
      resultingUsageChange: "entry_reduction_mismatch",
      cursorSequenceChange: "cursor_sequence_mismatch",
      note: "reason/actor/time and reduction-preserving intermediate edits are outside the three-field state hash and the cursor",
    };
  }, 120000);

  it("jsonb keeps 1.0 in text but normalizes 1e0; node-pg's parsed value has lost the lexeme (validated-object vs raw-source guarantees)", async () => {
    const env = await loaded();
    const row = (
      await env.runtime.query<{ j: Record<string, unknown>; t: string }>(
        `SELECT '{"event_sequence":1.0,"b":1e0}'::jsonb AS j, '{"event_sequence":1.0,"b":1e0}'::jsonb::text AS t`,
      )
    ).rows[0];
    const probe = must(row);
    expect(probe.j.event_sequence).toBe(1); // node-pg parsed value: lexeme lost
    const lexical = parseLexicalJson(probe.t) as Record<string, unknown>;
    expect(lexical.event_sequence).toBeInstanceOf(LexicalNumber); // raw jsonb text still carries 1.0
    expect(lexical.b).toBe(1); // jsonb normalized 1e0 to 1: an exponent form is indistinguishable after storage
    const cursor = {
      claim_state_event_id: randomUUID(),
      event_sequence: lexical.event_sequence,
    };
    expect(() => parseStateCursor(cursor)).toThrow(/cursor_sequence_type/);
    expect(
      parseStateCursor({ ...cursor, event_sequence: probe.j.event_sequence }),
    ).toMatchObject({ event_sequence: 1 });
    observations.jsonbLexeme = { text: probe.t };
  }, 120000);

  it("the offline vectors still pass in the same process as the database tests (shared production code)", () => {
    const doc = loadClaimEventConformance() as unknown as {
      claims: Record<string, VectorClaim>;
      vectors: unknown[];
    };
    for (const v of doc.vectors) expect(runVector(v, doc.claims).ok).toBe(true);
  });
});
