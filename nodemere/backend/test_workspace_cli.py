"""Persistent private agent access: python -m backend.test_workspace_cli --help."""
import argparse
import ctypes
from ctypes import wintypes
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time

import httpx

ROOT = Path(__file__).resolve().parent.parent
DIRECTORY = Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'Nodemere' / 'test-workspace'
VAULT = DIRECTORY / 'connection.dpapi'
URL = 'http://127.0.0.1:8767'


class Blob(ctypes.Structure):
    _fields_ = [('size', wintypes.DWORD), ('data', ctypes.POINTER(ctypes.c_ubyte))]


def crypt(data, decrypt=False):
    if os.name != 'nt':
        raise RuntimeError('Private test access currently requires Windows DPAPI')
    buffer = ctypes.create_string_buffer(data)
    source = Blob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
    target = Blob()
    library = ctypes.WinDLL('crypt32', use_last_error=True)
    function = library.CryptUnprotectData if decrypt else library.CryptProtectData
    function.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p,
                         ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
    function.restype = wintypes.BOOL
    if not function(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(target)):
        raise OSError(ctypes.get_last_error(), 'Cannot unlock private test connection')
    try:
        return ctypes.string_at(target.data, target.size)
    finally:
        kernel = ctypes.WinDLL('kernel32')
        kernel.LocalFree.argtypes = [ctypes.c_void_p]
        kernel.LocalFree(ctypes.cast(target.data, ctypes.c_void_p))


def load():
    if not VAULT.exists():
        raise RuntimeError('Run setup once for the authorized test account')
    return json.loads(crypt(VAULT.read_bytes(), decrypt=True))


def setup(email):
    if email.casefold() != 'keaganpoole2@outlook.com':
        raise RuntimeError('This private helper is reserved for the authorized test account')
    if VAULT.exists():
        previous = load()
        if previous['email'].casefold() != email.casefold():
            raise RuntimeError('An existing connection is bound to another account')
        print(json.dumps({k: previous[k] for k in ('email', 'owner_id', 'business_id')}))
        return
    from .config import supabase_admin
    from .authorization import resolve_tenant
    db = supabase_admin.raw
    rows = db.table('users').select('id,email').ilike('email', email).limit(2).execute().data
    if len(rows) != 1 or rows[0]['email'].casefold() != email.casefold():
        raise RuntimeError('An exact, unique account email is required')
    tenant = resolve_tenant(db, rows[0]['id'])
    if (tenant.role != 'OWNER' or tenant.owner_id != rows[0]['id']
            or tenant.owner_id != '88f964ac-e9a6-4923-8b1e-9446acf2648e' or str(tenant.business_id) != '21'):
        raise RuntimeError('The test account must own its workspace')
    identity = db.auth.admin.get_user_by_id(tenant.owner_id).user
    if not identity or identity.email.casefold() != email.casefold():
        raise RuntimeError('Auth and workspace identities disagree')
    values = {'email': rows[0]['email'], 'owner_id': tenant.owner_id,
              'business_id': tenant.business_id, 'secret': secrets.token_urlsafe(40)}
    DIRECTORY.mkdir(parents=True, exist_ok=True)
    with VAULT.open('xb') as stream:
        stream.write(crypt(json.dumps(values).encode()))
    print(json.dumps({k: values[k] for k in ('email', 'owner_id', 'business_id')}))


def client(values):
    return httpx.Client(base_url=URL, trust_env=False, follow_redirects=False,
                        headers={'Authorization': 'Bearer ' + values['secret']}, timeout=180)


def ensure_running(values):
    with client(values) as connection:
        try:
            result = connection.get('/workspace')
        except httpx.ConnectError:
            DIRECTORY.mkdir(parents=True, exist_ok=True)
            with (DIRECTORY / 'server.log').open('ab') as log:
                subprocess.Popen([sys.executable, '-m', 'backend.test_workspace_cli', 'serve'],
                                 cwd=ROOT, stdout=log, stderr=log, stdin=subprocess.DEVNULL,
                                 creationflags=subprocess.CREATE_NO_WINDOW)
            for _ in range(60):
                time.sleep(0.5)
                try:
                    result = connection.get('/workspace')
                    break
                except httpx.ConnectError:
                    continue
            else:
                raise RuntimeError('Private API did not start; check the local server log')
        result.raise_for_status()
        identity = result.json()
        if (identity['account_email'] != values['email'] or identity['owner_id'] != values['owner_id']
                or str(identity['business_id']) != str(values['business_id'])):
            raise RuntimeError('The private API is serving a different workspace')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('setup').add_argument('--email', required=True)
    commands.add_parser('serve')
    request = commands.add_parser('request')
    request.add_argument('method', choices=['GET', 'POST', 'PUT', 'DELETE'])
    request.add_argument('path')
    request.add_argument('--json-file', type=Path)
    args = parser.parse_args()
    if args.command == 'setup':
        return setup(args.email)
    values = load()
    if args.command == 'serve':
        import uvicorn
        from . import main as api
        from .test_workspace import build_app
        binding = {k: v for k, v in values.items() if k != 'secret'}
        binding['secret_hash'] = hashlib.sha256(values['secret'].encode()).hexdigest()
        uvicorn.run(build_app(binding, api), host='127.0.0.1', port=8767, proxy_headers=False,
                    access_log=False, log_level='warning')
        return
    if not args.path.startswith('/') or args.path.startswith('//') or '://' in args.path:
        raise RuntimeError('Use a relative API path')
    ensure_running(values)
    payload = json.loads(args.json_file.read_text(encoding='utf-8-sig')) if args.json_file else None
    with client(values) as connection:
        response = connection.request(args.method, args.path, json=payload)
        print(response.text)
        response.raise_for_status()


if __name__ == '__main__':
    main()
