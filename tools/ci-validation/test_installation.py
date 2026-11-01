#!/usr/bin/python3
"""Finite synthetic /2 data controls; no ordinary install or producer authority.

Proposed, not executed. 24 methods; stdlib and source definitions only. Genuine
BUILD/EVAL provenance and Node/Python admission remain separate physical gates.
Private AF_UNIX models include real normal-path binds and a supervisor prelaunch
cut with signal/preflight/socket/child seams blocked; no supervisor child is run.
The receipt-control cut runs two finite Bash children containing only builtins;
it does not execute the wrapper, its context/mask setup or a follow-on child.
"""
import copy
import json
import os
import stat
from pathlib import Path
import tempfile
import sys
import unittest
from unittest import mock

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import ci
from test_ci import fixture_world
import installation_model
import types
import subprocess
import shutil
import runpy
import socket
import contextlib


class EvaluationProvenance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scope=fixture_world()
        cls.base,cls.checkout,cls.root,cls.binding=cls.scope.__enter__()
        cls.owner=ci.installation_owner()
        cls.raw=cls.owner.load_records(cls.root/'bindings')
        cls.source=cls.owner.graph(cls.checkout,'source')
        cls.tools=cls.owner.graph(cls.checkout/'node_modules','tools')
        cls.common=json.loads(cls.raw['PROVENANCE.json'])['source']
        cls.policies=cls.owner.policy(ci)

    @classmethod
    def tearDownClass(cls):
        cls.scope.__exit__(None,None,None)

    def validate(self, raw=None, common=None):
        return self.owner.validate_metadata(self.raw if raw is None else raw,self.source,self.tools,
            self.common if common is None else common,self.policies,ledger_base=self.base)

    def altered(self, name, mutation, *, repin=False):
        raw=dict(self.raw);value=json.loads(raw[name]);mutation(value)
        raw[name]=self.owner.canonical(value)
        return installation_model.repin(raw) if repin else raw

    def semantic(self,name,mutation,code):
        with self.assertRaisesRegex(RuntimeError,'^installation_'+code+'$'):
            self.validate(self.altered(name,mutation,repin=True))

    def refuses(self, raw=None, common=None):
        with self.assertRaises((RuntimeError,ValueError,TypeError,KeyError)):
            self.validate(raw,common)

    @contextlib.contextmanager
    def traversal_world(self):
        """Explicit local model; no real admission capability or child launch."""
        with tempfile.TemporaryDirectory() as name:
            world=Path(name);checkout=world/'checkout';base=world/'role/ci'
            for path in (checkout,checkout/'node_modules',world/'role',base,base/'tmp',base/'evidence',base/'evidence/producer',base/'evidence/producer/metadata'):
                path.mkdir(mode=0o700)
            self.owner.write(base/'evidence/producer/metadata/EVAL-INSTALL.json',self.owner.canonical({'source':self.common}))
            binding={'root':'explicit-inert-model','root_sha256':'a'*64}
            def validate(*_):return binding,ci.fixture_temp(checkout,True)
            def bind(stage):
                self.assertEqual(stage,'focused')
                (checkout/'node_modules/.vite-temp').mkdir(mode=0o700)
                ci.fixture_write(base/'evidence/fixture105-loader-created.json',ci.fixture_temp(checkout,True))
                ci.fixture_write(base/'evidence/fixture105-before-focused.json',{'binding':binding})
                return 0
            ctx=types.SimpleNamespace(ROOT=checkout,partition_label=lambda *_:'rest',ci_dir=lambda:base,
                fixture_validate=validate,fixture_temp=ci.fixture_temp,cmd_fixture_binding=bind,
                check_ledger=ci.check_ledger,parse_summary=ci.parse_summary,parse_file_lines=ci.parse_file_lines,
                ANSI=ci.ANSI,FAILURE_LINE=ci.FAILURE_LINE,FATAL_TEXT=ci.FATAL_TEXT)
            with mock.patch.object(self.owner,'EVAL',checkout),mock.patch.object(self.owner,'POISON',[]), \
                 mock.patch.object(self.owner,'PENDING_OBJECTS',[]),mock.patch.object(self.owner,'LEASES',{}), \
                 mock.patch.object(self.owner,'SECONDARY',[]),mock.patch.object(self.owner,'CANCELLED',None):
                yield ctx,checkout,base

    def traversal_output(self):
        return (' ✓ test/unit/fixture105-traversal.test.ts (10 tests) 12ms\n'
                ' Test Files  1 passed (1)\n      Tests  10 passed (10)\n'
                'FIXTURE105_NODE_RELATIONS 12/12\n'), ('FIXTURE_TARGET_DIAGNOSTIC_SELFTEST {"schema":"fixture-target-selftest/2","groups":20,"passed":20}\n')

    def traversal_guard(self):
        return {'settled':True,'directReaped':True,'noChildren':True,'complete':True,'residual':[],
            'errors':[],'cleanupErrors':[],'reaped':[{'pid':424242,'raw':0,'exit':0}],
            'discoveryDetails':{},'fatal':None,'containedRejection':None}

    def traversal_capture(self, ctx, *, extra=False):
        """Harmless filesystem model of already-settled child evidence only."""
        stdout,stderr=self.traversal_output();runtime=self.owner.traversal_runtime(ctx)
        runtime.mkdir(mode=0o700);attempt=runtime/'attempt-aaaaaaaa';attempt.mkdir(mode=0o700)
        self.owner.write(runtime/'validation.lock',b'')
        server=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
        socket_parent=os.open(attempt,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
        try:server.bind('/proc/self/fd/'+str(socket_parent)+'/guard.sock')
        finally:
            server.close();os.close(socket_parent)
        guard=dict(self.traversal_guard(),namespace={'runtime':self.owner.observed_directory(runtime),'attempt':self.owner.observed_directory(attempt)})
        self.owner.write(attempt/'prerequisite.json',b'{}\n');self.owner.write(attempt/'guard-result.json',self.owner.canonical(guard))
        if extra:(runtime/'attempt-bbbbbbbb').mkdir(mode=0o700)
        slot=ctx.ci_dir()/'evidence/fixture105-traversal'
        self.owner.write(slot/'stdout',stdout.encode());self.owner.write(slot/'stderr',stderr.encode())
        process={'exit':0,'direct_reaped':True,'settlement':'complete','population':{'complete':True,'members':[],'children':[],'errors':[]},
            'cleanup_errors':[],'spawn_attempts':1,'streams':{name:{'eof':True,'complete':True,'truncated':False,'observed_bytes':len(raw),'retained_bytes':len(raw)}
                for name,raw in (('stdout',stdout.encode()),('stderr',stderr.encode()))}}
        self.owner.write(slot/'owner.json',self.owner.canonical({'process':process,'cleanup':[],'pending':False,'cancelled':None}))
        return process

    def test_01_complete_explicit_model(self):
        value=self.validate()
        self.assertEqual(len(value),30)
        self.assertEqual(ci.fixture_validate(self.base,self.checkout),(self.binding,{'absent':True}))

        stdout,stderr=self.traversal_output();guard=self.traversal_guard()
        self.owner.traversal_results(ci,stdout,stderr,guard)
        node='FIXTURE105_NODE_RELATIONS 12/12\n'
        for left,right,code in ((stdout.replace(node,''),stderr,'traversal_marker'),(stdout+node,stderr,'traversal_marker'),
            (stdout,'','traversal_marker'),(stdout,stderr+stderr,'traversal_marker'),
            (stdout.replace('10 passed (10)','9 passed (10)'),stderr,'traversal_ten_cases'),
            (stdout.replace('(10 tests)','(10 tests | 1 skipped)'),stderr,'traversal_one_file'),
            (stdout.replace('fixture105-traversal.test.ts','foreign.test.ts'),stderr,'traversal_one_file')):
            with self.subTest(code=code),self.assertRaisesRegex(RuntimeError,code):self.owner.traversal_results(ci,left,right,guard)
        for field,value in (('settled',False),('complete',False),('directReaped',False),('residual',[1]),('fatal','cut')):
            with self.subTest(guard=field),self.assertRaisesRegex(RuntimeError,'traversal_guard_settled'):
                self.owner.traversal_results(ci,stdout,stderr,dict(guard,**{field:value}))
        with self.traversal_world() as (ctx,checkout,base),mock.patch.object(self.owner,'outer',return_value={}), \
             mock.patch.object(self.owner,'owned_capture',side_effect=lambda *_:self.traversal_capture(ctx)) as captured:
            self.assertEqual(self.owner.run_traversal(ctx),0);self.assertEqual(captured.call_count,1)
            result=json.loads((base/'evidence/fixture105-traversal/result.json').read_bytes())
            self.assertTrue(result['successful_proof']);self.assertTrue(result['loader_removed']);self.assertFalse(result['native_executed'])
            self.assertFalse((checkout/'node_modules/.vite-temp').exists())
            self.assertTrue((base/'evidence/fixture105-before-focused.json').is_file())

    def test_02_preseal_is_not_a_sealed_capability(self):
        raw=dict(self.raw);raw.pop('ADOPTION.json');self.refuses(raw)

    def test_03_missing_and_extra_leaves(self):
        for name in self.raw:
            with self.subTest(missing=name):
                raw=dict(self.raw);raw.pop(name);self.refuses(raw)
        self.refuses(dict(self.raw,**{'EXTRA.json':b'{}\n'}))

    def test_04_noncanonical_and_duplicate_json(self):
        for name in ('PROVENANCE.json','BUILD-PROFILE.json','SOURCE-INVENTORY.json'):
            raw=dict(self.raw);raw[name]=b' '+raw[name];self.refuses(raw)
        with self.assertRaisesRegex(RuntimeError,'duplicate_key'):
            self.owner.parse(b'{"x":1,"x":2}\n')

    def test_05_type_sensitive_counts(self):
        self.assertFalse(self.owner.same(True,1))
        self.semantic('BUILD-INSTALL-INVOCATION.json',lambda v:v.update(exit=False),'invocation')
        with self.assertRaises(RuntimeError):self.owner.uint(True)

    def test_06_foreign_source_run_and_head(self):
        for key,value in (('repository','foreign/source'),('run_id','99'),('run_attempt','9'),('checkout','d'*40),('head','d'*40),('tree','d'*40),('source_sha256','d'*64)):
            common=dict(self.common);common[key]=value
            with self.subTest(key=key):self.refuses(common=common)

    def test_07_wrong_profile_or_role(self):
        for field,value in (('profile_id','desk-full-build/1'),('producer_id','foreign/1'),('platform',{'os':'darwin','arch':'arm64','libc':'none'})):
            self.refuses(self.altered('EVAL-PROFILE.json',lambda v:v.update({field:value})))

    def test_08_valid_but_foreign_profile_swap(self):
        raw=dict(self.raw);raw['EVAL-PROFILE.json']=raw['BUILD-PROFILE.json'];self.refuses(raw)

    def test_09_policy_swap(self):
        self.refuses(self.altered('PROVENANCE.json',lambda v:v.update(profile_policy_sha256='d'*64)))
        self.refuses(self.altered('QUALITY.json',lambda v:v.update(policy_sha256='d'*64)))

    def test_10_missing_and_failed_quality(self):
        self.refuses(self.altered('QUALITY.json',lambda v:v['gates'].pop()))
        self.refuses(self.altered('QUALITY.json',lambda v:v['gates'][0].update(exit=1)))

    def test_11_quality_reorder_or_wrong_command(self):
        self.refuses(self.altered('QUALITY.json',lambda v:v['gates'].reverse()))
        self.refuses(self.altered('QUALITY.json',lambda v:v['gates'][0].update(argv=['true'])))

    def test_12_pending_cancel_or_incomplete_settlement(self):
        for name in ('BUILD-INSTALL-SETTLEMENT.json','EVAL-INSTALL-SETTLEMENT.json','QUALITY-SETTLEMENT.json','TRANSFER-SETTLEMENT.json'):
            for key,value in (('owned_pending',['held']),('cancelled',True),('direct_reaped',False),('stdout_eof',False)):
                with self.subTest(name=name,key=key):self.semantic(name,lambda v:v.update({key:value}),'unsettled')

    def test_13_partial_and_corrupt_copy(self):
        for key,value in (('complete',False),('totalbytes',1),('files',2)):
            self.semantic('COPY-RESULT.json',lambda v:v.update({key:value}),'copy_identity' if key=='complete' else 'copy_counts')

    def test_14_transfer_wrong_root(self):
        self.refuses(self.altered('TRANSFER.json',lambda v:v['consumer_root'].update(path='/tmp/d')))

    def test_15_package_path_and_nested_mapping(self):
        self.assertEqual(self.owner.path_name('node_modules/@scope/pkg/node_modules/child',True),'node_modules/@scope/pkg/node_modules/child')
        for name in ('pkg','node_modules/../escape','node_modules//x','/node_modules/x','node_modules/x/../../y'):
            with self.assertRaises(RuntimeError):self.owner.path_name(name,True)
        self.refuses(self.altered('EVAL-PACKAGE-METADATA.json',lambda v:v['rows'][0].update(path='node_modules/node_modules/foreign')))

    def test_16_hidden_lock_graph_mismatch(self):
        self.refuses(self.altered('EVAL-HIDDEN-LOCK.json',lambda v:v.update(version='9.9.9')))

    def test_17_optional_absence_population(self):
        self.semantic('EVAL-OPTIONAL-ABSENCES.json',lambda v:v['rows'].pop(),'absence_population')
        self.semantic('BUILD-OPTIONAL-ABSENCES.json',lambda v:v['rows'].append(dict(v['rows'][0])),'absence_population')

    def test_18_wrong_physical_identity(self):
        self.semantic('EVAL-INSTALL.json',lambda v:v['modules'].update(ino=v['modules']['ino']+1),'physical_evaluation_identity')
        self.semantic('QUALITY.json',lambda v:v['build_root'].update(ino=v['build_root']['ino']+1),'quality_root_identity')
        self.semantic('TRANSFER.json',lambda v:v['consumer_root'].update(ino=v['consumer_root']['ino']+1),'transfer_root_identity')
        self.semantic('EVAL-INSTALL-INVOCATION.json',lambda v:v['argv'].append('--ignore-scripts=false'),'invocation_policy')

    def test_19_private_model_refused_at_real_admission(self):
        # Read the valid model partition, but restore production fixed-role admission.
        with mock.patch.dict(os.environ,{'RUNNER_TEMP':str(self.base.parent),'DESK_CI_PARTITION':'rest'}), \
             mock.patch.object(self.owner,'BUILD',Path('/tmp/d')),mock.patch.object(self.owner,'EVAL',Path('/tmp/e')), \
             mock.patch.object(ci,'ROOT',self.checkout):
            with mock.patch.object(self.owner,'graph',wraps=self.owner.graph) as graphs, \
                 mock.patch.object(self.owner,'quality_check',wraps=self.owner.quality_check) as quality:
                with self.assertRaisesRegex(RuntimeError,'^installation_sealed_partition$'):
                    self.owner.outer(ci,'E0')
                with self.assertRaisesRegex(RuntimeError,'^installation_traversal_role$'):
                    self.owner.run_traversal(ci)
                graphs.assert_not_called()
                quality.assert_not_called()

    def test_20_legacy_root_refused(self):
        marker=self.root/'ROOT.json';before=marker.read_bytes();changed=json.loads(before)
        external=self.base/'evidence/fixture105-binding.json';external_before=external.read_bytes()
        changed['schema']='fixture105-execution-root/1';modified=self.owner.canonical(changed)
        try:
            marker.write_bytes(modified)
            external.write_bytes(self.owner.canonical(dict(self.binding,root_sha256=self.owner.digest(modified))))
            with self.assertRaisesRegex(RuntimeError,'^fixture marker shape$'):ci.fixture_validate(self.base,self.checkout)
        finally:
            marker.write_bytes(before);external.write_bytes(external_before)

    def test_21_summary_role_and_foreign_dag(self):
        wire=json.loads((self.base/'evidence/partition.json').read_bytes())
        for key,value in (('job','verify-writer'),('origin','compiled-here'),('settled',False)):
            execution=copy.deepcopy(wire['execution']);execution['summary'][key]=value
            with self.assertRaises(RuntimeError):self.owner.validate_summary(ci,execution,wire['identity'],'rest')

        # A fully coherent different run/profile producer DAG must still fail
        # against this consumer's authenticated identity/policies, not stale pins.
        foreign=dict(self.raw);foreign_identity=dict(self.common,run_id='99')
        for name,raw in list(foreign.items()):
            value=json.loads(raw)
            if type(value) is dict and 'source' in value:value['source']=foreign_identity
            foreign[name]=self.owner.canonical(value)
        foreign=installation_model.repin(foreign)
        self.owner.validate_metadata(foreign,self.source,self.tools,foreign_identity,self.policies,ledger_base=self.base)
        with self.assertRaisesRegex(RuntimeError,'^installation_foreign_source$'):self.validate(foreign)
        # A different logically valid profile policy produces a coherent new L/Q
        # DAG; it is not admitted under this consumer's frozen policy expectations.
        other_p=copy.deepcopy(self.policies[0])
        manifest=json.loads((ci.ROOT/'package.json').read_bytes());manifest['description']='synthetic foreign reviewed-source fixture'
        foreign_manifest=(json.dumps(manifest,indent=2)+'\n').encode()
        other_p['manifest']=self.owner.pin(foreign_manifest)
        other_p_bytes=self.owner.canonical(other_p)
        other_l=self.owner.digest(b'THE-DESK/EVALUATION-INSTALL-POLICY/1\n'+other_p_bytes)
        other_q=copy.deepcopy(self.policies[1]);other_q['install_policy_sha256']=other_l
        other_q_bytes=self.owner.canonical(other_q)
        other_q_hash=self.owner.digest(b'THE-DESK/BUILD-QUALITY-POLICY/1\n'+other_q_bytes)
        foreign_source=copy.deepcopy(self.source)
        for name,raw in (('package.json',foreign_manifest),(self.owner.POLICY_PATH,other_p_bytes),(self.owner.QUALITY_PATH,other_q_bytes)):
            foreign_source[name].update(self.owner.pin(raw))
        foreign_profile_identity=dict(self.common,tree='e'*40,source_sha256=self.owner.digest(self.owner.canonical(
            {name:[row['bytes'],row['sha256']] for name,row in foreign_source.items() if row['type']=='file'})))
        transplanted=dict(self.raw)
        for name,raw in list(transplanted.items()):
            value=json.loads(raw)
            if name in ('BUILD-SOURCE-INVENTORY.json','SOURCE-INVENTORY.json'):value=foreign_source
            if type(value) is dict:
                if 'source' in value:value['source']=foreign_profile_identity
                if 'profile_policy_sha256' in value:value['profile_policy_sha256']=other_l
                if 'quality_policy_sha256' in value:value['quality_policy_sha256']=other_q_hash
                if name.endswith('-PROFILE.json'):value['manifest']=other_p['manifest']
                if name=='QUALITY.json':value['policy_sha256']=other_q_hash
            transplanted[name]=self.owner.canonical(value)
        transplanted=installation_model.repin(transplanted)
        # Positive under the complete alternate model inputs/policy, refusal
        # under this consumer. No raw or physical producer capability is claimed.
        self.owner.validate_metadata(transplanted,foreign_source,self.tools,foreign_profile_identity,
            (other_p,other_q,other_l,other_q_hash),ledger_base=self.base)
        with self.assertRaisesRegex(RuntimeError,'^installation_foreign_source$'):self.validate(transplanted)

    def test_22_descriptor_primary_and_permanent_barrier(self):
        cache = self.base / 'tmp/nonprivate-directory-control'
        previous = os.umask(0o022)
        try:
            cache.mkdir(mode=0o755)
        finally:
            os.umask(previous)
        self.assertEqual(cache.stat().st_mode & 0o777, 0o755)
        self.assertEqual(ci.fixture_identity(cache, False)['mode'], 0o755)
        with self.assertRaisesRegex(RuntimeError, '^installation_directory_owner$'):
            ci.fixture_identity(cache)
        cache.chmod(0o777)  # Explicit unsafe-mode negative, never a compatibility repair.
        try:
            with self.assertRaisesRegex(RuntimeError, '^installation_directory_owner$'):
                ci.fixture_identity(cache, False)
        finally:
            cache.chmod(0o755)
        link = self.base / 'tmp/nonprivate-directory-link'
        link.symlink_to(cache, target_is_directory=True)
        with self.assertRaises(OSError):
            ci.fixture_identity(link, False)
        with mock.patch.object(os, 'fstat', return_value=types.SimpleNamespace(st_mode=stat.S_IFDIR | 0o755, st_uid=os.getuid()+1)):
            with self.assertRaisesRegex(RuntimeError, '^installation_directory_owner$'):
                ci.fixture_identity(cache, False)
        with mock.patch.object(os, 'open') as opened:
            with self.assertRaisesRegex(RuntimeError, '^installation_directory_private$'):
                self.owner.observed_directory(cache, 0)
            opened.assert_not_called()

        # Target the actual helper's FINAL acquired descriptor, not an intermediate close.
        original_open = self.owner.Owned.open
        original_close = os.close
        final_descriptor = []
        close_attempts = []
        close_error = OSError('nonprivate-final-close')
        def open_final(lease, path, *args, **kwargs):
            fd = original_open(lease, path, *args, **kwargs)
            if Path(path) == cache:
                final_descriptor.append(fd)
            return fd
        def close_final(fd):
            if final_descriptor and fd == final_descriptor[0]:
                close_attempts.append(fd)
                raise close_error
            return original_close(fd)
        with mock.patch.object(self.owner, 'POISON', []):
            try:
                with mock.patch.object(self.owner.Owned, 'open', open_final), mock.patch.object(os, 'close', close_final):
                    with self.assertRaises(OSError) as caught:
                        ci.fixture_identity(cache, False)
                self.assertIs(caught.exception, close_error)
                self.assertEqual(len(final_descriptor), 1)
                self.assertEqual(close_attempts, final_descriptor)
                self.assertEqual([row['fd'] for row in self.owner.POISON], final_descriptor)
                with mock.patch.object(os, 'open') as opened:
                    with self.assertRaisesRegex(RuntimeError, '^installation_cleanup_pending$'):
                        ci.fixture_identity(cache, False)
                    opened.assert_not_called()
            finally:
                if final_descriptor:
                    original_close(final_descriptor[0])  # Harness-only repair AFTER ownership assertions.
        original_close=os.close;primary=ValueError('fixed-primary');held=[];attempts=[]
        with mock.patch.object(self.owner,'POISON',[]):
            lease=self.owner.Owned();fd=lease.open(self.root,True);held.append(fd)
            def uncertain(value):
                attempts.append(value)
                if value==fd:raise OSError('uncertain-close')
                return original_close(value)
            try:
                with mock.patch.object(os,'close',side_effect=uncertain):
                    with self.assertRaises(ValueError) as found:lease.finish(primary)
                self.assertIs(found.exception,primary);self.assertEqual(attempts,[fd])
                with mock.patch.object(os,'open') as opened:
                    with self.assertRaises(RuntimeError):lease.open(self.root,True)
                    opened.assert_not_called()
                self.assertEqual([row['fd'] for row in self.owner.POISON],[fd])
            finally:
                # Harness repair follows residual/attempt assertions; production never retries.
                original_close(fd)

        for cut in ('success','nonempty','symlink','missing','replacement-before-remove','replacement-at-remove','post-unlink-uncertain','close'):
            with self.traversal_world() as (ctx,checkout,base):
                slot=base/'evidence/fixture105-traversal';slot.mkdir(mode=0o700);ctx.cmd_fixture_binding('focused')
                loader=checkout/'node_modules/.vite-temp';saved=ci.fixture_temp(checkout,True)
                actual_rename=os.rename;actual_rmdir=os.rmdir;actual_fstat=os.fstat;actual_close=os.close;held=[];removed=[]
                if cut=='nonempty':self.owner.write(loader/'extra',b'x')
                if cut=='symlink':loader.rmdir();loader.symlink_to(base/'tmp',target_is_directory=True)
                if cut=='missing':loader.rmdir()
                def rename(left,right,*args,**kwargs):
                    if cut=='replacement-before-remove':
                        original=checkout/'node_modules/retained-original';actual_rename(loader,original);loader.mkdir(mode=0o700)
                    return actual_rename(left,right,*args,**kwargs)
                def remove(path,*args,**kwargs):
                    removed.append(path)
                    if cut=='replacement-at-remove':
                        parent=kwargs['dir_fd'];actual_rename(path,'retained-leased',src_dir_fd=parent,dst_dir_fd=parent)
                        os.mkdir(path,mode=0o700,dir_fd=parent)
                    return actual_rmdir(path,*args,**kwargs)
                def fstat(fd):
                    info=actual_fstat(fd)
                    if cut=='post-unlink-uncertain' and info.st_ino==saved['identity']['ino'] and info.st_nlink==0:
                        values=list(info);values[3]=2;return os.stat_result(values)
                    return info
                def close(fd):
                    if cut=='close' and actual_fstat(fd).st_ino==saved['identity']['ino']:
                        held.append(fd);raise OSError('finite-close-cut')
                    return actual_close(fd)
                try:
                    with mock.patch.object(os,'rename',side_effect=rename),mock.patch.object(os,'rmdir',side_effect=remove), \
                         mock.patch.object(os,'fstat',side_effect=fstat),mock.patch.object(os,'close',side_effect=close):
                        if cut=='success':
                            result=self.owner.settle_traversal_loader(ctx,saved,slot)
                            self.assertTrue(result['removed_leased_inode']);self.assertEqual(removed,['loader'])
                        else:
                            with self.assertRaises((RuntimeError,OSError)) as found:self.owner.settle_traversal_loader(ctx,saved,slot)
                            expected={'nonempty':'fixture loader remains unsettled','missing':'installation_traversal_loader_unchanged',
                                'replacement-before-remove':'installation_traversal_loader_moved_identity',
                                'replacement-at-remove':'installation_traversal_loader_unlinked_inode',
                                'post-unlink-uncertain':'installation_traversal_loader_unlinked_inode','close':'finite-close-cut'}
                            if cut=='symlink':self.assertIn(found.exception.errno,(20,40))
                            else:self.assertEqual(str(found.exception),expected[cut])
                    if cut in ('nonempty','symlink','missing','replacement-before-remove'):self.assertEqual(removed,[])
                    if cut=='replacement-before-remove':
                        self.assertEqual((checkout/'node_modules/retained-original').stat().st_ino,saved['identity']['ino'])
                        self.assertTrue((slot/'loader-settlement/loader').is_dir());self.assertTrue(self.owner.POISON)
                    if cut in ('post-unlink-uncertain','replacement-at-remove'):
                        self.assertEqual(removed,['loader']);self.assertTrue(self.owner.POISON)
                    if cut in ('post-unlink-uncertain','replacement-before-remove','replacement-at-remove','close'):
                        with mock.patch.object(os,'open') as opened:
                            with self.assertRaisesRegex(RuntimeError,'cleanup_pending'):self.owner.entry()
                            opened.assert_not_called()
                    if cut=='replacement-at-remove':
                        self.assertEqual((slot/'loader-settlement/retained-leased').stat().st_ino,saved['identity']['ino'])
                    if cut=='close':self.assertEqual(len(held),1)
                finally:
                    # Test-only surrogate descriptor settlement AFTER all poison/no-I/O assertions.
                    for fd in held:actual_close(fd)
        supervisor=ci.ROOT/'test/support/p33-parity-supervisor.py'
        supervisor_text=supervisor.read_text()
        self.assertEqual(supervisor_text.count("write_private(folder/'output.log',output,sync=False)"),1)
        self.assertEqual(supervisor_text.count('write_private(path,data,sync=True)'),1)
        for writer in ('record','output'):
            for cut in ('success','open','write','short','fstat','fsync','mode','close','primary-and-close'):
                with tempfile.TemporaryDirectory() as directory:
                    subject=runpy.run_path(str(supervisor),run_name='finite_supervisor_definitions')
                    path=Path(directory)/'data';original_open=os.open;original_close=os.close;original_write=os.write;opened=[];closed=[]
                    primary=ValueError('writer-body');secondary=OSError('writer-close')
                    def opening(name,flags,mode=0o777,*args,**kwargs):
                        self.assertEqual(flags,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW);self.assertEqual(mode,0o600)
                        if cut=='open':raise primary
                        fd=original_open(name,flags,0 if cut=='mode' else mode,*args,**kwargs);opened.append(fd);return fd
                    def closing(fd):
                        closed.append(fd)
                        if cut in ('close','primary-and-close'):raise secondary
                        return original_close(fd)
                    def writing(fd,data):
                        if cut in ('write','primary-and-close'):raise primary
                        return len(data)-1 if cut=='short' else original_write(fd,data)
                    try:
                        with mock.patch.object(os,'open',side_effect=opening),mock.patch.object(os,'close',side_effect=closing), \
                             mock.patch.object(os,'write',side_effect=writing), \
                             mock.patch.object(os,'fstat',side_effect=primary if cut=='fstat' else os.fstat), \
                             mock.patch.object(os,'fsync',side_effect=primary if cut=='fsync' else None):
                            action=lambda:subject['write_record'](path,{'ok':True}) if writer=='record' else subject['write_private'](path,b'output',sync=False)
                            expects_failure=cut not in ('success',) and not (writer=='output' and cut=='fsync')
                            if expects_failure:
                                with self.assertRaises((ValueError,OSError,RuntimeError)) as found:action()
                                if cut in ('open','write','fstat','primary-and-close') or cut=='fsync' and writer=='record':self.assertIs(found.exception,primary)
                                if cut=='close':self.assertIs(found.exception,secondary)
                            else:action()
                        self.assertEqual(closed,opened)
                        if cut=='success':
                            original=path.read_bytes();self.assertEqual(original,b'{"ok":true}\n' if writer=='record' else b'output')
                            with self.assertRaises(FileExistsError):subject['write_record'](path,{'other':True})
                            self.assertEqual(path.read_bytes(),original)
                        if cut=='mode':self.assertEqual(path.stat().st_mode&0o777,0)
                        if cut in ('close','primary-and-close'):
                            self.assertEqual(subject['PRIVATE_WRITE_PENDING'],opened)
                            if cut=='primary-and-close':self.assertEqual(subject['PRIVATE_WRITE_SECONDARY'],['OSError'])
                            with mock.patch.object(os,'open') as next_open:
                                with self.assertRaisesRegex(RuntimeError,'pending close'):subject['write_record'](Path(directory)/'later',{})
                                next_open.assert_not_called()
                    finally:
                        for fd in subject['PRIVATE_WRITE_PENDING']:original_close(fd)
        # The actual supervisor's closed traversal profile refuses an existing
        # runtime namespace before lock/attempt/prerequisite work, even if partial.
        with tempfile.TemporaryDirectory() as directory:
            subject=runpy.run_path(str(supervisor),run_name='finite_runtime_definitions');fn=subject['runtime_dir'];ns=fn.__globals__
            with mock.patch.dict(ns,ROOT=Path(directory)/'checkout'),mock.patch.object(ns['tempfile'],'gettempdir',return_value=directory):
                runtime=fn(exclusive=True)
                (runtime/'attempt-aaaaaaaa').mkdir(mode=0o700)
                with self.assertRaises(FileExistsError):fn(exclusive=True)
                legacy=fn();self.assertNotEqual(legacy,runtime)
                self.assertTrue(legacy.name.startswith('the-desk-p33-'));self.assertEqual(fn(),legacy)
                self.assertTrue(runtime.name.startswith('p33t-'))
                self.assertEqual(sorted(v.name for v in runtime.iterdir()),['attempt-aaaaaaaa'])

        # Actual production pathname construction for the ordinary hosted role:
        # no /proc alias is used for this pathname-budget proof.
        subject=runpy.run_path(str(supervisor),run_name='finite_path_definitions')
        namespace=subject['runtime_basename'].__globals__
        ordinary_tmp=Path('/home/runner/work/_temp/evaluation/ci/tmp')
        with mock.patch.dict(namespace,ROOT=Path('/tmp/e')),mock.patch.object(os,'getuid',return_value=1001), \
             mock.patch.object(self.owner,'EVAL',Path('/tmp/e')):
            basename=subject['runtime_basename'](True)
            ctx=types.SimpleNamespace(ci_dir=lambda:ordinary_tmp.parent)
            runtime=self.owner.traversal_runtime(ctx)
            self.assertEqual(runtime,ordinary_tmp/basename)
            self.assertEqual(basename,'p33t-1001-'+self.owner.digest(b'/tmp/e')[:24])
            address=subject['traversal_socket_path'](runtime/'attempt-aaaaaaaa')
            self.assertEqual(len(os.fsencode(address)),104)
            self.assertLessEqual(len(os.fsencode(address))+1,108)
            self.assertEqual(subject['runtime_basename'](False),'the-desk-p33-1001-'+self.owner.digest(b'/tmp/e')[:24])
        # Real AF_UNIX bind at a private pathname with exactly the ordinary
        # hosted TMPDIR byte length; uses genuine runtime_dir/socket construction.
        # This is local model data, not a hosted role or an admission capability.
        for label,tmp_bytes in (('ordinary',len(os.fsencode(ordinary_tmp))),('overlong',len(os.fsencode(ordinary_tmp))+8)):
            # Stay inside the existing finite owner's short private TMP scope.
            with tempfile.TemporaryDirectory(prefix='p33t-') as directory:
                parent=Path(directory);padding=tmp_bytes-len(os.fsencode(parent))-1
                self.assertGreater(padding,0);temporary=parent/('p'*padding);temporary.mkdir(mode=0o700)
                self.assertEqual(len(os.fsencode(temporary)),tmp_bytes)
                subject=runpy.run_path(str(supervisor),run_name='finite_real_path_definitions')
                ns=subject['guard'].__globals__
                with mock.patch.dict(ns,ROOT=Path('/tmp/e')),mock.patch.object(ns['tempfile'],'gettempdir',return_value=str(temporary)):
                    if label=='ordinary':
                        runtime=subject['runtime_dir'](True)
                        attempt=Path(tempfile.mkdtemp(prefix='attempt-',dir=runtime))
                        address=subject['traversal_socket_path'](attempt)
                        self.assertEqual(len(os.fsencode(address)),tmp_bytes+len(str(os.getuid()))+59)
                        server=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
                        try:
                            server.bind(address)
                            self.assertEqual(server.getsockname(),address)
                            self.assertTrue(stat.S_ISSOCK((attempt/'guard.sock').lstat().st_mode))
                        finally:server.close()
                    else:
                        # Exercise guard itself through its production pathname
                        # cut. No handlers, prerequisite fork, socket or Popen may run.
                        original_open=os.open;original_close=os.close;leases=[]
                        def opened(path,*args,**kwargs):
                            fd=original_open(path,*args,**kwargs)
                            if Path(path).name=='validation.lock':leases.append(fd)
                            return fd
                        preflight=mock.Mock(side_effect=AssertionError('preflight must not run'))
                        try:
                            with mock.patch.dict(ns,handlers=mock.Mock(),prerequisite=preflight), \
                                 mock.patch.object(os,'open',side_effect=opened),mock.patch.object(socket,'socket') as sockets, \
                                 mock.patch.object(subprocess,'Popen') as children:
                                with self.assertRaisesRegex(RuntimeError,'^traversal socket pathname bound$'):
                                    subject['guard'](types.SimpleNamespace(profile='fixture105-traversal'))
                                preflight.assert_not_called();sockets.assert_not_called();children.assert_not_called()
                            self.assertEqual(len(leases),1)
                        finally:
                            # Test-only process-exit surrogate, AFTER no-child assertions.
                            for fd in leases:original_close(fd)
        for folder in (Path('/tmp')/('é'*60),Path('/tmp/null\0folder')):
            with self.assertRaisesRegex(RuntimeError,'traversal socket pathname bound'):
                subject['traversal_socket_path'](folder)

    def test_23_metadata_namespace_symlink_and_extra(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory);(path/'PROVENANCE.json').symlink_to(self.root/'bindings/PROVENANCE.json')
            with self.assertRaises(RuntimeError):self.owner.load_records(path)
            (path/'PROVENANCE.json').unlink();(path/'EXTRA').write_bytes(b'')
            with self.assertRaises(RuntimeError):self.owner.load_records(path)

        for prior in ('root','partial-attempt','focused-receipt','loader-receipt'):
            with self.traversal_world() as (ctx,checkout,base),mock.patch.object(self.owner,'outer') as admitted, \
                 mock.patch.object(self.owner,'owned_capture') as captured:
                if prior in ('focused-receipt','loader-receipt'):
                    self.owner.write(base/'evidence'/('fixture105-before-focused.json' if prior=='focused-receipt' else 'fixture105-loader-created.json'),b'{}\n')
                else:
                    runtime=self.owner.traversal_runtime(ctx);runtime.mkdir(mode=0o700)
                    if prior=='partial-attempt':(runtime/'attempt-aaaaaaaa').mkdir(mode=0o700)
                with self.subTest(prior=prior),self.assertRaisesRegex(RuntimeError,'traversal_(exclusive|focused_unused)'):
                    self.owner.run_traversal(ctx)
                admitted.assert_not_called();captured.assert_not_called()
        # Device admission compares real observed node_modules and the freshly
        # created real slot after E0, but before any binding or captured child.
        with self.traversal_world() as (ctx,checkout,base):
            slot=base/'evidence/fixture105-traversal';observed=self.owner.observed_directory;seen=[]
            def cross_device(path,private=True):
                value=observed(path,private);seen.append(Path(path))
                return dict(value,dev=value['dev']+1) if Path(path)==slot else value
            with mock.patch.object(self.owner,'outer',return_value={}) as admitted, \
                 mock.patch.object(self.owner,'observed_directory',side_effect=cross_device), \
                 mock.patch.object(ctx,'cmd_fixture_binding') as bind,mock.patch.object(self.owner,'owned_capture') as captured, \
                 mock.patch.object(os,'rename') as renamed,mock.patch.object(os,'rmdir') as removed:
                with self.assertRaisesRegex(RuntimeError,'^installation_traversal_loader_filesystem$'):
                    self.owner.run_traversal(ctx)
                admitted.assert_called_once_with(ctx,'E0')
                self.assertEqual(seen,[checkout/'node_modules',slot])
                bind.assert_not_called();captured.assert_not_called();renamed.assert_not_called();removed.assert_not_called()
                self.assertTrue(slot.is_dir());self.assertEqual([p.name for p in slot.iterdir()],['preflight.json'])
                refusal=json.loads((slot/'preflight.json').read_bytes())
                self.assertFalse(refusal['same_filesystem']);self.assertFalse(refusal['binding_started']);self.assertFalse(refusal['child_started'])
                self.assertNotEqual(refusal['modules']['dev'],refusal['slot']['dev'])
                self.assertFalse((checkout/'node_modules/.vite-temp').exists())
                self.assertFalse((base/'evidence/fixture105-before-focused.json').exists())
                self.assertFalse((base/'evidence/fixture105-loader-created.json').exists())
        with self.traversal_world() as (ctx,checkout,base),mock.patch.object(self.owner,'outer',return_value={}), \
             mock.patch.object(self.owner,'owned_capture',side_effect=lambda *_:self.traversal_capture(ctx,extra=True)):
            with self.assertRaisesRegex(RuntimeError,'traversal_one_guard'):self.owner.run_traversal(ctx)
            inventory=json.loads((base/'evidence/fixture105-traversal/runtime-retained/inventory.json').read_bytes())
            self.assertFalse(inventory['expected_population_complete'])
            self.assertIn('attempt-bbbbbbbb',{row['relative_path'] for row in inventory['entries']})
            self.assertTrue((checkout/'node_modules/.vite-temp').is_dir())
        with self.traversal_world() as (ctx,checkout,base):
            slot=base/'evidence/fixture105-traversal';slot.mkdir(mode=0o700);self.traversal_capture(ctx)
            runtime=self.owner.traversal_runtime(ctx);guard=json.loads((runtime/'attempt-aaaaaaaa/guard-result.json').read_bytes())
            with mock.patch.object(socket.socket,'recv',side_effect=AssertionError('socket payload forbidden')):
                value=self.owner.retain_traversal_runtime(runtime,slot/'kept',guard['namespace'])
            self.assertTrue(value['expected_population_complete']);self.assertEqual(value['regular_files'],2)
            self.assertEqual({row['kind'] for row in value['entries']},{'directory','regular','socket_metadata_only','lock_metadata_only'})
            (runtime/'attempt-aaaaaaaa/extra').symlink_to('/etc/passwd')
            refused=self.owner.retain_traversal_runtime(runtime,slot/'extra',guard['namespace'])
            self.assertFalse(refused['expected_population_complete']);self.assertIn('nonregular',refused['problems'])
        for mutation in ('missing-guard','extra-file','oversize-file','lock-drift','entry-overflow'):
            with self.traversal_world() as (ctx,checkout,base):
                slot=base/'evidence/fixture105-traversal';slot.mkdir(mode=0o700);self.traversal_capture(ctx)
                runtime=self.owner.traversal_runtime(ctx);attempt=runtime/'attempt-aaaaaaaa'
                guard=json.loads((attempt/'guard-result.json').read_bytes())
                if mutation=='missing-guard':(attempt/'guard-result.json').unlink()
                elif mutation=='extra-file':self.owner.write(attempt/'extra',b'extra')
                elif mutation=='oversize-file':self.owner.write(attempt/'extra',b'x'*65537,65537)
                elif mutation=='lock-drift':(runtime/'validation.lock').write_bytes(b'x')
                else:
                    for index in range(96):(runtime/('extra'+str(index))).mkdir(mode=0o700)
                retained=slot/'failed-retained'
                with mock.patch.object(self.owner,'read',wraps=self.owner.read) as read_bytes:
                    if mutation in ('oversize-file','lock-drift','entry-overflow'):
                        with self.assertRaisesRegex(RuntimeError,'traversal_runtime_(regular|lock|entries)'):
                            self.owner.retain_traversal_runtime(runtime,retained,guard['namespace'])
                    else:self.assertFalse(self.owner.retain_traversal_runtime(runtime,retained,guard['namespace'])['expected_population_complete'])
                    self.assertFalse(any(Path(call.args[0]).name in ('guard.sock','validation.lock') for call in read_bytes.call_args_list))
                self.assertFalse(json.loads((retained/'inventory.json').read_bytes())['expected_population_complete'])
                self.assertTrue(runtime.is_dir())
        for cut in ('preseal','foreign-source','foreign-run','foreign-role','foreign-Q'):
            fault=RuntimeError('modeled-admission-'+cut)
            with self.traversal_world() as (ctx,checkout,base),mock.patch.object(self.owner,'outer',side_effect=fault), \
                 mock.patch.object(self.owner,'owned_capture') as child,mock.patch.object(ctx,'cmd_fixture_binding') as bind:
                with self.assertRaises(RuntimeError) as found:self.owner.run_traversal(ctx)
                self.assertIs(found.exception,fault);bind.assert_not_called();child.assert_not_called()
                self.assertFalse((base/'evidence/fixture105-traversal').exists())
        for cut in ('exit','settlement','truncated','spawn'):
            with self.traversal_world() as (ctx,checkout,base),mock.patch.object(self.owner,'outer',return_value={}):
                def negative(*_):
                    value=self.traversal_capture(ctx)
                    if cut=='exit':value['exit']=1
                    elif cut=='settlement':value['settlement']='pending'
                    elif cut=='truncated':value['streams']['stdout']['truncated']=True
                    else:value['spawn_attempts']=2
                    owner_path=base/'evidence/fixture105-traversal/owner.json'
                    owner=json.loads(owner_path.read_bytes());owner['process']=value;owner_path.write_bytes(self.owner.canonical(owner))
                    return value
                with mock.patch.object(self.owner,'owned_capture',side_effect=negative) as child:
                    with self.assertRaisesRegex(RuntimeError,'raw_process_settlement'):self.owner.run_traversal(ctx)
                    self.assertEqual(child.call_count,1)
                self.assertTrue((checkout/'node_modules/.vite-temp').is_dir())

        primary=ValueError('capture-first')
        with self.traversal_world() as (ctx,checkout,base), \
             mock.patch.object(self.owner,'outer',side_effect=[{},OSError('post-check')]), \
             mock.patch.object(self.owner,'owned_capture',side_effect=primary):
            with self.assertRaises(ValueError) as found:self.owner.run_traversal(ctx)
            self.assertIs(found.exception,primary)
            self.assertEqual(self.owner.SECONDARY[0]['phase'],'outer_after')
            self.assertEqual(self.owner.SECONDARY[1]['phase'],'runtime_retention')

    def test_24_canonical_budgets_and_no_future_authority(self):
        for name,raw in self.raw.items():self.assertLessEqual(len(raw),self.owner.record_limit(name))
        p,q,l,q_hash=self.policies
        self.assertNotIn('source_sha256',p);self.assertNotIn('profile_policy_sha256',p)
        self.assertEqual(q['install_policy_sha256'],l)
        self.assertEqual(len(q['structural_methods']),157)
        self.assertEqual(len(l),64);self.assertEqual(len(q_hash),64)
        for observed in ('0077','0022','0000','0027'):
            envelope={'schema':'ci-stage-envelope/1','operation':'producer-build','observed_umask':observed,'effective_umask':'0077','restriction_only':True}
            self.assertEqual(self.owner.validate_envelope(envelope,'producer-build'),envelope)
        for observed in ('0177','0777','77','not-octal'):
            with self.assertRaisesRegex(RuntimeError,'envelope_mask_policy'):
                self.owner.validate_envelope({'schema':'ci-stage-envelope/1','operation':'producer-build','observed_umask':observed,'effective_umask':'0077','restriction_only':True},'producer-build')
        empty={'bytes':0,'sha256':self.owner.digest(b'')}
        self.owner.physical_pin(empty,8388608,empty=True)
        for value in (empty,{'bytes':True,'sha256':'a'*64},{'bytes':262145,'sha256':'a'*64},{'bytes':1,'sha256':'wrong'}):
            with self.assertRaises(RuntimeError):self.owner.physical_pin(value)
        with tempfile.TemporaryDirectory() as directory:
            world=Path(directory);checkout=world/'checkout';role=world/'role';temporary=role/'ci/tmp'
            checkout.mkdir(mode=0o700);temporary.mkdir(parents=True,mode=0o700);role.chmod(0o700)
            (checkout/'same').write_bytes(b'x');(checkout/'same').chmod(0o600)
            state={'phase':'finite','settling':False};process=types.SimpleNamespace(returncode=None)
            observer=self.owner.owned_disk_observer(checkout,role,temporary,state,[process])
            actual_walk=os.walk
            def vanished(root,**kwargs):
                for parent,dirs,files in actual_walk(root,**kwargs):
                    yield parent,dirs,files+(['vanished'] if Path(parent)==temporary else [])
            with mock.patch.object(os,'walk',side_effect=vanished):
                self.assertFalse(observer()['strict'])
                self.assertEqual(state['owned_scope_observation']['races'][0]['relative_path'],'vanished')
                process.returncode=0
                with self.assertRaises(FileNotFoundError):observer()
            process.returncode=None
            def foreign(root,**kwargs):
                for parent,dirs,files in actual_walk(root,**kwargs):yield parent,dirs,files+(['vanished'] if Path(parent)==checkout else [])
            with mock.patch.object(os,'walk',side_effect=foreign):
                with self.assertRaisesRegex(RuntimeError,'disk_race_outside_tmp'):observer()
            def entries(root,**kwargs):
                if Path(root)==checkout:yield str(checkout),[],['same']*65537
                else:yield from actual_walk(root,**kwargs)
            with mock.patch.object(os,'walk',side_effect=entries):
                with self.assertRaisesRegex(RuntimeError,'owned_disk_entry_cap'):observer()
            actual_lstat=Path.lstat
            def huge(path,*args,**kwargs):
                value=actual_lstat(path,*args,**kwargs)
                if path==checkout/'same':
                    values=list(value);values[6]=1073741825;return os.stat_result(values)
                return value
            with mock.patch.object(Path,'lstat',huge):
                with self.assertRaisesRegex(RuntimeError,'owned_disk_byte_cap'):observer()
            process.returncode=0
            with mock.patch.object(os,'walk',side_effect=PermissionError('finite-denied')):
                with self.assertRaises(PermissionError):observer()
            held=world/'retained-checkout';checkout.rename(held);checkout.mkdir(mode=0o700)
            with self.assertRaisesRegex(RuntimeError,'owned_disk_root_changed'):observer()
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);leaf=root/'file';leaf.write_bytes(b'fixed');leaf.chmod(0o600)
            actual_fstat=os.fstat
            def changed(fd):
                value=actual_fstat(fd)
                if os.readlink('/proc/self/fd/'+str(fd))==str(leaf):
                    values=list(value);values[0]^=0o100;return os.stat_result(values)
                return value
            with mock.patch.object(os,'fstat',side_effect=changed):
                with self.assertRaisesRegex(RuntimeError,'graph_edge_descriptor'):self.owner.graph(root,'source')
            (root/'link').symlink_to('file')
            self.assertEqual(self.owner.graph(root,'tools')['link']['target'],'file')
            (root/'link').unlink();(root/'link').symlink_to('/etc/passwd')
            with self.assertRaisesRegex(RuntimeError,'graph_link_absolute'):self.owner.graph(root,'tools')
        primary=ValueError('first-action-failure')
        def failed_action():raise primary
        touched=[]
        with mock.patch.object(self.owner,'ATTEMPTS',[]),mock.patch.object(self.owner,'SECONDARY',[]):
            def observe():
                with mock.patch.object(self.owner,'role_base',return_value=self.base),mock.patch.object(self.owner,'strict_cache',side_effect=lambda _:touched.append('cache') or {'strict':True}),mock.patch.object(self.owner,'graph',side_effect=lambda root,kind: (_ for _ in ()).throw(OSError('source-read')) if kind=='source' else touched.append('tools') or self.tools):
                    return self.owner.attempt_finalization(ci,'evaluation',self.source,self.tools,self.owner.observed_directory(self.checkout),None)
            with self.assertRaises(ValueError) as found:self.owner.after_attempt(failed_action,observe)
            self.assertIs(found.exception,primary);self.assertEqual(touched,['tools','cache'])
            self.assertEqual([v['name'] for v in self.owner.ATTEMPTS[0]['checks']],['root','source','tools','dist','cache'])
            self.assertFalse(self.owner.ATTEMPTS[0]['complete']);self.assertTrue(self.owner.SECONDARY)

        with mock.patch.object(self.owner,'POISON',[{'synthetic':'pending'}]),mock.patch.object(os.path,'lexists') as inspected,mock.patch.object(self.owner,'role_base') as resolved:
            unknown=self.owner.attempt_finalization(ci,'evaluation',{}, {},{},None,transferring=True)
            inspected.assert_not_called();resolved.assert_not_called();self.assertFalse(unknown['complete'])
            self.assertEqual(len(unknown['checks']),5)
        invocation=json.loads(self.raw['EVAL-INSTALL-INVOCATION.json'])
        for field,code in (('argv','raw_install_argv'),('deadline','raw_install_deadline')):
            raw_owner={'argv':list(invocation['argv']),'process':{'argv':['/usr/bin/timeout','--signal=TERM','--kill-after=20s','600s']+invocation['argv']},'synthetic_model_only':True}
            if field=='argv':raw_owner['argv'].append('--ignore-scripts=false')
            else:raw_owner['process']['argv'][3]='601s'
            changed=dict(self.raw);v=dict(invocation,owner_raw=self.owner.pin(self.owner.canonical(raw_owner)))
            changed['EVAL-INSTALL-INVOCATION.json']=self.owner.canonical(v)
            settlement=json.loads(changed['EVAL-INSTALL-SETTLEMENT.json']);settlement['owner_raw']=v['owner_raw']
            changed['EVAL-INSTALL-SETTLEMENT.json']=self.owner.canonical(settlement);changed=installation_model.repin(changed)
            self.validate(changed)  # Every metadata P is coherent; fresh raw check still refuses.
            with self.assertRaisesRegex(RuntimeError,'^installation_'+code+'$'):self.owner.check_install_command(raw_owner,v)
        touched=[];first=ValueError('copy-primary')
        def copy_failed():raise first
        def role_observe(_ctx,role,*_args,**kwargs):
            touched.append((role,kwargs.get('transferring',False)))
            return {'checks':[{'name':'source','status':'checked'}],'secondary':([{'phase':'build:cache','code':'unknown'}] if role=='build' else []),'complete':role!='build'}
        states={role:{'source':{},'tools':{},'root':{}} for role in ('build','evaluation')}
        with mock.patch.object(self.owner,'ATTEMPTS',[]),mock.patch.object(self.owner,'SECONDARY',[]),mock.patch.object(self.owner,'attempt_finalization',side_effect=role_observe):
            with self.assertRaises(ValueError) as found:self.owner.after_attempt(copy_failed,lambda:self.owner.transfer_finalization(ci,states,{}))
            self.assertIs(found.exception,first);self.assertEqual(touched,[('build',False),('evaluation',True)])
            self.assertFalse(self.owner.ATTEMPTS[0]['evaluation_output_adopted']);self.assertFalse(self.owner.ATTEMPTS[0]['postseal'])
            self.assertTrue(self.owner.SECONDARY)
        # Conservative late-stage census: every ledger slot and install-result
        # slot is populated, even those not normally produced. Only guaranteed
        # byte aliases/checked lossless record recipes reduce physical members.
        with tempfile.TemporaryDirectory() as directory:
            world=Path(directory);runner=world/'runner';workspace=world/'workspace'
            runner.mkdir(mode=0o700);workspace.mkdir(mode=0o700)
            def put(path,raw):installation_model.put(path,raw)
            def data(tag):return self.owner.canonical({'synthetic_retention_only':True,'tag':tag})
            build_names={name for name in self.owner.BINDINGS if name.startswith('BUILD-')}|{'QUALITY.json','QUALITY-SETTLEMENT.json','DIST-INVENTORY.json'}
            eval_names=set(self.owner.BINDINGS)-{'ADOPTION.json','RELEASE.json','SOURCE-LEDGER.json'}
            self.assertEqual((len(build_names),len(eval_names)),(13,27))
            counter=100
            for role,names in (('build',build_names),('evaluation',eval_names)):
                base=runner/role/'ci'
                for name in sorted(names):put(base/'evidence/producer/metadata'/name,data('metadata:'+name))
                for name in ('env.json','identity.json','snapshot-pre.json','build-init.json','partition-init.json','partition.json','bind-pre.json','bind-build.json','fixture105-binding.json'):
                    put(base/'evidence'/name,data(role+':ledger:'+name))
                slots=[('install',base/'evidence/producer/install')]
                slots.extend(('quality-'+name,base/'evidence/producer/quality'/name) for name in self.owner.GATES) if role=='build' else slots.append(('identity-witness',base/'evidence/identity-witness'))
                for label,slot in slots:
                    actions=['operation']+(['resolution'] if label=='install' else ['identity'] if label=='quality-structural' else [])
                    owner={'synthetic_retention_only':True,'tag':role+':'+label,'auxiliary_actions':[]}
                    for action in actions:
                        counter+=1;launch={'pid':counter,'pgid':counter}
                        stdout=(role+':'+label+':'+action+':stdout\n').encode();stderr=(role+':'+label+':'+action+':stderr\n').encode()
                        outcome={'synthetic_retention_only':True,'label':action,'tag':role+':'+label+':'+action,
                            'primary':'late-failure' if role=='evaluation' and label=='identity-witness' else None}
                        owner['auxiliary_actions'].append(outcome)
                        captured=base/'tmp'/('capture-'+label)
                        for suffix,raw in (('stdout',stdout),('stderr',stderr),('process.json',(json.dumps(launch,sort_keys=True)+'\n').encode()),('json',(json.dumps(outcome,sort_keys=True)+'\n').encode())):
                            put(captured/(action+'.'+suffix),raw)
                        if action=='operation':
                            owner['launch']=launch;put(slot/'stdout',stdout);put(slot/'stderr',stderr)
                        else:owner['resolution' if action=='resolution' else 'identity_witness']={'raw_stdout':stdout.decode()}
                    put(slot/'owner.json',self.owner.canonical(owner));put(slot/'result.json',data(role+':'+label+':result'))
                if role=='build':put(base/'evidence/producer/quality/owner.json',data('quality-aggregate-owner'))
                else:
                    for name in ('copy-owner.json','owner.json','stdout','stderr'):put(base/'evidence/producer/transfer'/name,data('transfer:'+name))
                put(base/'evidence/producer/POISON.json',data(role+':pending-model-only'))
            def inspect_retained(current):
                original={str(relative):path.read_bytes() for path,relative,_ in self.owner.partial_specs(current) if os.path.lexists(path)}
                with mock.patch.object(ci,'ROOT',workspace),mock.patch.dict(os.environ,{'GITHUB_WORKSPACE':str(workspace),'RUNNER_TEMP':str(current)}):
                    self.assertEqual(self.owner.retain_partial(ci),0)
                target=current/'producer-failure';index=json.loads((target/'INDEX.json').read_bytes())
                self.assertTrue(index['complete_present_population']);self.assertEqual(index['problems'],[])
                self.assertEqual({row['logical_path'] for row in index['entries']},set(original))
                for row in index['entries']:
                    rep=row['representation']
                    if rep['kind']=='blob':raw=(target/rep['path']).read_bytes()
                    else:
                        value=json.loads((target/rep['parent_blob']).read_bytes())
                        for part in rep['pointer']:value=value[part]
                        raw=(json.dumps(value,sort_keys=True)+'\n').encode() if rep['encoding']=='json-sort-spaces-lf/1' else value.encode()
                    self.assertEqual(raw,original[row['logical_path']]);self.assertEqual(self.owner.pin(raw),row['raw'])
                self.assertLessEqual(sum(path.is_file() for path in target.rglob('*')),96)
                self.assertLessEqual(sum(path.stat().st_size for path in target.rglob('*') if path.is_file()),167772160)
                held=json.loads((target/'HELD.json').read_bytes());self.assertFalse(held['admitted'])
                self.assertFalse(held['native_acceptance'])
                return index
            complete=inspect_retained(runner)
            self.assertEqual(len(complete['entries']),141);self.assertEqual(complete['physical_objects'],90)
            later=world/'late-runner';later.mkdir(mode=0o700)
            for role in ('build','evaluation'):shutil.copytree(runner/role,later/role)
            for name in ('owner.json','result.json'):(later/'evaluation/ci/evidence/identity-witness'/name).unlink()
            partial=inspect_retained(later)
            self.assertEqual(len(partial['entries']),139)
            self.assertNotIn('evaluation/identity-witness/owner.json',{row['logical_path'] for row in partial['entries']})
            tail=next(row for row in partial['entries'] if row['logical_path']=='evaluation/captures/identity-witness/operation.json')
            self.assertEqual(tail['representation']['kind'],'blob')
            self.assertIn(b'late-failure',(later/'producer-failure'/tail['representation']['path']).read_bytes())
        wrapper=(ci.ROOT/'tools/ci-validation/run-stage.sh').read_text()
        prefix="    printf '{\"schema\":\"ci-stage-envelope/1\""
        receipt_lines=[line for line in wrapper.splitlines() if line.startswith(prefix)]
        expected_receipt='    printf \'{"schema":"ci-stage-envelope/1","operation":"%s","observed_umask":"%s","effective_umask":"%s","restriction_only":true}\\n\' "$STAGE" "$OBSERVED_MASK" "$EFFECTIVE_MASK" || exit 79'
        self.assertEqual(receipt_lines,[expected_receipt])
        self.assertLess(wrapper.index(expected_receipt),wrapper.index('    /usr/bin/env -u TEST_DATABASE_URL'))
        for emission_exit in (0,53):
            script="\n".join([
                'set +e',
                'STAGE=producer-build; OBSERVED_MASK=0022; EFFECTIVE_MASK=0077',
                'printf() { if [ "$EMISSION_EXIT" -ne 0 ]; then return "$EMISSION_EXIT"; fi; builtin printf "$@"; }',
                expected_receipt,
                'builtin printf "FOLLOW_ON_CHILD_BOUNDARY_REACHED\\n"',
            ])
            result=subprocess.run(['/bin/bash','--noprofile','--norc','-c',script],
                env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8','LC_ALL':'C.UTF-8','EMISSION_EXIT':str(emission_exit)},
                stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=3,check=False)
            self.assertLess(len(result.stdout)+len(result.stderr),2048)
            self.assertEqual(result.stderr,b'')
            self.assertEqual(result.returncode,0 if emission_exit==0 else 79)
            if emission_exit==0:
                self.assertIn(b'FOLLOW_ON_CHILD_BOUNDARY_REACHED\n',result.stdout)
                self.assertEqual(json.loads(result.stdout.splitlines()[0]),{'schema':'ci-stage-envelope/1','operation':'producer-build','observed_umask':'0022','effective_umask':'0077','restriction_only':True})
            else:
                self.assertEqual(result.stdout,b'')



        for count in (0,64,65):
            with tempfile.TemporaryDirectory() as directory:
                world=Path(directory);checkout=world/'checkout';role=world/'role';temporary=role/'tmp'
                for path in (checkout,role,temporary):path.mkdir(mode=0o700)
                state={'phase':'finite-saturation','settling':False};process=types.SimpleNamespace(returncode=None)
                observer=self.owner.owned_disk_observer(checkout,role,temporary,state,[process],horizons=(30,))
                actual_walk=os.walk
                def disappearing(root,**kwargs):
                    for parent,dirs,files in actual_walk(root,**kwargs):
                        yield parent,dirs,files+(['missing'+str(i) for i in range(count)] if Path(parent)==temporary else [])
                with mock.patch.object(os,'walk',side_effect=disappearing):value=observer()
                self.assertEqual(value['race_events_total'],count);self.assertEqual(len(value['races']),min(count,64))
                self.assertEqual(value['race_events_omitted'],max(0,count-64));self.assertEqual(value['race_sample_saturated'],count>64)
                self.assertEqual(value['race_events_leaf'],count);self.assertEqual(value['race_events_directory'],0)
                self.assertEqual(value['race_events_total'],len(value['races'])+value['race_events_omitted'])
                if count==65:
                    def foreign_after_saturation(root,**kwargs):
                        for parent,dirs,files in actual_walk(root,**kwargs):yield parent,dirs,files+(['foreign'] if Path(parent)==checkout else [])
                    with mock.patch.object(os,'walk',side_effect=foreign_after_saturation):
                        with self.assertRaisesRegex(RuntimeError,'disk_race_outside_tmp'):observer()
                    self.assertEqual(state['disk_race_accounting']['total'],65)
                    def denied_after_saturation(root,**kwargs):
                        kwargs['onerror'](PermissionError(13,'finite denied',str(temporary/'gone')))
                        return iter(())
                    with mock.patch.object(os,'walk',side_effect=denied_after_saturation):
                        with self.assertRaises(PermissionError):observer()
                    self.assertEqual(state['disk_race_accounting']['total'],65)
                process.returncode=0
                with mock.patch.object(os,'walk',side_effect=disappearing):
                    if count:
                        with self.assertRaises(FileNotFoundError):observer()
                    else:self.assertTrue(observer()['strict'])
                (temporary/'retained-residual').write_bytes(b'x')
                settled=observer();self.assertTrue(settled['strict']);self.assertGreater(settled['entries'],0)
                self.assertTrue((temporary/'retained-residual').exists())
        with tempfile.TemporaryDirectory() as directory:
            world=Path(directory);checkout=world/'checkout';role=world/'role';temporary=role/'tmp'
            for path in (checkout,role,temporary,temporary/'a',temporary/'b'):path.mkdir(mode=0o700)
            state={'phase':'subtrees','settling':False};process=types.SimpleNamespace(returncode=None)
            observer=self.owner.owned_disk_observer(checkout,role,temporary,state,[process],horizons=(30,))
            actual_walk=os.walk
            def subtrees(root,**kwargs):
                for parent,dirs,files in actual_walk(root,**kwargs):
                    if Path(parent)==temporary:
                        for child in ('a','b'):kwargs['onerror'](FileNotFoundError(2,'finite disappearance',str(temporary/child/'gone')))
                    yield parent,dirs,files
            with mock.patch.object(os,'walk',side_effect=subtrees):value=observer()
            self.assertEqual(value['race_events_directory'],2);self.assertEqual(value['race_events_leaf'],0)
            self.assertEqual([v['relative_path'] for v in value['races']],['a/gone','b/gone'])
            budget=value['aggregate_work_limit'];counts=state['disk_race_accounting']
            counts['live_work']=budget
            with self.assertRaisesRegex(RuntimeError,'disk_aggregate_work_bound'):observer()
            counts['live_work']=0;counts['live_scans']=0
            def work_overflow(root,**kwargs):
                counts['scan_work']=65536;yield str(root),[],[]
            with mock.patch.object(os,'walk',side_effect=work_overflow):
                with self.assertRaisesRegex(RuntimeError,'disk_scan_work_bound'):observer()
            counts['live_work']=0;counts['live_scans']=value['scan_limit']
            with self.assertRaisesRegex(RuntimeError,'disk_live_scan_bound'):observer()
            counts['live_scans']=0;counts['total']=budget
            def missing(root,**kwargs):
                for parent,dirs,files in actual_walk(root,**kwargs):yield parent,dirs,files+(['gone'] if Path(parent)==temporary else [])
            with mock.patch.object(os,'walk',side_effect=missing):
                with self.assertRaisesRegex(RuntimeError,'disk_race_total_bound'):observer()
            counts['total']=2;counts['live_scans']=0
            (temporary/'escape').symlink_to(checkout,target_is_directory=True)
            def escaped(root,**kwargs):
                kwargs['onerror'](FileNotFoundError(2,'cut',str(temporary/'escape/gone')))
                return iter(())
            with mock.patch.object(os,'walk',side_effect=escaped):
                with self.assertRaises(OSError):observer()
            for error in (PermissionError(13,'denied',str(temporary/'gone')),FileNotFoundError(2,'evidence',str(role/'missing'))):
                with mock.patch.object(os,'walk',side_effect=error):
                    with self.assertRaises(type(error)):observer()

if __name__=='__main__':
    unittest.main()
