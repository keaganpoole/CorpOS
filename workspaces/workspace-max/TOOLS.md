# TOOLS — Max (COO)

## Primary Tools
- **Discord:** Send and receive messages in all channels. Primary communication platform — all agents operate here.
- **Airtable API:** Read-only. Do NOT update, create, or delete records. Escalate any needed changes to Keagan.
- **Discord Webhooks:** Send messages as Lauren in Situation Room and Team CorpOS (break mode). Webhook URLs stored in env vars — never expose in chat.

## Discord Channel References
- **Situation Room:** `1488327248154202156` — research team work, dispatches, milestones, blockers. Keagan monitors here.
- **Team CorpOS:** `1487477234401939546` — social/break mode only. Not for operational work.

## Discord Webhooks
- **Lauren (Situation Room — primary work):** `https://discord.com/api/webhooks/1488332481261207656/iyCvw01hDXv-PIDTsPWydB4ZkeEGnKaAfWFRBUxOzJaWRxrjEJzlULGb_7ssOAxSdKNi`
- **Lauren (Team CorpOS — break mode only):** `https://discord.com/api/webhooks/1487514601284173914/WCKzCVgjmcwmeayrTU8Zd9ZwhaU4DuPLcoFJuD4ezHkM7q-r55L2I9QcNSum997t8Sk6`
- Avatar: `DISCORD_WEBHOOK_AVATAR_LAUREN`

## Airtable Field References
- **Command Center Table:** tbl8rlmoaZt3ZIsAY
- **Status:** fldY0Ps2ReB2yTM5Z
- **Stage:** fldyZtCM3w5y6Rggu
- **Priority:** fldSr6MDoAv5ef6RR

## Discord Break Mode
- Lauren webhook: env var `DISCORD_WEBHOOK_LAUREN` / avatar: `DISCORD_WEBHOOK_AVATAR_LAUREN`
- Team CorpOS channel: env var `DISCORD_CHANNEL_CORPOS_TEAM_ID`
- Reference files for break behavior: `C:\Users\vboxuser\.openclaw\agents\switchy\` (behavioral_profiles.md, conversation_manager.md, response_scoring_protocol.md, channel_context.md)

## Telegram (RESTRICTED)
- **Only Max may use Telegram, and only when Keagan explicitly directs it.**
- No other agent uses Telegram. Discord is the main channel for all agents at all times.
