-- Test record with random subtask statuses
-- Run in Supabase SQL Editor

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
  'Test Task with Random Subtask Statuses',
  'Testing subtask status variations',
  'Research Team',
  'in progress',
  'Max',
  'Max',
  '[
    {"id": "1", "title": "Subtask completed", "status": "done", "completed_at": "2026-04-07T20:00:00Z"},
    {"id": "2", "title": "Subtask in progress", "status": "working", "started_at": "2026-04-07T21:00:00Z"},
    {"id": "3", "title": "Subtask pending", "status": "pending"},
    {"id": "4", "title": "Subtask skipped", "status": "skipped"}
  ]'::jsonb,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '1 day'
);

-- Verify the record
SELECT * FROM tasks ORDER BY created_at DESC LIMIT 5;
