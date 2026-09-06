# Nodemere Visitor Intelligence — Final implementation report

Status date: September 6, 2026

The four-phase implementation is complete in the local source tree. Phase 1 is present in the live Supabase project. The Phase 2 and Phase 3 database migrations and the application deployment remain pending because running the Supabase SQL editor requires a separate action-time confirmation. The system must be released in this order: Phase 2 migration, Phase 3 migration, backend with an explicit internal allowlist, then frontend. Do not deploy the Phase 2 collection endpoint before its database function exists.

## 1. Tables created

Thirteen tables are added across the first two phases:

- `public.visitors`, `public.visitor_sessions`, and `public.visitor_events`.
- `visitor_private.event_receipts` and `visitor_private.conversion_claims`.
- `public.homepage_section_hourly`, `public.homepage_section_daily`, `public.homepage_click_hourly`, `public.homepage_click_daily`, `public.homepage_flow_hourly`, and `public.homepage_flow_daily`.
- `visitor_private.homepage_section_hourly_visitors` and `visitor_private.homepage_section_daily_visitors`.

## 2. Tables modified

Phase 2 adds `homepage_deepest_section_id`, `homepage_deepest_section_index`, and `homepage_section_views` to `public.visitor_sessions`. No existing customer, authentication, Calendar, People, business, payment, or call tables are changed.

## 3. Columns created

`visitors` contains identity and consent state, immutable and latest attribution JSON, device JSON, bot/internal flags, session/page/event/engagement totals, account linkage, signup snapshots, and paid-conversion state. `visitor_sessions` contains boundaries, entry/exit paths, attribution and device snapshots, counts, elapsed and engaged time, scroll depth, and homepage depth. `visitor_events` contains an event ID, visitor/session/user links, allowlisted event name, timestamps, public path, bounded metadata, and an optional unique server conversion key.

The homepage section rollups contain reach, views, visible-time histograms, clicks, CTA clicks, continuations, and drop-offs. Click rollups contain section and element identity, device/viewport buckets, 20×20 normalized cells, and counts. Flow rollups contain ordered section transitions. Private claim rows provide exact hourly/daily section uniqueness without exposing visitor-level data.

## 4. Indexes created

Eighteen explicit indexes support visitor/user lookup, recent visitors, visitor sessions, retention, event/session lookup, signup uniqueness, receipt/session lookup, six recent homepage rollups, and three Phase 3 command-center ranges. Primary keys and unique constraints add their own indexes.

## 5. RLS and grants

All thirteen visitor and homepage tables have RLS enabled and forced. There are intentionally no `anon` or `authenticated` read policies. Table privileges are revoked from `PUBLIC`, `anon`, and `authenticated`; only `service_role` receives table access. Private helper and public RPC execution is also revoked from browser roles and granted only to `service_role`. SQL tests switch into browser roles and prove that reads and function execution fail.

## 6. APIs created

Public write-only collection:

- `POST /api/public/visitor/collect`
- `POST /api/public/visitor/identity`
- `POST /api/public/visitor/revoke`

Internal read-only command center:

- `GET /api/visitor-intelligence/access`
- `GET /api/visitor-intelligence/command-center`
- `GET /api/visitor-intelligence/visitors`
- `GET /api/visitor-intelligence/visitors/{visitor_id}`
- `GET /api/visitor-intelligence/activity`

The internal interface does not render until `/access` succeeds. Production access requires the authenticated user ID or email in `VISITOR_INTELLIGENCE_ADMIN_USER_IDS` or `VISITOR_INTELLIGENCE_ADMIN_EMAILS`. Customer business roles never grant visitor-intelligence access.

## 7. Visitor ID strategy

After explicit analytics consent, the browser creates a first-party UUID and obtains a server-signed capability. The UUID and capability are stored locally; the per-tab session is stored in session storage. A valid signed capability is required to reuse an existing visitor ID. Clearing storage creates a new privacy partition rather than reconstructing the old identity.

## 8. Fingerprinting strategy

The server creates a 64-character HMAC-SHA256 fingerprint from the visitor UUID partition and broad browser, operating-system, device-category, touch, and coarsened screen signals. It does not use raw IP, raw user-agent storage, hardware concurrency, device memory, canvas, audio, WebGL, font enumeration, or a third-party identity service. The fingerprint is a diagnostic consistency signal and cannot recover an identity after storage is cleared.

## 9. Identity confidence

