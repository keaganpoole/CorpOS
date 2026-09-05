-- Disposable local database ONLY. Schema metadata, never production row data.
\if :{?security_disposable}
\else
\quit
\endif
create schema auth;
create function auth.uid() returns uuid language sql stable as
 $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as
 $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
grant usage on schema public,auth to anon,authenticated,service_role;
create table public."payments" ("id" uuid, "user_id" uuid, "person_id" bigint, "appointment_id" uuid, "scenario_id" uuid, "stripe_payment_intent_id" text, "stripe_session_id" text, "amount" bigint, "currency" text, "status" text, "payment_method" text, "description" text, "receipt_url" text, "refunded_amount" bigint, "error_message" text, "metadata" jsonb, "created_at" timestamptz, "updated_at" timestamptz, "business_id" bigint);
create table public."call_logs" ("id" uuid, "caller_phone" text, "caller_name" text, "person_id" bigint, "scenario_id" uuid, "started_at" timestamptz, "ended_at" timestamptz, "duration_seconds" bigint, "outcome" text, "appointment_id" uuid, "notes" text, "created_at" timestamptz, "business_id" bigint, "user_id" uuid, "source" text, "conversation_id" text, "elevenlabs_agent_id" text, "hired_receptionist_id" bigint, "receptionist_name" text, "from_number" text, "to_number" text, "status" text, "summary" text, "transcript_text" text, "raw_payload" jsonb, "webhook_type" text, "event_timestamp" timestamptz, "agent_name" text, "branch_id" text, "version_id" text, "environment" text, "has_audio" boolean, "has_user_audio" boolean, "has_response_audio" boolean, "call_successful" text, "analysis_results" jsonb, "conversation_metadata" jsonb, "conversation_initiation_data" jsonb, "telephony_metadata" jsonb, "provider_call_sid" text, "audio_storage_path" text, "failure_reason" text, "transcript_jsonb" jsonb, "is_favorited" boolean, "call_report" jsonb, "direction" text);
create table public."integrations" ("id" uuid, "user_id" uuid, "provider" text, "status" text, "selected" boolean, "connected_email" text, "scopes" jsonb, "provider_metadata" jsonb, "created_at" timestamptz, "updated_at" timestamptz, "credentials" jsonb);
create table public."bugs" ("id" uuid, "user_id" uuid, "business_id" bigint, "description" text, "severity" bigint, "page" text, "user_agent" text, "status" text, "created_at" timestamptz, "updated_at" timestamptz);
create table public."custom_voices" ("id" uuid, "contract_id" uuid, "business_id" bigint, "person_id" bigint, "user_id" uuid, "provider" text, "provider_voice_id" text, "voice_name" text, "speaker_name" text, "speaker_email" text, "status" text, "sample_count" bigint, "sample_storage_paths" jsonb, "provider_response" jsonb, "metadata" jsonb, "disabled_at" timestamptz, "created_at" timestamptz, "updated_at" timestamptz);
create table public."people_schema" ("id" uuid, "business_id" bigint, "field_key" text, "label" text, "field_type" text, "position" bigint, "is_active" boolean, "config" jsonb, "created_at" timestamptz, "updated_at" timestamptz);
create table public."hired_receptionists" ("id" bigint, "catalog_id" bigint, "full_name" text, "description" text, "stereotype" text, "avatar" text, "traits" jsonb, "voice" text, "age" numeric, "first_name" text, "elevenlabs_voice_id" text, "call_types" text, "is_active" boolean, "language_model" text, "status" text, "current_activity" text, "total_calls" bigint, "hired_at" timestamptz, "user_id" uuid, "business_id" bigint, "gender" text, "inbound_calls_count" bigint, "outbound_calls_count" bigint, "completed_calls_count" bigint, "failed_calls_count" bigint, "missed_calls_count" bigint, "average_call_duration_seconds" numeric, "last_call_at" timestamptz, "direction" text, "phone_number" text);
create table public."flow_executions" ("id" uuid, "scenario_id" uuid, "status" text, "current_node_id" text, "flow_context" jsonb, "trigger_event" jsonb, "pause_data" jsonb, "error" text, "started_at" timestamptz, "completed_at" timestamptz, "failed_at" timestamptz, "updated_at" timestamptz, "business_id" bigint, "user_id" uuid);
create table public."businesses" ("id" bigint, "name" text, "phone" text, "email" text, "address" text, "city" text, "state" text, "zip" text, "website" text, "about_us" text, "policies" text, "faq" text, "business_hours" text, "created_at" timestamptz, "updated_at" timestamptz, "user_id" uuid, "business_timezone" text, "industry" jsonb, "forwarding_config" jsonb, "people_field_config" jsonb, "appointments_field_config" jsonb, "current_cycle_used_seconds" bigint, "current_cycle_overage_seconds" bigint, "current_cycle_started_at" timestamptz, "current_cycle_ends_at" timestamptz, "current_cycle_included_seconds" bigint, "avatar" text);
create table public."requests" ("id" uuid, "business_id" bigint, "person_id" bigint, "phone" text, "user_id" uuid, "token_hash" text, "status" text, "expires_at" timestamptz, "completed_at" timestamptz, "metadata" jsonb, "created_at" timestamptz, "updated_at" timestamptz, "request_type" text);
create table public."scenario_events" ("id" uuid, "trigger_key" text, "payload" jsonb, "created_at" timestamptz);
create table public."jobs" ("id" uuid, "scenario_id" uuid, "user_id" uuid, "business_id" bigint, "type" text, "status" text, "schedule_config" jsonb, "payload" jsonb, "next_run_at" timestamptz, "last_run_at" timestamptz, "locked_at" timestamptz, "locked_by" text, "attempt_count" bigint, "last_error" text, "created_at" timestamptz, "updated_at" timestamptz);
create table public."contracts" ("id" uuid, "token_hash" text, "status" text, "business_id" bigint, "person_id" bigint, "user_id" uuid, "signer_name" text, "signer_email" text, "voice_display_name" text, "agreement_version" text, "agreement_body" text, "consent" jsonb, "metadata" jsonb, "signature_storage_bucket" text, "signature_storage_path" text, "signed_pdf_bucket" text, "signed_pdf_path" text, "signer_ip" text, "signer_user_agent" text, "elevenlabs_voice_id" text, "signed_at" timestamptz, "clone_completed_at" timestamptz, "expires_at" timestamptz, "created_at" timestamptz, "updated_at" timestamptz);
create table public."account_settings" ("id" uuid, "default_appointment_duration" bigint, "appointment_buffer_minutes" bigint, "auto_confirm_appointments" boolean, "send_confirmation_sms" boolean, "send_confirmation_email" boolean, "reminder_before_minutes" bigint, "allow_cancellations" boolean, "cancellation_window_hours" bigint, "created_at" timestamptz, "updated_at" timestamptz, "intro_message_prompt" text, "user_id" uuid, "business_id" bigint, "call_routing" text, "autonomy_index" bigint, "preferences" jsonb);
create table public."services" ("id" uuid, "name" text, "description" text, "price_type" text, "price_min" numeric, "price_max" numeric, "unit" text, "category" text, "is_active" boolean, "sort_order" bigint, "created_at" timestamptz, "updated_at" timestamptz, "user_id" uuid, "business_id" bigint);
create table public."checkpoints" ("id" bigint, "created_at" timestamptz, "user_id" uuid, "receptionist_id" bigint, "scenario_id" text, "trigger_key" text, "payload" jsonb, "intent_key" text, "parent_intent_key" text, "phase" text, "timestamp" timestamptz, "conversation_id" text, "direction" text, "duration" numeric, "sid" text, "caller_id" text, "execution_id" text, "session_id" text);
create table public."staff" ("id" uuid, "business_id" bigint, "full_name" text, "first_name" text, "last_name" text, "role" text, "email" text, "phone" text, "avatar" text, "is_active" boolean, "working_hours" jsonb, "knowledge" text, "created_at" timestamptz, "updated_at" timestamptz, "acknowledgements" jsonb);
create table public."plans" ("id" uuid, "slug" text, "name" text, "stripe_product_name" text, "sort_order" bigint, "is_public" boolean, "is_recommended" boolean, "display" jsonb, "entitlements" jsonb, "features" jsonb, "created_at" timestamptz, "updated_at" timestamptz);
create table public."appointments" ("id" uuid, "date" text, "time" text, "duration" bigint, "status" text, "notes" text, "scenario_id" uuid, "created_at" timestamptz, "user_id" uuid, "person_id" bigint, "service_id" uuid, "business_id" bigint, "custom_fields" jsonb, "source" text, "updated_at" timestamptz, "receptionist_id" bigint, "staff_id" uuid);
create table public."purchased_numbers" ("id" uuid, "business_id" bigint, "phone_number" text, "friendly_name" text, "provider" text, "kind" text, "status" text, "is_active" boolean, "twilio_account_sid" text, "twilio_incoming_phone_number_sid" text, "twilio_outgoing_caller_id_sid" text, "elevenlabs_phone_number_id" text, "quality_check_status" text, "quality_checked_at" timestamptz, "quality_failure_reason" text, "caller_id_verification_status" text, "caller_id_requested_at" timestamptz, "caller_id_verified_at" timestamptz, "caller_id_validation_code" text, "caller_id_call_sid" text, "caller_id_failure_reason" text, "caller_id_elevenlabs_phone_number_id" text, "locality" text, "region" text, "postal_code" text, "purchase_source" text, "assigned_at" timestamptz, "released_at" timestamptz, "released_reason" text, "created_at" timestamptz, "updated_at" timestamptz);
create table public."people_docs" ("id" uuid, "request_id" uuid, "business_id" bigint, "person_id" bigint, "file_name" text, "storage_bucket" text, "storage_path" text, "content_type" text, "file_size" bigint, "metadata" jsonb, "created_at" timestamptz);
create table public."invoices" ("id" uuid, "user_id" uuid, "person_id" bigint, "appointment_id" uuid, "service_id" uuid, "payment_id" uuid, "stripe_invoice_id" text, "stripe_customer_id" text, "stripe_payment_intent_id" text, "amount_due" bigint, "amount_paid" bigint, "currency" text, "status" text, "hosted_invoice_url" text, "invoice_pdf" text, "description" text, "due_date" timestamptz, "paid_at" timestamptz, "finalized_at" timestamptz, "voided_at" timestamptz, "metadata" jsonb, "raw_stripe_invoice" jsonb, "created_at" timestamptz, "updated_at" timestamptz);
create table public."appointments_schema" ("id" uuid, "business_id" bigint, "field_key" text, "label" text, "field_type" text, "position" bigint, "is_active" boolean, "config" jsonb, "created_at" timestamptz, "updated_at" timestamptz);
create table public."account_data_requests" ("id" uuid, "user_id" uuid, "request_type" text, "status" text, "details" text, "created_at" timestamptz, "completed_at" timestamptz);
create table public."nest" ("id" uuid, "business_id" bigint, "user_id" uuid, "category" text, "event_type" text, "priority" text, "title" text, "message" text, "source_id" text, "idempotency_key" text, "payload" jsonb, "occurred_at" timestamptz, "created_at" timestamptz);
create table public."receptionist_catalog" ("id" bigint, "full_name" text, "description" text, "stereotype" text, "avatar" text, "traits" jsonb, "voice" text, "age" numeric, "first_name" text, "elevenlabs_voice_id" text, "call_types" text, "phone_number" text, "is_active" boolean, "compliments" numeric, "complaints" numeric, "showcase_in_hero" numeric, "hero_avatar" text, "banner_id" text, "gender" text);
create table public."users" ("email" text, "full_name" text, "created_at" timestamptz, "plan" text, "phone" text, "onboarded" boolean, "user_agent" jsonb, "stripe" jsonb, "identity_questions" jsonb, "source" text, "display" jsonb, "id" uuid, "terms_of_service" jsonb, "popups" jsonb, "tasklist" jsonb, "account_status" text, "closed_at" timestamptz, "deletion_requested_at" timestamptz, "stripe_customer_id" text, "stripe_subscription_id" text, "subscription_status" text, "billing_period" text, "trial_start_date" text, "trial_end_date" text, "started_trial" boolean, "months_subscribed" bigint, "card_retries" bigint, "latest_charge_attempt" timestamptz, "log" text);
create table public."scenarios" ("id" uuid, "name" text, "description" text, "nodes_data" jsonb, "edges_data" jsonb, "status" text, "created_by" uuid, "created_at" timestamptz, "updated_at" timestamptz, "assigned_to" text, "notes" text, "is_active" boolean, "schedule_config" jsonb, "last_fired_at" timestamptz, "user_id" uuid, "business_id" bigint);
create table public."reviews" ("id" uuid, "user_id" uuid, "business_id" bigint, "questionnaire_version" text, "questionnaire_state" text, "completion_status" text, "answers" jsonb, "overall_rating" bigint, "pricing_value" text, "improvement_areas" jsonb, "improvement_other" text, "idea" text, "plan" text, "account_age_days" bigint, "usage_context" jsonb, "discount_eligible" boolean, "discount_granted" boolean, "discount_granted_at" timestamptz, "snoozed_until" timestamptz, "created_at" timestamptz, "updated_at" timestamptz);
create table public."system_config" ("id" boolean, "scheduler_run" boolean, "total_allowed_number_purchases" numeric, "verify_caller_id" boolean, "test_mode" boolean);
create table public."people" ("id" bigint, "created_at" timestamptz, "first_name" text, "last_name" text, "phone" text, "email" text, "street_address" text, "city" text, "state" text, "zip_code" text, "preferred_contact_method" text, "preferred_language" text, "best_time_to_contact" text, "consent_sms" boolean, "consent_call" boolean, "do_not_call" boolean, "do_not_text" boolean, "status" text, "source" text, "lead_source_detail" text, "tags" jsonb, "updated_at" timestamptz, "last_inbound_call_at" timestamptz, "last_outbound_call_at" timestamptz, "last_call_status" text, "last_intent" text, "last_outcome" text, "missed_call_count" bigint, "last_inbound_sms_at" timestamptz, "last_outbound_sms_at" timestamptz, "last_sms_status" text, "last_inbound_email_at" timestamptz, "last_outbound_email_at" timestamptz, "last_email_status" text, "callback_needed" boolean, "callback_due_at" timestamptz, "handoff_required" boolean, "assigned_staff" text, "call_route" text, "payment_status" text, "balance_due" numeric, "invoice_id" text, "notes" text, "special_instructions" text, "user_id" uuid, "business_id" bigint, "stripe_customer_id" text, "stripe_payment_method_id" text, "custom_fields" jsonb);
create table public."billing_overage_events" ("id" uuid, "user_id" uuid, "business_id" bigint, "stripe_customer_id" text, "stripe_invoice_id" text, "stripe_invoice_item_id" text, "billing_period_start" timestamptz, "billing_period_end" timestamptz, "overage_seconds" bigint, "billable_minutes" bigint, "amount_cents" bigint, "currency" text, "status" text, "error_message" text, "created_at" timestamptz, "reconciled_at" timestamptz);

