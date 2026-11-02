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
import stat as stat_module
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


PRIVATE_WRITE_PENDING = []
PRIVATE_WRITE_SECONDARY = []


def write_private(path, data, *, sync):
    """Exclusive private creation; close uncertainty blocks later writer I/O."""
    if PRIVATE_WRITE_PENDING:
        raise RuntimeError('private writer pending close')
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    primary=None
    try:
        info=os.fstat(fd)
        if not stat_module.S_ISREG(info.st_mode) or info.st_uid!=os.getuid() or info.st_nlink!=1 or stat_module.S_IMODE(info.st_mode)!=0o600:
            raise RuntimeError('private writer mode/identity')
        if os.write(fd,data)!=len(data):
            raise RuntimeError('short record write')
        if sync:os.fsync(fd)
    except BaseException as error:primary=error
    try:os.close(fd)
    except BaseException as error:
        PRIVATE_WRITE_PENDING.append(fd)
        if primary is None:primary=error
        else:PRIVATE_WRITE_SECONDARY.append(type(error).__name__)
    if primary is not None:raise primary


def write_record(path, value, limit=OUTPUT_LIMIT):
    data = (json.dumps(value, separators=(",", ":")) + "\n").encode()
    if len(data) > limit:
        raise RuntimeError("record bound")
    write_private(path,data,sync=True)


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
        write_private(folder/'output.log',output,sync=False)
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


def runtime_basename(exclusive=False):
    key = hashlib.sha256(str(ROOT).encode()).hexdigest()[:24]
    prefix = 'p33t-' if exclusive else 'p33-'
    return f'{prefix}{os.getuid()}-{key}'


def guard_socket_path(folder):
    path=str(folder/'guard.sock')
    encoded=os.fsencode(path)
    if b'\0' in encoded or len(encoded)+1>108:
        raise RuntimeError('guard socket pathname bound')
    return path


def runtime_dir(exclusive=False):
    path = Path(tempfile.gettempdir())/runtime_basename(exclusive)
    path.mkdir(mode=0o700, exist_ok=not exclusive)
    st = path.lstat()
    if not path.is_dir() or path.is_symlink() or st.st_uid != os.getuid() or st.st_mode & 0o077:
        raise RuntimeError('unsafe runtime directory')
    return path


class ContainedRejection(Exception):
    pass


