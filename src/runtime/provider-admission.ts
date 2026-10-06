// Dependent G1-B D/L0/R0 operational profiles. Trusted test-owned NON-NETWORK only.
// Shared canonical serialization is reused unchanged. No execution, clock, I/O or callback occurs in projection.
import {
  canonicalJson,
  canonicalTimestamp,
  domainHash,
  normalizeString,
  sha256,
} from "../identity/canonical-json.js";
import type { AuthoredOutcome, AuthoredReservation } from "./provider.js";

export const ADMISSION_CODES = [
  "provider_admission_original_claim_invalid",
  "provider_admission_original_missing",
  "provider_admission_certificate_conflict",
  "provider_sim_receipt_invalid",
  "provider_sim_receipt_unattributed",
  "provider_sim_receipt_binding_invalid",
  "provider_admission_retry_work_not_ended",
  "provider_admission_policy_invalid",
  "provider_admission_certificate_invalid",
  "provider_admission_policy_conflict",
  "provider_admission_legacy_unaccounted",
  "provider_admission_breach",
  "provider_admission_clock_reversed",
  "provider_admission_attempt_cost",
  "provider_admission_run_cost",
  "provider_admission_day_cost",
  "provider_admission_reservation_limit",
  "provider_admission_retry_limit",
  "provider_admission_reroll_disabled",
  "provider_admission_concurrency_limit",
  "provider_admission_rate_limit",
  "provider_admission_spacing_limit",
  "provider_admission_request_mismatch",
  "provider_admission_local_timeout",
] as const;
export type AdmissionCode = (typeof ADMISSION_CODES)[number];
export class AdmissionError extends Error {
  constructor(readonly code: AdmissionCode) {
    super(code);
    this.name = "AdmissionError";
  }
}
type Obj = Record<string, unknown>;
type Code = AdmissionCode;
const fail = (code: Code): never => {
  throw new AdmissionError(code);
};
const H = /^[0-9a-f]{64}$/;
const U = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const A = /^[a-z0-9][a-z0-9._:/-]{0,127}$/;
const K = /^[a-z0-9][a-z0-9._:/-]{0,255}$/;
const M = /^(0|[1-9][0-9]{0,17})(\.[0-9]{1,6})?$/;
const D = /^(0|[1-9][0-9]*)(\.[0-9]+)?$/;
const C = /^[A-Z]{3}$/;
const NMAX = 2147483647;
const RE = [
  "intentional_take_index",
  "reroll_of_provider_call_id",
  "reroll_trigger_id",
] as const;
function object(value: unknown, code: Code): Obj {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      return fail(code);
    const proto: unknown = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return fail(code);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const out: Obj = {};
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== "string") return fail(code);
      const d = descriptors[key];
      if (!d || !("value" in d)) return fail(code);
      Object.defineProperty(out, key, { value: d.value, enumerable: true });
    }
    return out;
  } catch {
    return fail(code);
  }
}
function closed(value: unknown, keys: readonly string[], code: Code): Obj {
  const out = object(value, code);
  if (
    Object.keys(out).length !== keys.length ||
    keys.some((k) => !Object.hasOwn(out, k))
  )
    return fail(code);
  return out;
}
function string(value: unknown, re: RegExp, code: Code): string {
  if (typeof value !== "string" || !re.test(value)) return fail(code);
  return value;
}
function integer(value: unknown, min: number, code: Code, max = NMAX): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    Object.is(value, -0) ||
    value < min ||
    value > max
  )
    return fail(code);
  return value;
}
function literal(value: unknown, wanted: string, code: Code): void {
  if (value !== wanted) fail(code);
}
export function decimal(value: unknown, code: Code, actual = false): string {
  if (
    typeof value !== "string" ||
    !(actual ? D : M).test(value) ||
    (actual && value.length > 64)
  )
    return fail(code);
  return value.includes(".")
    ? value.replace(/0+$/, "").replace(/\.$/, "")
    : value;
}
function moneyUnits(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole ?? "0") * 1000000n + BigInt(fraction.padEnd(6, "0"));
}
function moneyText(value: bigint): string {
  return decimal(
    `${(value / 1000000n).toString()}.${(value % 1000000n).toString().padStart(6, "0")}`,
    "provider_admission_certificate_invalid",
  );
}
function freeze<T extends object>(value: T): T {
  for (const item of Object.values(value))
    if (item !== null && typeof item === "object") freeze(item);
  return Object.freeze(value);
}
export interface Rate {
  max_admissions: number;
  window_ms: number;
  min_spacing_ms: number;
}
export interface Tariff {
  schema: "g1-sim-byte-tariff/1";
  tariff_version: string;
  tariff_source_hash: string;
  input_unit: "nfc_utf8_byte";
  output_unit: "utf8_byte";
  fixed_fee: string;
  input_price_per_byte: string;
  output_price_per_byte: string;
  max_input_bytes: number;
  max_output_bytes: number;
}
export interface Policy {
  schema: "g1-sim-admission-policy/1";
  mode: "trusted_non_network_simulation";
  policy_version: string;
  scope: "single_database_installation";
  currency: string;
  accounting_quantum: string;
  attempt_cost_ceiling: string;
  run_cost_ceiling: string;
  utc_day_cost_ceiling: string;
  max_reservations_per_attempt: number;
  max_reservations_per_run: number;
  max_reservations_per_utc_day: number;
  max_operational_retries_per_chain: number;
  max_operational_retries_per_attempt: number;
  max_operational_retries_per_run: number;
  max_operational_retries_per_utc_day: number;
  max_intentional_rerolls_per_base: 0;
  max_intentional_rerolls_per_attempt: 0;
  max_intentional_rerolls_per_run: 0;
  max_intentional_rerolls_per_utc_day: 0;
  max_concurrent_global: number;
  global_rate: Rate;
  provider_rule: {
    provider: string;
    operation: "g1_sim_text";
    model_identifier: string;
    max_concurrent: number;
    rate: Rate;
    tariff: Tariff;
  };
}
const POLICY_KEYS = [
  "schema",
  "mode",
  "policy_version",
  "scope",
  "currency",
  "accounting_quantum",
  "attempt_cost_ceiling",
  "run_cost_ceiling",
  "utc_day_cost_ceiling",
  "max_reservations_per_attempt",
  "max_reservations_per_run",
  "max_reservations_per_utc_day",
  "max_operational_retries_per_chain",
  "max_operational_retries_per_attempt",
  "max_operational_retries_per_run",
  "max_operational_retries_per_utc_day",
  "max_intentional_rerolls_per_base",
  "max_intentional_rerolls_per_attempt",
  "max_intentional_rerolls_per_run",
  "max_intentional_rerolls_per_utc_day",
  "max_concurrent_global",
  "global_rate",
  "provider_rule",
] as const;
function rate(value: unknown, code: Code): Rate {
  const x = closed(
    value,
    ["max_admissions", "window_ms", "min_spacing_ms"],
    code,
  );
  return {
    max_admissions: integer(x.max_admissions, 1, code),
    window_ms: integer(x.window_ms, 1, code),
    min_spacing_ms: integer(x.min_spacing_ms, 0, code),
  };
}
export function readPolicy(value: unknown): Policy {
  const code: Code = "provider_admission_policy_invalid";
  const p = closed(value, POLICY_KEYS, code);
  literal(p.schema, "g1-sim-admission-policy/1", code);
  literal(p.mode, "trusted_non_network_simulation", code);
  literal(p.scope, "single_database_installation", code);
  string(p.policy_version, A, code);
  string(p.currency, C, code);
  if (
    !["1", "0.1", "0.01", "0.001", "0.0001", "0.00001", "0.000001"].includes(
      string(p.accounting_quantum, /^[0-9.]+$/, code),
    )
  )
    fail(code);
  const q = moneyUnits(p.accounting_quantum as string);
  const out: Obj = { ...p };
  for (const key of [
    "attempt_cost_ceiling",
    "run_cost_ceiling",
    "utc_day_cost_ceiling",
  ]) {
    const v = decimal(p[key], code);
    if (moneyUnits(v) === 0n || moneyUnits(v) % q !== 0n) fail(code);
    out[key] = v;
  }
  for (const key of POLICY_KEYS.filter((k) => k.startsWith("max_"))) {
    if (key.startsWith("max_intentional_")) {
      if (Object.is(p[key], -0)) fail(code);
      if (p[key] !== 0) fail("provider_admission_reroll_disabled");
    } else
      integer(
        p[key],
        key.startsWith("max_operational_") ? 0 : 1,
        code,
        key === "max_operational_retries_per_chain" ? 2147483646 : NMAX,
      );
  }
  out.global_rate = rate(p.global_rate, code);
  const r = closed(
    p.provider_rule,
    [
      "provider",
      "operation",
      "model_identifier",
      "max_concurrent",
      "rate",
      "tariff",
    ],
    code,
  );
  string(r.provider, A, code);
  string(r.model_identifier, A, code);
  literal(r.operation, "g1_sim_text", code);
  integer(r.max_concurrent, 1, code);
  const t = closed(
    r.tariff,
    [
      "schema",
      "tariff_version",
      "tariff_source_hash",
      "input_unit",
      "output_unit",
      "fixed_fee",
      "input_price_per_byte",
      "output_price_per_byte",
      "max_input_bytes",
      "max_output_bytes",
    ],
    code,
  );
  literal(t.schema, "g1-sim-byte-tariff/1", code);
  literal(t.input_unit, "nfc_utf8_byte", code);
  literal(t.output_unit, "utf8_byte", code);
  string(t.tariff_version, A, code);
  string(t.tariff_source_hash, H, code);
  const tariff = {
    ...t,
    fixed_fee: decimal(t.fixed_fee, code),
    input_price_per_byte: decimal(t.input_price_per_byte, code),
    output_price_per_byte: decimal(t.output_price_per_byte, code),
    max_input_bytes: integer(t.max_input_bytes, 1, code, 1048576),
    max_output_bytes: integer(t.max_output_bytes, 0, code, 1048576),
  };
  out.provider_rule = { ...r, rate: rate(r.rate, code), tariff };
  return freeze(out as unknown as Policy);
}
export interface AdmissionRequest {
  schema: "g1-sim-request/1";
  input_text: string;
  max_output_bytes: number;
}
export function readRequest(value: unknown, policy: Policy): AdmissionRequest {
  const code: Code = "provider_admission_request_mismatch";
  const r = closed(value, ["schema", "input_text", "max_output_bytes"], code);
  literal(r.schema, "g1-sim-request/1", code);
  if (typeof r.input_text !== "string") return fail(code);
  let text: string;
  try {
    text = normalizeString(r.input_text);
  } catch {
    return fail(code);
  }
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes === 0 || bytes > policy.provider_rule.tariff.max_input_bytes)
    fail(code);
  return freeze({
    schema: "g1-sim-request/1",
    input_text: text,
    max_output_bytes: integer(
      r.max_output_bytes,
      0,
      code,
      policy.provider_rule.tariff.max_output_bytes,
    ),
  });
}
export const policyHash = (p: Policy): string =>
  domainHash("provider-admission-policy-v1", p);
