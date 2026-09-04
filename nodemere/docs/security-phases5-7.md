# Phases 5–7 implementation and rollout

Current status: **activated and verified for local/development use** against the
existing Supabase development project. See
[development acceptance](security-phases5-7-development-acceptance.md) and the
[production launch checklist](production-launch-checklist.md).

The remaining sections record the initial implementation and pre-activation
observations; statements below saying activation was pending describe that
earlier pass and are superseded by the development acceptance report. This is
not production sign-off or a claim that every PHI-bearing field is encrypted.

Phase 1 protections remain required. Phases 3–4 are provisionally accepted as
directed. Their only carried-forward acceptance items are:

- Google OAuth → MFA interactive verification.
- Invitation email receipt and acceptance.
- Historical MFA/IP mismatch investigation **if it reproduces**.

These did not block this batch. Phase 8, patient authentication and old PIN-based
encryption are untouched. No packages were installed, secrets written, live
users created, historical records backfilled, retention jobs scheduled, live
migrations applied, settings changed, commits made or code pushed.

## Live read-only observations — September 4, 2026

The logged-in Supabase dashboard for project `grpgmhhtmfiwukncucaq` showed:

- Seven scheduled physical database backups, August 28 through September 3.
  The newest displayed backup was September 3 at 08:14:14 UTC.
- Point-in-time recovery is **not enabled**; the page offers the add-on.
- “Write audit logs to the database” is **off** in Authentication → Audit Logs.
  The page says Auth logs remain accessible through the Auth logs service.
- The backup page explicitly warns that Storage objects are not included.

No Restore, Enable add-on, toggle or Save action was taken. The dashboard also
showed a generic service-incident banner; this was not investigated or used to
attribute an application failure.

