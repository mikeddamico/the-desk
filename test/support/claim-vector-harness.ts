// Test harness for the 58 shipped offline claim-event vectors (Fixture v0.4.6 `claim_event_conformance.json`).
//
// Independence: `reduce`, `frozen_hash` and `cursor` steps run through PRODUCTION code (reduceClaimState, frozenStateHash,
// checkCursor). `append` steps run through `OfflineClaimLog`, an offline model of claim-local sequence rules written from the
// vectors' own contract (and mirroring the fixture validator G28): append acceptance is a database concern (Migration 002 guard)
// and retry convergence is unresolved work item A5, so NOTHING here proves database/runtime append or retry behavior.
//
// Symbolic `vec:*` event ids are vector-local labels, not UUIDs. They are translated to deterministic v4 UUIDs ONLY in this
// harness; production code keeps strict UUID parsing. Selector failures (unknown op/claim/snapshot/order, unresolved event
// references) are HARNESS failures (SelectorError), never domain rejections.
import { createHash } from "node:crypto";

import {
  ClaimStateError,
  frozenStateHash,
  parseClaimStateEvent,
  reduceClaimState,
  sameEvent,
  type ClaimStateEvent,
  type UsageClass,
} from "../../src/knowledge/claim-state.js";
import { checkCursor } from "../../src/knowledge/state-cursor.js";

type Obj = Record<string, unknown>;

export class SelectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SelectorError";
  }
}

