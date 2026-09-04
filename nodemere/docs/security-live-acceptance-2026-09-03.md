# Live security acceptance — 2026-09-03

## Sign-off

| Phase | Acceptance status | Meaning |
|---|---|---|
| 1 | PASS | Remaining native authenticated owner/non-owner payment isolation verified; existing security regressions pass. |
| 2 | PASS | Tested tenant boundaries, direct database restrictions, scenario hydration/execution and Realtime isolation pass. This is not a claim of exhaustive penetration testing. |
| 3 | FAIL — acceptance incomplete | Native roles/TOTP pass, but real Google OAuth plus MFA/browser completion and invitation delivery remain unverified. Intermittent post-MFA API 401s occurred in one repeat run and have no confirmed cause. |
| 4 | FAIL — acceptance incomplete | Automated privacy and live private-file controls pass; complete external-provider call/reporting and browser end-to-end acceptance remain outstanding. |

FAIL here distinguishes incomplete sign-off from a confirmed authorization bypass.
Do not start Phases 5–7 on the assumption that all acceptance gates are closed.

## Scope and safety

- Project: `grpgmhhtmfiwukncucaq`.
- Local current FastAPI application through TestClient, using real Supabase Auth JWTs, live PostgREST/RLS, private Storage and native Realtime websockets. No auth, authorization or database mocks in these live checks.
- Existing migrations and `verify_phases2_4.sql` were not reapplied or rerun. The user's passing catalog results were retained as existing evidence.
- Four explicitly labeled synthetic Auth accounts; synthetic businesses, customer records, appointments, inactive scenario definitions, payments, a text document and a tiny silent WAV. No real customer records were used or altered.
- Invitation delivery alone was suppressed for synthetic `example.com` mailboxes. Actual invitation API/database/RPC behavior was exercised.
- Billing simulation remained enabled. No global billing configuration, real account MFA, provider settings, deployment or application source was changed.
- No live charges, calls or emails were sent. Phases 5–8 were not started.

## Results and exact counts

- Backend regression: **130 passed, 0 failed**.
- Frontend/security Node tests: **21 passed, 0 failed**.
- Build: **passed**, 3,165 modules. Existing CSS import-order, Browserslist and bundle-size warnings remain.
- Python compilation: **33 files passed**. `git diff --check` passed; existing line-ending warnings remain.
- Latest full live run: **96 passed, 1 failed** across 97 assertions. Its single failure was missing permitted Staff Realtime delivery within the test window.
- Focused Realtime retest: **15 passed, 0 failed**. Both independent subscription rounds checked successful binding registration AND the server's `system` / `postgres_changes` ready event before writing the fixture. Both delivered to Owner/Staff and excluded Business B. The original harness waited only for `phx_reply`, so that failure is consistent with subscription-readiness timing; no product workaround or RLS weakening was applied.
- Correct native onboarding was separately verified for both new businesses: **2/2 passed**, with initial Owner memberships verified afterward.
- These counts overlap; do not sum them as unique end-to-end scenarios. The final runner includes the readiness check and safer failed-fixture handling; the entire live run was not repeated again after that harness-only adjustment.

Earlier setup failures were a missing required schedule in the test onboarding payload and a requests/httpx response-interface mismatch in the harness. Both were corrected; they were not product vulnerabilities.
An intermediate repeat had **82 passed / 13 failed**: two unexpected post-MFA 401 responses prevented Manager invitation creation, and subsequent Manager-dependent checks consequently failed. The final full run passed these checks without an application change. Diagnostic observation added around the Auth SDK did not reproduce an exception in that final run. The earlier transient cause remains unconfirmed, not fixed by inference.

## Live checks completed

### Phase 1

- Native Owner A and Owner B tokens each retrieved only their own synthetic payment when querying both payment IDs together.
- Anonymous payment reads denied.
- Internal tool without its secret rejected while billing test mode was active.
- Authorized simulated Stripe connection succeeded.
- Authorized simulated payment creation returned `simulated=true`, `charged=false` and succeeded in the live database.

### Phase 2

- Direct cross-business people, appointments, staff and service reads isolated.
- Cross-business appointment person/staff/service/business changes denied.
- Nested forged business IDs rejected at the API boundary for workforce roles.
- Direct integrations, workflow executions, requests and document table access denied.
- Privileged invitation RPC denied to authenticated direct clients.
- Other-business scenario changes and nested foreign-person hydration rejected.
- Authorized scenario builder hydration and no-action execution returned both `success=true` and `completed=true`, not merely HTTP 200.
- Staff appointment creation through the application succeeded; receptionist and scenario list routes remained available to intended roles.
- Native Realtime delivered only the authorized business's synthetic change after subscription readiness.

