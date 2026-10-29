// Native source proposal: never a mock admission or an expected receipt installer.
// The connected host exports below are completed with the reviewed atomic owner path.
// This file is held with that implementation; it has not been imported or executed.
import pg from "pg";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import {
  closeSync,
  constants,
  fsyncSync,
  openSync,
  writeFileSync,
  readFileSync,
  renameSync,
  mkdirSync,
  rmdirSync,
  unlinkSync,
  symlinkSync,
  existsSync,
  readdirSync,
} from "node:fs";
import * as claimsOwner from "../../src/runtime/claims-writing-gate.js";
import { readFile } from "node:fs/promises";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { migrate } from "../../src/db/migrations.js";
import {
  canonicalJson,
  canonicalTimestamp,
  sha256,
} from "../../src/identity/canonical-json.js";
import {
  persistEvidencePackage,
  persistConnectedFixture105Package,
  type AuthoredPackage,
} from "../../src/runtime/package.js";
import * as packageOwner from "../../src/runtime/package.js";
import { admissionOf } from "../../src/runtime/performance-direction.js";
import { connectedFixture151ArtifactHash as connectedFixture105ArtifactHash } from "../../src/identity/artifacts.js";
import {
  CommandConnectionError,
  faultPoint,
  type Json,
} from "../../src/runtime/command.js";
import {
  connectedFixture105Data,
  validateConnectedFixture105ExecutionRoot,
  connectedFixture105SuiteEvidence,
  connectedFixture105CleanupDiagnostics,
  takeConnectedFixture105PackageBorrow,
  ConnectedFixture105ClaimsFailure,
  ConnectedFixture105Refusal,
  runConnectedFixture105 as runObservedConnectedFixture105,
  reconcileConnectedFixture105,
} from "../../src/runtime/connected-fixture105.js";
import type { DbEnv } from "../support/db-env.js";
import { createMigrationPool, createRuntimePool } from "../../src/db/pool.js";

const bootstrapUrl = process.env.TEST_DATABASE_URL;
const suite = bootstrapUrl === undefined ? describe.skip : describe;
const LIMIT = 120000;
const HOOK = Symbol.for("the-desk.a5.test-fault-hook");
const environmentKeys = [
  "DESK_ENV",
  "DATABASE_URL",
  "PROVIDERS_ENABLED",
  "DEPLOYED_COMMIT",
  "DESK_TEST_FAULTS",
] as const;
const saved = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]]),
);
type Obj = Record<string, unknown>;
const cleanupFailures = new WeakMap<object, readonly unknown[]>();
function retainTestCleanup(primary: unknown, cleanup: unknown): unknown {
  if (typeof primary === "object" && primary !== null) {
    cleanupFailures.set(primary, [
      ...(cleanupFailures.get(primary) ?? []),
      cleanup,
    ]);
    return primary;
  }
  return new AggregateError(
    [primary, cleanup],
    "test primary and cleanup failed",
  );
}
async function withTestCleanup<T>(
  work: () => Promise<T>,
  cleanup: () => Promise<void>,
): Promise<T> {
  let outcome: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    outcome = { ok: true, value: await work() };
  } catch (error) {
    outcome = { ok: false, error };
  }
  try {
    await cleanup();
  } catch (error) {
    if (!outcome.ok) throw retainTestCleanup(outcome.error, error);
    throw error;
  }
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}
// Capture the installed driver's own descriptor before a prototype fault wrapper.
// These witnesses use the text/values promise overload only; receiver stays explicit.
function requireClaimsFailure(
  value: unknown,
): ConnectedFixture105ClaimsFailure {
  if (!(value instanceof ConnectedFixture105ClaimsFailure))
    throw new Error("actual failure not reached");
  return value;
}
function driverQuery(
  descriptor: PropertyDescriptor,
): (
  this: pg.Client,
  text: string,
  values?: unknown[],
) => Promise<pg.QueryResult<Obj>> {
  const value: unknown = descriptor.value;
  if (typeof value !== "function") throw new Error("driver method unavailable");
  return value as (
    this: pg.Client,
    text: string,
    values?: unknown[],
  ) => Promise<pg.QueryResult<Obj>>;
}

// Bounded same-query diagnostic facts only. Observer work can perturb timing.
// No names, SQL, raw backend types or errors are emitted; hidden types stay unknown.
const TARGET_PREFIX = "SELECT current_database() AS database,";
const TARGET_OBSERVER_CAP = 64;
type TargetVector =
  | { ordinal: number; outcome: "rejected" }
  | {
      ordinal: number;
      outcome: "rows";
      oneRow: boolean;
      databaseMatches: boolean;
      runtimeRole: boolean;
      notElevated: boolean;
      noOtherSessions: boolean;
      oidString: boolean;
      loginString: boolean;
      databaseString: boolean;
      addressValid: boolean;
      portValid: boolean;
      otherSessions: number | null;
    };
const TARGET_SCOPES = [
  "held_client_control",
  "preseed_foreign_claim",
  "preseed_missing_config",
  "preseed_changed_show",
  "preseed_extra_show",
  "unknown_construction",
  "unknown_program_run",
  "unknown_program_attempt",
  "unknown_package_binding",
  "acquisition_cut",
] as const;
type TargetScope = (typeof TARGET_SCOPES)[number];
type TargetCategory = "client" | "autovacuum" | "other_backend" | "unknown";
type TargetSample = { pid: number; category: TargetCategory }[];
type TargetReason =
  | "none"
  | "query_rejected"
  | "invalid_metadata"
  | "unknown_type"
  | "sample_truncated"
  | "record_limit"
  | "observation_fault";
interface TargetSupplement {
  status: "complete" | "inconclusive";
  reason: TargetReason;
  sample: TargetSample | null;
  truncated: boolean | null;
}
interface TargetEnvelope {
  schema: "fixture-target-diagnostic/2";
  scope: TargetScope;
  vector: TargetVector;
  supplement: TargetSupplement;
}
function targetUnknown(
  reason: Exclude<TargetReason, "none">,
): TargetSupplement {
  return { status: "inconclusive", reason, sample: null, truncated: null };
}
function targetData(value: unknown, keys: readonly string[]): Obj | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return;
  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return;
  if (Reflect.ownKeys(value).length !== keys.length) return;
  const data: Obj = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable)
      return;
    data[key] = descriptor.value;
  }
  return data;
}
function targetInt(value: unknown, minimum = 0): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= 2147483647
  );
}
function targetSupplement(value: unknown): TargetSupplement {
  const row = targetData(value, [
    "database",
    "database_oid",
    "login",
    "server_address",
    "server_port",
    "runtime_role",
    "elevated",
    "other_sessions",
    "other_backend_sample",
    "other_backend_sample_truncated",
    "diagnostic_server_start_utc",
  ]);
  if (
    !row ||
    !targetInt(row.other_sessions) ||
    !maintenanceStamp(row.diagnostic_server_start_utc)
  )
    return targetUnknown("invalid_metadata");
  const sample: unknown = row.other_backend_sample;
  const truncated = row.other_backend_sample_truncated;
  if (
    !Array.isArray(sample) ||
    Object.getPrototypeOf(sample) !== Array.prototype
  )
    return targetUnknown("invalid_metadata");
  const length = Object.getOwnPropertyDescriptor(sample, "length")
    ?.value as unknown;
  if (
    length !== Math.min(row.other_sessions, 8) ||
    Reflect.ownKeys(sample).length !== length + 1 ||
    typeof truncated !== "boolean" ||
    truncated !== row.other_sessions > 8
  )
    return targetUnknown("invalid_metadata");
  const owned: TargetSample = [];
  let previous = 0;
  for (let index = 0; index < length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(sample, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable)
      return targetUnknown("invalid_metadata");
    const entry = targetData(descriptor.value, [
      "pid",
      "category",
      "backend_start_utc",
    ]);
    if (
      !entry ||
      !targetInt(entry.pid, 1) ||
      entry.pid <= previous ||
      (entry.backend_start_utc !== null &&
        !maintenanceStamp(entry.backend_start_utc)) ||
      (entry.category !== "client" &&
        entry.category !== "autovacuum" &&
        entry.category !== "other_backend" &&
        entry.category !== "unknown")
    )
      return targetUnknown("invalid_metadata");
    previous = entry.pid;
    owned.push({ pid: entry.pid, category: entry.category });
  }
  const reason = truncated
    ? "sample_truncated"
    : owned.some((entry) => entry.category === "unknown")
      ? "unknown_type"
      : "none";
  return {
    status: reason === "none" ? "complete" : "inconclusive",
    reason,
    sample: owned,
    truncated,
  };
}

// Fixed test-only maintenance read. No runtime authority or connection owner.
interface MaintenanceOwner {
  admin: pg.Pool;
  database: string;
  latch: { used: boolean };
}
interface MaintenanceCapture {
  database: string;
  oid: string;
  server: string;
  ordinal: number;
  origins: { pid: number; start: string | null }[];
}
interface MaintenanceEntry {
  pid: number;
  category: TargetCategory;
  binding: "lifetime_match" | "provisional" | "unknown";
  reason:
    | "none"
    | "hidden_origin"
    | "wrong_database"
    | "lifetime_changed"
    | "vanished"
    | "hidden_result"
    | "unknown_type";
}
interface MaintenanceRecord {
  schema: "fixture-target-maintenance/1";
  scope: TargetScope;
  ordinal: number;
  status: "observed" | "unknown";
  reason: "none" | "unbound" | "error" | "invalid" | "server_changed";
  cleanup: "driver_handoff" | "unknown";
  entries: MaintenanceEntry[];
}
function maintenanceStamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length !== 27 ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u.test(value)
  )
    return false;
  try {
    return canonicalTimestamp(value) === value;
  } catch {
    return false;
  }
}
function captureMaintenance(
  vector: TargetVector,
  value: unknown,
  database: string,
): MaintenanceCapture | undefined {
  if (
    vector.outcome !== "rows" ||
    vector.noOtherSessions ||
    !targetInt(vector.otherSessions, 1) ||
    !vector.oneRow ||
    !vector.databaseMatches ||
    !vector.runtimeRole ||
    !vector.notElevated ||
    !vector.oidString ||
    !vector.loginString ||
    !vector.databaseString ||
    !vector.addressValid ||
    !vector.portValid
  )
    return;
  const supplement = targetSupplement(value);
  if (!supplement.sample || supplement.sample.length === 0) return;
  const row = targetData(value, [
    "database",
    "database_oid",
    "login",
    "server_address",
    "server_port",
    "runtime_role",
    "elevated",
    "other_sessions",
    "other_backend_sample",
    "other_backend_sample_truncated",
    "diagnostic_server_start_utc",
  ]);
  if (
    row?.database !== database ||
    row.other_sessions !== vector.otherSessions ||
    typeof row.database_oid !== "string" ||
    !/^[1-9][0-9]{0,9}$/u.test(row.database_oid) ||
    BigInt(row.database_oid) > 4294967295n ||
    !maintenanceStamp(row.diagnostic_server_start_utc)
  )
    return;
  const origins: MaintenanceCapture["origins"] = [];
  for (let index = 0; index < supplement.sample.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(
      row.other_backend_sample,
      String(index),
    );
    const entry = targetData(descriptor?.value as unknown, [
      "pid",
      "category",
      "backend_start_utc",
    ]);
    if (
      !entry ||
      !targetInt(entry.pid, 1) ||
      entry.pid !== supplement.sample[index]?.pid ||
      (entry.backend_start_utc !== null &&
        !maintenanceStamp(entry.backend_start_utc))
    )
      return;
    origins.push({ pid: entry.pid, start: entry.backend_start_utc });
  }
  return {
    database,
    oid: row.database_oid,
    server: row.diagnostic_server_start_utc,
    ordinal: vector.ordinal,
    origins,
  };
}
const MAINTENANCE_SQL = `SELECT current_database() = $4::text AS maintenance_matches,
 to_char(pg_postmaster_start_time() AT TIME ZONE 'UTC',
 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') = $5::text AS server_matches,
 (SELECT coalesce(jsonb_agg(jsonb_build_object(
   'pid', s.pid, 'database_matches', s.database_matches,
   'backend_start_utc', s.backend_start_utc, 'category', s.category
 ) ORDER BY s.pid), '[]'::jsonb)
 FROM (
   SELECT pid,
     coalesce(datid = $3::oid AND datname = $2::text, false)
       AS database_matches,
     to_char(backend_start AT TIME ZONE 'UTC',
       'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS backend_start_utc,
     CASE
       WHEN backend_type = 'client backend' THEN 'client'
       WHEN backend_type = 'autovacuum worker' THEN 'autovacuum'
       WHEN backend_type IN (
         'autovacuum launcher','logical replication launcher',
         'logical replication worker','parallel worker','background writer',
         'checkpointer','archiver','standalone backend','startup',
         'walreceiver','walsender','walwriter','walsummarizer'
       ) THEN 'other_backend' ELSE 'unknown'
     END AS category
   FROM pg_stat_activity WHERE pid = ANY($1::integer[])
   ORDER BY pid LIMIT 9
 ) AS s) AS observations`;
async function observeMaintenance(
  owner: MaintenanceOwner,
  capture: MaintenanceCapture,
  scope: TargetScope,
): Promise<MaintenanceRecord> {
  const record: MaintenanceRecord = {
    schema: "fixture-target-maintenance/1",
    scope,
    ordinal: capture.ordinal,
    status: "unknown",
    reason: "invalid",
    cleanup: "unknown",
    entries: [],
  };
  try {
    // Pool owns checkout, existing timeouts, listener and release. Exactly one read.
    const result = await owner.admin.query<Obj>(MAINTENANCE_SQL, [
      capture.origins.map((entry) => entry.pid),
      capture.database,
      capture.oid,
      owner.database,
      capture.server,
    ]);
    record.cleanup = "driver_handoff";
    const row =
      result.rows.length === 1
        ? targetData(result.rows[0], [
            "maintenance_matches",
            "server_matches",
            "observations",
          ])
        : undefined;
    if (
      !row ||
      typeof row.maintenance_matches !== "boolean" ||
      typeof row.server_matches !== "boolean"
    )
      return record;
    const samples: unknown = row.observations;
    if (
      !Array.isArray(samples) ||
      Reflect.getPrototypeOf(samples) !== Array.prototype
    )
      return record;
    const length = Object.getOwnPropertyDescriptor(samples, "length")
      ?.value as unknown;
    if (
      !targetInt(length) ||
      length > 8 ||
      Reflect.ownKeys(samples).length !== length + 1
    )
      return record;
    const observed = new Map<
      number,
      {
        database: boolean;
        start: string | null;
        category: TargetCategory;
      }
    >();
    let previous = 0;
    for (let index = 0; index < length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(
        samples,
        String(index),
      );
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable)
        return record;
      const entry = targetData(descriptor.value, [
        "pid",
        "database_matches",
        "backend_start_utc",
        "category",
      ]);
      if (
        !entry ||
        !targetInt(entry.pid, 1) ||
        entry.pid <= previous ||
        !capture.origins.some((origin) => origin.pid === entry.pid) ||
        typeof entry.database_matches !== "boolean" ||
        (entry.backend_start_utc !== null &&
          !maintenanceStamp(entry.backend_start_utc)) ||
        (entry.category !== "client" &&
          entry.category !== "autovacuum" &&
          entry.category !== "other_backend" &&
          entry.category !== "unknown")
      )
        return record;
      previous = entry.pid;
      observed.set(entry.pid, {
        database: entry.database_matches,
        start: entry.backend_start_utc,
        category: entry.category,
      });
    }
    if (!row.maintenance_matches) {
      record.reason = "unbound";
      return record;
    }
    if (!row.server_matches) {
      record.reason = "server_changed";
      return record;
    }
    record.entries = capture.origins.map((origin): MaintenanceEntry => {
      const entry = observed.get(origin.pid);
      const unknown = (
        reason: MaintenanceEntry["reason"],
      ): MaintenanceEntry => ({
        pid: origin.pid,
        category: "unknown",
        binding: "unknown",
        reason,
      });
      if (!entry) return unknown("vanished");
      if (!entry.database) return unknown("wrong_database");
      if (entry.start === null) return unknown("hidden_result");
      if (origin.start !== null && origin.start !== entry.start)
        return unknown("lifetime_changed");
      if (entry.category === "unknown") return unknown("unknown_type");
      return {
        pid: origin.pid,
        category: entry.category,
        binding: origin.start === null ? "provisional" : "lifetime_match",
        reason: origin.start === null ? "hidden_origin" : "none",
      };
    });
    record.status = "observed";
    record.reason = "none";
    return record;
  } catch {
    // Keep an acknowledged driver handoff even if later metadata inspection faults.
    record.status = "unknown";
    record.reason = record.cleanup === "driver_handoff" ? "invalid" : "error";
    record.entries = [];
    return record;
  }
}

