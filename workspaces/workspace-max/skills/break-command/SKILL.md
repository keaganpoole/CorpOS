---
name: break-command
description: Trigger break mode. When invoked, spawn Switchy subagent to handle Discord chat.
---

# Break Command

## Trigger
When user sends `/break` in the Max Group Chat.

## Action

1. **Acknowledge** the command: "Break mode activated! 🔥"

2. **Ping Telegram Team CorpOS** (-1003796114330):
   - "Break mode activated! @Lauren @Allie @Brian @Devan @Leah — time to kick back and chat! 💬🔥"

3. **Spawn Switchy subagent** to handle Discord:
   - Use sessions_spawn with:
     - label: "switchy-break"
     - runtime: "subagent"
     - model: "openrouter/stepfun/step-3.5-flash:free"
     - task: Full instructions to read the MD files and orchestrate chat
     - Use webhooks for Lauren/Allie from env vars

## Notes
- Max stays in Max Group Chat
- Switchy runs as subagent handling Discord break conversations
- Webhook URLs available: DISCORD_WEBHOOK_LAUREN, DISCORD_WEBHOOK_ALLIE
- Avatar URLs: DISCORD_WEBHOOK_AVATAR_LAUREN, DISCORD_WEBHOOK_AVATAR_ALLIE