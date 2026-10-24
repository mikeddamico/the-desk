#!/bin/bash
# PR34 PERFORMANCE DIAGNOSTIC fixed-stage envelope around the DERIVED guard (diagnostic/pr34-performance/p33-gate-supervisor.py), derived from the executed PR33 gate-diagnostic003 launcher, itself derived from the TU11 proposal003 launcher
# run-tu11.sh (SHA-256 a4275a2f751fd60c27f171a32517fd442e8cacc49c2d9794d3c7e9902857914f), itself derived from tools/ci-validation/run-stage.sh by removing the
# stage/database/precheck parameters. PROPOSED, NOT RUN, NOT SYNTAX-CHECKED (bash -n was not executed). Hosted ubuntu-24.04 only. NO arguments, NO stage selector:
# the one command it can run is the `gate` profile of the derived guard (eleven fixed test files, 725 cases, Zod 4.6.6 focused diagnostic) against the fixed target checkout. The ONLY addition to
# the sanitized environment is the exact disposable TEST_DATABASE_URL that the integration files require; it is checked against its literal value before anything
# is created, and only its KEY is recorded.
#
# Evidence classes (as run-stage.sh): REQUIRED before launch: limits.txt, pre-attempts, started-utc, argv.txt, env-keys.txt, ps-pre.txt (if any one cannot
# be produced, INCLUDING the ps-pre snapshot, the guard is NOT started: exit 79 with a prelaunch-failed record). BEST-EFFORT supplemental after the run:
# ps-post and the post attempt listing are recorded, and a failure there is retained HOLD evidence (never ownership proof).
# The real exit status of the timeout-wrapped guard is captured immediately and never swallowed (no --preserve-status); a failing test case therefore yields a
# nonzero launcher status.
# The capture layout is deliberately short (BASE=/home/runner/work/_temp/g34, CAP=$BASE/c, TMPDIR=$CAP/tmp) so that the inherited guard's unix socket
# pathname fits sockaddr_un.sun_path; the binder `precheck` re-derives and requires that fit before this script creates anything.
set -u
set -C   # noclobber: every capture file below is created exclusively
umask 077

if [ "$#" -ne 0 ]; then
  echo "usage: run-gate.sh (no arguments)" >&2
  exit 64
fi
CEILING=300            # seconds before TERM
KILL_AFTER=20          # seconds after TERM before KILL
CAP_KIB=65536          # bash 'ulimit -f' unit is 1024-byte blocks: 65536 KiB
CAP_BYTES=67108864     # 64 MiB, verified against /proc/self/limits (bytes)

WORKSPACE=/home/runner/work/the-desk/the-desk
TARGET=$WORKSPACE/pr34-performance-target
CONTROL=$WORKSPACE/pr34-performance-control
GUARD=$CONTROL/diagnostic/pr34-performance/p33-gate-supervisor.py
CAP=/home/runner/work/_temp/g34/c
STAGE_DIR=$CAP/stage
[ "${RUNNER_TEMP:-}" = /home/runner/work/_temp ] || { echo "RUNNER_TEMP literal mismatch" >&2; exit 70; }
[ "${TEST_DATABASE_URL:-}" = postgresql://postgres:postgres@localhost:5432/the_desk_test ] || { echo "TEST_DATABASE_URL is not the disposable service URL" >&2; exit 71; }
[ "$(cd "$TARGET" && pwd -P)" = "$TARGET" ] && [ "$(cd "$CONTROL" && pwd -P)" = "$CONTROL" ] || { echo "fixed checkout path mismatch" >&2; exit 70; }
NODE_EXE=$(command -v node) || { echo "node is not on PATH" >&2; exit 70; }
NODE_BIN=$(dirname "$NODE_EXE")
case "$NODE_BIN" in /*) ;; *) echo "node path must be absolute" >&2; exit 70 ;; esac
[ -x /usr/bin/python3 ] && [ -x /usr/bin/timeout ] && [ -x /usr/bin/env ] && [ -x /bin/bash ] || { echo "required system tools missing" >&2; exit 70; }

# Gate: the pre-binding must already be recorded in this run, the socket pathname model must still fit, and the stage directory must not exist.
/usr/bin/python3 -I -B "$CONTROL/diagnostic/pr34-performance/gate_bind.py" precheck || exit 72
mkdir -m 700 "$STAGE_DIR" || exit 73

fail_prelaunch() {
  echo "HOLD: required pre-launch evidence could not be prepared ($1); the guard was NOT started" >&2
  printf 'prelaunch failure: %s\n' "$1" > "$STAGE_DIR/prelaunch-failed" || echo "prelaunch-failed record also failed" >&2
  exit 79
}

ulimit -c 0 || fail_prelaunch "ulimit -c"
ulimit -f "$CAP_KIB" || fail_prelaunch "ulimit -f"
CORE=$(awk '/^Max core file size/ {print $5 " " $6}' /proc/self/limits) || fail_prelaunch "read core limit"
FSIZE=$(awk '/^Max file size/ {print $4 " " $5}' /proc/self/limits) || fail_prelaunch "read file-size limit"
if [ "$CORE" != "0 0" ] || [ "$FSIZE" != "$CAP_BYTES $CAP_BYTES" ]; then
  fail_prelaunch "limit verification core='$CORE' fsize='$FSIZE'"
fi
printf 'core %s\nfsize %s\n' "$CORE" "$FSIZE" > "$STAGE_DIR/limits.txt" || fail_prelaunch "limits.txt"

list_attempts() {
  (
    set -o pipefail
    shopt -s nullglob
    names=()
    for dir in "$CAP"/tmp/the-desk-p33-*/attempt-*; do
      names+=("${dir##*/}")
    done
    if [ "${#names[@]}" -gt 0 ]; then
      printf '%s\n' "${names[@]}" | LC_ALL=C sort
    fi
  )
}
snapshot_processes() { LC_ALL=C ps -e -o pid=,ppid=,pgid=,stat=,comm= > "$1"; }

