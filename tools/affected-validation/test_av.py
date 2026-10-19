#!/usr/bin/python3
"""PROPOSED inert regression for av.py (affected-validation-001). NOT EXECUTED; needs separate release.

Intended bounded invocation (repository root; any trusted Linux host; never required by the hosted workflow):
    timeout 30 /usr/bin/python3 -I -B tools/affected-validation/test_av.py -v

It imports av.py (module level defines constants and functions only) and exercises its pure evidence checks
against SYNTHETIC files created inside tempfile directories. It never starts the P33 guard, Vitest, unzip or
any subprocess, never calls cmd_init (the only function that runs identity probes), never touches the
repository tree, and patches module paths/environment only inside mock contexts. The source-binding tests patch
only av.ROOT (the production code resolves ROOT / MANIFEST_REL), so a missing lookup would surface as a real
failure instead of being masked.

Pinned fail-closed rules: timeout 124, signal 137, cap reach, wrong counts, skipped parity tests,
unsettled/residual/cleanup errors, malformed reap evidence (missing/duplicate/nonpositive/Boolean PIDs, raw/exit
disagreement, absent required keys), non-regular or missing case output, nonce or completion mismatch, a real P33
rejection, manifest digest mismatch with no member read, workflow drift between pre and post binding, tree
drift, and complete-raw-retention (every mandatory file, whole case/attempt directories, short copies).
The focused negative control's CONTAINED_REJECTION with two -9 exits is accepted only as that labeled control.
"""
import hashlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import av  # noqa: E402

NONCES = {'focused': ('a' * 48, 'b' * 48), 'p33': ('c' * 48,), 'parity': ('d' * 48,)}
SUMMARY = {
    'focused': ' Test Files  1 passed (1)\n      Tests  2 passed (2)\n',
    'p33': ' Test Files  1 passed (1)\n      Tests  1 passed | 431 skipped (432)\n',
    'parity': ' Test Files  1 passed (1)\n      Tests  432 passed (432)\n',
}
ATTEMPTS = {'prerequisite': 'attempt-p', 'focused': 'attempt-f', 'p33': 'attempt-3', 'parity': 'attempt-4'}


def reaped(pid=100, raw=0):
    return {'pid': pid, 'raw': raw, 'exit': os.waitstatus_to_exitcode(raw)}


def ledger(**over):
    value = {'settled': True, 'directReaped': True, 'noChildren': True, 'complete': True, 'residual': [],
             'errors': [], 'cleanupErrors': [], 'reaped': [reaped()], 'discoveryDetails': {}}
    value.update(over)
    return value


def case_result(nonce, mode, **over):
    value = {'protocol': 1, 'nonce': nonce, 'mode': mode, 'outcome': 'COMPLETED', 'reason': 'child_exit',
             'controls': [], 'childStarted': True, **ledger()}
    value.update(over)
    return value


def write(path, text):
    Path(path).write_text(text)


def write_json(path, value):
    write(path, json.dumps(value))


