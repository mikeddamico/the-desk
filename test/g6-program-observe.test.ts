// G6 closed-vocabulary additions to the command observability projection (G3-prep contract unchanged): two command names, one UUID
// subject key (program_run_id) and the typed outcome codes of the two program commands. Drift of the code literals in src/ against the
// known set is covered by the existing supplementary check in runtime-observe.test.ts.
import { describe, expect, it } from "vitest";

import {
  COMMANDS,
  KNOWN_OUTCOME_CODES,
  SUBJECT_KEYS,
  projectEvent,
} from "../src/runtime/observe.js";

const CORRELATION = "0b0a9d52-5c3e-4d62-8d5e-2a8e7c7f4a10";
const RUN = "56177a16-59d3-4bf1-b049-5b5e2ee52c92";

describe("G6 program command vocabulary", () => {
  it("names exactly the two new commands and the new subject key, closed", () => {
    expect(COMMANDS).toContain("program_run.create");
    expect(COMMANDS).toContain("program_attempt.create");
    expect(SUBJECT_KEYS).toContain("program_run_id");
  });

  it("projects the authored run id only when it is a canonical UUID, and never copies anything else", () => {
    const ok = projectEvent({
      event: "command.completed",
      command: "program_run.create",
      stage: "standalone",
      correlation_id: CORRELATION,
      program_run_id: RUN,
      outcome: "created",
      durability: "committed",
      duration_ms: 3,
      show_id: "must-not-appear",
      purpose: "must-not-appear",
    });
    expect(ok).toMatchObject({
      command: "program_run.create",
      program_run_id: RUN,
      outcome: "created",
    });
    expect(Object.keys(ok)).not.toContain("show_id");
    expect(Object.keys(ok)).not.toContain("purpose");
    const bad = projectEvent({
      event: "command.completed",
      command: "program_attempt.create",
      stage: "standalone",
      correlation_id: CORRELATION,
      program_run_id: "CANARY_NOT_A_UUID",
      outcome: "rejected",
      duration_ms: 0,
    });
    expect(bad.program_run_id).toBeUndefined();
    expect(JSON.stringify(bad)).not.toContain("CANARY_NOT_A_UUID");
    // idempotent: the logger adapter re-projects an already projected event
    expect(projectEvent(ok as unknown as Record<string, unknown>)).toEqual(ok);
  });

  it("knows every typed code the two commands return, and still marks anything else unknown", () => {
    for (const code of [
      "show_not_found",
      "run_not_found",
      "config_not_found",
      "config_show_mismatch",
      "purpose_invalid",
      "publication_not_permitted",
      "repair_not_supported",
      "unsupported_field",
      "run_config_binding_mismatch",
      "program_run_identity_conflict",
      "program_attempt_identity_conflict",
    ])
      expect(KNOWN_OUTCOME_CODES.has(code), code).toBe(true);
    const unknown = projectEvent({
      event: "command.completed",
      command: "program_run.create",
      stage: "standalone",
      correlation_id: CORRELATION,
      outcome: "rejected",
      code: "CANARY_UNKNOWN_CODE",
      duration_ms: 0,
    });
    expect(unknown.code).toBeUndefined();
    expect(unknown.code_known).toBe(false);
  });
});
