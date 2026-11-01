#!/bin/bash
# Fixed-stage envelope around the UNCHANGED P33 guard (test/support/p33-parity-supervisor.py).
# Hosted ubuntu-24.04 VM only; never run it elsewhere.
# One argument: prerequisite | focused | all. No other input selects a command or profile.
# The disposable VM is the outer containment boundary; this wrapper adds only: a wall ceiling,
# core 0, a 64 MiB per-file ceiling, a sanitized environment, exclusive capture files, and the
# real exit status (never swallowed, never --preserve-status).
#
# Evidence classes:
#   REQUIRED before launch: limits.txt, pre-attempts, started-utc. If any cannot be produced the guard is
#     NOT started (exit 79). The attempt listing is a loop plus a sort pipeline; the listing subshell sets
#     pipefail, so a failing producer or sort is observable as a nonzero status.
#   BEST-EFFORT supplemental: ps-pre.txt / ps-post.txt process-table snapshots (no arguments are recorded). They are
#     diagnostics only and are NEVER ownership or cleanup proof; their status goes to snapshot-status.txt.
#
# Database URL: only stage `all` receives TEST_DATABASE_URL. It is written to a pipe (a shell builtin, so it is
# never in any argv), read by the child shell from stdin, exported for that one exec and closed before the guard
# starts (the guard's stdin is /dev/null). Every other stage runs without it.
set -u
set -C   # noclobber: every capture file below is created exclusively; an existing file is an error

if [ "$#" -ne 1 ]; then
  echo "usage: run-stage.sh <prerequisite|focused|all>" >&2
  exit 64
fi
STAGE=$1
case "$STAGE" in
  producer-build|evaluation-init|bind-build)
    case "${DESK_CI_PARTITION:-}" in writer|rest) ;; *) exit 64 ;; esac
    [ "${GITHUB_ACTIONS:-}" = true ] && [ "${ImageOS:-}" = ubuntu24 ] || exit 70
    [ "$STAGE" != producer-build ] || [ "$PWD" = /tmp/d ] || exit 70
    [ "$STAGE" = producer-build ] || [ "$PWD" = /tmp/e ] || exit 70
    read_stage_umask() {
      local key value rest fields=0
      READ_STAGE_MASK=
      while read -r key value rest; do
        if [ "$key" = Umask: ]; then
          [ -z "$rest" ] || return 1
          fields=$((fields + 1))
          READ_STAGE_MASK=$value
        fi
      done </proc/self/status || return 1
      [ "$fields" -eq 1 ]
    }
    read_stage_umask || exit 70
    OBSERVED_MASK=$READ_STAGE_MASK
    case "$OBSERVED_MASK" in 0[0-7][0-7][0-7]) ;; *) exit 70 ;; esac
    OBSERVED_BITS=$((8#$OBSERVED_MASK))
    # Adding mask bits is restrictive; removing any old bit is forbidden.
    [ $((OBSERVED_BITS & ~8#0077)) -eq 0 ] || exit 70
    umask 077 || exit 70
    read_stage_umask || exit 70
    EFFECTIVE_MASK=$READ_STAGE_MASK
    [ "$EFFECTIVE_MASK" = 0077 ] || exit 70
    export DESK_CI_ENVELOPE_OPERATION="$STAGE"
    export DESK_CI_ENVELOPE_OBSERVED_UMASK="$OBSERVED_MASK"
    export DESK_CI_ENVELOPE_EFFECTIVE_UMASK="$EFFECTIVE_MASK"
    printf '{"schema":"ci-stage-envelope/1","operation":"%s","observed_umask":"%s","effective_umask":"%s","restriction_only":true}\n' "$STAGE" "$OBSERVED_MASK" "$EFFECTIVE_MASK" || exit 79
    ulimit -c 0 || exit 79
    ulimit -f 65536 || exit 79
    case "$STAGE" in producer-build) ROLE_LIMIT=2400 ;; evaluation-init) ROLE_LIMIT=900 ;; bind-build) ROLE_LIMIT=300 ;; esac
    /usr/bin/env -u TEST_DATABASE_URL -u NODE_PATH -u NODE_OPTIONS /usr/bin/timeout --signal=TERM --kill-after=20s "${ROLE_LIMIT}s" /usr/bin/python3 -I -B tools/ci-validation/ci.py "$STAGE"
    exit $?
    ;;
esac
# Restored stages are owned before PREP; the held aggregate keeps its legacy route.
case "$STAGE" in
  prerequisite|focused) exec /usr/bin/python3 -I -B test/support/p33-parity-supervisor.py stage-owner "$STAGE" ;;
esac
umask 077 # Existing legacy stage envelope only; new producer routes returned above.
case "$STAGE" in
  prerequisite) CEILING=30 ;;
  focused) CEILING=120 ;;
  all) CEILING=7200 ;;
  *) echo "unknown stage" >&2; exit 64 ;;
esac
case "${DESK_CI_PARTITION:-}" in
  writer|rest) ;;
  *) echo "explicit writer/rest partition required" >&2; exit 64 ;;
esac
PROFILE=$STAGE
if [ "$STAGE" = all ]; then PROFILE=$DESK_CI_PARTITION; fi
KILL_AFTER=20          # seconds after TERM before KILL
CAP_KIB=65536          # bash 'ulimit -f' unit is 1024-byte blocks (bash default mode): 65536 KiB
CAP_BYTES=67108864     # 64 MiB; verified below against the kernel's own byte-denominated record

