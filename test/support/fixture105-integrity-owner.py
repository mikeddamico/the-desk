#!/usr/bin/python3
"""One fixed hosted zero-SQL probe; source/root ownership uses existing CI definitions, not an invented identity."""
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import re
import runpy
import selectors
import shutil
import signal
import stat
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
PREFIXES = [
    '@aws-sdk/checksums', '@aws-sdk/client-s3', '@aws-sdk/core',
    '@aws-sdk/credential-provider-env', '@aws-sdk/credential-provider-http',
    '@aws-sdk/credential-provider-ini', '@aws-sdk/credential-provider-login',
    '@aws-sdk/credential-provider-node', '@aws-sdk/credential-provider-process',
    '@aws-sdk/credential-provider-sso', '@aws-sdk/credential-provider-web-identity',
    '@aws-sdk/middleware-sdk-s3', '@aws-sdk/nested-clients',
    '@aws-sdk/signature-v4-multi-region', '@aws-sdk/token-providers',
    '@aws-sdk/types', '@aws-sdk/xml-builder', '@aws/lambda-invoke-store',
    '@smithy/core', '@smithy/credential-provider-imds',
    '@smithy/fetch-http-handler', '@smithy/node-http-handler',
    '@smithy/signature-v4', '@smithy/types', 'bowser', 'tslib',
]
OPERATIONS = ('open', 'stat', 'directory', 'read', 'hash')
BUCKETS = ('auxiliary', 'source', 'other_tools', 'added_prefix')
CAP = 65536
INTERRUPTED = False


def interrupted(_signal, _frame):
    global INTERRUPTED
    INTERRUPTED = True


def digest(data):
    return hashlib.sha256(data).hexdigest()


def closed(value, keys):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise RuntimeError('closed report shape')
    return value


def quantity(value):
    if type(value) is not int or not 0 <= value <= 9007199254740991:
        raise RuntimeError('bounded integer required')
    return value


def ns(value):
    if not isinstance(value, str) or not re.fullmatch(r'0|[1-9][0-9]{0,29}', value):
        raise RuntimeError('canonical monotonic ns required')
    return int(value)


def write(path, value):
    data = json.dumps(value, separators=(',', ':')).encode() + b'\n'
    if len(data) > CAP:
        raise RuntimeError('metadata bound')
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        if os.write(fd, data) != len(data):
            raise RuntimeError('short metadata write')
        os.fsync(fd)
    finally:
        os.close(fd)


def graph_stats(rows):
    return {
        'nodes': len(rows),
        'files': sum(row['type'] == 'file' for row in rows.values()),
        'directories': sum(row['type'] == 'directory' for row in rows.values()),
        'symlinks': sum(row['type'] == 'symlink' for row in rows.values()),
        'read_bytes': sum(row.get('bytes', 0) for row in rows.values()),
        'hash_bytes': sum(row.get('bytes', 0) for row in rows.values()),
    }


def added(path):
    return any(path == prefix or path.startswith(prefix + '/') for prefix in PREFIXES)


def open_counts(rows, base):
    selected = [name for name, row in rows.items() if row['type'] in ('file', 'directory')]
    depth = len(base.parts) - 1
    return len(selected), sum(depth + (len(name.split('/')) if name else 0) + 1 for name in selected)


