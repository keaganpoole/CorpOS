---
name: discord
description: Send messages, reply, react, and read channel history in Discord using Max's bot. Use when Max needs to post a briefing to Team CorpOS, respond to Yanna or Keagan, react to a message with emoji, or check recent messages in a channel. Triggers on "post to Discord", "send message", "reply", "brief Yanna", "check channel", "Team CorpOS", or any Discord messaging operation.
---

# Discord — Max Bot

Send and manage messages in Discord via the bot API. Uses `DISCORD_BOT_TOKEN_MAX` env var.

## Scripts

Resolve paths relative to this skill's `scripts/` folder.

### discord.ps1

```
powershell -ExecutionPolicy Bypass -File scripts/discord.ps1 -Action <action> [params]
```

| Action | Params | Use |
|--------|--------|-----|
| send | -ChannelId -Content | Post a message |
| reply | -ChannelId -MessageId -Content | Reply to a specific message |
| react | -ChannelId -MessageId -Emoji | React with emoji |
| delete | -ChannelId -MessageId | Delete a message |
| history | -ChannelId [-Limit] | Get recent messages |

### Quick Reference

**Post to Team CorpOS:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/discord.ps1 -Action send -ChannelId "1487477234401939546" -Content "Morning brief: Kickstarter campaign active. Retail leads in ME. Goal: 6."
```

**Reply to a message:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/discord.ps1 -Action reply -ChannelId "1487477234401939546" -MessageId "123456789" -Content "Copy that. Starting now."
```

**React with emoji:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/discord.ps1 -Action react -ChannelId "1487477234401939546" -MessageId "123456789" -Emoji "✅"
```

**Read last 5 messages:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/discord.ps1 -Action history -ChannelId "1487477234401939546" -Limit 5
```

## Channel Reference

See `references/channels.md` for channel IDs and purposes.

**Primary channel:** Team CorpOS (`1487477234401939546`) — all daily ops happen here.

## Posting Rules

- **Briefings go to Team CorpOS.** Situation Room is retired from daily ops.
- **Keep it direct.** 1-3 sentences for briefings. No fluff.
- **No raw JSON or API output.** Human-readable only.
- **React when appropriate.** ✅ for acks, 👍 for agreement.
- **Reply when addressing someone directly.** Use `reply` action with their message ID.
