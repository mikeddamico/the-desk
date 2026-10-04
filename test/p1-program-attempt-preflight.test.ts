// P1 entry: every refusal that must happen BEFORE the pool exists performs NO database access. The proof is a counting TCP listener
// standing in for the database: refusals must leave its connection count at ZERO (unchanged rows alone would not prove it), and a
// positive control with a valid envelope must make the entry connect (count >= 1), so a count of zero is not vacuous.
// Real child processes; no PostgreSQL is needed (the listener accepts and immediately destroys connections).
import { randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { entryEnv, runEntry } from "./support/p1-entry.js";

let server: net.Server;
let connections = 0;
let databaseUrl = "";
let dir = "";
beforeAll(async () => {
  server = net.createServer((socket) => {
    connections += 1;
    socket.destroy();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as net.AddressInfo;
  databaseUrl = `postgresql://u:p@127.0.0.1:${String(port)}/d`;
  dir = mkdtempSync(join(tmpdir(), "p1-preflight-"));
});
afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
});

const RUN = randomUUID();
const ATTEMPT = randomUUID();
const valid = {
  run: {
    program_run_id: RUN,
    show_id: randomUUID(),
    purpose: "evaluation",
    created_at: "2026-10-01T10:00:00.123456Z",
  },
  attempt: {
    attempt_id: ATTEMPT,
    program_run_id: RUN,
    show_config_version_id: randomUUID(),
    created_at: "2026-10-01T10:00:01.000001Z",
  },
  slice: { units: [], pkg: {} },
};
let n = 0;
const file = (content: unknown): string => {
  n += 1;
  const path = join(dir, `input-${String(n)}.json`);
  writeFileSync(
    path,
    typeof content === "string" ? content : JSON.stringify(content),
  );
  return path;
};
const CANARY = "CANARY_P1_PREFLIGHT_VALUE_7f3a";

describe("P1 entry preflight: refused before any database access", () => {
  const cases: [
    string,
    () => { args: string[]; env?: Record<string, string> },
    string,
  ][] = [
    ["no arguments", () => ({ args: [] }), "usage"],
    [
      "two positional arguments",
      () => ({ args: [file(valid), file(valid)] }),
      "usage",
    ],
    ["unknown flag", () => ({ args: [file(valid), "--verbose"] }), "usage"],
    [
      "flag without a value",
      () => ({ args: [file(valid), "--correlation-id"] }),
      "usage",
    ],
    [
      "duplicate correlation flag",
      () => ({
        args: [
          file(valid),
          "--correlation-id",
          randomUUID(),
          "--correlation-id",
          randomUUID(),
        ],
      }),
      "usage",
    ],
    [
      "uppercase correlation id",
      () => ({
        args: [file(valid), "--correlation-id", randomUUID().toUpperCase()],
      }),
      "correlation_id_invalid",
    ],
    [
      "short correlation id",
      () => ({ args: [file(valid), "--correlation-id", "1234"] }),
      "correlation_id_invalid",
    ],
    [
      "correlation id carrying a canary",
      () => ({ args: [file(valid), "--correlation-id", CANARY] }),
      "correlation_id_invalid",
    ],
    [
      "missing input file",
      () => ({ args: [join(dir, "does-not-exist.json")] }),
      "input_unreadable",
    ],
    [
      "invalid JSON",
      () => ({ args: [file(`{"run": ${CANARY}`)] }),
      "input_invalid",
    ],
    [
      "unknown top-level key",
      () => ({ args: [file({ ...valid, [CANARY]: 1 })] }),
      "input_invalid",
    ],
    [
      "missing slice",
      () => ({ args: [file({ run: valid.run, attempt: valid.attempt })] }),
      "input_invalid",
    ],
    [
      "units not an array",
      () => ({ args: [file({ ...valid, slice: { units: CANARY, pkg: {} } })] }),
      "input_invalid",
    ],
    [
      "unknown key inside slice",
      () => ({
        args: [file({ ...valid, slice: { ...valid.slice, extra: CANARY } })],
      }),
      "input_invalid",
    ],
    [
      "non-string run identity",
      () => ({
        args: [file({ ...valid, run: { ...valid.run, program_run_id: 7 } })],
      }),
      "input_invalid",
    ],
    [
      "run/attempt identity mismatch",
      () => ({
        args: [
          file({
            ...valid,
            attempt: { ...valid.attempt, program_run_id: randomUUID() },
          }),
        ],
      }),
      "identity_mismatch",
    ],
    [
      "production environment",
      () => ({
        args: [file(valid)],
        env: { DESK_ENV: "production", DEPLOYED_COMMIT: "a".repeat(40) },
      }),
      "environment_not_permitted",
    ],
    [
      "staging environment",
      () => ({
        args: [file(valid)],
        env: { DESK_ENV: "staging", DEPLOYED_COMMIT: "b".repeat(40) },
      }),
      "environment_not_permitted",
    ],
    [
      "invalid configuration (no DATABASE_URL)",
      () => ({ args: [file(valid)], env: { DATABASE_URL: "" } }),
      "config_invalid",
    ],
  ];
  it.each(cases)(
    "%s: exit 1, one fixed stderr line, empty stdout, ZERO database connections",
    async (_name, build, expected) => {
      const before = connections;
      const { args, env } = build();
      const out = await runEntry(args, entryEnv(databaseUrl, env ?? {}));
      expect(out.timedOut).toBe(false);
      expect(out.code).toBe(1);
      expect(out.stderr).toBe(`program-attempt: ${expected}\n`); // fixed text: no Error, input, environment or config value
      expect(out.stderr).not.toContain(CANARY);
      expect(out.stdout).toBe("");
      expect(connections).toBe(before); // the database was never contacted
    },
    30000,
  );

  it("positive control: a VALID envelope makes the entry contact the database (the zero counts above are not vacuous)", async () => {
    const before = connections;
    const out = await runEntry([file(valid)], entryEnv(databaseUrl));
    expect(out.timedOut).toBe(false);
    expect(connections).toBeGreaterThan(before);
    // the listener drops every connection, so the first command throws: unexpected error class, fixed line, never retried
    expect(out.code).toBe(1);
    expect(out.stderr).toContain("program-attempt: command_error\n");
  }, 60000);

  it("a supplied canonical correlation id passes the syntax check (it reaches the database stage)", async () => {
    const before = connections;
    const out = await runEntry(
      [file(valid), "--correlation-id", randomUUID()],
      entryEnv(databaseUrl),
    );
    expect(connections).toBeGreaterThan(before);
    expect(out.stderr).toContain("program-attempt: command_error\n");
  }, 60000);
});
