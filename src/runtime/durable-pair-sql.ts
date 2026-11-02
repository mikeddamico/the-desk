/** Fixed existing-table visibility transaction; object I/O never occurs while this owner holds SQL locks. */
import pg from "pg";
import { TLSSocket, checkServerIdentity } from "node:tls";
import {
  runCommand,
  CommandConnectionError,
  commandCleanupErrors,
  type Tx,
} from "./command.js";
import {
  databasePassword,
  type RegisteredPair,
} from "./durable-pair-binding.js";
import {
  PairRefusal,
  requirePair,
  same,
  closed,
  receiptRow,
  parseReceiptEnvelope,
  type PairRows,
  type PairReceipt,
} from "./durable-pair-contract.js";
import type { Data } from "./technical-master-checks.js";

const ARTIFACT_SELECT = `SELECT artifact_id::text,artifact_type,schema_version,content_hash,storage_uri,byte_size::text,CASE WHEN octet_length(canonical_payload::text)<=65536 THEN canonical_payload ELSE null END AS canonical_payload,parent_artifact_id::text,supersedes_artifact_id::text,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at FROM public.artifacts`;
let pendingPool = false;
const PAIR_UNIQUE_CONSTRAINTS = new Set([
  "artifacts_pkey",
  "artifacts_artifact_type_content_hash_key",
  "audio_artifacts_pkey",
  "audio_artifacts_artifact_id_key",
  "audio_artifacts_audio_sha256_key",
  "assembly_recipes_pkey",
  "assembly_recipes_artifact_id_key",
  "master_assembly_maps_pkey",
  "master_assembly_maps_artifact_id_key",
]);
const FAMILIES = [
  "artifacts",
  "audio_artifacts",
  "assembly_recipes",
  "master_assembly_maps",
] as const;
const IDS = {
  artifacts: "artifact_id",
  audio_artifacts: "audio_artifact_id",
  assembly_recipes: "assembly_recipe_id",
  master_assembly_maps: "master_assembly_map_id",
} as const;
const SELECTS = {
  artifacts: ARTIFACT_SELECT,
  audio_artifacts:
    "SELECT audio_artifact_id::text,artifact_id::text,audio_sha256,duration_ms FROM public.audio_artifacts",
  assembly_recipes:
    "SELECT assembly_recipe_id::text,artifact_id::text,version FROM public.assembly_recipes",
  master_assembly_maps:
    "SELECT master_assembly_map_id::text,artifact_id::text,assembly_recipe_id::text,master_audio_artifact_id::text FROM public.master_assembly_maps",
} as const;
const COLUMNS = {
  artifacts: [
    "artifact_id",
    "artifact_type",
    "schema_version",
    "content_hash",
    "storage_uri",
    "byte_size",
    "canonical_payload",
    "parent_artifact_id",
    "supersedes_artifact_id",
    "created_at",
  ],
  audio_artifacts: [
    "audio_artifact_id",
    "artifact_id",
    "audio_sha256",
    "duration_ms",
  ],
  assembly_recipes: ["assembly_recipe_id", "artifact_id", "version"],
  master_assembly_maps: [
    "master_assembly_map_id",
    "artifact_id",
    "assembly_recipe_id",
    "master_audio_artifact_id",
  ],
} as const;
function withinBudget(tx: Tx, until: number): Tx {
  const check = (): void => {
    requirePair(
      Number.isFinite(until) && performance.now() < until,
      "storage_timeout",
      "sql",
    );
  };
  return {
    async query(text, values) {
      check();
      return tx.query(text, values);
    },
    async attempt(text, values) {
      check();
      return tx.attempt(text, values);
    },
  };
}
// This finite public schema projection is pinned by the authorized migration-reader attestation at binding release.
export const PAIR_CATALOG_SQL = `SELECT jsonb_build_object('columns',(SELECT jsonb_agg(jsonb_build_array(table_name,column_name,data_type,is_nullable) ORDER BY table_name,ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1::text[])), 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.relname,x.conname,pg_get_constraintdef(x.oid)) ORDER BY c.relname,x.conname) FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[])), 'triggers',(SELECT jsonb_agg(jsonb_build_array(c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid)) ORDER BY c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND NOT t.tgisinternal), 'privileges',(SELECT jsonb_agg(jsonb_build_array(name,has_table_privilege(current_user,'public.'||name,'SELECT'),has_table_privilege(current_user,'public.'||name,'INSERT'),has_table_privilege(current_user,'public.'||name,'UPDATE'),has_table_privilege(current_user,'public.'||name,'DELETE'),has_table_privilege(current_user,'public.'||name,'TRUNCATE')) ORDER BY name) FROM unnest($1::text[]) name), 'relations',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.oid::text) ORDER BY n.nspname,c.relname,c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[]))) AS facts`;

