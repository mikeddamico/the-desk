/** One hosted seven-case proof on the existing disposable PostgreSQL service; never a cloud-storage or deployment runner. */
import * as fs from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { stripVTControlCharacters } from "node:util";
import pg from "pg";
import { sha256, canonicalJson } from "../../src/identity/canonical-json.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporary = process.env.RUNNER_TEMP;
if (
  process.argv.length !== 2 ||
  process.platform !== "linux" ||
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.ImageOS !== "ubuntu24" ||
  process.env.DESK_CI_PARTITION !== "rest" ||
  !temporary?.startsWith("/")
)
  throw new Error("hosted_rest_fixture_required");
const base = join(temporary, "ci");
const stage = join(base, "evidence", "command-postgres");
const retained = join(stage, "retained");
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("local_database_required");
const url = new URL(databaseUrl);
if (
  url.protocol !== "postgresql:" ||
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.port !== "5432" ||
  url.pathname !== "/the_desk_test" ||
  url.search ||
  url.hash
)
  throw new Error("local_database_required");
if (
  process.version !== "v24.21.0" ||
  execFileSync("npm", ["--version"], {
    cwd: root,
    timeout: 20000,
    maxBuffer: 65536,
    encoding: "utf8",
  }).trim() !== "11.19.0"
)
  throw new Error("pinned_tools_required");
process.umask(0o077);
fs.mkdirSync(stage, { mode: 0o700 });
fs.mkdirSync(retained, { mode: 0o700 });

// Reuse authentic CI source/build/partition and fixture owners. This does not create a hosted identity or a stage verdict.
const sourceCheck = String.raw`
import contextlib,io,json,os,runpy,sys
from pathlib import Path
c=runpy.run_path('tools/ci-validation/ci.py',run_name='command_postgres_source_check')
base=c['ci_dir']();ev=base/'evidence';summary_evidence={}
if sys.argv[1]=='after':
  raw=c['fixture_read'](ev/'command-postgres/stdout',8*1024*1024)
  summary,problems=c['parse_summary'](raw.decode('utf8',errors='strict'))
  files=c['parse_file_lines'](raw.decode('utf8',errors='strict'))
  summary_evidence={'summary':summary,'summary_errors':problems,'file_results':files}
  for name in ('stdout','stderr'):
    data=c['fixture_read'](ev/'command-postgres'/name,8*1024*1024)
    from urllib.parse import urlparse
    secret=urlparse(os.environ['TEST_DATABASE_URL']).password or ''
    c['fixture_write_raw'](ev/'command-postgres/retained'/name,c['redact'](data,(secret,)),8*1024*1024)
partition=c['check_partition_binding']()
if partition['partition']!='rest':raise RuntimeError('rest binding required')
pre=c['load_pre'](ev);build=c['load_json'](ev/'bind-build.json')
if build.get('ok') is not True or not c['verdict_ok'](ev/'db-probe.json'):raise RuntimeError('build/database binding required')
now=c['tracked_files']()
if now!=sorted(pre['members']):raise RuntimeError('tracked source changed')
snap=c['take_snapshot'](now,allow_dist=True)
if c['snapshot_errors'](snap,pre=pre,expect_dist=build.get('dist')):raise RuntimeError('source/build changed')
binding,temp=c['fixture_validate'](base,c['ROOT'],True)
if temp.get('absent'):raise RuntimeError('existing focused loader owner required')
observed_identity,members=c['proof_identity_now'](True)
identity=c['partition_identity'](observed_identity,members)
if identity!=partition['identity']:raise RuntimeError('hosted identity changed')
result={'identity':identity,'binding':binding,'loader':temp,'source_inventory_sha256':c['fixture_hash'](c['fixture_bytes'](c['fixture_graph'](c['ROOT'],'source'))),'tools_inventory_sha256':c['fixture_hash'](c['fixture_bytes'](c['fixture_graph'](c['ROOT']/'node_modules','tools')))}
result.update(summary_evidence)
print(json.dumps(result,separators=(',',':')))
`;
function checkSource(phase: "before" | "after"): Record<string, unknown> {
  return JSON.parse(
    execFileSync("/usr/bin/python3", ["-I", "-B", "-c", sourceCheck, phase], {
      cwd: root,
      timeout: 30000,
      maxBuffer: 262144,
      encoding: "utf8",
    }),
  ) as Record<string, unknown>;
}
function record(name: string, value: unknown): void {
  const bytes = Buffer.from(JSON.stringify(value) + "\n");
  if (bytes.length > 65536) throw new Error("record_bound");
  const fd = fs.openSync(
    join(stage, name),
    fs.constants.O_WRONLY |
      fs.constants.O_CREAT |
      fs.constants.O_EXCL |
      fs.constants.O_NOFOLLOW,
    0o600,
  );
  try {
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}
function failure(error: unknown): { name: string; code: string } {
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    code:
      typeof error === "object" &&
      error !== null &&
      typeof Reflect.get(error, "code") === "string"
        ? (Reflect.get(error, "code") as string)
        : "UNCLASSIFIED",
  };
}
async function bounded<T>(work: Promise<T>, milliseconds: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error("action_deadline"));
        }, milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
