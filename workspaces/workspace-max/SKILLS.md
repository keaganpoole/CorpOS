# SKILLS.md — Max (COO) Skills

## Available Skills

### Rollcall
- **Description:** Responds to the /rollcall command with a presence message
- **Location:** `skills/rollcall/`

### supabase-api
- **Description:** Query and update Supabase tables (campaigns, leads, tasks, agents, reactions)
- **Location:** `skills/supabase-api/`
- **Scripts:** campaigns.ps1, leads.ps1, tasks.ps1, agents.ps1, reactions.ps1

### discord
- **Description:** Send messages, reply, react, and read channel history via Max's bot
- **Location:** `skills/discord/`
- **Script:** discord.ps1

## Manual Ignition Protocol

When `/start_day` is issued:

### Phase 1: Assess
1. Check agents — `agents.ps1 list`
2. Check campaigns — `campaigns.ps1 list` → find Assigned or Active
3. Check tasks — `tasks.ps1 list -Status "in progress"`

### Phase 2: Brief
4. Post brief to Team CorpOS (see TOOLS.md for channel ID)
5. Include: Zone/Stage, active campaigns, Yanna's assignment, blockers
6. Wait for Keagan's go-ahead

### Phase 3: Dispatch
7. Spawn Yanna with campaign task (see TOOLS.md for spawn protocol)
8. Yanna acks in Team CorpOS → begins research
9. Monitor via `leads.ps1 stats`

**Rules:**
- Never dispatch before briefing Keagan
- Never post to Situation Room (retired)
- If no campaigns exist, brief status and wait
