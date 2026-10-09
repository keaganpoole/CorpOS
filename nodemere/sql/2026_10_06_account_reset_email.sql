-- One-time email proof for owners who have not enrolled an authenticator.
-- The reset RPC remains service-role-only and continues to preserve billing.
begin;

create table if not exists public.account_reset_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id bigint null,
  token_hash text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint account_reset_requests_status_check check (status in ('pending', 'expired', 'used'))
);

create index if not exists account_reset_requests_user_status_idx
  on public.account_reset_requests (user_id, status, expires_at);

revoke all on public.account_reset_requests from public, anon, authenticated;

create or replace function public.nodemere_confirm_account_reset(token_digest text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reset_request public.account_reset_requests%rowtype;
  current_business_id bigint;
  reset_result jsonb;
begin
  select * into reset_request
  from public.account_reset_requests
  where token_hash = token_digest and status = 'pending' and expires_at > now()
  for update;
  if not found then
    raise exception 'Reset link is invalid or expired' using errcode = '22023';
  end if;

  select id into current_business_id
  from public.businesses
  where user_id = reset_request.user_id
  for update;
  if current_business_id is distinct from reset_request.business_id then
    raise exception 'The workspace has changed since this link was issued' using errcode = '23514';
  end if;

  update public.account_reset_requests set status = 'used', used_at = now()
  where id = reset_request.id;

  reset_result := public.nodemere_reset_account(reset_request.user_id);
  if coalesce((reset_result->>'reset')::boolean, false) is not true then
    raise exception 'Account reset was not completed';
  end if;
  update public.account_reset_requests set status = 'expired'
  where user_id = reset_request.user_id and status = 'pending';
  return reset_result;
end;
$$;

revoke all on function public.nodemere_confirm_account_reset(text) from public, anon, authenticated;
grant execute on function public.nodemere_confirm_account_reset(text) to service_role;

commit;
