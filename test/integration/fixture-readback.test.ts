import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  FixtureReadBackError,
  persistFixture,
  readFixtureRows,
  sameValue,
  shapeRows,
  verifyPersistedFixture,
  verifyPersistedFixtureOnSnapshot,
} from "../../src/fixture/persist.js";
import { TestCluster, type DbEnv } from "../support/db-env.js";
import { backendPid, within } from "../support/pg-wait.js";
import { must } from "../support/claim-events.js";

// Independent post-commit read-back and database-behavior proofs (A4). Disposable PostgreSQL 17. Every transaction command and
// every read of a verification runs on ONE pinned connection (pool.query is never used for BEGIN/COMMIT or snapshot reads).
const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const cluster = databaseUrl ? new TestCluster(databaseUrl) : undefined;
const evidenceDir = process.env.A4_EVIDENCE_DIR;
const observations: Record<string, unknown> = {};
type R = Record<string, unknown>;
const theCluster = (): TestCluster => must(cluster);

async function loaded(): Promise<DbEnv> {
  const env = await theCluster().create({ migrate: true });
  await persistFixture(env.migrator);
  return env;
}
const digestOf = (rows: Record<string, unknown[]>): string =>
  createHash("sha256").update(JSON.stringify(rows)).digest("hex");
const actorPool = (env: DbEnv): pg.Pool =>
  new pg.Pool({
    connectionString: env.runtimeUrl,
    options: "-c role=desk_runtime",
    max: 1,
  });
const code = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
  } catch (error) {
    return (error as { code?: string }).code ?? (error as Error).message;
  }
  return "accepted";
};
/** Runs `sql` inside a transaction on a pinned superuser connection and always rolls back; returns the failure SQLSTATE and message. */
async function attempt(
  owner: pg.Pool,
  sql: string,
): Promise<{ code: string; message: string }> {
  const client = await owner.connect();
  try {
    await client.query("BEGIN");
    try {
      await client.query(sql);
      return { code: "ok", message: "" };
    } catch (error) {
      const e = error as { code?: string; message: string };
      return { code: e.code ?? "no-code", message: e.message };
    }
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
  }
}

