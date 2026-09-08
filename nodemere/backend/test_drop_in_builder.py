"""Builder contract tests. No provider calls or live customer records."""
import copy
import unittest
from datetime import datetime, timezone
from uuid import uuid4
from types import SimpleNamespace
from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend.authorization import ScopedClient, Tenant, tenant_scope
from backend.drop_ins import DropInBuilder, build_router, clean_builder
from backend.test_drop_ins import Database, OWNER


def node(parent_id=None, **extra):
    return dict(id=str(uuid4()), name='Feedback', purpose='request feedback', prompt='Ask about their visit.',
                parent_id=parent_id, available_on_status='completed', is_active=True, sort_order=0, canvas_x=32, canvas_y=64, **extra)


class BuilderContractTests(unittest.TestCase):
    def test_valid_unlimited_depth_is_iterative(self):
        items=[]
        for _ in range(1500): items.append(node(items[-1]['id'] if items else None))
        self.assertEqual(len(clean_builder(DropInBuilder(items=items,baseline=[]))),1500)

    def test_cycles_orphans_duplicates_and_cross_status_rejected(self):
        parent=node(); child=node(parent['id'])
        fixtures=[
            [{**parent,'parent_id':parent['id']}],
            [{**parent,'parent_id':child['id']},child],
            [child], [parent,parent],
            [parent,{**child,'available_on_status':'pending'}],
        ]
        for items in fixtures:
            with self.subTest(items=len(items)), self.assertRaises(Exception): clean_builder(DropInBuilder(items=items,baseline=[]))

    def test_nonfinite_and_oversized_fields_rejected(self):
        for field,value in [('canvas_x',float('nan')),('canvas_y',float('inf')),('canvas_x',1000001),('purpose','x'*31),('sort_order',-1)]:
            with self.subTest(field=field), self.assertRaises(Exception): DropInBuilder(items=[{**node(),field:value}],baseline=[])

    def test_uuid_and_parent_normalized_for_database(self):
        parent=node(); child=node(parent['id'])
        result=clean_builder(DropInBuilder(items=[child,parent],baseline=[]))
        self.assertIsInstance(result[0]['id'],str)
        self.assertEqual(result[0]['parent_id'],parent['id'])

    def test_route_is_scoped_permission_checked_and_encrypted(self):
        db=Database(); captured=[]; rpc_headers=[]
        # Contract adapter intentionally marks ciphertext; real cryptography is
        # already exercised in test_phase57_database and protected_data tests.
        db.encode=lambda table,value: {**value,'prompt':'ndmenc:v1:synthetic'}
        db.decode=lambda table,value: {**value,'prompt':'Ask about their visit.'}
        def rpc(name, params):
            query=SimpleNamespace(headers={'x-existing-header':'preserved'})
            def execute():
                captured.append((name,copy.deepcopy(params)))
                rpc_headers.append(dict(query.headers))
                return SimpleNamespace(data=params['nodes'])
            query.execute=execute
            return query
        db.rpc=rpc
        role=['OWNER']
        async def user():
            with tenant_scope(Tenant(OWNER,1,OWNER,role=role[0])): yield SimpleNamespace(id=OWNER)
        app=FastAPI(); app.include_router(build_router(ScopedClient(db),user,lambda _: {},None)); client=TestClient(app)
        draft=node(); payload={'items':[draft],'baseline':[]}
        response=client.put('/api/sonar/drop-ins/builder',json=payload)
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(captured[0][0],'save_drop_in_builder')
        self.assertEqual(captured[0][1]['target_business'],1)
        self.assertEqual(captured[0][1]['nodes'][0]['business_id'],1)
        self.assertEqual(captured[0][1]['nodes'][0]['prompt'],'ndmenc:v1:synthetic')
        self.assertEqual(rpc_headers[0]['x-nodemere-audit-actor'],str(OWNER))
        self.assertEqual(rpc_headers[0]['x-nodemere-audit-kind'],'workforce')
        self.assertEqual(rpc_headers[0]['x-existing-header'],'preserved')
        role[0]='STAFF'
        self.assertEqual(client.put('/api/sonar/drop-ins/builder',json=payload).status_code,403)
        self.assertEqual(len(captured),1)

    def test_duplicate_baseline_rejected(self):
        item=node(); revision={'id':item['id'],'updated_at':datetime.now(timezone.utc)}
        with self.assertRaises(Exception): clean_builder(DropInBuilder(items=[item],baseline=[revision,revision]))


if __name__ == '__main__': unittest.main()
