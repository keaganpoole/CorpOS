"""Live appointment acceptance; retains three labeled synthetic appointments."""
import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.test_workspace_cli import DIRECTORY, load, client, ensure_running

values = load()
ensure_running(values)
receipt_file = DIRECTORY / 'appointments-acceptance.json'
receipt = json.loads(receipt_file.read_text()) if receipt_file.exists() else {'appointments': []}

def save():
    receipt_file.write_text(json.dumps(receipt, indent=2))

with client(values) as api:
    def request(method, path, payload=None, expected=200):
        response = api.request(method, path, json=payload)
        assert response.status_code == expected, (response.status_code, response.text[:500])
        return response.json()

    identity = request('GET', '/workspace')
    assert identity['business_id'] == 21
    assert api.post('/appointments', json={'business_id': 22}).status_code == 403
    people_receipt = json.loads((DIRECTORY / 'acceptance.json').read_text())
    existing = request('GET', '/appointments?limit=500')
    for index, person_id in enumerate(people_receipt['records'][:3]):
        marker = f'Synthetic appointment — private agent test {index + 1}'
        row = next((a for a in existing if a.get('notes') == marker), None)
        if not row:
            # Try known daytime slots through the normal scheduler; 409 is a
            # rejected write and can safely advance to another candidate slot.
            for days in range(1, 15):
                day = datetime.now(ZoneInfo('America/New_York')).date() + timedelta(days=days)
                response = api.post('/appointments', json={'date': day.isoformat(), 'time': f'{10 + index}:00',
                    'duration': 30, 'person_id': person_id, 'notes': marker, 'status': 'pending'})
                if response.status_code == 409:
                    continue
                assert response.status_code == 201, (response.status_code, response.text[:500])
                row = response.json()
                break
            assert row, 'No suitable business-hours slot found'
        if row['id'] not in receipt['appointments']:
            receipt['appointments'].append(row['id']); save()
        readback = request('GET', '/appointments/' + row['id'])
        assert readback['business_id'] == 21 and readback['person_id'] == person_id
        updated = request('PUT', '/appointments/' + row['id'], {'status': 'confirmed'})
        assert updated['status'] == 'confirmed'
        assert request('GET', '/appointments/' + row['id'])['status'] == 'confirmed'
    # Separate disposable fixture proves deletion without touching existing data.
    if not receipt.get('delete_verified'):
        last = request('GET', '/appointments/' + receipt['appointments'][-1])
        marker = 'Synthetic appointment — deletion verification'
        disposable = next((a for a in existing if a.get('notes') == marker), None)
        disposable = disposable or request('POST', '/appointments', {'date': last['date'], 'time': last['time'],
            'duration': 15, 'notes': marker}, 201)
        receipt['disposable'] = disposable['id']; save()
        request('DELETE', '/appointments/' + disposable['id'])
        assert api.get('/appointments/' + disposable['id']).status_code == 404
        receipt['delete_verified'] = True
    receipt['verified'] = True; save()
    print(json.dumps(receipt))
