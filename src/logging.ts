import pino, { type DestinationStream, type Logger } from "pino";

import type { Config } from "./config.js";
import {
  projectEvent,
  type CommandEvent,
  type CommandObserver,
  type RawEvent,
} from "./runtime/observe.js";

const redact = [
  "req.headers.authorization",
  "req.headers.cookie",
  "authorization",
  "apiKey",
  "token",
  "secret",
  "sourceBody",
  "rawPrompt",
  "providerRequest.body",
];

export interface LogContext {
  correlationId: string;
  runId?: string;
  attemptId?: string;
  artifactId?: string;
  stage?: string;
}

export function createLogger(
  config: Pick<Config, "LOG_LEVEL" | "DESK_ENV" | "DEPLOYED_COMMIT">,
  destination?: DestinationStream,
): Logger {
  return pino(
    {
      level: config.LOG_LEVEL,
      base: {
        service: "the-desk",
        environment: config.DESK_ENV,
        deployedCommit: config.DEPLOYED_COMMIT,
      },
      redact: { paths: redact, censor: "[REDACTED]" },
    },
    destination,
  );
}

export function contextualLogger(logger: Logger, context: LogContext): Logger {
  return logger.child(context);
}

/**
 * Adapter from the closed, flat command event (src/runtime/observe.ts) to a pino logger. The given event is RE-PROJECTED here
 * (`projectEvent`) before it is logged, so only validated ids, enums and counts can reach the logger even when this public adapter is
 * called directly with an arbitrary or type-cast object; the re-projected event is the merging object. No child bindings and no Error
 * objects are involved (pino wraps a logged Error as `{err}` with its message and stack). The `redact` list above is NOT relied on for
 * nested data (pino wildcards are per path segment). Level follows durability/outcome only; it implies no retry policy.
 */
export function commandObserver(logger: Logger): CommandObserver {
  return (given: CommandEvent): void => {
    // Re-project at THIS boundary even though the normal emission path already projected: the adapter is public, and an arbitrary
    // JS/TS caller (or a type-cast event) must not be able to log an unvalidated extra field.
    const event = projectEvent(given as unknown as RawEvent);
    const refused =
      event.outcome === "conflict" ||
      event.outcome === "rejected" ||
      event.outcome === "held_by_other" ||
      event.durability === "not_committed" ||
      event.status === "stopped" ||
      event.status === "ambiguous" ||
      event.status === "unfinished" ||
      event.status === "unknown";
    const level =
      event.durability === "unknown" || event.error_class !== undefined
        ? "error"
        : refused
          ? "warn"
          : "info";
    logger[level](event, event.event);
  };
}
