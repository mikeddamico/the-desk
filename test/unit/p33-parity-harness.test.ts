import { expect, it } from "vitest";
import { checkP33Harness } from "../support/p33-parity-runner.js";

// Controls are a separate focused prerequisite, not new native parity vectors.
// Ordinary suite discovery must not execute them without their guard profile.
const focused = process.env.DESK_P33_PROFILE === "focused";
if (focused) {
  it("P33 harness normal completion and settlement", async () => {
    const r = await checkP33Harness("complete");
    expect(r.outcome).toBe("COMPLETED");
    expect([r.settled, r.noChildren, r.complete]).toEqual([true, true, true]);
    expect(r.reaped.map((x) => x.exit)).toEqual([0]);
    expect(r.controls).toHaveLength(1);
    expect(r.reaped.map((x) => x.pid)).toEqual(r.controls);
  });
  it("P33 harness deadline is a contained rejection", async () => {
    const r = await checkP33Harness("noncomplete");
    expect(r.outcome).toBe("CONTAINED_REJECTION");
    expect(r.reason).toBe("deadline");
    expect([r.settled, r.noChildren, r.complete]).toEqual([true, true, true]);
    expect(r.controls).toHaveLength(2);
    expect(r.reaped.map((x) => x.pid).sort()).toEqual([...r.controls].sort());
    expect(r.reaped.map((x) => x.exit)).toEqual([-9, -9]);
  });
}
