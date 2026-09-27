import pg from "pg";

import type { Config } from "../config.js";

export function createRuntimePool(
  config: Pick<Config, "DATABASE_URL">,
): pg.Pool {
  return new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    application_name: "the-desk-runtime",
  });
}

export function createMigrationPool(
  config: Pick<Config, "MIGRATION_DATABASE_URL">,
): pg.Pool {
  return new pg.Pool({
    connectionString: config.MIGRATION_DATABASE_URL,
    max: 1,
    application_name: "the-desk-migrator",
  });
}
