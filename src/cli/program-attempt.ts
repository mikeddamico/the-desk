// P1 development/test PROCESS ENTRY for the merged G6 commands and the A5.1 evidence slice. It is a thin caller, NOT the minimal durable
// runner: a fixed code-defined order of three SEPARATE durable commands (createProgramRun -> createProgramAttempt -> runEvidenceSlice),
// each committing on its own, so a refusal at a later step leaves the earlier steps' rows committed (truthful partial progress, exit 2).
// No lifecycle advance, no retry or replay, no provider, no cost/timeout policy, no privileged setup (the pool is the runtime role).
//
// usage: program:attempt <input.json> [--correlation-id <uuid>]
// input: {"run": AuthoredProgramRun, "attempt": AuthoredProgramAttempt, "slice": {"units": [...], "pkg": {...}}} (strict envelope; the VALUES
// are validated by the existing commands; authored strings are passed through untouched).
// Order: configuration, the development/test guard, CLI syntax, the correlation id, the input file/envelope and the run/attempt identity
// cross-check ALL happen BEFORE the pool is created, so a refusal there performs no database access at all.
// Logging: the configured pino logger on stdout through the existing commandObserver, one correlation UUID for the whole invocation, on a
// SYNCHRONOUS stdout destination (pino's default stdout destination is asynchronous; a synchronous one needs no flush before exit).
// Exit codes: 0 complete (created/converged all the way); 2 a typed domain refusal or a stopped slice; 1 anything unexpected
// (configuration, guard, usage, input, a thrown command error) AND an infrastructure completion failure (flush/shutdown failed or timed
// out after an otherwise successful run; rows may already be committed). A prior nonzero exit is always preserved.
// stderr carries only the fixed lines below: never a raw Error, never input, environment or configuration values.
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import pino from "pino";
import { z } from "zod";

import { assertFixtureLoadAllowed, loadConfig } from "../config.js";
import { createRuntimePool } from "../db/pool.js";
import { commandObserver, createLogger } from "../logging.js";
import { readContext } from "../runtime/observe.js";
import {
  createProgramAttempt,
  createProgramRun,
  type AuthoredProgramAttempt,
  type AuthoredProgramRun,
} from "../runtime/program.js";
import { runEvidenceSlice, type SliceInput } from "../runtime/slice.js";

/** The ONLY text this process writes to stderr (one line, `program-attempt: <code>`). */
type Fixed =
  | "usage"
  | "config_invalid"
  | "environment_not_permitted"
  | "correlation_id_invalid"
  | "input_unreadable"
  | "input_invalid"
  | "identity_mismatch"
  | "command_error"
  | "cleanup_failed"
  | "unexpected";
const say = (code: Fixed): void => {
  process.stderr.write(`program-attempt: ${code}\n`);
};

/** Fixed process cleanup safeguard (flush + pool shutdown together); NOT a provider, retry or cost timeout policy. */
const CLEANUP_DEADLINE_MS = 5000;

class Refused extends Error {
  constructor(readonly code: Fixed) {
    super(code);
  }
}

const record = z.record(z.string(), z.unknown());
const envelope = z
  .object({
    run: record,
    attempt: record,
    slice: z.object({ units: z.array(z.unknown()), pkg: record }).strict(),
  })
  .strict();

function parseArgs(argv: string[]): { file: string; supplied?: string } {
  const rest = argv.slice(2);
  let file: string | undefined;
  let supplied: string | undefined;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i] ?? "";
    if (arg === "--correlation-id") {
      const value = rest[i + 1];
      if (supplied !== undefined || value === undefined)
        throw new Refused("usage");
      supplied = value;
      i += 1;
    } else if (arg.startsWith("-") || file !== undefined) {
      throw new Refused("usage");
    } else file = arg;
  }
  if (file === undefined) throw new Refused("usage");
  return supplied === undefined ? { file } : { file, supplied };
}

