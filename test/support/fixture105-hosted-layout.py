"""INERT reviewed-design candidate: exclusive complete local clone; no installation/application."""
import ctypes
import hashlib
import json
import os
from pathlib import Path
import re
import selectors
import signal
import stat
import subprocess
import sys
import time

DESTINATION = Path('/tmp/d')
UID = os.getuid()
CAP = 262144
SOURCE_FILES = 507
STATE = {'phase': 'preflight', 'primary': None, 'cleanup_errors': [],
         'cancelled': None, 'settling': False, 'actions': [],
         'evidence': None, 'source': None, 'owned_root': None, 'prepared': False}
EVIDENCE = None
SOURCE = None
OWNED_FD_PENDING = []
PENDING_RESOURCES = []  # Retain uncertain objects; no destructor/production close retry.

class LayoutFailure(Exception):
    pass

def need(ok, code):
    if not ok:
        raise LayoutFailure(code)

def failed(error, phase):
    if STATE['primary'] is None:
        STATE['primary'] = {'phase': phase,
                            'code': str(error) if isinstance(error, LayoutFailure)
                            else type(error).__name__}

def cleanup_error(code):
    if code not in STATE['cleanup_errors']:
        if len(STATE['cleanup_errors']) < 32:
            STATE['cleanup_errors'].append(code)
        elif 'cleanup_record_bound' not in STATE['cleanup_errors']:
            STATE['cleanup_errors'][-1] = 'cleanup_record_bound'

def cancel(number, _frame):
    # Record cancellation without raising across an in-flight spawn/read/write ownership transfer.
    if STATE['cancelled'] is None:
        STATE['cancelled'] = number
        failed(LayoutFailure('owner_cancelled'), 'signal')
    if STATE['settling']:
        cleanup_error('signal_during_settlement')


def identity(path):
    info = path.lstat()
    need(stat.S_ISDIR(info.st_mode) and not path.is_symlink() and
         path.resolve() == path, 'directory_shape')
    return {'path': str(path), 'dev': info.st_dev, 'ino': info.st_ino,
            'uid': info.st_uid, 'mode': stat.S_IMODE(info.st_mode)}

def population(group, direct):
    """A failed observation is never an empty population."""
    result = {'complete': True, 'members': [], 'children': [], 'errors': []}
    try:
        paths = list(Path('/proc').iterdir())
        need(len(paths) <= 8192, 'proc_population_bound')
    except BaseException as error:
        return {'complete': False, 'members': None, 'children': None,
                'errors': [type(error).__name__]}
    for path in paths:
        if not path.name.isdigit():
            continue
        try:
            raw = (path / 'stat').read_text()
            need(len(raw) <= 4096, 'proc_record_bound')
            fields = raw[raw.rfind(')') + 2:].split()
            pid, parent, pgid = int(path.name), int(fields[1]), int(fields[2])
            if pgid == group:
                result['members'].append(pid)
            if parent == os.getpid() and pid != direct:
                result['children'].append(pid)
            need(len(result['members']) <= 64 and len(result['children']) <= 64,
                 'owned_population_bound')
        except (FileNotFoundError, ProcessLookupError):
            continue
        except BaseException as error:
            result['complete'] = False
            if len(result['errors']) < 8:
                result['errors'].append(type(error).__name__)
    result['members'].sort()
    result['children'].sort()
    return result

def record(name, value):
    need(EVIDENCE is not None and identity(EVIDENCE) == STATE['evidence'],
         'evidence_owner_changed')
    raw = (json.dumps(value, sort_keys=True) + '\n').encode()
    need(len(raw) <= CAP, 'record_bound')
    fd = os.open(EVIDENCE / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                 os.O_NOFOLLOW, 0o600)
    primary = None
    try:
        need(os.write(fd, raw) == len(raw), 'record_short_write')
        os.fsync(fd)
    except BaseException as error:
        primary = error
    try:
        os.close(fd)
    except BaseException as error:
        OWNED_FD_PENDING.append(fd)
        cleanup_error('record_close_uncertain')
        if primary is None:
            primary = error
    if primary is not None:
        raise primary

