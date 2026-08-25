-- Customer Experience Feedback. One questionnaire record is allowed per
-- business for this version, which makes the reward idempotent by design.

begin;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id bigint not null references public.businesses(id) on delete cascade,
  questionnaire_version text not null default 'customer-experience-v1',
  questionnaire_state text not null default 'eligible',
  completion_status text not null default 'incomplete',
  answers jsonb not null default '{}'::jsonb,
  overall_rating smallint null,
  pricing_rating smallint null,
  pricing_value text null,
  improvement_areas text[] not null default '{}',
  improvement_other text null,
  receptionist_quality jsonb not null default '{}'::jsonb,
  ai_vs_human_preference smallint null,
  idea text null,
  plan text null,
  account_age_days integer null,
  usage_context jsonb not null default '{}'::jsonb,
  discount_eligible boolean not null default false,
  discount_granted boolean not null default false,
  discount_granted_at timestamptz null,
  snoozed_until timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_questionnaire_state_check check (
    questionnaire_state in ('eligible', 'shown', 'postponed', 'declined', 'started', 'completed', 'discount_granted')
  ),
  constraint reviews_completion_status_check check (completion_status in ('incomplete', 'completed')),
  constraint reviews_answers_object_check check (jsonb_typeof(answers) = 'object'),
  constraint reviews_usage_context_object_check check (jsonb_typeof(usage_context) = 'object'),
  constraint reviews_receptionist_quality_object_check check (jsonb_typeof(receptionist_quality) = 'object'),
  constraint reviews_overall_rating_check check (overall_rating is null or overall_rating between 0 and 10),
  constraint reviews_pricing_rating_check check (pricing_rating is null or pricing_rating between 0 and 10),
  constraint reviews_ai_vs_human_preference_check check (ai_vs_human_preference is null or ai_vs_human_preference between 0 and 10),
  constraint reviews_business_unique unique (business_id)
);

create index if not exists reviews_user_created_at_idx
  on public.reviews (user_id, created_at desc);

create index if not exists reviews_business_state_idx
  on public.reviews (business_id, questionnaire_state);

create or replace function public.set_reviews_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_reviews_updated_at();

-- Keep the migration safe for an already-created test table.
do $$
begin
  if to_regclass('public.reviews') is not null then
    alter table public.reviews add column if not exists pricing_rating smallint null;
    alter table public.reviews add column if not exists receptionist_quality jsonb not null default '{}'::jsonb;
    alter table public.reviews add column if not exists ai_vs_human_preference smallint null;
    alter table public.reviews drop constraint if exists reviews_pricing_rating_check;
    alter table public.reviews add constraint reviews_pricing_rating_check check (pricing_rating is null or pricing_rating between 0 and 10);
    alter table public.reviews drop constraint if exists reviews_ai_vs_human_preference_check;
    alter table public.reviews add constraint reviews_ai_vs_human_preference_check check (ai_vs_human_preference is null or ai_vs_human_preference between 0 and 10);
  end if;
end;
$$;

create or replace function public.protect_review_completion()
returns trigger
language plpgsql
as $$
declare
  improvement_areas jsonb;
begin
  if new.completion_status = 'completed' then
    if coalesce(new.answers->>'overall_experience', '') !~ '^(10|[0-9])$'
      or coalesce(new.answers->>'user_friendliness', '') !~ '^(10|[0-9])$'
      or coalesce(new.answers->>'user_interface', '') !~ '^(10|[0-9])$'
      or coalesce(new.answers->>'reliability', '') !~ '^(10|[0-9])$'
      or coalesce(new.answers->>'pricing_rating', '') !~ '^(10|[0-9])$'
      or coalesce(new.answers->>'receptionist_voice', '') !~ '^(10|[0-9])$'
      or coalesce(new.answers->>'receptionist_knowledge', '') !~ '^(10|[0-9])$'
      or coalesce(new.answers->>'receptionist_representation', '') !~ '^(10|[0-9])$'
      or coalesce(new.answers->>'receptionist_personality', '') !~ '^(10|[0-9])$'
      or coalesce(new.answers->>'ai_vs_human_preference', '') !~ '^(10|[0-9])$'
    then
      raise exception 'All required feedback ratings and pricing answers must be completed';
    end if;

    improvement_areas := coalesce(new.answers->'improvement_areas', '[]'::jsonb);
    if jsonb_typeof(improvement_areas) <> 'array' or jsonb_array_length(improvement_areas) = 0 then
      raise exception 'At least one improvement area is required';
    end if;

    if improvement_areas @> '["Other"]'::jsonb
      and nullif(trim(coalesce(new.answers->>'improvement_other', '')), '') is null
    then
      raise exception 'Other improvement feedback is required';
    end if;

    if coalesce(new.answers->>'idea_dont_know', 'false') <> 'true'
      and nullif(trim(coalesce(new.answers->>'idea', '')), '') is null
    then
      raise exception 'An idea or the I don’t know option is required';
    end if;

    new.questionnaire_state = 'discount_granted';
    new.discount_eligible = true;
    new.discount_granted = true;
    new.discount_granted_at = coalesce(
      case when tg_op = 'UPDATE' then old.discount_granted_at else null end,
      new.discount_granted_at,
      now()
    );
    new.overall_rating = (new.answers->>'overall_experience')::smallint;
  end if;

  if tg_op = 'UPDATE' and old.discount_granted then
    new.discount_eligible = true;
    new.discount_granted = true;
    new.discount_granted_at = old.discount_granted_at;
    new.completion_status = 'completed';
    new.questionnaire_state = 'discount_granted';
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_protect_completion on public.reviews;
create trigger reviews_protect_completion
before insert or update on public.reviews
for each row execute function public.protect_review_completion();

alter table public.reviews enable row level security;

drop policy if exists "users can read own customer feedback" on public.reviews;
create policy "users can read own customer feedback"
on public.reviews for select
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.businesses b
    where b.id = reviews.business_id and b.user_id = auth.uid()
  )
);

drop policy if exists "users can insert own customer feedback" on public.reviews;
create policy "users can insert own customer feedback"
on public.reviews for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.businesses b
    where b.id = reviews.business_id and b.user_id = auth.uid()
  )
);

drop policy if exists "users can update own customer feedback" on public.reviews;
create policy "users can update own customer feedback"
on public.reviews for update
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.businesses b
    where b.id = reviews.business_id and b.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.businesses b
    where b.id = reviews.business_id and b.user_id = auth.uid()
  )
);

commit;