suite("fixture read-back proof (A4) on PostgreSQL", () => {
  beforeAll(async () => {
    await cluster?.bootstrap();
  }, 60000);
  afterAll(async () => {
    if (evidenceDir) {
      await mkdir(evidenceDir, { recursive: true });
      await writeFile(
        join(evidenceDir, "readback-observations.json"),
        `${JSON.stringify(observations, null, 2)}\n`,
      );
    }
    await cluster?.shutdown();
  }, 60000);

  it("verifies the committed rows from a fresh runtime-role session, and repeated reads are identical", async () => {
    const env = await loaded();
    const first = await verifyPersistedFixture(env.runtime);
    expect(first).toEqual({ rows: 398, families: 40 });
    const snapshots: string[] = [];
    for (let i = 0; i < 2; i += 1) {
      const client = await env.runtime.connect();
      try {
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        snapshots.push(digestOf(shapeRows(await readFixtureRows(client))));
        await client.query("COMMIT");
      } finally {
        client.release();
      }
    }
    expect(snapshots[0]).toBe(snapshots[1]);
    observations.postCommit = {
      verified: first,
      repeatedReadDigest: snapshots[0],
    };
  }, 120000);

  it("requires the runtime role and always releases the pinned connection", async () => {
    const env = await loaded();
    expect(await code(verifyPersistedFixture(env.migrator))).toBe(
      "verifier_role",
    ); // desk_migrator is not the runtime role
    // the max-1 migrator pool still works: the pinned client was rolled back and released
    expect(
      (
        await within(
          env.migrator.query<R>("SELECT 1 AS ok"),
          10000,
          "migrator pool after failed verify",
        )
      ).rows[0]?.ok,
    ).toBe(1);
    // an explicit role override is allowed and verifies with the same code
    expect(
      await verifyPersistedFixture(env.migrator, undefined, {
        role: "desk_migrator",
      }),
    ).toEqual({ rows: 398, families: 40 });
  }, 120000);

  it("the snapshot-client entry point requires an explicitly owned REPEATABLE READ READ ONLY transaction and never ends it", async () => {
    const env = await loaded();
    const client = await env.runtime.connect();
    try {
      // autocommit: no transaction at all
      expect(await code(verifyPersistedFixtureOnSnapshot(client))).toBe(
        "verifier_snapshot_not_pinned",
      );
      await client.query("BEGIN"); // READ COMMITTED read-write
      expect(await code(verifyPersistedFixtureOnSnapshot(client))).toBe(
        "verifier_snapshot_not_pinned",
      );
      await client.query("ROLLBACK");
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ"); // read-write
      expect(await code(verifyPersistedFixtureOnSnapshot(client))).toBe(
        "verifier_snapshot_not_pinned",
      );
      await client.query("ROLLBACK");
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      expect(await verifyPersistedFixtureOnSnapshot(client)).toEqual({
        rows: 398,
        families: 40,
      });
      // the caller still owns an open transaction
      expect(
        (await client.query<R>("SHOW transaction_isolation")).rows[0]
          ?.transaction_isolation,
      ).toBe("repeatable read");
      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  }, 120000);

  it("REPRODUCTION/NEGATIVE CONTROL: session defaults REPEATABLE READ + READ ONLY without an explicit transaction are rejected deterministically", async () => {
    const env = await loaded();
    const client = await env.runtime.connect();
    try {
      await client.query(
        "SET default_transaction_isolation = 'repeatable read'",
      );
      await client.query("SET default_transaction_read_only = on");
      // both settings now hold for every statement, yet there is NO transaction: each statement is its own snapshot
      const level = await client.query<R>(
        "SELECT current_setting('transaction_isolation') AS v",
      );
      expect(level.rows[0]?.v).toBe("repeatable read");
      const outcomes: string[] = [];
      for (let i = 0; i < 12; i += 1)
        outcomes.push(await code(verifyPersistedFixtureOnSnapshot(client)));
      expect(outcomes).toEqual(
        Array<string>(12).fill("verifier_not_in_transaction"),
      );
      observations.sessionDefaultsNegativeControl = outcomes;
    } finally {
      await client
        .query("RESET default_transaction_isolation")
        .catch(() => undefined);
      await client
        .query("RESET default_transaction_read_only")
        .catch(() => undefined);
      client.release();
    }
  }, 240000);

  it("savepoint probe assessment: it needs a transaction block, leaves the caller's transaction and snapshot untouched, and never ends it", async () => {
    const env = await loaded();
    const writer = actorPool(env);
    const client = await env.runtime.connect();
    try {
      // autocommit: PostgreSQL itself refuses (25P01), deterministically
      expect(await code(client.query("SAVEPOINT desk_probe"))).toBe("25P01");
      // an open RR RO transaction: the probe succeeds, the transaction stays open, and the snapshot is unchanged
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const before = Number(
        (await client.query<R>("SELECT count(*) AS n FROM accounts")).rows[0]
          ?.n,
      );
      await writer.query(
        "INSERT INTO accounts(display_name, actor_kind) VALUES ('committed after the snapshot', 'service')",
      );
      await client.query("SAVEPOINT desk_probe");
      await client.query("RELEASE SAVEPOINT desk_probe");
      expect(
        Number(
          (await client.query<R>("SELECT count(*) AS n FROM accounts")).rows[0]
            ?.n,
        ),
      ).toBe(before); // new commit still invisible
      expect(
        (
          await client.query<R>(
            "SELECT current_setting('transaction_isolation') AS v",
          )
        ).rows[0]?.v,
      ).toBe("repeatable read");
      await client.query("SELECT 1"); // still an open, usable transaction
      await client.query("ROLLBACK");
      // an aborted transaction block is not a usable snapshot either (25P02)
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await code(client.query("SELECT 1/0"));
      expect(await code(client.query("SAVEPOINT desk_probe"))).toBe("25P02");
      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
      await writer.end();
    }
  }, 240000);

  it("positive control: writers that commit AFTER the caller's snapshot began cannot change what the caller-owned verifier sees", async () => {
    const env = await loaded();
    const writer = actorPool(env);
    const client = await env.runtime.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await client.query("SELECT 1"); // the snapshot is taken here
      for (let i = 0; i < 3; i += 1)
        await writer.query(
          "INSERT INTO accounts(display_name, actor_kind) VALUES ($1, 'service')",
          [`late writer ${String(i)}`],
        );
      await writer.query(
        'INSERT INTO claim_state_events(claim_id, event_type, event_payload, actor_id, occurred_at, event_sequence) VALUES (\'d1250008-0000-4000-8000-000000000001\',\'confirm\',\'{"reason_code":"r","reason":"r"}\'::jsonb,(SELECT account_id FROM accounts LIMIT 1),now(),1)',
      );
      // none of it is visible: the base state verifies, with exactly the original 398 rows
      expect(await verifyPersistedFixtureOnSnapshot(client)).toEqual({
        rows: 398,
        families: 40,
      });
      expect(
        (await client.query<R>("SHOW transaction_isolation")).rows[0]
          ?.transaction_isolation,
      ).toBe("repeatable read");
      await client.query("ROLLBACK");
      // a NEW snapshot sees the committed writes (the event changes the reduced claim state: reported, not accepted)
      expect(await code(verifyPersistedFixture(env.runtime))).not.toBe(
        "accepted",
      );
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
      await writer.end();
    }
  }, 240000);

  it("a concurrent change cannot produce a mixed snapshot under REPEATABLE READ READ ONLY (and does under READ COMMITTED)", async () => {
    const writerPools: pg.Pool[] = [];
    const run = async (
      isolation: string,
    ): Promise<{ accounts: number; events: number; orphanActors: number }> => {
      const env = await loaded(); // a fresh database per isolation level: the writer appends sequence 1 of the claim once
      const writerPool = actorPool(env);
      writerPools.push(writerPool);
      const writeOne = async (): Promise<void> => {
        // ONE committed transaction touching an early family (accounts) and a later one (claim_state_events) atomically
        const w = await writerPool.connect();
        try {
          await w.query("BEGIN");
          const actor = (
            await w.query<R>(
              "INSERT INTO accounts(display_name, actor_kind) VALUES ('racing actor', 'service') RETURNING account_id",
            )
          ).rows[0];
          await w.query(
            'INSERT INTO claim_state_events(claim_id, event_type, event_payload, actor_id, occurred_at, event_sequence) VALUES ($1,\'confirm\',\'{"reason_code":"r","reason":"r"}\'::jsonb,$2,now(),1)',
            ["d1250008-0000-4000-8000-000000000001", must(actor).account_id],
          );
          await w.query("COMMIT");
        } catch (error) {
          await w.query("ROLLBACK").catch(() => undefined);
          throw error;
        } finally {
          w.release();
        }
      };
      const readWithInterleavedWriter = async (
        isolation: string,
      ): Promise<{
        accounts: number;
        events: number;
        orphanActors: number;
      }> => {
        const reader = await env.runtime.connect();
        try {
          await reader.query(`BEGIN ISOLATION LEVEL ${isolation}`);
          let statements = 0;
          const proxy = {
            query: async (text: string, values?: unknown[]) => {
              const result = await reader.query(text, values);
              statements += 1;
              if (statements === 2)
                await within(writeOne(), 20000, "interleaved writer"); // after the columns query and the FIRST family (accounts)
              return result;
            },
          };
          const rows = await readFixtureRows(proxy);
          await reader.query("COMMIT");
          const accounts = new Set(
            must(rows.raw.accounts).map((a) => a.account_id),
          );
          const events = must(rows.raw.claim_state_events);
          return {
            accounts: accounts.size,
            events: events.length,
            orphanActors: events.filter((e) => !accounts.has(e.actor_id))
              .length,
          };
        } finally {
          await reader.query("ROLLBACK").catch(() => undefined);
          reader.release();
        }
      };
      return readWithInterleavedWriter(isolation);
    };
    try {
      const rr = await run("REPEATABLE READ READ ONLY");
      expect(rr).toEqual({ accounts: 2, events: 0, orphanActors: 0 }); // the committed change is invisible to the whole snapshot
      // control: the same interleaving at READ COMMITTED yields an inconsistent (mixed) read: an event whose actor is not in the accounts read earlier
      const rc = await run("READ COMMITTED");
      expect(rc.events).toBe(1);
      expect(rc.orphanActors).toBe(1);
      observations.mixedSnapshot = {
        repeatableReadReadOnly: rr,
        readCommittedControl: rc,
      };
    } finally {
      await Promise.all(writerPools.map((p) => p.end()));
    }
  }, 240000);

  it("the reader takes no write-blocking lock: an open verification snapshot holds only ACCESS SHARE and does not delay a writer", async () => {
    const env = await loaded();
    const writerPool = actorPool(env);
    const reader = await env.runtime.connect();
    try {
      const readerPid = await backendPid(reader);
      await reader.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await verifyPersistedFixtureOnSnapshot(reader); // transaction stays open
      const held = await env.owner.query<{
        locktype: string;
        mode: string;
        granted: boolean;
      }>("SELECT locktype, mode, granted FROM pg_locks WHERE pid = $1", [
        readerPid,
      ]);
      const relationModes = new Set(
        held.rows.filter((r) => r.locktype === "relation").map((r) => r.mode),
      );
      expect([...relationModes]).toEqual(["AccessShareLock"]);
      expect(held.rows.every((r) => r.granted)).toBe(true);
      // a concurrent writer (and the per-claim append guard) completes while the snapshot is open: nothing waits
      const write = await within(
        writerPool.query(
          "INSERT INTO accounts(display_name, actor_kind) VALUES ('while reader open', 'service')",
        ),
        15000,
        "writer while snapshot open",
      );
      expect(write.rowCount).toBe(1);
      const waiting = await env.owner.query(
        "SELECT 1 FROM pg_locks WHERE NOT granted AND database = (SELECT oid FROM pg_database WHERE datname = $1)",
        [env.name],
      );
      expect(waiting.rowCount).toBe(0);
      await reader.query("ROLLBACK");
      observations.noBlockingLocks = {
        relationModes: [...relationModes],
        lockRows: held.rowCount,
      };
    } finally {
      await reader.query("ROLLBACK").catch(() => undefined);
      reader.release();
      await writerPool.end();
    }
  }, 240000);

  it("runtime privilege denial (actual grants) is proved separately from privileged immutable-trigger execution", async () => {
    const env = await loaded();
    const immutable = (
      await env.owner.query<{ relname: string }>(
        `SELECT c.relname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
        WHERE t.tgname = 'immutable_rows' AND NOT t.tgisinternal ORDER BY 1`,
      )
    ).rows.map((r) => r.relname);
    // cross-check the catalog against the migration's own list (the source of the trigger installation)
    const listed = /FOREACH relation IN ARRAY ARRAY\[([^\]]+)\]/.exec(
      await readFile("migrations/001_foundation.sql", "utf8"),
    );
    const declared = [...(listed?.[1] ?? "").matchAll(/'([a-z_]+)'/g)]
      .map((m) => m[1])
      .sort();
    expect(immutable).toEqual(declared);
    const primaryKeyOf = async (rel: string): Promise<string> =>
      String(
        (
          await env.owner.query<R>(
            `SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
              WHERE i.indrelid = $1::regclass AND i.indisprimary`,
            [`"${rel}"`],
          )
        ).rows[0]?.attname,
      );

    // --- (a) actual runtime grants, read from the catalog
    const grants = new Map<string, Record<string, boolean>>();
    for (const rel of immutable) {
      const row = (
        await env.owner.query<Record<string, boolean>>(
          `SELECT has_table_privilege('desk_runtime', $1, 'SELECT') AS s, has_table_privilege('desk_runtime', $1, 'INSERT') AS i,
                has_table_privilege('desk_runtime', $1, 'UPDATE') AS u, has_table_privilege('desk_runtime', $1, 'DELETE') AS d,
                has_table_privilege('desk_runtime', $1, 'TRUNCATE') AS t`,
          [rel],
        )
      ).rows[0];
      grants.set(rel, must(row));
    }
    for (const [rel, g] of grants) {
      expect(g.s, `${rel} SELECT`).toBe(true);
      expect([g.u, g.d, g.t], `${rel} UPDATE/DELETE/TRUNCATE`).toEqual([
        false,
        false,
        false,
      ]);
    }
    const insertRevoked = [...grants]
      .filter(([, g]) => !g.i)
      .map(([rel]) => rel)
      .sort();
    expect(insertRevoked).toEqual([
      "episode_versions",
      "episodes",
      "repair_plan_decisions",
      "review_decisions",
      "show_config_versions",
    ]); // the migration's REVOKE list

    // --- (b) runtime behavior: privilege denial (42501) precedes any trigger, for every immutable relation, rows or not
    const runtime = await env.runtime.connect();
    const denial: Record<string, string[]> = {};
    try {
      for (const rel of immutable) {
        const pk = await primaryKeyOf(rel);
        const outcomes: string[] = [];
        for (const sql of [
          `UPDATE "${rel}" SET "${pk}" = "${pk}"`,
          `DELETE FROM "${rel}"`,
          `TRUNCATE "${rel}"`,
        ]) {
          await runtime.query("BEGIN");
          outcomes.push(await code(runtime.query(sql)));
          await runtime.query("ROLLBACK");
        }
        expect(outcomes, rel).toEqual(["42501", "42501", "42501"]);
        denial[rel] = outcomes;
      }
    } finally {
      runtime.release();
    }

    // --- (c) privileged immutable-trigger execution: the migration role owns the tables, so privileges allow the statement and the
    // TRIGGER is what rejects it (55000). Row triggers need a touched row; relations with no loaded row are disclosed, not claimed.
    const counts = new Map<string, number>();
    for (const rel of immutable)
      counts.set(
        rel,
        Number(
          (
            await env.owner.query<{ n: string }>(
              `SELECT count(*) AS n FROM "${rel}"`,
            )
          ).rows[0]?.n,
        ),
      );
    const withRows = immutable.filter((r) => (counts.get(r) ?? 0) > 0);
    const empty = immutable.filter((r) => (counts.get(r) ?? 0) === 0);
    const triggerRows: Record<
      string,
      { update: string; delete: string; truncate: string }
    > = {};
    const referencing = async (rel: string): Promise<string[]> =>
      (
        await env.owner.query<{ relname: string }>(
          `WITH RECURSIVE r(oid) AS (
           SELECT $1::regclass::oid
           UNION
           SELECT c.conrelid FROM pg_constraint c JOIN r ON c.confrelid = r.oid WHERE c.contype = 'f' AND c.conrelid <> c.confrelid)
         SELECT cl.relname FROM r JOIN pg_class cl ON cl.oid = r.oid WHERE cl.relname <> $2 ORDER BY 1`,
          [`"${rel}"`, rel],
        )
      ).rows.map((x) => x.relname);
    const asOwner = await env.migrator.connect(); // desk_migrator owns the relations: privileges are NOT the reason for any rejection below
    try {
      for (const rel of withRows) {
        const pk = await primaryKeyOf(rel);
        const out = { update: "", delete: "", truncate: "" };
        for (const [key, sql] of [
          [
            "update",
            `UPDATE "${rel}" SET "${pk}" = "${pk}" WHERE ctid = (SELECT ctid FROM "${rel}" LIMIT 1)`,
          ],
          [
            "delete",
            `DELETE FROM "${rel}" WHERE ctid = (SELECT ctid FROM "${rel}" LIMIT 1)`,
          ],
        ] as const) {
          await asOwner.query("BEGIN");
          try {
            const result = await asOwner.query(sql);
            expect(result.rowCount, `${rel} ${key} touched a row`).toBe(1); // unreachable when the trigger rejects
          } catch (error) {
            const e = error as { code?: string; message: string };
            out[key] = e.code ?? "no-code";
            expect(e.message, rel).toContain(
              `immutable relation ${rel} rejects ${key === "update" ? "UPDATE" : "DELETE"}`,
            );
          }
          await asOwner.query("ROLLBACK");
        }
        // TRUNCATE: PostgreSQL checks foreign-key references BEFORE firing triggers, so a referenced relation must be truncated together
        // with everything that references it (transitively) for the BEFORE TRUNCATE trigger to be reached
        const closure = await referencing(rel);
        await asOwner.query("BEGIN");
        try {
          await asOwner.query(
            `TRUNCATE ${[rel, ...closure].map((r) => `"${r}"`).join(", ")}`,
          );
        } catch (error) {
          const e = error as { code?: string; message: string };
          out.truncate = e.code ?? "no-code";
          expect(e.message, `${rel} truncate`).toContain(
            `immutable relation ${rel} rejects TRUNCATE`,
          );
        }
        await asOwner.query("ROLLBACK");
        expect(out, rel).toEqual({
          update: "55000",
          delete: "55000",
          truncate: "55000",
        });
        triggerRows[rel] = out;
      }
    } finally {
      asOwner.release();
    }
    // control: without its referencing relations an FK-referenced table is rejected by the FK check first (0A000), not by the trigger
    expect((await attempt(env.owner, 'TRUNCATE "artifacts"')).code).toBe(
      "0A000",
    );

    // relations with no loaded row: the trigger is present, enabled, BEFORE, row-level for UPDATE and DELETE (catalog), but UPDATE/DELETE
    // execution is NOT demonstrated on them. Disclosed limit.
    for (const rel of empty) {
      const t = (
        await env.owner.query<{ tgenabled: string; tgtype: number }>(
          `SELECT tgenabled, tgtype FROM pg_trigger t WHERE t.tgrelid = $1::regclass AND t.tgname = 'immutable_rows'`,
          [`"${rel}"`],
        )
      ).rows[0];
      expect(t?.tgenabled, rel).toBe("O");
      expect(Number(t?.tgtype) & 1, `${rel} row-level`).toBe(1);
      expect(Number(t?.tgtype) & 2, `${rel} BEFORE`).toBe(2);
      expect(Number(t?.tgtype) & 8, `${rel} DELETE`).toBe(8);
      expect(Number(t?.tgtype) & 16, `${rel} UPDATE`).toBe(16);
    }
    observations.privilegeAndTriggers = {
      immutableRelations: immutable.length,
      runtimeDenial: `42501 for UPDATE, DELETE and TRUNCATE on all ${String(immutable.length)} immutable relations`,
      triggerExecutionOnTouchedRows: withRows.length,
      emptyRelationsTriggerPresentOnly: empty,
      truncateNeedsFkClosure:
        "TRUNCATE of a referenced table alone fails 0A000 before triggers",
    };
    expect(withRows.length + empty.length).toBe(immutable.length);
  }, 300000);

  it("foreign keys reject dangling references on the persisted schema (behavioral sample)", async () => {
    const env = await loaded();
    const sample = [
      "INSERT INTO claim_supports(claim_id, support_kind, evidence_unit_id, support_hash, support_role, external_support_identity) VALUES (gen_random_uuid(), 'evidence', (SELECT evidence_unit_id FROM evidence_units LIMIT 1), repeat('0',64), 'supports_value', NULL)",
      "INSERT INTO turn_claim_uses(turn_id, claim_id, use_mode, span_start, span_end) VALUES (gen_random_uuid(), (SELECT claim_id FROM claims LIMIT 1), 'asserted', 0, 1)",
      "INSERT INTO performance_intents(performance_direction_version_id, turn_id, intent) VALUES (gen_random_uuid(), (SELECT turn_id FROM turns LIMIT 1), '{}'::jsonb)",
    ];
    const outcomes: string[] = [];
    for (const sql of sample)
      outcomes.push((await attempt(env.owner, sql)).code);
    expect(outcomes).toEqual(["23503", "23503", "23503"]);
    observations.foreignKeySample = outcomes;
  }, 120000);

  describe("persisted-row mutation matrix (post-commit verification over real rows)", () => {
    /** A committed, superuser-bypassed row mutation (immutability and guards skipped), verified from a fresh runtime session, then reverted. */
    interface Case {
      name: string;
      apply: string;
      revert: string;
      expect: string;
    }
    const AUDIO =
      "(SELECT artifact_id FROM audio_artifacts ORDER BY audio_artifact_id LIMIT 1)";
    const FIRST_EVENT =
      "(SELECT provider_call_event_id FROM provider_call_events ORDER BY provider_call_event_id LIMIT 1)";
    const matrix: Case[] = [
      {
        name: "numeric: terminal cost 0 instead of 0.0000",
        apply: `UPDATE provider_call_events SET actual_cost = 0 WHERE provider_call_event_id = ${FIRST_EVENT}`,
        revert: `UPDATE provider_call_events SET actual_cost = '0.0000' WHERE provider_call_event_id = ${FIRST_EVENT}`,
        expect: "ledger_event_cost",
      },
      {
        name: "bigint: byte_size off by one",
        apply: `UPDATE artifacts SET byte_size = byte_size + 1 WHERE artifact_id = ${AUDIO}`,
        revert: `UPDATE artifacts SET byte_size = byte_size - 1 WHERE artifact_id = ${AUDIO}`,
        expect: "mapping_row_binding", // the request-to-WAV mapping names the exact byte length
      },
      {
        name: "audio payload byte_length differs from the row (assembly metadata)",
        apply: `UPDATE artifacts SET canonical_payload = jsonb_set(canonical_payload, '{byte_length}', '1') WHERE artifact_id = ${AUDIO}`,
        revert: `UPDATE artifacts SET canonical_payload = jsonb_set(canonical_payload, '{byte_length}', to_jsonb(byte_size)) WHERE artifact_id = ${AUDIO}`,
        expect: "audio_metadata_binding",
      },
      {
        name: "duration_ms off by one",
        apply: `UPDATE audio_artifacts SET duration_ms = duration_ms + 1 WHERE artifact_id = ${AUDIO}`,
        revert: `UPDATE audio_artifacts SET duration_ms = duration_ms - 1 WHERE artifact_id = ${AUDIO}`,
        expect: "audio_duration_ms",
      },
      {
        name: "use span differs from the script payload",
        apply:
          "UPDATE turn_claim_uses SET span_end = span_end + 1 WHERE turn_claim_use_id = (SELECT turn_claim_use_id FROM turn_claim_uses ORDER BY turn_claim_use_id LIMIT 1)",
        revert:
          "UPDATE turn_claim_uses SET span_end = span_end - 1 WHERE turn_claim_use_id = (SELECT turn_claim_use_id FROM turn_claim_uses ORDER BY turn_claim_use_id LIMIT 1)",
        expect: "uses_claim_row_payload",
      },
      {
        name: "support role differs from the frozen snapshot",
        apply:
          "UPDATE claim_supports SET support_role = 'qualifies' WHERE claim_support_id = (SELECT claim_support_id FROM claim_supports ORDER BY claim_support_id LIMIT 1)",
        revert:
          "UPDATE claim_supports SET support_role = 'supports_value' WHERE claim_support_id = (SELECT claim_support_id FROM claim_supports ORDER BY claim_support_id LIMIT 1)",
        expect: "package_support_snapshot",
      },
      {
        name: "rights version no longer permits the packaged paraphrase",
        apply:
          "UPDATE rights_versions SET policy = jsonb_set(policy, '{paraphrase_permission}', 'false') WHERE rights_version_id = (SELECT rights_version_id FROM evidence_units ORDER BY evidence_unit_id LIMIT 1)",
        revert:
          "UPDATE rights_versions SET policy = jsonb_set(policy, '{paraphrase_permission}', 'true') WHERE rights_version_id = (SELECT rights_version_id FROM evidence_units ORDER BY evidence_unit_id LIMIT 1)",
        expect: "package_evidence_permission_exceeds_rights",
      },
      {
        name: "program block payload differs from the brief",
        apply:
          "UPDATE program_blocks SET semantic_payload = jsonb_set(semantic_payload, '{job}', '\"edited\"') WHERE sequence = 1",
        revert:
          "UPDATE program_blocks SET semantic_payload = jsonb_set(semantic_payload, '{job}', '\"Low-stakes opening texture; no fabricated biography.\"') WHERE sequence = 1",
        expect: "program_block_payload",
      },
      {
        name: "approval no longer supersedes the rejection",
        apply:
          "UPDATE take_selections SET supersedes_selection_id = NULL WHERE supersedes_selection_id IS NOT NULL",
        revert:
          "UPDATE take_selections SET supersedes_selection_id = (SELECT take_selection_id FROM take_selections WHERE decision = 'rejected') WHERE decision = 'approved' AND render_block_id = (SELECT render_block_id FROM take_selections WHERE decision = 'rejected')",
        expect: "reroll_selection_chain",
      },
    ];
    it("every mutation is rejected with its exact semantic code; the controls stay accepted; each revert restores acceptance", async () => {
      const env = await loaded();
      const mutate = async (sql: string): Promise<void> => {
        const c = await env.owner.connect();
        try {
          await c.query("BEGIN");
          await c.query("SET LOCAL session_replication_role = replica");
          const result = await c.query(sql);
          expect(result.rowCount, sql).toBeGreaterThan(0);
          await c.query("COMMIT");
        } catch (error) {
          await c.query("ROLLBACK").catch(() => undefined);
          throw error;
        } finally {
          c.release();
        }
      };
      const verifyCode = async (): Promise<string> => {
        try {
          await verifyPersistedFixture(env.runtime);
          return "accepted";
        } catch (error) {
          return (error as { code?: string }).code ?? (error as Error).message;
        }
      };
      expect(await verifyCode()).toBe("accepted");
      const results: Record<string, string> = {};
      for (const c of matrix) {
        await mutate(c.apply);
        results[c.name] = await verifyCode();
        expect(results[c.name], c.name).toBe(c.expect);
        await mutate(c.revert);
        expect(await verifyCode(), `${c.name} (reverted)`).toBe("accepted");
      }
      // controls tied to explicit owning projections: execution timestamps outside the package manifest are NOT hashed
      const controls: Record<string, string> = {};
      await mutate(
        "UPDATE artifacts SET canonical_payload = jsonb_set(jsonb_set(canonical_payload, '{created_at}', '\"2031-01-01T00:00:00Z\"'), '{frozen_at}', '\"2031-01-01T00:00:01Z\"') WHERE artifact_type = 'evidence_package'",
      );
      controls["package created_at/frozen_at (outside evidence-package-v2)"] =
        await verifyCode();
      expect(
        controls["package created_at/frozen_at (outside evidence-package-v2)"],
      ).toBe("accepted");
      // the same edit INSIDE the manifest is a hashed change
      await mutate(
        "UPDATE artifacts SET canonical_payload = jsonb_set(canonical_payload, '{manifest,claims,0,approved_representation}', '\"changed wording\"') WHERE artifact_type = 'evidence_package'",
      );
      controls["package manifest wording (inside evidence-package-v2)"] =
        await verifyCode();
      expect(
        controls["package manifest wording (inside evidence-package-v2)"],
      ).toBe("artifact_hash_mismatch");
      observations.mutationMatrix = { results, controls };
    }, 600000);
  });

  it("numeric and bigint round-trip through the actual database representation without loss", async () => {
    const env = await loaded();
    const read = (
      await env.runtime.query<R>(
        "SELECT actual_cost, pg_typeof(actual_cost)::text AS t FROM provider_call_events LIMIT 1",
      )
    ).rows[0];
    expect(read?.actual_cost).toBe("0.0000"); // pg returns numeric as text and PostgreSQL preserves scale
    expect(read?.t).toBe("numeric");
    expect(sameValue("numeric", read?.actual_cost, "0.0000")).toBe(true);
    const size = (
      await env.runtime.query<R>(
        "SELECT byte_size, pg_typeof(byte_size)::text AS t FROM artifacts WHERE byte_size IS NOT NULL LIMIT 1",
      )
    ).rows[0];
    expect(size?.t).toBe("bigint");
    expect(typeof size?.byte_size).toBe("string");
    expect(sameValue("bigint", size?.byte_size, Number(size?.byte_size))).toBe(
      true,
    );
    // a scale-changing / value-changing mutation is not equal to the shipped exact text
    const c = await env.owner.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL session_replication_role = replica");
      await c.query("UPDATE provider_call_events SET actual_cost = 0");
      const after = (
        await c.query<R>("SELECT actual_cost FROM provider_call_events LIMIT 1")
      ).rows[0];
      expect(after?.actual_cost).toBe("0");
      expect(sameValue("numeric", after?.actual_cost, "0.0000")).toBe(false);
      await c.query("ROLLBACK");
    } finally {
      c.release();
    }
    observations.numericRepresentation = {
      numeric: read?.actual_cost,
      bigintType: size?.t,
    };
    expect(new FixtureReadBackError("x").code).toBe("x");
  }, 120000);

  it("waits are observed by PostgreSQL, not inferred: the verification session never appears as a waiter while a writer commits", async () => {
    const env = await loaded();
    const writerPool = actorPool(env);
    const writer = await writerPool.connect();
    try {
      const writerPid = await backendPid(writer);
      await writer.query("BEGIN");
      await writer.query(
        "INSERT INTO accounts(display_name, actor_kind) VALUES ('uncommitted', 'service')",
      );
      const pending = verifyPersistedFixture(env.runtime); // reads never wait for an uncommitted writer
      const outcome = await within(
        pending,
        60000,
        "verification beside an uncommitted writer",
      );
      expect(outcome).toEqual({ rows: 398, families: 40 }); // the uncommitted account is invisible
      const blocked = await env.owner.query(
        "SELECT pid FROM pg_locks WHERE NOT granted AND pid <> $1",
        [writerPid],
      );
      expect(blocked.rowCount).toBe(0);
      await writer.query("COMMIT");
      expect(await verifyPersistedFixture(env.runtime)).toEqual({
        rows: 399,
        families: 40,
      }); // a committed account IS part of the next snapshot
    } finally {
      await writer.query("ROLLBACK").catch(() => undefined);
      writer.release();
      await writerPool.end();
    }
  }, 240000);
});
