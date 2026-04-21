# backend/config.py

import os
import stripe
from supabase import create_client, Client
from dotenv import load_dotenv



#General
TEST_MODE = True
UPDATE2 = False






load_dotenv() # Loads variables from .env

# --- Stripe Configuration ---
STRIPE_LIVE_SECRET_KEY = os.environ.get("STRIPE_API_SECRET_KEY")
STRIPE_TEST_SECRET_KEY = os.environ.get("STRIPE_SECRET_TEST_KEY")
stripe_webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")

if TEST_MODE:
    stripe.api_key = STRIPE_TEST_SECRET_KEY
else:
    stripe.api_key = STRIPE_LIVE_SECRET_KEY

print(f"--- DEBUG: Key being used by Stripe: {stripe.api_key} ---")
if not stripe.api_key:
    print("--- WARNING: Stripe API key not found. Please set STRIPE_API_SECRET_KEY or STRIPE_SECRET_TEST_KEY environment variable. ---")
if not stripe_webhook_secret:
    print("--- WARNING: Stripe webhook secret not found. Please set the STRIPE_WEBHOOK_SECRET environment variable. ---")

# --- Supabase Configuration ---
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

# --- JWT Configuration ---
SECRET_KEY = os.environ.get("SUPABASE_KEY")
ALGORITHM = "HS256"


# --- Twilio Configuration ---
twilio_account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
twilio_auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
twilio_phone_number = os.environ.get("TWILIO_PHONE_NUMBER")

# --- OpenAI Configuration ---
openai_api_key = os.environ.get("OPENAI_API_KEY")
openai_assistant_id = os.environ.get("OPENAI_ASSISTANT_ID")

try:
    supabase: Client = create_client(url, key)
except Exception as e:
    print(f"ERROR: Supabase client creation failed: {e}")
    raise
