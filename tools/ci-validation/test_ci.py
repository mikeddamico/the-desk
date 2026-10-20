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

Pinned fail-closed rules: aggregate 66 files / 8,242 tests and all 23 integration files, each selected file exactly once
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
    + ['test/unit/unit%02d.test.ts' % i for i in range(8)] + [ci.HARNESS_TEST]
    + ['test/integration/int%02d.test.ts' % i for i in range(23)])
TESTS, SELECTED = ci.expected_all_files(TRACKED)
INTEGRATION = [n for n in SELECTED if n.startswith('test/integration/')]
URL = 'postgresql://postgres:postgres@localhost:5432/the_desk_test'
NONCES = {'focused': ('a' * 48, 'b' * 48), 'all': ('c' * 48,)}
ATTEMPTS = {'prerequisite': 'attempt-p', 'focused': 'attempt-f', 'all': 'attempt-3'}
PER_FILE = {n: 8242 // 66 + (1 if i < 8242 % 66 else 0) for i, n in enumerate(SELECTED)}


def file_lines(counts=None, extra=''):
    counts = counts or PER_FILE
    return ''.join(' ✓ %s (%d tests) 12ms\n' % (n, c) for n, c in counts.items()) + extra


SUMMARY = {
    'focused': ' Test Files  1 passed (1)\n      Tests  2 passed (2)\n',
    'all': ' Test Files  66 passed (66)\n      Tests  8242 passed (8242)\n',
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
    with mock.patch.dict(os.environ, {'RUNNER_TEMP': tmp, **(env or {})}), contextlib.redirect_stdout(io.StringIO()):
        ci.cmd_collect(scope)
    return json.loads((Path(tmp) / 'ci' / ('upload-' + scope) / 'final.json').read_text())


OK_OUTCOMES = {'CONTROLS_UPLOAD_OUTCOME': 'success', 'UPLOAD_OUTCOME': 'success', 'AUDIT_OUTCOME': 'success',
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
        self.assertEqual((len(TESTS), len(SELECTED), len(INTEGRATION)), (67, 66, 23))
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
        self.assertTrue(any('sum to 8241' in e for e in self.check(file_lines(counts))[0]))
        dup = file_lines() + ' ✓ %s (1 tests) 1ms\n' % SELECTED[0]
        self.assertTrue(any('2 result lines' in e for e in self.check(dup)[0]))

    def test_unexpected_and_harness_result_lines(self):
        for name in ('test/other.test.ts', ci.HARNESS_TEST):
            with self.subTest(name=name):
                out = file_lines() + ' ✓ %s (2 tests) 1ms\n' % name
                self.assertTrue(any('outside the selection' in e for e in self.check(out)[0]))

    def test_changed_tracked_inventory_is_hold_not_a_relaxed_count(self):
        grown = sorted(TRACKED + ['test/unit/extra.test.ts'])
        self.assertTrue(any('inventory is 68' in e for e in self.check(file_lines(), grown)[0]))
        moved = [n for n in TRACKED if n != INTEGRATION[0]] + ['test/unit/moved.test.ts']
        self.assertTrue(any('integration file count 22' in e for e in self.check(file_lines(), sorted(moved))[0]))
        shrunk = [n for n in TRACKED if n != ci.HARNESS_TEST]
        self.assertTrue(self.check(file_lines(), shrunk)[0])

    def test_summary_count_mismatch_with_correct_files(self):
        def change(stage_dir, attempt):
            write(stage_dir / 'stdout', file_lines() + ' Test Files  66 passed (66)\n      Tests  8241 passed (8241)\n')
        self.assertTrue(any('Tests counts' in e for e in evaluate('all', change)))

    def test_skipped_summary_with_exit_zero_is_not_accepted(self):
        def change(stage_dir, attempt):
            write(stage_dir / 'stdout', file_lines() + ' Test Files  66 passed (66)\n      Tests  8156 passed | 86 skipped (8242)\n')
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
                mock.patch.object(ci, 'tracked_files', lambda: list(TRACKED)), contextlib.redirect_stdout(io.StringIO()):
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


if __name__ == '__main__':
    unittest.main()
