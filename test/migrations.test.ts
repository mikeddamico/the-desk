import { describe, expect, it } from "vitest";

import { readMigrations } from "../src/db/migrations.js";

describe("migration source integrity", () => {
  it("uses ordered, uniquely named, checksummed forward migrations", async () => {
    const migrations = await readMigrations();
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations.map(({ name }) => name)).toEqual(
      [...migrations.map(({ name }) => name)].sort(),
    );
    expect(new Set(migrations.map(({ name }) => name)).size).toBe(
      migrations.length,
    );
    for (const migration of migrations) {
      expect(migration.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(migration.sql).not.toMatch(/\bDROP\s+TABLE\b/i);
    }
  });
});
