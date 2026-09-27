# Private receptionist catalog

Studio's final **Add to your catalog** action saves the designed voice, selected
portrait, and playable audition in `created_receptionists` with the authenticated
business owner and business IDs. It creates no `hired_receptionists` row and does
not insert private creations into the shared `receptionist_catalog`.

The completion screen opens the catalog, showing the saved creation's details.
The user must explicitly choose **Hire** there. The server-only
`nodemere_hire_created_receptionist` function locks the creation and business,
checks ownership, readiness and plan capacity, inserts a team member, and marks
the original creation `converted` with its hired ID and conversion timestamp in
one transaction. Retries return that same member, including when the plan is now
full. Existing ready creations are listed; converted records remain unchanged.

The catalog combines scoped ready creations, stock receptionists, and existing
voice clones. Private entries use `created_receptionist_id` rather than a stock
catalog identifier. Legacy custom voice entries linked to a creation use the same
atomic hire path. Stock and unlinked clone hiring retain their existing behavior.

Save requests reserve the generated candidate once per owner and business.
Confirmed saves are idempotent. Ambiguous provider timeouts remain reserved and
require reconciliation rather than risking another provider voice. Definitive
provider rejections and media failures before a provider write can safely retry.
Portraits use the existing image bucket; auditions use the existing `voices`
audio bucket. Catalog records are private; existing media bucket policy is unchanged.

## Rollout and validation

Apply `sql/2026_09_27_private_receptionist_catalog.sql` before deploying the backend.
It adds two nullable creation columns, a candidate uniqueness index, and the
server-only atomic hire function. Existing creation/team data is not rewritten.

Focused checks:

```powershell
python -m unittest backend.test_voice_design backend.test_receptionist_catalog
node --test src/sonar/lib/receptionistHirePayload.test.js src/sonar/studio/catalogGeometry.test.js
npm run build
```

Run `backend/test_private_catalog_database.sql` through the SQL editor for real
database checks. Fixture writes are enclosed in a transaction and rolled back.
It verifies membership exclusion before Hire, media copying, ownership/business
isolation, readiness, capacity, idempotency, and server-only RPC permissions.

The intended operational backend runs locally on port 8000. The local frontend
on port 5173 uses the existing Vite `/api` proxy to `127.0.0.1:8000`. Run the
updated backend code and local frontend together for the complete workflow.
Vercel automatically deploys the `production` branch for the public frontend;
that deployment is separate from the local operational setup. No external backend
hosting is required, and the public frontend should not point at localhost.

Rollout verification: the migration and transactional rollback checks passed in
the configured database, the updated local backend served authenticated dashboard
and catalog requests successfully, and focused save/catalog/hire tests passed.
Paid provider voice generation was not performed during verification.


Created receptionist lifecycle (apply `sql/2026_09_27_created_receptionist_lifecycle.sql` after the original private catalog migration):

- Teams **Remove from team** returns the saved creation to `ready` in the catalog. Its historical hired row remains inactive with status `catalog`, preserving appointment references and the creation link.
- Catalog **Archive** changes only catalog placement to `archived`. Archives combines saved creations with existing archived non-system team records. **Restore to catalog** returns a saved creation to `ready`, without hiring it.
- Re-hiring reactivates the same hired row, checks plan capacity again, and preserves the original media and profile. Converted-hire retries remain idempotent.
- System hires cannot be archived through Delete or PATCH. A system hire with appointment history cannot be permanently deleted, so that operation returns a conflict instead. Existing voice-clone conventions remain intact.
- The catalog detail has no visible Close pill; Escape, backdrop dismissal, focus trapping and focus restoration remain.

Focused lifecycle checks: `python -m unittest backend.test_created_receptionist_archive backend.test_receptionist_catalog`. The expanded `backend/test_private_catalog_database.sql` validates removal, archive, restoration without hiring, capacity on rehire, row reuse, media retention and isolation inside a rolled-back transaction.

Lifecycle rollout verification: the lifecycle migration was applied to the configured Supabase project through its existing SQL editor. The expanded database fixture transaction passed and rolled back. The running local backend OpenAPI includes the new lifecycle routes. Frontend browser inspection was not performed.
