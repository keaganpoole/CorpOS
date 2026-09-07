"""Drop-in integration tests with synthetic records and no provider calls."""
import asyncio
import copy
import json
import os
import re
import unittest
import requests
from contextlib import ExitStack
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4
from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend.authorization import ScopedClient, Tenant, tenant_scope
from backend.drop_ins import build_router, run_identity
from backend.drop_in_templates import for_industry, INDUSTRY_VISITS, TEMPLATES

OWNER = '11111111-1111-4111-8111-111111111111'
APPT = '22222222-2222-4222-8222-222222222222'
DROP = '33333333-3333-4333-8333-333333333333'


class Query:
    def __init__(self, db, table):
        self.db, self.table = db, table
        self.filters, self.orders = [], []
        self.op, self.values, self.bounds, self.maximum = 'select', None, None, None
        self.negated = False
    def select(self, *args, **kwargs): return self
    def eq(self, key, value): self.filters.append(lambda x: str(x.get(key)) == str(value)); return self
    def is_(self, key, value):
        negated = self.negated; self.negated = False
        self.filters.append(lambda x: (x.get(key) is None) != negated); return self
    @property
    def not_(self): self.negated = True; return self
    def in_(self, key, values): self.filters.append(lambda x: x.get(key) in values); return self
    def limit(self, value): self.maximum = value; return self
    def range(self, start, end): self.bounds = (start, end + 1); return self
    def order(self, key, desc=False): self.orders.append((key, desc)); return self
    def insert(self, values, **kwargs): self.op, self.values = 'insert', values; return self
    def update(self, values, **kwargs): self.op, self.values = 'update', values; return self
    def execute(self):
        source = self.db.data.setdefault(self.table, [])
        found = [r for r in source if all(f(r) for f in self.filters)]
        if self.op == 'insert':
            row = copy.deepcopy(self.values)
            row.setdefault('id', str(uuid4()))
            row.setdefault('created_at', '2026-09-06T00:00:00Z')
            row.setdefault('deleted_at', None)
            if any(r['id'] == row['id'] for r in source): raise ValueError('duplicate')
            if self.table == 'call_logs' and any(r.get('appointment_id') == row.get('appointment_id') and r.get('drop_in_id') and r.get('status') in {'dispatching','dispatch-unknown','in-progress'} for r in source): raise ValueError('active call')
            source.append(row); found = [row]
        elif self.op == 'update':
            for row in found: row.update(copy.deepcopy(self.values))
        for key, desc in reversed(self.orders): found.sort(key=lambda x: x.get(key, ''), reverse=desc)
        if self.maximum is not None: found = found[:self.maximum]
        if self.bounds: found = found[slice(*self.bounds)]
        return SimpleNamespace(data=copy.deepcopy(found))


class Database:
    def __init__(self):
        self.data = {
            'businesses': [{'id': 1, 'user_id': OWNER, 'industry': 'Beauty & Wellness'}],
            'drop_ins': [{'id': DROP, 'business_id': 1, 'name': 'Thank You', 'purpose': 'thank them', 'prompt': 'Thank the customer.', 'available_on_status': 'completed', 'is_active': True, 'sort_order': 0, 'deleted_at': None}],
            'appointments': [{'id': APPT, 'business_id': 1, 'user_id': OWNER, 'status': 'completed', 'person_id': 7, 'receptionist_id': 9, 'date': '2026-09-06', 'time': '13:00'}],
            'people': [{'id': 7, 'business_id': 1, 'phone': '+15555550123', 'consent_call': True, 'consent_call_source': 'synthetic', 'consent_call_recorded_at': '2026-09-01', 'consent_call_scope': 'test'}],
            'hired_receptionists': [{'id': 9, 'business_id': 1, 'first_name': 'Assigned', 'elevenlabs_voice_id': 'assigned-voice', 'is_active': True, 'direction': 'outbound'}],
            'call_logs': [],
        }
    def table(self, name): return Query(self, name)
    def rpc(self, name, params):
        if name == 'drop_in_usage': return SimpleNamespace(execute=lambda: SimpleNamespace(data=[]))
        def reorder():
            rows = [r for r in self.data['drop_ins'] if r['business_id'] == params['target_business'] and r['available_on_status'] == params['target_status'] and not r.get('deleted_at')]
            if sorted(r['id'] for r in rows) != sorted(params['ordered_ids']): raise ValueError('stale order')
            for row in rows: row['sort_order'] = params['ordered_ids'].index(row['id'])
            return SimpleNamespace(data=None)
        return SimpleNamespace(execute=reorder)


