import { randomUUID } from "node:crypto";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  sameEvent,
  parseClaimStateEvent,
} from "../../src/knowledge/claim-state.js";
import {
  appendClaimStateEvent,
  lookupClaimEvent,
  readClaimLogHead,
  type AuthoredClaimEvent,
} from "../../src/runtime/claim-events.js";
import { rethrow, runCommand } from "../../src/runtime/command.js";
import {
  persistEvidenceUnit,
  type PersistEvidenceUnitInput,
} from "../../src/runtime/evidence.js";
import { runEvidenceSlice } from "../../src/runtime/slice.js";
import { evidenceBodyHash } from "../../src/identity/domains.js";
import { TestCluster, type DbEnv } from "../support/db-env.js";
import {
  accountIds,
  claimIds,
  fixtureUnits,
  prepareUnitsAndSupports,
  seedPrerequisites,
  sliceInput,
} from "../support/a5-fixture.js";
import { observe, withChild } from "../support/a5-crash.js";
import { backendPid, waitForBlocked } from "../support/pg-wait.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const cluster = databaseUrl ? new TestCluster(databaseUrl) : undefined;
const must = <T>(v: T | undefined): T => {
  if (v === undefined) throw new Error("missing");
  return v;
};
const GUARD_CLASS = 182736452;

