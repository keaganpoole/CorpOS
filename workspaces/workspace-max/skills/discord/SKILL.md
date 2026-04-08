---
name: discord
description: Send messages, reply, react, and read channel history in Discord using Max's bot. MANDATORY: All Team CorpOS messages must be human, conversational, and natural. No technical data dumps. Use when Max needs to post a briefing to Team CorpOS, respond to Yanna or Keagan, react to a message with emoji, or check recent messages in a channel. Triggers on "post to Discord", "send message", "reply", "brief Yanna", "check channel", "Team CorpOS", or any Discord messaging operation.
---

# Discord — Max Bot

Send and manage messages in Discord via the bot API. Uses `DISCORD_BOT_TOKEN_MAX` env var.

**IMPORTANT:** This skill uses `.NET WebClient` as the HTTP client. **Do NOT switch to `Invoke-RestMethod`** — it hits Discord API 40333 errors in this VM environment. This is the **first and only option** for all Discord API calls.

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

### HTTP Client Notes

- **Primary client:** `.NET WebClient` (System.Net.WebClient)
- **Why:** PowerShell's `Invoke-RestMethod` hits Discord API 40333 "internal network error" in this VM environment
- **Verified:** Python `requests` library works fine with same credentials — proved bot token and permissions are correct
- **Documented:** 2026-04-08 in MEMORY.md and daily log

### Quick Reference

**Post to Team CorpOS (Human tone):**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/discord.ps1 -Action send -ChannelId "1487477234401939546" -Content "Kickstarter's live in Worcester. Yanna's on it. Let's get those leads."
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

See `skills/discord/references/channels.md` for channel IDs and purposes.

**Primary channel:** Team CorpOS (`1487477234401939546`) — all daily ops happen here.

## Channel Rules — Team CorpOS

**⚠️ MANDATORY: Every message must be human, natural, and conversational.**

Team CorpOS is a **team chat**, not a technical dashboard. It's for:
- Socializing and team cohesion
- Coaching and motivation
- Natural conversation
- Human-to-human interaction

### What NOT to do:
- ❌ List backend data (zones, stages, variable names)
- ❌ Post robotic briefings with structured lists
- ❌ Use technical jargon or system output
- ❌ Treat it like a logging console
- ❌ Send raw JSON or API responses
- ❌ Write like a machine

### What TO do:
- ✅ Talk like a human employee
- ✅ Summarize, don't enumerate
- ✅ Use conversational language
- ✅ Coach and motivate the team
- ✅ Make it feel like talking to colleagues
- ✅ Expect responses and engagement

### Example — Bad (Robotic):
```
## Morning Briefing — April 8, 2026
**Zone/Stage:** Zone 2, Code Blue
**Agents:** Max (active), Yanna (active)
**Campaigns:** Kickstarter (Mechanics, Worcester, MA)
**Leads:** 0 total, 0 qualified
**Status:** Ready to dispatch
```

### Example — Good (Human):
```
Alright team, we're in Zone 2 and Code Blue — clear skies. 
Kickstarter's live in Worcester (mechanics), goal is 5 leads. 
Yanna's ready to roll. Let's execute and make it happen.
```

### Example — Bad (Data dump):
```
Campaign ID: 86b71205-ba7e-4003-9a26-f98292db992b
Assigned: Yanna
Status: Active
Lead Count: 0
Subtasks: null
```

### Example — Good (Conversational):
```
Yanna, the Kickstarter campaign's all set — Worcester mechanics, 
you're assigned. Zero leads so far, go make something happen.
```

## Posting Rules

- **Briefings go to Team CorpOS.** Situation Room is retired from daily ops.
- **Keep it natural and human.** 1-3 sentences in conversational tone.
- **No technical data dumps.** Summarize, don't list variables.
- **React when appropriate.** ✅ for acks, 👍 for agreement.
- **Reply when addressing someone directly.** Use `reply` action with their message ID.
- **Coach and engage.** This is a team chat, talk to people like colleagues.
