#!/usr/bin/python3
"""PR32 TU11 diagnostic: fixed source/control/tool binding, verdict, evidence collection. Python standard library only.

PROPOSED (proposal003), NOT RUN, NOT PARSED, NOT SYNTAX-CHECKED by its author. Hosted ubuntu-24.04 only. Subcommands: pre | precheck | post | validate | collect.
There are NO other arguments, options or environment-selected paths: every path, hash and identity below is a literal. GITHUB_SHA identifies the
diagnostic CONTROL commit and is recorded SEPARATELY from the tested SOURCE commit; it is never treated as the product head, and this file does not
reuse the required workflow's PR/merge identity acceptance. The job's final gate is a separate outcome-only workflow step; nothing here runs after the upload.
The only use of the runner-provided GITHUB_OUTPUT channel is `collect` publishing the fixed boolean `upload_ready=true`, and only after it has verified
ownership of the capture root and exclusively created the fresh upload directory; the upload step is conditioned on exactly that output.
"""
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import time
from pathlib import Path

SOURCE_SHA = "510f832cfea0eb3333f1b6beba65d0a1e3624eaf"
SOURCE_PARENT = "fd9f8b8ede0ce9e9dc00a28bcf43ad56839e2526"
SOURCE_TREE = "d01cefbaa0db88134bbdc85282a64a47079c12ab"
INVENTORY_SHA256 = "272ef01442321c828e1733d66bb12c3b0526efc4eff236b74d4df8e41c607911"
EXPECTED_FILES = 352
UNIT_PATH = "test/unit/speech-texture-plan.test.ts"
UNIT_SHA256 = "0fe80dc0b18f3a12ede45067d7e3e3b917f0029d0c0329bc6071e830f4ffd3cd"
UNIT_BLOB = "af656aedb6c4afca011f93142a8be933afae351b"
UNIT_BYTES = 311031
PKG_SHA256 = "8f93210a55c0500f00b663488a82630e20035283a48a99a8dfb468f647c48297"
LOCK_SHA256 = "d9c5387d473b5406636800ce99ef92670f9192297e355d03028f6214161980bd"
CI_REL = ".github/workflows/ci.yml"
CI_SHA256 = "8ada7fc271e4a1bc05980202775697f51e682f53079924903490b576c82803d4"
CI_BLOB = "5e087d1afe6df649575113c24d27140850e2da47"
NODE_VERSION = "24.21.0"
NPM_VERSION = "11.19.0"
VITEST_VERSION = "4.1.12"
SUITE_TITLE = "speech texture plan, admission, reconciliation, classification and stop mapping (unit)"
TU11_NAME = "TU11 protected tokens: numeric, quoted, hedge, negation and punctuation class, in that order, on each changed turn"
WORKSPACE = Path("/home/runner/work/the-desk/the-desk")
TARGET = WORKSPACE / "pr32-tu11-target"
CONTROL = WORKSPACE / "pr32-tu11-control"
TEMP = Path("/home/runner/work/_temp")
BASE = TEMP / "t11"          # short on purpose: the inherited guard binds a unix socket below CAP/tmp (F1)
CAP = BASE / "c"
UPLOAD = BASE / "u"
CDIR = CONTROL / "diagnostic/pr32-tu11"
INVENTORY_FILE = CDIR / "inventory-352.tsv"
# The complete reviewed control delta: five additions to the tested source tree, each committed as a regular 100644 blob.
CONTROL_FILES = (
    ".github/workflows/pr32-tu11-diagnostic.yml",
    "diagnostic/pr32-tu11/inventory-352.tsv",
    "diagnostic/pr32-tu11/p33-tu11-supervisor.py",
    "diagnostic/pr32-tu11/run-tu11.sh",
    "diagnostic/pr32-tu11/tu11_bind.py",
)
SYSTEM_TOOLS = ("/usr/bin/python3", "/usr/bin/timeout", "/usr/bin/env", "/bin/bash", "/usr/bin/git", "/usr/bin/ps", "/usr/bin/sha256sum")
GUARD_ARGV = ("/usr/bin/timeout --signal=TERM --kill-after=20 300 /usr/bin/python3 "
              "/home/runner/work/the-desk/the-desk/pr32-tu11-control/diagnostic/pr32-tu11/p33-tu11-supervisor.py guard tu11\n")