def guard(args):
    handlers()
    directory = runtime_dir(exclusive=args.profile == 'fixture105-traversal')
    # Stable inode, no truncate/unlink/replacement, no explicit LOCK_UN.
    lease = os.open(directory/'validation.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    fcntl.flock(lease, fcntl.LOCK_EX | fcntl.LOCK_NB)
    os.set_inheritable(lease, False)
    st = os.fstat(lease)
    folder = Path(tempfile.mkdtemp(prefix='attempt-', dir=directory))
    path = guard_socket_path(folder)
    def namespace_identity(path):
        value=path.lstat()
        if not stat_module.S_ISDIR(value.st_mode) or value.st_uid!=os.getuid() or stat_module.S_IMODE(value.st_mode)!=0o700:
            raise RuntimeError('guard namespace identity')
        return {'path':str(path),'dev':value.st_dev,'ino':value.st_ino,'uid':value.st_uid,'gid':value.st_gid,'mode':stat_module.S_IMODE(value.st_mode)}
    namespace = {'runtime':namespace_identity(directory),'attempt':namespace_identity(folder)} if args.profile=='fixture105-traversal' else None
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
               'technical-master': ['test/unit/technical-master-admission.test.ts'],
               'technical-master-pure': ['test/unit/technical-master-admission.test.ts'],
               'durable-pair-pure': ['test/unit/durable-pair.test.ts', 'test/unit/durable-pair-transport.test.ts'],
               'command-postgres': ['test/integration/g2-command-connection.test.ts'],
               'fixture105-unknown': ['test/integration/connected-fixture105.test.ts', '--testNamePattern', '^connected fixture105 native ownership holds unknown construction commit without inventing its missing settlement receipt$'],
               'fixture105-isolation': ['test/integration/connected-fixture105.test.ts', '--testNamePattern', '^connected fixture105 native ownership (retains durable direction if the separate audit transaction fails|rolls back package creation when a foreign observation identity wins late)$'],
               'fixture105-native': ['test/integration/connected-fixture105.test.ts'],
               'runtime-observe': ['test/runtime-observe.test.ts'],
               'fixture105-traversal': ['test/unit/fixture105-traversal.test.ts'],
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
        write_record(folder/'guard-result.json', {'fatal': fatal, 'containedRejection': rejected, 'cleanupErrors': cleanup_errors, **settlement, **({'namespace':namespace} if namespace is not None else {})})
    except BaseException:
        quarantine(folder, 'guard evidence failure', settlement)
    if not settlement['settled']:
        quarantine(folder, fatal or 'guard settlement uncertain', settlement)
    return 1 if fatal or rejected or main_proc.returncode != 0 else 0


# Fixed restored-stage adapter. No caller-selected executable, path or deadline.
STAGE_PHASES = ('PREP', 'BIND', 'GUARD', 'CHECK')
STAGE_STREAM_CAP = 67108864
STAGE_SIGNALS = (signal.SIGINT, signal.SIGTERM, signal.SIGHUP)
STAGE_READER = None
STAGE_CI = None


def stage_read(path, limit):
    global STAGE_READER
    if STAGE_READER is None:
        import runpy
        STAGE_READER = runpy.run_path(str(ROOT/'tools/ci-validation/installation.py'),run_name='stage_reader_definitions')['read']
    return STAGE_READER(path,limit)


def stage_record(path, value):
    # Existing partial-retention json-sort-spaces-lf/1 encoding; no new recipe.
    raw = (json.dumps(value,sort_keys=True)+'\n').encode()
    if len(raw)>OUTPUT_LIMIT:raise RuntimeError('stage record bound')
    write_private(path,raw,sync=True)


def stage_partition():
    value = os.environ.get('DESK_CI_PARTITION')
    if value not in ('writer','rest'):raise RuntimeError('stage partition')
    return value


def stage_ci():
    global STAGE_CI
    if STAGE_CI is None:
        import runpy
        STAGE_CI = runpy.run_path(str(ROOT/'tools/ci-validation/ci.py'),run_name='stage_ci_definitions')
    return STAGE_CI


def stage_guard_url(stage, partition, env):
    value = env.get('TEST_DATABASE_URL')
    if stage == 'all' and partition == 'rest':
        try:stage_ci()['validate_db_url'](value)
        except Exception:raise RuntimeError('stage disposable database') from None
    elif value is not None:raise RuntimeError('stage unexpected database')
    return value


def stage_argv(stage, phase, partition=None):
    if stage not in ('prerequisite', 'focused', 'all') or phase not in STAGE_PHASES:
        raise RuntimeError('stage command map')
    partition = stage_partition() if partition is None else partition
    if partition not in ('writer','rest'):raise RuntimeError('stage partition')
    if phase == 'GUARD':
        return ['/usr/bin/timeout', '--signal=TERM', '--kill-after=20',
                '30' if stage == 'prerequisite' else '120' if stage == 'focused' else '7200', '/usr/bin/python3',
                'test/support/p33-parity-supervisor.py', 'guard', partition if stage == 'all' else stage]
    return ['/usr/bin/python3', '-I', '-B', 'tools/ci-validation/ci.py',
            {'PREP':'precheck', 'BIND':'fixture-binding', 'CHECK':'check'}[phase], stage]


def stage_private(path):
    info = path.lstat()
    if (path.resolve(strict=True) != path or not stat_module.S_ISDIR(info.st_mode)
            or info.st_uid != os.getuid() or stat_module.S_IMODE(info.st_mode) != 0o700):
        raise RuntimeError('stage private directory')
    return {'path':str(path), 'dev':info.st_dev, 'ino':info.st_ino, 'uid':info.st_uid, 'mode':0o700}


def stage_umask():
    # Read without changing the inherited mask; only add restriction bits.
    def current():
        with Path('/proc/self/status').open('rb') as stream:raw = stream.read(65537)
        if len(raw)>65536:raise RuntimeError('stage umask read bound')
        rows = [line.split() for line in raw.splitlines() if line.startswith(b'Umask:')]
        if (len(rows)!=1 or len(rows[0])!=2 or rows[0][0]!=b'Umask:' or len(rows[0][1])!=4
                or rows[0][1][:1]!=b'0' or any(c not in b'01234567' for c in rows[0][1])):
            raise RuntimeError('stage umask record')
        return int(rows[0][1],8)
    observed = current()
    if observed & ~0o077:raise RuntimeError('stage umask restriction')
    os.umask(0o077)
    if current()!=0o077:raise RuntimeError('stage umask effective')


def stage_parent(expected, death_signal):
    """Register parent death and corroborate both sides of pidfd acquisition."""
    import select
    if type(expected) is not dict or set(expected) != {'pid','start'} or expected['pid'] <= 1:
        raise RuntimeError('stage parent identity')
    if ctypes.CDLL(None,use_errno=True).prctl(1,death_signal,0,0,0) != 0:
        raise RuntimeError('stage parent death registration')
    fd = os.pidfd_open(expected['pid'])
    try:
        if (os.getppid() != expected['pid'] or stat(expected['pid'])['start'] != expected['start']
                or select.select([fd],[],[],0)[0]):
            raise RuntimeError('stage parent registration race')
    except BaseException as primary:
        try:os.close(fd)
        except BaseException as secondary:
            PRIVATE_WRITE_PENDING.append(fd);PRIVATE_WRITE_SECONDARY.append(type(secondary).__name__)
        raise primary
    return fd


def stage_parent_live(expected, fd):
    import select
    return (os.getppid() == expected['pid'] and not select.select([fd],[],[],0)[0]
            and stat(expected['pid'])['start'] == expected['start'])


def stage_child(args):
    """An execed bootstrap waits for authorization; Popen preexec_fn never waits."""
    stage_argv(args.stage,args.phase)
    if args.partition != stage_partition():raise RuntimeError('stage child partition')
    if args.phase == 'GUARD':stage_guard_url(args.stage,args.partition,os.environ)
    elif 'TEST_DATABASE_URL' in os.environ:raise RuntimeError('stage phase database')
    if len(args.nonce) != 48 or any(c not in '0123456789abcdef' for c in args.nonce):
        raise RuntimeError('stage nonce')
    parent = {'pid':args.parent,'start':args.start}
    parent_fd = stage_parent(parent,signal.SIGKILL)
    link = socket.socket(fileno=args.link)
    os.set_inheritable(args.link,False)
    primary = None
    try:
        row = stat(os.getpid())
        ready = {'nonce':args.nonce,'phase':args.phase,'stage':args.stage,'partition':args.partition,
                 'pid':row['pid'],'start':row['start'],'ppid':row['ppid']}
        link.sendall((json.dumps(ready,separators=(',',':'))+'\n').encode())
        grant = receive_line(link,4096,time.monotonic()+5)
        if (type(grant) is not dict or type(grant.get('grant')) is not bool
                or grant != {'nonce':args.nonce,'phase':args.phase,'stage':args.stage,'partition':args.partition,'grant':True}):
            raise RuntimeError('stage grant framing')
        # EOF after one complete grant excludes duplicate/trailing authorization.
        link.settimeout(.25)
        if link.recv(1) != b'' or not stage_parent_live(parent,parent_fd):
            raise RuntimeError('stage grant parent or trailing data')
    except BaseException as error:primary = error
    finally:
        for resource in (link,parent_fd):
            try:
                if type(resource) is int:os.close(resource)
                else:resource.close()
            except BaseException as error:
                if primary is None:primary = error
                else:PRIVATE_WRITE_SECONDARY.append(type(error).__name__)
    if primary is not None:raise primary
    os.execve(stage_argv(args.stage,args.phase)[0],stage_argv(args.stage,args.phase),dict(os.environ))


class StageOwner:
    """Three fixed grants (or one CHECK), one waiter, one total monotonic budget."""
    def __init__(self, stage, checking, started):
        self.stage = stage; self.checking = checking; self.partition = stage_partition()
        self.deadline = started + (90 if checking else 150 if stage == 'prerequisite' else 240 if stage == 'focused' else 7280)
        self.final_deadline = self.deadline + 20
        self.cancelled = False; self.failed = False; self.grant_committed = False
        self.errors = []; self.pending = []; self.actions = []
        self.identity = stat(os.getpid())
        self.parent = {'pid':os.getppid(),'start':stat(os.getppid())['start']}
        # PDEATHSIG follows the creating thread, not the parent process. Clear
        # any inherited hook (including bootstrap SIGKILL across exec); outer
        # ownership uses pidfd/PPID/start checks. Genuine TERM stays sticky.
        self.parent_fd = stage_parent(self.parent,0)
        self.directory = None; self.base = None; self.root_identity = None

    def barrier(self):
        try:
            live = stage_parent_live(self.parent,self.parent_fd)
        except BaseException:
            live = False
        if stage_partition()!=self.partition:self.failed = True
        if INTERRUPTED or not live:
            self.cancelled = True
        if self.root_identity is not None and stage_private(ROOT)!=self.root_identity:self.failed = True
        if (self.cancelled or self.failed or self.errors or self.pending or PRIVATE_WRITE_PENDING
                or time.monotonic() >= self.deadline):
            raise RuntimeError('stage launch barrier')

    def close(self, value, label):
        try:
            if type(value) is int:os.close(value)
            else:value.close()
        except BaseException as error:
            self.errors.append(label+':'+type(error).__name__)
            self.pending.append(value)  # No retry or destructor-based release proof.

    def grant(self, link, ready, direct, phase, nonce):
        expected = {'nonce':nonce,'phase':phase,'stage':self.stage,'partition':self.partition,
                    'pid':direct['pid'],'start':direct['start'],'ppid':os.getpid()}
        if type(ready) is not dict or ready != expected:
            raise RuntimeError('stage ready identity')
        mask = signal.pthread_sigmask(signal.SIG_BLOCK,STAGE_SIGNALS)
        primary = None
        try:
            if set(signal.sigpending()) & set(STAGE_SIGNALS):self.cancelled = True
            self.barrier()
            # Linearization: a concurrently arriving masked signal belongs to an
            # already-owned committed phase. Restoring the mask observes it next.
            grant = {'nonce':nonce,'phase':phase,'stage':self.stage,'partition':self.partition,'grant':True}
            self.grant_committed = True
            link.sendall((json.dumps(grant,separators=(',',':'))+'\n').encode())
            link.shutdown(socket.SHUT_WR)
        except BaseException as error:primary = error
        finally:
            try:signal.pthread_sigmask(signal.SIG_SETMASK,mask)
            except BaseException as error:
                self.errors.append('signal-mask-restore:'+type(error).__name__)
                if primary is None:primary = error
        if primary is not None:raise primary

    def phase(self, phase, env, output=None):
        self.barrier()
        if env.get('DESK_CI_PARTITION')!=self.partition:raise RuntimeError('stage phase partition')
        credential = stage_guard_url(self.stage,self.partition,env) if phase=='GUARD' else None
        if phase!='GUARD' and 'TEST_DATABASE_URL' in env:raise RuntimeError('stage phase database')
        if self.actions and not self.actions[-1]['settled']:
            raise RuntimeError('stage predecessor unsettled')
        self.grant_committed = False
        directory = self.directory/phase
        directory.mkdir(mode=0o700)
        proc = None; direct = None; primary = None; settlement = None; granted = False
        launch = None; spawn_attempted = False
        links = []; streams = {}; raw_files = {}; selector = None
        observed = {'stdout':0,'stderr':0}; eof = {'stdout':False,'stderr':False}
        hashes = {name:hashlib.sha256() for name in observed}
        nonce = secrets.token_hex(24)
        try:
            selector = selectors.DefaultSelector()
            for name in observed:
                path = (output if output is not None else directory)/name
                fd = os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
                try:raw_files[name] = os.fdopen(fd,'wb',buffering=0)
                except BaseException:
                    self.close(fd,name+'-open-close')
                    raise
            left,right = socket.socketpair();links = [left,right]
            self.barrier()
            argv = ['/usr/bin/python3','-I','-B',str(SELF),'stage-child','--stage',self.stage,
                    '--partition',self.partition,'--phase',phase,'--link',str(right.fileno()),'--parent',str(os.getpid()),
                    '--start',str(stat(os.getpid())['start']),'--nonce',nonce]
            spawn_attempted = True
            proc = subprocess.Popen(argv,cwd=ROOT,env=env,stdin=subprocess.DEVNULL,
                    stdout=subprocess.PIPE,stderr=subprocess.PIPE,close_fds=True,
                    pass_fds=(right.fileno(),),start_new_session=True)
            self.close(right,'control-child-close');links.remove(right)
            # Bootstrap may have been forked concurrently with cancellation, but
            # no command can exec until identity is retained and GRANT is sent.
            direct = identity(proc)
            if direct['pgid'] != proc.pid or direct['sid'] != proc.pid:
                raise RuntimeError('stage direct session')
            launch = {'pid':proc.pid,'pgid':proc.pid,'identity':direct,'argv':stage_argv(self.stage,phase,self.partition)}
            stage_record(directory/'process.json',launch)
            for name in observed:
                streams[name] = getattr(proc,name)
                os.set_blocking(streams[name].fileno(),False)
                selector.register(streams[name],selectors.EVENT_READ,name)
            self.barrier()
            ready = receive_line(left,4096,min(self.deadline,time.monotonic()+5))
            self.grant(left,ready,direct,phase,nonce);granted = True
            self.close(left,'control-owner-close');links.remove(left)
            while True:
                self.barrier()
                self.pump(selector,raw_files,observed,hashes,eof,.025)
                # Reserve the leader through the last group signal; only settle
                # consumes waits. Popen.poll()/wait() would violate this contract.
                status = os.waitid(os.P_PID,proc.pid,os.WEXITED|os.WNOHANG|os.WNOWAIT)
                if status is not None and all(eof.values()):break
        except BaseException as error:
            primary = error
        finally:
            if spawn_attempted and proc is None:self.pending.append('spawn-outcome-uncertain')
            if proc is not None:
                if direct is None:
                    try:direct = identity(proc)
                    except BaseException as error:self.errors.append('direct-identity:'+type(error).__name__)
                if direct is not None:
                    try:
                        settlement = settle(proc,direct,budget=min(10,max(0,self.final_deadline-time.monotonic())))
                        if not settlement['settled']:self.pending.append(proc)
                    except BaseException as error:
                        settlement = None
                        self.errors.append('settlement:'+type(error).__name__);self.pending.append(proc)
                        if primary is None:primary = error
                else:self.pending.append(proc)
                # After identity-safe settlement, drain the retained pipes to EOF.
                until = min(self.final_deadline,time.monotonic()+1)
                try:
                    while selector is not None and not all(eof.values()) and time.monotonic()<until:
                        self.pump(selector,raw_files,observed,hashes,eof,.025)
                except BaseException as error:self.errors.append('drain:'+type(error).__name__)
                for name in observed:
                    pipe = getattr(proc,name,None)
                    if pipe is not None:self.close(pipe,name+'-pipe-close')
            for link in links:self.close(link,'control-close')
            if selector is not None:self.close(selector,'selector-close')
            for name,stream in raw_files.items():
                try:os.fsync(stream.fileno())
                except BaseException as error:self.errors.append(name+'-sync:'+type(error).__name__)
                self.close(stream,name+'-file-close')
        try:
            for name in observed:
                raw = stage_read((output if output is not None else directory)/name,STAGE_STREAM_CAP)
                if stage_ci()['redact'](raw,[credential or '']) != raw:raise RuntimeError('stage credential output')
        except BaseException as error:
            if primary is None:primary = error
            else:self.errors.append('output-check:'+type(error).__name__)
        clean = bool(settlement and settlement['settled'] and all(eof.values()) and not self.errors and not self.pending)
        value = {'phase':phase,'argv':stage_argv(self.stage,phase,self.partition),'granted':self.grant_committed,'launch':launch,
                 'exit':None if proc is None else proc.returncode,
                 'primary':None if primary is None else type(primary).__name__,
                 'settled':clean,'settlement':settlement,'cleanupErrors':list(self.errors),
                 'streams':{name:{'eof':eof[name],'bytes':observed[name],'sha256':hashes[name].hexdigest()} for name in observed}}
        self.actions.append(value)
        self.failed = primary is not None or not clean or proc is None or proc.returncode != 0
        try:stage_record(directory/'owner.json',value)
        except BaseException as error:
            self.failed = True;self.errors.append('phase-record:'+type(error).__name__)
            if primary is None:primary = error
        if primary is not None:raise primary
        if not clean or proc.returncode != 0:raise RuntimeError('stage phase failure')
        self.barrier()
        return value

    def pump(self, selector, files, observed, hashes, eof, delay):
        for key,_ in selector.select(delay):
            name = key.data
            try:block = os.read(key.fileobj.fileno(),65536)
            except BlockingIOError:continue
            if not block:
                eof[name] = True;selector.unregister(key.fileobj);continue
            observed[name] += len(block)
            if observed[name] > STAGE_STREAM_CAP:raise RuntimeError('stage stream bound')
            if files[name].write(block) != len(block):raise RuntimeError('stage short capture')
            hashes[name].update(block)


def stage_attempts(base):
    names = []
    for runtime in (base/'tmp').glob('p33-*'):
        stage_private(runtime)
        for attempt in runtime.glob('attempt-*'):
            stage_private(attempt);names.append(attempt.name)
            if len(names)>16:raise RuntimeError('stage attempt bound')
    return ''.join(name+'\n' for name in sorted(names)).encode()


def stage_snapshot(path):
    # Supplemental only, like the former ps command; no argv or cleanup claim.
    evidence = DiscoveryEvidence();now = time.monotonic()
    scan = DiscoveryScan(evidence,'snapshot',now,now+.25,now+.25,None,now)
    rows = pid_table(scan,4096);bad = scan.finish()
    raw = ''.join(f"{r['pid']} {r['ppid']} {r['pgid']} {r['state']} process\n" for r in rows.values()).encode()
    write_private(path,raw,sync=True)
    return 1 if bad else 0


def stage_owner(stage, checking=False):
    import resource
    started = time.monotonic()  # Includes setup, every grant and normal settlement.
    stage_argv(stage,'CHECK' if checking else 'PREP')
    handlers();owner = None;primary = None;directory = None
    try:
        owner = StageOwner(stage,checking,started)
        owner.barrier()
        if (ROOT != Path('/tmp/e') or Path.cwd()!=ROOT or os.environ.get('GITHUB_ACTIONS')!='true'
                or os.environ.get('ImageOS')!='ubuntu24' or os.environ.get('DESK_CI_PARTITION') not in ('writer','rest')):
            raise RuntimeError('stage hosted role')
        runner = Path(os.environ['RUNNER_TEMP']);role = Path(os.environ['DESK_CI_ROLE_TEMP'])
        if (not runner.is_absolute() or runner.resolve()!=runner or str(runner)!=os.environ['RUNNER_TEMP']
                or str(role)!=os.environ['DESK_CI_ROLE_TEMP'] or role!=runner/'evaluation' or role.resolve()!=role):raise RuntimeError('stage role route')
        base = role/'ci';owner.base = base;owner.root_identity = stage_private(ROOT)
        for path in (base,base/'tmp',base/'home',base/'evidence'):stage_private(path)
        stage_umask()
        candidate = base/'evidence'/('stage-check' if checking else 'stage-owner')/stage
        # Parent is a closed three-stage namespace; its exact role parent is private.
        namespace = candidate.parent
        try:namespace.mkdir(mode=0o700)
        except FileExistsError:stage_private(namespace)
        candidate.mkdir(mode=0o700);directory = candidate;owner.directory = directory
        resource.setrlimit(resource.RLIMIT_CORE,(0,0));resource.setrlimit(resource.RLIMIT_FSIZE,(STAGE_STREAM_CAP,STAGE_STREAM_CAP))
        if (resource.getrlimit(resource.RLIMIT_CORE)!=(0,0)
                or resource.getrlimit(resource.RLIMIT_FSIZE)!=(STAGE_STREAM_CAP,STAGE_STREAM_CAP)):
            raise RuntimeError('stage resource limits')
        prerequisite()  # Capability/subreaper only; real PREP and GUARD still run.
        env = dict(os.environ);env.pop('TEST_DATABASE_URL',None)
        if checking:
            stage_previous_owner(base,stage)
            owner.phase('CHECK',env)
        else:
            owner.phase('PREP',env)
            owner.phase('BIND',env)
            binding_raw = stage_read(directory/'BIND/stdout',8192)
            binding = json.loads(binding_raw)
            if (type(binding) is not dict or set(binding)!={'root','root_sha256'}
                    or binding['root']!=str(base/'tmp/desk-connected-fixture105')
                    or type(binding['root_sha256']) is not str or len(binding['root_sha256'])!=64
                    or any(c not in '0123456789abcdef' for c in binding['root_sha256'])):
                raise RuntimeError('stage binding wire')
            output = base/'evidence'/stage;output.mkdir(mode=0o700)
            write_private(output/'limits.txt',b'core 0 0\nfsize 67108864 67108864\n',sync=True)
            write_private(output/'pre-attempts',stage_attempts(base),sync=True)
            write_private(output/'started-utc',(time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())+'\n').encode(),sync=True)
            pre = stage_snapshot(output/'ps-pre.txt')
            node = shutil.which('node')
            if node is None:raise RuntimeError('stage Node missing')
            guard_env = {name:os.environ[name] for name in ('RUNNER_TEMP','DESK_CI_ROLE_TEMP','DESK_CI_PARTITION',
                         'GITHUB_SHA','GITHUB_REPOSITORY','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT')}
            guard_env.update(PATH=str(Path(node).parent)+':/usr/bin:/bin',HOME=str(base/'home'),TMPDIR=str(base/'tmp'),
                             LANG='C.UTF-8',LC_ALL='C.UTF-8',TZ='UTC',CI='true',DESK_FIXTURE105_BINDING=json.dumps(binding,separators=(',',':')))
            if stage=='all' and owner.partition=='rest':guard_env['TEST_DATABASE_URL']=os.environ.get('TEST_DATABASE_URL','')
            stage_guard_url(stage,owner.partition,guard_env)
            if 'RUNNER_TRACKING_ID' in os.environ:guard_env['RUNNER_TRACKING_ID']=os.environ['RUNNER_TRACKING_ID']
            guard_error = None
            try:owner.phase('GUARD',guard_env,output)
            except BaseException as error:guard_error = error
            # Post records are attempted without replacing the phase primary.
            post = 1
            try:post = stage_snapshot(output/'ps-post.txt')
            except BaseException as error:owner.errors.append('post-snapshot:'+type(error).__name__)
            action = owner.actions[-1] if owner.actions and owner.actions[-1]['phase']=='GUARD' else None
            records = [('ended-utc',lambda:(time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())+'\n').encode()),
                       ('post-attempts',lambda:stage_attempts(base)),
                       ('snapshot-status.txt',lambda:f'ps-pre {pre}\nps-post {post}\n'.encode())]
            if action is not None and type(action['exit']) is int:records.append(('exit',lambda:(str(action['exit'])+'\n').encode()))
            for name,raw in records:
                try:write_private(output/name,raw(),sync=True)
                except BaseException as error:owner.errors.append(name+':'+type(error).__name__)
            if guard_error is not None:raise guard_error
        owner.barrier()
        if stage_private(ROOT)!=owner.root_identity:raise RuntimeError('stage source root changed')
    except BaseException as error:primary = error
    finally:
        if owner is not None:
            return stage_finish(owner,primary,directory)
    return 1


