#!/bin/bash
# Fixed producer envelopes and StageOwner dispatch around the unchanged P33 guard.
# Hosted ubuntu-24.04 VM only; never run it elsewhere.
# Producer routes retain their fixed budgets, restrictive umask and resource caps.
# Prerequisite, focused and all exec the closed StageOwner before PREP. It owns
# phase grants, exclusive captures, EOF/reaping and one total monotonic budget.
# Required guard records must be written before launch. Supplemental process
# snapshots remain diagnostics, never ownership or cleanup proof.
# Only rest/all/GUARD receives the validated disposable database URL through its
# environment, never argv. PREP, BIND, CHECK and writer guards receive no URL.
# StageOwner refuses credential-bearing output; retention keeps existing redaction.
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
# Every fixed test stage is owned before PREP and retains one total budget.
case "$STAGE" in
  prerequisite|focused|all) exec /usr/bin/python3 -I -B test/support/p33-parity-supervisor.py stage-owner "$STAGE" ;;
  *) echo "unknown stage" >&2; exit 64 ;;
esac
