#!/usr/bin/python3
"""Fixed capture/validation tool for the foundation-ci workflow (stages: prerequisite, focused, all).

Standard library only. It never starts the P33 guard, Vitest, a database client other than the fixed read-only probe
below, or any native extraction. No arbitrary command, path, profile or stage input is accepted. Fixed subcommands handle
workspace initialization, build/fixture/partition binding, database probing, stage prechecks and verdict checks,
scoped evidence collection, security retention, and per-partition/joint final verdicts (see main()).
precheck for stage `all` additionally requires a complete controls-scope collection record (controls_problems), so a
failed controls retention stops the run before the aggregate is created; partial artifacts are still collected and uploaded.

Evidence lives outside the checkout under $RUNNER_TEMP/ci; every record is created exclusively. The checkout is
bound by a runtime snapshot of every git-tracked file (bytes + sha256), taken before anything runs, re-taken after the
build and after every stage, and compared byte-for-byte. Only a root `dist/` directory produced by `npm run build`
is allowed in addition to the tracked files (see take_snapshot); `.git` and `node_modules` are not hashed.

Retention limits (deliberately stricter than execution): run-stage.sh lets a stage write up to 64 MiB per file, but
collect() retains at most COPY_LIMIT = 8 MiB of each stdout/stderr and JSON_LIMIT of each JSON record. A larger file
is copied only as a head and recorded as censored, so the bundle is labeled partial/censored and cannot be accepted.
All retained text is passed through redact() so a database URL's credentials never reach an artifact.
"""
import argparse
import hashlib
import json
import os
import platform
import re
import shutil
import stat
import subprocess
import sys
import time
from pathlib import Path

STAGES = ('prerequisite', 'focused', 'all')
NODE_VERSION = 'v24.21.0'
NPM_VERSION = '11.19.0'
CAP = 64 * 1024 * 1024  # 67,108,864 bytes: per-file ceiling set by run-stage.sh (ulimit -f 65536 KiB)
JSON_LIMIT = 65536
SNAPSHOT_LIMIT = 4 * 1024 * 1024
COPY_LIMIT = 8 * 1024 * 1024
CASE_OUTPUT_LIMIT = 65536
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
WORKFLOW_REL = '.github/workflows/ci.yml'
HARNESS_TEST = 'test/unit/p33-parity-harness.test.ts'
INTEGRATION_PREFIX = 'test/integration/'
EXPECTED_TEST_FILES = 83          # tracked *.test.ts files under test/
EXPECTED_ALL_FILES = 82           # 83 minus the focused harness the `all` profile excludes
EXPECTED_ALL_TESTS = 8717
EXPECTED_INTEGRATION_FILES = 29
WRITER_TEST = 'test/unit/writer-fixture-input.test.ts'
PARTITION_COUNTS = {'writer': (1, 4908, 0), 'rest': (81, 3809, 29)}
DB_NAME = 'the_desk_test'
DB_URL = re.compile(r'postgresql://([^:@/\s]+):([^@/\s]+)@(localhost|127\.0\.0\.1):5432/' + DB_NAME)
HEX40 = re.compile(r'[0-9a-f]{40}')
REPO_NAME = re.compile(r'[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}')
NONCE = re.compile(r'[0-9a-f]{48}')
SHA256 = re.compile(r'[0-9a-f]{64}')
ANSI = re.compile(r'\x1b\[[0-9;?]*[ -/]*[@-~]')
CREDENTIAL_URL = re.compile(rb'(postgres(?:ql)?://)[^:@/\s]+:[^@/\s]+@')
FAILURE_LINE = re.compile(r'^\s*(FAIL\b|Unhandled\b|Errors\s{2,}|Leaks\s{2,}|Type Errors\s{2,})', re.M)
FILE_LINE = re.compile(r'^\s*\S+\s+(\S+\.test\.ts)\s+\((\d+) tests?((?: \| \d+ (?:failed|skipped|todo))*)\)')
FATAL_TEXT = ('Traceback (most recent call last)', 'P33 FATAL', 'quarantined')
STAGE_FILES = ('stdout', 'stderr', 'exit', 'limits.txt', 'ps-pre.txt', 'ps-post.txt', 'snapshot-status.txt',
               'started-utc', 'ended-utc', 'pre-attempts', 'post-attempts')
EXPECTED_COUNTS = {
    'focused': ({'passed': 1, 'total': 1}, {'passed': 2, 'total': 2}),
    'all': ({'passed': EXPECTED_ALL_FILES, 'total': EXPECTED_ALL_FILES},
            {'passed': EXPECTED_ALL_TESTS, 'total': EXPECTED_ALL_TESTS}),
}
LIMITS_TEXT = 'core 0 0\nfsize %d %d\n' % (CAP, CAP)
# Keys emitted by the unchanged supervisor (guard-result.json and each case result.json).
SETTLEMENT_KEYS = ('settled', 'directReaped', 'noChildren', 'complete', 'reaped', 'residual', 'errors',
                   'discoveryDetails', 'cleanupErrors')
GUARD_KEYS = SETTLEMENT_KEYS + ('fatal', 'containedRejection')
CASE_KEYS = SETTLEMENT_KEYS + ('protocol', 'nonce', 'mode', 'outcome', 'reason', 'controls', 'childStarted')
REAPED_KEYS = {'pid', 'raw', 'exit'}


def ci_dir():
    temp = os.environ.get('RUNNER_TEMP')
    if not temp or not os.path.isabs(temp):
        raise RuntimeError('RUNNER_TEMP must be an absolute path')
    return Path(temp) / 'ci'


def redact(data, extra=()):
    """Remove database credentials from bytes destined for retention (URL userinfo and any exact extra strings)."""
    data = CREDENTIAL_URL.sub(rb'\1[REDACTED]@', data)
    for item in extra:
        if item:
            data = data.replace(item if isinstance(item, bytes) else item.encode(), b'[REDACTED]')
    return data



def is_int(value):
    return type(value) is int


def read_bounded(path, limit):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode):
            raise RuntimeError('not a regular file: %s' % path)
        if info.st_size > limit:
            raise RuntimeError('file exceeds bound: %s' % path)
        chunks = []
        remaining = info.st_size
        while remaining:
            data = os.read(fd, min(65536, remaining))
            if not data:
                raise RuntimeError('short read: %s' % path)
            chunks.append(data)
            remaining -= len(data)
        if os.read(fd, 1):
            raise RuntimeError('file grew while reading: %s' % path)
        return b''.join(chunks)
    finally:
        os.close(fd)


def read_head(path, limit):
    """First min(size, limit) bytes plus the true size. A premature EOF is an error, never a short result."""
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode):
            raise RuntimeError('not a regular file: %s' % path)
        remaining = min(info.st_size, limit)
        chunks = []
        while remaining:
            data = os.read(fd, min(65536, remaining))
            if not data:
                raise RuntimeError('short read: %s' % path)
            chunks.append(data)
            remaining -= len(data)
        return b''.join(chunks), info.st_size
    finally:
        os.close(fd)


def load_json(path, limit=JSON_LIMIT):
    return json.loads(read_bounded(path, limit))


