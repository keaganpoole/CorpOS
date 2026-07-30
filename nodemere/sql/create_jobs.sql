create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null,
  user_id uuid null,
  business_id bigint null,
  type text not null,
  status text not null default 'active',
  schedule_config jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  next_run_at timestamp with time zone null,
  last_run_at timestamp with time zone null,
  locked_at timestamp with time zone null,
  locked_by text null,
  attempt_count integer not null default 0,
  last_error text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists jobs_scenario_type_unique_idx
  on public.jobs (scenario_id, type);

create index if not exists jobs_due_idx
  on public.jobs (status, type, next_run_at)
  where status in ('active', 'failed');

create index if not exists jobs_user_id_idx
  on public.jobs (user_id);

create index if not exists jobs_business_id_idx
  on public.jobs (business_id);

create or replace function public.claim_due_scenario_jobs(
  worker_id text,
  batch_size integer default 10
)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due_jobs as (
    select id
    from public.jobs
    where type = 'scenario_schedule'
      and status in ('active', 'failed')
      and next_run_at is not null
      and next_run_at <= now()
      and (
        locked_at is null
        or locked_at < now() - interval '10 minutes'
      )
    order by next_run_at asc
    limit greatest(1, least(coalesce(batch_size, 10), 50))
    for update skip locked
  )
  update public.jobs j
  set
    status = 'running',
    locked_at = now(),
    locked_by = worker_id,
    attempt_count = j.attempt_count + 1,
    updated_at = now()
  from due_jobs
  where j.id = due_jobs.id
  returning j.*;
end;
$$;
