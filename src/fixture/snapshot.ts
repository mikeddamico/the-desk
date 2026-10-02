// The verified snapshot: the ONLY thing persistence inserts. It is built from a verified pack, verified here (shipped copies
// and every A1 hash/binding), deep-frozen and digested, so nothing can change between verification and insertion and no
// caller-supplied "verified" report can stand in for verification.
import { createHash } from "node:crypto";

import { canonicalJson } from "../identity/canonical-json.js";
import type { Pack } from "./pack.js";
import { deepFreeze, parseFoundationRows, type FixtureRows } from "./rows.js";
import {
  buildContext,
  verifyRows,
  verifyShippedCopies,
  type FixtureContext,
} from "./verify.js";

export class VerifiedFixture {
  readonly rows: FixtureRows;
  readonly context: FixtureContext;
  readonly digest: string;
  readonly historical: { artifactId: string; contentHash: string };
  private constructor(
    rows: FixtureRows,
    context: FixtureContext,
    historical: VerifiedFixture["historical"],
  ) {
    this.rows = rows;
    this.context = context;
    this.historical = historical;
    this.digest = VerifiedFixture.digestOf(rows);
    Object.freeze(this);
  }
  static digestOf(rows: FixtureRows): string {
    return createHash("sha256")
      .update(canonicalJson(rows.tables))
      .digest("hex");
  }
  /** Parses, verifies and freezes. Throws FixtureIntegrityError / FixtureVerificationError / A1 rejections. */
  static fromPack(pack: Pack): VerifiedFixture {
    const rows = deepFreeze(parseFoundationRows(pack));
    const context = buildContext(pack);
    verifyShippedCopies(rows.tables, context);
    verifyRows(rows.tables, context, pack.pins.historicalDirection);
    return new VerifiedFixture(rows, context, pack.pins.historicalDirection);
  }
  /** Re-checks the frozen snapshot immediately before insertion. */
  assertUnchanged(): void {
    if (VerifiedFixture.digestOf(this.rows) !== this.digest)
      throw new Error("verified fixture snapshot changed after verification");
  }
}
