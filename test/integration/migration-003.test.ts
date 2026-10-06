import { randomUUID } from "node:crypto";
import type pg from "pg";
import { spawn } from "node:child_process";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestCluster, type DbEnv } from "../support/db-env.js";
import { seedPrerequisites, attemptIds } from "../support/a5-fixture.js";
import {
  simulationPolicy,
  simulationRequest,
  invocationObservation,
  receiptPacket,
  SimulationEvidence,
} from "../support/g1-provider-admission-receipt.js";
import {
  buildCertificate,
  certificateHash,
  policyHash,
  requestHash,
  invocationHash,
  projectReceipt,
  type Certificate,
  type FinalReceipt,
  type Policy,
  type Consumption,
} from "../../src/runtime/provider-admission.js";
import { canonicalJson, sha256 } from "../../src/identity/canonical-json.js";
import type { AuthoredReservation } from "../../src/runtime/provider.js";
import {
  migrate,
  readMigrations,
  verifyMigrationIntegrity,
} from "../../src/db/migrations.js";
import { observe, bounded } from "../support/a5-crash.js";
import { g1Child } from "../support/g1-provider-process.js";

const EXACT_D_HOLDER = `SELECT a.pid FROM pg_stat_activity a JOIN pg_locks l USING(pid)
  WHERE a.datname=$1 AND a.application_name=$2 AND a.state='idle in transaction'
    AND a.backend_xid IS NOT NULL AND a.xact_start IS NOT NULL AND l.database=a.datid
    AND l.locktype='advisory' AND l.mode='ExclusiveLock' AND l.granted
    AND l.classid=182736456 AND l.objid=1 AND l.objsubid=2`;
const EXACT_D_WAITER = `SELECT a.pid,a.application_name,pg_blocking_pids(a.pid) AS blockers FROM pg_stat_activity a JOIN pg_locks l USING(pid)
  WHERE a.datname=$1 AND a.application_name=$2 AND a.pid<>$3 AND a.state='active'
    AND a.wait_event_type='Lock' AND a.wait_event='advisory' AND l.database=a.datid
    AND l.locktype='advisory' AND l.mode='ExclusiveLock' AND NOT l.granted
    AND l.classid=182736456 AND l.objid=1 AND l.objsubid=2 AND $3=ANY(pg_blocking_pids(a.pid))`;
// Local fixed JavaScript test process; stdin supplies synthetic URLs and test SQL statements. No new shared harness.
const RAW_WORKER = `import pg from 'pg';
  import {migrate} from './src/db/migrations.js';
  let input='';for await(const chunk of process.stdin)input+=chunk;
  const spec=JSON.parse(input);
  const pool=new pg.Pool({connectionString:spec.url,options:'-c role='+spec.role,application_name:spec.tag,max:1});
  let client;
  try {
    if(spec.kind==='migration')await migrate(pool,spec.directory);
    else {
      client=await pool.connect();await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await client.query("SET LOCAL statement_timeout='20s'");
      const result=await client.query(spec.sql,spec.values);
      await client.query('COMMIT');console.log('RESULT '+JSON.stringify({status:'committed',rows:result.rows}));
    }
  } catch(error) {
    if(client)await client.query('ROLLBACK');
    console.log('RESULT '+JSON.stringify({status:'refused',code:error.code,constraint:error.constraint}));process.exitCode=2;
  } finally {if(client)client.release();await pool.end();}`;
function rawWorker(spec: {
  url: string;
  role: "desk_runtime" | "desk_migrator";
  tag: string;
  kind: "sql" | "migration";
  sql?: string;
  values?: unknown[];
  directory?: string;
}) {
  const processChild = spawn(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", RAW_WORKER],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  let stdout = "",
    stderr = "";
  processChild.stdout.on("data", (b: Buffer) => {
    stdout += b.toString();
  });
  processChild.stderr.on("data", (b: Buffer) => {
    stderr += b.toString();
  });
  const closed = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    processChild.once("error", reject);
    processChild.once("close", (code, signal) => {
      resolve({ code, signal, stdout, stderr });
    });
  });
  closed.catch(() => undefined);
  const watchdog = setTimeout(() => {
    processChild.kill("SIGKILL");
  }, 30000);
  void closed.then(
    () => {
      clearTimeout(watchdog);
    },
    () => {
      clearTimeout(watchdog);
    },
  );
  processChild.stdin.end(JSON.stringify(spec));
  return {
    exit: () => bounded(closed, 35000, "only owned raw/migration child exit"),
    kill: async () => {
      processChild.kill("SIGKILL");
      return bounded(
        closed,
        5000,
        "only owned raw/migration child SIGKILL/reap",
      );
    },
  };
}
function rowStatement(row: Record<string, unknown>) {
  const columns = Object.keys(row);
  return {
    sql:
      "INSERT INTO provider_calls(" +
      columns.join(",") +
      ") VALUES(" +
      columns.map((_, i) => "$" + String(i + 1)).join(",") +
      ") RETURNING provider_call_id::text,admitted_at::text",
    values: Object.values(row).map((x) =>
      typeof x === "object" && x !== null ? JSON.stringify(x) : x,
    ),
  };
}
function settlementStatement(c: Certificate) {
  const io = invocationObservation(c, simulationRequest());
  const event = {
    provider_call_id: c.provider_call_id,
    event_type: "succeeded" as const,
    ended_at: "2026-10-06T00:00:01.000001Z",
    usage: { input_bytes: 2, output_bytes: 1 },
    actual_cost: "0.02",
    currency: "USD",
    response_artifact_id: null,
    response_reference: null,
  };
  const fr: FinalReceipt = {
    schema: "g1-sim-final-receipt/1",
    receipt_id: randomUUID(),
    kind: "final_accounting",
    invocation_observation_hash: invocationHash(io),
    attribution: io.attribution,
    consumption: io.consumption,
    work_ended: true,
    observed_output_bytes: 1,
    price_status: "known_final",
    event,
  };
  const settlement = projectReceipt(receiptPacket(io, fr), c).settlement;
  return {
    sql: "INSERT INTO provider_call_events(provider_call_id,event_type,ended_at,usage,actual_cost,currency,response_artifact_id,response_reference,admission_settlement) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING provider_call_id::text,recorded_at::text",
    values: [
      c.provider_call_id,
      event.event_type,
      event.ended_at,
      JSON.stringify(event.usage),
      event.actual_cost,
      event.currency,
      null,
      null,
      JSON.stringify(settlement),
    ],
  };
}
async function copyMigrations(include003: boolean, tail = "") {
  const directory = await mkdtemp(join(tmpdir(), "desk-g1-b-migration-proof-"));
  const names = [
    "001_foundation.sql",
    "002_persistence_profile.sql",
    ...(include003 ? ["003_provider_admission.sql"] : []),
  ];
  for (const name of names) {
    const source = await readFile("migrations/" + name);
    await writeFile(
      join(directory, name),
      tail && name === "003_provider_admission.sql"
        ? Buffer.concat([source, Buffer.from(tail)])
        : source,
      { flag: "wx" },
    );
  }
  return directory;
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("expected PostgreSQL JSON object");
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    throw new Error("expected plain PostgreSQL JSON object");
  return value as Record<string, unknown>;
}

function requiredString(value: unknown): string {
  if (typeof value !== "string")
    throw new Error("expected fixture JSON string");
  return value;
}
function requiredChild<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("expected owned child");
  return value;
}
const target = process.env.TEST_DATABASE_URL;
const suite = target ? describe : describe.skip;
let cluster: TestCluster | undefined;
const callRow = async (
  env: DbEnv,
  policy: Policy = simulationPolicy(),
  identity: Partial<AuthoredReservation> = {},
): Promise<Record<string, unknown>> => {
  const request = simulationRequest(),
    attempt = identity.attempt_id ?? attemptIds()[0];
  if (!attempt) throw new Error("attempt missing");
  const run = (
    await env.runtime.query<{ id: string }>(
      "SELECT program_run_id::text AS id FROM program_run_attempts WHERE attempt_id=$1",
      [attempt],
    )
  ).rows[0]?.id;
  if (typeof run !== "string")
    throw new Error("expected actual attempt run identity");
  const authored: AuthoredReservation = {
    provider_call_id: randomUUID(),
    attempt_id: attempt,
    provider: "g1-simulator",
    operation: "g1_sim_text",
    model_identifier: "bytes-v1",
    request_fingerprint: requestHash(request),
    logical_request_key: "sql:" + randomUUID(),
    operational_try_number: 1,
    intentional_take_index: null,
    retry_of_provider_call_id: null,
    reroll_of_provider_call_id: null,
    reroll_trigger_id: null,
    started_at: "2026-10-06T00:00:00.000001Z",
    ...identity,
  };
  const cert = buildCertificate(authored, run, policy, request);
  return {
    ...authored,
    reserved_cost_upper_bound: cert.reserved_cost_upper_bound,
    admission_currency: policy.currency,
    admission_policy_hash: policyHash(policy),
    admission_certificate: cert,
    admission_certificate_hash: certificateHash(cert),
  };
};
const insertRow = async (
  env: DbEnv,
  row: Record<string, unknown>,
  connection: pg.Pool | pg.PoolClient = env.runtime,
) => {
  const cols = Object.keys(row);
  return connection.query<{
    provider_call_id: string;
    admitted_at: string | null;
    reserved_cost_upper_bound: string | null;
    admission_certificate: unknown;
    admission_policy_hash: string | null;
  }>(
    "INSERT INTO provider_calls(" +
      cols.join(",") +
      ") VALUES(" +
      cols.map((_, i) => "$" + String(i + 1)).join(",") +
      ") RETURNING provider_call_id::text,admitted_at::text,reserved_cost_upper_bound::text,admission_certificate,admission_policy_hash",
    Object.values(row).map((x) =>
      typeof x === "object" && x !== null ? JSON.stringify(x) : x,
    ),
  );
};
const insert = async (env: DbEnv, changes: Record<string, unknown> = {}) =>
  insertRow(env, { ...(await callRow(env)), ...changes });
async function settle(
  env: DbEnv,
  certificate: Certificate,
  options: {
    workEnded?: boolean | null;
    cost?: string | null;
    currency?: string | null;
    eventType?: "succeeded" | "retryable_failure";
    consumption?: Partial<Consumption>;
    output?: number;
    rawCost?: string;
  } = {},
) {
  const io = invocationObservation(certificate, simulationRequest());
  io.consumption = { ...io.consumption, ...options.consumption };
  const output = options.output ?? 1,
    cost = options.cost === undefined ? "0.02" : options.cost;
  const event = {
    provider_call_id: certificate.provider_call_id,
    event_type: options.eventType ?? "succeeded",
    ended_at: "2026-10-06T00:00:01.000001Z",
    usage: { input_bytes: io.consumption.input_bytes, output_bytes: output },
    actual_cost: cost,
    currency: cost === null ? null : (options.currency ?? "USD"),
    response_artifact_id: null,
    response_reference: "truthful-é",
  };
  const fr: FinalReceipt = {
    schema: "g1-sim-final-receipt/1",
    receipt_id: randomUUID(),
    kind: "final_accounting",
    invocation_observation_hash: invocationHash(io),
    attribution: io.attribution,
    consumption: io.consumption,
    work_ended: options.workEnded === undefined ? true : options.workEnded,
    observed_output_bytes: output,
    price_status: cost === null ? "unknown_final" : "known_final",
    event,
  };
  const projected = projectReceipt(receiptPacket(io, fr), certificate);
  await env.runtime.query(
    "INSERT INTO provider_call_events(provider_call_id,event_type,ended_at,usage,actual_cost,currency,response_artifact_id,response_reference,admission_settlement) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [
      event.provider_call_id,
      event.event_type,
      event.ended_at,
      JSON.stringify(event.usage),
      options.rawCost ?? event.actual_cost,
      event.currency,
      event.response_artifact_id,
      event.response_reference,
      JSON.stringify(projected.settlement),
    ],
  );
  return event;
}
async function ledgerDigest(env: DbEnv): Promise<string> {
  return JSON.stringify(
    (
      await env.owner.query(
        "SELECT * FROM (SELECT 'call' AS kind,to_jsonb(c) AS value,xmin::text,ctid::text FROM provider_calls c UNION ALL SELECT 'event',to_jsonb(e),xmin::text,ctid::text FROM provider_call_events e) history ORDER BY kind,value::text",
      )
    ).rows,
  );
}

