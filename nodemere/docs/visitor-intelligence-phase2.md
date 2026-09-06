# Visitor Intelligence — Phase 2

Phase 2 adds homepage behavior collection and precomputed intelligence. It does not add the `/visitors` interface, homepage visualization modes, visitor profiles or any other Phase 3 UI.

## Homepage map

The collector uses the homepage’s real top-level order rather than an example funnel:

| Index | Stable section ID | Homepage content |
| ---: | --- | --- |
| 0 | `hero` | Front-desk/receptionist hero sequence |
| 1 | `calendar` | Calendar and call booking |
| 2 | `people-crm` | People CRM |
| 3 | `live-monitoring` | Live call monitoring |
| 4 | `comparison` | Work-week comparison |
| 5 | `scenarios` | Outbound workflow scenarios |
| 6 | `security` | AES-256-GCM security |

The fixed header is tagged as `header` for click clustering only. It is excluded from the section funnel.

## Browser collection

`src/lib/homepageIntelligence.js` uses `IntersectionObserver` plus a low-frequency qualification check. A section must continuously cover at least 50% of the smaller of the viewport or section for at least one second before it counts as reached. A few pixels or multiple short glimpses do not accumulate into a view.

For each qualified section, the browser records one section view and the visible duration accumulated while the document is visible and focused. On homepage exit it records the deepest qualified section and whether each reached section continued to a later section. Meaningful changes between qualified sections produce one directed flow edge per page view. Continuous pointer movement, DOM text, form values, keystrokes, canvas, audio and replay data are never collected.

Every homepage click inside a mapped section is represented by:

- stable section ID and index;
- explicit element ID when present, otherwise a section-local interactive ordinal or `section-surface`;
- element type;
- x/y coordinates normalized to the section bounds;
- device class and viewport dimensions.

Coordinates are aggregated separately by device class and viewport bucket, so mobile, tablet and desktop layouts are not combined into one incompatible heatmap. URL query strings and fragments are removed by the existing metadata policy before an event can enter the outbox.

## Aggregation

Migration: `sql/2026_09_05_visitor_intelligence_phase2.sql`, applied after Phase 1.

| Object | Purpose |
| --- | --- |
| `homepage_section_hourly` / `homepage_section_daily` | Reach, views, visible duration, duration histogram, clicks, CTA clicks, continuations and drop-offs by section and device. |
| `homepage_click_hourly` / `homepage_click_daily` | 20×20 section-relative click cells by element, device and viewport bucket. |
| `homepage_flow_hourly` / `homepage_flow_daily` | Directed section progression counts. |
| `visitor_private.homepage_section_*_visitors` | Small deduplication claims used to maintain exact hourly and daily unique reach. |
| `visitor_private.homepage_section_daily_metrics` | Precomputed-facing metrics for reach, average duration, histogram median, engagement, continuation, drop-off and major-drop flags. |

The median is calculated from a bounded duration histogram, avoiding unbounded arrays or scans of raw events. Engagement is a 0–100 score composed of 45% attention (average visible time capped at 30 seconds), 30% interaction (clicks per view capped at one) and 25% continuation. A section is flagged as a major drop point at 25% drop-off, or at 15% with at least ten observed losses.

The wrapper RPC preserves Phase 1’s atomic identity/session/event deduplication, then updates the new rollups only for newly accepted events. Retries with the same event IDs cannot increment any rollup twice. Bots and internal traffic remain in the Phase 1 diagnostic stream but are excluded from homepage rollups.

## Security and rollout

All six public rollup tables and both private claim tables have enabled and forced RLS. `PUBLIC`, `anon` and `authenticated` have no table access, no view access and no execution permission on the Phase 2 ingestion function. Only `service_role` can ingest or read the private metrics view. No browser analytics read endpoint is introduced.

Deploy the database migration before the updated backend because collection now calls `visitor_ingest_phase2`. The homepage collector remains consent-gated, production-origin limited and disabled in local development unless both explicit local QA flags are enabled.

`sql/tests/visitor_intelligence_phase2.sql` runs in a transaction and rolls back all fixtures. It covers reach deduplication, views, attention, median/average inputs, engagement, continuation/drop-off, major-drop detection, heatmap cells, viewport partitioning, flow, retry idempotency, bot exclusion, RLS and client-role denial.
