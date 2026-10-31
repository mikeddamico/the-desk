/** Fixed synthetic store/fresh-reader connection. SQL receipt visibility never grants a technical gate or lifecycle transition. */
import { deepFreeze } from "../fixture/rows.js";
import {
  acquireSubject,
  readOwned,
  type Acquired,
} from "./technical-master-acquisition.js";
import {
  retainAssessedSyntheticMaster,
  assertRetainedTechnicalMaster,
  type RetainedTechnicalMaster,
} from "./technical-master-admission.js";
import { sha, TechnicalRefusal, type Data } from "./technical-master-checks.js";
import {
  registeredPair,
  pairSettings,
  type RegisteredPair,
} from "./durable-pair-binding.js";
import {
  openPairOwner,
  readPairIntent,
  readOptionalPairIntent,
  type PairOwner,
} from "./durable-pair-owner.js";
import {
  readPairReceipt,
  preflightPairRows,
  commitPairRows,
} from "./durable-pair-sql.js";
import { putPairObject, getPairObject } from "./durable-pair-r2.js";
import {
  PairRefusal,
  requirePair,
  closed,
  authored,
  same,
  parsePairJson,
  jsonBytes,
  UPLOAD_ORDER,
  MANIFEST_SHA,
  graphFor,
  requestFor,
  receiptFor,
  receiptHash,
  storedSubject,
  verifyFixedFiles,
  verifyObservation,
  type PairReceipt,
  type ObjectIdentity,
  parseReceiptEnvelope,
  type PairPhase,
} from "./durable-pair-contract.js";

const WRITER = "durable-pair-writer/1";
const READER = "durable-pair-readback/1";
const active = new Set<string>();
let heldForCleanup = false;
const uncertain = new Map<
  string,
  {
    owner: PairOwner | undefined;
    capture: RetainedTechnicalMaster | Acquired | undefined;
  }
>();
// One unsettled owner blocks every entry, including read-only recovery, until separately reconciled ownership is reviewed.
function admitPairEntry(): void {
  if (heldForCleanup) throw new PairRefusal("cleanup_pending", "cleanup", true);
}

