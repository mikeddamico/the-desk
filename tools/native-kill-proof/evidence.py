"""Read-only retained evidence helpers; main/guard are never invoked here."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import signal
import stat
import time
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / ".native-kill-proof-001"

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


