"""Real transaction/constraint tests against a named, disposable loopback DB."""
import os
import unittest
from uuid import uuid4
import psycopg2
from psycopg2.extras import Json, RealDictCursor


@unittest.skipUnless(os.getenv('DROP_IN_BUILDER_TEST_PORT'), 'Disposable local database required')
class BuilderDatabaseTests(unittest.TestCase):
    def setUp(self):
        self.db=psycopg2.connect(host='127.0.0.1',port=int(os.environ['DROP_IN_BUILDER_TEST_PORT']),user='postgres',dbname='nodemere_drop_in_builder_test',connect_timeout=3)
        self.addCleanup(self.db.close); self.addCleanup(self.db.rollback)
        self.cursor=self.db.cursor(cursor_factory=RealDictCursor)
        self.cursor.execute('set role service_role')

    def node(self,parent=None,**extra):
        return dict(id=str(uuid4()),name='Synthetic',purpose='follow up',prompt='ndmenc:v1:synthetic-fixture',parent_id=parent,available_on_status='completed',is_active=True,sort_order=0,canvas_x=32,canvas_y=128,**extra)

    def save(self,nodes,baseline=(),business=1):
        self.cursor.execute('select * from public.save_drop_in_builder(%s,%s,%s)',(business,Json(nodes),Json(list(baseline))))
        return [dict(row) for row in self.cursor.fetchall()]

    @staticmethod
    def revision(items): return [{'id':str(x['id']),'updated_at':x['updated_at'].isoformat()} for x in items]

    def test_out_of_order_tree_and_geometry_roundtrip(self):
        parent=self.node(); child=self.node(parent['id']); grandchild=self.node(child['id'])
        result=self.save([grandchild,child,parent]); by_id={str(x['id']):x for x in result}
        self.assertEqual(str(by_id[grandchild['id']]['parent_id']),child['id'])
        self.assertEqual(by_id[parent['id']]['canvas_y'],128)

    def test_cycle_transaction_rolls_back(self):
        parent=self.node(); child=self.node(parent['id']); parent['parent_id']=child['id']
        with self.assertRaises(psycopg2.errors.CheckViolation): self.save([parent,child])
        self.db.rollback(); self.cursor.execute('select count(*) from public.drop_ins'); self.assertEqual(self.cursor.fetchone()['count'],0)

    def test_stale_snapshot_cannot_overwrite(self):
        parent=self.node(); result=self.save([parent])
        with self.assertRaises(psycopg2.errors.SerializationFailure): self.save([{**parent,'name':'Overwritten'}],[])

    def test_soft_delete_and_promotion_are_atomic(self):
        parent=self.node(); child=self.node(parent['id']); saved=self.save([parent,child]);
        next_saved=self.save([{**child,'parent_id':None}],self.revision(saved))
        self.assertEqual(len(next_saved),1);self.assertIsNone(next_saved[0]['parent_id'])
        self.cursor.execute('select deleted_at from public.drop_ins where id=%s',(parent['id'],));self.assertIsNotNone(self.cursor.fetchone()['deleted_at'])

    def test_foreign_identifier_is_not_overwritten(self):
        parent=self.node(); self.save([parent],business=2)
        with self.assertRaises(psycopg2.errors.SerializationFailure): self.save([parent],business=1)

    def test_cross_status_parent_rejected(self):
        parent=self.node(); child={**self.node(parent['id']),'available_on_status':'pending'}
        with self.assertRaises(psycopg2.errors.InvalidParameterValue): self.save([parent,child])

    def test_orphan_rejected(self):
        with self.assertRaises(psycopg2.errors.InvalidParameterValue): self.save([self.node(str(uuid4()))])

    def test_plaintext_instruction_guard_is_preserved(self):
        with self.assertRaises(psycopg2.errors.InsufficientPrivilege): self.save([{**self.node(),'prompt':'PLAINTEXT_CANARY'}])

    def test_browser_role_cannot_call_privileged_save(self):
        self.cursor.execute('reset role');self.cursor.execute('set role authenticated')
        with self.assertRaises(psycopg2.errors.InsufficientPrivilege): self.save([])

    def test_direct_modal_write_cannot_introduce_cycle(self):
        parent=self.node(); child=self.node(parent['id']);self.save([parent,child])
        with self.assertRaises(psycopg2.errors.CheckViolation): self.cursor.execute('update public.drop_ins set parent_id=%s where id=%s',(child['id'],parent['id']))


if __name__=='__main__': unittest.main()
