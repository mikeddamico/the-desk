import pg from "pg";

import type { Config, MigrationConfig } from "../config.js";

export function createRuntimePool(
  config: Pick<Config, "DATABASE_URL">,
): pg.Pool {
  return new pg.Pool({
    connectionString: config.DATABASE_URL,
    options: "-c role=desk_runtime",
    max: 10,
    application_name: "the-desk-runtime",
  });
}

export function createMigrationPool(
  config: Pick<MigrationConfig, "MIGRATION_DATABASE_URL">,
): pg.Pool {
  return new pg.Pool({
    connectionString: config.MIGRATION_DATABASE_URL,
    options: "-c role=desk_migrator",
    max: 1,
    application_name: "the-desk-migrator",
  });
}
