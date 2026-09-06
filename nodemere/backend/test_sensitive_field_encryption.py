"""Offline coverage for every application-level protected field."""
import json
import os
import unittest
from copy import deepcopy
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import patch

from backend.envelope import MAGIC, b64, is_encrypted, open_file
from backend.contract_service import CONTRACT_BUCKET, upload_sample_to_storage
from backend.protected_data import FIELDS, ProtectedClient, RECORD_ID_FIELDS, OWNER_LINKED_TABLES
from backend.test_phase57_security import MemoryKeys, OWNER, CANARY


class RowsQuery:
    def __init__(self, rows): self.rows, self.filters = rows, []
    def select(self, *args): return self
    def eq(self, key, value): self.filters.append((key, value)); return self
    def limit(self, *args): return self
    def execute(self):
        return SimpleNamespace(data=deepcopy([
            row for row in self.rows
            if all(str(row.get(key)) == str(value) for key, value in self.filters)
        ]))


class MemoryProtectedDatabase:
    def __init__(self):
        self.keys = MemoryKeys()
        self.businesses = [{'id': 1, 'user_id': OWNER}]
    def table(self, name):
        if name == 'business_data_keys': return self.keys.table(name)
        if name == 'businesses': return RowsQuery(self.businesses)
        raise AssertionError(name)
    def rpc(self, name, values): return self.keys.rpc(name, values)


class MemoryStorage:
    def __init__(self): self.objects = {}
    def from_(self, bucket):
        def upload(path, content, options): self.objects[(bucket, path)] = content
        return SimpleNamespace(upload=upload)


class MemoryFileDatabase(MemoryKeys):
    def __init__(self):
        super().__init__()
        self.storage = MemoryStorage()


class SensitiveFieldCoverageTests(unittest.TestCase):
    def setUp(self):
        self.db = MemoryProtectedDatabase()
        self.client = ProtectedClient(self.db)
        env = patch.dict(os.environ, {
            'NODEMERE_ENCRYPTION_MODE': 'encrypt-new',
            'NODEMERE_KEK_RING': json.dumps({'test': b64(os.urandom(32))}),
            'NODEMERE_ACTIVE_KEK': 'test',
        })
        env.start(); self.addCleanup(env.stop)

    def row(self, table):
        row = {'id': str(uuid4()), 'business_id': 1, 'user_id': OWNER}
        if table == 'businesses': row['id'] = 1
        if table in RECORD_ID_FIELDS: row[RECORD_ID_FIELDS[table]] = str(uuid4())
        if table in OWNER_LINKED_TABLES: row.pop('business_id', None)
        return row

    def test_every_registered_field_roundtrips_without_plaintext(self):
        for table, fields in FIELDS.items():
            for field, json_column in fields.items():
                with self.subTest(table=table, field=field):
                    row = self.row(table)
                    clear = {'canary': CANARY} if json_column else CANARY
                    encoded = self.client.encode(table, {field: clear}, row)
                    self.assertTrue(is_encrypted(encoded[field]))
                    self.assertNotIn(CANARY, json.dumps(encoded[field]))
                    decoded = self.client.decode(table, {**row, **encoded})
                    self.assertEqual(decoded[field], clear)

    def test_business_and_owner_linked_rows_use_business_dek(self):
        for table in ['businesses', *sorted(OWNER_LINKED_TABLES)]:
            with self.subTest(table=table):
                field = next(iter(FIELDS[table]))
                row = self.row(table)
                encoded = self.client.encode(table, {field: CANARY}, row)
                self.assertEqual(self.client.decode(table, {**row, **encoded})[field], CANARY)

    def test_new_voice_sample_is_encrypted_before_storage(self):
        db = MemoryFileDatabase()
        content = CANARY.encode()
        saved = upload_sample_to_storage(
            db, contract_id=str(uuid4()), business_id=1,
            filename='sample.wav', content_type='audio/wav', content=content,
        )
        path = saved['storage_path']
        blob = db.storage.objects[(CONTRACT_BUCKET, path)]
        self.assertTrue(path.endswith('.ndmenc'))
        self.assertTrue(blob.startswith(MAGIC))
        self.assertNotIn(content, blob)
        self.assertEqual(open_file(db, blob, business_id=1, bucket=CONTRACT_BUCKET, path=path), content)


if __name__ == '__main__': unittest.main()
