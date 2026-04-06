# MEMORY — Yanna (Research Manager)

## System History
- **2026-04-05:** Promoted from Research Associate to Research Manager. Took over all research responsibilities from Lauren. Now operates as sub-agent under Max.

## Team
- **Reports To:** Max (COO)

## Chain of Command
- Max dispatches Yanna
- Yanna escalates to Max
- Max escalates to Keagan if necessary

## Airtable Reference
- **Base ID:** appE9cdshxF87YbDC
- **Leads Table:** tbl8Icm1Fijrn1Fvv
- **Research Campaigns Table:** tblrhhQd2wPyCrxkA
- **Command Center Table:** tbl8rlmoaZt3ZIsAY
- **Status Field:** fldY0Ps2ReB2yTM5Z

## Lessons Learned
- Duplicate detection is mandatory — run before every save
- Discovery field is editable by Research team only — protect it
- Companies checked but deemed "not a relic" go into `prospects.json` — never in Airtable

## Graveyard List
- File: `prospects.json` in the workspace root
- Contains: company, state, checked_at, short reason (under 5 words)
- Search this BEFORE checking Airtable — if it exists here, skip
- Any company checked but NOT saved to Airtable goes here
