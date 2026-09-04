# Security hardening: Phases 2-4

Implemented 2026-09-03. This document describes the local implementation and
verification, not a claim that the live deployment is upgraded or HIPAA compliant.

## Rollout status

- Phase 1 fixes are preserved. The user supplied live grant/RLS verification with
  all nine containment checks true and RLS enabled on payments, executions and
  integrations. No existing safe signed-in owner/non-owner test identities were
  available for the remaining live payment-isolation exercise. No production
  users or customer records were created for testing.
- Phase 2, 3 and 4 code and migrations are implemented and tested locally.
  New migrations have **not** been applied to live Supabase. Without them, the
  new workforce boundary intentionally fails closed; do not deploy the code
  separately and expect the old schema to support it.
- No packages installed, environment values changed, commits pushed or production
  application deployed. Unrelated starting worktree changes were retained.
- The only provider mutation was authentication headers on 24 existing ElevenLabs
  tools whose URL exactly matched the configured development ngrok origin. The
  existing dedicated development secret was reused. Provider readback verified
  the remaining tool configuration/response mocks unchanged. No production-origin
  tools, agent prompts or workflows were changed.
- Phases 5-8, patient authentication, key/encryption migrations and legal/vendor
  readiness work were not started.

## Phase 2: authorization boundary

`backend/authorization.py` owns the immutable request-local Tenant context and
scoped Supabase facade. Workforce identity comes from Supabase Auth's verified
user response, then current database membership and account state. Client body,
query, scenario and provider arguments do not select the business. Identifiers
must resolve within that tenant. Unknown tables and generic privileged RPC calls
fail closed in workforce contexts. The service-role client is scoped too;
background operations must bind authority from stored scenarios/call bindings.

Current resources include businesses, people, appointments, services, staff,
receptionists, calls, scenarios/executions, payments, invoices, integrations,
documents/requests/contracts/voices, jobs, settings, schemas, purchased numbers,
NEST, feedback, checkpoints and usage records. PostgreSQL adds an independent
restrictive tenant guard, reference/ownership trigger, server-field protections
and client grant restrictions. Existing permissive legacy policies cannot
override these restrictive guards.

Other changes:

- No shared sign-in/sign-up mutation on the API's authentication client.
- Scenario hydration/action/resume checks derive authority from the saved
  scenario, validate nested references and reject business/owner changes.
  Saved refund/subscription-cancellation workflows require Owner AAL2 to change,
  including partial activation updates. Padded action names and encoded JSON
  cannot bypass that check.
- Integrations and connected Stripe-account routing remain server-owned.
- OAuth state has a purpose-derived signing key, audience, expiry and initiating
  actor/business binding. Callback completion rechecks current membership/role.
  In-flight old OAuth connections must be restarted after rollout.
- Internal tools require both the dedicated internal secret and a signed,
  purpose-separated business capability. Billing test mode never skips either.
- Inbound number assignment and stored outbound call IDs establish trusted call
  bindings. Conflicting bindings fail. A late, authenticated provider webhook may
  use an expired signed capability only with an existing agreeing call binding;
  expired capabilities still fail ordinary tool authentication.
- Closing/disabled accounts and removed memberships lose future API/database
  access. Closing the legacy billing principal while other members remain is
  refused instead of stranding their data. Existing cached/displayed data cannot
  be retroactively erased by revoking membership.
- Retired predecessor-product API groups return 410, including the old password
  vault and rep APIs. No AES/PIN code was expanded or migrated.

## Phase 3: workforce and MFA

Membership is independent of `staff.role`, which remains a job title. There is
one active business per login, matching the current application's workspace
model. Multiple-workspace switching was not introduced. Existing business
creators are backfilled as Owner; new businesses acquire their first Owner in a
database trigger. The migration fails on ambiguous existing multiple-business
ownership instead of choosing a business or rewriting data.

