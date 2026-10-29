#!/usr/bin/python3
"""Fixed P33 test guard and case owner. No generic executable runner."""
import argparse
import ctypes
import fcntl
import hashlib
import json
import os
from pathlib import Path
import secrets
import selectors
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
SELF = Path(__file__).resolve()
INJECT_EMPTY = False
INTERRUPTED = False
OUTPUT_LIMIT = 65536
RECORD_LIMIT = 4096


def interrupted(_sig, _frame):
    global INTERRUPTED
    INTERRUPTED = True


def handlers():
    signal.signal(signal.SIGCHLD, signal.SIG_DFL)
    for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
        signal.signal(sig, interrupted)


def write_record(path, value, limit=OUTPUT_LIMIT):
    data = (json.dumps(value, separators=(",", ":")) + "\n").encode()
    if len(data) > limit:
        raise RuntimeError("record bound")
    with open(path, "xb", buffering=0) as stream:
        if stream.write(data) != len(data):
            raise RuntimeError("short record write")
        os.fsync(stream.fileno())


def close_recorded(resource, label, errors):
    """Close failure is sticky evidence, never an unwind past settlement."""
    try:
        resource.close()
    except BaseException as error:
        errors.append(label + ':' + type(error).__name__)


def prerequisite():
    if sys.implementation.name != "cpython" or sys.version_info[:2] not in ((3, 12), (3, 13)):
        raise RuntimeError("P33 prerequisite: /usr/bin/python3 must be CPython 3.12 or 3.13")
    if os.path.realpath(sys.executable) != os.path.realpath("/usr/bin/python3"):
        raise RuntimeError("P33 interpreter identity mismatch")
    if sys.platform != "linux":
        raise RuntimeError("P33 prerequisite: Linux")
    kernel = tuple(int(p) for p in os.uname().release.split("-")[0].split(".")[:2])
    if kernel < (5, 3):
        raise RuntimeError("P33 prerequisite: Linux >=5.3")
    for name in ("pidfd_open", "waitid", "WNOWAIT", "WNOHANG"):
        if not hasattr(os, name):
            raise RuntimeError("P33 missing os capability: " + name)
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(36, 1, 0, 0, 0) != 0:
        raise RuntimeError("P33 subreaper denied")
    value = ctypes.c_int()
    if libc.prctl(37, ctypes.byref(value), 0, 0, 0) != 0 or value.value != 1:
        raise RuntimeError("P33 subreaper verification failed")
    fd = os.pidfd_open(os.getpid())
    try:
        signal.pidfd_send_signal(fd, 0)
    finally:
        os.close(fd)
    row = stat(os.getpid())
    if row["ppid"] != os.getppid():
        raise RuntimeError("P33 proc identity mismatch")
    evidence = DiscoveryEvidence()
    now = time.monotonic()
    scan = DiscoveryScan(evidence, 'prerequisite', now, now + .25, now + .25, None, now)
    table = pid_table(scan, 4096)
    incomplete = scan.finish()
    if incomplete or table.get(os.getpid()) != row:
        raise RuntimeError("P33 proc table unavailable")
    return {"python": sys.version, "executable": os.path.realpath(sys.executable),
            "kernel": os.uname().release, "image": os.getenv("ImageVersion"),
            "subreaper": True, "pidfdSignal0": True, "proc": True}


def stat(pid):
    # A proc stat record is small; never use an unbounded pseudo-file read.
    with Path(f'/proc/{pid}/stat').open('rb') as stream:
        raw = stream.read(4097)
    if len(raw) > 4096:
        raise ValueError('proc stat read bound')
    text = raw.decode()
    end = text.rfind(')')
    if end < 0 or int(text.split(' ', 1)[0]) != pid:
        raise ValueError('proc stat identity/format')
    tail = text[end + 2:].split()
    return {'pid': pid, 'state': tail[0], 'ppid': int(tail[1]),
            'pgid': int(tail[2]), 'sid': int(tail[3]), 'start': int(tail[19])}


