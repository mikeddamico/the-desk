#!/usr/bin/python3
"""PROPOSED inert regression for ci.py (foundation-ci amendment). NOT EXECUTED; needs a separate release.

Intended bounded invocation (repository root; any trusted Linux host; never required by the hosted workflow):
    /usr/bin/timeout --signal=TERM --kill-after=5s 30s /usr/bin/python3 -I -B tools/ci-validation/test_ci.py -v

It imports ci.py (module level defines constants and functions only) and exercises its pure evidence checks
against SYNTHETIC files created inside tempfile directories. It never starts the P33 guard, Vitest, Node, a
database client, git, Docker or any other subprocess; it never calls cmd_init, and every cmd_dbprobe call that would
reach the probe replaces subprocess.run (and shutil.which) with a mock, so Node is never launched. It never touches
the repository tree. Tests that need a checkout build a
synthetic one under a temporary directory and patch ci.ROOT / ci.tracked_files only inside mock contexts.

Pinned fail-closed rules: aggregate 80 files / 8,688 tests and all 29 integration files, each selected file exactly once
with no failed/skipped/todo test, a changed tracked-test inventory, a missing or foreign TEST_DATABASE_URL, a database
that is not PostgreSQL 17 / the_desk_test / superuser, skipped integration files, root dist output accepted only when it
is the unchanged build output (added, modified, empty, absent, symlinked or pre-existing dist and any tracked drift,
untracked file or symlink are errors), PR merge identity mapping (head parent, base drift, tree mismatch, well-formed
fork accepted, malformed or foreign base repository rejected, push rules), a database probe accepted only with an exact
zero process status, the aggregate blocked unless the controls collection record is complete, credential redaction of retained bytes, complete raw retention, and a final gate that needs both uploads and
both audit and Gitleaks to have succeeded.
"""
import contextlib
import io
import json
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ci  # noqa: E402

TRACKED = sorted(
    ['package.json', 'src/index.ts', 'vitest.config.ts', '.github/workflows/ci.yml']
    + ['test/root%02d.test.ts' % i for i in range(35)]
    + ['test/unit/unit%02d.test.ts' % i for i in range(13)] + [ci.HARNESS_TEST]
    + ['test/integration/int%02d.test.ts' % i for i in range(28)])
OLD_TESTS, OLD_SELECTED = ci.expected_all_files(TRACKED)
TRACKED = sorted(TRACKED + list(ci.FIXTURE_CONNECTED_COUNTS) + list(ci.FROZEN_RENDER046_COUNTS))
TESTS, SELECTED = ci.expected_all_files(TRACKED)
INTEGRATION = [n for n in SELECTED if n.startswith('test/integration/')]
URL = 'postgresql://postgres:postgres@localhost:5432/the_desk_test'
NONCES = {'focused': ('a' * 48, 'b' * 48), 'all': ('c' * 48,)}
ATTEMPTS = {'prerequisite': 'attempt-p', 'focused': 'attempt-f', 'all': 'attempt-3'}
PER_FILE = {n: 8468 // 76 + (1 if i < 8468 % 76 else 0) for i, n in enumerate(OLD_SELECTED)}
PER_FILE.update(ci.FIXTURE_CONNECTED_COUNTS)
PER_FILE.update(ci.FROZEN_RENDER046_COUNTS)


def file_lines(counts=None, extra=''):
    counts = counts or PER_FILE
    return ''.join(' ✓ %s (%d tests) 12ms\n' % (n, c) for n, c in counts.items()) + extra


SUMMARY = {
    'focused': ' Test Files  1 passed (1)\n      Tests  2 passed (2)\n',
    'all': ' Test Files  80 passed (80)\n      Tests  8688 passed (8688)\n',
}


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


def make_stage(stage_dir, runtime, attempt_name, stage, pre_attempts, stdout_lines=None):
    stage_dir, runtime = Path(stage_dir), Path(runtime)
    attempt = runtime / attempt_name
    stage_dir.mkdir(parents=True)
    attempt.mkdir(parents=True)
    write(stage_dir / 'exit', '0\n')
    write(stage_dir / 'limits.txt', ci.LIMITS_TEXT)
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
    body = file_lines() if stage == 'all' and stdout_lines is None else (stdout_lines or '')
    write(stage_dir / 'stdout', 'noise\n' + body + SUMMARY[stage] + '   Start at  00:00:00\n')
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
        nonce = NONCES['all'][0]
        case = attempt / nonce
        case.mkdir()
        write(case / 'output.log', '')
        write_json(case / 'result.json', case_result(nonce, 'p33', reaped=[reaped(300)]))
        write_json(case / 'completion.json', {'protocol': 1, 'nonce': nonce, 'case': 'P33 multidisk',
                                              'assertionsCompleted': True, 'hooksCompleted': True})
    return attempt


def evaluate(stage, mutate=None, tracked=TRACKED, stdout_lines=None):
    with tempfile.TemporaryDirectory() as tmp:
        attempt = make_stage(Path(tmp) / 'stage', Path(tmp) / 'runtime', 'attempt-xyz', stage, [], stdout_lines)
        if mutate:
            mutate(Path(tmp) / 'stage', attempt)
        return ci.evaluate_stage(stage, Path(tmp) / 'stage', Path(tmp) / 'runtime', tracked)[0]


def edit_json(path, change):
    value = json.loads(Path(path).read_text())
    change(value)
    write_json(path, value)


def build_world(tmp):
    """Evidence/runtime directories plus the common (non-stage) records, all ok."""
    root = Path(tmp) / 'ci'
    ev = root / 'evidence'
    runtime = root / 'tmp' / 'the-desk-p33-1000-abc'
    ev.mkdir(parents=True)
    runtime.mkdir(parents=True)
    for name in ('env.json', 'identity.json', 'db-probe.json', 'snapshot-pre.json', 'bind-pre.json', 'bind-build.json'):
        write_json(ev / name, {'ok': True})
    return ev, runtime


def add_stage(ev, runtime, stage):
    """One synthetic successful stage; its verdict is derived by evaluate_stage."""
    seen = [ATTEMPTS[s] for s in ci.STAGES[:ci.STAGES.index(stage)]]
    make_stage(ev / stage, runtime, ATTEMPTS[stage], stage, seen)
    errors, facts = ci.evaluate_stage(stage, ev / stage, runtime, TRACKED)
    assert errors == [], errors
    write_json(ev / ('verdict-%s.json' % stage), {'stage': stage, 'ok': True, 'errors': [], 'facts': facts})
    write_json(ev / ('bind-post-%s.json' % stage), {'ok': True})


def build_full(tmp, stages=ci.STAGES):
    """A synthetic success of the given stages (default all three) under RUNNER_TEMP=tmp."""
    ev, runtime = build_world(tmp)
    for stage in stages:
        add_stage(ev, runtime, stage)
    return ev, runtime


def collect(tmp, scope, env=None):
    # Historical retention controls isolate the new seam; Fixture105Tooling exercises it directly.
    with mock.patch.object(ci, 'fixture_collect', return_value=None), mock.patch.dict(os.environ, {'RUNNER_TEMP': tmp, **(env or {})}), contextlib.redirect_stdout(io.StringIO()):
        ci.cmd_collect(scope)
    return json.loads((Path(tmp) / 'ci' / ('upload-' + scope) / 'final.json').read_text())


OK_OUTCOMES = {'CONTROLS_UPLOAD_OUTCOME': 'success', 'UPLOAD_OUTCOME': 'success', 'AUDIT_OUTCOME': 'success', 'SECURITY_UPLOAD_OUTCOME': 'success',
               'GITLEAKS_OUTCOME': 'success'}


def final_code(tmp, **outcomes):
    env = {'RUNNER_TEMP': tmp, **{**OK_OUTCOMES, **outcomes}}
    with mock.patch.dict(os.environ, env), contextlib.redirect_stdout(io.StringIO()):
        return ci.cmd_final()


def collect_both(tmp):
    return collect(tmp, 'controls'), collect(tmp, 'full')


class SummaryAndFileLines(unittest.TestCase):
    def test_default_reporter_summary_with_ansi(self):
        result, problems = ci.parse_summary('\x1b[2m Test Files \x1b[22m 66 passed (66)\n      Tests  8242 passed (8242)\n')
        self.assertEqual(problems, [])
        self.assertEqual(result, {'files': {'total': 66, 'passed': 66}, 'tests': {'total': 8242, 'passed': 8242}})

    def test_missing_or_duplicate_rows_are_problems(self):
        self.assertTrue(ci.parse_summary('nothing\n')[1])
        self.assertTrue(ci.parse_summary(SUMMARY['all'] + SUMMARY['all'])[1])

    def test_per_file_lines(self):
        seen = ci.parse_file_lines(' ✓ test/a.test.ts (3 tests) 4ms\n ↓ test/b.test.ts (5 tests | 5 skipped)\n'
                                   ' ❌ test/c.test.ts (2 tests | 1 failed) 9ms\n ✓ test/a.test.ts (3 tests) 4ms\n')
        self.assertEqual(len(seen['test/a.test.ts']), 2)
        self.assertEqual(seen['test/b.test.ts'][0]['skipped'], 5)
        self.assertEqual(seen['test/c.test.ts'][0]['failed'], 1)


class AggregateSelection(unittest.TestCase):
    def test_synthetic_inventory_matches_the_fixed_expectations(self):
        self.assertEqual((len(TESTS), len(SELECTED), len(INTEGRATION)), (81, 80, 29))
        self.assertEqual(sum(PER_FILE.values()), ci.EXPECTED_ALL_TESTS)
        self.assertNotIn(ci.HARNESS_TEST, SELECTED)

    def test_accepted_aggregate(self):
        self.assertEqual(evaluate('all'), [])

    def check(self, stdout, tracked=TRACKED):
        errors, facts = [], {}
        ci.check_all_files(stdout, tracked, errors, facts)
        return errors, facts

    def test_every_integration_file_is_reported(self):
        errors, facts = self.check(file_lines())
        self.assertEqual(errors, [])
        self.assertEqual(sorted(facts['integration_results']), INTEGRATION)
        self.assertTrue(all(len(v) == 1 for v in facts['integration_results'].values()))

    def test_missing_integration_file_is_an_error(self):
        counts = dict(PER_FILE)
        del counts[INTEGRATION[3]]
        errors, _ = self.check(file_lines(counts))
        self.assertTrue(any('no result line for ' + INTEGRATION[3] in e for e in errors))

    def test_skipped_integration_file_is_an_error(self):
        # what a missing TEST_DATABASE_URL looks like: describe.skip leaves the file with only skipped tests
        counts = dict(PER_FILE)
        skipped = counts.pop(INTEGRATION[0])
        out = file_lines(counts) + ' ↓ %s (%d tests | %d skipped)\n' % (INTEGRATION[0], skipped, skipped)
        errors, _ = self.check(out)
        self.assertTrue(any('failed/skipped/todo' in e for e in errors))

    def test_partial_skip_failed_and_todo_are_errors(self):
        for kind in ('skipped', 'failed', 'todo'):
            with self.subTest(kind=kind):
                counts = dict(PER_FILE)
                name = SELECTED[5]
                total = counts.pop(name)
                out = file_lines(counts) + ' ✓ %s (%d tests | 1 %s) 3ms\n' % (name, total, kind)
                self.assertTrue(self.check(out)[0])

    def test_count_drift_and_duplicates(self):
        counts = dict(PER_FILE)
        counts[SELECTED[0]] -= 1
        self.assertTrue(any('sum to 8687' in e for e in self.check(file_lines(counts))[0]))
        counts = dict(PER_FILE)
        counts[SELECTED[0]] += 1
        self.assertTrue(any('sum to 8689' in e for e in self.check(file_lines(counts))[0]))
        dup = file_lines() + ' ✓ %s (1 tests) 1ms\n' % SELECTED[0]
        self.assertTrue(any('2 result lines' in e for e in self.check(dup)[0]))

    def test_unexpected_and_harness_result_lines(self):
        for name in ('test/other.test.ts', ci.HARNESS_TEST):
            with self.subTest(name=name):
                out = file_lines() + ' ✓ %s (2 tests) 1ms\n' % name
                self.assertTrue(any('outside the selection' in e for e in self.check(out)[0]))

    def test_changed_tracked_inventory_is_hold_not_a_relaxed_count(self):
        grown = sorted(TRACKED + ['test/unit/extra.test.ts'])
        self.assertTrue(any('inventory is 82' in e for e in self.check(file_lines(), grown)[0]))
        moved = [n for n in TRACKED if n != INTEGRATION[0]] + ['test/unit/moved.test.ts']
        self.assertTrue(any('integration file count 28' in e for e in self.check(file_lines(), sorted(moved))[0]))
        shrunk = [n for n in TRACKED if n != ci.HARNESS_TEST]
        self.assertTrue(self.check(file_lines(), shrunk)[0])

    def test_summary_count_mismatch_with_correct_files(self):
        for wrong in (8687, 8689):
            with self.subTest(tests=wrong):
                def change(stage_dir, attempt):
                    write(stage_dir / 'stdout', file_lines() + ' Test Files  80 passed (80)\n      Tests  %d passed (%d)\n' % (wrong, wrong))
                self.assertTrue(any('Tests counts' in e for e in evaluate('all', change)))

    def test_skipped_summary_with_exit_zero_is_not_accepted(self):
        def change(stage_dir, attempt):
            write(stage_dir / 'stdout', file_lines() + ' Test Files  80 passed (80)\n      Tests  8602 passed | 86 skipped (8688)\n')
        self.assertTrue(any('Tests counts' in e for e in evaluate('all', change)))


class DatabaseBinding(unittest.TestCase):
    def test_only_the_local_disposable_service_is_accepted(self):
        self.assertEqual(ci.validate_db_url(URL), {'host': 'localhost', 'port': 5432, 'database': 'the_desk_test', 'user': 'postgres'})
        self.assertEqual(ci.validate_db_url(URL.replace('localhost', '127.0.0.1'))['host'], '127.0.0.1')
        for bad in (None, '', URL + '?sslmode=disable', URL + '\n', URL.replace('localhost', 'db.example.com'),
                    URL.replace('5432', '5433'), URL.replace('the_desk_test', 'prod'), 'mysql://a:b@localhost:5432/the_desk_test',
                    URL.replace('postgres:postgres@', ''), URL.replace('localhost', 'localhost.evil.test')):
            with self.subTest(url=bad):
                with self.assertRaises(ValueError):
                    ci.validate_db_url(bad)

    def test_missing_variable_is_a_recorded_failure_without_probing(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / 'ci' / 'evidence').mkdir(parents=True)
            env = {k: v for k, v in os.environ.items() if k != 'TEST_DATABASE_URL'}
            env['RUNNER_TEMP'] = tmp
            with mock.patch.dict(os.environ, env, clear=True), contextlib.redirect_stdout(io.StringIO()):
                with mock.patch.object(ci.subprocess, 'run', side_effect=AssertionError('no probe expected')):
                    code = ci.cmd_dbprobe()
            self.assertEqual(code, 1)
            record = json.loads((Path(tmp) / 'ci' / 'evidence' / 'db-probe.json').read_text())
            self.assertFalse(record['ok'])
            self.assertIn('TEST_DATABASE_URL', record['errors'][0])

    GOOD_ROW = json.dumps({'ok': True, 'v': 170004, 'd': 'the_desk_test', 'u': 'postgres', 'su': True,
                           'cdb': True, 'crole': True}).encode() + b'\n'

    def run_probe(self, result=None, side_effect=None):
        """cmd_dbprobe with subprocess.run and shutil.which mocked: Node is never launched."""
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / 'ci' / 'evidence').mkdir(parents=True)
            env = {'RUNNER_TEMP': tmp, 'TEST_DATABASE_URL': URL, 'PATH': '/usr/bin:/bin'}
            run = mock.Mock(return_value=result, side_effect=side_effect)
            with mock.patch.dict(os.environ, env, clear=True), mock.patch.object(ci.shutil, 'which', return_value='/usr/bin/node'), \
                    mock.patch.object(ci.subprocess, 'run', run), contextlib.redirect_stdout(io.StringIO()):
                code = ci.cmd_dbprobe()
            text = (Path(tmp) / 'ci' / 'evidence' / 'db-probe.json').read_text()
        self.assertEqual(run.call_count, 1)
        self.assertNotIn('postgres:postgres', text)
        return code, json.loads(text), run

    def test_valid_row_with_exit_zero_is_accepted_and_the_status_is_recorded(self):
        code, record, run = self.run_probe(mock.Mock(returncode=0, stdout=self.GOOD_ROW))
        self.assertEqual((code, record['ok'], record['probe_exit'], record['errors']), (0, True, 0, []))
        args, kwargs = run.call_args
        self.assertEqual(args[0], ['/usr/bin/node', '--input-type=module', '-e', ci.NODE_PROBE])
        self.assertEqual((kwargs['timeout'], kwargs['check'], kwargs['stdin'], kwargs['stderr']),
                         (30, False, ci.subprocess.DEVNULL, ci.subprocess.DEVNULL))
        self.assertEqual(sorted(kwargs['env']), ['HOME', 'PATH', 'TEST_DATABASE_URL'])

    def test_valid_row_with_nonzero_or_signal_exit_is_rejected(self):
        for status in (1, 2, 255, -9, -15, -11):
            with self.subTest(returncode=status):
                code, record, _ = self.run_probe(mock.Mock(returncode=status, stdout=self.GOOD_ROW))
                self.assertEqual((code, record['ok'], record['probe_exit']), (1, False, status))
                self.assertTrue(any('exit status' in e for e in record['errors']))
                self.assertNotIn('server', record)

    def test_non_integer_status_is_rejected(self):
        for status in (None, True, '0', 0.0):
            with self.subTest(returncode=status):
                code, record, _ = self.run_probe(mock.Mock(returncode=status, stdout=self.GOOD_ROW))
                self.assertEqual((code, record['ok'], record['probe_exit']), (1, False, None))

    def test_timeout_and_exceptions_are_fail_closed(self):
        for error in (ci.subprocess.TimeoutExpired(['node'], 30), OSError('x'), RuntimeError('y')):
            with self.subTest(error=type(error).__name__):
                code, record, _ = self.run_probe(side_effect=error)
                self.assertEqual((code, record['ok'], record['probe_exit']), (1, False, None))
                self.assertTrue(any(type(error).__name__ in e for e in record['errors']))

    def test_unreadable_output_is_rejected_even_with_exit_zero(self):
        for out in (b'not json\n', b'', b'\xff\xfe\n', b'[]\n', b'{"ok": false, "code": "28P01"}\n',
                    self.GOOD_ROW.replace(b'170004', b'160004')):
            with self.subTest(stdout=out):
                code, record, _ = self.run_probe(mock.Mock(returncode=0, stdout=out))
                self.assertEqual((code, record['ok'], record['probe_exit']), (1, False, 0))

    def test_probe_interpretation(self):
        good = {'ok': True, 'v': 170004, 'd': 'the_desk_test', 'u': 'postgres', 'su': True, 'cdb': True, 'crole': True}
        self.assertEqual(ci.interpret_db_probe(good)[0], [])
        for change, text in (({'v': 160009}, 'version'), ({'d': 'postgres'}, 'database'), ({'su': False}, 'superuser'),
                             ({'su': None}, 'superuser')):
            with self.subTest(change=change):
                self.assertTrue(any(text in e for e in ci.interpret_db_probe({**good, **change})[0]))
        errors, _ = ci.interpret_db_probe({'ok': False, 'code': '28P01'})
        self.assertEqual(errors, ['database probe failed (error code 28P01)'])
        errors, _ = ci.interpret_db_probe({'ok': False, 'code': 'x" ' + URL})
        self.assertNotIn('postgres:postgres', errors[0])
        self.assertTrue(ci.interpret_db_probe('garbage')[0])

    def test_run_stage_never_places_the_url_in_argv(self):
        text = (HERE / 'run-stage.sh').read_text()
        lines = [line for line in text.splitlines() if 'TEST_DATABASE_URL' in line and not line.lstrip().startswith('#')]
        self.assertEqual(len(lines), 3, lines)  # presence guard, the feed assignment, the child export
        self.assertNotIn('env -i TEST_DATABASE_URL', text)
        self.assertIn('RUNNER_TRACKING_ID', text)

    def test_redaction(self):
        data = ('connect %s failed\nalso postgres://u:pw@db/x\n' % URL).encode()
        out = ci.redact(data)
        self.assertNotIn(b'postgres:postgres', out)
        self.assertNotIn(b'u:pw', out)
        self.assertEqual(ci.redact(b'a secret b', extra=['secret']), b'a [REDACTED] b')
        self.assertEqual(ci.redact(b'plain', extra=['']), b'plain')


