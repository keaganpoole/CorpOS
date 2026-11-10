# Nodemere local development

- Keagan uses `http://localhost:5173` for the Nodemere frontend. Always make and verify frontend changes against the checkout serving port 5173.
- Never silently fall back to ports 5174 or 5175. If port 5173 is occupied by another checkout, identify the process and correct the server mapping before editing.

# Private test records

- For private test data in People, appointments, staff, services, receptionists, business information, knowledge base, or schedules, read `skills/nodemere-test-records/SKILL.md` and use `python -m backend.test_workspace_cli request`.
- The persistent local connection targets only `keaganpoole2@outlook.com`, workspace 21. Verify `/workspace` before writes; reuse the stored connection.
- The private API uses loopback port 8767 and is not mounted in the customer backend. Record operations reuse the existing Nodemere handlers and scoped data boundaries. No XLead or connected-app setup is needed.
