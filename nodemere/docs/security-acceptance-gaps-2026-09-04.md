# Remaining Phase 3–4 acceptance checks

This pass did not reapply migrations or repeat the completed tenant/RLS matrix.
Phases 5–7 were not started. Full acceptance remains incomplete.

## Post-MFA 401 investigation

Read the live Supabase logs for September 3, 20:58–21:01 America/New_York
(September 4, 00:58–01:01 UTC), covering the earlier intermittent run.
The Auth warning filter returned three HTTP 422 events, no HTTP 401 events;
Auth showed no 5xx events, and the API Gateway 5xx filter returned no events.
The 20:59:27 factor-verification event recorded `mfa_ip_address_mismatch`:
challenge and verification originated from different IP addresses. That is
a separate native verification rejection, not proof of the cause of the two
subsequent backend 401s. Do not disable Supabase's IP binding.

Confirmed an application defect in `backend/dependencies.py`: its broad
exception handler returned "Invalid or expired authentication token" for
transport errors, Auth rate limits, malformed provider responses, and failed
profile/database lookups, even after successful identity verification.
Fault-injection tests reproduced these misleading 401s before the fix.

The narrow fix preserves 401 for explicit native Auth credential rejections
and 403 for closed accounts; dependency failures now deny access with 503.
Fixed operational stage codes survive the existing privacy filter and retain
its correlation ID. No credentials, emails, provider error bodies, or stack
traces were added to logs. This is diagnostic logging, not Phase 5 audit logging.
The Phase 1 rejection mock now uses the native AuthApiError type rather than
representing an authentication rejection as a generic ValueError.

Verification: **22/22 targeted offline tests pass**, plus compilation of all
three affected Python implementation/test files. The selected suites were
`test_auth_failure_classification`, Phase 1 `UserAuthTests`, and Phase 4
`PrivacyTests`; unrelated passing suites were not repeated.

A fresh temporary native Supabase identity enrolled and verified TOTP, received
AAL2, and made **8/8 immediate successful HTTP requests** to the local workforce
session endpoint. It had no business membership and received no tenant access.
Both its Auth user and profile were deleted; Auth GET returned 404 and profile
read returned no rows. A native invalid-token request also confirmed the SDK's
actual AuthApiError is recognized by the new rejection handler.

The original underlying exception was not captured in the earlier run and
cannot be reconstructed conclusively from the available records. Therefore
the historical root-cause acceptance item remains open despite fixing the
confirmed misclassification defect and not reproducing the failure.

## Stripe sandbox

Used only a validated `sk_test_`/`rk_test_` credential and the existing connected
test account. Native Stripe checks passed:

- Connected sandbox account accessible and charges enabled.
- One USD 1.00 synthetic test-card PaymentIntent succeeded, `livemode=false`.
- Full sandbox refund succeeded.
- Hosted payment Checkout session creation succeeded, `livemode=false`.
- Stripe returned the corresponding native `payment_intent.succeeded` event.

Run marker: `nodemere-security-provider-a87299a6cefa`.
PaymentIntent: `pi_3UBo1aGxEy1HJZXg1y0C4raU`.
Refund: `re_3UBo1aGxEy1HJZXg14vAKO5C`.
The unused Checkout was expired and temporary Customer deleted. Stripe retains
its test payment/refund history; no real funds were charged and no real customer
was edited. No database billing records were created by these provider checks.

These are **provider-only** checks, not evidence of completed Nodemere Checkout,
subscription changes, or native webhook delivery into Nodemere. Current local
`TEST_MODE=true` / `STRIPE_REAL_TEST_MODE=true` still makes application payment
actions simulate; those safety switches were not changed. The already-passing
application simulation was not repeated.

## Interactive/provider blockers

- Existing browser sessions are already signed in on localhost and 127.0.0.1.
  Neither represents a fresh Google OAuth round trip. Google login and MFA
  enrollment on a controlled account still require user participation; no
  existing account factors/passwords were changed. The workforce security UI
  correctly showed authenticator setup and disabled invitations before step-up.
- The configured Gmail refresh credential works and has `gmail.send` scope,
  not inbox-read scope. No invitation was sent without an isolated recipient/
  membership workflow. Actual receipt and browser acceptance remain unverified.
- Twilio and ElevenLabs APIs are reachable. The configured agents' 24 referenced
  development tools point to the existing ngrok development origin and include
  internal-secret and signed-context headers. Header presence alone does not
  prove a successful call. There was no running tunnel at preflight and no
  controlled call recipient was supplied. No call or provider setting change
  was made.
- A real application Stripe checkout/webhook round trip remains outstanding,
  separate from the native sandbox operations above.

Temporary local backend execution used `--lifespan off` to avoid starting
scheduled business actions during diagnostics. No deployment, persistent
environment change, migration, vendor-plan change, or unrelated refactor occurred.

## Acceptance decision

Phase 3: FAIL (acceptance incomplete).
Phase 4: FAIL (acceptance incomplete).
Prior Phase 1–2 passing evidence was preserved, not rerun wholesale.
Do not sign off Phases 1–4 or start Phases 5–7 until the remaining interactive
and provider checks are closed and the historical authentication gap is resolved
or explicitly accepted as an evidence limitation.
