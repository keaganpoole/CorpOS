-- Create scenarios table in Supabase
-- Run this in the Supabase SQL Editor

DROP TABLE IF EXISTS public.scenarios CASCADE;

CREATE TABLE public.scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  nodes_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT scenarios_pkey PRIMARY KEY (id),
  CONSTRAINT scenarios_status_check CHECK (
    status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text])
  )
);

-- Add foreign key constraint after table is created
ALTER TABLE public.scenarios ADD CONSTRAINT scenarios_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scenarios_created_by ON public.scenarios(created_by);
CREATE INDEX IF NOT EXISTS idx_scenarios_status ON public.scenarios(status);

-- Verify table creation
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'scenarios'
ORDER BY ordinal_position;
