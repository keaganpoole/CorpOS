-- Disposable, loopback-only PostgreSQL fixture, never a production migration.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema nodemere_private;
create function nodemere_private.audit_row_change() returns trigger language plpgsql as $$ begin return new; end $$;
create table public.businesses(id bigint primary key);
insert into public.businesses values(1),(2);
create table public.people(id bigint primary key);
create table public.call_logs(id uuid primary key,business_id bigint,appointment_id uuid,status text,created_at timestamptz,started_at timestamptz);
grant usage on schema public to service_role;
grant select on public.businesses,public.call_logs to service_role;
