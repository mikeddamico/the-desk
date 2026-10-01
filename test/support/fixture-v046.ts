// Test-only access to the accepted Frozen Walking-Skeleton Fixture v0.4.6 (pinned by SHA-256).
// Uses the existing `unzip -p` approach (node:zlib alone is not a ZIP member reader). This is NOT the production
// fixture loader (loader work is a later tranche) and it never co-loads archive members into any runtime path.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const FIXTURE_V046_ZIP_SHA256 =
  "7e1bb1108cdd84e47269b9ab2dab20ba934fcec64d44262f86d2b505616b0747";

const zipPath = resolve(
  "Lock/04_IMPLEMENTATION/The_Desk_Walking_Skeleton_Fixture_v0.4.6.zip",
);
const actual = createHash("sha256").update(readFileSync(zipPath)).digest("hex");
if (actual !== FIXTURE_V046_ZIP_SHA256)
  throw new Error(`Fixture v0.4.6 ZIP hash mismatch: ${actual}`);

const safeMember = /^[a-zA-Z0-9_./-]+$/;
const cache = new Map<string, Buffer>();

export function fixtureBytes(member: string): Buffer {
  if (!safeMember.test(member) || member.includes(".."))
    throw new Error(`Unsafe fixture member: ${member}`);
  const cached = cache.get(member);
  if (cached) return cached;
  const bytes = execFileSync("unzip", ["-p", zipPath, member], {
    maxBuffer: 64 * 1024 * 1024,
  });
  cache.set(member, bytes);
  return bytes;
}

/** Parsed JSON. NOTE: `JSON.parse` cannot distinguish `1.0` from `1` (see the sequence_not_integer vector). */
export function fixtureJson(member: string): unknown {
  return JSON.parse(fixtureBytes(member).toString("utf8")) as unknown;
}

export type Row = Record<string, unknown>;

export function foundationTables(): Record<string, Row[]> {
  const doc = fixtureJson("foundation_rows_398.json") as {
    tables: Record<string, Row[]>;
  };
  return doc.tables;
}

export function artifactsByType(): Map<string, Row[]> {
  const out = new Map<string, Row[]>();
  for (const row of foundationTables().artifacts ?? []) {
    const type = row.artifact_type as string;
    out.set(type, [...(out.get(type) ?? []), row]);
  }
  return out;
}

export function onlyArtifact(type: string): Row {
  const rows = artifactsByType().get(type);
  const [only, ...rest] = rows ?? [];
  if (only === undefined || rest.length > 0)
    throw new Error(`Expected one ${type} artifact`);
  return only;
}

export function payloadOf(row: Row): Record<string, unknown> {
  return row.canonical_payload as Record<string, unknown>;
}

// ---- strict JSON-pointer mutations used by the shipped hash vectors ----
export interface Mutation {
  op: "set" | "delete" | "append" | "add" | "swap" | "reorder_keys";
  path: string;
  value?: unknown;
  with?: string;
}

function tokens(path: string): string[] {
  if (path === "/" || path === "") return [];
  return path
    .slice(1)
    .split("/")
    .map((t) => t.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function resolveParent(
  doc: unknown,
  path: string,
): { parent: Record<string, unknown> | unknown[]; key: string } {
  const parts = tokens(path);
  if (parts.length === 0) throw new Error(`Pointer has no parent: ${path}`);
  let node: unknown = doc;
  for (const part of parts.slice(0, -1)) {
    node = Array.isArray(node)
      ? (node as unknown[])[Number(part)]
      : (node as Record<string, unknown> | undefined)?.[part];
    if (node === undefined) throw new Error(`Unresolved pointer: ${path}`);
  }
  if (typeof node !== "object" || node === null)
    throw new Error(`Unresolved pointer: ${path}`);
  return {
    parent: node as Record<string, unknown> | unknown[],
    key: parts.slice(-1).join(""),
  };
}

function resolveNode(doc: unknown, path: string): unknown {
  let node: unknown = doc;
  for (const part of tokens(path)) {
    node = Array.isArray(node)
      ? (node as unknown[])[Number(part)]
      : (node as Record<string, unknown> | undefined)?.[part];
    if (node === undefined) throw new Error(`Unresolved pointer: ${path}`);
  }
  return node;
}

/** Applies mutations to a deep clone; every selector must resolve strictly (no silent creation) except `add`. */
export function applyMutations<T>(doc: T, mutations: readonly Mutation[]): T {
  const out = structuredClone(doc);
  for (const m of mutations) {
    if (m.op === "reorder_keys") {
      const node = resolveNode(out, m.path) as Record<string, unknown>;
      const entries = Object.entries(node).reverse();
      for (const key of Object.keys(node)) Reflect.deleteProperty(node, key);
      for (const [key, value] of entries) node[key] = value;
      continue;
    }
    if (m.op === "append") {
      (resolveNode(out, m.path) as unknown[]).push(structuredClone(m.value));
      continue;
    }
    const { parent, key } = resolveParent(out, m.path);
    if (Array.isArray(parent)) {
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || index >= parent.length)
        throw new Error(`Unresolved array index: ${m.path}`);
      if (m.op === "set") parent[index] = structuredClone(m.value);
      else if (m.op === "delete") parent.splice(index, 1);
      else if (m.op === "swap") {
        const other = resolveParent(out, m.with ?? "");
        const otherArray = other.parent as unknown[];
        const j = Number(other.key);
        const tmp = parent[index];
        parent[index] = otherArray[j];
        otherArray[j] = tmp;
      } else throw new Error(`Unsupported array op: ${m.op}`);
    } else {
      if (m.op === "set") {
        if (!Object.hasOwn(parent, key))
          throw new Error(`Unresolved key for set: ${m.path}`);
        parent[key] = structuredClone(m.value);
      } else if (m.op === "add") {
        if (Object.hasOwn(parent, key))
          throw new Error(`Key already present for add: ${m.path}`);
        parent[key] = structuredClone(m.value);
      } else if (m.op === "delete") {
        if (!Object.hasOwn(parent, key))
          throw new Error(`Unresolved key for delete: ${m.path}`);
        Reflect.deleteProperty(parent, key);
      } else throw new Error(`Unsupported object op: ${m.op}`);
    }
  }
  return out;
}

/** Narrow a possibly-missing value, failing loudly (keeps tests free of non-null assertions). */
export function must<T>(value: T | null | undefined, what = "value"): T {
  if (value === null || value === undefined) throw new Error(`Missing ${what}`);
  return value;
}

/**
 * FIXTURE mapping membership (P&R 20.1 closed fixture request-to-response mapping). Deliberately lives in test
 * support: it is a fixture check, not a general production request whitelist.
 */
export function fixtureMappingKeys(): Set<string> {
  const entries = (
    fixtureJson("fixture_persistence_conformance.json") as {
      entries: { base_request_hash: string; intentional_take_index: number }[];
    }
  ).entries;
  return new Set(
    entries.map(
      (e) => `${e.base_request_hash}|${String(e.intentional_take_index)}`,
    ),
  );
}
