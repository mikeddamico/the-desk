#!/usr/bin/python3
"""Fixed once-only boxed-zero proof. REVIEW REQUIRED BEFORE EXECUTION."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import resource
import secrets
import selectors
import shutil
import signal
import subprocess
import time
import evidence

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
OUT = evidence.OUT
CASE = 'P03-P09 bounds, name-first and private identity > P05 invalid bound 6'
PATTERN = '^P03-P09 bounds, name-first and private identity P05 invalid bound 6$'
BASE = 'f64ec8e0bc1b292d914afbf62d09c6e1a98864ba'
CAP = 2 * 1024 * 1024
SETUP = 60.0
OPERATION = 3.0
CAPTURE = 5.0
SETTLEMENT = 12.0
STOP = None
INTERRUPTED = None  # Sticky: set only by delivered signals, never cleared or overwritten.


def stop(reason):
    global STOP
    if STOP is None:
        STOP = reason


def interrupted(number, _frame):
    global INTERRUPTED
    if INTERRUPTED is None:
        INTERRUPTED = 'observer_failure' if number == signal.SIGUSR1 else 'signal_' + str(number)
    stop('observer_failure' if number == signal.SIGUSR1 else 'signal_' + str(number))


def verify(manifest):
    until = time.monotonic() + 30
    for name, item in manifest['files'].items():
        if time.monotonic() >= until:
            raise RuntimeError('binding time bound')
        if evidence.file_hash(ROOT/name, item['bytes']) != item['sha256']:
            raise RuntimeError('binding mismatch: ' + name)


def child_limits():
    # Single-threaded launcher; no Python threads exist before Popen.
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_CPU, (60, 60))
    resource.setrlimit(resource.RLIMIT_FSIZE, (64*1024*1024, 64*1024*1024))
    resource.setrlimit(resource.RLIMIT_NOFILE, (256, 256))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--released-run-id', choices=['native-kill-boxed-zero-001'], required=True)
    parser.add_argument('--manifest-sha256', required=True)
    args = parser.parse_args()
    # Disposable hosted runner only: quarantine relies on its finite job teardown.
    if os.getenv('GITHUB_ACTIONS') != 'true' or os.getenv('GITHUB_RUN_ATTEMPT') != '1':
        raise RuntimeError('one reviewed hosted attempt required')
    raw = (HERE/'manifest.json').read_bytes()
    if len(raw) > 262144 or hashlib.sha256(raw).hexdigest() != args.manifest_sha256:
        raise RuntimeError('reviewed manifest binding')
    manifest = json.loads(raw)
    if manifest['base_head'] != BASE:
        raise RuntimeError('base binding')
    verify(manifest)
    OUT.mkdir(mode=0o700)  # Persistent exclusive once latch. Never reuse/remove for retry.
    (OUT/'home').mkdir(mode=0o700)
    mechanism = evidence.load_mechanism()
    preflight = mechanism.prerequisite()
    signal.signal(signal.SIGCHLD, signal.SIG_DFL)
    for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP, signal.SIGUSR1):
        signal.signal(sig, interrupted)
    node = shutil.which('node')
    if not node:
        raise RuntimeError('node unavailable')
    node = os.path.realpath(node)
    version = json.loads((ROOT/'.native-kill-versions.json').read_text())
    if (version['commands']['node']['output'].strip() != 'v24.21.0' or
            version['commands']['npm']['output'].strip() != '11.19.0' or version['vitest'] != '4.1.11'):
        raise RuntimeError('version record mismatch')
    if version['commands']['node']['path'] != node:
        raise RuntimeError('node path mismatch')
    token = secrets.token_hex(16)
    env = {'PATH': str(Path(node).parent)+':/usr/bin:/bin', 'HOME': str(OUT/'home'),
           'TMPDIR': '/tmp', 'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8', 'TZ': 'UTC',
           'CI': 'true', 'GITHUB_ACTIONS': 'true',
           'DESK_DIAG_SUPERVISOR': str(os.getpid()), 'DESK_DIAG_TOKEN': token}
    if os.getenv('RUNNER_TRACKING_ID'):
        env['RUNNER_TRACKING_ID'] = os.environ['RUNNER_TRACKING_ID']
    command = [node, str(ROOT/'node_modules/vitest/vitest.mjs'), 'run',
               'test/unit/fixture-pack-extraction-parity.test.ts', '--testNamePattern', PATTERN]
    evidence.write_json(OUT/'launch.json', {'run_id': args.released_run_id, 'base_head': BASE,
        'manifest_sha256': args.manifest_sha256, 'command': command, 'cwd': str(ROOT),
        'prerequisite': preflight, 'setup_seconds': SETUP, 'operation_seconds': OPERATION,
        'capture_seconds': CAPTURE, 'settlement_seconds': SETTLEMENT, 'output_bytes': CAP,
        'environment_keys': sorted(env), 'utc_start': time.time(),
        'resource_limits': {'cpu_seconds_per_process': 60, 'file_bytes': 67108864,
            'open_fds_per_process': 256, 'core_bytes': 0, 'sampled_owned_processes': 32,
            'sampled_owned_rss_bytes': 3221225472}})
    proc = direct = settlement = snapshot = None
    selector = selectors.DefaultSelector()
    output = (OUT/'output.log').open('xb', buffering=0)
    started = time.monotonic()
    operation_start = operation_end = capture_start = capture_deadline = None
    phase = 'setup'
    deadline = started + SETUP
    errors, seq, counts, outstanding, calls = [], {}, {}, {}, []
    cleanup_enter = cleanup_return = False
    case_pid = None
    pending = b''
    total = parsed = 0
    eof = False
    capture_complete = True
    next_resource = started
    resource_samples = []
    observation_start = settlement_start = settlement_end = None
    try:
        if STOP:
            raise RuntimeError('interrupted before spawn')
        proc = subprocess.Popen(command, cwd=ROOT, env=env, stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True,
            close_fds=True, preexec_fn=child_limits)
        direct = mechanism.identity(proc)
        os.set_blocking(proc.stdout.fileno(), False)
        selector.register(proc.stdout, selectors.EVENT_READ)
        while STOP is None:
            now = time.monotonic()
            if now >= deadline:
                stop(phase+'_deadline')
                break
            if now >= next_resource:
                next_resource = now + .2
                rows, incomplete = mechanism.owned(seconds=.025, direct=direct)
                if incomplete or len(rows) > 32:
                    stop('resource_discovery_bound')
                    break
                rss = 0
                until = time.monotonic()+.025
                for row in rows:
                    if time.monotonic() >= min(until, deadline):
                        raise RuntimeError('resource observation deadline')
                    try:
                        with Path(f"/proc/{row['pid']}/status").open('rb') as stream:
                            body = stream.read(8193)
                        if len(body) > 8192:
                            raise RuntimeError('proc status bound')
                        if mechanism.stat(row['pid'])['start'] != row['start']:
                            raise RuntimeError('resource identity changed')
                        for line in body.splitlines():
                            if line.startswith(b'VmRSS:'):
                                rss += int(line.split()[1])*1024
                    except FileNotFoundError:
                        pass  # A raced exit cannot contribute live RSS at this instant.
                resource_samples.append({'at': now, 'owned': len(rows), 'rss': rss})
                if len(resource_samples) > 400 or rss > 3*1024**3:
                    stop('resource_bound')
                    break
            for key, _ in selector.select(min(.02, max(0, deadline-time.monotonic()))):
                data = os.read(key.fd, 65536)
                if not data:
                    selector.unregister(key.fileobj)
                    eof = True
                    continue
                keep = data[:max(0, CAP-total)]
                written, whole = evidence.capture_write(output, keep)
                total += written
                if not whole:
                    raise RuntimeError('capture short write')
                if len(keep) != len(data) or total >= CAP:
                    capture_complete = False
                    stop('output_bound')
                    break
                pending += data
                while b'\n' in pending:
                    if time.monotonic() >= deadline:
                        stop(phase+'_deadline')
                        break
                    line, pending = pending.split(b'\n', 1)
                    if len(line) > 65536:
                        raise RuntimeError('line bound')
                    if line.startswith(b'DESK_DIAG '):
                        event = json.loads(line[10:])
                        pid, kind = event['pid'], event['event']
                        if (event.get('token') != token or event['seq'] != seq.get(pid, 0)+1 or
                                (pid not in seq and len(seq) >= 4)):
                            raise RuntimeError('marker identity/sequence')
                        seq[pid] = event['seq']
                        counts[kind] = counts.get(kind, 0)+1
                        occurrence = event['occurrence']
                        if kind == 'case-enter':
                            if phase != 'setup' or counts[kind] != 1 or occurrence != 1 or not event['case'].endswith(CASE):
                                raise RuntimeError('unexpected/duplicate case')
                            # Linux Node hrtime and Python monotonic share CLOCK_MONOTONIC.
                            # Charge delivery latency against the whole-case budget.
                            operation_start = int(event['ns']) / 1e9
                            age = time.monotonic()-operation_start
                            if not 0 <= age <= .25 or operation_start < started:
                                raise RuntimeError('clock/marker delivery bound')
                            phase, deadline, case_pid = 'operation', operation_start+OPERATION, pid
                        elif occurrence != 0:
                            if occurrence != 1 or pid != case_pid or not event['case'].endswith(CASE):
                                raise RuntimeError('case identity mismatch')
                        if kind == 'native-enter':
                            key_call = (pid, event['call'])
                            if key_call in outstanding or len(outstanding) >= 4:
                                raise RuntimeError('native overlap/bound')
                            outstanding[key_call] = event
                            if occurrence == 1:
                                if phase != 'operation' or len(calls) >= 2:
                                    raise RuntimeError('native outside proof')
                                expected_boundary = ['subject', 'reference'][len(calls)]
                                if (event['boundary'] != expected_boundary or event['executable'] != 'unzip' or
                                        len(event['argv']) != 3 or event['argv'][0] != '-p' or
                                        event['argv'][2] != 'ARTIFACT_INVENTORY.json' or
                                        event['options'] != {'maxBuffer': 1, 'killSignal': 'SIGKILL'}):
                                    raise RuntimeError('native proof invocation mismatch')
                                if calls and event['argv'] != calls[0]['enter']['argv']:
                                    raise RuntimeError('subject/reference path mismatch')
                                calls.append({'enter': event})
                        elif kind in ('native-return', 'native-throw'):
                            entry = outstanding.pop((pid, event['call']), None)
                            if entry is None:
                                raise RuntimeError('unmatched native exit')
                            if occurrence == 1:
                                if kind != 'native-throw' or event['native']['code'] != 'ENOBUFS':
                                    raise RuntimeError('real overflow evidence absent')
                                if type(event['native']['pid']) is not int or event['native']['pid'] <= 0:
                                    raise RuntimeError('native PID evidence absent')
                                calls[-1]['exit'] = event
                        elif kind == 'proof-return':
                            if phase != 'operation' or len(calls) != 2 or not all('exit' in c for c in calls) or outstanding:
                                raise RuntimeError('proof completion order')
                            if event['profile'] != 'L' or event['route'] != [0, 0, 0, 1, 0]:
                                raise RuntimeError('L route mismatch')
                            operation_end = int(event['ns'])/1e9
                            if not 0 <= operation_end-operation_start <= OPERATION:
                                raise RuntimeError('operation marker deadline')
                            phase = 'capture'
                            capture_start = time.monotonic()  # Receipt time; not the deadline anchor.
                            capture_deadline = operation_end+CAPTURE
                            if capture_start >= capture_deadline:
                                raise RuntimeError('capture deadline exhausted at marker receipt')
                            deadline = capture_deadline
                        elif kind == 'cleanup-enter':
                            if phase != 'capture' or cleanup_enter or event['state'] != 'pass':
                                raise RuntimeError('cleanup entry/state')
                            cleanup_enter = True
                        elif kind == 'cleanup-return':
                            if not cleanup_enter or cleanup_return:
                                raise RuntimeError('cleanup completion order')
                            cleanup_return = True
                    parsed += len(line)+1
                if len(pending) > 65536:
                    raise RuntimeError('partial line bound')
                if STOP:
                    break
            status = os.waitid(os.P_PID, proc.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
            if status is not None and eof:
                stop('natural_exit')
    except BaseException as error:
        capture_complete = False
        errors.append(type(error).__name__+':'+str(error))
        stop('controller_error')
    finally:
        if proc is not None:
            observation_start = time.monotonic()
            try:
                # Existing helper:1s discovery, <=1s stop signalling,1s detail.
                snapshot = evidence.process_snapshot(mechanism, direct, STOP != 'natural_exit')
            except BaseException as error:
                errors.append('snapshot:'+type(error).__name__)
            settlement_start = time.monotonic()
            settlement = mechanism.settle(proc, direct, budget=SETTLEMENT)
            settlement_end = time.monotonic()
        for name, handle in [('selector', selector), ('output', output), ('pipe', proc.stdout if proc else None)]:
            if handle is not None:
                try:
                    handle.close()
                except BaseException as error:
                    errors.append(name+'_close:'+type(error).__name__)
        capture_complete = capture_complete and eof and not pending and parsed == total
    if proc is not None and (settlement is None or not settlement['settled']):
        if INTERRUPTED is not None:
            errors.append('interrupted:'+INTERRUPTED)
        try:
            evidence.write_json(OUT/'result.json', {'completed': False, 'reason': STOP,
                'interrupted': INTERRUPTED, 'settlement': settlement, 'errors': errors,
                'meaning': 'HOLD: executor teardown required'})
        except BaseException as error:
            errors.append('unsettled_result_write:'+type(error).__name__+':'+str(error)[:200])
        finally:
            # Unconditional; never returns. Record failure above cannot skip it.
            # INTERRUPTED is re-read here so a signal during the write above is retained in the detail.
            mechanism.quarantine(OUT, 'native proof ownership uncertain',
                {'settlement': settlement, 'errors': errors, 'interrupted': INTERRUPTED})
    try:
        verify(manifest)
    except BaseException as error:
        errors.append('postflight:'+str(error))
    # Single read after the last check: this value alone feeds errors, completed and result.json,
    # so the committed record is self-consistent. Later signals are handled at the exit decision.
    interrupted = INTERRUPTED
    if interrupted is not None:
        errors.append('interrupted:'+interrupted)
    completed = (STOP == 'natural_exit' and interrupted is None and proc is not None and proc.returncode == 0
        and settlement is not None and settlement['settled'] and not errors and capture_complete
        and not outstanding and len(calls) == 2 and all('exit' in call for call in calls)
        and operation_end is not None and cleanup_return
        and counts.get('case-enter') == counts.get('proof-return') == 1
        and counts.get('module-enter') == counts.get('registration-complete') == 1
        and snapshot is not None and not snapshot['incomplete']
        and not any(row['state'] != 'Z' for row in snapshot['rows']))
    evidence.write_json(OUT/'result.json', {'completed': completed, 'reason': STOP, 'interrupted': interrupted,
        'diagnostic_runner_exit': proc.returncode if proc else None, 'native_calls': calls,
        'errors': errors, 'settlement': settlement, 'capture_complete': capture_complete,
        'output_eof': eof, 'retained_bytes': total, 'parsed_bytes': parsed,
        'outstanding': list(outstanding.values()), 'event_counts': counts,
        'times_monotonic': {'launch': started, 'operation_start': operation_start,
            'operation_end': operation_end, 'capture_start': capture_start,
            'capture_deadline': capture_deadline,
            'observation_start': observation_start, 'settlement_start': settlement_start,
            'settlement_end': settlement_end, 'finished': time.monotonic()},
        'resource_samples': resource_samples,
        'meaning': 'One versioned-policy observation. Native signal/status are separate from runner exit. No original-CI causality or CI-equivalence claim.'})
    # result.json is written once (exclusive) and cannot reflect a later signal. A signal seen at the
    # sample below appears in stdout's interrupted_after_record; one arriving during print or later is
    # visible only as the nonzero exit from the re-read at return. Success = exit 0 AND completed:true
    # AND no interruption; the record alone is never sufficient. A signal after the last read is unobservable.
    late = INTERRUPTED if interrupted is None else None
    print(json.dumps({'completed': completed, 'reason': STOP, 'interrupted': interrupted,
        'interrupted_after_record': late, 'evidence': str(OUT)}), flush=True)
    return 0 if completed and INTERRUPTED is None else 1


if __name__ == '__main__':
    raise SystemExit(main())