An authenticated account or valid signed persistent visitor ID is confidence 100. A new visitor is confidence 0. The supporting device fingerprint is capped at 60 and never merges records. This intentionally accepts occasional duplicates to prevent false merges.

## 10. Session logic

Sessions use a 30-minute inactivity convention. Refresh reuses the tab session; inactivity creates a new session. Visible elapsed time, focused engagement, entry/exit pages, attribution, device snapshot, page/event counts, scroll maxima, and deepest homepage section are maintained independently. Event receipts make retries idempotent.

## 11. Events tracked

Client events are `session_start`, `session_end`, `page_view`, `page_leave`, `engagement`, `cta_click`, `navigation_click`, `homepage_click`, `section_view`, `section_attention`, `section_progression`, `scroll_25`, `scroll_50`, `scroll_75`, `scroll_90`, `scroll_100`, `form_started`, `field_focused`, `form_completed`, `signup_started`, and `checkout_started`. Trusted server paths add verified login, signup-completion, and paid-subscription events.

## 12. Attribution

First-touch landing path, safe referring origin, and UTM source/medium/campaign/term/content are preserved. A new session updates latest-touch attribution. Internal navigation does not rewrite a session's landing attribution. URLs are reduced to an allowlisted public path, referrers to an origin, and UTM values to bounded safe slugs.

## 13. Homepage engagement methodology

The actual homepage sections are Hero, Calendar, People & CRM, Live Monitoring, Comparison, Scenarios, and Security. A section view requires at least one continuous second and at least half of the smaller viewport/section area. Visible time ends when the page becomes hidden, blurred, idle, or leaves the section. Section attention records the deepest section and whether the visitor continued.

## 14. Heatmap methodology

The command center renders a controlled miniature of Nodemere's homepage. It overlays section aggregates and element-aware click clusters. Click coordinates are normalized within each section and partitioned by device and viewport class. PostgreSQL performs bounded aggregation; browsers receive aggregates rather than raw event payloads.

## 15. Attention Mode

Attention uses reach, visible time, continuation, and repeat views to calculate a deterministic 0–100 score and the restrained Nodemere states Hot, Warm, Cool, or Dormant. Empty and small datasets remain visibly dormant.

## 16. Click Mode

Click clusters encode volume. CTA clusters use a distinct treatment. A selected cluster reports element, section, total and unique clicks, click-through rate against section reach, CTA clicks, converted visitors, and visitor-level conversion rate.

## 17. Scroll Mode

The collector records 25%, 50%, 75%, 90%, and 100% milestones plus session maxima and deepest meaningful section. The surface dims low-reach sections and draws a section reach line so the stopping point remains visible.

## 18. Drop-off Mode

Drop-off uses final section-attention records and continuation state. Sections dim as drop-off increases and show the measured lost-visitor count. The section drill-down reports reach, continuation, and drop-off together.

## 19. Insight Rail

Insights are deterministic, not generated prose. They require at least five relevant visitors and fixed thresholds before identifying strong attention, major drop-off, acquisition concentration, or a new-versus-returning engagement gap. The rail stays empty rather than making a claim from insufficient data.

## 20. Comparison

The command center provides one stable new-versus-returning comparison with visitors, sessions, average engaged time, average scroll depth, and converted visitors. It updates with the selected period and segment filters.

## 21. Flow Mode

Section-progression events and hourly/daily flow rollups are complete and returned by the command-center API. A dedicated visual Flow mode is not included in this release; no interface claims that it exists.

## 22. Visitor Pulse

`Visitor Pulse` polls a bounded recent-activity endpoint every 15 seconds. Event IDs are deduplicated and ordered, so polling does not replay rows. Selecting a pulse entry opens that visitor profile.

## 23. Conversion and account linking

An independently authenticated Supabase session links the consenting anonymous visitor to the account without deleting earlier history. A conflicting user gets a rotated visitor identity. Account creation time separates signup from a later login. Paid conversion is recorded only after a signature-verified live Stripe subscription payment with a positive amount. One user may retain multiple device visitor IDs.

## 24. Cost and performance

The client batches at most 40 events and 30 KB, flushes on a 30-second cadence and lifecycle boundaries, caps queues, and never records cursor trails or DOM replay. Homepage section/click/flow tables maintain hourly and daily rollups. Command-center responses are bounded and visitor rows are paginated. The collector and `/visitors` page are lazy-loaded. Raw-event retention is bounded at 90 days and inactive sessions at 365 days when the maintenance RPC is scheduled.

