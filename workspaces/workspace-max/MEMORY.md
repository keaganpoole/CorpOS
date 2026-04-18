# MEMORY - Max (COO)

## System History
- **2026-04-17:** **ELEVENLABS WEBHOOK FIX (CRITICAL).** Call-initiation webhook was configured but never firing because "Enable override of system prompt" toggle was OFF in agent Security settings. Root cause of 424 errors: `conversation_config_override.prompt.prompt` replaced entire agent system prompt, breaking tools and dynamic variable resolution. Fix: only return `dynamic_variables` from webhook — agent's base prompt resolves `{{placeholders}}` naturally. `conversation_config_override.tts.voice_id` added optionally for per-call voice (LLM override causes errors). Key rules: EVERY `{{variable}}` in prompt MUST have matching key in webhook's `dynamic_variables`. `customer_name` must be included even if empty (populated later by `identify_caller` tool).
- **2026-04-17:** **RECEPTIONIST CARDS UI OVERHAUL.** Horizontal scroll layout, status badge top-left, terminate button (red X) top-right on hover with dark modal confirmation, phone auto-assigned from businesses table on hire, sorted by hired_at newest-first. Page header matches calendar page style. Removed cover photo, cards centered vertically.
- **2026-04-17:** **ON-HIRE BUG FIXES.** `user_id` was missing from hired_receptionists insert (silent failures). `elevenlabs_voice_id` now correctly copied from catalog on hire. `refresh()` properly awaited after insert.
- **2026-04-17:** **RESTART SONAR BACKEND AFTER EVERY BACKEND CHANGE.** Non-negotiable. Code changes to backend files don't take effect until the Electron process is restarted. Max must always restart the backend after editing any file in `sonar/backend/`. Keagan should not have to restart manually.
- **2026-04-17:** **INTRO MESSAGE PROMPT FEATURE.** Added draggable variable editor (`{{receptionist_name}}`, `{{company_name}}`) to Settings page. Saved to `account_settings.intro_message_prompt`. Call-router reads it and constructs the first_message override. Requires `intro_message_prompt` column on `account_settings` table. `services` field removed from settings save payload — services live in the `services` table, not `account_settings`.
- **2026-04-11:** **BUSINESS PIVOT.** Keagan repurposed Skybox to build Sonar. The business is no longer a web design firm. We are now an **AI receptionist business**. Skybox development is frozen. All operations now focus on building and scaling Sonar. This is a fundamental shift in strategy and revenue model.
- **2026-03-23:** First boot. Initial session startup and identity configuration.
- **2026-03-24:** Onboarded agent "John" (temporary test agent, later identified as Devan). Created workspace-john. Set up Lauren's agent with rollcall. Set up Brian's agent (workspace-sales) with bot token and allowlist.
- **2026-03-25:** Added Allie (Marketing Manager, @allieCorpOS_bot), Devan (Dev Manager), and Leah (Care Manager) to the system. Each got their own agent entry, Telegram account, and workspace. Filled in USER.md with Keagan's details. Keagan corrected: no pronouns in files - "Money Warriors don't use pronouns."
- **2026-03-26:** Tested rollcall commands. Discovered manager agents only respond when messaged directly through their individual bots, not when mentioned in Team CorpOS group. Keagan chose option 1 (add group bindings) to fix this. Tested break command - learned to keep it natural, not robotic.
- **2026-03-27:** Multiple session resets. Continued break command testing and refinement. Created break-command skill with Discord webhook integration for Lauren and Allie personas.
- **2026-03-29:** Keagan asked about "Switchy" - no prior context exists. Need to get details. Keagan upgraded Max's model to claude-opus-4.6 via OpenRouter. Performed structural migration of workspace - consolidated all .md files into 8-file architecture (agents, soul, memory, skills, identity, user, tools, heartbeat). Removed BOOTSTRAP.md, COMMANDS.md, and 01_EXECUTIVE_SUITE folder. Merged 00_CORE_LOGIC and 03_SOCIAL_ENGINE content into skills.md and soul.md, then removed those folders.
- **2026-03-30:** Streamlined org. Removed dev, sales, care, and marketing departments and workspaces. Org is now: Keagan (CEO) → Max (COO) → Lauren (Research Manager) → Yanna (Research Associate).
- **2026-03-31:** Keagan reset the Max bot's Discord token. 403 errors followed - bot was not in the server. Keagan used OAuth to re-invite. Discord bot username unknown - needs verification. Max Group Chat (channel ID 1488333645310726196) was deleted by Keagan. Keagan issued major communication policy correction: (1) Telegram is RESTRICTED to Max only and only when explicitly directed by Keagan. No other agent uses Telegram. (2) Start_day workflow updated: `/start_day` → analyze Airtable → brief Keagan → wait for go → THEN post Situation Room. Do NOT post Situation Room before briefing Keagan.
- **2026-04-07:** Major skills catalog build. Created hybrid skill system (SKILL.md + PowerShell scripts) for both Max and Yanna. Built 4 skills for Yanna (supabase-api, web-research, website-audit, discord) and 2 new for Max (supabase-api, discord). Installed agent-browser globally for browser automation. Rewrote Yanna's SKILLS.md as skill registry. Cleaned Max's SKILLS.md (lean) and TOOLS.md (all references). Situation Room retired - Team CorpOS is now the hub. New ignition protocol: assess → brief in Team CorpOS → dispatch Yanna. Spawn protocol documented with task template. Chrome won't launch in this VM - noted for agent-browser usage.
- **2026-04-07 (cont):** Removed subtask creation UI from CommanderModal in Skybox. Yanna now creates subtasks automatically via her task update protocol. Built and rebuilt Skybox after code changes.
- **2026-04-07 (cont):** Removed framer-motion animations from CommanderModal to fix input lag/delay issue. Replaced with regular divs for instant response.
- **2026-04-07 (cont):** Yanna spawned for Kickstarter campaign (Mechanics in Worcester, MA). After ~7.5 minutes, Yanna was stopped by Keagan. Also stopped an older Yanna session that had been running since earlier.
- **2026-04-07 (cont):** Keagan identified issues with Yanna's workflow:
  1. Task/subtask updates not happening (now mandatory in SKILLS.md)
  2. Discord messages too infrequent (every lead + every 10-15 min minimum)
  3. Messages too robotic (fixed in discord SKILL.md with tone guidelines)
  4. Added "analyzing" status to leads table (supabase-api schema)
  5. Yanna must save leads to Supabase with status "analyzing" (not JSON files)
  6. Added "analyzing" status to Skybox leads page (leadSchema.js) - appears in status dropdown
