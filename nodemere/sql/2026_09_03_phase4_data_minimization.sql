-- Requires Phases 1-3. No historical records are deleted or rewritten.
begin;
-- PostgreSQL column grants also constrain Supabase Realtime payloads. RLS
-- independently checks the current member, role and assurance for each row.
do $$ declare t text; cols text; allowed text; begin
 foreach t in array array['call_logs','invoices','people_docs','requests','contracts','custom_voices','jobs','scenario_events'] loop
  if to_regclass('public.'||t) is null then continue; end if;
  execute format('revoke select on public.%I from public,anon,authenticated',t);
  select string_agg(quote_ident(attname),',') into cols from pg_attribute
   where attrelid=to_regclass('public.'||t) and attnum>0 and not attisdropped;
  execute format('revoke select(%s) on public.%I from public,anon,authenticated',cols,t);
  allowed:=null;
  if t='call_logs' then
   allowed:='id,business_id,user_id,person_id,caller_name,caller_phone,from_number,to_number,started_at,ended_at,event_timestamp,created_at,duration_seconds,status,outcome,summary,call_successful,direction,receptionist_name,agent_name,hired_receptionist_id,is_favorited,has_audio';
  elsif t='invoices' then
   allowed:='id,user_id,person_id,appointment_id,service_id,payment_id,stripe_invoice_id,stripe_customer_id,amount_due,amount_paid,currency,status,due_date,paid_at,created_at,updated_at';
  end if;
  if allowed is not null then
   select string_agg(quote_ident(attname),',') into cols from pg_attribute
    where attrelid=to_regclass('public.'||t) and attnum>0 and not attisdropped and attname=any(string_to_array(allowed,','));
   execute format('grant select(%s) on public.%I to authenticated',cols,t);
  end if;
 end loop;
end $$;
-- Existing signed access keeps working. Public retrieval must never expose
-- recordings or caller documents, including objects uploaded before this batch.
do $$ begin
 if to_regclass('storage.buckets') is not null then
  update storage.buckets set public=false where id in ('caller-documents','call_recordings','voice-contracts');
 end if;
 if to_regclass('storage.objects') is not null then
  execute 'drop policy if exists phase4_storage_insert on storage.objects';
  execute 'drop policy if exists phase4_storage_update on storage.objects';
  execute 'drop policy if exists phase4_storage_delete on storage.objects';
  execute 'create policy phase4_storage_insert on storage.objects as restrictive for insert to anon,authenticated with check(false)';
  execute 'create policy phase4_storage_update on storage.objects as restrictive for update to anon,authenticated using(false) with check(false)';
  execute 'create policy phase4_storage_delete on storage.objects as restrictive for delete to anon,authenticated using(false)';
 end if;
end $$;
notify pgrst,'reload schema';
commit;