const actorPool = (env: DbEnv, extra = ""): pg.Pool =>
  new pg.Pool({
    connectionString: env.runtimeUrl,
    options: `-c role=desk_runtime${extra}`,
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

const [CLAIM, CLAIM2] = [must(claimIds()[0]), must(claimIds()[1])];
const [ACTOR, ACTOR2] = [must(accountIds()[1]), must(accountIds()[0])];
let n = 0;
const ev = (over: Partial<AuthoredClaimEvent> = {}): AuthoredClaimEvent => {
  n += 1;
  return {
    claim_state_event_id: `d1250099-0000-4000-8000-${String(n).padStart(12, "0")}`,
    claim_id: CLAIM,
    actor_id: ACTOR,
    occurred_at: "2026-09-27T13:30:00.123456Z",
    event_type: "usage_change",
    event_sequence: 1,
    event_payload: {
      reason_code: "synthetic",
      reason: "a5.1 test event",
      usage_class: "silent",
    },
    ...over,
  };
};
const eventRows = async (env: DbEnv, claim = CLAIM): Promise<number[]> =>
  (
    await env.owner.query(
      "SELECT event_sequence FROM claim_state_events WHERE claim_id = $1 ORDER BY event_sequence",
      [claim],
    )
  ).rows.map((r: { event_sequence: number }) => r.event_sequence);

if (cluster) {
  beforeAll(async () => {
    await cluster.bootstrap();
  }, 120000);
  afterAll(async () => {
    await cluster.shutdown();
  });
}

suite("A5.1 evidence units (disposable PostgreSQL 17, runtime role)", () => {
  const unit0 = (): PersistEvidenceUnitInput => {
    const { unit, rights } = must(fixtureUnits()[0]);
    return { unit, rights };
  };

  it("E1: an identical retry converges on the stored record; row-level only without a verified snapshot", async () => {
    const env = await fresh();
    const pool = actorPool(env);
    try {
      const a = await persistEvidenceUnit(pool, unit0());
      expect(a.kind).toBe("created");
      const b = await persistEvidenceUnit(pool, unit0());
      expect(b.kind).toBe("converged");
      if (a.kind === "created" && b.kind === "converged") {
        expect(b.record.unit).toEqual(a.record.unit);
        expect(b.record.comparison).toBe("row_only");
        expect(b.record.snapshot.status).toBe("not_supplied");
      }
      expect(await count(env, "evidence_units")).toBe(1);
      expect(idle(pool)).toBe(true);
    } finally {
      await pool.end();
      await env.close();
    }
  }, 120000);

  it("E2: every changed immutable datum conflicts per field; nothing is committed, including incidental rights rows", async () => {
    const env = await fresh();
    const pool = actorPool(env);
    try {
      await persistEvidenceUnit(pool, unit0());
      const base = unit0();
      const body2 = "A different body.";
      const cases: [string, PersistEvidenceUnitInput][] = [
        [
          "body_hash",
          {
            ...base,
            unit: {
              ...base.unit,
              canonical_content: body2,
              content_hash: evidenceBodyHash(body2),
            },
          },
        ],
        [
          "evidence_type",
          { ...base, unit: { ...base.unit, evidence_type: "analysis" } },
        ],
        [
          "usage_class",
          { ...base, unit: { ...base.unit, usage_class: "silent" } },
        ],
        [
          "rights",
          {
            unit: { ...base.unit, rights_version_id: randomUUID() },
            rights: { ...base.rights, rights_version_id: "" },
          },
        ],
        [
          "supersession",
          {
            ...base,
            unit: {
              ...base.unit,
              supersedes_evidence_unit_id:
                "d1250007-0000-4000-8000-000000000002",
            },
          },
        ],
        [
          "created_at",
          {
            ...base,
            unit: { ...base.unit, created_at: "2026-09-27T12:59:00.000001Z" },
          },
        ],
        [
          "rights",
          {
            ...base,
            rights: {
              ...base.rights,
              policy: { ...(base.rights.policy as object), x: 1 },
            },
          },
        ],
      ];
      const rightsBefore = await count(env, "rights_versions");
      for (const [code, input] of cases) {
        if (code === "rights" && input.rights.rights_version_id === "") {
          // a DIFFERENT rights id: the unit and rights agree with each other, but the stored unit has another rights id.
          const id = randomUUID();
          input.unit.rights_version_id = id;
          input.rights = { ...base.rights, rights_version_id: id };
        }
        const o = await persistEvidenceUnit(pool, input);
        expect(o.kind).toBe(code === "body_hash" ? "conflict" : "conflict");
        if (o.kind === "conflict") expect(o.code).toBe(code);
      }
      expect(await count(env, "evidence_units")).toBe(1);
      // the new rights id used by the rights-conflict case was NOT committed
      expect(await count(env, "rights_versions")).toBe(rightsBefore);
      expect(idle(pool)).toBe(true);
    } finally {
      await pool.end();
      await env.close();
    }
  }, 120000);

  it("E2b: unit/rights identity disagreement, bad hash, non-NFC, bad type and 7-digit timestamps are rejected before any write", async () => {
    const env = await fresh();
    const pool = actorPool(env);
    try {
      const base = unit0();
      const rejects = async (input: PersistEvidenceUnitInput, code: string) => {
        const o = await persistEvidenceUnit(pool, input);
        expect(o).toMatchObject({ kind: "rejected", code });
      };
      await rejects(
        {
          ...base,
          rights: { ...base.rights, rights_version_id: randomUUID() },
        },
        "unit_rights_identity_mismatch",
      );
      await rejects(
        { ...base, unit: { ...base.unit, content_hash: "0".repeat(64) } },
        "body_hash_mismatch",
      );
      const decomposed = "é";
      await rejects(
        {
          ...base,
          unit: {
            ...base.unit,
            canonical_content: decomposed,
            content_hash: evidenceBodyHash(decomposed),
          },
        },
        "body_not_nfc",
      );
      await rejects(
        { ...base, unit: { ...base.unit, evidence_type: "bogus" } },
        "invalid_evidence_type",
      );
      await rejects(
        {
          ...base,
          unit: { ...base.unit, created_at: "2026-09-27T12:59:00.1234567Z" },
        },
        "timestamp_precision",
      );
      expect(await count(env, "evidence_units")).toBe(0);
      expect(await count(env, "rights_versions")).toBe(0);
    } finally {
      await pool.end();
      await env.close();
    }
  }, 120000);

  it("E3: a different UUID with an equal body hash is a different unit (no body-hash dedup)", async () => {
    const env = await fresh();
    const pool = actorPool(env);
    try {
      const base = unit0();
      const twin = {
        ...base,
        unit: {
          ...base.unit,
          evidence_unit_id: "d1250007-0000-4000-8000-0000000000f1",
        },
      };
      expect((await persistEvidenceUnit(pool, base)).kind).toBe("created");
      expect((await persistEvidenceUnit(pool, twin)).kind).toBe("created");
      const r = await env.owner.query(
        "SELECT count(*) AS n, count(DISTINCT content_hash) AS h FROM evidence_units",
      );
      expect(r.rows[0]).toEqual({ n: "2", h: "1" });
    } finally {
      await pool.end();
      await env.close();
    }
  }, 120000);

  it("E4: concurrent creators of the same unit - one row; the loser's wait is observed in pg_locks and it converges", async () => {
    const env = await fresh();
    const pool = actorPool(env);
    const holder = await env.owner.connect();
    try {
      const { unit, rights } = unit0();
      // The "other worker": an independent session that inserted rights and unit but has not committed.
      await holder.query("BEGIN");
      await holder.query(
        "INSERT INTO rights_versions (rights_version_id, source_identity, policy, created_at) VALUES ($1,$2,$3::jsonb,$4)",
        [
          rights.rights_version_id,
          rights.source_identity,
          JSON.stringify(rights.policy),
          rights.created_at,
        ],
      );
      await holder.query(
        "INSERT INTO evidence_units (evidence_unit_id, content_hash, evidence_type, usage_class, canonical_content, rights_version_id, supersedes_evidence_unit_id, created_at) VALUES ($1,$2,$3,$4,to_jsonb($5::text),$6,NULL,$7)",
        [
          unit.evidence_unit_id,
          unit.content_hash,
          unit.evidence_type,
          unit.usage_class,
          unit.canonical_content,
          unit.rights_version_id,
          unit.created_at,
        ],
      );
      const holderPid = await backendPid(holder);
      const pending = persistEvidenceUnit(pool, { unit, rights });
      const waits = await waitForBlocked(env.owner, env.name, (w) =>
        w.some((x) => x.blockers.includes(holderPid)),
      );
      expect(waits.length).toBeGreaterThan(0);
      await holder.query("COMMIT");
      const o = await pending;
      expect(o.kind).toBe("converged");
      expect(await count(env, "evidence_units")).toBe(1);
      expect(idle(pool)).toBe(true);
    } finally {
      holder.release();
      await pool.end();
      await env.close();
    }
  }, 120000);

  it("E4b: four independent sessions race the same unit: exactly one created, the rest converged, one row", async () => {
    const env = await fresh();
    const pools = [0, 1, 2, 3].map(() => actorPool(env));
    try {
      const outcomes = await Promise.all(
        pools.map((p) => persistEvidenceUnit(p, unit0())),
      );
      expect(outcomes.filter((o) => o.kind === "created")).toHaveLength(1);
      expect(outcomes.filter((o) => o.kind === "converged")).toHaveLength(3);
      expect(await count(env, "evidence_units")).toBe(1);
      expect(pools.every(idle)).toBe(true);
    } finally {
      await Promise.all(pools.map((p) => p.end()));
      await env.close();
    }
  }, 120000);

  it("E5: snapshot status is separate from row convergence; verified only against an explicitly identified persisted package", async () => {
    const env = await fresh();
    const pool = actorPool(env);
    try {
      await prepareUnitsAndSupports(env.migrator, pool);
      const input = sliceInput();
      expect((await runEvidenceSlice(pool, input)).complete).toBe(true);
      const withSnapshot = must(input.units[0]);
      const hash = String(
        (await ownerRows(env, "SELECT package_hash FROM evidence_packages"))[0]
          ?.package_hash,
      );
      // no package identified: unverifiable (never "full convergence")
      const a = await persistEvidenceUnit(pool, withSnapshot);
      expect(a.kind).toBe("converged");
      if (a.kind === "converged") {
        expect(a.record.snapshot.status).toBe("unverifiable");
        expect(a.record.comparison).toBe("row_only");
      }
      // identified package not persisted: unverifiable
      const b = await persistEvidenceUnit(pool, {
        ...withSnapshot,
        verifySnapshotAgainstPackageHash: "1".repeat(64),
      });
      expect(
        b.kind === "converged" && b.record.snapshot.status === "unverifiable",
      ).toBe(true);
      // verified against the persisted package
      const c = await persistEvidenceUnit(pool, {
        ...withSnapshot,
        verifySnapshotAgainstPackageHash: hash,
      });
      expect(
        c.kind === "converged" &&
          c.record.comparison === "row_and_snapshot_verified",
      ).toBe(true);
      // altered locator / acquisition_ref conflict
      const snap = must(withSnapshot.snapshot);
      for (const altered of [
        {
          ...snap,
          locator: { ...(snap.locator as object), body_codepoint_end: 47 },
        },
        { ...snap, acquisition_ref: "other" },
        { ...snap, source_item_identity: "other" },
      ]) {
        const o = await persistEvidenceUnit(pool, {
          ...withSnapshot,
          snapshot: altered,
          verifySnapshotAgainstPackageHash: hash,
        });
        expect(o).toMatchObject({
          kind: "conflict",
          code: "provenance_snapshot",
        });
      }
      // a source the rights policy does not cover
      expect(
        await persistEvidenceUnit(pool, {
          ...withSnapshot,
          snapshot: { ...snap, source_identity: "src_not_covered" },
        }),
      ).toMatchObject({
        kind: "rejected",
        code: "snapshot_source_not_covered_by_rights",
      });
      // a unit that is not in the identified package
      const other = must(fixtureUnits()[1]);
      expect(
        await persistEvidenceUnit(pool, {
          ...other,
          snapshot: {
            ...must(other.snapshot),
            evidence_unit_id: other.unit.evidence_unit_id,
          },
          verifySnapshotAgainstPackageHash: hash,
        }),
      ).toMatchObject({ kind: "converged" });
    } finally {
      await pool.end();
      await env.close();
    }
  }, 180000);
});

suite("A5.1 claim-state events", () => {
  it("C1/C3/C4/C5: identical retry converges; a different sequence conflicts; distinct UUIDs at equal time/type both append; stale input is rejected and the UUID stays usable", async () => {
    const env = await fresh();
    const pool = actorPool(env);
    try {
      const e1 = ev();
      expect((await appendClaimStateEvent(pool, e1)).kind).toBe("created");
      const again = await appendClaimStateEvent(pool, e1);
      expect(again.kind).toBe("converged");
      expect(await eventRows(env)).toEqual([1]);
      // CE-RT02: same authored UUID under the next sequence
      expect(
        await appendClaimStateEvent(pool, { ...e1, event_sequence: 2 }),
      ).toMatchObject({
        kind: "conflict",
        code: "retry_duplicate_transition",
      });
      expect(await eventRows(env)).toEqual([1]);
      // CE-RT04/CE-T01: distinct UUIDs, identical claim/time/type
      expect(
        (await appendClaimStateEvent(pool, ev({ event_sequence: 2 }))).kind,
      ).toBe("created");
      expect(
        (await appendClaimStateEvent(pool, ev({ event_sequence: 3 }))).kind,
      ).toBe("created");
      // C5 stale sequence and the UUID stays reusable at a higher sequence (a first insert, not a retry)
      const stale = ev({ event_sequence: 2 });
      expect(await appendClaimStateEvent(pool, stale)).toMatchObject({
        kind: "rejected",
        code: "sequence_not_above_head",
      });
      expect(
        await lookupClaimEvent(pool, stale.claim_state_event_id),
      ).toBeNull();
      expect(
        (await appendClaimStateEvent(pool, { ...stale, event_sequence: 4 }))
          .kind,
      ).toBe("created");
      // first sequence must be 1 on an empty claim
      expect(
        await appendClaimStateEvent(
          pool,
          ev({ claim_id: CLAIM2, event_sequence: 2 }),
        ),
      ).toMatchObject({ kind: "rejected", code: "first_sequence_not_one" });
      expect(await readClaimLogHead(pool, CLAIM)).toEqual({ maxSequence: 4 });
      expect(await eventRows(env)).toEqual([1, 2, 3, 4]);
      expect(idle(pool)).toBe(true);
    } finally {
      await pool.end();
      await env.close();
    }
  }, 120000);

  it("C2: any changed immutable column under the same UUID conflicts (table unchanged)", async () => {
    const env = await fresh();
    const pool = actorPool(env);
    try {
      const e1 = ev();
      await appendClaimStateEvent(pool, e1);
      const identityChanges: [string, Partial<AuthoredClaimEvent>][] = [
        ["claim", { claim_id: CLAIM2 }],
        [
          "payload",
          {
            event_payload: {
              reason_code: "x",
              reason: "y",
              usage_class: "silent",
            },
          },
        ],
        ["type", { event_type: "confirm" }],
      ];
      for (const [, change] of identityChanges)
        expect(
          await appendClaimStateEvent(pool, { ...e1, ...change }),
        ).toMatchObject({
          kind: "conflict",
          code: "duplicate_event_identity_conflict",
        });
      for (const change of [
        { actor_id: ACTOR2 },
        { occurred_at: "2026-09-27T13:30:00.123457Z" }, // +1 microsecond
        { occurred_at: "2026-09-27T13:30:00.124456Z" }, // > 1 ms
      ] as Partial<AuthoredClaimEvent>[])
        expect(
          await appendClaimStateEvent(pool, { ...e1, ...change }),
        ).toMatchObject({
          kind: "conflict",
          code: "retry_duplicate_transition",
        });
      expect(await eventRows(env)).toEqual([1]);
      expect(await eventRows(env, CLAIM2)).toEqual([]);
    } finally {
      await pool.end();
      await env.close();
    }
  }, 120000);

  it("C10: microseconds are compared in SQL: a pair A3 sameEvent treats as equal conflicts; an equivalent offset converges", async () => {
    const env = await fresh();
    const pool = actorPool(env);
    try {
      const e1 = ev({ occurred_at: "2026-09-27T13:30:00.123456Z" });
      const e2 = { ...e1, occurred_at: "2026-09-27T13:30:00.123999Z" };
      const p1 = parseClaimStateEvent({
        ...e1,
        occurred_at: "2026-09-27T13:30:00.123456Z",
      });
      const p2 = parseClaimStateEvent({ ...e2 });
      expect(sameEvent(p1, p2)).toBe(true); // A3 (millisecond) equality - NOT retry identity
      await appendClaimStateEvent(pool, e1);
      expect(await appendClaimStateEvent(pool, e2)).toMatchObject({
        kind: "conflict",
      });
      const stored = await lookupClaimEvent(pool, e1.claim_state_event_id);
      expect(stored?.occurred_at).toBe("2026-09-27T13:30:00.123456Z"); // microseconds survived
      const offset = { ...e1, occurred_at: "2026-09-27T14:30:00.123456+01:00" };
      expect((await appendClaimStateEvent(pool, offset)).kind).toBe(
        "converged",
      );
      expect(
        await appendClaimStateEvent(pool, {
          ...e1,
          occurred_at: "2026-09-27T13:30:00.1234567Z",
        }),
      ).toMatchObject({ kind: "rejected", code: "timestamp_precision" });
    } finally {
      await pool.end();
      await env.close();
    }
  }, 120000);

  it("C6: concurrent explicit-sequence appends from independent sessions: the guard arbitrates, the log stays strictly increasing, no created event is lost", async () => {
    const env = await fresh();
    const pools = [0, 1, 2, 3, 4, 5].map(() => actorPool(env));
    try {
      // all contend for sequence 1
      const same = await Promise.all(
        pools.map((p) => appendClaimStateEvent(p, ev({ event_sequence: 1 }))),
      );
      expect(same.filter((o) => o.kind === "created")).toHaveLength(1);
      expect(same.filter((o) => o.kind === "rejected")).toHaveLength(5);
      // distinct increasing sequences issued concurrently
      const ordered = await Promise.all(
        pools.map((p, i) =>
          appendClaimStateEvent(p, ev({ event_sequence: i + 2 })),
        ),
      );
      const createdSeqs = ordered.flatMap((o, i) =>
        o.kind === "created" ? [i + 2] : [],
      );
      const rows = await eventRows(env);
      expect(rows).toEqual([1, ...createdSeqs.sort((a, b) => a - b)]);
      expect(pools.every(idle)).toBe(true);
    } finally {
      await Promise.all(pools.map((p) => p.end()));
      await env.close();
    }
  }, 120000);

  it("C7: the command starts READ COMMITTED even under a serializable default; the guard itself refuses other levels (0A000)", async () => {
    const env = await fresh();
    const pool = actorPool(
      env,
      " -c default_transaction_isolation=serializable",
    );
    try {
      expect((await appendClaimStateEvent(pool, ev())).kind).toBe("created");
      const client = await env.owner.connect();
      try {
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
        await expect(
          client.query(
            "INSERT INTO claim_state_events (claim_state_event_id, claim_id, event_type, event_payload, actor_id, occurred_at, event_sequence) VALUES ($1,$2,'confirm','{}'::jsonb,$3,now(),2)",
            [randomUUID(), CLAIM, ACTOR],
          ),
        ).rejects.toMatchObject({ code: "0A000" });
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
      await env.close();
    }
  }, 120000);

  it("C8: lost acknowledgement (child killed after COMMIT, before returning): identical resend converges, lookup finds it", async () => {
    const env = await fresh();
    const pool = actorPool(env);
    try {
      const e1 = ev();
      const done = await withChild(
        env.owner,
        env.name,
        {
          url: env.runtimeUrl,
          tag: "c8",
          fault: "after_commit_before_return",
          scenario: "claim",
          event: e1,
        },
        async () => {
          await observe(
            async () =>
              (await lookupClaimEvent(pool, e1.claim_state_event_id)) !== null,
            "claim event committed",
          );
        },
      );
      expect(done.signal).toBe("SIGKILL");
      expect(done.stdout).not.toContain("COMPLETED_WITHOUT_FAULT");
      expect((await appendClaimStateEvent(pool, e1)).kind).toBe("converged");
      expect(
        await lookupClaimEvent(pool, e1.claim_state_event_id),
      ).toMatchObject({ event_sequence: 1 });
      expect(await eventRows(env)).toEqual([1]);
    } finally {
      await pool.end();
      await env.close();
    }
  }, 120000);

  it("C9: child killed while holding the claim advisory lock mid-transaction: nothing committed, lock released, a second worker appends", async () => {
    const env = await fresh();
    const pool = actorPool(env);
    let waiting: Promise<unknown> | undefined;
    try {
      const e1 = ev();
      const done = await withChild(
        env.owner,
        env.name,
        {
          url: env.runtimeUrl,
          tag: "c9",
          fault: "mid_transaction_holding_lock",
          scenario: "claim",
          event: e1,
        },
        async () => {
          await observe(
            async () =>
              Number(
                (
                  await ownerRows(
                    env,
                    `SELECT count(*) AS n FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
                      WHERE l.locktype = 'advisory' AND l.classid = $1 AND l.granted AND a.application_name = 'a5child_c9'`,
                    [GUARD_CLASS],
                  )
                )[0]?.n,
              ) > 0,
            "advisory lock held by the child's backend",
          );
          // a competitor is blocked by the held lock (database-observed); the kill in withChild releases it
          waiting = appendClaimStateEvent(pool, ev());
          await waitForBlocked(env.owner, env.name, (w) =>
            w.some((x) => x.locktype === "advisory"),
          );
        },
      );
      expect(done.signal).toBe("SIGKILL");
      expect(await waiting).toMatchObject({ kind: "created" });
      expect(await lookupClaimEvent(pool, e1.claim_state_event_id)).toBeNull();
      expect(await eventRows(env)).toEqual([1]);
    } finally {
      await waiting?.catch(() => undefined);
      await pool.end();
      await env.close();
    }
  }, 120000);

  it("K2/cleanup: after a unique violation the transaction is usable only after ROLLBACK TO SAVEPOINT; errors roll back and release the connection; unrelated database errors are preserved", async () => {
    const env = await fresh();
    const pool = actorPool(env);
    try {
      await appendClaimStateEvent(pool, ev());
      // raw proof of the PostgreSQL rule
      const raw = await env.owner.connect();
      try {
        await raw.query("BEGIN");
        await expect(raw.query("SELECT 1/0")).rejects.toMatchObject({
          code: "22012",
        });
        await expect(raw.query("SELECT 1")).rejects.toMatchObject({
          code: "25P02",
        });
        await raw.query("ROLLBACK");
      } finally {
        raw.release();
      }
      // through the command helper: attempt() recovers; the next statement works
      const o = await runCommand(pool, async (tx) => {
        const bad = await tx.attempt("SELECT 1/0");
        expect(bad.ok).toBe(false);
        const next = await tx.query("SELECT 1 AS one");
        expect(next.rows[0]?.one).toBe(1);
        return { kind: "rejected", code: "probe" };
      });
      expect(o.kind).toBe("rejected");
      // an unrelated error is rethrown unchanged and the connection is not left in a transaction
      await expect(
        runCommand(pool, async (tx) => {
          const bad = await tx.attempt("SELECT 1/0");
          if (!bad.ok) rethrow(bad.error);
          return { kind: "rejected", code: "unreachable" };
        }),
      ).rejects.toMatchObject({ code: "22012" });
      await expect(
        runCommand(pool, () => Promise.reject(new Error("boom"))),
      ).rejects.toThrow("boom");
      const open = await ownerRows(
        env,
        "SELECT count(*) AS n FROM pg_stat_activity WHERE datname = $1 AND state LIKE 'idle in transaction%'",
        [env.name],
      );
      expect(Number(open[0]?.n)).toBe(0);
    } finally {
      await pool.end();
      await env.close();
    }
  }, 120000);
});
