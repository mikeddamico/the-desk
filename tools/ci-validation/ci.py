#!/usr/bin/python3
"""Fixed capture/validation tool for the amended foundation-ci workflow (stages: prerequisite, focused, all).

PROPOSED, NOT YET REVIEWED OR RUN. Standard library only. It never starts the P33 guard, Vitest, a database
client other than the fixed read-only probe below, or any native extraction. No arbitrary command, path, profile or
stage input is accepted. Subcommands: init, bind-build, dbprobe, precheck, check, collect, final.
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
EXPECTED_TEST_FILES = 75          # tracked *.test.ts files under test/
EXPECTED_ALL_FILES = 74           # 75 minus the focused harness the `all` profile excludes
EXPECTED_ALL_TESTS = 8443
EXPECTED_INTEGRATION_FILES = 27
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
            if row['failed'] or row['skipped'] or row['todo'] or row['tests'] < 1:
                errors.append('%s reported failed/skipped/todo or no tests: %r' % (name, row))
    unexpected = sorted(set(seen) - set(selected))
    if unexpected:
        errors.append('result lines for files outside the selection: %s' % unexpected[:5])
    if total != EXPECTED_ALL_TESTS:
        errors.append('per-file test counts sum to %d, want %d' % (total, EXPECTED_ALL_TESTS))
    facts['per_file_total'] = total
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
    modes = ['complete', 'noncomplete'] if stage == 'focused' else ['p33']
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





# ---------------------------------------------------------------- subcommands

def load_event():
    path = os.environ.get('GITHUB_EVENT_PATH')
    if not path or not os.path.isabs(path):
        return {}
    return json.loads(read_bounded(path, 4 * 1024 * 1024))


def cmd_init():
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
    except Exception as error:
        bind['errors'].append('snapshot failed: %s' % type(error).__name__)
    bind['ok'] = not bind['errors']
    write_json_x(ev / 'bind-pre.json', bind)
    errors.extend(bind['errors'])
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


def controls_problems(upload):
    """The aggregate may start only after the controls evidence was collected completely (R1). Pure file inspection."""
    try:
        final = load_json(Path(upload) / 'final.json', JSON_LIMIT * 4)
    except Exception as error:
        return ['controls collection record unreadable (%s)' % type(error).__name__]
    if not isinstance(final, dict):
        return ['controls collection record is not an object']
    problems = []
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
    if index and not verdict_ok(ev / ('verdict-%s.json' % STAGES[index - 1])):
        problems.append('predecessor verdict missing or not ok')
    if (ev / stage).exists() or (ev / ('verdict-%s.json' % stage)).exists():
        problems.append('stage already attempted')
    if stage == 'all':
        problems += controls_problems(ci_dir() / 'upload-controls')
    print(json.dumps({'precheck': stage, 'ok': not problems, 'problems': problems}))
    return 0 if not problems else 1


def cmd_check(stage):
    base = ci_dir()
    ev = base / 'evidence'
    errors, facts, tracked = [], {}, []
    record = {'label': 'post-' + stage, 'errors': []}
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
    if not record['ok']:
        errors.append('post-stage source binding failed')
    verdict = {'stage': stage, 'ok': not errors, 'errors': errors, 'facts': facts}
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


def cmd_collect(scope):
    stages = SCOPES[scope]
    base = ci_dir()
    upload = base / ('upload-' + scope)
    upload.mkdir(mode=0o700)
    ev = base / 'evidence'
    keep = Retention(upload, extra=[os.environ.get('TEST_DATABASE_URL') or ''])
    problems = keep.problems
    for name, limit in COMMON_FILES:
        keep.copy(ev / name, Path(name), limit, required=True)
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
            verdicts[stage] = verdict.get('ok') is True
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
    warnings = []
    for stage, verdict in successful.items():
        warnings += ['%s: %s' % (stage, w) for w in (verdict.get('facts') or {}).get('warnings', [])]
    all_ok = all(v is True for v in verdicts.values())
    complete = all_ok and not any(problems.values())
    final = {'scope': scope, 'commit': os.environ.get('GITHUB_SHA'), 'run_id': os.environ.get('GITHUB_RUN_ID'),
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


FINAL_OUTCOMES = ('CONTROLS_UPLOAD_OUTCOME', 'UPLOAD_OUTCOME', 'AUDIT_OUTCOME', 'GITLEAKS_OUTCOME')


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


def cmd_final():
    finals = {}
    for scope in SCOPES:
        try:
            finals[scope] = load_json(ci_dir() / ('upload-' + scope) / 'final.json')
        except Exception:
            finals[scope] = None
    reasons = final_verdict(finals, {name: os.environ.get(name) for name in FINAL_OUTCOMES})
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
    sub.add_parser('final')
    args = parser.parse_args(argv)
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
