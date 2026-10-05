// G3-prep wiring proof that is BASELINE-COMPATIBLE: it imports only modules that exist on the pre-G3 main and passes the observer context as
// an extra argument / option that the pre-G3 code ignores. Run against the pre-G3 main it therefore EXECUTES the old behavior: every domain
// operation below still succeeds, the domain assertions PASS, and the event assertions FAIL with zero events. Run against the G3-prep
// candidate every assertion passes. (The real-pino / canary / durability proofs are in a6-command-observability.test.ts.)
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { evidenceBodyHash } from "../../src/identity/domains.js";
import { appendClaimStateEvent } from "../../src/runtime/claim-events.js";
import { persistEvidenceUnit } from "../../src/runtime/evidence.js";
import {
  bindPackage,
  persistEvidencePackage,
} from "../../src/runtime/package.js";
import {
  executeProviderCall,
  recordProviderOutcome,
  reserveProviderCall,
} from "../../src/runtime/provider.js";
import { runEvidenceSlice } from "../../src/runtime/slice.js";
import {
  accountIds,
  attemptIds,
  claimIds,
  fixturePackageArtifact,
  fixtureUnits,
  prepareUnitsAndSupports,
  sliceInput,
} from "../support/a5-fixture.js";
import {
  nonNetworkControls,
  durableAdapter,
  finishSucceeded,
  outcome,
  providerEnv,
  reservation,
} from "../support/a5-provider.js";
import { TestCluster } from "../support/db-env.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const cluster = databaseUrl ? new TestCluster(databaseUrl) : undefined;
const must = <T>(v: T | undefined | null): T => {
  if (v === undefined || v === null) throw new Error("missing");
  return v;
};
if (cluster) {
  beforeAll(async () => {
    await cluster.bootstrap();
  }, 120000);
  afterAll(async () => {
    await cluster.shutdown();
  });
}