HERE=$(cd "$(dirname "$0")" && pwd -P) || exit 70
ROOT=$(cd "$HERE/../.." && pwd -P) || exit 70
[ -n "${RUNNER_TEMP:-}" ] && [ -n "${DESK_CI_ROLE_TEMP:-}" ] || { echo "runner and role temp are required" >&2; exit 70; }
case "$RUNNER_TEMP" in /*) ;; *) echo "RUNNER_TEMP must be absolute" >&2; exit 70 ;; esac
case "$DESK_CI_ROLE_TEMP" in /*) ;; *) echo "DESK_CI_ROLE_TEMP must be absolute" >&2; exit 70 ;; esac
CI_DIR="$DESK_CI_ROLE_TEMP/ci"
STAGE_DIR="$CI_DIR/evidence/$STAGE"
NODE_EXE=$(command -v node) || { echo "node is not on PATH" >&2; exit 70; }
NODE_BIN=$(dirname "$NODE_EXE")
case "$NODE_BIN" in /*) ;; *) echo "node path must be absolute" >&2; exit 70 ;; esac
[ -x /usr/bin/python3 ] && [ -x /usr/bin/timeout ] && [ -x /usr/bin/env ] && [ -x /bin/bash ] || { echo "required system tools missing" >&2; exit 70; }
if [ "$STAGE" = all ] && [ "$DESK_CI_PARTITION" = rest ]; then
  [ -n "${TEST_DATABASE_URL:-}" ] || { echo "TEST_DATABASE_URL is required for rest aggregate" >&2; exit 71; }
fi

# Gate: source/database binding and the predecessor verdict must already be recorded as passing.
/usr/bin/python3 -I -B "$HERE/ci.py" precheck "$STAGE" || exit 72
FIXTURE_BINDING=$(/usr/bin/python3 -I -B "$HERE/ci.py" fixture-binding "$STAGE") || exit 72
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

# Required attempt listing (see header). An empty list is a success.
list_attempts() {
  (
    set -o pipefail
    shopt -s nullglob
    names=()
    for dir in "$CI_DIR"/tmp/p33-*/attempt-*; do
      names+=("${dir##*/}")
    done
    if [ "${#names[@]}" -gt 0 ]; then
      printf '%s\n' "${names[@]}" | LC_ALL=C sort
    fi
  )
}
snapshot_processes() { LC_ALL=C ps -e -o pid=,ppid=,pgid=,stat=,comm= > "$1"; }

list_attempts > "$STAGE_DIR/pre-attempts" || fail_prelaunch "pre-attempts"
date -u +%Y-%m-%dT%H:%M:%S.%NZ > "$STAGE_DIR/started-utc" || fail_prelaunch "started-utc"
snapshot_processes "$STAGE_DIR/ps-pre.txt"
PS_PRE=$?

RUNNER_ID_ARG=()
if [ -n "${RUNNER_TRACKING_ID:-}" ]; then
  RUNNER_ID_ARG=("RUNNER_TRACKING_ID=$RUNNER_TRACKING_ID")
fi

# The child shell: read one line from the pipe, export it only for stage all, then exec the timeout-wrapped guard
# with stdin from /dev/null. Single-quoted on purpose: $1/$2 are the child's positional parameters.
CHILD='IFS= read -r DB_LINE || DB_LINE=""
if [ "$1" = rest ]; then
  [ -n "$DB_LINE" ] || exit 75
  export TEST_DATABASE_URL="$DB_LINE"
fi
unset DB_LINE
exec /usr/bin/timeout --signal=TERM --kill-after=20 "$2" /usr/bin/python3 test/support/p33-parity-supervisor.py guard "$1" < /dev/null'

cd "$ROOT" || fail_prelaunch "cd"
# Sanitized environment: nothing is inherited except what is listed (RUNNER_TRACKING_ID is preserved).
if [ "$PROFILE" = rest ]; then DB_FEED=$TEST_DATABASE_URL; else DB_FEED=""; fi
printf '%s\n' "$DB_FEED" | /usr/bin/env -i \
  PATH="$NODE_BIN:/usr/bin:/bin" HOME="$CI_DIR/home" TMPDIR="$CI_DIR/tmp" \
  LANG=C.UTF-8 LC_ALL=C.UTF-8 TZ=UTC CI=true DESK_FIXTURE105_BINDING="$FIXTURE_BINDING" \
  RUNNER_TEMP="$RUNNER_TEMP" DESK_CI_ROLE_TEMP="$DESK_CI_ROLE_TEMP" DESK_CI_PARTITION="$DESK_CI_PARTITION" \
  GITHUB_SHA="$GITHUB_SHA" GITHUB_REPOSITORY="$GITHUB_REPOSITORY" \
  GITHUB_RUN_ID="$GITHUB_RUN_ID" GITHUB_RUN_ATTEMPT="$GITHUB_RUN_ATTEMPT" \
  "${RUNNER_ID_ARG[@]+"${RUNNER_ID_ARG[@]}"}" \
  /bin/bash -c "$CHILD" _ "$PROFILE" "$CEILING" \
  > "$STAGE_DIR/stdout" 2> "$STAGE_DIR/stderr"
RC=$?
DB_FEED=""

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
