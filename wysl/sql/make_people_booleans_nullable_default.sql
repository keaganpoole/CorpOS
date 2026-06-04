alter table public.people
  alter column consent_sms drop default,
  alter column consent_call drop default,
  alter column do_not_call drop default,
  alter column do_not_text drop default,
  alter column callback_needed drop default,
  alter column handoff_required drop default;
