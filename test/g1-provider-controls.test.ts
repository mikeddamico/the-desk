import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  executeProviderCall,
  ProviderExecutionError,
} from "../src/runtime/provider.js";
import {
  nonNetworkControls,
  reservation,
  finishSucceeded,
} from "./support/a5-provider.js";
import { noopContext } from "./support/a6-observed.js";

describe("G1-A pre-DB snapshot and safe execution errors", () => {
  it("has one actual adapter perform site in the shared controlled execution implementation", () => {
    const sites: string[] = [];
    const scan = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) scan(path);
        else if (path.endsWith(".ts"))
          sites.push(
            ...Array.from(
              readFileSync(path, "utf8").matchAll(/\badapter\.perform\s*\(/g),
              () => path,
            ),
          );
      }
    };
    scan("src");
    expect(sites).toEqual(["src/runtime/provider.ts"]);
  });
  it("refuses malformed reservation before pool access", async () => {
    let touched = 0;
    const pool = new Proxy(
      {},
      {
        get() {
          touched++;
          throw new Error("POOL_CANARY");
        },
      },
    ) as Pool;
    const result = await executeProviderCall(
      pool,
      { ...reservation(randomUUID()), provider: "" },
      {
        perform: () =>
          Promise.resolve({ invocation_id: randomUUID(), cost: "0" }),
      },
      finishSucceeded(randomUUID()),
      noopContext(),
      nonNetworkControls(),
    );
    expect(result).toMatchObject({
      status: "rejected",
      result: { code: "invalid_string" },
    });
    expect(touched).toBe(0);
    expect(JSON.stringify(result)).not.toContain("CANARY");
  });

  it("contains an exotic thrown Proxy whose prototype classifier throws", async () => {
    const exotic = new Proxy(new Error("EXOTIC_INPUT"), {
      getPrototypeOf() {
        throw new Error("EXOTIC_CANARY");
      },
    });
    const input = new Proxy(
      {},
      {
        ownKeys() {
          throw exotic;
        },
      },
    );
    const result = await executeProviderCall(
      {} as Pool,
      input as never,
      {} as never,
      (() => ({})) as never,
      noopContext(),
      nonNetworkControls(),
    );
    expect(result).toMatchObject({
      status: "rejected",
      result: { code: "provider_reservation_invalid" },
    });
    expect(JSON.stringify(result)).not.toContain("CANARY");
  });

  it("contains consumed query/pool errors, without raw causes or attachments", async () => {
    let queried = 0;
    let connected = 0;
    const pool = {
      query() {
        queried++;
        throw new Error("QUERY_CANARY");
      },
      connect() {
        connected++;
        throw new AggregateError([new Error("POOL_CANARY")], "SQL_CANARY");
      },
    } as unknown as Pool;
    const context = noopContext();
    let caught: unknown;
    try {
      await executeProviderCall(
        pool,
        reservation(randomUUID()),
        {
          perform: () =>
            Promise.resolve({ invocation_id: randomUUID(), cost: "0" }),
        },
        finishSucceeded(randomUUID()),
        context,
        nonNetworkControls(),
      );
    } catch (error) {
      caught = error;
    }
    expect(queried).toBe(1);
    expect(connected).toBe(1);
    expect(caught).toBeInstanceOf(ProviderExecutionError);
    expect(caught).toMatchObject({
      code: "provider_execution_failed",
      correlation_id: context.correlationId,
      stage: "reserve",
      commit_state: "not_committed",
    });
    const error = caught as Error;
    expect(error).not.toHaveProperty("cause");
    expect(error).not.toHaveProperty("errors");
    expect(JSON.stringify(error) + (error.stack ?? "")).not.toContain("CANARY");
  });
});
