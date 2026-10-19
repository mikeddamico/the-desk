#!/usr/bin/python3
"""Read-only environment capture. No project import or extraction."""
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess

root = Path(__file__).resolve().parents[2]
out = root / '.parity-boundary-versions.json'
data = {'os_release': Path('/etc/os-release').read_text(), 'kernel': platform.release(),
        'image_version': os.getenv('ImageVersion'), 'image_os': os.getenv('ImageOS'),
        'python': platform.python_version(), 'cpu_count': os.cpu_count(),
        'meminfo': Path('/proc/meminfo').read_text(), 'commands': {}}
for name, args in [('node', ['--version']), ('npm', ['--version']), ('unzip', ['-v'])]:
    path = shutil.which(name)
    if not path:
        raise RuntimeError('missing executable: ' + name)
    path = os.path.realpath(path)
    result = subprocess.run([path, *args], stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=5, check=True)
    if len(result.stdout) > 65536:
        raise RuntimeError('version output bound')
    data['commands'][name] = {'path': path, 'sha256': hashlib.sha256(Path(path).read_bytes()).hexdigest(),
                             'output': result.stdout.decode(errors='strict')}
data['vitest'] = json.loads((root/'node_modules/vitest/package.json').read_text())['version']
data['unzip_package'] = subprocess.run(['dpkg-query', '-W', '-f=${Version}', 'unzip'],
    stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    timeout=5, check=True).stdout.decode()
with out.open('x') as stream:
    stream.write(json.dumps(data, indent=2)+'\n')
if (data['commands']['node']['output'].strip() != 'v24.21.0' or
        data['commands']['npm']['output'].strip() != '11.19.0' or data['vitest'] != '4.1.11'):
    raise RuntimeError('required Node/npm/Vitest versions do not match')
print('Environment record saved; no extraction performed.')
