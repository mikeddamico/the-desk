import { z } from "zod";

const boolean = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const schema = z
  .object({
    DESK_ENV: z.enum(["development", "test", "staging", "production"]),
    DATABASE_URL: z.url({ protocol: /^postgresql$/ }),
    MIGRATION_DATABASE_URL: z.url({ protocol: /^postgresql$/ }),
    DEPLOYED_COMMIT: z.string().min(1),
    PROVIDERS_ENABLED: boolean.default(false),
    GENERATION_KILL_SWITCH: boolean.default(true),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    ERROR_TRACKING_DSN: z.url().optional(),
  })
  .superRefine((config, context) => {
    if (
      ["development", "test"].includes(config.DESK_ENV) &&
      config.PROVIDERS_ENABLED
    ) {
      context.addIssue({
        code: "custom",
        path: ["PROVIDERS_ENABLED"],
        message:
          "providers default off and require a non-development environment",
      });
    }
    if (
      config.DESK_ENV === "production" &&
      config.DEPLOYED_COMMIT === "local"
    ) {
      context.addIssue({
        code: "custom",
        path: ["DEPLOYED_COMMIT"],
        message: "production requires an auditable commit",
      });
    }
    if (config.DATABASE_URL === config.MIGRATION_DATABASE_URL) {
      context.addIssue({
        code: "custom",
        path: ["MIGRATION_DATABASE_URL"],
        message: "runtime and migration credentials must differ",
      });
    }
  });

export type Config = z.output<typeof schema>;

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): Config {
  return schema.parse(environment);
}

export function assertDestructiveOperationAllowed(
  config: Config,
  confirmation: string | undefined,
): void {
  if (
    config.DESK_ENV === "production" ||
    confirmation !== `destroy-${config.DESK_ENV}`
  ) {
    throw new Error(
      "Destructive operation denied: non-production identity and exact confirmation are required",
    );
  }
}
