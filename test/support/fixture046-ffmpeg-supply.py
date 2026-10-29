#!/usr/bin/python3
"""Fixed fixture046 artifact replay. No APT, solver, arbitrary selectors or image publication."""
import base64
import concurrent.futures
import hashlib
import json
import lzma
import os
from pathlib import Path
import re
import shutil
import signal
import stat
import subprocess
import sys
import tempfile
import threading
import urllib.request
import uuid

SOURCE = Path(__file__).resolve().parents[2] / 'fixtures/frozen-master046-toolchain'
ROOT = Path('/tmp/the-desk-fixture046-runtime')
LOCAL_IMAGE = 'sha256:9cfb2ec0ff3d93fbfdf1b0e1845044a2857fb3e017f36256a765a56c0cd7bedc'
CAP = 1048576
# Filled from the reviewed public lock/profile, not a mutable network lookup.
LOCK_SHA = 'b15c3dd040f41e9a60c9dc127a38003a2fc9083808f1c4cb1ec20f07cfa16485'
PROFILE_SHA = '46705afa025f02bebf7248c78fed648408cf156ab791102d77c47287893e91a7'
ENV = dict(os.environ)
for selector in ('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH'):
    ENV.pop(selector, None)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def require(condition):
    if not condition:
        raise RuntimeError('fixture046 supply refused')


def fixed_data():
    raw = (SOURCE / 'artifact-lock.json').read_bytes()
    require(len(raw) <= CAP and digest(raw) == LOCK_SHA)
    lock = json.loads(raw)
    profile = json.loads((SOURCE / 'execution-profile.json').read_bytes())
    require(digest(canonical(profile)) == PROFILE_SHA)
    require(profile['artifact_lock_sha256'] == LOCK_SHA)
    require(len(lock['packages']) == 200 and len(lock['base_inventory']) == 88)
    require(len(lock['installed_inventory']) == 288 and len(lock['libraries']) == 214)
    require(sum(row['size'] for row in lock['packages']) == 133898884)
    require(len({row['package'] for row in lock['packages']}) == 200)
    require(not ({row['package'] for row in lock['packages']} & {row['package'] for row in lock['base_inventory']}))
    require(all(row['architecture'] in ('amd64', 'all') for row in lock['packages']))
    index_raw = (SOURCE / 'debian-bookworm-slim.index.json.raw').read_bytes()
    manifest_raw = (SOURCE / 'debian-bookworm-slim.amd64-manifest.json.raw').read_bytes()
    require(digest(index_raw) == lock['base']['index'].split(':')[1])
    require(digest(manifest_raw) == lock['base']['image'].split('@sha256:')[1])
    index = json.loads(index_raw)
    selected = [row for row in index['manifests'] if row.get('platform', {}).get('os') == 'linux'
                and row.get('platform', {}).get('architecture') == 'amd64']
    require(len(selected) == 1 and selected[0]['digest'] == lock['base']['image'].split('@')[1])
    manifest = json.loads(manifest_raw)
    config = base64.b64decode(manifest['config']['data'], validate=True)
    require('sha256:' + digest(config) == lock['base']['config'] == manifest['config']['digest'])
    require(len(config) == manifest['config']['size'] and json.loads(config)['architecture'] == 'amd64'
            and json.loads(config)['os'] == 'linux')
    for item in lock['metadata']:
        raw = (SOURCE / item['file']).read_bytes()
        require(len(raw) == item['bytes'] and digest(raw) == item['sha256'])
    # These are historical signatures/provenance, not live APT freshness authority.
    for suite in ('bookworm', 'bookworm-security'):
        signed = (SOURCE / (suite + '.InRelease')).read_text()
        compressed = (SOURCE / (suite + '.Packages.xz')).read_bytes()
        want = [digest(compressed), str(len(compressed)), 'main/binary-amd64/Packages.xz']
        require(any(line.split() == want for line in signed.splitlines()))
        decoder = lzma.LZMADecompressor()
        payload = decoder.decompress(compressed, max_length=64 * 1024 * 1024)
        require(decoder.eof and len(payload) < 64 * 1024 * 1024)
        # All locked package facts must still be present in the retained signed index.
        records = {}
        for paragraph in payload.decode().split('\n\n'):
            fields = {}
            for line in paragraph.splitlines():
                if ': ' in line and not line.startswith((' ', '\t')):
                    key, value = line.split(': ', 1)
                    fields[key] = value
            if 'Filename' in fields:
                records[fields['Filename']] = fields
        for package in lock['packages']:
            security = package['repository'].endswith('/debian-security/')
            if security != (suite == 'bookworm-security'):
                continue
            row = records.get(package['filename'])
            require(row is not None)
            for a, b in [('package', 'Package'), ('version', 'Version'), ('architecture', 'Architecture'), ('sha256', 'SHA256')]:
                require(package[a] == row[b])
            require(str(package['size']) == row['Size'])
    return lock, profile