def write_bytes_x(path, data):
    with open(path, 'xb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def write_json_x(path, value):
    write_bytes_x(path, (json.dumps(value, indent=2, sort_keys=True) + '\n').encode())


def probe(command, seconds=10):
    """Fixed identity probe; returns (exit, first 4096 output chars)."""
    result = subprocess.run(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, timeout=seconds, check=False)
    return result.returncode, result.stdout.decode('utf-8', errors='replace')[:4096]





# ---------------------------------------------------------------- source snapshot and binding

def tracked_files():
    result = subprocess.run(['git', '-C', str(ROOT), 'ls-files', '-z'], stdin=subprocess.DEVNULL,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30, check=True)
    names = sorted(n for n in result.stdout.decode('utf-8').split('\0') if n)
    if not names or len(names) > 5000:
        raise RuntimeError('tracked file count out of bounds')
    return names


def walk_tree(root):
    """Files and symlinks outside .git, node_modules and the root dist directory; plus dist's own listing."""
    files, links, dist_files, dist_problems = set(), set(), None, []
    root = str(root)

    def refuse(error):
        raise error

    for current, dirs, names in os.walk(root, followlinks=False, onerror=refuse):
        if current == root:
            dirs[:] = [d for d in dirs if d not in ('.git', 'node_modules', 'dist')]
        for name in list(dirs):
            full = os.path.join(current, name)
            if os.path.islink(full):
                links.add(os.path.relpath(full, root).replace(os.sep, '/'))
        for name in names:
            full = os.path.join(current, name)
            rel = os.path.relpath(full, root).replace(os.sep, '/')
            (links if os.path.islink(full) else files).add(rel)
        if len(files) + len(links) > 5000:
            raise RuntimeError('tree file bound')
    dist = os.path.join(root, 'dist')
    if os.path.lexists(dist):
        info = os.lstat(dist)
        if stat.S_ISLNK(info.st_mode) or not stat.S_ISDIR(info.st_mode):
            dist_problems.append('root dist is a symlink or not a directory')
        else:
            dist_files = []
            for current, dirs, names in os.walk(dist, followlinks=False, onerror=refuse):
                for name in dirs + names:
                    full = os.path.join(current, name)
                    if os.path.islink(full):
                        dist_problems.append('symlink inside dist: ' + os.path.relpath(full, dist).replace(os.sep, '/'))
                for name in names:
                    full = os.path.join(current, name)
                    if not os.path.islink(full):
                        if not stat.S_ISREG(os.lstat(full).st_mode):
                            dist_problems.append('non-regular file inside dist: ' + os.path.relpath(full, dist).replace(os.sep, '/'))
                        else:
                            dist_files.append(os.path.relpath(full, dist).replace(os.sep, '/'))
                if len(dist_files) > 20000:
                    raise RuntimeError('dist file bound')
    return files, links, dist_files, dist_problems


def take_snapshot(tracked, *, root=None, allow_dist):
    """Hash every tracked file and describe everything else in the checkout.

    allow_dist=False (pre-build): a root dist directory must not exist. allow_dist=True (after the build): a root
    dist directory made only of regular files and directories is permitted and is summarized by a digest so later
    snapshots can prove it was not altered. Untracked files elsewhere, symlinks anywhere and non-regular tracked
    entries are reported, never ignored.
    """
    root = Path(root) if root is not None else ROOT
    files, links, dist_files, dist_problems = walk_tree(root)
    tracked_set = set(tracked)
    problems = list(dist_problems)
    members = {}
    for name in tracked:
        try:
            info = os.lstat(root / name)
            if not stat.S_ISREG(info.st_mode):
                problems.append('tracked entry is not a regular file: ' + name)
                continue
            data = read_bounded(root / name, 64 * 1024 * 1024)
            members[name] = [len(data), hashlib.sha256(data).hexdigest()]
        except (OSError, RuntimeError) as error:
            problems.append('tracked file unreadable: %s (%s)' % (name, type(error).__name__))
    dist = None
    if dist_files is not None:
        if not allow_dist:
            problems.append('dist exists before the build')
        lines = []
        for rel in sorted(dist_files):
            data = read_bounded(root / 'dist' / rel, 64 * 1024 * 1024)
            lines.append('%s\0%d\0%s' % (rel, len(data), hashlib.sha256(data).hexdigest()))
        dist = {'files': len(lines), 'digest': hashlib.sha256('\n'.join(lines).encode()).hexdigest()}
    return {'members': members, 'extra': sorted(files - tracked_set), 'missing': sorted(tracked_set - files),
            'links': sorted(links), 'dist': dist, 'problems': problems}


def snapshot_errors(snap, *, pre=None, expect_dist=None, require_dist=False):
    """Fail-closed reading of a snapshot: any problem, extra/missing file, symlink, drift or dist change is an error."""
    errors = ['snapshot: ' + p for p in snap['problems']]
    if snap['extra']:
        errors.append('unexpected untracked files: %s' % snap['extra'][:10])
    if snap['missing']:
        errors.append('tracked files missing from the tree: %s' % snap['missing'][:10])
    if snap['links']:
        errors.append('symlinks present: %s' % snap['links'][:10])
    if pre is not None:
        for name in sorted(set(pre['members']) | set(snap['members'])):
            if pre['members'].get(name) != snap['members'].get(name):
                errors.append('source drift: ' + name)
                if len(errors) > 25:
                    errors.append('further drift not listed')
                    break
    if require_dist and snap['dist'] is None:
        errors.append('the build produced no dist directory')
    if require_dist and snap['dist'] is not None and snap['dist']['files'] == 0:
        errors.append('dist is empty')
    if expect_dist is not None:
        if snap['dist'] is None or snap['dist'] != expect_dist:
            errors.append('dist changed after the build binding')
    return errors


# ---------------------------------------------------------------- identity (pull_request synthetic merge / push)

def git_text(*args):
    code, out = probe(['git', '-C', str(ROOT), *args], 30)
    return out.strip() if code == 0 else None


def collect_git(event_head_sha):
    parents = (git_text('rev-list', '--parents', '-n1', 'HEAD') or '').split()
    facts = {'head': git_text('rev-parse', 'HEAD'), 'tree': git_text('rev-parse', 'HEAD^{tree}'),
             'parents': parents[1:], 'origin_base': git_text('rev-parse', '--verify', '--quiet', 'origin/main'),
             'workflow_blob_head': git_text('rev-parse', 'HEAD:' + WORKFLOW_REL),
             'workflow_blob_worktree': git_text('hash-object', '--', str(ROOT / WORKFLOW_REL))}
    facts['event_head_tree'] = git_text('rev-parse', event_head_sha + '^{tree}') if event_head_sha else None
    return facts


def check_identity(env, event, facts):
    """Pure identity mapping. Returns (errors, record). Nothing here consults the network or the filesystem."""
    errors = []
    name = env.get('GITHUB_EVENT_NAME')
    head = facts.get('head')
    record = {'event': name, 'repository': env.get('GITHUB_REPOSITORY'), 'ref': env.get('GITHUB_REF'),
              'github_sha': env.get('GITHUB_SHA'), 'run_id': env.get('GITHUB_RUN_ID'),
              'run_attempt': env.get('GITHUB_RUN_ATTEMPT'), 'workflow_ref': env.get('GITHUB_WORKFLOW_REF'),
              'checkout_head': head, 'checkout_tree': facts.get('tree'), 'checkout_parents': facts.get('parents'),
              'workflow_blob': facts.get('workflow_blob_head'), 'origin_base_tip': facts.get('origin_base'),
              'workflow_sha_env': env.get('GITHUB_WORKFLOW_SHA'),
              # informational only: documented as the workflow file's commit, not asserted to equal HEAD
              'workflow_sha_env_equals_checkout_head': env.get('GITHUB_WORKFLOW_SHA') == head}
    if env.get('GITHUB_ACTIONS') != 'true':
        errors.append('not running on GitHub Actions')
    if name not in ('pull_request', 'push'):
        errors.append('event %r is neither pull_request nor push' % name)
    if not (isinstance(head, str) and HEX40.fullmatch(head)) or head != env.get('GITHUB_SHA'):
        errors.append('checked-out HEAD is not GITHUB_SHA')
    if facts.get('workflow_blob_head') is None or facts.get('workflow_blob_head') != facts.get('workflow_blob_worktree'):
        errors.append('workflow file in the tree differs from the checked-out commit blob')
    event = event if isinstance(event, dict) else {}
    if name == 'pull_request':
        pr = event.get('pull_request') if isinstance(event.get('pull_request'), dict) else {}
        pr_head = (pr.get('head') or {}) if isinstance(pr.get('head'), dict) else {}
        pr_base = (pr.get('base') or {}) if isinstance(pr.get('base'), dict) else {}
        head_sha, base_sha = pr_head.get('sha'), pr_base.get('sha')
        head_repo = (pr_head.get('repo') or {}).get('full_name') if isinstance(pr_head.get('repo'), dict) else None
        base_repo = (pr_base.get('repo') or {}).get('full_name') if isinstance(pr_base.get('repo'), dict) else None
        record.update({'pr_number': pr.get('number'), 'pr_head_sha': head_sha, 'pr_base_sha': base_sha,
                       'pr_base_ref': pr_base.get('ref'), 'pr_head_repo': head_repo, 'pr_base_repo': base_repo})
        if not (isinstance(head_sha, str) and HEX40.fullmatch(head_sha) and isinstance(base_sha, str) and HEX40.fullmatch(base_sha)):
            errors.append('event lacks well-formed PR head/base commits')
        # Fork PRs are supported: the head repository only needs a well-formed identity; the base repository must be
        # this workflow's repository. The immutable head/base/parent/tree checks below are what bind the content.
        head_ok = isinstance(head_repo, str) and REPO_NAME.fullmatch(head_repo) is not None
        base_ok = isinstance(base_repo, str) and REPO_NAME.fullmatch(base_repo) is not None
        if not head_ok:
            errors.append('PR head repository identity is missing or malformed')
        if not base_ok:
            errors.append('PR base repository identity is missing or malformed')
        elif base_repo != env.get('GITHUB_REPOSITORY'):
            errors.append('PR base repository is not the workflow repository')
        record['pr_is_fork'] = (head_repo != base_repo) if head_ok and base_ok else None
        parents = facts.get('parents') or []
        if len(parents) != 2:
            errors.append('checked-out commit is not a two-parent synthetic merge')
        elif head_sha not in parents:
            errors.append('the PR head is not a parent of the checked-out merge')
        else:
            others = [p for p in parents if p != head_sha]
            if len(others) != 1 or others[0] != base_sha:
                errors.append('base drift: the merge parent differs from the PR base recorded in the event')
        record['merge_parent_base'] = [p for p in parents if p != head_sha][:1]
        if facts.get('event_head_tree') is None or facts.get('tree') != facts.get('event_head_tree'):
            errors.append('merge tree differs from the PR head tree (the tested content is not the PR head content)')
        record['pr_head_tree'] = facts.get('event_head_tree')
    elif name == 'push':
        record.update({'push_after': event.get('after'), 'push_before': event.get('before')})
        if event.get('after') != env.get('GITHUB_SHA'):
            errors.append('push event "after" is not GITHUB_SHA')
        if env.get('GITHUB_REF') != 'refs/heads/main':
            errors.append('push event is not for refs/heads/main')
    return errors, record


# ---------------------------------------------------------------- disposable database (read-only authenticated probe)

NODE_PROBE = """import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  const r = await client.query("select current_setting('server_version_num')::int as v, current_database() as d, current_user as u, (select rolsuper from pg_roles where rolname = current_user) as su, (select rolcreatedb from pg_roles where rolname = current_user) as cdb, (select rolcreaterole from pg_roles where rolname = current_user) as crole");
  const row = r.rows[0];
  console.log(JSON.stringify({ ok: true, v: row.v, d: row.d, u: row.u, su: row.su, cdb: row.cdb, crole: row.crole }));
} catch (error) {
  console.log(JSON.stringify({ ok: false, code: typeof error?.code === 'string' ? error.code : 'ERROR' }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
"""


def validate_db_url(url):
    """The only accepted target is the job's local disposable service. Returns a redacted description or raises."""
    if not isinstance(url, str) or DB_URL.fullmatch(url) is None:
        raise ValueError('TEST_DATABASE_URL is missing or is not the local disposable service URL')
    match = DB_URL.fullmatch(url)
    return {'host': match.group(3), 'port': 5432, 'database': DB_NAME, 'user': match.group(1)}


def interpret_db_probe(row):
    """Pure check of the probe's JSON row. Returns (errors, record) with no credentials."""
    errors, record = [], {}
    if not isinstance(row, dict) or row.get('ok') is not True:
        code = row.get('code') if isinstance(row, dict) and isinstance(row.get('code'), str) else 'unknown'
        return ['database probe failed (error code %s)' % re.sub(r'[^A-Za-z0-9_]', '', code)[:32]], record
    version = row.get('v')
    record = {'server_version_num': version, 'major': version // 10000 if isinstance(version, int) else None,
              'database': row.get('d'), 'role': row.get('u'), 'superuser': row.get('su'),
              'createdb': row.get('cdb'), 'createrole': row.get('crole')}
    if record['major'] != 17:
        errors.append('database major version is not 17')
    if record['database'] != DB_NAME:
        errors.append('connected database is not %s' % DB_NAME)
    if record['superuser'] is not True:
        errors.append('connected role is not a superuser (cluster-wide role bootstrap is required)')
    return errors, record



# ---------------------------------------------------------------- stage evidence validation

def parse_summary(text):
    """Parse Vitest 4.1.11 default-reporter 'Test Files' and 'Tests' lines. Returns (result, problems)."""
    clean = ANSI.sub('', text)
    result, problems = {}, []
    for key, label in (('files', 'Test Files'), ('tests', 'Tests')):
        rows = [line for line in clean.splitlines() if re.match(r'^\s*' + re.escape(label) + r'\s+\S', line)]
        if len(rows) != 1:
            problems.append('summary rows for %s: %d' % (label, len(rows)))
            continue
        match = re.fullmatch(r'\s*' + re.escape(label) + r'\s+(.+?)\s+\((\d+)\)\s*', rows[0])
        if match is None:
            problems.append('summary row unparsable for ' + label)
            continue
        counts = {'total': int(match.group(2))}
        for part in match.group(1).split(' | '):
            piece = re.fullmatch(r'(\d+) (failed|passed|expected fail|skipped|todo)', part.strip())
            if piece is None or piece.group(2) in counts:
                problems.append('summary segment unparsable for %s: %r' % (label, part))
                continue
            counts[piece.group(2)] = int(piece.group(1))
        result[key] = counts
    return result, problems


def check_reaped(reaped, label, errors):
    """Validate the supervisor's existing reap entries {'pid','raw','exit'}; returns [(pid, raw, exit)]."""
    if not isinstance(reaped, list) or not reaped:
        errors.append(label + ': reaped is not a non-empty list')
        return []
    entries, seen = [], set()
    for index, entry in enumerate(reaped):
        where = '%s: reaped[%d]' % (label, index)
        if not isinstance(entry, dict) or set(entry) != REAPED_KEYS:
            errors.append(where + ' does not have exactly pid/raw/exit')
            continue
        pid, raw, code = entry['pid'], entry['raw'], entry['exit']
        if not (is_int(pid) and is_int(raw) and is_int(code)) or pid <= 0 or raw < 0:
            errors.append(where + ' has a non-integer, Boolean, nonpositive or negative field')
            continue
        if pid in seen:
            errors.append(where + ' repeats a PID')
        seen.add(pid)
        try:
            decoded = os.waitstatus_to_exitcode(raw)
        except ValueError:
            errors.append(where + ' raw is not a terminal wait status')
            continue
        if decoded != code:
            errors.append(where + ' raw wait status and decoded exit disagree')
        entries.append((pid, raw, code))
    return entries


def check_ledger(value, label, errors, *, guard):
    """Validate a guard-result (guard=True) or case result (guard=False) settlement ledger."""
    if not isinstance(value, dict):
        errors.append(label + ': ledger is not an object')
        return []
    for key in (GUARD_KEYS if guard else CASE_KEYS):
        if key not in value:
            errors.append('%s: required key %s is absent' % (label, key))
    for key in ('settled', 'directReaped', 'noChildren', 'complete'):
        if value.get(key) is not True:
            errors.append('%s: %s is not true' % (label, key))
    for key in ('residual', 'errors', 'cleanupErrors'):
        if value.get(key) != []:
            errors.append('%s: %s is not an empty list' % (label, key))
    if not isinstance(value.get('discoveryDetails'), dict):
        errors.append(label + ': discoveryDetails is not an object')
    if 'ownershipUnknown' in value:
        errors.append(label + ': ownershipUnknown present')
    entries = check_reaped(value.get('reaped'), label, errors)
    if guard:
        for key in ('fatal', 'containedRejection'):
            if key not in value or value[key] is not None:
                errors.append('%s: %s is not null' % (label, key))
        if any(code != 0 for _, _, code in entries):
            errors.append(label + ': a reaped process did not exit 0')
    elif value.get('childStarted') is not True:
        errors.append(label + ': childStarted is not true')
    return entries


def read_controls(output):
    """Parse the control PIDs the supervisor derives from output.log: one {"control": pid} JSON line each."""
    controls = []
    for line in output.splitlines():
        record = json.loads(line)
        if not isinstance(record, dict) or set(record) != {'control'} or not is_int(record['control']):
            raise ValueError('unexpected control line')
        controls.append(record['control'])
    return controls


def check_case(case_dir, expected_mode, errors, facts):
    nonce = case_dir.name
    label = 'case ' + nonce[:8]
    if not NONCE.fullmatch(nonce):
        errors.append(label + ': directory name is not a 48-hex nonce')
        return None
    names = set(os.listdir(case_dir))
    required = {'result.json', 'output.log'} | ({'completion.json'} if expected_mode == 'p33' else set())
    if names != required:
        errors.append('%s: unexpected entries %s (want %s)' % (label, sorted(names), sorted(required)))
    try:
        result = load_json(case_dir / 'result.json')
    except Exception as error:
        errors.append('%s: result.json unreadable (%s)' % (label, type(error).__name__))
        return None
    if result.get('protocol') != 1 or result.get('nonce') != nonce or result.get('mode') != expected_mode:
        errors.append(label + ': protocol/nonce/mode mismatch')
    entries = check_ledger(result, label, errors, guard=False)
    exits = sorted(code for _, _, code in entries)
    pids = sorted(pid for pid, _, _ in entries)
    controls = result.get('controls')
    try:
        output = read_bounded(case_dir / 'output.log', CASE_OUTPUT_LIMIT).decode('utf-8', errors='strict')
    except Exception as error:
        errors.append('%s: output.log is not a readable regular bounded file (%s)' % (label, type(error).__name__))
        output = None
    if expected_mode == 'p33':
        if (result.get('outcome'), result.get('reason')) != ('COMPLETED', 'child_exit') or controls != []:
            errors.append(label + ': real P33 did not complete (a real P33 rejection is a failure)')
        if any(code != 0 for code in exits):
            errors.append(label + ': a reaped process did not exit 0')
        try:
            completion = load_json(case_dir / 'completion.json', 4096)
        except Exception as error:
            errors.append('%s: completion.json unreadable (%s)' % (label, type(error).__name__))
        else:
            want = {'protocol': 1, 'nonce': nonce, 'case': 'P33 multidisk',
                    'assertionsCompleted': True, 'hooksCompleted': True}
            if completion != want:
                errors.append(label + ': completion.json mismatch')
    elif expected_mode in ('complete', 'noncomplete'):
        if expected_mode == 'complete':
            outcome_ok = (result.get('outcome'), result.get('reason')) == ('COMPLETED', 'child_exit')
            want_exits, want_controls = [0], 1
        else:  # the intentional, labeled negative control: a contained deadline rejection is expected here only
            outcome_ok = (result.get('outcome'), result.get('reason')) == ('CONTAINED_REJECTION', 'deadline')
            want_exits, want_controls = [-9, -9], 2
        if not outcome_ok:
            errors.append('%s: %s control outcome/reason is not the expected one' % (label, expected_mode))
        if (not isinstance(controls, list) or len(controls) != want_controls or not all(is_int(c) for c in controls)
                or pids != sorted(controls) or exits != want_exits):
            errors.append('%s: %s control process evidence mismatch' % (label, expected_mode))
        if output is not None:
            try:
                if read_controls(output) != controls:
                    errors.append(label + ': output.log control PIDs differ from the result controls')
            except ValueError:
                errors.append(label + ': output.log is not control JSON lines')
    else:
        errors.append(label + ': unknown expected mode')
    facts.setdefault('cases', []).append({'nonce': nonce, 'mode': result.get('mode'),
                                          'outcome': result.get('outcome'), 'reason': result.get('reason')})
    return result


def check_prerequisite_record(value, errors):
    if not isinstance(value, dict):
        errors.append('prerequisite.json is not an object')
        return
    for key in ('subreaper', 'pidfdSignal0', 'proc'):
        if value.get(key) is not True:
            errors.append('prerequisite.json: %s is not true' % key)
    version = value.get('python')
    if not isinstance(version, str) or not (version.startswith('3.12.') or version.startswith('3.13.')):
        errors.append('prerequisite.json: python version is not 3.12/3.13')
    if value.get('executable') != os.path.realpath('/usr/bin/python3'):
        errors.append('prerequisite.json: executable is not the realpath of /usr/bin/python3')


def find_runtime_dir(tmp_dir):
    found = sorted(p for p in Path(tmp_dir).glob('the-desk-p33-*') if p.is_dir() and not p.is_symlink())
    if len(found) != 1:
        raise RuntimeError('expected exactly one P33 runtime directory, found %d' % len(found))
    return found[0]


def read_lines(path):
    return read_bounded(path, 65536).decode('utf-8').splitlines()


def snapshot_warnings(stage_dir):
    """Supplemental ps snapshots are best-effort diagnostics, never ownership proof; report failures only."""
    warnings = []
    try:
        rows = dict(line.split(' ', 1) for line in read_lines(Path(stage_dir) / 'snapshot-status.txt'))
        for key in ('ps-pre', 'ps-post'):
            if rows.get(key) != '0':
                warnings.append('supplemental %s snapshot status %r' % (key, rows.get(key)))
    except Exception as error:
        warnings.append('snapshot-status.txt unreadable (%s)' % type(error).__name__)
    return warnings




def parse_file_lines(text):
    """Per-test-file lines of Vitest 4.1.11's default reporter: ' <symbol> <path> (N tests | M skipped) <time>'."""
    seen = {}
    for line in ANSI.sub('', text).splitlines():
        match = FILE_LINE.match(line)
        if match is None:
            continue
        counts = {'tests': int(match.group(2)), 'failed': 0, 'skipped': 0, 'todo': 0}
        for part in match.group(3).split(' | ')[1:]:
            number, kind = part.split(' ')
            counts[kind] = int(number)
        seen.setdefault(match.group(1), []).append(counts)
    return seen


def expected_all_files(tracked):
    """The files the unfiltered `all` profile selects: every tracked *.test.ts under test/ except the focused harness."""
    tests = sorted(n for n in tracked if n.startswith('test/') and n.endswith('.test.ts'))
    return tests, [n for n in tests if n != HARNESS_TEST]


def partition_label(required=False):
    value = os.environ.get('DESK_CI_PARTITION')
    if value is None and not required:
        return 'all'  # Historical, non-hosted harness mode only.
    if value not in PARTITION_COUNTS:
        raise RuntimeError('missing or unknown CI partition')
    return value


def partition_files(tracked, partition):
    tests, selected = expected_all_files(tracked)
    if (len(tests) != EXPECTED_TEST_FILES or len(selected) != EXPECTED_ALL_FILES
            or len(set(tests)) != len(tests) or HARNESS_TEST not in tests
            or WRITER_TEST not in selected
            or len([p for p in selected if p.startswith(INTEGRATION_PREFIX)]) != EXPECTED_INTEGRATION_FILES):
        raise RuntimeError('partition source inventory mismatch')
    if partition == 'writer':
        return [WRITER_TEST]
    if partition == 'rest':
        return [p for p in selected if p != WRITER_TEST]
    if partition == 'all':
        return selected
    raise RuntimeError('unknown partition')


def partition_identity(identity, members):
    return {'checkout': identity['checkout_head'], 'head': identity.get('pr_head_sha'),
            'tree': identity['checkout_tree'], 'repository': identity['repository'],
            'run_id': identity['run_id'], 'run_attempt': identity['run_attempt'],
            'source_sha256': hashlib.sha256(fixture_bytes(members)).hexdigest()}


def partition_binding(partition, identity, members):
    if partition not in PARTITION_COUNTS:
        raise RuntimeError('hosted partition required')
    return {'schema': 'ci-partition/1', 'partition': partition,
            'identity': partition_identity(identity, members),
            'selection': partition_files(sorted(members), partition),
            'counts': list(PARTITION_COUNTS[partition])}


def check_partition_binding():
    partition = partition_label(required=True)
    ev = ci_dir() / 'evidence'
    identity = load_json(ev / 'identity.json')
    if identity.get('errors') != []:
        raise RuntimeError('partition source identity failed')
    pre = load_pre(ev)
    expected = partition_binding(partition, identity, pre['members'])
    actual = load_json(ev / 'partition.json', JSON_LIMIT)
    if actual != expected:
        raise RuntimeError('partition binding changed')
    for key, name in [('checkout', 'GITHUB_SHA'), ('run_id', 'GITHUB_RUN_ID'),
                      ('run_attempt', 'GITHUB_RUN_ATTEMPT'), ('repository', 'GITHUB_REPOSITORY')]:
        if actual['identity'][key] != os.environ.get(name):
            raise RuntimeError('partition invocation changed')
    return actual


def check_all_files(stdout, tracked, errors, facts):
    tests, selected = expected_all_files(tracked)
    integration = [n for n in selected if n.startswith(INTEGRATION_PREFIX)]
    facts['selection'] = {'tracked_test_files': len(tests), 'selected_files': len(selected),
                          'integration_files': len(integration)}
    if len(tests) != EXPECTED_TEST_FILES or HARNESS_TEST not in tests:
        errors.append('tracked test file inventory is %d (want %d including the focused harness)' % (len(tests), EXPECTED_TEST_FILES))
    if len(selected) != EXPECTED_ALL_FILES:
        errors.append('selected file count %d, want %d' % (len(selected), EXPECTED_ALL_FILES))
    if len(integration) != EXPECTED_INTEGRATION_FILES:
        errors.append('integration file count %d, want %d' % (len(integration), EXPECTED_INTEGRATION_FILES))
    partition = partition_label()
    if partition != 'all':
        try:
            selected = partition_files(tracked, partition)
        except RuntimeError as error:
            errors.append(str(error))
            return
    facts['partition'] = partition
    facts['selected_files'] = selected
    seen = parse_file_lines(stdout)
    total = 0
    for name in selected:
        rows = seen.get(name)
        if rows is None:
            errors.append('no result line for ' + name)
        elif len(rows) != 1:
            errors.append('%d result lines for %s' % (len(rows), name))
        else:
            row = rows[0]
            total += row['tests']
            if name in FIXTURE_CONNECTED_COUNTS and row['tests'] != FIXTURE_CONNECTED_COUNTS[name]:
                errors.append('connected per-file count drift: ' + name)
            if name in FROZEN_RENDER046_COUNTS and row['tests'] != FROZEN_RENDER046_COUNTS[name]:
                errors.append('frozen-render046 per-file count drift: ' + name)
            if row['failed'] or row['skipped'] or row['todo'] or row['tests'] < 1:
                errors.append('%s reported failed/skipped/todo or no tests: %r' % (name, row))
    for name in FIXTURE_CONNECTED_COUNTS if partition != 'writer' else []:
        if name not in selected:
            errors.append('required connected file absent: ' + name)
    for name in FROZEN_RENDER046_COUNTS if partition != 'writer' else []:
        if name not in selected:
            errors.append('required frozen-render046 file absent: ' + name)
    unexpected = sorted(set(seen) - set(selected))
    if unexpected:
        errors.append('result lines for files outside the selection: %s' % unexpected[:5])
    expected_total = EXPECTED_ALL_TESTS if partition == 'all' else PARTITION_COUNTS[partition][1]
    if total != expected_total:
        errors.append('per-file test counts sum to %d, want %d' % (total, expected_total))
    facts['per_file_total'] = total
    facts['file_results'] = seen
    facts['integration_results'] = {n: seen.get(n) for n in integration}


def evaluate_stage(stage, stage_dir, runtime_dir, tracked=None):
    """Validate one stage's captured evidence. Returns (errors, facts). Pure file inspection."""
    errors, facts = [], {'stage': stage}
    stage_dir = Path(stage_dir)
    try:
        if read_bounded(stage_dir / 'exit', 16) != b'0\n':
            errors.append('actual exit record is not exactly 0')
    except Exception as error:
        errors.append('exit record unreadable (%s)' % type(error).__name__)
    try:
        if read_bounded(stage_dir / 'limits.txt', 256).decode() != LIMITS_TEXT:
            errors.append('limits.txt does not record core 0 and the 64 MiB file ceiling')
    except Exception as error:
        errors.append('limits.txt unreadable (%s)' % type(error).__name__)
    facts['warnings'] = snapshot_warnings(stage_dir)
    texts = {}
    for name in ('stdout', 'stderr'):
        try:
            size = os.lstat(stage_dir / name).st_size
            facts[name + '_bytes'] = size
            if size >= CAP:
                errors.append('%s reached the %d byte cap (incomplete capture)' % (name, CAP))
            else:
                texts[name] = read_bounded(stage_dir / name, CAP).decode('utf-8', errors='replace')
        except Exception as error:
            errors.append('%s unreadable (%s)' % (name, type(error).__name__))
    for name, text in texts.items():
        for needle in FATAL_TEXT:
            if needle in text:
                errors.append('%s contains %r' % (name, needle))
    if stage != 'prerequisite':
        stdout = texts.get('stdout', '')
        summary, problems = parse_summary(stdout)
        errors.extend(problems)
        facts['summary'] = summary
        want_files, want_tests = EXPECTED_COUNTS[stage]
        if stage == 'all' and partition_label() != 'all':
            files, tests, _ = PARTITION_COUNTS[partition_label()]
            want_files, want_tests = {'passed': files, 'total': files}, {'passed': tests, 'total': tests}
        if summary.get('files') != want_files:
            errors.append('Test Files counts %r, want %r' % (summary.get('files'), want_files))
        if summary.get('tests') != want_tests:
            errors.append('Tests counts %r, want %r' % (summary.get('tests'), want_tests))
        if FAILURE_LINE.search(ANSI.sub('', stdout)):
            errors.append('stdout contains a failure/unhandled/error summary line')
        if stage == 'all':
            check_all_files(stdout, tracked if tracked is not None else [], errors, facts)
    try:
        pre, post = read_lines(stage_dir / 'pre-attempts'), read_lines(stage_dir / 'post-attempts')
        new = sorted(set(post) - set(pre))
        if not set(pre) <= set(post) or len(new) != 1:
            errors.append('expected exactly one new guard attempt directory, got %r' % new)
            return errors, facts
    except Exception as error:
        errors.append('attempt lists unreadable (%s)' % type(error).__name__)
        return errors, facts
    attempt = Path(runtime_dir) / new[0]
    facts['attempt'] = new[0]
    entries = sorted(os.listdir(attempt))
    fixed = {'prerequisite.json'} if stage == 'prerequisite' else {'prerequisite.json', 'guard-result.json', 'guard.sock'}
    cases = [e for e in entries if e not in fixed]
    if 'fatal.json' in cases:
        errors.append('fatal.json present in the guard attempt directory')
    if 'prerequisite.json' not in entries:
        errors.append('prerequisite.json missing')
    else:
        try:
            check_prerequisite_record(load_json(attempt / 'prerequisite.json'), errors)
        except Exception as error:
            errors.append('prerequisite.json unreadable (%s)' % type(error).__name__)
    if stage == 'prerequisite':
        if cases or 'guard-result.json' in entries:
            errors.append('prerequisite attempt must contain only prerequisite.json')
        try:
            line = texts.get('stdout', '')
            if json.loads(line) != {'prerequisite': True, 'evidence': str(attempt)} or line.count('\n') != 1:
                errors.append('prerequisite stdout does not name this attempt directory exactly')
        except ValueError:
            errors.append('prerequisite stdout is not one JSON line')
        return errors, facts
    if 'guard-result.json' not in entries:
        errors.append('guard-result.json missing')
    else:
        try:
            check_ledger(load_json(attempt / 'guard-result.json'), 'guard-result', errors, guard=True)
        except Exception as error:
            errors.append('guard-result.json unreadable (%s)' % type(error).__name__)
    modes = ['complete', 'noncomplete'] if stage == 'focused' else ([] if partition_label() == 'writer' else ['p33'])
    if len(cases) != len(modes):
        errors.append('case directory count %d, want %d' % (len(cases), len(modes)))
        return errors, facts
    results = []
    for case in cases:
        path = attempt / case
        if not stat.S_ISDIR(os.lstat(path).st_mode):
            errors.append('case entry is not a directory: ' + case)
            continue
        try:
            mode = load_json(path / 'result.json').get('mode')
        except Exception:
            mode = None
        results.append((mode, path))
    if sorted(str(m) for m, _ in results) != sorted(modes):
        errors.append('case modes %r, want %r' % ([m for m, _ in results], modes))
        return errors, facts
    for mode, path in results:
        check_case(path, mode, errors, facts)
    return errors, facts





# Fixed fixture105 preparation/retention owner. No application import or general loader.
FIXTURE_NAME = 'desk-connected-fixture105'
FIXTURE_BINDINGS = ('ADOPTION.json', 'RELEASE.json', 'SOURCE-INVENTORY.json', 'SOURCE-LEDGER.json', 'TOOLS-INVENTORY.json')
FIXTURE_EFFECTS = ['construct_fixture_subject', 'evaluate_record_claims_writing', 'evaluate_record_performance', 'record_fixture_audit', 'readback_converge']
FIXTURE_CONNECTED_COUNTS = {'test/unit/connected-fixture105.test.ts': 58, 'test/integration/connected-fixture105.test.ts': 34}
FROZEN_RENDER046_COUNTS = {'test/unit/frozen-render046.test.ts': 40, 'test/unit/frozen-render046-responses.test.ts': 89, 'test/unit/frozen-fixture046-master.test.ts': 16, 'test/unit/technical-master-admission.test.ts': 12}
FIXTURE_TEMP_NAME = re.compile(r'vitest\.config\.ts\.timestamp-[0-9]{1,16}-[0-9a-f]{0,32}\.mjs')
FIXTURE_CACHE_HASH = 'da39a3ee5e6b4b0d3255bfef95601890afd80709'


def fixture_bytes(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False) + '\n').encode('utf-8')


