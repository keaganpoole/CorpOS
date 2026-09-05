-- Run before the 2026_09_04 Essentials display-copy migration.
-- PostgreSQL keeps rows, RLS, grants, policies, and trigger bindings attached
-- to the table object during a rename. This migration only changes the catalog
-- name and cleans up the old internal object names.
begin;

do $$
begin
  if to_regclass('public.sonar_plans') is not null then
    if to_regclass('public.plans') is not null then
      raise exception 'Cannot rename sonar_plans: public.plans already exists';
    end if;
    alter table public.sonar_plans rename to plans;
  elsif to_regclass('public.plans') is null then
    raise exception 'Neither public.sonar_plans nor public.plans exists';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_constraint where conrelid = 'public.plans'::regclass and conname = 'sonar_plans_display_object')
     and not exists (select 1 from pg_constraint where conrelid = 'public.plans'::regclass and conname = 'plans_display_object') then
    alter table public.plans rename constraint sonar_plans_display_object to plans_display_object;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.plans'::regclass and conname = 'sonar_plans_entitlements_object')
     and not exists (select 1 from pg_constraint where conrelid = 'public.plans'::regclass and conname = 'plans_entitlements_object') then
    alter table public.plans rename constraint sonar_plans_entitlements_object to plans_entitlements_object;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.plans'::regclass and conname = 'sonar_plans_features_array')
     and not exists (select 1 from pg_constraint where conrelid = 'public.plans'::regclass and conname = 'plans_features_array') then
    alter table public.plans rename constraint sonar_plans_features_array to plans_features_array;
  end if;
  if to_regclass('public.sonar_plans_public_sort_idx') is not null
     and to_regclass('public.plans_public_sort_idx') is null then
    alter index public.sonar_plans_public_sort_idx rename to plans_public_sort_idx;
  end if;
  if to_regprocedure('public.set_sonar_plans_updated_at()') is not null
     and to_regprocedure('public.set_plans_updated_at()') is null then
    alter function public.set_sonar_plans_updated_at() rename to set_plans_updated_at;
  end if;
  if exists (select 1 from pg_trigger where tgrelid = 'public.plans'::regclass and tgname = 'sonar_plans_set_updated_at')
     and not exists (select 1 from pg_trigger where tgrelid = 'public.plans'::regclass and tgname = 'plans_set_updated_at') then
    alter trigger sonar_plans_set_updated_at on public.plans rename to plans_set_updated_at;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'plans' and policyname = 'Public can read public Sonar plans')
     and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'plans' and policyname = 'Public can read public plans') then
    alter policy "Public can read public Sonar plans" on public.plans rename to "Public can read public plans";
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
