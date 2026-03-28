---
name: break-command
description: Trigger break mode. When invoked, all manager agents (Lauren, Allie, Brian, Devan, Leah) start conversing in the Team CorpOS group chat with social/banter messages, same as when Command Center status is set to Break. Use when Keagan sends /break command.
---

# Break Command

## Trigger
When user sends `/break` in the Max Group Chat.

## Action

1. **Acknowledge** the command in the current chat (Max Group Chat)

2. **Send Telegram messages to Team CorpOS** to ping each manager. Use the Telegram Bot API to send a message to group -1003796114330 from the default bot:
   - Message: "Break mode activated! @Lauren @Allie @Brian @Devan @Leah — time to kick back and chat! 💬🔥"

3. The managers will see the @mentions in the Telegram group and respond naturally in that same conversation.

## Notes
- Use Telegram Bot API (not sessions_send) to ensure responses go to the group
- This skill is user-invocable via /break command
- Only Keagan or authorized senders should trigger this
- Max stays in Max Group Chat; managers handle the social engagement in Team CorpOS

## Telegram Bot Tokens (from config)
- Default: 8621566826:AAHU2dxOWjwaxY9ZMkX_q7-gih5ce2QJ_yk
- Team CorpOS group: -1003796114330