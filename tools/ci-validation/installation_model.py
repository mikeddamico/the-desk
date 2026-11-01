"""Explicitly synthetic /2 conformance data. Never imported by a producer or admission.

No install, compiler, child, provider, SQL or successful real-producer receipt is
created here. A model can exercise record/traversal code, not grant admission.
"""
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
from unittest import mock


def encoded(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False) + '\n').encode()


def pinned(raw):
    return {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


def put(path, raw):
    path = Path(path);path.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        offset = 0
        while offset < len(raw):
            count = os.write(fd, raw[offset:]);assert count > 0;offset += count
    finally:
        os.close(fd)


def package_model(ci, checkout, prefix, closure):
    """Deliberately minimal inert files, not npm package payloads or installs."""
    roots = closure['roots'];records = {row['path']: row['record'] for row in closure['records']}
    chosen = {}
    for name, row in records.items():
        if row.get('optional') is True and (('os' in row and 'linux' not in row['os']) or
                ('cpu' in row and 'x64' not in row['cpu']) or ('libc' in row and 'glibc' not in row['libc'])):
            continue
        chosen[name] = row
        relative = name.split('/node_modules/')[-1]
        if relative.startswith('node_modules/'):
            relative = relative[len('node_modules/'):]
        value = {'name': row.get('name', relative), 'version': row['version'], 'synthetic_inert_model': True}
        put(checkout / name / 'package.json', encoded(value))
    put(checkout / 'node_modules/.package-lock.json', encoded({'name': 'the-desk', 'version': '0.1.0',
        'lockfileVersion': 3, 'requires': True, 'packages': chosen}))
    # This byte witness remains inert and gives V9 a genuine mutable leaf.
    if prefix == 'EVAL':
        put(checkout / 'node_modules/inert-tooling-witness.js', b'// synthetic bytes; never imported\n')
    return chosen


def make(ci, checkout, *, ledger_base, logical=False):
    """Canonical model objects with real private descriptor identities/leaf bytes."""
    owner = ci.installation_owner();checkout = Path(checkout)
    for actual in sorted((ci.ROOT/'test').rglob('*.test.ts')):
        relative=actual.relative_to(ci.ROOT)
        if not (checkout/relative).exists(): put(checkout/relative,b'// explicitly synthetic source model; never executed\n')
    for name in ('.node-version','.npmrc','.prettierignore','eslint.config.js','tsconfig.build.json','tsconfig.json','vitest.config.ts'):
        if not (checkout/name).exists():
            put(checkout/name,(ci.ROOT/name).read_bytes())
    build = checkout.parent / (checkout.name + '-build-model');build.mkdir(mode=0o700)
    # Complete this test's declared source model in both roles, not a real source tree.
    for parent, directories, files in os.walk(checkout):
        relative = Path(parent).relative_to(checkout)
        if not relative.parts:
            directories[:] = [name for name in directories if name not in ('node_modules', 'dist', '.git')]
        for name in files:
            put(build / relative / name, (Path(parent) / name).read_bytes())
    for root in (build, checkout):
        (root / 'node_modules').mkdir(mode=0o700, exist_ok=True)
    p_raw = (checkout / owner.POLICY_PATH).read_bytes();q_raw = (checkout / owner.QUALITY_PATH).read_bytes()
    p, q = json.loads(p_raw), json.loads(q_raw)
    l = hashlib.sha256(b'THE-DESK/EVALUATION-INSTALL-POLICY/1\n' + p_raw).hexdigest()
    q_hash = hashlib.sha256(b'THE-DESK/BUILD-QUALITY-POLICY/1\n' + q_raw).hexdigest()
    records = {}
    physical = {}; selected = {}
    logical_roots = {'BUILD': Path('/tmp/d') if logical else build, 'EVAL': Path('/tmp/e') if logical else checkout}
    def observed(path, as_path=None):
        s = path.stat()
        return {'path': str(as_path or path), 'dev': s.st_dev, 'ino': s.st_ino, 'uid': s.st_uid, 'gid': s.st_gid, 'mode': s.st_mode & 0o777}
    for prefix, root in [('BUILD', build), ('EVAL', checkout)]:
        closure = json.loads((root / 'fixtures/ci-evaluation-installation' / (prefix + '-CLOSURE.json')).read_text())
        selected[prefix] = package_model(ci, root, prefix, closure)
        physical[prefix] = (root, closure)
    source = ci.fixture_graph(checkout, 'source')
    common = {'repository': 'synthetic/model', 'run_id': '1', 'run_attempt': '1', 'checkout': 'a' * 40,
        'head': 'b' * 40, 'tree': 'c' * 40, 'source_sha256': pinned(encoded({name: [row['bytes'],row['sha256']] for name,row in source.items() if row['type']=='file'}))['sha256']}
    def add(name, value):
        raw = encoded(value);records[name] = raw;return pinned(raw)
    raw_model = pinned(encoded({'synthetic_model_only': True, 'usable_admission_capability': False}))
    def settlement():
        return {'schema':'ci-owned-settlement/1','stdout_eof':True,'stderr_eof':True,'direct_reaped':True,'group_empty':True,
            'discovery_complete':True,'owned_pending':[],'primary':None,'cleanup':[],'cancelled':False,'owner_raw':raw_model}
    for prefix in ('BUILD', 'EVAL'):
        root, closure = physical[prefix];role = logical_roots[prefix];build_role = prefix=='BUILD'
        actual_tools = ci.fixture_graph(root / 'node_modules', 'tools')
        source_name = 'BUILD-SOURCE-INVENTORY.json' if build_role else 'SOURCE-INVENTORY.json'
        tools_name = 'BUILD-TOOLS-INVENTORY.json' if build_role else 'TOOLS-INVENTORY.json'
        source_pin = add(source_name, ci.fixture_graph(root,'source'));tool_pin = add(tools_name, actual_tools)
        closure_pin = add(prefix+'-CLOSURE.json', closure)
        missing = []
        for row in closure['records']:
            if row['path'] not in selected[prefix]:
                missing.append({'from':row['path'],'kind':'optionalDependencies','name':row['path'],'range':row['record']['version'],'reason':'incompatible_platform'})
        for edge in closure['edges']:
            if not edge['followed']:
                missing.append({key:edge[key] for key in ('from','kind','name','range')}|{'reason':'absent_optional_peer'})
        missing.sort(key=lambda row:(row['from'],row['kind'],row['name']))
        absent_pin = add(prefix+'-OPTIONAL-ABSENCES.json',{'schema':'ci-install-absences/1','rows':missing})
        rows=[]
        for name in sorted(selected[prefix]):
            value=json.loads((root/name/'package.json').read_text())
            rows.append({'path':name,'name':value['name'],'version':value['version'],'package_json':pinned((root/name/'package.json').read_bytes()),'lock_path':name})
        package_pin=add(prefix+'-PACKAGE-METADATA.json',{'schema':'ci-installed-packages/1','rows':rows})
        hidden=(root/'node_modules/.package-lock.json').read_bytes();records[prefix+'-HIDDEN-LOCK.json']=hidden
        setting=p['build_install' if build_role else 'evaluation_install']
        tool=lambda version:{'version':version,'executable_sha256':'d'*64}
        profile=add(prefix+'-PROFILE.json',{'schema':'ci-install-profile/1','profile_id':'desk-full-build/1' if build_role else 'desk-evaluation-runtime/1',
            'producer_id':p['producer'],'source':common,'manifest':p['manifest'],'lock':p['lock'],'roots':closure['roots'],'omit':setting['omit'],
            'install_argv':setting['argv'],'node':tool('24.21.0'),'npm':tool('11.19.0'),'platform':{'os':'linux','arch':'x64','libc':'glibc'},'closure':closure_pin,'optional_absences':absent_pin})
        invocation=add(prefix+'-INSTALL-INVOCATION.json',{'schema':'ci-npm-invocation/1','source':common,'profile_policy_sha256':l,'argv':owner.installation_argv(setting,'build' if build_role else 'evaluation',ledger_base),
            'cwd':str(role),'node_sha256':'d'*64,'npm_sha256':'d'*64,'environment_policy_sha256':hashlib.sha256(encoded({'policy':'private-official-npm/1','role':'build' if build_role else 'evaluation'})).hexdigest(),'exit':0,
            'stdout':raw_model,'stderr':raw_model,'owner_raw':raw_model})
        settlement_pin=add(prefix+'-INSTALL-SETTLEMENT.json',settlement())
        add(prefix+'-INSTALL.json',{'schema':'ci-installation/1','source':common,'profile':profile,'checkout':observed(root,role),
            'modules':observed(root/'node_modules',role/'node_modules'),'source_graph':source_pin,'tools_graph':tool_pin,'package_metadata':package_pin,
            'hidden_lock':pinned(hidden),'invocation':invocation,'settlement':settlement_pin})
    dist_value={'schema':'ci-dist-content/1','rows':{'':{'type':'directory','mode':448},'index.js':{'type':'file','mode':384,'bytes':0,'sha256':hashlib.sha256(b'').hexdigest()}},
        'legacy_summary':{'files':1,'digest':'f'*64}}
    dist_pin=add('DIST-INVENTORY.json',dist_value)
    gates=[]
    for gate in q['gates']:
        gates.append({'name':gate['name'],'argv':[value.replace('<BUILD_CI_TMP>',str(Path(ledger_base).parent.parent/'build/ci/tmp')) for value in gate['argv']],'exit':0,'stdout':raw_model,'stderr':raw_model,'result':raw_model,
            'source_before':pinned(records['BUILD-SOURCE-INVENTORY.json']),'source_after':pinned(records['BUILD-SOURCE-INVENTORY.json']),
            'tools_before':pinned(records['BUILD-TOOLS-INVENTORY.json']),'tools_after':pinned(records['BUILD-TOOLS-INVENTORY.json'])})
    quality_settlement=add('QUALITY-SETTLEMENT.json',settlement())
    quality_pin=add('QUALITY.json',{'schema':'ci-build-quality/1','source':common,'build_profile':pinned(records['BUILD-PROFILE.json']),
        'build_installation':pinned(records['BUILD-INSTALL.json']),'policy_sha256':q_hash,'gates':gates,'dist_graph':dist_pin,
        'build_root':observed(build,logical_roots['BUILD']),'settlement':quality_settlement})
    source_dist=observed(build,logical_roots['BUILD']/'dist');target_dist=observed(checkout,logical_roots['EVAL']/'dist')
    copy=add('COPY-RESULT.json',{'schema':'ci-dist-copy/1','source_root':source_dist,'destination_root':target_dist,'source_before':dist_pin,'source_after':dist_pin,
        'destination_graph':dist_pin,'files':1,'directories':1,'totalbytes':0,'source_identity_before':source_dist,'source_identity_after':source_dist,
        'destination_identity_before':target_dist,'destination_identity_after':target_dist,'complete':True,'owner_raw':raw_model})
    transfer_settlement=add('TRANSFER-SETTLEMENT.json',settlement())
    transfer=add('TRANSFER.json',{'schema':'ci-build-transfer/1','source':common,'quality':quality_pin,'build_installation':pinned(records['BUILD-INSTALL.json']),
        'evaluation_installation':pinned(records['EVAL-INSTALL.json']),'producer_root':observed(build,logical_roots['BUILD']),
        'consumer_root':observed(checkout,logical_roots['EVAL']),'dist_graph':dist_pin,'copy_result':copy,'settlement':transfer_settlement})
    add('PROVENANCE.json',{'schema':'ci-evaluation-provenance/1','source':common,'profile_policy_sha256':l,'quality_policy_sha256':q_hash,
        'evaluation_profile':pinned(records['EVAL-PROFILE.json']),'evaluation_installation':pinned(records['EVAL-INSTALL.json']),
        'quality':quality_pin,'transfer':transfer,'dist_graph':dist_pin})
    return {'records':records,'identity':common,'policies':(p,q,l,q_hash),'build':build,'evaluation':checkout,
            'logical':logical,'synthetic_model_only':True,'usable_admission_capability':False}


@contextmanager
def roles(ci, model):
    """Test-local resource injection; production has no alternate role selector."""
    owner=ci.installation_owner()
    with mock.patch.object(owner,'BUILD',model['build']),mock.patch.object(owner,'EVAL',model['evaluation']), mock.patch.object(owner,'POISON',[]), mock.patch.object(owner,'LEASES',{}), mock.patch.object(owner,'CANCELLED',None),mock.patch.object(owner,'SECONDARY',[]),mock.patch.object(owner,'PENDING_OBJECTS',[]):
        yield model


def bind(ci, base, checkout, *, logical=False):
    """Use the real preparer with a test-local namespace model, never real admission."""
    model = make(ci, checkout, ledger_base=base, logical=logical)
    original_identity = ci.fixture_identity
    def modeled_identity(path, private=True):
        value = original_identity(path, private)
        if logical and Path(path) == Path(checkout):
            value = dict(value, path='/tmp/e')
        return value
    with roles(ci, model), mock.patch.object(ci, 'fixture_identity', modeled_identity):
        binding = ci.fixture_prepare(base, checkout, metadata=model['records'])
    identity2=dict(model['identity'],profile_policy_sha256=model['policies'][2],quality_policy_sha256=model['policies'][3])
    source=ci.fixture_graph(checkout,'source');tests=sorted(name for name,row in source.items() if row['type']=='file')
    wire={'schema':'ci-partition/2','partition':'rest','identity':identity2,'selection':ci.partition_files(tests,'rest'),'counts':list(ci.PARTITION_COUNTS['rest']),
          'execution':execution(ci,identity2,'rest',model['records'])}
    put(Path(base)/'evidence/partition.json',encoded(wire))
    model['partition']='rest'
    return binding, model


def execution(ci, identity2, partition, records=None):
    """Wire model for parser/joint controls, not an authenticated job output."""
    owner = ci.installation_owner();p,q,l,q_hash=owner.policy(ci)
    empty = pinned(encoded({'synthetic_model_only':True,'usable_admission_capability':False}))
    get = lambda name: pinned(records[name]) if records is not None else empty
    quality = json.loads(records['QUALITY.json']) if records is not None else None
    gates = quality['gates'] if quality else [{'name':name,'result':empty} for name in owner.GATES]
    return {'provenance':get('PROVENANCE.json'),'summary':{'schema':'ci-execution-summary/1','partition':partition,'job':'verify-'+partition,
        'identity':identity2,'origin':'transferred','producer':'ci-ordinary-npm-producer/1','build_profile':'desk-full-build/1',
        'evaluation_profile':'desk-evaluation-runtime/1','manifest':p['manifest'],'lock':p['lock'],'build_installation':get('BUILD-INSTALL.json'),
        'evaluation_installation':get('EVAL-INSTALL.json'),'quality':get('QUALITY.json'),'transfer':get('TRANSFER.json'),'dist':get('DIST-INVENTORY.json'),
        'quality_gates':[{'name':row['name'],'exit':0,'result':row['result']} for row in gates],
        'structural_methods_sha256':pinned(encoded(q['structural_methods']))['sha256'],'settled':True}}


def binding(ci, partition, identity, members):
    """Parser/serializer fixture only; no real ROOT, producer or admission is created."""
    common=ci.partition_identity(identity,members)
    return {'schema':'ci-partition/2','partition':partition,'identity':common,
        'selection':ci.partition_files(sorted(members),partition),'counts':list(ci.PARTITION_COUNTS[partition]),
        'execution':execution(ci,common,partition)}


def repin(records):
    """Test-only closed DAG repair, so a semantic mutant reaches its own predicate.

    This is not a producer, receipt repair or admission API. No physical state is
    adopted, and no raw owner success is manufactured by this transformation.
    """
    raw=dict(records)
    def change(name, fields):
        value=json.loads(raw[name])
        for key,target in fields.items():value[key]=pinned(raw[target])
        raw[name]=encoded(value)
    for prefix in ('BUILD','EVAL'):
        source='BUILD-SOURCE-INVENTORY.json' if prefix=='BUILD' else 'SOURCE-INVENTORY.json'
        tools='BUILD-TOOLS-INVENTORY.json' if prefix=='BUILD' else 'TOOLS-INVENTORY.json'
        change(prefix+'-PROFILE.json',{'closure':prefix+'-CLOSURE.json','optional_absences':prefix+'-OPTIONAL-ABSENCES.json'})
        change(prefix+'-INSTALL.json',{'profile':prefix+'-PROFILE.json','source_graph':source,'tools_graph':tools,
            'package_metadata':prefix+'-PACKAGE-METADATA.json','hidden_lock':prefix+'-HIDDEN-LOCK.json',
            'invocation':prefix+'-INSTALL-INVOCATION.json','settlement':prefix+'-INSTALL-SETTLEMENT.json'})
    quality=json.loads(raw['QUALITY.json'])
    for gate in quality['gates']:
        for key in ('source_before','source_after'):gate[key]=pinned(raw['BUILD-SOURCE-INVENTORY.json'])
        for key in ('tools_before','tools_after'):gate[key]=pinned(raw['BUILD-TOOLS-INVENTORY.json'])
    raw['QUALITY.json']=encoded(quality)
    change('QUALITY.json',{'build_profile':'BUILD-PROFILE.json','build_installation':'BUILD-INSTALL.json','dist_graph':'DIST-INVENTORY.json','settlement':'QUALITY-SETTLEMENT.json'})
    change('COPY-RESULT.json',{'source_before':'DIST-INVENTORY.json','source_after':'DIST-INVENTORY.json','destination_graph':'DIST-INVENTORY.json'})
    change('TRANSFER.json',{'quality':'QUALITY.json','build_installation':'BUILD-INSTALL.json','evaluation_installation':'EVAL-INSTALL.json',
        'dist_graph':'DIST-INVENTORY.json','copy_result':'COPY-RESULT.json','settlement':'TRANSFER-SETTLEMENT.json'})
    change('PROVENANCE.json',{'evaluation_profile':'EVAL-PROFILE.json','evaluation_installation':'EVAL-INSTALL.json','quality':'QUALITY.json','transfer':'TRANSFER.json','dist_graph':'DIST-INVENTORY.json'})
    if 'ADOPTION.json' in raw:
        value=json.loads(raw['ADOPTION.json']);value.update(execution_provenance_bytes=len(raw['PROVENANCE.json']),execution_provenance_sha256=pinned(raw['PROVENANCE.json'])['sha256'])
        raw['ADOPTION.json']=encoded(value)
    return raw
