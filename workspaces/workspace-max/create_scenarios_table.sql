-- SQL to create scenarios table in Supabase
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS scenarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  nodes_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own scenarios" ON scenarios
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own scenarios" ON scenarios
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own scenarios" ON scenarios
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own scenarios" ON scenarios
  FOR DELETE USING (auth.uid() = created_by);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scenarios_created_by ON scenarios(created_by);
CREATE INDEX IF NOT EXISTS idx_scenarios_status ON scenarios(status);

-- Verify
SELECT * FROM scenarios LIMIT 5;