class DropInTests(unittest.TestCase):
    def setUp(self):
        self.db = Database()
        self.scoped = ScopedClient(self.db)
        self.role = 'OWNER'
        self.executor = SimpleNamespace(plan_access_checker=None, _call_customer=AsyncMock(side_effect=self.dispatch))
        async def user():
            with tenant_scope(Tenant(OWNER, 1, OWNER, role=self.role)):
                yield SimpleNamespace(id=OWNER)
        app = FastAPI()
        app.include_router(build_router(self.scoped, user, lambda _: self.db.data['businesses'][0], self.executor))
        self.client = TestClient(app)
        self.url = f'/api/sonar/appointments/{APPT}/drop-ins/{DROP}/run'
    async def dispatch(self, node, context):
        self.context = context
        self.db.table('call_logs').update({'status': 'in-progress'}).eq('id', context['_drop_in']['call_log_id']).execute()
        return {'success': True}
    def run_call(self, request_id=None): return self.client.post(self.url, json={'request_id': request_id or str(uuid4())})
    def test_saved_definitions_are_scoped(self):
        self.db.data['drop_ins'].append(dict(self.db.data['drop_ins'][0], id=str(uuid4()), business_id=2))
        self.assertEqual(len(self.client.get('/api/sonar/drop-ins').json()['items']), 1)
    def test_staff_can_execute_but_cannot_edit(self):
        self.role = 'STAFF'
        self.assertEqual(self.run_call().status_code, 200)
        self.assertEqual(self.client.delete(f'/api/sonar/drop-ins/{DROP}').status_code, 403)
    def test_crud_and_soft_delete(self):
        draft = {'name': ' New ', 'purpose': ' Thank them ', 'prompt': ' Thank them. ', 'available_on_status': 'missed', 'is_active': False}
        created = self.client.post('/api/sonar/drop-ins', json=draft)
        self.assertEqual(created.status_code, 200, created.text)
        row = created.json(); self.assertEqual(row['name'], 'New'); self.assertEqual(row['purpose'], 'Thank them')
        changed = self.client.put('/api/sonar/drop-ins/' + row['id'], json={**draft, 'name': 'Changed'})
        self.assertEqual(changed.json()['name'], 'Changed')
        self.assertEqual(self.client.delete('/api/sonar/drop-ins/' + row['id']).status_code, 200)
        self.assertIsNotNone(self.db.data['drop_ins'][-1]['deleted_at'])
    def test_unknown_status_and_blank_prompt_rejected(self):
        for status, prompt in [('upcoming','Call'),('completed',' ' )]:
            self.assertEqual(self.client.post('/api/sonar/drop-ins', json={'name':'Test','purpose':'Test','prompt':prompt,'available_on_status':status}).status_code, 422)
        self.assertEqual(self.client.post('/api/sonar/drop-ins', json={'name':'Test','purpose':' ','prompt':'Call','available_on_status':'completed'}).status_code, 422)
        self.assertEqual(self.client.post('/api/sonar/drop-ins', json={'name':'Test','purpose':'x' * 31,'prompt':'Call','available_on_status':'completed'}).status_code, 422)
    def test_same_request_is_not_dispatched_twice(self):
        key = str(uuid4())
        first = self.run_call(key); second = self.run_call(key)
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(first.json(), second.json())
        self.assertEqual(self.executor._call_customer.await_count, 1)
    def test_different_request_during_active_call_is_rejected(self):
        self.assertEqual(self.run_call().status_code, 200)
        self.assertEqual(self.run_call().status_code, 409)
        self.assertEqual(self.executor._call_customer.await_count, 1)
    def test_status_is_rechecked_before_dispatch(self):
        self.db.data['appointments'][0]['status'] = 'cancelled'
        self.assertEqual(self.run_call().status_code, 409)
        self.executor._call_customer.assert_not_awaited()
    def test_disabled_or_deleted_drop_in_cannot_execute(self):
        self.db.data['drop_ins'][0]['is_active'] = False
        self.assertEqual(self.run_call().status_code, 409)
        self.db.data['drop_ins'][0]['deleted_at'] = 'now'
        self.assertEqual(self.run_call().status_code, 404)
    def test_cross_tenant_receptionist_rejected(self):
        self.db.data['hired_receptionists'][0]['business_id'] = 2
        self.assertEqual(self.run_call().status_code, 404)
    def test_customer_consent_and_assignment_required(self):
        self.db.data['people'][0]['do_not_call'] = True
        self.assertEqual(self.run_call().status_code, 422)
        self.db.data['appointments'][0]['receptionist_id'] = None
        self.assertEqual(self.run_call().status_code, 422)
        self.executor._call_customer.assert_not_awaited()
    def test_exact_assigned_receptionist_and_prompt_snapshot(self):
        self.assertEqual(self.run_call().status_code, 200)
        self.assertEqual(self.context['receptionist']['id'], 9)
        log = self.db.data['call_logs'][0]
        self.assertEqual(log['hired_receptionist_id'], 9)
        self.assertEqual(log['appointment_id'], APPT)
        self.assertEqual(log['conversation_initiation_data']['drop_in']['purpose'], 'thank them')
        self.assertEqual(log['conversation_initiation_data']['drop_in']['prompt'], 'Thank the customer.')
    def test_uncertain_dispatch_never_retries_automatically(self):
        self.executor._call_customer.side_effect = None
        self.executor._call_customer.return_value = {'success': False, 'dispatch_unknown': True, 'error': 'Pending confirmation'}
        key = str(uuid4())
        self.assertEqual(self.run_call(key).json()['status'], 'dispatch-unknown')
        self.assertEqual(self.run_call(key).json()['status'], 'dispatch-unknown')
        self.executor._call_customer.assert_awaited_once()
    def test_catalog_covers_every_onboarding_industry(self):
        extra = re.findall(r"^  '([^']+)': \{", (Path(__file__).parents[1] / 'src/data/onboardingIndustryTemplates.js').read_text(), re.M)
        expected = {'Home Services','Real Estate','Automotive','Beauty & Wellness','Hospitality','Professional Services','Retail','Other General Business', *extra}
        self.assertEqual(expected, set(INDUSTRY_VISITS))
        self.assertEqual(len(TEMPLATES), len({x['key'] for x in TEMPLATES}))
        for industry in expected:
            templates = for_industry(industry)
            self.assertGreaterEqual(len(templates), 14)
            self.assertTrue(any(industry in t['industries'] for t in templates))
            self.assertTrue(all(not t['industries'] or industry in t['industries'] for t in templates))
    def test_request_ids_are_bound_to_business_and_appointment(self):
        key = uuid4()
        self.assertNotEqual(run_identity(1, APPT, DROP, key), run_identity(2, APPT, DROP, key))