ENV_KEYS = ("PATH\nHOME\nTMPDIR\nLANG\nLC_ALL\nTZ\nCI\n", "PATH\nHOME\nTMPDIR\nLANG\nLC_ALL\nTZ\nCI\nRUNNER_TRACKING_ID\n")
ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
SOCKET_LIMIT = 108                  # sizeof(sockaddr_un.sun_path): the pathname plus its terminator must fit, so the pathname must be < 108 bytes
MAX_FILE = 64 * 1024 * 1024         # source, capture and read allowance (unchanged)
TOOL_MAX = 256 * 1024 * 1024        # separate read ceiling for explicit executable/tool hashing only (F2)
COLLECT_ENTRIES = 4096              # collection ceilings only (F4); not runtime allowances
COLLECT_DEPTH = 24
COLLECT_FILE = 64 * 1024 * 1024
COLLECT_TOTAL = 512 * 1024 * 1024
SOCKET_RE = re.compile(r"tmp/the-desk-p33-[0-9]+-[0-9a-f]{24}/attempt-[A-Za-z0-9_]{8}/guard\.sock")
VERDICT_PASS = "TU11_DIAGNOSTIC_PASS_ONE_CASE_ONLY"
T0 = time.monotonic()
MISSING = object()
UPLOAD_STATE = {"created": False}   # True only after THIS process exclusively created UPLOAD; a pre-existing directory is never ours to write into
LEDGER = []       # every fixed binding/version query of this process: argv, cwd, status, streams, timing
PARTIAL = {}      # measurements completed so far in this process


class Hold(Exception):
    """A closed stop: the message is a fixed label, never an input."""


def need(ok, label):
    if not ok:
        raise Hold(label)


def utc():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha256_file(path, limit=MAX_FILE):
    h = hashlib.sha256()
    size = 0
    with open(path, "rb") as stream:
        while True:
            block = stream.read(1 << 20)
            if not block:
                break
            size += len(block)
            need(size <= limit, "file_over_cap")
            h.update(block)
    return h.hexdigest(), size


