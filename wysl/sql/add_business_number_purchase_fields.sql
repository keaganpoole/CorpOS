alter table public.businesses
add column if not exists elevenlabs_phone_number_id text,
add column if not exists twilio_number_purchase_count integer not null default 0,
add column if not exists twilio_number_quality_error text;
