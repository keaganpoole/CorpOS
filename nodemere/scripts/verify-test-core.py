"""Live core acceptance, scoped to the authorized test account.

Preserves existing records; temporarily edits and restores profile/KB/hours.
Retains one labeled staff, service, and synthetic receptionist for inspection.
"""
import copy
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.test_workspace_cli import load, ensure_running, client, DIRECTORY

path = DIRECTORY / 'core-acceptance.json'
receipt = json.loads(path.read_text()) if path.exists() else {'retained': {}, 'deleted': {}}
def save(): path.write_text(json.dumps(receipt, indent=2))
values = load(); ensure_running(values)
with client(values) as api:
    def request(method, route, payload=None, expected=200):
        response = api.request(method, route, json=payload)
        assert response.status_code == expected, (method, route, response.status_code, response.text[:600])
        return response.json()
    assert request('GET', '/workspace')['business_id'] == 21
    if 'original_business' not in receipt:
        receipt['original_business'] = request('GET', '/business'); save()
    original = receipt['original_business']
    if not receipt.get('business_verified'):
        try:
            result = request('PUT', '/business', {'website': 'https://synthetic-test.example.com'})
            assert result['website'] == 'https://synthetic-test.example.com'
        finally:
            request('PUT', '/business', {'website': original['website']})
        assert request('GET', '/business')['website'] == original['website']
        receipt['business_verified'] = True; save()
    if not receipt.get('knowledge_verified'):
        backup = {key: original[column] for key, column in {'about': 'about_us', 'policies': 'policies', 'faq': 'faq'}.items()}
        try:
            content = {key: 'Synthetic knowledge verification: ' + key for key in backup}
            request('PUT', '/knowledge-base', content)
            assert request('GET', '/knowledge-base') == content
        finally:
            request('PUT', '/knowledge-base', backup)
        assert request('GET', '/knowledge-base') == backup
        receipt['knowledge_verified'] = True; save()
    if not receipt.get('business_schedule_verified'):
        hours = copy.deepcopy(original['business_hours'])
        if not hours:
            hours = {'Monday': {'enabled': True, 'open': '10:00', 'close': '11:00'}}
        elif hours.get('schema_version') == 1:
            first = next(iter(hours['days'].values()))
            first['enabled'] = not first.get('enabled', False)
        else:
            first = next(iter(hours.values()))
            first['enabled'] = not first.get('enabled', False)
        try:
            request('PUT', '/schedules/business', {'business_hours': hours})
            assert request('GET', '/schedules/business')['business_hours'] == hours
        finally:
            request('PUT', '/schedules/business', {'business_hours': original['business_hours']})
        assert request('GET', '/schedules/business')['business_hours'] == original['business_hours']
        receipt['business_schedule_verified'] = True; save()
    definitions = {
        'staff': ({'full_name': 'Synthetic Taylor Staff', 'role': 'Test specialist', 'staff_type': 'team_member',
                   'is_active': True, 'escalations': False}, {'role': 'Updated test specialist'}),
        'services': ({'name': 'Synthetic Test Consultation', 'description': 'Synthetic service for feature testing',
                      'unit': 'session', 'price_type': 'fixed', 'price_min': 0, 'category': 'Synthetic tests', 'is_active': True},
                     {'description': 'Updated synthetic service for feature testing'}),
        'receptionists': ({'full_name': 'Synthetic Morgan Receptionist', 'first_name': 'Morgan',
                           'description': 'Synthetic record for UI testing; no voice provider attached'},
                          {'description': 'Updated synthetic receptionist configuration'})}
    for area, (payload, patch) in definitions.items():
        existing = request('GET', '/' + area)
        name_key = 'name' if area == 'services' else 'full_name'
        identifier = receipt['retained'].get(area)
        if not identifier:
            row = next((r for r in existing if r.get(name_key) == payload[name_key]), None)
            row = row or request('POST', '/' + area, payload, 201)
            identifier = row['id']; receipt['retained'][area] = identifier; save()
        request('PUT', f'/{area}/{identifier}', patch)
        row = request('GET', f'/{area}/{identifier}')
        assert row['business_id'] == 21 and all(row[key] == value for key, value in patch.items())
        if area == 'staff':
            hours = {'Monday': {'enabled': True, 'open': '09:00', 'close': '17:00'}}
            request('PUT', f'/schedules/staff/{identifier}', {'working_hours': hours})
            assert request('GET', f'/schedules/staff/{identifier}')['working_hours'] == hours
            receipt['staff_schedule_verified'] = True; save()
        if area not in receipt['deleted']:
            disposable = {**payload, name_key: payload[name_key] + ' Disposable'}
            found = next((r for r in existing if r.get(name_key) == disposable[name_key]), None)
            found = found or request('POST', '/' + area, disposable, 201)
            receipt['disposable_' + area] = found['id']; save()
            request('DELETE', f'/{area}/{found["id"]}')
            assert api.get(f'/{area}/{found["id"]}').status_code == 404
            receipt['deleted'][area] = True; save()
    receipt['verified'] = True; save(); print(json.dumps({'verified': True, 'retained': receipt['retained']}))
