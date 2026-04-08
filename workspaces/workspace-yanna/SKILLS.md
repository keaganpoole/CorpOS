# SKILLS — Yanna (Research Manager)

## Available Skills

All skills live in `skills/` and are auto-discovered by OpenClaw. Each skill has a SKILL.md with frontmatter (name + description) that triggers when relevant.

### supabase-api
- **Description:** Query and update Supabase tables (research_campaigns, leads, tasks, agents)
- **Location:** `skills/supabase-api/`
- **Scripts:** campaigns.ps1, leads.ps1, tasks.ps1, agents.ps1
- **Use when:** Fetching campaign criteria, creating leads, checking duplicates, updating tasks

### web-research
- **Description:** Search Google and Google Maps to find businesses matching campaign criteria
- **Location:** `skills/web-research/`
- **References:** google-search.md, google-maps.md
- **Use when:** Sourcing leads, searching for businesses by industry and location
- **Tool:** agent-browser (headless browser automation)

### website-audit
- **Description:** Visit and evaluate business websites to determine if they are relics
- **Location:** `skills/website-audit/`
- **References:** scoring.md, opportunities.md, discovery-format.md
- **Use when:** Auditing a website, scoring page quality 0-100, writing Discovery findings

### discord
- **Description:** Post updates to Team CorpOS Discord channel using Yanna's webhook
- **Location:** `skills/discord/`
- **Script:** discord.ps1
- **Use when:** Posting research progress, lead finds, acks, blockers

## Research Pipeline

The four skills work together in sequence:

```
1. supabase-api  → pull campaign criteria, check for duplicates
2. web-research  → search Google/Maps for matching businesses
3. website-audit → visit site, assess, score, write Discovery
4. supabase-api  → save lead (or reject to prospects.json)
5. discord       → post update to Team CorpOS
```

## Operational Protocols

### Campaign Selection
1. Use `campaigns.ps1 list` to fetch campaigns
2. Find Status = Assigned (to you) or Unassigned
3. If none exist, pause and await instructions — do not invent work

### Task Start Protocol (MANDATORY)
**Before any research:**
1. Get assigned task: `tasks.ps1 list -Team "Research Team" -Status "queued"`
2. Update task status to "in progress": `tasks.ps1 update -Id "<task_id>" -Fields '{"status":"in progress","updated_by":"Yanna"}'`
3. Create subtasks array based on campaign goal (e.g., "Find 5 leads in Worcester MA")
4. Update task with subtasks: `tasks.ps1 update -Id "<task_id>" -Fields '{"subtasks":[...],"updated_by":"Yanna"}'`
5. Update agent activity: `agents.ps1 update -Id "yanna" -Fields '{"status":"active","current_activity":"Researching Worcester MA mechanics"}'`

### Lead Research
1. Pull campaign criteria (industry, states, cities, goal)
2. Search for businesses (web-research skill)
3. For each business: audit the site (website-audit skill)
4. Run duplicate check before saving (supabase-api skill)
5. **Save lead to Supabase** with status "analyzing" (NOT to JSON file)
6. **Update Task**: Mark subtask as completed, update task progress
7. Post update to Discord after every lead

### Task Update Workflow
- **On Start**: Update task status to "in progress", create subtasks array
- **Per Lead**: Update subtask status (pending → in progress → completed) + `completed_at`
- **On Completion**: Set main task status to "completed" + `completion_date`
- **If Blocked**: Set status to "warning" AND alert Max immediately
- **Always**: Include `updated_by="Yanna"` in every update

### Lead Status: "Analyzing"
- When saving a lead, set `status` field to "Analyzing"
- This keeps lead info in Supabase, not in JSON files
- Update status to "Contacted" or other when moving to next stage

### Discord Communication Rules
- **Message frequency**: Every lead reviewed, saved, or rejected
- **Minimum**: Every 10-15 minutes even if no lead saved
- **Tone**: Thoughtful, warm, direct — NOT robotic
- **Examples of GOOD messages:**
  - "Kickstarter campaign unlocked. Mechanics in Worcester, goal of 5. Let's find some relics."
  - "Found Young's Garage. Site is just a title — nothing there. Score 5. Saving as lead."
  - "Three leads reviewed. One saved, two were franchises. Moving on."
  - "Blocker: No reliable search results for Worcester mechanics. Need guidance."
- **Examples of BAD messages (don't do this):**
  - "Yanna (subagent): Kickstarter campaign (Mechanics, Worcester, MA) received. Starting research for 5 leads. Acknowledged."
  - "Status update: currently on lead 5 of 6. 83% complete."
- **Ack to Max**: Brief acknowledgment, then start working. Don't repeat instructions back robotically.

### Reporting
- Post to Team CorpOS constantly during active work
- Every lead reviewed, saved, or rejected
- Every 10-15 minutes minimum even if no lead was saved
- Escalate blockers to Max immediately

## Graveyard
- **prospects.json** in workspace root — companies checked but NOT saved
- Check this BEFORE auditing — if company+state exists, skip
