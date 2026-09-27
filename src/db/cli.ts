import { assertDestructiveOperationAllowed, loadConfig } from "../config.js";
import { migrate, verifyMigrationIntegrity } from "./migrations.js";
import { createMigrationPool } from "./pool.js";

const command = process.argv[2];
const config = loadConfig();
const pool = createMigrationPool(config);

try {
  if (command === "migrate") await migrate(pool);
  else if (command === "verify") await verifyMigrationIntegrity(pool);
  else if (command === "reset") {
    assertDestructiveOperationAllowed(
      config,
      process.env.DESTRUCTIVE_CONFIRMATION,
    );
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await migrate(pool);
  } else throw new Error("Usage: db: migrate | verify | reset");
} finally {
  await pool.end();
}
