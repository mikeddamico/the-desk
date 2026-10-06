import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { TestCluster } from "../support/db-env.js";
import {
  seedPrerequisites,
  attemptIds,
  prepareUnitsAndSupports,
  fixturePackageArtifact,
} from "../support/a5-fixture.js";
import { noopContext, capturingContext } from "../support/a6-observed.js";
import { nonNetworkControls } from "../support/a5-provider.js";
import {
  executeProviderCall,
  lookupProviderCall,
  reconcileProviderCall,
  reserveProviderCall,
  recordProviderOutcome,
  type AuthoredOutcome,
  type AuthoredReservation,
  type ProviderRequest,
} from "../../src/runtime/provider.js";
import {
  buildCertificate,
  requestHash,
  invocationHash,
  type Invocation,
  type FinalReceipt,
  type ReceiptPacket,
  type Policy,
  type AdmissionRequest,
  type Certificate,
} from "../../src/runtime/provider-admission.js";
import {
  canonicalJson,
  domainHash,
  sha256,
} from "../../src/identity/canonical-json.js";
import { g1Child } from "../support/g1-provider-process.js";
import { observe } from "../support/a5-crash.js";
import { Rejection } from "../../src/runtime/command.js";
import {
  createProgramRun,
  createProgramAttempt,
} from "../../src/runtime/program.js";
import {
  persistEvidencePackage,
  bindPackage,
} from "../../src/runtime/package.js";
import {
  loadFoundationRows,
  loadFingerprintVectors,
} from "../../src/fixture/loader.js";
import { families } from "../../src/fixture/families.js";
import { persistFixture } from "../../src/fixture/persist.js";
import { fingerprint } from "../../src/identity/fingerprints.js";
import {
  SimulationEvidence,
  simulationPolicy,
  simulationRequest,
  invocationObservation,
  receiptPacket,
} from "../support/g1-provider-admission-receipt.js";

function jsonObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("expected PostgreSQL JSON object");
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    throw new Error("expected plain PostgreSQL JSON object");
  return value as Record<string, unknown>;
}

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
let cluster: TestCluster | undefined;
async function protectedRows(owner: pg.Pool): Promise<string> {
  const list = (
    await owner.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows as { tablename: string }[];
  const rows: unknown[] = [];
  for (const { tablename } of list) {
    const value = await owner.query<{ value: string }>(
      `SELECT coalesce(jsonb_agg(jsonb_build_object('row',to_jsonb(t),'xmin',xmin::text,'ctid',ctid::text) ORDER BY to_jsonb(t)::text),'[]')::text AS value FROM "${tablename}" t`,
    );
    rows.push([tablename, value.rows[0]?.value]);
  }
  return JSON.stringify(rows);
}
interface PhaseCounters {
  connect: number;
  clientQuery: number;
  poolQuery: number;
  effects: number;
  lookups: number;
  finishes: number;
  appends: number;
  packetDescriptors: number;
  packetAccessors: number;
}
function phaseCounters(): PhaseCounters {
  return {
    connect: 0,
    clientQuery: 0,
    poolQuery: 0,
    effects: 0,
    lookups: 0,
    finishes: 0,
    appends: 0,
    packetDescriptors: 0,
    packetAccessors: 0,
  };
}
// Local test instrumentation only. Parent truth reads deliberately use the independent owner pool.
function measuredPool(
  pool: pg.Pool,
  counts: PhaseCounters,
  query: (
    text: unknown,
    native: () => Promise<unknown>,
  ) => Promise<unknown> = async (_text, native) => native(),
  release?: () => void,
): pg.Pool {
  return new Proxy(pool, {
    get(target, key) {
      if (key === "connect")
        return async () => {
          counts.connect++;
          const client = await target.connect();
          return new Proxy(client, {
            get(connection, name) {
              if (name === "query")
                return (...args: unknown[]) => {
                  counts.clientQuery++;
                  return query(args[0], () =>
                    Promise.resolve(
                      Reflect.apply(
                        Reflect.get(connection, "query"),
                        connection,
                        args,
                      ),
                    ),
                  );
                };
              if (name === "release")
                return (...args: unknown[]) => {
                  Reflect.apply(
                    Reflect.get(connection, "release"),
                    connection,
                    args,
                  );
                  release?.();
                };
              const value: unknown = Reflect.get(connection, name, connection);
              return typeof value === "function"
                ? (...args: unknown[]): unknown =>
                    Reflect.apply(value, connection, args)
                : value;
            },
          });
        };
      if (key === "query")
        return (...args: unknown[]): unknown => {
          counts.poolQuery++;
          return Reflect.apply(Reflect.get(target, "query"), target, args);
        };
      const value: unknown = Reflect.get(target, key, target);
      return typeof value === "function"
        ? (...args: unknown[]): unknown => Reflect.apply(value, target, args)
        : value;
    },
  });
}
async function databaseCounterControls(
  pool: pg.Pool,
  counts: PhaseCounters,
): Promise<void> {
  const before = { ...counts };
  await pool.query("SELECT 1");
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
  expect(counts.connect - before.connect).toBe(1);
  expect(counts.clientQuery - before.clientQuery).toBe(1);
  expect(counts.poolQuery - before.poolQuery).toBe(1);
}
async function evidenceRows(owner: pg.Pool): Promise<unknown[]> {
  return (
    await owner.query<{
      evidence_id: string;
      provider_call_id: string;
      record_kind: string;
      bytes: string;
      content_hash: string;
      captured_at: string;
      xmin: string;
      ctid: string;
    }>(
      "SELECT evidence_id::text,provider_call_id::text,record_kind,encode(canonical_bytes,'hex') AS bytes,content_hash,captured_at::text,xmin::text,ctid::text FROM g1_b_fixture_evidence.receipts ORDER BY record_kind",
    )
  ).rows;
}
// Observe D's existing two-int key; these queries acquire no locks and identify only named test workers.
const D_HOLDER_SQL = `SELECT a.pid FROM pg_stat_activity a JOIN pg_locks l USING(pid)
  WHERE a.datname=$1 AND a.application_name=$2 AND a.state='idle in transaction'
    AND a.backend_xid IS NOT NULL AND a.xact_start IS NOT NULL
    AND l.database=a.datid AND l.granted AND l.locktype='advisory'
    AND l.mode='ExclusiveLock' AND l.classid=182736456 AND l.objid=1 AND l.objsubid=2`;
const D_WAITER_SQL = `SELECT a.pid,a.application_name,pg_blocking_pids(a.pid) AS blockers
  FROM pg_stat_activity a JOIN pg_locks l USING(pid)
  WHERE a.datname=$1 AND a.application_name=$2 AND a.pid<>$3
    AND a.state='active' AND a.wait_event_type='Lock' AND a.wait_event='advisory'
    AND l.database=a.datid AND NOT l.granted AND l.locktype='advisory'
    AND l.mode='ExclusiveLock' AND l.classid=182736456 AND l.objid=1 AND l.objsubid=2
    AND $3=ANY(pg_blocking_pids(a.pid))`;
async function nonLedgerRows(owner: pg.Pool): Promise<string> {
  // Preserve the full snapshots used by existing tests; only this separately named comparison excludes the two expected ledger effects.
  const all = JSON.parse(await protectedRows(owner)) as [string, unknown][];
  return JSON.stringify(
    all.filter(
      ([name]) => name !== "provider_calls" && name !== "provider_call_events",
    ),
  );
}
suite("G1-B original-bound controlled runtime", () => {
  beforeAll(async () => {
    if (!url) throw new Error("synthetic PG required");
    cluster = new TestCluster(url);
    await cluster.bootstrap();
  }, 120000);
  afterAll(async () => {
    await cluster?.shutdown();
  }, 120000);
  async function setup(pinned = false) {
    if (!cluster) throw new Error("test cluster not initialized");
    const env = await cluster.create({ migrate: true });
    if (pinned) expect((await persistFixture(env.migrator)).rows).toBe(398);
    else await seedPrerequisites(env.migrator);
    const evidence = new SimulationEvidence(env.owner);
    await evidence.initialize();
    const attempt = attemptIds()[0];
    if (!attempt) throw new Error("attempt missing");
    const request = simulationRequest();
    const reservation: AuthoredReservation = {
      provider_call_id: randomUUID(),
      attempt_id: attempt,
      provider: "g1-simulator",
      operation: "g1_sim_text",
      model_identifier: "bytes-v1",
      request_fingerprint: requestHash(request),
      logical_request_key: "runtime:" + randomUUID(),
      operational_try_number: 1,
      intentional_take_index: null,
      retry_of_provider_call_id: null,
      reroll_of_provider_call_id: null,
      reroll_trigger_id: null,
      started_at: "2026-10-06T00:00:00.000001Z",
    };
    const invocation: Invocation = {
      schema: "g1-sim-invocation/1",
      policy: simulationPolicy(),
      request,
      lock_timeout_ms: 5000,
      statement_timeout_ms: 10000,
      expected_original_certificate_hash: null,
    };
    const controls = {
      ...nonNetworkControls(),
      simulation_admission: invocation,
    };
    let performs = 0,
      finishes = 0;
    const adapter = {
      async perform(r: ProviderRequest): Promise<ReceiptPacket> {
        performs++;
        const a = r.admission;
        if (!a) throw new Error("simulation admission missing");
        // Measure the ACTUAL request/cap delivered by runtime; completion is a separate durable test-producer append.
        expect(a.request).toEqual(request);
        expect(Object.isFrozen(a.certificate)).toBe(true);
        const io = invocationObservation(a.certificate, a.request);
        await evidence.append(io);
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
          event: {
            provider_call_id: r.provider_call_id,
            event_type: "succeeded",
            ended_at: "2026-10-06T00:00:01.000001Z",
            usage: { input_bytes: 2, output_bytes: 1 },
            actual_cost: "0.02",
            currency: "USD",
            response_artifact_id: null,
            response_reference: "retained-é",
          },
        };
        await evidence.append(fr);
        return receiptPacket(io, fr);
      },
      async lookup(r: ProviderRequest) {
        const result = await evidence.retrieve(r.provider_call_id);
        return result
          ? {
              provider_call_id: r.provider_call_id,
              logical_request_key: r.logical_request_key,
              request_fingerprint: r.request_fingerprint,
              result,
            }
          : undefined;
      },
    };
    const finish = () => {
      finishes++;
      throw new Error("PROTECTED_GENERIC_FINISH_CANARY");
    };
    return {
      env,
      evidence,
      reservation,
      invocation,
      controls,
      adapter,
      finish,
      counts: () => ({ performs, finishes }),
    };
  }
  async function fixtureBodies(s: Awaited<ReturnType<typeof setup>>) {
    const run = (
      await s.env.owner.query<{ id: string }>(
        "SELECT program_run_id::text AS id FROM program_run_attempts WHERE attempt_id=$1",
        [s.reservation.attempt_id],
      )
    ).rows[0]?.id;
    if (typeof run !== "string")
      throw new Error("expected actual attempt run identity");
    const certificate = buildCertificate(
      s.reservation,
      run,
      s.invocation.policy,
      s.invocation.request,
    );
    const io = invocationObservation(certificate, s.invocation.request);
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
      event: {
        provider_call_id: s.reservation.provider_call_id,
        event_type: "succeeded",
        ended_at: "2026-10-06T00:00:01.000001Z",
        usage: { input_bytes: 2, output_bytes: 1 },
        actual_cost: "0.02",
        currency: "USD",
        response_artifact_id: null,
        response_reference: null,
      },
    };
    return { io, fr };
  }
  function phaseProducer(
    s: Awaited<ReturnType<typeof setup>>,
    counts: PhaseCounters,
  ) {
    let produced: ReceiptPacket | undefined,
      final: FinalReceipt | undefined,
      actualRequest: ProviderRequest | undefined;
    return {
      async perform(request: ProviderRequest): Promise<ReceiptPacket> {
        counts.effects++;
        actualRequest = request;
        if (!request.admission)
          throw new Error("test requires original certificate");
        expect(request.admission.request).toEqual(s.invocation.request);
        const io = invocationObservation(
          request.admission.certificate,
          request.admission.request,
        );
        final = {
          schema: "g1-sim-final-receipt/1",
          receipt_id: randomUUID(),
          kind: "final_accounting",
          invocation_observation_hash: invocationHash(io),
          attribution: io.attribution,
          consumption: io.consumption,
          work_ended: true,
          observed_output_bytes: 1,
          price_status: "known_final",
          event: {
            provider_call_id: request.provider_call_id,
            event_type: "succeeded",
            ended_at: "2026-10-06T00:00:01.000001Z",
            usage: { input_bytes: 2, output_bytes: 1 },
            actual_cost: "0.02",
            currency: "USD",
            response_artifact_id: null,
            response_reference: "retained-é",
          },
        };
        await s.evidence.append(io);
        counts.appends++;
        await s.evidence.append(final);
        counts.appends++;
        produced = receiptPacket(io, final);
        return produced;
      },
      async lookup(request: ProviderRequest) {
        counts.lookups++;
        const result = await s.evidence.retrieve(request.provider_call_id);
        return result
          ? {
              provider_call_id: request.provider_call_id,
              logical_request_key: request.logical_request_key,
              request_fingerprint: request.request_fingerprint,
              result,
            }
          : undefined;
      },
      bodies: () => ({ packet: produced, final, request: actualRequest }),
    };
  }
  async function assertOriginalPacket(
    s: Awaited<ReturnType<typeof setup>>,
    producer: ReturnType<typeof phaseProducer>,
  ) {
    const { packet, final, request } = producer.bodies();
    if (!packet || !final || !request?.admission)
      throw new Error("actual producer bodies required");
    const original = await lookupProviderCall(
      s.env.runtime,
      s.reservation.provider_call_id,
    );
    expect(original?.admission?.certificate).toEqual(
      request.admission.certificate,
    );
    expect(original?.admission?.certificate_hash).toBe(
      final.attribution.admission_certificate_hash,
    );
    expect(final.attribution.provider_call_id).toBe(
      s.reservation.provider_call_id,
    );
    expect(final.consumption.input_text_hash).toBe(
      sha256(Buffer.from(s.invocation.request.input_text, "utf8")),
    );
    expect(final.consumption.input_bytes).toBe(
      Buffer.byteLength(s.invocation.request.input_text, "utf8"),
    );
    expect(final.consumption.consumed_output_cap).toBe(
      s.invocation.request.max_output_bytes,
    );
    expect(final.consumption.computed_request_fingerprint).toBe(
      s.reservation.request_fingerprint,
    );
    expect(await s.evidence.retrieve(s.reservation.provider_call_id)).toEqual(
      packet,
    );
    const rows = await evidenceRows(s.env.owner);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const typed = row as {
        record_kind: string;
        bytes: string;
        content_hash: string;
      };
      const bytes = Buffer.from(typed.bytes, "hex"),
        domain =
          typed.record_kind === "invocation"
            ? "provider-sim-invocation-observation-v1"
            : "provider-sim-final-receipt-v1";
      expect(sha256(Buffer.concat([Buffer.from(domain + "\n"), bytes]))).toBe(
        typed.content_hash,
      );
      expect(bytes.toString("utf8")).toBe(
        typed.record_kind === "invocation"
          ? packet.invocation_json
          : packet.final_json,
      );
    }
    return { original, packet, final };
  }
  function accountingInvocation(
    s: Awaited<ReturnType<typeof setup>>,
    changes: Partial<Policy> = {},
  ): Invocation {
    const policy = structuredClone(s.invocation.policy);
    policy.attempt_cost_ceiling = "100";
    policy.run_cost_ceiling = "100";
    policy.utc_day_cost_ceiling = "100";
    policy.max_concurrent_global = 100;
    policy.provider_rule.max_concurrent = 100;
    policy.max_operational_retries_per_chain = 100;
    policy.max_operational_retries_per_attempt = 100;
    policy.max_operational_retries_per_run = 100;
    policy.max_operational_retries_per_utc_day = 100;
    return { ...s.invocation, policy: { ...policy, ...changes } };
  }
  function accountingReservation(
    s: Awaited<ReturnType<typeof setup>>,
    attempt = s.reservation.attempt_id,
    changes: Partial<AuthoredReservation> = {},
  ): AuthoredReservation {
    return {
      ...s.reservation,
      provider_call_id: randomUUID(),
      logical_request_key: "accounting:" + randomUUID(),
      attempt_id: attempt,
      ...changes,
    };
  }
  async function legalPopulation(
    s: Awaited<ReturnType<typeof setup>>,
    repair = false,
  ) {
    const source = (
      await s.env.owner.query<{
        show_id: string;
        show_config_version_id: string;
        config_hash: string;
      }>(
        `SELECT c.show_id::text,a.show_config_version_id::text,c.config_hash
      FROM program_run_attempts a JOIN show_config_versions c USING(show_config_version_id) WHERE a.attempt_id=$1`,
        [s.reservation.attempt_id],
      )
    ).rows[0];
    if (!source) throw new Error("legal config prerequisite missing");
    const run = randomUUID(),
      otherRun = randomUUID(),
      parent = randomUUID(),
      sibling = randomUUID(),
      other = randomUUID();
    for (const id of [run, otherRun])
      expect(
        (
          await createProgramRun(s.env.runtime, {
            program_run_id: id,
            show_id: source.show_id,
            purpose: "production",
            created_at: "2026-10-06T00:00:00.000001Z",
          })
        ).kind,
      ).toBe("created");
    for (const [id, runId] of [
      [parent, run],
      [sibling, run],
      [other, otherRun],
    ] as const)
      expect(
        (
          await createProgramAttempt(s.env.runtime, {
            attempt_id: id,
            program_run_id: runId,
            show_config_version_id: source.show_config_version_id,
            created_at: "2026-10-06T00:00:00.000001Z",
          })
        ).kind,
      ).toBe("created");
    let child: string | undefined, plan: string | undefined;
    if (repair) {
      // Test-only structural repair prerequisites, never production stage effects/repair execution.
      // Use the actual governed Evidence Package commands and exact pinned synthetic master rows, guards always enabled.
      await prepareUnitsAndSupports(s.env.migrator, s.env.runtime);
      const pkg = fixturePackageArtifact();
      expect((await persistEvidencePackage(s.env.runtime, pkg)).kind).toBe(
        "created",
      );
      expect(
        (
          await bindPackage(s.env.runtime, {
            attemptId: parent,
            evidencePackageId: pkg.evidence_package_id,
          })
        ).kind,
      ).toBe("created");
      const vector = loadFingerprintVectors().ready_candidate;
      if (!vector) throw new Error("pinned READY projection required");
      const master = vector.input_projection.master_artifact_id;
      const tables = loadFoundationRows().tables as unknown as Record<
        string,
        Record<string, unknown>[]
      >;
      for (const name of ["artifacts", "audio_artifacts"]) {
        const row = tables[name]?.find((value) => value.artifact_id === master),
          family = families.find((value) => value.table === name);
        if (!row || !family)
          throw new Error("exact pinned master prerequisite missing");
        await s.env.migrator.query(
          `INSERT INTO "${name}" (${family.columns.map((column) => `"${column}"`).join(",")}) VALUES (${family.columns.map((_, i) => "$" + String(i + 1)).join(",")})`,
          family.columns.map((column) =>
            family.jsonb.includes(column)
              ? JSON.stringify(row[column])
              : row[column],
          ),
        );
      }
      const stages = [
        "PENDING",
        "EVIDENCE_READY",
        "PACKAGED",
        "PLANNED",
        "SCRIPTED",
        "PERFORMANCE_DIRECTED",
        "AUDITED",
        "RENDER_PLANNED",
        "SYNTHESIZED",
        "ASSEMBLED",
        "VALIDATED",
      ];
      for (let i = 1; i < stages.length; i++)
        await s.env.runtime.query("SELECT transition_attempt($1,$2,$3)", [
          parent,
          stages[i - 1],
          stages[i],
        ]);
      const ready = fingerprint("ready_candidate", {
        ...vector.input_projection,
        program_run_id: run,
        attempt_id: parent,
        show_config_version_hash: source.config_hash,
      });
      await s.env.runtime.query(
        "SELECT transition_attempt($1,'VALIDATED','READY',$2,$3)",
        [parent, ready, master],
      );
      const version = (
        await s.env.owner.query<{ id: string }>(
          "SELECT episode_version_id::text AS id FROM episode_versions WHERE attempt_id=$1",
          [parent],
        )
      ).rows[0]?.id;
      const actor = (
        await s.env.owner.query<{ id: string }>(
          "SELECT account_id::text AS id FROM accounts WHERE actor_kind='human' ORDER BY account_id LIMIT 1",
        )
      ).rows[0]?.id;
      if (!version || !actor)
        throw new Error("guarded review prerequisites missing");
      const operator = await s.env.owner.connect();
      try {
        await operator.query("BEGIN ISOLATION LEVEL READ COMMITTED");
        await operator.query("SET LOCAL ROLE desk_operator");
        await operator.query(
          "INSERT INTO review_decisions(episode_version_id,ready_candidate_fingerprint,actor_id,decision) VALUES($1,$2,$3,'request_repair')",
          [version, ready, actor],
        );
        await operator.query("COMMIT");
      } finally {
        await operator.query("ROLLBACK");
        operator.release();
      }
      const request = (
        await s.env.runtime.query<{ id: string }>(
          "INSERT INTO repair_requests(source_attempt_id,source_ready_fingerprint,actor_id,feedback) VALUES($1,$2,$3,'test-only accounting lineage') RETURNING repair_request_id::text AS id",
          [parent, ready, actor],
        )
      ).rows[0]?.id;
      plan = (
        await s.env.runtime.query<{ id: string }>(
          "INSERT INTO repair_plans(repair_request_id,plan_version,typed_plan) VALUES($1,1,$2) RETURNING repair_plan_id::text AS id",
          [request, { repair_layer: "performance" }],
        )
      ).rows[0]?.id;
      if (!request || !plan) throw new Error("legal causal plan missing");
      const confirmation = await s.env.owner.connect();
      try {
        await confirmation.query("BEGIN ISOLATION LEVEL READ COMMITTED");
        await confirmation.query("SET LOCAL ROLE desk_operator");
        await confirmation.query(
          "INSERT INTO repair_plan_decisions(repair_plan_id,actor_id,decision) VALUES($1,$2,'confirm')",
          [plan, actor],
        );
        await confirmation.query("COMMIT");
      } finally {
        await confirmation.query("ROLLBACK");
        confirmation.release();
      }
      child = randomUUID();
      await s.env.runtime.query(
        `INSERT INTO program_run_attempts(attempt_id,program_run_id,show_config_version_id,evidence_package_id,parent_attempt_id,repair_plan_id,publication_enabled)
        VALUES($1,$2,$3,$4,$5,$6,false)`,
        [
          child,
          run,
          source.show_config_version_id,
          pkg.evidence_package_id,
          parent,
          plan,
        ],
      );
      const causal = (
        await s.env.owner.query<{
          program_run_id: string;
          parent_attempt_id: string | null;
          repair_plan_id: string | null;
          evidence_package_id: string | null;
          show_config_version_id: string;
          publication_enabled: boolean;
          state: string;
          parent_state: string;
          source_attempt_id: string;
          plan_decision: string;
          review_decision: string;
        }>(
          `SELECT a.program_run_id::text,a.parent_attempt_id::text,a.repair_plan_id::text,a.evidence_package_id::text,
        a.show_config_version_id::text,a.publication_enabled,a.state::text,p.state::text AS parent_state,r.source_attempt_id::text,
        d.decision AS plan_decision,review.decision AS review_decision
        FROM program_run_attempts a JOIN program_run_attempts p ON p.attempt_id=a.parent_attempt_id
        JOIN repair_plans rp ON rp.repair_plan_id=a.repair_plan_id JOIN repair_requests r USING(repair_request_id)
        JOIN repair_plan_decisions d ON d.repair_plan_id=rp.repair_plan_id
        JOIN episode_versions v ON v.attempt_id=r.source_attempt_id AND v.ready_candidate_fingerprint=r.source_ready_fingerprint
        JOIN review_decisions review USING(episode_version_id) WHERE a.attempt_id=$1`,
          [child],
        )
      ).rows[0];
      expect(causal).toEqual({
        program_run_id: run,
        parent_attempt_id: parent,
        repair_plan_id: plan,
        evidence_package_id: pkg.evidence_package_id,
        show_config_version_id: source.show_config_version_id,
        publication_enabled: false,
        state: "PENDING",
        parent_state: "READY",
        source_attempt_id: parent,
        plan_decision: "confirm",
        review_decision: "request_repair",
      });
    }
    const ids = [parent, sibling, other, ...(child ? [child] : [])];
    const links = (
      await s.env.owner.query<{
        attempt_id: string;
        program_run_id: string;
        parent_attempt_id: string | null;
      }>(
        "SELECT attempt_id::text,program_run_id::text,parent_attempt_id::text FROM program_run_attempts WHERE attempt_id=ANY($1::uuid[]) ORDER BY attempt_id",
        [ids],
      )
    ).rows;
    expect(links).toHaveLength(ids.length);
    for (const row of links) {
      expect(row.program_run_id).toBe(
        row.attempt_id === other ? otherRun : run,
      );
      expect(row.parent_attempt_id).toBe(
        row.attempt_id === child ? parent : null,
      );
    }
    return { run, otherRun, parent, sibling, other, child };
  }
  async function accountingCall(
    s: Awaited<ReturnType<typeof setup>>,
    reservation: AuthoredReservation,
    invocation: Invocation,
    options: {
      noInvoke?: boolean;
      cost?: string | null;
      workEnded?: boolean | null;
      eventType?: "succeeded" | "retryable_failure";
      consumedText?: string;
    } = {},
  ) {
    const counts = phaseCounters(),
      context = capturingContext(),
      control = new AbortController();
    let reservationAttempts = 0,
      recordAttempts = 0,
      io: Parameters<typeof receiptPacket>[0] | undefined,
      fr: FinalReceipt | undefined;
    const pool = measuredPool(s.env.runtime, counts, async (text, native) => {
      if (
        typeof text === "string" &&
        text.includes("INSERT INTO provider_calls")
      )
        reservationAttempts++;
      if (
        typeof text === "string" &&
        text.includes("INSERT INTO provider_call_events")
      )
        recordAttempts++;
      return native();
    });
    const hook = Symbol.for("the-desk.a5.test-fault-hook"),
      previous = Object.getOwnPropertyDescriptor(globalThis, hook),
      priorFlag = process.env.DESK_TEST_FAULTS;
    if (options.noInvoke) {
      process.env.DESK_TEST_FAULTS = "1";
      Object.defineProperty(globalThis, hook, {
        configurable: true,
        value: (point: string) => {
          if (point === "after_reservation_commit") control.abort();
        },
      });
    }
    try {
      const result = await executeProviderCall(
        pool,
        reservation,
        {
          async perform(actual: ProviderRequest) {
            counts.effects++;
            if (!actual.admission)
              throw new Error("actual ORIGINAL admission required");
            expect(actual.admission.request).toEqual(invocation.request);
            const consumed = {
              ...actual.admission.request,
              input_text:
                options.consumedText ?? actual.admission.request.input_text,
            };
            io = invocationObservation(actual.admission.certificate, consumed);
            await s.evidence.append(io);
            counts.appends++;
            const cost = options.cost === undefined ? "0" : options.cost;
            fr = {
              schema: "g1-sim-final-receipt/1",
              receipt_id: randomUUID(),
              kind: "final_accounting",
              invocation_observation_hash: invocationHash(io),
              attribution: io.attribution,
              consumption: io.consumption,
              work_ended:
                options.workEnded === undefined ? true : options.workEnded,
              observed_output_bytes: 1,
              price_status: cost === null ? "unknown_final" : "known_final",
              event: {
                provider_call_id: actual.provider_call_id,
                event_type: options.eventType ?? "succeeded",
                ended_at: "2026-10-06T00:00:01.000001Z",
                usage: {
                  input_bytes: Buffer.byteLength(consumed.input_text, "utf8"),
                  output_bytes: 1,
                },
                actual_cost: cost,
                currency: cost === null ? null : "USD",
                response_artifact_id: null,
                response_reference: "original-accounting-é",
              },
            };
            await s.evidence.append(fr);
            counts.appends++;
            return receiptPacket(io, fr);
          },
        },
        () => {
          counts.finishes++;
          throw new Error("UNUSED_ACCOUNTING_FINISH_CANARY");
        },
        context.context,
        {
          ...s.controls,
          simulation_admission: invocation,
          signal: control.signal,
        },
      );
      expect(counts.finishes).toBe(0);
      expect(
        JSON.stringify(context.events) + JSON.stringify(result),
      ).not.toContain("CANARY");
      return {
        result,
        counts,
        reservationAttempts,
        recordAttempts,
        io,
        fr,
        events: context.events,
      };
    } finally {
      if (options.noInvoke) {
        if (previous) Object.defineProperty(globalThis, hook, previous);
        else Reflect.deleteProperty(globalThis, hook);
        if (priorFlag === undefined) delete process.env.DESK_TEST_FAULTS;
        else process.env.DESK_TEST_FAULTS = priorFlag;
      }
    }
  }
  async function assertAccountingReceipt(
    s: Awaited<ReturnType<typeof setup>>,
    reservation: AuthoredReservation,
    produced: Awaited<ReturnType<typeof accountingCall>>,
  ) {
    if (!produced.io || !produced.fr)
      throw new Error("actual durable IO and completion required");
    const call = await lookupProviderCall(
      s.env.runtime,
      reservation.provider_call_id,
    );
    expect(call?.reservation).toEqual(reservation);
    expect(call?.outcome).toEqual(produced.fr.event);
    expect(call?.admission?.certificate_hash).toBe(
      produced.io.attribution.admission_certificate_hash,
    );
    const packet = await s.evidence.retrieve(reservation.provider_call_id);
    expect(packet).toEqual(receiptPacket(produced.io, produced.fr));
    const rows = (
      await s.env.owner.query(
        "SELECT evidence_id::text,record_kind,canonical_bytes,content_hash FROM g1_b_fixture_evidence.receipts WHERE provider_call_id=$1 ORDER BY record_kind",
        [reservation.provider_call_id],
      )
    ).rows as {
      evidence_id: string;
      record_kind: string;
      canonical_bytes: Buffer;
      content_hash: string;
    }[];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const body = row.record_kind === "invocation" ? produced.io : produced.fr,
        domain =
          row.record_kind === "invocation"
            ? "provider-sim-invocation-observation-v1"
            : "provider-sim-final-receipt-v1";
      expect(row.evidence_id).toBe(
        row.record_kind === "invocation"
          ? produced.io.observation_id
          : produced.fr.receipt_id,
      );
      expect(row.canonical_bytes).toEqual(
        Buffer.from(canonicalJson(body), "utf8"),
      );
      expect(
        sha256(
          Buffer.concat([Buffer.from(domain + "\n"), row.canonical_bytes]),
        ),
      ).toBe(row.content_hash);
    }
    return call;
  }
  async function refusedAccounting(
    s: Awaited<ReturnType<typeof setup>>,
    reservation: AuthoredReservation,
    invocation: Invocation,
    code: string,
  ) {
    const before = await protectedRows(s.env.owner),
      receipts = await evidenceRows(s.env.owner);
    const refused = await accountingCall(s, reservation, invocation);
    expect(refused.result).toEqual({
      status: "rejected",
      result: { kind: "rejected", code, sqlstate: "23514" },
    });
    // D's BEFORE ROW guard rejects one attempted INSERT; it creates ZERO rows/effects/outcome commands.
    expect(refused.reservationAttempts).toBe(1);
    expect(refused.recordAttempts).toBe(0);
    expect(refused.counts).toMatchObject({
      effects: 0,
      appends: 0,
      finishes: 0,
      lookups: 0,
    });
    expect(await protectedRows(s.env.owner)).toBe(before);
    expect(await evidenceRows(s.env.owner)).toEqual(receipts);
    return refused;
  }
  function childSpec(
    s: Awaited<ReturnType<typeof setup>>,
    reservation = s.reservation,
    invocation = s.invocation,
  ) {
    if (url === undefined) throw new Error("synthetic PG target required");
    const ownerUrl = new URL(url);
    ownerUrl.pathname = "/" + s.env.name;
    return {
      runtimeUrl: s.env.runtimeUrl,
      ownerUrl: ownerUrl.toString(),
      reservation,
      tag: "g1-b-certified-" + randomUUID(),
      simulation: { invocation },
    };
  }
  async function childResult(child: ReturnType<typeof g1Child>) {
    const exit = await child.exited();
    expect(exit.code).toBe(0);
    expect(exit.signal).toBeNull();
    expect(exit.stdout + exit.stderr).not.toContain("CANARY");
    const lines = exit.stdout
      .split("\n")
      .filter((line) => line.startsWith("RESULT "));
    expect(lines).toHaveLength(1);
    const line = lines[0];
    if (line === undefined) throw new Error("expected owned child RESULT line");
    const result: unknown = JSON.parse(line.slice(7));
    return result;
  }
  async function closeChildren(
    s: Awaited<ReturnType<typeof setup>>,
    children: ReturnType<typeof g1Child>[],
    tags: string[],
  ) {
    await Promise.all(children.map((child) => child.kill()));
    await observe(
      async () =>
        Number(
          (
            await s.env.owner.query<{ n: number }>(
              "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1 AND application_name=ANY($2::text[])",
              [s.env.name, tags],
            )
          ).rows[0]?.n,
        ) === 0,
      "only owned certified child backends gone",
      10000,
    );
  }
  async function assertChildPacket(
    s: Awaited<ReturnType<typeof setup>>,
    reservation: AuthoredReservation,
    invocation: Invocation,
  ) {
    const call = await lookupProviderCall(
      s.env.runtime,
      reservation.provider_call_id,
    );
    expect(call?.reservation).toEqual(reservation);
    if (!call?.admission)
      throw new Error("original acknowledged certification required");
    const certificate = call.admission.certificate;
    expect(certificate).toEqual(
      buildCertificate(
        reservation,
        certificate.program_run_id,
        invocation.policy,
        invocation.request,
      ),
    );
    expect(call.admission.certificate_hash).toBe(
      domainHash("provider-admission-certificate-v1", certificate),
    );
    const packet = await s.evidence.retrieve(reservation.provider_call_id);
    if (!packet) throw new Error("retained IO and FINAL required");
    const io = JSON.parse(packet.invocation_json) as Parameters<
        typeof receiptPacket
      >[0],
      fr = JSON.parse(packet.final_json) as FinalReceipt;
    const at = {
      provider_call_id: reservation.provider_call_id,
      attempt_id: reservation.attempt_id,
      program_run_id: certificate.program_run_id,
      provider: reservation.provider,
      operation: reservation.operation,
      model_identifier: reservation.model_identifier,
      logical_request_key: reservation.logical_request_key,
      request_fingerprint: reservation.request_fingerprint,
      admission_certificate_hash: call.admission.certificate_hash,
      admission_policy_hash: certificate.policy_hash,
    };
    const ct = {
      observation_state: "complete",
      input_text_hash: sha256(
        Buffer.from(invocation.request.input_text, "utf8"),
      ),
      input_bytes: Buffer.byteLength(invocation.request.input_text, "utf8"),
      consumed_output_cap: 3,
      computed_request_fingerprint: requestHash(invocation.request),
      consumed_certificate_hash: call.admission.certificate_hash,
      consumed_provider: reservation.provider,
      consumed_operation: reservation.operation,
      consumed_model_identifier: reservation.model_identifier,
    };
    expect(invocation.request.max_output_bytes).toBe(3);
    expect(io).toEqual({
      schema: "g1-sim-invocation-observation/1",
      observation_id: io.observation_id,
      kind: "invocation",
      attribution: at,
      consumption: ct,
      work_ended: null,
    });
    const expectedEvent = {
      provider_call_id: reservation.provider_call_id,
      event_type: "succeeded",
      ended_at: "2026-10-06T00:00:01.000001Z",
      usage: { input_bytes: ct.input_bytes, output_bytes: 1 },
      actual_cost: "0.02",
      currency: "USD",
      response_artifact_id: null,
      response_reference: null,
    };
    expect(fr).toEqual({
      schema: "g1-sim-final-receipt/1",
      receipt_id: fr.receipt_id,
      kind: "final_accounting",
      invocation_observation_hash: packet.invocation_hash,
      attribution: at,
      consumption: ct,
      work_ended: true,
      observed_output_bytes: 1,
      price_status: "known_final",
      event: expectedEvent,
    });
    const rows = (
      await s.env.owner.query(
        "SELECT evidence_id::text,provider_call_id::text,record_kind,canonical_bytes,content_hash FROM g1_b_fixture_evidence.receipts ORDER BY record_kind",
      )
    ).rows as {
      evidence_id: string;
      provider_call_id: string;
      record_kind: string;
      canonical_bytes: Buffer;
      content_hash: string;
    }[];
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.record_kind)).toEqual(["final", "invocation"]);
    for (const row of rows) {
      const body = row.record_kind === "invocation" ? io : fr,
        domain =
          row.record_kind === "invocation"
            ? "provider-sim-invocation-observation-v1"
            : "provider-sim-final-receipt-v1";
      expect(row.provider_call_id).toBe(reservation.provider_call_id);
      expect(row.evidence_id).toBe(
        row.record_kind === "invocation" ? io.observation_id : fr.receipt_id,
      );
      expect(row.canonical_bytes).toEqual(
        Buffer.from(canonicalJson(body), "utf8"),
      );
      expect(
        sha256(
          Buffer.concat([Buffer.from(domain + "\n"), row.canonical_bytes]),
        ),
      ).toBe(row.content_hash);
      expect(row.content_hash).toBe(
        row.record_kind === "invocation"
          ? packet.invocation_hash
          : packet.final_hash,
      );
    }
    return { call, packet, event: expectedEvent };
  }
  // Literal text/request digests independently calculated with Python hashlib + sorted compact JSON,
  // not requestHash/projectReceipt/SQL. Certificate IDs remain dynamic and are checked against durable ORIGINAL bytes.
  const measuredCases: {
    name: string;
    text: string;
    cap: number;
    used: "original" | "hash" | "provider" | "operation_invalid" | "model";
    output: string | null;
    inputBytes: number;
    outputBytes: number | null;
    hash: string;
    fingerprint: string;
    violations: string[];
  }[] = [
    {
      name: "actually empty input",
      text: "",
      cap: 3,
      used: "original",
      output: "x",
      inputBytes: 0,
      outputBytes: 1,
      hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      fingerprint:
        "82ce576fc0eb76ca4c15020a20a1b380c335ea277a2becc5263ef9847cd4a796",
      violations: [
        "input_hash_mismatch",
        "input_count_mismatch",
        "request_fingerprint_mismatch",
      ],
    },
    {
      name: "actually fewer input bytes",
      text: "a",
      cap: 3,
      used: "original",
      output: "x",
      inputBytes: 1,
      outputBytes: 1,
      hash: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
      fingerprint:
        "07551c0f3c046ea1e077b78170b2aa3240800bb5efe58b225bbf7f815763b4d8",
      violations: [
        "input_hash_mismatch",
        "input_count_mismatch",
        "request_fingerprint_mismatch",
      ],
    },
    {
      name: "actually more input bytes",
      text: "abc",
      cap: 3,
      used: "original",
      output: "x",
      inputBytes: 3,
      outputBytes: 1,
      hash: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      fingerprint:
        "e01d22505dfd5dedbede862f14c133186f98811e2dd3705ec6adcaa397d9eba5",
      violations: [
        "input_hash_mismatch",
        "input_count_mismatch",
        "request_fingerprint_mismatch",
      ],
    },
    {
      name: "lower consumed cap with output above only consumed cap",
      text: "ab",
      cap: 2,
      used: "original",
      output: "xyz",
      inputBytes: 2,
      outputBytes: 3,
      hash: "fb8e20fc2e4c3f248c60c39bd652f3c1347298bb977b8b4d5903b85055620603",
      fingerprint:
        "2d5ab28b35dd58b0429491743f70b2429eed3ff9231ad262ad925dfe99605493",
      violations: [
        "output_cap_mismatch",
        "request_fingerprint_mismatch",
        "output_over_cap",
      ],
    },
    {
      name: "higher consumed cap with output above only original cap",
      text: "ab",
      cap: 4,
      used: "original",
      output: "wxyz",
      inputBytes: 2,
      outputBytes: 4,
      hash: "fb8e20fc2e4c3f248c60c39bd652f3c1347298bb977b8b4d5903b85055620603",
      fingerprint:
        "91814bf89e61a23330ecd9d6226b648d8d9186eaa12b19963d8a9f9bf3c39575",
      violations: [
        "output_cap_mismatch",
        "request_fingerprint_mismatch",
        "output_over_cap",
      ],
    },
    {
      name: "coherent different certificate hash",
      text: "ab",
      cap: 3,
      used: "hash",
      output: "x",
      inputBytes: 2,
      outputBytes: 1,
      hash: "fb8e20fc2e4c3f248c60c39bd652f3c1347298bb977b8b4d5903b85055620603",
      fingerprint:
        "0eaf3fe9923a837297754f21f0df38fcc41043cfee22f2f7c3ec7cb2110fb293",
      violations: ["certificate_mismatch"],
    },
    {
      name: "coherent different used provider",
      text: "ab",
      cap: 3,
      used: "provider",
      output: "x",
      inputBytes: 2,
      outputBytes: 1,
      hash: "fb8e20fc2e4c3f248c60c39bd652f3c1347298bb977b8b4d5903b85055620603",
      fingerprint:
        "0eaf3fe9923a837297754f21f0df38fcc41043cfee22f2f7c3ec7cb2110fb293",
      violations: ["certificate_mismatch", "provider_mismatch"],
    },
    {
      name: "invalid used operation measured as incomplete, not coherent certificate",
      text: "ab",
      cap: 3,
      used: "operation_invalid",
      output: "x",
      inputBytes: 2,
      outputBytes: 1,
      hash: "fb8e20fc2e4c3f248c60c39bd652f3c1347298bb977b8b4d5903b85055620603",
      fingerprint:
        "0eaf3fe9923a837297754f21f0df38fcc41043cfee22f2f7c3ec7cb2110fb293",
      violations: ["certificate_unobserved", "operation_mismatch"],
    },
    {
      name: "coherent different used model",
      text: "ab",
      cap: 3,
      used: "model",
      output: "x",
      inputBytes: 2,
      outputBytes: 1,
      hash: "fb8e20fc2e4c3f248c60c39bd652f3c1347298bb977b8b4d5903b85055620603",
      fingerprint:
        "0eaf3fe9923a837297754f21f0df38fcc41043cfee22f2f7c3ec7cb2110fb293",
      violations: ["certificate_mismatch", "model_mismatch"],
    },
    {
      name: "actual shorter valid output",
      text: "ab",
      cap: 3,
      used: "original",
      output: "é",
      inputBytes: 2,
      outputBytes: 2,
      hash: "fb8e20fc2e4c3f248c60c39bd652f3c1347298bb977b8b4d5903b85055620603",
      fingerprint:
        "0eaf3fe9923a837297754f21f0df38fcc41043cfee22f2f7c3ec7cb2110fb293",
      violations: [],
    },
    {
      name: "unknown output measurement at true end",
      text: "ab",
      cap: 3,
      used: "original",
      output: null,
      inputBytes: 2,
      outputBytes: null,
      hash: "fb8e20fc2e4c3f248c60c39bd652f3c1347298bb977b8b4d5903b85055620603",
      fingerprint:
        "0eaf3fe9923a837297754f21f0df38fcc41043cfee22f2f7c3ec7cb2110fb293",
      violations: ["output_count_unknown_at_end"],
    },
  ];
  async function measuredCall(
    s: Awaited<ReturnType<typeof setup>>,
    reservation: AuthoredReservation,
    invocation: Invocation,
    c: (typeof measuredCases)[number],
    currency = "USD",
  ) {
    const counts = phaseCounters(),
      context = capturingContext();
    let reserveAttempts = 0,
      recordAttempts = 0;
    const pool = measuredPool(s.env.runtime, counts, async (text, native) => {
      if (typeof text === "string") {
        if (text.includes("INSERT INTO provider_calls")) reserveAttempts++;
        if (text.includes("INSERT INTO provider_call_events")) recordAttempts++;
      }
      return native();
    });
    let io: Parameters<typeof receiptPacket>[0] | undefined,
      fr: FinalReceipt | undefined,
      original: Certificate | undefined,
      used: Certificate | undefined,
      actualInput: AdmissionRequest | undefined,
      originalValues: unknown;
    const untouched = await nonLedgerRows(s.env.owner);
    const result = await executeProviderCall(
      pool,
      reservation,
      {
        async perform(actual: ProviderRequest) {
          counts.effects++;
          if (!actual.admission) throw new Error("original admission required");
          original = actual.admission.certificate;
          originalValues = (
            await s.env.owner.query(
              "SELECT to_jsonb(c) AS row,xmin::text,ctid::text FROM provider_calls c WHERE provider_call_id=$1",
              [reservation.provider_call_id],
            )
          ).rows;
          actualInput = {
            ...actual.admission.request,
            input_text: c.text,
            max_output_bytes: c.cap,
          };
          used = original;
          if (
            c.used === "hash" ||
            c.used === "provider" ||
            c.used === "model"
          ) {
            const p = structuredClone(original.policy);
            if (c.used === "hash")
              p.policy_version = "locally-used-other-version";
            if (c.used === "provider")
              p.provider_rule.provider = "locally-used-provider";
            if (c.used === "model")
              p.provider_rule.model_identifier = "locally-used-model";
            used = buildCertificate(
              {
                ...reservation,
                provider: p.provider_rule.provider,
                model_identifier: p.provider_rule.model_identifier,
              },
              original.program_run_id,
              p,
              actual.admission.request,
            );
          }
          // No other operation is valid in the closed certificate profile. Measurement records the actually invalid use,
          // including null certificate hash, rather than claiming a coherent authorized alternative.
          if (c.used === "operation_invalid")
            used = { ...original, operation: "locally-used-operation" };
          io = invocationObservation(original, actualInput, used);
          await s.evidence.append(io);
          counts.appends++;
          const outputBytes =
            c.output === null ? null : Buffer.byteLength(c.output, "utf8");
          fr = {
            schema: "g1-sim-final-receipt/1",
            receipt_id: randomUUID(),
            kind: "final_accounting",
            invocation_observation_hash: invocationHash(io),
            attribution: io.attribution,
            consumption: io.consumption,
            work_ended: true,
            observed_output_bytes: outputBytes,
            price_status: "known_final",
            event: {
              provider_call_id: actual.provider_call_id,
              event_type: "succeeded",
              ended_at: "2026-10-06T00:00:01.000001Z",
              usage: {
                input_bytes: Buffer.byteLength(actualInput.input_text, "utf8"),
                output_bytes: outputBytes,
              },
              actual_cost: "0.02",
              currency,
              response_artifact_id: null,
              response_reference: "measured-é",
            },
          };
          await s.evidence.append(fr);
          counts.appends++;
          return receiptPacket(io, fr);
        },
      },
      () => {
        counts.finishes++;
        throw new Error("UNUSED_MEASURED_FINISH_CANARY");
      },
      context.context,
      { ...s.controls, simulation_admission: invocation },
    );
    expect(result).toMatchObject({
      status: "performed",
      outcome: { kind: "created" },
    });
    expect(counts).toMatchObject({
      effects: 1,
      appends: 2,
      finishes: 0,
      lookups: 0,
    });
    expect(reserveAttempts).toBe(1);
    expect(recordAttempts).toBe(1);
    expect(
      context.events.filter((e) => e.command === "provider_outcome.record"),
    ).toHaveLength(1);
    if (!io || !fr || !original || !used || !actualInput)
      throw new Error("actual consumed producer facts required");
    const expectedCt = {
      observation_state:
        c.used === "operation_invalid" ? "incomplete" : "complete",
      input_text_hash: c.hash,
      input_bytes: c.inputBytes,
      consumed_output_cap: c.cap,
      computed_request_fingerprint: c.fingerprint,
      consumed_certificate_hash:
        c.used === "operation_invalid"
          ? null
          : domainHash("provider-admission-certificate-v1", used),
      consumed_provider: used.provider,
      consumed_operation: used.operation,
      consumed_model_identifier: used.model_identifier,
    };
    expect(io).toMatchObject({
      schema: "g1-sim-invocation-observation/1",
      kind: "invocation",
      work_ended: null,
    });
    expect(fr).toMatchObject({
      schema: "g1-sim-final-receipt/1",
      kind: "final_accounting",
      work_ended: true,
      observed_output_bytes: c.outputBytes,
    });
    expect(io.consumption).toEqual(expectedCt);
    expect(fr.consumption).toEqual(expectedCt);
    expect(fr.event.usage).toEqual({
      input_bytes: c.inputBytes,
      output_bytes: c.outputBytes,
    });
    const call = await lookupProviderCall(
      s.env.runtime,
      reservation.provider_call_id,
    );
    expect(call?.reservation).toEqual(reservation);
    expect(call?.admission?.certificate).toEqual(original);
    expect(io.attribution).toEqual({
      provider_call_id: reservation.provider_call_id,
      attempt_id: reservation.attempt_id,
      program_run_id: original.program_run_id,
      provider: reservation.provider,
      operation: reservation.operation,
      model_identifier: reservation.model_identifier,
      logical_request_key: reservation.logical_request_key,
      request_fingerprint: reservation.request_fingerprint,
      admission_certificate_hash: call?.admission?.certificate_hash,
      admission_policy_hash: original.policy_hash,
    });
    expect(fr.attribution).toEqual(io.attribution);
    expect(call?.outcome).toEqual(fr.event);
    expect(
      (
        await s.env.owner.query(
          "SELECT to_jsonb(c) AS row,xmin::text,ctid::text FROM provider_calls c WHERE provider_call_id=$1",
          [reservation.provider_call_id],
        )
      ).rows,
    ).toEqual(originalValues);
    const truth = (
      await s.env.owner.query<{
        provider_call_id: string;
        event_type: string;
        ended_at: string;
        usage: unknown;
        actual_cost: string | null;
        currency: string | null;
        response_artifact_id: string | null;
        response_reference: string | null;
        admission_settlement: unknown;
        admission_certificate: unknown;
        admission_certificate_hash: string | null;
      }>(
        `SELECT e.provider_call_id::text,e.event_type,to_char(e.ended_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS ended_at,
      e.usage,e.actual_cost::text,e.currency,e.response_artifact_id::text,e.response_reference,e.admission_settlement,
      c.admission_certificate,c.admission_certificate_hash FROM provider_call_events e JOIN provider_calls c USING(provider_call_id) WHERE e.provider_call_id=$1`,
        [reservation.provider_call_id],
      )
    ).rows[0];
    const expectedSettlement: unknown = expect.objectContaining({
      verification_status: "attributed_receipt",
      metadata_problem: "none",
      consumption: expectedCt,
      attribution: io.attribution,
      work_ended: true,
      observed_output_bytes: fr.observed_output_bytes,
      event_binding: fr.event,
      violations: [
        ...c.violations,
        ...(currency === "USD" ? [] : ["foreign_currency"]),
      ],
    });
    expect(truth).toEqual({
      ...fr.event,
      admission_settlement: expectedSettlement,
      admission_certificate: original,
      admission_certificate_hash: io.attribution.admission_certificate_hash,
    });
    const packet = await s.evidence.retrieve(reservation.provider_call_id);
    expect(packet).toEqual(receiptPacket(io, fr));
    const stored = (
      await s.env.owner.query(
        "SELECT evidence_id::text,provider_call_id::text,record_kind,canonical_bytes,content_hash FROM g1_b_fixture_evidence.receipts WHERE provider_call_id=$1 ORDER BY record_kind",
        [reservation.provider_call_id],
      )
    ).rows as {
      evidence_id: string;
      provider_call_id: string;
      record_kind: string;
      canonical_bytes: Buffer;
      content_hash: string;
    }[];
    expect(stored).toHaveLength(2);
    for (const row of stored) {
      const body = row.record_kind === "invocation" ? io : fr,
        domain =
          row.record_kind === "invocation"
            ? "provider-sim-invocation-observation-v1"
            : "provider-sim-final-receipt-v1";
      expect(row.provider_call_id).toBe(reservation.provider_call_id);
      expect(row.evidence_id).toBe(
        row.record_kind === "invocation" ? io.observation_id : fr.receipt_id,
      );
      expect(row.canonical_bytes).toEqual(
        Buffer.from(canonicalJson(body), "utf8"),
      );
      expect(
        sha256(
          Buffer.concat([Buffer.from(domain + "\n"), row.canonical_bytes]),
        ),
      ).toBe(row.content_hash);
    }
    expect(await nonLedgerRows(s.env.owner)).toBe(untouched);
    expect(JSON.stringify(context.events)).not.toContain("CANARY");
    return { call, packet, truth, counts };
  }
  it.each(measuredCases)(
    "ACTUAL measured callable $name preserves truthful original-bound outcome and independent ordered V",
    async (c) => {
      const s = await setup(),
        invocation = accountingInvocation(s),
        reservation = accountingReservation(s);
      const observed = await measuredCall(s, reservation, invocation, c);
      const before = await protectedRows(s.env.owner),
        receipts = await evidenceRows(s.env.owner);
      const next = await accountingCall(
        s,
        accountingReservation(s),
        invocation,
        { noInvoke: true },
      );
      if (c.violations.length) {
        expect(next.result).toEqual({
          status: "rejected",
          result: {
            kind: "rejected",
            code: "provider_admission_breach",
            sqlstate: "23514",
          },
        });
        expect(await protectedRows(s.env.owner)).toBe(before);
        expect(await evidenceRows(s.env.owner)).toEqual(receipts);
      } else
        expect(next.result).toMatchObject({
          status: "unfinished",
          reason: "provider_not_invoked_canceled",
        });
      expect(next.counts).toMatchObject({
        effects: 0,
        appends: 0,
        finishes: 0,
      });
      expect(next.recordAttempts).toBe(0);
      expect(await s.evidence.retrieve(reservation.provider_call_id)).toEqual(
        observed.packet,
      );
    },
    120000,
  );
  it("attributable ACTUAL fewer input plus foreign final money and another unresolved B remain immutable and block a FRESH child", async () => {
    const s = await setup(),
      invocation = accountingInvocation(s),
      occupied = accountingReservation(s);
    expect(
      (await accountingCall(s, occupied, invocation, { noInvoke: true }))
        .result,
    ).toMatchObject({ status: "unfinished" });
    const c = measuredCases.find(
      (value) => value.name === "actually fewer input bytes",
    );
    if (!c) throw new Error("literal measured case required");
    const reservation = accountingReservation(s),
      produced = await measuredCall(s, reservation, invocation, c, "EUR");
    expect(
      (await lookupProviderCall(s.env.runtime, occupied.provider_call_id))
        ?.outcome,
    ).toBeNull();
    const raw = (
      await s.env.owner.query<{ reserved_cost_upper_bound: string | null }>(
        "SELECT reserved_cost_upper_bound::text FROM provider_calls WHERE provider_call_id=$1",
        [occupied.provider_call_id],
      )
    ).rows[0];
    expect(raw).toEqual({ reserved_cost_upper_bound: "0.03" });
    const before = await protectedRows(s.env.owner),
      receipts = await evidenceRows(s.env.owner),
      spec = childSpec(s, accountingReservation(s), invocation),
      child = g1Child(spec);
    try {
      expect(await childResult(child)).toEqual({
        status: "rejected",
        result: {
          kind: "rejected",
          code: "provider_admission_breach",
          sqlstate: "23514",
        },
      });
      expect(await protectedRows(s.env.owner)).toBe(before);
      expect(await evidenceRows(s.env.owner)).toEqual(receipts);
      expect(await s.evidence.retrieve(reservation.provider_call_id)).toEqual(
        produced.packet,
      );
    } finally {
      await closeChildren(s, [child], [spec.tag]);
    }
  }, 120000);
  it.each([
    ["global", "rate"],
    ["provider", "rate"],
    ["global", "spacing"],
    ["provider", "spacing"],
  ] as const)(
    "REAL %s %s admission limit refuses before observed DB boundary, then one fresh admission passes; recovery consumes no slot",
    async (scope, limit) => {
      const s = await setup(),
        base = accountingInvocation(s),
        milliseconds = 8000;
      const policy = structuredClone(base.policy);
      policy.global_rate = {
        max_admissions: scope === "global" && limit === "rate" ? 1 : 100,
        window_ms: milliseconds,
        min_spacing_ms:
          scope === "global" && limit === "spacing" ? milliseconds : 0,
      };
      policy.provider_rule.rate = {
        max_admissions: scope === "provider" && limit === "rate" ? 1 : 100,
        window_ms: milliseconds,
        min_spacing_ms:
          scope === "provider" && limit === "spacing" ? milliseconds : 0,
      };
      const invocation = { ...base, policy },
        original = accountingReservation(s);
      const first = await accountingCall(s, original, invocation, {
        cost: "0",
        workEnded: true,
      });
      expect(first.result).toMatchObject({
        status: "performed",
        outcome: { kind: "created" },
      });
      await assertAccountingReceipt(s, original, first);
      const boundary = `SELECT admitted_at::text AS admitted,clock_timestamp()::text AS observed,
      clock_timestamp()<admitted_at+$2::integer*interval '1 millisecond' AS before_boundary,
      clock_timestamp()>=admitted_at+$2::integer*interval '1 millisecond' AS crossed
      FROM provider_calls WHERE provider_call_id=$1`;
      const admitted = (
        await s.env.owner.query<{
          before_boundary: boolean | null;
          crossed: boolean | null;
          admitted: string | null;
          observed: string;
        }>(boundary, [original.provider_call_id, milliseconds])
      ).rows[0];
      expect(admitted?.before_boundary).toBe(true);
      const beforeRecovery = await protectedRows(s.env.owner),
        originalReceipts = await evidenceRows(s.env.owner);
      const recovered = await accountingCall(s, original, invocation);
      expect(recovered.result).toMatchObject({ status: "completed" });
      expect(recovered.reservationAttempts).toBe(0);
      expect(recovered.recordAttempts).toBe(0);
      expect(recovered.counts).toMatchObject({
        effects: 0,
        appends: 0,
        finishes: 0,
      });
      expect(await protectedRows(s.env.owner)).toBe(beforeRecovery);
      expect(await evidenceRows(s.env.owner)).toEqual(originalReceipts);
      expect(
        (
          await s.env.owner.query<{
            before_boundary: boolean | null;
            crossed: boolean | null;
            admitted: string | null;
            observed: string;
          }>(boundary, [original.provider_call_id, milliseconds])
        ).rows[0]?.before_boundary,
      ).toBe(true);
      await refusedAccounting(
        s,
        accountingReservation(s),
        invocation,
        limit === "rate"
          ? "provider_admission_rate_limit"
          : "provider_admission_spacing_limit",
      );
      // Poll only DB time. No automatic execution retry/sleep/backoff, and no elapsed-delay claim.
      await observe(
        async () =>
          (
            await s.env.owner.query<{
              before_boundary: boolean | null;
              crossed: boolean | null;
              admitted: string | null;
              observed: string;
            }>(boundary, [original.provider_call_id, milliseconds])
          ).rows[0]?.crossed === true,
        "DB clock has crossed immutable admission boundary",
        20000,
      );
      const crossed = (
        await s.env.owner.query<{
          before_boundary: boolean | null;
          crossed: boolean | null;
          admitted: string | null;
          observed: string;
        }>(boundary, [original.provider_call_id, milliseconds])
      ).rows[0];
      expect(crossed?.crossed).toBe(true);
      expect(crossed?.admitted).toBe(admitted?.admitted);
      expect(
        (await lookupProviderCall(s.env.runtime, original.provider_call_id))
          ?.outcome,
      ).toEqual(first.fr?.event);
      const next = accountingReservation(s),
        once = await accountingCall(s, next, invocation, { noInvoke: true });
      expect(once.result).toMatchObject({
        status: "unfinished",
        reason: "provider_not_invoked_canceled",
      });
      expect(once.reservationAttempts).toBe(1);
      expect(once.recordAttempts).toBe(0);
      expect(once.counts).toMatchObject({
        effects: 0,
        appends: 0,
        finishes: 0,
      });
      expect(
        (
          await s.env.owner.query(
            "SELECT c.admitted_at>=prior.admitted_at+$3::integer*interval '1 millisecond' AS after_boundary,count(*) OVER()::int AS pairs FROM provider_calls c JOIN provider_calls prior ON prior.provider_call_id=$1 WHERE c.provider_call_id=$2",
            [original.provider_call_id, next.provider_call_id, milliseconds],
          )
        ).rows[0],
      ).toEqual({ after_boundary: true, pairs: 1 });
      expect(
        (
          await s.env.owner.query(
            "SELECT count(*)::int AS calls,count(e.provider_call_id)::int AS events FROM provider_calls c LEFT JOIN provider_call_events e USING(provider_call_id)",
          )
        ).rows[0],
      ).toEqual({ calls: 2, events: 1 });
      expect(await evidenceRows(s.env.owner)).toEqual(originalReceipts);
      expect(
        (await lookupProviderCall(s.env.runtime, original.provider_call_id))
          ?.outcome,
      ).toEqual(first.fr?.event);
      // Current accepted pin has one provider rule. Distinct-provider populations are proved by the
      // unchanged extracted-expression oracles, not fabricated as real admissible policy rows here.
    },
    120000,
  );
  it.each(["attempt", "run"] as const)(
    "REAL governed sibling/repair-child populations charge unknown/no-invocation B once; isolated %s equality and next quantum",
    async (scope) => {
      const s = await setup(),
        population = await legalPopulation(s, true);
      if (!population.child) throw new Error("real repair child required");
      const invocation = accountingInvocation(
        s,
        scope === "attempt"
          ? { attempt_cost_ceiling: "0.03" }
          : { run_cost_ceiling: "0.09" },
      );
      const calls = [
        population.parent,
        population.sibling,
        population.child,
      ].map((attempt) => accountingReservation(s, attempt));
      for (let i = 0; i < calls.length; i++) {
        const reservation = calls[i];
        if (!reservation) throw new Error("authored population missing");
        const produced = await accountingCall(
          s,
          reservation,
          invocation,
          i === 2 ? { cost: null, workEnded: true } : { noInvoke: true },
        );
        expect(produced.result).toMatchObject(
          i === 2
            ? { status: "performed", outcome: { kind: "created" } }
            : { status: "unfinished", reason: "provider_not_invoked_canceled" },
        );
        expect(produced.counts.effects).toBe(i === 2 ? 1 : 0);
        expect(produced.counts.appends).toBe(i === 2 ? 2 : 0);
        expect(produced.recordAttempts).toBe(i === 2 ? 1 : 0);
        expect(produced.reservationAttempts).toBe(1);
        if (i === 2) await assertAccountingReceipt(s, reservation, produced);
      }
      const other = accountingReservation(s, population.other),
        outside = await accountingCall(s, other, invocation, {
          noInvoke: true,
        });
      expect(outside.result).toMatchObject({
        status: "unfinished",
        reason: "provider_not_invoked_canceled",
      });
      expect(outside.counts.effects).toBe(0);
      const history = (
        await s.env.owner.query<{
          attempt_id: string;
          program_run_id: string;
          calls: number;
          exact: boolean;
        }>(`SELECT c.attempt_id::text,a.program_run_id::text,count(*)::int AS calls,
      sum(CASE WHEN e.actual_cost IS NOT NULL THEN e.actual_cost ELSE c.reserved_cost_upper_bound END)=0.03::numeric AS exact
      FROM provider_calls c JOIN program_run_attempts a USING(attempt_id) LEFT JOIN provider_call_events e USING(provider_call_id)
      GROUP BY c.attempt_id,a.program_run_id ORDER BY c.attempt_id`)
      ).rows;
      expect(history).toHaveLength(4);
      for (const row of history) {
        expect(row.calls).toBe(1);
        expect(row.exact).toBe(true);
        expect(row.program_run_id).toBe(
          row.attempt_id === population.other
            ? population.otherRun
            : population.run,
        );
      }
      const runSum = (
        await s.env.owner.query<{ exact: boolean | null; calls: number }>(
          `SELECT sum(CASE WHEN e.actual_cost IS NOT NULL THEN e.actual_cost ELSE c.reserved_cost_upper_bound END)=0.09::numeric AS exact,
      count(*)::int AS calls FROM provider_calls c JOIN program_run_attempts a USING(attempt_id) LEFT JOIN provider_call_events e USING(provider_call_id) WHERE a.program_run_id=$1`,
          [population.run],
        )
      ).rows[0];
      expect(runSum).toEqual({ exact: true, calls: 3 });
      const unknown = (
        await s.env.owner.query(
          "SELECT actual_cost,currency,admission_settlement->'work_ended' AS ended FROM provider_call_events",
        )
      ).rows;
      expect(unknown).toEqual([
        { actual_cost: null, currency: null, ended: true },
      ]);
      // One-cent request B, not another whole three-cent request; no fake IDs or clock/table oracle.
      const nextInvocation = {
        ...invocation,
        request: {
          ...invocation.request,
          input_text: "a",
          max_output_bytes: 0,
        },
      };
      const next = accountingReservation(s, population.parent, {
        request_fingerprint: requestHash(nextInvocation.request),
      });
      const run = (
        await s.env.owner.query<{ id: string }>(
          "SELECT program_run_id::text AS id FROM program_run_attempts WHERE attempt_id=$1",
          [next.attempt_id],
        )
      ).rows[0]?.id;
      if (typeof run !== "string")
        throw new Error("expected actual attempt run identity");
      expect(
        buildCertificate(
          next,
          run,
          nextInvocation.policy,
          nextInvocation.request,
        ).reserved_cost_upper_bound,
      ).toBe("0.01");
      await refusedAccounting(
        s,
        next,
        nextInvocation,
        scope === "attempt"
          ? "provider_admission_attempt_cost"
          : "provider_admission_run_cost",
      );
      expect(
        (
          await s.env.owner.query<{ n: number }>(
            "SELECT count(*)::int AS n FROM provider_calls",
          )
        ).rows[0]?.n,
      ).toBe(4);
      expect(
        (
          await s.env.owner.query<{ n: number }>(
            "SELECT count(*)::int AS n FROM g1_b_fixture_evidence.receipts WHERE record_kind='invocation'",
          )
        ).rows[0]?.n,
      ).toBe(1);
    },
    120000,
  );
  it.each([
    ["known", false],
    ["known", null],
    ["known", true],
    ["unknown", false],
    ["unknown", null],
    ["unknown", true],
  ] as const)(
    "CALLABLE certified causal retry with %s price/work-ended=%s requires positive original completion, not money/headroom",
    async (price, ended) => {
      const s = await setup(),
        invocation = accountingInvocation(s),
        base = accountingReservation(s);
      const first = await accountingCall(s, base, invocation, {
        cost: price === "known" ? "0.02" : null,
        workEnded: ended,
        eventType: "retryable_failure",
      });
      expect(first.result).toMatchObject({
        status: "performed",
        outcome: { kind: "created" },
      });
      await assertAccountingReceipt(s, base, first);
      const firstCall = await lookupProviderCall(
        s.env.runtime,
        base.provider_call_id,
      );
      const retry = accountingReservation(s, base.attempt_id, {
        logical_request_key: base.logical_request_key,
        operational_try_number: 2,
        retry_of_provider_call_id: base.provider_call_id,
      });
      if (ended !== true) {
        const refusal = await refusedAccounting(
          s,
          retry,
          invocation,
          "provider_admission_retry_work_not_ended",
        );
        expect(
          refusal.events.find(
            (event) => event.command === "provider_call.reserve",
          ),
        ).toMatchObject({
          durability: "not_committed",
          outcome: "rejected",
          code: "provider_admission_retry_work_not_ended",
        });
        expect(
          (
            await s.env.owner.query<{ n: number }>(
              "SELECT count(*)::int AS n FROM provider_calls",
            )
          ).rows[0]?.n,
        ).toBe(1);
      } else {
        const created = await accountingCall(s, retry, invocation, {
          cost: null,
          workEnded: true,
        });
        expect(created.result).toMatchObject({
          status: "performed",
          outcome: { kind: "created" },
        });
        expect(created.counts).toMatchObject({
          effects: 1,
          appends: 2,
          finishes: 0,
        });
        await assertAccountingReceipt(s, retry, created);
        const truth = (
          await s.env.owner
            .query(`SELECT c.provider_call_id::text,c.retry_of_provider_call_id::text,c.operational_try_number,
        c.reserved_cost_upper_bound::text,e.event_type,e.actual_cost::text,e.currency,e.admission_settlement->'work_ended' AS ended
        FROM provider_calls c JOIN provider_call_events e USING(provider_call_id) ORDER BY c.operational_try_number`)
        ).rows;
        expect(truth).toEqual([
          {
            provider_call_id: base.provider_call_id,
            retry_of_provider_call_id: null,
            operational_try_number: 1,
            reserved_cost_upper_bound: "0.03",
            event_type: "retryable_failure",
            actual_cost: price === "known" ? "0.02" : null,
            currency: price === "known" ? "USD" : null,
            ended: true,
          },
          {
            provider_call_id: retry.provider_call_id,
            retry_of_provider_call_id: base.provider_call_id,
            operational_try_number: 2,
            reserved_cost_upper_bound: "0.03",
            event_type: "succeeded",
            actual_cost: null,
            currency: null,
            ended: true,
          },
        ]);
        const exposure = (
          await s.env.owner.query<{ exact: boolean | null }>(
            `SELECT sum(CASE WHEN e.actual_cost IS NOT NULL THEN e.actual_cost ELSE c.reserved_cost_upper_bound END)=$1::numeric AS exact
        FROM provider_calls c LEFT JOIN provider_call_events e USING(provider_call_id)`,
            [price === "known" ? "0.05" : "0.06"],
          )
        ).rows[0];
        expect(exposure?.exact).toBe(true);
        const before = await protectedRows(s.env.owner),
          receipts = await evidenceRows(s.env.owner);
        const replay = await accountingCall(s, retry, invocation);
        expect(replay.result).toMatchObject({ status: "completed" });
        expect(replay.reservationAttempts).toBe(0);
        expect(replay.recordAttempts).toBe(0);
        expect(replay.counts).toMatchObject({
          effects: 0,
          appends: 0,
          finishes: 0,
        });
        expect(await protectedRows(s.env.owner)).toBe(before);
        expect(await evidenceRows(s.env.owner)).toEqual(receipts);
        expect(
          (
            await s.env.owner.query<{ n: number }>(
              "SELECT count(*)::int AS n FROM g1_b_fixture_evidence.receipts WHERE record_kind='invocation'",
            )
          ).rows[0]?.n,
        ).toBe(2);
      }
      expect(
        await lookupProviderCall(s.env.runtime, base.provider_call_id),
      ).toEqual(firstCall);
      const observed = (
        await s.env.owner.query<{
          ended: unknown;
          actual_cost: string | null;
          currency: string | null;
          violations: unknown;
        }>(
          "SELECT admission_settlement->'work_ended' AS ended,actual_cost::text,currency,admission_settlement->'violations' AS violations FROM provider_call_events WHERE provider_call_id=$1",
          [base.provider_call_id],
        )
      ).rows[0];
      expect(observed).toEqual({
        ended,
        actual_cost: price === "known" ? "0.02" : null,
        currency: price === "known" ? "USD" : null,
        violations: [],
      });
    },
    120000,
  );
  it.each(["attempt", "run", "day"] as const)(
    "isolated physical reservation count %s includes committed ZERO-effect calls; equality admits and next refuses",
    async (scope) => {
      const s = await setup(),
        population = await legalPopulation(s);
      const limit =
        scope === "attempt"
          ? { max_reservations_per_attempt: 1 }
          : scope === "run"
            ? { max_reservations_per_run: 2 }
            : { max_reservations_per_utc_day: 2 };
      const invocation = accountingInvocation(s, limit);
      const first = accountingReservation(s, population.parent),
        second = accountingReservation(
          s,
          scope === "day" ? population.other : population.sibling,
        );
      for (const reservation of [first, second]) {
        const created = await accountingCall(s, reservation, invocation, {
          noInvoke: true,
        });
        expect(created.result).toMatchObject({
          status: "unfinished",
          reason: "provider_not_invoked_canceled",
        });
        expect(created.counts).toMatchObject({
          effects: 0,
          appends: 0,
          finishes: 0,
        });
        expect(created.reservationAttempts).toBe(1);
        expect(created.recordAttempts).toBe(0);
      }
      if (scope === "run")
        expect(
          (
            await accountingCall(
              s,
              accountingReservation(s, population.other),
              invocation,
              { noInvoke: true },
            )
          ).result,
        ).toMatchObject({ status: "unfinished" });
      const populationFacts = (
        await s.env.owner.query<{
          total: number;
          target_attempt: number;
          target_run: number;
          today: number;
        }>(
          `SELECT count(*)::int AS total,count(*) FILTER(WHERE c.attempt_id=$1)::int AS target_attempt,
      count(*) FILTER(WHERE a.program_run_id=$2)::int AS target_run,
      count(*) FILTER(WHERE (c.admitted_at AT TIME ZONE 'UTC')::date=(clock_timestamp() AT TIME ZONE 'UTC')::date)::int AS today
      FROM provider_calls c JOIN program_run_attempts a USING(attempt_id)`,
          [population.parent, population.run],
        )
      ).rows[0];
      expect(populationFacts).toEqual({
        total: scope === "run" ? 3 : 2,
        target_attempt: 1,
        target_run: scope === "day" ? 1 : 2,
        today: scope === "run" ? 3 : 2,
      });
      const target = accountingReservation(
        s,
        scope === "day" ? population.sibling : population.parent,
      );
      await refusedAccounting(
        s,
        target,
        invocation,
        "provider_admission_reservation_limit",
      );
      expect(
        (
          await s.env.owner.query<{ n: number }>(
            "SELECT count(*)::int AS n FROM provider_call_events",
          )
        ).rows[0]?.n,
      ).toBe(0);
      expect(await evidenceRows(s.env.owner)).toEqual([]);
    },
    120000,
  );
  it.each(["chain", "attempt", "run", "day"] as const)(
    "isolated operational retry count %s preserves unique causal chains, zero-price failures still count",
    async (scope) => {
      const s = await setup(),
        population = await legalPopulation(s);
      const limit =
        scope === "chain"
          ? { max_operational_retries_per_chain: 1 }
          : scope === "attempt"
            ? { max_operational_retries_per_attempt: 1 }
            : scope === "run"
              ? { max_operational_retries_per_run: 1 }
              : { max_operational_retries_per_utc_day: 1 };
      const invocation = accountingInvocation(s, limit),
        base = accountingReservation(s, population.parent);
      const complete = async (reservation: AuthoredReservation) => {
        const produced = await accountingCall(s, reservation, invocation, {
          cost: "0",
          workEnded: true,
          eventType: "retryable_failure",
        });
        expect(produced.result).toMatchObject({
          status: "performed",
          outcome: { kind: "created" },
        });
        await assertAccountingReceipt(s, reservation, produced);
        return produced;
      };
      const retryOf = (prior: AuthoredReservation) =>
        accountingReservation(s, prior.attempt_id, {
          logical_request_key: prior.logical_request_key,
          operational_try_number: prior.operational_try_number + 1,
          retry_of_provider_call_id: prior.provider_call_id,
        });
      await complete(base);
      const firstRetry = retryOf(base);
      await complete(firstRetry);
      let next: AuthoredReservation;
      if (scope === "chain") next = retryOf(firstRetry);
      else {
        const secondBase = accountingReservation(
          s,
          scope === "attempt"
            ? population.parent
            : scope === "run"
              ? population.sibling
              : population.other,
        );
        await complete(secondBase);
        next = retryOf(secondBase);
      }
      if (scope === "run") {
        // Different true run has its own retry count, despite the installation history above.
        const outside = accountingReservation(s, population.other);
        await complete(outside);
        await complete(retryOf(outside));
      }
      const facts = (
        await s.env.owner.query<{
          all_retries: number;
          attempt_retries: number;
          run_retries: number;
          day_retries: number;
          causal_ended_zero_cost: boolean | null;
        }>(
          `SELECT count(*) FILTER(WHERE c.retry_of_provider_call_id IS NOT NULL)::int AS all_retries,
      count(*) FILTER(WHERE c.retry_of_provider_call_id IS NOT NULL AND c.attempt_id=$1)::int AS attempt_retries,
      count(*) FILTER(WHERE c.retry_of_provider_call_id IS NOT NULL AND a.program_run_id=$2)::int AS run_retries,
      count(*) FILTER(WHERE c.retry_of_provider_call_id IS NOT NULL AND (c.admitted_at AT TIME ZONE 'UTC')::date=(clock_timestamp() AT TIME ZONE 'UTC')::date)::int AS day_retries,
      bool_and(e.event_type='retryable_failure' AND e.actual_cost=0 AND e.admission_settlement->'work_ended'='true'::jsonb) AS causal_ended_zero_cost
      FROM provider_calls c JOIN program_run_attempts a USING(attempt_id) JOIN provider_call_events e USING(provider_call_id)`,
          [population.parent, population.run],
        )
      ).rows[0];
      expect(facts).toEqual({
        all_retries: scope === "run" ? 2 : 1,
        attempt_retries: 1,
        run_retries: 1,
        day_retries: scope === "run" ? 2 : 1,
        causal_ended_zero_cost: true,
      });
      const prior = (
        await s.env.owner.query<{
          operational_try_number: number;
          logical_request_key: string;
          attempt_id: string;
          event_type: string;
          ended: unknown;
        }>(
          "SELECT c.operational_try_number,c.logical_request_key,c.attempt_id::text,e.event_type,e.admission_settlement->'work_ended' AS ended FROM provider_calls c JOIN provider_call_events e USING(provider_call_id) WHERE c.provider_call_id=$1",
          [next.retry_of_provider_call_id],
        )
      ).rows[0];
      expect(prior).toMatchObject({
        operational_try_number: next.operational_try_number - 1,
        logical_request_key: next.logical_request_key,
        attempt_id: next.attempt_id,
        event_type: "retryable_failure",
        ended: true,
      });
      await refusedAccounting(
        s,
        next,
        invocation,
        "provider_admission_retry_limit",
      );
      expect(
        (
          await s.env.owner.query<{ n: number }>(
            "SELECT count(*)::int AS n FROM provider_calls WHERE retry_of_provider_call_id=$1",
            [next.retry_of_provider_call_id],
          )
        ).rows[0]?.n,
      ).toBe(0);
      const protectedBefore = await protectedRows(s.env.owner),
        receiptBefore = await evidenceRows(s.env.owner);
      const recovery = await accountingCall(s, firstRetry, invocation);
      expect(recovery.result).toMatchObject({ status: "completed" });
      expect(recovery.reservationAttempts).toBe(0);
      expect(recovery.counts.effects).toBe(0);
      expect(await protectedRows(s.env.owner)).toBe(protectedBefore);
      expect(await evidenceRows(s.env.owner)).toEqual(receiptBefore);
    },
    120000,
  );
  it.each([
    ["0.001", "0.028", "0.03"],
    ["0.003", "0.03", "0.03"],
    ["0.003001", "0.030001", "0.04"],
  ] as const)(
    "real numeric Q ceiling fee=%s keeps independently expected raw=%s/B=%s and refuses next one-cent request",
    async (fee, raw, bound) => {
      const s = await setup(),
        invocation = accountingInvocation(s, { attempt_cost_ceiling: bound });
      const policy = {
        ...invocation.policy,
        provider_rule: {
          ...invocation.policy.provider_rule,
          tariff: { ...invocation.policy.provider_rule.tariff, fixed_fee: fee },
        },
      };
      const selected = { ...invocation, policy },
        first = accountingReservation(s);
      expect(
        (await accountingCall(s, first, selected, { noInvoke: true })).result,
      ).toMatchObject({
        status: "unfinished",
        reason: "provider_not_invoked_canceled",
      });
      const stored = (
        await s.env.owner.query<{
          reserved_cost_upper_bound: string | null;
          raw: string | null;
          q: string | null;
          started_at: string;
          server_time: boolean;
        }>(
          `SELECT reserved_cost_upper_bound::text,admission_certificate->>'unrounded_bound' AS raw,
      admission_certificate->>'accounting_quantum' AS q,to_char(started_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS started_at,
      admitted_at IS NOT NULL AS server_time FROM provider_calls WHERE provider_call_id=$1`,
          [first.provider_call_id],
        )
      ).rows[0];
      expect(stored).toEqual({
        reserved_cost_upper_bound: bound,
        raw,
        q: "0.01",
        started_at: first.started_at,
        server_time: true,
      });
      const nextInvocation = {
          ...selected,
          request: {
            ...selected.request,
            input_text: "a",
            max_output_bytes: 0,
          },
        },
        next = accountingReservation(s, first.attempt_id, {
          request_fingerprint: requestHash(nextInvocation.request),
        });
      const original = await lookupProviderCall(
        s.env.runtime,
        first.provider_call_id,
      );
      if (!original?.admission)
        throw new Error("original certification missing");
      expect(
        buildCertificate(
          next,
          original.admission.certificate.program_run_id,
          policy,
          nextInvocation.request,
        ).reserved_cost_upper_bound,
      ).toBe("0.01");
      await refusedAccounting(
        s,
        next,
        nextInvocation,
        "provider_admission_attempt_cost",
      );
      expect(await evidenceRows(s.env.owner)).toEqual([]);
    },
    120000,
  );
  it("truthful finer-than-Q actual0.025 replaces its B once: +unresolved0.03+candidate0.03=0.085 admits below0.09; next Q refuses", async () => {
    const s = await setup(),
      invocation = accountingInvocation(s, { attempt_cost_ceiling: "0.09" }),
      first = accountingReservation(s);
    const actual = await accountingCall(s, first, invocation, {
      cost: "0.025",
      workEnded: true,
    });
    expect(actual.result).toMatchObject({
      status: "performed",
      outcome: { kind: "created" },
    });
    await assertAccountingReceipt(s, first, actual);
    for (let i = 0; i < 2; i++) {
      const occupied = await accountingCall(
        s,
        accountingReservation(s),
        invocation,
        { noInvoke: true },
      );
      expect(occupied.result).toMatchObject({
        status: "unfinished",
        reason: "provider_not_invoked_canceled",
      });
      expect(occupied.counts.effects).toBe(0);
    }
    const truth = (
      await s.env.owner.query<{
        reserved_cost_upper_bound: string | null;
        actual_cost: string | null;
        currency: string | null;
        started_at: string;
        ended_at: string;
        violations: unknown;
      }>(
        `SELECT c.reserved_cost_upper_bound::text,e.actual_cost::text,e.currency,
      to_char(c.started_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS started_at,
      to_char(e.ended_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS ended_at,
      e.admission_settlement->'violations' AS violations FROM provider_calls c JOIN provider_call_events e USING(provider_call_id) WHERE c.provider_call_id=$1`,
        [first.provider_call_id],
      )
    ).rows[0];
    expect(truth).toEqual({
      reserved_cost_upper_bound: "0.03",
      actual_cost: "0.025",
      currency: "USD",
      started_at: first.started_at,
      ended_at: "2026-10-06T00:00:01.000001Z",
      violations: [],
    });
    const money = (
      await s.env.owner.query<{
        calls: number;
        events: number;
        exact: boolean | null;
        next_excess: boolean | null;
      }>(`SELECT count(*)::int AS calls,count(e.provider_call_id)::int AS events,
      sum(CASE WHEN e.actual_cost IS NOT NULL THEN e.actual_cost ELSE c.reserved_cost_upper_bound END)=0.085::numeric AS exact,
      sum(CASE WHEN e.actual_cost IS NOT NULL THEN e.actual_cost ELSE c.reserved_cost_upper_bound END)+0.01>0.09 AS next_excess
      FROM provider_calls c LEFT JOIN provider_call_events e USING(provider_call_id)`)
    ).rows[0];
    expect(money).toEqual({
      calls: 3,
      events: 1,
      exact: true,
      next_excess: true,
    });
    const nextInvocation = {
        ...invocation,
        request: {
          ...invocation.request,
          input_text: "a",
          max_output_bytes: 0,
        },
      },
      next = accountingReservation(s, first.attempt_id, {
        request_fingerprint: requestHash(nextInvocation.request),
      });
    await refusedAccounting(
      s,
      next,
      nextInvocation,
      "provider_admission_attempt_cost",
    );
    expect(
      (
        await s.env.owner.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM g1_b_fixture_evidence.receipts WHERE record_kind='invocation'",
        )
      ).rows[0]?.n,
    ).toBe(1);
  }, 120000);
  it("two actual0.025 receipts +unresolved0.03+candidate0.03 admit at exact0.11; rounding each actual to Q would wrongly refuse0.12", async () => {
    const s = await setup(),
      invocation = accountingInvocation(s, { attempt_cost_ceiling: "0.11" });
    expect(invocation.policy).toMatchObject({
      accounting_quantum: "0.01",
      attempt_cost_ceiling: "0.11",
      run_cost_ceiling: "100",
      utc_day_cost_ceiling: "100",
      max_concurrent_global: 100,
      max_reservations_per_attempt: 100,
      max_reservations_per_run: 100,
      max_reservations_per_utc_day: 100,
      global_rate: { max_admissions: 100, min_spacing_ms: 0 },
      provider_rule: {
        max_concurrent: 100,
        rate: { max_admissions: 100, min_spacing_ms: 0 },
      },
    });
    const originals = [accountingReservation(s), accountingReservation(s)];
    for (const reservation of originals) {
      const actual = await accountingCall(s, reservation, invocation, {
        cost: "0.025",
        workEnded: true,
      });
      expect(actual.result).toMatchObject({
        status: "performed",
        outcome: { kind: "created" },
      });
      expect(actual.counts).toMatchObject({
        effects: 1,
        appends: 2,
        finishes: 0,
      });
      expect(actual.recordAttempts).toBe(1);
      await assertAccountingReceipt(s, reservation, actual);
    }
    const ids = originals.map((reservation) => reservation.provider_call_id);
    const originalLedger = async () => ({
      calls: (
        await s.env.owner.query(
          "SELECT to_jsonb(c) AS row,xmin::text,ctid::text FROM provider_calls c WHERE provider_call_id=ANY($1::uuid[]) ORDER BY provider_call_id",
          [ids],
        )
      ).rows,
      events: (
        await s.env.owner.query(
          "SELECT to_jsonb(e) AS row,xmin::text,ctid::text FROM provider_call_events e WHERE provider_call_id=ANY($1::uuid[]) ORDER BY provider_call_id",
          [ids],
        )
      ).rows,
    });
    const retained = await originalLedger(),
      receipts = await evidenceRows(s.env.owner),
      otherRows = await nonLedgerRows(s.env.owner);
    expect(retained.calls).toHaveLength(2);
    expect(retained.events).toHaveLength(2);
    expect(receipts).toHaveLength(4);
    for (let i = 0; i < 2; i++) {
      const occupied = await accountingCall(
        s,
        accountingReservation(s),
        invocation,
        { noInvoke: true },
      );
      expect(occupied.result).toMatchObject({
        status: "unfinished",
        reason: "provider_not_invoked_canceled",
      });
      expect(occupied.reservationAttempts).toBe(1);
      expect(occupied.recordAttempts).toBe(0);
      expect(occupied.counts).toMatchObject({
        effects: 0,
        appends: 0,
        finishes: 0,
        lookups: 0,
      });
    }
    const money = (
      await s.env.owner.query<{
        calls: number;
        events: number;
        unresolved: number;
        exact: boolean | null;
        rounded_counterfactual: boolean | null;
        ceiling: string | null;
        original_bounds_and_scope: boolean | null;
      }>(
        `SELECT count(*)::int AS calls,count(e.provider_call_id)::int AS events,
      count(*) FILTER(WHERE e.provider_call_id IS NULL)::int AS unresolved,
      sum(CASE WHEN e.actual_cost IS NOT NULL THEN e.actual_cost ELSE c.reserved_cost_upper_bound END)=0.11::numeric AS exact,
      sum(CASE WHEN e.actual_cost IS NOT NULL THEN ceil(e.actual_cost/0.01::numeric)*0.01 ELSE c.reserved_cost_upper_bound END)=0.12::numeric AS rounded_counterfactual,
      min(c.admission_certificate->'policy'->>'attempt_cost_ceiling') AS ceiling,
      bool_and(c.reserved_cost_upper_bound=0.03 AND c.attempt_id=$1::uuid) AS original_bounds_and_scope
      FROM provider_calls c LEFT JOIN provider_call_events e USING(provider_call_id)`,
        [s.reservation.attempt_id],
      )
    ).rows[0];
    expect(money).toEqual({
      calls: 4,
      events: 2,
      unresolved: 2,
      exact: true,
      rounded_counterfactual: true,
      ceiling: "0.11",
      original_bounds_and_scope: true,
    });
    const costs = (
      await s.env.owner.query(
        `SELECT actual_cost::text AS actual_cost,currency,
      to_char(ended_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS ended_at,
      admission_settlement->'violations' AS violations FROM provider_call_events WHERE provider_call_id=ANY($1::uuid[]) ORDER BY provider_call_id`,
        [ids],
      )
    ).rows;
    expect(costs).toEqual(
      [0, 1].map(() => ({
        actual_cost: "0.025",
        currency: "USD",
        ended_at: "2026-10-06T00:00:01.000001Z",
        violations: [],
      })),
    );
    expect(await originalLedger()).toEqual(retained);
    expect(await evidenceRows(s.env.owner)).toEqual(receipts);
    expect(await nonLedgerRows(s.env.owner)).toBe(otherRows);
    for (const reservation of originals) {
      const recovered = await lookupProviderCall(
        s.env.runtime,
        reservation.provider_call_id,
      );
      expect(recovered?.reservation).toEqual(reservation);
      expect(recovered?.outcome?.actual_cost).toBe("0.025");
      const packet = await s.evidence.retrieve(reservation.provider_call_id);
      expect(packet).toBeDefined();
    }
    expect(
      (
        await s.env.owner.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM g1_b_fixture_evidence.receipts WHERE record_kind='invocation'",
        )
      ).rows[0]?.n,
    ).toBe(2);
  }, 120000);
  it.each(["unfinished", "zero_settled", "shipped398"] as const)(
    "L0 %s uncertified history blocks callable NEW, including forged offline/zero-bound provider labels, without effects/writes",
    async (history) => {
      const s = await setup(history === "shipped398");
      if (history !== "shipped398") {
        const historical = accountingReservation(s);
        expect(
          (await reserveProviderCall(s.env.runtime, historical)).kind,
        ).toBe("created");
        if (history === "zero_settled")
          expect(
            (
              await recordProviderOutcome(s.env.runtime, {
                provider_call_id: historical.provider_call_id,
                event_type: "succeeded",
                ended_at: "2026-10-06T00:00:01.000001Z",
                usage: {},
                actual_cost: "0",
                currency: "USD",
                response_artifact_id: null,
                response_reference: "test-only uncertified zero",
              })
            ).kind,
          ).toBe("created");
        const stored = await lookupProviderCall(
          s.env.runtime,
          historical.provider_call_id,
        );
        expect(stored?.admission).toBeUndefined();
        expect(stored?.outcome?.actual_cost).toBe(
          history === "zero_settled" ? "0" : undefined,
        );
      }
      const uncertified = (
        await s.env.owner.query<{ calls: number; absent: number }>(
          `SELECT count(*)::int AS calls,count(*) FILTER(WHERE num_nonnulls(admitted_at,reserved_cost_upper_bound,admission_currency,admission_policy_hash,admission_certificate,admission_certificate_hash)=0)::int AS absent FROM provider_calls`,
        )
      ).rows[0];
      expect(uncertified?.calls).toBeGreaterThan(0);
      expect(uncertified?.absent).toBe(uncertified?.calls);
      const invocation = accountingInvocation(s),
        newReservation = accountingReservation(s);
      await refusedAccounting(
        s,
        newReservation,
        invocation,
        "provider_admission_legacy_unaccounted",
      );
      const freePolicy = {
        ...invocation.policy,
        provider_rule: {
          ...invocation.policy.provider_rule,
          provider: "offline-free-zero",
          tariff: {
            ...invocation.policy.provider_rule.tariff,
            fixed_fee: "0",
            input_price_per_byte: "0",
            output_price_per_byte: "0",
          },
        },
      };
      const freeInvocation = { ...invocation, policy: freePolicy },
        freeReservation = accountingReservation(s, newReservation.attempt_id, {
          provider: "offline-free-zero",
        });
      const run = (
        await s.env.owner.query<{ id: string }>(
          "SELECT program_run_id::text AS id FROM program_run_attempts WHERE attempt_id=$1",
          [freeReservation.attempt_id],
        )
      ).rows[0]?.id;
      if (typeof run !== "string")
        throw new Error("expected actual attempt run identity");
      expect(
        buildCertificate(
          freeReservation,
          run,
          freePolicy,
          freeInvocation.request,
        ).reserved_cost_upper_bound,
      ).toBe("0");
      await refusedAccounting(
        s,
        freeReservation,
        freeInvocation,
        "provider_admission_legacy_unaccounted",
      );
      const before = await protectedRows(s.env.owner),
        receipts = await evidenceRows(s.env.owner),
        captured = capturingContext();
      const forged = {
        ...invocation,
        policy: { ...invocation.policy, mode: "offline_fixture" },
      };
      const refusal = await executeProviderCall(
        s.env.runtime,
        accountingReservation(s),
        s.adapter,
        s.finish,
        captured.context,
        { ...s.controls, simulation_admission: forged },
      );
      expect(refusal).toEqual({
        status: "rejected",
        result: { kind: "rejected", code: "provider_admission_policy_invalid" },
      });
      expect(await protectedRows(s.env.owner)).toBe(before);
      expect(await evidenceRows(s.env.owner)).toEqual(receipts);
      expect(s.counts()).toEqual({ performs: 0, finishes: 0 });
      expect(
        captured.events.filter(
          (event) => event.command === "provider_outcome.record",
        ),
      ).toEqual([]);
      expect(await evidenceRows(s.env.owner)).toEqual([]);
      if (history === "shipped398")
        expect(
          (
            await s.env.owner.query<{ n: number }>(
              "SELECT count(*)::int AS n FROM provider_call_events WHERE recorded_at IS NOT NULL OR admission_settlement IS NOT NULL",
            )
          ).rows[0]?.n,
        ).toBe(0);
    },
    120000,
  );
  it.each(["wrong_input", "over_bound", "both"] as const)(
    "actual %s plus another unresolved B persists exact V/money then FRESH child refuses despite ample headroom",
    async (kind) => {
      const s = await setup(),
        invocation = accountingInvocation(s),
        occupied = accountingReservation(s);
      expect(
        (await accountingCall(s, occupied, invocation, { noInvoke: true }))
          .result,
      ).toMatchObject({
        status: "unfinished",
        reason: "provider_not_invoked_canceled",
      });
      const original = accountingReservation(s),
        consumed = kind === "over_bound" ? "ab" : "cd",
        cost = kind === "wrong_input" ? "0.02" : "0.031";
      const produced = await accountingCall(s, original, invocation, {
        consumedText: consumed,
        cost,
        workEnded: true,
      });
      expect(produced.result).toMatchObject({
        status: "performed",
        outcome: { kind: "created" },
      });
      await assertAccountingReceipt(s, original, produced);
      const violations =
        kind === "wrong_input"
          ? ["input_hash_mismatch", "request_fingerprint_mismatch"]
          : kind === "over_bound"
            ? ["actual_above_bound"]
            : [
                "input_hash_mismatch",
                "request_fingerprint_mismatch",
                "actual_above_bound",
              ];
      const truth = (
        await s.env.owner.query<{
          actual_cost: string | null;
          currency: string | null;
          admission_settlement: unknown;
          admission_certificate: unknown;
          admission_certificate_hash: string | null;
          reserved_cost_upper_bound: string | null;
        }>(
          `SELECT e.actual_cost::text,e.currency,e.admission_settlement,c.admission_certificate,c.admission_certificate_hash,
      c.reserved_cost_upper_bound::text FROM provider_call_events e JOIN provider_calls c USING(provider_call_id) WHERE e.provider_call_id=$1`,
          [original.provider_call_id],
        )
      ).rows[0];
      expect(truth?.actual_cost).toBe(cost);
      expect(truth?.currency).toBe("USD");
      expect(truth?.reserved_cost_upper_bound).toBe("0.03");
      expect(jsonObject(truth?.admission_settlement).violations).toEqual(
        violations,
      );
      expect(jsonObject(truth?.admission_settlement).work_ended).toBe(true);
      expect(jsonObject(truth?.admission_settlement).verification_status).toBe(
        "attributed_receipt",
      );
      expect(
        jsonObject(jsonObject(truth?.admission_settlement).consumption)
          .input_text_hash,
      ).toBe(sha256(Buffer.from(consumed, "utf8")));
      expect(
        jsonObject(jsonObject(truth?.admission_settlement).consumption)
          .input_bytes,
      ).toBe(Buffer.byteLength(consumed, "utf8"));
      expect(
        jsonObject(jsonObject(truth?.admission_settlement).consumption)
          .computed_request_fingerprint,
      ).toBe(requestHash({ ...invocation.request, input_text: consumed }));
      expect(
        (await lookupProviderCall(s.env.runtime, occupied.provider_call_id))
          ?.outcome,
      ).toBeNull();
      const before = await protectedRows(s.env.owner),
        receipts = await evidenceRows(s.env.owner),
        spec = childSpec(s, accountingReservation(s), invocation),
        child = g1Child(spec);
      try {
        expect(await childResult(child)).toEqual({
          status: "rejected",
          result: {
            kind: "rejected",
            code: "provider_admission_breach",
            sqlstate: "23514",
          },
        });
        expect(await protectedRows(s.env.owner)).toBe(before);
        expect(await evidenceRows(s.env.owner)).toEqual(receipts);
        expect(
          (
            await s.env.owner.query<{ n: number }>(
              "SELECT count(*)::int AS n FROM provider_calls",
            )
          ).rows[0]?.n,
        ).toBe(2);
        expect(
          (
            await s.env.owner.query<{ n: number }>(
              "SELECT count(*)::int AS n FROM g1_b_fixture_evidence.receipts WHERE record_kind='invocation'",
            )
          ).rows[0]?.n,
        ).toBe(1);
        expect(
          (
            await s.env.owner.query<{
              admission_certificate_hash: string | null;
            }>(
              "SELECT admission_certificate_hash FROM provider_calls WHERE provider_call_id=$1",
              [original.provider_call_id],
            )
          ).rows[0]?.admission_certificate_hash,
        ).toBe(truth?.admission_certificate_hash);
      } finally {
        await closeChildren(s, [child], [spec.tag]);
      }
      // Fresh-process persistence proof; NOT an induced day rollover or a hostile-writer authenticity guarantee.
    },
    120000,
  );
  it.each([
    ["same_id", "commit"],
    ["different_id", "commit"],
    ["mixed_policy", "commit"],
    ["same_id", "rollback"],
    ["different_id", "rollback"],
    ["mixed_policy", "rollback"],
  ] as const)(
    "certified separate children %s/%s arbitrate at exact D lock and invoke only acknowledged creator",
    async (identity, end) => {
      const s = await setup(),
        untouched = await nonLedgerRows(s.env.owner);
      const invocation = {
        ...s.invocation,
        lock_timeout_ms: 20000,
        statement_timeout_ms: 25000,
      };
      const holderSpec = {
        ...childSpec(s, s.reservation, invocation),
        fault: "reservation_inserted_uncommitted",
      };
      const waiterReservation =
        identity === "same_id"
          ? s.reservation
          : {
              ...s.reservation,
              provider_call_id: randomUUID(),
              logical_request_key:
                identity === "mixed_policy"
                  ? "other-policy:" + randomUUID()
                  : s.reservation.logical_request_key,
            };
      const waiterInvocation =
        identity === "mixed_policy"
          ? {
              ...invocation,
              policy: {
                ...invocation.policy,
                policy_version: "second-contender",
              },
            }
          : invocation;
      const waiterSpec = childSpec(s, waiterReservation, waiterInvocation),
        children: ReturnType<typeof g1Child>[] = [],
        tags = [holderSpec.tag, waiterSpec.tag];
      const holder = g1Child(holderSpec);
      children.push(holder);
      try {
        await holder.held();
        const holding = await s.env.owner.query<{ pid: number }>(D_HOLDER_SQL, [
          s.env.name,
          holderSpec.tag,
        ]);
        expect(holding.rowCount).toBe(1);
        const pid = holding.rows[0]?.pid;
        if (pid === undefined)
          throw new Error("named uncommitted D holder missing");
        expect(pid).toBeGreaterThan(0);
        expect(
          (
            await s.env.owner.query<{ n: number }>(
              "SELECT count(*)::int AS n FROM provider_calls",
            )
          ).rows[0]?.n,
        ).toBe(0);
        expect(await evidenceRows(s.env.owner)).toEqual([]);
        const waiter = g1Child(waiterSpec);
        children.push(waiter);
        await observe(
          async () =>
            (
              await s.env.owner.query(D_WAITER_SQL, [
                s.env.name,
                waiterSpec.tag,
                pid,
              ])
            ).rowCount === 1,
          "certified unique waiter blocked by exact granted uncommitted D holder",
          10000,
        );
        const waiting = await s.env.owner.query<{
          pid: number;
          application_name: string;
          blockers: number[];
        }>(D_WAITER_SQL, [s.env.name, waiterSpec.tag, pid]);
        expect(waiting.rowCount).toBe(1);
        expect(waiting.rows[0]?.application_name).toBe(waiterSpec.tag);
        expect(waiting.rows[0]?.blockers).toContain(pid);
        expect(waiting.rows[0]?.pid).not.toBe(pid);
        if (end === "rollback") {
          const death = await holder.kill();
          expect(death.code).toBeNull();
          expect(death.signal).toBe("SIGKILL");
          expect(death.stdout).not.toContain("RESULT ");
        } else {
          holder.release();
          expect(await childResult(holder)).toMatchObject({
            status: "performed",
            outcome: { kind: "created" },
          });
        }
        const result = await childResult(waiter);
        if (end === "rollback")
          expect(result).toMatchObject({
            status: "performed",
            outcome: { kind: "created" },
          });
        else if (identity === "mixed_policy")
          expect(result).toEqual({
            status: "rejected",
            result: {
              kind: "rejected",
              code: "provider_admission_policy_conflict",
              sqlstate: "23514",
            },
          });
        else {
          // Admission may read before or after the winner's separately committed event; neither read grants performance.
          const expectedStatus: unknown = expect.stringMatching(
            /^(completed|unfinished)$/,
          );
          expect(result).toEqual(
            expect.objectContaining({
              status: expectedStatus,
              reservation: s.reservation,
            }),
          );
          if ((result as { status: string }).status === "unfinished")
            expect(result).toMatchObject({
              reason:
                identity === "same_id"
                  ? "converged_without_outcome"
                  : "held_by_other",
            });
        }
        const winningReservation =
            end === "rollback" ? waiterReservation : s.reservation,
          winningInvocation =
            end === "rollback" ? waiterInvocation : invocation;
        const { call, event } = await assertChildPacket(
          s,
          winningReservation,
          winningInvocation,
        );
        expect(call.outcome).toEqual(event);
        expect(
          (
            await s.env.owner.query<{ n: number }>(
              "SELECT count(*)::int AS n FROM provider_calls",
            )
          ).rows[0]?.n,
        ).toBe(1);
        expect(
          (
            await s.env.owner.query<{ n: number }>(
              "SELECT count(*)::int AS n FROM provider_call_events",
            )
          ).rows[0]?.n,
        ).toBe(1);
        if (
          winningReservation.provider_call_id !==
          waiterReservation.provider_call_id
        )
          expect(
            await lookupProviderCall(
              s.env.runtime,
              waiterReservation.provider_call_id,
            ),
          ).toBeNull();
        expect(await nonLedgerRows(s.env.owner)).toBe(untouched);
        expect(s.counts()).toEqual({ performs: 0, finishes: 0 });
        const publicBefore = await protectedRows(s.env.owner),
          retainedBefore = await evidenceRows(s.env.owner);
        const replaySpec = childSpec(s, winningReservation, {
          ...winningInvocation,
          policy: {
            ...winningInvocation.policy,
            policy_version: "unused-recovery-policy",
          },
        });
        const replay = g1Child(replaySpec);
        children.push(replay);
        tags.push(replaySpec.tag);
        expect(await childResult(replay)).toMatchObject({
          status: "completed",
          reservation: winningReservation,
          outcome: event,
        });
        expect(await protectedRows(s.env.owner)).toBe(publicBefore);
        expect(await evidenceRows(s.env.owner)).toEqual(retainedBefore);
        expect(
          (
            await lookupProviderCall(
              s.env.runtime,
              winningReservation.provider_call_id,
            )
          )?.admission,
        ).toEqual(call.admission);
      } finally {
        await closeChildren(s, children, tags);
      }
    },
    120000,
  );
  it.each([
    "after_reservation_commit",
    "after_side_effect",
    "after_outcome_commit",
  ] as const)(
    "certified child SIGKILL at existing %s hold retains exact original truth and fresh recovery never invokes again",
    async (point) => {
      const s = await setup(),
        untouched = await nonLedgerRows(s.env.owner);
      const invocation = {
        ...s.invocation,
        policy: {
          ...s.invocation.policy,
          max_concurrent_global: 1,
          provider_rule: {
            ...s.invocation.policy.provider_rule,
            max_concurrent: 1,
          },
        },
      };
      const spec = { ...childSpec(s, s.reservation, invocation), fault: point },
        children: ReturnType<typeof g1Child>[] = [],
        tags = [spec.tag];
      const child = g1Child(spec);
      children.push(child);
      try {
        await child.held();
        const original = await lookupProviderCall(
          s.env.runtime,
          s.reservation.provider_call_id,
        );
        expect(original?.reservation).toEqual(s.reservation);
        if (!original?.admission)
          throw new Error("independently observed committed original required");
        expect(original.admission.certificate).toEqual(
          buildCertificate(
            s.reservation,
            original.admission.certificate.program_run_id,
            invocation.policy,
            invocation.request,
          ),
        );
        expect(
          (
            await s.env.owner.query<{ n: number }>(
              "SELECT count(*)::int AS n FROM provider_calls",
            )
          ).rows[0]?.n,
        ).toBe(1);
        const beforeDeath = await protectedRows(s.env.owner),
          retainedBefore = await evidenceRows(s.env.owner);
        expect(retainedBefore).toHaveLength(
          point === "after_reservation_commit" ? 0 : 2,
        );
        expect(
          (
            await s.env.owner.query<{ n: number }>(
              "SELECT count(*)::int AS n FROM provider_call_events",
            )
          ).rows[0]?.n,
        ).toBe(point === "after_outcome_commit" ? 1 : 0);
        let expected: Awaited<ReturnType<typeof assertChildPacket>> | undefined;
        if (point !== "after_reservation_commit")
          expected = await assertChildPacket(s, s.reservation, invocation);
        const death = await child.kill();
        expect(death.signal).toBe("SIGKILL");
        expect(death.code).toBeNull();
        expect(death.stdout).not.toContain("RESULT ");
        expect(await protectedRows(s.env.owner)).toBe(beforeDeath);
        expect(await evidenceRows(s.env.owner)).toEqual(retainedBefore);
        const replacement = {
          ...invocation,
          policy: {
            ...invocation.policy,
            policy_version: "not-used-for-recovery",
          },
        };
        const recoverySpec = childSpec(s, s.reservation, replacement),
          recovery = g1Child(recoverySpec);
        children.push(recovery);
        tags.push(recoverySpec.tag);
        expect(await childResult(recovery)).toMatchObject(
          point === "after_outcome_commit"
            ? { status: "completed", outcome: expected?.event }
            : { status: "unfinished", reason: "converged_without_outcome" },
        );
        expect(await protectedRows(s.env.owner)).toBe(beforeDeath);
        expect(await evidenceRows(s.env.owner)).toEqual(retainedBefore);
        if (point === "after_reservation_commit") {
          const next = {
              ...s.reservation,
              provider_call_id: randomUUID(),
              logical_request_key: "occupied:" + randomUUID(),
            },
            nextSpec = childSpec(s, next, invocation);
          const refused = g1Child(nextSpec);
          children.push(refused);
          tags.push(nextSpec.tag);
          expect(await childResult(refused)).toEqual({
            status: "rejected",
            result: {
              kind: "rejected",
              code: "provider_admission_concurrency_limit",
              sqlstate: "23514",
            },
          });
          expect(await protectedRows(s.env.owner)).toBe(beforeDeath);
          expect(await evidenceRows(s.env.owner)).toEqual([]);
        } else {
          const reconcileSpec = {
            ...childSpec(s, s.reservation, replacement),
            simulation: { invocation: replacement, reconcile: true },
          };
          const recovered = g1Child(reconcileSpec);
          children.push(recovered);
          tags.push(reconcileSpec.tag);
          expect(await childResult(recovered)).toMatchObject(
            point === "after_side_effect"
              ? { status: "performed", recorded: { kind: "created" } }
              : { status: "recorded", outcome: expected?.event },
          );
          const after = await lookupProviderCall(
            s.env.runtime,
            s.reservation.provider_call_id,
          );
          expect(after?.outcome).toEqual(expected?.event);
          expect(after?.admission).toEqual(original.admission);
          expect(
            (
              await s.env.owner.query<{ n: number }>(
                "SELECT count(*)::int AS n FROM provider_call_events",
              )
            ).rows[0]?.n,
          ).toBe(1);
          expect(await evidenceRows(s.env.owner)).toEqual(retainedBefore);
          if (point === "after_outcome_commit")
            expect(await protectedRows(s.env.owner)).toBe(beforeDeath);
          const finalRows = await protectedRows(s.env.owner);
          const replaySpec = {
              ...childSpec(s, s.reservation, replacement),
              simulation: { invocation: replacement, reconcile: true },
            },
            replay = g1Child(replaySpec);
          children.push(replay);
          tags.push(replaySpec.tag);
          expect(await childResult(replay)).toMatchObject({
            status: "recorded",
            outcome: expected?.event,
          });
          expect(await protectedRows(s.env.owner)).toBe(finalRows);
          expect(await evidenceRows(s.env.owner)).toEqual(retainedBefore);
        }
        expect(await nonLedgerRows(s.env.owner)).toBe(untouched);
        expect(s.counts()).toEqual({ performs: 0, finishes: 0 });
      } finally {
        await closeChildren(s, children, tags);
      }
    },
    120000,
  );
  it.each(["malformed", "unattributed", "binding_invalid"] as const)(
    "callable certified execute AND reconcile refuse %s Packet, retain occupied truth and never finish/record",
    async (kind) => {
      const s = await setup(),
        counts = phaseCounters(),
        producer = phaseProducer(s, counts),
        context = capturingContext();
      let recordAttempts = 0;
      const pool = measuredPool(s.env.runtime, counts, async (text, native) => {
        if (
          typeof text === "string" &&
          text.includes("INSERT INTO provider_call_events")
        )
          recordAttempts++;
        return native();
      });
      await databaseCounterControls(pool, counts);
      const finish = () => {
        counts.finishes++;
        throw new Error("UNUSED_REFUSED_PACKET_FINISH_CANARY");
      };
      expect(finish).toThrow("UNUSED_REFUSED_PACKET_FINISH_CANARY");
      const finishBaseline = counts.finishes;
      const corrupt = (packet: ReceiptPacket): ReceiptPacket => {
        if (kind === "malformed")
          return new Proxy(packet, {
            getOwnPropertyDescriptor(target, key) {
              if (key === "final_json") {
                counts.packetDescriptors++;
                throw new Error("CONSUMED_PACKET_DESCRIPTOR_CANARY");
              }
              return Reflect.getOwnPropertyDescriptor(target, key);
            },
          });
        const io = JSON.parse(packet.invocation_json) as Parameters<
            typeof receiptPacket
          >[0],
          fr = JSON.parse(packet.final_json) as FinalReceipt;
        if (kind === "unattributed") {
          const other = randomUUID(),
            changedIo = {
              ...io,
              attribution: { ...io.attribution, provider_call_id: other },
            };
          return receiptPacket(changedIo, {
            ...fr,
            attribution: changedIo.attribution,
            invocation_observation_hash: invocationHash(changedIo),
            event: { ...fr.event, provider_call_id: other },
          });
        }
        return receiptPacket(io, {
          ...fr,
          event: { ...fr.event, usage: { ...fr.event.usage, output_bytes: 2 } },
        });
      };
      if (kind === "malformed") {
        const positive = corrupt({
          schema: "g1-sim-receipt-packet/1",
          invocation_json: "",
          invocation_hash: "",
          final_json: "",
          final_hash: "",
        });
        expect(() =>
          Object.getOwnPropertyDescriptor(positive, "final_json"),
        ).toThrow("CONSUMED_PACKET_DESCRIPTOR_CANARY");
        expect(counts.packetDescriptors).toBe(1);
      }
      const descriptorBaseline = counts.packetDescriptors,
        untouched = await nonLedgerRows(s.env.owner);
      let returned: ReceiptPacket | undefined;
      const result = await executeProviderCall(
        pool,
        s.reservation,
        {
          async perform(request: ProviderRequest) {
            returned = corrupt(await producer.perform(request));
            return returned;
          },
        },
        finish,
        context.context,
        s.controls,
      );
      const code =
        kind === "malformed"
          ? "provider_sim_receipt_invalid"
          : kind === "unattributed"
            ? "provider_sim_receipt_unattributed"
            : "provider_sim_receipt_binding_invalid";
      expect(result).toMatchObject({ status: "ambiguous", code });
      expect(recordAttempts).toBe(0);
      expect(
        context.events.find(
          (event) => event.workflow === "provider_call.execute",
        ),
      ).toMatchObject({
        code,
        perform: "performed",
        outcome_record: "not_attempted",
      });
      expect(
        context.events.filter(
          (event) => event.command === "provider_outcome.record",
        ),
      ).toEqual([]);
      const { original, packet, final } = await assertOriginalPacket(
        s,
        producer,
      );
      expect(original?.outcome).toBeNull();
      expect(counts.effects).toBe(1);
      expect(counts.appends).toBe(2);
      expect(counts.finishes).toBe(finishBaseline);
      const before = await protectedRows(s.env.owner),
        evidence = await evidenceRows(s.env.owner),
        atRefusal = { ...counts };
      if (!returned)
        throw new Error("bad Packet must actually have been returned");
      const returnedPacket = returned;
      const reconcileContext = capturingContext(),
        badAdapter = {
          async perform(request: ProviderRequest) {
            return producer.perform(request);
          },
          lookup(request: ProviderRequest) {
            counts.lookups++;
            return Promise.resolve({
              provider_call_id: request.provider_call_id,
              logical_request_key: request.logical_request_key,
              request_fingerprint: request.request_fingerprint,
              result: returnedPacket,
            });
          },
        };
      const reconciled = await reconcileProviderCall(
        pool,
        {
          providerCallId: s.reservation.provider_call_id,
          adapter: badAdapter,
          finish,
        },
        reconcileContext.context,
      );
      expect(reconciled).toEqual({ status: "unknown", reason: code });
      expect(recordAttempts).toBe(0);
      expect(counts.lookups - atRefusal.lookups).toBe(1);
      expect(
        reconcileContext.events.find(
          (event) => event.workflow === "provider_call.reconcile",
        ),
      ).toMatchObject({ reconcile_reason: code, status: "unknown" });
      expect(
        reconcileContext.events.filter(
          (event) => event.command === "provider_outcome.record",
        ),
      ).toEqual([]);
      expect(counts.effects).toBe(1);
      expect(counts.appends).toBe(2);
      expect(counts.finishes).toBe(finishBaseline);
      if (kind === "malformed")
        expect(counts.packetDescriptors - descriptorBaseline).toBe(2);
      expect(await protectedRows(s.env.owner)).toBe(before);
      expect(await evidenceRows(s.env.owner)).toEqual(evidence);
      expect(await nonLedgerRows(s.env.owner)).toBe(untouched);
      expect(
        JSON.stringify(result) +
          JSON.stringify(reconciled) +
          JSON.stringify(context.events) +
          JSON.stringify(reconcileContext.events),
      ).not.toContain("CANARY");
      // Explicit reconciliation, not a late handler, supplies the SAME original retained bytes after the refusal window.
      const accepted = await reconcileProviderCall(
        pool,
        {
          providerCallId: s.reservation.provider_call_id,
          adapter: producer,
          finish,
        },
        noopContext(),
      );
      expect(accepted).toMatchObject({
        status: "performed",
        recorded: { kind: "created" },
      });
      expect(recordAttempts).toBe(1);
      expect(
        (
          await lookupProviderCall(
            s.env.runtime,
            s.reservation.provider_call_id,
          )
        )?.outcome,
      ).toEqual(final.event);
      expect(await s.evidence.retrieve(s.reservation.provider_call_id)).toEqual(
        packet,
      );
      expect(await evidenceRows(s.env.owner)).toEqual(evidence);
      expect(counts).toMatchObject({
        effects: 1,
        appends: 2,
        finishes: finishBaseline,
      });
      expect(counts.lookups).toBe(2);
      const after = await protectedRows(s.env.owner),
        lookupBaseline = counts.lookups;
      expect(
        await reconcileProviderCall(
          pool,
          {
            providerCallId: s.reservation.provider_call_id,
            adapter: badAdapter,
            finish,
          },
          noopContext(),
        ),
      ).toMatchObject({ status: "recorded", outcome: final.event });
      expect(recordAttempts).toBe(1);
      expect(counts.lookups).toBe(lookupBaseline);
      expect(await protectedRows(s.env.owner)).toBe(after);
      expect(await evidenceRows(s.env.owner)).toEqual(evidence);
    },
    120000,
  );
  it.each(["before_insert", "lost_ack", "acknowledged_commit"] as const)(
    "certified primary record %s error plus SECONDARY release rejection preserves first safe diagnostic and actual durability",
    async (kind) => {
      const s = await setup(),
        counts = phaseCounters(),
        producer = phaseProducer(s, counts),
        context = capturingContext();
      let commits = 0,
        releases = 0,
        recordAttempts = 0;
      const primary =
        kind === "before_insert"
          ? new Error("PRIMARY_RECORD_QUERY_CANARY")
          : new Rejection(
              "provider_sim_receipt_invalid",
              "PRIMARY_RECORD_COMMIT_CANARY",
            );
      const secondary = new Rejection(
        "provider_execution_disabled",
        "SECONDARY_RELEASE_CANARY",
      );
      const hook = Symbol.for("the-desk.a5.test-fault-hook"),
        previous = Object.getOwnPropertyDescriptor(globalThis, hook),
        priorFlag = process.env.DESK_TEST_FAULTS;
      let acknowledgedEnds = 0;
      process.env.DESK_TEST_FAULTS = "1";
      Object.defineProperty(globalThis, hook, {
        configurable: true,
        value: (name: string) => {
          if (
            name === "after_commit_before_return" &&
            ++acknowledgedEnds === 2 &&
            kind === "acknowledged_commit"
          )
            throw primary;
        },
      });
      const pool = measuredPool(
        s.env.runtime,
        counts,
        async (text, native) => {
          if (
            typeof text === "string" &&
            text.includes("INSERT INTO provider_call_events")
          ) {
            recordAttempts++;
            if (kind === "before_insert") throw primary;
          }
          const result = await native();
          if (text === "COMMIT" && ++commits === 2 && kind === "lost_ack")
            throw primary;
          return result;
        },
        () => {
          if (++releases === 2) throw secondary;
        },
      );
      try {
        // Consumed error positive controls: these raw messages exist only on the test-owned injected sources.
        expect(primary.message).toContain("CANARY");
        expect(secondary.message).toContain("CANARY");
        let error: unknown;
        try {
          await executeProviderCall(
            pool,
            s.reservation,
            producer,
            () => {
              counts.finishes++;
              throw new Error("UNUSED_PRIMARY_FINISH_CANARY");
            },
            context.context,
            s.controls,
          );
        } catch (caught) {
          error = caught;
        }
        expect(recordAttempts).toBe(1);
        expect(releases).toBe(2);
        expect(counts).toMatchObject({
          effects: 1,
          appends: 2,
          finishes: 0,
          lookups: 0,
        });
        const durability =
          kind === "before_insert"
            ? "not_committed"
            : kind === "lost_ack"
              ? "unknown"
              : "committed";
        const code =
          kind === "before_insert"
            ? "provider_execution_failed"
            : kind === "lost_ack"
              ? "provider_execution_commit_unknown"
              : "provider_sim_receipt_invalid";
        expect(error).toMatchObject({
          code,
          stage: "record",
          correlation_id: context.context.correlationId,
          commit_state: durability,
          reservation_commit_state: "committed",
          error_class: kind === "before_insert" ? "unclassified" : "Rejection",
        });
        expect(error).not.toHaveProperty("cause");
        expect(error).not.toHaveProperty("errors");
        expect(error).not.toHaveProperty("rawError");
        expect(
          context.events.find(
            (event) => event.command === "provider_outcome.record",
          ),
        ).toMatchObject({
          durability,
          cleanup_failures: 1,
          error_class: kind === "before_insert" ? "unclassified" : "Rejection",
        });
        expect(
          context.events.find(
            (event) => event.workflow === "provider_call.execute",
          ),
        ).toMatchObject({
          code,
          perform: "performed",
          outcome_record: "unknown",
        });
        const { original, final } = await assertOriginalPacket(s, producer);
        expect(original?.outcome).toEqual(
          kind === "before_insert" ? null : final.event,
        );
        expect(
          (
            await s.env.owner.query<{ n: number }>(
              "SELECT count(*)::int AS n FROM provider_call_events",
            )
          ).rows[0]?.n,
        ).toBe(kind === "before_insert" ? 0 : 1);
        expect(
          JSON.stringify(error) +
            (error instanceof Error ? String(error.stack) : "") +
            JSON.stringify(context.events),
        ).not.toContain("CANARY");
        const before = await protectedRows(s.env.owner),
          evidence = await evidenceRows(s.env.owner),
          counters = { ...counts };
        const recovered = await executeProviderCall(
          s.env.runtime,
          s.reservation,
          producer,
          () => {
            counts.finishes++;
            throw new Error("UNUSED_REPLAY_CANARY");
          },
          noopContext(),
          undefined,
        );
        expect(recovered.status).toBe(
          kind === "before_insert" ? "unfinished" : "completed",
        );
        expect(counts).toEqual(counters);
        expect(await protectedRows(s.env.owner)).toBe(before);
        expect(await evidenceRows(s.env.owner)).toEqual(evidence);
      } finally {
        if (previous) Object.defineProperty(globalThis, hook, previous);
        else Reflect.deleteProperty(globalThis, hook);
        if (priorFlag === undefined) delete process.env.DESK_TEST_FAULTS;
        else process.env.DESK_TEST_FAULTS = priorFlag;
      }
    },
    120000,
  );
  it.each(["resolve", "reject"] as const)(
    "certified durable FINAL exists before held ACK; pending timeout then late %s does zero runtime/evidence work",
    async (kind) => {
      const s = await setup(),
        counts = phaseCounters(),
        pool = measuredPool(s.env.runtime, counts),
        producer = phaseProducer(s, counts);
      await databaseCounterControls(pool, counts);
      const finish = () => {
        counts.finishes++;
        throw new Error("UNUSED_LATE_FINISH_CANARY");
      };
      expect(finish).toThrow("UNUSED_LATE_FINISH_CANARY");
      const finishBaseline = counts.finishes;
      let release: () => void = () => {
          throw new Error("gate not initialized");
        },
        effectReady: () => void = () => {
          throw new Error("gate not initialized");
        },
        lateReady: () => void = () => {
          throw new Error("gate not initialized");
        };
      const gate = new Promise<void>((resolve) => {
          release = resolve;
        }),
        effect = new Promise<void>((resolve) => {
          effectReady = resolve;
        }),
        late = new Promise<void>((resolve) => {
          lateReady = resolve;
        });
      let completed = false,
        watchdog: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_resolve, reject) => {
        watchdog = setTimeout(() => {
          reject(new Error("owned pending certified watchdog"));
        }, 10000);
      });
      const unhandled: unknown[] = [],
        onUnhandled = (error: unknown) => {
          unhandled.push(error);
        };
      process.on("unhandledRejection", onUnhandled);
      const context = capturingContext();
      const latePacket = (packet: ReceiptPacket) =>
        new Proxy(
          Object.defineProperty({ ...packet }, "final_json", {
            enumerable: true,
            configurable: true,
            get() {
              counts.packetAccessors++;
              throw new Error("LATE_PACKET_ACCESSOR_CANARY");
            },
          }),
          {
            getOwnPropertyDescriptor(target, key) {
              counts.packetDescriptors++;
              return Reflect.getOwnPropertyDescriptor(target, key);
            },
          },
        );
      // Positive control for BOTH descriptor inspection and the protected getter. This is explicit test work, never a runtime observation.
      const probe = latePacket({
        schema: "g1-sim-receipt-packet/1",
        invocation_json: "",
        invocation_hash: "",
        final_json: "",
        final_hash: "",
      });
      const descriptor = Object.getOwnPropertyDescriptor(probe, "final_json");
      expect(counts.packetDescriptors).toBe(1);
      expect(() => {
        const value: unknown = descriptor?.get?.();
        return value;
      }).toThrow("LATE_PACKET_ACCESSOR_CANARY");
      expect(counts.packetAccessors).toBe(1);
      const packetBaseline = {
        descriptors: counts.packetDescriptors,
        accessors: counts.packetAccessors,
      };
      try {
        const running = executeProviderCall(
          pool,
          s.reservation,
          {
            async perform(request: ProviderRequest) {
              const packet = await producer.perform(request);
              effectReady();
              await gate;
              completed = true;
              lateReady();
              if (kind === "reject")
                throw new Error("LATE_CERTIFIED_REJECTION_CANARY");
              return latePacket(packet);
            },
            lookup: (request: ProviderRequest) => producer.lookup(request),
          },
          finish,
          context.context,
          { ...s.controls, PROVIDER_CALL_TIMEOUT_MS: 1000 },
        );
        await Promise.race([effect, deadline]);
        const beforeAck = await assertOriginalPacket(s, producer);
        expect(beforeAck.final.work_ended).toBe(true);
        const durableEvidence = await evidenceRows(s.env.owner);
        expect(counts.effects).toBe(1);
        expect(counts.appends).toBe(2);
        expect(completed).toBe(false);
        const result = await Promise.race([running, deadline]);
        expect(result).toMatchObject({
          status: "ambiguous",
          code: "provider_observation_timeout",
        });
        expect(completed).toBe(false);
        expect(counts.finishes - finishBaseline).toBe(0);
        expect(counts.lookups).toBe(0);
        expect(
          context.events.filter((e) => e.command === "provider_outcome.record"),
        ).toEqual([]);
        expect(
          (
            await s.env.owner.query<{ n: number }>(
              "SELECT count(*)::int AS n FROM provider_call_events",
            )
          ).rows[0]?.n,
        ).toBe(0);
        const atTimeout = { ...counts },
          publicRows = await protectedRows(s.env.owner);
        release();
        await Promise.race([late, deadline]);
        await sleep(30);
        expect(completed).toBe(true);
        expect(counts).toEqual(atTimeout);
        expect(unhandled).toEqual([]);
        expect(counts.packetDescriptors).toBe(packetBaseline.descriptors);
        expect(counts.packetAccessors).toBe(packetBaseline.accessors);
        expect(await protectedRows(s.env.owner)).toBe(publicRows);
        expect(await evidenceRows(s.env.owner)).toEqual(durableEvidence);
        expect(
          JSON.stringify(result) + JSON.stringify(context.events),
        ).not.toContain("CANARY");
        // Positive lookup is explicitly AFTER the no-work window; it retrieves the pre-existing receipt and appends nothing.
        const actual = producer.bodies().request;
        if (!actual) throw new Error("actual request missing");
        expect((await producer.lookup(actual))?.result).toEqual(
          beforeAck.packet,
        );
        expect(counts.lookups - atTimeout.lookups).toBe(1);
        expect(counts.appends).toBe(2);
        expect(await protectedRows(s.env.owner)).toBe(publicRows);
        expect(await evidenceRows(s.env.owner)).toEqual(durableEvidence);
      } finally {
        release();
        if (watchdog) clearTimeout(watchdog);
        process.off("unhandledRejection", onUnhandled);
      }
    },
    120000,
  );
  it.each(["throw", "cancel", "side_effect"] as const)(
    "certified timely Packet ignores generic finish %s and records original typed event",
    async (kind) => {
      const s = await setup(),
        counts = phaseCounters(),
        producer = phaseProducer(s, counts);
      let control = new AbortController();
      await databaseCounterControls(
        measuredPool(s.env.runtime, counts),
        counts,
      );
      const finish = (): AuthoredOutcome => {
        counts.finishes++;
        if (kind === "throw") throw new Error("UNUSED_CERTIFIED_FINISH_CANARY");
        if (kind === "cancel") control.abort();
        return {
          provider_call_id: s.reservation.provider_call_id,
          event_type: "succeeded",
          ended_at: "2026-10-06T00:00:01.000001Z",
          usage: { input_bytes: 2, output_bytes: 1 },
          actual_cost: "0.02",
          currency: "USD",
          response_artifact_id: null,
          response_reference: "PROTECTED_FINISH_CANARY",
        };
      };
      if (kind === "throw")
        expect(finish).toThrow("UNUSED_CERTIFIED_FINISH_CANARY");
      else expect(finish().response_reference).toBe("PROTECTED_FINISH_CANARY");
      expect(counts.finishes).toBe(1);
      expect(control.signal.aborted).toBe(kind === "cancel");
      control = new AbortController();
      const baseline = { ...counts };
      const captured = capturingContext();
      const result = await executeProviderCall(
        s.env.runtime,
        s.reservation,
        producer,
        finish,
        captured.context,
        { ...s.controls, signal: control.signal },
      );
      expect(result).toMatchObject({
        status: "performed",
        outcome: { kind: "created" },
      });
      expect(counts.finishes - baseline.finishes).toBe(0);
      expect(counts).toMatchObject({ effects: 1, lookups: 0, appends: 2 });
      expect(control.signal.aborted).toBe(false);
      const { original, final } = await assertOriginalPacket(s, producer);
      expect(original?.outcome).toEqual(final.event);
      expect(original?.admission?.certificate.provider_call_id).toBe(
        s.reservation.provider_call_id,
      );
      expect(
        captured.events.find((e) => e.command === "provider_outcome.record"),
      ).toMatchObject({ durability: "committed", outcome: "created" });
      expect(
        JSON.stringify(result) + JSON.stringify(captured.events),
      ).not.toContain("CANARY");
    },
    120000,
  );
  it.each(["throw_then_cancel", "valid_descriptor_cancel"] as const)(
    "certified synchronous Packet descriptor %s preserves projection/cancel precedence with zero record",
    async (kind) => {
      const s = await setup(),
        counts = phaseCounters(),
        producer = phaseProducer(s, counts),
        control = new AbortController(),
        context = capturingContext();
      await databaseCounterControls(
        measuredPool(s.env.runtime, counts),
        counts,
      );
      const result = await executeProviderCall(
        s.env.runtime,
        s.reservation,
        {
          async perform(request: ProviderRequest) {
            const packet = await producer.perform(request);
            return new Proxy(packet, {
              getOwnPropertyDescriptor(target, key) {
                counts.packetDescriptors++;
                if (key === "final_hash") {
                  if (kind === "throw_then_cancel")
                    try {
                      throw new Error("FIRST_PROJECTION_TRAP_CANARY");
                    } finally {
                      control.abort();
                    }
                  control.abort();
                }
                return Reflect.getOwnPropertyDescriptor(target, key);
              },
            });
          },
        },
        () => {
          counts.finishes++;
          throw new Error("UNUSED_FINISH_CANARY");
        },
        context.context,
        { ...s.controls, signal: control.signal },
      );
      expect(result).toMatchObject({
        status: "ambiguous",
        code:
          kind === "throw_then_cancel"
            ? "provider_sim_receipt_invalid"
            : "provider_observation_canceled",
      });
      expect(counts.packetDescriptors).toBeGreaterThan(0);
      expect(control.signal.aborted).toBe(true);
      expect(counts).toMatchObject({
        effects: 1,
        finishes: 0,
        appends: 2,
        lookups: 0,
      });
      expect(
        context.events.find((e) => e.workflow === "provider_call.execute"),
      ).toMatchObject({
        perform: "performed",
        outcome_record: "not_attempted",
        code:
          kind === "throw_then_cancel"
            ? "provider_sim_receipt_invalid"
            : "provider_observation_canceled",
      });
      expect(
        context.events.filter((e) => e.command === "provider_outcome.record"),
      ).toEqual([]);
      expect(
        (
          await s.env.owner.query<{ n: number }>(
            "SELECT count(*)::int AS n FROM provider_call_events",
          )
        ).rows[0]?.n,
      ).toBe(0);
      const before = await protectedRows(s.env.owner),
        evidence = await evidenceRows(s.env.owner);
      await assertOriginalPacket(s, producer);
      expect(await protectedRows(s.env.owner)).toBe(before);
      expect(await evidenceRows(s.env.owner)).toEqual(evidence);
      expect(
        JSON.stringify(result) + JSON.stringify(context.events),
      ).not.toContain("CANARY");
      // This measures a descriptor trap during synchronous parsing, not an asynchronous callback after projection.
    },
    120000,
  );
  it.each(["acknowledged", "lost_ack", "release_after_commit"] as const)(
    "certified cancellation DURING record %s awaits actual SQL/commit and preserves first safe facts",
    async (kind) => {
      const s = await setup(),
        counts = phaseCounters(),
        producer = phaseProducer(s, counts),
        control = new AbortController(),
        context = capturingContext();
      await databaseCounterControls(
        measuredPool(s.env.runtime, counts),
        counts,
      );
      const initial = { ...counts };
      let commits = 0,
        releases = 0,
        recordAttempts = 0;
      const pool = measuredPool(
        s.env.runtime,
        counts,
        async (text, native) => {
          if (
            typeof text === "string" &&
            text.includes("INSERT INTO provider_call_events")
          ) {
            recordAttempts++;
            control.abort();
          }
          const value = await native();
          if (text === "COMMIT" && ++commits === 2 && kind === "lost_ack")
            throw new Error("RECORD_LOST_ACK_CANARY");
          return value;
        },
        () => {
          if (++releases === 2 && kind === "release_after_commit")
            throw new Error("RECORD_RELEASE_CANARY");
        },
      );
      let result: unknown, error: unknown;
      try {
        result = await executeProviderCall(
          pool,
          s.reservation,
          producer,
          () => {
            counts.finishes++;
            throw new Error("UNUSED_FINISH_CANARY");
          },
          context.context,
          { ...s.controls, signal: control.signal },
        );
      } catch (caught) {
        error = caught;
      }
      expect(recordAttempts).toBe(1);
      expect(control.signal.aborted).toBe(true);
      expect(commits).toBe(2);
      expect(counts.connect - initial.connect).toBe(2);
      expect(counts.clientQuery - initial.clientQuery).toBeGreaterThan(0);
      expect(counts.poolQuery - initial.poolQuery).toBe(1);
      expect(counts).toMatchObject({
        effects: 1,
        finishes: 0,
        lookups: 0,
        appends: 2,
      });
      if (kind === "acknowledged") {
        expect(error).toBeUndefined();
        expect(result).toMatchObject({
          status: "performed",
          outcome: { kind: "created" },
        });
        expect(
          context.events.find((e) => e.command === "provider_outcome.record"),
        ).toMatchObject({ durability: "committed", outcome: "created" });
      } else {
        expect(result).toBeUndefined();
        expect(error).toMatchObject({
          stage: "record",
          correlation_id: context.context.correlationId,
          commit_state: kind === "lost_ack" ? "unknown" : "committed",
          reservation_commit_state: "committed",
          code:
            kind === "lost_ack"
              ? "provider_execution_commit_unknown"
              : "provider_execution_failed",
          error_class: "unclassified",
        });
        expect(error).not.toHaveProperty("cause");
        expect(error).not.toHaveProperty("errors");
        expect(
          context.events.find((e) => e.command === "provider_outcome.record"),
        ).toMatchObject({
          durability: kind === "lost_ack" ? "unknown" : "committed",
        });
      }
      const { original, final } = await assertOriginalPacket(s, producer);
      expect(original?.outcome).toEqual(final.event);
      expect(
        (
          await s.env.owner.query<{ n: number }>(
            "SELECT count(*)::int AS n FROM provider_call_events",
          )
        ).rows[0]?.n,
      ).toBe(1);
      const committed = await protectedRows(s.env.owner),
        evidence = await evidenceRows(s.env.owner),
        before = { ...counts };
      const recovered = await executeProviderCall(
        pool,
        s.reservation,
        producer,
        () => {
          counts.finishes++;
          throw new Error("RECOVERY_FINISH_CANARY");
        },
        noopContext(),
        undefined,
      );
      expect(recovered.status).toBe("completed");
      expect(counts.effects - before.effects).toBe(0);
      expect(counts.lookups - before.lookups).toBe(0);
      expect(counts.appends - before.appends).toBe(0);
      expect(counts.finishes - before.finishes).toBe(0);
      expect(await protectedRows(s.env.owner)).toBe(committed);
      expect(await evidenceRows(s.env.owner)).toEqual(evidence);
      expect(
        JSON.stringify(result) +
          JSON.stringify(error) +
          (error instanceof Error ? String(error.stack) : "") +
          JSON.stringify(context.events),
      ).not.toContain("CANARY");
    },
    120000,
  );
  it.each(["after_reservation_commit", "after_side_effect"] as const)(
    "certified cancellation at existing %s seam retains exact reservation and performs no projection/record",
    async (point) => {
      const s = await setup(),
        counts = phaseCounters(),
        producer = phaseProducer(s, counts),
        control = new AbortController(),
        context = capturingContext();
      const hook = Symbol.for("the-desk.a5.test-fault-hook"),
        previous = Object.getOwnPropertyDescriptor(globalThis, hook),
        priorFlag = process.env.DESK_TEST_FAULTS;
      let visited = 0;
      process.env.DESK_TEST_FAULTS = "1";
      Object.defineProperty(globalThis, hook, {
        configurable: true,
        value: (name: string) => {
          if (name === point) {
            visited++;
            control.abort();
          }
        },
      });
      try {
        const result = await executeProviderCall(
          s.env.runtime,
          s.reservation,
          {
            async perform(request: ProviderRequest) {
              const packet = await producer.perform(request);
              return new Proxy(packet, {
                getOwnPropertyDescriptor(target, key) {
                  counts.packetDescriptors++;
                  return Reflect.getOwnPropertyDescriptor(target, key);
                },
              });
            },
          },
          () => {
            counts.finishes++;
            throw new Error("UNUSED_SEAM_FINISH_CANARY");
          },
          context.context,
          { ...s.controls, signal: control.signal },
        );
        expect(visited).toBe(1);
        expect(control.signal.aborted).toBe(true);
        expect(result).toMatchObject(
          point === "after_reservation_commit"
            ? { status: "unfinished", reason: "provider_not_invoked_canceled" }
            : { status: "ambiguous", code: "provider_observation_canceled" },
        );
        expect(counts).toMatchObject({
          effects: point === "after_side_effect" ? 1 : 0,
          appends: point === "after_side_effect" ? 2 : 0,
          packetDescriptors: 0,
          packetAccessors: 0,
          finishes: 0,
          lookups: 0,
        });
        expect(
          context.events.find((e) => e.workflow === "provider_call.execute"),
        ).toMatchObject({
          perform:
            point === "after_side_effect" ? "performed" : "not_attempted",
          outcome_record: "not_attempted",
        });
        expect(
          context.events.filter((e) => e.command === "provider_outcome.record"),
        ).toEqual([]);
        const original = await lookupProviderCall(
          s.env.runtime,
          s.reservation.provider_call_id,
        );
        expect(original?.reservation).toEqual(s.reservation);
        expect(original?.outcome).toBeNull();
        if (!original?.admission)
          throw new Error("original committed admission required");
        expect(original.admission.certificate).toEqual(
          buildCertificate(
            s.reservation,
            original.admission.certificate.program_run_id,
            s.invocation.policy,
            s.invocation.request,
          ),
        );
        expect(
          (
            await s.env.owner.query<{ n: number }>(
              "SELECT count(*)::int AS n FROM provider_call_events",
            )
          ).rows[0]?.n,
        ).toBe(0);
        const before = await protectedRows(s.env.owner),
          evidence = await evidenceRows(s.env.owner);
        if (point === "after_side_effect")
          await assertOriginalPacket(s, producer);
        expect(await protectedRows(s.env.owner)).toBe(before);
        expect(await evidenceRows(s.env.owner)).toEqual(evidence);
        expect(
          JSON.stringify(result) + JSON.stringify(context.events),
        ).not.toContain("CANARY");
      } finally {
        if (previous) Object.defineProperty(globalThis, hook, previous);
        else Reflect.deleteProperty(globalThis, hook);
        if (priorFlag === undefined) delete process.env.DESK_TEST_FAULTS;
        else process.env.DESK_TEST_FAULTS = priorFlag;
      }
    },
    120000,
  );
  it("IO-only child SIGKILL leaves occupied unfinished truth; fresh children reconcile only original retained completion bytes", async () => {
    const s = await setup();
    const invocation = {
      ...s.invocation,
      policy: {
        ...s.invocation.policy,
        max_concurrent_global: 1,
        provider_rule: {
          ...s.invocation.policy.provider_rule,
          max_concurrent: 1,
        },
      },
    };
    const spec = {
      runtimeUrl: s.env.runtimeUrl,
      ownerUrl: "",
      reservation: s.reservation,
      tag: "g1-b-io-crash-" + randomUUID(),
      simulation: { invocation, holdAfterInvocation: true },
    };
    // DbEnv exposes the runtime target. Owner target is the same disposable DB using explicitly test-owned credentials.
    if (url === undefined) throw new Error("synthetic PG target required");
    const ownerUrl = new URL(url);
    ownerUrl.pathname = "/" + s.env.name;
    spec.ownerUrl = ownerUrl.toString();
    const child = g1Child(spec);
    let killed = false,
      producerCompletionAppends = 0;
    try {
      await child.held();
      const call = await lookupProviderCall(
        s.env.runtime,
        s.reservation.provider_call_id,
      );
      expect(call?.admission).toBeDefined();
      if (!call?.admission) throw new Error("stored certification required");
      const original = call.admission.certificate;
      const receipts = await s.env.owner.query(
        "SELECT evidence_id::text,record_kind,canonical_bytes,content_hash,xmin::text,ctid::text FROM g1_b_fixture_evidence.receipts",
      );
      expect(receipts.rowCount).toBe(1);
      const row = receipts.rows[0] as {
        evidence_id: string;
        record_kind: string;
        canonical_bytes: Buffer;
        content_hash: string;
        xmin: string;
        ctid: string;
      };
      expect(row.record_kind).toBe("invocation");
      const text = row.canonical_bytes.toString("utf8");
      const io = JSON.parse(text) as Parameters<typeof receiptPacket>[0];
      const expectedAt = {
        provider_call_id: s.reservation.provider_call_id,
        attempt_id: s.reservation.attempt_id,
        program_run_id: original.program_run_id,
        provider: "g1-simulator",
        operation: "g1_sim_text",
        model_identifier: "bytes-v1",
        logical_request_key: s.reservation.logical_request_key,
        request_fingerprint: s.reservation.request_fingerprint,
        admission_certificate_hash: call.admission.certificate_hash,
        admission_policy_hash: original.policy_hash,
      };
      const expectedCt = {
        observation_state: "complete",
        input_text_hash: sha256(
          Buffer.from(invocation.request.input_text, "utf8"),
        ),
        input_bytes: Buffer.byteLength(invocation.request.input_text, "utf8"),
        consumed_output_cap: 3,
        computed_request_fingerprint: requestHash(invocation.request),
        consumed_certificate_hash: call.admission.certificate_hash,
        consumed_provider: "g1-simulator",
        consumed_operation: "g1_sim_text",
        consumed_model_identifier: "bytes-v1",
      };
      const expectedIo = {
        schema: "g1-sim-invocation-observation/1",
        observation_id: row.evidence_id,
        kind: "invocation",
        attribution: expectedAt,
        consumption: expectedCt,
        work_ended: null,
      };
      expect(io).toEqual(expectedIo);
      expect(io.attribution).toEqual(expectedAt);
      expect(io.consumption).toEqual(expectedCt);
      expect(invocation.request.max_output_bytes).toBe(3);
      expect(invocation.request.input_text).toBe("ab");
      expect(original.input_bytes).toBe(expectedCt.input_bytes);
      expect(original.input_text_hash).toBe(expectedCt.input_text_hash);
      expect(original.max_output_bytes).toBe(3);
      expect(Buffer.byteLength(canonicalJson(expectedIo), "utf8")).toBe(
        row.canonical_bytes.length,
      );
      expect(row.canonical_bytes).toEqual(
        Buffer.from(canonicalJson(expectedIo), "utf8"),
      );
      expect(canonicalJson(io)).toBe(text);
      expect(Buffer.from(text, "utf8")).toEqual(row.canonical_bytes);
      expect(
        sha256(
          Buffer.concat([
            Buffer.from("provider-sim-invocation-observation-v1\n"),
            row.canonical_bytes,
          ]),
        ),
      ).toBe(row.content_hash);
      expect(io.observation_id).toBe(row.evidence_id);
      expect(io.attribution.admission_certificate_hash).toBe(
        call.admission.certificate_hash,
      );
      expect(io.work_ended).toBeNull();
      expect(
        (
          await s.env.owner.query<{ n: number }>(
            "SELECT count(*)::int AS n FROM provider_call_events",
          )
        ).rows[0]?.n,
      ).toBe(0);
      expect(producerCompletionAppends).toBe(0);
      const before = await protectedRows(s.env.owner);
      const death = await child.kill();
      killed = true;
      expect(death.signal).toBe("SIGKILL");
      expect(death.code).toBeNull();
      expect(death.stdout).not.toContain("RESULT ");
      const missing = g1Child({
        ...spec,
        simulation: { invocation, reconcile: true },
      });
      const first = await missing.exited();
      expect(first.code).toBe(0);
      expect(first.signal).toBeNull();
      expect(first.stdout.trim()).toBe(
        'RESULT {"status":"unknown","reason":"provider_sim_receipt_invalid"}',
      );
      expect(await protectedRows(s.env.owner)).toBe(before);
      const next = {
        ...s.reservation,
        provider_call_id: randomUUID(),
        logical_request_key: "io-occupied:" + randomUUID(),
      };
      const refused = await executeProviderCall(
        s.env.runtime,
        next,
        s.adapter,
        s.finish,
        noopContext(),
        { ...s.controls, simulation_admission: invocation },
      );
      expect(refused).toEqual({
        status: "rejected",
        result: {
          kind: "rejected",
          code: "provider_admission_concurrency_limit",
          sqlstate: "23514",
        },
      });
      expect(await protectedRows(s.env.owner)).toBe(before);
      expect(s.counts()).toEqual({ performs: 0, finishes: 0 });
      expect(
        (
          await s.env.owner.query(
            "SELECT evidence_id::text,record_kind,canonical_bytes,content_hash,xmin::text,ctid::text FROM g1_b_fixture_evidence.receipts",
          )
        ).rows,
      ).toEqual(receipts.rows);
      // Completion is an explicit test PRODUCER write, separate from runtime observation/late handlers.
      const fr: FinalReceipt = {
        schema: "g1-sim-final-receipt/1",
        receipt_id: randomUUID(),
        kind: "final_accounting",
        invocation_observation_hash: row.content_hash,
        attribution: io.attribution,
        consumption: io.consumption,
        work_ended: true,
        observed_output_bytes: 1,
        price_status: "known_final",
        event: {
          provider_call_id: s.reservation.provider_call_id,
          event_type: "succeeded",
          ended_at: "2026-10-06T00:00:01.000001Z",
          usage: { input_bytes: io.consumption.input_bytes, output_bytes: 1 },
          actual_cost: "0.02",
          currency: "USD",
          response_artifact_id: null,
          response_reference: null,
        },
      };
      await s.evidence.append(fr);
      producerCompletionAppends++;
      expect(producerCompletionAppends).toBe(1);
      const packet = await s.evidence.retrieve(s.reservation.provider_call_id);
      expect(packet).toEqual(receiptPacket(io, fr));
      const finalRows = (
        await s.env.owner.query<{
          evidence_id: string;
          record_kind: string;
          canonical_bytes: Buffer;
          content_hash: string;
          xmin: string;
          ctid: string;
        }>(
          "SELECT evidence_id::text,record_kind,canonical_bytes,content_hash,xmin::text,ctid::text FROM g1_b_fixture_evidence.receipts ORDER BY record_kind",
        )
      ).rows;
      expect(finalRows).toHaveLength(2);
      for (const evidenceRow of finalRows) {
        const bytes = evidenceRow.canonical_bytes,
          domain =
            evidenceRow.record_kind === "invocation"
              ? "provider-sim-invocation-observation-v1"
              : "provider-sim-final-receipt-v1";
        expect(sha256(Buffer.concat([Buffer.from(domain + "\n"), bytes]))).toBe(
          evidenceRow.content_hash,
        );
        const expected =
          evidenceRow.record_kind === "invocation" ? expectedIo : fr;
        expect(evidenceRow.evidence_id).toBe(
          evidenceRow.record_kind === "invocation"
            ? io.observation_id
            : fr.receipt_id,
        );
        expect(JSON.parse(bytes.toString("utf8"))).toEqual(expected);
        expect(bytes).toEqual(Buffer.from(canonicalJson(expected), "utf8"));
      }
      const completed = g1Child({
        ...spec,
        simulation: {
          invocation: {
            ...invocation,
            policy: {
              ...invocation.policy,
              policy_version: "unused-replacement",
            },
          },
          reconcile: true,
        },
      });
      const result = await completed.exited();
      expect(result.code).toBe(0);
      expect(result.signal).toBeNull();
      expect(result.stdout).toContain('"status":"performed"');
      expect(result.stdout + result.stderr).not.toContain("CANARY");
      expect(
        (
          await s.env.owner.query<{ n: number }>(
            "SELECT count(*)::int AS n FROM provider_call_events WHERE provider_call_id=$1",
            [s.reservation.provider_call_id],
          )
        ).rows[0]?.n,
      ).toBe(1);
      expect(
        (
          await s.env.owner.query(
            "SELECT evidence_id::text,record_kind,canonical_bytes,content_hash,xmin::text,ctid::text FROM g1_b_fixture_evidence.receipts ORDER BY record_kind",
          )
        ).rows,
      ).toEqual(finalRows);
      const stored = await lookupProviderCall(
        s.env.runtime,
        s.reservation.provider_call_id,
      );
      expect(stored?.admission).toEqual(call.admission);
      const after = await protectedRows(s.env.owner);
      const replay = g1Child({
        ...spec,
        simulation: { invocation, reconcile: true },
      });
      const recovered = await replay.exited();
      expect(recovered.code).toBe(0);
      expect(recovered.stdout).toContain('"status":"recorded"');
      expect(await protectedRows(s.env.owner)).toBe(after);
      expect(s.counts()).toEqual({ performs: 0, finishes: 0 });
      expect(producerCompletionAppends).toBe(1);
    } finally {
      if (!killed) await child.kill();
    }
  }, 120000);
  it("test evidence is immutable and owner-only; identical append reuses exact bytes, conflicting append refuses", async () => {
    const s = await setup(),
      { io, fr } = await fixtureBodies(s);
    const before = await protectedRows(s.env.owner);
    await s.evidence.append(io);
    expect(
      await s.evidence.retrieve(s.reservation.provider_call_id),
    ).toBeUndefined();
    await s.evidence.append(fr);
    const read = () =>
      s.env.owner.query(
        "SELECT evidence_id::text,record_kind,encode(canonical_bytes,'hex') AS bytes,content_hash,captured_at::text,xmin::text,ctid::text FROM g1_b_fixture_evidence.receipts ORDER BY record_kind",
      );
    const stored = (await read()).rows;
    await s.evidence.append(io);
    await s.evidence.append(fr);
    expect((await read()).rows).toEqual(stored);
    await expect(
      s.evidence.append({ ...io, observation_id: randomUUID() }),
    ).rejects.toThrow("fixture_receipt_conflict");
    await expect(
      s.evidence.append({
        ...fr,
        observed_output_bytes: 0,
        event: { ...fr.event, usage: { input_bytes: 2, output_bytes: 0 } },
      }),
    ).rejects.toThrow("fixture_receipt_conflict");
    for (const pool of [s.env.runtime, s.env.migrator]) {
      await expect(
        pool.query(
          "SELECT canonical_bytes FROM g1_b_fixture_evidence.receipts",
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        new SimulationEvidence(pool).append(io),
      ).rejects.toMatchObject({ code: "42501" });
    }
    const operator = await s.env.owner.connect();
    try {
      await operator.query("BEGIN");
      await operator.query("SET LOCAL ROLE desk_operator");
      await expect(
        operator.query(
          "SELECT canonical_bytes FROM g1_b_fixture_evidence.receipts",
        ),
      ).rejects.toMatchObject({ code: "42501" });
    } finally {
      await operator.query("ROLLBACK");
      operator.release();
    }
    for (const statement of [
      "UPDATE g1_b_fixture_evidence.receipts SET content_hash=content_hash",
      "DELETE FROM g1_b_fixture_evidence.receipts",
      "TRUNCATE g1_b_fixture_evidence.receipts",
    ])
      await expect(s.env.owner.query(statement)).rejects.toMatchObject({
        code: "55000",
      });
    expect((await read()).rows).toEqual(stored);
    const retrieved = await s.evidence.retrieve(s.reservation.provider_call_id);
    expect(retrieved).toEqual(receiptPacket(io, fr));
    expect(await protectedRows(s.env.owner)).toBe(before);
    expect(s.counts()).toEqual({ performs: 0, finishes: 0 });
  }, 120000);
  it.each([
    "io-schema",
    "io-kind",
    "io-closed",
    "fr-schema",
    "fr-kind",
    "fr-type",
    "envelope-id",
    "raw-bytes",
  ] as const)(
    "independent persisted %s corruption with recomputed hash refuses closed evidence without public writes",
    async (kind) => {
      const s = await setup(),
        { io, fr } = await fixtureBodies(s),
        before = await protectedRows(s.env.owner);
      const i: Record<string, unknown> = structuredClone(
        io,
      ) as unknown as Record<string, unknown>;
      const f: Record<string, unknown> = structuredClone(
        fr,
      ) as unknown as Record<string, unknown>;
      if (kind === "io-schema") i.schema = "wrong";
      if (kind === "io-kind") i.kind = "final_accounting";
      if (kind === "io-closed") i.extra = "PROTECTED_EVIDENCE_CANARY";
      if (kind === "fr-schema") f.schema = "wrong";
      if (kind === "fr-kind") f.kind = "invocation";
      if (kind === "fr-type") f.work_ended = "true";
      for (const [recordKind, body, id, domain] of [
        [
          "invocation",
          i,
          io.observation_id,
          "provider-sim-invocation-observation-v1",
        ],
        ["final", f, fr.receipt_id, "provider-sim-final-receipt-v1"],
      ] as const) {
        const bytes =
          kind === "raw-bytes" && recordKind === "invocation"
            ? Buffer.from([0xff])
            : Buffer.from(canonicalJson(body), "utf8");
        await s.env.owner.query(
          "INSERT INTO g1_b_fixture_evidence.receipts(evidence_id,provider_call_id,record_kind,canonical_bytes,content_hash) VALUES($1,$2,$3,$4,$5)",
          [
            kind === "envelope-id" && recordKind === "invocation"
              ? randomUUID()
              : id,
            s.reservation.provider_call_id,
            recordKind,
            bytes,
            domainHash(domain, body),
          ],
        );
      }
      const expected =
        kind === "envelope-id"
          ? "fixture_receipt_envelope_mismatch"
          : "fixture_receipt_corrupt";
      await expect(
        s.evidence.retrieve(s.reservation.provider_call_id),
      ).rejects.toThrow(expected);
      expect(await protectedRows(s.env.owner)).toBe(before);
      expect(s.counts()).toEqual({ performs: 0, finishes: 0 });
    },
    120000,
  );
  it("actual committed certificate/request reaches trusted adapter; certified success ignores generic finish and recovers retained receipt", async () => {
    const s = await setup(),
      captured = capturingContext();
    const result = await executeProviderCall(
      s.env.runtime,
      s.reservation,
      s.adapter,
      s.finish,
      captured.context,
      s.controls,
    );
    expect(result.status).toBe("performed");
    if (result.status !== "performed")
      throw new Error("created perform required");
    expect(result.outcome.kind).toBe("created");
    expect(s.counts()).toEqual({ performs: 1, finishes: 0 });
    const stored = await lookupProviderCall(
      s.env.runtime,
      s.reservation.provider_call_id,
    );
    expect(stored?.admission?.certificate.reserved_cost_upper_bound).toBe(
      "0.03",
    );
    const packet = await s.evidence.retrieve(s.reservation.provider_call_id);
    expect(packet).toBeDefined();
    const rows = (
      await s.env.owner.query<{
        record_kind: string;
        canonical_bytes: Buffer;
        content_hash: string;
      }>(
        "SELECT record_kind,canonical_bytes,content_hash FROM g1_b_fixture_evidence.receipts ORDER BY record_kind",
      )
    ).rows;
    expect(rows.length).toBe(2);
    expect(rows.every((row) => Buffer.isBuffer(row.canonical_bytes))).toBe(
      true,
    );
    const before = await protectedRows(s.env.owner);
    const reuse = await executeProviderCall(
      s.env.runtime,
      s.reservation,
      s.adapter,
      s.finish,
      noopContext(),
      undefined,
    );
    expect(reuse.status).toBe("completed");
    expect(s.counts()).toEqual({ performs: 1, finishes: 0 });
    expect(await protectedRows(s.env.owner)).toBe(before);
    expect(JSON.stringify(captured.events)).not.toContain(
      "PROTECTED_GENERIC_FINISH_CANARY",
    );
  }, 120000);
  it.each(["same-id", "held-slot"] as const)(
    "completed %s recovery survives invalid scalar policy and actual stop-new-work controls with no NEW temporal queries",
    async (kind) => {
      const s = await setup();
      expect(
        (
          await executeProviderCall(
            s.env.runtime,
            s.reservation,
            s.adapter,
            s.finish,
            noopContext(),
            s.controls,
          )
        ).status,
      ).toBe("performed");
      const original = await lookupProviderCall(
          s.env.runtime,
          s.reservation.provider_call_id,
        ),
        hash = original?.admission?.certificate_hash;
      if (!hash || !original.outcome)
        throw new Error("completed original required");
      const counts = phaseCounters(),
        queries: string[] = [],
        context = capturingContext();
      const pool = measuredPool(s.env.runtime, counts, async (text, native) => {
        if (typeof text === "string") queries.push(text);
        return native();
      });
      await databaseCounterControls(pool, counts);
      const adapter = {
        async perform(r: ProviderRequest) {
          counts.effects++;
          return s.adapter.perform(r);
        },
        async lookup(r: ProviderRequest) {
          counts.lookups++;
          return s.adapter.lookup(r);
        },
      };
      const before = await protectedRows(s.env.owner),
        receipts = await evidenceRows(s.env.owner),
        at = { ...counts };
      const authored =
        kind === "same-id"
          ? s.reservation
          : { ...s.reservation, provider_call_id: randomUUID() };
      // These are the ACTUAL G1-A controls, not unused synthetic flags. The third case fails full controls parsing.
      for (const controls of [
        {
          ...s.controls,
          GENERATION_KILL_SWITCH: true,
          simulation_admission: {
            ...s.invocation,
            policy: 7,
            expected_original_certificate_hash: hash,
          },
        },
        {
          ...s.controls,
          PROVIDERS_ENABLED: true,
          simulation_admission: {
            ...s.invocation,
            policy: 7,
            expected_original_certificate_hash: hash,
          },
        },
        {
          ...s.controls,
          PROVIDER_CALL_TIMEOUT_MS: "invalid",
          simulation_admission: {
            ...s.invocation,
            policy: 7,
            expected_original_certificate_hash: hash,
          },
        },
      ]) {
        const start = queries.length,
          result = await executeProviderCall(
            pool,
            authored,
            adapter,
            () => {
              counts.finishes++;
              throw new Error("RECOVERY_FINISH_CANARY");
            },
            context.context,
            controls,
          );
        expect(result).toEqual({
          status: "completed",
          reservation: original.reservation,
          outcome: original.outcome,
        });
        const executed = queries.slice(start);
        expect(executed.length).toBeGreaterThan(0);
        expect(
          executed.some((q) =>
            /INSERT INTO provider_calls|INSERT INTO provider_call_events|clock_timestamp|CURRENT_TIMESTAMP|set_config|SELECT program_run_id::text AS run_id/.test(
              q,
            ),
          ),
        ).toBe(false);
        expect(await protectedRows(s.env.owner)).toBe(before);
        expect(await evidenceRows(s.env.owner)).toEqual(receipts);
      }
      expect(counts.effects - at.effects).toBe(0);
      expect(counts.lookups - at.lookups).toBe(0);
      expect(counts.finishes - at.finishes).toBe(0);
      expect(counts.appends - at.appends).toBe(0);
      expect(
        context.events.filter((e) => e.command === "provider_outcome.record"),
      ).toEqual([]);
      expect(JSON.stringify(context.events)).not.toContain("CANARY");
      expect(
        await lookupProviderCall(s.env.runtime, s.reservation.provider_call_id),
      ).toEqual(original);
      // Source + real recovery proof, NOT induced midnight/day rollover. No public clock input is invented.
      const source = await readFile(
          new URL("../../src/runtime/provider.ts", import.meta.url),
          "utf8",
        ),
        start = source.indexOf("async function reserveCore("),
        end = source.indexOf("const insert = await tx.attempt(", start);
      expect(start).toBeGreaterThan(0);
      expect(end).toBeGreaterThan(start);
      const ordering = source.slice(start, end);
      for (const marker of [
        "const existing = await classifyExisting(tx, r)",
        "const refused = beforeInsert?.()",
        "return existing;",
        "certification?.prepare(tx)",
        "provider_admission_original_missing",
      ]) {
        expect(ordering.split(marker)).toHaveLength(2);
        expect(ordering.indexOf(marker)).toBeGreaterThanOrEqual(0);
      }
      expect(
        ordering.indexOf("const existing = await classifyExisting(tx, r)"),
      ).toBeLessThan(ordering.indexOf("const refused = beforeInsert?.()"));
      expect(ordering.indexOf("return existing;")).toBeLessThan(
        ordering.indexOf("certification?.prepare(tx)"),
      );
      expect(
        ordering.indexOf("provider_admission_original_missing"),
      ).toBeLessThan(ordering.indexOf("certification?.prepare(tx)"));
    },
    120000,
  );
  it.each(["same-id", "held-slot"] as const)(
    "absent and explicit NULL original claims recover completed %s under disabled NEW work",
    async (kind) => {
      const s = await setup();
      await executeProviderCall(
        s.env.runtime,
        s.reservation,
        s.adapter,
        s.finish,
        noopContext(),
        s.controls,
      );
      const original = await lookupProviderCall(
        s.env.runtime,
        s.reservation.provider_call_id,
      );
      if (!original?.outcome) throw new Error("original outcome required");
      const counts = phaseCounters(),
        queries: string[] = [],
        pool = measuredPool(s.env.runtime, counts, async (text, native) => {
          if (typeof text === "string") queries.push(text);
          return native();
        });
      const adapter = {
        async perform(r: ProviderRequest) {
          counts.effects++;
          return s.adapter.perform(r);
        },
        async lookup(r: ProviderRequest) {
          counts.lookups++;
          return s.adapter.lookup(r);
        },
      };
      const before = await protectedRows(s.env.owner),
        receipts = await evidenceRows(s.env.owner),
        authored =
          kind === "same-id"
            ? s.reservation
            : { ...s.reservation, provider_call_id: randomUUID() };
      for (const controls of [
        undefined,
        {
          ...s.controls,
          GENERATION_KILL_SWITCH: true,
          simulation_admission: {
            expected_original_certificate_hash: null,
            policy: 7,
          },
        },
      ]) {
        expect(
          await executeProviderCall(
            pool,
            authored,
            adapter,
            () => {
              counts.finishes++;
              throw new Error("UNUSED_NULL_CLAIM_FINISH_CANARY");
            },
            noopContext(),
            controls,
          ),
        ).toEqual({
          status: "completed",
          reservation: original.reservation,
          outcome: original.outcome,
        });
        expect(await protectedRows(s.env.owner)).toBe(before);
        expect(await evidenceRows(s.env.owner)).toEqual(receipts);
      }
      expect(counts).toMatchObject({
        effects: 0,
        lookups: 0,
        finishes: 0,
        appends: 0,
      });
      expect(
        queries.some((q) =>
          /INSERT INTO provider_calls|INSERT INTO provider_call_events|clock_timestamp|set_config|SELECT program_run_id::text AS run_id/.test(
            q,
          ),
        ),
      ).toBe(false);
      expect(
        await lookupProviderCall(s.env.runtime, s.reservation.provider_call_id),
      ).toEqual(original);
    },
    120000,
  );
  it.each(["same-id", "held-slot"] as const)(
    "malformed and uninspectable explicit claims preflight-refuse %s with valid replacement policy and ZERO DB",
    async (kind) => {
      const s = await setup();
      await executeProviderCall(
        s.env.runtime,
        s.reservation,
        s.adapter,
        s.finish,
        noopContext(),
        s.controls,
      );
      const before = await protectedRows(s.env.owner),
        receipts = await evidenceRows(s.env.owner),
        counts = phaseCounters(),
        pool = measuredPool(s.env.runtime, counts);
      let getterReads = 0,
        trapCalls = 0;
      const claimAccessor = { ...s.invocation };
      Object.defineProperty(
        claimAccessor,
        "expected_original_certificate_hash",
        {
          get() {
            getterReads++;
            throw new Error("UNREAD_CLAIM_GETTER_CANARY");
          },
        },
      );
      const trapping = new Proxy(
        { ...s.invocation },
        {
          getOwnPropertyDescriptor(target, key) {
            if (key === "expected_original_certificate_hash") {
              trapCalls++;
              throw new Error("CONSUMED_CLAIM_DESCRIPTOR_CANARY");
            }
            return Reflect.getOwnPropertyDescriptor(target, key);
          },
        },
      );
      // Positive controls distinguish actually consumed descriptor trap from an uninvoked getter.
      expect(() =>
        Object.getOwnPropertyDescriptor(
          trapping,
          "expected_original_certificate_hash",
        ),
      ).toThrow("CONSUMED_CLAIM_DESCRIPTOR_CANARY");
      const trapBefore = trapCalls;
      const authored =
          kind === "same-id"
            ? s.reservation
            : { ...s.reservation, provider_call_id: randomUUID() },
        context = capturingContext();
      for (const simulation of [
        { ...s.invocation, expected_original_certificate_hash: "not-a-hash" },
        claimAccessor,
        trapping,
      ]) {
        expect(
          await executeProviderCall(
            pool,
            authored,
            {
              async perform(r: ProviderRequest) {
                counts.effects++;
                return s.adapter.perform(r);
              },
              async lookup(r: ProviderRequest) {
                counts.lookups++;
                return s.adapter.lookup(r);
              },
            },
            () => {
              counts.finishes++;
              throw new Error("UNUSED_CLAIM_FINISH_CANARY");
            },
            context.context,
            { ...s.controls, simulation_admission: simulation },
          ),
        ).toEqual({
          status: "rejected",
          result: {
            kind: "rejected",
            code: "provider_admission_original_claim_invalid",
          },
        });
        expect(await protectedRows(s.env.owner)).toBe(before);
        expect(await evidenceRows(s.env.owner)).toEqual(receipts);
      }
      expect(getterReads).toBe(0);
      expect(trapCalls - trapBefore).toBe(1);
      expect(counts).toMatchObject({
        connect: 0,
        clientQuery: 0,
        poolQuery: 0,
        effects: 0,
        lookups: 0,
        finishes: 0,
        appends: 0,
      });
      expect(JSON.stringify(context.events)).not.toContain("CANARY");
      expect(
        context.events.filter((e) => e.command === "provider_outcome.record"),
      ).toEqual([]);
    },
    120000,
  );
  it("safely extracted HASH with missing original refuses after identity reads but before any INSERT/temporal-admission/perform", async () => {
    const s = await setup(),
      counts = phaseCounters(),
      queries: string[] = [],
      pool = measuredPool(s.env.runtime, counts, async (text, native) => {
        if (typeof text === "string") queries.push(text);
        return native();
      });
    const before = await protectedRows(s.env.owner),
      receipts = await evidenceRows(s.env.owner),
      context = capturingContext();
    const result = await executeProviderCall(
      pool,
      s.reservation,
      {
        async perform(r: ProviderRequest) {
          counts.effects++;
          return s.adapter.perform(r);
        },
      },
      () => {
        counts.finishes++;
        throw new Error("MISSING_ORIGINAL_FINISH_CANARY");
      },
      context.context,
      {
        ...s.controls,
        GENERATION_KILL_SWITCH: true,
        simulation_admission: {
          policy: 7,
          expected_original_certificate_hash: "c".repeat(64),
        },
      },
    );
    expect(result).toEqual({
      status: "rejected",
      result: { kind: "rejected", code: "provider_admission_original_missing" },
    });
    expect(counts.connect).toBeGreaterThan(0);
    expect(counts).toMatchObject({
      effects: 0,
      appends: 0,
      lookups: 0,
      finishes: 0,
    });
    expect(
      queries.some((q) =>
        /INSERT INTO provider_calls|INSERT INTO provider_call_events|clock_timestamp|set_config|SELECT program_run_id::text AS run_id/.test(
          q,
        ),
      ),
    ).toBe(false);
    expect(await protectedRows(s.env.owner)).toBe(before);
    expect(await evidenceRows(s.env.owner)).toEqual(receipts);
    expect(JSON.stringify(context.events)).not.toContain("CANARY");
  }, 120000);
  it.each(["same-id", "held-slot"] as const)(
    "correct original claim plus policy getter recovers %s with no getter or new effect",
    async (kind) => {
      const s = await setup();
      await executeProviderCall(
        s.env.runtime,
        s.reservation,
        s.adapter,
        s.finish,
        noopContext(),
        s.controls,
      );
      const original = await lookupProviderCall(
        s.env.runtime,
        s.reservation.provider_call_id,
      );
      const hash = original?.admission?.certificate_hash;
      if (!hash) throw new Error("certificate missing");
      let policyReads = 0;
      const simulation = {
        expected_original_certificate_hash: hash,
        get policy() {
          policyReads++;
          throw new Error("POLICY_GETTER_CANARY");
        },
      };
      const before = await protectedRows(s.env.owner);
      const authored =
        kind === "same-id"
          ? s.reservation
          : { ...s.reservation, provider_call_id: randomUUID() };
      const result = await executeProviderCall(
        s.env.runtime,
        authored,
        s.adapter,
        s.finish,
        noopContext(),
        { simulation_admission: simulation },
      );
      expect(result.status).toBe("completed");
      if (result.status !== "completed") throw new Error("recovery required");
      expect(result.reservation.provider_call_id).toBe(
        s.reservation.provider_call_id,
      );
      expect(policyReads).toBe(0);
      expect(s.counts()).toEqual({ performs: 1, finishes: 0 });
      expect(await protectedRows(s.env.owner)).toBe(before);
    },
    120000,
  );
  it.each(["same-id", "held-slot"] as const)(
    "wrong original claim plus valid replacement policy refuses %s with unchanged full rows",
    async (kind) => {
      const s = await setup();
      await executeProviderCall(
        s.env.runtime,
        s.reservation,
        s.adapter,
        s.finish,
        noopContext(),
        s.controls,
      );
      const before = await protectedRows(s.env.owner),
        authored =
          kind === "same-id"
            ? s.reservation
            : { ...s.reservation, provider_call_id: randomUUID() };
      const result = await executeProviderCall(
        s.env.runtime,
        authored,
        s.adapter,
        s.finish,
        noopContext(),
        {
          ...s.controls,
          simulation_admission: {
            ...s.invocation,
            expected_original_certificate_hash: "b".repeat(64),
          },
        },
      );
      expect(result).toEqual({
        status: "rejected",
        result: {
          kind: "rejected",
          code: "provider_admission_certificate_conflict",
        },
      });
      expect(await protectedRows(s.env.owner)).toBe(before);
      expect(s.counts()).toEqual({ performs: 1, finishes: 0 });
    },
    120000,
  );
  it("explicit accessor claim refuses before ALL database access while immutable conflicts retain their precedence", async () => {
    const s = await setup();
    let reads = 0,
      dbCalls = 0;
    const noDb = new Proxy(s.env.runtime, {
      get(target, key) {
        if (key === "connect" || key === "query")
          return () => {
            dbCalls++;
            throw new Error("PREDB_CANARY");
          };
        const value: unknown = Reflect.get(target, key, target);
        return value;
      },
    });
    const before = await protectedRows(s.env.owner);
    const result = await executeProviderCall(
      noDb,
      s.reservation,
      s.adapter,
      s.finish,
      noopContext(),
      {
        simulation_admission: {
          get expected_original_certificate_hash() {
            reads++;
            throw new Error("CLAIM_CANARY");
          },
        },
      },
    );
    expect(result).toEqual({
      status: "rejected",
      result: {
        kind: "rejected",
        code: "provider_admission_original_claim_invalid",
      },
    });
    expect(reads).toBe(0);
    expect(dbCalls).toBe(0);
    expect(await protectedRows(s.env.owner)).toBe(before);
    await executeProviderCall(
      s.env.runtime,
      s.reservation,
      s.adapter,
      s.finish,
      noopContext(),
      s.controls,
    );
    const conflicting = await executeProviderCall(
      s.env.runtime,
      { ...s.reservation, model_identifier: "wrong" },
      s.adapter,
      s.finish,
      noopContext(),
      {
        ...s.controls,
        simulation_admission: {
          ...s.invocation,
          expected_original_certificate_hash: "b".repeat(64),
        },
      },
    );
    expect(conflicting.status).toBe("conflict");
    expect(s.counts()).toEqual({ performs: 1, finishes: 0 });
  }, 120000);
  it("certified explicit reconciliation verifies ORIGINAL retained Packet and never calls generic finish or performs", async () => {
    const s = await setup();
    let produced: ReceiptPacket | undefined;
    const invoked = await executeProviderCall(
      s.env.runtime,
      s.reservation,
      {
        async perform(r) {
          produced = await s.adapter.perform(r);
          throw new Error("PERFORM_AFTER_EFFECT_CANARY");
        },
      },
      s.finish,
      noopContext(),
      s.controls,
    );
    expect(invoked.status).toBe("ambiguous");
    expect(produced).toBeDefined();
    expect(
      (
        await s.env.owner.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM provider_call_events",
        )
      ).rows[0]?.n,
    ).toBe(0);
    const recovered = await reconcileProviderCall(
      s.env.runtime,
      {
        providerCallId: s.reservation.provider_call_id,
        adapter: s.adapter,
        finish: s.finish,
      },
      noopContext(),
    );
    expect(recovered.status).toBe("performed");
    if (recovered.status !== "performed")
      throw new Error("reconciliation required");
    expect(recovered.recorded?.kind).toBe("created");
    expect(s.counts()).toEqual({ performs: 1, finishes: 0 });
    const before = await protectedRows(s.env.owner);
    const final = await reconcileProviderCall(
      s.env.runtime,
      {
        providerCallId: s.reservation.provider_call_id,
        adapter: {
          lookup() {
            return Promise.reject(new Error("UNUSED_LOOKUP_CANARY"));
          },
        },
        finish: s.finish,
      },
      noopContext(),
    );
    expect(final.status).toBe("recorded");
    expect(await protectedRows(s.env.owner)).toBe(before);
  }, 120000);
});
