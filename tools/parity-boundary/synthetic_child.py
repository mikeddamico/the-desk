"""Fixed synthetic fixture producer; never imports project, Vitest or unzip."""
import json
import os
from pathlib import Path
import signal
import socket
import sys
import time


def process_identity(pid):
    text = Path(f'/proc/{pid}/stat').read_text()
    fields = text[text.rfind(')')+2:].split()
    return {'pid': pid, 'start': int(fields[19])}


def normal_records(runtime, pid):
    """Fabricated success-shaped records, explicitly synthetic, not P33 execution."""
    attempt = runtime/'attempt-synthetic'
    attempt.mkdir()
    nonce = 'a'*48
    folder = attempt/nonce
    folder.mkdir()
    sock = socket.socket(socket.AF_UNIX)
    sock.bind(str(attempt/'guard.sock'))
    sock.close()  # Deliberately leave the socket entry, like the unchanged guard.
    settlement = {'settled': True, 'directReaped': True, 'noChildren': True, 'complete': True,
                  'errors': [], 'residual': [], 'cleanupErrors': [],
                  'reaped': [{'pid': pid, 'raw': 0, 'exit': 0}]}
    files = {'prerequisite.json': {'subreaper': True, 'pidfdSignal0': True, 'proc': True,
                                 'executable': os.path.realpath('/usr/bin/python3')},
             'guard-result.json': {**settlement, 'fatal': None, 'containedRejection': None},
             nonce+'/completion.json': {'protocol': 1, 'nonce': nonce, 'case': 'P33 multidisk',
                                      'assertionsCompleted': True, 'hooksCompleted': True},
             nonce+'/result.json': {**settlement, 'protocol': 1, 'nonce': nonce, 'mode': 'p33',
                                   'outcome': 'COMPLETED', 'reason': 'child_exit',
                                   'childStarted': True, 'controls': []}}
    for name, data in files.items():
        (attempt/name).write_text(json.dumps(data)+'\n')
    (folder/'output.log').write_text('SYNTHETIC RECORD FIXTURE ONLY\n')


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ('control-normal-001', 'control-deadline-001'):
        raise RuntimeError('fixed synthetic modes only')
    output = Path(os.environ['DESK_DIAG_OUTPUT'])
    runtime = Path(os.environ['DESK_DIAG_P33_RUNTIME'])
    token = os.environ['DESK_DIAG_TOKEN']
    sequence = 0
    def mark(event, occurrence=0, name='<module-init>', **fields):
        nonlocal sequence
        sequence += 1
        data = {'token': token, 'seq': sequence, 'pid': os.getpid(), 'ns': str(time.monotonic_ns()),
                'occurrence': occurrence, 'case': name, 'event': event, **fields}
        raw = ('DESK_DIAG '+json.dumps(data)+'\n').encode()
        if len(raw) > 4096 or os.write(1, raw) != len(raw):
            raise RuntimeError('synthetic marker write')
    mark('module-enter')
    mark('registration-complete')
    ready = [process_identity(os.getpid())]
    if sys.argv[1] == 'control-normal-001':
        normal_records(runtime, os.getpid())
        for i in range(1, 433):
            name = 'P33 multidisk' if i == 432 else 'synthetic case '+str(i)
            mark('case-enter', i, name)
            mark('cleanup-enter', i, name, state='pass')
            mark('cleanup-return', i, name)
        (output/'synthetic-ready.json').write_text(json.dumps({'synthetic': True, 'processes': ready}))
        return 0
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    read_fd, write_fd = os.pipe()
    child = os.fork()
    if child == 0:
        os.close(read_fd)
        os.setsid()
        os.write(write_fd, b'R')
        os.close(write_fd)
        while True:
            signal.pause()
    os.close(write_fd)
    if os.read(read_fd, 1) != b'R':
        raise RuntimeError('descendant readiness')
    os.close(read_fd)
    ready.append(process_identity(child))
    (output/'synthetic-ready.json').write_text(json.dumps({'synthetic': True, 'processes': ready}))
    mark('case-enter', 1, 'synthetic deadline')
    mark('native-enter', 1, 'synthetic deadline', call=1, boundary='synthetic',
         executable='synthetic-owned-wait', argv=[])
    while True:
        signal.pause()


if __name__ == '__main__':
    raise SystemExit(main())