class TargetObserver {
  // Saturating count of target queries, passing ones included; capReached means a query beyond the cap was seen.
  private count = 0;
  private capReached = false;
  private observationFailed = false;
  private readonly vectors: TargetEnvelope[] = [];
  private restorationFailed = false;
  private maintenanceCapture: MaintenanceCapture | undefined;
  private maintenanceRecord: MaintenanceRecord | undefined;
  constructor(
    private readonly database: string,
    private readonly scope: TargetScope = "acquisition_cut",
    private readonly maintenance?: MaintenanceOwner,
  ) {
    if (!TARGET_SCOPES.includes(scope))
      throw new Error("fixture target scope invalid");
  }
  restoreWitness(descriptor: PropertyDescriptor): void {
    try {
      Object.defineProperty(pg.Client.prototype, "query", descriptor);
    } catch (error) {
      this.restorationFailed = true;
      throw error;
    }
  }
  assertHeldClient(pid: number): void {
    expect(this.scope).toBe("held_client_control");
    expect(this.count).toBe(1);
    expect(this.capReached).toBe(false);
    expect(this.observationFailed).toBe(false);
    expect(this.restorationFailed).toBe(false);
    expect(this.maintenance?.latch.used).toBe(true);
    expect(this.vectors).toHaveLength(1);
    const entry = this.vectors[0];
    if (entry?.vector.outcome !== "rows")
      throw new Error("held client target vector missing");
    expect(entry.vector).toEqual({
      ordinal: 1,
      outcome: "rows",
      oneRow: true,
      databaseMatches: true,
      runtimeRole: true,
      notElevated: true,
      noOtherSessions: false,
      oidString: true,
      loginString: true,
      databaseString: true,
      addressValid: true,
      portValid: true,
      otherSessions: expect.any(Number) as unknown,
    });
    expect(targetInt(entry.vector.otherSessions, 1)).toBe(true);
    expect(entry.supplement.status).toBe("inconclusive");
    expect(entry.supplement.reason).toBe("unknown_type");
    expect(entry.supplement.truncated).toBe(false);
    expect(entry.supplement.sample).toContainEqual({
      pid,
      category: "unknown",
    });
    expect(
      this.maintenanceCapture?.origins.some(
        (origin) => origin.pid === pid && origin.start === null,
      ),
    ).toBe(true);
    expect(this.maintenanceRecord).toEqual({
      schema: "fixture-target-maintenance/1",
      scope: "held_client_control",
      ordinal: 1,
      status: "observed",
      reason: "none",
      cleanup: "driver_handoff",
      entries: expect.any(Array) as unknown,
    });
    expect(this.maintenanceRecord?.entries).toContainEqual({
      pid,
      category: "client",
      binding: "provisional",
      reason: "hidden_origin",
    });
  }
  private retain(vector: TargetVector, row?: unknown): void {
    let supplement: TargetSupplement;
    try {
      supplement =
        vector.outcome === "rejected"
          ? targetUnknown("query_rejected")
          : targetSupplement(row);
    } catch {
      this.observationFailed = true;
      supplement = targetUnknown("observation_fault");
    }
    if (this.maintenance && !this.maintenance.latch.used) {
      try {
        const capture = captureMaintenance(vector, row, this.database);
        if (capture) {
          this.maintenance.latch.used = true; // Suite-wide reservation before any await.
          this.maintenanceCapture = capture;
        }
      } catch {
        this.observationFailed = true;
      }
    }
    this.vectors.push({
      schema: "fixture-target-diagnostic/2",
      scope: this.scope,
      vector,
      supplement,
    });
  }

  private enter(text: unknown): number {
    try {
      if (typeof text !== "string" || !text.startsWith(TARGET_PREFIX)) return 0;
      if (this.count >= TARGET_OBSERVER_CAP) {
        this.capReached = true;
        return 0;
      }
      this.count += 1;
      return this.count;
    } catch {
      this.observationFailed = true;
      return 0;
    }
  }
  private rejected(ordinal: number): void {
    try {
      if (ordinal !== 0 && this.vectors.length < TARGET_OBSERVER_CAP)
        this.retain({ ordinal, outcome: "rejected" });
    } catch {
      this.observationFailed = true;
    }
  }
  private observe(ordinal: number, result: pg.QueryResult<Obj>): void {
    if (ordinal === 0) return;
    try {
      const row = result.rows[0];
      // The ten conjuncts of the runtime target check, in the same form as its refusal condition.
      const checks = {
        oneRow: result.rows.length === 1,
        databaseMatches: row?.database === this.database,
        runtimeRole: row?.runtime_role === true,
        notElevated: row?.elevated === false,
        noOtherSessions: row?.other_sessions === 0,
        oidString: typeof row?.database_oid === "string",
        loginString: typeof row?.login === "string",
        databaseString: typeof row?.database === "string",
        addressValid:
          row?.server_address === null ||
          typeof row?.server_address === "string",
        portValid:
          row?.server_port === null || typeof row?.server_port === "number",
      };
      if (Object.values(checks).every((passed) => passed)) {
        try {
          if (targetSupplement(row).status === "inconclusive")
            this.observationFailed = true;
        } catch {
          this.observationFailed = true;
        }
        return;
      }
      if (this.vectors.length < TARGET_OBSERVER_CAP)
        this.retain(
          {
            ordinal,
            outcome: "rows",
            ...checks,
            otherSessions:
              typeof row?.other_sessions === "number" &&
              Number.isFinite(row.other_sessions)
                ? row.other_sessions
                : null,
          },
          row,
        );
    } catch {
      this.observationFailed = true;
    }
  }
  /**
   * Wraps the driver query. The original is awaited exactly once with the original receiver and arguments; its
   * fulfilled result is returned as the same object and its rejection is rethrown as the same value. Bookkeeping
   * failures only set a flag and can never replace or alter the query outcome.
   */
  wrap(
    original: ReturnType<typeof driverQuery>,
  ): (this: pg.Client, ...args: unknown[]) => Promise<pg.QueryResult<Obj>> {
    const enter = (text: unknown): number => this.enter(text);
    const rejected = (ordinal: number): void => {
      this.rejected(ordinal);
    };
    const observe = (ordinal: number, result: pg.QueryResult<Obj>): void => {
      this.observe(ordinal, result);
    };
    return async function (
      this: pg.Client,
      ...args: unknown[]
    ): Promise<pg.QueryResult<Obj>> {
      const ordinal = enter(args[0]);
      let result: pg.QueryResult<Obj>;
      try {
        result = (await Reflect.apply(
          original,
          this,
          args,
        )) as pg.QueryResult<Obj>;
      } catch (error) {
        rejected(ordinal);
        throw error;
      }
      observe(ordinal, result);
      return result;
    };
  }
  /**
   * Runs `work` with the wrapper installed. The exact original descriptor is restored first through the
   * cleanup-preserving pattern; only then is the bounded summary emitted. A primary failure of `work` is preserved.
   */
  async around(work: () => Promise<void>): Promise<void> {
    const descriptor = Object.getOwnPropertyDescriptor(
      pg.Client.prototype,
      "query",
    );
    if (descriptor === undefined) throw new Error("driver method unavailable");
    const original = driverQuery(descriptor);
    await withTestCleanup(
      async () => {
        Object.defineProperty(pg.Client.prototype, "query", {
          ...descriptor,
          value: this.wrap(original),
        });
        await work();
      },
      async () => {
        Object.defineProperty(pg.Client.prototype, "query", descriptor);
        if (!this.restorationFailed) {
          if (this.maintenance && this.maintenanceCapture) {
            this.maintenanceRecord = await observeMaintenance(
              this.maintenance,
              this.maintenanceCapture,
              this.scope,
            );
          }
          this.emit();
        }
      },
    );
  }
  /** Failure vectors then one summary. An output failure is raised as a cleanup failure, never as a diagnosis. */
  private emit(): void {
    try {
      for (const envelope of this.vectors) {
        let line = `FIXTURE_TARGET_DIAGNOSTIC ${JSON.stringify(envelope)}\n`;
        if (Buffer.byteLength(line) > 1024) {
          envelope.supplement = targetUnknown("record_limit");
          line = `FIXTURE_TARGET_DIAGNOSTIC ${JSON.stringify(envelope)}\n`;
        }
        if (Buffer.byteLength(line) > 1024)
          throw new Error("fixture target base vector bound");
        process.stderr.write(line);
      }
      const line = `FIXTURE_TARGET_DIAGNOSTIC_SUMMARY ${JSON.stringify({
        schema: "fixture-target-diagnostic-summary/2",
        scope: this.scope,
        observed: this.count,
        cap: TARGET_OBSERVER_CAP,
        capReached: this.capReached,
        failureVectors: this.vectors.length,
        observationFailed: this.observationFailed,
        inconclusive:
          this.count === 0 ||
          this.observationFailed ||
          this.vectors.some(
            (entry) =>
              entry.vector.outcome === "rejected" ||
              entry.supplement.status === "inconclusive",
          ) ||
          this.capReached,
      })}\n`;
      if (Buffer.byteLength(line) > 1024)
        throw new Error("fixture target summary bound");
      process.stderr.write(line);
      if (this.maintenanceRecord) {
        let extra = `FIXTURE_TARGET_MAINTENANCE ${JSON.stringify(this.maintenanceRecord)}\n`;
        if (Buffer.byteLength(extra) > 2048) {
          this.maintenanceRecord.status = "unknown";
          this.maintenanceRecord.reason = "invalid";
          this.maintenanceRecord.entries = [];
          extra = `FIXTURE_TARGET_MAINTENANCE ${JSON.stringify(this.maintenanceRecord)}\n`;
        }
        process.stderr.write(extra);
      }
    } catch {
      throw new Error("fixture target diagnostic output failed");
    }
  }

