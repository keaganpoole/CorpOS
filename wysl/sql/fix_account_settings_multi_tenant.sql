drop index if exists public.idx_account_settings_single;

create unique index if not exists idx_account_settings_user_id
  on public.account_settings (user_id)
  where user_id is not null;

create index if not exists idx_account_settings_business_id
  on public.account_settings (business_id);

alter table public.account_settings enable row level security;

drop policy if exists "users can read own account settings" on public.account_settings;
create policy "users can read own account settings"
on public.account_settings
for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own account settings" on public.account_settings;
create policy "users can insert own account settings"
on public.account_settings
for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update own account settings" on public.account_settings;
create policy "users can update own account settings"
on public.account_settings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can delete own account settings" on public.account_settings;
create policy "users can delete own account settings"
on public.account_settings
for delete
using (auth.uid() = user_id);

alter table public.businesses enable row level security;

drop policy if exists "users can read own businesses" on public.businesses;
create policy "users can read own businesses"
on public.businesses
for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own businesses" on public.businesses;
create policy "users can insert own businesses"
on public.businesses
for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update own businesses" on public.businesses;
create policy "users can update own businesses"
on public.businesses
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can delete own businesses" on public.businesses;
create policy "users can delete own businesses"
on public.businesses
for delete
using (auth.uid() = user_id);

alter table public.services enable row level security;

drop policy if exists "users can read own services" on public.services;
create policy "users can read own services"
on public.services
for select
using (
  exists (
    select 1
    from public.businesses b
    where b.id = services.business_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists "users can insert own services" on public.services;
create policy "users can insert own services"
on public.services
for insert
with check (
  exists (
    select 1
    from public.businesses b
    where b.id = services.business_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists "users can update own services" on public.services;
create policy "users can update own services"
on public.services
for update
using (
  exists (
    select 1
    from public.businesses b
    where b.id = services.business_id
      and b.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.businesses b
    where b.id = services.business_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists "users can delete own services" on public.services;
create policy "users can delete own services"
on public.services
for delete
using (
  exists (
    select 1
    from public.businesses b
    where b.id = services.business_id
      and b.user_id = auth.uid()
  )
);