class SourceAndDist(unittest.TestCase):
    def make_root(self, tmp):
        root = Path(tmp) / 'root'
        (root / 'src').mkdir(parents=True)
        (root / 'node_modules' / 'x').mkdir(parents=True)
        (root / '.git').mkdir()
        write(root / 'package.json', '{}')
        write(root / 'src' / 'index.ts', 'export {}\n')
        write(root / 'node_modules' / 'x' / 'i.js', 'x')
        write(root / '.git' / 'HEAD', 'ref')
        return root, ['package.json', 'src/index.ts']

    def snap(self, root, tracked, allow_dist=True):
        return ci.take_snapshot(tracked, root=root, allow_dist=allow_dist)

    def test_clean_pre_build_tree(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, tracked = self.make_root(tmp)
            snap = self.snap(root, tracked, allow_dist=False)
            self.assertEqual(ci.snapshot_errors(snap), [])
            self.assertIsNone(snap['dist'])

    def build(self, root):
        (root / 'dist' / 'sub').mkdir(parents=True)
        write(root / 'dist' / 'index.js', 'a')
        write(root / 'dist' / 'sub' / 'x.d.ts', 'b')

    def test_expected_build_output_is_allowed_and_bound(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, tracked = self.make_root(tmp)
            pre = self.snap(root, tracked, allow_dist=False)
            self.build(root)
            built = self.snap(root, tracked)
            self.assertEqual(ci.snapshot_errors(built, pre=pre, require_dist=True), [])
            self.assertEqual(built['dist']['files'], 2)
            again = self.snap(root, tracked)
            self.assertEqual(ci.snapshot_errors(again, pre=pre, expect_dist=built['dist']), [])

    def test_dist_is_not_allowed_before_the_build(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, tracked = self.make_root(tmp)
            self.build(root)
            self.assertTrue(any('dist exists before the build' in e for e in ci.snapshot_errors(self.snap(root, tracked, allow_dist=False))))

    def test_missing_or_empty_dist_after_build(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, tracked = self.make_root(tmp)
            self.assertTrue(any('no dist' in e for e in ci.snapshot_errors(self.snap(root, tracked), require_dist=True)))
            (root / 'dist').mkdir()
            self.assertTrue(any('dist is empty' in e for e in ci.snapshot_errors(self.snap(root, tracked), require_dist=True)))

    def test_dist_drift_after_the_build_binding(self):
        for label, change in (('modified', lambda r: write(r / 'dist' / 'index.js', 'changed')),
                              ('added', lambda r: write(r / 'dist' / 'new.js', 'n')),
                              ('removed', lambda r: (r / 'dist' / 'index.js').unlink())):
            with self.subTest(change=label), tempfile.TemporaryDirectory() as tmp:
                root, tracked = self.make_root(tmp)
                pre = self.snap(root, tracked, allow_dist=False)
                self.build(root)
                built = self.snap(root, tracked)
                change(root)
                errors = ci.snapshot_errors(self.snap(root, tracked), pre=pre, expect_dist=built['dist'])
                self.assertTrue(any('dist changed' in e for e in errors), errors)

    def test_tracked_source_drift_is_not_hidden_by_dist(self):
        for label, change in (('modified', lambda r: write(r / 'src' / 'index.ts', 'evil')),
                              ('deleted', lambda r: (r / 'src' / 'index.ts').unlink())):
            with self.subTest(change=label), tempfile.TemporaryDirectory() as tmp:
                root, tracked = self.make_root(tmp)
                pre = self.snap(root, tracked, allow_dist=False)
                self.build(root)
                built = self.snap(root, tracked)
                change(root)
                errors = ci.snapshot_errors(self.snap(root, tracked), pre=pre, expect_dist=built['dist'])
                self.assertTrue(errors)

    def test_untracked_files_outside_dist_and_symlinks_are_errors(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, tracked = self.make_root(tmp)
            self.build(root)
            write(root / 'src' / 'stray.ts', 'x')
            self.assertTrue(any('untracked' in e for e in ci.snapshot_errors(self.snap(root, tracked))))
            (root / 'src' / 'stray.ts').unlink()
            os.symlink('package.json', root / 'link')
            self.assertTrue(any('symlinks present' in e for e in ci.snapshot_errors(self.snap(root, tracked))))
            (root / 'link').unlink()
            os.symlink('/etc', root / 'dist' / 'bad')
            self.assertTrue(any('symlink inside dist' in e for e in ci.snapshot_errors(self.snap(root, tracked))))

    def test_dist_itself_a_symlink_or_nonregular_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, tracked = self.make_root(tmp)
            (Path(tmp) / 'elsewhere').mkdir()
            os.symlink(Path(tmp) / 'elsewhere', root / 'dist')
            self.assertTrue(any('dist' in e for e in ci.snapshot_errors(self.snap(root, tracked))))

    def test_ignored_directories_are_not_hashed_or_flagged(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, tracked = self.make_root(tmp)
            write(root / 'node_modules' / 'x' / 'late.js', 'later')
            self.assertEqual(ci.snapshot_errors(self.snap(root, tracked, allow_dist=False)), [])


MERGE, HEAD, BASE, TREE, BLOB = 'a' * 40, '1' * 40, '2' * 40, '3' * 40, 'd' * 40
GOOD_ENV = {'GITHUB_ACTIONS': 'true', 'GITHUB_EVENT_NAME': 'pull_request', 'GITHUB_REPOSITORY': 'o/r',
            'GITHUB_SHA': MERGE, 'GITHUB_REF': 'refs/pull/28/merge', 'GITHUB_WORKFLOW_SHA': HEAD}
GOOD_FACTS = {'head': MERGE, 'tree': TREE, 'parents': [BASE, HEAD], 'origin_base': BASE,
              'workflow_blob_head': BLOB, 'workflow_blob_worktree': BLOB, 'event_head_tree': TREE}
GOOD_EVENT = {'pull_request': {'number': 28, 'head': {'sha': HEAD, 'repo': {'full_name': 'o/r'}},
                               'base': {'sha': BASE, 'ref': 'main', 'repo': {'full_name': 'o/r'}}}}


class IdentityMapping(unittest.TestCase):
    def run_identity(self, env=None, event=None, facts=None):
        return ci.check_identity({**GOOD_ENV, **(env or {})}, GOOD_EVENT if event is None else event, {**GOOD_FACTS, **(facts or {})})

    def test_pull_request_merge_is_mapped(self):
        errors, record = self.run_identity()
        self.assertEqual(errors, [])
        self.assertEqual((record['pr_head_sha'], record['pr_base_sha'], record['merge_parent_base']), (HEAD, BASE, [BASE]))
        self.assertEqual(record['checkout_head'], MERGE)
        self.assertEqual(record['pr_head_tree'], TREE)
        self.assertEqual((record['pr_head_repo'], record['pr_base_repo'], record['pr_is_fork']), ('o/r', 'o/r', False))

    def test_base_drift_head_missing_and_parent_shape(self):
        self.assertTrue(any('base drift' in e for e in self.run_identity(facts={'parents': ['4' * 40, HEAD]})[0]))
        self.assertTrue(any('not a parent' in e for e in self.run_identity(facts={'parents': [BASE, '5' * 40]})[0]))
        self.assertTrue(any('two-parent' in e for e in self.run_identity(facts={'parents': [HEAD]})[0]))
        self.assertTrue(any('two-parent' in e for e in self.run_identity(facts={'parents': []})[0]))

    def test_merge_tree_must_equal_the_pr_head_tree(self):
        self.assertTrue(any('tree differs' in e for e in self.run_identity(facts={'tree': '6' * 40})[0]))
        self.assertTrue(any('tree differs' in e for e in self.run_identity(facts={'event_head_tree': None})[0]))

    def event_with(self, head_repo=..., base_repo=...):
        event = json.loads(json.dumps(GOOD_EVENT))
        if head_repo is not ...:
            event['pull_request']['head']['repo'] = head_repo
        if base_repo is not ...:
            event['pull_request']['base']['repo'] = base_repo
        return event

    def test_well_formed_fork_is_mapped(self):
        errors, record = self.run_identity(event=self.event_with(head_repo={'full_name': 'x/fork.r-1'}))
        self.assertEqual(errors, [])
        self.assertEqual((record['pr_head_repo'], record['pr_base_repo'], record['pr_is_fork']), ('x/fork.r-1', 'o/r', True))
        self.assertEqual(record['merge_parent_base'], [BASE])
        self.assertEqual(record['pr_head_tree'], TREE)

    def test_fork_keeps_every_immutable_check(self):
        fork = self.event_with(head_repo={'full_name': 'x/r'})
        self.assertTrue(any('base drift' in e for e in self.run_identity(event=fork, facts={'parents': ['4' * 40, HEAD]})[0]))
        self.assertTrue(any('not a parent' in e for e in self.run_identity(event=fork, facts={'parents': [BASE, '5' * 40]})[0]))
        self.assertTrue(any('tree differs' in e for e in self.run_identity(event=fork, facts={'tree': '6' * 40})[0]))

    def test_malformed_head_repository_identity(self):
        for bad in ({'full_name': None}, {'full_name': ''}, {'full_name': 'noslash'}, {'full_name': 'a/b/c'},
                    {'full_name': 'x/r '}, {'full_name': 7}, {'full_name': ['x/r']}, {}, None, 'x/r'):
            with self.subTest(head_repo=bad):
                errors, record = self.run_identity(event=self.event_with(head_repo=bad))
                self.assertTrue(any('head repository identity' in e for e in errors), errors)
                self.assertIsNone(record['pr_is_fork'])

    def test_malformed_or_foreign_base_repository(self):
        for bad in ({'full_name': None}, {'full_name': 'noslash'}, {'full_name': 7}, {}, None):
            with self.subTest(base_repo=bad):
                errors, _ = self.run_identity(event=self.event_with(base_repo=bad))
                self.assertTrue(any('base repository identity' in e for e in errors), errors)
        foreign = self.event_with(base_repo={'full_name': 'x/r'})
        self.assertTrue(any('not the workflow repository' in e for e in self.run_identity(event=foreign)[0]))
        self.assertTrue(any('not the workflow repository' in e for e in self.run_identity(env={'GITHUB_REPOSITORY': 'z/z'})[0]))
        self.assertTrue(any('not the workflow repository' in e for e in self.run_identity(env={'GITHUB_REPOSITORY': None})[0]))

    def test_malformed_events(self):
        self.assertTrue(self.run_identity(event={})[0])
        self.assertTrue(self.run_identity(event={'pull_request': {'head': 'x', 'base': 'y'}})[0])

    def test_checkout_head_workflow_and_environment(self):
        self.assertTrue(any('GITHUB_SHA' in e for e in self.run_identity(facts={'head': 'c' * 40})[0]))
        self.assertTrue(any('workflow file' in e for e in self.run_identity(facts={'workflow_blob_worktree': 'e' * 40})[0]))
        self.assertTrue(any('GitHub Actions' in e for e in self.run_identity(env={'GITHUB_ACTIONS': ''})[0]))
        self.assertTrue(any('neither' in e for e in self.run_identity(env={'GITHUB_EVENT_NAME': 'workflow_dispatch'})[0]))

    def test_workflow_sha_environment_is_informational_only(self):
        errors, record = self.run_identity(env={'GITHUB_WORKFLOW_SHA': 'f' * 40})
        self.assertEqual(errors, [])
        self.assertFalse(record['workflow_sha_env_equals_checkout_head'])

    def test_push_rules(self):
        env = {'GITHUB_EVENT_NAME': 'push', 'GITHUB_REF': 'refs/heads/main'}
        event = {'after': MERGE, 'before': '7' * 40}
        self.assertEqual(self.run_identity(env=env, event=event)[0], [])
        self.assertTrue(any('after' in e for e in self.run_identity(env=env, event={'after': '8' * 40})[0]))
        self.assertTrue(any('main' in e for e in self.run_identity(env={**env, 'GITHUB_REF': 'refs/heads/x'}, event=event)[0]))


class FailClosedStages(unittest.TestCase):
    def test_every_stage_accepts_its_expected_synthetic_evidence(self):
        for stage in ci.STAGES:
            with self.subTest(stage=stage):
                self.assertEqual(evaluate(stage), [])

    def test_nonzero_timeout_kill_and_signal_exit_records(self):
        for code in ('1', '124', '137', '153', '0 '):
            with self.subTest(exit=code):
                self.assertTrue(evaluate('all', lambda d, a, code=code: write(d / 'exit', code + '\n')))

    def test_cap_limits_and_fatal_text(self):
        self.assertTrue(evaluate('all', lambda d, a: write(d / 'limits.txt', 'core 0 0\nfsize 1 1\n')))
        with mock.patch.object(ci, 'CAP', 64):
            self.assertTrue(any('cap' in e for e in evaluate('focused')))
        for needle in ci.FATAL_TEXT:
            with self.subTest(needle=needle):
                self.assertTrue(evaluate('all', lambda d, a, n=needle: write(d / 'stderr', n)))
        self.assertTrue(evaluate('all', lambda d, a: write(d / 'stdout', file_lines() + SUMMARY['all'] + ' FAIL  x\n')))

    def test_guard_and_case_ledger_rules(self):
        for key, bad in (('settled', False), ('directReaped', False), ('noChildren', False), ('complete', False),
                         ('residual', [1]), ('errors', ['x']), ('cleanupErrors', ['x']), ('reaped', [])):
            with self.subTest(guard=key):
                self.assertTrue(evaluate('all', lambda d, a, k=key, b=bad: edit_json(a / 'guard-result.json', lambda v: v.update({k: b}))))
        self.assertTrue(evaluate('all', lambda d, a: edit_json(a / 'guard-result.json', lambda v: v.update({'fatal': {}}))))
        self.assertTrue(evaluate('all', lambda d, a: edit_json(a / 'guard-result.json', lambda v: v.pop('discoveryDetails'))))

    def test_malformed_reap_evidence(self):
        cases = {'duplicate pid': [reaped(5), reaped(5)], 'zero pid': [reaped(0)], 'boolean pid': [{'pid': True, 'raw': 0, 'exit': 0}],
                 'raw exit disagree': [{'pid': 5, 'raw': 0, 'exit': 1}], 'extra key': [{**reaped(5), 'x': 1}],
                 'negative raw': [{'pid': 5, 'raw': -1, 'exit': 0}], 'nonzero exit': [reaped(5, 256)]}
        for label, entries in cases.items():
            with self.subTest(label):
                def change(d, a, entries=entries):
                    nonce = NONCES['all'][0]
                    edit_json(a / nonce / 'result.json', lambda v: v.update({'reaped': entries}))
                self.assertTrue(evaluate('all', change))

    def test_p33_case_rules(self):
        nonce = NONCES['all'][0]
        self.assertTrue(evaluate('all', lambda d, a: edit_json(a / nonce / 'completion.json', lambda v: v.update({'assertionsCompleted': False}))))
        self.assertTrue(evaluate('all', lambda d, a: edit_json(a / nonce / 'result.json', lambda v: v.update({'outcome': 'CONTAINED_REJECTION', 'reason': 'deadline'}))))
        self.assertTrue(evaluate('all', lambda d, a: (a / nonce / 'output.log').unlink()))
        self.assertTrue(evaluate('all', lambda d, a: write(a / 'fatal.json', '{}')))
        self.assertTrue(evaluate('all', lambda d, a: edit_json(a / nonce / 'result.json', lambda v: v.update({'nonce': 'f' * 48}))))

    def test_focused_controls_are_distinguished(self):
        first, second = NONCES['focused']
        self.assertTrue(evaluate('focused', lambda d, a: edit_json(a / second / 'result.json', lambda v: v.update({'outcome': 'COMPLETED', 'reason': 'child_exit'}))))
        self.assertTrue(evaluate('focused', lambda d, a: write(a / first / 'output.log', '{"control": 999}\n')))

    def test_prerequisite_rules(self):
        self.assertTrue(evaluate('prerequisite', lambda d, a: edit_json(a / 'prerequisite.json', lambda v: v.update({'subreaper': False}))))
        self.assertTrue(evaluate('prerequisite', lambda d, a: write(a / 'guard-result.json', '{}')))
        self.assertTrue(evaluate('prerequisite', lambda d, a: edit_json(a / 'prerequisite.json', lambda v: v.update({'python': '3.11.0'}))))

    def test_snapshot_failures_are_warnings_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            attempt = make_stage(Path(tmp) / 's', Path(tmp) / 'r', 'attempt-x', 'prerequisite', [])
            write(Path(tmp) / 's' / 'snapshot-status.txt', 'ps-pre 1\nps-post 0\n')
            errors, facts = ci.evaluate_stage('prerequisite', Path(tmp) / 's', Path(tmp) / 'r', TRACKED)
            self.assertEqual(errors, [])
            self.assertTrue(facts['warnings'])


class StageGateCommands(unittest.TestCase):
    """precheck/check on a synthetic checkout (ci.ROOT, ci.tracked_files patched; no git, no subprocess)."""

    def world(self, tmp):
        root = Path(tmp) / 'root'
        root.mkdir()
        for name in TRACKED:
            (root / name).parent.mkdir(parents=True, exist_ok=True)
            write(root / name, 'content of ' + name)
        runner = Path(tmp) / 'runner'
        ev = runner / 'ci' / 'evidence'
        (runner / 'ci' / 'tmp').mkdir(parents=True)
        ev.mkdir()
        pre = ci.take_snapshot(TRACKED, root=root, allow_dist=False)
        write_json(ev / 'snapshot-pre.json', pre)
        write_json(ev / 'bind-pre.json', {'ok': True})
        (root / 'dist').mkdir()
        write(root / 'dist' / 'index.js', 'built')
        built = ci.take_snapshot(TRACKED, root=root, allow_dist=True)
        write_json(ev / 'bind-build.json', {'ok': True, 'dist': built['dist']})
        write_json(ev / 'db-probe.json', {'ok': True})
        return root, runner, ev

    def run_cmd(self, root, runner, fn, *args):
        env = {'RUNNER_TEMP': str(runner)}
        with mock.patch.dict(os.environ, env), mock.patch.object(ci, 'ROOT', root), \
                mock.patch.object(ci, 'tracked_files', lambda: list(TRACKED)), mock.patch.object(ci, 'fixture_capture_stage', return_value={'complete': True}), contextlib.redirect_stdout(io.StringIO()):
            return fn(*args)

    def stage(self, ev, runner, stage, seen):
        runtime = runner / 'ci' / 'tmp' / 'the-desk-p33-1000-abc'
        make_stage(ev / stage, runtime, ATTEMPTS[stage], stage, seen)

    def test_precheck_ordering_and_single_attempt(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, runner, ev = self.world(tmp)
            self.assertEqual(self.run_cmd(root, runner, ci.cmd_precheck, 'prerequisite'), 0)
            self.assertEqual(self.run_cmd(root, runner, ci.cmd_precheck, 'focused'), 1)
            self.assertEqual(self.run_cmd(root, runner, ci.cmd_precheck, 'all'), 1)
            write_json(ev / 'verdict-prerequisite.json', {'ok': True})
            self.assertEqual(self.run_cmd(root, runner, ci.cmd_precheck, 'focused'), 0)
            (ev / 'prerequisite').mkdir()
            self.assertEqual(self.run_cmd(root, runner, ci.cmd_precheck, 'prerequisite'), 1)

    def test_precheck_requires_database_probe_and_build_binding(self):
        for name in ('db-probe.json', 'bind-build.json', 'bind-pre.json'):
            with self.subTest(missing=name), tempfile.TemporaryDirectory() as tmp:
                root, runner, ev = self.world(tmp)
                (ev / name).unlink()
                self.assertEqual(self.run_cmd(root, runner, ci.cmd_precheck, 'prerequisite'), 1)
        with tempfile.TemporaryDirectory() as tmp:
            root, runner, ev = self.world(tmp)
            write_json(ev / 'db-probe.json', {'ok': False})
            self.assertEqual(self.run_cmd(root, runner, ci.cmd_precheck, 'prerequisite'), 1)

    def test_check_accepts_matching_source_and_evidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, runner, ev = self.world(tmp)
            self.stage(ev, runner, 'prerequisite', [])
            self.assertEqual(self.run_cmd(root, runner, ci.cmd_check, 'prerequisite'), 0)
            self.assertTrue(json.loads((ev / 'verdict-prerequisite.json').read_text())['ok'])

    def test_check_all_requires_the_aggregate_and_binding(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, runner, ev = self.world(tmp)
            self.stage(ev, runner, 'all', [])
            self.assertEqual(self.run_cmd(root, runner, ci.cmd_check, 'all'), 0)

    def test_check_fails_on_source_dist_and_untracked_drift(self):
        for label, change in (('source', lambda r: write(r / 'src/index.ts', 'evil')),
                              ('dist', lambda r: write(r / 'dist' / 'index.js', 'tampered')),
                              ('dist-added', lambda r: write(r / 'dist' / 'extra.js', 'x')),
                              ('untracked', lambda r: write(r / 'stray.txt', 'x'))):
            with self.subTest(change=label), tempfile.TemporaryDirectory() as tmp:
                root, runner, ev = self.world(tmp)
                self.stage(ev, runner, 'all', [])
                change(root)
                self.assertEqual(self.run_cmd(root, runner, ci.cmd_check, 'all'), 1)
                self.assertFalse(json.loads((ev / 'verdict-all.json').read_text())['ok'])
                self.assertFalse(json.loads((ev / 'bind-post-all.json').read_text())['ok'])

    def test_check_fails_when_the_tracked_set_changes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, runner, ev = self.world(tmp)
            self.stage(ev, runner, 'all', [])
            env = {'RUNNER_TEMP': str(runner)}
            with mock.patch.dict(os.environ, env), mock.patch.object(ci, 'ROOT', root), \
                    mock.patch.object(ci, 'tracked_files', lambda: TRACKED[:-1]), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(ci.cmd_check('all'), 1)


class RawRetention(unittest.TestCase):
    def test_complete_success_in_workflow_order_is_accepted_after_both_uploads(self):
        with tempfile.TemporaryDirectory() as tmp:
            ev, runtime = build_full(tmp, ci.STAGES[:2])  # prerequisite and focused only: the aggregate does not exist yet
            controls = collect(tmp, 'controls')
            self.assertFalse((Path(tmp) / 'ci' / 'upload-controls' / 'attempts' / ATTEMPTS['all']).exists())
            add_stage(ev, runtime, 'all')
            full = collect(tmp, 'full')
            for final in (controls, full):
                self.assertEqual(final['collection_problems'], {'missing': [], 'censored': [], 'errors': []})
                self.assertEqual(final['evidence_status'], 'complete')
            self.assertEqual(sorted(controls['verdicts']), ['focused', 'prerequisite'])
            self.assertEqual(sorted(full['verdicts']), ['all', 'focused', 'prerequisite'])
            self.assertEqual(final_code(tmp), 0)
            upload = Path(tmp) / 'ci' / 'upload-full' / 'attempts'
            self.assertFalse((upload / 'attempt-p' / 'guard-result.json').exists())
            self.assertTrue((upload / 'attempt-3' / NONCES['all'][0] / 'completion.json').exists())
            self.assertTrue((upload / 'attempt-3' / NONCES['all'][0] / 'output.log').exists())

    def test_late_controls_collection_salvages_an_existing_aggregate_attempt(self):
        # Supplemental salvage sweeps every existing attempt, so a tree that already holds the aggregate keeps it.
        with tempfile.TemporaryDirectory() as tmp:
            build_full(tmp)
            collect(tmp, 'controls')
            self.assertTrue((Path(tmp) / 'ci' / 'upload-controls' / 'attempts' / ATTEMPTS['all']).exists())

    def test_final_gate_needs_every_external_outcome(self):
        with tempfile.TemporaryDirectory() as tmp:
            build_full(tmp)
            collect_both(tmp)
            for name in ci.FINAL_OUTCOMES:
                for value in ('failure', 'skipped', 'cancelled', ''):
                    with self.subTest(name=name, value=value):
                        self.assertEqual(final_code(tmp, **{name: value}), 1)
            with mock.patch.dict(os.environ, {'RUNNER_TEMP': tmp}), contextlib.redirect_stdout(io.StringIO()):
                for name in ci.FINAL_OUTCOMES:
                    os.environ.pop(name, None)
                self.assertEqual(ci.cmd_final(), 1)

    def test_final_gate_is_pure(self):
        good = {'all_stages_ok': True, 'evidence_status': 'complete'}
        self.assertEqual(ci.final_verdict({'controls': good, 'full': good}, OK_OUTCOMES), [])
        self.assertTrue(ci.final_verdict({'controls': good, 'full': None}, OK_OUTCOMES))
        self.assertTrue(ci.final_verdict({'controls': good, 'full': {**good, 'evidence_status': 'partial/censored'}}, OK_OUTCOMES))
        self.assertTrue(ci.final_verdict({'controls': {**good, 'all_stages_ok': False}, 'full': good}, OK_OUTCOMES))

    def assert_partial_and_held(self, remove, scope='full', missing_verdict=None):
        """Missing raw capture leaves the (earlier) verdicts green; a missing verdict is unknown, never green."""
        with tempfile.TemporaryDirectory() as tmp:
            ev, runtime = build_full(tmp)
            remove(runtime, ev)
            collect_both(tmp)
            final = json.loads((Path(tmp) / 'ci' / ('upload-' + scope) / 'final.json').read_text())
            self.assertEqual(final['evidence_status'], 'partial/censored')
            if missing_verdict is None:
                self.assertTrue(final['all_stages_ok'])  # verdicts alone must not decide completeness
            else:
                self.assertIs(final['all_stages_ok'], False)
                self.assertIsNone(final['verdicts'][missing_verdict])
            self.assertEqual(final_code(tmp), 1)

    def mandatory(self, runtime):
        paths = [runtime / a / 'prerequisite.json' for a in ATTEMPTS.values()]
        paths += [runtime / ATTEMPTS[s] / 'guard-result.json' for s in ('focused', 'all')]
        for nonce in NONCES['focused']:
            paths += [runtime / ATTEMPTS['focused'] / nonce / n for n in ('result.json', 'output.log')]
        nonce = NONCES['all'][0]
        paths += [runtime / ATTEMPTS['all'] / nonce / n for n in ('result.json', 'output.log', 'completion.json')]
        return paths

    def test_each_mandatory_raw_file_is_required(self):
        with tempfile.TemporaryDirectory() as tmp:
            _, runtime = build_full(tmp)
            targets = [p.relative_to(runtime) for p in self.mandatory(runtime)]
        self.assertGreaterEqual(len(targets), 12)
        for rel in targets:
            with self.subTest(file=str(rel)):
                self.assert_partial_and_held(lambda runtime, ev, rel=rel: (runtime / rel).unlink())

    def test_whole_case_and_attempt_directories_are_required(self):
        import shutil
        for stage in ('focused', 'all'):
            for nonce in NONCES[stage]:
                with self.subTest(case=stage + ':' + nonce[:4]):
                    self.assert_partial_and_held(lambda runtime, ev, s=stage, n=nonce: shutil.rmtree(runtime / ATTEMPTS[s] / n))
        for stage in ci.STAGES:
            with self.subTest(attempt=stage):
                self.assert_partial_and_held(lambda runtime, ev, s=stage: shutil.rmtree(runtime / ATTEMPTS[s]))

    def test_each_stage_file_and_common_file_is_required(self):
        for stage in ci.STAGES:
            for name in ci.STAGE_FILES:
                with self.subTest(stage=stage, stage_file=name):
                    self.assert_partial_and_held(lambda runtime, ev, s=stage, n=name: (ev / s / n).unlink())
        for name, _ in ci.COMMON_FILES:
            with self.subTest(common=name):
                self.assert_partial_and_held(lambda runtime, ev, n=name: (ev / n).unlink())
        with self.subTest(common='bind-post-all.json'):
            self.assert_partial_and_held(lambda runtime, ev: (ev / 'bind-post-all.json').unlink())

    def test_missing_verdict_is_unknown_not_green_and_is_held(self):
        for stage in ci.STAGES:
            with self.subTest(verdict=stage):
                self.assert_partial_and_held(lambda runtime, ev, s=stage: (ev / ('verdict-%s.json' % s)).unlink(),
                                             missing_verdict=stage)

    def test_short_copy_is_not_complete(self):
        real = ci.read_head

        def short(path, limit):
            data, size = real(path, limit)
            return data[:-1], size

        with tempfile.TemporaryDirectory() as tmp:
            build_full(tmp)
            with mock.patch.object(ci, 'read_head', short):
                final = collect(tmp, 'full')
            self.assertEqual(final['evidence_status'], 'partial/censored')

    def test_oversize_retained_file_is_censored(self):
        with tempfile.TemporaryDirectory() as tmp:
            build_full(tmp)
            with mock.patch.object(ci, 'COPY_LIMIT', 4):
                final = collect(tmp, 'full')
            self.assertTrue(final['collection_problems']['censored'])
            self.assertEqual(final['evidence_status'], 'partial/censored')

    def test_fatal_json_is_retained_when_present(self):
        with tempfile.TemporaryDirectory() as tmp:
            _, runtime = build_full(tmp)
            write(runtime / ATTEMPTS['all'] / 'fatal.json', '{"reason": "x"}')
            write(runtime / ATTEMPTS['all'] / NONCES['all'][0] / 'fatal.json', '{"reason": "y"}')
            collect(tmp, 'full')
            upload = Path(tmp) / 'ci' / 'upload-full' / 'attempts' / ATTEMPTS['all']
            self.assertTrue((upload / 'fatal.json').exists())
            self.assertTrue((upload / NONCES['all'][0] / 'fatal.json').exists())

    def test_database_credentials_never_reach_the_retained_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            ev, _ = build_full(tmp)
            (ev / 'all' / 'stderr').unlink()
            write(ev / 'all' / 'stderr', 'connect ' + URL + ' and postgres://x:y@h/d\n')
            write(ev / 'all' / 'stdout', (ev / 'all' / 'stdout').read_text() + URL + '\n')
            collect(tmp, 'full', {'TEST_DATABASE_URL': URL})
            kept = Path(tmp) / 'ci' / 'upload-full'
            blob = b''.join(p.read_bytes() for p in kept.rglob('*') if p.is_file())
            self.assertIn(b'[REDACTED]', blob)
            self.assertNotIn(b'postgres:postgres', blob)
            self.assertNotIn(b'x:y@', blob)

    def test_controls_scope_does_not_need_the_aggregate(self):
        import shutil
        with tempfile.TemporaryDirectory() as tmp:
            ev, runtime = build_full(tmp)
            shutil.rmtree(ev / 'all')
            shutil.rmtree(runtime / ATTEMPTS['all'])
            for name in ('verdict-all.json', 'bind-post-all.json'):
                (ev / name).unlink()
            controls = collect(tmp, 'controls')
            self.assertEqual(controls['evidence_status'], 'complete')
            full = collect(tmp, 'full')
            self.assertEqual(full['not_attempted'], ['all'])
            self.assertFalse(full['all_stages_ok'])
            self.assertEqual(final_code(tmp), 1)

    def test_failed_stage_is_held_but_its_evidence_is_still_collected(self):
        with tempfile.TemporaryDirectory() as tmp:
            ev, runtime = build_full(tmp)
            write(ev / 'all' / 'exit', '124\n')
            errors, facts = ci.evaluate_stage('all', ev / 'all', runtime, TRACKED)
            self.assertTrue(errors)
            write_json(ev / 'verdict-all.json', {'stage': 'all', 'ok': False, 'errors': errors, 'facts': facts})
            final = collect(tmp, 'full')
            self.assertFalse(final['all_stages_ok'])
            self.assertTrue((Path(tmp) / 'ci' / 'upload-full' / 'stages' / 'all' / 'stdout').exists())
            self.assertEqual(final_code(tmp), 1)

    def test_globally_missing_evidence_is_partial(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / 'ci' / 'evidence').mkdir(parents=True)
            (Path(tmp) / 'ci' / 'tmp').mkdir()
            final = collect(tmp, 'full')
            self.assertEqual(final['evidence_status'], 'partial/censored')
            self.assertFalse(final['all_stages_ok'])


class ControlsGate(unittest.TestCase):
    """precheck all must refuse to create the aggregate unless the controls evidence was collected completely."""

    def prepare(self, tmp, stages=ci.STAGES[:2]):
        ev, runtime = build_full(tmp, stages)  # green prerequisite/focused verdicts, bind-pre/build and db-probe ok
        return ev, runtime

    def precheck_all(self, tmp):
        with mock.patch.dict(os.environ, {'RUNNER_TEMP': tmp}), contextlib.redirect_stdout(io.StringIO()):
            return ci.cmd_precheck('all')

    def final_path(self, tmp):
        return Path(tmp) / 'ci' / 'upload-controls' / 'final.json'

    def test_genuinely_complete_controls_allow_the_aggregate(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.prepare(tmp)
            collect(tmp, 'controls')
            self.assertEqual(ci.controls_problems(Path(tmp) / 'ci' / 'upload-controls'), [])
            self.assertEqual(self.precheck_all(tmp), 0)

    def test_missing_record_blocks(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.prepare(tmp)
            self.assertEqual(self.precheck_all(tmp), 1)

    def test_malformed_record_blocks(self):
        for text in ('', '{', '[]', '"x"', 'null', '7', '{"scope": "controls"}'):
            with self.subTest(text=text), tempfile.TemporaryDirectory() as tmp:
                self.prepare(tmp)
                collect(tmp, 'controls')
                self.final_path(tmp).write_text(text)
                self.assertEqual(self.precheck_all(tmp), 1)

    def test_each_failed_controls_state_blocks_despite_green_verdicts(self):
        states = {
            'wrong scope': {'scope': 'full'}, 'missing scope': {'scope': None},
            'not all ok': {'all_stages_ok': False}, 'truthy string': {'all_stages_ok': 'true'}, 'null ok': {'all_stages_ok': None},
            'partial': {'evidence_status': 'partial/censored'}, 'status missing': {'evidence_status': None},
            'missing problems': {'collection_problems': {'missing': ['x'], 'censored': [], 'errors': []}},
            'censored problems': {'collection_problems': {'missing': [], 'censored': ['y'], 'errors': []}},
            'error problems': {'collection_problems': {'missing': [], 'censored': [], 'errors': ['z']}},
            'problems absent': {'collection_problems': {}},
            'focused failed': {'verdicts': {'prerequisite': True, 'focused': False}},
            'focused unknown': {'verdicts': {'prerequisite': True, 'focused': None}},
            'focused absent': {'verdicts': {'prerequisite': True}},
            'extra verdict': {'verdicts': {'prerequisite': True, 'focused': True, 'all': True}},
            'not attempted': {'not_attempted': ['focused']},
        }
        for label, change in states.items():
            with self.subTest(state=label), tempfile.TemporaryDirectory() as tmp:
                self.prepare(tmp)
                collect(tmp, 'controls')
                edit_json(self.final_path(tmp), lambda v, c=change: v.update(c))
                self.assertTrue(ci.controls_problems(Path(tmp) / 'ci' / 'upload-controls'))
                self.assertEqual(self.precheck_all(tmp), 1)

    def test_real_collector_censoring_blocks(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.prepare(tmp)
            with mock.patch.object(ci, 'COPY_LIMIT', 4):
                final = collect(tmp, 'controls')
            self.assertEqual(final['evidence_status'], 'partial/censored')
            self.assertEqual(self.precheck_all(tmp), 1)

    def test_real_collector_missing_raw_file_blocks_although_verdicts_are_green(self):
        with tempfile.TemporaryDirectory() as tmp:
            ev, runtime = self.prepare(tmp)
            (runtime / ATTEMPTS['focused'] / NONCES['focused'][0] / 'output.log').unlink()
            final = collect(tmp, 'controls')
            self.assertTrue(final['all_stages_ok'])
            self.assertEqual(final['evidence_status'], 'partial/censored')
            self.assertTrue(json.loads((ev / 'verdict-focused.json').read_text())['ok'])
            self.assertEqual(self.precheck_all(tmp), 1)

    def test_real_collector_failed_or_not_attempted_controls_block(self):
        with tempfile.TemporaryDirectory() as tmp:  # focused failed
            ev, _ = self.prepare(tmp)
            write_json(ev / 'verdict-focused.json', {'stage': 'focused', 'ok': False, 'errors': ['x'], 'facts': {}})
            final = collect(tmp, 'controls')
            self.assertFalse(final['all_stages_ok'])
            write_json(ev / 'verdict-focused.json', {'stage': 'focused', 'ok': True, 'errors': [], 'facts': {}})  # isolate the record
            self.assertEqual(self.precheck_all(tmp), 1)
        with tempfile.TemporaryDirectory() as tmp:  # focused never attempted when collected
            ev, _ = self.prepare(tmp, ci.STAGES[:1])
            final = collect(tmp, 'controls')
            self.assertEqual(final['not_attempted'], ['focused'])
            write_json(ev / 'verdict-focused.json', {'stage': 'focused', 'ok': True, 'errors': [], 'facts': {}})
            self.assertEqual(self.precheck_all(tmp), 1)

    def test_full_scope_record_in_the_controls_slot_blocks(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.prepare(tmp, ci.STAGES)
            collect(tmp, 'full')
            (Path(tmp) / 'ci' / 'upload-controls').mkdir()
            self.final_path(tmp).write_text((Path(tmp) / 'ci' / 'upload-full' / 'final.json').read_text())
            self.assertEqual(self.precheck_all(tmp), 1)  # also blocked by the already-attempted aggregate

    def test_other_stages_are_not_subject_to_the_controls_gate(self):
        with tempfile.TemporaryDirectory() as tmp:
            ev, _ = build_world(tmp)
            self.assertEqual(self.precheck_stage(tmp, 'prerequisite'), 0)
            write_json(ev / 'verdict-prerequisite.json', {'ok': True})
            self.assertEqual(self.precheck_stage(tmp, 'focused'), 0)

    def precheck_stage(self, tmp, stage):
        with mock.patch.dict(os.environ, {'RUNNER_TEMP': tmp}), contextlib.redirect_stdout(io.StringIO()):
            return ci.cmd_precheck(stage)


class WorkflowShape(unittest.TestCase):
    """Text-level checks of the fixed shape (no YAML library: standard library only)."""

    def text(self):
        return (HERE.parents[1] / '.github' / 'workflows' / 'ci.yml').read_text()

    def test_fixed_steps_and_ceilings(self):
        text = self.text()
        for needle in ('timeout-minutes: 190', 'timeout-minutes: 122', 'timeout-minutes: 30', 'name: foundation-ci',
                       'postgres:17', 'run-stage.sh prerequisite', 'run-stage.sh focused', 'run-stage.sh all',
                       'npm audit --audit-level=high', 'gitleaks/gitleaks-action@e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e',
                       'docker build --tag the-desk:${GITHUB_SHA}', 'AUDIT_OUTCOME', 'GITLEAKS_OUTCOME', 'CONTROLS_UPLOAD_OUTCOME'):
            self.assertIn(needle, text)
        self.assertNotIn('npm run test', text)
        self.assertNotIn('db:reset', text)
        self.assertNotIn('db:load-fixture', text)
        self.assertNotIn('workflow_dispatch', text)

    def test_partial_artifacts_are_still_uploaded_and_upload_failure_gates_the_aggregate(self):
        text = self.text()
        self.assertNotIn('continue-on-error', text)
        controls_upload = text.index('id: upload-controls')
        self.assertLess(text.index('id: collect-controls'), controls_upload)
        self.assertLess(controls_upload, text.index('run-stage.sh all'))
        block = text[controls_upload:text.index('run-stage.sh all')]
        self.assertIn('if: ${{ always() && steps.collect-controls.outcome == \'success\' }}', block)
        guard_step = text[text.index('name: Guard P33 aggregate (all)'):text.index('run-stage.sh all')]
        self.assertNotIn('if:', guard_step)  # default success() gating on every earlier step, uploads included



@contextlib.contextmanager
def fixture_world():
    """New public fixture bytes, synthetic tooling bytes; no tool or application execution."""
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp) / 'ci'
        checkout = Path(tmp) / 'checkout'
        for path in (base, base / 'tmp', base / 'evidence', checkout):
            path.mkdir(mode=0o700)
        for name in ci.FIXTURE_OWNER_PATHS:
            dst = checkout / name
            dst.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            dst.write_bytes((ci.ROOT / name).read_bytes())
            dst.chmod(0o600)
        (checkout / 'node_modules').mkdir(mode=0o700)
        (checkout / 'node_modules/public-test-tool.js').write_text('// inert public tooling witness\n')
        (checkout / 'node_modules/public-test-tool.js').chmod(0o600)
        binding = ci.fixture_prepare(base, checkout)
        root = Path(binding['root'])
        ci.fixture_write(base / 'evidence/fixture105-suite.json', {'schema': 'fixture105-suite/1', 'targets': [], 'pre_target_failures': [], 'tool_observations': [], 'suite_complete': False, 'cases': []})
        yield base, checkout, root, binding


class Fixture105Tooling(unittest.TestCase):
    def test_new_connected_files_each_required(self):
        for name in ci.FIXTURE_CONNECTED_COUNTS:
            errors, facts = [], {}
            ci.check_all_files(file_lines(), [p for p in TRACKED if p != name], errors, facts)
            self.assertIn('required connected file absent: ' + name, errors)

    def test_compensating_connected_count_drift_refuses(self):
        for unit, native in ((57, 34), (59, 32)):
            counts = dict(PER_FILE)
            counts.update({'test/unit/connected-fixture105.test.ts': unit, 'test/integration/connected-fixture105.test.ts': native})
            errors = []
            ci.check_all_files(file_lines(counts), TRACKED, errors, {})
            self.assertEqual(sum(counts.values()), 8688)
            self.assertEqual(sum('connected per-file count drift' in e for e in errors), 2)

    def test_frozen_render046_file_and_exact_count_are_required(self):
        # Independent literal pairs: the planner file and the response-lineage file are each pinned.
        for name, pinned in (('test/unit/frozen-render046.test.ts', 40),
                             ('test/unit/frozen-render046-responses.test.ts', 89)):
            with self.subTest(name=name):
                errors = []
                ci.check_all_files(file_lines(), [p for p in TRACKED if p != name], errors, {})
                self.assertIn('required frozen-render046 file absent: ' + name, errors)
                for count in (pinned - 1, pinned + 1):
                    counts = dict(PER_FILE)
                    counts[name] = count
                    # Compensate in an unpinned file so the aggregate total cannot mask the per-file check.
                    counts[OLD_SELECTED[0]] += pinned - count
                    errors = []
                    ci.check_all_files(file_lines(counts), TRACKED, errors, {})
                    self.assertEqual(sum(counts.values()), 8688)
                    self.assertIn('frozen-render046 per-file count drift: ' + name, errors)

    def test_fixture_namespace_does_not_match_supervisor_prefix(self):
        with fixture_world() as (base, checkout, root, binding):
            self.assertFalse(root.name.startswith('the-desk-p33-'))
            self.assertEqual(ci.fixture_validate(base, checkout), (binding, {'absent': True}))

    def test_fixture_preparation_is_exclusive(self):
        with fixture_world() as (base, checkout, root, binding):
            with self.assertRaisesRegex(RuntimeError, 'already exists'):
                ci.fixture_prepare(base, checkout)

    def test_arbitrary_tmpdir_without_runner_binding_refuses(self):
        with fixture_world() as (base, checkout, root, binding):
            (base / 'evidence/fixture105-binding.json').unlink()
            with mock.patch.dict(os.environ, {'TMPDIR': str(base / 'tmp')}):
                with self.assertRaises(FileNotFoundError):
                    ci.fixture_validate(base, checkout)

    def test_fixture_missing_required_binding_fails(self):
        for name in ci.FIXTURE_BINDINGS:
            with self.subTest(name=name), fixture_world() as (base, checkout, root, binding):
                (root / 'bindings' / name).unlink()
                with self.assertRaisesRegex(RuntimeError, 'population'):
                    ci.fixture_validate(base, checkout)

    def test_fixture_root_and_source_drift_refuse(self):
        for mode in ('marker', 'source', 'tool'):
            with self.subTest(mode=mode), fixture_world() as (base, checkout, root, binding):
                path = root / 'ROOT.json' if mode == 'marker' else checkout / ('docs/connected-fixture105.md' if mode == 'source' else 'node_modules/public-test-tool.js')
                path.write_bytes(path.read_bytes() + b'\n')
                with self.assertRaisesRegex(RuntimeError, 'hash|changed'):
                    ci.fixture_validate(base, checkout)

    def test_fixture_symlink_escape_refuses(self):
        with fixture_world() as (base, checkout, root, binding):
            source = root / 'bindings/RELEASE.json'
            original = source.read_bytes()
            source.unlink()
            outside = base / 'outside'
            outside.write_bytes(original)
            source.symlink_to(outside)
            with self.assertRaises(OSError):
                ci.fixture_validate(base, checkout)

    def test_fixture_ancestor_symlink_refuses(self):
        with fixture_world() as (base, checkout, root, binding):
            bindings = root / 'bindings'
            moved = base / 'moved-bindings'
            bindings.rename(moved)
            bindings.symlink_to(moved, target_is_directory=True)
            with self.assertRaises(OSError):
                ci.fixture_validate(base, checkout)

    def test_fixture_extra_or_oversize_leaf_refuses(self):
        with fixture_world() as (base, checkout, root, binding):
            ci.fixture_write(root / 'bindings/extra.json', {})
            with self.assertRaisesRegex(RuntimeError, 'population'):
                ci.fixture_validate(base, checkout)
            with self.assertRaisesRegex(RuntimeError, 'bound'):
                ci.fixture_read(root / 'ROOT.json', 1)

    def test_fixture_collection_retains_bindings_and_receipts(self):
        with fixture_world() as (base, checkout, root, binding):
            suite = self.journal(root)
            (base / 'evidence/fixture105-suite.json').write_bytes(ci.fixture_bytes(suite))
            upload = base / 'upload'
            upload.mkdir(mode=0o700)
            keep = ci.Retention(upload)
            ci.fixture_collect(base, keep, 'full', {})
            self.assertFalse(any(keep.problems.values()))
            for name in ci.FIXTURE_BINDINGS:
                self.assertEqual((upload / 'fixture105/bindings' / name).read_bytes(), (root / 'bindings' / name).read_bytes())
            self.assertTrue((upload / 'fixture105/suite.json').is_file())
            self.assertTrue((upload / 'fixture105/receipts' / ('a' * 64) / 'CONSTRUCTION.json').is_file())
            self.assertTrue((root / 'RETENTION.json').is_file())

    def test_fixture_partial_failure_is_retained_not_passed(self):
        with fixture_world() as (base, checkout, root, binding):
            (root / 'bindings/RELEASE.json').unlink()
            upload = base / 'upload'
            upload.mkdir(mode=0o700)
            keep = ci.Retention(upload)
            ci.fixture_collect(base, keep, 'full', {})
            self.assertIn('fixture105/bindings/RELEASE.json', keep.problems['missing'])
            self.assertTrue((upload / 'fixture105/ROOT.json').exists())

    def test_fixture_changed_during_copy_refuses(self):
        with fixture_world() as (base, checkout, root, binding):
            upload = base / 'upload'
            upload.mkdir(mode=0o700)
            keep = ci.Retention(upload)
            original = keep.copy
            def mutate(src, rel, limit, *, required):
                result = original(src, rel, limit, required=required)
                if str(rel) == 'fixture105/ROOT.json':
                    Path(src).write_bytes(Path(src).read_bytes() + b'\n')
                return result
            with mock.patch.object(keep, 'copy', mutate):
                ci.fixture_collect(base, keep, 'full', {})
            self.assertTrue(keep.problems['errors'])

    def test_fixture_redacted_identity_is_distinct(self):
        with fixture_world() as (base, checkout, root, binding):
            upload = base / 'upload'
            upload.mkdir(mode=0o700)
            keep = ci.Retention(upload, extra=['fixture105-execution-root/1'])
            ci.fixture_collect(base, keep, 'full', {})
            manifest = json.loads((upload / 'fixture105-retention.json').read_text())
            row = next(p for p in manifest['files'] if p['path'] == 'fixture105/ROOT.json')
            self.assertTrue(row['redacted'])
            self.assertNotEqual(row['original'], row['retained'])

    def test_fixture_upload_failure_blocks_success(self):
        good = {'all_stages_ok': True, 'evidence_status': 'complete'}
        self.assertTrue(ci.final_verdict({scope: good for scope in ci.SCOPES}, {**OK_OUTCOMES, 'UPLOAD_OUTCOME': 'failure'}))

    def journal(self, root):
        # Fully disclosed synthetic tooling records, not native execution evidence.
        release_bytes = (root / 'bindings/RELEASE.json').read_bytes()
        release = json.loads(release_bytes)
        subject = ci.fixture_hash(json.dumps(release['subject_binding'], sort_keys=True, separators=(',', ':')).encode())
        suite = {'schema': 'fixture105-suite/1', 'targets': [], 'pre_target_failures': [], 'tool_observations': [], 'suite_complete': True, 'cases': []}
        for fixed in ci.FIXTURE_CASE_EXPECTATIONS:
            case = {**fixed, 'completed': True, 'calls': []}
            suite['cases'].append(case)
            for ordinal, expected in enumerate(fixed['expected']):
                call = {'ordinal': ordinal, 'expected': expected, 'completed': True, 'returned': expected == 'completed', 'target_hash': None, 'pre_target_index': None}
                case['calls'].append(call)
                if expected == 'pre_target_failure':
                    call['pre_target_index'] = len(suite['pre_target_failures'])
                    suite['pre_target_failures'].append('synthetic_pre_target_refusal')
                    continue
                target = 'a' * 64 if not suite['targets'] else format(len(suite['targets']), '064x')
                call['target_hash'] = target
                unknown = expected == 'expected_construction_unknown'
                row = {'target_hash': target, 'construction_state': 'construction_unknown' if unknown else 'construction_recorded', 'later_phase': 'construction' if unknown else 'direction' if expected == 'expected_later_phase_unknown' else 'readback', 'later_outcome': 'completed' if expected == 'completed' else 'refused' if expected == 'expected_refusal' else 'unknown'}
                suite['targets'].append(row)
                intent = {'schema': 'fixture105-receipt-intent/1', 'target_hash': target, 'release_sha256': ci.fixture_hash(release_bytes), 'subject_sha256': subject, 'expected_names': ['CONSTRUCTION.json'], 'state': 'intent'}
                pin = ci.fixture_write(root / 'expectations' / (target + '.intent.json'), intent)
                if unknown:
                    continue
                directory = root / 'receipts' / target
                directory.mkdir(mode=0o700)
                receipt = ci.fixture_write(directory / 'CONSTRUCTION.json', {'observed': 'synthetic tooling witness, not a database receipt'})
                ci.fixture_write(root / 'expectations' / (target + '.terminal.json'), {'schema': 'fixture105-receipt-terminal/1', 'target_hash': target, 'intent_sha256': pin['sha256'], 'state': 'construction_recorded', 'receipts': [{'name': 'CONSTRUCTION.json', **receipt}]})
        return suite

    def test_completed_target_directory_deleted_refuses(self):
        for removed in ('directory', 'intent', 'terminal'):
            with self.subTest(removed=removed), fixture_world() as (base, checkout, root, binding):
                suite = self.journal(root)
                ci.fixture_journal(root, suite)
                target = suite['targets'][0]['target_hash']
                if removed == 'directory':
                    (root / 'receipts' / target / 'CONSTRUCTION.json').unlink()
                    (root / 'receipts' / target).rmdir()
                else:
                    (root / 'expectations' / (target + '.' + removed + '.json')).unlink()
                with self.assertRaises((OSError, RuntimeError)):
                    ci.fixture_journal(root, suite)

    def test_unknown_construction_has_no_invented_terminal(self):
        with fixture_world() as (base, checkout, root, binding):
            suite = self.journal(root)
            target = next(row for row in suite['targets'] if row['construction_state'] == 'construction_unknown')
            ci.fixture_journal(root, suite)
            # All expectation/call correspondence remains valid; only this forbidden
            # terminal is introduced, so the intended unknown guard is reached.
            ci.fixture_write(root / 'expectations' / (target['target_hash'] + '.terminal.json'), {})
            with self.assertRaisesRegex(RuntimeError, 'unknown construction'):
                ci.fixture_journal(root, suite)

    def test_expected_observed_correspondence_is_separate(self):
        with fixture_world() as (base, checkout, root, binding):
            suite = self.journal(root)
            suite['targets'][0]['later_outcome'] = 'unknown'
            with self.assertRaisesRegex(RuntimeError, 'outcome correspondence'):
                ci.fixture_journal(root, suite)

    def test_later_unknown_preserves_construction_terminal(self):
        with fixture_world() as (base, checkout, root, binding):
            suite = self.journal(root)
            target = next(row for row in suite['targets'] if row['construction_state'] == 'construction_recorded' and row['later_outcome'] == 'unknown')
            ci.fixture_journal(root, suite)
            (root / 'expectations' / (target['target_hash'] + '.terminal.json')).unlink()
            with self.assertRaises(OSError):
                ci.fixture_journal(root, suite)

    def test_root_validation_precedes_cluster_allocation(self):
        body = (ci.ROOT / 'test/integration/connected-fixture105.test.ts').read_text()
        root_calls = list(re.finditer(r'executionRoot\s*=\s*validateConnectedFixture105ExecutionRoot\s*\(\s*\)', body))
        allocations = list(re.finditer(r'cluster\s*=\s*new\s+TrackedFixtureCluster\s*\(bootstrapUrl\)', body))
        self.assertEqual((len(root_calls), len(allocations)), (1, 1))
        self.assertLess(root_calls[0].start(), allocations[0].start())
        host = (ci.ROOT / 'src/runtime/connected-fixture105.ts').read_text()
        self.assertNotIn('.fixture105-execution', host)
        intent = re.search(r'journalIntent\(\s*this\.binding\s*,\s*this\.target\s*\)', host)
        allocation = re.search(r'await\s+this\.initializeSubject\(\)', host)
        self.assertIsNotNone(intent)
        self.assertIsNotNone(allocation)
        self.assertLess(intent.start(), allocation.start())

    def cache(self, root, prefix=''):
        path = root / 'tool-cache' / prefix / 'vitest' / ci.FIXTURE_CACHE_HASH / 'results.json'
        path.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
        ci.fixture_write(path, {'version': '4.1.12', 'results': [[':test/unit/example.test.ts', {'duration': 1, 'failed': False}]]})
        return path

    def test_exact_cache_capture_and_missing_write_refusal(self):
        with fixture_world() as (base, checkout, root, binding):
            with self.assertRaisesRegex(RuntimeError, 'missing expected'):
                ci.fixture_cache_snapshot(root, {'test/unit/example.test.ts'}, [], True)
            path = self.cache(root)
            got = ci.fixture_cache_snapshot(root, {'test/unit/example.test.ts'}, [], True)
            self.assertEqual(got['vitest/' + ci.FIXTURE_CACHE_HASH + '/results.json']['sha256'], ci.fixture_hash(path.read_bytes()))

    def test_cache_shape_path_count_and_special_refusals(self):
        with fixture_world() as (base, checkout, root, binding):
            path = self.cache(root)
            for content in ({'version': '4.1.12', 'results': [[':foreign', {'duration': 1, 'failed': False}]]}, {'version': '4.1.12', 'results': [[':test/unit/example.test.ts', {'duration': -1, 'failed': False}]]}, {'version': 'x', 'results': [], 'extra': True}):
                path.write_bytes(ci.fixture_bytes(content))
                with self.assertRaisesRegex(RuntimeError, 'cache'):
                    ci.fixture_cache_snapshot(root, {'test/unit/example.test.ts'}, [], True)
            path.unlink()
            path.symlink_to(root / 'ROOT.json')
            with self.assertRaisesRegex(RuntimeError, 'ownership'):
                ci.fixture_cache_snapshot(root, {'test/unit/example.test.ts'}, [], True)
            with self.assertRaisesRegex(RuntimeError, 'nonce'):
                ci.fixture_cache_snapshot(root, set(), ['a' * 48] * 9, True)

    def test_loader_exact_empty_settlement_and_immutable_package_controls(self):
        with fixture_world() as (base, checkout, root, binding):
            directory = checkout / 'node_modules/.vite-temp'
            directory.mkdir(mode=0o700)
            identity = ci.fixture_temp(checkout, True)
            self.assertEqual(identity['leaves'], [])
            leaf = directory / 'vitest.config.ts.timestamp-1-.mjs'
            ci.fixture_write(leaf, {'inert': True})
            self.assertEqual(len(ci.fixture_temp(checkout)['leaves']), 1)
            with self.assertRaisesRegex(RuntimeError, 'unsettled'):
                ci.fixture_temp(checkout, True)
            leaf.rename(directory / 'wrong.mjs')
            with self.assertRaisesRegex(RuntimeError, 'name'):
                ci.fixture_temp(checkout)
            (directory / 'wrong.mjs').unlink()
            (checkout / 'node_modules/.vite').mkdir(mode=0o700)
            with self.assertRaisesRegex(RuntimeError, 'immutable graph'):
                ci.fixture_validate(base, checkout)



    def test_adoption_all_relations_before_allocation(self):
        for mutation in ('release_id', 'release_bytes', 'release_sha256', 'ledger_bytes', 'ledger_sha256', 'malformed', 'oversize', 'symlink', 'fifo'):
            with self.subTest(mutation=mutation), fixture_world() as (base, checkout, root, binding):
                path = root / 'bindings/ADOPTION.json'
                original = path.read_bytes()
                path.unlink()
                if mutation == 'symlink':
                    path.symlink_to(root / 'ROOT.json')
                elif mutation == 'fifo':
                    os.mkfifo(path, 0o600)
                elif mutation in ('malformed', 'oversize'):
                    ci.fixture_write_raw(path, b'{' if mutation == 'malformed' else b'x' * 262145)
                else:
                    value = json.loads(original)
                    value[mutation] = 0 if mutation.endswith('bytes') else 'changed'
                    ci.fixture_write(path, value)
                with self.assertRaises((OSError, RuntimeError, ValueError)):
                    ci.fixture_validate(base, checkout)
                self.assertEqual(list((root / 'expectations').iterdir()), [])
                self.assertEqual(list((root / 'receipts').iterdir()), [])

    def capture_controls(self, base, checkout, root):
        records = {}
        cache = self.cache(root)
        cache.write_bytes(ci.fixture_bytes({'version': '4.1.12', 'results': [[':test/unit/unit00.test.ts', {'duration': 1, 'failed': False}]]}))
        with mock.patch.object(ci, 'ROOT', checkout), mock.patch.object(ci, 'tracked_files', return_value=TRACKED):
            for stage in ci.SCOPES['controls']:
                before = {'binding': json.loads((base / 'evidence/fixture105-binding.json').read_text())}
                ci.fixture_write(base / ('evidence/fixture105-before-' + stage + '.json'), before)
                record = ci.fixture_capture_stage(base, stage, {}, False)
                self.assertTrue(record['complete'], record)
                records[stage] = {'ok': True, 'facts': {'fixture105': record}}
        return records

    def test_real_prepare_capture_collect_final_under_umask022(self):
        with fixture_world() as (base, checkout, root, binding):
            previous = os.umask(0o022)
            try:
                records = self.capture_controls(base, checkout, root)
                upload = base / 'upload'
                upload.mkdir(mode=0o700)
                keep = ci.Retention(upload)
                with mock.patch.object(ci, 'ROOT', checkout):
                    ci.fixture_collect(base, keep, 'controls', records)
                self.assertFalse(any(keep.problems.values()), keep.problems)
                for path in (base / 'evidence').glob('fixture105-cache-*/**/results.json'):
                    self.assertEqual(path.stat().st_mode & 0o777, 0o600)
                    self.assertEqual(path.read_bytes(), (root / 'tool-cache/vitest' / ci.FIXTURE_CACHE_HASH / 'results.json').read_bytes())
                # The real final predicate receives actual collector completeness;
                # other scopes are explicitly synthetic, not an executed application.
                final = {'all_stages_ok': all(row['ok'] for row in records.values()), 'evidence_status': 'complete' if not any(keep.problems.values()) else 'partial/censored'}
                self.assertEqual(ci.final_verdict({scope: final for scope in ci.SCOPES}, OK_OUTCOMES), [])
            finally:
                os.umask(previous)

    def test_real_synthetic_preparation_to_both_collectors_and_final(self):
        with fixture_world() as (base, checkout, root, binding):
            ev = base / 'evidence'
            runtime = base / 'tmp/the-desk-p33-1000-abc'
            runtime.mkdir(mode=0o700)
            for name in ('env.json', 'identity.json', 'db-probe.json', 'snapshot-pre.json', 'bind-pre.json', 'bind-build.json'):
                write_json(ev / name, {'ok': True})
            suite = self.journal(root)
            (ev / 'fixture105-suite.json').write_bytes(ci.fixture_bytes(suite))
            cache = self.cache(root)
            cache.write_bytes(ci.fixture_bytes({'version': '4.1.12', 'results': [[':test/unit/unit00.test.ts', {'duration': 1, 'failed': False}]]}))
            previous = os.umask(0o022)
            try:
                with mock.patch.object(ci, 'ROOT', checkout), mock.patch.object(ci, 'tracked_files', return_value=TRACKED), mock.patch.dict(os.environ, {'RUNNER_TEMP': str(base.parent), **OK_OUTCOMES}), contextlib.redirect_stdout(io.StringIO()):
                    for stage in ci.STAGES:
                        add_stage(ev, runtime, stage)
                        verdict_path = ev / ('verdict-' + stage + '.json')
                        verdict = json.loads(verdict_path.read_bytes())
                        for case in verdict['facts'].get('cases', []):
                            if case.get('mode') == 'p33':
                                nested = self.cache(root, 'p33/' + case['nonce'])
                                nested.write_bytes(ci.fixture_bytes({'version': '4.1.12', 'results': [[':test/support/p33-parity-child.case.ts', {'duration': 1, 'failed': False}]]}))
                        ci.fixture_write(ev / ('fixture105-before-' + stage + '.json'), {'binding': binding})
                        record = ci.fixture_capture_stage(base, stage, verdict['facts'], True)
                        self.assertTrue(record['complete'], record)
                        verdict['facts']['fixture105'] = record
                        write_json(verdict_path, verdict)
                        if stage == 'focused':
                            ci.cmd_collect('controls')
                    ci.cmd_collect('full')
                    self.assertEqual(ci.cmd_final(), 0)
                for scope in ci.SCOPES:
                    final = json.loads((base / ('upload-' + scope) / 'final.json').read_bytes())
                    self.assertEqual(final['evidence_status'], 'complete', final)
                    self.assertTrue(final['all_stages_ok'])
            finally:
                os.umask(previous)

    def test_success_snapshot_population_and_hash_are_required(self):
        for mutation in ('directory', 'leaf', 'bytes', 'extra', 'record', 'empty_directory', 'excess_directories'):
            with self.subTest(mutation=mutation), fixture_world() as (base, checkout, root, binding):
                records = self.capture_controls(base, checkout, root)
                stage = ci.SCOPES['controls'][0]
                directory = base / ('evidence/fixture105-cache-' + stage)
                leaf = directory / 'vitest' / ci.FIXTURE_CACHE_HASH / 'results.json'
                if mutation == 'directory':
                    directory.rename(base / 'retained-snapshot')
                elif mutation == 'leaf':
                    leaf.unlink()
                elif mutation == 'bytes':
                    leaf.write_bytes(leaf.read_bytes() + b' ')
                elif mutation == 'extra':
                    ci.fixture_write(directory / 'extra.json', {})
                elif mutation == 'empty_directory':
                    (directory / 'foreign').mkdir(mode=0o700)
                elif mutation == 'excess_directories':
                    for index in range(11):
                        (directory / ('foreign' + str(index))).mkdir(mode=0o700)
                else:
                    path = base / ('evidence/fixture105-after-' + stage + '.json')
                    row = json.loads(path.read_bytes())
                    row['snapshot'] = {}
                    path.write_bytes(ci.fixture_bytes(row))
                upload = base / 'upload'
                upload.mkdir(mode=0o700)
                keep = ci.Retention(upload)
                with mock.patch.object(ci, 'ROOT', checkout):
                    ci.fixture_collect(base, keep, 'controls', records)
                self.assertTrue(keep.problems['errors'])
                final = {'all_stages_ok': True, 'evidence_status': 'partial/censored'}
                self.assertTrue(ci.final_verdict({scope: final for scope in ci.SCOPES}, OK_OUTCOMES))

    def test_partial_survivor_is_captured_before_rejection_and_salvaged(self):
        with fixture_world() as (base, checkout, root, binding):
            path = self.cache(root)
            path.write_bytes(b'{malformed cache')
            loader = checkout / 'node_modules/.vite-temp'
            loader.mkdir(mode=0o700)
            name = 'vitest.config.ts.timestamp-1-.mjs'
            ci.fixture_write_raw(loader / name, b'// synthetic survivor\n')
            ci.fixture_write(base / 'evidence/fixture105-loader-created.json', ci.fixture_temp(checkout))
            with mock.patch.object(ci, 'ROOT', checkout), mock.patch.object(ci, 'tracked_files', return_value=TRACKED):
                record = ci.fixture_capture_stage(base, 'focused', {}, True)
                self.assertFalse(record['complete'])
                self.assertEqual((base / 'evidence/fixture105-cache-focused/loader' / name).read_bytes(), (loader / name).read_bytes())
                # all has no post-check at all: failed runtime evidence must survive.
                (base / 'evidence/all').mkdir(mode=0o700)
                upload = base / 'upload'
                upload.mkdir(mode=0o700)
                keep = ci.Retention(upload)
                ci.fixture_collect(base, keep, 'full', {})
            self.assertEqual((upload / 'tooling-fixture105/salvage-full-all/loader' / name).read_bytes(), (loader / name).read_bytes())
            self.assertEqual((upload / 'tooling-fixture105/salvage-full-all/vitest' / ci.FIXTURE_CACHE_HASH / 'results.json').read_bytes(), path.read_bytes())

    def test_harness_incomplete_or_unaccounted_calls_refuse(self):
        for mutation in ('case', 'call', 'expectation', 'pretarget', 'extra_target'):
            with self.subTest(mutation=mutation), fixture_world() as (base, checkout, root, binding):
                suite = self.journal(root)
                if mutation == 'case':
                    suite['cases'][0]['completed'] = False
                elif mutation == 'call':
                    suite['cases'][0]['calls'][0]['completed'] = False
                elif mutation == 'expectation':
                    suite['cases'][0]['expected'] = ['expected_refusal']
                elif mutation == 'pretarget':
                    suite['pre_target_failures'].append('unexpected_open_failure')
                else:
                    suite['targets'].append({**suite['targets'][0], 'target_hash': 'f' * 64})
                with self.assertRaisesRegex(RuntimeError, 'harness|unaccounted'):
                    ci.fixture_journal(root, suite)

    def test_valid_version_cache_refusals_reach_rows_and_bounds(self):
        good = [':test/unit/example.test.ts', {'duration': 1, 'failed': False}]
        for rows in ([good, good], [[':foreign', good[1]]], [[good[0], {'duration': -1, 'failed': False}]], [[good[0], {'duration': 1, 'failed': 'false'}]]):
            with self.assertRaisesRegex(RuntimeError, 'cache row'):
                ci.fixture_cache_rows(ci.fixture_bytes({'version': '4.1.12', 'results': rows}), {'test/unit/example.test.ts'})
        with self.assertRaisesRegex(RuntimeError, 'cache shape'):
            ci.fixture_cache_rows(ci.fixture_bytes({'version': 'wrong', 'results': []}), set())
        for mutation in ('mode', 'oversize', 'duplicate_nonce', 'wrong_project', 'multiple_loader'):
            with self.subTest(mutation=mutation), fixture_world() as (base, checkout, root, binding):
                path = self.cache(root)
                if mutation == 'mode':
                    path.chmod(0o622)
                elif mutation == 'oversize':
                    path.write_bytes(b'x' * (ci.SNAPSHOT_LIMIT + 1))
                elif mutation == 'wrong_project':
                    path.rename(path.with_name('foreign.json'))
                elif mutation == 'multiple_loader':
                    loader = checkout / 'node_modules/.vite-temp'
                    loader.mkdir(mode=0o700)
                    for name in ('vitest.config.ts.timestamp-1-a.mjs', 'vitest.config.ts.timestamp-2-b.mjs'):
                        ci.fixture_write_raw(loader / name, b'// new synthetic tooling only\n')
                    with self.assertRaisesRegex(RuntimeError, 'unsettled'):
                        ci.fixture_temp(checkout)
                    continue
                with self.assertRaises((OSError, RuntimeError)):
                    ci.fixture_cache_snapshot(root, {'test/unit/example.test.ts'}, ['a' * 48, 'a' * 48] if mutation == 'duplicate_nonce' else [], True)


    def test_failed_controls_then_full_salvage_and_stage_isolation(self):
        for inject_first_capture_collision in (False, True):
            with self.subTest(collision=inject_first_capture_collision), fixture_world() as (base, checkout, root, binding):
                path = self.cache(root)
                raw = b'{malformed but safely bounded generated cache'
                path.write_bytes(raw)
                # All attempts failed before their normal check. No pass is invented.
                for stage in ci.STAGES:
                    (base / 'evidence' / stage).mkdir(mode=0o700)
                if inject_first_capture_collision:
                    (base / 'evidence/fixture105-cache-salvage-controls-prerequisite').mkdir(mode=0o700)
                with mock.patch.object(ci, 'ROOT', checkout):
                    for scope in ('controls', 'full'):
                        upload = base / ('upload-' + scope)
                        upload.mkdir(mode=0o700)
                        keep = ci.Retention(upload)
                        ci.fixture_collect(base, keep, scope, {})
                        # A prerequisite collision cannot suppress focused retention;
                        # the second scope receives a distinct immutable capture.
                        stages = ('focused',) if scope == 'controls' else ('prerequisite', 'focused', 'all')
                        for stage in stages:
                            leaf = upload / ('tooling-fixture105/salvage-' + scope + '-' + stage) / 'vitest' / ci.FIXTURE_CACHE_HASH / 'results.json'
                            self.assertEqual(leaf.read_bytes(), raw)
                        final = {'all_stages_ok': False, 'evidence_status': 'partial/censored'}
                        self.assertTrue(ci.final_verdict({name: final for name in ci.SCOPES}, OK_OUTCOMES))
                        if inject_first_capture_collision and scope == 'controls':
                            self.assertTrue(any('prerequisite' in error for error in keep.problems['errors']))
                control = base / 'evidence/fixture105-cache-salvage-controls-focused/vitest' / ci.FIXTURE_CACHE_HASH / 'results.json'
                full = base / 'evidence/fixture105-cache-salvage-full-focused/vitest' / ci.FIXTURE_CACHE_HASH / 'results.json'
                self.assertEqual(control.read_bytes(), full.read_bytes())
                self.assertNotEqual(control.stat().st_ino, full.stat().st_ino)

    def test_snapshot_empty_allowed_ancestor_and_directory_bound(self):
        for mutation in ('empty_loader', 'eleven_nonce_directories'):
            with self.subTest(mutation=mutation), fixture_world() as (base, checkout, root, binding):
                records = self.capture_controls(base, checkout, root)
                stage = ci.SCOPES['controls'][0]
                snapshot = base / ('evidence/fixture105-cache-' + stage)
                if mutation == 'empty_loader':
                    (snapshot / 'loader').mkdir(mode=0o700)
                    with self.assertRaisesRegex(RuntimeError, 'directory population'):
                        ci.fixture_snapshot_population(snapshot, records[stage]['facts']['fixture105']['snapshot'])
                    # Even partial/unpinned traversal refuses an otherwise permitted
                    # directory with no captured leaf rather than silently omitting it.
                    with self.assertRaisesRegex(RuntimeError, 'empty/missing directory'):
                        ci.fixture_snapshot_population(snapshot)
                else:
                    nested = snapshot / 'p33'
                    nested.mkdir(mode=0o700)
                    for index in range(11):
                        (nested / format(index, '048x')).mkdir(mode=0o700)
                    with self.assertRaisesRegex(RuntimeError, 'entry bound'):
                        ci.fixture_snapshot_population(snapshot)


class FixtureGraphDiagnostic(unittest.TestCase):
    def diagnostic(self, expected, actual, kind='source'):
        return json.loads(ci.fixture_graph_difference(expected, actual, kind))

    def test_equality_and_success_unchanged(self):
        graph = {'': {'type': 'directory', 'mode': 448}}
        self.assertEqual(self.diagnostic(graph, graph),
                         {'kind': 'source', 'changed_path_count': 0, 'differences': []})
        with fixture_world() as (base, checkout, root, binding):
            with mock.patch.object(ci, 'fixture_graph', wraps=ci.fixture_graph) as capture:
                self.assertEqual(ci.fixture_validate(base, checkout), (binding, {'absent': True}))
            self.assertEqual([call.args for call in capture.call_args_list],
                             [(checkout, 'source'), (checkout / 'node_modules', 'tools')])

    def test_addition_removal_sorted_and_values_excluded(self):
        expected = {'z': {'type': 'symlink', 'target': 'PRIVATE_TARGET'}}
        actual = {'a': {'type': 'file', 'sha256': 'PRIVATE_HASH', 'bytes': 123}}
        raw = ci.fixture_graph_difference(expected, actual, 'tools')
        result = json.loads(raw)
        self.assertEqual(result['kind'], 'tools')
        self.assertEqual(result['changed_path_count'], 2)
        self.assertEqual(result['differences'], [
            {'path': 'a', 'classification': 'added', 'fields': ['bytes', 'sha256', 'type']},
            {'path': 'z', 'classification': 'removed', 'fields': ['target', 'type']}])
        for value in ('PRIVATE_TARGET', 'PRIVATE_HASH', '123'):
            self.assertNotIn(value, raw)

    def test_changed_fields_not_metadata_values(self):
        before = {'x': {'type': 'file', 'mode': 384, 'bytes': 123, 'sha256': 'OLD_HASH'}}
        after = {'x': {'type': 'file', 'mode': 384, 'bytes': 456, 'sha256': 'NEW_HASH'}}
        self.assertEqual(self.diagnostic(before, after)['differences'],
                         [{'path': 'x', 'classification': 'changed', 'fields': ['bytes', 'sha256']}])
        before['x']['target'] = None
        self.assertIn('target', self.diagnostic(before, after)['differences'][0]['fields'])

    def test_mode_only_root_and_empty_directory(self):
        before = {'': {'type': 'directory', 'mode': 448}, 'empty': {'type': 'directory', 'mode': 448}}
        after = {'': {'type': 'directory', 'mode': 493}}
        self.assertEqual(self.diagnostic(before, after)['differences'], [
            {'path': '.', 'classification': 'changed', 'fields': ['mode']},
            {'path': 'empty', 'classification': 'removed', 'fields': ['mode', 'type']}])

    def test_output_bounds_full_count_and_determinism(self):
        actual = {('%03d' % i) + '\u2603' * 250: {'type': 'directory', 'mode': 448} for i in reversed(range(30))}
        raw = ci.fixture_graph_difference({}, actual, 'tools')
        result = json.loads(raw)
        self.assertEqual(result['changed_path_count'], 30)
        self.assertEqual(len(result['differences']), 10)
        self.assertEqual([r['path'] for r in result['differences']], [p[:200] for p in sorted(actual)[:10]])
        self.assertTrue(all(len(r['path']) == 200 for r in result['differences']))
        self.assertLess(len(raw.encode()), 14000)
        self.assertEqual(raw, ci.fixture_graph_difference({}, dict(reversed(list(actual.items()))), 'tools'))

    def test_refusal_prefix_graph_kind_and_no_recapture(self):
        for kind in ('source', 'tools'):
            with self.subTest(kind=kind), fixture_world() as (base, checkout, root, binding):
                parent = checkout if kind == 'source' else checkout / 'node_modules'
                (parent / 'new-empty').mkdir(mode=0o700)
                with mock.patch.object(ci, 'fixture_graph', wraps=ci.fixture_graph) as capture:
                    with self.assertRaisesRegex(RuntimeError, '^fixture immutable graph changed ') as raised:
                        ci.fixture_validate(base, checkout)
                detail = json.loads(str(raised.exception).removeprefix('fixture immutable graph changed '))
                self.assertEqual(detail, {'kind': kind, 'changed_path_count': 1, 'differences': [
                    {'path': 'new-empty', 'classification': 'added', 'fields': ['mode', 'type']}]})
                self.assertEqual(capture.call_count, 1 if kind == 'source' else 2)



class Partition155Tests(unittest.TestCase):
    def setUp(self):
        self.env = mock.patch.dict(os.environ, {}, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.tracked = sorted([p for p in TRACKED if p != 'test/root00.test.ts'] + [ci.WRITER_TEST])
        self.identity = {'checkout': 'a' * 40, 'head': 'b' * 40, 'tree': 'c' * 40,
                         'repository': 'mikeddamico/the-desk', 'run_id': '123', 'run_attempt': '1', 'source_sha256': 'd' * 64}
        rest = ci.partition_files(self.tracked, 'rest')
        other = [p for p in rest if p not in ci.FIXTURE_CONNECTED_COUNTS and p not in ci.FROZEN_RENDER046_COUNTS]
        self.counts = {p: 3560 // len(other) + (i < 3560 % len(other)) for i, p in enumerate(other)}
        self.counts.update(ci.FIXTURE_CONNECTED_COUNTS)
        self.counts.update(ci.FROZEN_RENDER046_COUNTS)
        self.counts[ci.WRITER_TEST] = 4908
        self.proofs = {}
        for label in ('writer', 'rest'):
            selected = ci.partition_files(self.tracked, label)
            binding = {'schema': 'ci-partition/1', 'partition': label, 'identity': self.identity,
                       'selection': selected, 'counts': list(ci.PARTITION_COUNTS[label])}
            verdict = {'ok': True, 'partition': label, 'stage': 'all', 'facts': {'selected_files': selected,
                'file_results': {p: [{'tests': self.counts[p], 'failed': 0, 'skipped': 0, 'todo': 0}] for p in selected}}}
            self.proofs[label] = ci.build_partition_proof(binding, verdict)
        self.outcomes = {p: 'success' for p in ('writer', 'rest', 'container')}

    def joint(self, proofs=None, identity=None, outcomes=None):
        return ci.joint_problems(proofs if proofs is not None else self.proofs,
                                 identity if identity is not None else self.identity,
                                 self.tracked, outcomes if outcomes is not None else self.outcomes)

    def copy(self, value):
        return json.loads(json.dumps(value))

    def test_exact_pair_and_disjoint_union(self):
        self.assertEqual(self.joint(), [])
        self.assertEqual(set(self.proofs['writer']['files']) & set(self.proofs['rest']['files']), set())
        self.assertEqual(sum(sum(p['files'].values()) for p in self.proofs.values()), 8688)
        self.assertEqual(len(ci.partition_files(self.tracked, 'all')), 80)

    def test_missing_unknown_and_legacy_labels(self):
        self.assertEqual(ci.partition_label(), 'all')
        with self.assertRaises(RuntimeError): ci.partition_label(required=True)
        for label in ('', 'all', 'WRITER', 'writer,rest', 'other'):
            with mock.patch.dict(os.environ, {'DESK_CI_PARTITION': label}):
                with self.assertRaises(RuntimeError): ci.partition_label(required=True)
        for label in ('writer', 'rest'):
            with mock.patch.dict(os.environ, {'DESK_CI_PARTITION': label}):
                self.assertEqual(ci.partition_label(required=True), label)

    def test_inventory_drift_and_duplicate(self):
        for tracked in ([p for p in self.tracked if p != ci.HARNESS_TEST], self.tracked + ['test/new.test.ts'],
                        self.tracked + [ci.WRITER_TEST], [p for p in self.tracked if p != ci.WRITER_TEST]):
            with self.assertRaises(RuntimeError): ci.partition_files(tracked, 'rest')

    def test_missing_swapped_reused_proofs(self):
        for proofs in ({}, {'writer': self.proofs['writer']},
                       {'writer': self.proofs['rest'], 'rest': self.proofs['writer']},
                       {'writer': self.proofs['writer'], 'rest': self.proofs['writer']}):
            self.assertTrue(self.joint(proofs=proofs))

    def test_failed_skipped_cancelled_missing_dependencies(self):
        for label in self.outcomes:
            for state in ('failure', 'skipped', 'cancelled', None):
                outcomes = dict(self.outcomes, **{label: state})
                self.assertTrue(self.joint(outcomes=outcomes))
        self.assertTrue(self.joint(outcomes={'writer': 'success', 'rest': 'success'}))

    def test_every_identity_field_and_current_context(self):
        for key in self.identity:
            bad = self.copy(self.proofs)
            bad['rest']['identity'][key] = 'changed'
            self.assertTrue(self.joint(proofs=bad))
            self.assertTrue(self.joint(identity=dict(self.identity, **{key: 'changed'})))

    def test_schema_assertions_and_unknown_fields(self):
        for label in self.proofs:
            for key, value in [('schema', 'legacy-all'), ('partition', 'all'), ('source_verified', False),
                               ('evidence_complete', 1), ('extra', True), ('identity', {})]:
                bad = self.copy(self.proofs); bad[label][key] = value
                self.assertTrue(self.joint(proofs=bad))

    def test_missing_extra_overlapping_and_count_drift(self):
        for label in self.proofs:
            path = next(iter(self.proofs[label]['files']))
            for value in (0, -1, True, '1', self.proofs[label]['files'][path] + 1):
                bad = self.copy(self.proofs); bad[label]['files'][path] = value
                self.assertTrue(self.joint(proofs=bad))
            bad = self.copy(self.proofs); del bad[label]['files'][path]
            self.assertTrue(self.joint(proofs=bad))
            bad = self.copy(self.proofs); bad[label]['files']['test/unexpected.test.ts'] = 1
            self.assertTrue(self.joint(proofs=bad))
        bad = self.copy(self.proofs); bad['rest']['files'][ci.WRITER_TEST] = 4908
        self.assertTrue(self.joint(proofs=bad))
        bad = self.copy(self.proofs); paths = list(ci.FIXTURE_CONNECTED_COUNTS)
        bad['rest']['files'][paths[0]] -= 1; bad['rest']['files'][paths[1]] += 1
        self.assertTrue(self.joint(proofs=bad))
        for frozen in ('test/unit/frozen-render046.test.ts', 'test/unit/frozen-render046-responses.test.ts'):
            for delta in (-1, 1):
                with self.subTest(frozen=frozen, delta=delta):
                    bad = self.copy(self.proofs)
                    other = next(p for p in bad['rest']['files'] if p not in ci.FIXTURE_CONNECTED_COUNTS
                                 and p not in ci.FROZEN_RENDER046_COUNTS)
                    bad['rest']['files'][frozen] += delta; bad['rest']['files'][other] -= delta
                    self.assertIn('rest frozen-render046 coverage mismatch', self.joint(proofs=bad))

    def test_proof_parser_closed_bounded_unique(self):
        raw = ci.fixture_bytes(self.proofs['writer']).decode().rstrip('\n')
        self.assertEqual(ci.parse_partition_proof(raw), self.proofs['writer'])
        for text in (None, '', raw + '\n', raw + '\r', '[' + raw + ']', '{"a":1,"a":2}',
                     '{"a":NaN}', 'x' * 65537, '{'):
            with self.assertRaises((RuntimeError, ValueError)): ci.parse_partition_proof(text)

    def test_file_summary_partition_rejections(self):
        for label in ('writer', 'rest'):
            selected = ci.partition_files(self.tracked, label)
            counts = {p: self.counts[p] for p in selected}
            with mock.patch.dict(os.environ, {'DESK_CI_PARTITION': label}):
                errors, facts = [], {}
                ci.check_all_files(file_lines(counts), self.tracked, errors, facts)
                self.assertEqual(errors, [])
                for text in (file_lines(counts) + file_lines({selected[0]: counts[selected[0]]}),
                             file_lines(counts) + ' ✓ test/unexpected.test.ts (1 tests) 1ms\n',
                             file_lines(counts).replace(' tests)', ' tests | 1 skipped)', 1),
                             file_lines(counts).replace(' tests)', ' tests | 1 failed)', 1),
                             file_lines(counts).replace(' tests)', ' tests | 1 todo)', 1),
                             file_lines(counts).split('\n', 1)[1]):
                    errors = []; ci.check_all_files(text, self.tracked, errors, {})
                    self.assertTrue(errors)

    def test_writer_empty_journal(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp); root = base / 'root'; root.mkdir(mode=0o700)
            (base / 'evidence').mkdir(mode=0o700)
            for name in ('expectations', 'receipts'): (root / name).mkdir(mode=0o700)
            ci.fixture_empty_writer(base, root)
            for path in (root / 'expectations/x', root / 'receipts/x', base / 'evidence/fixture105-suite.json'):
                path.write_text('{}')
                with self.assertRaises(RuntimeError): ci.fixture_empty_writer(base, root)
                path.unlink()

    def test_partition_binding_changes(self):
        members = {p: [1, 'a' * 64] for p in self.tracked}
        identity = {'checkout_head': 'a' * 40, 'pr_head_sha': 'b' * 40, 'checkout_tree': 'c' * 40,
                    'repository': 'mikeddamico/the-desk', 'run_id': '123', 'run_attempt': '1', 'errors': []}
        binding = ci.partition_binding('writer', identity, members)
        env = {'DESK_CI_PARTITION': 'writer', 'GITHUB_SHA': 'a' * 40, 'GITHUB_RUN_ID': '123',
               'GITHUB_RUN_ATTEMPT': '1', 'GITHUB_REPOSITORY': 'mikeddamico/the-desk'}
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(os.environ, env), \
             mock.patch.object(ci, 'ci_dir', return_value=Path(tmp)), \
             mock.patch.object(ci, 'load_pre', return_value={'members': members}):
            ev = Path(tmp) / 'evidence'; ev.mkdir()
            write_json(ev / 'identity.json', identity); write_json(ev / 'partition.json', binding)
            self.assertEqual(ci.check_partition_binding(), binding)
            for key in ('GITHUB_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_REPOSITORY', 'DESK_CI_PARTITION'):
                with mock.patch.dict(os.environ, {key: 'changed'}):
                    with self.assertRaises(RuntimeError): ci.check_partition_binding()
            changed = self.copy(binding); changed['selection'] = []
            write_json(ev / 'partition.json', changed)
            with self.assertRaises(RuntimeError): ci.check_partition_binding()

    def test_native_p33_modes_and_guard_failures(self):
        for label in ('writer', 'rest'):
            with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(os.environ, {'DESK_CI_PARTITION': label}):
                stage, runtime = Path(tmp) / 'stage', Path(tmp) / 'runtime'
                attempt = make_stage(stage, runtime, 'attempt-test', 'all', [])
                selected = ci.partition_files(self.tracked, label)
                files, tests, _ = ci.PARTITION_COUNTS[label]
                write(stage / 'stdout', file_lines({p: self.counts[p] for p in selected}) +
                      ' Test Files  %d passed (%d)\n      Tests  %d passed (%d)\n' % (files, files, tests, tests))
                if label == 'writer':
                    import shutil
                    shutil.rmtree(attempt / NONCES['all'][0])
                self.assertEqual(ci.evaluate_stage('all', stage, runtime, self.tracked)[0], [])
                write(stage / 'exit', '124\n')
                self.assertTrue(ci.evaluate_stage('all', stage, runtime, self.tracked)[0])
                write(stage / 'exit', '0\n')
                edit_json(attempt / 'guard-result.json', lambda r: r.update(noChildren=False))
                self.assertTrue(ci.evaluate_stage('all', stage, runtime, self.tracked)[0])
                edit_json(attempt / 'guard-result.json', lambda r: r.update(noChildren=True))
                if label == 'writer': (attempt / ('d' * 48)).mkdir()
                else:
                    import shutil
                    shutil.rmtree(attempt / NONCES['all'][0])
                self.assertTrue(ci.evaluate_stage('all', stage, runtime, self.tracked)[0])

    def test_failed_gate_never_emits_proof(self):
        for outcome in ci.FINAL_OUTCOMES:
            outcomes = {name: 'success' for name in ci.FINAL_OUTCOMES}; outcomes[outcome] = 'failure'
            finals = {scope: {'all_stages_ok': True, 'evidence_status': 'complete'} for scope in ci.SCOPES}
            self.assertTrue(ci.final_verdict(finals, outcomes))

    @contextlib.contextmanager
    def final_world(self, label):
        members = {p: [1, 'a' * 64] for p in self.tracked}
        identity = {'checkout_head': 'a' * 40, 'pr_head_sha': 'b' * 40, 'checkout_tree': 'c' * 40,
                    'repository': 'mikeddamico/the-desk', 'run_id': '123', 'run_attempt': '1', 'errors': []}
        binding = ci.partition_binding(label, identity, members)
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp); ev = base / 'evidence'; ev.mkdir()
            output = base / 'github-output'
            env = {'DESK_CI_PARTITION': label, 'GITHUB_SHA': 'a' * 40, 'GITHUB_RUN_ID': '123',
                   'GITHUB_RUN_ATTEMPT': '1', 'GITHUB_REPOSITORY': 'mikeddamico/the-desk',
                   'GITHUB_OUTPUT': str(output), **OK_OUTCOMES}
            write_json(ev / 'identity.json', identity); write_json(ev / 'snapshot-pre.json', {'members': members})
            write_json(ev / 'bind-pre.json', {'ok': True}); write_json(ev / 'partition.json', binding)
            security = base / 'security-report'; security.mkdir(mode=0o700)
            security_bytes = ci.fixture_bytes({'version': '2.1.0', 'runs': [{'tool': {'driver': {'name': 'gitleaks'}}, 'results': []}]})
            (security / 'results.sarif').write_bytes(security_bytes)
            ci.fixture_write(security / 'manifest.json', {'schema': 'ci-security-report/1', 'binding': binding,
                'outcome': 'success', 'findings': 0, 'bytes': len(security_bytes), 'sha256': ci.fixture_hash(security_bytes)})
            selected = binding['selection']
            write_json(ev / 'verdict-all.json', {'ok': True, 'stage': 'all', 'partition': label, 'facts': {
                'selected_files': selected, 'file_results': {p: [{'tests': self.counts[p], 'failed': 0, 'skipped': 0, 'todo': 0}] for p in selected}}})
            for scope in ci.SCOPES:
                (base / ('upload-' + scope)).mkdir(mode=0o700)
                write_json(base / ('upload-' + scope) / 'final.json', {'scope': scope, 'all_stages_ok': True,
                    'evidence_status': 'complete', 'partition': label, 'commit': 'a' * 40, 'run_id': '123', 'run_attempt': '1'})
            with mock.patch.dict(os.environ, env), mock.patch.object(ci, 'ci_dir', return_value=base), \
                 mock.patch.object(ci, 'proof_identity_now', return_value=(identity, members)), \
                 contextlib.redirect_stdout(io.StringIO()):
                yield base, output, identity, members

    def test_final_emits_only_successful_canonical_proof(self):
        for label in ('writer', 'rest'):
            with self.final_world(label) as (base, output, identity, members):
                self.assertEqual(ci.cmd_final(), 0)
                raw = output.read_text()
                self.assertEqual(raw.count('\n'), 1)
                self.assertTrue(raw.startswith('proof='))
                proof = ci.parse_partition_proof(raw[6:-1])
                self.assertEqual(proof['partition'], label)
                self.assertEqual(proof['identity'], ci.partition_identity(identity, members))
                self.assertEqual(proof['files'], {p: self.counts[p] for p in ci.partition_files(self.tracked, label)})

    def test_final_failures_emit_no_output(self):
        for label in ('writer', 'rest'):
            for outcome in ci.FINAL_OUTCOMES:
                with self.final_world(label) as (base, output, identity, members), mock.patch.dict(os.environ, {outcome: 'failure'}):
                    self.assertEqual(ci.cmd_final(), 1); self.assertFalse(output.exists())
            for key, value in [('partition', 'all'), ('commit', 'e' * 40), ('run_id', '124'), ('run_attempt', '2'), ('evidence_status', 'partial/censored')]:
                with self.final_world(label) as (base, output, identity, members):
                    edit_json(base / 'upload-full/final.json', lambda r: r.update({key: value}))
                    self.assertEqual(ci.cmd_final(), 1); self.assertFalse(output.exists())
            with self.final_world(label) as (base, output, identity, members):
                changed = dict(members); changed[next(iter(changed))] = [2, 'f' * 64]
                with mock.patch.object(ci, 'proof_identity_now', return_value=(identity, changed)):
                    self.assertEqual(ci.cmd_final(), 1); self.assertFalse(output.exists())

    def test_joint_command_boundary(self):
        members = {p: [1, 'a' * 64] for p in self.tracked}
        identity = {'checkout_head': 'a' * 40, 'pr_head_sha': 'b' * 40, 'checkout_tree': 'c' * 40,
                    'repository': 'mikeddamico/the-desk', 'run_id': '123', 'run_attempt': '1'}
        proofs = self.copy(self.proofs)
        for proof in proofs.values(): proof['identity'] = ci.partition_identity(identity, members)
        env = {label.upper() + '_PROOF': ci.fixture_bytes(proof).decode().rstrip('\n') for label, proof in proofs.items()}
        env.update({label.upper() + '_OUTCOME': value for label, value in self.outcomes.items()})
        with mock.patch.dict(os.environ, env), mock.patch.object(ci, 'proof_identity_now', return_value=(identity, members)), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(ci.cmd_joint(), 0)
            for key, value in [('WRITER_PROOF', ''), ('REST_PROOF', '{}'), ('REST_OUTCOME', 'cancelled')]:
                with mock.patch.dict(os.environ, {key: value}): self.assertEqual(ci.cmd_joint(), 1)
            with mock.patch.object(ci, 'proof_identity_now', return_value=(dict(identity, checkout_head='e' * 40), members)):
                self.assertEqual(ci.cmd_joint(), 1)

    def test_parser_identity_schema_and_bounds(self):
        original = self.proofs['writer']
        changes = [('checkout', True), ('tree', 'g' * 40), ('head', ''), ('source_sha256', 'e' * 63),
                   ('repository', 'a' * 101 + '/b'), ('run_id', '0'), ('run_attempt', '١'), ('extra', 'x')]
        for key, value in changes:
            proof = self.copy(original); proof['identity'][key] = value
            with self.assertRaises(RuntimeError): ci.parse_partition_proof(ci.fixture_bytes(proof).decode().rstrip('\n'))
        for counts in ({'test/' + 'a' * 513 + '.test.ts': 4908}, {'test/../x.test.ts': 4908},
                       {'test/x%d.test.ts' % n: 1 for n in range(81)}):
            proof = self.copy(original); proof['files'] = counts
            with self.assertRaises(RuntimeError): ci.parse_partition_proof(ci.fixture_bytes(proof).decode().rstrip('\n'))
        with self.assertRaises(RuntimeError): ci.parse_partition_proof(json.dumps(original))

    def test_predecessor_and_controls_partition_binding(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(os.environ, {'DESK_CI_PARTITION': 'writer',
                'GITHUB_SHA': 'a' * 40, 'GITHUB_RUN_ID': '123', 'GITHUB_RUN_ATTEMPT': '1'}):
            path = Path(tmp) / 'verdict.json'
            write_json(path, {'stage': 'focused', 'partition': 'writer', 'ok': True})
            self.assertTrue(ci.stage_verdict_ok(path, 'focused'))
            for key, value in [('partition', 'rest'), ('partition', 'all'), ('stage', 'all')]:
                write_json(path, {'stage': 'focused', 'partition': 'writer', 'ok': True, key: value})
                self.assertFalse(ci.stage_verdict_ok(path, 'focused'))
            final = {'scope': 'controls', 'all_stages_ok': True, 'evidence_status': 'complete',
                     'collection_problems': {'missing': [], 'censored': [], 'errors': []},
                     'verdicts': {'prerequisite': True, 'focused': True}, 'not_attempted': [],
                     'partition': 'writer', 'commit': 'a' * 40, 'run_id': '123', 'run_attempt': '1'}
            write_json(Path(tmp) / 'final.json', final)
            self.assertEqual(ci.controls_problems(tmp), [])
            for key, value in [('partition', 'rest'), ('commit', 'e' * 40), ('run_id', '124'), ('run_attempt', '2')]:
                write_json(Path(tmp) / 'final.json', dict(final, **{key: value}))
                self.assertTrue(ci.controls_problems(tmp))

    def test_fixture_capture_and_collect_partition_paths(self):
        for label in ('writer', 'rest'):
            with fixture_world() as (base, checkout, root, binding), mock.patch.dict(os.environ, {'DESK_CI_PARTITION': label}), \
                 mock.patch.object(ci, 'ROOT', checkout), mock.patch.object(ci, 'tracked_files', return_value=self.tracked):
                journal = base / 'evidence/fixture105-suite.json'
                journal.unlink()
                ci.fixture_write(base / 'evidence/fixture105-before-all.json', {'binding': binding})
                record = ci.fixture_capture_stage(base, 'all', {}, False)
                self.assertEqual(record['complete'], label == 'writer', record)
                if label == 'writer': self.assertEqual(record['connected_population'], 'empty')
                upload = base / 'upload'; upload.mkdir(mode=0o700)
                keep = ci.Retention(upload)
                successful = {'all': {'facts': {'fixture105': record}}} if label == 'writer' else {}
                ci.fixture_collect(base, keep, 'full', successful)
                if label == 'writer':
                    self.assertFalse(any(keep.problems.values()), keep.problems)
                    self.assertFalse((upload / 'fixture105/suite.json').exists())
                else:
                    self.assertIn('fixture105/suite.json', keep.problems['missing'])
        for mutation in ('journal', 'expectations', 'receipts'):
            with fixture_world() as (base, checkout, root, binding), mock.patch.dict(os.environ, {'DESK_CI_PARTITION': 'writer'}), \
                 mock.patch.object(ci, 'ROOT', checkout), mock.patch.object(ci, 'tracked_files', return_value=self.tracked):
                if mutation != 'journal':
                    (base / 'evidence/fixture105-suite.json').unlink()
                    ci.fixture_write(root / mutation / ('a' * 64 + '.intent.json' if mutation == 'expectations' else 'x'), {})
                record = ci.fixture_capture_stage(base, 'all', {}, False)
                self.assertFalse(record['complete'])
        with fixture_world() as (base, checkout, root, binding), mock.patch.dict(os.environ, {'DESK_CI_PARTITION': 'rest'}), \
             mock.patch.object(ci, 'ROOT', checkout), mock.patch.object(ci, 'tracked_files', return_value=self.tracked):
            record = ci.fixture_capture_stage(base, 'all', {}, False)
            self.assertFalse(record['complete'])  # Existing intentionally incomplete 33-case journal.


    def test_workflow_closed_jobs_and_credentials(self):
        workflow = (ci.ROOT / '.github/workflows/ci.yml').read_text()
        self.assertEqual(workflow.count('  verify-writer:\n'), 1)
        self.assertEqual(workflow.count('  verify-rest:\n'), 1)
        self.assertIn('needs: [verify-writer, verify-rest, container]', workflow)
        for label in ('writer', 'rest'):
            self.assertIn('DESK_CI_PARTITION: ' + label, workflow)
            self.assertIn('needs.verify-' + label + '.outputs.proof', workflow)
        self.assertNotIn('matrix:', workflow)
        wrapper = (ci.ROOT / 'tools/ci-validation/run-stage.sh').read_text()
        self.assertIn('all) CEILING=7200', wrapper)
        self.assertIn('if [ "$PROFILE" = rest ]; then DB_FEED=$TEST_DATABASE_URL; else DB_FEED=""; fi', wrapper)
        self.assertIn('/bin/bash -c "$CHILD" _ "$PROFILE" "$CEILING"', wrapper)
        self.assertEqual(workflow.count('id: gitleaks'), 2)
        self.assertEqual(workflow.count('id: audit'), 2)


class P33NativeLoaderTests(unittest.TestCase):
    """The fixed child uses pinned Node native stripping, not a preload loader."""

    def test_p33_child_uses_native_stripping_without_loader(self):
        guard = (ci.ROOT / 'test/support/p33-parity-supervisor.py').read_text()
        start = guard.index("    command = ([args.node,")
        end = guard.index("    selector = selectors.DefaultSelector()", start)
        self.assertEqual(guard[start:end],
                         "    command = ([args.node, str(ROOT/'test/support/p33-parity-runner.ts'), '--p33-child']\n"
                         "               if args.mode == 'p33' else [sys.executable, str(SELF), 'control', args.mode])\n")


class SecurityReport156Tests(unittest.TestCase):
    @contextlib.contextmanager
    def world(self, results=None):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp) / 'ci'; root = Path(tmp) / 'checkout'
            base.mkdir(mode=0o700); root.mkdir(mode=0o700)
            (root / 'owned.ts').write_text('// source\n')
            pre = ci.take_snapshot(['owned.ts'], root=root, allow_dist=False)
            binding = {'partition': 'writer', 'identity': {'commit': 'a' * 40}}
            data = ci.fixture_bytes({'version': '2.1.0', 'runs': [{'tool': {'driver': {'name': 'gitleaks'}}, 'results': results or []}]})
            (root / 'results.sarif').write_bytes(data)
            yield base, root, binding, pre, data

    def test_report_moves_without_source_exemption(self):
        with self.world() as (base, root, binding, pre, data):
            self.assertEqual(ci.take_snapshot(['owned.ts'], root=root, allow_dist=False)['extra'], ['results.sarif'])
            record = ci.retain_security_report(base, root, binding, pre, 'success')
            self.assertEqual(record['sha256'], ci.fixture_hash(data))
            self.assertFalse((root / 'results.sarif').exists())
            self.assertEqual((base / 'security-report/results.sarif').read_bytes(), data)
            self.assertEqual(ci.snapshot_errors(ci.take_snapshot(['owned.ts'], root=root, allow_dist=False), pre=pre), [])
            ci.verify_security_report(base, binding)
            (root / 'unexpected.txt').write_text('x')
            self.assertTrue(ci.snapshot_errors(ci.take_snapshot(['owned.ts'], root=root, allow_dist=False), pre=pre))

    def test_missing_tracked_linked_and_malformed_report_refuse(self):
        for mutation in ('missing', 'tracked', 'symlink', 'hardlink', 'malformed', 'oversize', 'unknown-outcome'):
            with self.subTest(mutation=mutation), self.world() as (base, root, binding, pre, data):
                path = root / 'results.sarif'; outcome = 'success'
                if mutation == 'missing': path.unlink()
                elif mutation == 'tracked': pre['members']['results.sarif'] = [len(data), ci.fixture_hash(data)]
                elif mutation == 'symlink':
                    path.unlink(); path.symlink_to(root / 'owned.ts')
                elif mutation == 'hardlink': os.link(path, root / 'extra-link')
                elif mutation == 'malformed': path.write_text('{}')
                elif mutation == 'oversize': path.write_bytes(b'x' * (ci.COPY_LIMIT + 1))
                else: outcome = 'skipped'
                with self.assertRaises((RuntimeError, OSError, ValueError)):
                    ci.retain_security_report(base, root, binding, pre, outcome)
                self.assertFalse((base / 'security-report').exists())

    def test_previous_capture_not_overwritten(self):
        with self.world() as (base, root, binding, pre, data):
            destination = base / 'security-report'; destination.mkdir(mode=0o700)
            sentinel = destination / 'results.sarif'; sentinel.write_text('preserve')
            with self.assertRaises(FileExistsError): ci.retain_security_report(base, root, binding, pre, 'success')
            self.assertEqual(sentinel.read_text(), 'preserve')
            self.assertEqual((root / 'results.sarif').read_bytes(), data)

    def test_failed_scan_evidence_is_retained_but_never_accepted(self):
        with self.world([{'ruleId': 'synthetic-not-a-secret'}]) as (base, root, binding, pre, data):
            ci.retain_security_report(base, root, binding, pre, 'failure')
            self.assertEqual((base / 'security-report/results.sarif').read_bytes(), data)
            with self.assertRaises(RuntimeError): ci.verify_security_report(base, binding)
        with self.world([{'ruleId': 'synthetic-not-a-secret'}]) as (base, root, binding, pre, data):
            ci.retain_security_report(base, root, binding, pre, 'success')
            with self.assertRaises(RuntimeError): ci.verify_security_report(base, binding)

    def test_changed_report_binding_manifest_population_refuse(self):
        for mutation in ('bytes', 'binding', 'manifest', 'extra'):
            with self.world() as (base, root, binding, pre, data):
                ci.retain_security_report(base, root, binding, pre, 'success')
                if mutation == 'bytes': (base / 'security-report/results.sarif').write_bytes(data + b' ')
                elif mutation == 'binding': binding = {'partition': 'rest'}
                elif mutation == 'manifest': edit_json(base / 'security-report/manifest.json', lambda r: r.update(outcome='failure'))
                else: (base / 'security-report/extra').write_text('x')
                with self.assertRaises(RuntimeError): ci.verify_security_report(base, binding)

    def test_report_upload_required_and_unique(self):
        workflow = (ci.ROOT / '.github/workflows/ci.yml').read_text()
        self.assertEqual(workflow.count('GITLEAKS_ENABLE_UPLOAD_ARTIFACT: "false"'), 2)
        self.assertEqual(workflow.count('tools/ci-validation/ci.py retain-security'), 2)
        self.assertEqual(workflow.count('SECURITY_UPLOAD_OUTCOME: ${{ steps.upload-security.outcome }}'), 2)
        for label in ('writer', 'rest'):
            self.assertIn('name: ci-security-' + label + '-${{ github.run_id }}-${{ github.run_attempt }}', workflow)
        finals = {scope: {'all_stages_ok': True, 'evidence_status': 'complete'} for scope in ci.SCOPES}
        for outcome in ('failure', 'skipped', 'cancelled', None):
            self.assertTrue(ci.final_verdict(finals, {**OK_OUTCOMES, 'SECURITY_UPLOAD_OUTCOME': outcome}))


if __name__ == '__main__':
    unittest.main()
