#!/usr/bin/python3
"""Finite deterministic A+B checks. Explicit invocation only; no real children."""
import contextlib
import errno
import importlib.util
from pathlib import Path
import signal
from types import SimpleNamespace
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('p33_guard_review', Path(__file__).with_name('p33-parity-supervisor.py'))
G = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(G)


class Clock:
    def __init__(self):
        self.now = 0.0

    def sleep(self, seconds):
        if seconds < 0:
            raise AssertionError('negative sleep')
        self.now += seconds


class Entries:
    def __init__(self, *pids):
        self.entries = [SimpleNamespace(name=str(pid)) for pid in pids]

    def __enter__(self):
        return iter(self.entries)

    def __exit__(self, *args):
        return False


def row(pid=200, ppid=100, state='S'):
    return {'pid': pid, 'ppid': ppid, 'start': pid*10, 'state': state,
            'pgid': 200, 'sid': 200}


class DiscoveryChecks(unittest.TestCase):
    def settlement(self, fail_phase=None, fail_kind='stat_error', exhaust_final=False):
        clock = Clock()
        proc = SimpleNamespace(pid=200, returncode=None)
        events = []
        failures = set()
        state = {'signal': None, 'reaped': False}

        def killpg(pid, sig):
            self.assertEqual(pid, 200)
            state['signal'] = sig
            events.append(('signal', sig, clock.now))

        def waitid(*args):
            return object() if state['signal'] == signal.SIGKILL else None

        def waitpid(*args):
            events.append(('consume', clock.now))
            if not state['reaped']:
                state['reaped'] = True
                if exhaust_final:
                    clock.now = .99
                return 200, 9
            events.append(('echild', clock.now))
            raise ChildProcessError()

        def discover(**kwargs):
            phase = kwargs['phase']
            started = clock.now
            events.append(('scan', phase, started, kwargs['deadline'], kwargs['phase_until']))
            self.assertAlmostEqual(kwargs['deadline']-kwargs['reserved_at'], .025)
            self.assertLessEqual(kwargs['deadline'], kwargs['phase_until'])
            scan = G.DiscoveryScan(kwargs['evidence'], phase, started, kwargs['deadline'],
                                   kwargs['phase_until'], kwargs['direct'], kwargs['reserved_at'])
            if phase == fail_phase and phase not in failures:
                scan.fail(fail_kind, 'deterministic_injected_failure', pid=200)
                failures.add(phase)
            clock.now += .01
            incomplete = scan.finish()
            return ([] if phase == 'final' else [row(state='Z' if phase == 'kill' else 'S')]), incomplete

        with contextlib.ExitStack() as stack:
            stack.enter_context(patch.object(G.time, 'monotonic', lambda: clock.now))
            stack.enter_context(patch.object(G.time, 'sleep', clock.sleep))
            stack.enter_context(patch.object(G.os, 'killpg', killpg))
            stack.enter_context(patch.object(G.os, 'waitid', waitid))
            stack.enter_context(patch.object(G.os, 'waitpid', waitpid))
            stack.enter_context(patch.object(G, 'owned', discover))
            stack.enter_context(patch.object(G, 'signal_rows', lambda *args: set()))
            result = G._settle(proc, row())
        return result, events

    def test_unstarted_scan_keeps_cutoff_and_is_not_observation(self):
        result, events = self.settlement()
        self.assertTrue(result['settled'])
        first_kill = next(e[2] for e in events if e[0] == 'signal' and e[1] == signal.SIGKILL)
        self.assertGreaterEqual(first_kill, .25)
        self.assertLess(first_kill, .75)
        detail = result['discoveryDetails']
        self.assertGreater(detail['scansNotStarted'], 0)
        self.assertEqual(detail['scansStarted'], sum(e[0] == 'scan' for e in events))
        self.assertEqual(detail['scansCompleted'], detail['scansStarted'])
        self.assertTrue(any(r['event'] == 'phase_scan_not_started' for r in detail['records']))
        final_index = next(i for i, e in enumerate(events) if e[:2] == ('scan', 'final'))
        self.assertTrue(any(e[0] == 'echild' for e in events[:final_index]))

    def test_phase_observation_failures_stay_sticky(self):
        for phase in ('term', 'kill'):
            for kind in ('deadline', 'stat_error', 'direct_identity', 'child_identity'):
                with self.subTest(phase=phase, kind=kind):
                    result, _ = self.settlement(fail_phase=phase, fail_kind=kind)
                    self.assertFalse(result['settled'])
                    self.assertEqual(result['errors'], ['discovery_incomplete'])
                    self.assertTrue(result['complete'])
                    self.assertTrue(result['noChildren'])
                    self.assertEqual(result['residual'], [])
                    self.assertEqual(result['discoveryDetails']['reasonCounts'][phase+':'+kind], 1)

    def test_final_failed_scan_is_not_erased_by_later_complete_scan(self):
        result, events = self.settlement(fail_phase='final')
        self.assertFalse(result['settled'])
        self.assertTrue(result['complete'])
        self.assertEqual(result['errors'], ['discovery_incomplete'])
        self.assertEqual(sum(e[:2] == ('scan', 'final') for e in events), 2)

    def test_echild_without_fresh_final_scan_remains_hold(self):
        result, events = self.settlement(exhaust_final=True)
        self.assertTrue(result['directReaped'])
        self.assertTrue(result['noChildren'])
        self.assertFalse(result['complete'])
        self.assertFalse(result['settled'])
        self.assertFalse(any(e[:2] == ('scan', 'final') for e in events))
        self.assertTrue(any(r['event'] == 'phase_scan_not_started' and r['phase'] == 'final'
                            for r in result['discoveryDetails']['records']))

    def observe(self, stat_fn, entries, direct=None, inject_empty=False, deadline=.025):
        evidence = G.DiscoveryEvidence()
        with patch.object(G.time, 'monotonic', lambda: 0.0), \
             patch.object(G.os, 'getpid', lambda: 100), \
             patch.object(G.os, 'scandir', lambda path: Entries(*entries)), \
             patch.object(G, 'stat', stat_fn), \
             patch.object(G, 'INJECT_EMPTY', inject_empty):
            rows, incomplete = G.owned(direct=direct, deadline=deadline, evidence=evidence,
                                       phase='term', phase_until=.25, reserved_at=0.0)
        return rows, incomplete, evidence.report()

    def test_missing_known_child_corroboration_is_failure(self):
        _, incomplete, evidence = self.observe(lambda pid: row(pid), [], direct=row(), inject_empty=True)
        self.assertTrue(incomplete)
        self.assertIn('term:direct_corroboration', evidence['reasonCounts'])

    def test_enumerated_enoent_differs_from_known_child_enoent(self):
        def gone(pid):
            raise FileNotFoundError(errno.ENOENT, 'synthetic')
        _, incomplete, _ = self.observe(gone, [999])
        self.assertFalse(incomplete)
        _, incomplete, evidence = self.observe(gone, [200], direct=row())
        self.assertTrue(incomplete)
        self.assertEqual(evidence['records'][0]['firstFailure']['stage'], 'direct_identity')

    def test_read_parse_failures_are_not_disappearance(self):
        for failure in (PermissionError(errno.EACCES, 'synthetic'), ValueError('synthetic'), IndexError('synthetic')):
            with self.subTest(kind=type(failure).__name__):
                def unreadable(pid):
                    raise failure
                _, incomplete, evidence = self.observe(unreadable, [999])
                self.assertTrue(incomplete)
                detail = evidence['records'][0]['firstFailure']
                self.assertEqual(detail['kind'], 'stat_error')
                self.assertEqual(detail['error'], type(failure).__name__)
                self.assertEqual(detail['errno'], getattr(failure, 'errno', None))

    def test_unproved_reparenting_remains_failure(self):
        seen = {201: 0}
        def moving(pid):
            if pid == 201:
                seen[201] += 1
                return row(201, 200 if seen[201] == 1 else 100)
            return row(pid)
        _, incomplete, evidence = self.observe(moving, [200, 201], direct=row())
        self.assertTrue(incomplete)
        detail = evidence['records'][0]['firstFailure']
        self.assertEqual(detail['kind'], 'child_identity')
        self.assertEqual(detail['expected']['ppid'], 200)
        self.assertEqual(detail['observed']['ppid'], 100)
        self.assertEqual(detail['expected']['start'], detail['observed']['start'])

    def test_expired_attempt_is_failure_not_skipped_scan(self):
        _, incomplete, evidence = self.observe(lambda pid: row(pid), [], deadline=0.0)
        self.assertTrue(incomplete)
        self.assertEqual(evidence['scansStarted'], 1)
        self.assertEqual(evidence['scansNotStarted'], 0)
        self.assertEqual(evidence['scansFailed'], 1)
        self.assertEqual(evidence['records'][0]['firstFailure']['kind'], 'deadline')

    def test_causal_evidence_is_bounded_with_counts(self):
        evidence = G.DiscoveryEvidence()
        with patch.object(G.time, 'monotonic', lambda: .01):
            for _ in range(10):
                scan = G.DiscoveryScan(evidence, 'term', 0.0, .025, .25, row(), 0.0)
                scan.fail('stat_error', 'table_stat', pid=200, errno=errno.EACCES)
                self.assertTrue(scan.finish())
        detail = evidence.report()
        self.assertEqual(len(detail['records']), 8)
        self.assertEqual(detail['droppedRecords'], 2)
        self.assertEqual(detail['reasonCounts']['term:stat_error'], 10)
        self.assertEqual(detail['scansFailed'], 10)
        evidence.records[0]['synthetic_oversize'] = 'x' * 16384
        with self.assertRaisesRegex(ValueError, 'discovery evidence bound'):
            evidence.report()


if __name__ == '__main__':
    unittest.main(verbosity=2)