export const requestHash = (r: AdmissionRequest): string =>
  domainHash("provider-admission-request-v1", r);
export interface Certificate extends Omit<AuthoredReservation, "started_at"> {
  schema: "g1-sim-admission-certificate/1";
  mode: "trusted_non_network_simulation";
  policy: Policy;
  policy_hash: string;
  program_run_id: string;
  input_text_hash: string;
  input_bytes: number;
  max_output_bytes: number;
  currency: string;
  accounting_quantum: string;
  unrounded_bound: string;
  reserved_cost_upper_bound: string;
}
export const certificateHash = (c: Certificate): string =>
  domainHash("provider-admission-certificate-v1", c);
/** Original persisted certification, independent of replacement invocation policy or request. */
export function readCertificate(
  value: unknown,
  reservation: AuthoredReservation,
  run: string,
): Certificate {
  const code: Code = "provider_admission_certificate_invalid";
  const c = closed(
    value,
    [
      "schema",
      "mode",
      "policy",
      "policy_hash",
      "provider_call_id",
      "attempt_id",
      "program_run_id",
      "provider",
      "operation",
      "model_identifier",
      "request_fingerprint",
      "logical_request_key",
      "operational_try_number",
      "intentional_take_index",
      "retry_of_provider_call_id",
      "reroll_of_provider_call_id",
      "reroll_trigger_id",
      "input_text_hash",
      "input_bytes",
      "max_output_bytes",
      "currency",
      "accounting_quantum",
      "unrounded_bound",
      "reserved_cost_upper_bound",
    ],
    code,
  );
  literal(c.schema, "g1-sim-admission-certificate/1", code);
  literal(c.mode, "trusted_non_network_simulation", code);
  const p = readPolicy(c.policy);
  if (
    canonicalJson(p) !== canonicalJson(c.policy) ||
    policyHash(p) !== c.policy_hash
  )
    fail(code);
  string(c.program_run_id, U, code);
  if (c.program_run_id !== run) fail(code);
  for (const k of [
    "provider_call_id",
    "attempt_id",
    "provider",
    "operation",
    "model_identifier",
    "request_fingerprint",
    "logical_request_key",
    "operational_try_number",
    "intentional_take_index",
    "retry_of_provider_call_id",
    "reroll_of_provider_call_id",
    "reroll_trigger_id",
  ] as const)
    if (c[k] !== reservation[k]) fail(code);
  for (const k of ["provider_call_id", "attempt_id"]) string(c[k], U, code);
  if (c.retry_of_provider_call_id !== null)
    string(c.retry_of_provider_call_id, U, code);
  string(c.logical_request_key, K, code);
  string(c.request_fingerprint, H, code);
  string(c.input_text_hash, H, code);
  integer(c.operational_try_number, 1, code);
  if (
    RE.some((k) => c[k] !== null) ||
    c.provider !== p.provider_rule.provider ||
    c.operation !== "g1_sim_text" ||
    c.model_identifier !== p.provider_rule.model_identifier ||
    c.currency !== p.currency ||
    c.accounting_quantum !== p.accounting_quantum
  )
    fail(code);
  const n = integer(
    c.input_bytes,
    1,
    code,
    p.provider_rule.tariff.max_input_bytes,
  );
  const cap = integer(
      c.max_output_bytes,
      0,
      code,
      p.provider_rule.tariff.max_output_bytes,
    ),
    t = p.provider_rule.tariff,
    q = moneyUnits(p.accounting_quantum);
  const raw =
    moneyUnits(t.fixed_fee) +
    BigInt(n) * moneyUnits(t.input_price_per_byte) +
    BigInt(cap) * moneyUnits(t.output_price_per_byte);
  if (
    c.unrounded_bound !== moneyText(raw) ||
    c.reserved_cost_upper_bound !== moneyText(((raw + q - 1n) / q) * q)
  )
    fail(code);
  return freeze({ ...c, policy: p } as unknown as Certificate);
}
export function buildCertificate(
  reservation: AuthoredReservation,
  run: string,
  policy: Policy,
  request: AdmissionRequest,
): Certificate {
  const code: Code = "provider_admission_certificate_invalid";
  if (RE.some((key) => reservation[key] !== null))
    fail("provider_admission_reroll_disabled");
  string(run, U, code);
  string(reservation.provider_call_id, U, code);
  string(reservation.attempt_id, U, code);
  string(reservation.logical_request_key, K, code);
  if (
    reservation.provider !== policy.provider_rule.provider ||
    reservation.operation !== "g1_sim_text" ||
    reservation.model_identifier !== policy.provider_rule.model_identifier ||
    reservation.request_fingerprint !== requestHash(request)
  )
    fail("provider_admission_request_mismatch");
  integer(reservation.operational_try_number, 1, code);
  if (reservation.retry_of_provider_call_id !== null)
    string(reservation.retry_of_provider_call_id, U, code);
  const n = Buffer.byteLength(request.input_text, "utf8"),
    t = policy.provider_rule.tariff,
    q = moneyUnits(policy.accounting_quantum);
  const raw =
    moneyUnits(t.fixed_fee) +
    BigInt(n) * moneyUnits(t.input_price_per_byte) +
    BigInt(request.max_output_bytes) * moneyUnits(t.output_price_per_byte);
  const bound = ((raw + q - 1n) / q) * q;
  const { started_at: ignored, ...identity } = reservation;
  // The authored started_at is deliberately excluded from the certificate.
  void (() => ignored)();
  return freeze({
    ...identity,
    schema: "g1-sim-admission-certificate/1",
    mode: "trusted_non_network_simulation",
    policy,
    policy_hash: policyHash(policy),
    program_run_id: run,
    input_text_hash: sha256(Buffer.from(request.input_text, "utf8")),
    input_bytes: n,
    max_output_bytes: request.max_output_bytes,
    currency: policy.currency,
    accounting_quantum: policy.accounting_quantum,
    unrounded_bound: moneyText(raw),
    reserved_cost_upper_bound: moneyText(bound),
  });
}
export interface Invocation {
  schema: "g1-sim-invocation/1";
  policy: Policy;
  request: AdmissionRequest;
  lock_timeout_ms: number;
  statement_timeout_ms: number;
  expected_original_certificate_hash: string | null;
}
export type OriginalClaim =
  | { kind: "absent" }
  | { kind: "hash"; hash: string }
  | { kind: "invalid" };
