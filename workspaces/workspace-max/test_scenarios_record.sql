-- Test record for scenarios table in Supabase
-- Run this in the Supabase SQL Editor AFTER creating the scenarios table

INSERT INTO scenarios (
  name,
  description,
  nodes_data,
  edges_data,
  status
) VALUES (
  'Test Scenario - New Lead Follow-up',
  'Automatically send SMS to new leads within 5 minutes',
  '[
    {
      "id": "node-1",
      "x": 200,
      "y": 150,
      "type": "trigger",
      "label": "New Lead",
      "detail": "Phone Calls",
      "configured": true,
      "accent": "#32f0d9"
    },
    {
      "id": "node-2",
      "x": 400,
      "y": 150,
      "type": "action",
      "label": "Send SMS",
      "detail": "Text Messages",
      "configured": true,
      "accent": "#38bdf8"
    }
  ]'::jsonb,
  '[
    {
      "id": "edge-1",
      "from": "node-1",
      "to": "node-2",
      "filter": {
        "label": "Condition",
        "rules": [
          {
            "id": 1,
            "variable": "status",
            "operator": "equals",
            "value": "new"
          }
        ]
      }
    }
  ]'::jsonb,
  'active'
);

-- Verify the record was inserted
SELECT * FROM scenarios ORDER BY created_at DESC LIMIT 5;