  /** All 20 groups are unrun in this source-only candidate; native validation is deferred.
   * Fake-driver output never reaches retained native evidence.
   */
  static async selftest(): Promise<void> {
    let groups = 0;
    const done = (group: number): void => {
      expect(group).toBe(groups + 1);
      groups = group;
    };
    const row = (categories: TargetCategory[] = []): Obj => ({
      database: "fixed",
      database_oid: "1",
      diagnostic_server_start_utc: "2026-10-28T00:00:00.000001Z",
      login: "fixed",
      server_address: null,
      server_port: null,
      runtime_role: true,
      elevated: false,
      other_sessions: categories.length,
      other_backend_sample: categories.slice(0, 8).map((category, index) => ({
        pid: index + 1,
        category,
        backend_start_utc: null,
      })),
      other_backend_sample_truncated: categories.length > 8,
    });
    const result = (data: Obj): pg.QueryResult<Obj> => ({
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
      rows: [data],
    });
    const receiver = Object.create(pg.Client.prototype) as pg.Client;
    const lines: string[] = [];
    let capturedBytes = 0;
    let expectedOutputDriver: PropertyDescriptor | undefined;
    const capture = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk) => {
        if (expectedOutputDriver)
          expect(
            Object.getOwnPropertyDescriptor(pg.Client.prototype, "query"),
          ).toEqual(expectedOutputDriver);
        if (typeof chunk !== "string")
          throw new Error("selftest nontext output");
        capturedBytes += Buffer.byteLength(chunk);
        if (capturedBytes > 600064) throw new Error("selftest output bound");
        lines.push(chunk);
        return true;
      });
    const descriptor = Object.getOwnPropertyDescriptor(
      pg.Client.prototype,
      "query",
    );
    if (!descriptor) {
      capture.mockRestore();
      throw new Error("selftest driver descriptor");
    }
    try {
      expect(targetSupplement(row())).toEqual({
        status: "complete",
        reason: "none",
        sample: [],
        truncated: false,
      });
      done(1);
      expect(targetSupplement(row(["client"])).sample).toEqual([
        { pid: 1, category: "client" },
      ]);
      done(2);
      expect(targetSupplement(row(["autovacuum"])).sample).toEqual([
        { pid: 1, category: "autovacuum" },
      ]);
      done(3);
      // Already-mapped categories only: these controls do not execute the SQL CASE.
      for (let index = 0; index < 13; index++) {
        expect(
          targetSupplement({
            ...row(["other_backend"]),
            other_backend_sample: [
              {
                pid: index + 1,
                category: "other_backend",
                backend_start_utc: null,
              },
            ],
          }).reason,
        ).toBe("none");
      }
      done(4);
      for (let index = 0; index < 2; index++)
        expect(targetSupplement(row(["unknown"])).reason).toBe("unknown_type");
      done(5);
      expect(
        targetSupplement(row(new Array<TargetCategory>(9).fill("client"))),
      ).toMatchObject({
        reason: "sample_truncated",
        truncated: true,
        sample: Array.from({ length: 8 }, (_, index) => ({
          pid: index + 1,
          category: "client",
        })),
      });
      done(6);
      const malformed: Obj[] = [];
      const absent = row();
      delete absent.other_backend_sample;
      malformed.push(absent);
      malformed.push({ ...row(), other_backend_sample: "[]" });
      malformed.push({
        ...row(new Array<TargetCategory>(9).fill("client")),
        other_backend_sample: Array.from({ length: 9 }, (_, index) => ({
          pid: index + 1,
          category: "client",
        })),
      });
      malformed.push(
        { ...row(), other_sessions: 1 },
        { ...row(), other_sessions: -1 },
        { ...row(), other_sessions: 0.5 },
        { ...row(), other_backend_sample_truncated: true },
      );
      malformed.push({
        ...row(["client"]),
        other_backend_sample: [
          { pid: 1, category: "client", backend_start_utc: null, extra: true },
        ],
      });
      const getter = row();
      Object.defineProperty(getter, "other_backend_sample", {
        enumerable: true,
        get() {
          throw new Error("getter invoked");
        },
      });
      malformed.push(getter);
      malformed.push({
        ...row(["client"]),
        other_backend_sample: new Array<unknown>(1),
      });
      expect(malformed.length).toBe(10);
      for (const value of malformed)
        expect(targetSupplement(value).reason).toBe("invalid_metadata");
      done(7);
      for (const pid of [0, -1, 0.5, 2147483648])
        expect(
          targetSupplement({
            ...row(["client"]),
            other_backend_sample: [
              { pid, category: "client", backend_start_utc: null },
            ],
          }).reason,
        ).toBe("invalid_metadata");
      for (const second of [2, 1])
        expect(
          targetSupplement({
            ...row(["client", "client"]),
            other_backend_sample: [
              { pid: 2, category: "client", backend_start_utc: null },
              { pid: second, category: "client", backend_start_utc: null },
            ],
          }).reason,
        ).toBe("invalid_metadata");
      expect(
        targetSupplement({
          ...row(["client"]),
          other_backend_sample: [
            { pid: 1, category: "arbitrary", backend_start_utc: null },
          ],
        }).reason,
      ).toBe("invalid_metadata");
      done(8);
      const actual = result(row(["client"]));
      const values: unknown[] = [];
      const fake = driverQuery({
        value: function (
          this: pg.Client,
          text: string,
          parameters?: unknown[],
        ): Promise<pg.QueryResult<Obj>> {
          expect(this).toBe(receiver);
          expect(text).toBe(TARGET_PREFIX);
          expect(parameters).toBe(values);
          return Promise.resolve(actual);
        },
      });
      const forward = new TargetObserver("fixed");
      expect(
        await forward.wrap(fake).call(receiver, TARGET_PREFIX, values),
      ).toBe(actual);
      const rejection = new Error("fixed driver rejection");
      await expect(
        forward
          .wrap(driverQuery({ value: () => Promise.reject(rejection) }))
          .call(receiver, TARGET_PREFIX),
      ).rejects.toBe(rejection);
      done(9);
      const base = { ...descriptor, value: () => Promise.resolve(actual) };
      Object.defineProperty(pg.Client.prototype, "query", base);
      expectedOutputDriver = base;
      const nested = new TargetObserver("fixed");
      const loss = new Error("fixed commit loss");
      const outputStart = lines.length;
      await expect(
        nested.around(async () => {
          const outer = Object.getOwnPropertyDescriptor(
            pg.Client.prototype,
            "query",
          );
          if (!outer) throw new Error("selftest outer descriptor");
          const original = driverQuery(outer);
          await withTestCleanup(
            async () => {
              Object.defineProperty(pg.Client.prototype, "query", {
                ...outer,
                value: async function (this: pg.Client, text: string) {
                  const resolved = await original.call(this, text);
                  if (text === "COMMIT") throw loss;
                  return resolved;
                },
              });
              const installed = Object.getOwnPropertyDescriptor(
                pg.Client.prototype,
                "query",
              );
              if (!installed) throw new Error("selftest witness descriptor");
              const wrapped = driverQuery(installed);
              expect(await wrapped.call(receiver, TARGET_PREFIX)).toBe(actual);
              await wrapped.call(receiver, "COMMIT");
            },
            () => {
              nested.restoreWitness(outer);
              return Promise.resolve();
            },
          );
        }),
      ).rejects.toBe(loss);
      expect(
        Object.getOwnPropertyDescriptor(pg.Client.prototype, "query"),
      ).toEqual(base);
      expect(lines.length - outputStart).toBe(2);
      done(10);
      const capped = new TargetObserver("fixed");
      const cappedQuery = capped.wrap(
        driverQuery({ value: () => Promise.resolve(actual) }),
      );
      for (let index = 0; index < 65; index++)
        await cappedQuery.call(receiver, TARGET_PREFIX);
      expect(capped.count).toBe(64);
      expect(capped.capReached).toBe(true);
      expect(capped.vectors.length).toBe(64);
      capped.emit();
      expect(lines.every((line) => Buffer.byteLength(line) <= 1024)).toBe(true);
      done(11);
      const bounded = new TargetObserver("fixed");
      bounded.observe(bounded.enter(TARGET_PREFIX), actual);
      const envelope = bounded.vectors[0];
      if (!envelope) throw new Error("selftest vector missing");
      envelope.supplement.sample = [
        { pid: 1, category: "x".repeat(2048) as TargetCategory },
      ];
      bounded.emit();
      expect(envelope.supplement.reason).toBe("record_limit");
      expect(envelope.vector).toMatchObject({
        ordinal: 1,
        noOtherSessions: false,
      });
      const faulted = new TargetObserver("fixed");
      faulted.observe(
        faulted.enter(TARGET_PREFIX),
        result(
          new Proxy(row(["client"]), {
            getPrototypeOf() {
              throw new Error("fixed reflection fault");
            },
          }),
        ),
      );
      expect(faulted.vectors[0]?.supplement.reason).toBe("observation_fault");
      expect(faulted.observationFailed).toBe(true);
      // Replace only the test-local captured sink; always reinstate it before leaving this group.
      capture.mockImplementationOnce(() => {
        throw new Error("fixed output fault");
      });
      const primary = new Error("fixed primary work failure");
      await expect(
        new TargetObserver("fixed").around(() => Promise.reject(primary)),
      ).rejects.toBe(primary);
      expect(cleanupFailures.get(primary)?.length).toBe(1);
      done(12);
      // Groups 13–20 are deferred: this native beforeAll has no fake-only launcher.
      const started = "2026-10-28T00:00:00.000002Z";
      const origin = row(["client"]);
      origin.other_backend_sample = [
        { pid: 1, category: "client", backend_start_utc: started },
      ];
      const initial = new TargetObserver("fixed");
      initial.observe(initial.enter(TARGET_PREFIX), result(origin));
      const vector = initial.vectors[0]?.vector;
      if (!vector) throw new Error("maintenance control vector missing");
      const bound = captureMaintenance(vector, origin, "fixed");
      if (!bound) throw new Error("maintenance control binding missing");
      const observedRow = (changes: Obj = {}): Obj => ({
        pid: 1,
        database_matches: true,
        backend_start_utc: started,
        category: "client",
        ...changes,
      });
      const metadata = (
        observations: unknown,
        changes: Obj = {},
      ): pg.QueryResult<Obj> =>
        result({
          maintenance_matches: true,
          server_matches: true,
          observations,
          ...changes,
        });
      let reply = (): Promise<pg.QueryResult<Obj>> =>
        Promise.resolve(metadata([observedRow()]));
      let reads = 0;
      // An inert object at the existing pool-query seam, never a constructed pool.
      const admin = Object.create(pg.Pool.prototype) as pg.Pool;
      Object.defineProperty(admin, "query", {
        value: (
          text: string,
          parameters: unknown[],
        ): Promise<pg.QueryResult<Obj>> => {
          expect(
            Object.getOwnPropertyDescriptor(pg.Client.prototype, "query"),
          ).toEqual(expectedOutputDriver);
          expect(text).toBe(MAINTENANCE_SQL);
          expect(parameters).toEqual([
            [1],
            "fixed",
            "1",
            "maintenance",
            bound.server,
          ]);
          reads++;
          return reply();
        },
      });
      const owner: MaintenanceOwner = {
        admin,
        database: "maintenance",
        latch: { used: false },
      };
      expect(
        await observeMaintenance(owner, bound, "acquisition_cut"),
      ).toMatchObject({
        status: "observed",
        cleanup: "driver_handoff",
        entries: [
          {
            pid: 1,
            category: "client",
            binding: "lifetime_match",
            reason: "none",
          },
        ],
      });
      expect(reads).toBe(1);
      done(13);
      reply = () =>
        Promise.resolve(metadata([observedRow({ database_matches: false })]));
      expect(
        (await observeMaintenance(owner, bound, "acquisition_cut")).entries[0]
          ?.reason,
      ).toBe("wrong_database");
      reply = () => Promise.resolve(metadata([observedRow({ pid: 2 })]));
      expect(
        (await observeMaintenance(owner, bound, "acquisition_cut")).reason,
      ).toBe("invalid");
      done(14);
      reply = () =>
        Promise.resolve(metadata([observedRow()], { server_matches: false }));
      expect(
        (await observeMaintenance(owner, bound, "acquisition_cut")).reason,
      ).toBe("server_changed");
      reply = () =>
        Promise.resolve(
          metadata([
            observedRow({ backend_start_utc: "2026-10-28T00:00:01.000002Z" }),
          ]),
        );
      expect(
        (await observeMaintenance(owner, bound, "acquisition_cut")).entries[0]
          ?.reason,
      ).toBe("lifetime_changed");
      done(15);
      reply = () => Promise.resolve(metadata([]));
      expect(
        (await observeMaintenance(owner, bound, "acquisition_cut")).entries[0]
          ?.reason,
      ).toBe("vanished");
      done(16);
      reply = () =>
        Promise.resolve(metadata([observedRow({ category: "autovacuum" })]));
      expect(
        (
          await observeMaintenance(
            owner,
            { ...bound, origins: [{ pid: 1, start: null }] },
            "acquisition_cut",
          )
        ).entries[0],
      ).toMatchObject({
        category: "autovacuum",
        binding: "provisional",
        reason: "hidden_origin",
      });
      reply = () =>
        Promise.resolve(metadata([observedRow({ backend_start_utc: null })]));
      expect(
        (await observeMaintenance(owner, bound, "acquisition_cut")).entries[0]
          ?.reason,
      ).toBe("hidden_result");
      reply = () =>
        Promise.resolve(metadata([observedRow({ category: "unknown" })]));
      expect(
        (await observeMaintenance(owner, bound, "acquisition_cut")).entries[0]
          ?.reason,
      ).toBe("unknown_type");
      done(17);
      for (const label of ["fixed pool rejection", "fixed pool timeout"]) {
        const before = reads;
        reply = () => Promise.reject(new Error(label));
        expect(
          await observeMaintenance(owner, bound, "acquisition_cut"),
        ).toMatchObject({
          status: "unknown",
          reason: "error",
          cleanup: "unknown",
          entries: [],
        });
        expect(reads).toBe(before + 1); // No retry or manual disposal inference.
      }
      done(18);
      for (const invalid of [
        metadata("not an array"),
        metadata(new Array<unknown>(9)),
        metadata([observedRow({ backend_start_utc: "invalid" })]),
        metadata([observedRow({ extra: true })]),
        metadata([observedRow({ category: "x".repeat(4096) })]),
      ]) {
        reply = () => Promise.resolve(invalid);
        expect(
          await observeMaintenance(owner, bound, "acquisition_cut"),
        ).toMatchObject({
          status: "unknown",
          reason: "invalid",
          cleanup: "driver_handoff",
          entries: [],
        });
      }
      done(19);
      let delivered = result(row());
      const diagnosticDriver = {
        ...descriptor,
        value: () => Promise.resolve(delivered),
      };
      Object.defineProperty(pg.Client.prototype, "query", diagnosticDriver);
      expectedOutputDriver = diagnosticDriver;
      const callObserved = async (): Promise<void> => {
        const installed = Object.getOwnPropertyDescriptor(
          pg.Client.prototype,
          "query",
        );
        if (!installed) throw new Error("maintenance control driver missing");
        expect(await driverQuery(installed).call(receiver, TARGET_PREFIX)).toBe(
          delivered,
        );
      };
      const beforeRead = reads;
      await new TargetObserver("fixed", "acquisition_cut", owner).around(
        callObserved,
      );
      expect(reads).toBe(beforeRead);
      expect(owner.latch.used).toBe(false);
      delivered = result(origin);
      reply = () => Promise.resolve(metadata([observedRow()]));
      const primaryFailure = new Error("fixed original failure");
      await expect(
        new TargetObserver("fixed", "acquisition_cut", owner).around(
          async () => {
            await callObserved();
            throw primaryFailure;
          },
        ),
      ).rejects.toBe(primaryFailure);
      expect(reads).toBe(beforeRead + 1);
      expect(owner.latch.used).toBe(true);
      await new TargetObserver("fixed", "acquisition_cut", owner).around(
        callObserved,
      );
      expect(reads).toBe(beforeRead + 1);
      // A pool rejection also preserves the identical original work error.
      const rejectedOwner = { ...owner, latch: { used: false } };
      reply = () => Promise.reject(new Error("fixed supplemental rejection"));
      await expect(
        new TargetObserver("fixed", "acquisition_cut", rejectedOwner).around(
          async () => {
            await callObserved();
            throw primaryFailure;
          },
        ),
      ).rejects.toBe(primaryFailure);
      expect(reads).toBe(beforeRead + 2);
      expect(
        lines
          .filter((line) => line.startsWith("FIXTURE_TARGET_MAINTENANCE "))
          .every((line) => Buffer.byteLength(line) <= 2048),
      ).toBe(true);
      done(20);
    } catch {
      throw new Error(
        `fixture target diagnostic selftest group ${String(groups + 1)}`,
      );
    } finally {
      try {
        Object.defineProperty(pg.Client.prototype, "query", descriptor);
      } finally {
        capture.mockRestore();
      }
    }
    expect(groups).toBe(20);
    process.stderr.write(
      'FIXTURE_TARGET_DIAGNOSTIC_SELFTEST {"schema":"fixture-target-selftest/2","groups":20,"passed":20}\n',
    );
  }
}

// pg-pool attaches release when a Client is checked out; prototype hooks also see plain Clients.
function isCheckedOutClient(
  client: pg.Client,
): client is pg.Client & Pick<pg.PoolClient, "release"> {
  return "release" in client && typeof client.release === "function";
}

type ExpectedInvocation =
  | "completed"
  | "expected_refusal"
  | "expected_construction_unknown"
  | "expected_later_phase_unknown"
  | "pre_target_failure";
const CASE_EXPECTATIONS: readonly {
  case_id: string;
  expected: readonly ExpectedInvocation[];
}[] = [
  {
    case_id:
      "records actual18+7 results, one direction and a labelled audit with retained semantic gaps",
    expected: ["completed"],
  },
  {
    case_id:
      "keeps actual fixture output outside genuine admission and rejects render audit promotion",
    expected: ["completed"],
  },
  {
    case_id: "converges by exact readback without producing a second direction",
    expected: ["completed"],
  },
  {
    case_id:
      "refuses a preseeded source population without constructing an observation",
    expected: [
      "expected_refusal",
      "expected_refusal",
      "expected_refusal",
      "expected_refusal",
    ],
  },
  {
    case_id: "rolls back the package when the later observation insert fails",
    expected: ["expected_refusal"],
  },
  {
    case_id: "refuses context change between settled acquisition and consumer",
    expected: ["expected_refusal"],
  },
  {
    case_id:
      "rolls back every Performance row after a late gate insert failure",
    expected: ["expected_refusal"],
  },
  {
    case_id:
      "retains durable direction if the separate audit transaction fails",
    expected: ["expected_refusal"],
  },
  {
    case_id: "refuses an extra governed intent during re-entry",
    expected: ["completed"],
  },
  {
    case_id:
      "preserves package preflight refusal without a connection checkout",
    expected: [],
  },
  {
    case_id:
      "preserves the old package creation and governed-hash reuse outcomes",
    expected: [],
  },
  {
    case_id:
      "preserves orphan completion as distinguishable from genuinely fresh creation",
    expected: [],
  },
  {
    case_id:
      "refuses unregistered structural objects including a caller transaction at the package borrower",
    expected: [],
  },
  {
    case_id:
      "associates a genuine package capability only with its owner transaction",
    expected: ["expected_refusal"],
  },
  {
    case_id:
      "refuses an appended event between settled acquisition and consumption",
    expected: ["expected_refusal"],
  },
  {
    case_id: "refuses production context before a database checkout",
    expected: ["pre_target_failure"],
  },
  {
    case_id:
      "rejects a second live borrow, a clone, and a stale genuine capability",
    expected: ["expected_refusal"],
  },
  {
    case_id:
      "rejects live capability consumption after originating context changes",
    expected: ["expected_refusal", "expected_refusal", "expected_refusal"],
  },
  {
    case_id:
      "holds a lost direction COMMIT acknowledgement and reconciles without replay",
    expected: ["expected_later_phase_unknown"],
  },
  {
    case_id:
      "rolls back package creation when a foreign observation identity wins late",
    expected: ["expected_refusal"],
  },
  {
    case_id:
      "refuses a stale extra gate fingerprint without changing durable rows",
    expected: ["completed"],
  },
  {
    case_id:
      "holds unknown construction commit without inventing its missing settlement receipt",
    expected: [
      "expected_construction_unknown",
      "expected_construction_unknown",
      "expected_construction_unknown",
      "expected_later_phase_unknown",
    ],
  },
  {
    case_id:
      "retains event-first reader identity across distinct query and rollback errors",
    expected: ["pre_target_failure"],
  },
  {
    case_id:
      "retains query-first reader identity across distinct later client and rollback errors",
    expected: ["pre_target_failure"],
  },
  {
    case_id:
      "retains reader listener when release throws before driver handoff without retry",
    expected: ["pre_target_failure"],
  },
  {
    case_id:
      "closes continuation when the acquisition-cut await throws before consumption",
    expected: ["expected_refusal", "pre_target_failure"],
  },
  {
    case_id:
      "tracks and cleans a database allocation that fails before create returns",
    expected: [],
  },
  {
    case_id: "tracks a setup pool before roles SQL or migration can fail",
    expected: [],
  },
  {
    case_id: "tracks bootstrap role allocation before bootstrap returns",
    expected: [],
  },
  {
    case_id:
      "retains full actual failed Claims coverage and findings in a private failure receipt",
    expected: ["expected_refusal"],
  },
  {
    case_id: "memoizes a first setup pool-end failure without another end call",
    expected: [],
  },
  {
    case_id:
      "preserves the old package four-round reconciliation bound under named-conflict delivery",
    expected: [],
  },
  {
    case_id:
      "preserves an unrelated package failure object and releases its transaction",
    expected: [],
  },
  {
    case_id:
      "identifies a held client while preserving target isolation refusal",
    expected: ["pre_target_failure"],
  },
];
interface HarnessCase {
  case_id: string;
  expected: readonly ExpectedInvocation[];
  completed: boolean;
  calls: HarnessCall[];
}
interface HarnessCall {
  ordinal: number;
  expected: ExpectedInvocation;
  completed: boolean;
  returned: boolean;
  target_hash: string | null;
  pre_target_index: number | null;
}
const harnessCases: HarnessCase[] = [];
let activeCase: HarnessCase | undefined;
let harnessCleanupFailed = false;
function caseBody(
  name: string,
  body: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    const declared = CASE_EXPECTATIONS.find((row) => row.case_id === name);
    if (
      declared === undefined ||
      activeCase !== undefined ||
      harnessCases.some((row) => row.case_id === name)
    )
      throw new Error("fixture harness case identity");
    const row: HarnessCase = {
      case_id: name,
      expected: declared.expected,
      completed: false,
      calls: [],
    };
    harnessCases.push(row);
    activeCase = row;
    try {
      await body();
      expect(row.calls.length).toBe(row.expected.length);
      expect(row.calls.every((call) => call.completed)).toBe(true);
      row.completed = true;
    } finally {
      activeCase = undefined;
    }
  };
}
function observedLists(): { targets: Obj[]; pre_target_failures: unknown[] } {
  const data = connectedFixture105SuiteEvidence();
  if (!Array.isArray(data.targets) || !Array.isArray(data.pre_target_failures))
    throw new Error("fixture observed shape");
  return {
    targets: data.targets as Obj[],
    pre_target_failures: data.pre_target_failures,
  };
}
async function runConnectedFixture105(): ReturnType<
  typeof runObservedConnectedFixture105
