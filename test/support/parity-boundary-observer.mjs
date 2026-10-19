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
function fatal() {
  // A logger error must never become an expected fixture exception.
  try {
    if (Number.isSafeInteger(parent) && parent > 1) kill(parent, "SIGUSR1");
  } finally {
    exit(86);
  }
}
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
        case: currentCase,
        occurrence,
        event,
        ...fields,
      }) +
      "\n";
    if (line.length > 4096) fatal();
    // Strings are ASCII escaped for byte-count/atomic-write bounds.
    const ascii = line.replace(
      /[^\x00-\x7f]/g,
      (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
    );
    if (ascii.length > 4096 || write(2, ascii) !== ascii.length) fatal();
  } catch {
    fatal();
  }
}
export function caseEntry(task) {
  try {
    const names = [];
    for (let item = task; item; item = item.suite) names.unshift(item.name);
    currentCase = names.join(" > ");
    occurrence++;
    mark("case-enter");
  } catch {
    fatal();
  }
}
export function nativeCall(boundary, executable, argv, invoke) {
  // Copy only known primitive argv; no options/result/error introspection.
  let id;
  try {
    if (typeof executable !== "string" || !Array.isArray(argv)) fatal();
    const args = [];
    for (const arg of argv) {
      if (typeof arg !== "string") fatal();
      args.push(arg);
    }
    id = ++call;
    mark("native-enter", { call: id, boundary, executable, argv: args });
  } catch {
    fatal();
  }
  let value;
  try {
    value = invoke();
  } catch (error) {
    mark("native-throw", { call: id });
    throw error;
  }
  mark("native-return", { call: id });
  return value;
}