def fixture_hash(value):
    return hashlib.sha256(value).hexdigest()


def fixture_open(path, directory=False):
    path = Path(path)
    if not path.is_absolute() or str(path) != os.path.normpath(path) or '..' in path.parts:
        raise RuntimeError('fixture absolute path required')
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for index, part in enumerate(path.parts[1:]):
            flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
            if directory or index < len(path.parts) - 2:
                flags |= os.O_DIRECTORY
            nxt = os.open(part, flags, dir_fd=fd)
            os.close(fd)
            fd = nxt
        return fd
    except BaseException:
        os.close(fd)
        raise


def fixture_identity(path, private=True):
    fd = fixture_open(path, True)
    try:
        info = os.fstat(fd)
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or (private and stat.S_IMODE(info.st_mode) != 0o700):
            raise RuntimeError('fixture directory ownership')
        return {'path': str(path), 'dev': info.st_dev, 'ino': info.st_ino, 'uid': info.st_uid, 'mode': stat.S_IMODE(info.st_mode)}
    finally:
        os.close(fd)


def fixture_read(path, limit, private=True):
    fd = fixture_open(path)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != os.getuid() or (private and stat.S_IMODE(info.st_mode) != 0o600) or info.st_size > limit:
            raise RuntimeError('fixture leaf bound/ownership')
        data = bytearray()
        while len(data) <= limit:
            part = os.read(fd, min(65536, limit + 1 - len(data)))
            if not part:
                break
            data.extend(part)
        after = os.fstat(fd)
        if len(data) != info.st_size or (info.st_dev, info.st_ino, info.st_mtime_ns, info.st_ctime_ns) != (after.st_dev, after.st_ino, after.st_mtime_ns, after.st_ctime_ns):
            raise RuntimeError('fixture leaf changed')
        return bytes(data)
    finally:
        os.close(fd)


def fixture_write_raw(path, data, limit=SNAPSHOT_LIMIT):
    if not isinstance(data, bytes) or len(data) > limit:
        raise RuntimeError('fixture output bound')
    parent = fixture_open(Path(path).parent, True)
    try:
        fd = os.open(Path(path).name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=parent)
        try:
            with os.fdopen(fd, 'wb', closefd=False) as stream:
                stream.write(data)
                stream.flush()
                os.fsync(fd)
        finally:
            os.close(fd)
        os.fsync(parent)
    finally:
        os.close(parent)
    return {'bytes': len(data), 'sha256': fixture_hash(data)}


def fixture_write(path, value):
    return fixture_write_raw(path, fixture_bytes(value))


def fixture_graph(base, kind):
    base = Path(base)
    result = {}
    def visit(path, rel):
        if len(result) > 20000:
            raise RuntimeError('fixture graph bound')
        info = path.lstat()
        mode = stat.S_IMODE(info.st_mode)
        if stat.S_ISLNK(info.st_mode):
            target = os.readlink(path)
            resolved = os.path.normpath(path.parent / target)
            if kind != 'tools' or os.path.isabs(target) or not resolved.startswith(str(base) + '/'):
                raise RuntimeError('fixture graph link')
            result[rel] = {'type': 'symlink', 'mode': mode, 'target': target}
        elif stat.S_ISDIR(info.st_mode):
            fd = fixture_open(path, True)
            try:
                actual = os.fstat(fd)
                if (actual.st_dev, actual.st_ino) != (info.st_dev, info.st_ino):
                    raise RuntimeError('fixture graph directory changed')
                result[rel] = {'type': 'directory', 'mode': mode}
                for name in sorted(os.listdir(fd)):
                    if not rel and name in (('.git', 'node_modules', 'dist') if kind == 'source' else ('.vite-temp',)):
                        continue
                    visit(path / name, rel + '/' + name if rel else name)
            finally:
                os.close(fd)
        elif stat.S_ISREG(info.st_mode):
            data = fixture_read(path, 64 * 1024 * 1024, False)
            result[rel] = {'type': 'file', 'mode': mode, 'bytes': len(data), 'sha256': fixture_hash(data)}
        else:
            raise RuntimeError('fixture graph special file')
    visit(base, '')
    return result


def fixture_temp(checkout, settled=False):
    path = Path(checkout) / 'node_modules/.vite-temp'
    if not os.path.lexists(path):
        return {'absent': True}
    identity = fixture_identity(path)
    names = sorted(os.listdir(path))
    if len(names) > (0 if settled else 1):
        raise RuntimeError('fixture loader remains unsettled')
    leaves = []
    for name in names:
        if not FIXTURE_TEMP_NAME.fullmatch(name):
            raise RuntimeError('fixture loader name')
        data = fixture_read(path / name, 262144, False)
        if path.joinpath(name).lstat().st_mode & 0o022:
            raise RuntimeError('fixture loader mode')
        leaves.append({'name': name, 'bytes': len(data), 'sha256': fixture_hash(data), 'hex': data.hex()})
    return {'identity': identity, 'leaves': leaves}