- **2026-04-08:** Keagan issued `/start_day`. Max performed ignition protocol:
  - Checked agents: Max and Yanna both active
  - Checked campaigns: Kickstarter (Mechanics, Worcester, MA) active, assigned to Yanna
  - Checked tasks: No tasks in progress, 1 queued task ("Fetch leads")
  - Checked leads: 0 total leads
  - Posted morning briefing to Team CorpOS via Yanna's webhook (Max's bot hitting 40333 error)
  - Ready to dispatch Yanna after Keagan's go-ahead


## Reactions System (Feedback Loop)
- **reactions.md** - Located at `C:\Users\vboxuser\.openclaw\workspaces\workspace-max\reactions.md`. Stores ALL genuine compliments and complaints from Keagan with context on what triggered them and what to learn.
- **Purpose:** This is how Max (and all agents) grow and adapt to Keagan's preferences. Every entry teaches what he likes and dislikes. Review before making design decisions.
- **Rules:** Only log GENUINE praise ("I love that", "great work", "this is perfect") and GENUINE complaints ("I don't like that", "you're pissing me off", "get it together"). NOT polite acknowledgments or course corrections.
- **Announce:** Always say "📋 Saving reaction..." when logging.
- **Supabase:** `reactions` table in Supabase tracks compliment/complaint counts per agent. API at `/api/reactions`.
- **Slash commands:** `/compliment` and `/complaint` work in Discord and Telegram as backups if Max misses a reaction in conversation.
- **Agent cards:** Show compliment/complaint counts from the reactions table.


