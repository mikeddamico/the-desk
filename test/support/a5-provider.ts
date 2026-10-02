// Test support for A5.2: the DURABLE test-only side-effect adapter and request builders.
// The adapter's invocation table lives in a SEPARATE schema of the disposable test database (created here by the database owner,
// never a migration, never reachable by desk_runtime). `perform` first INSERTs an invocation row on its own autocommit connection
// and only then returns, so the row survives SIGKILL of the performing process and duplicate work is counted ACROSS workers and
// restarts with count(*) per logical key - a process-local spy is never the evidence.
import { createHash, randomUUID } from "node:crypto";

import pg from "pg";

import type {
  AdapterRecord,
  AuthoredOutcome,
  AuthoredReservation,
  ProviderRequest,
  SideEffectAdapter,
} from "../../src/runtime/provider.js";
import { TestCluster, type DbEnv } from "./db-env.js";
import { attemptIds, seedPrerequisites } from "./a5-fixture.js";

export const EFFECT_SCHEMA = "a5_2_effects";

export interface EffectResult {
  invocation_id: string;
  cost: string;
}

export async function createEffectSchema(owner: pg.Pool): Promise<void> {
  await owner.query(`CREATE SCHEMA ${EFFECT_SCHEMA}`);
  await owner.query(`CREATE TABLE ${EFFECT_SCHEMA}.invocations (
      invocation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      logical_request_key text NOT NULL,
      provider_call_id uuid NOT NULL,
      request_fingerprint text NOT NULL,
      pid integer NOT NULL DEFAULT pg_backend_pid(),
      at timestamptz NOT NULL DEFAULT clock_timestamp())`);
}

/** Invocation rows for a logical key, across ALL workers and restarts. */
export async function invocationCount(
  owner: pg.Pool,
  key?: string,
): Promise<number> {
  const r = key
    ? await owner.query(
        `SELECT count(*)::int AS n FROM ${EFFECT_SCHEMA}.invocations WHERE logical_request_key = $1`,
        [key],
      )
    : await owner.query(
        `SELECT count(*)::int AS n FROM ${EFFECT_SCHEMA}.invocations`,
      );
  return (r.rows[0] as { n: number }).n;
}

export interface AdapterOptions {
  /** `false`: a provider without lookup/idempotency support. */
  lookup: boolean;
  /** Throw AFTER the durable side effect (a timeout where the provider did act): the call is AMBIGUOUS. */
  throwAfterEffect?: boolean;
  /** Evidence lies about the fingerprint / call id (must never be accepted as bound evidence). */
  corruptEvidence?: "fingerprint" | "call_id";
  /** Pause just BEFORE the durable effect (in-process gating; never a sleep). */
  beforeEffect?: () => Promise<void>;
}

export function durableAdapter(
  owner: pg.Pool,
  options: AdapterOptions,
): SideEffectAdapter<EffectResult> {
  const adapter: SideEffectAdapter<EffectResult> = {
    async perform(req: ProviderRequest): Promise<EffectResult> {
      if (options.beforeEffect) await options.beforeEffect();
      const r = await owner.query(
        `INSERT INTO ${EFFECT_SCHEMA}.invocations (logical_request_key, provider_call_id, request_fingerprint)
         VALUES ($1, $2::uuid, $3) RETURNING invocation_id::text`,
        [
          req.logical_request_key,
          req.provider_call_id,
          req.request_fingerprint,
        ],
      );
      if (options.throwAfterEffect) throw new Error("provider timeout");
      return {
        invocation_id: (r.rows[0] as { invocation_id: string }).invocation_id,
        cost: "0.0123",
      };
    },
  };
  if (options.lookup)
    adapter.lookup = async (
      req: ProviderRequest,
    ): Promise<AdapterRecord<EffectResult> | undefined> => {
      const r = await owner.query(
        `SELECT invocation_id::text, provider_call_id::text, request_fingerprint FROM ${EFFECT_SCHEMA}.invocations
          WHERE logical_request_key = $1 ORDER BY at LIMIT 1`,
        [req.logical_request_key],
      );
      const row = r.rows[0] as
        | {
            invocation_id: string;
            provider_call_id: string;
            request_fingerprint: string;
          }
        | undefined;
      if (!row) return undefined;
      return {
        provider_call_id:
          options.corruptEvidence === "call_id"
            ? randomUUID()
            : row.provider_call_id,
        logical_request_key: req.logical_request_key,
        request_fingerprint:
          options.corruptEvidence === "fingerprint"
            ? "0".repeat(64)
            : row.request_fingerprint,
        result: { invocation_id: row.invocation_id, cost: "0.0123" },
      };
    };
  return adapter;
}

