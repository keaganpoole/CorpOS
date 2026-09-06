# Phase 1 schema catalog

Public columns verified against the live Supabase API schema after applying the migration. No existing table columns were changed.

## public.visitors

| Column | Type |
| --- | --- |
| `id` | `uuid` |
| `user_id` | `uuid` |
| `account_linked_at` | `timestamp with time zone` |
| `first_seen_at` | `timestamp with time zone` |
| `last_seen_at` | `timestamp with time zone` |
| `last_received_at` | `timestamp with time zone` |
| `current_session_id` | `uuid` |
| `fingerprint` | `text` |
| `fingerprint_version` | `integer` |
| `fingerprint_updated_at` | `timestamp with time zone` |
| `fingerprint_confidence` | `numeric` |
| `identity_match_method` | `text` |
| `identity_confidence` | `numeric` |
| `consent_version` | `text` |
| `consent_updated_at` | `timestamp with time zone` |
| `revoked_at` | `timestamp with time zone` |
| `first_attribution` | `jsonb` |
| `latest_attribution` | `jsonb` |
| `device_profile` | `jsonb` |
| `is_bot` | `boolean` |
| `is_internal` | `boolean` |
| `total_visits` | `bigint` |
| `total_pageviews` | `bigint` |
| `total_events` | `bigint` |
| `total_duration_seconds` | `numeric` |
| `total_engaged_seconds` | `numeric` |
| `homepage_engaged_seconds` | `numeric` |
| `longest_session_seconds` | `numeric` |
| `average_session_seconds` | `numeric` |
| `first_page` | `text` |
| `last_page` | `text` |
| `signed_up_at` | `timestamp with time zone` |
| `time_to_signup_seconds` | `numeric` |
| `signup_snapshot_complete` | `boolean` |
| `visits_before_signup` | `bigint` |
| `pageviews_before_signup` | `bigint` |
| `duration_before_signup` | `numeric` |
| `engaged_before_signup` | `numeric` |
| `subscription_status` | `text` |
| `stripe_subscription_id` | `text` |
| `subscribed_at` | `timestamp with time zone` |

## public.visitor_sessions

| Column | Type |
| --- | --- |
| `id` | `uuid` |
| `visitor_id` | `uuid` |
| `user_id` | `uuid` |
| `started_at` | `timestamp with time zone` |
| `last_seen_at` | `timestamp with time zone` |
| `last_received_at` | `timestamp with time zone` |
| `ended_at` | `timestamp with time zone` |
| `last_engagement_at` | `timestamp with time zone` |
| `entry_page` | `text` |
| `exit_page` | `text` |
| `first_attribution` | `jsonb` |
| `latest_attribution` | `jsonb` |
| `device_profile` | `jsonb` |
| `event_count` | `bigint` |
| `pageview_count` | `bigint` |
| `duration_seconds` | `numeric` |
| `engaged_seconds` | `numeric` |
| `homepage_engaged_seconds` | `numeric` |
| `max_scroll_depth` | `numeric` |
| `homepage_scroll_depth` | `numeric` |

## public.visitor_events

| Column | Type |
| --- | --- |
| `id` | `uuid` |
| `visitor_id` | `uuid` |
| `session_id` | `uuid` |
| `user_id` | `uuid` |
| `event_name` | `text` |
| `occurred_at` | `timestamp with time zone` |
| `received_at` | `timestamp with time zone` |
| `page` | `text` |
| `metadata` | `jsonb` |
| `conversion_key` | `text` |

## Private supporting tables

- `visitor_private.event_receipts`: `id`, `visitor_id`, `session_id`, `received_at`.
- `visitor_private.conversion_claims`: `conversion_key`, `user_id`, `visitor_id`, `event_id`, `occurred_at`.

## Explicit indexes

- `visitors_user_idx`
- `visitors_last_seen_idx`
- `visitor_sessions_visitor_idx`
- `visitor_sessions_retention_idx`
- `visitor_events_visitor_idx`
- `visitor_events_session_idx`
- `visitor_events_retention_idx`
- `visitor_signup_once` (unique)
- `visitor_receipts_session_idx`

Primary keys, unique constraints, and the globally unique conversion key also create indexes.

All five new tables have enabled and forced RLS. No client policies or table grants are present. Only the service role can call the five new RPCs.
