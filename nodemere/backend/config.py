# backend/config.py

import os
import stripe
from supabase import create_client, Client

try:
    from .env_loader import load_project_env
except ImportError:
    from env_loader import load_project_env



# General
TEST_MODE = os.environ.get("TEST_MODE", "false").strip().lower() in {"1", "true", "yes", "on"}
UPDATE2 = os.environ.get("UPDATE2", "false").strip().lower() in {"1", "true", "yes", "on"}






load_project_env()

# --- Stripe Configuration ---
STRIPE_LIVE_SECRET_KEY = os.environ.get("STRIPE_API_SECRET_KEY") or os.environ.get("STRIPE_SECRET_KEY")
STRIPE_TEST_SECRET_KEY = os.environ.get("STRIPE_SECRET_TEST_KEY") or os.environ.get("STRIPE_TEST_SECRET_KEY")
stripe_webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
stripe_connect_client_id = os.environ.get("STRIPE_CONNECT_CLIENT_ID")
stripe_connect_redirect_uri = os.environ.get("STRIPE_CONNECT_REDIRECT_URI")

if TEST_MODE:
    stripe.api_key = STRIPE_TEST_SECRET_KEY
else:
    stripe.api_key = STRIPE_LIVE_SECRET_KEY

print(f"--- DEBUG: Stripe key configured: {bool(stripe.api_key)} ---")
if not stripe.api_key:
    print("--- WARNING: Stripe API key not found. Please set STRIPE_API_SECRET_KEY or STRIPE_SECRET_TEST_KEY environment variable. ---")
if not stripe_webhook_secret:
    print("--- WARNING: Stripe webhook secret not found. Please set the STRIPE_WEBHOOK_SECRET environment variable. ---")

# --- Supabase Configuration ---
url: str | None = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
service_role_key: str | None = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
public_key: str | None = (
    os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    or os.environ.get("SUPABASE_ANON_KEY")
    or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
    or os.environ.get("VITE_SUPABASE_ANON_KEY")
)
key: str | None = (
    service_role_key
    or os.environ.get("SUPABASE_KEY")
    or public_key
)

# --- JWT Configuration ---
# Never fall back to a public/anon Supabase key for JWT verification. When the
# JWT secret is absent, dependencies use Supabase's token-introspection API.
SECRET_KEY = os.environ.get("SUPABASE_JWT_SECRET") or os.environ.get("SUPABASE_SECRET_KEY")
ALGORITHM = "HS256"


# --- Twilio Configuration ---
twilio_account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
twilio_auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
twilio_api_key = os.environ.get("TWILIO_API_KEY")
twilio_api_secret = os.environ.get("TWILIO_API_SECRET")
twilio_phone_number = os.environ.get("TWILIO_PHONE_NUMBER")
twilio_voice_webhook_url = os.environ.get("TWILIO_VOICE_WEBHOOK_URL")

# --- OpenAI Configuration ---
openai_api_key = os.environ.get("OPENAI_API_KEY")
openai_assistant_id = os.environ.get("OPENAI_ASSISTANT_ID")
elevenlabs_webhook_secret = os.environ.get("ELEVENLABS_WEBHOOK_SECRET")
elevenlabs_api_key = os.environ.get("ELEVENLABS_API_KEY")
elevenlabs_agent_id_inbound = os.environ.get("ELEVENLABS_AGENT_ID_INBOUND")
elevenlabs_agent_id_outbound = os.environ.get("ELEVENLABS_AGENT_ID_OUTBOUND")
internal_tool_secret = os.environ.get("NODEMERE_INTERNAL_TOOL_SECRET")

# --- Google / Gmail Integration Configuration ---
google_client_id = os.environ.get("GOOGLE_CLIENT_ID")
google_client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
google_oauth_redirect_uri = os.environ.get("GOOGLE_OAUTH_REDIRECT_URI")

# --- Outlook / Microsoft Graph Integration Configuration ---
outlook_client_id = os.environ.get("OUTLOOK_CLIENT_ID")
outlook_client_secret = os.environ.get("OUTLOOK_CLIENT_SECRET")
outlook_tenant_id = os.environ.get("OUTLOOK_TENANT_ID") or "common"
outlook_authority = (
    os.environ.get("OUTLOOK_AUTHORITY")
    or f"https://login.microsoftonline.com/{outlook_tenant_id}"
)
outlook_redirect_uri = os.environ.get("OUTLOOK_REDIRECT_URI")
outlook_scopes = os.environ.get(
    "OUTLOOK_SCOPES",
    "openid profile email offline_access User.Read Mail.Read Mail.Send",
)
microsoft_graph_base_url = os.environ.get("MICROSOFT_GRAPH_BASE_URL") or "https://graph.microsoft.com/v1.0"
frontend_base_url = (
    os.environ.get("FRONTEND_BASE_URL")
    or os.environ.get("VITE_FRONTEND_URL")
    or os.environ.get("VITE_APP_URL")
)
verification_base_url = (
    os.environ.get("VERIFICATION_BASE_URL")
    or frontend_base_url
    or "http://localhost:5173"
)

try:
    if not url:
        raise ValueError("SUPABASE_URL is required")
    if not key:
        raise ValueError(
            "A Supabase API key is required. Set SUPABASE_SERVICE_ROLE_KEY, "
            "SUPABASE_PUBLISHABLE_KEY, SUPABASE_ANON_KEY, or SUPABASE_KEY."
        )
    supabase: Client = create_client(url, key)
    supabase_admin: Client = create_client(url, service_role_key or key)
    supabase_auth: Client = create_client(url, public_key or key)
except Exception as e:
    print(f"ERROR: Supabase client creation failed: {e}")
    raise
