-- Add test task with subtasks to tasks table
INSERT INTO tasks (
  task,
  notes,
  assigned_team,
  status,
  created_by,
  updated_by,
  subtasks
) VALUES (
  'Test Task',
  'Testing subtasks',
  'Research Team',
  'queued',
  'Max',
  'Max',
  '[{"id":"1","title":"Subtask 1","status":"pending"},{"id":"2","title":"Subtask 2","status":"pending"}]'
);

-- Verify the record was inserted
SELECT * FROM tasks ORDER BY created_at DESC LIMIT 5;