def make_stage(stage_dir, runtime, attempt_name, stage, pre_attempts):
    stage_dir, runtime = Path(stage_dir), Path(runtime)
    attempt = runtime / attempt_name
    stage_dir.mkdir(parents=True)
    attempt.mkdir(parents=True)
    write(stage_dir / 'exit', '0\n')
    write(stage_dir / 'limits.txt', av.LIMITS_TEXT)
    write(stage_dir / 'stderr', '')
    write(stage_dir / 'snapshot-status.txt', 'ps-pre 0\nps-post 0\n')
    for name in ('ps-pre.txt', 'ps-post.txt', 'started-utc', 'ended-utc'):
        write(stage_dir / name, 'x\n')
    write(stage_dir / 'pre-attempts', ''.join(a + '\n' for a in pre_attempts))
    write(stage_dir / 'post-attempts', ''.join(a + '\n' for a in pre_attempts + [attempt_name]))
    write_json(attempt / 'prerequisite.json', {
        'python': '3.12.3 (main)', 'executable': os.path.realpath('/usr/bin/python3'), 'kernel': 'k', 'image': None,
        'subreaper': True, 'pidfdSignal0': True, 'proc': True})
    if stage == 'prerequisite':
        write(stage_dir / 'stdout', json.dumps({'prerequisite': True, 'evidence': str(attempt)}) + '\n')
        return attempt
    write(stage_dir / 'stdout', 'noise\n' + SUMMARY[stage] + '   Start at  00:00:00\n')
    write_json(attempt / 'guard-result.json', {'fatal': None, 'containedRejection': None, **ledger()})
    if stage == 'focused':
        first, second = NONCES['focused']
        complete, noncomplete = attempt / first, attempt / second
        for directory in (complete, noncomplete):
            directory.mkdir()
        write(complete / 'output.log', '{"control": 111}\n')
        write(noncomplete / 'output.log', '{"control": 201}\n{"control": 202}\n')
        write_json(complete / 'result.json', case_result(first, 'complete', controls=[111], reaped=[reaped(111)]))
        write_json(noncomplete / 'result.json', case_result(
            second, 'noncomplete', outcome='CONTAINED_REJECTION', reason='deadline', controls=[201, 202],
            reaped=[reaped(201, 9), reaped(202, 9)]))
    else:
        nonce = NONCES[stage][0]
        case = attempt / nonce
        case.mkdir()
        write(case / 'output.log', '')
        write_json(case / 'result.json', case_result(nonce, 'p33', reaped=[reaped(300)]))
        write_json(case / 'completion.json', {'protocol': 1, 'nonce': nonce, 'case': 'P33 multidisk',
                                              'assertionsCompleted': True, 'hooksCompleted': True})
    return attempt


def make_fixture(tmp, stage):
    tmp = Path(tmp)
    attempt = make_stage(tmp / 'stage', tmp / 'runtime', 'attempt-xyz', stage, [])
    return tmp / 'stage', tmp / 'runtime', attempt


def evaluate(stage, mutate=None):
    with tempfile.TemporaryDirectory() as tmp:
        stage_dir, runtime, attempt = make_fixture(tmp, stage)
        if mutate:
            mutate(stage_dir, attempt)
        return av.evaluate_stage(stage, stage_dir, runtime)[0]


def edit_json(path, change):
    value = json.loads(Path(path).read_text())
    change(value)
    write_json(path, value)


def build_full(tmp):
    """A complete synthetic four-stage success under RUNNER_TEMP=tmp, with verdicts derived by evaluate_stage."""
    av_root = Path(tmp) / 'av'
    ev = av_root / 'evidence'
    runtime = av_root / 'tmp' / 'the-desk-p33-1000-abc'
    ev.mkdir(parents=True)
    runtime.mkdir(parents=True)
    seen = []
    for stage in av.STAGES:
        make_stage(ev / stage, runtime, ATTEMPTS[stage], stage, list(seen))
        errors, facts = av.evaluate_stage(stage, ev / stage, runtime)
        assert errors == [], errors
        write_json(ev / ('verdict-%s.json' % stage), {'stage': stage, 'ok': True, 'errors': [], 'facts': facts})
        write_json(ev / ('bind-post-%s.json' % stage), {'ok': True})
        seen.append(ATTEMPTS[stage])
    write_json(ev / 'env.json', {'ok': True})
    write_json(ev / 'bind-pre.json', {'ok': True})
    return av_root, runtime


def collect(tmp):
    with mock.patch.dict(os.environ, {'RUNNER_TEMP': str(tmp), 'GITHUB_SHA': 'f' * 40}):
        assert av.cmd_collect() == 0
    return json.loads((Path(tmp) / 'av' / 'upload' / 'final.json').read_text())


