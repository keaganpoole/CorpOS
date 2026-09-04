"""Versioned server-side envelope encryption. No password/PIN key derivation.

KEKs are deployment secrets; only wrapped random DEKs enter the database.
Reads always recognize encrypted values, even when new-write encryption is off.
"""
import base64
import json
import os
import re
from uuid import uuid4
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import HTTPException
from postgrest.exceptions import APIError

PREFIX = 'ndmenc:v1:'
MAGIC = b'NDMENC1\n'


class KeyUnavailable(HTTPException):
    def __init__(self):
        super().__init__(503, 'Protected data is temporarily unavailable')


def b64(value): return base64.b64encode(value).decode('ascii')
def unb64(value): return base64.b64decode(value, validate=True)
def canonical(value): return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()


def writes_enabled():
    production = bool(os.getenv('RENDER')) or os.getenv('NODEMERE_ENV', '').lower() == 'production'
    mode = os.getenv('NODEMERE_ENCRYPTION_MODE', 'encrypt-new' if production else 'read-compatible')
    if mode not in {'read-compatible', 'encrypt-new'}: raise KeyUnavailable()
    # A missing/mistyped deployment setting must not silently launch a PHI
    # workload in plaintext compatibility mode. Local synthetic development
    # remains compatible; production rollout requires migrations and keys first.
    if production and mode != 'encrypt-new': raise KeyUnavailable()
    return mode == 'encrypt-new'


def encryption_required(db, business_id):
    if writes_enabled(): return True
    try:
        return bool(db.table('business_data_keys').select('id').eq('business_id',business_id).limit(1).execute().data)
    except APIError as exc:
        # Explicit pre-migration compatibility only. Authorization/network/key
        # failures must not turn encrypted file writes into plaintext writes.
        if getattr(exc,'code',None) in {'42P01','PGRST205'}: return False
        raise KeyUnavailable() from None
    except Exception:
        raise KeyUnavailable() from None


def keyring():
    try:
        values = json.loads(os.environ['NODEMERE_KEK_RING'])
        active = os.environ['NODEMERE_ACTIVE_KEK']
        keys = {k: unb64(v) for k, v in values.items()}
        if not keys or active not in keys or any(len(v) != 32 or not re.fullmatch(r'[a-zA-Z0-9_-]{1,64}', k) for k, v in keys.items()):
            raise ValueError()
        return keys, active
    except Exception:
        raise KeyUnavailable() from None


class Envelope:
    def __init__(self, db, ring=None, active=None):
        self.db = db
        # Explicit ring injection is for isolated tests/recovery drills only.
        self.ring, self.active = ring, active
        self._current = {}

    def keys(self):
        return (self.ring, self.active) if self.ring is not None else keyring()

    @staticmethod
    def wrap_aad(row):
        return canonical(['nodemere', 'dek', 1, str(row['business_id']), row['id']])

    def unwrap(self, row):
        try:
            keys, _ = self.keys()
            return AESGCM(keys[row['kek_id']]).decrypt(unb64(row['nonce']), unb64(row['wrapped_key']), self.wrap_aad(row))
        except Exception:
            raise KeyUnavailable() from None

    def current(self, business_id):
        try:
            if business_id in self._current: return self._current[business_id]
            rows = self.db.table('business_data_keys').select('*').eq('business_id', business_id).eq('active', True).limit(1).execute().data
            if rows:
                result = rows[0], self.unwrap(rows[0])
                self._current[business_id] = result
                return result
            # No historical fallback: provision RPC refuses if historical keys
            # exist but none is active. Missing key never means regenerate it.
            keys, active = self.keys()
            row = {'id': str(uuid4()), 'business_id': business_id, 'kek_id': active}
            dek, nonce = os.urandom(32), os.urandom(12)
            row.update(nonce=b64(nonce), wrapped_key=b64(AESGCM(keys[active]).encrypt(nonce, dek, self.wrap_aad(row))))
            result = self.db.rpc('nodemere_provision_data_key', {'candidate': row}).execute().data
            if isinstance(result, list): result = result[0]
            answer = result, self.unwrap(result)
            self._current[business_id] = answer
            return answer
        except Exception:
            raise KeyUnavailable() from None

    def seal(self, content, *, business_id, resource, record_id, field):
        row, dek = self.current(business_id)
        nonce = os.urandom(12)
        aad = canonical(['nodemere', 'data', 1, str(business_id), resource, str(record_id), field, row['id']])
        return {'v': 1, 'key_id': row['id'], 'nonce': b64(nonce), 'ciphertext': b64(AESGCM(dek).encrypt(nonce, content, aad))}

    def open(self, envelope, *, business_id, resource, record_id, field):
        try:
            if set(envelope) != {'v', 'key_id', 'nonce', 'ciphertext'} or envelope['v'] != 1: raise ValueError()
            rows = self.db.table('business_data_keys').select('*').eq('id', envelope['key_id']).eq('business_id', business_id).limit(1).execute().data
            if not rows: raise ValueError()
            nonce = unb64(envelope['nonce'])
            if len(nonce) != 12: raise ValueError()
            aad = canonical(['nodemere', 'data', 1, str(business_id), resource, str(record_id), field, envelope['key_id']])
            return AESGCM(self.unwrap(rows[0])).decrypt(nonce, unb64(envelope['ciphertext']), aad)
        except Exception:
            raise KeyUnavailable() from None

    def rewrap(self, row):
        dek = self.unwrap(row)
        keys, active = self.keys()
        nonce = os.urandom(12)
        candidate = dict(row, kek_id=active, nonce=b64(nonce), wrapped_key=b64(AESGCM(keys[active]).encrypt(nonce, dek, self.wrap_aad(row))))
        # Verify before committing; RPC compare-and-swaps the previous wrapper.
        if self.unwrap(candidate) != dek: raise KeyUnavailable()
        return self.db.rpc('nodemere_rewrap_data_key', {'key_id': row['id'], 'previous_wrapper': row['wrapped_key'],
            'new_kek_id': active, 'new_nonce': candidate['nonce'], 'new_wrapper': candidate['wrapped_key']}).execute().data

    def encode(self, value, *, json_column=False, **context):
        if value is None: return None
        if is_encrypted(value): raise KeyUnavailable()  # callers provide plaintext, never arbitrary ciphertext
        payload = self.seal(canonical(value), **context)
        return {'_nodemere_envelope': payload} if json_column else PREFIX + b64(canonical(payload))

    def decode(self, value, **context):
        if not is_encrypted(value): return value
        try:
            payload = value['_nodemere_envelope'] if isinstance(value, dict) else json.loads(unb64(value[len(PREFIX):]))
            return json.loads(self.open(payload, **context))
        except Exception: raise KeyUnavailable() from None


def is_encrypted(value):
    return (isinstance(value, dict) and '_nodemere_envelope' in value) or (isinstance(value, str) and value.startswith('ndmenc:'))


def seal_file(db, content, *, business_id, bucket, path):
    if not encryption_required(db,business_id): return content
    env = Envelope(db).seal(content, business_id=business_id, resource=bucket, record_id=path, field='bytes')
    return MAGIC + canonical(env)


def open_file(db, content, *, business_id, bucket, path):
    if not content.startswith(MAGIC): return content
    try:
        return Envelope(db).open(json.loads(content[len(MAGIC):]), business_id=business_id, resource=bucket, record_id=path, field='bytes')
    except Exception: raise KeyUnavailable() from None
