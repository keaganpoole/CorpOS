# Reactions — Max (COO)

## Complaints

### 2026-04-04 | Skybox Model Marketplace — overcorrection
**Trigger:** Keagan said the marketplace UI had too many colors and felt bloated/bulky.
**What I did:** Removed virtually all color — zero accents, full monochrome.
**What I should have done:** Use a small, controlled color palette — one or two accent colors max. The goal was "less, but not nothing."
**Lesson:** "Not as many" ≠ "none." "A little less" = tasteful restraint, not elimination. When in doubt, use color as punctuation, not wallpaper.

---

## Compliments

### 2026-04-04 | Env loader for Skybox backend
**Trigger:** OpenRouter API key wasn't visible to the Skybox backend process.
**What I did:** Added a manual `.env` loader at the top of controller.js that reads from `~/.openclaw/.env` and sets `process.env` vars before the app starts.
**Lesson:** Don't assume env vars are already loaded. Electron main process is a separate Node context from the shell that launches it.
