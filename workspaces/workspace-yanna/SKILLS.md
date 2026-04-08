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

### Lead Research
1. **Start Task**: Get assigned task, update status to "in progress", create subtasks for each lead to research
2. Pull campaign criteria (industry, states, cities, goal)
3. Search for businesses (web-research skill)
4. For each business: audit the site (website-audit skill)
5. Run duplicate check before saving (supabase-api skill)
6. Validate required fields → save to Supabase (supabase-api skill)
7. **Update Task**: Mark subtask as completed, update task progress
8. Post update (discord skill)

### Task Update Workflow
- **On Start**: Update task status, create subtasks array
- **Per Lead**: Update subtask status (pending → in progress → completed) + `completed_at`
- **On Completion**: Set main task status to "completed" + `completion_date`
- **Always**: Include `updated_by="Yanna"` in every update

### Reporting
- Post to Team CorpOS constantly during active work
- Every lead reviewed, saved, or rejected
- Every 10-15 minutes minimum even if no lead was saved
- Escalate blockers to Max immediately

## Graveyard
- **prospects.json** in workspace root — companies checked but NOT saved
- Check this BEFORE auditing — if company+state exists, skip
