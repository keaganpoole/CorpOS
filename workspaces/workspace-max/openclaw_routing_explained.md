# OpenClaw Discord Routing - How It Works

## The Issue

I set up Yanna as an independent agent with these bindings:
- `discord accountId=default` - Routes Discord messages to Yanna
- `discord accountId=1487477234401939546` - Routes Team CorpOS messages to Yanna

**BUT** there's only ONE Discord account configured: `default` (Max's bot token).

## How OpenClaw Discord Routing Works

According to the docs, each agent that needs to respond on Discord needs its own **Discord bot account**:

```
Channel Account Setup:
- Max uses: DISCORD_BOT_TOKEN_MAX (accountId: default)
- Yanna would need: DISCORD_BOT_TOKEN_YANNA (accountId: yanna-bot)
```

### The Problem

When a user sends a message in Team CorpOS:
1. The message arrives at the Discord bot (Max's bot account: `default`)
2. OpenClaw checks routing bindings: `accountId=default`
3. Both Max and Yanna have bindings for `accountId=default`
4. **First match wins** - Max is default agent, so messages route to Max

### Why Yanna Isn't Responding

Yanna's bindings are correct, but:
- She's NOT the default agent (Max is)
- When a message comes in via `accountId=default`, Max gets it first
- Yanna's session exists but isn't receiving the messages

## Solutions

### Option 1: Separate Discord Bot Accounts (Recommended)
Each agent needs its own Discord bot token:
- Max: `DISCORD_BOT_TOKEN_MAX` (accountId: max)
- Yanna: `DISCORD_BOT_TOKEN_YANNA` (accountId: yanna)

Then configure:
```json
{
  "bindings": [
    {
      "agentId": "max",
      "match": { "channel": "discord", "accountId": "max" }
    },
    {
      "agentId": "yanna", 
      "match": { "channel": "discord", "accountId": "yanna" }
    }
  ]
}
```

### Option 2: Route by Channel/Peer (Not Supported)
OpenClaw doesn't support routing by channel ID directly - it routes by account ID.

## Current Status

✅ Yanna is set up as independent agent
✅ Yanna has her own workspace with proper files
✅ Yanna has a persistent session
❌ Yanna doesn't have her own Discord bot account
❌ Messages to Team CorpOS route to Max (default agent) first

## Recommendation

To make Yanna respond in Team CorpOS, you need to:
1. Create a new Discord bot for Yanna
2. Add Yanna's bot token to `openclaw.json`
3. Update bindings to route Yanna's account to Yanna agent
4. Invite Yanna's bot to the CorpOS server

Alternatively, Max can explicitly send messages to Yanna via `sessions_send` and Yanna can respond in-thread.
