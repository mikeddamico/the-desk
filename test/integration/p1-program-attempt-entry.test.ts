// P1 on real PostgreSQL 17 with REAL child processes: the development/test process entry (src/cli/program-attempt.ts) emits the configured
// pino JSON with ONE correlation id, keeps truthful partial progress across its three SEPARATE durable commands, recovers from a real
// SIGKILL, never lets cleanup failures or hangs change its original outcome, and never echoes protected content.
// Prerequisites (accounts, show, show-config versions, claims, the evidence units, claim supports) are owned by privileged setup / the
// A5.1 commands, exactly as in production; the entry itself performs no privileged setup.
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { families } from "../../src/fixture/families.js";
import { loadFoundationRows } from "../../src/fixture/loader.js";
import { evidenceBodyHash } from "../../src/identity/domains.js";
import { persistEvidenceUnit } from "../../src/runtime/evidence.js";
import { TestCluster, type DbEnv } from "../support/db-env.js";
import {
  fixturePackageArtifact,
  fixtureUnits,
  prepareUnitsAndSupports,
  rebuildPackage,
  seedSupports,
} from "../support/a5-fixture.js";
import {
  entryEnv,
  jsonLines,
  runEntry,
  runEntryHeld,
} from "../support/p1-entry.js";

vi.setConfig({ testTimeout: 180000, hookTimeout: 180000 });

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
const tables = (): Record<string, Obj[]> =>
  loadFoundationRows().tables as unknown as Record<string, Obj[]>;
const FIXTURE_RUN = must(tables().program_runs?.[0]);
const FIXTURE_ATTEMPT = must(tables().program_run_attempts?.[0]);
const UNITS = fixtureUnits();