`businesses.user_id` remains the stable legacy billing/data principal. Membership
controls human authorization. Ownership transfer promotes the selected active
member and demotes the previous Owner atomically, without silently moving Stripe
connections or rewriting historical ownership columns. Last-Owner removal and
demotion are blocked with a database lock/trigger.

### Permission matrix

`Yes + MFA` means AAL2 is required even when the business-wide MFA requirement is
off. If the business requires MFA, all workforce application access requires
AAL2. An already-enrolled authenticator also requires a challenge at login.

| Capability | Owner | Manager | Staff |
| --- | --- | --- | --- |
| View/create/edit customer records | Yes | Yes | Yes |
| View/create/reschedule/cancel appointments | Yes | Yes | Yes |
| View staff/services/receptionists | Yes | Yes | Yes |
| Manage staff/services/receptionists/scenarios | Yes | Yes | No |
| Read call logs/transcripts; play recordings | Yes | Yes | No |
| Read/download customer documents | Yes | Yes | No |
| Read operational analytics | Yes | Yes | No |
| Create/send customer payments/invoices | Yes | Yes | No |
| Refund or cancel customer subscriptions | Yes + MFA | No | No |
| View Nodemere subscription billing | Yes | No | No |
| Change subscription/payment method/integrations/forwarding | Yes + MFA | No | No |
| Change business settings/security policy | Yes + MFA | No | No |
| Invite/remove/change members; transfer ownership | Yes + MFA | No | No |
| Sensitive export/permanent deletion endpoints | Yes + MFA | No | No |
| Set up/challenge own native authenticator | Yes | Yes | Yes |
| Audit log/key administration | Not implemented | Not implemented | Not implemented |

The matrix is enforced in backend permissions and independent RLS policies, not
just navigation. Existing screens may still expose a button whose operation is
denied with a step-up/role message; no broad interface redesign was performed.
An authorized reader can inherently copy information already displayed; a role
cannot prevent screenshots or manual copying of legitimately disclosed data.

Owners invite by email as Manager or Staff. The invitation's chosen role is
server-controlled. Acceptance requires the authenticated account's confirmed
matching email; invalid, expired, revoked/reused invitations fail. An invitation
also fails if its inviter is no longer an active Owner. Invitations cannot grant
Owner; use the explicit transfer operation. The existing system Gmail delivery
is reused with generic sign-in instructions. If delivery is unavailable, pending
invitations remain accessible after signing in with the invited email.

Native Supabase MFA flow:

1. Sign in with password or OAuth and resolve the workforce policy.
2. Enroll TOTP if required and no verified factor is available. Supabase supplies
   the QR/manual setup key; neither is stored by Nodemere in browser persistence.
3. Challenge/verify through Supabase; use its refreshed AAL2 session.
4. Refresh workforce state on auth-token change, focus and a 60-second interval.
5. Enforce AAL2 again in the API and database for required/step-up operations.
6. Clear workforce/transient state and realtime channels on logout.

Re-enrollment verifies a replacement factor before the UI removes the old one.
Lost-all-factor recovery requires a verified support review and Supabase-native
administration; password reset is not an MFA bypass. No custom recovery-token or
patient MFA system was created. This still requires an operational recovery
procedure before healthcare use.

## Phase 4: exposure reduction

- Operational logs use static event identifiers, status codes and correlation
  IDs. Request/exception/provider payloads, secrets and stack content are not
  emitted through configured handlers. Frontend console arguments are static.
  These logs are **not** a tamper-resistant security audit trail (Phase 5).
- Call extraction keeps canonical transcript turns, necessary call reporting and
  the actual private recording, not a second base64 recording in JSON. Provider
  initiation/metadata copies are restricted. Existing historical raw payloads
  were not purged; client column grants now block them.
- Call lists return explicit metadata fields without transcripts, raw payloads or
  signed recording URLs. Explicit playback requests authorize the record and
  produce a 60-second URL. Detailed transcripts/reports load on demand.
