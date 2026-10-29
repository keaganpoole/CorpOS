-- Settle the usage snapshot when a renewal invoice is created so calls made
-- before that invoice is paid remain available for the next billing cycle.
alter table public.billing_overage_events
  add column if not exists billed_usage_seconds bigint not null default 0,
  add column if not exists cycle_rolled_at timestamptz null;

create or replace function public.roll_business_usage_for_invoice(
  p_user_id uuid,
  p_invoice_id text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  overage_event public.billing_overage_events%rowtype;
  updated_count integer;
begin
  select * into overage_event
  from public.billing_overage_events
  where user_id = p_user_id and stripe_invoice_id = p_invoice_id
  for update;

  if not found then
    raise exception 'Overage invoice event was not found';
  end if;
  if overage_event.cycle_rolled_at is not null then
    return false;
  end if;
  if overage_event.status <> 'invoiced' then
    raise exception 'Overage invoice event is not ready to settle';
  end if;

  update public.businesses as b
  set current_cycle_used_seconds = greatest(0, coalesce(b.current_cycle_used_seconds, 0) - overage_event.billed_usage_seconds),
      current_cycle_overage_seconds = greatest(
        0,
        greatest(0, coalesce(b.current_cycle_used_seconds, 0) - overage_event.billed_usage_seconds)
          - coalesce(b.current_cycle_included_seconds, 0)
      )
  where b.id = overage_event.business_id and b.user_id = p_user_id;

  get diagnostics updated_count = row_count;
  if updated_count <> 1 then
    raise exception 'Business usage row was not found';
  end if;

  update public.billing_overage_events
  set cycle_rolled_at = now()
  where id = overage_event.id;
  return true;
end;
$$;

revoke execute on function public.roll_business_usage_for_invoice(uuid, text) from public, anon, authenticated;
grant execute on function public.roll_business_usage_for_invoice(uuid, text) to service_role;
