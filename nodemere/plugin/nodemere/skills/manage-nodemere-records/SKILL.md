---
name: manage-nodemere-records
description: Read, create, edit, or delete Nodemere People and appointments using the signed-in business's authenticated API.
---

# Manage Nodemere records

Call `get_workspace` before any write. Check its account email and business name against the user's intended workspace. If they differ, stop and ask the user to connect the correct Nodemere account.

Read existing People and appointments before creating records so duplicates and conflicts are visible. Preserve existing notes unless the user asks to replace them. Use realistic but clearly synthetic details when the user requests sample data. Do not invent real contact details, consent flags, or service commitments.

Nodemere's record-created and appointment-created routes may run configured automations. Check the user's intended effects before bulk writes when notifications or workflows could be active. The plugin does not suppress those automations.

For deletion, read the target immediately before calling a delete tool. Delete only when the user has specifically authorized that deletion. The existing API permanently deletes records; the tool's confirmation fields must match the record readback. Never use the tool's confirmation fields to infer the user's permission.
