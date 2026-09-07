# Drop-ins

Calendar → Drop-ins opens the configuration modal. Each existing appointment
status owns a separate collection. The gallery is supplied by the backend using
the business's onboarding industry. The catalog covers all 27 onboarding
industries; templates are versioned in `backend/drop_in_templates.py`.

## Storage and authorization

Apply `sql/2026_09_06_drop_ins.sql` before deploying the application. It adds one
table, `drop_ins`, and the nullable `call_logs.drop_in_id` relationship. It also
completes the existing People calling-consent evidence columns when missing.
`available_on_status` configures where a button appears; the appointment remains
the source of its current status. Deleted definitions are hidden but retained so
call history remains understandable.

All definition access goes through the authorized backend. Owners and managers
can configure definitions; callers need `operations.write`. Tenant scope,
foreign-key binding, encrypted instructions, existing security auditing, and
service-only RPC permissions are enforced. The backend's existing encryption
keyring must be configured; new Drop-in instructions never fall back to plaintext.

## Calls

An appointment's assigned receptionist supplies the voice. The existing outbound
executor enforces calling direction, documented consent, do-not-call, and plan
access. Current appointment and service facts accompany the configured mission.
The existing `call_logs` row stores the encrypted instruction snapshot and actor.

A deterministic call-log UUID makes repeated submissions idempotent. A partial
unique index prevents simultaneous Drop-in calls for the same appointment.
Provider timeouts or ambiguous acceptance are marked `dispatch-unknown`, never
automatically redialed. Signed provider webhooks reconcile the original log and
preserve its instruction snapshot. An unresolved unknown dispatch needs provider
reconciliation before another Drop-in can run on that appointment. Usage sorting
counts logs with a recorded call start, excluding rejected preflight requests.

## Verification

Run `python -m unittest backend.test_drop_ins -q` and `npm run build`.
`backend.test_drop_ins_database` additionally checks the migration against an
isolated local PostgreSQL database named `nodemere_drop_ins_test`; it requires
`NODEMERE_DROP_INS_TEST_PORT` and must never target the application database.

Rollout verification on September 6, 2026: migration applied to Supabase; live
schema verified; authenticated browser save verified with encrypted instructions;
desktop/mobile preview, pagination, edit, activation, reorder, and draft discard
checked. A fresh dashboard load retrieved the saved configuration. The actual
appointment showed the button and named its assigned receptionist in confirmation.
The temporary definition was removed through the UI; no call-log entry was
created. Provider dispatch was tested with mocks, without calling a customer.

The 25 focused Drop-in/database tests and the existing outbound trusted-binding
test passed. The broader phase-4 security suite still reports 21 HTTP fixture
authentication failures (401); it is not a clean regression baseline for this
rollout. The build has the existing CSS import-order, Browserslist, and chunk-size
warnings.
