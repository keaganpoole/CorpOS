-- SQL command to add a test task with subtasks to the tasks table in Supabase
-- Run this in the Supabase SQL Editor

-- Insert test task with subtasks
INSERT INTO tasks (
  task,
  notes,
  assigned_team,
  status,
  created_by,
  updated_by,
  subtasks,
  start_date,
  due_date
) VALUES (
  'Test Task with Subtasks',
  'This is a test task to verify subtask functionality',
  'Research Team',
  'queued',
  'Max',
  'Max',
  '[
    {"id": "1", "title": "Research businesses in Worcester MA", "status": "pending"},
    {"id": "2", "title": "Audit website for Acme Co", "status": "pending"},
    {"id": "3", "title": "Audit website for Beta Inc", "status": "pending"}
  ]'::jsonb,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '1 day'
);

-- Verify the record
SELECT * FROM tasks ORDER BY created_at DESC LIMIT 5;
