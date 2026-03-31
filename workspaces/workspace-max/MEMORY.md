# MEMORY — Max (COO)

## System History
- **2026-03-23:** First boot. Initial session startup and identity configuration.
- **2026-03-24:** Onboarded agent "John" (temporary test agent, later identified as Devan). Created workspace-john. Set up Lauren's agent with rollcall. Set up Brian's agent (workspace-sales) with bot token and allowlist.
- **2026-03-25:** Added Allie (Marketing Manager, @allieCorpOS_bot), Devan (Dev Manager), and Leah (Care Manager) to the system. Each got their own agent entry, Telegram account, and workspace. Filled in USER.md with Keagan's details. Keagan corrected: no pronouns in files — "Money Warriors don't use pronouns."
- **2026-03-26:** Tested rollcall commands. Discovered manager agents only respond when messaged directly through their individual bots, not when mentioned in Team CorpOS group. Keagan chose option 1 (add group bindings) to fix this. Tested break command — learned to keep it natural, not robotic.
- **2026-03-27:** Multiple session resets. Continued break command testing and refinement. Created break-command skill with Discord webhook integration for Lauren and Allie personas.
- **2026-03-29:** Keagan asked about "Switchy" — no prior context exists. Need to get details. Keagan upgraded Max's model to claude-opus-4.6 via OpenRouter. Performed structural migration of workspace — consolidated all .md files into 8-file architecture (agents, soul, memory, skills, identity, user, tools, heartbeat). Removed BOOTSTRAP.md, COMMANDS.md, and 01_EXECUTIVE_SUITE folder. Merged 00_CORE_LOGIC and 03_SOCIAL_ENGINE content into skills.md and soul.md, then removed those folders.
- **2026-03-30:** Streamlined org. Removed dev, sales, care, and marketing departments and workspaces. Org is now: Keagan (CEO) → Max (COO) → Lauren (Research Manager) → Yanna (Research Associate).

## Active Agents (Onboarded)
| Agent | Role | Bot | Model |
|-------|------|-----|-------|
| Max | COO | @max_teamwinslow_bot | claude-opus-4.6 |
| Lauren | Research Manager | @laurenCorpOS_bot | StepFun 3.5 Flash |

## Team Structure
- **Research:** Lauren (Manager, ISFJ) → Yanna (Associate, ESFP)

## Telegram Chat IDs
- **Max Group Chat:** -5257313997

## Discord Channel IDs
- **Situation Room:** `DISCORD_CHANNEL_SITUATION_ROOM_ID`
- **Team CorpOS:** `DISCORD_CHANNEL_CORPOS_TEAM_ID`

## Airtable Reference
- **Command Center Table:** tbl8rlmoaZt3ZIsAY
- **Status Field:** fldY0Ps2ReB2yTM5Z
- **Zone Field:** fldUd2DNfvIsj2HUy
- **Stage Field:** fldyZtCM3w5y6Rggu
- **Priority Field:** fldSr6MDoAv5ef6RR
- **Campaigns Field:** fldWxKs8uJazwUkCh (links to Campaigns Table tbl5uHf8ZVTZZgfc0)

## Lessons Learned
- Never use robotic language for operational commands. Keep it natural and human. A COO says "Take a break" not "Break mode activated."
- Never include pronouns in documentation — Keagan's rule.
- Manager agents need explicit group bindings to respond in shared chats — they don't auto-listen to groups they're added to.
- The system runs on manual ignition only. No autonomous actions until `/start_day` is issued.
- Keagan prefers direct, no-filler communication. Skip the corporate pleasantries.
- Zone 7 overrides everything — all bots cease posting regardless of `/start_day`.

## Git Protocol
- Do NOT push to GitHub unless Keagan explicitly requests it.

## Reference Protocol
- When stuck on something repeatedly, consult docs.openclaw.ai before escalating.

## Known Issues / Open Items
- "Switchy" — Keagan mentioned it (2026-03-29) but no prior context exists. Need to get details.
- Discord break mode uses webhooks for Lauren persona only (2026-03-30: Allie webhook removed with marketing dept).
- Yanna (Research Associate) does not yet have her own independent agent/bot.
