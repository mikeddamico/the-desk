import pino, { type DestinationStream, type Logger } from "pino";

import type { Config } from "./config.js";

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