RUNNER_ID_ARG=()
if [ -n "${RUNNER_TRACKING_ID:-}" ]; then
  RUNNER_ID_ARG=("RUNNER_TRACKING_ID=$RUNNER_TRACKING_ID")
fi

# The complete literal command line and the environment KEYS (never values) are recorded before the guard starts.
ARGV_TEXT="/usr/bin/timeout --signal=TERM --kill-after=$KILL_AFTER $CEILING /usr/bin/python3 $GUARD guard gate"
printf '%s\n' "$ARGV_TEXT" > "$STAGE_DIR/argv.txt" || fail_prelaunch "argv.txt"
{ printf 'PATH\nHOME\nTMPDIR\nLANG\nLC_ALL\nTZ\nCI\nTEST_DATABASE_URL\n'; if [ -n "${RUNNER_TRACKING_ID:-}" ]; then printf 'RUNNER_TRACKING_ID\n'; fi; } > "$STAGE_DIR/env-keys.txt" || fail_prelaunch "env-keys.txt"
list_attempts > "$STAGE_DIR/pre-attempts" || fail_prelaunch "pre-attempts"
date -u +%Y-%m-%dT%H:%M:%S.%NZ > "$STAGE_DIR/started-utc" || fail_prelaunch "started-utc"
{ printf 'uptime-start '; cat /proc/uptime; } > "$STAGE_DIR/monotonic-start.txt" || fail_prelaunch "monotonic-start"
snapshot_processes "$STAGE_DIR/ps-pre.txt"
PS_PRE=$?
# A required pre snapshot that failed stops the run BEFORE the guard (a persisted prelaunch failure, exit 79).
[ "$PS_PRE" -eq 0 ] || fail_prelaunch "ps-pre snapshot status $PS_PRE"

cd "$TARGET" || fail_prelaunch "cd"
# Sanitized environment: nothing is inherited except what is listed. stdin is closed from the guard (as run-stage.sh: < /dev/null).
/usr/bin/env -i \
  PATH="$NODE_BIN:/usr/bin:/bin" HOME="$CAP/home" TMPDIR="$CAP/tmp" \
  LANG=C.UTF-8 LC_ALL=C.UTF-8 TZ=UTC CI=true TEST_DATABASE_URL="$TEST_DATABASE_URL" \
  "${RUNNER_ID_ARG[@]+"${RUNNER_ID_ARG[@]}"}" \
  /usr/bin/timeout --signal=TERM --kill-after="$KILL_AFTER" "$CEILING" /usr/bin/python3 "$GUARD" guard gate < /dev/null \
  > "$STAGE_DIR/stdout" 2> "$STAGE_DIR/stderr"
RC=$?

POST_FAIL=0
date -u +%Y-%m-%dT%H:%M:%S.%NZ > "$STAGE_DIR/ended-utc" || POST_FAIL=1
{ printf 'uptime-end '; cat /proc/uptime; } > "$STAGE_DIR/monotonic-end.txt" || POST_FAIL=1
snapshot_processes "$STAGE_DIR/ps-post.txt"
PS_POST=$?
list_attempts > "$STAGE_DIR/post-attempts" || POST_FAIL=1
printf 'ps-pre %s\nps-post %s\n' "$PS_PRE" "$PS_POST" > "$STAGE_DIR/snapshot-status.txt" || POST_FAIL=1
printf '%s\n' "$RC" > "$STAGE_DIR/exit" || exit 77

case "$RC" in
  124) echo "HOLD: command ceiling reached (timeout status 124)" >&2 ;;
  137) echo "HOLD: KILL fallback status 137 (the managed command may still be alive)" >&2 ;;
  153) echo "HOLD: SIGXFSZ (per-file size ceiling reached)" >&2 ;;
esac
if [ "$PS_POST" -ne 0 ]; then
  echo "HOLD: the post-run ps snapshot failed (status $PS_POST); recorded in snapshot-status.txt and the verdict will not pass" >&2
fi
if [ "$RC" -eq 0 ] && [ "$POST_FAIL" -ne 0 ]; then
  echo "HOLD: command exited 0 but a required post-run record could not be written" >&2
  exit 78
fi
exit "$RC"
