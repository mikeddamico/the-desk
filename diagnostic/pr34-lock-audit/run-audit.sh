#!/usr/bin/bash
# PR34 LOCK-AUDIT HOSTED DIAGNOSTIC fixed-mode envelope, REVISION 002. PROPOSED, UNREVIEWED, NOT RUN, NOT SYNTAX-CHECKED (`bash -n` was not executed by its author).
# It is an explicit reviewed HOSTED ADAPTATION of the accepted local launcher launch-audit.sh (9,313 bytes, SHA-256 bc55bdce5e3d20b23206ad211c73aeaff7ba24e0a1d498893e0a4f150525f237):
# the audit core (one lock-only `npm audit`, the exact argv, the emptied child environment, strict TLS, zero configured retries, 30 s request timeout, timeout TERM 60 s / KILL 5 s,
# core 0, ulimit -f 131072, signal counting/forwarding with the pre-PID race handling, immediate status capture) is kept; the local absolute paths, the local pinned tool hashes and
# the local pinned npm closure are NOT carried over to the runner. The hosted tool closure is MEASURED (before and after) and compared for drift, not preaccepted.
# Revision 002 changes only this file relative to proposal 001 (R1 npm per-file sizes and canonical tool identities; R2 exclusive pre/post copies of the three control bodies; R3 retained and
# rejected control-status and metadata failures; R4 mandatory structural validation of the audit report; R5 exact copied-member ledgers excluding only the three root metadata paths).
# Exactly one argument, one of: pre | audit | post | validate | collect. No other argument is accepted. Nothing is installed, no project script runs, no CA/proxy/TLS setting is
# changed or injected, and the audit child receives only PATH, HOME, TMPDIR, LANG, LC_ALL and CI. No ambient environment is dumped; only the explicit keys named below are recorded.
set -u -o pipefail
umask 077

WORKSPACE=/home/runner/work/the-desk/the-desk
TARGET=$WORKSPACE/pr34-lock-audit-target
CONTROL=$WORKSPACE/pr34-lock-audit-control
RT=/home/runner/work/_temp
BASE=$RT/a34
CAP=$BASE/c
REC=$BASE/r
UP=$BASE/u
VER=$BASE/v
INV=$CONTROL/diagnostic/pr34-lock-audit/inventory-360.tsv
CTRL_FILES=(.github/workflows/pr34-lock-audit-diagnostic.yml diagnostic/pr34-lock-audit/run-audit.sh diagnostic/pr34-lock-audit/inventory-360.tsv)
COPY_NAMES=(workflow.yml run-audit.sh inventory-360.tsv)
BRANCH_REF=refs/heads/diagnostic/pr34-lock-audit-002
SOURCE_SHA=1a2ea5feba7c60ace55b6222d25fc946d55b0f52
SOURCE_PARENT=568590e537e221c44c8cb40614d82856821fadf6
SOURCE_TREE=8eaa142d2c4133a8327ac7273ab4568171ae47c1
INV_SHA=66801b6495d61dd18c4dce90c3f53086d3886d35a35095f47b4dd06c05b723f1
INV_SIZE=42904
SRC_SHA256_LIST_SHA=10d661478b91198dda8e9ecf3218b1c291235728687864d196ae55ca7e70d56f
SRC_FIND_LIST_SHA=89881a63038e28e8e5194a28f3b6965a61ec2b882a20899efb850ba7cdd61d1b
CI_YML_SHA=8ada7fc271e4a1bc05980202775697f51e682f53079924903490b576c82803d4
NODE_SHA=7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c
NODE_SIZE=126595440
TOOLS=(/usr/bin/awk /usr/bin/bash /usr/bin/cat /usr/bin/cmp /usr/bin/cp /usr/bin/cut /usr/bin/date /usr/bin/env /usr/bin/find /usr/bin/git /usr/bin/id /usr/bin/ls /usr/bin/mkdir /usr/bin/python3 /usr/bin/readlink /usr/bin/sha256sum /usr/bin/sort /usr/bin/stat /usr/bin/tar /usr/bin/timeout /usr/bin/touch /usr/bin/uname /usr/bin/uniq /usr/bin/wc /usr/bin/xargs)

fail() {
  printf 'run-audit refused: %s\n' "$1" >&2
  exit "${2:-64}"
}
[ "$#" -eq 1 ] || fail "exactly one mode argument is required" 64
MODE=$1
case "$MODE" in pre|audit|post|validate|collect) ;; *) fail "unknown mode" 64 ;; esac

check_env() {
  local sha=${GITHUB_SHA:-}
  [ "${GITHUB_RUN_ATTEMPT:-}" = 1 ] || fail "GITHUB_RUN_ATTEMPT must be 1" 70
  [ "${GITHUB_EVENT_NAME:-}" = push ] || fail "the event must be push" 70
  [ "${GITHUB_REF:-}" = "$BRANCH_REF" ] || fail "the ref is not the fixed diagnostic branch" 70
  [ "${GITHUB_WORKFLOW:-}" = pr34-lock-audit-diagnostic ] || fail "the workflow name does not match" 70
  [ "${RUNNER_TEMP:-}" = "$RT" ] || fail "RUNNER_TEMP literal mismatch" 70
  [ "${GITHUB_WORKSPACE:-}" = "$WORKSPACE" ] || fail "GITHUB_WORKSPACE literal mismatch" 70
  case "${GITHUB_RUN_ID:-}" in ''|*[!0-9]*) fail "GITHUB_RUN_ID is not numeric" 70 ;; esac
  case "$sha" in ''|*[!0-9a-f]*) fail "GITHUB_SHA is not a lowercase hex object name" 70 ;; esac
  [ "${#sha}" -eq 40 ] || fail "GITHUB_SHA is not 40 characters" 70
}

