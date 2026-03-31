# TOOLS — Lauren (Research Manager)

## Primary Tools
- **Discord:** Messages in Team CorpOS and Situation Room
- **Airtable API:** Write leads into Leads table, update Research records
- **Web Scraper:** Analyze "Relic" websites
- **Google Search:** Find niches and competitor data
- **Discord Webhook:** Post updates to Team CorpOS Discord channel

## Discord Channel References
- **Situation Room (`1488327248154202156`):** Briefing only and urgent/blockers. Max posts here — Lauren responds when pinged.
- **Team CorpOS (`1487477234401939546`):** PRIMARY update channel. Post research updates here constantly during active work.

## Discord References
- **Server ID:** stored in `DISCORD_SERVER_ID` env var
- **Team CorpOS Channel:** stored in `DISCORD_CHANNEL_CORPOS_TEAM_ID` env var
- **Situation Room Channel:** stored in `DISCORD_CHANNEL_SITUATION_ROOM_ID` env var
- **Lauren Webhook:** stored in `DISCORD_WEBHOOK_LAUREN` env var
- **Lauren Avatar:** stored in `DISCORD_WEBHOOK_AVATAR_LAUREN` env var
- **Bot Token:** stored in `DISCORD_BOT_TOKEN` env var

## Airtable References

### Leads Table (tbl8Icm1Fijrn1Fvv)
Fields the Research team can and should populate:

| Field | Field ID | Notes |
|-------|----------|-------|
| Company | fldwy942UBP3Fue5P | Required |
| Discovery | fldafbs7bWmuOcuc8 | Required — editable by Research team only |
| Industry | fld7wCCG3mMRtPdLp | Required |
| Website | fldj9yJ5iiM0CROPq | Optional |
| Email | fldHAv3sJtE6Q6uOd | Required |
| Phone | fldeMBDM6voTsKdCY | Optional |
| City | fldcmHZONzuBSrdGG | Optional |
| State | fldipp8zp17um0lGM | Required — abbreviation only |
| Source | fldj3vlrUhytM1ErV | Required — LinkedIn, Google Search, Google Maps, Manual Web Search |
| Opportunity | fldKgpMf0r0WDLM7T | Multi-select — Outdated Website, Ugly Website, Poor Functionality, Limited Features, No Website, Not Mobile Friendly |
| Page Quality Score | fld05Dn42FTvQ5cB8 | Number 0-100 |
| Status | fldr7STfO5FXARCoc | Set to "Not contacted" |
| Assigned To (research team only) | fld3NIBPtLgzzBAbC | Link to researcher |
| First Name | fldtQlyyWgT2UoISr | Optional |
| Last Name | fldrNubPoa5vXZzaT | Optional |
| Position | fldAPKbZsG2C1dfdd | Optional |

### Research Campaigns Table (tblrhhQd2wPyCrxkA)
| Field | Field ID | Notes |
|-------|----------|-------|
| Campaign Name | fldRpy4rDpU8aCxX4 | |
| Target Industry | fldtN1TZi26f68Xzl | |
| Target State(s) | fld9M5N2Bl52f20mk | |
| Target City(s) | fldtF7L5vZ5qQLvZA | |
| Lead Count Goal | fldnsjMZKxXXxN1AY | |
| Status | fldvB8k7DHlgnYjwG | single-select: Ready, Active, Paused, Completed |

### Command Center Table (tbl8rlmoaZt3ZIsAY)
| Field | Field ID |
|-------|----------|
| Status | fldY0Ps2ReB2yTM5Z |
| Stage | fldyZtCM3w5y6Rggu |

## Airtable Credentials
- Base ID: `appE9cdshxF87YbDC`
- API Key: stored in `AIRTABLE_API_KEY` env variable
