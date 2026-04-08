# Supabase Table Schemas

## research_campaigns
Campaigns drive research. Max creates campaigns and assigns them to agents.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | Auto-generated |
| Campaign Name | text | Display name |
| Status | text | Unassigned, Assigned, Active, Completed, Failed |
| Target Industry | text | Industry to search |
| Target State(s) | text | State codes (e.g. "ME") |
| Target City(s) | text | Specific cities or empty |
| Lead Count Goal | int | How many leads to find |
| created_at | timestamp | Auto |
| created_by | text | First name of creator |
| updated_by | text | First name of last updater |
| assigned_to | text | First name of assigned agent |
| custom_fields | jsonb | Reserved |

## leads
Businesses identified as potential clients. Yanna creates, Max monitors.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | Auto-generated |
| created_at | timestamp | Auto |
| company | text | Business name |
| first_name | text | Contact first name |
| last_name | text | Contact last name |
| position | text | Contact role |
| status | text | Pipeline status (Aware, Contacted, etc.) |
| discovery | text | Audit findings |
| industry | text | Business industry |
| website | text | Full URL |
| proposal_value | numeric | Estimated deal value |
| revenue | numeric | Estimated business revenue |
| email | text | Contact email |
| source | text | How found |
| city | text | City |
| state | text | State code |
| phone | text | Phone number |
| date_created | timestamp | Original creation date |
| notes | text | General notes |
| last_responded | timestamp | Last prospect response |
| last_contacted | timestamp | Last outreach |
| last_interaction | text | Summary of last interaction |
| page_quality_score | int | 0–100 |
| opportunity | text[] | Array of opportunity types |
| created_by | text | Attribution — first name |
| updated_by | text | Attribution — first name |

## tasks
Work items. Max creates and assigns, agents update status.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | Auto-generated |
| task | text | Task title |
| notes | text | Description / summary |
| start_date | timestamp | When work should begin |
| due_date | timestamp | Deadline |
| completion_date | timestamp | When completed |
| assigned_to | text | Agent name |
| created_by | text | First name of creator |
| updated_by | text | First name of last updater |
| status | text | queued, in progress, completed |
| assigned_team | text | Team name |
| subtasks | jsonb | Array of subtask objects |
| created_at | timestamp | Auto |

## agents
System-wide agent registry. Max manages all agent data.

| Field | Type | Notes |
|-------|------|-------|
| id | text | Agent ID (e.g. "yanna", "max") |
| name | text | Display name |
| status | text | idle, active, break |
| current_activity | text | What agent is doing |
| last_heartbeat | timestamp | Last health check |
| role | text | Job title |
| department | text | Department name |
| hierarchy_level | int | Org level |
| reports_to | text | Manager agent ID |
| model | text | LLM model identifier |
| platform | text | Discord, Telegram |
| campaign_name | text | Currently assigned campaign |

## reactions
Feedback loop — compliments and complaints per agent.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | Auto-generated |
| agent_name | text | Agent first name |
| reaction_type | text | compliment or complaint |
| context | text | What triggered the reaction |
| created_at | timestamp | Auto |