function sqlPool(registration: RegisteredPair): {
  pool: pg.Pool;
  tls: { valid: boolean };
} {
  const tls = { valid: false };
  const pool = new pg.Pool({
    host: registration.database.endpoint_host,
    port: Number(registration.database.endpoint_port),
    database: registration.database.database_name,
    user: registration.databaseLogin,
    password: databasePassword(registration),
    options: "-c role=desk_runtime",
    max: 1,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
    application_name: "the-desk-durable-pair",
    ssl: {
      rejectUnauthorized: true,
      servername: registration.database.endpoint_host,
      minVersion: "TLSv1.2",
      checkServerIdentity,
    },
  });
  pool.on("connect", (client) => {
    const connection = Reflect.get(client, "connection") as
      | { stream?: unknown }
      | undefined;
    const stream = connection?.stream;
    tls.valid =
      stream instanceof TLSSocket &&
      stream.authorized &&
      !checkServerIdentity(
        registration.database.endpoint_host,
        stream.getPeerCertificate(),
      );
  });
  pool.on("error", () => {
    tls.valid = false;
  });
  return { pool, tls };
}
async function guard(
  tx: Tx,
  registration: RegisteredPair,
  tls: { valid: boolean },
): Promise<void> {
  await tx.query("SET LOCAL statement_timeout = '10s'");
  await tx.query("SET LOCAL lock_timeout = '2s'");
  requirePair(tls.valid, "binding_unavailable", "binding");
  const identity = await tx.query(
    "SELECT current_database() AS database,current_user AS role,session_user AS login,current_setting('server_version_num') AS version,current_setting('server_encoding') AS encoding,(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS ssl",
  );
  const row = identity.rows[0];
  requirePair(
    row?.database === registration.database.database_name &&
      row.role === "desk_runtime" &&
      row.login === registration.databaseLogin &&
      typeof row.version === "string" &&
      /^17[0-9]{4}$/.test(row.version) &&
      row.encoding === "UTF8" &&
      row.ssl === true,
    "binding_unavailable",
    "binding",
  );
  const catalog = await tx.query(PAIR_CATALOG_SQL, [[...FAMILIES]]);
  requirePair(
    same(catalog.rows[0]?.facts, registration.expectedCatalog),
    "binding_unavailable",
    "binding",
  );
}
function normalize(row: Data, family: (typeof FAMILIES)[number]): Data {
  const value = { ...row };
  if (family === "artifacts" && value.byte_size !== null) {
    requirePair(
      typeof value.byte_size === "string" &&
        /^(0|[1-9][0-9]*)$/.test(value.byte_size) &&
        Number(value.byte_size) <= 5760044,
      "sql_conflict",
      "sql",
    );
    value.byte_size = Number(value.byte_size);
  }
  return closed(value, COLUMNS[family]);
}
async function rowsAt(
  tx: Tx,
  expected: Data,
  family: (typeof FAMILIES)[number],
): Promise<Data[]> {
  const id = IDS[family];
  let text = SELECTS[family] + " WHERE " + id + "=$1::uuid";
  const values: unknown[] = [expected[id]];
  if (family === "artifacts") {
    text += " OR (artifact_type=$2 AND content_hash=$3)";
    values.push(expected.artifact_type, expected.content_hash);
  }
  if (family === "audio_artifacts") {
    text += " OR artifact_id=$2::uuid OR audio_sha256=$3";
    values.push(expected.artifact_id, expected.audio_sha256);
  }
  if (family === "assembly_recipes" || family === "master_assembly_maps") {
    text += " OR artifact_id=$2::uuid";
    values.push(expected.artifact_id);
  }
  return (await tx.query(text, values)).rows.map((row) =>
    normalize(row, family),
  );
}
async function compare(
  tx: Tx,
  graph: PairRows,
  receipt?: Data,
): Promise<{ missing: { family: (typeof FAMILIES)[number]; row: Data }[] }> {
  const missing: { family: (typeof FAMILIES)[number]; row: Data }[] = [];
  for (const family of FAMILIES)
    for (const row of graph[family]) {
      const found = await rowsAt(tx, row, family);
      requirePair(
        found.length === 0 || (found.length === 1 && same(found[0], row)),
        "identity_conflict",
        "sql",
      );
      if (found.length === 0) missing.push({ family, row });
    }
  if (receipt) {
    const found = await rowsAt(tx, receipt, "artifacts");
    requirePair(
      found.length === 0 || (found.length === 1 && same(found[0], receipt)),
      "identity_conflict",
      "sql",
    );
    if (found.length === 0) missing.push({ family: "artifacts", row: receipt });
  }
  return { missing };
}
class SqlReleasePending extends PairRefusal {
  constructor(
    readonly completed: unknown,
    readonly primary: unknown,
  ) {
    super(
      primary instanceof PairRefusal ? primary.code : "cleanup_pending",
      primary instanceof PairRefusal ? primary.phase : "cleanup",
      true,
    );
  }
}
async function withPool<T>(
  registration: RegisteredPair,
  work: (pool: pg.Pool, tls: { valid: boolean }) => Promise<T>,
): Promise<T> {
  if (pendingPool) throw new PairRefusal("cleanup_pending", "cleanup", true);
  const owner = sqlPool(registration);
  let result: T | undefined;
  let primary: unknown;
  try {
    result = await work(owner.pool, owner.tls);
  } catch (error) {
    primary = error;
    if (commandCleanupErrors(error).length > 0) {
      pendingPool = true;
      primary = new PairRefusal(
        error instanceof PairRefusal ? error.code : "sql_outcome_unknown",
        error instanceof PairRefusal ? error.phase : "sql",
        true,
      );
    }
  }
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      owner.pool.end(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error("pool release pending"));
        }, 5000);
      }),
    ]);
  } catch {
    pendingPool = true;
    throw new SqlReleasePending(result, primary);
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (primary instanceof Error) throw primary;
  if (primary !== undefined)
    throw new PairRefusal("sql_outcome_unknown", "sql");
  return result as T;
}
export async function readPairReceipt(
  registration: RegisteredPair,
  operation: string,
  until = performance.now() + 300000,
): Promise<PairReceipt | null> {
  return withPool(registration, async (pool, tls) => {
    const result = await runCommand<PairReceipt | null>(
      pool,
      async (baseTx) => {
        const tx = withinBudget(baseTx, until);
        await guard(tx, registration, tls);
        const found = await tx.query(
          ARTIFACT_SELECT + " WHERE artifact_id=$1::uuid",
          [operation],
        );
        if (!found.rows.length) return { kind: "converged", record: null };
        const row = normalize(found.rows[0] as Data, "artifacts");
        requirePair(
          row.artifact_type === "durable_pair_operation" &&
            row.schema_version === "durable-pair-receipt/1",
          "identity_conflict",
          "sql",
        );
        const receipt = parseReceiptEnvelope(row.canonical_payload, operation);
        requirePair(
          same(row, receiptRow(receipt, registration.storage)),
          "identity_conflict",
          "sql",
        );
        const comparison = await compare(tx, receipt.request.rows, row);
        requirePair(comparison.missing.length === 0, "sql_conflict", "sql");
        return { kind: "converged", record: receipt };
      },
      undefined,
      "repeatable_read_read_only",
    );
    requirePair(result.kind === "converged", "sql_conflict", "sql");
    return result.record;
  });
}
export async function preflightPairRows(
  registration: RegisteredPair,
  graph: PairRows,
  until = performance.now() + 600000,
): Promise<void> {
  await withPool(registration, async (pool, tls) => {
    const result = await runCommand(
      pool,
      async (baseTx) => {
        const tx = withinBudget(baseTx, until);
        await guard(tx, registration, tls);
        await compare(tx, graph);
        return { kind: "converged", record: null };
      },
      undefined,
      "repeatable_read_read_only",
    );
    requirePair(result.kind === "converged", "sql_conflict", "sql");
  });
}
export async function commitPairRows(
  registration: RegisteredPair,
  receipt: PairReceipt,
  until = performance.now() + 600000,
): Promise<{ kind: "created" | "converged"; cleanupPending: boolean }> {
  try {
    const kind = await withPool(registration, async (pool, tls) => {
      const result = await runCommand<null>(pool, async (baseTx) => {
        const tx = withinBudget(baseTx, until);
        await guard(tx, registration, tls);
        await tx.query(
          "SELECT pg_advisory_xact_lock(hashtext('durable_pair_operation'),hashtext($1))",
          [receipt.request.operation_id],
        );
        const expectedReceipt = receiptRow(receipt, registration.storage);
        const comparison = await compare(
          tx,
          receipt.request.rows,
          expectedReceipt,
        );
        for (const { family, row } of comparison.missing) {
          const columns = COLUMNS[family];
          await tx.query(
            "INSERT INTO public." +
              family +
              " (" +
              columns.join(",") +
              ") VALUES (" +
              columns.map((_, index) => "$" + String(index + 1)).join(",") +
              ")",
            columns.map((name) => row[name]),
          );
        }
        requirePair(
          (await compare(tx, receipt.request.rows, expectedReceipt)).missing
            .length === 0,
          "sql_conflict",
          "sql",
        );
        return {
          kind: comparison.missing.length ? "created" : "converged",
          record: null,
        };
      });
      requirePair(
        result.kind === "created" || result.kind === "converged",
        "sql_conflict",
        "sql",
      );
      return result.kind;
    });
    return { kind, cleanupPending: false };
  } catch (error) {
    if (error instanceof SqlReleasePending) {
      if (error.completed === "created" || error.completed === "converged")
        return { kind: error.completed, cleanupPending: true };
      const original = error.primary;
      if (original instanceof PairRefusal)
        throw new PairRefusal(original.code, original.phase, true);
      if (original instanceof CommandConnectionError)
        throw new PairRefusal(
          original.commitOutcome === "unknown"
            ? "sql_outcome_unknown"
            : "sql_not_committed",
          "sql",
          true,
        );
      throw new PairRefusal("sql_outcome_unknown", "sql", true);
    }
    if (error instanceof CommandConnectionError)
      throw new PairRefusal(
        error.commitOutcome === "unknown"
          ? "sql_outcome_unknown"
          : "sql_not_committed",
        "sql",
        commandCleanupErrors(error).length > 0,
      );
    if (error instanceof PairRefusal) throw error;
    if (
      typeof error === "object" &&
      error !== null &&
      Reflect.get(error, "code") === "23505" &&
      PAIR_UNIQUE_CONSTRAINTS.has(String(Reflect.get(error, "constraint")))
    ) {
      const recovered = await readPairReceipt(
        registration,
        receipt.request.operation_id,
        until,
      );
      if (recovered && same(recovered, receipt))
        return { kind: "converged", cleanupPending: false };
      throw new PairRefusal("sql_conflict", "sql");
    }
    throw new PairRefusal("sql_outcome_unknown", "sql", true);
  }
}
