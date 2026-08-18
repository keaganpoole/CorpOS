-- Server-side plan enforcement.
-- Apply after the backend deployment that contains the entitlement checks.
-- The backend uses the Supabase service role for these writes; browser clients
-- retain read access but cannot bypass plan limits through PostgREST.

begin;

drop policy if exists "users can insert own people" on public.people;
drop policy if exists "users can update own people" on public.people;
drop policy if exists "users can delete own people" on public.people;
drop policy if exists "users can manage own hired receptionists" on public.hired_receptionists;
drop policy if exists "users can manage own scenarios" on public.scenarios;

-- People updates remain available for custom-field maintenance; contact
-- creation is the quota-controlled operation and now goes through the API.
revoke insert on table public.people from anon, authenticated;
revoke delete on table public.people from anon, authenticated;
revoke insert, update, delete on table public.hired_receptionists from anon, authenticated;
revoke insert, update, delete on table public.scenarios from anon, authenticated;

commit;
