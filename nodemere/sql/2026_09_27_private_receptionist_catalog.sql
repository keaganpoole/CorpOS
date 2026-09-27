-- Apply before deploying the private Studio catalog workflow.
-- Existing ready and converted records remain unchanged.
begin;
alter table public.created_receptionists add column if not exists voice_preview_url text;
alter table public.created_receptionists add column if not exists design_candidate_id text;
create unique index if not exists created_receptionists_design_candidate_idx
  on public.created_receptionists(user_id, business_id, design_candidate_id)
  where design_candidate_id is not null;

-- Creation and conversion are server managed. Preserve owner SELECT access.
revoke insert, update, delete on public.created_receptionists from anon, authenticated;

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
  if draft.status <> 'ready' or nullif(draft.voice_id, '') is null or draft.hired_receptionist_id is not null then
    raise exception 'created_not_ready';
  end if;
  if receptionist_limit is not null then
    select count(*) into active_count from public.hired_receptionists
      where user_id = target_owner and is_active is distinct from false
        and lower(trim(coalesce(status, ''))) not in ('archived','inactive','disabled','terminated');
    if active_count >= receptionist_limit then raise exception 'created_plan_limit'; end if;
  end if;
  insert into public.hired_receptionists
    (catalog_id, full_name, first_name, description, stereotype, avatar, traits, voice, age,
     gender, is_active, direction, user_id, business_id, elevenlabs_voice_id)
  values
    (null, draft.full_name, draft.first_name, draft.description, 'Studio Voice Design',
     draft.selected_portrait_url, draft.traits, draft.voice_preview_url,
     case when trim(draft.age) ~ '^[0-9]{1,3}$' then trim(draft.age)::integer else null end,
     draft.gender, true, 'all', target_owner, target_business, draft.voice_id)
  returning * into hired;
  update public.created_receptionists set status = 'converted', hired_receptionist_id = hired.id,
    converted_at = now(), updated_at = now() where id = draft.id;
  return jsonb_build_object('receptionist', to_jsonb(hired), 'newly_hired', true);
end $$;
revoke all on function public.nodemere_hire_created_receptionist(bigint, uuid, bigint, integer) from public, anon, authenticated;
grant execute on function public.nodemere_hire_created_receptionist(bigint, uuid, bigint, integer) to service_role;
notify pgrst, 'reload schema';
commit;
