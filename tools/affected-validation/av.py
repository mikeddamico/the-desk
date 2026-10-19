#!/usr/bin/python3
"""Fixed evidence tool for the PR28 affected-validation workflow (affected-validation-001).

PROPOSED, NOT YET REVIEWED OR RUN. Standard library only. It never starts the P33 guard, Vitest or any
native extraction; the only subprocesses are fixed version/identity probes. No arbitrary command, path,
profile or stage input is accepted. Subcommands: init, bind, precheck, check, collect, final.

Hosted-only evidence lives outside the checkout under $RUNNER_TEMP/av. Every record is created exclusively.

Retention limits (deliberately stricter than execution): run-stage.sh lets a stage write up to 64 MiB per
file, but collect() retains at most COPY_LIMIT = 8 MiB of each stdout/stderr and JSON_LIMIT of each JSON
record. A larger file is copied only as a head and is recorded as censored, so the evidence bundle is
labeled partial/censored and cannot be accepted. A stream below 64 MiB is therefore NOT necessarily fully
retained.
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

RUN_ID = 'affected-validation-001'
BRANCH = 'diagnostic/pr28-affected-validation-001'
BASE = 'f64ec8e0bc1b292d914afbf62d09c6e1a98864ba'
STAGES = ('prerequisite', 'focused', 'p33', 'parity')
NODE_VERSION = 'v24.21.0'
NPM_VERSION = '11.19.0'
CAP = 64 * 1024 * 1024  # 67,108,864 bytes: per-file ceiling set by run-stage.sh (ulimit -f 65536 KiB)
JSON_LIMIT = 65536
COPY_LIMIT = 8 * 1024 * 1024
CASE_OUTPUT_LIMIT = 65536
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MANIFEST_REL = 'tools/affected-validation/manifest.json'
WORKFLOW_REL = '.github/workflows/affected-validation.yml'
NONCE = re.compile(r'[0-9a-f]{48}')
SHA256 = re.compile(r'[0-9a-f]{64}')
ANSI = re.compile(r'\x1b\[[0-9;?]*[ -/]*[@-~]')
FAILURE_LINE = re.compile(r'^\s*(FAIL\b|Unhandled\b|Errors\s{2,}|Leaks\s{2,}|Type Errors\s{2,})', re.M)
FATAL_TEXT = ('Traceback (most recent call last)', 'P33 FATAL', 'quarantined')
STAGE_FILES = ('stdout', 'stderr', 'exit', 'limits.txt', 'ps-pre.txt', 'ps-post.txt', 'snapshot-status.txt',
               'started-utc', 'ended-utc', 'pre-attempts', 'post-attempts')
EXPECTED_COUNTS = {
    'focused': ({'passed': 1, 'total': 1}, {'passed': 2, 'total': 2}),
    'p33': ({'passed': 1, 'total': 1}, {'passed': 1, 'skipped': 431, 'total': 432}),
    'parity': ({'passed': 1, 'total': 1}, {'passed': 432, 'total': 432}),
}
LIMITS_TEXT = 'core 0 0\nfsize %d %d\n' % (CAP, CAP)
# Keys emitted by the unchanged supervisor (guard-result.json and each case result.json).
SETTLEMENT_KEYS = ('settled', 'directReaped', 'noChildren', 'complete', 'reaped', 'residual', 'errors',
                   'discoveryDetails', 'cleanupErrors')
GUARD_KEYS = SETTLEMENT_KEYS + ('fatal', 'containedRejection')
CASE_KEYS = SETTLEMENT_KEYS + ('protocol', 'nonce', 'mode', 'outcome', 'reason', 'controls', 'childStarted')
REAPED_KEYS = {'pid', 'raw', 'exit'}


def manifest_path():
    return ROOT / MANIFEST_REL


def workflow_path():
    return ROOT / WORKFLOW_REL


def av_dir():
    temp = os.environ.get('RUNNER_TEMP')
    if not temp or not os.path.isabs(temp):
        raise RuntimeError('RUNNER_TEMP must be an absolute path')
    return Path(temp) / 'av'


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


# ---------------------------------------------------------------- source binding

def tree_files():
    found = set()

    def refuse(error):
        raise error

    root = str(ROOT)
    for current, dirs, files in os.walk(root, followlinks=False, onerror=refuse):
        if current == root:
            dirs[:] = [d for d in dirs if d not in ('.git', 'node_modules')]
        for name in list(dirs):
            full = os.path.join(current, name)
            if os.path.islink(full):
                found.add(os.path.relpath(full, root).replace(os.sep, '/'))
        for name in files:
            found.add(os.path.relpath(os.path.join(current, name), root).replace(os.sep, '/'))
        if len(found) > 5000:
            raise RuntimeError('tree file bound')
    return found


def bind(manifest_sha256, expected_workflow_sha256=None):
    """Bind the tree to the manifest whose sha256 was supplied on the command line.

    A manifest whose digest differs is never parsed and no member-selected path is read. The workflow file is
    excluded from the manifest (it carries the manifest digest, so including it would be a self-hash cycle); its
    digest is recorded here and, after the first (pre-execution) binding, every later binding must observe
    the same digest via expected_workflow_sha256. The initial workflow bytes remain bound externally by the
    commit that publishes them.
    """
    errors = []
    record = {'ok': False, 'errors': errors, 'members_checked': 0, 'extra': [], 'missing': []}
    deadline = time.monotonic() + 30
    try:
        raw = read_bounded(manifest_path(), 262144)
        record['manifest_sha256_observed'] = hashlib.sha256(raw).hexdigest()
        if record['manifest_sha256_observed'] != manifest_sha256:
            errors.append('manifest sha256 mismatch: manifest not trusted, no member read')
            return record
        manifest = json.loads(raw)
        if manifest.get('protocol') != RUN_ID:
            errors.append('manifest protocol mismatch')
        if manifest.get('base_head') != BASE:
            errors.append('manifest base_head mismatch')
        members = manifest['files']
        for name, item in sorted(members.items()):
            if time.monotonic() >= deadline:
                errors.append('binding time bound')
                break
            try:
                data = read_bounded(ROOT / name, item['bytes'])
                if len(data) != item['bytes'] or hashlib.sha256(data).hexdigest() != item['sha256']:
                    errors.append('binding mismatch: ' + name)
            except (OSError, RuntimeError) as error:
                errors.append('binding unreadable: %s (%s)' % (name, type(error).__name__))
            record['members_checked'] += 1
        expected = set(members) | {MANIFEST_REL, WORKFLOW_REL}
        present = tree_files()
        record['extra'] = sorted(present - expected)
        record['missing'] = sorted(expected - present)
        if record['extra'] or record['missing']:
            errors.append('tree file set differs from manifest plus manifest/workflow')
    except Exception as error:  # fail closed, never raise past the record
        errors.append('bind exception: %s: %s' % (type(error).__name__, error))
    try:
        observed = hashlib.sha256(read_bounded(workflow_path(), 65536)).hexdigest()
        record['workflow_sha256_observed'] = observed
        if expected_workflow_sha256 is not None and observed != expected_workflow_sha256:
            errors.append('workflow digest drifted from the pre-execution binding')
    except Exception as error:
        errors.append('workflow unreadable: ' + type(error).__name__)
    record['ok'] = not errors
    return record


# ---------------------------------------------------------------- evidence evaluation

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


def evaluate_stage(stage, stage_dir, runtime_dir):
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

def cmd_init():
    errors = []
    env = os.environ
    for key, want in (('GITHUB_ACTIONS', 'true'), ('GITHUB_RUN_ATTEMPT', '1'), ('GITHUB_REF_NAME', BRANCH),
                      ('GITHUB_EVENT_NAME', 'push'), ('RUNNER_OS', 'Linux')):
        if env.get(key) != want:
            errors.append('%s is %r, want %r' % (key, env.get(key), want))
    base = av_dir()
    base.mkdir(mode=0o700)
    for name in ('evidence', 'tmp', 'home'):
        (base / name).mkdir(mode=0o700)
    record = {'run_id': RUN_ID, 'branch': BRANCH, 'base_head': BASE, 'errors': errors}
    record['github'] = {k: env.get(k) for k in ('GITHUB_SHA', 'GITHUB_REF_NAME', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT',
                                                 'GITHUB_EVENT_NAME', 'GITHUB_WORKFLOW_SHA', 'ImageVersion', 'ImageOS')}
    record['runner_tracking_id_present'] = bool(env.get('RUNNER_TRACKING_ID'))
    record['python'] = {'version': sys.version, 'executable': sys.executable,
                        'realpath': os.path.realpath(sys.executable),
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
                'git_head': ['git', '-C', str(ROOT), 'rev-parse', 'HEAD'],
                'git_parent': ['git', '-C', str(ROOT), 'rev-parse', 'HEAD^'],
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
    if probes.get('git_parent', {}).get('output') != BASE:
        errors.append('HEAD^ is not the pinned base')
    if probes.get('git_head', {}).get('output') != env.get('GITHUB_SHA'):
        errors.append('HEAD is not GITHUB_SHA')
    if probes.get('git_status', {}).get('output') != '':
        errors.append('checkout is not clean')
    write_json_x(base / 'evidence' / 'env.json', record)
    print(json.dumps({'init': not errors, 'errors': errors}))
    return 0 if not errors else 1


def cmd_bind_pre(manifest_sha256):
    record = bind(manifest_sha256)
    record['label'] = 'pre'
    write_json_x(av_dir() / 'evidence' / 'bind-pre.json', record)
    print(json.dumps({'bind': 'pre', 'ok': record['ok'], 'errors': record['errors'][:5]}))
    return 0 if record['ok'] else 1


def verdict_ok(path):
    try:
        return load_json(path).get('ok') is True
    except Exception:
        return False


def cmd_precheck(stage):
    ev = av_dir() / 'evidence'
    problems = []
    if not verdict_ok(ev / 'bind-pre.json'):
        problems.append('bind-pre.json missing or not ok')
    index = STAGES.index(stage)
    if index and not verdict_ok(ev / ('verdict-%s.json' % STAGES[index - 1])):
        problems.append('predecessor verdict missing or not ok')
    if (ev / stage).exists() or (ev / ('verdict-%s.json' % stage)).exists():
        problems.append('stage already attempted')
    print(json.dumps({'precheck': stage, 'ok': not problems, 'problems': problems}))
    return 0 if not problems else 1


def cmd_check(stage, manifest_sha256):
    base = av_dir()
    ev = base / 'evidence'
    errors, facts = [], {}
    expected_workflow = 'unavailable'
    try:
        pre = load_json(ev / 'bind-pre.json')
        if pre.get('ok') is not True or pre.get('manifest_sha256_observed') != manifest_sha256:
            errors.append('pre-execution binding is not an ok record for this manifest digest')
        elif isinstance(pre.get('workflow_sha256_observed'), str) and SHA256.fullmatch(pre['workflow_sha256_observed']):
            expected_workflow = pre['workflow_sha256_observed']
        else:
            errors.append('pre-execution workflow digest unavailable')
    except Exception as error:
        errors.append('bind-pre.json unreadable (%s)' % type(error).__name__)
    record = bind(manifest_sha256, expected_workflow)
    record['label'] = 'post-' + stage
    write_json_x(ev / ('bind-post-%s.json' % stage), record)
    try:
        stage_errors, facts = evaluate_stage(stage, ev / stage, find_runtime_dir(base / 'tmp'))
        errors.extend(stage_errors)
    except Exception as error:
        errors.append('evaluation exception: %s: %s' % (type(error).__name__, error))
    if not record['ok']:
        errors.append('post-stage source binding failed')
    verdict = {'stage': stage, 'ok': not errors, 'errors': errors, 'facts': facts}
    write_json_x(ev / ('verdict-%s.json' % stage), verdict)
    print(json.dumps({'check': stage, 'ok': verdict['ok'], 'errors': errors[:8]}))
    return 0 if verdict['ok'] else 1


class Retention:
    """Copies whitelisted evidence into the upload directory and records everything that is not complete."""

    def __init__(self, upload):
        self.upload = upload
        self.copied = {}
        self.problems = {'missing': [], 'censored': [], 'errors': []}

    def copy(self, src, rel, limit, *, required):
        label = str(rel)
        if rel in self.copied:
            return self.copied[rel]
        try:
            data, size = read_head(src, limit)
            expected = min(size, limit)
            if len(data) != expected:
                raise RuntimeError('short copy')
            dst = self.upload / rel
            os.makedirs(os.path.dirname(dst), mode=0o700, exist_ok=True)
            write_bytes_x(dst, data)
            if os.stat(dst).st_size != expected:
                raise RuntimeError('copied length differs from expected')
            if size > limit:
                self.problems['censored'].append('%s: %d of %d bytes retained' % (label, len(data), size))
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


def cmd_collect():
    base = av_dir()
    base.mkdir(mode=0o700, exist_ok=True)
    upload = base / 'upload'
    upload.mkdir(mode=0o700)
    ev = base / 'evidence'
    keep = Retention(upload)
    problems = keep.problems
    for name in ['env.json', 'bind-pre.json'] + ['bind-post-%s.json' % s for s in STAGES] + ['verdict-%s.json' % s for s in STAGES]:
        keep.copy(ev / name, Path(name), JSON_LIMIT * 4, required=True)
    verdicts, successful = {}, {}
    for stage in STAGES:
        for name in STAGE_FILES:
            limit = COPY_LIMIT if name in ('stdout', 'stderr') else JSON_LIMIT
            keep.copy(ev / stage / name, Path('stages') / stage / name, limit, required=True)
        try:
            verdict = load_json(ev / ('verdict-%s.json' % stage))
            verdicts[stage] = verdict.get('ok') is True
            if verdicts[stage]:
                successful[stage] = verdict
        except Exception:
            verdicts[stage] = None
    runtime = None
    try:
        runtime = find_runtime_dir(base / 'tmp')
    except Exception as error:
        problems['errors'].append('runtime directory: ' + str(error))
    if runtime is not None:
        # 1. Exact attempt and case identities recorded by each successful stage: every mandatory raw file.
        for stage, verdict in successful.items():
            attempt, files = expected_raw(stage, verdict)
            if attempt is None:
                problems['errors'].append('%s: verdict lacks a usable attempt/case identity' % stage)
                continue
            for rel, limit in files:
                keep.copy(runtime / attempt / rel, Path('attempts') / attempt / rel, limit, required=True)
        # 2. Everything else that exists (including fatal.json from failed or quarantined runs), best effort.
        try:
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
    final = {'run_id': RUN_ID, 'branch': BRANCH, 'commit': os.environ.get('GITHUB_SHA'), 'verdicts': verdicts,
             'all_stages_ok': all_ok, 'collection_problems': problems, 'supplemental_warnings': warnings,
             'retention_limits_bytes': {'stdout_stderr': COPY_LIMIT, 'json': JSON_LIMIT, 'case_output': CASE_OUTPUT_LIMIT,
                                        'execution_file_cap': CAP},
             'evidence_status': 'complete' if complete else 'partial/censored',
             'note': 'Acceptance also requires successful artifact upload; this record is written before upload. '
                     'Streams above the retention limit are censored even when below the execution cap.'}
    write_json_x(upload / 'final.json', final)
    print(json.dumps({'collect': True, 'all_stages_ok': all_ok, 'evidence_status': final['evidence_status']}))
    return 0


def cmd_final():
    try:
        final = load_json(av_dir() / 'upload' / 'final.json')
    except Exception as error:
        print(json.dumps({'final': 'HOLD', 'reason': 'final.json unreadable: ' + type(error).__name__}))
        return 1
    upload_outcome = os.environ.get('UPLOAD_OUTCOME')
    accepted = (final.get('all_stages_ok') is True and final.get('evidence_status') == 'complete'
                and upload_outcome == 'success')
    print(json.dumps({'final': 'ACCEPT-CANDIDATE' if accepted else 'HOLD', 'upload_outcome': upload_outcome,
                      'verdicts': final.get('verdicts'), 'evidence_status': final.get('evidence_status')}))
    return 0 if accepted else 1


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('init')
    b = sub.add_parser('bind')
    b.add_argument('--label', choices=['pre'], required=True)
    b.add_argument('--manifest-sha256', required=True)
    p = sub.add_parser('precheck')
    p.add_argument('stage', choices=STAGES)
    c = sub.add_parser('check')
    c.add_argument('stage', choices=STAGES)
    c.add_argument('--manifest-sha256', required=True)
    sub.add_parser('collect')
    sub.add_parser('final')
    args = parser.parse_args(argv)
    if args.command == 'init':
        return cmd_init()
    if args.command == 'bind':
        return cmd_bind_pre(args.manifest_sha256)
    if args.command == 'precheck':
        return cmd_precheck(args.stage)
    if args.command == 'check':
        return cmd_check(args.stage, args.manifest_sha256)
    if args.command == 'collect':
        return cmd_collect()
    return cmd_final()


if __name__ == '__main__':
    raise SystemExit(main())