## 25. Consent behavior

Analytics defaults off and the analytics module is not imported until valid consent and an eligible production host exist. Necessary storage remains available. GPC and Do Not Track force analytics off. Consent synchronizes across tabs, expires after 366 days or a version change, and fails closed when browser storage is unavailable. Withdrawal stops collection, clears browser analytics state, and attempts signed server revocation.

## 26. Cookie banner

The banner now provides **Accept All**, **Reject Non-Essential**, and **Manage Preferences**. It explains Necessary and Analytics / performance categories, persists the choice, supports later changes from the fixed Cookie preferences control and legal footer, restores keyboard focus, and disables optional analytics under a browser privacy signal.

## 27. Privacy Policy

The Policy now lists the optional visitor identifiers, browser/device/OS/screen characteristics, attribution, page/session/engagement/scroll/section/click and conversion data; explains account linkage and its pseudonymous rather than necessarily anonymous status; states the purposes; distinguishes infrastructure IP processing from visitor analytics storage; states current visitor-analytics noncollection; and describes retention.

## 28. Terms of Service

The Terms contain a concise public-site analytics provision and point to the Privacy Policy and Cookie Notice for the primary disclosure and controls. The legal effective date and frontend/backend acceptance version are synchronized to September 5, 2026.

## 29. Security

Strict Pydantic and PostgreSQL allowlists reject extra keys, unknown names, invalid timestamps, oversized batches, bad sections, unsafe URLs, duplicate JSON keys, and malformed capabilities. Sensitive routes and URL parameters are excluded. The public API exposes writes only. Internal reads require Supabase authentication and a separate server allowlist. Responses are `private, no-store`. Database and API failures return fixed codes without payloads or credentials.

## 30. Bot and internal traffic

Known crawler, bot, headless, health-check, uptime, monitoring, and Lighthouse user agents are flagged server-side without storing the raw user-agent string. Localhost, preview hosts, and arbitrary origins are off by default. Homepage and command-center aggregates exclude bot, internal, and revoked visitors.

## 31. Tests performed

- All 37 frontend contract tests pass. They cover missing, accepted, rejected, changed, expired and privacy-signal consent; blocked storage; returning identity; refresh and multi-session boundaries; desktop/tablet/mobile; direct/referrer/UTM attribution; partial homepage behavior; click and attention; hidden and idle tabs; close/unload; account linking; logout and cross-account rotation; queue volume; and absence of sensitive values.
- All 39 backend tests pass. They cover strict schemas, origin and local rules, bot/internal handling, signed capabilities, rate limiting, malformed and oversized bodies, account conflicts, subscription verification, internal allowlists, bounded command-center reads, and no public visitor GET routes.
- The Phase 1, Phase 2, and Phase 3 PostgreSQL verification scripts pass against a disposable local PostgreSQL 17 database. They cover first/latest attribution, idempotency, sessions, conversions, retention, rollups, real/empty analytics, click-through and conversion calculations, visitor lists/profiles/pulse, forced RLS, revoked grants, and browser-role denial.
- Command-center source checks cover the four visual modes, filters, section-to-table connection, comparison, pulse, full table columns, profile timeline, empty states, unavailable geography, and authorization-before-render.
- Production build validates the lazy bundles. Visual QA is performed at desktop, tablet, and mobile widths against a deterministic local fixture before release.

## 32. Known limitations

- Phase 2 and Phase 3 are not yet applied to the live Supabase project, and the backend/frontend changes are not deployed.
- Production must configure at least one internal user ID or email allowlist entry before `/visitors` can open.
- Location, ASN, ISP, and persistent IP analytics are intentionally unavailable. The interface says so rather than estimating them.
- Flow data is available, but a dedicated Flow visualization is deferred.
- The service-wide rate limiter is process-local; multiple production workers should also use an edge or shared limiter.
- Retention is implemented as a bounded RPC but still needs a production schedule.
- Revocation is best effort when the browser is offline; collection stops and browser analytics storage clears immediately.

## 33. Recommended improvements

Schedule the retention RPC and monitor its results; add a shared edge rate limit before material traffic; track aggregate payload/event rates and API latency; add automated authenticated browser regression coverage once a dedicated internal test account and deployed allowlist exist; consider a restrained Flow visualization after enough real progression data exists; and consider coarse geography only after a separate necessity, provider, consent, retention, and legal review. Have counsel review the final public legal language before launch.
