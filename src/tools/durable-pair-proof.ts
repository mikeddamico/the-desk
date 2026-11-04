import { writeSync } from "node:fs";
import { withTransportDiagnostics } from "../runtime/durable-pair-diagnostics.js";
import { canonicalJson } from "../identity/canonical-json.js";
import {
  readDurableSyntheticPair,
  reconcileDurableSyntheticPair,
  storeDurableSyntheticPair,
} from "../runtime/durable-pair.js";

const PROFILES = {
  write: "durable-pair-writer/1",
  read: "durable-pair-readback/1",
  reconcile: "durable-pair-readback/1",
} as const;

type CommandMode = keyof typeof PROFILES;

function writePreEntryStop(mode: CommandMode | null): void {
  process.stdout.write(
    canonicalJson({
      status: "stopped",
      profile: mode ? PROFILES[mode] : "durable-pair-cli/1",
      operation_id: null,
      code: "invalid_invocation",
      phase: "invocation",
      sql_outcome: "not_started",
      storage_outcome: "not_started",
      cleanup: "not_started",
    }) + "\n",
  );
  process.exitCode = 1;
}

function writePostEntryUnexpectedStop(
  mode: CommandMode,
  operationCandidate: string | null,
): void {
  process.stdout.write(
    canonicalJson({
      status: "stopped",
      profile: PROFILES[mode],
      operation_id: operationCandidate,
      code: "unexpected_failure",
      phase: mode === "write" ? "sql" : "readback",
      sql_outcome: "unknown",
      storage_outcome: "unknown",
      cleanup: "pending",
    }) + "\n",
  );
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const modeArg = process.argv[2];
  if (modeArg !== "write" && modeArg !== "read" && modeArg !== "reconcile") {
    writePreEntryStop(null);
    return;
  }

  if (modeArg === "write" && process.argv.length !== 5) {
    writePreEntryStop("write");
    return;
  }
  if (
    (modeArg === "read" || modeArg === "reconcile") &&
    process.argv.length !== 4
  ) {
    writePreEntryStop(modeArg);
    return;
  }

  const rawOpArg = process.argv[3];
  const safeOpEcho =
    typeof rawOpArg === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      rawOpArg,
    )
      ? rawOpArg
      : null;

  type TaggedCall = { ok: true; value: unknown } | { ok: false };

  let callOutcome: TaggedCall;
  try {
    let result: Readonly<Record<string, unknown>>;
    if (modeArg === "write") {
      result = await storeDurableSyntheticPair({
        operation_id: process.argv[3],
        created_at: process.argv[4],
      });
    } else if (modeArg === "read") {
      result = await readDurableSyntheticPair(process.argv[3]);
    } else {
      result = await reconcileDurableSyntheticPair(process.argv[3]);
    }
    callOutcome = { ok: true, value: result };
  } catch {
    callOutcome = { ok: false };
  }

  if (!callOutcome.ok) {
    writePostEntryUnexpectedStop(modeArg, safeOpEcho);
    return;
  }

  let serialized: string;
  try {
    const obj = callOutcome.value;
    if (typeof obj !== "object" || obj === null) {
      throw new Error("invalid_return");
    }
    serialized = canonicalJson(obj) + "\n";
    if (Reflect.get(obj, "status") === "stopped") {
      process.exitCode = 1;
    }
  } catch {
    writePostEntryUnexpectedStop(modeArg, safeOpEcho);
    return;
  }

  process.stdout.write(serialized);
}

await withTransportDiagnostics(
  main,
  process.env.DESK_DURABLE_PAIR_DIAGNOSTICS_DIR,
  (status) => {
    writeSync(
      2,
      canonicalJson({
        profile: "durable-pair-diagnostics-persistence/1",
        status,
      }) + "\n",
    );
  },
);
