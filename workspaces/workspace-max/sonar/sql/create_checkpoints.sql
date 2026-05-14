CREATE TABLE IF NOT EXISTS public.checkpoints (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  user_id uuid NULL,
  receptionist_id bigint NULL,
  scenario_id text NOT NULL,
  trigger_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_user_id_created_at
  ON public.checkpoints (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkpoints_receptionist_id_created_at
  ON public.checkpoints (receptionist_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkpoints_scenario_id_created_at
  ON public.checkpoints (scenario_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkpoints_trigger_key_created_at
  ON public.checkpoints (trigger_key, created_at DESC);
