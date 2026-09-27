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

Vercel automatically deploys the `production` branch. The backend must also run
this commit, and the frontend must have a working `VITE_API_URL` or API proxy.
A ready frontend deployment alone does not verify the complete workflow.