Supabase's [backup documentation](https://supabase.com/docs/guides/platform/backups)
confirms the separate Storage backup requirement. Its
[Auth audit documentation](https://supabase.com/docs/guides/auth/audit-logs)
describes the native authentication event source. Application audit events below
do not replace that source or manufacture successful login/MFA events from a
browser callback.

## Phase 5 — security audit trail

- Append-only `security_audit_events` with a service-only append RPC. Ordinary
  clients cannot read, insert, update, delete or truncate the trail. Service role
  cannot directly insert/update/delete it either. Database triggers prevent
  update/delete/truncate even when ordinary table privileges are insufficient.
- Database changes produce audit records **in the same transaction**. An audit
  insertion failure rolls back the database change. A rolled-back change does
  not leave a false successful change event.
- Metadata only: server time, verified actor/business, operation, table/route
  template, canonical local record IDs, status, correlation ID and changed
  **column names**. Never old/new values, customer names, clinical notes,
  transcripts, bodies, IP addresses, query strings, filenames, access tokens,
  key bytes, or signed URLs.
- Per-request server headers attribute database mutations to the verified
  workforce actor. Headers are copied on the individual PostgREST query, never
  added to shared authentication/session state. The SQL trigger trusts them only
  under the service-role JWT; normal clients cannot spoof attribution.
- Scoped server reads record disclosed IDs in batches of at most 200. The
  People/Appointment browser reads now use a two-resource, column/operator
  allowlisted, tenant-scoped API. Direct client reads of those tables are limited
  to invalidation metadata; Realtime callbacks fetch full rows through the
  audited API. No generic SQL/credential/decryption gateway was added.
- API pre-operation events fail closed when collection is enforced. Failed
  identity/tenant/permission checks with a bearer token also produce sanitized
  denial events. Supabase remains the source for native authentication failures.
- Reads are withheld when their audit append fails. If a mutation has already
  committed and the final HTTP-event append fails, the original result is
  preserved with `X-Nodemere-Audit-Status: completion-unavailable`. Pretending a
  charge/write rolled back could cause a duplicate retry. The pre-operation
  record and atomic database-change events remain; investigate requests missing
  completion events. This is not a promise of a distributed transaction spanning
  Stripe and Supabase.
- Owner + AAL2 can view recent activity in the existing Workforce security UI.
  Managers/Staff cannot access it. Cursor pagination is bounded at 100 events.

Coverage limits: native Auth events remain in Supabase Auth logs (database
persistence currently off). Not every metadata/catalog read or every rejected
direct PostgREST request is an application record-access event. Raw internal
administrative database access outside the application is not audited by the
Python request boundary. Database administrators can ultimately alter triggers
or restore an earlier database: this is append-only against application roles,
**not tamper-proof against a database administrator**. An independently protected
archive/alert destination still needs operational selection and configuration.

## Phase 6 — server-side envelope encryption

Random 32-byte per-business DEKs encrypt content with AES-256-GCM. DEKs are
wrapped with a separate 32-byte deployment KEK using AES-256-GCM. Each operation
gets a random 12-byte nonce. AAD binds schema version, business, resource, record
identity/path, field and DEK version. Copying ciphertext to another business,
record, field, bucket or file path fails authentication.

Only wrapped DEKs and version metadata live in `business_data_keys`. KEKs must
come from server-only deployment secrets. No user password, PIN, MFA secret,
Supabase JWT secret, service-role key, or browser variable is used to derive them.
Password/PIN/MFA changes do not require re-encrypting records.

### Connected coverage

| Resource | Envelope-encrypted content when encrypt-new is enabled |
| --- | --- |
| `call_logs` | `transcript_text`, `transcript_jsonb`, `call_report`, `analysis_results`, `conversation_initiation_data` |
| `flow_executions` | `flow_context`, `pause_data`, `trigger_event` |
| `integrations` | `credentials`, including provider access/refresh tokens |
| New private documents | File bytes in `caller-documents` |
| New call recordings | Audio bytes in `call_recordings` |

Read compatibility is maintained for old plaintext rows/files. Protected
columns are transparently decoded only on the server, after tenant scoping.
Encrypted projections return only the requested fields, not wrapper metadata.
New file names end in `.ndmenc`; their bytes are served by an authenticated
backend download/playback endpoint. The browser gets a transient blob URL, not
the KEK/DEK or a long-lived decryption capability. Object URLs are revoked.

Missing keys, malformed envelopes, swapped ciphertext and invalid tags fail
closed. Existing key history prevents silent automatic replacement when no
active key exists. SQL guards reject changed plaintext protected payloads once
a business has a data key. Optimistic revision checks prevent stale encrypted
updates from overwriting concurrent changes. Bulk updates are bounded; a
conflict may leave earlier rows in that batch committed, so retry deliberately.

**Not encrypted by this batch:** people demographics/notes/custom fields,
appointment notes/custom fields, call-list summaries/notes/search fields,
document metadata, scenario definitions/configuration, and other fields outside
the above map. They still rely on access controls and platform encryption at
rest. Existing document/recording objects are not automatically rewritten.
This coverage limitation must remain visible in any healthcare readiness claim.
Extending encryption to searchable fields requires explicit search/read-path
work; do not treat ciphertext as searchable plaintext or reuse the old PIN AES.

### Practical scope and safeguards

Do not add encrypted-search indexes, a custom KMS service, a SIEM, or a patient
identity system merely to make this map look complete. The risk-based baseline
is tenant/role/MFA enforcement, audited PHI access, TLS/private storage, platform
at-rest encryption, minimized copies, targeted envelope protection, and tested
recovery with independently held keys. These controls protect different threats;
application encryption does not protect data from an already authorized,
compromised application process while it is decrypting that data.

Searchable identity/scheduling fields remain outside the envelope layer. That
tradeoff requires a documented risk assessment and verified hosting/database
controls, not a claim that those fields are no longer PHI. HHS explains that
[encryption decisions follow the organization's risk assessment](https://www.hhs.gov/hipaa/for-professionals/faq/2001/is-the-use-of-encryption-mandatory-in-the-security-rule/index.html).
This is not legal approval or an assertion that this implementation alone
satisfies all HIPAA requirements. No additional enterprise architecture was added.

Production (`RENDER` or `NODEMERE_ENV=production`) now defaults to `encrypt-new`
and rejects `read-compatible`. Startup validates the server keyring. This closes
the risk of deploying a PHI workload with encryption accidentally left off.
Local synthetic development keeps its existing compatibility default, independent
of billing test mode; encrypted records still require valid keys for reads.

### Rotation and maintenance

`backend/security_maintenance.py` defaults to dry-run and is not scheduled.
Mutation requires both `--apply` and a matching `--confirm-business-id`.

- `backfill --business-id N --table call_logs|flow_executions|integrations`:
  scans at most 100 rows, validates historical envelopes, verifies replacement
  ciphertext before writing and compares revisions. It reports counts and a
  cursor, never content. Continue with `--after` if a cursor is returned.
- `rewrap --business-id N`: verifies all wrappers, then compare-and-swaps them
  under the configured active KEK when applying. Data records are unchanged.
- `rotate-dek --business-id N`: deliberately creates a new active DEK and retains
  all old versions. Re-encrypt applicable database payloads using backfill.
- `retention --business-id N`: previews policy-bounded removal; only `--apply`
  performs the bounded transient-payload cleanup.
- `backfill-file --business-id N --table people_docs|call_logs --record-id UUID`:
  verifies one tenant-scoped source file without writing by default. Applying
  creates a unique encrypted object, downloads and verifies it, checks that the
  source has not changed, and compare-and-swaps the saved pointer (also the
  recording revision). This supports legacy plaintext files and DEK rotation.
  Stop writes to that record first: Storage and the database do not share an
  atomic transaction. Preview does not provision a key. Applying always encrypts,
  even from a compatibility-mode operator process. Limits match the existing
  document/recording size limits. No contents, filenames or object paths print.

No command exports keys or removes historical keys. `backfill-file` never deletes
the original object, and an uncertain/failed pointer update also retains the
new encrypted copy. A timeout may follow a successful commit. Originals and any
orphaned candidates need subsequent policy-approved reconciliation/disposal;
this tool does **not** claim to remove every historical plaintext copy. Restore
verification and separately protected key/Storage backups are prerequisites for
live use. A complete compromised-DEK response must account for old copies,
backups and exfiltration; rotation cannot undo an earlier disclosure.

## Phase 7 — retention and recovery safeguards

Per-business policy defaults to disabled; day counts are unset. No timer/cron
was created. Owner + AAL2 may inspect/update policy and preview through the
workforce API. Applying cleanup is an explicit operator command.

- A policy-level legal hold blocks cleanup. Policy and candidate rows are locked
  within the cleanup transaction, avoiding races with policy changes/resumption.
- Each batch handles at most 100 old terminal executions and 100 calls.
- Execution cleanup removes only terminal context/pause/trigger/error payloads.
  Paused/running workflows are preserved.
- Call cleanup removes only duplicated transient raw/initiation/analysis data.
  Canonical transcripts, reports, records and recordings are not deleted.
- Cleanup is tenant-scoped, repeatable, and audited. Direct client execution of
  the maintenance RPC is denied. Existing `account_data_requests` remains the
  queue for account/customer deletion requests; no parallel deletion framework
  was introduced.
- `NODEMERE_RECOVERY_MODE=true` disables application HTTP traffic and startup of
  the scenario scheduler, preventing a recovery instance from contacting
  customers/providers through normal app flows. Also isolate its network and
  external webhook routes; this flag is not a network firewall.
- `backend/recovery_drill.py` performs a real local PostgreSQL dump/restore into
  disposable databases, restores a separately saved encrypted synthetic object,
  verifies decryption with separately held keys, and verifies missing-key denial.
  Its connection target is loopback plus the explicitly named fixture database;
  it never imports production app configuration.

No healthcare retention period was invented, no live purge was performed, and
no claim is made that database backups alone protect Storage or lost KEKs.
Canonical-record/file retention and hosted backup replication are still
operational/policy work, not an enabled automatic deletion system.

## Migration and activation order

New migrations (tested twice each locally for repeatability):

1. `sql/2026_09_04_phase5_audit.sql`: trail/RPC/triggers, trustworthy actor
   attribution, metadata-only direct People/Appointment read privileges.
2. `sql/2026_09_04_phase6_envelope.sql`: wrapped DEK registry, protected rotation
   RPCs, revision checks and plaintext downgrade guards.
3. `sql/2026_09_04_phase7_recovery_retention.sql`: disabled retention policy and
   bounded, legal-hold-aware maintenance RPC.

Do **not** rerun Phases 1–4 migrations after these: older blanket grant statements
could undo newer column restrictions. Their prior live application is accepted.

Safe rollout:

1. Prepare compatible backend/frontend artifacts together. Use a maintenance
   window or isolated staging for activation; do not start the updated production
   backend until migrations and keys below are ready. Stale browser bundles may
   need reloading. Local compatibility mode is not a production rollout bypass.
2. Take/verify a recoverable database backup and a separate Storage backup.
   Record their time range, object inventory/hashes and the key versions needed.
3. Provision a cryptographically random 32-byte KEK **in the server's approved
   secret store**, with a separately protected recovery copy and two documented
   custodians. Never put it in Git, VITE variables, browser storage, SQL, chat,
   tickets, command logs or the same unprotected backup archive as ciphertext.
4. Apply only the three new migrations in order. Run
   `sql/verify_phases5_7.sql` (read-only) and behavior-based staging tests.
5. Configure server-only values:
   - `NODEMERE_AUDIT_MODE=enforced` (required for production; automatic for
     `RENDER` or `NODEMERE_ENV=production`). Local default is disabled for API
     access events; DB mutation triggers still operate once installed.
   - `NODEMERE_KEK_RING`: JSON mapping version labels to base64 32-byte KEKs.
   - `NODEMERE_ACTIVE_KEK`: the version label for new wrappers.
   - `NODEMERE_ENCRYPTION_MODE=encrypt-new`; production defaults to this and
     rejects `read-compatible`. Compatibility is for local/staging synthetic
     work only. Start the prepared backend/frontend after configuration.
6. Test synthetic business workflows with native Supabase, Realtime metadata
   notifications, browser refreshes, encrypted files, scheduler resume, provider
   credential refresh, audit storage outages and key-unavailability failures.
7. Backfill database payloads only after restore verification and reviewed
   counts. Never run the operator tool against an unconfirmed business. Do not
   start file migration or turn on retention without the appropriate plan.
   File migration is explicit, one record per invocation, with source writers
   quiesced and originals retained. Never improvise a bulk Storage deletion.
8. Decide native Auth audit persistence/archive retention, independent audit
   archiving/alerts, a Storage backup destination, and recovery time/data-loss
   targets. PITR is an optional paid configuration decision, not silently enabled.

Rollback after encrypted data exists means roll back only to code that still
understands the envelope format. Keep all required KEKs available. Do not flip
back to plaintext writes, drop key tables, remove audit/tenant guards or restore
a pre-key database over newer encrypted Storage objects. Reconcile both backups.

## Recovery procedure

1. Contain compromised credentials and stop external workers/webhooks. Preserve
   incident evidence; do not delete keys or rewrite historical audit records.
2. Restore into an isolated project, not over the only live copy. Keep recovery
   mode enabled and provider traffic blocked; copied Stripe/Twilio/ElevenLabs
   settings must not initiate real actions.
3. Restore database **and** separately backed-up Storage objects, keeping bucket
   names and object paths. Restore all wrapper/key versions needed by that backup
   from the independently protected key recovery store.
4. Verify RLS/grants, active memberships, MFA policy, audit controls, row counts,
   file hashes and decrypt samples across businesses and old/new key versions.
   Test wrong-tenant and missing-key denial, not just successful reads.
5. Reconcile post-backup payments, provider conversations and unfinished jobs
   before enabling workers. A restored database must not recharge customers or
   resend old messages merely because jobs reappear.
6. Record actual recovery duration and data-loss window. Only cut over after
   approval and validation. Rehearse periodically and after key/backup changes.

Never retire an old KEK merely because live wrappers use a newer KEK: retained
database backups can still contain old wrappers. Loss of every valid KEK copy
is not recoverable by a password reset or support bypass.

## Verification

The full relevant explicit suites were used; blanket discovery is intentionally
avoided because older test scripts can make real provider writes.

```text
python -B -m unittest backend.test_phase1_security backend.test_phase2_security backend.test_phase3_security backend.test_phase4_security backend.test_auth_failure_classification backend.test_schedule_rules backend.test_email_delivery_service backend.test_phase57_security backend.test_phase57_http backend.test_file_protection_maintenance -q
node --test src/lib/workforceSecurity.test.js src/lib/browserPrivacy.test.js src/sonar/lib/safeTemplateHTML.test.js src/lib/auditedRead.test.js
npm run build
```

An isolated PostgreSQL 17 server also ran the Phase 2 → 3 → 4 fixtures,
`test_phase57_rls.sql`, the 26-resource tenant fixture,
`test_phase57_database.py`, and `recovery_drill.py`. Do not run fixture SQL against
Supabase. Set `NODEMERE_TEST_PG_PORT` only to that disposable loopback server.

Final totals after the practical-hardening follow-up: 190 offline backend/security
tests; 17 real local PostgreSQL encryption/persistence tests; 25 frontend tests —
**232 tests passed, zero failed,
zero skipped**. The new SQL script additionally passed 46 grouped assertions,
alongside the earlier Phase 2–4 fixtures and the 26-resource tenant-isolation
script. All 12 new catalog checks returned true in the local database. The real
dump/restore drill passed all four checks. Compilation passed for 45 Python
modules; the Vite production build passed. Existing CSS import-order, stale
Browserslist and bundle-size warnings remain unrelated to this security batch.

The last failure-path review also added automatic encryption of new files for
businesses that already have a data key, even in compatibility mode. Database
guards reject plaintext recording/document paths for those businesses. Failed
document metadata inserts no longer delete a file after an uncertain insert
response: the insert may already have committed. The response tells the caller
to refresh before retrying. Preallocated server-side UUIDs also preserve a
valid document ID if the insert returns an empty representation. Regression
tests cover commit-then-timeout, request-completion failure, and empty responses.
File-maintenance tests cover read-only preview, wrong business/record/bucket,
size limits, lost keys, corrupt copies, concurrent source/pointer changes,
uncertain commits and real SQL guards/audit/key rotation. Re-runs included them.

Cleanup: both restore-drill databases and their temporary dump/object artifacts
were removed by the drill. The primary isolated fixture server was stopped.
Recursive deletion of its temporary cluster directory was blocked, so that
synthetic-only directory was retained under the system temporary folder as
`nodemere-phase57-pg-36edf522a4d74da79c050d23260bb0bf`; no production data is there.

## Remaining acceptance / coverage

- Apply/activate the new code and migrations in a controlled rollout; none was
  applied to the live project during this run.
- Verify native Realtime/browser behavior after the new metadata-only grants.
  Local SQL verifies privileges/isolation, not hosted Realtime delivery.
- Exercise encrypted files and provider credential refresh in the deployed
  runtime with server KEKs, plus a hosted database/Storage recovery rehearsal.
- Protect/verify actual key backup copies and Storage backup automation.
- Finalize retention/archive policy and recovery targets before enabling cleanup.
- Document/validate the risk assessment for the explicitly listed fields outside
  the envelope layer. Do not describe Phase 6 as comprehensive field encryption
  or build encrypted search without an identified need.
- Keep the three provisionally accepted Phase 3–4 items at the top of this report
  open; do not inflate this implementation into healthcare certification.
