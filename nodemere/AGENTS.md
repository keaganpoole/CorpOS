# Nodemere local development

- Keagan uses `http://localhost:5173` for the Nodemere frontend. Always make and verify frontend changes against the checkout serving port 5173.
- Never silently fall back to ports 5174 or 5175. If port 5173 is occupied by another checkout, identify the process and correct the server mapping before editing.

# Private test records

- For synthetic People records or account-specific People custom fields, read `skills/nodemere-test-records/SKILL.md` and use `python -m backend.test_workspace_cli request`.
- The persistent local connection targets only `keaganpoole2@outlook.com`, workspace 21. Verify `/workspace` before writes; reuse the stored connection.
- The private API uses loopback port 8767 and is not mounted in the customer backend. People CRUD reuses the existing Nodemere handlers. No XLead or connected-app setup is needed.
