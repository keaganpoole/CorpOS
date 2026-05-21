# main.py
  
import logging
import os
import stripe
import json
import time
from uuid import UUID, uuid4
from decimal import Decimal, InvalidOperation
from datetime import date, datetime, timezone, timedelta
from typing import List, Optional, Literal

# --- Logging Configuration ---
# Sets the root logger to output INFO level messages.
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logging.info("Logging configured.")
# Silence HTTPX / HTTPCORE internal debug logs
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("hpack").setLevel(logging.WARNING)

# --- End Logging Configuration ---

from pydantic import BaseModel, Field, EmailStr
from fastapi import FastAPI, HTTPException, status, Depends, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from gotrue.errors import AuthApiError
from collections import defaultdict
from fastapi import BackgroundTasks
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from jose import JWTError, jwt
from config import (
    supabase,
    supabase_admin,
    stripe_webhook_secret,
    SECRET_KEY,
    ALGORITHM,
    TEST_MODE,
    STRIPE_LIVE_SECRET_KEY,
    STRIPE_TEST_SECRET_KEY,
    elevenlabs_webhook_secret,
    twilio_phone_number,
)

 
from models import (
    UserUpdate, UserResponse, AuthSignUpRequest, LeadCreate,
    LeadResponse, AuthLoginRequest, LeadUpdate, PurchaseCreate,
    PurchaseUpdate, PurchaseResponse, CampaignItemResponse,
    CampaignCreate, CampaignUpdate, CampaignResponse, AIAgentResponse,
    AdminSetting, RepLoginRequest, MoneyTablePlan, MoneyTableRep, RepResponse, RepUpdate,
    PasswordCreate, PasswordUpdate, PasswordResponse, PrizeCreate, PrizeUpdate, PrizeResponse, TierResponse, HelpdeskMessage, OAuthAccountCreate, OAuthAccountResponse
)
from phone_helper import router as phone_helper_router
from dependencies import get_current_user, get_current_rep

# --------------------------------------------------------------------------
# App Initialization
# --------------------------------------------------------------------------
app = FastAPI(title="WYSL API")
# scheduler = AsyncIOScheduler()
PAYMENT_TEST_MODE = TEST_MODE

app.include_router(phone_helper_router, prefix="/api", tags=["Phone Helper"])

CONTROL_STATE = {
    "runtime_mode": "running",
    "stage": "code_blue",
    "zone": 1,
}
SESSION_STATE = {
    "status": "running",
    "started_at": datetime.now(timezone.utc).isoformat(),
    "last_ping_at": None,
}
LIVE_PULSE_EVENTS: list[dict] = []
SYSTEM_LOG_EVENTS: list[dict] = []
CRON_JOBS: list[dict] = []
REACTIONS_CACHE: list[dict] = []
PENDING_RESTARTS: list[dict] = []
ROUTE_HIT_EXCLUDE_PATHS = {
    "/api/events/live-pulse",
    "/api/logs",
}


def next_live_event_id(prefix: Optional[str] = None) -> str:
    base_id = uuid4().hex
    return f"{prefix}-{base_id}" if prefix else base_id


def push_live_event(message: str, *, actor: str = "system", severity: str = "info", event_type: Optional[str] = None, payload: Optional[dict] = None):
    timestamp = datetime.now(timezone.utc).isoformat()
    event = {
        "id": next_live_event_id(),
        "timestamp": timestamp,
        "message": message,
        "actor": actor,
        "severity": severity,
        "event_type": event_type or "system_event",
        "payload": payload or {},
    }
    LIVE_PULSE_EVENTS.insert(0, event)
    del LIVE_PULSE_EVENTS[50:]

    SYSTEM_LOG_EVENTS.insert(0, {
        "timestamp": timestamp,
        "level": severity,
        "source": actor,
        "message": message,
    })
    del SYSTEM_LOG_EVENTS[100:]


def push_route_hit(method: str, endpoint: str, status_code: int, duration_ms: int, source: str):
    timestamp = datetime.now(timezone.utc).isoformat()
    LIVE_PULSE_EVENTS.insert(0, {
        "id": next_live_event_id("route"),
        "type": "route_hit",
        "event_type": "route_hit",
        "timestamp": timestamp,
        "method": method,
        "endpoint": endpoint,
        "status": status_code,
        "duration": duration_ms,
        "source": source,
        "message": f"{method} {endpoint} -> {status_code}",
    })
    del LIVE_PULSE_EVENTS[50:]


def infer_route_source(request: Request) -> str:
    path = request.url.path
    user_agent = (request.headers.get("user-agent") or "").lower()

    if path.startswith("/api/webhooks/elevenlabs") or "elevenlabs" in user_agent:
        return "elevenlabs"
    if "supabase" in user_agent:
        return "supabase"
    return "dashboard"


