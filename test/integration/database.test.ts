import { randomBytes, randomUUID } from "node:crypto";
import {
  readFile,
  readdir,
  mkdtemp,
  writeFile,
  rm,
  copyFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrate, verifyMigrationIntegrity } from "../../src/db/migrations.js";

import { createMigrationPool, createRuntimePool } from "../../src/db/pool.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const owner = new pg.Pool({ connectionString: databaseUrl });
let migrator: pg.Pool;
let runtime: pg.Pool;
let operator: pg.Pool;
const hash = () => randomBytes(32).toString("hex");
const states = [
  "PENDING",
  "EVIDENCE_READY",
  "PACKAGED",
  "PLANNED",
  "SCRIPTED",
  "PERFORMANCE_DIRECTED",
  "AUDITED",
  "RENDER_PLANNED",
  "SYNTHESIZED",
  "ASSEMBLED",
  "VALIDATED",
  "READY",
  "REVALIDATED",
  "PUBLISHING",
  "PUBLISHED",
];

async function id(
  sql: string,
  values: unknown[] = [],
  db = runtime,
): Promise<string> {
  const result = await db.query<{ id: string }>(sql, values);
  const value = result.rows[0]?.id;
  if (!value) throw new Error("Expected returned identity");
  return value;
}
async function artifact(type = "test") {
  return id(
    "INSERT INTO artifacts(artifact_type,schema_version,content_hash,canonical_payload) VALUES ($1,'v1',$2,'{}') RETURNING artifact_id AS id",
    [type, hash()],
  );
}
async function evidencePackage() {
  return id(
    "INSERT INTO evidence_packages(artifact_id,package_hash) VALUES ($1,$2) RETURNING evidence_package_id AS id",
    [await artifact("evidence_package"), hash()],
  );
}
async function master() {
  const a = await artifact("master");
  await runtime.query(
    "INSERT INTO audio_artifacts(artifact_id,audio_sha256,duration_ms) VALUES ($1,$2,1000)",
    [a, hash()],
  );
  return a;
}
async function seed(purpose = "production", publication = false, pkg?: string) {
  const show = await id(
    "INSERT INTO shows(slug,title) VALUES ($1,'Fixture') RETURNING show_id AS id",
    [randomUUID()],
  );
  const config = await id(
    "INSERT INTO show_config_versions(show_id,version_number,config_hash,schema_version,canonical_payload,pre_publish_review_required) VALUES ($1,1,$2,'v1','{}',true) RETURNING show_config_version_id AS id",
    [show, hash()],
    migrator,
  );
  const run = await id(
    "INSERT INTO program_runs(show_id,purpose) VALUES ($1,$2) RETURNING program_run_id AS id",
    [show, purpose],
  );
  const packageId = pkg ?? (await evidencePackage());
  const attempt = await id(
    "INSERT INTO program_run_attempts(program_run_id,show_config_version_id,evidence_package_id,publication_enabled) VALUES ($1,$2,$3,$4) RETURNING attempt_id AS id",
    [run, config, packageId, publication],
    publication ? migrator : runtime,
  );
  return { show, config, run, attempt, packageId };
}
async function advance(attempt: string, end = "VALIDATED", start = "PENDING") {
  for (let n = states.indexOf(start); n < states.indexOf(end); n++) {
    await runtime.query("SELECT transition_attempt($1,$2,$3)", [
      attempt,
      states[n],
      states[n + 1],
    ]);
  }
}
async function ready(seedValue: Awaited<ReturnType<typeof seed>>) {
  await advance(seedValue.attempt);
  const fingerprint = hash();
  const audio = await master();
  await runtime.query(
    "SELECT transition_attempt($1,'VALIDATED','READY',$2,$3)",
    [seedValue.attempt, fingerprint, audio],
  );
  const version = await id(
    "SELECT episode_version_id AS id FROM episode_versions WHERE attempt_id=$1",
    [seedValue.attempt],
  );
  return { fingerprint, audio, version };
}
async function human() {
  return id(
    "INSERT INTO accounts(display_name,actor_kind) VALUES ('Operator','human') RETURNING account_id AS id",
  );
}
async function review(
  version: string,
  fingerprint: string,
  actor: string,
  decision: string,
  db = operator,
) {
  return db.query(
    "INSERT INTO review_decisions(episode_version_id,ready_candidate_fingerprint,actor_id,decision) VALUES ($1,$2,$3,$4)",
    [version, fingerprint, actor, decision],
  );
}
async function plan(
  attempt: string,
  fingerprint: string,
  actor: string,
  layer = "performance",
) {
  const request = await id(
    "INSERT INTO repair_requests(source_attempt_id,source_ready_fingerprint,actor_id,feedback) VALUES ($1,$2,$3,'Keep the words; restrain delivery') RETURNING repair_request_id AS id",
    [attempt, fingerprint, actor],
  );
  return id(
    "INSERT INTO repair_plans(repair_request_id,plan_version,typed_plan) VALUES ($1,1,$2) RETURNING repair_plan_id AS id",
    [request, { repair_layer: layer }],
  );
}
async function child(
  s: Awaited<ReturnType<typeof seed>>,
  repair: string,
  pkg = s.packageId,
  parent = s.attempt,
  publication = false,
  db = runtime,
) {
  return id(
    "INSERT INTO program_run_attempts(program_run_id,show_config_version_id,evidence_package_id,parent_attempt_id,repair_plan_id,publication_enabled) VALUES ($1,$2,$3,$4,$5,$6) RETURNING attempt_id AS id",
    [s.run, s.config, pkg, parent, repair, publication],
    db,
  );
}

