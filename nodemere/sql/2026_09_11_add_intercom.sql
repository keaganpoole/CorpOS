create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.intercom (
  id uuid primary key default gen_random_uuid(),
  business_id bigint not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hired_receptionist_id bigint references public.hired_receptionists(id) on delete set null,
  elevenlabs_agent_id text,
  elevenlabs_conversation_id text unique,
  receptionist_name text,
  receptionist_avatar text,
  receptionist_banner_url text,
  title text,
  summary text,
  search_text text not null default '',
  transcript jsonb not null default '[]'::jsonb,
  usage jsonb not null default '{}'::jsonb,
  tool_calls jsonb not null default '[]'::jsonb,
  write_actions jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  turn_count integer not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.intercom add column if not exists search_text text not null default '';

update public.intercom
set search_text = concat_ws(
  ' ',
  title,
  summary,
  receptionist_name,
  transcript::text
)
where search_text = '';

create index if not exists idx_intercom_business_created
  on public.intercom (business_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_intercom_user_created
  on public.intercom (user_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_intercom_search_text
  on public.intercom using gin (search_text gin_trgm_ops)
  where deleted_at is null;

create table if not exists public.intercom_usage_daily (
  id uuid primary key default gen_random_uuid(),
  business_id bigint not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  plan_slug text not null default 'free',
  turns_used integer not null default 0,
  limit_turns integer not null default 10,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id, usage_date)
);

create or replace function public.nodemere_claim_intercom_turn(
  target_business_id bigint,
  target_user_id uuid,
  target_plan_slug text,
  target_limit_turns integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  usage_row public.intercom_usage_daily%rowtype;
begin
  insert into public.intercom_usage_daily (
    business_id,
    user_id,
    usage_date,
    plan_slug,
    turns_used,
    limit_turns
  ) values (
    target_business_id,
    target_user_id,
    current_date,
    target_plan_slug,
    0,
    greatest(target_limit_turns, 0)
  )
  on conflict (business_id, user_id, usage_date) do update
    set plan_slug = excluded.plan_slug,
        limit_turns = excluded.limit_turns,
        updated_at = now()
  returning * into usage_row;

  if usage_row.turns_used >= usage_row.limit_turns then
    raise exception 'intercom_limit_reached' using errcode = 'P0001';
  end if;

  update public.intercom_usage_daily
    set turns_used = turns_used + 1,
        updated_at = now()
    where id = usage_row.id
    returning * into usage_row;

  return jsonb_build_object(
    'id', usage_row.id,
    'turns_used', usage_row.turns_used,
    'limit_turns', usage_row.limit_turns,
    'plan_slug', usage_row.plan_slug,
    'usage_date', usage_row.usage_date
  );
end;
$$;

revoke all on function public.nodemere_claim_intercom_turn(bigint, uuid, text, integer) from public;
revoke all on function public.nodemere_claim_intercom_turn(bigint, uuid, text, integer) from anon;
revoke all on function public.nodemere_claim_intercom_turn(bigint, uuid, text, integer) from authenticated;
grant execute on function public.nodemere_claim_intercom_turn(bigint, uuid, text, integer) to service_role;

alter table public.intercom enable row level security;
alter table public.intercom_usage_daily enable row level security;

drop policy if exists "Users can read their Intercom conversations" on public.intercom;
create policy "Users can read their Intercom conversations"
  on public.intercom
  for select
  to authenticated
  using (user_id = auth.uid() and deleted_at is null);

drop policy if exists "Users can read their Intercom usage" on public.intercom_usage_daily;
create policy "Users can read their Intercom usage"
  on public.intercom_usage_daily
  for select
  to authenticated
  using (user_id = auth.uid());
