"""One-record, copy-before-switch Storage encryption; never deletes an object.

Use only after a tested database + Storage + separate key backup, with writes
to this record quiesced. Database and Storage do not share a transaction.
"""
import os
from uuid import UUID, uuid4

from .envelope import Envelope, MAGIC, canonical, open_file, KeyUnavailable

RESOURCES = {
    'people_docs': ('storage_path', 10 * 1024 * 1024),
    'call_logs': ('audio_storage_path', 128 * 1024 * 1024),
}


def backfill_file(db, business_id, table, record_id, *, apply=False):
    """Read-only preview by default. Returns counts/flags, never PHI or paths.

    Both legacy and already-encrypted files can be migrated (DEK rotation).
    Originals remain intact for recovery; their later disposal is a separate,
    policy-approved operation. Failed/uncertain commits retain the encrypted
    candidate too: deleting it could destroy a successfully committed file.
    """
    if table not in RESOURCES or isinstance(business_id, bool) or int(business_id) <= 0:
        raise ValueError('Invalid file maintenance target')
    record_id = str(UUID(str(record_id)))
    field, maximum = RESOURCES[table]
    columns = f'id,business_id,{field}'
    columns += ',storage_bucket,file_size' if table == 'people_docs' else ',security_revision'
    rows = db.table(table).select(columns).eq('id', record_id).eq('business_id', business_id).limit(1).execute().data
    if not rows or not rows[0].get(field):
        raise ValueError('File unavailable for this business')
    row = rows[0]
    bucket = os.getenv('DOCUMENT_UPLOAD_BUCKET', 'caller-documents') if table == 'people_docs' else 'call_recordings'
    if table == 'people_docs':
        if row.get('storage_bucket') != bucket:
            raise ValueError('Unexpected document bucket')
        if row.get('file_size') is not None and not 0 <= int(row['file_size']) <= maximum:
            raise ValueError('File exceeds maintenance limit')
    source = row[field]
    # Source is selected from a trusted tenant-scoped row, never from a CLI URL.
    if not isinstance(source, str) or source.startswith(('/', '\\')) or '\\' in source or ':' in source or any(p in {'', '.', '..'} for p in source.split('/')):
        raise ValueError('Invalid stored object path')
    storage = db.storage.from_(bucket)
    original = storage.download(source)
    if not isinstance(original, bytes) or len(original) > maximum * 2:
        raise ValueError('File exceeds maintenance limit')
    if source.endswith('.ndmenc') and not original.startswith(MAGIC):
        raise KeyUnavailable()
    content = open_file(db, original, business_id=business_id, bucket=bucket, path=source)
    if len(content) > maximum:
        raise ValueError('File exceeds maintenance limit')
    result = {'files_verified': 1, 'source_encrypted': original.startswith(MAGIC),
              'files_changed': 0, 'originals_retained': True}
    if not apply:
        return result
    # Force actual encryption even if invoked from a local compatibility-mode
    # process. Key loss or an invalid ring cannot create a plaintext candidate.
    target = f'business/{business_id}/protected/{uuid4().hex}.ndmenc'
    envelope = Envelope(db).seal(content, business_id=business_id, resource=bucket, record_id=target, field='bytes')
    candidate = MAGIC + canonical(envelope)
    if open_file(db, candidate, business_id=business_id, bucket=bucket, path=target) != content:
        raise KeyUnavailable()
    storage.upload(target, candidate, {'content-type': 'application/octet-stream', 'upsert': 'false'})
    saved = storage.download(target)
    if saved != candidate or open_file(db, saved, business_id=business_id, bucket=bucket, path=target) != content:
        raise KeyUnavailable()
    # Detect a provider overwriting the original object during the copy. Still
    # require quiesced writes: no cross-service compare-and-swap is possible.
    if storage.download(source) != original:
        raise ValueError('Source changed; retry after quiescing writes')
    query = db.table(table).update({field: target}).eq('id', record_id).eq('business_id', business_id).eq(field, source)
    if table == 'call_logs':
        query = query.eq('security_revision', row['security_revision'])
    changed = query.execute().data
    if not changed:
        raise ValueError('Record changed; inspect before retrying')
    result['files_changed'] = 1
    return result
