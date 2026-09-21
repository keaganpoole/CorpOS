-- Voice Design has no source speaker and requires no cloning contract.
-- Preserve the mandatory contract for every existing/new cloned voice.
begin;
alter table public.custom_voices add column if not exists voice_source text not null default 'voice_clone';
alter table public.custom_voices alter column contract_id drop not null;
alter table public.custom_voices drop constraint if exists custom_voices_source_contract_check;
alter table public.custom_voices add constraint custom_voices_source_contract_check
  check ((voice_source = 'voice_clone' and contract_id is not null)
      or (voice_source = 'voice_design' and contract_id is null and user_id is not null and business_id is not null));
comment on column public.custom_voices.voice_source is 'Explicit provenance: consent-backed clone or text-designed voice. Existing tenant RLS is unchanged.';
commit;
