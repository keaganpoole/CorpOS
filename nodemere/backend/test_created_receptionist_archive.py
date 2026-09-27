"""Exercise actual archive/delete and restore routes without provider startup."""
import ast
import asyncio
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

from fastapi import HTTPException
from backend.test_voice_design import MemoryDB, Query
from backend.receptionist_catalog import private_created_catalog, normalize_created_receptionist
from backend.authorization import ScopedClient, Tenant, tenant_scope


class DeleteQuery(Query):
    def delete(self):
        self.operation = 'delete'
        return self

    def execute(self):
        if self.operation == 'delete':
            rows = super().execute().data
            self.db.tables[self.table] = [row for row in self.db.tables[self.table] if row not in rows]
            self.db.writes.append((self.table, 'delete'))
            return SimpleNamespace(data=rows)
        return super().execute()


class ArchiveDB(MemoryDB):
    def table(self, name):
        return DeleteQuery(self, name)


def routes(db):
    tree = ast.parse(Path(__file__).with_name('main.py').read_text(encoding='utf-8'))
    nodes = [node for node in tree.body if isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef))
             and node.name in ('delete_agent', 'restore_agent', 'patch_agent', 'move_created_receptionist', 'list_archived_created_receptionists', 'get_sonar_agents')]
    for node in nodes:
        node.decorator_list = []
    namespace = dict(supabase=db, business_owner_id=lambda user: 'owner',
                     Depends=lambda fn: None, get_current_user=lambda: None,
                     HTTPException=HTTPException, status=SimpleNamespace(HTTP_404_NOT_FOUND=404),
                     push_live_event=Mock(), supabase_admin=SimpleNamespace(raw=db),
                     created_receptionist_lifecycle=Mock(return_value={'ok': True}),
                     load_business_by_user_id=lambda owner: {'id': 7}, normalize_created_receptionist=normalize_created_receptionist,
                     normalize_receptionist_direction=lambda value: value,
                     derive_receptionist_status=lambda value, **kwargs: value, logging=Mock())
    exec(compile(ast.Module(body=nodes, type_ignores=[]), 'agent_routes', 'exec'), namespace)
    return namespace


class CreatedArchiveTests(unittest.TestCase):
    def setUp(self):
        self.db = ArchiveDB()
        self.hired = dict(catalog_id=None, id=20, user_id='owner', business_id=7, stereotype='Studio Voice Design',
                          full_name='Avery', avatar='portrait.png', elevenlabs_voice_id='voice-1',
                          is_active=True, status='active', direction='all')
        self.creation = dict(id=1, user_id='owner', business_id=7, status='converted',
                             hired_receptionist_id=20, selected_portrait_url='portrait.png', voice_id='voice-1')
        self.db.tables['hired_receptionists'] = [self.hired]
        self.db.tables['created_receptionists'] = [self.creation]
        self.namespace = routes(self.db)

    def call(self, name, agent_id='20'):
        return asyncio.run(self.namespace[name](agent_id, current_user={'id': 'owner'}))

    def test_delete_created_returns_to_catalog_through_atomic_rpc(self):
        original_creation = dict(self.creation)
        result = self.call('delete_agent')
        self.assertTrue(result['returned_to_catalog'])
        self.namespace['created_receptionist_lifecycle'].assert_called_once_with(
            self.db, created_id=1, owner_id='owner', business_id=7, action='remove')
        self.assertEqual(self.creation, original_creation)
        self.assertEqual(self.db.writes, [])

    def test_old_restore_path_restores_created_to_catalog_without_hiring(self):
        self.creation['status'] = 'archived'
        self.assertTrue(self.call('restore_agent')['returned_to_catalog'])
        self.namespace['created_receptionist_lifecycle'].assert_called_once_with(
            self.db, created_id=1, owner_id='owner', business_id=7, action='restore')
        self.assertEqual(self.db.writes, [])

    def test_stock_without_appointments_still_deletes(self):
        self.hired.update(stereotype='Stock', catalog_id=9)
        self.db.tables['created_receptionists'] = []
        self.assertNotIn('archived', self.call('delete_agent'))
        self.assertEqual(self.db.tables['hired_receptionists'], [])

    def test_system_with_appointments_cannot_be_archived_by_delete(self):
        self.hired.update(stereotype='Stock', catalog_id=9)
        self.db.tables['created_receptionists'] = []
        self.db.tables['appointments'] = [dict(id=4, receptionist_id=20)]
        with self.assertRaises(HTTPException) as error:
            self.call('delete_agent')
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(self.db.writes, [])

    def test_system_archive_patch_is_rejected(self):
        self.hired.update(stereotype='Stock', catalog_id=9)
        for payload in ({'status': 'archived'}, {'status': ' Archived '}, {'is_active': False}, {'is_active': 0}):
            with self.assertRaises(HTTPException) as error:
                asyncio.run(self.namespace['patch_agent']('20', payload, current_user={'id': 'owner'}))
            self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(self.db.writes, [])

    def test_catalog_archive_route_uses_server_scope_and_never_accepts_remove(self):
        asyncio.run(self.namespace['move_created_receptionist']('1', 'archive', current_user={'id': 'manager'}))
        self.namespace['created_receptionist_lifecycle'].assert_called_once_with(
            self.db, created_id='1', owner_id='owner', business_id=7, action='archive')
        with self.assertRaises(HTTPException):
            asyncio.run(self.namespace['move_created_receptionist']('1', 'remove', current_user={'id': 'owner'}))

    def test_ready_creation_with_historical_hired_link_is_available_in_catalog(self):
        self.creation['status'] = 'ready'
        self.assertEqual(private_created_catalog(self.db, owner_id='owner', business_id=7)[0]['created_receptionist_id'], 1)

    def test_archive_list_is_owned_and_business_scoped(self):
        self.creation['status'] = 'archived'
        self.db.tables['created_receptionists'].extend([
            dict(self.creation, id=2, user_id='other'), dict(self.creation, id=3, business_id=8)])
        rows = asyncio.run(self.namespace['list_archived_created_receptionists'](current_user={'id': 'owner'}))
        self.assertEqual([row['created_receptionist_id'] for row in rows], [1])

    def test_historical_catalog_membership_is_absent_from_active_and_archived_team_lists(self):
        self.hired.update(status='catalog', is_active=False)
        for include_archived in (False, True):
            self.assertEqual(self.namespace['get_sonar_agents'](include_archived, current_user={'id': 'owner'}), [])
        self.hired.update(status='active', is_active=True)
        self.assertEqual(len(self.namespace['get_sonar_agents'](current_user={'id': 'owner'})), 1)

    def test_other_owner_is_not_modified(self):
        self.hired['user_id'] = 'other'
        for name in ('delete_agent', 'restore_agent'):
            with self.assertRaises(HTTPException) as error:
                self.call(name)
            self.assertEqual(error.exception.status_code, 404)
        self.assertEqual(self.db.writes, [])

    def test_authenticated_business_scope_cannot_archive_other_business(self):
        self.namespace = routes(ScopedClient(self.db))
        with tenant_scope(Tenant('manager', 8, 'owner', role='MANAGER')):
            with self.assertRaises(HTTPException) as error:
                self.call('delete_agent')
            self.assertEqual(error.exception.status_code, 404)
        self.assertEqual(self.db.writes, [])


if __name__ == '__main__':
    unittest.main()