def stage_finish(owner, primary, directory):
    # This durable record is provisional: final process exit and fresh CHECK
    # remain necessary. Keep parent monitoring live through all reporting.
    result = {'stage':owner.stage,'partition':owner.partition,'checking':owner.checking,
              'success':primary is None and not owner.failed and not owner.errors and not owner.pending and not owner.cancelled and not INTERRUPTED and not PRIVATE_WRITE_PENDING,
              'primary':None if primary is None else type(primary).__name__,'cleanupErrors':owner.errors,
              'cancelled':owner.cancelled or INTERRUPTED,'pending':len(owner.pending)+len(PRIVATE_WRITE_PENDING),
              'parent':owner.parent,'identity':owner.identity,'root':owner.root_identity,'actions':owner.actions}
    def failed(label,error):
        nonlocal primary
        owner.errors.append(label+':'+type(error).__name__)
        if primary is None:primary = error
        result['success']=False;result['primary']=type(primary).__name__
    try:
        if directory is not None:write_record(directory/'owner.json',result)
    except BaseException as error:failed('terminal-record',error)
    result['pending']=len(owner.pending)+len(PRIVATE_WRITE_PENDING)
    try:print(json.dumps(result),file=sys.stderr,flush=True)
    except BaseException as error:failed('terminal-print',error)
    # One fresh decision after reporting, with the parent pidfd still open.
    try:live = stage_parent_live(owner.parent,owner.parent_fd)
    except BaseException as error:
        live = False;failed('final-parent',error)
    try:
        if stage_private(ROOT)!=owner.root_identity:raise RuntimeError('stage final root changed')
    except BaseException as error:failed('final-root',error)
    try:
        if stage_partition()!=owner.partition:raise RuntimeError('stage partition changed')
    except BaseException as error:failed('final-partition',error)
    owner.cancelled = owner.cancelled or INTERRUPTED or not live
    if time.monotonic()>=owner.final_deadline:owner.errors.append('final-deadline')
    success = (primary is None and not owner.failed and not owner.cancelled and not owner.errors
               and not owner.pending and not PRIVATE_WRITE_PENDING)
    owner.close(owner.parent_fd,'parent-pidfd-close')
    # Close cannot authorize success; late errors/cancellation only revoke it.
    if time.monotonic()>=owner.final_deadline and 'final-deadline' not in owner.errors:owner.errors.append('final-deadline')
    result['pending']=len(owner.pending)+len(PRIVATE_WRITE_PENDING)
    result['cancelled']=owner.cancelled or INTERRUPTED
    result['success']=success and not owner.errors and not result['pending'] and not INTERRUPTED
    if result['pending']:
        quarantine(directory,'stage_owner_pending',result)
    return 0 if result['success'] else 1


