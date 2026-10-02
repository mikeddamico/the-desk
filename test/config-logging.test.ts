import { execFileSync } from "node:child_process";
import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import {
  assertDestructiveOperationAllowed,
  assertFixtureLoadAllowed,
  loadConfig,
  loadMigrationConfig,
} from "../src/config.js";
import { createLogger } from "../src/logging.js";

const base = {
  DESK_ENV: "test",
  DATABASE_URL: "postgresql://runtime@localhost/db",
  MIGRATION_DATABASE_URL: "postgresql://migrator@localhost/db",
  DEPLOYED_COMMIT: "abc123",
};

describe("environment and security foundation", () => {
  it("requires explicit identity and separate database credentials", () => {
    expect(() => loadConfig({})).toThrow();
    expect(() =>
      loadMigrationConfig({
        ...base,
        DATABASE_URL: base.MIGRATION_DATABASE_URL,
      }),
    ).toThrow(/credentials must differ/);
    expect(loadConfig(base).PROVIDERS_ENABLED).toBe(false);
  });

  it("denies destructive production operations", () => {
    const testConfig = loadConfig(base);
    assertDestructiveOperationAllowed(testConfig, "destroy-test");
    const production = loadConfig({
      ...base,
      DESK_ENV: "production",
      DEPLOYED_COMMIT: "deadbeef".repeat(5),
    });
    expect(() => {
      assertDestructiveOperationAllowed(production, "destroy-production");
    }).toThrow(/denied/);
  });

  it("restricts the fixture load to development and test", () => {
    expect(() => {
      assertFixtureLoadAllowed(loadConfig(base));
    }).not.toThrow();
    for (const DESK_ENV of ["staging", "production"] as const)
      expect(() => {
        assertFixtureLoadAllowed(
          loadConfig({
            ...base,
            DESK_ENV,
            DEPLOYED_COMMIT: "deadbeef".repeat(5),
          }),
        );
      }).toThrow(/restricted/);
  });

  it("redacts protected logging fields", async () => {
    let output = "";
    const sink = new Writable({
      write(
        chunk: unknown,
        _encoding: BufferEncoding,
        callback: (error?: Error | null) => void,
      ) {
        if (typeof chunk === "string" || Buffer.isBuffer(chunk)) {
          output += chunk.toString();
          callback();
          return;
        }
        callback(new TypeError("Logger emitted an unsupported chunk type"));
      },
    });
    const logger = createLogger(
      { LOG_LEVEL: "info", DESK_ENV: "test", DEPLOYED_COMMIT: "abc" },
      sink,
    );
    logger.info({ token: "secret-value", sourceBody: "protected" }, "event");
    await new Promise((resolve) => setImmediate(resolve));
    expect(output).not.toContain("secret-value");
    expect(output).not.toContain("protected");
    expect(output).toContain("[REDACTED]");
  });
});

describe("runtime and migration configuration separation", () => {
  it("starts health with runtime credentials alone", () => {
    const env = { ...base };
    delete (env as Partial<typeof env>).MIGRATION_DATABASE_URL;
    expect(loadConfig(env).DATABASE_URL).toBe(base.DATABASE_URL);
    expect(() => loadMigrationConfig(env)).toThrow();
    const output = execFileSync(
      process.execPath,
      ["--import", "tsx", "src/health.ts"],
      { env: { PATH: process.env.PATH, ...env }, encoding: "utf8" },
    );
    expect(JSON.parse(output)).toMatchObject({
      status: "ok",
      environment: "test",
    });
  });
  it("requires a real full deployed commit in staging/production", () => {
    for (const DESK_ENV of ["staging", "production"]) {
      for (const DEPLOYED_COMMIT of [
        "unknown",
        "local",
        "deadbeef",
        "g".repeat(40),
      ])
        expect(() =>
          loadConfig({ ...base, DESK_ENV, DEPLOYED_COMMIT }),
        ).toThrow(/auditable commit/);
      expect(
        loadConfig({ ...base, DESK_ENV, DEPLOYED_COMMIT: "a".repeat(40) })
          .DEPLOYED_COMMIT,
      ).toBe("a".repeat(40));
    }
  });
});
