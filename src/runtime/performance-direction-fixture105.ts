// Fixed connected evaluation fixture only. Historical Performance owner stays read-only.
import {
  connectedFixture105Data,
  connectedFixture105Id,
} from "./connected-fixture105-data.js";
import { connectedFixture105ArtifactHash } from "../identity/artifacts.js";
import { canonicalJson, sha256 } from "../identity/canonical-json.js";
import {
  evaluatePerformanceGates,
  sortPerformanceFindings,
  performanceAggregateOf,
  isClosedPerformanceResult,
  PERFORMANCE_PIN,
  PERFORMANCE_DEFINITION_KEYS,
  type PerformanceFinding,
  type PerformanceRow,
  type PerformanceCoverageEntry,
  type PerformanceEvaluation,
} from "./performance-direction.js";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v);
const isDenseList = (v: unknown): v is unknown[] =>
  Array.isArray(v) &&
  Array.from({ length: v.length }, (_, i) => Object.hasOwn(v, i)).every(
    Boolean,
  );
const sameKeys = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((k) => b.includes(k));
const POSITIONS = [19, 20, 21, 22, 23, 24, 25] as const;
function deepFreeze<T>(v: T): T {
  if (typeof v === "object" && v !== null) {
    for (const x of Object.values(v)) deepFreeze(x);
    Object.freeze(v);
  }
  return v;
}
const CONNECTED105_RESULTS = new WeakSet<object>();
/** Public evaluator owns grammar and all seven ordinary predicates. Only the fixed M01 rule differs. */
export function evaluateConnectedFixture105Performance(
  facts: unknown,
): PerformanceEvaluation {
  const ordinary = evaluatePerformanceGates(facts);
  // Reached only after the public dense-object grammar; no coercion or new fact input.
  if (
    !isObj(facts) ||
    !isObj(facts.payload) ||
    !isDenseList(facts.payload.performance_intents) ||
    !facts.payload.performance_intents.every(isObj) ||
    !isDenseList(facts.intent_rows)
  )
    throw new TypeError("fixture_performance_facts");
  const intents = facts.payload.performance_intents;
  const intentRows = facts.intent_rows;
  const mode = typeof facts.mode === "string" ? facts.mode : "";
  const fixed = connectedFixture105Data();
  const rows = ordinary.rows.map((row, index): PerformanceRow => {
    let findings = row.result.findings as PerformanceFinding[];
    let rowFacts = row.result.facts;
    if (index === 2) {
      const historical: PerformanceFinding[] = [];
      if (!["normal_post_event", "roundup", "sombre"].includes(mode))
        historical.push({ class: "violation", code: "mode_unregistered" });
      if (intents.length !== 1)
        historical.push({ class: "violation", code: "denominator_mismatch" });
      if (intents.length !== intentRows.length)
        historical.push({ class: "violation", code: "denominator_mismatch" });
      findings = sortPerformanceFindings(21, historical);
      intents.forEach((intent, intent_index) => {
        if (
          mode !== "normal_post_event" ||
          intent.scope_type !== "turn" ||
          intent.intent_type !== "pace" ||
          intent.value !== "slower" ||
          intent.strength !== "light" ||
          intent.timing_anchor !== null
        )
          findings.push({
            class: "violation",
            code: "fixture_mode_intent_forbidden",
            intent_index,
          });
      });
      rowFacts = {
        examined: intents.length,
        expected_examined: 1,
        families_present: new Set(intents.map((i) => i.intent_type)).size,
        rule_entries: 1,
      };
    }
    return {
      ...row,
      gate_definition_id: connectedFixture105Id(
        `definition:${String(19 + index)}`,
      ),
      outcome: findings.length === 0 ? "pass" : "fail",
      result: {
        ...row.result,
        actor_id: (fixed.identities.ids as Obj).actor,
        schema: "connected-fixture105-performance-result/1",
        subject_refs: [fixed.identities["direction-version"]],
        facts: rowFacts,
        findings,
      },
    };
  });
  const coverage = ordinary.coverage.map(
    (entry): PerformanceCoverageEntry =>
      entry.id === "M01" ? { id: "M01", status: "established" } : entry,
  );
  const result = deepFreeze({
    rows,
    coverage,
    aggregate: performanceAggregateOf(
      rows.flatMap((row) => row.result.findings as PerformanceFinding[]),
      coverage,
    ),
  });
  CONNECTED105_RESULTS.add(result);
  return result;
}