suite("PostgreSQL 17 foundation under effective capability roles", () => {
  beforeAll(async () => {
    const version = await owner.query<{ server_version_num: string }>(
      "SHOW server_version_num",
    );
    expect(Number(version.rows[0]?.server_version_num)).toBeGreaterThanOrEqual(
      170000,
    );
    expect(Number(version.rows[0]?.server_version_num)).toBeLessThan(180000);
    // TEST_DATABASE_URL must target a disposable database. Owner is used only for bootstrap.
    await owner.query(
      "DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS desk_internal CASCADE; CREATE SCHEMA public",
    );
    await owner.query(await readFile("migrations/roles.sql", "utf8"));
    const password = randomBytes(24).toString("hex");
    let migrationUrl = "";
    for (const capability of ["migrator", "runtime", "operator"]) {
      const login = `desk_test_${capability}`;
      await owner.query(
        `DO $$ BEGIN CREATE ROLE ${login} LOGIN NOINHERIT; EXCEPTION WHEN duplicate_object THEN NULL; END $$; ALTER ROLE ${login} PASSWORD '${password}'; GRANT desk_${capability} TO ${login}`,
      );
      const url = new URL(databaseUrl ?? "");
      url.username = login;
      url.password = password;
      if (capability === "migrator") {
        migrationUrl = url.toString();
        migrator = createMigrationPool({
          MIGRATION_DATABASE_URL: migrationUrl,
        });
      } else if (capability === "runtime") {
        runtime = createRuntimePool({ DATABASE_URL: url.toString() });
      } else {
        operator = new pg.Pool({
          connectionString: url.toString(),
          options: "-c role=desk_operator",
        });
      }
    }
    const secondMigrator = createMigrationPool({
      MIGRATION_DATABASE_URL: migrationUrl,
    });
    try {
      await Promise.all([migrate(migrator), migrate(secondMigrator)]);
    } finally {
      await secondMigrator.end();
    }
  }, 30000);
  afterAll(async () => {
    await Promise.all([
      owner.end(),
      migrator.end(),
      runtime.end(),
      operator.end(),
    ]);
  });

  it("migrates from zero, serializes concurrent migrations, reruns and verifies with non-superuser effective identity", async () => {
    for (const [pool, role] of [
      [migrator, "desk_migrator"],
      [runtime, "desk_runtime"],
      [operator, "desk_operator"],
    ] as const) {
      const result = await pool.query<{
        current_user: string;
        session_user: string;
        superuser: string;
      }>(
        "SELECT current_user, session_user, current_setting('is_superuser') AS superuser",
      );
      expect(result.rows[0]).toMatchObject({
        current_user: role,
        superuser: "off",
      });
      expect(result.rows[0]?.session_user).toMatch(/^desk_test_/);
    }
    await expect(verifyMigrationIntegrity(migrator)).resolves.toBeUndefined();
    await expect(migrate(migrator)).resolves.toBeUndefined();
    await expect(migrate(owner)).rejects.toThrow(/effective desk_migrator/);
    const ownership = await owner.query<{ tableowner: string }>(
      "SELECT tableowner FROM pg_tables WHERE schemaname IN ('public','desk_internal')",
    );
    expect(
      ownership.rows.every((row) => row.tableowner === "desk_migrator"),
    ).toBe(true);
  });

  it("rejects evaluation READY, publishing, publication enablement, Episode creation and unknown states", async () => {
    const s = await seed("evaluation");
    await advance(s.attempt);
    await expect(
      runtime.query("SELECT transition_attempt($1,'VALIDATED','READY',$2,$3)", [
        s.attempt,
        hash(),
        await master(),
      ]),
    ).rejects.toThrow(/evaluation/);
    await expect(
      runtime.query("SELECT transition_attempt($1,'VALIDATED','PUBLISHING')", [
        s.attempt,
      ]),
    ).rejects.toThrow(/evaluation/);
    await expect(
      runtime.query(
        "INSERT INTO program_run_attempts(program_run_id,show_config_version_id,publication_enabled) VALUES ($1,$2,true)",
        [s.run, s.config],
      ),
    ).rejects.toThrow(/evaluation/);
    // Migrator exercises the integrity trigger independently of runtime's INSERT restriction.
    await expect(
      migrator.query(
        "INSERT INTO episodes(program_run_id,guid,pub_date) VALUES ($1,$2,now())",
        [s.run, randomUUID()],
      ),
    ).rejects.toThrow(/production READY/);
    await expect(
      runtime.query(
        "INSERT INTO program_runs(show_id,purpose,state) VALUES ($1,'evaluation','created')",
        [s.show],
      ),
    ).rejects.toThrow(/lifecycle_state/);
    await expect(
      runtime.query(
        "INSERT INTO program_run_attempts(program_run_id,show_config_version_id,state) VALUES ($1,$2,'READY')",
        [s.run, s.config],
      ),
    ).rejects.toThrow(/evaluation/);
  });

  it("permits production publication-disabled READY and approved revalidation but rejects publishing, skip, reversal and stale transitions", async () => {
    const s = await seed();
    await expect(
      runtime.query("SELECT transition_attempt($1,'PENDING','SCRIPTED')", [
        s.attempt,
      ]),
    ).rejects.toThrow(/illegal/);
    const candidate = await ready(s);
    await expect(
      runtime.query("SELECT transition_attempt($1,'READY','VALIDATED')", [
        s.attempt,
      ]),
    ).rejects.toThrow(/illegal/);
    await expect(
      runtime.query("SELECT transition_attempt($1,'VALIDATED','READY',$2,$3)", [
        s.attempt,
        candidate.fingerprint,
        candidate.audio,
      ]),
    ).rejects.toThrow(/stale/);
    await expect(
      runtime.query("SELECT transition_attempt($1,'READY','REVALIDATED')", [
        s.attempt,
      ]),
    ).rejects.toThrow(/own approval/);
    await review(
      candidate.version,
      candidate.fingerprint,
      await human(),
      "approve",
    );
    await advance(s.attempt, "REVALIDATED", "READY");
    await expect(
      runtime.query(
        "SELECT transition_attempt($1,'REVALIDATED','PUBLISHING')",
        [s.attempt],
      ),
    ).rejects.toThrow(/publication disabled/);
    await expect(
      runtime.query("SELECT transition_attempt($1,'REVALIDATED','PUBLISHED')", [
        s.attempt,
      ]),
    ).rejects.toThrow(/publication disabled/);
    await runtime.query(
      "SELECT transition_attempt($1,'REVALIDATED','HALTED')",
      [s.attempt],
    );
    await expect(
      runtime.query("SELECT transition_attempt($1,'HALTED','PENDING')", [
        s.attempt,
      ]),
    ).rejects.toThrow(/illegal/);
  });

  it("allows the complete production graph when publication is enabled and binds a package exactly once", async () => {
    const s = await seed("production", true);
    const c = await ready(s);
    await review(c.version, c.fingerprint, await human(), "approve");
    await advance(s.attempt, "PUBLISHED", "READY");
    await expect(
      runtime.query("SELECT transition_attempt($1,'PUBLISHED','HALTED')", [
        s.attempt,
      ]),
    ).rejects.toThrow(/illegal/);
    const pending = await id(
      "INSERT INTO program_run_attempts(program_run_id,show_config_version_id) VALUES ($1,$2) RETURNING attempt_id AS id",
      [s.run, s.config],
    );
    await advance(pending, "EVIDENCE_READY");
    await expect(
      runtime.query(
        "SELECT transition_attempt($1,'EVIDENCE_READY','PACKAGED')",
        [pending],
      ),
    ).rejects.toThrow(/Evidence Package binding/);
    await runtime.query("SELECT bind_evidence_package($1,$2)", [
      pending,
      s.packageId,
    ]);
    await expect(
      runtime.query("SELECT bind_evidence_package($1,$2)", [
        pending,
        await evidencePackage(),
      ]),
    ).rejects.toThrow(/already bound/);
    await advance(pending, "PACKAGED", "EVIDENCE_READY");
  });

  it("rejects cross-show configuration and constrains run projection transitions", async () => {
    const a = await seed();
    const b = await seed();
    await expect(
      runtime.query(
        "INSERT INTO program_run_attempts(program_run_id,show_config_version_id) VALUES ($1,$2)",
        [a.run, b.config],
      ),
    ).rejects.toThrow(/cross-show/);
    await expect(
      runtime.query("SELECT transition_run($1,'PENDING','EVIDENCE_READY')", [
        a.run,
      ]),
    ).rejects.toThrow(/requires an attempt/);
    await advance(a.attempt, "EVIDENCE_READY");
    await runtime.query(
      "SELECT transition_run($1,'PENDING','EVIDENCE_READY')",
      [a.run],
    );
    await expect(
      runtime.query("SELECT transition_run($1,'PENDING','EVIDENCE_READY')", [
        a.run,
      ]),
    ).rejects.toThrow(/stale/);
    await expect(
      runtime.query("SELECT transition_run($1,'EVIDENCE_READY','SCRIPTED')", [
        a.run,
      ]),
    ).rejects.toThrow(/illegal/);
  });

  it("NB1: runtime and operator cannot manufacture show config or self-enable publication, even on a new run", async () => {
    const s = await seed();
    for (const db of [runtime, operator]) {
      await expect(
        db.query(
          "INSERT INTO show_config_versions(show_id,version_number,config_hash,schema_version,canonical_payload,pre_publish_review_required) VALUES ($1,2,$2,'v1','{}',false)",
          [s.show, hash()],
        ),
      ).rejects.toThrow(/permission denied/);
      const run = await id(
        "INSERT INTO program_runs(show_id,purpose) VALUES ($1,'production') RETURNING program_run_id AS id",
        [s.show],
      );
      await expect(
        db.query(
          "INSERT INTO program_run_attempts(program_run_id,show_config_version_id,publication_enabled) VALUES ($1,$2,true)",
          [run, s.config],
        ),
      ).rejects.toThrow(/publication enablement requires privileged setup/);
      expect(
        (
          await runtime.query(
            "SELECT show_config_version_id,publication_enabled FROM program_runs WHERE program_run_id=$1",
            [run],
          )
        ).rows[0],
      ).toEqual({ show_config_version_id: null, publication_enabled: null });
    }
  });

  it("NB1: repair children and parentless rebuilds cannot switch config or elevate publication; valid repair needs fresh approval", async () => {
    const s = await seed();
    const alternate = await id(
      "INSERT INTO show_config_versions(show_id,version_number,config_hash,schema_version,canonical_payload,pre_publish_review_required) VALUES ($1,2,$2,'v1','{}',false) RETURNING show_config_version_id AS id",
      [s.show, hash()],
      migrator,
    );
    const candidate = await ready(s);
    const actor = await human();
    await review(
      candidate.version,
      candidate.fingerprint,
      actor,
      "request_repair",
    );
    const repair = await plan(s.attempt, candidate.fingerprint, actor);
    await operator.query(
      "INSERT INTO repair_plan_decisions(repair_plan_id,actor_id,decision) VALUES ($1,$2,'confirm')",
      [repair, actor],
    );
    await expect(child({ ...s, config: alternate }, repair)).rejects.toThrow(
      /run show-config binding/,
    );
    await expect(
      child(s, repair, s.packageId, s.attempt, true),
    ).rejects.toThrow(/publication enablement requires privileged setup/);
    // Even setup authority cannot elevate an existing run's permission.
    await expect(
      child(s, repair, s.packageId, s.attempt, true, migrator),
    ).rejects.toThrow(/cannot elevate run publication/);
    const rootSql =
      "INSERT INTO program_run_attempts(program_run_id,show_config_version_id,publication_enabled) VALUES ($1,$2,$3) RETURNING attempt_id AS id";
    await expect(id(rootSql, [s.run, alternate, false])).rejects.toThrow(
      /run show-config binding/,
    );
    await expect(id(rootSql, [s.run, s.config, true])).rejects.toThrow(
      /publication enablement requires privileged setup/,
    );
    await expect(id(rootSql, [s.run, alternate, true])).rejects.toThrow(
      /publication enablement requires privileged setup/,
    );
    await expect(
      id(rootSql, [s.run, s.config, true], migrator),
    ).rejects.toThrow(/cannot elevate run publication/);
    await id(rootSql, [s.run, s.config, false]);

    const attempt = await child(s, repair);
    const repaired = await ready({ ...s, attempt });
    await expect(advance(attempt, "REVALIDATED", "READY")).rejects.toThrow(
      /own approval/,
    );
    expect(
      (
        await runtime.query(
          "SELECT * FROM review_decisions WHERE episode_version_id=$1",
          [repaired.version],
        )
      ).rowCount,
    ).toBe(0);
    await review(repaired.version, repaired.fingerprint, actor, "approve");
    await advance(attempt, "REVALIDATED", "READY");
    await expect(advance(attempt, "PUBLISHING", "REVALIDATED")).rejects.toThrow(
      /publication disabled/,
    );
    expect(
      (
        await runtime.query<{ state: string }>(
          "SELECT state FROM program_run_attempts WHERE attempt_id=$1",
          [s.attempt],
        )
      ).rows[0]?.state,
    ).toBe("READY");
    expect(
      (
        await runtime.query(
          "SELECT show_config_version_id,publication_enabled FROM program_run_attempts WHERE attempt_id=$1",
          [attempt],
        )
      ).rows[0],
    ).toEqual({ show_config_version_id: s.config, publication_enabled: false });
  });

  it("NB1: repair inherits exact parent permission even within a setup-enabled run", async () => {
    const s = await seed("production", true);
    const disabled = await id(
      "INSERT INTO program_run_attempts(program_run_id,show_config_version_id,evidence_package_id) VALUES ($1,$2,$3) RETURNING attempt_id AS id",
      [s.run, s.config, s.packageId],
    );
    const parent = { ...s, attempt: disabled };
    const c = await ready(parent);
    const actor = await human();
    await review(c.version, c.fingerprint, actor, "request_repair");
    const repair = await plan(disabled, c.fingerprint, actor);
    await operator.query(
      "INSERT INTO repair_plan_decisions(repair_plan_id,actor_id,decision) VALUES ($1,$2,'confirm')",
      [repair, actor],
    );
    await expect(
      child(parent, repair, s.packageId, disabled, true, migrator),
    ).rejects.toThrow(/inherit parent config and publication/);
    await child(parent, repair);
  });

  it("NB1: callers cannot prebind or rewrite run policy, and failed first attempts roll back binding", async () => {
    const s = await seed();
    await expect(
      runtime.query(
        "INSERT INTO program_runs(show_id,purpose,show_config_version_id,publication_enabled) VALUES ($1,'production',$2,true)",
        [s.show, s.config],
      ),
    ).rejects.toThrow(/first attempt/);
    await expect(
      runtime.query(
        "UPDATE program_runs SET publication_enabled=true WHERE program_run_id=$1",
        [s.run],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      migrator.query(
        "UPDATE program_runs SET publication_enabled=true WHERE program_run_id=$1",
        [s.run],
      ),
    ).rejects.toThrow(/identity mutation/);
    const run = await id(
      "INSERT INTO program_runs(show_id,purpose) VALUES ($1,'production') RETURNING program_run_id AS id",
      [s.show],
    );
    await expect(
      runtime.query(
        "INSERT INTO program_run_attempts(program_run_id,show_config_version_id,evidence_package_id) VALUES ($1,$2,$3)",
        [run, s.config, randomUUID()],
      ),
    ).rejects.toThrow(/foreign key/);
    expect(
      (
        await runtime.query(
          "SELECT show_config_version_id,publication_enabled FROM program_runs WHERE program_run_id=$1",
          [run],
        )
      ).rows[0],
    ).toEqual({ show_config_version_id: null, publication_enabled: null });
  });

  it.each(["READ COMMITTED", "REPEATABLE READ", "SERIALIZABLE"])(
    "NB1: concurrent first attempts cannot establish conflicting bindings at %s",
    async (isolation) => {
      const s = await seed();
      const alternate = await id(
        "INSERT INTO show_config_versions(show_id,version_number,config_hash,schema_version,canonical_payload,pre_publish_review_required) VALUES ($1,2,$2,'v1','{}',false) RETURNING show_config_version_id AS id",
        [s.show, hash()],
        migrator,
      );
      // Config races use real runtime connections; publication races use setup
      // authority to test run integrity independently of runtime's privilege denial.
      for (const conflict of ["config", "publication"]) {
        const run = await id(
          "INSERT INTO program_runs(show_id,purpose) VALUES ($1,'production') RETURNING program_run_id AS id",
          [s.show],
        );
        const db = conflict === "config" ? runtime : migrator;
        // Migration pools intentionally allow only one checked-out client.
        // Use the same factory/login on a separate pool for the competing writer.
        const competitorPool =
          conflict === "config"
            ? runtime
            : createMigrationPool({
                MIGRATION_DATABASE_URL: migrator.options.connectionString ?? "",
              });
        const first = await db.connect();
        let second: pg.PoolClient | undefined;
        try {
          second = await competitorPool.connect();
          await first.query(`BEGIN ISOLATION LEVEL ${isolation}`);
          await second.query(`BEGIN ISOLATION LEVEL ${isolation}`);
          await second.query("SET LOCAL statement_timeout = '5s'");
          const pid = (
            await second.query<{ pid: number }>(
              "SELECT pg_backend_pid() AS pid",
            )
          ).rows[0]?.pid;
          const sql =
            "INSERT INTO program_run_attempts(program_run_id,show_config_version_id,publication_enabled) VALUES ($1,$2,$3)";
          await first.query(sql, [run, s.config, false]);
          const pending = second.query(sql, [
            run,
            conflict === "config" ? alternate : s.config,
            conflict === "publication",
          ]);
          const outcome = pending.then(
            () => null,
            (error: unknown) => error,
          );
          // Prove actual overlap; do not rely on scheduling or a fixed sleep.
          const deadline = Date.now() + 3000;
          let blocked = false;
          while (Date.now() < deadline) {
            blocked =
              (
                await runtime.query<{ blocked: boolean }>(
                  "SELECT cardinality(pg_blocking_pids($1)) > 0 AS blocked",
                  [pid],
                )
              ).rows[0]?.blocked ?? false;
            if (blocked) break;
            await setTimeout(10);
          }
          expect(blocked).toBe(true);
          await first.query("COMMIT");
          const error = await outcome;
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toMatch(
            isolation === "READ COMMITTED"
              ? /run show-config binding|cannot elevate run publication/
              : /could not serialize/,
          );
          await second.query("ROLLBACK");
          expect(
            (
              await runtime.query(
                "SELECT show_config_version_id,publication_enabled FROM program_runs WHERE program_run_id=$1",
                [run],
              )
            ).rows[0],
          ).toEqual({
            show_config_version_id: s.config,
            publication_enabled: false,
          });
          expect(
            (
              await runtime.query(
                "SELECT * FROM program_run_attempts WHERE program_run_id=$1",
                [run],
              )
            ).rowCount,
          ).toBe(1);
        } finally {
          // Release the lock holder even if an assertion fails while the other
          // INSERT is blocked. Each client is released even if rollback fails.
          await Promise.allSettled(
            [first, second].map(async (client) => {
              if (!client) return;
              try {
                await client.query("ROLLBACK");
              } finally {
                client.release(true);
              }
            }),
          );
          if (competitorPool !== runtime) await competitorPool.end();
        }
      }
    },
  );

  it("shares one frozen package across evaluation, production and confirmed child repair; preserves Episode/GUID/pubDate", async () => {
    const pkg = await evidencePackage();
    const evaluation = await seed("evaluation", false, pkg);
    await advance(evaluation.attempt);
    const s = await seed("production", false, pkg);
    const candidate = await ready(s);
    const actor = await human();
    const before = await runtime.query(
      "SELECT * FROM episodes WHERE program_run_id=$1",
      [s.run],
    );
    await review(
      candidate.version,
      candidate.fingerprint,
      actor,
      "request_repair",
    );
    const repair = await plan(s.attempt, candidate.fingerprint, actor);
    await expect(child(s, repair)).rejects.toThrow(/confirmed causal/);
    await expect(
      runtime.query(
        "INSERT INTO repair_plan_decisions(repair_plan_id,actor_id,decision) VALUES ($1,$2,'confirm')",
        [repair, actor],
      ),
    ).rejects.toThrow(/permission denied/);
    await operator.query(
      "INSERT INTO repair_plan_decisions(repair_plan_id,actor_id,decision) VALUES ($1,$2,'confirm')",
      [repair, actor],
    );
    await expect(child(s, repair, await evidencePackage())).rejects.toThrow(
      /exact Evidence Package/,
    );
    const childId = await child(s, repair);
    const c = await ready({ ...s, attempt: childId });
    const after = await runtime.query(
      "SELECT * FROM episodes WHERE program_run_id=$1",
      [s.run],
    );
    expect(after.rows).toEqual(before.rows);
    expect(c.version).not.toBe(candidate.version);
    await expect(
      runtime.query("SELECT transition_attempt($1,'READY','REVALIDATED')", [
        childId,
      ]),
    ).rejects.toThrow(/own approval/);
    const lineage = await runtime.query(
      "SELECT parent_attempt_id, repair_plan_id, evidence_package_id FROM program_run_attempts WHERE attempt_id=$1",
      [childId],
    );
    expect(lineage.rows[0]).toEqual({
      parent_attempt_id: s.attempt,
      repair_plan_id: repair,
      evidence_package_id: pkg,
    });
    const other = await seed();
    await expect(
      child(other, repair, other.packageId, s.attempt),
    ).rejects.toThrow(/same run/);
    await expect(
      migrator.query(
        "UPDATE repair_plans SET plan_version=2 WHERE repair_plan_id=$1",
        [repair],
      ),
    ).rejects.toThrow(/immutable/);
    await expect(
      migrator.query(
        "DELETE FROM repair_plan_decisions WHERE repair_plan_id=$1",
        [repair],
      ),
    ).rejects.toThrow(/immutable/);
  });

  it("binds changed evidence to a child only with a confirmed evidence repair; rejects rejected plans", async () => {
    const s = await seed();
    const c = await ready(s);
    const actor = await human();
    await review(c.version, c.fingerprint, actor, "request_repair");
    const rejected = await plan(
      s.attempt,
      c.fingerprint,
      actor,
      "evidence_claims",
    );
    await operator.query(
      "INSERT INTO repair_plan_decisions(repair_plan_id,actor_id,decision) VALUES ($1,$2,'reject')",
      [rejected, actor],
    );
    await expect(child(s, rejected, await evidencePackage())).rejects.toThrow(
      /confirmed causal/,
    );
    const repair = await plan(
      s.attempt,
      c.fingerprint,
      actor,
      "evidence_claims",
    );
    await operator.query(
      "INSERT INTO repair_plan_decisions(repair_plan_id,actor_id,decision) VALUES ($1,$2,'confirm')",
      [repair, actor],
    );
    const pkg = await evidencePackage();
    const childId = await child(s, repair, pkg);
    expect(
      await id(
        "SELECT evidence_package_id AS id FROM program_run_attempts WHERE attempt_id=$1",
        [childId],
      ),
    ).toBe(pkg);
  });

  it("permits exactly one terminal review per exact candidate and rejects unknown decisions or malformed/mismatched fingerprints", async () => {
    const s = await seed();
    const c = await ready(s);
    const actor = await human();
    await expect(
      review(c.version, c.fingerprint, actor, "ship_it"),
    ).rejects.toThrow(/check constraint/);
    await expect(review(c.version, "bogus", actor, "approve")).rejects.toThrow(
      /sha256_hex/,
    );
    await expect(review(c.version, hash(), actor, "approve")).rejects.toThrow(
      /foreign key/,
    );
    await expect(
      review(c.version, c.fingerprint, actor, "approve", runtime),
    ).rejects.toThrow(/permission denied/);
    const outcomes = await Promise.allSettled([
      review(c.version, c.fingerprint, actor, "request_repair"),
      review(c.version, c.fingerprint, actor, "halt"),
    ]);
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((r) => r.status === "rejected")).toHaveLength(1);
  });

  it("reserves paid work once, appends exact outcomes, distinguishes operational retry and durable mechanical reroll", async () => {
    const s = await seed();
    const fingerprint = `v1:${hash()}`;
    const statement =
      "INSERT INTO provider_calls(attempt_id,provider,operation,model_identifier,request_fingerprint,logical_request_key,operational_try_number,intentional_take_index,started_at,retry_of_provider_call_id,reroll_of_provider_call_id,reroll_trigger_id) VALUES ($1,'fixture_tts','tts','fixture-model-1.0',$2,$3,$4,$5,now(),$6,$7,$8) RETURNING provider_call_id AS id";
    const values = [
      s.attempt,
      fingerprint,
      `${fingerprint}:0`,
      1,
      0,
      null,
      null,
      null,
    ];
    const attempts = await Promise.allSettled([
      id(statement, values),
      id(statement, values),
    ]);
    const success = attempts.find((r) => r.status === "fulfilled");
    if (success?.status !== "fulfilled") throw new Error("Reservation failed");
    expect(attempts.filter((r) => r.status === "rejected")).toHaveLength(1);
    const first = success.value;
    await expect(
      id(statement, [
        s.attempt,
        fingerprint,
        `${fingerprint}:0`,
        2,
        0,
        first,
        null,
        null,
      ]),
    ).rejects.toThrow(/retryable outcome/);
    const outcome =
      "INSERT INTO provider_call_events(provider_call_id,event_type,ended_at,usage,actual_cost,currency,response_artifact_id) VALUES ($1,$2,now(),$3,$4,'USD',$5)";
    await runtime.query(outcome, [
      first,
      "retryable_failure",
      { generated_seconds: "0.000" },
      "0.0001",
      null,
    ]);
    const retry = await id(statement, [
      s.attempt,
      fingerprint,
      `${fingerprint}:0`,
      2,
      0,
      first,
      null,
      null,
    ]);
    const audio = await artifact("audio");
    await runtime.query(outcome, [
      retry,
      "succeeded",
      { generated_seconds: "0.144979" },
      "0.01234567890123456789",
      audio,
    ]);
    await expect(
      runtime.query(outcome, [retry, "terminal_failure", {}, "0", null]),
    ).rejects.toThrow(/unique/);
    const cost = await runtime.query(
      "SELECT actual_cost::text,usage,currency FROM provider_call_events WHERE provider_call_id=$1",
      [retry],
    );
    expect(cost.rows[0]).toEqual({
      actual_cost: "0.01234567890123456789",
      usage: { generated_seconds: "0.144979" },
      currency: "USD",
    });
    const trigger = await id(
      "INSERT INTO reroll_triggers(source_provider_call_id,base_request_hash,take_index,failure_code,policy_version,validation_artifact_id,actor_id) VALUES ($1,$2,1,'unexpected_truncation','mechanical-validation-reroll-v1',$3,$4) RETURNING reroll_trigger_id AS id",
      [
        retry,
        fingerprint,
        await artifact("technical_validation"),
        await human(),
      ],
    );
    const reroll = await id(statement, [
      s.attempt,
      fingerprint,
      `${fingerprint}:1`,
      1,
      1,
      null,
      retry,
      trigger,
    ]);
    await runtime.query(outcome, [
      reroll,
      "terminal_failure",
      {},
      "0.0000",
      null,
    ]);
    const history = await runtime.query(
      "SELECT retry_of_provider_call_id,reroll_of_provider_call_id,reroll_trigger_id FROM provider_calls WHERE provider_call_id=$1",
      [reroll],
    );
    expect(history.rows[0]).toEqual({
      retry_of_provider_call_id: null,
      reroll_of_provider_call_id: retry,
      reroll_trigger_id: trigger,
    });
    await expect(
      migrator.query(
        "UPDATE provider_calls SET provider='other' WHERE provider_call_id=$1",
        [first],
      ),
    ).rejects.toThrow(/immutable/);
    await expect(
      runtime.query(outcome, [first, "made_up", {}, "0", null]),
    ).rejects.toThrow(/check constraint/);
    await expect(
      id(statement, [
        s.attempt,
        fingerprint,
        `${fingerprint}:2`,
        1,
        2,
        null,
        null,
        null,
      ]),
    ).rejects.toThrow(/reroll trigger/);
  });

  it("distinguishes a confirmed operator editorial take from an automatic mechanical reroll", async () => {
    const s = await seed();
    const base = `v1:${hash()}`;
    const statement =
      "INSERT INTO provider_calls(attempt_id,provider,operation,model_identifier,request_fingerprint,logical_request_key,operational_try_number,intentional_take_index,started_at,reroll_of_provider_call_id,reroll_trigger_id) VALUES ($1,'fixture_tts','tts','v1',$2,$3,1,$4,now(),$5,$6) RETURNING provider_call_id AS id";
    const source = await id(statement, [
      s.attempt,
      base,
      `${base}:0`,
      0,
      null,
      null,
    ]);
    await runtime.query(
      "INSERT INTO provider_call_events(provider_call_id,event_type,ended_at,usage) VALUES ($1,'succeeded',now(),'{}')",
      [source],
    );
    const c = await ready(s);
    const actor = await human();
    await review(c.version, c.fingerprint, actor, "request_repair");
    const repair = await plan(s.attempt, c.fingerprint, actor);
    const triggerSql =
      "INSERT INTO reroll_triggers(source_provider_call_id,base_request_hash,take_index,trigger_kind,repair_plan_id,policy_version,validation_artifact_id,actor_id) VALUES ($1,$2,1,'operator_repair',$3,'operator-repair-0.1.1',$4,$5) RETURNING reroll_trigger_id AS id";
    const triggerValues = [
      source,
      base,
      repair,
      await artifact("validation"),
      actor,
    ];
    await expect(id(triggerSql, triggerValues)).rejects.toThrow(
      /confirmed operator repair/,
    );
    await operator.query(
      "INSERT INTO repair_plan_decisions(repair_plan_id,actor_id,decision) VALUES ($1,$2,'confirm')",
      [repair, actor],
    );
    const trigger = await id(triggerSql, triggerValues);
    await expect(
      id(statement, [s.attempt, base, `${base}:1`, 1, source, trigger]),
    ).rejects.toThrow(/repair child/);
    const attempt = await child(s, repair);
    await id(statement, [attempt, base, `${base}:1`, 1, source, trigger]);
    const recorded = await runtime.query(
      "SELECT trigger_kind,failure_code,repair_plan_id FROM reroll_triggers WHERE reroll_trigger_id=$1",
      [trigger],
    );
    expect(recorded.rows[0]).toEqual({
      trigger_kind: "operator_repair",
      failure_code: null,
      repair_plan_id: repair,
    });
  });

  it("binds takes to their exact block/base request and assembly maps to real master audio", async () => {
    const s = await seed();
    const brief = await id(
      "INSERT INTO showrunner_brief_versions(artifact_id,evidence_package_id,attempt_id) VALUES ($1,$2,$3) RETURNING showrunner_brief_version_id AS id",
      [await artifact("brief"), s.packageId, s.attempt],
    );
    const block = await id(
      "INSERT INTO program_blocks(showrunner_brief_version_id,sequence,block_type,semantic_payload) VALUES ($1,1,'wrap','{}') RETURNING program_block_id AS id",
      [brief],
    );
    const script = await id(
      "INSERT INTO script_versions(artifact_id,showrunner_brief_version_id,attempt_id) VALUES ($1,$2,$3) RETURNING script_version_id AS id",
      [await artifact("script"), brief, s.attempt],
    );
    const direction = await id(
      "INSERT INTO performance_direction_versions(artifact_id,script_version_id) VALUES ($1,$2) RETURNING performance_direction_version_id AS id",
      [await artifact("direction"), script],
    );
    const audit = await id(
      "INSERT INTO audit_runs(attempt_id,input_fingerprint,auditor_kind,auditor_version) VALUES ($1,$2,'fixture_stub','v1') RETURNING audit_run_id AS id",
      [s.attempt, hash()],
    );
    const manifest = await id(
      "INSERT INTO render_manifests(artifact_id,script_version_id,performance_direction_version_id,audit_run_id) VALUES ($1,$2,$3,$4) RETURNING render_manifest_id AS id",
      [await artifact("manifest"), script, direction, audit],
    );
    const base = `v1:${hash()}`;
    const renderBlock = await id(
      "INSERT INTO render_blocks(render_manifest_id,program_block_id,sequence,speaker_map,base_request_hash) VALUES ($1,$2,1,'{}',$3) RETURNING render_block_id AS id",
      [manifest, block, base],
    );
    const otherBlock = await id(
      "INSERT INTO render_blocks(render_manifest_id,program_block_id,sequence,speaker_map,base_request_hash) VALUES ($1,$2,2,'{}',$3) RETURNING render_block_id AS id",
      [manifest, block, `v1:${hash()}`],
    );
    const call = await id(
      "INSERT INTO provider_calls(attempt_id,provider,operation,model_identifier,request_fingerprint,logical_request_key,operational_try_number,intentional_take_index,started_at) VALUES ($1,'fixture_tts','tts','v1',$2,$3,1,0,now()) RETURNING provider_call_id AS id",
      [s.attempt, base, `${base}:0`],
    );
    const audio = await master();
    await runtime.query(
      "INSERT INTO provider_call_events(provider_call_id,event_type,ended_at,usage,actual_cost,currency,response_artifact_id) VALUES ($1,'succeeded',now(),'{\"seconds\":\"1.000\"}','0.0000','USD',$2)",
      [call, audio],
    );
    const takeSql =
      "INSERT INTO render_takes(render_block_id,take_index,provider_call_id,audio_artifact_id,technical_validation) VALUES ($1,0,$2,$3,'{}') RETURNING render_take_id AS id";
    await expect(id(takeSql, [otherBlock, call, audio])).rejects.toThrow(
      /take must match/,
    );
    const take = await id(takeSql, [renderBlock, call, audio]);
    const actor = await human();
    const select =
      "INSERT INTO take_selections(render_block_id,render_take_id,actor_id,decision) VALUES ($1,$2,$3,'approved')";
    await expect(
      runtime.query(select, [otherBlock, take, actor]),
    ).rejects.toThrow(/foreign key/);
    await runtime.query(select, [renderBlock, take, actor]);
    const recipe = await id(
      "INSERT INTO assembly_recipes(artifact_id,version) VALUES ($1,'v1') RETURNING assembly_recipe_id AS id",
      [await artifact("recipe")],
    );
    const map = await artifact("assembly_map");
    await expect(
      runtime.query(
        "INSERT INTO master_assembly_maps(artifact_id,assembly_recipe_id) VALUES ($1,$2)",
        [map, recipe],
      ),
    ).rejects.toThrow(/not-null/);
    await expect(
      runtime.query(
        "INSERT INTO master_assembly_maps(artifact_id,assembly_recipe_id,master_audio_artifact_id) VALUES ($1,$2,$3)",
        [map, recipe, randomUUID()],
      ),
    ).rejects.toThrow(/foreign key/);
    const audioId = await id(
      "SELECT audio_artifact_id AS id FROM audio_artifacts WHERE artifact_id=$1",
      [audio],
    );
    await runtime.query(
      "INSERT INTO master_assembly_maps(artifact_id,assembly_recipe_id,master_audio_artifact_id) VALUES ($1,$2,$3)",
      [map, recipe, audioId],
    );
  });

  it("closes claim/evidence registries and requires auditor identity and valid hashes", async () => {
    const s = await seed();
    const claimSql =
      "INSERT INTO claims(content_hash,claim_kind,origin,subject_domain,subject,predicate,value,initial_usage_class,initial_status) VALUES ($1,$2,$3,$4,'{}','result','{}','assertable','confirmed')";
    await runtime.query(claimSql, [
      hash(),
      "event_fact",
      "data_provider",
      "statistical",
    ]);
    await expect(
      runtime.query(claimSql, [
        hash(),
        "invented",
        "data_provider",
        "statistical",
      ]),
    ).rejects.toThrow(/check constraint/);
    await expect(
      runtime.query(claimSql, [
        hash(),
        "event_fact",
        "invented",
        "statistical",
      ]),
    ).rejects.toThrow(/check constraint/);
    await expect(
      runtime.query(claimSql, [hash(), "event_fact", "data_provider", null]),
    ).rejects.toThrow(/not-null/);
    await expect(
      runtime.query(
        "INSERT INTO audit_runs(attempt_id,input_fingerprint) VALUES ($1,$2)",
        [s.attempt, hash()],
      ),
    ).rejects.toThrow(/not-null/);
    await expect(
      runtime.query(
        "INSERT INTO audit_runs(attempt_id,input_fingerprint,auditor_kind,auditor_version) VALUES ($1,'bad','fixture_stub','v1')",
        [s.attempt],
      ),
    ).rejects.toThrow(/sha256_hex/);
    const gate = await id(
      "INSERT INTO gate_definitions(gate_name,version,definition) VALUES ($1,'v1','{}') RETURNING gate_definition_id AS id",
      [randomUUID()],
    );
    await expect(
      runtime.query(
        "INSERT INTO gate_results(gate_definition_id,attempt_id,input_fingerprint,outcome,result) VALUES ($1,$2,$3,'maybe','{}')",
        [gate, s.attempt, hash()],
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      runtime.query(
        "INSERT INTO turn_claim_uses(turn_id,claim_id,use_mode,span_start,span_end) VALUES ($1,$2,'invented',0,1)",
        [randomUUID(), randomUUID()],
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      runtime.query(
        "INSERT INTO turn_evidence_uses(turn_id,evidence_unit_id,use_mode,span_start,span_end) VALUES ($1,$2,'invented',0,1)",
        [randomUUID(), randomUUID()],
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("runtime cannot create, mutate history, forge migrations, disable triggers or directly advance lifecycle", async () => {
    await artifact();
    for (const sql of [
      "CREATE TABLE public.forbidden(id integer)",
      "INSERT INTO desk_internal.schema_migrations(migration_name,checksum) VALUES ('999_forged.sql',repeat('a',64))",
      "UPDATE desk_internal.schema_migrations SET checksum=repeat('a',64)",
      "DELETE FROM desk_internal.schema_migrations",
      "TRUNCATE desk_internal.schema_migrations",
      "UPDATE artifacts SET schema_version='v2'",
      "DELETE FROM artifacts",
      "TRUNCATE artifacts CASCADE",
      "UPDATE program_run_attempts SET state='READY'",
      "UPDATE program_runs SET state='READY'",
      "ALTER TABLE artifacts DISABLE TRIGGER ALL",
      "SET session_replication_role=replica",
      "SET ROLE desk_migrator",
      "SET ROLE desk_operator",
      "SET SESSION AUTHORIZATION desk_migrator",
    ])
      await expect(runtime.query(sql)).rejects.toThrow(
        /permission denied|must be owner/,
      );
    await expect(verifyMigrationIntegrity(runtime)).rejects.toThrow(
      /permission denied/,
    );
    await expect(verifyMigrationIntegrity(migrator)).resolves.toBeUndefined();
    try {
      await migrator.query(
        "INSERT INTO desk_internal.schema_migrations(migration_name,checksum) VALUES ('999_forged.sql',repeat('a',64))",
      );
      await expect(verifyMigrationIntegrity(migrator)).rejects.toThrow(
        /999_forged/,
      );
    } finally {
      await migrator.query(
        "DELETE FROM desk_internal.schema_migrations WHERE migration_name='999_forged.sql'",
      );
    }
  });

  it("owner-level TRUNCATE and mutable DML are blocked on every declared immutable table", async () => {
    const tables = await migrator.query<{ event_object_table: string }>(
      "SELECT DISTINCT event_object_table FROM information_schema.triggers WHERE trigger_name='immutable_rows'",
    );
    expect(tables.rows.length).toBeGreaterThan(30);
    const truncateGuards = await migrator.query<{ relation_name: string }>(
      "SELECT c.relname AS relation_name FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE t.tgname='immutable_truncate' AND (t.tgtype::integer & 32) <> 0",
    );
    expect(truncateGuards.rows.map((row) => row.relation_name).sort()).toEqual(
      tables.rows.map((row) => row.event_object_table).sort(),
    );
    for (const row of tables.rows) {
      await expect(
        migrator.query(`TRUNCATE ${row.event_object_table} CASCADE`),
      ).rejects.toThrow(/immutable relation/);
    }
    await expect(
      migrator.query("UPDATE artifacts SET schema_version='v2'"),
    ).rejects.toThrow(/immutable/);
    await expect(migrator.query("DELETE FROM artifacts")).rejects.toThrow(
      /immutable/,
    );
  });

  it("later migration-owned tables inherit SELECT/INSERT without runtime DDL or mutation grants", async () => {
    const dir = await mkdtemp(join(tmpdir(), "desk-migrations-"));
    try {
      // Copy every real migration so the dir matches the ledger, then add the probe after them.
      for (const name of (await readdir("migrations")).filter((n) =>
        /^\d{3}_.*\.sql$/.test(n),
      ))
        await copyFile(join("migrations", name), join(dir, name));
      await writeFile(
        join(dir, "003_privilege_probe.sql"),
        "CREATE TABLE privilege_probe(id uuid PRIMARY KEY);\n",
      );
      await migrate(migrator, dir);
      await runtime.query("INSERT INTO privilege_probe(id) VALUES ($1)", [
        randomUUID(),
      ]);
      expect(
        (await runtime.query("SELECT * FROM privilege_probe")).rowCount,
      ).toBe(1);
      for (const statement of [
        "UPDATE privilege_probe SET id=gen_random_uuid()",
        "DELETE FROM privilege_probe",
        "TRUNCATE privilege_probe",
      ])
        await expect(runtime.query(statement)).rejects.toThrow(
          /permission denied/,
        );
      await verifyMigrationIntegrity(migrator, dir);
    } finally {
      await migrator.query("DROP TABLE IF EXISTS privilege_probe");
      await migrator.query(
        "DELETE FROM desk_internal.schema_migrations WHERE migration_name='003_privilege_probe.sql'",
      );
      await rm(dir, { recursive: true, force: true });
    }
  });
});
