begin;

alter table public.drop_ins
  add column if not exists parent_id uuid references public.drop_ins(id) on delete set null;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='drop_ins_parent_business_fkey') then
    alter table public.drop_ins add constraint drop_ins_parent_business_fkey
      foreign key(parent_id,business_id) references public.drop_ins(id,business_id) on delete set null (parent_id);
  end if;
end $$;

create index if not exists drop_ins_parent_order
  on public.drop_ins(business_id, parent_id, sort_order, id)
  where deleted_at is null;

create or replace function public.move_drop_in(
  target_business bigint,
  target_drop_in uuid,
  target_parent uuid,
  target_before uuid
) returns void language plpgsql security invoker set search_path='' as $$
declare
  target_status text;
  old_parent uuid;
  sibling_ids uuid[];
  insert_at integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('drop-in-tree:' || target_business::text, 0));

  select available_on_status, parent_id into target_status, old_parent
    from public.drop_ins
    where id=target_drop_in and business_id=target_business and deleted_at is null
    for update;
  if target_status is null then
    raise exception 'Drop-in not found' using errcode='P0002';
  end if;

  if target_parent is not null and not exists (
    select 1 from public.drop_ins
    where id=target_parent and business_id=target_business
      and available_on_status=target_status and deleted_at is null
  ) then
    raise exception 'Invalid parent' using errcode='22023';
  end if;

  if target_parent=target_drop_in or exists (
    with recursive descendants as (
      select id from public.drop_ins where parent_id=target_drop_in and business_id=target_business and deleted_at is null
      union all
      select child.id from public.drop_ins child join descendants parent on child.parent_id=parent.id
      where child.business_id=target_business and child.deleted_at is null
    ) select 1 from descendants where id=target_parent
  ) then
    raise exception 'Circular drop-in hierarchy' using errcode='22023';
  end if;

  select coalesce(array_agg(id order by sort_order,id), '{}'::uuid[]) into sibling_ids
    from public.drop_ins
    where business_id=target_business and available_on_status=target_status
      and parent_id is not distinct from target_parent and id<>target_drop_in and deleted_at is null;

  if target_before is null then
    sibling_ids := array_append(sibling_ids, target_drop_in);
  else
    insert_at := array_position(sibling_ids, target_before);
    if insert_at is null then raise exception 'Invalid sibling position' using errcode='22023'; end if;
    sibling_ids := coalesce(sibling_ids[1:insert_at-1], '{}'::uuid[])
      || array[target_drop_in]
      || coalesce(sibling_ids[insert_at:array_length(sibling_ids,1)], '{}'::uuid[]);
  end if;

  update public.drop_ins set parent_id=target_parent where id=target_drop_in and business_id=target_business;
  update public.drop_ins child set sort_order=ordered.position-1
    from unnest(sibling_ids) with ordinality ordered(id,position)
    where child.id=ordered.id and child.business_id=target_business;

  with old_siblings as (
    select id,row_number() over(order by sort_order,id)-1 as position
    from public.drop_ins
    where business_id=target_business and available_on_status=target_status
      and parent_id is not distinct from old_parent and deleted_at is null
  )
  update public.drop_ins child set sort_order=old_siblings.position
    from old_siblings where child.id=old_siblings.id;
end $$;

revoke all on function public.move_drop_in(bigint,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.move_drop_in(bigint,uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
