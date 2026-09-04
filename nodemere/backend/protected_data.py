"""Small persistence adapter for existing server-only payload columns.

Authorization stays in ScopedClient/RLS. This adapter neither grants access nor
accepts a tenant supplied by the browser. No plaintext or key material is logged.
"""
from copy import deepcopy
from types import SimpleNamespace
from uuid import uuid4
from fastapi import HTTPException
from .envelope import Envelope, is_encrypted, writes_enabled, KeyUnavailable

FIELDS = {
    'call_logs': {'transcript_jsonb': True, 'transcript_text': False, 'call_report': True,
                 'analysis_results': True, 'conversation_initiation_data': True},
    'flow_executions': {'flow_context': True, 'pause_data': True, 'trigger_event': True},
    'integrations': {'credentials': True},
}


class ProtectedClient:
    def __init__(self, database):
        from .audit import DatabaseClient
        self.database = DatabaseClient(database)
    def __getattr__(self, name): return getattr(self.database, name)
    def table(self, name):
        return ProtectedQuery(self, name) if name in FIELDS else self.database.table(name)
    from_ = table

    def business(self, table, row):
        if table != 'integrations':
            if row.get('business_id') is None: raise KeyUnavailable()
            return row['business_id']
        rows = self.database.table('businesses').select('id').eq('user_id', row.get('user_id')).limit(2).execute().data
        if len(rows or []) != 1: raise KeyUnavailable()
        return rows[0]['id']

    def decode(self, table, row):
        row = dict(row)
        engine = Envelope(self.database)
        for field in FIELDS[table]:
            if is_encrypted(row.get(field)):
                row[field] = engine.decode(row[field], business_id=self.business(table, row),
                    resource=table, record_id=row['id'], field=field)
        row.pop('security_revision', None)
        return row

    def encode(self, table, values, existing=None):
        row = dict(values)
        engine = Envelope(self.database)
        context = {**(existing or {}), **row}
        if context.get('id') is None: row['id'] = context['id'] = str(uuid4())
        for field, json_column in FIELDS[table].items():
            if field in row and row[field] is not None:
                row[field] = engine.encode(row[field], json_column=json_column,
                    business_id=self.business(table, context), resource=table, record_id=context['id'], field=field)
        return row


class ProtectedQuery:
    def __init__(self, client, table, operation=None, values=None, options=None, steps=(), columns='*'):
        self.client, self.name, self.operation = client, table, operation
        self.values, self.options, self.steps, self.columns = values, options or {}, steps, columns

    def select(self, columns='*', **kwargs):
        return ProtectedQuery(self.client, self.name, 'select', options=kwargs, steps=self.steps, columns=columns)
    def insert(self, values, **kwargs): return ProtectedQuery(self.client, self.name, 'insert', deepcopy(values), kwargs)
    def upsert(self, values, **kwargs): return ProtectedQuery(self.client, self.name, 'upsert', deepcopy(values), kwargs)
    def update(self, values, **kwargs): return ProtectedQuery(self.client, self.name, 'update', deepcopy(values), kwargs)
    def delete(self, **kwargs): return ProtectedQuery(self.client, self.name, 'delete', options=kwargs)

    def __getattr__(self, name):
        if name == 'not_':
            return ProtectedQuery(self.client, self.name, self.operation, self.values, self.options, self.steps + (('not_', (), {}),), self.columns)
        def chain(*args, **kwargs):
            return ProtectedQuery(self.client, self.name, self.operation, self.values, self.options, self.steps + ((name, args, kwargs),), self.columns)
        return chain

    def filters(self, query):
        for method, args, kwargs in self.steps:
            query = getattr(query, method) if method == 'not_' else getattr(query, method)(*args, **kwargs)
        return query

    def read(self):
        columns = self.columns
        # Extra routing IDs are used only to authenticate ciphertext and removed
        # from explicit projections afterward. Do not decrypt unrequested fields.
        requested = {c.strip() for c in columns.split(',')}
        if columns != '*' and requested & FIELDS[self.name].keys():
            columns = ','.join(dict.fromkeys([*columns.split(','), 'id', 'user_id' if self.name == 'integrations' else 'business_id']))
        result = self.filters(self.client.database.table(self.name).select(columns, **self.options)).execute()
        def decode(row):
            decoded = self.client.decode(self.name, row)
            return decoded if self.columns == '*' else {k: v for k, v in decoded.items() if k in requested}
        if isinstance(result.data, list): result.data = [decode(row) for row in result.data]
        elif isinstance(result.data, dict): result.data = decode(result.data)
        return result

    def execute(self):
        if self.operation == 'select': return self.read()
        db = self.client.database
        sensitive_write = self.operation in {'insert', 'upsert', 'update'} and any(
            set(row) & FIELDS[self.name].keys() for row in (self.values if isinstance(self.values, list) else [self.values]))
        if not sensitive_write or not writes_enabled():
            query = getattr(db.table(self.name), self.operation)(self.values, **self.options) if self.values is not None else db.table(self.name).delete(**self.options)
            result = self.filters(query).execute()
            if isinstance(result.data, list): result.data = [self.client.decode(self.name, row) for row in result.data]
            return result
        if self.operation == 'insert':
            values = [self.client.encode(self.name, row) for row in self.values] if isinstance(self.values, list) else self.client.encode(self.name, self.values)
            result = db.table(self.name).insert(values, **self.options).execute()
        elif self.operation == 'update':
            if not self.steps: raise HTTPException(400, 'Protected update requires a record filter')
            existing = self.filters(db.table(self.name).select('*')).limit(201).execute().data or []
            if len(existing) > 200: raise HTTPException(400, 'Protected update batch is too large')
            rows = []
            for row in existing:
                values = self.client.encode(self.name, self.values, row)
                result = db.table(self.name).update(values).eq('id', row['id']).eq('security_revision', row['security_revision']).execute()
                if not result.data: raise HTTPException(409, 'Record changed; reload before retrying')
                rows.extend(result.data)
            result = SimpleNamespace(data=rows, count=None)
        else:
            # The existing application uses upsert for these tables only on ID.
            # Other conflict targets cannot safely rebind ciphertext to a row.
            if self.options.get('on_conflict', 'id') != 'id': raise HTTPException(400, 'Protected upsert requires a stable record ID')
            values = self.values if isinstance(self.values, list) else [self.values]
            if len(values) > 200: raise HTTPException(400, 'Protected upsert batch is too large')
            rows = []
            for value in values:
                if not value.get('id'): raise HTTPException(400, 'Protected upsert requires a record ID')
                existing = db.table(self.name).select('*').eq('id', value['id']).limit(1).execute().data
                encoded = self.client.encode(self.name, value, existing[0] if existing else None)
                if existing:
                    updated = db.table(self.name).update(encoded).eq('id', value['id']).eq('security_revision', existing[0]['security_revision']).execute()
                    if not updated.data: raise HTTPException(409, 'Record changed; reload before retrying')
                else:
                    updated = db.table(self.name).insert(encoded).execute()
                rows.extend(updated.data or [])
            result = SimpleNamespace(data=rows, count=None)
        result.data = [self.client.decode(self.name, row) for row in (result.data or [])]
        return result
