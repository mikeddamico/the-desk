// Typed hash/identity obligations against the DECLARED obligation records (A4, M8). Source of truth: Fixture v0.4.6
// `provenance/OBLIGATION_RECONCILIATION.json` (178 typed successor entries, 279 nested locations, 4 subsidiary records), a
// non-archival pack member read through the verified pack. Three things are kept apart:
//   FORMAT   - a field-specific shape (hex64, v1:hex64, fixture_stub:op:hex64, v1:hex64:take). Never "any hash-like name".
//   VALUE    - the persisted value equals the DECLARED value exactly (declared records are comparison targets).
//   RECOMPUTE- done elsewhere (A1 hashes, derive.ts, ledger.ts); nothing here recomputes a hash.
// Nulls are permitted only at declared exact record/pointer locations, never by leaf name. Archival members are not parsed.
import { families } from "./families.js";
import {
  fail,
  indexBy,
  isObj,
  list,
  must,
  obj,
  rowsOf,
  same,
  str,
  type Obj,
} from "./check-util.js";
import type { Row, Tables } from "./rows.js";

export interface ObligationRecords {
  typed: readonly Obj[];
  nested: readonly Obj[];
  subsidiary: readonly Obj[];
  categoryCounts: Readonly<Record<string, number>>;
  /** Shipped container order (comparison target): member -> artifact ids by index. */
  containers: Readonly<Record<string, readonly string[]>>;
  /**
   * The reconciliation file records the v0.4.5-era values; Fixture v0.4.6 supersedes some of them ONLY through its identity
   * transition inventory (`provenance/v0.4.6/IDENTITY_TRANSITION.json`). This map holds every `<x>_v045 -> <x>_v046` pair; a declared
   * value that differs from the persisted one is accepted only when this inventory explains exactly that change.
   */
  transition: ReadonlyMap<string, string>;
}

/** Collects every v0.4.5 -> v0.4.6 string pair of the transition inventory (sibling keys `*_v045` / `*_v046`, or `v045` / `v046`). */
export function transitionPairs(doc: unknown): Map<string, string> {
  const pairs = new Map<string, string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (isObj(v)) {
      for (const key of Object.keys(v)) {
        const base =
          key === "v045"
            ? ""
            : key.endsWith("_v045")
              ? key.slice(0, -5)
              : undefined;
        if (base === undefined) continue;
        const next = v[base === "" ? "v046" : `${base}_v046`];
        if (
          typeof v[key] === "string" &&
          typeof next === "string" &&
          v[key] !== next
        )
          pairs.set(v[key], next);
      }
      Object.values(v).forEach(walk);
    }
  };
  walk(doc);
  return pairs;
}

/** FIXTURE-SCOPED: a declared (v0.4.5-era) value is the persisted one, or the one the v0.4.6 transition inventory maps it to. */
const explained = (
  declared: unknown,
  persisted: unknown,
  t: ReadonlyMap<string, string>,
): boolean =>
  persisted === declared ||
  (typeof declared === "string" &&
    // tagged identities embed a hash (`v1:<hex>`, `fixture_stub:<op>:<hex>`, `v1:<hex>:<take>`): map each embedded hex64
    declared.replace(/[0-9a-f]{64}/g, (h) => t.get(h) ?? h) === persisted);

const HEX64 = /^[0-9a-f]{64}$/;
const V1 = /^v1:[0-9a-f]{64}$/;
const TTS_KEY = /^v1:[0-9a-f]{64}:\d+$/;
const MODEL_KEY = /^fixture_stub:[a-z_]+:[0-9a-f]{64}$/;