def git_blob(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def as_text(value):
    if value is None:
        return ""
    return value.decode("utf-8", "replace") if isinstance(value, bytes) else str(value)


def run(argv, cwd, extra_path=None):
    """A short bounded fixed query: closed stdin (an empty pipe), capture-local HOME/TMPDIR, minimal environment. The complete argv/cwd/status/
    streams/timing are retained in the ledger FIRST, then any nonzero status, timeout or launch error is a HOLD. Never retried. Returns stdout text."""
    env = {"PATH": (extra_path + ":" if extra_path else "") + "/usr/bin:/bin", "HOME": str(CAP / "home"), "TMPDIR": str(CAP / "tmp"), "LANG": "C.UTF-8",
           "LC_ALL": "C.UTF-8", "GIT_OPTIONAL_LOCKS": "0", "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": str(CAP / "home/gitconfig-absent")}
    entry = {"argv": list(argv), "cwd": str(cwd)}
    started = time.monotonic()
    try:
        done = subprocess.run(argv, cwd=cwd, env=env, input=b"", capture_output=True, timeout=30, check=False)
    except subprocess.TimeoutExpired as error:
        entry.update(status="timeout_status_unknown", returncode=None, stdout=as_text(error.stdout), stderr=as_text(error.stderr),
                     seconds=round(time.monotonic() - started, 6))
        LEDGER.append(entry)
        raise Hold("command_timeout")
    except Exception as error:
        entry.update(status="launch_error:" + type(error).__name__, returncode=None, stdout="", stderr="", seconds=round(time.monotonic() - started, 6))
        LEDGER.append(entry)
        raise Hold("command_launch_error")
    entry.update(status="completed", returncode=done.returncode, stdout=as_text(done.stdout), stderr=as_text(done.stderr),
                 seconds=round(time.monotonic() - started, 6))
    LEDGER.append(entry)
    need(done.returncode == 0, "command_nonzero_status:" + os.path.basename(argv[0]))
    return entry["stdout"]


def real_dir(path, label):
    need(path.is_dir() and not path.is_symlink() and Path(os.path.realpath(path)) == path, label)


def walk(root):
    """Exact nonfollowing membership of `root`, excluding only the top-level .git and node_modules entries. Modes keep every permission bit."""
    rows, dirs = {}, set()

    def visit(directory, prefix):
        with os.scandir(directory) as entries:
            ordered = sorted(entries, key=lambda e: e.name.encode())
        for entry in ordered:
            if prefix == "" and entry.name in (".git", "node_modules"):
                continue
            rel = prefix + entry.name
            st = entry.stat(follow_symlinks=False)
            if stat.S_ISDIR(st.st_mode):
                dirs.add(rel)
                visit(entry.path, rel + "/")
            elif stat.S_ISREG(st.st_mode):
                need(st.st_nlink == 1, "multilink_file:" + rel)
                digest, size = sha256_file(entry.path)
                need(size == st.st_size, "size_race:" + rel)
                rows[rel] = ("%o" % stat.S_IMODE(st.st_mode), size, digest)
            else:
                raise Hold("link_or_special_member:" + rel)

    visit(str(root), "")
    return rows, dirs


def expected_inventory():
    data = INVENTORY_FILE.read_bytes()
    need(sha256_bytes(data) == INVENTORY_SHA256, "inventory_file_identity")
    rows = {}
    for line in data.decode("utf-8").split("\n"):
        if not line:
            continue
        path, mode, size, digest = line.split("\t")
        rows[path] = (mode, int(size), digest)
    need(len(rows) == EXPECTED_FILES, "inventory_row_count")
    return rows


def _ancestors(path):
    parts = path.split("/")[:-1]
    return {"/".join(parts[: i + 1]) for i in range(len(parts))}


def measure_source():
    """A fresh read of the target checkout (git identity plus a complete nonfollowing 352-file walk); pre and post each perform their own."""
    real_dir(TARGET, "target_checkout_dir")
    head = run(["/usr/bin/git", "-C", str(TARGET), "rev-parse", "HEAD"], TARGET).strip()
    tree = run(["/usr/bin/git", "-C", str(TARGET), "rev-parse", "HEAD^{tree}"], TARGET).strip()
    parents = run(["/usr/bin/git", "-C", str(TARGET), "rev-list", "--parents", "-n1", "HEAD"], TARGET).split()
    need(head == SOURCE_SHA, "target_head_is_not_the_literal_source_commit")
    need(tree == SOURCE_TREE, "target_tree")
    need(parents == [SOURCE_SHA, SOURCE_PARENT], "target_sole_parent")
    status = run(["/usr/bin/git", "-C", str(TARGET), "status", "--porcelain=v1", "--ignored"], TARGET)
    need(status in ("", "!! node_modules/\n"), "target_worktree_not_clean:" + status[:80])
    rows, dirs = walk(TARGET)
    want = expected_inventory()
    need(rows == want, "membership_modes_sizes_or_hashes_differ_from_the_352_inventory")
    need(dirs == {a for p in want for a in _ancestors(p)}, "unexpected_directory_in_source_namespace")
    unit = (TARGET / UNIT_PATH).read_bytes()
    need(len(unit) == UNIT_BYTES and sha256_bytes(unit) == UNIT_SHA256 and git_blob(unit) == UNIT_BLOB, "unit_identity")
    need(sha256_file(TARGET / "package.json")[0] == PKG_SHA256 and sha256_file(TARGET / "package-lock.json")[0] == LOCK_SHA256, "package_pair")
    inventory_text = "".join("%s\t%s\t%d\t%s\n" % (p, rows[p][0], rows[p][1], rows[p][2]) for p in sorted(rows, key=lambda s: s.encode()))
    need(sha256_bytes(inventory_text.encode()) == INVENTORY_SHA256, "rendered_inventory_identity")
    return {"source_head": head, "source_tree": tree, "source_parents": parents, "files": len(rows), "directories": len(dirs),
            "inventory_sha256": INVENTORY_SHA256, "unit_sha256": UNIT_SHA256, "unit_blob": UNIT_BLOB,
            "package_sha256": PKG_SHA256, "lock_sha256": LOCK_SHA256, "status": status}


def measure_tools():
    """Actual hosted executable identities. Executables use the separate TOOL_MAX read ceiling; nothing here pins a hosted hash or size."""
    tools = {}
    for path in SYSTEM_TOOLS:
        real = os.path.realpath(path)
        digest, size = sha256_file(real, TOOL_MAX)
        tools[path] = {"realpath": real, "sha256": digest, "bytes": size}
    which = shutil.which("node")
    need(which is not None, "node_not_on_path")
    node = os.path.realpath(which)
    node_dir = os.path.dirname(node)
    version = run([node, "--version"], TARGET, node_dir).strip()
    need(version == "v" + NODE_VERSION, "node_version")
    digest, size = sha256_file(node, TOOL_MAX)
    tools["node"] = {"realpath": node, "sha256": digest, "bytes": size, "version": version}
    npm_version = run([os.path.join(node_dir, "npm"), "--version"], TARGET, node_dir).strip()
    need(npm_version == NPM_VERSION, "npm_version")
    tools["npm"] = {"version": npm_version}
    pkg_path = TARGET / "node_modules/vitest/package.json"
    pkg = json.loads(pkg_path.read_text("utf-8"))
    need(pkg.get("version") == VITEST_VERSION, "installed_vitest_version")
    entry = TARGET / "node_modules/vitest/vitest.mjs"
    digest, size = sha256_file(entry)
    tools["vitest"] = {"version": pkg["version"], "entrypoint": str(entry), "entrypoint_sha256": digest, "entrypoint_bytes": size,
                       "package_json_sha256": sha256_file(pkg_path)[0]}
    py = sys.version_info
    need(py[:2] in ((3, 12), (3, 13)) and sys.implementation.name == "cpython", "python_version")
    tools["python"] = {"version": sys.version, "executable": os.path.realpath(sys.executable)}
    return tools


def committed_file(root, rel):
    """Actual on-disk identity of one committed control file: regular, single-link, no intermediate link, every permission bit, bytes and git blob."""
    path = root / rel
    need(os.path.realpath(path) == str(path), "control_path_is_linked:" + rel)
    st = path.lstat()
    need(stat.S_ISREG(st.st_mode) and st.st_nlink == 1 and st.st_size <= MAX_FILE, "control_file_not_a_single_regular_file:" + rel)
    data = path.read_bytes()
    need(len(data) == st.st_size, "control_size_race:" + rel)
    return {"mode": "%o" % stat.S_IMODE(st.st_mode), "bytes": len(data), "sha256": sha256_bytes(data), "blob": git_blob(data)}


def measure_control(control_sha):
    """Control commit == GITHUB_SHA; its SOLE parent is the exact tested source; the parent-to-control tree delta is exactly the five reviewed
    additions (this also preserves the original ci.yml); a clean control worktree; each actual file equals its committed blob and mode."""
    head = run(["/usr/bin/git", "-C", str(CONTROL), "rev-parse", "HEAD"], CONTROL).strip()
    need(head == control_sha, "control_checkout_is_not_github_sha")
    parents = run(["/usr/bin/git", "-C", str(TARGET), "rev-list", "--parents", "-n1", control_sha], TARGET).split()
    need(parents == [control_sha, SOURCE_SHA], "control_sole_parent_is_not_the_tested_source")
    raw = run(["/usr/bin/git", "-C", str(TARGET), "diff-tree", "-r", "--raw", "--no-abbrev", "--no-renames", SOURCE_SHA, control_sha], TARGET)
    delta = {}
    for line in raw.splitlines():
        match = re.fullmatch(r":000000 100644 0{40} ([0-9a-f]{40}) A\t(.+)", line)
        need(match is not None, "control_delta_entry_is_not_a_reviewed_regular_addition")
        need(match.group(2) not in delta, "control_delta_duplicate_path")
        delta[match.group(2)] = match.group(1)
    need(sorted(delta) == list(CONTROL_FILES), "control_delta_is_not_exactly_the_five_reviewed_additions")
    status = run(["/usr/bin/git", "-C", str(CONTROL), "status", "--porcelain=v1", "--ignored"], CONTROL)
    need(status == "", "control_worktree_not_clean")
    listing = run(["/usr/bin/git", "-C", str(CONTROL), "ls-tree", "-r", "--full-tree", "HEAD", "--", *CONTROL_FILES, CI_REL], CONTROL)
    committed = {}
    for line in listing.splitlines():
        match = re.fullmatch(r"(100644) blob ([0-9a-f]{40})\t(.+)", line)
        need(match is not None, "control_committed_entry_is_not_a_regular_100644_blob")
        committed[match.group(3)] = match.group(2)
    need(sorted(committed) == sorted(CONTROL_FILES + (CI_REL,)), "control_committed_entries_incomplete")
    files = {}
    for rel in CONTROL_FILES:
        ident = committed_file(CONTROL, rel)
        need(ident["mode"] == "644" and ident["blob"] == committed[rel] == delta[rel], "control_file_differs_from_its_committed_blob_or_mode:" + rel)
        files[rel] = ident
    ci = committed_file(CONTROL, CI_REL)
    need(ci["sha256"] == CI_SHA256 and ci["blob"] == CI_BLOB == committed[CI_REL] and ci["mode"] == "644", "original_ci_yml_changed")
    files[CI_REL] = ci
    return {"head": head, "sole_parent": SOURCE_SHA, "delta": delta, "status": status, "files": files}


def socket_model():
    """The guard's unchanged runtime-directory/socket naming, modeled with the ACTUAL numeric uid: CAP/tmp/the-desk-p33-<uid>-<24 hex>/attempt-<8>/guard.sock.
    The pathname must be shorter than sizeof(sun_path)=108 bytes. A violation is a HOLD before anything is created or launched; there is no alternate path."""
    uid = os.getuid()
    key = hashlib.sha256(str(TARGET).encode()).hexdigest()[:24]
    path = "%s/tmp/the-desk-p33-%d-%s/attempt-%s/guard.sock" % (CAP, uid, key, "x" * 8)
    length = len(path.encode("utf-8"))
    model = {"uid": uid, "runtime_key": key, "modeled_path": path, "bytes": length, "limit": SOCKET_LIMIT, "rule": "bytes < limit"}
    PARTIAL["socket_model"] = model
    need(length < SOCKET_LIMIT, "guard_socket_pathname_not_shorter_than_108_bytes")
    return model


def write_new(path, value):
    data = (json.dumps(value, sort_keys=True, indent=2) + "\n").encode()
    write_bytes_new(path, data)


def write_bytes_new(path, data):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def read_bounded(path):
    """At most MAX_FILE bytes plus a one-byte overrun detector; MISSING for any unreadable, overlong or non-regular file."""
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(fd, "rb") as stream:
            if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
                return MISSING
            data = stream.read(MAX_FILE + 1)
    except OSError:
        return MISSING
    return MISSING if len(data) > MAX_FILE else data


def read_text(path):
    data = read_bounded(path)
    return MISSING if data is MISSING else data.decode("utf-8", "replace")


def load_json(path):
    data = read_bounded(path)
    if data is MISSING:
        return MISSING
    try:
        return json.loads(data.decode("utf-8"))
    except ValueError:
        return MISSING


def get(value, *keys):
    """Presence-checked lookup: an absent field is MISSING and can never become a falsey default."""
    for key in keys:
        if not isinstance(value, dict) or key not in value:
            return MISSING
        value = value[key]
    return value


def owned():
    marker = load_json(CAP / "owner.json")
    return (get(marker, "run_id") == os.environ.get("GITHUB_RUN_ID") and get(marker, "run_attempt") == os.environ.get("GITHUB_RUN_ATTEMPT")
            and os.environ.get("GITHUB_RUN_ID") is not None)


def write_failure(phase, kind, label):
    """Exclusive phase failure record with the accumulated ledger and partial measurements; best effort, never overwriting, never inventing a status."""
    record = {"phase": phase, "kind": kind, "label": label, "commands": LEDGER, "partial": PARTIAL, "utc": utc(),
              "monotonic_seconds": round(time.monotonic() - T0, 6)}
    if not owned():
        targets = []   # a root rejected as unowned is never written into: only the fixed HOLD/error reaches the job log
    elif phase == "collect":
        targets = [BASE / "collect-failure.json"] + ([UPLOAD / "collect-failure.json"] if UPLOAD_STATE["created"] else [])
    else:
        targets = [CAP / (phase + "-failure.json")]
    for target in targets:
        try:
            write_new(target, record)
        except Exception as error:
            print("failure record not written:", target, type(error).__name__, file=sys.stderr)


def common_identity():
    sha = os.environ.get("GITHUB_SHA", "")
    need(re.fullmatch(r"[0-9a-f]{40}", sha) is not None, "github_sha_shape")
    need(sha != SOURCE_SHA, "control_sha_equals_source_sha")
    real_dir(CONTROL, "control_checkout_dir")
    need(os.environ.get("RUNNER_TEMP") == str(TEMP), "runner_temp_literal")
    need(os.environ.get("GITHUB_WORKSPACE") == str(WORKSPACE), "workspace_literal")
    need(os.environ.get("GITHUB_EVENT_NAME") == "push" and os.environ.get("GITHUB_REF") == "refs/heads/diagnostic/pr32-tu11-001", "event_and_ref")
    return {"control_github_sha": sha, "source_sha": SOURCE_SHA, "github_run_id": os.environ.get("GITHUB_RUN_ID"),
            "github_run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT"), "github_ref": os.environ.get("GITHUB_REF"),
            "github_event_name": os.environ.get("GITHUB_EVENT_NAME")}