def validate_report(report, expected):
    closed(report, ('schema', 'status', 'authority', 'overhead', 'coverage', 'prefix_sha256',
                    'read_release_calls', 'inclusive', 'disjoint', 'owner'))
    if (report['schema'] != 'fixture105-integrity-cost/1' or report['status'] != 'measured'
            or report['authority'] != 'none' or report['overhead'] != 'included_not_calibrated'
            or report['coverage'] != 'instrumented_operations_only_unattributed_remainder_is_not_SQL'
            or report['prefix_sha256'] != digest(json.dumps(PREFIXES, separators=(',', ':')).encode())
            or quantity(report['read_release_calls']) != 1):
        raise RuntimeError('fixed measured report required')
    inclusive = closed(report['inclusive'], ('release_ns', 'root_ns', 'outside_root_ns', 'graphs'))
    release = ns(inclusive['release_ns'])
    if not isinstance(inclusive['root_ns'], list) or len(inclusive['root_ns']) != 2:
        raise RuntimeError('two root checks required')
    roots = [ns(value) for value in inclusive['root_ns']]
    if sum(roots) > release or ns(inclusive['outside_root_ns']) != release - sum(roots):
        raise RuntimeError('inclusive timing identity')
    graphs = inclusive['graphs']
    if not isinstance(graphs, list) or len(graphs) != 4:
        raise RuntimeError('four fresh graphs required')
    for index, graph in enumerate(graphs):
        closed(graph, ('kind', 'ns', 'nodes', 'files', 'directories', 'symlinks', 'read_bytes', 'hash_bytes'))
        kind = 'source' if index % 2 == 0 else 'tools'
        if graph['kind'] != kind:
            raise RuntimeError('original graph ordering')
        ns(graph['ns'])
        for key, value in expected[kind].items():
            if quantity(graph[key]) != value:
                raise RuntimeError('fresh graph count differs: ' + kind + '/' + key)
    disjoint = closed(report['disjoint'], ('buckets', 'inventory_compare'))
    buckets = closed(disjoint['buckets'], BUCKETS)
    disjoint_ns = 0
    for name in BUCKETS:
        bucket = closed(buckets[name], ('operations', 'ancestor_open_attempts', 'read_bytes', 'hash_bytes'))
        for key in ('ancestor_open_attempts', 'read_bytes', 'hash_bytes'):
            quantity(bucket[key])
        operations = closed(bucket['operations'], OPERATIONS)
        for operation in OPERATIONS:
            item = closed(operations[operation], ('calls', 'ns'))
            quantity(item['calls'])
            disjoint_ns += ns(item['ns'])
    for name in ('source', 'added_prefix', 'other_tools'):
        want = expected['buckets'][name]
        actual = buckets[name]
        for key in ('read_bytes', 'hash_bytes', 'ancestor_open_attempts'):
            if actual[key] != want[key]:
                raise RuntimeError('bound bucket differs: ' + name + '/' + key)
        for operation, calls in want['calls'].items():
            if actual['operations'][operation]['calls'] != calls:
                raise RuntimeError('bound operation count differs: ' + name + '/' + operation)
    compare = closed(disjoint['inventory_compare'], ('source', 'tools'))
    for kind in ('source', 'tools'):
        item = closed(compare[kind], ('calls', 'ns'))
        if quantity(item['calls']) != 2:
            raise RuntimeError('two inventory comparisons required')
        disjoint_ns += ns(item['ns'])
    if disjoint_ns > release:
        raise RuntimeError('disjoint times exceed inclusive release')
    owner = closed(report['owner'], ('reads', 'read_bytes', 'hashes'))
    if owner != expected['owner']:
        raise RuntimeError('all original owner reads/hashes required')


