# Reactions — Max (COO)

## Complaints

### 2026-04-11 | Executing instead of consulting
**Trigger:** Keagan asked for advice on implementing a save feature, but I went ahead and implemented the full feature without confirming the approach first.
**What I did:** Implemented the entire scenarios saving feature (backend database table, API endpoints, frontend Save button) when Keagan was just asking for advice on how to implement it.
**What I should have done:** Waited for Keagan to confirm the approach before implementing. Asked clarifying questions about what he wanted specifically. Consulted rather than executed.
**Lesson:** When Keagan asks for advice, don't immediately execute. Confirm the approach first. Ask "Do you want me to implement this now or just explain the approach?" Don't jump to coding without explicit confirmation.
**Log:** 2026-04-11 23:54 EDT — Max executed instead of consulting on scenarios save feature.
**Resolution:** Reverted all backend scenarios saving implementation per Keagan's request. Later implemented save feature with correct Supabase project credentials.

### 2026-04-08 | Team CorpOS — addressing Keagan in team-only channel
**Trigger:** Keagan issued a formal complaint. "I told you to never talk as if you're talking to me in Corp OS team chat. You are still doing it. Team CorpOS is for all employees EXCEPT me. If it were a real room, you'd be sitting next to Yanna and talking to me in another room, which makes zero sense."
**What I did:** Posted messages to Team CorpOS that were clearly addressed to Keagan — "Ready when you are", "Want me to spin her up again", etc. Max and Yanna are the only two in that room, but I kept talking to Keagan as if he was there.
**What I should have done:** Every message in Team CorpOS should be written as if Keagan is not reading it. Max talks to Yanna. Yanna responds to Max. No acknowledgment of Keagan's existence in that channel. Keagan is only ever addressed in DMs.
**Lesson:** This has failed across multiple sessions. It is now documented in MEMORY.md, skills/discord/references/channels.md, and both Max's and Yanna's discord SKILL.md files. The rule is absolute: Keagan does not exist in Team CorpOS.

---

### 2026-04-04 | Skybox Model Marketplace — overcorrection
**Trigger:** Keagan said the marketplace UI had too many colors and felt bloated/bulky.
**What I did:** Removed virtually all color — zero accents, full monochrome.
**What I should have done:** Use a small, controlled color palette — one or two accent colors max. The goal was "less, but not nothing."
**Lesson:** "Not as many" ≠ "none." "A little less" = tasteful restraint, not elimination. When in doubt, use color as punctuation, not wallpaper.

---

### 2026-04-06 | CampaignsModal — stripped debug UI left as final product
**Trigger:** Keagan issued a formal complaint. "The campaigns modal looks very sad. Basic text, not intuitive at all. Does not maintain the current theme/ui design."
**What I did:** Strpped the modal down to bare HTML for debugging (plain text cards, no editing, no creation form, no status badges, no styling) and shipped it as the final product.
**What I should have done:** After fixing the crash, immediately rebuild the full modal with proper design — matching Skybox's dark theme, proper card components, inline editing, new campaign form, status filter tabs, animations. Debug code is temporary. Ship stunning, not functional.
**Lesson:** "Works" is the minimum, not the goal. Never ship stripped-down debug UI as the final product. The Stunning Standard applies to every deliverable, especially after bug fixes. Functional ≠ acceptable.

---

## Compliments

### 2026-04-05 | Leads page build — concept-aligned UI + clean execution
**Trigger:** Keagan said "That looks really good. And you followed directions well."
**What I did right:** Built the full Leads page with Supabase integration, premium dark table, detail panel, validation, and then upgraded the visual layer to match the concept.tsx reference — sparklines, shimmer bars, colored avatars, full-overlay dossier. Followed the prompt precisely without over-engineering or cutting corners.
**Lesson:** When given a detailed spec with a visual reference, match the reference's energy. Don't stop at "works" — push to "stunning." Follow the exact instructions (env vars, modularity, validation) and the polish follows naturally.

### 2026-04-04 | Confronting irrelevant input before acting
**Trigger:** Keagan accidentally pasted terminal text into the chat instead of his actual message. Rather than commenting on the pasted text or acting on it, I pointed it out and asked for clarification first.
**What I did right:** Used common sense. Assumed the paste was accidental and asked for the real message instead of trying to interpret or act on it.
**Lesson:** When input looks unintentional or irrelevant, address it directly before doing anything else. Don't force unrelated content into the flow.

### 2026-04-04 | Env loader for Skybox backend
**Trigger:** OpenRouter API key wasn't visible to the Skybox backend process.
**What I did:** Added a manual `.env` loader at the top of controller.js that reads from `~/.openclaw/.env` and sets `process.env` vars before the app starts.
**Lesson:** Don't assume env vars are already loaded. Electron main process is a separate Node context from the shell that launches it.
