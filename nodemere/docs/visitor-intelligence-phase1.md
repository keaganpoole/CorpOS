# Visitor Intelligence — Phase 1

This change implements the identity, consent, collection, attribution and database foundation. Homepage section analysis is now provided by the separate Phase 2 migration and documentation; this file remains the Phase 1 deployment record. It does not describe the Phase 3 `/visitors` command center or the full Phase 4 legal/release review.

## Audit and architecture

Inspected the live Nodemere Supabase schema, `public.users`, its RLS policies and the existing `auth.users` profile trigger. There were no visitor tables. The user ID is a UUID; profile creation already belongs to the existing Auth flow. No existing user records, user columns, authentication triggers, customer permissions or business data are changed by the migration.

Inspected the public router, homepage components, dashboard, Business Intelligence report, authentication, pricing/Checkout flow, backend authorization wrappers, public endpoint exceptions, privacy documents and cookie storage. The old homepage call targeted retired `/track-visitor`; it is removed, and that endpoint remains retired. The old cookie acknowledgement was not analytics consent and is never migrated to an opt-in.

The React application sends consented, bounded batches to FastAPI. FastAPI validates the body and visitor capability; service-only PostgreSQL functions atomically resolve identity/session state, deduplicate events and maintain totals. No browser receives an analytics read endpoint or database permission. Existing business authorization is unchanged.

## Database objects

Migration: `sql/2026_09_05_visitor_intelligence_phase1.sql` (apply once as database owner).

| New table | Purpose |
| --- | --- |
| `public.visitors` | Persistent browser identity, fingerprint/confidence, consent/revocation, account link, immutable original acquisition, latest acquisition, device profile and aggregate/conversion totals. |
| `public.visitor_sessions` | Session boundaries, entry/exit pages, attribution/device snapshot, page/event counts, elapsed/engaged time and scroll maxima. |
| `public.visitor_events` | Individually deduplicated, validated events and server-derived conversions. |
| `visitor_private.event_receipts` | Small event-ID receipts that prevent a retry being counted again after raw-event retention. |
| `visitor_private.conversion_claims` | Durable global signup/subscription reservations, preventing duplicate conversions across devices and retries. |

