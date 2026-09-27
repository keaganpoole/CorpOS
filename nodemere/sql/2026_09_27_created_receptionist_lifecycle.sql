-- Created membership is independent of catalog/archive placement. Apply after private catalog migration.
begin;
alter table public.created_receptionists drop constraint if exists created_receptionists_status_check;
alter table public.created_receptionists add constraint created_receptionists_status_check
  check (status in ('draft','generating','ready','converted','abandoned','archived'));
-- Preserve existing archived creations in Archives; their hired rows are historical membership.
update public.created_receptionists c set status = 'archived', updated_at = now()
  from public.hired_receptionists h where c.hired_receptionist_id = h.id
  and c.user_id = h.user_id and c.business_id = h.business_id
  and c.status = 'converted' and h.status = 'archived';
update public.hired_receptionists h set status = 'catalog', is_active = false, direction = 'none'
  from public.created_receptionists c where c.hired_receptionist_id = h.id
  and c.user_id = h.user_id and c.business_id = h.business_id and c.status in ('ready','archived');

create or replace function public.nodemere_created_receptionist_lifecycle(
  target_id bigint, target_owner uuid, target_business bigint, target_action text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  draft public.created_receptionists%rowtype;
  next_status text;
begin
  perform 1 from public.businesses where id = target_business and user_id = target_owner for update;
  if not found then raise exception 'created_not_found'; end if;
  select * into draft from public.created_receptionists
    where id = target_id and user_id = target_owner and business_id = target_business for update;
  if not found then raise exception 'created_not_found'; end if;
  if target_action = 'remove' and draft.status in ('converted','ready') then next_status := 'ready';
  elsif target_action = 'archive' and draft.status in ('ready','archived') then next_status := 'archived';
  elsif target_action = 'restore' and draft.status in ('archived','ready') then next_status := 'ready';
  else raise exception 'created_invalid_transition'; end if;
  if draft.hired_receptionist_id is not null then
    update public.hired_receptionists set is_active = false, status = 'catalog', direction = 'none'
      where id = draft.hired_receptionist_id and user_id = target_owner and business_id = target_business;
    if not found then raise exception 'created_not_found'; end if;
  end if;
  update public.created_receptionists set status = next_status, updated_at = now()
    where id = draft.id returning * into draft;
  return jsonb_build_object('ok', true, 'creation', to_jsonb(draft));
end $$;
revoke all on function public.nodemere_created_receptionist_lifecycle(bigint,uuid,bigint,text) from public, anon, authenticated;
grant execute on function public.nodemere_created_receptionist_lifecycle(bigint,uuid,bigint,text) to service_role;

create or replace function public.nodemere_hire_created_receptionist(
  target_id bigint, target_owner uuid, target_business bigint, receptionist_limit integer default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  draft public.created_receptionists%rowtype;
  hired public.hired_receptionists%rowtype;
  active_count integer;
begin
  -- Serialize private hires within the business, then lock this exact creation.
  perform 1 from public.businesses where id = target_business and user_id = target_owner for update;
  if not found then raise exception 'created_not_found'; end if;
  select * into draft from public.created_receptionists
    where id = target_id and user_id = target_owner and business_id = target_business for update;
  if not found then raise exception 'created_not_found'; end if;
  if draft.status = 'converted' and draft.hired_receptionist_id is not null then
    select * into hired from public.hired_receptionists
      where id = draft.hired_receptionist_id and user_id = target_owner and business_id = target_business;
    if not found then raise exception 'created_not_ready'; end if;
    return jsonb_build_object('receptionist', to_jsonb(hired), 'newly_hired', false);
  end if;
  if draft.status <> 'ready' or nullif(draft.voice_id, '') is null then
    raise exception 'created_not_ready';
  end if;
  if receptionist_limit is not null then
    select count(*) into active_count from public.hired_receptionists
      where user_id = target_owner and is_active is distinct from false
        and lower(trim(coalesce(status, ''))) not in ('archived','inactive','disabled','terminated');
    if active_count >= receptionist_limit then raise exception 'created_plan_limit'; end if;
  end if;
  if draft.hired_receptionist_id is not null then
    update public.hired_receptionists set is_active = true, status = 'active', direction = 'all'
      where id = draft.hired_receptionist_id and user_id = target_owner and business_id = target_business
      returning * into hired;
    if not found then raise exception 'created_not_ready'; end if;
  else
  insert into public.hired_receptionists
    (catalog_id, full_name, first_name, description, stereotype, avatar, traits, voice, age,
     gender, is_active, direction, user_id, business_id, elevenlabs_voice_id)
  values
    (null, draft.full_name, draft.first_name, draft.description, 'Studio Voice Design',
     draft.selected_portrait_url, draft.traits, draft.voice_preview_url,
     case when trim(draft.age) ~ '^[0-9]{1,3}$' then trim(draft.age)::integer else null end,
     draft.gender, true, 'all', target_owner, target_business, draft.voice_id)
  returning * into hired;
  end if;
  update public.created_receptionists set status = 'converted', hired_receptionist_id = hired.id,
    converted_at = now(), updated_at = now() where id = draft.id;
  return jsonb_build_object('receptionist', to_jsonb(hired), 'newly_hired', true);
end $$;
revoke all on function public.nodemere_hire_created_receptionist(bigint, uuid, bigint, integer) from public, anon, authenticated;
grant execute on function public.nodemere_hire_created_receptionist(bigint, uuid, bigint, integer) to service_role;
notify pgrst, 'reload schema';
commit;
