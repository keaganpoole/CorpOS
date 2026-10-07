# Nodemere local development

- Keagan uses `http://localhost:5173` for the Nodemere frontend. Always make and verify frontend changes against the checkout serving port 5173.
- Never silently fall back to ports 5174 or 5175. If port 5173 is occupied by another checkout, identify the process and correct the server mapping before editing.
