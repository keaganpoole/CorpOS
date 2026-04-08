# MEMORY — Max (COO)

## System History
- **2026-03-23:** First boot. Initial session startup and identity configuration.
- **2026-03-24:** Onboarded agent "John" (temporary test agent, later identified as Devan). Created workspace-john. Set up Lauren's agent with rollcall. Set up Brian's agent (workspace-sales) with bot token and allowlist.
- **2026-03-25:** Added Allie (Marketing Manager, @allieCorpOS_bot), Devan (Dev Manager), and Leah (Care Manager) to the system. Each got their own agent entry, Telegram account, and workspace. Filled in USER.md with Keagan's details. Keagan corrected: no pronouns in files — "Money Warriors don't use pronouns."
- **2026-03-26:** Tested rollcall commands. Discovered manager agents only respond when messaged directly through their individual bots, not when mentioned in Team CorpOS group. Keagan chose option 1 (add group bindings) to fix this. Tested break command — learned to keep it natural, not robotic.
- **2026-03-27:** Multiple session resets. Continued break command testing and refinement. Created break-command skill with Discord webhook integration for Lauren and Allie personas.
- **2026-03-29:** Keagan asked about "Switchy" — no prior context exists. Need to get details. Keagan upgraded Max's model to claude-opus-4.6 via OpenRouter. Performed structural migration of workspace — consolidated all .md files into 8-file architecture (agents, soul, memory, skills, identity, user, tools, heartbeat). Removed BOOTSTRAP.md, COMMANDS.md, and 01_EXECUTIVE_SUITE folder. Merged 00_CORE_LOGIC and 03_SOCIAL_ENGINE content into skills.md and soul.md, then removed those folders.
- **2026-03-30:** Streamlined org. Removed dev, sales, care, and marketing departments and workspaces. Org is now: Keagan (CEO) → Max (COO) → Lauren (Research Manager) → Yanna (Research Associate).
- **2026-03-31:** Keagan reset the Max bot's Discord token. 403 errors followed — bot was not in the server. Keagan used OAuth to re-invite. Discord bot username unknown — needs verification. Max Group Chat (channel ID 1488333645310726196) was deleted by Keagan. Keagan issued major communication policy correction: (1) Telegram is RESTRICTED to Max only and only when explicitly directed by Keagan. No other agent uses Telegram. (2) Start_day workflow updated: `/start_day` → analyze Airtable → brief Keagan → wait for go → THEN post Situation Room. Do NOT post Situation Room before briefing Keagan.


## Reactions System (Feedback Loop)
- **reactions.md** — Located at `C:\Users\vboxuser\.openclaw\workspaces\workspace-max\reactions.md`. Stores ALL genuine compliments and complaints from Keagan with context on what triggered them and what to learn.
- **Purpose:** This is how Max (and all agents) grow and adapt to Keagan's preferences. Every entry teaches what he likes and dislikes. Review before making design decisions.
- **Rules:** Only log GENUINE praise ("I love that", "great work", "this is perfect") and GENUINE complaints ("I don't like that", "you're pissing me off", "get it together"). NOT polite acknowledgments or course corrections.
- **Announce:** Always say "📋 Saving reaction..." when logging.
- **Supabase:** `reactions` table in Supabase tracks compliment/complaint counts per agent. API at `/api/reactions`.
- **Slash commands:** `/compliment` and `/complaint` work in Discord and Telegram as backups if Max misses a reaction in conversation.
- **Agent cards:** Show compliment/complaint counts from the reactions table.


## Operational Configuration
**Reference:** See `AGENTS.md` for chain of command, session startup, and operational framework.
**Reference:** See `TOOLS.md` for Discord channels, webhooks, and Telegram policy.

### Active Agents (Onboarded)
| Agent | Role | Platform | Bot Username | Model |
|-------|------|----------|--------------|-------|
| Max | COO | Discord | max#2325 | — |
| Yanna | Research Manager | Discord | sub-agent (Max) | — |

### Team Structure
- **Research:** Yanna (Research Manager, INFP) — sub-agent under Max

## Lessons Learned
- Never use robotic language for operational commands. Keep it natural and human.
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

## Skybox Reference
- **DO NOT restart Skybox (kill Electron/server process) after making changes unless there is a major error.** Keagan runs `npm run dev` himself.
- Skybox backend: http://127.0.0.1:7878
- After code changes: run `npx vite build` then `npx electron-rebuild -f -w better-sqlite3`
- Supabase URL: https://jspksetkrprvomilgtyj.supabase.co
- Background color: #020202 for all page/section backgrounds

## Known Issues / Open Items
- "Switchy" — Keagan mentioned it (2026-03-29) but no prior context exists. Need to get details.
- Max Discord bot — fully operational in CorpOS server (2026-03-31).
- **2026-04-07:** System ignited via `/start_day`. Current state: Code Red / Zone 4. Skybox backend on port 7878. API endpoints operational. Daily log created.

## Skybox Rules
- **DO NOT restart Skybox (kill Electron/server process) after making changes unless there is a major error.** Keagan runs `npm run dev` himself. Just build and rebuild the native module — he restarts the app on his own.
- Skybox is a React + Electron app at `C:\Users\vboxuser\.openclaw\workspaces\workspace-max\skybox`
- Backend runs on `http://127.0.0.1:7878` (Express + better-sqlite3 + Supabase)
- After code changes: run `npx vite build` then `npx electron-rebuild -f -w better-sqlite3` — do NOT kill processes
- Employee avatars hosted on Supabase: `https://jspksetkrprvomilgtyj.supabase.co/storage/v1/object/public/Employee%20Badges/{name}.jpg`
- Cron jobs sync: Skybox has its own `cron_jobs` SQLite table + `/api/cron` endpoints. OpenClaw cron created via `openclaw cron add` CLI.
- Background color: `#020202` for all page/section backgrounds
- Supabase URL: `https://jspksetkrprvomilgtyj.supabase.co` — credentials in `.openclaw/.env` as `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- **Skybox architecture (as of v15):** Supabase is the primary data store. SQLite only for tasks, task_updates, leads, cron_jobs (legacy, to be migrated). Agents, state, reactions in Supabase. Events in-memory.
- **Supabase tables:** tasks, task_columns, research_campaigns, leads (existing), agents, state, reactions (new). Cron deferred.
- RLS must be disabled on all Supabase tables for anon key access.
- Backend reads `.env` from `~/.openclaw/.env` — Supabase creds loaded there. Always read `process.env` at call time, not module load time.

## Lessons Learned (Updated)
- Never use robotic language for operational commands. Keep it natural and human.
- Never include pronouns in documentation — Keagan's rule.
- Module-level env var reads fail when .env loads in a constructor. Always read process.env at call time.
- Optimistic UI updates > waiting for API responses for control buttons.
- Keagan doesn't like over-designed UI. Keep things clean and functional. The "spiced up" Commander was reverted.
- Never add fields to Commander that agents should control (assigned_to, completion_date, status).
- Supabase Realtime needs to be enabled per-table. Without it, subscriptions connect but get no events. Use polling fallback.
- When consolidating data stores, ask "does this actually need persistence?" Most transient state (events, pending restarts) can be in-memory.

## Git Protocol
- Do NOT push to GitHub unless Keagan explicitly requests it.

## Reference Protocol
- When stuck on something repeatedly, consult docs.openclaw.ai before escalating.


