import {
  assertDestructiveOperationAllowed,
  assertFixtureLoadAllowed,
  loadMigrationConfig,
} from "../config.js";
import { persistFixture } from "../fixture/persist.js";
import { migrate, verifyMigrationIntegrity } from "./migrations.js";
import { createMigrationPool } from "./pool.js";

const command = process.argv[2];
const config = loadMigrationConfig();
const pool = createMigrationPool(config);

try {
  if (command === "migrate") await migrate(pool);
  else if (command === "verify") await verifyMigrationIntegrity(pool);
  else if (command === "load-fixture") {
    // Dev/test only; loads the verified Fixture v0.4.6 into an EMPTY migrated database (existing migration pool/role).
    assertFixtureLoadAllowed(config);
    console.log(JSON.stringify(await persistFixture(pool)));
  } else if (command === "reset") {
    assertDestructiveOperationAllowed(
      config,
      process.env.DESTRUCTIVE_CONFIRMATION,
    );
    throw new Error(
      "Reset requires the database owner: recreate the disposable database and rerun roles.sql, then db:migrate. Migrator does not own the application schema.",
    );
  } else throw new Error("Usage: db: migrate | verify | load-fixture | reset");
} finally {
  await pool.end();
}