export function extractOriginalClaim(controls: unknown): OriginalClaim {
  const code: Code = "provider_admission_original_claim_invalid";
  if (controls === undefined) return { kind: "absent" };
  try {
    // Inspect descriptors ONLY on the claim subtree. Policy accessors are not touched for recovery.
    const own = (
      value: unknown,
      key: string,
    ): PropertyDescriptor | undefined => {
      if (value === null || typeof value !== "object" || Array.isArray(value))
        return fail(code);
      const proto: unknown = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) return fail(code);
      return Object.getOwnPropertyDescriptor(value, key);
    };
    const entry = own(controls, "simulation_admission");
    if (entry === undefined) return { kind: "absent" };
    if (!("value" in entry)) return { kind: "invalid" };
    const claim = own(entry.value, "expected_original_certificate_hash");
    if (!claim || !("value" in claim)) return { kind: "invalid" };
    const h: unknown = claim.value;
    if (h === null) return { kind: "absent" };
    return { kind: "hash", hash: string(h, H, code) };
  } catch {
    return { kind: "invalid" };
  }
}
export function readInvocation(value: unknown): Invocation {
  const code: Code = "provider_admission_policy_invalid";
  const x = closed(
    value,
    [
      "schema",
      "policy",
      "request",
      "lock_timeout_ms",
      "statement_timeout_ms",
      "expected_original_certificate_hash",
    ],
    code,
  );
  literal(x.schema, "g1-sim-invocation/1", code);
  const p = readPolicy(x.policy),
    l = integer(x.lock_timeout_ms, 1, code, 30000),
    s = integer(x.statement_timeout_ms, 1, code, 30000);
  if (l > s) fail(code);
  if (x.expected_original_certificate_hash !== null)
    string(x.expected_original_certificate_hash, H, code);
  return freeze({
    schema: "g1-sim-invocation/1",
    policy: p,
    request: readRequest(x.request, p),
    lock_timeout_ms: l,
    statement_timeout_ms: s,
    expected_original_certificate_hash: x.expected_original_certificate_hash as
      | string
      | null,
  });
}
/** Non-refusing transport preselection only. Never parses policy/request or authorizes NEW work. */
export function admissionBounds(
  value: unknown,
): { lock: number; statement: number } | undefined {
  try {
    if (value === null || typeof value !== "object") return undefined;
    const l = Object.getOwnPropertyDescriptor(value, "lock_timeout_ms"),
      s = Object.getOwnPropertyDescriptor(value, "statement_timeout_ms");
    if (!l || !s || !("value" in l) || !("value" in s)) return undefined;
    const lock = integer(
        l.value,
        1,
        "provider_admission_policy_invalid",
        30000,
      ),
      statement = integer(
        s.value,
        1,
        "provider_admission_policy_invalid",
        30000,
      );
    return lock <= statement ? { lock, statement } : undefined;
  } catch {
    return undefined;
  }
}
export interface Attribution {
  provider_call_id: string;
  attempt_id: string;
  program_run_id: string;
  provider: string;
  operation: "g1_sim_text";
  model_identifier: string;
  logical_request_key: string;
  request_fingerprint: string;
  admission_certificate_hash: string;
  admission_policy_hash: string;
}
export function attribution(c: Certificate): Attribution {
  return freeze({
    provider_call_id: c.provider_call_id,
    attempt_id: c.attempt_id,
    program_run_id: c.program_run_id,
    provider: c.provider,
    operation: "g1_sim_text",
    model_identifier: c.model_identifier,
    logical_request_key: c.logical_request_key,
    request_fingerprint: c.request_fingerprint,
    admission_certificate_hash: certificateHash(c),
    admission_policy_hash: c.policy_hash,
  });
}
export interface Consumption {
  observation_state: "complete" | "incomplete";
  input_text_hash: string | null;
  input_bytes: number | null;
  consumed_output_cap: number | null;
  computed_request_fingerprint: string | null;
  consumed_certificate_hash: string | null;
  consumed_provider: string | null;
  consumed_operation: string | null;
  consumed_model_identifier: string | null;
}
export interface InvocationObservation {
  schema: "g1-sim-invocation-observation/1";
  observation_id: string;
  kind: "invocation";
  attribution: Attribution;
  consumption: Consumption;
  work_ended: null;
}
export interface SimulationEvent extends AuthoredOutcome {
  usage: { input_bytes: number | null; output_bytes: number | null };
}
export interface FinalReceipt {
  schema: "g1-sim-final-receipt/1";
  receipt_id: string;
  kind: "final_accounting";
  invocation_observation_hash: string;
  attribution: Attribution;
  consumption: Consumption;
  work_ended: boolean | null;
  observed_output_bytes: number | null;
  price_status: "known_final" | "unknown_final";
  event: SimulationEvent;
}
export interface ReceiptPacket {
  schema: "g1-sim-receipt-packet/1";
  invocation_json: string;
  invocation_hash: string;
  final_json: string;
  final_hash: string;
}
export const invocationHash = (i: InvocationObservation): string =>
  domainHash("provider-sim-invocation-observation-v1", i);