def stable_read(path, limit, expected_uid=None):
    need(not OWNED_FD_PENDING, 'owned_descriptor_cleanup_pending')
    held = []
    primary = None
    data = None
    try:
        fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        held.append(fd)
        for index, part in enumerate(path.parts[1:]):
            flags = os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW
            if index != len(path.parts[1:]) - 1:
                flags |= os.O_DIRECTORY
            new = os.open(part, flags, dir_fd=fd)
            held.append(new)
            held.remove(fd)
            try:
                os.close(fd)
            except BaseException:
                OWNED_FD_PENDING.append(fd)
                cleanup_error('source_component_close_uncertain')
                raise
            fd = new
        before = os.fstat(fd)
        need(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and
             before.st_uid == (UID if expected_uid is None else expected_uid) and
             before.st_mode & 0o022 == 0 and before.st_size <= limit, 'source_file_shape')
        chunks = []
        total = 0
        while True:
            block = os.read(fd, min(65536, limit + 1 - total))
            if not block:
                break
            chunks.append(block)
            total += len(block)
            need(total <= limit, 'source_read_bound')
        data = b''.join(chunks)
        after = os.fstat(fd)
        need(len(data) == before.st_size and
             all(getattr(before, key) == getattr(after, key) for key in
                 ('st_dev', 'st_ino', 'st_uid', 'st_gid', 'st_mode', 'st_nlink', 'st_size',
                  'st_mtime_ns', 'st_ctime_ns')), 'source_changed')
    except BaseException as error:
        primary = error
    for fd in reversed(held):
        try:
            os.close(fd)
        except BaseException as error:
            OWNED_FD_PENDING.append(fd)
            cleanup_error('source_final_close_uncertain')
            if primary is None:
                primary = error
    if primary is not None:
        raise primary
    return data, before

def bootstrap_tools():
    result = {}
    for name in ('git', 'python3', 'timeout'):
        alias = Path('/usr/bin') / name
        resolved = alias.resolve()
        raw, info = stable_read(resolved, 33554432, expected_uid=0)
        result[name] = {'alias': str(alias), 'resolved': str(resolved),
                        'alias_target': os.readlink(alias) if alias.is_symlink() else None,
                        'dev': info.st_dev, 'ino': info.st_ino, 'uid': info.st_uid,
                        'mode': stat.S_IMODE(info.st_mode), 'nlink': info.st_nlink,
                        'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
    need(str(Path(sys.executable).resolve()) == result['python3']['resolved'],
         'bootstrap_interpreter')
    return result

def tracked_snapshot(root, names):
    rows, total = [], 0
    for name in names:
        need(STATE['cancelled'] is None or STATE['settling'], 'owner_cancelled')
        raw, info = stable_read(root / name, 67108864)
        total += len(raw)
        need(total <= 268435456, 'source_aggregate_bound')
        rows.append({'path': name, 'bytes': len(raw),
                     'mode': '100755' if info.st_mode & 0o111 else '100644',
                     'sha256': hashlib.sha256(raw).hexdigest()})
    return rows

def disk_observation():
    if STATE['owned_root'] is None:
        return
    need(identity(DESTINATION) == STATE['owned_root'], 'owned_root_changed')
    total, entries = 0, 0
    def unreadable(error):
        raise error
    for parent, directories, files in os.walk(DESTINATION, followlinks=False, onerror=unreadable):
        for name in directories + files:
            entries += 1
            need(entries <= 65536, 'clone_disk_entry_cap')
            try:
                total += (Path(parent) / name).lstat().st_size
            except FileNotFoundError:
                continue  # Concurrent Git temporary-leaf removal, not an empty-tree assertion.
            need(total <= 1073741824, 'clone_disk_byte_cap')
    need(identity(DESTINATION) == STATE['owned_root'], 'owned_root_changed')
    STATE['disk_peak_observed'] = max(STATE.get('disk_peak_observed', 0), total)

def publish_evidence_claim():
    # Existing GitHub file-command mechanism; advertise only an already owned private evidence root.
    path = Path(os.environ['GITHUB_OUTPUT'])
    need(path.is_absolute() and path.resolve() == path, 'github_output_path')
    fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_NOFOLLOW)
    primary = None
    try:
        info = os.fstat(fd)
        need(stat.S_ISREG(info.st_mode) and info.st_uid == UID and info.st_nlink == 1 and
             info.st_mode & 0o022 == 0, 'github_output_owner')
        raw = b'evidence_claimed=true\n'
        need(os.write(fd, raw) == len(raw), 'github_output_short_write')
        os.fsync(fd)
    except BaseException as error:
        primary = error
    try:
        os.close(fd)
    except BaseException as error:
        OWNED_FD_PENDING.append(fd)
        cleanup_error('github_output_close_uncertain')
        if primary is None:
            primary = error
    if primary is not None:
        raise primary

