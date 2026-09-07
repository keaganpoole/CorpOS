begin;

-- Already used by People CRM and the outbound executor; finish the existing
-- consent-evidence migration without changing its older RLS policies.
alter table public.people
  add column if not exists consent_call_source text,
  add column if not exists consent_call_recorded_at timestamptz,
  add column if not exists consent_call_scope text;

create table if not exists public.drop_ins (
  id uuid primary key default gen_random_uuid(),
  business_id bigint not null references public.businesses(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 64),
  purpose text not null check (length(btrim(purpose)) between 1 and 30),
  prompt text not null,
  available_on_status text not null check (available_on_status in ('pending','confirmed','completed','missed','cancelled')),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  security_revision bigint not null default 0,
  unique (id,business_id)
);
-- All access uses the authorized backend and the existing encryption adapter.
alter table public.drop_ins enable row level security;
revoke all on public.drop_ins from anon,authenticated;
grant select,insert,update,delete on public.drop_ins to service_role;
create index if not exists drop_ins_business_status_order on public.drop_ins(business_id,available_on_status,sort_order,id) where deleted_at is null;

create or replace function nodemere_private.guard_drop_in() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if new.business_id is distinct from old.business_id or new.id is distinct from old.id then
      raise exception 'Drop-in ownership cannot change' using errcode='42501';
    end if;
    new.updated_at=now();
    new.security_revision=old.security_revision+1;
  end if;
  if (tg_op='INSERT' or new.prompt is distinct from old.prompt) and new.prompt not like 'ndmenc:v1:%' then
    raise exception 'Drop-in instructions require encryption' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function nodemere_private.guard_drop_in() from public,anon,authenticated,service_role;
drop trigger if exists drop_ins_guard on public.drop_ins;
create trigger drop_ins_guard before insert or update on public.drop_ins for each row execute function nodemere_private.guard_drop_in();
drop trigger if exists phase5_audit_change on public.drop_ins;
create trigger phase5_audit_change after insert or update or delete on public.drop_ins for each row execute function nodemere_private.audit_row_change();

alter table public.call_logs add column if not exists drop_in_id uuid;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='call_logs_drop_in_business_fkey') then
  alter table public.call_logs add constraint call_logs_drop_in_business_fkey
    foreign key(drop_in_id,business_id) references public.drop_ins(id,business_id) on delete set null (drop_in_id);
 end if;
end $$;
create index if not exists call_logs_drop_in_created on public.call_logs(business_id,drop_in_id,created_at desc) where drop_in_id is not null;
-- Prevent simultaneous drop-in calls even when two clients submit different request IDs.
create unique index if not exists call_logs_one_active_drop_in on public.call_logs(business_id,appointment_id)
where drop_in_id is not null and status in ('dispatching','dispatch-unknown','in-progress','ringing','queued');

create or replace function public.reorder_drop_ins(target_business bigint,target_status text,ordered_ids uuid[])
returns void language plpgsql security invoker set search_path='' as $$
declare current_ids uuid[];
begin
  perform pg_advisory_xact_lock(hashtextextended('drop-ins:'||target_business::text||':'||target_status,0));
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into current_ids
    from public.drop_ins where business_id=target_business and available_on_status=target_status and deleted_at is null;
  if current_ids is distinct from (select coalesce(array_agg(x order by x),'{}'::uuid[]) from unnest(ordered_ids) x) then
    raise exception 'Drop-ins changed. Reload before reordering.' using errcode='40001';
  end if;
  update public.drop_ins d set sort_order=o.position-1
    from unnest(ordered_ids) with ordinality o(id,position)
    where d.id=o.id and d.business_id=target_business;
end $$;
revoke all on function public.reorder_drop_ins(bigint,text,uuid[]) from public,anon,authenticated;
grant execute on function public.reorder_drop_ins(bigint,text,uuid[]) to service_role;
create or replace function public.drop_in_usage(target_business bigint)
returns table(drop_in_id uuid,calls_started bigint) language sql stable security invoker set search_path='' as $$
  select drop_in_id,count(*) from public.call_logs
  where business_id=target_business and drop_in_id is not null and started_at is not null
  group by drop_in_id;
$$;
revoke all on function public.drop_in_usage(bigint) from public,anon,authenticated;
grant execute on function public.drop_in_usage(bigint) to service_role;
notify pgrst,'reload schema';
commit;