def fixture_prepare(base, checkout):
    """Only cmd_init invokes this after its existing identity/snapshot preconditions."""
    base, checkout = Path(base), Path(checkout)
    temp = base / 'tmp'
    root = temp / FIXTURE_NAME
    fixture_identity(temp)
    if os.path.lexists(root) or os.path.lexists(base / 'evidence/fixture105-binding.json'):
        raise RuntimeError('fixture root already exists')
    if os.path.lexists(checkout / 'node_modules/.vite-temp'):
        raise RuntimeError('fixture loader namespace already exists')
    source = fixture_graph(checkout, 'source')
    tools = fixture_graph(checkout / 'node_modules', 'tools')
    # Complete graph plus finite owner ledger; never an invented future source hash.
    root.mkdir(mode=0o700)
    for name in ('bindings', 'expectations', 'receipts'):
        (root / name).mkdir(mode=0o700)
    fixture_write(root / 'bindings/SOURCE-INVENTORY.json', source)
    fixture_write(root / 'bindings/TOOLS-INVENTORY.json', tools)
    rows = []
    for name in FIXTURE_OWNER_PATHS:
        row = source.get(name)
        if not row or row.get('type') != 'file':
            raise RuntimeError('fixture owner source missing')
        rows.append({'path': name, 'bytes': row['bytes'], 'sha256': row['sha256']})
    ledger = {'schema': 'connected-fixture105-source-ledger/1', 'rows': rows}
    ledger_pin = fixture_write(root / 'bindings/SOURCE-LEDGER.json', ledger)
    schema = json.loads(fixture_read(checkout / 'fixtures/connected-fixture151/SCHEMA-construction-observation.json', 262144, False))
    subject = {key: value['const'] for key, value in schema['properties']['subject']['properties'].items()}
    resources = {name: source['fixtures/connected-fixture151/' + name]['sha256'] for name in FIXTURE_RESOURCE_NAMES}
    # Host's resource identity uses canonical JSON without an LF; these strings are ASCII.
    manifest_hash = fixture_hash(json.dumps(resources, sort_keys=True, separators=(',', ':')).encode())
    release = {'release_id': 'connected-fixture105-test-release/1', 'profile': 'connected-evaluation-fixture105/1', 'purpose': 'evaluation', 'environment': 'test',
               'contract_sha256': source['docs/connected-fixture105.md']['sha256'], 'fixture_manifest_sha256': manifest_hash,
               'owner_source_ledger_sha256': ledger_pin['sha256'], 'subject_binding': subject, 'allowed_effects': FIXTURE_EFFECTS}
    release_pin = fixture_write(root / 'bindings/RELEASE.json', release)
    fixture_write(root / 'bindings/ADOPTION.json', {'release_id': release['release_id'], 'release_bytes': release_pin['bytes'], 'release_sha256': release_pin['sha256'], 'ledger_bytes': ledger_pin['bytes'], 'ledger_sha256': ledger_pin['sha256']})
    marker = {'schema': 'fixture105-execution-root/1', 'purpose': 'test_fixture105', 'checkout': fixture_identity(checkout, False),
              'tmp': fixture_identity(temp), 'root': fixture_identity(root), 'source_ledger_sha256': ledger_pin['sha256'], 'release_sha256': release_pin['sha256'],
              'source_inventory_sha256': fixture_hash(fixture_bytes(source)), 'tools_inventory_sha256': fixture_hash(fixture_bytes(tools))}
    marker_pin = fixture_write(root / 'ROOT.json', marker)
    binding = {'root': str(root), 'root_sha256': marker_pin['sha256']}
    fixture_write(base / 'evidence/fixture105-binding.json', binding)
    return binding


def fixture_graph_difference(expected, actual, kind):
    """Bounded diagnostic of existing graphs: paths and field names, never values."""
    paths = sorted(path for path in expected.keys() | actual.keys()
                   if path not in expected or path not in actual or expected[path] != actual[path])
    differences = []
    for path in paths[:10]:
        before, after = expected.get(path, {}), actual.get(path, {})
        fields = sorted(key for key in before.keys() | after.keys()
                        if key not in before or key not in after or before[key] != after[key])
        differences.append({'path': path[:200] if path else '.',
                            'classification': 'added' if path not in expected else 'removed' if path not in actual else 'changed',
                            'fields': fields})
    return json.dumps({'kind': kind, 'changed_path_count': len(paths), 'differences': differences},
                      sort_keys=True, separators=(',', ':'), ensure_ascii=True)


def fixture_validate(base, checkout, settled=False):
    base, checkout = Path(base), Path(checkout)
    binding = json.loads(fixture_read(base / 'evidence/fixture105-binding.json', 8192))
    root = base / 'tmp' / FIXTURE_NAME
    if set(binding) != {'root', 'root_sha256'} or binding['root'] != str(root):
        raise RuntimeError('fixture independent binding')
    marker_bytes = fixture_read(root / 'ROOT.json', 262144)
    if fixture_hash(marker_bytes) != binding['root_sha256']:
        raise RuntimeError('fixture marker hash')
    marker = json.loads(marker_bytes)
    if set(marker) != {'schema', 'purpose', 'checkout', 'tmp', 'root', 'source_ledger_sha256', 'release_sha256', 'source_inventory_sha256', 'tools_inventory_sha256'} or marker['schema'] != 'fixture105-execution-root/1' or marker['purpose'] != 'test_fixture105':
        raise RuntimeError('fixture marker shape')
    for key, path, private in (('root', root, True), ('tmp', base / 'tmp', True), ('checkout', checkout, False)):
        if marker[key] != fixture_identity(path, private):
            raise RuntimeError('fixture root identity')
    for directory in ('bindings', 'expectations', 'receipts'):
        fixture_identity(root / directory)
    if sorted(os.listdir(root / 'bindings')) != list(FIXTURE_BINDINGS):
        raise RuntimeError('fixture binding population')
    for name, key in (('SOURCE-LEDGER.json', 'source_ledger_sha256'), ('RELEASE.json', 'release_sha256'), ('SOURCE-INVENTORY.json', 'source_inventory_sha256'), ('TOOLS-INVENTORY.json', 'tools_inventory_sha256')):
        data = fixture_read(root / 'bindings' / name, SNAPSHOT_LIMIT if 'INVENTORY' in name else 262144)
        if fixture_hash(data) != marker[key]:
            raise RuntimeError('fixture binding changed')
        if 'INVENTORY' in name:
            kind = 'source' if name.startswith('SOURCE') else 'tools'
            expected = json.loads(data)
            actual = fixture_graph(checkout if kind == 'source' else checkout / 'node_modules', kind)
            if expected != actual:
                raise RuntimeError('fixture immutable graph changed ' + fixture_graph_difference(expected, actual, kind))
    release_bytes = fixture_read(root / 'bindings/RELEASE.json', 262144)
    ledger_bytes = fixture_read(root / 'bindings/SOURCE-LEDGER.json', 262144)
    adoption = json.loads(fixture_read(root / 'bindings/ADOPTION.json', 262144))
    expected_adoption = {'release_id': 'connected-fixture105-test-release/1', 'release_bytes': len(release_bytes), 'release_sha256': fixture_hash(release_bytes), 'ledger_bytes': len(ledger_bytes), 'ledger_sha256': fixture_hash(ledger_bytes)}
    release = json.loads(release_bytes)
    if adoption != expected_adoption or release.get('release_id') != adoption['release_id'] or release.get('owner_source_ledger_sha256') != adoption['ledger_sha256']:
        raise RuntimeError('fixture adoption relation')
    temp = fixture_temp(checkout, settled)
    if not temp.get('absent'):
        created = json.loads(fixture_read(base / 'evidence/fixture105-loader-created.json', 262144))
        if temp['identity'] != created.get('identity'):
            raise RuntimeError('fixture loader identity changed')
    return binding, temp


def cmd_fixture_binding(stage):
    base = ci_dir()
    binding, temp = fixture_validate(base, ROOT, True)
    loader = ROOT / 'node_modules/.vite-temp'
    if stage in ('focused', 'all') and temp.get('absent'):
        loader.mkdir(mode=0o700)
        temp = fixture_temp(ROOT, True)
        fixture_write(base / 'evidence/fixture105-loader-created.json', temp)
    if stage == 'all' and temp.get('absent'):
        raise RuntimeError('fixture loader ownership missing')
    fixture_write(base / ('evidence/fixture105-before-' + stage + '.json'), {'binding': binding, 'temp': temp})
    print(json.dumps(binding, separators=(',', ':')))
    return 0


FIXTURE_CASE_EXPECTATIONS = [{'case_id': 'records actual18+7 results, one direction and a labelled audit with retained semantic gaps', 'expected': ['completed']}, {'case_id': 'keeps actual fixture output outside genuine admission and rejects render audit promotion', 'expected': ['completed']}, {'case_id': 'converges by exact readback without producing a second direction', 'expected': ['completed']}, {'case_id': 'refuses a preseeded source population without constructing an observation', 'expected': ['expected_refusal', 'expected_refusal', 'expected_refusal', 'expected_refusal']}, {'case_id': 'rolls back the package when the later observation insert fails', 'expected': ['expected_refusal']}, {'case_id': 'refuses context change between settled acquisition and consumer', 'expected': ['expected_refusal']}, {'case_id': 'rolls back every Performance row after a late gate insert failure', 'expected': ['expected_refusal']}, {'case_id': 'retains durable direction if the separate audit transaction fails', 'expected': ['expected_refusal']}, {'case_id': 'refuses an extra governed intent during re-entry', 'expected': ['completed']}, {'case_id': 'preserves package preflight refusal without a connection checkout', 'expected': []}, {'case_id': 'preserves the old package creation and governed-hash reuse outcomes', 'expected': []}, {'case_id': 'preserves orphan completion as distinguishable from genuinely fresh creation', 'expected': []}, {'case_id': 'refuses unregistered structural objects including a caller transaction at the package borrower', 'expected': []}, {'case_id': 'associates a genuine package capability only with its owner transaction', 'expected': ['expected_refusal']}, {'case_id': 'refuses an appended event between settled acquisition and consumption', 'expected': ['expected_refusal']}, {'case_id': 'refuses production context before a database checkout', 'expected': ['pre_target_failure']}, {'case_id': 'rejects a second live borrow, a clone, and a stale genuine capability', 'expected': ['expected_refusal']}, {'case_id': 'rejects live capability consumption after originating context changes', 'expected': ['expected_refusal', 'expected_refusal', 'expected_refusal']}, {'case_id': 'holds a lost direction COMMIT acknowledgement and reconciles without replay', 'expected': ['expected_later_phase_unknown']}, {'case_id': 'rolls back package creation when a foreign observation identity wins late', 'expected': ['expected_refusal']}, {'case_id': 'refuses a stale extra gate fingerprint without changing durable rows', 'expected': ['completed']}, {'case_id': 'holds unknown construction commit without inventing its missing settlement receipt', 'expected': ['expected_construction_unknown', 'expected_construction_unknown', 'expected_construction_unknown', 'expected_later_phase_unknown']}, {'case_id': 'retains event-first reader identity across distinct query and rollback errors', 'expected': ['pre_target_failure']}, {'case_id': 'retains query-first reader identity across distinct later client and rollback errors', 'expected': ['pre_target_failure']}, {'case_id': 'retains reader listener when release throws before driver handoff without retry', 'expected': ['pre_target_failure']}, {'case_id': 'closes continuation when the acquisition-cut await throws before consumption', 'expected': ['expected_refusal', 'pre_target_failure']}, {'case_id': 'tracks and cleans a database allocation that fails before create returns', 'expected': []}, {'case_id': 'tracks a setup pool before roles SQL or migration can fail', 'expected': []}, {'case_id': 'tracks bootstrap role allocation before bootstrap returns', 'expected': []}, {'case_id': 'retains full actual failed Claims coverage and findings in a private failure receipt', 'expected': ['expected_refusal']}, {'case_id': 'memoizes a first setup pool-end failure without another end call', 'expected': []}, {'case_id': 'preserves the old package four-round reconciliation bound under named-conflict delivery', 'expected': []}, {'case_id': 'preserves an unrelated package failure object and releases its transaction', 'expected': []}, {'case_id': 'identifies a held client while preserving target isolation refusal', 'expected': ['pre_target_failure']}]


def fixture_journal(root, suite):
    """Cross-check independent initiated targets, immutable intents, terminals and actual receipts."""
    if set(suite) != {'schema', 'targets', 'pre_target_failures', 'tool_observations', 'suite_complete', 'cases'} or suite['suite_complete'] is not True:
        raise RuntimeError('fixture suite incomplete')
    release_bytes = fixture_read(root / 'bindings/RELEASE.json', 262144)
    release = json.loads(release_bytes)
    subject_hash = fixture_hash(json.dumps(release['subject_binding'], sort_keys=True, separators=(',', ':')).encode())
    targets = suite.get('targets')
    if suite.get('schema') != 'fixture105-suite/1' or not isinstance(targets, list) or len(targets) > 128 or not isinstance(suite.get('pre_target_failures'), list):
        raise RuntimeError('fixture suite shape')
    cases = suite.get('cases')
    if not isinstance(cases, list) or len(cases) != len(FIXTURE_CASE_EXPECTATIONS):
        raise RuntimeError('fixture harness case population')
    expected_by_target, pretargets = {}, set()
    for case, fixed in zip(cases, FIXTURE_CASE_EXPECTATIONS):
        if set(case) != {'case_id', 'expected', 'completed', 'calls'} or case['case_id'] != fixed['case_id'] or case['expected'] != fixed['expected'] or case['completed'] is not True or not isinstance(case['calls'], list) or len(case['calls']) != len(fixed['expected']):
            raise RuntimeError('fixture harness case incomplete or expectation changed')
        for ordinal, (call, expected) in enumerate(zip(case['calls'], fixed['expected'])):
            if set(call) != {'ordinal', 'expected', 'completed', 'returned', 'target_hash', 'pre_target_index'} or call['ordinal'] != ordinal or call['expected'] != expected or call['completed'] is not True or call['returned'] is not (expected == 'completed'):
                raise RuntimeError('fixture harness invocation incomplete')
            if expected == 'pre_target_failure':
                index = call['pre_target_index']
                if call['target_hash'] is not None or type(index) is not int or index < 0 or index >= len(suite['pre_target_failures']) or index in pretargets:
                    raise RuntimeError('fixture harness pretarget correspondence')
                pretargets.add(index)
            else:
                key = call['target_hash']
                if call['pre_target_index'] is not None or not isinstance(key, str) or not SHA256.fullmatch(key) or key in expected_by_target:
                    raise RuntimeError('fixture harness target correspondence')
                expected_by_target[key] = expected
    if pretargets != set(range(len(suite['pre_target_failures']))) or set(expected_by_target) != {row.get('target_hash') for row in targets}:
        raise RuntimeError('fixture unaccounted host invocation')
    expected_intents, expected_receipts = set(), set()
    for target in targets:
        if set(target) != {'target_hash', 'construction_state', 'later_phase', 'later_outcome'} or not SHA256.fullmatch(target.get('target_hash', '')):
            raise RuntimeError('fixture target shape')
        key = target['target_hash']
        expected = expected_by_target[key]
        if key + '.intent.json' in expected_intents:
            raise RuntimeError('fixture duplicate target')
        expected_intents.add(key + '.intent.json')
        intent_bytes = fixture_read(root / 'expectations' / (key + '.intent.json'), 16384)
        intent = json.loads(intent_bytes)
        if set(intent) != {'schema', 'target_hash', 'release_sha256', 'subject_sha256', 'expected_names', 'state'} or intent['schema'] != 'fixture105-receipt-intent/1' or intent['target_hash'] != key or intent['expected_names'] != ['CONSTRUCTION.json'] or intent['state'] != 'intent':
            raise RuntimeError('fixture intent shape')
        if intent['release_sha256'] != fixture_hash(release_bytes) or intent['subject_sha256'] != subject_hash:
            raise RuntimeError('fixture intent subject/release')
        if target['later_phase'] not in ('construction', 'claims', 'direction', 'audit', 'readback') or target['later_outcome'] not in ('completed', 'refused', 'unknown') or expected not in ('completed', 'expected_refusal', 'expected_construction_unknown', 'expected_later_phase_unknown'):
            raise RuntimeError('fixture target outcome')
        if (expected == 'completed') != (target['later_outcome'] == 'completed') or (expected == 'expected_refusal') != (target['later_outcome'] == 'refused'):
            raise RuntimeError('fixture target outcome correspondence')
        terminal_path = root / 'expectations' / (key + '.terminal.json')
        if target['construction_state'] == 'construction_unknown':
            if expected != 'expected_construction_unknown' or os.path.lexists(terminal_path) or os.path.lexists(root / 'receipts' / key):
                raise RuntimeError('fixture unknown construction mismatched')
            continue
        expected_intents.add(key + '.terminal.json')
        terminal = json.loads(fixture_read(terminal_path, 16384))
        keys = {'schema', 'target_hash', 'intent_sha256', 'state', 'receipts'}
        if target['construction_state'] == 'refused_before_receipt':
            keys.add('code')
        if set(terminal) != keys or terminal['schema'] != 'fixture105-receipt-terminal/1' or terminal['target_hash'] != key or terminal['intent_sha256'] != fixture_hash(intent_bytes) or terminal['state'] != target['construction_state']:
            raise RuntimeError('fixture terminal mismatch')
        if target['construction_state'] == 'refused_before_receipt':
            if terminal['receipts'] != [] or expected != 'expected_refusal' or not re.fullmatch(r'[A-Za-z0-9_.:-]{1,128}', terminal.get('code', '')):
                raise RuntimeError('fixture refusal mismatch')
            continue
        if target['construction_state'] != 'construction_recorded':
            raise RuntimeError('fixture unexpected incomplete target')
        expected_receipts.add(key)
        rows = terminal['receipts']
        if not isinstance(rows, list) or len(rows) != 1 or rows[0].get('name') != 'CONSTRUCTION.json':
            raise RuntimeError('fixture construction receipt required')
        failure = root / 'expectations' / (key + '.claims-failure.json')
        if os.path.lexists(failure):
            expected_intents.add(failure.name)
            failure_value = json.loads(fixture_read(failure, 16384))
            if set(failure_value) != {'schema', 'target_hash', 'intent_sha256', 'state', 'receipts'} or failure_value['schema'] != terminal['schema'] or failure_value['target_hash'] != key or failure_value['intent_sha256'] != terminal['intent_sha256'] or failure_value['state'] != 'construction_recorded' or len(failure_value['receipts']) != 1 or failure_value['receipts'][0].get('name') != 'CLAIMS-FAILURE.json':
                raise RuntimeError('fixture failure terminal')
            rows += failure_value['receipts']
        directory = root / 'receipts' / key
        fixture_identity(directory)
        if sorted(os.listdir(directory)) != sorted(row['name'] for row in rows):
            raise RuntimeError('fixture receipt population')
        for row in rows:
            if set(row) != {'name', 'bytes', 'sha256'}:
                raise RuntimeError('fixture receipt identity shape')
            data = fixture_read(directory / row['name'], 16384 if row['name'] == 'CONSTRUCTION.json' else 262144)
            if len(data) != row['bytes'] or fixture_hash(data) != row['sha256']:
                raise RuntimeError('fixture receipt changed')
    if set(os.listdir(root / 'expectations')) != expected_intents or set(os.listdir(root / 'receipts')) != expected_receipts:
        raise RuntimeError('fixture missing or extra journal target')


