---
name: website-audit
description: Visit and evaluate business websites to determine if they are "relics" — outdated, broken, or ugly sites that need a redesign. Use when Yanna needs to audit a business website, score page quality 0-100, identify opportunities, write Discovery findings, or decide whether to save a lead or reject it. Triggers on "audit website", "check site", "score website", "evaluate site", "is this a relic", "website quality", or any website assessment task.
---

# Website Audit

Visit a business website. Assess it. Score it. Decide: relic or not.

## Audit Workflow

### 1. Visit the Site

Use `agent-browser` to open and inspect the site:

```bash
agent-browser --session audit open "https://businesswebsite.com" && agent-browser --session audit wait 3000
```

### 2. Take a Snapshot

Get the interactive elements — this is your eyes:

```bash
agent-browser --session audit snapshot -i -c
```

### 3. Assess Against Criteria

Evaluate each category. See `references/scoring.md` for full rubric.

| Category | What to check |
|----------|--------------|
| **Design** | Outdated? Ugly colors/fonts? Looks like 2010? |
| **Mobile** | Responsive? Readable on phone? Tap targets work? |
| **Functionality** | Working links? Forms? Online booking? |
| **Content** | Clear value prop? Services listed? Contact info visible? |
| **CTA** | Call-to-action present? Phone number prominent? Lead capture? |
| **Performance** | Loads fast? Images optimized? Broken elements? |

### 4. Score It

Page Quality Score 0–100. See `references/scoring.md` for scale.

| Score | Meaning |
|-------|---------|
| 0 | No website exists |
| 1-20 | Barely functional — broken, placeholder, or under construction |
| 21-40 | Major issues — severely outdated, unusable on mobile, missing critical info |
| 41-60 | Below average — dated design, poor mobile experience, weak CTAs |
| 61-75 | Acceptable — functional but not impressive, room for improvement |
| 76-90 | Good — modern, mobile-friendly, clear CTAs |
| 91-100 | Excellent — nothing to improve |

**Relic threshold: score ≤ 60** → save as lead candidate.

### 5. Identify Opportunities

Tag each issue found. See `references/opportunities.md` for the full list.

Common tags:
- `Outdated Design`
- `Poor Functionality`
- `Not Mobile Friendly`
- `Limited Features`
- `No Clear CTA`
- `Missing Contact Info`
- `No Website` (score 0)

### 6. Write Discovery

Format per the guidelines:

**First:** Bulleted list of weaknesses, organized by type:
```
- Outdated Design: Color scheme and typography look 10+ years old
- Not Mobile Friendly: Layout breaks on mobile, text overlaps
- No Clear CTA: No visible phone number or contact form above the fold
```

**Then:** Narrative explanation:
```
The website appears to be from the early 2010s with a dated color palette and non-responsive layout. On mobile, navigation elements overlap and text becomes unreadable. There's no prominent call-to-action or contact form — visitors have to hunt for a phone number buried in the footer.
```

Be specific. Vague = useless. "Bad design" helps nobody. "Color scheme uses neon green on white with Comic Sans headers" helps everyone.

### 7. Decide

| Score | Decision | Action |
|-------|----------|--------|
| ≤ 60 | **SAVE** — relic found | Record business info → go to `supabase-api` to create lead |
| 61-75 | **BORDERLINE** — could improve | Note in Discovery, but don't save unless campaign is sparse |
| 76+ | **SKIP** — not a relic | Log to `prospects.json` with short reason |

### 8. Cleanup

```bash
agent-browser --session audit close
```

## No Website

If the business has no website at all (no URL found in search/Maps):
- Score: 0
- Opportunity: `No Website`
- Discovery: "No website found. Business appears in Google Maps / [directory] with no web presence."
- **Always save** — no website is the biggest opportunity.

## prospects.json

Rejections go here (not in Supabase). Located in Yanna's workspace root.

Format:
```json
[
  {"company": "Acme Corp", "state": "ME", "checked_at": "2026-04-07T20:00:00Z", "reason": "Modern site, score 82"}
]
```

**Always check prospects.json BEFORE auditing** — if the company is already there, skip it.

## Fallback

If `agent-browser` fails:
1. Use `web_fetch` to grab page content
2. Assess from the extracted text + metadata
3. Note in Discovery: "Assessed from text extraction (browser unavailable)"
4. Score conservatively — lean toward saving if uncertain

## Screenshots

If the site looks unusual or you want visual confirmation for the record:

```bash
agent-browser --session audit screenshot "C:\Users\vboxuser\.openclaw\workspaces\workspace-yanna\screenshots\company-name.png"
```

Optional — not required for every audit.
