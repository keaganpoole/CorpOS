CREATE TABLE IF NOT EXISTS public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'elevenlabs',
  ADD COLUMN IF NOT EXISTS external_call_id text NULL,
  ADD COLUMN IF NOT EXISTS conversation_id text NULL,
  ADD COLUMN IF NOT EXISTS elevenlabs_agent_id text NULL,
  ADD COLUMN IF NOT EXISTS hired_receptionist_id bigint NULL,
  ADD COLUMN IF NOT EXISTS user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS receptionist_name text NULL,
  ADD COLUMN IF NOT EXISTS scenario_id text NULL,
  ADD COLUMN IF NOT EXISTS from_number text NULL,
  ADD COLUMN IF NOT EXISTS to_number text NULL,
  ADD COLUMN IF NOT EXISTS started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS duration_seconds integer NULL,
  ADD COLUMN IF NOT EXISTS status text NULL,
  ADD COLUMN IF NOT EXISTS outcome text NULL,
  ADD COLUMN IF NOT EXISTS summary text NULL,
  ADD COLUMN IF NOT EXISTS transcript_text text NULL,
  ADD COLUMN IF NOT EXISTS sentiment text NULL,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'call_logs'
      AND column_name = 'hired_receptionist_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.call_logs
      ALTER COLUMN hired_receptionist_id TYPE bigint
      USING NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'call_logs_hired_receptionist_id_fkey'
  ) THEN
    ALTER TABLE public.call_logs
      ADD CONSTRAINT call_logs_hired_receptionist_id_fkey
      FOREIGN KEY (hired_receptionist_id)
      REFERENCES public.hired_receptionists(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_call_logs_user_id_created_at
  ON public.call_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_logs_hired_receptionist_id_created_at
  ON public.call_logs (hired_receptionist_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_logs_conversation_id
  ON public.call_logs (conversation_id);

CREATE INDEX IF NOT EXISTS idx_call_logs_external_call_id
  ON public.call_logs (external_call_id);