def cli_path(local):
    return '/usr/local/bin/docker' if local else '/usr/bin/docker'


# One fixed fixture ownership journal. It is not an arbitrary resource manager.
OWNER = None


class PreparationInterrupted(BaseException):
    pass


def interrupted(signum, frame):
    raise PreparationInterrupted('fixture046 preparation interrupted')


def atomic_record(name, value):
    require(name in ('ownership.json', 'receipt.json', 'cleanup.json'))
    data = canonical(value) + b'\n'
    require(len(data) <= 65536)
    descriptor, temporary = tempfile.mkstemp(prefix='.fixture046-record-', dir=ROOT)
    try:
        with os.fdopen(descriptor, 'wb') as output:
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, ROOT / name)
        directory = os.open(ROOT, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def save_owner():
    require(OWNER is not None)
    atomic_record('ownership.json', OWNER)


def command(docker, args, name, timeout=180):
    # Ownership precedes process launch. A killed Python process leaves a pending
    # command in the journal; later cleanup never mistakes it for reaping proof.
    import resource

    def limit():
        resource.setrlimit(resource.RLIMIT_FSIZE, (CAP, CAP))

    require(re.fullmatch(r'[a-z0-9-]{1,100}', name) is not None)
    if OWNER is not None:
        OWNER['active_command'] = name
        OWNER['command_pending'] = True
        save_owner()
    process = None
    primary = None
    traceback = None
    settled = False
    try:
        with (ROOT / (name + '.stdout')).open('xb') as out, (ROOT / (name + '.stderr')).open('xb') as err:
            process = subprocess.Popen(
                [docker, '--host=unix:///var/run/docker.sock'] + args,
                stdin=subprocess.DEVNULL, stdout=out, stderr=err,
                env=ENV, preexec_fn=limit)
            process.wait(timeout=timeout)
            settled = True
    except BaseException as error:
        primary, traceback = error, error.__traceback__
    finally:
        if process is None:
            settled = True
        elif not settled:
            try:
                process.kill()
            except BaseException:
                pass
            try:
                process.wait(timeout=5)
                settled = True
            except BaseException:
                settled = False
        if OWNER is not None:
            OWNER['command_pending'] = not settled
            OWNER['client_uncertain'] = OWNER['client_uncertain'] or not settled
            if not settled and OWNER['uncertain_command'] is None:
                OWNER['uncertain_command'] = name
            try:
                save_owner()
            except BaseException as error:
                if primary is None:
                    primary, traceback = error, error.__traceback__
    if primary is not None:
        raise primary.with_traceback(traceback)
    require(settled and process is not None and process.returncode == 0)
    data = (ROOT / (name + '.stdout')).read_bytes()
    require(len(data) <= CAP and (ROOT / (name + '.stderr')).stat().st_size <= CAP)
    return data

def inventory(raw):
    rows = []
    for line in raw.decode().splitlines():
        package, version, architecture, status = line.split('\t')
        rows.append({'package': package, 'version': version, 'architecture': architecture, 'status': status})
    return sorted(rows, key=lambda row: row['package'])


def expected_identity(lock):
    return {'inventory': sorted(lock['installed_inventory'], key=lambda row: row['package']),
            'executables': lock['executables'], 'libraries': lock['libraries'],
            'loader': lock['loader'], 'version_capture_sha256': lock['version_capture_sha256'],
            'build_configuration_sha256': lock['build_configuration_sha256']}


def acquire(lock):
    stop = threading.Event()
    directory = ROOT / 'packages'
    directory.mkdir(mode=0o700)

    def one(package):
        if stop.is_set():
            raise RuntimeError('acquisition stopped')
        require(package['repository'] in ('https://deb.debian.org/debian/', 'https://deb.debian.org/debian-security/'))
        filename = package['filename']
        require(filename.startswith('pool/') and '..' not in Path(filename).parts)
        target = directory / Path(filename).name
        try:
            size = 0
            sha = hashlib.sha256()
            with urllib.request.urlopen(package['repository'] + filename, timeout=60) as response, target.open('xb') as output:
                require(response.status == 200 and response.geturl().startswith(package['repository']))
                while True:
                    data = response.read(1048576)
                    if not data:
                        break
                    size += len(data)
                    require(size <= package['size'])
                    sha.update(data)
                    output.write(data)
            require(size == package['size'] and sha.hexdigest() == package['sha256'])
            return {'package': package['package'], 'version': package['version'], 'architecture': package['architecture'], 'filename': filename, 'bytes': size, 'sha256': sha.hexdigest()}
        except BaseException:
            stop.set()
            raise

    # One request per locked file, no retry or mirror/version substitution.
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(one, package) for package in lock['packages']]
        verified = [future.result() for future in futures]
    (ROOT / 'acquisition.json').write_text(json.dumps({'schema': 'fixture046-package-acquisition/1',
        'packages': verified, 'package_count': 200, 'package_bytes': 133898884}, indent=2) + '\n')


