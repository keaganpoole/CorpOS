# MEMORY — Yanna (Research Manager)

## System History
- **2026-04-05:** Promoted from Research Associate to Research Manager. Took over all research responsibilities from Lauren. Now operates as sub-agent under Max.

## Team
- **Reports To:** Max (COO)

## Chain of Command
- Max dispatches Yanna
- Yanna escalates to Max
- Max escalates to Keagan if necessary

## Supabase Reference
- **Leads Table:** leads
- **Research Campaigns Table:** research_campaigns

## Lessons Learned
- Duplicate detection is mandatory — run before every save
- Companies checked but deemed "not a relic" go into `prospects.json` — never in Supabase

## Graveyard List
- File: `prospects.json` in the workspace root
- Contains: company, state, checked_at, short reason (under 5 words)
- Search this BEFORE checking Supabase — if it exists here, skip
- Any company checked but NOT saved to Supabase goes here
