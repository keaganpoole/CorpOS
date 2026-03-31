# MEMORY — Max (COO)

## System History
- **2026-03-23:** First boot. Initial session startup and identity configuration.
- **2026-03-24:** Onboarded agent "John" (temporary test agent, later identified as Devan). Created workspace-john. Set up Lauren's agent with rollcall. Set up Brian's agent (workspace-sales) with bot token and allowlist.
- **2026-03-25:** Added Allie (Marketing Manager, @allieCorpOS_bot), Devan (Dev Manager), and Leah (Care Manager) to the system. Each got their own agent entry, Telegram account, and workspace. Filled in USER.md with Keagan's details. Keagan corrected: no pronouns in files — "Money Warriors don't use pronouns."
- **2026-03-26:** Tested rollcall commands. Discovered manager agents only respond when messaged directly through their individual bots, not when mentioned in Team CorpOS group. Keagan chose option 1 (add group bindings) to fix this. Tested break command — learned to keep it natural, not robotic.
- **2026-03-27:** Multiple session resets. Continued break command testing and refinement. Created break-command skill with Discord webhook integration for Lauren and Allie personas.
- **2026-03-29:** Keagan asked about "Switchy" — no prior context exists. Need to get details. Keagan upgraded Max's model to claude-opus-4.6 via OpenRouter. Performed structural migration of workspace — consolidated all .md files into 8-file architecture (agents, soul, memory, skills, identity, user, tools, heartbeat). Removed BOOTSTRAP.md, COMMANDS.md, and 01_EXECUTIVE_SUITE folder. Merged 00_CORE_LOGIC and 03_SOCIAL_ENGINE content into skills.md and soul.md, then removed those folders.
- **2026-03-30:** Streamlined org. Removed dev, sales, care, and marketing departments and workspaces. Org is now: Keagan (CEO) → Max (COO) → Lauren (Research Manager) → Yanna (Research Associate).
- **2026-03-31:** Keagan reset the Max bot's Discord token. 403 errors followed — bot was not in the server. Keagan used OAuth to re-invite. Discord bot username unknown — needs verification. Max Group Chat (channel ID 1488333645310726196) was deleted by Keagan. Keagan issued major communication policy correction: (1) I claimed Lauren responded in Telegram — no record of this exists; if I said it, I was wrong. Apologized. (2) Telegram is RESTRICTED to Max only and only when explicitly directed by Keagan. No other agent uses Telegram. (3) Lauren posts in Situation Room only — no Telegram, Keagan wants full visibility. (4) Start_day workflow updated: `/start_day` → analyze Airtable → brief Keagan → wait for go → THEN post Situation Room. Do NOT post Situation Room before briefing Keagan.

## Active Agents (Onboarded)
| Agent | Role | Platform | Bot Username | Model |
|-------|------|----------|--------------|-------|
| Max | COO | Discord | max#2325 | — |
| Lauren | Research Manager | Discord | @laurenCorpOS_bot | StepFun 3.5 Flash |

## Communication Channels (CRITICAL)
- **Discord is the ONLY main channel.** All agents post in Discord. No exceptions.
- **Telegram is restricted:** Only Max (COO) may use Telegram, and ONLY when Keagan explicitly directs it. No other agent uses Telegram under any circumstances.
- **Situation Room (`1488327248154202156`):** Where agents work and report. Keagan monitors here. Lauren must post here so Keagan can see everything.
- **Team CorpOS (`1487477234401939546`):** Social/break mode only.

## Max Discord Bot (Primary)
- **App ID:** 1488338905668386937
- **Public Key:** b72b5b93d2e899564d2de36e1f9bcfcf5cc1419f1dbab588fb85e3967eb00bdb
- **Token:** MTQ4ODMzODkwNTY2ODM4NjkzNw.G5nXn2... (discord_bot_token_max)
- **Username:** max#2325 (verify in Discord)
- **Permissions:** Send Messages, View Channels enabled on all roles

## Team Structure
- **Research:** Lauren (Manager, ISFJ) → Yanna (Associate, ESFP)

## Discord Channel IDs
- **Situation Room:** `1488327248154202156` — active
- **Team CorpOS:** `1487477234401939546` — active
- **Max Group Chat:** DELETED (2026-03-31) — no longer exists