class DiscoveryEvidence:
    """Bounded causal evidence; omitted detail never changes error semantics."""
    def __init__(self):
        self.started = self.completed = self.failed = self.skipped = 0
        self.counts = {}
        self.records = []
        self.dropped = 0

    def record(self, value):
        if len(self.records) < 8:
            self.records.append(value)
        else:
            self.dropped += 1

    def skip(self, phase, now, until):
        self.skipped += 1
        self.record({'event': 'phase_scan_not_started', 'phase': phase,
                     'at': now, 'phaseUntil': until, 'remaining': max(0, until-now)})

    def report(self):
        value = {'scansStarted': self.started, 'scansCompleted': self.completed,
                 'scansFailed': self.failed, 'scansNotStarted': self.skipped,
                 'reasonCounts': self.counts, 'records': self.records,
                 'droppedRecords': self.dropped}
        if len(json.dumps(value, separators=(',', ':')).encode()) > 16384:
            raise ValueError('discovery evidence bound')
        return value


def discovery_identity(row):
    return None if row is None else {k: row[k] for k in ('pid', 'start', 'ppid')}


class DiscoveryScan:
    def __init__(self, evidence, phase, started, deadline, until, direct, reserved):
        self.evidence = evidence
        self.phase = phase
        self.started = started
        self.deadline = deadline
        self.until = until
        self.reserved = reserved
        self.direct = discovery_identity(direct)
        self.failures = 0
        self.first = None
        evidence.started += 1

    def fail(self, kind, stage, **detail):
        self.failures += 1
        key = self.phase + ':' + kind
        self.evidence.counts[key] = self.evidence.counts.get(key, 0) + 1
        if self.first is None:
            self.first = {'kind': kind, 'stage': stage, **detail}

    def read_error(self, stage, pid, error):
        self.fail('stat_error', stage, pid=pid, error=type(error).__name__,
                  errno=getattr(error, 'errno', None))

    def expired(self, stage):
        if time.monotonic() >= self.deadline:
            self.fail('deadline', stage)
            return True
        return False

    def finish(self):
        ended = time.monotonic()
        if ended >= self.deadline:
            self.fail('deadline', 'scan_end')
        if self.failures:
            self.evidence.failed += 1
            self.evidence.record({'event': 'scan_failed', 'phase': self.phase,
                'reservedAt': self.reserved, 'started': self.started, 'ended': ended,
                'deadline': self.deadline, 'phaseUntil': self.until,
                'grantedSeconds': self.deadline-self.reserved,
                'direct': self.direct, 'firstFailure': self.first,
                'failureCount': self.failures, 'omittedFailureDetails': self.failures-1})
        else:
            self.evidence.completed += 1
        return self.failures != 0


def pid_table(scan, maximum):
    # Enumeration never establishes ownership or permits signalling.
    if INJECT_EMPTY:
        return {}  # Known-child corroboration must still fail.
    rows = {}
    entries_seen = 0
    try:
        with os.scandir('/proc') as entries:
            while True:
                if scan.expired('table_enumeration'):
                    break
                try:
                    entry = next(entries)
                except StopIteration:
                    break
                entries_seen += 1
                if entries_seen > maximum:
                    scan.fail('entry_bound', 'table_enumeration')
                    break
                if not entry.name.isascii() or not entry.name.isdecimal():
                    continue
                pid = int(entry.name)
                try:
                    row = stat(pid)
                except FileNotFoundError:
                    # Only an enumerated, not known-direct, disappearing PID.
                    continue
                except (OSError, ValueError, IndexError) as error:
                    scan.read_error('table_stat', pid, error)
                    continue
                rows[row['pid']] = row
    except OSError as error:
        scan.fail('table_io', 'table_enumeration', error=type(error).__name__, errno=error.errno)
    return rows