const MANIFEST = new URL(
  "../../fixtures/technical-master-admission/SOURCE-FILE-MANIFEST.json",
  import.meta.url,
);
async function pinnedManifest(): Promise<Data> {
  const bytes = await readOwned(MANIFEST, 65536);
  requirePair(sha(bytes) === MANIFEST_SHA, "source_mismatch", "source");
  return parsePairJson(bytes);
}
function expectedObject(
  receipt: PairReceipt,
  name: (typeof UPLOAD_ORDER)[number],
): ObjectIdentity {
  if (name === "receipt.json") {
    const bytes = jsonBytes(receipt);
    return { name, byte_length: String(bytes.length), raw_sha256: sha(bytes) };
  }
  const entry = receipt.request.objects.find((item) => item.name === name);
  requirePair(entry, "source_mismatch", "source");
  return entry;
}
async function downloaded(
  registration: RegisteredPair,
  receipt: PairReceipt,
  until: number,
): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  for (const name of UPLOAD_ORDER) {
    requirePair(performance.now() < until, "storage_timeout", "readback");
    files.set(
      name,
      await getPairObject(
        registration,
        receipt.request.operation_id,
        expectedObject(receipt, name),
      ),
    );
  }
  requirePair(
    files.get("receipt.json")?.equals(jsonBytes(receipt)),
    "storage_readback_invalid",
    "readback",
  );
  verifyFixedFiles(files, await pinnedManifest());
  const observation = parsePairJson(
    files.get("assessment.json") ?? Buffer.alloc(0),
  );
  verifyObservation(storedSubject(files), observation);
  const expected = receiptFor(
    requestFor(
      receipt.request.operation_id,
      receipt.request.created_at,
      files,
      registration,
    ),
  );
  requirePair(same(receipt, expected), "source_changed", "readback");
  return files;
}
function stopped(
  profile: string,
  operation: string | null,
  error: unknown,
  phase: PairPhase,
  sql: string,
  storage: string,
  cleanup: string,
): Readonly<Data> {
  const refusal = error instanceof PairRefusal ? error : undefined;
  if (refusal?.pending) heldForCleanup = true;
  return deepFreeze({
    status: "stopped",
    profile,
    operation_id: operation,
    code: refusal?.code ?? "unexpected_failure",
    phase: refusal?.phase ?? phase,
    sql_outcome: sql,
    storage_outcome: storage,
    cleanup,
  });
}
/** One authored operation. Existing receipts/intents are recovered before any assessment; unknown state never launches a replacement. */
export async function storeDurableSyntheticPair(
  input: unknown,
): Promise<Readonly<Data>> {
  let operation: string | null = null;
  let phase: PairPhase = "invocation";
  let owner: PairOwner | undefined;
  let acquired: Acquired | undefined;
  let lease: RetainedTechnicalMaster | undefined;
  let enteredAssessment = false;
  let pending = false;
  let sql = "not_started";
  let storage = "not_started";
  let primary: unknown;
  let success: Data | undefined;
  let hasLatch = false;
  try {
    const invocation = closed(input, ["operation_id", "created_at"]);
    const identity = authored(invocation.operation_id, invocation.created_at);
    operation = identity.operation_id;
    admitPairEntry();
    pairSettings();
    requirePair(!active.has(operation), "cleanup_pending", "cleanup");
    active.add(operation);
    hasLatch = true;
    phase = "binding";
    const registration = registeredPair();
    const deadline = performance.now() + 600000;
    const check = (): void => {
      pairSettings();
      requirePair(performance.now() < deadline, "storage_timeout", phase);
    };
    phase = "sql";
    const existing = await readPairReceipt(registration, operation, deadline);
    if (existing) {
      const receipt = parseReceiptEnvelope(existing, operation);
      requirePair(
        receipt.request.created_at === identity.created_at,
        "identity_conflict",
        "sql",
      );
      const saved = await readOptionalPairIntent(registration, operation);
      requirePair(
        !saved ||
          (same(saved.receipt, receipt) &&
            sha(jsonBytes(saved.assessment)) ===
              expectedObject(receipt, "assessment.json").raw_sha256),
        "identity_conflict",
        "source",
      );
      sql = "committed";
      phase = "readback";
      await downloaded(registration, receipt, deadline);
      check();
      storage = "verified";
      success = {
        status: "durable_synthetic_pair_converged",
        profile: WRITER,
        operation_id: operation,
        request_digest: receipt.request_digest,
        receipt_hash: receiptHash(receipt),
        authority: "none",
        synthetic_only: true,
        cleanup: "complete",
      };
    } else {
      phase = "source";
      owner = await openPairOwner(registration, operation, identity.created_at);
      acquired = await acquireSubject("synthetic60-positive");
      const files = new Map(acquired.snapshots);
      verifyFixedFiles(files, await pinnedManifest(), false);
      let receipt: PairReceipt;
      if (owner.intent) {
        receipt = parseReceiptEnvelope(owner.intent.receipt, operation);
        requirePair(
          owner.state.phase === "storage" || owner.state.phase === "finished",
          "source_mismatch",
          "source",
        );
        requirePair(
          owner.state.sql !== "pending" &&
            !Object.values(owner.state.objects).includes("pending"),
          "sql_outcome_unknown",
          "sql",
        );
        files.set("assessment.json", jsonBytes(owner.intent.assessment));
        verifyFixedFiles(files, await pinnedManifest());
        requirePair(
          same(
            receipt,
            receiptFor(
              requestFor(operation, identity.created_at, files, registration),
            ),
          ),
          "identity_conflict",
          "source",
        );
        await preflightPairRows(registration, receipt.request.rows, deadline);
      } else {
        requirePair(
          owner.fresh && owner.state.phase === "before_assessment",
          "cleanup_pending",
          "cleanup",
        );
        // Fixed SOURCE IDs and row/locator collisions are checked before the original assessment path hashes/adopts its map.
        await preflightPairRows(
          registration,
          graphFor(operation, identity.created_at, files, registration.storage),
          deadline,
        );
        owner.state.phase = "assessment_started";
        await owner.update();
        phase = "assessment";
        enteredAssessment = true;
        lease = await retainAssessedSyntheticMaster(acquired);
        assertRetainedTechnicalMaster(lease);
        files.set("assessment.json", jsonBytes(lease.observation));
        verifyFixedFiles(files, await pinnedManifest());
        receipt = receiptFor(
          requestFor(operation, identity.created_at, files, registration),
        );
        await owner.freeze({ receipt, assessment: lease.observation });
        owner.state.phase = "storage";
        await owner.update();
      }
      files.set("receipt.json", jsonBytes(receipt));
      phase = "upload";
      for (const name of UPLOAD_ORDER) {
        check();
        await acquired.recheck();
        verifyFixedFiles(files, await pinnedManifest());
        const bytes = files.get(name);
        const expected = expectedObject(receipt, name);
        requirePair(
          bytes &&
            String(bytes.length) === expected.byte_length &&
            sha(bytes) === expected.raw_sha256,
          "source_changed",
          "source",
        );
        if (owner.state.objects[name] !== "verified") {
          owner.state.objects[name] = "pending";
          await owner.update();
          storage = "unknown";
          await putPairObject(registration, operation, name, bytes);
        }
        const actual = await getPairObject(registration, operation, expected);
        requirePair(actual.equals(bytes), "object_conflict", "readback");
        owner.state.objects[name] = "verified";
        await owner.update();
        storage = "partial";
      }
      storage = "verified";
      phase = "source";
      await acquired.recheck();
      requirePair(
        same(
          receipt,
          receiptFor(
            requestFor(operation, identity.created_at, files, registration),
          ),
        ),
        "source_changed",
        "source",
      );
      check();
      phase = "sql";
      owner.state.sql = "pending";
      await owner.update();
      sql = "unknown";
      const committed = await commitPairRows(registration, receipt, deadline);
      sql = "committed";
      if (committed.cleanupPending)
        throw new PairRefusal("cleanup_pending", "cleanup", true);
      owner.state.sql = "committed";
      owner.state.phase = "finished";
      await owner.update();
      success = {
        status:
          committed.kind === "created"
            ? "durable_synthetic_pair_stored"
            : "durable_synthetic_pair_converged",
        profile: WRITER,
        operation_id: operation,
        request_digest: receipt.request_digest,
        receipt_hash: receiptHash(receipt),
        authority: "none",
        synthetic_only: true,
        cleanup: "complete",
      };
    }
  } catch (error) {
    primary =
      error instanceof TechnicalRefusal
        ? new PairRefusal("assessment_refused", phase, error.cleanupPending)
        : error;
    pending =
      primary instanceof PairRefusal &&
      (primary.pending || primary.code === "cleanup_pending");
    if (primary instanceof PairRefusal && primary.code === "sql_not_committed")
      sql = "not_committed";
  } finally {
    if (!pending) {
      try {
        if (lease) await lease.release();
        else if (acquired && !enteredAssessment) await acquired.cleanup();
      } catch {
        pending = true;
      }
    }
    if (owner) {
      try {
        await owner.close(!pending);
      } catch {
        pending = true;
      }
    }
    if (operation && hasLatch) {
      if (pending) {
        heldForCleanup = true;
        uncertain.set(operation, { owner, capture: lease ?? acquired });
      } else active.delete(operation);
    }
  }
  if (primary || pending || !success)
    return stopped(
      WRITER,
      operation,
      primary ?? new PairRefusal("cleanup_pending", "cleanup", true),
      phase,
      sql,
      storage,
      pending ? "pending" : owner ? "complete" : "not_started",
    );
  return deepFreeze(success);
}
/** Fresh DB connection and R2 client; no constructor, retained snapshot cache, or new acoustic inspection. */
export async function readDurableSyntheticPair(
  input: unknown,
): Promise<Readonly<Data>> {
  let operation: string | null = null;
  try {
    requirePair(typeof input === "string", "invalid_invocation", "invocation");
    operation = authored(input, "2000-01-01T00:00:00.000000Z").operation_id;
    admitPairEntry();
    pairSettings();
    const registration = registeredPair();
    const until = performance.now() + 300000;
    const found = await readPairReceipt(registration, operation, until);
    requirePair(found, "sql_conflict", "sql");
    const receipt = parseReceiptEnvelope(found, operation);
    await downloaded(registration, receipt, until);
    requirePair(performance.now() < until, "storage_timeout", "readback");
    pairSettings();
    return deepFreeze({
      status: "durable_synthetic_pair_readback_pass",
      profile: READER,
      operation_id: operation,
      request_digest: receipt.request_digest,
      receipt_hash: receiptHash(receipt),
      authority: "none",
      synthetic_only: true,
      authoritative_gate_result: false,
      lifecycle_validated: false,
      ready: false,
      production: false,
      selection_authority: "authored-synthetic-selection/1",
    });
  } catch (error) {
    return stopped(
      READER,
      operation,
      error,
      "readback",
      "unknown",
      "unknown",
      error instanceof PairRefusal && error.pending ? "pending" : "complete",
    );
  }
}
/** One explicitly requested read-only reconciliation sweep. Missing objects/receipt never authorize another PUT or assessment. */
export async function reconcileDurableSyntheticPair(
  input: unknown,
): Promise<Readonly<Data>> {
  let operation: string | null = null;
  try {
    requirePair(typeof input === "string", "invalid_invocation", "invocation");
    operation = authored(input, "2000-01-01T00:00:00.000000Z").operation_id;
    admitPairEntry();
    pairSettings();
    const registration = registeredPair();
    const until = performance.now() + 300000;
    const found = await readPairReceipt(registration, operation, until);
    if (found) {
      const receipt = parseReceiptEnvelope(found, operation);
      await downloaded(registration, receipt, until);
      requirePair(performance.now() < until, "storage_timeout", "readback");
      pairSettings();
      return deepFreeze({
        status: "durable_synthetic_pair_readback_pass",
        profile: READER,
        operation_id: operation,
        request_digest: receipt.request_digest,
        receipt_hash: receiptHash(receipt),
        authority: "none",
        synthetic_only: true,
        authoritative_gate_result: false,
        lifecycle_validated: false,
        ready: false,
        production: false,
        selection_authority: "authored-synthetic-selection/1",
      });
    }
    const intent = await readPairIntent(registration, operation);
    await downloaded(
      registration,
      parseReceiptEnvelope(intent.receipt, operation),
      until,
    );
    throw new PairRefusal("sql_outcome_unknown", "sql");
  } catch (error) {
    return stopped(
      READER,
      operation,
      error,
      "readback",
      "unknown",
      "unknown",
      error instanceof PairRefusal && error.pending ? "pending" : "complete",
    );
  }
}
