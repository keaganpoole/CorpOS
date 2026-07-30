-- Dedicated storage bucket for business account avatars.
-- Frontend upload path:
--   business-avatars/{user_id}/{business_id}/{file}

alter table public.businesses
add column if not exists avatar text null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-avatars',
  'business-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "business avatars are publicly readable" on storage.objects;
create policy "business avatars are publicly readable"
on storage.objects for select
using (bucket_id = 'business-avatars');

drop policy if exists "users can upload own business avatars" on storage.objects;
create policy "users can upload own business avatars"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'business-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users can update own business avatars" on storage.objects;
create policy "users can update own business avatars"
on storage.objects for update
to authenticated
using (
  bucket_id = 'business-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'business-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users can delete own business avatars" on storage.objects;
create policy "users can delete own business avatars"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'business-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