All five tables have enabled and forced RLS, and grants to PUBLIC, `anon` and `authenticated` are revoked. Only `service_role` is granted access. No customer read policies are created. The private schema is not exposed to client roles. Every new function uses a fixed search path and invoker security, with execution restricted to `service_role`. This follows the separate grants/RLS protections described in the [Supabase documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

The [schema catalog](visitor-intelligence-phase1-schema.md) lists all columns and nine explicit indexes, in addition to indexes created by primary/unique constraints. There are 80 new columns across five tables (41 visitor, 20 session, 10 event, and nine private supporting columns). JSONB holds structured first/latest attribution, device snapshots and allowlisted event metadata; visitor rows never contain raw event histories. Indexed visitor/time, session and retention lookups support the next phase. Unique event IDs and conversion claims enforce idempotency.

## Public APIs and trusted conversions

| Endpoint | Authority and behavior |
| --- | --- |
| `POST /api/public/visitor/collect` | Explicit analytics consent and strict payload validation; returning IDs require their signed capability. Returns only visitor/session capability information and the accepted-event count. |
| `POST /api/public/visitor/identity` | Signed visitor capability plus independently verified Supabase Bearer authentication. Associates the existing anonymous journey with that authenticated account. |
| `POST /api/public/visitor/revoke` | Signed visitor capability. Persists revocation; remains available when production collection is disabled. |

No GET or other analytics read API is introduced. These exact POST routes bypass business-membership bootstrap, then perform their own validation. `/identity` can therefore link a user before onboarding or business creation without granting customer access to analytics.

The signature-verified Stripe webhook invokes a separate helper outside the event loop. A paid conversion requires a positive paid subscription invoice or a paid subscription Checkout event from the live platform account. It resolves the user through the stored Stripe customer ID. Test events, Connect events, free trials, zero-dollar events and browser-supplied completion events cannot create paid conversions. Duplicate notifications are harmless. Optional analytics failure cannot fail billing; a fixed operational warning is emitted instead.

## Identity and account continuity

- A first-party UUID and a server-signed capability persist in local storage only after opt-in. Clearing storage or withdrawing consent does not trigger identity resurrection.
- Fingerprints are 64-character HMAC-SHA256 values over coarse approved device characteristics and a per-browser UUID partition. Fingerprint version, confidence and update time are stored. No canvas, audio, WebGL, hardware probes, raw IP addresses or third-party identity service is used.
- Exact signed persistent ID confidence is 100; a new identity is 0; the supporting device fingerprint is at most 60 and never causes a merge. Raw device similarity cannot join unrelated browsers.
- One account may have multiple visitor identities. A conflicting account receives a separate identity. Logout rotates the browser identity, and cross-tab changes cancel old queues. Previously linked identities cannot be reassigned after account deletion clears their foreign key.
- Original acquisition and the anonymous events remain associated with the visitor. Verified account creation time is used for signup attribution; an account predating the visitor is a login, not a signup. Signup is reserved once per account, and subscription once per subscription ID.
- Wall-clock time to signup is separate from engaged time. If raw retention makes a late signup snapshot incomplete, that state is explicit rather than displaying invented counts.

## Session, event and attribution behavior

The inactivity convention is 30 minutes. Client state survives refresh in session storage; PostgreSQL resolves the effective browser session and prevents retries from creating extra sessions. Page departure alone does not create a fresh session on refresh. Explicit idle session closure and the server timeout create a new session on return.

Tracked public routes: `/`, `/pricing`, `/auth`, `/privacy-policy`, `/terms`, `/acceptable-use-policy`, `/communications-notice`, `/data-processing-addendum`, `/subprocessors` and `/cookie-notice`. Dashboard, onboarding, password reset, token upload/voice routes and unknown/private routes are excluded. Sensitive query/hash entry states are excluded. Stored URLs are allowlisted static paths; referrers are reduced to their origin, and only bounded campaign slugs are retained.

Client events: `session_start`, `session_end`, `page_view`, `page_leave`, `engagement`, `cta_click`, `navigation_click`, `scroll_25`, `scroll_50`, `scroll_75`, `scroll_90`, `scroll_100`, `form_started`, `field_focused`, `form_completed`, `signup_started` and `checkout_started`. Server events add verified login, signup completion and paid subscription creation.

Only explicitly marked elements and hardcoded auth form/field identifiers produce interaction events. Field values, page text, arbitrary keystrokes, authentication credentials, payment information, mouse movements and DOM snapshots are never event metadata. Authentication credentials are used only in the normal authorization header on the identity endpoint.

First-touch landing/referrer/UTM values are immutable. A later session replaces latest-touch attribution, including a direct return with no campaign. Navigating within a session does not replace that session's landing attribution.

Engagement requires a visible, focused page and recent activity; it stops after 60 seconds of inactivity. Client deltas are capped, and PostgreSQL limits them against an engagement watermark and elapsed time. Clicks do not reset that watermark. Homepage engaged time and homepage scroll depth remain separate from other pages. The [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) and [beacon lifecycle guidance](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon) informed the collection lifecycle.

## Consent and notices

Necessary storage remains available. Optional analytics defaults off until an explicit choice. The banner provides accept, reject and preference management with a persistent reopen control. Choices synchronize across tabs and require renewal after 366 days or a consent-version change. GPC and Do Not Track keep analytics off. Blocked browser storage fails closed. The collection module is dynamically loaded only after consent and deployment eligibility checks.

Withdrawal aborts pending work, clears the visitor/session outbox and sends a best-effort signed revocation. No pre-consent events are buffered. An offline browser or blocked revocation request cannot notify the server until communication is possible; the browser still stops collection immediately.

Two existing privacy/cookie paragraphs are minimally updated to describe this foundation accurately. The full Phase 4 document review is deferred. Terms and the legal acceptance version remain unchanged.

## Configuration and operations

| Setting | Default / purpose |
| --- | --- |
| `VITE_VISITOR_TRACKING_ENABLED` | Enabled for production builds; explicit `false` disables the frontend collector. |
| `VITE_VISITOR_ALLOW_LOCAL` | Off. Explicit local testing opt-in only. |
| `VISITOR_TRACKING_ENABLED` | Enabled when `NODEMERE_ENV=production` or on Render, otherwise off; explicit override supported. |
| `VISITOR_ALLOW_LOCAL` | Off. Local-origin collection is excluded unless explicitly enabled. |
| `VISITOR_SIGNING_SECRET` | Optional dedicated secret of at least 32 bytes. Otherwise a domain-separated signing key is derived from the existing server-only service-role key. Never expose it through a `VITE_` variable. |

Normal production origins are the apex and www hosts of `nodemere.ai` and `nodemere.io`. Previews and arbitrary origins are rejected. Local collection is excluded by default, including the user's existing localhost website. Bot/crawler/monitoring user agents are flagged without storing the raw agent string. Internal operators can reject analytics, and authorized service-side maintenance can tag known internal visitor identities; future analytical queries should exclude both bot and internal flags.

The client sends bounded batches on a 30-second cadence and uses a beacon at lifecycle boundaries. Event IDs survive retries. Server bodies are limited to 32 KiB and 40 events, with strict names/types, duplicate-key rejection, timestamp bounds and bounded process-local rate limits. Multiple API workers or substantial traffic should additionally use an edge/global limit; proxy headers are not used as arbitrary identity input.

`visitor_retention(p_limit)` provides bounded service-only removal of raw events older than 90 days and eligible sessions older than 365 days. It is not run by the migration or scheduled automatically. Original acquisition, aggregate totals, revocation and small deduplication/conversion receipts remain. This keeps retention from silently resurrecting a withdrawn identity or recounting old events.

No location/network provider is configured. Country/region/city, ASN/ISP and device vendor/model are not guessed or presented as measured data. Phase 2 adds meaningful homepage section observation and rollups in its own migration; Phase 3 will provide internal presentation and access controls.

## Verification and deployment record

Completed September 5, 2026:

- Applied the reviewed migration to the existing Nodemere Supabase project `grpgmhhtmfiwukncucaq`. The SQL Editor reported success. All three public data tables remained empty: synthetic fixtures were confined to an isolated local PostgreSQL database.
- Verified enabled/forced RLS and absence of anonymous/customer DML grants on all five tables. Actual SELECT attempts as `authenticated` failed on all three public tables. Anonymous REST reads returned permission-denied code `42501`. All five functions deny anonymous/customer execution and allow service-role execution. A malformed service-role ingestion call returned `400 visitor_invalid_payload` without creating data.
- Full PostgreSQL assertion suite passed, covering atomicity, duplicate/replayed events, sessions, first/latest acquisition, visibility-time bounds, account linking, delayed signup chronology, paid conversion timestamp precision, revocation, retention and ACL/RLS behavior. Test fixtures and temporary privilege tests rolled back.
- Nine additional FastAPI-to-real-PostgreSQL integration checks passed: initial collection, signed identity, deduplication, engagement around clicks, verified signup/login, account-switch isolation, second-account linking, disabled-mode revocation, paid-conversion deduplication and forged conversion rejection (related checks grouped into nine assertions).
- 32 backend foundation tests passed, including full payloads generated by the actual JavaScript serializer and device profiles. Existing backend security/auth regression checks also passed (44 tests).
- 35 frontend tracking/privacy/legal tests passed, including consent rejection, browser privacy signals, storage failure, refresh/outbox recovery, all queued batches before linking, 204 handling, cross-tab account changes, device classes and desktop-mode iPad version accuracy.
- Production build passed. The collector is emitted as a separate small lazy chunk; the existing CSS import-order, outdated Browserslist and large main-bundle warnings remain. No production load or latency benchmark was performed.
- In-app browser checks on the existing localhost website verified accept/reject persistence through refresh, preference reopening, necessary/analytics checkbox behavior and desktop/mobile layout. No browser console errors appeared during those checks. Optional analytics was left off.
- Refreshed the existing local backend on port 8000. Its local-origin collection endpoint returned 204 under development exclusion; the GET route remained inaccessible. The shared backend also showed NEST query warnings and intermittent delays during smoke checks, so this is not a claim that unrelated application performance has been validated.

Source changes are local and uncommitted; the production website/backend have not been deployed. No live signup, charge or new customer account was created for testing. The browser UI was checked with development collection excluded; actual collection behavior was exercised with the JavaScript test environment and PostgreSQL-backed API tests. Full homepage visualization, staff analytics access, geographic enrichment, automated retention scheduling, edge/global rate limits and the comprehensive Phase 4 review remain future work.