def main():
    if (len(sys.argv) != 1 or sys.platform != 'linux' or os.environ.get('GITHUB_ACTIONS') != 'true'
            or os.environ.get('ImageOS') != 'ubuntu24' or os.environ.get('DESK_CI_PARTITION') != 'rest'):
        raise RuntimeError('fixed hosted rest entry required')
    node = shutil.which('node')
    npm = shutil.which('npm')
    if not node or not npm:
        raise RuntimeError('existing pinned tools required')
    keep = ('GITHUB_ACTIONS', 'GITHUB_EVENT_NAME', 'GITHUB_EVENT_PATH', 'GITHUB_SHA', 'GITHUB_REF',
            'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_WORKFLOW_REF', 'GITHUB_WORKFLOW_SHA',
            'GITHUB_REPOSITORY', 'RUNNER_TEMP', 'RUNNER_TRACKING_ID', 'ImageOS', 'ImageVersion')
    environment = {key: os.environ[key] for key in keep if key in os.environ}
    temporary = Path(environment['RUNNER_TEMP'])
    if not temporary.is_absolute():
        raise RuntimeError('absolute existing runner root required')
    base = temporary / 'ci'
    environment.update(PATH=str(Path(node).parent) + ':/usr/bin:/bin', HOME=str(base / 'home'),
                       TMPDIR=str(base / 'tmp'), LANG='C.UTF-8', LC_ALL='C.UTF-8', TZ='UTC',
                       DESK_CI_PARTITION='rest', DESK_ENV='test', PROVIDERS_ENABLED='false',
                       GENERATION_KILL_SWITCH='true')
    os.environ.clear()
    os.environ.update(environment)
    os.chdir(ROOT)
    os.umask(0o077)
    stage = base / 'evidence/fixture105-integrity'
    stage.mkdir(mode=0o700)
    retained = stage / 'retained'
    retained.mkdir(mode=0o700)
    ci = runpy.run_path(str(ROOT / 'tools/ci-validation/ci.py'), run_name='integrity_owner_ci')
    supervisor = runpy.run_path(str(ROOT / 'test/support/p33-parity-supervisor.py'), run_name='integrity_owner_p33')
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    signal.signal(signal.SIGHUP, interrupted)
    child = None
    outputs = {}
    selector = selectors.DefaultSelector()
    primary = None
    cleanup = []
    before = None
    loader = None
    binding = None
    counts = {'stdout': 0, 'stderr': 0}
    reaped = []
    signals = []
    sent_signals = set()
    group_signals = set()
    eof = {'stdout': False, 'stderr': False}
    loader_attempted = False
    expected = None
    started = time.monotonic()

    def snapshot():
        evidence = supervisor['DiscoveryEvidence']()
        now = time.monotonic()
        scan = supervisor['DiscoveryScan'](evidence, 'integrity-owner', now, now + .25, now + .25, None, now)
        table = supervisor['pid_table'](scan, 4096)
        if scan.finish():
            raise RuntimeError('process discovery incomplete')
        return table

    def tool_identity(executable):
        canonical = Path(executable).resolve(strict=True)
        descriptor = os.open(canonical, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        try:
            before_stat = os.fstat(descriptor)
            if not stat.S_ISREG(before_stat.st_mode) or not 0 < before_stat.st_size <= 268435456:
                raise RuntimeError('tool file bound')
            content = hashlib.sha256()
            total = 0
            while True:
                block = os.read(descriptor, 1048576)
                if not block:
                    break
                total += len(block)
                if total > before_stat.st_size:
                    raise RuntimeError('tool file grew')
                content.update(block)
            after_stat = os.fstat(descriptor)
            fields = ('st_dev', 'st_ino', 'st_uid', 'st_gid', 'st_mode', 'st_nlink', 'st_size', 'st_mtime_ns', 'st_ctime_ns')
            if total != before_stat.st_size or any(getattr(before_stat, field) != getattr(after_stat, field) for field in fields):
                raise RuntimeError('tool changed')
            return {'canonical': str(canonical), 'bytes': total, 'sha256': content.hexdigest(),
                    'descriptor': {field: getattr(before_stat, field) for field in fields}}
        finally:
            os.close(descriptor)

    def source_check():
        partition = ci['check_partition_binding']()
        if partition['partition'] != 'rest':
            raise RuntimeError('rest source binding required')
        pre = ci['load_pre'](base / 'evidence')
        build = ci['load_json'](base / 'evidence/bind-build.json')
        if build.get('ok') is not True:
            raise RuntimeError('actual build binding required')
        tracked = ci['tracked_files']()
        current = ci['take_snapshot'](tracked, allow_dist=True)
        if tracked != sorted(pre['members']) or ci['snapshot_errors'](current, pre=pre, expect_dist=build.get('dist')):
            raise RuntimeError('source/build changed')
        identity, members = ci['proof_identity_now'](True)
        if ci['partition_identity'](identity, members) != partition['identity']:
            raise RuntimeError('actual source identity changed')
        actual_binding, actual_loader = ci['fixture_validate'](base, ROOT, True)
        return {'identity': partition['identity'], 'binding': actual_binding, 'loader': actual_loader,
                'executables': {label: tool_identity(path) for label, path in (('node', node), ('npm', npm), ('python', sys.executable), ('timeout', '/usr/bin/timeout'))},
                'source_graph_sha256': digest(ci['fixture_bytes'](ci['fixture_graph'](ROOT, 'source'))),
                'tools_graph_sha256': digest(ci['fixture_bytes'](ci['fixture_graph'](ROOT / 'node_modules', 'tools')))}

    def signal_owned(pid, sig):
        row = supervisor['stat'](pid)
        if (pid, row['start'], int(sig)) in sent_signals:
            return
        if row['ppid'] != os.getpid():
            raise RuntimeError('child ownership changed')
        descriptor = os.pidfd_open(pid)
        try:
            if supervisor['stat'](pid) != row:
                raise RuntimeError('child identity changed')
            signal.pidfd_send_signal(descriptor, sig)
            sent_signals.add((pid, row['start'], int(sig)))
            if len(signals) < 64:
                signals.append({'pid': pid, 'signal': int(sig), 'start': row['start']})
            elif 'process_evidence_bound' not in cleanup:
                cleanup.append('process_evidence_bound')
        finally:
            os.close(descriptor)

    try:
        write(stage / 'prerequisite.json', supervisor['prerequisite']())
        if any(row['ppid'] == os.getpid() for row in snapshot().values()):
            raise RuntimeError('unexpected initial child')
        for executable, version in ((node, b'v24.21.0'), (npm, b'11.19.0')):
            completed = subprocess.run([executable, '--version'], stdin=subprocess.DEVNULL,
                                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20, check=False)
            if completed.returncode or completed.stdout.strip() != version or completed.stderr:
                raise RuntimeError('pinned tool version mismatch')
        # No guard/test is run: the existing binding owner creates only its exact empty loader directory.
        loader_attempted = True
        with contextlib.redirect_stdout(io.StringIO()):
            if ci['cmd_fixture_binding']('focused') != 0:
                raise RuntimeError('fixture owner failed')
        before = source_check()
        binding = before['binding']
        loader = before['loader']
        write(stage / 'before.json', before)
        binding_root = Path(binding['root'])
        inventories = {kind: json.loads(ci['fixture_read'](binding_root / 'bindings' / name, ci['SNAPSHOT_LIMIT']))
                       for kind, name in (('source', 'SOURCE-INVENTORY.json'), ('tools', 'TOOLS-INVENTORY.json'))}
        ledger = json.loads(ci['fixture_read'](binding_root / 'bindings/SOURCE-LEDGER.json', 262144))
        expected = {kind: graph_stats(rows) for kind, rows in inventories.items()}
        expected['owner'] = {'reads': len(ledger['rows']), 'hashes': len(ledger['rows']),
                             'read_bytes': sum(row['bytes'] for row in ledger['rows'])}
        expected['buckets'] = {}
        for label, kind, predicate in (('source', 'source', lambda name: True),
                                       ('added_prefix', 'tools', added),
                                       ('other_tools', 'tools', lambda name: not added(name))):
            rows = {name: row for name, row in inventories[kind].items() if predicate(name)}
            stats = graph_stats(rows)
            opens, attempts = open_counts(rows, ROOT if kind == 'source' else ROOT / 'node_modules')
            expected['buckets'][label] = {'read_bytes': 2 * stats['read_bytes'],
                                          'hash_bytes': 2 * stats['hash_bytes'],
                                          'ancestor_open_attempts': 2 * attempts,
                                          'calls': {'open': 2 * opens, 'stat': 2 * stats['nodes'],
                                                    'directory': 2 * stats['directories'],
                                                    'read': 2 * stats['files'], 'hash': 2 * stats['files']}}
        write(stage / 'expected.json', expected)
        child_env = {key: environment[key] for key in ('PATH', 'HOME', 'TMPDIR', 'RUNNER_TEMP', 'LANG', 'LC_ALL', 'TZ',
                                                       'DESK_ENV', 'PROVIDERS_ENABLED', 'GENERATION_KILL_SWITCH')}
        if 'RUNNER_TRACKING_ID' in environment:
            child_env['RUNNER_TRACKING_ID'] = environment['RUNNER_TRACKING_ID']
        child_env['DESK_FIXTURE105_BINDING'] = json.dumps(binding, separators=(',', ':'))
        command = ['/usr/bin/timeout', '--signal=TERM', '--kill-after=20s', '120s', node,
                   '--import', 'tsx', 'test/support/fixture105-integrity-probe.ts']
        write(stage / 'invocation.json', {'argv': command, 'cwd': str(ROOT), 'environment_names': sorted(child_env),
                                          'invocations': 1, 'measurement_warmup': 'source/tool prechecks precede measured span',
                                          'source_identity': before['identity'],
                                          'node_sha256': digest(Path(node).read_bytes())})
        for name in counts:
            outputs[name] = (stage / name).open('xb', buffering=0)
        child = subprocess.Popen(command, cwd=ROOT, env=child_env, stdin=subprocess.DEVNULL,
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
        write(stage / 'process.json', {'pid': child.pid, 'pgid': child.pid})
        selector.register(child.stdout, selectors.EVENT_READ, 'stdout')
        selector.register(child.stderr, selectors.EVENT_READ, 'stderr')
        until = time.monotonic() + 150
        while selector.get_map() or child.poll() is None:
            if INTERRUPTED or time.monotonic() >= until:
                raise RuntimeError('owned probe interrupted or action deadline')
            for key, _ in selector.select(.1):
                block = os.read(key.fileobj.fileno(), 65536)
                if not block:
                    selector.unregister(key.fileobj)
                    eof[key.data] = True
                    continue
                counts[key.data] += len(block)
                if counts[key.data] > CAP:
                    raise RuntimeError('capture bound; incomplete')
                if outputs[key.data].write(block) != len(block):
                    raise RuntimeError('short capture write')
        if child.returncode != 0:
            raise RuntimeError('probe child refused')
    except BaseException as error:
        primary = type(error).__name__
    finally:
        # The owner is a verified subreaper. Adopted descendants are never inferred absent from direct-child exit.
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            try:
                if child is not None:
                    child.poll()
                while True:
                    pid, status = os.waitpid(-1, os.WNOHANG)
                    if pid == 0:
                        break
                    exit_code = os.waitstatus_to_exitcode(status)
                    if child is not None and pid == child.pid:
                        child.returncode = exit_code
                    if len(reaped) < 32:
                        reaped.append({'pid': pid, 'raw': status, 'exit': exit_code})
                    elif 'process_evidence_bound' not in cleanup:
                        cleanup.append('process_evidence_bound')
            except ChildProcessError:
                pass
            try:
                table = snapshot()
                owned = [row for row in table.values() if row['ppid'] == os.getpid()]
                group = [row for row in table.values() if child is not None and row['pgid'] == child.pid]
                if not owned and not group:
                    break
                if group and (primary or time.monotonic() > deadline - 19):
                    selected_signal = signal.SIGKILL if time.monotonic() > deadline - 1 else signal.SIGTERM
                    if int(selected_signal) not in group_signals:
                        os.killpg(child.pid, selected_signal)
                        group_signals.add(int(selected_signal))
                        signals.append({'pgid': child.pid, 'signal': int(selected_signal)})
                for row in owned:
                    if row['state'] == 'Z':
                        continue
                    if primary or time.monotonic() > deadline - 19:
                        signal_owned(row['pid'], signal.SIGKILL if time.monotonic() > deadline - 1 else signal.SIGTERM)
            except (FileNotFoundError, ProcessLookupError):
                pass
            except BaseException as error:
                cleanup.extend([type(error).__name__] if type(error).__name__ not in cleanup else [])
            time.sleep(.02)
        for stream in outputs.values():
            try:
                os.fsync(stream.fileno())
                stream.close()
            except BaseException as error:
                cleanup.extend([type(error).__name__] if type(error).__name__ not in cleanup else [])
        if child is not None:
            for stream in (child.stdout, child.stderr):
                stream.close()
        selector.close()
        try:
            table = snapshot()
            residual = [row for row in table.values() if row['ppid'] == os.getpid()
                        or child is not None and row['pgid'] == child.pid]
            if residual:
                cleanup.append('owned_process_residual')
            write(stage / 'settlement.json', {'direct_reaped': child is not None and child.returncode is not None,
                                              'residual': residual[:32], 'residual_count': len(residual), 'reaped_adopted': reaped,
                                              'signals': signals, 'cleanup_errors': cleanup})
        except BaseException as error:
            cleanup.extend([type(error).__name__] if type(error).__name__ not in cleanup else [])
        if before is not None:
            try:
                after = source_check()
                write(stage / 'after.json', after)
                if after != before:
                    raise RuntimeError('source/tool/root/loader changed')
                actual = ci['fixture_temp'](ROOT, True)
                if actual != loader or actual.get('leaves') != []:
                    raise RuntimeError('loader ownership changed')
                directory = ROOT / 'node_modules/.vite-temp'
                if directory.is_symlink() or directory.stat().st_uid != os.getuid():
                    raise RuntimeError('loader owner changed')
                directory.rmdir()
                write(stage / 'loader-cleanup.json', {'bound_before_after': loader, 'removed_exact_empty': True,
                                                      'absent': not os.path.lexists(directory)})
            except BaseException as error:
                cleanup.extend([type(error).__name__] if type(error).__name__ not in cleanup else [])
        elif loader_attempted:
            try:
                actual = ci['fixture_temp'](ROOT, True)
                created = ci['load_json'](base / 'evidence/fixture105-loader-created.json')
                if actual.get('identity') != created.get('identity') or actual.get('leaves') != []:
                    raise RuntimeError('prelaunch loader identity uncertain')
                (ROOT / 'node_modules/.vite-temp').rmdir()
                write(stage / 'loader-cleanup.json', {'prelaunch_failure': True, 'removed_exact_empty': True})
            except BaseException as error:
                cleanup.extend([type(error).__name__] if type(error).__name__ not in cleanup else [])
    report = None
    try:
        stdout = ci['fixture_read'](stage / 'stdout', CAP)
        stderr = ci['fixture_read'](stage / 'stderr', CAP)
        prefix = b'FIXTURE105_INTEGRITY_COST '
        if len(stdout) > 16384 or stderr or not stdout.startswith(prefix) or stdout.count(b'\n') != 1:
            raise RuntimeError('one complete closed record required')
        def unique(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise RuntimeError('duplicate report key')
                result[key] = value
            return result
        report = json.loads(stdout[len(prefix):], object_pairs_hook=unique,
                            parse_constant=lambda _value: (_ for _ in ()).throw(RuntimeError('nonfinite report')))
        if expected is None:
            raise RuntimeError('measurement not launched')
        validate_report(report, expected)
        write(stage / 'validated-report.json', report)
    except BaseException as error:
        primary = primary or type(error).__name__
    if any(not value for value in eof.values()):
        primary = primary or 'incomplete_capture'
    ok = primary is None and not cleanup and not INTERRUPTED and child is not None and child.returncode == 0
    write(stage / 'result.json', {'ok': ok, 'primary': primary, 'cleanup_errors': cleanup,
                                'child_exit': None if child is None else child.returncode,
                                'interrupted': INTERRUPTED, 'stream_bytes': counts, 'capture_eof': eof,
                                'stream_identity': {name: {'bytes': (stage / name).stat().st_size, 'sha256': digest((stage / name).read_bytes())} for name in counts if (stage / name).exists()},
                                'one_measurement_then_stop': True,
                                'authority': 'none', 'no_database_cloud_child_environment': True})
    # Retain complete captures even on refusal; environment values and arbitrary errors are never serialized.
    for name in ('stdout', 'stderr'):
        path = stage / name
        if path.exists():
            ci['fixture_write_raw'](retained / name, ci['redact'](ci['fixture_read'](path, CAP)), CAP)
    for path in stage.glob('*.json'):
        ci['fixture_write_raw'](retained / path.name, ci['fixture_read'](path, CAP), CAP)
    print(json.dumps({'integrity_probe': 'measured' if ok else 'hold', 'authority': 'none'}))
    return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
