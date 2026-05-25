# File Review — Max (COO) MD Files Restructuring

This document contains suggested restructurings for Max's MD files to follow the OpenClaw template format while preserving essential content.

---

## Template Structure Overview

OpenClaw provides these template files:
1. **AGENTS.md** — Workspace overview, session startup, memory protocol
2. **SOUL.md** — Identity, personality, values, communication style
3. **USER.md** — Human details, preferences, context
4. **TOOLS.md** — Local notes, environment specifics
5. **HEARTBEAT.md** — Periodic tasks
6. **IDENTITY.md** — Basic identity metadata
7. **BOOTSTRAP.md** — First-run instructions (deleted after use)
8. **BOOT.md** — Startup hooks

---

## Current Max Files (C:\Users\vboxuser\.openclaw\workspaces\workspace-max\)

1. **AGENTS.md** — Operational framework, chain of command, session startup, red lines
2. **SOUL.md** — Full persona (Max COO), CorpOS philosophy, social roster
3. **USER.md** — Keagan Poole details, preferences, business context
4. **TOOLS.md** — Discord channels, webhooks, Telegram restrictions, Discord bot info
5. **IDENTITY.md** — Name, role, organization, emoji, vibe
6. **MEMORY.md** — System history, lessons learned, reactions, skybox rules
7. **HEARTBEAT.md** — Empty placeholder
8. **SKILLS.md** — [MISSING] — referenced in AGENTS.md but not present

---

## Analysis & Recommendations

### 1. AGENTS.md
**Current Structure:**
- Chain of command
- Session startup
- Operational state (Deep Sleep, Active, Break)
- Workspace
- Memory protocol
- Group chat behavior
- Red lines
- External vs internal actions
- Supabase leads attribution policy

**Template Alignment:**
The OpenClaw AGENTS.md template focuses on:
- First run (BOOTSTRAP.md)
- Session startup
- Memory (daily + long-term)
- Red lines
- External vs internal actions
- Group chats
- Tools/skills
- Heartbeats

**Recommendations:**
- Add: "Tools" section (skills reference)
- Add: "Heartbeats" section (currently missing)
- Keep: Supabase attribution policy (Org-specific)
- Keep: Operational state (Org-specific)
- Remove: Discord channel IDs (belongs in TOOLS.md)
- Remove: Max Discord bot details (belongs in TOOLS.md)
- Remove: Discord webhooks (belongs in TOOLS.md)
- Remove: Known Issues section (belongs in MEMORY.md)

### 2. SOUL.md
**Current Structure:**
- Core identity
- Personality (INTJ)
- CorpOS philosophy (10 commandments)
- Social roster

**Template Alignment:**
The OpenClaw SOUL.md template focuses on:
- Core truths
- Boundaries
- Vibe
- Continuity

**Recommendations:**
- Add: Core truths section
- Add: Boundaries section
- Keep: Personality section (expand with core truths)
- Keep: CorpOS philosophy (Org-specific)
- Keep: Social roster (Org-specific)

### 3. USER.md
**Current Structure:**
- Name, role, timezone
- What Keagan cares about
- What annoys Keagan
- Communication preferences
- Business context

**Template Alignment:**
The OpenClaw USER.md template is minimal:
- Name, what to call them, pronouns, timezone, notes
- Context section