suite("G3-prep wiring (baseline-compatible)", () => {
  it("every operation really SUCCEEDS with the expected outcome, and each command/workflow emits exactly the expected number of events", async () => {
    if (!cluster || !databaseUrl) throw new Error("no cluster");
    const pe = await providerEnv(cluster, databaseUrl);
    const pool = pe.runtime();
    try {
      await prepareUnitsAndSupports(pe.env.migrator, pool);
      const events: unknown[] = [];
      const observer = (e: unknown): void => {
        events.push(e);
      };
      // an extra argument / option the pre-G3 code ignores
      const ctx = () => ({
        correlationId: randomUUID(),
        stage: "standalone" as const,
        observer,
      });
      const wctx = () => ({ correlationId: randomUUID(), observer });

      const units = fixtureUnits().length;
      const unit0 = must(fixtureUnits()[0]);
      const claim = must(claimIds()[0]);
      const actor = must(accountIds()[1]);
      const attempt = must(attemptIds()[0]);
      const pkg = fixturePackageArtifact();
      const CANARY_BODY = "CANARY_WIRING_BODY_3c9d1e";
      const CANARY_REASON = "CANARY_WIRING_REASON_88af";
      const CANARY_USAGE = "CANARY_WIRING_USAGE_4b21";
      const canaryId = randomUUID();
      const canaryUnit = (body: string) => ({
        unit: {
          ...unit0.unit,
          evidence_unit_id: canaryId,
          canonical_content: body,
          content_hash: evidenceBodyHash(body),
          supersedes_evidence_unit_id: null,
        },
        rights: unit0.rights,
      });
      const eventId = randomUUID();
      const r = reservation(pe.attempt);
      const r2 = reservation(pe.attempt);
      const adapter = durableAdapter(pe.env.owner, { lookup: true });

      interface Op {
        name: string;
        expectResult: string;
        expectEvents: number;
        run: () => Promise<string>;
      }
      const kind = async (p: Promise<{ kind: string }>): Promise<string> =>
        (await p).kind;
      const ops: Op[] = [
        {
          name: "evidence_unit.persist (existing)",
          expectResult: "converged",
          expectEvents: 1,
          run: () => kind(persistEvidenceUnit(pool, unit0, ctx())),
        },
        {
          name: "evidence_unit.persist (invalid uuid)",
          expectResult: "rejected",
          expectEvents: 1,
          run: () =>
            kind(
              persistEvidenceUnit(
                pool,
                {
                  ...unit0,
                  unit: { ...unit0.unit, evidence_unit_id: "not-a-uuid" },
                },
                ctx(),
              ),
            ),
        },
        {
          name: "evidence_unit.persist (new canary body)",
          expectResult: "created",
          expectEvents: 1,
          run: () =>
            kind(persistEvidenceUnit(pool, canaryUnit(CANARY_BODY), ctx())),
        },
        {
          name: "evidence_unit.persist (changed body)",
          expectResult: "conflict",
          expectEvents: 1,
          run: () =>
            kind(
              persistEvidenceUnit(
                pool,
                canaryUnit("CANARY_WIRING_BODY_CHANGED_77"),
                ctx(),
              ),
            ),
        },
        {
          name: "claim_event.append",
          expectResult: "created",
          expectEvents: 1,
          run: () =>
            kind(
              appendClaimStateEvent(
                pool,
                {
                  claim_state_event_id: eventId,
                  claim_id: claim,
                  actor_id: actor,
                  occurred_at: "2026-09-27T13:30:00.123456Z",
                  event_type: "usage_change",
                  event_sequence: 1,
                  event_payload: {
                    reason_code: "synthetic",
                    reason: CANARY_REASON,
                    usage_class: "silent",
                  },
                },
                ctx(),
              ),
            ),
        },
        {
          name: "evidence_package.persist",
          expectResult: "created",
          expectEvents: 1,
          run: () =>
            kind(persistEvidencePackage(pool, pkg, { context: ctx() })),
        },
        {
          name: "package.bind",
          expectResult: "created",
          expectEvents: 1,
          run: () =>
            kind(
              bindPackage(pool, {
                attemptId: attempt,
                evidencePackageId: pkg.evidence_package_id,
                context: ctx(),
              }),
            ),
        },
        {
          name: "provider_call.reserve",
          expectResult: "created",
          expectEvents: 1,
          run: () => kind(reserveProviderCall(pool, r, ctx())),
        },
        {
          name: "provider_outcome.record",
          expectResult: "created",
          expectEvents: 1,
          run: () =>
            kind(
              recordProviderOutcome(
                pool,
                outcome(r.provider_call_id, {
                  usage: { canary: CANARY_USAGE },
                  response_reference: "CANARY_WIRING_REF",
                }),
                ctx(),
              ),
            ),
        },
        // workflows: S1 units converged + S2 package converged + S3 bind created (n + 2 command events) + 1 workflow event
        {
          name: "evidence_slice.run",
          expectResult: "complete",
          expectEvents: units + 3,
          run: async () =>
            (await runEvidenceSlice(pool, sliceInput(1), wctx())).complete
              ? "complete"
              : "incomplete",
        },
        // reserve + record + 1 workflow event
        {
          name: "provider_call.execute",
          expectResult: "performed",
          expectEvents: 3,
          run: async () =>
            (
              await executeProviderCall(
                pool,
                r2,
                adapter,
                finishSucceeded(r2.provider_call_id),
                wctx(),
                nonNetworkControls(),
              )
            ).status,
        },
      ];

      const results: string[] = [];
      const deltas: number[] = [];
      for (const op of ops) {
        const before = events.length;
        results.push(await op.run());
        deltas.push(events.length - before);
      }

      // 1. DOMAIN SUCCESS, independent of any event: the operations did what they were asked (this passes on the pre-G3 main too)
      expect(
        results,
        `domain results by operation: ${ops.map((o) => o.name).join(" | ")}`,
      ).toEqual(ops.map((o) => o.expectResult));
      expect(
        (
          await pe.rows(
            "SELECT canonical_content #>> '{}' AS body FROM evidence_units WHERE evidence_unit_id = $1",
            [canaryId],
          )
        )[0],
      ).toEqual({ body: CANARY_BODY });
      expect(
        JSON.stringify(
          (
            await pe.rows(
              "SELECT event_payload FROM claim_state_events WHERE claim_state_event_id = $1",
              [eventId],
            )
          )[0],
        ),
      ).toContain(CANARY_REASON);
      expect(
        JSON.stringify(
          (
            await pe.rows(
              "SELECT usage FROM provider_call_events WHERE provider_call_id = $1",
              [r.provider_call_id],
            )
          )[0],
        ),
      ).toContain(CANARY_USAGE);
      expect(
        (
          await pe.rows(
            "SELECT evidence_package_id::text AS bound FROM program_run_attempts WHERE attempt_id = $1",
            [attempt],
          )
        )[0],
      ).toEqual({ bound: pkg.evidence_package_id });
      console.log(
        `G3 wiring: domain operations succeeded (${String(results.length)}); events observed: ${String(events.length)}; per-operation: ${deltas.join(",")}`,
      );

      // 2. OBSERVABILITY: nonzero, exactly one event per primitive command, the documented counts for the workflows (FAILS on the pre-G3 main)
      expect(events.length, "the observer received events").toBeGreaterThan(0);
      expect(
        deltas,
        `events per operation: ${ops.map((o) => o.name).join(" | ")}`,
      ).toEqual(ops.map((o) => o.expectEvents));

      // 3. non-vacuous privacy check over the events themselves: no body/payload/usage canary and no hostile text
      const text = JSON.stringify(events);
      for (const needle of [
        CANARY_BODY,
        "CANARY_WIRING_BODY_CHANGED_77",
        CANARY_REASON,
        CANARY_USAGE,
        "CANARY_WIRING_REF",
        "Ignore all previous instructions",
      ])
        expect(text.includes(needle), `events must not contain ${needle}`).toBe(
          false,
        );
    } finally {
      await pe.close();
    }
  }, 240000);
});
