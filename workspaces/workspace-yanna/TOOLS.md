# TOOLS — Yanna (Research Manager)

## Primary Tools
- **Discord:** Messages in Team CorpOS and Situation Room
- **Supabase:** Create and update leads, manage campaigns
- **Web Scraper:** Analyze "Relic" websites
- **Google Search:** Find niches and competitor data
- **Discord Webhook:** Post updates to Team CorpOS Discord channel

## Discord Channel References
- **Situation Room (`1488327248154202156`):** Briefing only and urgent/blockers. Max posts here — Yanna responds when pinged.
- **Team CorpOS (`1487477234401939546`):** PRIMARY update channel. Post research updates here constantly during active work.

## Discord References
- **Server ID:** stored in `DISCORD_SERVER_ID` env var
- **Team CorpOS Channel:** stored in `DISCORD_CHANNEL_CORPOS_TEAM_ID` env var
- **Situation Room Channel:** stored in `DISCORD_CHANNEL_SITUATION_ROOM_ID` env var
- **Yanna Webhook:** stored in `DISCORD_WEBHOOK_YANNA` env var
- **Yanna Avatar:** stored in `DISCORD_WEBHOOK_AVATAR_YANNA` env var

## Supabase References

### Leads Table
Fields to populate: company, status, phone, email, website, address, city, state, zip, notes, score, stage, assigned_agent.

### Research Campaigns Table
Fields: Campaign Name, Target Industry, Target State(s), Target City(s), Lead Count Goal, Status.

### Attribution
Always set `created_by` and `updated_by` to "Yanna" when creating or updating records.
