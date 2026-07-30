-- Targeted indexes for the dashboard query shapes. These preserve existing
-- RLS policies and only improve tenant-scoped lookups/orderings.
create index if not exists hired_receptionists_user_hired_at_idx
  on public.hired_receptionists (user_id, hired_at desc);

create index if not exists hired_receptionists_business_active_idx
  on public.hired_receptionists (business_id, is_active);

create index if not exists scenarios_user_updated_at_idx
  on public.scenarios (user_id, updated_at desc);

create index if not exists scenarios_created_by_updated_at_idx
  on public.scenarios (created_by, updated_at desc);

create index if not exists people_schema_business_active_position_idx
  on public.people_schema (business_id, is_active, position, created_at);

create index if not exists businesses_user_created_at_idx
  on public.businesses (user_id, created_at);

create index if not exists integrations_user_provider_idx
  on public.integrations (user_id, provider);