/** Full actual result projection; this process-local provenance is not durable authority. */
export function connectedFixture105PerformanceResultHash(
  result: PerformanceEvaluation,
): string {
  if (!CONNECTED105_RESULTS.has(result))
    throw new TypeError("fixture_performance_result_provenance");
  const coverageOrder = [
    "M01",
    "S01",
    "B01",
    "Q01",
    "Q02",
    "T01",
    "T02",
    "A01",
  ];
  if (
    result.rows.length !== POSITIONS.length ||
    result.rows.some(
      (row, index) =>
        row.key !== PERFORMANCE_DEFINITION_KEYS[index] ||
        row.gate_definition_id !==
          connectedFixture105Id(`definition:${String(19 + index)}`),
    ) ||
    result.coverage.length !== coverageOrder.length ||
    result.coverage.some((entry, index) => entry.id !== coverageOrder[index])
  )
    throw new TypeError("fixture_performance_result_order");
  const findings = result.rows.flatMap(
    (row) => row.result.findings as PerformanceFinding[],
  );
  if (result.aggregate !== performanceAggregateOf(findings, result.coverage))
    throw new TypeError("fixture_performance_result_aggregate");
  return sha256(
    Buffer.from(
      canonicalJson({
        rows: result.rows,
        aggregate: result.aggregate,
        coverage: result.coverage,
      }),
      "utf8",
    ),
  );
}
/** The only vocabulary addition is gate21's fixed nonempty-rule violation. */
export function isClosedConnectedFixture105PerformanceResult(
  value: unknown,
): boolean {
  const fixed = connectedFixture105Data();
  if (
    !isObj(value) ||
    value.actor_id !== (fixed.identities.ids as Obj).actor ||
    value.actor_kind !== "policy" ||
    value.schema !== "connected-fixture105-performance-result/1" ||
    value.fingerprint_stage !== "performance" ||
    !isDenseList(value.subject_refs) ||
    value.subject_refs.length !== 1 ||
    value.subject_refs[0] !== fixed.identities["direction-version"] ||
    !isDenseList(value.findings)
  )
    return false;
  const ordinary: unknown[] = [];
  for (const finding of value.findings) {
    if (isObj(finding) && finding.code === "fixture_mode_intent_forbidden") {
      if (
        value.check !== PERFORMANCE_DEFINITION_KEYS[2] ||
        !sameKeys(Object.keys(finding), ["class", "code", "intent_index"]) ||
        finding.class !== "violation" ||
        !isInt(finding.intent_index) ||
        finding.intent_index < 0
      )
        return false;
    } else ordinary.push(finding);
  }
  return isClosedPerformanceResult({
    ...value,
    actor_id: PERFORMANCE_PIN.actor_id,
    schema: PERFORMANCE_PIN.result_schema,
    findings: ordinary,
  });
}

/** Fixed borrowed transaction; caller data and cloned capabilities cannot select rows. */
export async function recordConnectedFixture105Performance(
  capability: object,
): Promise<void> {
  const { takeConnectedFixture105EvaluationBorrow, connectedFixture105Row } =
    await import("./connected-fixture105.js");
  const borrow = takeConnectedFixture105EvaluationBorrow(
    capability,
    "performance",
  );
  if (borrow.performance === undefined || borrow.operation === undefined)
    throw new TypeError("fixture_performance_binding");
  connectedFixture105PerformanceResultHash(borrow.performance);
  if (
    borrow.performance.aggregate !== "complete_defined_set" ||
    borrow.performance.rows.some(
      (row) =>
        row.outcome !== "pass" ||
        (row.result.findings as unknown[]).length !== 0,
    )
  )
    throw new TypeError("fixture_performance_failed");
  if (
    borrow.performance.rows.some(
      (row) => !isClosedConnectedFixture105PerformanceResult(row.result),
    )
  )
    throw new TypeError("fixture_performance_result_shape");
  for (const table of [
    "performance_direction_versions",
    "performance_intents",
  ]) {
    if (
      (await borrow.tx.query(`SELECT 1 AS present FROM ${table} LIMIT 1`)).rows
        .length !== 0
    )
      throw new TypeError("fixture_performance_foreign_rows");
  }
  for (const table of [
    "artifacts",
    "performance_direction_versions",
    "performance_intents",
    "gate_results",
  ]) {
    const rows = borrow.rows[table];
    if (rows?.length !== (table === "gate_results" ? 7 : 1))
      throw new TypeError("fixture_performance_row_count");
    const spec = connectedFixture105Data().sql.find((s) => s.table === table);
    if (spec === undefined) throw new TypeError("fixture_performance_table");
    const columns = spec.columns as Obj[];
    for (const row of rows) {
      connectedFixture105Row(table, row);
      const values = columns.map((column) =>
        column.sql_type === "jsonb"
          ? canonicalJson(row[String(column.column)])
          : row[String(column.column)],
      );
      await borrow.tx.query(
        `INSERT INTO ${table} (${columns.map((column) => String(column.column)).join(",")}) VALUES (${columns.map((column, index) => `$${String(index + 1)}${column.sql_type === "jsonb" ? "::jsonb" : ""}`).join(",")})`,
        values,
      );
    }
  }
  const operation = borrow.operationArtifact;
  if (
    operation?.content_hash !==
      connectedFixture105ArtifactHash("operation", borrow.operation) ||
    canonicalJson(operation.canonical_payload) !==
      canonicalJson(borrow.operation)
  )
    throw new TypeError("fixture_operation_binding");
  await borrow.tx.query(
    `INSERT INTO artifacts (artifact_id,artifact_type,schema_version,content_hash,canonical_payload,storage_uri,byte_size,parent_artifact_id,supersedes_artifact_id,created_at) VALUES ($1,$2,$3,$4,$5::jsonb,NULL,$6,NULL,NULL,$7)`,
    [
      operation.artifact_id,
      operation.artifact_type,
      operation.schema_version,
      operation.content_hash,
      canonicalJson(operation.canonical_payload),
      operation.byte_size,
      operation.created_at,
    ],
  );
}
