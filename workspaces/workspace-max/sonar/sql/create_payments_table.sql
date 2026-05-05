-- Payments table for Sonar scenarios
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/grpgmhhtmfiwukncucaq/editor

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  person_id BIGINT REFERENCES people(id) ON DELETE SET NULL,
  appointment_id UUID,
  scenario_id UUID,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_session_id TEXT,
  amount BIGINT NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'partial_refund')),
  payment_method TEXT,
  description TEXT,
  receipt_url TEXT,
  refunded_amount BIGINT DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_payments_person_id ON payments(person_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- Enable RLS (optional, matches existing table patterns)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow anon access (matches existing tables)
CREATE POLICY "Allow anon access" ON payments FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();