const insertRow = async (
  client: pg.PoolClient,
  table: string,
  row: Obj,
): Promise<void> => {
  const family = must(families.find((f) => f.table === table));
  await client.query(
    `INSERT INTO "${table}" (${family.columns.map((c) => `"${c}"`).join(",")}) VALUES (${family.columns.map((_, i) => `$${String(i + 1)}`).join(",")})`,
    family.columns.map((c) =>
      family.jsonb.includes(c) && row[c] !== null && row[c] !== undefined
        ? JSON.stringify(row[c])
        : row[c],
    ),
  );
};
async function seedBase(migrator: pg.Pool): Promise<void> {
  const client = await migrator.connect();
  try {
    await client.query("BEGIN");
    for (const name of ["accounts", "shows", "show_config_versions", "claims"])
      for (const row of tables()[name] ?? [])
        await insertRow(client, name, row);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
const runtimePool = (env: DbEnv): pg.Pool =>
  new pg.Pool({
    connectionString: env.runtimeUrl,
    options: "-c role=desk_runtime",
    max: 2,
  });
/** A migrated database with the prerequisites in place (units persisted by the A5.1 command, then the supports that reference them). */
async function fresh(): Promise<DbEnv> {
  const env = await must(cluster).create({ migrate: true });
  await seedBase(env.migrator);
  const pool = runtimePool(env);
  try {
    await prepareUnitsAndSupports(env.migrator, pool);
  } finally {
    await pool.end();
  }
  return env;
}
const ownerRows = async (
  env: DbEnv,
  sql: string,
  values?: unknown[],
): Promise<Obj[]> => (await env.owner.query<Obj>(sql, values)).rows;
const count = async (env: DbEnv, table: string): Promise<number> =>
  Number((await ownerRows(env, `SELECT count(*) AS n FROM ${table}`))[0]?.n);
/** Identity/binding digest of everything the entry may write (authored ids and bindings only: no database-generated value). */
const digest = async (env: DbEnv): Promise<string> =>
  String(
    (
      await ownerRows(
        env,
        `SELECT md5(string_agg(x, ',' ORDER BY x)) AS d FROM (
           SELECT 'run:' || program_run_id::text || ':' || state::text || ':' || coalesce(show_config_version_id::text,'') AS x FROM program_runs
           UNION ALL SELECT 'attempt:' || attempt_id::text || ':' || program_run_id::text || ':' || state::text || ':' || coalesce(evidence_package_id::text,'') FROM program_run_attempts
           UNION ALL SELECT 'unit:' || evidence_unit_id::text FROM evidence_units
           UNION ALL SELECT 'package:' || evidence_package_id::text FROM evidence_packages
           UNION ALL SELECT 'artifact:' || artifact_id::text FROM artifacts) s`,
      )
    )[0]?.d,
  );

const dir = mkdtempSync(join(tmpdir(), "p1-entry-"));
let fileN = 0;
const inputFile = (content: unknown): string => {
  fileN += 1;
  const path = join(dir, `input-${String(fileN)}.json`);
  writeFileSync(path, JSON.stringify(content));
  return path;
};
const RUN_ID = String(FIXTURE_RUN.program_run_id);
const ATTEMPT_ID = String(FIXTURE_ATTEMPT.attempt_id);
const goodInput = (): {
  run: Obj;
  attempt: Obj;
  slice: { units: unknown[]; pkg: unknown };
} => ({
  run: {
    program_run_id: RUN_ID,
    show_id: String(FIXTURE_RUN.show_id),
    purpose: String(FIXTURE_RUN.purpose),
    created_at: String(FIXTURE_RUN.created_at),
  },
  attempt: {
    attempt_id: ATTEMPT_ID,
    program_run_id: RUN_ID,
    show_config_version_id: String(FIXTURE_ATTEMPT.show_config_version_id),
    created_at: String(FIXTURE_ATTEMPT.created_at),
  },
  slice: { units: UNITS, pkg: fixturePackageArtifact() },
});
const events = (stdout: string): Obj[] => jsonLines(stdout);
const names = (lines: Obj[]): string[] =>
  lines.map((l) => String(l.command ?? l.workflow));
let reference: string | undefined;
/** The digest of one UNINTERRUPTED run (computed once, in its own database), for the kill-and-rerun comparisons. */
async function referenceDigest(): Promise<string> {
  if (reference !== undefined) return reference;
  const env = await fresh();
  try {
    const out = await runEntry(
      [inputFile(goodInput())],
      entryEnv(env.runtimeUrl),
    );
    expect(out.code, out.stderr).toBe(0);
    reference = await digest(env);
    return reference;
  } finally {
    await env.close();
  }
}

suite("P1 process entry (real PostgreSQL, real child processes)", () => {
  it("complete run: exit 0, empty stderr, pino JSON lines with ONE correlation id, the expected closed event sequence, rows durable", async () => {
    const env = await fresh();
    try {
      const out = await runEntry(
        [inputFile(goodInput())],
        entryEnv(env.runtimeUrl),
      );
      expect(out.timedOut).toBe(false);
      expect(out.code, `${out.stderr}${out.stdout}`).toBe(0);
      expect(out.stderr).toBe("");
      // FIRST the durable rows (the commands really ran and committed), THEN the log contract: an entry whose observer or correlation
      // plumbing is disconnected still passes this block and must fail the log assertions below, for that reason only
      expect(
        (
          await ownerRows(
            env,
            "SELECT evidence_package_id IS NOT NULL AS bound FROM program_run_attempts WHERE attempt_id = $1",
            [ATTEMPT_ID],
          )
        )[0],
      ).toEqual({ bound: true });
      expect(await count(env, "program_runs")).toBe(1);
      const lines = events(out.stdout);
      const ids = new Set(lines.map((l) => l.correlation_id));
      expect(ids.size).toBe(1);
      expect([...ids][0]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      const n = names(lines);
      expect(n.slice(0, 2)).toEqual([
        "program_run.create",
        "program_attempt.create",
      ]);
      expect(n.at(-1)).toBe("evidence_slice.run");
      expect(n.filter((x) => x === "evidence_unit.persist")).toHaveLength(
        UNITS.length,
      );
      expect(n.filter((x) => x === "evidence_package.persist")).toHaveLength(1);
      expect(n.filter((x) => x === "package.bind")).toHaveLength(1);
      expect(lines).toHaveLength(2 + UNITS.length + 2 + 1);
      expect(lines.slice(0, 2).map((l) => l.outcome)).toEqual([
        "created",
        "created",
      ]);
      expect(lines[0]).toMatchObject({
        program_run_id: RUN_ID,
        durability: "committed",
        service: "the-desk",
        environment: "test",
      });
      expect(lines.at(-1)).toMatchObject({ complete: true });
      // the child's run_id / attempt_id are derived for the slice's events
      expect(
        lines.filter((l) => l.attempt_id === ATTEMPT_ID).length,
      ).toBeGreaterThan(2);
    } finally {
      await env.close();
    }
  });

  it("an identical re-run converges everywhere (exit 0, every command converged, identical row digest)", async () => {
    const env = await fresh();
    try {
      const file = inputFile(goodInput());
      const first = await runEntry([file], entryEnv(env.runtimeUrl));
      expect(first.code, first.stderr).toBe(0);
      const before = await digest(env);
      const again = await runEntry([file], entryEnv(env.runtimeUrl));
      expect(again.code, again.stderr).toBe(0);
      const lines = events(again.stdout).filter(
        (l) => l.event === "command.completed",
      );
      expect(lines.length).toBeGreaterThan(2);
      expect(lines.every((l) => l.outcome === "converged")).toBe(true);
      expect(await digest(env)).toBe(before);
    } finally {
      await env.close();
    }
  });

  it("a supplied canonical correlation id appears on EVERY line", async () => {
    const env = await fresh();
    try {
      const supplied = randomUUID();
      const out = await runEntry(
        [inputFile(goodInput()), "--correlation-id", supplied],
        entryEnv(env.runtimeUrl),
      );
      expect(out.code, out.stderr).toBe(0);
      const lines = events(out.stdout);
      expect(lines.length).toBeGreaterThan(2);
      expect(lines.every((l) => l.correlation_id === supplied)).toBe(true);
    } finally {
      await env.close();
    }
  });

  it("two separate invocations mint DIFFERENT correlation ids (one per invocation, never shared)", async () => {
    const env = await fresh();
    try {
      const file = inputFile(goodInput());
      const a = events(
        (await runEntry([file], entryEnv(env.runtimeUrl))).stdout,
      );
      const b = events(
        (await runEntry([file], entryEnv(env.runtimeUrl))).stdout,
      );
      expect(a[0]?.correlation_id).not.toBe(b[0]?.correlation_id);
    } finally {
      await env.close();
    }
  });

  it("PARTIAL PROGRESS (a): the attempt conflicts after the run was created: exit 2, the new run row EXISTS, no attempt/slice rows, typed conflict logged", async () => {
    const env = await fresh();
    try {
      const first = await runEntry(
        [inputFile(goodInput())],
        entryEnv(env.runtimeUrl),
      );
      expect(first.code, first.stderr).toBe(0);
      const attemptsBefore = await count(env, "program_run_attempts");
      const R2 = randomUUID();
      const input = goodInput();
      input.run = { ...input.run, program_run_id: R2 };
      // the SAME attempt identity, claimed for the NEW run: an identity conflict at the second command
      input.attempt = { ...input.attempt, program_run_id: R2 };
      const out = await runEntry([inputFile(input)], entryEnv(env.runtimeUrl));
      expect(out.code, `${out.stderr}${out.stdout}`).toBe(2);
      expect(out.stderr).toBe("");
      const lines = events(out.stdout);
      expect(lines.map((l) => [l.command, l.outcome, l.code ?? null])).toEqual([
        ["program_run.create", "created", null],
        [
          "program_attempt.create",
          "conflict",
          "program_attempt_identity_conflict",
        ],
      ]);
      // truthful partial progress: the earlier command's row is committed, nothing later was written
      expect(
        await ownerRows(
          env,
          "SELECT 1 FROM program_runs WHERE program_run_id = $1",
          [R2],
        ),
      ).toHaveLength(1);
      expect(await count(env, "program_run_attempts")).toBe(attemptsBefore);
      expect(
        await ownerRows(
          env,
          "SELECT 1 FROM program_run_attempts WHERE program_run_id = $1",
          [R2],
        ),
      ).toHaveLength(0);
    } finally {
      await env.close();
    }
  });

  it("PARTIAL PROGRESS (b): the slice refuses after run AND attempt were created: exit 2, both rows EXIST, the package is NOT bound; a corrected re-run converges", async () => {
    const env = await fresh();
    try {
      const bad = goodInput();
      const units = structuredClone(UNITS) as unknown as {
        unit: Obj;
      }[];
      must(units[0]).unit.usage_class = "not_a_usage_class";
      bad.slice = { ...bad.slice, units };
      const out = await runEntry([inputFile(bad)], entryEnv(env.runtimeUrl));
      expect(out.code, `${out.stderr}${out.stdout}`).toBe(2);
      expect(out.stderr).toBe("");
      const lines = events(out.stdout);
      expect(lines.slice(0, 2).map((l) => [l.command, l.outcome])).toEqual([
        ["program_run.create", "created"],
        ["program_attempt.create", "created"],
      ]);
      const stopped = must(lines.at(-1));
      expect(stopped).toMatchObject({
        workflow: "evidence_slice.run",
        complete: false,
      });
      expect(
        lines.some((l) => l.outcome === "rejected" || l.outcome === "conflict"),
      ).toBe(true);
      expect(await count(env, "program_runs")).toBe(1);
      expect(await count(env, "program_run_attempts")).toBe(1);
      expect(
        (
          await ownerRows(
            env,
            "SELECT evidence_package_id FROM program_run_attempts WHERE attempt_id = $1",
            [ATTEMPT_ID],
          )
        )[0],
      ).toEqual({ evidence_package_id: null });
      // the corrected input converges the earlier steps and completes the slice
      const fixed = await runEntry(
        [inputFile(goodInput())],
        entryEnv(env.runtimeUrl),
      );
      expect(fixed.code, `${fixed.stderr}${fixed.stdout}`).toBe(0);
      const fixedLines = events(fixed.stdout);
      expect(fixedLines.slice(0, 2).map((l) => l.outcome)).toEqual([
        "converged",
        "converged",
      ]);
      expect(await count(env, "program_runs")).toBe(1);
    } finally {
      await env.close();
    }
  });

  it("privacy, non-vacuous: stored unit content and an unsupported-field canary never reach stdout or stderr", async () => {
    const env = await fresh();
    try {
      const stored = await ownerRows(
        env,
        "SELECT canonical_content::text AS c FROM evidence_units ORDER BY evidence_unit_id LIMIT 1",
      );
      const text = String(must(stored[0]).c);
      const strings: string[] = [];
      const walk = (v: unknown): void => {
        if (typeof v === "string") strings.push(v);
        else if (Array.isArray(v)) v.forEach(walk);
        else if (typeof v === "object" && v !== null)
          Object.values(v).forEach(walk);
      };
      walk(JSON.parse(text));
      // the longest stored string value (a distinctive piece of protected unit content)
      const content = must(strings.sort((a, b) => b.length - a.length)[0]);
      expect(content.length).toBeGreaterThan(10);
      const out = await runEntry(
        [inputFile(goodInput())],
        entryEnv(env.runtimeUrl),
      );
      expect(out.code, out.stderr).toBe(0);
      // the content IS in the database (and in the input file), so its absence from the output is meaningful
      expect(text).toContain(content);
      expect(JSON.stringify(UNITS)).toContain(content);
      expect(out.stdout).not.toContain(content);
      expect(out.stderr).not.toContain(content);
      // a refusal caused by a canary field name is typed in the log and never echoed
      const CANARY = "CANARY_P1_FIELD_c41d9";
      const input = goodInput();
      input.run = { ...input.run, [CANARY]: "CANARY_P1_VALUE_9e2b" };
      const refused = await runEntry(
        [inputFile(input)],
        entryEnv(env.runtimeUrl),
      );
      expect(refused.code).toBe(2);
      const refusedLines = events(refused.stdout);
      expect(refusedLines).toHaveLength(1);
      expect(refusedLines[0]).toMatchObject({
        command: "program_run.create",
        outcome: "rejected",
        code: "unsupported_field",
      });
      expect(`${refused.stdout}${refused.stderr}`).not.toContain("CANARY_P1");
    } finally {
      await env.close();
    }
  });

  describe.each([
    ["after the run COMMIT", 1],
    ["after the attempt COMMIT", 2],
    ["mid-slice (after the second unit COMMIT)", 4],
  ] as const)("real SIGKILL %s", (label, hold) => {
    it("a re-run reaches rows IDENTICAL to an uninterrupted run (exit 0)", async () => {
      const wanted = await referenceDigest();
      const env = await fresh();
      try {
        const file = inputFile(goodInput());
        const held = runEntryHeld([file], entryEnv(env.runtimeUrl), hold);
        await held.held;
        const killed = await held.kill();
        expect(killed.signal, label).toBe("SIGKILL");
        expect(killed.stdout).toContain(`HELD ${String(hold)}`);
        // the work committed before the kill is durable
        expect(await count(env, "program_runs")).toBe(1);
        if (hold >= 2) expect(await count(env, "program_run_attempts")).toBe(1);
        const rerun = await runEntry([file], entryEnv(env.runtimeUrl));
        expect(rerun.code, `${rerun.stderr}${rerun.stdout}`).toBe(0);
        expect(await digest(env)).toBe(wanted);
      } finally {
        await env.close();
      }
    });
  });

  it("privacy with a UNIQUE protected-content canary in a valid authored unit and package: supplied to the real child, persisted and read back EXACTLY from canonical_content, absent from stdout and stderr", async () => {
    // One fixture unit that no claim support references is re-authored with a unique canary body: its content hash is recomputed by the
    // existing evidenceBodyHash contract and the package's entry for it and the package hash are rebuilt (rebuildPackage), so the unit,
    // the package and the slice stay valid. That unit is deliberately NOT pre-persisted: the entry's own child process persists it.
    const CANARY_UNIT = "d1250007-0000-4000-8000-000000000016";
    const canary = `P1_PROTECTED_CANARY ${randomUUID()} (never to be logged)`;
    const env = await must(cluster).create({ migrate: true });
    try {
      await seedBase(env.migrator);
      const pool = runtimePool(env);
      try {
        for (const u of UNITS.filter(
          (x) => x.unit.evidence_unit_id !== CANARY_UNIT,
        )) {
          const o = await persistEvidenceUnit(pool, u);
          expect(o.kind).toBe("created");
        }
        await seedSupports(env.migrator);
      } finally {
        await pool.end();
      }
      const units = structuredClone(UNITS);
      const authored = must(
        units.find((x) => x.unit.evidence_unit_id === CANARY_UNIT),
      ).unit;
      authored.canonical_content = canary;
      authored.content_hash = evidenceBodyHash(canary);
      const pkg = rebuildPackage((payload) => {
        const entry = (payload.manifest as { evidence: Obj[] }).evidence.find(
          (e) => e.evidence_unit_id === CANARY_UNIT,
        );
        must(entry).content_hash = authored.content_hash;
      });
      const file = inputFile({ ...goodInput(), slice: { units, pkg } });
      // supplied to the real child: the canary is in the input file the child reads
      expect(readFileSync(file, "utf8")).toContain(canary);
      expect(
        await ownerRows(
          env,
          "SELECT 1 FROM evidence_units WHERE evidence_unit_id = $1",
          [CANARY_UNIT],
        ),
      ).toHaveLength(0);
      const out = await runEntry([file], entryEnv(env.runtimeUrl));
      expect(out.code, `${out.stderr}${out.stdout}`).toBe(0);
      // persisted by the entry's child and read back EXACTLY from canonical_content
      expect(
        (
          await ownerRows(
            env,
            "SELECT canonical_content #>> '{}' = $2 AS same FROM evidence_units WHERE evidence_unit_id = $1",
            [CANARY_UNIT, canary],
          )
        )[0],
      ).toEqual({ same: true });
      // and absent from BOTH outputs (neither the whole canary nor its unique marker)
      for (const stream of [out.stdout, out.stderr]) {
        expect(stream).not.toContain(canary);
        expect(stream).not.toContain("P1_PROTECTED_CANARY");
        expect(stream).not.toContain(authored.content_hash);
      }
      expect(events(out.stdout).length).toBeGreaterThan(2); // the run really logged: the absence is not an empty-output artifact
    } finally {
      await env.close();
    }
  });

  describe("a command-level error (exit 1) is retained, with cleanup failures after it", () => {
    // A migrated-less database makes the FIRST command throw a real database error (not a typed refusal): the entry must exit 1 with
    // its fixed `command_error` line, no raw Error text anywhere, and then add the fixed `cleanup_failed` line when cleanup also fails.
    const bare = async (): Promise<DbEnv> =>
      must(cluster).create({ migrate: false });
    it("alone: exit 1, one fixed line, the failed command's event on stdout, no raw error text", async () => {
      const env = await bare();
      try {
        const out = await runEntry(
          [inputFile(goodInput())],
          entryEnv(env.runtimeUrl),
        );
        expect(out.timedOut).toBe(false);
        expect(out.code).toBe(1);
        expect(out.stderr).toBe("program-attempt: command_error\n");
        const lines = events(out.stdout);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatchObject({
          command: "program_run.create",
          outcome: "error",
        });
        for (const stream of [out.stdout, out.stderr]) {
          expect(stream).not.toMatch(
            /\brelation\b|permission denied|does not exist/i, // (\b: "correlation_id" is a legitimate field)
          );
        }
      } finally {
        await env.close();
      }
    });

    it.each([
      ["flush_fail", false],
      ["end_reject", false],
      ["flush_hang", true],
      ["end_hang", true],
    ] as const)(
      "%s after the command error: exit stays 1, BOTH fixed lines in order (command_error first), nothing raw, bounded exit",
      async (patch, hangs) => {
        const env = await bare();
        try {
          const out = await runEntry(
            [inputFile(goodInput())],
            entryEnv(env.runtimeUrl),
            { spec: { patch }, timeoutMs: 40000 },
          );
          expect(out.timedOut).toBe(false);
          expect(out.code).toBe(1);
          expect(out.stderr).toBe(
            "program-attempt: command_error\nprogram-attempt: cleanup_failed\n",
          );
          expect(`${out.stdout}${out.stderr}`).not.toContain("INJECTED_");
          expect(events(out.stdout)[0]).toMatchObject({ outcome: "error" });
          if (hangs) {
            expect(out.ms).toBeGreaterThan(4500);
            expect(out.ms).toBeLessThan(30000);
          }
        } finally {
          await env.close();
        }
      },
    );
  });

  describe("cleanup failures never change the original outcome and never mislead", () => {
    it.each([
      ["flush_fail", "INJECTED_FLUSH_FAILURE_CANARY"],
      ["end_reject", "INJECTED_END_FAILURE_CANARY"],
    ] as const)(
      "%s after a SUCCESSFUL run: exit 1 (infrastructure completion failure), fixed line, rows already committed, nothing echoed",
      async (patch, canary) => {
        const env = await fresh();
        try {
          const out = await runEntry(
            [inputFile(goodInput())],
            entryEnv(env.runtimeUrl),
            { spec: { patch } },
          );
          expect(out.timedOut).toBe(false);
          expect(out.code, `${out.stderr}${out.stdout}`).toBe(1);
          expect(out.stderr).toBe("program-attempt: cleanup_failed\n");
          expect(`${out.stdout}${out.stderr}`).not.toContain(canary);
          expect(
            (
              await ownerRows(
                env,
                "SELECT evidence_package_id IS NOT NULL AS bound FROM program_run_attempts WHERE attempt_id = $1",
                [ATTEMPT_ID],
              )
            )[0],
          ).toEqual({ bound: true }); // exit 1 does NOT mean nothing was committed
        } finally {
          await env.close();
        }
      },
    );

    it.each(["flush_hang", "end_hang"] as const)(
      "%s: the fixed 5 s safeguard ends the wait, the process EXITS (no hang), exit 1 after a successful run",
      async (patch) => {
        const env = await fresh();
        try {
          const out = await runEntry(
            [inputFile(goodInput())],
            entryEnv(env.runtimeUrl),
            { spec: { patch }, timeoutMs: 40000 },
          );
          expect(out.timedOut).toBe(false);
          expect(out.code, `${out.stderr}${out.stdout}`).toBe(1);
          expect(out.stderr).toBe("program-attempt: cleanup_failed\n");
          expect(out.ms).toBeGreaterThan(4500);
          expect(out.ms).toBeLessThan(30000);
        } finally {
          await env.close();
        }
      },
    );

    it("a prior nonzero exit (domain refusal, 2) is PRESERVED when cleanup also fails", async () => {
      const env = await fresh();
      try {
        const input = goodInput();
        input.run = { ...input.run, extra_field: 1 };
        const out = await runEntry(
          [inputFile(input)],
          entryEnv(env.runtimeUrl),
          {
            spec: { patch: "end_reject" },
          },
        );
        expect(out.code).toBe(2);
        expect(out.stderr).toBe("program-attempt: cleanup_failed\n");
        const lines = events(out.stdout);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatchObject({ outcome: "rejected" });
      } finally {
        await env.close();
      }
    });
  });
});
