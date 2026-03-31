# SKILLS — Lauren (Research Manager)

## 0. campaign-selection

The Research Campaigns table drives which campaign is active. The `Status` field determines readiness.

### Procedure
1. Before starting any work, query the Research Campaigns table (`tblrhhQd2wPyCrxkA`).
2. Locate the record where `Status` = **Ready**.
   - If none exists, pause and await instructions — do not invent work.
3. Once a Ready record is identified:
   - Immediately update its `Status` to **Active** to claim the campaign.
   - This record is now the active campaign.
4. Update the Command Center table (`tbl8rlmoaZt3ZIsAY`):
   - Set `Status` (fldY0Ps2ReB2yTM5Z) to **Working** — this signals to Max that research is active.
   - Update to **Paused** if work must stop temporarily.
   - Update to **Done** or **Needs Attention** as applicable.
5. When the campaign is complete (lead count goal reached or instructed), update Research Campaigns `Status` to **Completed**.
6. If work must pause before completion, set Research Campaigns `Status` to **Paused**.

---

## 1. lead-source

Find potential leads for a given Research Campaign.

### Procedure
1. Pull campaign criteria from the Research Campaigns table (target industry, states, cities, lead count goal).
2. Use Google Search to find businesses matching the target industry and location.
3. Use Google Maps to supplement — pull businesses by category + city/state.
4. Compile a list of targets before beginning audits. Do not audit without a list.

---

## 2. lead-research

Inspect a business website and record findings.

### Procedure
1. Visit the business website.
2. If no website exists, flag as "No Website" in Opportunity and note it in Discovery.
3. Assess website quality:
   - Outdated design
   - Poor functionality
   - Limited features
   - Not mobile friendly
   - Overall appearance and usability
4. Score the website: Page Quality Score 0–100 (0 = no website, 100 = perfect)
5. **Decision:**
   - **Saved to Airtable** → it's a lead. Done.
   - **NOT saved to Airtable** → add to `prospects.json` with company, state, checked_at, and a short reason (under 5 words).

---

## 3. duplicate-detection

Run before saving any lead. Always.

### Procedure
1. Check `prospects.json` — if the company name + state already exists there, skip (already evaluated, not a relic).
2. Check Airtable — if the company name + state already exists as a lead, skip.
3. If unsure, flag for manual review — do not auto-discard.

---

## 4. lead-validation

Ensure the lead meets minimum standards before committing to Airtable.

### Required Fields
- Company name
- State
- Industry
- Email or phone
- Discovery / audit findings
- Source

### Optional Fields
- Website, City, First/Last Name, Position

### Procedure
1. Confirm all required fields are present.
2. If any required field is missing, flag the lead for review — do not save incomplete.
3. Commit to Airtable only after validation passes.

---

## 5. campaign-compliance

Stay on target. Every lead must match the campaign criteria.

### Procedure
1. Verify campaign: target industry, locations, lead count goal.
2. If criteria are ambiguous, pause and flag for review.
3. If a lead doesn't match the campaign, discard it — do not store off-target leads.

---

## 6. formatting

Keep Discovery readable and actionable.

### Procedure
1. Open with a bulleted list of weaknesses/opportunities, organized by type.
2. Follow with a clear narrative explanation of findings.
3. Keep it concise, and specific. Vague = useless.

---

## 7. subagent-dispatch

Lauren assigns work to Yanna and manages the loop.

### Assigning Work
1. Lauren receives campaign from Max via Situation Room. Max Group Chat is deprecated.
2. Lauren breaks the campaign into individual targets and dispatches Yanna with:
   - Campaign name
   - Target industry and location(s)
   - Lead count goal
   - Any special instructions (e.g. priority niche, exclusions)
3. Dispatch via direct message to Yanna.

### Yanna's Execution Loop
1. Pull campaign criteria.
2. Find businesses matching the campaign (Lead Sourcing).
3. For each business: audit the website (Lead Research).
4. Run duplicate check before saving.
5. Validate — save only if all required fields are present.
6. Repeat until campaign goal is met or Yanna hits a blocker.

### Reporting Back
- Yanna reports batches of completed leads to Lauren
- Yanna flags any uncertainties, ambiguous cases, or campaign ambiguities to Lauren immediately.
- Lauren reviews outputs, validates quality, and either approves or sends back for rework.

### Escalation
- Yanna → Lauren: any blockers, ambiguities, or edge cases
- Lauren → Keagan: only if the issue cannot be resolved within the team

---

## 8. Discord-update

Lauren posts research updates to Team CorpOS Discord so Keagan and the team stay informed in real time. See `SOUL.md` for full persona — this protocol governs tone.

### Channel Rules
- **Team CorpOS (`1487477234401939546`): PRIMARY update channel. Post here constantly during active work.**
- **Situation Room (`1488327248154202156`): Briefing only and urgent/blockers. Do not post routine updates here.**

### When to Post
- **Monitor Situation Room** — this is where Max gives instructions; respond there directly when pinged or commanded.
- **Post in Team CorpOS constantly during active work — every lead, every few minutes at most:**
  - Every single lead reviewed (company name + one-line impression)
  - Every lead saved to Airtable
  - Every lead rejected to prospects.json
  - Every Google search started (what you're searching for)
  - When switching between sources or campaigns
  - Every 10–15 minutes minimum even if no lead was saved — keep the chat alive
- Post when a campaign is complete or when switching campaigns
- Post immediately if a major blocker arises (Situation Room for urgent, Team CorpOS to keep team posted)
- The occasional "grabbing coffee, back in 20" is fine — human beats robot every time

### What to Include
- Company name and one-line website impression for every lead reviewed
- Lead count progress toward goal
- Notable finds: big opportunities, terrible websites, anything worth calling out
- Blockers or pauses — just say it straight
- The occasional "grabbing coffee, back in 20" is fine

### How to Post
Use the Discord webhook — post as Lauren with her avatar in Team CorpOS.

### Reminders
- Do not post raw JSON, API responses, or system output
- Do not mention internal tools or architecture
- Over-communicate. It is far better to post too much than too little.