alter table users add primary key(id);
alter table businesses add primary key(id);
create function public.claim_due_scenario_jobs(worker_id text,batch_size integer default 10)
 returns setof public.jobs language sql security definer as $$ select * from public.jobs $$;
insert into users(id,account_status) values
 ('11111111-1111-4111-8111-111111111111','active'),
 ('22222222-2222-4222-8222-222222222222','active'),
 ('33333333-3333-4333-8333-333333333333','closed');
insert into businesses(id,user_id) values
 (1,'11111111-1111-4111-8111-111111111111'),
 (2,'22222222-2222-4222-8222-222222222222'),
 (3,'33333333-3333-4333-8333-333333333333');
insert into people(id,user_id,business_id) values
 (1,'11111111-1111-4111-8111-111111111111',1),
 (2,'22222222-2222-4222-8222-222222222222',2),
 (3,'33333333-3333-4333-8333-333333333333',3);
grant all on all tables in schema public to anon,authenticated,service_role;
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' loop
 execute format('create policy legacy_allow_all on public.%I for all using(true) with check(true)',t.tablename);
 end loop;
end $$;
\ir ../sql/2026_09_03_phase1_security_containment.sql
\ir ../sql/2026_09_03_phase2_authorization.sql
\ir ../sql/2026_09_03_phase2_authorization.sql
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$ begin
 assert (select count(*) from people)=1,'cross-tenant read';
 assert (select count(*) from businesses)=1,'cross-tenant business';
 assert not nodemere_private.tenant_access('2','11111111-1111-4111-8111-111111111111'),'mixed ownership';
 begin update people set business_id=2 where id=1; raise exception 'ownership update accepted';
 exception when insufficient_privilege then null; end;
 begin insert into people(id,business_id,user_id) values(9,2,auth.uid()); raise exception 'foreign insert accepted';
 exception when insufficient_privilege then null; end;
 update people set first_name='Synthetic' where id=1;
 assert (select first_name from people where id=1)='Synthetic','legitimate update';
 begin update users set plan='enterprise' where id=auth.uid(); raise exception 'billing elevation accepted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
do $$ begin
 assert (select count(*) from people)=0,'closed account reads';
 assert (select count(*) from businesses)=0,'closed account business';
end $$;
reset role;
set role anon;
do $$ begin assert (select count(*) from people)=0,'anonymous people'; end $$;
reset role;
\echo 'PASS: Phase 2 SQL owner isolation, mismatched ownership, protected fields, closed accounts, anonymous denial, idempotence'
