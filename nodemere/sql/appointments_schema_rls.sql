alter table public.appointments_schema enable row level security;

drop policy if exists "users can read own appointments schema" on public.appointments_schema;
create policy "users can read own appointments schema"
on public.appointments_schema
for select
using (
  exists (
    select 1 from public.businesses b
    where b.id = appointments_schema.business_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists "users can insert own appointments schema" on public.appointments_schema;
create policy "users can insert own appointments schema"
on public.appointments_schema
for insert
with check (
  exists (
    select 1 from public.businesses b
    where b.id = appointments_schema.business_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists "users can update own appointments schema" on public.appointments_schema;
create policy "users can update own appointments schema"
on public.appointments_schema
for update
using (
  exists (
    select 1 from public.businesses b
    where b.id = appointments_schema.business_id
      and b.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.businesses b
    where b.id = appointments_schema.business_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists "users can delete own appointments schema" on public.appointments_schema;
create policy "users can delete own appointments schema"
on public.appointments_schema
for delete
using (
  exists (
    select 1 from public.businesses b
    where b.id = appointments_schema.business_id
      and b.user_id = auth.uid()
  )
);