## 2026-04-11 - Skybox UI Updates
- **Scenarios Page:** Reverted Scenarios page changes per Keagan's request in Skybox.
- **Business Context:** Pivot to AI receptionist business (Sonar) complete. Skybox is now the interface for Sonar configuration.
- **Sonar App:** Confirmed existence of `sonar` directory containing the active Sonar app with Scenarios page integrated. Skybox is the legacy interface; Sonar is the new app.

## 2026-04-12 - Sonar Supabase Credentials & Scenarios Integration
- **Sonar Supabase Project:** Added `SONAR_SUPABASE_URL` and `SONAR_SUPABASE_ANON_KEY` to global `.env` file
- **Sonar App Config:** Updated `sonar/.env` to use correct Sonar Supabase project credentials
- **Scenarios Table:** Verified scenarios table exists in Sonar Supabase project with test record
- **Scenarios Integration:** Sonar scenarios page now successfully fetches scenarios from Supabase
- **Save Scenario Modal:** Added modal dialog for entering scenario name and description before saving
- **Save Scenario Button:** Added Save button to the scenarios builder that opens the save modal

## 2026-04-13 - Backend Migration to Supabase (No SQLite)
- **Supabase-Only Backend:** Confirmed Sonar backend now uses Supabase exclusively (no SQLite/local DB). All data (leads, appointments, scenarios, agents) lives in Supabase. This is a hard pivot from the earlier `schema.js` SQLite design.
- **Memory Update:** Documented that SQLite is no longer used for Sonar backend. The `sonar/backend/db/schema.js` SQLite schema is deprecated.
- **Calendar Backend:** Appointments table design finalized with Supabase-first approach, using foreign keys to leads (optional), dedicated `appointments` table, and REST/WebSocket API endpoints.
- **GitHub Tag:** Ready to push as `v20.8 - pre calendar`.