- Scenario progress polling returns node/trace/status information, not paused
  patient context. Terminal workflow snapshots retain safe progress metadata;
  paused workflows retain necessary operational context for continuation with
  credentials/capabilities/raw trigger copies removed.
- Appointment conflicts return busy intervals rather than other patients'
  appointment rows. Business/staff tool responses exclude security, billing,
  provider configuration and staff consent evidence.
- Sensitive searches use request bodies. Debug route tracking uses route
  templates, not capability-bearing paths. API responses use private/no-store,
  no-referrer and nosniff headers.
- NEST history and onboarding drafts no longer persist PHI-like payloads in
  localStorage. Legacy app-owned keys are cleared. Conditional-color rule values
  are memory-only and reset on reload/logout. Non-sensitive preferences and
  Supabase's native Auth session storage remain. Auth tokens still require a
  secure browser and protection from XSS.
- Private documents use authorized streamed downloads, short-lived access where
  signing is needed, bounded bytes and generic safe download filenames. Object
  URLs are revoked and PDF previews sandboxed. Storage paths do not contain
  original patient filenames.
- Upload checks bound size early, validate actual content against declared MIME,
  reject common active PDF/DOCX content and unsafe archives, and re-encode avatars
  to strip metadata. Voice samples are bounded and checked for expected container
  signatures. All direct browser storage writes must go through the authorized,
  validating API. This is not a full malware scanner; `scan_document` is the
  extension point for stronger scanning.
- Invoice descriptions, line-item names and payment metadata sent by Nodemere
  are generic. Stripe still receives necessary payment/contact data. Existing
  configurable scenario email bodies may intentionally carry user-selected
  content; software minimization does not make arbitrary email templates safe
  for healthcare use.
- Realtime authorization relies on current membership/role/AAL RLS, not browser
  filters. Column grants restrict call/invoice payloads. Live Supabase Realtime
  behavior and publication configuration still need deployment acceptance tests.

Remaining intentional PHI locations include canonical customer/appointment data,
authorized displays, necessary call transcripts/recordings, private documents,
in-flight/paused workflow state and the voice providers. Historical backups/logs
were not deleted or reconfigured. Do not use real PHI in local development.

## Database rollout

Apply these migrations in order after the already-applied Phase 1 containment:

1. `sql/2026_09_03_phase2_authorization.sql`: independent tenant RLS, protected
   ownership/security fields and references, client/worker RPC restrictions.
2. `sql/2026_09_03_phase3_membership_mfa.sql`: membership/invitations, creator Owner
   backfill, atomic transfer/acceptance, last-Owner protection, role/MFA policies.
3. `sql/2026_09_03_phase4_data_minimization.sql`: restricted sensitive column
   access, private buckets and validated-server-only storage writes.

All three were applied twice successfully to local PostgreSQL 17 fixtures. No
customer record deletion/encryption migration is included. Each migration is
transactional. Apply with a recoverable database backup and deployment plan, not
by running fixture scripts on production. Do not roll back by restoring broad
anonymous grants.

Read-only preflight on the live project should establish:

- No existing user owns multiple businesses (the current single-workspace model
  cannot safely choose between them).
- Existing IDs/FKs match the inspected schema and existing ownership references
  are consistent; mismatched historical rows should be investigated, not moved
  automatically between tenants.
- Custom public SQL functions used by any uninspected policies/jobs are accounted
  for. Phase 2 makes non-extension public application RPCs backend-only. Current
  Nodemere frontend has no application RPC dependency.
- The three private bucket IDs match the configured project. Public business/staff
  marketing avatar assets deliberately remain public; never use them for PHI.
- All deployed ElevenLabs tool definitions, not just development-origin tools,
  have secure header bindings before switching to the hardened backend.

After applying, run `sql/verify_phases2_4.sql` (read-only catalog verification),
then exercise the live role/MFA/isolation and provider flows below. Catalog
booleans alone do not prove the signed-in session behavior.

## Verification record