def get_business_record_for_user(user_id: str) -> dict:
    response = (
        supabase
        .table('businesses')
        .select('id, phone, forwarding_config')
        .eq('user_id', user_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    return response.data[0]


def normalize_forwarding_config(raw_config) -> dict:
    config = raw_config if isinstance(raw_config, dict) else {}
    numbers = config.get('numbers')
    if not isinstance(numbers, list):
        numbers = []

    return {
        "version": config.get("version", 1),
        "active_number_id": config.get("active_number_id"),
        "numbers": numbers,
    }


def get_global_forwarding_target_number() -> str:
    return twilio_phone_number or "+12073092121"


push_live_event("FastAPI backend active on port 8000.", actor="system", severity="info", event_type="system_startup")


# --------------------------------------------------------------------------
# Scheduler Jobs
# --------------------------------------------------------------------------
# @app.on_event("startup")
# async def startup_event():
#     # Schedule message generation to run every hour
#     # scheduler.add_job(
#     #     generate_messages_for_pending_campaigns,
#     #     trigger=CronTrigger(minute='0', second='0', timezone='UTC'), # Run at the top of every hour UTC
#     #     id="message_generation_schedule",
#     #     name="Generate messages for pending campaigns every hour",
#     #     replace_existing=True
#     # )
#     # scheduler.start()

# @app.on_event("shutdown")
# async def shutdown_event():
#     scheduler.shutdown()

# --------------------------------------------------------------------------
# Pydantic Models
# --------------------------------------------------------------------------
class CreateCheckoutSessionRequest(BaseModel):
    price_id: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: str
    user: dict

class RepTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class LoginStatusUpdate(BaseModel):
    is_logged_in: bool

class RuntimeModeRequest(BaseModel):
    mode: str

class StageRequest(BaseModel):
    stage: str

class ZoneRequest(BaseModel):
    zone: int

class AgentCallTypesRequest(BaseModel):
    call_types: str

class AgentModelRequest(BaseModel):
    model: str

class LeadDetailsForQueue(BaseModel):
    fullName: str
    company: Optional[str] = None

class QueueItemResponse(BaseModel):
    id: UUID
    message: str
    status: str
    created_at: datetime
    age: str
    campaign_name: Optional[str] = None
    lead_details: LeadDetailsForQueue

class WatcherStatusResponse(BaseModel):
    mode: str

class ManualWatcherRunRequest(BaseModel):
    simulated_time: Optional[datetime] = None

class VisitorCreate(BaseModel):
    user_agent: Optional[str] = None
    ip: Optional[str] = None
    iplocation: Optional[str] = None

class ConfigStatusResponse(BaseModel):
    test_mode: bool

class PaymentCreateRequest(BaseModel):
    amount: int
    currency: str = "usd"
    payment_method_type: str = "card"
    description: Optional[str] = None
    person_id: Optional[str] = None
    appointment_id: Optional[str] = None
    customer_name: Optional[str] = None

class OnboardingRequest(BaseModel):
    business_name: str
    industry: Optional[str] = None
    sub_industry: Optional[str] = None
    business_email: Optional[EmailStr] = None
    business_street: Optional[str] = None
    business_city: Optional[str] = None
    business_state: Optional[str] = None
    business_zip: Optional[str] = None
    business_phone: Optional[str] = None
    business_timezone: str = "America/New_York"
    business_hours: Optional[dict] = None
    appointment_settings: Optional[dict] = None
    about_company: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None

class BusinessForwardingUpdateRequest(BaseModel):
    entry_id: Optional[str] = None
    source_number: str
    source_label: Optional[str] = None
    provider: str
    provider_label: Optional[str] = None
    status: Optional[Literal["draft", "pending_test", "verified"]] = "draft"
    confirmed_enabled: Optional[bool] = False
    verified: Optional[bool] = False

class PaymentProfileCreateRequest(BaseModel):
    amount: int
    currency: str = "usd"
    description: Optional[str] = None
    person_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None

class InvoiceCreateRequest(BaseModel):
    amount: int
    currency: str = "usd"
    description: Optional[str] = None
    person_id: Optional[str] = None
    appointment_id: Optional[str] = None
    service_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    due_days: Optional[int] = 7

class InvoiceSendRequest(BaseModel):
    invoice_id: str

class PaymentUpdateRequest(BaseModel):
    payment_id: str
    status: str
    amount: Optional[int] = None
    description: Optional[str] = None
    notes: Optional[str] = None

class PaymentTestModeRequest(BaseModel):
    enabled: bool

INTENT_PHASES = ("entered", "completed", "failed")
INTENT_KEY_ALIASES = {
    "create_new_record": "create_record",
    "intent_call_started": "call_started",
    "call_start": "call_started",
    "intent_appointments": "appointments",
    "intent_records": "records",
    "intent_payments": "payments",
    "intent_appointment_created": "appointment_created",
    "intent_appointment_updated": "appointment_updated",
    "intent_appointment_cancelled": "appointment_cancelled",
    "appointment_create": "appointment_created",
    "appointment_update": "appointment_updated",
    "appointment_cancel": "appointment_cancelled",
    "create_appointment": "appointment_created",
    "update_appointment": "appointment_updated",
    "delete_appointment": "cancel_appointment",
    "cancel_appointment": "appointment_cancelled",
    "intent_record_created": "record_created",
    "intent_record_updated": "record_updated",
    "create_record": "record_created",
    "update_record": "record_updated",
    "intent_payment_received": "payment_received",
    "intent_invoice_sent": "invoice_sent",
    "create_payment": "payment_received",
    "update_payment": "payment_received",
    "create_invoice": "invoice_sent",
    "send_invoice": "invoice_sent",
    "intent_neutral_entered": "neutral",
    "neutral_entered": "neutral",
    "send_to_phone_number": "send_sms",
    "send_to_customer": "send_sms",
}
SUPPORTED_INTENT_KEYS = {
    "call_customer",
    "call_started",
    "send_sms",
    "appointments",
    "records",
    "payments",
    "search_records",
    "create_record",
    "update_record",
    "delete_record",
    "appointment_created",
    "appointment_updated",
    "appointment_cancelled",
    "create_appointment",
    "update_appointment",
    "cancel_appointment",
    "record_created",
    "record_updated",
    "payment_received",
    "invoice_sent",
    "create_payment",
    "create_payment_profile",
    "create_invoice",
    "send_invoice",
    "update_payment",
    "check_payment_status",
    "issue_refund",
    "send_email",
    "add_tag",
    "search_tags",
    "update_tag",
    "delete_tag",
    "wait",
    "neutral",
    "intent_router",
    "end_call",
}

class IntentCheckpointRequest(BaseModel):
    intent_key: str
    phase: Literal["entered", "completed", "failed"]
    timestamp: Optional[datetime] = None
    scenario_id: str
    user_id: Optional[str] = None
    receptionist_id: Optional[str] = None
    call_id: Optional[str] = None
    conversation_id: Optional[str] = None
    system_conversation_id: Optional[str] = None
    direction: Optional[str] = None
    execution_id: Optional[str] = None
    session_id: Optional[str] = None

    class Config:
        populate_by_name = True

# --------------------------------------------------------------------------
# Middleware & Exception Handlers
# --------------------------------------------------------------------------
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logging.error(f"Validation error for request {request.url}: {exc}")
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

# --- CORS Configuration based on TEST_MODE ---
if TEST_MODE:
    origins = [
        "http://localhost:5173",  # For local development
        "http://172.20.10.2:5173", # For local network access
    ]
else:
    origins = [
        "https://keyquarters.com",  # For production frontend
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def capture_route_hits(request: Request, call_next):
    path = request.url.path
    should_track = (
        request.method != "OPTIONS"
        and path.startswith("/api/")
        and path not in ROUTE_HIT_EXCLUDE_PATHS
    )
    started_at = time.perf_counter()

    try:
        response = await call_next(request)
    except Exception:
        if should_track:
            duration_ms = int((time.perf_counter() - started_at) * 1000)
            push_route_hit(
                request.method,
                path,
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                duration_ms,
                infer_route_source(request),
            )
        raise

    if should_track:
        duration_ms = int((time.perf_counter() - started_at) * 1000)
        push_route_hit(
            request.method,
            path,
            response.status_code,
            duration_ms,
            infer_route_source(request),
        )

    return response



# --------------------------------------------------------------------------
# Visitor Tracking Endpoints
# --------------------------------------------------------------------------
@app.post("/track-visitor", status_code=status.HTTP_200_OK, tags=["Visitor Tracking"])
async def track_visitor(request: Request, visitor_data: VisitorCreate):
    user_agent = visitor_data.user_agent
    client_ip = request.client.host if request.client else "unknown"
    iplocation = visitor_data.iplocation # Assume iplocation might be provided, or fetch if not
    logging.debug(f"Tracking visitor with client_ip: {client_ip}, user_agent: {user_agent}")

    # If iplocation is not provided, try to fetch it
    if not iplocation and client_ip and client_ip != "unknown" and client_ip != "127.0.0.1":
        try:
            async with httpx.AsyncClient() as client:
                ip_api_url = f"http://ip-api.com/json/{client_ip}"
                response = await client.get(ip_api_url, timeout=3)
                if response.status_code == 200:
                    ip_info = response.json()
                    if ip_info and ip_info.get("status") == "success":
                        iplocation = f"{ip_info.get('city')}, {ip_info.get('regionName')}, {ip_info.get('country')}"
                        logging.debug(f"Successfully fetched iplocation: {iplocation}")
                    else:
                        logging.warning(f"IP-API failed for {client_ip}: {ip_info.get('message', 'Unknown error')}")
                else:
                    logging.warning(f"Failed to fetch IP location for {client_ip}. Status: {response.status_code}")
        except httpx.RequestError as e:
            logging.error(f"HTTPX error fetching IP location for {client_ip}: {e}", exc_info=True)
        except Exception as e:
            logging.error(f"Unexpected error fetching IP location for {client_ip}: {e}", exc_info=True)
    else:
        logging.debug(f"Skipping IP location fetch. iplocation provided: {bool(iplocation)}, client_ip: {client_ip}")
    
    if not user_agent:
        logging.warning("Received /track-visitor request with no user_agent.")
        return {"message": "User agent is required for tracking.", "status": "skipped"}

    try:
        # Check if visitor with this user_agent already exists, select 'visits' as well
        response = supabase.table('visitors').select('id', 'visits').eq('user_agent', user_agent).execute()

        if response.data:
            # Visitor exists, update last_visited and increment visits
            existing_visitor = response.data[0]
            current_visits = existing_visitor.get('visits', 0)
            logging.debug(f"Current visits for {user_agent}: {current_visits}")
            
            update_data = {
                "visits": current_visits + 1,
                "last_visited": datetime.now(timezone.utc).isoformat(),
                "iplocation": iplocation # Ensure iplocation is updated for returning visitors
            }
            logging.debug(f"Updating visits to: {current_visits + 1}")
            update_response = supabase.table('visitors').update(update_data).eq('user_agent', user_agent).execute()

            if update_response.data:
                logging.info(f"Returning visitor updated: {user_agent}, new visits: {current_visits + 1}")
                return {"message": "Returning visitor updated."}
            else:
                logging.error(f"Failed to update returning visitor: {update_response.error}")
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update returning visitor.")
        else:
            # Insert new visitor record
            insert_data = {
                "user_agent": user_agent,
                "ip": client_ip,
                "iplocation": iplocation,
                "visits": 1,
                "last_visited": datetime.now(timezone.utc).isoformat()
            }
            insert_response = supabase.table('visitors').insert(insert_data).execute()
            
            if insert_response.data:
                logging.info(f"New visitor tracked: {user_agent}, IP: {client_ip}, Location: {iplocation}")
                return {"message": "Visitor tracked successfully."}
            else:
                logging.error(f"Failed to insert new visitor: {insert_response.error}")
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to track visitor.")
    except Exception as e:
        logging.error(f"Error tracking visitor: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# --------------------------------------------------------------------------
# Auth Helpers
# --------------------------------------------------------------------------
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def set_payment_test_mode(enabled: bool):
    global PAYMENT_TEST_MODE
    PAYMENT_TEST_MODE = enabled
    stripe.api_key = STRIPE_TEST_SECRET_KEY if PAYMENT_TEST_MODE else STRIPE_LIVE_SECRET_KEY
    logging.info("Payment test mode set to %s", PAYMENT_TEST_MODE)

def get_payment_mode_label() -> str:
    return "test" if PAYMENT_TEST_MODE else "live"

def get_payment_frontend_base_url() -> str:
    if PAYMENT_TEST_MODE:
        return os.environ.get("PAYMENT_TEST_FRONTEND_URL", "http://localhost:5173")
    return os.environ.get("PAYMENT_LIVE_FRONTEND_URL", "https://keyquarters.com")

def coerce_amount_to_cents(amount_value) -> int:
    try:
        return int(Decimal(str(amount_value)))
    except (InvalidOperation, TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid amount value")

def ensure_no_unresolved_templates(*values):
    for value in values:
        if isinstance(value, str) and "{{" in value and "}}" in value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unresolved variable reference received: {value}. Please resolve scenario variables before running this payment action.",
            )

def build_invoice_metadata(*, person_id: Optional[str] = None, appointment_id: Optional[str] = None, service_id: Optional[str] = None):
    metadata = {"source": "wysl_scenarios"}
    if person_id:
        metadata["person_id"] = str(person_id)
    if appointment_id:
        metadata["appointment_id"] = str(appointment_id)
    if service_id:
        metadata["service_id"] = str(service_id)
    return metadata

def serialize_stripe_invoice(invoice):
    if not invoice:
        return {}
    return {
        "id": invoice.get("id"),
        "invoice_id": invoice.get("id"),
        "object": invoice.get("object"),
        "status": invoice.get("status"),
        "amount_due": invoice.get("amount_due"),
        "amount_paid": invoice.get("amount_paid"),
        "currency": invoice.get("currency"),
        "customer_id": invoice.get("customer"),
        "hosted_invoice_url": invoice.get("hosted_invoice_url"),
        "invoice_pdf": invoice.get("invoice_pdf"),
        "description": invoice.get("description"),
        "number": invoice.get("number"),
        "due_date": invoice.get("due_date"),
        "created": invoice.get("created"),
        "metadata": invoice.get("metadata"),
    }

def emit_payment_trigger(trigger_key: str, payload: dict):
    trigger_payload = {
        "trigger_key": trigger_key,
        "payload": payload,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    logging.info("Payment trigger fired: %s", json.dumps(trigger_payload, default=str))
    try:
        supabase.table("scenario_events").insert(trigger_payload).execute()
    except Exception as exc:
        logging.debug("scenario_events insert skipped or failed: %s", exc)
    return trigger_payload

def normalize_intent_key(intent_key: str) -> str:
    normalized = (intent_key or "").strip().lower().replace(" ", "_").replace("-", "_")
    return INTENT_KEY_ALIASES.get(normalized, normalized)

def deep_get(data, path, default=None):
    current = data
    for part in path.split("."):
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return default
        if current is None:
            return default
    return current

def first_present(data, *paths):
    for path in paths:
        value = deep_get(data, path)
        if value is not None and value != "":
            return value
    return None

def parse_optional_datetime(value):
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value, tz=timezone.utc)
        except Exception:
            return None
    if isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            return None
        if normalized.endswith("Z"):
            normalized = normalized[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(normalized)
            return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
        except ValueError:
            return None
    return None

def stringify_transcript(value):
    if value is None:
        return None
    if isinstance(value, str):
        return value.strip() or None
    if isinstance(value, list):
        parts = []
        for item in value:
            if isinstance(item, dict):
                speaker = item.get("speaker") or item.get("role") or item.get("agent") or "speaker"
                text = item.get("text") or item.get("message") or item.get("content") or ""
                text = str(text).strip()
                if text:
                    parts.append(f"{speaker}: {text}")
            else:
                text = str(item).strip()
                if text:
                    parts.append(text)
        return "\n".join(parts) or None
    if isinstance(value, dict):
        text = value.get("text") or value.get("transcript") or value.get("content")
        if text:
            return str(text).strip() or None
        try:
            return json.dumps(value)
        except Exception:
            return str(value)
    return str(value)

def lookup_hired_receptionist(*, hired_receptionist_id=None, elevenlabs_agent_id=None, phone_number=None):
    try:
        if hired_receptionist_id:
            response = (
                supabase.table("hired_receptionists")
                .select("id,user_id,full_name,phone_number,elevenlabs_voice_id")
                .eq("id", str(hired_receptionist_id))
                .limit(1)
                .execute()
            )
            if response.data:
                return response.data[0]

        if elevenlabs_agent_id:
            response = (
                supabase.table("hired_receptionists")
                .select("id,user_id,full_name,phone_number,elevenlabs_voice_id")
                .eq("elevenlabs_voice_id", str(elevenlabs_agent_id))
                .limit(1)
                .execute()
            )
            if response.data:
                return response.data[0]

        if phone_number:
            response = (
                supabase.table("hired_receptionists")
                .select("id,user_id,full_name,phone_number,elevenlabs_voice_id")
                .eq("phone_number", str(phone_number))
                .limit(1)
                .execute()
            )
            if response.data:
                return response.data[0]
    except Exception as exc:
        logging.warning("Failed to match hired receptionist for call log: %s", exc)
    return None

def extract_call_log_from_elevenlabs_payload(payload: dict):
    call_id = first_present(payload, "call_id", "call.id", "conversation_id", "conversation.id")
    conversation_id = first_present(payload, "conversation_id", "conversation.id", "metadata.conversation_id")
    elevenlabs_agent_id = first_present(payload, "agent_id", "agent.id", "assistant_id", "metadata.agent_id")
    hired_receptionist_id = first_present(payload, "hired_receptionist_id", "metadata.hired_receptionist_id")
    scenario_id = first_present(payload, "scenario_id", "metadata.scenario_id", "dynamic_variables.scenario_id")
    from_number = first_present(payload, "from_number", "caller.phone_number", "customer.phone_number", "metadata.from_number")
    to_number = first_present(payload, "to_number", "agent_phone_number", "phone_number", "metadata.to_number")
    started_at = parse_optional_datetime(first_present(payload, "started_at", "call.started_at", "start_time", "metadata.started_at"))
    ended_at = parse_optional_datetime(first_present(payload, "ended_at", "call.ended_at", "end_time", "metadata.ended_at"))

    duration_seconds = first_present(
        payload,
        "duration_seconds",
        "call_duration_secs",
        "duration",
        "metadata.duration_seconds",
    )
    try:
        duration_seconds = int(float(duration_seconds)) if duration_seconds is not None else None
    except (TypeError, ValueError):
        duration_seconds = None

    status_value = first_present(payload, "status", "call_status", "analysis.status")
    outcome_value = first_present(payload, "outcome", "analysis.outcome", "call_outcome", "metadata.outcome")
    summary_value = first_present(payload, "summary", "analysis.summary", "conversation_summary", "metadata.summary")
    transcript_value = first_present(payload, "transcript", "conversation.transcript", "analysis.transcript")
    sentiment_value = first_present(payload, "sentiment", "analysis.sentiment", "analysis.call_sentiment")

    receptionist = lookup_hired_receptionist(
        hired_receptionist_id=hired_receptionist_id,
        elevenlabs_agent_id=elevenlabs_agent_id,
        phone_number=to_number,
    )

    return {
        "source": "elevenlabs",
        "external_call_id": str(call_id) if call_id else None,
        "conversation_id": str(conversation_id) if conversation_id else None,
        "elevenlabs_agent_id": str(elevenlabs_agent_id) if elevenlabs_agent_id else None,
        "hired_receptionist_id": receptionist.get("id") if receptionist else (str(hired_receptionist_id) if hired_receptionist_id else None),
        "user_id": receptionist.get("user_id") if receptionist else None,
        "receptionist_name": receptionist.get("full_name") if receptionist else None,
        "scenario_id": str(scenario_id) if scenario_id else None,
        "from_number": str(from_number) if from_number else None,
        "to_number": str(to_number) if to_number else (receptionist.get("phone_number") if receptionist else None),
        "started_at": started_at.isoformat() if started_at else None,
        "ended_at": ended_at.isoformat() if ended_at else None,
        "duration_seconds": duration_seconds,
        "status": str(status_value) if status_value else None,
        "outcome": str(outcome_value) if outcome_value else None,
        "summary": str(summary_value) if summary_value else None,
        "transcript_text": stringify_transcript(transcript_value),
        "sentiment": str(sentiment_value) if sentiment_value else None,
        "raw_payload": payload,
    }

def emit_intent_checkpoint(request: IntentCheckpointRequest):
    normalized_intent_key = normalize_intent_key(request.intent_key)
    if normalized_intent_key not in SUPPORTED_INTENT_KEYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported intent_key: {request.intent_key}",
        )

    if request.timestamp:
        checkpoint_ts = (
            request.timestamp.replace(tzinfo=timezone.utc)
            if request.timestamp.tzinfo is None
            else request.timestamp.astimezone(timezone.utc)
        )
    else:
        checkpoint_ts = datetime.now(timezone.utc)
    payload = {
        "intent_key": normalized_intent_key,
        "phase": request.phase,
        "timestamp": checkpoint_ts.isoformat(),
        "scenario_id": str(request.scenario_id),
        "user_id": str(request.user_id) if request.user_id else None,
        "receptionist_id": str(request.receptionist_id) if request.receptionist_id else None,
        "call_id": str(request.call_id) if request.call_id else None,
        "conversation_id": str(request.conversation_id or request.system_conversation_id) if (request.conversation_id or request.system_conversation_id) else None,
        "system_conversation_id": str(request.system_conversation_id) if request.system_conversation_id else None,
        "direction": str(request.direction).lower() if request.direction else None,
        "execution_id": str(request.execution_id) if request.execution_id else None,
        "session_id": str(request.session_id) if request.session_id else None,
    }
    event_record = {
        "trigger_key": "intent_checkpoint",
        "payload": payload,
        "created_at": checkpoint_ts.isoformat(),
    }

    logging.info("Intent checkpoint fired: %s", json.dumps(event_record, default=str))
    try:
        response = supabase.table("scenario_events").insert(event_record).execute()
    except Exception as exc:
        logging.error("Failed to persist intent checkpoint: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist intent checkpoint",
        ) from exc

    saved_event = response.data[0] if getattr(response, "data", None) else event_record
    return {
        "ok": True,
        "checkpoint": payload,
        "event": saved_event,
    }

def build_payment_row(
    *,
    amount: int,
    currency: str,
    payment_method: str,
    description: str,
    status: str = "pending",
    stripe_payment_intent_id: Optional[str] = None,
    stripe_session_id: Optional[str] = None,
    receipt_url: Optional[str] = None,
    error_message: Optional[str] = None,
):
    return {
        "amount": amount,
        "currency": currency,
        "status": status,
        "payment_method": payment_method,
        "description": description,
        "receipt_url": receipt_url,
        "stripe_payment_intent_id": stripe_payment_intent_id,
        "stripe_session_id": stripe_session_id,
        "refunded_amount": 0,
        "error_message": error_message,
    }

def insert_payment_record(payment_row: dict):
    try:
        response = supabase.table("payments").insert(payment_row).execute()
        return response.data[0] if response.data else payment_row
    except Exception as exc:
        logging.error("Failed to insert payment row: %s", exc, exc_info=True)
        return payment_row

def update_payment_record(match_field: str, match_value: str, update_data: dict):
    response = supabase.table("payments").update(update_data).eq(match_field, match_value).execute()
    return response.data[0] if response.data else None

def upsert_payment_from_stripe(
    *,
    payment_intent_id: Optional[str] = None,
    session_id: Optional[str] = None,
    status: Optional[str] = None,
    receipt_url: Optional[str] = None,
    error_message: Optional[str] = None,
):
    query = None
    if payment_intent_id:
        query = supabase.table("payments").select("*").eq("stripe_payment_intent_id", payment_intent_id).limit(1)
    elif session_id:
        query = supabase.table("payments").select("*").eq("stripe_session_id", session_id).limit(1)
    else:
        return None

    existing = query.execute()
    if not existing.data:
        return None

    update_data = {}
    if status is not None:
        update_data["status"] = status
    if receipt_url is not None:
        update_data["receipt_url"] = receipt_url
    if error_message is not None:
        update_data["error_message"] = error_message
    if not update_data:
        return existing.data[0]

    if payment_intent_id:
        updated = supabase.table("payments").update(update_data).eq("stripe_payment_intent_id", payment_intent_id).execute()
    else:
        updated = supabase.table("payments").update(update_data).eq("stripe_session_id", session_id).execute()
    return updated.data[0] if updated.data else existing.data[0]

# --------------------------------------------------------------------------
# API Endpoints
# --------------------------------------------------------------------------

@app.get("/", tags=["Health Check"])
def root():
    return {"status": "ok", "message": "Welcome to the WYSL API"}

@app.get("/config/status", response_model=ConfigStatusResponse, tags=["Config"])
async def get_config_status():
    """Returns the current configuration status, like TEST_MODE."""
    return {"test_mode": TEST_MODE}

@app.post("/api/tools/report-intent-checkpoint", tags=["Server Tools"])
async def report_intent_checkpoint(request: IntentCheckpointRequest):
    return emit_intent_checkpoint(request)

@app.post("/api/webhooks/elevenlabs/post-call", tags=["Server Tools"])
async def elevenlabs_post_call_webhook(
    request: Request,
    x_webhook_secret: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    if elevenlabs_webhook_secret:
        bearer_secret = None
        if authorization and authorization.lower().startswith("bearer "):
            bearer_secret = authorization.split(" ", 1)[1].strip()
        presented_secret = x_webhook_secret or bearer_secret
        if presented_secret != elevenlabs_webhook_secret:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook secret")

    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook payload must be a JSON object")

    call_log = extract_call_log_from_elevenlabs_payload(payload)
    logging.info("ElevenLabs post-call webhook received: %s", json.dumps(call_log, default=str))

    try:
        response = supabase.table("call_logs").insert(call_log).execute()
    except Exception as exc:
        logging.error("Failed to persist call log: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist call log",
        ) from exc

    saved = response.data[0] if getattr(response, "data", None) else call_log
    return {"ok": True, "call_log": saved}

@app.get("/api/agents", tags=["Sonar Controller Compat"])
async def get_sonar_agents():
    try:
        response = supabase.table('hired_receptionists').select('*').execute()
        agents = []
        for row in response.data or []:
            agents.append({
                **row,
                "name": row.get("full_name") or row.get("first_name") or "Receptionist",
                "role": row.get("stereotype") or "Receptionist",
                "status": "active" if row.get("is_active", True) else "idle",
                "current_activity": row.get("current_activity") or "Idle",
                "model": row.get("model"),
            })
        return agents
    except Exception as exc:
        logging.error("Failed to fetch Sonar agents: %s", exc, exc_info=True)
        return []

@app.get("/api/system/summary", tags=["Sonar Controller Compat"])
async def get_sonar_system_summary():
    try:
        agents = supabase.table('hired_receptionists').select('id,is_active').execute().data or []
        active_agents = len([agent for agent in agents if agent.get('is_active', True)])
        total_agents = len(agents)
        return {
            "ok": active_agents,
            "warnings": 0,
            "errors": 0,
            "activeAgents": active_agents,
            "totalAgents": total_agents,
        }
    except Exception:
        return {"ok": 0, "warnings": 0, "errors": 0, "activeAgents": 0, "totalAgents": 0}

@app.get("/api/events/live-pulse", tags=["Sonar Controller Compat"])
async def get_live_pulse(limit: int = 30):
    return LIVE_PULSE_EVENTS[:max(1, min(limit, 50))]

@app.get("/api/logs", tags=["Sonar Controller Compat"])
async def get_system_logs(limit: int = 50):
    return SYSTEM_LOG_EVENTS[:max(1, min(limit, 100))]

@app.get("/api/control-state", tags=["Sonar Controller Compat"])
async def get_control_state():
    return CONTROL_STATE

@app.get("/api/session", tags=["Sonar Controller Compat"])
async def get_session_state():
    return SESSION_STATE

@app.get("/api/pipeline", tags=["Sonar Controller Compat"])
async def get_pipeline_state():
    try:
        people = supabase.table('people').select('id').execute().data or []
    except Exception:
        people = []
    try:
        appointments = supabase.table('appointments').select('id').execute().data or []
    except Exception:
        appointments = []
    try:
        payments = supabase.table('payments').select('id').execute().data or []
    except Exception:
        payments = []
    try:
        call_logs = supabase.table('call_logs').select('id').execute().data or []
    except Exception:
        call_logs = []

    return {
        "stages": [
            {"id": "calls", "label": "Calls", "count": len(call_logs)},
            {"id": "people", "label": "People", "count": len(people)},
            {"id": "appointments", "label": "Appointments", "count": len(appointments)},
            {"id": "payments", "label": "Payments", "count": len(payments)},
        ],
        "totalRelics": len(call_logs),
        "qualifiedLeads": len(people),
        "activeOutreach": len(appointments),
    }

@app.get("/api/cron", tags=["Sonar Controller Compat"])
async def get_cron_jobs():
    return CRON_JOBS

@app.post("/api/cron", tags=["Sonar Controller Compat"])
async def create_cron_job(job: dict):
    cron_job = {
        "id": f"cron-{len(CRON_JOBS) + 1}",
        **job,
    }
    CRON_JOBS.append(cron_job)
    push_live_event("Cron job created.", actor="system", severity="info", event_type="cron_created", payload=cron_job)
    return cron_job

@app.delete("/api/cron/{job_id}", tags=["Sonar Controller Compat"])
async def delete_cron_job(job_id: str):
    global CRON_JOBS
    CRON_JOBS = [job for job in CRON_JOBS if job.get("id") != job_id]
    push_live_event("Cron job deleted.", actor="system", severity="info", event_type="cron_deleted", payload={"id": job_id})
    return {"ok": True}

@app.get("/api/reactions", tags=["Sonar Controller Compat"])
async def get_reactions():
    try:
        return supabase.table('reactions').select('*').execute().data or []
    except Exception:
        return REACTIONS_CACHE

@app.post("/api/reactions", tags=["Sonar Controller Compat"])
async def add_reaction(data: dict):
    try:
        response = supabase.table('reactions').insert(data).execute()
        created = response.data[0] if response.data else data
    except Exception:
        created = {"id": f"reaction-{len(REACTIONS_CACHE) + 1}", **data}
        REACTIONS_CACHE.append(created)
    push_live_event("Reaction recorded.", actor="system", severity="info", event_type="reaction_added", payload=created)
    return created

@app.get("/api/openrouter/models", tags=["Sonar Controller Compat"])
async def get_openrouter_models():
    return []

@app.get("/api/pending-restarts", tags=["Sonar Controller Compat"])
async def get_pending_restarts():
    return PENDING_RESTARTS

@app.delete("/api/pending-restarts/{restart_id}", tags=["Sonar Controller Compat"])
async def clear_pending_restart(restart_id: str):
    global PENDING_RESTARTS
    PENDING_RESTARTS = [item for item in PENDING_RESTARTS if item.get("id") != restart_id]
    return {"ok": True}

@app.post("/api/agents/{agent_id}/call-types", tags=["Sonar Controller Compat"])
async def update_agent_call_types(agent_id: str, payload: AgentCallTypesRequest):
    response = supabase.table('hired_receptionists').update({'call_types': payload.call_types}).eq('id', agent_id).execute()
    push_live_event("Agent call handling updated.", actor="system", severity="info", event_type="agent_updated", payload={"agent_id": agent_id, "call_types": payload.call_types})
    return response.data[0] if response.data else {"id": agent_id, "call_types": payload.call_types}

@app.post("/api/agents/{agent_id}/model", tags=["Sonar Controller Compat"])
async def update_agent_model(agent_id: str, payload: AgentModelRequest):
    try:
        response = supabase.table('hired_receptionists').update({'model': payload.model}).eq('id', agent_id).execute()
        updated = response.data[0] if response.data else {"id": agent_id, "model": payload.model}
    except Exception:
        updated = {"id": agent_id, "model": payload.model}
    push_live_event("Agent model updated.", actor="system", severity="info", event_type="agent_updated", payload={"agent_id": agent_id, "model": payload.model})
    return updated

@app.patch("/api/agents/{agent_id}", tags=["Sonar Controller Compat"])
async def patch_agent(agent_id: str, payload: dict):
    response = supabase.table('hired_receptionists').update(payload).eq('id', agent_id).execute()
    push_live_event("Agent updated.", actor="system", severity="info", event_type="agent_updated", payload={"agent_id": agent_id, **payload})
    return response.data[0] if response.data else {"id": agent_id, **payload}

@app.post("/api/control/runtime", tags=["Sonar Controller Compat"])
async def set_runtime_mode(payload: RuntimeModeRequest):
    CONTROL_STATE["runtime_mode"] = payload.mode
    SESSION_STATE["status"] = payload.mode
    push_live_event(f"Runtime {payload.mode}.", actor="system", severity="info", event_type=f"runtime_{payload.mode}", payload={"mode": payload.mode})
    return CONTROL_STATE

@app.post("/api/control/stage", tags=["Sonar Controller Compat"])
async def set_control_stage(payload: StageRequest):
    CONTROL_STATE["stage"] = payload.stage
    push_live_event(f"Stage set to {payload.stage}.", actor="system", severity="info", event_type="stage_changed", payload={"stage": payload.stage})
    return CONTROL_STATE

@app.post("/api/control/zone", tags=["Sonar Controller Compat"])
async def set_control_zone(payload: ZoneRequest):
    CONTROL_STATE["zone"] = payload.zone
    push_live_event(f"Zone set to {payload.zone}.", actor="system", severity="info", event_type="zone_changed", payload={"zone": payload.zone})
    return CONTROL_STATE

@app.post("/api/control/ping-max", tags=["Sonar Controller Compat"])
async def ping_max():
    SESSION_STATE["last_ping_at"] = datetime.now(timezone.utc).isoformat()
    push_live_event("Ping sent.", actor="keagan", severity="info", event_type="ping_sent")
    return {"ok": True}

@app.post("/api/webhook/people", tags=["Sonar Controller Compat"])
async def people_webhook(payload: dict):
    event_type = payload.get("type", "people_update")
    push_live_event(
        f"People event: {event_type}.",
        actor="system",
        severity="info",
        event_type=f"lead_{str(event_type).lower()}",
        payload=payload,
    )
    return {"ok": True}

@app.get("/api/sonar/call-logs", tags=["Sonar Calls"])
async def list_call_logs(limit: int = 50, current_user: dict = Depends(get_current_user)):
    safe_limit = max(1, min(limit, 200))
    query = (
        supabase.table("call_logs")
        .select("*")
        .eq("user_id", str(current_user.id))
        .order("created_at", desc=True)
        .limit(safe_limit)
    )
    response = query.execute()
    return response.data or []

@app.get("/api/sonar/call-logs/stats", tags=["Sonar Calls"])
async def get_call_log_stats(current_user: dict = Depends(get_current_user)):
    response = (
        supabase.table("call_logs")
        .select("id,hired_receptionist_id,receptionist_name,duration_seconds,status,outcome,created_at")
        .eq("user_id", str(current_user.id))
        .order("created_at", desc=True)
        .limit(1000)
        .execute()
    )
    rows = response.data or []

    total_calls = len(rows)
    completed_calls = sum(1 for row in rows if (row.get("status") or "").lower() in {"completed", "done", "success"})
    failed_calls = sum(1 for row in rows if (row.get("status") or "").lower() in {"failed", "error"})
    total_duration = sum(int(row.get("duration_seconds") or 0) for row in rows)

    by_receptionist = {}
    for row in rows:
        receptionist_key = row.get("hired_receptionist_id") or row.get("receptionist_name") or "unknown"
        if receptionist_key not in by_receptionist:
            by_receptionist[receptionist_key] = {
                "hired_receptionist_id": row.get("hired_receptionist_id"),
                "receptionist_name": row.get("receptionist_name"),
                "total_calls": 0,
                "completed_calls": 0,
                "failed_calls": 0,
                "total_duration_seconds": 0,
            }
        bucket = by_receptionist[receptionist_key]
        bucket["total_calls"] += 1
        bucket["total_duration_seconds"] += int(row.get("duration_seconds") or 0)
        status_value = (row.get("status") or "").lower()
        if status_value in {"completed", "done", "success"}:
            bucket["completed_calls"] += 1
        if status_value in {"failed", "error"}:
            bucket["failed_calls"] += 1

    return {
        "total_calls": total_calls,
        "completed_calls": completed_calls,
        "failed_calls": failed_calls,
        "average_duration_seconds": round(total_duration / total_calls, 2) if total_calls else 0,
        "by_receptionist": list(by_receptionist.values()),
    }

# --- Messages Endpoint for Queue ---
@app.get("/messages/queue", response_model=List[QueueItemResponse], tags=["Messages"])
async def get_queue_messages(current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        response = supabase.table('messages').select(
            'id, message, status, created_at, leads!inner(first_name, last_name, company, lead_campaigns(campaigns(name)))'
        ).eq(
            'status', 'pending approval'
        ).eq(
            'leads.user', str(current_user_id)
        ).execute()

        if not response.data:
            return []

        formatted_data = []
        for item in response.data:
            lead_info = item.get('leads')
            if not lead_info:
                continue

            campaign_name = None
            if lead_info.get('lead_campaigns') and lead_info['lead_campaigns'][0].get('campaigns'):
                campaign_name = lead_info['lead_campaigns'][0]['campaigns'].get('name')

            created_at_dt = datetime.fromisoformat(item.get('created_at').replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            time_diff = now - created_at_dt

            if time_diff.total_seconds() < 3600:
                age_str = f"{int(time_diff.total_seconds() // 60)} minutes ago"
            elif time_diff.total_seconds() < 86400:
                age_str = f"{int(time_diff.total_seconds() // 3600)} hours ago"
            else:
                age_str = f"{time_diff.days} days ago"

            formatted_item = QueueItemResponse(
                id=item.get('id'),
                message=item.get('message'),
                status=item.get('status'),
                created_at=item.get('created_at'),
                age=age_str,
                campaign_name=campaign_name,
                lead_details=LeadDetailsForQueue(
                    fullName=f"{lead_info.get('first_name', '')} {lead_info.get('last_name', '')}".strip(),
                    company=lead_info.get('company')
                )
            )
            formatted_data.append(formatted_item)
        
        return formatted_data

    except Exception as e:
        logging.error(f"Failed to get queue for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve queue messages.")

@app.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Messages"])
async def delete_message(message_id: UUID, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        message_info = supabase.table('messages').select('lead').eq('id', str(message_id)).single().execute()
        if not message_info.data or not message_info.data.get('lead'):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found or lead association missing.")
        lead_id = message_info.data['lead']
        
        ownership_check = supabase.table('leads').select('id').eq('id', str(lead_id)).eq('user', str(current_user_id)).single().execute()
        if not ownership_check.data:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied: You do not own this message's associated lead.")
        
        supabase.table('messages').delete().eq('id', str(message_id)).execute()
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Failed to delete message {message_id} for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete message.")

@app.put("/messages/{message_id}/status", status_code=status.HTTP_200_OK, tags=["Messages"])
async def update_message_status(message_id: UUID, updated_message_content: dict, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        new_message_text = updated_message_content.get('message')
        if new_message_text is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message content is required.")

        message_info = supabase.table('messages').select('lead').eq('id', str(message_id)).single().execute()
        if not message_info.data or not message_info.data.get('lead'):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found or lead association missing.")
        lead_id = message_info.data['lead']
        
        ownership_check = supabase.table('leads').select('id').eq('id', str(lead_id)).eq('user', str(current_user_id)).single().execute()
        if not ownership_check.data:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied: You do not own this message's associated lead.")
        
        update_data = {
            'status': 'ready',
            'message': new_message_text
        }
        
        response = supabase.table('messages').update(update_data).eq('id', str(message_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found or update failed.")
        
        return {"message": "Message status updated to 'ready' and content saved."}
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Failed to update message {message_id} status for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update message status.")

# --- Authentication Endpoint ---
@app.post("/token", response_model=TokenResponse, tags=["Authentication"])
async def login_for_access_token(form_data: AuthLoginRequest):
    try:
        response = supabase.auth.sign_in_with_password({"email": form_data.email, "password": form_data.password})
        if response.session:
            return response.session.model_dump()
        else:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login failed: No session returned.")
    except AuthApiError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=e.message or "Invalid email or password", headers={"WWW-Authenticate": "Bearer"})
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

# --- Breakroom (Reps) Endpoints ---
@app.post("/breakroom/login", response_model=RepTokenResponse, tags=["Reps"])
async def login_for_rep_access_token(form_data: RepLoginRequest):
    logging.info("--- [STEP 1] Breakroom login process started. ---")
    try:
        logging.info(f"--- [STEP 2] Querying database for rep_id: '{form_data.rep_id}'. ---")
        rep_response = supabase.table('reps').select('*').eq('rep_id', form_data.rep_id).single().execute()
        
        if not rep_response.data:
            logging.warning(f"--- [FAIL] Rep login failed: Rep ID '{form_data.rep_id}' not found in the database. ---")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rep ID not found.")
        
        logging.info("--- [STEP 3] Rep ID found in the database. Proceeding to password verification. ---")
        rep = rep_response.data
        
        received_password = form_data.password
        db_password = rep.get('rep_password')
        
        logging.info(f"--- [STEP 4] Comparing passwords. Received: '{received_password}' (Length: {len(received_password)}), Database: '{db_password}' (Length: {len(db_password) if db_password else 'N/A'}). ---")
        
        passwords_match = received_password == db_password
        
        if not passwords_match:
            logging.warning(f"--- [FAIL] Password mismatch for rep_id '{form_data.rep_id}'. ---")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password.")

        logging.info("--- [STEP 5] Passwords match. Creating access token. ---")
        access_token_expires = timedelta(minutes=60)
        access_token = create_access_token(
            data={"sub": rep.get('rep_id')}, expires_delta=access_token_expires
        )
        
        logging.info("--- [SUCCESS] Access token created. Login successful. ---")
        return {"access_token": access_token, "token_type": "bearer"}

    except HTTPException as e:
        # Re-raising HTTPException to let FastAPI handle it, no extra logging needed here.
        raise e
    except Exception as e:
        logging.error(f"--- [ERROR] An unexpected error occurred during login for rep_id {form_data.rep_id}: {e} ---", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An internal error occurred.")

@app.get("/reps/me", response_model=RepResponse, tags=["Reps"])
async def read_current_rep(current_rep_id: str = Depends(get_current_rep)):
    try:
        response = supabase.table('reps').select('*').eq('rep_id', current_rep_id).single().execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Current rep's profile not found.")
        return RepResponse.model_validate(response.data).model_dump()
    except Exception as e:
        logging.error(f"Error fetching rep profile for rep_id {current_rep_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.patch("/reps/{rep_id}/deduct-points", response_model=RepResponse, tags=["Reps"])
async def deduct_rep_points(rep_id: UUID, points_data: dict, current_rep_id: str = Depends(get_current_rep)):
    points_to_deduct = points_data.get("points_to_deduct")
    if points_to_deduct is None or not isinstance(points_to_deduct, (int, float)) or points_to_deduct < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valid 'points_to_deduct' (non-negative number) is required.")

    try:
        rep_profile_response = supabase.table('reps').select('id', 'rep_id', 'points').eq('id', str(rep_id)).single().execute()
        if not rep_profile_response.data or rep_profile_response.data.get('rep_id') != current_rep_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied to update this rep's profile.")

        current_points = rep_profile_response.data.get('points', 0)
        if current_points < points_to_deduct:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient points.")

        updated_points = current_points - points_to_deduct
        response = supabase.table('reps').update({'points': updated_points}).eq('id', str(rep_id)).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rep not found or points update failed.")
        
        return RepResponse.model_validate(response.data[0]).model_dump()
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Error deducting points for rep {rep_id} by {current_rep_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.get("/money-table", response_model=List[MoneyTablePlan], tags=["Reps"])
async def get_money_table_data(current_rep: str = Depends(get_current_rep)):
    try:
        # 1. Fetch all data
        plans_response = supabase.table('plans').select('plan, plan_label').execute()
        reps_response = supabase.table('reps').select('rep_id, first_name, last_name, points').execute()
        users_response = supabase.table('users').select('plan, associate').execute()

        if not plans_response.data or not reps_response.data:
            return []

        # 2. Process data into easily accessible structures
        reps_map = {rep['rep_id']: rep for rep in reps_response.data}
        
        plan_to_reps = defaultdict(set)
        for user in users_response.data:
            if user.get('plan') and user.get('associate'):
                plan_to_reps[user['plan']].add(user['associate'])

        # 3. Build the final response
        money_table_data = []
        for plan in plans_response.data:
            plan_name = plan['plan']
            associated_rep_ids = plan_to_reps[plan_name]
            
            plan_reps = []
            total_monthly_commission = 0
            
            for rep_id in associated_rep_ids:
                if rep_id in reps_map:
                    rep_data = reps_map[rep_id]
                    plan_reps.append(MoneyTableRep(
                        first_name=rep_data.get('first_name', ''),
                        last_name=rep_data.get('last_name', ''),
                        points=rep_data.get('points', 0)
                    ))
                    total_monthly_commission += rep_data.get('points', 0)
            
            money_table_data.append(MoneyTablePlan(
                plan=plan_name,
                plan_label=plan.get('plan_label', plan_name.capitalize()),
                total_annual_payouts=total_monthly_commission * 12,
                reps=plan_reps
            ))
            
        return money_table_data

    except Exception as e:
        logging.error(f"Error fetching money table data: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve money table data.")



# --- Billing Endpoints ---
@app.get("/plans", tags=["Billing"])
async def get_plans():
    try:
        products = stripe.Product.list(active=True, limit=100)
        prices = stripe.Price.list(active=True, limit=100)
        return {"products": products.data, "prices": prices.data}
    except Exception as e:
        logging.error(f"Error fetching plans: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch plans")


@app.get("/api/sonar/pricing/plans", tags=["Sonar Payments"])
async def get_sonar_pricing_plans():
    return await get_plans()

@app.post("/create-checkout-session", tags=["Billing"])
async def create_checkout_session(request: CreateCheckoutSessionRequest, current_user: dict = Depends(get_current_user)):
  current_user_id = current_user.id
  try:
    user_profile = supabase.table('users').select('email', 'stripe_customer_id', 'started_trial').eq('id', str(current_user_id)).single().execute()
    if not user_profile.data:
      raise HTTPException(status_code=404, detail="User not found")
    
    customer_id = user_profile.data.get('stripe_customer_id')
    user_email = user_profile.data.get('email')

    if not customer_id:
      customer = stripe.Customer.create(email=user_email, metadata={'supabase_user_id': str(current_user_id)})
      customer_id = customer.id
      supabase.table('users').update({'stripe_customer_id': customer_id}).eq('id', str(current_user_id)).execute()

    # Dynamically set the base URL based on TEST_MODE
    if TEST_MODE:
        base_url = "http://localhost:5173"
    else:
        base_url = "https://keyquarters.com"

    price_to_use = request.price_id
    checkout_session_data = {
      'customer': customer_id,
      'payment_method_types': ['card'],
      'line_items': [{'price': price_to_use, 'quantity': 1}],
      'mode': 'subscription',
      'allow_promotion_codes': True,
      'subscription_data': {'metadata': {'supabase_user_id': str(current_user_id)}},
      'success_url': f'{base_url}/dashboard?session_id={{CHECKOUT_SESSION_ID}}',
      'cancel_url': f'{base_url}/pricing?canceled=true',
    }

    # Conditionally add 14-day trial
    user_has_started_trial = user_profile.data.get('started_trial', False)
    if not user_has_started_trial:
      checkout_session_data['subscription_data']['trial_period_days'] = 14

    checkout_session = stripe.checkout.Session.create(**checkout_session_data)


    return {"sessionId": checkout_session.id, "url": checkout_session.url}

  except stripe.error.InvalidRequestError as e:
    if "No such customer" in str(e):
      logging.warning(f"Stale customer ID for user {current_user_id}. Creating a new one.")
      supabase.table('users').update({'stripe_customer_id': None}).eq('id', str(current_user_id)).execute()
      return await create_checkout_session(request, current_user_id)
    else:
      logging.error(f"Stripe InvalidRequestError: {e}", exc_info=True)
      raise HTTPException(status_code=500, detail=str(e))
  except Exception as e:
    logging.error(f"Error creating checkout session for user {current_user_id}: {e}", exc_info=True)
    raise HTTPException(status_code=500, detail="An internal error occurred.")

@app.get("/api/sonar/payments/test-mode", tags=["Sonar Payments"])
async def get_sonar_payment_test_mode():
    return {
        "testMode": PAYMENT_TEST_MODE,
        "enabled": PAYMENT_TEST_MODE,
        "mode": get_payment_mode_label(),
    }


@app.post("/api/sonar/payments/test-mode", tags=["Sonar Payments"])
async def set_sonar_payment_test_mode(request: PaymentTestModeRequest):
    set_payment_test_mode(request.enabled)
    return {
        "testMode": PAYMENT_TEST_MODE,
        "enabled": PAYMENT_TEST_MODE,
        "mode": get_payment_mode_label(),
    }

@app.post("/api/sonar/create-payment", tags=["Sonar Payments"])
async def create_payment(request: PaymentCreateRequest):
    description = request.description or ""
    payment_method_type = (request.payment_method_type or "card").lower()
    payment_method = "us_bank_account" if payment_method_type == "ach" else payment_method_type
    ensure_no_unresolved_templates(request.person_id, request.appointment_id, description)

    stripe_payment_intent = None
    stripe_error = None
    try:
        stripe.api_key = STRIPE_TEST_SECRET_KEY if PAYMENT_TEST_MODE else STRIPE_LIVE_SECRET_KEY
        if payment_method_type != "link":
            payment_intent_payload = {
                "amount": request.amount,
                "currency": request.currency,
                "description": description,
                "payment_method_types": [payment_method],
                "automatic_payment_methods": {"enabled": False},
                "metadata": {
                    "person_id": request.person_id or "",
                    "appointment_id": request.appointment_id or "",
                    "source": "wysl_scenarios",
                },
            }
            stripe_payment_intent = stripe.PaymentIntent.create(**payment_intent_payload)
    except Exception as exc:
        stripe_error = str(exc)
        logging.warning("Stripe payment intent creation failed, falling back to local payment row: %s", exc)

    payment_row = build_payment_row(
        amount=request.amount,
        currency=request.currency,
        payment_method=request.payment_method_type,
        description=description,
        status=(stripe_payment_intent.status if stripe_payment_intent else "created"),
        stripe_payment_intent_id=(stripe_payment_intent.id if stripe_payment_intent else None),
        receipt_url=None,
        error_message=stripe_error,
    )
    saved_payment = insert_payment_record(payment_row)
    emit_payment_trigger("invoice_created", {
        "payment": saved_payment,
        "stripe_payment_intent_id": stripe_payment_intent.id if stripe_payment_intent else None,
    })

    response_payload = dict(saved_payment)
    if stripe_payment_intent:
        response_payload.update({
            "client_secret": stripe_payment_intent.client_secret,
            "status": stripe_payment_intent.status,
            "id": stripe_payment_intent.id,
            "object": stripe_payment_intent.object,
            "amount": stripe_payment_intent.amount,
            "amount_received": stripe_payment_intent.amount_received,
            "currency": stripe_payment_intent.currency,
            "created": stripe_payment_intent.created,
            "latest_charge": stripe_payment_intent.latest_charge,
            "metadata": stripe_payment_intent.metadata,
        })
    else:
        response_payload.update({
            "client_secret": None,
            "id": saved_payment.get("stripe_payment_intent_id") or saved_payment.get("id"),
            "object": "payment_record",
        })
    return response_payload

@app.post("/api/sonar/create-payment-profile", tags=["Sonar Payments"])
async def create_payment_profile(request: PaymentProfileCreateRequest):
    description = request.description or ""
    payment_mode_base_url = get_payment_frontend_base_url()
    ensure_no_unresolved_templates(request.person_id, request.customer_name, request.customer_email, request.customer_phone, description)
    try:
        stripe.api_key = STRIPE_TEST_SECRET_KEY if PAYMENT_TEST_MODE else STRIPE_LIVE_SECRET_KEY
        customer_payload = {}
        if request.customer_email:
            customer_payload["email"] = request.customer_email
        if request.customer_name:
            customer_payload["name"] = request.customer_name
        if request.customer_phone:
            customer_payload["phone"] = request.customer_phone

        customer = stripe.Customer.create(
            **customer_payload,
            metadata={
                "person_id": request.person_id or "",
                "source": "wysl_scenarios",
            },
        )

        checkout_session = stripe.checkout.Session.create(
            mode="payment",
            customer=customer.id,
            line_items=[{
                "price_data": {
                    "currency": request.currency,
                    "product_data": {
                        **({"name": request.customer_name} if request.customer_name else {"name": "Payment Profile"}),
                        **({"description": description} if description else {}),
                    },
                    "unit_amount": request.amount,
                },
                "quantity": 1,
            }],
            success_url=f"{payment_mode_base_url}/dashboard?payment=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{payment_mode_base_url}/dashboard?payment=cancelled",
            metadata={
                "person_id": request.person_id or "",
                "source": "wysl_scenarios",
            },
        )

        payment_row = build_payment_row(
            amount=request.amount,
            currency=request.currency,
            payment_method="link",
            description=description,
            status="sent",
            stripe_session_id=checkout_session.id,
        )
        saved_payment = insert_payment_record(payment_row)
        emit_payment_trigger("payment_link_sent", {
            "payment": saved_payment,
            "payment_id": saved_payment.get("id"),
            "payment_url": checkout_session.url,
            "stripe_session_id": checkout_session.id,
            "customer_id": customer.id,
            "amount": request.amount,
            "currency": request.currency,
        })

        return {
            "customer_id": customer.id,
            "setup_intent_id": None,
            "client_secret": None,
            "payment_url": checkout_session.url,
            "amount": request.amount,
            "currency": request.currency,
            "status": "sent",
            "customer_name": request.customer_name,
            "customer_email": request.customer_email,
            "customer_phone": request.customer_phone,
            "stripe_session_id": checkout_session.id,
            "payment_id": saved_payment.get("id"),
        }
    except Exception as exc:
        logging.error("Error creating payment profile: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/api/sonar/create-invoice", tags=["Sonar Payments"])
async def create_invoice(request: InvoiceCreateRequest):
    description = request.description or ""
    ensure_no_unresolved_templates(
        request.person_id,
        request.appointment_id,
        request.service_id,
        request.customer_name,
        request.customer_email,
        request.customer_phone,
        description,
    )
    try:
        stripe.api_key = STRIPE_TEST_SECRET_KEY if PAYMENT_TEST_MODE else STRIPE_LIVE_SECRET_KEY

        customer_payload = {}
        if request.customer_email:
            customer_payload["email"] = request.customer_email
        if request.customer_name:
            customer_payload["name"] = request.customer_name
        if request.customer_phone:
            customer_payload["phone"] = request.customer_phone

        invoice_metadata = build_invoice_metadata(
            person_id=request.person_id,
            appointment_id=request.appointment_id,
            service_id=request.service_id,
        )

        customer = stripe.Customer.create(
            **customer_payload,
            metadata=invoice_metadata,
        )

        stripe.InvoiceItem.create(
            customer=customer.id,
            amount=request.amount,
            currency=request.currency,
            description=description or "Invoice",
            metadata=invoice_metadata,
        )

        invoice = stripe.Invoice.create(
            customer=customer.id,
            collection_method="send_invoice",
            days_until_due=max(int(request.due_days or 7), 1),
            auto_advance=False,
            description=description or None,
            metadata=invoice_metadata,
        )

        return serialize_stripe_invoice(invoice)
    except Exception as exc:
        logging.error("Error creating invoice: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/api/sonar/send-invoice", tags=["Sonar Payments"])
async def send_invoice(request: InvoiceSendRequest):
    ensure_no_unresolved_templates(request.invoice_id)
    try:
        stripe.api_key = STRIPE_TEST_SECRET_KEY if PAYMENT_TEST_MODE else STRIPE_LIVE_SECRET_KEY

        invoice = stripe.Invoice.retrieve(request.invoice_id)
        if invoice.get("status") == "draft":
            invoice = stripe.Invoice.finalize_invoice(request.invoice_id)

        sent_invoice = stripe.Invoice.send_invoice(request.invoice_id)

        fresh_invoice = stripe.Invoice.retrieve(request.invoice_id)
        return serialize_stripe_invoice(fresh_invoice)
    except Exception as exc:
        logging.error("Error sending invoice: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/api/sonar/update-payment", tags=["Sonar Payments"])
async def update_payment(request: PaymentUpdateRequest):
    ensure_no_unresolved_templates(request.payment_id, request.description, request.notes)
    payment_record = None
    if request.payment_id:
        existing = supabase.table("payments").select("*").eq("stripe_payment_intent_id", request.payment_id).limit(1).execute()
        if existing.data:
            payment_record = existing.data[0]
        else:
            existing = supabase.table("payments").select("*").eq("id", request.payment_id).limit(1).execute()
            if existing.data:
                payment_record = existing.data[0]

    if not payment_record:
        raise HTTPException(status_code=404, detail="Payment not found")

    update_data = {"status": request.status}
    if request.amount is not None:
        update_data["amount"] = request.amount
    if request.description is not None:
        update_data["description"] = request.description
    if request.notes is not None:
        update_data["notes"] = request.notes

    match_field = "stripe_payment_intent_id" if payment_record.get("stripe_payment_intent_id") == request.payment_id else "id"
    match_value = request.payment_id if match_field == "stripe_payment_intent_id" else payment_record.get("id")
    updated_payment = update_payment_record(match_field, match_value, update_data) or payment_record

    if request.status in {"succeeded", "paid"}:
        emit_payment_trigger("invoice_paid", {
            "payment": updated_payment,
            "payment_id": request.payment_id,
            "amount": updated_payment.get("amount"),
            "currency": updated_payment.get("currency"),
            "status": updated_payment.get("status"),
        })
    elif request.status in {"failed", "error", "declined"}:
        emit_payment_trigger("payment_failed", {
            "payment": updated_payment,
            "payment_id": request.payment_id,
            "error_message": updated_payment.get("error_message"),
            "status": updated_payment.get("status"),
        })

    return updated_payment

@app.post("/stripe-webhook", tags=["Billing"])
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    try:
        event = stripe.Webhook.construct_event(payload=await request.body(), sig_header=stripe_signature, secret=stripe_webhook_secret)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        if session.get("mode") == "payment":
            payment_status = session.get("payment_status")
            upsert_payment_from_stripe(
                session_id=session.get("id"),
                status="paid" if payment_status == "paid" else payment_status or "completed",
            )
            return {"status": "success"}

        customer_id = session.get('customer')
        subscription_id = session.get('subscription')
        subscription = stripe.Subscription.retrieve(subscription_id)

        plan_name = "free"  # Default to free
        source = None
        billing_period = None

        if 'items' in subscription and 'data' in subscription['items'] and subscription['items']['data']:
            price_data = subscription['items']['data'][0]['price']
            
            # Extract source from price metadata
            # The user has added a 'source' key to the metadata of the Stripe price.
            source = price_data.get('metadata', {}).get('source')
            source = source.lower() # Store source in lowercase

            # Extract billing period
            if price_data.get('recurring') and price_data['recurring'].get('interval'):
                interval = price_data['recurring']['interval']
                if interval == 'month':
                    billing_period = 'monthly'
                elif interval == 'year':
                    billing_period = 'yearly'

            # Extract plan name from product
            if price_data.get('product'):
                product = stripe.Product.retrieve(price_data.get('product'))
                if product.name:
                    plan_name = product.name.lower() # Store plan name in lowercase

        logging.info(f"Extracted Plan: {plan_name}, Source: {source}, Billing Period: {billing_period}")

        # Determine subscription status based on trial presence
        subscription_status = subscription.get('status')
        # If there's a trial_start, it means the subscription is currently in trial
        if subscription.get('trial_start'):
            subscription_status = "trialing"

        # Fetch current user data to check existing plan
        user_data_response = supabase.table('users').select('plan').eq('stripe_customer_id', customer_id).single().execute()
        current_plan = user_data_response.data.get('plan') if user_data_response.data else None

        update_data = {
            'stripe_subscription_id': subscription.get('id'),
            'subscription_status': subscription_status,
            'source': source, # New field
            'billing_period': billing_period, # New field
            'plan': plan_name,
            'trial_start_date': date.fromtimestamp(subscription.get('trial_start')).isoformat() if subscription.get('trial_start') else None,
            'trial_end_date': date.fromtimestamp(subscription.get('trial_end')).isoformat() if subscription.get('trial_end') else None,
            'months_subscribed': 0,
            'started_trial': True if subscription.get('trial_start') else False
        }
        
        if current_plan != plan_name:
            update_data['plan_change_popup'] = None

        supabase.table('users').update(update_data).eq('stripe_customer_id', customer_id).execute()
        logging.info(f"Checkout session completed for user with customer ID: {customer_id}. Plan changed: {current_plan} -> {plan_name}")

    elif event['type'] == 'invoice.created':
        invoice = event['data']['object']
        emit_payment_trigger("invoice_created", {
            "invoice": invoice,
            "customer_id": invoice.get("customer"),
            "invoice_id": invoice.get("id"),
            "amount_due": invoice.get("amount_due"),
            "currency": invoice.get("currency"),
            "status": invoice.get("status"),
        })
    elif event['type'] == 'invoice.sent':
        invoice = event['data']['object']
        emit_payment_trigger("invoice_sent", {
            "invoice": invoice,
            "customer_id": invoice.get("customer"),
            "invoice_id": invoice.get("id"),
            "amount_due": invoice.get("amount_due"),
            "currency": invoice.get("currency"),
            "hosted_invoice_url": invoice.get("hosted_invoice_url"),
        })
    elif event['type'] == 'invoice.paid':
        invoice = event['data']['object']
        try:
            customer_id = invoice.get('customer')
            amount_paid = invoice.get('amount_paid') # amount_paid is in cents
            
            if not customer_id or amount_paid is None or amount_paid <= 0:
                logging.warning(f"Skipping invoice.paid event due to missing data. Customer: {customer_id}, Amount: {amount_paid}")
                return {"status": "skipped"}
            
            # 1. Update user's subscription_status to "active" and increment months_subscribed
            user_data_response = supabase.table('users').select('id, associate, months_subscribed, subscription_status, stripe_subscription_id').eq('stripe_customer_id', customer_id).single().execute()

            if user_data_response.data:
                user_id = user_data_response.data['id']
                associate_rep_id = user_data_response.data.get('associate')
                current_months_subscribed = user_data_response.data.get('months_subscribed', 0)
                current_subscription_status = user_data_response.data.get('subscription_status')
                # Get the subscription_id from your Supabase record, not the webhook payload
                subscription_id_from_db = user_data_response.data.get('stripe_subscription_id')

                # Validate that the subscription ID from the DB exists before proceeding
                if not subscription_id_from_db:
                    logging.error(f"User {user_id} has no stripe_subscription_id in Supabase. Skipping invoice.paid processing.")
                    return {"status": "skipped - no subscription ID in database"}

                # Update user's subscription status to active and increment months_subscribed
                updated_months_subscribed = current_months_subscribed + 1
                user_update_data = {
                    'subscription_status': 'active',
                    'months_subscribed': updated_months_subscribed,
                    'log': None, # Clear any previous failure logs on success
                    'card_retries': 0, # Reset card retries on success
                    'latest_charge_attempt': datetime.now(timezone.utc).isoformat() # Update last attempt
                }
                
                user_status_update_response = supabase.table('users').update(user_update_data).eq('id', user_id).execute() # type: ignore
                if not user_status_update_response.data:
                    logging.error(f"Supabase update for user {user_id} subscription status affected no rows.", exc_info=True)
                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update user's subscription status.")
                logging.info(f"User {user_id} subscription status updated to 'active' and months_subscribed incremented to {updated_months_subscribed}.")
                emit_payment_trigger("invoice_paid", {
                    "invoice": invoice,
                    "customer_id": customer_id,
                    "amount_paid": amount_paid,
                    "currency": invoice.get("currency"),
                    "status": invoice.get("status"),
                    "user_id": user_id,
                })

                # 2. Commission Calculation for Rep
                if associate_rep_id:
                    logging.info(f"Attempting to find rep with full name: {associate_rep_id}")
                    rep_data_response = supabase.table('reps').select('id, tier, points').eq('associate_full_name', associate_rep_id).single().execute()
                    logging.debug(f"Rep data response: {rep_data_response.data}")
                    
                    if rep_data_response.data:
                        rep_db_id = rep_data_response.data['id']
                        rep_tier_name = rep_data_response.data.get('tier')
                        rep_current_points = rep_data_response.data.get('points') or 0 # Ensure points default to 0 if None

                        if rep_tier_name:
                            tier_data_response = supabase.table('tiers').select('multiplier_new_acquisition, multiplier_rebill').eq('name', rep_tier_name).single().execute() # type: ignore
                            logging.debug(f"Tier data response for tier '{rep_tier_name}': {tier_data_response.data}")
                            if tier_data_response.data:
                                multiplier = 0
                                # Use the previous status to determine the multiplier
                                if current_subscription_status == 'trialing':
                                    multiplier = tier_data_response.data.get('multiplier_new_acquisition', 0)
                                    logging.info(f"Applying new acquisition multiplier for rep {associate_rep_id}.")
                                else:
                                    multiplier = tier_data_response.data.get('multiplier_rebill', 0)
                                    logging.info(f"Applying rebill multiplier for rep {associate_rep_id}.")

                                billed_amount_dollars = amount_paid / 100
                                commission_points = billed_amount_dollars * multiplier
                                
                                # Fetch the final global points multiplier from the master table
                                master_response = supabase.table('master').select('points_multiplier').eq('id', '0').single().execute()
                                final_multiplier = master_response.data.get('points_multiplier', 1.0) if master_response.data else 1.0
                                
                                final_commission_points = commission_points * final_multiplier
                                
                                # Round the final commission points to the nearest whole number
                                rounded_points_to_add = round(final_commission_points)
                                
                                updated_points = rep_current_points + rounded_points_to_add
                                
                                # Fetch current total_points for the user
                                user_current_points_response = supabase.table('users').select('total_points').eq('id', user_id).single().execute() # type: ignore
                                current_total_points = user_current_points_response.data.get('total_points', 0) if user_current_points_response.data else 0
                                new_total_points = current_total_points + rounded_points_to_add

                                # Update the user's record with the last awarded points and total points
                                user_points_update_response = supabase.table('users').update({'last_awarded_points': rounded_points_to_add, 'total_points': new_total_points}).eq('id', user_id).execute() # type: ignore
                                if not user_points_update_response.data:
                                    logging.error(f"Supabase update for user {user_id} with last_awarded_points and total_points affected no rows.", exc_info=True)
                                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update user's awarded points.")
                                logging.info(f"User {user_id} awarded {rounded_points_to_add} points to rep {associate_rep_id}.")
                                logging.info(f"User {user_id} total_points updated to {new_total_points}.")


                                rep_points_update_response = supabase.table('reps').update({'points': updated_points}).eq('id', rep_db_id).execute() # type: ignore
                                if not rep_points_update_response.data:
                                    logging.error(f"Supabase update for rep {rep_db_id} points affected no rows.", exc_info=True)
                                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update rep's points.")
                                logging.info(f"Commission calculated (Tier: {commission_points:.2f}, Final: {final_commission_points:.2f}, Rounded: {rounded_points_to_add}) and added to rep {associate_rep_id}. New total: {updated_points}")
                            else:
                                logging.warning(f"Tier '{rep_tier_name}' not found in 'tiers' table for commission calculation.")
                        else:
                            logging.warning(f"Rep '{associate_rep_id}' does not have a tier assigned for commission calculation.")
                    else:
                        logging.warning(f"Rep '{associate_rep_id}' not found in 'reps' table. Skipping commission update.")
                else:
                    logging.warning(f"User {user_id} does not have an associate for commission calculation.")
            else:
                logging.warning(f"User not found for stripe_customer_id {customer_id} during invoice.paid event.")
        except HTTPException:
            raise # Re-raise HTTPExceptions
        except Exception as e:
            logging.error(f"An unexpected error occurred during invoice.paid event processing for customer {customer_id}: {e}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An internal error occurred during invoice.paid processing: {str(e)}")

    elif event['type'] == 'invoice.payment_failed':
        invoice = event['data']['object']
        customer_id = invoice.get('customer')
        # next_payment_attempt is a timestamp, convert to datetime for logging
        latest_attempt_date = datetime.fromtimestamp(invoice.get('next_payment_attempt')).isoformat() if invoice.get('next_payment_attempt') else datetime.now(timezone.utc).isoformat()
        failure_reason = invoice.get('last_payment_error', {}).get('message', 'Payment failed for unknown reason.')

        if customer_id:
            user_data_response = supabase.table('users').select('id, card_retries').eq('stripe_customer_id', customer_id).single().execute()
            if user_data_response.data:
                user_id = user_data_response.data['id']
                current_card_retries = user_data_response.data.get('card_retries', 0)

                user_update_data = {
                    'subscription_status': 'failed',
                    'log': f"Payment failed: {failure_reason}",
                    'card_retries': current_card_retries + 1,
                    'latest_charge_attempt': datetime.now(timezone.utc).isoformat()
                }
                supabase.table('users').update(user_update_data).eq('id', user_id).execute()
                emit_payment_trigger("payment_failed", {
                    "invoice": invoice,
                    "customer_id": customer_id,
                    "user_id": user_id,
                    "failure_reason": failure_reason,
                    "currency": invoice.get("currency"),
                    "status": invoice.get("status"),
                })
            else:
                logging.error(f"User not found for stripe_customer_id {customer_id} during payment_failed event.")
        else:
            logging.error(f"Customer ID missing in invoice.payment_failed event.")
    elif event['type'] == 'payment_intent.succeeded':
        payment_intent = event['data']['object']
        updated_payment = upsert_payment_from_stripe(
            payment_intent_id=payment_intent.get("id"),
            status="succeeded",
            receipt_url=payment_intent.get("charges", {}).get("data", [{}])[0].get("receipt_url") if payment_intent.get("charges", {}).get("data") else None,
        )
        emit_payment_trigger("invoice_paid", {
            "payment_intent": payment_intent,
            "payment": updated_payment,
            "amount": payment_intent.get("amount"),
            "currency": payment_intent.get("currency"),
            "status": payment_intent.get("status"),
        })
    elif event['type'] == 'payment_intent.payment_failed':
        payment_intent = event['data']['object']
        last_error = payment_intent.get("last_payment_error", {})
        updated_payment = upsert_payment_from_stripe(
            payment_intent_id=payment_intent.get("id"),
            status="failed",
            error_message=last_error.get("message"),
        )
        emit_payment_trigger("payment_failed", {
            "payment_intent": payment_intent,
            "payment": updated_payment,
            "failure_reason": last_error.get("message"),
            "amount": payment_intent.get("amount"),
            "currency": payment_intent.get("currency"),
            "status": payment_intent.get("status"),
        })

    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        customer_id = subscription.get('customer')
        subscription_id = subscription.get('id')
        
        if customer_id and subscription_id:
            # Fetch the user from Supabase
            user_data_response = supabase.table('users').select('id, subscription_status, plan').eq('stripe_customer_id', customer_id).single().execute()

            if user_data_response.data:
                user_id = user_data_response.data['id']
                current_subscription_status = user_data_response.data.get('subscription_status')
                current_plan = user_data_response.data.get('plan')

                # Use 'ended_at' from the Stripe subscription object for the cancellation date.
                # If 'ended_at' is not present, use current UTC time.
                ended_at_timestamp = subscription.get('ended_at')
                cancellation_date = date.fromtimestamp(ended_at_timestamp).isoformat() if ended_at_timestamp else datetime.now(timezone.utc).isoformat()

                update_data = {
                    'subscription_status': 'canceled', # Set status to 'canceled'
                    'trial_end_date': cancellation_date, # Set the date when the trial/subscription ended
                    'stripe_subscription_id': None, # Clear the subscription ID as it's deleted
                    'plan': 'free', # Revert to free plan as the subscription is gone
                    'source': None, # Clear source and billing period
                    'billing_period': None,
                    'started_trial': False # Trial is no longer active
                }

                supabase.table('users').update(update_data).eq('id', user_id).execute()
                logging.info(f"User {user_id} (customer {customer_id}) subscription deleted. Status set to 'canceled'. Subscription ID: {subscription_id}")
            else:
                logging.warning(f"User not found for stripe_customer_id {customer_id} during customer.subscription.deleted event.")
        else:
            logging.error(f"Missing customer_id or subscription_id in customer.subscription.deleted event.")
    return {"status": "success"}








# --- User Endpoints ---


@app.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED, tags=["Users"])
async def create_user(auth_data: AuthSignUpRequest):
    try:
        auth_response = supabase.auth.sign_up({"email": auth_data.email, "password": auth_data.password})
        if not auth_response.user:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Supabase signup failed")
        
        user_id = auth_response.user.id
        user_metadata = getattr(auth_response.user, "user_metadata", {}) or {}
        profile_data = {
            "id": str(user_id),
            "email": auth_data.email,
            "full_name": user_metadata.get("full_name") or user_metadata.get("name"),
            "phone": user_metadata.get("phone"),
        }
        db_response = supabase_admin.table('users').insert(profile_data).execute()
        
        if not db_response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user profile")
        return db_response.data[0]
    except AuthApiError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.get("/users/me", tags=["Users"])
async def read_current_user(current_user: dict = Depends(get_current_user)):
    logging.info(f"read_current_user called for user ID: {current_user.id}")
    try:
        response = supabase_admin.table('users').select('*').eq('id', str(current_user.id)).limit(1).execute()
        logging.info(f"Supabase select response (raw): {response}")
        
        if not response.data or not response.data[0]:
            logging.info(f"User profile not found in public.users for ID: {current_user.id}. Attempting to create default profile.")
            
            user_email = current_user.email
            user_metadata = getattr(current_user, "user_metadata", {}) or {}
            logging.info(f"Retrieved email from current_user object: {user_email}")

            profile_data = {
                "id": str(current_user.id),
                "email": user_email,
                "full_name": user_metadata.get("full_name") or user_metadata.get("name"),
                "phone": user_metadata.get("phone"),
            }
            logging.info(f"Prepared profile_data for insertion: {profile_data}")
            
            insert_response = supabase_admin.table('users').insert(profile_data).execute()
            logging.info(f"Supabase insert response: {insert_response}")

            if not insert_response.data:
                logging.error(f"Failed to create user profile in public.users for ID: {current_user.id}. Supabase response: {insert_response.error}")
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user profile after OAuth login.")
            
            # Return the newly created profile
            return UserResponse.model_validate(insert_response.data[0]).model_dump()
        
        return UserResponse.model_validate(response.data[0]).model_dump()
    except Exception as e:
        logging.error(f"Error in read_current_user for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.put("/users/me", tags=["Users"])
async def update_user_profile(user_update_data: UserUpdate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    update_data = user_update_data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")
    
    if 'active_ai_agent' in update_data and update_data['active_ai_agent'] is not None:
        update_data['active_ai_agent'] = str(update_data['active_ai_agent'])

    try:
        response = supabase.table('users').update(update_data).eq('id', str(current_user_id)).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found or update failed")
        
        # Explicitly handle potential None values for date fields during response serialization
        user_data = response.data[0]
        if user_data.get('trial_start_date') is None: user_data['trial_start_date'] = None
        if user_data.get('trial_end_date') is None: user_data['trial_end_date'] = None

        return UserResponse.model_validate(user_data).model_dump()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.post("/users/me/login-status", status_code=status.HTTP_204_NO_CONTENT, tags=["Users"])
async def update_login_status(status_update: LoginStatusUpdate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        update_data = status_update.model_dump()
        supabase.table('users').update(update_data).eq('id', str(current_user_id)).execute()
    except Exception as e:
        logging.error(f"ERROR: Could not update login status for user {current_user_id}: {e}")

@app.post("/users/me/onboarding", status_code=status.HTTP_200_OK, tags=["Users"])
async def complete_onboarding(
    onboarding_data: OnboardingRequest,
    current_user: dict = Depends(get_current_user),
):
    current_user_id = str(current_user.id)

    try:
        user_update = {
            "onboarded": True,
            "phone": onboarding_data.business_phone,
        }
        supabase.table('users').update(user_update).eq('id', current_user_id).execute()

        business_payload = {
            "name": onboarding_data.business_name,
            "phone": onboarding_data.business_phone,
            "email": onboarding_data.business_email,
            "address": onboarding_data.business_street,
            "city": onboarding_data.business_city,
            "state": onboarding_data.business_state,
            "zip": onboarding_data.business_zip,
            "about_us": onboarding_data.about_company or "",
            "business_hours": json.dumps(onboarding_data.business_hours or {}),
            "business_timezone": onboarding_data.business_timezone or "America/New_York",
            "industry": {
                "industry": onboarding_data.industry,
                "sub_industry": onboarding_data.sub_industry,
                "appointment_settings": onboarding_data.appointment_settings or {},
            },
            "user_id": current_user_id,
        }

        existing_business_response = supabase.table('businesses').select('id').eq('user_id', current_user_id).limit(1).execute()
        existing_business = existing_business_response.data[0] if existing_business_response.data else None

        if existing_business:
            business_response = (
                supabase.table('businesses')
                .update(business_payload)
                .eq('id', existing_business['id'])
                .execute()
            )
        else:
            business_response = supabase.table('businesses').insert(business_payload).execute()

        return {
            "onboarded": True,
            "business": business_response.data[0] if business_response.data else None,
        }
    except Exception as e:
        logging.error(f"Failed to complete onboarding for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save onboarding data.",
        )


@app.get("/businesses/me/forwarding", tags=["Businesses"])
async def get_business_forwarding(
    current_user: dict = Depends(get_current_user),
):
    current_user_id = str(current_user.id)

    try:
        business = get_business_record_for_user(current_user_id)
        config = normalize_forwarding_config(business.get('forwarding_config'))

        current_entry = None
        if config.get("active_number_id"):
            current_entry = next(
                (entry for entry in config["numbers"] if entry.get("id") == config["active_number_id"]),
                None,
            )

        return {
            "business_id": business["id"],
            "business_phone": business.get("phone"),
            "forwarding_target_number": get_global_forwarding_target_number(),
            "forwarding_config": config,
            "current_entry": current_entry,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to load forwarding config for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load forwarding settings.",
        )


@app.put("/businesses/me/forwarding", tags=["Businesses"])
async def update_business_forwarding(
    payload: BusinessForwardingUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    current_user_id = str(current_user.id)

    try:
        business = get_business_record_for_user(current_user_id)
        config = normalize_forwarding_config(business.get('forwarding_config'))
        now = datetime.now(timezone.utc).isoformat()
        numbers = config["numbers"]

        existing_entry = None
        existing_index = None

        for index, entry in enumerate(numbers):
            if payload.entry_id and entry.get("id") == payload.entry_id:
                existing_entry = entry
                existing_index = index
                break
            if entry.get("source_number") == payload.source_number:
                existing_entry = entry
                existing_index = index
                break

        entry_id = payload.entry_id or (existing_entry or {}).get("id") or str(uuid4())
        source_label = payload.source_label or (
            "Main business line" if payload.source_number == business.get("phone") else payload.source_number
        )
        provider_label = payload.provider_label or payload.provider

        confirmed_enabled_at = (existing_entry or {}).get("confirmed_enabled_at")
        verified_at = (existing_entry or {}).get("verified_at")

        if payload.confirmed_enabled:
            confirmed_enabled_at = confirmed_enabled_at or now
        elif payload.status == "draft":
            confirmed_enabled_at = None

        if payload.verified:
            verified_at = now
        elif payload.status != "verified":
            verified_at = None

        next_status = payload.status or (existing_entry or {}).get("status") or "draft"
        if payload.verified:
            next_status = "verified"
        elif payload.confirmed_enabled and next_status == "draft":
            next_status = "pending_test"

        next_entry = {
            "id": entry_id,
            "source_number": payload.source_number,
            "source_label": source_label,
            "provider": payload.provider,
            "provider_label": provider_label,
            "target_number": get_global_forwarding_target_number(),
            "status": next_status,
            "confirmed_enabled_at": confirmed_enabled_at,
            "verified_at": verified_at,
            "updated_at": now,
            "created_at": (existing_entry or {}).get("created_at") or now,
        }

        if existing_index is None:
            numbers.append(next_entry)
        else:
            numbers[existing_index] = next_entry

        config["active_number_id"] = entry_id

        update_response = (
            supabase
            .table('businesses')
            .update({"forwarding_config": config})
            .eq('id', business["id"])
            .execute()
        )

        if not update_response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save forwarding settings")

        push_live_event(
            "Business forwarding updated.",
            actor="system",
            severity="info",
            event_type="business_forwarding_updated",
            payload={
                "business_id": business["id"],
                "source_number": payload.source_number,
                "status": next_status,
            },
        )

        return {
            "business_id": business["id"],
            "business_phone": business.get("phone"),
            "forwarding_target_number": get_global_forwarding_target_number(),
            "forwarding_config": config,
            "entry": next_entry,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to update forwarding config for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save forwarding settings.",
        )

# --- Leads Endpoints ---

@app.get("/leads", response_model=List[LeadResponse], tags=["Leads"])
async def get_leads_for_user(current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        response = supabase.table('leads').select(
            '*, lead_campaigns(*, campaigns(name)), purchases(*)'
        ).eq(
            'user', str(current_user_id)
        ).execute()
        return response.data
    except Exception as e:
        logging.error(f"Failed to get leads for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"An internal error occurred while fetching leads: {str(e)}"
        )

@app.post("/leads", response_model=LeadResponse, status_code=status.HTTP_201_CREATED, tags=["Leads"])
async def create_lead_for_user(lead_data: LeadCreate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    new_lead = lead_data.model_dump()
    new_lead['user'] = str(current_user_id)
    try:
        response = supabase.table('leads').insert(new_lead).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create lead")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.put("/leads/{lead_id}", response_model=LeadResponse, tags=["Leads"])
async def update_lead_for_user(lead_id: UUID, lead_update_data: LeadUpdate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    update_data = lead_update_data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")
    
    if update_data.get("created_at"):
        update_data["created_at"] = update_data["created_at"].isoformat()
    if update_data.get("last_checked"):
        update_data["last_checked"] = update_data["last_checked"].isoformat()
    if update_data.get("last_follow_up"):
        update_data["last_follow_up"] = update_data["last_follow_up"].isoformat()
    
    try:
        ownership_check = supabase.table('leads').select('id').eq('id', str(lead_id)).eq('user', str(current_user_id)).single().execute()
        if not ownership_check.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found or you do not have permission to edit it.")
        
        response = supabase.table('leads').update(update_data).eq('id', str(lead_id)).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Lead not found or update failed (no rows affected).")
        
        return LeadResponse.model_validate(response.data[0]).model_dump()
    except Exception as e:
        logging.error(f"AN ERROR OCCURRED during lead update for user {current_user_id} and lead {lead_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred during lead update: {str(e)}")

@app.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Leads"])
async def delete_lead_for_user(lead_id: UUID, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        ownership_check = supabase.table('leads').select('id').eq('id', str(lead_id)).eq('user', str(current_user_id)).single().execute()
        if not ownership_check.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found or you do not have permission to delete it.")
        supabase.table('leads').delete().eq('id', str(lead_id)).execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# --- Purchases Endpoints ---
@app.post("/purchases", response_model=PurchaseResponse, status_code=status.HTTP_201_CREATED, tags=["Purchases"])
async def create_purchase(purchase_data: PurchaseCreate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        lead_owner_check = supabase.table('leads').select('user').eq('id', str(purchase_data.lead)).single().execute()
    except Exception as e:
        logging.error(f"DATABASE ERROR during lead ownership check for lead {purchase_data.lead}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error checking lead ownership.")

    if not lead_owner_check.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Lead {purchase_data.lead} not found.")

    lead_owner_id = lead_owner_check.data['user']

    if str(lead_owner_id) != str(current_user_id):
        logging.warning(f"PERMISSION DENIED: User '{current_user_id}' does not own lead '{purchase_data.lead}'. Owner is '{lead_owner_id}'.")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    new_purchase = purchase_data.model_dump()
    new_purchase['user'] = str(current_user_id)

    if new_purchase.get("upgrade_eligible_date"):
        new_purchase["upgrade_eligible_date"] = new_purchase["upgrade_eligible_date"].isoformat()

    if new_purchase.get("lead"):
        new_purchase["lead"] = str(new_purchase["lead"])

    try:
        response = supabase.table('purchases').insert(new_purchase).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create purchase")
        return response.data[0]
    except Exception as e:
        logging.error(f"DATABASE ERROR creating purchase for lead {purchase_data.lead}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.put("/purchases/{purchase_id}", response_model=PurchaseResponse, tags=["Purchases"])
async def update_purchase(purchase_id: UUID, purchase_update: PurchaseUpdate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        owner_check = supabase.table('purchases').select('user').eq('id', str(purchase_id)).single().execute()
    except Exception as e:
        logging.error(f"DATABASE ERROR during ownership check for purchase {purchase_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error checking purchase ownership.")

    if not owner_check.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Purchase {purchase_id} not found.")

    if str(owner_check.data['user']) != str(current_user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    update_data = purchase_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")

    if update_data.get("upgrade_eligible_date"):
        update_data["upgrade_eligible_date"] = update_data["upgrade_eligible_date"].isoformat()

    try:
        response = supabase.table('purchases').update(update_data).eq('id', str(purchase_id)).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase not found or update failed")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.delete("/purchases/{purchase_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Purchases"])
async def delete_purchase(purchase_id: UUID, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        owner_check = supabase.table('purchases').select('user').eq('id', str(purchase_id)).single().execute()
    except Exception as e:
        logging.error(f"DATABASE ERROR during ownership check for purchase {purchase_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error checking purchase ownership.")
    
    if not owner_check.data:
        return

    if str(owner_check.data['user']) != str(current_user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    try:
        supabase.table('purchases').delete().eq('id', str(purchase_id)).execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# =============================================================================
# HELPDESK ENDPOINTS
# =============================================================================
@app.post("/helpdesk", status_code=status.HTTP_201_CREATED, tags=["Helpdesk"])
async def submit_helpdesk_message(message_data: HelpdeskMessage):
    try:
        insert_data = message_data.model_dump()
        if insert_data['user'] is not None:
            insert_data['user'] = str(insert_data['user'])

        response = supabase.table('helpdesk').insert(insert_data).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to submit helpdesk message")
        return {"message": "Helpdesk message submitted successfully!"}
    except Exception as e:
        logging.error(f"Error submitting helpdesk message: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    




# =============================================================================
# AI AGENT ENDPOINTS
# =============================================================================

@app.get("/ai-agents", response_model=List[AIAgentResponse], tags=["AI Agents"])
async def get_available_ai_agents(current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        response = supabase.table('ai_agents').select('*').or_(
            f'access.eq.open,user.eq.{str(current_user_id)}'
        ).execute()
        
        return response.data
    except Exception as e:
        logging.error(f"Error getting available AI agents for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve AI agents")

# =============================================================================
# CAMPAIGN ENDPOINTS
# =============================================================================

@app.post("/campaigns", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED, tags=["Campaigns"])
async def create_campaign(campaign_data: CampaignCreate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    new_campaign = campaign_data.model_dump()
    new_campaign['user'] = str(current_user_id)
    try:
        response = supabase.table('campaigns').insert(new_campaign).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create campaign")
        return response.data[0]
    except Exception as e:
        logging.error(f"Error creating campaign for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.get("/campaigns", response_model=List[CampaignResponse], tags=["Campaigns"])
async def get_campaigns(current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        response = supabase.table('campaigns').select('*').eq('user', str(current_user_id)).execute()
        return response.data
    except Exception as e:
        logging.error(f"Error getting campaigns for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve campaigns")

@app.get("/campaigns/{campaign_id}", response_model=CampaignResponse, tags=["Campaigns"])
async def get_campaign(campaign_id: UUID, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        response = supabase.table('campaigns').select('*').eq('id', str(campaign_id)).eq('user', str(current_user_id)).single().execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found or permission denied")
        return response.data
    except Exception as e:
        logging.error(f"Error getting campaign {campaign_id} for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve campaign")

@app.put("/campaigns/{campaign_id}", response_model=CampaignResponse, tags=["Campaigns"])
async def update_campaign(campaign_id: UUID, campaign_data: CampaignUpdate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    update_data = campaign_data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")
    
    try:
        ownership_check = supabase.table('campaigns').select('id').eq('id', str(campaign_id)).eq('user', str(current_user_id)).single().execute()
        if not ownership_check.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found or permission denied")

        response = supabase.table('campaigns').update(update_data).eq('id', str(campaign_id)).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign update failed")
        return response.data[0]
    except Exception as e:
        logging.error(f"Error updating campaign {campaign_id} for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update campaign")

@app.delete("/campaigns/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Campaigns"])
async def delete_campaign(campaign_id: UUID, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        ownership_check = supabase.table('campaigns').select('id').eq('id', str(campaign_id)).eq('user', str(current_user_id)).single().execute()
        if not ownership_check.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found or permission denied")

        supabase.table('campaigns').delete().eq('id', str(campaign_id)).execute()
    except Exception as e:
        logging.error(f"Error deleting campaign {campaign_id} for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete campaign")

# =============================================================================
# PRIZE ENDPOINTS
# =============================================================================

@app.post("/prizes", response_model=PrizeResponse, status_code=status.HTTP_201_CREATED, tags=["Prizes"])
async def create_prize(prize_data: PrizeCreate, current_rep_id: str = Depends(get_current_rep)):
    new_prize = prize_data.model_dump()
    try:
        response = supabase.table('prizes').insert(new_prize).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create prize")
        return response.data[0]
    except Exception as e:
        logging.error(f"Error creating prize for rep {current_rep_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.get("/prizes", response_model=List[PrizeResponse], tags=["Prizes"])
async def get_all_prizes(current_rep_id: str = Depends(get_current_rep)):
    try:
        response = supabase.table('prizes').select('*').execute()
        return response.data
    except Exception as e:
        logging.error(f"Error getting all prizes for rep {current_rep_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve prizes")

@app.get("/prizes/{prize_id}", response_model=PrizeResponse, tags=["Prizes"])
async def get_prize(prize_id: UUID, current_rep_id: str = Depends(get_current_rep)):
    try:
        response = supabase.table('prizes').select('*').eq('id', str(prize_id)).single().execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prize not found")
        return response.data
    except Exception as e:
        logging.error(f"Error getting prize {prize_id} for rep {current_rep_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve prize")

@app.put("/prizes/{prize_id}", response_model=PrizeResponse, tags=["Prizes"])
async def update_prize(prize_id: UUID, prize_data: PrizeUpdate, current_rep_id: str = Depends(get_current_rep)):
    update_data = prize_data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")
    
    try:
        response = supabase.table('prizes').update(update_data).eq('id', str(prize_id)).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prize not found or update failed")
        return response.data[0]
    except Exception as e:
        logging.error(f"Error updating prize {prize_id} for rep {current_rep_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update prize")

@app.delete("/prizes/{prize_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Prizes"])
async def delete_prize(prize_id: UUID, current_rep_id: str = Depends(get_current_rep)):
    try:
        response = supabase.table('prizes').delete().eq('id', str(prize_id)).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prize not found")
    except Exception as e:
        logging.error(f"Error deleting prize {prize_id} for rep {current_rep_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete prize")

@app.post("/prizes/{prize_id}/redeem", response_model=RepResponse, tags=["Prizes"])
async def redeem_prize(prize_id: UUID, current_rep_id: str = Depends(get_current_rep)):
    logging.info(f"--- [REDEEM PRIZE] Redemption process started for prize_id: {prize_id} by rep_id: {current_rep_id} ---")
    try:
        # 1. Fetch prize details
        logging.info(f"--- [REDEEM PRIZE] Fetching prize details for prize_id: {prize_id} ---")
        prize_response = supabase.table('prizes').select('name, points').eq('id', str(prize_id)).single().execute()
        
        if not prize_response.data:
            logging.warning(f"--- [REDEEM PRIZE] Prize not found: {prize_id} ---")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prize not found.")
        
        prize = prize_response.data
        prize_cost = prize.get('points', 0)
        logging.info(f"--- [REDEEM PRIZE] Prize found: {prize.get('name')}, Cost: {prize_cost} points ---")

        # 2. Fetch rep profile
        logging.info(f"--- [REDEEM PRIZE] Fetching rep profile for rep_id: {current_rep_id} ---")
        rep_response = supabase.table('reps').select('id, points, first_name, last_name').eq('rep_id', current_rep_id).single().execute()
        
        if not rep_response.data:
            logging.warning(f"--- [REDEEM PRIZE] Representative profile not found for rep_id: {current_rep_id} ---")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Representative profile not found.")
        
        rep = rep_response.data
        rep_current_points = rep.get('points', 0)
        rep_db_id = rep.get('id')
        rep_first_name = rep.get('first_name')
        rep_last_name = rep.get('last_name')
        logging.info(f"--- [REDEEM PRIZE] Rep found: DB ID: {rep_db_id}, Current Points: {rep_current_points}, Name: {rep_first_name} {rep_last_name} ---")

        # 3. Check if rep has enough points
        if rep_current_points < prize_cost:
            logging.warning(f"--- [REDEEM PRIZE] Insufficient points. Rep has {rep_current_points}, prize costs {prize_cost} ---")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient points to redeem this prize.")

        # 4. Deduct points from rep and increment prize purchases_count
        updated_rep_points = rep_current_points - prize_cost
        logging.info(f"--- [REDEEM PRIZE] Updating rep points to {updated_rep_points} ---")

        # Update rep's points
        update_rep_response = supabase.table('reps').update({'points': updated_rep_points}).eq('id', rep_db_id).execute()
        if update_rep_response.data:
            logging.info(f"--- [REDEEM PRIZE] Rep points updated successfully. ---")
        else:
            logging.error(f"--- [REDEEM PRIZE] Failed to update rep points for rep_db_id: {rep_db_id}. Response: {update_rep_response} ---")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update representative's points.")
        
        # Increment prize's purchases_count using RPC
        logging.info(f"--- [REDEEM PRIZE] Calling RPC to increment prize purchases_count for prize_id: {prize_id} ---")
        rpc_response = supabase.rpc('increment_prize_purchases_count', {'prize_id_param': str(prize_id)}).execute()
        logging.info(f"--- [REDEEM PRIZE] RPC 'increment_prize_purchases_count' executed successfully. Response data: {rpc_response.data} ---")

        # Add rep info to prize purchases JSONB column
        rep_purchase_info = {"first_name": rep_first_name, "last_name": rep_last_name, "redeemed_at": datetime.now(timezone.utc).isoformat()}
        logging.info(f"--- [REDEEM PRIZE] Calling RPC to add rep info to prize purchases for prize_id: {prize_id} with info: {rep_purchase_info} ---")
        add_purchase_response = supabase.rpc('add_rep_to_prize_purchases', {'prize_id_param': str(prize_id), 'rep_info_param': rep_purchase_info}).execute()
        logging.info(f"--- [REDEEM PRIZE] RPC 'add_rep_to_prize_purchases' executed successfully. Response data: {add_purchase_response.data} ---")


        # 5. Fetch and return updated rep profile
        logging.info(f"--- [REDEEM PRIZE] Fetching updated rep profile for rep_id: {current_rep_id} ---")
        updated_rep_profile_response = supabase.table('reps').select('*').eq('rep_id', current_rep_id).single().execute()
        if not updated_rep_profile_response.data:
            logging.error(f"--- [REDEEM PRIZE] Failed to retrieve updated rep profile for rep_id: {current_rep_id} after redemption. ---")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve updated rep profile.")
        
        logging.info(f"--- [REDEEM PRIZE] Prize redemption successful for rep_id: {current_rep_id}. New points: {updated_rep_profile_response.data.get('points')} ---")
        return RepResponse.model_validate(updated_rep_profile_response.data).model_dump()

    except HTTPException as e:
        logging.error(f"--- [REDEEM PRIZE] HTTPException during redemption: {e.detail} (Status: {e.status_code}) ---", exc_info=True)
        raise e
    except Exception as e:
        logging.error(f"--- [REDEEM PRIZE] An unexpected error occurred during prize redemption for prize_id {prize_id} by rep {current_rep_id}: {e} ---", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An internal error occurred during prize redemption.")

# =============================================================================
# PASSWORD ENDPOINTS
# =============================================================================
@app.get("/passwords", response_model=List[PasswordResponse], tags=["Passwords"])
async def get_passwords_for_user(current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        response = supabase.table('passwords').select('id, account, username, password, phone, notes, user, isFavorite, tag, url, oauth, date_created, date_updated').eq('user', str(current_user_id)).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.post("/passwords", response_model=PasswordResponse, status_code=status.HTTP_201_CREATED, tags=["Passwords"])
async def create_password_for_user(password_data: PasswordCreate, current_user: dict = Depends(get_current_user)):
    user_response = supabase.table("users").select("*").eq("id", str(current_user.id)).single().execute()
    if not user_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    user = user_response.data
    user_plan_name = user.get("plan")

    if not user_plan_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have a subscription plan.")

    plan_response = supabase.table("plans").select("*").eq("plan", user_plan_name).single().execute()
    if not plan_response.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Plan '{user_plan_name}' not found.")
    
    plan = plan_response.data

    total_passwords_limit = plan.get("total_passwords_limit")
    daily_passwords_limit = plan.get("daily_passwords_limit")
    
    total_passwords_count = user.get("total_passwords_count", 0) or 0
    daily_passwords_count = user.get("daily_passwords_count", 0) or 0

    if total_passwords_limit is not None and total_passwords_limit > 0 and total_passwords_count >= total_passwords_limit:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="You have reached your total password creation limit for this billing period.")
    
    if daily_passwords_limit is not None and daily_passwords_limit > 0 and daily_passwords_count >= daily_passwords_limit:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="You have reached your daily password creation limit.")

    try:
        new_password_data = password_data.model_dump()
        new_password_data['user'] = str(current_user.id)
        if password_data.tag is not None:
            new_password_data['tag'] = password_data.tag
        
        logging.info(f"Attempting to insert new password data: {new_password_data}") # Added logging
        insert_response = supabase.table('passwords').insert(new_password_data).execute()
        
        if not insert_response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create password")
        
        supabase.rpc('increment_password_counts', {'user_id_param': str(current_user.id)}).execute()
            
        return insert_response.data[0]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.put("/passwords/{password_id}", response_model=PasswordResponse, tags=["Passwords"])
async def update_password_for_user(password_id: UUID, password_update_data: PasswordUpdate, current_user: dict = Depends(get_current_user)):
    update_data = password_update_data.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")
    
    try:
        ownership_check = supabase.table('passwords').select('id').eq('id', str(password_id)).eq('user', str(current_user.id)).single().execute()
        if not ownership_check.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Password not found or you do not have permission to edit it.")
        
        update_data['date_updated'] = datetime.now(timezone.utc).isoformat()
        response = supabase.table('passwords').update(update_data).eq('id', str(password_id)).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Password not found or update failed (no rows affected).")
        
        return PasswordResponse.model_validate(response.data[0]).model_dump()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred during password update: {str(e)}")

@app.delete("/passwords/{password_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Passwords"])
async def delete_password_for_user(password_id: UUID, current_user: dict = Depends(get_current_user)):
    try:
        ownership_check = supabase.table('passwords').select('id').eq('id', str(password_id)).eq('user', str(current_user.id)).single().execute()
        if not ownership_check.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Password not found or you do not have permission to delete it.")
        
        supabase.table('passwords').delete().eq('id', str(password_id)).execute()

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# =============================================================================
# LEAD CAMPAIGN ENDPOINTS (Analytics)
# =============================================================================

@app.get("/lead-campaigns", response_model=List[CampaignItemResponse], tags=["Lead Campaigns"])
async def get_all_lead_campaigns(current_user: dict = Depends(get_current_user)):
    try:
        response = supabase.table('lead_campaigns').select(
            '*, lead:leads(id, first_name, last_name), campaign:campaigns(name)'
        ).eq(
            'user', str(current_user_id)
        ).execute()
        
        if not response.data:
            return []

        return response.data
    except Exception as e:
        logging.error(f"Failed to get lead-campaigns for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not retrieve lead campaigns.")

# =============================================================================
# OAUTH ENDPOINTS
# =============================================================================
@app.post("/oauth", response_model=OAuthAccountResponse, status_code=status.HTTP_201_CREATED, tags=["OAuth"])
async def create_oauth_account(oauth_data: OAuthAccountCreate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    new_oauth_account = oauth_data.model_dump()
    new_oauth_account['user'] = str(current_user_id)
    try:
        response = supabase.table('oauth').insert(new_oauth_account).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create OAuth account")
        return response.data[0]
    except Exception as e:
        logging.error(f"Error creating OAuth account for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.get("/oauth", response_model=List[OAuthAccountResponse], tags=["OAuth"])
async def get_oauth_accounts(current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        response = supabase.table('oauth').select('*').eq('user', str(current_user_id)).execute()
        return response.data
    except Exception as e:
        logging.error(f"Error getting OAuth accounts for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve OAuth accounts")

@app.delete("/oauth/{oauth_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["OAuth"])
async def delete_oauth_account(oauth_id: UUID, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        ownership_check = supabase.table('oauth').select('id').eq('id', str(oauth_id)).eq('user', str(current_user_id)).single().execute()
        if not ownership_check.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OAuth account not found or you do not have permission to delete it.")
        
        supabase.table('oauth').delete().eq('id', str(oauth_id)).execute()
    except Exception as e:
        logging.error(f"Error deleting OAuth account {oauth_id} for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
