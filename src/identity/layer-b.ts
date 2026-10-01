// LAYER B (FIXTURE-SCOPED): additive bounded decisions recorded in Contract Trace v0.5.4 section 9 and the frozen
// technical-resolution records inside Fixture v0.4.5. They apply only to that fixture's content, are not Hashing v0.1.4
// text and are not product-wide policy. Pure functions; no loader, persistence or runtime alias is involved.
import { canonicalBytes } from "./canonical-json.js";
import { governedDomainHash, rawBytesHash } from "./domains.js";
import {
  asArray,
  asNonBlankString,
  asRecord,
  requireExactKeys,
  selectKeys,
  type JsonObject,
} from "./select.js";

const sha256Hex = /^[0-9a-f]{64}$/;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// ---- evidence-package-scope-v1 (Trace 9 item 1) -------------------------------------------------------------------
export const evidencePackageScopeFields = [
  "competition_ids",
  "entity_ids",
  "event_ids",
  "locale",
  "scheduled_default_mode",
  "scope_type",
  "show_id",
  "target_publication_slot_ref",
] as const;

/** Exactly the eight `manifest.scope` fields; other scope types, unrecognized or missing fields are rejected. */
export function evidencePackageScopeProjection(scope: unknown): JsonObject {
  const record = requireExactKeys(
    scope,
    evidencePackageScopeFields,
    "event scope",
  );
  if (record.scope_type !== "event")
    throw new TypeError("scope_type must be the literal event");
  for (const key of ["competition_ids", "entity_ids", "event_ids"] as const)
    asArray(record[key], key).forEach((item) => asNonBlankString(item, key));
  for (const key of [
    "locale",
    "scheduled_default_mode",
    "target_publication_slot_ref",
  ] as const)
    asNonBlankString(record[key], key);
  if (typeof record.show_id !== "string" || !uuid.test(record.show_id))
    throw new TypeError("show_id must be a governed UUID");
  return selectKeys(record, evidencePackageScopeFields, "event scope");
}

/** `sha256("evidence-package-scope-v1" LF canonical_json(projection))`; the package hash excludes this digest. */
export const evidencePackageScopeHash = (scope: unknown): string =>
  governedDomainHash(
    "evidence-package-scope-v1",
    evidencePackageScopeProjection(scope),
  );

// ---- render-context-v1 and the bounded C0/C2 recipe digest (Trace 9 item 2) ------------------------------------------
export const renderContextRecipes = ["C0-v1", "C2-v1"] as const;

export function renderContextProjection(context: unknown): JsonObject {
  const record = requireExactKeys(
    context,
    ["recipe_version", "turns"],
    "render context",
  );
  if (
    !(renderContextRecipes as readonly string[]).includes(
      String(record.recipe_version),
    )
  )
    throw new TypeError("Unsupported fixture context recipe");
  const turns = asArray(record.turns, "context turns").map((turn) =>
    selectKeys(
      turn,
      ["semantic_turn_id", "participant_id", "spoken_text"],
      "context turn",
    ),
  );
  if (record.recipe_version === "C0-v1" && turns.length !== 0)
    throw new TypeError("C0-v1 carries an explicit empty turns array");
  if (record.recipe_version === "C2-v1" && turns.length !== 1)
    throw new TypeError("C2-v1 carries exactly one preceding turn");
  return { recipe_version: record.recipe_version, turns };
}

/** Storage UUIDs, sequence, block refs, script/manifest hashes and the digest itself are excluded by construction. */
export const renderContextHash = (context: unknown): string =>
  governedDomainHash("render-context-v1", renderContextProjection(context));

// ---- performance-direction-correction-input-v1 (Trace 9 item 3) -------------------------------------------------------
export const correctionInputFields = [
  "source_direction_hash",
  "script_hash",
  "direction_spec_version",
  "adjudication_record_sha256",
  "correction",
] as const;
const correctionFields = [
  "source_performance_intent_id",
  "source_scope_ref",
  "intent_type",
  "expected_value",
  "replacement_value",
] as const;

/** Exactly five keys; the nested `correction` is the fixture's one bounded pace correction (measured -> slower). */
export function correctionInputProjection(projection: unknown): JsonObject {
  const record = requireExactKeys(
    projection,
    correctionInputFields,
    "correction input",
  );
  for (const key of [
    "source_direction_hash",
    "script_hash",
    "adjudication_record_sha256",
  ] as const)
    if (typeof record[key] !== "string" || !sha256Hex.test(record[key]))
      throw new TypeError(`${key} must be lowercase SHA-256 hex`);
  if (record.direction_spec_version !== "performance-render-0.1.4")
    throw new TypeError(
      "direction_spec_version must be performance-render-0.1.4",
    );
  const correction = requireExactKeys(
    record.correction,
    correctionFields,
    "correction",
  );
  if (
    correction.intent_type !== "pace" ||
    correction.expected_value !== "measured" ||
    correction.replacement_value !== "slower"
  )
    throw new TypeError(
      "Only the bounded fixture pace correction measured -> slower is governed",
    );
  asNonBlankString(
    correction.source_performance_intent_id,
    "source_performance_intent_id",
  );
  asNonBlankString(correction.source_scope_ref, "source_scope_ref");
  return selectKeys(record, correctionInputFields, "correction input");
}

export const performanceDirectionCorrectionInputFingerprint = (
  projection: unknown,
): string =>
  governedDomainHash(
    "performance-direction-correction-input-v1",
    correctionInputProjection(projection),
  );

/**
 * The frozen projection file is hashed as its exact canonical bytes: the bytes must already be canonical, with no
 * trailing LF, BOM or wrapper. Returns the same fingerprint as {@link performanceDirectionCorrectionInputFingerprint}.
 */
export function correctionInputFingerprintFromBytes(bytes: Uint8Array): string {
  const parsed: unknown = JSON.parse(Buffer.from(bytes).toString("utf8"));
  const projection = correctionInputProjection(parsed);
  if (Buffer.compare(Buffer.from(bytes), canonicalBytes(projection)) !== 0)
    throw new TypeError("Correction input bytes are not exact canonical bytes");
  return rawBytesHash(
    Buffer.concat([
      Buffer.from("performance-direction-correction-input-v1\n", "utf8"),
      Buffer.from(bytes),
    ]),
  );
}

// ---- historical-null disposition (Trace 9 item 4) ----------------------------------------------------------------------
export const HISTORICAL_NULL_DISPOSITION =
  "historical_producer_inputs_not_recorded";

/** The ONE authorized null: the preserved historical envelope, with its explicit disposition and never a substitute. */
export function assertHistoricalProducerNull(direction: unknown): void {
  const record = asRecord(direction, "historical direction");
  if (
    record.input_fingerprint !== null ||
    record.input_fingerprint_disposition !== HISTORICAL_NULL_DISPOSITION
  )
    throw new TypeError(
      "Historical direction requires a null input_fingerprint with its disposition",
    );
}

/** A current direction carries a computed, non-null input fingerprint and no historical disposition. */
export function assertCurrentInputFingerprint(direction: unknown): void {
  const record = asRecord(direction, "current direction");
  if (
    typeof record.input_fingerprint !== "string" ||
    !sha256Hex.test(record.input_fingerprint)
  )
    throw new TypeError(
      "A current direction requires a computed non-null input_fingerprint",
    );
  if (Object.hasOwn(record, "input_fingerprint_disposition"))
    throw new TypeError(
      "A current direction must not carry the historical null disposition",
    );
}