def fixture_cache_rows(data, known):
    value = json.loads(data)
    if set(value) != {'version', 'results'} or value['version'] != '4.1.12' or not isinstance(value['results'], list):
        raise RuntimeError('fixture cache shape')
    seen = set()
    for row in value['results']:
        if not isinstance(row, list) or len(row) != 2 or not isinstance(row[0], str) or not row[0].startswith(':') or row[0] in seen or row[0].split(':', 1)[-1] not in known or not isinstance(row[1], dict) or set(row[1]) != {'duration', 'failed'} or type(row[1]['failed']) is not bool or type(row[1]['duration']) not in (int, float) or not 0 <= row[1]['duration'] < float('inf'):
            raise RuntimeError('fixture cache row')
        seen.add(row[0])
    return value


def fixture_cache_snapshot(root, known, nonces, required):
    cache = root / 'tool-cache'
    expected = {'vitest/' + FIXTURE_CACHE_HASH + '/results.json': known}
    if len(nonces) > 8 or len(set(nonces)) != len(nonces) or any(not NONCE.fullmatch(n) for n in nonces):
        raise RuntimeError('fixture cache nonce population')
    expected.update({'p33/' + nonce + '/vitest/' + FIXTURE_CACHE_HASH + '/results.json': {'test/support/p33-parity-child.case.ts'} for nonce in nonces})
    found = {}
    if os.path.lexists(cache):
        fixture_identity(cache, False)
        for current, dirs, files in os.walk(cache, followlinks=False):
            for name in dirs + files:
                path = Path(current) / name
                rel = path.relative_to(cache).as_posix()
                info = path.lstat()
                if info.st_uid != os.getuid() or info.st_mode & 0o022 or stat.S_ISLNK(info.st_mode):
                    raise RuntimeError('fixture cache ownership')
                if stat.S_ISDIR(info.st_mode):
                    if not any(key.startswith(rel + '/') for key in expected):
                        raise RuntimeError('fixture extra cache directory')
                elif stat.S_ISREG(info.st_mode) and rel in expected:
                    data = fixture_read(path, SNAPSHOT_LIMIT, False)
                    fixture_cache_rows(data, expected[rel])
                    found[rel] = {'bytes': len(data), 'sha256': fixture_hash(data)}
                else:
                    raise RuntimeError('fixture extra cache leaf')
    if required and set(found) != set(expected):
        raise RuntimeError('fixture missing expected cache')
    return found


def fixture_mkdirs(base, relative):
    current = Path(base)
    for name in Path(relative).parts:
        if name in ('', '.', '..') or '/' in name:
            raise RuntimeError('fixture snapshot path')
        current = current / name
        if not os.path.lexists(current):
            current.mkdir(mode=0o700)
        fixture_identity(current)


def fixture_capture_raw(base, label, checkout):
    """Copy only bounded, named tooling bytes before interpreting their contents.

    Unsafe paths are recorded, never followed. This does not certify settlement or
    cache semantics. An interrupted capture remains exclusive partial evidence.
    """
    root = base / 'tmp' / FIXTURE_NAME
    snapshot = base / ('evidence/fixture105-cache-' + label)
    snapshot.mkdir(mode=0o700)
    pins, errors = {}, []
    def capture(path, rel, limit):
        try:
            if path.lstat().st_mode & 0o022:
                raise RuntimeError('fixture unsafe generated leaf mode')
            data = fixture_read(path, limit, False)
            fixture_mkdirs(snapshot, Path(rel).parent)
            pins[rel] = fixture_write_raw(snapshot / rel, data, limit)
        except Exception as error:
            errors.append(rel + ': ' + type(error).__name__)
    # Enumeration is finite even for malformed caches; no arbitrary tree walk.
    cache = root / 'tool-cache'
    try:
        if os.path.lexists(cache):
            fixture_identity(cache, False)
            if set(os.listdir(cache)) - {'vitest', 'p33'}:
                errors.append('cache: extra root entry')
            prefixes = ['']
            nested = cache / 'p33'
            if os.path.lexists(nested):
                fixture_identity(nested, False)
                nonces = sorted(os.listdir(nested))
                if len(nonces) > 8:
                    errors.append('cache: nonce bound')
                for nonce in nonces[:8]:
                    if NONCE.fullmatch(nonce):
                        fixture_identity(nested / nonce, False)
                        prefixes.append('p33/' + nonce + '/')
                    else:
                        errors.append('cache: invalid nonce name')
            for prefix in prefixes:
                rel = prefix + 'vitest/' + FIXTURE_CACHE_HASH + '/results.json'
                if os.path.lexists(cache / rel):
                    capture(cache / rel, rel, SNAPSHOT_LIMIT)
    except Exception as error:
        errors.append('cache enumeration: ' + type(error).__name__)
    loader = checkout / 'node_modules/.vite-temp'
    try:
        if os.path.lexists(loader):
            fixture_identity(loader)
            names = sorted(os.listdir(loader))
            if len(names) > 1:
                errors.append('loader: population bound')
            for name in names[:1]:
                if re.fullmatch(r'vitest\.config\.ts\.timestamp-[0-9]{1,16}-[0-9a-f]{0,32}\.mjs', name):
                    capture(loader / name, 'loader/' + name, 262144)
                else:
                    errors.append('loader: invalid name')
    except Exception as error:
        errors.append('loader enumeration: ' + type(error).__name__)
    return {'snapshot': pins, 'errors': errors}


def fixture_empty_writer(base, root):
    for name in ('expectations', 'receipts'):
        fixture_identity(root / name)
        if os.listdir(root / name):
            raise RuntimeError('writer connected population is not empty')
    if os.path.lexists(base / 'evidence/fixture105-suite.json'):
        raise RuntimeError('writer unexpectedly produced a connected suite journal')


def fixture_capture_stage(base, stage, facts, required):
    record = {'stage': stage, **fixture_capture_raw(base, stage, ROOT)}
    try:
        binding, temp = fixture_validate(base, ROOT, True)
        root = Path(binding['root'])
        nonces = [row['nonce'] for row in facts.get('cases', []) if row.get('mode') == 'p33']
        _, known = expected_all_files(tracked_files())
        if partition_label() != 'all':
            known = partition_files(tracked_files(), partition_label())
        cache = fixture_cache_snapshot(root, set(known) | {HARNESS_TEST}, nonces, required and stage != 'prerequisite')
        record.update(binding=binding, temp=temp, cache=cache)
        if record['snapshot'] != cache:
            raise RuntimeError('fixture captured cache or loader population changed')
        if stage == 'all':
            if partition_label() == 'writer':
                fixture_empty_writer(base, root)
                record['connected_population'] = 'empty'
            else:
                suite_bytes = fixture_read(base / 'evidence/fixture105-suite.json', SNAPSHOT_LIMIT)
                fixture_journal(root, json.loads(suite_bytes))
                record['suite_sha256'] = fixture_hash(suite_bytes)
    except Exception as error:
        record['errors'].append('fixture validation: ' + type(error).__name__)
    record['complete'] = not record['errors']
    fixture_write(base / ('evidence/fixture105-after-' + stage + '.json'), record)
    return record


def fixture_snapshot_population(snapshot, expected=None):
    fixture_identity(snapshot)
    leaf_pattern = re.compile(r'(?:(?:p33/[0-9a-f]{48}/)?vitest/' + FIXTURE_CACHE_HASH + r'/results\.json|loader/vitest\.config\.ts\.timestamp-[0-9]{1,16}-[0-9a-f]{0,32}\.mjs)')
    directory_pattern = re.compile(r'(?:vitest(?:/' + FIXTURE_CACHE_HASH + r')?|p33(?:/[0-9a-f]{48}(?:/vitest(?:/' + FIXTURE_CACHE_HASH + r')?)?)?|loader)')
    def ancestors(names):
        return {str(parent) for name in names for parent in Path(name).parents if str(parent) != '.'}
    allowed = None
    if expected is not None:
        if not isinstance(expected, dict) or len(expected) > 10 or any(not isinstance(name, str) or not leaf_pattern.fullmatch(name) for name in expected):
            raise RuntimeError('fixture pinned snapshot shape')
        allowed = ancestors(expected)
    found, directories = {}, set()
    pending = [(snapshot, '')]
    while pending:
        current, relative = pending.pop()
        fixture_identity(current)
        # Do not enumerate an unbounded directory before enforcing the bound.
        entries = []
        with os.scandir(current) as iterator:
            for entry in iterator:
                if len(entries) >= 10:
                    raise RuntimeError('fixture snapshot entry bound')
                entries.append(entry.name)
        for name in sorted(entries):
            path = current / name
            rel = relative + '/' + name if relative else name
            info = path.lstat()
            if stat.S_ISDIR(info.st_mode):
                if len(directories) >= 32 or not directory_pattern.fullmatch(rel) or (allowed is not None and rel not in allowed):
                    raise RuntimeError('fixture snapshot directory population')
                fixture_identity(path)
                directories.add(rel)
                pending.append((path, rel))
            else:
                if not leaf_pattern.fullmatch(rel) or len(found) >= 10:
                    raise RuntimeError('fixture snapshot name/population')
                data = fixture_read(path, 262144 if rel.startswith('loader/') else SNAPSHOT_LIMIT)
                found[rel] = {'bytes': len(data), 'sha256': fixture_hash(data)}
    if directories != ancestors(found) or (allowed is not None and directories != allowed):
        raise RuntimeError('fixture snapshot empty/missing directory')
    return found


def fixture_collect(base, keep, scope, successful):
    """Bounded safe partial retention; missing/extra/changed evidence never becomes a pass."""
    root = base / 'tmp' / FIXTURE_NAME
    total = 0
    pins = []
    def retain(src, rel, limit, required=True):
        nonlocal total
        try:
            data = fixture_read(src, limit)
            total += len(data)
            if total > 64 * 1024 * 1024:
                raise RuntimeError('fixture total retention bound')
            raw_pin = {'bytes': len(data), 'sha256': fixture_hash(data)}
            if not keep.copy(src, Path(rel), limit, required=required):
                raise RuntimeError('fixture retention copy failed')
            after = fixture_read(src, limit)
            if after != data:
                raise RuntimeError('fixture changed during copy')
            retained = read_bounded(keep.upload / rel, limit)
            pins.append({'path': rel, 'original': raw_pin, 'retained': {'bytes': len(retained), 'sha256': fixture_hash(retained)}, 'redacted': retained != data})
        except FileNotFoundError:
            if required:
                keep.problems['missing'].append(rel)
        except Exception as error:
            keep.problems['errors'].append(rel + ': ' + type(error).__name__)
    retain(root / 'ROOT.json', 'fixture105/ROOT.json', 262144)
    for name in FIXTURE_BINDINGS:
        retain(root / 'bindings' / name, 'fixture105/bindings/' + name, SNAPSHOT_LIMIT if 'INVENTORY' in name else 262144)
    retain(base / 'evidence/fixture105-binding.json', 'fixture105/runner-binding.json', 8192)
    if scope == 'full' and partition_label() != 'writer':
        retain(base / 'evidence/fixture105-suite.json', 'fixture105/suite.json', SNAPSHOT_LIMIT)
    try:
        allowed = {'ROOT.json', 'bindings', 'expectations', 'receipts', 'tool-cache', 'RETENTION.json'}
        if set(os.listdir(root)) - allowed:
            raise RuntimeError('fixture extra root entry')
        expectations = sorted(os.listdir(root / 'expectations'))
        receipts = sorted(os.listdir(root / 'receipts'))
        if len(expectations) > 384 or len(receipts) > 128:
            raise RuntimeError('fixture target bound')
        for name in expectations:
            if not re.fullmatch(r'[0-9a-f]{64}\.(intent|terminal|claims-failure)\.json', name):
                raise RuntimeError('fixture expectation name')
            retain(root / 'expectations' / name, 'fixture105/expectations/' + name, 16384)
        for target in receipts:
            if not SHA256.fullmatch(target):
                raise RuntimeError('fixture receipt target name')
            directory = root / 'receipts' / target
            fixture_identity(directory)
            for name in sorted(os.listdir(directory)):
                if name not in ('CONSTRUCTION.json', 'CLAIMS-FAILURE.json'):
                    raise RuntimeError('fixture receipt name')
                retain(directory / name, 'fixture105/receipts/' + target + '/' + name, 16384 if name == 'CONSTRUCTION.json' else 262144)
        if scope == 'full' and 'all' in successful:
            if partition_label() == 'writer':
                fixture_empty_writer(base, root)
            else:
                fixture_journal(root, json.loads(fixture_read(base / 'evidence/fixture105-suite.json', SNAPSHOT_LIMIT)))
    except Exception as error:
        keep.problems['errors'].append('fixture journal collection: ' + type(error).__name__)
    for stage in SCOPES[scope]:
        try:
            after = base / ('evidence/fixture105-after-' + stage + '.json')
            snapshot = base / ('evidence/fixture105-cache-' + stage)
            # A skipped check cannot erase safe extant bytes from the failed stage.
            attempted = (base / 'evidence' / stage).exists() or after.exists()
            if stage not in successful and attempted:
                salvage = fixture_capture_raw(base, 'salvage-' + scope + '-' + stage, ROOT)
                fixture_write(base / ('evidence/fixture105-salvage-' + scope + '-' + stage + '.json'), salvage)
                retain(base / ('evidence/fixture105-salvage-' + scope + '-' + stage + '.json'), 'tooling-fixture105/salvage-' + scope + '-' + stage + '.json', SNAPSHOT_LIMIT)
                for rel in salvage['snapshot']:
                    retain(base / ('evidence/fixture105-cache-salvage-' + scope + '-' + stage) / rel, 'tooling-fixture105/salvage-' + scope + '-' + stage + '/' + rel, SNAPSHOT_LIMIT)
                if salvage['errors']:
                    keep.problems['errors'].append('fixture partial salvage: ' + stage)
            for prefix in ('before', 'after'):
                retain(base / ('evidence/fixture105-' + prefix + '-' + stage + '.json'), 'tooling-fixture105/' + prefix + '-' + stage + '.json', SNAPSHOT_LIMIT, stage in successful)
            try:
                if stage in successful:
                    record = json.loads(fixture_read(after, SNAPSHOT_LIMIT))
                    pinned = successful[stage].get('facts', {}).get('fixture105')
                    if record != pinned or record.get('complete') is not True or record.get('errors') != []:
                        raise RuntimeError('fixture successful stage record changed')
                    actual = fixture_snapshot_population(snapshot, record.get('snapshot'))
                    if actual != record.get('snapshot') or actual != record.get('cache'):
                        raise RuntimeError('fixture successful snapshot population/hash changed')
                elif os.path.lexists(snapshot):
                    actual = fixture_snapshot_population(snapshot)
                else:
                    actual = {}
                for rel in actual:
                    retain(snapshot / rel, 'tooling-fixture105/' + stage + '/' + rel, SNAPSHOT_LIMIT)
            except Exception as error:
                keep.problems['errors'].append('fixture stage ' + stage + ': ' + type(error).__name__)

        except Exception as error:
            keep.problems['errors'].append('fixture collection ' + stage + ': ' + type(error).__name__)
    manifest = {'schema': 'fixture105-retention/1', 'scope': scope, 'files': pins, 'total_bytes': total, 'problems': keep.problems}
    fixture_write(keep.upload / 'fixture105-retention.json', manifest)
    if scope == 'full':
        try:
            fixture_write(root / 'RETENTION.json', manifest)
        except Exception as error:
            keep.problems['errors'].append('fixture terminal retention: ' + type(error).__name__)