def cmd_pre():
    model = socket_model()
    need(not os.path.lexists(BASE), "capture_base_must_be_absent")
    os.mkdir(BASE, 0o700)
    os.mkdir(CAP, 0o700)
    write_new(CAP / "owner.json", {"run_id": os.environ.get("GITHUB_RUN_ID"), "run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT"), "utc": utc()})
    os.mkdir(CAP / "home", 0o700)
    os.mkdir(CAP / "tmp", 0o700)
    identity = common_identity()
    PARTIAL["identity"] = identity
    control = measure_control(identity["control_github_sha"])
    PARTIAL["control"] = control
    source = measure_source()
    PARTIAL["source"] = source
    tools = measure_tools()
    PARTIAL["tools"] = tools
    write_new(CAP / "bind-pre.json", {"phase": "pre", **identity, "socket_model": model, "control": control, "source": source, "tools": tools,
                                      "commands": LEDGER, "utc": utc(), "monotonic_seconds": round(time.monotonic() - T0, 6)})
    print("pre ok")
    return 0


def cmd_precheck():
    """Launcher gate: pre completed in this run, no failure record, the socket model re-derived and still fitting, and no stage directory yet."""
    need(owned(), "precheck_capture_not_owned")
    pre = load_json(CAP / "bind-pre.json")
    need(get(pre, "phase") == "pre", "precheck_pre_record")
    need(not [p for p in CAP.glob("*-failure.json")], "precheck_failure_record_present")
    again = socket_model()
    need(get(pre, "socket_model") == again, "precheck_socket_model_changed")
    need(not os.path.lexists(CAP / "stage"), "precheck_stage_exists")
    return 0