IDENTIFY = r'''set -eu
export LC_ALL=C
/usr/bin/sha256sum /usr/bin/ffmpeg /usr/bin/ffprobe > /evidence/executables.txt
/usr/bin/sha256sum /lib64/ld-linux-x86-64.so.2 > /evidence/loader.txt
printf '%s\n' '0dafc1360bb07743f76abeb1e4ae16b0aaa1331e9041a0e8d6a8524111dc0cbb  /usr/bin/ffmpeg' '0e598fe6d247bfe63757f5c839dc145a166b3f876f2875ca88a306a5b8ec5a58  /usr/bin/ffprobe' '02bcda52c1a5dfc236f94d9e5255b4a0e26347d8a372a5223b650e31f291ce3c  /lib64/ld-linux-x86-64.so.2' | /usr/bin/sha256sum -c -
/usr/bin/ffmpeg -version > /evidence/version.txt 2>&1
/usr/bin/ffmpeg -buildconf > /evidence/build.txt 2>&1
/usr/bin/ldd /usr/bin/ffmpeg > /evidence/ldd.txt
/usr/bin/awk '$2 == "=>" && $3 ~ /^\// {print $3} $1 ~ /^\// {print $1}' /evidence/ldd.txt | /usr/bin/sort -u > /evidence/library-paths.txt
while IFS= read -r library; do /usr/bin/sha256sum "$library"; done < /evidence/library-paths.txt > /evidence/libraries.txt
/usr/bin/dpkg-query -W -f='${Package}\t${Version}\t${Architecture}\t${db:Status-Status}\n' > /evidence/inventory.tsv
'''
INSTALL = r'''set -eu
export LC_ALL=C DEBIAN_FRONTEND=noninteractive
/usr/bin/dpkg-query -W -f='${Package}\t${Version}\t${Architecture}\t${db:Status-Status}\n' > /evidence/base-inventory.tsv
PATH=/usr/sbin:/usr/bin:/sbin:/bin /usr/bin/dpkg --unpack /packages/*.deb
PATH=/usr/sbin:/usr/bin:/sbin:/bin /usr/bin/dpkg --configure --pending
PATH=/usr/sbin:/usr/bin:/sbin:/bin /usr/bin/dpkg --audit > /evidence/audit.txt
'''


