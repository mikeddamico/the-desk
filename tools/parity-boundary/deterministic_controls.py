"""Finite deterministic controls; no child, prerequisite, signal, project or extraction."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import stat
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch
import controller as c
import control_launcher as launcher
import synthetic_child as fixture


def event(kind, occurrence=1, name='P33 multidisk', seq=1):
    return {'pid': 123, 'occurrence': occurrence, 'case': name, 'seq': seq, 'event': kind, 'state': 'pass'}


class Controls(unittest.TestCase):
    def test_returned_signalling_errors_are_sticky(self):
        mechanism=MagicMock()
        mechanism.signal_rows.return_value={'signal_row:PermissionError','signal_row:ProcessLookupError'}
        errors=['earlier_signal_error']; original='launcher_wait_bound'
        with patch.object(launcher.time,'monotonic',return_value=10):
            launcher.request_term(mechanism,{'pid':123,'start':456},errors)
        mechanism.signal_rows.assert_called_once_with([{'pid':123,'start':456}],launcher.signal.SIGTERM,10.25)
        self.assertEqual(errors,['earlier_signal_error','signal_row:PermissionError','signal_row:ProcessLookupError'])
        self.assertEqual(original,'launcher_wait_bound')
        self.assertFalse(launcher.no_launcher_errors(original,errors,[]))
        self.assertFalse(launcher.no_launcher_errors(None,errors,[]))

    def test_each_close_failure_is_sticky_and_does_not_skip_later_closes(self):
        for failing in [('selector',),('log',),('stdout',),('selector','log','stdout')]:
            with self.subTest(failing=failing):
                attempted=[]; errors=['earlier_finalization_error']
                resources=[]
                for name in ('selector','log','stdout'):
                    def close(name=name):
                        attempted.append(name)
                        if name in failing: raise OSError('injected '+name)
                    resources.append((name,SimpleNamespace(close=close)))
                launcher.close_each(resources,errors)
                self.assertEqual(attempted,['selector','log','stdout'])
                self.assertEqual(errors,['earlier_finalization_error']+[name+':OSError:injected '+name for name in failing])
                self.assertFalse(launcher.no_launcher_errors(None,[],errors))
        self.assertTrue(launcher.no_launcher_errors(None,[],[]))

    def test_valid_lifecycle(self):
        ledger = c.CaseLedger()
        for i in range(1, 433):
            for j, kind in enumerate(('case-enter', 'cleanup-enter', 'cleanup-return')):
                ledger.observe(event(kind, i, 'case '+str(i), i*3+j))
        self.assertTrue(ledger.report()['all_expected_pairs_complete'])

    def test_invalid_lifecycles(self):
        vectors = [
            [event('cleanup-enter')], [event('cleanup-return')],
            [event('case-enter'), event('case-enter')],
            [event('case-enter'), event('cleanup-return')],
            [event('case-enter'), event('cleanup-enter', name='wrong')],
            [event('case-enter'), event('cleanup-enter', occurrence=2)],
            [event('case-enter'), event('cleanup-enter'), event('cleanup-enter')],
            [event('case-enter'), event('cleanup-enter'), event('cleanup-return'), event('cleanup-return')],
            [event('case-enter'), event('cleanup-enter'), event('cleanup-return'), event('case-enter')],
            [event('case-enter'), event('case-enter', occurrence=2)],
        ]
        for events in vectors:
            with self.subTest(events=events), self.assertRaises(RuntimeError):
                ledger = c.CaseLedger()
                for item in events:
                    ledger.observe(item)

    def test_capture_classifications(self):
        self.assertEqual(c.capture_flags(True, True, 10, 10)['parsing_status'], 'complete')
        self.assertFalse(c.capture_flags(False, True, 10, 10)['capture_complete'])
        self.assertEqual(c.capture_flags(True, True, 5, 10)['parsing_status'], 'censored_prefix')
        self.assertFalse(c.capture_flags(True, False, 10, 10)['capture_complete'])

    def test_short_write_and_serialization(self):
        for value in (0, 2):
            stream = MagicMock(); stream.write.return_value = value
            self.assertEqual(c.capture_write(stream, b'abc'), (value, False))
        stream = MagicMock(); stream.write.return_value = None
        with self.assertRaises(RuntimeError): c.capture_write(stream, b'abc')
        path = MagicMock(); path.open.return_value.__enter__.return_value.write.return_value = 0
        with self.assertRaises(RuntimeError): c.write_json(path, {'value': 1})
        path = MagicMock()
        with self.assertRaises(TypeError): c.write_json(path, {'value': object()})
        path.open.assert_not_called()

    def test_socket_scope_type_owner(self):
        root = Path('/synthetic-runtime'); attempt = root/'attempt-fresh'
        info = SimpleNamespace(st_mode=stat.S_IFSOCK|0o600, st_uid=1000)
        self.assertTrue(c.expected_guard_socket(attempt, root, 'guard.sock', 1, info, 1000, ['attempt-fresh']))
        for directory, depth, name in [(root, 0, 'guard.sock'), (attempt/'nonce', 2, 'guard.sock'),
                                       (attempt, 1, 'other.sock'), (root/'attempt-old', 1, 'guard.sock')]:
            self.assertIsNone(c.expected_guard_socket(directory, root, name, depth, info, 1000, ['attempt-fresh']))
        for mode, uid in [(stat.S_IFREG,1000), (stat.S_IFLNK,1000), (stat.S_IFSOCK,1001)]:
            self.assertFalse(c.expected_guard_socket(attempt, root, 'guard.sock', 1,
                SimpleNamespace(st_mode=mode, st_uid=uid),1000,['attempt-fresh']))

    def test_retention_layout_and_failures(self):
        for scenario in ('valid_socket', 'stale_identity', 'extra_attempt', 'absent', 'missing', 'malformed', 'traversal'):
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory(prefix='desk-diag-control-') as temp:
                root = Path(temp); runtime = root/'runtime'; runtime.mkdir(mode=0o700)
                output = root/'output'; output.mkdir()
                with patch.object(fixture.socket, 'socket'):
                    fixture.normal_records(runtime, 123)  # Socket is virtual in this deterministic fixture.
                info = runtime.lstat()
                binding = {'path':str(runtime),'device':info.st_dev,'inode':info.st_ino,'uid':info.st_uid}
                ledger = c.CaseLedger()
                for kind in ('case-enter','cleanup-enter','cleanup-return'): ledger.observe(event(kind))
                attempt = runtime/'attempt-synthetic'
                if scenario == 'stale_identity': binding['inode'] += 1
                if scenario == 'extra_attempt': (runtime/'attempt-old').mkdir()
                if scenario == 'absent': shutil.rmtree(runtime)
                if scenario == 'missing': (attempt/('a'*48)/'completion.json').unlink()
                if scenario == 'malformed': (attempt/('a'*48)/'result.json').write_text('{')
                scan = os.scandir
                class Entries:
                    def __init__(self, path):
                        if scenario == 'traversal': raise PermissionError('injected traversal')
                        with scan(path) as stream: self.rows = list(stream)
                        if Path(path) == attempt:
                            self.rows.append(SimpleNamespace(name='guard.sock',path=str(attempt/'guard.sock'),
                                stat=lambda **_: SimpleNamespace(st_mode=stat.S_IFSOCK|0o600,st_uid=os.getuid())))
                    def __enter__(self): return iter(self.rows)
                    def __exit__(self,*_): return False
                real_open = os.open
                def checked_open(path,*args,**kwargs):
                    self.assertNotEqual(Path(path).name,'guard.sock')
                    return real_open(path,*args,**kwargs)
                with patch.object(c,'OUT',output), patch.object(c.os,'scandir',Entries), patch.object(c.os,'open',checked_open):
                    result = c.retain_p33(binding,ledger)
                if scenario == 'valid_socket':
                    self.assertEqual(result['status'],'complete'); self.assertEqual(result['files'],5)
                    self.assertFalse((output/'p33/attempt-synthetic/guard.sock').exists())
                else:
                    self.assertNotEqual(result['status'],'complete'); self.assertTrue(result['errors'])


if __name__ == '__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--manifest-sha256',required=True); args=parser.parse_args()
    actual=hashlib.sha256((c.HERE/'manifest.json').read_bytes()).hexdigest()
    if actual != args.manifest_sha256: raise RuntimeError('reviewed manifest mismatch')
    c.verify()
    output=c.ROOT/'.parity-boundary-controls'; output.mkdir(exist_ok=True)
    (output/'deterministic.attempt').open('x').close()
    stream=io.StringIO()
    result=unittest.TextTestRunner(stream=stream,verbosity=2,failfast=True).run(unittest.defaultTestLoader.loadTestsFromTestCase(Controls))
    log=stream.getvalue(); (output/'deterministic.log').write_text(log)
    c.write_json(output/'deterministic.json',{'accepted':result.wasSuccessful(),'tests':result.testsRun,
                                           'manifest_sha256':actual,'meaning':'deterministic controls only'})
    print(log,end=''); raise SystemExit(0 if result.wasSuccessful() else 1)