function groups(pid: number): number[] {
  const members: number[] = [];
  for (const name of fs.readdirSync("/proc")) {
    if (!/^[0-9]+$/u.test(name)) continue;
    try {
      const data = fs.readFileSync(`/proc/${name}/stat`, "utf8");
      if (data.length > 4096) throw new Error("proc_bound");
      if (Number(data.slice(data.lastIndexOf(")") + 2).split(" ")[2]) === pid)
        members.push(Number(name));
    } catch (error) {
      if (
        !(
          typeof error === "object" &&
          error !== null &&
          ["ENOENT", "ESRCH"].includes(String(Reflect.get(error, "code")))
        )
      )
        throw error;
    }
  }
  return members;
}
const guardDirectory = join(
  base,
  "tmp",
  `the-desk-p33-${String(process.getuid?.())}-${sha256(Buffer.from(root)).slice(0, 24)}`,
);
function attempts(): string[] {
  try {
    return fs
      .readdirSync(guardDirectory)
      .filter((name) => /^attempt-[a-z0-9_]{8}$/u.test(name))
      .sort();
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      Reflect.get(error, "code") === "ENOENT"
    )
      return [];
    throw error;
  }
}
const before = checkSource("before");
record("source-before.json", before);
const preAttempts = attempts();
if (
  Buffer.byteLength(join(guardDirectory, "attempt-xxxxxxxx", "guard.sock")) +
    1 >
  108
)
  throw new Error("socket_path_bound");
const environment = {
  PATH: dirname(process.execPath) + ":/usr/bin:/bin",
  HOME: join(base, "home"),
  TMPDIR: join(base, "tmp"),
  RUNNER_TEMP: temporary,
  ...(process.env.RUNNER_TRACKING_ID
    ? { RUNNER_TRACKING_ID: process.env.RUNNER_TRACKING_ID }
    : {}),
  LANG: "C.UTF-8",
  LC_ALL: "C.UTF-8",
  TZ: "UTC",
  CI: "true",
  DESK_ENV: "test",
  PROVIDERS_ENABLED: "false",
  GENERATION_KILL_SWITCH: "true",
  TEST_DATABASE_URL: databaseUrl,
  DESK_FIXTURE105_BINDING: JSON.stringify(before.binding),
};
const command = [
  "--signal=TERM",
  "--kill-after=20s",
  "900s",
  "/usr/bin/python3",
  "-I",
  "-B",
  "test/support/p33-parity-supervisor.py",
  "guard",
  "command-postgres",
];
record("invocation.json", {
  argv: ["/usr/bin/timeout", ...command],
  cwd: root,
  identity: before.identity,
  environment_names: Object.keys(environment).sort(),
  node_sha256: sha256(fs.readFileSync(process.execPath)),
  guard_invocations: 1,
});

