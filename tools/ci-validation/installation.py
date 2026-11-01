"""Closed BUILD/EVAL producer and /2 provenance checks for foundation-ci.

This module owns no caller-selected profile, path or command. The cooperative
source-owned producer is checked again at every outer admission boundary; the
runtime validator checks its sealed metadata and the complete current EVAL graph.
"""
import hashlib
import json
import math
import os
import re
import stat
from pathlib import Path

BUILD = Path('/tmp/d')
EVAL = Path('/tmp/e')
BINDINGS = tuple(sorted(('ADOPTION.json', 'BUILD-CLOSURE.json', 'BUILD-HIDDEN-LOCK.json',
    'BUILD-INSTALL-INVOCATION.json', 'BUILD-INSTALL-SETTLEMENT.json', 'BUILD-INSTALL.json',
    'BUILD-OPTIONAL-ABSENCES.json', 'BUILD-PACKAGE-METADATA.json', 'BUILD-PROFILE.json',
    'BUILD-SOURCE-INVENTORY.json', 'BUILD-TOOLS-INVENTORY.json', 'COPY-RESULT.json',
    'DIST-INVENTORY.json', 'EVAL-CLOSURE.json', 'EVAL-HIDDEN-LOCK.json',
    'EVAL-INSTALL-INVOCATION.json', 'EVAL-INSTALL-SETTLEMENT.json', 'EVAL-INSTALL.json',
    'EVAL-OPTIONAL-ABSENCES.json', 'EVAL-PACKAGE-METADATA.json', 'EVAL-PROFILE.json',
    'PROVENANCE.json', 'QUALITY-SETTLEMENT.json', 'QUALITY.json', 'RELEASE.json',
    'SOURCE-INVENTORY.json', 'SOURCE-LEDGER.json', 'TOOLS-INVENTORY.json',
    'TRANSFER-SETTLEMENT.json', 'TRANSFER.json')))
POLICY_PATH = 'fixtures/ci-evaluation-installation/INSTALL-POLICY.json'
QUALITY_PATH = 'fixtures/ci-evaluation-installation/QUALITY-POLICY.json'
GATES = ('format', 'lint', 'types', 'build', 'structural')
IDENTITY_KEYS = ('repository', 'run_id', 'run_attempt', 'checkout', 'head', 'tree', 'source_sha256')
D_KEYS = ('path', 'dev', 'ino', 'uid', 'gid', 'mode')
P_KEYS = ('bytes', 'sha256')
HEX = re.compile(r'[0-9a-f]{64}')
GIT = re.compile(r'[0-9a-f]{40}')
_SAFE_PATH = re.compile(r'[A-Za-z0-9_@.+/-]{1,512}')
POISON = []


def refuse(code):
    raise RuntimeError('installation_' + code)


def need(condition, code):
    if not condition:
        refuse(code)


def entry():
    need(CANCELLED is None,'cancelled')
    need(not POISON,'cleanup_pending')
    temp = os.environ.get('RUNNER_TEMP')
    role_temp = os.environ.get('DESK_CI_ROLE_TEMP')
    # Original-cwd retention has no role selector and must retain poisoned roles.
    if temp and role_temp is not None:
        parent = Path(temp)
        need(parent.is_absolute() and str(parent) == temp and parent.resolve() == parent, 'runner_temp')
        need(role_temp in (str(parent / 'build'), str(parent / 'evaluation')), 'role_temp')
        need(not any(os.path.lexists(parent / role / 'ci/evidence/producer/POISON.json') for role in ('build', 'evaluation')), 'persisted_cleanup_pending')


def exact(value, keys):
    need(type(value) is dict and set(value) == set(keys), 'record_shape')
    return value


def uint(value, maximum=9007199254740991):
    need(type(value) is int and 0 <= value <= maximum, 'integer')
    return value


def same(left, right):
    if type(left) is not type(right):
        return False
    if type(left) is dict:
        return set(left) == set(right) and all(same(left[key], right[key]) for key in left)
    if type(left) is list:
        return len(left) == len(right) and all(same(a, b) for a, b in zip(left, right))
    if type(left) is float:
        return math.isfinite(left) and math.isfinite(right) and left == right
    return type(left) in (str, bool, int, type(None)) and left == right


def canonical(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False,
                       allow_nan=False) + '\n').encode()


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def pin(raw):
    return {'bytes': len(raw), 'sha256': digest(raw)}


def parse(raw, limit=262144, canonical_required=True):
    need(type(raw) is bytes and 0 < len(raw) <= limit, 'record_bound')
    def unique(rows):
        value = {}
        for key, item in rows:
            need(key not in value, 'duplicate_key')
            value[key] = item
        return value
    value = json.loads(raw.decode('utf8'), object_pairs_hook=unique,
                       parse_constant=lambda _: refuse('nonfinite'))
    if canonical_required:
        need(canonical(value) == raw, 'noncanonical')
    return value


def validate_envelope(value, operation):
    exact(value,('schema','operation','observed_umask','effective_umask','restriction_only'))
    need(operation in ('producer-build','evaluation-init','bind-build') and value['schema']=='ci-stage-envelope/1' and
         value['operation']==operation and type(value['observed_umask']) is str and
         re.fullmatch(r'0[0-7]{3}',value['observed_umask']) and value['effective_umask']=='0077' and
         value['restriction_only'] is True and int(value['observed_umask'],8)&~0o77==0,'envelope_mask_policy')
    return value


def stage_envelope(operation):
    value={'schema':'ci-stage-envelope/1','operation':os.environ.get('DESK_CI_ENVELOPE_OPERATION'),
        'observed_umask':os.environ.get('DESK_CI_ENVELOPE_OBSERVED_UMASK'),
        'effective_umask':os.environ.get('DESK_CI_ENVELOPE_EFFECTIVE_UMASK'),'restriction_only':True}
    validate_envelope(value,operation)
    need(re.findall(r'^Umask:\s*([0-7]{4})$',Path('/proc/self/status').read_text(),re.M)==['0077'],'envelope_python_inheritance')
    return value


def physical_pin(value, maximum=262144, *, empty=False):
    exact(value,P_KEYS)
    length=uint(value['bytes'],maximum)
    need((empty or length>0) and type(value['sha256']) is str and HEX.fullmatch(value['sha256']),'physical_pin')
    return value


def installation_argv(setting, role, evaluation_ci):
    need(role in ('build','evaluation'),'installation_role')
    evaluation_ci=Path(evaluation_ci)
    need(evaluation_ci.is_absolute() and str(evaluation_ci)==os.path.normpath(evaluation_ci) and
         evaluation_ci.name=='ci' and evaluation_ci.parent.name=='evaluation','evaluation_ledger_path')
    base=evaluation_ci if role=='evaluation' else evaluation_ci.parent.parent/'build/ci'
    return setting['argv']+['--no-audit','--no-fund','--no-update-notifier','--registry=https://registry.npmjs.org/',
        '--strict-ssl=true','--fetch-retries=0','--maxsockets=1','--fetch-timeout=15000',
        '--cache='+str(base/'tmp/npm-cache'),'--userconfig='+str(base/'home/user.npmrc'),'--globalconfig='+str(base/'home/global.npmrc')]


def reference(value, raw, limit=262144, *, empty=False):
    physical_pin(value,limit,empty=empty)
    need(same(value,pin(raw)),'reference')


def path_name(value, package=False):
    need(type(value) is str and _SAFE_PATH.fullmatch(value) and
         all(part not in ('', '.', '..') for part in value.split('/')) and
         '\\' not in value and not value.startswith('/'), 'path')
    if package:
        need(value.startswith('node_modules/') and len(value) > len('node_modules/'), 'package_path')
    return value


def identity(value):
    exact(value, IDENTITY_KEYS)
    for key in ('checkout', 'head', 'tree'):
        need(type(value[key]) is str and GIT.fullmatch(value[key]), 'git_identity')
    for key in ('run_id', 'run_attempt'):
        need(type(value[key]) is str and re.fullmatch(r'[1-9][0-9]{0,19}', value[key]), 'run_identity')
    need(type(value['repository']) is str and
         re.fullmatch(r'[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}', value['repository']), 'repository')
    need(type(value['source_sha256']) is str and HEX.fullmatch(value['source_sha256']), 'source_identity')
    need(len(canonical(value)) <= 2048, 'identity_bound')


def directory(value, expected):
    exact(value, D_KEYS)
    need(value['path'] == str(expected), 'role_root')
    for key in D_KEYS[1:]:
        uint(value[key])
    need(value['mode'] == 0o700, 'directory_mode')


def source_identity(ctx, members):
    event = ctx.load_event()
    head = (event.get('pull_request') or {}).get('head', {}).get('sha')
    errors, facts = ctx.check_identity(dict(os.environ), event, ctx.collect_git(head))
    need(not errors and os.environ.get('GITHUB_EVENT_NAME') == 'pull_request', 'authenticated_source')
    value = {key: facts[key] for key in ('repository', 'run_id', 'run_attempt')}
    value.update(checkout=facts['checkout_head'], head=facts['pr_head_sha'],
                 tree=facts['checkout_tree'], source_sha256=digest(canonical(members)))
    identity(value)
    return value


def policy(ctx):
    """Read authored policies, never derive authority from current host success."""
    entry()
    p_raw = ctx.fixture_read(ctx.ROOT / POLICY_PATH, 65536, False)
    q_raw = ctx.fixture_read(ctx.ROOT / QUALITY_PATH, 65536, False)
    p, q = parse(p_raw, 65536), parse(q_raw, 65536)
    exact(p, ('schema', 'producer', 'profile', 'manifest', 'lock', 'application_roots',
        'evaluation_roots', 'build_only_roots', 'platform_policy', 'evaluation_install',
        'build_install', 'evaluation_closure', 'build_closure', 'optional_peer_policy', 'module_policy'))
    exact(q, ('schema', 'install_policy_sha256', 'gate_order', 'gates', 'configuration',
              'structural_methods', 'build_contract', 'settlement_policy'))
    need(p['schema'] == 'ci-evaluation-install-policy/1' and p['producer'] == 'ci-ordinary-npm-producer/1' and
         p['profile'] == 'desk-evaluation-runtime/1', 'policy_profile')
    need(same(p['platform_policy'],{'os':'linux','arch':'x64','libc':'glibc','node':'24.21.0','npm':'11.19.0','selection':'npm-lock-platform-and-peer-admission/1'}) and
         p['optional_peer_policy']=='preserve-declared-unsatisfied-no-name-only-substitution/1' and
         p['module_policy']=='own-complete-evaluation-root-no-ancestor-or-global-fallback/1','logical_policy')
    for role in ('build','evaluation'):
        setting=p[role+'_install']
        need(same(setting,{'argv':['npm','ci']+(['--omit=dev'] if role=='evaluation' else [])+['--ignore-scripts'],
            'omit':['dev'] if role=='evaluation' else [],'lifecycle_scripts':False,'registry':'https://registry.npmjs.org/',
            'tls_certificate_verification':True,'retries':0}),'literal_install_policy')
    manifest=parse(ctx.fixture_read(ctx.ROOT/'package.json',262144,False),canonical_required=False)
    evaluation_names={'@types/node','@types/pg','tsx','typescript','vitest'}
    need(p['application_roots']==[{'name':name,'version':version} for name,version in sorted(manifest['dependencies'].items()) if name not in evaluation_names] and
         p['evaluation_roots']==[{'name':name,'version':version} for name,version in sorted(manifest['dependencies'].items()) if name in evaluation_names] and
         p['build_only_roots']==[{'name':name,'version':version} for name,version in sorted(manifest['devDependencies'].items())] and
         len(p['application_roots'])==7 and len(p['evaluation_roots'])==5 and len(p['build_only_roots'])==5,'literal_root_roles')
    l = digest(b'THE-DESK/EVALUATION-INSTALL-POLICY/1\n' + p_raw)
    q_hash = digest(b'THE-DESK/BUILD-QUALITY-POLICY/1\n' + q_raw)
    need(q['schema'] == 'ci-build-quality-policy/1' and q['install_policy_sha256'] == l and
         q['gate_order'] == list(GATES) and len(q['gates']) == 5 and
         len(q['structural_methods']) == 157 and q['structural_methods'] == sorted(set(q['structural_methods'])), 'quality_policy')
    for name, ref in [('package.json', p['manifest']), ('package-lock.json', p['lock'])]:
        reference(ref, ctx.fixture_read(ctx.ROOT / name, 262144, False))
    for row in q['configuration']:
        exact(row, ('path', 'bytes', 'sha256'))
        reference({key: row[key] for key in P_KEYS}, ctx.fixture_read(ctx.ROOT / path_name(row['path']), 262144, False))
    need([row['path'] for row in q['configuration']] == sorted(('.node-version', '.npmrc', '.prettierignore',
         'eslint.config.js', 'tsconfig.build.json', 'tsconfig.json', 'vitest.config.ts')), 'configuration_population')
    for prefix,key in (('BUILD','build_closure'),('EVAL','evaluation_closure')):
        reference(p[key],ctx.fixture_read(ctx.ROOT/('fixtures/ci-evaluation-installation/'+prefix+'-CLOSURE.json'),262144,False))
    return p, q, l, q_hash


