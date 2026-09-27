import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import {
  assertDestructiveOperationAllowed,
  loadConfig,
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
      loadConfig({ ...base, DATABASE_URL: base.MIGRATION_DATABASE_URL }),
    ).toThrow(/credentials must differ/);
    expect(loadConfig(base).PROVIDERS_ENABLED).toBe(false);
  });

  it("denies destructive production operations", () => {
    expect(() =>
      assertDestructiveOperationAllowed(loadConfig(base), "destroy-test"),
    ).not.toThrow();
    const production = loadConfig({
      ...base,
      DESK_ENV: "production",
      DEPLOYED_COMMIT: "deadbeef",
    });
    expect(() =>
      assertDestructiveOperationAllowed(production, "destroy-production"),
    ).toThrow(/denied/);
  });

  it("redacts protected logging fields", async () => {
    let output = "";
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
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