class ProviderDispatchTests(unittest.TestCase):
    def setUp(self):
        from backend.scenario_engine import ScenarioActionExecutor
        self.db = Database()
        self.log_id = str(uuid4())
        self.db.data['call_logs'].append({'id': self.log_id, 'status': 'dispatching'})
        self.executor = ScenarioActionExecutor(self.db, {}, 'http://offline.invalid')
        self.context = {'business': {'id': 1, 'user_id': OWNER, 'name': 'Synthetic business'},
                        'person': self.db.data['people'][0], 'customer': self.db.data['people'][0],
                        'receptionist': self.db.data['hired_receptionists'][0],
                        'appointment': self.db.data['appointments'][0], '_scenario': {},
                        '_drop_in': {'id': DROP, 'name': 'Thank You', 'call_log_id': self.log_id}}
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.dict(os.environ, {'ELEVENLABS_API_KEY': 'synthetic', 'ELEVENLABS_AGENT_ID_OUTBOUND': 'outbound-test'}))
        for method, value in [('_find_elevenlabs_phone_number_id_for_business', 'owned-number'), ('_infer_required_agent_fields', []), ('_build_downstream_data', {}), ('_add_person_custom_dynamic_variables', None), ('_build_agent_collection_state', {})]:
            self.stack.enter_context(patch.object(self.executor, method, return_value=value))
    def execute(self):
        return asyncio.run(self.executor._call_customer({'id': 'test', 'actionConfig': {'main_content': 'Thank them for visiting.'}}, self.context))
    def test_voice_context_and_existing_call_log_are_used(self):
        response = SimpleNamespace(ok=True, json=lambda: {'conversation_id': 'synthetic-conversation', 'callSid': 'synthetic-sid'})
        with patch('backend.scenario_engine.requests.post', return_value=response) as provider:
            result = self.execute()
        self.assertTrue(result['success'], result)
        payload = provider.call_args.kwargs['json']['conversation_initiation_client_data']
        self.assertEqual(payload['conversation_config_override']['tts']['voice_id'], 'assigned-voice')
        self.assertEqual(payload['dynamic_variables']['receptionist_id'], '9')
        self.assertEqual(payload['dynamic_variables']['call_log_id'], self.log_id)
        self.assertIn(APPT, payload['dynamic_variables']['mission'])
        self.assertIn('secret__nodemere_context', payload['dynamic_variables'])
        self.assertEqual(len(self.db.data['call_logs']), 1)
        self.assertEqual(self.db.data['call_logs'][0]['conversation_id'], 'synthetic-conversation')
    def test_timeout_is_uncertain_not_safe_to_redial(self):
        with patch('backend.scenario_engine.requests.post', side_effect=requests.Timeout):
            result = self.execute()
        self.assertFalse(result['success'])
        self.assertTrue(result['dispatch_unknown'])
    def test_provider_rejection_is_definitive(self):
        with patch('backend.scenario_engine.requests.post', return_value=SimpleNamespace(ok=False, status_code=422)):
            result = self.execute()
        self.assertFalse(result['success'])
        self.assertFalse(result['dispatch_unknown'])
    def test_fast_webhook_completion_is_not_regressed(self):
        def response(*args, **kwargs):
            self.db.data['call_logs'][0]['status'] = 'completed'
            return SimpleNamespace(ok=True, json=lambda: {'conversation_id': 'fast', 'callSid': 'fast-sid'})
        with patch('backend.scenario_engine.requests.post', side_effect=response):
            self.assertTrue(self.execute()['success'])
        self.assertEqual(self.db.data['call_logs'][0]['status'], 'completed')


if __name__ == '__main__': unittest.main()
