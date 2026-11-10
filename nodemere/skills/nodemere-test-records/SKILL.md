---
name: nodemere-test-records
description: Manage synthetic Nodemere People, appointments, staff, services, receptionist records, business information, knowledge base, and schedules through the persistent private local API.
---

Use the private local API from `C:\Users\Keagan\.openclaw\workspace\nodemere`.
It is already authorized for `keaganpoole2@outlook.com`, workspace 21 (Outlook Salon).
Credentials are DPAPI encrypted outside the repository. Do not request a password,
print the credential, rerun authorization, use a connected app, or use database
credentials for record operations. Normal requests automatically start the local
service when needed. Access covers the core test-record areas documented below.

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

## Appointments

Use the same credential and CLI with `GET /appointments?limit=500&offset=0`,
`GET /appointments/UUID`, `POST /appointments`, `PUT /appointments/UUID`, and
`DELETE /appointments/UUID`. No extra authorization or UI setup is needed.

Create payload example:

```json
{"date":"2026-11-16","time":"10:00","duration":30,"status":"pending","person_id":249,"notes":"Synthetic appointment for testing"}
```

Choose dates relative to the user's requested period; the example date is not a
default. Date and time are required. Duration is 1–1440 minutes. Status must be
pending, confirmed, cancelled, completed, or missed. person_id, service_id,
staff_id, and receptionist_id are optional and must belong to the bound workspace.
Read People records to select a synthetic person; do not invent referenced IDs.
Existing scheduling rules enforce business/staff hours and staff conflicts; a
409 response reports a rejected slot. Adjust within the requested scope or report
the conflict; never bypass the scheduler. Normal appointment triggers still run.
Read existing field definitions at `GET /appointment-fields` when needed.
Only populate existing appointment custom fields if requested; this helper does
not create appointment field definitions. Read back every saved appointment, and
confirm a deleted appointment returns 404. Preserve pre-existing appointments.

## Remaining core records

All routes reuse the same connection, workspace identity, and CLI `request` syntax.
Use GET first, write only requested changes, and GET the affected record afterward.
Do not delete or overwrite pre-existing content merely to populate test data.

| Area | Routes | Payload and behavior |
| --- | --- | --- |
| Staff profiles | GET/POST `/staff`; GET/PUT/DELETE `/staff/UUID` | full_name required for create; first_name, last_name, role, email, phone, avatar, staff_type (team_member/transfer_contact/both), is_active, working_hours, escalation_hours, escalations, knowledge, acknowledgements. These are staff profiles, not login invitations or workforce memberships. |
| Services | GET/POST `/services`; GET/PUT/DELETE `/services/UUID` | name required for create; description, category, unit, price_type, price_min, price_max, is_active, sort_order. Example: name Synthetic Consultation, unit session, price_type fixed, price_min 0. |
| Business profile | GET/PUT `/business` | name, phone, email, avatar, address, city, state, zip, website, industry, about_us, policies, faq, business_hours, business_timezone. PATCH semantics via PUT: supply only requested keys. Billing, provider, forwarding, ownership, and security fields are excluded. |
| Knowledge base | GET/PUT `/knowledge-base` | about, policies, faq as text or null. Maps to the existing business-profile content; there is no separate knowledge table to seed. |
| Business schedule | GET/PUT `/schedules/business` | business_hours and/or business_timezone. Accepts current structured schema_version 1 / days / layers (business/inbound/outbound, decimal start/end), and legacy weekday objects with enabled/open/close. Reuse the current format. |
| Staff schedules | GET/PUT `/schedules/staff/UUID` | working_hours and/or escalation_hours, using weekday objects with enabled/open/close. |
| Receptionists | GET/POST `/receptionists`; GET/PUT/DELETE `/receptionists/ID` | POST creates a synthetic receptionist record with full_name, optional first_name, description, avatar, traits, voice, age, gender. It has no provider voice attached and starts with direction none. Active receptionist limits still apply. PUT supports synthetic metadata edits plus existing status/is_active/direction behavior. Changing direction can displace the current inbound/outbound assignment; do so only when requested. DELETE preserves existing lifecycle behavior, including archiving when linked history exists. |
| Existing catalog hire | GET `/receptionists/catalog`; POST `/receptionists/hire` | Supply catalog_id or an owned created_receptionist_id/custom_voice_id. Uses normal account plan and lifecycle checks; never fake a provider voice ID. Catalog changes, paid voice creation, cloning, and phone provisioning are outside this testing helper. |

Synthetic receptionist metadata cannot be applied to existing real/catalog hires.
The synthetic record endpoint tests data and UI behavior; voice generation is a
separate operation. Do not claim a functioning voice from a synthetic record.
When testing business/knowledge/schedule mutations, save the original values to a
local receipt before writing, and restore them in a finally block after verification.
Staff and service deletion use the existing handlers and respect linked-data rules.
The optional scenarios, conversations/call-history, and People-document areas were
explicitly excluded from the requested scope.