def owned(maximum=4096, seconds=2, direct=None, *, deadline=None,
          evidence=None, phase='standalone', phase_until=None, reserved_at=None):
    """Bounded PPID closure; every attempted scan has one immutable deadline."""
    started = time.monotonic()
    deadline = started + seconds if deadline is None else deadline
    evidence = DiscoveryEvidence() if evidence is None else evidence
    scan = DiscoveryScan(evidence, phase, started, deadline, phase_until, direct,
                         started if reserved_at is None else reserved_at)
    root = os.getpid()
    table = pid_table(scan, maximum)
    rows = {}
    queue = [root]

    def done():
        return list(rows.values()), scan.finish()

    # Never excuse a missing/recycled known child, including a zombie.
    if direct is not None:
        if scan.expired('direct_identity'):
            return done()
        try:
            row = stat(direct['pid'])
            if row['start'] != direct['start'] or row['ppid'] != root:
                scan.fail('direct_identity', 'direct_identity',
                          expected=discovery_identity(direct), observed=discovery_identity(row))
            else:
                rows[row['pid']] = row
                queue.append(row['pid'])
                observed = table.get(row['pid'])
                if (observed is None or observed['start'] != row['start'] or
                        observed['ppid'] != root):
                    scan.fail('direct_corroboration', 'direct_identity',
                              expected=discovery_identity(row), observed=discovery_identity(observed))
        except (OSError, ValueError, IndexError) as error:
            scan.read_error('direct_identity', direct['pid'], error)
    by_parent = {}
    for row in table.values():
        if scan.expired('parent_index'):
            return done()
        by_parent.setdefault(row['ppid'], []).append(row)
    while queue:
        if scan.expired('closure'):
            return done()
        parent = queue.pop()
        if parent != root:
            try:
                current = stat(parent)
                expected = rows[parent]
                if (current['start'] != expected['start'] or
                        current['ppid'] != expected['ppid']):
                    scan.fail('parent_identity', 'closure',
                              expected=discovery_identity(expected), observed=discovery_identity(current))
                    continue
            except FileNotFoundError:
                continue  # Existing disappearance treatment; no new PPID exception.
            except (OSError, ValueError, IndexError) as error:
                scan.read_error('closure_parent', parent, error)
                continue
        for row in by_parent.get(parent, ()):
            if scan.expired('closure_child'):
                return done()
            if len(rows) >= maximum:
                scan.fail('row_bound', 'closure_child')
                return done()
            if row['pid'] in rows or row['pid'] == root:
                continue
            try:
                current = stat(row['pid'])
                if current['start'] != row['start'] or current['ppid'] != parent:
                    scan.fail('child_identity', 'closure_child',
                              expected=discovery_identity(row), observed=discovery_identity(current))
                    continue
            except FileNotFoundError:
                continue
            except (OSError, ValueError, IndexError) as error:
                scan.read_error('closure_child', row['pid'], error)
                continue
            rows[row['pid']] = current
            queue.append(row['pid'])
    return done()


def signal_rows(rows, sig, deadline, maximum=4096):
    errors = set()
    for index, row in enumerate(rows):
        if time.monotonic() >= deadline or index >= maximum:
            errors.add('signalling_incomplete')
            break
        try:
            # pidfd binds identity; starttime check protects against a recycled PID
            # between discovery and pidfd_open. No unverified numeric-PID kill.
            fd = os.pidfd_open(row['pid'])
            try:
                if time.monotonic() >= deadline:
                    errors.add('signalling_incomplete')
                    break
                current = stat(row['pid'])
                if time.monotonic() >= deadline:
                    errors.add('signalling_incomplete')
                    break
                if current['start'] == row['start']:
                    signal.pidfd_send_signal(fd, sig)
            finally:
                os.close(fd)
        except (ProcessLookupError, FileNotFoundError):
            pass
        except BaseException as error:
            # One signal failure must not abandon remaining owned processes.
            errors.add('signal_row:' + type(error).__name__)
    return errors


def identity(proc):
    row = stat(proc.pid)
    if row['ppid'] != os.getpid():
        raise RuntimeError('direct identity mismatch')
    return row