Final offline backend invocation (external network blocked):

```powershell
python -B -m unittest backend.test_phase1_security backend.test_phase2_security backend.test_phase3_security backend.test_phase4_security backend.test_schedule_rules backend.test_email_delivery_service -q
```

130 tests passed: Phase 1 33; tenant-boundary 13; role/MFA 10; privacy/HTTP/security
67; schedule 3; existing email delivery 4. Subtest matrices additionally exercise
each registered resource, role and assurance combination.

```powershell
node --test src/lib/workforceSecurity.test.js src/lib/browserPrivacy.test.js src/sonar/lib/safeTemplateHTML.test.js
npm run build
```

21 frontend/security tests passed. These include native SDK orchestration mocks
and AST/source checks; they are not live browser/provider E2E tests. Build passed
(3,165 modules); 32 Python source files compiled without writing bytecode.
`git diff --check` passed. ESLint cannot run because the repository has no ESLint
configuration; none was invented as part of this security batch. Existing Vite
warnings concern CSS import order, stale Browserslist data and large chunks.

Five PostgreSQL suites passed in disposable local databases:

- `backend/test_phase1_rls.sql`: owner A/B, anonymous/client denials, accidental
  regrants, historical permissive policies, backend access and repeatability.
- `backend/test_phase2_rls.sql`: real-schema-shaped fixtures, ownership attacks,
  reference/field protection, closed accounts and independent RLS.
- `backend/test_phase3_rls.sql`: roles, invitation acceptance/rejection,
  last-Owner/transfer/new-owner behavior, removed memberships and AAL policies.
- `backend/test_phase4_rls.sql`: sensitive column/storage denials, private buckets,
  optional-factor challenge enforcement and preserved Phase 1 containment.
- `backend/test_tenant_resources_rls.sql`: actual SQL queries across 26 resources,
  foreign-ID writes/deletes, legitimate writes, cross-tenant FK attacks and
  service-role access. Synthetic rows roll back afterward.

Fixtures are **not migrations**. Never execute them in Supabase or a shared
database. The Phase 1 fixture expects an empty disposable cluster; the other
fixtures use that cluster's synthetic roles. Do not use blanket backend test
discovery: the old Stripe/ElevenLabs test scripts make real provider calls and
create persistent test objects.

Four read-only local HTTP probes against an existing business also passed:
anonymous tool 401; secret without business context 400; valid signed context 200;
forged business 403. No patient/customer record writes occurred. The isolated
verification backend ran with startup/schedulers disabled. Built assets were
checked against configured backend secrets without printing values; none were
found in the bundle.

## Live acceptance still required

1. Apply the three migrations to the intended Supabase project and verify real
   policy/function/storage catalog results. No live database credentials capable
   of applying SQL were available during this run.
2. With existing/approved test identities, confirm Owner/Manager/Staff and
   unrelated business sessions through API and direct Supabase, including the
   remaining Phase 1 owner/non-owner payment check and membership removal.
3. Exercise real Supabase TOTP enrollment, OAuth plus challenge, token refresh,
   replacement and logout in the browser. No real account factors were enrolled,
   removed or bypassed for testing.
4. Verify deployed Realtime delivery under those identities and actual storage
   upload/download/playback with synthetic files, including rejection paths.
5. Run an end-to-end synthetic inbound/outbound development call through ngrok,
   Twilio and ElevenLabs, then verify webhook ordering, scenario resume, report
   and playback. The local tool checks do not prove telephony delivery itself.
6. Confirm real invitation email delivery and Stripe test-account workflow after
   deployment using approved fixtures; do not run legacy scripts against unknown
   customer accounts. No live charges/calls/emails were sent in the offline suite.

Do not accept healthcare PHI on the strength of this batch alone. Complete live
acceptance before proceeding to the Phase 5 audit trail, Phase 6 envelope
encryption or Phase 7 recovery/retention implementation. Vendor, operational and
legal requirements remain separate and were not implemented here.