def validate_metadata(raw, source, tools, expected_identity, policies, *, ledger_base, preseal_provenance=None):
    """Pure independent Python DAG checker. Full raw/payload checking belongs to outer()."""
    entry()
    expected = set(BINDINGS) if preseal_provenance is None else set(BINDINGS) - {'ADOPTION.json', 'RELEASE.json', 'SOURCE-LEDGER.json', 'PROVENANCE.json'}
    need(set(raw) == expected, 'binding_population')
    objects = {name: parse(data, record_limit(name),
                           canonical_required='HIDDEN-LOCK' not in name) for name, data in raw.items()}
    if preseal_provenance is not None:
        objects['PROVENANCE.json'] = preseal_provenance
    p, q, l, q_hash = policies
    identity(expected_identity)
    def obj(name, keys, schema=None):
        value = exact(objects[name], keys)
        if schema is not None:
            need(value['schema'] == schema, 'schema')
        return value
    def ref(value, name):
        reference(value, raw[name], record_limit(name))
    def sourced(value):
        need(same(value['source'], expected_identity), 'foreign_source')
    def settlement(name):
        v = obj(name, ('schema', 'stdout_eof', 'stderr_eof', 'direct_reaped', 'group_empty',
            'discovery_complete', 'owned_pending', 'primary', 'cleanup', 'cancelled', 'owner_raw'), 'ci-owned-settlement/1')
        physical_pin(v['owner_raw'])
        need(all(v[key] is True for key in ('stdout_eof', 'stderr_eof', 'direct_reaped', 'group_empty', 'discovery_complete')) and
             v['owned_pending'] == [] and v['primary'] is None and v['cleanup'] == [] and v['cancelled'] is False, 'unsettled')
    for prefix, role, own_source, own_tools in [('BUILD', BUILD, 'BUILD-SOURCE-INVENTORY.json', 'BUILD-TOOLS-INVENTORY.json'),
                                               ('EVAL', EVAL, 'SOURCE-INVENTORY.json', 'TOOLS-INVENTORY.json')]:
        profile = obj(prefix + '-PROFILE.json', ('schema', 'profile_id', 'producer_id', 'source', 'manifest', 'lock',
            'roots', 'omit', 'install_argv', 'node', 'npm', 'platform', 'closure', 'optional_absences'), 'ci-install-profile/1')
        sourced(profile)
        need(profile['profile_id'] == ('desk-full-build/1' if prefix == 'BUILD' else 'desk-evaluation-runtime/1') and
             profile['producer_id'] == p['producer'] and profile['manifest'] == p['manifest'] and profile['lock'] == p['lock'], 'profile')
        setting = p['build_install' if prefix == 'BUILD' else 'evaluation_install']
        need(profile['omit'] == setting['omit'] and profile['install_argv'] == setting['argv'] and
             profile['platform'] == {'os': 'linux', 'arch': 'x64', 'libc': 'glibc'}, 'platform_or_install')
        roots = sorted(p['application_roots'] + p['evaluation_roots'] + (p['build_only_roots'] if prefix == 'BUILD' else []), key=lambda row: row['name'])
        need(same(profile['roots'], roots), 'role_roots')
        for tool, version in [('node', '24.21.0'), ('npm', '11.19.0')]:
            exact(profile[tool], ('version', 'executable_sha256'))
            need(profile[tool]['version'] == version and HEX.fullmatch(profile[tool]['executable_sha256']), 'tool')
        ref(profile['closure'], prefix + '-CLOSURE.json')
        need(profile['closure'] == p['build_closure' if prefix == 'BUILD' else 'evaluation_closure'], 'closure_policy')
        ref(profile['optional_absences'], prefix + '-OPTIONAL-ABSENCES.json')
        closure = obj(prefix + '-CLOSURE.json', ('schema', 'roots', 'records', 'edges'), 'ci-install-closure/1')
        need(closure['roots'] == roots, 'closure_roots')
        paths = [path_name(row['path'], True) for row in closure['records']]
        need(paths == sorted(set(paths)), 'closure_population')
        for row in closure['records']:
            exact(row, ('path', 'record'))
            need(type(row['record']) is dict, 'locked_record')
        absences = obj(prefix + '-OPTIONAL-ABSENCES.json', ('schema', 'rows'), 'ci-install-absences/1')
        metadata = obj(prefix + '-PACKAGE-METADATA.json', ('schema', 'rows'), 'ci-installed-packages/1')
        rows = metadata['rows']; need(type(rows) is list and len(rows) <= 512, 'package_count')
        names = [path_name(row['path'], True) for row in rows]
        need(names == sorted(set(names)) and set(names) <= set(paths), 'package_population')
        graph = objects[own_tools]
        hidden = objects[prefix + '-HIDDEN-LOCK.json']
        exact(hidden,('name','version','lockfileVersion','requires','packages'))
        need(hidden['name']=='the-desk' and hidden['version']=='0.1.0' and type(hidden['lockfileVersion']) is int and hidden['lockfileVersion']==3 and hidden['requires'] is True,'hidden_envelope')
        need(type(hidden['packages']) is dict and set(hidden['packages']) == set(names), 'hidden_population')
        hidden_leaf=graph.get('.package-lock.json')
        need(type(hidden_leaf) is dict and hidden_leaf.get('type')=='file' and
             pin(raw[prefix+'-HIDDEN-LOCK.json'])=={key:hidden_leaf[key] for key in P_KEYS},'hidden_graph_binding')
        records = {row['path']: row['record'] for row in closure['records']}
        absent_paths = set()
        for absence in absences['rows']:
            exact(absence, ('from','kind','name','range','reason'))
            need(absence['reason'] in ('incompatible_platform','absent_optional_peer'), 'absence_reason')
            if absence['reason'] == 'incompatible_platform':
                missing = records.get(absence['from']);need(missing is not None and missing.get('optional') is True, 'absent_locked_record');absent_paths.add(absence['from'])
        expected_absences=[]
        for location,locked in records.items():
            if location not in names:
                need(locked.get('optional') is True and any(type(locked.get(key)) is list and target not in locked[key]
                    for key,target in (('os','linux'),('cpu','x64'),('libc','glibc'))), 'platform_omission')
                expected_absences.append({'from':location,'kind':'optionalDependencies','name':location,'range':locked['version'],'reason':'incompatible_platform'})
        for edge in closure['edges']:
            exact(edge,('from','kind','name','range','optional','followed','resolved_current_path'))
            need(all(type(edge[key]) is str for key in ('from','kind','name','range')) and type(edge['optional']) is bool and type(edge['followed']) is bool,'edge_types')
            if edge['followed'] is False:
                need(edge['optional'] is True and edge['resolved_current_path'] is None,'optional_edge')
                expected_absences.append({key:edge[key] for key in ('from','kind','name','range')}|{'reason':'absent_optional_peer'})
            else:
                need(edge['resolved_current_path'] in records,'edge_target')
        expected_absences.sort(key=lambda row:(row['from'],row['kind'],row['name']))
        need(same(absences['rows'],expected_absences),'absence_population')
        need(set(names) == set(paths) - absent_paths, 'complete_selected_packages')
        for row in rows:
            exact(row, ('path', 'name', 'version', 'package_json', 'lock_path'))
            need(row['path'] == row['lock_path'] and type(row['name']) is str and row['version'] == records[row['path']]['version'], 'package_identity')
            relative = row['path'][len('node_modules/'):] + '/package.json'
            leaf = graph.get(relative)
            physical_pin(row['package_json'])
            need(type(leaf) is dict and leaf.get('type') == 'file' and row['package_json'] == {'bytes': leaf['bytes'], 'sha256': leaf['sha256']}, 'package_graph_pin')
            need(same(hidden['packages'][row['path']], records[row['path']]), 'hidden_record')
        installation = obj(prefix + '-INSTALL.json', ('schema', 'source', 'profile', 'checkout', 'modules',
            'source_graph', 'tools_graph', 'package_metadata', 'hidden_lock', 'invocation', 'settlement'), 'ci-installation/1')
        sourced(installation); directory(installation['checkout'], role); directory(installation['modules'], role / 'node_modules')
        if prefix == 'EVAL':
            need(installation['checkout'] == observed_directory(EVAL) and installation['modules'] == observed_directory(EVAL / 'node_modules'), 'physical_evaluation_identity')
        for key, name in [('profile', prefix + '-PROFILE.json'), ('source_graph', own_source), ('tools_graph', own_tools),
            ('package_metadata', prefix + '-PACKAGE-METADATA.json'), ('hidden_lock', prefix + '-HIDDEN-LOCK.json'),
            ('invocation', prefix + '-INSTALL-INVOCATION.json'), ('settlement', prefix + '-INSTALL-SETTLEMENT.json')]:
            ref(installation[key], name)
        invocation = obj(prefix + '-INSTALL-INVOCATION.json', ('schema', 'source', 'profile_policy_sha256', 'argv', 'cwd',
            'node_sha256', 'npm_sha256', 'environment_policy_sha256', 'exit', 'stdout', 'stderr', 'owner_raw'), 'ci-npm-invocation/1')
        sourced(invocation)
        need(invocation['profile_policy_sha256'] == l and invocation['cwd'] == str(role) and type(invocation['exit']) is int and invocation['exit'] == 0 and
             invocation['node_sha256'] == profile['node']['executable_sha256'] and invocation['npm_sha256'] == profile['npm']['executable_sha256'], 'invocation')
        for key in ('stdout','stderr'):physical_pin(invocation[key],8388608,empty=True)
        physical_pin(invocation['owner_raw'])
        need(same(invocation['argv'],installation_argv(setting,'build' if prefix=='BUILD' else 'evaluation',ledger_base)) and
             invocation['environment_policy_sha256']==digest(canonical({'policy':'private-official-npm/1','role':'build' if prefix=='BUILD' else 'evaluation'})),'invocation_policy')
        settlement(prefix + '-INSTALL-SETTLEMENT.json')
        need(same(objects[prefix+'-INSTALL-SETTLEMENT.json']['owner_raw'],invocation['owner_raw']),'install_raw_owner_equality')
    quality = obj('QUALITY.json', ('schema', 'source', 'build_profile', 'build_installation', 'policy_sha256', 'gates', 'dist_graph', 'build_root', 'settlement'), 'ci-build-quality/1')
    sourced(quality); directory(quality['build_root'], BUILD)
    need(same(quality['build_root'],objects['BUILD-INSTALL.json']['checkout']),'quality_root_identity')
    need(quality['policy_sha256'] == q_hash and len(quality['gates']) == 5, 'quality_policy')
    ref(quality['build_profile'], 'BUILD-PROFILE.json'); ref(quality['build_installation'], 'BUILD-INSTALL.json')
    for row, expected in zip(quality['gates'], q['gates']):
        exact(row, ('name', 'argv', 'exit', 'stdout', 'stderr', 'result', 'source_before', 'source_after', 'tools_before', 'tools_after'))
        need(row['name']==expected['name'] and type(row['exit']) is int and row['exit']==0 and
             same(row['argv'],gate_argv(expected,Path(ledger_base).parent.parent/'build/ci')),'quality_gate')
        for key in ('stdout','stderr'):physical_pin(row[key],8388608,empty=True)
        physical_pin(row['result'])
        for key, file in [('source_before', 'BUILD-SOURCE-INVENTORY.json'), ('source_after', 'BUILD-SOURCE-INVENTORY.json'),
                          ('tools_before', 'BUILD-TOOLS-INVENTORY.json'), ('tools_after', 'BUILD-TOOLS-INVENTORY.json')]:
            ref(row[key], file)
    ref(quality['dist_graph'], 'DIST-INVENTORY.json');ref(quality['settlement'], 'QUALITY-SETTLEMENT.json');settlement('QUALITY-SETTLEMENT.json')
    dist = obj('DIST-INVENTORY.json', ('schema', 'rows', 'legacy_summary'), 'ci-dist-content/1')
    need(type(dist['rows']) is dict and '' in dist['rows'] and len(dist['rows']) <= 20000, 'dist_population')
    for name, row in dist['rows'].items():
        if name:
            path_name(name)
        if row.get('type') == 'directory':
            exact(row, ('type', 'mode'))
        else:
            exact(row, ('type', 'mode', 'bytes', 'sha256'))
            need(row['type'] == 'file' and HEX.fullmatch(row['sha256']), 'dist_leaf');uint(row['bytes'], 67108864)
        uint(row['mode'], 0o777)
    exact(dist['legacy_summary'], ('files', 'digest'));uint(dist['legacy_summary']['files'], 20000)
    need(HEX.fullmatch(dist['legacy_summary']['digest']), 'dist_summary')
    transfer = obj('TRANSFER.json', ('schema', 'source', 'quality', 'build_installation', 'evaluation_installation',
        'producer_root', 'consumer_root', 'dist_graph', 'copy_result', 'settlement'), 'ci-build-transfer/1')
    sourced(transfer);directory(transfer['producer_root'], BUILD);directory(transfer['consumer_root'], EVAL)
    need(same(transfer['producer_root'],objects['BUILD-INSTALL.json']['checkout']) and same(transfer['consumer_root'],objects['EVAL-INSTALL.json']['checkout']),'transfer_root_identity')
    for key, name in [('quality', 'QUALITY.json'), ('build_installation', 'BUILD-INSTALL.json'), ('evaluation_installation', 'EVAL-INSTALL.json'),
                      ('dist_graph', 'DIST-INVENTORY.json'), ('copy_result', 'COPY-RESULT.json'), ('settlement', 'TRANSFER-SETTLEMENT.json')]:ref(transfer[key], name)
    settlement('TRANSFER-SETTLEMENT.json')
    copied = obj('COPY-RESULT.json', ('schema', 'source_root', 'destination_root', 'source_before', 'source_after', 'destination_graph',
        'files', 'directories', 'totalbytes', 'source_identity_before', 'source_identity_after', 'destination_identity_before',
        'destination_identity_after', 'complete', 'owner_raw'), 'ci-dist-copy/1')
    directory(copied['source_root'], BUILD / 'dist');directory(copied['destination_root'], EVAL / 'dist')
    for key in ('source_before', 'source_after', 'destination_graph'):ref(copied[key], 'DIST-INVENTORY.json')
    physical_pin(copied['owner_raw'])
    for key in ('files','directories','totalbytes'):uint(copied[key],20000 if key!='totalbytes' else 9007199254740991)
    for key in ('source_identity_before','source_identity_after'):directory(copied[key],BUILD/'dist')
    for key in ('destination_identity_before','destination_identity_after'):directory(copied[key],EVAL/'dist')
    need(copied['complete'] is True and copied['source_root'] == copied['source_identity_before'] == copied['source_identity_after'] and
         copied['destination_root'] == copied['destination_identity_before'] == copied['destination_identity_after'], 'copy_identity')
    need(copied['files'] == sum(row['type'] == 'file' for row in dist['rows'].values()) and
         copied['directories'] == sum(row['type'] == 'directory' for row in dist['rows'].values()) and
         copied['totalbytes'] == sum(row.get('bytes', 0) for row in dist['rows'].values()), 'copy_counts')
    provenance = obj('PROVENANCE.json', ('schema', 'source', 'profile_policy_sha256', 'quality_policy_sha256', 'evaluation_profile',
        'evaluation_installation', 'quality', 'transfer', 'dist_graph'), 'ci-evaluation-provenance/1')
    sourced(provenance);need(provenance['profile_policy_sha256'] == l and provenance['quality_policy_sha256'] == q_hash, 'foreign_policy')
    for key, name in [('evaluation_profile', 'EVAL-PROFILE.json'), ('evaluation_installation', 'EVAL-INSTALL.json'),
                      ('quality', 'QUALITY.json'), ('transfer', 'TRANSFER.json'), ('dist_graph', 'DIST-INVENTORY.json')]:ref(provenance[key], name)
    need(same(objects['BUILD-SOURCE-INVENTORY.json'], objects['SOURCE-INVENTORY.json']), 'source_role_equality')
    need(same(source, objects['SOURCE-INVENTORY.json']) and same(tools, objects['TOOLS-INVENTORY.json']), 'evaluation_payload')
    return objects


class Owned:
    """Register before stat; a close attempt is never repeated after uncertainty."""
    def __init__(self):
        self.fds = []
        self.primary = None
        self.cleanup = []

    def open(self, path, directory=False, flags=None, parent=None):
        entry()
        if parent is not None:
            fd = os.open(path, flags, 0o600, dir_fd=parent)
            self.fds.append(fd)
            return fd
        path = Path(path)
        need(path.is_absolute() and str(path) == os.path.normpath(path) and '..' not in path.parts, 'absolute_path')
        fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        self.fds.append(fd)
        for index, part in enumerate(path.parts[1:]):
            mode = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
            if directory or index < len(path.parts) - 2:
                mode |= os.O_DIRECTORY
            child = os.open(part, mode, dir_fd=fd)
            self.fds.append(child)
            self.close(fd)
            fd = child
        return fd

    def close(self, fd):
        need(fd in self.fds, 'unowned_close')
        self.fds.remove(fd)
        try:
            os.close(fd)
        except BaseException as error:
            POISON.append({'resource': 'descriptor', 'fd': fd, 'error': type(error).__name__})
            self.cleanup.append(error)
            raise

    def finish(self, primary=None):
        for fd in self.fds[:][::-1]:
            try:
                self.close(fd)
            except BaseException as error:
                if primary is None:
                    primary = error
        if primary is not None:
            raise primary


def metadata(info):
    return tuple(getattr(info, key) for key in ('st_dev', 'st_ino', 'st_uid', 'st_gid',
        'st_mode', 'st_nlink', 'st_size', 'st_mtime_ns', 'st_ctime_ns'))


def read(path, limit, private=True, expected_uid=None):
    entry(); owned = Owned(); value = None; primary = None
    try:
        fd = owned.open(path); before = os.fstat(fd)
        need(stat.S_ISREG(before.st_mode) and before.st_uid == (os.getuid() if expected_uid is None else expected_uid) and before.st_nlink == 1 and
             (not private or before.st_mode & 0o777 == 0o600) and before.st_size <= limit, 'leaf_owner_bound')
        blocks = []; count = 0
        while count <= limit:
            block = os.read(fd, min(65536, limit + 1 - count))
            if not block:
                break
            blocks.append(block); count += len(block)
        value = b''.join(blocks)
        need(len(value) == before.st_size and metadata(before) == metadata(os.fstat(fd)), 'leaf_stability')
    except BaseException as error:
        primary = error
    owned.finish(primary)
    return value


def observed_directory(path, private=True):
    entry();need(type(private) is bool, 'directory_private')
    owned = Owned(); result = None; primary = None
    try:
        fd = owned.open(path, True); info = os.fstat(fd)
        need(stat.S_ISDIR(info.st_mode) and info.st_uid == os.getuid() and
             (info.st_mode & 0o777 == 0o700 if private else not info.st_mode & 0o022), 'directory_owner')
        result = dict(path=str(path), dev=info.st_dev, ino=info.st_ino, uid=info.st_uid,
                      gid=info.st_gid, mode=info.st_mode & 0o777)
    except BaseException as error:
        primary = error
    owned.finish(primary)
    return result


def write(path, raw, limit=262144):
    entry(); need(type(raw) is bytes and len(raw) <= limit, 'write_bound')
    owned = Owned(); primary = None
    try:
        parent = owned.open(Path(path).parent, True)
        parent_info = os.fstat(parent)
        need(parent_info.st_uid == os.getuid() and parent_info.st_mode & 0o022 == 0, 'output_parent_owner')
        fd = owned.open(Path(path).name, flags=os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, parent=parent)
        need(os.fstat(fd).st_nlink == 1, 'output_nlink')
        offset = 0
        while offset < len(raw):
            count = os.write(fd, raw[offset:offset + 65536]); need(count > 0, 'short_write'); offset += count
        os.fsync(fd); owned.close(fd); os.fsync(parent)
    except BaseException as error:
        primary = error
    owned.finish(primary)
    return pin(raw)


def graph(base, kind):
    """Independent fresh chains; each row belongs to a stable descriptor/edge."""
    entry();base=Path(base);rows={}
    need(base.is_absolute() and str(base)==os.path.normpath(base) and base.resolve(strict=True)==base,'graph_root_path')
    def visit(path,relative):
        entry();need(len(rows)<20000 and len(relative)<=512,'graph_limit')
        lease=Owned();primary=None
        try:
            parent=lease.open(path.parent,True);parent_before=os.fstat(parent)
            need(parent_before.st_uid==os.getuid() or not relative,'graph_parent_owner')
            info=os.stat(path.name,dir_fd=parent,follow_symlinks=False)
            need(info.st_uid==os.getuid() and info.st_gid==os.getgid(),'graph_owner')
            if stat.S_ISLNK(info.st_mode):
                need(kind=='tools' and info.st_nlink==1,'graph_link_shape')
                target=os.readlink(path.name,dir_fd=parent)
                need(not os.path.isabs(target),'graph_link_absolute')
                resolved=(path.parent/target).resolve(strict=True)
                need(resolved!=base and base in resolved.parents,'graph_link_containment')
                after=os.stat(path.name,dir_fd=parent,follow_symlinks=False)
                need(metadata(info)==metadata(after) and os.readlink(path.name,dir_fd=parent)==target and
                     (path.parent/target).resolve(strict=True)==resolved,'graph_link_changed')
                rows[relative]={'type':'symlink','mode':stat.S_IMODE(info.st_mode),'target':target}
            else:
                need(not info.st_mode&0o022,'graph_writable')
                directory=stat.S_ISDIR(info.st_mode)
                need(directory or stat.S_ISREG(info.st_mode) and info.st_nlink==1,'graph_special_or_hardlink')
                fd=lease.open(path,directory);before=os.fstat(fd)
                need(metadata(info)==metadata(before),'graph_edge_descriptor')
                if directory:
                    rows[relative]={'type':'directory','mode':stat.S_IMODE(before.st_mode)}
                    names=[]
                    with os.scandir(fd) as scan:
                        for item in scan:
                            need(len(names)<20000,'graph_directory_bound');names.append(item.name)
                    for name in sorted(names):
                        if not relative and name in (('.git','node_modules','dist') if kind=='source' else ('.vite-temp',) if kind=='tools' else ()):
                            continue
                        visit(path/name,relative+'/'+name if relative else name)
                else:
                    need(before.st_size<=67108864,'graph_file_bound')
                    h=hashlib.sha256();count=0
                    while count<=67108864:
                        block=os.read(fd,min(65536,67108865-count))
                        if not block:break
                        count+=len(block);h.update(block)
                    need(count==before.st_size,'graph_file_length')
                    rows[relative]={'type':'file','mode':stat.S_IMODE(before.st_mode),'bytes':count,'sha256':h.hexdigest()}
                need(metadata(before)==metadata(os.fstat(fd)) and
                     metadata(info)==metadata(os.stat(path.name,dir_fd=parent,follow_symlinks=False)),'graph_descriptor_or_edge_changed')
            parent_after=os.fstat(parent)
            # /tmp or other shared ancestry outside the graph is not held to
            # whole-duration sibling namespace stability. Its designated edge is.
            need((metadata(parent_before)==metadata(parent_after)) if relative else
                 metadata(parent_before)[:5]==metadata(parent_after)[:5],'graph_parent_changed')
        except BaseException as error:
            primary=error
        lease.finish(primary)
    visit(base,'')
    need(len(canonical(rows))<=4194304,'graph_record_bound')
    return rows


def dist(ctx, root):
    rows = graph(root / 'dist', 'dist')
    snap = ctx.take_snapshot(ctx.tracked_files(), root=root, allow_dist=True)
    need(not ctx.snapshot_errors(snap, require_dist=True), 'dist_snapshot')
    return {'schema': 'ci-dist-content/1', 'rows': rows, 'legacy_summary': snap['dist']}


def role_base(ctx, role):
    """Fixed same-job ledgers; no arbitrary role/path or caller JSON routing."""
    need(role in ('build', 'evaluation'), 'role')
    original = os.environ.get('RUNNER_TEMP')
    need(type(original) is str and bool(original), 'runner_temp')
    runner = Path(original)
    need(runner.is_absolute() and str(runner) == original and runner.resolve() == runner, 'runner_temp')
    # Each role has a disjoint subtree selected by workflow; evaluation must not
    # inherit a BUILD cwd or module cache.
    current = 'build' if ctx.ROOT == BUILD else 'evaluation' if ctx.ROOT == EVAL else None
    temporary = os.environ.get('DESK_CI_ROLE_TEMP')
    need(current is not None and type(temporary) is str and
         temporary == str(runner / current) and Path(temporary).resolve() == Path(temporary), 'role_temp')
    return runner / role / 'ci'


