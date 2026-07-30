alter table public.account_settings
add column if not exists autonomy_index integer not null default 1;

alter table public.account_settings
drop constraint if exists account_settings_autonomy_index_check;

alter table public.account_settings
add constraint account_settings_autonomy_index_check
check (autonomy_index between 1 and 5);