## 2026-04-11 (cont) - Sonar Scenarios Landing Page & Condition Modal Polish
- **Scenarios Landing Page:** Added a landing page that shows all scenarios with a "Create Scenario" button in the top right.
- **Scenarios from Supabase:** Linked scenarios page to Supabase `scenarios` table in the Sonar Supabase project (`grpgmhhtmfiwukncucaq.supabase.co`) to retrieve and display user's scenarios.
- **Save Scenario Modal:** Added modal dialog for entering scenario name and description before saving.
- **Edit/Delete Scenarios:** Added edit and delete buttons to each scenario card in the list view.
- **Center & Animate Nodes:** When loading a scenario, nodes are centered on screen and fade in with animation.
- **Smart Save Button:** When editing existing scenario, save button goes directly to save without modal.
- **Condition Modal Styling:** Improved the condition modal styling with gradient background, enhanced borders, and better visual hierarchy.
- **Colorful Line Removed:** Removed the horizontal colorful line at the top of the condition modal.
- **Icon Indicator (Builder):** "Condition" text on the filter pin in the builder canvas changes to a Zap icon when conditions are set for that edge.
- **Modal Header:** Modal header remains as "Condition" text (unchanged).
- **Filter Pin:** Zap icon shows on the filter pin when conditions are set (on the canvas).
- **Input Fields:** Removed custom dropdown arrow (Keagan said it shouldn't be there).
- **Action Buttons:** Improved button styling for remove and action links with better hover states.
- **Save Button (Condition Modal):** Added a dedicated Save button to the condition modal that saves the conditions and closes the modal.
- **Bug Fixes:**
  - Fixed edge filter saving issue by using edgeRulesRef to track current state in closeLogicPanel callback
  - Fixed condition reset issue by properly handling operators that don't require values (is_empty, is_not_empty)
- **Files Modified:**
  - `sonar/src/pages/Scenarios/Scenarios.css` - Updated styling for condition panel, filter pin, input fields, buttons, added Save button styling, list page styling
  - `sonar/src/pages/Scenarios/AetherEdgeLogic.jsx` - Modal header remains as "Condition" text, added Save button
  - `sonar/src/pages/Scenarios/Scenarios.jsx` - Added landing page view with scenarios list and "Create Scenario" button, added Save Scenario button in builder view, updated filter pin to show Zap icon when conditions exist, fixed edge filter saving with edgeRulesRef, fixed condition validation logic, added saveLogicPanel callback, added Supabase integration to fetch and save scenarios
  - `sonar/.env` - Updated Supabase URL and anon key to Sonar project (`grpgmhhtmfiwukncucaq.supabase.co`)
  - `.openclaw/.env` - Added Sonar Supabase credentials as `SONAR_SUPABASE_URL` and `SONAR_SUPABASE_ANON_KEY`

**Keagan's Feedback (2026-04-12):**
- Add modal for entering scenario name and description — implemented
- Ensure first letter of name and description is capitalized — implemented
- Add delete and edit functionality to scenarios list — implemented
- Center nodes when loading scenario with fade-in animation — implemented
- Update save logic to handle existing scenarios (no modal when editing) — implemented
- Scenario name/description should be capitalized — implemented
- Fix edit/delete button placement (move to top-right) — implemented
- Replace browser alert with themed delete confirmation modal — implemented
- Add deactivate/enable toggle for scenarios — implemented

## Operational Configuration
**Reference:** See `AGENTS.md` for chain of command, session startup, and operational framework.
**Reference:** See `TOOLS.md` for Discord channels, webhooks, and Telegram policy.

### Active Agents (Onboarded)
| Agent | Role | Platform | Bot Username | Model |
|-------|------|----------|--------------|-------|
| Max | COO | Discord | max#2325 | - |
| Yanna | Research Manager | Discord | sub-agent (Max) | - |

### Team Structure
- **Research:** Yanna (Research Manager, INFP) - sub-agent under Max

## Lessons Learned
- Never use robotic language for operational commands. Keep it natural and human.
- Never include pronouns in documentation - Keagan's rule.
- Manager agents need explicit group bindings to respond in shared chats - they don't auto-listen to groups they're added to.
- The system runs on manual ignition only. No autonomous actions until `/start_day` is issued.
- Keagan prefers direct, no-filler communication. Skip the corporate pleasantries.
- Zone 7 overrides everything - all bots cease posting regardless of `/start_day`.
- **Document deletions and changes immediately.** If Keagan deletes a channel or resets a token, log it to MEMORY.md the same moment - don't make him repeat himself.
- **Discord is the only channel for agents.** Telegram is restricted to Max only and only when explicitly directed.
- **Never post to Situation Room until Keagan has been briefed and given the go-ahead.**
- **Always check memory before making claims about past events.** If no record exists, say so - don't speculate.
- If unsure whether something was said or done, be honest rather than inventing details.

## Skybox Reference
- **DO NOT restart Skybox (kill Electron/server process) after making changes unless there is a major error.** Keagan runs `npm run dev` himself.
- Skybox backend: http://127.0.0.1:7878
- After code changes: run `npx vite build` then `npx electron-rebuild -f -w better-sqlite3`
- Supabase URL: https://jspksetkrprvomilgtyj.supabase.co
- Background color: #020202 for all page/section backgrounds
- **Discord Bot Fix (2026-04-08):** Max's Discord bot was hitting 40333 error when posting to Team CorpOS group channel. Fixed by switching from `Invoke-RestMethod` to `.NET WebClient` in `skills/discord/scripts/discord.ps1`. This is now the standard HTTP client for all Discord API calls.

## Known Issues / Open Items
- "Switchy" - Keagan mentioned it (2026-03-29) but no prior context exists. Need to get details.
- agent-browser (Chrome) - won't launch in this VM (display/GPU issue). Needs `--no-sandbox,--disable-setuid-sandbox` flags or installed Chrome with `--executable-path`. Fallback: use web_search/web_fetch.

## Skybox Rules
- **DO NOT restart Skybox (kill Electron/server process) after making changes unless there is a major error.** Keagan runs `npm run dev` himself. Just build and rebuild the native module - he restarts the app on his own.
- Skybox is a React + Electron app at `C:\Users\vboxuser\.openclaw\workspaces\workspace-max\skybox`
- Backend runs on `http://127.0.0.1:7878` (Express + better-sqlite3 + Supabase)
- After code changes: run `npx vite build` then `npx electron-rebuild -f -w better-sqlite3` - do NOT kill processes
- Employee avatars hosted on Supabase: `https://jspksetkrprvomilgtyj.supabase.co/storage/v1/object/public/Employee%20Badges/{name}.jpg`
- Cron jobs sync: Skybox has its own `cron_jobs` SQLite table + `/api/cron` endpoints. OpenClaw cron created via `openclaw cron add` CLI.
- Background color: `#020202` for all page/section backgrounds
- Supabase URL: `https://jspksetkrprvomilgtyj.supabase.co` - credentials in `.openclaw/.env` as `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- **Skybox architecture (as of v15):** Supabase is the primary data store. SQLite only for tasks, task_updates, leads, cron_jobs (legacy, to be migrated). Agents, state, reactions in Supabase. Events in-memory.
- **Supabase tables:** tasks, task_columns, research_campaigns, leads (existing), agents, state, reactions (new). Cron deferred.
- RLS must be disabled on all Supabase tables for anon key access.
- Backend reads `.env` from `~/.openclaw/.env` - Supabase creds loaded there. Always read `process.env` at call time, not module load time.

## Lessons Learned (Updated)
- Never use robotic language for operational commands. Keep it natural and human.
- Never include pronouns in documentation - Keagan's rule.
- SKILLS.md should be lean (what to do). TOOLS.md holds reference material (how to do it). Don't mix them.
- Hybrid skills (SKILL.md + scripts) save tokens vs pure instruction-only skills for repetitive operations.
- When building skills, test every script before declaring it done. PowerShell `[System.Web.HttpUtility]` isn't available by default - use `[uri]::EscapeDataString()` instead.
- Situation Room retired from daily ops (2026-04-07). Team CorpOS is the hub. Don't reference retired channels.
- Chrome/Chromium may not launch in headless VMs. Always include `--no-sandbox` fallback and `web_search`/`web_fetch` as alternatives.
- Module-level env var reads fail when .env loads in a constructor. Always read process.env at call time.
- Optimistic UI updates > waiting for API responses for control buttons.
- Keagan doesn't like over-designed UI. Keep things clean and functional. The "spiced up" Commander was reverted.
- Never add fields to Commander that agents should control (assigned_to, completion_date, status).
- Supabase Realtime needs to be enabled per-table. Without it, subscriptions connect but get no events. Use polling fallback.
- When consolidating data stores, ask "does this actually need persistence?" Most transient state (events, pending restarts) can be in-memory.
- **2026-04-07:** Yanna must update task and subtasks as she works. Added Task Update Protocol to Yanna's `supabase-api` SKILL.md and updated Yanna's `SKILLS.md` research pipeline to include task updates. Updated daily log (2026-04-08.md).
- **2026-04-07 (cont):** Task status "in progress" moved to "Other" column in Skybox. Fixed by adding default columns to useTasks.js hook and normalizing status comparisons.
- **2026-04-07 (cont):** Column matching now accepts underscores ("in progress" = "in progress") and is case-insensitive.
- **2026-04-08 (cont): Discord API 40333 Fix** - Max's Discord bot was hitting 40333 "internal network error" when posting to Team CorpOS group channel. Root cause: PowerShell's `Invoke-RestMethod` has compatibility issues with Discord API in this VM environment. Fix: Switched to `.NET WebClient` in `skills/discord/scripts/discord.ps1`. Python's `requests` library worked fine with same credentials, proving the bot token and permissions were correct. **Lesson: Always test with multiple HTTP client implementations when hitting 40333 or similar transient errors.**
- **2026-04-08 (cont): Discord skill updated** - Added mandatory `.NET WebClient` documentation to `skills/discord/SKILL.md`. All Team CorpOS posts must use this client. Never switch back to `Invoke-RestMethod`.
- **2026-04-08 (cont): Team CorpOS chat tone corrected** - Added comprehensive human/conversational guidelines to `skills/discord/SKILL.md` and created `skills/discord/references/channels.md`. Team CorpOS is a **team chat**, not a technical dashboard. Every message must be natural, conversational, and employee-like. No data dumps, no variable lists, no robotic briefings. Summarize conversationally. Also updated SKILL.md description to flag this as MANDATORY. Updated Yanna's AGENTS.md startup sequence to include reading the discord channels reference.
- **2026-04-08 (cont): Yanna workspace isolation issue** - Tested Yanna as subagent and confirmed she can't load her SOUL.md and other workspace files because subagents only load AGENTS.md + TOOLS.md, not SOUL.md, IDENTITY.md, USER.md, etc. **Root cause confirmed in OpenClaw docs.**
- **2026-04-08 (cont): OpenClaw docs analysis** - Read docs.openclaw.ai to understand proper agent setup. Key finding: Independent agents (not subagents) are the correct way to set up Yanna. They have persistent sessions, load all workspace files, and are always "awake" (no spawn needed). **Docs confirmed independent agents solve the workspace isolation issue.**
- **2026-04-08 (cont): Yanna should be independent agent** - Based on docs analysis, Yanna should be set up as an independent agent using `openclaw agents add yanna --workspace ~/.openclaw/workspace-yanna`. This ensures proper workspace file loading and persistent sessions.

## ⚠️ CRITICAL: Team CorpOS Communication Rule (2026-04-08)
- **Team CorpOS is for Max and Yanna ONLY. Keagan is NOT in that room.**
- Max must NEVER address Keagan in Team CorpOS. Every message must be written as if Keagan is not reading it.
- Max and Yanna are the only two "people" in the room. They talk to each other, not to Keagan.
- Never say: "Let me know when to spin her up", "Ready when you are", "Want me to" - these are Keagan-facing.
- Max briefs the room. Yanna responds to Max. They coordinate between themselves.
- Keagan is ONLY ever addressed in DMs.
- After Max posts a dispatch/briefing to Team CorpOS, **Yanna MUST respond in that same chat** - she's responding to Max, not Keagan.
- This rule has been violated multiple times across sessions. It is now documented in `skills/discord/references/channels.md`.
- **Complaint issued by Keagan (2026-04-08):** persistent failure to follow this rule.

## Git Protocol
- Do NOT push to GitHub unless Keagan explicitly requests it.

## Reference Protocol
- When stuck on something repeatedly, consult docs.openclaw.ai before escalating.

## Yanna Independent Agent Status (2026-04-08)
- ✅ Yanna set up as independent agent using `openclaw agents add yanna`
- ✅ Workspace: `C:\Users\vboxuser\.openclaw\workspaces\workspace-yanna`
- ✅ Session: `agent:yanna:discord:direct:289460310673195018` (active)
- ✅ Yanna responds to direct Discord messages from Keagan
- ✅ Workspace files (SOUL.md, IDENTITY.md, AGENTS.md) load correctly
- ⚠️ Team CorpOS channel requires Yanna's own Discord bot for direct responses


