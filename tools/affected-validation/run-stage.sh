#!/bin/bash
# Fixed-stage envelope around the UNCHANGED P33 guard (test/support/p33-parity-supervisor.py).
# PROPOSED, NOT YET REVIEWED OR RUN. Hosted ubuntu-24.04 VM only; never run it elsewhere.
# One argument: prerequisite | focused | p33 | parity. No other input selects a command or profile.
# The disposable VM is the outer containment boundary; this wrapper adds only: a wall ceiling,
# core 0, a 64 MiB per-file ceiling, a sanitized environment, exclusive capture files, and the
# real exit status (never swallowed, never --preserve-status).
#
# Evidence classes:
#   REQUIRED before launch: limits.txt, pre-attempts, started-utc. If any cannot be produced the guard is
#     NOT started (exit 79). The required attempt listing is a loop plus a sort pipeline; the
#     listing subshell sets pipefail, so a failing producer or sort is observable as a nonzero status.
#   BEST-EFFORT supplemental: ps-pre.txt / ps-post.txt process-table snapshots. They are plain redirections of
#     ps (no head/pipe, so no intentional truncation); the ps exit status is recorded in snapshot-status.txt and
#     surfaced as a warning. They are diagnostics only and are NEVER ownership or cleanup proof.
set -u
set -C   # noclobber: every capture file below is created exclusively; an existing file is an error
umask 077

if [ "$#" -ne 1 ]; then
  echo "usage: run-stage.sh <prerequisite|focused|p33|parity>" >&2
  exit 64
fi
STAGE=$1
case "$STAGE" in
  prerequisite) CEILING=30 ;;
  focused) CEILING=120 ;;
  p33) CEILING=120 ;;
  parity) CEILING=600 ;;
  *) echo "unknown stage" >&2; exit 64 ;;
esac
KILL_AFTER=20          # seconds after TERM before KILL
CAP_KIB=65536          # bash 'ulimit -f' unit is 1024-byte blocks (bash default mode): 65536 KiB
CAP_BYTES=67108864     # 64 MiB; verified below against the kernel's own byte-denominated record

HERE=$(cd "$(dirname "$0")" && pwd -P) || exit 70
ROOT=$(cd "$HERE/../.." && pwd -P) || exit 70
[ -n "${RUNNER_TEMP:-}" ] || { echo "RUNNER_TEMP is required" >&2; exit 70; }
case "$RUNNER_TEMP" in /*) ;; *) echo "RUNNER_TEMP must be absolute" >&2; exit 70 ;; esac
AV="$RUNNER_TEMP/av"
STAGE_DIR="$AV/evidence/$STAGE"
NODE_EXE=$(command -v node) || { echo "node is not on PATH" >&2; exit 70; }
NODE_BIN=$(dirname "$NODE_EXE")
case "$NODE_BIN" in /*) ;; *) echo "node path must be absolute" >&2; exit 70 ;; esac
[ -x /usr/bin/python3 ] && [ -x /usr/bin/timeout ] && [ -x /usr/bin/env ] || { echo "required system tools missing" >&2; exit 70; }

# Gate: source binding and predecessor verdict must already be recorded as passing.
/usr/bin/python3 -I -B "$HERE/av.py" precheck "$STAGE" || exit 72
mkdir -m 700 "$STAGE_DIR" || exit 73

fail_prelaunch() {
  echo "HOLD: required pre-launch evidence could not be prepared ($1); the guard was NOT started" >&2
  { printf 'prelaunch failure: %s\n' "$1" > "$STAGE_DIR/prelaunch-failed"; } 2>/dev/null
  exit 79
}

# Resource limits: core 0 and the per-file ceiling. Both soft and hard are set (no -S/-H), then verified
# from /proc/self/limits, which reports bytes unambiguously. No CPU, RSS, PID, fd or address-space limits.
ulimit -c 0 || fail_prelaunch "ulimit -c"
ulimit -f "$CAP_KIB" || fail_prelaunch "ulimit -f"
CORE=$(awk '/^Max core file size/ {print $5 " " $6}' /proc/self/limits) || fail_prelaunch "read core limit"
FSIZE=$(awk '/^Max file size/ {print $4 " " $5}' /proc/self/limits) || fail_prelaunch "read file-size limit"
if [ "$CORE" != "0 0" ] || [ "$FSIZE" != "$CAP_BYTES $CAP_BYTES" ]; then
  fail_prelaunch "limit verification core='$CORE' fsize='$FSIZE'"
fi
printf 'core %s\nfsize %s\n' "$CORE" "$FSIZE" > "$STAGE_DIR/limits.txt" || fail_prelaunch "limits.txt"

# Required attempt listing: a loop and parameter expansion feed `sort`. pipefail is set inside this subshell only, so a
# failure of either pipeline command is returned (sort consumes all input, so no early-close/SIGPIPE case is expected).
# An empty list is a success (nothing is printed and the `if` yields 0).
list_attempts() {
  (
    set -o pipefail
    shopt -s nullglob
    names=()
    for dir in "$AV"/tmp/the-desk-p33-*/attempt-*; do
      names+=("${dir##*/}")
    done
    if [ "${#names[@]}" -gt 0 ]; then
      printf '%s\n' "${names[@]}" | LC_ALL=C sort
    fi
  )
}
# Best-effort supplemental snapshot: ps writes straight to its file; the caller records its exit status.
snapshot_processes() { LC_ALL=C ps -e -o pid=,ppid=,pgid=,stat=,comm= > "$1"; }

list_attempts > "$STAGE_DIR/pre-attempts" || fail_prelaunch "pre-attempts"
date -u +%Y-%m-%dT%H:%M:%S.%NZ > "$STAGE_DIR/started-utc" || fail_prelaunch "started-utc"
snapshot_processes "$STAGE_DIR/ps-pre.txt"
PS_PRE=$?

RUNNER_ID_ARG=()
if [ -n "${RUNNER_TRACKING_ID:-}" ]; then
  RUNNER_ID_ARG=("RUNNER_TRACKING_ID=$RUNNER_TRACKING_ID")
fi

cd "$ROOT" || fail_prelaunch "cd"
# Sanitized environment: nothing is inherited except what is listed (RUNNER_TRACKING_ID is preserved).
/usr/bin/env -i \
  PATH="$NODE_BIN:/usr/bin:/bin" HOME="$AV/home" TMPDIR="$AV/tmp" \
  LANG=C.UTF-8 LC_ALL=C.UTF-8 TZ=UTC CI=true \
  "${RUNNER_ID_ARG[@]+"${RUNNER_ID_ARG[@]}"}" \
  /usr/bin/timeout --signal=TERM --kill-after="$KILL_AFTER" "$CEILING" \
  /usr/bin/python3 test/support/p33-parity-supervisor.py guard "$STAGE" \
  < /dev/null > "$STAGE_DIR/stdout" 2> "$STAGE_DIR/stderr"
RC=$?

POST_FAIL=0
date -u +%Y-%m-%dT%H:%M:%S.%NZ > "$STAGE_DIR/ended-utc" || POST_FAIL=1
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
if [ "$PS_PRE" -ne 0 ] || [ "$PS_POST" -ne 0 ]; then
  echo "NOTE: a supplemental ps snapshot failed (pre=$PS_PRE post=$PS_POST); recorded in snapshot-status.txt as a warning, not as ownership evidence" >&2
fi
if [ "$RC" -eq 0 ] && [ "$POST_FAIL" -ne 0 ]; then
  echo "HOLD: command exited 0 but a required post-run record could not be written" >&2
  exit 78
fi
exit "$RC"
