# Production Deployment

Frontend: Vercel.
Backend: Render web service.

## Supabase

Before deploying billing, run `sql/add_user_billing_columns.sql` in the Supabase SQL Editor. The `system_config.test_mode` column must also exist and be set to `true` for simulated billing.

## Vercel

- Framework preset: Vite
- Root directory: `nodemere` (the app folder in the Git repository)
- Build command: `npm run build`
- Output directory: `dist`

Required environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (the frontend also accepts the legacy anon key)
- `VITE_API_URL` = `https://nodemere-backend.onrender.com` in Vercel Production
- `VITE_WS_URL` = Render backend WebSocket URL if live sockets are enabled, for example `wss://your-service.onrender.com/ws`

## Render

The existing `nodemere-backend` web service uses Git Root Directory `nodemere`.
`nodemere/render.yaml` records the backend-only Blueprint configuration; changes
to that file do not update the manually created service unless a Blueprint is
connected and synced. Keep the service's Environment settings aligned with it.

Backend service settings:

- Compute plan: `free` (no paid compute selected). Free services sleep after 15 minutes without traffic and can take about a minute to wake; Render recommends using them for testing rather than production.
- Build command: `pip install -r backend/requirements.txt`
- Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

Required environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_JWT_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_ASSISTANT_ID`
- `STRIPE_SECRET_KEY`
- `STRIPE_SECRET_TEST_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECT_CLIENT_ID`
- `STRIPE_CONNECT_REDIRECT_URI`
- `ELEVENLABS_WEBHOOK_SECRET`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID_INBOUND`
- `ELEVENLABS_AGENT_ID_OUTBOUND`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_API_KEY`
- `TWILIO_API_SECRET`
- `TWILIO_PHONE_NUMBER`
- `TWILIO_VOICE_WEBHOOK_URL`
- `BACKEND_PUBLIC_URL` = public backend origin used for Twilio escalation callbacks
- `TWILIO_WARM_ESCALATIONS_ENABLED` = `true` only when the Twilio-controlled warm transfer is deployed
- `FRONTEND_BASE_URL` = Vercel frontend URL
- `VERIFICATION_BASE_URL` = frontend URL for document verification links
- `PAYMENT_TEST_FRONTEND_URL` and `PAYMENT_LIVE_FRONTEND_URL` = frontend URL for billing returns
- `GOOGLE_OAUTH_REDIRECT_URI`, `OUTLOOK_REDIRECT_URI`, and `STRIPE_CONNECT_REDIRECT_URI` = backend integration callbacks
- `CORS_ORIGINS` = comma-separated allowed frontend origins, for example `https://nodemere.ai,https://www.nodemere.ai`
- `TEST_MODE` = `true` for the initial launch checks and simulated billing. Switch it to `false` only after production billing credentials, webhooks, and data are ready.

Use `https://nodemere.ai` for the hosted frontend and
`https://nodemere-backend.onrender.com` for the hosted backend. Production
backend callbacks are:

| Integration | Callback URL |
| --- | --- |
| Twilio inbound voice | `https://nodemere-backend.onrender.com/twilio/inbound` |
| ElevenLabs post-call webhook | `https://nodemere-backend.onrender.com/api/webhooks/elevenlabs/post-call` |
| Stripe webhook | `https://nodemere-backend.onrender.com/stripe-webhook` |
| Gmail integration OAuth | `https://nodemere-backend.onrender.com/users/me/integrations/gmail/callback` |
| Outlook integration OAuth | `https://nodemere-backend.onrender.com/users/me/integrations/outlook/callback` |
| Stripe Connect OAuth | `https://nodemere-backend.onrender.com/users/me/integrations/stripe/callback` |

Register each callback with its provider only when enabling that integration.
ElevenLabs agent tool URLs also need the Render origin; keep development agents
and tools pointed at the local ngrok tunnel. The Gmail integration callback is
separate from Google sign-in, which goes through Supabase Auth.

For local development, keep the frontend on `http://localhost:5173`, run the
backend locally, and keep ngrok only in local callback settings for provider
requests that need to reach the local backend. Do not copy local `.env` files to
Render. The public site currently uses the development database and test
payments; use separate production credentials before accepting real customers.

### System Resend delivery

Secure verification and document-upload links are sent through Nodemere's
Resend account, not through the Scenario integrations feature. Configure
these backend-only Render environment variables:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` = a sender address from a domain verified in Resend

Do not put any of these values in frontend variables or source control. The
sender domain must be verified in Resend before delivery is enabled.

Vercel Production already uses the Render backend as `VITE_API_URL`. If the backend service URL changes, update that variable and redeploy Vercel.
