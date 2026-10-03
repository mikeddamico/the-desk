// Test support for G3-prep: the three workflow entry points now REQUIRE a declared observer context. Existing (pre-G3) tests that are not
// about observability use these wrappers with a no-op observer, so their subject matter and assertions are unchanged.
import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

import type {
  ObserverContext,
  CommandEvent,
} from "../../src/runtime/observe.js";
import {
  executeProviderCall,
  reconcileProviderCall,
  type AuthoredOutcome,
  type AuthoredReservation,
  type LookupAdapter,
  type SideEffectAdapter,
} from "../../src/runtime/provider.js";
import { runEvidenceSlice, type SliceInput } from "../../src/runtime/slice.js";

export const noopContext = (): ObserverContext => ({
  correlationId: randomUUID(),
  observer: () => undefined,
});

/** A context that records every event (frozen copies, so a test cannot be fooled by later mutation). */
export function capturingContext(): {
  context: ObserverContext;
  events: CommandEvent[];
} {
  const events: CommandEvent[] = [];
  return {
    context: {
      correlationId: randomUUID(),
      observer: (e) => {
        events.push(Object.freeze({ ...e }));
      },
    },
    events,
  };
}

export const runSliceObserved = (pool: Pool, input: SliceInput) =>
  runEvidenceSlice(pool, input, noopContext());

export const executeObserved = <R>(
  pool: Pool,
  reservation: AuthoredReservation,
  adapter: SideEffectAdapter<R>,
  finish: (result: R) => AuthoredOutcome,
) => executeProviderCall(pool, reservation, adapter, finish, noopContext());

export const reconcileObserved = <R>(
  pool: Pool,
  args: {
    providerCallId: string;
    adapter: LookupAdapter<R>;
    finish?: (result: R) => AuthoredOutcome;
  },
) => reconcileProviderCall(pool, args, noopContext());
