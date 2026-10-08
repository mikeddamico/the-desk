// Test-owned non-network fixtures ONLY. No production defaults, provider authority or second ledger.
import { randomUUID } from "node:crypto";
import type pg from "pg";
import {
  canonicalJson,
  domainHash,
  normalizeString,
  sha256,
} from "../../src/identity/canonical-json.js";
import type { AuthoredReservation } from "../../src/runtime/provider.js";
import {
  type Policy,
  type AdmissionRequest,
  type Certificate,
  type Consumption,
  type InvocationObservation,
  type FinalReceipt,
  type ReceiptPacket,
  readPolicy,
  readCertificate,
  readInvocationObservation,
  readFinalReceipt,
  attribution,
  invocationHash,
  finalHash,
} from "../../src/runtime/provider-admission.js";

export function simulationPolicy(): Policy {
  return readPolicy({
    schema: "g1-sim-admission-policy/1",
    mode: "trusted_non_network_simulation",
    policy_version: "test-1",
    scope: "single_database_installation",
    currency: "USD",
    accounting_quantum: "0.01",
    attempt_cost_ceiling: "0.06",
    run_cost_ceiling: "0.12",
    utc_day_cost_ceiling: "0.15",
    max_reservations_per_attempt: 100,
    max_reservations_per_run: 100,
    max_reservations_per_utc_day: 100,
    max_operational_retries_per_chain: 2,
    max_operational_retries_per_attempt: 20,
    max_operational_retries_per_run: 20,
    max_operational_retries_per_utc_day: 20,
    max_intentional_rerolls_per_base: 0,
    max_intentional_rerolls_per_attempt: 0,
    max_intentional_rerolls_per_run: 0,
    max_intentional_rerolls_per_utc_day: 0,
    max_concurrent_global: 2,
    global_rate: { max_admissions: 100, window_ms: 10000, min_spacing_ms: 0 },
    provider_rule: {
      provider: "g1-simulator",
      operation: "g1_sim_text",
      model_identifier: "bytes-v1",
      max_concurrent: 2,
      rate: { max_admissions: 100, window_ms: 10000, min_spacing_ms: 0 },
      tariff: {
        schema: "g1-sim-byte-tariff/1",
        tariff_version: "test-1",
        tariff_source_hash: "a".repeat(64),
        input_unit: "nfc_utf8_byte",
        output_unit: "utf8_byte",
        fixed_fee: "0.001",
        input_price_per_byte: "0.003",
        output_price_per_byte: "0.007",
        max_input_bytes: 1048576,
        max_output_bytes: 1048576,
      },
    },
  });
}
export const simulationRequest = (): AdmissionRequest => ({
  schema: "g1-sim-request/1",
  input_text: "ab",
  max_output_bytes: 3,
});
// Fixed expected canonical bytes/hashes: independently authored Python stdlib JSON/Decimal/SHA256 vectors.
// Runtime profiles and serializer were NOT imported to calculate these expectations; amounts are synthetic test data only.
export const SIMULATION_HASH_VECTORS = [
  {
    domain: "provider-admission-policy-v1",
    json: '{"accounting_quantum":"0.01","attempt_cost_ceiling":"0.06","currency":"USD","global_rate":{"max_admissions":100,"min_spacing_ms":0,"window_ms":10000},"max_concurrent_global":2,"max_intentional_rerolls_per_attempt":0,"max_intentional_rerolls_per_base":0,"max_intentional_rerolls_per_run":0,"max_intentional_rerolls_per_utc_day":0,"max_operational_retries_per_attempt":20,"max_operational_retries_per_chain":2,"max_operational_retries_per_run":20,"max_operational_retries_per_utc_day":20,"max_reservations_per_attempt":100,"max_reservations_per_run":100,"max_reservations_per_utc_day":100,"mode":"trusted_non_network_simulation","policy_version":"test-1","provider_rule":{"max_concurrent":2,"model_identifier":"bytes-v1","operation":"g1_sim_text","provider":"g1-simulator","rate":{"max_admissions":100,"min_spacing_ms":0,"window_ms":10000},"tariff":{"fixed_fee":"0.001","input_price_per_byte":"0.003","input_unit":"nfc_utf8_byte","max_input_bytes":1048576,"max_output_bytes":1048576,"output_price_per_byte":"0.007","output_unit":"utf8_byte","schema":"g1-sim-byte-tariff/1","tariff_source_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","tariff_version":"test-1"}},"run_cost_ceiling":"0.12","schema":"g1-sim-admission-policy/1","scope":"single_database_installation","utc_day_cost_ceiling":"0.15"}',
    utf8_bytes: 1319,
    sha256: "995467a51c15148cdb7c5aaad8278ee6b0768eb116f85e473d3380b3b584ac0d",
  },
  {
    domain: "provider-admission-request-v1",
    json: '{"input_text":"ab","max_output_bytes":3,"schema":"g1-sim-request/1"}',
    utf8_bytes: 68,
    sha256: "0eaf3fe9923a837297754f21f0df38fcc41043cfee22f2f7c3ec7cb2110fb293",
  },
  {
    domain: "provider-admission-certificate-v1",
    json: '{"accounting_quantum":"0.01","attempt_id":"00000000-0000-4000-8000-000000000002","currency":"USD","input_bytes":2,"input_text_hash":"fb8e20fc2e4c3f248c60c39bd652f3c1347298bb977b8b4d5903b85055620603","intentional_take_index":null,"logical_request_key":"vector:1","max_output_bytes":3,"mode":"trusted_non_network_simulation","model_identifier":"bytes-v1","operation":"g1_sim_text","operational_try_number":1,"policy":{"accounting_quantum":"0.01","attempt_cost_ceiling":"0.06","currency":"USD","global_rate":{"max_admissions":100,"min_spacing_ms":0,"window_ms":10000},"max_concurrent_global":2,"max_intentional_rerolls_per_attempt":0,"max_intentional_rerolls_per_base":0,"max_intentional_rerolls_per_run":0,"max_intentional_rerolls_per_utc_day":0,"max_operational_retries_per_attempt":20,"max_operational_retries_per_chain":2,"max_operational_retries_per_run":20,"max_operational_retries_per_utc_day":20,"max_reservations_per_attempt":100,"max_reservations_per_run":100,"max_reservations_per_utc_day":100,"mode":"trusted_non_network_simulation","policy_version":"test-1","provider_rule":{"max_concurrent":2,"model_identifier":"bytes-v1","operation":"g1_sim_text","provider":"g1-simulator","rate":{"max_admissions":100,"min_spacing_ms":0,"window_ms":10000},"tariff":{"fixed_fee":"0.001","input_price_per_byte":"0.003","input_unit":"nfc_utf8_byte","max_input_bytes":1048576,"max_output_bytes":1048576,"output_price_per_byte":"0.007","output_unit":"utf8_byte","schema":"g1-sim-byte-tariff/1","tariff_source_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","tariff_version":"test-1"}},"run_cost_ceiling":"0.12","schema":"g1-sim-admission-policy/1","scope":"single_database_installation","utc_day_cost_ceiling":"0.15"},"policy_hash":"995467a51c15148cdb7c5aaad8278ee6b0768eb116f85e473d3380b3b584ac0d","program_run_id":"00000000-0000-4000-8000-000000000003","provider":"g1-simulator","provider_call_id":"00000000-0000-4000-8000-000000000001","request_fingerprint":"0eaf3fe9923a837297754f21f0df38fcc41043cfee22f2f7c3ec7cb2110fb293","reroll_of_provider_call_id":null,"reroll_trigger_id":null,"reserved_cost_upper_bound":"0.03","retry_of_provider_call_id":null,"schema":"g1-sim-admission-certificate/1","unrounded_bound":"0.028"}',
    utf8_bytes: 2240,
    sha256: "fa32201150a117ca14700640f8844d114c75340f03d4d22e826a907dba9a0a45",
  },
  {
    domain: "provider-sim-invocation-observation-v1",
    json: '{"attribution":{"admission_certificate_hash":"fa32201150a117ca14700640f8844d114c75340f03d4d22e826a907dba9a0a45","admission_policy_hash":"995467a51c15148cdb7c5aaad8278ee6b0768eb116f85e473d3380b3b584ac0d","attempt_id":"00000000-0000-4000-8000-000000000002","logical_request_key":"vector:1","model_identifier":"bytes-v1","operation":"g1_sim_text","program_run_id":"00000000-0000-4000-8000-000000000003","provider":"g1-simulator","provider_call_id":"00000000-0000-4000-8000-000000000001","request_fingerprint":"0eaf3fe9923a837297754f21f0df38fcc41043cfee22f2f7c3ec7cb2110fb293"},"consumption":{"computed_request_fingerprint":"0eaf3fe9923a837297754f21f0df38fcc41043cfee22f2f7c3ec7cb2110fb293","consumed_certificate_hash":"fa32201150a117ca14700640f8844d114c75340f03d4d22e826a907dba9a0a45","consumed_model_identifier":"bytes-v1","consumed_operation":"g1_sim_text","consumed_output_cap":3,"consumed_provider":"g1-simulator","input_bytes":2,"input_text_hash":"fb8e20fc2e4c3f248c60c39bd652f3c1347298bb977b8b4d5903b85055620603","observation_state":"complete"},"kind":"invocation","observation_id":"00000000-0000-4000-8000-000000000004","schema":"g1-sim-invocation-observation/1","work_ended":null}',
    utf8_bytes: 1185,
    sha256: "9fa409b1c106788327d4ea0021eb066c2edd648ef0abec3d65d42093c38a0c6c",
  },
  {
    domain: "provider-sim-final-receipt-v1",
    json: '{"attribution":{"admission_certificate_hash":"fa32201150a117ca14700640f8844d114c75340f03d4d22e826a907dba9a0a45","admission_policy_hash":"995467a51c15148cdb7c5aaad8278ee6b0768eb116f85e473d3380b3b584ac0d","attempt_id":"00000000-0000-4000-8000-000000000002","logical_request_key":"vector:1","model_identifier":"bytes-v1","operation":"g1_sim_text","program_run_id":"00000000-0000-4000-8000-000000000003","provider":"g1-simulator","provider_call_id":"00000000-0000-4000-8000-000000000001","request_fingerprint":"0eaf3fe9923a837297754f21f0df38fcc41043cfee22f2f7c3ec7cb2110fb293"},"consumption":{"computed_request_fingerprint":"0eaf3fe9923a837297754f21f0df38fcc41043cfee22f2f7c3ec7cb2110fb293","consumed_certificate_hash":"fa32201150a117ca14700640f8844d114c75340f03d4d22e826a907dba9a0a45","consumed_model_identifier":"bytes-v1","consumed_operation":"g1_sim_text","consumed_output_cap":3,"consumed_provider":"g1-simulator","input_bytes":2,"input_text_hash":"fb8e20fc2e4c3f248c60c39bd652f3c1347298bb977b8b4d5903b85055620603","observation_state":"complete"},"event":{"actual_cost":"0.025","currency":"USD","ended_at":"2026-10-06T00:00:00.000002Z","event_type":"succeeded","provider_call_id":"00000000-0000-4000-8000-000000000001","response_artifact_id":null,"response_reference":"retained-é","usage":{"input_bytes":2,"output_bytes":2}},"invocation_observation_hash":"9fa409b1c106788327d4ea0021eb066c2edd648ef0abec3d65d42093c38a0c6c","kind":"final_accounting","observed_output_bytes":2,"price_status":"known_final","receipt_id":"00000000-0000-4000-8000-000000000005","schema":"g1-sim-final-receipt/1","work_ended":true}',
    utf8_bytes: 1609,
    sha256: "d94f80d9d35c15986b8bb107200ac896895fd97083bbab22e7ceb28f66612402",
  },
] as const;
// Measurement is not authorization. Invalid/unavailable observations become NULL without accessing getters.
function measurementSnapshot(
  value: unknown,
): Record<string, unknown> | undefined {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      return undefined;
    const proto: unknown = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return undefined;
    const out: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return undefined;
      const d = Object.getOwnPropertyDescriptor(value, key);
      if (!d || !("value" in d)) return undefined;
      Object.defineProperty(out, key, { value: d.value, enumerable: true });
    }
    return out;
  } catch {
    return undefined;
  }
}
export function measuredConsumption(
  request: unknown,
  used: unknown,
): Consumption {
  const r = measurementSnapshot(request),
    u = measurementSnapshot(used);
  const observed: Omit<Consumption, "observation_state"> = {
    input_text_hash: null,
    input_bytes: null,
    consumed_output_cap: null,
    computed_request_fingerprint: null,
    consumed_certificate_hash: null,
    consumed_provider: null,
    consumed_operation: null,
    consumed_model_identifier: null,
  };
  if (r) {
    if (typeof r.input_text === "string") {
      try {
        normalizeString(r.input_text); // Validate Unicode only; measure the original raw bytes BEFORE NFC.
        observed.input_text_hash = sha256(Buffer.from(r.input_text, "utf8"));
        observed.input_bytes = Buffer.byteLength(r.input_text, "utf8");
      } catch {
        /* Unavailable text remains unobserved. */
      }
    }
    if (
      typeof r.max_output_bytes === "number" &&
      Number.isSafeInteger(r.max_output_bytes) &&
      !Object.is(r.max_output_bytes, -0) &&
      r.max_output_bytes >= 0 &&
      r.max_output_bytes <= 2147483647
    )
      observed.consumed_output_cap = r.max_output_bytes;
    if (
      r.schema === "g1-sim-request/1" &&
      Object.keys(r).length === 3 &&
      observed.input_text_hash !== null &&
      observed.consumed_output_cap !== null
    )
      observed.computed_request_fingerprint = domainHash(
        "provider-admission-request-v1",
        r,
      );
  }
  if (u) {
    for (const [key, target] of [
      ["provider", "consumed_provider"],
      ["operation", "consumed_operation"],
      ["model_identifier", "consumed_model_identifier"],
    ] as const)
      if (
        typeof u[key] === "string" &&
        /^[a-z0-9][a-z0-9._:/-]{0,127}$/.test(u[key])
      )
        observed[target] = u[key];
    try {
      const certificate = readCertificate(
        u,
        u as unknown as AuthoredReservation,
        typeof u.program_run_id === "string" ? u.program_run_id : "",
      );
      observed.consumed_certificate_hash = domainHash(
        "provider-admission-certificate-v1",
        certificate,
      );
    } catch {
      /* Invalid certificates are not measured as a valid hash fact. */
    }
  }
  return {
    observation_state: Object.values(observed).some((value) => value === null)
      ? "incomplete"
      : "complete",
    ...observed,
  };
}
export function invocationObservation(
  original: Certificate,
  request: AdmissionRequest,
  used = original,
): InvocationObservation {
  return {
    schema: "g1-sim-invocation-observation/1",
    observation_id: randomUUID(),
    kind: "invocation",
    attribution: attribution(original),
    consumption: measuredConsumption(request, used),
    work_ended: null,
  };
}
export function receiptPacket(
  io: InvocationObservation,
  fr: FinalReceipt,
): ReceiptPacket {
  return {
    schema: "g1-sim-receipt-packet/1",
    invocation_json: canonicalJson(io),
    invocation_hash: invocationHash(io),
    final_json: canonicalJson(fr),
    final_hash: finalHash(fr),
  };
}
/** Separate owner connection to external fixture evidence; runtime/operator/migrator have no evidence access. */
export class SimulationEvidence {
  constructor(readonly owner: pg.Pool) {}
  async initialize(): Promise<void> {
    await this.owner.query(`CREATE SCHEMA g1_b_fixture_evidence;
      REVOKE ALL ON SCHEMA g1_b_fixture_evidence FROM PUBLIC,desk_runtime,desk_operator,desk_migrator;
      CREATE TABLE g1_b_fixture_evidence.receipts(
        evidence_id uuid PRIMARY KEY, provider_call_id uuid NOT NULL,
        record_kind text NOT NULL CHECK(record_kind IN ('invocation','final')),
        canonical_bytes bytea NOT NULL,content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),
        captured_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(provider_call_id,record_kind));
      CREATE FUNCTION g1_b_fixture_evidence.immutable_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'fixture evidence immutable' USING ERRCODE='55000'; END $$;
      CREATE TRIGGER immutable_receipt BEFORE UPDATE OR DELETE OR TRUNCATE ON g1_b_fixture_evidence.receipts
        FOR EACH STATEMENT EXECUTE FUNCTION g1_b_fixture_evidence.immutable_receipt();`);
  }
  async append(body: InvocationObservation | FinalReceipt): Promise<void> {
    // Validate the closed body before any evidence INSERT; serialize the same stable snapshot.
    const snapshot = measurementSnapshot(body);
    const validated =
      snapshot?.kind === "invocation"
        ? readInvocationObservation(snapshot)
        : readFinalReceipt(snapshot);
    const kind = validated.kind === "invocation" ? "invocation" : "final";
    const id =
      validated.kind === "invocation"
        ? validated.observation_id
        : validated.receipt_id;
    const hash =
      validated.kind === "invocation"
        ? invocationHash(validated)
        : finalHash(validated);
    const bytes = Buffer.from(canonicalJson(validated), "utf8");
    const r = await this.owner.query(
      `INSERT INTO g1_b_fixture_evidence.receipts(evidence_id,provider_call_id,record_kind,canonical_bytes,content_hash)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT(provider_call_id,record_kind) DO NOTHING RETURNING evidence_id`,
      [id, validated.attribution.provider_call_id, kind, bytes, hash],
    );
    if (r.rowCount === 0) {
      const old = await this.owner.query(
        "SELECT evidence_id::text,canonical_bytes,content_hash FROM g1_b_fixture_evidence.receipts WHERE provider_call_id=$1 AND record_kind=$2",
        [validated.attribution.provider_call_id, kind],
      );
      const row = old.rows[0] as
        | { evidence_id: string; canonical_bytes: Buffer; content_hash: string }
        | undefined;
      if (
        row?.evidence_id !== id ||
        !row.canonical_bytes.equals(bytes) ||
        row.content_hash !== hash
      )
        throw new Error("fixture_receipt_conflict");
    }
  }
  async retrieve(callId: string): Promise<ReceiptPacket | undefined> {
    const r = await this.owner.query(
      "SELECT evidence_id::text,provider_call_id::text,record_kind,canonical_bytes,content_hash FROM g1_b_fixture_evidence.receipts WHERE provider_call_id=$1 ORDER BY record_kind",
      [callId],
    );
    const rows = r.rows as {
      evidence_id: string;
      provider_call_id: string;
      record_kind: string;
      canonical_bytes: Buffer;
      content_hash: string;
    }[];
    const i = rows.find((x) => x.record_kind === "invocation"),
      f = rows.find((x) => x.record_kind === "final");
    if (!i || !f) return undefined;
    for (const row of [i, f]) {
      const text = row.canonical_bytes.toString("utf8");
      let body: InvocationObservation | FinalReceipt;
      try {
        if (
          !Buffer.from(text, "utf8").equals(row.canonical_bytes) ||
          row.canonical_bytes.length >
            (row.record_kind === "invocation" ? 16384 : 32768)
        )
          throw new Error("fixture_receipt_corrupt");
        const parsed: unknown = JSON.parse(text);
        body =
          row.record_kind === "invocation"
            ? readInvocationObservation(parsed)
            : readFinalReceipt(parsed);
        if (
          canonicalJson(body) !== text ||
          domainHash(
            row.record_kind === "invocation"
              ? "provider-sim-invocation-observation-v1"
              : "provider-sim-final-receipt-v1",
            body,
          ) !== row.content_hash
        )
          throw new Error("fixture_receipt_corrupt");
      } catch {
        throw new Error("fixture_receipt_corrupt");
      }
      const id =
        body.kind === "invocation" ? body.observation_id : body.receipt_id;
      if (
        row.provider_call_id !== callId ||
        body.attribution.provider_call_id !== callId ||
        id !== row.evidence_id
      )
        throw new Error("fixture_receipt_envelope_mismatch");
    }
    return {
      schema: "g1-sim-receipt-packet/1",
      invocation_json: i.canonical_bytes.toString("utf8"),
      invocation_hash: i.content_hash,
      final_json: f.canonical_bytes.toString("utf8"),
      final_hash: f.content_hash,
    };
  }
}
