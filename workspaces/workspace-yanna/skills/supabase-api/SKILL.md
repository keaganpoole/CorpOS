---
name: supabase-api
description: Query and update Supabase tables (research_campaigns, leads, tasks, agents) using the Supabase REST API. Use when Yanna needs to fetch campaign criteria, create or search leads, check for duplicates, update task status, or read agent data. Triggers on any mention of Supabase, campaigns, leads, tasks, agents, duplicates, or research workflow CRUD operations.
---

# Supabase API

Direct Supabase access via PostgREST. Credentials: `SUPABASE_URL` and `SUPABASE_ANON_KEY` env vars.

## Scripts

All scripts are PowerShell. Run with `exec`. Skill directory: resolve paths relative to this skill's `scripts/` folder.

### campaigns.ps1 — Research Campaigns

```
powershell -ExecutionPolicy Bypass -File scripts/campaigns.ps1 -Action <action> [params]
```

| Action | Params | Use |
|--------|--------|-----|
| list | — | Get all campaigns |
| get | -Id | Get single campaign |
| update | -Id [-Status] [-AssignedTo] [-Fields JSON] | Update any fields |
| assign | -Id -AssignedTo | Assign campaign to agent + set Status=Assigned |

**Workflow:**
1. `list` → find campaigns with Status = Unassigned or Assigned (to you)
2. `assign` → claim a campaign
3. `update -Id <id> -Status Active` → when starting work
4. `update -Id <id> -Status Completed` → when goal met
5. `update -Id <id> -Status Failed` → if blocked

### leads.ps1 — Leads

```
powershell -ExecutionPolicy Bypass -File scripts/leads.ps1 -Action <action> [params]
```

| Action | Params | Use |
|--------|--------|-----|
| list | [-Limit] | Get recent leads |
| get | -Id | Get single lead |
| create | -Fields JSON | Create new lead |
| update | -Id -Fields JSON | Update existing lead |
| search | -Company [-Limit] | Search by company name (case-insensitive) |
| check-duplicate | -Company -State | Check if lead exists before creating |

**Duplicate detection — ALWAYS run before create:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/leads.ps1 -Action check-duplicate -Company "Acme Co" -State "ME"
```
- Output `NO_DUPLICATE` → safe to create
- Output `DUPLICATE: ...` → skip, already exists

**Create a lead:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/leads.ps1 -Action create -Fields '{"company":"Acme","state":"ME","industry":"Retail","email":"x@x.com","phone":"555-0100","discovery":"Bad mobile site","source":"Google Maps","status":"analyzing","created_by":"Yanna","updated_by":"Yanna"}'
```

**Required fields for create:** company, state, industry, email or phone, discovery, source, status, created_by, updated_by

**Lead Status:**
- `Analyzing` — Lead just saved, being evaluated
- `Aware` — Lead knows about us
- `Contacted` — We've reached out
- Other statuses as needed

**Update a lead (e.g. change status, add notes):**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/leads.ps1 -Action update -Id "<uuid>" -Fields '{"status":"Contacted","notes":"Left voicemail","updated_by":"Yanna"}'
```

### tasks.ps1 — Tasks

```
powershell -ExecutionPolicy Bypass -File scripts/tasks.ps1 -Action <action> [params]
```

| Action | Params | Use |
|--------|--------|-----|
| list | [-Team] [-Status] | Get tasks, optionally filtered |
| get | -Id | Get single task |
| create | -Fields JSON | Create new task |
| update | -Id -Fields JSON | Update task (status, notes, etc.) |

**Update task status:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/tasks.ps1 -Action update -Id "<uuid>" -Fields '{"status":"in progress","updated_by":"Yanna"}'
```

**Update subtasks (JSON array):**
The `subtasks` field is a JSON array. Update it by fetching the current array, modifying it, then saving the entire array back.

