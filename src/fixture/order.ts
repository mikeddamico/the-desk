// Row-level insertion planning (pure). The order is DERIVED from the declared foreign-key graph (families.ts, checked
// against the live schema by an integration test) plus the explicit trigger-level dependencies below. Composite FK targets
// are resolved by their referenced column tuple. No table order is hard-coded.
import { FixtureIntegrityError } from "./pack.js";
import { families, type Family } from "./families.js";
import type { Row, Tables } from "./rows.js";

export interface PlannedRow {
  table: string;
  row: Row;
  index: number;
}

const key = (row: Row, columns: readonly string[]): string =>
  JSON.stringify(columns.map((c) => row[c]));

/**
 * Dependencies enforced by trigger functions rather than foreign keys (migration 001):
 * - guard_provider_history: a reroll trigger requires the source call's `succeeded` event to exist;
 * - guard_render_take: a take requires its provider call's `succeeded` event whose response artifact is the take's audio,
 *   and its render block (matched by base_request_hash == request_fingerprint).
 */
function triggerDependencies(
  node: PlannedRow,
  byTable: Map<string, PlannedRow[]>,
): PlannedRow[] {
  const events = byTable.get("provider_call_events") ?? [];
  if (node.table === "reroll_triggers")
    return events.filter(
      (e) =>
        e.row.provider_call_id === node.row.source_provider_call_id &&
        e.row.event_type === "succeeded",
    );
  if (node.table === "render_takes") {
    const blocks = byTable.get("render_blocks") ?? [];
    return [
      ...events.filter(
        (e) =>
          e.row.provider_call_id === node.row.provider_call_id &&
          e.row.event_type === "succeeded",
      ),
      ...blocks.filter(
        (b) => b.row.render_block_id === node.row.render_block_id,
      ),
    ];
  }
  return [];
}

/** Kahn's algorithm with a deterministic tie-break (family order, then row order). Rejects dangling references and cycles. */
export function planInsertion(
  tables: Tables,
  graph: readonly Family[] = families,
): PlannedRow[] {
  const nodes: PlannedRow[] = [];
  const byTable = new Map<string, PlannedRow[]>();
  for (const family of graph) {
    const list: PlannedRow[] = [];
    (tables[family.table] ?? []).forEach((row, index) => {
      const node = { table: family.table, row, index };
      nodes.push(node);
      list.push(node);
    });
    byTable.set(family.table, list);
  }
  const family = new Map(graph.map((f) => [f.table, f]));
  // Index every referenced column tuple once (primary keys and composite unique targets alike).
  const indexes = new Map<string, Map<string, PlannedRow>>();
  const indexFor = (table: string, columns: readonly string[]) => {
    const id = `${table}(${columns.join(",")})`;
    let found = indexes.get(id);
    if (!found) {
      found = new Map();
      for (const n of byTable.get(table) ?? [])
        found.set(key(n.row, columns), n);
      indexes.set(id, found);
    }
    return found;
  };
  const deps = new Map<PlannedRow, Set<PlannedRow>>(
    nodes.map((n) => [n, new Set()]),
  );
  for (const node of nodes) {
    const own = must(family.get(node.table));
    for (const fk of own.foreignKeys) {
      if (
        fk.columns.some(
          (c) => node.row[c] === null || node.row[c] === undefined,
        )
      )
        continue;
      if (!family.has(fk.refTable))
        throw new FixtureIntegrityError(
          "reference_to_unloaded_table",
          `${node.table}.${fk.columns.join(",")} -> ${fk.refTable}`,
        );
      const target = indexFor(fk.refTable, fk.refColumns).get(
        key(
          Object.fromEntries(
            fk.refColumns.map((rc, i) => [rc, node.row[must(fk.columns[i])]]),
          ),
          fk.refColumns,
        ),
      );
      if (!target)
        throw new FixtureIntegrityError(
          "dangling_reference",
          `${node.table}[${String(node.index)}].${fk.columns.join(",")} -> ${fk.refTable}`,
        );
      if (target !== node) must(deps.get(node)).add(target);
    }
    for (const d of triggerDependencies(node, byTable))
      if (d !== node) must(deps.get(node)).add(d);
  }
  const order: PlannedRow[] = [];
  const done = new Set<PlannedRow>();
  const pending = new Set(nodes);
  while (pending.size > 0) {
    const next = nodes.find(
      (n) => pending.has(n) && [...must(deps.get(n))].every((d) => done.has(d)),
    );
    if (!next)
      throw new FixtureIntegrityError(
        "dependency_cycle",
        [...pending]
          .slice(0, 3)
          .map((n) => n.table)
          .join(","),
      );
    pending.delete(next);
    done.add(next);
    order.push(next);
  }
  return order;
}

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("internal: missing value");
  return value;
}
