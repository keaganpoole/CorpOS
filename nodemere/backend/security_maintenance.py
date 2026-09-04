"""Explicit, bounded operator actions. Dry-run is the default; never a scheduler.

python -m backend.security_maintenance backfill --business-id 123 --table call_logs
Add --apply --confirm-business-id 123 only after a successful isolated restore.
No key, ciphertext, plaintext record, email, storage URL or token is printed.
"""
import argparse
import json
import os
from uuid import uuid4
from .envelope import Envelope, canonical, b64, KeyUnavailable, is_encrypted
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from .protected_data import ProtectedClient, FIELDS


def backfill(db, business_id, table, *, apply=False, after=None):
    if table not in FIELDS: raise ValueError('Unsupported protected table')
    query = db.table(table).select('*').order('id').limit(100)
    if table == 'integrations':
        rows = db.table('businesses').select('user_id').eq('id',business_id).limit(1).execute().data
        if not rows: raise ValueError('Business unavailable')
        query = query.eq('user_id', rows[0]['user_id'])
    else: query = query.eq('business_id', business_id)
    if after: query = query.gt('id', str(after))
    rows = query.execute().data or []
    protected = ProtectedClient(db)
    plaintext_count, changed = 0, 0
    for row in rows:
        values = {f: row[f] for f in FIELDS[table] if row.get(f) is not None}
        plaintext_count += sum(not is_encrypted(value) for value in values.values())
        # Verify every old envelope before rewriting: corruption/lost keys stop
        # the batch, never replace an unreadable field with empty plaintext.
        decoded = protected.decode(table, row)
        if not apply or not values: continue
        encoded = protected.encode(table, {f: decoded[f] for f in values}, row)
        # Verify the candidate bytes before committing.
        verified = protected.decode(table, {**row, **encoded})
        if any(verified[f] != decoded[f] for f in values): raise KeyUnavailable()
        result = db.table(table).update(encoded).eq('id',row['id']).eq('security_revision',row['security_revision']).execute().data
        if not result: raise ValueError('Concurrent change; rerun the same batch')
        changed += 1
    return {'rows_scanned':len(rows), 'plaintext_fields':plaintext_count, 'rows_changed':changed,
            'next_after':str(rows[-1]['id']) if len(rows)==100 else None}


def rotate_dek(db, business_id):
    engine = Envelope(db)
    previous, _ = engine.current(business_id)
    keys, active = engine.keys()
    row = {'id':str(uuid4()), 'business_id':business_id, 'kek_id':active}
    nonce, dek = os.urandom(12), os.urandom(32)
    row.update(nonce=b64(nonce), wrapped_key=b64(AESGCM(keys[active]).encrypt(nonce,dek,engine.wrap_aad(row))))
    if engine.unwrap(row) != dek: raise KeyUnavailable()
    db.rpc('nodemere_rotate_data_key',{'candidate':row,'expected_active':previous['id']}).execute()
    return {'rotated':True,'historical_keys_preserved':True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['backfill','backfill-file','rewrap','rotate-dek','retention'])
    parser.add_argument('--business-id', type=int, required=True)
    parser.add_argument('--confirm-business-id', type=int)
    parser.add_argument('--table', choices=sorted(set(FIELDS) | {'people_docs'}))
    parser.add_argument('--record-id')
    parser.add_argument('--after')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if args.business_id <= 0: parser.error('Positive business ID required')
    if args.apply and args.confirm_business_id != args.business_id: parser.error('Explicit matching business confirmation is required')
    if args.operation == 'backfill' and not args.table: parser.error('--table required for backfill')
    if args.operation == 'backfill-file' and (args.table not in {'people_docs','call_logs'} or not args.record_id):
        parser.error('--table people_docs|call_logs and --record-id required for backfill-file')
    from .config import supabase_admin
    db = supabase_admin.raw.database
    try:
        if args.operation == 'backfill-file':
            from .file_protection_maintenance import backfill_file
            result = backfill_file(db,args.business_id,args.table,args.record_id,apply=args.apply)
        elif args.operation == 'backfill':
            result = backfill(db,args.business_id,args.table,apply=args.apply,after=args.after)
        elif args.operation == 'retention':
            result = db.rpc('nodemere_retention_batch',{'target_business':args.business_id,'apply_changes':args.apply}).execute().data
        elif args.operation == 'rotate-dek':
            result = rotate_dek(db,args.business_id) if args.apply else {'apply_required':True,'historical_keys_preserved':True}
        else:
            rows = db.table('business_data_keys').select('*').eq('business_id',args.business_id).execute().data or []
            engine = Envelope(db)
            for row in rows:
                engine.unwrap(row)  # Fail before changing ANY wrapper if a key is missing.
            if args.apply:
                for row in rows: engine.rewrap(row)
            result = {'keys_verified':len(rows),'keys_rewrapped':len(rows) if args.apply else 0}
        print(json.dumps(result))
    except Exception:
        parser.exit(1, 'Security maintenance stopped. No secret details were logged; inspect configuration and retry safely.\n')


if __name__ == '__main__': main()
