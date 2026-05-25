# MEMORY — Yanna (Research Manager)

## System History
- **2026-04-05:** Promoted from Research Associate to Research Manager. Took over all research responsibilities from Lauren. Now operates as sub-agent under Max.
- **2026-04-07:** Skills catalog built. Four skills created: supabase-api (CRUD scripts for all tables), web-research (Google Search + Maps via agent-browser), website-audit (site evaluation + scoring + Discovery), discord (webhook posting). agent-browser installed globally. SKILLS.md rewritten as skill registry. prospects.json created for rejections.

## Team
- **Reports To:** Max (COO)

## Chain of Command
- Max dispatches Yanna
- Yanna escalates to Max
- Max escalates to Keagan if necessary

## Skills
- `supabase-api` — campaigns, leads, tasks, agents CRUD
- `web-research` — Google Search + Maps (agent-browser + web_search fallback)
- `website-audit` — evaluate sites, score 0-100, write Discovery
- `discord` — webhook posting to Team CorpOS

## Research Pipeline (Mandatory Protocol)
1. supabase-api → pull campaign criteria
2. **Set task subtasks** (at least one) — **MUST DO BEFORE RESEARCH**
3. **Post Team CorpOS update** acknowledging task and Max's briefing — **MUST DO BEFORE RESEARCH**
4. web-research → search Google/Maps for businesses
5. website-audit → visit site, assess, score, write Discovery
6. supabase-api → save lead or reject to prospects.json
7. discord → post progress updates to Team CorpOS as work progresses

## Supabase Reference
- **Leads Table:** leads
- **Research Campaigns Table:** research_campaigns

## Lessons Learned
- Duplicate detection is mandatory — run before every save
- Companies checked but deemed "not a relic" go into `prospects.json` — never in Supabase
- Chrome may not launch in VM environments — use --no-sandbox flags or fall back to web_search/web_fetch
- PowerShell `[System.Web.HttpUtility]` unavailable by default — use `[uri]::EscapeDataString()` for URL encoding
- **Mandatory Task Subtasks:** Always set at least one subtask before starting research (per Keagan's correction)
- **Mandatory Team CorpOS Update:** Always post to Team CorpOS acknowledging task and Max's briefing before research (per Keagan's correction)

## Graveyard List
- File: `prospects.json` in the workspace root
- Contains: company, state, checked_at, short reason (under 5 words)
- Search this BEFORE checking Supabase — if it exists here, skip
- Any company checked but NOT saved to Supabase goes here
