-- Apply after 2026_09_06_drop_ins.sql and 2026_09_07_drop_in_hierarchy.sql.
begin;
alter table public.drop_ins add column if not exists canvas_x double precision;
alter table public.drop_ins add column if not exists canvas_y double precision;

-- Serialize both the page's atomic saves and the retained modal's individual
-- writes. A deferred guard checks final state rather than intermediate moves.
create or replace function nodemere_private.lock_drop_in_tree() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('drop-in-tree:' || coalesce(new.business_id,old.business_id)::text,0));
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function nodemere_private.lock_drop_in_tree() from public,anon,authenticated,service_role;
drop trigger if exists drop_ins_tree_lock on public.drop_ins;
create trigger drop_ins_tree_lock before insert or update or delete on public.drop_ins for each row execute function nodemere_private.lock_drop_in_tree();

create or replace function nodemere_private.validate_drop_in_tree() returns trigger
language plpgsql security definer set search_path='' as $$
declare current_row public.drop_ins; next_parent uuid; seen uuid[]; parent_row public.drop_ins;
begin
  select * into current_row from public.drop_ins where id=new.id;
  if not found or current_row.deleted_at is not null then
    if exists(select 1 from public.drop_ins where parent_id=new.id and deleted_at is null) then
      raise exception 'Active children require an active parent' using errcode='23514';
    end if;
    return null;
  end if;
  if exists(select 1 from public.drop_ins where parent_id=current_row.id and deleted_at is null and available_on_status<>current_row.available_on_status) then
    raise exception 'Children must use the parent status' using errcode='23514';
  end if;
  seen:=array[current_row.id]; next_parent:=current_row.parent_id;
  while next_parent is not null loop
    if next_parent=any(seen) then raise exception 'Circular drop-in hierarchy' using errcode='23514'; end if;
    select * into parent_row from public.drop_ins where id=next_parent and business_id=current_row.business_id and deleted_at is null;
    if not found or parent_row.available_on_status<>current_row.available_on_status then
      raise exception 'Invalid drop-in parent' using errcode='23514';
    end if;
    seen:=array_append(seen,next_parent); next_parent:=parent_row.parent_id;
  end loop;
  return null;
end $$;
revoke all on function nodemere_private.validate_drop_in_tree() from public,anon,authenticated,service_role;
drop trigger if exists drop_ins_tree_valid on public.drop_ins;
create constraint trigger drop_ins_tree_valid after insert or update on public.drop_ins deferrable initially deferred for each row execute function nodemere_private.validate_drop_in_tree();

create or replace function public.save_drop_in_builder(target_business bigint, nodes jsonb, baseline jsonb)
returns setof public.drop_ins language plpgsql security invoker set search_path='' as $$
declare entry record;
begin
  set constraints public.drop_ins_tree_valid deferred;
  perform pg_advisory_xact_lock(hashtextextended('drop-in-tree:' || target_business::text,0));
  -- Lock the collection before comparing all IDs and timestamps, including
  -- deletions/additions made by another editor since this page was loaded.
  perform 1 from public.drop_ins where business_id=target_business for update;
  if exists (
    select 1 from (select id,updated_at from public.drop_ins where business_id=target_business and deleted_at is null) saved
    full join jsonb_to_recordset(baseline) as base(id uuid,updated_at timestamptz) using(id)
    where saved.id is null or base.id is null or saved.updated_at is distinct from base.updated_at
  ) then raise exception 'Drop-ins changed' using errcode='40001'; end if;
  if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(nodes))
     or (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(baseline)) then
    raise exception 'Duplicate identifiers' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_to_recordset(nodes) as n(id uuid) join public.drop_ins d using(id) where d.business_id<>target_business or d.deleted_at is not null) then
    raise exception 'Identifier is not available' using errcode='40001';
  end if;
  -- All new nodes exist before assigning any foreign keys, regardless of input
  -- order. Encryption is enforced by the original drop_ins_guard trigger.
  for entry in select * from jsonb_to_recordset(nodes) as n(id uuid,name text,purpose text,prompt text,is_active boolean,available_on_status text,parent_id uuid,sort_order integer,canvas_x double precision,canvas_y double precision) loop
    if entry.canvas_x not between -1000000 and 1000000 or entry.canvas_y not between -1000000 and 1000000 then raise exception 'Invalid canvas position' using errcode='22023'; end if;
    insert into public.drop_ins(id,business_id,name,purpose,prompt,is_active,available_on_status,sort_order,canvas_x,canvas_y)
      values(entry.id,target_business,entry.name,entry.purpose,entry.prompt,entry.is_active,entry.available_on_status,entry.sort_order,entry.canvas_x,entry.canvas_y)
      on conflict(id) do update set name=excluded.name,purpose=excluded.purpose,prompt=excluded.prompt,is_active=excluded.is_active,sort_order=excluded.sort_order,canvas_x=excluded.canvas_x,canvas_y=excluded.canvas_y
      where drop_ins.business_id=target_business and drop_ins.available_on_status=excluded.available_on_status;
    if not found then raise exception 'Cannot change drop-in status' using errcode='22023'; end if;
  end loop;
  if exists(select 1 from jsonb_to_recordset(nodes) as n(id uuid,parent_id uuid,available_on_status text) where n.parent_id is not null and not exists(select 1 from jsonb_to_recordset(nodes) as p(id uuid,available_on_status text) where p.id=n.parent_id and p.available_on_status=n.available_on_status)) then
    raise exception 'Invalid parent' using errcode='22023';
  end if;
  update public.drop_ins d set parent_id=n.parent_id from jsonb_to_recordset(nodes) as n(id uuid,parent_id uuid) where d.id=n.id and d.business_id=target_business and d.parent_id is distinct from n.parent_id;
  update public.drop_ins set deleted_at=now(),is_active=false,parent_id=null where business_id=target_business and deleted_at is null and id not in(select (value->>'id')::uuid from jsonb_array_elements(nodes));
  -- Force validation inside this RPC, so invalid trees cannot return success.
  set constraints public.drop_ins_tree_valid immediate;
  return query select * from public.drop_ins where business_id=target_business and deleted_at is null order by sort_order,id;
end $$;
revoke all on function public.save_drop_in_builder(bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_drop_in_builder(bigint,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