canon_dir() { # the physical path of an existing directory equals the argument (shell builtins only)
  local physical
  physical=$(cd -P -- "$1" && pwd -P) || return 1
  [ "$physical" = "$1" ]
}

check_lit() { # check_lit <sha256> <path>
  local got
  got=$(/usr/bin/sha256sum -- "$2") || fail "cannot hash $2" 65
  [ "${got%% *}" = "$1" ] || fail "identity mismatch: $2" 65
}

new_rec() { # stdin -> $REC/<name>, created exclusively
  ( set -C; /usr/bin/cat > "$REC/$1" )
}

git_ro() { # git_ro <repo> <args...>: read-only, no optional locks, no fsmonitor
  local repo=$1
  shift
  GIT_OPTIONAL_LOCKS=0 /usr/bin/git -c core.fsmonitor=false -C "$repo" "$@"
}

resolve_node() {
  local npmver
  NODE_CMD=$(command -v node) || fail "node is not on PATH" 66
  NODE=$(/usr/bin/readlink -f -- "$NODE_CMD") || fail "cannot resolve node" 66
  [ "$NODE" = "$NODE_CMD" ] || fail "the node path is not canonical" 66
  case "$NODE" in */24.21.0/*/bin/node) ;; *) fail "the node path does not name 24.21.0" 66 ;; esac
  NODEDIR=${NODE%/*}
  NPMROOT=${NODEDIR%/bin}/lib/node_modules/npm
  NPMCLI=$NPMROOT/bin/npm-cli.js
  canon_dir "$NODEDIR" && canon_dir "$NPMROOT" || fail "the node or npm directory is not canonical" 66
  [ -f "$NODE" ] && [ ! -L "$NODE" ] && [ -f "$NPMCLI" ] && [ ! -L "$NPMCLI" ] && [ -f "$NPMROOT/package.json" ] && [ ! -L "$NPMROOT/package.json" ] || fail "node or npm file type is unexpected" 66
  [ "$(/usr/bin/stat -c %s -- "$NODE")" = "$NODE_SIZE" ] || fail "the node binary size differs" 65
  check_lit "$NODE_SHA" "$NODE"
  npmver=$(/usr/bin/awk '$1 == "\"version\":" { print $2; exit }' "$NPMROOT/package.json") || fail "cannot read the npm version" 65
  [ "$npmver" = '"11.19.0",' ] || fail "the provisioned npm is not 11.19.0" 65
  [ "$(/usr/bin/env -i "$NODE" --version)" = v24.21.0 ] || fail "the provisioned node is not v24.21.0" 65
}

check_owner() { # the capture root is a fresh private directory created by this run's pre step
  local want
  [ -d "$BASE" ] && [ ! -L "$BASE" ] && [ -d "$CAP" ] && [ ! -L "$CAP" ] && [ -d "$REC" ] && [ ! -L "$REC" ] || return 1
  [ "$(/usr/bin/stat -c '%u %a' -- "$BASE")" = "$(/usr/bin/id -u) 700" ] || return 1
  [ -f "$BASE/owner.txt" ] && [ ! -L "$BASE/owner.txt" ] || return 1
  printf -v want 'run_id=%s\nrun_attempt=%s\nsha=%s' "${GITHUB_RUN_ID:-}" "${GITHUB_RUN_ATTEMPT:-}" "${GITHUB_SHA:-}"
  [ "$(/usr/bin/cat -- "$BASE/owner.txt")" = "$want" ]
}

make_roots() {
  [ ! -e "$BASE" ] && [ ! -L "$BASE" ] || fail "the base directory already exists" 73
  /usr/bin/mkdir -m 700 -- "$BASE" || fail "cannot create the base directory" 73
  /usr/bin/mkdir -m 700 -- "$CAP" "$REC" || fail "cannot create the capture and record directories" 73
  ( set -C; printf 'run_id=%s\nrun_attempt=%s\nsha=%s\n' "$GITHUB_RUN_ID" "$GITHUB_RUN_ATTEMPT" "$GITHUB_SHA" > "$BASE/owner.txt" ) || fail "cannot write the owner marker" 73
  check_owner || fail "the ownership gate failed right after creation" 73
}

runner_metadata() { # explicit keys only; no ambient environment dump; each mandatory producer runs once and its full stdout, stderr and immediate numeric status are kept in fixed exclusive files (raw stdout keeps its trailing LF; runner.txt is the normalized combination) before any fail-closed return
  local kern rel urc orc
  ( set -C; /usr/bin/uname -srvmo > "$REC/runner-uname.out" 2> "$REC/runner-uname.err" )
  urc=$?
  printf '%s\n' "$urc" | new_rec runner-uname.rc || return 1
  [ "$urc" -eq 0 ] || return 1
  ( set -C; /usr/bin/cat /etc/os-release > "$REC/runner-os-release.out" 2> "$REC/runner-os-release.err" )
  orc=$?
  printf '%s\n' "$orc" | new_rec runner-os-release.rc || return 1
  [ "$orc" -eq 0 ] || return 1
  [ ! -s "$REC/runner-uname.err" ] && [ ! -s "$REC/runner-os-release.err" ] || return 1
  kern=$(/usr/bin/cat -- "$REC/runner-uname.out") || return 1
  rel=$(/usr/bin/cat -- "$REC/runner-os-release.out") || return 1
  [ -n "$kern" ] && [ -n "$rel" ] || return 1
  printf '%s\nImageOS=%s\nImageVersion=%s\nRUNNER_OS=%s\nRUNNER_ARCH=%s\n%s\n' "$kern" "${ImageOS:-}" "${ImageVersion:-}" "${RUNNER_OS:-}" "${RUNNER_ARCH:-}" "$rel" | new_rec runner.txt || return 1
  {
    [ -z "${NODE_OPTIONS+x}" ] || printf 'NODE_OPTIONS\n'
    [ -z "${NODE_ENV+x}" ] || printf 'NODE_ENV\n'
    [ -z "${NODE_TLS_REJECT_UNAUTHORIZED+x}" ] || printf 'NODE_TLS_REJECT_UNAUTHORIZED\n'
    [ -z "${NODE_EXTRA_CA_CERTS+x}" ] || printf 'NODE_EXTRA_CA_CERTS\n'
    [ -z "${HTTP_PROXY+x}" ] || printf 'HTTP_PROXY\n'
    [ -z "${HTTPS_PROXY+x}" ] || printf 'HTTPS_PROXY\n'
    [ -z "${http_proxy+x}" ] || printf 'http_proxy\n'
    [ -z "${https_proxy+x}" ] || printf 'https_proxy\n'
    [ -z "${NO_PROXY+x}" ] || printf 'NO_PROXY\n'
    [ -z "${SSL_CERT_FILE+x}" ] || printf 'SSL_CERT_FILE\n'
    [ -z "${SSL_CERT_DIR+x}" ] || printf 'SSL_CERT_DIR\n'
    printf 'end-of-ambient-key-names (names only, never values; the audit child is started under env -i)\n'
  } | new_rec ambient-keys.txt
}

tool_identity() { # tool_identity <path> <exact|alias>: literal path, canonical target, target type/mode/size and the target's SHA-256, tab separated
  local lit=$1 kind=$2 tgt info h
  tgt=$(/usr/bin/readlink -f -- "$lit") || return 1
  [ -n "$tgt" ] || return 1
  case "$kind" in
    exact) [ "$tgt" = "$lit" ] || return 1 ;;
    alias) case "$tgt" in /usr/*) ;; *) return 1 ;; esac ;;
    *) return 1 ;;
  esac
  [ -f "$tgt" ] && [ ! -L "$tgt" ] || return 1
  info=$(/usr/bin/stat -c '%F %a %s' -- "$tgt") || return 1
  h=$(/usr/bin/sha256sum -- "$tgt") || return 1
  printf '%s\t%s\t%s\t%s\n' "$lit" "$tgt" "$info" "${h%% *}"
}

measure_tools() { # measure_tools <tag>: measured, not preaccepted; normal runner aliases (a /usr/bin symlink to a regular /usr file) are supported, other resolutions are refused
  local tag=$1 rc=0 t
  {
    for t in "${TOOLS[@]}"; do tool_identity "$t" alias || exit 1; done
    for t in "$NODE" "$NPMCLI" "$NPMROOT/package.json"; do tool_identity "$t" exact || exit 1; done
  } | new_rec "tools.$tag.tsv" || rc=1
  { for t in "$NODE" "$NPMCLI" "$NPMROOT/package.json"; do /usr/bin/sha256sum -- "$t" || exit 1; done; } | new_rec "node-ident.$tag" || rc=1
  { printf 'node %s\nnodedir %s\nnpmroot %s\nnpmcli %s\n' "$NODE" "$NODEDIR" "$NPMROOT" "$NPMCLI"; /usr/bin/readlink -f -- /usr/bin/python3 || exit 1; } | new_rec "paths.$tag.txt" || rc=1
  return "$rc"
}

measure_npm() { # the full hosted npm directory type/mode/path listing, every regular file's SHA-256 and byte size with exact membership; only regular files and directories are supported
  local tag=$1 rc=0
  ( cd -- "$NPMROOT" && /usr/bin/find . -mindepth 1 -printf '%y %m %l|%P\n' | LC_ALL=C /usr/bin/sort ) | new_rec "npm-tree.$tag.find" || rc=1
  ( cd -- "$NPMROOT" && /usr/bin/find . -mindepth 1 ! -type f ! -type d -print ) | new_rec "npm-nonregular.$tag.txt" || rc=1
  [ ! -s "$REC/npm-nonregular.$tag.txt" ] || rc=1
  ( cd -- "$NPMROOT" && /usr/bin/find . -type f -print0 | LC_ALL=C /usr/bin/sort -z | /usr/bin/timeout -s TERM -k 5 60 /usr/bin/xargs -r -0 /usr/bin/sha256sum -- ) | new_rec "npm-tree.$tag.sha256" || rc=1
  ( cd -- "$NPMROOT" && /usr/bin/find . -type f -print0 | LC_ALL=C /usr/bin/sort -z | /usr/bin/timeout -s TERM -k 5 60 /usr/bin/xargs -r -0 /usr/bin/stat --printf='%s\t%n\n' -- ) | new_rec "npm-sizes.$tag.tsv" || rc=1
  /usr/bin/awk '{ print substr($0, 67) }' "$REC/npm-tree.$tag.sha256" | new_rec "npm-paths.$tag.hash" || rc=1
  /usr/bin/cut -f2 "$REC/npm-sizes.$tag.tsv" | new_rec "npm-paths.$tag.sizes" || rc=1
  /usr/bin/awk '$1 == "f" { i = index($0, "|"); print "./" substr($0, i + 1) }' "$REC/npm-tree.$tag.find" | LC_ALL=C /usr/bin/sort | new_rec "npm-paths.$tag.find" || rc=1
  /usr/bin/cmp -- "$REC/npm-paths.$tag.hash" "$REC/npm-paths.$tag.sizes" || rc=1
  /usr/bin/cmp -- "$REC/npm-paths.$tag.hash" "$REC/npm-paths.$tag.find" || rc=1
  [ -s "$REC/npm-paths.$tag.find" ] || rc=1
  return "$rc"
}

derive_source() { # the immutable source360 expectation comes only from the pinned four-column inventory
  check_lit "$INV_SHA" "$INV"
  [ "$(/usr/bin/stat -c %s -- "$INV")" = "$INV_SIZE" ] || fail "the inventory size differs" 65
  /usr/bin/awk -F'\t' 'NF != 4 || $1 !~ /^[!-~]+$/ || seen[$1]++ { bad = 1 } END { exit (bad || NR != 360) }' "$INV" || fail "the inventory is not 360 unique printable four-column rows" 65
  /usr/bin/awk -F'\t' '{ print $4 "  " $1 }' "$INV" | new_rec source360.sha256 || fail "cannot derive source360.sha256" 65
  /usr/bin/awk -F'\t' '{ print $2 " " $3 " " $1 }' "$INV" | LC_ALL=C /usr/bin/sort -k3 | new_rec source360.find || fail "cannot derive source360.find" 65
  check_lit "$SRC_SHA256_LIST_SHA" "$REC/source360.sha256"
  check_lit "$SRC_FIND_LIST_SHA" "$REC/source360.find"
}

measure_source() { # all 360 files, lengths, modes; nothing else but .git and node_modules; no specials; clean state; the status command's status and stderr are retained and rejected when failed or nonempty
  local tag=$1 rc=0 actual expected st
  ( cd -- "$TARGET" && /usr/bin/timeout -s TERM -k 5 60 /usr/bin/sha256sum --check --quiet "$REC/source360.sha256" ) > "$REC/source360.$tag.check" 2>&1 || rc=1
  ( cd -- "$TARGET" && /usr/bin/find . \( -path ./.git -o -path ./node_modules \) -prune -o -type f -printf '%m %s %P\n' | LC_ALL=C /usr/bin/sort -k3 ) > "$REC/source360.$tag.find" || rc=1
  /usr/bin/cmp -- "$REC/source360.$tag.find" "$REC/source360.find" || rc=1
  ( cd -- "$TARGET" && /usr/bin/find . \( -path ./.git -o -path ./node_modules \) -prune -o ! -type f ! -type d -print ) > "$REC/source-nonregular.$tag.txt" || rc=1
  [ ! -s "$REC/source-nonregular.$tag.txt" ] || rc=1
  [ ! -e "$TARGET/node_modules" ] && [ ! -L "$TARGET/node_modules" ] || rc=1
  actual=$(git_ro "$TARGET" rev-parse HEAD 'HEAD^{tree}' 'HEAD^') || rc=1
  printf '%s\n' "$actual" > "$REC/source-identity.$tag.txt" || rc=1
  printf -v expected '%s\n%s\n%s' "$SOURCE_SHA" "$SOURCE_TREE" "$SOURCE_PARENT"
  [ "$actual" = "$expected" ] || rc=1
  st=$(git_ro "$TARGET" status --porcelain=v1 --ignored --untracked-files=all 2>"$REC/source-status.$tag.err") || rc=1
  printf '%s\n' "$st" > "$REC/source-status.$tag.txt" || rc=1
  [ -z "$st" ] && [ ! -s "$REC/source-status.$tag.err" ] || rc=1
  git_ro "$TARGET" diff --quiet || rc=1
  git_ro "$TARGET" diff --cached --quiet || rc=1
  return "$rc"
}

measure_control() { # the control commit, its sole parent (the source), the complete 363-entry tree, the three bodies bound to their committed blobs AND copied completely; no self-referential hash is claimed
  local tag=$1 rc=0 head p want got sz h1 h2 i cdir dest cst cst_rc
  head=$(git_ro "$CONTROL" rev-parse HEAD) || rc=1
  printf '%s\n' "$head" > "$REC/control-head.$tag.txt" || rc=1
  [ "$head" = "${GITHUB_SHA:-}" ] || rc=1
  git_ro "$CONTROL" cat-file commit HEAD > "$REC/control-commit.$tag.txt" || rc=1
  [ "$(/usr/bin/awk '/^$/ { exit } /^parent / { n++ } END { print n + 0 }' "$REC/control-commit.$tag.txt")" = 1 ] || rc=1
  [ "$(/usr/bin/awk '/^$/ { exit } /^parent / { print $2 }' "$REC/control-commit.$tag.txt")" = "$SOURCE_SHA" ] || rc=1
  git_ro "$CONTROL" ls-tree -r HEAD > "$REC/control-tree.$tag.txt" || rc=1
  git_ro "$TARGET" ls-tree -r "$SOURCE_SHA" > "$REC/source-tree.$tag.txt" || rc=1
  [ "$(/usr/bin/wc -l < "$REC/control-tree.$tag.txt")" = 363 ] || rc=1
  [ "$(/usr/bin/wc -l < "$REC/source-tree.$tag.txt")" = 360 ] || rc=1
  /usr/bin/awk -F'\t' -v a="${CTRL_FILES[0]}" -v b="${CTRL_FILES[1]}" -v c="${CTRL_FILES[2]}" '$2 != a && $2 != b && $2 != c' "$REC/control-tree.$tag.txt" > "$REC/control-minus-three.$tag.txt" || rc=1
  /usr/bin/cmp -- "$REC/control-minus-three.$tag.txt" "$REC/source-tree.$tag.txt" || rc=1
  /usr/bin/awk -F'\t' -v a="${CTRL_FILES[0]}" -v b="${CTRL_FILES[1]}" -v c="${CTRL_FILES[2]}" '$2 == a || $2 == b || $2 == c { split($1, m, " "); if (m[1] != "100644" || m[2] != "blob") bad = 1; n++ } END { exit (bad || n != 3) }' "$REC/control-tree.$tag.txt" || rc=1
  cdir=$REC/control-copy.$tag
  /usr/bin/mkdir -m 700 -- "$cdir" || rc=1
  for i in 0 1 2; do
    p=${CTRL_FILES[$i]}
    dest=$cdir/${COPY_NAMES[$i]}
    [ -f "$CONTROL/$p" ] && [ ! -L "$CONTROL/$p" ] && [ "$(/usr/bin/stat -c %a -- "$CONTROL/$p")" = 644 ] || rc=1
    sz=$(/usr/bin/stat -c %s -- "$CONTROL/$p") || rc=1
    want=$(/usr/bin/awk -F'\t' -v p="$p" '$2 == p { split($1, m, " "); print m[3] }' "$REC/control-tree.$tag.txt") || rc=1
    got=$(git_ro "$CONTROL" hash-object --no-filters -- "$CONTROL/$p") || rc=1
    [ -n "$want" ] && [ "$got" = "$want" ] || rc=1
    if [ "${sz:-2097152}" -le 1048576 ]; then
      ( set -C; /usr/bin/cat -- "$CONTROL/$p" > "$dest" ) || rc=1
      /usr/bin/cmp -- "$CONTROL/$p" "$dest" || rc=1
      [ "$(/usr/bin/stat -c %s -- "$dest")" = "$sz" ] || rc=1
      h1=$(/usr/bin/sha256sum -- "$CONTROL/$p") || rc=1
      h2=$(/usr/bin/sha256sum -- "$dest") || rc=1
      [ "${h1%% *}" = "${h2%% *}" ] || rc=1
      got=$(git_ro "$CONTROL" hash-object --no-filters -- "$dest") || rc=1
      [ -n "$want" ] && [ "$got" = "$want" ] || rc=1
    else
      rc=1
    fi
  done
  ( cd -- "$CONTROL" && /usr/bin/sha256sum -- "${CTRL_FILES[@]}" ) | new_rec "control-bodies.$tag.sha256" || rc=1
  ( cd -- "$cdir" && /usr/bin/sha256sum -- "${COPY_NAMES[@]}" ) | new_rec "control-copy-hashes.$tag.sha256" || rc=1
  [ "$(/usr/bin/sha256sum -- "$CONTROL/.github/workflows/ci.yml" | /usr/bin/cut -d' ' -f1)" = "$CI_YML_SHA" ] || rc=1
  cst=$(git_ro "$CONTROL" status --porcelain=v1 --ignored --untracked-files=all 2>"$REC/control-status.$tag.err")
  cst_rc=$?
  printf '%s\n' "$cst" > "$REC/control-status.$tag.txt" || rc=1
  printf '%s\n' "$cst_rc" > "$REC/control-status.$tag.rc" || rc=1
  [ "$cst_rc" -eq 0 ] && [ -z "$cst" ] && [ ! -s "$REC/control-status.$tag.err" ] || rc=1
  git_ro "$CONTROL" diff --quiet || rc=1
  git_ro "$CONTROL" diff --cached --quiet || rc=1
  return "$rc"
}

pre_mode() {
  check_env
  resolve_node
  canon_dir "$WORKSPACE" && canon_dir "$TARGET" && canon_dir "$CONTROL" && canon_dir "$RT" || fail "a required directory is not canonical" 66
  make_roots
  runner_metadata || fail "cannot record the runner metadata (see $REC)" 67
  measure_tools pre || fail "cannot record the tool identities (see $REC)" 69
  measure_npm pre || fail "the hosted npm closure has an unsupported type, inconsistent membership or cannot be recorded (see $REC)" 69
  derive_source
  measure_source pre || fail "source binding failed before the audit (see $REC)" 69
  measure_control pre || fail "control binding failed before the audit (see $REC)" 69
  printf 'pre ok run_id=%s attempt=%s\n' "$GITHUB_RUN_ID" "$GITHUB_RUN_ATTEMPT" | new_rec pre.ok || fail "cannot write the pre marker" 67
}

audit_mode() {
  local pid sigs seen prev rc outer start_utc end_utc start_epoch end_epoch
  check_env
  resolve_node
  [ -f "$REC/pre.ok" ] || fail "the pre binding record is missing" 71
  check_owner || fail "the ownership gate failed" 71
  /usr/bin/sha256sum -- "$NODE" "$NPMCLI" "$NPMROOT/package.json" | /usr/bin/cmp -- - "$REC/node-ident.pre" || fail "node or npm identity changed since the pre step" 69
  /usr/bin/mkdir -m 700 -- "$CAP/home" "$CAP/tmp" "$CAP/cache" || fail "cannot create the capture directories" 67
  /usr/bin/touch -- "$CAP/userconfig.empty" "$CAP/globalconfig.empty" || fail "cannot create the empty config files" 67
  cd -- "$TARGET" || fail "cannot enter the audited checkout" 66
  ulimit -c 0 || fail "cannot disable core dumps" 68
  ulimit -f 131072 || fail "cannot set the file-size limit" 68
  /usr/bin/awk '/^Max core file size|^Max file size/' /proc/self/limits | new_rec limits.txt || fail "cannot record the limits" 68
  [ -s "$REC/limits.txt" ] || fail "the limits record is empty" 68
  AUDIT_ARGS=(audit --package-lock-only --audit-level=high --include=dev --include=optional --include=peer --ignore-scripts --json
    --registry=https://registry.npmjs.org/ --strict-ssl=true --fetch-retries=0 --fetch-timeout=30000 --update-notifier=false
    "--userconfig=$CAP/userconfig.empty" "--globalconfig=$CAP/globalconfig.empty" "--cache=$CAP/cache")
  printf '%s\n' "$NODE" "$NPMCLI" "${AUDIT_ARGS[@]}" > "$CAP/argv.txt" || fail "cannot write audit argv capture" 78

  pid=
  sigs=0
  forward() { sigs=$((sigs + 1)); [ -n "$pid" ] && kill -TERM "$pid" 2>/dev/null; return 0; }
  trap forward TERM INT HUP

  printf -v start_utc '%(%Y-%m-%dT%H:%M:%SZ)T' -1
  start_epoch=$EPOCHREALTIME
  [ "$sigs" -eq 0 ] || fail "signal received before audit launch" 76
  /usr/bin/env -i PATH="$NODEDIR:/usr/bin:/bin" HOME="$CAP/home" TMPDIR="$CAP/tmp" LANG=C.UTF-8 LC_ALL=C.UTF-8 CI=true \
    /usr/bin/timeout --signal=TERM --kill-after=5 60 \
    "$NODE" "$NPMCLI" "${AUDIT_ARGS[@]}" \
    >"$CAP/audit.json" 2>"$CAP/audit.stderr" &
  pid=$!
  if [ "$sigs" -ne 0 ]; then kill -TERM "$pid" 2>/dev/null || :; fi
  prev=
  while :; do
    seen=$sigs
    wait "$pid"
    rc=$?
    if [ "$rc" -eq 127 ] && [ -n "$prev" ]; then rc=$prev; fi
    prev=$rc
    [ "$sigs" -ne "$seen" ] && continue
    break
  done
  trap 'sigs=$((sigs + 1))' TERM INT HUP
  end_epoch=$EPOCHREALTIME
  printf -v end_utc '%(%Y-%m-%dT%H:%M:%SZ)T' -1

  trap 'exit 76' TERM INT HUP
  outer=$rc
  [ -e "$CAP/audit.json" ] && [ -e "$CAP/audit.stderr" ] || outer=79
  [ "$sigs" -eq 0 ] || outer=76
  printf '{"timeout_exit":%d,"launcher_exit":%d,"signals_before_status":%d,"timeout_term_seconds":60,"timeout_kill_grace_seconds":5,"start_utc":"%s","end_utc":"%s","start_epoch":"%s","end_epoch":"%s"}\n' \
    "$rc" "$outer" "$sigs" "$start_utc" "$end_utc" "$start_epoch" "$end_epoch" | new_rec audit-outer-status.json \
    || { printf 'run-audit: cannot write audit-outer-status.json\n' >&2; exit 78; }
  [ -s "$REC/audit-outer-status.json" ] || { printf 'run-audit: audit-outer-status.json is empty\n' >&2; exit 78; }
  [ "$sigs" -eq 0 ] || printf 'run-audit: signal received; result remains HOLD\n' >&2
  exit "$outer"
}

post_mode() {
  local rc=0 pair a b
  check_env
  resolve_node
  [ -f "$REC/pre.ok" ] || fail "the pre binding record is missing" 71
  check_owner || fail "the ownership gate failed" 71
  measure_tools post || rc=1
  measure_npm post || rc=1
  measure_source post || rc=1
  measure_control post || rc=1
  for pair in tools.pre.tsv:tools.post.tsv node-ident.pre:node-ident.post paths.pre.txt:paths.post.txt \
    npm-tree.pre.find:npm-tree.post.find npm-tree.pre.sha256:npm-tree.post.sha256 npm-sizes.pre.tsv:npm-sizes.post.tsv source-identity.pre.txt:source-identity.post.txt \
    source360.pre.find:source360.post.find control-head.pre.txt:control-head.post.txt control-commit.pre.txt:control-commit.post.txt \
    control-tree.pre.txt:control-tree.post.txt control-bodies.pre.sha256:control-bodies.post.sha256 control-copy-hashes.pre.sha256:control-copy-hashes.post.sha256 \
    control-copy.pre/workflow.yml:control-copy.post/workflow.yml control-copy.pre/run-audit.sh:control-copy.post/run-audit.sh control-copy.pre/inventory-360.tsv:control-copy.post/inventory-360.tsv; do
    a=${pair%%:*}
    b=${pair##*:}
    /usr/bin/cmp -- "$REC/$a" "$REC/$b" || rc=1
  done
  [ "$rc" -eq 0 ] || fail "drift or a failed binding after the audit (see $REC)" 77
  printf 'post ok\n' | new_rec post.ok || fail "cannot write the post marker" 67
}

validate_mode() { # the facts and the reasons are always written when ownership permits; a structurally invalid or missing report returns nonzero (the raw audit status is separate)
  local vrc
  check_env
  check_owner || fail "the ownership gate failed" 71
  /usr/bin/python3 -I -B -c '
import json, sys
path, out = sys.argv[1], sys.argv[2]
SEV = ("info", "low", "moderate", "high", "critical")


def no_dups(pairs):
    seen = {}
    for key, value in pairs:
        if key in seen:
            raise ValueError("duplicate key " + key)
        seen[key] = value
    return seen


def is_count(value):
    return type(value) is int and value >= 0


facts = {"file_present": False, "parseable": False}
reasons = []
try:
    with open(path, "rb") as stream:
        raw = stream.read()
    facts["file_present"] = True
    facts["bytes"] = len(raw)
except FileNotFoundError:
    reasons.append("audit.json is missing")
else:
    try:
        data = json.loads(raw, object_pairs_hook=no_dups)
        facts["parseable"] = True
    except Exception as exc:
        reasons.append("not parseable JSON: " + type(exc).__name__)
    else:
        if not isinstance(data, dict):
            reasons.append("top level is not an object")
        else:
            facts["top_level_keys"] = sorted(data.keys())
            version = data.get("auditReportVersion")
            facts["audit_report_version"] = version
            if type(version) is not int or version != 2:
                reasons.append("auditReportVersion is not the integer 2")
            if "error" in data:
                reasons.append("a top-level error key is present")
            vulns = data.get("vulnerabilities")
            if not isinstance(vulns, dict):
                reasons.append("vulnerabilities is not an object")
            else:
                facts["vulnerability_names"] = sorted(vulns.keys())
            meta = data.get("metadata")
            counts = meta.get("vulnerabilities") if isinstance(meta, dict) else None
            facts["vulnerability_counts"] = counts
            if not isinstance(counts, dict):
                reasons.append("metadata.vulnerabilities is not an object")
            else:
                bad = [k for k in SEV + ("total",) if not is_count(counts.get(k))]
                if bad:
                    reasons.append("invalid count fields: " + ",".join(bad))
                elif sum(counts[k] for k in SEV) != counts["total"]:
                    reasons.append("the severity counts do not sum to total")
facts["reasons"] = reasons
facts["structurally_valid"] = not reasons
with open(out, "x") as stream:
    json.dump(facts, stream, sort_keys=True)
    stream.write("\n")
sys.exit(1 if reasons else 0)
' "$CAP/audit.json" "$REC/validation.json"
  vrc=$?
  [ "$vrc" -eq 0 ] || printf 'run-audit: structural validation returned %s; see %s\n' "$vrc" "$REC/validation.json" >&2
  return "$vrc"
}

collect_mode() {
  local rc=0 n big total files dirs members vh vs dups dups_rc
  check_env
  check_owner || fail "ownership of the capture root is not established; no upload snapshot is created" 71
  [ ! -e "$UP" ] && [ ! -L "$UP" ] && [ ! -e "$VER" ] && [ ! -L "$VER" ] || fail "the upload or verification directory already exists" 73
  /usr/bin/mkdir -m 700 -- "$UP" || fail "cannot create the upload directory" 73
  [ -n "${GITHUB_OUTPUT:-}" ] && [ -f "$GITHUB_OUTPUT" ] && [ ! -L "$GITHUB_OUTPUT" ] || fail "GITHUB_OUTPUT is not a regular file" 74
  printf 'upload_ready=true\n' >> "$GITHUB_OUTPUT" || fail "cannot publish upload_ready" 74
  /usr/bin/mkdir -m 700 -- "$VER" || rc=1
  ( cd -- "$BASE" && /usr/bin/find owner.txt c r -printf '%y %m %u %s %p\n' | LC_ALL=C /usr/bin/sort ) > "$UP/entries.tsv" || rc=1
  ( cd -- "$BASE" && /usr/bin/find owner.txt c r ! -type f ! -type d -print ) > "$UP/nonregular.txt" || rc=1
  [ ! -s "$UP/nonregular.txt" ] || rc=1
  n=$(cd -- "$BASE" && /usr/bin/find owner.txt c r | /usr/bin/wc -l) || rc=1
  big=$(cd -- "$BASE" && /usr/bin/find owner.txt c r -type f -size +65536k -print | /usr/bin/wc -l) || rc=1
  total=$(cd -- "$BASE" && /usr/bin/find owner.txt c r -type f -printf '%s\n' | /usr/bin/awk '{ s += $1 } END { print s + 0 }') || rc=1
  if [ "${n:-9999}" -gt 4096 ] || [ "${big:-1}" -ne 0 ] || [ "${total:-999999999999}" -gt 536870912 ]; then
    rc=1
  fi
  if [ "$rc" -eq 0 ]; then
    ( cd -- "$BASE" && /usr/bin/find owner.txt c r -type f -print0 | LC_ALL=C /usr/bin/sort -z | /usr/bin/tar --null --no-recursion -T - -cf - ) | /usr/bin/tar -C "$UP" -xf - || rc=1
  fi
  # R5: exact copied-payload proof. Source side: every regular file below owner.txt, c, r. Copy side: every regular file of the upload root except the two collector files and the three root metadata paths.
  ( cd -- "$BASE" && /usr/bin/find ./owner.txt ./c ./r -type f -print0 | LC_ALL=C /usr/bin/sort -z | /usr/bin/xargs -r -0 /usr/bin/sha256sum -- ) > "$VER/src.sha256" || rc=1
  ( cd -- "$BASE" && /usr/bin/find ./owner.txt ./c ./r -type f -print0 | LC_ALL=C /usr/bin/sort -z | /usr/bin/xargs -r -0 /usr/bin/stat --printf='%s\t%n\n' -- ) > "$VER/src.sizes" || rc=1
  ( cd -- "$UP" && /usr/bin/find . -type f ! -path ./entries.tsv ! -path ./nonregular.txt ! -path ./MANIFEST.sha256 ! -path ./SIZES.tsv ! -path ./collect-status.json -print0 | LC_ALL=C /usr/bin/sort -z | /usr/bin/xargs -r -0 /usr/bin/sha256sum -- ) > "$VER/up.sha256" || rc=1
  ( cd -- "$UP" && /usr/bin/find . -type f ! -path ./entries.tsv ! -path ./nonregular.txt ! -path ./MANIFEST.sha256 ! -path ./SIZES.tsv ! -path ./collect-status.json -print0 | LC_ALL=C /usr/bin/sort -z | /usr/bin/xargs -r -0 /usr/bin/stat --printf='%s\t%n\n' -- ) > "$VER/up.sizes" || rc=1
  vh=0
  /usr/bin/cmp -- "$VER/src.sha256" "$VER/up.sha256" || vh=1
  vs=0
  /usr/bin/cmp -- "$VER/src.sizes" "$VER/up.sizes" || vs=1
  printf 'source_to_copy_hash_equal_status=%s\nsource_to_copy_size_equal_status=%s\n(0 means byte-for-byte equal member, hash and size lists)\n' "$vh" "$vs" > "$UP/payload-verification.txt" || rc=1
  [ "$vh" -eq 0 ] && [ "$vs" -eq 0 ] || rc=1
  # The ledgers cover every regular file of the upload root except exactly the three root metadata paths (same-named nested raw files stay members).
  ( cd -- "$UP" && /usr/bin/find . -type f ! -path ./MANIFEST.sha256 ! -path ./SIZES.tsv ! -path ./collect-status.json -print0 | LC_ALL=C /usr/bin/sort -z | /usr/bin/xargs -r -0 /usr/bin/sha256sum -- ) > "$UP/MANIFEST.sha256" || rc=1
  ( cd -- "$UP" && /usr/bin/find . -type f ! -path ./MANIFEST.sha256 ! -path ./SIZES.tsv ! -path ./collect-status.json -print0 | LC_ALL=C /usr/bin/sort -z | /usr/bin/xargs -r -0 /usr/bin/stat --printf='%s\t%n\n' -- ) > "$UP/SIZES.tsv" || rc=1
  ( cd -- "$UP" && /usr/bin/find . -type f ! -path ./MANIFEST.sha256 ! -path ./SIZES.tsv ! -path ./collect-status.json -print | LC_ALL=C /usr/bin/sort ) > "$VER/members.txt" || rc=1
  /usr/bin/awk '{ print substr($0, 67) }' "$UP/MANIFEST.sha256" > "$VER/manifest.members" || rc=1
  /usr/bin/cut -f2 "$UP/SIZES.tsv" > "$VER/sizes.members" || rc=1
  /usr/bin/cmp -- "$VER/members.txt" "$VER/manifest.members" || rc=1
  /usr/bin/cmp -- "$VER/members.txt" "$VER/sizes.members" || rc=1
  dups=$( { LC_ALL=C /usr/bin/sort "$VER/members.txt" | /usr/bin/uniq -d | /usr/bin/wc -l; } 2>"$VER/dups.err")
  dups_rc=$?
  printf 'run-audit: duplicate-member check status=%s count=%s\n' "$dups_rc" "${dups:-none}"
  [ ! -s "$VER/dups.err" ] || /usr/bin/cat -- "$VER/dups.err" >&2
  [ "$dups_rc" -eq 0 ] && [ "$dups" = 0 ] || rc=1
  ( cd -- "$UP" && /usr/bin/sha256sum --check --strict MANIFEST.sha256 ) || rc=1
  members=$(/usr/bin/wc -l < "$VER/members.txt") || rc=1
  files=$(cd -- "$BASE" && /usr/bin/find owner.txt c r -type f | /usr/bin/wc -l) || rc=1
  dirs=$(cd -- "$BASE" && /usr/bin/find c r -type d | /usr/bin/wc -l) || rc=1
  printf '{"collect_rc":%d,"entries_seen":%s,"source_regular_files":%s,"source_directories":%s,"source_regular_bytes":%s,"ledger_members":%s,"duplicate_check_status":%s,"duplicate_member_count":"%s","limits":{"entries":4096,"file_bytes":67108864,"total_bytes":536870912}}\n' \
    "$rc" "${n:-null}" "${files:-null}" "${dirs:-null}" "${total:-null}" "${members:-null}" "${dups_rc:-null}" "${dups:-unset}" > "$UP/collect-status.json" || rc=1
  [ "$rc" -eq 0 ] || fail "collection incomplete, a limit was exceeded or a ledger did not match; the partial snapshot stays HOLD" 75
}

"${MODE}_mode"
exit $?
