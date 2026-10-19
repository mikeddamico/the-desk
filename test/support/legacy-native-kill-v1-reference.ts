// DESK-LEGACY-NATIVE-KILL-v1.0.0-reference; independent original plus uniform SIGKILL.
// Authority: docs/amendments/technical-compatibility-authority-2026-10-19.md
// Historical literal: history/legacy-per-member-original.ts.txt; never imported from subject.
import { Buffer } from "node:buffer";
import * as child from "node:child_process";

class OriginalFixtureIntegrityError extends Error {
  readonly code: string;
  constructor(code: string, detail = "") {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "FixtureIntegrityError";
    this.code = code;
  }
}
// Based on the frozen original reader; this is an explicit policy revision, not unchanged original
// 7268 /3e14621f888f2d10e5618833fa93d34e2685c64c1298ca070d0bcc550a52a793.
export function revisedLegacyRead(
  path: string,
  name: string,
  maxBytes: number,
): Buffer {
  if (
    !/^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(name) ||
    name.split("/").includes("..")
  )
    throw new OriginalFixtureIntegrityError("unsafe_member_name", name);
  try {
    return child.execFileSync("unzip", ["-p", path, name], {
      maxBuffer: maxBytes + 1,
      killSignal: "SIGKILL",
    });
  } catch (error) {
    throw new OriginalFixtureIntegrityError(
      "member_read_failed",
      `${name}: ${(error as Error).message.slice(0, 120)}`,
    );
  }
}
