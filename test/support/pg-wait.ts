// Test support: database-side evidence of lock waits. The observer is an independent session; a "wait" is only accepted
// when PostgreSQL itself reports an ungranted lock held up by a named blocking backend (pg_locks, pg_stat_activity,
// pg_blocking_pids), never inferred from elapsed time.
import { setTimeout as sleep } from "node:timers/promises";

import type pg from "pg";

export interface Waiter {
  pid: number;
  application_name: string;
  wait_event_type: string | null;
  wait_event: string | null;
  state: string | null;
  query: string;
  blockers: number[];
  locktype: string;
  mode: string;
  relation: string | null;
  classid: number | null;
  objid: number | null;
}

export async function backendPid(
  session: pg.PoolClient | pg.Pool,
): Promise<number> {
  const result = await session.query<{ pid: number }>(
    "SELECT pg_backend_pid() AS pid",
  );
  const [row] = result.rows;
  if (!row) throw new Error("no backend pid");
  return row.pid;
}

export async function waiters(
  observer: pg.Pool,
  database: string,
): Promise<Waiter[]> {
  const result = await observer.query<Waiter>(
    `SELECT a.pid, a.application_name, a.wait_event_type, a.wait_event, a.state, a.query,
            pg_blocking_pids(a.pid) AS blockers, l.locktype, l.mode,
            l.relation::regclass::text AS relation, l.classid::int AS classid, l.objid::int AS objid
       FROM pg_stat_activity a
       JOIN pg_locks l ON l.pid = a.pid AND NOT l.granted
      WHERE a.datname = $1 AND a.pid <> pg_backend_pid()`,
    [database],
  );
  return result.rows;
}

/** Polls (bounded) until the database reports waiters satisfying `ready`; throws with the observed state on timeout. */
export async function waitForBlocked(
  observer: pg.Pool,
  database: string,
  ready: (found: Waiter[]) => boolean,
  timeoutMs = 20000,
): Promise<Waiter[]> {
  const deadline = Date.now() + timeoutMs;
  let last: Waiter[] = [];
  while (Date.now() < deadline) {
    last = await waiters(observer, database);
    if (ready(last)) return last;
    await sleep(50);
  }
  throw new Error(
    `no matching lock wait within ${String(timeoutMs)} ms; saw ${JSON.stringify(last)}`,
  );
}

/** Rejects if `promise` does not settle in time (the pending promise is left to the caller's cleanup). */
export async function within<T>(
  promise: Promise<T>,
  timeoutMs: number,
  what: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(`${what} did not settle within ${String(timeoutMs)} ms`),
      );
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
