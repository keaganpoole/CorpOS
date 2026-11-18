# Nodemere Partners

The partner portal is a standalone React/Vite entry point. It uses Nodemere's logo asset, global brand tokens, primary button rules, and modal surface and close control styling. The existing customer frontend has two attribution hooks in signup and Auth session initialization. Its dashboard components and Stripe webhook are unchanged.

## Run locally

Run `npm run dev -- --strictPort` from the repository root and open `http://localhost:5173/partners/index.html`. The landing page and program terms work without credentials. For authenticated use, start the existing FastAPI backend on port 8000 and provide the settings below against isolated development services.

Run `npm run build:partners` from the same root. The result is `partners/dist`. Auth and administration use query parameters on the portal entry point.

## Configuration

| Location | Setting | Purpose |
| --- | --- | --- |
| Partner frontend | `VITE_PARTNER_SUPABASE_URL`, `VITE_PARTNER_SUPABASE_PUBLISHABLE_KEY` | Existing Nodemere Supabase Auth URL and publishable key |
| Partner frontend | `VITE_PARTNER_API_URL` | Existing FastAPI origin. Defaults to the existing Render service in the standalone build and the Vite proxy in development |
| FastAPI | `PARTNER_TRACKING_SECRET` | Random server-only secret for hashing rate-limit keys |
| FastAPI | `PARTNER_FRONTEND_URL` | Exact portal origin for CORS and notification links. Defaults to `https://partners.nodemere.ai` |
| FastAPI | `PARTNER_REFERRAL_URL` | Canonical customer origin for generated referral links. Defaults to `https://nodemere.ai` |
| FastAPI | Existing main Supabase service role, live Stripe key, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Program storage, customer billing reads, and email delivery |

Use the existing Nodemere Supabase project for Auth and data. Keep its customer Site URL and add the partner verification and recovery redirect URLs to the allowlist. Partner signup assigns the server-controlled `nodemere_partner` role and uses Supabase confirmation emails. The role is excluded from customer API authorization and has no Data API role grant. People who need both account types use a different email for each. Verify the existing Supabase SMTP configuration and confirmation settings in staging before release. [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)

The first verified partner API request provisions the profile and referral code. Grant administrator access by inserting the verified partner UUID into `public.partner_admins` through the main database's privileged operator connection. Removing the row revokes partner administration on subsequent requests.

The customer site's two Vercel rewrites carry the referral redirect and signup capture through the existing Render service. They must preserve the original browser's cookies and the redirect response headers. The local Vite proxy supplies the same routing on port 5173. For local links set `PARTNER_REFERRAL_URL=http://localhost:5173`. For local email links set the partner frontend origin and use the local partner entry path in the Auth redirect allowlist. [Vercel external rewrites](https://vercel.com/docs/routing/rewrites)

Run the FastAPI service on always-on compute for unattended reconciliation and email delivery. The repository's current Render Blueprint specifies a Free web service, which can sleep when idle. [Render service limits](https://render.com/docs/free#spinning-down-on-idle)

## Business rules and operations

- A first-party, HttpOnly browser cookie references the original visit stored in PostgreSQL. Attribution lasts 180 elapsed days beginning with that click. Analytics count up to one click per partner and browser in each 30-minute bucket. Browser cookie expiry or clearing can affect unique visitor counts. A salted network rate limit suppresses bursts, which are visible in the partner directory for 24 hours.
- Customer password signup captures attribution before verification, preserving it when the customer opens the email on a different device. OAuth can capture attribution on the same browser after sign-in. A verified customer and a registered business are required before the referral appears in the portal.
- An hourly reconciliation task reads the customer Stripe account's invoices, eligible recurring lines, settled charges, credits, and subscription end timestamps. It clips coverage to paid, elapsed service within the referral window and counts overlapping plan periods once. Credited service is removed. A partially refunded or disputed charge does not support coverage. Stripe simulation IDs and zero-cash invoices do not contribute paid days. [Stripe invoice line items](https://docs.stripe.com/api/invoice-line-item/object) · [Stripe invoice payments](https://docs.stripe.com/api/invoice-payment/object)
- Qualification creates one $100 reward. PostgreSQL locks and constraints protect transitions and preserve the audit trail. Approval requires a fresh billing check. If Stripe evidence changes before payout, reconciliation can put an eligible or approved reward on hold. A restored reward returns to review. Confirm the reward is Owed immediately before sending a manual payment. Mark it paid after sending. Recording an approved payout uses the database record and works during a Stripe outage.
- Registration, paid-subscription, and qualification transitions enqueue email once. The outbox leases deliveries and uses Resend idempotency keys during its 23-hour retry window. Qualification email remains enabled when nonessential email preferences are off. Operators can inspect pending and skipped messages in `partner_email_outbox`. [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)

## Verification

Run `python -m unittest backend.test_partner_billing`. Run `backend/test_partner_workflow.sql` with `psql -v ON_ERROR_STOP=1` against a disposable PostgreSQL database containing the migration, Supabase roles, and fixture `auth.users` and `public.businesses` tables. The script rolls back its fixtures. Verify hosted email, customer referral rewrites, and live billing evidence in staging before enabling the production portal.

## Release order

1. Prepare a separate Vercel project from the same repository with root directory `nodemere/partners` and **Include source files outside of the Root Directory** enabled. Its `vercel.json` builds from the shared lockfile and publishes only the standalone portal. Use a preview URL to check landing, verification callbacks, and asset loading before assigning the public hostname. [Vercel monorepo projects](https://vercel.com/docs/monorepos)
2. Verify SMTP and add the Partners callback URLs to the existing Nodemere Auth allowlist. Apply only the Partners migration to the target Nodemere data project. Verify browser roles cannot select program tables or execute reward functions, and that the dedicated Partners role is denied on the customer API and Data API.
3. Release the backend with the partner environment variables and confirm the worker is running. Release the customer frontend's two attribution rewrites. From a test browser verify a fresh click sets a first-party cookie and follows the redirect to the customer site. Confirm repeat and competing clicks preserve the original attribution through sign-up.
4. In staging, verify actual signup and recovery messages, invoice and refund evidence, administrator-only approval, payout recording, and the three notification types. Seed a test administrator in the target project only after verifying the partner account's UUID. Exercise the customer signup and checkout flows on the same release revision.
5. Once the production release is authorized, attach `partners.nodemere.ai` to the separate Vercel project, verify DNS and TLS, and repeat the production smoke checks with authorized test accounts. For rollback, remove the partner domain assignment or restore the prior frontend/backend builds. Preserve the additive partner tables and recorded payment history.
