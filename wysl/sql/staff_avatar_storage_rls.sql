-- Dedicated storage bucket for staff card images.
-- Frontend upload path:
--   staff-avatars/{user_id}/{business_id}/{file}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'staff-avatars',
  'staff-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "staff avatars are publicly readable" on storage.objects;
create policy "staff avatars are publicly readable"
on storage.objects for select
using (bucket_id = 'staff-avatars');

drop policy if exists "users can upload own staff avatars" on storage.objects;
create policy "users can upload own staff avatars"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'staff-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users can update own staff avatars" on storage.objects;
create policy "users can update own staff avatars"
on storage.objects for update
to authenticated
using (
  bucket_id = 'staff-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'staff-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users can delete own staff avatars" on storage.objects;
create policy "users can delete own staff avatars"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'staff-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