def raw_pin(path, maximum=8388608):
    return pin(read(path, maximum))


def check_raw_settlement(value):
    need(type(value['exit']) is int and value['exit'] == 0 and value['direct_reaped'] is True and value['settlement'] == 'complete' and
         same(value['population'], {'complete': True, 'members': [], 'children': [], 'errors': []}) and
         value['cleanup_errors'] == [] and type(value['spawn_attempts']) is int and value['spawn_attempts'] == 1 and
         all(row['eof'] is True and row['complete'] is True and not row['truncated'] and
             row['observed_bytes'] == row['retained_bytes'] for row in value['streams'].values()), 'raw_process_settlement')


def attempt_finalization(ctx, role, expected_source, expected_tools, expected_root, baseline, *, installing=False, building=False, transferring=False):
    """Safe independent after-attempt observations, including partial failures.

    A partial installation/output is observed, never adopted as successful state.
    A poisoned-close barrier forbids new ordinary I/O; that is an unknown result.
    """
    try:entry()
    except BaseException as error:
        detail={'phase':'attempt:entry','code':str(error) if type(error) is RuntimeError else type(error).__name__}
        return {'role':role,'installing':installing,'building':building,'transferring':transferring,
            'checks':[{'name':name,'status':'unknown_or_failed','code':detail['code']} for name in ('root','source','tools','dist','cache')],
            'secondary':[detail],'complete':False}
    root=BUILD if role=='build' else EVAL;base=role_base(ctx,role)
    checks=[];errors=[]
    def observe(name,work):
        try:
            checks.append({'name':name,'status':'checked','facts':work()})
        except BaseException as error:
            detail={'phase':'attempt:'+name,'code':str(error) if type(error) is RuntimeError else type(error).__name__}
            errors.append(detail);checks.append({'name':name,'status':'unknown_or_failed','code':detail['code']})
    def root_check():
        current=observed_directory(root);need(same(current,expected_root),'attempt_root_changed');return current
    def source_check():
        current=graph(root,'source');need(same(current,expected_source),'attempt_source_changed');return pin(canonical(current))
    def tools_check():
        entry()
        if not os.path.lexists(root/'node_modules'):
            need(installing,'attempt_modules_missing');return {'state':'absent_partial_install','admitted':False}
        current=graph(root/'node_modules','tools')
        if expected_tools is not None:need(same(current,expected_tools),'attempt_tools_changed')
        return {'state':'observed_not_adopted' if installing else 'checked','graph':pin(canonical(current))}
    def dist_check():
        entry()
        if not os.path.lexists(root/'dist'):
            need(baseline is None,'attempt_dist_missing');return {'state':'absent'}
        current=dist(ctx,root)
        if baseline is not None:need(same(current,baseline),'attempt_dist_changed')
        else:need(building or transferring,'attempt_unexpected_dist')
        return {'state':('observed_unadopted_transfer' if transferring else 'observed_unadopted_output') if baseline is None else 'checked','graph':pin(canonical(current))}
    for name,work in (('root',root_check),('source',source_check),('tools',tools_check),('dist',dist_check),('cache',lambda:strict_cache(base))):
        observe(name,work)
    report={'role':role,'installing':installing,'building':building,'transferring':transferring,'checks':checks,'secondary':errors,'complete':not errors}
    need(len(canonical(report))<=16384,'attempt_report_bound')
    return report


def after_attempt(action, observation):
    """Preserve first failure; perform remaining checks without minting authority."""
    primary=None;result=None;report=None
    try:
        result=action()
    except BaseException as error:
        primary=error
    try:
        report=observation()
        need(len(ATTEMPTS)<8,'attempt_count');ATTEMPTS.append(report)
        SECONDARY.extend(report['secondary'])
        if not report['complete'] and primary is None:primary=RuntimeError('installation_attempt_preservation_failed')
    except BaseException as error:
        SECONDARY.append({'phase':'attempt_finalization','code':type(error).__name__})
        if primary is None:primary=error
    if primary is not None:raise primary
    return result


