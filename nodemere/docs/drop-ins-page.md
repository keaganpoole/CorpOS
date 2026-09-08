# Drop-Ins dashboard builder

The dashboard navigation now includes **Drop-Ins** (`/dashboard/drop-ins`). The original calendar Drop-Ins modal remains available and was not removed or restyled by this page implementation.

## Behavior

- Templates and the selected node's editor share one collapsible left panel.
- Clicking a template creates a root. Dragging a template beneath a node creates a child. Existing branches can be dragged beneath another parent; cycles are rejected.
- The vertical graph supports free positioning, 16px snapping, branch collapse, hover-to-expand, pan, zoom, Fit, and Arrange. Arrow keys move a focused node; Shift increases the distance. Hierarchy depth has no product cap.
- Each appointment status has its own graph. Saved node positions belong to the business; camera positions are local and scoped to the signed-in business/user.
- Changes update the real appointment preview immediately. A parent opens its children; a leaf opens the original, non-dispatching call confirmation. The preview uses the existing `DropInAppointmentPreview`, `AppointmentRecord`, and call-border components, not a duplicate rendering.
- The preview's one-row hierarchy reel uses the NEST easing and rise/reverse-fall timing. Its existing tilt, seven depth layers, avatar, status animation, pagination, delete affordance, and call effects are retained.
- Save commits all five graphs atomically. Undo/redo is available until save. Deleting a node promotes its immediate children one level. Unsaved drafts survive dashboard page switches (the dashboard keeps visited pages mounted); browser navigation/reload prompts before losing them.

## Database rollout required

No live database was changed during implementation. Apply the following migrations in order, skipping any already applied:

1. `sql/2026_09_06_drop_ins.sql` — original definitions (requires the application's existing authorization, audit, and encrypted-data infrastructure).
2. `sql/2026_09_07_drop_in_hierarchy.sql` — parent IDs and hierarchy support, present before this page implementation.
3. `sql/2026_09_08_drop_in_builder.sql` — canvas positions, atomic builder save, optimistic concurrency, and database hierarchy constraints.

Then deploy/restart the backend and frontend together. The new endpoint is `PUT /api/sonar/drop-ins/builder`; it requires `operations.manage`, derives the tenant from the authenticated request, encrypts prompts before SQL, and propagates verified audit identity. Direct browser roles cannot execute the save RPC.

Before release, use an authorized test business to verify save/reload through the real authenticated backend, a stale-save conflict across two sessions, and retained-modal compatibility. This environment had no running application backend; browser verification used the actual page with an isolated synthetic transport. No customer records or outbound calls were used.

## Local verification

```powershell
node --test src/sonar/lib/dropInGraph.test.js
python -m unittest backend.test_drop_in_builder backend.test_drop_ins
npm run build
```

Database tests require a dedicated disposable PostgreSQL instance and the fixture in `.audit/drop-ins-page/database-fixture.sql`. Never point them at an application database. Set `DROP_IN_BUILDER_TEST_PORT` to that instance's port, then run `python -m unittest backend.test_drop_in_builder_database`. The suite refuses the ordinary production database name and uses synthetic records.

The Vite-only visual fixture is `/.audit/drop-ins-page/index.html?seed`. It imports production components but supplies synthetic data and cannot dispatch calls. It is not an application authentication bypass or a production route. `?parity` compares the same preview in modal and page contexts; `?parity&call` compares call confirmations. Additional fixture states are `?readonly`, `?empty`, and `?empty&failure`.

Visual evidence and the final review are recorded in `design-qa.md` and `.audit/drop-ins-page/`.
