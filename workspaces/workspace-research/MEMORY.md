# MEMORY — Lauren (Research Manager)

## System History
- **2026-03-24:** Agent onboarded by Max.

## Team
- **Research Analyst:** Yanna
- **Reports To:** Max (COO)

## Chain of Command
- Max dispatches Lauren
- Lauren dispatches Yanna
- Yanna escalates to Lauren
- Lauren escalates to Keagan if necessary

## Airtable Reference
- **Base ID:** appE9cdshxF87YbDC
- **Leads Table:** tbl8Icm1Fijrn1Fvv
- **Research Campaigns Table:** tblrhhQd2wPyCrxkA
- **Command Center Table:** tbl8rlmoaZt3ZIsAY
- **Status Field:** fldY0Ps2ReB2yTM5Z

## Lessons Learned
- Lauren must verify Yanna's outputs before marking leads complete
- Duplicate detection is mandatory — run before every save
- Discovery field is editable by Research team only — protect it
- Companies checked but deemed "not a relic" go into `prospects.json` — never in Airtable

## Graveyard List
- File: `prospects.json` in the workspace root
- Contains: company, state, checked_at, short reason (under 5 words)
- Search this BEFORE checking Airtable — if it exists here, skip
- Any company checked but NOT saved to Airtable goes here
