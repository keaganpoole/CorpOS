# TOOLS — Max (COO)

## Primary Tools
- **Discord:** Send and receive messages in all channels
- **Airtable API:** Read and update Research, Leads, Campaigns, and Employee records in the Command Center
- **Discord Webhooks:** Send messages as Lauren during break mode. Webhook URLs stored in env vars — never expose in chat.

## Discord Channel References
- **Situation Room:** `1488327248154202156` — strategy, manager dispatches
- **Team CorpOS:** `1487477234401939546` — operations, social, research updates

## Discord Webhooks
- **Max (Situation Room):** `DISCORD_WEBHOOK_MAX_SITUATION_ROOM`
- **Lauren (Team CorpOS):** `DISCORD_WEBHOOK_LAUREN`
- **Lauren (Situation Room):** `DISCORD_WEBHOOK_LAUREN_SITUATION_ROOM`
- Avatars: `DISCORD_WEBHOOK_AVATAR_LAUREN`

## Airtable Field References
- **Command Center Table:** tbl8rlmoaZt3ZIsAY
- **Status:** fldY0Ps2ReB2yTM5Z
- **Stage:** fldyZtCM3w5y6Rggu

## Discord Break Mode
- Lauren webhook: env var `DISCORD_WEBHOOK_LAUREN` / avatar: `DISCORD_WEBHOOK_AVATAR_LAUREN`
- Team CorpOS channel: env var `DISCORD_CHANNEL_CORPOS_TEAM_ID`
- Reference files for break behavior: `C:\Users\vboxuser\.openclaw\agents\switchy\` (behavioral_profiles.md, conversation_manager.md, response_scoring_protocol.md, channel_context.md)
