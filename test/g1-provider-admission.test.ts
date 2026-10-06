import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  domainHash,
  sha256,
} from "../src/identity/canonical-json.js";
import {
  buildCertificate,
  extractOriginalClaim,
  projectReceipt,
  readInvocation,
  readPolicy,
  requestHash,
  invocationHash,
  finalHash,
  certificateHash,
  policyHash,
  readInvocationObservation,
  readFinalReceipt,
  type FinalReceipt,
  type InvocationObservation,
} from "../src/runtime/provider-admission.js";
import type { AuthoredReservation } from "../src/runtime/provider.js";
import {
  simulationPolicy,
  simulationRequest,
  invocationObservation,
  receiptPacket,
  measuredConsumption,
  SIMULATION_HASH_VECTORS,
} from "./support/g1-provider-admission-receipt.js";
const setup = () => {
  const policy = simulationPolicy(),
    request = simulationRequest();
  const reservation: AuthoredReservation = {
    provider_call_id: randomUUID(),
    attempt_id: randomUUID(),
    provider: policy.provider_rule.provider,
    operation: "g1_sim_text",
    model_identifier: policy.provider_rule.model_identifier,
    request_fingerprint: requestHash(request),
    logical_request_key: "unit:" + randomUUID(),
    operational_try_number: 1,
    intentional_take_index: null,
    retry_of_provider_call_id: null,
    reroll_of_provider_call_id: null,
    reroll_trigger_id: null,
    started_at: "2026-10-06T00:00:00.000001Z",
  };
  const certificate = buildCertificate(
    reservation,
    randomUUID(),
    policy,
    request,
  );
  const io = invocationObservation(certificate, request);
  const fr: FinalReceipt = {
    schema: "g1-sim-final-receipt/1",
    receipt_id: randomUUID(),
    kind: "final_accounting",
    invocation_observation_hash: invocationHash(io),
    attribution: io.attribution,
    consumption: io.consumption,
    work_ended: true,
    observed_output_bytes: 2,
    price_status: "known_final",
    event: {
      provider_call_id: reservation.provider_call_id,
      event_type: "succeeded",
      ended_at: "2026-10-06T00:00:00.000002Z",
      usage: { input_bytes: 2, output_bytes: 2 },
      actual_cost: "0.025",
      currency: "USD",
      response_artifact_id: null,
      response_reference: null,
    },
  };
  return { policy, request, reservation, certificate, io, fr };
};
describe("G1-B closed operational profiles", () => {
  it("measurement retains raw pre-NFC bytes, and invalid/unavailable certificate is null plus incomplete", () => {
    const s = setup(),
      raw = { ...s.request, input_text: "e\u0301" };
    const observed = measuredConsumption(raw, s.certificate);
    expect(observed.observation_state).toBe("complete");
    expect(observed.input_bytes).toBe(3);
    expect(observed.input_text_hash).toBe(
      sha256(Buffer.from("e\u0301", "utf8")),
    );
    expect(observed.input_text_hash).not.toBe(sha256(Buffer.from("é", "utf8")));
    expect(observed.computed_request_fingerprint).toBe(
      requestHash({ ...raw, input_text: "é" }),
    );
    const invalid = measuredConsumption(s.request, {
      ...s.certificate,
      reserved_cost_upper_bound: "0.01",
    });
    expect(invalid.observation_state).toBe("incomplete");
    expect(invalid.consumed_certificate_hash).toBeNull();
    expect(invalid.input_text_hash).toBe(s.certificate.input_text_hash);
    expect(
      measuredConsumption(s.request, undefined).consumed_certificate_hash,
    ).toBeNull();
    let touched = 0;
    const exotic = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          touched++;
          throw new Error("MEASUREMENT_PROTECTED_CANARY");
        },
        ownKeys() {
          throw new Error("MEASUREMENT_PROTECTED_CANARY");
        },
      },
    );
    const result = measuredConsumption(s.request, exotic);
    expect(result.observation_state).toBe("incomplete");
    expect(JSON.stringify(result)).not.toContain("CANARY");
    expect(touched).toBe(0);
  });
  it("closed observation/final parsing refuses schema/kind/types and getter bodies without consuming canary", () => {
    const s = setup();
    expect(readInvocationObservation(s.io)).toEqual(s.io);
    expect(readFinalReceipt(s.fr)).toEqual(s.fr);
    for (const bad of [
      { ...s.io, schema: "g1-sim-final-receipt/1" },
      { ...s.io, kind: "final_accounting" },
      { ...s.io, work_ended: true },
      { ...s.io, extra: "CANARY" },
    ])
      expect(() => readInvocationObservation(bad)).toThrow(
        "provider_sim_receipt_invalid",
      );
    for (const bad of [
      { ...s.fr, kind: "invocation" },
      { ...s.fr, schema: "future" },
      { ...s.fr, event: { ...s.fr.event, actual_cost: "0.0250" } },
    ])
      expect(() => readFinalReceipt(bad)).toThrow(
        "provider_sim_receipt_invalid",
      );
    let reads = 0;
    expect(() =>
      readFinalReceipt({
        ...s.fr,
        get event() {
          reads++;
          throw new Error("BODY_CANARY");
        },
      }),
    ).toThrow("provider_sim_receipt_invalid");
    expect(reads).toBe(0);
  });
  it.each([
    "max_intentional_rerolls_per_base",
    "max_intentional_rerolls_per_attempt",
    "max_intentional_rerolls_per_run",
    "max_intentional_rerolls_per_utc_day",
  ] as const)(
    "R0 %s rejects negative zero with its owned policy-invalid code",
    (key) => {
      const policy = structuredClone(simulationPolicy());
      policy[key] = -0;
      expect(Object.is(policy[key], -0)).toBe(true);
      expect(() => readPolicy(policy)).toThrow(
        "provider_admission_policy_invalid",
      );
      policy[key] = 0;
      expect(canonicalJson(readPolicy(policy))).toBe(
        SIMULATION_HASH_VECTORS[0].json,
      );
    },
  );
  it("literal independent canonical bytes/domain/hash/bound vectors for every owned hash subject", () => {
    for (const vector of SIMULATION_HASH_VECTORS) {
      const body: unknown = JSON.parse(vector.json);
      expect(canonicalJson(body)).toBe(vector.json);
      expect(Buffer.byteLength(vector.json, "utf8")).toBe(vector.utf8_bytes);
      expect(domainHash(vector.domain, body)).toBe(vector.sha256);
    }
    const id = (n: number) =>
      "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
    const policy = simulationPolicy(),
      request = simulationRequest();
    expect(policyHash(policy)).toBe(SIMULATION_HASH_VECTORS[0].sha256);
    expect(requestHash(request)).toBe(SIMULATION_HASH_VECTORS[1].sha256);
    const reservation: AuthoredReservation = {
      provider_call_id: id(1),
      attempt_id: id(2),
      provider: "g1-simulator",
      operation: "g1_sim_text",
      model_identifier: "bytes-v1",
      request_fingerprint: SIMULATION_HASH_VECTORS[1].sha256,
      logical_request_key: "vector:1",
      operational_try_number: 1,
      intentional_take_index: null,
      retry_of_provider_call_id: null,
      reroll_of_provider_call_id: null,
      reroll_trigger_id: null,
      started_at: "2026-10-06T00:00:00.000001Z",
    };
    const certificate = buildCertificate(reservation, id(3), policy, request);
    expect(canonicalJson(certificate)).toBe(SIMULATION_HASH_VECTORS[2].json);
    expect(certificateHash(certificate)).toBe(
      SIMULATION_HASH_VECTORS[2].sha256,
    );
    expect(certificate.unrounded_bound).toBe("0.028");
    expect(certificate.reserved_cost_upper_bound).toBe("0.03");
    const io: InvocationObservation = {
      ...invocationObservation(certificate, request),
      observation_id: id(4),
    };
    expect(canonicalJson(io)).toBe(SIMULATION_HASH_VECTORS[3].json);
    expect(invocationHash(io)).toBe(SIMULATION_HASH_VECTORS[3].sha256);
    const fr = JSON.parse(SIMULATION_HASH_VECTORS[4].json) as FinalReceipt;
    expect(finalHash(fr)).toBe(SIMULATION_HASH_VECTORS[4].sha256);
    const projected = projectReceipt(receiptPacket(io, fr), certificate);
    expect(projected.outcome).toEqual(fr.event);
    expect(projected.settlement.work_ended).toBe(true);
  });
  it("exact measured request, quantum ceiling and immutable normalized policy (no numeric float)", () => {
    const s = setup();
    expect(s.certificate.unrounded_bound).toBe("0.028");
    expect(s.certificate.reserved_cost_upper_bound).toBe("0.03");
    expect(Object.isFrozen(s.certificate.policy.provider_rule.tariff)).toBe(
      true,
    );
    const p = structuredClone(s.policy);
    p.attempt_cost_ceiling = "0.060000";
    expect(canonicalJson(readPolicy(p))).toBe(canonicalJson(s.policy));
    p.max_intentional_rerolls_per_run = 1 as 0;
    expect(() => readPolicy(p)).toThrow("provider_admission_reroll_disabled");
  });
  it("extracts own HASH without enumerating unrelated policy getters; NEW parser still refuses them", () => {
    let touches = 0;
    const hash = "a".repeat(64);
    const sub = {
      schema: "g1-sim-invocation/1",
      expected_original_certificate_hash: hash,
      get policy() {
        touches++;
        throw new Error("PROTECTED_POLICY_CANARY");
      },
    };
    expect(extractOriginalClaim({ simulation_admission: sub })).toEqual({
      kind: "hash",
      hash,
    });
    expect(touches).toBe(0);
    expect(() => readInvocation(sub)).toThrow(
      "provider_admission_policy_invalid",
    );
    expect(touches).toBe(0);
  });
  it("claim accessors, malformed explicit hashes and exotic descriptor traps fail closed without reading canary values", () => {
    let touches = 0;
    expect(
      extractOriginalClaim({
        simulation_admission: {
          get expected_original_certificate_hash() {
            touches++;
            throw new Error("CLAIM_CANARY");
          },
        },
      }),
    ).toEqual({ kind: "invalid" });
    expect(
      extractOriginalClaim({
        simulation_admission: { expected_original_certificate_hash: "wrong" },
      }),
    ).toEqual({ kind: "invalid" });
    expect(
      extractOriginalClaim(
        new Proxy(
          {},
          {
            getOwnPropertyDescriptor() {
              throw new Error("TRAP_CANARY");
            },
          },
        ),
      ),
    ).toEqual({ kind: "invalid" });
    expect(touches).toBe(0);
    expect(extractOriginalClaim(undefined)).toEqual({ kind: "absent" });
  });
  it("same original-attributed consumption violation stays recordable; unrelated attribution does not", () => {
    const s = setup();
    const wrong = {
      ...s.io,
      consumption: {
        ...s.io.consumption,
        input_text_hash: "b".repeat(64),
        input_bytes: 1,
      },
    };
    const fr = {
      ...s.fr,
      invocation_observation_hash: invocationHash(wrong),
      consumption: wrong.consumption,
      event: {
        ...s.fr.event,
        usage: { input_bytes: 1, output_bytes: 2 },
        actual_cost: "0.031",
        currency: "EUR",
      },
    };
    const projected = projectReceipt(receiptPacket(wrong, fr), s.certificate);
    expect(projected.outcome.actual_cost).toBe("0.031");
    expect(projected.outcome.currency).toBe("EUR");
    expect(projected.settlement.consumption?.input_bytes).toBe(1);
    const unrelated = {
      ...wrong,
      attribution: { ...wrong.attribution, provider_call_id: randomUUID() },
    };
    const uf = {
      ...fr,
      attribution: unrelated.attribution,
      invocation_observation_hash: invocationHash(unrelated),
      event: {
        ...fr.event,
        provider_call_id: unrelated.attribution.provider_call_id,
      },
    };
    expect(() =>
      projectReceipt(receiptPacket(unrelated, uf), s.certificate),
    ).toThrow("provider_sim_receipt_unattributed");
  });
  it("shorter output and unknown-final price with true work end are independent valid facts", () => {
    const s = setup();
    const fr = {
      ...s.fr,
      price_status: "unknown_final" as const,
      event: { ...s.fr.event, actual_cost: null, currency: null },
    };
    const result = projectReceipt(receiptPacket(s.io, fr), s.certificate);
    expect(result.settlement.work_ended).toBe(true);
    expect(result.settlement.observed_output_bytes).toBe(2);
    expect(result.outcome.actual_cost).toBeNull();
    expect(result.outcome.currency).toBeNull();
  });
  it("tampering, contradictory observations and hash-valid cross-event binding refuse without inspecting a Packet getter", () => {
    const s = setup(),
      packet = receiptPacket(s.io, s.fr);
    expect(() =>
      projectReceipt(
        { ...packet, final_json: packet.final_json + " " },
        s.certificate,
      ),
    ).toThrow("provider_sim_receipt_invalid");
    const fr = {
      ...s.fr,
      consumption: { ...s.fr.consumption, consumed_output_cap: 1 },
    };
    expect(() =>
      projectReceipt(
        { ...packet, final_json: canonicalJson(fr), final_hash: finalHash(fr) },
        s.certificate,
      ),
    ).toThrow("provider_sim_receipt_invalid");
    const cross = {
      ...s.fr,
      event: { ...s.fr.event, provider_call_id: randomUUID() },
    };
    expect(() =>
      projectReceipt(receiptPacket(s.io, cross), s.certificate),
    ).toThrow("provider_sim_receipt_binding_invalid");
    let reads = 0;
    const evil = {
      ...packet,
      get final_json() {
        reads++;
        throw new Error("RECEIPT_CANARY");
      },
    };
    expect(() => projectReceipt(evil, s.certificate)).toThrow(
      "provider_sim_receipt_invalid",
    );
    expect(reads).toBe(0);
  });
});
