// Test support: deterministic claim-state event builders and fixture claim identities.
import { loadFoundationRows } from "../../src/fixture/loader.js";
import type { ClaimStateEvent } from "../../src/knowledge/claim-state.js";
import { parseClaimStateEvent } from "../../src/knowledge/claim-state.js";
import type { ClaimIdentity } from "../../src/knowledge/state-cursor.js";

export function must<T>(value: T | undefined | null, what = "value"): T {
  if (value === undefined || value === null) throw new Error(`Missing ${what}`);
  return value;
}

export const ACTOR = "d1250001-0000-4000-8000-000000000002";
export const uuid = (n: number): string =>
  `d1250077-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** The nine fixture claims (immutable rows of the pinned base load). */
export function fixtureClaims(): ClaimIdentity[] {
  return must(loadFoundationRows().tables.claims).map((c) => ({
    claim_id: String(c.claim_id),
    content_hash: String(c.content_hash),
    initial_status: c.initial_status,
    initial_usage_class: c.initial_usage_class,
  }));
}
export const claimWithUsage = (usage: string): ClaimIdentity =>
  must(fixtureClaims().find((c) => c.initial_usage_class === usage));

let counter = 1000;
export interface EventSpec {
  type: string;
  seq: number;
  claim: string;
  usage?: string;
  at?: string;
  id?: string;
  reason?: string;
}
export function rawEvent(spec: EventSpec): Record<string, unknown> {
  counter += 1;
  return {
    claim_state_event_id: spec.id ?? uuid(counter),
    claim_id: spec.claim,
    actor_id: ACTOR,
    occurred_at: spec.at ?? "2026-09-27T13:30:00Z",
    event_type: spec.type,
    event_sequence: spec.seq,
    event_payload: {
      reason_code: "synthetic_test",
      reason: spec.reason ?? "test event",
      ...(spec.usage ? { usage_class: spec.usage } : {}),
    },
  };
}
export const event = (spec: EventSpec): ClaimStateEvent =>
  parseClaimStateEvent(rawEvent(spec));