def hashes(name):
    return {path: sha for sha, path in (line.split('  ', 1) for line in (ROOT / name).read_text().splitlines())}


def inspect_identity(lock):
    paths = hashes('libraries.txt')
    require(len(paths) == 214 and paths == {row['path']: row['sha256'] for row in lock['libraries']})
    require('not found' not in (ROOT / 'ldd.txt').read_text())
    actual = {'inventory': inventory((ROOT / 'inventory.tsv').read_bytes()),
              'executables': hashes('executables.txt'), 'libraries': [{'path': row['path'], 'sha256': paths[row['path']]} for row in lock['libraries']],
              'loader': {'path': lock['loader']['path'], 'sha256': hashes('loader.txt').get(lock['loader']['path'])},
              'version_capture_sha256': digest((ROOT / 'version.txt').read_bytes()),
              'build_configuration_sha256': digest((ROOT / 'build.txt').read_bytes())}
    require(actual == expected_identity(lock))
    return digest(canonical(actual))


def mount_args():
    return ['--network', 'none', '--env', 'HTTP_PROXY=', '--env', 'HTTPS_PROXY=',
            '--env', 'http_proxy=', '--env', 'https_proxy=', '--env', 'ALL_PROXY=',
            '--env', 'all_proxy=', '--env', 'NO_PROXY=', '--env', 'no_proxy=',
            '--mount', 'type=bind,src=' + str(ROOT) + ',dst=/evidence']


def owned_container_absent(docker, name, label):
    data = command(docker, ['container', 'ls', '--all', '--no-trunc', '--filter',
                           'name=^/' + name + '$', '--format', '{{.ID}}'], label, timeout=10)
    return data.strip() == b''


def reserve_container(docker, name, label):
    require(OWNER is not None)
    require(owned_container_absent(docker, name, label))
    entry = {'name': name, 'id': None, 'launch_acknowledged': False, 'removed': False}
    OWNER['containers'].append(entry)
    save_owner()  # Registered before the only allocation/launch request.
    return entry


def terminal_success(state):
    return (state['Status'] == 'exited' and state['Running'] is False and state['Pid'] == 0
            and state['Error'] == '' and state['ExitCode'] == 0 and state['OOMKilled'] is False)


def remove_owned_container(docker, entry, label, successful=False):
    name = entry['name']
    if owned_container_absent(docker, name, label + '-population'):
        # An absent name after an unacknowledged launch can race an in-flight
        # allocation. Retain uncertainty rather than asserting an empty success.
        require(entry['launch_acknowledged'] or entry['removed'])
        entry['removed'] = True
        save_owner()
        return
    identifier = command(docker, ['inspect', '--format', '{{.Id}}', name], label + '-id', timeout=10).decode().strip()
    require(re.fullmatch(r'[0-9a-f]{64}', identifier) is not None)
    require(entry['id'] in (None, identifier))
    entry['id'] = identifier
    save_owner()
    state = json.loads(command(docker, ['inspect', '--format', '{{json .State}}', identifier], label + '-state', timeout=10))
    if successful:
        require(terminal_success(state))
    elif state['Running']:
        command(docker, ['kill', '--signal', 'KILL', identifier], label + '-kill', timeout=10)
    if state['Status'] != 'created':
        waited = command(docker, ['wait', identifier], label + '-wait', timeout=10)
        require(not successful or waited.strip() == b'0')
    state = json.loads(command(docker, ['inspect', '--format', '{{json .State}}', identifier], label + '-final', timeout=10))
    require(not state['Running'] and state['Pid'] == 0 and state['Status'] in ('created', 'exited') and not state['Error'])
    require(not successful or terminal_success(state))
    command(docker, ['rm', identifier], label + '-remove', timeout=10)
    entry['removed'] = True
    save_owner()