def final_code(tmp, upload_outcome='success'):
    """Run the final gate against the explicit synthetic fixture root `tmp`; both selectors are patched for the whole call."""
    with mock.patch.dict(os.environ, {'RUNNER_TEMP': str(tmp), 'UPLOAD_OUTCOME': upload_outcome}):
        return av.cmd_final()


def mandatory_paths(runtime):
    """Every mandatory raw file recorded by the successful verdicts, as absolute paths."""
    paths = []
    for stage in av.STAGES:
        verdict = json.loads((runtime.parents[1] / 'evidence' / ('verdict-%s.json' % stage)).read_text())
        attempt, files = av.expected_raw(stage, verdict)
        paths += [runtime / attempt / rel for rel, _ in files]
    return paths


class SummaryParsing(unittest.TestCase):
    def test_default_reporter_lines_with_ansi(self):
        text = '\x1b[2m Test Files \x1b[22m 1 passed (1)\n      Tests  1 passed | 431 skipped (432)\n'
        result, problems = av.parse_summary(text)
        self.assertEqual(problems, [])
        self.assertEqual(result['tests'], {'passed': 1, 'skipped': 431, 'total': 432})

    def test_missing_or_duplicate_rows_are_problems(self):
        self.assertTrue(av.parse_summary('nothing\n')[1])
        self.assertTrue(av.parse_summary(SUMMARY['focused'] + SUMMARY['focused'])[1])


class AcceptedEvidence(unittest.TestCase):
    def test_every_stage_accepts_its_expected_synthetic_evidence(self):
        for stage in av.STAGES:
            with self.subTest(stage=stage):
                self.assertEqual(evaluate(stage), [])

    def test_focused_negative_control_has_two_minus_nine_exits_and_is_accepted(self):
        with tempfile.TemporaryDirectory() as tmp:
            stage_dir, runtime, attempt = make_fixture(tmp, 'focused')
            exits = json.loads((attempt / NONCES['focused'][1] / 'result.json').read_text())['reaped']
            self.assertEqual([entry['exit'] for entry in exits], [-9, -9])
            self.assertEqual(av.evaluate_stage('focused', stage_dir, runtime)[0], [])