export function vectorUuid(label: unknown): unknown {
  if (typeof label !== "string" || !label.startsWith("vec:")) return label;
  const h = createHash("sha256").update(`vec-label:${label}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);
function obj(v: unknown, what: string): Obj {
  if (!isObj(v)) throw new SelectorError(`${what} is not an object`);
  return v;
}
function list(v: unknown, what: string): unknown[] {
  if (!Array.isArray(v)) throw new SelectorError(`${what} is not an array`);
  return v as unknown[];
}
function text(v: unknown, what: string): string {
  if (typeof v !== "string") throw new SelectorError(`${what} is not a string`);
  return v;
}

const EVENT_KEYS = [
  "claim_state_event_id",
  "claim_id",
  "actor_id",
  "occurred_at",
  "event_type",
  "event_sequence",
  "event_payload",
];

/** Translates vector-local ids in an event row (ids only; every other value passes through untouched, lexical markers included). */
export function translateRow(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  return { ...raw, claim_state_event_id: vectorUuid(raw.claim_state_event_id) };
}

class ModelReject extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export interface VectorClaim {
  claim_content_hash: string;
  initial_status: string;
  initial_usage_class: string;
}

/** Offline model of claim-local append rules and retry identity (NOT database or runtime proof). */
export class OfflineClaimLog {
  readonly byClaim = new Map<string, ClaimStateEvent[]>();
  readonly byId = new Map<string, ClaimStateEvent>();
  constructor(readonly claims: Record<string, VectorClaim>) {
    for (const id of Object.keys(claims)) this.byClaim.set(id, []);
  }

  events(claimId: string): ClaimStateEvent[] {
    return [...(this.byClaim.get(claimId) ?? [])];
  }
  all(): ClaimStateEvent[] {
    return [...this.byId.values()];
  }

  append(rawIn: unknown): "appended" | "converged" {
    const raw = translateRow(rawIn);
    if (
      !isObj(raw) ||
      Object.keys(raw).sort().join() !== [...EVENT_KEYS].sort().join()
    )
      throw new ModelReject("invalid_event_shape");
    if (typeof raw.claim_id !== "string" || !this.byClaim.has(raw.claim_id))
      throw new ModelReject("wrong_claim");
    let event: ClaimStateEvent;
    try {
      event = parseClaimStateEvent(raw);
    } catch (error) {
      if (error instanceof ClaimStateError) throw new ModelReject(error.code);
      throw error;
    }
    const prior = this.byId.get(event.claim_state_event_id);
    if (prior) {
      if (sameEvent(prior, event)) return "converged";
      if (
        prior.claim_id !== event.claim_id ||
        canonicalPayload(prior) !== canonicalPayload(event) ||
        prior.event_type !== event.event_type
      )
        throw new ModelReject("duplicate_event_identity_conflict");
      throw new ModelReject("retry_duplicate_transition");
    }
    const log = this.byClaim.get(event.claim_id) ?? [];
    const max = Math.max(0, ...log.map((e) => e.event_sequence));
    if (log.some((e) => e.event_sequence === event.event_sequence))
      throw new ModelReject("duplicate_sequence");
    if (log.length === 0 && event.event_sequence !== 1)
      throw new ModelReject("first_sequence_not_one");
    if (log.length > 0 && event.event_sequence <= max)
      throw new ModelReject("not_monotonic");
    log.push(event);
    this.byClaim.set(event.claim_id, log);
    this.byId.set(event.claim_state_event_id, event);
    return "appended";
  }
}

const canonicalPayload = (e: ClaimStateEvent): string =>
  JSON.stringify(Object.entries(e.event_payload).sort());

const CLAIM_OPS = new Set([
  "append",
  "reduce",
  "frozen_hash",
  "snapshot",
  "cursor",
]);
const REDUCE_ORDERS = new Set([
  "sequence",
  "reverse_json",
  "reverse_uuid",
  "reverse_time",
]);
const USAGE = new Set(["assertable", "hedged_only", "silent"]);

/** Static selector check BEFORE a vector executes; every failure is a harness failure. */
export function preflight(
  vector: Obj,
  claims: Record<string, VectorClaim>,
): void {
  const snapshots = new Map<string, Set<string>>();
  const ids = new Set<string>();
  list(vector.steps, "steps").forEach((raw, index) => {
    const n = index + 1;
    const step = obj(raw, `step ${String(n)}`);
    const op = step.op;
    if (typeof op !== "string" || !CLAIM_OPS.has(op))
      throw new SelectorError(
        `step ${String(n)}: unknown op ${JSON.stringify(op)}`,
      );
    if (!Object.hasOwn(step, "expect"))
      throw new SelectorError(`step ${String(n)}: no declared expectation`);
    if (op === "append") {
      const event = step.event;
      if (!isObj(event) || !Object.hasOwn(event, "claim_state_event_id"))
        throw new SelectorError(`step ${String(n)}: append has no event row`);
      if (typeof step.expect === "string" && step.expect.startsWith("ok"))
        ids.add(text(event.claim_state_event_id, "event id"));
      return;
    }
    if (typeof step.claim !== "string" || !Object.hasOwn(claims, step.claim))
      throw new SelectorError(
        `step ${String(n)}: claim ${JSON.stringify(step.claim)} is not a declared vector claim`,
      );
    if (op === "snapshot") {
      if (typeof step.name !== "string" || snapshots.has(step.name))
        throw new SelectorError(
          `step ${String(n)}: snapshot name missing or reused`,
        );
      snapshots.set(step.name, new Set(ids));
    } else if (op === "reduce") {
      if (
        Object.hasOwn(step, "order") &&
        (typeof step.order !== "string" || !REDUCE_ORDERS.has(step.order))
      )
        throw new SelectorError(`step ${String(n)}: unknown order`);
      if (
        Object.hasOwn(step, "ceiling") &&
        (typeof step.ceiling !== "string" || !USAGE.has(step.ceiling))
      )
        throw new SelectorError(`step ${String(n)}: unknown ceiling`);
      if (
        Object.hasOwn(step, "through") &&
        !(
          typeof step.through === "number" && Number.isSafeInteger(step.through)
        )
      )
        throw new SelectorError(`step ${String(n)}: through is not an integer`);
    } else if (op === "cursor") {
      if (
        Object.hasOwn(step, "visible") &&
        (typeof step.visible !== "string" || !snapshots.has(step.visible))
      )
        throw new SelectorError(
          `step ${String(n)}: visible snapshot was not taken earlier`,
        );
      const pool =
        typeof step.visible === "string"
          ? (snapshots.get(step.visible) ?? new Set<string>())
          : ids;
      const refs = [
        ...asIds(step.prefix),
        ...asIds(step.prefix_dup),
        ...Object.keys(isObj(step.prefix_edit) ? step.prefix_edit : {}),
        ...asIds(step.visible_drop),
        ...asIds(step.visible_dup),
        ...Object.keys(isObj(step.visible_edit) ? step.visible_edit : {}),
      ];
      for (const ref of refs)
        if (!ids.has(ref))
          throw new SelectorError(
            `step ${String(n)}: referenced event id ${ref} was never accepted by this vector`,
          );
      for (const ref of [
        ...asIds(step.visible_drop),
        ...asIds(step.visible_dup),
        ...Object.keys(isObj(step.visible_edit) ? step.visible_edit : {}),
      ])
        if (!pool.has(ref))
          throw new SelectorError(
            `step ${String(n)}: ${ref} is not in the visibility set it is edited in`,
          );
    }
  });
}
const asIds = (v: unknown): string[] =>
  Array.isArray(v) ? (v as unknown[]).map((x) => text(x, "event id")) : [];

export interface VectorOutcome {
  id: string;
  ok: boolean;
  failure?: string;
  /** Every string expectation this vector exercised (for coverage accounting). */
  expectations: string[];
}

const stable = (v: unknown): string =>
  JSON.stringify(v, (_key, value: unknown) =>
    isObj(value)
      ? Object.fromEntries(
          Object.entries(value).sort(([x], [y]) =>
            x < y ? -1 : x > y ? 1 : 0,
          ),
        )
      : value,
  );

/** Runs one vector. Throws SelectorError for selector failures; domain mismatches are reported in the outcome. */
export function runVector(
  vectorIn: unknown,
  claims: Record<string, VectorClaim>,
): VectorOutcome {
  const vector = obj(vectorIn, "vector");
  const id = text(vector.id, "vector id");
  preflight(vector, claims);
  const model = new OfflineClaimLog(claims);
  const snapshots = new Map<string, ClaimStateEvent[]>();
  const expectations: string[] = [];
  let stepNumber = 0;
  for (const raw of list(vector.steps, "steps")) {
    stepNumber += 1;
    const step = obj(raw, "step");
    const op = text(step.op, "op");
    const want = step.expect;
    expectations.push(typeof want === "string" ? want : "<object>");
    let got: unknown;
    try {
      if (op === "append") {
        got = `ok:${model.append(step.event)}`;
      } else if (op === "reduce") {
        const claimId = text(step.claim, "claim");
        let events = model.events(claimId);
        if (step.order === "reverse_json") events = [...events].reverse();
        else if (step.order === "reverse_uuid")
          events = [...events].sort((a, b) =>
            b.claim_state_event_id.localeCompare(a.claim_state_event_id),
          );
        else if (step.order === "reverse_time")
          events = [...events].sort(
            (a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at),
          );
        const claim = obj(claims[claimId], "claim");
        const reduced = reduceClaimState(
          {
            claim_id: claimId,
            initial_status: claim.initial_status,
            initial_usage_class: claim.initial_usage_class,
          },
          events,
          {
            ceiling: (step.ceiling ?? "assertable") as UsageClass,
            ...(typeof step.through === "number"
              ? { through: step.through }
              : {}),
          },
        );
        got = Object.fromEntries(
          Object.keys(obj(want, "expect")).map((k) => [
            k,
            (reduced as unknown as Obj)[k],
          ]),
        );
      } else if (op === "frozen_hash") {
        const claimId = text(step.claim, "claim");
        const claim = obj(claims[claimId], "claim");
        const reduced = reduceClaimState(
          {
            claim_id: claimId,
            initial_status: claim.initial_status,
            initial_usage_class: claim.initial_usage_class,
          },
          model.events(claimId),
          {
            ceiling: (step.ceiling ?? "assertable") as UsageClass,
            ...(typeof step.through === "number"
              ? { through: step.through }
              : {}),
          },
        );
        got = frozenStateHash(text(claim.claim_content_hash, "hash"), reduced);
      } else if (op === "snapshot") {
        snapshots.set(
          text(step.name, "name"),
          model.events(text(step.claim, "claim")),
        );
        got = "ok";
      } else {
        const claimId = text(step.claim, "claim");
        const original =
          typeof step.visible === "string"
            ? [...(snapshots.get(step.visible) ?? [])]
            : model.events(claimId);
        const rows = new Map(original.map((e) => [e.claim_state_event_id, e]));
        const edit = (
          row: ClaimStateEvent,
          changes: unknown,
        ): ClaimStateEvent =>
          parseClaimStateEvent({ ...row, ...obj(changes, "edit") });
        let visible = [...original];
        for (const [eid, changes] of Object.entries(
          obj(step.visible_edit ?? {}, "visible_edit"),
        )) {
          const target = vectorUuid(eid);
          visible = visible.map((e) =>
            e.claim_state_event_id === target ? edit(e, changes) : e,
          );
        }
        const dropped = new Set(
          asIds(step.visible_drop).map((x) => vectorUuid(x)),
        );
        visible = visible.filter((e) => !dropped.has(e.claim_state_event_id));
        for (const eid of asIds(step.visible_dup)) {
          const target = vectorUuid(eid);
          const found = visible.find((e) => e.claim_state_event_id === target);
          if (found) visible.push(found);
        }
        const base = new Map(visible.map((e) => [e.claim_state_event_id, e]));
        let prefix: ClaimStateEvent[] = [];
        if (Object.hasOwn(step, "prefix")) {
          prefix = asIds(step.prefix).map((x) => {
            const target = vectorUuid(x) as string;
            const row =
              base.get(target) ?? rows.get(target) ?? model.byId.get(target);
            if (!row) throw new SelectorError(`prefix event ${x} unresolved`);
            return row;
          });
        } else prefix = [...visible];
        for (const [eid, changes] of Object.entries(
          obj(step.prefix_edit ?? {}, "prefix_edit"),
        )) {
          const target = vectorUuid(eid);
          prefix = prefix.map((e) =>
            e.claim_state_event_id === target ? edit(e, changes) : e,
          );
        }
        for (const eid of asIds(step.prefix_dup)) {
          const target = vectorUuid(eid);
          const found = prefix.find((e) => e.claim_state_event_id === target);
          if (found) prefix.push(found);
        }
        // only the cursor's event id is symbolic (translateRow translates its claim_state_event_id key)
        const cursor = isObj(step.cursor)
          ? translateRow(step.cursor)
          : step.cursor;
        checkCursor({
          claimId,
          cursor,
          accepted: model.all(),
          visible,
          prefix,
        });
        got = "ok:True";
      }
    } catch (error) {
      if (error instanceof ModelReject) got = `reject:${error.code}`;
      else if (error instanceof ClaimStateError) got = `reject:${error.code}`;
      else throw error;
    }
    if (stable(got) !== stable(want))
      return {
        id,
        ok: false,
        failure: `step ${String(stepNumber)} (${op}): expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`,
        expectations,
      };
  }
  return { id, ok: true, expectations };
}
