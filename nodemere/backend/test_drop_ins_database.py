"""Migration checks on an explicitly selected isolated PostgreSQL fixture.

Never set NODEMERE_DROP_INS_TEST_PORT to a production server.
The fixture database must be named nodemere_drop_ins_test.
"""
import os
import unittest
from pathlib import Path
from uuid import uuid4
import psycopg2


@unittest.skipUnless(os.environ.get('NODEMERE_DROP_INS_TEST_PORT'), 'Isolated database required')
class MigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = psycopg2.connect(host='127.0.0.1', port=int(os.environ['NODEMERE_DROP_INS_TEST_PORT']), user='postgres', dbname='nodemere_drop_ins_test')
        cls.db.autocommit = True
        with cls.db.cursor() as c:
            c.execute("""
                do $$ begin
                  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
                  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
                  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
                end $$;
                create schema if not exists nodemere_private;
                create table if not exists public.businesses(id bigint primary key);
                create table if not exists public.people(id bigint primary key);
                create table if not exists public.call_logs(id uuid primary key,business_id bigint,appointment_id uuid,status text,created_at timestamptz default now(),started_at timestamptz);
                create or replace function nodemere_private.audit_row_change() returns trigger language plpgsql as $$ begin return new; end $$;
                insert into public.businesses values(1),(2) on conflict do nothing;
            """)
            migration = (Path(__file__).parents[1] / 'sql/2026_09_06_drop_ins.sql').read_text(encoding='utf-8')
            c.execute(migration)
            c.execute(migration)  # Additive migration is repeatable.
            purpose_migration = (Path(__file__).parents[1] / 'sql/2026_09_06_drop_ins_purpose.sql').read_text(encoding='utf-8')
            c.execute(purpose_migration)
            c.execute(purpose_migration)  # Live upgrades may replay this migration safely.
    @classmethod
    def tearDownClass(cls): cls.db.close()
    def setUp(self):
        self.db.autocommit = False
        self.cursor = self.db.cursor()
        self.id = str(uuid4())
        self.cursor.execute("insert into drop_ins(id,business_id,name,purpose,prompt,available_on_status) values(%s,1,'Test','Test purpose','ndmenc:v1:synthetic','completed')", [self.id])
    def tearDown(self):
        self.db.rollback(); self.cursor.close(); self.db.autocommit = True
    def test_plaintext_prompt_rejected(self):
        with self.assertRaises(psycopg2.errors.InsufficientPrivilege):
            self.cursor.execute("update drop_ins set prompt='plaintext' where id=%s", [self.id])
    def test_business_binding_cannot_be_changed(self):
        with self.assertRaises(psycopg2.errors.InsufficientPrivilege):
            self.cursor.execute('update drop_ins set business_id=2 where id=%s', [self.id])
    def test_cross_business_call_link_rejected(self):
        with self.assertRaises(psycopg2.errors.ForeignKeyViolation):
            self.cursor.execute("insert into call_logs(id,business_id,drop_in_id) values(%s,2,%s)", [str(uuid4()), self.id])
    def test_duplicate_active_calls_rejected(self):
        appointment = str(uuid4())
        self.cursor.execute("insert into call_logs(id,business_id,appointment_id,status,drop_in_id) values(%s,1,%s,'dispatching',%s)", [str(uuid4()), appointment, self.id])
        with self.assertRaises(psycopg2.errors.UniqueViolation):
            self.cursor.execute("insert into call_logs(id,business_id,appointment_id,status,drop_in_id) values(%s,1,%s,'dispatching',%s)", [str(uuid4()), appointment, self.id])
    def test_reorder_is_atomic_and_scoped(self):
        other = str(uuid4())
        self.cursor.execute("insert into drop_ins(id,business_id,name,purpose,prompt,available_on_status) values(%s,1,'Second','Second purpose','ndmenc:v1:synthetic','completed')", [other])
        self.cursor.execute('select reorder_drop_ins(1,\'completed\',%s::uuid[])', [[other, self.id]])
        self.cursor.execute('select id::text from drop_ins where business_id=1 order by sort_order')
        self.assertEqual([r[0] for r in self.cursor.fetchall()], [other, self.id])
        with self.assertRaises(psycopg2.errors.SerializationFailure):
            self.cursor.execute('select reorder_drop_ins(1,\'completed\',%s::uuid[])', [[self.id]])
    def test_no_direct_browser_access(self):
        self.cursor.execute("set local role authenticated")
        with self.assertRaises(psycopg2.errors.InsufficientPrivilege):
            self.cursor.execute('select * from drop_ins')
    def test_usage_excludes_calls_not_started(self):
        self.cursor.execute("insert into call_logs(id,business_id,drop_in_id,status) values(%s,1,%s,'failed')", [str(uuid4()), self.id])
        self.cursor.execute('select * from drop_in_usage(1)')
        self.assertEqual(self.cursor.fetchall(), [])


if __name__ == '__main__': unittest.main()
