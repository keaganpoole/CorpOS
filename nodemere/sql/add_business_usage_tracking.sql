alter table public.businesses
add column if not exists current_cycle_used_seconds bigint not null default 0,
add column if not exists current_cycle_included_seconds bigint not null default 0,
add column if not exists current_cycle_overage_seconds bigint not null default 0,
add column if not exists current_cycle_started_at timestamptz null,
add column if not exists current_cycle_ends_at timestamptz null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'businesses'
      and column_name = 'current_cycle_included_minutes'
  ) then
    execute '
      update public.businesses
      set current_cycle_included_seconds = greatest(
        0,
        coalesce(current_cycle_included_seconds, 0),
        coalesce(current_cycle_included_minutes, 0) * 60
      )
    ';
  end if;
end;
$$;

alter table public.businesses
drop column if exists current_cycle_used_minutes,
drop column if exists current_cycle_included_minutes,
drop column if exists current_cycle_overage_minutes;

create or replace function public.increment_business_cycle_usage(
  business_id_param bigint,
  duration_delta_seconds_param bigint
)
returns table (
  current_cycle_used_seconds bigint,
  current_cycle_overage_seconds bigint
) as $$
declare
  next_used_seconds bigint;
  included_seconds bigint;
begin
  update public.businesses as b
  set current_cycle_used_seconds = greatest(0, coalesce(b.current_cycle_used_seconds, 0) + greatest(0, duration_delta_seconds_param))
  where b.id = business_id_param
  returning b.current_cycle_used_seconds, greatest(0, coalesce(b.current_cycle_included_seconds, 0))
  into next_used_seconds, included_seconds;

  if next_used_seconds is null then
    return;
  end if;

  update public.businesses as b
  set current_cycle_overage_seconds = greatest(0, next_used_seconds - included_seconds)
  where b.id = business_id_param
  returning
    b.current_cycle_used_seconds,
    b.current_cycle_overage_seconds
  into
    current_cycle_used_seconds,
    current_cycle_overage_seconds;

  return next;
end;
$$ language plpgsql;