class FailClosed(unittest.TestCase):
    def assert_rejected(self, stage, mutate):
        self.assertTrue(evaluate(stage, mutate), 'expected at least one error')

    def test_nonzero_timeout_kill_and_signal_exit_records(self):
        for code in ('1', '124', '137', '153'):
            with self.subTest(code=code):
                self.assert_rejected('parity', lambda s, a, code=code: write(s / 'exit', code + '\n'))
        self.assert_rejected('parity', lambda s, a: write(s / 'exit', '0'))

    def test_cap_reached_is_incomplete_capture(self):
        with mock.patch.object(av, 'CAP', 64):
            self.assert_rejected('parity', lambda s, a: write(s / 'stdout', 'x' * 64))

    def test_wrong_limits_record(self):
        self.assert_rejected('parity', lambda s, a: write(s / 'limits.txt', 'core 0 0\nfsize 1 1\n'))

    def test_count_mismatches(self):
        self.assert_rejected('parity', lambda s, a: write(s / 'stdout', ' Test Files  1 passed (1)\n      Tests  431 passed | 1 skipped (432)\n'))
        self.assert_rejected('parity', lambda s, a: write(s / 'stdout', ' Test Files  1 passed (1)\n      Tests  1 failed | 431 passed (432)\n'))
        self.assert_rejected('p33', lambda s, a: write(s / 'stdout', SUMMARY['parity']))
        self.assert_rejected('focused', lambda s, a: write(s / 'stdout', SUMMARY['p33']))

    def test_failure_text_and_fatal_text(self):
        self.assert_rejected('parity', lambda s, a: write(s / 'stdout', SUMMARY['parity'] + ' FAIL  test/x\n'))
        self.assert_rejected('parity', lambda s, a: write(s / 'stderr', 'P33 FATAL: validation quarantined\n'))
        self.assert_rejected('parity', lambda s, a: write(a / 'fatal.json', '{}'))

    def test_guard_ledger_rules(self):
        path = lambda a: a / 'guard-result.json'
        for key, value in (('settled', False), ('directReaped', False), ('noChildren', False), ('complete', False),
                           ('residual', [{'pid': 1}]), ('errors', ['discovery_incomplete']),
                           ('cleanupErrors', ['x']), ('fatal', 'RuntimeError:x'),
                           ('containedRejection', 'real P33 contained rejection'), ('ownershipUnknown', True),
                           ('reaped', []), ('discoveryDetails', None)):
            with self.subTest(key=key):
                self.assert_rejected('parity', lambda s, a, key=key, value=value: edit_json(path(a), lambda v: v.__setitem__(key, value)))
        self.assert_rejected('parity', lambda s, a: edit_json(path(a), lambda v: v.__setitem__('reaped', [reaped(1, 9)])))

    def test_required_guard_and_case_keys(self):
        for key in av.GUARD_KEYS:
            with self.subTest(guard_key=key):
                self.assert_rejected('parity', lambda s, a, key=key: edit_json(a / 'guard-result.json', lambda v: v.pop(key)))
        for key in av.CASE_KEYS:
            with self.subTest(case_key=key):
                self.assert_rejected('p33', lambda s, a, key=key: edit_json(a / NONCES['p33'][0] / 'result.json', lambda v: v.pop(key)))

    def test_malformed_reap_evidence(self):
        bad_entries = (
            {'exit': 0},                                      # no PID and no raw status
            {'pid': 100, 'exit': 0},                          # no raw
            {'raw': 0, 'exit': 0},                            # no PID
            {'pid': 100, 'raw': 0, 'exit': 0, 'extra': 1},    # unknown key
            {'pid': 100, 'raw': 0, 'exit': -9},               # raw/decoded disagree
            {'pid': 100, 'raw': 9, 'exit': 9},                # signal status decoded as exit
            {'pid': 0, 'raw': 0, 'exit': 0},                  # nonpositive PID
            {'pid': -5, 'raw': 0, 'exit': 0},
            {'pid': True, 'raw': 0, 'exit': 0},               # Boolean PID
            {'pid': 100.0, 'raw': 0, 'exit': 0},              # non-integer PID
            {'pid': 100, 'raw': '0', 'exit': 0},              # non-integer raw
            {'pid': 100, 'raw': -1, 'exit': 0},               # negative raw
            {'pid': 100, 'raw': 127, 'exit': 0},              # not a terminal wait status
        )
        for entry in bad_entries:
            with self.subTest(entry=entry):
                self.assert_rejected('parity', lambda s, a, entry=entry: edit_json(a / 'guard-result.json', lambda v: v.__setitem__('reaped', [entry])))
                self.assert_rejected('p33', lambda s, a, entry=entry: edit_json(a / NONCES['p33'][0] / 'result.json', lambda v: v.__setitem__('reaped', [entry])))
        duplicate = [reaped(100), reaped(100)]
        self.assert_rejected('parity', lambda s, a: edit_json(a / 'guard-result.json', lambda v: v.__setitem__('reaped', duplicate)))
        self.assert_rejected('p33', lambda s, a: edit_json(a / NONCES['p33'][0] / 'result.json', lambda v: v.__setitem__('reaped', duplicate)))

    def test_case_output_must_be_a_readable_regular_bounded_file(self):
        def replace_with_directory(s, a):
            (a / NONCES['p33'][0] / 'output.log').unlink()
            (a / NONCES['p33'][0] / 'output.log').mkdir()

        def replace_with_symlink(s, a):
            target = a / 'target.txt'
            write(target, 'x')
            (a / NONCES['p33'][0] / 'output.log').unlink()
            (a / NONCES['p33'][0] / 'output.log').symlink_to(target)

        self.assert_rejected('p33', replace_with_directory)
        self.assert_rejected('p33', replace_with_symlink)
        self.assert_rejected('p33', lambda s, a: (a / NONCES['p33'][0] / 'output.log').unlink())
        self.assert_rejected('p33', lambda s, a: write(a / NONCES['p33'][0] / 'output.log', 'x' * 65537))

    def test_focused_output_pids_must_match_the_existing_control_record(self):
        first, second = NONCES['focused']
        self.assert_rejected('focused', lambda s, a: write(a / first / 'output.log', '{"control": 999}\n'))
        self.assert_rejected('focused', lambda s, a: write(a / second / 'output.log', '{"control": 201}\n'))
        self.assert_rejected('focused', lambda s, a: write(a / second / 'output.log', 'not json\n'))
        self.assert_rejected('focused', lambda s, a: write(a / first / 'output.log', '{"control": true}\n'))

    def test_missing_guard_ledger_and_extra_entries(self):
        self.assert_rejected('parity', lambda s, a: (a / 'guard-result.json').unlink())
        self.assert_rejected('parity', lambda s, a: write(a / 'stray.txt', 'x'))
        self.assert_rejected('parity', lambda s, a: write(s / 'post-attempts', 'attempt-xyz\nattempt-two\n'))
        self.assert_rejected('parity', lambda s, a: write(s / 'pre-attempts', 'attempt-xyz\n'))

    def test_p33_case_nonce_completion_and_real_rejection(self):
        case = lambda a: a / NONCES['p33'][0]
        other = 'e' * 48
        self.assert_rejected('p33', lambda s, a: edit_json(case(a) / 'result.json', lambda v: v.__setitem__('nonce', other)))
        self.assert_rejected('p33', lambda s, a: edit_json(case(a) / 'completion.json', lambda v: v.__setitem__('nonce', other)))
        self.assert_rejected('p33', lambda s, a: edit_json(case(a) / 'completion.json', lambda v: v.__setitem__('hooksCompleted', False)))
        self.assert_rejected('p33', lambda s, a: (case(a) / 'completion.json').unlink())
        self.assert_rejected('p33', lambda s, a: edit_json(case(a) / 'result.json', lambda v: v.update(
            outcome='CONTAINED_REJECTION', reason='deadline')))
        self.assert_rejected('p33', lambda s, a: edit_json(case(a) / 'result.json', lambda v: v.__setitem__('mode', 'complete')))
        self.assert_rejected('p33', lambda s, a: write(case(a) / 'fatal.json', '{}'))

    def test_focused_controls_are_distinguished(self):
        first, second = NONCES['focused']
        self.assert_rejected('focused', lambda s, a: edit_json(a / second / 'result.json', lambda v: v.update(
            outcome='COMPLETED', reason='child_exit')))
        self.assert_rejected('focused', lambda s, a: edit_json(a / second / 'result.json', lambda v: v.__setitem__('controls', [201])))
        self.assert_rejected('focused', lambda s, a: edit_json(a / first / 'result.json', lambda v: v.__setitem__('settled', False)))
        self.assert_rejected('focused', lambda s, a: edit_json(a / second / 'result.json', lambda v: v.__setitem__('reaped', [reaped(201, 9), reaped(202)])))

    def test_prerequisite_rules(self):
        self.assert_rejected('prerequisite', lambda s, a: write(s / 'stdout', '{"prerequisite": true, "evidence": "/elsewhere"}\n'))
        self.assert_rejected('prerequisite', lambda s, a: write_json(a / 'guard-result.json', {}))
        self.assert_rejected('prerequisite', lambda s, a: edit_json(a / 'prerequisite.json', lambda v: v.__setitem__('subreaper', False)))
        self.assert_rejected('prerequisite', lambda s, a: edit_json(a / 'prerequisite.json', lambda v: v.__setitem__('python', '3.11.9')))

    def test_supplemental_snapshot_failure_is_a_warning_not_ownership_proof(self):
        with tempfile.TemporaryDirectory() as tmp:
            stage_dir, runtime, _ = make_fixture(tmp, 'parity')
            write(stage_dir / 'snapshot-status.txt', 'ps-pre 0\nps-post 1\n')
            errors, facts = av.evaluate_stage('parity', stage_dir, runtime)
            self.assertEqual(errors, [])
            self.assertTrue(facts['warnings'])