> {
  const owner = activeCase;
  if (owner === undefined)
    throw new Error("fixture invocation outside registered case");
  const expected = owner.expected[owner.calls.length];
  if (expected === undefined) throw new Error("fixture unexpected invocation");
  const before = observedLists();
  const call: HarnessCall = {
    ordinal: owner.calls.length,
    expected,
    completed: false,
    returned: false,
    target_hash: null,
    pre_target_index: null,
  };
  owner.calls.push(call); // Before host opening or any allocation; expectation is never inferred from the error.
  return withTestCleanup(
    async () => {
      const value = await runObservedConnectedFixture105();
      call.returned = true;
      return value;
    },
    () => {
      const after = observedLists();
      const targets = after.targets.slice(before.targets.length);
      const failures =
        after.pre_target_failures.length - before.pre_target_failures.length;
      expect(targets.length + failures).toBe(1);
      if (targets.length === 1) {
        const target = targets[0];
        if (target === undefined || typeof target.target_hash !== "string")
          throw new Error("fixture target identity");
        call.target_hash = target.target_hash;
        const observed =
          target.later_outcome === "completed"
            ? "completed"
            : target.later_outcome === "refused"
              ? "expected_refusal"
              : target.construction_state === "construction_unknown"
                ? "expected_construction_unknown"
                : "expected_later_phase_unknown";
        expect(observed).toBe(expected);
        const root = validateConnectedFixture105ExecutionRoot();
        const intentPath = join(
          root,
          "expectations",
          target.target_hash + ".intent.json",
        );
        const terminalPath = join(
          root,
          "expectations",
          target.target_hash + ".terminal.json",
        );
        expect(existsSync(intentPath)).toBe(true);
        if (expected === "expected_construction_unknown") {
          expect(existsSync(terminalPath)).toBe(false);
          expect(existsSync(join(root, "receipts", target.target_hash))).toBe(
            false,
          );
        } else {
          const terminal = JSON.parse(
            readFileSync(terminalPath, "utf8"),
          ) as Obj;
          expect(terminal.state).toBe(target.construction_state);
          expect(terminal.intent_sha256).toBe(sha256(readFileSync(intentPath)));
          if (expected === "expected_later_phase_unknown")
            expect(terminal.state).toBe("construction_recorded");
        }
      } else {
        call.pre_target_index = before.pre_target_failures.length;
        expect(expected).toBe("pre_target_failure");
      }
      expect(call.returned).toBe(expected === "completed");
      call.completed = true;
      return Promise.resolve();
    },
  );
}

interface FixtureAllocation {
  name: string;
  pools: pg.Pool[];
  allocated: boolean;
  settle?: Promise<void>;
  close?: Promise<void>;
}

// Suite-local allocation ledger: register intent BEFORE every allocation/await.
// Shared TestCluster and production pool owners remain unchanged.
class TrackedFixtureCluster {
  readonly admin: pg.Pool;
  readonly names: string[] = [];
  readonly logins: string[] = [];
  private readonly roleAllocations: { name: string; allocated: boolean }[] = [];
  private readonly token = randomBytes(4).toString("hex");
  private readonly password = randomBytes(24).toString("hex");
  private readonly allocations: FixtureAllocation[] = [];
  private readonly ending = new Map<pg.Pool, Promise<void>>();
  private shutdownResult: Promise<void> | undefined;
  constructor(private readonly url: string) {
    this.admin = new pg.Pool({
      connectionString: url,
      max: 2,
      connectionTimeoutMillis: 10000,
      query_timeout: 20000,
    });
  }
  private end(pool: pg.Pool): Promise<void> {
    const prior = this.ending.get(pool);
    if (prior !== undefined) return prior;
    // Store the promise before calling end; synchronous and async failures persist.
    const result = Promise.resolve().then(() => pool.end());
    this.ending.set(pool, result);
    return result;
  }
  private async retainFailures(
    actions: readonly Promise<unknown>[],
  ): Promise<void> {
    const results = await Promise.allSettled(actions);
    const errors = results.flatMap((result) =>
      result.status === "rejected" ? [result.reason as unknown] : [],
    );
    if (errors.length !== 0)
      throw new AggregateError(errors, "fixture allocation cleanup failed");
  }
  private urlFor(name: string, login?: string): string {
    const url = new URL(this.url);
    url.pathname = `/${name}`;
    if (login !== undefined) {
      url.username = login;
      url.password = this.password;
    }
    return url.toString();
  }
  async bootstrap(): Promise<void> {
    const boot = await this.create({ migrate: false });
    for (const role of ["migrator", "runtime"] as const) {
      const login = `fl_${this.token}_${role}`;
      this.logins.push(login);
      const owned = { name: login, allocated: false };
      this.roleAllocations.push(owned);
      if (
        (
          await this.admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [
            login,
          ])
        ).rows.length !== 0
      )
        throw new Error("owned role collision");
      owned.allocated = true;
      await this.admin.query(
        `CREATE ROLE ${login} LOGIN NOINHERIT PASSWORD '${this.password}'`,
      );
      await faultPoint("fixture105_test_after_role_create");
      await this.admin.query(`GRANT desk_${role} TO ${login}`);
    }
    await boot.close();
  }
  async create(_options: { migrate: boolean }): Promise<DbEnv> {
    if (_options.migrate) throw new Error("fixed fixture setup only");
    const name = `fl_${this.token}_${String(this.allocations.length + 1)}`;
    const row: FixtureAllocation = { name, pools: [], allocated: false };
    this.allocations.push(row);
    this.names.push(name);
    if (
      (
        await this.admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [
          name,
        ])
      ).rows.length !== 0
    )
      throw new Error("owned database collision");
    row.allocated = true; // A possibly committed CREATE is reconciled by this exact owned name.
    await this.admin.query(`CREATE DATABASE "${name}" TEMPLATE template0`);
    await faultPoint("fixture105_test_after_database_create");
    const owner = new pg.Pool({
      connectionString: this.urlFor(name),
      max: 2,
      connectionTimeoutMillis: 10000,
      query_timeout: 20000,
    });
    row.pools.push(owner);
    await faultPoint("fixture105_test_after_setup_pool");
    await owner.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await owner.query(await readFile("migrations/roles.sql", "utf8"));
    const migratorUrl = this.urlFor(
      name,
      this.logins.find((login) => login.endsWith("_migrator")),
    );
    const runtimeUrl = this.urlFor(
      name,
      this.logins.find((login) => login.endsWith("_runtime")),
    );
    const migrator = createMigrationPool({
      MIGRATION_DATABASE_URL: migratorUrl,
    });
    row.pools.push(migrator);
    const runtime = createRuntimePool({ DATABASE_URL: runtimeUrl });
    row.pools.push(runtime);
    return {
      name,
      migratorUrl,
      runtimeUrl,
      owner,
      migrator,
      runtime,
      close: () => this.closeAllocation(row),
    };
  }
  async settle(name: string): Promise<void> {
    const row = this.allocations.find((entry) => entry.name === name);
    if (row === undefined) throw new Error("unowned allocation");
    row.settle ??= this.retainFailures(row.pools.map((pool) => this.end(pool)));
    return row.settle;
  }
  private closeAllocation(row: FixtureAllocation): Promise<void> {
    row.close ??= (async () => {
      const errors: unknown[] = [];
      try {
        await this.settle(row.name);
      } catch (error) {
        errors.push(error);
      }
      if (row.allocated) {
        try {
          const found = await this.admin.query<{ owned: boolean }>(
            "SELECT pg_get_userbyid(datdba)=current_user AS owned FROM pg_database WHERE datname=$1",
            [row.name],
          );
          if (found.rows.length !== 0) {
            if (found.rows.length !== 1 || found.rows[0]?.owned !== true)
              throw new Error("database ownership changed");
            await this.admin.query(`DROP DATABASE "${row.name}"`);
          }
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length !== 0)
        throw new AggregateError(errors, "fixture allocation close failed");
    })();
    return row.close;
  }
  async closePending(): Promise<void> {
    await this.retainFailures(
      this.allocations.map((row) => this.closeAllocation(row)),
    );
  }
  shutdown(): Promise<void> {
    this.shutdownResult ??= (async () => {
      const errors: unknown[] = [];
      try {
        await this.closePending();
      } catch (error) {
        errors.push(error);
      }
      for (const role of this.roleAllocations.filter((row) => row.allocated)) {
        try {
          await this.admin.query(`DROP ROLE IF EXISTS ${role.name}`);
        } catch (error) {
          errors.push(error);
        }
      }
      try {
        await this.end(this.admin);
      } catch (error) {
        errors.push(error);
      }
      if (errors.length !== 0)
        throw new AggregateError(errors, "fixture cluster shutdown failed");
    })();
    return this.shutdownResult;
  }
}