def stage_previous_owner(base, stage):
    directory = base/'evidence/stage-owner'/stage
    value = json.loads(stage_read(directory/'owner.json',65536))
    keys = {'stage','partition','checking','success','primary','cleanupErrors','cancelled','pending','parent','identity','root','actions'}
    if (type(value) is not dict or set(value)!=keys or value['stage']!=stage or value['partition']!=stage_partition() or value['checking'] is not False
            or value['success'] is not True or value['primary'] is not None or value['cleanupErrors']!=[]
            or value['cancelled'] is not False or type(value['pending']) is not int or value['pending']!=0
            or value['root']!=stage_private(ROOT) or type(value['actions']) is not list
            or [a['phase'] for a in value['actions']]!=['PREP','BIND','GUARD']):
        raise RuntimeError('stage owner not settled')
    for action in value['actions']:
        phase = action['phase'];settlement = action['settlement']
        if (set(action)!={'phase','argv','granted','launch','exit','primary','settled','settlement','cleanupErrors','streams'}
                or type(action['exit']) is not int or action['exit']!=0 or action['primary'] is not None
                or action['cleanupErrors']!=[] or action['settled'] is not True or action['granted'] is not True
                or action['argv']!=stage_argv(stage,phase) or set(action['streams'])!={'stdout','stderr'}
                or any(set(v)!={'eof','bytes','sha256'} or v['eof'] is not True for v in action['streams'].values())
                or any(settlement.get(k) is not True for k in ('settled','directReaped','noChildren','complete'))
                or settlement.get('errors')!=[] or settlement.get('residual')!=[]):
            raise RuntimeError('stage phase not settled')
        recorded = json.loads(stage_read(directory/phase/'owner.json',65536))
        process = json.loads(stage_read(directory/phase/'process.json',65536))
        if (recorded!=action or process!=action['launch'] or set(process)!={'pid','pgid','identity','argv'} or process['argv']!=action['argv']
                or process['pid']!=process['pgid'] or process['identity']['pid']!=process['pid']
                or process['identity']['pgid']!=process['pid'] or process['identity']['sid']!=process['pid']
                or process['identity']['ppid']!=value['identity']['pid']):
            raise RuntimeError('stage process identity')
        for name,pin in action['streams'].items():
            raw = stage_read((base/'evidence'/stage if phase=='GUARD' else directory/phase)/name,STAGE_STREAM_CAP)
            if type(pin['bytes']) is not int or pin['bytes']!=len(raw) or pin['sha256']!=hashlib.sha256(raw).hexdigest():
                raise RuntimeError('stage raw stream drift')
            if stage_ci()['redact'](raw)!=raw:raise RuntimeError('stage credential output')
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='role', required=True)
    g = sub.add_parser('guard')
    g.add_argument('profile', choices=['prerequisite', 'focused', 'p33', 'parity', 'unit', 'integration', 'all', 'writer', 'rest', 'master046', 'technical-master', 'technical-master-pure', 'durable-pair-pure', 'command-postgres', 'fixture105-unknown', 'fixture105-isolation', 'fixture105-native', 'runtime-observe', 'fixture105-traversal'])
    o = sub.add_parser('owner')
    for key in ('lease', 'device', 'inode', 'link', 'guard'):
        o.add_argument('--'+key, type=int, required=True)
    for key in ('folder', 'node', 'nonce'):
        o.add_argument('--'+key, required=True)
    o.add_argument('--deadline', type=float, required=True)
    o.add_argument('--mode', choices=['p33', 'complete', 'noncomplete'], required=True)
    c = sub.add_parser('control')
    c.add_argument('mode', choices=['complete', 'noncomplete'])
    for name in ('stage-owner','stage-check'):
        phase_owner = sub.add_parser(name)
        phase_owner.add_argument('stage',choices=['prerequisite','focused','all'])
    child = sub.add_parser('stage-child')
    child.add_argument('--stage',choices=['prerequisite','focused','all'],required=True)
    child.add_argument('--partition',choices=['writer','rest'],required=True)
    child.add_argument('--phase',choices=STAGE_PHASES,required=True)
    for key in ('parent','start','link'):child.add_argument('--'+key,type=int,required=True)
    child.add_argument('--nonce',required=True)
    args = parser.parse_args()
    if args.role == 'stage-child':return stage_child(args)
    if args.role in ('stage-owner','stage-check'):return stage_owner(args.stage,args.role=='stage-check')
    if args.role == 'control':
        return control(args.mode)
    if args.role == 'owner':
        return case_owner(args)
    return guard(args)


if __name__ == '__main__':
    raise SystemExit(main())
