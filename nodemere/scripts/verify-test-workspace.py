"""Live acceptance: temporary field fixture + ten retained synthetic People.

Run only when authorized to insert test data into the bound test account.
Writes a receipt after EACH create; reruns reconcile it rather than duplicate it.
"""
import json
from pathlib import Path
import sys
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.test_workspace_cli import DIRECTORY, client, ensure_running, load

receipt_path = DIRECTORY / 'acceptance.json'
receipt = json.loads(receipt_path.read_text()) if receipt_path.exists() else {'records': [], 'run': uuid4().hex[:10]}


def save():
    receipt_path.write_text(json.dumps(receipt, indent=2), encoding='utf-8')


values = load()
ensure_running(values)
with client(values) as connection:
    def request(method, path, payload=None, expected=200):
        response = connection.request(method, path, json=payload)
        if response.status_code != expected:
            raise RuntimeError(f'{method} {path}: {response.status_code} {response.text[:500]}')
        return response.json()

    workspace = request('GET', '/workspace')
    assert workspace['account_email'] == 'keaganpoole2@outlook.com'
    assert workspace['business_id'] == 21
    assert connection.get('/workspace', headers={'Authorization': ''}).status_code == 401
    assert connection.get('/workspace', headers={'Origin': 'http://localhost:5173'}).status_code == 403
    assert connection.post('/people', json={'business_id': 22}).status_code == 403
    assert connection.post('/people', json={'custom_fields': {'custom_unconfigured': 'x'}}).status_code == 422

    if not receipt.get('field_verified'):
        fields = request('GET', '/fields')
        label = 'Agent verification ' + receipt['run']
        field = next((f for f in fields if f['label'] == label), None)
        field = field or request('POST', '/fields', {'label': label, 'field_type': 'select', 'options': ['Verified', 'Updated']}, 201)
        receipt['temporary_field'] = field['field_key']
        save()
        marker = 'Synthetic authorization verification ' + receipt['run']
        people = request('GET', '/people?limit=500')
        person = next((p for p in people if p.get('notes') == marker), None)
        person = person or request('POST', '/people', {'first_name': 'Synthetic', 'last_name': 'Verification',
            'email': 'nodemere-verification-' + receipt['run'] + '@example.com', 'notes': marker,
            'custom_fields': {field['field_key']: 'Verified'}}, 201)
        receipt['temporary_person'] = person['id']
        save()
        assert person['custom_fields'][field['field_key']] == 'Verified'
        assert connection.delete('/fields/' + field['field_key']).status_code == 409
        updated = request('PUT', '/people/' + str(person['id']), {'custom_fields': {field['field_key']: 'Updated'}, 'city': 'Test City'})
        assert updated['custom_fields'][field['field_key']] == 'Updated'
        saved = request('GET', '/people/' + str(person['id']))
        assert saved['city'] == 'Test City' and saved['business_id'] == 21
        request('DELETE', '/people/' + str(person['id']))
        assert connection.get('/people/' + str(person['id'])).status_code == 404
        request('DELETE', '/fields/' + field['field_key'])
        assert all(f['field_key'] != field['field_key'] for f in request('GET', '/fields'))
        receipt['field_verified'] = True
        save()

    names = [('Avery', 'Morgan'), ('Jordan', 'Reed'), ('Taylor', 'Brooks'), ('Casey', 'Bennett'),
             ('Riley', 'Hayes'), ('Cameron', 'Parker'), ('Alex', 'Sullivan'), ('Drew', 'Foster'),
             ('Morgan', 'Ellis'), ('Quinn', 'Bailey')]
    existing = request('GET', '/people?limit=500')
    for index, (first, last) in enumerate(names, 1):
        email = f'nodemere-synthetic-{receipt["run"]}-{index}@example.com'
        matches = [p for p in existing if p.get('email') == email]
        if matches:
            person = matches[0]
        else:
            person = request('POST', '/people', {'first_name': first, 'last_name': last, 'email': email,
                'city': 'Portland', 'state': 'ME', 'notes': 'Synthetic test record — private agent verification.',
                'consent_sms': False, 'consent_call': False, 'do_not_call': True, 'do_not_text': True}, 201)
        if person['id'] not in receipt['records']:
            receipt['records'].append(person['id'])
            save()
        saved = request('GET', '/people/' + str(person['id']))
        assert saved['email'] == email and saved['business_id'] == 21
    receipt['workspace'] = workspace
    receipt['verified'] = True
    save()
    print(json.dumps({'verified': True, 'field_create_populate_update_cleanup': True,
                      'retained_synthetic_records': len(receipt['records']), 'receipt': str(receipt_path)}))
