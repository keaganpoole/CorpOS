"""Offline tenant-boundary regression tests; imports the Phase 1 network guard."""
import asyncio
import unittest
from types import SimpleNamespace
from backend.test_phase1_security import FakeDatabase, OWNER, OTHER
from backend.authorization import (Tenant, ScopedClient, current_tenant, resolve_tenant,
    tenant_scope, require_record, validate_references, scenario_tenant, BUSINESS_TABLES, OWNER_TABLES)
from fastapi import HTTPException
from backend.security import issue_internal_context, verify_internal_context


class TenantBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeDatabase()
        self.db.rows['users'].append({'id': OTHER, 'account_status': 'active'})
        self.a = Tenant(OWNER, 1, OWNER)
        self.b = Tenant(OTHER, 2, OTHER)
        for table in BUSINESS_TABLES | OWNER_TABLES:
            self.db.rows[table] = [{'id': 'a', 'business_id': 1, 'user_id': OWNER},
                                   {'id': 'b', 'business_id': 2, 'user_id': OTHER}]
        self.client = ScopedClient(self.db)

    def test_every_registered_resource_blocks_other_tenant(self):
        for table in sorted(BUSINESS_TABLES | OWNER_TABLES):
            with self.subTest(table=table), tenant_scope(self.a):
                self.assertEqual([r['id'] for r in self.client.table(table).select('*').execute().data], ['a'])
                self.assertEqual(self.client.table(table).select('*').eq('id','b').execute().data, [])
                self.assertEqual(self.client.table(table).update({'notes':'safe'}).eq('id','b').execute().data, [])
                self.assertEqual(self.client.table(table).delete().eq('id','b').execute().data, [])

    def test_foreign_record_and_nested_context_rejected(self):
        for key in ['person_id','appointment_id','staff_id','service_id','receptionist_id',
                    'scenario_id','payment_id','invoice_id','integration_id','document_id','call_log_id']:
            with self.subTest(key=key), self.assertRaises(HTTPException):
                validate_references(self.db, self.a, {'agent':{'nested': [{key:'b'}]}})

    def test_forged_owner_fields_rejected(self):
        for field, value in [('business_id',2),('businessId',2),('user_id',OTHER),('created_by',OTHER)]:
            with self.subTest(field=field), self.assertRaises(HTTPException):
                validate_references(self.db,self.a,{'nested':{field:value}})

    def test_unowned_inserts_fail_closed(self):
        for table in BUSINESS_TABLES | OWNER_TABLES:
            with self.subTest(table=table), tenant_scope(self.a), self.assertRaises(HTTPException):
                self.client.table(table).insert({'id':'new'}).execute()

    def test_valid_insert_and_reference_work(self):
        with tenant_scope(self.a):
            rows = self.client.table('appointments').insert({'id':'new','business_id':1,'person_id':'a'}).execute().data
            self.assertEqual(rows[0]['id'],'new')
            self.assertEqual(require_record(self.db,self.a,'people','a')['id'],'a')

    def test_user_without_business_and_closed_user(self):
        for actor in ['unknown', OWNER]:
            if actor == OWNER: self.db.rows['users'][0]['account_status']='closed'
            with self.subTest(actor=actor), self.assertRaises(HTTPException): resolve_tenant(self.db,actor)

    def test_scenario_business_owner_must_agree(self):
        with self.assertRaises(HTTPException): scenario_tenant(self.db,{'user_id':OWNER,'business_id':2})
        self.assertEqual(scenario_tenant(self.db,{'user_id':OWNER,'business_id':1}).business_id,1)

    def test_unknown_tables_and_rpc_fail_closed(self):
        with tenant_scope(self.a):
            with self.assertRaises(HTTPException): self.client.table('new_unregistered_table').select('*')
            with self.assertRaises(HTTPException): self.client.rpc('claim_due_scenario_jobs')

    def test_context_reset_on_failure(self):
        with self.assertRaises(RuntimeError):
            with tenant_scope(self.a): raise RuntimeError('synthetic')
        self.assertIsNone(current_tenant.get())

    def test_concurrent_contexts_never_share_identity(self):
        async def check(tenant, expected):
            with tenant_scope(tenant):
                await asyncio.sleep(0)
                self.assertEqual(self.client.table('people').select('*').execute().data[0]['id'],expected)
        async def run(): await asyncio.gather(check(self.a,'a'),check(self.b,'b'))
        asyncio.run(run())

    def test_nested_tenant_switch_rejected(self):
        with tenant_scope(self.a), self.assertRaises(HTTPException):
            with tenant_scope(self.b): pass

    def test_resolution_uses_database_not_user_metadata(self):
        self.assertEqual(resolve_tenant(self.db,OWNER).business_id,1)

    def test_tool_context_purpose_expiry_and_tampering(self):
        secret='synthetic-secret-for-offline-tests'
        token=issue_internal_context(secret,{'id':1,'user_id':OWNER})
        self.assertEqual(verify_internal_context(secret,token)['business_id'],'1')
        for invalid in [token+'x',issue_internal_context(secret,{'id':1,'user_id':OWNER},lifetime=-1)]:
            with self.assertRaises(HTTPException): verify_internal_context(secret,invalid)
        with self.assertRaises(HTTPException): verify_internal_context('different',token)


if __name__ == '__main__': unittest.main()
