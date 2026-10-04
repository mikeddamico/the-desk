// Development/test fixture checkpoint only. No lifecycle progression or provider execution.
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import type { Pool } from "pg";
import pino, { type Logger } from "pino";
import { assertFixtureLoadAllowed, loadMigrationConfig } from "../config.js";
import { createMigrationPool, createRuntimePool } from "../db/pool.js";
import { openFixturePack } from "../fixture/pack.js";
import {
  assertFixtureRuntimeRole,
  reenterCompletePinnedFixture,
  verifyCompletePinnedFixture,
} from "../fixture/persist.js";
import { VerifiedFixture } from "../fixture/snapshot.js";
import { createLogger } from "../logging.js";

const CLEANUP_MS = 5000;
async function boundedCleanup(task: Promise<void>): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("cleanup deadline"));
        }, CLEANUP_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Exported for the real child-process fault harness. No arguments or alternate fixture are accepted. */
export async function fixtureReentryMain(
  args = process.argv.slice(2),
  environment = process.env,
): Promise<void> {
  const correlationId = randomUUID();
  let stage = "preflight";
  let firstStage = stage;
  let setupCommitted = false;
  let first: unknown;
  let failed = false as boolean; // set by asynchronous connection/cleanup callbacks
  let logger: Logger | undefined;
  let identities: { run_id: string; attempt_id: string }[] = [];
  const pools: Pool[] = [];
  const hasFailed = (): boolean => failed;
  const record = (error: unknown): void => {
    if (!hasFailed()) {
      failed = true;
      first = error;
      firstStage = stage;
    }
  };
  const emit = (outcome: string, eventStage: string): void => {
    const fields = {
      event: "fixture.reentry",
      command: "fixture_reentry",
      stage: eventStage,
      correlation_id: correlationId,
      outcome,
      setup_commit: setupCommitted ? "acknowledged" : "not_acknowledged",
    };
    // Only fixed labels, generated IDs and IDs from the verified pinned pack. No arbitrary errors/inputs.
    if (logger) {
      for (const identity of identities)
        logger[outcome === "failed" ? "error" : "info"]({
          ...fields,
          ...identity,
        });
    } else {
      process.stderr.write(
        `${JSON.stringify({ ...fields, run_id: null, attempt_id: null })}\n`,
      );
    }
  };
  try {
    if (args.length !== 0)
      throw new Error("fixture re-entry accepts no arguments");
    if (
      environment.DESK_ENV !== "development" &&
      environment.DESK_ENV !== "test"
    )
      throw new Error("fixture re-entry requires development/test");
    const config = loadMigrationConfig(environment);
    assertFixtureLoadAllowed(config); // before constructing either pool
    const setupUrl = new URL(config.MIGRATION_DATABASE_URL);
    const runtimeUrl = new URL(config.DATABASE_URL);
    if (
      setupUrl.username === runtimeUrl.username ||
      // pg connection-string options can override URL endpoint fields. This fixed fixture tool accepts plain URLs only.
      setupUrl.search !== "" ||
      runtimeUrl.search !== "" ||
      setupUrl.hash !== "" ||
      runtimeUrl.hash !== "" ||
      setupUrl.hostname !== runtimeUrl.hostname ||
      (setupUrl.port || "5432") !== (runtimeUrl.port || "5432") ||
      setupUrl.pathname !== runtimeUrl.pathname
    )
      throw new Error(
        "separate logins on the same fixture target are required",
      );
    const fixture = VerifiedFixture.fromPack(openFixturePack());
    identities = (fixture.rows.tables.program_run_attempts ?? []).map(
      (attempt) => ({
        run_id: String(attempt.program_run_id),
        attempt_id: String(attempt.attempt_id),
      }),
    );
    logger = createLogger(config, pino.destination({ dest: 1, sync: true }));
    const runtime = createRuntimePool(config);
    pools.push(runtime);
    runtime.on("error", record);
    stage = "runtime_preflight";
    await assertFixtureRuntimeRole(runtime); // reject the checked setup capabilities BEFORE setup can write
    if (hasFailed()) throw first;
    const setup = createMigrationPool(config);
    pools.push(setup);
    setup.on("error", record);
    stage = "fixture_setup";
    const result = await reenterCompletePinnedFixture(setup, config);
    setupCommitted = true;
    if (hasFailed()) throw first;
    emit(result.outcome, stage);
    stage = "fixture_verify";
    const verified = await verifyCompletePinnedFixture(runtime);
    if (hasFailed()) throw first;
    for (const identity of identities)
      logger.info({
        event: "fixture.reentry.verified",
        command: "fixture_reentry",
        stage,
        correlation_id: correlationId,
        ...identity,
        rows: verified.rows,
        families: verified.families,
        verification: "committed_runtime_snapshot",
      });
  } catch (error) {
    record(error);
  } finally {
    stage = "cleanup";
    // A timed-out end() can leave handles alive during the subsequent flush deadline. Keep the listeners attached through
    // direct process termination; late errors are consumed and cannot replace the first diagnostic. Closed pools are collectible.
    await Promise.all(
      pools.map(async (pool) => {
        try {
          await boundedCleanup(pool.end());
        } catch (error) {
          record(error);
        }
      }),
    );
    if (hasFailed()) {
      try {
        emit("failed", firstStage);
      } catch (error) {
        record(error);
      }
    }
    if (logger) {
      const sink = logger;
      try {
        await boundedCleanup(
          new Promise<void>((resolve, reject) => {
            sink.flush((error) => {
              if (error) reject(error);
              else resolve();
            });
          }),
        );
      } catch (error) {
        record(error);
        for (const identity of identities)
          process.stderr.write(
            `${JSON.stringify({ command: "fixture_reentry", stage: "cleanup", correlation_id: correlationId, ...identity, outcome: "failed", setup_commit: setupCommitted ? "acknowledged" : "not_acknowledged" })}\n`,
          );
      }
    }
  }
  if (hasFailed()) {
    process.exitCode = 1;
    throw first;
  } // preserve first diagnostic; direct entry never prints it
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  let code = 0;
  try {
    await fixtureReentryMain();
  } catch {
    code = 1;
  }
  process.exit(code); // a cleanup deadline also terminates any remaining handles
}