FIXTURE_OWNER_PATHS = ('docs/connected-fixture105.md', 'eslint.config.js', 'fixtures/connected-fixture151/AUTHORED-NORMALIZED-ROWS.json', 'fixtures/connected-fixture151/BRIEF.json', 'fixtures/connected-fixture151/CANONICAL-PREIMAGES.json', 'fixtures/connected-fixture151/CEILING-EXPECTATIONS.json', 'fixtures/connected-fixture151/CLAIM-ROWS.json', 'fixtures/connected-fixture151/CONFIG.json', 'fixtures/connected-fixture151/CONNECTED-REFUSAL-WITNESSES.json', 'fixtures/connected-fixture151/CONTEXT-EXPECTED.json', 'fixtures/connected-fixture151/CONTEXT-RESOLUTION.json', 'fixtures/connected-fixture151/DERIVATION-EXPECTED.json', 'fixtures/connected-fixture151/DIRECTION-EXPECTED.json', 'fixtures/connected-fixture151/EVENT-ROWS.json', 'fixtures/connected-fixture151/EVIDENCE-ROWS.json', 'fixtures/connected-fixture151/FIVE-MATCH-INPUTS.json', 'fixtures/connected-fixture151/IDENTITIES.json', 'fixtures/connected-fixture151/INNER-DIGEST-REFUSAL-WITNESSES.json', 'fixtures/connected-fixture151/INNER-DIGEST-RULES.md', 'fixtures/connected-fixture151/PACKAGE.json', 'fixtures/connected-fixture151/PURE-REFUSAL-WITNESSES.json', 'fixtures/connected-fixture151/RESULT-DIGEST-MAP.json', 'fixtures/connected-fixture151/RIGHTS.json', 'fixtures/connected-fixture151/ROSTER.json', 'fixtures/connected-fixture151/ROW-AND-BYTE-BOUNDS.json', 'fixtures/connected-fixture151/SCHEMA-HASH-MAPPING.json', 'fixtures/connected-fixture151/SCHEMA-audit.json', 'fixtures/connected-fixture151/SCHEMA-construction-observation.json', 'fixtures/connected-fixture151/SCHEMA-operation.json', 'fixtures/connected-fixture151/SPOKEN-TEXT.txt', 'fixtures/connected-fixture151/SQL-COLUMN-MAP.json', 'fixtures/connected-fixture151/SUBSTANTIVE-SCRIPT.json', 'fixtures/connected-fixture151/SUCCESSOR-PROVENANCE.json', 'fixtures/connected-fixture151/SUPPORT-ROWS.json', 'fixtures/connected-fixture151/TEMPLATE.json', 'fixtures/connected-fixture151/TEXTURE-CARRIER.json', 'fixtures/connected-fixture151/TEXTURE-OWNER-ADDENDUM.md', 'fixtures/connected-fixture151/TEXTURE-REWRITE.json', 'fixtures/connected-fixture151/TEXTURE-SCRIPT.json', 'fixtures/connected-fixture151/WRITER-VIEW-EXPECTED.json', 'package-lock.json', 'package.json', 'src/identity/artifacts.ts', 'src/identity/domains.ts', 'src/runtime/claims-writing-gate.ts', 'src/runtime/connected-fixture105-data.ts', 'src/runtime/connected-fixture151-data.ts', 'src/runtime/connected-fixture105.ts', 'src/runtime/package.ts', 'src/runtime/performance-direction-fixture105.ts', 'src/runtime/performance-direction.ts', 'src/runtime/speech-texture.ts', 'test/integration/connected-fixture105.test.ts', 'test/support/p33-parity-runner.ts', 'test/unit/connected-fixture105.test.ts', 'tools/ci-validation/ci.py', 'tools/ci-validation/run-stage.sh', 'tools/ci-validation/test_ci.py', 'tsconfig.build.json', 'tsconfig.json', 'vitest.config.ts')
FIXTURE_RESOURCE_NAMES = ('SUCCESSOR-PROVENANCE.json', 'SUBSTANTIVE-SCRIPT.json', 'TEXTURE-SCRIPT.json', 'TEXTURE-CARRIER.json', 'TEXTURE-REWRITE.json', 'BRIEF.json', 'PACKAGE.json', 'ROSTER.json', 'TEMPLATE.json', 'WRITER-VIEW-EXPECTED.json', 'CONTEXT-EXPECTED.json', 'AUTHORED-NORMALIZED-ROWS.json', 'CEILING-EXPECTATIONS.json', 'FIVE-MATCH-INPUTS.json', 'DIRECTION-EXPECTED.json', 'IDENTITIES.json', 'SQL-COLUMN-MAP.json', 'SCHEMA-construction-observation.json', 'SCHEMA-operation.json', 'SCHEMA-audit.json')

# ---------------------------------------------------------------- subcommands

def load_event():
    path = os.environ.get('GITHUB_EVENT_PATH')
    if not path or not os.path.isabs(path):
        return {}
    return json.loads(read_bounded(path, 4 * 1024 * 1024))


def cmd_init():
    partition = partition_label(required=True)
    errors = []
    env = os.environ
    base = ci_dir()
    base.mkdir(mode=0o700)
    for name in ('evidence', 'tmp', 'home'):
        (base / name).mkdir(mode=0o700)
    ev = base / 'evidence'
    record = {'errors': errors, 'github': {k: env.get(k) for k in (
        'GITHUB_SHA', 'GITHUB_REF', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_EVENT_NAME', 'GITHUB_WORKFLOW_REF',
        'ImageVersion', 'ImageOS')}, 'runner_tracking_id_present': bool(env.get('RUNNER_TRACKING_ID'))}
    record['python'] = {'version': sys.version, 'executable': sys.executable, 'realpath': os.path.realpath(sys.executable),
                        'usr_bin_python3_realpath': os.path.realpath('/usr/bin/python3')}
    if os.path.realpath(sys.executable) != os.path.realpath('/usr/bin/python3'):
        errors.append('not running under /usr/bin/python3')
    record['platform'] = {'kernel': platform.release(), 'machine': platform.machine(), 'cpu_count': os.cpu_count()}
    try:
        cpuinfo = Path('/proc/cpuinfo').read_text()
        record['cpu'] = {'processors': len(re.findall(r'^processor\s*:', cpuinfo, re.M)),
                         'model': (re.findall(r'^model name\s*:\s*(.*)$', cpuinfo, re.M) or [''])[0]}
        meminfo = Path('/proc/meminfo').read_text()
        record['memory_kib'] = {k: int(re.search(r'^%s:\s+(\d+) kB' % k, meminfo, re.M).group(1))
                                for k in ('MemTotal', 'SwapTotal')}
        record['os_release'] = Path('/etc/os-release').read_text()[:1024]
        record['disk_bytes'] = {}
        for label, path in (('workspace', str(ROOT)), ('runner_temp', str(base))):
            info = os.statvfs(path)
            record['disk_bytes'][label] = {'total': info.f_blocks * info.f_frsize, 'available': info.f_bavail * info.f_frsize}
    except Exception as error:
        errors.append('resource record failed: ' + type(error).__name__)
    probes = {}
    node, npm = shutil.which('node'), shutil.which('npm')
    commands = {'timeout': ['/usr/bin/timeout', '--version'], 'unzip': ['unzip', '-v'],
                'git_status': ['git', '-C', str(ROOT), 'status', '--porcelain']}
    if node:
        commands['node'] = [node, '--version']
    if npm:
        commands['npm'] = [npm, '--version']
    for name, command in commands.items():
        try:
            code, out = probe(command)
            probes[name] = {'exit': code, 'output': out.splitlines()[:1] if name in ('timeout', 'unzip') else out.strip()}
            if code != 0:
                errors.append('probe %s exited %d' % (name, code))
        except Exception as error:
            probes[name] = {'error': type(error).__name__}
            errors.append('probe failed: ' + name)
    record['probes'] = probes
    if not node or probes.get('node', {}).get('output') != NODE_VERSION:
        errors.append('node is not %s' % NODE_VERSION)
    if not npm or probes.get('npm', {}).get('output') != NPM_VERSION:
        errors.append('npm is not %s' % NPM_VERSION)
    first_line = (probes.get('timeout', {}).get('output') or [''])[0]
    if not str(first_line).startswith('timeout (GNU coreutils)'):
        errors.append('timeout is not GNU coreutils')
    unzip_line = (probes.get('unzip', {}).get('output') or [''])[0]
    if not str(unzip_line).startswith('UnZip '):
        errors.append('unzip identity line is not UnZip')
    if probes.get('git_status', {}).get('output') != '':
        errors.append('checkout is not clean')
    write_json_x(ev / 'env.json', record)
    # Identity: PR head / target base / synthetic merge / tree / workflow, mapped without switching checkout semantics.
    identity_errors, identity = [], {}
    try:
        event = load_event()
        pr_head = ((event.get('pull_request') or {}).get('head') or {}).get('sha') if isinstance(event, dict) else None
        identity_errors, identity = check_identity(dict(env), event, collect_git(pr_head if isinstance(pr_head, str) and HEX40.fullmatch(pr_head) else None))
    except Exception as error:
        identity_errors.append('identity evaluation failed: %s' % type(error).__name__)
    identity['errors'] = identity_errors
    write_json_x(ev / 'identity.json', identity)
    errors.extend(identity_errors)
    # Source binding before anything runs: dist must not exist yet.
    bind = {'label': 'pre', 'errors': []}
    try:
        tracked = tracked_files()
        snap = take_snapshot(tracked, allow_dist=False)
        write_json_x(ev / 'snapshot-pre.json', snap)
        bind['errors'] = snapshot_errors(snap)
        bind['tracked_files'] = len(tracked)
        write_json_x(ev / 'partition.json', partition_binding(partition, identity, snap['members']))
    except Exception as error:
        bind['errors'].append('snapshot failed: %s' % type(error).__name__)
    bind['ok'] = not bind['errors']
    write_json_x(ev / 'bind-pre.json', bind)
    errors.extend(bind['errors'])
    if not errors:
        try:
            fixture_prepare(base, ROOT)
        except Exception as error:
            errors.append('fixture preparation failed: ' + type(error).__name__)
            write_json_x(ev / 'fixture105-init-failure.json', {'ok': False, 'error_class': type(error).__name__})
    print(json.dumps({'init': not errors, 'errors': errors[:8]}))
    return 0 if not errors else 1


def load_pre(ev):
    pre = load_json(ev / 'snapshot-pre.json', SNAPSHOT_LIMIT)
    if load_json(ev / 'bind-pre.json').get('ok') is not True:
        raise RuntimeError('pre-execution binding is not ok')
    return pre


def cmd_bind_build():
    ev = ci_dir() / 'evidence'
    record = {'label': 'build', 'errors': []}
    try:
        pre = load_pre(ev)
        tracked = tracked_files()
        if tracked != sorted(pre['members']):
            record['errors'].append('tracked file set changed after the pre-execution snapshot')
        snap = take_snapshot(tracked, allow_dist=True)
        record['errors'] += snapshot_errors(snap, pre=pre, require_dist=True)
        record['dist'] = snap['dist']
    except Exception as error:
        record['errors'].append('build binding failed: %s: %s' % (type(error).__name__, error))
    record['ok'] = not record['errors']
    write_json_x(ev / 'bind-build.json', record)
    print(json.dumps({'bind-build': record['ok'], 'dist': record.get('dist'), 'errors': record['errors'][:5]}))
    return 0 if record['ok'] else 1


def cmd_dbprobe():
    ev = ci_dir() / 'evidence'
    record = {'errors': [], 'probe_exit': None}
    try:
        url = os.environ.get('TEST_DATABASE_URL')
        record['target'] = validate_db_url(url)
        node = shutil.which('node')
        if not node:
            raise RuntimeError('node unavailable')
        child_env = {'PATH': os.environ.get('PATH', '/usr/bin:/bin'), 'HOME': str(ci_dir() / 'home'),
                     'TEST_DATABASE_URL': url}
        result = subprocess.run([node, '--input-type=module', '-e', NODE_PROBE], cwd=ROOT, env=child_env,
                                stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                timeout=30, check=False)
        code = result.returncode
        record['probe_exit'] = code if type(code) is int else None
        if type(code) is not int or code != 0:
            record['errors'].append('database probe process exit status is %r, want exactly 0' % (code,))
        else:
            last = result.stdout.decode('utf-8', errors='replace').strip().splitlines()[-1:]  # stderr is discarded unread
            row = json.loads(last[0]) if last else {}
            errors, info = interpret_db_probe(row)
            record['server'] = info
            record['errors'] += errors
    except ValueError as error:
        record['errors'].append(str(error) if str(error).startswith('TEST_DATABASE_URL') else 'database probe output unreadable')
    except Exception as error:
        record['errors'].append('database probe failed: ' + type(error).__name__)
    record['ok'] = not record['errors']
    write_json_x(ev / 'db-probe.json', record)
    print(json.dumps({'dbprobe': record['ok'], 'errors': record['errors'][:3]}))
    return 0 if record['ok'] else 1


def verdict_ok(path):
    try:
        return load_json(path).get('ok') is True
    except Exception:
        return False


def stage_verdict_ok(path, stage):
    try:
        record = load_json(path, JSON_LIMIT * 4)
        return (record.get('ok') is True and (partition_label() == 'all'
                or (record.get('stage') == stage and record.get('partition') == partition_label())))
    except Exception:
        return False


def collection_identity_ok(record):
    return (record.get('partition') == partition_label()
            and record.get('commit') == os.environ.get('GITHUB_SHA')
            and record.get('run_id') == os.environ.get('GITHUB_RUN_ID')
            and record.get('run_attempt') == os.environ.get('GITHUB_RUN_ATTEMPT'))