def owned_disk_observer(role_root, role_temp, tmp_root, state, processes, horizons=(925,)):
    """64 samples, bounded all-event accounting; live TMP races never imply quota."""
    need(type(horizons) is tuple and 1 <= len(horizons) <= 2 and
         all(type(value) is int and 0 < value <= 2425 for value in horizons), 'disk_horizons')
    # capture() polls disk no more often than every2s. Include one boundary scan
    # per action; settlement scans are strict and never consume race allowance.
    scan_limit=sum((seconds+1)//2+1 for seconds in horizons)
    work_limit=scan_limit*65536
    roots=[(Path(role_root),observed_directory(role_root)),(Path(role_temp),observed_directory(role_temp))]
    tmp_root=Path(tmp_root);tmp_identity=observed_directory(tmp_root)
    accounting={'total':0,'directory':0,'leaf':0,'omitted':0,'saturated':False,
                'live_scans':0,'live_work':0,'scan_work':0,'samples':[]}
    state['disk_race_accounting']=accounting
    def pinned():
        for path,before in roots:need(observed_directory(path)==before,'owned_disk_root_changed')
        need(observed_directory(tmp_root)==tmp_identity,'owned_disk_tmp_changed')
    def work(live):
        need(accounting['scan_work']<65536,'disk_scan_work_bound')
        if live:
            need(accounting['live_work']<work_limit,'disk_aggregate_work_bound')
            accounting['live_work']+=1
        accounting['scan_work']+=1
    def race(error,phase,live):
        if not live or not isinstance(error,FileNotFoundError) or error.errno!=2 or not error.filename:raise error
        need(processes and processes[-1].returncode is None and not state['settling'],'disk_race_without_active_child')
        need(phase in ('directory','leaf'),'disk_race_kind')
        path=Path(error.filename)
        need(path.is_absolute() and str(path)==os.path.normpath(path),'disk_race_path')
        try:relative=path.relative_to(tmp_root)
        except ValueError:raise RuntimeError('installation_disk_race_outside_tmp') from None
        text=relative.as_posix()
        need(relative.parts and len(relative.parts)<=64 and len(text)<=512 and all(32<=ord(c)<=126 for c in text),'disk_race_bound')
        pinned();lease=Owned();primary=None
        try:
            fd=lease.open(tmp_root,True)
            for part in relative.parts:
                try:child=lease.open(part,flags=os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,parent=fd)
                except FileNotFoundError:break
                fd=child
            pinned()
        except BaseException as error:primary=error
        lease.finish(primary)
        # All admission checks precede accounting even after sample saturation.
        work(live);need(accounting['total']<work_limit,'disk_race_total_bound')
        accounting['total']+=1;accounting[phase]+=1
        if len(accounting['samples'])<64:
            accounting['samples'].append({'phase':state['phase'],'kind':phase,'relative_path':text,'errno':2,'count':accounting['total']})
        else:
            accounting['omitted']+=1;accounting['saturated']=True
        need(accounting['total']==len(accounting['samples'])+accounting['omitted'] and
             accounting['total']==accounting['directory']+accounting['leaf'],'disk_race_accounting')
    def scan():
        entry();pinned();total=0;entries=0;accounting['scan_work']=0
        live=bool(processes and processes[-1].returncode is None and not state['settling'])
        if live:
            need(accounting['live_scans']<scan_limit,'disk_live_scan_bound');accounting['live_scans']+=1
        def unreadable(error):race(error,'directory',live)
        for scope,_ in roots:
            for parent,directories,files in os.walk(scope,followlinks=False,onerror=unreadable):
                work(live);path=Path(parent)
                try:before=path.lstat()
                except FileNotFoundError as error:race(error,'directory',live);continue
                need(stat.S_ISDIR(before.st_mode) and path.resolve()==path and path.is_relative_to(scope),'disk_walk_escape')
                need(entries+len(directories)+len(files)<=65536,'owned_disk_entry_cap')
                for name in directories+files:
                    work(live);entries+=1;need(entries<=65536,'owned_disk_entry_cap')
                    try:info=(path/name).lstat()
                    except FileNotFoundError as error:race(error,'leaf',live);continue
                    total+=info.st_size;need(total<=1073741824,'owned_disk_byte_cap')
                try:after=path.lstat()
                except FileNotFoundError as error:race(error,'directory',live);continue
                need(stat.S_ISDIR(after.st_mode) and path.resolve()==path and metadata(before)[:5]==metadata(after)[:5],'disk_parent_changed')
        pinned();state['disk_peak_observed']=max(state.get('disk_peak_observed',0),total)
        need(accounting['total']==len(accounting['samples'])+accounting['omitted'] and
             accounting['total']==accounting['directory']+accounting['leaf'],'disk_race_accounting')
        value={'strict':not live,'entries':entries,'bytes':total,'races':list(accounting['samples']),
               'race_events_total':accounting['total'],'race_events_directory':accounting['directory'],
               'race_events_leaf':accounting['leaf'],'race_events_omitted':accounting['omitted'],
               'race_sample_saturated':accounting['saturated'],'live_scan_count':accounting['live_scans'],
               'scan_work':accounting['scan_work'],'live_work_total':accounting['live_work'],
               'scan_limit':scan_limit,'aggregate_work_limit':work_limit}
        state['owned_scope_observation']=value
        return value
    return scan


def owned_capture(ctx, role, raw_directory, argv, seconds, expected_source):
    """Reuse the hardened layout owner capture, signal, EOF/group/reap machinery."""
    import runpy
    import signal
    import time
    import ctypes
    entry()
    role_root = BUILD if role == 'build' else EVAL
    need(ctx.ROOT == role_root, 'capture_role_cwd')
    module = runpy.run_path(str(ctx.ROOT / 'test/support/fixture105-hosted-layout.py'), run_name='installation_capture_definitions')
    capture = module['capture']; state = module['STATE']; ns = capture.__globals__
    state['source'] = module['identity'](role_root); state['owned_root'] = state['source']
    base = role_base(ctx, role)
    identity(expected_source)
    diagnostic = raw_directory == base / 'evidence/fixture105-traversal'
    envelope=stage_envelope('producer-build' if role=='build' else 'evaluation-init') if raw_directory!=base/'evidence/identity-witness' and not diagnostic else None
    before_tools = tools(ctx)
    before_root = observed_directory(role_root)
    profile_policy = policy(ctx)[2]
    label = 'fixture105-traversal' if diagnostic else 'identity-witness' if raw_directory == base/'evidence/identity-witness' else raw_directory.relative_to(base / 'evidence/producer').as_posix().replace('/', '-')
    need(label in ('install', 'quality-format', 'quality-lint', 'quality-types', 'quality-build', 'quality-structural', 'identity-witness', 'fixture105-traversal'), 'capture_slot')
    capture_directory = base / 'tmp' / ('capture-' + label)
    capture_directory.mkdir(mode=0o700)
    state['evidence'] = module['identity'](capture_directory)
    env = {'PATH': os.environ['PATH'], 'HOME': str(base / 'home'), 'TMPDIR': str(base / 'tmp'),
           'RUNNER_TEMP': os.environ['RUNNER_TEMP'], 'DESK_CI_ROLE_TEMP': str(base.parent),
           'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8', 'TZ': 'UTC',
           'NODE_DISABLE_COMPILE_CACHE': '1', 'TSX_DISABLE_CACHE': '1', 'DESK_ENV': 'test',
           'PROVIDERS_ENABLED': 'false', 'GENERATION_KILL_SWITCH': 'true', 'NPM_CONFIG_USERCONFIG': str(base / 'home/user.npmrc'),
           'NPM_CONFIG_GLOBALCONFIG': str(base / 'home/global.npmrc'), 'NPM_CONFIG_CACHE': str(base/'tmp/npm-cache'),
           'NPM_CONFIG_UPDATE_NOTIFIER':'false'}
    if diagnostic:
        need(role == 'evaluation' and ctx.ROOT == EVAL, 'traversal_role')
        need(argv == ['/usr/bin/python3', '-I', '-B', 'test/support/p33-parity-supervisor.py', 'guard', 'fixture105-traversal'] and seconds == 900, 'traversal_command')
        binding, loader = ctx.fixture_validate(base, EVAL, True)
        need(not loader.get('absent') and loader.get('leaves') == [], 'traversal_loader')
        env.update(CI='true', DESK_FIXTURE105_BINDING=json.dumps(binding,separators=(',',':')))
        for name in ('GITHUB_ACTIONS','ImageOS','GITHUB_WORKSPACE','GITHUB_SHA','GITHUB_REPOSITORY','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','DESK_CI_PARTITION'):
            need(name in os.environ, 'traversal_host_context')
            env[name] = os.environ[name]
    need(not any(name in os.environ for name in ('NODE_PATH', 'NODE_OPTIONS', 'ESBUILD_BINARY_PATH')), 'injected_modules')
    if argv[:2] == ['npm', 'ci']:
        for name in ('HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS'):
            if name in os.environ:
                env[name] = os.environ[name]  # Transport only, never retained verbatim.
    ns.update(SOURCE=role_root, DESTINATION=role_root, EVIDENCE=capture_directory, CAP=8388608,
              GIT_ENV=env, WHOLE_DEADLINE=time.monotonic() + seconds + 30, tmp=module['identity'](Path('/tmp')))
    old = {}
    primary = None; outcome = None; resolution = None; identity_result = None;spawns=[];processes=[];observer_adapted=False
    try:
        for signum in (signal.SIGTERM,signal.SIGINT):
            old[signum]=signal.signal(signum,module['cancel'])
        libc = ctypes.CDLL(None,use_errno=True)
        need(libc.prctl(36,1,0,0,0)==0,'subreaper')
        import types
        real_subprocess=ns['subprocess']
        ns['disk_observation']=owned_disk_observer(role_root,base.parent,base/'tmp',state,processes,
            horizons=(seconds+25,50) if label in ('install','quality-structural') else (seconds+25,));observer_adapted=True
        def spawn(*args,**kwargs):
            need(not spawns,'capture_single_spawn')
            spawns.append(True)
            process=real_subprocess.Popen(*args,**kwargs);processes.append(process);return process
        ns['subprocess']=types.SimpleNamespace(**dict(vars(real_subprocess),Popen=spawn))
        capture('operation', ['/usr/bin/timeout', '--signal=TERM', '--kill-after=' + ('5s' if label == 'quality-structural' or seconds == 30 else '20s'), str(seconds) + 's'] + argv, seconds + 25)
        outcome = dict(state['actions'][-1], spawn_attempts=len(spawns))
        check_raw_settlement(outcome)
        if label == 'install':
            # A second closed child resolves metadata only, never imports package code.
            ns['WHOLE_DEADLINE'] = time.monotonic() + 55
            spawns.clear()
            probe_raw = capture('resolution', ['node','--input-type=module','-e',MODULE_PROBE], 50)
            probe_process = dict(state['actions'][-1], spawn_attempts=len(spawns))
            check_raw_settlement(probe_process)
            need(len(probe_raw) <= 16384, 'module_resolution_bound')
            resolution = {'result': parse(probe_raw,16384,False), 'process':probe_process,
                'stdout':pin(probe_raw), 'stderr':pin(read(capture_directory/'resolution.stderr',16384)), 'raw_stdout':probe_raw.decode('utf8')}
        if label == 'quality-structural':
            source=parse(read(base/'evidence/producer/metadata/BUILD-INSTALL.json',16384))['source']
            role_install_check(ctx,'build',source,True)
            ns['WHOLE_DEADLINE']=time.monotonic()+55
            spawns.clear()
            witness_raw=capture('identity',['/usr/bin/timeout','--signal=TERM','--kill-after=5s','30s','node','--import','tsx','test/support/installation-identity.ts'],50)
            witness_process=dict(state['actions'][-1],spawn_attempts=len(spawns));check_raw_settlement(witness_process)
            witness_value=parse(witness_raw,16384,False);identity_witness(witness_value,'build')
            identity_result={'result':witness_value,'process':witness_process,'raw_stdout':witness_raw.decode('utf8'),'stdout':pin(witness_raw),'stderr':pin(read(capture_directory/'identity.stderr',16384))}
        need(not state['primary'] and not state['cancelled'] and not state['cleanup_errors'] and
             not ns['OWNED_FD_PENDING'] and not ns['PENDING_RESOURCES'], 'capture_terminal')
    except BaseException as error:
        primary = error
        if outcome is None:
            recorded=[row for row in state['actions'] if row.get('label')=='operation']
            if recorded:outcome=dict(recorded[-1],spawn_attempts=len(spawns))
    finally:
        secondary = []
        for signum, handler in old.items():
            try:
                signal.signal(signum, handler)
            except BaseException as error:
                secondary.append({'phase':'restore_signal','code':type(error).__name__})
                if primary is None:primary=error
        if ns['OWNED_FD_PENDING'] or ns['PENDING_RESOURCES'] or state['cleanup_errors']:
            POISON.append({'resource': 'process_or_capture', 'pending': True})
            PENDING_OBJECTS.extend(ns['PENDING_RESOURCES'])
        # A negative child outcome still needs strict owned-scope observation.
        # Do not infer settlement from absence of an outcome or from a failed scan.
        if observer_adapted and not POISON:
            try:
                need(all(row.get('settlement')=='complete' and row.get('direct_reaped') is True and
                     same(row.get('population'),{'complete':True,'members':[],'children':[],'errors':[]}) for row in state['actions']), 'disk_settlement_unproved')
                state['settling']=True
                ns['disk_observation']()
            except BaseException as error:
                secondary.append({'phase':'strict_owned_disk','code':type(error).__name__})
                if primary is None:primary=error
        # Independent publication attempts never replace an earlier command error.
        if not POISON:
            for name in ('stdout', 'stderr'):
                try:
                    path = capture_directory / ('operation.' + name)
                    if os.path.lexists(path):
                        write(raw_directory / name, read(path, 8388608), 8388608)
                except BaseException as error:
                    secondary.append({'phase':'publish_'+name,'code':type(error).__name__})
                    if primary is None:primary=error
        try:
            leaf = {'schema': 'ci-producer-raw/1', 'role': role, 'argv': argv, 'cwd': str(role_root),
                    'envelope':envelope, 'source':expected_source,'profile_policy_sha256':profile_policy,'root_before':before_root,
                    'root_after':None if POISON else observed_directory(role_root),'tools_before':before_tools,
                    'tools_after':None if POISON else tools(ctx),
                    'process': outcome, 'auxiliary_actions':list(state['actions']), 'owned_scope_observation':state.get('owned_scope_observation'),
                    'resolution': resolution, 'identity_witness': identity_result,
                    'launch': None if POISON or not os.path.lexists(capture_directory/'operation.process.json') else parse(read(capture_directory/'operation.process.json',262144),canonical_required=False),
                    'primary': None if primary is None else type(primary).__name__,
                    'cleanup':state['cleanup_errors']+secondary,'pending':bool(POISON),'cancelled':state['cancelled']}
            if not POISON:
                write(raw_directory/'owner.json',canonical(leaf))
        except BaseException as error:
            secondary.append({'phase':'publish_owner','code':type(error).__name__})
            if primary is None:primary=error
        if state['cancelled'] is not None:
            global CANCELLED
            CANCELLED = state['cancelled']
        if primary is None and secondary:
            primary = RuntimeError('installation_capture_publication_failed')
        # Secondary evidence remains inspectable even if a poisoned descriptor
        # forbids additional ordinary filesystem work. No fd number is retried.
        if secondary:
            SECONDARY.extend(secondary[:32])
            if len(secondary)>32:SECONDARY.append({'phase':'capture_secondary','code':'overflow'})
    if primary is not None:
        raise primary

    return outcome


def settled(owner_pin):
    return {'schema': 'ci-owned-settlement/1', 'stdout_eof': True, 'stderr_eof': True,
            'direct_reaped': True, 'group_empty': True, 'discovery_complete': True,
            'owned_pending': [], 'primary': None, 'cleanup': [], 'cancelled': False, 'owner_raw': owner_pin}


def producer_paths(ctx):
    base = ctx.ci_dir()
    return base, base / 'evidence' / 'producer', base / 'evidence' / 'producer' / 'metadata'


def record(directory, name, value):
    return write(directory / name, canonical(value), record_limit(name))


def load_records(directory):
    names=list(directory.iterdir())
    need(len(names)<=30 and all(path.name in BINDINGS and not path.is_symlink() and path.is_file() for path in names),'metadata_namespace')
    return {path.name:read(path,record_limit(path.name)) for path in names}


def tools(ctx):
    """Read current pinned-tool bytes; version probes remain in authentic cmd_init.

    The owned Node resolution child also requires its real process.version before
    succeeding. npm's own immutable package identity is read without executing a
    second unmanaged client or inheriting user configuration for a version query.
    """
    import shutil
    import platform
    need(platform.system() == 'Linux' and platform.machine() == 'x86_64' and platform.libc_ver()[0] == 'glibc', 'host_platform')
    answer = {}
    for name, version in [('node','24.21.0'),('npm','11.19.0')]:
        value=shutil.which(name);need(value is not None,'tool_missing')
        resolved=Path(value).resolve();uid=resolved.lstat().st_uid
        need(uid in (0,os.getuid()),'tool_owner')
        if name=='npm':
            package=parse(read(resolved.parent.parent/'package.json',262144,False,expected_uid=uid),canonical_required=False)
            need(package['name']=='npm' and package['version']==version,'npm_package_version')
        answer[name]={'version':version,'executable_sha256':digest(read(resolved,268435456,False,expected_uid=uid))}
    return answer


def admit_installation(ctx, role, common_identity):
    """Ordinary complete npm installation; no copying, pruning or projected inventory."""
    build_diagnostic_phase('install-policy')
    entry(); p, q, l, q_hash = policy(ctx)
    build_diagnostic_phase('install-pre-capture')
    base, producer, destination = producer_paths(ctx)
    prefix = 'BUILD' if role == 'build' else 'EVAL'
    role_root = BUILD if role == 'build' else EVAL
    need(ctx.ROOT == role_root and not os.path.lexists(role_root / 'node_modules') and
         not os.path.lexists(role_root / 'dist'), 'fresh_installation')
    raw_dir = producer / 'install'; raw_dir.mkdir(mode=0o700)
    argv = p['build_install' if role == 'build' else 'evaluation_install']['argv']
    # Private npm config and cache are role-owned. Lifecycle scripts, audit/fund,
    # retries and external configuration remain explicitly disabled.
    cache = base / 'tmp/npm-cache'; cache.mkdir(mode=0o700)
    for name in ('user.npmrc', 'global.npmrc'):
        write(base / 'home' / name, b'')
    actual = argv + ['--no-audit', '--no-fund', '--no-update-notifier', '--registry=https://registry.npmjs.org/',
        '--strict-ssl=true', '--fetch-retries=0', '--maxsockets=1', '--fetch-timeout=15000',
        '--cache=' + str(cache), '--userconfig=' + str(base / 'home/user.npmrc'), '--globalconfig=' + str(base / 'home/global.npmrc')]
    before_source=graph(role_root,'source');before_root=observed_directory(role_root)
    build_diagnostic_phase('install-capture')
    outcome=after_attempt(lambda:owned_capture(ctx,role,raw_dir,actual,600,common_identity),
        lambda:attempt_finalization(ctx,role,before_source,None,before_root,None,installing=True))
    build_diagnostic_phase('install-post-capture')
    strict_cache(base)
    source = graph(role_root, 'source'); installed = graph(role_root / 'node_modules', 'tools')
    closure_raw = read(role_root / 'fixtures/ci-evaluation-installation' / (prefix + '-CLOSURE.json'), 262144, False)
    reference(p['build_closure' if role == 'build' else 'evaluation_closure'], closure_raw)
    closure = parse(closure_raw); lock = parse(read(role_root / 'package-lock.json', 262144, False), canonical_required=False)
    records = {row['path']: row['record'] for row in closure['records']}
    need(all(same(row, lock['packages'][name]) for name, row in records.items()), 'closure_lock')
    hidden_raw = read(role_root / 'node_modules/.package-lock.json', 262144, False)
    hidden = parse(hidden_raw, canonical_required=False)
    actual_packages = sorted(hidden['packages'])
    need(set(actual_packages) <= set(records), 'installed_foreign_package')
    module_admission(ctx, role, parse(read(raw_dir/'owner.json',262144)), installed)
    package_rows = []
    for path in actual_packages:
        path_name(path, True)
        raw = read(role_root / path / 'package.json', 262144, False); value = parse(raw, canonical_required=False)
        need(value['version'] == records[path]['version'] and same(hidden['packages'][path], records[path]), 'installed_record')
        package_rows.append({'path': path, 'name': value['name'], 'version': value['version'], 'package_json': pin(raw), 'lock_path': path})
    # Enumerate actual package.json locations independently, not just hidden-lock claims.
    packages_in_graph = set()
    for name in installed:
        if name.endswith('/package.json'):
            location = 'node_modules/' + name[:-len('/package.json')]
            if location in lock['packages']:
                packages_in_graph.add(location)
    need(packages_in_graph == set(actual_packages), 'actual_package_population')
    absent = []
    for path, row in records.items():
        if path not in actual_packages:
            need(row.get('optional') is True and (row.get('os') or row.get('cpu') or row.get('libc')), 'missing_mandatory_package')
            need(('linux' not in row.get('os', ['linux'])) or ('x64' not in row.get('cpu', ['x64'])) or
                 ('glibc' not in row.get('libc', ['glibc'])), 'unexpected_platform_omission')
            absent.append({'from': path, 'kind': 'optionalDependencies', 'name': path, 'range': row['version'], 'reason': 'incompatible_platform'})
    for edge in closure['edges']:
        if not edge['followed']:
            need(edge['optional'] is True, 'missing_required_edge')
            absent.append({key: edge[key] for key in ('from', 'kind', 'name', 'range')} | {'reason': 'absent_optional_peer'})
    absent.sort(key=lambda row: (row['from'], row['kind'], row['name']))
    tool = tools(ctx)
    profile = {'schema': 'ci-install-profile/1', 'profile_id': 'desk-full-build/1' if role == 'build' else 'desk-evaluation-runtime/1',
        'producer_id': p['producer'], 'source': common_identity, 'manifest': p['manifest'], 'lock': p['lock'],
        'roots': closure['roots'], 'omit': p['build_install' if role == 'build' else 'evaluation_install']['omit'],
        'install_argv': argv, 'node': tool['node'], 'npm': tool['npm'], 'platform': {'os': 'linux', 'arch': 'x64', 'libc': 'glibc'},
        'closure': pin(closure_raw), 'optional_absences': pin(canonical({'schema': 'ci-install-absences/1', 'rows': absent}))}
    source_name = 'BUILD-SOURCE-INVENTORY.json' if role == 'build' else 'SOURCE-INVENTORY.json'
    tools_name = 'BUILD-TOOLS-INVENTORY.json' if role == 'build' else 'TOOLS-INVENTORY.json'
    records_out = {source_name: source, tools_name: installed, prefix + '-CLOSURE.json': closure,
        prefix + '-OPTIONAL-ABSENCES.json': {'schema': 'ci-install-absences/1', 'rows': absent},
        prefix + '-PACKAGE-METADATA.json': {'schema': 'ci-installed-packages/1', 'rows': package_rows}, prefix + '-PROFILE.json': profile}
    for name, value in records_out.items():
        record(destination, name, value)
    write(destination / (prefix + '-HIDDEN-LOCK.json'), hidden_raw)
    owner = raw_pin(raw_dir / 'owner.json', 262144)
    invocation = {'schema': 'ci-npm-invocation/1', 'source': common_identity, 'profile_policy_sha256': l, 'argv': actual,
        'cwd': str(role_root), 'node_sha256': tool['node']['executable_sha256'], 'npm_sha256': tool['npm']['executable_sha256'],
        'environment_policy_sha256': digest(canonical({'policy': 'private-official-npm/1', 'role': role})),
        'exit': outcome['exit'], 'stdout': raw_pin(raw_dir / 'stdout'), 'stderr': raw_pin(raw_dir / 'stderr'), 'owner_raw': owner}
    record(destination, prefix + '-INSTALL-INVOCATION.json', invocation)
    record(destination, prefix + '-INSTALL-SETTLEMENT.json', settled(owner))
    refs = lambda name: raw_pin(destination / name, 4194304 if 'INVENTORY' in name else 262144)
    installation = {'schema': 'ci-installation/1', 'source': common_identity, 'profile': refs(prefix + '-PROFILE.json'),
        'checkout': observed_directory(role_root), 'modules': observed_directory(role_root / 'node_modules'),
        'source_graph': refs(source_name), 'tools_graph': refs(tools_name), 'package_metadata': refs(prefix + '-PACKAGE-METADATA.json'),
        'hidden_lock': refs(prefix + '-HIDDEN-LOCK.json'), 'invocation': refs(prefix + '-INSTALL-INVOCATION.json'), 'settlement': refs(prefix + '-INSTALL-SETTLEMENT.json')}
    record(destination, prefix + '-INSTALL.json', installation)
    need(graph(role_root, 'source') == source and graph(role_root / 'node_modules', 'tools') == installed, 'installation_final_drift')
    return installation


def prepare_ledger(ctx, role):
    entry()
    need(os.getuid() != 0 and re.findall(r'^Umask:\s*([0-7]{4})$', Path('/proc/self/status').read_text(), re.M) == ['0077'], 'private_creation_contract')
    base = role_base(ctx, role)
    need(base == ctx.ci_dir() and not os.path.lexists(base), 'exclusive_role_ledger')
    base.mkdir(mode=0o700)
    for name in ('evidence', 'tmp', 'home'):
        (base / name).mkdir(mode=0o700)
    producer = base / 'evidence/producer'; producer.mkdir(mode=0o700)
    (producer / 'metadata').mkdir(mode=0o700)
    need(not any(os.path.lexists(p) for p in (Path('/tmp/node_modules'), Path('/node_modules'),
         base / 'home/.node_modules', base / 'home/.node_libraries')), 'ancestor_modules')
    return base


def admitted_identity(ctx):
    build_diagnostic_phase('source-snapshot')
    tracked = ctx.tracked_files()
    snap = ctx.take_snapshot(tracked, allow_dist=False)
    need(not ctx.snapshot_errors(snap), 'preinstallation_source')
    build_diagnostic_phase('source-identity')
    return source_identity(ctx, snap['members']), snap


def check_install_command(owner, invocation):
    need(same(owner['argv'],invocation['argv']),'raw_install_argv')
    need(same(owner['process']['argv'],['/usr/bin/timeout','--signal=TERM','--kill-after=20s','600s']+invocation['argv']),'raw_install_deadline')


def role_install_check(ctx, role, expected, allow_dist=False):
    entry(); root = BUILD if role == 'build' else EVAL
    prefix = 'BUILD' if role == 'build' else 'EVAL'
    base = role_base(ctx, role); records = base / 'evidence/producer/metadata'
    installation = parse(read(records / (prefix + '-INSTALL.json'), 16384))
    need(installation['source'] == expected and installation['checkout'] == observed_directory(root) and
         installation['modules'] == observed_directory(root / 'node_modules'), 'live_role_identity')
    source_name = 'BUILD-SOURCE-INVENTORY.json' if role == 'build' else 'SOURCE-INVENTORY.json'
    tool_name = 'BUILD-TOOLS-INVENTORY.json' if role == 'build' else 'TOOLS-INVENTORY.json'
    for key, name, actual in [('source_graph', source_name, graph(root, 'source')),
                               ('tools_graph', tool_name, graph(root / 'node_modules', 'tools'))]:
        raw = read(records / name, 4194304);reference(installation[key], raw, 4194304)
        need(same(parse(raw, 4194304), actual), 'live_role_payload')
    for name, key in [(prefix + '-PROFILE.json', 'profile'), (prefix + '-PACKAGE-METADATA.json', 'package_metadata'),
                       (prefix + '-HIDDEN-LOCK.json', 'hidden_lock'), (prefix + '-INSTALL-INVOCATION.json', 'invocation'),
                       (prefix + '-INSTALL-SETTLEMENT.json', 'settlement')]:
        reference(installation[key], read(records / name, 262144))
    invocation = parse(read(records / (prefix + '-INSTALL-INVOCATION.json'), 262144))
    raw_install = base / 'evidence/producer/install'
    for key, filename, maximum in [('stdout', 'stdout', 8388608), ('stderr', 'stderr', 8388608), ('owner_raw', 'owner.json', 262144)]:
        reference(invocation[key], read(raw_install / filename, maximum), maximum, empty=key in ('stdout','stderr'))
    owner = parse(read(raw_install / 'owner.json', 262144))
    need(owner['role'] == role and owner['primary'] is None and owner['cleanup'] == [] and
         owner['pending'] is False and owner['cancelled'] is None, 'install_owner')
    need(same(owner['source'],expected) and owner['profile_policy_sha256']==policy(ctx)[2] and
         owner['root_before']==owner['root_after']==installation['checkout'] and
         same(owner['tools_before'],owner['tools_after']) and same(owner['tools_after'],tools(ctx)),'install_owner_identity')
    profile=parse(read(records/(prefix+'-PROFILE.json'),16384))
    need(same(owner['tools_before'],{'node':profile['node'],'npm':profile['npm']}),'installation_tool_binding')
    validate_envelope(owner['envelope'],'producer-build' if role=='build' else 'evaluation-init')
    check_raw_settlement(owner['process'])
    check_install_command(owner,invocation)
    module_admission(ctx, role, owner, graph(root/'node_modules','tools'))
    if not allow_dist:
        need(not os.path.lexists(root / 'dist'), 'role_dist_absent')
    strict_cache(base)
    return installation


def gate_argv(q_row, base):
    return [value.replace('<BUILD_CI_TMP>', str(base / 'tmp')) for value in q_row['argv']]


def structural_methods(raw, expected):
    text = raw.decode('utf8')
    need(not re.search(r'\b(FAIL|ERROR|skipped)\b', text), 'structural_failure')
    seen = re.findall(r'^test_[^\s]+ \((__main__\.[^()]+)\) \.\.\. ok$', text, re.M)
    need(len(seen) == 157 and sorted(seen) == expected and len(set(seen)) == 157 and
         re.search(r'^Ran 157 tests in [0-9.]+s$', text, re.M) and re.search(r'^OK$', text, re.M), 'structural_method_set')


def quality_check(ctx, expected, *, both=False, bootstrap=False):
    """B6 and all later checkpoints check complete BUILD and raw evidence freshly."""
    base = role_base(ctx, 'build'); records = base / 'evidence/producer/metadata'
    role_install_check(ctx, 'build', expected, True)
    p, q, l, q_hash = policy(ctx)
    quality = parse(read(records / 'QUALITY.json', 32768))
    need(quality['source'] == expected and quality['policy_sha256'] == q_hash, 'quality_source')
    baseline = read(records / 'DIST-INVENTORY.json', 4194304)
    reference(quality['dist_graph'], baseline, 4194304)
    need(same(dist(ctx, BUILD), parse(baseline, 4194304)), 'immutable_build_dist')
    for actual, wanted in zip(quality['gates'], q['gates']):
        need(actual['name'] == wanted['name'] and actual['argv'] == gate_argv(wanted, base) and actual['exit'] == 0, 'quality_gate_identity')
        directory = base / 'evidence/producer/quality' / wanted['name']
        for key, name, cap in [('stdout', 'stdout', 8388608), ('stderr', 'stderr', 8388608), ('result', 'result.json', 262144)]:
            reference(actual[key], read(directory / name, cap), cap, empty=key in ('stdout','stderr'))
        result = parse(read(directory / 'result.json', 262144))
        exact(result, ('schema', 'name', 'exit', 'completed', 'methods', 'failed', 'skipped', 'errors', 'owner_raw'))
        need(result['schema'] == 'ci-quality-gate/1' and result['name'] == wanted['name'] and result['exit'] == 0 and
             result['completed'] is True and result['failed'] == result['skipped'] == result['errors'] == 0 and
             result['methods'] == (q['structural_methods'] if wanted['name'] == 'structural' else []), 'quality_result')
        reference(result['owner_raw'], read(directory / 'owner.json', 262144))
        owner = parse(read(directory / 'owner.json', 262144));check_raw_settlement(owner['process'])
        validate_envelope(owner['envelope'],'producer-build')
        need(same(owner['source'],expected) and owner['argv']==gate_argv(wanted,base) and
             owner['profile_policy_sha256']==l and owner['root_before']==owner['root_after']==quality['build_root'] and
             same(owner['tools_before'],owner['tools_after']) and same(owner['tools_after'],tools(ctx)), 'quality_owner_identity')
        deadline=['/usr/bin/timeout','--signal=TERM','--kill-after='+str(wanted['kill_after_seconds'])+'s',str(wanted['deadline_seconds'])+'s']
        need(owner['process']['argv']==deadline+gate_argv(wanted,base),'quality_deadline')
        need(owner['primary'] is None and owner['pending'] is False and owner['cleanup'] == [] and owner['cancelled'] is None, 'quality_owner')
        if wanted['name'] == 'structural':
            witness=owner['identity_witness'];check_raw_settlement(witness['process']);identity_witness(witness['result'],'build')
            reference(witness['stdout'],witness['raw_stdout'].encode(),16384);need(witness['stderr']==pin(b''),'identity_stderr')
            structural_methods(read(directory / 'stderr', 8388608), q['structural_methods'])
    settlement=parse(read(records/'QUALITY-SETTLEMENT.json',262144))
    raw_owner=read(base/'evidence/producer/quality/owner.json',262144)
    reference(settlement['owner_raw'],raw_owner)
    value=parse(raw_owner);exact(value,('schema','source','gate_names','all_settled','primary','cleanup','pending','cancelled'))
    need(value['schema']=='ci-quality-owner/1' and same(value['source'],expected) and value['gate_names']==list(GATES) and value['all_settled'] is True and
         value['primary'] is None and value['cleanup']==[] and value['pending']==[] and value['cancelled'] is False,'quality_raw_owner')
    if both:
        role_install_check(ctx, 'evaluation', expected, True)
    elif bootstrap:
        need(ctx.ROOT == EVAL and not os.path.lexists(EVAL / 'node_modules') and not os.path.lexists(EVAL / 'dist') and
             not os.path.lexists(role_base(ctx, 'evaluation')), 'evaluation_bootstrap_absence')
    else:
        need(not os.path.lexists(EVAL) and not os.path.lexists(role_base(ctx, 'evaluation')), 'evaluation_before_creation')
    return quality


def produce_build(ctx):
    global BUILD_DIAGNOSTIC_PHASE
    BUILD_DIAGNOSTIC_PHASE = 'envelope'
    stage_envelope('producer-build')
    entry();need(ctx.ROOT == BUILD, 'build_cwd')
    common, snap = admitted_identity(ctx)
    build_diagnostic_phase('ledger')
    prepare_ledger(ctx, 'build')
    installation = admit_installation(ctx, 'build', common)
    build_diagnostic_phase('build-quality')
    p, q, l, q_hash = policy(ctx)
    base, producer, records = producer_paths(ctx)
    need(ctx.cmd_init('build') == 0, 'build_context_initialization')
    need(not os.path.lexists(base / 'evidence/fixture105-binding.json') and not os.path.lexists(base / 'tmp/desk-connected-fixture105') and
         not os.path.lexists(BUILD / 'node_modules/.vite-temp'), 'build_has_no_runtime_capability')
    quality_dir = producer / 'quality';quality_dir.mkdir(mode=0o700)
    gates = []; baseline = None
    for row in q['gates']:
        # B1..B5: every acquisition is fresh, never a saved graph substitute.
        role_install_check(ctx, 'build', common, baseline is not None)
        need(not os.path.lexists(EVAL), 'evaluation_before_quality')
        if baseline is not None:
            need(same(dist(ctx, BUILD), baseline), 'build_baseline_before_gate')
        raw = quality_dir / row['name'];raw.mkdir(mode=0o700)
        argv = gate_argv(row, base)
        before_source=parse(read(records/'BUILD-SOURCE-INVENTORY.json',4194304),4194304)
        before_tools=parse(read(records/'BUILD-TOOLS-INVENTORY.json',4194304),4194304)
        before_root=installation['checkout']
        outcome=after_attempt(lambda:owned_capture(ctx,'build',raw,argv,row['deadline_seconds'],common),
            lambda:attempt_finalization(ctx,'build',before_source,before_tools,before_root,baseline,building=row['name']=='build'))
        if row['name'] == 'build':
            baseline = dist(ctx, BUILD)
            record(records, 'DIST-INVENTORY.json', baseline)
        if row['name'] == 'structural':
            structural_methods(read(raw / 'stderr', 8388608), q['structural_methods'])
        role_install_check(ctx, 'build', common, baseline is not None)
        if baseline is not None:
            need(same(dist(ctx, BUILD), baseline), 'build_baseline_after_gate')
        result = {'schema': 'ci-quality-gate/1', 'name': row['name'], 'exit': outcome['exit'], 'completed': True,
            'methods': q['structural_methods'] if row['name'] == 'structural' else [], 'failed': 0, 'skipped': 0, 'errors': 0,
            'owner_raw': raw_pin(raw / 'owner.json', 262144)}
        record(raw, 'result.json', result)
        gates.append({'name': row['name'], 'argv': argv, 'exit': outcome['exit'], 'stdout': raw_pin(raw / 'stdout'),
            'stderr': raw_pin(raw / 'stderr'), 'result': raw_pin(raw / 'result.json', 262144),
            'source_before': installation['source_graph'], 'source_after': installation['source_graph'],
            'tools_before': installation['tools_graph'], 'tools_after': installation['tools_graph']})
    need(baseline is not None and same(dist(ctx, BUILD), baseline), 'quality_baseline')
    # This owner leaf is complete before QUALITY, TRANSFER or ROOT exists.
    record(quality_dir, 'owner.json', {'schema': 'ci-quality-owner/1', 'source': common, 'gate_names': list(GATES),
        'all_settled': True, 'primary': None, 'cleanup': [], 'pending': [], 'cancelled': False})
    record(records, 'QUALITY-SETTLEMENT.json', settled(raw_pin(quality_dir / 'owner.json', 262144)))
    record(records, 'QUALITY.json', {'schema': 'ci-build-quality/1', 'source': common,
        'build_profile': installation['profile'], 'build_installation': raw_pin(records / 'BUILD-INSTALL.json', 16384),
        'policy_sha256': q_hash, 'gates': gates, 'dist_graph': raw_pin(records / 'DIST-INVENTORY.json', 4194304),
        'build_root': observed_directory(BUILD), 'settlement': raw_pin(records / 'QUALITY-SETTLEMENT.json')})
    quality_check(ctx, common)
    return 0


def evaluation_init(ctx):
    stage_envelope('evaluation-init')
    entry();need(ctx.ROOT == EVAL, 'evaluation_cwd')
    common, snap = admitted_identity(ctx)
    # BUILD must be genuine and frozen before EVAL admission; its root is already
    # present at this stage, so do not apply B-stage EVAL absence checks here.
    quality_check(ctx, common, bootstrap=True)
    prepare_ledger(ctx, 'evaluation')
    installation = admit_installation(ctx, 'evaluation', common)
    base, producer, records = producer_paths(ctx)
    p, q, l, q_hash = policy(ctx)
    need(ctx.cmd_init('evaluation') == 0, 'evaluation_context_initialization')
    need(not os.path.lexists(base / 'evidence/partition.json') and not os.path.lexists(base / 'evidence/fixture105-binding.json') and
         not os.path.lexists(EVAL / 'dist') and not os.path.lexists(EVAL / 'node_modules/.vite-temp'), 'preseal_no_runtime')
    return 0


def copy_dist(ctx, destination, baseline):
    entry();need(not os.path.lexists(EVAL / 'dist'), 'transfer_destination_absent')
    source_identity = observed_directory(BUILD / 'dist')
    (EVAL / 'dist').mkdir(mode=0o700)
    target_identity = observed_directory(EVAL / 'dist')
    physical_rows=[]
    def physical(path, directory=False):
        lease=Owned();primary=None;answer=None
        try:
            fd=lease.open(path,directory);value=os.fstat(fd)
            need(value.st_uid==os.getuid() and (stat.S_ISDIR(value.st_mode) if directory else stat.S_ISREG(value.st_mode) and value.st_nlink==1),'copy_physical')
            answer=list(metadata(value))
        except BaseException as error:
            primary=error
        lease.finish(primary)
        return answer
    for name, row in sorted(baseline['rows'].items(), key=lambda item: (item[0].count('/'), item[0])):
        if not name:
            continue
        path_name(name)
        source=BUILD/'dist'/name;target=EVAL/'dist'/name
        before=physical(source,row['type']=='directory')
        if row['type'] == 'directory':
            target.mkdir(mode=row['mode'])
        else:
            raw=read(source,67108864,False)
            need(pin(raw)=={'bytes':row['bytes'],'sha256':row['sha256']},'copy_source_bytes')
            write(target,raw,67108864)
            # Preserve producer mode only on newly created, exclusively owned output.
            need(row['mode'] in (0o600,0o644),'dist_output_mode')
            if row['mode']!=0o600:
                lease=Owned();primary=None
                try:
                    fd=lease.open(target);os.fchmod(fd,row['mode'])
                except BaseException as error:
                    primary=error
                lease.finish(primary)
        after=physical(source,row['type']=='directory')
        need(before==after,'copy_source_physical_changed')
        physical_rows.append({'path':name,'content':row,'source_before':before,'source_after':after})
    need(observed_directory(BUILD/'dist')==source_identity and observed_directory(EVAL/'dist')==target_identity,'copy_root_identity')
    # Destination directory metadata is observed only after all descendants exist;
    # namespace construction is never mistaken for stable settled metadata.
    for row in physical_rows:
        path=EVAL/'dist'/row['path'];directory=row['content']['type']=='directory'
        row['destination_before']=physical(path,directory)
        if not directory:
            need(pin(read(path,67108864,False))=={key:row['content'][key] for key in P_KEYS},'copy_readback')
        row['destination_after']=physical(path,directory)
        need(row['destination_before']==row['destination_after'],'copy_destination_changed')
    need(same(dist(ctx,BUILD),baseline) and same(dist(ctx,EVAL),baseline),'complete_copy_readback')
    rows=baseline['rows']
    raw_owner={'schema':'ci-dist-copy-owner/1','source_identity':source_identity,'destination_identity':target_identity,
        'physical_fields':['dev','ino','uid','gid','mode','nlink','size','mtime_ns','ctime_ns'],
        'rows':physical_rows,'complete':True,'primary':None,'cleanup':[],'pending':[],'cancelled':False}
    record(destination,'copy-owner.json',raw_owner)
    return {'schema':'ci-dist-copy/1','source_root':source_identity,'destination_root':target_identity,
        'source_before':pin(canonical(baseline)),'source_after':pin(canonical(baseline)),'destination_graph':pin(canonical(baseline)),
        'files':sum(v['type']=='file' for v in rows.values()),'directories':sum(v['type']=='directory' for v in rows.values()),
        'totalbytes':sum(v.get('bytes',0) for v in rows.values()),'source_identity_before':source_identity,'source_identity_after':observed_directory(BUILD/'dist'),
        'destination_identity_before':target_identity,'destination_identity_after':observed_directory(EVAL/'dist'),
        'complete':True,'owner_raw':raw_pin(destination/'copy-owner.json',262144)}


def transfer_check(ctx, records, common):
    """Fresh BUILD/EVAL raw transfer ownership, separate from sealed DAG parsing."""
    slot=role_base(ctx,'evaluation')/'evidence/producer/transfer'
    copied=parse(records['COPY-RESULT.json'],16384)
    raw=read(slot/'copy-owner.json',262144);reference(copied['owner_raw'],raw)
    value=parse(raw);exact(value,('schema','source_identity','destination_identity','physical_fields','rows','complete','primary','cleanup','pending','cancelled'))
    need(value['schema']=='ci-dist-copy-owner/1' and value['complete'] is True and value['primary'] is None and value['cleanup']==[] and value['pending']==[] and value['cancelled'] is False,'copy_raw_owner')
    need(same(copied['source_root'],value['source_identity']) and same(copied['destination_root'],value['destination_identity']),'copy_outer_root_identity')
    need(value['source_identity']==observed_directory(BUILD/'dist') and value['destination_identity']==observed_directory(EVAL/'dist'),'copy_raw_roots')
    need(value['physical_fields']==['dev','ino','uid','gid','mode','nlink','size','mtime_ns','ctime_ns'],'copy_physical_fields')
    dist_rows=parse(records['DIST-INVENTORY.json'],4194304)['rows']
    need(type(value['rows']) is list and [row['path'] for row in value['rows']]==sorted((name for name in dist_rows if name),key=lambda name:(name.count('/'),name)),'copy_raw_population')
    for row in value['rows']:
        exact(row,('path','content','source_before','source_after','destination_before','destination_after'))
        need(same(row['content'],dist_rows[row['path']]) and row['source_before']==row['source_after'] and row['destination_before']==row['destination_after'],'copy_raw_content')
        for root,key in ((BUILD,'source_after'),(EVAL,'destination_after')):
            lease=Owned();primary=None
            try:
                fd=lease.open(root/'dist'/path_name(row['path']),row['content']['type']=='directory')
                need(list(metadata(os.fstat(fd)))==row[key],'copy_physical_drift')
            except BaseException as error:
                primary=error
            lease.finish(primary)
    settlement=parse(records['TRANSFER-SETTLEMENT.json'])
    raw=read(slot/'owner.json',262144);reference(settlement['owner_raw'],raw)
    terminal=parse(raw);exact(terminal,('schema','envelope','source','complete','primary','cleanup','pending','cancelled'))
    validate_envelope(terminal['envelope'],'bind-build')
    need(terminal['schema']=='ci-transfer-owner/1' and same(terminal['source'],common) and terminal['complete'] is True and terminal['primary'] is None and terminal['cleanup']==[] and terminal['pending']==[] and terminal['cancelled'] is False,'transfer_raw_owner')
    need(read(slot/'stdout',8388608)==b'' and read(slot/'stderr',8388608)==b'','transfer_streams')


def transfer_finalization(ctx, states, baseline):
    checks=[];errors=[]
    for role in ('build','evaluation'):
        try:
            state=states[role]
            report=attempt_finalization(ctx,role,state['source'],state['tools'],state['root'],
                baseline if role=='build' else None,transferring=role=='evaluation')
            checks.extend(dict(row,name=role+':'+row['name']) for row in report['checks'])
            errors.extend(report['secondary'])
        except BaseException as error:
            detail={'phase':'transfer:'+role,'code':type(error).__name__};errors.append(detail)
            checks.append({'name':role+':preservation','status':'unknown_or_failed','code':detail['code']})
    value={'role':'both','phase':'transfer_preseal','checks':checks,'secondary':errors,'complete':not errors,
        'evaluation_output_adopted':False,'postseal':False}
    need(len(canonical(value))<=16384,'transfer_attempt_report_bound')
    return value


def seal(ctx):
    envelope=stage_envelope('bind-build')
    entry();need(ctx.ROOT == EVAL, 'seal_cwd')
    base, producer, records = producer_paths(ctx)
    preseal = parse(read(base / 'evidence/partition-init.json', 65536))
    common = {k: preseal['identity'][k] for k in IDENTITY_KEYS}
    quality_check(ctx, common, both=True)
    need(not os.path.lexists(EVAL / 'dist'), 'transfer_initial_absence')
    build_records = role_base(ctx, 'build') / 'evidence/producer/metadata'
    baseline_raw = read(build_records / 'DIST-INVENTORY.json', 4194304);baseline = parse(baseline_raw, 4194304)
    transfer_dir = producer / 'transfer';transfer_dir.mkdir(mode=0o700)
    states={}
    for role,role_root,directory,source_name,tools_name in (
        ('build',BUILD,build_records,'BUILD-SOURCE-INVENTORY.json','BUILD-TOOLS-INVENTORY.json'),
        ('evaluation',EVAL,records,'SOURCE-INVENTORY.json','TOOLS-INVENTORY.json')):
        states[role]={'root':observed_directory(role_root),'source':parse(read(directory/source_name,4194304),4194304),
            'tools':parse(read(directory/tools_name,4194304),4194304)}
    try:
        copied=after_attempt(lambda:copy_dist(ctx,transfer_dir,baseline),lambda:transfer_finalization(ctx,states,baseline))
    except BaseException as primary:
        # Failure is retained in the same preseal owner slot, never transformed
        # into a successful normalized transfer or repaired by deleting output.
        if not POISON:
            try:
                record(transfer_dir,'owner.json',{'schema':'ci-transfer-owner/1','envelope':envelope,'source':common,'complete':False,
                    'primary':type(primary).__name__,'cleanup':list(SECONDARY),'pending':list(POISON),
                    'cancelled':CANCELLED,'destination_claimed':os.path.lexists(EVAL/'dist'),'attempted_preservation':list(ATTEMPTS)})
            except BaseException as error:
                SECONDARY.append({'phase':'transfer_failure_receipt','code':type(error).__name__})
        raise
    write(transfer_dir / 'stdout', b'');write(transfer_dir / 'stderr', b'')
    record(transfer_dir, 'owner.json', {'schema': 'ci-transfer-owner/1', 'envelope':envelope, 'source': common, 'complete': True,
        'primary': None, 'cleanup': [], 'pending': [], 'cancelled': False})
    record(records, 'COPY-RESULT.json', copied)
    record(records, 'TRANSFER-SETTLEMENT.json', settled(raw_pin(transfer_dir / 'owner.json', 262144)))
    # Complete byte-equal metadata copy, never a copied ROOT/loader/install.
    for path in build_records.iterdir():
        need(path.name.startswith('BUILD-') or path.name in ('QUALITY.json', 'QUALITY-SETTLEMENT.json', 'DIST-INVENTORY.json'), 'build_metadata_population')
        write(records / path.name, read(path, 4194304 if 'INVENTORY' in path.name else 262144), 4194304 if 'INVENTORY' in path.name else 262144)
    refs = lambda name: raw_pin(records / name, 4194304 if 'INVENTORY' in name else 262144)
    transfer = {'schema': 'ci-build-transfer/1', 'source': common, 'quality': refs('QUALITY.json'), 'build_installation': refs('BUILD-INSTALL.json'),
        'evaluation_installation': refs('EVAL-INSTALL.json'), 'producer_root': observed_directory(BUILD), 'consumer_root': observed_directory(EVAL),
        'dist_graph': refs('DIST-INVENTORY.json'), 'copy_result': refs('COPY-RESULT.json'), 'settlement': refs('TRANSFER-SETTLEMENT.json')}
    record(records, 'TRANSFER.json', transfer)
    p, q, l, q_hash = policy(ctx)
    quality_check(ctx, common, both=True)
    need(not os.path.lexists(EVAL / 'node_modules/.vite-temp') and not os.path.lexists(base / 'evidence/fixture105-binding.json'), 'preseal_loader_binding_absence')
    provenance = {'schema': 'ci-evaluation-provenance/1', 'source': common, 'profile_policy_sha256': l,
        'quality_policy_sha256': q_hash, 'evaluation_profile': refs('EVAL-PROFILE.json'), 'evaluation_installation': refs('EVAL-INSTALL.json'),
        'quality': refs('QUALITY.json'), 'transfer': refs('TRANSFER.json'), 'dist_graph': refs('DIST-INVENTORY.json')}
    transfer_check(ctx,load_records(records),common)
    validate_metadata(load_records(records), graph(EVAL, 'source'), graph(EVAL / 'node_modules', 'tools'), common, (p, q, l, q_hash), ledger_base=base, preseal_provenance=provenance)
    record(records, 'PROVENANCE.json', provenance)
    ctx.fixture_prepare(base, EVAL, metadata=load_records(records))
    summary = execution_summary(ctx, load_records(records), preseal['identity'], preseal['partition'])
    binding = {'schema': 'ci-partition/2', 'partition': preseal['partition'], 'identity': preseal['identity'],
        'selection': preseal['selection'], 'counts': preseal['counts'], 'execution': {'provenance': refs('PROVENANCE.json'), 'summary': summary}}
    write(base / 'evidence/partition.json', canonical(binding), 65536)
    write(base / 'evidence/bind-build.json', canonical({'label': 'build', 'ok': True, 'errors': [], 'origin': 'transferred',
        'provenance': refs('PROVENANCE.json'), 'dist': baseline['legacy_summary']}))
    outer(ctx, 'postseal')
    return 0


def execution_summary(ctx, records, expected_identity, partition):
    p, q, l, q_hash = policy(ctx)
    need(partition in ('writer', 'rest'), 'summary_partition')
    get = lambda name: pin(records[name])
    quality = parse(records['QUALITY.json'], 32768)
    return {'schema': 'ci-execution-summary/1', 'partition': partition, 'job': 'verify-' + partition,
        'identity': expected_identity, 'origin': 'transferred', 'producer': 'ci-ordinary-npm-producer/1',
        'build_profile': 'desk-full-build/1', 'evaluation_profile': 'desk-evaluation-runtime/1', 'manifest': p['manifest'], 'lock': p['lock'],
        'build_installation': get('BUILD-INSTALL.json'), 'evaluation_installation': get('EVAL-INSTALL.json'), 'quality': get('QUALITY.json'),
        'transfer': get('TRANSFER.json'), 'dist': get('DIST-INVENTORY.json'),
        'quality_gates': [{'name': row['name'], 'exit': 0, 'result': row['result']} for row in quality['gates']],
        'structural_methods_sha256': digest(canonical(q['structural_methods'])), 'settled': True}


def outer(ctx, checkpoint):
    entry();need(checkpoint in ('postseal', 'E0', 'E1', 'EC', 'EF'), 'checkpoint')
    base = ctx.ci_dir(); binding = parse(read(base / 'evidence/partition.json', 65536))
    exact(binding, ('schema', 'partition', 'identity', 'selection', 'counts', 'execution'))
    need(binding['schema'] == 'ci-partition/2' and binding['partition'] == ctx.partition_label(True) and ctx.ROOT == EVAL, 'sealed_partition')
    records = load_records(base / 'tmp/desk-connected-fixture105/bindings')
    expected_identity = binding['identity'];common = {key: expected_identity[key] for key in IDENTITY_KEYS}
    policies = policy(ctx)
    need(expected_identity['profile_policy_sha256'] == policies[2] and expected_identity['quality_policy_sha256'] == policies[3], 'partition_policy')
    actual_source = graph(EVAL, 'source');actual_tools = graph(EVAL / 'node_modules', 'tools')
    observed = source_identity(ctx, {name: [row['bytes'], row['sha256']] for name, row in actual_source.items() if row['type'] == 'file'})
    need(same(observed, common), 'outer_current_source')
    values = validate_metadata(records, actual_source, actual_tools, common, policies, ledger_base=base)
    quality_check(ctx, common, both=True)
    transfer_check(ctx,records,common)
    need(same(dist(ctx, EVAL), values['DIST-INVENTORY.json']), 'transferred_dist_drift')
    need(binding['selection'] == ctx.partition_files(sorted(name for name, row in actual_source.items() if row['type'] == 'file'), binding['partition']) and
         binding['counts'] == list(ctx.PARTITION_COUNTS[binding['partition']]), 'partition_selection')
    exact(binding['execution'], ('provenance', 'summary'))
    reference(binding['execution']['provenance'], records['PROVENANCE.json'], 8192)
    need(same(binding['execution']['summary'], execution_summary(ctx, records, expected_identity, binding['partition'])), 'execution_summary')
    need(len(canonical(binding['execution']['summary'])) <= 16384, 'summary_bound')
    for path in (Path('/tmp/node_modules'), Path('/node_modules'), base / 'home/.node_modules', base / 'home/.node_libraries'):
        need(not os.path.lexists(path), 'ancestor_module_escape')
    ctx.fixture_validate(base, EVAL, True)
    return binding


def validate_summary(ctx, execution, expected_identity, partition):
    """Joint checks only authenticated job outputs, never claims remote filesystem access."""
    exact(execution, ('provenance', 'summary'))
    summary = exact(execution['summary'], ('schema', 'partition', 'job', 'identity', 'origin', 'producer',
        'build_profile', 'evaluation_profile', 'manifest', 'lock', 'build_installation', 'evaluation_installation',
        'quality', 'transfer', 'dist', 'quality_gates', 'structural_methods_sha256', 'settled'))
    p, q, l, q_hash = policy(ctx)
    need(type(partition) is str and partition in ('writer', 'rest') and summary['schema'] == 'ci-execution-summary/1' and
         summary['partition'] == partition and summary['job'] == 'verify-' + partition and summary['identity'] == expected_identity and
         summary['origin'] == 'transferred' and summary['producer'] == p['producer'] and summary['build_profile'] == 'desk-full-build/1' and
         summary['evaluation_profile'] == 'desk-evaluation-runtime/1' and summary['settled'] is True and
         summary['manifest'] == p['manifest'] and summary['lock'] == p['lock'] and
         summary['structural_methods_sha256'] == digest(canonical(q['structural_methods'])) and
         expected_identity['profile_policy_sha256'] == l and expected_identity['quality_policy_sha256'] == q_hash, 'summary_identity')
    for value in [execution['provenance']] + [summary[name] for name in ('manifest', 'lock', 'build_installation', 'evaluation_installation', 'quality', 'transfer', 'dist')]:
        exact(value, P_KEYS);need(0 < uint(value['bytes'], 4194304) and type(value['sha256']) is str and HEX.fullmatch(value['sha256']), 'summary_ref')
    need(type(summary['quality_gates']) is list and len(summary['quality_gates']) == 5, 'summary_gate_population')
    for row, name in zip(summary['quality_gates'], GATES):
        exact(row, ('name', 'exit', 'result'));exact(row['result'], P_KEYS)
        need(row['name'] == name and type(row['exit']) is int and row['exit'] == 0 and
             0 < uint(row['result']['bytes'], 262144) and HEX.fullmatch(row['result']['sha256']), 'summary_gate')
    need(len(canonical(summary)) <= 16384, 'summary_bound')


def retain_bundle(ctx, keep, scope):
    """Retain complete governed producer files; a partial role is never test authority."""
    entry()
    need(scope in ('controls', 'full'), 'retention_scope')
    base = ctx.ci_dir(); metadata_dir = base / 'tmp/desk-connected-fixture105/bindings'
    if not metadata_dir.is_dir():
        keep.problems['errors'].append('producer seal absent; partial/unattempted evaluation')
        return
    outer(ctx, 'EC')
    build = role_base(ctx, 'build'); evaluation = role_base(ctx, 'evaluation')
    members = []
    for name in BINDINGS:
        members.append((metadata_dir / name, 'metadata/' + name, 4194304 if 'INVENTORY' in name else 262144))
    for role, role_root, role_ledger in [('build', BUILD, build), ('evaluation', EVAL, evaluation)]:
        producer = role_ledger / 'evidence/producer'
        for filename in ('stdout', 'stderr', 'owner.json'):
            members.append((producer / 'install' / filename, role + '/install/' + filename, 8388608 if filename != 'owner.json' else 262144))
    for name in GATES:
        for filename in ('stdout', 'stderr', 'result.json', 'owner.json'):
            members.append((build / 'evidence/producer/quality' / name / filename,
                'build/quality/' + name + '/' + filename, 8388608 if filename in ('stdout', 'stderr') else 262144))
    members.append((build / 'evidence/producer/quality/owner.json', 'build/quality/owner.json', 262144))
    for name in ('stdout', 'stderr', 'copy-owner.json', 'owner.json'):
        members.append((evaluation / 'evidence/producer/transfer' / name, 'evaluation/transfer/' + name,
            8388608 if name in ('stdout', 'stderr') else 262144))
    for name in (POLICY_PATH, QUALITY_PATH):
        members.append((EVAL / name, 'policies/' + Path(name).name, 65536))
    for name in ('partition-init.json', 'partition.json', 'fixture105-binding.json'):
        members.append((base / 'evidence' / name, name, 65536))
    need(len(members) + 1 <= 96, 'bundle_member_cap')
    total = 0; manifest = []
    for source, name, cap in members:
        raw = read(source, cap, not str(source).startswith(str(EVAL) + '/fixtures/'))
        total += len(raw);need(total <= 160 * 1024 * 1024, 'bundle_byte_cap')
        manifest.append({'path': name, **pin(raw)})
        keep.copy(source, Path('producer') / name, cap, required=True)
    index = canonical({'schema': 'ci-producer-bundle/1', 'role': 'evaluation', 'members': manifest, 'bytes': total})
    need(total + len(index) <= 160 * 1024 * 1024, 'bundle_index_cap')
    write(keep.upload / 'producer/MANIFEST.json', index)
    outer(ctx, 'EC')


def record_limit(name):
    if 'INVENTORY' in name:
        return 4194304
    if name.endswith('-PROFILE.json') or name.endswith('-INSTALL.json') or name in ('TRANSFER.json', 'COPY-RESULT.json'):
        return 16384
    if name == 'QUALITY.json':
        return 32768
    if 'OPTIONAL-ABSENCES' in name:
        return 32768
    if name in ('PROVENANCE.json', 'ADOPTION.json', 'ROOT.json'):
        return 8192
    return 262144


def strict_cache(base):
    """A settled zero-race cache walk, separate from live output observations."""
    entry(); root = base / 'tmp/npm-cache'; start = observed_directory(root)
    rows = []; count = 0; total = 0
    def visit(path, relative):
        nonlocal count, total
        count += 1;need(count <= 65536, 'cache_entry_bound')
        owned = Owned();primary = None
        try:
            info = path.lstat()
            need(info.st_uid == os.getuid() and info.st_gid == os.getgid() and
                 not stat.S_ISLNK(info.st_mode), 'cache_owner_link')
            if stat.S_ISDIR(info.st_mode):
                need(info.st_mode & 0o777 == 0o700, 'cache_directory_mode')
                fd = owned.open(path, True);before = os.fstat(fd)
                need(metadata(before) == metadata(info), 'cache_directory_race')
                rows.append({'path': relative, 'type': 'directory', 'mode': 0o700})
                for name in sorted(os.listdir(fd)):
                    visit(path / name, relative + '/' + name if relative else name)
                need(metadata(os.fstat(fd)) == metadata(before), 'cache_changed')
            else:
                need(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_mode & 0o777 == 0o600, 'cache_file_shape')
                raw = read(path, 67108864);total += len(raw);need(total <= 1073741824, 'cache_byte_bound')
                rows.append({'path': relative, 'type': 'file', **pin(raw)})
        except BaseException as error:
            primary = error
        owned.finish(primary)
    visit(root, '')
    need(observed_directory(root) == start, 'cache_root_replaced')
    return {'root': start, 'entries': count, 'bytes': total, 'inventory_sha256': digest(canonical(rows)), 'strict': True, 'retained': True}


def persist_pending(base):
    """Independent bounded failure retention only; never retries an uncertain fd."""
    if not POISON:
        return
    path = base / 'evidence/producer/POISON.json'
    fd = None
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        raw = canonical({'schema': 'ci-producer-pending/1', 'pending': POISON[:32], 'held': True})
        need(len(raw) <= 8192, 'pending_record_bound')
        offset = 0
        while offset < len(raw):
            wrote = os.write(fd, raw[offset:]);need(wrote > 0, 'pending_short_write');offset += wrote
        os.fsync(fd)
    except FileExistsError:
        pass  # An existing barrier is never replaced or cleared.
    finally:
        if fd is not None:
            attempted = fd;fd = None
            try:
                os.close(attempted)
            except BaseException as error:
                POISON.append({'resource': 'pending_receipt_descriptor', 'fd': attempted, 'error': type(error).__name__})


LEASES = {}
CANCELLED = None
PENDING_OBJECTS = []
SECONDARY = []
ATTEMPTS = []

# Failure-only job-log labels: no admission, resource or cleanup authority.
BUILD_DIAGNOSTIC_PHASE = None
BUILD_DIAGNOSTIC_PHASES = frozenset(('envelope', 'source-snapshot', 'source-identity',
    'ledger', 'install-policy', 'install-pre-capture', 'install-capture',
    'install-post-capture', 'build-quality'))
BUILD_DIAGNOSTIC_CODES = frozenset((
    'installation_envelope_mask_policy', 'installation_envelope_python_inheritance',
    'installation_cancelled', 'installation_cleanup_pending', 'installation_persisted_cleanup_pending',
    'installation_build_cwd', 'installation_preinstallation_source', 'installation_authenticated_source',
    'installation_record_shape', 'installation_git_identity', 'installation_run_identity',
    'installation_repository', 'installation_source_identity', 'installation_identity_bound',
    'installation_private_creation_contract', 'installation_role', 'installation_runner_temp',
    'installation_role_temp', 'installation_exclusive_role_ledger', 'installation_ancestor_modules',
    'installation_absolute_path', 'installation_leaf_owner_bound', 'installation_leaf_stability',
    'installation_record_bound', 'installation_duplicate_key', 'installation_nonfinite',
    'installation_noncanonical', 'installation_policy_profile', 'installation_logical_policy',
    'installation_literal_install_policy', 'installation_literal_root_roles', 'installation_quality_policy',
    'installation_integer', 'installation_physical_pin', 'installation_reference',
    'installation_path', 'installation_configuration_population', 'installation_fresh_installation',
    'installation_write_bound', 'installation_output_parent_owner', 'installation_output_nlink',
    'installation_short_write', 'installation_unowned_close', 'installation_directory_private',
    'installation_directory_owner', 'installation_graph_root_path', 'installation_graph_limit',
    'installation_graph_parent_owner', 'installation_graph_owner', 'installation_graph_link_shape',
    'installation_graph_writable', 'installation_graph_special_or_hardlink', 'installation_graph_edge_descriptor',
    'installation_graph_directory_bound', 'installation_graph_file_bound', 'installation_graph_file_length',
    'installation_graph_descriptor_or_edge_changed', 'installation_graph_parent_changed', 'installation_graph_record_bound'))


def build_diagnostic_phase(phase):
    global BUILD_DIAGNOSTIC_PHASE
    if BUILD_DIAGNOSTIC_PHASE is not None:
        BUILD_DIAGNOSTIC_PHASE = phase if type(phase) is str and phase in BUILD_DIAGNOSTIC_PHASES else 'unknown'


def build_failure_diagnostic(error):
    """Only exact builtin exception args matching authored literals may leave here."""
    code = 'unknown'
    if type(error) is RuntimeError:
        args = error.args
        if type(args) is tuple and len(args) == 1 and type(args[0]) is str and args[0] in BUILD_DIAGNOSTIC_CODES:
            code = args[0]
    phase = BUILD_DIAGNOSTIC_PHASE
    return {'schema': 'ci-build-failure-diagnostic/1', 'operation': 'producer-build',
            'phase': phase if type(phase) is str and phase in BUILD_DIAGNOSTIC_PHASES else 'unknown', 'code': code}


def open_fd(path, directory=False):
    lease = Owned()
    try:
        fd = lease.open(path, directory)
    except BaseException as error:
        lease.finish(error)
        raise
    need(fd not in LEASES, 'descriptor_reuse_before_handoff')
    LEASES[fd] = lease
    return fd


def close_fd(fd):
    lease = LEASES.pop(fd, None)
    need(lease is not None, 'descriptor_double_close')
    lease.finish()


def command(ctx, operation, *, binding_stdout=False):
    """One command boundary; fixture-binding alone reserves stdout for its wire object."""
    import signal
    import sys
    global CANCELLED, BUILD_DIAGNOSTIC_PHASE
    BUILD_DIAGNOSTIC_PHASE = None
    def cancelled(signum, frame):
        global CANCELLED
        if CANCELLED is None:
            CANCELLED = signum
    old = {signum: signal.signal(signum, cancelled) for signum in (signal.SIGTERM, signal.SIGINT)}
    primary = None; secondary = []; answer = 1
    try:
        entry();answer = operation()
    except BaseException as error:
        primary = error
    finally:
        secondary.extend(SECONDARY[:32])
        if len(SECONDARY)>32:secondary.append({'phase':'secondary','code':'overflow'})
        if CANCELLED is not None:
            POISON.append({'resource': 'cancelled_command', 'signal': CANCELLED})
        if POISON or PENDING_OBJECTS or LEASES:
            try:
                persist_pending(ctx.ci_dir())
            except BaseException as error:
                secondary.append(type(error).__name__)
        if primary is not None and BUILD_DIAGNOSTIC_PHASE is not None:
            try:
                import sys
                diagnostic = json.dumps(build_failure_diagnostic(primary), ensure_ascii=True, separators=(',', ':'))
                if len(diagnostic) + 1 > 512:
                    raise RuntimeError('diagnostic_bound')
                print(diagnostic, file=sys.stderr, flush=True)
            except BaseException as error:
                secondary.append(type(error).__name__)
        result = {'schema': 'ci-role-command/1', 'success': primary is None and not secondary and answer == 0 and
                  CANCELLED is None and not POISON and not PENDING_OBJECTS and not LEASES,
                  'primary': None if primary is None else type(primary).__name__, 'secondary': secondary,
                  'attempted_preservation':list(ATTEMPTS),
                  'cancelled': CANCELLED, 'pending': len(POISON) + len(PENDING_OBJECTS) + len(LEASES)}
        try:
            print(json.dumps(result), file=sys.stderr if binding_stdout else sys.stdout, flush=True)
        except BaseException as error:
            if primary is None:
                primary = error
            else:
                secondary.append(type(error).__name__)
        for signum, handler in old.items():
            try:
                signal.signal(signum, handler)
            except BaseException as error:
                secondary.append(type(error).__name__)
    # A terminal write/render is not the last authority observation.
    return 0 if primary is None and not secondary and answer == 0 and CANCELLED is None and not POISON and not PENDING_OBJECTS and not LEASES else 1


def partial_specs(original):
    """Closed logical evidence population, including unpublished capture records."""
    specs=[]
    for role in ('build','evaluation'):
        base=Path(original)/role/'ci'
        for name in BINDINGS:specs.append((base/'evidence/producer/metadata'/name,Path(role)/'metadata'/name,record_limit(name)))
        for name in ('env.json','identity.json','snapshot-pre.json','build-init.json','partition-init.json','partition.json','bind-pre.json','bind-build.json','fixture105-binding.json'):
            specs.append((base/'evidence'/name,Path(role)/name,4194304 if name=='snapshot-pre.json' else 262144))
        slots=[('install',base/'evidence/producer/install')]
        if role=='build':slots.extend(('quality-'+name,base/'evidence/producer/quality'/name) for name in GATES)
        else:slots.append(('identity-witness',base/'evidence/identity-witness'))
        for label,slot in slots:
            for name in ('stdout','stderr','owner.json','result.json'):
                source=slot/name
                if name in ('stdout','stderr') and not os.path.lexists(source):source=base/'tmp'/('capture-'+label)/('operation.'+name)
                specs.append((source,Path(role)/label/name,8388608 if name in ('stdout','stderr') else 262144))
        if role=='build':specs.append((base/'evidence/producer/quality/owner.json',Path(role)/'quality/owner.json',262144))
        for label,_ in slots:
            for action in ('operation','resolution','identity'):
                for suffix,cap in (('stdout',8388608),('stderr',8388608),('process.json',262144),('json',262144)):
                    specs.append((base/'tmp'/('capture-'+label)/(action+'.'+suffix),Path(role)/'captures'/label/(action+'.'+suffix),cap))
        for name in ('copy-owner.json','owner.json','stdout','stderr'):
            specs.append((base/'evidence/producer/transfer'/name,Path(role)/'transfer'/name,262144 if name.endswith('.json') else 8388608))
        specs.append((base/'evidence/producer/POISON.json',Path(role)/'POISON.json',8192))
        if role=='evaluation':
            for stage in ('prerequisite','focused'):
                for namespace,phases in (('stage-owner',('PREP','BIND','GUARD')),('stage-check',('CHECK',))):
                    slot=base/'evidence'/namespace/stage;relative=Path(role)/namespace/stage
                    specs.append((slot/'owner.json',relative/'owner.json',65536))
                    specs.append((slot/'fatal.json',relative/'fatal.json',65536))
                    for phase in phases:
                        for name in ('owner.json','process.json','stdout','stderr'):
                            source=(base/'evidence'/stage/name if phase=='GUARD' and name in ('stdout','stderr') else slot/phase/name)
                            specs.append((source,relative/phase/name,8388608 if name in ('stdout','stderr') else 65536))
                specs.append((base/'evidence'/('fixture105-before-'+stage+'.json'),Path(role)/('fixture105-before-'+stage+'.json'),262144))
            specs.append((base/'evidence/fixture105-loader-created.json',Path(role)/'fixture105-loader-created.json',262144))
    return specs


def retain_partial(ctx):
    """Lossless bounded aliases; reading a missing source never reconstructs a receipt."""
    need(ctx.ROOT==Path(os.environ['GITHUB_WORKSPACE']) and ctx.ROOT not in (BUILD,EVAL),'original_failure_owner')
    original=Path(os.environ['RUNNER_TEMP']);need(original.is_absolute() and original.resolve()==original,'failure_runner_root')
    target=original/'producer-failure';target.mkdir(mode=0o700);(target/'blobs').mkdir(mode=0o700)
    entries=[];objects={};owners={};problems=[];total=0
    def derived(relative,raw):
        parts=relative.parts
        if (len(parts)==5 and parts[0]=='evaluation' and parts[1] in ('stage-owner','stage-check')
                and parts[2] in ('prerequisite','focused') and parts[3] in ('PREP','BIND','GUARD','CHECK')
                and parts[4] in ('owner.json','process.json')):
            parent=owners.get(str(Path(*parts[:3])/'owner.json'))
            if parent is None:return None
            value,parent_blob=parent;rows=value.get('actions');pointer=None
            if type(rows) is list:
                matches=[i for i,row in enumerate(rows) if type(row) is dict and row.get('phase')==parts[3]]
                if len(matches)==1:
                    pointer=['actions',matches[0]];candidate=rows[matches[0]]
                    if parts[4]=='process.json':pointer.append('launch');candidate=candidate.get('launch')
                    if candidate is not None and (json.dumps(candidate,sort_keys=True)+'\n').encode()==raw:
                        return {'kind':'derived','parent_blob':parent_blob,'pointer':pointer,'encoding':'json-sort-spaces-lf/1'}
            return None
        if len(parts)!=4 or parts[1]!='captures':return None
        role,_,label,filename=parts;parent=owners.get(str(Path(role)/label/'owner.json'))
        if parent is None:return None
        value,parent_blob=parent;action,separator,suffix=filename.partition('.')
        if not separator:return None
        pointer=None;encoding=None;candidate=None
        if suffix=='json':
            rows=value.get('auxiliary_actions')
            if type(rows) is list:
                selected=[index for index,row in enumerate(rows) if type(row) is dict and row.get('label')==action]
                if len(selected)==1:pointer=['auxiliary_actions',selected[0]];candidate=rows[selected[0]];encoding='json-sort-spaces-lf/1'
        elif filename=='operation.process.json' and type(value.get('launch')) is dict:
            pointer=['launch'];candidate=value['launch'];encoding='json-sort-spaces-lf/1'
        elif suffix=='stdout' and action in ('resolution','identity'):
            key='resolution' if action=='resolution' else 'identity_witness';record=value.get(key)
            if type(record) is dict and type(record.get('raw_stdout')) is str:pointer=[key,'raw_stdout'];candidate=record['raw_stdout'];encoding='utf8/1'
        if pointer is None:return None
        encoded=(json.dumps(candidate,sort_keys=True)+'\n').encode() if encoding=='json-sort-spaces-lf/1' else candidate.encode('utf8')
        if encoded!=raw:return None  # A representation mismatch is stored, never normalized away.
        return {'kind':'derived','parent_blob':parent_blob,'pointer':pointer,'encoding':encoding}
    for source,relative,limit in partial_specs(original):
        if not os.path.lexists(source):continue
        try:
            raw=read(source,limit);artifact=ctx.redact(raw,[os.environ.get('TEST_DATABASE_URL') or ''])
            need(len(entries)<256,'partial_logical_cap');raw_pin_value=pin(raw);artifact_pin=pin(artifact)
            recipe=derived(relative,raw) if artifact==raw else None
            if recipe is None:
                key=artifact_pin['sha256'];name='blobs/'+key+'.bin'
                if key in objects:need(read(target/name,8388608)==artifact,'partial_blob_collision')
                else:
                    need(len(objects)<94 and total+len(artifact)<=167772160-524288,'partial_bundle_cap')
                    write(target/name,artifact,8388608);objects[key]=artifact_pin;total+=len(artifact)
                recipe={'kind':'blob','path':name}
                if (relative.name=='owner.json' and artifact==raw and (len(relative.parts)==3 or
                        len(relative.parts)==4 and relative.parts[0]=='evaluation' and relative.parts[1] in ('stage-owner','stage-check'))):
                    try:
                        value=parse(raw,262144,False)
                        if type(value) is dict:owners[str(relative)]=(value,name)
                    except (ValueError,RuntimeError):pass
            if artifact!=raw:problems.append({'logical_path':relative.as_posix(),'code':'redacted','detail':'exact raw bytes not retained in artifact'})
            entries.append({'logical_path':relative.as_posix(),'raw':raw_pin_value,'artifact':artifact_pin,'redacted':artifact!=raw,'representation':recipe})
        except Exception as error:
            problems.append({'logical_path':relative.as_posix(),'code':type(error).__name__,'detail':str(error)[:128]})
    index={'schema':'ci-partial-aliases/1','entries':entries,'physical_objects':len(objects),'physical_bytes':total,
        'complete_present_population':not problems,'problems':problems,'authority':'none; failure evidence only'}
    write(target/'INDEX.json',canonical(index),262144)
    write(target/'HELD.json',canonical({'schema':'ci-producer-partial/1','admitted':False,'native_acceptance':False,
        'index':pin(canonical(index)),'problems':problems,'original_sources_preserved':True}),262144)
    return 0


def diagnostic_final(ctx):
    """The representative route can never produce a merge/full-suite proof."""
    original = ctx.ROOT
    need(original == Path(os.environ['GITHUB_WORKSPACE']), 'original_final_owner')
    role_temp = Path(os.environ['RUNNER_TEMP']) / 'evaluation'
    prior_role_temp = os.environ.get('DESK_CI_ROLE_TEMP')
    producer_upload = os.environ.get('PRODUCER_UPLOAD_OUTCOME')
    reasons = ['one selected native case; full validation remains held']
    if producer_upload != 'success':
        reasons.append('producer retention/upload did not succeed')
    try:
        # Use the authenticated original definitions with a closed evaluation path;
        # never import or execute definitions from a partial clone.
        ctx.ROOT = EVAL
        os.environ['DESK_CI_ROLE_TEMP'] = str(role_temp)
        outer(ctx, 'EF')
        for name in ('NATIVE_OUTCOME', 'NATIVE_UPLOAD_OUTCOME', 'CONTROLS_UPLOAD_OUTCOME', 'UPLOAD_OUTCOME'):
            if os.environ.get(name) != 'success':
                reasons.append(name + ' did not succeed')
        outer(ctx, 'EF')
    except BaseException as error:
        reasons.append('final provenance refused: ' + type(error).__name__)
    finally:
        ctx.ROOT = original
        if prior_role_temp is None:
            os.environ.pop('DESK_CI_ROLE_TEMP', None)
        else:
            os.environ['DESK_CI_ROLE_TEMP'] = prior_role_temp
    print(json.dumps({'schema': 'ci-representative-hold/1', 'final': 'HOLD', 'native_or_full_acceptance': False, 'reasons': reasons}))
    return 78


MODULE_SPECIFIERS = ('@smithy/core', '@smithy/core/transport', '@smithy/core/checksum', '@smithy/node-http-handler', '@smithy/signature-v4',
    'pg', 'pino', 'zod', 'typescript', 'tsx', 'tsx/esm/api', 'vitest/node', 'vitest/config')
MODULE_DERIVED = ('tsx-esbuild', 'tsx-esbuild-binary', 'tsx-get-tsconfig', 'tsx-resolve-pkg-maps',
                  'vitest-vite', 'typescript-cli', 'tsx-cli', 'vitest-cli')
MODULE_BUILD = ('@eslint/js', 'eslint', 'eslint-config-prettier', 'prettier', 'typescript-eslint')
MODULE_PROBE = r"""import fs from 'node:fs';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=process.cwd(),build=root==='/tmp/d';
if((!build&&root!=='/tmp/e')||fs.realpathSync(root)!==root||process.version!=='v24.21.0'||process.env.NODE_PATH||process.env.NODE_OPTIONS)throw Error('fixed_module_root');
const entries={};
function admit(name,value){const p=value.startsWith('file:')?fileURLToPath(value):value;if(!p.startsWith(root+'/node_modules/')||fs.realpathSync(p)!==p||!fs.statSync(p).isFile())throw Error('module_escape');entries[name]=p;return p;}
for(const name of ['@smithy/core','@smithy/core/transport','@smithy/core/checksum','@smithy/node-http-handler','@smithy/signature-v4','pg','pino','zod','typescript','tsx','tsx/esm/api','vitest/node','vitest/config',...(build?['@eslint/js','eslint','eslint-config-prettier','prettier','typescript-eslint']:[])])admit(name,import.meta.resolve(name));
const own=(name)=>createRequire(root+'/node_modules/'+name+'/package.json');
const esbuild=admit('tsx-esbuild',own('tsx').resolve('esbuild'));
admit('tsx-esbuild-binary',createRequire(esbuild).resolve('@esbuild/linux-x64/bin/esbuild'));
const config=admit('tsx-get-tsconfig',own('tsx').resolve('get-tsconfig'));
admit('tsx-resolve-pkg-maps',createRequire(config).resolve('resolve-pkg-maps'));
admit('vitest-vite',own('vitest').resolve('vite/package.json'));
for(const [key,name,bin] of [['typescript-cli','typescript','tsc'],['tsx-cli','tsx','tsx'],['vitest-cli','vitest','vitest']]){const p=root+'/node_modules/'+name;const metadata=JSON.parse(fs.readFileSync(p+'/package.json','utf8'));admit(key,path.resolve(p,typeof metadata.bin==='string'?metadata.bin:metadata.bin[bin]));}
const globals=Module.globalPaths;
for(const p of globals)if(fs.existsSync(p))throw Error('global_module_namespace_present');
process.stdout.write(JSON.stringify({schema:'ci-module-resolution/1',role:build?'build':'evaluation',root,entries,globals})+'\n');
"""


def module_admission(ctx, role, owner, tools_graph):
    """Fresh full graph/metadata checks justify a fixed pinned-Node resolution map.

    This is not a cached graph: every caller acquired all current package bytes and
    symlinks afresh, and rechecks the complete original module-probe owner leaf.
    The actual launcher still resolves entries in its own fresh Node process.
    """
    exact(owner['resolution'], ('result', 'process', 'stdout', 'stderr', 'raw_stdout'))
    probe = owner['resolution'];check_raw_settlement(probe['process'])
    raw = probe['raw_stdout'].encode('utf8');reference(probe['stdout'], raw, 16384)
    need(probe['stderr'] == pin(b''), 'module_probe_stderr')
    result = parse(raw, 16384, False)
    need(same(probe['result'],result),'module_probe_result')
    exact(result, ('schema', 'role', 'root', 'entries', 'globals'))
    root = BUILD if role == 'build' else EVAL
    need(result['schema'] == 'ci-module-resolution/1' and result['role'] == role and result['root'] == str(root), 'module_probe_role')
    entries = result['entries'];exact(entries, MODULE_SPECIFIERS + MODULE_DERIVED + (MODULE_BUILD if role == 'build' else ()))
    for name, value in entries.items():
        need(type(value) is str and value.startswith(str(root / 'node_modules') + '/') and '\\' not in value and
             Path(value).is_absolute() and str(Path(value)) == value and '..' not in Path(value).parts, 'module_probe_escape')
        relative = str(Path(value).relative_to(root / 'node_modules'))
        row = tools_graph.get(relative)
        need(type(row) is dict and row.get('type') == 'file', 'module_probe_payload')
        reference({'bytes': row['bytes'], 'sha256': row['sha256']}, read(Path(value), 67108864, False), 67108864)
    need(type(result['globals']) is list and len(result['globals']) <= 16, 'module_global_bound')
    for name in result['globals']:
        need(type(name) is str and Path(name).is_absolute() and str(Path(name)) == name and not os.path.lexists(name), 'global_module_fallback')
    for alias, target in [('tsc','typescript-cli'), ('tsx','tsx-cli'), ('vitest','vitest-cli')]:
        link = root / 'node_modules/.bin' / alias
        need(link.is_symlink() and str(link.resolve()) == entries[target] and
             tools_graph.get('.bin/' + alias, {}).get('type') == 'symlink', 'module_bin_binding')
    for location in ('test/support/p33-parity-runner.ts', 'test/support/command-postgres-hosted.ts', 'vitest.config.ts'):
        need(Path(location).parts[0] in ('test','vitest.config.ts') and (root / location).is_file(), 'module_source_entry')
    return result


def identity_witness(value, role):
    exact(value, ('schema','role','fingerprints','compared_to_frozen_vectors','extra_provenance_field_refused','admission'))
    need(value['schema']=='ci-semantic-identity-witness/1' and value['role']==role and
         value['compared_to_frozen_vectors'] is True and value['extra_provenance_field_refused'] is True and value['admission'] is False, 'semantic_witness')
    exact(value['fingerprints'],('claims_writing','performance','semantic_audit','render','assembly','ready_candidate'))
    need(all(type(row) is str and HEX.fullmatch(row) for row in value['fingerprints'].values()), 'semantic_fingerprint')
    return value['fingerprints']


def traversal_runtime(ctx):
    """The supervisor's exact root-local namespace; no glob-based adoption."""
    return ctx.ci_dir()/'tmp'/('p33t-'+str(os.getuid())+'-'+digest(str(EVAL).encode())[:24])


def traversal_results(ctx, stdout, stderr, guard):
    problems=[];ctx.check_ledger(guard,'guard',problems,guard=True)
    need(not problems,'traversal_guard_settled')
    summary,problems=ctx.parse_summary(stdout);files=ctx.parse_file_lines(stdout)
    need(not problems and same(summary,{'files':{'passed':1,'total':1},'tests':{'passed':17,'total':17}}),'traversal_ten_cases')
    need(same(files,{'test/unit/fixture105-traversal.test.ts':[{'tests':17,'failed':0,'skipped':0,'todo':0}]}),'traversal_one_file')
    clean=ctx.ANSI.sub('',stdout+'\n'+stderr)
    need(ctx.FAILURE_LINE.search(clean) is None and not any(text in clean for text in ctx.FATAL_TEXT),'traversal_fatal')
    for marker in ('FIXTURE105_NODE_RELATIONS 12/12', 'FIXTURE_TARGET_DIAGNOSTIC_SELFTEST {"schema":"fixture-target-selftest/2","groups":20,"passed":20}'):
        need(sum(line.strip()==marker for line in clean.splitlines())==1,'traversal_marker')


def retain_traversal_runtime(runtime, destination, expected=None):
    """Closed regular-byte copies plus directory/socket/lock metadata, never socket I/O.

    Unknown/partial populations are retained under the same finite bounds, but
    cannot become proof. Existing capture/producer retention remains separate.
    """
    entry();destination.mkdir(mode=0o700);copied=destination/'bytes';copied.mkdir(mode=0o700)
    rows=[];problems=[];total=0;files=0;lease=Owned();primary=None;root_identity=None
    def identity_now(path,info):
        return {'path':str(path),'dev':info.st_dev,'ino':info.st_ino,'uid':info.st_uid,'gid':info.st_gid,'mode':stat.S_IMODE(info.st_mode)}
    try:
        fd=lease.open(runtime,True);root_identity=identity_now(runtime,os.fstat(fd))
        need(same(root_identity,observed_directory(runtime)),'traversal_runtime_identity')
        def walk(directory,descriptor,depth):
            nonlocal total,files
            need(depth<=4,'traversal_runtime_depth')
            before=os.fstat(descriptor);names=sorted(os.listdir(descriptor))
            need(len(names)<=95 and len(rows)+len(names)<=95,'traversal_runtime_entries')
            for name in names:
                need(re.fullmatch(r'[A-Za-z0-9_.-]{1,128}',name) is not None and name not in ('.','..'),'traversal_runtime_name')
                path=directory/name;relative=path.relative_to(runtime).as_posix()
                need(len(relative)<=512,'traversal_runtime_path')
                info=os.stat(name,dir_fd=descriptor,follow_symlinks=False)
                row={'relative_path':relative,'identity':identity_now(path,info),'nlink':info.st_nlink,'bytes':info.st_size}
                rows.append(row);need(len(rows)<=95,'traversal_runtime_entries')
                need(info.st_uid==os.getuid(),'traversal_runtime_uid')
                if stat.S_ISDIR(info.st_mode):
                    row['kind']='directory';need(stat.S_IMODE(info.st_mode)==0o700,'traversal_runtime_directory')
                    child=lease.open(name,flags=os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,parent=descriptor)
                    need(metadata(os.fstat(child))==metadata(info),'traversal_runtime_open_drift')
                    walk(path,child,depth+1);lease.close(child)
                elif stat.S_ISSOCK(info.st_mode):
                    row['kind']='socket_metadata_only'
                    if relative.count('/')!=1 or name!='guard.sock':problems.append('unexpected_socket')
                elif stat.S_ISREG(info.st_mode) and relative=='validation.lock':
                    row['kind']='lock_metadata_only'
                    need(info.st_nlink==1 and stat.S_IMODE(info.st_mode)==0o600 and info.st_size==0,'traversal_runtime_lock')
                elif stat.S_ISREG(info.st_mode):
                    row['kind']='regular';need(info.st_nlink==1 and stat.S_IMODE(info.st_mode)==0o600 and info.st_size<=65536,'traversal_runtime_regular')
                    raw=read(path,65536);total+=len(raw);files+=1
                    need(files<=64 and total<=4194304,'traversal_runtime_bytes')
                    leaf=str(files).zfill(2)+'.bin';write(copied/leaf,raw,65536)
                    row.update(pin(raw),retained_leaf='bytes/'+leaf)
                else:
                    row['kind']='refused_nonregular';problems.append('nonregular')
                need(metadata(os.stat(name,dir_fd=descriptor,follow_symlinks=False))==metadata(info),'traversal_runtime_row_drift')
            need(names==sorted(os.listdir(descriptor)) and metadata(before)==metadata(os.fstat(descriptor)),'traversal_runtime_population_drift')
        walk(runtime,fd,0)
    except BaseException as error:primary=error
    try:lease.finish(primary)
    except BaseException as error:primary=error
    if primary is not None:problems.append(type(primary).__name__)
    attempts=[row for row in rows if row.get('kind')=='directory' and '/' not in row['relative_path']]
    complete=primary is None and not problems and len(attempts)==1
    if complete:
        attempt=attempts[0]['relative_path']
        complete=(re.fullmatch(r'attempt-[a-z0-9_]{8}',attempt) is not None and
            {row['relative_path'] for row in rows}=={'validation.lock',attempt,attempt+'/prerequisite.json',attempt+'/guard.sock',attempt+'/guard-result.json'})
        if expected is not None:
            complete=complete and type(expected) is dict and set(expected)=={'runtime','attempt'} and same(expected['runtime'],root_identity) and same(expected['attempt'],attempts[0]['identity'])
        else:complete=False
    value={'root':root_identity,'entries':rows,'regular_bytes':total,'regular_files':files,
           'scan_complete':primary is None,'expected_population_complete':complete,'problems':problems}
    if not POISON:write(destination/'inventory.json',canonical(value))
    if primary is not None:raise primary
    return value


def settle_traversal_loader(ctx, saved, slot):
    """Move into an exclusive private settlement directory before possible removal.

    A replacement moved at the public pathname is retained, never removed after
    a mismatching identity. The leased inode must also be unlinked afterwards.
    Cross-device settlement refuses before rename; there is no pathname fallback.
    """
    entry();need(ctx.fixture_temp(EVAL,True)==saved and saved.get('leaves')==[],'traversal_loader_unchanged')
    need(observed_directory(EVAL/'node_modules')['dev']==observed_directory(slot)['dev'],'traversal_loader_filesystem')
    quarantine=slot/'loader-settlement';quarantine.mkdir(mode=0o700)
    lease=Owned();primary=None;moved=False;removal_attempted=False
    try:
        parent=lease.open(EVAL/'node_modules',True);held=lease.open('.vite-temp',flags=os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,parent=parent)
        private=lease.open(quarantine,True);private_identity=observed_directory(quarantine)
        info=os.fstat(held);expected=saved['identity']
        need(all(getattr(info,'st_'+key)==expected[key] for key in ('dev','ino','uid')) and stat.S_IMODE(info.st_mode)==expected['mode'] and os.listdir(held)==[],'traversal_loader_descriptor')
        need(os.listdir(private)==[] and ctx.fixture_temp(EVAL,True)==saved,'traversal_loader_recheck')
        os.rename('.vite-temp','loader',src_dir_fd=parent,dst_dir_fd=private);moved=True
        observed=os.stat('loader',dir_fd=private,follow_symlinks=False)
        need(metadata(observed)==metadata(os.fstat(held)) and observed_directory(quarantine)==private_identity and os.listdir(held)==[],'traversal_loader_moved_identity')
        removal_attempted=True;os.rmdir('loader',dir_fd=private)
        after=os.fstat(held)
        need(all(getattr(after,key)==getattr(info,key) for key in ('st_dev','st_ino','st_uid','st_gid','st_mode')) and after.st_nlink==0,'traversal_loader_unlinked_inode')
        need(os.listdir(private)==[] and observed_directory(quarantine)==private_identity and not os.path.lexists(EVAL/'node_modules/.vite-temp'),'traversal_loader_removed')
    except BaseException as error:
        primary=error
        if moved or removal_attempted:POISON.append({'resource':'traversal_loader','pending':True,'phase':'remove' if removal_attempted else 'moved_identity'})
    lease.finish(primary)
    return {'removed_leased_inode':True,'public_path_absent':True,'retained_empty_settlement':str(quarantine)}


def traversal_failed_guard(ctx, slot, runtime, source):
    """Cleanup evidence only for the exact, settled traversal child exit 1.

    This never returns a functional verdict or changes shared capture admission.
    Read back both publications and the original bounded capture records.
    """
    entry();need(not PENDING_OBJECTS and not LEASES,'traversal_failed_pending')
    argv=['/usr/bin/python3','-I','-B','test/support/p33-parity-supervisor.py','guard','fixture105-traversal']
    owner=parse(read(slot/'owner.json',262144))
    exact(owner,('schema','role','argv','cwd','envelope','source','profile_policy_sha256',
        'root_before','root_after','tools_before','tools_after','process','auxiliary_actions',
        'owned_scope_observation','resolution','identity_witness','launch','primary','cleanup','pending','cancelled'))
    identity(source)
    need(owner['schema']=='ci-producer-raw/1' and owner['role']=='evaluation' and owner['argv']==argv and
        owner['cwd']==str(EVAL) and owner['envelope'] is None and same(owner['source'],source) and
        owner['profile_policy_sha256']==policy(ctx)[2] and owner['primary']=='LayoutFailure' and
        owner['cleanup']==[] and owner['pending'] is False and owner['cancelled'] is None and
        owner['resolution'] is None and owner['identity_witness'] is None,'traversal_failed_owner')
    need(same(owner['root_before'],owner['root_after']) and same(owner['root_after'],observed_directory(EVAL)) and
        same(owner['tools_before'],owner['tools_after']) and same(owner['tools_after'],tools(ctx)),'traversal_failed_identity')
    process=owner['process']
    exact(process,('label','argv','exit','direct_reaped','population','streams','settlement',
        'additional_reaps','primary','cleanup_errors','spawn_attempts'))
    need(process['label']=='operation' and process['argv']==['/usr/bin/timeout','--signal=TERM','--kill-after=20s','900s']+argv and
        type(process['exit']) is int and process['exit']==1 and process['direct_reaped'] is True and
        process['settlement']=='complete' and same(process['population'],{'complete':True,'members':[],'children':[],'errors':[]}) and
        process['additional_reaps']==[] and same(process['primary'],{'code':'git_exit','phase':'operation'}) and
        process['cleanup_errors']==[] and type(process['spawn_attempts']) is int and process['spawn_attempts']==1,'traversal_failed_process')
    action={key:value for key,value in process.items() if key!='spawn_attempts'}
    capture=ctx.ci_dir()/'tmp/capture-fixture105-traversal'
    need(same(owner['auxiliary_actions'],[action]) and same(parse(read(capture/'operation.json',262144),canonical_required=False),action),'traversal_failed_action')
    launch=exact(owner['launch'],('pid','pgid'))
    need(type(launch['pid']) is int and launch['pid']>1 and launch['pid']==launch['pgid'] and
        same(parse(read(capture/'operation.process.json',262144),canonical_required=False),launch),'traversal_failed_launch')
    exact(process['streams'],('stdout','stderr'))
    for name in ('stdout','stderr'):
        stream=exact(process['streams'][name],('retained_bytes','sha256','observed_bytes','eof','truncated','complete'))
        raw=read(slot/name,8388608)
        need(stream['eof'] is True and stream['complete'] is True and stream['truncated'] is False and
            type(stream['observed_bytes']) is int and type(stream['retained_bytes']) is int and
            stream['observed_bytes']==stream['retained_bytes']==len(raw) and stream['sha256']==digest(raw) and
            raw==read(capture/('operation.'+name),8388608),'traversal_failed_stream')
    observation=exact(owner['owned_scope_observation'],('strict','entries','bytes','races','race_events_total',
        'race_events_directory','race_events_leaf','race_events_omitted','race_sample_saturated','live_scan_count',
        'scan_work','live_work_total','scan_limit','aggregate_work_limit'))
    need(observation['strict'] is True and uint(observation['entries'],65536)>=0 and
        uint(observation['bytes'],1073741824)>=0 and uint(observation['scan_work'],65536)>=0 and
        observation['scan_limit']==464 and observation['aggregate_work_limit']==464*65536 and
        uint(observation['live_scan_count'],464)>=0 and uint(observation['live_work_total'],464*65536)>=0,
        'traversal_failed_disk')
    for key in ('race_events_total','race_events_directory','race_events_leaf','race_events_omitted'):
        uint(observation[key],464*65536)
    need(type(observation['races']) is list and len(observation['races'])<=64 and
        observation['race_events_total']==len(observation['races'])+observation['race_events_omitted']==
        observation['race_events_directory']+observation['race_events_leaf'] and
        observation['race_sample_saturated'] is (observation['race_events_omitted']>0),'traversal_failed_disk')
    children=[]
    with os.scandir(runtime) as scan:
        for child in scan:
            need(len(children)<2,'traversal_one_guard');children.append(Path(child.path))
    attempts=[path for path in children if path.name!='validation.lock']
    need(len(children)==2 and len(attempts)==1 and re.fullmatch(r'attempt-[a-z0-9_]{8}',attempts[0].name) is not None,'traversal_one_guard')
    guard=parse(read(attempts[0]/'guard-result.json',65536),canonical_required=False)
    exact(guard,('settled','directReaped','noChildren','complete','residual','errors','cleanupErrors',
        'reaped','discoveryDetails','fatal','containedRejection','namespace'))
    need(all(guard[key] is True for key in ('settled','directReaped','noChildren','complete')) and
        all(guard[key]==[] for key in ('residual','errors','cleanupErrors')) and
        guard['fatal'] is None and guard['containedRejection'] is None,'traversal_failed_guard')
    need(type(guard['reaped']) is list and len(guard['reaped'])==1,'traversal_failed_reap')
    reaped=exact(guard['reaped'][0],('pid','raw','exit'))
    need(type(reaped['pid']) is int and reaped['pid']>1 and reaped['pid']!=launch['pid'] and
        type(reaped['raw']) is int and reaped['raw']==256 and type(reaped['exit']) is int and reaped['exit']==1,'traversal_failed_reap')
    discovery=exact(guard['discoveryDetails'],('scansStarted','scansCompleted','scansFailed','scansNotStarted','reasonCounts','records','droppedRecords'))
    need(type(discovery['scansStarted']) is int and discovery['scansStarted']>0 and
        type(discovery['scansCompleted']) is int and discovery['scansStarted']==discovery['scansCompleted'] and
        all(type(discovery[key]) is int and discovery[key]==0 for key in ('scansFailed','scansNotStarted','droppedRecords')) and
        discovery['reasonCounts']=={} and discovery['records']==[],'traversal_failed_discovery')
    namespace=exact(guard['namespace'],('runtime','attempt'))
    need(same(namespace['runtime'],observed_directory(runtime)) and same(namespace['attempt'],observed_directory(attempts[0])),'traversal_failed_namespace')
    return guard


def run_traversal(ctx):
    """One genuine postseal diagnostic; never a normal focused-stage verdict."""
    entry();need(ctx.ROOT == EVAL and ctx.partition_label(True) == 'rest', 'traversal_role')
    base=ctx.ci_dir();slot=base/'evidence/fixture105-traversal';runtime=traversal_runtime(ctx)
    need(not os.path.lexists(slot) and not os.path.lexists(base/'tmp/capture-fixture105-traversal') and not os.path.lexists(runtime),'traversal_exclusive')
    for name in ('fixture105-before-focused.json','fixture105-loader-created.json'):
        need(not os.path.lexists(base/'evidence'/name), 'traversal_focused_unused')
    need(ctx.fixture_temp(EVAL,True).get('absent') is True, 'traversal_loader_absent')
    outer(ctx,'E0');slot.mkdir(mode=0o700)
    # Compare actual admitted directories, not a pre-creation path assumption.
    modules_identity=observed_directory(EVAL/'node_modules');slot_identity=observed_directory(slot)
    same_filesystem=modules_identity['dev']==slot_identity['dev']
    write(slot/'preflight.json',canonical({'modules':modules_identity,'slot':slot_identity,
        'same_filesystem':same_filesystem,'binding_started':False,'child_started':False}))
    need(same_filesystem,'traversal_loader_filesystem')
    primary=None;secondary=[];saved=None;outcome=None;functional=False;removed=False;guard=None;retained=None
    capture_started=False;failed_guard=False;source=None
    try:
        need(ctx.cmd_fixture_binding('focused') == 0, 'traversal_binding')
        binding,saved=ctx.fixture_validate(base,EVAL,True)
        need(saved.get('leaves') == [] and not saved.get('absent'), 'traversal_loader_created')
        write(slot/'binding-before.json',canonical({'binding':binding,'loader':saved}))
        source=parse(read(base/'evidence/producer/metadata/EVAL-INSTALL.json',16384))['source']
        capture_started=True
        outcome=owned_capture(ctx,'evaluation',slot,
            ['/usr/bin/python3','-I','-B','test/support/p33-parity-supervisor.py','guard','fixture105-traversal'],900,source)
        check_raw_settlement(outcome)
        runtime_children=sorted(runtime.iterdir());attempts=[path for path in runtime_children if path.name!='validation.lock']
        need(len(runtime_children)==2 and len(attempts)==1 and re.fullmatch(r'attempt-[a-z0-9_]{8}',attempts[0].name) is not None,'traversal_one_guard')
        guard=parse(read(attempts[0]/'guard-result.json',65536),canonical_required=False)
        traversal_results(ctx,read(slot/'stdout',8388608).decode('utf8'),read(slot/'stderr',8388608).decode('utf8'),guard)
        write(slot/'guard-result.json',canonical(guard),65536);functional=True
    except BaseException as error:primary=error
    finally:
        if capture_started and outcome is None and type(primary).__name__=='LayoutFailure' and not POISON and not CANCELLED:
            try:
                guard=traversal_failed_guard(ctx,slot,runtime,source);failed_guard=True
                write(slot/'guard-result.json',canonical(guard),65536)
            except BaseException as error:
                secondary.append({'phase':'failed_settlement','code':type(error).__name__})
        # Each remaining safe operation is independent; first failure is retained.
        for phase,work in (('outer_after',lambda:outer(ctx,'E1')),
            ('runtime_retention',lambda:retain_traversal_runtime(runtime,slot/'runtime-retained',None if guard is None else guard.get('namespace')))):
            try:
                value=work()
                if phase=='runtime_retention':
                    retained=value;need(value['expected_population_complete'],'traversal_runtime_complete')
            except BaseException as error:
                secondary.append({'phase':phase,'code':type(error).__name__})
                if primary is None:primary=error
        if saved is not None and not POISON and not CANCELLED and not secondary:
            try:
                owner=parse(read(slot/'owner.json',262144),canonical_required=False)
                if failed_guard:
                    need(same(guard,traversal_failed_guard(ctx,slot,runtime,source)),'traversal_failed_guard_drift')
                    row=next(row for row in retained['entries'] if row['relative_path'].endswith('/guard-result.json'))
                    need(same(parse(read(slot/'runtime-retained'/row['retained_leaf'],65536),canonical_required=False),guard),'traversal_failed_retained_guard')
                else:check_raw_settlement(owner['process'])
                need(not owner['cleanup'] and not owner['pending'] and owner['cancelled'] is None,'traversal_owner_clean')
                settle_traversal_loader(ctx,saved,slot);removed=True;outer(ctx,'E1')
            except BaseException as error:
                secondary.append({'phase':'loader_cleanup','code':type(error).__name__})
                if primary is None:primary=error
        SECONDARY.extend(secondary)
        if not POISON:
            try:
                write(slot/'result.json',canonical({'functional_complete':functional,'loader_removed':removed,
                    'quality_acceptance':False,'native_executed':False,'remaining_route':'HOLD',
                    'runtime_inventory':None if retained is None else pin(canonical(retained)),
                    'primary':None if primary is None else type(primary).__name__,'secondary':secondary,
                    'successful_proof':primary is None and functional and removed and not CANCELLED and not PENDING_OBJECTS and not LEASES}))
            except BaseException as error:
                SECONDARY.append({'phase':'traversal_result','code':type(error).__name__})
                if primary is None:primary=error
    if primary is not None:raise primary
    need(functional and removed,'traversal_incomplete')
    return 0


def run_identity(ctx):
    entry();binding=outer(ctx,'E0')
    base=ctx.ci_dir();slot=base/'evidence/identity-witness';slot.mkdir(mode=0o700)
    owned_capture(ctx,'evaluation',slot,['node','--import','tsx','test/support/installation-identity.ts'],30,{key:binding['identity'][key] for key in IDENTITY_KEYS})
    value=parse(read(slot/'stdout',16384),16384,False)
    actual=identity_witness(value,'evaluation')
    build=role_base(ctx,'build')/'evidence/producer/quality/structural/owner.json'
    owner=parse(read(build,262144));before=identity_witness(owner['identity_witness']['result'],'build')
    need(actual==before,'semantic_projection_changed')
    outer(ctx,'E1')
    record(slot,'result.json',{'schema':'ci-semantic-identity-comparison/1','build':before,'evaluation':actual,'all_six_equal':True,'admission':False})
    return 0
