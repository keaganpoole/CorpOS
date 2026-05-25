# TOOLS.md — Max (COO) Local Notes

## Discord Configuration

### Channels
- **Team CorpOS:** `1487477234401939546` — Primary hub. All briefings, updates, acks.
- **Situation Room:** `1488327248154202156` — Retired. Do not post here.

### Discord Bot
- **App ID:** 1488338905668386937
- **Token:** env var `DISCORD_BOT_TOKEN_MAX`
- **Username:** max#2325

### Discord Webhooks
- **Yanna (Team CorpOS):** env var `DISCORD_WEBHOOK_YANNA`
- **Yanna (Situation Room — legacy):** env var `DISCORD_WEBHOOK_YANNA_SITUATION_ROOM`
- **Yanna Avatar:** env var `DISCORD_WEBHOOK_AVATAR_YANNA`

## Script Reference

All scripts are in `skills/<skill>/scripts/`. Run with:
```
powershell -ExecutionPolicy Bypass -File scripts/<script>.ps1 -Action <action> [params]
```

### supabase-api
| Script | Actions |
|--------|---------|
| campaigns.ps1 | list, get, create, update, assign, unassign |
| leads.ps1 | list, get, update, search, stats |
| tasks.ps1 | list, get, create, update, complete |
| agents.ps1 | list, get, update |
| reactions.ps1 | log, list |

### discord
| Script | Actions |
|--------|---------|
| discord.ps1 | send, reply, react, delete, history |

## Supabase

- **URL:** env var `SUPABASE_URL`
- **Anon Key:** env var `SUPABASE_ANON_KEY`
- **Tables:** research_campaigns, leads, tasks, agents, reactions

## Sub-Agent Spawn Protocol

### Spawning Yanna

```
sessions_spawn(
  task: "<dispatch instructions>",
  label: "yanna",
  cwd: "C:\Users\vboxuser\.openclaw\workspaces\workspace-yanna",
  model: "<from GET /api/agents>"
)
```

- `cwd` required — without it, Yanna inherits Max's workspace and loads his skills
- `model` — query Supabase agents table, read Yanna's `model` field
- Do NOT run `openclaw models set` for sub-agents (changes global model)

### Yanna's Skills (auto-discovered with correct cwd)

- supabase-api — campaigns, leads, tasks, agents CRUD
- web-research — Google Search + Maps via agent-browser
- website-audit — site evaluation, scoring, Discovery
- discord — webhook posting to Team CorpOS

### Dispatch Task Template

```
You've been dispatched on a research campaign. Here are the details:

Campaign: [Campaign Name]
Industry: [Target Industry]
Location: [Target State(s)] — [Target City(s)]
Goal: [Lead Count Goal] leads
Special Instructions: [any notes]

Workflow:
1. Pull campaign data (supabase-api)
2. Source businesses (web-research)
3. Audit each site (website-audit)
4. Save qualified leads (supabase-api)
5. Post updates to Team CorpOS after every lead (discord)

Start now. Post an ack to Team CorpOS before you begin.
```

## Zone and Stage Reference

| Zone | Intensity |
|------|-----------|
| 1-2 | Low — passive monitoring |
| 3-4 | Medium — active research |
| 5-6 | High — aggressive pursuit |
| 7 | Override — all bots cease |

| Stage | Autonomy |
|-------|----------|
| Blue | Follow instructions strictly |
| Red | Use discretion, act on historical data |

## Telegram Policy

- Only Max may use Telegram, and only when Keagan explicitly directs it.
- No other agent uses Telegram. Discord is the only channel.