def controls_problems(upload):
    """The aggregate may start only after the controls evidence was collected completely (R1). Pure file inspection."""
    try:
        final = load_json(Path(upload) / 'final.json', JSON_LIMIT * 4)
    except Exception as error:
        return ['controls collection record unreadable (%s)' % type(error).__name__]
    if not isinstance(final, dict):
        return ['controls collection record is not an object']
    problems = []
    if partition_label() != 'all' and not collection_identity_ok(final):
        problems.append('controls collection partition/identity mismatch')
    if final.get('scope') != 'controls':
        problems.append('collection record is not for the controls scope')
    if final.get('all_stages_ok') is not True:
        problems.append('controls collection does not record all stages ok')
    if final.get('evidence_status') != 'complete':
        problems.append('controls evidence is not complete')
    if final.get('collection_problems') != {'missing': [], 'censored': [], 'errors': []}:
        problems.append('controls collection reported problems')
    if final.get('verdicts') != {'prerequisite': True, 'focused': True} or final.get('not_attempted') != []:
        problems.append('controls collection verdicts are not exactly prerequisite and focused ok')
    return problems


def cmd_precheck(stage):
    ev = ci_dir() / 'evidence'
    problems = []
    for name in ('bind-pre.json', 'bind-build.json', 'db-probe.json'):
        if not verdict_ok(ev / name):
            problems.append(name + ' missing or not ok')
    index = STAGES.index(stage)
    if index and not stage_verdict_ok(ev / ('verdict-%s.json' % STAGES[index - 1]), STAGES[index - 1]):
        problems.append('predecessor verdict missing or not ok')
    if (ev / stage).exists() or (ev / ('verdict-%s.json' % stage)).exists():
        problems.append('stage already attempted')
    if stage == 'all':
        problems += controls_problems(ci_dir() / 'upload-controls')
    print(json.dumps({'precheck': stage, 'ok': not problems, 'problems': problems}))
    return 0 if not problems else 1


