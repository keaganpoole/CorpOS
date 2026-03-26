# 📜 CorpOS Telegram Commands

Commands (current):
- `/start` — Manual ignition command. Used by the CEO to start the morning huddle and activate the system.
- `/rollcall` — Managers and executives confirm presence in the CorpOS group chat.

---

/ start
- Purpose: Manual ignition of the daily workflow (replaces the old huddle_workflow command).
- Who uses it: Keagan (CEO) sends this to the Max Group Chat to trigger the morning sequence and scans.
- Behavior: Max performs the Command Center scan and then dispatches managers via the Situation Room. This is the official start signal.


/ rollcall
- Purpose: Quick attendance confirmation from managers and executives.
- Who uses it: All Managers and Executives.
- Where: Message the CorpOS Team group chat (formerly "Team Winslow"). API keys and bot tokens remain the same; only the group name reference changes in these docs.
- What to send: A short 1–3 word presence message (examples: "here", "present", "on deck"). Use plain words — no long updates.
- Why: Provides a rapid, human-validated confirmation that leadership is present and ready to receive dispatches.

---

Notes
- This file replaces the previous `HUDDLE_WORKFLOW.md` and centralizes Telegram commands.
- Keep commands concise and stable; update here if new commands are added.