def build_root(tmp):
    root = Path(tmp)
    (root / 'a').mkdir()
    write(root / 'a' / 'one.txt', 'one')
    (root / '.github' / 'workflows').mkdir(parents=True)
    write(root / av.WORKFLOW_REL, 'workflow')
    (root / 'tools' / 'affected-validation').mkdir(parents=True)
    manifest = {'protocol': av.RUN_ID, 'base_head': av.BASE,
                'files': {'a/one.txt': {'bytes': 3, 'sha256': hashlib.sha256(b'one').hexdigest()}}}
    raw = json.dumps(manifest).encode()
    (root / av.MANIFEST_REL).write_bytes(raw)
    return root, hashlib.sha256(raw).hexdigest()


class SourceBinding(unittest.TestCase):
    def test_positive_binding_reaches_the_fixed_manifest_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, digest = build_root(tmp)
            with mock.patch.object(av, 'ROOT', root):  # only ROOT is patched: no stand-in attribute can mask a lookup bug
                record = av.bind(digest)
            self.assertEqual(record['errors'], [])
            self.assertTrue(record['ok'])
            self.assertEqual(record['members_checked'], 1)

    def test_manifest_digest_mismatch_reads_no_member(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, _ = build_root(tmp)
            real, calls = av.read_bounded, []

            def spy(path, limit):
                calls.append(str(path))
                return real(path, limit)

            with mock.patch.object(av, 'ROOT', root), mock.patch.object(av, 'read_bounded', spy):
                record = av.bind('0' * 64)
            self.assertFalse(record['ok'])
            self.assertEqual(record['members_checked'], 0)
            self.assertEqual(calls, [str(root / av.MANIFEST_REL)])

    def test_workflow_drift_between_pre_and_post_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, digest = build_root(tmp)
            with mock.patch.object(av, 'ROOT', root):
                pre = av.bind(digest)
                self.assertTrue(av.bind(digest, pre['workflow_sha256_observed'])['ok'])
                write(root / av.WORKFLOW_REL, 'workflow changed')
                post = av.bind(digest, pre['workflow_sha256_observed'])
            self.assertFalse(post['ok'])
            self.assertTrue(any('drifted' in e for e in post['errors']))

    def test_tree_drift_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, digest = build_root(tmp)
            with mock.patch.object(av, 'ROOT', root):
                write(root / 'a' / 'one.txt', 'ONE')
                self.assertFalse(av.bind(digest)['ok'])
                write(root / 'a' / 'one.txt', 'one')
                write(root / 'extra.txt', 'x')
                self.assertEqual(av.bind(digest)['extra'], ['extra.txt'])
                (root / 'extra.txt').unlink()
                (root / 'a' / 'one.txt').unlink()
                self.assertFalse(av.bind(digest)['ok'])


class CheckEnforcesWorkflowPreservation(unittest.TestCase):
    def run_check(self, tamper):
        with tempfile.TemporaryDirectory() as root_tmp, tempfile.TemporaryDirectory() as run_tmp:
            root, digest = build_root(root_tmp)
            av_root = Path(run_tmp) / 'av'
            ev, runtime = av_root / 'evidence', av_root / 'tmp' / 'the-desk-p33-1000-abc'
            ev.mkdir(parents=True)
            runtime.mkdir(parents=True)
            make_stage(ev / 'prerequisite', runtime, 'attempt-p', 'prerequisite', [])
            with mock.patch.object(av, 'ROOT', root), mock.patch.dict(os.environ, {'RUNNER_TEMP': run_tmp}):
                pre = av.bind(digest)
                pre['label'] = 'pre'
                write_json(ev / 'bind-pre.json', pre)
                if tamper:
                    write(root / av.WORKFLOW_REL, 'workflow changed after the pre binding')
                code = av.cmd_check('prerequisite', digest)
            verdict = json.loads((ev / 'verdict-prerequisite.json').read_text())
            return code, verdict

    def test_unchanged_workflow_passes(self):
        code, verdict = self.run_check(False)
        self.assertEqual((code, verdict['errors']), (0, []))

    def test_changed_workflow_fails_the_stage(self):
        code, verdict = self.run_check(True)
        self.assertEqual(code, 1)
        self.assertIn('post-stage source binding failed', verdict['errors'])


class FinalGateUsesTheExplicitFixture(unittest.TestCase):
    """final_code(tmp, ...) must evaluate the supplied synthetic root regardless of the caller's environment."""

    def test_outer_runner_temp_is_ignored_and_restored(self):
        with (tempfile.TemporaryDirectory() as outer, tempfile.TemporaryDirectory() as good,
              tempfile.TemporaryDirectory() as partial):
            build_full(good)
            collect(good)
            _, runtime = build_full(partial)
            (runtime / ATTEMPTS['parity'] / NONCES['parity'][0] / 'output.log').unlink()
            collect(partial)
            decoy_dir = Path(outer) / 'av' / 'upload'
            decoy_dir.mkdir(parents=True)
            hold = {'all_stages_ok': False, 'evidence_status': 'partial/censored', 'verdicts': {}}
            accept = {'all_stages_ok': True, 'evidence_status': 'complete', 'verdicts': {}}
            with mock.patch.dict(os.environ, {'RUNNER_TEMP': outer, 'UPLOAD_OUTCOME': 'ambient'}):
                write_json(decoy_dir / 'final.json', hold)    # the ambient bundle says HOLD ...
                self.assertEqual(final_code(good, 'success'), 0)    # ... but the supplied complete fixture is accepted
                write_json(decoy_dir / 'final.json', accept)  # the ambient bundle says accept ...
                self.assertEqual(final_code(partial, 'success'), 1)  # ... but the supplied partial fixture is held
                self.assertEqual(final_code(good, 'failure'), 1)
                self.assertEqual(os.environ['RUNNER_TEMP'], outer)
                self.assertEqual(os.environ['UPLOAD_OUTCOME'], 'ambient')

    def test_missing_ambient_runner_temp_is_neither_needed_nor_created(self):
        with tempfile.TemporaryDirectory() as good:
            build_full(good)
            collect(good)
            with mock.patch.dict(os.environ):
                os.environ.pop('RUNNER_TEMP', None)
                os.environ.pop('UPLOAD_OUTCOME', None)
                self.assertEqual(final_code(good, 'success'), 0)
                self.assertNotIn('RUNNER_TEMP', os.environ)
                self.assertNotIn('UPLOAD_OUTCOME', os.environ)


class RawRetention(unittest.TestCase):
    def test_complete_four_stage_success_is_complete_and_accepted_after_upload(self):
        with tempfile.TemporaryDirectory() as tmp:
            build_full(tmp)
            final = collect(tmp)
            self.assertEqual(final['collection_problems'], {'missing': [], 'censored': [], 'errors': []})
            self.assertEqual(final['evidence_status'], 'complete')
            self.assertEqual(final_code(tmp, 'success'), 0)
            self.assertEqual(final_code(tmp, 'failure'), 1)
            upload = Path(tmp) / 'av' / 'upload' / 'attempts'
            # legitimate absences are not failures: no prerequisite ledger, no completion record for the focused controls
            self.assertFalse((upload / 'attempt-p' / 'guard-result.json').exists())
            self.assertFalse((upload / 'attempt-f' / NONCES['focused'][0] / 'completion.json').exists())
            self.assertTrue((upload / 'attempt-4' / NONCES['parity'][0] / 'completion.json').exists())

    def assert_partial_and_held(self, remove):
        with tempfile.TemporaryDirectory() as tmp:
            _, runtime = build_full(tmp)
            remove(runtime, Path(tmp) / 'av')
            final = collect(tmp)
            self.assertEqual(final['evidence_status'], 'partial/censored')
            self.assertTrue(final['all_stages_ok'])  # verdicts alone must not decide completeness
            self.assertEqual(final_code(tmp, 'success'), 1)

    def test_each_mandatory_raw_file_is_required(self):
        with tempfile.TemporaryDirectory() as tmp:
            _, runtime = build_full(tmp)
            targets = [path.relative_to(runtime) for path in mandatory_paths(runtime)]
        self.assertGreaterEqual(len(targets), 17)
        for rel in targets:
            with self.subTest(file=str(rel)):
                self.assert_partial_and_held(lambda runtime, av_root, rel=rel: (runtime / rel).unlink())

    def test_whole_case_and_attempt_directories_are_required(self):
        import shutil
        for stage in ('focused', 'p33', 'parity'):
            for nonce in NONCES[stage]:
                with self.subTest(case=stage + ':' + nonce[:4]):
                    self.assert_partial_and_held(lambda runtime, av_root, stage=stage, nonce=nonce: shutil.rmtree(runtime / ATTEMPTS[stage] / nonce))
        for stage in av.STAGES:
            with self.subTest(attempt=stage):
                self.assert_partial_and_held(lambda runtime, av_root, stage=stage: shutil.rmtree(runtime / ATTEMPTS[stage]))

    def test_each_stage_file_is_required(self):
        for name in av.STAGE_FILES:
            with self.subTest(stage_file=name):
                self.assert_partial_and_held(lambda runtime, av_root, name=name: (av_root / 'evidence' / 'parity' / name).unlink())

    def test_short_copy_is_not_complete(self):
        real = av.read_head

        def short(path, limit):
            data, size = real(path, limit)
            return data[:-1], size

        with tempfile.TemporaryDirectory() as tmp:
            build_full(tmp)
            with mock.patch.object(av, 'read_head', short):
                final = collect(tmp)
            self.assertEqual(final['evidence_status'], 'partial/censored')
            self.assertEqual(final_code(tmp, 'success'), 1)

    def test_oversize_retained_file_is_censored(self):
        with tempfile.TemporaryDirectory() as tmp:
            build_full(tmp)
            with mock.patch.object(av, 'COPY_LIMIT', 4):
                final = collect(tmp)
            self.assertTrue(final['collection_problems']['censored'])
            self.assertEqual(final['evidence_status'], 'partial/censored')

    def test_fatal_json_is_retained_when_present(self):
        with tempfile.TemporaryDirectory() as tmp:
            _, runtime = build_full(tmp)
            write(runtime / ATTEMPTS['parity'] / 'fatal.json', '{"reason": "x"}')
            write(runtime / ATTEMPTS['parity'] / NONCES['parity'][0] / 'fatal.json', '{"reason": "y"}')
            collect(tmp)
            upload = Path(tmp) / 'av' / 'upload' / 'attempts' / ATTEMPTS['parity']
            self.assertTrue((upload / 'fatal.json').exists())
            self.assertTrue((upload / NONCES['parity'][0] / 'fatal.json').exists())

    def test_globally_missing_evidence_is_partial_and_upload_failure_blocks_acceptance(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / 'av' / 'evidence').mkdir(parents=True)
            (Path(tmp) / 'av' / 'tmp').mkdir()
            final = collect(tmp)
            self.assertEqual(final['evidence_status'], 'partial/censored')
            self.assertFalse(final['all_stages_ok'])
            self.assertEqual(final_code(tmp, 'success'), 1)
        with tempfile.TemporaryDirectory() as tmp:
            build_full(tmp)
            collect(tmp)
            self.assertEqual(final_code(tmp, 'success'), 0)
            self.assertEqual(final_code(tmp, 'failure'), 1)


if __name__ == '__main__':
    unittest.main()
