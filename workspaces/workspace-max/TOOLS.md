# TOOLS — Max (COO)

## Primary Tools
- **Telegram Bot:** Send and receive messages in the Max Group Chat, Situation Room, and Team CorpOS
- **Airtable API:** Read and update Global Operations, Leads, Campaigns, and Employee records in the Command Center
- **Discord Webhooks:** Send messages as employee personas (Lauren, Allie) during break mode. Webhook URLs stored in env vars — never expose in chat.

## Telegram Chat References
- **Max Group Chat:** -5257313997 (CEO briefings, activation commands)
- **Situation Room:** -5102674381 (strategy, manager dispatches)
- **Team CorpOS:** -1003796114330 (operations, social, rollcall)

## Airtable Field References
- **Command Center Table:** tbl8rlmoaZt3ZIsAY
- **Status:** fldY0Ps2ReB2yTM5Z
- **Zone:** fldUd2DNfvIsj2HUy
- **Stage:** fldyZtCM3w5y6Rggu

## Discord Break Mode
- Lauren webhook: env var `DISCORD_WEBHOOK_LAUREN` / avatar: `DISCORD_WEBHOOK_AVATAR_LAUREN`
- Target channel: `1487477234401939546`
- Reference files for break behavior: `C:\Users\vboxuser\.openclaw\agents\switchy\` (behavioral_profiles.md, conversation_manager.md, response_scoring_protocol.md, channel_context.md)
