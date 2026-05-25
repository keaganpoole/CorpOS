---
name: supabase-api
description: Query and update Supabase tables (research_campaigns, leads, tasks, agents, reactions) via the Supabase REST API. Use when Max needs to create campaigns, assign work to agents, monitor lead pipeline, manage tasks, update agent status, or log reactions. Triggers on any mention of Supabase, campaigns, leads, tasks, agents, reactions, assigning work, pipeline, or system oversight CRUD operations.
---

# Supabase API

Direct Supabase access via PostgREST. Credentials: `SUPABASE_URL` and `SUPABASE_ANON_KEY` env vars.

## Scripts

All scripts are PowerShell. Run with `exec`. Resolve paths relative to this skill's `scripts/` folder.

### campaigns.ps1 — Research Campaigns

```
powershell -ExecutionPolicy Bypass -File scripts/campaigns.ps1 -Action <action> [params]
```

| Action | Params | Use |
|--------|--------|-----|
| list | — | Get all campaigns |
| get | -Id | Get single campaign |
| create | -Fields JSON | Create new campaign |
| update | -Id [-Status] [-AssignedTo] [-Fields JSON] | Update fields |
| assign | -Id -AssignedTo | Assign to agent + set Status=Assigned |
| unassign | -Id | Clear assignment + set Status=Unassigned |

**Create a campaign:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/campaigns.ps1 -Action create -Fields '{"Campaign Name":"Retail Blitz","Target Industry":"Retail","Target State(s)":"ME","Lead Count Goal":10,"Status":"Unassigned","created_by":"Max","updated_by":"Max"}'
```

**Assign to Yanna:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/campaigns.ps1 -Action assign -Id "<uuid>" -AssignedTo "Yanna"
```

### leads.ps1 — Leads (Oversight)

Max monitors and updates leads. Yanna handles creation.

```
powershell -ExecutionPolicy Bypass -File scripts/leads.ps1 -Action <action> [params]
```

| Action | Params | Use |
|--------|--------|-----|
| list | [-Status] [-Limit] | Get leads, optionally filtered |
| get | -Id | Get single lead |
| update | -Id -Fields JSON | Update lead fields |
| search | -Company [-Limit] | Search by company name |
| stats | — | Pipeline overview (total, by status, avg score) |

**Pipeline overview:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/leads.ps1 -Action stats
```

### tasks.ps1 — Tasks

```
powershell -ExecutionPolicy Bypass -File scripts/tasks.ps1 -Action <action> [params]
```

| Action | Params | Use |
|--------|--------|-----|
| list | [-Team] [-Status] | Get tasks |
| get | -Id | Get single task |
| create | -Fields JSON | Create new task |
| update | -Id -Fields JSON | Update task |
| complete | -Id | Mark completed (sets completion_date) |

**Create a task for Research Team:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/tasks.ps1 -Action create -Fields '{"task":"Fetch leads","notes":"Pull 10 leads from Kickstarter campaign","assigned_team":"Research Team","start_date":"2026-04-08","due_date":"2026-04-09","status":"queued","created_by":"Max"}'
```

### agents.ps1 — Agents

```
powershell -ExecutionPolicy Bypass -File scripts/agents.ps1 -Action <action> [params]
```

| Action | Params | Use |
|--------|--------|-----|
| list | — | Get all agents |
| get | -Id | Get single agent |
| update | -Id -Fields JSON | Update agent data |

**Update agent status/activity:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/agents.ps1 -Action update -Id "yanna" -Fields '{"status":"active","current_activity":"Researching ME retail"}'
```

**Change agent model:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/agents.ps1 -Action update -Id "yanna" -Fields '{"model":"openrouter/google/gemini-2.0-flash-001"}'
```

### reactions.ps1 — Reactions (Feedback Loop)

```
powershell -ExecutionPolicy Bypass -File scripts/reactions.ps1 -Action <action> [params]
```

| Action | Params | Use |
|--------|--------|-----|
| log | -AgentName -Type [-Context] | Log compliment or complaint |
| list | [-AgentName] | Get reaction history |

**Log a complaint:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/reactions.ps1 -Action log -AgentName "Yanna" -Type "complaint" -Context "Missed duplicate check on Big Company lead"
```

## Attribution

Always set `created_by` and `updated_by` to `"Max"` when creating or updating any record.

## Schema Reference

See `references/schema.md` for full column definitions on all five tables.

## Direct API (Fallback)

If scripts are unavailable, use raw Supabase REST:
```powershell
$key = $env:SUPABASE_ANON_KEY
Invoke-RestMethod -Uri "$($env:SUPABASE_URL)/rest/v1/agents?select=*" -Headers @{"apikey"=$key;"Authorization"="Bearer $key"}
```

## Campaign Management Workflow

1. `campaigns.ps1 create` → set industry, locations, goal
2. `campaigns.ps1 assign -Id <id> -AssignedTo Yanna` → dispatch
3. Monitor: `leads.ps1 stats` → track pipeline growth
4. `campaigns.ps1 update -Id <id> -Status Completed` → when goal met

## System Health Check

Quick dashboard via scripts:
1. `agents.ps1 list` → check all agent statuses
2. `tasks.ps1 list -Status "in progress"` → active work
3. `leads.ps1 stats` → pipeline health
4. `campaigns.ps1 list` → campaign statuses