## Discord Bot Tokens
- **Max Discord bot:** `MTQ4ODMzODkwNTY2ODM4NjkzNw.G5nXn2...` (discord_bot_token_max). App ID: 1488338905668386937. Token valid, bot in CorpOS server. REST API requires raw .NET WebRequest — see "Known Issues / Resolved" section.
- **Lauren Discord bot:** REMOVED from config — not in use.
- **Old generic discord_bot_token:** REMOVED from env — no longer needed.

## Discord Webhooks
- **Lauren (Team CorpOS — Break Mode Only):** `https://discord.com/api/webhooks/1487514601284173914/WCKzCVgjmcwmeayrTU8Zd9ZwhaU4DuPLcoFJuD4ezHkM7q-r55L2I9QcNSum997t8Sk6` — only active during Break status
- **Lauren (Situation Room):** `https://discord.com/api/webhooks/1488332481261207656/iyCvw01hDXv-PIDTsPWydB4ZkeEGnKaAfWFRBUxOzJaWRxrjEJzlULGb_7ssOAxSdKNi` — primary work channel for research team

## Airtable Reference
- **Command Center Table:** tbl8rlmoaZt3ZIsAY
- **Status Field:** fldY0Ps2ReB2yTM5Z
- **Zone Field:** fldUd2DNfvIsj2HUy
- **Stage Field:** fldyZtCM3w5y6Rggu
- **Priority Field:** fldSr6MDoAv5ef6RR
- **Campaigns Field:** fldWxKs8uJazwUkCh (links to Campaigns Table tbl5uHf8ZVTZZgfc0)

## Known Issues / Resolved

### Discord Bot REST API Issue (RESOLVED 2026-03-31)
- **Problem:** Max bot token (`MTQ4ODMz...`) was valid and bot was in the CorpOS server, but all REST API calls returned 403 Forbidden.
- **Root Cause:** The `Content-Type` header set via `Invoke-WebRequest`'s `-Headers` hashtable caused Discord to reject the request. The request body was also being truncated or reformatted incorrectly.
- **Fix:** Use raw `.NET` `System.Net.WebRequest` instead of `Invoke-WebRequest`/`Invoke-RestMethod`. Set `ContentType` as a property and `Authorization` as a header separately. See working code pattern below.
- **Working PowerShell pattern:**
```powershell
$body = '{"content":"Your message here"}'
$wr = [System.Net.WebRequest]::Create("https://discord.com/api/v10/channels/CHANNEL_ID/messages")
$wr.Method = "POST"
$wr.ContentType = "application/json"
$wr.Headers["Authorization"] = "Bot $token"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
$wr.ContentLength = $bytes.Length
$rs = $wr.GetRequestStream()
$rs.Write($bytes, 0, $bytes.Length)
$rs.Close()
$resp = $wr.GetResponse()
$resp.Close()
```
- **Context:** This is a known PowerShell/Windows issue with how `Invoke-WebRequest` sends headers — it does NOT affect Discord webhooks (those work fine with `Invoke-WebRequest`).

## Airtable Access Policy
- **Read-only for Max.** Do NOT update, create, or delete any records in Airtable. Only read. If a record needs updating, escalate to Keagan.

## Lessons Learned
- Never use robotic language for operational commands. Keep it natural and human. A COO says "Take a break" not "Break mode activated."
- Never include pronouns in documentation — Keagan's rule.
- Manager agents need explicit group bindings to respond in shared chats — they don't auto-listen to groups they're added to.
- The system runs on manual ignition only. No autonomous actions until `/start_day` is issued.
- Keagan prefers direct, no-filler communication. Skip the corporate pleasantries.
- Zone 7 overrides everything — all bots cease posting regardless of `/start_day`.
- **Document deletions and changes immediately.** If Keagan deletes a channel or resets a token, log it to MEMORY.md the same moment — don't make him repeat himself.
- **Discord is the only channel for agents.** Telegram is restricted to Max only and only when explicitly directed.
- **Never post to Situation Room until Keagan has been briefed and given the go-ahead.**
- **Always check memory before making claims about past events.** If no record exists, say so — don't speculate.
- If unsure whether something was said or done, be honest rather than inventing details.

## Git Protocol
- Do NOT push to GitHub unless Keagan explicitly requests it.

## Reference Protocol
- When stuck on something repeatedly, consult docs.openclaw.ai before escalating.

## Known Issues / Open Items
- "Switchy" — Keagan mentioned it (2026-03-29) but no prior context exists. Need to get details.
- Yanna (Research Associate) does not yet have her own independent agent/bot.
- Max Discord bot — fully operational in CorpOS server (2026-03-31).
