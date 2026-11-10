---
name: nodemere-test-records
description: Create, read, update, or delete synthetic Nodemere People records and account-specific custom fields for Keagan's private test workspace using the persistent local API.
---

Use the private local API from `C:\Users\Keagan\.openclaw\workspace\nodemere`.
It is already authorized for `keaganpoole2@outlook.com`, workspace 21 (Outlook Salon).
Credentials are DPAPI encrypted outside the repository. Do not request a password,
print the credential, rerun authorization, use a connected app, or use database
credentials for record operations. Normal requests automatically start the local
service when needed. This first milestone covers People and their custom fields.

Verify identity first:

```powershell
python -m backend.test_workspace_cli request GET /workspace
python -m backend.test_workspace_cli request GET /fields
```

For JSON mutations, write the exact payload to a temporary UTF-8 JSON file and use:

```powershell
python -m backend.test_workspace_cli request POST /people --json-file C:\path\people.json
python -m backend.test_workspace_cli request PUT /people/RECORD_ID --json-file C:\path\patch.json
python -m backend.test_workspace_cli request GET /people/RECORD_ID
python -m backend.test_workspace_cli request DELETE /people/RECORD_ID
```

Create only the number and kinds of records requested. Use plausible synthetic
names and example.com email addresses; never invent consent or use real people's
contact details. Prefer no phone number unless requested. Preserve existing notes
and unrelated fields on updates. Read the exact target before an authorized delete.
Always read back saved IDs before reporting success. Persist IDs during a batch.
Do not automatically retry a timed-out create: reconcile by its unique synthetic
email first, because the write might already have committed.

Create account-specific columns only when requested:

```json
{"label":"Membership level","field_type":"select","options":["Basic","Premium"]}
```

Send that payload to `POST /fields`. Use the returned `field_key` inside a Person:

```json
{"first_name":"Avery","last_name":"Morgan","email":"avery.synthetic@example.com","custom_fields":{"custom_RETURNED_KEY":"Premium"}}
```

Field types: text, number, boolean, date (YYYY-MM-DD), select, multi_select. Read
`GET /fields` to reuse existing keys, types and options. The API rejects unknown
fields and invalid values. Field definitions are scoped to this account; these
operations never add database columns. Docs/upload fields are not supported by
this helper. `DELETE /fields/FIELD_KEY` refuses deletion while any People values
still use the field; remove values or requested records first. Existing People
updates merge custom values, so use null to clear a value rather than replacing
the entire custom_fields object.

For efficient batches, use the Python helper in one process:

```python
from backend.test_workspace_cli import load, ensure_running, client
values = load()
ensure_running(values)
with client(values) as api:
    identity = api.get('/workspace'); identity.raise_for_status()
    # Generate requested synthetic payloads, POST individually, store each ID,
    # then GET each ID and compare the requested values.
```

List People with `/people?limit=500&offset=0`; paginate by offset. A permission or
identity mismatch must stop the operation. Connection setup is persistent and has
no automatic expiration; it requires attention only if the encrypted local file
is lost, Windows user changes, ownership changes, or the account is closed.
