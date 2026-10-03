// A5.1 durable command helpers: the transaction boundary shared by every command.
// One command = one pinned connection, one READ COMMITTED transaction. A command that returns `conflict` or `rejected` ROLLS BACK
// (nothing it did is committed, including incidental rows); only `created` / `converged` commit. Possibly-conflicting INSERTs run in
// a SAVEPOINT (`Tx.attempt`): after a unique violation PostgreSQL aborts the transaction until ROLLBACK TO SAVEPOINT, which
// `attempt` performs before returning, so the caller may re-read the winner's committed row. Unrelated database errors are never
// swallowed: `attempt` hands back the error and the caller either matches a NAMED constraint or rethrows it.
// Runtime privileges are unchanged (the pool's role is whatever the caller supplies; the tests use desk_runtime).
import type { Pool, PoolClient } from "pg";

export type Row = Record<string, unknown>;
export type Json = null | boolean | number | string | Json[] | JsonRecord;

// A recursive alias cannot be written as Record<string, Json> directly; extending Record is the equivalent, lint-clean form.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface JsonRecord extends Record<string, Json> {}

export type Outcome<R> =
  | { kind: "created"; record: R }
  /** Identical retry; `record` is the STORED record. */
  | { kind: "converged"; record: R }
  /** A5.2: the logical slot is reserved by a DIFFERENT authored identity. Nothing was written; the caller MUST NOT perform. */
  | { kind: "held_by_other"; record: R }
  /** The same identity exists with different immutable data (or the identity is occupied by a different record). */
  | { kind: "conflict"; code: string; stored: unknown; detail: string }
  /** Invalid request or guard rejection; nothing was written. */
  | { kind: "rejected"; code: string; detail?: string; sqlstate?: string };

export const commits = (o: { kind: string }): boolean =>
  o.kind === "created" || o.kind === "converged";

/** A request the command refuses before or during the transaction. */
export class Rejection extends Error {
  readonly code: string;
  constructor(code: string, detail = "") {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "Rejection";
    this.code = code;
  }
}

/**
 * The checked-out connection failed (the client emitted `error`: backend terminated, socket reset, ...) while this command held it.
 * `cause` is the FIRST error the connection reported. `commitOutcome` states only what this process knows:
 *  - `not_attempted`: this command never sent COMMIT (`phase` `before_commit`, or `rollback` when the failure struck the ROLLBACK
 *    of a command that returned a non-committing outcome). Nothing was committed by this command; a lost ROLLBACK acknowledgment
 *    is not a COMMIT attempt;
 *  - `unknown`: COMMIT was sent and its acknowledgment was lost; the transaction may or may not have committed. Callers must
 *    reconcile by identity (look up / resend the identical authored request) and must NOT assume either result.
 * The command is never replayed here and the failed connection is destroyed, not returned to the pool.
 */
export class CommandConnectionError extends Error {
  readonly phase: "before_commit" | "commit" | "rollback";
  readonly commitOutcome: "not_attempted" | "unknown";
  constructor(cause: unknown, phase: "before_commit" | "commit" | "rollback") {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`command connection failed during ${phase}: ${detail}`, { cause });
    this.name = "CommandConnectionError";
    this.phase = phase;
    this.commitOutcome = phase === "commit" ? "unknown" : "not_attempted";
  }
}

// Follow-on cleanup failures, keyed by the error they accompany. A WeakMap (not a property) so a frozen / non-extensible / exotic
// error object can never make the attachment itself throw and mask the first diagnostic.
const cleanupFailures = new WeakMap<object, unknown[]>();
/** Cleanup failures (ROLLBACK / release) that followed the first error `error`, if any. */
export const commandCleanupErrors = (error: unknown): readonly unknown[] =>
  typeof error === "object" && error !== null
    ? (cleanupFailures.get(error) ?? [])
    : [];

export interface DbError {
  code?: string | undefined;
  constraint?: string | undefined;
  message: string;
}

export interface Tx {
  query(text: string, values?: unknown[]): Promise<{ rows: Row[] }>;
  /** Runs one statement in a SAVEPOINT. On failure the savepoint is rolled back (the transaction stays usable) and the error returned. */
  attempt(
    text: string,
    values?: unknown[],
  ): Promise<{ ok: true; rows: Row[] } | { ok: false; error: DbError }>;
}

/**
 * Test-only fault seam. It is inert unless the process was started with DESK_TEST_FAULTS=1 AND a harness installed a hook under the
 * registered symbol; nothing mutable is exported from this module. Production never sets either.
 */