// One maintenance connection from the already-existing local bootstrap URL survives guard failure and observes cleanup independently.
const maintenance = new pg.Client({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 10000,
  query_timeout: 10000,
  application_name: "the-desk-command-postgres-observer",
});
let databaseFailure: unknown;
let connected = false;
let databaseEnded = false;
const maintenanceEnded = (): boolean => databaseEnded;
maintenance.on("end", () => {
  databaseEnded = true;
});
interface Population {
  databases: string[];
  roles: string[];
  pid: number;
}
async function population(): Promise<Population> {
  if (databaseFailure instanceof Error) throw databaseFailure;
  if (databaseFailure !== undefined)
    throw new Error("maintenance_connection_lost", { cause: databaseFailure });
  await maintenance.query("BEGIN READ ONLY");
  try {
    await maintenance.query("SET LOCAL statement_timeout='10s'");
    const identity = await maintenance.query<{
      pid: number;
      database: string;
      version: string;
      superuser: boolean;
    }>(
      "SELECT pg_backend_pid() AS pid,current_database() AS database,current_setting('server_version_num') AS version,(SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser",
    );
    const row = identity.rows[0];
    if (
      row?.database !== "the_desk_test" ||
      !/^17[0-9]{4}$/u.test(row.version) ||
      !row.superuser
    )
      throw new Error("bootstrap_identity");
    const databases = await maintenance.query<{ name: string }>(
      "SELECT datname AS name FROM pg_database WHERE left(datname,3)='fl_' ORDER BY datname COLLATE \"C\" LIMIT 257",
    );
    const roles = await maintenance.query<{ name: string }>(
      "SELECT rolname AS name FROM pg_roles WHERE left(rolname,3)='fl_' ORDER BY rolname COLLATE \"C\" LIMIT 257",
    );
    if (databases.rows.length > 256 || roles.rows.length > 256)
      throw new Error("population_bound");
    const result = {
      databases: databases.rows.map((value) => value.name),
      roles: roles.rows.map((value) => value.name),
      pid: row.pid,
    };
    await maintenance.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await maintenance.query("ROLLBACK");
    } catch {
      /* The first failure remains primary; after evidence cannot become a pass. */
    }
    throw error;
  }
}
let child: ChildProcess | undefined;
let exit: number | null = null;
let guardSignal: NodeJS.Signals | null = null;
const childExit = (): number | null => exit;
const childSignal = (): NodeJS.Signals | null => guardSignal;
let closed = false;
const isClosed = (): boolean => closed;
let resolveClose: (() => void) | undefined;
const close = new Promise<void>((resolve) => {
  resolveClose = resolve;
});
let primary: unknown;
const errors: { name: string; code: string }[] = [];
const streamBytes = { stdout: 0, stderr: 0 };
const output = {
  stdout: fs.openSync(join(stage, "stdout"), "wx", 0o600),
  stderr: fs.openSync(join(stage, "stderr"), "wx", 0o600),
};
let initial: Population | undefined;
let final: Population | undefined;
const terminate = (signal: NodeJS.Signals): void => {
  if (child?.pid)
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if (
        !(
          typeof error === "object" &&
          error !== null &&
          Reflect.get(error, "code") === "ESRCH"
        )
      )
        errors.push(failure(error));
    }
};
const fail = (error: unknown): void => {
  primary ??= error;
  if (!isClosed()) terminate("SIGTERM");
};
maintenance.on("error", (error) => {
  databaseFailure ??= error;
  fail(error);
});
process.once("SIGTERM", () => {
  fail(new Error("hosted_wrapper_interrupted"));
});
process.once("SIGINT", () => {
  fail(new Error("hosted_wrapper_interrupted"));
});
try {
  await maintenance.connect();
  connected = true;
  initial = await population();
  record("population-before.json", { status: "observed", ...initial });
  if (primary !== undefined) throw new Error("observer_failed_before_launch");
  child = spawn("/usr/bin/timeout", command, {
    cwd: root,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child.once("error", fail);
  child.once("close", (code, signal) => {
    exit = code;
    guardSignal = signal;
    closed = true;
    resolveClose?.();
  });
  for (const name of ["stdout", "stderr"] as const) {
    const source = child[name];
    if (!source) throw new Error("capture_stream_missing");
    source.on("error", fail);
    source.on("data", (bytes: Buffer) => {
      try {
        streamBytes[name] += bytes.length;
        if (streamBytes[name] > 8 * 1024 * 1024)
          throw new Error("stream_bound");
        fs.writeSync(output[name], bytes);
      } catch (error) {
        fail(error);
      }
    });
  }
  record("process.json", { pid: child.pid, pgid: child.pid });
  await bounded(close, 945000);
} catch (error) {
  primary ??= error;
} finally {
  if (child && !isClosed()) {
    terminate("SIGTERM");
    try {
      await bounded(close, 19000);
    } catch {
      terminate("SIGKILL");
      try {
        await bounded(close, 1000);
      } catch (error) {
        errors.push(failure(error));
      }
    }
  }
  for (const fd of Object.values(output)) {
    try {
      fs.fsyncSync(fd);
      fs.closeSync(fd);
    } catch (error) {
      errors.push(failure(error));
    }
  }
  // Observe after both assertion failures and nonzero/fatal guard exits; missing evidence is a hold, never inferred absence.
  if (!initial)
    record("population-before.json", {
      status: "unavailable",
      reason: "bootstrap_observation_unavailable",
    });
  if (connected) {
    try {
      final = await population();
      record("population-after.json", { status: "observed", ...final });
    } catch (error) {
      errors.push(failure(error));
      record("population-after.json", {
        status: "unavailable",
        error: failure(error),
      });
    }
  } else
    record("population-after.json", {
      status: "unavailable",
      reason: "bootstrap_connection_unavailable",
    });
  try {
    await bounded(maintenance.end(), 5000);
  } catch (error) {
    errors.push(failure(error));
  }
}
let residual: number[] = [];
try {
  residual = child?.pid ? groups(child.pid) : [];
} catch (error) {
  errors.push(failure(error));
}
try {
  const after = checkSource("after");
  record("source-after.json", after);
  for (const key of [
    "identity",
    "binding",
    "loader",
    "source_inventory_sha256",
    "tools_inventory_sha256",
  ])
    if (canonicalJson(after[key]) !== canonicalJson(before[key]))
      throw new Error("source_tool_owner_changed");
  const expectedSummary = {
    files: { passed: 1, total: 1 },
    tests: { passed: 7, total: 7 },
  };
  if (
    canonicalJson(after.summary) !== canonicalJson(expectedSummary) ||
    canonicalJson(after.summary_errors) !== "[]"
  )
    throw new Error("seven_complete_cases_required");
  const files = after.file_results as Record<
    string,
    { tests: number; failed: number; skipped: number; todo: number }[]
  >;
  if (
    Object.keys(files).length !== 1 ||
    canonicalJson(files["test/integration/g2-command-connection.test.ts"]) !==
      canonicalJson([{ tests: 7, failed: 0, skipped: 0, todo: 0 }])
  )
    throw new Error("fixed_file_results_required");
} catch (error) {
  errors.push(failure(error));
}
try {
  const fresh = attempts().filter((name) => !preAttempts.includes(name));
  if (fresh.length !== 1) throw new Error("one_guard_attempt_required");
  const path = join(guardDirectory, fresh[0] ?? "", "guard-result.json");
  const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  let guard: Record<string, unknown>;
  try {
    const beforeRead = fs.fstatSync(fd);
    if (
      !beforeRead.isFile() ||
      beforeRead.uid !== process.getuid?.() ||
      beforeRead.nlink !== 1 ||
      beforeRead.size > 65536 ||
      (beforeRead.mode & 0o022) !== 0
    )
      throw new Error("guard_record_shape");
    const bytes = Buffer.alloc(beforeRead.size + 1);
    const count = fs.readSync(fd, bytes, 0, bytes.length, 0);
    const afterRead = fs.fstatSync(fd);
    if (
      count !== beforeRead.size ||
      ["dev", "ino", "uid", "nlink", "size", "mtimeMs", "ctimeMs"].some(
        (key) => Reflect.get(beforeRead, key) !== Reflect.get(afterRead, key),
      )
    )
      throw new Error("guard_record_changed");
    guard = JSON.parse(bytes.subarray(0, count).toString()) as Record<
      string,
      unknown
    >;
  } finally {
    fs.closeSync(fd);
  }
  record("guard-result.json", guard);
  if (
    guard.settled !== true ||
    guard.directReaped !== true ||
    guard.noChildren !== true ||
    guard.complete !== true ||
    guard.fatal !== null ||
    guard.containedRejection !== null ||
    canonicalJson(guard.errors) !== "[]" ||
    canonicalJson(guard.residual) !== "[]" ||
    canonicalJson(guard.cleanupErrors) !== "[]"
  )
    throw new Error("guard_settlement_required");
} catch (error) {
  errors.push(failure(error));
}
const equal =
  initial !== undefined &&
  final !== undefined &&
  canonicalJson(initial) === canonicalJson(final);
const ok =
  primary === undefined &&
  childExit() === 0 &&
  isClosed() &&
  residual.length === 0 &&
  errors.length === 0 &&
  equal &&
  maintenanceEnded();
record("result.json", {
  ok,
  guard_exit: childExit(),
  guard_signal: childSignal(),
  direct_reaped: isClosed(),
  residual_group_members: residual,
  maintenance_ended: maintenanceEnded(),
  population_equal: equal,
  primary: primary === undefined ? null : failure(primary),
  errors,
  stream_bytes: streamBytes,
  captured_streams: Object.fromEntries(
    (["stdout", "stderr"] as const).map((name) => {
      const bytes = fs.readFileSync(join(stage, name));
      return [
        name,
        {
          bytes: bytes.length,
          sha256: sha256(bytes),
          complete: bytes.length === streamBytes[name],
        },
      ];
    }),
  ),
  loader: "existing_CI_owner_retains_identity_bound_empty_directory",
  actual_cloud_or_media: false,
});
// Existing CI redaction owns retained streams; only closed metadata records are copied alongside them.
for (const name of fs
  .readdirSync(stage)
  .filter((name) => name.endsWith(".json")))
  fs.copyFileSync(
    join(stage, name),
    join(retained, name),
    fs.constants.COPYFILE_EXCL,
  );
console.log(
  stripVTControlCharacters(
    JSON.stringify({
      command_postgres: ok ? "pass" : "hold",
      evidence: retained,
      tests: ok ? 7 : null,
    }),
  ),
);
process.exitCode = ok ? 0 : 1;
