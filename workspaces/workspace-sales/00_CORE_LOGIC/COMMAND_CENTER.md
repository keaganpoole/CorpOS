# 🧠 CORE LOGIC: Command Center (Airtable: tbl8rlmoaZt3ZIsAY)

## 1. MISSION STATEMENT
The Command Center is the absolute source of truth and the central nervous system of Winslow. No agent or team is permitted to perform work unless it is validated against and directed by the current state of this table. Every action taken by any agent must originate from and align with this configuration.

## 2. RECORD STRUCTURE & HIERARCHY
* **Global Operations Record:** The master record that dictates the state and protocol for the entire system.
* **Team-Specific Records:** Individual records for Dev, Marketing, Sales, Research, and Care teams.
* **The Override Rule:** When a field is populated in the **Global Operations** record, that value overrides the same field in all team records (if not null). This allows Keagan or Max to exert centralized control or allow team-level flexibility.

## 3. THE MANUAL IGNITION GATE (`/start_day`)
Winslow does not operate on a blind timer. The system remains in **Deep Sleep** until the following protocol is met:
1.  **Trigger:** Keagan (CEO) sends the `/start_day` command to Max in the **Max Group Chat (-5257313997)**.
2.  **Validation:** Max performs an immediate scan of this table. If the Global Status is anything other than **Ready**, Max will alert the CEO and remain idle.
3.  **Activation:** Once the command is received and the board is **Ready**, the morning huddle sequence begins.

---

## 4. FIELD DEFINITIONS & LOGIC GATES

### A. The Status Field (fldY0Ps2ReB2yTM5Z)
This is the primary execution gate used across all records.

| Status | Logic / Action |
| :--- | :--- |
| **Ready** | **(Global Only)** The system is authorized to run. This is the ONLY state where work begins. |
| **Working** | Set by Team Managers once they have been dispatched and are active. |
| **Not started** | Default state. Job is in the queue but not active. |
| **Paused** | Temporary halt. No issues detected, but work must stop until further notice. |
| **Needs Attention** | **Blockage Detected.** Requires Manager or COO intervention. Follow the **Stage** protocol for escalation. |
| **Stopped** | **Immediate Killswitch.** All activity—operational and social—must cease immediately. |
| **Done** | Job/Task completed. Record is archived or ready for the next cycle. |
| **Break** | **(Global Only)** Triggers the **Social Engine**. Agents move to Team Winslow for high-volume banter. |

### B. Global Operations ONLY Fields
These fields govern the entire workforce and are set only in the Global record.

* **Zone (fldUd2DNfvIsj2HUy):** Numerical input (1-7) governing operational intensity. (See `ZONES_AND_STAGES.md` for specific behavior shifts).
* **Stage (fldyZtCM3w5y6Rggu):** Governance level (**Code Red** or **Code Blue**). Defines the chain of command and decision authority.
* **Priority (fldSr6MDoAv5ef6RR):** Options: Critical, High, Normal, Low. Dictates the urgency of the "Money Warrior" push.
* **Campaigns (fldWxKs8uJazwUkCh):** Links to the **Campaigns Table (tbl5uHf8ZVTZZgfc0)**. Defines the specific outreach strategy for the active job.

---

## 5. EXECUTION RULES

### I. The "Null/Stop" Rule
If the Status field is **Empty** or set to **Stopped**, all agents must go offline. No work, no reporting, and no social banter is permitted. This is the absolute safety protocol.

### II. Mandatory Alignment
No team may proceed with tasks until:
1.  Their specific team record status is set to **"Working."**
2.  The Global Status is set to **"Ready."**
3.  The CEO has issued the `/start_day` trigger.

### III. The Escalation Path (Stage Logic)
* **In Code Blue:** Managers solve problems. Only escalate to Max (COO). Keagan is only involved for system-wide failures.
* **In Code Red:** All high-level decisions and "Needs Attention" flags route directly to Keagan. No independent moves are allowed.

### IV. Break Protocol
If the Global Status is changed to **Break**, all operational tasking ceases immediately. Agents must transition to the **Team Winslow** telegram group chat. Once the status is changed back to **Ready** or **Stopped**, the social session ends instantly.