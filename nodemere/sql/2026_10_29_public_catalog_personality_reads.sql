-- The public homepage catalog embeds personalities through receptionist_catalog.personality_id.
-- Only expose personality rows referenced by that public catalog to anonymous visitors.
create policy "Public catalog personality types are readable"
on public.personalities
for select
to anon
using (
  is_active = true
  and exists (
    select 1
    from public.receptionist_catalog as catalog
    where catalog.personality_id = personalities.id
  )
);