def cmd_post():
    need(owned(), "post_capture_not_owned")
    pre = load_json(CAP / "bind-pre.json")
    need(get(pre, "phase") == "pre", "post_without_pre_record")
    identity = common_identity()
    PARTIAL["identity"] = identity
    control = measure_control(identity["control_github_sha"])
    PARTIAL["control"] = control
    source = measure_source()
    PARTIAL["source"] = source
    tools = measure_tools()
    PARTIAL["tools"] = tools
    write_new(CAP / "bind-post.json", {"phase": "post", **identity, "control": control, "source": source, "tools": tools, "commands": LEDGER,
                                       "utc": utc(), "monotonic_seconds": round(time.monotonic() - T0, 6)})
    need(identity["control_github_sha"] == pre["control_github_sha"], "control_identity_changed")
    need(control == pre["control"], "control_changed_during_run")
    need(source == pre["source"], "source_changed_during_run")
    need(tools == pre["tools"], "tools_changed_during_run")
    print("post ok")
    return 0


def evaluate(check):
    """Every check reads the actual retained facts; an absent or mistyped field fails its check."""
    check("no_phase_failure_records", sorted(p.name for p in CAP.glob("*-failure.json")) == [])
    pre = load_json(CAP / "bind-pre.json")
    post = load_json(CAP / "bind-post.json")
    check("bind_pre_record_present", get(pre, "phase") == "pre")
    check("bind_post_record_present", get(post, "phase") == "post")
    for key in ("control_github_sha", "control", "source", "tools"):
        check("pre_post_equal_" + key, get(pre, key) is not MISSING and get(pre, key) == get(post, key))
    check("source_sha_literal", get(pre, "source_sha") == SOURCE_SHA and get(post, "source_sha") == SOURCE_SHA)
    control_sha = get(pre, "control_github_sha")
    check("control_sha_distinct_from_source", isinstance(control_sha, str) and control_sha != SOURCE_SHA and get(pre, "control", "head") == control_sha)
    check("control_sole_parent_is_source", get(pre, "control", "sole_parent") == SOURCE_SHA)
    check("control_delta_is_the_five_files", isinstance(get(pre, "control", "delta"), dict) and sorted(get(pre, "control", "delta")) == list(CONTROL_FILES))
    check("control_worktree_clean", get(pre, "control", "status") == "")
    check("source_352_files", get(pre, "source", "files") == EXPECTED_FILES and get(pre, "source", "inventory_sha256") == INVENTORY_SHA256)
    modeled = get(pre, "socket_model", "bytes")
    check("socket_path_shorter_than_108", isinstance(modeled, int) and not isinstance(modeled, bool) and modeled < SOCKET_LIMIT
          and get(pre, "socket_model", "limit") == SOCKET_LIMIT and isinstance(get(pre, "socket_model", "uid"), int))
    stage = CAP / "stage"
    exact = {"limits.txt": "core 0 0\nfsize 67108864 67108864\n", "exit": "0\n", "snapshot-status.txt": "ps-pre 0\nps-post 0\n",
             "argv.txt": GUARD_ARGV, "pre-attempts": ""}
    for name, text in exact.items():
        check("stage_" + name + "_exact", read_text(stage / name) == text)
    check("stage_env_keys_exact", read_text(stage / "env-keys.txt") in ENV_KEYS)
    for name in ("started-utc", "ended-utc", "monotonic-start.txt", "monotonic-end.txt", "ps-pre.txt", "ps-post.txt", "post-attempts", "stdout", "stderr"):
        check("stage_present_" + name, read_text(stage / name) is not MISSING)
    check("no_prelaunch_failure_record", not os.path.lexists(stage / "prelaunch-failed"))
    runtimes = sorted(CAP.glob("tmp/the-desk-p33-*"))
    attempts = sorted(CAP.glob("tmp/the-desk-p33-*/attempt-*"))
    check("exactly_one_runtime_directory", len(runtimes) == 1)
    check("exactly_one_guard_attempt", len(attempts) == 1)
    reaped = []
    if len(attempts) == 1:
        attempt = attempts[0]
        check("post_attempts_names_the_attempt", read_text(stage / "post-attempts") == attempt.name + "\n")
        prereq = load_json(attempt / "prerequisite.json")
        check("prerequisite_subreaper_pidfd_proc", get(prereq, "subreaper") is True and get(prereq, "pidfdSignal0") is True and get(prereq, "proc") is True)
        check("prerequisite_interpreter_identity", isinstance(get(prereq, "python"), str) and isinstance(get(prereq, "kernel"), str)
              and get(prereq, "executable") == get(pre, "tools", "python", "executable") and get(prereq, "executable") is not MISSING)
        guard = load_json(attempt / "guard-result.json")
        check("guard_fatal_present_null", get(guard, "fatal") is None)
        check("guard_contained_rejection_present_null", get(guard, "containedRejection") is None)
        for key in ("settled", "directReaped", "noChildren", "complete"):
            check("guard_" + key + "_true", get(guard, key) is True)
        for key in ("errors", "residual", "cleanupErrors"):
            check("guard_" + key + "_present_empty", get(guard, key) == [])
        listed = get(guard, "reaped")
        reaped = listed if isinstance(listed, list) else []
        check("guard_reaped_nonempty_all_exit_zero", isinstance(listed, list) and len(listed) >= 1 and all(
            isinstance(r, dict) and isinstance(r.get("pid"), int) and "exit" in r and r["exit"] == 0 for r in listed))
        check("no_p33_case_folder_invented", not [p for p in attempt.iterdir() if p.is_dir()])
    ps_post = read_text(stage / "ps-post.txt")
    post_pids = set()
    if ps_post is not MISSING:
        for line in ps_post.splitlines():
            parts = line.split()
            if parts and parts[0].isdigit():
                post_pids.add(int(parts[0]))
    check("recorded_reaped_pids_absent_after", ps_post is not MISSING and all(r.get("pid") not in post_pids for r in reaped if isinstance(r, dict)))
    out = read_text(stage / "stdout")
    err = read_text(stage / "stderr")
    check("stdout_and_stderr_readable", out is not MISSING and err is not MISSING)
    if out is not MISSING and err is not MISSING:
        text = ANSI.sub("", out)
        errtext = ANSI.sub("", err)
        lines = [re.sub(r"\s+", " ", line.strip()) for line in text.splitlines()]
        file_rows = [line for line in lines if line.startswith("Test Files ")]
        test_rows = [line for line in lines if line.startswith("Tests ")]
        check("exactly_one_test_files_summary", len(file_rows) == 1)
        check("test_files_summary_is_1_passed_of_1", file_rows == ["Test Files 1 passed (1)"])
        check("exactly_one_tests_summary", len(test_rows) == 1)
        check("tests_summary_is_1_passed_27_skipped_of_28", test_rows == ["Tests 1 passed | 27 skipped (28)"])
        passed = [line for line in lines if re.match(r"^[✓√] ", line)]
        check("exactly_one_passing_result_record", len(passed) == 1)
        tail = r"( [0-9]+(\.[0-9]+)?m?s)?"
        named = re.escape(UNIT_PATH) + r" > " + re.escape(SUITE_TITLE) + r" > " + re.escape(TU11_NAME) + tail
        check("passing_record_is_the_named_tu11", len(passed) == 1 and re.fullmatch(r"[✓√] " + named, passed[0]) is not None)
        check("no_failing_result_record", not [line for line in lines if re.match(r"^[×✗✘] ", line) or re.match(r"^FAIL ", line)])
        check("only_the_one_test_file_named", set(re.findall(r"[A-Za-z0-9_./-]+\.test\.ts", text)) == {UNIT_PATH})
        check("no_failed_unhandled_or_error_sections", re.search(r"Failed Tests|Failed Suites|Unhandled Errors|Unhandled Rejection|^\s*Errors\s+[0-9]", text, re.M) is None
              and re.search(r"Failed Tests|Unhandled", errtext) is None)


