#!/usr/bin/python3
"""Inert startup regression for launch.main(): reaches the real signal-registration path.

Intended invocation (repository root, never on the hosted proof path):
    /usr/bin/python3 -I -B tools/native-kill-proof/test_launch_startup.py -v

Dependencies, all explicit:
  * the real launch.py and real evidence.py are imported (module level is definitions only);
  * the real main() runs: argparse, hosted-env gate, manifest read and SHA-256 binding, base binding;
  * mocked: launch.verify (full-tree hash walk), launch.OUT (once-latch directory, so nothing is
    created), evidence.load_mechanism (ownership helper, so no subreaper/pidfd setup),
    signal.signal (recorded, never delegated, so no real handler changes), shutil.which (stop boundary),
    subprocess.Popen (fails the test if reached).
Stop boundary: main() is stopped by a private exception from shutil.which, the first call after the
handler-registration loop, so launch.json, output.log and Popen are never reached.
This is a startup name-binding check only; it makes no claim about native behavior or cancellation.
"""
import hashlib
import os
import signal
import symtable
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import launch  # noqa: E402  (real module; no side effects at import)


class StopAfterRegistration(Exception):
    """Private stop boundary raised by the mocked shutil.which."""


def _main_symbols():
    source = (HERE / 'launch.py').read_text(encoding='utf-8')
    top = symtable.symtable(source, 'launch.py', 'exec')
    return top, top.lookup('main').get_namespace()


class StartupRegistration(unittest.TestCase):
    def test_main_registers_real_handler_before_stop_boundary(self):
        digest = hashlib.sha256((HERE / 'manifest.json').read_bytes()).hexdigest()
        calls = []

        def record(number, handler):
            calls.append((number, handler))

        fake_out = mock.MagicMock(name='OUT')
        fake_mechanism = SimpleNamespace(prerequisite=lambda: {'inert': True})
        verified = []
        env = {'GITHUB_ACTIONS': 'true', 'GITHUB_RUN_ATTEMPT': '1'}
        argv = ['launch.py', '--released-run-id', 'native-kill-boxed-zero-002',
                '--manifest-sha256', digest]

        def stop(_name):
            raise StopAfterRegistration()

        with mock.patch.object(sys, 'argv', argv), \
                mock.patch.dict(os.environ, env), \
                mock.patch.object(launch, 'verify', lambda manifest: verified.append(len(manifest['files']))), \
                mock.patch.object(launch, 'OUT', fake_out), \
                mock.patch.object(launch.evidence, 'load_mechanism', lambda: fake_mechanism), \
                mock.patch.object(signal, 'signal', record), \
                mock.patch.object(launch.shutil, 'which', stop), \
                mock.patch.object(launch.subprocess, 'Popen', side_effect=AssertionError('Popen reached')):
            with self.assertRaises(StopAfterRegistration):
                launch.main()

        self.assertEqual(len(verified), 1)
        self.assertGreater(verified[0], 0)
        self.assertEqual(
            calls,
            [(signal.SIGCHLD, signal.SIG_DFL),
             (signal.SIGTERM, launch.interrupted), (signal.SIGINT, launch.interrupted),
             (signal.SIGHUP, launch.interrupted), (signal.SIGUSR1, launch.interrupted)])
        self.assertTrue(all(handler is launch.interrupted for _n, handler in calls[1:]))
        self.assertEqual(fake_out.mkdir.call_count, 1)

    def test_registered_handler_sets_sticky_flag_without_signals(self):
        with mock.patch.object(launch, 'INTERRUPTED', None), mock.patch.object(launch, 'STOP', None):
            launch.interrupted(signal.SIGTERM, None)
            launch.interrupted(signal.SIGUSR1, None)
            self.assertEqual(launch.INTERRUPTED, 'signal_%d' % int(signal.SIGTERM))
            self.assertEqual(launch.STOP, 'signal_%d' % int(signal.SIGTERM))

    def test_static_main_resolves_handler_globally(self):
        top, main = _main_symbols()
        self.assertTrue(top.lookup('interrupted').is_assigned())
        self.assertIn('interrupted', main.get_identifiers())
        self.assertFalse(main.lookup('interrupted').is_local())
        self.assertTrue(main.lookup('interrupted').is_global())
        self.assertTrue(main.lookup('final_interrupted').is_local())
        self.assertTrue(main.lookup('final_interrupted').is_assigned())

    def test_no_main_local_shadows_a_module_function_it_calls(self):
        top, main = _main_symbols()
        functions = {s.get_name() for s in top.get_symbols() if s.is_namespace()}
        shadowed = sorted(s.get_name() for s in main.get_symbols()
                          if s.is_local() and s.get_name() in functions)
        self.assertEqual(shadowed, [])


if __name__ == '__main__':
    unittest.main()
