ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS forwarding_config jsonb NOT NULL DEFAULT '{"version":1,"numbers":[],"active_number_id":null}'::jsonb;