def _settle(proc, direct, budget=1.0):
    """Reserve leader until final group signal; then positive consuming waits."""
    start = time.monotonic()
    errors, reaped = set(), []
    evidence = DiscoveryEvidence()
    rows = []
    for sig, fraction in ((signal.SIGTERM, .25), (signal.SIGKILL, .75)):
        until = start + budget * fraction
        while time.monotonic() < until:
            try:
                # Only this function consumes the child after both phases.
                os.killpg(proc.pid, sig)
            except ProcessLookupError:
                pass
            except OSError as error:
                errors.add('group:' + type(error).__name__)
            try:
                now = time.monotonic()
                phase = 'term' if sig == signal.SIGTERM else 'kill'
                if now + .025 > until:
                    evidence.skip(phase, now, until)
                    # Keep the original transition cutoff, never start a tiny scan.
                    while time.monotonic() < until:
                        time.sleep(min(.005, max(0, until-time.monotonic())))
                    break
                rows, incomplete = owned(direct=direct, deadline=now+.025,
                    evidence=evidence, phase=phase, phase_until=until, reserved_at=now)
                if incomplete:
                    errors.add('discovery_incomplete')
                errors.update(signal_rows(rows, sig, until))
                status = os.waitid(os.P_PID, proc.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
                if status is not None and not incomplete and all(r['state'] == 'Z' for r in rows):
                    break
            except (OSError, ValueError) as error:
                errors.add('observe:' + type(error).__name__)
            time.sleep(min(.005, max(0, until-time.monotonic())))
    # No group signal after this point, even after a consuming wait error.
    no_children = False
    direct_reaped = False
    complete = False
    until = start + budget
    while time.monotonic() < until:
        while len(reaped) < 4096 and time.monotonic() < until:
            try:
                pid, raw = os.waitpid(-1, os.WNOHANG)
            except ChildProcessError:
                no_children = True
                break
            if pid == 0:
                no_children = False
                break
            reaped.append({'pid': pid, 'raw': raw, 'exit': os.waitstatus_to_exitcode(raw)})
            no_children = False
            if pid == proc.pid:
                direct_reaped = True
                proc.returncode = os.waitstatus_to_exitcode(raw)
        # Never reuse completion from before this iteration's consuming waits.
        complete = False
        try:
            now = time.monotonic()
            if now + .025 > until:
                evidence.skip('final', now, until)
                break  # No fresh scan: HOLD, even if consuming waits reached ECHILD.
            rows, incomplete = owned(direct=None if direct_reaped else direct,
                deadline=now+.025, evidence=evidence, phase='final',
                phase_until=until, reserved_at=now)
            complete = not incomplete
            if incomplete:
                errors.add('discovery_incomplete')
            errors.update(signal_rows(rows, signal.SIGKILL, until))
        except (OSError, ValueError) as error:
            complete = False
            errors.add('residual:' + type(error).__name__)
        if direct_reaped and no_children and complete and not rows:
            break
        time.sleep(min(.005, max(0, until-time.monotonic())))
    return {'settled': direct_reaped and no_children and complete and not rows and not errors,
            'directReaped': direct_reaped, 'noChildren': no_children, 'complete': complete,
            'reaped': reaped, 'residual': rows, 'errors': sorted(errors),
            'discoveryDetails': evidence.report()}


def settle(proc, direct, budget=1.0):
    try:
        return _settle(proc, direct, budget)
    except BaseException as error:
        # Unexpected cleanup failure must not unwind the owner and its lease.
        return {'settled': False, 'directReaped': False, 'noChildren': False,
                'complete': False, 'reaped': [], 'residual': [],
                'errors': ['cleanup_exception:' + type(error).__name__],
                'ownershipUnknown': True}


def quarantine(folder, reason, detail):
    """Keep inherited lease/subreaper alive; only reap eventual exit notifications."""
    try:
        write_record(folder/'fatal.json', {'outcome': 'FATAL', 'reason': reason, 'detail': detail})
    except BaseException:
        pass  # Failure to record never permits exit/unlock/continuation.
    try:
        os.write(2, b'P33 FATAL: validation quarantined; executor teardown required\n')
    except OSError:
        pass
    while True:
        try:
            try:
                os.waitpid(-1, 0)
            except ChildProcessError:
                signal.pause()
        except BaseException:
            # Even reap/pause failure cannot release the quarantine lease.
            continue


def receive_line(sock, limit, until):
    data = bytearray()
    while time.monotonic() < until and not INTERRUPTED:
        sock.settimeout(min(.05, max(.001, until-time.monotonic())))
        try:
            part = sock.recv(min(4096, limit + 1 - len(data)))
        except socket.timeout:
            continue
        if not part:
            raise RuntimeError('transport EOF')
        data.extend(part)
        if len(data) > limit:
            raise RuntimeError('transport bound')
        if b'\n' in data:
            if data.count(b'\n') != 1 or not data.endswith(b'\n'):
                raise RuntimeError('transport framing')
            return json.loads(data)
    raise RuntimeError('transport deadline/interruption')


def control(mode):
    # No lease descriptor reaches this process or its descendant.
    signal.signal(signal.SIGTERM, signal.SIG_IGN if mode == 'noncomplete' else signal.SIG_DFL)
    print(json.dumps({'control': os.getpid()}), flush=True)
    if mode == 'complete':
        return 0
    pid = os.fork()
    if pid == 0:
        os.setsid()
        print(json.dumps({'control': os.getpid()}), flush=True)
    while True:
        signal.pause()


def case_owner(args):
    lease = args.lease
    os.set_inheritable(lease, False)
    st = os.fstat(lease)
    if (st.st_dev, st.st_ino) != (args.device, args.inode):
        raise RuntimeError('inherited lease mismatch')
    # Never close lease explicitly and never LOCK_UN. It lives until allowed exit.
    link = socket.socket(fileno=args.link)
    os.set_inheritable(args.link, False)
    folder = Path(args.folder)
    handlers()
    prerequisite()
    proc = None
    direct = None
    parent_lost = False
    observer_failed = False
    cleanup_errors = []
    reason = 'launch'
    output = bytearray()
    until = args.deadline
    child_tmp = folder/'tmp'
    child_tmp.mkdir(mode=0o700)
    env = dict(os.environ)
    env.update(TMPDIR=str(child_tmp), DESK_P33_NONCE=args.nonce,
               DESK_P33_RESULT=str(folder/'completion.json'))
    # The ordinary test's guard handshake must not enable child recursion.
    env.pop('DESK_P33_SOCKET', None)
    env.pop('DESK_P33_TOKEN', None)
    command = ([args.node, str(ROOT/'test/support/p33-parity-runner.ts'), '--p33-child']
               if args.mode == 'p33' else [sys.executable, str(SELF), 'control', args.mode])
    selector = selectors.DefaultSelector()
    selector.register(link, selectors.EVENT_READ, 'parent')
    try:
        if time.monotonic() >= until:
            reason = 'deadline'
            raise TimeoutError('deadline before spawn')
        proc = subprocess.Popen(command, cwd=ROOT, env=env, stdin=subprocess.DEVNULL,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                start_new_session=True, close_fds=True)
        direct = identity(proc)
        os.set_blocking(proc.stdout.fileno(), False)
        selector.register(proc.stdout, selectors.EVENT_READ, 'output')
        reason = 'deadline'
        eof = False
        direct_exit_seen = False
        while time.monotonic() < until and not INTERRUPTED:
            for key, _ in selector.select(min(.01, max(0, until-time.monotonic()))):
                if key.data == 'parent':
                    # No messages are legal before the settled result.
                    parent_lost = True
                    raise RuntimeError('parent lost or premature acknowledgement')
                data = os.read(key.fd, 4096)
                if not data:
                    selector.unregister(key.fileobj)
                    eof = True
                elif len(output) + len(data) > OUTPUT_LIMIT:
                    output.extend(data[:OUTPUT_LIMIT-len(output)])
                    reason = 'output_limit'
                    raise ValueError('output limit')
                else:
                    output.extend(data)
            status = os.waitid(os.P_PID, proc.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
            direct_exit_seen = status is not None
            if status is not None and eof:
                reason = 'child_exit'
                break
        if reason == 'deadline' and args.mode == 'p33':
            # Fixed-size supplemental observation; never substitutes for settlement.
            diagnostic = ('P33_DEADLINE ' + json.dumps({'directExitSeen': direct_exit_seen, 'stdoutEof': eof}) + '\n').encode()
            if len(output) + len(diagnostic) <= OUTPUT_LIMIT:
                output.extend(diagnostic)
        if INTERRUPTED:
            parent_lost = True
            reason = 'interrupted'
    except BaseException as error:
        if isinstance(error, TimeoutError) and proc is None and reason == 'deadline':
            pass  # The explicit pre-spawn operation deadline, not transport failure.
        elif reason == 'output_limit':
            pass
        elif proc is None:
            reason = 'launch:' + type(error).__name__
        else:
            observer_failed = True
            reason = 'observer:' + type(error).__name__
    finally:
        close_recorded(selector, 'case_selector_close', cleanup_errors)
    try:
        if proc is None:
            # No Popen child exists: require positive ECHILD and empty discovery.
            no_children = False
            try:
                os.waitpid(-1, os.WNOHANG)
            except ChildProcessError:
                no_children = True
            evidence = DiscoveryEvidence()
            rows, incomplete = owned(seconds=.025, evidence=evidence, phase='no_child')
            settlement = {'settled': no_children and not incomplete and not rows,
                          'directReaped': False, 'childStarted': False, 'noChildren': no_children,
                          'complete': not incomplete, 'reaped': [], 'residual': rows,
                          'errors': ['discovery_incomplete'] if incomplete else [],
                          'discoveryDetails': evidence.report()}
        else:
            settlement = settle(proc, direct)
            settlement['childStarted'] = True
    except BaseException as error:
        quarantine(folder, 'settlement_exception', {'error': type(error).__name__, 'cleanupErrors': cleanup_errors})
    if proc is not None and proc.stdout is not None:
        close_recorded(proc.stdout, 'case_stdout_close', cleanup_errors)
    settlement['cleanupErrors'] = cleanup_errors
    if parent_lost or observer_failed or cleanup_errors or (proc is not None and direct is None) or not settlement['settled']:
        quarantine(folder, 'parent_loss' if parent_lost else 'settlement_uncertain', settlement)
    try:
        shutil.rmtree(child_tmp)
        with open(folder/'output.log', 'xb') as stream:
            if stream.write(output) != len(output):
                raise RuntimeError('short capture write')
        controls = []
        if args.mode != 'p33':
            controls = [json.loads(line)['control'] for line in output.splitlines()]
        completed = proc is not None and reason == 'child_exit' and proc.returncode == 0
        if completed and args.mode == 'p33':
            # A zero exit is insufficient: absent/malformed/mismatched proof is
            # reporting uncertainty. Let the outer reporting handler quarantine;
            # never turn this into a contained native/test rejection.
            with open(folder/'completion.json', 'rb') as stream:
                raw = stream.read(RECORD_LIMIT+1)
            if len(raw) > RECORD_LIMIT:
                raise ValueError('completion bound')
            record = json.loads(raw)
            if record != {'protocol': 1, 'nonce': args.nonce, 'case': 'P33 multidisk',
                          'assertionsCompleted': True, 'hooksCompleted': True}:
                raise ValueError('completion mismatch')
        result = {'protocol': 1, 'nonce': args.nonce, 'mode': args.mode,
                  'outcome': 'COMPLETED' if completed else 'CONTAINED_REJECTION',
                  'reason': reason, 'controls': controls, **settlement}
        write_record(folder/'result.json', result)
        payload = (json.dumps(result)+'\n').encode()
        if len(payload) > OUTPUT_LIMIT:
            raise RuntimeError('result bound')
        link.settimeout(.25)
        link.sendall(payload)
        ack = receive_line(link, RECORD_LIMIT, time.monotonic()+.25)
        if ack != {'nonce': args.nonce, 'received': True}:
            raise RuntimeError('ack mismatch')
        if INTERRUPTED or os.getppid() != args.guard:
            raise RuntimeError('guard lost before owner exit')
        # Lease closes only at interpreter exit after settled receipt by guard.
        return 0
    except BaseException as error:
        quarantine(folder, 'report_or_guard_loss', {'error': type(error).__name__, 'settlement': settlement})


def runtime_dir():
    key = hashlib.sha256(str(ROOT).encode()).hexdigest()[:24]
    path = Path(tempfile.gettempdir())/f'the-desk-p33-{os.getuid()}-{key}'
    path.mkdir(mode=0o700, exist_ok=True)
    st = path.lstat()
    if not path.is_dir() or path.is_symlink() or st.st_uid != os.getuid() or st.st_mode & 0o077:
        raise RuntimeError('unsafe runtime directory')
    return path


class ContainedRejection(Exception):
    pass


def guard(args):
    handlers()
    directory = runtime_dir()
    # Stable inode, no truncate/unlink/replacement, no explicit LOCK_UN.
    lease = os.open(directory/'validation.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    fcntl.flock(lease, fcntl.LOCK_EX | fcntl.LOCK_NB)
    os.set_inheritable(lease, False)
    st = os.fstat(lease)
    folder = Path(tempfile.mkdtemp(prefix='attempt-', dir=directory))
    preflight = prerequisite()
    write_record(folder/'prerequisite.json', preflight)
    if args.profile == 'prerequisite':
        print(json.dumps({'prerequisite': True, 'evidence': str(folder)}), flush=True)
        return 0
    node = shutil.which('node')
    if node is None:
        raise RuntimeError('Node missing')
    node = os.path.realpath(node)
    token = secrets.token_hex(24)
    path = str(folder/'guard.sock')
    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server.bind(path)
    server.listen(1)
    server.settimeout(.025)
    env = dict(os.environ, DESK_P33_SOCKET=path, DESK_P33_TOKEN=token, DESK_P33_PROFILE=args.profile)
    test = 'test/unit/p33-parity-harness.test.ts'
    filters = {'unit': ['--exclude', 'test/integration/**', '--exclude', test],
               'all': ['--exclude', test], 'integration': ['test/integration'],
               'writer': ['test/unit/writer-fixture-input.test.ts'],
               'rest': ['--exclude', test, '--exclude', 'test/unit/writer-fixture-input.test.ts'],
               'focused': [test],
               'master046': ['test/unit/frozen-fixture046-master.test.ts'],
               'parity': ['test/unit/fixture-pack-extraction-parity.test.ts'], 'p33': ['test/unit/fixture-pack-extraction-parity.test.ts',
                   '--testNamePattern', '^P28-P37 legacy formats, freshness and discarded faults P33 multidisk$']}
    command = [node, str(ROOT/'node_modules/vitest/vitest.mjs'), 'run', *filters[args.profile]]
    # Node modules can be installed in an ancestor in a static review checkout.
    if not Path(command[1]).is_file():
        raise RuntimeError('local Vitest entrypoint missing; install required dependencies')
    main_proc = subprocess.Popen(command, cwd=ROOT, env=env, stdin=subprocess.DEVNULL,
                                 start_new_session=True, close_fds=True)
    main_identity = None
    parent = os.getppid()
    fatal = None
    rejected = None
    cleanup_errors = []
    try:
        main_identity = identity(main_proc)
        while not INTERRUPTED:
            if os.getppid() != parent:
                raise RuntimeError('guard parent loss')
            status = os.waitid(os.P_PID, main_proc.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
            if status is not None:
                break
            try:
                client, _ = server.accept()
            except socket.timeout:
                continue
            with client:
                request_started = time.monotonic()
                req = receive_line(client, RECORD_LIMIT, request_started+.25)
                if (set(req) != {'protocol', 'nonce', 'mode', 'token'} or req['protocol'] != 1 or
                    req['token'] != token or not isinstance(req['nonce'], str) or
                    len(req['nonce']) != 48 or any(c not in '0123456789abcdef' for c in req['nonce'])):
                    raise RuntimeError('request identity')
                mode = req['mode']
                if mode not in ('p33', 'complete', 'noncomplete') or (mode != 'p33' and args.profile != 'focused'):
                    raise RuntimeError('request mode')
                case_folder = folder/req['nonce']
                case_folder.mkdir(mode=0o700)
                left, right = socket.socketpair()
                owner_command = [sys.executable, str(SELF), 'owner', '--lease', str(lease),
                                 '--device', str(st.st_dev), '--inode', str(st.st_ino),
                                 '--link', str(right.fileno()), '--folder', str(case_folder),
                                 '--node', node, '--mode', mode, '--nonce', req['nonce'], '--guard', str(os.getpid()),
                                 '--deadline', str(request_started+2)]
                owner = subprocess.Popen(owner_command, cwd=ROOT, stdin=subprocess.DEVNULL,
                                         close_fds=True, pass_fds=(lease, right.fileno()), start_new_session=True)
                right.close()
                identity(owner)
                response = bytearray()
                end = request_started+3.75
                selector = selectors.DefaultSelector()
                selector.register(client, selectors.EVENT_READ, 'client')
                selector.register(left, selectors.EVENT_READ, 'owner')
                result = None
                try:
                    while time.monotonic() < end and not INTERRUPTED:
                        if os.getppid() != parent:
                            raise RuntimeError('guard parent loss')
                        for key, _ in selector.select(.01):
                            if key.data == 'client':
                                raise RuntimeError('client lost or extra request')
                            part = left.recv(4096)
                            if not part:
                                raise RuntimeError('owner lost')
                            response.extend(part)
                            if len(response) > OUTPUT_LIMIT:
                                raise RuntimeError('owner result bound')
                            if response.endswith(b'\n'):
                                result = json.loads(response)
                                break
                        if result is not None:
                            break
                    if (result is None or result.get('nonce') != req['nonce'] or
                        result.get('mode') != mode or not result.get('settled') or
                        not result.get('noChildren') or not result.get('complete') or
                        result.get('errors') or result.get('residual') or
                        result.get('outcome') not in ('COMPLETED', 'CONTAINED_REJECTION')):
                        raise RuntimeError('owner settlement missing')
                    left.settimeout(.1)
                    left.sendall((json.dumps({'nonce': req['nonce'], 'received': True})+'\n').encode())
                    while time.monotonic() < end:
                        status = os.waitid(os.P_PID, owner.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
                        if status is not None:
                            break
                        time.sleep(.005)
                    else:
                        raise RuntimeError('owner exit deadline')
                    pid, raw = os.waitpid(owner.pid, os.WNOHANG)
                    if pid != owner.pid or raw != 0:
                        raise RuntimeError('owner exit failure')
                    owner.returncode = 0
                    # Outer still owns main Vitest: no false global ECHILD claim.
                    client.settimeout(.1)
                    client.sendall(response)
                    if mode == 'p33' and result['outcome'] != 'COMPLETED':
                        raise ContainedRejection('real P33 contained rejection; stop validation')
                finally:
                    close_recorded(selector, 'guard_selector_close', cleanup_errors)
                    close_recorded(left, 'guard_owner_link_close', cleanup_errors)
                if cleanup_errors:
                    raise RuntimeError('guard request cleanup failed')
        if INTERRUPTED:
            raise RuntimeError('guard interrupted')
    except ContainedRejection as error:
        rejected = str(error)
    except BaseException as error:
        fatal = type(error).__name__ + ':' + str(error)
    finally:
        close_recorded(server, 'guard_server_close', cleanup_errors)
    if cleanup_errors:
        fatal = fatal or 'guard_cleanup_failure'
    if fatal or rejected:
        try:
            os.killpg(main_proc.pid, signal.SIGSTOP)
        except BaseException as error:
            fatal = fatal or 'stop_failed:' + type(error).__name__
    settlement = settle(main_proc, main_identity)
    try:
        write_record(folder/'guard-result.json', {'fatal': fatal, 'containedRejection': rejected, 'cleanupErrors': cleanup_errors, **settlement})
    except BaseException:
        quarantine(folder, 'guard evidence failure', settlement)
    if not settlement['settled']:
        quarantine(folder, fatal or 'guard settlement uncertain', settlement)
    return 1 if fatal or rejected or main_proc.returncode != 0 else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='role', required=True)
    g = sub.add_parser('guard')
    g.add_argument('profile', choices=['prerequisite', 'focused', 'p33', 'parity', 'unit', 'integration', 'all', 'writer', 'rest', 'master046'])
    o = sub.add_parser('owner')
    for key in ('lease', 'device', 'inode', 'link', 'guard'):
        o.add_argument('--'+key, type=int, required=True)
    for key in ('folder', 'node', 'nonce'):
        o.add_argument('--'+key, required=True)
    o.add_argument('--deadline', type=float, required=True)
    o.add_argument('--mode', choices=['p33', 'complete', 'noncomplete'], required=True)
    c = sub.add_parser('control')
    c.add_argument('mode', choices=['complete', 'noncomplete'])
    args = parser.parse_args()
    if args.role == 'control':
        return control(args.mode)
    if args.role == 'owner':
        return case_owner(args)
    return guard(args)


if __name__ == '__main__':
    raise SystemExit(main())
