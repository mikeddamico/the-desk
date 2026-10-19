import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
// Diagnostic only. No test code or subject code is imported here.
import { writeSync } from "node:fs";
import process from "node:process";
const write = writeSync;
const stringify = JSON.stringify;
const now = process.hrtime.bigint.bind(process.hrtime);
const kill = process.kill.bind(process);
const exit = process.exit.bind(process);
const parent = Number(process.env.DESK_DIAG_SUPERVISOR);
const token = process.env.DESK_DIAG_TOKEN;
const pid = process.pid;
let sequence = 0;
let call = 0;
let occurrence = 0;
let currentCase = "<module-init>";
const descriptor = Object.getOwnPropertyDescriptor;
/**
 * @param {unknown} object
 * @param {string} key
 * @returns {unknown}
 */
function field(object, key) {
  const d = descriptor(object, key);
  if (!d) return null;
  if (!("value" in d)) fatal();
  /** @type {unknown} */
  const value = d.value;
  return value;
}
/**
 * @param {unknown} value
 * @returns {{ bytes: number, sha256: string } | null}
 */
function bytes(value) {
  if (value === null || value === undefined) return null;
  if (!Buffer.isBuffer(value) || value.length > 1048576) fatal();
  return {
    bytes: value.length,
    sha256: createHash("sha256").update(value).digest("hex"),
  };
}
/**
 * @param {unknown} error
 * @returns {Record<string, string | number | { bytes: number, sha256: string } | null>}
 */
function nativeError(error) {
  try {
    if (!error || typeof error !== "object") fatal();
    /** @type {Record<string, string | number | { bytes: number, sha256: string } | null>} */
    const record = {};
    for (const key of ["code", "message", "status", "signal", "pid"]) {
      const value = field(error, key);
      if (
        value !== null &&
        typeof value !== "string" &&
        typeof value !== "number"
      )
        fatal();
      if (typeof value === "string" && value.length > 1024) fatal();
      record[key] = value;
    }
    record.stdout = bytes(field(error, "stdout"));
    record.stderr = bytes(field(error, "stderr"));
    return record;
  } catch {
    fatal();
  }
}
/** @returns {never} */
function fatal() {
  // A logger error must never become an expected fixture exception.
  try {
    if (Number.isSafeInteger(parent) && parent > 1) kill(parent, "SIGUSR1");
  } finally {
    exit(86);
  }
}
/**
 * @param {string} event
 * @param {Record<string, unknown>} [fields]
 */
export function mark(event, fields = {}) {
  try {
    if (!token || !/^[a-f0-9]{32}$/.test(token)) fatal();
    const line =
      "\nDESK_DIAG " +
      stringify({
        token,
        seq: ++sequence,
        ns: String(now()),
        pid,
        ppid: process.ppid,
        case: currentCase,
        occurrence,
        event,
        ...fields,
      }) +
      "\n";
    if (line.length > 4096) fatal();
    // Strings are ASCII escaped for byte-count/atomic-write bounds.
    const ascii = line.replace(
      /[\u0080-\uffff]/g,
      (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
    );
    if (ascii.length > 4096 || write(2, ascii) !== ascii.length) fatal();
  } catch {
    fatal();
  }
}
/** @typedef {{ name: string, suite?: Task | undefined }} Task */
/** @param {Task} task */
export function caseEntry(task) {
  try {
    /** @type {string[]} */
    const names = [];
    /** @type {Task | undefined} */
    let item = task;
    for (; item; item = item.suite) names.unshift(item.name);
    currentCase = names.join(" > ");
    occurrence++;
    mark("case-enter");
  } catch {
    fatal();
  }
}
/**
 * @template T
 * @param {string} boundary
 * @param {unknown} executable
 * @param {unknown} argv
 * @param {() => T} invoke
 * @param {unknown} [options]
 * @returns {T}
 */
export function nativeCall(boundary, executable, argv, invoke, options) {
  // Diagnostic-only own-DATA observation; fatal failures cannot become fixture errors.
  /** @type {number | undefined} */
  let id;
  try {
    if (typeof executable !== "string" || !Array.isArray(argv)) fatal();
    /** @type {string[]} */
    const args = [];
    for (const arg of argv) {
      if (typeof arg !== "string") fatal();
      args.push(arg);
    }
    id = ++call;
    const observed = occurrence === 1;
    const opts = observed
      ? {
          maxBuffer: field(options, "maxBuffer"),
          killSignal: field(options, "killSignal"),
        }
      : null;
    mark("native-enter", {
      call: id,
      boundary,
      executable,
      argv: args,
      options: opts,
    });
  } catch {
    fatal();
  }
  /** @type {T} */
  let value;
  try {
    value = invoke();
  } catch (error) {
    mark("native-throw", {
      call: id,
      native: occurrence === 1 ? nativeError(error) : null,
    });
    throw error;
  }
  mark("native-return", { call: id });
  return value;
}