const FAULT_HOOK = Symbol.for("the-desk.a5.test-fault-hook");
export const faultPoint = async (point: string): Promise<void> => {
  if (process.env.DESK_TEST_FAULTS !== "1") return;
  const hook = (globalThis as Record<symbol, unknown>)[FAULT_HOOK];
  if (typeof hook === "function")
    await (hook as (name: string) => Promise<void>)(point);
};

export async function runCommand<R>(
  pool: Pool,
  fn: (tx: Tx) => Promise<Outcome<R>>,
): Promise<Outcome<R>> {
  let client: PoolClient | undefined;
  let open = false as boolean; // assigned inside `execute`; keeps TS from narrowing it to `false`
  let broken: unknown;
  let savepoints = 0;
  let phase: "work" | "commit" | "rollback" | "after_end" = "work";
  // the error this call throws (if any); cleanup failures are attached to it, never allowed to replace it
  let thrown: unknown;
  // pg-pool removes ITS error listener while a client is checked out (pg-pool 3.14.0 `_acquireClient`) and only restores it in
  // `release`, so an error emitted by a checked-out connection (backend terminated, socket reset) would be an UNHANDLED error event
  // that can take the process down. This scoped listener is attached immediately after checkout and removed only AFTER `release`
  // (which has by then re-attached the pool's own listener), so there is never a moment without a listener. It records the FIRST
  // connection error; it never swallows it.
  let connectionError: unknown;
  const onClientError = (error: unknown): void => {
    connectionError ??= error;
  };
  const execute = async (): Promise<Outcome<R>> => {
    try {
      client = await pool.connect();
      client.on("error", onClientError);
      await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      open = true;
      const c = client;
      const tx: Tx = {
        query: (text, values) => c.query(text, values),
        attempt: async (text, values) => {
          const name = `sp_${String((savepoints += 1))}`;
          await c.query(`SAVEPOINT ${name}`);
          try {
            const result = await c.query(text, values);
            await c.query(`RELEASE SAVEPOINT ${name}`);
            return { ok: true, rows: result.rows as Row[] };
          } catch (error) {
            // a dead connection cannot roll back to a savepoint: surface the failure instead of masking it behind a second error
            if (connectionError !== undefined) throw error;
            await c.query(`ROLLBACK TO SAVEPOINT ${name}`);
            await c.query(`RELEASE SAVEPOINT ${name}`);
            const e = error as DbError;
            return {
              ok: false,
              error: {
                code: e.code,
                constraint: e.constraint,
                message: e.message,
              },
            };
          }
        },
      };
      const isolation = await tx.query(
        "SELECT current_setting('transaction_isolation') AS level",
      );
      if (isolation.rows[0]?.level !== "read committed")
        return { kind: "rejected", code: "isolation_unsupported" };
      let outcome: Outcome<R>;
      try {
        outcome = await fn(tx);
      } catch (error) {
        if (error instanceof Rejection) {
          outcome = {
            kind: "rejected",
            code: error.code,
            detail: error.message,
          };
        } else {
          throw error;
        }
      }
      // A connection failure observed before COMMIT is never reported as a (rejected/created/...) outcome, even if `fn` happened to
      // catch the symptom and return normally.
      if (connectionError !== undefined)
        throw new CommandConnectionError(connectionError, "before_commit");
      if (commits(outcome)) {
        phase = "commit";
        await client.query("COMMIT");
        open = false;
        phase = "after_end";
        await faultPoint("after_commit_before_return");
      } else {
        phase = "rollback"; // COMMIT is never sent on this path
        await client.query("ROLLBACK");
        open = false;
        phase = "after_end";
      }
      // After a successful COMMIT the outcome is durable: a later connection failure only costs the connection, never the result.
      return outcome;
    } catch (error) {
      broken = error;
      // Report a connection failure as such (first error retained as `cause`); a COMMIT whose acknowledgment was lost is `unknown`.
      if (connectionError !== undefined && phase !== "after_end")
        thrown =
          error instanceof CommandConnectionError
            ? error
            : new CommandConnectionError(
                connectionError,
                phase === "commit"
                  ? "commit"
                  : phase === "rollback"
                    ? "rollback"
                    : "before_commit",
              );
      else thrown = error;
      throw thrown;
    }
  };
  let result: Outcome<R> | undefined;
  let failed = false;
  try {
    result = await execute();
  } catch {
    failed = true; // `thrown` holds the error to rethrow
  }
  // Cleanup runs on every path, OUTSIDE any finally (a throw in finally would replace the first error).
  if (client) {
    const cleanupErrors: unknown[] = [];
    if (open && connectionError === undefined) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        broken = rollbackError;
        cleanupErrors.push(rollbackError);
      }
    }
    // A connection whose state is unknown (or that reported an error) is destroyed, never returned to the pool.
    try {
      client.release(
        broken === undefined && connectionError === undefined
          ? undefined
          : true,
      );
    } catch (releaseError) {
      cleanupErrors.push(releaseError);
    }
    // Remove ours only AFTER release, and only if another listener is present: pg-pool's `_release` re-attaches its own listener as
    // its FIRST step (pg-pool 3.14.0), so for supported inputs it always is. If release threw before that (a double release, or a
    // pool that is not pg-pool) ours stays as the last-resort listener, so the client is never left with none.
    if (client.listeners("error").some((l) => l !== onClientError))
      client.removeListener("error", onClientError);
    if (cleanupErrors.length > 0) {
      // The FIRST failure stays the error callers see; follow-on cleanup failures are recorded beside it, never swallowed,
      // promoted or allowed to throw from here.
      if (!failed) throw cleanupErrors[0];
      if (typeof thrown === "object" && thrown !== null)
        cleanupFailures.set(thrown, cleanupErrors);
      else
        thrown = new AggregateError(
          [thrown, ...cleanupErrors],
          "command failed with a non-object error and its cleanup also failed",
        );
    }
  }
  if (result === undefined) throw thrown; // `failed`: the first error, with any cleanup failures attached
  return result;
}

