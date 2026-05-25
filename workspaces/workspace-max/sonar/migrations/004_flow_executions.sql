-- Flow Executions table — tracks running/paused/completed scenario flows
CREATE TABLE IF NOT EXISTS flow_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running',  -- running, paused, completed, failed
  current_node_id TEXT,
  flow_context JSONB DEFAULT '{}',
  trigger_event JSONB DEFAULT '{}',
  pause_data JSONB DEFAULT '{}',
  error TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for finding running/paused executions per scenario
CREATE INDEX IF NOT EXISTS idx_flow_executions_scenario ON flow_executions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_status ON flow_executions(status);

-- Scenarios table: add new columns if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scenarios' AND column_name = 'is_active') THEN
    ALTER TABLE scenarios ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scenarios' AND column_name = 'schedule_config') THEN
    ALTER TABLE scenarios ADD COLUMN schedule_config JSONB DEFAULT '{}';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scenarios' AND column_name = 'notes') THEN
    ALTER TABLE scenarios ADD COLUMN notes TEXT DEFAULT '';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scenarios' AND column_name = 'last_fired_at') THEN
    ALTER TABLE scenarios ADD COLUMN last_fired_at TIMESTAMPTZ;
  END IF;
END $$;

-- Enable row level security (allow all for now)
ALTER TABLE flow_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON flow_executions FOR ALL USING (true);
