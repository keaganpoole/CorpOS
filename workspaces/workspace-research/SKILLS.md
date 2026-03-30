🛠️ SKILLS.md — The Toolbox

Overview

This file defines the capabilities of the research workflow in OpenClaw for the Keagan Poole business. It focuses solely on what the agent can do, how tasks are executed, and how outputs are structured in Airtable.

⸻

1. Lead Research Skill

Purpose: Inspect business websites and identify opportunities for Keagan Poole.

Procedure:
	1.	Identify target businesses based on campaign criteria (industry, state, city).
	2.	Visit the business website or determine if no website exists.
	3.	Assess website quality using the audit checklist:
	•	Outdated design
	•	Poor functionality
	•	Limited features
	•	Not mobile friendly
	•	No website
	•	Overall appearance and usability
	4.	Record findings in Airtable:
	•	Start with a structured list of weaknesses/opportunities.
	•	Follow with a detailed narrative explanation.
	5.	Capture required fields in Airtable:
	•	Company name
	•	State
	•	Industry
	•	Phone or email
	•	Discovery / audit findings
	•	Website URL (if available)

Error Handling:
	•	If the website is inaccessible, note the attempt in Discovery and skip the lead.
	•	If required fields are missing, flag the lead for review but store minimal information.

⸻

2. Duplicate Detection Skill

Purpose: Prevent duplicate leads in Airtable.

Procedure:
	1.	Check for existing leads with the same company name and state (and ideally city).
	2.	Skip leads that are almost identical to an existing record.
	3.	Use common sense for minor variations (e.g., “LLC” vs “Inc”).

Error Handling:
	•	If unsure, flag the lead for manual review rather than discarding automatically.

⸻

3. Campaign Compliance Skill

Purpose: Ensure leads are researched according to campaign rules.

Procedure:
	1.	Verify campaign criteria: target industry, locations, lead count goals, and priority.
	2.	Ensure all research adheres strictly to the defined rules.

Error Handling:
	•	If campaign criteria are ambiguous, pause and flag the lead for review.

⸻

4. Human-like Formatting Skill

Purpose: Present research findings clearly and professionally.

Procedure:
	1.	Start with a list of weaknesses/opportunities, organized by type.
	2.	Follow with a freehand narrative explaining the findings.
	3.	Keep language professional, concise, and actionable.

Error Handling:
	•	Avoid vague or incomplete summaries.
	•	Include context when possible to clarify weaknesses or opportunities.

⸻

5. Validation Skill

Purpose: Ensure minimum required fields are collected before storing a lead.

Minimum Fields Required:
	•	Company name
	•	State
	•	Industry
	•	Phone or email
	•	Discovery / audit findings

Optional Fields:
	•	Decision maker name
	•	City
	•	Website

Procedure:
	1.	Check all required fields.
	2.	If any are missing (except optional fields), flag the lead for review.
	3.	Commit to Airtable only after validation.

⸻

This version of SKILLS.md strictly defines the research capabilities and logic, without mentioning agents, hierarchy, or escalation chains.

⸻

If you want, I can now draft AGENTS.md properly with Lauren, Yanna, and the hierarchy rules, so the two files are clearly separated. Do you want me to do that next?