const isOk = (kind: string): boolean =>
  kind === "created" || kind === "converged";

async function main(): Promise<number> {
  // ---- everything below up to the pool is DATABASE-FREE ------------------------------------------------------------------------
  let config;
  try {
    config = loadConfig();
  } catch {
    throw new Refused("config_invalid");
  }
  try {
    assertFixtureLoadAllowed(config);
  } catch {
    throw new Refused("environment_not_permitted");
  }
  const args = parseArgs(process.argv);
  const correlationId = args.supplied ?? randomUUID();
  if (!readContext({ correlationId, observer: () => undefined }).ok)
    throw new Refused("correlation_id_invalid");
  let raw: string;
  try {
    raw = await readFile(args.file, "utf8");
  } catch {
    throw new Refused("input_unreadable");
  }
  let parsed: z.output<typeof envelope>;
  try {
    parsed = envelope.parse(JSON.parse(raw));
  } catch {
    throw new Refused("input_invalid");
  }
  const runId = parsed.run.program_run_id;
  const attemptId = parsed.attempt.attempt_id;
  if (typeof runId !== "string" || typeof attemptId !== "string")
    throw new Refused("input_invalid");
  if (parsed.attempt.program_run_id !== runId)
    throw new Refused("identity_mismatch");

  // ---- the pool and the logger exist only from here ----------------------------------------------------------------------------
  const logger = createLogger(
    config,
    pino.destination({ dest: 1, sync: true }),
  );
  const pool = createRuntimePool(config);
  const idle = { errors: 0 };
  pool.on("error", () => {
    idle.errors += 1;
  });
  const observer = commandObserver(logger);
  const context = { correlationId, observer };

  let exitCode = 0;
  try {
    const run = await createProgramRun(
      pool,
      parsed.run as unknown as AuthoredProgramRun,
      { ...context, stage: "standalone" },
    );
    if (!isOk(run.kind)) exitCode = 2;
    else {
      const attempt = await createProgramAttempt(
        pool,
        parsed.attempt as unknown as AuthoredProgramAttempt,
        { ...context, stage: "standalone" },
      );
      if (!isOk(attempt.kind)) exitCode = 2;
      else {
        const slice = await runEvidenceSlice(
          pool,
          {
            attemptId,
            units: parsed.slice.units,
            pkg: parsed.slice.pkg,
          } as unknown as SliceInput,
          context,
        );
        if (!slice.complete) exitCode = 2;
      }
    }
  } catch {
    // a thrown command error (including a lost connection): never retried or replayed; the event stream already carries the facts
    say("command_error");
    exitCode = 1;
  }

  // ---- cleanup: decided AFTER the outcome, so it can never replace it --------------------------------------------------------------
  const shutdown = async (): Promise<boolean> => {
    let timer: NodeJS.Timeout | undefined;
    try {
      const flush = new Promise<void>((resolve, reject) => {
        logger.flush((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      const settled = Promise.allSettled([flush, pool.end()]).then((results) =>
        results.every((r) => r.status === "fulfilled"),
      );
      const deadline = new Promise<boolean>((resolve) => {
        timer = setTimeout(() => {
          resolve(false);
        }, CLEANUP_DEADLINE_MS);
      });
      return await Promise.race([settled, deadline]);
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };
  const cleanupOk = await shutdown();
  if (!cleanupOk || idle.errors > 0) {
    say("cleanup_failed");
    if (exitCode === 0) exitCode = 1;
  }
  return exitCode;
}

process.on("uncaughtException", () => {
  say("unexpected");
  process.exit(1);
});
process.on("unhandledRejection", () => {
  say("unexpected");
  process.exit(1);
});

let code: number;
try {
  code = await main();
} catch (error) {
  if (error instanceof Refused) say(error.code);
  else say("unexpected");
  code = 1;
}
// An explicit exit: a hung shutdown can leave handles open, and the outcome is already decided and written.
process.exit(code);
