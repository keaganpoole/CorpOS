# Production Deployment

Frontend: Vercel.
Backend: Render web service.

## Supabase

Before deploying billing, run `sql/add_user_billing_columns.sql` in the Supabase SQL Editor. The `system_config.test_mode` column must also exist and be set to `true` for simulated billing.

## Vercel

- Framework preset: Vite
- Root directory: project root
- Build command: `npm run build`
- Output directory: `dist`

Required environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL` = Render backend URL, for example `https://your-service.onrender.com`
- `VITE_WS_URL` = Render backend WebSocket URL if live sockets are enabled, for example `wss://your-service.onrender.com/ws`

## Render

Use `render.yaml` from the project root.

Backend service settings:

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
- `FRONTEND_BASE_URL` = Vercel frontend URL
- `CORS_ORIGINS` = comma-separated allowed frontend origins, for example `https://nodemere.com,https://your-project.vercel.app`
- `TEST_MODE` = `false`

After Render is live, copy its backend URL into Vercel as `VITE_API_URL`, then redeploy Vercel.
