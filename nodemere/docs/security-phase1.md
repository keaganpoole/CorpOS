# Phase 1 security implementation

Status: local code implemented and tested. Live Supabase containment is pending
SQL-admin access. No production application deployment or Git push was performed.

## Implemented

- Internal-tool authentication always checks the dedicated secret. Billing test
  mode, Stripe real-test mode and billing configuration failures cannot bypass it.
  Missing server configuration returns 503; missing/wrong credentials return 401.
- Added a random development-only secret to the ignored `backend/.env`.
  It is not a Vite variable and was verified absent from the built JavaScript.
- Configured and verified the matching ElevenLabs workspace-secret reference on
  24 tools used by the configured inbound/outbound agents, including workflow
  tools, whose URLs point to the existing development ngrok origin. Only the
  internal authentication header changed; prompts, workflows and caller
  authentication were not changed. Production must use a different secret.
- Dashboard users are authenticated through Supabase Auth, not the old generic
  locally signed JWT path. OAuth state has a dedicated audience, expiration and
  provider check; external return URLs are rejected.
- Escaped OAuth callback messages and inline JSON. Escaped literal text and
  variable labels in both production and homepage scenario chip renderers.
- Missing-business service/staff/appointment reads return an empty list without
  querying unscoped tenant data. Relevant writes require a resolved business.
  Service/person creation cannot assign another business; appointment changes
  and person/service relationships are tenant-scoped.
- Builder/trigger payloads cannot set execution ownership or inject authoritative
  record snapshots. Scenario hydration resolves the scenario owner's business
  first and scopes person, appointment, staff, payment and invoice queries.
  Scenario record actions cannot alter ownership/system columns; tenantless
  events no longer match every scenario. Resume data cannot replace tenant fields.
- Client integration updates can change provider selection only. Connected
  account identity comes from server-written credentials, and Stripe Connect
  event metadata cannot choose another tenant. Simulated Stripe authorization
  remains functional.

## Database containment prepared, not applied live

Apply `sql/2026_09_03_phase1_security_containment.sql` with a database-owner
connection, then run `sql/verify_phase1_security.sql`.

The migration:

- Enables RLS on the three targeted tables.
- Revokes browser/anonymous table and historical column grants for
  `flow_executions` and `integrations`; both use existing authenticated backend APIs.
- Blocks anonymous payment access, preserves authenticated owner-only payment
  reads, and prevents direct client payment writes.
- Adds restrictive guards so existing permissive policies cannot override these
  restrictions, even after an accidental future privilege regrant.
- Restricts the SECURITY DEFINER job-claim RPC to `service_role`.
- Preserves backend access and changes no rows, billing flags, application roles,
  MFA configuration or encryption.

The live read-only check during this implementation still found 14 payments and
8 flow executions anonymously visible. This is an unresolved live exposure until
the migration is applied and verified. The available service-role application
key does not authorize DDL; no SQL-admin connection was available.

Before applying, inspect current grants/policies and retain a schema-only snapshot.
After applying, verify both catalog checks and REST access: anonymous reads denied,
users A/B unable to see each other's payments, backend access still functional,
and normal scenario variable loading/integration management functioning.

## Verification performed

- `python -m unittest backend.test_phase1_security backend.test_schedule_rules backend.test_email_delivery_service -q`
  — 40 tests passed, including many parameterized negative cases.
- `node --test src/sonar/lib/safeTemplateHTML.test.js` — 6 tests passed.
- Real PostgreSQL 17 in a separate temporary local cluster:
  `backend/test_phase1_rls.sql` passed. Tested anonymous access, two owners, an
  unrelated user, table/column grants, intentionally permissive legacy policies,
  accidental regrants, denied writes/RPCs, backend access and repeated migration
  application. All nine checks in the verification SQL were true.
- `npm run build` passed. Existing CSS import-order, old Browserslist data and
  large-bundle warnings remain.
- Temporary loopback-only backend smoke check, using actual local configuration
  with background startup/schedulers disabled:
  missing secret 401; wrong secret 401; valid secret without business 400;
  valid secret with the existing business's service-list request 200;
  billing test-mode endpoint remained enabled. No customer writes.
- ElevenLabs readback confirmed all 24 header-only tool updates.
- The development secret was absent from the production JavaScript bundle.

The Python security suite replaces database clients, blocks external network
access, and does not start background workers. Do not run blanket discovery of
all historical backend tests: some older files make real provider/database changes.
The SQL fixture is for a disposable cluster only, never the Supabase project.

## Local development and rollout

Normal `npm run backend:dev` loads the ignored backend secret. Internal callers
must send `x-nodemere-internal-secret`; browser code must never receive it.
Billing test mode remains a separate safety switch.

For future development tool setup, inspect first:

```text
python -m backend.configure_development_tools --origin https://YOUR-DEVELOPMENT.ngrok-free.dev
```

Add `--apply` only when intentionally configuring that development environment.
The helper rejects non-development origins and preserves every tool field except
the secret header. It uses ElevenLabs'
[workspace secrets](https://elevenlabs.io/docs/api-reference/workspace/secrets/create)
and [tool update API](https://elevenlabs.io/docs/api-reference/tools/update).

The backend and ngrok tunnel were not running at the start of this work. A live
phone-call end-to-end test was not performed. The temporary smoke-test backend
does not replace the normal development server.

Production rollout still requires its own internal-tool secret in the backend
and matching production-provider headers, the targeted database migration,
application deployment, then authenticated smoke tests. Do not deploy with an
empty secret or restore the old billing-mode bypass.

## Explicitly untouched / remaining

No business-role implementation, MFA, PHI encryption, PIN/AES refactoring, patient
identity system, broad audit-log architecture, retention redesign or dependency
upgrade was performed. Existing unrelated worktree changes were preserved.

This closes the scoped Phase 1 code paths, not every issue in the full audit.
Broader authorization consolidation, historical-data integrity review, logging/
PHI minimization and subsequent phases still require their approved work.
