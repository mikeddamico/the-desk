import { z } from "zod";

const boolean = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const schema = z
  .object({
    DESK_ENV: z.enum(["development", "test", "staging", "production"]),
    DATABASE_URL: z.url({ protocol: /^postgresql$/ }),
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
      !["development", "test"].includes(config.DESK_ENV) &&
      !/^[0-9a-f]{40}$/.test(config.DEPLOYED_COMMIT)
    ) {
      context.addIssue({
        code: "custom",
        path: ["DEPLOYED_COMMIT"],
        message: "staging/production require a full auditable commit SHA",
      });
    }
  });

export type Config = z.output<typeof schema>;

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): Config {
  return schema.parse(environment);
}

/** The synthetic fixture load is a development/test tool; staging use is a Completion B decision. */
export function assertFixtureLoadAllowed(
  config: Pick<Config, "DESK_ENV">,
): void {
  if (!["development", "test"].includes(config.DESK_ENV))
    throw new Error(
      "Fixture loading is restricted to DESK_ENV development or test",
    );
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

export function loadMigrationConfig(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const config = loadConfig(environment);
  const migrationUrl = z
    .url({ protocol: /^postgresql$/ })
    .parse(environment.MIGRATION_DATABASE_URL);
  if (migrationUrl === config.DATABASE_URL)
    throw new Error("runtime and migration credentials must differ");
  return { ...config, MIGRATION_DATABASE_URL: migrationUrl };
}
export type MigrationConfig = ReturnType<typeof loadMigrationConfig>;