export const STARTED = "2026-01-01T00:00:00.000000Z";
export const ENDED = "2026-01-01T00:00:01.000000Z";

export const hex = (seed: string): string =>
  createHash("sha256").update(seed).digest("hex");

/** A fresh authored non-TTS reservation (take index NULL, key = fingerprint). */
export function reservation(
  attemptId: string,
  over: Partial<AuthoredReservation> = {},
): AuthoredReservation {
  const fingerprint = hex(randomUUID());
  return {
    provider_call_id: randomUUID(),
    attempt_id: attemptId,
    provider: "test_provider",
    operation: "llm_json",
    model_identifier: "test-model-1",
    request_fingerprint: fingerprint,
    logical_request_key: fingerprint,
    operational_try_number: 1,
    intentional_take_index: null,
    retry_of_provider_call_id: null,
    reroll_of_provider_call_id: null,
    reroll_trigger_id: null,
    started_at: STARTED,
    ...over,
  };
}

/** The deterministic governed outcome for a call that the durable adapter performed. */
export const finishSucceeded =
  (providerCallId: string) =>
  (result: EffectResult): AuthoredOutcome => ({
    provider_call_id: providerCallId,
    event_type: "succeeded",
    ended_at: ENDED,
    usage: { invocation_id: result.invocation_id },
    actual_cost: result.cost,
    currency: "USD",
    response_artifact_id: null,
    response_reference: null,
  });

export const outcome = (
  providerCallId: string,
  over: Partial<AuthoredOutcome> = {},
): AuthoredOutcome => ({
  provider_call_id: providerCallId,
  event_type: "succeeded",
  ended_at: ENDED,
  usage: { tokens: 3 },
  actual_cost: "0.0123",
  currency: "USD",
  response_artifact_id: null,
  response_reference: null,
  ...over,
});

// ---- shared integration preamble ----------------------------------------------------------------------------------------

export interface ProviderEnv {
  env: DbEnv;
  ownerUrl: string;
  runtime(max?: number): pg.Pool;
  attempt: string;
  otherAttempt: string;
  providerCalls(): Promise<number>;
  events(): Promise<number>;
  rows(sql: string, values?: unknown[]): Promise<Record<string, unknown>[]>;
  close(): Promise<void>;
}

/** A migrated disposable database with fixture prerequisites and the separate durable-adapter schema. */
export async function providerEnv(
  cluster: TestCluster,
  databaseUrl: string,
): Promise<ProviderEnv> {
  const env = await cluster.create({ migrate: true });
  await seedPrerequisites(env.migrator);
  await createEffectSchema(env.owner);
  const url = new URL(databaseUrl);
  url.pathname = `/${env.name}`;
  const pools: pg.Pool[] = [];
  const rows = async (
    sql: string,
    values?: unknown[],
  ): Promise<Record<string, unknown>[]> =>
    (await env.owner.query<Record<string, unknown>>(sql, values)).rows;
  const [attempt, otherAttempt] = attemptIds();
  if (!attempt || !otherAttempt) throw new Error("fixture attempts missing");
  return {
    env,
    ownerUrl: url.toString(),
    runtime: (max = 1) => {
      const pool = new pg.Pool({
        connectionString: env.runtimeUrl,
        options: "-c role=desk_runtime",
        max,
      });
      pools.push(pool);
      return pool;
    },
    attempt,
    otherAttempt,
    providerCalls: async () =>
      Number((await rows("SELECT count(*) AS n FROM provider_calls"))[0]?.n),
    events: async () =>
      Number(
        (await rows("SELECT count(*) AS n FROM provider_call_events"))[0]?.n,
      ),
    rows,
    close: async () => {
      await Promise.all(pools.map((p) => p.end().catch(() => undefined)));
      await env.close();
    },
  };
}
