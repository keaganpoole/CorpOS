-- Keep the live plan record aligned with the production pricing surface.
-- This changes display copy only; pricing, entitlements, and feature limits are unchanged.
update public.plans
set display = jsonb_set(
  jsonb_set(
    coalesce(display, '{}'::jsonb),
    '{description}',
    to_jsonb('A focused AI receptionist for ordinary front-desk work, general questions, and routine scheduling.'::text),
    true
  ),
  '{scope_note}',
  to_jsonb('Routine scheduling where permitted and where restricted information is not involved. Sensitive, confidential, regulated, protected, account-specific, or identity-dependent requests must be routed to an authorized person unless separately approved.'::text),
  true
)
where lower(name) = 'essentials';