const FORMAT: Readonly<Record<string, (row: Row) => RegExp>> = {
  "artifacts.content_hash": () => HEX64,
  "evidence_units.content_hash": () => HEX64,
  "claims.content_hash": () => HEX64,
  "claim_supports.support_hash": () => HEX64,
  "derivation_runs.output_hash": () => HEX64,
  "evidence_packages.package_hash": () => HEX64,
  "show_config_versions.config_hash": () => HEX64,
  "audit_runs.input_fingerprint": () => HEX64,
  "gate_results.input_fingerprint": () => HEX64,
  "model_runs.semantic_input_hash": () => HEX64,
  "prompt_manifests.rendered_request_hash": () => HEX64,
  "script_versions.revision_parent_content_identity": () => HEX64,
  "render_blocks.base_request_hash": () => V1,
  "reroll_triggers.base_request_hash": () => V1,
  "provider_calls.request_fingerprint": (r) =>
    r.operation === "tts" ? V1 : HEX64,
  "provider_calls.logical_request_key": (r) =>
    r.operation === "tts" ? TTS_KEY : MODEL_KEY,
};

/**
 * FIXTURE-SCOPED sources whose nested locations are not addressable in the loaded rows, each with the reason. A source not listed
 * here and not resolvable fails (no silent skipping).
 */
const NOT_ROW_RESOLVABLE: Readonly<Record<string, string>> = {
  "evidence_store.json":
    "evidence bodies live in the evidence store; their hashes are the evidence_units.content_hash typed entries",
  "ready_expectations.json": "expectations member, not a loaded row",
  "config/show.json":
    "show configuration payload column; covered by the show_config_versions.config_hash typed entry",
  "scenarios.json": "isolated scenarios are never part of the base load",
};

/** Source-era member names whose loaded successor is stored under another member (the corrected direction replaces the historical one). */
const MEMBER_ALIAS: Readonly<Record<string, string>> = {
  "performance_direction.json": "performance_direction_corrected.json",
};

function payloadAt(
  root: unknown,
  pointer: string,
): { found: boolean; value: unknown } {
  let cur = root;
  for (const raw of pointer.split("/").slice(1)) {
    const key = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    if (Array.isArray(cur)) {
      const i = Number(key);
      if (!Number.isInteger(i) || i < 0 || i >= cur.length)
        return { found: false, value: undefined };
      cur = cur[i];
    } else if (isObj(cur) && Object.hasOwn(cur, key)) cur = cur[key];
    else return { found: false, value: undefined };
  }
  return { found: true, value: cur };
}

