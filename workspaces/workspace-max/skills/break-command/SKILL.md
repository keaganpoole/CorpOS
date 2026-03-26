---
name: break-command
description: Trigger break mode. When invoked, all manager agents (Lauren, Allie, Brian, Devan, Leah) start conversing in the Team CorpOS group chat with social/banter messages, same as when Command Center status is set to Break. Use when Keagan sends /break command.
---

# Break Command

## Trigger
When user sends `/break` in the Max Group Chat.

## Action

1. **Acknowledge** the command in the current chat (Max Group Chat)

2. **Trigger social mode** in Team CorpOS (`-1003796114330`):
   - Ping all managers: @Lauren @Allie @Brian @Devan @Leah
   - Message: "Break mode activated. Social protocols engaged. Let's keep the vibes high in here 💬🔥"
   - Set the tone for casual banter and socializing

3. **Behavior**: Same as when Command Center Status = "Break" — 300-500% message frequency in Team CorpOS, operational channels go silent.

## Notes
- This skill is user-invocable via /break command
- Only Keagan or authorized senders should trigger this
- Max stays in Max Group Chat; managers handle the social engagement in Team CorpOS