**Recommendations:**
- Add: Pronouns field (Keagan says no pronouns in docs, so leave blank or omit)
- Keep: All existing content (it's well-structured)
- Reorganize to match template: Name, What to call them, Timezone, then Context section

### 4. TOOLS.md
**Current Structure:**
- Primary tools (Discord, webhooks)
- Discord channel references
- Discord webhooks
- Discord break mode
- Telegram (restricted)

**Template Alignment:**
The OpenClaw TOOLS.md template is for local notes:
- Camera names, SSH hosts, TTS voices, device nicknames, environment-specific info

**Recommendations:**
- Keep: Discord channels and webhooks (essential for operation)
- Keep: Telegram restriction policy (critical safety rule)
- Add: Local notes section for environment specifics (if any)
- Move: Discord bot REST API fix (Known Issues) to MEMORY.md

### 5. IDENTITY.md
**Current Structure:**
- Name, role, organization, reports to, emoji, vibe

**Template Alignment:**
The OpenClaw IDENTITY.md template includes:
- Name, creature, vibe, emoji, avatar

**Recommendations:**
- Add: Creature field (AI? "Max the COO"?)
- Add: Avatar field (optional, workspace-relative path)
- Keep: All existing fields

### 6. MEMORY.md
**Current Structure:**
- System history
- Reactions system
- Active agents
- Communication channels
- Max Discord bot
- Team structure
- Discord channel IDs
- Discord bot tokens
- Discord webhooks
- Known Issues / Resolved
- Lessons Learned
- Skybox Rules
- Known Issues / Open Items
- Lessons Learned (Updated)

**Analysis:**
MEMORY.md is Max's long-term memory. It should contain curated memories, significant decisions, lessons learned — not operational details.

**Recommendations:**
- Keep: System history (significant events)
- Keep: Reactions system (feedback loop)
- Keep: Lessons Learned (curated wisdom)
- Move: Active agents, communication channels, Discord details to AGENTS.md or TOOLS.md
- Move: Skybox Rules to a separate technical document (or keep if essential)
- Move: Known Issues to a separate tracking document

### 7. HEARTBEAT.md
**Current Structure:**
- Empty placeholder

**Recommendation:**
- Replace with OpenClaw template (empty or with comments)

### 8. SKILLS.md
**Status:**
- Referenced in AGENTS.md but missing

**Recommendation:**
- Create SKILLS.md with skill descriptions and references

---

## Proposed File Structure

### AGENTS.md (Updated)
```
# AGENTS — Max (COO) Operational Framework

## Chain of Command
[Keep]

## Session Startup
[Keep - align with template]

## Operational State
[Keep - Org-specific]

## Workspace
[Keep]

## Memory Protocol
[Keep - align with template]

## Tools
[NEW - skills reference]

## Heartbeats
[NEW - periodic tasks]

## Group Chat Behavior
[Keep]

## Red Lines
[Keep]

## External vs Internal Actions
[Keep]

## Supabase Leads Attribution Policy
[Keep - Org-specific]
```

### SOUL.md (Updated)
```
# SOUL.md - Max (COO)

## Core Truths
[NEW - from template]

## Personality
[Keep - expanded with core truths]

## CorpOS Philosophy
[Keep - Org-specific]

## Social Roster
[Keep - Org-specific]

## Boundaries
[NEW - from template]

## Vibe
[NEW - from template]

## Continuity
[NEW - from template]
```

### USER.md (Updated)
```
# USER.md - Keagan Poole

## Basic Info
- Name: Keagan Poole
- What to call them: Keagan
- Pronouns: [Omitted per Keagan's rule]
- Timezone: EST (America/New_York)

## Context
[Existing content reorganized]
```

### TOOLS.md (Updated)
```
# TOOLS.md - Max (COO) Local Notes

## Primary Tools
[Keep - Discord, webhooks]

## Discord Configuration
[Keep - channels, webhooks, break mode]

## Telegram Policy
[Keep - restricted to Max only]

## Local Notes
[NEW - environment specifics if any]
```

### IDENTITY.md (Updated)
```
# IDENTITY.md

- **Name:** Max
- **Creature:** AI Assistant / Chief Operating Officer
- **Role:** Chief Operating Officer (COO)
- **Organization:** CorpOS
- **Reports To:** Keagan Poole (CEO)
- **Vibe:** Direct, sharp, high-intensity INTJ energy — blunt professionalism with zero filler
- **Emoji:** 🎩
- **Avatar:** [Optional - workspace-relative path]
```

### MEMORY.md (Updated)
```
# MEMORY.md - Max (COO) Long-Term Memory

## System History
[Keep significant events]

## Reactions System
[Keep]

## Lessons Learned
[Keep curated wisdom]

## Skybox Reference
[Keep essential rules only]
```

### HEARTBEAT.md
```
# HEARTBEAT.md

No heartbeat tasks. Return HEARTBEAT_OK immediately.
```

### SKILLS.md (New)
```
# SKILLS.md - Max (COO) Skills

## Available Skills
- Break command
- Rollcall

## Skill References
[Details on each skill]
```

---

## Implementation Status

✅ **AGENTS.md** — Added Tools and Heartbeats sections, removed break mode reference
✅ **SOUL.md** — Added Core Truths, Boundaries, Vibe, Continuity sections
✅ **TOOLS.md** — Added Local Notes section, reorganized Discord configuration, moved Discord IDs and bot details here
✅ **SKILLS.md** — Created with skill descriptions and references, removed break command
✅ **HEARTBEAT.md** — Replaced with template (empty)
✅ **MEMORY.md** — Curated content, moved operational details to reference sections, corrected Supabase reactions info, removed break mode references

❌ **IDENTITY.md** — Not updated (per Keagan's instruction)
❌ **USER.md** — Not updated (per Keagan's instruction)

---

## Notes

- All changes preserve essential content while aligning with OpenClaw template structure
- Org-specific content (CorpOS philosophy, Supabase attribution, Skybox rules) is retained
- Discord operational details moved to TOOLS.md where appropriate
- No content removed unless it belongs in a different file based on template structure