export function verifyTypedObligations(
  tables: Tables,
  records: ObligationRecords,
  historical: { artifactId: string },
): void {
  // (0) the declaration is internally consistent
  if (records.typed.length !== 178)
    fail("obligation_declaration_count", String(records.typed.length));
  const declaredCounts = new Map<string, number>();
  for (const e of records.typed) {
    const key = `${str(e.successor_table)}.${str(e.field)}`;
    declaredCounts.set(key, (declaredCounts.get(key) ?? 0) + 1);
  }
  same(
    "obligation_category_counts",
    Object.fromEntries([...declaredCounts].sort()),
    Object.fromEntries(Object.entries(records.categoryCounts).sort()),
  );

  // (1) every declared typed entry: the persisted field equals the declared value, is computed, and has its field-specific format
  const pk = new Map(
    families.map((f) => [f.table, must(f.primaryKey[0], "primary key")]),
  );
  const byTable = new Map<string, Map<string, Row>>();
  const rowOf = (table: string, id: string): Row => {
    if (!byTable.has(table))
      byTable.set(
        table,
        indexBy(rowsOf(tables, table), must(pk.get(table), `pk ${table}`)),
      );
    return must(byTable.get(table)?.get(id), `${table} ${id}`);
  };
  for (const e of records.typed) {
    const table = str(e.successor_table);
    const field = str(e.field);
    if (e.value_status !== "computed")
      fail("obligation_not_computed", `${table}.${field}`);
    const row = rowOf(table, str(e.successor_record_id));
    if (!explained(e.value, row[field], records.transition))
      fail(
        "obligation_value_mismatch",
        `${table}.${field} ${str(e.successor_record_id)}`,
      );
    const format = must(
      FORMAT[`${table}.${field}`],
      `format ${table}.${field}`,
    )(row);
    if (typeof row[field] !== "string" || !format.test(row[field]))
      fail(
        "obligation_format",
        `${table}.${field} ${str(e.successor_record_id)}`,
      );
  }

  // (2) FORMAT of every row of the typed columns (incl. rows without a declared entry, e.g. audio content hashes); nulls only at
  //     the one declared null class: a root script version (revision_parent_id and its identity are null together)
  for (const key of Object.keys(FORMAT)) {
    const [table, field] = key.split(".") as [string, string];
    for (const row of rowsOf(tables, table)) {
      const value = row[field];
      if (value === null || value === undefined) {
        const rootScript =
          key === "script_versions.revision_parent_content_identity" &&
          row.revision_parent_id === null;
        if (!rootScript)
          fail(
            "obligation_undeclared_null",
            `${key} ${str(row[must(pk.get(table), "pk")])}`,
          );
        continue;
      }
      if (typeof value !== "string" || !must(FORMAT[key], key)(row).test(value))
        fail("obligation_format", key);
      if (
        key === "script_versions.revision_parent_content_identity" &&
        row.revision_parent_id === null
      )
        fail("obligation_parent_pair");
    }
  }

  // (3) nested locations: resolved to the persisted artifact payloads (or typed rows) and compared at EXACT pointers
  const artifacts = rowsOf(tables, "artifacts");
  const declaredNullPointers = new Map<string, Set<string>>();
  let resolved = 0;
  const excluded = new Map<string, number>();
  for (const loc of records.nested) {
    const member = str(loc.source_member);
    const pointer = str(loc.json_pointer);
    let target: unknown;
    let memberKey: string | undefined;
    const container =
      /^(prompt_payloads\.json)#\/manifests\/(\d+)\/canonical_payload$/.exec(
        member,
      );
    if (container) {
      const id = must(
        records.containers[must(container[1], "container")]?.[
          Number(container[2])
        ],
        `container ${member}`,
      );
      target = must(
        artifacts.find((a) => a.artifact_id === id),
        `manifest artifact ${id}`,
      ).canonical_payload;
      memberKey = id;
    } else if (member === "support_payloads.json#/tenor_support") {
      const tenor = must(
        artifacts.find((a) => a.artifact_type === "tenor_support"),
        "tenor support",
      );
      target = tenor.canonical_payload;
      memberKey = str(tenor.artifact_id);
    } else if (
      member.startsWith("foundation_rows.json#/tables/derivation_runs/0/")
    ) {
      const only = rowsOf(tables, "derivation_runs");
      if (only.length !== 1) fail("obligation_derivation_row");
      const rest = member.slice(
        "foundation_rows.json#/tables/derivation_runs/0".length,
      );
      const r = payloadAt(only[0], rest);
      if (!r.found || !explained(loc.value, r.value, records.transition))
        fail("obligation_nested_value", member);
      resolved += 1;
      continue;
    } else if (
      Object.hasOwn(NOT_ROW_RESOLVABLE, must(member.split("#")[0], "member"))
    ) {
      const source = must(member.split("#")[0], "member");
      excluded.set(source, (excluded.get(source) ?? 0) + 1);
      continue;
    } else {
      const matches = artifacts.filter(
        (a) => a.storage_uri === (MEMBER_ALIAS[member] ?? member),
      );
      const [only, ...more] = matches;
      if (!only || more.length > 0)
        fail("obligation_unresolvable_member", member);
      target = only.canonical_payload;
      memberKey = str(only.artifact_id);
    }
    const at = payloadAt(target, pointer);
    if (!at.found) fail("obligation_pointer_missing", `${member}${pointer}`);
    if (loc.class === "computed") {
      // computed: a hash/tagged identity (explained by the transition inventory when v0.4.6 supersedes it) or an exact
      // integer measure (frames); never a loose "looks like a hash" test on the name
      const okHash =
        typeof at.value === "string" &&
        /^(v1:)?[0-9a-f]{64}$/.test(at.value) &&
        explained(loc.value, at.value, records.transition);
      const okInteger =
        typeof loc.value === "number" &&
        Number.isSafeInteger(loc.value) &&
        at.value === loc.value;
      if (!okHash && !okInteger)
        fail("obligation_nested_value", `${member}${pointer}`);
    } else if (loc.class === "legitimate_semantic_null_not_a_hash") {
      if (loc.value !== null || at.value !== null)
        fail("obligation_nested_null", `${member}${pointer}`);
      (
        declaredNullPointers.get(must(memberKey, "artifact")) ??
        declaredNullPointers
          .set(must(memberKey, "artifact"), new Set())
          .get(must(memberKey, "artifact"))
      )?.add(pointer);
    } else if (loc.class === "status_placeholder_resolved") {
      if (at.value !== loc.value)
        fail("obligation_nested_value", `${member}${pointer}`);
    } else fail("obligation_unknown_class", str(loc.class));
    resolved += 1;
  }
  if (
    resolved + [...excluded.values()].reduce((a, b) => a + b, 0) !==
    records.nested.length
  )
    fail("obligation_nested_accounting");

  // (4) undeclared hash-like nulls: a null at a hash/identity-named leaf must sit at a declared exact pointer (or be the historical
  //     disposition below). The name only selects what to scrutinize; permission comes from the declared pointer.
  const hashLike = /hash|fingerprint|identity|request_key/;
  for (const a of artifacts) {
    if (a.artifact_id === historical.artifactId) continue;
    const walk = (value: unknown, pointer: string): void => {
      if (Array.isArray(value))
        value.forEach((v, i) => {
          walk(v, `${pointer}/${String(i)}`);
        });
      else if (isObj(value))
        for (const [k, v] of Object.entries(value)) {
          const p = `${pointer}/${k.replaceAll("~", "~0").replaceAll("/", "~1")}`;
          if (v === null && hashLike.test(k)) {
            if (!declaredNullPointers.get(str(a.artifact_id))?.has(p))
              fail(
                "obligation_undeclared_hashlike_null",
                `${str(a.artifact_type)}${p}`,
              );
          } else walk(v, p);
        }
    };
    walk(a.canonical_payload, "");
  }

  // (5) subsidiary digests and the exact historical row/path disposition
  const hist = must(
    artifacts.find((a) => a.artifact_id === historical.artifactId),
    "historical artifact",
  );
  const histPayload = obj(hist.canonical_payload, "historical payload");
  const disposition = must(
    records.subsidiary.find((s) => s.class === "historical_null_disposition"),
    "historical disposition",
  );
  if (
    disposition.field !== "historical_direction.input_fingerprint" ||
    disposition.value !== null ||
    disposition.disposition !== "historical_producer_inputs_not_recorded" ||
    !Object.hasOwn(histPayload, "input_fingerprint") ||
    histPayload.input_fingerprint !== null
  )
    fail("obligation_historical_disposition");
  const current = must(
    artifacts.find(
      (a) =>
        a.artifact_type === "performance_direction" &&
        a.artifact_id !== historical.artifactId,
    ),
    "current direction",
  );
  const correction = must(
    records.subsidiary.find(
      (s) => s.class === "computed_correction_fingerprint_non_null",
    ),
    "correction record",
  );
  if (
    !explained(
      correction.value,
      obj(current.canonical_payload, "direction").input_fingerprint,
      records.transition,
    )
  )
    fail("obligation_correction_fingerprint");
  const scope = must(
    records.subsidiary.find((s) => s.field === "evidence_package.scope_hash"),
    "scope record",
  );
  const pkg = must(
    artifacts.find((a) => a.artifact_type === "evidence_package"),
    "package",
  );
  if (obj(pkg.canonical_payload, "package").scope_hash !== scope.value)
    fail("obligation_scope_hash");
  const ctx = must(
    records.subsidiary.find((s) => str(s.field).includes("context_hash")),
    "context record",
  );
  const manifest = obj(
    must(
      artifacts.find((a) => a.artifact_type === "render_manifest"),
      "render manifest",
    ).canonical_payload,
    "render manifest",
  );
  const persistedContexts = list(manifest.render_blocks, "render_blocks").map(
    (b) => obj(obj(b, "block").resolved_context_refs, "refs").context_hash,
  );
  const declaredContexts = list(ctx.value, "declared context hashes");
  if (
    persistedContexts.length !== declaredContexts.length ||
    persistedContexts.some(
      (v, i) => !explained(declaredContexts[i], v, records.transition),
    )
  )
    fail("obligation_context_hashes");
}
