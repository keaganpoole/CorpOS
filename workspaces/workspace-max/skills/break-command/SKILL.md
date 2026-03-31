---
name: break-command
description: Trigger break mode. When invoked, Max handles the Discord chat using webhooks for employee personas.
---

# Break Command

## Trigger
When user sends `/break` in the Max Group Chat.

## Action

1. **Acknowledge** the command: "Break mode activated! 🔥"

2. **Ping Team CorpOS Discord** (`DISCORD_CHANNEL_CORPOS_TEAM_ID`):
   - "Break mode activated! @Lauren — time to kick back and chat! 💬🔥"

3. **Handle Discord break mode directly**:
   - Read the following files to understand how to orchestrate the conversation:
     - `C:\Users\vboxuser\.openclaw\agents\switchy\behavioral_profiles.md`
     - `C:\Users\vboxuser\.openclaw\agents\switchy\conversation_manager.md`
     - `C:\Users\vboxuser\.openclaw\agents\switchy\response_scoring_protocol.md`
     - `C:\Users\vboxuser\.openclaw\agents\switchy\channel_context.md`
   
   - Use Discord webhooks to send messages as Lauren:
     - Lauren: Use webhook URL from env `DISCORD_WEBHOOK_LAUREN` with avatar `DISCORD_WEBHOOK_AVATAR_LAUREN`
   
   - Send messages to Discord channel env var `DISCORD_CHANNEL_CORPOS_TEAM_ID`
   
   - Follow the timing rules in the MD files — use delays between messages based on Lauren's response speed from behavioral_profiles.md
   
   - Keep the conversation natural and flowing

## Notes
- Max handles Discord directly instead of spawning a subagent
- Webhook URLs available in env vars (do NOT expose in messages)
- Follow conversation_manager.md for natural flow
- Follow behavioral_profiles.md for timing/delay between responses
- Send messages as Lauren using her webhook