suite("connected fixture105 native ownership", () => {
  let cluster: TrackedFixtureCluster | undefined;
  let executionRoot: string | undefined;
  function requireCluster(): TrackedFixtureCluster {
    if (cluster === undefined) throw new Error("fixture cluster unavailable");
    return cluster;
  }
  const maintenanceLatch = { used: false };
  function maintenanceOwner(): MaintenanceOwner {
    if (bootstrapUrl === undefined)
      throw new Error("maintenance binding missing");
    return {
      admin: requireCluster().admin,
      database: decodeURIComponent(new URL(bootstrapUrl).pathname.slice(1)),
      latch: maintenanceLatch,
    };
  }
  let current: DbEnv | undefined;
  const isolatedClusters: TrackedFixtureCluster[] = [];

  beforeAll(async () => {
    if (process.env.DESK_P33_PROFILE === "target-diagnostic")
      await TargetObserver.selftest();
    if (bootstrapUrl === undefined)
      throw new Error("TEST_DATABASE_URL required");
    const savedBinding = process.env.DESK_FIXTURE105_BINDING;
    try {
      delete process.env.DESK_FIXTURE105_BINDING;
      expect(() => validateConnectedFixture105ExecutionRoot()).toThrow(
        "fixture_runner_binding_missing",
      );
      process.env.DESK_FIXTURE105_BINDING = JSON.stringify({
        root: process.env.TMPDIR,
        root_sha256: "0".repeat(64),
      });
      expect(() => validateConnectedFixture105ExecutionRoot()).toThrow();
    } finally {
      if (savedBinding === undefined)
        delete process.env.DESK_FIXTURE105_BINDING;
      else process.env.DESK_FIXTURE105_BINDING = savedBinding;
    }
    executionRoot = validateConnectedFixture105ExecutionRoot();
    // Valid-location binding failures must be caught before allocating any cluster.
    const adoptionPath = join(executionRoot, "bindings/ADOPTION.json");
    const adoptionBytes = readFileSync(adoptionPath);
    for (const variant of [
      "malformed",
      "oversize",
      "relation",
      "symlink",
    ] as const) {
      const savedPath = join(dirname(executionRoot), "adoption-witness.json");
      renameSync(adoptionPath, savedPath);
      try {
        if (variant === "symlink") symlinkSync(savedPath, adoptionPath);
        else
          writeFileSync(
            adoptionPath,
            variant === "malformed"
              ? "{"
              : variant === "oversize"
                ? "x".repeat(262145)
                : JSON.stringify({
                    ...(JSON.parse(adoptionBytes.toString("utf8")) as Obj),
                    release_sha256: "0".repeat(64),
                  }),
            { flag: "wx", mode: 0o600 },
          );
        expect(() => validateConnectedFixture105ExecutionRoot()).toThrow();
        expect(cluster).toBeUndefined();
      } finally {
        unlinkSync(adoptionPath);
        renameSync(savedPath, adoptionPath);
      }
    }
    expect(validateConnectedFixture105ExecutionRoot()).toBe(executionRoot);
    cluster = new TrackedFixtureCluster(bootstrapUrl);
    await cluster.bootstrap();
  }, LIMIT);

  type ConfigSeed = "exact" | "missing-config" | "changed-show" | "extra-show";
  async function fresh(seed: ConfigSeed = "exact"): Promise<DbEnv> {
    // Track before migration so setup failure still reaches independent teardown.
    if (cluster === undefined) throw new Error("fixture cluster not allocated");
    const env = await requireCluster().create({ migrate: false });
    current = env;
    await migrate(env.migrator);
    // Configuration belongs to the existing setup role; runtime privileges stay unchanged.
    const fixed = connectedFixture105Data();
    for (const table of ["shows", "show_config_versions"] as const) {
      const spec = fixed.sql.find((value) => value.table === table);
      if (spec === undefined)
        throw new Error("missing fixed configuration SQL map");
      const columns = spec.columns as Obj[];
      let rows = (fixed.tables[table] ?? []).map((row) => structuredClone(row));
      if (table === "show_config_versions" && seed === "missing-config")
        rows = [];
      if (table === "shows" && seed === "changed-show") {
        const first = rows[0];
        if (first === undefined) throw new Error("missing fixed show");
        first.title = "Changed fixture show";
      }
      if (table === "shows" && seed === "extra-show") {
        const first = rows[0];
        if (first === undefined) throw new Error("missing fixed show");
        rows.push({
          ...first,
          show_id: "00000000-0000-4000-8000-000000000001",
          slug: "foreign-fixture-show",
        });
      }
      for (const row of rows) {
        await env.migrator.query(
          `INSERT INTO ${table} (${columns.map((column) => String(column.column)).join(",")}) VALUES (${columns.map((column, index) => `$${String(index + 1)}${column.sql_type === "jsonb" ? "::jsonb" : ""}`).join(",")})`,
          columns.map((column) =>
            column.sql_type === "jsonb"
              ? canonicalJson(row[String(column.column)])
              : row[String(column.column)],
          ),
        );
      }
    }
    await requireCluster().settle(env.name); // One memoized outcome; no second pool.end.
    process.env.DESK_ENV = "test";
    process.env.DATABASE_URL = env.runtimeUrl;
    process.env.PROVIDERS_ENABLED = "false";
    process.env.DEPLOYED_COMMIT = "fixture105-native-source-validation";
    return env;
  }
  async function inspect<T>(
    env: DbEnv,
    work: (pool: pg.Pool) => Promise<T>,
  ): Promise<T> {
    const pool = new pg.Pool({
      connectionString: env.runtimeUrl,
      options: "-c role=desk_runtime",
      max: 1,
    });
    try {
      return await work(pool);
    } finally {
      await pool.end();
    }
  }
  async function counts(env: DbEnv): Promise<Obj> {
    return inspect(env, async (pool) => {
      const result = await pool.query<Obj>(`SELECT
        (SELECT count(*)::integer FROM evidence_packages) AS packages,
        (SELECT count(*)::integer FROM performance_direction_versions) AS directions,
        (SELECT count(*)::integer FROM performance_intents) AS intents,
        (SELECT count(*)::integer FROM gate_results) AS gates,
        (SELECT count(*)::integer FROM audit_runs) AS audits`);
      if (result.rows[0] === undefined) throw new Error("missing count row");
      return result.rows[0];
    });
  }
  async function constructionPopulation(
    env: DbEnv,
  ): Promise<Record<string, number>> {
    return inspect(env, async (pool) => {
      const result: Record<string, number> = {};
      for (const table of [
        "claims",
        "claim_state_events",
        "rights_versions",
        "claim_supports",
        "evidence_units",
        "derivation_runs",
        "evidence_packages",
        "artifacts",
      ])
        result[table] = Number(
          (
            await pool.query<{ n: string }>(
              `SELECT count(*) AS n FROM ${table}`,
            )
          ).rows[0]?.n,
        );
      return result;
    });
  }
  async function expectConstructionRollback(
    env: DbEnv,
    artifacts = 0,
  ): Promise<void> {
    expect(await constructionPopulation(env)).toEqual({
      claims: 0,
      claim_state_events: 0,
      rights_versions: 0,
      claim_supports: 0,
      evidence_units: 0,
      derivation_runs: 0,
      evidence_packages: 0,
      artifacts,
    });
  }
  async function expectNoPerformanceArtifacts(env: DbEnv): Promise<void> {
    await inspect(env, async (pool) => {
      expect(
        (
          await pool.query(
            "SELECT artifact_id FROM artifacts WHERE artifact_type IN ('performance_direction','fixture_operation','fixture_audit')",
          )
        ).rows,
      ).toEqual([]);
    });
  }
  function packageInput(): AuthoredPackage {
    const f = connectedFixture105Data();
    const ids = f.identities.ids as Obj;
    const row = f.tables.artifacts?.find(
      (value) => value.artifact_id === ids["package-artifact"],
    );
    if (row === undefined) throw new Error("missing package artifact");
    return {
      artifact_id: String(row.artifact_id),
      evidence_package_id: String(ids.package),
      schema_version: String(row.schema_version),
      canonical_payload: f.pkg as Json,
      storage_uri: null,
      byte_size: Number(row.byte_size),
      created_at: String(row.created_at),
    };
  }
  async function packagePrerequisites(
    env: DbEnv,
    orphan: boolean,
  ): Promise<void> {
    // Test-only fixed installer for legacy package parity. It does not mint a
    // construction observation, receipt or continuation for the connected host.
    const f = connectedFixture105Data();
    await inspect(env, async (pool) => {
      for (const table of [
        "accounts",
        "rights_versions",
        "evidence_units",
        "claims",
        "claim_state_events",
        "derivation_runs",
        "claim_supports",
      ]) {
        const spec = f.sql.find((value) => value.table === table);
        if (spec === undefined) throw new Error("missing SQL map");
        const columns = spec.columns as Obj[];
        for (const row of f.tables[table] ?? []) {
          await pool.query(
            `INSERT INTO ${table} (${columns.map((column) => String(column.column)).join(",")}) VALUES (${columns.map((column, index) => `$${String(index + 1)}${column.sql_type === "jsonb" ? "::jsonb" : ""}`).join(",")})`,
            columns.map((column) =>
              column.sql_type === "jsonb"
                ? canonicalJson(row[String(column.column)])
                : row[String(column.column)],
            ),
          );
        }
      }
      if (orphan) {
        const input = packageInput();
        await pool.query(
          "INSERT INTO artifacts (artifact_id,artifact_type,schema_version,content_hash,canonical_payload,storage_uri,byte_size,created_at) VALUES ($1,'evidence_package',$2,$3,$4::jsonb,NULL,$5,$6)",
          [
            input.artifact_id,
            input.schema_version,
            f.identities.package_hash,
            canonicalJson(input.canonical_payload),
            input.byte_size,
            input.created_at,
          ],
        );
      }
    });
  }
  async function fault<T>(
    point: string,
    effect: () => void | Promise<void>,
    work: () => Promise<T>,
  ): Promise<T> {
    const old = Object.getOwnPropertyDescriptor(globalThis, HOOK);
    const flag = process.env.DESK_TEST_FAULTS;
    let seen = 0;
    process.env.DESK_TEST_FAULTS = "1";
    Object.defineProperty(globalThis, HOOK, {
      configurable: true,
      value: async (name: string) => {
        if (name === point) {
          seen += 1;
          await effect();
        }
      },
    });
    try {
      return await work();
    } finally {
      if (old === undefined) Reflect.deleteProperty(globalThis, HOOK);
      else Object.defineProperty(globalThis, HOOK, old);
      if (flag === undefined) delete process.env.DESK_TEST_FAULTS;
      else process.env.DESK_TEST_FAULTS = flag;
      expect(seen).toBe(1); // A witness that never reaches its intended cut fails.
    }
  }
  afterEach(async () => {
    const env = current;
    current = undefined;
    try {
      if (env !== undefined) await env.close();
      await cluster?.closePending();
    } catch (error) {
      harnessCleanupFailed = true;
      throw error;
    } finally {
      for (const key of environmentKeys) {
        const value = saved[key];
        if (value === undefined) Reflect.deleteProperty(process.env, key);
        else process.env[key] = value;
      }
    }
  }, LIMIT);
  afterAll(async () => {
    const cleanup: unknown[] = [];
    try {
      await cluster?.shutdown();
    } catch (error) {
      cleanup.push(error);
    }
    if (cluster === undefined) {
      if (cleanup.length)
        throw new AggregateError(cleanup, "fixture cleanup failed");
      return;
    }
    const verifier = new pg.Pool({ connectionString: bootstrapUrl, max: 1 });
    try {
      const result = await verifier.query<Obj>(
        `SELECT
        (SELECT count(*)::integer FROM pg_database WHERE datname = ANY($1::text[])) AS databases,
        (SELECT count(*)::integer FROM pg_roles WHERE rolname = ANY($2::text[])) AS roles`,
        [
          [...cluster.names, ...isolatedClusters.flatMap((item) => item.names)],
          [
            ...cluster.logins,
            ...isolatedClusters.flatMap((item) => item.logins),
          ],
        ],
      );
      expect(result.rows).toEqual([{ databases: 0, roles: 0 }]);
    } catch (error) {
      cleanup.push(error);
    } finally {
      try {
        await verifier.end();
      } catch (error) {
        cleanup.push(error);
      }
    }
    if (executionRoot !== undefined) {
      try {
        expect(validateConnectedFixture105ExecutionRoot()).toBe(executionRoot);
        const evidence = join(dirname(dirname(executionRoot)), "evidence");
        const directory = openSync(
          evidence,
          constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
        );
        try {
          const descriptor = openSync(
            `/proc/self/fd/${String(directory)}/fixture105-suite.json`,
            constants.O_WRONLY |
              constants.O_CREAT |
              constants.O_EXCL |
              constants.O_NOFOLLOW,
            0o600,
          );
          try {
            writeFileSync(
              descriptor,
              canonicalJson({
                ...connectedFixture105SuiteEvidence(),
                cases: harnessCases,
                suite_complete:
                  cleanup.length === 0 &&
                  !harnessCleanupFailed &&
                  harnessCases.length === CASE_EXPECTATIONS.length &&
                  harnessCases.every(
                    (row) =>
                      row.completed &&
                      row.calls.length === row.expected.length &&
                      row.calls.every((call) => call.completed),
                  ),
              }) + "\n",
            );
            fsyncSync(descriptor);
          } finally {
            closeSync(descriptor);
          }
          fsyncSync(directory);
        } finally {
          closeSync(directory);
        }
      } catch (error) {
        cleanup.push(error);
      }
    }
    if (cleanup.length !== 0)
      throw new AggregateError(
        cleanup,
        "fixture cleanup and residual verification failed",
      );
  }, LIMIT);

  it(
    "records actual18+7 results, one direction and a labelled audit with retained semantic gaps",
    caseBody(
      "records actual18+7 results, one direction and a labelled audit with retained semantic gaps",
      async () => {
        const env = await fresh();
        await inspect(env, async (pool) => {
          const privileges = await pool.query(
            "SELECT has_table_privilege(current_user, 'show_config_versions', 'INSERT') AS current_insert, has_table_privilege(session_user, 'show_config_versions', 'INSERT') AS session_insert",
          );
          expect(privileges.rows).toEqual([
            { current_insert: false, session_insert: false },
          ]);
        });
        const result = await runConnectedFixture105();
        expect(result.status).toBe("created");
        expect(result.claims.rows).toHaveLength(18);
        expect(result.claims.aggregate).toBe("incomplete");
        const expectedLimits: unknown = expect.arrayContaining([
          expect.stringContaining("historical_visibility_unprovable"),
        ]);
        expect(result.claims.coverage).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: "H04",
              status: "not_established_required",
            }),
            expect.objectContaining({
              id: "H13",
              status: "not_established_required",
            }),
            expect.objectContaining({ id: "C13", limits: expectedLimits }),
          ]),
        );
        expect(result.performance.rows).toHaveLength(7);
        expect(
          result.performance.rows.every((row) => row.outcome === "pass"),
        ).toBe(true);
        expect(result.audit.kind).toBe("fixture_stub");
        expect(result.audit.semantic_acceptance).toBe("not_established");
        expect(await counts(env)).toEqual({
          packages: 1,
          directions: 1,
          intents: 1,
          gates: 25,
          audits: 1,
        });
        await inspect(env, async (pool) => {
          expect(
            (await pool.query("SELECT model_run_id FROM audit_runs")).rows,
          ).toEqual([{ model_run_id: null }]);
          expect(
            (await pool.query("SELECT state FROM program_run_attempts")).rows,
          ).toEqual([{ state: "PENDING" }]);
        });
      },
    ),
    LIMIT,
  );
  it(
    "keeps actual fixture output outside genuine admission and rejects render audit promotion",
    caseBody(
      "keeps actual fixture output outside genuine admission and rejects render audit promotion",
      async () => {
        const env = await fresh();
        const result = await runConnectedFixture105();
        const before = await counts(env);
        const refusal = admissionOf(
          { kind: "state", gate: 18, texture: 4 },
          result.claims.aggregate,
        );
        expect(refusal).toMatchObject({
          kind: "refused",
          code: "perf_upstream_gate_incomplete",
          writes_attempted: 0,
        });
        expect(() =>
          connectedFixture105ArtifactHash("audit", {
            ...result.audit,
            semantic_acceptance: "accepted",
          }),
        ).toThrow();
        expect(() =>
          connectedFixture105ArtifactHash("audit", {
            ...result.audit,
            render_allowed: true,
          }),
        ).toThrow();
        expect(() =>
          connectedFixture105ArtifactHash("audit", {
            ...result.audit,
            attempt_state: "READY",
          }),
        ).toThrow();
        await inspect(env, async (pool) => {
          expect(
            (
              await pool.query(
                "SELECT render_manifest_id FROM render_manifests",
              )
            ).rows,
          ).toEqual([]);
          expect(
            (await pool.query("SELECT model_run_id FROM model_runs")).rows,
          ).toEqual([]);
          expect(
            (await pool.query("SELECT state FROM program_run_attempts")).rows,
          ).toEqual([{ state: "PENDING" }]);
        });
        expect(await counts(env)).toEqual(before);
        // Schema/admission calls and absence of effects, not a nonexistent Render API.
      },
    ),
    LIMIT,
  );
  it(
    "converges by exact readback without producing a second direction",
    caseBody(
      "converges by exact readback without producing a second direction",
      async () => {
        const env = await fresh();
        const first = await runConnectedFixture105();
        const before = await counts(env);
        const second = await reconcileConnectedFixture105();
        expect(second.status).toBe("reconciled");
        expect(second.operation_id).toBe(first.operation_id);
        expect(second.operation_sha256).toBe(first.operation_sha256);
        expect(await counts(env)).toEqual(before);
      },
    ),
    LIMIT,
  );
  it(
    "refuses a preseeded source population without constructing an observation",
    caseBody(
      "refuses a preseeded source population without constructing an observation",
      async () => {
        for (const variant of [
          "foreign-claim",
          "missing-config",
          "changed-show",
          "extra-show",
        ] as const) {
          const env = await fresh(
            variant === "foreign-claim" ? "exact" : variant,
          );
          try {
            if (variant === "foreign-claim")
              await inspect(env, async (pool) => {
                const row = connectedFixture105Data().tables.claims?.[0];
                if (row === undefined) throw new Error("missing fixed claim");
                await pool.query(
                  "INSERT INTO claims (claim_id,content_hash,claim_kind,origin,subject_domain,subject,predicate,value,initial_status,initial_usage_class,asserted_at,supersedes_claim_id,created_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9,$10,$11,$12,$13)",
                  [
                    row.claim_id,
                    row.content_hash,
                    row.claim_kind,
                    row.origin,
                    row.subject_domain,
                    JSON.stringify(row.subject),
                    row.predicate,
                    JSON.stringify(row.value),
                    row.initial_status,
                    row.initial_usage_class,
                    row.asserted_at,
                    row.supersedes_claim_id,
                    row.created_at,
                  ],
                );
              });
            const scopes = {
              "foreign-claim": "preseed_foreign_claim",
              "missing-config": "preseed_missing_config",
              "changed-show": "preseed_changed_show",
              "extra-show": "preseed_extra_show",
            } as const;
            await new TargetObserver(
              env.name,
              scopes[variant],
              maintenanceOwner(),
            ).around(async () => {
              await expect(runConnectedFixture105()).rejects.toThrow(
                "fixture_initial_population",
              );
            });
            expect(await counts(env)).toEqual({
              packages: 0,
              directions: 0,
              intents: 0,
              gates: 0,
              audits: 0,
            });
          } finally {
            await env.close();
            current = undefined;
          }
        }
      },
    ),
    LIMIT,
  );
  it(
    "rolls back the package when the later observation insert fails",
    caseBody(
      "rolls back the package when the later observation insert fails",
      async () => {
        const env = await fresh();
        await fault(
          "fixture105_after_package_before_observation",
          () => {
            throw new Error("native observation cut");
          },
          async () => {
            await expect(runConnectedFixture105()).rejects.toThrow(
              "native observation cut",
            );
          },
        );
        await expectConstructionRollback(env);
        expect(await counts(env)).toEqual({
          packages: 0,
          directions: 0,
          intents: 0,
          gates: 0,
          audits: 0,
        });
      },
    ),
    LIMIT,
  );
  it(
    "refuses context change between settled acquisition and consumer",
    caseBody(
      "refuses context change between settled acquisition and consumer",
      async () => {
        const env = await fresh();
        await fault(
          "fixture105_after_acquisition",
          () => {
            process.env.DESK_ENV = "staging";
          },
          async () => {
            await expect(runConnectedFixture105()).rejects.toThrow(
              "fixture_context_changed",
            );
          },
        );
        expect((await counts(env)).directions).toBe(0);
      },
    ),
    LIMIT,
  );
  it(
    "rolls back every Performance row after a late gate insert failure",
    caseBody(
      "rolls back every Performance row after a late gate insert failure",
      async () => {
        const env = await fresh();
        await fault(
          "fixture105_after_performance_rows",
          () => {
            throw new Error("native direction cut");
          },
          async () => {
            await expect(runConnectedFixture105()).rejects.toThrow(
              "native direction cut",
            );
          },
        );
        expect(await counts(env)).toEqual({
          packages: 1,
          directions: 0,
          intents: 0,
          gates: 18,
          audits: 0,
        });
        await expectNoPerformanceArtifacts(env);
      },
    ),
    LIMIT,
  );
  it(
    "retains durable direction if the separate audit transaction fails",
    caseBody(
      "retains durable direction if the separate audit transaction fails",
      async () => {
        const env = await fresh();
        await fault(
          "fixture105_before_audit_commit",
          () => {
            throw new Error("native audit cut");
          },
          async () => {
            await expect(runConnectedFixture105()).rejects.toThrow(
              "native audit cut",
            );
          },
        );
        expect(await counts(env)).toEqual({
          packages: 1,
          directions: 1,
          intents: 1,
          gates: 25,
          audits: 0,
        });
        const reconciled = await reconcileConnectedFixture105();
        expect(reconciled.status).toBe("direction_durable_audit_absent");
        expect(reconciled.audit).toBeNull();
        expect(await counts(env)).toEqual({
          packages: 1,
          directions: 1,
          intents: 1,
          gates: 25,
          audits: 0,
        });
      },
    ),
    LIMIT,
  );
  it(
    "refuses an extra governed intent during re-entry",
    caseBody("refuses an extra governed intent during re-entry", async () => {
      const env = await fresh();
      await runConnectedFixture105();
      await inspect(env, async (pool) => {
        await pool.query(
          "INSERT INTO performance_intents (performance_intent_id,performance_direction_version_id,turn_id,intent) SELECT 'ed66aeb2-92b7-437b-b91c-8d01e0a5e71a',performance_direction_version_id,turn_id,intent FROM performance_intents WHERE performance_intent_id = $1",
          [connectedFixture105Data().identities.intent],
        );
      });
      const before = await counts(env);
      await expect(reconcileConnectedFixture105()).rejects.toThrow(
        "fixture_owned_conflict",
      );
      expect(canonicalJson(await counts(env))).toBe(canonicalJson(before));
    }),
    LIMIT,
  );
  it(
    "preserves package preflight refusal without a connection checkout",
    caseBody(
      "preserves package preflight refusal without a connection checkout",
      async () => {
        const env = await fresh();
        await inspect(env, async (pool) => {
          const result = await persistEvidencePackage(pool, {
            ...packageInput(),
            artifact_id: "not-a-uuid",
          });
          expect(result.kind).toBe("rejected");
          expect(pool.totalCount).toBe(0);
        });
      },
    ),
    LIMIT,
  );
  it(
    "preserves the old package creation and governed-hash reuse outcomes",
    caseBody(
      "preserves the old package creation and governed-hash reuse outcomes",
      async () => {
        const env = await fresh();
        await packagePrerequisites(env, false);
        await inspect(env, async (pool) => {
          const input = packageInput();
          const first = await persistEvidencePackage(pool, input);
          expect(first.kind).toBe("created");
          if (first.kind !== "created") throw new Error("creation failed");
          expect(first.record.reused).toBe(false);
          expect(first.record.completed_existing_artifact).toBe(false);
          const repeated = await persistEvidencePackage(pool, input);
          expect(repeated.kind).toBe("converged");
          if (repeated.kind !== "converged") throw new Error("reuse failed");
          expect(repeated.record.reused).toBe(true);
          expect(pool.waitingCount).toBe(0);
          expect(pool.idleCount).toBe(pool.totalCount);
        });
      },
    ),
    LIMIT,
  );
  it(
    "preserves orphan completion as distinguishable from genuinely fresh creation",
    caseBody(
      "preserves orphan completion as distinguishable from genuinely fresh creation",
      async () => {
        const env = await fresh();
        await packagePrerequisites(env, true);
        await inspect(env, async (pool) => {
          const result = await persistEvidencePackage(pool, packageInput());
          expect(result.kind).toBe("created");
          if (result.kind !== "created") throw new Error("completion failed");
          expect(result.record.completed_existing_artifact).toBe(true);
          expect(result.record.reused).toBe(false);
        });
      },
    ),
    LIMIT,
  );
  it(
    "refuses unregistered structural objects including a caller transaction at the package borrower",
    caseBody(
      "refuses unregistered structural objects including a caller transaction at the package borrower",
      async () => {
        const env = await fresh();
        await inspect(env, async (pool) => {
          const client = await pool.connect();
          try {
            await expect(persistConnectedFixture105Package({})).rejects.toThrow(
              "fixture_package_capability",
            );
            await expect(
              persistConnectedFixture105Package({
                tx: client,
                live: true,
                taken: false,
              }),
            ).rejects.toThrow("fixture_package_capability");
          } finally {
            client.release();
          }
        });
        expect(await counts(env)).toEqual({
          packages: 0,
          directions: 0,
          intents: 0,
          gates: 0,
          audits: 0,
        });
      },
    ),
    LIMIT,
  );
  it(
    "associates a genuine package capability only with its owner transaction",
    caseBody(
      "associates a genuine package capability only with its owner transaction",
      async () => {
        const env = await fresh();
        const original = packageOwner.persistConnectedFixture105Package;
        let reached = 0;
        const stop = new Error("association observed; rollback requested");
        const observer = vi
          .spyOn(packageOwner, "persistConnectedFixture105Package")
          .mockImplementation(async (capability) => {
            reached++;
            const borrowed = takeConnectedFixture105PackageBorrow(capability);
            // The public call has one capability argument, no caller-selected Tx slot.
            const arity: Parameters<
              typeof persistConnectedFixture105Package
            >["length"] = 1;
            expect(arity).toBe(1);
            const owned = (
              await borrowed.tx.query(
                "SELECT txid_current()::text AS txid,current_database() AS database",
              )
            ).rows[0];
            if (owned === undefined)
              throw new Error("owner transaction unavailable");
            await inspect(env, async (pool) => {
              const foreign = (
                await pool.query(
                  "SELECT txid_current()::text AS txid,current_database() AS database",
                )
              ).rows[0] as { txid: string; database: string } | undefined;
              if (foreign === undefined)
                throw new Error("foreign transaction unavailable");
              expect(owned.database).toBe(foreign.database);
              expect(owned.txid).not.toBe(foreign.txid);
            });
            expect(borrowed.pkg.evidence_package_id).toBe(
              (connectedFixture105Data().identities.ids as Obj).package,
            );
            await expect(original({ tx: borrowed.tx })).rejects.toThrow(
              "fixture_package_capability",
            );
            throw stop;
          });
        try {
          await expect(runConnectedFixture105()).rejects.toBe(stop);
        } finally {
          observer.mockRestore();
        }
        expect(reached).toBe(1);
        await expectConstructionRollback(env);
      },
    ),
    LIMIT,
  );
  it(
    "refuses an appended event between settled acquisition and consumption",
    caseBody(
      "refuses an appended event between settled acquisition and consumption",
      async () => {
        const env = await fresh();
        await fault(
          "fixture105_after_acquisition",
          async () => {
            const row =
              connectedFixture105Data().tables.claim_state_events?.[0];
            if (row === undefined) throw new Error("missing event");
            await inspect(env, async (pool) => {
              await pool.query(
                "INSERT INTO claim_state_events (claim_state_event_id,claim_id,actor_id,occurred_at,event_type,event_sequence,event_payload) VALUES ('36f7441e-7bdd-49b6-96b2-9152ac67f425',$1,$2,$3,$4,2,$5::jsonb)",
                [
                  row.claim_id,
                  row.actor_id,
                  row.occurred_at,
                  row.event_type,
                  canonicalJson(row.event_payload),
                ],
              );
            });
          },
          async () => {
            await expect(runConnectedFixture105()).rejects.toThrow(
              "fixture_row_population",
            );
          },
        );
        expect((await counts(env)).directions).toBe(0);
      },
    ),
    LIMIT,
  );
  it(
    "refuses production context before a database checkout",
    caseBody(
      "refuses production context before a database checkout",
      async () => {
        const env = await fresh();
        process.env.DESK_ENV = "production";
        await expect(runConnectedFixture105()).rejects.toThrow(
          "fixture_runtime_context",
        );
        expect(await counts(env)).toEqual({
          packages: 0,
          directions: 0,
          intents: 0,
          gates: 0,
          audits: 0,
        });
      },
    ),
    LIMIT,
  );
  it(
    "rejects a second live borrow, a clone, and a stale genuine capability",
    caseBody(
      "rejects a second live borrow, a clone, and a stale genuine capability",
      async () => {
        const env = await fresh();
        const original = packageOwner.persistConnectedFixture105Package;
        let captured: object | undefined;
        let calls = 0;
        const observer = vi
          .spyOn(packageOwner, "persistConnectedFixture105Package")
          .mockImplementation(async (capability) => {
            calls += 1;
            captured = capability;
            const outcome = await original(capability); // Real owner; no substituted result.
            await expect(original(capability)).rejects.toThrow(
              "fixture_package_capability",
            );
            await expect(original(structuredClone(capability))).rejects.toThrow(
              "fixture_package_capability",
            );
            return outcome;
          });
        try {
          await expect(runConnectedFixture105()).rejects.toThrow(
            "fixture_host_closed",
          );
        } finally {
          observer.mockRestore();
        }
        await expectConstructionRollback(env);
        expect(calls).toBe(1);
        if (captured === undefined)
          throw new Error("real borrower not reached");
        await expect(original(captured)).rejects.toThrow(
          "fixture_package_capability",
        );
      },
    ),
    LIMIT,
  );
  it(
    "rejects live capability consumption after originating context changes",
    caseBody(
      "rejects live capability consumption after originating context changes",
      async () => {
        for (const variant of ["context", "marker", "root"] as const) {
          const env = await fresh();
          const original = packageOwner.persistConnectedFixture105Package;
          let reached = false;
          if (executionRoot === undefined) throw new Error("root missing");
          const rootPath = executionRoot;
          const marker = join(rootPath, "ROOT.json");
          const bytes = readFileSync(marker);
          const moved = rootPath + "-witness";
          const observer = vi
            .spyOn(packageOwner, "persistConnectedFixture105Package")
            .mockImplementation(async (capability) => {
              reached = true;
              const pending = original(capability);
              if (variant === "context") {
                const changed = new URL(env.runtimeUrl);
                changed.pathname = "/foreign_fixture_target";
                process.env.DATABASE_URL = changed.toString();
              } else if (variant === "marker")
                writeFileSync(
                  marker,
                  Buffer.concat([bytes, Buffer.from("\n")]),
                );
              else {
                renameSync(rootPath, moved);
                mkdirSync(rootPath, { mode: 0o700 });
              }
              try {
                await expect(pending).rejects.toThrow();
              } finally {
                if (variant === "context")
                  process.env.DATABASE_URL = env.runtimeUrl;
                else if (variant === "marker") writeFileSync(marker, bytes);
                else {
                  rmdirSync(rootPath);
                  renameSync(moved, rootPath);
                }
              }
              expect(validateConnectedFixture105ExecutionRoot()).toBe(rootPath);
              await expect(original(capability)).rejects.toThrow(
                "fixture_package_capability",
              );
              return original(capability); // Restoration cannot revive the recognized token/host.
            });
          try {
            await expect(runConnectedFixture105()).rejects.toThrow(
              "fixture_package_capability",
            );
            expect(reached).toBe(true);
            await expectConstructionRollback(env);
            expect(await counts(env)).toEqual({
              packages: 0,
              directions: 0,
              intents: 0,
              gates: 0,
              audits: 0,
            });
          } finally {
            observer.mockRestore();
            await env.close();
            current = undefined;
          }
        }
      },
    ),
    LIMIT,
  );
  it(
    "holds a lost direction COMMIT acknowledgement and reconciles without replay",
    caseBody(
      "holds a lost direction COMMIT acknowledgement and reconciles without replay",
      async () => {
        const env = await fresh();
        let armed = false;
        let intercepted = 0;
        const descriptor = Object.getOwnPropertyDescriptor(
          pg.Client.prototype,
          "query",
        );
        if (descriptor === undefined)
          throw new Error("driver method unavailable");
        // Real native COMMIT happens first. Only its delivery to runCommand is lost;
        // no success row or command outcome is substituted by this transport witness.
        const original = driverQuery(descriptor);
        Object.defineProperty(pg.Client.prototype, "query", {
          ...descriptor,
          value: async function (
            this: pg.Client,
            text: string,
            values?: unknown[],
          ): Promise<pg.QueryResult> {
            const result = await original.call(this, text, values);
            if (armed && text === "COMMIT") {
              armed = false;
              intercepted += 1;
              const loss = new Error("fixture transport lost acknowledgement");
              this.emit("error", loss);
              throw loss;
            }
            return result;
          },
        });
        try {
          await fault(
            "fixture105_after_performance_rows",
            () => {
              armed = true;
            },
            async () => {
              try {
                await runConnectedFixture105();
                throw new Error("expected unknown commit");
              } catch (error) {
                expect(error).toBeInstanceOf(CommandConnectionError);
                if (!(error instanceof CommandConnectionError)) throw error;
                expect(error.commitOutcome).toBe("unknown");
              }
            },
          );
        } finally {
          Object.defineProperty(pg.Client.prototype, "query", descriptor);
        }
        expect(intercepted).toBe(1);
        const before = await counts(env);
        expect(before).toEqual({
          packages: 1,
          directions: 1,
          intents: 1,
          gates: 25,
          audits: 0,
        });
        expect((await reconcileConnectedFixture105()).status).toBe(
          "direction_durable_audit_absent",
        );
        expect(await counts(env)).toEqual(before);
      },
    ),
    LIMIT,
  );
  it(
    "rolls back package creation when a foreign observation identity wins late",
    caseBody(
      "rolls back package creation when a foreign observation identity wins late",
      async () => {
        const env = await fresh();
        const attempt = (connectedFixture105Data().identities.ids as Obj)
          .attempt;
        const digest = sha256(
          Buffer.from(
            `connected-fixture105-storage/2\n${String(attempt)}\nobservation`,
            "utf8",
          ),
        );
        const observationId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
        expect(observationId).toBe("cfabc9d0-a817-4971-a868-342f3692b5bd");
        await fault(
          "fixture105_after_package_before_observation",
          async () => {
            await inspect(env, async (pool) => {
              await pool.query(
                "INSERT INTO artifacts (artifact_id,artifact_type,schema_version,content_hash,canonical_payload,storage_uri,byte_size,created_at) VALUES ($3::uuid,'fixture105-construction-observation/1','fixture105-construction-observation/1',$1,'{}'::jsonb,NULL,2,$2)",
                [
                  "0".repeat(64),
                  connectedFixture105Data().identities.authored_fiction_time,
                  observationId,
                ],
              );
            });
          },
          async () => {
            try {
              await runConnectedFixture105();
              throw new Error("expected observation collision");
            } catch (error) {
              expect(error).toMatchObject({
                code: "23505",
                constraint: "artifacts_pkey",
              });
            }
          },
        );
        expect(await counts(env)).toEqual({
          packages: 0,
          directions: 0,
          intents: 0,
          gates: 0,
          audits: 0,
        });
        await expectConstructionRollback(env, 1);
        await inspect(env, async (pool) => {
          expect(
            (await pool.query("SELECT artifact_id::text FROM artifacts")).rows,
          ).toEqual([{ artifact_id: observationId }]);
        });
      },
    ),
    LIMIT,
  );
  it(
    "refuses a stale extra gate fingerprint without changing durable rows",
    caseBody(
      "refuses a stale extra gate fingerprint without changing durable rows",
      async () => {
        const env = await fresh();
        await runConnectedFixture105();
        await inspect(env, async (pool) => {
          await pool.query(
            "INSERT INTO gate_results (gate_result_id,gate_definition_id,attempt_id,input_fingerprint,outcome,result,created_at) SELECT '579b5470-4e9c-4c84-bd20-416fdc643fc2',gate_definition_id,attempt_id,$1,outcome,result,created_at FROM gate_results ORDER BY gate_result_id LIMIT 1",
            ["0".repeat(64)],
          );
        });
        const before = await counts(env);
        await expect(reconcileConnectedFixture105()).rejects.toThrow(
          "fixture_owned_conflict",
        );
        expect(await counts(env)).toEqual(before);
      },
    ),
    LIMIT,
  );
  it(
    "holds unknown construction commit without inventing its missing settlement receipt",
    caseBody(
      "holds unknown construction commit without inventing its missing settlement receipt",
      async () => {
        const env = await fresh();
        let armed = false;
        let intercepted = 0;
        const observer = new TargetObserver(
          env.name,
          "unknown_construction",
          maintenanceOwner(),
        );
        await observer.around(async () => {
          const descriptor = Object.getOwnPropertyDescriptor(
            pg.Client.prototype,
            "query",
          );
          if (descriptor === undefined)
            throw new Error("driver method unavailable");
          const original = driverQuery(descriptor);
          Object.defineProperty(pg.Client.prototype, "query", {
            ...descriptor,
            value: async function (
              this: pg.Client,
              text: string,
              values?: unknown[],
            ): Promise<pg.QueryResult> {
              const result = await original.call(this, text, values);
              if (armed && text === "COMMIT") {
                armed = false;
                intercepted += 1;
                const loss = new Error("construction acknowledgement withheld");
                this.emit("error", loss);
                throw loss;
              }
              return result;
            },
          });
          await withTestCleanup(
            async () => {
              await fault(
                "fixture105_after_package_before_observation",
                () => {
                  armed = true;
                },
                async () => {
                  try {
                    await runConnectedFixture105();
                    throw new Error("expected unknown construction commit");
                  } catch (error) {
                    expect(error).toBeInstanceOf(CommandConnectionError);
                    if (!(error instanceof CommandConnectionError)) throw error;
                    expect(error.commitOutcome).toBe("unknown");
                  }
                },
              );
            },
            () => {
              observer.restoreWitness(descriptor);
              return Promise.resolve();
            },
          );
        });
        expect(intercepted).toBe(1);
        const before = await counts(env);
        expect(before).toEqual({
          packages: 1,
          directions: 0,
          intents: 0,
          gates: 0,
          audits: 0,
        });
        await expect(reconcileConnectedFixture105()).rejects.toThrow(
          "fixture_construction_receipt_unavailable",
        );
        expect(await counts(env)).toEqual(before);
        await env.close();
        current = undefined;
        // Three direct historical-owner transactions, each on a new real database.
        // The actual matching statement arms only its own client; COMMIT reaches the
        // driver first, then this witness withholds that acknowledgement exactly once.
        for (const owner of [
          "program_run",
          "program_attempt",
          "package_binding",
        ] as const) {
          const separate = await fresh();
          const selected: { client?: pg.Client } = {};
          let reached = 0;
          let lost = 0;
          let receiptBefore: Buffer | undefined;
          let terminalBefore: Buffer | undefined;
          let targetKey: string | undefined;
          const scopes = {
            program_run: "unknown_program_run",
            program_attempt: "unknown_program_attempt",
            package_binding: "unknown_package_binding",
          } as const;
          const observer = new TargetObserver(
            separate.name,
            scopes[owner],
            maintenanceOwner(),
          );
          await observer.around(async () => {
            const queryDescriptor = Object.getOwnPropertyDescriptor(
              pg.Client.prototype,
              "query",
            );
            if (queryDescriptor === undefined)
              throw new Error("driver method unavailable");
            const query = driverQuery(queryDescriptor);
            const statement =
              owner === "program_run"
                ? /^\s*INSERT INTO program_runs\s*\(/u
                : owner === "program_attempt"
                  ? /^\s*INSERT INTO program_run_attempts\s*\(/u
                  : /^SELECT bind_evidence_package\(/u;
            Object.defineProperty(pg.Client.prototype, "query", {
              ...queryDescriptor,
              value: async function (
                this: pg.Client,
                text: string,
                values?: unknown[],
              ): Promise<pg.QueryResult> {
                const result = await query.call(this, text, values);
                if (statement.test(text)) {
                  reached++;
                  expect(reached).toBe(1);
                  selected.client = this;
                  if (owner === "package_binding") {
                    const target = observedLists().targets.at(-1);
                    if (
                      target === undefined ||
                      typeof target.target_hash !== "string" ||
                      executionRoot === undefined
                    )
                      throw new Error("binding witness target missing");
                    targetKey = target.target_hash;
                    receiptBefore = readFileSync(
                      join(
                        executionRoot,
                        "receipts",
                        targetKey,
                        "CONSTRUCTION.json",
                      ),
                    );
                    terminalBefore = readFileSync(
                      join(
                        executionRoot,
                        "expectations",
                        targetKey + ".terminal.json",
                      ),
                    );
                  }
                }
                if (this === selected.client && text === "COMMIT") {
                  delete selected.client;
                  lost++;
                  const loss = new Error(
                    "fixed direct-owner acknowledgement withheld",
                  );
                  this.emit("error", loss);
                  throw loss;
                }
                return result;
              },
            });
            await withTestCleanup(
              async () => {
                try {
                  await runConnectedFixture105();
                  throw new Error("expected direct owner unknown COMMIT");
                } catch (error) {
                  expect(error).toBeInstanceOf(CommandConnectionError);
                  if (!(error instanceof CommandConnectionError)) throw error;
                  expect(error.commitOutcome).toBe("unknown");
                  expect(error.phase).toBe("commit");
                }
              },
              () => {
                observer.restoreWitness(queryDescriptor);
                return Promise.resolve();
              },
            );
          });
          try {
            expect(reached).toBe(1);
            expect(lost).toBe(1);
            const fixed = connectedFixture105Data().identities.ids as Obj;
            await inspect(separate, async (pool) => {
              expect(
                (
                  await pool.query(
                    "SELECT program_run_id::text FROM program_runs",
                  )
                ).rows,
              ).toEqual([{ program_run_id: fixed.run }]);
              const attempts = (
                await pool.query(
                  "SELECT attempt_id::text,evidence_package_id::text FROM program_run_attempts",
                )
              ).rows;
              expect(attempts).toEqual(
                owner === "program_run"
                  ? []
                  : [
                      {
                        attempt_id: fixed.attempt,
                        evidence_package_id:
                          owner === "package_binding" ? fixed.package : null,
                      },
                    ],
              );
            });
            const retained = await counts(separate);
            expect(retained).toEqual({
              packages: owner === "package_binding" ? 1 : 0,
              directions: 0,
              intents: 0,
              gates: 0,
              audits: 0,
            });
            if (owner === "package_binding") {
              if (
                executionRoot === undefined ||
                targetKey === undefined ||
                receiptBefore === undefined ||
                terminalBefore === undefined
              )
                throw new Error("acknowledged earlier receipt missing");
              expect(
                readFileSync(
                  join(
                    executionRoot,
                    "receipts",
                    targetKey,
                    "CONSTRUCTION.json",
                  ),
                ),
              ).toEqual(receiptBefore);
              expect(
                readFileSync(
                  join(
                    executionRoot,
                    "expectations",
                    targetKey + ".terminal.json",
                  ),
                ),
              ).toEqual(terminalBefore);
            }
            await expect(reconcileConnectedFixture105()).rejects.toThrow();
            expect(await counts(separate)).toEqual(retained);
          } finally {
            await separate.close();
            current = undefined;
          }
        }
      },
    ),
    LIMIT,
  );
  async function readerFailureOrder(
    order: "event-first" | "query-first",
  ): Promise<void> {
    const env = await fresh();
    const eventFailure = new Error("distinct client event");
    const queryFailure = new Error("distinct query rejection");
    const rollbackFailure = new Error("distinct rollback rejection");
    expect(eventFailure).not.toBe(queryFailure);
    const descriptor = Object.getOwnPropertyDescriptor(
      pg.Client.prototype,
      "query",
    );
    if (descriptor === undefined) throw new Error("driver method unavailable");
    const original = driverQuery(descriptor);
    let reached = 0;
    let released = 0;
    const selected: { client?: pg.Client } = {};
    Object.defineProperty(pg.Client.prototype, "query", {
      ...descriptor,
      value: async function (
        this: pg.Client,
        text: string,
        values?: unknown[],
      ): Promise<pg.QueryResult> {
        const result = await original.call(this, text, values);
        if (
          text === "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" &&
          reached === 0
        ) {
          reached++;
          selected.client = this;
          expect(this.listenerCount("error")).toBeGreaterThan(0);
          if (!isCheckedOutClient(this))
            throw new Error("expected checked-out client release");
          const release = this.release.bind(this);
          this.release = (error?: Error | boolean) => {
            released++;
            release(error);
          };
          if (order === "event-first") this.emit("error", eventFailure);
          throw queryFailure;
        }
        if (this === selected.client && text === "ROLLBACK") {
          if (order === "query-first") this.emit("error", eventFailure);
          throw rollbackFailure;
        }
        return result;
      },
    });
    try {
      try {
        await runConnectedFixture105();
        throw new Error("reader should fail");
      } catch (error) {
        expect(error).toBe(
          order === "event-first" ? eventFailure : queryFailure,
        );
        expect(
          connectedFixture105CleanupDiagnostics(error).length,
        ).toBeGreaterThanOrEqual(2);
      }
    } finally {
      Object.defineProperty(pg.Client.prototype, "query", descriptor);
    }
    expect(reached).toBe(1);
    expect(released).toBe(1);
    await expectConstructionRollback(env);
  }
  it(
    "retains event-first reader identity across distinct query and rollback errors",
    caseBody(
      "retains event-first reader identity across distinct query and rollback errors",
      async () => {
        await readerFailureOrder("event-first");
      },
    ),
    LIMIT,
  );
  it(
    "retains query-first reader identity across distinct later client and rollback errors",
    caseBody(
      "retains query-first reader identity across distinct later client and rollback errors",
      async () => {
        await readerFailureOrder("query-first");
      },
    ),
    LIMIT,
  );
  it(
    "retains reader listener when release throws before driver handoff without retry",
    caseBody(
      "retains reader listener when release throws before driver handoff without retry",
      async () => {
        const env = await fresh();
        const primary = new Error("reader query failure");
        const releaseFailure = new Error("release before handoff");
        const lateEvent = new Error("client event after release throw");
        const descriptor = Object.getOwnPropertyDescriptor(
          pg.Client.prototype,
          "query",
        );
        if (descriptor === undefined)
          throw new Error("driver method unavailable");
        const original = driverQuery(descriptor);
        let reached = 0;
        let releases = 0;
        let retained = false;
        let handedOff = false;
        Object.defineProperty(pg.Client.prototype, "query", {
          ...descriptor,
          value: async function (
            this: pg.Client,
            text: string,
            values?: unknown[],
          ): Promise<pg.QueryResult> {
            const result = await original.call(this, text, values);
            if (
              text === "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" &&
              reached === 0
            ) {
              reached++;
              if (!isCheckedOutClient(this))
                throw new Error("expected checked-out client release");
              const driverRelease = this.release.bind(this);
              this.release = () => {
                releases++;
                queueMicrotask(() => {
                  retained = this.listenerCount("error") > 0;
                  try {
                    if (retained) this.emit("error", lateEvent);
                  } finally {
                    driverRelease(true);
                    handedOff = true;
                  }
                });
                throw releaseFailure;
              };
              throw primary;
            }
            return result;
          },
        });
        try {
          await expect(runConnectedFixture105()).rejects.toBe(primary);
        } finally {
          Object.defineProperty(pg.Client.prototype, "query", descriptor);
        }
        expect(reached).toBe(1);
        expect(releases).toBe(1);
        expect(retained).toBe(true);
        expect(handedOff).toBe(true);
        expect(
          connectedFixture105CleanupDiagnostics(primary).length,
        ).toBeGreaterThanOrEqual(2);
        await expectConstructionRollback(env);
      },
    ),
    LIMIT,
  );
  it(
    "closes continuation when the acquisition-cut await throws before consumption",
    caseBody(
      "closes continuation when the acquisition-cut await throws before consumption",
      async () => {
        const env = await fresh();
        const primary = new Error("controlled acquisition cut");
        const firstInvocation = async (): Promise<void> => {
          await fault(
            "fixture105_after_acquisition",
            () => {
              throw primary;
            },
            async () => {
              await expect(runConnectedFixture105()).rejects.toBe(primary);
            },
          );
        };
        // CI117 provenance: observe only this first invocation; counts and re-entry remain outside the wrapper.
        await new TargetObserver(
          env.name,
          "acquisition_cut",
          maintenanceOwner(),
        ).around(firstInvocation);
        expect(await counts(env)).toEqual({
          packages: 1,
          directions: 0,
          intents: 0,
          gates: 18,
          audits: 0,
        });
        await expectNoPerformanceArtifacts(env);
        await expect(runConnectedFixture105()).rejects.toThrow(
          "fixture_execution_already_present",
        );
      },
    ),
    LIMIT,
  );
  it(
    "tracks and cleans a database allocation that fails before create returns",
    caseBody(
      "tracks and cleans a database allocation that fails before create returns",
      async () => {
        await fault(
          "fixture105_test_after_database_create",
          () => {
            throw new Error("setup before returned environment");
          },
          async () => {
            await expect(
              requireCluster().create({ migrate: false }),
            ).rejects.toThrow("setup before returned environment");
          },
        );
        await cluster?.closePending();
        expect(
          (
            await requireCluster().admin.query(
              "SELECT datname FROM pg_database WHERE datname=ANY($1::text[])",
              [requireCluster().names],
            )
          ).rows,
        ).toEqual([]);
      },
    ),
    LIMIT,
  );
  it(
    "tracks a setup pool before roles SQL or migration can fail",
    caseBody(
      "tracks a setup pool before roles SQL or migration can fail",
      async () => {
        await fault(
          "fixture105_test_after_setup_pool",
          () => {
            throw new Error("allocated setup pool failure");
          },
          async () => {
            await expect(
              requireCluster().create({ migrate: false }),
            ).rejects.toThrow("allocated setup pool failure");
          },
        );
        await cluster?.closePending();
        expect(
          (
            await requireCluster().admin.query(
              "SELECT datname FROM pg_database WHERE datname=ANY($1::text[])",
              [requireCluster().names],
            )
          ).rows,
        ).toEqual([]);
      },
    ),
    LIMIT,
  );
  it(
    "tracks bootstrap role allocation before bootstrap returns",
    caseBody(
      "tracks bootstrap role allocation before bootstrap returns",
      async () => {
        if (bootstrapUrl === undefined) throw new Error("bootstrap missing");
        const isolated = new TrackedFixtureCluster(bootstrapUrl);
        isolatedClusters.push(isolated);
        await withTestCleanup(
          async () => {
            await fault(
              "fixture105_test_after_role_create",
              () => {
                throw new Error("allocated bootstrap role failure");
              },
              async () => {
                await expect(isolated.bootstrap()).rejects.toThrow(
                  "allocated bootstrap role failure",
                );
              },
            );
          },
          () => isolated.shutdown(),
        );
        expect(
          (
            await requireCluster().admin.query(
              "SELECT rolname FROM pg_roles WHERE rolname=ANY($1::text[])",
              [isolated.logins],
            )
          ).rows,
        ).toEqual([]);
        expect(
          (
            await requireCluster().admin.query(
              "SELECT datname FROM pg_database WHERE datname=ANY($1::text[])",
              [isolated.names],
            )
          ).rows,
        ).toEqual([]);
      },
    ),
    LIMIT,
  );

  it(
    "retains full actual failed Claims coverage and findings in a private failure receipt",
    caseBody(
      "retains full actual failed Claims coverage and findings in a private failure receipt",
      async () => {
        const env = await fresh();
        const evaluate = claimsOwner.evaluateConnectedFixture105Component;
        let actual: ReturnType<typeof evaluate> | undefined;
        // Controlled acquisition-input defect; the real evaluator still produces every row/brand.
        // No fabricated result, admission or pass is injected.
        const observer = vi
          .spyOn(claimsOwner, "evaluateConnectedFixture105Component")
          .mockImplementation((input) => {
            actual = evaluate({
              ...input,
              statics: { ...input.statics, profiles: {} },
            });
            return actual;
          });
        let failure: ConnectedFixture105ClaimsFailure | undefined;
        try {
          try {
            await runConnectedFixture105();
            throw new Error("expected factual continuation refusal");
          } catch (error) {
            expect(error).toBeInstanceOf(ConnectedFixture105ClaimsFailure);
            if (!(error instanceof ConnectedFixture105ClaimsFailure))
              throw error;
            failure = error;
          }
        } finally {
          observer.mockRestore();
        }
        if (actual === undefined) throw new Error("actual failure not reached");
        const receivedFailure = requireClaimsFailure(failure);
        expect(receivedFailure.receipt).toMatchObject({
          rows: actual.rows,
          aggregate: actual.aggregate,
          warnings: actual.warnings,
          coverage: actual.coverage,
          preconditions: actual.preconditions,
          actual_result_sha256:
            claimsOwner.connectedFixture105ClaimsResultHash(actual),
        });
        expect(actual.rows.some((row) => row.findings.length !== 0)).toBe(true);
        await inspect(env, async (pool) => {
          const target = (
            await pool.query(
              "SELECT current_database() AS database,(SELECT oid::text FROM pg_database WHERE datname=current_database()) AS database_oid,session_user AS login,inet_server_addr()::text AS server_address,inet_server_port() AS server_port",
            )
          ).rows[0] as Obj | undefined;
          if (target === undefined) throw new Error("target missing");
          const namespace = sha256(Buffer.from(canonicalJson(target), "utf8"));
          const path = `${validateConnectedFixture105ExecutionRoot()}/receipts/${namespace}/CLAIMS-FAILURE.json`;
          expect(JSON.parse(await readFile(path, "utf8"))).toEqual(
            receivedFailure.receipt,
          );
        });
        expect(await counts(env)).toEqual({
          packages: 1,
          directions: 0,
          intents: 0,
          gates: 18,
          audits: 0,
        });
        await expectNoPerformanceArtifacts(env);
      },
    ),
    LIMIT,
  );
  it(
    "memoizes a first setup pool-end failure without another end call",
    caseBody(
      "memoizes a first setup pool-end failure without another end call",
      async () => {
        if (bootstrapUrl === undefined) throw new Error("bootstrap missing");
        const isolated = new TrackedFixtureCluster(bootstrapUrl);
        isolatedClusters.push(isolated);
        let restore: (() => void) | undefined;
        let expectedShutdown: unknown;
        let calls = 0;
        await withTestCleanup(
          async () => {
            await isolated.bootstrap();
            const env = await isolated.create({ migrate: false });
            const original = env.owner.end.bind(env.owner);
            const endFailure = new Error("controlled end completion failure");
            const endDescriptor = Object.getOwnPropertyDescriptor(
              env.owner,
              "end",
            );
            Object.defineProperty(env.owner, "end", {
              configurable: true,
              value: () => {
                calls++;
                return original().then(() => {
                  throw endFailure;
                });
              },
            });
            restore = () => {
              if (endDescriptor === undefined)
                Reflect.deleteProperty(env.owner, "end");
              else Object.defineProperty(env.owner, "end", endDescriptor);
            };
            let first: unknown;
            try {
              await isolated.settle(env.name);
              throw new Error("expected failed end");
            } catch (error) {
              first = error;
              expect(error).toBeInstanceOf(AggregateError);
            }
            await expect(isolated.settle(env.name)).rejects.toBe(first);
            try {
              await isolated.shutdown();
              throw new Error("expected shutdown failure");
            } catch (error) {
              expect(error).toBeInstanceOf(AggregateError);
              expectedShutdown = error;
            }
            expect(calls).toBe(1);
          },
          async () => {
            restore?.();
            const cleanup: unknown[] = [];
            try {
              await isolated.shutdown();
            } catch (error) {
              if (error !== expectedShutdown) cleanup.push(error);
            }
            try {
              expect(
                (
                  await requireCluster().admin.query(
                    "SELECT datname FROM pg_database WHERE datname=ANY($1::text[])",
                    [isolated.names],
                  )
                ).rows,
              ).toEqual([]);
              expect(
                (
                  await requireCluster().admin.query(
                    "SELECT rolname FROM pg_roles WHERE rolname=ANY($1::text[])",
                    [isolated.logins],
                  )
                ).rows,
              ).toEqual([]);
            } catch (error) {
              cleanup.push(error);
            }
            if (cleanup.length !== 0)
              throw new AggregateError(
                cleanup,
                "isolated shutdown or residual failure",
              );
          },
        );
      },
    ),
    LIMIT,
  );

  it(
    "preserves the old package four-round reconciliation bound under named-conflict delivery",
    caseBody(
      "preserves the old package four-round reconciliation bound under named-conflict delivery",
      async () => {
        const env = await fresh();
        await packagePrerequisites(env, false);
        const descriptor = Object.getOwnPropertyDescriptor(
          pg.Client.prototype,
          "query",
        );
        if (descriptor === undefined) throw new Error("driver unavailable");
        const original = driverQuery(descriptor);
        let inserts = 0;
        let rollbacks = 0;
        // Native reference validation/savepoints/readbacks; deterministic transport
        // delivery of the named race code, not a claim of four real concurrent races.
        Object.defineProperty(pg.Client.prototype, "query", {
          ...descriptor,
          value: async function (
            this: pg.Client,
            text: string,
            values?: unknown[],
          ): Promise<pg.QueryResult> {
            if (text.includes("INSERT INTO artifacts")) {
              inserts++;
              throw Object.assign(new Error("controlled named collision"), {
                code: "23505",
                constraint: "artifacts_pkey",
              });
            }
            if (text === "ROLLBACK") rollbacks++;
            return original.call(this, text, values);
          },
        });
        try {
          await inspect(env, async (pool) => {
            await expect(
              persistEvidencePackage(pool, packageInput()),
            ).rejects.toThrow(
              "package persistence did not settle after re-reads",
            );
            expect(pool.waitingCount).toBe(0);
            expect(pool.idleCount).toBe(pool.totalCount);
          });
        } finally {
          Object.defineProperty(pg.Client.prototype, "query", descriptor);
        }
        expect(inserts).toBe(4);
        expect(rollbacks).toBe(1);
        await inspect(env, async (pool) => {
          expect(
            (await pool.query("SELECT artifact_id FROM artifacts")).rows,
          ).toEqual([]);
          expect(
            (
              await pool.query(
                "SELECT evidence_package_id FROM evidence_packages",
              )
            ).rows,
          ).toEqual([]);
        });
      },
    ),
    LIMIT,
  );
  it(
    "preserves an unrelated package failure object and releases its transaction",
    caseBody(
      "preserves an unrelated package failure object and releases its transaction",
      async () => {
        for (const seam of ["direct", "savepoint"] as const) {
          const env = await fresh();
          await packagePrerequisites(env, false);
          const primary = new Error("controlled unrelated package failure");
          let armed = false;
          let reached = 0;
          let rollbacks = 0;
          let savepointRollbacks = 0;
          let savepointReleases = 0;
          const descriptor = Object.getOwnPropertyDescriptor(
            pg.Client.prototype,
            "query",
          );
          if (descriptor === undefined) throw new Error("driver unavailable");
          const original = driverQuery(descriptor);
          Object.defineProperty(pg.Client.prototype, "query", {
            ...descriptor,
            value: async function (
              this: pg.Client,
              text: string,
              values?: unknown[],
            ): Promise<pg.QueryResult> {
              if (armed) {
                if (text === "ROLLBACK") rollbacks++;
                if (/^ROLLBACK TO SAVEPOINT sp_[0-9]+$/u.test(text))
                  savepointRollbacks++;
                if (/^RELEASE SAVEPOINT sp_[0-9]+$/u.test(text))
                  savepointReleases++;
                const selected =
                  seam === "direct"
                    ? text.startsWith("SELECT a.artifact_id::text,") &&
                      text.endsWith(" WHERE p.package_hash = $1")
                    : text.includes("INSERT INTO artifacts");
                if (selected) {
                  reached++;
                  throw primary;
                }
              }
              return original.call(this, text, values);
            },
          });
          try {
            await inspect(env, async (pool) => {
              armed = true;
              try {
                if (seam === "direct") {
                  await expect(
                    persistEvidencePackage(pool, packageInput()),
                  ).rejects.toBe(primary);
                } else {
                  let caught: unknown;
                  try {
                    await persistEvidencePackage(pool, packageInput());
                  } catch (error) {
                    caught = error;
                  }
                  expect(caught).toBeInstanceOf(Error);
                  expect(caught).not.toBe(primary);
                  if (!(caught instanceof Error))
                    throw new Error("expected normalized package failure");
                  expect(caught.message).toBe(primary.message);
                  expect(Object.hasOwn(caught, "code")).toBe(true);
                  expect(Object.hasOwn(caught, "constraint")).toBe(true);
                  expect(Object.keys(caught).sort()).toEqual([
                    "code",
                    "constraint",
                  ]);
                  expect(
                    (caught as Error & { code?: unknown }).code,
                  ).toBeUndefined();
                  expect(
                    (caught as Error & { constraint?: unknown }).constraint,
                  ).toBeUndefined();
                }
              } finally {
                armed = false;
              }
              expect(pool.waitingCount).toBe(0);
              expect(pool.idleCount).toBe(pool.totalCount);
            });
          } finally {
            Object.defineProperty(pg.Client.prototype, "query", descriptor);
          }
          expect(reached).toBe(1);
          expect(rollbacks).toBe(1);
          expect(savepointRollbacks).toBe(seam === "savepoint" ? 1 : 0);
          expect(savepointReleases).toBe(seam === "savepoint" ? 1 : 0);
          await inspect(env, async (pool) => {
            expect(
              (await pool.query("SELECT artifact_id FROM artifacts")).rows,
            ).toEqual([]);
            expect(
              (
                await pool.query(
                  "SELECT evidence_package_id FROM evidence_packages",
                )
              ).rows,
            ).toEqual([]);
          });
          await env.close();
        }
      },
    ),
    LIMIT,
  );

  it(
    "identifies a held client while preserving target isolation refusal",
    caseBody(
      "identifies a held client while preserving target isolation refusal",
      async () => {
        const env = await fresh();
        const descriptor = Object.getOwnPropertyDescriptor(
          pg.Client.prototype,
          "query",
        );
        if (descriptor === undefined)
          throw new Error("driver method unavailable");
        const before = observedLists();
        const receipts = join(
          validateConnectedFixture105ExecutionRoot(),
          "receipts",
        );
        const beforeReceipts = readdirSync(receipts).sort();
        const holder = new pg.Client({
          connectionString: env.runtimeUrl,
          options: "-c role=desk_runtime",
          connectionTimeoutMillis: 10000,
          query_timeout: 20000,
        });
        let holderError = false;
        const onHolderError = (): void => {
          holderError = true;
        };
        holder.on("error", onHolderError);
        let pid: number | undefined;
        let rejectionIdentity = false;
        let wrapperRestored = false;
        let heldPidContinuity = false;
        let hiddenOriginProvisional = false;
        let cleanupComplete = false;
        // Cleanup is registered before connect; the holder stays live through the supplemental read.
        await withTestCleanup(
          async () => {
            expect(maintenanceLatch.used).toBe(false);
            await holder.connect();
            const identity = await holder.query<{ pid: number }>(
              "SELECT pg_backend_pid() AS pid",
            );
            expect(identity.rows).toHaveLength(1);
            pid = identity.rows[0]?.pid;
            expect(targetInt(pid, 1)).toBe(true);
            if (pid === undefined) throw new Error("held client PID missing");
            expect(holderError).toBe(false);
            const observer = new TargetObserver(
              env.name,
              "held_client_control",
              maintenanceOwner(),
            );
            let original: unknown;
            let refused = false;
            let outer: unknown;
            try {
              await observer.around(async () => {
                try {
                  await runConnectedFixture105();
                } catch (error) {
                  refused = true;
                  original = error;
                  throw error;
                }
              });
            } catch (error) {
              outer = error;
            }
            expect(refused).toBe(true);
            expect(outer === original).toBe(true);
            expect(original instanceof ConnectedFixture105Refusal).toBe(true);
            if (!(original instanceof ConnectedFixture105Refusal))
              throw new Error("held client actual refusal missing");
            expect(original.code === "fixture_target_isolation").toBe(true);
            expect(cleanupFailures.has(original)).toBe(false);
            rejectionIdentity = true;
            expect(
              Object.getOwnPropertyDescriptor(pg.Client.prototype, "query"),
            ).toEqual(descriptor);
            wrapperRestored = true;
            observer.assertHeldClient(pid);
            hiddenOriginProvisional = true;
            const continued = await holder.query<{ pid: number }>(
              "SELECT pg_backend_pid() AS pid",
            );
            expect(continued.rows).toEqual([{ pid }]);
            expect(holderError).toBe(false);
            heldPidContinuity = true;
            const after = observedLists();
            expect(after.targets.length).toBe(before.targets.length);
            expect(after.pre_target_failures.length).toBe(
              before.pre_target_failures.length + 1,
            );
          },
          async () => {
            await withTestCleanup(
              async () => {
                await withTestCleanup(
                  async () => {
                    try {
                      await holder.end(); // Exactly once; settlement alone is not a remote-termination proof.
                    } finally {
                      holder.removeListener("error", onHolderError);
                    }
                    expect(holderError).toBe(false);
                    expect(await counts(env)).toEqual({
                      packages: 0,
                      directions: 0,
                      intents: 0,
                      gates: 0,
                      audits: 0,
                    });
                    await expectConstructionRollback(env);
                    expect(
                      canonicalJson(readdirSync(receipts).sort()) ===
                        canonicalJson(beforeReceipts),
                    ).toBe(true);
                  },
                  async () => {
                    await withTestCleanup(
                      async () => {
                        await env.close();
                      },
                      async () => {
                        if (pid !== undefined) {
                          const absent = await requireCluster().admin.query<{
                            absent: boolean;
                          }>(
                            "SELECT NOT EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid = $1::integer) AS absent",
                            [pid],
                          );
                          expect(absent.rows).toEqual([{ absent: true }]);
                        } else {
                          throw new Error(
                            "held client cleanup PID unavailable",
                          );
                        }
                      },
                    );
                  },
                );
                cleanupComplete = true;
              },
              () => {
                const line = `FIXTURE_HELD_CLIENT_CONTROL ${JSON.stringify({
                  schema: "fixture-held-client-control/1",
                  case: "identifies a held client while preserving target isolation refusal",
                  rejectionIdentity,
                  wrapperRestored,
                  heldPidContinuity,
                  hiddenOriginProvisional,
                  cleanupComplete,
                })}\n`;
                if (Buffer.byteLength(line) > 1024)
                  throw new Error("held client witness bound");
                process.stderr.write(line);
                return Promise.resolve();
              },
            );
          },
        );
      },
    ),
    LIMIT,
  );
});
