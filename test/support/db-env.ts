// Test support: disposable databases on the PostgreSQL 17 server named by TEST_DATABASE_URL (superuser bootstrap), each with
// the real role bootstrap (migrations/roles.sql), a migration LOGIN and a runtime LOGIN, mirroring the Migration 002 suite.
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

import pg from "pg";

import { migrate } from "../../src/db/migrations.js";
import { createMigrationPool, createRuntimePool } from "../../src/db/pool.js";

export interface DbEnv {
  name: string;
  migratorUrl: string;
  runtimeUrl: string;
  owner: pg.Pool;
  migrator: pg.Pool;
  runtime: pg.Pool;
  close(): Promise<void>;
}

export class TestCluster {
  readonly admin: pg.Pool;
  private readonly run = randomBytes(4).toString("hex");
  private readonly password = randomBytes(24).toString("hex");
  private counter = 0;
  private readonly envs: DbEnv[] = [];
  private readonly logins = { migrator: "", runtime: "" };

  constructor(private readonly databaseUrl: string) {
    this.admin = new pg.Pool({ connectionString: databaseUrl, max: 2 });
    this.logins.migrator = `fl_${this.run}_migrator`;
    this.logins.runtime = `fl_${this.run}_runtime`;
  }

  private urlFor(database: string, user?: string, secret?: string): string {
    const url = new URL(this.databaseUrl);
    url.pathname = `/${database}`;
    if (user) url.username = user;
    if (secret) url.password = secret;
    return url.toString();
  }

  async bootstrap(): Promise<void> {
    const boot = await this.create({ migrate: false });
    for (const [capability, login] of Object.entries(this.logins)) {
      await this.admin.query(
        `CREATE ROLE ${login} LOGIN NOINHERIT PASSWORD '${this.password}'`,
      );
      await this.admin.query(`GRANT desk_${capability} TO ${login}`);
    }
    await boot.close();
  }

  /** A fresh database with roles bootstrapped; `migrate: true` applies 001+002 through the real migration runner. */
  async create(options: {
    migrate: boolean;
    migrationsDirectory?: string;
  }): Promise<DbEnv> {
    this.counter += 1;
    const name = `fl_${this.run}_${String(this.counter)}`;
    await this.admin.query(`CREATE DATABASE ${name} TEMPLATE template0`);
    const owner = new pg.Pool({ connectionString: this.urlFor(name), max: 2 });
    await owner.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    const sql = await readFile("migrations/roles.sql", "utf8");
    for (let attempt = 0; ; attempt += 1) {
      try {
        await owner.query(sql);
        break;
      } catch (error) {
        if (attempt >= 5) throw error;
        await sleep(100 * (attempt + 1));
      }
    }
    const migratorUrl = this.urlFor(name, this.logins.migrator, this.password);
    const runtimeUrl = this.urlFor(name, this.logins.runtime, this.password);
    const migrator = createMigrationPool({
      MIGRATION_DATABASE_URL: migratorUrl,
    });
    const runtime = createRuntimePool({ DATABASE_URL: runtimeUrl });
    const env: DbEnv = {
      name,
      migratorUrl,
      runtimeUrl,
      owner,
      migrator,
      runtime,
      close: async () => {
        await Promise.all([owner.end(), migrator.end(), runtime.end()]);
        for (let attempt = 0; ; attempt += 1) {
          try {
            await this.admin.query(`DROP DATABASE IF EXISTS ${name}`);
            return;
          } catch (error) {
            if ((error as { code?: string }).code !== "55006" || attempt >= 50)
              throw error;
            await sleep(100);
          }
        }
      },
    };
    this.envs.push(env);
    if (options.migrate) await migrate(migrator, options.migrationsDirectory);
    return env;
  }

  async shutdown(): Promise<void> {
    for (const env of this.envs) await env.close().catch(() => undefined);
    for (const login of Object.values(this.logins))
      await this.admin
        .query(`DROP ROLE IF EXISTS ${login}`)
        .catch(() => undefined);
    await this.admin.end();
  }
}