// Test-only data wrapper. The candidate SELECT bytes are extracted unchanged, not translated into TS/hand-copied SQL.
async function temporalWrapper(client: pg.PoolClient): Promise<void> {
  const migration = await readFile(
    new URL("../../migrations/003_provider_admission.sql", import.meta.url),
    "utf8",
  );
  const begin = "  -- G1_TEMPORAL_ADMISSION_BEGIN\n",
    end = "  -- G1_TEMPORAL_ADMISSION_END";
  expect(migration.split(begin)).toHaveLength(2);
  expect(migration.split(end)).toHaveLength(2);
  const start = migration.indexOf(begin) + begin.length,
    finish = migration.indexOf(end);
  expect(finish).toBeGreaterThan(start);
  const select = migration.slice(start, finish);
  expect(select.startsWith("  WITH history AS (\n")).toBe(true);
  expect(select.endsWith("  FROM history\n")).toBe(true);
  await client.query(`CREATE TEMP TABLE provider_calls AS SELECT * FROM public.provider_calls WITH NO DATA;
    CREATE TEMP TABLE provider_call_events AS SELECT * FROM public.provider_call_events WITH NO DATA;
    CREATE TEMP TABLE program_run_attempts(attempt_id uuid,program_run_id uuid);
    CREATE FUNCTION pg_temp.g1_temporal(t timestamptz,target_attempt uuid,target_run uuid,candidate_bound numeric,p jsonb,rule jsonb,candidate_retry uuid,candidate_try integer)
    RETURNS TABLE(attempt_excess boolean,run_excess boolean,day_excess boolean,reservation_excess boolean,retry_excess boolean,concurrency_excess boolean,rate_excess boolean,spacing_excess boolean,clock_reversed boolean)
    LANGUAGE plpgsql SET search_path=pg_temp,pg_catalog AS $oracle$
    DECLARE NEW record;
    BEGIN SELECT candidate_retry AS retry_of_provider_call_id,candidate_try AS operational_try_number INTO NEW;
      RETURN QUERY\n${select};
    END $oracle$;`);
}
async function breachWrapper(client: pg.PoolClient) {
  const sql = await readFile("migrations/003_provider_admission.sql", "utf8");
  const begin =
    "  IF EXISTS(SELECT 1 FROM provider_call_events e JOIN provider_calls c USING(provider_call_id)\n";
  const end =
    "\n    RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_breach';";
  expect(sql.split(begin)).toHaveLength(2);
  expect(sql.split(end)).toHaveLength(2);
  const start = sql.indexOf(begin) + "  IF ".length,
    finish = sql.indexOf(end);
  expect(finish).toBeGreaterThan(start);
  const clause = sql.slice(start, finish);
  expect(clause.endsWith(" THEN")).toBe(true);
  const expression = clause.slice(0, -" THEN".length);
  expect(
    expression.startsWith("EXISTS(SELECT 1 FROM provider_call_events"),
  ).toBe(true);
  // Only PL/pgSQL's IF/THEN framing is removed. Every predicate/cast/operator/alias byte is retained.
  await client.query(`CREATE FUNCTION pg_temp.g1_retained_breach() RETURNS boolean LANGUAGE sql
    SET search_path=pg_temp,pg_catalog AS $breach$ SELECT ${expression} $breach$`);
  return expression;
}
async function historicalValues(env: DbEnv) {
  const tables = (
    await env.owner.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows;
  const output: unknown[] = [];
  for (const { tablename } of tables) {
    const additions =
      tablename === "provider_calls"
        ? [
            "admitted_at",
            "reserved_cost_upper_bound",
            "admission_currency",
            "admission_policy_hash",
            "admission_certificate",
            "admission_certificate_hash",
          ]
        : tablename === "provider_call_events"
          ? ["recorded_at", "admission_settlement"]
          : [];
    output.push([
      tablename,
      (
        await env.owner.query(
          `SELECT to_jsonb(t)-$1::text[] AS row,xmin::text,ctid::text FROM "${tablename}" t ORDER BY (to_jsonb(t)-$1::text[])::text`,
          [additions],
        )
      ).rows,
    ]);
  }
  return output;
}
async function migrationRows(env: DbEnv) {
  return (
    await env.owner.query<{ row: unknown; xmin: string; ctid: string }>(
      "SELECT to_jsonb(m) AS row,xmin::text,ctid::text FROM desk_internal.schema_migrations m ORDER BY migration_name",
    )
  ).rows;
}
async function allPublicValues(env: DbEnv) {
  const tables = (
    await env.owner.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows;
  const values: unknown[] = [];
  for (const { tablename } of tables)
    values.push([
      tablename,
      (
        await env.owner.query(
          `SELECT to_jsonb(t) AS row,xmin::text,ctid::text FROM "${tablename}" t ORDER BY to_jsonb(t)::text`,
        )
      ).rows,
    ]);
  return values;
}
async function expectNo003(env: DbEnv) {
  expect(
    (
      await env.owner.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('provider_calls','provider_call_events') AND column_name IN ('admitted_at','reserved_cost_upper_bound','admission_currency','admission_policy_hash','admission_certificate','admission_certificate_hash','recorded_at','admission_settlement')",
      )
    ).rows[0]?.n,
  ).toBe(0);
  expect(
    (
      await env.owner.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM desk_internal.schema_migrations WHERE migration_name='003_provider_admission.sql'",
      )
    ).rows[0]?.n,
  ).toBe(0);
  expect(
    (
      await env.owner.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY($1::text[])",
        [
          [
            "guard_provider_installation_insert",
            "guard_provider_admission",
            "guard_provider_settlement",
          ],
        ],
      )
    ).rows[0]?.n,
  ).toBe(0);
}
interface TemporalRow {
  admitted: string;
  cost?: string | null;
  bound?: string;
  recorded?: string;
  provider?: string;
  attempt?: "target" | "sibling" | "other-run";
}
interface TemporalCase {
  name: string;
  t: string;
  rows: TemporalRow[];
  day?: string;
  attemptCeiling?: string;
  runCeiling?: string;
  rate?: number;
  providerRate?: number;
  spacing?: number;
  providerSpacing?: number;
  concurrency?: number;
  providerConcurrency?: number;
  expected: Partial<Record<string, boolean>>;
}
const temporalCases: TemporalCase[] = [
  {
    name: "UTC year midnight minus one microsecond excludes tomorrow",
    t: "2026-12-31T23:59:59.999999Z",
    rows: [{ admitted: "2027-01-01T00:00:00.000000Z", cost: "0.03" }],
    day: "0.05",
    expected: { clock_reversed: true, spacing_excess: true },
  },
  {
    name: "UTC year midnight excludes prior-day settled actual",
    t: "2027-01-01T00:00:00.000000Z",
    rows: [{ admitted: "2026-12-31T23:59:59.999999Z", cost: "0.03" }],
    day: "0.05",
    expected: {},
  },
  {
    name: "UTC year midnight includes exact current-day admission",
    t: "2027-01-01T00:00:00.000000Z",
    rows: [{ admitted: "2027-01-01T00:00:00.000000Z", cost: "0.03" }],
    day: "0.05",
    expected: { day_excess: true },
  },
  {
    name: "UTC midnight plus one microsecond retains current-day actual",
    t: "2027-01-01T00:00:00.000001Z",
    rows: [{ admitted: "2027-01-01T00:00:00.000000Z", cost: "0.03" }],
    day: "0.05",
    expected: { day_excess: true },
  },
  {
    name: "prior-day no event carries immutable B",
    t: "2027-01-01T00:00:00.000001Z",
    rows: [{ admitted: "2026-12-30T00:00:00.000000Z" }],
    day: "0.05",
    expected: { day_excess: true },
  },
  {
    name: "prior-day final-null carries B once",
    t: "2027-01-01T00:00:00.000001Z",
    rows: [{ admitted: "2026-12-30T00:00:00.000000Z", cost: null }],
    day: "0.06",
    expected: {},
  },
  {
    name: "today final-null is not double counted",
    t: "2027-01-01T00:00:00.000001Z",
    rows: [{ admitted: "2027-01-01T00:00:00.000000Z", cost: null }],
    day: "0.06",
    expected: {},
  },
  {
    name: "today actual replaces B exactly",
    t: "2027-01-01T00:00:00.000001Z",
    rows: [
      { admitted: "2027-01-01T00:00:00.000000Z", cost: "0.02", bound: "0.03" },
    ],
    day: "0.05",
    expected: {},
  },
  {
    name: "mixed prior settled plus old/current unknown charges disjoint populations",
    t: "2027-01-01T00:00:00.000001Z",
    rows: [
      { admitted: "2026-12-30T00:00:00.000000Z", cost: "0.02" },
      { admitted: "2026-12-30T00:00:00.000000Z", cost: null },
      { admitted: "2027-01-01T00:00:00.000000Z" },
    ],
    day: "0.09",
    expected: {},
  },
  {
    name: "attempt retains all prior-day actual history",
    t: "2027-01-01T00:00:00.000001Z",
    rows: [{ admitted: "2026-12-30T00:00:00.000000Z", cost: "0.03" }],
    attemptCeiling: "0.05",
    expected: { attempt_excess: true },
  },
  {
    name: "sibling attempt contributes to shared run not target attempt",
    t: "2027-01-01T00:00:00.000001Z",
    rows: [
      {
        admitted: "2026-12-30T00:00:00.000000Z",
        cost: "0.03",
        attempt: "sibling",
      },
    ],
    attemptCeiling: "0.05",
    runCeiling: "0.05",
    expected: { run_excess: true },
  },
  {
    name: "another run does not enter scoped attempt/run sums",
    t: "2027-01-01T00:00:00.000001Z",
    rows: [
      {
        admitted: "2026-12-30T00:00:00.000000Z",
        cost: "0.03",
        attempt: "other-run",
      },
    ],
    attemptCeiling: "0.05",
    runCeiling: "0.05",
    expected: {},
  },
  {
    name: "rolling lower endpoint excluded",
    t: "2027-01-01T00:00:10.000000Z",
    rows: [{ admitted: "2027-01-01T00:00:00.000000Z" }],
    rate: 1,
    expected: {},
  },
  {
    name: "rolling lower endpoint plus one microsecond included",
    t: "2027-01-01T00:00:10.000000Z",
    rows: [{ admitted: "2027-01-01T00:00:00.000001Z" }],
    rate: 1,
    expected: { rate_excess: true },
  },
  {
    name: "rolling upper endpoint included",
    t: "2027-01-01T00:00:10.000000Z",
    rows: [{ admitted: "2027-01-01T00:00:10.000000Z" }],
    rate: 1,
    expected: { rate_excess: true },
  },
  {
    name: "rolling future excluded and backward clock refused",
    t: "2027-01-01T00:00:10.000000Z",
    rows: [{ admitted: "2027-01-01T00:00:10.000001Z" }],
    rate: 1,
    expected: { clock_reversed: true, spacing_excess: true },
  },
  {
    name: "spacing below bound by one microsecond refuses",
    t: "2027-01-01T00:00:00.499999Z",
    rows: [{ admitted: "2027-01-01T00:00:00.000000Z" }],
    spacing: 500,
    expected: { spacing_excess: true },
  },
  {
    name: "spacing exact equality passes",
    t: "2027-01-01T00:00:00.500000Z",
    rows: [{ admitted: "2027-01-01T00:00:00.000000Z" }],
    spacing: 500,
    expected: {},
  },
  {
    name: "spacing above bound by one microsecond passes",
    t: "2027-01-01T00:00:00.500001Z",
    rows: [{ admitted: "2027-01-01T00:00:00.000000Z" }],
    spacing: 500,
    expected: {},
  },
  {
    name: "event watermark above sample refuses",
    t: "2027-01-01T00:00:00.000000Z",
    rows: [
      {
        admitted: "2026-12-31T23:59:59.999999Z",
        cost: "0.02",
        recorded: "2027-01-01T00:00:00.000001Z",
      },
    ],
    expected: { clock_reversed: true },
  },
  {
    name: "event watermark equal sample passes",
    t: "2027-01-01T00:00:00.000000Z",
    rows: [
      {
        admitted: "2026-12-31T23:59:59.999999Z",
        cost: "0.02",
        recorded: "2027-01-01T00:00:00.000000Z",
      },
    ],
    expected: {},
  },
  {
    name: "truthful earlier event timestamp retained in data and does not replace later admission watermark",
    t: "2027-01-01T00:00:00.000000Z",
    rows: [
      {
        admitted: "2027-01-01T00:00:00.000000Z",
        cost: "0.02",
        recorded: "2026-12-31T23:59:59.999999Z",
      },
    ],
    expected: {},
  },
  {
    name: "global rate counts another provider while provider rate does not",
    t: "2027-01-01T00:00:10.000000Z",
    rows: [{ admitted: "2027-01-01T00:00:09.000000Z", provider: "other" }],
    rate: 1,
    providerRate: 100,
    expected: { rate_excess: true },
  },
  {
    name: "provider rate excludes another provider despite its tighter limit",
    t: "2027-01-01T00:00:10.000000Z",
    rows: [{ admitted: "2027-01-01T00:00:09.000000Z", provider: "other" }],
    rate: 100,
    providerRate: 1,
    expected: {},
  },
  {
    name: "provider rate includes own provider with ample global headroom",
    t: "2027-01-01T00:00:10.000000Z",
    rows: [{ admitted: "2027-01-01T00:00:09.000000Z" }],
    rate: 100,
    providerRate: 1,
    expected: { rate_excess: true },
  },
  {
    name: "global spacing includes another provider",
    t: "2027-01-01T00:00:00.499999Z",
    rows: [{ admitted: "2027-01-01T00:00:00.000000Z", provider: "other" }],
    spacing: 500,
    providerSpacing: 0,
    expected: { spacing_excess: true },
  },
  {
    name: "provider spacing excludes another provider",
    t: "2027-01-01T00:00:00.499999Z",
    rows: [{ admitted: "2027-01-01T00:00:00.000000Z", provider: "other" }],
    spacing: 0,
    providerSpacing: 500,
    expected: {},
  },
  {
    name: "provider spacing includes own provider independently",
    t: "2027-01-01T00:00:00.499999Z",
    rows: [{ admitted: "2027-01-01T00:00:00.000000Z" }],
    spacing: 0,
    providerSpacing: 500,
    expected: { spacing_excess: true },
  },
  {
    name: "global occupancy counts another provider",
    t: "2027-01-01T00:00:10.000000Z",
    rows: [{ admitted: "2027-01-01T00:00:09.000000Z", provider: "other" }],
    concurrency: 1,
    providerConcurrency: 100,
    expected: { concurrency_excess: true },
  },
  {
    name: "provider occupancy excludes another provider",
    t: "2027-01-01T00:00:10.000000Z",
    rows: [{ admitted: "2027-01-01T00:00:09.000000Z", provider: "other" }],
    concurrency: 100,
    providerConcurrency: 1,
    expected: {},
  },
  {
    name: "provider occupancy includes own provider independently",
    t: "2027-01-01T00:00:10.000000Z",
    rows: [{ admitted: "2027-01-01T00:00:09.000000Z" }],
    concurrency: 100,
    providerConcurrency: 1,
    expected: { concurrency_excess: true },
  },
  {
    name: "very old unresolved history remains occupied and exposed",
    t: "2027-01-01T00:00:10.000000Z",
    rows: [{ admitted: "2000-01-01T00:00:00.000000Z" }],
    day: "0.05",
    concurrency: 1,
    expected: { day_excess: true, concurrency_excess: true },
  },
  {
    name: "lower common calendar bound equality",
    t: "0001-01-01T00:00:00.000000Z",
    rows: [{ admitted: "0001-01-01T00:00:00.000000Z", cost: "0.02" }],
    day: "0.05",
    expected: {},
  },
  {
    name: "upper common calendar bound equality",
    t: "9999-12-31T23:59:59.999999Z",
    rows: [{ admitted: "9999-12-31T23:59:59.999999Z", cost: "0.02" }],
    day: "0.05",
    expected: {},
  },
];
suite("G1-B invoker migration feasibility", () => {
  beforeAll(async () => {
    if (!target) throw new Error("explicit database target required");
    cluster = new TestCluster(target);
    await cluster.bootstrap();
  }, 120000);
  afterAll(async () => {
    await cluster?.shutdown();
  }, 120000);
  const fresh = async () => {
    if (!cluster) throw new Error("test cluster not initialized");
    const env = await cluster.create({ migrate: true });
    await seedPrerequisites(env.migrator);
    return env;
  };
  const violations: {
    name: string;
    consumption?: Partial<Consumption>;
    cost?: string;
    currency?: string;
    output?: number;
    expected: string[];
  }[] = [
    {
      name: "same-length wrong consumed input",
      consumption: { input_text_hash: sha256(Buffer.from("cd")) },
      expected: ["input_hash_mismatch"],
    },
    {
      name: "fewer actual input bytes",
      consumption: { input_bytes: 1 },
      expected: ["input_count_mismatch"],
    },
    {
      name: "changed consumed cap",
      consumption: { consumed_output_cap: 2 },
      expected: ["output_cap_mismatch"],
    },
    {
      name: "different measured request fingerprint",
      consumption: { computed_request_fingerprint: "b".repeat(64) },
      expected: ["request_fingerprint_mismatch"],
    },
    {
      name: "different certificate consumption fact",
      consumption: { consumed_certificate_hash: "c".repeat(64) },
      expected: ["certificate_mismatch"],
    },
    {
      name: "output beyond original and consumed caps",
      output: 4,
      expected: ["output_over_cap"],
    },
    {
      name: "truthful over-bound actual",
      cost: "0.031",
      expected: ["actual_above_bound"],
    },
    {
      name: "truthful foreign currency",
      currency: "EUR",
      expected: ["foreign_currency"],
    },
    {
      name: "over-bound plus consumed input mismatch",
      cost: "0.031",
      consumption: { input_bytes: 1 },
      expected: ["input_count_mismatch", "actual_above_bound"],
    },
  ];
  it.each(violations)(
    "SQL retains $name unchanged and blocks later admission before available sums/capacity could permit it",
    async (c) => {
      const env = await fresh(),
        policy = structuredClone(simulationPolicy());
      policy.attempt_cost_ceiling = "100";
      policy.run_cost_ceiling = "100";
      policy.utc_day_cost_ceiling = "100";
      policy.max_concurrent_global = 10;
      policy.provider_rule.max_concurrent = 10;
      const row = await callRow(env, policy),
        reserved = await insertRow(env, row),
        cert = reserved.rows[0]?.admission_certificate as Certificate;
      // Another unresolved row is retained: settled actual replaces only its own B, never every pending exposure.
      await insertRow(env, await callRow(env, policy));
      const originalCalls = (
        await env.owner.query(
          "SELECT to_jsonb(c) AS value,xmin::text,ctid::text FROM provider_calls c ORDER BY provider_call_id",
        )
      ).rows;
      const event = await settle(env, cert, {
        ...c,
        rawCost: c.cost ?? "0.0200",
      });
      const result = (
        await env.owner.query<{
          actual_cost: string | null;
          currency: string | null;
          usage: unknown;
          admission_settlement: unknown;
        }>(
          "SELECT actual_cost::text,currency,usage,admission_settlement FROM provider_call_events WHERE provider_call_id=$1",
          [cert.provider_call_id],
        )
      ).rows[0];
      expect(result?.actual_cost).toBe(c.cost ?? "0.0200");
      expect(result?.currency).toBe(event.currency);
      expect(result?.usage).toEqual(event.usage);
      expect(jsonObject(result?.admission_settlement).violations).toEqual(
        c.expected,
      );
      expect(jsonObject(result?.admission_settlement).work_ended).toBe(true);
      expect(
        (
          await env.owner.query(
            "SELECT to_jsonb(c) AS value,xmin::text,ctid::text FROM provider_calls c ORDER BY provider_call_id",
          )
        ).rows,
      ).toEqual(originalCalls);
      const before = await ledgerDigest(env);
      for (let reread = 0; reread < 2; reread++) {
        await expect(
          insertRow(env, await callRow(env, policy)),
        ).rejects.toMatchObject({
          code: "23514",
          constraint: "provider_admission_breach",
        });
        expect(await ledgerDigest(env)).toBe(before);
      }
    },
    120000,
  );
  it.each([false, null, true] as const)(
    "certified retry requires positive work-ended=%s independently of known money/headroom",
    async (workEnded) => {
      const env = await fresh(),
        policy = structuredClone(simulationPolicy());
      policy.max_concurrent_global = 1;
      policy.provider_rule.max_concurrent = 1;
      const first = await callRow(env, policy);
      await insertRow(env, first);
      const cert = first.admission_certificate as Certificate;
      await settle(env, cert, { workEnded, eventType: "retryable_failure" });
      const before = await ledgerDigest(env),
        retry = await callRow(env, policy, {
          logical_request_key: cert.logical_request_key,
          operational_try_number: 2,
          retry_of_provider_call_id: cert.provider_call_id,
        });
      if (workEnded === true)
        expect((await insertRow(env, retry)).rowCount).toBe(1);
      else {
        await expect(insertRow(env, retry)).rejects.toMatchObject({
          code: "23514",
          constraint: "provider_admission_retry_work_not_ended",
        });
        expect(await ledgerDigest(env)).toBe(before);
        await expect(
          insertRow(env, await callRow(env, policy)),
        ).rejects.toMatchObject({
          constraint: "provider_admission_concurrency_limit",
        });
        expect(await ledgerDigest(env)).toBe(before);
      }
    },
    120000,
  );
  it("unknown final price with positive completion frees capacity but B survives exactly once", async () => {
    const env = await fresh(),
      policy = structuredClone(simulationPolicy());
    policy.max_concurrent_global = 1;
    policy.provider_rule.max_concurrent = 1;
    const first = await callRow(env, policy);
    await insertRow(env, first);
    await settle(env, first.admission_certificate as Certificate, {
      cost: null,
      workEnded: true,
    });
    const second = await callRow(env, policy);
    expect((await insertRow(env, second)).rowCount).toBe(1);
    const before = await ledgerDigest(env);
    await expect(
      insertRow(env, await callRow(env, policy)),
    ).rejects.toMatchObject({ constraint: "provider_admission_attempt_cost" });
    expect(await ledgerDigest(env)).toBe(before);
    expect(
      (
        await env.owner.query(
          "SELECT actual_cost,currency,admission_settlement->'work_ended' AS ended FROM provider_call_events",
        )
      ).rows[0],
    ).toEqual({ actual_cost: null, currency: null, ended: true });
  }, 120000);
  it.each(["commit", "rollback"] as const)(
    "ordinary runtime writers really block; winner %s is visible and waiter samples DB clock after release",
    async (disposition) => {
      const env = await fresh(),
        winning = await callRow(env),
        waiting = await callRow(env),
        next = await callRow(env);
      const winner = await env.runtime.connect(),
        waiter = await env.runtime.connect();
      let pending: Promise<pg.QueryResult> | undefined;
      try {
        const holderTag = "raw-D-holder-" + randomUUID(),
          waiterTag = "raw-D-waiter-" + randomUUID();
        await winner.query("SELECT set_config('application_name',$1,false)", [
          holderTag,
        ]);
        await waiter.query("SELECT set_config('application_name',$1,false)", [
          waiterTag,
        ]);
        await winner.query("BEGIN ISOLATION LEVEL READ COMMITTED");
        await waiter.query("BEGIN ISOLATION LEVEL READ COMMITTED");
        await waiter.query("SET LOCAL statement_timeout='20s'");
        const waiterPid = (
          await waiter.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
        ).rows[0]?.pid;
        if (waiterPid === undefined)
          throw new Error("migration test required scalar missing");
        await winner.query("SELECT pg_advisory_xact_lock(182736456,1)");
        await insertRow(env, winning, winner);
        const holder = (
          await env.owner.query<{ pid: number }>(EXACT_D_HOLDER, [
            env.name,
            holderTag,
          ])
        ).rows;
        expect(holder).toHaveLength(1);
        const holderPid = holder[0]?.pid;
        if (holderPid === undefined)
          throw new Error("exact named raw holder missing");
        expect(waiterPid).not.toBe(holderPid);
        pending = insertRow(env, waiting, waiter);
        pending.catch(() => undefined);
        const end = Date.now() + 10000;
        let observed = false;
        while (Date.now() < end) {
          const lock = await env.owner.query<{
            pid: number;
            blockers: number[];
          }>(EXACT_D_WAITER, [env.name, waiterTag, holderPid]);
          if (lock.rowCount === 1) {
            expect(lock.rows[0]?.pid).toBe(waiterPid);
            expect(lock.rows[0]?.blockers).toContain(holderPid);
            observed = true;
            break;
          }
          await new Promise<void>((resolve) => setTimeout(resolve, 10));
        }
        expect(observed).toBe(true);
        expect(
          (
            await env.owner.query<{ n: number }>(
              "SELECT count(*)::int AS n FROM provider_calls",
            )
          ).rows[0]?.n,
        ).toBe(0); // Winner is not committed.
        const releasedAfter = (
          await env.owner.query<{ t: string }>(
            "SELECT clock_timestamp()::text AS t",
          )
        ).rows[0]?.t;
        if (releasedAfter === undefined)
          throw new Error("migration test required scalar missing");
        await winner.query(disposition === "commit" ? "COMMIT" : "ROLLBACK");
        const inserted = await pending;
        expect(inserted.rowCount).toBe(1);
        await waiter.query("COMMIT");
        const facts = await env.owner.query<{
          provider_call_id: string;
          sampled_after_release: boolean | null;
          admission_certificate: unknown;
          admission_certificate_hash: string | null;
        }>(
          "SELECT provider_call_id::text,admitted_at >= $1::timestamptz AND admitted_at <= clock_timestamp() AS sampled_after_release,admission_certificate,admission_certificate_hash FROM provider_calls ORDER BY provider_call_id",
          [releasedAfter],
        );
        expect(facts.rowCount).toBe(disposition === "commit" ? 2 : 1);
        const waited = facts.rows.find(
          (row) => row.provider_call_id === waiting.provider_call_id,
        );
        expect(waited?.sampled_after_release).toBe(true);
        expect(waited?.admission_certificate).toEqual(
          waiting.admission_certificate,
        );
        expect(waited?.admission_certificate_hash).toBe(
          waiting.admission_certificate_hash,
        );
        expect(
          facts.rows.some(
            (row) => row.provider_call_id === winning.provider_call_id,
          ),
        ).toBe(disposition === "commit");
        if (disposition === "commit")
          await expect(insertRow(env, next, waiter)).rejects.toMatchObject({
            constraint: "provider_admission_attempt_cost",
          });
        else expect((await insertRow(env, next, waiter)).rowCount).toBe(1);
      } finally {
        // Settle only our queued query before releasing its client; never release an active connection.
        await winner.query("ROLLBACK");
        if (pending) await pending.catch(() => undefined);
        await waiter.query("ROLLBACK");
        winner.release();
        waiter.release();
      }
    },
    120000,
  );
  it("multirow insertion sees already processed rows without assuming VALUES order; excess rolls back the whole statement", async () => {
    const env = await fresh(),
      rows = await Promise.all([callRow(env), callRow(env), callRow(env)]),
      columns = Object.keys(rows.at(0) ?? {});
    const statement = (population: Record<string, unknown>[]) => {
      const values: unknown[] = [];
      const tuples = population.map(
        (row) =>
          "(" +
          columns
            .map((column) => {
              const value = row[column];
              values.push(
                typeof value === "object" && value !== null
                  ? JSON.stringify(value)
                  : value,
              );
              return "$" + String(values.length);
            })
            .join(",") +
          ")",
      );
      return env.runtime.query<{
        provider_call_id: string;
        admitted_at: string | null;
      }>(
        "INSERT INTO provider_calls(" +
          columns.join(",") +
          ") VALUES " +
          tuples.join(",") +
          " RETURNING provider_call_id::text,admitted_at::text",
        values,
      );
    };
    await expect(statement(rows)).rejects.toMatchObject({
      code: "23514",
      constraint: "provider_admission_attempt_cost",
    });
    expect(
      (
        await env.owner.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM provider_calls",
        )
      ).rows[0]?.n,
    ).toBe(0);
    const bracket = (
      await env.owner.query<{ t: string }>(
        "SELECT clock_timestamp()::text AS t",
      )
    ).rows[0]?.t;
    if (bracket === undefined)
      throw new Error("migration test required scalar missing");
    const pair = rows.slice(0, 2),
      result = await statement(pair);
    expect(result.rowCount).toBe(2);
    expect(result.rows.map((row) => row.provider_call_id).sort()).toEqual(
      pair.map((row) => row.provider_call_id).sort(),
    );
    expect(
      (
        await env.owner.query<{ bracketed: boolean | null }>(
          "SELECT bool_and(admitted_at >= $1::timestamptz AND admitted_at <= clock_timestamp()) AS bracketed FROM provider_calls",
          [bracket],
        )
      ).rows[0]?.bracketed,
    ).toBe(true);
    await expect(insert(env)).rejects.toMatchObject({
      constraint: "provider_admission_attempt_cost",
    });
  }, 120000);
  it("exact extracted temporal expressions satisfy independently specified microsecond endpoints in non-UTC session", async () => {
    const env = await fresh(),
      client = await env.owner.connect();
    const attempt = randomUUID(),
      run = randomUUID(),
      sibling = randomUUID(),
      other = randomUUID(),
      otherRun = randomUUID();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL TIME ZONE 'America/Los_Angeles'");
      await temporalWrapper(client);
      await client.query(
        "INSERT INTO pg_temp.program_run_attempts VALUES($1,$2),($3,$2),($4,$5)",
        [attempt, run, sibling, other, otherRun],
      );
      for (const c of temporalCases) {
        await client.query(
          "TRUNCATE pg_temp.provider_calls,pg_temp.provider_call_events",
        );
        for (const row of c.rows) {
          const id = randomUUID();
          await client.query(
            "INSERT INTO pg_temp.provider_calls(provider_call_id,attempt_id,provider,admitted_at,reserved_cost_upper_bound,admission_currency) VALUES($1,$2,$3,$4,$5,'USD')",
            [
              id,
              row.attempt === "sibling"
                ? sibling
                : row.attempt === "other-run"
                  ? other
                  : attempt,
              row.provider ?? "g1-simulator",
              row.admitted,
              row.bound ?? "0.03",
            ],
          );
          if (row.cost !== undefined)
            await client.query(
              "INSERT INTO pg_temp.provider_call_events(provider_call_id,actual_cost,currency,recorded_at) VALUES($1,$2,$3,$4)",
              [
                id,
                row.cost,
                row.cost === null ? null : "USD",
                row.recorded ?? null,
              ],
            );
        }
        const policy = structuredClone(simulationPolicy());
        policy.attempt_cost_ceiling = c.attemptCeiling ?? "100";
        policy.run_cost_ceiling = c.runCeiling ?? "100";
        policy.utc_day_cost_ceiling = c.day ?? "100";
        policy.max_concurrent_global = c.concurrency ?? 100;
        policy.provider_rule.max_concurrent = c.providerConcurrency ?? 100;
        policy.global_rate.max_admissions = c.rate ?? 100;
        policy.provider_rule.rate.max_admissions =
          c.providerRate ?? c.rate ?? 100;
        policy.global_rate.min_spacing_ms = c.spacing ?? 0;
        policy.provider_rule.rate.min_spacing_ms =
          c.providerSpacing ?? c.spacing ?? 0;
        const actual = (
          await client.query<{
            attempt_excess: boolean;
            run_excess: boolean;
            day_excess: boolean;
            reservation_excess: boolean;
            retry_excess: boolean;
            concurrency_excess: boolean;
            rate_excess: boolean;
            spacing_excess: boolean;
            clock_reversed: boolean;
          }>("SELECT * FROM pg_temp.g1_temporal($1,$2,$3,0.03,$4,$5,NULL,1)", [
            c.t,
            attempt,
            run,
            JSON.stringify(policy),
            JSON.stringify(policy.provider_rule),
          ])
        ).rows[0];
        expect(actual, c.name).toEqual({
          attempt_excess: false,
          run_excess: false,
          day_excess: false,
          reservation_excess: false,
          retry_excess: false,
          concurrency_excess: false,
          rate_excess: false,
          spacing_excess: false,
          clock_reversed: false,
          ...c.expected,
        });
      }
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  }, 120000);
  it("applies all003 metadata, retains invoker least privilege and hashes the full closed policy/certificate", async () => {
    const env = await fresh();
    const who = (
      await env.runtime.query<{ u: string }>("SELECT current_user AS u")
    ).rows[0]?.u;
    expect(who).toBe("desk_runtime");
    const r = await insert(env);
    expect(r.rows[0]?.reserved_cost_upper_bound).toBe("0.03");
    const flags = (
      await env.owner.query<{
        proname: string;
        prosecdef: boolean;
        runtime_execute: boolean;
      }>(
        "SELECT proname,prosecdef,has_function_privilege('desk_runtime',oid,'EXECUTE') AS runtime_execute FROM pg_proc WHERE proname LIKE 'guard_provider_admission%' OR proname='guard_provider_installation_insert'",
      )
    ).rows;
    expect(flags.length).toBe(2);
    expect(
      flags.map(({ prosecdef, runtime_execute }) => [
        prosecdef,
        runtime_execute,
      ]),
    ).toEqual([
      [false, false],
      [false, false],
    ]);
    expect(
      (
        await env.owner.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('admitted_at','reserved_cost_upper_bound','admission_currency','admission_policy_hash','admission_certificate','admission_certificate_hash','recorded_at','admission_settlement')",
        )
      ).rows[0]?.n,
    ).toBe(8);
  }, 120000);
  it("ordinary SQL exact equality admits two B once, refuses the next with owned code and no third row", async () => {
    const env = await fresh();
    await insert(env);
    await insert(env);
    await expect(insert(env)).rejects.toMatchObject({
      code: "23514",
      constraint: "provider_admission_attempt_cost",
    });
    expect(
      (
        await env.owner.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM provider_calls",
        )
      ).rows[0]?.n,
    ).toBe(2);
  }, 120000);
  it("rejects a forged lower scalar B without modifying any ledger row", async () => {
    const env = await fresh();
    await expect(
      insert(env, { reserved_cost_upper_bound: "0.01" }),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: "provider_admission_certificate_invalid",
    });
    expect(
      (
        await env.owner.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM provider_calls",
        )
      ).rows[0]?.n,
    ).toBe(0);
  }, 120000);
  it("rejects numeric certificate quantum even with a recomputed malformed-certificate hash", async () => {
    const env = await fresh(),
      row = await callRow(env);
    const cert = {
      ...(row.admission_certificate as Certificate),
      accounting_quantum: 0.01,
    };
    // The hostile raw writer can hash a malformed fractional-number leaf. The accepted serializer correctly refuses it.
    const invalidBytes = canonicalJson(row.admission_certificate).replace(
      '"accounting_quantum":"0.01"',
      '"accounting_quantum":0.01',
    );
    expect(JSON.parse(invalidBytes)).toEqual(cert);
    const hash = sha256(
      Buffer.from("provider-admission-certificate-v1\n" + invalidBytes, "utf8"),
    );
    expect(hash).not.toBe(row.admission_certificate_hash);
    await expect(
      insertRow(env, {
        ...row,
        admission_certificate: cert,
        admission_certificate_hash: hash,
      }),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: "provider_admission_policy_invalid",
    });
    expect(
      (
        await env.owner.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM provider_calls",
        )
      ).rows[0]?.n,
    ).toBe(0);
  }, 120000);
  it("normalizes integral JSONB numeric spellings before application-built canonical hash agreement", async () => {
    const env = await fresh(),
      row = await callRow(env);
    const json = JSON.stringify(row.admission_certificate)
      .replace('"operational_try_number":1,', '"operational_try_number":1.0,')
      .replace('"max_concurrent_global":2,', '"max_concurrent_global":2.00,');
    expect(json).toContain('"operational_try_number":1.0,');
    expect(json).toContain('"max_concurrent_global":2.00,');
    const result = await insertRow(env, {
      ...row,
      admission_certificate: json,
    });
    expect(result.rows[0]?.admission_certificate).toEqual(
      row.admission_certificate,
    );
    const stored = await env.owner.query(
      "SELECT admission_certificate->>'operational_try_number' AS n,admission_certificate#>>'{policy,max_concurrent_global}' AS c,admission_certificate_hash FROM provider_calls",
    );
    expect(stored.rows[0]).toEqual({
      n: "1",
      c: "2",
      admission_certificate_hash: row.admission_certificate_hash,
    });
  }, 120000);
  const metadataCases: {
    name: string;
    path: string[];
    value: unknown;
    problem: "none" | "malformed" | "attribution_mismatch" | "event_mismatch";
    reference?: string;
  }[] = [
    {
      name: "valid shorter output",
      path: ["verification_status"],
      value: "attributed_receipt",
      problem: "none",
    },
    {
      name: "valid reference at 4096-byte boundary",
      path: ["verification_status"],
      value: "attributed_receipt",
      problem: "none",
      reference: "é".repeat(2048),
    },
    {
      name: "AT wrong scalar type",
      path: ["attribution", "provider_call_id"],
      value: 1,
      problem: "malformed",
    },
    {
      name: "AT malformed UUID",
      path: ["attribution", "attempt_id"],
      value: "not-a-uuid",
      problem: "malformed",
    },
    {
      name: "AT uppercase UUID",
      path: ["attribution", "provider_call_id"],
      value: "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA",
      problem: "malformed",
    },
    {
      name: "AT well-shaped wrong call",
      path: ["attribution", "provider_call_id"],
      value: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      problem: "attribution_mismatch",
    },
    {
      name: "EV wrong UUID type",
      path: ["event_binding", "provider_call_id"],
      value: 1,
      problem: "malformed",
    },
    {
      name: "EV invalid calendar",
      path: ["event_binding", "ended_at"],
      value: "2026-02-30T00:00:00.000001Z",
      problem: "malformed",
    },
    {
      name: "EV noncanonical microseconds",
      path: ["event_binding", "ended_at"],
      value: "2026-10-06T00:00:01.00001Z",
      problem: "malformed",
    },
    {
      name: "EV trailing-zero cost",
      path: ["event_binding", "actual_cost"],
      value: "0.0200",
      problem: "malformed",
    },
    {
      name: "EV numeric cost",
      path: ["event_binding", "actual_cost"],
      value: 0.02,
      problem: "malformed",
    },
    {
      name: "EV invalid currency",
      path: ["event_binding", "currency"],
      value: "usd",
      problem: "malformed",
    },
    {
      name: "EV invalid reference type",
      path: ["event_binding", "response_reference"],
      value: 7,
      problem: "malformed",
    },
    {
      name: "EV non-NFC reference",
      path: ["event_binding", "response_reference"],
      value: "e\u0301",
      problem: "malformed",
    },
    {
      name: "EV excessive reference bytes",
      path: ["event_binding", "response_reference"],
      value: "é".repeat(2049),
      problem: "malformed",
    },
    {
      name: "EV malformed artifact UUID",
      path: ["event_binding", "response_artifact_id"],
      value: "broken",
      problem: "malformed",
    },
    {
      name: "EV well-shaped wrong cost",
      path: ["event_binding", "actual_cost"],
      value: "0.021",
      problem: "event_mismatch",
    },
    {
      name: "EV well-shaped wrong reference",
      path: ["event_binding", "response_reference"],
      value: "different",
      problem: "event_mismatch",
    },
    {
      name: "EV well-shaped wrong date",
      path: ["event_binding", "ended_at"],
      value: "2026-10-06T00:00:01.000002Z",
      problem: "event_mismatch",
    },
    {
      name: "EV well-shaped wrong event",
      path: ["event_binding", "event_type"],
      value: "terminal_failure",
      problem: "event_mismatch",
    },
    {
      name: "CT missing closed field",
      path: ["consumption", "input_text_hash"],
      value: undefined,
      problem: "malformed",
    },
    {
      name: "CT malformed hash",
      path: ["consumption", "input_text_hash"],
      value: "broken",
      problem: "malformed",
    },
    {
      name: "output wrong scalar type",
      path: ["observed_output_bytes"],
      value: "1",
      problem: "malformed",
    },
  ];
  it.each(metadataCases)(
    "normalizes $name as $problem while preserving every canonical event scalar",
    async ({ path, value, problem, reference }) => {
      const env = await fresh(),
        r = await insert(env),
        cert = r.rows[0]?.admission_certificate as Certificate;
      const io = invocationObservation(cert, simulationRequest());
      const event = {
        provider_call_id: cert.provider_call_id,
        event_type: "succeeded" as const,
        ended_at: "2026-10-06T00:00:01.000001Z",
        usage: { input_bytes: 2, output_bytes: 1 },
        actual_cost: "0.02",
        currency: "USD",
        response_artifact_id: null,
        response_reference: reference ?? "kept-é",
      };
      const fr: FinalReceipt = {
        schema: "g1-sim-final-receipt/1",
        receipt_id: randomUUID(),
        kind: "final_accounting",
        invocation_observation_hash: invocationHash(io),
        attribution: io.attribution,
        consumption: io.consumption,
        work_ended: true,
        observed_output_bytes: 1,
        price_status: "known_final",
        event,
      };
      const m = structuredClone(
        projectReceipt(receiptPacket(io, fr), cert).settlement,
      ) as unknown as Record<string, unknown>;
      let current = m;
      for (const k of path.slice(0, -1))
        current = current[k] as Record<string, unknown>;
      const last = path.at(-1);
      if (!last) throw new Error("test path missing");
      if (value === undefined)
        expect(Reflect.deleteProperty(current, last)).toBe(true);
      else current[last] = value;
      const before = (
        await env.owner.query(
          "SELECT to_jsonb(c)||jsonb_build_object('xmin',xmin::text,'ctid',ctid::text) AS row FROM provider_calls c ORDER BY provider_call_id",
        )
      ).rows;
      await env.runtime.query(
        "INSERT INTO provider_call_events(provider_call_id,event_type,ended_at,usage,actual_cost,currency,response_artifact_id,response_reference,admission_settlement) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          event.provider_call_id,
          event.event_type,
          event.ended_at,
          JSON.stringify(event.usage),
          "0.0200",
          event.currency,
          event.response_artifact_id,
          event.response_reference,
          JSON.stringify(m),
        ],
      );
      const result = (
        await env.owner.query<{
          provider_call_id: string;
          event_type: string;
          ended_at: string;
          usage: unknown;
          actual_cost: string | null;
          currency: string | null;
          response_artifact_id: string | null;
          response_reference: string | null;
          admission_settlement: unknown;
          server_recorded: boolean;
        }>(
          "SELECT provider_call_id::text,event_type,to_char(ended_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS ended_at,usage,actual_cost::text,currency,response_artifact_id::text,response_reference,recorded_at IS NOT NULL AS server_recorded,admission_settlement FROM provider_call_events",
        )
      ).rows[0];
      expect({
        ...result,
        server_recorded: undefined,
        admission_settlement: undefined,
      }).toEqual({
        ...event,
        actual_cost: "0.0200",
        server_recorded: undefined,
        admission_settlement: undefined,
      });
      expect(result?.server_recorded).toBe(true);
      expect(result?.admission_settlement).toEqual(
        problem === "none"
          ? { ...m, violations: [] }
          : {
              schema: "g1-sim-settlement/1",
              verification_status: "unverified_assertion",
              metadata_problem: problem,
              invocation_observation_hash: null,
              final_receipt_hash: null,
              attribution: null,
              consumption: null,
              work_ended: null,
              observed_output_bytes: null,
              price_status: "asserted_known",
              event_binding: null,
              violations: ["metadata_unverified"],
            },
      );
      expect(
        (
          await env.owner.query(
            "SELECT to_jsonb(c)||jsonb_build_object('xmin',xmin::text,'ctid',ctid::text) AS row FROM provider_calls c ORDER BY provider_call_id",
          )
        ).rows,
      ).toEqual(before);
      if (problem === "none") await insert(env);
      else
        await expect(insert(env)).rejects.toMatchObject({
          constraint: "provider_admission_breach",
          code: "23514",
        });
      if (problem !== "none")
        expect(
          (
            await env.owner.query(
              "SELECT to_jsonb(c)||jsonb_build_object('xmin',xmin::text,'ctid',ctid::text) AS row FROM provider_calls c ORDER BY provider_call_id",
            )
          ).rows,
        ).toEqual(before);
      expect(
        (
          await env.owner.query<{ n: number }>(
            "SELECT count(*)::int AS n FROM provider_call_events",
          )
        ).rows[0]?.n,
      ).toBe(1);
    },
    120000,
  );
  it.each(["sql_null", "wrong_whole_type", "unknown_top_key"] as const)(
    "raw valid EV with %s metadata retains full scalar truth, normalized unverified V and occupied capacity",
    async (kind) => {
      const env = await fresh(),
        policy = structuredClone(simulationPolicy());
      policy.attempt_cost_ceiling = "100";
      policy.run_cost_ceiling = "100";
      policy.utc_day_cost_ceiling = "100";
      policy.max_concurrent_global = 1;
      policy.provider_rule.max_concurrent = 1;
      const row = await callRow(env, policy);
      await insertRow(env, row);
      const c = row.admission_certificate as Certificate;
      const original = (
        await env.owner.query(
          "SELECT to_jsonb(c) AS row,xmin::text,ctid::text FROM provider_calls c",
        )
      ).rows;
      const statement = settlementStatement(c),
        valid = JSON.parse(requiredString(statement.values[8])) as Record<
          string,
          unknown
        >;
      statement.values[4] = "0.0200";
      statement.values[8] =
        kind === "sql_null"
          ? null
          : kind === "wrong_whole_type"
            ? JSON.stringify("representable-but-not-object")
            : JSON.stringify({ ...valid, extra_key: "not-a-closed-field" });
      const lower = (
        await env.owner.query<{ t: string }>(
          "SELECT clock_timestamp()::text AS t",
        )
      ).rows[0]?.t;
      if (lower === undefined)
        throw new Error("migration test required scalar missing");
      await env.runtime.query(statement.sql, statement.values);
      const truth = (
        await env.owner.query<{
          provider_call_id: string;
          event_type: string;
          ended_at: string;
          usage: unknown;
          actual_cost: string | null;
          currency: string | null;
          response_artifact_id: string | null;
          response_reference: string | null;
          admission_settlement: unknown;
          bracketed: boolean | null;
        }>(
          `SELECT provider_call_id::text,event_type,to_char(ended_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS ended_at,
      usage,actual_cost::text,currency,response_artifact_id::text,response_reference,admission_settlement,
      recorded_at >= $1::timestamptz AND recorded_at <= clock_timestamp() AS bracketed FROM provider_call_events`,
          [lower],
        )
      ).rows[0];
      expect(truth).toEqual({
        provider_call_id: c.provider_call_id,
        event_type: "succeeded",
        ended_at: "2026-10-06T00:00:01.000001Z",
        usage: { input_bytes: 2, output_bytes: 1 },
        actual_cost: "0.0200",
        currency: "USD",
        response_artifact_id: null,
        response_reference: null,
        bracketed: true,
        admission_settlement: {
          schema: "g1-sim-settlement/1",
          verification_status: "unverified_assertion",
          metadata_problem: kind === "sql_null" ? "absent" : "malformed",
          invocation_observation_hash: null,
          final_receipt_hash: null,
          attribution: null,
          consumption: null,
          work_ended: null,
          observed_output_bytes: null,
          price_status: "asserted_known",
          event_binding: null,
          violations: ["metadata_unverified"],
        },
      });
      expect(
        (
          await env.owner.query(
            "SELECT to_jsonb(c) AS row,xmin::text,ctid::text FROM provider_calls c",
          )
        ).rows,
      ).toEqual(original);
      // Execute the unchanged candidate temporal expression against copies of REAL committed rows. Money alone
      // cannot free capacity: one unverified call plus a candidate exceeds one. This is an expression oracle,
      // distinct from the real unchanged trigger's permanent-breach refusal below.
      const client = await env.owner.connect();
      try {
        await client.query("BEGIN");
        await temporalWrapper(client);
        await client.query(
          "INSERT INTO pg_temp.provider_calls SELECT * FROM public.provider_calls",
        );
        await client.query(
          "INSERT INTO pg_temp.provider_call_events SELECT * FROM public.provider_call_events",
        );
        await client.query(
          "INSERT INTO pg_temp.program_run_attempts SELECT attempt_id,program_run_id FROM public.program_run_attempts",
        );
        const actual = (
          await client.query<{
            attempt_excess: boolean;
            run_excess: boolean;
            day_excess: boolean;
            reservation_excess: boolean;
            retry_excess: boolean;
            concurrency_excess: boolean;
            rate_excess: boolean;
            spacing_excess: boolean;
            clock_reversed: boolean;
          }>(
            "SELECT * FROM pg_temp.g1_temporal(clock_timestamp(),$1,$2,0.03,$3,$4,NULL,1)",
            [
              c.attempt_id,
              c.program_run_id,
              JSON.stringify(policy),
              JSON.stringify(policy.provider_rule),
            ],
          )
        ).rows[0];
        expect(actual?.concurrency_excess).toBe(true);
        expect(actual?.attempt_excess).toBe(false);
        expect(actual?.run_excess).toBe(false);
        expect(actual?.day_excess).toBe(false);
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
      const before = await allPublicValues(env);
      await expect(
        insertRow(env, await callRow(env, policy)),
      ).rejects.toMatchObject({
        code: "23514",
        constraint: "provider_admission_breach",
      });
      expect(await allPublicValues(env)).toEqual(before);
      expect(
        (
          await env.owner.query<{ n: number }>(
            "SELECT count(*)::int AS n FROM provider_call_events",
          )
        ).rows[0]?.n,
      ).toBe(1);
      // No normalization claim for invalid JSON text, unrelated DB exceptions, or authenticated fixture truth.
    },
    120000,
  );
  it.each(["raw", "api"] as const)(
    "uncommitted original settlement arbitrates NEW %s admission at D; commit frees capacity, rollback retains occupancy",
    async (path) => {
      for (const disposition of ["commit", "rollback"] as const) {
        const env = await fresh(),
          policy = structuredClone(simulationPolicy());
        policy.attempt_cost_ceiling = "100";
        policy.run_cost_ceiling = "100";
        policy.utc_day_cost_ceiling = "100";
        policy.max_concurrent_global = 1;
        policy.provider_rule.max_concurrent = 1;
        const original = await callRow(env, policy);
        await insertRow(env, original);
        const candidate = await callRow(env, policy),
          evidence = new SimulationEvidence(env.owner);
        await evidence.initialize();
        const holder = await env.runtime.connect(),
          holderTag = "event-holder-" + randomUUID(),
          waiterTag = "event-waiter-" + randomUUID();
        if (target === undefined)
          throw new Error("synthetic PG target required");
        const ownerUrl = new URL(target);
        ownerUrl.pathname = "/" + env.name;
        let raw: ReturnType<typeof rawWorker> | undefined,
          api: ReturnType<typeof g1Child> | undefined;
        try {
          await holder.query("SELECT set_config('application_name',$1,false)", [
            holderTag,
          ]);
          await holder.query("BEGIN ISOLATION LEVEL READ COMMITTED");
          const event = settlementStatement(
            original.admission_certificate as Certificate,
          );
          const lower = (
            await env.owner.query<{ t: string }>(
              "SELECT clock_timestamp()::text AS t",
            )
          ).rows[0]?.t;
          if (lower === undefined)
            throw new Error("migration test required scalar missing");
          await holder.query(event.sql, event.values);
          const h = (
            await env.owner.query<{ pid: number }>(EXACT_D_HOLDER, [
              env.name,
              holderTag,
            ])
          ).rows;
          expect(h).toHaveLength(1);
          const pid = h[0]?.pid;
          if (pid === undefined)
            throw new Error("named original-event D holder missing");
          if (path === "raw")
            raw = rawWorker({
              url: env.runtimeUrl,
              role: "desk_runtime",
              tag: waiterTag,
              kind: "sql",
              ...rowStatement(candidate),
            });
          else {
            const cert = candidate.admission_certificate as Certificate;
            const reservation: AuthoredReservation = {
              provider_call_id: cert.provider_call_id,
              attempt_id: cert.attempt_id,
              provider: cert.provider,
              operation: cert.operation,
              model_identifier: cert.model_identifier,
              logical_request_key: cert.logical_request_key,
              request_fingerprint: cert.request_fingerprint,
              operational_try_number: 1,
              intentional_take_index: null,
              retry_of_provider_call_id: null,
              reroll_of_provider_call_id: null,
              reroll_trigger_id: null,
              started_at: candidate.started_at as string,
            };
            api = g1Child({
              runtimeUrl: env.runtimeUrl,
              ownerUrl: ownerUrl.toString(),
              reservation,
              tag: waiterTag,
              simulation: {
                invocation: {
                  schema: "g1-sim-invocation/1",
                  policy,
                  request: simulationRequest(),
                  lock_timeout_ms: 20000,
                  statement_timeout_ms: 25000,
                  expected_original_certificate_hash: null,
                },
              },
            });
          }
          await observe(
            async () =>
              (
                await env.owner.query(EXACT_D_WAITER, [
                  env.name,
                  waiterTag,
                  pid,
                ])
              ).rowCount === 1,
            "unique NEW admission blocked by original settlement at exact D",
            10000,
          );
          const wait = (
            await env.owner.query<{ pid: number; blockers: number[] }>(
              EXACT_D_WAITER,
              [env.name, waiterTag, pid],
            )
          ).rows;
          expect(wait).toHaveLength(1);
          expect(wait[0]?.pid).not.toBe(pid);
          expect(wait[0]?.blockers).toContain(pid);
          expect(
            (
              await env.owner.query<{ n: number }>(
                "SELECT count(*)::int AS n FROM provider_calls",
              )
            ).rows[0]?.n,
          ).toBe(1);
          expect(
            (
              await env.owner.query<{ n: number }>(
                "SELECT count(*)::int AS n FROM provider_call_events",
              )
            ).rows[0]?.n,
          ).toBe(0);
          expect(
            (
              await env.owner.query<{ n: number }>(
                "SELECT count(*)::int AS n FROM g1_b_fixture_evidence.receipts",
              )
            ).rows[0]?.n,
          ).toBe(0);
          const originalBefore = (
              await env.owner.query(
                "SELECT to_jsonb(c) AS row,xmin::text,ctid::text FROM provider_calls c",
              )
            ).rows,
            publicBefore = await allPublicValues(env);
          await holder.query(disposition === "commit" ? "COMMIT" : "ROLLBACK");
          if (!raw && !api) throw new Error("expected owned event waiter");
          const exit = raw
            ? await raw.exit()
            : await requiredChild(api).exited();
          expect(exit.signal).toBeNull();
          expect(exit.stderr).toBe("");
          expect(exit.code).toBe(
            path === "raw" && disposition === "rollback" ? 2 : 0,
          );
          const lines = exit.stdout
            .split("\n")
            .filter((line) => line.startsWith("RESULT "));
          expect(lines).toHaveLength(1);
          const line = lines[0];
          if (line === undefined)
            throw new Error("expected owned child RESULT line");
          const result: unknown = JSON.parse(line.slice(7));
          if (disposition === "rollback")
            expect(result).toEqual(
              path === "raw"
                ? {
                    status: "refused",
                    code: "23514",
                    constraint: "provider_admission_concurrency_limit",
                  }
                : {
                    status: "rejected",
                    result: {
                      kind: "rejected",
                      code: "provider_admission_concurrency_limit",
                      sqlstate: "23514",
                    },
                  },
            );
          else
            expect(result).toMatchObject({
              status: path === "raw" ? "committed" : "performed",
            });
          if (disposition === "rollback")
            expect(await allPublicValues(env)).toEqual(publicBefore);
          const first = (
            await env.owner.query(
              "SELECT to_jsonb(c) AS row,xmin::text,ctid::text FROM provider_calls c WHERE provider_call_id=$1",
              [original.provider_call_id],
            )
          ).rows;
          expect(first).toEqual(originalBefore);
          const facts = (
            await env.owner.query<{
              calls: number;
              events: number;
              original_verified: number;
            }>(
              `SELECT count(*)::int AS calls,count(e.provider_call_id)::int AS events,
          count(e.provider_call_id) FILTER(WHERE e.provider_call_id=$1 AND e.admission_settlement->'work_ended'='true'::jsonb AND e.recorded_at>=$2::timestamptz AND e.recorded_at<=clock_timestamp())::int AS original_verified
          FROM provider_calls c LEFT JOIN provider_call_events e USING(provider_call_id)`,
              [original.provider_call_id, lower],
            )
          ).rows[0];
          expect(facts).toEqual({
            calls: disposition === "commit" ? 2 : 1,
            events: disposition === "commit" ? (path === "api" ? 2 : 1) : 0,
            original_verified: disposition === "commit" ? 1 : 0,
          });
          expect(
            (
              await env.owner.query<{ n: number }>(
                "SELECT count(*)::int AS n FROM g1_b_fixture_evidence.receipts WHERE record_kind='invocation'",
              )
            ).rows[0]?.n,
          ).toBe(disposition === "commit" && path === "api" ? 1 : 0);
        } finally {
          await holder.query("ROLLBACK");
          holder.release();
          if (raw) await raw.kill();
          if (api) await api.kill();
          await observe(
            async () =>
              (
                await env.owner.query<{ n: number }>(
                  "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1 AND application_name=$2",
                  [env.name, waiterTag],
                )
              ).rows[0]?.n === 0,
            "only owned event/admission waiter reaped",
            10000,
          );
        }
      }
    },
    120000,
  );
  it("raw settlement waiter records its ONE server sample after exact D blocking, not statement/transaction start", async () => {
    const env = await fresh(),
      row = await callRow(env);
    await insertRow(env, row);
    const cert = row.admission_certificate as Certificate;
    const holder = await env.runtime.connect(),
      holderTag = "event-clock-holder-" + randomUUID(),
      tag = "event-clock-waiter-" + randomUUID();
    let worker: ReturnType<typeof rawWorker> | undefined;
    try {
      await holder.query("SELECT set_config('application_name',$1,false)", [
        holderTag,
      ]);
      await holder.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      await insertRow(env, await callRow(env), holder);
      const h = (
        await env.owner.query<{ pid: number }>(EXACT_D_HOLDER, [
          env.name,
          holderTag,
        ])
      ).rows;
      expect(h).toHaveLength(1);
      const pid = h[0]?.pid;
      if (pid === undefined) throw new Error("clock D holder missing");
      worker = rawWorker({
        url: env.runtimeUrl,
        role: "desk_runtime",
        tag,
        kind: "sql",
        ...settlementStatement(cert),
      });
      await observe(
        async () =>
          (await env.owner.query(EXACT_D_WAITER, [env.name, tag, pid]))
            .rowCount === 1,
        "raw settlement named D wait",
        10000,
      );
      const bracket = (
        await env.owner.query<{
          pid: number;
          lower: string;
          after_statement_start: boolean;
          after_transaction_start: boolean;
        }>(
          "SELECT a.pid,clock_timestamp()::text AS lower,clock_timestamp()>a.query_start AS after_statement_start,clock_timestamp()>a.xact_start AS after_transaction_start FROM pg_stat_activity a WHERE a.datname=$1 AND a.application_name=$2",
          [env.name, tag],
        )
      ).rows[0];
      expect(bracket?.after_statement_start).toBe(true);
      expect(bracket?.after_transaction_start).toBe(true);
      expect(
        (
          await env.owner.query<{ n: number }>(
            "SELECT count(*)::int AS n FROM provider_call_events",
          )
        ).rows[0]?.n,
      ).toBe(0);
      await holder.query("ROLLBACK");
      const exit = await worker.exit();
      expect(exit.code).toBe(0);
      expect(exit.signal).toBeNull();
      expect(exit.stderr).toBe("");
      expect(
        (
          await env.owner.query(
            "SELECT recorded_at >= $1::timestamptz AND recorded_at<=clock_timestamp() AS after_wait,ended_at::text,actual_cost::text FROM provider_call_events",
            [bracket?.lower],
          )
        ).rows[0],
      ).toMatchObject({ after_wait: true, actual_cost: "0.02" });
    } finally {
      await holder.query("ROLLBACK");
      holder.release();
      if (worker) await worker.kill();
    }
  }, 120000);
  it("mixed-policy multirow refuses whole statement without partial policy pin or VALUES-order assumption", async () => {
    const env = await fresh(),
      p = structuredClone(simulationPolicy());
    p.attempt_cost_ceiling = "100";
    p.run_cost_ceiling = "100";
    p.utc_day_cost_ceiling = "100";
    const a = await callRow(env, p),
      b = await callRow(env, {
        ...p,
        policy_version: "different-first-writer",
      }),
      columns = Object.keys(a),
      values: unknown[] = [];
    const tuples = [a, b].map(
      (row) =>
        "(" +
        columns
          .map((k) => {
            const v = row[k];
            values.push(
              v !== null && typeof v === "object" ? JSON.stringify(v) : v,
            );
            return "$" + String(values.length);
          })
          .join(",") +
        ")",
    );
    const before = await ledgerDigest(env),
      publicBefore = await allPublicValues(env);
    await expect(
      env.runtime.query(
        "INSERT INTO provider_calls(" +
          columns.join(",") +
          ") VALUES " +
          tuples.join(","),
        values,
      ),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: "provider_admission_policy_conflict",
    });
    expect(await ledgerDigest(env)).toBe(before);
    expect(await allPublicValues(env)).toEqual(publicBefore);
    expect(
      (
        await env.owner.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM provider_calls WHERE admission_policy_hash IS NOT NULL",
        )
      ).rows[0]?.n,
    ).toBe(0);
    // Either coherent policy can be the next actual first committed writer; nothing from the failed statement pins it.
    expect((await insertRow(env, b)).rowCount).toBe(1);
  }, 120000);
  it.each(["explicit_rc", "explicit_rr", "default_rr"] as const)(
    "certified raw %s isolation has exact positive/refusal and no partial row",
    async (mode) => {
      const env = await fresh(),
        client = await env.runtime.connect(),
        row = await callRow(env),
        before = await ledgerDigest(env),
        publicBefore = await allPublicValues(env);
      try {
        if (mode === "default_rr")
          await client.query(
            "SET default_transaction_isolation='repeatable read'",
          );
        await client.query(
          mode === "explicit_rc"
            ? "BEGIN ISOLATION LEVEL READ COMMITTED"
            : mode === "explicit_rr"
              ? "BEGIN ISOLATION LEVEL REPEATABLE READ"
              : "BEGIN",
        );
        expect(
          (
            await client.query<{ transaction_isolation: string }>(
              "SHOW transaction_isolation",
            )
          ).rows[0]?.transaction_isolation,
        ).toBe(mode === "explicit_rc" ? "read committed" : "repeatable read");
        if (mode === "explicit_rc") {
          expect((await insertRow(env, row, client)).rowCount).toBe(1);
          await client.query("COMMIT");
        } else {
          await expect(insertRow(env, row, client)).rejects.toMatchObject({
            code: "0A000",
            constraint: "provider_admission_certificate_invalid",
          });
          await client.query("ROLLBACK");
          expect(await ledgerDigest(env)).toBe(before);
          expect(await allPublicValues(env)).toEqual(publicBefore);
        }
      } finally {
        await client.query("ROLLBACK");
        await client.query("RESET default_transaction_isolation");
        client.release();
      }
    },
    120000,
  );
  it("caller-authored admission/event server timestamps refuse exact code without modifying immutable history", async () => {
    const env = await fresh(),
      row = await callRow(env),
      before = await ledgerDigest(env),
      publicBefore = await allPublicValues(env);
    await expect(
      insertRow(env, { ...row, admitted_at: "2026-10-06T00:00:00.000001Z" }),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: "provider_admission_clock_reversed",
    });
    expect(await ledgerDigest(env)).toBe(before);
    expect(await allPublicValues(env)).toEqual(publicBefore);
    await insertRow(env, row);
    const callOnly = await ledgerDigest(env),
      publicCallOnly = await allPublicValues(env),
      event = settlementStatement(row.admission_certificate as Certificate);
    const sql = event.sql
      .replace("admission_settlement)", "admission_settlement,recorded_at)")
      .replace("$9)", "$9,$10)");
    expect(sql).not.toBe(event.sql);
    await expect(
      env.runtime.query(sql, [...event.values, "2026-10-06T00:00:01.000001Z"]),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: "provider_admission_clock_reversed",
    });
    expect(await ledgerDigest(env)).toBe(callOnly);
    expect(await allPublicValues(env)).toEqual(publicCallOnly);
  }, 120000);
  it("ALL THREE invoker guards deny direct runtime EXECUTE and introduce no helper privilege", async () => {
    const env = await fresh(),
      names = [
        "guard_provider_installation_insert",
        "guard_provider_admission",
        "guard_provider_settlement",
      ];
    const rows = (
      await env.runtime.query<{
        proname: string;
        prosecdef: boolean;
        runtime_execute: boolean;
      }>(
        "SELECT proname,prosecdef,has_function_privilege(current_user,oid,'EXECUTE') AS runtime_execute FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY($1::text[]) ORDER BY proname",
        [names],
      )
    ).rows;
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.proname).sort()).toEqual(names.sort());
    expect(
      rows.map(({ prosecdef, runtime_execute }) => [
        prosecdef,
        runtime_execute,
      ]),
    ).toEqual([
      [false, false],
      [false, false],
      [false, false],
    ]);
    for (const name of names)
      await expect(
        env.runtime.query("SELECT public." + name + "()"),
      ).rejects.toMatchObject({ code: "42501" });
    expect(
      (await env.runtime.query<{ u: string }>("SELECT current_user AS u"))
        .rows[0]?.u,
    ).toBe("desk_runtime");
    expect(await ledgerDigest(env)).toBe("[]");
  }, 120000);
  it.each(["actual_above_bound", "input_hash_mismatch"] as const)(
    "EXACT candidate breach expression survives later UTC-day exclusion of real committed %s actual",
    async (kind) => {
      const env = await fresh(),
        policy = structuredClone(simulationPolicy());
      policy.attempt_cost_ceiling = "100";
      policy.run_cost_ceiling = "100";
      policy.utc_day_cost_ceiling = "0.06";
      policy.max_concurrent_global = 100;
      policy.provider_rule.max_concurrent = 100;
      const first = await callRow(env, policy);
      await insertRow(env, first);
      await insertRow(env, await callRow(env, policy));
      await settle(
        env,
        first.admission_certificate as Certificate,
        kind === "actual_above_bound"
          ? { cost: "0.031" }
          : { consumption: { input_text_hash: sha256(Buffer.from("cd")) } },
      );
      // Both real reservations were admitted before settlement; the original unresolved B survives.
      const source = (
        await env.owner.query<{
          actual_cost: string | null;
          v: unknown;
          before_later_day: boolean | null;
        }>(
          "SELECT e.actual_cost::text,e.admission_settlement->'violations' AS v,c.admitted_at<='2098-12-31T23:59:59.999999Z'::timestamptz AS before_later_day FROM provider_call_events e JOIN provider_calls c USING(provider_call_id)",
        )
      ).rows[0];
      expect(source).toEqual({
        actual_cost: kind === "actual_above_bound" ? "0.031" : "0.02",
        v: [kind],
        before_later_day: true,
      });
      const immutable = await ledgerDigest(env),
        client = await env.owner.connect();
      try {
        await client.query("BEGIN");
        await client.query("SET LOCAL TIME ZONE 'America/Los_Angeles'");
        await temporalWrapper(client);
        const expression = await breachWrapper(client);
        expect(expression).not.toContain("clock_timestamp");
        expect(expression).not.toContain(" t ");
        await client.query(
          "INSERT INTO pg_temp.provider_calls SELECT * FROM public.provider_calls; INSERT INTO pg_temp.provider_call_events SELECT * FROM public.provider_call_events; INSERT INTO pg_temp.program_run_attempts SELECT attempt_id,program_run_id FROM public.program_run_attempts",
        );
        const cert = first.admission_certificate as Certificate;
        expect(
          (
            await client.query<{ disjoint_later_day: boolean | null }>(
              "SELECT sum(CASE WHEN e.actual_cost IS NOT NULL AND e.currency=c.admission_currency THEN CASE WHEN (c.admitted_at AT TIME ZONE 'UTC')::date='2099-01-01'::date THEN e.actual_cost ELSE 0 END ELSE c.reserved_cost_upper_bound END)+0.03=0.06 AS disjoint_later_day FROM pg_temp.provider_calls c LEFT JOIN pg_temp.provider_call_events e USING(provider_call_id)",
            )
          ).rows[0]?.disjoint_later_day,
        ).toBe(true);
        const metrics = (
          await client.query<{
            attempt_excess: boolean;
            run_excess: boolean;
            day_excess: boolean;
            reservation_excess: boolean;
            retry_excess: boolean;
            concurrency_excess: boolean;
            rate_excess: boolean;
            spacing_excess: boolean;
            clock_reversed: boolean;
          }>(
            "SELECT * FROM pg_temp.g1_temporal('2099-01-01T00:00:00.000001Z',$1,$2,0.03,$3,$4,NULL,1)",
            [
              cert.attempt_id,
              cert.program_run_id,
              JSON.stringify(policy),
              JSON.stringify(policy.provider_rule),
            ],
          )
        ).rows[0];
        expect(metrics).toEqual({
          attempt_excess: false,
          run_excess: false,
          day_excess: false,
          reservation_excess: false,
          retry_excess: false,
          concurrency_excess: false,
          rate_excess: false,
          spacing_excess: false,
          clock_reversed: false,
        });
        expect(
          (
            await client.query<{ blocked: boolean }>(
              "SELECT pg_temp.g1_retained_breach() AS blocked",
            )
          ).rows[0]?.blocked,
        ).toBe(true);
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
      expect(await ledgerDigest(env)).toBe(immutable);
      await expect(
        insertRow(env, await callRow(env, policy)),
      ).rejects.toMatchObject({
        code: "23514",
        constraint: "provider_admission_breach",
      });
      expect(await ledgerDigest(env)).toBe(immutable);
      // Source-expression/later-day oracle; NOT actual midnight/OS-clock manipulation or child-history credit.
    },
    120000,
  );
  it("real migration checksum/idempotency keeps fresh committed003 schema and row identities unchanged", async () => {
    const env = await fresh(),
      migrations = await readMigrations(),
      actual = (
        await env.owner.query(
          "SELECT migration_name,checksum FROM desk_internal.schema_migrations ORDER BY migration_name",
        )
      ).rows;
    expect(migrations.map((m) => m.name)).toEqual([
      "001_foundation.sql",
      "002_persistence_profile.sql",
      "003_provider_admission.sql",
    ]);
    for (const m of migrations)
      expect(m.checksum).toBe(sha256(await readFile("migrations/" + m.name)));
    expect(actual).toEqual(
      migrations.map(({ name, checksum }) => ({
        migration_name: name,
        checksum,
      })),
    );
    const ledger = await migrationRows(env),
      values = await historicalValues(env);
    await migrate(env.migrator);
    await verifyMigrationIntegrity(env.migrator);
    await migrate(env.migrator);
    expect(await migrationRows(env)).toEqual(ledger);
    expect(await historicalValues(env)).toEqual(values);
  }, 120000);
  it("populated NONfixture001+002 history migrates without rewriting any old value/xmin/ctid; all8 additions NULL", async () => {
    const directory = await copyMigrations(false);
    try {
      if (!cluster) throw new Error("migration test cluster missing");
      const env = await cluster.create({
        migrate: true,
        migrationsDirectory: directory,
      });
      await seedPrerequisites(env.migrator);
      const prepared = await callRow(env),
        metadata = [
          "reserved_cost_upper_bound",
          "admission_currency",
          "admission_policy_hash",
          "admission_certificate",
          "admission_certificate_hash",
        ];
      const historic = Object.fromEntries(
        Object.entries(prepared).filter(([key]) => !metadata.includes(key)),
      );
      const statement = rowStatement(historic);
      await env.runtime.query(
        statement.sql.replace(",admitted_at::text", ""),
        statement.values,
      );
      await env.runtime.query(
        "INSERT INTO provider_call_events(provider_call_id,event_type,ended_at,usage,actual_cost,currency,response_artifact_id,response_reference) VALUES($1,'succeeded','2026-10-06T00:00:01.000001Z','{}',0.0200,'USD',NULL,'nonfixture-é')",
        [prepared.provider_call_id],
      );
      const values = await historicalValues(env),
        ledger = await migrationRows(env);
      await migrate(env.migrator);
      await verifyMigrationIntegrity(env.migrator);
      expect(await historicalValues(env)).toEqual(values);
      expect((await migrationRows(env)).slice(0, 2)).toEqual(ledger);
      expect(
        (
          await env.owner.query(
            "SELECT num_nonnulls(admitted_at,reserved_cost_upper_bound,admission_currency,admission_policy_hash,admission_certificate,admission_certificate_hash) AS n FROM provider_calls",
          )
        ).rows,
      ).toEqual([{ n: 0 }]);
      expect(
        (
          await env.owner.query(
            "SELECT num_nonnulls(recorded_at,admission_settlement) AS n,actual_cost::text FROM provider_call_events",
          )
        ).rows,
      ).toEqual([{ n: 0, actual_cost: "0.0200" }]);
      await expect(insertRow(env, await callRow(env))).rejects.toMatchObject({
        constraint: "provider_admission_legacy_unaccounted",
      });
    } finally {
      await rm(directory, { recursive: true });
    }
  }, 120000);
  it("failed transaction AFTER unchanged003 DDL commits neither schema nor checksum; altered-copy checksum cannot rewrite an applied row", async () => {
    const baseline = await copyMigrations(false),
      fault = await copyMigrations(true, "\nSELECT 1/0;\n");
    try {
      if (!cluster) throw new Error("migration test cluster missing");
      const env = await cluster.create({
        migrate: true,
        migrationsDirectory: baseline,
      });
      await seedPrerequisites(env.migrator);
      const values = await historicalValues(env),
        ledger = await migrationRows(env),
        faultEntry = (await readMigrations(fault)).find(
          (m) => m.name === "003_provider_admission.sql",
        );
      expect(faultEntry?.checksum).toBe(
        sha256(await readFile(join(fault, "003_provider_admission.sql"))),
      );
      expect(faultEntry?.checksum).not.toBe(
        sha256(await readFile("migrations/003_provider_admission.sql")),
      );
      await expect(migrate(env.migrator, fault)).rejects.toMatchObject({
        code: "22012",
      });
      await expectNo003(env);
      expect(await historicalValues(env)).toEqual(values);
      expect(await migrationRows(env)).toEqual(ledger);
      await migrate(env.migrator);
      await verifyMigrationIntegrity(env.migrator);
      const applied = await migrationRows(env),
        after = await historicalValues(env);
      await expect(migrate(env.migrator, fault)).rejects.toThrow(
        "Applied migration checksum mismatch or unknown migration: 003_provider_admission.sql",
      );
      await expect(
        verifyMigrationIntegrity(env.migrator, fault),
      ).rejects.toThrow(
        "Migration integrity failure: 003_provider_admission.sql",
      );
      expect(await migrationRows(env)).toEqual(applied);
      expect(await historicalValues(env)).toEqual(after);
    } finally {
      await rm(baseline, { recursive: true });
      await rm(fault, { recursive: true });
    }
  }, 120000);
  it("owned migration child SIGKILL AFTER003 DDL holds migration->D->table locks and rolls back checksum/schema/history", async () => {
    const baseline = await copyMigrations(false),
      heldCopy = await copyMigrations(
        true,
        "\nSELECT pg_advisory_xact_lock(182736456,99);\n",
      );
    let worker: ReturnType<typeof rawWorker> | undefined;
    try {
      if (!cluster) throw new Error("migration test cluster missing");
      const env = await cluster.create({
        migrate: true,
        migrationsDirectory: baseline,
      });
      await seedPrerequisites(env.migrator);
      const values = await historicalValues(env),
        ledger = await migrationRows(env),
        gate = await env.owner.connect(),
        tag = "migration-interrupt-" + randomUUID();
      try {
        await gate.query("BEGIN");
        await gate.query("SELECT pg_advisory_xact_lock(182736456,99)");
        const gatePid = (
          await gate.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
        ).rows[0]?.pid;
        if (gatePid === undefined)
          throw new Error("migration test required scalar missing");
        worker = rawWorker({
          url: env.migratorUrl,
          role: "desk_migrator",
          tag,
          kind: "migration",
          directory: heldCopy,
        });
        const waited = `SELECT a.pid FROM pg_stat_activity a JOIN pg_locks l USING(pid) WHERE a.datname=$1 AND a.application_name=$2 AND a.pid<>$3
          AND a.state='active' AND a.backend_xid IS NOT NULL AND a.wait_event_type='Lock' AND a.wait_event='advisory' AND l.database=a.datid
          AND l.locktype='advisory' AND l.mode='ExclusiveLock' AND NOT l.granted AND l.classid=182736456 AND l.objid=99 AND l.objsubid=2 AND $3=ANY(pg_blocking_pids(a.pid))`;
        await observe(
          async () =>
            (await env.owner.query(waited, [env.name, tag, gatePid]))
              .rowCount === 1,
          "only named owned migration child after DDL at copy-only test gate",
          10000,
        );
        const pid = (
          await env.owner.query<{ pid: number }>(waited, [
            env.name,
            tag,
            gatePid,
          ])
        ).rows[0]?.pid;
        if (pid === undefined)
          throw new Error("owned migration backend missing");
        const locks = (
          await env.owner.query(
            "SELECT classid::bigint,objid::bigint,objsubid,mode,granted FROM pg_locks WHERE pid=$1 AND locktype='advisory' AND database=(SELECT oid FROM pg_database WHERE datname=$2) AND granted ORDER BY classid",
            [pid, env.name],
          )
        ).rows;
        expect(locks).toEqual([
          {
            classid: "182736451",
            objid: "1",
            objsubid: 2,
            mode: "ExclusiveLock",
            granted: true,
          },
          {
            classid: "182736456",
            objid: "1",
            objsubid: 2,
            mode: "ExclusiveLock",
            granted: true,
          },
        ]);
        expect(
          (
            await env.owner.query<{ n: number }>(
              "SELECT count(*)::int AS n FROM pg_locks WHERE pid=$1 AND locktype='relation' AND granted AND mode='AccessExclusiveLock' AND relation IN ('public.provider_calls'::regclass,'public.provider_call_events'::regclass)",
              [pid],
            )
          ).rows[0]?.n,
        ).toBe(2);
        expect(
          (
            await env.owner.query<{ n: number }>(
              "SELECT count(*)::int AS n FROM desk_internal.schema_migrations WHERE migration_name='003_provider_admission.sql'",
            )
          ).rows[0]?.n,
        ).toBe(0);
        const death = await worker.kill();
        expect(death.code).toBeNull();
        expect(death.signal).toBe("SIGKILL");
        expect(death.stdout).not.toContain("RESULT ");
        // Release our test-only gate so the server can proceed to its next socket interaction and detect the killed client.
        await gate.query("ROLLBACK");
        await observe(
          async () =>
            (
              await env.owner.query<{ n: number }>(
                "SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid=$1 AND datname=$2 AND application_name=$3",
                [pid, env.name, tag],
              )
            ).rows[0]?.n === 0,
          "owned killed migration backend gone",
          10000,
        );
      } finally {
        if (worker) await worker.kill();
        await gate.query("ROLLBACK");
        gate.release();
      }
      await expectNo003(env);
      expect(await historicalValues(env)).toEqual(values);
      expect(await migrationRows(env)).toEqual(ledger);
      await migrate(env.migrator);
      await verifyMigrationIntegrity(env.migrator);
    } finally {
      if (worker) await worker.kill();
      await rm(baseline, { recursive: true });
      await rm(heldCopy, { recursive: true });
    }
  }, 120000);
  it("source clock/lock-order proof has exactly ONE sample in each row guard, reused by unmodified predicates", async () => {
    const sql = await readFile("migrations/003_provider_admission.sql", "utf8");
    const admission = sql
      .split("CREATE FUNCTION guard_provider_admission()")[1]
      ?.split("CREATE TRIGGER provider_admission_row")[0];
    const settlement = sql
      .split("CREATE FUNCTION guard_provider_settlement()")[1]
      ?.split("CREATE TRIGGER provider_settlement_row")[0];
    expect(admission?.match(/clock_timestamp\(\)/g)).toHaveLength(1);
    expect(settlement?.match(/clock_timestamp\(\)/g)).toHaveLength(1);
    expect(admission).toContain(
      "t:=clock_timestamp();target_attempt:=NEW.attempt_id;target_run:=run_id;candidate_bound:=bound;",
    );
    expect(admission).toContain("NEW.admitted_at:=t;");
    expect(settlement).toContain("recorded_time:=clock_timestamp();");
    expect(settlement).toContain("NEW.recorded_at:=recorded_time;");
    expect(
      sql.indexOf("SELECT pg_advisory_xact_lock(182736456, 1);"),
    ).toBeLessThan(
      sql.indexOf(
        "LOCK TABLE provider_calls, provider_call_events IN ACCESS EXCLUSIVE MODE;",
      ),
    );
    const runner = await readFile("src/db/migrations.ts", "utf8");
    expect(runner.indexOf("pg_advisory_xact_lock(182736451, 1)")).toBeLessThan(
      runner.indexOf("client.query(migration.sql)"),
    );
    expect(sql).not.toContain("SECURITY DEFINER");
  });
  it("candidate trigger has exact temporal extraction boundaries and one real clock sample per admitted row", async () => {
    const text = await readFile(
      "migrations/003_provider_admission.sql",
      "utf8",
    );
    expect(text.split("-- G1_TEMPORAL_ADMISSION_BEGIN").length).toBe(2);
    expect(text.split("-- G1_TEMPORAL_ADMISSION_END").length).toBe(2);
    expect(text.match(/t:=clock_timestamp\(\)/g)?.length).toBe(1);
  });
});