def capture(label, argv, seconds):
    need(STATE['cancelled'] is None and STATE['primary'] is None and
         not STATE['cleanup_errors'], 'new_launch_barrier')
    need(time.monotonic() < WHOLE_DEADLINE, 'whole_owner_deadline_before_launch')
    need(STATE['source'] is not None and identity(SOURCE) == STATE['source'],
         'source_root_changed')
    STATE['settling'] = False
    STATE['phase'] = label
    selector, process = None, None
    files, pipes = {}, {}
    eof = {'stdout': False, 'stderr': False}
    observed = {'stdout': 0, 'stderr': 0}
    retained = {'stdout': 0, 'stderr': 0}
    direct_reaped, final_population = False, None
    primary_before = STATE['primary']
    reaped = []

    def poll():
        nonlocal direct_reaped
        try:
            direct_reaped = process.poll() is not None
        except BaseException:
            cleanup_error(label + ':direct_reap_uncertain')

    def observe():
        try:
            value = population(process.pid, process.pid)
        except BaseException as error:
            # A discovery implementation failure must not unwind past other cleanup.
            value = {'complete': False, 'members': None, 'children': None,
                     'errors': [type(error).__name__]}
        if not value['complete']:
            cleanup_error(label + ':discovery_uncertain')
        for child in value['children'] or []:
            try:
                pid, status = os.waitpid(child, os.WNOHANG)
                if pid:
                    reaped.append({'pid': pid, 'status': status})
            except (ChildProcessError, ProcessLookupError):
                pass
            except BaseException:
                cleanup_error(label + ':adopted_reap_uncertain')
        return value

    def pump(wait):
        try:
            events = selector.select(wait)
        except BaseException as error:
            failed(error, label + ':capture_select')
            cleanup_error(label + ':capture_select_uncertain')
            return
        for key, _ in events:
            name = key.data
            try:
                block = os.read(key.fileobj.fileno(), 65536)
                if not block:
                    eof[name] = True
                    selector.unregister(key.fileobj)
                    continue
                observed[name] += len(block)
                saved = block[:max(0, CAP - retained[name])]
                if saved:
                    count = files[name].write(saved)
                    retained[name] += count
                    need(count == len(saved), 'capture_short_write')
                need(observed[name] <= CAP, 'capture_stream_cap')
            except BlockingIOError:
                continue
            except BaseException as error:
                failed(error, label + ':capture')
                if not isinstance(error, LayoutFailure):
                    cleanup_error(label + ':capture_io_uncertain')

    try:
        selector = selectors.DefaultSelector()
        for name in ('stdout', 'stderr'):
            fd = os.open(EVIDENCE / (label + '.' + name), os.O_WRONLY |
                         os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            try:
                files[name] = os.fdopen(fd, 'wb', buffering=0)
            except BaseException:
                try:
                    os.close(fd)
                except BaseException:
                    OWNED_FD_PENDING.append(fd)
                    cleanup_error(label + ':output_setup_close_uncertain')
                raise
        need(STATE['cancelled'] is None, 'cancelled_before_spawn')
        process = subprocess.Popen(argv, cwd=SOURCE, env=GIT_ENV,
                                   stdin=subprocess.DEVNULL,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   bufsize=0, start_new_session=True)
        need(STATE['cancelled'] is None, 'owner_cancelled')
        for name in ('stdout', 'stderr'):
            pipes[name] = getattr(process, name)
            os.set_blocking(pipes[name].fileno(), False)
            selector.register(pipes[name], selectors.EVENT_READ, name)
        record(label + '.process.json', {'pid': process.pid, 'pgid': process.pid})
        until = min(time.monotonic() + seconds, WHOLE_DEADLINE)
        last_disk = time.monotonic()
        while not all(eof.values()) or not direct_reaped:
            pump(0.05)
            poll()
            if STATE['primary'] is not primary_before:
                break
            need(time.monotonic() < until, 'git_deadline')
            if time.monotonic() - last_disk >= 2:
                disk_observation()
                last_disk = time.monotonic()
        need(direct_reaped and process.returncode == 0, 'git_exit')
    except BaseException as error:
        failed(error, label)
    finally:
        STATE['settling'] = True
        if process is not None:
            # Recover both pipe owners after any interrupted setup; drain while stopping.
            for name in ('stdout', 'stderr'):
                pipe = getattr(process, name)
                pipes.setdefault(name, pipe)
                try:
                    if not eof[name] and pipe not in [k.fileobj for k in selector.get_map().values()]:
                        os.set_blocking(pipe.fileno(), False)
                        selector.register(pipe, selectors.EVENT_READ, name)
                except BaseException:
                    cleanup_error(label + ':pipe_registration_uncertain')
            until, kill_at = time.monotonic() + 10, time.monotonic() + 5
            final_population = observe()
            if (STATE['primary'] is not primary_before or not direct_reaped or
                    not final_population['complete'] or final_population['members']):
                try:
                    os.killpg(process.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                except BaseException:
                    cleanup_error(label + ':term_uncertain')
            killed = False
            while time.monotonic() < until:
                poll()
                final_population = observe()
                if (direct_reaped and final_population['complete'] and
                        not final_population['members'] and not final_population['children'] and
                        all(eof.values())):
                    break
                if not killed and time.monotonic() >= kill_at:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    except BaseException:
                        cleanup_error(label + ':kill_uncertain')
                    killed = True
                pump(0.05)
            poll()
            final_population = observe()
        for pipe in pipes.values():
            try:
                pipe.close()
            except BaseException:
                PENDING_RESOURCES.append(pipe)
                cleanup_error(label + ':pipe_close_uncertain')
        for stream in files.values():
            try:
                stream.flush()
                os.fsync(stream.fileno())
            except BaseException:
                cleanup_error(label + ':capture_flush_uncertain')
            try:
                stream.close()
            except BaseException:
                PENDING_RESOURCES.append(stream)
                cleanup_error(label + ':capture_close_uncertain')
        if selector is not None:
            try:
                selector.close()
            except BaseException:
                PENDING_RESOURCES.append(selector)
                cleanup_error(label + ':selector_close_uncertain')
    streams = {}
    for name in ('stdout', 'stderr'):
        try:
            raw, _ = stable_read(EVIDENCE / (label + '.' + name), CAP)
            streams[name] = {'retained_bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
                             'observed_bytes': observed[name], 'eof': eof[name],
                             'truncated': observed[name] > len(raw),
                             'complete': eof[name] and len(raw) == observed[name] == retained[name]}
        except BaseException as error:
            failed(error, label + ':capture_readback')
            cleanup_error(label + ':capture_readback_uncertain')
            streams[name] = {'complete': False, 'eof': eof[name], 'observed_bytes': observed[name]}
    if (STATE['primary'] is None and (STATE['cleanup_errors'] or process is None or
            not direct_reaped or process.returncode != 0 or not all(eof.values()))):
        failed(LayoutFailure('git_action_or_settlement_failed'), label + ':settlement')
    settled = bool(process is not None and direct_reaped and final_population is not None and
                   final_population['complete'] and not final_population['members'] and
                   not final_population['children'] and all(eof.values()) and not STATE['cleanup_errors'])
    if process is not None and not settled:
        PENDING_RESOURCES.append(process)
    outcome = {'label': label, 'argv': argv, 'exit': None if process is None else process.returncode,
               'direct_reaped': direct_reaped, 'population': final_population,
               'streams': streams, 'settlement': 'complete' if settled else 'pending',
               'additional_reaps': reaped, 'primary': STATE['primary'],
               'cleanup_errors': list(STATE['cleanup_errors'])}
    STATE['actions'].append(outcome)
    try:
        record(label + '.json', outcome)
    except BaseException as error:
        failed(error, label + ':receipt')
        cleanup_error(label + ':receipt_write_failed')
    need(STATE['primary'] is primary_before and not STATE['cleanup_errors'] and settled and
         process.returncode == 0 and all(s['complete'] for s in streams.values()),
         'git_action_or_settlement_failed')
    disk_observation()
    need(identity(Path('/tmp')) == tmp, 'shared_tmp_changed')
    need(identity(SOURCE) == STATE['source'], 'source_root_changed')
    if STATE['owned_root'] is not None:
        need(identity(DESTINATION) == STATE['owned_root'], 'owned_root_changed')
    need(STATE['cancelled'] is None and STATE['primary'] is primary_before,
         'cancelled_after_capture')
    STATE['settling'] = False
    return stable_read(EVIDENCE / (label + '.stdout'), CAP)[0]

def main():
    global SOURCE, EVIDENCE, GIT_ENV, GIT, tmp, WHOLE_DEADLINE
    before, names, tools_before = None, None, None
    try:
        signal.signal(signal.SIGTERM, cancel)
        signal.signal(signal.SIGINT, cancel)
        WHOLE_DEADLINE = time.monotonic() + 240
        need(len(sys.argv) == 1, 'fixed_zero_argument_owner')
        need(os.name == 'posix' and os.environ.get('GITHUB_ACTIONS') == 'true' and
             os.environ.get('ImageOS') == 'ubuntu24' and
             os.environ.get('DESK_CI_PARTITION') == 'rest', 'hosted_rest_only')
        need(os.environ.get('GITHUB_REPOSITORY') == 'mikeddamico/the-desk', 'repository')
        SHA = os.environ.get('GITHUB_SHA', '')
        need(re.fullmatch('[0-9a-f]{40}', SHA), 'actual_checkout_sha')
        SOURCE = Path(os.environ['GITHUB_WORKSPACE'])
        need(SOURCE.is_absolute() and SOURCE.resolve() == SOURCE and
             identity(SOURCE)['uid'] == UID, 'source_identity')
        STATE['source'] = identity(SOURCE)
        need((SOURCE / '.git').is_dir() and not (SOURCE / '.git').is_symlink(),
             'original_checkout_normal_git_directory')
        temporary = Path(os.environ['RUNNER_TEMP'])
        need(temporary.is_absolute() and temporary.resolve() == temporary and
             identity(temporary)['uid'] == UID, 'runner_identity')
        tmp = identity(Path('/tmp'))
        need(tmp['uid'] == 0 and tmp['mode'] == 0o1777, 'shared_tmp_shape')
        need(not os.path.lexists(DESTINATION), 'exclusive_short_root')
        need(STATE['cancelled'] is None, 'owner_cancelled')
        EVIDENCE = temporary / 'fixture105-layout'
        EVIDENCE.mkdir(mode=0o700)
        STATE['evidence'] = identity(EVIDENCE)
        publish_evidence_claim()
        record('early-owner.json', {'phase': 'evidence_claimed', 'source': STATE['source'], 'tmp': tmp})
        for name in ('home', 'empty-template'):
            (EVIDENCE / name).mkdir(mode=0o700)
        need(ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) == 0, 'subreaper')
        GIT_ENV = {'PATH': '/usr/bin:/bin', 'HOME': str(EVIDENCE / 'home'),
                   'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8', 'TZ': 'UTC',
                   'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null',
                   'GIT_TEMPLATE_DIR': str(EVIDENCE / 'empty-template'),
                   'GIT_TERMINAL_PROMPT': '0'}
        GIT = ['/usr/bin/git', '-c', 'core.hooksPath=/dev/null', '-c', 'credential.helper=',
               '-c', 'gc.auto=0']
        tools_before = bootstrap_tools()
        record('bootstrap-tools-before.json', tools_before)
        version = capture('git-version', GIT + ['--version'], 10).decode().strip()
        need(version.startswith('git version ') and len(version) <= 128, 'git_version_shape')
        STATE['bootstrap_git_version'] = version
        original_head = capture('source-head', GIT + ['rev-parse', 'HEAD'], 10).decode().strip()
        original_tree = capture('source-tree', GIT + ['rev-parse', 'HEAD^{tree}'], 10).decode().strip()
        need(original_head == SHA and re.fullmatch('[0-9a-f]{40}', original_tree), 'source_commit')
        names = capture('source-members', GIT + ['ls-files', '-z'], 10).decode().split('\0')[:-1]
        need(len(names) == SOURCE_FILES and len(set(names)) == len(names) and
             all(n and not n.startswith('/') and str(Path(n)) == n and
                 all(part not in ('', '.', '..') for part in n.split('/')) and
                 n.split('/')[0] not in ('.git', 'node_modules', 'dist') for n in names),
             'complete_source_population')
        need(capture('source-status', GIT + ['status', '--porcelain=v1',
                                            '--untracked-files=all'], 10) == b'',
             'original_checkout_not_clean')
        STATE['phase'] = 'source_snapshot_before'
        before = tracked_snapshot(SOURCE, names)
        record('source-before.json', before)
        STATE['source_snapshot_sha256'] = hashlib.sha256(json.dumps(before, sort_keys=True).encode()).hexdigest()
        STATE['phase'] = 'root_claim'
        record('intent.json', {'root': str(DESTINATION), 'head': SHA, 'tree': original_tree,
                               'source': STATE['source'], 'tmp': tmp,
                               'scope': 'independent complete local Git clone only; no install or application',
                               'shared_git_registration': False})
        need(STATE['cancelled'] is None, 'owner_cancelled')
        need(time.monotonic() < WHOLE_DEADLINE, 'whole_owner_deadline_before_root')
        DESTINATION.mkdir(mode=0o700)
        owned = identity(DESTINATION)
        STATE['owned_root'] = owned
        record('root-owner.json', owned)
        capture('clone', GIT + ['clone', '--no-local', '--no-hardlinks', '--no-checkout',
                               '--no-tags', str(SOURCE), str(DESTINATION)], 60)
        STATE['phase'] = 'clone_shape_check'
        need(identity(DESTINATION) == owned, 'root_changed')
        need((DESTINATION / '.git').is_dir() and not (DESTINATION / '.git').is_symlink() and
             not os.path.lexists(DESTINATION / '.git/objects/info/alternates'), 'independent_git')
        capture('origin', GIT + ['-C', str(DESTINATION), 'remote', 'set-url', 'origin',
                                'https://github.com/mikeddamico/the-desk.git'], 10)
        capture('checkout', GIT + ['-C', str(DESTINATION), 'checkout', '--detach', SHA], 30)
        head = capture('clone-head', GIT + ['-C', str(DESTINATION), 'rev-parse', 'HEAD'], 10).decode().strip()
        tree = capture('clone-tree', GIT + ['-C', str(DESTINATION), 'rev-parse', 'HEAD^{tree}'], 10).decode().strip()
        clone_names = capture('clone-members', GIT + ['-C', str(DESTINATION),
                                                     'ls-files', '-z'], 10).decode().split('\0')[:-1]
        need(clone_names == names, 'clone_source_population')
        need(capture('clone-status', GIT + ['-C', str(DESTINATION), 'status',
                                          '--porcelain=v1', '--untracked-files=all'], 10) == b'',
             'clone_checkout_not_clean')
        STATE['phase'] = 'clone_identity_check'
        need(head == SHA and tree == original_tree and identity(DESTINATION) == owned,
             'actual_git_identity')
        config_names = capture('clone-config-names', GIT + ['-C', str(DESTINATION),
                                                            'config', '--local', '--name-only', '--list'], 10).decode().splitlines()
        STATE['phase'] = 'clone_config_check'
        need(len(config_names) <= 64 and all(
            name in {'core.repositoryformatversion', 'core.filemode', 'core.bare',
                     'core.logallrefupdates', 'remote.origin.url', 'remote.origin.fetch'} or
            re.fullmatch(r'branch\.[A-Za-z0-9_./-]+\.(?:remote|merge)', name)
            for name in config_names), 'no_imported_git_credentials_or_hooks')
        STATE['phase'] = 'source_readback'
        need(tracked_snapshot(DESTINATION, names) == before and
             tracked_snapshot(SOURCE, names) == before, 'complete_source_preservation')
        need(not os.path.lexists(DESTINATION / 'node_modules') and
             not os.path.lexists(DESTINATION / 'dist'),
             'fresh_install_and_build_required')
        need((DESTINATION / '.git').is_dir() and not (DESTINATION / '.git').is_symlink() and
             not os.path.lexists(DESTINATION / '.git/objects/info/alternates'), 'independent_git')
        need(STATE['cancelled'] is None and not STATE['cleanup_errors'], 'cancelled_or_cleanup_pending')
        STATE['phase'] = 'prepared'
        STATE['prepared'] = True
        STATE['head'] = head
        STATE['tree'] = tree
        STATE['origin_base_information'] = 'origin/main may be absent in detached local clone; not reconstructed or guessed; ci.py merge-parent/event-base checks remain mandatory'
    except BaseException as error:
        failed(error, STATE['phase'])
    finally:
        STATE['settling'] = True
        if EVIDENCE is not None and STATE['evidence'] is not None:
            try:
                need(identity(SOURCE) == STATE['source'], 'source_root_changed')
                STATE['original_source_root_preserved'] = True
            except BaseException as error:
                failed(error, 'final_source_root_identity')
                STATE['original_source_root_preserved'] = False
            if tools_before is not None:
                try:
                    tools_after = bootstrap_tools()
                    record('bootstrap-tools-after.json', tools_after)
                    need(tools_after == tools_before, 'bootstrap_tools_changed')
                    STATE['bootstrap_tools_preserved'] = True
                except BaseException as error:
                    failed(error, 'final_tool_preservation')
                    STATE['bootstrap_tools_preserved'] = False
            if before is not None and names is not None and not OWNED_FD_PENDING:
                try:
                    after = tracked_snapshot(SOURCE, names)
                    record('source-after.json', after)
                    need(after == before, 'original_source_changed')
                    STATE['original_source_preserved'] = True
                except BaseException as error:
                    failed(error, 'final_source_preservation')
                    STATE['original_source_preserved'] = False
            if STATE['owned_root'] is not None:
                try:
                    STATE['root_observed_final'] = identity(DESTINATION)
                    need(STATE['root_observed_final'] == STATE['owned_root'], 'owned_root_changed')
                except BaseException as error:
                    failed(error, 'final_root_observation')
                    cleanup_error('final_root_identity_uncertain')
            STATE['owned_descriptor_cleanup_pending'] = list(OWNED_FD_PENDING)
            STATE['retained_uncertain_resource_types'] = [type(value).__name__ for value in PENDING_RESOURCES]
            ok = bool(STATE['prepared'] and STATE['primary'] is None and
                      STATE['cancelled'] is None and not STATE['cleanup_errors'] and
                      not OWNED_FD_PENDING)
            terminal = {**STATE, 'ok': ok,
                        'classification': 'prepared_owned_checkout' if ok else 'HELD_partial_or_failed_layout',
                        'partial_clone_policy': 'retain exact claimed root/evidence; never broad-delete or alter shared Git metadata',
                        'no_application_or_installation': True,
                        'containment_scope': 'fixed cooperative local Git process groups; bounded refusal, not a VM quota or hostile setsid detection'}
            try:
                record('terminal.json', terminal)
                STATE['terminal_receipt_retained'] = True
            except BaseException as error:
                failed(error, 'terminal_receipt')
                cleanup_error('terminal_receipt_not_retained')
                ok = False
            if ok and (STATE['cancelled'] is not None or STATE['primary'] is not None or
                       STATE['cleanup_errors'] or OWNED_FD_PENDING):
                ok = False
                try:
                    record('terminal-revoked.json', {'ok': False,
                        'reason': 'failure_or_cancellation_during_terminal_write',
                        'primary': STATE['primary'], 'cancelled': STATE['cancelled'],
                        'cleanup_errors': STATE['cleanup_errors']})
                except BaseException:
                    cleanup_error('terminal_revocation_not_retained')
        else:
            ok = False
            STATE['invocation_classification'] = 'refused_before_evidence_claim; no child permitted'
        print(json.dumps({'layout': 'prepared' if ok else 'HELD',
                          'classification': STATE.get('invocation_classification',
                              'prepared_owned_checkout' if ok else 'partial_failed_layout_retained'),
                          'phase': STATE['phase'], 'primary': STATE['primary'],
                          'cleanup_errors': STATE['cleanup_errors'],
                          'root_claim': STATE['owned_root'],
                          'terminal_retained': STATE.get('terminal_receipt_retained', False)}))
    return 0 if (ok and STATE['primary'] is None and STATE['cancelled'] is None and
                 not STATE['cleanup_errors'] and not OWNED_FD_PENDING) else 1

if __name__ == '__main__':
    raise SystemExit(main())
