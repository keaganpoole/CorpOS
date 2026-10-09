# Dashboard Immediate Update Audit

Date: October 5, 2026

## Audit scope

Reviewed the live People, Calendar, Scenarios, Settings, and Team surfaces, then traced dashboard mutation paths for records, services, staff, scenarios, Drop-ins, tasks, campaigns, call favorites, receptionist controls, and table configuration.

User goal: every ordinary dashboard edit should appear immediately, remain visually stable, and synchronize with the backend without reverting to an older value.

## Step 1: People CRM

Health: Critical

Evidence: `01-people-crm.png`

The People hook applies an edit locally first, which is the correct interaction model. The pending-change tracker only stores the latest partial payload, however, and an older request can replace that tracker after a newer request starts. A realtime refetch can then merge incomplete pending data over an older server row. This creates the reported switch-back behavior when edits overlap.

Recommendation: maintain a per-record mutation queue with accumulated pending fields and a monotonically increasing client revision. Only the latest revision may reconcile the row. Realtime rows must merge beneath all unsaved local fields.

## Step 2: Calendar and appointments

Health: High risk

Evidence: `02-calendar.png`

Appointment edits are applied locally first, but every realtime appointment event triggers a full list fetch. That fetch has no pending-edit protection and can replace the optimistic row while its save is still in flight. Each completed request also replaces the whole row, so rapid edits can resolve out of order.

Recommendation: use the same revisioned mutation layer as People. Merge confirmed server data into the latest local row instead of replacing it, and defer full-list refreshes for records with pending edits.

## Step 3: Scenarios

Health: Delayed

Evidence: `03-scenarios.png`

The builder's active toggle is optimistic and rolls back on failure. List-level scenario status and assignment actions wait for the API and then reload the entire list, so the visible status can hesitate. The assignment modal also performs multiple sequential saves before refreshing.

Recommendation: update the affected scenario locally at click time, keep a small saving marker, and reconcile that scenario only. Multi-record assignment should update all affected local rows in one transaction snapshot.

## Step 4: Settings and service data

Health: Mixed

Evidence: `04-settings.png`

Business fields and preference controls update a local draft immediately and are stable until the explicit Save action. Services, service activation, Drop-ins, and most saved collection edits wait for the backend before updating their lists. Some configuration controls update immediately but only log persistence failures, which can leave the UI claiming a change that was not saved.

Recommendation: preserve the explicit draft model for the main Settings form. Move service and Drop-in changes to optimistic collection updates with rollback. Add visible save failure and retry states for configuration changes.

## Step 5: Team, receptionist, and staff controls

Health: Mixed

Evidence: `05-team.png`

Receptionist active and direction controls, along with staff activation, already update immediately and roll back on failure. Full staff edits wait for the backend before the list changes. Realtime account-setting events can still overwrite call-routing state while a local update is pending because there is no client revision guard.

Recommendation: extend the proven optimistic toggle pattern to staff edits, and add pending revision protection to receptionist and call-routing synchronization.

## Additional findings

- Call-log favorites already update immediately and roll back on failure.
- Table layout, column visibility, and field configuration usually update immediately, but several persistence failures are console-only.
- Tasks and campaign edits generally wait for Supabase or realtime before local state changes. Campaign assignment is optimistic but lacks rollback.
- Mobile record editing disables the whole editor during each save. This prevents overlap but makes consecutive edits feel slow and still allows incoming props to reset a field draft.
- Desktop inline edits have little or no accessible saving confirmation. Users and assistive technology cannot reliably tell whether an edit is pending, saved, or failed.

## Recommended implementation order

1. Create one shared revisioned optimistic-mutation helper for record collections.
2. Apply it to People and Appointments first because those paths can visibly revert values.
3. Apply it to Scenarios, Services, Drop-ins, staff, tasks, and campaigns.
4. Add consistent quiet states: Saving, Saved, and Failed with retry, without blocking normal editing.
5. Add rapid-edit and out-of-order response tests, including realtime events arriving during a pending save.

## Evidence limits

The live account had one mostly empty People record, no appointments, no scenarios, and no receptionists. The screenshots confirm the audited surfaces and their controls, while the timing and race findings come from the current source paths. No business records were changed during this audit.