def cmd_validate():
    """Writes the diagnostic verdict/check list BEFORE collection. Runs whenever the owned capture root was initialized, whatever failed earlier."""
    need(owned(), "validate_without_an_owned_capture_root")
    need(not os.path.lexists(CAP / "verdict.json"), "verdict_already_exists")
    checks, failures = [], []

    def check(label, ok):
        passed = ok is True
        checks.append({"check": label, "ok": passed})
        if not passed:
            failures.append(label)

    try:
        evaluate(check)
    except Exception as error:
        failures.append("validate_exception:" + type(error).__name__)
    verdict = {"verdict": VERDICT_PASS if not failures else "HOLD", "failures": failures, "checks": checks,
               "note": "One selected case (TU11) only: never a 28-case file pass, never full-CI acceptance. Upload success is judged by the workflow gate."}
    write_new(CAP / "verdict.json", verdict)
    print(json.dumps(verdict, sort_keys=True))
    return 0 if not failures else 1


def publish_upload_ready():
    """Appends the fixed line `upload_ready=true` to the runner-provided GITHUB_OUTPUT file (which already exists; never created here). Any failure is a HOLD."""
    path = os.environ.get("GITHUB_OUTPUT", "")
    need(path != "", "github_output_channel_missing")
    try:
        fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_NOFOLLOW)
        with os.fdopen(fd, "ab") as stream:
            stream.write(b"upload_ready=true\n")
            stream.flush()
            os.fsync(stream.fileno())
    except OSError:
        raise Hold("upload_ready_output_not_published")