def image_at_handle(docker, owner, label):
    handle = owner['image_handle']
    require(handle == 'desk-fixture046-runtime:owned-' + owner['token'])
    population = command(docker, ['image', 'ls', '--no-trunc', '--filter',
                                 'reference=' + handle, '--format', '{{.ID}}'], label + '-population', timeout=10)
    if not population.strip():
        return None
    image = json.loads(command(docker, ['image', 'inspect', '--format', '{{json .}}', handle], label + '-inspect', timeout=10))
    require(re.fullmatch(r'sha256:[0-9a-f]{64}', image['Id']) is not None)
    require(image['Config']['Labels'].get('fixture046.owner') == owner['token'])
    require(owner['image_id'] in (None, image['Id']))
    owner['image_id'] = image['Id']
    save_owner()
    return image['Id']


def reconcile_owned(owner, label, remove_image):
    docker = owner['docker_cli']
    # Save uncertainty from an enclosing KILL before subsequent control commands
    # update their own state. No stored PID is used as authority to kill a process.
    if owner['command_pending'] and owner['uncertain_command'] is None:
        owner['uncertain_command'] = owner['active_command']
    owner['client_uncertain'] = owner['client_uncertain'] or owner['command_pending']
    save_owner()
    complete = True
    for index, entry in enumerate(owner['containers']):
        if entry['removed']:
            continue
        try:
            remove_owned_container(docker, entry, label + '-container-' + str(index))
        except BaseException:
            complete = False
    if remove_image and owner['image_reserved'] and not owner['image_removed']:
        try:
            identifier = image_at_handle(docker, owner, label + '-image')
            require(identifier is not None)
            removed = command(docker, ['image', 'rm', owner['image_handle']], label + '-image-remove', timeout=10)
            # Untagging alone is not evidence that the owned image was deleted.
            require(('Deleted: ' + identifier) in removed.decode().splitlines())
            owner['image_removed'] = True
            save_owner()
        except BaseException:
            complete = False
    complete = complete and not owner['client_uncertain']
    owner['cleanup'] = 'complete' if complete else 'pending'
    save_owner()
    return complete


def read_owner():
    info = ROOT.lstat()
    require(ROOT.is_dir() and not ROOT.is_symlink() and info.st_uid == os.getuid() and info.st_mode & 0o077 == 0)
    descriptor = os.open(ROOT / 'ownership.json', os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, 'rb') as source:
        leaf = os.fstat(source.fileno())
        require(stat.S_ISREG(leaf.st_mode) and leaf.st_uid == os.getuid() and leaf.st_nlink == 1)
        raw = source.read(65537)
    require(len(raw) <= 65536)
    owner = json.loads(raw)
    require(set(owner) == {'schema', 'token', 'docker_cli', 'local', 'preparation', 'containers',
                          'image_handle', 'image_reserved', 'image_id', 'image_removed',
                          'active_command', 'command_pending', 'client_uncertain', 'uncertain_command', 'cleanup'})
    require(owner['schema'] == 'fixture046-supply-owner/1')
    require(re.fullmatch(r'[0-9a-f]{32}', owner['token']) is not None)
    require(owner['docker_cli'] in ('/usr/bin/docker', '/usr/local/bin/docker'))
    for key in ('local', 'image_reserved', 'image_removed', 'command_pending', 'client_uncertain'):
        require(type(owner[key]) is bool)
    require(owner['preparation'] in ('pending', 'failed', 'ready') and owner['cleanup'] in ('pending', 'complete'))
    require(owner['active_command'] is None or re.fullmatch(r'[a-z0-9-]{1,100}', owner['active_command']) is not None)
    require(owner['uncertain_command'] is None or re.fullmatch(r'[a-z0-9-]{1,100}', owner['uncertain_command']) is not None)
    require(owner['uncertain_command'] is None or owner['client_uncertain'])
    require(not owner['command_pending'] or owner['active_command'] is not None)
    require(owner['image_handle'] == (None if owner['local'] else 'desk-fixture046-runtime:owned-' + owner['token']))
    require(owner['image_id'] is None or re.fullmatch(r'sha256:[0-9a-f]{64}', owner['image_id']) is not None)
    if owner['local']:
        require(not owner['image_reserved'] and not owner['image_removed'] and owner['image_id'] in (None, LOCAL_IMAGE))
    else:
        require(owner['image_id'] is None or owner['image_reserved'])
        require(not owner['image_removed'] or owner['image_reserved'])
    allowed = {'desk-fixture046-signature-0', 'desk-fixture046-signature-1', 'desk-fixture046-runtime-prepare'}
    require(isinstance(owner['containers'], list) and len(owner['containers']) <= 3)
    require(len({entry['name'] for entry in owner['containers']}) == len(owner['containers']))
    for entry in owner['containers']:
        require(set(entry) == {'name', 'id', 'launch_acknowledged', 'removed'})
        require(entry['name'] in allowed and type(entry['launch_acknowledged']) is bool and type(entry['removed']) is bool)
        require(entry['id'] is None or re.fullmatch(r'[0-9a-f]{64}', entry['id']) is not None)
    return owner


