import { createHash } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
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

it("hashes exact migration file bytes, including a BOM, and rejects invalid UTF-8", async () => {
  const directory = await mkdtemp(join(tmpdir(), "desk-byte-test-"));
  try {
    const bytes = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from("SELECT 'café';\r\n"),
    ]);
    await writeFile(join(directory, "001_bytes.sql"), bytes);
    const migrations = await readMigrations(directory);
    expect(migrations[0]?.checksum).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
    await writeFile(join(directory, "001_bytes.sql"), Buffer.from([0xff]));
    await expect(readMigrations(directory)).rejects.toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
