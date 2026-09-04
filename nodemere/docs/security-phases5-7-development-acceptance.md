# Phases 5–7 — development activation and acceptance

Date: September 4, 2026. Target: local Nodemere plus Supabase development project
`grpgmhhtmfiwukncucaq`. No Render login, deployment, purchase or production
infrastructure configuration was performed.

| Phase | Local/development readiness |
| --- | --- |
| 5 — audit logging | PASS |
| 6 — envelope encryption | PASS for the documented protected-field/file scope |
| 7 — retention and recovery | PASS for isolated development recovery |

## Activated

- Applied `2026_09_04_phase5_audit.sql`, `2026_09_04_phase6_envelope.sql`, and
  `2026_09_04_phase7_recovery_retention.sql` through the logged-in Supabase SQL
  editor. Phases 1–4 migrations were not reapplied.
- Corrected/reapplied Phase 7 after inspecting the actual schema: `raw_payload`
  is NOT NULL. Cleanup writes `{}` and excludes an already-empty object from
  future candidates. The local SQL fixture now enforces the same constraint.
- Enabled and saved Supabase-native Auth audit database persistence. Verified
  twelve native events for the final pair of synthetic accounts, without
  displaying their payloads. Application record-access audit is separate.
- Configured development-only server KEKs in ignored `backend/.env`, with
  `NODEMERE_ENV=development`, encryption `encrypt-new`, auditing `enforced`.
  Existing billing/internal-tool/provider settings were not changed. No key
  was printed or put in a frontend variable; source/bundle secret scan passed.
- Restricted backend environment-file and recovery-directory access to the
  current Windows account and SYSTEM. Generated/verified a separate DPAPI
  recovery copy under `%LOCALAPPDATA%/Nodemere/security-development/key-recovery`.
  This is deliberately local, Windows-account-bound recovery, not off-server DR.

## Proven against real development services

Final completed acceptance runs: **68 passing checks** (52 Phase 5–7 checks and
16 repeated native onboarding/MFA fixture prerequisites), zero failing checks.

- Real Supabase JWT/TOTP AAL2 sessions access the local FastAPI application.
  Owner PHI access produces actor-attributed metadata-only audit records.
- Anonymous/workforce direct access to audit/key/policy tables is denied;
  service credentials cannot rewrite the audit table. Audited People reads
  work, while direct PHI projections and other-business records are denied.
- Both legacy document and recording objects were downloaded from actual
  Storage, encrypted into verified new objects, and migrated using scoped
  pointer/revision checks. New multipart document uploads through localhost
  also store ciphertext; authorized downloads return the original bytes.
- Unauthorized and other-business document/audio access fails. Missing keys
  fail closed. Live SQL rejects plaintext transcript downgrades.
- KEK rewrapping and DEK rotation preserve historical and current decryption.
  Files were re-encrypted after rotation and playback still worked.
- Native Realtime delivers authorized row identifiers, excludes PHI fields and
  does not deliver another business's changed row. This was a real WebSocket
  test with the new column grants, not merely a mocked subscription.
- Actual server logs exclude the synthetic PHI canary and upload capability.
- A protected disk backup captured synthetic ciphertext rows, wrapped-key
  versions and actual downloaded Storage bytes. A fresh offline registry
  restored them using the separately recovered development KEKs. Corruption
  was rejected. A disposable live call row and its Storage object were then
  removed and restored from that backup; authorized HTTP playback succeeded.
- Missing/disabled retention policies and legal holds block cleanup. Preview
  selects only eligible terminal/old payloads. Applying to the synthetic
  business preserved canonical transcripts and paused workflows; repeat
  cleanup found zero candidates. The other business remained blocked.

One preliminary runtime test sent `notice_accepted` rather than the existing
`acknowledged` multipart field and received 400. The test was corrected, without
weakening application validation; its replacement run passed all 18 checks.

## Regression and recovery evidence

- 190 existing offline backend/security tests passed, plus 3 Windows recovery
  protection tests; 17 actual local PostgreSQL persistence tests; 25 frontend
  tests: **235 passed**, zero failures/skips in these explicit runs.
- 46 grouped audit/encryption/retention SQL assertions and the 26-resource
  tenant-isolation fixture passed against isolated PostgreSQL.
- All twelve live catalog assertions passed. Separate PostgreSQL dump/restore
  drill passed all four database/object/key/missing-key checks.
- Frontend build and Python compilation passed. Existing bundle-size,
  Browserslist and CSS import-order warnings are unchanged.

Artifacts are under `%LOCALAPPDATA%/Nodemere/security-development/backups`:
`security-acceptance-20260904-029c1b67` contains the protected recovery backup;
`security-acceptance-20260904-bb9fecc3` contains the passing runtime manifest.
Manifests contain synthetic IDs/results, not credentials. The preliminary
failed harness run is retained as evidence, not counted as a successful run.

## Cleanup and limits

Six generated Auth accounts and six synthetic businesses were removed; seven
uploaded objects were verified absent. Remaining synthetic data was deleted,
while append-only audit history and protected local recovery artifacts remain.
Last-owner protection was restored inside the fixture-cleanup transaction and
verified enabled afterward. No existing customer/business records were deleted
or bulk-encrypted. No retention cleanup policy is left enabled.

The local HTTP backend runs on port 8000 with access logs and lifecycle/scheduled
workers off during validation, so acceptance does not initiate unrelated
customer/provider actions. The existing frontend remains on port 5173. Start
the usual local backend lifecycle when intentionally testing scheduled workers.

This proves isolated development recovery, not a full hosted Supabase-project
disaster restore or an automatic backup of all existing business files. The
envelope coverage remains the explicit map in `security-phases5-7.md`; searchable
demographics/notes and other uncovered fields still rely on authorization,
audit controls and platform encryption. No encrypted-search architecture or
old PIN-based PHI encryption was introduced.

The three provisionally accepted Phase 3–4 items remain separate: interactive
Google OAuth → MFA; invitation receipt/acceptance; historical MFA/IP mismatch
investigation if it reproduces. Native MFA in these tests succeeded.

There is no Phase 5–7 **development** blocker to proceeding with Phase 8.
Deployment-dependent requirements are in `production-launch-checklist.md`.