def cmd_collect():
    """Builds the upload snapshot from verified regular-file copies of the owned capture root (verdict and exact raw inputs included) with explicit
    finite ceilings. Type, size and budget are checked BEFORE a bounded read. The guard's unix socket is recorded as a non-content omission and is
    never copied; any other link/special member, any limit overrun and any omission is a recorded HOLD. A partial snapshot is retained, not hidden.
    Ownership is verified first and the fresh UPLOAD directory is created exclusively; only then is `upload_ready=true` published, so the upload step
    can never transmit a directory this process did not create. Failure after that point keeps the partial snapshot uploadable but collect fails."""
    need(owned(), "collect_without_an_owned_capture_root")
    os.mkdir(UPLOAD, 0o700)
    UPLOAD_STATE["created"] = True
    publish_upload_ready()
    holds, sockets, copied = [], [], []
    state = {"entries": 0, "total": 0, "stopped": False}

    def copy_file(rel, path, st):
        if st.st_size > COLLECT_FILE:
            holds.append("file_over_64MiB:%s:%d" % (rel, st.st_size))
            return
        if state["total"] + st.st_size > COLLECT_TOTAL:
            holds.append("aggregate_over_512MiB_budget_before:" + rel)
            return
        data = read_bounded(path)
        if data is MISSING or len(data) != st.st_size:
            holds.append("read_failed_or_size_changed:" + rel)
            return
        target = UPLOAD / rel
        write_bytes_new(target, data)
        back = read_bounded(target)
        digest = sha256_bytes(data)
        if back is MISSING or sha256_bytes(back) != digest or len(back) != len(data):
            holds.append("copy_hash_mismatch:" + rel)
            return
        state["total"] += len(data)
        copied.append((rel, len(data), digest))

    def visit(directory, rel_dir, depth):
        if depth > COLLECT_DEPTH:
            holds.append("depth_over_24:" + rel_dir)
            return
        with os.scandir(directory) as scan:
            ordered = sorted(scan, key=lambda e: e.name.encode())
        for entry in ordered:
            state["entries"] += 1
            if state["entries"] > COLLECT_ENTRIES:
                holds.append("entries_over_4096")
                state["stopped"] = True
                return
            rel = rel_dir + entry.name
            st = entry.stat(follow_symlinks=False)
            if stat.S_ISDIR(st.st_mode):
                os.mkdir(UPLOAD / rel, 0o700)
                visit(entry.path, rel + "/", depth + 1)
                if state["stopped"]:
                    return
            elif stat.S_ISREG(st.st_mode):
                copy_file(rel, entry.path, st)
            elif stat.S_ISSOCK(st.st_mode) and SOCKET_RE.fullmatch(rel):
                sockets.append(rel)
            else:
                holds.append("link_or_special_not_copied:%s:%o" % (rel, stat.S_IFMT(st.st_mode)))

    visit(str(CAP), "", 1)
    verdict = load_json(CAP / "verdict.json")
    if get(verdict, "verdict") is MISSING:
        holds.append("verdict_missing_or_unreadable")
    manifest = "".join("%s  %s\n" % (digest, rel) for rel, size, digest in sorted(copied, key=lambda r: r[0].encode()))
    status = {"status": "complete" if not holds else "partial_hold", "holds": holds, "copied_files": len(copied), "copied_bytes": state["total"],
              "entries_seen": state["entries"], "omitted_guard_sockets": sockets, "verdict": get(verdict, "verdict") if get(verdict, "verdict") is not MISSING else None,
              "limits": {"entries": COLLECT_ENTRIES, "depth": COLLECT_DEPTH, "file_bytes": COLLECT_FILE, "total_bytes": COLLECT_TOTAL},
              "sizes": {rel: size for rel, size, digest in copied},
              "note": "Cancellation, the job deadline or a lost runner can leave this evidence incomplete; that is HOLD, never a pass."}
    status_bytes = (json.dumps(status, sort_keys=True, indent=2) + "\n").encode()
    for root in (BASE, UPLOAD):
        write_bytes_new(root / "MANIFEST.sha256", manifest.encode())
        write_bytes_new(root / "collect-status.json", status_bytes)
    print("collect", status["status"], len(copied), "copied", len(sockets), "socket omitted", len(holds), "holds")
    print("manifest sha256", sha256_bytes(manifest.encode()), "status sha256", sha256_bytes(status_bytes))
    return 0 if not holds else 1


def main():
    commands = {"pre": cmd_pre, "precheck": cmd_precheck, "post": cmd_post, "validate": cmd_validate, "collect": cmd_collect}
    if len(sys.argv) != 2 or sys.argv[1] not in commands:
        print("usage: tu11_bind.py pre|precheck|post|validate|collect", file=sys.stderr)
        return 64
    phase = sys.argv[1]
    try:
        return commands[phase]()
    except Hold as error:
        write_failure(phase, "hold", str(error))
        print("HOLD:", error, file=sys.stderr)
        return 3
    except Exception as error:
        write_failure(phase, "exception", type(error).__name__ + ":" + str(error)[:200])
        print("EXCEPTION:", type(error).__name__, file=sys.stderr)
        return 70


if __name__ == "__main__":
    raise SystemExit(main())
