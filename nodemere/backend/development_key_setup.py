"""Explicit Windows-only development configuration and DPAPI recovery artifacts.

Never use this single-machine setup as the production/off-server backup plan.
Generated secrets are written only by this provisioning operation, not printed.
"""
import argparse
import base64
import ctypes
import json
import os
from pathlib import Path
import subprocess
from dotenv import dotenv_values, set_key


class Blob(ctypes.Structure):
    _fields_ = [('size', ctypes.c_ulong), ('data', ctypes.POINTER(ctypes.c_ubyte))]


def protect(content, *, decrypt=False):
    if os.name != 'nt': raise RuntimeError('This development recovery setup requires Windows')
    buffer=ctypes.create_string_buffer(content)
    source=Blob(len(content),ctypes.cast(buffer,ctypes.POINTER(ctypes.c_ubyte))); target=Blob()
    crypt=ctypes.windll.crypt32
    if decrypt:
        ok=crypt.CryptUnprotectData(ctypes.byref(source),None,None,None,None,1,ctypes.byref(target))
    else:
        ok=crypt.CryptProtectData(ctypes.byref(source),'Nodemere development only',None,None,None,1,ctypes.byref(target))
    if not ok: raise RuntimeError('Windows protection operation failed')
    try: return ctypes.string_at(target.data,target.size)
    finally: ctypes.windll.kernel32.LocalFree(target.data)


def private_directory(path):
    path=Path(path); path.mkdir(parents=True,exist_ok=True)
    sid=subprocess.check_output(['whoami','/user','/fo','csv','/nh'],text=True).strip().split(',')[-1].strip('"')
    subprocess.run(['icacls',str(path),'/inheritance:r','/grant:r',f'*{sid}:(OI)(CI)F','*S-1-5-18:(OI)(CI)F'],check=True,capture_output=True)
    return path


def setup():
    root=Path(__file__).resolve().parents[1]
    project=dotenv_values(root/'.env'); backend=root/'backend'/'.env'
    values={**project,**dotenv_values(backend)}
    from urllib.parse import urlsplit
    if urlsplit(values.get('SUPABASE_URL') or values.get('VITE_SUPABASE_URL') or '').hostname!='grpgmhhtmfiwukncucaq.supabase.co':
        raise RuntimeError('Unexpected development project')
    if values.get('NODEMERE_ENV')=='production' or os.getenv('RENDER'):
        raise RuntimeError('Development only')
    directory=private_directory(Path(os.environ['LOCALAPPDATA'])/'Nodemere'/'security-development')
    recovery=private_directory(directory/'key-recovery')
    private_directory(directory/'backups')
    backup=recovery/'development-keks.dpapi'
    existing=values.get('NODEMERE_KEK_RING')
    if existing:
        ring=json.loads(existing)
        if any(not key.startswith('dev-') for key in ring): raise RuntimeError('Refusing to replace a non-development keyring')
    elif backup.exists():
        ring=json.loads(protect(backup.read_bytes(),decrypt=True))
    else:
        ring={label:base64.b64encode(os.urandom(32)).decode() for label in ['dev-local-v1','dev-local-v2']}
    payload=json.dumps(ring,sort_keys=True)
    if backup.exists():
        if json.loads(protect(backup.read_bytes(),decrypt=True))!=ring: raise RuntimeError('Recovery copy differs; refusing overwrite')
    else:
        backup.write_bytes(protect(payload.encode()))
    assert json.loads(protect(backup.read_bytes(),decrypt=True))==ring
    for name,value in {'NODEMERE_KEK_RING':payload,'NODEMERE_ACTIVE_KEK':values.get('NODEMERE_ACTIVE_KEK') or 'dev-local-v1',
                       'NODEMERE_ENCRYPTION_MODE':'encrypt-new','NODEMERE_AUDIT_MODE':'enforced','NODEMERE_ENV':'development'}.items():
        set_key(str(backend),name,value)
    # Restrict the file containing all backend secrets, without altering parent ACLs.
    sid=subprocess.check_output(['whoami','/user','/fo','csv','/nh'],text=True).strip().split(',')[-1].strip('"')
    subprocess.run(['icacls',str(backend),'/inheritance:r','/grant:r',f'*{sid}:F','*S-1-5-18:F'],check=True,capture_output=True)
    return {'development_key_configured':True,'recovery_copy_verified':True,'windows_user_bound':True,
            'production_key':False,'backup_directory':str(directory)}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--activate-development',action='store_true',required=True)
    parser.parse_args()
    try: print(json.dumps(setup()))
    except Exception: raise SystemExit('Development key setup stopped; no key material was printed.')
