#!/usr/bin/python3
"""Review-only, fixed parity diagnostic. No execution without separate release."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import secrets
import selectors
import shutil
import signal
import stat
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
OUT = ROOT / '.parity-boundary-evidence'
WALL = 600
CAP = 16 * 1024 * 1024
HEAD = 'f64ec8e0bc1b292d914afbf62d09c6e1a98864ba'
STOP = None
CONTROL_MODE = None


def expected_guard_socket(directory, runtime, name, depth, info, uid, attempts):
    if name == 'guard.sock' and depth == 1 and directory.parent == runtime and len(attempts) == 1 and directory.name == attempts[0]:
        return stat.S_ISSOCK(info.st_mode) and info.st_uid == uid
    return None


def capture_flags(eof, integrity, parsed, total):
    complete = bool(eof and integrity)
    return {'output_eof_observed': eof, 'capture_complete': complete,
            'capture_status': 'complete_eof' if complete else 'censored_prefix',
            'parsing_status': 'complete' if complete and parsed == total else 'censored_prefix'}


def capture_write(stream, data):
    written = stream.write(data)
    if type(written) is not int or not 0 <= written <= len(data):
        raise RuntimeError('capture invalid write count')
    return written, written == len(data)


def stop(reason):
    global STOP
    if STOP is None:
        STOP = reason


def interrupted(number, _frame):
    stop('observer_failure' if number == signal.SIGUSR1 else 'signal_' + str(number))


def write_json(path, data, cap=1024*1024):
    raw = (json.dumps(data, indent=2) + '\n').encode()
    if len(raw) > cap:
        raise RuntimeError('record bound')
    with path.open('xb', buffering=0) as stream:
        if stream.write(raw) != len(raw):
            raise RuntimeError('short record write')
        os.fsync(stream.fileno())


def file_hash(path, size):
    if not isinstance(size, int) or not 0 <= size <= 64*1024*1024:
        raise RuntimeError('source size bound')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size != size:
            raise RuntimeError('source type/size')
        digest = hashlib.sha256()
        remaining = size
        while remaining:
            data = os.read(fd, min(65536, remaining))
            if not data:
                raise RuntimeError('source short read')
            digest.update(data)
            remaining -= len(data)
        if os.read(fd, 1):
            raise RuntimeError('source grew')
        return digest.hexdigest()
    finally:
        os.close(fd)


def verify():
    raw = (HERE / 'manifest.json').read_bytes()
    manifest = json.loads(raw)
    if manifest['base_head'] != HEAD:
        raise RuntimeError('base binding')
    deadline = time.monotonic() + 30
    for name, expected in manifest['files'].items():
        if time.monotonic() >= deadline:
            raise RuntimeError('preflight time bound')
        path = ROOT / name
        if not path.is_file() or path.is_symlink():
            raise RuntimeError('source type: ' + name)
        if file_hash(path, manifest['sizes'][name]) != expected:
            raise RuntimeError('source hash: ' + name)
    return manifest, hashlib.sha256(raw).hexdigest()


def load_mechanism():
    path = ROOT / 'test/support/p33-parity-supervisor.py'
    spec = importlib.util.spec_from_file_location('reviewed_p33_ownership', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # Defines helpers only; never calls main/guard.
    return module


def process_snapshot(mechanism, direct, freeze):
    errors = []
    rows, incomplete = mechanism.owned(seconds=1, direct=direct)
    if incomplete:
        errors.append('snapshot_discovery_incomplete')
    if len(rows) > 256:
        errors.append('snapshot_row_bound')
    # Only corroborated owned identities can be stopped; never marker-supplied PIDs.
    if freeze:
        errors.extend(mechanism.signal_rows(rows, signal.SIGSTOP, time.monotonic()+1))
    deadline = time.monotonic()+1
    result = []
    for old in rows[:256]:
        if time.monotonic() >= deadline:
            errors.append('snapshot_detail_deadline')
            break
        row = dict(old)
        try:
            before = mechanism.stat(row['pid'])
            if before['start'] != row['start']:
                raise RuntimeError('snapshot identity changed')
            with Path(f"/proc/{row['pid']}/cmdline").open('rb') as stream:
                argv = stream.read(4097)
            row['argv_truncated'] = len(argv) > 4096
            row['argv'] = argv[:4096].decode(errors='replace').split('\0')
            row['exe'] = os.readlink(f"/proc/{row['pid']}/exe")
            after = mechanism.stat(row['pid'])
            if after['start'] != row['start']:
                raise RuntimeError('snapshot identity changed')
            row['observed_after_stop'] = after
        except BaseException as error:
            row['detail_error'] = type(error).__name__
        result.append(row)
    value = {'rows': result, 'errors': errors, 'freeze_requested': freeze,
             'incomplete': bool(errors), 'meaning': 'Bounded owned-process observation; not a global process census.'}
    write_json(OUT/'snapshot.json', value)
    return value


def archive_observation(outstanding):
    """Post-stop observation only; never claim these are proven native-input bytes."""
    records = []
    deadline = time.monotonic()+1
    remaining = 4*1024*1024
    folder = OUT/'archives'
    folder.mkdir(mode=0o700)
    for event in list(outstanding.values())[:4]:
        argv = event['argv']
        if event['executable'] != 'unzip' or len(argv) < 2 or argv[0] not in ('-p', '-Z1'):
            continue
        path = Path(argv[1])
        record = {'call': event['call'], 'pid': event['pid'], 'path': str(path),
                  'meaning': 'Call unmatched in parsed prefix; its return may be unread/unparsed. Post-stop bytes are not proven native-entry bytes.'}
        fd = None
        try:
            # Known fixture or this experiment's scratch only; no guessed path.
            primary = ROOT/'Lock/04_IMPLEMENTATION/The_Desk_Walking_Skeleton_Fixture_v0.4.6.zip'
            ordinary = (path.parent.parent == Path('/tmp') and
                        path.parent.name.startswith('desk-extraction-parity-') and
                        path.name == 'fixture.zip')
            if not path.is_absolute() or (path != primary and not ordinary):
                raise RuntimeError('archive outside fixed allowed roots')
            if path.resolve(strict=True) != path:
                raise RuntimeError('archive path has symlink component')
            if time.monotonic() >= deadline:
                raise RuntimeError('archive deadline')
            fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
            before = os.fstat(fd)
            if not stat.S_ISREG(before.st_mode) or before.st_size > min(1048576, remaining):
                raise RuntimeError('archive type/size bound')
            data = bytearray()
            while len(data) <= before.st_size:
                if time.monotonic() >= deadline:
                    raise RuntimeError('archive deadline')
                chunk = os.read(fd, min(65536, before.st_size+1-len(data)))
                if not chunk:
                    break
                data.extend(chunk)
            after = os.fstat(fd)
            identity = lambda s: [s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns]
            if identity(before) != identity(after) or len(data) != before.st_size:
                raise RuntimeError('archive changed/read bound')
            name = f"{event['pid']}-{event['call']}.zip"
            with (folder/name).open('xb', buffering=0) as stream:
                if stream.write(data) != len(data):
                    raise RuntimeError('archive short write')
            remaining -= len(data)
            record.update(file=name, bytes=len(data), sha256=hashlib.sha256(data).hexdigest(),
                          identity=identity(after))
        except BaseException as error:
            record['unavailable'] = type(error).__name__ + ':' + str(error)
        finally:
            if fd is not None:
                os.close(fd)
        records.append(record)
    write_json(OUT/'archive-observations.json', records)


class CaseLedger:
    """Bounded matching transitions, not interchangeable aggregate counters."""
    def __init__(self):
        self.workers = {}
        self.cases = []

    def observe(self, event):
        pid, occurrence, name = event['pid'], event['occurrence'], event['case']
        if (type(pid) is not int or pid <= 0 or type(occurrence) is not int or
                occurrence < 0 or not isinstance(name, str) or len(name.encode()) > 1024):
            raise RuntimeError('case marker identity bound')
        if pid not in self.workers:
            if len(self.workers) >= 256:
                raise RuntimeError('case worker bound')
            self.workers[pid] = {'occurrence': 0, 'active': None}
        worker = self.workers[pid]
        kind = event['event']
        if kind == 'case-enter':
            previous = worker['active']
            if (len(self.cases) >= 432 or occurrence != worker['occurrence']+1 or
                    (previous is not None and previous['phase'] != 'complete')):
                raise RuntimeError('duplicate/stale/overlapping case entry')
            record = {'pid': pid, 'occurrence': occurrence, 'case': name,
                      'entry_seq': event['seq'], 'phase': 'body'}
            worker.update(occurrence=occurrence, active=record)
            self.cases.append(record)
            return
        if occurrence == 0:
            if (worker['occurrence'] != 0 or name != '<module-init>' or
                    kind in ('cleanup-enter', 'cleanup-return')):
                raise RuntimeError('stale module/case transition')
            return
        record = worker['active']
        if (record is None or record['occurrence'] != occurrence or record['case'] != name or
                record['phase'] == 'complete'):
            raise RuntimeError('case identity/phase mismatch')
        if kind == 'cleanup-enter':
            if record['phase'] != 'body':
                raise RuntimeError('duplicate cleanup entry')
            record.update(phase='cleanup', cleanup_entry_seq=event['seq'],
                          observed_test_state=event.get('state'))
        elif kind == 'cleanup-return':
            if record['phase'] != 'cleanup':
                raise RuntimeError('cleanup return without matching entry')
            record.update(phase='complete', cleanup_return_seq=event['seq'])

    def report(self):
        completed = sum(case['phase'] == 'complete' for case in self.cases)
        return {'entered': len(self.cases), 'completed': completed,
                'all_expected_pairs_complete': len(self.cases) == completed == 432,
                'cases': self.cases}


def p33_runtime():
    key = hashlib.sha256(str(ROOT.resolve()).encode()).hexdigest()[:24]
    suffix = '' if CONTROL_MODE is None else '-'+CONTROL_MODE
    return Path('/tmp')/(f'the-desk-p33-{os.getuid()}-{key}'+suffix)


def reserve_p33_runtime():
    """Refuse old evidence; reserve an empty private directory for this invocation."""
    runtime = p33_runtime()
    runtime.mkdir(mode=0o700)  # Exclusive; existing directory/symlink is a pre-spawn failure.
    info = runtime.lstat()
    return {'path': str(runtime), 'device': info.st_dev, 'inode': info.st_ino,
            'uid': info.st_uid, 'reserved_empty_before_spawn': True}


def retain_p33(binding, ledger):
    destination = OUT/'p33'
    destination.mkdir(mode=0o700)
    runtime = Path(binding['path'])
    errors, retained, records = [], [], {}
    count = total = seen = 0
    deadline = time.monotonic()+2
    report = {'status': 'incomplete', 'binding': binding, 'files': 0, 'bytes': 0,
              'errors': errors, 'retained': retained, 'attempt': None, 'nonce': None}
    try:
        info = runtime.lstat()
    except FileNotFoundError:
        errors.append('p33_runtime_absent')
        report['status'] = 'absent'
        return report
    except OSError as error:
        errors.append('p33_runtime_stat:'+type(error).__name__)
        return report
    if (not stat.S_ISDIR(info.st_mode) or info.st_mode & 0o077 or
            (info.st_dev, info.st_ino, info.st_uid) !=
            (binding['device'], binding['inode'], binding['uid'])):
        errors.append('p33_runtime_identity_changed')
        return report
    attempts, nonces = [], []
    stack = [(runtime, 0)]
    # Explicit bounded scandir replaces os.walk: every traversal error is sticky.
    while stack:
        directory, depth = stack.pop()
        if time.monotonic() >= deadline or seen >= 64:
            errors.append('p33_traversal_bound')
            break
        try:
            with os.scandir(directory) as entries:
                for entry in entries:
                    seen += 1
                    if time.monotonic() >= deadline or seen > 64:
                        errors.append('p33_traversal_bound')
                        stack.clear()
                        break
                    path = Path(entry.path)
                    info = entry.stat(follow_symlinks=False)
                    if stat.S_ISLNK(info.st_mode) or info.st_uid != binding['uid']:
                        errors.append('p33_unsafe_entry:'+str(path.relative_to(runtime)))
                        continue
                    socket_entry = expected_guard_socket(directory, runtime, entry.name, depth,
                                                         info, binding['uid'], attempts)
                    if socket_entry is not None:
                        if not socket_entry:
                            errors.append('p33_expected_guard_socket_type_or_owner')
                        continue  # lstat metadata only: never open/copy/delete/follow this socket.
                    if stat.S_ISDIR(info.st_mode):
                        if depth == 0 and entry.name.startswith('attempt-'):
                            attempts.append(entry.name)
                        elif depth == 1 and len(entry.name) == 48 and all(c in '0123456789abcdef' for c in entry.name):
                            nonces.append((directory.name, entry.name))
                        elif depth == 2 and entry.name == 'tmp':
                            continue  # Deliberately excluded child scratch, never evidence.
                        else:
                            errors.append('p33_unexpected_directory:'+str(path.relative_to(runtime)))
                            continue
                        stack.append((path, depth+1))
                        continue
                    if depth == 0 and entry.name == 'validation.lock':
                        if not stat.S_ISREG(info.st_mode):
                            errors.append('p33_lease_type')
                        continue
                    if not (entry.name.endswith('.json') or entry.name == 'output.log'):
                        errors.append('p33_unexpected_file:'+str(path.relative_to(runtime)))
                        continue
                    if not stat.S_ISREG(info.st_mode) or info.st_size > 65536:
                        errors.append('p33_evidence_type_or_bound')
                        continue
                    if count >= 16 or total+info.st_size > 1048576:
                        errors.append('p33_retention_bound')
                        stack.clear()
                        break
                    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
                    try:
                        before = os.fstat(fd)
                        if (not stat.S_ISREG(before.st_mode) or before.st_size > 65536 or
                                (before.st_dev, before.st_ino, before.st_size) !=
                                (info.st_dev, info.st_ino, info.st_size)):
                            raise RuntimeError('p33_open_identity_or_bound')
                        data = bytearray()
                        while len(data) <= before.st_size:
                            if time.monotonic() >= deadline:
                                raise RuntimeError('p33_read_deadline')
                            part = os.read(fd, min(4096, before.st_size+1-len(data)))
                            if not part:
                                break
                            data.extend(part)
                        after = os.fstat(fd)
                    finally:
                        os.close(fd)
                    identity = lambda v: (v.st_dev, v.st_ino, v.st_size, v.st_mtime_ns, v.st_ctime_ns)
                    if (identity(before) != identity(info) or identity(before) != identity(after) or
                            len(data) != info.st_size or len(data) > 65536):
                        errors.append('p33_evidence_changed')
                        continue
                    relative = str(path.relative_to(runtime))
                    target = destination/relative
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with target.open('xb') as stream:
                        if stream.write(data) != len(data):
                            raise RuntimeError('p33_evidence_short_write')
                    count += 1
                    total += len(data)
                    retained.append({'path': relative, 'bytes': len(data),
                                     'sha256': hashlib.sha256(data).hexdigest()})
                    records[relative] = bytes(data)
        except BaseException as error:
            errors.append('p33_traversal_or_copy:'+type(error).__name__)
    report.update(files=count, bytes=total)
    if count == 0:
        errors.append('p33_zero_evidence_files')
    if len(attempts) != 1:
        errors.append('p33_expected_one_fresh_attempt')
    if len(nonces) != 1 or (len(attempts) == 1 and nonces[0][0] != attempts[0]):
        errors.append('p33_expected_one_nonce_for_attempt')
    p33_cases = [case for case in ledger.cases if case['case'].split(' > ')[-1] == 'P33 multidisk']
    if len(p33_cases) != 1 or p33_cases[0]['phase'] != 'complete':
        errors.append('p33_case_pair_not_complete')
    if len(attempts) == len(nonces) == 1 and nonces[0][0] == attempts[0]:
        attempt, nonce = attempts[0], nonces[0][1]
        report.update(attempt=attempt, nonce=nonce)
        names = [attempt+'/prerequisite.json', attempt+'/guard-result.json',
                 attempt+'/'+nonce+'/completion.json', attempt+'/'+nonce+'/result.json',
                 attempt+'/'+nonce+'/output.log']
        for name in names:
            if name not in records:
                errors.append('p33_missing_expected_record:'+name)
        if any(name.endswith('/fatal.json') for name in records):
            errors.append('p33_fatal_record_present')
        if all(name in records for name in names):
            try:
                prerequisite, guard, completion, result = [json.loads(records[name]) for name in names[:4]]
                def settled(value):
                    reaped = value.get('reaped')
                    return (all(value.get(key) is True for key in ('settled', 'directReaped', 'noChildren', 'complete')) and
                            all(value.get(key) == [] for key in ('errors', 'residual', 'cleanupErrors')) and
                            isinstance(reaped, list) and len(reaped) > 0 and
                            all(type(row.get('pid')) is int and row['pid'] > 0 and
                                type(row.get('raw')) is int and type(row.get('exit')) is int and
                                os.waitstatus_to_exitcode(row['raw']) == row['exit'] for row in reaped))
                if not (all(prerequisite.get(key) is True for key in ('subreaper', 'pidfdSignal0', 'proc')) and
                        prerequisite.get('executable') == os.path.realpath('/usr/bin/python3')):
                    errors.append('p33_prerequisite_record_invalid')
                if not (settled(guard) and 'fatal' in guard and guard['fatal'] is None and
                        'containedRejection' in guard and guard['containedRejection'] is None):
                    errors.append('p33_guard_settlement_not_successful')
                if not (settled(result) and result.get('protocol') == 1 and result.get('nonce') == nonce and
                        result.get('mode') == 'p33' and result.get('outcome') == 'COMPLETED' and
                        result.get('reason') == 'child_exit' and result.get('childStarted') is True and
                        result.get('controls') == []):
                    errors.append('p33_case_settlement_not_successful')
                if completion != {'protocol': 1, 'nonce': nonce, 'case': 'P33 multidisk',
                                  'assertionsCompleted': True, 'hooksCompleted': True}:
                    errors.append('p33_completion_record_mismatch')
            except BaseException as error:
                errors.append('p33_record_validation:'+type(error).__name__)
    try:
        final = runtime.lstat()
        if (final.st_dev, final.st_ino, final.st_uid) != (binding['device'], binding['inode'], binding['uid']):
            errors.append('p33_runtime_identity_changed_after_read')
    except OSError as error:
        errors.append('p33_runtime_final_stat:'+type(error).__name__)
    report['status'] = 'complete' if not errors else 'incomplete'
    return report


def main():
    global OUT, WALL, CONTROL_MODE
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--released-run-id', choices=['parity-hosted-001', 'control-normal-001', 'control-deadline-001'], required=True)
    parser.add_argument('--manifest-sha256', required=True)
    args = parser.parse_args()
    if hashlib.sha256((HERE/'manifest.json').read_bytes()).hexdigest() != args.manifest_sha256:
        raise RuntimeError('reviewed manifest binding')
    manifest, manifest_hash = verify()
    if args.released_run_id.startswith('control-'):
        CONTROL_MODE = args.released_run_id
        OUT = ROOT/('.parity-boundary-'+CONTROL_MODE)
        WALL = 3
    # Persistent latch: never remove/reuse this directory after any attempted launch.
    OUT.mkdir(mode=0o700)
    (OUT/'home').mkdir(mode=0o700)
    mechanism = load_mechanism()
    preflight = mechanism.prerequisite()
    signal.signal(signal.SIGCHLD, signal.SIG_DFL)
    for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP, signal.SIGUSR1):
        signal.signal(sig, interrupted)
    node = shutil.which('node')
    if not node:
        raise RuntimeError('Node missing')
    node = os.path.realpath(node)
    token = secrets.token_hex(16)
    env = {'PATH': str(Path(node).parent)+':/usr/bin:/bin', 'HOME': str(OUT/'home'),
           'TMPDIR': '/tmp', 'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8', 'TZ': 'UTC',
           'CI': 'true', 'GITHUB_ACTIONS': 'true',
           'DESK_DIAG_SUPERVISOR': str(os.getpid()), 'DESK_DIAG_TOKEN': token}
    # Preserve GitHub's noncredential orphan-cleanup tag, without logging its value.
    if os.getenv('RUNNER_TRACKING_ID'):
        env['RUNNER_TRACKING_ID'] = os.environ['RUNNER_TRACKING_ID']
    p33_binding = reserve_p33_runtime()
    command = ['/usr/bin/python3', str(ROOT/'test/support/p33-parity-supervisor.py'), 'guard', 'parity']
    if CONTROL_MODE is not None:
        command = ['/usr/bin/python3', str(HERE/'synthetic_child.py'), CONTROL_MODE]
        env.update(DESK_DIAG_OUTPUT=str(OUT), DESK_DIAG_P33_RUNTIME=p33_binding['path'])
    write_json(OUT/'launch.json', {'run_id': args.released_run_id, 'base_head': HEAD,
        'manifest_sha256': manifest_hash, 'command': command, 'cwd': str(ROOT),
        'node': node, 'prerequisite': preflight, 'wall_seconds': WALL, 'output_limit': CAP,
        'utc_start': time.time(), 'environment_keys': sorted(env), 'p33_runtime': p33_binding})
    proc = direct = None
    settlement = None
    snapshot = None
    p33 = None
    errors = []
    seq, counts, outstanding = {}, {}, {}
    ledger = CaseLedger()
    last = None
    pending = b''
    total = 0
    parsed_bytes = 0
    eof = False
    capture_complete = True
    selector = selectors.DefaultSelector()
    raw = (OUT/'output.log').open('xb', buffering=0)
    started = time.monotonic()
    try:
        if STOP:
            raise RuntimeError('interrupted before spawn')
        proc = subprocess.Popen(command, cwd=ROOT, env=env, stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True, close_fds=True)
        direct = mechanism.identity(proc)
        os.set_blocking(proc.stdout.fileno(), False)
        selector.register(proc.stdout, selectors.EVENT_READ)
        while STOP is None:
            remaining = started+WALL-time.monotonic()
            if remaining <= 0:
                stop('wall_deadline')
                break
            for key, _ in selector.select(min(.05, remaining)):
                data = os.read(key.fd, 65536)
                if not data:
                    selector.unregister(key.fileobj)
                    eof = True
                    continue
                keep = data[:max(0, CAP-total)]
                written, whole = capture_write(raw, keep)
                total += written
                if not whole:
                    capture_complete = False
                    raise RuntimeError('capture short write')
                if len(keep) != len(data) or total >= CAP:
                    capture_complete = False
                    stop('output_bound')
                    break
                pending += data
                while b'\n' in pending:
                    line, pending = pending.split(b'\n', 1)
                    if len(line) > 65536:
                        raise RuntimeError('line bound')
                    if not line.startswith(b'DESK_DIAG '):
                        parsed_bytes += len(line)+1
                        continue
                    event = json.loads(line[10:])
                    pid = event['pid']
                    if event.get('token') != token or event['seq'] != seq.get(pid, 0)+1:
                        raise RuntimeError('marker identity/sequence')
                    if len(seq) >= 256 and pid not in seq:
                        raise RuntimeError('marker process bound')
                    seq[pid] = event['seq']
                    ledger.observe(event)
                    kind = event['event']
                    counts[kind] = counts.get(kind, 0)+1
                    last = event
                    key = (pid, event.get('call'))
                    if kind == 'native-enter':
                        if key in outstanding or len(outstanding) >= 256:
                            raise RuntimeError('native marker bound/duplicate')
                        outstanding[key] = event
                    elif kind in ('native-return', 'native-throw'):
                        if key not in outstanding:
                            raise RuntimeError('unmatched native return')
                        del outstanding[key]
                    elif kind == 'cleanup-enter' and event.get('state') == 'fail':
                        stop('observed_case_failure')
                        parsed_bytes += len(line)+1
                        break
                    parsed_bytes += len(line)+1
                if len(pending) > 65536:
                    raise RuntimeError('partial line bound')
                if STOP:
                    break
            # Never reap the direct leader before final group signals.
            status = os.waitid(os.P_PID, proc.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
            if status is not None and eof:
                stop('natural_exit')
    except BaseException as error:
        capture_complete = False
        errors.append(type(error).__name__ + ':' + str(error))
        stop('controller_error')
    finally:
        if proc is not None:
            try:
                snapshot = process_snapshot(mechanism, direct, STOP != 'natural_exit')
                archive_observation(outstanding)
            except BaseException as error:
                errors.append('snapshot_or_archive:' + type(error).__name__)
            # Reuse exact reviewed A+B algorithm; only outer cleanup budget is 12s.
            # Frozen children may require KILL. No new group signals follow its reaping.
            settlement = mechanism.settle(proc, direct, budget=12.0)
        for name, handle in [('selector', selector), ('output', raw), ('pipe', proc.stdout if proc else None)]:
            if handle is not None:
                try:
                    handle.close()
                except BaseException as error:
                    errors.append(name+'_close:'+type(error).__name__)
                    capture_complete = False
        # No post-stop drain is claimed. Closing without EOF censors the stream.
        capture_complete = capture_complete and eof
        try:
            p33 = retain_p33(p33_binding, ledger)
        except BaseException as error:
            errors.append('p33_retention:'+type(error).__name__)
    observation = {**capture_flags(eof, capture_complete, parsed_bytes, total), 'stop_reason': STOP,
        'bytes_retained': total, 'parsed_prefix_bytes': parsed_bytes,
        'unparsed_retained_suffix_bytes': total-parsed_bytes,
        'buffered_unparsed_bytes': len(pending), 'case_lifecycle': ledger.report(),
        'outstanding_calls': list(outstanding.values()),
        'outstanding_calls_scope': 'Unmatched only in the parsed prefix. Return/throw markers may be unread or in the retained unparsed suffix; no native non-return claim without corroboration.'}
    if proc is not None and (settlement is None or not settlement['settled']):
        # Fail closed with the subreaper alive. The hosted job's finite timeout
        # tears down the disposable runner; no local launch is released here.
        try:
            write_json(OUT/'result.json', {'reason': STOP, 'candidate_completed': False,
                'settlement': settlement, 'errors': errors, 'last_marker': last,
                'observation': observation, 'p33_retention': p33,
                'meaning': 'OWNERSHIP UNCERTAIN: hosted executor teardown required'})
            print('PARITY DIAGNOSTIC OWNERSHIP UNCERTAIN; executor teardown required', flush=True)
        finally:
            mechanism.quarantine(OUT, 'diagnostic outer settlement uncertain', settlement)
    changed = []
    postflight_deadline = time.monotonic()+30
    for name, expected in manifest['files'].items():
        try:
            if time.monotonic() >= postflight_deadline:
                changed.append('postflight_time_bound')
                break
            if file_hash(ROOT/name, manifest['sizes'][name]) != expected:
                changed.append(name)
        except (OSError, RuntimeError):
            changed.append(name)
    live_at_exit = [r for r in (snapshot or {}).get('rows', []) if r['state'] != 'Z']
    completed = (STOP == 'natural_exit' and proc is not None and proc.returncode == 0
        and settlement is not None and settlement['settled'] and not errors and not changed
        and capture_complete and observation['parsing_status'] == 'complete'
        and not outstanding and not live_at_exit
        and not (snapshot or {}).get('incomplete', True)
        and counts.get('module-enter') == counts.get('registration-complete') == 1
        and ledger.report()['all_expected_pairs_complete']
        and p33 is not None and p33['status'] == 'complete' and not p33['errors'])
    result = {'run_id': args.released_run_id, 'reason': STOP, 'candidate_completed': completed,
        'actual_child_exit': proc.returncode if proc else None, 'elapsed_seconds': time.monotonic()-started,
        'settlement': settlement, 'errors': errors, 'changed_sources': changed,
        'observation': observation, 'event_counts': counts,
        'last_marker': last, 'p33_retention': p33,
        'synthetic_control': CONTROL_MODE,
        'meaning': 'One instrumented parity observation; independent review of summary and evidence required.'}
    write_json(OUT/'result.json', result)
    print(json.dumps({'reason': STOP, 'candidate_completed': completed, 'evidence': str(OUT)}), flush=True)
    return 0 if completed else 1


if __name__ == '__main__':
    raise SystemExit(main())