def export_registration():
    if os.environ.get('RUNNER_TEMP'):
        destination = Path(os.environ['RUNNER_TEMP']) / 'ci/evidence/fixture046-runtime.json'
        destination.write_bytes((ROOT / 'receipt.json').read_bytes())


def prepare(local):
    global OWNER
    os.umask(0o077)
    ROOT.mkdir(mode=0o700)
    token = uuid.uuid4().hex
    docker = cli_path(local)
    OWNER = {'schema': 'fixture046-supply-owner/1', 'token': token, 'docker_cli': docker,
             'local': local, 'preparation': 'pending', 'containers': [],
             'image_handle': None if local else 'desk-fixture046-runtime:owned-' + token,
             'image_reserved': False, 'image_id': None, 'image_removed': False,
             'active_command': None, 'command_pending': False, 'client_uncertain': False,
             'uncertain_command': None, 'cleanup': 'pending'}
    save_owner()
    receipt = {'schema': 'fixture046-runtime-registration/1', 'status': 'failed',
               'profile_sha256': PROFILE_SHA, 'artifact_lock_sha256': LOCK_SHA,
               'image_id': None, 'identity_sha256': None, 'docker_cli': docker,
               'image_owned': not local, 'containers': [], 'cleanup': 'pending'}
    previous_term = signal.signal(signal.SIGTERM, interrupted)
    primary_failure = False
    try:
        lock, profile = fixed_data()
        if local:
            image = LOCAL_IMAGE
        else:
            command(docker, ['pull', '--platform', 'linux/amd64', lock['base']['image']], 'base-pull')
            base = json.loads(command(docker, ['image', 'inspect', '--format', '{{json .}}', lock['base']['image']], 'base-inspect'))
            require(base['Id'] == lock['base']['config'] and base['Architecture'] == 'amd64' and base['Os'] == 'linux')
            for index, suite in enumerate(('bookworm', 'bookworm-security')):
                name = 'desk-fixture046-signature-' + str(index)
                entry = reserve_container(docker, name, 'signature-absent-' + str(index))
                receipt['containers'].append(name)
                command(docker, ['run', '--name', name, '--network', 'none', '--log-driver', 'none',
                        '--mount', 'type=bind,src=' + str(SOURCE) + ',dst=/metadata,readonly',
                        lock['base']['image'], '/usr/bin/gpgv', '--status-fd', '1', '--keyring',
                        '/usr/share/keyrings/debian-archive-keyring.gpg', '/metadata/' + suite + '.InRelease'], 'signature-' + str(index))
                entry['launch_acknowledged'] = True
                save_owner()
                remove_owned_container(docker, entry, 'signature-' + str(index), successful=True)
            acquire(lock)
            image = lock['base']['image']
        (ROOT / 'install-identify.sh').write_text(IDENTIFY if local else INSTALL + IDENTIFY)
        name = 'desk-fixture046-runtime-prepare'
        entry = reserve_container(docker, name, 'prepare-absent')
        receipt['containers'].append(name)
        args = ['run', '--name', name, '--platform', 'linux/amd64', '--pull', 'never', '--log-driver', 'none'] + mount_args()
        if not local:
            args += ['--mount', 'type=bind,src=' + str(ROOT / 'packages') + ',dst=/packages,readonly']
        args += [image, '/usr/bin/env', '-i', 'PATH=/usr/bin:/bin', 'LC_ALL=C', 'TZ=UTC',
                 '/usr/bin/timeout', '--signal=TERM', '--kill-after=20s', '300s', '/bin/sh', '/evidence/install-identify.sh']
        command(docker, args, 'install-identify', timeout=340)
        entry['launch_acknowledged'] = True
        save_owner()
        state = json.loads(command(docker, ['inspect', '--format', '{{json .State}}', name], 'prepare-before-commit', timeout=10))
        require(terminal_success(state))
        if not local:
            require((ROOT / 'audit.txt').read_bytes() == b'')
            actual_base = [{key: value for key, value in row.items() if key != 'status'} for row in inventory((ROOT / 'base-inventory.tsv').read_bytes())]
            require(actual_base == sorted(lock['base_inventory'], key=lambda row: row['package']))
        receipt['identity_sha256'] = inspect_identity(lock)
        if local:
            OWNER['image_id'] = LOCAL_IMAGE
            save_owner()
        else:
            handle = OWNER['image_handle']
            require(not command(docker, ['image', 'ls', '--no-trunc', '--filter', 'reference=' + handle, '--format', '{{.ID}}'], 'commit-absent', timeout=10).strip())
            OWNER['image_reserved'] = True
            save_owner()  # Exact absent handle is durable before uncertain commit.
            identifier = command(docker, ['commit', '--change', 'CMD ["/bin/sh"]', '--change',
                                         'LABEL fixture046.owner=' + token, name, handle], 'commit').decode().strip()
            require(re.fullmatch(r'sha256:[0-9a-f]{64}', identifier) is not None)
            OWNER['image_id'] = identifier
            save_owner()
            require(image_at_handle(docker, OWNER, 'commit') == identifier)
        receipt['image_id'] = OWNER['image_id']
        remove_owned_container(docker, entry, 'prepare', successful=True)
        OWNER['preparation'] = 'ready'
        save_owner()
        receipt['status'] = 'ready'
        receipt['cleanup'] = 'containers_removed_image_retained'
        atomic_record('receipt.json', receipt)
        if not local:
            export_registration()
    except BaseException:
        primary_failure = True
        # Never let receipt/cleanup errors replace the original exception.
        OWNER['preparation'] = 'failed'
        receipt['status'] = 'failed'
        for action in (save_owner, lambda: reconcile_owned(OWNER, 'prepare-failure', True),
                       lambda: atomic_record('receipt.json', receipt),
                       lambda: export_registration() if not local else None):
            try:
                action()
            except BaseException:
                pass
        raise
    finally:
        try:
            signal.signal(signal.SIGTERM, previous_term)
        except BaseException:
            if not primary_failure:
                raise


