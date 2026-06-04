alter table public.hired_receptionists
add column if not exists total_calls integer not null default 0,
add column if not exists inbound_calls_count integer not null default 0,
add column if not exists outbound_calls_count integer not null default 0,
add column if not exists completed_calls_count integer not null default 0,
add column if not exists failed_calls_count integer not null default 0,
add column if not exists missed_calls_count integer not null default 0,
add column if not exists average_call_duration_seconds numeric null,
add column if not exists last_call_at timestamptz null;

with receptionist_metrics as (
  select
    cl.hired_receptionist_id,
    count(*)::integer as total_calls,
    count(*) filter (
      where lower(
        coalesce(
          cl.raw_payload->>'direction',
          cl.raw_payload->'metadata'->>'direction',
          cl.raw_payload->'metadata'->'phone_call'->>'direction',
          cl.raw_payload->'conversation_initiation_client_data'->'dynamic_variables'->>'direction',
          cl.raw_payload->'conversation_initiation_client_data'->'dynamic_variables'->>'call_direction'
        )
      ) = 'inbound'
    )::integer as inbound_calls_count,
    count(*) filter (
      where lower(
        coalesce(
          cl.raw_payload->>'direction',
          cl.raw_payload->'metadata'->>'direction',
          cl.raw_payload->'metadata'->'phone_call'->>'direction',
          cl.raw_payload->'conversation_initiation_client_data'->'dynamic_variables'->>'direction',
          cl.raw_payload->'conversation_initiation_client_data'->'dynamic_variables'->>'call_direction'
        )
      ) in ('outbound', 'outgoing')
    )::integer as outbound_calls_count,
    count(*) filter (
      where lower(coalesce(cl.status, '')) in ('completed', 'done', 'success')
        or lower(coalesce(cl.call_successful, '')) in ('true', 'yes')
        or lower(coalesce(cl.outcome, '')) in ('completed', 'done', 'success')
    )::integer as completed_calls_count,
    count(*) filter (
      where lower(coalesce(cl.status, '')) in ('failed', 'error', 'canceled')
        or lower(coalesce(cl.outcome, '')) in ('failed', 'error', 'canceled')
        or coalesce(cl.failure_reason, '') <> ''
    )::integer as failed_calls_count,
    count(*) filter (
      where lower(coalesce(cl.status, '')) in ('missed', 'no-answer', 'no_answer', 'busy')
        or lower(coalesce(cl.outcome, '')) in ('missed', 'no-answer', 'no_answer', 'busy')
    )::integer as missed_calls_count,
    avg(cl.duration_seconds)::numeric as average_call_duration_seconds,
    max(cl.created_at) as last_call_at
  from public.call_logs cl
  where cl.hired_receptionist_id is not null
  group by cl.hired_receptionist_id
)
update public.hired_receptionists hr
set
  total_calls = rm.total_calls,
  inbound_calls_count = rm.inbound_calls_count,
  outbound_calls_count = rm.outbound_calls_count,
  completed_calls_count = rm.completed_calls_count,
  failed_calls_count = rm.failed_calls_count,
  missed_calls_count = rm.missed_calls_count,
  average_call_duration_seconds = rm.average_call_duration_seconds,
  last_call_at = rm.last_call_at
from receptionist_metrics rm
where hr.id = rm.hired_receptionist_id;