def fixture046_runtime_receipt(value):
    """Closed fixture-specific operational evidence; no package/image bytes retained."""
    keys = {'schema', 'status', 'profile_sha256', 'artifact_lock_sha256', 'image_id',
            'identity_sha256', 'docker_cli', 'image_owned', 'containers', 'cleanup'}
    if (not isinstance(value, dict) or set(value) != keys
            or value['schema'] != 'fixture046-runtime-registration/1'
            or value['status'] != 'ready' or value['image_owned'] is not True
            or value['profile_sha256'] != '46705afa025f02bebf7248c78fed648408cf156ab791102d77c47287893e91a7'
            or value['artifact_lock_sha256'] != 'b15c3dd040f41e9a60c9dc127a38003a2fc9083808f1c4cb1ec20f07cfa16485'
            or value['docker_cli'] != '/usr/bin/docker'
            or value['cleanup'] != 'containers_removed_image_retained'
            or value['containers'] != ['desk-fixture046-signature-0', 'desk-fixture046-signature-1', 'desk-fixture046-runtime-prepare']
            or not isinstance(value['image_id'], str) or not re.fullmatch(r'sha256:[0-9a-f]{64}', value['image_id'])):
        raise RuntimeError('fixture046 runtime registration invalid')
    lock = load_json(ROOT / 'fixtures/frozen-master046-toolchain/artifact-lock.json', JSON_LIMIT * 4)
    expected = {'inventory': sorted(lock['installed_inventory'], key=lambda row: row['package']),
                'executables': lock['executables'], 'libraries': lock['libraries'], 'loader': lock['loader'],
                'version_capture_sha256': lock['version_capture_sha256'],
                'build_configuration_sha256': lock['build_configuration_sha256']}
    if value['identity_sha256'] != hashlib.sha256(json.dumps(expected, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest():
        raise RuntimeError('fixture046 identity mismatch')
    return value


def cmd_check(stage):
    base = ci_dir()
    ev = base / 'evidence'
    errors, facts, tracked = [], {}, []
    record = {'label': 'post-' + stage, 'partition': partition_label(), 'errors': []}
    try:
        pre = load_pre(ev)
        build = load_json(ev / 'bind-build.json')
        tracked = sorted(pre['members'])
        if build.get('ok') is not True or not isinstance(build.get('dist'), dict):
            record['errors'].append('build binding is not an ok record with a dist summary')
        now = tracked_files()
        if now != tracked:
            record['errors'].append('tracked file set changed')
        snap = take_snapshot(now, allow_dist=True)
        record['errors'] += snapshot_errors(snap, pre=pre, expect_dist=build.get('dist'))
        record['dist'] = snap['dist']
    except Exception as error:
        record['errors'].append('post-stage binding failed: %s: %s' % (type(error).__name__, error))
    record['ok'] = not record['errors']
    write_json_x(ev / ('bind-post-%s.json' % stage), record)
    try:
        stage_errors, facts = evaluate_stage(stage, ev / stage, find_runtime_dir(base / 'tmp'), tracked)
        errors.extend(stage_errors)
    except Exception as error:
        errors.append('evaluation exception: %s: %s' % (type(error).__name__, error))
    if stage == 'all' and partition_label() == 'rest':
        try:
            facts['fixture046_runtime'] = fixture046_runtime_receipt(load_json(ev / 'fixture046-runtime.json', JSON_LIMIT))
        except Exception as error:
            errors.append('fixture046 runtime evidence refused: ' + type(error).__name__)
    if not record['ok']:
        errors.append('post-stage source binding failed')
    try:
        facts['fixture105'] = fixture_capture_stage(base, stage, facts, not errors)
        if not facts['fixture105']['complete']:
            errors.append('fixture preservation/retention incomplete')
    except Exception as error:
        errors.append('fixture preservation/retention failed: ' + type(error).__name__)
    verdict = {'stage': stage, 'partition': partition_label(), 'ok': not errors, 'errors': errors, 'facts': facts}
    write_json_x(ev / ('verdict-%s.json' % stage), verdict)
    print(json.dumps({'check': stage, 'ok': verdict['ok'], 'errors': errors[:8]}))
    return 0 if verdict['ok'] else 1


# ---------------------------------------------------------------- retention

class Retention:
    """Copies whitelisted evidence into the upload directory and records everything that is not complete."""

    def __init__(self, upload, extra=()):
        self.upload = upload
        self.extra = tuple(extra)
        self.copied = {}
        self.problems = {'missing': [], 'censored': [], 'errors': []}

    def copy(self, src, rel, limit, *, required):
        label = str(rel)
        if rel in self.copied:
            return self.copied[rel]
        try:
            data, size = read_head(src, limit)
            if len(data) != min(size, limit):
                raise RuntimeError('short copy')
            data = redact(data, self.extra)
            dst = self.upload / rel
            os.makedirs(os.path.dirname(dst), mode=0o700, exist_ok=True)
            write_bytes_x(dst, data)
            if os.stat(dst).st_size != len(data):
                raise RuntimeError('copied length differs from expected')
            if size > limit:
                self.problems['censored'].append('%s: %d of %d bytes retained' % (label, min(size, limit), size))
            self.copied[rel] = True
            return True
        except FileNotFoundError:
            if required:
                self.problems['missing'].append(label)
            return False
        except Exception as error:
            self.problems['errors'].append('%s: %s: %s' % (label, type(error).__name__, error))
            return False


def expected_raw(stage, verdict):
    """Mandatory raw files for a successful stage: (attempt name, [(relative path under attempt, limit)])."""
    facts = verdict.get('facts') if isinstance(verdict, dict) else None
    attempt = facts.get('attempt') if isinstance(facts, dict) else None
    if not isinstance(attempt, str) or not attempt.startswith('attempt-') or '/' in attempt:
        return None, []
    files = [('prerequisite.json', JSON_LIMIT)]
    if stage != 'prerequisite':
        files.append(('guard-result.json', JSON_LIMIT))
        for case in facts.get('cases') or []:
            nonce = case.get('nonce') if isinstance(case, dict) else None
            if not isinstance(nonce, str) or not NONCE.fullmatch(nonce):
                return None, []
            files += [('%s/result.json' % nonce, JSON_LIMIT), ('%s/output.log' % nonce, CASE_OUTPUT_LIMIT)]
            if case.get('mode') == 'p33':
                files.append(('%s/completion.json' % nonce, JSON_LIMIT))
    return attempt, files


SCOPES = {'controls': STAGES[:2], 'full': STAGES}
COMMON_FILES = (('env.json', JSON_LIMIT * 4), ('identity.json', JSON_LIMIT), ('db-probe.json', JSON_LIMIT),
                ('snapshot-pre.json', SNAPSHOT_LIMIT), ('bind-pre.json', JSON_LIMIT), ('bind-build.json', JSON_LIMIT))


# Fixed synthetic-supply evidence only. No package/image payloads are retained.
FIXTURE046_RUNTIME = Path('/tmp/the-desk-fixture046-runtime')
FIXTURE046_SUPPLY_FILES = (
    'acquisition.json', 'base-inventory.tsv', 'inventory.tsv', 'executables.txt',
    'loader.txt', 'libraries.txt', 'library-paths.txt', 'ldd.txt', 'version.txt',
    'build.txt', 'audit.txt', 'install-identify.stdout', 'install-identify.stderr',
    'signature-0.stdout', 'signature-0.stderr', 'signature-1.stdout', 'signature-1.stderr',
    'base-inspect.stdout', 'base-inspect.stderr', 'prepare-state.stdout', 'prepare-state.stderr',
    'prepare-final.stdout', 'prepare-final.stderr', 'prepare-remove.stdout', 'prepare-remove.stderr',
    'commit.stdout', 'commit.stderr', 'commit-inspect.stdout', 'commit-inspect.stderr',
    'ownership.json',
)


def fixture046_keep_runtime(keep, evidence, scope):
    keep.copy(evidence / 'fixture046-runtime.json', Path('fixture046-runtime.json'), JSON_LIMIT, required=True)
    ready = False
    registration = None
    owner = None
    try:
        registration = load_json(evidence / 'fixture046-runtime.json', JSON_LIMIT)
        if registration.get('status') == 'ready':
            fixture046_runtime_receipt(registration)
            ready = True
    except Exception:
        pass
    if not ready:
        keep.problems['errors'].append('fixture046 preparation is not ready; retention is partial')
    for name in FIXTURE046_SUPPLY_FILES:
        keep.copy(FIXTURE046_RUNTIME / name, Path('fixture046-runtime') / name, JSON_LIMIT * 16, required=ready)
    if ready:
        try:
            owner = load_json(FIXTURE046_RUNTIME / 'ownership.json', JSON_LIMIT)
            if (owner['schema'] != 'fixture046-supply-owner/1' or owner['preparation'] != 'ready'
                    or owner['local'] is not False or owner['image_id'] != registration['image_id']
                    or not re.fullmatch(r'[0-9a-f]{32}', owner['token'])
                    or owner['image_handle'] != 'desk-fixture046-runtime:owned-' + owner['token']
                    or owner['image_reserved'] is not True or owner['client_uncertain'] is not False
                    or owner['command_pending'] is not False or owner['uncertain_command'] is not None
                    or [entry['name'] for entry in owner['containers']] != registration['containers']
                    or any(entry['removed'] is not True for entry in owner['containers'])):
                raise RuntimeError('supply ownership mismatch')
        except Exception:
            keep.problems['errors'].append('fixture046 ready ownership is not corroborated')
    if scope == 'full':
        keep.copy(FIXTURE046_RUNTIME / 'cleanup.json', Path('fixture046-runtime/cleanup.json'), JSON_LIMIT, required=ready)
        if ready:
            try:
                cleanup = load_json(FIXTURE046_RUNTIME / 'cleanup.json', JSON_LIMIT)
                if (cleanup.get('schema') != 'fixture046-supply-cleanup/1'
                        or cleanup.get('status') != 'complete' or cleanup.get('preparation') != 'ready'
                        or cleanup.get('image_id') != registration['image_id']
                        or cleanup.get('image_removed') is not True or cleanup.get('client_uncertain') is not False
                        or not isinstance(owner, dict) or owner['image_removed'] is not True or owner['cleanup'] != 'complete'):
                    raise RuntimeError('supply cleanup incomplete')
            except Exception:
                keep.problems['errors'].append('fixture046 runtime cleanup evidence is incomplete')


def cmd_collect(scope):
    stages = SCOPES[scope]
    base = ci_dir()
    upload = base / ('upload-' + scope)
    upload.mkdir(mode=0o700)
    ev = base / 'evidence'
    keep = Retention(upload, extra=[os.environ.get('TEST_DATABASE_URL') or ''])
    problems = keep.problems
    if partition_label() != 'all':
        try:
            check_partition_binding()
        except Exception as error:
            problems['errors'].append('partition binding: ' + type(error).__name__)
    for name, limit in COMMON_FILES:
        keep.copy(ev / name, Path(name), limit, required=True)
    if partition_label() == 'rest':
        fixture046_keep_runtime(keep, ev, scope)
    if partition_label() != 'all':
        keep.copy(ev / 'partition.json', Path('partition.json'), JSON_LIMIT, required=True)
    verdicts, successful, not_attempted = {}, {}, []
    for stage in stages:
        attempted = (ev / stage).exists() or (ev / ('verdict-%s.json' % stage)).exists()
        if not attempted:
            verdicts[stage] = None
            not_attempted.append(stage)
            continue
        keep.copy(ev / ('bind-post-%s.json' % stage), Path('bind-post-%s.json' % stage), JSON_LIMIT, required=True)
        keep.copy(ev / ('verdict-%s.json' % stage), Path('verdict-%s.json' % stage), JSON_LIMIT * 4, required=True)
        for name in STAGE_FILES:
            limit = COPY_LIMIT if name in ('stdout', 'stderr') else JSON_LIMIT
            keep.copy(ev / stage / name, Path('stages') / stage / name, limit, required=True)
        try:
            verdict = load_json(ev / ('verdict-%s.json' % stage), JSON_LIMIT * 4)
            verdicts[stage] = stage_verdict_ok(ev / ('verdict-%s.json' % stage), stage)
            if verdicts[stage]:
                successful[stage] = verdict
        except Exception:
            verdicts[stage] = None
    runtime = None
    try:
        runtime = find_runtime_dir(base / 'tmp')
    except Exception as error:
        if len(not_attempted) < len(stages):
            problems['errors'].append('runtime directory: ' + str(error))
    if runtime is not None:
        for stage, verdict in successful.items():
            attempt, files = expected_raw(stage, verdict)
            if attempt is None:
                problems['errors'].append('%s: verdict lacks a usable attempt/case identity' % stage)
                continue
            for rel, limit in files:
                keep.copy(runtime / attempt / rel, Path('attempts') / attempt / rel, limit, required=True)
        try:  # everything else that exists (fatal.json from failed or quarantined runs), best effort
            attempts = sorted(p for p in runtime.glob('attempt-*') if p.is_dir() and not p.is_symlink())
            if len(attempts) > 16:
                problems['errors'].append('more than 16 attempt directories; extras not examined')
            for attempt in attempts[:16]:
                for name in ('prerequisite.json', 'guard-result.json', 'fatal.json'):
                    keep.copy(attempt / name, Path('attempts') / attempt.name / name, JSON_LIMIT, required=False)
                cases = sorted(p for p in attempt.iterdir() if p.is_dir() and NONCE.fullmatch(p.name))
                if len(cases) > 8:
                    problems['errors'].append('%s: more than 8 case directories; extras not examined' % attempt.name)
                for case in cases[:8]:
                    for name in ('result.json', 'output.log', 'completion.json', 'fatal.json'):
                        limit = CASE_OUTPUT_LIMIT if name == 'output.log' else JSON_LIMIT
                        keep.copy(case / name, Path('attempts') / attempt.name / case.name / name, limit, required=False)
        except Exception as error:
            problems['errors'].append('attempt collection: %s: %s' % (type(error).__name__, error))
    fixture_collect(base, keep, scope, successful)
    warnings = []
    for stage, verdict in successful.items():
        warnings += ['%s: %s' % (stage, w) for w in (verdict.get('facts') or {}).get('warnings', [])]
    all_ok = all(v is True for v in verdicts.values())
    complete = all_ok and not any(problems.values())
    final = {'scope': scope, 'partition': partition_label(), 'commit': os.environ.get('GITHUB_SHA'), 'run_id': os.environ.get('GITHUB_RUN_ID'),
             'run_attempt': os.environ.get('GITHUB_RUN_ATTEMPT'), 'verdicts': verdicts, 'not_attempted': not_attempted,
             'all_stages_ok': all_ok, 'collection_problems': problems, 'supplemental_warnings': warnings,
             'retention_limits_bytes': {'stdout_stderr': COPY_LIMIT, 'json': JSON_LIMIT, 'case_output': CASE_OUTPUT_LIMIT,
                                        'execution_file_cap': CAP},
             'evidence_status': 'complete' if complete else 'partial/censored',
             'note': 'Acceptance also requires successful artifact upload; this record is written before upload. '
                     'Streams above the retention limit are censored even when below the execution cap.'}
    write_json_x(upload / 'final.json', final)
    print(json.dumps({'collect': scope, 'all_stages_ok': all_ok, 'evidence_status': final['evidence_status']}))
    return 0


FINAL_OUTCOMES = ('CONTROLS_UPLOAD_OUTCOME', 'UPLOAD_OUTCOME', 'AUDIT_OUTCOME', 'GITLEAKS_OUTCOME', 'SECURITY_UPLOAD_OUTCOME')


def security_report_findings(data):
    value = json.loads(data)
    if (not isinstance(value, dict) or value.get('version') != '2.1.0'
            or not isinstance(value.get('runs'), list) or len(value['runs']) != 1):
        raise RuntimeError('unexpected security report schema')
    run = value['runs'][0]
    if (not isinstance(run, dict) or not isinstance(run.get('tool'), dict)
            or not isinstance(run['tool'].get('driver'), dict) or run['tool']['driver'].get('name') != 'gitleaks'
            or not isinstance(run.get('results'), list) or any(not isinstance(row, dict) for row in run['results'])):
        raise RuntimeError('unexpected security report run')
    return len(run['results'])


def retain_security_report(base, root, binding, pre, outcome):
    """Move only the pinned action's generated report, never exempt it from source integrity."""
    if outcome not in ('success', 'failure') or 'results.sarif' in pre['members']:
        raise RuntimeError('security report ownership/outcome mismatch')
    source = root / 'results.sarif'
    data = fixture_read(source, COPY_LIMIT, False)
    before = os.lstat(source)
    findings = security_report_findings(data)
    destination = base / 'security-report'
    destination.mkdir(mode=0o700)  # Exclusive private directory; never overwrite a prior capture.
    retained = destination / 'results.sarif'
    os.rename(source, retained)
    after = os.lstat(retained)
    if ((before.st_dev, before.st_ino) != (after.st_dev, after.st_ino)
            or fixture_read(retained, COPY_LIMIT, False) != data or os.path.lexists(source)):
        raise RuntimeError('security report changed during retention')
    record = {'schema': 'ci-security-report/1', 'binding': binding, 'outcome': outcome,
              'findings': findings, 'bytes': len(data), 'sha256': fixture_hash(data)}
    fixture_write(destination / 'manifest.json', record)
    return record


def verify_security_report(base, binding):
    directory = base / 'security-report'
    fixture_identity(directory)
    if sorted(os.listdir(directory)) != ['manifest.json', 'results.sarif']:
        raise RuntimeError('security report population mismatch')
    record = json.loads(fixture_read(directory / 'manifest.json', JSON_LIMIT))
    data = fixture_read(directory / 'results.sarif', COPY_LIMIT, False)
    expected = {'schema': 'ci-security-report/1', 'binding': binding, 'outcome': 'success',
                'findings': 0, 'bytes': len(data), 'sha256': fixture_hash(data)}
    if record != expected or security_report_findings(data) != 0:
        raise RuntimeError('security report is not an unchanged successful scan')


def cmd_retain_security():
    binding = check_partition_binding()
    record = retain_security_report(ci_dir(), ROOT, binding, load_pre(ci_dir() / 'evidence'),
                                    os.environ.get('GITLEAKS_OUTCOME'))
    print(json.dumps({'security_report_retained': True, 'bytes': record['bytes'], 'sha256': record['sha256']}))
    return 0


def final_verdict(finals, outcomes):
    """Pure final gate. finals: {scope: final.json dict or None}; outcomes: {name: step outcome string or None}."""
    reasons = []
    for scope in SCOPES:
        record = finals.get(scope)
        if not isinstance(record, dict):
            reasons.append('%s final.json unreadable' % scope)
        elif record.get('all_stages_ok') is not True or record.get('evidence_status') != 'complete':
            reasons.append('%s evidence is not complete and all-ok' % scope)
    for name in FINAL_OUTCOMES:
        if outcomes.get(name) != 'success':
            reasons.append('%s is %r' % (name, outcomes.get(name)))
    return reasons


def proof_identity_now(allow_dist):
    event = load_event()
    head = ((event.get('pull_request') or {}).get('head') or {}).get('sha')
    errors, identity = check_identity(dict(os.environ), event, collect_git(head if isinstance(head, str) and HEX40.fullmatch(head) else None))
    tracked = tracked_files()
    snapshot = take_snapshot(tracked, allow_dist=allow_dist)
    errors += snapshot_errors(snapshot)
    if errors:
        raise RuntimeError('joint/proof source identity failed: ' + '; '.join(errors[:3]))
    return identity, snapshot['members']


def build_partition_proof(binding, verdict):
    if (binding.get('schema') != 'ci-partition/1' or binding.get('partition') not in PARTITION_COUNTS
            or verdict.get('ok') is not True or verdict.get('partition') != binding['partition']
            or verdict.get('stage') != 'all'):
        raise RuntimeError('invalid partition verdict')
    facts = verdict.get('facts', {})
    rows = facts.get('file_results', {})
    if set(rows) != set(binding['selection']) or facts.get('selected_files') != binding['selection']:
        raise RuntimeError('partition file evidence mismatch')
    counts = {}
    for path in binding['selection']:
        results = rows[path]
        if (not isinstance(results, list) or len(results) != 1 or set(results[0]) != {'tests', 'failed', 'skipped', 'todo'}
                or type(results[0]['tests']) is not int or results[0]['tests'] <= 0
                or any(type(results[0][key]) is not int or results[0][key] != 0 for key in ('failed', 'skipped', 'todo'))):
            raise RuntimeError('partition file did not pass completely')
        counts[path] = results[0]['tests']
    files, tests, integrations = PARTITION_COUNTS[binding['partition']]
    if len(counts) != files or sum(counts.values()) != tests:
        raise RuntimeError('partition proof count mismatch')
    return {'schema': 'ci-partition-proof/1', 'partition': binding['partition'], 'identity': binding['identity'],
            'files': counts, 'totals': [files, tests, integrations], 'source_verified': True, 'evidence_complete': True}


def parse_partition_proof(raw):
    if not isinstance(raw, str) or not raw or len(raw.encode('utf-8')) > JSON_LIMIT or '\n' in raw or '\r' in raw:
        raise RuntimeError('partition proof missing or exceeds bound')
    def unique(pairs):
        obj = {}
        for key, value in pairs:
            if key in obj:
                raise RuntimeError('duplicate proof key')
            obj[key] = value
        return obj
    value = json.loads(raw, object_pairs_hook=unique, parse_constant=lambda _: (_ for _ in ()).throw(RuntimeError('nonfinite proof')))
    if not isinstance(value, dict):
        raise RuntimeError('proof must be an object')
    validate_proof_shape(value)
    if raw != fixture_bytes(value).decode().rstrip('\n'):
        raise RuntimeError('noncanonical proof encoding')
    return value


def validate_proof_shape(value):
    if (set(value) != {'schema', 'partition', 'identity', 'files', 'totals', 'source_verified', 'evidence_complete'}
            or value['schema'] != 'ci-partition-proof/1' or value['partition'] not in PARTITION_COUNTS
            or value['source_verified'] is not True or value['evidence_complete'] is not True):
        raise RuntimeError('proof shape or assertions invalid')
    identity = value['identity']
    if not isinstance(identity, dict) or set(identity) != {'checkout', 'head', 'tree', 'repository', 'run_id', 'run_attempt', 'source_sha256'}:
        raise RuntimeError('proof identity shape invalid')
    for key in ('checkout', 'tree'):
        if not isinstance(identity[key], str) or not HEX40.fullmatch(identity[key]):
            raise RuntimeError('invalid proof commit/tree')
    if identity['head'] is not None and (not isinstance(identity['head'], str) or not HEX40.fullmatch(identity['head'])):
        raise RuntimeError('invalid proof head')
    if not isinstance(identity['source_sha256'], str) or not SHA256.fullmatch(identity['source_sha256']):
        raise RuntimeError('invalid source digest')
    if not isinstance(identity['repository'], str) or not REPO_NAME.fullmatch(identity['repository']):
        raise RuntimeError('invalid proof repository')
    for key in ('run_id', 'run_attempt'):
        if not isinstance(identity[key], str) or not re.fullmatch(r'[1-9][0-9]{0,19}', identity[key]):
            raise RuntimeError('invalid proof run identity')
    files = value['files']
    if not isinstance(files, dict) or not 1 <= len(files) <= EXPECTED_ALL_FILES:
        raise RuntimeError('proof file count bound')
    for path, count in files.items():
        if (not isinstance(path, str) or len(path) > 512 or not re.fullmatch(r'test/[A-Za-z0-9_./-]+\.test\.ts', path)
                or '..' in path.split('/') or type(count) is not int or not 1 <= count <= EXPECTED_ALL_TESTS):
            raise RuntimeError('proof file/count shape')
    if not isinstance(value['totals'], list) or len(value['totals']) != 3 or any(type(n) is not int or not 0 <= n <= EXPECTED_ALL_TESTS for n in value['totals']):
        raise RuntimeError('proof total shape')


def joint_problems(proofs, expected_identity, tracked, outcomes):
    errors = []
    if set(outcomes) != {'writer', 'rest', 'container'} or any(value != 'success' for value in outcomes.values()):
        errors.append('every required job must succeed')
    if set(proofs) != {'writer', 'rest'}:
        return errors + ['both distinct proofs are required']
    union = {}
    for label in ('writer', 'rest'):
        proof = proofs[label]
        try:
            validate_proof_shape(proof)
        except (RuntimeError, TypeError, KeyError):
            errors.append(label + ' malformed proof')
            continue
        if (not isinstance(proof, dict) or set(proof) != {'schema', 'partition', 'identity', 'files', 'totals', 'source_verified', 'evidence_complete'}
                or proof['schema'] != 'ci-partition-proof/1' or proof['partition'] != label
                or proof['identity'] != expected_identity or proof['source_verified'] is not True
                or proof['evidence_complete'] is not True):
            errors.append(label + ' proof identity/shape mismatch')
            continue
        expected = partition_files(tracked, label)
        counts = proof['files']
        if (not isinstance(counts, dict) or set(counts) != set(expected)
                or any(type(n) is not int or n <= 0 for n in counts.values())
                or not isinstance(proof['totals'], list) or any(type(n) is not int for n in proof['totals'])
                or proof['totals'] != list(PARTITION_COUNTS[label])
                or sum(counts.values()) != PARTITION_COUNTS[label][1]
                or len([p for p in counts if p.startswith(INTEGRATION_PREFIX)]) != PARTITION_COUNTS[label][2]):
            errors.append(label + ' selection/count mismatch')
            continue
        if label == 'rest' and any(counts.get(path) != n for path, n in FIXTURE_CONNECTED_COUNTS.items()):
            errors.append('rest connected coverage mismatch')
        if label == 'rest' and any(counts.get(path) != n for path, n in FROZEN_RENDER046_COUNTS.items()):
            errors.append('rest frozen-render046 coverage mismatch')
        if set(union) & set(counts):
            errors.append('partition overlap')
        union.update(counts)
    if set(union) != set(partition_files(tracked, 'all')) or sum(union.values()) != EXPECTED_ALL_TESTS:
        errors.append('partition union mismatch')
    return errors


def cmd_joint():
    try:
        identity, members = proof_identity_now(False)
        proofs = {label: parse_partition_proof(os.environ.get(label.upper() + '_PROOF')) for label in ('writer', 'rest')}
        outcomes = {label: os.environ.get(label.upper() + '_OUTCOME') for label in ('writer', 'rest', 'container')}
        errors = joint_problems(proofs, partition_identity(identity, members), sorted(members), outcomes)
    except Exception as error:
        errors = ['joint validation failed: ' + type(error).__name__ + ': ' + str(error)[:300]]
    print(json.dumps({'joint': 'HOLD' if errors else 'ACCEPT-CANDIDATE', 'errors': errors}))
    return 1 if errors else 0


def cmd_final():
    finals = {}
    for scope in SCOPES:
        try:
            finals[scope] = load_json(ci_dir() / ('upload-' + scope) / 'final.json')
        except Exception:
            finals[scope] = None
    reasons = final_verdict(finals, {name: os.environ.get(name) for name in FINAL_OUTCOMES})
    if partition_label() == 'rest' and os.environ.get('FIXTURE046_CLEANUP_OUTCOME') != 'success':
        reasons.append('fixture046 runtime cleanup did not succeed')
    if not reasons and partition_label() != 'all':
        try:
            binding = check_partition_binding()
            verify_security_report(ci_dir(), binding)
            identity, members = proof_identity_now(True)
            if partition_binding(binding['partition'], identity, members) != binding:
                raise RuntimeError('source changed before final proof')
            for record in finals.values():
                if (record.get('partition') != binding['partition'] or record.get('commit') != binding['identity']['checkout']
                        or record.get('run_id') != binding['identity']['run_id'] or record.get('run_attempt') != binding['identity']['run_attempt']):
                    raise RuntimeError('final record partition/identity mismatch')
            verdict = load_json(ci_dir() / 'evidence/verdict-all.json', JSON_LIMIT * 4)
            proof = build_partition_proof(binding, verdict)
            encoded = fixture_bytes(proof).decode().rstrip('\n')
            parse_partition_proof(encoded)
            output = os.environ.get('GITHUB_OUTPUT')
            if not output or not os.path.isabs(output):
                raise RuntimeError('missing GitHub output destination')
            with open(output, 'a', encoding='utf-8') as stream:
                stream.write('proof=' + encoded + '\n')
        except Exception as error:
            reasons.append('partition proof refused: ' + type(error).__name__ + ': ' + str(error)[:200])
    print(json.dumps({'final': 'HOLD' if reasons else 'ACCEPT-CANDIDATE', 'reasons': reasons}))
    return 1 if reasons else 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('init')
    sub.add_parser('bind-build')
    sub.add_parser('dbprobe')
    p = sub.add_parser('precheck')
    p.add_argument('stage', choices=STAGES)
    c = sub.add_parser('check')
    c.add_argument('stage', choices=STAGES)
    k = sub.add_parser('collect')
    k.add_argument('--scope', choices=sorted(SCOPES), required=True)
    f = sub.add_parser('fixture-binding')
    f.add_argument('stage', choices=STAGES)
    sub.add_parser('final')
    sub.add_parser('joint')
    sub.add_parser('retain-security')
    args = parser.parse_args(argv)
    if args.command == 'joint':
        return cmd_joint()
    if args.command not in ('init', 'collect'):
        check_partition_binding()
    if args.command == 'retain-security':
        return cmd_retain_security()
    if args.command == 'fixture-binding':
        return cmd_fixture_binding(args.stage)
    if args.command == 'init':
        return cmd_init()
    if args.command == 'bind-build':
        return cmd_bind_build()
    if args.command == 'dbprobe':
        return cmd_dbprobe()
    if args.command == 'precheck':
        return cmd_precheck(args.stage)
    if args.command == 'check':
        return cmd_check(args.stage)
    if args.command == 'collect':
        return cmd_collect(args.scope)
    return cmd_final()


if __name__ == '__main__':
    raise SystemExit(main())