**Step 1: Get current task with subtasks**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/tasks.ps1 -Action get -Id "<task_id>"
```

**Step 2: Modify subtasks array**
Add new subtask, mark as complete, etc. Example subtask structure:
```json
{
  "id": "subtask-uuid-or-string",
  "text": "Audit website for Acme Co",
  "status": "pending"
}
```

**Step 3: Update task with new subtasks array**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/tasks.ps1 -Action update -Id "<task_id>" -Fields '{"subtasks":[{"id":"subtask-1","text":"Research businesses in ME","status":"done"},{"id":"subtask-2","text":"Audit website for Acme Co","status":"in progress"}],"updated_by":"Yanna"}'
```

**Mandatory Task Update Workflow:**
1. **On Task Start**: Update status to "in progress", create subtasks array
2. **Per Lead**: Update subtask status (pending → working → done)
3. **On Completion**: Set main task status to "completed" + `completion_date`
4. **If Blocked**: Set status to "warning" AND alert Max immediately
5. **Always**: Include `updated_by="Yanna"` in every update

### agents.ps1 — Agents

```
powershell -ExecutionPolicy Bypass -File scripts/agents.ps1 -Action <action> [params]
```

| Action | Params | Use |
|--------|--------|-----|
| list | — | Get all agents |
| get | -Id | Get single agent |
| update | -Id -Fields JSON | Update agent status/activity |

**Update your status:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/agents.ps1 -Action update -Id "yanna" -Fields '{"status":"active","current_activity":"Researching retail leads in ME"}'
```

## Attribution

Always set `created_by` and `updated_by` to `"Yanna"` when creating or updating any record.

## Schema Reference

See `references/schema.md` for full column definitions on all four tables.

## Direct API (Fallback)

If scripts are unavailable, use raw Supabase REST. Example:
```powershell
$key = $env:SUPABASE_ANON_KEY
Invoke-RestMethod -Uri "$($env:SUPABASE_URL)/rest/v1/leads?select=*&limit=10" -Headers @{"apikey"=$key;"Authorization"="Bearer $key"}
```

## Task Update Protocol
Yanna MUST update the task she is working on as she progresses. This is mandatory for transparency and tracking.

**On Task Start:**
1. Get the assigned task (list/filter by status "queued")
2. Update task status to "in progress"
3. Create subtasks array with at least one subtask (more if needed for the workflow)
4. Set `updated_by="Yanna"`
5. **Mandatory:** Post Team CorpOS update acknowledging task and Max's briefing before starting research

**As You Work:**
- Update subtask status from "pending" → "working" → "done"
- Add `completed_at` timestamp when done
- Keep `updated_by="Yanna"` on every update
- Update main task status as you progress through subtasks
- Post progress updates to Team CorpOS as work progresses

**On Task Completion:**
- Set main task status to "completed"
- Set `completion_date` timestamp
- Update `updated_by="Yanna"`
- Post completion update to Team CorpOS

Example subtask structure:
```json
{
 "id": "st-1",
 "task": "Source businesses",
 "status": "completed",
 "assigned_to": "Yanna",
 "completed_at": "2026-04-08T21:35:00Z"
}
```

**Subtask Structure Requirements:**
- **Must have at least 1 subtask per task** — Create more than 1 subtask if it makes sense for the things you are doing
- **Required fields:** `id`, `task`, `status`, `assigned_to`
- **Optional field:** `completed_at` (set when status = "completed")
- **Status values:** `queued`, `in progress`, `completed`, `skipped`
- **Always assign to Yanna** — Use `assigned_to: "Yanna"` for all subtasks
```

## Duplicate Detection (Cross-Table)

Before saving any lead:
1. Check `prospects.json` in workspace root — if company+state exists, skip (already evaluated, not a relic)
2. Run `leads.ps1 -Action check-duplicate -Company <name> -State <state>` — if exists, skip
3. If unsure, flag for Max — never auto-discard

