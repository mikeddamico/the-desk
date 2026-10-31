"""Inert until reviewed: one fixed, zero-argument offline signing oracle; no SDK or network."""
import hashlib
import hmac
import json
from pathlib import Path
import sys


def signing(vector, method=None):
    """Independent literal SigV4 construction; production only handles the safe path alphabet."""
    method = method or vector['method']
    body = (bytes.fromhex(vector['body_hex']) if 'body_hex' in vector
            else vector['body_utf8'].encode('utf-8'))
    if method == 'GET':
        body = b''
    payload = hashlib.sha256(body).hexdigest()
    headers = {'host': vector['host'], 'x-amz-content-sha256': payload,
               'x-amz-date': vector['date']}
    if vector.get('token') is not None:
        headers['x-amz-security-token'] = vector['token']
    if method == 'PUT':
        headers.update({'cache-control': 'private,no-store',
                        'content-length': str(len(body)),
                        'content-type': vector['content_type'], 'if-none-match': '*'})
    names = sorted(headers)
    canonical = (method + '\n' + vector['path'] + '\n\n' +
                 ''.join(name + ':' + headers[name] + '\n' for name in names) +
                 '\n' + ';'.join(names) + '\n' + payload)
    day = vector['date'][:8]
    scope = day + '/' + vector['region'] + '/' + vector['service'] + '/aws4_request'
    to_sign = ('AWS4-HMAC-SHA256\n' + vector['date'] + '\n' + scope + '\n' +
               hashlib.sha256(canonical.encode('utf-8')).hexdigest())
    key = ('AWS4' + vector['secret_key']).encode('utf-8')
    for value in (day, vector['region'], vector['service'], 'aws4_request'):
        key = hmac.new(key, value.encode('utf-8'), hashlib.sha256).digest()
    signature = hmac.new(key, to_sign.encode('utf-8'), hashlib.sha256).hexdigest()
    return {'method': method, 'canonical_request': canonical, 'string_to_sign': to_sign,
            'payload_sha256': payload, 'signed_headers': ';'.join(names),
            'signature': signature,
            'authorization': ('AWS4-HMAC-SHA256 Credential=' + vector['access_key'] +
                              '/' + scope + ', SignedHeaders=' + ';'.join(names) +
                              ', Signature=' + signature)}


def main():
    if len(sys.argv) != 1:
        raise SystemExit('fixed zero-argument reference only')
    root = Path(__file__).resolve().parents[2]
    source = root / 'fixtures/durable-pair/signing-reference-inputs.json'
    raw = source.read_bytes()
    if len(raw) > 16384:
        raise SystemExit('input bound')
    data = json.loads(raw)
    for vector in data['published']:
        if signing(vector)['signature'] != vector['signature']:
            raise SystemExit('published signing expectation mismatch: ' + vector['id'])
    for vector in data['rfc4231']:
        message = (bytes.fromhex(vector['data_hex']) if 'data_hex' in vector
                   else vector['data_utf8'].encode('utf-8'))
        if hmac.new(bytes.fromhex(vector['key_hex']), message,
                    hashlib.sha256).hexdigest() != vector['sha256']:
            raise SystemExit('published HMAC expectation mismatch: ' + vector['id'])
    crypto = data['crypto']
    if hmac.new(bytes.fromhex(crypto['rfc4231_case1_key_hex']),
                crypto['rfc4231_case1_message'].encode(), hashlib.sha256).hexdigest() != crypto['rfc4231_case1_expected']:
        raise SystemExit('published HMAC expectation mismatch')
    result = {'schema': 'durable-pair-signing-reference-expected/1',
              'input_sha256': hashlib.sha256(raw).hexdigest(),
              'oracle_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'published_checked': {v['id']: True for v in data['published']},
              'rfc4231_checked': {v['id']: True for v in data['rfc4231']},
              'fixed': {method: signing(data['fixed'], method) for method in ('GET', 'PUT')},
              'empty_key_hmac_abc': hmac.new(b'', b'abc', hashlib.sha256).hexdigest()}
    output = (json.dumps(result, ensure_ascii=True, indent=2) + '\n').encode()
    if len(output) > 16384:
        raise SystemExit('output bound')
    sys.stdout.buffer.write(output)


if __name__ == '__main__':
    main()
