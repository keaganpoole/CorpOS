-- Store per-staff UI warning acknowledgements without adding one column per warning.
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS acknowledgements jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.staff.acknowledgements IS
  'Per-staff UI acknowledgement flags keyed by warning name.';