def cleanup():
    global OWNER
    OWNER = read_owner()
    original_preparation = OWNER['preparation']
    complete = False
    primary = None
    traceback = None
    try:
        complete = reconcile_owned(OWNER, 'cleanup', True)
        if complete and (ROOT / 'packages').exists():
            shutil.rmtree(ROOT / 'packages')
    except BaseException as error:
        primary, traceback = error, error.__traceback__
        complete = False
        OWNER['cleanup'] = 'pending'
        try:
            save_owner()
        except BaseException:
            pass
    # Keep the small journal/logs until collection. Cleanup of a failed
    # preparation never changes that original failed/pending admission.
    try:
        atomic_record('cleanup.json', {'schema': 'fixture046-supply-cleanup/1',
            'status': 'complete' if complete else 'pending',
            'preparation': original_preparation, 'image_id': OWNER['image_id'],
            'image_removed': OWNER['image_removed'],
            'client_uncertain': OWNER['client_uncertain']})
    except BaseException as error:
        if primary is None:
            primary, traceback = error, error.__traceback__
    if primary is not None:
        raise primary.with_traceback(traceback)
    require(complete)


if __name__ == '__main__':
    require(len(sys.argv) == 2 and sys.argv[1] in ('prepare', 'prepare-local', 'cleanup'))
    if sys.argv[1] == 'cleanup':
        cleanup()
    else:
        prepare(sys.argv[1] == 'prepare-local')
