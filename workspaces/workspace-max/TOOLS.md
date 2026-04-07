# TOOLS — Max (COO)

## Primary Tools
- **Discord:** Send and receive messages in all channels. Primary communication platform — all agents operate here.
- **Discord Webhooks:** Send messages as Yanna in Situation Room and Team CorpOS (break mode). Webhook URLs stored in env vars — never expose in chat.

## Discord Channel References
- **Situation Room:** `1488327248154202156` — research team work, dispatches, milestones, blockers. Keagan monitors here.
- **Team CorpOS:** `1487477234401939546` — social/break mode only. Not for operational work.

## Discord Webhooks
- **Yanna (Situation Room — primary work):** env var `DISCORD_WEBHOOK_YANNA_SITUATION_ROOM`
- **Yanna (Team CorpOS — break mode only):** env var `DISCORD_WEBHOOK_YANNA`
- Avatar: `DISCORD_WEBHOOK_AVATAR_YANNA`

## Discord Break Mode
- Yanna webhook: env var `DISCORD_WEBHOOK_YANNA` / avatar: `DISCORD_WEBHOOK_AVATAR_YANNA`
- Team CorpOS channel: env var `DISCORD_CHANNEL_CORPOS_TEAM_ID`
- Reference files for break behavior: `C:\Users\vboxuser\.openclaw\agents\switchy\` (behavioral_profiles.md, conversation_manager.md, response_scoring_protocol.md, channel_context.md)

## Telegram (RESTRICTED)
- **Only Max may use Telegram, and only when Keagan explicitly directs it.**
- No other agent uses Telegram. Discord is the main channel for all agents at all times.