## Campaign Workflow Integration

Full research loop:
1. `campaigns.ps1 list` → find assigned campaign
2. Read campaign criteria (industry, states, cities, goal)
3. Source leads (Google Search, Google Maps)
4. For each business: audit website → score → `check-duplicate` → `leads.ps1 create`
5. Update campaign lead count or status as you go
6. `campaigns.ps1 update -Id <id> -Status Completed` when goal met

## Task & Subtask Updates

### Update Task Status
Always update task status as you work. Example:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/tasks.ps1 -Action update -Id "<task_id>" -Fields '{"status":"in progress","updated_by":"Yanna"}'
```

### Update Subtasks (JSON array)
The `subtasks` field is a JSON array. Update it by fetching the current array, modifying it, then saving the entire array back.

**Step 1: Get current task with subtasks**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/tasks.ps1 -Action get -Id "<task_id>"
```

**Step 2: Modify subtasks array**
Add new subtask, mark as complete, etc. Example subtask structure:
```json
{
 "id": "st-1",
 "task": "Source businesses",
 "status": "completed",
 "assigned_to": "Yanna",
 "completed_at": "2026-04-08T21:35:00Z"
}
```
```

**Step 3: Update task with new subtasks array**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/tasks.ps1 -Action update -Id "<task_id>" -Fields '{"subtasks":[{"id":"subtask-1","text":"Research businesses in ME","status":"done"},{"id":"subtask-2","text":"Audit website for Acme Co","status":"in progress"}],"updated_by":"Yanna"}'
```

**Workflow:**
- When starting a task: Create subtasks for each lead to research
- As you complete each lead: Update subtask status to "done"
- Always include `updated_by="Yanna"` in every update

### Example: Full task workflow
```powershell
# 1. Get assigned task
powershell -ExecutionPolicy Bypass -File scripts/tasks.ps1 -Action list -Team "Research Team" -Status "queued"

# 2. Update task to "in progress" when starting
powershell -ExecutionPolicy Bypass -File scripts/tasks.ps1 -Action update -Id "<task_id>" -Fields '{"status":"in progress","updated_by":"Yanna"}'

# 3. Create subtasks for each business to research (example)
powershell -ExecutionPolicy Bypass -File scripts/tasks.ps1 -Action update -Id "<task_id>" -Fields '{"subtasks":[{"id":"st-1","task":"Source businesses","status":"completed","assigned_to":"Yanna","completed_at":"2026-04-08T21:35:00Z"},{"id":"st-2","task":"Audit websites","status":"in progress","assigned_to":"Yanna","completed_at":null},{"id":"st-3","task":"Save qualified leads","status":"queued","assigned_to":"Yanna","completed_at":null}],"updated_by":"Yanna"}'

# 4. As you complete each: update subtask status + overall task progress
powershell -ExecutionPolicy Bypass -File scripts/tasks.ps1 -Action update -Id "<task_id>" -Fields '{"subtasks":[{"id":"st-1","task":"Source businesses","status":"completed","assigned_to":"Yanna","completed_at":"2026-04-08T21:35:00Z"},{"id":"st-2","task":"Audit websites","status":"in progress","assigned_to":"Yanna","completed_at":null},{"id":"st-3","task":"Save qualified leads","status":"queued","assigned_to":"Yanna","completed_at":null}],"updated_by":"Yanna"}'

# 5. When task is fully complete
powershell -ExecutionPolicy Bypass -File scripts/tasks.ps1 -Action update -Id "<task_id>" -Fields '{"status":"done","completion_date":"2026-04-07T22:00:00Z","updated_by":"Yanna"}'
```

### Key Points
- **Task status**: `queued`, `in progress`, `completed`, `failed`
- **Subtask status**: `pending`, `working`, `done`, `skipped`
- **Always update**: Task progress and subtasks as you work — not just at the end
- **Never skip**: Updating the task table is mandatory for transparency



