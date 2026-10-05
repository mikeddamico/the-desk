// Local Foundation capability entry. No provider, publication, revalidation or repair execution.
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";
import pino, { type Logger } from "pino";
import { loadConfig } from "../config.js";
import { createRuntimePool } from "../db/pool.js";
import { createLogger } from "../logging.js";
import {
  CommandConnectionError,
  Rejection,
  type Outcome,
} from "../runtime/command.js";
import {
  REVIEW_WAIT_CODES,
  resumeReviewWait,
  submitReviewDecision,
  validateReviewRequest,
  type Candidate,
  type Receipt,
  type WaitRecord,
} from "../runtime/review-wait.js";

const CLEANUP_MS = 5000;
async function bounded(task: Promise<void>): Promise<void> {
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
export async function reviewWaitMain(
  args = process.argv.slice(2),
  environment = process.env,
): Promise<void> {
  const correlation = randomUUID();
  let logger: Logger | undefined;
  let pool: pg.Pool | undefined;
  let errorLevelFiltered = false as boolean;
  let result: Outcome<WaitRecord | Receipt> | undefined;
  let stage = "preflight";
  let firstStage = stage;
  let first: unknown;
  let failed = false as boolean;
  // Mutated by the emission closure during asynchronous cleanup.
  let diagnosticEmitted = false as boolean;
  const record = (error: unknown): void => {
    if (!failed) {
      failed = true;
      first = error;
      firstStage = stage;
    }
  };
  const emit = (error = false, fallback = false): void => {
    // Ids are logged only from established canonical records, never from a refused request or raw Error/input.
    const stored: Candidate | undefined =
      result && "record" in result ? result.record : undefined;
    const code = error
      ? first instanceof Rejection
        ? first.code
        : undefined
      : result && "code" in result
        ? result.code
        : undefined;
    const fields = {
      event: "review.wait",
      command: "foundation_review_wait",
      correlation_id: correlation,
      stage: error ? firstStage : stage,
      outcome: error ? "error" : result?.kind,
      code:
        code && (REVIEW_WAIT_CODES as readonly string[]).includes(code)
          ? code
          : undefined,
      error_class: error
        ? first instanceof CommandConnectionError
          ? "CommandConnectionError"
          : first instanceof Rejection
            ? "Rejection"
            : "unclassified"
        : undefined,
      run_id: stored?.run_id ?? null,
      attempt_id: stored?.attempt_id ?? null,
      episode_version_id: stored?.episode_version_id ?? null,
      status:
        result && "record" in result && "status" in result.record
          ? result.record.status
          : undefined,
      deadline:
        result && "record" in result && "deadline" in result.record
          ? result.record.deadline
          : undefined,
      halt_cause:
        result && "record" in result && "halt_cause" in result.record
          ? result.record.halt_cause
          : undefined,
      review_decision_id:
        result && "record" in result
          ? "review_decision_id" in result.record
            ? result.record.review_decision_id
            : result.record.receipt?.review_decision_id
          : undefined,
      decided_at:
        result && "record" in result && "decided_at" in result.record
          ? result.record.decided_at
          : undefined,
    };
    // Validated silent/fatal configuration filters .error; mandatory first diagnostics still reach stderr.
    if (logger && !fallback && !(error && errorLevelFiltered))
      logger[error ? "error" : "info"](fields);
    else process.stderr.write(`${JSON.stringify(fields)}\n`);
    if (error) diagnosticEmitted = true;
  };
  try {
    if (
      environment.DESK_ENV !== "development" &&
      environment.DESK_ENV !== "test"
    )
      throw new Rejection("review_request_invalid");
    if (args.length !== 2 || (args[0] !== "wait" && args[0] !== "submit"))
      throw new Rejection("review_request_invalid");
    const mode = args[0];
    let input: unknown;
    try {
      input = JSON.parse(args[1] ?? "");
    } catch {
      throw new Rejection("review_request_invalid");
    }
    const request = validateReviewRequest(input, mode === "submit");
    const config = loadConfig(environment);
    errorLevelFiltered =
      config.LOG_LEVEL === "silent" || config.LOG_LEVEL === "fatal";
    const runtime = new URL(config.DATABASE_URL);
    if (runtime.search || runtime.hash || !runtime.username)
      throw new Rejection("review_request_invalid");
    let operator: URL | undefined;
    if (mode === "submit") {
      operator = new URL(environment.OPERATOR_DATABASE_URL ?? "");
      if (
        operator.protocol !== "postgresql:" ||
        operator.search ||
        operator.hash ||
        !operator.username ||
        decodeURIComponent(operator.username) ===
          decodeURIComponent(runtime.username) ||
        operator.hostname !== runtime.hostname ||
        (operator.port || "5432") !== (runtime.port || "5432") ||
        operator.pathname !== runtime.pathname
      )
        throw new Rejection("review_request_invalid");
    }
    logger = createLogger(config, pino.destination({ dest: 1, sync: true }));
    pool =
      mode === "wait"
        ? createRuntimePool(config)
        : new pg.Pool({
            connectionString: operator?.toString(),
            options: "-c role=desk_operator",
            max: 1,
            application_name: "the-desk-review-operator",
          });
    pool.on("error", record);
    stage = mode === "wait" ? "review_resume" : "review_submit";
    result =
      mode === "wait"
        ? await resumeReviewWait(pool, request, config)
        : await submitReviewDecision(pool, request, config);
    if (failed) throw first;
    emit();
    if (result.kind === "rejected" || result.kind === "conflict")
      process.exitCode = 2;
  } catch (error) {
    record(error);
  } finally {
    stage = "cleanup";
    // Listeners remain through direct process termination, including the flush window after pool timeout.
    if (pool) {
      try {
        await bounded(pool.end());
      } catch (error) {
        record(error);
      }
    }
    if (failed) {
      try {
        emit(true);
      } catch (error) {
        record(error);
      }
    }
    if (logger) {
      try {
        const sink = logger;
        await bounded(
          new Promise<void>((resolve, reject) => {
            sink.flush((error) => {
              if (error) reject(error);
              else resolve();
            });
          }),
        );
      } catch (error) {
        record(error);
        try {
          emit(true, true);
        } catch (diagnosticError) {
          record(diagnosticError);
        }
      }
    }
    // A first pool error may arrive during a SUCCESSFUL delayed flush, after the earlier emission check.
    // Emit it synchronously after that window; no second asynchronous flush can reopen a diagnostic gap.
    if (failed && !diagnosticEmitted) {
      try {
        emit(true, true);
      } catch (diagnosticError) {
        record(diagnosticError);
      }
    }
  }
  if (failed) {
    process.exitCode = 1;
    throw first;
  }
}
if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    await reviewWaitMain();
  } catch {
    process.exitCode = 1;
  }
  process.exit(process.exitCode ?? 0); // bounded cleanup includes direct termination of lingering handles
}