### Phase 3

- New business creation through real onboarding created an Owner.
- Owner-created Manager/Staff invitations preserved server-chosen roles; identity/email mismatch, reused, expired and unknown invitations rejected.
- Manager/Staff invitation attempts and direct membership self-promotion denied.
- Owner security access required step-up; real native TOTP enrollment/challenge produced AAL2; invalid verification rejected.
- MFA-required policy on the synthetic business blocked AAL1 API and direct database access; verified users resumed access.
- Native AAL2 refresh, last-Owner protection and explicit ownership transfer in both directions passed.
- Removed Staff membership blocked the old AAL2 JWT through API and direct RLS reads.
- Native factor replacement was enrolled and verified before removing the old factor. Fresh password login required the replacement factor; verification restored access.
- Native logout invalidated the refresh credential.
- Dashboard read-only inspection: native TOTP enabled, maximum 10 factors, AAL1-session duration limit enabled. Auth settings API: Google and email sign-in enabled. No settings changed.

### Phase 4

- Direct raw call payload/transcript and raw invoice payload columns denied.
- Synthetic document uploaded to private storage. Owner/Manager download endpoints succeeded; Staff and other-business requests rejected; public bucket URL denied.
- Silent WAV recording playback authorized for Owner/Manager, denied to Staff/other business; authorized signed URL fetched exactly the uploaded WAV bytes.
- Ordinary call search omitted the transcript canary, storage path and signed recording capability.
- Synthetic clinical description excluded from simulated payment response and stored metadata.
- Offline canary/privacy tests covered sanitized logging/error responses, workflow persistence, webhook duplication, upload controls, NEST/localStorage, frontend console output and URL handling. These are not represented as live browser/provider end-to-end tests.

## Cleanup verified

All generated Auth users, profiles, memberships, businesses and synthetic operational records were removed. Native Auth GET confirmed 404 for all four test users, and profile reads returned no rows. Final SQL counts: **0 remaining test records, 0 remaining test storage objects, 0 test businesses**.

The last-Owner trigger intentionally prevents ordinary deletion of the last test membership. Cleanup therefore used exact fixture IDs plus identity/name assertions in a short atomic transaction: disable only `phase3_last_owner`, delete the test memberships/businesses, restore the trigger, commit. The table's transaction lock prevents concurrent clients from using an unguarded membership table. Lock/statement timeouts were set locally. Post-cleanup catalog verification confirmed `tgenabled='O'`. No policy, function definition or migration was changed; no trigger was left disabled.

The discarded synthetic records are not recoverable through the application. Normal Supabase/provider security history of creating/deleting these test identities may remain; no production history was purged.

## Remaining blockers

1. **Google OAuth + MFA and actual browser gate/recovery UI:** no disposable Google identity/interactive login was available. Enabling Google, using password-based native Auth, or changing provider metadata is not a substitute for testing the real OAuth round trip.
2. **Invitation delivery:** deliberately suppressed for unowned synthetic mailboxes. A controlled receiving mailbox is needed for actual delivery/link/login acceptance.
3. **Intermittent post-MFA 401s:** did not recur on the final full run, but the cause remains unconfirmed. Reproduce with request-correlated, secret-free Auth diagnostics before treating this as resolved.
4. **External provider/browser flows:** controlled Twilio/ElevenLabs call through configured ingress, post-call report/playback and any intended real Stripe sandbox checkout/webhook flow remain unverified. Local Stripe simulation passed; it is not evidence of a real Stripe sandbox transaction. Full browser NEST, preview/playback and OAuth navigation were not end-to-end exercised.

## Artifacts / next step

`backend/live_security_acceptance.py` is an explicit-opt-in live fixture harness, not part of offline test discovery. It creates fresh synthetic identities and prints a cleanup manifest without credentials; guarded business roots still require deliberate SQL cleanup. Do not run it casually against a shared project.

Close the specific identity/provider acceptance gaps and diagnose the transient authentication rejection before giving all four phases an unconditional PASS. Do not reapply passing migrations as a troubleshooting shortcut. No Phases 5–7 implementation was begun.