export const finalHash = (f: FinalReceipt): string =>
  domainHash("provider-sim-final-receipt-v1", f);
export const VIOLATIONS = [
  "metadata_unverified",
  "input_hash_unobserved",
  "input_hash_mismatch",
  "input_count_unobserved",
  "input_count_mismatch",
  "output_cap_unobserved",
  "output_cap_mismatch",
  "request_fingerprint_unobserved",
  "request_fingerprint_mismatch",
  "certificate_unobserved",
  "certificate_mismatch",
  "provider_unobserved",
  "provider_mismatch",
  "operation_unobserved",
  "operation_mismatch",
  "model_unobserved",
  "model_mismatch",
  "output_count_unknown_at_end",
  "output_over_cap",
  "foreign_currency",
  "actual_above_bound",
] as const;
export type Violation = (typeof VIOLATIONS)[number];
export interface Settlement {
  schema: "g1-sim-settlement/1";
  verification_status: "attributed_receipt" | "unverified_assertion";
  metadata_problem:
    | "none"
    | "absent"
    | "malformed"
    | "attribution_mismatch"
    | "event_mismatch";
  invocation_observation_hash: string | null;
  final_receipt_hash: string | null;
  attribution: Attribution | null;
  consumption: Consumption | null;
  work_ended: boolean | null;
  observed_output_bytes: number | null;
  price_status:
    | "known_final"
    | "unknown_final"
    | "asserted_known"
    | "asserted_unknown";
  event_binding: SimulationEvent | null;
  violations: Violation[];
}
function readAt(value: unknown): Attribution {
  const code: Code = "provider_sim_receipt_invalid";
  const x = closed(
    value,
    [
      "provider_call_id",
      "attempt_id",
      "program_run_id",
      "provider",
      "operation",
      "model_identifier",
      "logical_request_key",
      "request_fingerprint",
      "admission_certificate_hash",
      "admission_policy_hash",
    ],
    code,
  );
  for (const k of ["provider_call_id", "attempt_id", "program_run_id"])
    string(x[k], U, code);
  for (const k of [
    "request_fingerprint",
    "admission_certificate_hash",
    "admission_policy_hash",
  ])
    string(x[k], H, code);
  for (const k of ["provider", "model_identifier"]) string(x[k], A, code);
  string(x.logical_request_key, K, code);
  literal(x.operation, "g1_sim_text", code);
  return x as unknown as Attribution;
}
function readCt(value: unknown): Consumption {
  const code: Code = "provider_sim_receipt_invalid";
  const x = closed(
    value,
    [
      "observation_state",
      "input_text_hash",
      "input_bytes",
      "consumed_output_cap",
      "computed_request_fingerprint",
      "consumed_certificate_hash",
      "consumed_provider",
      "consumed_operation",
      "consumed_model_identifier",
    ],
    code,
  );
  let missing = false;
  for (const k of [
    "input_text_hash",
    "computed_request_fingerprint",
    "consumed_certificate_hash",
  ]) {
    if (x[k] === null) missing = true;
    else string(x[k], H, code);
  }
  for (const k of ["input_bytes", "consumed_output_cap"]) {
    if (x[k] === null) missing = true;
    else integer(x[k], 0, code);
  }
  for (const k of [
    "consumed_provider",
    "consumed_operation",
    "consumed_model_identifier",
  ]) {
    if (x[k] === null) missing = true;
    else string(x[k], A, code);
  }
  if (x.observation_state !== (missing ? "incomplete" : "complete")) fail(code);
  return x as unknown as Consumption;
}
function readEvent(value: unknown): SimulationEvent {
  const code: Code = "provider_sim_receipt_invalid";
  const x = closed(
    value,
    [
      "provider_call_id",
      "event_type",
      "ended_at",
      "usage",
      "actual_cost",
      "currency",
      "response_artifact_id",
      "response_reference",
    ],
    code,
  );
  string(x.provider_call_id, U, code);
  if (
    !["succeeded", "retryable_failure", "terminal_failure"].includes(
      typeof x.event_type === "string" ? x.event_type : "",
    )
  )
    fail(code);
  if (
    typeof x.ended_at !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(x.ended_at)
  )
    fail(code);
  try {
    canonicalTimestamp(x.ended_at as string);
  } catch {
    return fail(code);
  }
  const usage = closed(x.usage, ["input_bytes", "output_bytes"], code);
  for (const k of ["input_bytes", "output_bytes"])
    if (usage[k] !== null) integer(usage[k], 0, code);
  if ((x.actual_cost === null) !== (x.currency === null)) fail(code);
  if (x.actual_cost !== null) {
    const n = decimal(x.actual_cost, code, true);
    if (n !== x.actual_cost) fail(code);
    string(x.currency, C, code);
  }
  if (x.response_artifact_id !== null) string(x.response_artifact_id, U, code);
  if (x.response_reference !== null) {
    if (
      typeof x.response_reference !== "string" ||
      Buffer.byteLength(x.response_reference, "utf8") > 4096
    )
      fail(code);
    try {
      if (
        normalizeString(x.response_reference as string) !== x.response_reference
      )
        fail(code);
    } catch {
      return fail(code);
    }
  }
  return { ...x, usage } as unknown as SimulationEvent;
}
function parsedBytes(value: unknown, max: number): unknown {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > max)
    fail("provider_sim_receipt_invalid");
  try {
    const parsed: unknown = JSON.parse(value as string);
    if (canonicalJson(parsed) !== value) fail("provider_sim_receipt_invalid");
    return parsed;
  } catch {
    return fail("provider_sim_receipt_invalid");
  }
}
export function readInvocationObservation(
  value: unknown,
): InvocationObservation {
  const code: Code = "provider_sim_receipt_invalid";
  const io = closed(
    value,
    [
      "schema",
      "observation_id",
      "kind",
      "attribution",
      "consumption",
      "work_ended",
    ],
    code,
  );
  literal(io.schema, "g1-sim-invocation-observation/1", code);
  literal(io.kind, "invocation", code);
  string(io.observation_id, U, code);
  if (io.work_ended !== null) fail(code);
  return freeze({
    ...io,
    attribution: readAt(io.attribution),
    consumption: readCt(io.consumption),
  } as unknown as InvocationObservation);
}
export function readFinalReceipt(value: unknown): FinalReceipt {
  const code: Code = "provider_sim_receipt_invalid";
  const fr = closed(
    value,
    [
      "schema",
      "receipt_id",
      "kind",
      "invocation_observation_hash",
      "attribution",
      "consumption",
      "work_ended",
      "observed_output_bytes",
      "price_status",
      "event",
    ],
    code,
  );
  literal(fr.schema, "g1-sim-final-receipt/1", code);
  literal(fr.kind, "final_accounting", code);
  string(fr.receipt_id, U, code);
  string(fr.invocation_observation_hash, H, code);
  if (fr.work_ended !== null && typeof fr.work_ended !== "boolean") fail(code);
  if (fr.observed_output_bytes !== null)
    integer(fr.observed_output_bytes, 0, code);
  if (fr.price_status !== "known_final" && fr.price_status !== "unknown_final")
    fail(code);
  return freeze({
    ...fr,
    attribution: readAt(fr.attribution),
    consumption: readCt(fr.consumption),
    event: readEvent(fr.event),
  } as unknown as FinalReceipt);
}
export function projectReceipt(
  value: unknown,
  original: Certificate,
): { outcome: SimulationEvent; settlement: Settlement } {
  const code: Code = "provider_sim_receipt_invalid";
  const packet = closed(
    value,
    [
      "schema",
      "invocation_json",
      "invocation_hash",
      "final_json",
      "final_hash",
    ],
    code,
  );
  literal(packet.schema, "g1-sim-receipt-packet/1", code);
  string(packet.invocation_hash, H, code);
  string(packet.final_hash, H, code);
  const invocation = readInvocationObservation(
    parsedBytes(packet.invocation_json, 16384),
  );
  if (invocationHash(invocation) !== packet.invocation_hash) fail(code);
  const final = readFinalReceipt(parsedBytes(packet.final_json, 32768));
  if (final.invocation_observation_hash !== packet.invocation_hash) fail(code);
  const ia = invocation.attribution,
    ic = invocation.consumption,
    fa = final.attribution,
    fc = final.consumption,
    event = final.event;
  if (
    canonicalJson(fa) !== canonicalJson(ia) ||
    canonicalJson(fc) !== canonicalJson(ic)
  )
    fail(code);
  if (canonicalJson(ia) !== canonicalJson(attribution(original)))
    fail("provider_sim_receipt_unattributed");
  if (
    event.provider_call_id !== ia.provider_call_id ||
    event.usage.input_bytes !== ic.input_bytes ||
    event.usage.output_bytes !== final.observed_output_bytes
  )
    fail("provider_sim_receipt_binding_invalid");
  const price = event.actual_cost === null ? "unknown_final" : "known_final";
  if (final.price_status !== price)
    fail("provider_sim_receipt_binding_invalid");
  if (finalHash(final) !== packet.final_hash) fail(code);
  // Violations are recomputed authoritatively by SQL. The projector never makes a transient flag authoritative.
  return freeze({
    outcome: event,
    settlement: {
      schema: "g1-sim-settlement/1",
      verification_status: "attributed_receipt",
      metadata_problem: "none",
      invocation_observation_hash: packet.invocation_hash as string,
      final_receipt_hash: packet.final_hash as string,
      attribution: ia,
      consumption: ic,
      work_ended: final.work_ended,
      observed_output_bytes: final.observed_output_bytes,
      price_status: price,
      event_binding: event,
      violations: [] as Violation[],
    },
  });
}
