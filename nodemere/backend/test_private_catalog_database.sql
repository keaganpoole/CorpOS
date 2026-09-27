-- Run after sql/2026_09_27_private_receptionist_catalog.sql. All fixture writes roll back.
begin;
do $$
declare
  business public.businesses%rowtype;
  creation_id bigint;
  draft_id bigint;
  result jsonb;
  retry jsonb;
  hired_id bigint;
  before_count integer;
  rejected boolean;
begin
  select * into business from public.businesses where user_id is not null order by id limit 1;
  if not found then raise exception 'No business fixture available'; end if;
  select count(*) into before_count from public.hired_receptionists where business_id = business.id;
  insert into public.created_receptionists
    (user_id, business_id, status, full_name, first_name, voice_id, selected_portrait_url, voice_preview_url, traits, age)
  values (business.user_id, business.id, 'ready', 'Synthetic catalog fixture', 'Synthetic', 'synthetic-test-voice',
          'https://example.com/portrait.png', 'https://example.com/preview.mp3', '["Warm"]', 'Young adult')
  returning id into creation_id;
  if (select count(*) from public.hired_receptionists where business_id = business.id) <> before_count then
    raise exception 'Saving a creation hired it';
  end if;
  rejected := false;
  begin
    perform public.nodemere_hire_created_receptionist(creation_id, '00000000-0000-0000-0000-000000000000', business.id, null);
  exception when others then
    if sqlerrm not like '%created_not_found%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Cross-owner hire succeeded'; end if;
  rejected := false;
  begin
    perform public.nodemere_hire_created_receptionist(creation_id, business.user_id, -1, null);
  exception when others then
    if sqlerrm not like '%created_not_found%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Cross-business hire succeeded'; end if;
  rejected := false;
  begin
    perform public.nodemere_hire_created_receptionist(creation_id, business.user_id, business.id, 0);
  exception when others then
    if sqlerrm not like '%created_plan_limit%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Plan limit was bypassed'; end if;
  result := public.nodemere_hire_created_receptionist(creation_id, business.user_id, business.id, null);
  hired_id := (result->'receptionist'->>'id')::bigint;
  if not (result->>'newly_hired')::boolean then raise exception 'Initial hire not marked new'; end if;
  if result->'receptionist'->>'avatar' <> 'https://example.com/portrait.png'
    or result->'receptionist'->>'voice' <> 'https://example.com/preview.mp3'
    or result->'receptionist'->>'elevenlabs_voice_id' <> 'synthetic-test-voice' then
    raise exception 'Hire lost portrait or voice';
  end if;
  if not exists(select 1 from public.created_receptionists where id = creation_id and status = 'converted'
                and hired_receptionist_id = hired_id and converted_at is not null) then
    raise exception 'Original creation was not preserved and linked';
  end if;
  -- Retry must work even when the plan is now full, without another membership.
  retry := public.nodemere_hire_created_receptionist(creation_id, business.user_id, business.id, 0);
  if (retry->>'newly_hired')::boolean or (retry->'receptionist'->>'id')::bigint <> hired_id then
    raise exception 'Retry duplicated membership';
  end if;
  if (select count(*) from public.hired_receptionists where business_id = business.id) <> before_count + 1 then
    raise exception 'Incorrect membership count';
  end if;
  insert into public.created_receptionists(user_id, business_id, status) values (business.user_id, business.id, 'draft') returning id into draft_id;
  rejected := false;
  begin
    perform public.nodemere_hire_created_receptionist(draft_id, business.user_id, business.id, null);
  exception when others then
    if sqlerrm not like '%created_not_ready%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Unready draft was hired'; end if;
  if has_function_privilege('authenticated', 'public.nodemere_hire_created_receptionist(bigint,uuid,bigint,integer)', 'execute')
    or has_function_privilege('anon', 'public.nodemere_hire_created_receptionist(bigint,uuid,bigint,integer)', 'execute') then
    raise exception 'Atomic hire RPC is exposed to browser clients';
  end if;
end $$;
rollback;
select 'PASS: catalog save, media copy, ownership, business scope, plan limit, readiness, retry and server-only RPC; fixtures rolled back' as result;