/** Unique violation on one of the NAMED constraints (anything else is not "a race I understand"). */
export const isUnique = (error: DbError, ...constraints: string[]): boolean =>
  error.code === "23505" &&
  error.constraint !== undefined &&
  constraints.includes(error.constraint);

export function rethrow(error: DbError): never {
  throw Object.assign(new Error(error.message), {
    code: error.code,
    constraint: error.constraint,
  });
}

// ---- request validation shared by the commands ---------------------------------------------------------------------------
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function requireUuid(value: unknown, what: string): string {
  if (typeof value !== "string" || !uuidRe.test(value))
    throw new Rejection("invalid_uuid", what);
  return value;
}
export function requireHex64(value: unknown, what: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value))
    throw new Rejection("invalid_hash", what);
  return value;
}

const tsRe =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-](\d{2}):(\d{2}))$/;
/**
 * RFC 3339 with `Z` or a numeric offset and 0-6 fractional digits. The ORIGINAL string is returned unchanged (it is what gets
 * inserted and compared in SQL): a Date round trip would truncate to milliseconds, and PostgreSQL would silently ROUND a 7th digit,
 * so a seventh fractional digit is rejected rather than stored differently from what was authored.
 */
export function requireTimestamp(value: unknown, what: string): string {
  if (typeof value !== "string") throw new Rejection("invalid_timestamp", what);
  const m = tsRe.exec(value);
  if (!m) throw new Rejection("invalid_timestamp", what);
  if ((m[7] ?? "").length > 6) throw new Rejection("timestamp_precision", what);
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6]].map(Number);
  const probe = new Date(Date.UTC(y ?? 0, (mo ?? 1) - 1, d ?? 1));
  if (
    (y ?? 0) < 1 ||
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== (mo ?? 1) - 1 ||
    probe.getUTCDate() !== d ||
    (h ?? 0) > 23 ||
    (mi ?? 0) > 59 ||
    (s ?? 0) > 59 ||
    (m[9] !== undefined && Number(m[9]) > 23) ||
    (m[10] !== undefined && Number(m[10]) > 59)
  )
    throw new Rejection("invalid_timestamp", what);
  return value;
}

export const isJsonObject = (v: unknown): v is Record<string, Json> =>
  typeof v === "object" &&
  v !== null &&
  !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype ||
    Object.getPrototypeOf(v) === null);

/**
 * Governed JSON number boundary (as A3): only safe integers; decimals travel as strings. Returns the NORMALIZED copy: this is the ONE
 * representation that is hashed, compared and stored. Every own key is preserved - properties are defined (never assigned), so an own
 * key named `__proto__` neither changes the copy's prototype nor disappears.
 */
export function assertJson(value: unknown, path: string, depth = 0): Json {
  if (depth > 64) throw new Rejection("invalid_json", `${path} nested`);
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0))
      throw new Rejection("invalid_json", `${path} is not a safe integer`);
    return value;
  }
  if (Array.isArray(value))
    return value.map((v, i) =>
      assertJson(v, `${path}[${String(i)}]`, depth + 1),
    );
  if (isJsonObject(value)) {
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(value))
      Object.defineProperty(out, k, {
        value: assertJson(v, `${path}.${k}`, depth + 1),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    return out;
  }
  throw new Rejection("invalid_json", `${path} is not a JSON value`);
}

/** UTC microsecond text of a timestamptz column, independent of the session time zone. */
export const utcText = (column: string): string =>
  `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
