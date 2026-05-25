-- Migration: Add user_id foreign key to all tables
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Step 1: Add user_id columns (nullable first for backfill)

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE hired_receptionists ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE services ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE people ADD COLUMN IF NOT EXISTS user_id uuid;

-- Step 2: Backfill existing data with the first user's ID
-- This assumes a single user exists for now. Multi-tenant will handle this differently.

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM users LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    UPDATE businesses SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE hired_receptionists SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE services SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE appointments SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE people SET user_id = v_user_id WHERE user_id IS NULL;
    
    RAISE NOTICE 'Backfilled all tables with user_id: %', v_user_id;
  ELSE
    RAISE NOTICE 'No users found — skipping backfill';
  END IF;
END $$;

-- Step 3: Add foreign key constraints

ALTER TABLE businesses
  ADD CONSTRAINT businesses_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE hired_receptionists
  ADD CONSTRAINT hired_receptionists_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE services
  ADD CONSTRAINT services_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE people
  ADD CONSTRAINT people_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 4: Make user_id NOT NULL (after backfill)

ALTER TABLE businesses ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE hired_receptionists ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE services ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE appointments ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE people ALTER COLUMN user_id SET NOT NULL;

-- Step 5: Add indexes for query performance

CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_hired_receptionists_user_id ON hired_receptionists(user_id);
CREATE INDEX IF NOT EXISTS idx_services_user_id ON services(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_people_user_id ON people(user_id);

-- Verify
SELECT 
  'businesses' as table_name, count(*) as total, count(user_id) as with_user_id FROM businesses
UNION ALL
SELECT 'hired_receptionists', count(*), count(user_id) FROM hired_receptionists
UNION ALL
SELECT 'services', count(*), count(user_id) FROM services
UNION ALL
SELECT 'appointments', count(*), count(user_id) FROM appointments
UNION ALL
SELECT 'people', count(*), count(user_id) FROM people;
