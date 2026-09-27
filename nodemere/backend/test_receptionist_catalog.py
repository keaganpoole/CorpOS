"""Offline ownership, routing and duplicate-hire regression coverage."""
import unittest
import ast
import asyncio
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
from fastapi import HTTPException
from postgrest.exceptions import APIError
from backend.receptionist_catalog import private_created_catalog, hire_created_receptionist
from backend.test_voice_design import MemoryDB
from backend.authorization import ScopedClient, Tenant, tenant_scope


def isolated_hire_route(namespace):
    # Compile the actual route without starting the monolithic app/provider clients.
    tree = ast.parse(Path(__file__).with_name('main.py').read_text(encoding='utf-8'))
    node = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == 'hire_receptionist')
    normalize = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'normalize_custom_voice_receptionist')
    node.decorator_list = []
    namespace.update(Depends=lambda f: None, get_current_user=lambda: None, HTTPException=HTTPException,
                     status=SimpleNamespace(HTTP_400_BAD_REQUEST=400, HTTP_500_INTERNAL_SERVER_ERROR=500), logging=Mock())
    exec(compile(ast.Module(body=[normalize, node], type_ignores=[]), 'hire_receptionist', 'exec'), namespace)
    return namespace['hire_receptionist']


class PrivateCatalogTests(unittest.TestCase):
    def setUp(self):
        self.db = MemoryDB()
        self.ready = dict(id=1, user_id='owner', business_id=7, status='ready', full_name='Avery',
                          first_name='Avery', selected_portrait_url='https://example.com/portrait.png',
                          voice_preview_url='https://example.com/voice.mp3', voice_id='voice-1', age='Young adult', traits=['Warm'])
        self.db.tables['created_receptionists'] = [
            self.ready, dict(self.ready, id=2, user_id='other'), dict(self.ready, id=3, business_id=8),
            dict(self.ready, id=4, status='converted', hired_receptionist_id=20),
            dict(self.ready, id=5, status='generating'), dict(self.ready, id=6, voice_id=None),
        ]

    def test_catalog_lists_only_ready_owned_unhired_creations_with_media(self):
        rows = private_created_catalog(self.db, owner_id='owner', business_id=7)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['created_receptionist_id'], 1)
        self.assertEqual(rows[0]['source'], 'created_receptionist')
        self.assertIsNone(rows[0]['catalog_id'])
        self.assertEqual(rows[0]['avatar'], self.ready['selected_portrait_url'])
        self.assertEqual(rows[0]['voice'], self.ready['voice_preview_url'])
        self.assertEqual(self.db.writes, [])

    def test_created_table_is_business_scoped_in_authenticated_requests(self):
        with tenant_scope(Tenant('manager', 7, 'owner', role='MANAGER')):
            rows = private_created_catalog(ScopedClient(self.db), owner_id='owner', business_id=7)
        self.assertEqual([r['created_receptionist_id'] for r in rows], [1])

    def test_hire_uses_only_server_owned_scope_and_preserves_retry_flag(self):
        db = Mock()
        db.rpc.return_value.execute.return_value.data = {'receptionist': {'id': 20}, 'newly_hired': False}
        result = hire_created_receptionist(db, created_id='1', owner_id='owner', business_id=7, limit=3)
        db.rpc.assert_called_once_with('nodemere_hire_created_receptionist', {
            'target_id': 1, 'target_owner': 'owner', 'target_business': 7, 'receptionist_limit': 3,
        })
        self.assertFalse(result['newly_hired'])

    def test_cross_owner_and_invalid_states_fail_closed(self):
        for message, code in [('created_not_found', 404), ('created_not_ready', 409), ('created_plan_limit', 402)]:
            db = Mock()
            db.rpc.return_value.execute.side_effect = APIError({'code': 'P0001', 'message': message, 'details': None, 'hint': None})
            with self.assertRaises(HTTPException) as error:
                hire_created_receptionist(db, created_id=1, owner_id='other', business_id=8, limit=1)
            self.assertEqual(error.exception.status_code, code)

    def test_route_retries_do_not_check_full_plan_or_repeat_hire_events(self):
        db = Mock()
        hired = {'id': 20, 'user_id': 'owner', 'business_id': 7, 'full_name': 'Avery'}
        rpc = Mock(side_effect=[{'receptionist': hired, 'newly_hired': True}, {'receptionist': hired, 'newly_hired': False}])
        namespace = dict(supabase_admin=db, supabase=Mock(), business_owner_id=lambda user: 'owner',
                         load_business_by_user_id=lambda owner: {'id': 7},
                         require_plan_access=lambda *args: {'entitlements': {'max_receptionists': 1}},
                         hire_created_receptionist=rpc, enforce_plan_limit=Mock(), count_active_receptionists=Mock(),
                         clear_inbound_call_boot_cache=Mock(), claim_nest_milestone=Mock(), push_live_event=Mock())
        route = isolated_hire_route(namespace)
        for _ in range(2):
            self.assertEqual(asyncio.run(route({'created_receptionist_id': 1}, current_user={'id': 'manager'})), hired)
        namespace['count_active_receptionists'].assert_not_called()
        namespace['enforce_plan_limit'].assert_not_called()
        namespace['push_live_event'].assert_called_once()
        self.assertEqual(rpc.call_args.args[0], db.raw)

    def test_stock_hire_still_copies_stock_profile_and_voice(self):
        db = MemoryDB()
        db.tables['receptionist_catalog'] = [dict(id=9, full_name='Stock', avatar='stock.png', elevenlabs_voice_id='stock-voice')]
        namespace = dict(supabase=db, supabase_admin=Mock(), business_owner_id=lambda user: 'owner',
                         load_business_by_user_id=lambda owner: {'id': 7}, require_plan_access=lambda *args: {'entitlements': {}},
                         enforce_plan_limit=Mock(), count_active_receptionists=lambda owner: 0,
                         clear_inbound_call_boot_cache=Mock(), claim_nest_milestone=Mock(), push_live_event=Mock())
        hired = asyncio.run(isolated_hire_route(namespace)({'catalog_id': 9}, current_user={'id': 'owner'}))
        self.assertEqual(hired['catalog_id'], 9)
        self.assertEqual(hired['avatar'], 'stock.png')
        self.assertEqual(hired['elevenlabs_voice_id'], 'stock-voice')

    def test_voice_clone_hire_still_copies_custom_voice_profile(self):
        db = MemoryDB()
        db.tables['custom_voices'] = [dict(id='clone-1', user_id='owner', business_id=7,
                                        voice_name='Cloned Avery', provider_voice_id='clone-voice',
                                        metadata={'receptionist_profile': {'avatar': 'clone.png', 'traits': ['Friendly']}})]
        namespace = dict(supabase=db, supabase_admin=Mock(), business_owner_id=lambda user: 'owner',
                         load_business_by_user_id=lambda owner: {'id': 7}, require_plan_access=lambda *args: {'entitlements': {}},
                         enforce_plan_limit=Mock(), count_active_receptionists=lambda owner: 0,
                         clear_inbound_call_boot_cache=Mock(), claim_nest_milestone=Mock(), push_live_event=Mock())
        hired = asyncio.run(isolated_hire_route(namespace)({'custom_voice_id': 'clone-1', 'source': 'voice_clone'}, current_user={'id': 'owner'}))
        self.assertIsNone(hired['catalog_id'])
        self.assertEqual(hired['avatar'], 'clone.png')
        self.assertEqual(hired['elevenlabs_voice_id'], 'clone-voice')


if __name__ == '__main__': unittest.main()
